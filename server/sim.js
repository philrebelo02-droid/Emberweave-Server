/* ==========================================================================
   Emberweave — shared server-side deterministic battle resolver (sim v1)
   ==========================================================================
   The seam demanded by the Aether Vault + Skyfall specs: BOTH modes resolve
   every fight through resolveLineBattle()/resolveTwoWaveBattle() below, so
   the client can never invent an outcome. This v1 is a deterministic
   round-based QUALIFICATION ESTIMATE. Stat RESOLUTION follows the client's formulas; the battle itself is a simplified line model — it is never a replay of a client battle
   (baseAtLevel(base,level) × starMult + glyph bonuses — see ROLE_GROWTH) but simplifies the
   moment-to-moment combat (no positioning/FX). Swapping in the full 30 Hz
   extracted sim later means replacing ONLY the internals of
   resolveLineBattle(); every caller keeps working.
   Deterministic: same inputs + same seed → byte-identical result. No
   Date.now(), no Math.random() — mulberry32 only, stable iteration order.
   ========================================================================== */
'use strict';

// ---- base stat table (extracted from the client's HERO_TYPES, 26 Aug 2026 v209) ----
const HERO_BASE={
  // --- 4 Sep 2026: the 20 roster heroes wired client-side in v380-v398. Without these the
  // server silently skipped them everywhere it does `if(!SIM.HERO_BASE[k]) continue`, so they
  // could never be unlocked, summoned or granted - the dev panel's Unlock-all did nothing. ---
  yenna:{swing:1.8,hp:245,dmg:36,apow:0,role:'Marksman',stars:1,healer:false,atkSpeed:1.0},
  calypsa:{swing:1.8,hp:240,dmg:36,apow:24,hybrid:true,role:'Marksman',stars:2,healer:false,atkSpeed:1.1},
  sorrel:{swing:1.9,hp:230,dmg:40,apow:0,role:'Assassin',stars:1,healer:false,atkSpeed:0.95},
  brannus:{swing:1.8,hp:560,dmg:26,apow:0,role:'Tank',stars:3,healer:false,atkSpeed:1.0},
  deepcleft:{swing:1.8,hp:400,dmg:36,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:0.95},
  askel:{swing:1.8,hp:620,dmg:24,apow:0,role:'Tank',stars:3,healer:false,atkSpeed:0.9},
  tharl:{swing:1.8,hp:600,dmg:26,apow:0,role:'Tank',stars:3,healer:false,atkSpeed:0.95},
  kharos:{swing:1.8,hp:275,dmg:46,apow:0,role:'Assassin',stars:3,healer:false,atkSpeed:1.25},
  hobb:{swing:1.8,hp:370,dmg:40,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:1.0},
  lysara:{swing:1.8,hp:195,dmg:16,apow:32,role:'Mage',stars:2,healer:false,atkSpeed:0.95},
  nerisse:{swing:1.8,hp:215,dmg:14,apow:30,role:'Support',stars:2,healer:true,atkSpeed:0.95},
  nox:{swing:1.8,hp:245,dmg:40,apow:0,role:'Assassin',stars:2,healer:false,atkSpeed:1.2},
  orryn:{swing:1.8,hp:195,dmg:18,apow:34,role:'Mage',stars:3,healer:false,atkSpeed:1.05},
  pellucid:{swing:1.8,hp:580,dmg:25,apow:0,role:'Tank',stars:3,healer:false,atkSpeed:0.95},
  seyla:{swing:1.8,hp:255,dmg:39,apow:0,role:'Assassin',stars:2,healer:false,atkSpeed:1.15},
  linnet:{swing:1.6,hp:220,dmg:14,apow:31,role:'Support',stars:2,healer:true,atkSpeed:1.15},
  vaelora:{swing:1.8,hp:230,dmg:16,apow:32,role:'Mage',stars:3,healer:true,atkSpeed:1.0},
  mirelle:{swing:1.8,hp:250,dmg:16,apow:32,role:'Support',stars:3,healer:true,atkSpeed:1.25},
  veyr:{swing:1.8,hp:310,dmg:44,apow:34,role:'Assassin',stars:3,healer:false,atkSpeed:1.2},
  zahri:{swing:1.8,hp:320,dmg:44,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:1.05},

  konwu:{swing:1.9,hp:380,dmg:34,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:1.15},
  grosk:{swing:2.6,hp:620,dmg:18,apow:0,role:'Tank',stars:3,healer:false,atkSpeed:0.85},
  vulmar:{swing:2,hp:175,dmg:26,apow:30,role:'Mage',stars:3,healer:false,atkSpeed:0.85},   // v484: Vulmar gets Ability Power (casters scale off AP now)
  tick:{swing:2.2,hp:360,dmg:34,apow:0,role:'Bruiser',stars:1,healer:false,atkSpeed:1.1},
  sylthaine:{swing:2,hp:150,dmg:14,apow:32,role:'Mage',stars:1,healer:false,atkSpeed:0.85},
  aureth:{swing:1.8,hp:460,dmg:24,apow:24,role:'Bruiser',stars:3,healer:false,atkSpeed:0.9},
  bloatus:{swing:2.4,hp:540,dmg:24,apow:28,role:'Tank',stars:3,healer:false,atkSpeed:0.9},
  vireo:{swing:2,hp:220,dmg:16,apow:30,role:'Support',stars:1,healer:true,atkSpeed:0.9},
  fritz:{swing:1.8,hp:320,dmg:22,apow:30,role:'Mage',stars:2,healer:false,atkSpeed:1,armor:60,mr:90},
  umbris:{swing:2,hp:170,dmg:22,apow:32,role:'Mage',stars:3,healer:false,atkSpeed:0.85},
  vael:{swing:2.3,hp:400,dmg:30,apow:0,role:'Bruiser',stars:1,healer:false,atkSpeed:0.95},
  oakmir:{swing:2,hp:230,dmg:16,apow:32,role:'Support',stars:3,healer:true,atkSpeed:0.85},
  rhukk:{swing:2.4,hp:430,dmg:26,apow:0,role:'Bruiser',stars:2,healer:false,atkSpeed:0.9},
  hurne:{swing:2.5,hp:520,dmg:32,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:0.9},
  meridian:{swing:2,hp:200,dmg:34,apow:0,role:'Marksman',stars:3,healer:false,atkSpeed:1},
  gruel:{swing:2.6,hp:560,dmg:26,apow:0,role:'Tank',stars:1,healer:false,atkSpeed:0.85},
  astra:{swing:2,hp:180,dmg:16,apow:34,role:'Mage',stars:2,healer:false,atkSpeed:0.85},
  quorrel:{swing:2.2,hp:450,dmg:28,apow:0,role:'Bruiser',stars:2,healer:false,atkSpeed:1},
  korvux:{swing:2.3,hp:430,dmg:32,apow:0,role:'Bruiser',stars:2,healer:false,atkSpeed:0.95},
  maren:{swing:2.2,hp:300,dmg:16,apow:30,role:'Mage',stars:2,healer:false,atkSpeed:0.85},
  lumi:{swing:2,hp:210,dmg:14,apow:30,role:'Support',stars:2,healer:true,atkSpeed:0.9},
  hollow:{swing:1.7,hp:360,dmg:36,apow:0,role:'Assassin',stars:3,healer:false,atkSpeed:1.2},
  rivet:{swing:1.8,hp:380,dmg:30,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:1},
  carn:{swing:2.4,hp:410,dmg:34,apow:0,role:'Bruiser',stars:1,healer:false,atkSpeed:1.05},
  vesper:{swing:2,hp:190,dmg:16,apow:32,role:'Mage',stars:2,healer:false,atkSpeed:0.85},
  tessit:{swing:2,hp:200,dmg:15,apow:31,role:'Support',stars:2,healer:false,atkSpeed:0.85},
  vex:{swing:1.8,hp:320,dmg:34,apow:0,role:'Assassin',stars:1,healer:false,atkSpeed:1.15},
  grimsby:{swing:2.2,hp:360,dmg:28,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:0.85},
  dandra:{swing:2,hp:200,dmg:12,apow:30,role:'Support',stars:1,healer:true,atkSpeed:0.9},
  /* v332 — new heroes */
  pyroclast:{swing:2,hp:185,dmg:16,apow:34,role:'Mage',stars:2,healer:false,atkSpeed:0.85},
  iver:{swing:2.3,hp:440,dmg:30,apow:0,role:'Bruiser',stars:2,healer:false,atkSpeed:1.0},
  sloe:{swing:2,hp:210,dmg:32,apow:0,role:'Marksman',stars:2,healer:false,atkSpeed:1.0},
  absalie:{swing:2,hp:175,dmg:18,apow:36,role:'Mage',stars:3,healer:false,atkSpeed:0.85},
  joss:{swing:2.5,hp:580,dmg:24,apow:20,role:'Tank',stars:3,healer:false,atkSpeed:0.9},
  ambrel:{swing:2.6,hp:620,dmg:20,apow:26,role:'Tank',stars:3,healer:false,atkSpeed:0.85},
  tolley:{swing:2.4,hp:470,dmg:34,apow:0,role:'Bruiser',stars:3,healer:false,atkSpeed:0.95},
  mellan:{swing:2,hp:230,dmg:14,apow:32,role:'Support',stars:2,healer:true,atkSpeed:0.9},
  aldren:{swing:2.1,hp:200,dmg:16,apow:34,role:'Mage',stars:3,healer:false,atkSpeed:0.85},
  rafe:{swing:2,hp:220,dmg:33,apow:0,role:'Marksman',stars:2,healer:false,atkSpeed:1.05},
  ceraline:{swing:2,hp:190,dmg:17,apow:35,role:'Mage',stars:3,healer:false,atkSpeed:0.85}
};
/* v1311: heroes whose purple passive is FURY (client KITS[key].purple.pass==='fury') -> the attack-speed fraction per skillMul.
   The server has no kit table, so this mirrors it; tests/test_power_terms_1311.js checks it against the client KITS. */
const PURPLE_FURY={quorrel:0.25, carn:0.25};
const HERO61=require('../hero61.js');
HERO_BASE.hero61=Object.assign({},HERO61.BASE);
const HERO_PROFILES=require('../hero-profiles.js');
for(const key of Object.keys(HERO_BASE)){
  const p=HERO_PROFILES[key];
  if(!p) throw new Error('Missing canonical hero profile: '+key);
  Object.assign(HERO_BASE[key],p,{role:p.class,row:p.combatRow});
}
if(Object.keys(HERO_PROFILES).length!==Object.keys(HERO_BASE).length) throw new Error('Canonical hero profile count mismatch');
/* v364: base Armor / Magic Resist by role — the SAME table and defaulting as the client's ROLE_BASE_DEF
   (emberweave-heroes.html, right after HERO_TYPES). Authored values (Fritz 60/90) are kept. */
const ROLE_BASE_DEF={ Tank:{armor:60,mr:40}, Bruiser:{armor:40,mr:30}, Assassin:{armor:25,mr:20},
  Marksman:{armor:22,mr:22}, Mage:{armor:15,mr:22}, Support:{armor:22,mr:22} };   /* v1022 (Phil 4 Oct: squishies "certainly shouldnt be tanky"): Mage mr 40 -> 22, Support 38 -> 22 (40 is the Tank base) */
for(const k in HERO_BASE){ const t=HERO_BASE[k], d=ROLE_BASE_DEF[t.role]||ROLE_BASE_DEF.Bruiser; if(t.armor==null) t.armor=d.armor; if(t.mr==null) t.mr=d.mr; }
const STAR_PIPS=5, MAX_STARS=5;   // v1369: no star multiplier any more - stars add FLAT stats (starFlatFrom below)
const ROLE_FRONT_ORDER={Tank:0,Bruiser:1,Assassin:2,Marksman:3,Mage:4,Support:5,Control:5};

// ---- deterministic PRNG (same mulberry32 the client uses) ----
const CORE=require('./combat-core.js');   // v242: ONE typed deterministic combat model for every battle authority
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a);
  t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function seedFrom(str){ // FNV-1a → uint32; stable across processes
  let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193); } return h>>>0; }

/* v1369 STAR TRACK (Phil 11 Nov 2026: "the first 5 bronze is 100%, after 5 star the 6th Star unlocks, you can get the bronze 6th star" /
   "after that you can change all the stars to silver, but it takes 6 total pips" / "then again 6 pips of gold" / "then again 6 total pips for
   mythical"; chances "50, 35, 20, 10"; costs "50,70,90,110"; "make sure the stats they gain is flat, not percentage" / "should be pretty much
   Attack damage, Ability power, health" / "All flat damage" / armor + MR: "yes add it" / "first 5 stars should be like 1k HP 100 attack damage and ability power" /
   "lets go 1000, 1500, 2500, 3500, 5000").
   "I guess this means the silver, gold, mythical stars will be only 5 pips".
   Stars 1-5 (star-up pips) and the star track (led.hero[k].ref = STEP 0..16: 1 = the bronze 6th star; 2-6 turn the five stars silver left to
   right, 7-11 gold, 12-16 mythical) add FLAT Health / Attack damage / Ability power / Armor / Magic resist - no multiplier anywhere. The tables are the CUMULATIVE
   totals (1★ = 200/20/20); linear across the pips / steps inside a stage. They go in beside gear flats (R.hpFlat / atkFlat / apowFlat).
   Mirrors the client's STAR_FLAT / REFINE_TIERS in emberweave-heroes.html exactly (ONE POWER). Phil's numbers 11 Nov - he may retune. */
const STAR_FLAT=[ {hp:240,atk:24,apow:24,armor:24,mr:24}, {hp:480,atk:48,apow:48,armor:48,mr:48}, {hp:720,atk:72,apow:72,armor:72,mr:72}, {hp:960,atk:96,apow:96,armor:96,mr:96}, {hp:1200,atk:120,apow:120,armor:120,mr:120} ];   // 1★..5★ totals (240 HP / 24 atk / 24 AP / 24 armor / 24 MR a star; Phil "increase the power slightly then" = +20%)
const REFINE_TIERS=[
  {tier:'bronze',  steps:1, cost:50,  chance:0.50, done:{hp:1800,atk:180,apow:180,armor:180,mr:180}},    // the bronze 6th star
  {tier:'silver',  steps:5, cost:70,  chance:0.35, done:{hp:3000,atk:300,apow:300,armor:300,mr:300}},
  {tier:'gold',    steps:5, cost:90,  chance:0.20, done:{hp:4200,atk:420,apow:420,armor:420,mr:420}},
  {tier:'mythical',steps:5, cost:110, chance:0.10, done:{hp:6000,atk:600,apow:600,armor:600,mr:600}} ];
const STAR_FLAT_KEYS=['hp','atk','apow','armor','mr'];   // Phil 11 Nov: "yes add it" - flat Armor and Magic resist join HP / atk / AP
const REFINE_START=REFINE_TIERS.reduce((a,t,i)=>(a.push(i?a[i-1]+REFINE_TIERS[i-1].steps:0),a),[]);   // [0,1,6,11]
const REFINE_MAX=REFINE_START[REFINE_START.length-1]+REFINE_TIERS[REFINE_TIERS.length-1].steps;          // 16
const REFINE_TRACK_V=2;                              // led.refTrack: ledgers on this track (old ref 0-15 = middle-star refine, migrated once)
function refineClamp(r){ return Math.max(0,Math.min(REFINE_MAX,r|0)); }
function refineTierIndex(lvl){ lvl=refineClamp(lvl); for(let i=0;i<REFINE_TIERS.length;i++) if(lvl<REFINE_START[i]+REFINE_TIERS[i].steps) return i; return -1; }
function refineTierAt(lvl){ const i=refineTierIndex(lvl); return i<0?null:REFINE_TIERS[i]; }   // the tier the NEXT try works on (null = fully upgraded)
/* the flat Health / Attack damage / Ability power a hero's stars give (whole numbers) */
function starFlatFrom(stars,pips,ref){ const lv=Math.max(1,Math.min(MAX_STARS,stars|0)), p=Math.max(0,Math.min(STAR_PIPS,pips|0)), r=refineClamp(ref);
  const lerp=(a,b,f)=>{ const o={}; for(const k of STAR_FLAT_KEYS) o[k]=Math.round(a[k]+(b[k]-a[k])*f); return o; };
  if(lv<MAX_STARS) return lerp(STAR_FLAT[lv-1],STAR_FLAT[lv],p/STAR_PIPS);
  if(r<=0) return lerp(STAR_FLAT[MAX_STARS-1],STAR_FLAT[MAX_STARS-1],0);
  for(let i=0;i<REFINE_TIERS.length;i++){ const T=REFINE_TIERS[i], end=REFINE_START[i]+T.steps;
    if(r<=end) return lerp(i?REFINE_TIERS[i-1].done:STAR_FLAT[MAX_STARS-1], T.done, (r-REFINE_START[i])/T.steps); }
  return lerp(REFINE_TIERS[REFINE_TIERS.length-1].done,REFINE_TIERS[REFINE_TIERS.length-1].done,0); }
/* old middle-star refine (0-15: 1-5 bronze, 6-10 silver, 11-15 gold) -> a step on the new track; nobody loses tier progress
   (old 5 -> 1 bronze 6th star, old 10 -> 6 silver done, old 15 -> 11 gold done) */
function refineFromOld(r){ r=Math.max(0,Math.min(15,r|0)); if(r<=0) return 0; if(r<=5) return 1;
  if(r<=10) return 1+(r-5); return 6+(r-10); }

/* Resolve one hero's server-owned combat stats.
   opts: { level, stars, pips, glyph:{hp,atk,heal}, dr, crit, critRes, energyReg } — server-derived.
   v225 (re-audit): units carry the client's combat fields — dr (fractional damage reduction, capped
   0.6 at apply time), crit (extra crit CHANCE), critRes (reduces crit BONUS damage, client rule),
   energyReg (fractional bonus to energy gain). The resolver applies them with the client's rules:
   crit multiplier 1.6×, critRes subtracts from the bonus (1+max(0,0.6−critRes), Academy v2 11 Oct), DR multiplies incoming
   damage under a 0.6 cap. The sim is still a simplified line resolver, not a replay of the full
   client battle (kits, positioning, manual timing), and is labeled as such where it gates results. */
/* v401 (4 Sep) — PER-CLASS FLAT GROWTH. This table is the SINGLE SOURCE OF TRUTH shared with the
   client (emberweave-heroes.html ROLE_GROWTH); the two MUST stay identical or server and client
   disagree about how strong a hero is. Prior to v401 this file grew HP/ATK at 0.18/level while the
   client grew at 0.05/level — a 3.2x divergence at level 100 hidden behind a comment claiming they
   matched. Growth is FLAT PER LEVEL, not a multiplier: every class gains every stat, but gains most
   in its own (Phil: "the classes arent just one stat. they gain all stats. but each class gains
   more of their specific stat"). Star multiplier still multiplies the level-adjusted base. */
const ROLE_GROWTH={
  Tank    :{hp:34,dmg:0.6,apow:0.3,armor:12,mr:8},
  Bruiser :{hp:34,dmg:1.75,apow:0.4,armor:8, mr:6},
  Assassin:{hp:25,dmg:3.0,apow:0.3,armor:5, mr:4},
  Marksman:{hp:23,dmg:2.2,apow:0.4,armor:4, mr:4},
  Support :{hp:23,dmg:0.5,apow:1.0,armor:4, mr:4},
  Mage    :{hp:23,dmg:0.6,apow:0.5,armor:1, mr:4} };   /* v1020 (Phil 4 Oct: mages too strong) apow 2.0 -> 0.5; Phil 4 Oct "they certainly shouldnt be tanky": Mage mr 8 -> 4, Support 7 -> 4 (the Marksman/Assassin rate; 8 is the Tank rate) */
/* v1019 (Phil 4 Oct: "magic tanks should have about 18k hp, melee tanks about 22k" - glyphs and base stats, at max): a Tank's HP growth per level depends on its damage profile. MUST stay identical in emberweave-heroes.html and server/sim.js. */
const TANK_HP_GROWTH={Attack:70, Magic:54};
/* Returns a COPY of the hero base with every stat advanced to `lvl`. Heroes whose role is missing
   from the table fall back to the old 0.05/level multiplier so nothing can resolve to null. */
function baseAtLevel(b,lvl){
  const n=Math.max(0,((lvl|0)||1)-1), g=b.growth||ROLE_GROWTH[b.role];
  const o=Object.assign({},b);
  if(!g){ const s=1+0.05*n;
    o.hp=(b.hp||0)*s; o.dmg=(b.dmg||0)*s; o.apow=(b.apow||0)*s; o.armor=(b.armor||0)*s; o.mr=(b.mr||0)*s; return o; }
  const gh=(b.role==='Tank'&&TANK_HP_GROWTH[b.damageProfile]!=null)?TANK_HP_GROWTH[b.damageProfile]:g.hp;
  o.hp=(b.hp||0)+gh*n; o.dmg=(b.dmg||0)+g.dmg*n; o.apow=(b.apow||0)+g.apow*n;
  o.armor=(b.armor||0)+g.armor*n; o.mr=(b.mr||0)+g.mr*n; return o;
}

function heroCombatStats(key, opts){
  const b=HERO_BASE[key]; if(!b) return null;
  opts=opts||{};
  const level=Math.max(1,Math.min(200,(opts.level|0)||1));
  const stars=(opts.stars|0)||b.stars, pips=(opts.pips|0)||0, ref=refineClamp(opts.ref);
  // v1369 (Phil: "All flat damage"): no star multiplier - stars and the star track are FLAT stats (starFlatFrom), added to the ratings below
  const bl=baseAtLevel(b,level);
  const mul=1, defScale=1;
  // v242: RAW TYPED RATINGS in (snapshotHeroFromServer), typed core unit out. Legacy callers that
  // still pass {glyph:{hp,atk,apow,heal}} get those as flats with no ratings.
  let R=opts.ratings || (opts.glyph?{hpFlat:opts.glyph.hp|0,atkFlat:opts.glyph.atk|0,apowFlat:opts.glyph.apow|0,healFlat:opts.glyph.heal|0}:{});
  const SF=starFlatFrom(stars,pips,ref); R=Object.assign({},R,{ hpFlat:(R.hpFlat||0)+SF.hp, atkFlat:(R.atkFlat||0)+SF.atk, apowFlat:(R.apowFlat||0)+SF.apow });   // v1369: star flats, beside gear
  const EX=Object.assign({level:level, gearSkillSlot:opts.gearSkillSlot||null, gearSkill:opts.gearSkill||null}, opts.extra||{});
  EX.armorRating=(EX.armorRating||0)+SF.armor; EX.mrRating=(EX.mrRating||0)+SF.mr;   // v1369: star Armor / MR are flat RATING points (x1, like Academy armor), not glyph points (x3)
  const u=CORE.buildUnit(key, bl, mul, defScale, R, EX);
  u.level=level;
  /* v726 - the star rating travels with the unit. heroCombatStats knows it (it is what builds the
     star multiplier) but was throwing it away, and the war log needs it to draw a hero card with
     the right ascension frame. */
  u.stars=stars; u.pips=pips;
  /* v1311 (Phil 8 Nov: "1. yes" - the purple FURY passive applies in server battles and counts in power): the client's makeUnit
     divides the swing timer by (1+0.25*skillMul(passive level)) once the hero's quality rank is 3 (Purple); the core's attack
     speed is the inverse of that timer, so the same factor multiplies `speed`. opts.rank = quality tier 0..3 (G2_TIER16 of the
     glyph ascension index); callers that pass no rank (NPC ladder, Vault specs) are unchanged. */
  const rank=opts.rank|0;
  if(rank>=3 && PURPLE_FURY[key]) u.speed*=1+PURPLE_FURY[key]*CORE.skillMul(u.skillLv[3]);
  // legacy aliases: scores (vaultTeamScore), plausibility gates, and views read these
  u.atk=Math.max(u.atkP,u.atkM);
  u.dr=(CORE.defToDR(u.armor,level)+CORE.defToDR(u.mr,level))/2;
  return u;
}
function defToDR(flatDef,lvl){ return flatDef>0 ? flatDef/(flatDef+CORE.defK(lvl==null?1:lvl)) : 0; }   // v401: level-aware, mirrors the client

/* Build a battle line from resolved stats + optional carried state.
   snaps: [heroCombatStats...] (≤5) · carry: [{hp,energy}] aligned or null */
function makeLine(snaps, carry, capToEntry){
  const coerced=snaps.filter(Boolean).slice(0,5).map(s2=>{
    if(s2.atkP!==undefined) return s2;                                  // already a typed core unit
    // legacy line-model unit (old fixtures/tests): map onto the typed model without changing power
    return Object.assign({}, s2, { atkP:s2.atk|0, atkM:0,
      armor:s2.defRating||0, mr:s2.defRating||0, armorPen:s2.pen|0, magicPen:s2.pen|0,
      critDmg:0.6, dmgBonus:1, dmgRed:Math.min(0.6,s2.dr||0),           // legacy composite dr rides as flat reduction
      lifesteal:0, eva:0, acc:0, block:0, haste:1, shieldStr:1, ctrlHit:0,
      kit:CORE.KITS[s2.key]||{kind:s2.healer?'heal':'phys',shape:'nuke',coef:2.2,who:'allies'} }); });
  return CORE.lineUp(coerced, carry, capToEntry);
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

module.exports={ HERO_BASE, HERO_PROFILES, PURPLE_FURY, mulberry32, seedFrom, heroCombatStats, makeLine, resolveLineBattle, resolveTwoWaveBattle, lineState, qualificationEstimate: resolveTwoWaveBattle, CORE,
  STAR_FLAT, STAR_FLAT_KEYS, REFINE_TIERS, REFINE_START, REFINE_MAX, REFINE_TRACK_V, refineClamp, refineTierIndex, refineTierAt, starFlatFrom, refineFromOld };   // qualificationEstimate = the honest name: a line-model ESTIMATE for gating/qualification, not a battle replay

