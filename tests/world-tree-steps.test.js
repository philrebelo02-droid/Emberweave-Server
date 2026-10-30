'use strict';
// v1226 (Phil 30 Oct 2026): "Make sure the world tree is programmed to change per day, and per hour during world tree event" /
// "World tree needs to make sure its programmed properly". The cycle (assets/ui/world-tree-cycle.js, shared by client and server):
// decay = 13 New York day states, the event = 24 New York hour states, each mapped evenly onto the 28 frames.
// Prints the full day-by-day and hour-by-hour table across a cycle that holds the 25 h DST night (31 Oct -> 1 Nov 2026).
const test=require('node:test'),assert=require('node:assert/strict');
const cycle=require('../assets/ui/world-tree-cycle.js'),calendar=require('../server/world-tree-calendar.js'),art=require('../assets/ui/world-tree-art.js');
const HOUR=3600000, DAY=86400000;
const FIRST=Date.parse('2026-10-31T12:00:00Z');          // Saturday 31 Oct 2026 08:00 EDT - the event that spans the clock change
const ny=t=>new Date(t).toLocaleString('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZoneName:'short'});
const EXPECT_DECAY=[27,25,23,20,18,16,14,11,9,7,5,2,0];   // round((12-d)*27/12)
const EXPECT_EVENT=Array.from({length:24},(_,h)=>Math.round(h*27/23));
test('decay: one state per New York day, 13 states, 27 down to 0, boundaries on 08:00',()=>{
  const start=cycle.eventEnd(FIRST), next=cycle.boundary(FIRST,1);
  assert.equal(new Date(start).toISOString(),'2026-11-01T13:00:00.000Z','the decay after the DST event starts Sunday 08:00 EST');
  const rows=[];
  for(let d=0;d<13;d++){
    const at=cycle.fromWall(cycle.wall(start)+d*DAY), p=cycle.phase(FIRST,at), mid=cycle.phase(FIRST,at+11*HOUR), last=cycle.phase(FIRST,cycle.fromWall(cycle.wall(start)+(d+1)*DAY)-1);
    assert.equal(p.phase,'decay');assert.equal(p.step,d);assert.equal(mid.step,d);assert.equal(last.step,d,'day '+(d+1)+' holds until the next 08:00');
    assert.equal(p.framePosition,EXPECT_DECAY[d]);assert.equal(p.frame,EXPECT_DECAY[d]+1);assert.equal(p.lifeFraction,(EXPECT_DECAY[d]+1)/28);
    assert.equal(p.nextStepAt,d===12?next:cycle.fromWall(cycle.wall(start)+(d+1)*DAY));
    assert.ok(/08:00/.test(ny(at)),'day '+(d+1)+' starts at 08:00 New York ('+ny(at)+')');
    rows.push('decay day '+String(d+1).padStart(2)+'  '+ny(at).padEnd(32)+' frame wt_'+String(p.frame).padStart(2,'0'));
  }
  // monotonic: the tree never grows back while it decays
  let prev=99; for(let t=start;t<next;t+=HOUR){const fp=cycle.phase(FIRST,t).framePosition;assert.ok(fp<=prev);prev=fp;}
  console.log(rows.join('\n'));
});
test('event: one state per New York hour, 24 states, 0 up to 27, the 25 h DST night counted on the wall clock',()=>{
  const end=cycle.eventEnd(FIRST);
  assert.equal(end-FIRST,25*HOUR,'31 Oct 08:00 EDT -> 1 Nov 08:00 EST is 25 hours');
  const rows=[], seen=new Map();
  for(let t=FIRST;t<end;t+=HOUR){
    const p=cycle.phase(FIRST,t);
    assert.equal(p.phase,'event');assert.equal(p.framePosition,EXPECT_EVENT[p.step]);assert.equal(art.frameFor(p),p.frame);
    seen.set(p.step,(seen.get(p.step)||0)+1);
    rows.push('event '+ny(t).padEnd(32)+' hour state '+String(p.step+1).padStart(2)+'  frame wt_'+String(p.frame).padStart(2,'0')+'  next step '+ny(p.nextStepAt));
  }
  assert.equal(seen.size,24,'all 24 hour states are shown');
  const doubled=[...seen].filter(([,n])=>n===2).map(([s])=>s);
  assert.equal(doubled.length,1,'exactly one state lasts two real hours - the repeated 01:00');
  assert.ok(/01:/.test(ny(cycle.fromWall(cycle.wall(FIRST)+doubled[0]*HOUR))),'the doubled state is the 01:00 hour');
  let prev=-1; for(let t=FIRST;t<end;t+=60000){const fp=cycle.phase(FIRST,t).framePosition;assert.ok(fp>=prev,'the tree never shrinks during the event');prev=fp;}
  console.log(rows.join('\n'));
});
test('event start and end land exactly on the boundaries',()=>{
  const end=cycle.eventEnd(FIRST), before=cycle.phase(FIRST,FIRST-1), at=cycle.phase(FIRST,FIRST), last=cycle.phase(FIRST,end-1), after=cycle.phase(FIRST,end);
  assert.deepEqual([before.phase,before.step,before.frame],['decay',12,1],'the last decay day, wt_01, until 07:59:59.999');
  assert.deepEqual([at.phase,at.step,at.frame,at.remainingMs],['event',0,1,25*HOUR]);
  assert.deepEqual([last.phase,last.step,last.frame,last.remainingMs],['event',23,28,1]);
  assert.deepEqual([after.phase,after.step,after.frame],['decay',0,28]);
  assert.equal(before.nextStepAt,FIRST);assert.equal(last.nextStepAt,end);
  // an ordinary (24 h) event two weeks later
  const n2=cycle.boundary(FIRST,1), e2=cycle.eventEnd(n2);
  assert.equal(e2-n2,DAY);assert.equal(cycle.phase(FIRST,n2).step,0);assert.equal(cycle.phase(FIRST,e2-1).step,23);assert.equal(cycle.phase(FIRST,e2).phase,'decay');
  // spring forward (14 Mar 2027 falls in a decay): still 13 day states, the short day is one state
  const spring=Date.parse('2027-03-14T12:00:00Z'), k=[...Array(30).keys()].find(i=>cycle.boundary(FIRST,i)<=spring&&cycle.boundary(FIRST,i+1)>spring);
  const ds=cycle.eventEnd(cycle.boundary(FIRST,k)), de=cycle.boundary(FIRST,k+1), steps=new Set();
  for(let t=ds;t<de;t+=HOUR) steps.add(cycle.phase(FIRST,t).step);
  assert.equal(steps.size,13,'13 day states across the spring-forward decay');
});
test('the waiting phase before the first decay shows the sliver and counts to the event',()=>{
  const w=cycle.phase(FIRST,FIRST-20*DAY);
  assert.deepEqual([w.phase,w.framePosition,w.frame,w.nextStepAt,w.remainingMs],['waiting',0,1,FIRST,20*DAY]);
  const first=cycle.phase(FIRST,FIRST-13*DAY);assert.equal(first.phase,'decay');assert.equal(first.step,0);assert.equal(first.frame,28);
});
test('client and server name the same frame at every hour of a cycle; the anchor is never reset by a deploy',()=>{
  const DB={};let saves=0;
  calendar.snapshot(DB,{now:FIRST-14*DAY,firstEventAt:FIRST,save:()=>saves++});
  const restored=JSON.parse(JSON.stringify(DB));   // a deploy / restart reads the saved world
  const warn=console.warn; let warned=0; console.warn=()=>{warned++;};
  for(let t=FIRST-13*DAY;t<cycle.boundary(FIRST,1)+DAY;t+=HOUR){
    const server=calendar.snapshot(restored,{now:t,firstEventAt:FIRST+7*DAY,save:()=>saves++});   // a different configured anchor is ignored
    const client=cycle.phase(server.firstEventAt,t);
    assert.equal(server.framePosition,client.framePosition);assert.equal(art.frameFor(client),server.frame);
    assert.equal(server.firstEventAt,FIRST);
  }
  console.warn=warn; assert.ok(warned>0,'a differing configured anchor is reported, not applied');
  assert.equal(saves,1,'the anchor is written once, never again');
});
