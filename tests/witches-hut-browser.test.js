'use strict';
// Local browser smoke for the Witches Hut and signed-in mine dispatch.
// This checks route/UI wiring; it does not certify mine combat balance or art.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');

async function freePort(){
  const s=net.createServer();
  await new Promise(ok=>s.listen(0,'127.0.0.1',ok));
  const n=s.address().port;
  await new Promise(ok=>s.close(ok));
  return n;
}
async function run(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ember-witch-browser-'));
  assert.ok(dir.startsWith(os.tmpdir()+path.sep));
  const db=path.join(dir,'db.json'), port=await freePort(), base=`http://127.0.0.1:${port}`;
  let child, browser;
  async function wholeMap(token){ const out={cities:[],bots:[]};   // v1127 zoom gate: the whole map read as four 5 x 5-tile views
    for(const [c0,r0] of [[0,0],[5,0],[0,5],[5,5]]){ const t=[]; for(let c=c0;c<c0+5;c++)for(let r=r0;r<r0+5;r++)t.push(c+'_'+r);
      const d=await request('GET','/api/world/cities?since=0&tiles='+t.join(','),null,token); out.cities.push(...(d.cities||[])); out.bots.push(...(d.bots||[])); }
    return out; }
  async function request(method,route,data,token){
    const res=await fetch(base+route,{method,headers:{...(token?{'x-token':token}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    return res.json();
  }
  async function start(adminId){
    child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),windowsHide:true,
      stdio:'ignore',env:{...process.env,PORT:String(port),DB_FILE:db,ADMIN_IDS:adminId||'',
        REG_PER_MIN:'200',REG_ACCOUNTS_PER_IP:'200',NODE_ENV:'test',WORLD_MINE_TEST_MS:'20',
        WORLD_WAR_TEST_MS:'20',WORLD_CITY_TEST_MS:'20'}});
    for(let i=0;i<180;i++){
      if(child.exitCode!==null) throw Error('Fixture server exited');
      try{ if((await fetch(base+'/health')).ok) return; }catch(_){}
      await new Promise(ok=>setTimeout(ok,100));
    }
    throw Error('Fixture server did not start');
  }
  async function stop(){
    if(!child)return;
    const c=child;child=null;c.kill();
    await Promise.race([new Promise(ok=>c.once('exit',ok)),new Promise(ok=>setTimeout(ok,2000))]);
  }
  try{
    await start();
    const admin=await request('POST','/api/register',{name:'witchBrowser',pass:'password1'});
    assert.ok(admin.token&&admin.profile.id);
    await new Promise(ok=>setTimeout(ok,700));
    await stop();
    await start(admin.profile.id);
    const grant=await request('POST','/api/admin/led-grant',{
      userId:admin.profile.id,unlock:['vael','sylthaine','vireo'],
      heroKeys:['vael','sylthaine','vireo'],px:900000,heroXp:200000,gems:200
    },admin.token);
    assert.equal(grant.ok,true);
    const field=await request('GET','/api/world/mines',null,admin.token);
    const node=field.nodes.find(m=>m.level===1);
    assert.ok(node);
    const secondNode=field.nodes.find(m=>m.level===1&&m.id!==node.id);
    assert.ok(secondNode);
    browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/play',{waitUntil:'domcontentloaded'});
    await page.evaluate(token=>{ ACC.token=token; G.playerXP=900000; },admin.token);
    if(await page.locator('#tutSkip').isVisible()) await page.locator('#tutSkip').click();
    await page.locator('#splashPlay').click();
    await page.waitForFunction(()=>document.getElementById('rotateGate')?.style.display==='none',{timeout:10000});
    await page.evaluate(token=>{
      ACC.token=token;
      G.playerXP=900000;
      renderHome();
      const hut=document.querySelector('#townHots .hot[title="Witches Hut"] .hit');
      if(!hut) throw Error('Witches Hut town hotspot absent');
      hut.click();
    },admin.token);
    await page.waitForFunction(()=>document.getElementById('wallBody')?.textContent?.includes('Cauldron · Hut Lv'),{timeout:10000});
    const wall=await page.locator('#wallBody').textContent();
    assert.match(wall,/Cauldron · Hut Lv/);
    assert.match(wall,/Heal All · strongest first/);
    const brewVideo=page.locator('#wallBody video');
    assert.match(await brewVideo.getAttribute('src'),/^\/assets\/img\/witches-hut\/brew-[1-4]-.*\?v=1$/);
    const brewAsset=await page.request.get(new URL(await brewVideo.getAttribute('src'),base+'/play').toString());
    assert.equal(brewAsset.status(),200,'the selected brew-state video is served');
    await page.evaluate(()=>show('world'));
    await page.waitForFunction(()=>_worldServerAccount===ACC.token&&G.regionChosen,null,{timeout:10000});
    assert.equal(await page.locator('#regionPicker').count(),0,'no player starting-region picker');
    /* v1226 realm map (Phil 30 Oct 2026): Grok's realm replaces the v02 picture. The sea is blocked terrain, regions are the
       continents, the picture is a zoom pyramid clamped to the realm's edges, the tree is drawn per cycle state on its island. */
    const realmBlocked=require('../world-realm.js').blockedKeys().length;
    const teleportMap=await page.evaluate(async ()=>{
      let zone=document.getElementById('wzone');
      const settle=()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
      const blocked=_worldTerrainBlocked;
      const samples=[]; let paneBorders=0,veiled=0;
      for(const factor of [0,0.5,1]){
        const {min,max}=worldZoomBounds(zone);
        worldZoomTo(min+(max-min)*factor);
        const home=myCastlePos();
        zone.scrollLeft=Math.max(0,home.x/100*WORLD_W*worldZoom-zone.clientWidth/2);
        wzSetTop(zone,home.y/100*WORLD_H-zone.clientHeight/2/worldZoom);
        enterTeleMode(); await settle(); zone=document.getElementById('wzone'); refreshTeleGhosts();
        // v1227: a ghost is a castle square (GEO.FOOT x FOOT cells); every cell of it is checked
        const ghosts=[...document.querySelectorAll('#teleGhostLayer img')].flatMap(img=>GEO.footKeys(parseFloat(img.style.left),parseFloat(img.style.top)));
        const panes=[...document.querySelectorAll('#wzoneInner .worldZonePane')];
        paneBorders+=panes.filter(p=>p.style.boxShadow||p.style.border).length;
        veiled=Math.max(veiled,+(document.getElementById('teleVeil')?.dataset.veiled||0));
        samples.push({zoom:worldZoom,count:ghosts.length,
          blockedGhosts:ghosts.filter(key=>blocked.has(key)).length,
          seaGhosts:ghosts.filter(key=>{const [x,y]=key.split(',').map(Number);return !REALM_MAP.isLand(x,y);}).length,
          closedGhosts:ghosts.filter(key=>{
            const [x,y]=key.split(',').map(Number);
            return !zoneAccessible(REALM_MAP.zoneOfCell(x,y));
          }).length});
        toggleTeleMode(); await settle(); zone=document.getElementById('wzone');
      }
      worldZoomTo(worldZoomBounds(zone).max);
      zone.scrollLeft=Math.min(zone.scrollWidth-zone.clientWidth,zone.scrollLeft+180);
      zone.scrollTop=Math.min(zone.scrollHeight-zone.clientHeight,zone.scrollTop+120);
      const snap=()=>{ const current=document.getElementById('wzone');
        return {left:current.scrollLeft,top:current.scrollTop,zoom:worldZoom}; };
      const before=snap();
      enterTeleMode(); await settle(); const entered=snap();
      toggleTeleMode(); await settle(); const cancelled=snap();
      enterTeleMode(); await settle();
      const [bx,by]=[...blocked][0].split(',').map(Number);
      teleportPlace(GEO.xOf(bx),GEO.yOf(by));
      await settle(); const refused=snap();
      const confirmOpen=!!document.getElementById('_gcYes');
      toggleTeleMode(); await settle();
      const veilOff=!document.getElementById('teleVeil');
      return {blockedCount:blocked.size,samples,before,entered,cancelled,refused,confirmOpen,paneBorders,veiled,veilOff};
    });
    assert.equal(teleportMap.blockedCount,realmBlocked,'browser reads the realm\'s sea from world-realm.js');
    assert.equal(teleportMap.blockedCount,require('../server/world-terrain-blocked.json').count,'and it is the server\'s blocked list');
    assert.ok(teleportMap.samples.every(s=>s.blockedGhosts===0&&s.seaGhosts===0&&s.closedGhosts===0),
      'teleport ghosts never occupy sea, blocked terrain or closed zones at any zoom');
    assert.ok(teleportMap.samples.some(s=>s.count>0),'open land still shows teleport ghosts at close zoom');
    assert.deepEqual(teleportMap.entered,teleportMap.before,'entering teleport keeps scroll and zoom');
    assert.deepEqual(teleportMap.cancelled,teleportMap.before,'cancelling teleport keeps scroll and zoom');
    assert.deepEqual(teleportMap.refused,teleportMap.before,'refused sea tap keeps scroll and zoom');
    assert.equal(teleportMap.confirmOpen,false,'sea never opens teleport confirmation');
    assert.equal(teleportMap.paneBorders,0,'teleport zones have no bright boundary line');
    assert.ok(teleportMap.veiled>1000,'closed regions\' land has the soft dark veil in teleport mode');
    assert.ok(teleportMap.veilOff,'the veil leaves with teleport mode');
    const terrainSamples=await page.evaluate(async ()=>{
      // four coast pairs of the player's own region: a sea cell beside an open castle square on the ghost lattice (v1227: a castle
      // square is GEO.FOOT x FOOT cells; the pair's control is the square's top-left cell)
      const all=[],cells=REALM_MAP.zoneCells(myRegion()),occ=occupiedCells(),F=GEO.FOOT;
      for(const [x,y] of cells){ if(x%F||y%F||!teleSquareFree(GEO.cornerX(x),GEO.cornerY(y),occ)) continue;
        for(const [dx,dy] of [[-1,0],[0,-1],[F,0],[0,F]]) if(!REALM_MAP.isLand(x+dx,y+dy)){all.push([(x+dx)+','+(y+dy),x+','+y]);break;}}
      const pairs=[0,1,2,3].map(k=>all[Math.floor((k+0.5)*all.length/4)]);
      const settle=()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
      const results=[];
      for(const fraction of [0,0.5,1]){
        let zone=document.getElementById('wzone');
        const {min,max}=worldZoomBounds(zone);
        worldZoomTo(min+(max-min)*fraction);
        enterTeleMode(); await settle();
        zone=document.getElementById('wzone');
        for(const [blocked,control] of pairs){
          const [bx,by]=blocked.split(',').map(Number);
          const [cx,cy]=control.split(',').map(Number);
          zone.scrollLeft=Math.max(0,GEO.xOf(bx)/100*WORLD_W*worldZoom-zone.clientWidth/2);
          wzSetTop(zone,GEO.yOf(by)/100*WORLD_H-zone.clientHeight/2/worldZoom);
          await settle(); refreshTeleGhosts();
          const ghostImgs=[...document.querySelectorAll('#teleGhostLayer img')];
          const ghosts=new Set(ghostImgs.flatMap(img=>GEO.footKeys(parseFloat(img.style.left),parseFloat(img.style.top))));
          const ghostSquares=new Set(ghostImgs.map(img=>GEO.anchorX(parseFloat(img.style.left))+','+GEO.anchorY(parseFloat(img.style.top))));
          teleportPlace(GEO.xOf(bx),GEO.yOf(by));
          const refused=!document.getElementById('_gcYes');
          const floorOpen=teleSquareFree(GEO.cornerX(cx),GEO.cornerY(cy))&&zoneAccessible(REALM_MAP.zoneOfCell(cx,cy));
          let floorAccepted=null;
          if(fraction===1&&floorOpen){
            teleportPlace(GEO.cornerX(cx),GEO.cornerY(cy));
            floorAccepted=!!document.getElementById('_gcYes');
            document.getElementById('_gcNo')?.click();
          }
          results.push({fraction,blocked,control,maskBlocked:_worldTerrainBlocked.has(blocked),
            maskFloorOpen:!_worldTerrainBlocked.has(control),blockedGhost:ghosts.has(blocked),
            floorGhost:ghostSquares.has(control),refused,floorOpen,floorAccepted});
        }
        toggleTeleMode(); await settle();
      }
      return results;
    });
    assert.equal(terrainSamples.length,12,'four coast pairs of the home region checked at three zooms');
    assert.ok(terrainSamples.every(s=>s.maskBlocked&&s.maskFloorOpen&&!s.blockedGhost&&s.refused),
      'the sea beside the coast is ghost-free and refused');
    assert.ok(terrainSamples.filter(s=>s.fraction===1).every(s=>s.floorOpen&&s.floorGhost&&s.floorAccepted),
      'the land beside it shows a ghost and opens confirmation at close zoom');
    const pictureGrid=await page.evaluate(async ()=>{
      const L=REALM_MAP.META.levels, zone=document.getElementById('wzone'), inner=document.getElementById('wzoneInner');
      const lowest=realmLevelFor(worldZoomBounds(zone).min), deepest=realmLevelFor(worldZoomBounds(zone).max);
      worldZoomTo(worldZoomBounds(zone).max);
      zone.scrollLeft=5500*worldZoom-zone.clientWidth/2; wzSetTop(zone,5500-zone.clientHeight/2/worldZoom); applyMapLOD();
      const tiles=[...inner.querySelectorAll('#realmTiles img')].map(i=>i.getAttribute('src'));
      const zoneKeys=[[REALM_MAP.META.tree.cx,Math.round(REALM_MAP.META.tree.cy)],...['crystor','draymon','tefron','alumron'].map(k=>REALM_MAP.zoneCells(k)[0])].map(([cx,cy])=>zoneOfPos(GEO.xOf(cx),GEO.yOf(cy)));
      return {levels:L.length,lowest:lowest.z,deepest:deepest.z,lastZ:L[L.length-1].z,tiles,zoneKeys,version:REALM_MAP.META.version,
        live:{level:inner.dataset.pictureLevel,realm:inner.dataset.realmLevel},cover:inner.querySelector('#worldPictureMaster').getAttribute('src')};
    });
    assert.equal(pictureGrid.lowest,pictureGrid.lastZ,'the whole-map view uses the cover level');
    assert.ok(pictureGrid.deepest<pictureGrid.lowest,'the closest view uses a deeper level');
    assert.ok(pictureGrid.tiles.length>0&&pictureGrid.tiles.every(src=>new RegExp('^/assets/img/world-map/realm-'+pictureGrid.version+'/tiles/z\\d+/r\\d\\dc\\d\\d\\.webp\\?v=').test(src)),'tiles stream per view, versioned');
    assert.match(pictureGrid.cover,new RegExp('realm-'+pictureGrid.version+'/cover\\.webp\\?v='));
    assert.deepEqual(pictureGrid.zoneKeys,['worldtree','crystor','draymon','tefron','alumron'],'zones are the realm\'s land masses');
    assert.equal(pictureGrid.live.level,'9','castles and mines show at the close view');
    await page.waitForFunction(()=>[...document.querySelectorAll('#realmTiles img')].every(i=>i.complete&&i.naturalWidth>0),{timeout:15000});
    await page.waitForFunction(()=>document.getElementById('worldTreeTerrain')?.naturalWidth>0,{timeout:10000});
    assert.equal(await page.locator('#worldTreeTarget img').count(),0,'World Tree is terrain on its island, not a floating sprite');
    // the tree's tap target still opens the World Tree menu (its panel's own content is the World Tree UI's tests, unchanged)
    await page.evaluate(()=>{window._wtOpened=0;const ui=worldTreeActionsUI();if(ui){const real=ui.open;ui.open=function(id){if(id==='tree')window._wtOpened++;return real.apply(this,arguments);};}
      document.getElementById('worldTreeTarget').addEventListener('click',()=>{if(!worldTreeActionsUI())window._wtOpened++;},true);});
    await page.addStyleTag({content:'#tutOffer{display:none!important}'});   // the tutorial offer card lies over the map in this fixture
    await page.locator('#worldTreeTarget').click({force:true});
    const wtDiag=await page.evaluate(()=>{const t=document.getElementById('worldTreeTarget').getBoundingClientRect();const top=document.elementFromPoint(t.left+t.width/2,t.top+t.height/2);return JSON.stringify({t:[t.left,t.top,t.width,t.height],top:top&&(top.id||top.className||top.tagName+' '+(top.parentElement&&(top.parentElement.id||top.parentElement.className))+' '+(top.getAttribute('src')||'').slice(0,60)),vw:innerWidth,vh:innerHeight,tele:_teleMode});});
    assert.equal(await page.evaluate(()=>window._wtOpened),1,'tapping the tree on its island opens the World Tree menu '+wtDiag);
    await page.evaluate(()=>closeCityMenu());
    const boundaryTiles=await page.evaluate(()=>{
      const zone=document.getElementById('wzone'),inner=document.getElementById('wzoneInner'),L=realmLevelFor(worldZoom),k=L.cellPx/(WORLD_W/GRID_COLS),T=REALM_MAP.META.tile;
      zone.scrollLeft=(5*T/k)*worldZoom-zone.clientWidth/2; wzSetTop(zone,REALM_TOP_PX+4*T/k-zone.clientHeight/2/worldZoom); applyMapLOD();
      return {level:inner.dataset.pictureLevel,tiles:[...inner.querySelectorAll('#realmTiles img')].map(img=>img.dataset.tileKey)};
    });
    assert.equal(boundaryTiles.level,'9');
    assert.ok(boundaryTiles.tiles.length>=4,'a view across a tile corner loads all four neighbours');
    if(process.env.WORLD_MAP_QA_SCREENSHOT){
      await page.waitForFunction(()=>[...document.querySelectorAll('#realmTiles img')].every(i=>i.complete),{timeout:15000});
      await page.locator('#wzone').screenshot({path:process.env.WORLD_MAP_QA_SCREENSHOT});
    }
    const zoomRules=await page.evaluate(()=>{
      const zone=document.getElementById('wzone'),inner=document.getElementById('wzoneInner');
      worldZoomTo(0);
      const low={zoom:worldZoom,expected:Math.min(zone.clientWidth/WORLD_W,zone.clientHeight/REALM_H_PX),padX:_wmPadX,padY:_wmPadY,pad:getComputedStyle(zone).backgroundImage,
        horizontalRange:zone.scrollWidth-zone.clientWidth,verticalRange:zone.scrollHeight-zone.clientHeight,
        city:inner.querySelector('.wnode.city:not(.me)')?'built':'none',
        mine:inner.querySelector('.wnode.mine')?'built':'none',   /* v1127 zoom gate: zoomed out, castles and mines are not built at all */
        tiles:inner.querySelectorAll('#realmTiles img').length,
        zoneLabel:inner.querySelector('.worldZoneLabel')?.style.display};
      zone.scrollLeft=Number.MAX_SAFE_INTEGER;zone.scrollTop=Number.MAX_SAFE_INTEGER;
      const edge={right:zone.scrollLeft,bottom:zone.scrollTop,
        maxRight:zone.scrollWidth-zone.clientWidth,maxBottom:zone.scrollHeight-zone.clientHeight,
        viewBottom:wzTop(zone)+zone.clientHeight/worldZoom,realmBottom:REALM_TOP_PX+REALM_H_PX};
      zone.scrollTop=0; const top={viewTop:wzTop(zone),realmTop:REALM_TOP_PX};
      worldZoomTo(999);
      const high={zoom:worldZoom,expected:worldZoomBounds(zone).max,
        cellsX:zone.clientWidth/worldZoom/(WORLD_W/GRID_COLS),
        cellsY:zone.clientHeight/worldZoom/(WORLD_W/GRID_COLS),
        city:inner.querySelector('.wnode.city')?.style.display,mine:inner.querySelector('.wnode.mine')?.style.display,
        level:inner.dataset.pictureLevel,overflow:zone.scrollWidth-WORLD_W*worldZoom};
      return {low,edge,top,high,scrollbar:getComputedStyle(zone).scrollbarWidth};
    });
    assert.ok(Math.abs(zoomRules.low.zoom-zoomRules.low.expected)<1e-6,'minimum zoom shows the whole realm (Phil 30 Oct)');
    assert.match(zoomRules.low.pad,/sea-pad\.webp/,"past the realm its own open sea fills the screen, never a bare background");
    assert.ok(Math.abs(zoomRules.low.horizontalRange)<=2,'no sideways play past the realm');
    assert.equal(zoomRules.low.city,'none','castles hide at the overview scale');
    assert.equal(zoomRules.low.mine,'none','mines hide at the overview scale');
    assert.equal(zoomRules.low.tiles,0,'the cover alone draws the whole-map view');
    assert.equal(zoomRules.low.zoneLabel,'none','tiny region captions do not mark the whole-map picture');
    assert.ok(Math.abs(zoomRules.edge.right-zoomRules.edge.maxRight)<=2 &&
      Math.abs(zoomRules.edge.bottom-zoomRules.edge.maxBottom)<=2,'scrolling stops at the picture edges');
    // v1227 full-bleed: the HUD floats over the map, so the view may pass the realm's edge by the HUD's own height (60 screen px at most)
    assert.ok(zoomRules.edge.viewBottom>=zoomRules.edge.realmBottom-2&&zoomRules.edge.viewBottom-zoomRules.edge.realmBottom<=60/zoomRules.low.zoom+2,'the bottom edge of the view is the realm\'s bottom edge (plus the HUD band)');
    assert.ok(zoomRules.top.viewTop<=zoomRules.top.realmTop+1e-6&&zoomRules.top.realmTop-zoomRules.top.viewTop<=60/zoomRules.low.zoom+1e-6,'the top edge of the view is the realm\'s top edge (plus the HUD band)');
    assert.ok(Math.abs(zoomRules.high.zoom-zoomRules.high.expected)<1e-6,'maximum zoom follows the view size');
    assert.ok(Math.abs(zoomRules.high.cellsX-35)<0.01 && zoomRules.high.cellsY>=13,'closest view: 35 squares across (Phil 30 Oct: "make this the closest i can zoom in"), the height shows the rest');
    assert.equal(zoomRules.high.level,'9','closest view uses close detail');
    assert.ok(Math.abs(zoomRules.high.overflow)<=2,'node labels cannot expand the map beyond its picture');
    assert.notEqual(zoomRules.high.city,'none','castles return at close detail');
    assert.notEqual(zoomRules.high.mine,'none','mines return at close detail');
    assert.equal(zoomRules.scrollbar,'none','map hides the scrollbar while retaining pan');
    const march=await page.evaluate(async ({token,node})=>{
      ACC.token=token;
      G.playerXP=900000;
      await startMine(node,['vael','sylthaine','vireo']);
      const m=G.marches.find(x=>x.ctype==='mine'&&x.mineId===node.id);
      return m?{serverMineId:m.serverMineId,arrive:m.arrive,home:m.home}:null;
    },{token:admin.token,node});
    assert.ok(march&&march.serverMineId,'browser kept a server mine receipt');
    await new Promise(ok=>setTimeout(ok,70));
    await page.evaluate(()=>marchTick());
    await page.waitForFunction(id=>{
      const m=G.marches.find(x=>x.serverMineId===id);
      return !!m?.resolved;
    },march.serverMineId,{timeout:10000});
    const report=await page.evaluate(id=>({
      mine:G.marches.find(m=>m.serverMineId===id),
      mail:(G.mail?.mines||[]).slice(-1)
    }),march.serverMineId);
    assert.equal(report.mine.resolved,true);
    assert.ok(report.mail.length>0,'browser displays verified mine result');
    assert.equal(report.mail[0].battle?.v,2,'mine mail retains a watchable replay');
    await page.evaluate(()=>{
      const lost={id:'lost-server-mine',ctype:'mine',dir:'out',serverMineId:'not-in-server-history',
        arrive:Date.now()+60000,home:Date.now()+120000,res:'iron',mineLevel:1};
      G.marches.push(lost);
      resolveMarch(lost);
    });
    await page.waitForFunction(()=>G.marches.find(m=>m.id==='lost-server-mine')?.resolved,{timeout:10000});
    const lostTrip=await page.evaluate(()=>({
      march:G.marches.find(m=>m.id==='lost-server-mine'),
      mail:(G.mail?.mines||[])[0]
    }));
    assert.equal(lostTrip.march.resolved,true,'an unknown server mine march stops retrying');
    assert.match(lostTrip.mail.body,/Unknown mine march/,'permanent refusal is visible in mine mail');
    await page.evaluate(()=>{ show('mail'); mailTab='mines'; renderMail(); });
    await page.locator('#mailBody [data-battle]').last().click();
    const replay=await page.evaluate(()=>({mode:CUR.mode,seed:CUR.seed,
      ally:CUR.replayAlly?.map(h=>h.key),foe:CUR.replayFoe?.map(h=>h.key)}));
    assert.equal(replay.mode,'replay','Mines mail Watch starts a battle replay');
    assert.equal(replay.seed,report.mail[0].battle.seed,'Watch uses the verified server battle seed');
    assert.deepEqual(replay.ally,report.mail[0].battle.mineSnap.map(h=>h.key));
    assert.deepEqual(replay.foe,report.mail[0].battle.foe.map(h=>h.key));
    assert.deepEqual(errors,[],'browser page errors');

    const signedIn=await browser.newPage();
    signedIn.on('pageerror',e=>errors.push(e.message));
    await signedIn.goto(base+'/play',{waitUntil:'domcontentloaded'});
    if(await signedIn.locator('#tutSkip').isVisible()) await signedIn.locator('#tutSkip').click();
    await signedIn.evaluate(()=>signOutFully());
    await signedIn.evaluate(()=>{ G.tutSkipped=true; document.querySelectorAll('#tutOffer').forEach(el=>el.remove()); });
    await signedIn.locator('#splashPlay').click({timeout:5000});
    await signedIn.waitForFunction(()=>document.getElementById('rotateGate')?.style.display==='none',{timeout:10000});
    await signedIn.evaluate(()=>show('account'));
    await signedIn.locator('#acName').fill('witchBrowser');
    await signedIn.locator('#acPass').fill('password1');
    await signedIn.locator('#loginBtn').click({timeout:5000});
    if(await signedIn.locator('#tosAccept').isVisible()) await signedIn.locator('#tosAccept').click({timeout:5000});
    await signedIn.waitForFunction(()=>ACC?.name==='witchBrowser'&&!!ACC.token,null,{timeout:10000});
    await signedIn.waitForFunction(()=>playerLevel()>=20,null,{timeout:10000});
    await signedIn.evaluate(()=>show('home'));
    await signedIn.locator('#townHots .hot[title="Witches Hut"] .hit').click({timeout:5000});
    await signedIn.waitForFunction(()=>document.getElementById('wallBody')?.textContent?.includes('Cauldron · Hut Lv'),{timeout:10000});
    await signedIn.evaluate(()=>show('world'));
    await signedIn.waitForFunction(()=>_worldServerAccount===ACC.token&&G.regionChosen,null,{timeout:10000});
    await signedIn.waitForFunction(()=>Array.isArray(SERVER_BOTS)&&SERVER_BOTS.length===399,null,{timeout:10000});
    assert.equal(await signedIn.evaluate(()=>worldCities().filter(c=>c.bot).length),399,
      'signed-in map renders the server-published NPC roster');
    assert.equal(await signedIn.evaluate(()=>{
      const local=REGION_KEYS.flatMap(regionBotRoster);
      return local.every((bot,i)=>{
        const server=SERVER_BOTS[i];
        return server&&bot.id===server.id&&bot.level===server.level
          &&bot.power===server.power&&bot.x===server.x&&bot.y===server.y
          &&JSON.stringify(bot.team)===JSON.stringify(server.team);
      });
    }),true,'server NPC roster matches the existing client rules at the same account state');
    await signedIn.locator('#wzone').waitFor({state:'visible',timeout:10000});
    await signedIn.evaluate(m=>openMineInfo(m),secondNode);
    await signedIn.locator('.citymenu [data-a="mine"]').click({timeout:5000});
    assert.equal(await signedIn.locator('#mcGo').isEnabled(),true,'signed-in mine squad meets the gate');
    await signedIn.locator('#mcGo').click({timeout:5000});
    await signedIn.waitForFunction(id=>G.marches.some(m=>m.mineId===id&&!!m.serverMineId),secondNode.id,{timeout:10000});
    const realMarch=await signedIn.evaluate(id=>G.marches.find(m=>m.mineId===id)?.serverMineId,secondNode.id);
    await signedIn.evaluate(()=>flushCloud());
    await signedIn.reload({waitUntil:'domcontentloaded'});
    if(await signedIn.locator('#tutSkip').isVisible()) await signedIn.locator('#tutSkip').click();
    await signedIn.locator('#splashPlay').click({timeout:5000});
    await signedIn.waitForFunction(id=>G.marches?.some(m=>m.serverMineId===id),realMarch,{timeout:10000});
    await new Promise(ok=>setTimeout(ok,70));
    await signedIn.evaluate(()=>marchTick());
    await signedIn.waitForFunction(id=>G.marches.some(m=>m.serverMineId===id&&m.resolved),realMarch,{timeout:10000});
    await signedIn.evaluate(()=>{ show('mail'); mailTab='mines'; renderMail(); });
    await signedIn.locator('#mailBody [data-battle]').last().click({timeout:5000});
    assert.equal(await signedIn.evaluate(()=>CUR.mode),'replay','signed-in mine mail opens its real battle replay');
    await signedIn.evaluate(()=>show('world'));
    await signedIn.locator('#wzone').waitFor({state:'visible',timeout:10000});
    const target=await signedIn.evaluate(()=>{
      const occupied=occupiedCells();
      const home=myCastlePos(),homeCells=new Set(GEO.footKeys(home.x,home.y));
      for(let cy=0;cy<=GRID_ROWS-GEO.FOOT;cy++) for(let cx=0;cx<=GRID_COLS-GEO.FOOT;cx++){
        const x=GEO.cornerX(cx),y=GEO.cornerY(cy);   // v1227: a castle square (FOOT x FOOT cells) apart from the home one
        if(!GEO.footKeys(x,y).some(k=>homeCells.has(k))&&teleSquareFree(x,y,occupied)&&zoneAccessible(zoneOfPos(x,y))&&!inWorldTreeCore(x,y)) return {x,y};
      }
      throw Error('No browser teleport square');
    });
    const beforeSuccess=await signedIn.evaluate(()=>{
      const zone=document.getElementById('wzone');
      return {left:zone.scrollLeft,top:zone.scrollTop,zoom:worldZoom};
    });
    await signedIn.evaluate(p=>teleportPlace(p.x,p.y),target);
    await signedIn.locator('#_gcYes').click({timeout:5000});
    await signedIn.waitForFunction(p=>G.castleX===p.x&&G.castleY===p.y,target,{timeout:10000});
    const afterSuccess=await signedIn.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
      const zone=document.getElementById('wzone');
      resolve({left:zone.scrollLeft,top:zone.scrollTop,zoom:worldZoom});
    })));
    assert.deepEqual(afterSuccess,beforeSuccess,'successful teleport keeps scroll and zoom');
    const currentToken=await signedIn.evaluate(()=>ACC.token);
    const afterTele=await request('GET','/api/world/state',null,currentToken);
    assert.equal(afterTele.x,target.x,'visible teleport updates server castle position');
    assert.equal(afterTele.y,target.y);
    const raider=await request('POST','/api/register',{name:'witchRaider',pass:'password1'});
    assert.ok(raider.token&&raider.profile.id);
    const raidGrant=await request('POST','/api/admin/led-grant',{
      userId:raider.profile.id,unlock:['vael','sylthaine','vireo'],
      heroKeys:['vael','sylthaine','vireo'],px:900000,heroXp:200000
    },currentToken);
    assert.equal(raidGrant.ok,true);
    const raidPage=await browser.newPage();
    raidPage.on('pageerror',e=>errors.push(e.message));
    await raidPage.goto(base+'/play',{waitUntil:'domcontentloaded'});
    await raidPage.evaluate(token=>{ ACC.token=token; G.playerXP=900000; },raider.token);
    if(await raidPage.locator('#tutSkip').isVisible()) await raidPage.locator('#tutSkip').click();
    await raidPage.locator('#splashPlay').click();
    await raidPage.waitForFunction(()=>document.getElementById('rotateGate')?.style.display==='none',{timeout:10000});
    const realCity=(await wholeMap(raider.token)).cities
      .find(c=>c.id===admin.profile.id);
    assert.ok(realCity,'the real target is visible on the server-owned world map');
    await raidPage.evaluate(async ({token,city})=>{
      ACC.token=token; await declareWarByMe({...city,real:true});
    },{token:raider.token,city:realCity});
    await new Promise(ok=>setTimeout(ok,35));
    await raidPage.evaluate(async city=>{
      await startMarch('attack',{...city,real:true},['vael','sylthaine','vireo']);
    },realCity);
    const raidStart=await raidPage.evaluate(defId=>G.marches.find(m=>m.tId===defId&&m.serverCityId),admin.profile.id);
    assert.ok(raidStart?.serverCityId,'browser map registered a server city march');
    await new Promise(ok=>setTimeout(ok,35));
    await raidPage.evaluate(()=>marchTick());
    await raidPage.waitForFunction(defId=>G.marches.some(m=>m.tId===defId&&m.resolved),admin.profile.id,{timeout:10000});
    const cityMarch=await raidPage.evaluate(defId=>G.marches.find(m=>m.tId===defId)?.pvpRequestId,admin.profile.id);
    assert.ok(cityMarch,'browser city attack keeps an idempotent request ID');
    const verifiedRaid=await request('POST','/api/pvp/attack',{
      defId:admin.profile.id,marchId:raidStart.serverCityId,requestId:cityMarch
    },raider.token);
    assert.equal(verifiedRaid.ok,true,JSON.stringify(verifiedRaid));
    const cityMail=await raidPage.evaluate(()=>(G.mail?.war||[]).slice(-1)[0]);
    assert.ok(cityMail?.battle,'signed-in city march has a verified watchable report');
    assert.equal(cityMail.battle.won,verifiedRaid.won,'visible city result matches server receipt');
    assert.equal(cityMail.battle.seed,verifiedRaid.replay.seed);
    const botPlayer=await request('POST','/api/register',{name:'witchBotBrowser',pass:'password1'});
    assert.ok(botPlayer.token);
    const botPlayerGrant=await request('POST','/api/admin/led-grant',{
      userId:botPlayer.profile.id,unlock:['vael','sylthaine','vireo','vex','gruel','grosk'],
      heroKeys:['vael','sylthaine','vireo','vex','gruel','grosk'],px:900000,heroXp:200000
    },currentToken);
    assert.equal(botPlayerGrant.ok,true);
    const botPage=await browser.newPage();
    botPage.on('pageerror',e=>errors.push(e.message));
    await botPage.goto(base+'/play',{waitUntil:'domcontentloaded'});
    await botPage.evaluate(token=>{ ACC.token=token; G.playerXP=900000; },botPlayer.token);
    if(await botPage.locator('#tutSkip').isVisible()) await botPage.locator('#tutSkip').click();
    await botPage.locator('#splashPlay').click();
    await botPage.waitForFunction(()=>document.getElementById('rotateGate')?.style.display==='none',{timeout:10000});
    const botTrip=await botPage.evaluate(async(token)=>{
      ACC.token=token; G.playerXP=900000;
      await fetchRealCities(true);
      const bot=SERVER_BOTS[0];
      if(!bot||!await declareWarByMe(bot)) throw Error('Server bot war was not registered: '+(bot?.id||'no bot'));
      await new Promise(ok=>setTimeout(ok,35));
      await startMarch('attack',bot,['vael','sylthaine','vireo','vex','gruel','grosk']);
      const m=G.marches.find(x=>x.tId===bot.id&&x.ctype==='attack');
      return m?{id:m.serverCityId,target:bot.id,heroes:m.heroes,extraBusy:committedHeroes().has('grosk')}:null;
    },botPlayer.token);
    assert.ok(botTrip?.id,'signed-in bot trip has a server march receipt');
    assert.deepEqual(botTrip.heroes,['vael','sylthaine','vireo','vex','gruel'],
      'browser marks only the five server-registered fighters as marching');
    assert.equal(botTrip.extraBusy,false,'the sixth wall hero remains available');
    await new Promise(ok=>setTimeout(ok,70));
    await botPage.evaluate(()=>marchTick());
    await botPage.waitForFunction(id=>G.marches.some(m=>m.serverCityId===id&&m.resolved),botTrip.id,{timeout:10000});
    const botReport=await botPage.evaluate(id=>({
      march:G.marches.find(m=>m.serverCityId===id),
      report:(G.mail?.war||[]).find(m=>m.battle?.oppName===G.marches.find(x=>x.serverCityId===id)?.tName)
    }),botTrip.id);
    assert.equal(botReport.march.resolved,true);
    assert.ok(botReport.report?.battle?.mineSnap?.length,'bot result shows the verified server replay');
    const botReceipt=await request('POST','/api/pvp/attack',{
      defId:botTrip.target,marchId:botTrip.id,requestId:'bot-browser-replay'
    },botPlayer.token);
    assert.equal(botReceipt.ok,true);
    assert.equal(botReport.report.battle.seed,botReceipt.replay.seed);
    assert.equal(botReport.report.battle.won,botReceipt.won);
    const localBotReplay=await botPage.evaluate(meta=>simFightResult(meta.mineSnap,meta.foe,meta.seed),
      botReport.report.battle);
    assert.equal(localBotReplay,botReceipt.won,'browser real-time NPC replay agrees with the server result');
    assert.deepEqual(errors,[],'signed-in browser page errors');
    console.log('Witches Hut browser smoke passed');
  } finally {
    if(browser)await browser.close();
    await stop();
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
