'use strict';
/* Lockdown audit 25 Nov 2026, round 2 (the UNPROVEN-ON-SCREEN lines of the building audits): extra tools on top of the screens-1450 rig.
   - SIZES: the screen sizes the checks use (desktop, pop-out = a small desktop window, full screen = 1920x1080, tablet, Fold cover, phone).
   - shot(): a JPEG of the page (CSS pixels) for every check, saved under <tmp>/ew-screens-lockdown/<test>/ AND printed as one
     "SHOT64 <test>/<file> <base64>" line, because the cluster slot is wiped after the run: the screenshots come back in the suite log.
   - openBuilding(): opens a building the way a player does, by tapping its name plate on the town map (falls back to show()).
   - page-side helpers (installed with pg.evaluate(H.PAGE_HELPERS) by openBuilding / prep): rectangles, on-screen, covered, loaded art. */
const fs=require('fs'),os=require('os'),path=require('path');
const H=require('./screens-1450.js');

const SIZES={
  desktop:{w:1280,h:720,touch:false,tag:'desktop 1280x720'},
  popout:{w:960,h:540,touch:false,tag:'pop-out 960x540'},
  full:{w:1920,h:1080,touch:false,tag:'full screen 1920x1080'},
  short:{w:1280,h:560,touch:false,tag:'short desktop 1280x560'},
  tablet:{w:1024,h:768,touch:true,tag:'tablet 1024x768'},
  fold:{w:915,h:412,touch:true,tag:'Fold cover 915x412'},
  phone:{w:844,h:390,touch:true,tag:'phone 844x390'},
  phone2:{w:780,h:360,touch:true,tag:'phone 780x360'},
};

function shooter(test){ const dir=path.join(os.tmpdir(),'ew-screens-lockdown',test.replace(/\.js$/,'')); fs.mkdirSync(dir,{recursive:true}); let n=0;
  return async function shot(pg,name,opt){ n++; const file=String(n).padStart(3,'0')+'-'+String(name).replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,90)+'.jpg';
    try{ const buf=await pg.screenshot(Object.assign({type:'jpeg',quality:55,scale:'css',timeout:30000},opt||{}));
      fs.writeFileSync(path.join(dir,file),buf);
      const rel=test.replace(/\.js$/,'')+'/'+file; console.log('SHOT64 '+rel+' '+buf.toString('base64')); return rel; }
    catch(e){ console.log('  (screenshot failed: '+String(e.message||e).slice(0,160)+')'); return null; } }; }

/* page-side helpers: window.SL.* */
const PAGE_HELPERS=()=>{ if(window.SL) return true;
  const V=()=>{ try{ return ewGameView(); }catch(e){ return {width:innerWidth,height:innerHeight}; } };
  const R=el=>{ if(typeof el==='string') el=document.querySelector(el); if(!el) return null; const r=(el.ewGameRect?el.ewGameRect():el.getBoundingClientRect()); return {x:Math.round(r.left*10)/10,y:Math.round(r.top*10)/10,w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10,r:Math.round(r.right*10)/10,b:Math.round(r.bottom*10)/10}; };
  const vis=el=>{ if(typeof el==='string') el=document.querySelector(el); if(!el) return false; const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false; const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
  const inView=(el,slack)=>{ const r=R(el), v=V(); slack=slack==null?1:slack; return !!r&&r.w>0&&r.h>0&&r.x>=-slack&&r.y>=-slack&&r.r<=v.width+slack&&r.b<=v.height+slack; };
  /* the element (or a child) is what a tap at its centre hits (not covered) */
  const front=(el,fx,fy)=>{ if(typeof el==='string') el=document.querySelector(el); if(!el) return false; const r=el.getBoundingClientRect(); const x=r.left+r.width*(fx==null?.5:fx), y=r.top+r.height*(fy==null?.5:fy);
    const t=document.elementFromPoint(x,y); return !!t&&(el===t||el.contains(t)); };
  const whoAt=(el,fx,fy)=>{ if(typeof el==='string') el=document.querySelector(el); if(!el) return null; const r=el.getBoundingClientRect(); const t=document.elementFromPoint(r.left+r.width*(fx==null?.5:fx),r.top+r.height*(fy==null?.5:fy));
    return t?(t.tagName.toLowerCase()+(t.id?'#'+t.id:'')+(t.className&&typeof t.className==='string'?'.'+t.className.trim().split(/\s+/).join('.'):'')).slice(0,80):null; };
  const overlap=(a,b)=>!!a&&!!b&&a.x<b.r-0.5&&b.x<a.r-0.5&&a.y<b.b-0.5&&b.y<a.b-0.5;
  /* background images of an element: url list + whether each one loads */
  const bgUrls=el=>{ if(typeof el==='string') el=document.querySelector(el); if(!el) return []; const s=getComputedStyle(el).backgroundImage||''; return [...s.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1]); };
  const loadImg=u=>new Promise(res=>{ const i=new Image(); i.onload=()=>res({url:u,ok:i.naturalWidth>0,w:i.naturalWidth,h:i.naturalHeight}); i.onerror=()=>res({url:u,ok:false}); i.src=u; setTimeout(()=>res({url:u,ok:false,timeout:true}),20000); });
  const bgLoaded=async el=>{ const us=bgUrls(el); return Promise.all(us.map(loadImg)); };
  const imgOk=async el=>{ if(typeof el==='string') el=document.querySelector(el); if(!el) return {ok:false,why:'missing'}; for(let i=0;i<100&&!el.complete;i++) await new Promise(r=>setTimeout(r,100)); return {ok:el.complete&&el.naturalWidth>0,src:(el.currentSrc||el.src||'').replace(location.origin,''),w:el.naturalWidth,h:el.naturalHeight}; };
  /* any scrollbar on a box (the content does not fit) */
  const scrolls=el=>{ if(typeof el==='string') el=document.querySelector(el); if(!el) return null; return {sh:el.scrollHeight,ch:el.clientHeight,sw:el.scrollWidth,cw:el.clientWidth,y:el.scrollHeight>el.clientHeight+1,x:el.scrollWidth>el.clientWidth+1}; };
  const txt=el=>{ if(typeof el==='string') el=document.querySelector(el); return el?(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim():''; };
  window.SL={V,R,vis,inView,front,whoAt,overlap,bgUrls,bgLoaded,imgOk,loadImg,scrolls,txt}; return true; };

async function prep(pg){ await pg.evaluate(PAGE_HELPERS); }

/* the building the player taps on the town map: nav = the town plate's data-nav (dungeon, arena, well, forge, tech, wishing, market,
   shadymarket, cauldron, rankings, guild, skyisland, wall, watchtower, campaign, temple). Returns how it was opened. */
async function openBuilding(pg,nav,touch){ await prep(pg);
  await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} try{ show('home'); }catch(e){} }); await H.wait(900); await H.clean(pg);
  const sel='#townHots .townlbl[data-nav="'+nav+'"]';
  const r=await pg.evaluate(s=>{ const el=document.querySelector(s); if(!el) return null; el.scrollIntoView({block:'center',inline:'center'}); const b=el.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2,on:b.width>0&&b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight}; },sel);
  let how='plate';
  if(r&&r.on){ try{ if(touch) await pg.tap(sel,{timeout:5000}); else await pg.click(sel,{timeout:5000}); }catch(e){ how='plate-js'; await pg.evaluate(s=>document.querySelector(s).click(),sel); } }
  else { how='show()'; await pg.evaluate(n=>{ if(n==='well') openWell(); else if(n==='cauldron'){ WALL_TAB='cauldron'; show('wall'); } else { if(n==='wall') WALL_TAB='wall'; show(n); } },nav); }
  await H.wait(1500); await H.clean(pg); await prep(pg); return how; }

/* every image under a root (img tags) loaded? */
const imgsUnder=(pg,root)=>pg.evaluate(async root=>{ const ims=[...document.querySelectorAll(root+' img')].filter(i=>SL.vis(i));
  for(let k=0;k<60&&ims.some(i=>!i.complete);k++) await new Promise(r=>setTimeout(r,100));
  return {n:ims.length,bad:ims.filter(i=>!(i.complete&&i.naturalWidth>0)).map(i=>(i.getAttribute('src')||'').slice(0,80))}; },root);

module.exports=Object.assign({},H,{SIZES,shooter,PAGE_HELPERS,prep,openBuilding,imgsUnder});
