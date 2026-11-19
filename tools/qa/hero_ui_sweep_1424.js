// Hero panel UI sweep: every view size x (pop-out, full screen) x all heroes x every tab (+ every talent tree).
// usage: node hero_ui_all.js <outdir> <port>
const {chromium}=require('playwright'); const path=require('path'), fs=require('fs');
const wait=ms=>new Promise(r=>setTimeout(r,ms)); const OUT=process.argv[2], PORT=process.argv[3]; fs.mkdirSync(OUT,{recursive:true});
const SIZES=[['phoneL',844,390,true],['phoneP',390,844,true],['tablet',1024,768,true],['desktop',1400,900,false]];
const MODES=['popout','full'];
(async()=>{ const b=await chromium.launch(); const fails=[]; const summary={};
 for(const [tag,w,h,touch] of SIZES){
  const ctx=await b.newContext(Object.assign({viewport:{width:w,height:h}},touch?{hasTouch:true,isMobile:true,deviceScaleFactor:2}:{}));
  await ctx.addInitScript(account=>{localStorage.setItem('ew_acc',JSON.stringify(account));localStorage.setItem('ew_lang','en');localStorage.setItem('ew_guest_step_'+account.id,'1');},JSON.parse(fs.readFileSync(process.env.EW_UI_FIXTURE,'utf8')).account);
  const pg=await ctx.newPage(); if(process.env.EW_UI_BASELINE_HTML)await pg.route('**/play?lang=en',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fs.readFileSync(process.env.EW_UI_BASELINE_HTML)})); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:'+PORT+'/play?lang=en',{waitUntil:'domcontentloaded'}); await pg.waitForFunction(()=>typeof renderHeroDetail==='function'&&typeof ledgerSync==='function',null,{timeout:90000});
  await wait(1500); await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await wait(800);
  await pg.evaluate(async()=>{ G.tutSkipped=true; G.tutDone=true; G.ftutOff=true; await ledgerSync(); });
  const clean=()=>pg.evaluate(()=>{ document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); [...document.querySelectorAll('button')].filter(b=>/Got it/.test(b.textContent)&&b.offsetParent).forEach(b=>b.click()); });
  for(const mode of MODES){ const key=tag+'/'+mode; const S=summary[key]={tabY:new Set(),board:new Set(),openErr:0,tapFail:0,covered:0,cut:0,overlap:0};
   const open=(k,t)=>pg.evaluate(([k,t,mode])=>{ try{ detailHero=k; heroTab=t; if(mode==='popout') popoutScreen('heroDetail'); else { closePopout(); show('heroDetail'); } return null; }catch(e){ return String(e); } },[k,t,mode]);
   // 1) every hero x every tab opens (scripted), no throw, non-empty
   const r1=await pg.evaluate(async(mode)=>{ const bad=[]; for(const k of HERO_KEYS){ for(const t of ['stats','glyphs','talents','equip','skills','lore']){ try{ detailHero=k; heroTab=t; if(mode==='popout') popoutScreen('heroDetail'); else { closePopout(); show('heroDetail'); }
        const body=document.getElementById('heroDetailBody'); if(!body||body.innerHTML.length<300) bad.push(k+':'+t+' empty'); }catch(e){ bad.push(k+':'+t+' THROW '+String(e).slice(0,100)); } } } return bad; },mode);
   S.openErr=r1.length; r1.slice(0,8).forEach(x=>fails.push(key+' open '+x));
   // 2) owned heroes: real taps on every tab, tab row height, board size per tree, overlap / cut checks
   const owned=await pg.evaluate(()=>HERO_KEYS.filter(k=>{ try{ return heroOwned(k); }catch(e){ return false; } }));
   for(const k of owned){ await open(k,'stats'); await wait(300); await clean();
    for(const t of ['glyphs','talents','skills','stats','lore','equip','talents','lore','glyphs','talents']){
     await clean(); const sel='#heroDetailBody .hd-tab[data-tab="'+t+'"]';
     const cov=await pg.evaluate(sel=>{ const b=document.querySelector(sel); if(!b) return 'missing'; b.scrollIntoView({block:'nearest'}); const r=b.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return (e===b||b.contains(e))?null:('covered by '+(e?(e.id||String(e.className).slice(0,40)||e.tagName):'nothing')); },sel);
     if(cov){ S.covered++; fails.push(key+' '+k+' tab '+t+' '+cov); }
     try{ if(touch) await pg.tap(sel,{timeout:4000}); else await pg.click(sel,{timeout:4000}); }catch(e){ S.tapFail++; fails.push(key+' '+k+' TAP '+t+' failed: '+String(e.message).split('\n').find(l=>/intercepts/.test(l))||''); continue; }
     await wait(350);
     const st=await pg.evaluate(([sel,t])=>{ const GR=e=>(typeof e.ewGameRect==='function')?e.ewGameRect():e.getBoundingClientRect(); const o={tab:heroTab}; const b=document.querySelector(sel); o.y=b?Math.round(GR(b).top):null;
       const hl=document.querySelector('#heroDetail.tl-short .hd-left'); const bar=b&&b.parentElement;
       if(hl&&bar){ const a=GR(hl), c=GR(bar); o.overlap=(a.bottom>c.top+1&&a.top<c.bottom-1&&a.width>0); }
       const pw=document.getElementById('tlPw'), p=document.querySelector('.tl-panel');
       if(t==='talents'&&pw&&p){ const a=GR(pw), c=GR(p); o.board=Math.round(a.width); o.cut=(a.right>c.right+1||a.left<c.left-1||a.right>ewGameView().width+1); }
       return o; },[sel,t]);
     if(st.tab!==t){ S.tapFail++; fails.push(key+' '+k+' tap '+t+' -> heroTab '+st.tab); }
     if(st.y!=null) S.tabY.add(st.y);
     if(st.overlap){ S.overlap++; fails.push(key+' '+k+' name plate overlaps the tab row on '+t); }
     if(st.board!=null){ S.board.add(st.board); if(st.cut){ S.cut++; fails.push(key+' '+k+' board cut off ('+st.board+')'); } }
    }
    for(const i of [1,2,0]){ const bw=await pg.evaluate(i=>{ const b=document.querySelector('.tl-bn[data-tl-tree="'+i+'"]'); if(!b) return null; b.click(); return true; },i); await wait(300);
      const bwd=await pg.evaluate(()=>{ const pw=document.getElementById('tlPw'); return pw?Math.round(pw.offsetWidth):null; }); if(bwd!=null) S.board.add(bwd); }
   }
   await open(owned[0],'talents'); await wait(500); await clean(); await pg.screenshot({path:path.join(OUT,key.replace('/','-')+'-talents.png')});
   await open(owned[0],'stats'); await wait(400); await clean(); await pg.screenshot({path:path.join(OUT,key.replace('/','-')+'-stats.png')});
   S.tabY=[...S.tabY]; S.board=[...S.board];
   if(S.tabY.length>1) fails.push(key+' tab row heights differ: '+S.tabY.join(','));
   if(S.board.length>1) fails.push(key+' board sizes differ: '+S.board.join(','));
  }
  // 3) mode switches without a redraw (pop-out <-> full screen): the board must re-measure to its mode's size
  const sw=await pg.evaluate(async()=>{ const sl=ms=>new Promise(r=>setTimeout(r,ms)); const W=()=>{ const pw=document.getElementById('tlPw'); return pw?pw.offsetWidth:null; };
    const k=HERO_KEYS.find(k=>{ try{ return heroOwned(k); }catch(e){ return false; } }); detailHero=k; heroTab='talents'; closePopout(); show('heroDetail'); await sl(500); const full=W();
    closePopout(); popoutScreen('heroesPanel'); await sl(200); detailHero=k; popoutScreen('heroDetail'); await sl(500); const pop=W();
    const el=document.getElementById('heroDetail'); const isPop=el.classList.contains('popout');
    el.classList.toggle('popout'); await sl(500); const a=W(); el.classList.toggle('popout'); await sl(500); const b=W();
    return {full,pop,isPop,afterToggle:a,afterBack:b}; });
  summary[tag+'/switch']=sw;
  // 4) v1421b (Phil 18 Nov "Talents bugged AGAIN" / "open skills then talents then hit back"): with REAL taps, Heroes -> hero -> Talents -> Skills ->
  //    Talents -> the Heroes back button, then close Heroes: the closed hero window must not be visible anywhere (behind Heroes or on the town).
  { const own=await pg.evaluate(()=>HERO_KEYS.filter(k=>{ try{ return heroOwned(k); }catch(e){ return false; } }));
    for(const k of own.slice(0,3)){
      await pg.evaluate(()=>{ closePopout(); popoutScreen('heroesPanel'); }); await wait(400);
      await pg.evaluate(k=>{ detailHero=k; heroTab='stats'; popoutScreen('heroDetail'); },k); await wait(500); await clean();
      for(const t of ['talents','skills','talents']){ const sel='#heroDetailBody .hd-tab[data-tab="'+t+'"]'; try{ if(touch) await pg.tap(sel,{timeout:4000}); else await pg.click(sel,{timeout:4000}); }catch(e){} await wait(350); }
      const back=await pg.$('#heroDetail .backbtn'); if(back){ try{ if(touch) await back.tap(); else await back.click(); }catch(e){} } await wait(500);
      const behind=await pg.evaluate(()=>{ const hd=document.getElementById('heroDetail'); const vis=hd&&getComputedStyle(hd).display!=='none'&&hd.offsetWidth>0;
        return { active:hd&&hd.classList.contains('active'), visible:vis }; });
      await pg.evaluate(()=>closePopout()); await wait(400);
      const after=await pg.evaluate(()=>{ const hd=document.getElementById('heroDetail'); return hd&&getComputedStyle(hd).display!=='none'&&hd.offsetWidth>0; });
      if(behind.visible&&!behind.active) fails.push(tag+' '+k+' closed hero window still visible behind Heroes after Talents -> Skills -> Talents -> back');
      if(after) fails.push(tag+' '+k+' closed hero window still visible on the town after closing Heroes');
    } }
  if(sw.afterBack!==(sw.isPop?sw.pop:sw.full)) fails.push(tag+' board did not return to its size after a pop-out/full switch: '+JSON.stringify(sw));
  if(sw.afterToggle===(sw.isPop?sw.pop:sw.full)&&sw.pop!==sw.full) fails.push(tag+' board kept the other mode size after a switch without redraw: '+JSON.stringify(sw));
  if(errs.length) fails.push(tag+' page errors: '+[...new Set(errs)].slice(0,5).join(' | '));
  await ctx.close(); }
 await b.close();
 for(const [tag] of SIZES){ const p=summary[tag+'/popout'], q=summary[tag+'/full']; if(p&&q&&JSON.stringify(p.board)!==JSON.stringify(q.board)) fails.push(tag+' pop-out board '+p.board+' != full screen board '+q.board+' (Phil: the same size everywhere)'); }
 console.log(JSON.stringify(summary)); console.log('FAILS '+fails.length); if(fails.length) process.exitCode=1; fails.slice(0,60).forEach(f=>console.log(' - '+f));
})().catch(e=>{ console.error(e); process.exit(1); });
