/* v905 (Phil 1 Oct: "fix all skill previews ... a nice background not just black ... center them ... it should show the hero,
   and the spell effect ... like 3 monster 2 allies for a small preview").
   A small battle on the hero's Skills tab: the hero and two allies on the left, three monsters on the right, a real arena
   behind them. Pick a skill and the hero plays that skill's own battle clip; when it releases, the spell's own art (the
   same FX2_DEF sheets the fight uses) flies, lands or forms where the spell does its work, and the monsters flinch when it
   hits. Heals and buffs land on the hero's side. Cosmetic only - nothing here touches the fight. */
(function(root){
  'use strict';
  const BG='/assets/img/miscellaneous/battlebg.jpg';   // the arena the fights use
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
      const bg=img(BG); if(bg){ const s=Math.max(W/bg.naturalWidth,H/bg.naturalHeight)*1.35, bw=bg.naturalWidth*s, bh=bg.naturalHeight*s; g.drawImage(bg,(W-bw)/2,(H-bh)*0.55,bw,bh); g.fillStyle='rgba(8,10,18,.18)'; g.fillRect(0,0,W,H); }
      else { const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,'#24324a'); gr.addColorStop(1,'#3b2f22'); g.fillStyle=gr; g.fillRect(0,0,W,H); }
      const sp=st.sp, clip=st.clip, t=(now-st.t0)/1000;
      const clipDur=clip?Math.min(2.4,clip.n/((clip.fps||12)*1.5)):0.8;
      const rel=st.idx===3?0.3:Math.min(clipDur,Math.max(0.2,sp.cast/1.5));
      const fx=fxDef(sp.gfx), pf=fxDef(sp.pfx);
      const travel=sp.shot?0.35:0;
      const fxDur=fx?Math.min(2.2,(fx.dur||1.6)/1.5):0.6;
      const period=Math.max(clipDur,rel+travel+fxDur)+0.9;
      const tt=t%period, hitT=rel+travel;
      // positions (centred group): heroes left, monsters right
      const base=H*0.84, uh=H*0.40;
      const hero={x:W*0.36,f:base,h:uh*1.05}, mates=[{x:W*0.19,f:base-H*0.13,h:uh*0.9},{x:W*0.23,f:base+H*0.1,h:uh*0.95}];
      const foes=[{x:W*0.62,f:base,h:uh},{x:W*0.77,f:base-H*0.13,h:uh*0.9},{x:W*0.81,f:base+H*0.1,h:uh*0.95}];
      const hitTargets=sp.mode==='single'?[foes[0]]:(sp.mode==='aoe'||sp.mode==='cone')?foes:[];
      const healed=sp.mode==='team'?[hero,...mates]:sp.mode==='self'?[hero]:[];
      const draw=[];
      mates.forEach((m,i)=>{ const c=st.mates[i]&&anim(st.mates[i]); if(c&&c.idle) draw.push({f:m.f,fn:()=>drawUnit(g,c.idle,Math.floor(t*(c.idle.fps||12))%c.idle.n,m.x,m.f,m.h,true,(healed.includes(m)&&tt>hitT&&tt<hitT+0.5)?'rgba(120,255,170,.28)':null)}); });
      { const an=anim(st.key); const casting=clip&&tt<clipDur; const c=casting?clip:(an&&an.idle); if(c){ const fr=casting?Math.floor(tt/clipDur*c.n):Math.floor(t*(c.fps||12))%c.n; draw.push({f:hero.f,fn:()=>drawUnit(g,c,fr,hero.x,hero.f,hero.h,true,(healed.includes(hero)&&tt>hitT&&tt<hitT+0.5)?'rgba(120,255,170,.28)':null)}); } }
      foes.forEach((m,i)=>{ const c=anim(FOES[i]); if(!c||!c.idle) return; const hit=hitTargets.includes(m)&&tt>hitT&&tt<hitT+0.45; const hc=hit&&c.hit?c.hit:c.idle;
        const fr=hit&&c.hit?Math.floor((tt-hitT)/0.45*c.hit.n):Math.floor(t*(c.idle.fps||12)+i*5)%c.idle.n;
        draw.push({f:m.f,fn:()=>drawUnit(g,hc,fr,m.x+(hit?5:0),m.f,m.h,false,hit?'rgba(255,90,60,.30)':null)}); });
      draw.sort((a,b)=>a.f-b.f).forEach(d=>d.fn());
      // the projectile, then the spell art where it lands
      if(sp.shot&&tt>rel&&tt<hitT){ const k=(tt-rel)/travel, x0=hero.x+W*0.04, y0=hero.f-hero.h*0.55, x1=foes[0].x, y1=foes[0].f-foes[0].h*0.5;
        if(pf){ const fr=Math.floor(k*pf.n*0.999); drawFx(g,pf,fr,x0+(x1-x0)*k,y0+(y1-y0)*k,H*0.32,false,Math.atan2(y1-y0,x1-x0)); }
        else { g.fillStyle='rgba(255,220,140,.9)'; g.beginPath(); g.arc(x0+(x1-x0)*k,y0+(y1-y0)*k,4,0,6.283); g.fill(); } }
      if(fx&&tt>=hitT&&tt<hitT+fxDur){ const fr=Math.floor((tt-hitT)/fxDur*fx.n);
        if(sp.mode==='single') drawFx(g,fx,fr,foes[0].x,foes[0].f,fx.upright?H*0.55:W*0.17,false,0);
        else if(sp.mode==='aoe') drawFx(g,fx,fr,(foes[0].x+foes[1].x+foes[2].x)/3,base,fx.upright?H*0.66:W*0.3,false,0);
        else if(sp.mode==='cone') drawFx(g,fx,fr,(hero.x+foes[0].x)/2,hero.f-hero.h*0.4,W*0.36,false,0);
        else if(sp.mode==='team') drawFx(g,fx,fr,(hero.x+mates[0].x+mates[1].x)/3,base,fx.upright?H*0.66:W*0.28,false,0);
        else drawFx(g,fx,fr,hero.x,hero.f,fx.upright?H*0.55:W*0.16,false,0); }
      else if(!fx&&tt>=hitT&&tt<hitT+0.7){ const k=(tt-hitT)/0.7, list=sp.mode==='team'?[hero,...mates]:sp.mode==='self'?[hero]:hitTargets;   // no art yet: a soft glow where it lands
        list.forEach(m=>{ const r=m.h*(0.35+0.4*k), gr=g.createRadialGradient(m.x,m.f-m.h*0.4,0,m.x,m.f-m.h*0.4,r);
          const col=(sp.mode==='team'||sp.mode==='self')?'120,255,170':'255,190,90'; gr.addColorStop(0,'rgba('+col+','+(0.55*(1-k))+')'); gr.addColorStop(1,'rgba('+col+',0)'); g.fillStyle=gr; g.beginPath(); g.arc(m.x,m.f-m.h*0.4,r,0,6.283); g.fill(); }); }
      requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
    cur=st; return st; }
  root.EmberSkillStage={mount,stop,spellOf};
})(window);
