'use strict';
/* The 95% damage-reduction ceiling, rule (b) (Phil, 14 Nov 2026: "if they reach that for longer than 50% of a battle they are too OP").
   A measurement any test can use: for chosen units over a whole fight, the share of the fight's time during which the unit's combined reduction
   against a REFERENCE HIT is at the ceiling, and the share during which it is fully immune.
   Reference hit: an enemy basic attack of 10% of the unit's max HP, physical and magic each (the worse of the two counts), not a crit, from an
   attacker with no Armor / Magic Pen. Its reductions are the ones the page's damage path applies (keep this list in step with _dealDamageCore and
   damage() in emberweave-heroes.html): Packmaster, Mirewall, Croc Drop, Armor / Magic Resist, the talents' incoming rows (TalentFx.incProbe: what
   the rows WOULD do, with no side effect), drMul, glyphDR, Bulwark, Adamant Discipline, Unmovable Mass. Block (a chance) is not counted.
   Fully immune: HERO61's immunity, untargetable (_noTarget, _vpT), a talent that makes hits deal nothing, or held at 1 HP (a talent's undying,
   Dawnward). Shields are neither.
   Use: const W=require('./dr-ceiling.js').watch(host); W.start(u => <true for the units to watch>); <run the fight>; const r=W.stop();
        r = [{uid, key, team, t (fight seconds), ceil (seconds at the ceiling), imm (seconds immune), share ((ceil+imm)/t), worst (lowest share left)}] */
const vm=require('node:vm');
const FLOOR=0.05;
function install(host){ if(host.__drc) return host.__drc;
  const P=vm.runInContext(`({
    left(u,kind){ let f=1; let src=null, d=Infinity; for(const x of units) if(x.alive&&x.team!==u.team){ const q=dist(u,x); if(q<d){ d=q; src=x; } }
      if(u._packN) f/=1+0.05*u._packN*(u.passMul||1);
      if(u._mwBy&&u._mwBy.alive&&u._mwBy!==u) f*=1-SKLV.mirewall(passLv(u._mwBy));
      if((u._mwDrT||0)>0&&u._mwDrSrc&&u._mwDrSrc.alive) f*=1-(u._mwDrPct||0.20);
      f*=_defMulRaw(null,u,kind,1);
      if(((u._tal&&u._tal.on.in)||u._talW)&&typeof TalentFx!=='undefined'&&TalentFx.incProbe){ const H=0.10*(u.maxHp||1)*f, r=TalentFx.incProbe(u,src,H,kind,true);
        if(r.mv===0) return {f:0,imm:true}; if(H>0&&r.mv>0&&r.amt<H*r.mv) f*=r.amt/(H*r.mv); }
      if(u.drT>0) f*=u.drMul; if(u.glyphDR) f*=1-u.glyphDR;
      if(u.pass&&u.pass.bulwark) f*=1-0.18*(u.passMul||1);
      if(u.pass&&u.pass.warden&&u.wardenStk) f*=1-wardenCut(u);
      if(u.pass&&u.pass.unmovable&&u.wardenStk) f*=1-wardenCut(u);
      return {f,imm:false}; },
    imm(u){ return !!(HERO61.immune(u,battleTime)||u._noTarget||(u._vpT||0)>0||(u._wardT||0)>0||(u._tal&&u._tal.s&&u._tal.s.undy>0)); },
    units(){ return units; }, step(){ return SIM_STEP; }
  })`,host.ctx);
  const SB=host.sandbox, ub=SB.updateBattle; let W=null;
  SB.updateBattle=function(dt){ const r=ub.apply(this,arguments); if(W) sample(dt); return r; };
  function sample(dt){ W.t+=dt; for(const u of P.units()){ if(!W.pick(u)) continue; const e=W.m.get(u)||(W.m.set(u,{uid:u.uid,key:u.key,team:u.team,ceil:0,imm:0,worst:1}),W.m.get(u));
      if(!u.alive) continue;
      if(P.imm(u)){ e.imm+=dt; continue; }
      const a=P.left(u,'phys'), b=P.left(u,'magic'); if(a.imm||b.imm){ e.imm+=dt; continue; }
      const f=Math.min(a.f,b.f); if(f<e.worst) e.worst=f; if(f<=FLOOR+1e-9) e.ceil+=dt; } }
  host.__drc={ start(pick){ W={pick,m:new Map(),t:0}; },
    stop(){ const w=W; W=null; if(!w) return []; return [...w.m.values()].map(e=>Object.assign(e,{t:w.t,share:w.t>0?(e.ceil+e.imm)/w.t:0})); },
    left:(u,k)=>P.left(u,k) };
  return host.__drc; }
module.exports={watch:install,FLOOR};
