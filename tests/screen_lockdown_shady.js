'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 03 - Shady Market (market-shady-board-hut-egp.md, UNPROVEN-ON-SCREEN):
   - Shady Market screen: painted hall, title art, subtitle "Premium goods - diamonds only" and the Base button at 3 sizes.
   - Teleport item card art: the Teleport Scrolls row shows its item card picture, not an emoji.
   - Framed cards: phone, Fold, tablet, desktop, pop-out, full screen: rows, prices and holder inside the painted frames.
   Opened from its town plate. One screenshot per check per size (SHOT64 lines). Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_shady.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:30,aureth:30,sylthaine:30,vireo:30,brannus:30};

async function openShady(pg,S){ const how=await H.openBuilding(pg,'shadymarket',S.touch);
  await pg.waitForFunction(()=>document.getElementById('shadymarket').classList.contains('active')&&document.querySelectorAll('#shadyBody .merc-offer').length>0,null,{timeout:40000}).catch(()=>{});
  await H.wait(1500); await H.prep(pg); return how; }

async function screen(pg,S){
  const how=await openShady(pg,S);
  const r=await pg.evaluate(async()=>{ const scr=document.getElementById('shadymarket'), h1=scr.querySelector('h1'), sub=scr.querySelector(':scope>.sub'), back=scr.querySelector(':scope>.backbtn');
    const title=await SL.bgLoaded(h1), hall=await SL.bgLoaded(scr);
    return {hall:hall.map(x=>x.url.replace(location.origin,'').slice(0,80)+(x.ok?' ok':' NOT LOADED')),hallOk:hall.some(x=>x.ok&&/shady-hall/.test(x.url)),
      title:title.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),titleOk:title.some(x=>x.ok&&/shady-wordmark/.test(x.url))&&title.every(x=>x.ok),titleFont:getComputedStyle(h1).fontSize,titleOn:SL.inView(h1),titleFront:SL.front(h1),titleBox:SL.R(h1),
      sub:SL.txt(sub),wantSub:t('shady.screen_sub'),subOn:SL.inView(sub),subFront:SL.front(sub),subBox:SL.R(sub),
      back:SL.txt(back),backOn:SL.inView(back),backFront:SL.front(back),backBox:SL.R(back)}; });
  const s=await shot(pg,S.tag+' shady market');
  C.ok(r.hallOk,S.tag+' Shady Market screen: the painted hall is behind the screen (art loaded) [opened by '+how+']',{hall:r.hall,shot:s});
  C.ok(r.titleOk&&parseFloat(r.titleFont)===0&&r.titleOn&&r.titleFront,S.tag+' Shady Market screen: the painted SHADY MARKET title art is loaded, on screen, not covered (no text title)',{title:r.title,box:r.titleBox,shot:s});
  C.ok(/^Premium goods [—-] diamonds only$/.test(r.sub)&&r.sub===r.wantSub&&r.subOn&&r.subFront,S.tag+' Shady Market screen: the subtitle "'+r.sub+'" is on screen and not covered',{box:r.subBox,shot:s});
  C.ok(/Base/.test(r.back)&&r.backOn&&r.backFront,S.tag+' Shady Market screen: the Base button is on screen and not covered',{text:r.back,box:r.backBox,shot:s});
  /* the Base button works */
  if(S.touch) await pg.tap('#shadymarket>.backbtn'); else await pg.click('#shadymarket>.backbtn');
  await H.wait(1000); const st=await pg.evaluate(()=>state);
  C.ok(st==='home',S.tag+' Shady Market screen: Base takes the player back to the town',{state:st});
}

async function teleport(pg,S){
  await openShady(pg,S);
  const r=await pg.evaluate(async()=>{ const i=SHADY_SHOP.findIndex(x=>x.id==='tele'), btn=document.querySelector('#shadyBody button[data-si="'+i+'"]'), row=btn&&btn.closest('.merc-offer');
    if(!row) return {found:false}; row.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,300));
    const info=row.querySelector('.merc-info'), img=info.querySelector(':scope>img'), ok=img?await SL.imgOk(img):{ok:false}, emojiSpan=info.querySelector(':scope>span');
    const iconTxt=[...info.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
    return {found:true,name:SL.txt(row.querySelector('b')),img:ok,box:img?SL.R(img):null,on:img?SL.inView(img):false,front:img?SL.front(img):false,emojiSpan:!!emojiSpan,iconTxt}; });
  const s=await shot(pg,S.tag+' teleport row');
  C.ok(r.found&&r.img.ok&&/teleport-card-v1/.test(r.img.src||'')&&r.box&&r.box.w>=20&&r.box.h>=20&&r.on&&r.front&&!r.emojiSpan&&!r.iconTxt,S.tag+' Teleport item card art: the "'+r.name+'" row shows the teleport card picture (loaded, '+(r.box&&r.box.w)+'x'+(r.box&&r.box.h)+' px, on screen), not an emoji',
    {...r,shot:s});
}

async function frames(pg,S){
  await openShady(pg,S);
  const r=await pg.evaluate(async()=>{ const scr=document.getElementById('shadymarket'), panel=document.getElementById('shadyBody'), pr=SL.R(panel), v=SL.V();
    const ins=(a,b)=>!!a&&!!b&&a.x>=b.x-1&&a.y>=b.y-1&&a.r<=b.r+1&&a.b<=b.b+1;
    const hu=((getComputedStyle(panel,'::before').borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1], holder=hu?await SL.loadImg(hu):null;
    const offers=[]; let i=0; for(const o of panel.querySelectorAll('.merc-offer')){ i++; const or=SL.R(o), btn=o.querySelector('button'), br=SL.R(btn), info=o.querySelector('.merc-info'), ir=SL.R(info), name=o.querySelector('b');
      const fu=((getComputedStyle(o).borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1], f=fu?await SL.loadImg(fu):null;
      const bad=[]; if(!(f&&f.ok&&/market-item-frame/.test(fu))) bad.push('no painted card frame'); if(!ins(or,pr)) bad.push('card outside the holder'); if(!ins(br,or)) bad.push('price outside the card'); if(!ins(ir,or)) bad.push('picture/name outside the card');
      if(name&&name.scrollWidth>name.clientWidth+1) bad.push('name overflows'); if(btn.scrollWidth>btn.clientWidth+1) bad.push('price overflows');
      if(o.scrollWidth>o.clientWidth+1||o.scrollHeight>o.clientHeight+1) bad.push('card content overflows');
      offers.push({i,name:name?SL.txt(name).slice(0,30):'',price:SL.txt(btn),card:or,bad}); }
    const w=panel.querySelector('.merc-wallet'), wr=SL.R(w);
    return {holder:hu?hu.replace(location.origin,''):null,holderOk:!!(holder&&holder.ok)&&/market-holder-frame/.test(hu||''),panel:pr,holderInScreen:pr.x>=-1&&pr.r<=v.width+1,screenX:SL.scrolls(scr),wallet:wr,walletIn:ins(wr,pr)&&w.scrollWidth<=w.clientWidth+1,offers}; });
  const s=await shot(pg,S.tag+' shady frames (top)');
  await pg.evaluate(()=>{ const c=[...document.querySelectorAll('#shadyBody .merc-offer')].pop(); if(c) c.scrollIntoView({block:'end'}); }); await H.wait(300);
  const s2=await shot(pg,S.tag+' shady frames (bottom)');
  const bad=r.offers.filter(o=>o.bad.length);
  C.ok(r.offers.length===4&&bad.length===0&&r.holderOk&&r.walletIn&&r.holderInScreen&&!r.screenX.x,S.tag+' Framed cards: the 4 item cards (painted frames), their prices and the wallet bar sit inside the painted holder, the holder inside the screen, no overflow',
    {bad:bad.map(o=>o.i+' '+o.name+': '+o.bad.join(', ')+' '+JSON.stringify(o.card)),holder:r.holder,panel:r.panel,screenScrollX:r.screenX.x,cards:r.offers.map(o=>o.i+' '+o.price+' '+o.card.w+'x'+o.card.h),shots:[s,s2]});
}

(async()=>{
  const {file}=H.seedDB(HEROES); const s=await H.server(file); let pg=null;
  try{
    const plan=[['desktop',['screen','teleport','frames']],['tablet',['screen','teleport','frames']],['phone',['screen','teleport','frames']],['fold',['frames']],['popout',['frames']],['full',['frames']]];
    for(const [k,parts] of plan){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      for(const part of parts){ try{ if(part==='screen') await screen(pg,S); else if(part==='teleport') await teleport(pg,S); else await frames(pg,S); }catch(e){ C.ok(false,S.tag+' '+part+' ran to the end',String(e&&e.stack||e).slice(0,500)); } }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
