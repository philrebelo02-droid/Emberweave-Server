'use strict';
// v1226 realm map (Phil 30 Oct 2026: "put this map in game. Swap out the old one"). Proves on Grok's realm:
//   sea cells are blocked, every region has land, castles the new map puts in the sea are relocated to the nearest land of their
//   own region (by booting the real server on a world of old-map castles), mines only on land, oases and the tree on the island,
//   the server's blocked list and the client's realm module are the same squares, and legacy mine fields never move.
// v1227: the grid is META.cols x META.rows (1000 x 596) and nothing that is not a grid square changed its world size.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const R=require('../world-realm.js'),L=require('../server/world-location.js'),M=require('../server/world-mines.js'),S=require('../server/world-tree-sites.js');
const blocked=require('../server/world-terrain-blocked.json'),oases=require('../server/world-oasis-layout.json');
const REGIONS=['crystor','draymon','tefron','alumron'];
const COLS=R.META.cols,ROWS=R.META.rows,OAS=R.META.oasisCells,CORE=R.META.tree.core;
// the castle square nearest the middle of a region's land list that is wholly the region's open land
const at=home=>{const c=R.zoneCells(home),n=c.length;for(let i=0;i<n;i++){const [x,y]=c[(Math.floor(n/2)+i)%n];if(L.regionSquare(home,x,y,new Set()))return {x:L.cornerX(x),y:L.cornerY(y)};}};
const inCore=(x,y)=>x>=CORE[0]&&x<=CORE[2]&&y>=CORE[1]&&y<=CORE[3];
test('THE GRID is one pair of numbers (v1227: 1000 x 596): world-realm.js META, the server, the mines, the tree sites and the client all read it',()=>{
  assert.equal(COLS,1000);assert.equal(ROWS,596);assert.equal(L.GRID_COLS,COLS);assert.equal(L.GRID_ROWS,ROWS);
  assert.equal(M.GRID_COLS,COLS);assert.equal(M.GRID_ROWS,ROWS);
  const snap=S.snapshot({configured:false,serverNow:Date.now()});assert.equal(snap.gridColumns,COLS);assert.equal(snap.gridRows,ROWS);
  const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  assert.match(html,/const GEO=REALM_MAP\.GEO, GRID_COLS=GEO\.COLS, GRID_ROWS=GEO\.ROWS, GRID_CELL=GEO\.CELL;/,'the client reads the grid from world-realm.js');
  const build=fs.readFileSync(path.join(root,'tools','realm','build_realm.py'),'utf8');
  assert.match(build,/^GRID_COLS = 1000\r?$/m);assert.match(build,/^GRID_ROWS = 596\r?$/m);
  // no world file types the grid again
  const hits=[];
  for(const f of ['server/world-location.js','server/world-mines.js','server/world-tree-sites.js','assets/ui/world-mine-sync.js','assets/ui/world-oasis-markers.js','assets/ui/world-tree-control-ui.js'])
    if(/GRID_COLS\s*=\s*\d|COLS\s*=\s*220|gridColumns!==220/.test(fs.readFileSync(path.join(root,f),'utf8')))hits.push(f);
  assert.deepEqual(hits,[]);
  // square cells, the rows over the art's own band (not the sea margin), positions world-percent of the square world
  assert.ok(R.META.gridTop<=R.META.realmTop+1e-6&&R.META.gridTop+ROWS>=R.META.realmTop+R.META.realmHeight-1e-6,'the rows cover the art');
  assert.ok(ROWS-R.META.realmHeight<1,'and not the empty margin');
  assert.ok(Math.abs(R.META.realmHeight/COLS-20400/34229.48)<1e-3,'rows/cols = the shape of the art the grid spans');
});
test('world sizes did not change with the grid: castle, mine, World Tree core, oases, cities',()=>{
  const OLD=100/220;   // one 220-grid square in world-percent
  assert.equal(R.META.foot,4);assert.ok(Math.abs(R.META.foot*L.CELL-OLD)<=L.CELL,'a castle square is one 220-grid square to a cell');
  assert.ok(Math.abs(18*L.CELL-4*OLD)<=L.CELL,'the tree core is 4x4 220-grid squares');assert.equal(CORE[2]-CORE[0]+1,18);assert.equal(CORE[3]-CORE[1]+1,18);
  assert.ok(Math.abs(OAS*L.CELL-2*OLD)<=L.CELL,'an oasis is 2x2 220-grid squares');
  assert.ok(Math.abs(R.META.tree.sideCells*L.CELL-12.3457*OLD)<1e-3,'the tree picture keeps its world size');
  // the client draws a castle at 44 px in a world of the same 11000 px: unchanged
  const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  assert.match(html,/const WORLD_W=11000, WORLD_H=11000;/);assert.match(html,/class="castle-spr" src="\$\{cImg\}" style="height:44px"/);
  // cities: the same overlay shapes, about (1000/220)^2 = 20.7x the cells of the 220 grid (694 then)
  const cells=R.META.cities.reduce((n,c)=>n+c.cells.length,0);assert.ok(cells>694*17&&cells<694*23,'city cells '+cells);
  // the World Tree trunk is on the world centre
  assert.equal(R.META.tree.cx*L.CELL,50);assert.ok(Math.abs(R.GEO.Y0+R.META.tree.cy*L.CELL-50)<0.01);
});
test('the server list and the client module are the same blocked squares, and every one of them is sea, off the realm or a city',()=>{
  const a=new Set(blocked.cells),b=new Set(R.blockedKeys());
  assert.equal(a.size,blocked.count);assert.equal(a.size,b.size);for(const k of a)assert.ok(b.has(k),k);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const k=x+','+y,land=R.isLand(x,y),city=R.isCity(x,y);
    assert.equal(a.has(k),!land||city,'cell '+k);
    if((!land||city)&&x<=COLS-4&&y<=ROWS-4&&(x+y)%7===0)for(const home of REGIONS)assert.equal(L.targetAllowed(home,L.cornerX(x),L.cornerY(y)),false,'no castle on sea or city '+k);
  }
});
test('cities (Phil 30 Oct 2026: "the city should not be able to be teleported onto"): every one of the 12 covers squares, all blocked, never placed on',()=>{
  const cities=R.META.cities;assert.equal(cities.length,12,'the original 10 + Corran Reach + Durrakh');
  for(const name of ['Corran Reach','Durrakh','Oriel'])assert.ok(cities.some(c=>c.name===name),name);
  const a=new Set(blocked.cells);
  for(const c of cities){
    assert.ok(c.cells.length>=200,c.name+' covers '+c.cells.length+' squares');
    assert.ok(c.cells.some(([x,y])=>R.isLand(x,y)),c.name+' stands on some land');
    for(const [x,y] of c.cells){assert.ok(a.has(x+','+y),c.name+' '+x+','+y+' blocked');assert.ok(R.isCity(x,y)&&!R.isOpen(x,y));assert.equal(R.cityAt(x,y),c.name);}
    // the cells hug the overlay: within its pixel box
    const bx=c.cells.map(p=>p[0]);assert.ok(Math.max(...bx)-Math.min(...bx)<=Math.ceil(c.sizePx[0]/R.META.levels[0].cellPx/R.META.levels[0].scale)+1,c.name+' width');
  }
  for(const k of [...REGIONS,'worldtree','wildN','wildS','wildE','wildW'])for(const [x,y] of R.zoneCells(k))assert.ok(!R.isCity(x,y),'zoneCells never lists a city square');
  for(const o of oases)for(let dy=0;dy<OAS;dy++)for(let dx=0;dx<OAS;dx++)assert.ok(!R.isCity(o.x+dx,o.y+dy),'no oasis on a city');
  // random placement (balancer, wild teleport, transfer) never lands on a city, with the server's own blocked list
  let roll=7;const rnd=max=>(roll=(roll*1103515245+12345)>>>0)%max,taken=[];
  for(let i=0;i<600;i++){const p=L.place(taken,rnd,blocked.cells);assert.ok(!L.isCity(p.x,p.y),'placed on a city');taken.push(p);}
  for(const home of REGIONS)for(let i=0;i<200;i++){const p=L.openInRegion(home,blocked.cells,rnd);assert.ok(p&&!L.isCity(p.x,p.y),home+' wild teleport onto a city');}
  // even with no blocked list at all the walk skips cities
  for(const home of REGIONS)for(let i=0;i<200;i++){const p=L.openInRegion(home,[],rnd);assert.ok(!L.isCity(p.x,p.y));}
  for(let e=62270;e<62280;e++)for(const n of M.field(e))assert.ok(!L.isCity(n.x,n.y),'mine on a city '+n.id);
});
test('every region has land, in its own quadrant; the tree stands on its island',()=>{
  for(const k of REGIONS){const c=R.zoneCells(k);assert.ok(c.length>=20000,k+' has '+c.length+' land cells');
    const mx=c.reduce((s,p)=>s+p[0],0)/c.length,my=c.reduce((s,p)=>s+p[1],0)/c.length,q=L.REGIONS[k];
    assert.equal(mx<COLS/2,q.col===0,k+' west/east');assert.equal(my<R.META.tree.cy,q.row===0,k+' north/south');}
  assert.ok(R.zoneCells('worldtree').length>=4000);
  for(let x=CORE[0];x<=CORE[2];x++)for(let y=CORE[1];y<=CORE[3];y++)assert.equal(R.landZone(x,y),'worldtree','tree core '+x+','+y+' is island land');
  assert.ok(R.META.tree.cx===COLS/2,'the trunk is on the world centre');
});
test('oases: four sites of 2x2 220-grid squares, every cell island land, outside the tree core, one per side',()=>{
  const snap=S.snapshot({configured:false,serverNow:Date.now()});
  assert.equal(oases.length,4);
  for(const o of oases){
    for(let dy=0;dy<OAS;dy++)for(let dx=0;dx<OAS;dx++){const x=o.x+dx,y=o.y+dy;assert.equal(R.landZone(x,y),'worldtree',o.direction+' oasis cell '+x+','+y);assert.ok(!inCore(x,y));}
    const s=snap.sites.find(s=>s.id==='oasis-'+o.direction);assert.deepEqual(s.cellOrigin,{x:o.x,y:o.y});
    assert.equal(s.widthCells,OAS);
    assert.equal(L.col(s.centre.x),o.x+OAS/2);assert.equal(L.row(s.centre.y),o.y+OAS/2);
  }
  const by=Object.fromEntries(oases.map(o=>[o.direction,o]));
  assert.ok(by.north.y+OAS<=CORE[1]&&by.south.y>CORE[3]&&by.east.x>CORE[2]&&by.west.x+OAS<=CORE[0],'each oasis on its own side');
});
test('the small islands are the wild (Phil 30 Oct 2026): reachable land for every region, wild mines, room for island rewards',()=>{
  const Route=require('../server/world-march-route.js'),V=require('../server/world-void-timing.js');
  const isles=R.META.islets;assert.ok(Array.isArray(isles)&&isles.length>=10,'the islets are listed: '+(isles&&isles.length));
  let wildMines=0;for(let e=62270;e<62290;e++)wildMines+=M.field(e).filter(n=>n.region.startsWith('wild')).length;
  assert.ok(wildMines>0,'wild mines are dealt on the islets');
  let roomy=0;
  for(const isle of isles){
    assert.match(isle.id,/^isle-\d\d$/);assert.ok(/^wild[NSEW]$/.test(isle.zone));assert.deepEqual(isle.rewards,[],'room for island rewards');
    const cells=[];for(let y=isle.box[1];y<isle.box[1]+isle.box[3];y++)for(let x=isle.box[0];x<isle.box[0]+isle.box[2];x++)if(R.landZone(x,y)===isle.zone)cells.push([x,y]);
    assert.ok(cells.length>0,isle.id+' has wild land');
    // a castle square wholly on the islet
    const sq=cells.find(([x,y])=>L.footprint(L.cornerX(x),L.cornerY(y)).every(([a,b])=>R.landZone(a,b)===isle.zone&&!R.isCity(a,b)));
    if(!sq)continue;roomy++;
    const [x,y]=sq;
    for(const home of REGIONS){
      assert.equal(L.targetAllowed(home,L.cornerX(x),L.cornerY(y)),true,home+' may teleport onto '+isle.id);
      const from=at(home),to={x:L.cornerX(x),y:L.cornerY(y)},t=V.plan(from,to,600000);
      assert.ok(Route.capture(from,to,isle.id,t.travelMs,0,t.pacing),'a march from '+home+' reaches '+isle.id+' across the sea');
    }
  }
  assert.ok(roomy>=10,'islets that hold a castle: '+roomy);
  const wild=['wildN','wildS','wildE','wildW'].reduce((n,k)=>n+R.zoneCells(k).length,0);
  assert.equal(wild,isles.reduce((n,i)=>n+i.cells,0),'every wild land cell belongs to a listed islet');
});
test('mines: every realm field is dealt on land only - never sea, never the World Tree island - with levels by region and wild',()=>{
  const bl=new Set(blocked.cells);
  for(let e=62270;e<62300;e++){
    const f=M.field(e);assert.equal(f.length,M.COUNT);
    const seen=new Set();
    for(const n of f){
      const foot=L.footprint(n.x,n.y);
      assert.deepEqual(foot[0],[n.gx,n.gy],'gx,gy is the top-left cell of the mine square');
      for(const [x,y] of foot){assert.ok(R.isLand(x,y),'node on land '+n.id);assert.equal(R.landZone(x,y),n.region);assert.ok(!bl.has(x+','+y));
        assert.ok(!seen.has(x+','+y),'mines never overlap');seen.add(x+','+y);}
      assert.notEqual(n.region,'worldtree');assert.ok(n.gx>=1&&n.gy>=1&&n.gx<=COLS-5&&n.gy<=ROWS-5);
      if(REGIONS.includes(n.region))assert.ok(n.level>=1&&n.level<=6);else assert.ok(n.level>=7&&n.level<=10);
      assert.deepEqual(M.nodeById(n.id,e*M.EPOCH_MS),n);
    }
  }
});
test('no trace of the old world map is left (Phil 30 Oct 2026: "Make sure we remove all traces of the old map when we do")',()=>{
  const OLD=['world-v02','terrain-region.jpg','terrain-wild.jpg','terrain-worldtree.jpg','ground-region.jpg','ground-wild.jpg','ground-worldtree.jpg',
    'worldtree-integrated-center','worldtree-cycle-v1','assets/img/decor/','world-terrain-blocked-v02','TERRAIN_IMGS','GROUND_IMGS','DECOR_IMGS','scatterZone',
    'WORLD_PICTURE_ROOT','paintWorldPictureTiles','ZONE_EDGES','zoneIndexForCell','zoneCellStart','REGION_CELLS','WILD_CELLS','TERRAIN_CUTOVER_EPOCH'];
  const files=['emberweave-heroes.html','sw.js','server.js',...fs.readdirSync(path.join(root,'server')).filter(f=>/\.(js|json)$/.test(f)).map(f=>'server/'+f),
    ...fs.readdirSync(path.join(root,'assets','ui')).filter(f=>f.endsWith('.js')).map(f=>'assets/ui/'+f),
    ...fs.readdirSync(path.join(root,'tests')).filter(f=>/\.(js|cjs|sh)$/.test(f)&&f!=='world-realm.test.js').map(f=>'tests/'+f)];
  const hits=[];
  for(const f of files){const t=fs.readFileSync(path.join(root,f),'utf8');for(const o of OLD)if(t.includes(o))hits.push(f+': '+o);}
  assert.deepEqual(hits,[],'old world-map references');
  for(const f of ['assets/img/world-map/world-v02','assets/img/world-map/terrain-region.jpg','assets/img/world-map/ground-region.jpg','assets/img/decor','server/world-terrain-blocked-v02.json'])
    assert.equal(fs.existsSync(path.join(root,f)),false,f+' is gone');
});
test('boot relocation: castles the realm puts in the sea or on another region move to the nearest open land of their OWN region',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-realm-boot-')),file=path.join(dir,'db.json'),now=Date.now();
  const users={},start={};
  // castles where the old 90x90 squares put them: corner squares 0-89 / 130-219, a stride through each
  const old={crystor:[0,0],draymon:[130,0],tefron:[0,130],alumron:[130,130]};
  let n=0;
  for(const [region,[ox,oy]] of Object.entries(old))for(let j=3;j<90;j+=11)for(let i=3;i<90;i+=11){
    const id='c'+(n++),loc={region,x:(ox+i+0.5)*100/220,y:(oy+j+0.5)*100/220};   // a 220-grid square centre, as stored
    users[id]={id,name:'Castle '+id,created:now-1000,rank:1,coins:0,team:['vael'],wall:['vael'],roster:{},worldLocation:loc};start[id]=loc;
  }
  // Phil 30 Oct 2026: a castle standing on a city square moves too (to its own region's nearest open land)
  const cityIds=[];
  for(const c of R.META.cities){const land=c.cells.filter(([x,y])=>REGIONS.includes(R.landZone(x,y)));
    for(const [x,y] of [land[0],land[land.length>>1]].filter(Boolean)){const id='k'+(n++),loc={region:R.landZone(x,y),x:L.cornerX(x),y:L.cornerY(y)};
      if(Object.values(start).some(l=>L.footKeys(l.x,l.y).some(k=>L.footKeys(loc.x,loc.y).includes(k))))continue;
      users[id]={id,name:'Castle '+id,created:now-1000,rank:1,coins:0,team:['vael'],wall:['vael'],roster:{},worldLocation:loc};start[id]=loc;cityIds.push(id);}}
  fs.writeFileSync(file,JSON.stringify({users,byName:{},tokens:{},seeded:true,seedVersion:3,heroIdV:3,guilds:{},idem:{},feedback:[],reports:[],meta:{rollSecret:'realm-test'}}));
  const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
  let log='';const child=cp.spawn(process.execPath,[path.join(root,'server.js')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],
    env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:file,NODE_ENV:'test',GAME_URL:'http://127.0.0.1:1',SIM_WORKERS:'0'}});
  child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
  let moved=0;
  try{
    for(let i=0;i<400&&!/Terrain-blocked castles moved at boot: \d+/.test(log);i++){if(child.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,50));}
    moved=+(/Terrain-blocked castles moved at boot: (\d+)/.exec(log)||[])[1];
    assert.ok(moved>0,'some old-map castles were in the sea: '+moved);
    for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:'+port+'/api/manifest');break;}catch{await new Promise(r=>setTimeout(r,50));}}
  }finally{child.kill();await new Promise(r=>child.once('exit',r));}
  const db=require('../server/world-store.js').readWorld(file);
  const mineCells=M.field(M.epochAt(now)).flatMap(n=>L.footKeys(n.x,n.y));
  const finalCells=new Map();let relocated=0,kept=0;
  for(const [id,loc] of Object.entries(start).map(([id])=>[id,db.users[id].worldLocation]))for(const k of L.footKeys(loc.x,loc.y)){
    assert.ok(!finalCells.has(k)||finalCells.get(k)===id,'two castles never share a cell: '+k);finalCells.set(k,id);}
  for(const [id,loc0] of Object.entries(start)){
    const loc=db.users[id].worldLocation;
    assert.equal(loc.region,loc0.region,'a castle keeps its home region');
    assert.ok(L.valid(loc),id+' stands on a legal castle square of its own region');
    const stayed=L.valid(loc0)&&!L.footBlocked(new Set(blocked.cells),loc0.x,loc0.y);
    if(stayed){assert.deepEqual(loc,loc0,'a castle already on legal land is untouched');kept++;continue;}
    relocated++;
    const occupied=new Set(mineCells);
    for(const [k,owner] of finalCells)if(owner!==id)occupied.add(k);
    for(const [oid,l] of Object.entries(start))if(oid!==id)for(const k of L.footKeys(l.x,l.y))occupied.add(k);
    const fx=L.anchorX(loc0.x),fy=L.anchorY(loc0.y),d=(L.anchorX(loc.x)-fx)**2+(L.anchorY(loc.y)-fy)**2;
    for(const [cx,cy] of R.zoneCells(loc0.region)){if((cx-fx)**2+(cy-fy)**2>=d)continue;
      assert.ok(!L.regionSquare(loc0.region,cx,cy,occupied),id+' could have moved nearer, to '+cx+','+cy);}
  }
  assert.equal(relocated,moved,'the boot log counts every move');
  assert.ok(cityIds.length>=12,'a city castle per city: '+cityIds.length);
  for(const id of cityIds){const loc=db.users[id].worldLocation;
    assert.ok(!L.isCity(loc.x,loc.y),id+' left the city');assert.equal(L.zoneOf(loc.x,loc.y),start[id].region,id+' stays in its own region');
    assert.ok(Math.hypot(loc.x-start[id].x,loc.y-start[id].y)<=20*100/220,id+' moved just outside the walls');}
  for(const loc of Object.values(db.users).map(u=>u.worldLocation))assert.ok(!L.isCity(loc.x,loc.y),'no castle on a city after boot');
  assert.ok(kept>0&&relocated>0);
  console.log('boot relocation: '+relocated+' moved to their own region\'s nearest land, '+kept+' already on legal land');
});
