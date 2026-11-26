'use strict';
/* Lockdown audit 25 Nov 2026 (live v1454), Heroes building, heroes-A-list-to-skills.md on-screen lines, in a real browser on this checkout's server
   (temp DB), at 1280x720 and 844x390 (phone landscape, touch):
   - Preview stage: choosing a skill plays the hero ALONE on the battle floor casting its real fight animation. The stage canvas (#skStage) is read
     pixel by pixel: not the empty floor, moving between 0.5 s and 1.5 s; every frame draws the floor and exactly one hero sheet, the sheet of the
     fight clip (BATTLE_ANIM) the plan plays at that moment; a tap on a skill row plays that slot.
   - Real spell effects: Vael's blue skill and Deepcleft's ultimate. The spell art's pixels (frame with the art minus the same frame with the art
     held back) appear at the plan's moment - the fight's own cast time (castTimeFor / FX_RT) - not before; and no spell-art pixel ever touches
     the canvas edge (big effects shrink to fit).
   The stage clock is held on a test clock (requestAnimationFrame's time stamp), so every frame is read at an exact preview time on any machine.
   Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-1450.js');
const C=H.checker('test_screens_skillstage_1454.js');
const HEROES={vael:60,deepcleft:60,vireo:30};

const openHero=(pg,key,tab)=>pg.evaluate(([key,tab])=>{ document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); try{ talentCardHide(); }catch(e){}
  closePopout(); popoutScreen('heroesPanel'); detailHero=key; heroTab=tab; popoutScreen('heroDetail'); renderHeroDetail(); },[key,tab]);
const press=(pg,touch,sel)=>touch?pg.tap(sel):pg.click(sel);

/* page side: the test clock, a drawImage log on the stage canvas, and frame reads */
const RIG=()=>{ if(window.__rig) return; window.__rig=1; window.__fakeT=null; window.__frames=0; const o=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>o(ts=>{ window.__frames++; cb(window.__fakeT!=null?window.__fakeT:ts); });
  const real=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(im){ if(this.canvas&&this.canvas.id==='skStage'&&window.__log) window.__log.push(String(im&&(im.currentSrc||im.src)||'')); return real.apply(this,arguments); };
  const nf=n=>new Promise(r=>{ const f0=window.__frames; const chk=()=>{ if(window.__frames>=f0+n) r(); else setTimeout(chk,10); }; chk(); });
  const base=u=>String(u||'').split('?')[0].replace(/^.*\//,'').replace(/\.[a-z0-9]+$/i,'');
  window.__base=base;
  /* the frame at preview time T (s). held: the spell art held back (every fx entry moved far into the future; the layout fit is unchanged) */
  window.__frameAt=async(T,held)=>{ const st=EmberSkillStage.current(), P=st.plan; const sh=held&&P?P.fx.map(e=>e.t0):null; if(sh) P.fx.forEach(e=>{ e.t0+=1e6; });
    window.__fakeT=st.t0+T*1000; await nf(1); window.__log=[]; await nf(1); const log=window.__log; window.__log=null;
    const cv=st.canvas, g=cv.getContext('2d'), d=g.getImageData(0,0,cv.width,cv.height).data; if(sh) P.fx.forEach((e,i)=>{ e.t0=sh[i]; });
    return {d,w:cv.width,h:cv.height,log}; };
  window.__diff=(a,b,band)=>{ let n=0, edge=0, x0=1e9,y0=1e9,x1=-1,y1=-1; const W=a.w,Hh=a.h; band=band||2;
    for(let y=0;y<Hh;y++) for(let x=0;x<W;x++){ const i=(y*W+x)*4; if(Math.abs(a.d[i]-b.d[i])+Math.abs(a.d[i+1]-b.d[i+1])+Math.abs(a.d[i+2]-b.d[i+2])>12){ n++;
      if(x<band||y<band||x>=W-band||y>=Hh-band) edge++; if(x<x0)x0=x; if(y<y0)y0=y; if(x>x1)x1=x; if(y>y1)y1=y; } }
    return {n,edge,box:n?[x0,y0,x1,y1]:null}; };
  window.__floorOnly=async()=>{ const st=EmberSkillStage.current(), cv=st.canvas, im=new Image(); im.src='/assets/img/battlefields/emberdraft/cinderforge.webp'; await im.decode();
    const c=document.createElement('canvas'); c.width=cv.width; c.height=cv.height; const g=c.getContext('2d'), dpr=cv.width/(cv.clientWidth||1); g.setTransform(dpr,0,0,dpr,0,0);
    const W=cv.clientWidth, Hh=cv.clientHeight, nw=im.naturalWidth, nh=im.naturalHeight; let sx=nw*0.14, sy=nh*0.12, sw=nw*0.72, sh=nh*0.62; const want=W/Hh;
    if(sw/sh>want){ const nsw=sh*want; sx+=(sw-nsw)/2; sw=nsw; } else { const nsh=sw/want; sy+=(sh-nsh)/2; sh=nsh; } g.drawImage(im,sx,sy,sw,sh,0,0,W,Hh);
    return {d:g.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height}; };
  window.__warm=async times=>{ const st=EmberSkillStage.current(); for(let k=0;k<3;k++){ for(const T of times) await window.__frameAt(T,false);
    for(let i=0;i<200&&Object.values(st.imgs).some(x=>!x.complete);i++) await new Promise(r=>setTimeout(r,100)); } };
};

async function stage(pg,tag,touch){
  await pg.evaluate(RIG);
  await openHero(pg,'vael','stats'); await H.wait(600); await H.clean(pg);
  await press(pg,touch,'#heroDetailBody .hd-tab[data-tab="skills"]'); await H.wait(900);
  await pg.waitForFunction(()=>{ const s=window.EmberSkillStage&&EmberSkillStage.current(); return !!(s&&s.key==='vael'&&s.plan); },null,{timeout:30000}).catch(()=>{});
  const info=await pg.evaluate(async()=>{ const st=EmberSkillStage.current(), cv=document.getElementById('skStage'), r=cv.getBoundingClientRect();
    await window.__warm([0.2,0.5,1.0,1.5]); return {key:st.key,slot:st.slot,plan:!!st.plan,css:Math.round(r.width)+'x'+Math.round(r.height),px:cv.width+'x'+cv.height,on:r.width>100&&r.top>=-1&&r.bottom<=innerHeight+1,
      clips:st.plan.clips.map(c=>c.st)}; });
  C.ok(info.key==='vael'&&info.plan&&info.on,tag+' Preview stage: the Skills tab mounts the stage on Vael ('+info.css+' css px, slot '+info.slot+', clips '+info.clips.join(' + ')+')',info);
  const m=await pg.evaluate(async()=>{ const st=EmberSkillStage.current(), floor=await window.__floorOnly(), a=await window.__frameAt(0.5), b=await window.__frameAt(1.5), d0=window.__diff(a,floor), d1=window.__diff(a,b);
    const an=BATTLE_ANIM[st.key], P=st.plan, B=window.__base, BG='cinderforge';
    const sheets=new Set(); for(const s in an){ const A=an[s]; if(A&&A.u){ sheets.add(B(A.u)); try{ const F=artFile(A.u); if(F) sheets.add(B(F.u)); }catch(e){} } }
    const fxs=new Set(); P.fx.forEach(e=>{ if(e.d&&e.d.u){ fxs.add(B(e.d.u)); try{ const F=artFile(e.d.u); if(F) fxs.add(B(F.u)); }catch(e){} } });
    /* frame by frame over the plan: what the canvas drew, and which clip the plan plays then */
    const rows=[], bad=[]; for(let T=0.05;T<P.end;T+=0.15){ const f=await window.__frameAt(T); const logs=f.log.map(B);
      const c=P.clips.find(c=>T>=c.t0&&T<c.t0+c.dur), wantSet=new Set(); if(c){ wantSet.add(B(c.A.u)); try{ const F=artFile(c.A.u); if(F) wantSet.add(B(F.u)); }catch(e){} }
      const heroes=logs.filter(x=>x!==BG&&!fxs.has(x)), floorN=logs.filter(x=>x===BG).length;
      const ok=floorN===1&&heroes.length===1&&(!c||wantSet.has(heroes[0]))&&(c?true:sheets.has(heroes[0]));
      rows.push(T.toFixed(2)+' '+(c?c.st:'idle')+': '+heroes.join(',')); if(!ok) bad.push({T:+T.toFixed(2),clip:c&&c.st,drawn:logs}); }
    return {notFloor:d0.n,changed:d1.n,px:a.w*a.h,frames:rows.length,bad:bad.slice(0,4),sample:rows.filter((_,i)=>i%4===0).slice(0,6)}; });
  C.ok(m.notFloor>m.px*0.005,tag+' Preview stage: the canvas is not the empty floor ('+m.notFloor+' of '+m.px+' pixels differ from the bare Cinderforge floor at 0.5 s)',{notFloor:m.notFloor,px:m.px});
  C.ok(m.changed>200,tag+' Preview stage: the picture moves ('+m.changed+' pixels change between 0.5 s and 1.5 s)',{changed:m.changed});
  C.ok(m.bad.length===0&&m.frames>=5,tag+' Preview stage: every frame ('+m.frames+' read over the whole play) draws the floor and exactly ONE hero sheet: the fight clip (BATTLE_ANIM) the plan plays at that moment',{bad:m.bad,sample:m.sample});
  /* a tap / click on the ultimate row plays it */
  await pg.evaluate(()=>document.querySelector('#heroDetailBody .skrow[data-skill="0"]').scrollIntoView({block:'center'})); await H.wait(200);
  await press(pg,touch,'#heroDetailBody .skrow[data-skill="0"]'); await H.wait(500);
  const s0=await pg.evaluate(()=>{ const st=EmberSkillStage.current(); return {slot:st.slot,plan:!!st.plan,clips:st.plan&&st.plan.clips.map(c=>c.st),want:skillPreviewStates('vael',0),sel:!!document.querySelector('#heroDetailBody .skrow.sksel[data-skill="0"]'),cap:(document.getElementById('skClipCap')||{}).textContent}; });
  C.ok(s0.slot===0&&s0.plan&&JSON.stringify(s0.clips)===JSON.stringify(s0.want)&&s0.sel,tag+' Preview stage: '+(touch?'a tap':'a click')+' on the ultimate row plays slot 0 ("'+s0.cap+'", clips '+(s0.clips||[]).join(' + ')+' = the fight\'s)',s0);
}

async function spells(pg,tag,touch){
  await pg.evaluate(RIG);
  for(const [key,slot,label] of [['vael',2,'Vael blue'],['deepcleft',0,'Deepcleft ultimate']]){
    await openHero(pg,key,'stats'); await H.wait(600); await H.clean(pg);
    await press(pg,touch,'#heroDetailBody .hd-tab[data-tab="skills"]'); await H.wait(900);
    await pg.evaluate(sl=>{ const r=document.querySelector('#heroDetailBody .skrow[data-skill="'+sl+'"]'); if(r) r.scrollIntoView({block:'center'}); },slot); await H.wait(200);
    await press(pg,touch,'#heroDetailBody .skrow[data-skill="'+slot+'"]'); await H.wait(500);
    const r=await pg.evaluate(async([key,slot])=>{ const st=EmberSkillStage.current(); if(!st||st.key!==key||st.slot!==slot||!st.plan) return {ok:false,key:st&&st.key,slot:st&&st.slot};
      const P=st.plan, bs=SKP_BSLOT[slot], cast=castTimeFor({key,t:HERO_TYPES[key]},bs), fx=P.fx.slice().sort((a,b)=>a.t0-b.t0), f0=fx[0];
      if(!f0) return {ok:false,why:'no spell art in the plan'};
      const life=fx.reduce((m,e)=>Math.max(m,e.t0+Math.min(8,(e.real!=null)?e.real:(e.life!=null)?(e.d.rt?e.life:e.life/FX_RT):(e.dur!=null?e.dur:e.d.dur||1))),0);
      const times=[]; for(let T=Math.max(0,f0.t0-0.3);T<=Math.min(P.end,life)+0.01;T+=0.05) times.push(+T.toFixed(3));
      await window.__warm([f0.t0+0.1,f0.t0+0.4,(f0.t0+life)/2]);
      let first=null, maxN=0, edge=0, edgeAt=[], box=null; const before=[];
      for(const T of times){ const a=await window.__frameAt(T,false), b=await window.__frameAt(T,true), d=window.__diff(a,b,2);
        if(T<f0.t0-0.001) before.push(d.n); if(d.n>30&&first==null) first=T; if(d.n>maxN){ maxN=d.n; box=d.box; } if(d.edge){ edge+=d.edge; if(edgeAt.length<4) edgeAt.push(T); } }
      const cv=st.canvas;
      return {ok:true,rel:+P.rel.toFixed(3),castFight:cast,castReal:+(cast/FX_RT).toFixed(3),fxRT:FX_RT,fx0:+f0.t0.toFixed(3),fxKinds:fx.map(e=>e.kind+'@'+e.t0.toFixed(2)).slice(0,6),first,beforeMax:before.length?Math.max(...before):0,beforeN:before.length,
        frames:times.length,maxPixels:maxN,maxBox:box,canvas:cv.width+'x'+cv.height,edge,edgeAt}; },[key,slot]);
    if(!r.ok){ C.ok(false,tag+' Real spell effects, '+label+': the stage plays the slot',r); continue; }
    C.ok(Math.abs(r.rel-r.castReal)<0.002&&r.fx0>=r.rel-0.002,tag+' Real spell effects, '+label+': the plan releases at the fight\'s own cast time ('+r.castFight+' fight s / FX_RT '+r.fxRT+' = '+r.castReal+' s) and its first spell art is planned at '+r.fx0+' s, not before the release',
      {rel:r.rel,castReal:r.castReal,fx0:r.fx0,fx:r.fxKinds});
    C.ok(r.first!=null&&r.first>=r.fx0-0.001&&r.first<=r.fx0+0.15&&r.beforeMax<=30,tag+' Real spell effects, '+label+': the spell art shows on screen at '+r.first+' s (planned '+r.fx0+' s); before that, nothing of it ('+r.beforeN+' frames, at most '+r.beforeMax+' px)',
      {first:r.first,fx0:r.fx0,beforeMax:r.beforeMax,maxPixels:r.maxPixels});
    C.ok(r.edge===0&&r.maxPixels>100,tag+' Real spell effects, '+label+': no spell-art pixel touches the canvas edge in '+r.frames+' frames (biggest frame '+r.maxPixels+' px, box '+JSON.stringify(r.maxBox)+' in '+r.canvas+')',{edge:r.edge,edgeAt:r.edgeAt,box:r.maxBox,canvas:r.canvas});
  }
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.gold=100000; for(const k of Object.keys(HEROES)){ u.led.hero[k].stars=5; } });
  const s=await H.server(file); let pg=null;
  try{
    for(const [w,h,touch,tag] of [[1280,720,false,'1280x720'],[844,390,true,'844x390']]){
      pg=await H.game(s.port,{w,h,touch});
      try{ await stage(pg,tag,touch); }catch(e){ C.ok(false,tag+' preview stage part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      try{ await spells(pg,tag,touch); }catch(e){ C.ok(false,tag+' spell effects part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null;
    }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
