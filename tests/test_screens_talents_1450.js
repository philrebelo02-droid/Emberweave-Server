'use strict';
/* Lockdown audit 25 Nov 2026, section 29 Talents, the screen lines (live v1450), in a real browser on this checkout's server (temp DB):
   Talents tab (board fills the panel at one size for every hero), tree colours, fixed header, tap selects / Learn learns, talent tooltips beside
   the talent, tree tooltip on its banner only, red dot, board refits on pop-out / full screen / window resize; Reset for 1,000 diamonds (refunds
   all points; free after a data correction); Reset cost shown (a refused reset shows the real cost and balance).
   Every check prints what it measured. Exit 0 = all passed. */
const path=require('path'), H=require('./helpers/screens-1450.js');
const T=require(path.join(H.ROOT,'talents.js'));
const C=H.checker('test_screens_talents_1450.js');
const BOARD=['vael','aureth','brannus','calypsa','dandra'];   /* five heroes, every tree: one board size */
const HEROES={vael:100,aureth:50,brannus:60,calypsa:40,dandra:30,vex:10,askel:30,astra:30,konwu:9};
const t1=(hero,tree)=>T.trees(hero)[tree||0].talents.find(t=>t[1]===1&&!t[7]);
const legal=(hero,ids,lv)=>{ let b={r:{}}; for(const id of ids){ const r=T.learn(hero,b,id,lv); if(!r.ok) throw new Error('seed build: '+r.error); b=r.build; } return b; };
const ASTRA=legal('astra',[t1('astra')[0]],30);
const ASKEL_BAD={r:{[T.trees('askel')[0].talents.find(t=>t[1]===2)[0]]:1}};   /* a tier-2 talent with nothing under it: what a data correction leaves */
const VAEL_PTS=legal('vael',[t1('vael')[0],t1('vael')[0],t1('vael',1)[0]],100);

const openHero=(pg,key,tab,mode)=>pg.evaluate(([key,tab,mode])=>{ document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); talentCardHide&&talentCardHide();
  detailHero=key; heroTab=tab; if(mode==='full'){ closePopout(); show('heroDetail'); } else popoutScreen('heroDetail'); renderHeroDetail(); },[key,tab,mode||'popout']);
const boardM=pg=>pg.evaluate(()=>{ const pw=document.getElementById('tlPw'), panel=pw&&pw.closest('.tl-panel'); if(!pw||!panel) return null;
  const cs=getComputedStyle(panel), padX=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0), V=ewGameView();
  const a=pw.ewGameRect(), p=panel.ewGameRect(); const max=TAL.short?TL_BOARD_MAX_SHORT:TL_BOARD_MAX;
  const want=Math.round(TLS.W*Math.min(Math.min(max,Math.max(TAL.short?200:240,panel.clientWidth-padX))/TLS.W,1.25));
  return {w:Math.round(pw.offsetWidth),want,panelW:panel.clientWidth,inside:a.left>=p.left-1&&a.right<=p.right+1&&a.right<=V.width+1,short:!!TAL.short,cells:document.querySelectorAll('.tl-cell').length}; });

async function desktop(s){
  const pg=await H.game(s.port,{w:1400,h:900});
  // ---- board size: five heroes x three trees, pop-out and full screen
  const sizes={popout:new Set(),full:new Set()}; const bad=[];
  for(const mode of ['popout','full']) for(const k of BOARD){ await openHero(pg,k,'talents',mode); await H.wait(500); await H.clean(pg);
    for(let i=0;i<3;i++){ await pg.evaluate(i=>{ const b=document.querySelector('.tl-bn[data-tl-tree="'+i+'"]'); if(b) b.click(); },i); await H.wait(350);
      const m=await boardM(pg); if(!m){ bad.push(mode+' '+k+' no board'); continue; } sizes[mode].add(m.w);
      if(Math.abs(m.w-m.want)>2||!m.inside||m.cells<20) bad.push(mode+' '+k+' tree '+i+' '+JSON.stringify(m)); } }
  C.ok(sizes.popout.size===1&&sizes.full.size===1&&bad.length===0,'1400x900 Talents board: one size for 5 heroes x 3 trees in each mode, fills the panel (width = the fit for the panel), inside it',
    {popout:[...sizes.popout],full:[...sizes.full],bad:bad.slice(0,4)});
  C.ok([...sizes.popout][0]===[...sizes.full][0],'1400x900 pop-out board = full screen board',{popout:[...sizes.popout],full:[...sizes.full]});
  // ---- tree colours: each tree its own element kit, the painted pieces loaded, a hero's three trees not all one colour
  await openHero(pg,'vael','talents'); await H.wait(600);
  for(const k of ['vael','aureth','brannus']){ await openHero(pg,k,'talents'); await H.wait(500); const els=[];
    for(let i=0;i<3;i++){ await pg.evaluate(i=>document.querySelector('.tl-bn[data-tl-tree="'+i+'"]').click(),i); await H.wait(400);
      await pg.waitForFunction(()=>[...document.querySelectorAll('#tlPnl img.tl-fr')].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});
      const v=await pg.evaluate(()=>{ const pn=document.getElementById('tlPnl'), key=detailHero, tr=TALENTS.trees(key)[TAL.tree[key]|0], el=pn.dataset.el;
        const fr=[...pn.querySelectorAll('img.tl-fr')], bg=[...pn.querySelectorAll('.tl-hdr,.tl-board,.tl-btn,.tl-rk')].map(e=>e.style.backgroundImage).filter(Boolean);
        const art=[...pn.querySelectorAll('.tl-cell img.tl-art')];
        return {tree:tr.id,el,want:talentTreeElement(key,tr.id),frames:fr.length,framesLoaded:fr.filter(i=>i.naturalWidth>0).length,own:fr.map(i=>i.getAttribute('src')).concat(bg).every(x=>x.includes('/ui/talents/'+el+'/')),
          icons:art.length,iconsLoaded:art.filter(i=>i.complete&&i.naturalWidth>0).length,cells:document.querySelectorAll('.tl-cell').length}; });
      els.push(v.el);
      C.ok(v.el===v.want&&v.own&&v.frames>0&&v.framesLoaded===v.frames&&v.icons===v.cells&&v.iconsLoaded===v.icons,'tree colours '+k+' / '+v.tree+': the '+v.el+' kit, every painted piece from it and loaded, every talent icon loaded',v); }
    C.ok(new Set(els).size>1,'tree colours '+k+': the three trees are not all one colour',els); }
  // ---- fixed header while the board scrolls
  await openHero(pg,'vael','talents'); await H.wait(600);
  const fx=await pg.evaluate(async()=>{ const sc=document.getElementById('tlScroll'), q=['.tl-bn.on','#tlPts','#tlLearn','#tlReset'], y=()=>q.map(s=>{ const e=document.querySelector(s); return e?Math.round(e.ewGameRect().top):null; });
    const cell=()=>Math.round(document.querySelector('.tl-cell').ewGameRect().top);
    sc.scrollTop=0; await new Promise(r=>setTimeout(r,200)); const a=y(), c0=cell(); sc.scrollTop=sc.scrollHeight; await new Promise(r=>setTimeout(r,300)); const b=y(), c1=cell();
    const V=ewGameView(); const vis=q.map(s=>{ const r=document.querySelector(s).ewGameRect(); return r.height>0&&r.top>=-1&&r.bottom<=V.height+1; });
    sc.scrollTop=0; return {headerBefore:a,headerAfter:b,boardMoved:c0-c1,headerVisible:vis,scrollable:sc.scrollHeight-sc.clientHeight}; });
  C.ok(JSON.stringify(fx.headerBefore)===JSON.stringify(fx.headerAfter)&&fx.boardMoved>100&&fx.headerVisible.every(Boolean),'fixed header: banners, Points, Learn and Reset stay put while the board scrolls under them',fx);
  // ---- talent tooltip beside the talent (hover), tree tooltip on the banner only
  const first=t1('vael');
  await pg.evaluate(id=>document.getElementById('tl_'+id).scrollIntoView({block:'center'}),first[0]); await H.wait(200);
  await pg.hover('#tl_'+first[0]); await H.wait(300);
  const tip=await pg.evaluate(()=>{ const c=document.getElementById('tlCard'); if(!c) return {shown:false}; const id=c.dataset.tl, a=document.getElementById('tl_'+id), r=c.ewGameRect(), V=ewGameView(), s=a.ewGameRect(), b=a.querySelector('.tl-rk').ewGameRect();
    const off=q=>r.bottom<=q.top+0.5||r.top>=q.bottom-0.5||r.right<=q.left+0.5||r.left>=q.right-0.5; const gap=Math.round(Math.max(r.left-s.right,s.left-r.right,r.top-s.bottom,s.top-r.bottom));
    return {shown:true,id,side:c.dataset.side,clear:off(s)&&off(b),gap,inView:r.left>=-1&&r.right<=V.width+1&&r.top>=-1&&r.bottom<=V.height+1,name:c.querySelector('.tl-cn').textContent,text:c.querySelector('.tl-ct').textContent,rank:c.querySelector('.tl-cr').textContent,treeTip:!!document.getElementById('tlTreeTip')}; });
  C.ok(tip.shown&&tip.id===first[0]&&tip.clear&&tip.inView&&tip.gap>=-1&&tip.gap<=40&&tip.name===first[3]&&tip.text===first[5],'talent tooltip on hover: beside the talent ('+tip.side+', '+tip.gap+' px), never over it or its badge, full text, on screen',
    {name:tip.name,rank:tip.rank,text:String(tip.text).slice(0,80),side:tip.side,gap:tip.gap});
  C.ok(!tip.treeTip,'no tree tooltip while a talent is hovered',{treeTip:tip.treeTip});
  await pg.mouse.move(3,3); await H.wait(200);
  const plays=T.trees('vael')[0].plays;
  await pg.hover('.tl-bn.on'); await H.wait(300);
  const tt=await pg.evaluate(()=>{ const t=document.getElementById('tlTreeTip'); const b=document.querySelector('.tl-bn.on'); if(!t) return {shown:false}; const r=t.getBoundingClientRect(), br=b.getBoundingClientRect();
    return {shown:true,text:t.textContent,near:Math.round(Math.min(Math.abs(r.top-br.bottom),Math.abs(br.top-r.bottom))),inline:!!document.querySelector('.tl-plays'),panelHasPlays:document.getElementById('tlPnl').textContent.includes(TALENTS.trees(detailHero)[TAL.tree[detailHero]|0].plays)}; });
  C.ok(tt.shown&&tt.text.includes(plays)&&!tt.inline&&!tt.panelHasPlays,'tree tooltip: hover the banner shows the tree role and description; the text is nowhere on the panel itself',{text:String(tt.text).slice(0,90),near:tt.near,inline:tt.inline,panelHasPlays:tt.panelHasPlays});
  await pg.mouse.move(3,3); await H.wait(300);
  C.ok(!(await pg.evaluate(()=>!!document.getElementById('tlTreeTip'))),'tree tooltip goes when the pointer leaves the banner');
  // ---- board refits: pop-out <-> full screen switch without a redraw, and a window resize
  const sw=await pg.evaluate(async()=>{ const sl=ms=>new Promise(r=>setTimeout(r,ms)), W=()=>{ const pw=document.getElementById('tlPw'); return pw?pw.offsetWidth:null; };
    detailHero='vael'; heroTab='talents'; closePopout(); show('heroDetail'); await sl(600); const full=W();
    closePopout(); popoutScreen('heroesPanel'); await sl(200); detailHero='vael'; popoutScreen('heroDetail'); await sl(600); const pop=W();
    const el=document.getElementById('heroDetail'); const panelPop=document.querySelector('.tl-panel').clientWidth;
    el.classList.toggle('popout'); await sl(600); const a=W(), panelA=document.querySelector('.tl-panel').clientWidth; el.classList.toggle('popout'); await sl(600); const b=W();
    return {full,pop,panelPop,afterToggle:a,panelAfterToggle:panelA,afterBack:b}; });
  C.ok(sw.full>0&&sw.pop>0&&sw.afterBack===sw.pop&&(sw.panelAfterToggle===sw.panelPop||sw.afterToggle!==null),'board refits on a pop-out / full screen switch and comes back to its size',sw);
  await openHero(pg,'vael','talents'); await H.wait(500);
  const rs={}; for(const [w,h] of [[1400,900],[900,700],[700,900],[1400,900]]){ await pg.setViewportSize({width:w,height:h}); await H.wait(700); const m=await boardM(pg); rs[w+'x'+h]=m&&{w:m.w,want:m.want,inside:m.inside}; }
  C.ok(Object.values(rs).every(m=>m&&Math.abs(m.w-m.want)<=2&&m.inside),'board refits to the panel after window resizes (1400x900 -> 900x700 -> 700x900 -> 1400x900)',rs);
  // ---- Reset for 1,000 diamonds: refunds all points (Vael has 3 learned, 1000 diamonds)
  await openHero(pg,'vael','talents'); await H.wait(500);
  const before=await pg.evaluate(()=>({pts:document.getElementById('tlPts').textContent,gems:G.gems}));
  await pg.evaluate(()=>{ talentCardHide(); document.getElementById('tlReset').scrollIntoView({block:'center'}); }); await pg.click('#tlReset'); await H.wait(300);
  const ask=await pg.evaluate(()=>({ask:(document.querySelector('#tlAsk span')||{}).textContent,cost:(document.getElementById('tlResetCost')||{}).textContent,yes:!!document.getElementById('tlResetYes')&&!document.getElementById('tlResetYes').disabled}));
  C.ok(/Reset all 3 talent points of Vael\?/.test(ask.ask)&&/Costs\s*1000 \(you have\s*1000\)\./.test(ask.cost)&&ask.yes,'Reset asks first and shows the price: 1000 and your 1000 diamonds',ask);
  await pg.click('#tlResetYes'); await pg.waitForFunction(()=>!(G.talents&&G.talents.vael),null,{timeout:15000}).catch(()=>{}); await H.wait(400);
  const after=await pg.evaluate(()=>({pts:document.getElementById('tlPts').textContent,gems:G.gems,resetOff:document.getElementById('tlReset').disabled}));
  const d=s.disk();
  C.ok(before.pts==='Points: 3 / 91'&&after.pts==='Points: 0 / 91'&&after.gems===0&&d.led.gems===0&&!(d.led.talents&&d.led.talents.vael)&&after.resetOff,'Reset for 1,000 diamonds: all 3 points back, 1000 diamonds taken (screen and server)',
    {before,after,serverGems:d.led.gems,serverBuild:d.led.talents&&d.led.talents.vael||null});
  // ---- Reset cost shown: a refused reset (the page thinks it has diamonds, the server has 0) shows the real cost and balance
  await openHero(pg,'astra','talents'); await H.wait(500);
  await pg.evaluate(()=>{ G.gems=5000; renderHeroDetail(); }); await H.wait(300);
  await pg.evaluate(()=>{ talentCardHide(); document.getElementById('tlReset').scrollIntoView({block:'center'}); }); await pg.click('#tlReset'); await H.wait(200);
  await pg.evaluate(()=>{ const b=document.getElementById('banner'); if(b) b.textContent=''; });
  const yesOn=await pg.evaluate(()=>!!document.getElementById('tlResetYes')&&!document.getElementById('tlResetYes').disabled);
  if(yesOn) await pg.click('#tlResetYes');
  let ban=''; for(let i=0;i<40&&!/1,?000/.test(ban);i++){ await H.wait(100); ban=await pg.evaluate(()=>{ const b=document.getElementById('banner'); return b?b.textContent:''; }); }
  const banVis=await pg.evaluate(()=>{ const b=document.getElementById('banner'); if(!b) return false; const r=b.getBoundingClientRect(); return r.width>0&&r.height>0&&getComputedStyle(b).display!=='none'&&getComputedStyle(b).visibility!=='hidden'; });
  const d2=s.disk();
  C.ok(yesOn&&/Not enough diamonds\./.test(ban)&&/1,?000/.test(ban)&&/you have 0/.test(ban)&&banVis&&JSON.stringify(d2.led.talents.astra)===JSON.stringify(ASTRA),'Reset cost shown: the refused reset says the real cost (1,000) and the real balance (0); nothing changed on the server',
    {banner:ban,visible:banVis,serverBuild:d2.led.talents.astra});
  // ---- free after a data correction: Askel's stored build is illegal; 0 diamonds; the reset is free
  await openHero(pg,'askel','talents'); await H.wait(500);
  await pg.evaluate(()=>{ talentCardHide(); document.getElementById('tlReset').scrollIntoView({block:'center'}); });
  const rOn=await pg.evaluate(()=>!document.getElementById('tlReset').disabled); if(rOn) await pg.click('#tlReset'); await H.wait(300);
  const fa=await pg.evaluate(()=>({cost:(document.getElementById('tlResetCost')||{}).textContent,yes:!!document.getElementById('tlResetYes')&&!document.getElementById('tlResetYes').disabled}));
  if(fa.yes) await pg.click('#tlResetYes'); await H.wait(1200);
  const d3=s.disk();
  C.ok(rOn&&/Costs\s*0 \(you have\s*0\)\./.test(fa.cost)&&fa.yes&&!(d3.led.talents&&d3.led.talents.askel)&&d3.led.gems===0,'Reset is free after a data correction: an illegal stored build, 0 diamonds, the reset shows cost 0, works, and takes nothing',
    {cost:fa.cost,serverBuild:d3.led.talents&&d3.led.talents.askel||null,serverGems:d3.led.gems});
  C.ok(pg._errs.length===0,'1400x900 no page errors',pg._errs.slice(0,3).map(e=>e.replace(/Error:/g,'Err')));
  await pg._ctx.close();
}

async function phone(s){
  const pg=await H.game(s.port,{w:390,h:844,touch:true});
  // ---- red dot: Vex (level 10, one free point) has it on the Talents tab and his Heroes card; Konwu (level 9) has no Talents dot
  await pg.evaluate(()=>{ closePopout(); popoutScreen('heroesPanel'); }); await H.wait(1200); await H.clean(pg);
  const card=k=>pg.evaluate(k=>{ const p=document.getElementById('rcp_'+k), c=p&&p.closest('.hero-card'); const d=c&&c.querySelector(':scope>.hupDot'); if(!d) return {dot:false};
    c.scrollIntoView({block:'center'}); const r=d.getBoundingClientRect(); return {dot:true,w:Math.round(r.width),h:Math.round(r.height),color:getComputedStyle(d).backgroundColor}; },k);
  const vexCard=await card('vex');
  await openHero(pg,'vex','stats'); await H.wait(500);
  const tabDot=()=>pg.evaluate(()=>{ const d=document.querySelector('#heroDetailBody .hd-tab[data-tab="talents"] .hupDot'); if(!d) return {dot:false}; const r=d.getBoundingClientRect(); return {dot:true,w:Math.round(r.width),h:Math.round(r.height),on:r.width>0&&r.top>=0&&r.bottom<=innerHeight,color:getComputedStyle(d).backgroundColor}; });
  const vexTab=await tabDot();
  await openHero(pg,'konwu','stats'); await H.wait(400); const konTab=await tabDot();
  C.ok(vexCard.dot&&vexTab.dot&&vexTab.on&&vexTab.w>=4&&!konTab.dot,'red dot: Vex (Lv10, 1 point to spend) has it on his card and on the Talents tab; Konwu (Lv9) has none on Talents',{vexCard,vexTab,konwuTab:konTab});
  // ---- tap selects, Learn learns (Vex, his one point), then the dot goes
  await openHero(pg,'vex','stats'); await H.wait(400); await pg.tap('#heroDetailBody .hd-tab[data-tab="talents"]'); await H.wait(700);
  const v1=t1('vex');
  await pg.evaluate(id=>document.getElementById('tl_'+id).scrollIntoView({block:'center'}),v1[0]); await H.wait(450);
  await pg.tap('#tl_'+v1[0]); await H.wait(500);
  const sel=await pg.evaluate(id=>({sel:document.getElementById('tl_'+id).classList.contains('sel'),learnOn:!document.getElementById('tlLearn').disabled,tip:!!document.getElementById('tlCard'),pts:document.getElementById('tlPts').textContent}),v1[0]);
  const srv1=s.disk().led.talents;
  C.ok(sel.sel&&sel.learnOn&&!sel.tip&&sel.pts==='Points: 0 / 1'&&!(srv1&&srv1.vex),'phone: one tap selects the talent and lights Learn, learns nothing (server build empty)',{...sel,server:srv1&&srv1.vex||null});
  await pg.tap('#tlLearn'); await pg.waitForFunction(id=>(G.talents&&G.talents.vex||{r:{}}).r[id]===1,v1[0],{timeout:15000}).catch(()=>{}); await H.wait(500);
  const learned=await pg.evaluate(()=>document.getElementById('tlPts').textContent); const srv2=s.disk().led.talents.vex;
  C.ok(learned==='Points: 1 / 1'&&srv2&&srv2.r[v1[0]]===1,'phone: Learn spends the point (screen and server)',{pts:learned,server:srv2});
  // a double tap shows the tooltip beside the talent (phone), learns nothing more
  await pg.tap('#tl_'+v1[0]); await pg.tap('#tl_'+v1[0]); await H.wait(400);
  const ptip=await pg.evaluate(()=>{ const c=document.getElementById('tlCard'); if(!c) return {shown:false}; const a=document.getElementById('tl_'+c.dataset.tl), r=c.ewGameRect(), s=a.ewGameRect(), V=ewGameView();
    const off=r.bottom<=s.top+0.5||r.top>=s.bottom-0.5||r.right<=s.left+0.5||r.left>=s.right-0.5; return {shown:true,side:c.dataset.side,clear:off,inView:r.left>=-1&&r.right<=V.width+1&&r.top>=-1&&r.bottom<=V.height+1}; });
  C.ok(ptip.shown&&ptip.clear&&ptip.inView,'phone: a double tap shows the tooltip beside the talent, on screen',ptip);
  await pg.evaluate(()=>talentCardHide());
  await pg.tap('#heroDetailBody .hd-tab[data-tab="stats"]'); await H.wait(400); const vexTab2=await tabDot();
  await pg.evaluate(()=>{ closePopout(); popoutScreen('heroesPanel'); }); await H.wait(1000); const vexCard2=await card('vex');
  C.ok(!vexTab2.dot&&!vexCard2.dot,'red dot goes once the point is spent (tab and card)',{tab:vexTab2,card:vexCard2});
  // ---- phone board: one size for the five heroes
  const ps=new Set(), pb=[]; for(const k of BOARD){ await openHero(pg,k,'talents'); await H.wait(500); const m=await boardM(pg); if(m){ ps.add(m.w); if(Math.abs(m.w-m.want)>2||!m.inside) pb.push(k+' '+JSON.stringify(m)); } else pb.push(k+' no board'); }
  C.ok(ps.size===1&&pb.length===0,'390x844 phone: one board size for 5 heroes, fills the panel, inside the screen',{sizes:[...ps],bad:pb});
  C.ok(pg._errs.length===0,'390x844 no page errors',pg._errs.slice(0,3).map(e=>e.replace(/Error:/g,'Err')));
  await pg._ctx.close();
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.gold=0; u.led.gems=1000; u.led.talents={vael:VAEL_PTS,astra:ASTRA,askel:ASKEL_BAD}; });
  console.log('  seed: Askel build illegal = '+JSON.stringify(T.invalid('askel',ASKEL_BAD,30))+', Astra legal = '+JSON.stringify(T.invalid('astra',ASTRA,30))+', Vael spent '+T.spent('vael',VAEL_PTS).total);
  const s=await H.server(file);
  try{ await desktop(s); }catch(e){ C.ok(false,'the desktop part ran to the end',String(e&&e.stack||e).replace(/Error:/g,'Err').slice(0,600)); }
  try{ await phone(s); }catch(e){ C.ok(false,'the phone part ran to the end',String(e&&e.stack||e).replace(/Error:/g,'Err').slice(0,600)); }
  await H.closeBrowser(); await s.stop(); C.done();
})();
