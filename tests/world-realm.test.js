'use strict';
// v1226 realm map (Phil 30 Oct 2026: "put this map in game. Swap out the old one"). Proves on Grok's realm:
//   sea cells are blocked, every region has land, castles the new map puts in the sea are relocated to the nearest land of their
//   own region (by booting the real server on a world of old-map castles), mines only on land, oases and the tree on the island,
//   the server's blocked list and the client's realm module are the same squares, and legacy mine fields never move.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const R=require('../world-realm.js'),L=require('../server/world-location.js'),M=require('../server/world-mines.js'),S=require('../server/world-tree-sites.js');
const blocked=require('../server/world-terrain-blocked.json'),oases=require('../server/world-oasis-layout.json');
const REGIONS=['crystor','draymon','tefron','alumron'];
const at=home=>{const c=R.zoneCells(home)[Math.floor(R.zoneCells(home).length/2)];return {x:L.center(c[0]),y:L.center(c[1])};};
test('the server list and the client module are the same blocked squares, and every one of them is sea or off the realm',()=>{
  const a=new Set(blocked.cells),b=new Set(R.blockedKeys());
  assert.equal(a.size,blocked.count);assert.equal(a.size,b.size);for(const k of a)assert.ok(b.has(k),k);
  for(let y=0;y<220;y++)for(let x=0;x<220;x++){
    const k=x+','+y,land=R.isLand(x,y);
    assert.equal(a.has(k),!land,'cell '+k);
    if(!land)for(const home of REGIONS)assert.equal(L.targetAllowed(home,L.center(x),L.center(y)),false,'no castle on sea '+k);
  }
  // rows outside the realm art are all blocked
  for(let y=0;y<Math.floor(R.META.realmTop);y++)for(let x=0;x<220;x++)assert.ok(a.has(x+','+y));
  for(let y=Math.ceil(R.META.realmTop+R.META.realmHeight);y<220;y++)for(let x=0;x<220;x++)assert.ok(a.has(x+','+y));
});
test('every region has land, in its own quadrant; the tree stands on its island',()=>{
  for(const k of REGIONS){const c=R.zoneCells(k);assert.ok(c.length>=1000,k+' has '+c.length+' land cells');
    const mx=c.reduce((s,p)=>s+p[0],0)/c.length,my=c.reduce((s,p)=>s+p[1],0)/c.length,q=L.REGIONS[k];
    assert.equal(mx<110,q.col===0,k+' west/east');assert.equal(my<110,q.row===0,k+' north/south');}
  assert.ok(R.zoneCells('worldtree').length>=200);
  for(let x=108;x<=111;x++)for(let y=108;y<=111;y++)assert.equal(R.landZone(x,y),'worldtree','tree core '+x+','+y+' is island land');
  assert.ok(R.META.tree.cx===110&&R.META.tree.cy===110,'the trunk is on the world centre');
});
test('oases: four 2x2 sites, every cell island land, outside the tree core, one per side',()=>{
  const snap=S.snapshot({configured:false,serverNow:Date.now()});
  assert.equal(oases.length,4);
  for(const o of oases){
    for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]){const x=o.x+dx,y=o.y+dy;assert.equal(R.landZone(x,y),'worldtree',o.direction+' oasis cell '+x+','+y);assert.ok(!(x>=108&&x<=111&&y>=108&&y<=111));}
    const s=snap.sites.find(s=>s.id==='oasis-'+o.direction);assert.deepEqual(s.cellOrigin,{x:o.x,y:o.y});
  }
  const by=Object.fromEntries(oases.map(o=>[o.direction,o]));
  assert.ok(by.north.y+1<108&&by.south.y>111&&by.east.x>111&&by.west.x+1<108,'each oasis on its own side');
});
test('the small islands are the wild (Phil 30 Oct 2026): reachable land for every region, wild mines, room for island rewards',()=>{
  const Route=require('../server/world-march-route.js'),V=require('../server/world-void-timing.js');
  const isles=R.META.islets;assert.ok(Array.isArray(isles)&&isles.length>=10,'the islets are listed: '+(isles&&isles.length));
  let wildMines=0;for(let e=62270;e<62290;e++)wildMines+=M.field(e).filter(n=>n.region.startsWith('wild')).length;
  assert.ok(wildMines>0,'wild mines are dealt on the islets');
  for(const isle of isles){
    assert.match(isle.id,/^isle-\d\d$/);assert.ok(/^wild[NSEW]$/.test(isle.zone));assert.deepEqual(isle.rewards,[],'room for island rewards');
    const cells=[];for(let y=isle.box[1];y<isle.box[1]+isle.box[3];y++)for(let x=isle.box[0];x<isle.box[0]+isle.box[2];x++)if(R.landZone(x,y)===isle.zone)cells.push([x,y]);
    assert.ok(cells.length>0,isle.id+' has wild land');
    const [x,y]=cells[0];
    for(const home of REGIONS){
      assert.equal(L.targetAllowed(home,L.center(x),L.center(y)),true,home+' may teleport onto '+isle.id);
      const from=at(home),to={x:L.center(x),y:L.center(y)},t=V.plan(from,to,600000);
      assert.ok(Route.capture(from,to,isle.id,t.travelMs,0,t.pacing),'a march from '+home+' reaches '+isle.id+' across the sea');
    }
  }
  const wild=['wildN','wildS','wildE','wildW'].reduce((n,k)=>n+R.zoneCells(k).length,0);
  assert.equal(wild,isles.reduce((n,i)=>n+i.cells,0),'every wild land cell belongs to a listed islet');
});
test('mines: every realm field is dealt on land only - never sea, never the World Tree island - with levels by region and wild',()=>{
  for(let e=62270;e<62330;e++){
    const f=M.field(e);assert.equal(f.length,M.COUNT);
    const seen=new Set();
    for(const n of f){
      assert.ok(R.isLand(n.gx,n.gy),'node on land '+n.id);assert.notEqual(R.landZone(n.gx,n.gy),'worldtree');assert.ok(!blocked.cells.includes(n.gx+','+n.gy)||false);
      assert.equal(n.region,R.landZone(n.gx,n.gy));assert.ok(n.gx>=2&&n.gy>=2&&n.gx<219&&n.gy<219);
      if(REGIONS.includes(n.region))assert.ok(n.level>=1&&n.level<=6);else assert.ok(n.level>=7&&n.level<=10);
      assert.ok(!seen.has(n.gx+','+n.gy));seen.add(n.gx+','+n.gy);
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
    const id='c'+(n++),loc={region,x:L.center(ox+i),y:L.center(oy+j)};
    users[id]={id,name:'Castle '+id,created:now-1000,rank:1,coins:0,team:['vael'],wall:['vael'],roster:{},worldLocation:loc};start[id]=loc;
  }
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
  const mines=new Set(M.field(M.epochAt(now)).map(n=>n.gx+','+n.gy)),startCells=new Set(Object.values(start).map(l=>L.cellKey(l.x,l.y)));
  const finalCells=new Map();let relocated=0,kept=0;
  for(const [id,loc0] of Object.entries(start)){
    const loc=db.users[id].worldLocation,key=L.cellKey(loc.x,loc.y);
    assert.equal(loc.region,loc0.region,'a castle keeps its home region');
    assert.equal(R.landZone(L.cellIndex(loc.x),L.cellIndex(loc.y))===loc.region||(L.valid(loc0)&&key===L.cellKey(loc0.x,loc0.y)),true,id+' stands on its own region (or kept its legal square)');
    assert.ok(R.isLand(L.cellIndex(loc.x),L.cellIndex(loc.y)),id+' on land');
    assert.ok(!finalCells.has(key),'two castles never share a square');finalCells.set(key,id);
    const stayed=L.valid(loc0)&&!blocked.cells.includes(L.cellKey(loc0.x,loc0.y));
    if(stayed){assert.deepEqual(loc,loc0,'a castle already on legal land is untouched');kept++;continue;}
    relocated++;
    const fx=L.cellIndex(loc0.x),fy=L.cellIndex(loc0.y),d=(L.cellIndex(loc.x)-fx)**2+(L.cellIndex(loc.y)-fy)**2;
    for(const [cx,cy] of R.zoneCells(loc0.region)){const k=cx+','+cy;if(finalCells.has(k)&&k!==key)continue;if(mines.has(k)||startCells.has(k))continue;
      assert.ok((cx-fx)**2+(cy-fy)**2>=d,id+' could have moved nearer, to '+k);}
  }
  assert.equal(relocated,moved,'the boot log counts every move');
  assert.ok(kept>0&&relocated>0);
  console.log('boot relocation: '+relocated+' moved to their own region\'s nearest land, '+kept+' already on legal land');
});
