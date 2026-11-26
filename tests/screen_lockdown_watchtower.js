'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 05 - Watch Tower (citywall-watchtower.md, UNPROVEN-ON-SCREEN):
   - Watch Tower screen: the painted title art and the gold frame render (no fallback) on every size.
   Opened from its town plate, at desktop, pop-out, full screen, tablet, Fold cover and phone. One screenshot per size (SHOT64 lines).
   Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_watchtower.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:30,aureth:30,sylthaine:30,vireo:30,brannus:30};

async function check(pg,S){
  const how=await H.openBuilding(pg,'watchtower',S.touch);
  await pg.waitForFunction(()=>document.getElementById('watchtower').classList.contains('active')&&document.querySelector('#watchBody>.panel'),null,{timeout:30000}).catch(()=>{});
  await H.wait(1200); await H.prep(pg);
  const r=await pg.evaluate(async()=>{ const scr=document.getElementById('watchtower'), h1=scr.querySelector('h1'), cs=getComputedStyle(h1);
    const title=await SL.bgLoaded(h1), hall=await SL.bgLoaded(scr);
    const panels=[...document.querySelectorAll('#watchBody>.panel')], p=panels[0], pcs=p?getComputedStyle(p):null;
    const frameUrl=pcs?((pcs.borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1]:null, frame=frameUrl?await SL.loadImg(frameUrl):null;
    return {active:scr.classList.contains('active'),title:title.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),titleOk:title.length>0&&title.every(x=>x.ok)&&title.some(x=>/watch-tower-title/.test(x.url)),
      titleText:{fontSize:cs.fontSize,color:cs.webkitTextFillColor||cs.color},titleBox:SL.R(h1),titleOn:SL.inView(h1),titleFront:SL.front(h1),
      hallOk:hall.some(x=>x.ok&&/watch-hall/.test(x.url)),panels:panels.length,frame:frameUrl?frameUrl.replace(location.origin,''):null,frameOk:!!(frame&&frame.ok),frameWidth:pcs?pcs.borderImageWidth:null,
      panelBox:p?SL.R(p):null,panelOn:p?SL.inView(p):false,tabs:[...document.querySelectorAll('#watchTabs .btn')].map(b=>SL.inView(b)&&SL.front(b))}; });
  const s=await shot(pg,S.tag+' watch tower');
  C.ok(r.active&&r.titleOk&&r.titleOn&&r.titleFront&&parseFloat(r.titleText.fontSize)===0&&r.titleBox.w>40&&r.titleBox.h>40,S.tag+' Watch Tower screen: the painted WATCH TOWER title art is loaded and on screen, no text title (font size 0) [opened by '+how+']',
    {title:r.title,box:r.titleBox,text:r.titleText,shot:s});
  C.ok(r.panels>0&&r.frameOk&&/guild-ornate-panel/.test(r.frame||'')&&r.panelOn,S.tag+' Watch Tower screen: the gold frame (guild-ornate-panel border art) is loaded and the framed panel is on screen',
    {frame:r.frame,width:r.frameWidth,panel:r.panelBox,panels:r.panels,hall:r.hallOk,tabs:r.tabs,shot:s});
}

(async()=>{
  const {file}=H.seedDB(HEROES); const s=await H.server(file); let pg=null;
  try{
    for(const k of ['desktop','popout','full','tablet','fold','phone']){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      try{ await check(pg,S); }catch(e){ C.ok(false,S.tag+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
