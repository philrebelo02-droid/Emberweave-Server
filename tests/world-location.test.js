'use strict';
const assert=require('node:assert/strict');
const L=require('../server/world-location.js');
const terrain=require('../server/world-terrain-blocked.json');
const at=(region,n)=>{
  const z=L.REGIONS[region],cx=L.regionStart(z.col)+n%L.REGION_CELLS;
  const cy=L.regionStart(z.row)+Math.floor(n/L.REGION_CELLS);
  return {region,x:L.center(cx),y:L.center(cy)};
};
const existing=[];
for(const region of ['crystor','draymon','tefron']) for(let n=0;n<100;n++) existing.push(at(region,n));
for(let n=0;n<50;n++) existing.push(at('alumron',n));
let roll=0;
const placed=L.place(existing,max=>roll++%max);
assert.equal(placed.region,'alumron','new player goes to the least populated region');
assert.ok(L.valid(placed));
assert.ok(!existing.some(loc=>L.cellIndex(loc.x)===L.cellIndex(placed.x)
  &&L.cellIndex(loc.y)===L.cellIndex(placed.y)),'new castle uses an open square');
const almostEqual=existing.concat(Array.from({length:49},(_,i)=>at('alumron',50+i)));
assert.equal(L.place(almostEqual,max=>max-1).region,'alumron',
  '100/100/100/99 still fills the 99-player region');
for(const region of L.REGION_KEYS) assert.ok(L.valid(at(region,0)));
assert.deepEqual([L.GRID_COLS,L.REGION_CELLS,L.WILD_CELLS],[220,90,40]);
assert.deepEqual([89,90,129,130].map(cx=>L.zoneOf(L.center(cx),L.center(45))),
  ['crystor','wildN','wildN','draymon'],'horizontal region/wild edges');
assert.deepEqual([89,90,129,130].map(cy=>L.zoneOf(L.center(45),L.center(cy))),
  ['crystor','wildW','wildW','tefron'],'vertical region/wild edges');
assert.equal(L.zoneOf(L.center(110),L.center(110)),'worldtree','center void is 40×40');
assert.equal(L.valid({...at('crystor',0),region:'alumron'}),false);
assert.equal(terrain.cells.length,1039,'approved crystal and World Tree outline is complete');
const terrainKeys=new Set(terrain.cells);
assert.equal(terrainKeys.size,terrain.cells.length,'terrain-blocked cells are unique');
assert.ok(terrainKeys.has('110,110')&&terrainKeys.has('115,110')&&terrainKeys.has('105,110'),
  'World Tree centre and symmetrical protected ring are blocked');
const from={x:L.center(85),y:L.center(98)};
assert.ok(terrainKeys.has(L.cellKey(from.x,from.y)),'crystal footprint contains the fixture square');
const nearest=L.nearestOpen('crystor',from.x,from.y,terrainKeys);
assert.ok(nearest&&L.targetAllowed('crystor',nearest.x,nearest.y));
assert.ok(!terrainKeys.has(L.cellKey(nearest.x,nearest.y)),
  'migration picks an open square without leaving the home or wild zones');
let best=Infinity;
for(let cy=0;cy<L.GRID_COLS;cy++) for(let cx=0;cx<L.GRID_COLS;cx++){
  const x=L.center(cx),y=L.center(cy);
  if(terrainKeys.has(cx+','+cy)||!L.targetAllowed('crystor',x,y)) continue;
  best=Math.min(best,(cx-85)**2+(cy-98)**2);
}
assert.equal((L.cellIndex(nearest.x)-85)**2+(L.cellIndex(nearest.y)-98)**2,best,
  'boot migration chooses the nearest permissible square');
const tied=L.place([],max=>max-1);
assert.ok(L.REGION_KEYS.includes(tied.region),'a tie picks an eligible region');
console.log('World location balance and grid rules passed');
