// Every city overlay of the realm, in game (phone landscape 844x390, DPR 3), at the default zoom.
//   NODE_PATH=<repo>/node_modules node tools/realm/rig_cities.js <base url> <token> <out dir> [zoom=0.62]
'use strict';
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const [base,token,out,zoomArg]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:3});
  await ctx.addInitScript(t=>{try{localStorage.setItem('ew_acc',JSON.stringify({token:t,name:'RealmTest',created:Date.now()}));}catch(e){}},token);
  const p=await ctx.newPage();await p.goto(base+'/play');await p.waitForTimeout(2500);
  for(const name of ['Skip Tutorial','Click to Play']){const x=p.getByRole('button',{name});if(await x.count())await x.first().click().catch(()=>{});await p.waitForTimeout(700);}
  await p.evaluate(()=>{document.body.classList.remove('gated');show('world');});await p.waitForSelector('#wzoneClip');await p.waitForTimeout(1500);
  const cities=await p.evaluate(()=>REALM_MAP.META.cities.map(c=>({name:c.name,x:REALM_MAP.GEO.xOf(c.cx),y:REALM_MAP.GEO.yOf(c.cy)})));
  for(const c of cities){
    await p.evaluate(([x,y,z])=>{const zone=document.getElementById('wzone');const bd=worldZoomBounds(zone);worldZoom=Math.max(bd.min,Math.min(bd.max,z));applyWorldZoom();
      zone.scrollLeft=x/100*WORLD_W*worldZoom-zone.clientWidth/2;wzSetTop(zone,y/100*WORLD_H-zone.clientHeight/2/worldZoom);applyMapLOD();},[c.x,c.y,+(zoomArg||0.62)]);
    await p.waitForTimeout(500);await p.waitForFunction(()=>[...document.querySelectorAll('#realmTiles img')].every(i=>i.complete),null,{timeout:30000}).catch(()=>{});await p.waitForTimeout(800);
    await p.locator('#wzone').screenshot({path:path.join(out,'city-'+c.name.replace(/\s+/g,'-')+'.png')});
  }
  console.log(cities.map(c=>c.name).join(', '));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
