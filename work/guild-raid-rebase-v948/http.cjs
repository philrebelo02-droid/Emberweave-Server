'use strict';const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),a=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.join(__dirname,'../shady-gold-v942/snapshot'),server=path.join(root,'server.js'),saved=fs.readFileSync(server),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
a.equal(hash(saved),'71202733c70b7e0d5e301918a594214eef1087f7b3cdd8161e152ed6c113de65');a(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
let f;const calls=[];async function main(){try{
 fs.copyFileSync(path.join(__dirname,'private-server-v948.js'),server);
 const file=path.join(root,'tests/private-v948-raid-http.cjs'),m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 m._compile(fs.readFileSync(path.join(__dirname,'../guild-raid-recovery-only-v942/tests.cjs'),'utf8').split('const E=')[0].replace('root=process.env.GUILD_FIXTURE_ROOT','root='+JSON.stringify(root)).replace("path.join(root,'tests/guild-leadership.test.cjs')",JSON.stringify(path.join(__dirname,'../guild-leadership-v942/tests.cjs')))+'\nmodule.exports={setup};',file);({f}=await m.exports.setup());
 const call=async(route,packet)=>{const r=await f.call(route,packet);calls.push({route,packet,status:r.status,body:r.body});return r};
 const E={requestId:'rebase-entry',heroIds:['vael']},before=f.bytes();
 a.equal((await call('/api/guild/raid/start',{...E,recoverOnly:true})).status,409);a.equal(f.bytes(),before);
 await f.inject(true);a.equal((await call('/api/guild/raid/start',E)).status,503);a.equal(f.bytes(),before);await f.inject(false);
 const first=await call('/api/guild/raid/start',E);a.equal(first.status,200);a.equal(first.body.entryBinding.requestId,E.requestId);a.equal(f.disk().users['fixture-user'].raidDay.n,1);
 await f.stop();await f.launch();const resumed=await call('/api/guild/raid/start',{...E,recoverOnly:true});a.equal(resumed.body.attemptId,first.body.attemptId);a.equal(f.disk().users['fixture-user'].raidDay.n,1);
 const P={requestId:'rebase-result',attemptId:first.body.attemptId,inputLog:[],dmg:10},paid=f.bytes();await f.inject(true);a.equal((await call('/api/guild/raid/resolve',P)).status,503);a.equal(f.bytes(),paid);await f.inject(false);
 const settled=await call('/api/guild/raid/resolve',P);a.equal(settled.status,200);a.equal(settled.body.ok,true);a.equal(f.disk().users['fixture-user'].led.txs.filter(x=>x.src==='guild-raid').length,1);
 await f.stop();await f.launch();const replay=await call('/api/guild/raid/resolve',P);a.equal(replay.body.settlementBinding.packetHash,settled.body.settlementBinding.packetHash);a.equal(f.disk().users['fixture-user'].led.txs.filter(x=>x.src==='guild-raid').length,1);
 const second=await call('/api/guild/raid/start',{...E,requestId:'rebase-second'});a.equal(second.status,200);a.equal(second.body.ok,true);a.equal(f.disk().users['fixture-user'].raidDay.n,2);
 fs.writeFileSync(path.join(__dirname,'http-certificate.json'),JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),status:'NARROW_V948_PRIVATE_HTTP_RECOVERY_SAVE_FAILURE_RESTART_SECOND_ENTRY_PASS',serverSHA256:hash(fs.readFileSync(server)),calls,entryCount:2,raidTransactions:1,scope:'Actual private HTTP synthetic account with current-v948 rebased raid routes. Unknown strict resume no mutation; entry/result rename faults503 unchanged disk; retry/restart same entry; result replay same hash onegrant; second explicit freshentry accepted. No native/fullpage/phone/fullsuite/balance or deployment approval.'},null,2));console.log('PASS current-v948 actual privateHTTP save failures/restart/exact replay/secondentry; 2 entries,1 grant');
 }finally{if(f)await f.stop();fs.writeFileSync(server,saved);a.equal(hash(fs.readFileSync(server)),hash(saved));console.log('Owned child stopped and original private snapshot restored');}}
main().catch(e=>{console.error(e);process.exitCode=1});
