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
    const pictureGrid=await page.evaluate(()=>{
      const sizes=[1,3,9].map(n=>worldPictureTile(n,Math.floor(n/2),Math.floor(n/2)));
      const landmark={x:5500,y:5500};
      const positions=sizes.map(tile=>({x:tile.left+(landmark.x-tile.left),y:tile.top+(landmark.y-tile.top)}));
      const one=worldPictureForViewport(3600,4300,3700,4700);
      const nine=worldPictureForViewport(5200,5200,5800,5800);
      const three=worldPictureForViewport(4800,4300,5000,4700);
      worldZoomTo(1.6);
      const zone=document.getElementById('wzone');
      zone.scrollLeft=5500*worldZoom-zone.clientWidth/2;
      zone.scrollTop=5500*worldZoom-zone.clientHeight/2;
      applyMapLOD();
      const inner=document.getElementById('wzoneInner');
      const zoneKeys=[[89,89],[90,89],[129,129],[130,130]].map(([cx,cy])=>zoneOfPos((cx+0.5)*GRID_CELL,(cy+0.5)*GRID_CELL));
      const close=inner.querySelector('#worldPictureClose');
      return {sizes,positions,one,three,nine,zoneKeys,closeSrc:close.querySelector('img')?.src,
        live:{level:inner.dataset.pictureLevel,col:inner.dataset.pictureCol,row:inner.dataset.pictureRow}};
    });
    assert.deepEqual(pictureGrid.sizes.map(t=>t.cells),[220,220/3,220/9],'art thirds preserve the 220-cell gameplay world');
    assert.deepEqual(pictureGrid.positions,[{x:5500,y:5500},{x:5500,y:5500},{x:5500,y:5500}],
      'landmarks retain their world coordinates at all picture scales');
    assert.deepEqual(pictureGrid.zoneKeys,['crystor','wildN','worldtree','alumron'],
      'gameplay region boundaries follow 90/40/90, independently of art thirds');
    assert.equal(pictureGrid.one.divisions,1,'crossing a middle-piece border selects the whole picture');
    assert.equal(pictureGrid.three.divisions,3,'crossing a close-piece border selects a middle picture');
    assert.equal(pictureGrid.nine.divisions,9,'a viewport inside one close piece selects that piece');
    assert.deepEqual(pictureGrid.live,{level:'9',col:'4',row:'4'},'live map selects the close picture at its world position');
    assert.match(pictureGrid.closeSrc,/world-v02-l2-r04-c04\.png$/,'close picture uses its exact indexed filename');
    await page.waitForFunction(()=>document.querySelector('#worldPictureClose img')?.naturalWidth===1254,{timeout:10000});
    await page.waitForFunction(()=>document.getElementById('worldTreeTerrain')?.naturalWidth===1254,{timeout:10000});
    assert.equal(await page.locator('#worldTreeTarget img').count(),0,'World Tree is integrated terrain, not a floating sprite');
    await page.locator('#worldTreeTarget').click({force:true});
    assert.match(await page.locator('.citymenu .cm-t').textContent(),/World Tree/,'integrated landmark keeps its menu');
    await page.evaluate(()=>closeCityMenu());
    const boundaryTiles=await page.evaluate(()=>{
      const zone=document.getElementById('wzone'),inner=document.getElementById('wzoneInner');
      const inspect=x=>{
        zone.scrollLeft=x*worldZoom-zone.clientWidth/2;
        zone.scrollTop=5500*worldZoom-zone.clientHeight/2;
        applyMapLOD();
        return {level:inner.dataset.pictureLevel,
          close:[...inner.querySelectorAll('#worldPictureClose img')].map(img=>img.dataset.tileKey),
          middle:[...inner.querySelectorAll('#worldPictureMiddle img')].map(img=>img.dataset.tileKey)};
      };
      return {ninth:inspect(WORLD_W/9),third:inspect(WORLD_W/3)};
    });
    assert.equal(boundaryTiles.ninth.level,'9','crossing a ninth seam keeps close-detail art');
    assert.ok(boundaryTiles.ninth.close.length>=2,'the viewport loads both neighboring ninths');
    assert.equal(boundaryTiles.third.level,'9','crossing a third seam keeps close-detail art at this zoom');
    assert.ok(boundaryTiles.third.close.length>=2 && boundaryTiles.third.middle.length>=2,
      'the viewport loads close pieces and both middle placeholders across a third seam');
    if(process.env.WORLD_MAP_QA_BOUNDARY_SCREENSHOT){
      await page.waitForFunction(()=>[...document.querySelectorAll('#worldPictureClose img')]
        .every(img=>img.complete&&img.naturalWidth===1254),{timeout:10000});
      await page.locator('#wzone').screenshot({path:process.env.WORLD_MAP_QA_BOUNDARY_SCREENSHOT});
    }
    if(process.env.WORLD_MAP_QA_SCREENSHOT){
      const screenshotState=await page.evaluate(()=>{
        worldZoomTo(1.6);
        const zone=document.getElementById('wzone');
        zone.scrollLeft=5500*worldZoom-zone.clientWidth/2;
        zone.scrollTop=5500*worldZoom-zone.clientHeight/2;
        applyMapLOD();
        const inner=document.getElementById('wzoneInner');
        return {level:inner.dataset.pictureLevel,col:inner.dataset.pictureCol,row:inner.dataset.pictureRow,
          left:zone.scrollLeft,top:zone.scrollTop,closeDisplay:inner.querySelector('#worldPictureClose').style.display};
      });
      assert.deepEqual([screenshotState.level,screenshotState.col,screenshotState.row,screenshotState.closeDisplay],['9','4','4','']);
      await page.locator('#wzone').screenshot({path:process.env.WORLD_MAP_QA_SCREENSHOT});
    }
    const fallback=await page.evaluate(()=>{
      const zone=document.getElementById('wzone');
      zone.scrollLeft=600*worldZoom-zone.clientWidth/2;
      zone.scrollTop=600*worldZoom-zone.clientHeight/2;
      applyMapLOD();
      const inner=document.getElementById('wzoneInner');
      const local={level:inner.dataset.pictureLevel,closeSrc:inner.querySelector('#worldPictureClose img')?.src};
      worldZoomTo(0.1); applyMapLOD();
      return {local,overview:{level:inner.dataset.pictureLevel,master:inner.querySelector('#worldPictureMaster').style.display}};
    });
    assert.equal(fallback.local.level,'9','all completed close areas select their own detail picture');
    assert.match(fallback.local.closeSrc,/world-v02-l2-r00-c00\.png$/);
    assert.equal(fallback.overview.level,'1','crossing middle pictures selects the whole approved map');
    assert.equal(fallback.overview.master,'block');
    const zoomRules=await page.evaluate(()=>{
      const zone=document.getElementById('wzone'),inner=document.getElementById('wzoneInner');
      worldZoomTo(0);
      const low={zoom:worldZoom,expected:zone.clientWidth/WORLD_W,
        horizontalRange:zone.scrollWidth-zone.clientWidth,city:inner.querySelector('.wnode.city')?.style.display,
        mine:inner.querySelector('.wnode.mine')?.style.display,
        middle:inner.querySelector('#worldPictureMiddle')?.style.display,
        close:inner.querySelector('#worldPictureClose')?.style.display,
        zoneLabel:inner.querySelector('.worldZoneLabel')?.style.display,
        regionBackground:[...inner.children].find(el=>el.style.width?.includes('%')&&el.style.height?.includes('%'))?.style.background};
      zone.scrollLeft=Number.MAX_SAFE_INTEGER;zone.scrollTop=Number.MAX_SAFE_INTEGER;
      const edge={right:zone.scrollLeft,bottom:zone.scrollTop,
        maxRight:zone.scrollWidth-zone.clientWidth,maxBottom:zone.scrollHeight-zone.clientHeight};
      worldZoomTo(999);
      const high={zoom:worldZoom,expected:worldZoomBounds(zone).max,
        cellsX:zone.clientWidth/worldZoom/(WORLD_W/GRID_COLS),
        cellsY:zone.clientHeight/worldZoom/(WORLD_H/GRID_COLS),
        city:inner.querySelector('.wnode.city')?.style.display,mine:inner.querySelector('.wnode.mine')?.style.display,
        level:inner.dataset.pictureLevel,overflow:zone.scrollWidth-WORLD_W*worldZoom};
      return {low,edge,high,scrollbar:getComputedStyle(zone).scrollbarWidth};
    });
    assert.ok(Math.abs(zoomRules.low.zoom-zoomRules.low.expected)<1e-6,'minimum zoom fits the full world width');
    assert.ok(Math.abs(zoomRules.low.horizontalRange)<=2,'no sideways play past the whole picture');
    assert.equal(zoomRules.low.city,'none','castles hide at the overview scale');
    assert.equal(zoomRules.low.mine,'none','mines hide at the overview scale');
    assert.equal(zoomRules.low.middle,'none','middle pictures hide at the whole-map scale');
    assert.equal(zoomRules.low.close,'none','close pictures hide at the whole-map scale');
    assert.equal(zoomRules.low.zoneLabel,'none','tiny region captions do not mark the whole-map picture');
    assert.equal(zoomRules.low.regionBackground,'transparent','region overlays do not darken the approved master picture');
    assert.ok(Math.abs(zoomRules.edge.right-zoomRules.edge.maxRight)<=2 &&
      Math.abs(zoomRules.edge.bottom-zoomRules.edge.maxBottom)<=2,'scrolling stops at the picture edges');
    assert.ok(Math.abs(zoomRules.high.zoom-zoomRules.high.expected)<1e-6,'maximum zoom follows the view size');
    assert.ok(zoomRules.high.cellsX>=15.99 && zoomRules.high.cellsY>=8.99,'closest view shows at least 16 by 9 cells');
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
      const occupied=new Set(worldMines().map(m=>cellIndex(m.x)+','+cellIndex(m.y)));
      const home=myCastlePos(),homeKey=cellIndex(home.x)+','+cellIndex(home.y);
      for(let cy=0;cy<GRID_COLS;cy++) for(let cx=0;cx<GRID_COLS;cx++){
        const x=(cx+0.5)*GRID_CELL,y=(cy+0.5)*GRID_CELL,key=cx+','+cy;
        if(key!==homeKey&&!occupied.has(key)&&zoneAccessible(zoneOfPos(x,y))&&!inWorldTreeCore(x,y)) return {x,y};
      }
      throw Error('No browser teleport square');
    });
    await signedIn.evaluate(p=>teleportPlace(p.x,p.y),target);
    await signedIn.locator('#_gcYes').click({timeout:5000});
    await signedIn.waitForFunction(p=>G.castleX===p.x&&G.castleY===p.y,target,{timeout:10000});
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
    const realCity=(await request('GET','/api/world/cities',null,raider.token)).cities
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
      userId:botPlayer.profile.id,unlock:['vael','sylthaine','vireo','vex','tallow','grosk'],
      heroKeys:['vael','sylthaine','vireo','vex','tallow','grosk'],px:900000,heroXp:200000
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
      await startMarch('attack',bot,['vael','sylthaine','vireo','vex','tallow','grosk']);
      const m=G.marches.find(x=>x.tId===bot.id&&x.ctype==='attack');
      return m?{id:m.serverCityId,target:bot.id,heroes:m.heroes,extraBusy:committedHeroes().has('grosk')}:null;
    },botPlayer.token);
    assert.ok(botTrip?.id,'signed-in bot trip has a server march receipt');
    assert.deepEqual(botTrip.heroes,['vael','sylthaine','vireo','vex','tallow'],
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
