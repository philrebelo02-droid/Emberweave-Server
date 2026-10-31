(function(root){
'use strict';
/* v1235 CITY SIEGE - first slice (Phil 31 Oct 2026: "i still cannot left click to attack cities, it should have a Sword ... when i hover
   over a city, oasis, or world tree ... when then i left click it gives me the option to attack"; 30 Oct: "the cities should be
   attackable", attack from within 20 squares, "marching to take it, should march to the center of the city", a win seizes it).
   Shared by the client (window.EmberweaveWorldSiege) and the server (require). Pure: the site table from the realm data, the distance
   rule, the guard lineup size, the holder record shape. Garrisons, capitals and guild rewards are LATER, not in this slice.

   THE DEFAULTS PHIL HAS NOT DECIDED (each one constant, listed in blueprint 04 "CITY SIEGE v1235"):
     RANGE_SQUARES       20   a castle may attack when the NEAREST square of the site is within 20 grid squares (edge, not centre:
                              Durrakh is ~40 squares across, so a centre rule would put most of it out of reach of any castle)
     CELLS_PER_GUARD_LV  150  every site is held by the mine guardians' five-monster lineup (mineGarrison) at guard level
                              clamp(round(site squares / 150), 1, 10): Hollin 2, Ashford 5, Durrakh 10, oases 1, World Tree 1
     PROTECT_MS          1 h  after a seize nobody else can take the site for an hour (a won fight is recorded, the site stays)
     HELD_DEFENDERS      v1237: a held site is defended by its garrison lines; with no line there (none sent, all recalled) by its NPC guards
     OWN_SITE            refused   you cannot ATTACK a site your guild already holds - you send a Defense (garrison) line instead (v1237) */
/* v1237 CITY GARRISON (Phil 31 Oct 2026: "my troop should not return when i capture it, it should remain in the [city]. it should say
   1/8 for non capitals and 1/10 for capitols"; "only guild players can attack a city"; on his own guild's city "the option then have
   to change to Defense, View Garrison"). A won siege stations the attacking line in the site as its first garrison line; the holder's
   guild members send more lines up to the cap; a later siege fights the garrison lines. Only a guild member may attack or garrison.
     GARRISON_CAP   8   lines in a non-capital site (cities, the oases and the World Tree)
     CAPITAL_CAP   10   lines in a capital
     CAPITALS           PHIL NAMED THE CAPITALS (31 Oct 2026: "orriel, hallowrime, lanternmere, durrakh are capitols"):
                        Durrakh 1504, Oriel 1212, Hallowrime 983, Qasrim 849 (Ashford 781 is fifth) */
const RANGE_SQUARES=20, CELLS_PER_GUARD_LV=150, PROTECT_MS=3600000, MAX_GUARD_LV=10;
const GARRISON_CAP=8, CAPITAL_CAP=10, CAPITALS=Object.freeze(['city-oriel','city-hallowrime','city-lanternmere','city-durrakh']);
function realm(){ return root.EmberweaveRealm||(typeof require==='function'?require('../../world-realm.js'):null); }
function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
let _sites=null, _byId=null, _byCell=null;
function build(){
  if(_sites) return;
  const R=realm(), M=R.META, G=R.GEO, out=[];
  const add=(id,kind,name,cells,cx,cy)=>out.push({id,kind,name,cells:cells.map(c=>[c[0],c[1]]),cx,cy,
    x:cx*G.CELL, y:G.Y0+cy*G.CELL, squares:cells.length,
    guardLevel:Math.max(1,Math.min(MAX_GUARD_LV,Math.round(cells.length/CELLS_PER_GUARD_LV)))});
  for(const c of M.cities||[]) add('city-'+slug(c.name),'city',c.name,c.cells,c.cx,c.cy);
  for(const o of M.oases||[]) add(o.id,'oasis',o.name,o.cells,o.cx,o.cy);
  { const K=M.tree.core, cells=[]; for(let y=K[1];y<=K[3];y++) for(let x=K[0];x<=K[2];x++) cells.push([x,y]);
    add('tree','tree','World Tree',cells,(K[0]+K[2]+1)/2,(K[1]+K[3]+1)/2); }
  _sites=Object.freeze(out); _byId=new Map(out.map(s=>[s.id,s])); _byCell=new Map();
  for(const s of out) for(const [x,y] of s.cells) if(!_byCell.has(x+','+y)) _byCell.set(x+','+y,s);
}
function sites(){ build(); return _sites; }
function byId(id){ build(); return _byId.get(String(id))||null; }
function atCell(cx,cy){ build(); return _byCell.get(cx+','+cy)||null; }
// a world-percent point (unsnapped) -> the site under it, or null
function atPoint(x,y){ const G=realm().GEO; if(!Number.isFinite(x)||!Number.isFinite(y)) return null;
  const cx=Math.floor(x/G.CELL), cy=Math.floor((y-G.Y0)/G.CELL); if(cx<0||cy<0||cx>=G.COLS||cy>=G.ROWS) return null; return atCell(cx,cy); }
// grid squares from a castle (world-percent position) to the NEAREST square of the site (cell centre to cell centre, rounded)
function distance(castle,site){ const G=realm().GEO; if(!castle||!site) return Infinity;
  const ax=G.col(castle.x), ay=G.row(castle.y); let best=Infinity;
  for(const [x,y] of site.cells){ const d=Math.hypot(x-ax,y-ay); if(d<best) best=d; }
  return Math.round(best); }
function inRange(castle,site){ return distance(castle,site)<=RANGE_SQUARES; }
// the guard lineup's node for the mine guardians (mineGarrison takes {id, level})
function guardNode(site){ return {id:'siege:'+site.id, level:site.guardLevel}; }
// the holder record kept in DB.worldSieges.sites[siteId] (server) and shown to everyone
function holderOf(state,siteId){ const h=state&&state.sites&&state.sites[siteId]; return h&&typeof h.name==='string'?h:null; }
function ownedBy(h,me){ if(!h||!me) return false; return h.type==='guild'?!!me.guildId&&h.id===me.guildId:h.id===me.id; }   // 'player' = a v1235 holder (before the guild rule)
function isCapital(site){ return !!site&&CAPITALS.includes(site.id); }
function garrisonCap(site){ return isCapital(site)?CAPITAL_CAP:GARRISON_CAP; }
function garrisonCount(h){ return h&&Array.isArray(h.garrison)?h.garrison.length:(h&&Number.isFinite(h.lines)?h.lines|0:0); }
// the map / panel label: "N/8" (non-capital) or "N/10" (capital)
function garrisonLabel(site,h){ return garrisonCount(h)+'/'+garrisonCap(site); }
function guildWord(site){ return site.kind==='city'?'a city':site.kind==='oasis'?'an oasis':'the World Tree'; }
/* the Defense (add a garrison line) rule in one place: why this player may not send a line to this site now (null = may) */
function garrisonRefusal(o){ const {site,holder,me,freeMarch}=o||{};
  if(!site) return 'No such site.';
  if(!me||!me.guildId) return 'Join a guild to garrison '+guildWord(site)+'.';
  if(!holder||!ownedBy(holder,me)) return 'Only the guild holding '+site.name+' can garrison it.';
  const n=garrisonCount(holder), cap=garrisonCap(site);
  if(n>=cap) return 'The garrison of '+site.name+' is full ('+n+'/'+cap+').';
  if(freeMarch===false) return 'All your armies are out.';
  return null; }
/* the panel / route rule in one place: why this castle may not attack this site now (null = it may) */
function refusal(o){ const {site,castle,holder,me,now,freeMarch}=o||{};
  if(!site) return 'No such site.';
  if(!castle) return 'Your castle is not on the World Map yet.';
  if(!me||!me.guildId) return 'Join a guild to attack '+guildWord(site)+'.';   // v1237 (Phil 31 Oct: "only guild players can attack a city")
  const d=distance(castle,site);
  if(d>RANGE_SQUARES) return site.name+' is '+d+' squares away - march from within '+RANGE_SQUARES+' squares.';
  if(holder&&ownedBy(holder,me)) return (holder.type==='guild'?'Your guild':'You')+' already hold'+(holder.type==='guild'?'s ':' ')+site.name+'.';
  if(holder&&Number.isFinite(holder.protectedUntil)&&holder.protectedUntil>now) return site.name+' was just taken - it is protected for '+Math.ceil((holder.protectedUntil-now)/60000)+' more min.';
  if(freeMarch===false) return 'All your armies are out.';
  return null; }
const api={RANGE_SQUARES,CELLS_PER_GUARD_LV,PROTECT_MS,MAX_GUARD_LV,GARRISON_CAP,CAPITAL_CAP,CAPITALS,sites,byId,atCell,atPoint,distance,inRange,guardNode,
  holderOf,ownedBy,refusal,slug,isCapital,garrisonCap,garrisonCount,garrisonLabel,garrisonRefusal};
if(typeof module==='object'&&module.exports) module.exports=api; else root.EmberweaveWorldSiege=api;
})(typeof globalThis==='object'?globalThis:this);
