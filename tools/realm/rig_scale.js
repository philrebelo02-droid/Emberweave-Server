// Realm map SCALE set (Phil 30 Oct 2026: "I want to see in game if the tiles are too small or too big in scale of the map"):
// phone landscape 844x390 at DPR 3 in the real client, default zoom and max zoom-in, labelled with the grid size, CSS and device
// px per square on screen and the castle's height on screen. Optional simulated grids (--sim 400,600): the grid lines and
// castle sprites drawn at that grid's square size over the same art (the game's grid stays 220).
//   NODE_PATH=<repo>/node_modules node tools/realm/rig_scale.js <base url> <token> <out dir> [--sim 400,600]
'use strict';
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const [base,token,out]=process.argv.slice(2);
const simArg=process.argv.indexOf('--sim'), sims=simArg>0?process.argv[simArg+1].split(',').map(Number):[];
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:3});
  await ctx.addInitScript(t=>{try{localStorage.setItem('ew_acc',JSON.stringify({token:t,name:'RealmTest',created:Date.now()}));}catch(e){}},token);
  const page=await ctx.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/play',{waitUntil:'load'}); await page.waitForTimeout(2500);
  for(const name of ['Skip Tutorial','Click to Play']){const b=page.getByRole('button',{name});if(await b.count())await b.first().click().catch(()=>{});await page.waitForTimeout(800);}
  await page.evaluate(()=>{document.body.classList.remove('gated');show('world');});
  await page.waitForSelector('#wzoneClip',{timeout:20000}); await page.waitForTimeout(1500);
  const settle=async()=>{await page.evaluate(()=>applyMapLOD());await page.waitForTimeout(400);
    await page.waitForFunction(()=>[...document.querySelectorAll('#realmTiles img,.wnode img')].every(i=>i.complete),null,{timeout:30000}).catch(()=>{});await page.waitForTimeout(700);};
  const view=async(zoom,cx,cy)=>{await page.evaluate(([zoom,cx,cy])=>{const z=document.getElementById('wzone');const b=worldZoomBounds(z);
      worldZoom=zoom==='min'?b.min:zoom==='max'?b.max:Math.max(b.min,Math.min(b.max,zoom));applyWorldZoom();
      z.scrollLeft=cx/100*WORLD_W*worldZoom-z.clientWidth/2;wzSetTop(z,cy/100*WORLD_H-z.clientHeight/2/worldZoom);applyMapLOD();},[zoom,cx,cy]);await settle();};
  const label=async(text)=>page.evaluate(text=>{let el=document.getElementById('scaleLabel');if(!el){el=document.createElement('div');el.id='scaleLabel';
      el.style.cssText='position:absolute;left:6px;top:6px;z-index:50;background:rgba(8,12,20,.82);color:#fff;font:700 11px/1.35 system-ui;padding:5px 7px;border-radius:6px;pointer-events:none;white-space:pre';
      document.getElementById('wzone').parentNode.appendChild(el);}el.textContent=text;},text);
  const measure=()=>page.evaluate(()=>{const z=document.getElementById('wzone');const sq=WORLD_W/GRID_COLS*worldZoom;
      const c=document.querySelector('.wnode.city:not(.me) .castle-spr')||document.querySelector('.wnode.city .castle-spr');const ch=c?c.getBoundingClientRect().height:0;
      return {zoom:+worldZoom.toFixed(4),sqCss:+sq.toFixed(1),sqDev:+(sq*devicePixelRatio).toFixed(0),across:+(z.clientWidth/sq).toFixed(1),down:+(z.clientHeight/sq).toFixed(1),
        castleCss:+ch.toFixed(0),castleSquares:+(ch/sq).toFixed(2),realmLevel:document.getElementById('wzoneInner').dataset.realmLevel};});
  const rows=[];
  const shot=async(name,title,zoom,cx,cy,sim)=>{
    await view(zoom,cx,cy);
    await page.evaluate(sim=>{let st=document.getElementById('simGrid');if(st)st.remove();if(!sim)return;st=document.createElement('style');st.id='simGrid';
      st.textContent='.wmGridOverlay{background-size:'+(100/sim)+'% '+(100/sim)+'% !important}.wnode.city .castle-spr{height:'+(44*220/sim).toFixed(1)+'px !important}';document.head.appendChild(st);},sim||0);
    await page.waitForTimeout(300);
    const m=await measure(); const g=sim||220, sq=sim?+(WORLD_SQ(m.sqCss,sim)).toFixed(1):m.sqCss;
    const castle=m.castleCss;   // measured on screen (the simulated sprite size is already applied)
    await label(title+'\ngrid '+g+' x '+Math.round(g*0.596)+' (realm width '+g+' squares)'+(sim?'  SIMULATED - the game is 220':'')
      +'\n1 square = '+sq+' CSS px = '+Math.round(sq*3)+' device px (DPR 3)\nscreen shows '+(m.across*(sim?sim/220:1)).toFixed(1)+' x '+(m.down*(sim?sim/220:1)).toFixed(1)+' squares\ncastle '+castle+' CSS px tall = '+(castle/sq).toFixed(2)+' squares   art level z'+m.realmLevel);
    const f=path.join(out,name+'.png'); await page.screenshot({path:f}); rows.push({name,title,sim:sim||null,...m});
  };
  function WORLD_SQ(sqCss,sim){return sqCss*220/sim;}
  const info=await page.evaluate(()=>{const me=myCastlePos();const R=REALM_MAP.META;
    const city=R.cities.find(c=>c.name==='Ashford')||R.cities[0];
    const mines=worldMines().filter(m=>/^wild/.test(m.region));
    return {me,city:{name:city.name,x:(city.cx)*100/220,y:(city.cy)*100/220},wildMine:mines[0]?{x:mines[0].x,y:mines[0].y,region:mines[0].region,level:mines[0].level}:null,
      region:myRegion()};});
  // (b) put the test castle beside a city in its own region: the server's targeted teleport (free once a day) onto the nearest open land
  const near=await page.evaluate(async()=>{const R=REALM_MAP.META,reg=myRegion();const cities=R.cities.filter(c=>REALM_MAP.landZone(Math.floor(c.cx),Math.floor(c.cy))===reg);
    if(!cities.length)return null;const c=cities[0];const occ=occupiedCells();let best=null;
    for(const [x,y] of REALM_MAP.zoneCells(reg)){if(occ.has(x+','+y))continue;const d=Math.hypot(x+0.5-c.cx,y+0.5-c.cy);if(d>4&&(!best||d<best.d))best={x,y,d};}
    if(!best)return null;const r=await api('/api/world/relocate','POST',{kind:'targeted',x:(best.x+0.5)*GRID_CELL,y:(best.y+0.5)*GRID_CELL,requestId:uid8()});
    if(r&&r.ok){adoptWorldLocation(r);renderWorldMap(true);}return {city:c.name,cx:c.cx,cy:c.cy,ok:!!(r&&r.ok),error:r&&r.error,at:[best.x,best.y]};});
  await page.waitForTimeout(1500);
  const me=await page.evaluate(()=>myCastlePos());
  await shot('scale-a-region-default','(a) home region '+info.region+', castles + grid, DEFAULT zoom',0.62,me.x,me.y);
  await shot('scale-a-region-max','(a) home region '+info.region+', castles + grid, MAX zoom-in','max',me.x,me.y);
  if(near&&near.ok){const cx=(near.cx/220*100+me.x)/2,cy=(near.cy/220*100+me.y)/2;
    await shot('scale-b-castle-city-default','(b) your castle beside '+near.city+' (city overlay), DEFAULT zoom',0.62,cx,cy);
    await shot('scale-b-castle-city-max','(b) your castle beside '+near.city+' (city overlay), MAX zoom-in','max',cx,cy);}
  if(info.wildMine){await shot('scale-c-islet-mine-default','(c) an islet (the wild) with a level '+info.wildMine.level+' mine, DEFAULT zoom',0.62,info.wildMine.x,info.wildMine.y);
    await shot('scale-c-islet-mine-max','(c) an islet (the wild) with a level '+info.wildMine.level+' mine, MAX zoom-in','max',info.wildMine.x,info.wildMine.y);}
  await shot('scale-d-whole-realm-min','(d) the whole realm, MIN zoom','min',50,50);
  for(const sim of sims){await shot('scale-a-region-default-sim'+sim,'(a) home region '+info.region+', DEFAULT zoom',0.62,me.x,me.y,sim);
    await shot('scale-a-region-max-sim'+sim,'(a) home region '+info.region+', MAX zoom-in','max',me.x,me.y,sim);}
  fs.writeFileSync(path.join(out,'scale.json'),JSON.stringify({info,near,rows,errors},null,1));
  console.log(JSON.stringify({near,rows:rows.map(r=>[r.name,r.sqCss,r.across,r.down,r.castleCss]),errors}));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
