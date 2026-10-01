'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const art=require('../assets/ui/world-tree-art.js'),cycle=require('../assets/ui/world-tree-cycle.js');
const FIRST=Date.parse('2026-10-03T12:00:00Z');
test('sliver to full uses frames 2..28, never fully dead',()=>{
 assert.equal(art.frameFor({lifeFraction:1/28}),2);assert.equal(art.frameFor({lifeFraction:1}),28);assert.equal(art.frameFor({}),null);
 for(let i=0;i<=100;i++)assert.ok(art.frameFor({lifeFraction:i/100})>=2);
});
test('art and countdown share event boundaries',()=>{
 assert.equal(art.frameFor(cycle.phase(FIRST,FIRST)),2);
 assert.equal(art.frameFor(cycle.phase(FIRST,FIRST+cycle.DAY)),28);
 assert.equal(cycle.phase(FIRST,FIRST).remainingMs,cycle.DAY);
 assert.equal(cycle.phase(FIRST,FIRST-20*cycle.DAY).phase,'waiting');
 assert.equal(cycle.phase(FIRST,FIRST-20*cycle.DAY).remainingMs,20*cycle.DAY);
});
test('fortnightly Saturday 08:00 remains correct across DST',()=>{
 assert.equal(new Date(cycle.boundary(FIRST,3)).toISOString(),'2026-11-14T13:00:00.000Z');
 assert.equal(new Date(cycle.boundary(FIRST,12)).toISOString(),'2027-03-20T12:00:00.000Z');
 const start=cycle.boundary(FIRST,2);assert.equal(cycle.phase(FIRST,start).remainingMs,cycle.DAY);
 const next=cycle.boundary(FIRST,3);assert.equal(cycle.phase(FIRST,next).phase,'event');
 assert.equal(cycle.phase(FIRST,next-1).remainingMs,1);
});
