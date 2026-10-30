'use strict';
// v1226 (Phil 30 Oct 2026: "Make the world tree function the same way as the map we have in game"): a full simulated World Tree event
// on Grok's realm. The calendar, sites, control, lifecycle, score and ranking modules are the live ones, unchanged; only the place moved.
// Castles stand on the continents (placed by the server's own placement), marches are planned exactly as server.js worldTreeHooks.route
// does (void half speed, captured route), guilds take the four oases, one captures the tree from another, and the final ranking is read.
const test=require('node:test'),assert=require('node:assert/strict');
const cycle=require('../assets/ui/world-tree-cycle.js'),calendar=require('../server/world-tree-calendar.js'),S=require('../server/world-tree-sites.js');
const LC=require('../server/world-tree-lifecycle.js'),L=require('../server/world-location.js'),R=require('../world-realm.js');
const V=require('../server/world-void-timing.js'),Route=require('../server/world-march-route.js');
const FIRST=Date.parse('2026-10-31T12:00:00Z'), HOUR=3600000;
test('a full World Tree event on the realm: oases taken, the tree captured, the ranking decided',()=>{
  const DB={};calendar.snapshot(DB,{now:FIRST-HOUR,firstEventAt:FIRST,save:()=>{}});
  const at=t=>S.snapshot(calendar.snapshot(DB,{now:t}));
  const sites=at(FIRST);
  assert.equal(sites.eventWindow.active,true);// KNOWN (unchanged from live, reported 30 Oct): the control window is always 24 h (world-tree-sites + control initial()), so on the
  // DST night it closes at 07:00 EST while the countdown and the tree art run the event to 08:00 EST (25 h).
  assert.equal(sites.eventWindow.endsAt-sites.eventWindow.startsAt,24*HOUR);
  for(const s of sites.sites){const cx=L.col(s.centre.x),cy=L.row(s.centre.y);assert.equal(R.landZone(cx,cy),'worldtree',s.id+' stands on the island');}
  // four players, one castle per continent, placed by the server's own balancer; two guilds
  const users={},taken=[];let roll=0;
  for(const id of ['a1','a2','b1','b2']){const loc=L.place(taken,max=>(roll+=7919)%max);taken.push(loc);users[id]={id,loc};}
  assert.equal(new Set(Object.values(users).map(u=>u.loc.region)).size,4,'one castle on each continent');
  const GUILD={a1:'G1',a2:'G1',b1:'G2',b2:'G2'},guilds={G1:{createdAt:1,name:'Ash',tag:'ASH'},G2:{createdAt:2,name:'Brine',tag:'BRN'}};
  let n=0;const routes=[];
  const hooks={guildValid:(g,o)=>GUILD[o]===g,uid:()=>'m'+(++n),seed:(...p)=>p.join(':'),heroBusy:()=>false,
    squad:(owner,ids)=>ids.map(key=>({key,hp:1000,maxHp:1000,worldEntryHpCap:1000,energy:0})),
    route:(owner,siteId)=>{   // server.js worldTreeHooks.route, verbatim rules
      const from=users[owner].loc,to=sites.sites.find(s=>s.id===siteId).centre;
      const distance=L.marchSquares(from,to);
      const timing=V.plan(from,to,distance*60000);const route=Route.capture(from,to,siteId,timing.travelMs,0,timing.pacing);
      assert.ok(route,'a route from '+owner+' ('+users[owner].loc.region+') reaches '+siteId);routes.push({owner,siteId,travelMs:timing.travelMs});
      return {travelMs:timing.travelMs,route};},
    battle:(a,d)=>({won:true,durationMs:10000,ally:a.map(x=>({key:x.key,hp:x.hp-100,maxHp:x.maxHp})),foe:d.map(x=>({key:x.key,hp:0,maxHp:x.maxHp})),
      deaths:d.map(x=>({team:'enemy',key:x.key,atMs:5000}))})};
  let saved=null;
  const run=(now,actor,action,payload={})=>{const w=at(now).eventWindow;
    const r=LC.run(saved,{enabled:true,window:w,now,actorId:actor,guildId:actor?GUILD[actor]:null,action,payload},hooks,guilds);
    assert.equal(r.ok,true,(actor||'tick')+' '+action+': '+r.error);saved=r.state;return r;};
  const start=FIRST+60000;
  run(start,'a1','start',{siteId:'oasis-north',heroIds:['a1h1']});
  run(start+1,'a1','start',{siteId:'oasis-east',heroIds:['a1h2']});
  run(start+2,'a2','start',{siteId:'oasis-south',heroIds:['a2h1']});
  run(start+3,'a2','start',{siteId:'oasis-west',heroIds:['a2h2']});
  run(start+4,'b1','start',{siteId:'tree',heroIds:['b1h1','b1h2']});
  const longest=Math.max(...routes.map(r=>r.travelMs));
  for(let t=start+60000;t<=start+longest+120000;t+=60000)run(t,null,'tick');
  const mid=saved.control.sites;
  assert.deepEqual(['oasis-north','oasis-east','oasis-south','oasis-west'].map(id=>mid[id].holderGuildId),['G1','G1','G1','G1'],'G1 takes all four oases');
  assert.equal(mid.tree.holderGuildId,'G2','G2 holds the tree first');
  // G1 captures the tree from G2
  const t2=start+longest+180000;run(t2,'a2','start',{siteId:'tree',heroIds:['a2h3','a2h4']});
  const back=routes[routes.length-1].travelMs;
  for(let t=t2+60000;t<=t2+back+120000;t+=60000)run(t,null,'tick');
  assert.equal(saved.control.sites.tree.holderGuildId,'G1','G1 captured the tree');
  const changes=saved.control.controlChanges.filter(c=>c.siteId==='tree').map(c=>[c.fromGuildId,c.toGuildId]);
  assert.deepEqual(changes,[[null,'G2'],['G2','G1']],'the tree changed hands once, G2 -> G1');
  // the event ends on its own boundary; the lifecycle finishes it and records the final ranking
  const end=sites.eventWindow.endsAt;
  for(let t=t2+back+180000;t<=end+60000;t+=30*60000)run(Math.min(t,end+60000),null,'tick');
  run(end+120000,null,'tick');
  const final=saved.finals[saved.control.eventId];
  assert.ok(final,'the final standings are recorded');
  assert.equal(final.winnerGuildId,'G1','G1 wins: four oases and the tree');
  assert.deepEqual(final.rows.map(r=>[r.rank,r.guildId,r.guildTag]),[[1,'G1','ASH'],[2,'G2','BRN']]);
  assert.ok(final.rows[0].points>final.rows[1].points);
  assert.equal(final.rewards.status,'awaiting-Phil-approval');
  console.log('realm World Tree event: '+routes.length+' marches, travel '+Math.round(Math.min(...routes.map(r=>r.travelMs))/60000)+'-'+Math.round(longest/60000)+' min, winner '+final.winnerGuildId+' ('+final.rows.map(r=>r.guildId+' '+r.points).join(', ')+')');
});
