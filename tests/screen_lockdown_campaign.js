'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 01 - Campaign (campaign-01.md, the UNPROVEN-ON-SCREEN lines), in a real browser on this
   checkout's server (temp DB), at desktop 1280x720 and phone 844x390 (touch). Campaign is opened from its town plate.
   - Portal tabs in the footer: the three portal tabs sit inside the bottom 50 px of the screen.
   - Top bar: Base, food pill, star bar, diamond pill and Glossary share one row (tops within 4 px) and do not overlap.
   - Full-screen painted map: all 16 chapters - the wide art covers the whole map area (no black bars), all 10 stage plates on screen.
   - Chapters without wide art: a chapter with its wide art taken away in the test page - map height = screen height, blurred side bars.
   - Opens on your stage: play 2-4 (from chapter 16), Quit - the map opens on chapter 2 with the 2-4 plate in view.
   - Guardian plates: Normal 1-3 / 1-6 / 1-9 draw Tick / Sylthaine / Vireo idle sheets that move, label HERO FRAGMENTS.
   - Boss plates: 1-10 draws Brukk's walk sheet that moves, label BOSS, in Normal, Elite and Veteran.
   - Reliable touch targets: every stage plate of all 16 chapters is a tap box of at least 44 x 44 px (probed with elementFromPoint),
     its centre is the plate and never a BONUS building.
   - Fight / Sweep / Back row: Normal 1-3 (+ 1-2 for X), Elite 1-1, Veteran 16-10 panels: Fight, x1, x10/x3, X and Back inside the screen,
     not covered, nothing scrolled.
   - Restart stops the old fight: a screenshot of Pause > Restart Stage on a real 1-1 fight, the old fight's units gone and its clock frozen
     while the new one loads (the full proof is tests/test_restart_teardown_1165.js, run alongside).
   One screenshot per check per size (SHOT64 lines). Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_campaign.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:60,aureth:60,sylthaine:60,vireo:60,brannus:60,tick:60,grosk:60,lumi:60};
const NOW=Date.now();
const SIZES=[H.SIZES.desktop,H.SIZES.phone];

async function settle(pg,ms){ await H.wait(ms||700); await H.prep(pg); }
const press=async(pg,touch,sel)=>{ if(touch) await pg.tap(sel,{timeout:10000}); else await pg.click(sel,{timeout:10000}); };
/* render a chapter of a portal the way the chapter arrows do, and wait for its art */
async function chapter(pg,mode,ch){
  await pg.evaluate(([m,c])=>{ try{ closeStageModal(); }catch(e){} PORTAL=m; campViewCh=c; campViewUser=true; renderRoadmap(); },[mode,ch]);
  await pg.evaluate(async()=>{ const m=document.getElementById('cmap'), inner=m&&m.firstElementChild, im=m&&m.querySelector('img');
    for(let i=0;i<150&&im&&!(im.complete&&im.naturalWidth);i++) await new Promise(r=>setTimeout(r,100));
    if(inner) await SL.bgLoaded(inner); });
  await settle(pg,900); }

async function topRow(pg,S){
  const r=await pg.evaluate(()=>{ const sel={base:'#campaign>.backbtn',food:'#campStamF',stars:'#starTrack>div',diamonds:'#campGemF',glossary:'#campGlossBtn',affinities:'#campAffBtn'};
    const o={}; for(const k in sel){ const e=document.querySelector(sel[k]); o[k]={box:SL.R(e),vis:SL.vis(e),on:SL.inView(e),front:SL.front(e)}; } return o; });
  const five=['base','food','stars','diamonds','glossary'], tops=five.map(k=>r[k].box&&r[k].box.y), ok5=five.every(k=>r[k].vis&&r[k].on);
  const spread=Math.max(...tops)-Math.min(...tops), over=[];
  const all=five.concat(['affinities']); for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++){ const a=r[all[i]].box,b=r[all[j]].box; if(a&&b&&a.x<b.r-0.5&&b.x<a.r-0.5&&a.y<b.b-0.5&&b.y<a.b-0.5) over.push(all[i]+'/'+all[j]); }
  const s=await shot(pg,S.tag+' top bar');
  C.ok(ok5&&spread<=4&&!over.length,S.tag+' Top bar: Base, food pill, star bar, diamond pill and Glossary on one row (tops within '+spread.toFixed(1)+' px), none overlapping (Affinities too)',
    {tops:Object.fromEntries(all.map(k=>[k,r[k].box&&[r[k].box.x,r[k].box.y,r[k].box.w,r[k].box.h]])),overlaps:over,shot:s});
}

async function portalTabs(pg,S){
  const r=await pg.evaluate(()=>{ const V=SL.V(); return {h:V.height,tabs:[...document.querySelectorAll('#portalTabs .btn')].map(b=>({t:SL.txt(b),box:SL.R(b),front:SL.front(b)}))}; });
  const ok=r.tabs.length===3&&r.tabs.every(t=>t.box.y>=r.h-50-0.5&&t.box.b<=r.h+0.5&&t.front);
  const s=await shot(pg,S.tag+' portal tabs');
  C.ok(ok,S.tag+' Portal tabs in the footer: the 3 portal tabs sit inside the bottom 50 px of the '+r.h+' px screen',{tabs:r.tabs.map(t=>t.t+' y '+t.box.y+'-'+t.box.b+(t.front?'':' COVERED')),shot:s});
}

/* all 16 Normal chapters: the wide art covers the map area, 10 plates on screen, every plate a 44 px tap box */
async function chapters(pg,S){
  const bad=[], tapBad=[], rows=[];
  for(let ch=1;ch<=16;ch++){ await chapter(pg,'normal',ch);
    const r=await pg.evaluate(async ch=>{ const scr=document.getElementById('cmapScroll'), inner=document.getElementById('cmap').firstElementChild, V=SL.V();
      const ib=SL.R(inner), sb=SL.R(scr), bg=await SL.bgLoaded(inner), wide=String(CH_WIDE_MAPS[ch]||'').split('?')[0];
      const nodes=[...document.querySelectorAll('#cmap .cnode')];
      const plates=nodes.map(n=>{ const b=n.getBoundingClientRect(), cx=b.left+b.width/2, cy=b.top+b.height/2, hit=(x,y)=>{ const t=document.elementFromPoint(x,y); return !!t&&(t===n||n.contains(t)); };
        const c=document.elementFromPoint(cx,cy), cb=!!(c&&c.closest&&c.closest('.cbonus'));
        const pts=[[-21.5,-21.5],[21.5,-21.5],[-21.5,21.5],[21.5,21.5],[0,-21.5],[0,21.5],[-21.5,0],[21.5,0]], miss=pts.filter(([dx,dy])=>!hit(cx+dx,cy+dy));
        /* the real box: walk out from the centre until the tap no longer reaches the plate */
        let l=0,rr=0,u=0,d=0; while(l<60&&hit(cx-l-1,cy)) l++; while(rr<60&&hit(cx+rr+1,cy)) rr++; while(u<60&&hit(cx,cy-u-1)) u++; while(d<60&&hit(cx,cy+d+1)) d++;
        return {code:n.dataset.code,elite:n.classList.contains('elite'),boss:n.classList.contains('boss'),on:b.left>=-1&&b.right<=V.width+1&&b.top>=-1&&b.bottom<=V.height+1,
          centre:hit(cx,cy),bonusAtCentre:cb,miss:miss.length,box:(l+rr+1)+'x'+(u+d+1),who:cb?SL.whoAt(n):null}; });
      return {ib,sb,bg:bg.map(x=>x.url.split('/').pop().split('?')[0]+(x.ok?'':' NOT LOADED')),bgOk:bg.some(x=>x.ok&&x.url.split('?')[0].endsWith(wide.replace(/^.*\//,''))),wideArt:wide.split('/').pop(),
        bars:!!document.querySelector('#cmap .cmapBars'),plates}; },ch);
    const covers=r.ib&&r.sb&&r.ib.x<=r.sb.x+1&&r.ib.r>=r.sb.r-1&&r.ib.y<=r.sb.y+1&&r.ib.b>=r.sb.b-1;
    const ten=r.plates.length===10&&r.plates.every(p=>p.on);
    const s=await shot(pg,S.tag+' chapter '+ch);
    rows.push('ch'+ch+': art '+(r.bgOk?'ok':'MISSING')+', area '+(r.ib&&[r.ib.x,r.ib.y,r.ib.w,r.ib.h].join(','))+' vs '+(r.sb&&[r.sb.x,r.sb.y,r.sb.w,r.sb.h].join(','))+', plates on '+r.plates.filter(p=>p.on).length+'/'+r.plates.length+' ('+s+')');
    if(!(covers&&r.bgOk&&!r.bars&&ten)) bad.push({ch,covers,art:r.bg,want:r.wideArt,bars:r.bars,off:r.plates.filter(p=>!p.on).map(p=>p.code),n:r.plates.length,shot:s});
    for(const p of r.plates) if(!p.centre||p.bonusAtCentre||p.miss) tapBad.push(p.code+' box '+p.box+(p.centre?'':' CENTRE-NOT-PLATE')+(p.bonusAtCentre?' BONUS-AT-CENTRE '+p.who:'')+(p.miss?' '+p.miss+'/8 edge probes miss':''));
    if(ch===1||ch===16) C.ok(true,S.tag+' (sample) tap boxes ch'+ch,r.plates.map(p=>p.code+' '+p.box).join(' | '));
  }
  C.ok(!bad.length,S.tag+' Full-screen painted map: all 16 chapters - the wide map art is loaded and covers the whole map area (no black bars), all 10 stage plates inside the screen',{bad,chapters:rows});
  C.ok(!tapBad.length,S.tag+' Reliable touch targets: all 160 stage plates (16 chapters) - a 44 x 44 px tap box around each plate centre reaches the plate, and the centre is never a BONUS building',{failing:tapBad.slice(0,40),count:tapBad.length});
}

async function noWide(pg,S){
  const saved=await pg.evaluate(()=>{ const v=CH_WIDE_MAPS[3]; delete CH_WIDE_MAPS[3]; return v; });
  try{ await chapter(pg,'normal',3);
    const r=await pg.evaluate(()=>{ const inner=document.getElementById('cmap').firstElementChild, bars=document.querySelector('#cmap .cmapBars'), im=document.querySelector('#cmap img'), V=SL.V(), scr=document.getElementById('cmapScroll');
      const cs=bars?getComputedStyle(bars):null, ib=SL.R(inner), mb=SL.R(im), sb=SL.R(scr);
      /* the blurred side bars are what shows left and right of the map picture */
      const sideL=mb&&ib?mb.x-ib.x:0, sideR=mb&&ib?ib.r-mb.r:0;
      return {V,inner:ib,img:mb,scr:sb,bars:!!bars,barsVis:bars?SL.vis(bars):false,filter:cs&&cs.filter,barsBg:cs&&cs.backgroundImage.slice(0,90),sideL,sideR,
        leftWho:ib?SL.whoAt(document.getElementById('cmap'),0.02,0.5):null}; });
    const s=await shot(pg,S.tag+' chapter 3 without wide art');
    const ok=r.bars&&r.barsVis&&/blur/.test(r.filter||'')&&Math.abs(r.img.h-r.V.height)<=2&&Math.abs(r.inner.h-r.V.height)<=2&&r.sideL>20&&r.sideR>20;
    C.ok(ok,S.tag+' Chapters without wide art: chapter 3 with its wide art removed in the test page - the map is the screen height ('+(r.img&&r.img.h)+' of '+r.V.height+' px) and the blurred dark copy shows at both sides ('+Math.round(r.sideL)+' / '+Math.round(r.sideR)+' px)',{...r,shot:s});
  } finally { await pg.evaluate(v=>{ CH_WIDE_MAPS[3]=v; },saved); }
}

async function idlePlates(pg,S,mode,want,label,name){
  await chapter(pg,mode,1);
  const r=await pg.evaluate(async([want,label])=>{ const out=[];
    for(const [stage,key] of want){ const n=document.querySelector('#cmap .cnode[data-stage-plate="'+stage+'"]'), cv=n&&n.querySelector('canvas.cIdle'), lb=n&&n.querySelector('.ewcmLbl');
      if(n) n.scrollIntoView({block:'nearest',inline:'center'});
      const grab=()=>{ try{ const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; let h=0,ink=0; for(let i=0;i<d.length;i+=4){ if(d[i+3]>8) ink++; h=(h*31+d[i]*3+d[i+1]*5+d[i+2]*7+d[i+3])>>>0; } return {h,ink}; }catch(e){ return {err:String(e)}; } };
      let a=null; for(let i=0;i<40&&cv;i++){ a=grab(); if(a.ink>0) break; await new Promise(r=>setTimeout(r,100)); }
      const frames=new Set(); for(let i=0;i<12&&cv;i++){ await new Promise(r=>setTimeout(r,100)); const g=grab(); if(g.ink>0) frames.add(g.h); }
      out.push({stage,key,code:n&&n.dataset.code,sheet:cv?cv.dataset.u.split('/').slice(-2).join('/'):null,keyOk:!!cv&&cv.dataset.u.toLowerCase().includes('/'+key.split(' ')[0])&&(label!=='BOSS'||/_walk/.test(cv.dataset.u)),
        drawn:a&&a.ink,distinct:frames.size,label:lb?SL.txt(lb):'',labelOk:!!lb&&SL.txt(lb).replace(/\s+/g,' ').toUpperCase()===label,on:n?SL.inView(n):false}); }
    return out; },[want,label]);
  const s=await shot(pg,S.tag+' '+name);
  for(const p of r) C.ok(p.keyOk&&p.drawn>0&&p.distinct>=2&&p.labelOk&&p.on,S.tag+' '+name+': '+mode+' '+p.code+' draws '+p.key+' ('+p.sheet+'), animating ('+p.distinct+' different frames in 1.2 s), label "'+p.label+'"',{...p,shot:s});
}

async function actionRows(pg,S){
  const cases=[['normal',3,false],['normal',2,true],['elite',1,false],['veteran',160,false]];
  for(const [mode,node,needX] of cases){
    await chapter(pg,mode,Math.ceil(node/10));
    await pg.evaluate(([m,n])=>openStageModal(n,m),[mode,node]);
    await pg.waitForFunction(k=>window.SM_KEY===k&&STAGE_CACHE[k],mode+':'+node,{timeout:20000}).catch(()=>{}); await settle(pg,900);
    const r=await pg.evaluate(()=>{ const ids=['smBattle','smSweep','smSweep10','smSweepX','smClose'], o={};
      for(const id of ids){ const e=document.getElementById(id); o[id]=e?{t:SL.txt(e),box:SL.R(e),on:SL.inView(e),front:SL.front(e)}:null; }
      const scrolled=[]; let e=document.getElementById('smBattle'); while(e){ if(e.scrollTop>0) scrolled.push((e.id||e.className)+' '+e.scrollTop); e=e.parentElement; }
      const sc=document.querySelector('#stageModal .smStageScroll'); return {o,scrolled,winY:scrollY,title:SL.txt(document.querySelector('#stageModal .smStageTitle'))}; });
    const need=['smBattle','smSweep','smSweep10','smClose'].concat(needX?['smSweepX']:[]);
    const ok=need.every(id=>r.o[id]&&r.o[id].on&&r.o[id].front)&&!r.scrolled.length&&r.winY===0;
    const s=await shot(pg,S.tag+' stage panel '+mode+' '+node);
    C.ok(ok,S.tag+' Fight / Sweep / Back row: '+mode+' '+r.title+' - '+need.map(id=>(r.o[id]?r.o[id].t:id+' MISSING')).join(', ')+' all inside the screen, not covered, nothing scrolled',
      {buttons:Object.fromEntries(Object.entries(r.o).filter(([k,v])=>v).map(([k,v])=>[k,[v.box.x,v.box.y,v.box.w,v.box.h,v.on?'on':'OFF',v.front?'':'COVERED'].join(' ')])),scrolled:r.scrolled,shot:s});
    await pg.evaluate(()=>closeStageModal()); }
}

/* a real fight: 2-4 from the map, Restart once (shot), Quit; the map must open on chapter 2 with 2-4 in view */
async function playQuit(pg,S,s){
  await chapter(pg,'normal',16);   /* the player is looking at chapter 16 */
  await pg.evaluate(()=>{ campViewCh=2; campViewUser=true; renderRoadmap(); }); await settle(pg,900);   /* the chapter arrows to chapter 2 */
  await pg.evaluate(()=>document.querySelector('#cmap .cnode[data-stage-plate="14"]').scrollIntoView({block:'nearest',inline:'center'}));
  await press(pg,S.touch,'#cmap .cnode[data-stage-plate="14"]');
  await pg.waitForFunction(()=>document.getElementById('stageModal').classList.contains('active')&&window.SM_KEY==='normal:14',null,{timeout:20000});
  await H.wait(700); await press(pg,S.touch,'#smBattle');
  await pg.waitForFunction(()=>state==='menu',null,{timeout:20000}); await H.wait(1500); await H.clean(pg);
  await pg.evaluate(()=>document.getElementById('startBtn').click());
  await pg.waitForFunction(()=>state==='battle'&&!document.getElementById('battleLoader')&&units.length>0,null,{timeout:180000}); await H.wait(4000);
  /* Restart Stage (pause menu) */
  const b0=await pg.evaluate(()=>({units:units.length,bt:+battleTime.toFixed(2),cur:CUR.node}));
  await pg.evaluate(()=>document.getElementById('pauseBtn').click()); await H.wait(400);
  const ps=await shot(pg,S.tag+' pause menu');
  await pg.evaluate(()=>{ window.__ub=0; const o=updateBattle; window.__ubo=o; window.updateBattle=function(){ window.__ub++; return o.apply(this,arguments); }; document.getElementById('restartBtn').click(); });
  await H.wait(250);
  const ld=await pg.evaluate(()=>({loader:!!document.getElementById('battleLoader'),units:units.length,bt:+battleTime.toFixed(2),ub:window.__ub,haz:groundHazards.length,shots:shots.length}));
  const ls=await shot(pg,S.tag+' restart loading');
  await H.wait(300); const ld2=await pg.evaluate(()=>({loader:!!document.getElementById('battleLoader'),units:units.length,bt:+battleTime.toFixed(2),ub:window.__ub}));
  await pg.waitForFunction(()=>state==='battle'&&!document.getElementById('battleLoader')&&units.length>0,null,{timeout:180000}); await H.wait(2500);
  const nf=await pg.evaluate(()=>({units:units.length,bt:+battleTime.toFixed(2),cur:CUR.node}));
  const ns=await shot(pg,S.tag+' restarted fight');
  C.ok(b0.units>0&&b0.bt>0&&ld.units===0&&ld.haz===0&&ld.shots===0&&(!ld2.loader||(ld2.ub===ld.ub&&ld2.bt===ld.bt))&&nf.units>0&&nf.cur===14,
    S.tag+' Restart stops the old fight: 2-4 fight at '+b0.bt+' s with '+b0.units+' units -> Restart Stage: 0.25 s later 0 units, 0 ground hazards, 0 projectiles, clock frozen while loading; the new 2-4 fight then runs',{before:b0,loading:ld,loading2:ld2,newFight:nf,shots:[ps,ls,ns]});
  /* Quit */
  await pg.evaluate(()=>document.getElementById('pauseBtn').click()); await H.wait(400);
  await pg.evaluate(()=>document.getElementById('exitBtn').click());
  await pg.waitForFunction(()=>state==='campaign',null,{timeout:30000}); await H.wait(1500);
  await pg.evaluate(async()=>{ const im=document.querySelector('#cmap img'); for(let i=0;i<100&&im&&!im.complete;i++) await new Promise(r=>setTimeout(r,100)); }); await settle(pg,900);
  const r=await pg.evaluate(()=>{ const n=document.querySelector('#cmap .cnode[data-stage-plate="14"]'), scr=document.getElementById('cmapScroll'), b=SL.R(n), sb=SL.R(scr);
    return {ch:campViewCh,hdr:SL.txt(document.getElementById('cmapHdr')),plate:b,scroll:sb,inScroll:!!b&&b.x>=sb.x-1&&b.r<=sb.r+1&&b.y>=sb.y-1&&b.b<=sb.b+1,on:n?SL.inView(n):false,front:n?SL.front(n):false,just:n?n.classList.contains('justplayed'):false}; });
  const qs=await shot(pg,S.tag+' after quit');
  C.ok(r.ch===2&&/Chapter 2\b/.test(r.hdr)&&r.inScroll&&r.on,S.tag+' Opens on your stage: played 2-4 (map was on chapter 16 before), Quit - the map opens on "'+r.hdr.slice(0,40)+'" with the 2-4 plate inside the visible map',{...r,shot:qs});
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.camp={cleared:160,stars:{},att:null}; for(let i=1;i<=160;i++) u.led.camp.stars[i]=3;
    u.led.portals={elite:{cleared:160,stars:{},att:null,runs:{}},veteran:{cleared:159,stars:{},att:null,runs:{}}};
    u.led.stam={v:300,ts:NOW}; });
  const s=await H.server(file); let pg=null;
  try{
    for(const S of SIZES){
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      const how=await H.openBuilding(pg,'campaign',S.touch);
      await pg.waitForFunction(()=>state==='campaign'&&document.querySelectorAll('#cmap .cnode').length>0,null,{timeout:30000}).catch(()=>{}); await settle(pg,1200);
      C.ok(await pg.evaluate(()=>state==='campaign'),S.tag+' Campaign opened from its town plate ('+how+')');
      for(const [nm,fn] of [['top bar',()=>topRow(pg,S)],['portal tabs',()=>portalTabs(pg,S)],
        ['guardian',()=>idlePlates(pg,S,'normal',[[3,'tick'],[6,'sylthaine'],[9,'vireo']],'HERO FRAGMENTS','Guardian plates')],
        ['boss normal',()=>idlePlates(pg,S,'normal',[[10,'brukk']],'BOSS','Boss plates')],
        ['boss elite',()=>idlePlates(pg,S,'elite',[[10,'brukk']],'BOSS','Boss plates')],
        ['boss veteran',()=>idlePlates(pg,S,'veteran',[[10,'brukk']],'BOSS','Boss plates')],
        ['chapters',()=>chapters(pg,S)],['no wide',()=>noWide(pg,S)],['actions',()=>actionRows(pg,S)],['play',()=>playQuit(pg,S,s)]]){
        try{ await fn(); }catch(e){ C.ok(false,S.tag+' '+nm+' part ran to the end',String(e&&e.stack||e).slice(0,500)); await shot(pg,S.tag+' '+nm+' error'); } }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; await H.closeBrowser(); }   /* a fresh browser per size: the CT memory cap */
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
