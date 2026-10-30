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
// v1228 (30 Oct 2026, the flash fix): the tree is hidden until a stage loads, wt_28 after 4 s if none ever arrives - and a map redraw
// (every remount) must neither restart that wait nor hide the tree again, nor put wt_28 up while another stage is current
function fakeMap(){const listeners={};const target={style:{},dataset:{},isConnected:true,_src:'',set src(v){this._src=v;},get src(){return this._src;}};
  return {target,inner:{querySelector:s=>s==='#worldTreeTerrain'?target:null,addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f);},
    removeEventListener:(t,f)=>{listeners[t]=(listeners[t]||[]).filter(x=>x!==f);},fire:(t,detail)=>(listeners[t]||[]).forEach(f=>f({detail}))}};}
function withClock(fn){const realNow=Date.now,realST=globalThis.setTimeout,realCT=globalThis.clearTimeout,realImage=globalThis.Image;let now=1e12,timers=[],id=0;
  Date.now=()=>now;globalThis.setTimeout=(f,ms)=>{timers.push({id:++id,at:now+ms,f});return id;};globalThis.clearTimeout=x=>{timers=timers.filter(t=>t.id!==x);};
  globalThis.Image=function(){const im={};Object.defineProperty(im,'src',{set(v){im._s=v;Promise.resolve().then(()=>im.onload&&im.onload());},get(){return im._s;}});return im;};
  const advance=ms=>{now+=ms;for(const t of timers.filter(t=>t.at<=now)){timers=timers.filter(x=>x!==t);t.f();}};
  return Promise.resolve(fn(advance)).finally(()=>{Date.now=realNow;globalThis.setTimeout=realST;globalThis.clearTimeout=realCT;globalThis.Image=realImage;});}
test('no calendar: wt_28 after 4 s, and redraws never restart the wait or hide the tree again',()=>withClock(async advance=>{
 art._reset();let m=fakeMap();art.mount(m.inner);assert.equal(m.target.style.visibility,'hidden','hidden until a stage or the fallback');
 for(let k=0;k<6;k++){advance(700);m=fakeMap();art.mount(m.inner);}   // a redraw every 0.7 s
 advance(100);assert.match(m.target.src,/wt_28\.webp/,'the fallback still comes 4 s after the FIRST mount');assert.equal(m.target.style.visibility,'');
 for(let k=0;k<5;k++){m=fakeMap();art.mount(m.inner);assert.match(m.target.src,/wt_28\.webp/,'a redraw shows the tree at once');assert.equal(m.target.style.visibility,'','never hidden again');}
}));
test('with a stage: the stage frame shows, redraws keep it, wt_28 never replaces it',()=>withClock(async advance=>{
 art._reset();let m=fakeMap();art.mount(m.inner);m.inner.fire('world-tree-phase',{framePosition:16});await Promise.resolve();await Promise.resolve();
 assert.match(m.target.src,/wt_17\.webp/);assert.equal(m.target.style.visibility,'');
 for(let k=0;k<5;k++){advance(5000);m=fakeMap();art.mount(m.inner);assert.match(m.target.src,/wt_17\.webp/,'redraw '+k+' keeps the current stage');assert.equal(m.target.style.visibility,'');}
 advance(10000);assert.match(m.target.src,/wt_17\.webp/,'no late fallback over a real stage');
 // the fallback came first (no stage for 4 s), then a real stage replaces it
 art._reset();m=fakeMap();art.mount(m.inner);advance(4100);assert.match(m.target.src,/wt_28\.webp/);
 m.inner.fire('world-tree-phase',{framePosition:4});await Promise.resolve();await Promise.resolve();assert.match(m.target.src,/wt_05\.webp/,'a stage replaces the fallback');
 m=fakeMap();art.mount(m.inner);assert.match(m.target.src,/wt_05\.webp/,'and redraws keep that stage');
}));
