'use strict';
// v1226 realm map (Phil 30 Oct 2026): regions are the realm's continents, not 90x90 squares. Balance and grid rules on Grok's realm.
// v1227: the grid is META.cols x META.rows (800 x 477 since v1229); a castle is one cell (Phil 30 Oct 2026: "in 1 square") at its centre.
const assert=require('node:assert/strict');
const L=require('../server/world-location.js');
const R=require('../world-realm.js');
const terrain=require('../server/world-terrain-blocked.json');
const terrainKeys=new Set(terrain.cells);
// the n-th castle square of a region that is wholly the region's open land
const squares=region=>R.zoneCells(region).filter(([cx,cy])=>L.regionSquare(region,cx,cy,new Set()));
const at=(region,n)=>{ const c=squares(region)[n*3]; return {region,x:L.cornerX(c[0]),y:L.cornerY(c[1])}; };
const existing=[];
for(const region of ['crystor','draymon','tefron']) for(let n=0;n<100;n++) existing.push(at(region,n));
for(let n=0;n<50;n++) existing.push(at('alumron',n));
let roll=0;
const placed=L.place(existing,max=>roll++%max);
assert.equal(placed.region,'alumron','new player goes to the least populated region');
assert.ok(L.valid(placed));
assert.ok(L.footprint(placed.x,placed.y).every(([x,y])=>R.isLand(x,y)),'a new castle stands on land, every cell of it');
const taken=new Set(existing.flatMap(loc=>L.footKeys(loc.x,loc.y)));
assert.ok(!L.footKeys(placed.x,placed.y).some(k=>taken.has(k)),'new castle square overlaps no other castle');
const almostEqual=existing.concat(Array.from({length:49},(_,i)=>at('alumron',50+i)));
assert.equal(L.place(almostEqual,max=>max-1).region,'alumron','100/100/100/99 still fills the 99-player region');
for(const region of L.REGION_KEYS) assert.ok(L.valid(at(region,0)));
// THE GRID: one pair of numbers, from the realm build, everywhere
assert.equal(L.GRID_COLS,R.META.cols);assert.equal(L.GRID_ROWS,R.META.rows);
assert.equal(L.GRID_COLS,800);assert.equal(L.GRID_ROWS,477);
assert.equal(L.FOOT,1,'a castle fits one square');
assert.equal(L.zoneOf(50,50),'worldtree','the tree stands on the worldtree island');
assert.ok(L.treeCore(50,50),'the world centre is the tree core');
assert.equal(L.valid({...at('crystor',0),region:'alumron'}),false,'another region\'s land is not yours');
assert.equal(terrainKeys.size,terrain.cells.length,'terrain-blocked cells are unique');
assert.equal(terrain.count,terrain.cells.length);
// an old castle (on a 220-grid square centre) keeps its exact stored position; its square is the one cell that holds it
const old={region:'crystor',x:(55+0.5)*100/220,y:(79+0.5)*100/220};
assert.deepEqual(L.footprint(old.x,old.y),[[L.col(old.x),L.row(old.y)]]);
// two castles side by side on the 220 grid are in different cells
for(let i=0;i<219;i++) assert.notEqual(L.castleKey((i+0.5)*100/220,50.3),L.castleKey((i+1.5)*100/220,50.3),'220-grid neighbours '+i);
// marches still count 220-grid squares
assert.equal(L.marchSquares({x:(10+0.5)*100/220,y:(10+0.5)*100/220},{x:(13+0.5)*100/220,y:(14+0.5)*100/220}),5);
// a sea square next to crystor: relocation finds the nearest open land of crystor itself
let sea=null;
for(const [cx,cy] of R.zoneCells('crystor')){ if(!R.isLand(cx+1,cy)){ sea=[cx+1,cy]; break; } }
assert.ok(sea&&terrainKeys.has(sea.join(',')),'the fixture square is sea and blocked');
const nearest=L.nearestInRegion('crystor',L.cornerX(sea[0]),L.cornerY(sea[1]),terrainKeys);
assert.ok(nearest&&nearest.region==='crystor'&&L.zoneOf(nearest.x,nearest.y)==='crystor'&&L.valid(nearest));
let best=Infinity;
for(const [cx,cy] of R.zoneCells('crystor')) if(L.regionSquare('crystor',cx,cy,terrainKeys)) best=Math.min(best,(cx-sea[0])**2+(cy-sea[1])**2);
assert.equal((L.anchorX(nearest.x)-sea[0])**2+(L.anchorY(nearest.y)-sea[1])**2,best,'relocation picks the nearest castle square of the own region');
const tied=L.place([],max=>max-1);
assert.ok(L.REGION_KEYS.includes(tied.region),'a tie picks an eligible region');
// a transfer's preferred start index wraps on the region's land list
for(const region of L.REGION_KEYS){ const t=L.openInRegion(region,terrainKeys,()=>0,R.zoneCells(region).length>>1); assert.ok(t&&L.valid(t)&&t.region===region); }
// Phil 30 Oct 2026: a city square is never a legal castle square, and relocation off it lands on the own region's open land
for(const c of R.META.cities){ const land=c.cells.find(([x,y])=>L.REGION_KEYS.includes(R.landZone(x,y))); if(!land) continue; const home=R.landZone(land[0],land[1]);
  assert.ok(terrainKeys.has(land.join(',')),c.name+' is blocked'); for(const h of L.REGION_KEYS) assert.equal(L.targetAllowed(h,L.cornerX(land[0]),L.cornerY(land[1])),false,'no castle on '+c.name);
  const off=L.nearestInRegion(home,L.cornerX(land[0]),L.cornerY(land[1]),terrainKeys); assert.ok(off&&off.region===home&&!L.isCity(off.x,off.y)&&L.valid(off),c.name+' relocation'); }
console.log('World location balance and grid rules passed (realm '+R.META.version+', '+L.GRID_COLS+' x '+L.GRID_ROWS+')');
