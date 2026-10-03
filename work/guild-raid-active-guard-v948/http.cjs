'use strict';const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),a=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.join(__dirname,'../shady-gold-v942/snapshot'),server=path.join(root,'server.js'),saved=fs.readFileSync(server),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
a.equal(hash(saved),'71202733c70b7e0d5e301918a594214eef1087f7b3cdd8161e152ed6c113de65');a(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const original=process.env.ACTIVE_CONTROL==='1',candidate=path.join(__dirname,original?'../guild-raid-strict-start-v948/private-server-strict-start.js':'private-server-active-guard.js');let f;const calls=[];let failure=null;
async function main(){try{
 fs.copyFileSync(candidate,server);const file=path.join(root,'tests/private-active-guard.cjs'),m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 m._compile(fs.readFileSync(path.join(__dirname,'../guild-raid-recovery-only-v942/tests.cjs'),'utf8').split('const E=')[0].replace('root=process.env.GUILD_FIXTURE_ROOT','root='+JSON.stringify(root)).replace("path.join(root,'tests/guild-leadership.test.cjs')",JSON.stringify(path.join(__dirname,'../guild-leadership-v942/tests.cjs')))+'\nmodule.exports={setup};',file);({f}=await m.exports.setup());
 const call=async(route,p)=>{const r=await f.call(route,p);calls.push({route,packet:p,status:r.status,body:r.body});return r};
 const E={requestId:'active-first',heroIds:['vael']},first=await call('/api/guild/raid/start',E);a.equal(first.body.ok,true);const before=f.bytes(),attempt=first.body.attemptId;
 const blocked=await call('/api/guild/raid/start',{...E,requestId:'active-second'});a.equal(blocked.status,409,'a second fresh start must preserve the first paid slot');a.equal(blocked.body.activeRaidHeld,true);a.equal(f.bytes(),before);
 await f.stop();await f.launch();const resumed=await call('/api/guild/raid/start',{...E,recoverOnly:true});a.equal(resumed.body.attemptId,attempt);a.equal(f.disk().users['fixture-user'].raidDay.n,1);
 const P={requestId:'active-result',attemptId:attempt,inputLog:[],dmg:10},settled=await call('/api/guild/raid/resolve',P);a.equal(settled.body.ok,true);a.equal(f.disk().users['fixture-user'].led.txs.filter(x=>x.src==='guild-raid').length,1);
 const second=await call('/api/guild/raid/start',{...E,requestId:'active-second'});a.equal(second.body.ok,true);a.notEqual(second.body.attemptId,attempt);a.equal(f.disk().users['fixture-user'].raidDay.n,2);
 console.log('PASS actual HTTP: paid slot preserved across blocked fresh entry/restart, first result one grant, second entry only after settlement');
 }catch(e){failure={name:e.name,message:e.message};throw e}finally{
 if(f)await f.stop();fs.writeFileSync(server,saved);a.equal(hash(fs.readFileSync(server)),hash(saved));
 fs.writeFileSync(path.join(__dirname,original?'original-control.json':'http-certificate.json'),JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),status:failure?'FAILED_EXPECTED_IF_ORIGINAL_CONTROL':'PASS_PRIVATE_HTTP_COMPONENT',serverSHA256:hash(fs.readFileSync(candidate)),calls,failure,fixtureRestored:true,scope:'Actual owned private HTTP synthetic account, source guard not whole-suite/current native/browser/phone/balance proof. No live writes.'},null,2));console.log('Owned fixture stopped and restored');
 }}main().catch(e=>{console.error(e);process.exitCode=1});
