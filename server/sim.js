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
  meryln:{hp:200,dmg:12,apow:30,role:'Support',stars:1,healer:true,atkSpeed:0.9},
  /* v332 — new heroes */
  pyroclast:{hp:185,dmg:16,apow:34,role:'Mage',stars:2,healer:false,atkSpeed:0.85},
  stormwarden:{hp:440,dmg:30,apow:0,role:'Fighter',stars:2,healer:false,atkSpeed:1.0},
  verdantshade:{hp:210,dmg:32,apow:0,role:'Marksman',stars:2,healer:false,atkSpeed:1.0},
  voidweaver:{hp:175,dmg:18,apow:36,role:'Mage',stars:3,healer:false,atkSpeed:0.85},
  dawnbringer:{hp:580,dmg:24,apow:20,role:'Tank',stars:3,healer:false,atkSpeed:0.9},
  cathedral:{hp:620,dmg:20,apow:26,role:'Tank',stars:3,healer:false,atkSpeed:0.85},
  lastfurnace:{hp:470,dmg:34,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:0.95},
  beekeeper:{hp:230,dmg:14,apow:32,role:'Support',stars:2,healer:true,atkSpeed:0.9},
  librarian:{hp:200,dmg:16,apow:34,role:'Mage',stars:3,healer:false,atkSpeed:0.85},
  corsair:{hp:220,dmg:33,apow:0,role:'Marksman',stars:2,healer:false,atkSpeed:1.05},
  waxenduchess:{hp:190,dmg:17,apow:35,role:'Mage',stars:3,healer:false,atkSpeed:0.85}
};
/* v364: base Armor / Magic Resist by role — the SAME table and defaulting as the client's ROLE_BASE_DEF
   (emberweave-heroes.html, right after HERO_TYPES). Authored values (Fritz 60/90) are kept. */
const ROLE_BASE_DEF={ Tank:{armor:60,mr:40}, Fighter:{armor:45,mr:30}, Bruiser:{armor:40,mr:30}, Assassin:{armor:25,mr:20},
  Marksman:{armor:22,mr:22}, Mage:{armor:15,mr:40}, Support:{armor:22,mr:38} };
for(const k in HERO_BASE){ const t=HERO_BASE[k], d=ROLE_BASE_DEF[t.role]||ROLE_BASE_DEF.Bruiser; if(t.armor==null) t.armor=d.armor; if(t.mr==null) t.mr=d.mr; }
const STAR_MULT=[1,1.15,1.35,1.6,1.9], STAR_PIPS=5, MAX_STARS=5;
const ROLE_FRONT_ORDER={Tank:0,Bruiser:1,Fighter:2,Assassin:3,Marksman:4,Mage:5,Support:6,Control:6};

// ---- deterministic PRNG (same mulberry32 the client uses) ----
const CORE=require('./combat-core.js');   // v242: ONE typed deterministic combat model for every battle authority
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
  let smul=starMultFor(stars,pips);
  if(stars>=5&&ref>0){ const A=[1.90,2.25,2.65,2.90];
    smul = ref>=15 ? A[3] : A[Math.floor(ref/5)]+(A[Math.floor(ref/5)+1]-A[Math.floor(ref/5)])*((ref%5)/5); }
  const mul=(1+0.18*(level-1))*smul;                                   // the client's heroStat() curve
  const defScale=(1+0.05*(level-1))*starMultFor(stars,pips);           // the client's makeUnit defense scale
  // v242: RAW TYPED RATINGS in (snapshotHeroFromServer), typed core unit out. Legacy callers that
  // still pass {glyph:{hp,atk,apow,heal}} get those as flats with no ratings.
  const R=opts.ratings || (opts.glyph?{hpFlat:opts.glyph.hp|0,atkFlat:opts.glyph.atk|0,apowFlat:opts.glyph.apow|0,healFlat:opts.glyph.heal|0}:{});
  const u=CORE.buildUnit(key, b, mul, defScale, R, Object.assign({gearSkillSlot:opts.gearSkillSlot||null, gearSkill:opts.gearSkill||null}, opts.extra||{}));
  u.level=level;
  // legacy aliases: scores (vaultTeamScore), plausibility gates, and views read these
  u.atk=Math.max(u.atkP,u.atkM);
  u.dr=(CORE.defToDR(u.armor)+CORE.defToDR(u.mr))/2;
  return u;
}
function defToDR(flatDef){ return flatDef>0 ? flatDef/(flatDef+1200) : 0; }   // the client's exact diminishing curve

/* Build a battle line from resolved stats + optional carried state.
   snaps: [heroCombatStats...] (≤5) · carry: [{hp,energy}] aligned or null */
function makeLine(snaps, carry){
  const coerced=snaps.filter(Boolean).slice(0,5).map(s2=>{
    if(s2.atkP!==undefined) return s2;                                  // already a typed core unit
    // legacy line-model unit (old fixtures/tests): map onto the typed model without changing power
    return Object.assign({}, s2, { atkP:s2.atk|0, atkM:0,
      armor:s2.defRating||0, mr:s2.defRating||0, armorPen:s2.pen|0, magicPen:s2.pen|0,
      critDmg:0.6, dmgBonus:1, dmgRed:Math.min(0.6,s2.dr||0),           // legacy composite dr rides as flat reduction
      lifesteal:0, eva:0, acc:0, block:0, haste:1, shieldStr:1, ctrlHit:0,
      kit:CORE.KITS[s2.key]||{kind:s2.healer?'heal':'phys',shape:'nuke',coef:2.2,who:'allies'} }); });
  return CORE.lineUp(coerced, carry);
}
function lineState(units){ return units.map(u=>({key:u.key, hp:Math.max(0,Math.round(u.hp)), maxHp:u.maxHp, energy:Math.round(u.energy), alive:u.hp>0})); }
function anyAlive(units){ return units.some(u=>u.hp>0); }
function firstAlive(units){ for(const u of units) if(u.hp>0) return u; return null; }
function weakestAlive(units){ let w=null; for(const u of units){ if(u.hp>0&&(!w||u.hp/u.maxHp<w.hp/w.maxHp)) w=u; } return w; }

/* v242: the resolver IS the shared combat core (server/combat-core.js). */
function resolveLineBattle(a,b,seed){ return CORE.resolveBattle(a,b,seed); }

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

module.exports={ HERO_BASE, mulberry32, seedFrom, heroCombatStats, makeLine, resolveLineBattle, resolveTwoWaveBattle, lineState, qualificationEstimate: resolveTwoWaveBattle, CORE };   // qualificationEstimate = the honest name: a line-model ESTIMATE for gating/qualification, not a battle replay
