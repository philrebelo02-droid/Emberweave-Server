'use strict';const test=require('node:test'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=process.env.GUILD_FIXTURE_ROOT||path.resolve(__dirname,'..'),packet={requestId:'private-resolve',attemptId:'private-attempt',dmg:100};
async function setup(kind='kill'){
 const file=path.join(root,'tests/private-resolve-fixture.cjs'),m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 let s=fs.readFileSync(path.join(root,'tests/guild-leadership.test.cjs'),'utf8').split("for(const kind of ['stale','missing'])")[0];
 const raid={level:1,max:400000,hp:kind==='kill'?1:400000,kills:0,contrib:{},used:{'fixture-user':1},day:'2026-10-02',att:{'fixture-user':{id:packet.attemptId,reqId:'private-start',startedAt:1790928000000-(kind==='expired'?600001:0),bossKey:'skarrn',bossLvl:1,bossHp:1,tier:1,seed:1,snaps:null}}};
 s=s.replace('level:1,exp:0,log:[],reqs:[]',`level:1,exp:0,log:[],reqs:[],raid:${JSON.stringify(raid)}`);
 if(['retained','legacy','foreign-receipt'].includes(kind)){
  const receipt={t:1790928000000-86400001,resp:{ok:true,dmg:1,killed:true,reward:{guildCoins:300,gold:800,gems:18,tier:1},ledger:{gold:-1}}};
  if(kind!=='legacy'){receipt.guildId=kind==='foreign-receipt'?'other-guild':'own-guild';receipt.attemptId=packet.attemptId;}
  assert(s.includes('log:[]}},idem:{}'));
  s=s.replace('log:[]}},idem:{}',`log:[]}},idem:${JSON.stringify({'fixture-user:graidres:private-resolve':receipt})}`);
 }
 m._compile(s+'\nmodule.exports={setup};',file);return m.exports.setup(kind==='removed'?'removed':'valid');
}
for(const kind of ['kill','no-kill','expired'])test('Resolve '+kind+' write/rename failure refuses and preserves both worlds; retry/restart/replay once',async()=>{
 const{f}=await setup(kind);try{
 const before=f.bytes(),view=(await f.call('/api/guild/raid')).body,ledger=(await f.call('/api/ledger')).body;
 for(const fault of ['write',true]){await f.inject(fault);assert.equal((await f.call('/api/guild/raid/resolve',packet)).status,503);assert.equal(f.bytes(),before);assert.deepEqual((await f.call('/api/guild/raid')).body,view);assert.deepEqual((await f.call('/api/ledger')).body,ledger);}
 await f.inject(false);const saved=await f.call('/api/guild/raid/resolve',packet);assert.equal(saved.status,200);assert.equal(saved.body.expired===true,kind==='expired');assert.equal(saved.body.ok,kind!=='expired');
 const d=f.disk();assert.equal(d.guilds['own-guild'].raid.att['fixture-user'],undefined);assert.equal(d.idem['fixture-user:graidres:private-resolve'].attemptId,packet.attemptId);
 if(kind==='kill'){assert.equal(saved.body.killed,true);assert.deepEqual(saved.body.reward,{guildCoins:300,gold:800,gems:18,tier:1});assert.equal(d.users['fixture-user'].led.gold,100800);assert.equal(d.users['fixture-user'].led.gems,100018);assert.equal(d.users['fixture-user'].led.guildCoins,300);assert.equal(d.guilds['own-guild'].exp,250);assert.equal(d.guilds['own-guild'].raid.level,2);}
 if(kind==='no-kill'){assert.equal(saved.body.killed,false);assert(saved.body.dmg>0);assert.equal(saved.body.reward.guildCoins,Math.round(saved.body.dmg/50));}
 if(kind==='expired')assert.equal(d.users['fixture-user'].led.txs.filter(x=>x.src==='guild-raid').length,0);
 const after=f.bytes();assert.deepEqual((await f.call('/api/guild/raid/resolve',packet)).body,saved.body);assert.equal(f.bytes(),after);await f.stop();await f.launch();assert.deepEqual((await f.call('/api/guild/raid/resolve',packet)).body,saved.body);assert.equal(f.bytes(),after);
 }finally{await f.stop();}
});
test('Receipt mismatched attempt refuses, unknown attempt does not migrate or cache',async()=>{const{f}=await setup();try{const before=f.bytes();assert.equal((await f.call('/api/guild/raid/resolve',{...packet,attemptId:'wrong'})).body.ok,false);assert.equal(f.bytes(),before);await f.call('/api/guild/raid/resolve',packet);const after=f.bytes();assert.equal((await f.call('/api/guild/raid/resolve',{...packet,attemptId:'wrong'})).status,409);assert.equal(f.bytes(),after);}finally{await f.stop();}});
test('Receipt replay projects current wallet after another transaction, without paying again',async()=>{const{f}=await setup();try{await f.call('/api/guild/raid/resolve',packet);await f.call('/api/guild/contribute',{});const current=(await f.call('/api/ledger')).body;const before=f.bytes();const replay=await f.call('/api/guild/raid/resolve',packet);assert.deepEqual(replay.body.ledger,current);assert.equal(f.bytes(),before);}finally{await f.stop();}});
test('Missing auth/current membership refuses before receipt',async()=>{for(const kind of ['kill','removed']){const{f}=await setup(kind);try{const before=f.bytes();assert.equal((await f.call('/api/guild/raid/resolve',packet,kind==='kill'?null:undefined)).status,kind==='kill'?401:403);assert.equal(f.bytes(),before);}finally{await f.stop();}}});
test('Retained receipt older than24h is recovery only with current ledger and no new payment',async()=>{const{f}=await setup('retained');try{const before=f.bytes(),current=(await f.call('/api/ledger')).body;const result=await f.call('/api/guild/raid/resolve',packet);assert.equal(result.status,200);assert.deepEqual(result.body.ledger,current);assert.equal(f.bytes(),before);assert(f.disk().guilds['own-guild'].raid.att['fixture-user']);}finally{await f.stop();}});
test('Legacy unbound and foreign guild receipts fail closed without replay or charging',async()=>{for(const kind of ['legacy','foreign-receipt']){const{f}=await setup(kind);try{const before=f.bytes();assert.equal((await f.call('/api/guild/raid/resolve',packet)).status,409);assert.equal(f.bytes(),before);assert(f.disk().guilds['own-guild'].raid.att['fixture-user']);}finally{await f.stop();}}});
test('Save failure reward cannot leak into a later unrelated contribution commit',async()=>{const{f}=await setup('kill');try{const before=f.disk();await f.inject(true);assert.equal((await f.call('/api/guild/raid/resolve',packet)).status,503);await f.inject(false);assert.equal((await f.call('/api/guild/contribute',{})).status,200);const d=f.disk();assert.deepEqual(d.guilds['own-guild'].raid,before.guilds['own-guild'].raid);assert.equal(d.idem['fixture-user:graidres:private-resolve'],undefined);assert.equal(d.users['fixture-user'].led.gems,before.users['fixture-user'].led.gems);assert.equal(d.users['fixture-user'].led.guildCoins||0,before.users['fixture-user'].led.guildCoins||0);assert.equal(d.users['fixture-user'].led.txs.filter(x=>x.src==='guild-raid').length,0);}finally{await f.stop();}});
