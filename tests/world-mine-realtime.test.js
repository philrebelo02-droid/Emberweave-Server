'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const host=require('../server/sim-host.js').load(path.join(__dirname,'..','emberweave-heroes.html'));
const specs=['vael','sylthaine','vireo'].map(key=>({key,level:20,stars:1,pips:0,rank:0}));
const full=host.snapFromSpecs(specs);
const wounded=full.map(s=>{
  const hp=Math.round(s.maxHp*0.7);
  return {...s,hp,worldEntryHpCap:hp};
});
const foes=host.mineGarrison({id:'mn30000_1',level:1,x:10,y:10});
assert.equal(foes.length,5);
const unit={hp:50,maxHp:100,_worldEntryHpCap:70,mortalT:0};
host.sandbox.healUnit(unit,100);
assert.equal(unit.hp,70,'direct healing stops at world-entry HP');
for(const seed of [11,17,23,29,41]){
  const ordinary=host.auto(full,foes,seed);
  const fullCap=host.auto(full.map(s=>({...s,hp:s.maxHp,worldEntryHpCap:s.maxHp})),foes,seed);
  assert.equal(fullCap.digest,ordinary.digest,'full-health world cap does not change a normal fight');
  const fight=host.auto(wounded,foes,seed);
  const rows=JSON.parse(fight.digest).u.filter(u=>u[1]==='ally');
  for(const s of wounded){
    const row=rows.find(u=>u[0]===s.key);
    assert.ok(row,`missing ${s.key} outcome`);
    assert.ok(row[3]<=s.worldEntryHpCap,`${s.key} exceeded entry HP`);
  }
}
console.log('World mine real-time HP cap passed');
