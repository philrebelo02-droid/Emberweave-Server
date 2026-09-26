'use strict';
// Diagnostic only: matched real-time and line-model city PvP squads.
// This measures parity; it does not assert that either model is approved.
const path=require('node:path');
const HOST=require('../server/sim-host.js');
const SIM=require('../server/sim.js');
const host=HOST.load(path.join(__dirname,'..','emberweave-heroes.html'));
const attackers=['vael','sylthaine','vireo'];
const defenders=['grosk','aureth','umbris'];
const seeds=[11,17,23,29,41];
let compared=0, outcomeMismatch=0, survivorMismatch=0;
const rows=[];
for(const [attackLevel,defenseLevel] of [[20,10],[20,20],[40,20],[40,40],[60,30],[60,60]]) for(const startHp of [1,0.7]){
  const spec=(keys,level)=>keys.map(key=>({key,level,stars:1,pips:0,rank:0}));
  const aClient=host.snapFromSpecs(spec(attackers,attackLevel)).map(s=>({...s,hp:Math.round(s.maxHp*startHp),worldEntryHpCap:Math.round(s.maxHp*startHp)}));
  const dClient=host.snapFromSpecs(spec(defenders,defenseLevel)).map(s=>({...s,hp:Math.round(s.maxHp*startHp),worldEntryHpCap:Math.round(s.maxHp*startHp)}));
  const aLine=attackers.map(key=>SIM.heroCombatStats(key,{level:attackLevel,stars:1,pips:0}));
  const dLine=defenders.map(key=>SIM.heroCombatStats(key,{level:defenseLevel,stars:1,pips:0}));
  const carry=snaps=>snaps.map(s=>({hp:Math.round(s.maxHp*startHp),energy:0}));
  for(const seed of seeds){
    const client=host.auto(aClient,dClient,seed);
    const line=SIM.resolveLineBattle(SIM.makeLine(aLine,carry(aLine),true),SIM.makeLine(dLine,carry(dLine),true),seed);
    const clientHp=JSON.parse(client.digest).u.filter(u=>u[1]==='ally').map(u=>Math.max(0,u[3]));
    const lineHp=line.aState.map(u=>u.hp);
    const winDiff=client.won!==line.won;
    const survivorsDiff=clientHp.filter(hp=>hp>0).length!==lineHp.filter(hp=>hp>0).length;
    compared++; outcomeMismatch+=winDiff?1:0; survivorMismatch+=survivorsDiff?1:0;
    rows.push({attackLevel,defenseLevel,startHp,seed,clientWon:client.won,lineWon:line.won,
      clientSurvivors:clientHp.filter(hp=>hp>0).length,lineSurvivors:lineHp.filter(hp=>hp>0).length,
      winDiff,survivorsDiff});
  }
}
console.log(JSON.stringify({compared,outcomeMismatch,survivorMismatch,rows:rows.filter(r=>r.winDiff||r.survivorsDiff)}));
