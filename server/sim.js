/* ==========================================================================
   Emberweave — shared server-side deterministic battle resolver (sim v1)
   ==========================================================================
   The seam demanded by the Aether Vault + Skyfall specs: BOTH modes resolve
   every fight through resolveLineBattle()/resolveTwoWaveBattle() below, so
   the client can never invent an outcome. This v1 is a deterministic
   round-based QUALIFICATION ESTIMATE. Stat RESOLUTION follows the client's formulas; the battle itself is a simplified line model — it is never a replay of a client battle
   (base × (1+0.18·(level−1)) × starMult + glyph bonuses) but simplifies the
   moment-to-moment combat (no positioning/FX). Swapping in the full 30 Hz
   extracted sim later means replacing ONLY the internals of
   resolveLineBattle(); every caller keeps working.
   Deterministic: same inputs + same seed → byte-identical result. No
   Date.now(), no Math.random() — mulberry32 only, stable iteration order.
   ========================================================================== */
'use strict';

// ---- base stat table (extracted from the client's HERO_TYPES, 26 Aug 2026 v209) ----
const HERO_BASE={
  konwu:{hp:380,dmg:34,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:1.15},
  grosk:{hp:620,dmg:18,apow:0,role:'Tank',stars:3,healer:false,atkSpeed:0.85},
  vulmar:{hp:175,dmg:26,apow:0,role:'Mage',stars:3,healer:false,atkSpeed:0.85},
  tick:{hp:360,dmg:28,apow:0,role:'Bruiser',stars:1,healer:false,atkSpeed:1.1},
  sylthaine:{hp:150,dmg:14,apow:32,role:'Mage',stars:1,healer:false,atkSpeed:0.85},
  aureth:{hp:460,dmg:24,apow:24,role:'Fighter',stars:3,healer:false,atkSpeed:0.9},
  bloatus:{hp:540,dmg:24,apow:28,role:'Tank',stars:3,healer:false,atkSpeed:0.9},
  vireo:{hp:220,dmg:16,apow:30,role:'Support',stars:1,healer:true,atkSpeed:0.9},
  fritz:{hp:320,dmg:22,apow:30,role:'Mage',stars:2,healer:false,atkSpeed:1,armor:60,mr:90},
  umbris:{hp:170,dmg:22,apow:32,role:'Mage',stars:3,healer:false,atkSpeed:0.85},
  vael:{hp:400,dmg:30,apow:0,role:'Bruiser',stars:1,healer:false,atkSpeed:0.95},
  oakmir:{hp:230,dmg:16,apow:32,role:'Support',stars:3,healer:true,atkSpeed:0.85},
  rhukk:{hp:430,dmg:26,apow:0,role:'Bruiser',stars:2,healer:false,atkSpeed:0.9},
  hurne:{hp:520,dmg:32,apow:0,role:'Fighter',stars:3,healer:false,atkSpeed:0.9},
  meridian:{hp:200,dmg:34,apow:0,role:'Marksman',stars:3,healer:false,atkSpeed:1},
  tallow:{hp:560,dmg:26,apow:0,role:'Tank',stars:2,healer:false,atkSpeed:0.85},
  astra:{hp:180,dmg:16,apow:34,role:'Mage',stars:2,healer:false,atkSpeed:0.85},
  magistrant:{hp:450,dmg:28,apow:0,role:'Fighter',stars:2,healer:false,atkSpeed:1},
  vharn:{hp:430,dmg:32,apow:0,role:'Bruiser',stars:2,healer:false,atkSpeed:0.95},
  fathom:{hp:300,dmg:16,apow:30,role:'Mage',stars:2,healer:false,atkSpeed:0.85},
  lumi:{hp:210,dmg:14,apow:30,role:'Support',stars:2,healer:true,atkSpeed:0.9},
  hollow:{hp:360,dmg:40,apow:0,role:'Assassin',stars:3,healer:false,atkSpeed:1.2},
  sprocket:{hp:380,dmg:30,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:1},
  carn:{hp:410,dmg:34,apow:0,role:'Bruiser',stars:1,healer:false,atkSpeed:1.05},
  vesper:{hp:190,dmg:16,apow:32,role:'Mage',stars:2,healer:false,atkSpeed:0.85},
  sablewick:{hp:200,dmg:15,apow:31,role:'Support',stars:2,healer:false,atkSpeed:0.85},
  vex:{hp:320,dmg:34,apow:0,role:'Assassin',stars:1,healer:false,atkSpeed:1.15},
  arrears:{hp:360,dmg:28,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:0.85},
  meryln:{hp:200,dmg:12,apow:30,role:'Support',stars:1,healer:true,atkSpeed:0.9}
};
const STAR_MULT=[1,1.15,1.35,1.6,1.9], STAR_PIPS=5, MAX_STARS=5;
const ROLE_FRONT_ORDER={Tank:0,Bruiser:1,Fighter:2,Assassin:3,Marksman:4,Mage:5,Support:6,Control:6};

// ---- deterministic PRNG (same mulberry32 the client uses) ----
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a);
  t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function seedFrom(str){ // FNV-1a → uint32; stable across processes
  let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193); } return h>>>0; }

function starMultFor(stars,pips){ const lv=Math.max(1,Math.min(MAX_STARS,stars|0)), p=Math.max(0,Math.min(STAR_PIPS,pips|0));
  if(lv>=MAX_STARS) return STAR_MULT[MAX_STARS-1];
  const a=STAR_MULT[lv-1], b=STAR_MULT[lv]; return a+(b-a)*(p/STAR_PIPS); }

/* Resolve one hero's server-owned combat stats.
   opts: { level, stars, pips, glyph:{hp,atk,heal}, dr, crit, critRes, energyReg } — server-derived.
   v225 (re-audit): units carry the client's combat fields — dr (fractional damage reduction, capped
   0.6 at apply time), crit (extra crit CHANCE), critRes (reduces crit BONUS damage, client rule),
   energyReg (fractional bonus to energy gain). The resolver applies them with the client's rules:
   crit multiplier 1.6×, critRes shrinks the bonus (1+(0.6)·(1−critRes)), DR multiplies incoming
   damage under a 0.6 cap. The sim is still a simplified line resolver, not a replay of the full
   client battle (kits, positioning, manual timing), and is labeled as such where it gates results. */
function heroCombatStats(key, opts){
  const b=HERO_BASE[key]; if(!b) return null;
  opts=opts||{};
  const level=Math.max(1,Math.min(200,(opts.level|0)||1));
  const stars=(opts.stars|0)||b.stars, pips=(opts.pips|0)||0, ref=Math.max(0,Math.min(15,opts.ref|0));
  // 5★ REFINE extends the star multiplier along the client's anchors (Bronze/Silver/Gold, 5 steps each)
  let smul=starMultFor(stars,pips);
  if(stars>=5&&ref>0){ const A=[1.90,2.25,2.65,2.90];
    smul = ref>=15 ? A[3] : A[Math.floor(ref/5)]+(A[Math.floor(ref/5)+1]-A[Math.floor(ref/5)])*((ref%5)/5); }
  const mul=(1+0.18*(level-1))*smul;   // the client's heroStat() curve
  const g=opts.glyph||{};
  return {
    key, level, role:b.role, healer:b.healer,
    maxHp: Math.round(b.hp*mul)+((g.hp|0)||0),
    // v241 (audit): Ability Power is its OWN scaling line — a caster's AP glyphs raise the ability
    // line, a physical hero's line is untouched by AP. The line model takes the better of the two.
    atk:   Math.max( Math.round(b.dmg*mul)+((g.atk|0)||0), (b.apow||0)>0 ? Math.round(b.apow*mul)+((g.apow|0)||0) : 0 ),
    heal:  b.healer? Math.round(Math.max(10,b.apow)*mul*0.9)+Math.round(((g.apow|0)||0)*0.9)+((g.heal|0)||0) : 0,
    speed: b.atkSpeed||1,
    // dr = rate-derived DR (client caps that part at 0.6) + the client's diminishing base-armor curve
    // defToDR(flat)=flat/(flat+1200) at the client's makeUnit level scale (1+0.05·(lvl−1))·starMult.
    // Client-save technology defense is intentionally excluded (client-owned until CR-2).
    dr: Math.min(0.6,+(opts.dr||0)||0) + defToDR(((b.armor||0)+(b.mr||0))*(1+0.05*(level-1))*starMultFor(stars,pips)),
    // v241 (audit): penetration counters the DEFENSE RATING behind the diminishing curve — it never
    // adds raw damage and does nothing against an unarmored target. defRating is kept separately so
    // the resolver can re-run the curve with (def − pen) at hit time; the composed dr stays for display.
    defRating: ((b.armor||0)+(b.mr||0))*(1+0.05*(level-1))*starMultFor(stars,pips),
    pen: Math.max(0, opts.pen|0),
    crit:+(opts.crit||0)||0, critRes:+(opts.critRes||0)||0,
    energyReg:+(opts.energyReg||0)||0,   // energy POINTS per second (client: u.energy += energyReg·dt)
    regen:+(opts.regen||0)||0,           // fraction of maxHp per second (client: hp += maxHp·regen·dt)
    // AUDIT C6 — DISTINCT stats, never folded: startEnergy = initial energy points; ctrlRes carried
    // (the line model has no control effects to resist — documented no-op here, real in the client);
    // healPow multiplies HEALER output only.
    startEnergy:Math.max(0,Math.min(60,opts.startEnergy|0)), ctrlRes:+(opts.ctrlRes||0)||0, healPow:+(opts.healPow||0)||0,
    gearSkillSlot: opts.gearSkillSlot||null,
    gearSkill: opts.gearSkill||null      // AUDIT C4: the ITEM-specific active {id,type,params}
  };
}
function defToDR(flatDef){ return flatDef>0 ? flatDef/(flatDef+1200) : 0; }   // the client's exact diminishing curve

/* Build a battle line from resolved stats + optional carried state.
   snaps: [heroCombatStats...] (≤5) · carry: [{hp,energy}] aligned or null */
function makeLine(snaps, carry){
  const units=snaps.filter(Boolean).slice(0,5).map((s,i)=>({
    key:s.key, role:s.role, healer:s.healer, maxHp:s.maxHp, atk:s.atk, heal:s.heal, speed:s.speed,
    dr:s.dr||0, defRating:s.defRating||0, pen:s.pen||0, crit:s.crit||0, critRes:s.critRes||0, energyReg:s.energyReg||0, regen:s.regen||0,
    startEnergy:s.startEnergy||0, ctrlRes:s.ctrlRes||0, healPow:s.healPow||0,
    gearSkillSlot:s.gearSkillSlot||null, gearSkill:s.gearSkill||null, _gearSkillUsed:false, shieldPool:0,
    hp: carry&&carry[i]? Math.max(0,Math.min(s.maxHp,carry[i].hp|0)) : s.maxHp,
    energy: carry&&carry[i]? Math.max(0,Math.min(100,carry[i].energy|0)) : (s.startEnergy||0)
  }));
  units.sort((a,b)=>(ROLE_FRONT_ORDER[a.role]??5)-(ROLE_FRONT_ORDER[b.role]??5));   // tanks eat hits first — stable order
  return units;
}
function lineState(units){ return units.map(u=>({key:u.key, hp:Math.max(0,Math.round(u.hp)), maxHp:u.maxHp, energy:Math.round(u.energy), alive:u.hp>0})); }
function anyAlive(units){ return units.some(u=>u.hp>0); }
function firstAlive(units){ for(const u of units) if(u.hp>0) return u; return null; }
function weakestAlive(units){ let w=null; for(const u of units){ if(u.hp>0&&(!w||u.hp/u.maxHp<w.hp/w.maxHp)) w=u; } return w; }

/* The core resolver. a/b: makeLine() outputs (MUTATED). Returns a compact result + event log.
   Attacker (a) must eliminate b; a round-cap stall counts as a DEFENDER win (spec: attacker must finish). */
function resolveLineBattle(a, b, seed){
  const rnd=mulberry32(seed>>>0); const log=[]; let round=0;
  // per-fight team performance factor (±10%, seeded) — softens hard power cliffs into odds
  const fA=0.85+0.30*rnd(), fB=0.85+0.30*rnd();
  const act=(u, side, own, foe)=>{
    if(u.hp<=0) return;
    if(u._skipR>0){ u._skipR--; return; }   // gear-skill stun/silence: lose this action
    const swings=u.speed>=1.1?2:1;                          // fast heroes act twice per round, deterministically
    for(let s=0;s<swings;s++){
      if(!anyAlive(foe)) return;
      u.energy=Math.min(100,u.energy+25);   // the sim's own per-action charge; energy regen is TIME-based below, per round
      const ult=u.energy>=100;
      if(u.healer){ const w=weakestAlive(own);
        if(w && w.hp<w.maxHp*0.72){ const amt=Math.round(u.heal*(1+(u.healPow||0))*(ult?2.2:1)*(0.85+0.3*rnd()));
          w.hp=Math.min(w.maxHp,w.hp+amt); if(ult)u.energy=0;
          if(log.length<400) log.push([round,side,u.key,'+',w.key,amt,ult?1:0]); continue; } }
      const t=firstAlive(foe); if(!t) return;
      // client crit rules: NO universal base crit — chance comes only from gear/glyph/passive ratings;
      // a crit is ×1.6 and the target's critRes shrinks the BONUS (client dealDamage rule).
      const critRoll=rnd();   // always consumed — deterministic stream length
      let critMul=1; if((u.crit||0)>0 && critRoll<(u.crit||0)){ critMul=1.6; if(t.critRes) critMul=1+0.6*(1-Math.min(0.75,t.critRes)); }
      if(t._markR>0) critMul*=(t._markMul||1);   // gear-skill marks: the target takes bonus damage
      let dmg=Math.round(u.atk*((u._buffR>0)?(u._buffMul||1):1)*(side==='A'?fA:fB)*(ult?2.2:1)*critMul*(0.85+0.3*rnd()));
      if(t._drR>0) dmg=Math.round(dmg*0.65);   // Armor gear skill: brace, −35% for its 5 rounds
      if(t.dr) dmg=Math.round(dmg*(1-Math.min(0.95,t.dr)));   // dr composed the client's way (rate part capped 0.6 + diminishing base curve); 0.95 is only a never-immortal guard
      // v241 (audit): penetration re-runs the diminishing curve with (defRating − pen) — a pure
      // ratio against the already-applied base-def mitigation. No pen → ratio 1. No def → no effect.
      if((u.pen||0)>0&&(t.defRating||0)>0){ const d0=defToDR(t.defRating), d1=defToDR(Math.max(0,t.defRating-u.pen)); if(d0<1) dmg=Math.round(dmg*(1-d1)/(1-d0)); }
      if(t.shieldPool>0){ const ab=Math.min(t.shieldPool,dmg); t.shieldPool-=ab; dmg-=ab; }   // one-use gear-skill shields absorb first
      t.hp-=dmg; if(ult)u.energy=0;
      if(log.length<400) log.push([round,side,u.key,'>',t.key,dmg,ult?1:0]);
    }
  };
  // AUDIT C4: ITEM-SPECIFIC gear actives — a parameterised executor over the same definition the
  // client uses ({type,params}); temper/rarity never change these. Control/positioning params have
  // simplified line-model equivalents; each fires exactly once per battle (round 2 of wave 1).
  const gsDmg=(u,t,mult)=>{ if(!t)return; let d=Math.round(u.atk*(mult||1));
    if(t.shieldPool>0){ const ab=Math.min(t.shieldPool,d); t.shieldPool-=ab; d-=ab; } t.hp-=d; };
  const gsPickTargets=(foe,how,n)=>{ const alive=foe.filter(x=>x.hp>0); if(!alive.length)return[];
    if(how==='far') return [alive[alive.length-1]];
    if(how==='lowest') return [alive.slice().sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0]];
    if(how==='all') return alive;
    if(how==='chain'||how==='random'||how==='aoe'||how==='line') return alive.slice(0,Math.max(1,n||3));
    return [alive[0]]; };
  const fireGearSkill=(u,own,foe)=>{ const g=u.gearSkill; if(!g||!g.type||!g.params) return legacySlotSkill(u,own,foe);
    const p=g.params;
    switch(g.type){
      case 'dmg': for(const t of gsPickTargets(foe,p.target,p.n)) gsDmg(u,t,p.mult); break;
      case 'stun': { const ts=gsPickTargets(foe,p.target==='aoe'?'aoe':'near',p.target==='aoe'?3:1);
        for(const t of ts){ t._skipR=Math.max(t._skipR||0,1); if(p.dmgMult) gsDmg(u,t,p.dmgMult); } break; }
      case 'silence': { const t=gsPickTargets(foe,'near',1)[0]; if(t) t._skipR=Math.max(t._skipR||0,1); break; }
      case 'slow': case 'move': { const ts=gsPickTargets(foe,p.target==='aoe'?'aoe':'near',3);
        for(const t of ts) t._buffR=0, t._slowR=2; break; }
      case 'shield': { const who=p.who==='allies'||p.who==='nearAllies'?own.filter(x=>x.hp>0):(p.who==='lowest'?[own.slice().sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0]]:[u]);
        for(const w of who){ if(!w)continue; const amt=p.ap?Math.round(u.atk*(p.ap||1)):Math.round(w.maxHp*(p.pct||0.1)); w.shieldPool+=amt; if(p.energy) w.energy=Math.min(100,w.energy+p.energy); } break; }
      case 'heal': { const who=p.who==='allies'?own.filter(x=>x.hp>0):(p.who==='lowest'?[own.slice().sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0]]:[u]);
        for(const w of who){ if(!w)continue; const amt=p.missing?Math.round((w.maxHp-w.hp)*p.missing):Math.round(w.maxHp*(p.pct||0.1)); w.hp=Math.min(w.maxHp,w.hp+amt); } break; }
      case 'energy': u.energy=Math.min(100,u.energy+(p.n||20)); break;
      case 'buff': { u._buffR=Math.max(u._buffR||0,Math.round(p.dur||3)); u._buffMul=Math.max(u._buffMul||1,p.atk||p.as||1.15); if(p.dr!=null) u._drR=Math.max(u._drR||0,Math.round(p.dur||3)); break; }
      case 'mark': { const ts=gsPickTargets(foe,p.target==='aoe'||p.target==='all'?'all':(p.target==='far'?'far':'near'),5);
        for(const t of ts){ t._markMul=Math.max(t._markMul||1,p.mult||1.15); t._markR=Math.max(t._markR||0,Math.round(p.dur||3)); } break; }
      case 'taunt': { u.shieldPool+=Math.round(u.maxHp*0.10); break; }
      case 'cleanse': for(const w of own){ if(w.hp>0){ w._skipR=0; } } break;
      case 'untarget': case 'ward': u.shieldPool+=Math.round(u.maxHp*0.15); break;
      case 'next': u._buffR=Math.max(u._buffR||0,2); u._buffMul=Math.max(u._buffMul||1,p.mult||1.3); break;
      default: break;
    } };
  const legacySlotSkill=(u,own,foe)=>{ /* pre-C4 fallback: modest self shield */ u.shieldPool+=Math.round(u.maxHp*0.12); };
  const fireGearSkills=(own,foe)=>{ for(const u of own){ if(u.hp>0&&(u.gearSkill||u.gearSkillSlot)&&!u._gearSkillUsed){ u._gearSkillUsed=true; fireGearSkill(u,own,foe); } } };
  while(anyAlive(a)&&anyAlive(b)&&round<300){
    round++;
    // TIME-based per-round effects (1 round ≈ 1 s): energy regen (points/s) and universal HP regen —
    // regen applies to EVERY alive unit, not only healers (client rule).
    for(const u of a.concat(b)){ if(u.hp<=0) continue;
      if(u.energyReg) u.energy=Math.min(100,u.energy+u.energyReg);
      if(u.regen) u.hp=Math.min(u.maxHp,u.hp+u.maxHp*u.regen);
      if(u._buffR>0){ u._buffR--; if(u._buffR<=0) u._buffMul=1; }
      if(u._drR>0) u._drR--;
      if(u._markR>0){ u._markR--; if(u._markR<=0) u._markMul=1; }
      if(u._slowR>0) u._slowR--; }
    if(round===2 && !a._gsDone){ a._gsDone=true; fireGearSkills(a,b); fireGearSkills(b,a); }
    // INTERLEAVED initiative, lead alternating by round — first-strike bias cancels out
    const n=Math.max(a.length,b.length), aLeads=(round%2===1);
    for(let i=0;i<n;i++){
      if(aLeads){ if(i<a.length) act(a[i],'A',a,b); if(i<b.length) act(b[i],'B',b,a); }
      else      { if(i<b.length) act(b[i],'B',b,a); if(i<a.length) act(a[i],'A',a,b); } }
  }
  const won=anyAlive(a)&&!anyAlive(b);
  return { won, rounds:round, aState:lineState(a), bState:lineState(b), log };
}

/* Dungeon: one floor = two waves; survivors carry HP + energy into wave 2 (spec §7). */
function resolveTwoWaveBattle(teamSnaps, enemyWaveSnaps, seed){
  const waveResults=[];
  let team=makeLine(teamSnaps,null), carry=null;
  for(let w=0;w<enemyWaveSnaps.length;w++){
    if(w>0) team=makeLine(teamSnaps, carry);
    const foes=makeLine(enemyWaveSnaps[w],null);
    const r=resolveLineBattle(team, foes, (seed+w*0x9E3779B9)>>>0);
    waveResults.push({ wave:w+1, won:r.won, rounds:r.rounds, team:r.aState, foes:r.bState, log:r.log });
    if(!r.won) return { result:{won:false, failedWave:w+1}, waveResults };
    // carry maps back to the ORIGINAL snap order via key match (keys unique in a line)
    carry=teamSnaps.map(s2=>{ const st=r.aState.find(x=>x.key===s2.key); return st?{hp:st.hp,energy:st.energy}:{hp:0,energy:0}; });
    teamSnaps=teamSnaps.map(s2=>Object.assign({},s2,{gearSkillSlot:null}));   // one-use per battle: spent in wave 1
  }
  return { result:{won:true}, waveResults };
}

module.exports={ HERO_BASE, mulberry32, seedFrom, heroCombatStats, makeLine, resolveLineBattle, resolveTwoWaveBattle, lineState, qualificationEstimate: resolveTwoWaveBattle };   // qualificationEstimate = the honest name: a line-model ESTIMATE for gating/qualification, not a battle replay
