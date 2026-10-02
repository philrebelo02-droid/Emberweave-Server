'use strict';
// CR2050 (ChatGPT, 1 Oct 2026): a recalled city march turns at its frozen route point and returns to its original origin; v926 put this in the suite.
const assert=require('node:assert/strict'),R=require('../server/world-march-route.js'),V=require('../server/world-void-timing.js'),C=require('../server/world-city-recall.js'),visual=require('../assets/ui/world-march-visual.js');
for(let i=0;i<1000;i++){
 const from={x:(i*17%99)+.1,y:(i*29%99)+.1},to={x:(i*43%99)+.2,y:(i*61%99)+.2},timing=V.plan(from,to,1000000),route=R.capture(from,to,'Target',timing.travelMs,0,timing.pacing),march={id:'m',kind:'city',depart:1000,arriveAt:1000+route.travelMs,homeAt:1000+2*route.travelMs,route,resolved:false};
 const now=1000+Math.floor(route.travelMs*(i%99+1)/100),before=visual.views([{...march,resultPending:true}],now)[0],p=C.plan(march,now);assert.equal(p.ok,true);assert(Math.abs(p.recall.turnPoint.x-before.x)<1e-8);assert(Math.abs(p.recall.turnPoint.y-before.y)<1e-8);assert(Math.abs(p.route.travelMs-(now-march.depart))<=1,'Prefix duration rounding bounded to one millisecond');
 const recalled={...march,depart:p.depart,arriveAt:p.arriveAt,homeAt:p.homeAt,route:p.route,resolved:true,resultPending:false};assert(R.project(recalled));const at=visual.views([recalled],now)[0];assert.equal(at.phase,'returning');assert(Math.abs(at.x-p.recall.turnPoint.x)<1e-8);assert(Math.abs(at.y-p.recall.turnPoint.y)<1e-8);const close=visual.views([recalled],p.homeAt-1)[0];assert(Math.hypot(close.x-from.x,close.y-from.y)<.001);
 assert.equal(C.plan({...march,resolved:true},now).ok,false);assert.equal(C.plan(march,march.arriveAt).ok,false);assert.equal(C.plan({...march,route:null},now).ok,false);
}
console.log('PASS 1000 frozen prefix turn/return Void2x pacing routes, <=1ms timing quantization, matching current renderer, after-arrival/resolved/legacy-corrupt fail-closed');
