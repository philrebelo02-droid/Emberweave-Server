/* Temple of Ash: server-owned prayer, idempotent spend, and saved combat effects. */
'use strict';
const {spawn}=require('child_process'), http=require('http'), fs=require('fs'), os=require('os'), path=require('path');
const TEMPLE=require('../server/temple-of-ash.js');
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
  const grant=await req('POST','/api/admin/led-grant',{px:99000000,gold:1000000,maxGlyphs:true,heroKeys:['vael']},tok);
  ck('fixture reaches level 50, owns Vael at Purple+, and has server-owned gold',
    grant.ok&&grant.ledger.playerLevel>=50&&grant.ledger.unlocked.vael&&grant.ledger.gold>=1000000);
  const before=await req('GET','/api/admin/snapshot?hero=vael',null,tok);
  ck('baseline authoritative combat snapshot exists',!!before.snapshot);
  const rid='prayer-once';
  const bad=await req('POST','/api/temple/pray',{requestId:'bad-hero',heroKey:'not-a-hero',tier:'gold'},tok);
  ck('invalid hero is refused without a debit',!bad.ok&&(await req('GET','/api/ledger',null,tok)).gold===grant.ledger.gold);
  const prayer={requestId:rid,heroKey:'vael',tier:'gold'};
  const one=await req('POST','/api/temple/pray',prayer,tok);
  const duplicate=await req('POST','/api/temple/pray',prayer,tok);
  ck('first Gold ritual spends only the canonical ladder price and creates pending rolls',
    one.ok&&one.ledger.gold===grant.ledger.gold-TEMPLE.CONFIG.GOLD_LADDER[0]&&
    one.rolls&&one.ledger.temple._pending);
  ck('same request id returns the same prayer without a second debit',
    duplicate.ok&&duplicate.ledger.rev===one.ledger.rev&&duplicate.ledger.gold===one.ledger.gold);
  const pending=await req('GET','/api/admin/snapshot?hero=vael',null,tok);
  ck('pending rolls do not alter the frozen combat snapshot before Save',
    pending.snapshot.maxHp===before.snapshot.maxHp&&pending.snapshot.atkP===before.snapshot.atkP);
  let saved=await req('POST','/api/temple/save',{requestId:'save-prayer-once'},tok);
  ck('Save commits steps and clears the pending session',
    saved.ok&&saved.ledger.temple._pending===null&&!!saved.ledger.temple.heroes.vael.steps);
  /* v1094 (Temple v2): a Gold ritual from 0 can roll nothing up; pray + save until some bar holds a step (bounded) */
  for(let i=0;i<6&&!Object.values(saved.ledger.temple.heroes.vael.steps).some(x=>x>0);i++){
    await req('POST','/api/temple/pray',{requestId:'prayer-more-'+i,heroKey:'vael',tier:'gold'},tok);
    saved=await req('POST','/api/temple/save',{requestId:'save-more-'+i},tok); }
  ck('a saved prayer leaves real steps on the hero',Object.values(saved.ledger.temple.heroes.vael.steps).some(x=>x>0),JSON.stringify(saved.ledger.temple.heroes.vael.steps));
  const after=await req('GET','/api/admin/snapshot?hero=vael',null,tok);
  const vb=require('../server/sim.js').HERO_BASE.vael;
  const bonuses=TEMPLE.heroBonuses(saved.ledger.temple.heroes.vael,vb.role,vb.damageProfile);
  const near=(a,b)=>Math.abs(a-b)<1e-6;
  ck('saved prayer creates at least one flat Temple stat',Object.values(bonuses).some(x=>x>0),JSON.stringify({role:vb.role,bonuses}));
  ck('saved Temple steps reach authoritative HP, Attack, Armor and Magic Resist snapshots exactly (flat)',
    near(after.snapshot.maxHp,before.snapshot.maxHp+(bonuses.hpFlat||0))&&
    near(after.snapshot.atkP,before.snapshot.atkP+(bonuses.adFlat||0))&&
    near(after.snapshot.armor,before.snapshot.armor+(bonuses.armorFlat||0))&&
    near(after.snapshot.mr,before.snapshot.mr+(bonuses.mrFlat||0))&&
    near(after.snapshot.armorPen,before.snapshot.armorPen+(bonuses.armorPenFlat||0)),
    JSON.stringify({bonuses,before:{hp:before.snapshot.maxHp,atkP:before.snapshot.atkP,armor:before.snapshot.armor},
      after:{hp:after.snapshot.maxHp,atkP:after.snapshot.atkP,armor:after.snapshot.armor}}));
  console.log('\nPASS: '+pass+'  FAIL: '+fail); await stop(); process.exit(fail?1:0);
})().catch(async e=>{console.error(e);await stop();process.exit(1);});
