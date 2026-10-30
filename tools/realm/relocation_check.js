// Castle relocation check for a realm swap: reads a world (a backup JSON or a live world through world-store) and reports what the
// boot migration (server.js migrateBlockedWorldCastles) will do on the new realm, with the same rules. Counts only - no names.
//   node tools/realm/relocation_check.js <world json | manifest> [...more]
// v1227 rule: an existing castle stays unless its own square (one cell) is sea or a city, or another castle already holds that square;
// one that moves goes to the nearest open square of its own region (mines hold the 4 cells around their intersection).
'use strict';
const path=require('path'),fs=require('fs');
const L=require('../../server/world-location.js'),M=require('../../server/world-mines.js');
const BLOCKED=new Set(require('../../server/world-terrain-blocked.json').cells);
function read(f){ try{ return require('../../server/world-store.js').readWorld(f); }catch(e){ return JSON.parse(fs.readFileSync(f,'utf8')); } }
for(const f of process.argv.slice(2)){
  const db=read(f), users=Object.values(db.users||{}), now=Date.now();
  const mineCells=M.field(M.epochAt(now)).flatMap(n=>L.GEO.mineKeys(n.x,n.y));
  const withLoc=users.filter(u=>u&&!u.isNpc&&u.worldLocation&&L.REGIONS[u.worldLocation.region]&&Number.isFinite(u.worldLocation.x));
  const out={file:path.basename(f),grid:L.GRID_COLS+'x'+L.GRID_ROWS,users:users.length,castles:withLoc.length,
    staying:0,moved:0,sea:0,city:0,otherRegion:0,shared:0,noRoom:0,byRegion:{},maxMoveSquares:0,maxMove220Squares:0};
  const held=new Set();
  for(const u of withLoc){
    const loc=u.worldLocation;
    if(L.valid(loc)&&!L.footBlocked(BLOCKED,loc.x,loc.y)&&!L.footBlocked(held,loc.x,loc.y)){ for(const k of L.footKeys(loc.x,loc.y)) held.add(k); out.staying++; continue; }
    if(!L.isLand(loc.x,loc.y)) out.sea++; else if(L.isCity(loc.x,loc.y)) out.city++; else if(L.valid(loc)) out.shared++; else out.otherRegion++;
    const blocked=new Set([...mineCells,...held]);
    const next=L.nearestInRegion(loc.region,loc.x,loc.y,blocked);
    if(!next){out.noRoom++;continue;}
    for(const k of L.footKeys(next.x,next.y)) held.add(k); out.moved++;
    out.byRegion[loc.region]=(out.byRegion[loc.region]||0)+1;
    out.maxMoveSquares=Math.max(out.maxMoveSquares,Math.round(Math.hypot(L.col(next.x)-L.col(loc.x),L.row(next.y)-L.row(loc.y))));
    out.maxMove220Squares=Math.max(out.maxMove220Squares,L.marchSquares(loc,next));
  }
  console.log(JSON.stringify(out));
}
