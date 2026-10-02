'use strict';
const ROUTE=require('./world-march-route.js'),VOID=require('./world-void-timing.js');
function plan(march,now){
 if(!Number.isSafeInteger(now)||!march||march.resolved||now<march.depart||now>=march.arriveAt)return {ok:false,error:'Only an outbound city march can be recalled.'};
 const original=ROUTE.project(march);if(!original||original.gatherMs!==0)return {ok:false,error:'This march has no valid frozen recall route.'};
 const elapsed=now-march.depart,p=original.travelMs?elapsed/original.travelMs:0,s=original.pacing;
 let f=p;if(s){const u=p*(1+s.insideFraction);f=u<s.entryFraction?u:u<=s.entryFraction+2*s.insideFraction?s.entryFraction+(u-s.entryFraction)/2:u-s.insideFraction;}
 f=Math.max(0,Math.min(1,f));const turn={x:original.from.x+(original.to.x-original.from.x)*f,y:original.from.y+(original.to.y-original.from.y)*f};
 const timing=s?VOID.plan(original.from,turn,Math.round(s.normalTravelMs*f)):null,travel=timing?timing.travelMs:elapsed;
 const route=ROUTE.capture(original.from,turn,original.targetName,travel,0,timing?.pacing);if(!route)return {ok:false,error:'Recall route could not be validated.'};
 return {ok:true,route,depart:now-travel,arriveAt:now,homeAt:now+travel,
  recall:{at:now,originalDepart:march.depart,originalArriveAt:march.arriveAt,originalHomeAt:march.homeAt,originalRoute:original,turnPoint:turn,returnMs:travel}};
}
module.exports={plan};
