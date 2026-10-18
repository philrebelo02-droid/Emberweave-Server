'use strict';
// helpers for tests/test_skill_previews_1164.js: what the FIGHT does for one slot, recorded off the real engine in server/sim-host.js
const OWN = ['bellCastFx', 'astraHorizonFx', 'korvuxChopCastFx', 'tharlQuakeFx', 'rhukkDigInFx', 'vesperPunctureCastFx', 'vexTempestFx', 'veyrMantleFx',
  'veyrUndertowFx', 'veyrCrescentFx', 'konwuRuyiCastFx', 'vexWoundFx', 'sorrelHitFx', 'carnReapFx', 'hookReelFx', 'hookSlashFx', 'spawnTipFx', 'spawnProjFx', 'spawnBeamFx', 'fx16Show', 'rimGlideFx', 'tolleyForgeCastFx', 'tolleyQuenchFx', 'tolleyLivingForgeFx'];   /* v1197: Tolley's painters (the hammer at the press, the explosion boomAt after the chains, the ring at the release) */   /* v1180: Rim Breaker's glide is recorded at the shot's launch */   // v1171: Vael's / Deepcleft's art is recorded when it SHOWS (on the clip's cell, or the emerge), not at the press
const OWNKEY = { bellCastFx: 'bellring', astraHorizonFx: 'astrahorizon', korvuxChopCastFx: 'korvuxcleave', tharlQuakeFx: 'tharlquake', rhukkDigInFx: 'rhukkroar',
  vesperPunctureCastFx: 'vesperpuncture', vexTempestFx: 'vextempest', veyrMantleFx: 'veyrmantle', veyrUndertowFx: 'veyrundertow', veyrCrescentFx: 'veyrcrescent',
  konwuRuyiCastFx: 'konwuruyi', vexWoundFx: 'bleedopen', carnReapFx: 'carnreap', hookReelFx: 'hookreel', hookSlashFx: 'hookslash', rimGlideFx: 'brannus_green', tolleyForgeCastFx: 'tolley_green', tolleyLivingForgeFx: 'tolley_ult' };
// one cast of slot (0 ult, 1 green, 2 blue) by hero k at an enemy standing skillPreviewTargetDist away: [{key, t (fight s from the press)}] + the clip it played
const castSrc = (k, slot) => `(()=>{ const rec=[]; const OWN=${JSON.stringify(OWN)}, OK=${JSON.stringify(OWNKEY)}; const sv={}; const _fc=_fxCheck;
  _fxCheck=function(kind,key){ rec.push({src:kind,key,t:+battleTime.toFixed(4)}); };
  OWN.forEach(n=>{ sv[n]=globalThis[n]; globalThis[n]=function(){ if(n==='spawnTipFx'){ const T=TIPFX[arguments[0].key]&&TIPFX[arguments[0].key][arguments[1]]; if(T) rec.push({src:'tip',key:T.fx,t:+battleTime.toFixed(4)}); }
      else if(n==='sorrelHitFx') rec.push({src:'own',key:arguments[1]?'sorrelflare':'sorrelspark',t:+battleTime.toFixed(4)});
      else if(n==='spawnBeamFx') rec.push({src:'beam',key:arguments[0],t:+battleTime.toFixed(4)});
      else if(n==='fx16Show') rec.push({src:'own',key:FX16_ART[arguments[0].vk].k,t:+battleTime.toFixed(4)});
      else if(n==='tolleyQuenchFx') rec.push({src:'own',key:'tolley_blue_boom',t:+(battleTime+((FX2_DEF.tolley_blue&&FX2_DEF.tolley_blue.boomAt)||1.8)*FX_RT).toFixed(4)});   /* v1197: the preview draws the explosion (the chains need an enemy to aim at), boomAt after the chains start */
      else if(n==='rhukkDigInFx'){ rec.push({src:'own',key:'rhukkroar',t:+battleTime.toFixed(4)}); rec.push({src:'own',key:'rhukkshell',t:+battleTime.toFixed(4)}); }
      else if(n!=='spawnProjFx') rec.push({src:'own',key:OK[n],t:+battleTime.toFixed(4)});
      try{ return sv[n].apply(this,arguments); }catch(e){} }; });
  let clip=null, hold=null;
  try{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
    const D=skillPreviewTargetDist('${k}');
    const g=makeUnit('${k}','ally',500,700,30,{owned:false,rank:5}); const e=makeUnit('vael','enemy',500+D,700,30,{owned:false}); const e2=makeUnit('tick','enemy',500+D,701,30,{owned:false});
    g.anim=BATTLE_ANIM['${k}']; units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e7; u.speed=0; u._dropHidden=false; u._riseT=0; u._sprRef={getWorldPosition(p){ return p; }}; }); g.hp=g.maxHp*0.6; e.atkInterval=99; e.atkCd=99; e2.atkCd=99; g.target=e;
    if(${slot}===0){ g.energy=100; castAbility(g); } else { const ab=${slot}===1?g.greenAb:g.blueAb; if(!ab) return JSON.stringify(null); castKit(g,ab); }
    clip=g._abilFallback?'(stand-in)':(g._abilAnim||null); hold=g._abilHold;
    const P0=units.map(u=>[u.x,u.y]); for(let i=0;i<Math.round(4/SIM_STEP);i++){ units.forEach((u,j)=>{ if(P0[j]&&!u._dash){ u.x=P0[j][0]; u.y=P0[j][1]; } }); updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; g.energy=0; e.energy=0; e2.energy=0; }
  } finally { _fxCheck=_fc; OWN.forEach(n=>globalThis[n]=sv[n]); }
  return JSON.stringify({clip,hold,rec}); })()`;
// the clips of N real swings (crit forced or held at 0)
const swingSrc = (k, crit, n) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const D=skillPreviewTargetDist('${k}');
  const g=makeUnit('${k}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',500+D,700,30,{owned:false});
  g.anim=BATTLE_ANIM['${k}']; e.anim=null; units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0; g.target=e; g.greenCd=g.blueCd=99;
  const clips=[]; let last=g.atkCd; g.atkCd=0;
  for(let i=0;i<Math.round(30/SIM_STEP)&&clips.length<${n};i++){ g.glyphCrit=0; if(${crit}) g._gearNextCrit='hit'; const before=g.atkCd; updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; e.energy=0; g.energy=0;
    if(g.atkCd>before+1e-6) clips.push(g._atkClip&&g.anim[g._atkClip]?g._atkClip:'attack'); }
  return JSON.stringify(clips); })()`;
module.exports = { castSrc, swingSrc, OWN, OWNKEY };
