'use strict';
/* Lockdown audit 26 Nov 2026, round 4: 16 - Mail, Quests, Sign-in, Tutorial (mail-quests-tutorial-feedback.md, the UNPROVEN-ON-SCREEN lines),
   in a real browser on this checkout's server (temp DB, a fresh player: no stage cleared, tutorial not started), at phone 844x390 (touch)
   and desktop 1280x720; Framed list also at tablet 1024x768.
   - Gold glow guide: Welcome pop-up > Start Tutorial > Go on "clear 1-1": inside Campaign the 1-1 plate glows gold (tut-target-glow) with
     the halo + bouncing arrow (#tutFx); Base > in town the Campaign plate glows (tut-town-glow), the halo rings the building, the arrow bobs.
   - Menu glow: a Quests lesson glows MENU, then Quests inside it; a waiting reward glows MENU, then Start Here.
   - Hero-specific glow: skill and glyph lessons - another hero's window has no glow; Vael's card and Vael's window do.
   - Free roaming: Start Here > Base opens the town and stays there; Start Here is still in the MENU.
   - Starts at top, scrolls to step: Start Here, scrolled to the bottom and closed, reopens at the top; the current step's button then
     sits on screen and is not covered.
   - Framed list: the Start Here list wears the hud-panel gold frame (border art loaded, all four sides inside the screen).
   - Stage 1-1 ultimate coach: a real Normal 1-1 first clear: the fight holds (battle clock stopped) at each hero's first ready ult.
   - Coach aiming: an aimed ult draws the gold ring; letting go away from the ring re-prompts (fight still held); dragging onto it casts.
   - Tap to continue: while a coach hold shows the speaker's last bubble, "Tap to continue" shows on screen by it.
   - Vael's coached ult at 90% HP: Vael's energy stays under 100 while his HP is over 90%, his ult is ready at about 90% (vael_ready).
   One screenshot per line per size (SHOT64 lines). Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_mail.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:1,vireo:1,sylthaine:1,aureth:1};
const TRIO=['vael','vireo','sylthaine'];
const NOW=Date.now();
const N={glow:'Gold glow guide',menu:'Menu glow',hero:'Hero-specific glow',roam:'Free roaming',top:'Starts at top, scrolls to step',frame:'Framed list',
  coach:'Stage 1-1 ultimate coach',aim:'Coach aiming',cont:'Tap to continue',vael:"Vael's coached ult at 90% HP"};

const settle=async(pg,ms)=>{ await H.wait(ms||800); await H.prep(pg); };
const press=async(pg,S,sel)=>{ try{ if(S.touch) await pg.tap(sel,{timeout:8000}); else await pg.click(sel,{timeout:8000}); return 'tap'; }
  catch(e){ await pg.evaluate(s=>{ const el=document.querySelector(s); if(el) el.click(); },sel); return 'js-click ('+String(e.message||e).split('\n')[0].slice(0,80)+')'; } };
/* the tutorial as the player has it: started, not skipped, these steps already claimed (local G only - the setup, not the check) */
const setTut=(pg,rew,extra)=>pg.evaluate(([rew,extra])=>{ G.tutSkipped=false; G.tutDone=false; G.tutStarted=true; G.ftutOff=true; G.tutRewarded=Object.assign({},rew); G.tutFocusStep=null;
  if(extra) Object.assign(G,extra); try{ saveGLocalOnly(); }catch(e){} document.querySelectorAll('.tut-target-glow,.tut-town-glow').forEach(e=>e.classList.remove('tut-target-glow','tut-town-glow')); return true; },[rew||{},extra||null]);
const closeMenu=pg=>pg.evaluate(()=>{ const hm=document.getElementById('hubMenu'); if(hm) hm.classList.remove('open'); });

/* the glow on element `sel` (+ the #tutFx halo around `haloSel` or the element, the arrow by the element, bobbing between frames) */
const glowProbe=(pg,sel,haloSel)=>pg.evaluate(async([sel,haloSel])=>{ const t=document.querySelector(sel); if(!t) return {missing:sel};
  const cls=[...t.classList].filter(c=>/tut-/.test(c)), cs=getComputedStyle(t);
  const h=haloSel?document.querySelector(haloSel):t, fx=document.getElementById('tutFx'), a=fx&&fx.querySelector('.tfArrow'), ha=fx&&fx.querySelector('.tfHalo');
  const ys=[]; for(let i=0;i<5;i++){ if(a) ys.push(Math.round(a.getBoundingClientRect().top*10)/10); await new Promise(r=>setTimeout(r,110)); }
  const tr=SL.R(t), hr=h?SL.R(h):null, ar=a?SL.R(a):null, hb=ha?SL.R(ha):null, fcs=fx?getComputedStyle(fx):null;
  const hc=hr&&{x:hr.x+hr.w/2,y:hr.y+hr.h/2}, hbc=hb&&{x:hb.x+hb.w/2,y:hb.y+hb.h/2};
  const haloOn=!!(hc&&hbc&&Math.abs(hc.x-hbc.x)<=8&&Math.abs(hc.y-hbc.y)<=8&&hb.w>=Math.min(hr.w,hr.w)&&hb.h>=hr.h-1);
  const arrowBy=!!(ar&&tr&&(ar.x+ar.w/2)>=tr.x-ar.w&&(ar.x+ar.w/2)<=tr.r+ar.w&&((ar.b<=tr.y+6&&tr.y-ar.b<40)||(ar.y>=tr.b-6&&ar.y-tr.b<40)));
  return {cls,outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor,anim:cs.animationName,target:tr,targetOn:SL.inView(t,2),
    fx:fcs?{display:fcs.display,vis:fcs.visibility}:null,halo:hb,haloAround:hr,haloOn,arrow:ar,arrowBy,arrowYs:ys,bob:ys.length?Math.round((Math.max(...ys)-Math.min(...ys))*10)/10:0,
    arrowAnim:a?a.getAnimations().length:0}; },[sel,haloSel||null]);
const glowOk=g=>!g.missing&&g.cls.length>0&&/solid/.test(g.outline)&&g.fx&&g.fx.display==='block'&&g.fx.vis==='visible'&&g.haloOn&&g.arrowBy&&g.bob>=2&&g.targetOn;
const glowing=pg=>pg.evaluate(()=>[...document.querySelectorAll('.tut-target-glow,.tut-town-glow')].filter(e=>e.getClientRects().length).map(e=>(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.dataset.nav?'[nav='+e.dataset.nav+']':'')+(e.dataset.heroKey?'[hero='+e.dataset.heroKey+']':'')+(e.dataset.tab?'[tab='+e.dataset.tab+']':'')+(e.dataset.skillup!=null?'[skillup]':'')+(e.hasAttribute('data-tut-glyph-build')?'[glyph]':'')).slice(0,70)));

/* ---------------- town / screens (one context per size) ---------------- */
async function welcomeAndGlow(pg,S){
  await pg.evaluate(()=>{ G.tutSkipped=false; G.tutDone=false; G.tutStarted=false; G.tutRewarded={}; G.ftutOff=true; try{ saveGLocalOnly(); }catch(e){} show('home'); });
  await settle(pg,1200);
  const offer=await pg.evaluate(()=>{ try{ maybeOfferTutorial(); }catch(e){} const o=document.getElementById('tutOffer'); return {shown:!!o,cleared:G.campaignCleared|0}; });
  let how='Start Tutorial';
  if(offer.shown){ await press(pg,S,'#tutStart'); } else { how='no Welcome pop-up (set started)'; await setTut(pg,{}); await pg.evaluate(()=>show('tutorial')); }
  await pg.waitForFunction(()=>state==='tutorial'&&document.querySelector('#tutorialBody [data-tut-go]'),null,{timeout:20000}).catch(()=>{}); await settle(pg,1000);
  console.log('  INFO   '+S.tag+' tutorial started by: '+how+' '+JSON.stringify(offer));
  /* inside a screen: Go on clear 1-1 -> Campaign, the 1-1 plate */
  const go=await press(pg,S,'#tutorialBody [data-tut-go="win11"]');
  await pg.waitForFunction(()=>state==='campaign'&&document.querySelector('#cmap .cnode'),null,{timeout:30000}).catch(()=>{}); await settle(pg,1800);
  const gIn=await glowProbe(pg,'#cmap .cnode[data-tut-stage="1"]');
  const s1=await shot(pg,S.tag+' Gold glow guide in Campaign');
  C.ok(glowOk(gIn),S.tag+' '+N.glow+': inside Campaign (Go on "clear 1-1", '+go+') the 1-1 plate glows gold, the halo rings it and the arrow bobs by it ('+gIn.bob+' px)',{...gIn,shot:s1});
  /* Base -> the town: the Campaign plate glows, the halo rings the building */
  const back=await press(pg,S,'#campaign .backbtn');
  await pg.waitForFunction(()=>state==='home',null,{timeout:15000}).catch(()=>{}); await settle(pg,1500);
  const gT=await glowProbe(pg,'#townHots .townlbl[data-nav="campaign"]','#townHots .townlbl[data-nav="campaign"]');
  const halo=await pg.evaluate(()=>{ const l=document.querySelector('#townHots .townlbl[data-nav="campaign"]'), b=l&&l.previousElementSibling, hb=document.querySelector('#tutFx .tfHalo');
    if(!b||!hb||!b.classList.contains('hot')) return {hot:false}; const r=SL.R(b), q=SL.R(hb); return {hot:true,box:r,halo:q,dx:Math.round(Math.abs((r.x+r.w/2)-(q.x+q.w/2))),dy:Math.round(Math.abs((r.y+r.h/2)-(q.y+q.h/2)))}; });
  const s2=await shot(pg,S.tag+' Gold glow guide in town');
  const townHaloOk=halo.hot&&halo.dx<=8&&halo.dy<=8&&halo.halo.w>=halo.box.w;
  C.ok(!gT.missing&&gT.cls.includes('tut-town-glow')&&/solid/.test(gT.outline)&&gT.fx&&gT.fx.display==='block'&&gT.fx.vis==='visible'&&townHaloOk&&gT.arrowBy&&gT.bob>=2&&gT.targetOn,
    S.tag+' '+N.glow+': in town (Base, '+back+') the Campaign name plate glows gold, the halo rings the Campaign building and the arrow bobs by the plate ('+gT.bob+' px)',{plate:gT,building:halo,shot:s2});
}

async function menuGlow(pg,S){
  await setTut(pg,{win11:true},{questChainStep:0}); await pg.evaluate(()=>show('home')); await settle(pg,1300);
  const a=await glowProbe(pg,'#menuBtn'); const s1=await shot(pg,S.tag+' Menu glow MENU for Quests');
  await press(pg,S,'#menuBtn'); await settle(pg,900);
  const b=await glowProbe(pg,'#hubMenu .mitem[data-nav="quest"]'); const gl1=await glowing(pg); const s2=await shot(pg,S.tag+' Menu glow Quests entry');
  C.ok(glowOk(a)&&glowOk(b)&&!gl1.some(x=>/menuBtn/.test(x)),S.tag+' '+N.menu+': with the Quests lesson open MENU glows, then (MENU opened) the Quests entry glows and MENU no longer does',{menu:a,entry:b,glowing:gl1,shot:[s1,s2]});
  await closeMenu(pg);
  await setTut(pg,{win11:true},{questChainStep:1}); await pg.evaluate(()=>show('home')); await settle(pg,1300);
  const ready=await pg.evaluate(()=>{ const n=tutNextStep(); return n; });
  const c=await glowProbe(pg,'#menuBtn'); const s3=await shot(pg,S.tag+' Menu glow MENU for a waiting reward');
  await press(pg,S,'#menuBtn'); await settle(pg,900);
  const d=await glowProbe(pg,'#hubMenu .mitem[data-nav="tutorial"]'); const gl2=await glowing(pg); const s4=await shot(pg,S.tag+' Menu glow Start Here entry');
  C.ok(!!ready&&ready.ready&&glowOk(c)&&glowOk(d)&&!gl2.some(x=>/nav=quest/.test(x)),S.tag+' '+N.menu+': with a reward waiting ('+(ready&&ready.id)+') MENU glows, then the Start Here entry glows (not Quests)',{next:ready,menu:c,entry:d,glowing:gl2,shot:[s3,s4]});
  await closeMenu(pg); await pg.evaluate(()=>{ try{ ledgerSync(); }catch(e){} });
}

async function openHeroes(pg,S){ await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} show('home'); }); await settle(pg,900);
  await press(pg,S,'#menuBtn'); await settle(pg,600); await press(pg,S,'#hubMenu .mitem[data-nav="heroesPanel"]');
  await pg.waitForFunction(()=>state==='heroesPanel'&&document.querySelector('#heroesPanel .hero-card[data-hero-key="vael"]'),null,{timeout:20000}).catch(()=>{}); await settle(pg,1500); }
async function openHero(pg,S,key){ const sel='#heroesPanel .hero-card[data-hero-key="'+key+'"]';
  await pg.evaluate(s=>{ const e=document.querySelector(s); if(e) e.scrollIntoView({block:'center'}); },sel); await H.wait(300);
  const how=await press(pg,S,sel);
  await pg.waitForFunction(k=>detailHero===k&&document.querySelector('#heroDetail')&&document.querySelector('#heroDetail').getClientRects().length,key,{timeout:20000}).catch(()=>{}); await settle(pg,1500); return how; }
/* Start Here (MENU) > Go on lesson `id`: the lesson's own path (s.go()) */
async function goLesson(pg,S,id,want){ await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} show('home'); }); await settle(pg,900);
  await press(pg,S,'#menuBtn'); await settle(pg,600); await press(pg,S,'#hubMenu .mitem[data-nav="tutorial"]');
  await pg.waitForFunction(i=>document.querySelector('#tutorialBody [data-tut-go="'+i+'"]')&&document.querySelector('#tutorialBody [data-tut-go="'+i+'"]').getClientRects().length,id,{timeout:15000}).catch(()=>{}); await settle(pg,700);
  const sel='#tutorialBody [data-tut-go="'+id+'"]'; await pg.evaluate(s=>{ const e=document.querySelector(s); if(e) e.scrollIntoView({block:'center'}); },sel); await H.wait(300);
  const how=await press(pg,S,sel);
  await pg.waitForFunction(w=>state===w,want,{timeout:20000}).catch(()=>{}); await settle(pg,1500);
  return {how,state:await pg.evaluate(()=>state)}; }
async function heroGlow(pg,S){
  for(const [lesson,rew,want] of [['skill',{win11:true,quest11:true},/skillup|tab=skills/],['rune',{win11:true,quest11:true,skill:true,win12:true,quest12:true},/glyph|tab=glyphs/]]){
    await setTut(pg,rew,{questChainStep:0});
    /* INFO: Heroes opened from MENU during the lesson (a pop-out over the town) */
    await openHeroes(pg,S); const viaMenu=await glowing(pg); const viaMenuState=await pg.evaluate(()=>state);
    console.log('  INFO   '+S.tag+' '+N.hero+' ('+lesson+' lesson): Heroes opened from MENU (state '+viaMenuState+') - glowing: '+JSON.stringify(viaMenu));
    const go=await goLesson(pg,S,lesson,'heroesPanel');
    await pg.waitForFunction(()=>document.querySelector('#heroesPanel .hero-card[data-hero-key="vael"]'),null,{timeout:15000}).catch(()=>{}); await settle(pg,900);
    const next=await pg.evaluate(()=>tutNextStep());
    const list=await glowing(pg); const vaelCard=await glowProbe(pg,'#heroesPanel .hero-card[data-hero-key="vael"]');
    const s1=await shot(pg,S.tag+' Hero-specific glow '+lesson+' Heroes list');
    const hA=await openHero(pg,S,'aureth'); const other=await glowing(pg); const dh1=await pg.evaluate(()=>detailHero);
    const s2=await shot(pg,S.tag+' Hero-specific glow '+lesson+' Aureth window');
    await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} }); await settle(pg,900);
    let reopened=null; if(await pg.evaluate(()=>state!=='heroesPanel'||!document.querySelector('#heroesPanel .hero-card[data-hero-key="vael"]')||!document.querySelector('#heroesPanel .hero-card[data-hero-key="vael"]').getClientRects().length)) reopened=await goLesson(pg,S,lesson,'heroesPanel');
    const hV=await openHero(pg,S,'vael'); const mine=await glowing(pg); const dh2=await pg.evaluate(()=>detailHero);
    const vt=await pg.evaluate(()=>{ const e=document.querySelector('#heroDetail .tut-target-glow'); return e?{box:SL.R(e),on:SL.inView(e,2),front:SL.front(e)}:null; });
    const s3=await shot(pg,S.tag+' Hero-specific glow '+lesson+' Vael window');
    const listOk=list.some(x=>/hero=vael/.test(x))&&!list.some(x=>/hero=/.test(x)&&!/hero=vael/.test(x));
    C.ok(go.state==='heroesPanel'&&!!next&&next.id===lesson&&listOk&&dh1==='aureth'&&other.length===0&&dh2==='vael'&&mine.some(x=>want.test(x))&&!!vt&&vt.on,
      S.tag+' '+N.hero+': '+lesson+' lesson (Start Here > Go, '+go.how+') - in the Heroes list only Vael\'s card glows; Aureth\'s window ('+hA+') glows nothing; Vael\'s window ('+hV+') glows its '+(lesson==='skill'?'skill upgrade':'glyph')+' control',
      {go,reopened,viaMenu:{state:viaMenuState,glowing:viaMenu},next,list,vaelCard:{cls:vaelCard.cls,fx:vaelCard.fx,haloOn:vaelCard.haloOn},aureth:{detail:dh1,glowing:other},vael:{detail:dh2,glowing:mine,target:vt},shot:[s1,s2,s3]});
    await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} show('home'); }); await settle(pg,700);
  }
}

async function roam(pg,S){
  await setTut(pg,{});
  const go=await goLesson(pg,S,'win11','campaign'); const st0=go.state;   /* Start Here > Go on "clear 1-1": Campaign, a full screen with Base */
  const how=await press(pg,S,'#campaign .backbtn'); await settle(pg,1200);
  const st1=await pg.evaluate(()=>state); await H.wait(2000); const st2=await pg.evaluate(()=>({state,started:!!G.tutStarted,done:!!G.tutDone}));
  await press(pg,S,'#menuBtn'); await settle(pg,700);
  const item=await pg.evaluate(()=>{ const e=document.querySelector('#hubMenu .mitem[data-nav="tutorial"]'); return e?{vis:SL.vis(e),on:SL.inView(e,2),text:SL.txt(e)}:null; });
  const s=await shot(pg,S.tag+' Free roaming town with Start Here in MENU');
  C.ok(st0==='campaign'&&!/js-click/.test(how)&&st1==='home'&&st2.state==='home'&&st2.started&&!st2.done&&!!item&&item.vis&&item.on,S.tag+' '+N.roam+': during the tutorial (Start Here > Go: Campaign) Base on Campaign ('+how+') opens the town and it stays open 2 s later; Start Here is still in the MENU',{before:st0,after:st1,later:st2,item,shot:s});
  await closeMenu(pg);
}

/* Start Here: scrolled to the bottom and closed, then reopened from MENU - its scroll position at the moment the list is drawn, then the
   current step's button; + the frame (all sizes) */
async function startHere(pg,S,frameOnly){
  await setTut(pg,{}); await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} show('home'); }); await settle(pg,900);
  const openSH=async()=>{ await press(pg,S,'#menuBtn'); await settle(pg,600); await press(pg,S,'#hubMenu .mitem[data-nav="tutorial"]');
    await pg.waitForFunction(()=>state==='tutorial'&&document.querySelector('#tutorialBody .qcard'),null,{timeout:15000}).catch(()=>{}); };
  const host=()=>pg.evaluate(()=>{ const b=document.getElementById('tutorialBody'); let e=b; while(e&&e!==document.body){ const cs=getComputedStyle(e); if(/auto|scroll|overlay/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+1){ e.setAttribute('data-sl-host','1'); return e.id||e.className; } e=e.parentElement; } return null; });
  await openSH(); await settle(pg,1000); const hid=await host();
  const scrolledTo=await pg.evaluate(()=>{ const e=document.querySelector('[data-sl-host]'); if(!e) return null; e.scrollTop=e.scrollHeight; return e.scrollTop; });
  await settle(pg,400);
  /* the frame: art, widths, the four sides on screen (top at the top, bottom at the bottom of the scroll) */
  const fr=await pg.evaluate(async()=>{ const b=document.getElementById('tutorialBody'), cs=getComputedStyle(b), u=((cs.borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1];
    const img=u?await SL.loadImg(u):null, V=SL.V(), e=document.querySelector('[data-sl-host]');
    const bottom=SL.R(b); if(e) e.scrollTop=0; await new Promise(r=>setTimeout(r,250)); const top=SL.R(b);
    return {src:u?u.replace(location.origin,''):null,loaded:!!(img&&img.ok),slice:cs.borderImageSlice,widths:[cs.borderTopWidth,cs.borderRightWidth,cs.borderBottomWidth,cs.borderLeftWidth].map(parseFloat),
      top,bottom,view:V,left:top.x>=-1,right:top.r<=V.width+1,topOn:top.y>=-1&&top.y<V.height,bottomOn:bottom.b<=V.height+1&&bottom.b>0,scrolls:!!e}; });
  const sf=await shot(pg,S.tag+' Framed list Start Here');
  C.ok(/hud-panel/.test(fr.src||'')&&fr.loaded&&fr.widths.every(w=>w>=10)&&fr.left&&fr.right&&fr.topOn&&fr.bottomOn,S.tag+' '+N.frame+': the Start Here list wears the gold hud-panel frame (art loaded, '+fr.widths.join('/')+' px), its left and right sides on screen, its top on screen at the top and its bottom at the end of the scroll',{...fr,host:hid,shot:sf});
  if(frameOnly) return;
  /* close at the bottom, reopen */
  await pg.evaluate(()=>{ const e=document.querySelector('[data-sl-host]'); if(e) e.scrollTop=e.scrollHeight; }); await H.wait(300);
  const atBottom=await pg.evaluate(()=>{ const e=document.querySelector('[data-sl-host]'); return e?e.scrollTop:null; });
  await press(pg,S,'#tutorial .backbtn'); await settle(pg,900);
  await pg.evaluate(()=>{ window.__slTop=[]; const b=document.getElementById('tutorialBody'), rec=w=>{ const e=document.querySelector('[data-sl-host]')||document.getElementById('tutorial'); window.__slTop.push([w,e?e.scrollTop:null]); };
    if(window.__slMO) window.__slMO.disconnect(); window.__slMO=new MutationObserver(()=>{ rec('drawn'); setTimeout(()=>rec('+20ms'),20); }); window.__slMO.observe(b,{childList:true}); });
  await openSH(); await settle(pg,1300);
  const r=await pg.evaluate(()=>{ if(window.__slMO){ window.__slMO.disconnect(); window.__slMO=null; } const nb=document.querySelector('#tutorialBody .tut-next-glow')||document.querySelector('#tutorialBody [data-tut-go]'), e=document.querySelector('[data-sl-host]');
    return {log:window.__slTop,btn:nb?{text:SL.txt(nb),box:SL.R(nb),on:SL.inView(nb,1),front:SL.front(nb),who:SL.whoAt(nb)}:null,scrollNow:e?e.scrollTop:null,view:SL.V()}; });
  const s=await shot(pg,S.tag+' Starts at top scrolls to step');
  const first=(r.log||[]).find(x=>x[0]==='+20ms')||(r.log||[])[0];
  C.ok((hid?atBottom>0:true)&&!!first&&first[1]!=null&&first[1]<=2&&!!r.btn&&r.btn.on&&r.btn.front,S.tag+' '+N.top+': Start Here closed scrolled down ('+atBottom+' px) reopens at the top (scroll '+(first?first[1]:'?')+' px when drawn), then the current step\'s button "'+(r.btn?r.btn.text:'')+'" is on screen and not covered',{...r,closedAt:atBottom,scrolledTo,shot:s});
}

/* ---------------- the real Normal 1-1 first clear ---------------- */
async function ptDown(pg,S,cdp,p){ if(S.touch) await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]}); else { await pg.mouse.move(p.x,p.y); await pg.mouse.down(); } }
async function ptMove(pg,S,cdp,from,to,steps){ for(let i=1;i<=steps;i++){ const x=from.x+(to.x-from.x)*i/steps, y=from.y+(to.y-from.y)*i/steps;
  if(S.touch) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y,id:1}]}); else await pg.mouse.move(x,y); await H.wait(40); } }
async function ptUp(pg,S,cdp,p){ if(S.touch) await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); else await pg.mouse.up(); }
const portrait=pg=>pg.evaluate(()=>{ const u=ULTCOACH.u, e=u&&u._pEl; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
const holdState=pg=>pg.evaluate(()=>{ const u=ULTCOACH.u, h=document.getElementById('ultHint'), b=document.getElementById('introContinue'), S=CUR&&CUR._introSay;
  return {hold:!!ULTCOACH.hold,key:u&&u.key,uid:u&&u.uid,energy:u?Math.round(u.energy*10)/10:null,hp:u?Math.round(u.hp/u.maxHp*1000)/10:null,bt:+battleTime.toFixed(4),aiming:aiming?aiming.key:null,
    ring:ULTCOACH.ring?{x:Math.round(ULTCOACH.ring.x),y:Math.round(ULTCOACH.ring.y)}:null,hint:h?{text:SL.txt(h),coach:h.classList.contains('ult-coach'),vis:SL.vis(h)}:null,
    glow:!!(u&&u._pEl&&u._pEl.classList.contains('ult-coach-glow')),say:S?{k:S.k,uid:S.uid,read:!!S.read}:null,
    cont:b?{vis:SL.vis(b)&&!b.hidden,text:SL.txt(b),box:SL.R(b),on:SL.inView(b,1),front:SL.vis(b)?SL.front(b):false}:null,ended:!!ended,state}; });
/* the ring is drawn by ultCoachDraw on #overlay (octx, setTransform(PR) - layout px x PR = canvas px), radius 34 +- 6 px breathing, 4 px gold stroke.
   Count the draw calls (wrapped once) and scan its whole band (r 22-48 layout px) on 24 rays in the canvas's own pixel space. */
const ringProbe=pg=>pg.evaluate(async()=>{ if(!window.__slRingWrap){ window.__slRingWrap=1; window.__slRingCalls=0; const o=ultCoachDraw; window.ultCoachDraw=function(){ if(ULTCOACH.ring&&ULTCOACH.u&&aiming===ULTCOACH.u) window.__slRingCalls++; return o.apply(this,arguments); }; }
  const c0=window.__slRingCalls; await new Promise(r=>setTimeout(r,400)); const calls=window.__slRingCalls-c0;
  const c=ULTCOACH.ring; if(!c) return {ring:null,calls};
  const r=overlay.getBoundingClientRect(), er=overlay.ewGameRect?overlay.ewGameRect():r, z=(typeof battleZoom==='number'&&battleZoom>0)?battleZoom:1, k=r.width/Math.max(1,er.width);
  const ctx=overlay.getContext('2d'), sx=overlay.width/Math.max(1,CW), sy=overlay.height/Math.max(1,CH);
  let rays=0, best=[], err=null; const cols=[];
  try{ for(let i=0;i<24;i++){ const a=i/24*Math.PI*2; let hit=null, top=null;
      for(let R=22;R<=48;R+=1){ const px=Math.round((c.x+Math.cos(a)*R)*sx), py=Math.round((c.y+Math.sin(a)*R)*sy); const d=ctx.getImageData(px,py,1,1).data;
        const sc=d[3]*(d[0]+d[1]-d[2]); if(!top||sc>top.sc) top={R,px,py,rgba:[d[0],d[1],d[2],d[3]],sc};
        if(!hit&&d[0]>200&&d[1]>150&&d[2]<160&&d[3]>120) hit={R,rgba:[d[0],d[1],d[2],d[3]]}; }
      if(hit) rays++; if(i%6===0) cols.push({ray:i,hit,top}); } }catch(e){ err=String(e.message||e).slice(0,120); }
  const ctr=(()=>{ try{ return [...ctx.getImageData(Math.round(c.x*sx),Math.round(c.y*sy),1,1).data]; }catch(e){ return null; } })();
  return {ring:{x:Math.round(c.x),y:Math.round(c.y)},client:{x:r.left+c.x*z*k,y:r.top+c.y*z*k},canvas:{id:overlay.id,w:overlay.width,h:overlay.height,css:[Math.round(r.width),Math.round(r.height)],CW,CH,PR:+sx.toFixed(3),dpr:devicePixelRatio,left:Math.round(r.left),top:Math.round(r.top),zoom:z,transform:getComputedStyle(overlay).transform},
    calls,gold:rays,of:24,centre:ctr,samples:cols,err}; });

async function coach(pg,S){
  const cdp=S.touch?await pg._ctx.newCDPSession(pg):null;
  await pg.evaluate(()=>{ G.tutStarted=false; G.tutSkipped=true; try{ saveGLocalOnly(); }catch(e){} document.querySelectorAll('.tut-target-glow,.tut-town-glow').forEach(e=>e.classList.remove('tut-target-glow','tut-town-glow')); try{ tutFxShow(null); }catch(e){} });
  const how=await H.openBuilding(pg,'campaign',S.touch);
  await pg.waitForFunction(()=>state==='campaign'&&document.querySelector('#cmap .cnode[data-stage-plate="1"]'),null,{timeout:30000}).catch(()=>{}); await settle(pg,1200);
  await pg.evaluate(()=>{ const n=document.querySelector('#cmap .cnode[data-stage-plate="1"]'), sc=document.getElementById('cmapScroll'); if(n&&sc){ const nb=n.getBoundingClientRect(), sb=sc.getBoundingClientRect(); sc.scrollLeft+=(nb.left+nb.width/2)-(sb.left+sb.width/2); } });
  await H.wait(400); await press(pg,S,'#cmap .cnode[data-stage-plate="1"]'); await H.wait(900); await press(pg,S,'#smBattle');
  await pg.waitForFunction(()=>state==='menu',null,{timeout:20000}).catch(()=>{}); await H.wait(1500); await H.clean(pg);
  await press(pg,S,'#startBtn');
  await pg.waitForFunction(()=>state==='battle'&&!document.getElementById('battleLoader')&&units.length>0,null,{timeout:180000}); await H.wait(1500); await H.prep(pg);
  const st=await pg.evaluate(()=>({mode:CUR.mode,node:CUR.node,portal:CUR.portal||'normal',intro:!!CUR._intro,introUI:!!CUR._introUI,armed:ultCoachArmed(),auto:!!autoUlt||isAutoBattle(),cleared:G.campaignCleared|0,
    allies:units.filter(u=>u.team==='ally').map(u=>u.key),bench:(_introBench||[]).map(u=>u.key)}));
  console.log('  INFO   '+S.tag+' 1-1 started (campaign by '+how+'): '+JSON.stringify(st));
  /* Vael's energy and HP, sampled every 40 ms until his ult is ready */
  await pg.evaluate(()=>{ window.__slV={preMax:0,samples:0,full:null}; window.__slVt=setInterval(()=>{ try{ const I=CUR&&CUR._intro; if(!I) return; const v=unitByUid(I.vael); if(!v) return; window.__slV.samples++;
      if(!I.vaelFull&&v.hp>v.maxHp*0.90) window.__slV.preMax=Math.max(window.__slV.preMax,v.energy);
      if(I.vaelFull!=null&&!window.__slV.full) window.__slV.full={hp:Math.round(v.hp/v.maxHp*1000)/10,energy:v.energy,at:+I.vaelFull.toFixed(2),say:CUR._introSay&&CUR._introSay.k}; }catch(e){} },40); });
  const seen={}, holds=[]; let negDone=null, posDone=null, firstShot=null;
  for(let h=0;h<3;h++){
    const t0=Date.now(); let hs=null;
    let stuck=0; while(Date.now()-t0<240000){ hs=await holdState(pg); if(hs.ended||hs.state!=='battle') break; if(hs.hold&&hs.uid!=null&&!seen[hs.uid]) break; if(hs.hold&&seen[hs.uid]&&++stuck>40) break; await H.wait(250); }
    if(!hs||!hs.hold||seen[hs.uid]){ console.log('  INFO   '+S.tag+' no further coach hold (hold '+(h+1)+'): '+JSON.stringify(hs)); break; }
    seen[hs.uid]=1; await H.wait(900); const a=await holdState(pg); await H.wait(1500); const b=await holdState(pg);
    const vv=a.key==='vael'?await pg.evaluate(()=>window.__slV):null;
    const sh=await shot(pg,S.tag+' coach hold '+a.key); if(!firstShot) firstShot=sh;
    const rec={key:a.key,uid:a.uid,energy:a.energy,hp:a.hp,bt:[a.bt,b.bt],held:a.hold&&b.hold,frozen:a.bt===b.bt,hint:a.hint,glow:a.glow,say:a.say,cont:a.cont,vael:vv,shot:sh};
    const ab=await pg.evaluate(()=>{ const u=ULTCOACH.u; const k=u&&(u.abilityOverride||u.t.ability); return {ability:k,aimed:ULT_AIMED.includes(k)}; }); rec.ability=ab;
    /* the cast: aimed -> (once) let go away from the ring, then drag onto it; not aimed -> tap the portrait */
    if(ab.aimed){
      if(!negDone){ const p=await portrait(pg); await ptDown(pg,S,cdp,p); await H.wait(600); const rg=await ringProbe(pg); const as=await holdState(pg);
        let away=null; if(rg){ const V=await pg.evaluate(()=>SL.V()); for(const [dx,dy] of [[0,-130],[150,0],[-150,0],[0,120]]){ const q={x:rg.client.x+dx,y:rg.client.y+dy}; if(q.x>20&&q.x<V.width-20&&q.y>20&&q.y<V.height-20){ const oc=await pg.evaluate(q=>{ try{ return overCancel(q.x,q.y); }catch(e){ return false; } },q); if(!oc){ away=q; break; } } } }
        await pg.evaluate(()=>{ window.__slUp=null; document.addEventListener('pointerup',e=>{ try{ const q=evXY(e); window.__slUp={x:Math.round(q.x),y:Math.round(q.y),onRing:ultCoachOnRing(q.x,q.y)}; }catch(_){} },{capture:true,once:true}); });
        await ptMove(pg,S,cdp,p,away||{x:p.x,y:p.y-130},6); await ptUp(pg,S,cdp,away||p); await H.wait(800); const af=await holdState(pg); await H.wait(800); const af2=await holdState(pg);
        const sn=await shot(pg,S.tag+' Coach aiming let go away from the ring');
        negDone={key:a.key,whileAiming:{aiming:as.aiming,ring:rg,hint:as.hint&&as.hint.text},releasedAt:away,up:await pg.evaluate(()=>window.__slUp),after:{aiming:af.aiming,hold:af.hold,key:af.key,hint:af.hint,bt:[af.bt,af2.bt]},shot:sn,
          ok:as.aiming===a.key&&!!rg&&rg.calls>0&&rg.gold>=8&&!!away&&af.aiming==null&&af.hold&&af.key===a.key&&af2.hold&&af.bt===af2.bt&&!!af.hint&&af.hint.vis&&af.hint.coach&&af.glow}; }
      const p=await portrait(pg); await ptDown(pg,S,cdp,p); await H.wait(600); const rg=await ringProbe(pg); const as=await holdState(pg);
      const ss=await shot(pg,S.tag+' Coach aiming gold ring '+a.key);
      await pg.evaluate(()=>{ window.__slUp=null; document.addEventListener('pointerup',e=>{ try{ const q=evXY(e); window.__slUp={x:Math.round(q.x),y:Math.round(q.y),onRing:ultCoachOnRing(q.x,q.y)}; }catch(_){} },{capture:true,once:true}); });
      const to=rg?rg.client:{x:p.x,y:p.y-100}; await ptMove(pg,S,cdp,p,to,8); await H.wait(150); await ptUp(pg,S,cdp,to); await H.wait(1000);
      const af=await pg.evaluate(uid=>({done:!!ULTCOACH.done[uid],hold:!!ULTCOACH.hold,cur:ULTCOACH.u&&ULTCOACH.u.uid,bt:+battleTime.toFixed(4),up:window.__slUp,energy:(units.find(x=>x.uid===uid)||{}).energy}),a.uid);
      await H.wait(1000); const bt2=await pg.evaluate(()=>+battleTime.toFixed(4));
      const sp=await shot(pg,S.tag+' Coach aiming dragged onto the ring '+a.key);
      const pr={key:a.key,whileAiming:{aiming:as.aiming,ring:rg},to,after:af,btLater:bt2,shot:[ss,sp],ok:as.aiming===a.key&&!!rg&&rg.calls>0&&rg.gold>=8&&!!af.up&&af.up.onRing&&af.done&&af.cur!==a.uid&&bt2>af.bt};
      if(!posDone||!posDone.ok) posDone=pr; rec.cast=pr;
    } else { const p=await portrait(pg); if(S.touch) await pg.touchscreen.tap(p.x,p.y); else await pg.mouse.click(p.x,p.y); await H.wait(1000);
      rec.cast=await pg.evaluate(uid=>({tap:true,done:!!ULTCOACH.done[uid],hold:!!ULTCOACH.hold,cur:ULTCOACH.u&&ULTCOACH.u.uid}),a.uid); }
    holds.push(rec); console.log('  INFO   '+S.tag+' coach hold '+(h+1)+': '+JSON.stringify(rec).slice(0,1500));
  }
  await pg.evaluate(()=>{ clearInterval(window.__slVt); });
  const fin=await shot(pg,S.tag+' after the coach holds');
  /* Stage 1-1 ultimate coach: each of the three heroes held the fight at its first ready ult */
  const keys=holds.map(x=>x.key);
  C.ok(st.intro&&st.armed&&holds.length===3&&TRIO.every(k=>keys.includes(k))&&holds.every(x=>x.held&&x.frozen&&x.energy>=100&&x.hint&&x.hint.vis&&x.hint.coach&&/\S/.test(x.hint.text)),
    S.tag+' '+N.coach+': Normal 1-1 first clear - the fight held (battle clock stopped 1.5 s) at each hero\'s first ready ult: '+holds.map(x=>x.key+(x.frozen?' held':' NOT held')+' "'+(x.hint?x.hint.text:'').slice(0,40)+'"').join('; '),
    {start:st,holds:holds.map(x=>({key:x.key,energy:x.energy,bt:x.bt,frozen:x.frozen,hint:x.hint,glow:x.glow,shot:x.shot})),shot:fin});
  /* Coach aiming */
  C.ok(!!negDone&&negDone.ok&&!!posDone&&posDone.ok,S.tag+' '+N.aim+': the aimed ult draws the gold ring; letting go away from it re-prompts and the fight stays held; dragging onto the ring casts and the fight goes on',{away:negDone,onto:posDone});
  /* Tap to continue: every hold whose bubble is the held hero's own line */
  const mineSay=holds.filter(x=>x.say&&x.say.uid===x.uid).map(x=>({key:x.key,say:x.say,cont:x.cont,ok:!!(x.cont&&x.cont.vis&&x.cont.on&&x.cont.front&&/tap to continue/i.test(x.cont.text))}));
  C.ok(holds.length>0&&mineSay.length>0&&mineSay.every(x=>x.ok),S.tag+' '+N.cont+': in the coach holds the speaker\'s last bubble shows "Tap to continue" by it, on screen and not covered ('+mineSay.filter(x=>x.ok).length+' of '+mineSay.length+' holds)',
    {holds:holds.map(x=>({key:x.key,say:x.say,cont:x.cont,shot:x.shot}))});
  /* Vael at 90% */
  const vh=holds.find(x=>x.key==='vael'), V=vh&&vh.vael;
  C.ok(!!vh&&!!V&&!!V.full&&V.samples>20&&V.preMax<=99&&V.full.hp<=90.05&&V.full.hp>=80&&V.full.say==='vael_ready'&&vh.hp<=90.05,S.tag+' '+N.vael+': Vael\'s energy stayed at most '+(V?V.preMax:'?')+' while his HP was over 90%; his ult was ready at '+(V&&V.full?V.full.hp:'?')+'% HP with "vael_ready"',
    {vael:V,atHold:vh?{hp:vh.hp,energy:vh.energy,say:vh.say}:null,shot:vh?vh.shot:firstShot});
}

(async()=>{
  let pg=null;
  const seed=()=>H.seedDB(HEROES,u=>{ u.team=TRIO.slice(); u.wall=TRIO.slice(); u.led.camp={cleared:0,stars:{},att:null}; u.led.stam={v:60,ts:NOW}; u.led.tutDone=false; u.led.tutSkipped=false; u.led.quests={claimed:{},chainStep:0}; });
  try{
    for(const k of ['phone','desktop','tablet']){ const S=H.SIZES[k];
      const {file}=seed(); const s=await H.server(file);
      try{
        pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch}); await H.prep(pg);
        const parts=k==='tablet'?[[N.frame,()=>startHere(pg,S,true)]]
          :[[N.glow,()=>welcomeAndGlow(pg,S)],[N.menu,()=>menuGlow(pg,S)],[N.hero,()=>heroGlow(pg,S)],[N.roam,()=>roam(pg,S)],[N.top+' / '+N.frame,()=>startHere(pg,S,false)],[N.coach+' / '+N.aim+' / '+N.cont+' / '+N.vael,()=>coach(pg,S)]];
        for(const [nm,fn] of parts){ try{ await fn(); }catch(e){ C.ok(false,S.tag+' '+nm+': ran to the end',String(e&&e.stack||e).slice(0,500)); await shot(pg,S.tag+' '+nm.split(' / ')[0]+' stopped'); } }
        C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      }finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} pg=null; await H.closeBrowser(); await s.stop(); }   /* a fresh browser + DB per size: the CT memory cap, a fresh tutorial */
    }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); }
  C.done();
})();
