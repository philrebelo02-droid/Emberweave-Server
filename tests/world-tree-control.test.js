'use strict';
// World Tree control: a hero who fell in an earlier fight has no battle row in the next one (fight() sends only living heroes).
// 12 Oct 2026: the 'finish' handler read row.hp for that hero and threw on every tick, wedging the event.
const test=require('node:test'),assert=require('node:assert/strict');
const C=require(process.env.WT_CONTROL_PATH||'../server/world-tree-control.js');
const START=1800000000000,DAY=86400000,TRAVEL=1000,FIGHT=10000;
const windowAt=()=>({startsAt:START,endsAt:START+DAY,active:true});
const GUILD={a1:'G1',a2:'G1',b:'G2',c:'G3'};

function rig(){
  const calls=[],script=[];let n=0;
  const hooks={guildValid:(gid,owner)=>GUILD[owner]===gid,uid:()=>'m'+(++n),seed:(...p)=>p.join(':'),heroBusy:()=>false,
    squad:(owner,ids)=>ids.map(key=>({key,hp:1000,maxHp:1000,worldEntryHpCap:1000,energy:0})),
    route:()=>({travelMs:TRAVEL,route:{}}),
    battle:(a,d,seed)=>{calls.push({a:a.map(x=>x.key),d:d.map(x=>x.key)});return script.shift()(a,d);}};
  // Scripted outcome: survivors lose 100 HP, the named heroes die. Only the rows the fight was given come back.
  const outcome=(dead,won)=>(a,d)=>({won,durationMs:FIGHT,
    ally:a.map(x=>({key:x.key,hp:dead.includes(x.key)?0:x.hp-100,maxHp:x.maxHp})),
    foe:d.map(x=>({key:x.key,hp:dead.includes(x.key)?0:x.hp-100,maxHp:x.maxHp})),
    deaths:d.filter(x=>dead.includes(x.key)).map(x=>({team:'enemy',key:x.key,atMs:5000}))});
  let state=null;const effects=[];
  const run=(now,actor,action,payload={})=>{
    const r=C.dispatch(state,{enabled:true,window:windowAt(),now,actorId:actor,guildId:actor?GUILD[actor]:null,action,payload},hooks);
    assert.equal(r.ok,true,r.error);state=r.state;effects.push(...r.effects);return r;};
  return {calls,script,outcome,run,effects,get state(){return state;}};
}

test('an attacker who lost a hero finishes its next fight; the fallen hero stays at 0 HP and is not refought',()=>{
  const R=rig();
  R.script.push(R.outcome(['b2','a3'],true),R.outcome(['a1','a2'],true),R.outcome(['b1'],true));
  const A1=R.run(START,'a1','start',{siteId:'oasis-north',heroIds:['a1','a2']}).marchId;
  const A2=R.run(START+1,'a2','start',{siteId:'oasis-north',heroIds:['a3']}).marchId;
  const B=R.run(START+10,'b','start',{siteId:'oasis-north',heroIds:['b1','b2']}).marchId;
  // Fight 1 (B v A2) kills b2; B goes straight on to fight 2 (B v A1). The old code threw here, every tick.
  for(let t=START+TRAVEL+10;t<=START+TRAVEL+10+2*FIGHT+5;t+=1000)R.run(t,null,'tick');
  assert.deepEqual(R.calls.map(c=>c.a),[['b1','b2'],['b1']],'fight 2 must be fought by the living hero only');
  const b=R.state.marches[B],site=R.state.sites['oasis-north'];
  assert.equal(b.phase,'garrison');assert.equal(site.holderGuildId,'G2');assert.deepEqual(site.lines,[B]);
  assert.deepEqual(b.snaps.map(x=>[x.key,x.hp,x.worldEntryHpCap,x.energy]),[['b1',800,800,0],['b2',0,0,0]]);
  assert.equal(R.state.marches[A1].phase,'home');assert.equal(R.state.marches[A2].phase,'home');
  // The fight-2 injury effect names b1 only: b2's injury was applied once, by fight 1.
  const fight2=R.effects.find(e=>e.id.endsWith(':fight:'+B+':2'));
  assert.deepEqual(fight2.heroIds,['b1']);
});

test('a defending line whose last living hero dies, with a hero already at 0 HP, walks home instead of holding the site',()=>{
  const R=rig();
  R.script.push(R.outcome(['b2','a1'],true),R.outcome(['b1'],true));
  R.run(START,'a1','start',{siteId:'oasis-north',heroIds:['a1']});
  const B=R.run(START+10,'b','start',{siteId:'oasis-north',heroIds:['b1','b2']}).marchId;
  for(let t=START+TRAVEL+10;t<=START+TRAVEL+10+FIGHT+5;t+=1000)R.run(t,null,'tick');
  assert.equal(R.state.marches[B].phase,'garrison');
  const Cm=R.run(START+20000,'c','start',{siteId:'oasis-north',heroIds:['c1']}).marchId;
  for(let t=START+20000+TRAVEL;t<=START+20000+TRAVEL+FIGHT+5;t+=1000)R.run(t,null,'tick');
  assert.deepEqual(R.calls[1],{a:['c1'],d:['b1']},'the fallen defender is not put back into the fight');
  const b=R.state.marches[B],site=R.state.sites['oasis-north'];
  assert.equal(b.phase,'returning');assert.equal(b.returnReason,'killed');assert.deepEqual(b.heroIds,['b2']);
  assert.deepEqual(site.lines,[Cm]);assert.equal(site.holderGuildId,'G3');
  // Later ticks settle cleanly: nothing replays or throws.
  for(let t=START+40000;t<=START+40000+5*TRAVEL;t+=1000)R.run(t,null,'tick');
  assert.equal(R.state.marches[B].phase,'home');assert.equal(R.calls.length,2);
});
