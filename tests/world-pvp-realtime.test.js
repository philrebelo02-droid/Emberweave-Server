'use strict';
// Candidate real-time world-PvP engine contract; no live route is changed here.
const assert=require('node:assert/strict');
const path=require('node:path');
const host=require('../server/sim-host.js').load(path.join(__dirname,'..','emberweave-heroes.html'));
const a=host.snapFromSpecs(['vael','sylthaine','vireo'].map(key=>({key,level:30,stars:1,pips:0,rank:0})));
const d=host.snapFromSpecs(['grosk','aureth','umbris'].map(key=>({key,level:30,stars:1,pips:0,rank:0})));
const wound=snaps=>snaps.map(s=>{
  const hp=Math.round(s.maxHp*0.7);
  return {...s,hp,worldEntryHpCap:hp};
});
const attackers=wound(a),defenders=wound(d);
const first=host.auto(attackers,defenders,17);
const retry=host.auto(attackers,defenders,17);
assert.equal(first.digest,retry.digest,'world fight replay is deterministic');
assert.equal(first.won,retry.won);
const digest=JSON.parse(first.digest);
for(const [team,snaps] of [['ally',attackers],['enemy',defenders]]){
  for(const s of snaps){
    const row=digest.u.find(u=>u[0]===s.key&&u[1]===team);
    // v1020: the engine removes some fallen units before its final digest (server.js mine settlement reads a
    // missing member as 0 HP). Only the side that LOST may be missing rows; a winner's row must be there.
    const lost=(team==='ally')!==first.won;
    assert.ok(row||lost,`missing ${team} ${s.key} final health on the winning side`);
    if(row) assert.ok(row[3]<=s.worldEntryHpCap,`${team} ${s.key} healed above world entry`);
  }
}
console.log('World PvP real-time candidate contract passed');
