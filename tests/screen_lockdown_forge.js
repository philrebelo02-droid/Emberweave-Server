'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 12 - Forge (forge-academy-pool.md, UNPROVEN-ON-SCREEN):
   - Forge screen: painted forge hall behind, the painted title art in place (no text title), Forge Dust and Resonance shown in a readable banner.
   Opened from its town plate at phone, tablet, desktop, pop-out and full screen. One screenshot per size (SHOT64 lines).
   Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_forge.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:30,aureth:30,sylthaine:30,vireo:30,brannus:30};

async function check(pg,S){
  const how=await H.openBuilding(pg,'forge',S.touch);
  await pg.waitForFunction(()=>document.getElementById('forge').classList.contains('active')&&document.querySelector('#forge .fgResLine'),null,{timeout:40000}).catch(()=>{});
  await H.wait(1500); await H.prep(pg);
  const r=await pg.evaluate(async()=>{ const scr=document.getElementById('forge'), h1=scr.querySelector('h1'), cs=getComputedStyle(h1);
    const title=await SL.bgLoaded(h1), hall=await SL.bgLoaded(scr);
    const res=scr.querySelector('.fgResLine'), pill=res&&res.parentElement.querySelector('.pill'), banner=res&&res.closest('.panel');
    const rr=res?SL.R(res):null, pr=pill?SL.R(pill):null, br=banner?SL.R(banner):null, tr=SL.R(h1);
    return {active:scr.classList.contains('active'),
      title:title.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),titleOk:title.some(x=>x.ok&&/forge-title/.test(x.url))&&title.every(x=>x.ok),
      titleFont:cs.fontSize,titleBox:tr,titleOn:SL.inView(h1),titleFront:SL.front(h1,.5,.5),titleOverBanner:SL.overlap(tr,br),
      hall:hall.map(x=>x.url.replace(location.origin,'').slice(0,80)+(x.ok?' ok':' NOT LOADED')),hallOk:hall.some(x=>x.ok&&/forge/.test(x.url)),
      res:res?SL.txt(res):null,resBox:rr,resOn:res?SL.inView(res):false,resFront:res?SL.front(res,.25,.5):false,resCut:res?res.scrollWidth>res.clientWidth+1:null,resFont:res?parseFloat(getComputedStyle(res).fontSize):0,
      dust:pill?SL.txt(pill):null,dustBox:pr,dustOn:pill?SL.inView(pill):false,dustFront:pill?SL.front(pill):false,dustFont:pill?parseFloat(getComputedStyle(pill).fontSize):0,
      banner:br,wantDust:FORGE.st&&FORGE.st.dust,wantRank:FORGE.st&&FORGE.st.resonance&&FORGE.st.resonance.rank}; });
  const s=await shot(pg,S.tag+' forge');
  C.ok(r.active&&r.hallOk,S.tag+' Forge screen: the painted forge hall is behind the screen (art loaded) [opened by '+how+']',{hall:r.hall,shot:s});
  C.ok(r.titleOk&&parseFloat(r.titleFont)===0&&r.titleOn&&r.titleFront&&!r.titleOverBanner&&r.titleBox.w>40&&r.titleBox.h>20,S.tag+' Forge screen: the painted FORGE title art is in place, on screen, not covered, not under the banner, no text title (font size 0)',
    {title:r.title,box:r.titleBox,font:r.titleFont,front:r.titleFront,overBanner:r.titleOverBanner,banner:r.banner,shot:s});
  C.ok(!!r.res&&/\d/.test(r.res)&&r.resOn&&r.resFront&&r.resCut===false&&r.resFont>=10,S.tag+' Forge screen: the Resonance line is readable in the banner (on screen, not covered, not cut off, '+r.resFont+' px)',
    {text:r.res,box:r.resBox,cut:r.resCut,rank:r.wantRank,shot:s});
  C.ok(!!r.dust&&r.dust.includes(String(r.wantDust==null?'':r.wantDust))&&r.dustOn&&r.dustFront&&r.dustFont>=10,S.tag+' Forge screen: the Forge Dust pill is readable in the banner (on screen, not covered, shows the server\'s '+r.wantDust+' dust)',
    {text:r.dust,box:r.dustBox,font:r.dustFont,shot:s});
}

(async()=>{
  const {file}=H.seedDB(HEROES); const s=await H.server(file); let pg=null;
  try{
    for(const k of ['phone','tablet','desktop','popout','full']){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      try{ await check(pg,S); }catch(e){ C.ok(false,S.tag+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
