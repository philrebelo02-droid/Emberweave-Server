'use strict';
// v1226 realm map (Phil 30 Oct 2026): regions are the realm's continents, not 90x90 squares. Balance and grid rules on Grok's realm.
const assert=require('node:assert/strict');
const L=require('../server/world-location.js');
const R=require('../world-realm.js');
const terrain=require('../server/world-terrain-blocked.json');
const at=(region,n)=>{ const c=R.zoneCells(region)[n]; return {region,x:L.center(c[0]),y:L.center(c[1])}; };
const existing=[];
for(const region of ['crystor','draymon','tefron']) for(let n=0;n<100;n++) existing.push(at(region,n));
for(let n=0;n<50;n++) existing.push(at('alumron',n));
let roll=0;
const placed=L.place(existing,max=>roll++%max);
assert.equal(placed.region,'alumron','new player goes to the least populated region');
assert.ok(L.valid(placed));
assert.ok(R.isLand(L.cellIndex(placed.x),L.cellIndex(placed.y)),'a new castle stands on land');
assert.ok(!existing.some(loc=>L.cellIndex(loc.x)===L.cellIndex(placed.x)
  &&L.cellIndex(loc.y)===L.cellIndex(placed.y)),'new castle uses an open square');
const almostEqual=existing.concat(Array.from({length:49},(_,i)=>at('alumron',50+i)));
assert.equal(L.place(almostEqual,max=>max-1).region,'alumron','100/100/100/99 still fills the 99-player region');
for(const region of L.REGION_KEYS) assert.ok(L.valid(at(region,0)));
assert.equal(L.GRID_COLS,220);
assert.equal(L.zoneOf(L.center(110),L.center(110)),'worldtree','the tree stands on the worldtree island');
assert.equal(L.valid({...at('crystor',0),region:'alumron'}),false,'another region\'s land is not yours');
const terrainKeys=new Set(terrain.cells);
assert.equal(terrainKeys.size,terrain.cells.length,'terrain-blocked cells are unique');
assert.equal(terrain.count,terrain.cells.length);
// a sea square next to crystor: relocation finds the nearest open land of crystor itself
let sea=null;
for(const [cx,cy] of R.zoneCells('crystor')){ if(!R.isLand(cx+1,cy)){ sea=[cx+1,cy]; break; } }
assert.ok(sea&&terrainKeys.has(sea.join(',')),'the fixture square is sea and blocked');
const nearest=L.nearestInRegion('crystor',L.center(sea[0]),L.center(sea[1]),terrainKeys);
assert.ok(nearest&&nearest.region==='crystor'&&L.zoneOf(nearest.x,nearest.y)==='crystor');
let best=Infinity;
for(const [cx,cy] of R.zoneCells('crystor')) best=Math.min(best,(cx-sea[0])**2+(cy-sea[1])**2);
assert.equal((L.cellIndex(nearest.x)-sea[0])**2+(L.cellIndex(nearest.y)-sea[1])**2,best,'relocation picks the nearest land of the own region');
const tied=L.place([],max=>max-1);
assert.ok(L.REGION_KEYS.includes(tied.region),'a tie picks an eligible region');
// a transfer's preferred start index wraps on the region's land list
for(const region of L.REGION_KEYS){ const t=L.openInRegion(region,terrainKeys,()=>0,R.zoneCells(region).length>>1); assert.ok(t&&L.valid(t)&&t.region===region); }
// Phil 30 Oct 2026: a city square is never a legal castle square, and relocation off it lands on the own region's open land
for(const c of R.META.cities){ const land=c.cells.find(([x,y])=>L.REGION_KEYS.includes(R.landZone(x,y))); if(!land) continue; const home=R.landZone(land[0],land[1]);
  assert.ok(terrainKeys.has(land.join(',')),c.name+' is blocked'); for(const h of L.REGION_KEYS) assert.equal(L.targetAllowed(h,L.center(land[0]),L.center(land[1])),false,'no castle on '+c.name);
  const off=L.nearestInRegion(home,L.center(land[0]),L.center(land[1]),terrainKeys); assert.ok(off&&off.region===home&&!R.isCity(L.cellIndex(off.x),L.cellIndex(off.y))&&R.landZone(L.cellIndex(off.x),L.cellIndex(off.y))===home,c.name+' relocation'); }
console.log('World location balance and grid rules passed (realm '+R.META.version+')');
