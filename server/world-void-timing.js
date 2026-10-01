'use strict';
// Immutable rule: cells90..129 occupy [90/220,130/220) of world-percent space.
const LOW=90*100/220,HIGH=130*100/220;
function valid(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<100&&p.y>=0&&p.y<100;}
function plan(from,to,normalTravelMs){
 if(!valid(from)||!valid(to)||!Number.isSafeInteger(normalTravelMs)||normalTravelMs<0)throw Error('Invalid Void route');
 let enter=0,exit=1,hit=true;
 for(const axis of ['x','y']){
  const delta=to[axis]-from[axis];
  if(delta===0){if(from[axis]<LOW||from[axis]>=HIGH)hit=false;continue;}
  const a=(LOW-from[axis])/delta,b=(HIGH-from[axis])/delta;
  enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
 }
 if(!hit||exit<=enter){enter=0;exit=0;}
 const insideFraction=exit-enter,travelMs=Math.round(normalTravelMs*(1+insideFraction));
 if(!Number.isSafeInteger(travelMs))throw Error('Unsafe Void duration');
 return {travelMs,pacing:{version:1,rule:'void-half-speed',normalTravelMs,entryFraction:enter,exitFraction:exit,insideFraction}};
}
function matches(from,to,travelMs,pacing){
 try{const expected=plan(from,to,pacing.normalTravelMs);return expected.travelMs===travelMs&&Object.keys(expected.pacing).every(k=>pacing[k]===expected.pacing[k])&&Object.keys(pacing).length===Object.keys(expected.pacing).length;}catch(_){return false;}
}
module.exports={plan,matches,LOW,HIGH};
