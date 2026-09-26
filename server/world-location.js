'use strict';

// Four 90x90 home regions surround 40-cell wild corridors and a 40x40 void.
// Initial placement is server-owned and never derived from the browser's save.
const crypto=require('node:crypto');
const GRID_COLS=220, REGION_CELLS=90, WILD_CELLS=40, CELL=100/GRID_COLS;
const ZONE_EDGES=Object.freeze([0,REGION_CELLS,REGION_CELLS+WILD_CELLS,GRID_COLS]);
const REGIONS=Object.freeze({
  crystor:{col:0,row:0},draymon:{col:2,row:0},
  tefron:{col:0,row:2},alumron:{col:2,row:2}
});
const REGION_KEYS=Object.freeze(Object.keys(REGIONS));
const ZONE_BY_CELL=Object.freeze([
  ['crystor','wildN','draymon'],
  ['wildW','worldtree','wildE'],
  ['tefron','wildS','alumron']
]);
function cellIndex(v){ return Math.max(0,Math.min(GRID_COLS-1,Math.round(v/CELL-0.5))); }
function center(i){ return (i+0.5)*CELL; }
function zoneIndex(i){ return i<ZONE_EDGES[1]?0:i<ZONE_EDGES[2]?1:2; }
function regionStart(index){ return index===0?0:ZONE_EDGES[2]; }
function zoneOf(x,y){ return ZONE_BY_CELL[zoneIndex(cellIndex(y))][zoneIndex(cellIndex(x))]; }
function cellKey(x,y){ return cellIndex(x)+','+cellIndex(y); }
function treeCore(x,y){
  const cx=cellIndex(x),cy=cellIndex(y),middle=GRID_COLS/2;
  return cx>=middle-2&&cx<=middle+1&&cy>=middle-2&&cy<=middle+1;
}
function targetAllowed(home,x,y){
  return !!REGIONS[home]&&Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=100&&y>=0&&y<=100
    &&!treeCore(x,y)&&(!REGIONS[zoneOf(x,y)]||zoneOf(x,y)===home);
}
function openInRegion(region,blocked=[],randomInt=crypto.randomInt,preferred){
  const z=REGIONS[region]; if(!z) return null;
  const occupied=new Set(blocked);
  const start=preferred==null?randomInt(REGION_CELLS*REGION_CELLS):preferred;
  for(let i=0;i<REGION_CELLS*REGION_CELLS;i++){
    const n=(start+i)%(REGION_CELLS*REGION_CELLS);
    const cx=regionStart(z.col)+n%REGION_CELLS;
    const cy=regionStart(z.row)+Math.floor(n/REGION_CELLS);
    if(!occupied.has(cx+','+cy)) return {region,x:center(cx),y:center(cy)};
  }
  return null;
}
function valid(loc){
  if(!loc||!REGIONS[loc.region]||!Number.isFinite(loc.x)||!Number.isFinite(loc.y)) return false;
  return targetAllowed(loc.region,loc.x,loc.y);
}
function place(existing,randomInt=crypto.randomInt,blocked=[]){
  const locations=(existing||[]).filter(valid);
  const occupied=new Set(locations.map(loc=>cellIndex(loc.x)+','+cellIndex(loc.y)));
  for(const key of blocked) occupied.add(key);
  const counts=Object.fromEntries(REGION_KEYS.map(k=>[k,0]));
  for(const loc of locations) counts[loc.region]++;
  // Fill the least populated home region first. Equal counts use a random tie break.
  const order=REGION_KEYS.map(region=>({region,count:counts[region],tie:randomInt(0x7fffffff)}))
    .sort((a,b)=>a.count-b.count||a.tie-b.tie);
  for(const {region} of order){
    const z=REGIONS[region];
    const start=randomInt(REGION_CELLS*REGION_CELLS);
    for(let i=0;i<REGION_CELLS*REGION_CELLS;i++){
      const n=(start+i)%(REGION_CELLS*REGION_CELLS);
      const cx=regionStart(z.col)+n%REGION_CELLS;
      const cy=regionStart(z.row)+Math.floor(n/REGION_CELLS);
      if(!occupied.has(cx+','+cy)) return {region,x:center(cx),y:center(cy)};
    }
  }
  throw Error('No free castle square remains in the home regions.');
}
module.exports={GRID_COLS,REGION_CELLS,WILD_CELLS,ZONE_EDGES,CELL,REGIONS,REGION_KEYS,cellIndex,center,zoneIndex,regionStart,zoneOf,cellKey,
  treeCore,targetAllowed,openInRegion,valid,place};
