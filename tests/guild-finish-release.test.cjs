'use strict';
// Focused private HTTP qualification of the real current-main integration file.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),a=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),server=path.join(root,'server.js'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const expected='80657d9ed466416028a10d2f012ae337a0417b08e83ea948f9fa76da2887eb05';
a.equal(hash(fs.readFileSync(server)),expected);
a(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const file=path.join(__dirname,'durable-routes.test.js');
let src=fs.readFileSync(file,'utf8').split('for(const row of cases)test(')[0];
a(src.includes('guilds:{},idem:{}'));
src=src.replace('guilds:{},idem:{}',"guilds:{'control-guild':{id:'control-guild',name:'Private Finish Control',leader:'fixture-user',members:['fixture-user','foreign-fixture'],reqs:[],level:1,exp:0,motd:'Synthetic',log:[],createdAt:1790928000000}},idem:{}");
// The fixture clock advances without changing server files or a live process.
src=src.replace("fail=m.fail;process.send?.({fail});","if(m.now!==undefined)process.env.FIXTURE_NOW=String(m.now);else fail=m.fail;process.send?.({fail});");
src=src.replace('FIXTURE_NOW:String(start)', 'FIXTURE_NOW:String(process.env.QUALIFY_NOW||start)');
src=src.replace('return {launch,stop,inject,call,bytes,disk,',"return {launch,stop,inject,call,bytes,disk,advance:async now=>{process.env.QUALIFY_NOW=String(now);await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('clock timeout')),3000);child.once('message',()=>{clearTimeout(timer);r();});child.send({now});});},");
// Natural source-guarded controls remove only the finish release or restore the old age rejection.
const hook=String.raw`const M=require('node:module'),old=M._extensions['.js'];M._extensions['.js']=function(mod,file){if(file===process.env.QUALIFY_SERVER&&process.env.QUALIFY_CONTROL){let s=fs.readFileSync(file,'utf8');const line='delete r.bossReservation; // Q6: a settled fight releases its exclusive boss atomically.';if(s.split(line).length!==2)throw Error('control guard');s=s.replace(line,process.env.QUALIFY_CONTROL==='release'?'/* natural control: no finish release */':"if(Date.now()-(a.startedAt||0)>10*60*1000)return {ok:false,expired:true};");mod._compile(s,file);}else old(mod,file);};`;
src=src.replace('let child,port,log=',`fs.appendFileSync(path.join(dir,'clock.cjs'),${JSON.stringify(hook)});let child,port,log=`);
const m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(src+'\nmodule.exports={fixture};',file);
const rows=[];
(async()=>{for(const mode of ['release','late','candidate']){let f;delete process.env.QUALIFY_NOW;process.env.QUALIFY_CONTROL=mode==='candidate'?'':mode;process.env.QUALIFY_SERVER=server;
try{f=await m.exports.fixture({seed:u=>{u.guildId='control-guild';u.led.skill={vael:[1,1,1,1]};u.led.skillImported=1790928000000;}});await f.launch();
const started=await f.call('/api/guild/raid/start',{requestId:'r3:2026-10-02:finish',heroIds:['vael']});a.equal(started.body.ok,true);
const packet={requestId:'finish-result',attemptId:started.body.attemptId,inputLog:[],dmg:12345};
if(mode!=='release')await f.advance(Date.parse('2026-10-02T04:00:00-04:00')+600001);
let before=f.bytes();
if(mode==='candidate'){await f.inject(true);a.equal((await f.call('/api/guild/raid/resolve',packet)).status,503);a.equal(f.bytes(),before);a(f.disk().guilds['control-guild'].raid.bossReservation);await f.inject(false);}
const reply=await f.call('/api/guild/raid/resolve',packet),raid=f.disk().guilds['control-guild'].raid;
if(mode==='release'){a.equal(reply.body.ok,true);a(raid.bossReservation,'natural parent leaves reservation');}
else if(mode==='late'){a.equal(reply.body.expired,true);a.equal(f.bytes(),before);a(raid.bossReservation);}
else {a.equal(reply.body.ok,true);a.equal(reply.body.dmg,12345);a.equal(raid.bossReservation,undefined);a.equal(raid.att['fixture-user'],undefined);a.equal(raid.hp,387655);before=f.bytes();a.equal((await f.call('/api/guild/raid/resolve',packet)).body.dmg,12345);a.equal(f.bytes(),before);await f.stop();await f.launch();a.equal((await f.call('/api/guild/raid/resolve',packet)).body.dmg,12345);a.equal(f.bytes(),before);const next=await f.call('/api/guild/raid/start',{requestId:'r3:2026-10-02:next',heroIds:['vael']});a.equal(next.body.ok,true,'finish unlock permits next paid entry');a.notEqual(next.body.attemptId,started.body.attemptId);}
rows.push({mode,status:reply.status,ok:reply.body.ok,expired:reply.body.expired,reservationRemaining:!!raid.bossReservation,late:mode!=='release'});
}catch(e){if(f)console.error(f.log().slice(-1400));throw e;}finally{if(f)await f.stop();}}
delete process.env.QUALIFY_CONTROL;delete process.env.QUALIFY_SERVER;delete process.env.QUALIFY_NOW;
const result={atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),sourceSHA256:expected,helperSHA256:hash(fs.readFileSync(__filename)),rows,limits:'Synthetic private current-main HTTP only. Natural one-line controls demonstrate finish lock and age rejection; candidate verifies late accepted settlement, failed-save reservation retention, exact/restart replay and next paid entry. Stale/expiry/quit/client retry/full combat/balance/deployment still OPEN.'};
fs.writeFileSync(path.join(__dirname,'guild-finish-release.evidence.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));a.equal(hash(fs.readFileSync(server)),expected);
})().catch(e=>{console.error(e);process.exitCode=1;});
