'use strict';
// Map coordinates use the authoritative 0..100 percentage space, not cells.
function point(value){
  if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)
    ||value.x<0||value.x>=100||value.y<0||value.y>=100)return null;
  return {x:value.x,y:value.y};
}
function capture(from,to,targetName,travelMs,gatherMs=0){
  const origin=point(from),destination=point(to);
  if(!origin||!destination||!Number.isFinite(travelMs)||travelMs<0
    ||!Number.isFinite(gatherMs)||gatherMs<0)return null;
  return {version:1,coordinateSpace:'world-percent',from:origin,to:destination,
    targetName:typeof targetName==='string'?targetName.slice(0,120):null,travelMs,gatherMs};
}
function project(march){
  const raw=march?.route;
  if(raw?.version!==1||raw.coordinateSpace!=='world-percent')return null;
  const route=capture(raw.from,raw.to,raw.targetName,raw.travelMs,raw.gatherMs);
  if(!route||![march.depart,march.arriveAt,march.homeAt].every(Number.isFinite)
    ||march.arriveAt!==march.depart+route.travelMs+route.gatherMs
    ||march.homeAt!==march.arriveAt+route.travelMs)return null;
  return route;
}
module.exports={capture,project};
