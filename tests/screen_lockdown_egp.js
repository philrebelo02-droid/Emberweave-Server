'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 25 - EGP (market-shady-board-hut-egp.md, UNPROVEN-ON-SCREEN):
   - Fixed card size: walk all 31 levels (EGP 0..15, EDP 1..15) with the arrows: the card size never changes; the header (arrows, level)
     stays put while the body scrolls.
   - Patron art: an EGP page shows the gold phoenix header and the gold patron panel; an EDP page the diamond phoenix and the jewelled
     diamond panel.
   Opened from the EGP badge on the town HUD, at desktop, tablet and phone. One screenshot per check per size (SHOT64 lines). Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_egp.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:30,aureth:30,sylthaine:30,vireo:30,brannus:30};

async function page(pg){ return pg.evaluate(async()=>{ const card=document.querySelector('#patScreen .patCard'), head=card&&card.querySelector('.patHead'); if(!card) return null;
  const lv=SL.txt(card.querySelector('.patLv')), c0=SL.R(card), h0=SL.R(head);
  card.scrollTop=0; await new Promise(r=>setTimeout(r,60)); const hTop0=SL.R(head);
  card.scrollTop=card.scrollHeight; await new Promise(r=>setTimeout(r,120)); const st=card.scrollTop, hTop1=SL.R(head), arws=[...head.querySelectorAll('.patArw:not(.off)')].map(a=>SL.inView(a)&&SL.front(a));
  const lvOn=SL.inView(card.querySelector('.patLv'))&&SL.front(card.querySelector('.patLv'));
  card.scrollTop=0; await new Promise(r=>setTimeout(r,60));
  return {lv,card:{w:c0.w,h:c0.h,x:c0.x,y:c0.y},scrollable:card.scrollHeight>card.clientHeight+1,scrolled:st,headBefore:hTop0.y,headAfter:hTop1.y,headInCard:hTop1.y>=c0.y-1&&hTop1.b<=c0.b+1,arwsOk:arws.every(Boolean),lvOn}; }); }

async function art(pg,edp){ return pg.evaluate(async edp=>{ const card=document.querySelector('#patScreen .patCard'), head=card.querySelector('.patHead');
  const fu=((getComputedStyle(card).borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1], frame=fu?await SL.loadImg(fu):null;
  const hb=edp?((getComputedStyle(head,'::after').backgroundImage||'').match(/url\(["']?([^"')]+)/g)||[]):((getComputedStyle(head).backgroundImage||'').match(/url\(["']?([^"')]+)/g)||[]);
  const hu=hb.map(s=>s.replace(/^url\(["']?/,'')), hl=await Promise.all(hu.map(SL.loadImg));
  return {lv:SL.txt(card.querySelector('.patLv')),frame:fu?fu.replace(location.origin,''):null,frameOk:!!(frame&&frame.ok),head:hl.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),
    headOk:hl.some(x=>x.ok&&(edp?/edp-diamond-phoenix/:/egp-phoenix-header/).test(x.url)),headBox:SL.R(head),headOn:SL.inView(head)}; },edp); }

async function check(pg,S){
  await H.prep(pg); await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} show('home'); }); await H.wait(1200); await H.clean(pg);
  await pg.waitForFunction(()=>{ const b=document.getElementById('patBadge'); return b&&!b.hidden&&b.offsetParent; },null,{timeout:20000}).catch(()=>{});
  const badge=await pg.evaluate(()=>{ const b=document.getElementById('patBadge'); return b?{hidden:b.hidden,text:SL.txt(b),on:SL.inView(b),front:SL.front(b)}:null; });
  let how='EGP badge';
  if(badge&&!badge.hidden&&badge.on){ if(S.touch) await pg.tap('#patBadge'); else await pg.click('#patBadge'); } else { how='openPatron() (badge not on screen)'; await pg.evaluate(()=>openPatron()); }
  await pg.waitForFunction(()=>!!document.querySelector('#patScreen .patCard .patLv'),null,{timeout:20000}).catch(()=>{}); await H.wait(1000); await H.prep(pg);
  C.ok(!!badge&&!badge.hidden&&badge.on&&badge.front&&how==='EGP badge',S.tag+' the EGP badge on the town HUD opens the patron card',{badge,how});
  const pages=[]; const first=await page(pg); if(first) pages.push(first);
  const egpArt=await art(pg,false); const s1=await shot(pg,S.tag+' '+(first&&first.lv)+' page');
  for(let i=0;i<40;i++){ const has=await pg.evaluate(()=>!!document.getElementById('patArwR'));
    if(!has) break;
    if(S.touch) await pg.tap('#patArwR'); else await pg.click('#patArwR');
    await pg.waitForFunction(n=>{ const l=document.querySelector('#patScreen .patLv'); return l&&SL.txt(l)!==n; },pages[pages.length-1].lv,{timeout:8000}).catch(()=>{}); await H.wait(250);
    const p=await page(pg); if(!p) break; pages.push(p);
    if(p.lv==='EDP 1'){ var edpArt=await art(pg,true); var s2=await shot(pg,S.tag+' EDP 1 page'); }
  }
  const s3=await shot(pg,S.tag+' '+(pages.length?pages[pages.length-1].lv:'?')+' page');
  const lvls=pages.map(p=>p.lv), want=[]; for(let i=0;i<=15;i++) want.push('EGP '+i); for(let i=1;i<=15;i++) want.push('EDP '+i);
  const sizes=[...new Set(pages.map(p=>p.card.w+'x'+p.card.h))], pos=[...new Set(pages.map(p=>p.card.x+','+p.card.y))];
  C.ok(JSON.stringify(lvls)===JSON.stringify(want)&&sizes.length===1&&pos.length===1,S.tag+' Fixed card size: all 31 levels walked with the arrows ('+lvls[0]+' .. '+lvls[lvls.length-1]+'), every page the same card size and place ('+sizes.join(' | ')+')',
    {levels:lvls.length,missing:want.filter(x=>!lvls.includes(x)),sizes,pos,shots:[s1,s3]});
  const sc=pages.filter(p=>p.scrollable), moved=sc.filter(p=>Math.abs(p.headAfter-p.headBefore)>8||!p.headInCard||!p.arwsOk||!p.lvOn);
  C.ok(sc.length>0&&sc.every(p=>p.scrolled>0)&&moved.length===0,S.tag+' Fixed card size: the header (arrows, level) stays in place while the body scrolls ('+sc.length+' of '+pages.length+' pages scroll; header moved on '+moved.length+')',
    {moved:moved.map(p=>p.lv+' head '+p.headBefore+' -> '+p.headAfter+(p.arwsOk?'':' arrows hidden')+(p.lvOn?'':' level hidden')),sample:sc.slice(0,3).map(p=>p.lv+' scrolled '+p.scrolled+' head '+p.headBefore+'->'+p.headAfter),shots:[s1,s3]});
  C.ok(egpArt.frameOk&&/egp-patron-panel/.test(egpArt.frame||'')&&egpArt.headOk&&egpArt.headOn&&/^EGP/.test(egpArt.lv),S.tag+' Patron art: the '+egpArt.lv+' page shows the gold phoenix header and the gold patron panel (art loaded, on screen)',{...egpArt,shot:s1});
  C.ok(!!edpArt&&edpArt.frameOk&&/edp-diamond-panel/.test(edpArt.frame||'')&&edpArt.headOk&&edpArt.headOn&&edpArt.lv==='EDP 1',S.tag+' Patron art: the EDP 1 page shows the diamond phoenix and the jewelled diamond panel (art loaded, on screen)',{...(edpArt||{}),shot:s2});
  await pg.evaluate(()=>{ try{ closePatron(); }catch(e){} });
}

(async()=>{
  const {file}=H.seedDB(HEROES); const s=await H.server(file); let pg=null;
  try{
    for(const k of ['desktop','tablet','phone']){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      try{ await check(pg,S); }catch(e){ C.ok(false,S.tag+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
