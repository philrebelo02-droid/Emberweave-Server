'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),test=require('node:test'),assert=require('node:assert/strict');
process.env.RAID_CLIENT_HTML=path.join(__dirname,'payload/combined/emberweave-heroes.html');
const name=path.join(__dirname,'settlement-fixture.cjs'),m=new Module(name);m.filename=name;m.paths=Module._nodeModulePaths(__dirname);
m._compile(fs.readFileSync(path.join(__dirname,'../guild-raid-entry-lock-v942/tests.cjs'),'utf8').split("test('Same-account simultaneous")[0]+'\nmodule.exports={setup,locks};',name);
const{setup,locks}=m.exports,key='ew_raid_pending_v1_actor';
const packet=(id,dmg=10)=>({requestId:id,attemptId:'attempt',inputLog:[],dmg});
function seed(shared){shared.set(key,JSON.stringify({v:1,accountId:'actor',guildId:'guild',kind:'start',createdAt:1,packet:{requestId:'parent',heroIds:['hero']}}));}
test('Competing result transitions must hold exclusive account lock through network',async()=>{
 const shared=new Map(),lock=locks(),a=setup(shared,lock),b=setup(shared,lock);seed(shared);
 let hook=false;a.c.localStorage.setItem=(k,v)=>{if(!hook){hook=true;b.c.raidSettlementQueue(packet('B',20),{},1,'parent');}shared.set(k,v);};
 a.c.raidSettlementQueue(packet('A'),{},1,'parent');const sent=a.effects.packets.length+b.effects.packets.length;
 if(a.effects.packets.length)a.reject();if(b.effects.packets.length)b.reject();await Promise.all([a.flush(),b.flush()]);
 assert.equal(sent,1,'Two different transcripts of one parent entry must not leave concurrently');
});
test('Held entry lock prevents settlement journal transition and outbound result',async()=>{
 const shared=new Map(),lock=locks(),f=setup(shared,lock);seed(shared);const raw=shared.get(key);lock.held.add(key);
 f.c.raidSettlementQueue(packet('A'),{},1,'parent');const sent=f.effects.packets.length;if(sent)f.reject();await f.flush();
 assert.equal(sent,0,'Settlement must not bypass the account entry lock');assert.equal(shared.get(key),raw,'Canonical identity remains unchanged while lock held');
});
test('Same result request ID with altered transcript cannot overwrite immutable saved packet',async()=>{
 const shared=new Map(),lock=locks(),a=setup(shared,lock),b=setup(shared,lock);seed(shared);
 a.c.raidSettlementQueue(packet('same',10),{},1,'parent');a.reject();await a.flush();const raw=shared.get(key);
 b.c.raidSettlementQueue(packet('same',20),{},1,'parent');const sent=b.effects.packets.length;if(sent)b.reject();await b.flush();
 assert.equal(sent,0,'An existing identity binds the entire packet, not just requestId');assert.equal(shared.get(key),raw);
});
