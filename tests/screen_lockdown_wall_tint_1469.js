'use strict';
/* Lockdown checklist 25 Nov 2026 (01 - EVERY FEATURE IN THE GAME.md), v1469 screen check - City Wall "Tap mode tint" (v1457), in a real
   browser on this checkout's server (temp DB), at phone 844x390 (touch) and desktop 1280x720. The World Map opened from the City Wall;
   Teleport > targeted teleport (the free daily one) puts the map in tap mode. Then:
   - #teleVeil's own pixels: green (TELE_TINT_OK) at an own-region land cell, red (TELE_TINT_NO) at a land cell of another region;
   - on screen: with the veil the own-region land turns greener and the other region redder than without it (screen pixels both ways);
   - a tap on the red region drops the refusal pin where it was tapped, and nothing teleports (no confirm, the castle stays).
   STEP lines mark every phase; every wait is capped; a 12-minute watchdog. */
const H=require('./helpers/screens-lockdown.js');
const {rig,press,tapEl,tapAt}=require('./helpers/lockdown-1469.js');
const TEST='screen_lockdown_wall_tint_1469.js', R=rig(TEST,{limitMin:12}), {C,shot,step,waitFor}=R;
const SIZES=[H.SIZES.phone,H.SIZES.desktop];
const HEROES={vael:60,aureth:60,sylthaine:60,vireo:60,brannus:60,calypsa:60,dandra:60,grosk:60,umbris:60,lumi:60};

async function openWorld(pg,S){ await R.cap(H.openBuilding(pg,'wall',S.touch),60000,'opening the City Wall'); await H.wait(500);
  await press(pg,S,'#wall>[data-nav="world"]');
  await waitFor(pg,()=>state==='world'&&document.getElementById('wzone')&&document.getElementById('worldPictureMaster'),null,60000,'the World Map');
  await H.wait(2500); await H.prep(pg); }
async function screenAvg(pg,x,y){ const png=(await pg.screenshot({type:'png',scale:'css',timeout:30000})).toString('base64');
  return pg.evaluate(async([png,x,y])=>{ const im=new Image(); await new Promise(r=>{ im.onload=r; im.onerror=r; im.src='data:image/png;base64,'+png; });
    const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; const g=c.getContext('2d'); g.drawImage(im,0,0);
    const d=g.getImageData(Math.max(0,Math.round(x)-3),Math.max(0,Math.round(y)-3),7,7).data; let r=0,gg=0,b=0; for(let i=0;i<d.length;i+=4){ r+=d[i]; gg+=d[i+1]; b+=d[i+2]; } const n=d.length/4; return [Math.round(r/n),Math.round(gg/n),Math.round(b/n)]; },[png,x,y]); }

async function teleTint(pg,S){
  step(S.tag+' check: Tap mode tint (veil pixels)');
  await openWorld(pg,S);
  await press(pg,S,'#wbTele'); await waitFor(pg,()=>!!document.getElementById('tpTargeted'),null,10000,'the teleport choices');
  await press(pg,S,'#tpTargeted');
  await waitFor(pg,()=>!!document.getElementById('teleVeil'),null,15000,'#teleVeil (teleport tap mode)'); await H.wait(1500); await H.prep(pg);
  const r=await pg.evaluate(()=>{ const cv=document.getElementById('teleVeil'); if(!cv) return {veil:false,teleMode:_teleMode,total:teleportTotal(),confirm:!!document.getElementById('_gcYes')};
    const g=cv.getContext('2d'), mine=myRegion(), Y0=REALM_MAP.GEO.Y0, me=document.querySelector('#wzoneInner .wnode.city.me');
    const cxM=Math.floor(parseFloat(me.style.left)/100*GRID_COLS), cyM=Math.floor((parseFloat(me.style.top)-Y0)/GRID_CELL);
    const pct=(cx,cy)=>({x:(cx+0.5)/GRID_COLS*100,y:Y0+(cy+0.5)*GRID_CELL});
    const deep=(cx,cy,z)=>{ for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){ const X=cx+dx,Y=cy+dy; if(REALM_MAP.landZone(X,Y)!==z) return false; if(REALM_MAP.isCity(X,Y)||REALM_MAP.isOasis(X,Y)||(REALM_MAP.isTree&&REALM_MAP.isTree(X,Y))) return false; } return true; };
    let own=null, other=null;
    for(let cy=4;cy<GRID_ROWS-4;cy+=3) for(let cx=4;cx<GRID_COLS-4;cx+=3){ const z=REALM_MAP.landZone(cx,cy); if(!z) continue; const d=Math.hypot(cx-cxM,cy-cyM);
      if(z===mine&&d>6&&(!own||d<own.d)&&deep(cx,cy,z)) own={cx,cy,z,d,...pct(cx,cy)};
      if(ZONES[z]&&ZONES[z].type==='region'&&z!==mine&&!zoneAccessible(z)&&(!other||d<other.d)&&deep(cx,cy,z)){ const p=pct(cx,cy); if(teleSquareFree(snapX(p.x),snapY(p.y))) other={cx,cy,z,d,...p}; } }
    const px=c=>c?[...g.getImageData(c.cx,c.cy,1,1).data]:null;
    return {veil:true,teleMode:_teleMode,size:cv.width+'x'+cv.height,open:+cv.dataset.open,veiled:+cv.dataset.veiled,mine,castleCell:[cxM,cyM],own:own&&Object.assign(own,{px:px(own),access:zoneAccessible(own.z)}),other:other&&Object.assign(other,{px:px(other),access:zoneAccessible(other.z)}),tintOk:TELE_TINT_OK,tintNo:TELE_TINT_NO,vis:SL.vis(cv)}; });
  const s1=await shot(pg,S.tag+' Tap mode tint veil');
  const green=p=>!!p&&p[1]>p[0]+60&&p[1]>p[2]+40&&Math.abs(p[3]-Math.round(0.22*255))<=3, red=p=>!!p&&p[0]>p[1]+80&&p[0]>p[2]+80&&Math.abs(p[3]-Math.round(0.30*255))<=3;
  C.ok(r.veil&&r.vis&&!!r.own&&!!r.other&&green(r.own.px)&&red(r.other.px),S.tag+' Tap mode tint: in teleport tap mode #teleVeil ('+r.size+', '+r.open+' green / '+r.veiled+' red land cells) is green at own-region cell '+(r.own&&r.own.cx+','+r.own.cy)+' ('+(r.own&&r.own.z)+' rgba '+(r.own&&r.own.px)+') and red at other-region cell '+(r.other&&r.other.cx+','+r.other.cy)+' ('+(r.other&&r.other.z)+' rgba '+(r.other&&r.other.px)+')',{...r,shot:s1});
  if(!r.veil||!r.own||!r.other) return;
  step(S.tag+' check: Tap mode tint (on screen)');
  const centre=c=>pg.evaluate(c=>{ const zone=document.getElementById('wzone'); zone.scrollLeft=WORLD_W*worldZoom*c.x/100-zone.clientWidth/2; wzSetTop(zone,c.y/100*WORLD_H-zone.clientHeight/2/worldZoom); zone.dispatchEvent(new Event('scroll')); },c);
  const at=c=>pg.evaluate(c=>{ const V=document.getElementById('teleVeil').getBoundingClientRect(); const x=V.left+(c.cx+0.5)/GRID_COLS*V.width, y=V.top+(c.cy+0.5)/GRID_ROWS*V.height;
    const t=document.elementFromPoint(x,y); return {x,y,inZone:!!t&&!!t.closest('#wzone'),hit:t?(t.tagName.toLowerCase()+(t.id?'#'+t.id:'')+(t.className&&typeof t.className==='string'?'.'+t.className.split(' ')[0]:'')):null}; },c);
  const veil=v=>pg.evaluate(v=>{ document.getElementById('teleVeil').style.visibility=v?'':'hidden'; },v);
  const sample=async c=>{ await centre(c); await H.wait(1800); const p=await at(c); const withV=await screenAvg(pg,p.x,p.y); await veil(false); await H.wait(200); const noV=await screenAvg(pg,p.x,p.y); await veil(true); await H.wait(200); return {p,withV,noV}; };
  const so=await sample(r.own), s2=await shot(pg,S.tag+' Tap mode tint own region on screen');
  const sr=await sample(r.other), s3=await shot(pg,S.tag+' Tap mode tint other region on screen');
  const gShift=x=>(x.withV[1]-x.withV[0])-(x.noV[1]-x.noV[0]), rShift=x=>(x.withV[0]-x.withV[1])-(x.noV[0]-x.noV[1]);
  C.ok(so.p.inZone&&sr.p.inZone&&gShift(so)>=8&&rShift(sr)>=8,S.tag+' Tap mode tint: on screen the own-region land turns greener (green-minus-red +'+gShift(so)+') and the other region redder (red-minus-green +'+rShift(sr)+') with the veil',{own:so,other:sr,shots:[s2,s3]});
  step(S.tag+' check: Tap mode tint (refusal pin)');
  const before=await pg.evaluate(()=>({pos:JSON.stringify(myCastlePos())}));
  await tapAt(pg,S,sr.p.x,sr.p.y);
  await waitFor(pg,()=>!!document.getElementById('telePin'),null,5000,'the teleport pin');
  const pin=await pg.evaluate(()=>{ const p=document.getElementById('telePin'); const img=p&&p.querySelector('img');
    return {pin:!!p&&SL.vis(p),icon:img?(img.getAttribute('src')||'').replace(/^.*\//,''):SL.txt(p),box:p?SL.R(p):null,banner:SL.txt('#banner'),confirm:!!document.getElementById('_gcYes'),pos:JSON.stringify(myCastlePos())}; });
  const s4=await shot(pg,S.tag+' Tap mode tint refusal pin');
  const near=!!pin.box&&Math.hypot(pin.box.x+pin.box.w/2-sr.p.x,pin.box.y+pin.box.h/2-sr.p.y)<Math.max(40,pin.box.w*2);
  C.ok(pin.pin&&/blocked/.test(pin.icon)&&near&&!pin.confirm&&pin.pos===before.pos,S.tag+' Tap mode tint: a tap on the red region ('+r.other.z+') drops the refusal pin ('+pin.icon+') where it was tapped, no teleport asked or made ("'+pin.banner+'")',{tap:sr.p,pin,before,shot:s4});
  await tapEl(pg,S,'#wbTele'); await H.wait(800); }

(async()=>{
  let pg=null, s=null;
  try{
    step('setup: seed DB + server');
    const {file}=H.seedDB(HEROES,u=>{ u.led.gold=100000; u.led.gems=5000; });
    s=await R.server(file);
    await R.api(s,'/api/world/state');   /* the server places the castle */
    for(const S of SIZES){ step(S.tag+': game load');
      try{ pg=await R.game(s.port,S); await teleTint(pg,S); }
      catch(e){ C.ok(false,S.tag+' Tap mode tint ran to the end',String(e&&e.stack||e).slice(0,600)); try{ if(pg) await shot(pg,S.tag+' Tap mode tint error'); }catch(_){} }
      if(pg){ C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3)); await R.closeCtx(pg); pg=null; }
      await R.cap(H.closeBrowser(),20000,'closing the browser').catch(()=>{}); }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) await R.closeCtx(pg); await R.stop(s); await R.finish(); }
})();
