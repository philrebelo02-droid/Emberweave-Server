// Realm map look-rig: drives a LOCAL game server (temp DB) in headless Chromium at phone landscape 844x390 and screenshots
// the world map at every zoom, the realm's edges, tile seams and the World Tree's cycle states.
//   NODE_PATH=<repo>/node_modules node tools/realm/rig_shots.js <base url> <token> <out dir> [dpr=3]
// The token is a LOCAL test account (raise led.px in the local DB only, never on a game server).
'use strict';
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const [base,token,out,dprArg]=process.argv.slice(2);
if(!base||!token||!out){console.error('usage: rig_shots.js <base> <token> <out> [dpr]');process.exit(2);}
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:+(dprArg||3)});
  await ctx.addInitScript(t=>{try{localStorage.setItem('ew_acc',JSON.stringify({token:t,name:'RealmTest',created:Date.now()}));}catch(e){}},token);
  const page=await ctx.newPage();
  const logs=[];page.on('console',m=>{if(m.type()==='error')logs.push(m.text());});page.on('pageerror',e=>logs.push('PAGEERROR '+e.message));
  await page.goto(base+'/play',{waitUntil:'load'});
  await page.waitForTimeout(2500);
  for(const name of ['Skip Tutorial','Click to Play']){const b=page.getByRole('button',{name});if(await b.count())await b.first().click().catch(()=>{});await page.waitForTimeout(800);}
  await page.evaluate(()=>{document.body.classList.remove('gated');window.AudioContext=undefined;show('world');});
  await page.waitForSelector('#wzoneClip',{timeout:20000});
  await page.waitForTimeout(1500);
  const settle=async()=>{await page.evaluate(()=>applyMapLOD());
    await page.waitForFunction(()=>[...document.querySelectorAll('#realmTiles img')].every(i=>i.complete)&&document.getElementById('worldPictureMaster').complete,null,{timeout:30000}).catch(()=>{});
    await page.waitForTimeout(900);};
  const view=async(zoom,cx,cy)=>{await page.evaluate(([zoom,cx,cy])=>{const z=document.getElementById('wzone');const b=worldZoomBounds(z);
      worldZoom=zoom==='min'?b.min:zoom==='max'?b.max:Math.max(b.min,Math.min(b.max,zoom));applyWorldZoom();
      z.scrollLeft=cx/100*WORLD_W*worldZoom-z.clientWidth/2;wzSetTop(z,cy/100*WORLD_H-z.clientHeight/2/worldZoom);applyMapLOD();},[zoom,cx,cy]);await settle();};
  const info=async()=>page.evaluate(()=>{const z=document.getElementById('wzone'),i=document.getElementById('wzoneInner');
    return {zoom:+worldZoom.toFixed(4),realmLevel:i.dataset.realmLevel,pictureLevel:i.dataset.pictureLevel,scrollTop:z.scrollTop,scrollLeft:z.scrollLeft,
      maxTop:z.scrollHeight-z.clientHeight,maxLeft:z.scrollWidth-z.clientWidth,tiles:i.querySelectorAll('#realmTiles img').length,
      viewTopPx:wzTop(z),realmTopPx:REALM_TOP_PX,realmBottomPx:REALM_TOP_PX+REALM_H_PX,viewBottomPx:wzTop(z)+z.clientHeight/worldZoom,
      castles:i.querySelectorAll('.wnode.city').length,mines:i.querySelectorAll('.wnode.mine').length};});
  const rows=[];
  const shot=async(name,zoom,cx,cy)=>{await view(zoom,cx,cy);const f=path.join(out,name+'.png');await page.locator('#wzone').screenshot({path:f});rows.push({name,...await info()});};
  const me=await page.evaluate(()=>myCastlePos());
  await shot('01-whole-realm-min-zoom','min',50,50);
  await shot('02-castle-default-zoom',0.62,me.x,me.y);
  await shot('03-castle-mid-zoom',1.2,me.x,me.y);
  await shot('04-castle-max-zoom','max',me.x,me.y);
  await shot('05-tree-island-mid',0.9,50,50);
  await shot('06-tree-island-close','max',50,50);
  await shot('07-edge-top-left-min','min',0,0);
  await shot('08-edge-top-left-max','max',0,0);
  await shot('09-edge-bottom-right-max','max',100,100);
  await shot('10-edge-top-max','max',30,0);
  await shot('11-edge-bottom-max','max',70,100);
  // a tile corner at z1 (4 tiles meet) at max zoom: the seam check
  const seam=await page.evaluate(()=>{const L=REALM_MAP.META.levels[0],k=L.cellPx/50,T=REALM_MAP.META.tile;const x=10*T/k,y=REALM_TOP_PX+8*T/k;return {x:x/WORLD_W*100,y:y/WORLD_H*100};});
  await shot('12-tile-corner-max','max',seam.x,seam.y);
  await shot('13-tile-corner-mid',1.4,seam.x,seam.y);
  // World Tree cycle states: the shared cycle module's own phases, dispatched the way the countdown does
  const FIRST=Date.parse('2026-10-31T12:00:00Z');   // Sat 31 Oct 08:00 New York
  await view(1.6,50,50);
  const states=[['decay-day-01',FIRST-13*86400000+3600000],['decay-day-05',FIRST-9*86400000+3600000],['decay-day-09',FIRST-5*86400000+3600000],['decay-day-13',FIRST-3600000],
    ['event-hour-01',FIRST+1800000],['event-hour-08',FIRST+7*3600000+1800000],['event-hour-16',FIRST+15*3600000+1800000],['event-hour-24',FIRST+24.5*3600000]];
  for(const [name,t] of states){
    const st=await page.evaluate(t=>{const p=EmberweaveWorldTreeCycle.phase(Date.parse('2026-10-31T12:00:00Z'),t);
      document.getElementById('wzoneInner').dispatchEvent(new CustomEvent('world-tree-phase',{detail:p,bubbles:true}));return {phase:p.phase,step:p.step,frame:p.frame};},t);
    await page.waitForFunction(f=>document.getElementById('worldTreeTerrain').dataset.worldTreeFrame===String(f)||f===28,st.frame,{timeout:8000}).catch(()=>{});
    await page.waitForTimeout(500);
    const f=path.join(out,'tree-'+name+'.png');await page.locator('#wzone').screenshot({path:f});rows.push({name:'tree-'+name,...st,...await info()});
  }
  fs.writeFileSync(path.join(out,'shots.json'),JSON.stringify({rows,errors:logs},null,1));
  console.log(JSON.stringify({rows:rows.length,errors:logs.slice(0,10)}));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
