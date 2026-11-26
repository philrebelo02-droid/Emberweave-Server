'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 02 - Market (market-shady-board-hut-egp.md, UNPROVEN-ON-SCREEN):
   - Market screen: painted hall, painted title, framed offer cards, the wallet bar across the holder, subtitle "Hero fragments · shields" (3 sizes).
   - Item cards stay inside their frame: phone, Fold, tablet, desktop, pop-out, full screen: offer cards, prices and holder inside the painted
     frames, no overflow.
   - Painted store window: the diamond store (HUD diamond +) at 3 sizes: the painted window, four tabs (Diamonds, Packs, Limited, Patron) on the
     frame, every card's picture / name / contents / price inside its frame, sideways scroll when the cards do not fit.
   One screenshot per check per size (SHOT64 lines). Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_market.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:30,aureth:30,sylthaine:30,vireo:30,brannus:30};

async function openMarket(pg,S){ const how=await H.openBuilding(pg,'market',S.touch);
  await pg.waitForFunction(()=>document.getElementById('market').classList.contains('active')&&document.querySelectorAll('#marketBody .merc-offer').length>0,null,{timeout:40000}).catch(()=>{});
  await H.wait(1500); await H.prep(pg); return how; }

async function screen(pg,S){
  const how=await openMarket(pg,S);
  const r=await pg.evaluate(async()=>{ const scr=document.getElementById('market'), h1=scr.querySelector('h1'), sub=scr.querySelector(':scope>.sub'), panel=document.getElementById('marketBody'), w=panel.querySelector('.merc-wallet');
    const title=await SL.bgLoaded(h1), hall=await SL.bgLoaded(scr);
    const hu=((getComputedStyle(panel,'::before').borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1], holder=hu?await SL.loadImg(hu):null;
    const offers=[]; for(const o of panel.querySelectorAll('.merc-offer')){ const fu=((getComputedStyle(o).borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1], f=fu?await SL.loadImg(fu):null; offers.push({frame:fu?fu.replace(location.origin,''):null,ok:!!(f&&f.ok),box:SL.R(o)}); }
    const pr=SL.R(panel), wr=SL.R(w), spans=[...w.children].map(e=>SL.R(e)), wpaint=getComputedStyle(w).backgroundImage+' '+getComputedStyle(w).backgroundColor;
    return {hall:hall.map(x=>x.url.replace(location.origin,'').slice(0,80)+(x.ok?' ok':' NOT LOADED')),hallOk:hall.some(x=>x.ok&&/market-hall/.test(x.url)),
      title:title.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),titleOk:title.some(x=>x.ok&&/market-wordmark/.test(x.url))&&title.every(x=>x.ok),titleFont:getComputedStyle(h1).fontSize,titleOn:SL.inView(h1),titleFront:SL.front(h1),titleBox:SL.R(h1),
      sub:SL.txt(sub),subOn:SL.inView(sub),subFront:SL.front(sub),subBox:SL.R(sub),wantSub:t('market.screen_sub'),
      holder:hu?hu.replace(location.origin,''):null,holderOk:!!(holder&&holder.ok),panel:pr,wallet:wr,wpaint,spansIn:spans.length>0&&spans.every(s=>s.x>=pr.x-1&&s.r<=pr.r+1&&s.y>=pr.y-1&&s.b<=pr.b+1),spans,walletTxt:SL.txt(w),walletOn:SL.inView(w),offers}; });
  const s=await shot(pg,S.tag+' market');
  C.ok(r.hallOk,S.tag+' Market screen: the painted market hall is behind the screen (art loaded) [opened by '+how+']',{hall:r.hall,shot:s});
  C.ok(r.titleOk&&parseFloat(r.titleFont)===0&&r.titleOn&&r.titleFront,S.tag+' Market screen: the painted MARKET title art is loaded, on screen, not covered (no text title)',{title:r.title,box:r.titleBox,shot:s});
  C.ok(r.sub==='Hero fragments · shields'&&r.sub===r.wantSub&&r.subOn&&r.subFront,S.tag+' Market screen: the subtitle "'+r.sub+'" is on screen and not covered',{box:r.subBox,shot:s});
  C.ok(r.offers.length>0&&r.offers.every(o=>o.ok&&/market-item-frame/.test(o.frame||'')),S.tag+' Market screen: every offer card wears its painted frame ('+r.offers.length+' cards, frame art loaded)',{offers:r.offers.map(o=>o.frame+(o.ok?'':' NOT LOADED')),shot:s});
  const across=r.wallet&&r.panel&&r.wallet.w>=r.panel.w*0.95&&r.spansIn;
  C.ok(r.holderOk&&across&&r.walletOn&&/\d/.test(r.walletTxt),S.tag+' Market screen: the wallet bar runs across the painted holder (holder art loaded, bar '+(r.wallet&&r.wallet.w)+' of '+(r.panel&&r.panel.w)+' px)',
    {holder:r.holder,wallet:r.wallet,walletPaint:r.wpaint,textRuns:r.spans,panel:r.panel,text:r.walletTxt,shot:s});
}

async function frames(pg,S){
  await openMarket(pg,S);
  const r=await pg.evaluate(()=>{ const scr=document.getElementById('market'), panel=document.getElementById('marketBody'), pr=SL.R(panel), v=SL.V();
    const ins=(a,b)=>!!a&&!!b&&a.x>=b.x-1&&a.y>=b.y-1&&a.r<=b.r+1&&a.b<=b.b+1;
    const offers=[...panel.querySelectorAll('.merc-offer')].map((o,i)=>{ const or=SL.R(o), btn=o.querySelector('button'), br=SL.R(btn), info=o.querySelector('.merc-info'), ir=SL.R(info), name=o.querySelector('b');
      const bad=[]; if(!ins(or,pr)) bad.push('card outside the holder'); if(!ins(br,or)) bad.push('price outside the card'); if(!ins(ir,or)) bad.push('picture/name outside the card');
      if(name&&name.scrollWidth>name.clientWidth+1) bad.push('name overflows'); if(btn.scrollWidth>btn.clientWidth+1) bad.push('price overflows');
      if(o.scrollWidth>o.clientWidth+1||o.scrollHeight>o.clientHeight+1) bad.push('card content overflows');
      return {i:i+1,name:name?SL.txt(name).slice(0,30):'',price:SL.txt(btn),card:or,bad}; });
    const w=panel.querySelector('.merc-wallet'), wr=SL.R(w), spans=[...w.children].map(e=>SL.R(e));
    return {panel:pr,holderInScreen:pr.x>=-1&&pr.r<=v.width+1,screenX:SL.scrolls(scr),wallet:wr,walletIn:spans.length>0&&spans.every(s=>ins(s,pr))&&w.scrollWidth<=w.clientWidth+1,wallet:wr,walletRuns:spans,offers}; });
  /* the whole holder in the picture: scroll the screen so the last card shows */
  const s=await shot(pg,S.tag+' market frames (top)');
  await pg.evaluate(()=>{ const c=[...document.querySelectorAll('#marketBody .merc-offer')].pop(); if(c) c.scrollIntoView({block:'end'}); }); await H.wait(300);
  const s2=await shot(pg,S.tag+' market frames (bottom)');
  const bad=r.offers.filter(o=>o.bad.length);
  C.ok(r.offers.length>0&&bad.length===0&&r.walletIn&&r.holderInScreen&&!r.screenX.x,S.tag+' Item cards stay inside their frame: '+r.offers.length+' offer cards, their prices and the wallet bar sit inside the painted holder, the holder inside the screen, no overflow',
    {bad:bad.map(o=>o.i+' '+o.name+': '+o.bad.join(', ')+' '+JSON.stringify(o.card)),panel:r.panel,screenScrollX:r.screenX.x,walletIn:r.walletIn,walletRuns:r.walletRuns,cards:r.offers.map(o=>o.i+' '+o.price+' '+o.card.w+'x'+o.card.h),shots:[s,s2]});
}

async function store(pg,S){
  await H.prep(pg); await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} show('home'); }); await H.wait(1200); await H.clean(pg);
  if(S.touch) await pg.tap('#gemPlus'); else await pg.click('#gemPlus');
  await pg.waitForFunction(()=>!!document.querySelector('#hudShop .st2-win'),null,{timeout:20000}).catch(()=>{}); await H.wait(1200); await H.prep(pg);
  const win=await pg.evaluate(async()=>{ const w=document.querySelector('#hudShop .st2-win'); if(!w) return {shown:false}; const fr=await SL.imgOk(w.querySelector('.st2-frame')), wr=SL.R(w);
    const tabs=[...w.querySelectorAll('.st2-tab')].map(t=>({id:t.dataset.tab,label:SL.txt(t),box:SL.R(t),on:SL.inView(t),front:SL.front(t),inWin:SL.R(t).x>=wr.x&&SL.R(t).r<=wr.r&&SL.R(t).y>=wr.y&&SL.R(t).b<=wr.b,fits:t.scrollWidth<=t.clientWidth+1}));
    return {shown:true,frame:fr,box:wr,on:SL.inView(w),tabs}; });
  const s0=await shot(pg,S.tag+' store window');
  C.ok(win.shown&&win.frame.ok&&/store-window-frame/.test(win.frame.src||'')&&win.on,S.tag+' Painted store window: the painted store window opens from the diamond + and is fully on screen (frame art loaded)',{frame:win.frame,box:win.box,shot:s0});
  const want=['diamonds','packs','limited','patron'];
  C.ok(win.shown&&win.tabs.length===4&&want.every((id,i)=>win.tabs[i]&&win.tabs[i].id===id&&win.tabs[i].label)&&win.tabs.every(t=>t.on&&t.front&&t.inWin&&t.fits),S.tag+' Painted store window: four tabs on the frame plates (Diamonds, Packs, Limited, Patron), each on screen, inside the window, label not cut',
    {tabs:(win.tabs||[]).map(t=>t.id+' "'+t.label+'" '+t.box.w+'x'+t.box.h+'@'+t.box.x+','+t.box.y+(t.inWin?'':' OUTSIDE')+(t.front?'':' COVERED')+(t.fits?'':' CUT')),shot:s0});
  for(const id of want){
    await pg.evaluate(id=>{ const t=document.querySelector('#hudShop .st2-tab[data-tab="'+id+'"]'); if(t) t.scrollIntoView({block:'nearest'}); },id);
    if(S.touch) await pg.tap('#hudShop .st2-tab[data-tab="'+id+'"]'); else await pg.click('#hudShop .st2-tab[data-tab="'+id+'"]');
    await H.wait(1000); await H.prep(pg);
    const r=await pg.evaluate(async()=>{ const body=document.querySelector('#hudShop .st2-body'), brr=SL.R(body), cards=[...body.querySelectorAll('.st2-card')];
      const ins=(a,b)=>!!a&&!!b&&a.x>=b.x-1&&a.y>=b.y-1&&a.r<=b.r+1&&a.b<=b.b+1;
      const out=[]; for(const c of cards){ const pic=await SL.imgOk(c.querySelector('.st2-pic img')), fr=await SL.imgOk(c.querySelector('.st2-cframe')), cr=SL.R(c.querySelector('.st2-cframe')), bad=[];
        if(!pic.ok) bad.push('no picture'); if(!fr.ok) bad.push('no card frame');
        for(const k of ['name','what','price']){ const e=c.querySelector('.st2-'+k); if(!e||!SL.txt(e)){ bad.push('no '+k); continue; } if(!ins(SL.R(e),cr)) bad.push(k+' outside the frame'); if(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1) bad.push(k+' cut off'); }
        out.push({name:SL.txt(c.querySelector('.st2-name')),price:SL.txt(c.querySelector('.st2-price')),box:SL.R(c),bad}); }
      const soon=body.querySelector('.st2-soon');
      return {n:cards.length,cards:out,body:brr,over:body.scrollWidth>body.clientWidth+1,sw:body.scrollWidth,cw:body.clientWidth,ox:getComputedStyle(body).overflowX,soon:soon?SL.txt(soon):null,soonIn:soon?ins(SL.R(soon),brr):null,
        visible:cards.filter(c=>ins(SL.R(c),brr)).length}; });
    const s1=await shot(pg,S.tag+' store '+id);
    const bad=r.cards.filter(c=>c.bad.length);
    if(r.n){ C.ok(bad.length===0,S.tag+' Painted store window, '+id+' tab: every card ('+r.n+') shows its picture, name, contents and price inside its frame',{bad:bad.map(c=>c.name+': '+c.bad.join(', ')),cards:r.cards.map(c=>c.name+' '+c.price),shot:s1});
      let scrolled=null;
      if(r.over){ /* sideways: the mouse wheel on a PC (the page turns it sideways), a finger swipe on a phone */
        const b=await pg.evaluate(()=>{ const r=document.querySelector('#hudShop .st2-body').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width}; });
        let swipeDiag=null;
        if(S.touch){ swipeDiag=await pg.evaluate(([x,y])=>({at:SL.whoAt?(()=>{ const t=document.elementFromPoint(x,y); return t?(t.tagName+'.'+String(t.className).slice(0,40)):null; })():null,inBody:!!document.elementFromPoint(x,y)&&document.querySelector('#hudShop .st2-body').contains(document.elementFromPoint(x,y))}),[Math.round(b.x+b.w*0.35),Math.round(b.y)]);
          console.log('  INFO   '+S.tag+' store swipe starts at '+Math.round(b.x+b.w*0.35)+','+Math.round(b.y)+' on '+JSON.stringify(swipeDiag)); }
        if(S.touch){ const cdp=await pg._ctx.newCDPSession(pg); for(let k=0;k<4;k++){ const x0=Math.round(b.x+b.w*0.35), y=Math.round(b.y);
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y}]});
          for(let j=1;j<=12;j++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0-Math.round(b.w*0.6*j/12),y}]}); await H.wait(16); }
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await H.wait(250); } }
        else { await pg.mouse.move(b.x,b.y); for(let k=0;k<12;k++){ await pg.mouse.wheel(0,400); await H.wait(60); } }
        await H.wait(600);
        scrolled=await pg.evaluate(()=>{ const body=document.querySelector('#hudShop .st2-body'), brr=SL.R(body), last=[...body.querySelectorAll('.st2-card')].pop(), lr=SL.R(last); let ta=[]; for(let e=body;e&&e!==document.documentElement;e=e.parentElement){ const v=getComputedStyle(e).touchAction; if(v!=='auto') ta.push((e.id||e.className||e.tagName).toString().slice(0,30)+':'+v); }
          return {scrollLeft:Math.round(body.scrollLeft),max:body.scrollWidth-body.clientWidth,lastIn:lr.x>=brr.x-1&&lr.r<=brr.r+1,overflowX:getComputedStyle(body).overflowX,touchAction:ta}; });
        const s2=await shot(pg,S.tag+' store '+id+' scrolled');
        C.ok(scrolled.scrollLeft>0&&scrolled.lastIn,S.tag+' Painted store window, '+id+' tab: the cards do not all fit, and '+(S.touch?'a sideways swipe':'the mouse wheel')+' scrolls them sideways until the last card is in the window',{...scrolled,swipeStart:swipeDiag,width:r.sw+'/'+r.cw,shot:s2});
      } else C.ok(r.visible===r.n,S.tag+' Painted store window, '+id+' tab: all '+r.n+' cards fit inside the window (no sideways scroll needed)',{body:r.body,shot:s1});
    } else C.ok(!!r.soon&&r.soonIn,S.tag+' Painted store window, '+id+' tab: no offers yet - the "coming soon" note sits inside the window',{soon:r.soon,shot:s1});
  }
}

(async()=>{
  const {file}=H.seedDB(HEROES); const s=await H.server(file); let pg=null;
  try{
    const plan=[['desktop',['screen','frames','store']],['tablet',['screen','frames','store']],['phone',['screen','frames','store']],['fold',['frames']],['popout',['frames']],['full',['frames']]];
    for(const [k,parts] of plan){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      for(const part of parts){ try{ if(part==='screen') await screen(pg,S); else if(part==='frames') await frames(pg,S); else await store(pg,S); }catch(e){ C.ok(false,S.tag+' '+part+' ran to the end',String(e&&e.stack||e).slice(0,500)); } }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
