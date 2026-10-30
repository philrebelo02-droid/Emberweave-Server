// Castle relocation check for a realm swap: reads a world (a backup JSON or a live world through world-store) and reports what the
// boot migration (server.js migrateBlockedWorldCastles) will do on the new realm, with the same rules. Counts only - no names.
//   node tools/realm/relocation_check.js <world json | manifest> [...more]
'use strict';
const path=require('path'),fs=require('fs');
const L=require('../../server/world-location.js'),M=require('../../server/world-mines.js'),R=require('../../world-realm.js');
const BLOCKED=new Set(require('../../server/world-terrain-blocked.json').cells);
function read(f){ try{ return require('../../server/world-store.js').readWorld(f); }catch(e){ return JSON.parse(fs.readFileSync(f,'utf8')); } }
for(const f of process.argv.slice(2)){
  const db=read(f), users=Object.values(db.users||{}), now=Date.now();
  const mines=new Set(M.field(M.epochAt(now)).map(n=>n.gx+','+n.gy));
  const withLoc=users.filter(u=>u&&!u.isNpc&&u.worldLocation&&L.REGIONS[u.worldLocation.region]&&Number.isFinite(u.worldLocation.x));
  const out={file:path.basename(f),server:db.serverId||db.meta?.serverId||null,users:users.length,castles:withLoc.length,
    staying:0,moved:0,sea:0,otherRegion:0,noRoom:0,byRegion:{},maxMoveSquares:0};
  const taken=new Set(withLoc.map(u=>L.cellKey(u.worldLocation.x,u.worldLocation.y)));
  for(const u of withLoc){
    const loc=u.worldLocation,key=L.cellKey(loc.x,loc.y);
    if(L.valid(loc)&&!BLOCKED.has(key)){out.staying++;continue;}
    if(!R.isLand(L.cellIndex(loc.x),L.cellIndex(loc.y))) out.sea++; else out.otherRegion++;
    const blocked=new Set([...BLOCKED,...mines,...[...taken].filter(k=>k!==key)]);
    const next=L.nearestInRegion(loc.region,loc.x,loc.y,blocked);
    if(!next){out.noRoom++;continue;}
    taken.delete(key);taken.add(L.cellKey(next.x,next.y));out.moved++;
    out.byRegion[loc.region]=(out.byRegion[loc.region]||0)+1;
    out.maxMoveSquares=Math.max(out.maxMoveSquares,Math.round(Math.hypot(L.cellIndex(next.x)-L.cellIndex(loc.x),L.cellIndex(next.y)-L.cellIndex(loc.y))));
  }
  console.log(JSON.stringify(out));
}
