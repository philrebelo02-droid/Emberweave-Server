'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const cycle=require('../assets/ui/world-tree-cycle.js'),calendar=require('../server/world-tree-calendar.js');
const START=1800000000000, FIRST=START+cycle.DECAY;
test('13-day countdown switches to exactly 24 hours, then back to 13 days',()=>{
  const before=cycle.phase(FIRST,START);assert.equal(before.phase,'decay');assert.equal(before.remainingMs,13*cycle.DAY);assert.equal(before.lifeFraction,1);
  const edge=cycle.phase(FIRST,FIRST-1);assert.equal(edge.remainingMs,1);assert.ok(Math.abs(edge.lifeFraction-1/28)<1e-9);
  const live=cycle.phase(FIRST,FIRST);assert.equal(live.phase,'event');assert.equal(live.remainingMs,cycle.DAY);assert.equal(live.lifeFraction,1/28);
  const after=cycle.phase(FIRST,FIRST+cycle.DAY);assert.equal(after.phase,'decay');assert.equal(after.remainingMs,13*cycle.DAY);assert.equal(after.lifeFraction,1);
});
test('cycles repeat without drift over redeploys and many missed cycles',()=>{
  for(const n of [1,2,1000]){const end=cycle.boundary(FIRST,n)+cycle.EVENT,p=cycle.phase(FIRST,end);assert.equal(p.remainingMs,cycle.boundary(FIRST,n+1)-end);assert.equal(p.phase,'decay');assert.equal(p.lifeFraction,1);}
  assert.equal(cycle.format(cycle.DECAY),'13d 00:00:00');assert.equal(cycle.format(cycle.DAY),'1d 00:00:00');assert.equal(cycle.format(1),'00:00:01');assert.equal(cycle.format(0),'00:00:00');
});
test('calendar is stored in backed-up DB exactly once, not reset on reads or restart',()=>{
  const DB={users:{}};let saves=0;const save=()=>{saves++;};
  calendar.snapshot(DB,{now:START,firstEventAt:FIRST,save});
  const restored=JSON.parse(JSON.stringify(DB));
  const next=calendar.snapshot(restored,{now:FIRST,save});assert.equal(next.remainingMs,cycle.EVENT);
  assert.equal(saves,1);assert.equal(restored.worldTreeCalendar.firstEventAt,FIRST);
  assert.equal(calendar.snapshot(DB,{now:START,firstEventAt:FIRST+1000,save}).firstEventAt,FIRST);
});
test('missing schedule is honest; invalid config/save failure cannot initialize progress',()=>{
  const DB={};assert.equal(calendar.snapshot(DB,{now:START}).configured,false);assert.deepEqual(DB,{});
  assert.throws(()=>calendar.snapshot(DB,{now:START,firstEventAt:NaN,save:()=>{}}));
  assert.throws(()=>calendar.snapshot(DB,{now:START,firstEventAt:FIRST,save:()=>{throw new Error('disk offline');}}),/offline/);
  assert.deepEqual(DB,{});
});
test('actual staged server route is GET-only, uncached and calls durable DB initialization',()=>{
  const source=fs.readFileSync(require.resolve('../server.js'),'utf8');
  const route=source.slice(source.indexOf("  if(p==='/api/world-tree/status')"),source.indexOf("  if(p==='/api/world/cities')"));
  const execute=new Function('p','req','res','send','WORLD_TREE_CALENDAR','DB','writeDBNow','process',route);
  const headers={},res={setHeader:(k,v)=>{headers[k]=v;}},send=(res,status,body)=>({status,body}),DB={};let saves=0;
  const process={env:{WORLD_TREE_FIRST_EVENT_AT:new Date(FIRST).toISOString()}};
  assert.equal(execute('/api/world-tree/status',{method:'POST'},res,send,calendar,DB,()=>{saves++;},process).status,405);
  const result=execute('/api/world-tree/status',{method:'GET'},res,send,calendar,DB,()=>{saves++;},process);
  assert.equal(result.status,200);assert.equal(result.body.configured,true);assert.equal(headers['Cache-Control'],'no-store');assert.equal(saves,1);
});
test('every inline client script and both new assets parse',()=>{
  const html=fs.readFileSync(require.resolve('../emberweave-heroes.html'),'utf8');let count=0;
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){if(match[1].trim()){new vm.Script(match[1]);count++;}}
  assert.ok(count>0);
  for(const asset of ['world-tree-cycle.js','world-tree-countdown.js'])new vm.Script(fs.readFileSync(require.resolve('../assets/ui/'+asset),'utf8'));
  assert.ok(html.includes('EmberweaveWorldTreeCountdown.mount(inner)'));
});
