/* v1164 SKILL PREVIEW STAGE (Phil 16 Oct 2026: "update all the skill previews with the new animations, skill fx and also the sound it
   makes" / "With the real animations"). The hero on the Cinderforge arena (v906) plays ONE slot of skillPreviewPlan (emberweave-heroes.html):
   the fight's own clip(s) cell by cell at their fps, the slot's spell art from the fight's own FX2_DEF sheets at the fight's moments and
   places, and - on a TAP only - the fight's own sounds through sfxPlay (the FX channel: Settings FX on/off + volume and the master mute
   apply; a swing at SFX_ATK_GAIN). One preview sound at a time; a new slot stops the last. The loop is at least 6 s (v907) and idles on
   the fight's idle clip between plays. Every sheet is the file this device loads in a fight (artFile, as _loadClip / fx2Tex); only the
   open hero's sheets are held, and they (and any hero sound it decoded) are let go when the panel closes or another hero opens.
   RENDER ONLY - no unit, no battle state, no RNG, no server. World units are the fight's (wx: field x SC); the camera's 50 degree tilt
   squashes a ground plate to SQ of its depth and a world-Y lift to CY on screen, a billboard is drawn upright at full size. */
(function(root){
  'use strict';
  const BG='/assets/img/battlefields/emberdraft/cinderforge.webp';
  const SQ=0.766, CY=0.643, LOOP_MIN=6, CAP_H=20;   // sin / cos of the battle camera's 50 deg elevation (camera (0,20.5,16.5) -> (0,0.8,0))
  let cur=null;
  /* ---- images: the open hero's only ---- */
  function imgOf(st,u){ if(!u) return null; let i=st.imgs[u]; if(!i){ i=new Image(); i.decoding='async'; i.src=u; st.imgs[u]=i; } return (i.complete&&i.naturalWidth)?i:null; }
  function releaseImgs(st){ for(const u in st.imgs){ try{ st.imgs[u].src=''; }catch(_){} } st.imgs={}; }
  function fileOf(A,fx){ let F=null; try{ F=(!fx&&typeof _keepsImage==='function'&&_keepsImage(A))?null:artFile(A.u); }catch(_){}
    const c=F?F.c:(A.cols||A.n), r=F?F.r:(A.rows||Math.ceil(A.n/(A.cols||A.n))||1);
    return {u:F?F.u:A.u, c, r, cw:F?F.W/c:A.fw, ch:F?F.H/r:A.fh, tc:(!fx&&F)?F.tc:null}; }
  function cellSrc(F,fr){ return [(fr%F.c)*F.cw, Math.floor(fr/F.c)*F.ch, F.cw, F.ch]; }
  /* ---- the hero: syncMesh's figH-normalised quad, anchored at (cx + ax[fr], feet), per-frame fs, mirrored with the facing ---- */
  function heroGeom(A,fr,h){ const fs=(A.fs&&A.fs.length)?(A.fs[Math.min(fr,A.fs.length-1)]||1):1;
    if(A.figH){ const qh=h*(A.fh/A.figH)*fs, wpp=qh/A.fh; let cxp=(A.cx!=null?A.cx:A.fw*0.5); if(A.ax&&A.ax.length) cxp+=A.ax[Math.min(fr,A.ax.length-1)]||0;
      return {wpp, cxp, feet:A.feet}; }
    const sc=A.sc||1, wpp=h*sc/A.fh; return {wpp, cxp:A.fw*0.5, feet:A.fh}; }
  function drawHero(g,st,A,fr,V){ const F=fileOf(A,false), im=imgOf(st,F.u); if(!im) return null; const G=heroGeom(A,fr,V.h), s=V.s;
    const mirror=!!A.flip;   // the preview faces right: mirror when the sheet faces left (sourceRight = !A.flip)
    const tc=F.tc||[0,0,1,1], [sx,sy,sw,sh]=cellSrc(F,fr);
    g.save(); g.translate(V.ox,V.oy); if(mirror) g.scale(-1,1);
    const k=G.wpp*s; g.drawImage(im,sx,sy,sw,sh,(tc[0]*A.fw-G.cxp)*k,(tc[1]*A.fh-G.feet)*k,tc[2]*A.fw*k,tc[3]*A.fh*k); g.restore();
    return {G,mirror}; }
  /* ---- an FX2 cell drawn with its anchor at (x,y) screen px ---- */
  function fxDraw(g,st,d,fr,x,y,w,h,ax,ayTop,o){ o=o||{}; const F=fileOf(d,true), im=imgOf(st,F.u); if(!im||w<=0||h<=0) return; const n=d.n||1;
    fr=Math.max(0,Math.min(n-1,fr|0)); const [sx,sy,sw,sh]=cellSrc(F,fr);
    g.save(); g.globalAlpha=Math.max(0,Math.min(1,o.a==null?1:o.a)); if(o.add) g.globalCompositeOperation='lighter';
    g.translate(x,y); if(o.rot) g.rotate(o.rot); if(o.flip) g.scale(-1,1);
    g.drawImage(im,sx,sy,sw,sh,-ax*w,-ayTop*h,w,h); g.restore(); }
  /* ---- the scene: hero at x 0, the enemy the spell is cast at to his right (its body is not drawn - the art lands where it stands) ---- */
  function sceneOf(st){ const hk=st.key, h=(typeof roleBattleH==='function'?roleBattleH(hk):3.9)*((typeof HERO_BATTLE_SCALE!=='undefined'&&HERO_BATTLE_SCALE[hk])||1);
    const d=(typeof skillPreviewTargetDist==='function')?skillPreviewTargetDist(hk):2.2*METER;
    return {h, th:h, xt:Math.max(d*SC,1.5*h)}; }
  /* the world-space box an FX entry covers at full size (for the fit), and its anchor */
  function fxBox(e,S){ const d=e.d, R3=(e.R||2.4*METER)*SC, h=S.h, th=S.th, X=(e.at==='target')?S.xt:0;
    switch(e.kind){
      case 'disc': case 'disc22': case 'undertow': { const w=2*R3/d.disc.dw, hh=2*R3/d.disc.dh*SQ; return [X-w/2,-hh/2,X+w/2,hh/2]; }
      case 'flat': { const w=R3*2*1.12*FX_SIZE, hh=w*d.fh/d.fw*SQ; return [X-w/2,-hh/2,X+w/2,hh/2]; }
      case 'cone': { const w=R3*1.15, hh=w*d.fh/d.fw*SQ; return [0,-hh/2,w,hh/2]; }
      case 'up': { const g=upGeom(e,S); return [g.x-g.ax*g.w,g.y,g.x+(1-g.ax)*g.w,g.y+g.h]; }
      case 'above': case 'feet': { const g=upGeom(e,S); return [g.x-g.ax*g.w,g.y,g.x+(1-g.ax)*g.w,g.y+g.h]; }
      case 'proj': return [0,0,S.xt,1.2*CY+e.scale];
      case 'beam': return [h*0.25,1.55*CY-0.6*h,S.xt,1.55*CY+0.6*h];
      case 'drop': return [S.xt-e.scale,0,S.xt+e.scale,Math.min(9*CY,2.2*h)];
      case 'ruyi': { const H=d.len*th*d.fh/d.staffPx; return [S.xt-0.5*H*d.fw/d.fh,d.head*th-d.anchor[1]*H,S.xt+0.5*H*d.fw/d.fh,d.head*th+(1-d.anchor[1])*H]; }
      case 'punct': { const H=d.h*3.9/d.slit, W=H*d.fw/d.fh; return [S.xt-W/2,0,S.xt+W/2,H]; }
      case 'tempest': { const r=(e.R||10*METER)*SC, W=2*0.4*r*Math.tan(22.5*Math.PI/180)*d.fw/d.xPx*(d.xMul||1), H=W*d.fh/d.fw; return [0.4*r-W/2,0.5*h-H/2,0.4*r+W/2,0.5*h+H/2]; }
      case 'fx16up': case 'fx16puff': { const H=d.size*h, W=H*d.fw/d.fh; return [X-d.anchor[0]*W,-d.anchor[1]*H,X+(1-d.anchor[0])*W,(1-d.anchor[1])*H]; }   /* v1171 Vael / Deepcleft: upright, anchor on the ground point */
      case 'fx16over': { const H=d.size*S.th, W=H*d.fw/d.fh, X=S.xt, cy=(d.mid||0.5)*S.th; return [X-W/2,cy-H/2,X+W/2,cy+H/2]; }   /* v1174 Mirelle's Bouquet: centred on the target's middle */
      case 'fx16claws': { const w=d.len*h/d.lineW, hh=w*d.fh/d.fw*SQ, px=30*SC*d.reach; return [px-d.anchor[0]*w,-(1-d.anchor[1])*hh,px+(1-d.anchor[0])*w,d.anchor[1]*hh]; }
      case 'mantle': case 'shell': { const H=(e.kind==='shell')?d.size*h*d.fh/(d.fh-16):d.size*h, W=H*d.fw/d.fh; return [-W/2,0.5*h-H/2,W/2,0.5*h+H/2]; }
      case 'crescent': { const H=d.size*h, W=H*d.fw/d.fh; return [-W/2,0.5*h-H/2,S.xt+W/2,0.5*h+H/2]; }
      case 'bell': { const H=0.75*3.9*d.fh/d.bellPx; return [S.xt-0.5*H*d.fw/d.fh,1.05*3.9*CY-d.anchor[1]*H,S.xt+0.5*H*d.fw/d.fh,1.05*3.9*CY+(1-d.anchor[1])*H]; }
      case 'reap': { const H=d.size*h*d.fh/d.spanPx, W=H*d.fw/d.fh; return [0,0.45*h*CY-H/2,R3+W/2,0.45*h*CY+H/2]; }
      default: return null; } }
  /* the v468 upright plate (and the v498 / v1141 badges it becomes over a head / under the feet) */
  function upGeom(e,S){ let d=e.d; const th=(e.at==='target')?S.th:S.h, X=(e.at==='target')?S.xt:(e.at==='muzzle'?S.h*0.25:(e.at==='front'?S.h*0.2:0));
    if(e.kind==='feet') d=Object.assign({},d,{upright:true,upAbove:false,upMetric:false,upSize:FEET_BADGE_H*0.95*Math.min(1,d.fw/d.fh),upExtent:0.95,upAnchor:[0.5,0.5],upPalm:null});
    if(e.kind==='above'&&!d.upAbove) d=Object.assign({},d,{upright:true,upAbove:true,upAboveM:0.06,upSize:(e.badge||0.8),upExtent:0.95,upAnchor:null,upPalm:null});
    const R3=(e.R||2.4*METER)*SC, Sz=d.upMetric?((R3*2)/(d.upExtent||0.85)):(th*(d.upSize||1.2)/(d.upExtent||0.85));
    const ax=(d.upAnchor?d.upAnchor[0]:0.5), ay=(d.upAnchor?d.upAnchor[1]:(d.upAbove?0.0:(d.upPalm!=null?d.upPalm:0.28)));
    let y; if(e.atH!=null) y=(0.05+th*e.atH)*CY; else if(e.at==='muzzle') y=1.2*CY; else if(d.upAbove) y=th*(1+(d.upAboveM||0)); else y=(d.upAnchor?0.05:(0.05+th*0.5))*CY;
    const w=Sz, hh=Sz*(d.fh/d.fw); return {d,x:X,y:y-ay*hh,w,h:hh,ax,ay}; }
  /* fit: the hero and the enemy spot set the scale; an effect that would leave the box is shrunk about its own centre and slid back in */
  function fitView(st,W,H){ const S=sceneOf(st), P=st.plan; const usesT=P&&P.fx.some(e=>e.at==='target'||/proj|ruyi|punct|crescent|hook|slash|spark|bell|wound/.test(e.kind));
    const span=usesT?(S.xt+1.3*S.h):(1.3*S.h), s=Math.min(W*0.9/span,(H-CAP_H)*0.6/S.h);
    const ox=usesT?(W/2-S.xt*s/2):(W/2), oy=H-Math.max(10,(H-CAP_H)*0.12);
    const V={s,ox,oy,h:S.h,th:S.th,xt:S.xt,S,fit:new Map()};
    if(P) P.fx.forEach(e=>{ const b=fxBox(e,S); if(!b) return; const x0=ox+b[0]*s, x1=ox+b[2]*s, y0=oy-b[3]*s, y1=oy-b[1]*s;
      const bw=x1-x0, bh=y1-y0, aw=W-8, ah=H-CAP_H-6; let k=Math.min(1,aw/Math.max(1,bw),ah/Math.max(1,bh));
      const cx=(x0+x1)/2, cy=(y0+y1)/2, nx0=cx-bw*k/2, ny0=cy-bh*k/2; let dx=0, dy=0;
      if(nx0<4) dx=4-nx0; if(nx0+bw*k>W-4) dx=(W-4)-(nx0+bw*k); if(ny0<CAP_H) dy=CAP_H-ny0; if(ny0+bh*k>H-2) dy=(H-2)-(ny0+bh*k);
      V.fit.set(e,{k,cx,cy,dx,dy}); });
    return V; }
  function withFit(g,V,e,fn){ const f=V.fit.get(e); if(!f||(f.k>=0.999&&!f.dx&&!f.dy)){ fn(); return; }
    g.save(); g.translate(f.cx+f.dx,f.cy+f.dy); g.scale(f.k,f.k); g.translate(-f.cx,-f.cy); fn(); g.restore(); }
  /* ---- one FX entry at preview time t (real s) ---- */
  function drawFx(g,st,V,e,t,hero,layer){ const d=e.d, s=V.s, ox=V.ox, oy=V.oy, h=V.h, th=V.th, X=x=>ox+x*s, Y=y=>oy-y*s;
    const lt=t-e.t0; if(lt<0) return; const tb=lt*FX_RT, n=d.n||1, clipR=d.dur||1;   // tb: fight seconds since it spawned
    const ground=(e.kind==='disc'||e.kind==='flat'||e.kind==='cone'||e.kind==='disc22'||e.kind==='undertow'||e.kind==='fx16claws');
    const front=(e.kind==='above'||e.kind==='proj'||e.kind==='drop'||e.kind==='beam'||e.kind==='tip'||e.kind==='chop'||e.kind==='spark'||e.kind==='bell'||e.kind==='crescent'||e.kind==='wound'||e.kind==='slash'||e.kind==='ruyi'||e.kind==='reap'||e.kind==='tempest'||e.kind==='shell'||e.kind==='mantle'||e.kind==='punct'||e.kind==='hook'||e.kind==='fx16over');
    if(layer==='ground'&&!ground) return; if(layer==='back'&&(ground||front)) return; if(layer==='front'&&!front) return;
    const R3=(e.R||2.4*METER)*SC, AX=(e.at==='target')?V.xt:0;
    withFit(g,V,e,()=>{ switch(e.kind){
      case 'disc': case 'flat': case 'cone': case 'up': case 'above': case 'feet': {   // updateGroundFx: the cycle loops for its life (hold: freezes), fade in 0.12 / out 0.18 fight s
        const life=e.life||1.6; if(tb>=life) return; let fr=Math.floor(tb/d.dur*n); fr=d.hold?Math.min(n-1,fr):((fr%n)+n)%n;
        const a=Math.min(1,tb/0.12)*Math.min(1,(life-tb)/0.18), mvX=e.mv?(e.mv.x0+e.mv.v*Math.min(tb,e.mv.tt))*SC:0;   // a travelling plate follows its hazard
        if(e.kind==='disc'){ const w=2*R3/d.disc.dw, hh=2*R3/d.disc.dh; fxDraw(g,st,d,fr,X(AX+mvX),Y(0),w*s,hh*SQ*s,(d.disc.cx!=null?d.disc.cx:0.5),d.disc.cy,{a}); }
        else if(e.kind==='flat'){ const w=R3*2*1.12*FX_SIZE, hh=w*d.fh/d.fw; fxDraw(g,st,d,fr,X(AX+mvX),Y(0),w*s,hh*SQ*s,0.5,0.5,{a}); }
        else if(e.kind==='cone'){ const w=R3*1.15, hh=w*d.fh/d.fw, foot=(d.coneFoot!=null?1-2*d.coneFoot:0.9); fxDraw(g,st,d,fr,X(w*0.5*foot),Y(0),w*s,hh*SQ*s,0.5,0.5,{a}); }
        else { const G=upGeom(e,V.S); fxDraw(g,st,G.d,fr,X(G.x+mvX),Y(G.y+G.h),G.w*s,G.h*s,G.ax,0,{a}); }
        return; }
      case 'proj': { const D=e.dur||0.45; if(lt>D) return; const k=lt/D, fr=Math.floor(tb/(d.dur||1)*n)%n, H=e.scale||2.6, y=1.2*CY;
        fxDraw(g,st,d,fr,X(h*0.25+(V.xt-h*0.25)*k),Y(y),H*d.fw/d.fh*s,H*s,0.5,0.5); return; }
      case 'beam': { const tot=(e.ext||0.45)+(e.ret||0.3); if(tb>=tot) return; let grow=tb<=e.ext?Math.pow(tb/e.ext,0.85):1-(tb-e.ext)/e.ret; grow=Math.max(0.04,grow);   // updateBeamFx
        const fr=Math.floor(tb/d.dur*n)%n, x0=h*0.25, L=(V.xt-x0)*grow, W=L*d.fw/Math.max(1,(d.lead[0]-d.apex[0])), H=W*d.fh/d.fw;
        fxDraw(g,st,d,fr,X(x0),Y(1.55*CY),W*s,H*s,d.apex[0]/d.fw,d.apex[1]/d.fh); return; }
      case 'drop': { const D=e.dur||0.8; if(lt>D) return; const k=lt/D, fr=Math.floor(tb/(d.dur||1)*n)%n, H=e.scale||3.0;   // deliverLaunch 'land': it falls from 9 up onto the spot
        fxDraw(g,st,d,fr,X(V.xt),Y(9*CY*(1-k)),H*d.fw/d.fh*s,H*s,0.5,0.5); return; }
      case 'tip': { if(!hero||!e.trackA) return; const A=e.trackA, c=hero.clipCell, lastK=e._k|0; let k;
        if(hero.st===e.st&&hero.live){ k=c; e._k=c; e._kt=t; } else { if(e._kt==null) return; k=lastK+Math.floor((t-e._kt)*24); }
        if(k>=n) return; const G=heroGeom(A,Math.min(A.n-1,c),h), wpp=G.wpp, Wf=d.heroPx*wpp, tr=e.track[Math.min(c,e.track.length-1)], mir=!!A.flip;
        const cxp=G.cxp; let dx=(tr[0]-cxp)*wpp; const dy=(A.feet-tr[1])*wpp; let th2=tr[2]*Math.PI/180; if(mir){ dx=-dx; th2=-th2; }   // updateTipFx: the tip rides the drawn cell, mirrored with the facing
        fxDraw(g,st,d,k,X(dx),Y(dy),Wf*s,Wf*s,d.tip[0],1-d.tip[1],{rot:-th2,flip:mir}); return; }
      case 'chop': { if(!hero||!e.trackA) return; const A=e.trackA, F=d.fit; let cell;
        if(e._hitAt==null){ const a=(hero.st===e.st&&hero.live)?hero.acc:(lt*24), f=d.sync.f, c=d.sync.c; if(a<f[0]) return;
          if(a>=f[f.length-1]){ e._hitAt=t; cell=d.hit; } else { let j=0; while(a>=f[j+1]) j++; cell=Math.floor(c[j]+(c[j+1]-c[j])*(a-f[j])/(f[j+1]-f[j])); } }
        else cell=d.hit+Math.floor((t-e._hitAt)*24);
        if(cell>=n) return; const G=heroGeom(A,Math.min(A.n-1,hero.clipCell),h), w=G.wpp, mir=!!A.flip, sx=mir?-1:1;   // _fx22ChopAxe: k x the cell, turned rot, centred cc hero px off his anchor
        fxDraw(g,st,d,cell,X(sx*F.cc[0]*w),Y(-F.cc[1]*w),F.k*d.fw*w*s,F.k*d.fh*w*s,0.5,0.5,{rot:sx*F.rot*Math.PI/180,flip:F.paint?mir:!mir}); return; }
      case 'ruyi': { const ob=(e.tb||0)+tb, clip=d.dur*FX_RT; if(ob<0) return; const fr=Math.floor(ob/clip*n); if(fr>=n) return; const H=d.len*th*d.fh/d.staffPx;
        fxDraw(g,st,d,fr,X(V.xt),Y(d.head*th),H*d.fw/d.fh*s,H*s,d.anchor[0],1-d.anchor[1]); return; }
      case 'punct': { const c=tb/FX_RT, en=(e.endT||2.35)/FX_RT, f=d.fps, a0=d.holdA/f, tc=Math.max(a0,en-(d.shut-d.close)/f); let fr;
        if(c<a0) fr=Math.floor(c*f); else if(c<tc) fr=Math.min(d.holdB,d.holdA+Math.floor((c-a0)/Math.max(1e-3,tc-a0)*(d.holdB-d.holdA+1))); else fr=d.close+Math.floor((c-tc)*f);
        if(fr>=n) return; const H=d.h*3.9/d.slit; fxDraw(g,st,d,fr,X(V.xt),Y(0.05*CY),H*d.fw/d.fh*s,H*s,0.5,1-d.foot); return; }
      case 'disc22': { const ob=(e.tb||0)+tb, fr=Math.floor(ob/(d.dur*FX_RT)*n); if(ob<0||fr>=n) return; const clip=d.dur*FX_RT, a=e.fade?Math.max(0,Math.min(1,(clip-ob)/e.fade)):1;
        const w=2*R3/d.disc.dw, hh=2*R3/d.disc.dh; fxDraw(g,st,d,fr,X(AX),Y(0),w*s,hh*SQ*s,d.disc.cx!=null?d.disc.cx:0.5,d.disc.cy,{a}); return; }
      case 'undertow': { const tc=e.tc||0.98, fr=tb<tc?Math.floor(tb/tc*d.crash):d.crash+Math.floor((tb-tc)/FX_RT*d.fps2); if(fr>=n) return;
        const w=2*R3/d.disc.dw, hh=2*R3/d.disc.dh; fxDraw(g,st,d,fr,X(AX),Y(0),w*s,hh*SQ*s,d.disc.cx!=null?d.disc.cx:0.5,d.disc.cy); return; }
      case 'shell': { const c=tb/FX_RT, tot=(e.life||3)/FX_RT; if(c>=tot) return; const nOut=n-d.outC0, a0=d.inN/d.fps, z=tot-nOut/d.fps; let fr;
        if(z<=a0) fr=Math.min(n-1,Math.floor(c/tot*n)); else if(c<a0) fr=Math.floor(c*d.fps); else if(c>=z) fr=Math.min(n-1,d.outC0+Math.floor((c-z)*d.fps));
        else { const sp=d.holdB-d.holdA, q=Math.floor((c-a0)*d.fps)%(2*sp); fr=d.holdA+(q<=sp?q:2*sp-q); }
        const H=d.size*h*d.fh/(d.fh-16); fxDraw(g,st,d,fr,X(0),Y(0.5*h),H*d.fw/d.fh*s,H*s,0.5,0.5); return; }
      case 'tempest': { const clip=d.dur*FX_RT, fr=Math.floor(tb/clip*n); if(fr>=n) return; const r=(e.R||10*METER)*SC, W=2*0.4*r*Math.tan(22.5*Math.PI/180)*d.fw/d.xPx*(d.xMul||1);
        fxDraw(g,st,d,fr,X(0.4*r),Y(0.5*h),W*s,W*d.fh/d.fw*s,0.5,0.5,{a:e.fade?Math.max(0,Math.min(1,(clip-tb)/e.fade)):1}); return; }
      case 'fx16up': { const life=e.life||5; if(tb>=life) return; let fr, a=1;   /* v1171 _fx22VaelTick: Bloodthirst fitted to the buff, Last Stand slam / stretched hold / faded end */
        if(e.vk==='vblood'){ fr=Math.floor(tb/life*n); a=Math.min(1,(life-tb)/(d.fade||0.3)); }
        else { const F0=d.hold[0], F1=d.hold[1], tA=F0/24*FX_RT, tC=life-(2*(n-1)-F1)/24*FX_RT; let F;
          if(tC<=tA) F=tb/life*2*(n-1); else if(tb<tA) F=lt*24; else if(tb<tC) F=F0+(tb-tA)/(tC-tA)*(F1-F0); else { F=F1+(tb-tC)/FX_RT*24; a=Math.max(0,1-(F-F1)/d.fade); }
          fr=Math.floor(F/2); }
        const H=d.size*h, W=H*d.fw/d.fh; fxDraw(g,st,d,Math.max(0,Math.min(n-1,fr)),X(0),Y(0),W*s,H*s,d.anchor[0],1-d.anchor[1],{a}); return; }
      case 'fx16over': { const L=e.real||6; if(lt>=L) return; const fr=Math.min(n-1,Math.floor(lt*(d.fps2||12))), H=d.size*th, W=H*d.fw/d.fh;   /* v1174: real time, once; the target is on her right - as painted */
        fxDraw(g,st,d,fr,X(V.xt),Y((d.mid||0.5)*th),W*s,H*s,d.anchor[0],1-d.anchor[1]); return; }
      case 'fx16puff': case 'fx16claws': { const L=e.real||5; if(lt>=L) return; const fr=Math.min(n-1,Math.floor(lt*(d.fps2||12))), a=d.fadeR?Math.max(0,Math.min(1,(L-lt)/d.fadeR)):1;   /* v1171 Deepcleft: real time, once */
        if(e.kind==='fx16puff'){ const H=d.size*h, W=H*d.fw/d.fh; fxDraw(g,st,d,fr,X(AX),Y(0),W*s,H*s,d.anchor[0],1-d.anchor[1],{a}); }
        else { const w=d.len*h/d.lineW, hh=w*d.fh/d.fw, px=30*SC*d.reach; fxDraw(g,st,d,fr,X(px),Y(0),w*s,hh*SQ*s,d.anchor[0],d.anchor[1],{a}); }
        return; }
      case 'mantle': { const life=e.life||2.4, fr=Math.floor(tb/life*n); if(fr>=n) return; const H=d.size*h; fxDraw(g,st,d,fr,X(0),Y(0.5*h),H*d.fw/d.fh*s,H*s,0.5,0.5); return; }
      case 'crescent': { const clip=d.dur*FX_RT, fr=Math.floor(tb/clip*n); if(fr>=n) return; const H=d.size*h, W=H*d.fw/d.fh, k=Math.min(1,tb/d.fly), q=k*k*(3-2*k);
        fxDraw(g,st,d,fr,X(V.xt*q),Y(0.5*h+(0.5*th-0.5*h)*q),W*s,H*s,0.5,0.5,{a:Math.max(0,Math.min(1,(clip-tb)/d.fade))}); return; }
      case 'bell': { const clip=d.dur*FX_RT; if(tb>=clip) return; const fr=Math.floor(tb/clip*n), H=0.75*3.9*d.fh/d.bellPx;
        fxDraw(g,st,d,fr,X(V.xt),Y(1.05*3.9*CY),H*d.fw/d.fh*s,H*s,d.anchor[0],1-d.anchor[1],{a:Math.max(0,Math.min(1,(clip-tb)/(e.fade||0.25)))}); return; }
      case 'wound': { const life=e.life||6, clip=d.dur*FX_RT; if(tb>=life) return; const fr=Math.min(n-1,Math.floor(tb/clip*n)), H=0.45*th*d.fh/d.woundPx;
        fxDraw(g,st,d,fr,X(V.xt),Y(0.55*th*CY),H*d.fw/d.fh*s,H*s,d.woundC[0],1-d.woundC[1],{a:Math.max(0,Math.min(1,(life-tb)/(e.fade||0.3)))}); return; }
      case 'reap': { const clip=d.dur*FX_RT, fr=Math.floor(tb/clip*n); if(fr>=n) return; const H=d.size*h*d.fh/d.spanPx, W=H*d.fw/d.fh;
        const q=Math.min(1,(tb/clip)*n/d.peak), f=d.f0+(1-d.f0)*q*q*(3-2*q), fx=R3*f-((d.front[fr]/d.fw)-0.5)*W;
        fxDraw(g,st,d,fr,X(fx),Y(0.45*h*CY),W*s,H*s,0.5,0.5,{a:Math.max(0,Math.min(1,(clip-tb)/(e.fade||0.3)))}); return; }
      case 'hook': { const clip=d.dur*FX_RT; if(tb>=clip) return; const fr=Math.floor(tb/clip*n), L=V.xt, Wq=L/(d.u1-d.u0), sx=Wq/d.fw, b=0.45*th/d.hookPx, sy=Math.max(0.5*b,Math.min(b,sx)), Hq=sy*d.fh;
        fxDraw(g,st,d,fr,X((0.5-d.u0)*Wq),Y(0.5*h*CY+(0.5-d.vRope)*Hq),Wq*s,Hq*s,0.5,0.5); return; }
      case 'slash': { const clip=d.dur*FX_RT; if(tb>=clip) return; const fr=Math.floor(tb/clip*n); fxDraw(g,st,d,fr,X(V.xt),Y(0.5*th*CY),0.9*th*d.fw/d.fh*s,0.9*th*s,0.5,0.5); return; }
      case 'spark': { const clip=d.dur*FX_RT; if(tb>=clip) return; const fr=Math.floor(tb/clip*n), H=d.h||1.6; fxDraw(g,st,d,fr,X(V.xt),Y(1.2*CY),H*d.fw/d.fh*s,H*s,0.5,0.5,{add:true}); return; }
    } }); }
  /* ---- sound: on a tap, the plan's files through sfxPlay, peaks on the preview's own clock ---- */
  function sndStop(st){ (st.srcs||[]).forEach(s=>{ try{ s.stop(); }catch(_){} }); st.srcs=[]; st.sndTok=(st.sndTok|0)+1; }
  function sndOk(){ try{ return !!(SND.ctx&&SND.cfg.fx.on&&sndCan()&&!window._p2guard); }catch(_){ return false; } }
  function sndGo(st){ sndStop(st); const P=st.plan; if(!P||!P.snd.length||!sndOk()) return false; const tok=st.sndTok, files=[];
    P.snd.forEach(x=>{ const F=SFX_DATA.files[x.name]; if(F&&files.indexOf(F[0])<0) files.push(F[0]); });
    files.forEach(f=>{ if(!(f in SND.buf)&&st.ownBuf.indexOf(f)<0) st.ownBuf.push(f); });
    const wait=files.map(f=>(SND.buf[f]?Promise.resolve(SND.buf[f]):(sndLoad(f)||Promise.resolve(SND.buf[f]||null))));
    const go=()=>{ if(st.dead||tok!==st.sndTok) return; const ctx=SND.ctx; if(!ctx) return; const lead=0.06, base=ctx.currentTime+lead;
      st.t0=performance.now()+lead*1000; st.played=true;   // the clip restarts with its sound
      P.snd.forEach((x,i)=>{ const src=sfxPlay(x.name,base+x.at,{fromStart:!!x.fromStart,atk:x.atk?1:0,key:'skp'+tok+'.'+i}); if(src) st.srcs.push(src); }); };
    let done=false; const once=()=>{ if(!done){ done=true; go(); } };
    Promise.all(wait).then(once,once); setTimeout(once,1200); return true; }
  function releaseSnd(st){ sndStop(st); try{ const keep=new Set(); for(const k in (SFX.want||{})) sfxFiles(SFX_DATA.heroes[k]).forEach(n=>{ const F=SFX_DATA.files[n]; if(F) keep.add(F[0]); });
    st.ownBuf.forEach(f=>{ if(!keep.has(f)&&!/LIB-ATK-/.test(f)) delete SND.buf[f]; }); }catch(_){} st.ownBuf=[]; }
  /* ---- mount / play / stop ---- */
  function stop(){ if(cur){ const st=cur; cur=null; st.dead=true; releaseSnd(st); releaseImgs(st); } }
  function mount(canvas,key){ if(!canvas) return null;
    if(cur&&cur.key===key&&!cur.dead){ cur.canvas=canvas; if(!cur.loopOn) start(cur); return cur; }   // a re-render of the same hero keeps its sheets, slot and clock
    stop(); const st={canvas,key,slot:null,plan:null,t0:performance.now(),dead:false,imgs:{},srcs:[],ownBuf:[],sndTok:0};
    st.play=(slot,withSound)=>{ const p=(typeof skillPreviewPlan==='function')?skillPreviewPlan(key,slot):null; st.slot=slot; st.plan=p; st.t0=performance.now(); sndStop(st);
      if(p){ p.fx.forEach(e=>{ if(e.kind==='tip'||e.kind==='chop'){ e.trackA=BATTLE_ANIM[key][e.st]; } e._k=0; e._kt=null; e._hitAt=null; }); }
      if(withSound&&p) sndGo(st); return !!p; };
    st.tap=(slot)=>st.play(slot,true);
    cur=st; start(st); return st; }
  function start(st){ st.loopOn=true;
    function loop(now){ if(st.dead||cur!==st){ st.loopOn=false; return; } const canvas=st.canvas;
      if(!canvas||!canvas.isConnected||canvas.offsetParent===null){ st.loopOn=false; if(cur===st) stop(); return; }   // the panel closed (or the tab changed): its sheets and sounds go
      const dpr=Math.min(2,root.devicePixelRatio||1), W=canvas.clientWidth||320, H=canvas.clientHeight||200;
      if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){ canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); }
      const g=canvas.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
      const bg=imgOf(st,BG); if(bg){ const nw=bg.naturalWidth, nh=bg.naturalHeight; let sx=nw*0.14, sy=nh*0.12, sw=nw*0.72, sh=nh*0.62; const want=W/H;
        if(sw/sh>want){ const nsw=sh*want; sx+=(sw-nsw)/2; sw=nsw; } else { const nsh=sw/want; sy+=(sh-nsh)/2; sh=nsh; } g.drawImage(bg,sx,sy,sw,sh,0,0,W,H); }
      else { g.fillStyle='#1d2433'; g.fillRect(0,0,W,H); }
      const P=st.plan, an=BATTLE_ANIM[st.key]||{}, V=fitView(st,W,H);
      const LOOP=P?Math.max(LOOP_MIN,P.end+0.4):LOOP_MIN, t=Math.max(0,(now-st.t0)/1000), tt=P?(t%LOOP):t;
      if(P&&t>=LOOP&&st.played){ st.played=false; sndStop(st); }   // the sound belongs to the tapped play only; the loop after it is silent
      // which clip is on screen
      let hero=null; if(P){ for(const c of P.clips){ if(tt>=c.t0&&tt<c.t0+c.dur){ hero={st:c.st,A:c.A,live:true,acc:(tt-c.t0)*(c.A.fps||10),clipCell:skillPreviewCell(c.A,tt-c.t0)}; break; } }
        if(!hero){ const L=P.clips[P.clips.length-1]; hero={st:L.st,A:L.A,live:false,acc:0,clipCell:skillPreviewCell(L.A,L.dur)}; } }
      if(P) P.fx.forEach(e=>drawFx(g,st,V,e,tt,hero,'ground'));
      if(P) P.fx.forEach(e=>drawFx(g,st,V,e,tt,hero,'back'));
      { let A=null, fr=0; if(hero&&hero.live){ A=hero.A; fr=hero.clipCell; } else if(an.idle){ A=an.idle; const per=ppPer(A), p=Math.floor(tt*(A.fps||10))%per; fr=ppFrame(A,p); }
        if(A) drawHero(g,st,A,fr,V); }
      if(P) P.fx.forEach(e=>drawFx(g,st,V,e,tt,hero,'front'));
      requestAnimationFrame(loop); }
    requestAnimationFrame(loop); }
  root.EmberSkillStage={mount,stop,current:()=>cur};
})(window);
