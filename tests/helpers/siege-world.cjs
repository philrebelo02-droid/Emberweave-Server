'use strict';
/* Siege worlds for the real-engine siege test: two guilds, castles placed within range of two cities, a held city (X) with two arrived
   garrison lines made by the real /api/world/siege/garrison route, and an unheld city (Y) defended by its NPC guards. Everything is
   built from fixed names and a pinned random stream, so two servers given the same world build the same one. */
const path=require('node:path'), root=path.resolve(__dirname,'..','..');
const RLM=require(path.join(root,'world-realm.js')), SG=require(path.join(root,'assets','ui','world-siege.js')), LOC=require(path.join(root,'server','world-location.js')), MINES=require(path.join(root,'server','world-mines.js'));
const W=require('./arena-world.cjs');
/* `n` open castle squares of one region, each `dmin`..`dmax` squares from the site (the nearest-square rule), 4+ squares apart, off the mines */
function cells(site,n,dmin,dmax){
  const mines=new Set(); const ep=MINES.epochAt(Date.now()); for(let e=ep-1;e<=ep+1;e++) for(const nd of MINES.field(e)) for(const k of LOC.GEO.mineKeys(nd.x,nd.y)) mines.add(k);
  const [sx,sy]=[Math.round(site.cx),Math.round(site.cy)], out=[];
  for(let r=dmin;r<=dmax+30&&out.length<n;r++) for(let a=0;a<360&&out.length<n;a+=7){
    const x=Math.round(sx+Math.cos(a*Math.PI/180)*r), y=Math.round(sy+Math.sin(a*Math.PI/180)*r); if(!RLM.isOpen(x,y)||mines.has(x+','+y)) continue;
    const region=RLM.landZone(x,y); if(!region) continue; if(out.length&&out[0].region!==region) continue;
    const pos={x:LOC.cornerX(x),y:LOC.cornerY(y)}; if(!LOC.targetAllowed(region,pos.x,pos.y)) continue;
    const d=SG.distance(pos,site); if(d<dmin||d>dmax) continue;
    if(out.some(c=>Math.abs(c.cx-x)<4&&Math.abs(c.cy-y)<4)) continue;
    out.push({cx:x,cy:y,region,x:pos.x,y:pos.y}); }
  return out; }
function sites(){ const c=SG.sites().filter(s=>s.kind==='city'&&!SG.CAPITALS.includes?.(s.id)); for(let i=0;i<c.length;i++) for(let j=0;j<c.length;j++){ if(i===j) continue;
  const a=cells(c[i],6,6,16), b=cells(c[j],2,6,16); if(a.length===6&&b.length===2) return {X:c[i],Y:c[j],cx:a,cy:b}; } throw Error('no siege sites with open squares'); }
const SITES=sites();
const L40={level:40,stars:4,skill:[10,10,10,10],asc:3};
function place(u,c){ u.worldLocation={region:c.region,x:c.x,y:c.y}; }
/* the world: A1 (guild GA) attacks X (held by GD: lines of D1 and D2), A2 (GA) attacks Y (guards), A3 (no guild) is refused.
   o.heroes overrides the garrison owners' hero builds (the systems test). Returns the players. */
function build(S,o){ o=o||{}; const DB=S.getDB(), {X,Y,cx,cy}=SITES;
  const A1=W.player(S,'SgA1',o.a1||{vael:L40,sylthaine:L40,vireo:L40}), A2=W.player(S,'SgA2',{vex:L40,gruel:L40,vael:L40}), A3=W.player(S,'SgA3',{vireo:L40});
  const D1=W.player(S,'SgD1',o.d1||{gruel:L40,sylthaine:L40,vex:L40}), D2=W.player(S,'SgD2',o.d2||{vireo:L40,vael:L40});
  DB.guilds=DB.guilds||{}; DB.guilds.GA={id:'GA',name:'Attackers',members:[A1.id,A2.id]}; DB.guilds.GD={id:'GD',name:'Holders',members:[D1.id,D2.id]};
  A1.guildId='GA'; A2.guildId='GA'; D1.guildId='GD'; D2.guildId='GD';
  place(A1,cx[0]); place(A3,cx[1]); place(D1,cx[2]); place(D2,cx[3]); place(A2,cy[0]);
  DB.worldSieges={version:1,rev:1,sites:{[X.id]:{type:'guild',id:'GD',name:'Holders',since:1,protectedUntil:0,by:D1.id,byName:D1.name,marchId:'seed',garrison:[]}}};
  return {A1,A2,A3,D1,D2,X,Y}; }
/* after the lines are sent: every garrison line and its march has arrived; the first line's first hero carries a wound (0.6 of its health) */
function arrive(S,w,o){ o=o||{}; const DB=S.getDB(), rec=DB.worldSieges.sites[w.X.id], now=Date.now();
  for(const l of rec.garrison){ l.arriveAt=now-5000; const m=(DB.users[l.uid].worldCityMarches||[]).find(x=>x.id===l.marchId); if(m) m.arriveAt=now-5000; }
  if(o.wound!==false&&rec.garrison[0]){ const s=rec.garrison[0].snaps[0]; s.hp=Math.round(0.6*s.maxHp); s.worldEntryHpCap=s.hp; } }
function arriveMarch(S,u,marchId){ const m=(S.getDB().users[u.id].worldCityMarches||[]).find(x=>x.id===marchId); if(m) m.arriveAt=Date.now()-1000; return m; }
module.exports={ build, arrive, arriveMarch, SITES, L40 };
