'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 20 - Campaign Bonus Stages (Gauntlet Split) (campaign-20-bonus.md, the UNPROVEN-ON-SCREEN
   lines), in a real browser on this checkout's server (temp DB). Campaign is opened from its town plate.
   - BONUS X-X labels: chapters 1, 2 and 10 at 844x390 and 1280x720: every BONUS label visible, and a tap on the building's roof (not the
     label) opens the hero picker of that bonus stage.
   - Plates never cover stages: all 16 chapters at 844x390, 915x412 and 1280x720: no BONUS plate (.cbonus>span) overlaps a stage plate (.cnode).
   - Phone layout: 844x390 and 780x360, the place screen with 15 heroes: map left, tray right, START fully on screen, nothing scrolled.
   - Small-scale battle: a real 1-4 run with 15 heroes at 844x390: every hero's over-head bar and every damage number drawn stays inside its
     own road's strip of the screen; Sylthaine's Blizzard circle is no wider than about the road's depth.
   - Big effects as icons: Askel Greatbrow's and Nox's ultimates on a bonus road draw no ground plate, only over-head / under-feet badges,
     on the caster's road only.
   - Fallen road burns: the Middle road falls (its heroes' health set to 0, the engine kills them) - flames run right to left along it
     within about 1.5 s, stay until the result, and the bodies on it disappear.
   One screenshot per check per size (SHOT64 lines). Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_bonus.js', C=H.checker(TEST), shot=H.shooter(TEST);
const KEYS=['vael','aureth','sylthaine','vireo','brannus','tick','grosk','lumi','askel','nox','calypsa','yenna','kharos','umbris','astra'];
const HEROES=Object.fromEntries(KEYS.map(k=>[k,60]));
const NOW=Date.now();

async function settle(pg,ms){ await H.wait(ms||700); await H.prep(pg); }
async function openCampaign(pg,S){ const how=await H.openBuilding(pg,'campaign',S.touch);
  await pg.waitForFunction(()=>state==='campaign'&&document.querySelectorAll('#cmap .cnode').length>0,null,{timeout:30000}).catch(()=>{}); await settle(pg,1000); return how; }
async function chapter(pg,ch){
  await pg.evaluate(c=>{ try{ gsplitPickerClose(); }catch(e){} PORTAL='normal'; campViewCh=c; campViewUser=true; renderRoadmap(); },ch);
  await pg.evaluate(async()=>{ const im=document.querySelector('#cmap img'); for(let i=0;i<150&&im&&!(im.complete&&im.naturalWidth);i++) await new Promise(r=>setTimeout(r,100)); });
  await settle(pg,900); }   /* cbonusClearPlates runs at render, next frame and +500 ms */

async function labels(pg,S){
  for(const ch of [1,2,10]){ await chapter(pg,ch);
    const plates=await pg.evaluate(()=>[...document.querySelectorAll('#cmap .cbonus')].map(b=>{ const s=b.querySelector('span'), sb=s.getBoundingClientRect(), bb=b.getBoundingClientRect(), cs=getComputedStyle(s);
      const rx=bb.left+bb.width/2, ry=bb.top+bb.height*0.3, at=document.elementFromPoint(rx,ry);
      return {code:b.dataset.bonusStage,label:SL.txt(s),opacity:+cs.opacity,vis:SL.vis(s),on:SL.inView(s),labelFront:(()=>{ const t=document.elementFromPoint(sb.left+sb.width/2,sb.top+sb.height/2); return !!t&&(t===s||b.contains(t)); })(),
        roof:{x:rx,y:ry},roofIsBuilding:!!at&&b.contains(at),roofWho:SL.whoAt(b,0.5,0.3),labelBox:SL.R(s)}; }));
    const s=await shot(pg,S.tag+' chapter '+ch+' bonus labels');
    C.ok(plates.length===6&&plates.every(p=>p.vis&&p.opacity===1&&p.on&&p.labelFront&&p.label.startsWith('BONUS '+p.code)),S.tag+' BONUS X-X labels: chapter '+ch+' - all '+plates.length+' BONUS labels visible, on screen, not covered',
      {labels:plates.map(p=>p.label+(p.on?'':' OFF')+(p.labelFront?'':' COVERED')),shot:s});
    for(const p of plates){
      await pg.evaluate(()=>{ try{ gsplitPickerClose(); }catch(e){} GSPLIT_ENTRY=null; });
      if(S.touch) await pg.touchscreen.tap(p.roof.x,p.roof.y); else await pg.mouse.click(p.roof.x,p.roof.y);
      const opened=await pg.waitForFunction(code=>{ const el=document.getElementById('gsplitPicker'); return !!el&&!!el.querySelector('.gsplitHero')&&typeof GSPLIT_ENTRY!=='undefined'&&!!GSPLIT_ENTRY&&GSPLIT_ENTRY.id===code; },p.code,{timeout:15000}).then(()=>true).catch(()=>false);
      const s2=await shot(pg,S.tag+' roof tap '+p.code);
      const title=await pg.evaluate(()=>{ const el=document.getElementById('gsplitPicker'); return el?SL.txt(el).slice(0,60):null; });
      C.ok(opened&&p.roofIsBuilding,S.tag+' BONUS X-X labels: a tap on the roof of BONUS '+p.code+' (30% down the building, the label is below it) opens its picker',{roof:[Math.round(p.roof.x),Math.round(p.roof.y)],hit:p.roofWho,picker:title,shot:s2});
      await pg.evaluate(()=>{ try{ gsplitPickerClose(); }catch(e){} }); await H.wait(200); }
  }
}

async function plates(pg,S){
  const bad=[], rows=[];
  for(let ch=1;ch<=16;ch++){ await chapter(pg,ch);
    const r=await pg.evaluate(()=>{ const P=[...document.querySelectorAll('#cmap .cbonus>span')].map(s=>({code:s.parentElement.dataset.bonusStage,b:SL.R(s)})), N=[...document.querySelectorAll('#cmap .cnode')].map(n=>({code:n.dataset.code,b:SL.R(n)}));
      const hits=[]; for(const p of P) for(const n of N) if(SL.overlap(p.b,n.b)) hits.push('BONUS '+p.code+' on '+n.code); return {np:P.length,nn:N.length,hits}; });
    const s=await shot(pg,S.tag+' chapter '+ch+' plates');
    rows.push('ch'+ch+' '+r.np+' plates / '+r.nn+' stages'+(r.hits.length?' HIT: '+r.hits.join(', '):'')+' ('+s+')');
    if(r.hits.length||r.np!==6) bad.push({ch,hits:r.hits,plates:r.np,shot:s}); }
  C.ok(!bad.length,S.tag+' Plates never cover stages: all 16 chapters, 6 BONUS plates each - no plate rectangle touches a stage plate',{bad,chapters:rows});
}

async function pickAll(pg,S,id){
  await pg.evaluate(id=>{ const [c,s]=id.split('-'); openBonusModal(+c,+s); },id);
  await pg.waitForFunction(()=>document.querySelector('#gsplitPicker .gsplitHero'),null,{timeout:20000}); await H.wait(500);
  const tap=async sel=>{ if(S.touch) await pg.tap(sel,{timeout:10000}); else await pg.click(sel,{timeout:10000}); };
  await tap('#gsplitAuto'); await H.wait(400);
  const n=await pg.evaluate(()=>GSPLIT_ENTRY.picked.length);
  await tap('#gsplitNext'); await pg.waitForSelector('#gsplitPicker .gsplitPlaceBody',{timeout:10000}); await settle(pg,600); return n; }

async function phoneLayout(pg,S){
  const n=await pickAll(pg,S,'1-4');
  const r=await pg.evaluate(()=>{ const pk=document.getElementById('gsplitPicker'), map=document.getElementById('gsplitMapWrap'), side=document.querySelector('#gsplitPicker .gsplitSide'), tray=document.getElementById('gsplitTray'), st=document.getElementById('gsplitStart');
    const m=SL.R(map), sd=SL.R(side), t=SL.R(tray), s=SL.R(st), V=SL.V();
    return {V,map:m,side:sd,tray:t,start:s,chips:tray.querySelectorAll('.gsplitChip').length,flex:getComputedStyle(document.querySelector('#gsplitPicker .gsplitPlaceBody')).display,
      sideBySide:sd.x>=m.r-1&&sd.y<m.b&&m.y<sd.b,startOn:SL.inView(st,0),startFront:SL.front(st),scrollTop:pk.scrollTop,pickerScroll:SL.scrolls(pk)}; });
  const s=await shot(pg,S.tag+' place screen');
  C.ok(n===15&&r.flex==='flex'&&r.sideBySide&&r.startOn&&r.startFront&&r.scrollTop===0,S.tag+' Phone layout: place screen with '+n+' heroes - map left ('+[r.map.x,r.map.w].join('+')+'), hero tray right ('+[r.side.x,r.side.w].join('+')+'), START fully on screen ('+[r.start.x,r.start.y,r.start.w,r.start.h].join(',')+') with no scrolling',
    {...r,shot:s});
  await pg.evaluate(()=>{ try{ gsplitPickerClose(); }catch(e){} });
}

/* hooks on the battle overlay and the FX spawner, installed once */
const HOOKS=()=>{ if(window.__SLB) return; const W=window.__SLB={bars:[],texts:[],fx:[],rec:false};
  const P=CanvasRenderingContext2D.prototype, fr=P.fillRect, ftx=P.fillText;
  const hs=window.headScreenRest; window.headScreenRest=function(u){ W.curU=u; return hs.apply(this,arguments); };
  const sh=window.ftShow; window.ftShow=function(f){ W.curF=f; return sh.apply(this,arguments); };
  P.fillRect=function(x,y,w,h){ if(W.rec&&this.canvas&&this.canvas.id==='overlay'&&W.curU&&/^rgba\(8, 10, 16, 0\.82\)$/.test(String(this.fillStyle))){ const u=W.curU; W.curU=null;
      W.bars.push({t:performance.now(),u,x,y,w,h}); } return fr.apply(this,arguments); };
  P.fillText=function(s,x,y){ if(W.rec&&this.canvas&&this.canvas.id==='overlay'&&W.curF){ const f=W.curF; W.curF=null; if(!f.label) W.texts.push({t:performance.now(),f,s:String(s),x,y}); } return ftx.apply(this,arguments); };
  const sg=window.spawnGroundFx; window.spawnGroundFx=function(key,cx,cy,radius,life){ const o=sg.apply(this,arguments);
    if(W.rec) W.fx.push({t:performance.now(),bt:GSPLIT&&GSPLIT.lanes?Math.max(...GSPLIT.lanes.map(L=>L.battleTime||0)):0,key,cx,cy,radius,life,o,caster:window._fxCaster&&window._fxCaster.key,casterU:window._fxCaster,slot:window._fxCaster&&window._fxCaster._castSlot,
      above:!!window._fxAboveBar,feet:!!window._fxBelowFeet,tgt:window._fxTgtU||null,lane:(typeof GSPLIT!=='undefined'&&GSPLIT.curLane!=null)?GSPLIT.curLane:null}); return o; }; };

async function battle(pg,S){
  await pg.evaluate(HOOKS);
  const n=await pickAll(pg,S,'1-4');
  await pg.evaluate(()=>{ const a=document.getElementById('gsplitAutoPlace'); if(a&&!a.disabled) a.click(); }); await H.wait(400);
  const lanes0=await pg.evaluate(()=>{ const E=GSPLIT_ENTRY; return [1,2,3].map(L=>E.picked.filter(k=>E.laneOf[k]===L)); });
  await pg.evaluate(()=>document.getElementById('gsplitStart').click());
  await pg.waitForFunction(()=>typeof GSPLIT!=='undefined'&&GSPLIT.active&&state==='battle'&&GSPLIT.lanes&&GSPLIT.lanes.length===3&&!document.getElementById('battleLoader'),null,{timeout:180000});
  await H.wait(2500);
  await pg.evaluate(()=>{ if(!autoUlt){ const b=document.getElementById('autoBtn'); if(b) b.click(); } window.__SLB.rec=true; });
  const s0=await shot(pg,S.tag+' bonus run started');
  /* the three ultimates under test: fill their energy so they cast now (AUTO is on) */
  const cast=async key=>{ await pg.evaluate(k=>{ for(const L of GSPLIT.lanes) for(const u of L.units) if(u.key===k&&u.alive&&u.team==='ally') u.energy=100; },key); };
  for(const k of ['sylthaine','askel','nox']) await cast(k);
  const samples=[]; for(let i=0;i<24;i++){ await H.wait(400); if(i===6||i===12) for(const k of ['sylthaine','askel','nox']) await cast(k);
    if(i===3||i===10||i===18) samples.push(await shot(pg,S.tag+' bonus run '+(i*0.4).toFixed(1)+' s')); }
  const an=await pg.evaluate(()=>{ const W=window.__SLB, L=GSPLIT.lanes, cy=i=>{ const b=gsplitLaneBand(i); return {lo:project(FW/2,b.lo,0.001).y,hi:project(FW/2,b.hi,0.001).y}; };
    const B=[0,1,2].map(cy), cut=[(B[0].hi+B[1].lo)/2,(B[1].hi+B[2].lo)/2], reg=[[-1e9,cut[0]],[cut[0],cut[1]],[cut[1],1e9]];
    const laneOfU=u=>L.findIndex(l=>l.units.includes(u)), laneOfF=f=>L.findIndex(l=>l.fx&&l.fx.floatTexts&&l.fx.floatTexts.includes(f));
    const barsOut=[], nb={n:0}; for(const b of W.bars){ const u=b.u; if(!(u.team==='ally'&&!u._summon)) continue; const i=laneOfU(u); if(i<0) continue; nb.n++;
      if(b.y<reg[i][0]||b.y+b.h>reg[i][1]) barsOut.push(u.key+' road '+i+' bar y '+b.y.toFixed(1)+'-'+(b.y+b.h).toFixed(1)+' strip '+reg[i].map(v=>v.toFixed(0)).join('-')); }
    const textsOut=[], nt={n:0,unknown:0}; for(const x of W.texts){ const i=laneOfF(x.f); if(i<0){ nt.unknown++; continue; } nt.n++; if(x.y<reg[i][0]||x.y>reg[i][1]) textsOut.push('"'+x.s+'" road '+i+' y '+x.y.toFixed(1)+' strip '+reg[i].map(v=>v.toFixed(0)).join('-')); }
    /* Sylthaine's Blizzard: the plates her ultimate drew, diameter vs the road's depth (field units) */
    const depth=i=>{ const b=gsplitLaneBand(i); return b.hi-b.lo; };
    const blz=W.fx.filter(f=>f.caster==='sylthaine'&&f.slot==='ult'&&!f.above&&!f.feet).map(f=>{ const i=laneOfU(f.casterU); return {key:f.key,d:+(2*f.radius).toFixed(1),depth:+depth(i).toFixed(1),road:i,ratio:+(2*f.radius/depth(i)).toFixed(2)}; });
    const ultsFx=['askel','nox'].map(k=>{ const fs=W.fx.filter(f=>f.caster===k&&f.slot==='ult'), i=fs.length?laneOfU(fs[0].casterU):-1;
      return {k,calls:fs.length,keys:[...new Set(fs.map(f=>f.key))],plates:fs.filter(f=>!f.above&&!f.feet).map(f=>f.key+'@'+Math.round(f.cx)+','+Math.round(f.cy)),badges:fs.filter(f=>f.above||f.feet).length,
        road:i,otherRoad:fs.filter(f=>f.tgt&&laneOfU(f.tgt)!==i).map(f=>f.tgt.key+' road '+laneOfU(f.tgt)),castsSeen:fs.length?new Set(fs.map(f=>Math.round(f.bt))).size:0}; });
    return {cut,reg,bands:B,barsN:nb.n,barsOut:barsOut.slice(0,20),barsOutN:barsOut.length,textsN:nt.n,textsUnknown:nt.unknown,textsOut:textsOut.slice(0,20),textsOutN:textsOut.length,blz,ultsFx,
      lanesState:L.map(l=>l.state),allies:L.map(l=>l.units.filter(u=>u.team==='ally'&&!u._summon).map(u=>u.key))}; });
  C.ok(an.barsN>50&&an.barsOutN===0,S.tag+' Small-scale battle: '+an.barsN+' hero bar draws over 9.6 s, every one inside its own road\'s strip of the screen (strips split half way between the painted roads at y '+an.cut.map(v=>v.toFixed(0)).join(' / ')+')',
    {out:an.barsOut,roads:an.allies,state:an.lanesState,shots:[s0].concat(samples)});
  C.ok(an.textsN>10&&an.textsOutN===0,S.tag+' Small-scale battle: '+an.textsN+' damage numbers drawn, every one inside its own road\'s strip',{out:an.textsOut,unknownRoad:an.textsUnknown,shots:samples});
  C.ok(an.blz.length>0&&an.blz.every(b=>b.ratio<=1.25),S.tag+' Small-scale battle: Sylthaine\'s Blizzard circle is no wider than about its road\'s depth (diameter / depth: '+an.blz.map(b=>b.ratio).join(', ')+')',{blizzard:an.blz.slice(0,6),shots:samples});
  for(const u of an.ultsFx) C.ok(u.calls>0&&u.plates.length===0&&u.badges>0&&u.badges<=15*Math.max(1,u.castsSeen)&&u.otherRoad.length===0,S.tag+' Big effects as icons: '+u.k+'\'s ultimate on road '+u.road+' drew '+u.badges+' badges ('+u.keys.join(',')+'), no ground plate, none on another road',{...u,shots:samples});
  return an; }

async function burn(pg,S){
  const before=await pg.evaluate(()=>{ const L=GSPLIT.lanes[1]; window.__SLB.fx.length=0; window.__SLB.fireT0=performance.now();
    for(const u of L.units) if(u.team==='ally'&&u.alive) u.hp=0;   /* the engine kills them on its next tick (the hp<=0 path) */
    return {allies:L.units.filter(u=>u.team==='ally').map(u=>u.key),state:L.state}; });
  await pg.waitForFunction(()=>GSPLIT.lanes[1].state==='lost'&&GSPLIT.lanes[1]._fire,null,{timeout:20000});
  const t0=await pg.evaluate(()=>performance.now());
  const shots=[]; const marks=[];
  for(const ms of [300,700,1100,1600,2400]){ await pg.waitForFunction(([a,b])=>performance.now()-a>=b,[t0,ms]);
    marks.push(await pg.evaluate(([t0])=>{ const L=GSPLIT.lanes[1], f=L._fire, fx=window.__SLB.fx.filter(x=>x.key==='roadfire'&&x.life>1000);
      return {ms:Math.round(performance.now()-t0),done:!!(f&&f.done),ft:f?+f.t.toFixed(2):null,pace:(typeof BATTLE_PACE!=='undefined'?BATTLE_PACE:null),i:f&&f.i,n:f&&f.pts&&f.pts.length,patches:fx.length,alive:fx.filter(x=>x.o&&x.o.m&&x.o.m.parent&&x.o.m.visible!==false).length,
        xs:fx.slice(0,40).map(x=>Math.round(x.cx)),bodies:L.units.filter(u=>!u.alive&&u.mesh).length,hidden:L.units.filter(u=>!u.alive&&u.mesh&&u.mesh.visible===false).length}; },[t0]));
    shots.push(await shot(pg,S.tag+' middle road burning '+ms+' ms')); }
  /* still burning later, until the result */
  await H.wait(4000);
  const late=await pg.evaluate(()=>{ const fx=window.__SLB.fx.filter(x=>x.key==='roadfire'&&x.life>1000); return {state:state,active:GSPLIT.active,alive:fx.filter(x=>x.o&&x.o.m&&x.o.m.parent&&x.o.m.visible!==false).length,total:fx.length}; });
  shots.push(await shot(pg,S.tag+' middle road later'));
  const road=marks[marks.length-1], xs=(road.xs||[]), rtl=xs.length>3&&xs.every((x,k)=>k===0||x<=xs[k-1]+1);
  const dm=marks.find(m=>m.done)||{}, doneAt=dm.ms;
  C.ok(rtl&&doneAt!=null&&dm.ft!=null&&dm.ft<=1.1&&marks[0].patches>0&&marks[0].patches<road.patches,S.tag+' Fallen road burns: the Middle road fell ('+before.allies.join(', ')+') - fire patches laid right to left (x '+xs.slice(0,6).join(' > ')+' ...), the whole road alight after '+dm.ft+' s of game time (seen done at '+doneAt+' ms real on the CT)',{marks,shots});
  C.ok(late.alive>0&&late.alive===late.total&&(late.active||late.state==='result'),S.tag+' Fallen road burns: 4 s later all '+late.total+' fire patches of the road are still drawn (run '+(late.active?'still on':'at the result')+')',{late,shot:shots[shots.length-1]});
  C.ok(road.bodies>=0&&road.hidden===road.bodies,S.tag+' Fallen road burns: every body on the road is gone ('+road.hidden+' of '+road.bodies+' bodies hidden)',{road,shots});
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.camp={cleared:160,stars:{},att:null}; for(let i=1;i<=160;i++) u.led.camp.stars[i]=3; u.led.stam={v:300,ts:NOW}; });
  const s=await H.server(file); let pg=null;
  const size=(w,h,touch,tag)=>({w,h,touch,tag});
  const plan=[
    [H.SIZES.phone,['labels','plates','layout','battle']],
    [H.SIZES.desktop,['labels','plates']],
    [size(915,412,true,'Fold 915x412'),['plates']],
    [H.SIZES.phone2,['layout']]];
  try{
    for(const [S,parts] of plan){
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      const how=await openCampaign(pg,S); C.ok(await pg.evaluate(()=>state==='campaign'),S.tag+' Campaign opened from its town plate ('+how+')');
      for(const part of parts){ try{
          if(part==='labels') await labels(pg,S);
          if(part==='plates') await plates(pg,S);
          if(part==='layout') await phoneLayout(pg,S);
          if(part==='battle'){ await battle(pg,S); await burn(pg,S); }
        }catch(e){ C.ok(false,S.tag+' '+part+' part ran to the end',String(e&&e.stack||e).slice(0,600)); await shot(pg,S.tag+' '+part+' error'); } }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; await H.closeBrowser(); }   /* a fresh browser per size: the CT memory cap */
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
