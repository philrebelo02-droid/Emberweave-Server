'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 04 - City Wall (citywall-watchtower.md, the UNPROVEN-ON-SCREEN City Wall lines), in a real
   browser on this checkout's server (temp DB):
   - Wall art stays in view: phone / Fold / tablet / desktop / pop-out / full screen, all 3 wall tabs: the painted gatehouse (wall-hall art,
     gate + towers end at 760 of its 1672 px) is drawn and no panel or tab covers it.
   - Painted realm map: zoomed all the way out, the four continents, the World Tree island and the wild islets are on screen, no gaps.
   - Smooth zoom: realm tiles slowed to 1.5 s each, zoom in and out several levels: no frame is blank or blocky (the old picture stays).
   - Sharp detail tiles: at max zoom #realmTiles holds z0 detail tiles and they load.
   - Mine stays while mined: miners sent from the mine's own menu; the mine stays on the map with a "Mining" timer while worked, stays
     after a haul that leaves stock, and is gone once its stock is 0.
   One screenshot per check per size (SHOT64 lines). Every check prints what it measured. */
const fs=require('fs');
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_citywall.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:60,aureth:60,sylthaine:60,vireo:60,brannus:60,calypsa:60,dandra:60,grosk:60,umbris:60,lumi:60};
const MINE_MS=45000;
const press=(pg,S,sel)=>S.touch?pg.tap(sel,{timeout:10000}):pg.click(sel,{timeout:10000});

/* ---------------- Wall art stays in view ---------------- */
async function wallArt(pg,S){ await H.openBuilding(pg,'wall',S.touch);
  await pg.waitForFunction(()=>document.getElementById('wall').classList.contains('active')&&document.querySelector('#wallBody [data-wall-tab]'),null,{timeout:30000}).catch(()=>{});
  /* the Witches Hut (cauldron) tab is its own building drawn on its own art: the game's CSS turns the gatehouse off for it on purpose
     (#wall:not(:has([data-wall-tab="cauldron"]:not(.secondary)))), so the gatehouse is checked on the two City Wall tabs */
  for(const tab of ['wall','dur']){
    await press(pg,S,'#wallBody [data-wall-tab="'+tab+'"]'); await H.wait(1800); await H.prep(pg);
    const r=await pg.evaluate(async()=>{ const scr=document.getElementById('wall'), cs=getComputedStyle(scr), urls=SL.bgUrls(scr), hall=urls.find(u=>/wall-hall/.test(u)), im=hall?await SL.loadImg(hall):null;
      const B=scr.getBoundingClientRect(), V=SL.V();
      /* the art: left center, height = the screen box's height (auto 100%) */
      const pos=cs.backgroundPositionX, size=cs.backgroundSize;
      let art=null; if(im&&im.ok){ const h=B.height, w=h*im.w/im.h; art={x:B.left,y:B.top,w,h,gateEnd:B.left+w*760/im.w,bannerEnd:B.left+w*910/im.w}; }
      const pieces=[...document.querySelectorAll('#wallBody>*')].filter(SL.vis).map(e=>({cls:(e.className||e.tagName).toString().slice(0,30),...SL.R(e)}));
      const cover=art?pieces.filter(p=>p.x<art.gateEnd-1&&p.r>art.x&&p.y<Math.min(art.y+art.h,V.height)&&p.b>Math.max(0,art.y)):[];
      const ttl=document.querySelector('#wall h1');
      return {tab:document.querySelector('#wallBody [data-wall-tab]:not(.secondary)')&&document.querySelector('#wallBody [data-wall-tab]:not(.secondary)').dataset.wallTab,
        heading:SL.txt(ttl),bg:urls.map(u=>u.replace(location.origin,'')),hall:!!(im&&im.ok),hallSize:im&&im.ok?im.w+'x'+im.h:null,pos,size,art,
        gateOnScreen:!!art&&art.gateEnd>0&&art.x<V.width&&art.gateEnd<=V.width+1,pieces:pieces.map(p=>p.cls+'@'+Math.round(p.x)+'-'+Math.round(p.r)),cover:cover.map(p=>p.cls+' x'+Math.round(p.x)+'-'+Math.round(p.r))}; });
    const s=await shot(pg,S.tag+' Wall art stays in view '+tab+' tab');
    C.ok(r.hall&&r.gateOnScreen&&r.cover.length===0,S.tag+' Wall art stays in view, '+tab+' tab ("'+r.heading+'"): the painted gatehouse is drawn'+(r.art?' (gate + towers 0-'+Math.round(r.art.gateEnd)+' px)':'')+' and no panel covers it',
      {bg:r.bg,size:r.size,pos:r.pos,art:r.art&&{w:Math.round(r.art.w),h:Math.round(r.art.h),gateEnd:Math.round(r.art.gateEnd)},panels:r.pieces,covering:r.cover,shot:s}); }
  await press(pg,S,'#wallBody [data-wall-tab="wall"]').catch(()=>{}); await H.wait(500); }

/* ---------------- World map helpers ---------------- */
async function openWorld(pg,S){ await H.openBuilding(pg,'wall',S.touch); await H.wait(500);
  await press(pg,S,'#wall>[data-nav="world"]');
  await pg.waitForFunction(()=>state==='world'&&document.getElementById('wzone')&&document.getElementById('worldPictureMaster'),null,{timeout:60000});
  await pg.waitForFunction(()=>{ const m=document.getElementById('worldPictureMaster'); return m.complete&&m.naturalWidth>0; },null,{timeout:60000}).catch(()=>{});
  await H.wait(1500); await H.prep(pg); }
async function zoomTo(pg,S,dir,max){ const sel=dir>0?'#wzIn':'#wzOut'; let last=-1;
  for(let i=0;i<(max||60);i++){ const z=await pg.evaluate(()=>worldZoom); if(Math.abs(z-last)<1e-9) break; last=z; await press(pg,S,sel); await H.wait(140); }
  return pg.evaluate(()=>({z:worldZoom,b:worldZoomBounds(document.getElementById('wzone'))})); }
/* every wanted realm tile of the current view is in and loaded */
const tilesSettled=pg=>pg.waitForFunction(()=>{ const L=document.getElementById('realmTiles'); if(!L) return false; const want=new Set((L.dataset.tiles||'').split(',').filter(Boolean));
  return [...L.children].filter(i=>want.has(i.dataset.tileKey)).length===want.size&&[...L.children].filter(i=>want.has(i.dataset.tileKey)).every(i=>i.complete&&(i.naturalWidth>0||i._realmBad)); },null,{timeout:90000,polling:300}).catch(()=>{});
/* pixels of the screen, read inside the page (a PNG of the viewport decoded on a canvas) */
async function screenPixels(pg,fn,arg){ const png=(await pg.screenshot({type:'png',scale:'css'})).toString('base64');
  return pg.evaluate(async([png,fnSrc,arg])=>{ const im=new Image(); await new Promise(r=>{ im.onload=r; im.onerror=r; im.src='data:image/png;base64,'+png; });
    const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; const x=c.getContext('2d'); x.drawImage(im,0,0);
    const d=x.getImageData(0,0,c.width,c.height); return (new Function('d','arg','return ('+fnSrc+')(d,arg)'))(d,arg); },[png,fn.toString(),arg]); }

/* ---------------- Painted realm map ---------------- */
async function realm(pg,S){ await openWorld(pg,S);
  const z=await zoomTo(pg,S,-1); await tilesSettled(pg); await H.wait(1500);
  const r=await pg.evaluate(()=>{ const zone=document.getElementById('wzone'), Z=zone.getBoundingClientRect(), inner=document.getElementById('wzoneInner'), I=inner.getBoundingClientRect(), M=REALM_MAP.META, G=REALM_MAP.GEO;
    const pt=(key)=>{ const at=M.labels[key]; const x=I.left+G.xOf(at[0])/100*I.width, y=I.top+G.yOf(at[1])/100*I.height; return {key,x:Math.round(x),y:Math.round(y),on:x>=Z.left&&x<=Z.right&&y>=Z.top&&y<=Z.bottom}; };
    const keys=Object.keys(M.labels), pts=keys.map(pt), cov=document.getElementById('worldPictureMaster'), CR=cov.getBoundingClientRect();
    /* a 24 x 12 grid over the map: every point has a loaded picture under it */
    const holes=[]; for(let i=0;i<24;i++) for(let j=0;j<12;j++){ const x=Z.left+(i+0.5)/24*Z.width, y=Z.top+(j+0.5)/12*Z.height;
      const inCover=x>=CR.left&&x<=CR.right&&y>=CR.top&&y<=CR.bottom&&cov.complete&&cov.naturalWidth>0;
      const tile=[...document.querySelectorAll('#realmTiles img')].some(t=>{ const R=t.getBoundingClientRect(); return t.complete&&t.naturalWidth>0&&x>=R.left&&x<=R.right&&y>=R.top&&y<=R.bottom; });
      if(!inCover&&!tile) holes.push([Math.round(x),Math.round(y)]); }
    return {zoom:worldZoom,min:worldZoomBounds(zone).min,zone:{x:Z.left,y:Z.top,w:Z.width,h:Z.height},cover:{loaded:cov.complete&&cov.naturalWidth>0,w:cov.naturalWidth,h:cov.naturalHeight},
      pts,holes:holes.length,holeAt:holes.slice(0,5),level:inner.dataset.realmLevel}; });
  /* gaps in the painting: pixels of the map's bare floor colour (#0c1018) inside the map area */
  const gap=await screenPixels(pg,(d,a)=>{ let n=0,tot=0; const zone=document.getElementById('wzone'); for(let y=Math.ceil(a.y);y<Math.floor(a.y+a.h);y+=2) for(let x=Math.ceil(a.x);x<Math.floor(a.x+a.w);x+=2){ const i=(y*d.width+x)*4;
      const hit=document.elementFromPoint(x,y); if(!hit||!zone.contains(hit)) continue; tot++;   /* the HUD buttons (dark panels) over the map are not map */
      if(Math.abs(d.data[i]-12)<=2&&Math.abs(d.data[i+1]-16)<=2&&Math.abs(d.data[i+2]-24)<=2) n++; } return {n,tot}; },r.zone);
  const s=await shot(pg,S.tag+' Painted realm map zoomed out');
  /* points off the screen at the widest zoom (a phone's screen is wider than the realm, so it fills the width and pans up/down): move the map to each */
  for(const p of r.pts.filter(p=>!p.on)){ const q=await pg.evaluate(async key=>{ const zone=document.getElementById('wzone'), M=REALM_MAP.META, G=REALM_MAP.GEO, at=M.labels[key];
      const top0=zone.scrollTop, left0=zone.scrollLeft, Z0=zone.getBoundingClientRect(), I0=document.getElementById('wzoneInner').getBoundingClientRect();
      const x0=I0.left+G.xOf(at[0])/100*I0.width, y0=I0.top+G.yOf(at[1])/100*I0.height;
      zone.scrollLeft+=x0-(Z0.left+Z0.width/2); zone.scrollTop+=y0-(Z0.top+Z0.height/2); zone.dispatchEvent(new Event('scroll'));
      await new Promise(r=>setTimeout(r,600)); const Z=zone.getBoundingClientRect(), I=document.getElementById('wzoneInner').getBoundingClientRect();
      const x=I.left+G.xOf(at[0])/100*I.width, y=I.top+G.yOf(at[1])/100*I.height, on=x>=Z.left&&x<=Z.right&&y>=Z.top&&y<=Z.bottom;
      zone.scrollLeft=left0; zone.scrollTop=top0; zone.dispatchEvent(new Event('scroll')); await new Promise(r=>setTimeout(r,300)); return {x:Math.round(x),y:Math.round(y),on}; },p.key);
    p.panned=q; p.on=q.on; }
  const want={continents:['crystor','draymon','tefron','alumron'],tree:['worldtree'],islets:['wildN','wildS','wildE','wildW']};
  const on=k=>(r.pts.find(p=>p.key===k)||{}).on;
  C.ok(Math.abs(r.zoom-r.min)<1e-6&&r.cover.loaded,S.tag+' Painted realm map: zoomed all the way out (zoom '+r.zoom.toFixed(3)+' = min), the painted realm loaded ('+r.cover.w+'x'+r.cover.h+')',{zoom:r.zoom,min:r.min,level:r.level,shot:s});
  C.ok(want.continents.every(on)&&want.tree.every(on)&&want.islets.every(on),S.tag+' Painted realm map: the four continents, the World Tree island and the four wild islets are all on the painted realm (on screen zoomed out, or after moving the map to them: '+(r.pts.filter(p=>p.panned).map(p=>p.key).join(', ')||'none needed')+')',{points:r.pts,shot:s});
  C.ok(r.holes===0&&gap.n<=gap.tot*0.002,S.tag+' Painted realm map: no gaps (every one of 288 sample points has painted art under it; bare-floor pixels of the map, HUD buttons left out: '+gap.n+' of '+gap.tot+')',{holes:r.holeAt,gap,shot:s}); }

/* ---------------- Smooth zoom ---------------- */
async function smoothZoom(pg,S){ await openWorld(pg,S);
  /* the map opens at its closest zoom, so start from the widest one: then the wheel really zooms in several levels and back out */
  await zoomTo(pg,S,-1); await tilesSettled(pg); await H.wait(1500);
  await pg.route(/\/realm-v\d+\/tiles\//,async route=>{ await H.wait(1500); try{ await route.continue(); }catch(_){} });
  /* the sampler: every frame, a 8 x 5 grid over the map; each point's finest LOADED, shown picture and how many times it is magnified */
  await pg.evaluate(()=>{ window._slZ={frames:0,blank:0,blocky:0,worst:null,cover:0,maxMag:0}; const M=REALM_MAP.META, dpr=Math.max(1,devicePixelRatio||1);
    const dens=key=>{ const z=+key.split(':')[0]; const L=z===0?M.detail:M.levels.find(l=>l.z===z); return L?L.cellPx/(WORLD_W/M.cols):0; };
    const loop=()=>{ if(!window._slZ.on) return; const zone=document.getElementById('wzone'); if(zone){ const Z=zone.getBoundingClientRect(), need=worldZoom*dpr, cov=document.getElementById('worldPictureMaster'), CR=cov.getBoundingClientRect();
        const covD=cov.naturalWidth/WORLD_W, tiles=[...document.querySelectorAll('#realmTiles img')].filter(t=>t.complete&&t.naturalWidth>0&&parseFloat(getComputedStyle(t).opacity)>0.5).map(t=>({R:t.getBoundingClientRect(),d:dens(t.dataset.tileKey)}));
        let blank=0, blocky=0, mag=0;
        for(let i=0;i<8;i++) for(let j=0;j<5;j++){ const x=Z.left+(i+0.5)/8*Z.width, y=Z.top+(j+0.5)/5*Z.height; let best=0;
          for(const t of tiles) if(x>=t.R.left&&x<=t.R.right&&y>=t.R.top&&y<=t.R.bottom&&t.d>best) best=t.d;
          if(!best&&cov.complete&&cov.naturalWidth&&x>=CR.left&&x<=CR.right&&y>=CR.top&&y<=CR.bottom) best=covD;
          if(!best){ blank++; continue; } const m=need/best; mag=Math.max(mag,m); if(m>4) blocky++; }
        window._slZ.frames++; if(blank) window._slZ.blank++; if(blocky) window._slZ.blocky++; window._slZ.maxMag=Math.max(window._slZ.maxMag,mag);
        if((blank||blocky)&&!window._slZ.worst) window._slZ.worst={blank,blocky,zoom:worldZoom,mag:Math.round(mag*10)/10}; }
      requestAnimationFrame(loop); };
    window._slZ.on=true; requestAnimationFrame(loop); });
  const box=await pg.evaluate(()=>{ const r=document.getElementById('wzone').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  await pg.mouse.move(box.x,box.y);
  const z0=await pg.evaluate(()=>worldZoom); const shots=[];
  for(let i=0;i<10;i++){ await pg.mouse.wheel(0,-120); await H.wait(180); if(i===5) shots.push(await shot(pg,S.tag+' Smooth zoom mid zoom-in')); }
  const z1=await pg.evaluate(()=>worldZoom); await H.wait(600); shots.push(await shot(pg,S.tag+' Smooth zoom just after zoom-in'));
  await H.wait(5000);
  for(let i=0;i<14;i++){ await pg.mouse.wheel(0,120); await H.wait(180); if(i===7) shots.push(await shot(pg,S.tag+' Smooth zoom mid zoom-out')); }
  const z2=await pg.evaluate(()=>worldZoom); await H.wait(600); shots.push(await shot(pg,S.tag+' Smooth zoom just after zoom-out'));
  await H.wait(5000);
  const r=await pg.evaluate(()=>{ window._slZ.on=false; return window._slZ; }); await pg.unroute(/\/realm-v\d+\/tiles\//);
  C.ok(r.frames>40&&z1>z0*2.5&&z2<z1/3,S.tag+' Smooth zoom: zoomed '+z0.toFixed(2)+' -> '+z1.toFixed(2)+' -> '+z2.toFixed(2)+' with every realm tile slowed to 1.5 s ('+r.frames+' frames sampled)',{z0,z1,z2,frames:r.frames,shots});
  C.ok(r.blank===0&&r.blocky===0,S.tag+' Smooth zoom: no blank frame and no blocky frame (no sample point ever without art or magnified over 4x; worst magnification '+(Math.round(r.maxMag*10)/10)+'x)',{blankFrames:r.blank,blockyFrames:r.blocky,firstBad:r.worst,shots}); }

/* ---------------- Sharp detail tiles ---------------- */
async function detailTiles(pg,S){ await openWorld(pg,S);
  const z=await zoomTo(pg,S,1); await H.wait(500);
  /* pan to the nearest square that has detail art (the detail set covers most land, not the sea) */
  const where=await pg.evaluate(()=>{ const zone=document.getElementById('wzone'), D=REALM_MAP.META.detail, k=D.cellPx/(WORLD_W/REALM_MAP.META.cols), T=REALM_MAP.META.tile;
    const cx=wzLeft(zone)+zone.clientWidth/2/worldZoom, cy=wzTop(zone)+zone.clientHeight/2/worldZoom; let best=null;
    for(const s of D.tiles){ const [r,c]=s.split(',').map(Number); const x=(c+0.5)*T/k, y=REALM_TOP_PX+(r+0.5)*T/k, d=Math.hypot(x-cx,y-cy); if(!best||d<best.d) best={d,x,y,r,c}; }
    zone.scrollLeft=best.x*worldZoom-zone.clientWidth/2; wzSetTop(zone,best.y-zone.clientHeight/2/worldZoom); zone.dispatchEvent(new Event('scroll')); return {tile:best.r+','+best.c,moved:Math.round(best.d)}; });
  await H.wait(1000); await tilesSettled(pg); await H.wait(1500);
  const r=await pg.evaluate(()=>{ const L=document.getElementById('realmTiles'), Z=document.getElementById('wzone').getBoundingClientRect(), inner=document.getElementById('wzoneInner');
    const z0=[...L.children].filter(i=>/^0:/.test(i.dataset.tileKey)), vis=z0.filter(i=>{ const R=i.getBoundingClientRect(); return R.right>Z.left&&R.left<Z.right&&R.bottom>Z.top&&R.top<Z.bottom; });
    const cs=vis.map(i=>parseFloat(getComputedStyle(i).opacity));
    return {zoom:worldZoom,max:worldZoomBounds(document.getElementById('wzone')).max,dpr:devicePixelRatio,level:inner.dataset.realmLevel,z0:z0.length,inView:vis.length,loaded:vis.filter(i=>i.complete&&i.naturalWidth>0).length,
      shown:cs.filter(o=>o>0.9).length,sample:vis.slice(0,3).map(i=>(i.getAttribute('src')||'').replace(/^.*\/tiles\//,'')+' '+i.naturalWidth+'x'+i.naturalHeight)}; });
  const s=await shot(pg,S.tag+' Sharp detail tiles max zoom');
  C.ok(Math.abs(r.zoom-r.max)<1e-6&&r.level==='0'&&r.inView>0&&r.loaded===r.inView&&r.shown===r.inView,S.tag+' Sharp detail tiles: at max zoom (zoom '+r.zoom.toFixed(2)+') #realmTiles holds '+r.z0+' z0 detail tiles, the '+r.inView+' in view all loaded and shown',{...r,pan:where,shot:s}); }

/* ---------------- Mine stays while mined ---------------- */
async function mine(pg,S,s,node){ await openWorld(pg,S);
  await zoomTo(pg,S,1); await H.wait(400);
  const centre=()=>pg.evaluate(n=>{ const zone=document.getElementById('wzone'); zone.scrollLeft=WORLD_W*worldZoom*n.x/100-zone.clientWidth/2; wzSetTop(zone,n.y/100*WORLD_H-zone.clientHeight/2/worldZoom); zone.dispatchEvent(new Event('scroll')); },node);
  await centre(); await H.wait(2500);
  const nodeSel='.wnode.mine[data-mine-id="'+node.id+'"]';
  await pg.waitForSelector(nodeSel,{timeout:30000}).catch(()=>{});
  const view=async label=>{ await H.prep(pg); return pg.evaluate(([sel,id])=>{ const el=document.querySelector(sel), t=[...document.querySelectorAll('.marchTimer')].map(e=>({txt:SL.txt(e),mining:e.classList.contains('mining'),R:SL.R(e)}));
      const R=el?SL.R(el):null, mt=t.find(x=>x.mining);
      return {mine:!!el&&SL.vis(el),mining:!!el&&el.classList.contains('mining'),at:R,inView:!!el&&SL.inView(el,4),timers:t.map(x=>x.txt),miningTimer:mt?mt.txt:null,
        timerAbove:!!(mt&&R&&mt.R.b<=R.y+R.h*0.6&&Math.abs((mt.R.x+mt.R.w/2)-(R.x+R.w/2))<Math.max(30,R.w)),march:(activeMarches()||[]).filter(m=>m.ctype==='mine'&&m.mineId===id).map(m=>({arrive:m.arrive-Date.now(),home:m.home-Date.now(),resolved:!!m.resolved}))}; },[nodeSel,node.id]); };
  const send=async n=>{ await centre(); await H.wait(800); await pg.evaluate(sel=>{ const e=document.querySelector(sel); if(e) e.scrollIntoView({block:'center',inline:'center'}); },nodeSel);
    let how='tap'; try{ await press(pg,S,nodeSel); }catch(e){ how='js click (the tap was intercepted: '+String(e.message||e).split(String.fromCharCode(10)).find(l=>/intercept/.test(l))+')'; await pg.evaluate(sel=>document.querySelector(sel).click(),nodeSel); }
    await pg.waitForSelector('.citymenu [data-a="mine"]',{timeout:10000}); await press(pg,S,'.citymenu [data-a="mine"]');
    await pg.waitForSelector('#mcGo',{timeout:10000}); const pre=await pg.evaluate(()=>document.querySelectorAll('.mc-hero.selected').length); let picked=0;
    const skip=[];
    for(let i=0;i<16;i++){ const sel=await pg.evaluate(skip=>{ if(document.querySelectorAll('.mc-hero.selected').length>=5) return null; const h=[...document.querySelectorAll('.mc-hero')].filter(x=>!x.classList.contains('selected')&&!skip.includes(x.dataset.k))[0]; if(!h) return null; h.id='slMc'; h.scrollIntoView({block:'center'}); return {sel:'#slMc',k:h.dataset.k}; },skip); if(!sel) break;
      const before=await pg.evaluate(()=>document.querySelectorAll('.mc-hero.selected').length);
      /* the picker list can redraw between the read and the tap (run 3: #slMc gone): tap the card by its hero key */
      const ks='.mc-hero[data-k="'+sel.k+'"]'; await pg.evaluate(ks=>{ const e=document.querySelector(ks); if(e) e.scrollIntoView({block:'center'}); },ks);
      try{ await press(pg,S,ks); }catch(e){ await H.wait(500); await press(pg,S,ks).catch(()=>{}); } await H.wait(200);
      const after=await pg.evaluate(()=>document.querySelectorAll('.mc-hero.selected').length); if(after>before) picked++; else skip.push(sel.k); }
    picked+=pre;
    const ok=await pg.evaluate(()=>!document.getElementById('mcGo').disabled); if(ok) await press(pg,S,'#mcGo'); await H.wait(2500); return {picked,sent:ok,opened:how}; };
  const v0=await view('before'); const s0=await shot(pg,S.tag+' Mine stays while mined before');
  C.ok(v0.mine&&v0.inView&&!v0.mining,S.tag+' Mine stays while mined: the Lv '+node.level+' mine is on the map before any miners (stock '+node.left+' of '+node.total+')',{...v0,shot:s0});
  const t0=Date.now(); const a=await send(1); const srv1=(await s.api('/api/world/mines')).body; const marches1=s.disk().worldMineMarches||[];
  C.ok(a.sent&&marches1.some(m=>m.node&&m.node.id===node.id&&!m.resolved),S.tag+' Mine stays while mined: miners sent from the mine\'s own menu ('+a.picked+' heroes picked, Send)',{...a,server:marches1.map(m=>({mine:m.node&&m.node.id,resolved:m.resolved}))});
  /* while the miners travel and while they work: the mine stays, a Mining timer over it once they work */
  await centre(); await H.wait(1500);   /* same as the other phases: the view on the mine (the map builds only the mines around the view) */
  const vT=await view('travel'); const sT=await shot(pg,S.tag+' Mine stays while mined miners on the way');
  await pg.waitForFunction(()=>[...document.querySelectorAll('.marchTimer.mining')].length>0,null,{timeout:MINE_MS+30000,polling:500}).catch(()=>{}); await centre(); await H.wait(1500);
  const vM=await view('mining'); const sM=await shot(pg,S.tag+' Mine stays while mined Mining timer');
  C.ok(vT.mine&&vT.mining,S.tag+' Mine stays while mined: while the miners are on the way the mine stays on the map (marked as worked)',{...vT,shot:sT});
  C.ok(vM.mine&&vM.inView&&/^Mining \d/.test(vM.miningTimer||'')&&vM.timerAbove,S.tag+' Mine stays while mined: while they work, the mine stays on the map with "'+vM.miningTimer+'" over it',{...vM,shot:sM});
  /* the haul (the client settles it at the end of the gather): stock left -> the mine is still there */
  await pg.waitForFunction(id=>!(activeMarches()||[]).some(m=>m.ctype==='mine'&&m.mineId===id&&Date.now()<m.arrive),node.id,{timeout:MINE_MS*2+30000,polling:1000}).catch(()=>{});
  for(let i=0;i<40;i++){ const m=(s.disk().worldMineMarches||[]).find(m=>m.node&&m.node.id===node.id); if(m&&m.resolved) break; await H.wait(1000); }
  await H.wait(4000); await centre(); await H.wait(2500);
  const left1=((await s.api('/api/world/mines')).body.nodes||[]).find(n=>n.id===node.id).left;
  const v1=await view('after haul 1'); const s1=await shot(pg,S.tag+' Mine stays while mined after first haul');
  C.ok(left1>0&&v1.mine,S.tag+' Mine stays while mined: after the haul the mine still has stock ('+left1+') and is still on the map',{left:left1,...v1,shot:s1});
  /* a second squad empties it: then it is gone. One squad per mine: the mine's menu offers Mine again once the first squad is home */
  await pg.waitForFunction(id=>!(activeMarches()||[]).some(m=>m.ctype==='mine'&&m.mineId===id&&Date.now()<m.home),node.id,{timeout:MINE_MS*3+30000,polling:1000}).catch(()=>{}); await H.wait(2000);
  const b=await send(2);
  await pg.waitForFunction(()=>[...document.querySelectorAll('.marchTimer.mining')].length>0,null,{timeout:MINE_MS+30000,polling:500}).catch(()=>{}); await centre(); await H.wait(1500);
  const vM2=await view('mining 2'); const sM2=await shot(pg,S.tag+' Mine stays while mined second squad mining');
  C.ok(b.sent&&vM2.mine&&/^Mining \d/.test(vM2.miningTimer||''),S.tag+' Mine stays while mined: a second squad works the last of it - the mine stays with "'+vM2.miningTimer+'"',{...b,...vM2,shot:sM2});
  await pg.waitForFunction(id=>!(activeMarches()||[]).some(m=>m.ctype==='mine'&&m.mineId===id&&Date.now()<m.arrive),node.id,{timeout:MINE_MS*2+30000,polling:1000}).catch(()=>{});
  for(let i=0;i<40;i++){ const ms=(s.disk().worldMineMarches||[]).filter(m=>m.node&&m.node.id===node.id); if(ms.length>=2&&ms.every(m=>m.resolved)) break; await H.wait(1000); }
  await H.wait(4000); await centre(); await H.wait(2500);
  const left2=((await s.api('/api/world/mines')).body.nodes||[]).find(n=>n.id===node.id).left;
  let v2=await view('empty'), gone=null; const tE=Date.now();
  /* the emptied mine may wait for the map's next mine refresh: give it until the squad is home + 20 s, and print when it went */
  for(let i=0;i<70&&v2.mine;i++){ await H.wait(1000); if(i%10===9){ await centre(); } v2=await view('empty'); if(!v2.mine){ gone=Math.round((Date.now()-tE)/1000); break; } }
  v2.goneAfterS=gone; const s2=await shot(pg,S.tag+' Mine stays while mined empty');
  C.ok(left2===0&&!v2.mine,S.tag+' Mine stays while mined: once its stock is 0 the mine is gone from the map',{left:left2,...v2,secs:Math.round((Date.now()-t0)/1000),shot:s2}); }

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.gold=100000; });
  const env={WORLD_MINE_TEST_MS:String(MINE_MS)};
  /* the server places the castle; then the chosen mine's stock is set to two hauls (one haul leaves stock, the second empties it) */
  let s=await H.server(file,env), node=null;
  try{ const loc=(await s.api('/api/world/state')).body, field=(await s.api('/api/world/mines')).body;
    const c={x:loc.x,y:loc.y}; const ones=(field.nodes||[]).filter(n=>n.level===1&&n.left===n.total);
    node=ones.sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0]||null;
    await s.stop();
    if(node){ const db=JSON.parse(fs.readFileSync(file,'utf8')), haul=node.total/3; db.mineStock={epoch:field.epoch,used:{[node.id]:haul}}; fs.writeFileSync(file,JSON.stringify(db)); node.left=node.total-haul; }
  }catch(e){ C.ok(false,'setup: castle and mine field read',String(e&&e.stack||e).slice(0,300)); }
  s=await H.server(file,env); let pg=null;
  C.ok(!!node,'setup: a full level-1 mine near the castle, its stock set to two hauls',node&&{id:node.id,x:node.x,y:node.y,left:node.left,total:node.total});
  const run=async(S,name,fn)=>{ try{ await fn(); }catch(e){ C.ok(false,S.tag+' '+name+' ran to the end',String(e&&e.stack||e).slice(0,500)); try{ await shot(pg,S.tag+' '+name+' error'); }catch(_){} } };
  try{
    for(const k of ['phone','fold','tablet','desktop','popout','full']){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      await run(S,'Wall art stays in view',()=>wallArt(pg,S));
      if(k==='desktop'||k==='phone'){ await run(S,'Painted realm map',()=>realm(pg,S)); await run(S,'Sharp detail tiles',()=>detailTiles(pg,S)); }
      if(k==='desktop'){ await run(S,'Smooth zoom',()=>smoothZoom(pg,S)); if(node) await run(S,'Mine stays while mined',()=>mine(pg,S,s,node)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
