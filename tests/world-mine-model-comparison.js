'use strict';
// Diagnostic only: compare the two existing combat models on matched mine lineups.
// A mismatch is evidence that the new mine route cannot claim client-fight parity.
const path=require('node:path');
const HOST=require('../server/sim-host.js');
const SIM=require('../server/sim.js');
const host=HOST.load(path.join(__dirname,'..','emberweave-heroes.html'));
const heroes=['vael','sylthaine','vireo'];
const seeds=[11,17,23,29,41];
function lineMonster(spec){
  const base=host.monsterBase(spec.key);
  const unit=SIM.CORE.buildUnit(spec.key,{hp:base.hp,dmg:base.dmg,role:base.role},
    1+0.05*(spec.level-1),1,spec.rank||0,{});
  const scale=(1+0.05*(spec.level-1))*(1+0.12*(spec.rank||0));
  unit.maxHp=Math.max(1,Math.round(base.hp*scale));
  unit.atkP=Math.max(1,Math.round(base.dmg*scale));
  unit.atk=unit.atkP;
  unit.role=base.role==='Tank'?'Tank':'Bruiser';
  return unit;
}
for(const tier of [1,2,3,4]){
  const level=[1,8,16,26][tier-1];
  const specs=heroes.map(key=>({key,level,stars:1,pips:0,rank:0}));
  const clientSnaps=host.snapFromSpecs(specs);
  const lineSnaps=heroes.map(key=>SIM.heroCombatStats(key,{level,stars:1,pips:0}));
  const garrison=host.mineGarrison({id:`mn30000_${tier}`,level:tier,x:10,y:10});
  const foes=garrison.map(lineMonster);
  const rows=seeds.map(seed=>{
    const client=host.auto(clientSnaps,garrison,seed);
    const line=SIM.resolveLineBattle(SIM.makeLine(lineSnaps),SIM.makeLine(foes),seed);
    return {seed,client:client.won,line:line.won,
      clientHp:JSON.parse(client.digest).u.filter(u=>u[1]==='ally').map(u=>u[3]),
      lineHp:line.aState.map(u=>u.hp)};
  });
  console.log(JSON.stringify({tier,level,garrison:garrison.map(x=>x.key),
    clientSquad:clientSnaps.map(s=>({key:s.key,maxHp:Math.round(s.maxHp),dmg:Math.round(s.dmg)})),
    lineSquad:lineSnaps.map(s=>({key:s.key,maxHp:s.maxHp,atk:s.atk})),rows}));
}
