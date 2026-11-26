'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 13 - Island of Trials (island-13.md, UNPROVEN-ON-SCREEN), part 1 (the Island, Training Province,
   the Swarm Spire lobby). The Emberdraft lines are in screen_lockdown_island_emberdraft.js.
   - Island title art and labels: Lv 40, phone + desktop: the painted title plate (no plain text bar), the 3 entrance labels in the gold frame, no dark box.
   - Training Province art: 844x390 and 390x844: header art + both ground cards visible, no scrollbar on the card.
   - Reward text: a real Drill 1 clear in the browser -> the result says "toward <hero>'s" with a fragment picture; the Drill card shows
     "per clear:" and "Per sweep:" each with a picture.
   - Hero select lobby: the Swarm Spire lobby grid of all heroes scrolls; tapping a hero updates its card, name, class, Lv, stars, power.
   Opened from the town plate and the island's own entrance labels. One screenshot per check per size (SHOT64 lines). Exit 0 = all passed. */
const fs=require('fs'),path=require('path');
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_island.js', C=H.checker(TEST), shot=H.shooter(TEST);
const INC=JSON.parse(/const D_TROOP_INC=(\[[^\]]+\])/.exec(fs.readFileSync(path.join(H.ROOT,'server.js'),'utf8'))[1]);
const pxFor=L=>{ let x=0; for(let i=0;i<L-1;i++) x+=INC[i]; return x; };
const HEROES={vael:45,aureth:45,brannus:45,sylthaine:45,vireo:45,konwu:40,linnet:40,zahri:40};
const PORTRAIT={w:390,h:844,touch:true,tag:'phone portrait 390x844'};
const press=(pg,touch,sel)=>touch?pg.tap(sel,{timeout:10000}):pg.click(sel,{timeout:10000});

async function island(pg,S){
  const how=await H.openBuilding(pg,'skyisland',S.touch);
  await pg.waitForFunction(()=>document.getElementById('skyisland').classList.contains('active')&&document.querySelectorAll('#skyIslandBody .islespot').length===3,null,{timeout:30000}).catch(()=>{});
  await H.wait(1200); await H.prep(pg);
  const r=await pg.evaluate(async()=>{ const scr=document.getElementById('skyisland'), tb=scr.querySelector('.titlebar'), h1=tb.querySelector('h1'), cs=getComputedStyle(h1), tbs=getComputedStyle(tb);
    const title=await SL.bgLoaded(h1);
    const labs=[];
    for(const sp of document.querySelectorAll('#skyIslandBody .islespot')){ const d=sp.firstElementChild, ds=getComputedStyle(d), be=getComputedStyle(d,'::before');
      const fu=((be.borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1], fr=fu?await SL.loadImg(fu):null;
      labs.push({id:sp.dataset.if,text:SL.txt(d),locked:sp.classList.contains('locked'),bg:ds.backgroundColor,bgImg:ds.backgroundImage,border:ds.borderTopWidth+'/'+ds.borderLeftWidth,
        frame:fu?fu.replace(location.origin,''):null,frameOk:!!(fr&&fr.ok),frameW:be.borderImageWidth,beforeInset:be.top,box:SL.R(d),on:SL.inView(d),front:SL.front(d)}); }
    return {lv:playerLevel(),active:scr.classList.contains('active'),title:title.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),
      titleOk:title.some(x=>x.ok&&/island-of-trials-title/.test(x.url)),font:cs.fontSize,fill:cs.webkitTextFillColor,barBg:tbs.backgroundImage,barColor:tbs.backgroundColor,box:SL.R(h1),on:SL.inView(h1),front:SL.front(h1),labs}; });
  const s=await shot(pg,S.tag+' island');
  C.ok(r.active&&r.lv===40&&r.titleOk&&parseFloat(r.font)===0&&r.on&&r.front&&r.box.w>60&&r.box.h>40&&(r.barBg==='none')&&/rgba\(0, 0, 0, 0\)|transparent/.test(r.barColor),
    S.tag+' Island title art and labels: the painted ISLAND OF TRIALS title is drawn (art loaded, on screen, no text, no plain bar behind it) [Lv '+r.lv+', opened by '+how+']',{title:r.title,font:r.font,box:r.box,bar:[r.barBg,r.barColor],shot:s});
  const clearBg=l=>/rgba\(0, 0, 0, 0\)|transparent/.test(l.bg)&&l.bgImg==='none';
  C.ok(r.labs.length===3&&r.labs.every(l=>l.frameOk&&/guild-ornate-panel/.test(l.frame||'')&&clearBg(l)&&l.on&&l.front&&!l.locked),
    S.tag+' Island title art and labels: each of the 3 entrance labels sits in the carved gold frame (frame art loaded), no default dark box, on screen',{labels:r.labs.map(l=>({id:l.id,text:l.text,frame:l.frame,ok:l.frameOk,bg:l.bg,img:l.bgImg,box:l.box,on:l.on,front:l.front})),shot:s});
}

async function province(pg,S){
  await H.openBuilding(pg,'skyisland',S.touch);
  await pg.waitForFunction(()=>document.querySelectorAll('#skyIslandBody .islespot').length===3,null,{timeout:30000}).catch(()=>{});
  await H.wait(800);
  await press(pg,S.touch,'#skyIslandBody .islespot[data-if="training"]>div');
  await pg.waitForFunction(()=>document.querySelectorAll('.provScene .isleCardP .provRow').length===2,null,{timeout:30000}).catch(()=>{});
  await H.wait(1500); await H.clean(pg); await H.prep(pg);
  const r=await pg.evaluate(async()=>{ const card=document.querySelector('.provScene .isleCardP'); if(!card) return {card:false};
    const hero=card.querySelector('.provHero'), hb=await SL.bgLoaded(hero), rows=[...card.querySelectorAll('.provRow')];
    const rr=[]; for(const row of rows){ const im=row.querySelector('img.provIc'); rr.push({t:row.dataset.prov,name:SL.txt(row.querySelector('.provNm')),img:await SL.imgOk(im),box:SL.R(row),on:SL.inView(row),front:SL.front(row,0.5,0.5),locked:row.classList.contains('locked')}); }
    return {card:true,rotated:!!(window.EWViewport&&EWViewport.state.rotated),view:SL.V(),hero:hb.map(x=>x.url.replace(location.origin,'')+(x.ok?' ok':' NOT LOADED')),heroOk:hb.some(x=>x.ok&&/training-province/.test(x.url)),
      heroBox:SL.R(hero),heroOn:SL.inView(hero),ttl:SL.txt(hero.querySelector('.provTtl')),rows:rr,scroll:SL.scrolls(card),cardBox:SL.R(card)}; });
  const s=await shot(pg,S.tag+' training province');
  C.ok(r.card&&r.heroOk&&r.heroOn&&r.rows.length===2&&r.rows.every(x=>x.on&&x.front&&x.img.ok&&!x.locked)&&r.rows.some(x=>/mi-prov-gold/.test(x.img.src))&&r.rows.some(x=>/mi-prov-drill/.test(x.img.src)),
    S.tag+' Training Province art: the painted training-ground header and both ground cards (gold + drill medallions) are on screen',{rotated:r.rotated,view:r.view,hero:r.hero,heroBox:r.heroBox,title:r.ttl,rows:r.rows,shot:s});
  C.ok(r.card&&r.scroll&&!r.scroll.y,S.tag+' Training Province art: no scrollbar on the card (scrollHeight '+(r.scroll&&r.scroll.sh)+' <= clientHeight '+(r.scroll&&r.scroll.ch)+')',{scroll:r.scroll,card:r.cardBox,shot:s});
  await pg.evaluate(()=>document.querySelectorAll('.provScene').forEach(n=>n.remove()));
}

/* a real Drill 1 fight: Island > Training Province > Drill > CHALLENGE > the squad screen's BATTLE; the fight is stepped on the page's own engine
   with AUTO on (as the energy test does), the server resolves it and the page shows its result screen */
async function reward(pg,S,srv){
  await H.openBuilding(pg,'skyisland',S.touch);
  await pg.waitForFunction(()=>document.querySelectorAll('#skyIslandBody .islespot').length===3,null,{timeout:30000}).catch(()=>{});
  await H.wait(800);
  await press(pg,S.touch,'#skyIslandBody .islespot[data-if="training"]>div');
  await pg.waitForFunction(()=>document.querySelector('.provScene .provRow[data-prov="rune"]'),null,{timeout:30000}); await H.wait(1200); await H.clean(pg);
  await press(pg,S.touch,'.provScene .provRow[data-prov="rune"]');
  await pg.waitForFunction(()=>{ const b=document.querySelector('#pvGo'); return b&&!b.disabled; },null,{timeout:30000}); await H.wait(800); await H.clean(pg);
  await press(pg,S.touch,'#pvGo');
  await pg.waitForFunction(()=>state==='menu'&&document.getElementById('startBtn'),null,{timeout:30000}); await H.wait(1500); await H.clean(pg);
  const sq=await pg.evaluate(()=>{ G.squads=G.squads||{}; const had=(G.squads.campaign||[]).filter(Boolean).length; if(!had){ G.squads.campaign=['vael','aureth','brannus','sylthaine','vireo']; try{ renderMenu(); }catch(e){} } return {had,squad:(G.squads.campaign||[]).slice()}; });
  console.log('  squad before BATTLE: '+JSON.stringify(sq));
  await pg.evaluate(()=>document.getElementById('startBtn').scrollIntoView({block:'center'}));
  await press(pg,S.touch,'#startBtn');
  const f=await pg.evaluate(async()=>{ const sl=ms=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<600&&!(state==='battle'&&typeof units!=='undefined'&&units.some(u=>u.team==='ally'));i++) await sl(100);
    if(state!=='battle') return {error:'no battle (state '+state+')'};
    paused=true; let ticks=0, autoOn=false;
    for(let chunk=0;chunk<8000&&!ended&&state==='battle';chunk++){ for(let i=0;i<6&&!ended&&state==='battle';i++){ updateBattle(SIM_STEP); ticks++; }
      if(!autoOn&&ticks>=30){ window.patEgp1=()=>true; try{ document.getElementById('autoBtn').onclick(); }catch(e){} autoOn=true; await sl(300); }
      if(chunk%10===0) await sl(2); }
    const won=window._p2lastWon; paused=false;
    for(let i=0;i<600&&state!=='result';i++) await sl(100);
    for(let i=0;i<100&&!/\S/.test((document.getElementById('resultReward')||{}).textContent||'');i++) await sl(100);
    return {ticks,sim:+(ticks*SIM_STEP).toFixed(1),ended,won,state,mode:CUR&&CUR.mode}; });
  await H.wait(1500); await H.prep(pg);
  const res=await pg.evaluate(async()=>{ const rw=document.getElementById('resultReward'); const ims=[...rw.querySelectorAll('img')]; const ok=[]; for(const im of ims) ok.push(await SL.imgOk(im));
    return {title:SL.txt('#resultTitle'),text:SL.txt(rw),imgs:ok,frag:ok.filter(x=>x.ok&&/glyphs-v3\/.*fragment-/.test(x.src)).length,on:SL.inView(rw)}; });
  const s1=await shot(pg,S.tag+' drill 1 result');
  const p=srv.disk().led.prov||null;
  const want=/toward [^']+'s /.test(res.text);
  C.ok(!f.error&&f.won===true&&want&&res.frag>0&&res.on,S.tag+' Reward text: the Drill 1 result screen reads "'+((res.text.match(/toward [^)]*\)/)||[''])[0])+'" with a fragment picture ('+res.frag+' loaded)',
    {fight:f,title:res.title,text:res.text.slice(0,300),imgs:res.imgs,serverProv:p,shot:s1});
  /* the Drill card after the clear: a "per clear:" box (stage 2) and a "Per sweep:" box (stage 1), each with a picture */
  await pg.evaluate(()=>{ try{ show('skyisland'); }catch(e){} }); await H.wait(800);
  await pg.evaluate(()=>{ try{ openProvince('rune'); }catch(e){} });
  await pg.waitForFunction(()=>document.querySelectorAll('.provScene .provBox').length>=2,null,{timeout:30000}).catch(()=>{}); await H.wait(1500); await H.clean(pg); await H.prep(pg);
  const box=await pg.evaluate(async()=>{ const out=[]; for(const b of document.querySelectorAll('.provScene .provBox')){ const t=SL.txt(b), ims=[...b.querySelectorAll('img')].filter(i=>/glyphs-v3|gold/.test(i.getAttribute('src')||'')||1); const ok=[]; for(const im of ims) ok.push(await SL.imgOk(im));
      out.push({text:t.slice(0,220),perClear:/per clear:/.test(t),perSweep:/Per sweep:/.test(t),imgs:ok.filter(x=>x.ok&&/glyphs-v3\/.*fragment-/.test(x.src)).length,all:ok.map(x=>x.src.slice(0,70)+(x.ok?'':' NOT LOADED')),on:SL.inView(b)}); }
    return out; });
  const s2=await shot(pg,S.tag+' drill card per clear per sweep');
  const pc=box.find(b=>b.perClear), ps=box.find(b=>b.perSweep);
  C.ok(!!pc&&pc.imgs>0&&pc.on&&!!ps&&ps.imgs>0&&ps.on,S.tag+' Reward text: the Drill card shows "per clear:" and "Per sweep:" boxes, each with a fragment picture',{boxes:box,shot:s2});
  await pg.evaluate(()=>document.querySelectorAll('.provScene').forEach(n=>n.remove()));
}

async function spire(pg,S){
  await H.openBuilding(pg,'skyisland',S.touch);
  await pg.waitForFunction(()=>document.querySelectorAll('#skyIslandBody .islespot').length===3,null,{timeout:30000}).catch(()=>{});
  await H.wait(800);
  await press(pg,S.touch,'#skyIslandBody .islespot[data-if="tower"]>div');
  await pg.waitForFunction(()=>{ const f=document.getElementById('survFrame'); try{ const d=f&&f.contentDocument; return d&&d.querySelectorAll('#lbGrid .lbT').length>10&&!d.getElementById('lobby').classList.contains('wait'); }catch(e){ return false; } },null,{timeout:90000}).catch(()=>{});
  await H.wait(2500);
  const roster=await pg.evaluate(()=>survivorsRoster().map(h=>({key:h.key,name:h.name,cls:h.cls,lv:h.lv,stars:h.stars,power:h.power,playable:h.playable,owned:h.owned})));
  const fr=pg.frames().find(x=>/\/survivors/.test(x.url()));
  if(!fr){ C.ok(false,S.tag+' Hero select lobby: the Swarm Spire opens (its frame)',{frames:pg.frames().map(x=>x.url())}); return; }
  const read=()=>fr.evaluate(()=>{ const g=document.getElementById('lbGrid'), on=document.querySelector('.lbT.on'), r=g.getBoundingClientRect();
    return {tiles:g.querySelectorAll('.lbT').length,sh:g.scrollHeight,ch:g.clientHeight,top:g.scrollTop,on:on&&on.dataset.k,name:document.getElementById('lbName').textContent,meta:document.getElementById('lbMeta').textContent,
      art:(document.getElementById('lbArt').currentSrc||document.getElementById('lbArt').src||'').replace(location.origin,''),artOk:document.getElementById('lbArt').complete&&document.getElementById('lbArt').naturalWidth>0,grid:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)},vw:innerWidth,vh:innerHeight}; });
  const a=await read();
  /* the grid scrolls: scroll it to the end with the wheel / a swipe and back */
  await fr.evaluate(()=>{ const g=document.getElementById('lbGrid'); g.scrollTop=g.scrollHeight; });
  await H.wait(400); const a2=await read(); await fr.evaluate(()=>{ document.getElementById('lbGrid').scrollTop=0; }); await H.wait(300);
  const s1=await shot(pg,S.tag+' spire lobby grid');
  C.ok(a.tiles===roster.length&&a.tiles>=50&&a.sh>a.ch+1&&a2.top>0,S.tag+' Hero select lobby: the grid lists all '+a.tiles+' heroes and scrolls (scrollHeight '+a.sh+' > clientHeight '+a.ch+', scrolled to '+a2.top+')',{grid:a.grid,tiles:a.tiles,roster:roster.length,shot:s1});
  /* tap an owned playable hero that is not the one shown */
  const pick=roster.find(h=>h.playable&&h.owned&&h.lv>0&&h.key!==a.on&&h.power>0);
  if(!pick){ C.ok(false,S.tag+' Hero select lobby: an owned playable hero to tap',{roster:roster.slice(0,12)}); return; }
  const el=await fr.$('.lbT[data-k="'+pick.key+'"]'); await el.scrollIntoViewIfNeeded(); await H.wait(300);
  if(S.touch) await el.tap(); else await el.click();
  await H.wait(800);
  const b=await read();
  const s2=await shot(pg,S.tag+' spire lobby picked '+pick.key);
  const clsWant=await fr.evaluate(c=>{ try{ return t('roster.class_'+String(c||'').toLowerCase(),c||''); }catch(e){ return c; } },pick.cls);
  const metaOk=b.meta.includes(clsWant)&&b.meta.includes('Lv '+pick.lv)&&b.meta.includes(pick.stars+'★')&&b.meta.replace(/[,.\s ]/g,'').includes(String(pick.power));
  C.ok(b.on===pick.key&&b.name===pick.name&&metaOk&&b.artOk&&b.art!==a.art,S.tag+' Hero select lobby: tapping '+pick.name+' updates the card (art), name, class, Lv, stars and power ("'+b.meta+'")',
    {before:{on:a.on,name:a.name,meta:a.meta,art:a.art},after:{on:b.on,name:b.name,meta:b.meta,art:b.art},want:{name:pick.name,cls:clsWant,lv:pick.lv,stars:pick.stars,power:pick.power},shot:s2});
  await pg.evaluate(()=>{ const f=document.getElementById('survFrame'); if(f) f.remove(); });
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.px=pxFor(40); u.team=['vael','aureth','brannus','sylthaine','vireo']; });
  const s=await H.server(file); let pg=null;
  const run=async(S,fn)=>{ pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
    try{ await fn(pg,S); }catch(e){ C.ok(false,S.tag+' '+fn.name+' ran to the end',String(e&&e.stack||e).slice(0,500)); try{ await shot(pg,S.tag+' '+fn.name+' error'); }catch(_){} }
    C.ok(pg._errs.length===0,S.tag+' '+fn.name+': no page errors',pg._errs.slice(0,3)); await pg._ctx.close(); pg=null; };
  try{
    for(const S of [H.SIZES.desktop,H.SIZES.phone]) await run(S,island);
    for(const S of [H.SIZES.phone,PORTRAIT]) await run(S,province);
    const Reward_text=(pg,S)=>reward(pg,S,s); await run(H.SIZES.desktop,Reward_text);
    for(const S of [H.SIZES.desktop,H.SIZES.phone]) await run(S,spire);
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
