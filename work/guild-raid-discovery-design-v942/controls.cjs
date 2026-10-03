'use strict';const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),test=require('node:test'),assert=require('node:assert/strict');
assert(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const name=path.join(__dirname,'owned-fixture.cjs'),m=new Module(name);m.filename=name;m.paths=Module._nodeModulePaths(__dirname);const original=path.resolve(__dirname,'../guild-raid-durable-stage-v942/tests.cjs'),source=fs.readFileSync(original,'utf8');
// Preserve original fixture-relative paths without copying game files or registering completed tests.
const fixtureName=path.join(path.dirname(original),'discovery-fixture.cjs');m.filename=fixtureName;m.paths=Module._nodeModulePaths(path.dirname(original));m._compile(source.split("test('Busy lock")[0]+'\nmodule.exports={setup,key,packet,stageKeys};',fixtureName);
const {setup,key,packet,stageKeys}=m.exports;
for(const [label,unrelated,canonical]of [['within budget',510,false],['transition adds513th key',511,false],['stage-only overglobalbound',513,false],['canonical exactpacket overglobalbound',513,true]])test('Valid recovery independent of unrelated keys: '+label,async()=>{
 const f=setup();f.lock.held.add(key);f.c.raidSettlementQueue(packet('discovery-control'),{name:'Boss',tier:1},Date.now(),null);await f.flush();assert.equal(stageKeys(f).length,1);assert.equal(f.effects.packets.length,0);f.lock.held.delete(key);
 if(canonical){const row=JSON.parse(f.shared.get(stageKeys(f)[0]));f.shared.set(key,JSON.stringify(row));}
 for(let i=0;i<unrelated;i++)f.shared.set('unrelated-fixture-'+i,'x');const before=new Map(f.shared);const fresh=setup(f.shared,f.lock);fresh.c.raidRecoverSaved();await fresh.flush();
 assert.equal(fresh.effects.packets.length,1,'A valid saved result must recover its exact packet despite unrelated keys');assert.deepEqual(fresh.effects.packets[0][2],packet('discovery-control'));
 fresh.reply({ok:true,dmg:10,ledger:{gold:100},reward:{guildCoins:1}});await fresh.flush();assert.equal(fresh.shared.has(key),false);assert.equal(stageKeys(fresh).length,0);for(const[k,v]of before)if(k.startsWith('unrelated-'))assert.equal(fresh.shared.get(k),v);
});
