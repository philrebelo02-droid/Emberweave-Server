/* ==========================================================================
   Emberweave — shared server-side deterministic battle resolver (sim v1)
   ==========================================================================
   The seam demanded by the Aether Vault + Skyfall specs: BOTH modes resolve
   every fight through resolveLineBattle()/resolveTwoWaveBattle() below, so
   the client can never invent an outcome. This v1 is a deterministic
   round-based model that mirrors the client's RESOLVED STAT formulas exactly
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
  fritz:{hp:320,dmg:22,apow:30,role:'Mage',stars:2,healer:false,atkSpeed:1},
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
  const stars=(opts.stars|0)||b.stars, pips=(opts.pips|0)||0;
  const mul=(1+0.18*(level-1))*starMultFor(stars,pips);   // the client's heroStat() curve
  const g=opts.glyph||{};
  return {
    key, level, role:b.role, healer:b.healer,
    maxHp: Math.round(b.hp*mul)+((g.hp|0)||0),
    atk:   Math.round(Math.max(b.dmg,b.apow)*mul)+((g.atk|0)||0),
    heal:  b.healer? Math.round(Math.max(10,b.apow)*mul*0.9)+((g.heal|0)||0) : 0,
    speed: b.atkSpeed||1,
    dr:+(opts.dr||0)||0, crit:+(opts.crit||0)||0, critRes:+(opts.critRes||0)||0, energyReg:+(opts.energyReg||0)||0
  };
}

/* Build a battle line from resolved stats + optional carried state.
   snaps: [heroCombatStats...] (≤5) · carry: [{hp,energy}] aligned or null */
function makeLine(snaps, carry){
  const units=snaps.filter(Boolean).slice(0,5).map((s,i)=>({
    key:s.key, role:s.role, healer:s.healer, maxHp:s.maxHp, atk:s.atk, heal:s.heal, speed:s.speed,
    dr:s.dr||0, crit:s.crit||0, critRes:s.critRes||0, energyReg:s.energyReg||0,
    hp: carry&&carry[i]? Math.max(0,Math.min(s.maxHp,carry[i].hp|0)) : s.maxHp,
    energy: carry&&carry[i]? Math.max(0,Math.min(100,carry[i].energy|0)) : 0
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
    const swings=u.speed>=1.1?2:1;                          // fast heroes act twice per round, deterministically
    for(let s=0;s<swings;s++){
      if(!anyAlive(foe)) return;
      u.energy=Math.min(100,u.energy+25*(1+(u.energyReg||0)));   // energy gear/glyphs charge ults faster (client rule)
      const ult=u.energy>=100;
      if(u.healer){ const w=weakestAlive(own);
        if(w && w.hp<w.maxHp*0.72){ const amt=Math.round(u.heal*(ult?2.2:1)*(0.85+0.3*rnd()));
          w.hp=Math.min(w.maxHp,w.hp+amt); if(ult)u.energy=0;
          if(log.length<400) log.push([round,side,u.key,'+',w.key,amt,ult?1:0]); continue; } }
      const t=firstAlive(foe); if(!t) return;
      // client crit rules: base 12% + gear/glyph crit chance; crit = ×1.6; target critRes shrinks the BONUS
      let critMul=1; if(rnd()<(0.12+(u.crit||0))){ critMul=1.6; if(t.critRes) critMul=1+0.6*(1-Math.min(0.75,t.critRes)); }
      let dmg=Math.round(u.atk*(side==='A'?fA:fB)*(ult?2.2:1)*critMul*(0.85+0.3*rnd()));
      if(t.dr) dmg=Math.round(dmg*(1-Math.min(0.6,t.dr)));   // shared 60% damage-reduction cap (client rule)
      t.hp-=dmg; if(ult)u.energy=0;
      if(log.length<400) log.push([round,side,u.key,'>',t.key,dmg,ult?1:0]);
    }
  };
  while(anyAlive(a)&&anyAlive(b)&&round<300){
    round++;
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
    carry=teamSnaps.map(s=>{ const st=r.aState.find(x=>x.key===s.key); return st?{hp:st.hp,energy:st.energy}:{hp:0,energy:0}; });
  }
  return { result:{won:true}, waveResults };
}

module.exports={ HERO_BASE, mulberry32, seedFrom, heroCombatStats, makeLine, resolveLineBattle, resolveTwoWaveBattle, lineState };
