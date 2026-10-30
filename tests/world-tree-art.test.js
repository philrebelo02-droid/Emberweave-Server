'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const art=require('../assets/ui/world-tree-art.js'),cycle=require('../assets/ui/world-tree-cycle.js');
const FIRST=Date.parse('2026-10-03T12:00:00Z');
// v1226 (Phil 30 Oct 2026): the tree STEPS - frame = framePosition + 1, all 28 frames; the art never computes its own time
test('the art shows exactly the frame the cycle names',()=>{
 for(let fp=0;fp<=27;fp++)assert.equal(art.frameFor({framePosition:fp}),fp+1);
 assert.equal(art.frameFor({}),null);assert.equal(art.frameFor({framePosition:28}),null);assert.equal(art.frameFor({framePosition:0.5}),null);
});
test('art and countdown share event boundaries',()=>{
 assert.equal(art.frameFor(cycle.phase(FIRST,FIRST)),1,'event hour 1 opens on frame 1');
 assert.equal(art.frameFor(cycle.phase(FIRST,FIRST+cycle.DAY-1)),28,'the last event hour is the full tree');
 assert.equal(art.frameFor(cycle.phase(FIRST,FIRST+cycle.DAY)),28,'decay day 1 starts full');
 assert.equal(cycle.phase(FIRST,FIRST).remainingMs,cycle.DAY);
 assert.equal(cycle.phase(FIRST,FIRST-20*cycle.DAY).phase,'waiting');
 assert.equal(cycle.phase(FIRST,FIRST-20*cycle.DAY).remainingMs,20*cycle.DAY);
});
test('fortnightly Saturday 08:00 remains correct across DST',()=>{
 assert.equal(new Date(cycle.boundary(FIRST,3)).toISOString(),'2026-11-14T13:00:00.000Z');
 assert.equal(new Date(cycle.boundary(FIRST,12)).toISOString(),'2027-03-20T12:00:00.000Z');
 // v1042: the 31 Oct event ends at Sunday 08:00 New York wall time - 25 h on the night the clocks go back (this check said 24 h
 // and failed on the live code too; corrected 30 Oct 2026)
 const start=cycle.boundary(FIRST,2);assert.equal(cycle.phase(FIRST,start).remainingMs,25*3600000);
 const next=cycle.boundary(FIRST,3);assert.equal(cycle.phase(FIRST,next).phase,'event');
 assert.equal(cycle.phase(FIRST,next-1).remainingMs,1);
});
