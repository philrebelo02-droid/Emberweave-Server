'use strict';
/* Lockdown audit 25 Nov 2026, round 4 (account-hud-sound-servers.md, the UNPROVEN-ON-SCREEN lines of 21 - Hub HUD and UI Art and 17 - Account,
   Settings, Glossary, Chat that are still unticked):
   21: Painted theme everywhere, Header boxes, Framed cards, State glows, Building main screens.
   17: Centred framed card (sign-in gate + Terms window), Link Google / Link Facebook (only the two panels side by side - the cluster server has
       no Google / Facebook client, so the link itself cannot be proven here), All creatures (Glossary monsters / bosses / summons, face crop),
       Card backgrounds (burned forest for monsters + bosses, grassy field for summons).
   Every menu screen and pop-out is opened from MENU (the way a player does), every building from its town plate (H.openBuilding), at desktop
   and phone; the sign-in gate and Terms window also at Fold cover, Fold open and tablet. One screenshot per screen per size (SHOT64 lines).
   Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_account_hud.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:30,aureth:30,sylthaine:30,vireo:30,brannus:30,konwu:20,tick:15};
const FOLD_OPEN={w:1085,h:904,touch:true,tag:'Fold open 1085x904'};

/* page-side helpers for this test: window.AH.* (needs window.SL from H.prep) */
const AH_HELPERS=()=>{ if(window.AH) return true;
  const cols=s=>[...String(s||'').matchAll(/rgba?\(([^)]+)\)/g)].map(m=>{ const p=m[1].split(',').map(x=>parseFloat(x)); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; });
  const hsl=c=>{ const r=c.r/255,g=c.g/255,b=c.b/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn; let h=0,s=0;
    if(d>0){ s=d/(1-Math.abs(2*l-1)); h=mx===r?60*(((g-b)/d)%6):mx===g?60*((b-r)/d+2):60*((r-g)/d+4); if(h<0) h+=360; } return {h,s,l}; };
  const isGold=c=>c.a>0.15&&c.r>=170&&c.g>=110&&c.b<=150&&c.r>=c.g&&c.g>=c.b+25;
  const isGreen=c=>c.a>0.15&&c.g>=140&&c.g>=c.r+40&&c.g>=c.b+15;
  const isPurple=c=>{ if(c.a<0.5) return false; const x=hsl(c); return x.h>=255&&x.h<=300&&x.s>=0.25&&x.l>=0.1&&x.l<=0.75; };
  const desc=el=>{ if(!el||!el.tagName) return String(el); return (el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className.trim()?'.'+el.className.trim().split(/\s+/).slice(0,3).join('.'):'')).slice(0,70); };
  const onScreen=el=>{ if(!SL.vis(el)) return false; const r=el.getBoundingClientRect(); return r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight&&r.width>2&&r.height>2; };
  const urls=s=>[...String(s||'').matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1]);
  const short=u=>String(u||'').replace(location.origin,'').slice(0,90);
  const cache={}; const load=u=>cache[u]||(cache[u]=SL.loadImg(u));
  const box=el=>{ const r=el.getBoundingClientRect(); return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}; };
  const rootEl=sel=>typeof sel==='string'?document.querySelector(sel):sel;

  /* the painted theme of one screen */
  async function theme(sel){ const root=rootEl(sel); if(!root) return {missing:true};
    const rcs=getComputedStyle(root); const bu=[...urls(rcs.backgroundImage),...urls(getComputedStyle(root,'::before').backgroundImage),...urls(getComputedStyle(root,'::after').backgroundImage)];
    /* own painted art: an element covering half the screen with an image */
    const big=[]; const va=innerWidth*innerHeight; for(const el of [...root.querySelectorAll('*')].slice(0,5000)){ const r=el.getBoundingClientRect(); if(r.width*r.height<va*0.4||!SL.vis(el)) continue;
      const cs=getComputedStyle(el); urls(cs.backgroundImage).forEach(u=>big.push(u)); if(el.tagName==='IMG'&&el.src) big.push(el.currentSrc||el.src); if(big.length>8) break; }
    const back=await Promise.all([...new Set([...bu,...big])].map(load)); const backOk=back.some(x=>x.ok);
    const h1s=[]; for(const h of root.querySelectorAll('h1')){ if(!onScreen(h)) continue; const cs=getComputedStyle(h), bgi=cs.backgroundImage, us=urls(bgi);
      const fill=cs.webkitTextFillColor||''; const transparent=/rgba\(0, 0, 0, 0\)|transparent/.test(fill)||/rgba\(0, 0, 0, 0\)|transparent/.test(cs.color);
      const grad=/gradient/.test(bgi)&&cols(bgi).some(isGold)&&transparent; let painted=false; if(us.length){ const L=await Promise.all(us.map(load)); painted=L.some(x=>x.ok); }
      const solidGold=!transparent&&cols(cs.color).some(isGold)||cols(fill).some(isGold);   /* solid gold text (City Wall / Bulletin Board / Witches Hut) */
      h1s.push({el:desc(h),text:SL.txt(h).slice(0,40),gold:grad||solidGold,how:grad?'gold gradient':solidGold?'solid gold '+(cs.webkitTextFillColor||cs.color):painted?'painted art':'none',painted,fs:cs.fontSize,color:cs.color,ok:grad||solidGold||painted}); }
    const flatBtns=[], btns=[]; for(const b of root.querySelectorAll('.btn')){ if(!onScreen(b)) continue; const cs=getComputedStyle(b), bgi=cs.backgroundImage, sec=b.classList.contains('secondary');
      let ok=sec?(/gradient|url\(/.test(bgi)):(/url\(/.test(bgi)||cols(bgi).some(isGold));
      /* painted another way: a loaded border image, or a ::before / ::after carrying the art or a gold gradient (the Market / Shady price buttons) */
      if(!ok){ const bi=urls(cs.borderImageSource); if(bi.length){ const L=await load(bi[0]); if(L.ok) ok=true; } }
      if(!ok){ for(const ps of ['::before','::after']){ const pcs=getComputedStyle(b,ps), pi=pcs.backgroundImage, pu=urls(pi).concat(pcs.content!=='none'?urls(pcs.borderImageSource):[]); if(pu.length){ const L=await load(pu[0]); if(L.ok){ ok=true; break; } } if(cols(pi).some(isGold)){ ok=true; break; } } }
      btns.push(ok); if(!ok) flatBtns.push(desc(b)+' "'+SL.txt(b).slice(0,20)+'" bg '+bgi.slice(0,60)+' '+box(b).w+'x'+box(b).h); }
    const flatTabs=[]; let tabs=0; for(const t of root.querySelectorAll('.tabrow .tab,.hd-tab,.glTab')){ if(!onScreen(t)) continue; tabs++; const cs=getComputedStyle(t);
      if(!/gradient|url\(/.test(cs.backgroundImage)&&!/url\(/.test(cs.borderImageSource)) flatTabs.push(desc(t)+' "'+SL.txt(t).slice(0,20)+'"'); }
    const flatPanels=[]; let panels=0; for(const p of root.querySelectorAll('.panel')){ if(!onScreen(p)) continue; panels++; const cs=getComputedStyle(p);
      if(/url\(/.test(cs.borderImageSource)||/url\(/.test(cs.backgroundImage)) continue;
      /* a fully see-through layout box is not a panel the player sees: flag only a solid background (no art) or a visible plain border */
      const bc=cols(cs.backgroundColor)[0], solid=!!bc&&bc.a>0.3, grad=/gradient/.test(cs.backgroundImage);
      const bord=['Top','Right','Bottom','Left'].some(k=>(parseFloat(cs['border'+k+'Width'])||0)>=1&&cs['border'+k+'Style']!=='none'&&(cols(cs['border'+k+'Color'])[0]||{a:0}).a>0.3);
      if(solid||grad||bord) flatPanels.push(desc(p)+' '+box(p).w+'x'+box(p).h+' bg '+cs.backgroundColor+(grad?' '+cs.backgroundImage.slice(0,50):'')+(bord?' border '+cs.borderTopWidth+' '+cs.borderTopColor:'')); }
    const purple=[]; for(const el of [root,...[...root.querySelectorAll('*')].slice(0,6000)]){ if(!onScreen(el)) continue; const r=el.getBoundingClientRect(); if(r.width*r.height<1500) continue;
      const cs=getComputedStyle(el), bgi=cs.backgroundImage; const c=cols(cs.backgroundColor)[0];
      const solid=c&&bgi==='none'&&isPurple(c), grad=/gradient/.test(bgi)&&!/url\(/.test(bgi)&&cols(bgi).length>0&&cols(bgi).every(isPurple);
      if(solid||grad){ purple.push(desc(el)+' '+Math.round(r.width)+'x'+Math.round(r.height)+' '+(solid?cs.backgroundColor:bgi.slice(0,70))); if(purple.length>12) break; } }
    return {back:back.map(x=>short(x.url)+(x.ok?' ok':' NOT LOADED')),backOk,h1s,btns:btns.length,flatBtns,tabs,flatTabs,panels,flatPanels,purple}; }

  /* the screen's title: painted title art, or a title in a gold-framed header box */
  async function header(sel){ const root=rootEl(sel); if(!root) return {missing:true};
    /* a list that opened scrolled to its current step hides the header: put the screen (and every scrolling box over its title) back at the top */
    let scrolled=false; const top0=e=>{ if(e&&e.scrollTop>0){ e.scrollTop=0; scrolled=true; } };
    for(let a=root;a&&a!==document.documentElement;a=a.parentElement) top0(a);
    for(const h of root.querySelectorAll('h1,.hdrbox,.titlebar')) for(let a=h.parentElement;a&&a!==root;a=a.parentElement) top0(a);
    if(scrolled) await new Promise(r=>setTimeout(r,250));
    let t=[...root.querySelectorAll('h1')].find(onScreen), how='h1';
    if(!t){ t=[...root.querySelectorAll('.hdrbox,.titlebar,[id$="Hdr"],[class*="Title"],[class*="title"],[class*="Ttl"]')].find(onScreen); how='title element'; }
    /* painted title art drawn by a pseudo element (the Temple: #tp2Stage::after = building-titles/temple-title.webp) */
    const pseudoTitle=async()=>{ for(const e of [root,...[...root.querySelectorAll('*')].slice(0,5000)]){ if(!onScreen(e)) continue;
        for(const ps of ['::before','::after']){ const pc=getComputedStyle(e,ps); if(pc.content==='none'||pc.display==='none') continue; const u=urls(pc.backgroundImage).find(x=>/title|wordmark/.test(x));
          if(u){ const L=await load(u); if(L.ok) return {owner:desc(e)+ps,art:short(u),box:box(e)}; } } } return null; };
    if(!t){ const p=await pseudoTitle(); return p?{kind:'painted title art',how:'pseudo element',el:p.owner,art:[p.art],box:p.box,scrolled}:{kind:'none',scrolled}; }
    const cs=getComputedStyle(t), us=urls(cs.backgroundImage); let painted=null;
    if(us.length){ const L=await Promise.all(us.map(load)); if(L.some(x=>x.ok)) painted=L.filter(x=>x.ok).map(x=>short(x.url)); }
    const out={how,el:desc(t),text:SL.txt(t).slice(0,40),fs:cs.fontSize,box:box(t),scrolled};
    if(painted&&(parseFloat(cs.fontSize)<1||/rgba\(0, 0, 0, 0\)|transparent/.test(cs.webkitTextFillColor||cs.color)||!SL.txt(t))) return Object.assign(out,{kind:'painted title art',art:painted});
    for(let a=t;a&&a!==root.parentElement;a=a.parentElement){ if(a===root&&a.classList.contains('popout')&&a!==t) break;   /* the pop-out's own sheet frame is not a header box */
      const c=getComputedStyle(a); const bi=urls(c.borderImageSource), bw=['Top','Right','Bottom','Left'].map(k=>parseFloat(c['border'+k+'Width'])||0);
      if(bi.length&&bw.some(x=>x>0)){ const L=await load(bi[0]); if(L.ok) return Object.assign(out,{kind:'gold-framed header box',frame:desc(a)+' '+short(bi[0]),bw}); }
      const bg=urls(c.backgroundImage); if(a!==root&&bg.length){ const L=await load(bg[0]); if(L.ok&&/inset-card|plaque|panel|title|plate/.test(bg[0])) return Object.assign(out,{kind:'painted header plate',frame:desc(a)+' '+short(bg[0])}); } }
    /* the title element's own children / pseudo elements carry the plate or the art (Wishing Pool .wpsTitle, the Campaign chapter plate #cmapHdr):
       a loaded border image or background whose box covers the title's text */
    { const tr=t.getBoundingClientRect(), cx=tr.left+tr.width/2, cy=tr.top+tr.height/2;
      const covers=r=>r.width>0&&r.height>0&&r.left<=cx&&r.right>=cx&&r.top<=cy&&r.bottom>=cy;
      for(const e of [t,...[...t.querySelectorAll('*')].slice(0,400)]){ if(e!==t&&!SL.vis(e)) continue; const er=e.getBoundingClientRect();
        const srcs=[[getComputedStyle(e),'']]; ['::before','::after'].forEach(ps=>{ const pc=getComputedStyle(e,ps); if(pc.content!=='none'&&pc.display!=='none') srcs.push([pc,ps]); });
        for(const [c,ps] of srcs){ if(e===t&&!ps) continue;   /* the element itself was looked at above */
          const u=[...urls(c.borderImageSource),...urls(c.backgroundImage)][0]; if(!u) continue; if(!ps&&!covers(er)) continue;
          if(ps&&!covers(er)) continue;   /* a pseudo element is measured by its owner's box */
          const L=await load(u); if(L.ok) return Object.assign(out,{kind:/title|wordmark/.test(u)?'painted title art':'painted header plate',frame:desc(e)+ps+' '+short(u),plateBox:box(e)}); } } }
    /* the title drawn as an <img> beside a screen-reader-only text (Bulletin Board .bb-title-art + .bb-title-text): a loaded, visible title image in the title's own header */
    { const hdr=t.parentElement; const im=hdr&&[...hdr.querySelectorAll('img')].find(i=>/title|wordmark/.test(i.currentSrc||i.src||'')&&SL.vis(i)&&i.naturalWidth>0);
      if(im) return Object.assign(out,{kind:'painted title art',how:'img',frame:desc(im)+' '+short(im.currentSrc||im.src),plateBox:box(im)}); }
    if(painted) return Object.assign(out,{kind:'painted title art (text over it)',art:painted});
    const p=await pseudoTitle(); if(p) return Object.assign(out,{kind:'painted title art',how:'pseudo element',frame:p.owner+' '+p.art});
    return Object.assign(out,{kind:'bare'}); }

  /* every visible card / row of a kind wears a gold frame (border image, the hero ascension frame, or the store card frame) */
  /* bring an element into view the way a player scrolls a list: scrollIntoView, then put back every box a player cannot scroll (overflow hidden /
     clip, the game frame) - the rig bug that once shifted every building 30 px */
  async function intoView(el){ const anc=[]; for(let a=el.parentElement;a;a=a.parentElement){ const cs=getComputedStyle(a); if(/hidden|clip/.test(cs.overflowX+' '+cs.overflowY)||a===document.documentElement||a===document.body) anc.push([a,a.scrollLeft,a.scrollTop]); }
    el.scrollIntoView({block:'center',inline:'nearest'}); for(const [a,l,t] of anc){ a.scrollLeft=l; a.scrollTop=t; } await new Promise(r=>setTimeout(r,60)); return onScreen(el); }
  async function frames(sel,limit,scroll){ const els=[...document.querySelectorAll(sel)].filter(scroll?SL.vis:onScreen).slice(0,limit||60), bad=[], seen=[]; let off=0;
    for(const el of els){ if(scroll&&!(await intoView(el))){ off++; bad.push(desc(el)+' could not be scrolled on screen'); continue; } const cs=getComputedStyle(el), bi=urls(cs.borderImageSource), bw=['Top','Right','Bottom','Left'].map(k=>parseFloat(cs['border'+k+'Width'])||0);
      let how=null; if(bi.length&&bw.every(x=>x>0)){ const L=await load(bi[0]); if(L.ok) how='border '+short(bi[0]).split('/').pop()+' '+bw.join('/'); }
      if(!how){ const a=el.querySelector('.ascf'); if(a){ const ac=getComputedStyle(a), au=urls(ac.borderImageSource); if(au.length){ const L=await load(au[0]); if(L.ok) how='ascension frame '+short(au[0]).split('/').pop(); } } }
      if(!how){ const f=el.querySelector('img.st2-cframe'); if(f){ const ok=f.complete&&f.naturalWidth>0, fr=f.getBoundingClientRect(), er=el.getBoundingClientRect(); if(ok&&fr.width>=er.width*0.9&&fr.height>=er.height*0.9) how='card frame '+short(f.currentSrc||f.src).split('/').pop(); } }
      if(how) seen.push(how); else bad.push(desc(el)+' '+box(el).w+'x'+box(el).h+' borderImage '+(cs.borderImageSource||'none').slice(0,50)+' widths '+bw.join('/')); }
    return {n:els.length,framed:seen.length,offScreen:off,bad,kinds:[...new Set(seen)].slice(0,4)}; }

  /* the colours an element glows with (shadow, filter drop-shadow, border, outline) */
  function glow(el){ const cs=getComputedStyle(el); const parts=[cs.boxShadow,cs.filter,cs.borderTopColor,cs.outlineColor,getComputedStyle(el,'::after').boxShadow];
    const c=parts.flatMap(cols); return {gold:c.some(isGold),green:c.some(isGreen),opacity:+cs.opacity,shadow:cs.boxShadow.slice(0,90),filter:cs.filter.slice(0,90),border:cs.borderTopColor}; }

  window.AH={intoView,cols,isGold,isGreen,isPurple,desc,onScreen,urls,short,load,box,theme,header,frames,glow}; return true; };

const prep=async pg=>{ await H.prep(pg); await pg.evaluate(AH_HELPERS); };
const home=async pg=>{ await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} try{ closeHudShop(); }catch(e){} const w=document.getElementById('wlMap'); if(w) w.remove(); try{ show('home'); }catch(e){} }); await H.wait(800); await H.clean(pg); };

/* open a MENU entry the way a player does: tap MENU, then the medallion */
async function openMenu(pg,nav,touch){ await home(pg); let how='menu';
  try{ if(touch) await pg.tap('#menuBtn',{timeout:5000}); else await pg.click('#menuBtn',{timeout:5000}); }catch(e){ await pg.evaluate(()=>document.getElementById('menuBtn').click()); how='menu-js'; }
  await H.wait(500);
  const sel='#menuPanel .mitem[data-nav="'+nav+'"]';
  const vis=await pg.evaluate(s=>{ const el=document.querySelector(s); if(!el||!el.offsetParent) return false; const p=document.getElementById('menuPanel'); p.scrollTop=Math.max(0,el.offsetTop-10); return true; },sel);
  if(vis){ try{ if(touch) await pg.tap(sel,{timeout:5000}); else await pg.click(sel,{timeout:5000}); }catch(e){ how+='/item-js'; await pg.evaluate(s=>document.querySelector(s).click(),sel); } }
  else { how='popoutScreen() (no medallion shown)'; await pg.evaluate(n=>{ try{ document.getElementById('hubMenu').classList.remove('open'); }catch(e){} popoutScreen(n); },nav); }
  await H.wait(1800); await H.clean(pg); await prep(pg); return how; }

function judgeTheme(S,label,r,s){
  const h1ok=r.h1s.every(x=>x.ok);
  C.ok(!r.missing&&r.backOk&&h1ok&&!r.flatBtns.length&&!r.flatTabs.length&&!r.flatPanels.length&&!r.purple.length,
    S.tag+' Painted theme everywhere: '+label+' - painted backdrop loaded, gold or painted titles, gold / enamel buttons ('+r.btns+'), enamel tabs ('+r.tabs+'), framed panels ('+r.panels+'), no flat or plain purple boxes',
    {backdrop:r.back,titles:r.h1s,flatButtons:r.flatBtns,flatTabs:r.flatTabs,flatPanels:r.flatPanels,purple:r.purple,shot:s}); }
async function judgeHeader(pg,S,label,r,s){ if(r&&r.scrolled) s=await shot(pg,S.tag+' '+label.split(' (')[0]+' header (scrolled to top)');   /* the screen was scrolled back to its top to read the title */
  C.ok(!r.missing&&/painted|gold-framed/.test(r.kind||''),S.tag+' Header boxes: '+label+' - the title is '+(r.kind||'missing'),Object.assign({},r,{shot:s})); }

/* ---------------------------------------------------------------- menu screens and pop-outs */
async function menuScreens(pg,S){
  /* seed: one unread and one read Inbox letter, one unread war report; sign-in: earlier days claimed, today not */
  await pg.evaluate(()=>{ ensureMail(); const n=Date.now();
    G.mail.inbox.unshift({t:n-60000,from:'Screen Check',subj:'Unread letter',body:'An unread letter for the screen check.',read:false},{t:n-120000,from:'Screen Check',subj:'Read letter',body:'A read letter.',read:true});
    G.mail.war.unshift({t:n-30000,from:'Scout',subj:'War report',body:'An unread war report.',read:false}); try{ updateMailBadges(); }catch(e){} });
  const LIST=[['heroesPanel','Heroes'],['bag','Bag'],['tutorial','Start Here'],['quest','Quests'],['signin','Sign-In'],['mail','Mail'],['settings','Settings']];
  for(const [nav,label] of LIST){
    try{
      const how=await openMenu(pg,nav,S.touch);
      if(nav==='signin') await pg.evaluate(()=>{ signinEnsure(); const d=signinNow().getDate(); G.signinClaimed=[]; for(let i=1;i<d-1;i++) G.signinClaimed.push(i); renderSignin(); });
      if(nav==='mail') await pg.evaluate(()=>{ mailTab='inbox'; renderMail(); });
      await H.wait(700); await prep(pg);
      const act=await pg.evaluate(n=>{ const e=document.getElementById(n); return !!e&&e.classList.contains('active'); },nav);
      const s=await shot(pg,S.tag+' '+label);
      const th=await pg.evaluate(n=>AH.theme('#'+n),nav), hd=await pg.evaluate(n=>AH.header('#'+n),nav);
      judgeTheme(S,label+' (#'+nav+', opened by '+how+(act?'':', NOT active')+')',th,s); await judgeHeader(pg,S,label+' (#'+nav+')',hd,s);
      if(nav==='heroesPanel'){
        const fr=await pg.evaluate(()=>AH.frames('#heroesPanel .hero-card',40));
        C.ok(fr.n>=5&&!fr.bad.length,S.tag+' Framed cards: Heroes list - every hero card on screen ('+fr.n+') wears a gold frame',Object.assign({shot:s},fr));
        const sel=await pg.evaluate(()=>{ const c=document.querySelector('#heroesPanel .hero-card.selected'); return c?AH.glow(c):null; });
        if(sel) C.ok(sel.gold,S.tag+' State glows: Heroes list - the selected hero card glows gold',Object.assign({shot:s},sel));
        /* the hero window (pop-out over Heroes) */
        try{ const ok=await pg.evaluate(()=>{ const c=document.querySelector('#heroesPanel .hero-card'); if(!c) return false; c.click(); return true; });
          await H.wait(1800); await H.clean(pg); await prep(pg);
          const s2=await shot(pg,S.tag+' hero window');
          const th2=await pg.evaluate(()=>AH.theme('#heroDetail')), hd2=await pg.evaluate(()=>AH.header('#heroDetail'));
          judgeTheme(S,'hero window (#heroDetail'+(ok?'':', no hero card to tap')+')',th2,s2); console.log('  INFO   '+S.tag+' Header boxes: hero window (#heroDetail) is not a screen title - its header is the hero own card ('+(hd2&&hd2.kind)+')');
        }catch(e){ C.ok(false,S.tag+' Painted theme everywhere: hero window ran to the end',String(e&&e.stack||e).slice(0,400)); }
      }
      if(nav==='quest'){
        const fr=await pg.evaluate(()=>AH.frames('#quest .qcard',40));
        C.ok(fr.n>=1&&!fr.bad.length,S.tag+' Framed cards: Quests - every quest card on screen ('+fr.n+') wears a gold frame',Object.assign({shot:s},fr));
        const g=await pg.evaluate(()=>({ready:[...document.querySelectorAll('#quest .qcard.ready')].filter(AH.onScreen).map(AH.glow),done:[...document.querySelectorAll('#quest .qcard.done')].filter(AH.onScreen).map(AH.glow),
          tab:[...document.querySelectorAll('#quest .tab.on')].filter(AH.onScreen).map(AH.glow)}));
        C.ok(g.ready.length>0&&g.ready.every(x=>x.green),S.tag+' State glows: Quests - a claimable quest card ('+g.ready.length+') glows green',{ready:g.ready.slice(0,3),shot:s});
        if(g.done.length) C.ok(g.done.every(x=>x.opacity<0.9),S.tag+' State glows: Quests - done quest cards are dimmed',{done:g.done.slice(0,3),shot:s});
        else console.log('  INFO   '+S.tag+' State glows: Quests shows no done card (a claimed quest leaves the list)');
        if(g.tab.length) C.ok(g.tab.every(x=>x.gold),S.tag+' State glows: Quests - the selected tab glows gold',{tab:g.tab,shot:s});
      }
      if(nav==='signin'){
        /* the calendar scrolls on a phone: every day cell is scrolled into view before its frame is read */
        const fr=await pg.evaluate(()=>AH.frames('#signin .si-cell:not(.blank)',40,true));
        const sf=await shot(pg,S.tag+' Sign-In calendar scrolled');
        C.ok(fr.n>=28&&fr.framed>=28&&!fr.bad.length,S.tag+' Framed cards: Sign-In - every day cell ('+fr.n+', each scrolled into view, '+fr.framed+' framed) wears a gold frame',Object.assign({shot:s,shotScrolled:sf},fr));
        const tv=await pg.evaluate(async()=>{ const t=document.querySelector('#signin .si-cell.today'); return t?AH.intoView(t):null; });
        const st=await shot(pg,S.tag+' Sign-In today');
        const g=await pg.evaluate(()=>{ const q=(c,f)=>[...document.querySelectorAll('#signin .si-cell.'+c)].filter(f).map(AH.glow); return {today:q('today',AH.onScreen),claimed:q('claimed',SL.vis),missed:q('missed',SL.vis),plain:[...document.querySelectorAll('#signin .si-cell:not(.blank):not(.today):not(.claimed):not(.missed)')].filter(AH.onScreen).slice(0,2).map(AH.glow)}; });
        C.ok(g.today.length===1&&g.today[0].green,S.tag+' State glows: Sign-In - today (ready to claim, scrolled into view: '+tv+') glows green',{today:g.today,plain:g.plain,shot:st});
        C.ok(g.claimed.length>0&&g.claimed.every(x=>x.opacity<0.9),S.tag+' State glows: Sign-In - claimed (done) days are dimmed ('+g.claimed.length+')',{claimed:g.claimed.slice(0,2),missed:g.missed.slice(0,2),shot:st});
      }
      if(nav==='mail'){
        const fr=await pg.evaluate(()=>AH.frames('#mail .mailrow',40));
        C.ok(fr.n>=2&&!fr.bad.length,S.tag+' Framed cards: Mail - every mail row on screen ('+fr.n+') wears a gold frame',Object.assign({shot:s},fr));
        const g=await pg.evaluate(()=>({unread:[...document.querySelectorAll('#mail .mailrow.unread')].filter(AH.onScreen).map(AH.glow),read:[...document.querySelectorAll('#mail .mailrow:not(.unread)')].filter(AH.onScreen).slice(0,2).map(AH.glow),
          tab:[...document.querySelectorAll('#mailTabs .tab.on')].filter(AH.onScreen).map(AH.glow),state}));
        C.ok(g.unread.length>0&&g.unread.every(x=>x.gold),S.tag+' State glows: Mail - an unread letter glows gold ('+g.unread.length+' unread rows shown, state '+g.state+')',{unread:g.unread,read:g.read,shot:s});
        C.ok(g.tab.length===1&&g.tab[0].gold,S.tag+' State glows: Mail - the selected tab glows gold',{tab:g.tab,shot:s});
      }
      if(nav==='settings') await linkPanels(pg,S);
    }catch(e){ C.ok(false,S.tag+' Painted theme everywhere: '+label+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
  }
  /* screens opened from elsewhere: Glossary (campaign / hero window button), Account */
  for(const [nav,label] of [['glossary','Glossary'],['account','Account']]){
    try{ await home(pg); await pg.evaluate(n=>show(n),nav); await H.wait(1800); await H.clean(pg); await prep(pg);
      const st=await pg.evaluate(()=>state); const s=await shot(pg,S.tag+' '+label);
      if(st!==nav){ console.log('  INFO   '+S.tag+' '+label+': show(\''+nav+'\') landed on '+st+' (no own screen there)'); continue; }
      judgeTheme(S,label+' (#'+nav+')',await pg.evaluate(n=>AH.theme('#'+n),nav),s); await judgeHeader(pg,S,label+' (#'+nav+')',await pg.evaluate(n=>AH.header('#'+n),nav),s);
    }catch(e){ C.ok(false,S.tag+' Painted theme everywhere: '+label+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
  }
  /* the Diamond store (the + beside diamonds) */
  try{ await home(pg); try{ if(S.touch) await pg.tap('#gemPlus',{timeout:5000}); else await pg.click('#gemPlus',{timeout:5000}); }catch(e){ await pg.evaluate(()=>openHudShop('gem')); }
    await H.wait(1800); await prep(pg);
    await pg.evaluate(async()=>{ const ims=[...document.querySelectorAll('#hudShop img.st2-cframe')]; for(let i=0;i<100&&ims.some(x=>!x.complete);i++) await new Promise(r=>setTimeout(r,100)); });
    const s=await shot(pg,S.tag+' diamond store');
    const fr=await pg.evaluate(()=>AH.frames('#hudShop .st2-card',20));
    C.ok(fr.n>=1&&!fr.bad.length,S.tag+' Framed cards: Diamond store - every diamond card on screen ('+fr.n+') wears its gold card frame',Object.assign({shot:s},fr));
    await pg.evaluate(()=>{ try{ closeHudShop(); }catch(e){} });
  }catch(e){ C.ok(false,S.tag+' Framed cards: Diamond store ran to the end',String(e&&e.stack||e).slice(0,500)); }
}

/* Settings > Account: the Google and Facebook panels side by side */
async function linkPanels(pg,S){
  try{ const how=await pg.evaluate(()=>{ const t=document.querySelector('#settings [data-settab="account"]'); if(!t) return 'no Account tab'; t.click(); return 'tab'; });
    await H.wait(2500); await prep(pg);
    const r=await pg.evaluate(()=>{ const m=id=>{ const e=document.getElementById(id); if(!e) return {present:false}; const cs=getComputedStyle(e);
        return {present:true,hidden:e.hidden||cs.display==='none',onScreen:AH.onScreen(e),box:AH.box(e),text:SL.txt(e).slice(0,80),front:SL.front(e)}; };
      const g=m('googleAuthPanel'), f=m('facebookAuthPanel'); let side=null;
      if(g.present&&f.present&&!g.hidden&&!f.hidden){ const a=g.box,b=f.box; side={sameRow:Math.abs((a.y+a.h/2)-(b.y+b.h/2))<=Math.max(a.h,b.h)/2,overlap:SL.overlap({x:a.x,y:a.y,r:a.x+a.w,b:a.y+a.h},{x:b.x,y:b.y,r:b.x+b.w,b:b.y+b.h}),gLeftOfF:a.x+a.w<=b.x+1}; }
      return {g,f,side,cfg:{google:window._googleAuthOn,facebook:window._facebookAuthOn}}; });
    const s=await shot(pg,S.tag+' Settings Account link panels');
    const sideOk=!!r.side&&r.side.sameRow&&!r.side.overlap;
    C.look(S.tag+' Link Google: Settings > Account shows the Google panel on screen, beside Facebook ['+how+'] (the link itself needs a Google client: not provable on the cluster)',{google:r.g,side:r.side,shot:s});
    C.look(S.tag+' Link Facebook: Settings > Account shows the Facebook panel on screen, side by side with Google (the link itself needs a Facebook app: not provable on the cluster)',{facebook:r.f,side:r.side,shot:s});
  }catch(e){ C.ok(false,S.tag+' Link Google: Settings > Account ran to the end',String(e&&e.stack||e).slice(0,400)); }
}

/* ---------------------------------------------------------------- Glossary creatures */
async function glossary(pg,S){
  await home(pg);
  await pg.evaluate(()=>{ if(window._ahDI) return; window._ahDI=new WeakMap(); const o=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(img,...a){ try{ const cv=this.canvas; if(cv&&cv.classList&&cv.classList.contains('glCv')){ let L=_ahDI.get(cv); if(!L){ L=[]; _ahDI.set(cv,L); }
      const isImg=(typeof HTMLImageElement!=='undefined'&&img instanceof HTMLImageElement); L.push({src:isImg?(img.currentSrc||img.src):null,iw:isImg?img.naturalWidth:img.width,ih:isImg?img.naturalHeight:img.height,pad:!isImg,a:a.slice(0,8)}); } }catch(e){} return o.call(this,img,...a); }; });
  await pg.evaluate(()=>show('glossary')); await H.wait(1500); await H.clean(pg); await prep(pg);
  const all={};
  for(const tab of ['monsters','bosses','summons']){
    try{ const sel='#glossary .glTab[data-gtab="'+tab+'"]';
      try{ if(S.touch) await pg.tap(sel,{timeout:5000}); else await pg.click(sel,{timeout:5000}); }catch(e){ await pg.evaluate(s=>document.querySelector(s).click(),sel); }
      await pg.waitForFunction(()=>{ const cv=[...document.querySelectorAll('#glGrid canvas.glCv')]; return cv.length>0&&cv.every(c=>(_ahDI.get(c)||[]).some(r=>r.pad)); },null,{timeout:60000}).catch(()=>{});
      await H.wait(500); await prep(pg);
      const r=await pg.evaluate(async tab=>{ const out=[]; for(const card of document.querySelectorAll('#glGrid .glCard')){ const id=card.dataset.id, cv=card.querySelector('canvas.glCv'), cr=card.getBoundingClientRect();
          const o={id,name:SL.txt(card.querySelector('.glName')),w:Math.round(cr.width),h:Math.round(cr.height)}; out.push(o);
          if(!cv){ o.noCanvas=true; continue; } const L=_ahDI.get(cv)||[]; const ai=L.map(x=>x.pad).lastIndexOf(true); const art=ai>=0?L[ai]:null, bg=L.slice(0,ai>=0?ai:L.length).filter(x=>!x.pad).pop();
          o.bg=bg?AH.short(bg.src).split('/').pop():null; o.bgOk=!!(bg&&bg.iw>0);
          const im=await glImg(cv.dataset.src); o.art=!!im; o.artUrl=AH.short(cv.dataset.src).split('/').pop();
          if(!im||!art){ o.ok=false; continue; }
          const IW=im.naturalWidth, IH=im.naturalHeight, P=Math.ceil(Math.max(IW,IH)); const [sx,sy,sw,sh]=art.a;
          const E=GL_EYES[id], Fr=GL_FRAME[id];
          if(E&&Fr){ o.crop='eyes (GL_EYES)'; o.fx=+(((E[0]*IW+P)-sx)/sw).toFixed(3); o.fy=+(((E[1]*IH+P)-sy)/sh).toFixed(3); o.headTop=+(((Fr[0]*IH+P)-sy)/sh).toFixed(3);
            o.ok=o.fx>=0.2&&o.fx<=0.8&&o.fy>=0.1&&o.fy<=0.75&&o.headTop>=-0.01; }   /* the face is inside the card: eyes 0.2-0.8 across, 0.1-0.75 down, head top not cut off */
          else { const m=glMeasure(im); o.crop='automatic (no eye data)'; o.fx=+(((m.hx+P)-sx)/sw).toFixed(3); o.headTop=+(((m.sy0+P)-sy)/sh).toFixed(3);
            o.ok=o.fx>=0.25&&o.fx<=0.75&&o.headTop>=-0.01&&o.headTop<=0.4; } }
        return {cards:out,list:(GLOSSARY_DATA[tab]||[]).length,sub:SL.txt(document.getElementById('glSub'))}; },tab);
      await pg.evaluate(()=>{ const g=document.getElementById('glGrid'); if(g) g.scrollIntoView({block:'start'}); const sc=document.getElementById('glossary'); if(sc) sc.scrollTop=0; });
      const s=await shot(pg,S.tag+' glossary '+tab);
      all[tab]={r,s};
      /* Runic Automaton: its card follows Phil's hand-set framing (GL_FRAME "head top of frame", top 0.05), so its eyes sit ~9% from the top -
         by design (Claude 26 Nov); printed as WATCH with its numbers, any other creature's crop still fails */
      const HAND=['runic automaton'], badAll=r.cards.filter(x=>!x.ok), bad=badAll.filter(x=>HAND.indexOf(String(x.id).toLowerCase())<0), noArt=r.cards.filter(x=>!x.art);
      if(badAll.length>bad.length) C.look(S.tag+' All creatures: '+tab+' - hand-framed card(s) with the eyes near the top edge (Phil GL_FRAME head-top rule)',badAll.filter(x=>bad.indexOf(x)<0));
      const kharos=r.cards.filter(x=>/kharos|hourglass/i.test(x.id+' '+x.name));
      C.ok(r.cards.length===r.list&&r.cards.length>0&&!noArt.length&&!bad.length,S.tag+' All creatures: Glossary > '+tab+' - '+r.cards.length+' painted cards, every image loaded, every face inside the card (eyes near the centre, head not cut off)',
        {sub:r.sub,cards:r.cards.length,list:r.list,noArt:noArt.map(x=>x.id),badCrop:bad.slice(0,12),kharos,sample:r.cards.slice(0,3),shot:s});
      const want=tab==='summons'?'summon-card-bg':'monster-card-bg', wrong=r.cards.filter(x=>!x.bg||x.bg.indexOf(want)<0||!x.bgOk);
      C.ok(r.cards.length>0&&!wrong.length,S.tag+' Card backgrounds: Glossary > '+tab+' - every card is painted on '+want+'.webp ('+(tab==='summons'?'grassy field':'burned forest')+'), loaded',
        {first:r.cards[0]&&{id:r.cards[0].id,bg:r.cards[0].bg},wrong:wrong.slice(0,8).map(x=>x.id+':'+x.bg),shot:s});
    }catch(e){ C.ok(false,S.tag+' All creatures: Glossary > '+tab+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
  }
  try{ const exp=await pg.evaluate(()=>{ const keys=Object.keys(MONSTER_TYPES).filter(k=>!(typeof HERO_TYPES!=='undefined'&&HERO_TYPES[k])); const g=['monsters','bosses','summons'].flatMap(t=>(GLOSSARY_DATA[t]||[]).map(e=>e.id));
      return {n:keys.length,shown:g.length,missing:keys.filter(k=>!g.includes(k)),extra:g.filter(k=>!keys.includes(k)),dup:g.filter((k,i)=>g.indexOf(k)!==i)}; });
    const shownCards=['monsters','bosses','summons'].reduce((a,t)=>a+((all[t]&&all[t].r.cards.length)||0),0);
    C.ok(exp.missing.length===0&&exp.dup.length===0&&shownCards===exp.n,S.tag+' All creatures: the Glossary holds every monster, boss and summon in the game ('+shownCards+' cards shown of '+exp.n+' creature types), none left out, no duplicates',
      Object.assign({shots:['monsters','bosses','summons'].map(t=>all[t]&&all[t].s)},exp));
  }catch(e){ C.ok(false,S.tag+' All creatures: the creature count ran to the end',String(e&&e.stack||e).slice(0,400)); }
}

/* ---------------------------------------------------------------- buildings */
const BUILDINGS=[['campaign','Campaign'],['market','Market'],['shadymarket','Shady Market'],['temple','Temple of Ash'],['tech','Academy'],['rankings','Bulletin Board'],['dungeon','The Vault'],
  ['wishing','Wishing Pool'],['arena','Arena'],['watchtower','Watch Tower'],['guild','Guild Hall'],['skyisland','Island of Trials'],['wall','City Wall'],['cauldron','Witches Hut'],['forge','Forge'],['well','Starless Well']];
async function buildings(pg,S){
  for(const [nav,label] of BUILDINGS){
    try{ await home(pg); const how=await H.openBuilding(pg,nav,S.touch); await pg.evaluate(AH_HELPERS);
      const root=nav==='well'?'#wlMap':'#'+(nav==='cauldron'?'wall':nav);
      await pg.waitForFunction(r=>{ const e=document.querySelector(r); return !!e&&(e.id==='wlMap'||e.classList.contains('active')); },root,{timeout:30000}).catch(()=>{});
      await H.wait(1500); await prep(pg);
      const r=await pg.evaluate(async root=>{ const el=document.querySelector(root); if(!el) return {missing:true};
        const va=innerWidth*innerHeight, us=[];
        for(const e of [el,...el.querySelectorAll('*')].slice(0,5000)){ const b=e.getBoundingClientRect(); if(b.width*b.height<va*0.4||!SL.vis(e)) continue; const cs=getComputedStyle(e);
          AH.urls(cs.backgroundImage).forEach(u=>us.push(u)); AH.urls(getComputedStyle(e,'::before').backgroundImage).forEach(u=>us.push(u)); if(e.tagName==='IMG'&&e.src) us.push(e.currentSrc||e.src);
          if(e.tagName==='CANVAS') us.push('canvas:'+e.id); if(us.length>10) break; }
        const L=await Promise.all([...new Set(us)].filter(u=>!/^canvas:/.test(u)).map(AH.load));
        const art=L.filter(x=>x.ok&&!/ui\/screen-bg\.webp/.test(x.url)).map(x=>AH.short(x.url));
        const titles=[]; for(const e of [...el.querySelectorAll('*')].slice(0,5000)){ if(!AH.onScreen(e)) continue; for(const u of [...AH.urls(getComputedStyle(e).backgroundImage),...AH.urls(getComputedStyle(e,'::after').backgroundImage)]) if(/title|wordmark/.test(u)) titles.push(u); if(e.tagName==='IMG'&&/title|wordmark/.test(e.src)) titles.push(e.src); if(titles.length>4) break; }
        const TL=await Promise.all([...new Set(titles)].map(AH.load));
        let temple=null; if(root==='#temple'){ const st=document.getElementById('tp2Stage'); const a=st?AH.urls(getComputedStyle(st,'::after').backgroundImage):[]; const al=a.length?await AH.load(a[0]):null;
          temple={stage:!!st&&AH.onScreen(st),box:st?AH.box(st):null,after:a.map(AH.short),afterOk:!!(al&&al.ok)&&/temple-title/.test(a[0]||'')}; }
        /* the Witches Hut is the City Wall's Cauldron tab: by design its own painted cauldron art (assets/img/witches-hut/) on the keep-wall backdrop,
           the title in its gold plate (inset-card) */
        let hut=null; if(root==='#wall'){ const tabOn=!!el.querySelector('[data-wall-tab="cauldron"]:not(.secondary)'), hu=[];
          for(const e of [...el.querySelectorAll('*')].slice(0,5000)){ if(!AH.onScreen(e)) continue; const b=AH.box(e); if(b.w<60||b.h<60) continue;
            if(e.tagName==='IMG'&&/\/witches-hut\//.test(e.currentSrc||e.src)) hu.push({u:e.currentSrc||e.src,box:b,img:e});
            if(e.tagName==='VIDEO'&&/\/witches-hut\//.test(e.currentSrc||e.src||'')) hu.push({u:(e.currentSrc||e.src)+(e.poster?' (poster '+e.poster+')':''),box:b,video:e});   /* the cauldron is a looping <video> with a painted poster */
            AH.urls(getComputedStyle(e).backgroundImage).filter(u=>/\/witches-hut\//.test(u)).forEach(u=>hu.push({u,box:b})); if(hu.length>5) break; }
          const HL=await Promise.all(hu.map(async x=>({u:AH.short(x.u),box:x.box,ok:x.img?(x.img.complete&&x.img.naturalWidth>0):x.video?(x.video.readyState>=2&&x.video.videoWidth>0)||(x.video.poster?(await AH.load(x.video.poster)).ok:false):(await AH.load(x.u)).ok})));
          const hb=el.querySelector('.hdrbox'), hcs=hb?getComputedStyle(hb):null, pu=hcs?AH.urls(hcs.backgroundImage)[0]:null, pl=pu?await AH.load(pu):null, h1=hb&&hb.querySelector('h1');
          const covers=!!(hb&&h1&&(()=>{ const a=hb.getBoundingClientRect(), b=h1.getBoundingClientRect(); return b.left>=a.left-1&&b.right<=a.right+1&&b.top>=a.top-1&&b.bottom<=a.bottom+1; })());
          hut={wallTab:(typeof WALL_TAB!=='undefined'?WALL_TAB:null),cauldronTabOn:tabOn,cauldronArt:HL,plate:pu?AH.short(pu):null,plateOk:!!(pl&&pl.ok)&&/inset-card/.test(pu||''),plateOnScreen:!!hb&&AH.onScreen(hb),titleInPlate:covers,title:h1?SL.txt(h1).slice(0,30):null}; }
        return {active:el.id==='wlMap'||el.classList.contains('active'),all:L.map(x=>AH.short(x.url)+(x.ok?'':' NOT LOADED')),art,canvas:us.filter(u=>/^canvas:/.test(u)),titles:TL.map(x=>AH.short(x.url)+(x.ok?'':' NOT LOADED')),temple,hut}; },root);
      const s=await shot(pg,S.tag+' '+label);
      let ok=!r.missing&&r.active&&(r.art.length>0)&&(nav!=='temple'||(r.temple&&r.temple.stage&&r.temple.afterOk)), accepted=r.art.length?'painted art '+r.art.slice(0,2).join(', '):'';
      if(nav==='cauldron'){ const h=r.hut||{}; const art=(h.cauldronArt||[]).filter(x=>x.ok);
        ok=!r.missing&&r.active&&!!h.cauldronTabOn&&art.length>0&&h.plateOk&&h.plateOnScreen&&h.titleInPlate;
        accepted='cauldron tab on: '+!!h.cauldronTabOn+'; cauldron art loaded on screen: '+(art.map(x=>x.u+' '+x.box.w+'x'+x.box.h).join(', ')||'none')+'; title "'+h.title+'" in its gold plate '+h.plate+': '+(h.plateOk&&h.titleInPlate); }
      C.ok(ok,S.tag+' Building main screens: '+label+' ('+root+', opened by '+how+') shows its own painted screen'+(nav==='temple'?' - the Temple of Ash keeps its own #tp2Stage with temple-title.webp':'')+(nav==='cauldron'?' - the City Wall Cauldron tab with its own painted cauldron art':'')+' [accepted: '+(accepted||'nothing')+']',
        {active:r.active,paintedArt:r.art,allBig:r.all,canvas:r.canvas,titleArt:r.titles,temple:r.temple,hut:r.hut,shot:s});
      judgeTheme(S,label+' ('+root+')',await pg.evaluate(rt=>AH.theme(rt),root),s);
      await judgeHeader(pg,S,label+' ('+root+')',await pg.evaluate(rt=>AH.header(rt),root),s);
    }catch(e){ C.ok(false,S.tag+' Building main screens: '+label+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
  }
  await pg.evaluate(()=>{ const w=document.getElementById('wlMap'); if(w) w.remove(); });
}

/* ---------------------------------------------------------------- the sign-in gate and Terms window (a fresh page, no session) */
async function gatePage(port,S){ const b=await H.browser();
  const ctx=await b.newContext(Object.assign({viewport:{width:S.w,height:S.h},locale:'en-US'},S.touch?{hasTouch:true,isMobile:true,deviceScaleFactor:2}:{}));
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('ew_lang','en'); }catch(e){}
    const Px=new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:(k===Symbol.toPrimitive?()=>0:(['value','currentTime','sampleRate'].includes(k)?0:Px)),apply:()=>Px,construct:()=>Px,set:()=>true});
    window.AudioContext=function(){ return Px; }; window.webkitAudioContext=window.AudioContext; });
  const pg=await ctx.newPage(); pg._errs=[]; pg._ctx=ctx; pg.on('pageerror',e=>pg._errs.push(String(e.message))); pg.on('dialog',d=>d.dismiss().catch(()=>{}));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await pg.goto('http://127.0.0.1:'+port+'/play',{waitUntil:'domcontentloaded',timeout:180000});
  await pg.waitForFunction(()=>typeof show==='function'&&typeof api==='function'&&typeof authGateOpen==='function',null,{timeout:180000});
  await H.wait(2500); await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await H.wait(1500);
  await pg.waitForFunction(()=>authGateOpen()&&document.querySelector('#authGate .agCard'),null,{timeout:40000}).catch(()=>{});
  await H.wait(800); await prep(pg); return pg; }
const FRAME_MEASURE=(sel)=>{ const c=typeof sel==='string'?document.querySelector(sel):sel; if(!c) return {missing:true};
  const host=c.parentElement, cr=c.getBoundingClientRect(), hr=host.getBoundingClientRect(), cs=getComputedStyle(c), vw=innerWidth, vh=innerHeight;
  const bw=['Top','Right','Bottom','Left'].map(k=>parseFloat(cs['border'+k+'Width'])||0), src=(cs.borderImageSource.match(/url\(["']?([^"')]+)/)||[])[1]||null;
  const gl=cr.left-hr.left, gr=hr.right-cr.right, gt=cr.top-hr.top, gb=hr.bottom-cr.bottom;
  return {card:AH.box(c),host:AH.box(host),vw,vh,gaps:{left:Math.round(gl),right:Math.round(gr),top:Math.round(gt),bottom:Math.round(gb)},
    hCentred:Math.abs(gl-gr)<=4,vCentred:Math.abs(gt-gb)<=4||(cr.height>=hr.height-48&&gt>=-1&&gb>=-1),hostCovers:hr.left<=1&&hr.top<=1&&hr.right>=vw-1&&hr.bottom>=vh-1,
    inView:cr.left>=-1&&cr.top>=-1&&cr.right<=vw+1&&cr.bottom<=vh+1,frame:src?AH.short(src):null,frameIsGold:/hud-panel/.test(src||''),widths:bw,slice:cs.borderImageSlice,text:SL.txt(c).slice(0,60)}; };
async function gate(port,S){
  let pg=null;
  try{ pg=await gatePage(port,S);
    const r=await pg.evaluate(FRAME_MEASURE,'#authGate .agCard'); let fl=null; if(r.frame) fl=await pg.evaluate(u=>SL.loadImg(u),r.frame);
    const s=await shot(pg,S.tag+' sign-in gate');
    C.ok(!r.missing&&r.hCentred&&r.vCentred&&r.hostCovers&&r.inView&&r.frameIsGold&&!!(fl&&fl.ok)&&r.widths.every(w=>w>=10),S.tag+' Centred framed card: the sign-in gate card is centred and wears the gold enamel frame on all four sides',Object.assign({frameLoaded:fl&&fl.ok,shot:s},r));
    await pg.evaluate(()=>showTerms()); await H.wait(900);
    const t=await pg.evaluate(fm=>{ const fs=[...document.querySelectorAll('body > div .ewFrame')].filter(e=>e.querySelector('[data-tos-body]')); const c=fs[fs.length-1]; return c?(new Function('return '+fm)())(c):{missing:true}; },FRAME_MEASURE.toString());
    let tl=null; if(t.frame) tl=await pg.evaluate(u=>SL.loadImg(u),t.frame);
    const s2=await shot(pg,S.tag+' Terms window');
    C.ok(!t.missing&&t.hCentred&&t.vCentred&&t.hostCovers&&t.inView&&t.frameIsGold&&!!(tl&&tl.ok)&&t.widths.every(w=>w>=10),S.tag+' Centred framed card: the Terms window is centred and wears the gold enamel frame on all four sides',Object.assign({frameLoaded:tl&&tl.ok,shot:s2},t));
    C.ok(pg._errs.length===0,S.tag+' Centred framed card: no page errors on the sign-in gate',pg._errs.slice(0,3));
  }catch(e){ C.ok(false,S.tag+' Centred framed card: ran to the end',String(e&&e.stack||e).slice(0,500)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} }
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.quests={claimed:{},chainStep:0}; u.led.gems=5000; });
  const s=await H.server(file); let pg=null;
  try{
    for(const k of ['phone','desktop']){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch}); await prep(pg);
      try{ await menuScreens(pg,S); }catch(e){ C.ok(false,S.tag+' Painted theme everywhere: menu screens ran to the end',String(e&&e.stack||e).slice(0,500)); }
      try{ await glossary(pg,S); }catch(e){ C.ok(false,S.tag+' All creatures: ran to the end',String(e&&e.stack||e).slice(0,500)); }
      try{ await buildings(pg,S); }catch(e){ C.ok(false,S.tag+' Building main screens: ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
    for(const S of [H.SIZES.phone,H.SIZES.fold,FOLD_OPEN,H.SIZES.tablet,H.SIZES.desktop]) await gate(s.port,S);
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
