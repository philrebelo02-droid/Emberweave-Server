'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 22 - The Starless Well (vault-arena-well.md, UNPROVEN-ON-SCREEN lines), in a real browser on
   this checkout's server (temp DB), a level-100 player, the Well opened from its town plate (a fresh run, standing on the start tile):
   - Game-style UI: the title on the painted plaque, the painted back button (the same art as the other buildings' back buttons), the
     gold Heroes button and the plaque clock, all loaded and on screen, at desktop / Fold / phone.
   - Phone and Fold fit: on the phone and the Fold cover every next-column square is on screen, big enough and the element a tap hits;
     tapping the title bar does nothing; a tap on a square does act.
   One screenshot per check per size (SHOT64 lines). Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_well.js', C=H.checker(TEST), shot=H.shooter(TEST);
const KEYS=['vael','aureth','sylthaine','vireo','brannus','lumi','umbris','grosk'];
const HEROES={}; KEYS.forEach(k=>HEROES[k]=80);

async function openWell(pg,S){
  const how=await H.openBuilding(pg,'well',S.touch);
  await pg.waitForFunction(()=>document.querySelectorAll('#wlMap .wlSq').length>0||document.querySelector('#wlMap .wlMsg'),null,{timeout:40000}).catch(()=>{});
  await pg.evaluate(async()=>{ const ims=[...document.querySelectorAll('#wlMap img')]; for(let k=0;k<80&&ims.some(i=>!i.complete);k++) await new Promise(r=>setTimeout(r,100)); });
  await H.wait(1500); await H.prep(pg);
  const st=await pg.evaluate(()=>({map:!!document.getElementById('wlMap'),sq:document.querySelectorAll('#wlMap .wlSq').length,msg:SL.txt('#wlMap .wlMsg'),lv:playerLevel(),pos:WELL.state&&WELL.state.pos}));
  C.ok(st.map&&st.sq>0,S.tag+' the Starless Well map opened from its town plate ['+how+'], player level '+st.lv,st);
  return how; }

async function gameUI(pg,S){
  const r=await pg.evaluate(async()=>{ const bi=el=>((getComputedStyle(el).borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1]||null;
    const ttl=document.querySelector('#wlMap .wlTtl'), h1=document.querySelector('#wlMap .wlH1'), back=document.querySelector('#wlMap .wlBackB'), clock=document.querySelector('#wlMap .wlClock'), heroes=document.querySelector('#wlMap .wlHeroesB');
    const plaque=ttl&&bi(ttl), plaqueOk=plaque?(await SL.loadImg(plaque)).ok:false, clk=clock&&bi(clock), clkOk=clk?(await SL.loadImg(clk)).ok:false;
    const backBg=back?await SL.bgLoaded(back):[], heroBg=heroes?await SL.bgLoaded(heroes):[];
    const other=document.querySelector('#skyisland>.backbtn'), otherBg=other?SL.bgUrls(other):[];
    const norm=u=>(u||'').replace(location.origin,'');
    const h1cs=h1?getComputedStyle(h1):null;
    return {plaque:norm(plaque),plaqueOk,titleText:SL.txt(h1),titleFont:h1cs&&h1cs.fontFamily,titleColor:h1cs&&h1cs.color,titleOn:!!ttl&&SL.inView(ttl)&&SL.front(ttl),titleBox:ttl&&SL.R(ttl),
      back:backBg.map(x=>norm(x.url)+(x.ok?'':' NOT LOADED')),backOk:backBg.length>0&&backBg.every(x=>x.ok),otherBack:otherBg.map(norm),sameAsOther:backBg.length>0&&backBg.map(x=>norm(x.url)).join()===otherBg.map(norm).join(),backOn:!!back&&SL.inView(back)&&SL.front(back),backBox:back&&SL.R(back),
      heroes:heroBg.map(x=>norm(x.url)+(x.ok?'':' NOT LOADED')),heroesOk:heroBg.some(x=>x.ok&&/claim-button/.test(x.url)),heroesOn:!!heroes&&SL.inView(heroes)&&SL.front(heroes),heroesText:SL.txt(heroes),heroesFont:heroes&&getComputedStyle(heroes).fontFamily,
      clock:norm(clk),clockOk:clkOk,clockOn:!!clock&&SL.inView(clock),clockText:SL.txt(clock)}; });
  const s=await shot(pg,S.tag+' Game-style UI');
  C.ok(r.plaqueOk&&/hud-plaque/.test(r.plaque)&&r.titleOn&&/Georgia/.test(r.titleFont||'')&&r.titleText.length>0,S.tag+' Game-style UI: the title "'+r.titleText+'" sits on the painted plaque (hud-plaque, loaded) in the game\'s gold Georgia, on screen',
    {plaque:r.plaque,font:r.titleFont,color:r.titleColor,box:r.titleBox,shot:s});
  C.ok(r.backOk&&r.sameAsOther&&r.backOn,S.tag+' Game-style UI: the back button is the painted button art the other buildings use (same as the Island of Trials Base button), loaded, on screen',
    {back:r.back,other:r.otherBack,box:r.backBox,shot:s});
  C.ok(r.heroesOk&&r.heroesOn&&r.clockOk&&/hud-plaque/.test(r.clock)&&r.clockOn,S.tag+' Game-style UI: the gold Heroes button (claim-button art, "'+r.heroesText+'") and the plaque clock ("'+r.clockText+'") are loaded and on screen',
    {heroes:r.heroes,font:r.heroesFont,clock:r.clock,shot:s});
}

async function fit(pg,S){
  const r=await pg.evaluate(()=>{ const S=WELL.state, sq=[...document.querySelectorAll('#wlMap .wlSq.wlReach')], top=document.querySelector('#wlMap .wlTop');
    const want=[0,1,2].filter(rw=>S.grid[S.pos.col+1]&&S.grid[S.pos.col+1][rw]).length;
    return {pos:S.pos,want,squares:sq.map(b=>{ const R=SL.R(b); return {c:+b.dataset.c,r:+b.dataset.r,box:R,on:SL.inView(b),front:SL.front(b),who:SL.whoAt(b),enabled:!b.disabled,big:R.w>=28&&R.h>=28,underTop:SL.overlap(R,SL.R(top))}; }),top:SL.R(top)}; });
  const s=await shot(pg,S.tag+' Phone and Fold fit squares');
  const bad=r.squares.filter(q=>!(q.on&&q.front&&q.enabled&&q.big));
  C.ok(r.squares.length===r.want&&r.want>0&&!bad.length,S.tag+' Phone and Fold fit: all '+r.squares.length+' next-column squares are on screen, at least 28 px, enabled and the element a tap hits',{from:r.pos,squares:r.squares,bad,shot:s});
  /* tapping the title bar does nothing: on the title, on an empty part of the bar, and on the bar right above the top square */
  const tb=await pg.evaluate(()=>{ const t=SL.R('#wlMap .wlTtl'), bar=SL.R('#wlMap .wlTop'), back=SL.R('#wlMap .wlBackB'), clk=SL.R('#wlMap .wlClock');
    const sqs=[...document.querySelectorAll('#wlMap .wlSq')].map(e=>SL.R(e)), my=bar.y+bar.h/2;
    const free=x=>!sqs.some(q=>x>=q.x-30&&x<=q.r+30);
    let ex=null; for(let x=Math.round(back.r+12);x<t.x-12;x+=4) if(free(x)){ ex=x; break; } if(ex==null) for(let x=Math.round(t.r+12);x<clk.x-12;x+=4) if(free(x)){ ex=x; break; }
    const top=sqs.filter(q=>q.y<bar.b+40).sort((a,b)=>a.y-b.y)[0];
    const pts={title:[t.x+t.w/2,t.y+t.h/2]}; if(ex!=null) pts.emptyBar=[ex,my]; if(top) pts.barAboveTopSquare=[top.x+top.w/2,Math.max(bar.y+2,Math.min(my,top.y-2))];
    const hit={}; for(const [k,[x,y]] of Object.entries(pts)){ const e=document.elementFromPoint(x,y); hit[k]=e?(e.tagName.toLowerCase()+'.'+String(e.className).split(' ').join('.')):null; }
    return {pts,bar,topSquare:top||null,hit}; });
  const snap=()=>pg.evaluate(()=>({state,pos:JSON.stringify(WELL.state&&WELL.state.pos),html:document.getElementById('wlMap')?document.getElementById('wlMap').innerHTML.length:-1,card:!!document.getElementById('wlCard'),menu:document.getElementById('menu').classList.contains('active'),map:!!document.getElementById('wlMap')}));
  for(const [name,[x,y]] of Object.entries(tb.pts)){
    const b0=await snap();
    if(S.touch) await pg.touchscreen.tap(x,y); else await pg.mouse.click(x,y); await H.wait(700);
    const after=await snap(); const sh=await shot(pg,S.tag+' Phone and Fold fit title bar tap '+name);
    C.ok(after.map&&after.state===b0.state&&after.pos===b0.pos&&!after.card&&!after.menu&&after.html===b0.html,
      S.tag+' Phone and Fold fit: a tap on the title bar ('+name+' at '+Math.round(x)+','+Math.round(y)+') does nothing (map open, same tile, no card, no squad screen)',
      {at:[Math.round(x),Math.round(y)],hit:tb.hit[name],bar:tb.bar,topSquare:tb.topSquare,before:b0,after,shot:sh});
    if(!after.map||after.menu||after.card){ await pg.evaluate(()=>{ const c=document.getElementById('wlCard'); if(c) c.remove(); try{ show('home'); }catch(e){} }); await H.wait(500); await openWell(pg,S); }
  }
  /* and a tap on a reachable square does act (the squad screen for a fight, a card for a chest / tent / spring) */
  const q=r.squares.find(x=>x.on&&x.front); if(q){
    const x=q.box.x+q.box.w/2, y=q.box.y+q.box.h/2; if(S.touch) await pg.touchscreen.tap(x,y); else await pg.mouse.click(x,y); await H.wait(900);
    const res=await pg.evaluate(()=>({card:!!document.getElementById('wlCard'),menu:document.getElementById('menu').classList.contains('active'),title:(document.getElementById('menuTitle')||{}).textContent}));
    const s3=await shot(pg,S.tag+' Phone and Fold fit square tap');
    C.ok(res.card||res.menu,S.tag+' Phone and Fold fit: a tap on square '+q.c+'/'+q.r+' acts ('+(res.menu?'squad screen "'+res.title+'"':res.card?'its card':'nothing')+')',{res,shot:s3}); }
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.team=KEYS.slice(0,5); });
  const s=await H.server(file); let pg=null;
  const PLAN=[['desktop',{ui:1}],['fold',{ui:1,fit:1}],['phone',{ui:1,fit:1}]];
  try{
    for(const [k,do_] of PLAN){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      try{ await openWell(pg,S);
        if(do_.ui) await gameUI(pg,S);
        if(do_.fit) await fit(pg,S);
      }catch(e){ C.ok(false,S.tag+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; await H.closeBrowser(); }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
