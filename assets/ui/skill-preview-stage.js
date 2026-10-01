/* v905 (Phil 1 Oct: "fix all skill previews ... a nice background not just black ... center them ... it should show the hero,
   and the spell effect ... like 3 monster 2 allies for a small preview").
   A small battle on the hero's Skills tab: the hero and two allies on the left, three monsters on the right, a real arena
   behind them. Pick a skill and the hero plays that skill's own battle clip; when it releases, the spell's own art (the
   same FX2_DEF sheets the fight uses) flies, lands or forms where the spell does its work, and the monsters flinch when it
   hits. Heals and buffs land on the hero's side. Cosmetic only - nothing here touches the fight. */
(function(root){
  'use strict';
  const BG='/assets/img/battlefields/emberdraft/cinderforge.webp';   // v906 (Phil: "Dont use campaign map please. Use a battle art"): the Cinderforge arena
  const FOES=['boar warrior','boar shaman','boar warrior'];
  const MATES=['vael','nerisse','oakmir','lumi'];
  const ALLY_WORDS=/heal|hot|shield|ward|bless|regen|rally|spring|cleanse|haste|aura|buff|mend|font|duality|laststand|taunt|barrier|sanct|prayer|revive|rewind/i;
  const imgs={};
  function img(u){ if(!u) return null; let i=imgs[u]; if(!i){ i=new Image(); i.decoding='async'; i.src=u; imgs[u]=i; } return (i.complete&&i.naturalWidth)?i:null; }
  function anim(key){ try{ return BATTLE_ANIM[key]||null; }catch(_){ return null; } }
  function fxDef(k){ try{ return k&&FX2_DEF[k]?FX2_DEF[k]:null; }catch(_){ return null; } }
  // which battle clip a slot plays (same choice as the fight / ensureSkillPreview)
  function slotClip(key,idx){ const an=anim(key); if(!an) return null; const kit=(typeof KITS!=='undefined'&&KITS[key])||{};
    const slot=['ult','green','blue','passive'][idx], type=idx===0?(HERO_TYPES[key]&&HERO_TYPES[key].ability):idx===1?(kit.green&&kit.green.type):idx===2?(kit.blue&&kit.blue.type):null;
    if(an[slot]) return an[slot]; if(type&&an[type]) return an[type];
    try{ if(type&&ABIL_ANIM[type]&&an[ABIL_ANIM[type].st]) return an[ABIL_ANIM[type].st]; }catch(_){}
    return an.attack||an.idle||null; }
  // the spell as the fight sees it: its row, its art, where it lands
  function spellOf(key,idx){ const kit=(typeof KITS!=='undefined'&&KITS[key])||{}; let o={}, type='', gfx=null, pfx=null;
    if(idx===0){ type=(HERO_TYPES[key]&&HERO_TYPES[key].ability)||''; try{ o=Object.assign({},ULT_DEF[type]||{},(typeof HERO_ULT_ART!=='undefined'&&HERO_ULT_ART[key])||{}); }catch(_){}
      gfx=o.gfx||(fxDef(key+'_ult')?key+'_ult':null); pfx=o.pfx||null; }
    else if(idx===3){ gfx=fxDef(key+'_passive')?key+'_passive':null; o={gfxAt:'self'}; type='passive'; }
    else { const row=idx===1?kit.green:kit.blue; o=Object.assign({},row||{}); type=o.type||''; gfx=o.gfx||(fxDef(key+(idx===1?'_green':'_blue'))?key+(idx===1?'_green':'_blue'):null); pfx=o.pfx||null; }
    let mode='aoe'; let desc=''; try{ desc=String(skillDesc(key,idx)||''); }catch(_){}
    const selfish=/(himself|herself|itself|his own|her own)/i.test(desc)||type==='laststand';
    const teamish=/(heal|heals|allies|ally|team|shield)/i.test(desc)&&!/(enem|damage|strike|foe|stun)/i.test(desc);
    let aim=''; try{ if(idx===0&&typeof ultAimMode==='function') aim=ultAimMode(type); }catch(_){}
    if(idx===3||selfish||aim==='self') mode='self';
    else if(teamish||aim==='ally'||aim==='allyradius'||o.heal) mode='team';
    else if(o.gfxAt==='self') mode=ALLY_WORDS.test(type)?'team':'self';
    else if(fxDef(gfx)&&fxDef(gfx).cone) mode='cone';
    else if(o.deliver==='shot'||aim==='target'||(pfx&&!o.radius)) mode='single';
    const cast=(()=>{ try{ return castTimeFor({key,t:HERO_TYPES[key]},['ult','green','blue','passive'][idx]); }catch(_){ return idx===0?0.8:0.5; } })();
    return {mode,gfx,pfx,cast,shot:(o.deliver==='shot'||!!pfx)&&mode==='single'}; }
  function frameRect(c,i){ const cols=c.cols||c.n, f=Math.max(0,Math.min(c.n-1,i|0)); return [(f%cols)*c.fw,Math.floor(f/cols)*c.fh,c.fw,c.fh]; }
  // draw a battle-anim frame standing at (x, feet) with the figure scaled to height h, facing right or left
  function drawUnit(g,c,i,x,feet,h,faceRight,tint){ const im=img(c&&c.u); if(!im) return;
    const fig=c.figH||c.fh*0.8, s=h/fig, [sx,sy,sw,sh]=frameRect(c,i), cx=(c.cx!=null?c.cx:c.fw/2), fy=(c.feet!=null?c.feet:c.fh);
    const sourceRight=!c.flip, mirror=faceRight!==sourceRight;
    let src=im, ox=sx, oy=sy;
    if(tint){ const oc=tintCanvas(sw,sh), og=oc.getContext('2d'); og.clearRect(0,0,sw,sh); og.globalCompositeOperation='source-over'; og.drawImage(im,sx,sy,sw,sh,0,0,sw,sh);
      og.globalCompositeOperation='source-atop'; og.fillStyle=tint; og.fillRect(0,0,sw,sh); src=oc; ox=0; oy=0; }
    g.save(); g.translate(x,feet); if(mirror) g.scale(-1,1);
    g.drawImage(src,ox,oy,sw,sh,-cx*s,-fy*s,sw*s,sh*s);
    g.restore(); }
  let _tc=null; function tintCanvas(w,h){ if(!_tc) _tc=document.createElement('canvas'); if(_tc.width<w) _tc.width=w; if(_tc.height<h) _tc.height=h; return _tc; }
  function drawFx(g,d,i,x,y,size,flip,rot){ const im=img(d&&d.u); if(!im) return; const [sx,sy,sw,sh]=frameRect(d,i);
    g.save(); g.translate(x,y); if(rot) g.rotate(rot); if(flip) g.scale(-1,1);
    if(d.upright){ const an=d.upAnchor||[0.5,0], s=size/sh; g.drawImage(im,sx,sy,sw,sh,-an[0]*sw*s,-(1-an[1])*sh*s,sw*s,sh*s); }
    else if(d.disc){ const dk=d.disc, s=size/(sw*(dk.dw||1)), flat=(dk.dh||1)/(dk.dw||1)>0.6?0.45:1; g.scale(1,flat); g.drawImage(im,sx,sy,sw,sh,-sw*s/2,-(dk.cy||0.5)*sh*s,sw*s,sh*s); }
    else { const s=size/Math.max(sw,sh); g.drawImage(im,sx,sy,sw,sh,-sw*s/2,-sh*s/2,sw*s,sh*s); }
    g.restore(); }
  let cur=null;
  function stop(){ if(cur){ cur.dead=true; cur=null; } }
  function mount(canvas,key){ stop(); if(!canvas) return null;
    const st={canvas,key,idx:0,t0:performance.now(),dead:false};
    st.mates=MATES.filter(k=>k!==key&&anim(k)&&anim(k).idle).slice(0,2);
    st.play=(idx)=>{ st.idx=+idx||0; st.sp=spellOf(key,st.idx); st.clip=slotClip(key,st.idx); st.t0=performance.now(); };
    st.play(0);
    function loop(now){ if(st.dead||!canvas.isConnected){ st.dead=true; return; }
      const dpr=Math.min(2,root.devicePixelRatio||1), W=canvas.clientWidth||320, H=canvas.clientHeight||190;
      if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){ canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); }
      const g=canvas.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
      // arena - cover-fit, centred on the arena floor
      const bg=img(BG); if(bg){ const nw=bg.naturalWidth, nh=bg.naturalHeight;   // the arena floor inside its walls, cover-fit, centre line in the middle
        let sx=nw*0.14, sy=nh*0.12, sw=nw*0.72, sh=nh*0.62;   /* v906 (Phil: "zoom them in a bit") */ const want=W/H; if(sw/sh>want){ const nsw=sh*want; sx+=(sw-nsw)/2; sw=nsw; } else { const nsh=sw/want; sy+=(sh-nsh)/2; sh=nsh; }
        g.drawImage(bg,sx,sy,sw,sh,0,0,W,H); }
      else { const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,'#24324a'); gr.addColorStop(1,'#3b2f22'); g.fillStyle=gr; g.fillRect(0,0,W,H); }
      /* v907 (Phil 1 Oct: "Just do the hero by itself doing the spell animation then the spell FX next to it timed perfectly to go off
         over a 6 second clip" / "Any buffs go over their own head"): one hero, one spell, a 6 s loop. The clip plays at its own speed;
         the spell's art goes off at the moment the clip releases it (the same cast time the fight uses) and plays out inside the 6 s -
         beside the hero for an attack, over the hero's head for a buff, heal or passive. */
      const sp=st.sp, clip=st.clip, t=(now-st.t0)/1000, LOOP=6;
      const tt=t%LOOP, fx=fxDef(sp.gfx), pf=fxDef(sp.pfx);
      const buff=(sp.mode==='self'||sp.mode==='team');
      const clipDur=clip?Math.min(4,clip.n/(clip.fps||12)):1;
      const rel=st.idx===3?0.4:Math.min(clipDur,Math.max(0.2,sp.cast||0.5));
      const travel=(!buff&&sp.shot&&pf)?0.3:0, fxStart=rel+travel;
      const fxDur=fx?Math.max(0.6,Math.min(fx.dur||1.6,LOOP-fxStart-0.3)):0;
      const base=H*0.94, hero=buff?{x:W*0.5,f:base,h:H*0.52}:{x:W*0.3,f:H*0.92,h:H*0.66};
      const spot=buff?{x:hero.x,f:base-hero.h*1.02}:{x:W*0.7,f:H*0.8};   // a buff sits just above the head
      const aboveSize=H*0.3;
      const drawSpell=()=>{
        if(travel&&tt>=rel&&tt<fxStart){ const k=(tt-rel)/travel, x0=hero.x+W*0.06, y0=hero.f-hero.h*0.55, x1=spot.x, y1=spot.f-hero.h*0.45;
          drawFx(g,pf,Math.floor(k*pf.n*0.999),x0+(x1-x0)*k,y0+(y1-y0)*k,H*0.45,false,Math.atan2(y1-y0,x1-x0)); }
        if(fx&&tt>=fxStart&&tt<fxStart+fxDur){ const fr=Math.floor((tt-fxStart)/fxDur*fx.n);
          if(buff){ const s=aboveSize, im=img(fx.u); if(im){ const r=frameRect(fx,fr), sc=s/Math.max(r[2],r[3]); g.drawImage(im,r[0],r[1],r[2],r[3],spot.x-r[2]*sc/2,spot.f-r[3]*sc,r[2]*sc,r[3]*sc); } }
          else drawFx(g,fx,fr,spot.x,(fx.upright||fx.disc)?spot.f:spot.f-hero.h*0.42,fx.upright?H*0.86:(fx.disc?W*0.42:H*0.7),false,0); }   // a plain plate sits at chest height
        else if(!fx&&tt>=fxStart&&tt<fxStart+0.9){ const k=(tt-fxStart)/0.9, r=H*(0.1+0.2*k), cy=buff?spot.f-aboveSize*0.5:spot.f-hero.h*0.4, gr=g.createRadialGradient(spot.x,cy,0,spot.x,cy,r);
          const col=buff?'140,255,180':'255,215,140'; gr.addColorStop(0,'rgba('+col+','+(0.6*(1-k))+')'); gr.addColorStop(1,'rgba('+col+',0)'); g.fillStyle=gr; g.beginPath(); g.arc(spot.x,cy,r,0,6.283); g.fill(); } };
      if(!buff) drawSpell();   // an attack's art is under the hero's feet line; a buff is drawn over the head, after the hero
      { const an=anim(st.key); const casting=clip&&tt<clipDur; const c=casting?clip:(an&&an.idle); if(c){ const fr=casting?Math.floor(tt/clipDur*c.n):Math.floor(t*(c.fps||12))%c.n; drawUnit(g,c,fr,hero.x,hero.f,hero.h,true,null); } }
      if(buff) drawSpell();
      requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
    cur=st; return st; }
  root.EmberSkillStage={mount,stop,spellOf};
})(window);
