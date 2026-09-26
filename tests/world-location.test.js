'use strict';
const assert=require('node:assert/strict');
const L=require('../server/world-location.js');
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
const tied=L.place([],max=>max-1);
assert.ok(L.REGION_KEYS.includes(tied.region),'a tie picks an eligible region');
console.log('World location balance and grid rules passed');
