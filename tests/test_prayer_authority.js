/* Temple Prayer: one server-owned atomic purchase, idempotent, reflected in combat snapshots. */
'use strict';
const {spawn}=require('child_process'), http=require('http'), fs=require('fs'), os=require('os'), path=require('path');
let pass=0,fail=0; const ck=(n,c,d)=>{c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+d:'')));};
const PORT=8894, dir=fs.mkdtempSync(path.join(os.tmpdir(),'prayer-')), DB=path.join(dir,'db.json');
let srv=null;
function boot(extra){ srv=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{env:Object.assign({},process.env,{PORT:String(PORT),DB_FILE:DB,REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100'},extra||{}),stdio:'ignore'}); }
function stop(){ return new Promise(r=>{if(!srv)return r(); srv.once('exit',r); srv.kill(); setTimeout(r,800);});}
function req(method,p,b,tok){return new Promise((resolve,reject)=>{const data=b?JSON.stringify(b):null;
  const q=http.request({host:'localhost',port:PORT,path:p,method,headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{},data?{'content-length':Buffer.byteLength(data)}:{})},res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>{try{resolve(JSON.parse(s));}catch(e){resolve({raw:s});}});});
  q.on('error',reject);if(data)q.write(data);q.end();});}
(async()=>{
  boot(); await new Promise(r=>setTimeout(r,1200));
  const reg=await req('POST','/api/register',{name:'prayertest',pass:'password1'}), tok=reg.token, id=reg.profile&&reg.profile.id;
  ck('test account registered',!!tok&&!!id);
  await stop(); boot({ADMIN_IDS:id}); await new Promise(r=>setTimeout(r,1200));
  const grant=await req('POST','/api/admin/led-grant',{px:99000000,gold:1000000},tok);
  ck('fixture reaches Temple with server-owned gold',grant.ok&&grant.ledger.playerLevel>=40&&grant.ledger.gold>=1000000);
  const before=await req('GET','/api/admin/snapshot?hero=vael',null,tok);
  const rid='prayer-once';
  const one=await req('POST','/api/temple/pray',{requestId:rid},tok);
  const duplicate=await req('POST','/api/temple/pray',{requestId:rid},tok);
  ck('server computes the first price and raises Prayer exactly once',one.ok&&one.cost===50000&&one.ledger.prayer===1);
  ck('same request id returns the same purchase without a second debit',duplicate.ok&&duplicate.ledger.prayer===1&&duplicate.ledger.gold===one.ledger.gold);
  const after=await req('GET','/api/admin/snapshot?hero=vael',null,tok);
  ck('Prayer increases authoritative HP and Attack snapshots',after.snapshot.maxHp>before.snapshot.maxHp&&after.snapshot.atkP>before.snapshot.atkP);
  ck('Prayer leaves Armor and Magic Resist unchanged',after.snapshot.armor===before.snapshot.armor&&after.snapshot.mr===before.snapshot.mr);
  console.log('\nPASS: '+pass+'  FAIL: '+fail); await stop(); process.exit(fail?1:0);
})().catch(async e=>{console.error(e);await stop();process.exit(1);});
