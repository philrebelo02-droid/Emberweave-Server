'use strict';
const VOID_TIMING=require('./world-void-timing.js');
// Map coordinates use the authoritative 0..100 percentage space, not cells.
function point(value){
  if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)
    ||value.x<0||value.x>=100||value.y<0||value.y>=100)return null;
  return {x:value.x,y:value.y};
}
function capture(from,to,targetName,travelMs,gatherMs=0,pacing){
  const origin=point(from),destination=point(to);
  if(!origin||!destination||!Number.isFinite(travelMs)||travelMs<0
    ||!Number.isFinite(gatherMs)||gatherMs<0)return null;
  if(pacing!==undefined&&!VOID_TIMING.matches(origin,destination,travelMs,pacing))return null;
  const result={version:1,coordinateSpace:'world-percent',from:origin,to:destination,
    targetName:typeof targetName==='string'?targetName.slice(0,120):null,travelMs,gatherMs};
  if(pacing!==undefined)result.pacing={...pacing};
  return result;
}
/* 12 Nov (Grok, test_city_garrison_1237): a v1237 garrison line (kind 'garrison', or a won siege that stayed: station) waits in its site
   until recalled - its homeAt is ~100 years out, not arriveAt + travel. project() refused it, so /api/world/marches sent route:null and
   the map never drew the stationed line (the client's own check already allows it: stationed => homeAt >= arriveAt). */
function stationedGarrison(m){ return !m.recall&&(m.kind==='garrison'||(m.kind==='siege'&&typeof m.station==='string')); }
function project(march){
  const raw=march?.route;
  if(raw?.version!==1||raw.coordinateSpace!=='world-percent')return null;
  const route=capture(raw.from,raw.to,raw.targetName,raw.travelMs,raw.gatherMs,raw.pacing);
  if(!route||![march.depart,march.arriveAt,march.homeAt].every(Number.isFinite)
    ||march.arriveAt!==march.depart+route.travelMs+route.gatherMs
    ||(march.homeAt!==march.arriveAt+route.travelMs&&!(stationedGarrison(march)&&march.homeAt>march.arriveAt)))return null;
  return route;
}
module.exports={capture,project};
