'use strict';

// Server-owned deterministic eight-hour field; pre-cutover fields retain exact legacy RNG/IDs.
const EPOCH_MS=8*3600000, COUNT=240, GRID_COLS=220, GRID_CELL=100/GRID_COLS;
const TERRAIN_CUTOVER_EPOCH=62184;
const TERRAIN_BLOCKED=new Set(require('./world-terrain-blocked.json').cells);
const VOID_CRATER_R=29;   // cells from the Tree centre: no resource node inside the crater (from the 20:00 ET 1 Oct field)
const EDGES=[0,90,130,GRID_COLS];
const RESOURCES=['iron','crystal','silver','coal'];
const ZONES=[
  [{key:'crystor',type:'region',col:0,row:0},{key:'wildN',type:'wild',col:1,row:0},{key:'draymon',type:'region',col:2,row:0}],
  [{key:'wildW',type:'wild',col:0,row:1},{key:'worldtree',type:'worldtree',col:1,row:1},{key:'wildE',type:'wild',col:2,row:1}],
  [{key:'tefron',type:'region',col:0,row:2},{key:'wildS',type:'wild',col:1,row:2},{key:'alumron',type:'region',col:2,row:2}]
];
function epochAt(now){ return Math.floor(now/EPOCH_MS); }
function mineRand(seed){ let s=(seed>>>0)||1; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
function field(epoch){
  const out=[],occupied=new Set(),rnd=mineRand((epoch*2654435761)>>>0); let guard=0;
  while(out.length<COUNT && guard++<COUNT*12){
    const gx=2+Math.floor(rnd()*(GRID_COLS-3)), gy=2+Math.floor(rnd()*(GRID_COLS-3));
    const x=gx*GRID_CELL, y=gy*GRID_CELL;
    const col=gx<EDGES[1]?0:gx<EDGES[2]?1:2;
    const row=gy<EDGES[1]?0:gy<EDGES[2]?1:2;
    const z=ZONES[row][col];
    if(z.type==='worldtree') continue;
    const square=gx+','+gy;
    if(epoch>=TERRAIN_CUTOVER_EPOCH&&TERRAIN_BLOCKED.has(square)) continue;
    /* v914 (Phil 1 Oct: "There should be no nodes at all spawning in the void zone"): the visible crater - Phil's crystal ring reaches 26.9 cells
       from the Tree centre (110,110) - plus a 2-cell margin. The 40x40 worldtree square alone left 2-5 nodes per field inside it. */
    if(epoch>=TERRAIN_CUTOVER_EPOCH&&Math.hypot(gx+0.5-110,gy+0.5-110)<VOID_CRATER_R) continue;
    if(occupied.has(square)) continue;
    occupied.add(square);
    const fx=(gx-EDGES[col])/(EDGES[col+1]-EDGES[col]);
    const fy=(gy-EDGES[row])/(EDGES[row+1]-EDGES[row]);
    let level;
    /* Phil 3 Oct 2026: "Resources outside in region should be level 1-6 the level 6 near the end of the region 7-10 in wild". Same rnd() draws as
       before, so every node keeps its place and id; only the level changes. Fields before the terrain cutover keep their legacy levels. */
    const ten=epoch>=TERRAIN_CUTOVER_EPOCH;
    if(z.type==='region'){
      const edge=Math.min(fx,1-fx,fy,1-fy);
      if(edge<0.16) level=ten?6:4;
      else { const r=rnd(); level=ten?(r<0.30?1:r<0.55?2:r<0.75?3:r<0.90?4:5):(r<0.45?1:r<0.78?2:3); }
    } else {
      const regEdge=(z.row===0||z.row===2)?Math.min(fx,1-fx):Math.min(fy,1-fy);
      if(regEdge<0.20) level=ten?7:5;
      else { const r=rnd(); level=ten?(r<0.4?8:r<0.75?9:10):(r<0.4?6:r<0.75?7:8); }
    }
    const res=RESOURCES[Math.floor(rnd()*RESOURCES.length)];
    out.push({id:'mn'+epoch+'_'+out.length,res,level,gx,gy,x,y,region:z.key});
  }
  return out;
}
function nodeById(id,now){
  const ep=epochAt(now), prefix='mn'+ep+'_';
  if(typeof id!=='string'||!id.startsWith(prefix)) return null;
  const index=Number(id.slice(prefix.length));
  if(!Number.isInteger(index)||index<0||index>=COUNT||id!==prefix+index) return null;
  return field(ep)[index]||null;
}
module.exports={EPOCH_MS,COUNT,GRID_COLS,GRID_CELL,RESOURCES,epochAt,mineRand,field,nodeById};
