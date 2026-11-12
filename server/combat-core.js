/* ============================== EMBERWEAVE SHARED COMBAT CORE ==============================
   v242 (full-game audit P0): ONE deterministic combat model with REAL damage types.

   - PHYSICAL and MAGICAL damage are separate. A physical hit is mitigated by the target's ARMOR
     rating, a magical hit by the target's MAGIC RESIST rating — each through the same diminishing
     curve defToDR(r) = r/(r+1200), and each countered ONLY by its own penetration
     (armorPen vs armor, magicPen vs MR). Penetration re-runs the curve with (rating − pen): it
     never adds raw damage and does nothing against a target with no rating.
   - ABILITY POWER scales SPELLS ONLY (the atkM line, used by magical kits and heals);
     PHYSICAL ATTACK scales basic attacks and physical kits ONLY (the atkP line).
   - Universal survival stats: HP, Armor, MR. Real handling for crit (chance + crit damage +
     crit resist), attack speed (extra swings), haste (faster energy), energy regen, lifesteal,
     evasion vs accuracy, block (physical only), damage bonus / damage reduction, shield strength,
     healing power, HP regen, control hit vs tenacity (stun rounds).
   - Every hero has an authored KIT (its ultimate, typed and shaped); the resolver emits a full
     EVENT LOG [round, side, key, verb, target, amount, ultFlag, kind, critFlag] that a client can
     animate — the server result is derived from that log and nothing else.
   - Deterministic: one mulberry32 stream per battle, every roll consumed unconditionally where
     branching would change stream length.
   ============================================================================================ */
'use strict';

function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
function seedFrom(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
/* v401 (4 Sep): LEVEL-AWARE mitigation. Phil: "mitigation reduces per level. so 60 armor at
   level 1 maybe is 4.8% mitigation but at level 2 should be like 4.7". The constant K grows with
   the defender's level, so a fixed rating is worth steadily less %DR as levels climb — this is
   what keeps a level-100 tank from becoming unkillable. MIRRORS the client's defK() exactly. */
const DEF_K_BASE=1200, DEF_K_PER_LV=17.4;
function defK(lvl){ return DEF_K_BASE + DEF_K_PER_LV*Math.max(0,((lvl|0)||1)-1); }
function defToDR(r,lvl){ return r>0 ? r/(r+defK(lvl==null?1:lvl)) : 0; }

/* ---- rating→fraction conversions (points from glyphs/gear are RATINGS; these are the only
        places they become percentages, shared by every battle authority) ---- */
const CONV={
  critPerPt:0.0005, critCap:0.6,           // Crit Chance - v1020 (Phil 4 Oct): 20 crit = 1%
  critDmgPerPt:0.0005,                     // Crit Damage: adds to the 0.6 crit BONUS - v1020 (Phil 4 Oct): every rating stat is 20 points = 1%
  critResPerPt:0.0005, critResCap:0.75,     // Academy v2 (11 Oct): SUBTRACTS from the attacker's crit damage % (+60% vs 10% = +50%)
  defensePerPt:0.0005, defenseCap:0.6,      // Academy v2 (11 Oct): Defense rating - subtracts from the attacker's crit CHANCE (30% vs 10% = 20%)
  defPtMul:3,                              // glyph Armor/MR points → defense rating
  evaPerPt:0.0005, evaCap:0.30,             // Evasion (chance to dodge), countered by Accuracy pts
  blockPerPt:0.0005, blockCap:0.30,         // Block halves a PHYSICAL hit
  lifestealPerPt:0.0005, lifestealCap:0.5,
  dmgBonusPerPt:0.0005,
  dmgRedPerPt:0.0005, dmgRedCap:0.30,
  atkSpdPerPt:0.0005,                      // Attack Speed points speed the swing timer - v1020 (Phil 4 Oct): 20 = 1%
  hastePerPt:0.0005,                        // Haste speeds energy gain
  mobilityPerPt:0.001, mobilityCap:0.30,    // Forge Move Speed / Range: 100 pts = 10%
  shieldStrPerPt:0.0005,
  ctrlHitPerPt:0.0005,                      // Control Hit: raises stun chance
  ctrlResPerPt:0.0005, ctrlResCap:0.6,      // Tenacity/Control Resist: shrinks stun duration/chance
  energyPer100:1                            // 100 Energy Regen rating = +1 energy/second
};

/* ---- authored hero kits: the ultimate each hero fires at 100 energy.
   kind: 'phys' scales off atkP, 'magic' off atkM, 'heal'/'shieldTeam' off atkM (healer lines),
   'hybrid' fires both lines at half weight. shape: nuke (first alive), lowest (weakest foe),
   aoe (up to n foes), cleave (first 2). stun: rounds of lost actions on the struck target(s). ---- */
const KITS={
  /* v527 — the 31 design-pack heroes. The server authors ONLY the ultimate, so each of these is
     the closest honest shape for what the pack's ult does; anything the client's A1/A2 do is not
     modelled here and never was. Without these they all fell through to DEFAULT_KIT. */
  pyroclast:   {kind:'magic', shape:'aoe',    coef:1.45, n:3},                 // Crownfire
  iver: {kind:'phys',  shape:'aoe',    coef:1.35, n:3, stun:1},         // Skybreak
  sloe:{kind:'phys',  shape:'aoe',    coef:1.35, n:3},                 // Emerald Volley
  absalie:  {kind:'magic', shape:'aoe',    coef:1.40, n:3, stun:1},         // Event Horizon
  joss: {kind:'magic', shape:'aoe',    coef:1.20, n:3, stun:1},         // Daybreak Judgment
  ambrel:   {kind:'magic', shape:'aoe',    coef:1.15, n:3, stun:1},         // Divine Mass
  tolley: {kind:'phys',  shape:'aoe',    coef:1.40, n:3},                 // Living Forge
  mellan:   {kind:'heal',  who:'allies',   coef:1.25},                      // Hive Mind
  aldren:   {kind:'magic', shape:'aoe',    coef:1.10, n:3},                 // Final Volume (the summon is not modelled)
  rafe:     {kind:'phys',  shape:'aoe',    coef:1.35, n:3},                 // Dead Man's Fortune
  tharl:    {kind:'phys',  shape:'cleave', coef:2.20, n:2},                 // Avalanche Coil
  seyla:    {kind:'phys',  shape:'aoe',    coef:1.40, n:3},                 // Serpent's Last Dance
  askel:   {kind:'phys',  shape:'cleave', coef:2.10, n:2},                 // March of the Greatbrow
  mirelle:  {kind:'shieldTeam', pct:0.16},                                  // Imperial Plumage
  yenna:  {kind:'phys',  shape:'aoe',    coef:1.40, n:3},                 // Crescent Stampede
  deepcleft:   {kind:'phys',  shape:'aoe',    coef:1.45, n:3, stun:1},         // Quarry Collapse
  sorrel:  {kind:'phys',  shape:'nuke',   coef:2.50},                      // Grand Reveal (all cards into one)
  ceraline:{kind:'magic', shape:'aoe',    coef:1.35, n:3, stun:1},         // Court of the Final Candle
  brannus:  {kind:'phys',  shape:'cleave', coef:2.30, n:2},                 // Lionwheel Rampage
  linnet:  {kind:'heal',  who:'allies',   coef:1.35},                      // Rewrite the Pattern
  hobb:    {kind:'phys',  shape:'aoe',    coef:1.40, n:3, stun:1},         // Grand Kiln Shape
  veyr:        {kind:'phys',  shape:'aoe',    coef:1.45, n:3, stun:1},         // Abyssal Undertow (v1136, was Event Horizon)
  kharos:      {kind:'phys',  shape:'lowest', coef:3.00},                      // Orchid Execution
  orryn:       {kind:'magic', shape:'aoe',    coef:1.45, n:3},                 // Ocean Without Shore
  pellucid:    {kind:'phys',  shape:'aoe',    coef:1.50, n:3, stun:1},         // Worldbreaker Fists
  nox:         {kind:'magic', shape:'aoe',    coef:1.20, n:3, stun:1},         // Open Every Door
  lysara:      {kind:'magic', shape:'aoe',    coef:0.80, n:3, stun:1},         // Queen of Quiet Wings
  calypsa:     {kind:'phys',  shape:'aoe',    coef:1.40, n:3},                 // Thousand-Fin Tempest
  zahri:       {kind:'phys',  shape:'cleave', coef:2.30, n:2},                 // Noonday Stampede
  nerisse:     {kind:'magic', shape:'aoe',    coef:1.20, n:3, stun:1},         // Choir of the Deep Sky
  vaelora:     {kind:'magic', shape:'aoe',    coef:1.40, n:3, stun:1},         // Winter Plumage
  konwu:     {kind:'phys',  shape:'cleave', coef:2.4, n:2},
  grosk:     {kind:'shieldTeam', pct:0.22},
  vulmar:    {kind:'magic', shape:'aoe',   coef:1.5, n:3},
  tick:      {kind:'phys',  shape:'nuke',  coef:2.6},
  sylthaine: {kind:'magic', shape:'aoe',   coef:1.4, n:3, stun:1},
  aureth:    {kind:'hybrid',shape:'aoe',   coef:1.2, n:3},
  bloatus:   {kind:'magic', shape:'aoe',   coef:1.2, n:3},
  vireo:     {kind:'heal',  who:'allies',  coef:1.2},
  fritz:     {kind:'magic', shape:'aoe',   coef:1.5, n:3},
  umbris:    {kind:'magic', shape:'aoe',   coef:1.7, n:3},
  vael:      {kind:'phys',  shape:'cleave', coef:2.4, n:2},
  oakmir:    {kind:'heal',  who:'allies',  coef:1.1},
  rhukk:     {kind:'phys',  shape:'nuke',  coef:2.6},
  hurne:     {kind:'phys',  shape:'cleave', coef:2.3, n:2},
  meridian:  {kind:'phys',  shape:'lowest', coef:2.8},
  gruel:    {kind:'shieldTeam', pct:0.20},
  astra:     {kind:'magic', shape:'aoe',   coef:1.3, n:3, stun:1},
  quorrel:{kind:'phys',  shape:'nuke',  coef:2.5},
  korvux:     {kind:'phys',  shape:'cleave', coef:2.4, n:2},
  maren:    {kind:'magic', shape:'aoe',   coef:1.5, n:3},
  lumi:      {kind:'heal',  who:'allies',  coef:1.15},
  hollow:    {kind:'phys',  shape:'lowest', coef:3.0},
  rivet:  {kind:'phys',  shape:'nuke',  coef:2.5},
  carn:      {kind:'phys',  shape:'nuke',  coef:2.5},
  vesper:    {kind:'magic', shape:'nuke',  coef:3.0},
  tessit: {kind:'magic', shape:'aoe',   coef:1.0, n:3, stun:1},
  vex:       {kind:'phys',  shape:'lowest', coef:2.9},
  grimsby:   {kind:'phys',  shape:'nuke',  coef:2.5},
  dandra:    {kind:'heal',  who:'allies',  coef:1.1}
};
const DEFAULT_KIT={kind:'phys',shape:'nuke',coef:2.2};

/* ---- v1372 AFFINITIES (Phil 11 Nov 2026: "Support beats Tank * Tank beats Marksman * Marksman beats mage * mage beats bruiser * bruiser beats
   assasin * assasin beats support" / elements "each of these deal 20% more damage to the other type" / "and the one they beat does 20% less to
   them" / "neutral means does no extra damage and takes no extra" / "aureth should be both light and dark, he switches as he swaps stances").
   THE SERVER MIRROR of emberweave-heroes.html AFF_ELEMENT / ELEM_BEATS / ELEM_BONUS / CLASS_BEATS / EDGE / unitElement / elemMul / classEdge
   (blueprint 28). The tables are copies, like STAR_FLAT: tests/test_affinity_parity_1372.js fails the day either side drifts, and checks that
   this switch equals the client's AFFINITIES_LIVE. How each rule lands in this ROUND model (1 round = 1 second, the energy-regen unit):
   - elements: raw x elemMul(src,tgt) on every hit (applyDamage) - the client's `amt*=elemMul(src,tgt)` at the top of dealDamage.
   - Sundering grace (Support > Tank): the Tank's Armor / MR rating x0.5 before pen (client _defMulRaw rk=0.5); a unit whose front foe is a
     Tank heals x1.20 while a Support is alive on its side (client healUnit: u.target is a Tank) - heals and lifesteal (both go through healUnit).
   - Shield wall (Tank > Marksman): 25% of a Marksman's BASIC attacks on a Tank are blocked (one seeded roll, only for that pair). The +1 s taunt
     has nothing to act on here: this model has no taunt (a 'taunt' gear skill is a shield).
   - Interrupt (Marksman > Mage): -10 energy per landed hit.
   - Hex (Mage > Bruiser): a landed non-basic, non-physical hit: for 2 rounds the Bruiser's swings count x1/1.3 (energy and basic-attack damage -
     the client's attack interval x1.3). The 2 s slow is movement; this model has none.
   - Riposte (Bruiser > Assassin): an Assassin's landed hit draws the Bruiser's basic attack straight back (no variance, like the client's
     dealDamage(tgt,src,tgt.dmg)), at most once per 3 rounds, never while the Bruiser is stunned; after the hit, before the Assassin's lifesteal.
   - Silence the healer (Assassin > Support): heals on the Support x0.6 for 4 rounds; the blow that lands strips its shield first (double damage).
   - Ally spacing (UNIT_GAP_ALLY 1.30) is positional: this model has no positions. Aureth fights in his Light stance here (no stance swap).
   AFFINITIES_LIVE=false is the v1367 engine, rule for rule. */
const AFFINITIES_LIVE=true;   /* MUST equal emberweave-heroes.html AFFINITIES_LIVE (tests/test_affinity_parity_1372.js) */
const AFF_ON=AFFINITIES_LIVE&&process.env.EW_AFFINITIES_OFF!=='1';   /* tests only: comparisons against older engines load a fresh copy with it off; the server never sets it */
const AFF_ELEMENT={"konwu":"Neutral","grosk":"Water","vulmar":"Neutral","tick":"Lightning","sylthaine":"Ice","aureth":"Light","bloatus":"Nature","vireo":"Neutral","fritz":"Lightning","umbris":"Dark","vael":"Neutral","oakmir":"Nature","rhukk":"Neutral","hurne":"Nature","meridian":"Neutral","gruel":"Neutral","astra":"Fire","quorrel":"Neutral","korvux":"Fire","maren":"Water","lumi":"Light","hollow":"Dark","veyr":"Water","mirelle":"Nature","pellucid":"Fire","orryn":"Water","hobb":"Fire","tharl":"Ice","askel":"Neutral","deepcleft":"Neutral","brannus":"Neutral","sorrel":"Dark","yenna":"Dark","kharos":"Nature","zahri":"Light","vaelora":"Ice","seyla":"Nature","nox":"Dark","nerisse":"Water","lysara":"Nature","calypsa":"Water","linnet":"Neutral","rivet":"Lightning","carn":"Neutral","vesper":"Dark","tessit":"Light","vex":"Neutral","grimsby":"Neutral","dandra":"Nature","pyroclast":"Fire","iver":"Lightning","sloe":"Nature","absalie":"Dark","joss":"Light","ambrel":"Light","tolley":"Fire","mellan":"Nature","aldren":"Dark","rafe":"Neutral","ceraline":"Fire","hero61":"Neutral","zahri mirage":"Light","boar warrior":"Neutral","boar shaman":"Fire","skarrn":"Nature","skulk":"Neutral","volthex":"Light","cindertusk":"Fire","ashen":"Fire","sludgemaw":"Nature","gnashul":"Neutral","bitwraith":"Dark","grundle":"Neutral","vexmite":"Nature","lost soul":"Dark","trapjaw":"Neutral","grushak":"Neutral","blackquill":"Dark","granith":"Neutral","nightgloom":"Dark","mordath":"Neutral","ooznik":"Nature","bilewretch":"Nature","rustclank":"Neutral","shellwark":"Neutral","whisp":"Fire","wintercrag":"Ice","magmourn":"Fire","voraxis":"Neutral","grommash":"Neutral","leviath":"Water","sylphice":"Water","cinder skulk":"Fire","furnace gnawer":"Fire","sootwing imp":"Fire","basalt mauler":"Fire","magma hound":"Fire","crucible acolyte":"Fire","reef prowler":"Water","kelp hexer":"Water","shellguard sentinel":"Water","mudsnap crab":"Water","storm eel":"Lightning","saltglass siren":"Lightning","graveclaw ghoul":"Dark","wispweaver shade":"Dark","bonepike guard":"Dark","rotbloom ooze":"Nature","nightcap mimic":"Nature","mourn moth":"Nature","riftling spider":"Dark","crystalhorn grazer":"Neutral","skyroot dryad":"Nature","luminant orb":"Light","zephyr harrier":"Neutral","runic automaton":"Neutral","ironjaw raider":"Neutral","vineback boar":"Nature","frostjaw troll":"Ice","clockwork lantern":"Light","vharok":"Fire","nerissa":"Water","barrowmaw":"Dark","asterion":"Light","maelvara":"Lightning","brukk":"Fire","nymira":"Nature","irix":"Neutral","hourglass sentinel":"Neutral","miregor":"Nature","sable vesper":"Dark","orryx":"Neutral","thorneveil":"Nature","nameless admiral":"Water","ink spirit":"Dark","ink horror":"Dark"};
const ELEM_BEATS={Water:'Fire',Fire:'Ice',Ice:'Nature',Nature:'Lightning',Lightning:'Water'};
const ELEM_BONUS=0.20;
const CLASS_BEATS={Support:'Tank',Tank:'Marksman',Marksman:'Mage',Mage:'Bruiser',Bruiser:'Assassin',Assassin:'Support'};
const EDGE={ armorIgnore:0.5, healBonus:0.20, block:0.25, tauntPlus:1, drain:10, hexDur:2, hexAtk:1.3, hexMove:0.80, riposteCd:3, healCut:0.40, healCutDur:4 };
/* the core never damages its own side (applyDamage is always foe -> foe), so the client's team test is src!==tgt here; a `side` tag wins when present */
const _sameSide=(s,t)=>s===t||(s.side!=null&&s.side===t.side);
function unitElement(u){ if(!u) return 'Neutral'; if(u.key==='aureth') return u._darkStance?'Dark':'Light'; return u.element||AFF_ELEMENT[u.key]||'Neutral'; }
function unitClass(u){ return (u&&u.role)||''; }
function elemMul(src,tgt){ if(!AFF_ON||!src||!tgt||_sameSide(src,tgt)) return 1; const a=unitElement(src), d=unitElement(tgt);
  if(a==='Neutral'||d==='Neutral') return 1;
  if((a==='Light'&&d==='Dark')||(a==='Dark'&&d==='Light')) return 1+ELEM_BONUS;
  if(ELEM_BEATS[a]===d) return 1+ELEM_BONUS; if(ELEM_BEATS[d]===a) return 1-ELEM_BONUS; return 1; }
function classEdge(src,tgt){ if(!AFF_ON||!src||!tgt||_sameSide(src,tgt)) return ''; const a=unitClass(src); return (a&&CLASS_BEATS[a]===unitClass(tgt))?a:''; }
/* the two heal edges (client healUnit): the battle's lines, set by resolveBattle for its own run */
let AFF_CTX=null;
function affHealMul(u, side, round, ctx){ let m=1; ctx=ctx||AFF_CTX;   /* ctx {a,b}: the two lines (resolveBattle's own by default) */
  if((u._healCutUntilR||0)>0 && round<u._healCutUntilR) m*=1-EDGE.healCut;   /* Silence the healer */
  if(AFF_ON && ctx && (side==='A'||side==='B')){ const own=side==='A'?ctx.a:ctx.b, foe=side==='A'?ctx.b:ctx.a, t=firstAlive(foe);
    if(t && unitClass(t)==='Tank' && own.some(o=>o.hp>0&&unitClass(o)==='Support')) m*=1+EDGE.healBonus; }   /* Sundering grace */
  return m; }

/* ---- typed unit builder. base: {hp,dmg,apow,armor,mr,role,healer,atkSpeed}; mul: level×star
   multiplier; r: RATINGS {hpFlat,atkFlat,apowFlat,healFlat, armor,mr,armorPen,magicPen, crit,
   critDmg,critRes, energy,startEnergy, regen, lifesteal,atkSpd,haste, eva,acc,block, dmgBonus,
   dmgRed, shieldStr, ctrlHit,ctrlRes, healPow, defense} (all raw points unless noted); defScale scales the
   BASE armor/mr like the client (1+0.05·(lvl−1))·starMult. ---- */
/* v1020 (Phil 4 Oct): class base crit chance - identical to emberweave-heroes.html CLASS_BASE_CRIT */
const CLASS_BASE_CRIT={Marksman:0.10, Assassin:0.10, Bruiser:0.03, Mage:0.02, Tank:0, Support:0};
function buildUnit(key, base, mul, defScale, r, extra){
  r=r||{}; extra=extra||{};
  const armor=(base.armor||0)*defScale + (r.armor||0)*CONV.defPtMul + (extra.armorRating||0);
  const mr=(base.mr||0)*defScale + (r.mr||0)*CONV.defPtMul + (extra.mrRating||0);
  const atkP=Math.round((base.dmg||0)*mul)+(r.atkFlat|0);
  // AP flats never create an ability line where none exists — a pure physical hero gains NOTHING from AP
  const atkM=Math.round(((base.apow||0)>0 ? Math.round(base.apow*mul)+(r.apowFlat|0) : 0)*(extra.apMul||1));   // Academy AP research scales spells only
  return {
    key, role:base.role||'Bruiser', healer:!!base.healer, level:Math.max(1,(extra.level|0)||1),
    maxHp:Math.round((base.hp||100)*mul)+(r.hpFlat|0),
    hp:0, energy:0,
    atkP, atkM,
    heal: base.healer? Math.round((Math.max(10,base.apow||10)*mul+(r.apowFlat|0))*0.9)+(r.healFlat|0) : 0,
    speed:(base.atkSpeed||1)*(1+(r.atkSpd||0)*CONV.atkSpdPerPt),
    moveSpd:1+Math.min(CONV.mobilityCap,(r.moveSpd||0)*CONV.mobilityPerPt),
    rangeMul:1+Math.min(CONV.mobilityCap,(r.range||0)*CONV.mobilityPerPt),
    armor, mr,
    armorPen:Math.max(0,r.armorPen|0), magicPen:Math.max(0,r.magicPen|0),
    crit:Math.min(CONV.critCap,(r.crit||0)*CONV.critPerPt + (extra.critFrac||0) + (CLASS_BASE_CRIT[base.role]||0)),
    critDmg:0.6+(r.critDmg||0)*CONV.critDmgPerPt,
    critRes:Math.min(CONV.critResCap,(r.critRes||0)*CONV.critResPerPt+(extra.critResFrac||0)),
    defense:Math.min(CONV.defenseCap,(r.defense||0)*CONV.defensePerPt),   /* Academy v2 (11 Oct, Phil): DEFENSE rating - 20 points = 1%, cap 60%, takes that much off an attacker's crit CHANCE ("defense = crit% reduction"); sources: glyphs, equipment, prayer, future - none give it yet */
    energyReg:(r.energy||0)*CONV.energyPer100/100 + (extra.energyRegFlat||0),
    startEnergy:Math.max(0,Math.min(60,Math.round((r.startEnergy||0)*0.35))),
    regen:Math.min(0.012,(r.regen||0)*0.0001),   /* v1026 (Phil 4 Oct 'make all changes'): HP regen 100 points = 1% max HP/s - at 20 = 1% a geared tank regenerated the 6%/s cap (1,600 HP/s) */   // v364: 0.01% max-HP/s per point, cap 6%/s (was 0.1%/pt uncapped — mirrors the client mulsFromTotals)
    lifesteal:Math.min(CONV.lifestealCap,(r.lifesteal||0)*CONV.lifestealPerPt),
    eva:Math.min(CONV.evaCap,(r.eva||0)*CONV.evaPerPt), acc:(r.acc||0),
    block:Math.min(CONV.blockCap,(r.block||0)*CONV.blockPerPt),
    dmgBonus:1+(r.dmgBonus||0)*CONV.dmgBonusPerPt,
    dmgRed:Math.min(0.6,Math.min(CONV.dmgRedCap,(r.dmgRed||0)*CONV.dmgRedPerPt)+(extra.dmgRedFrac||0)),   // Academy Defense research adds flat reduction
    haste:1+(r.haste||0)*CONV.hastePerPt,
    shieldStr:1+(r.shieldStr||0)*CONV.shieldStrPerPt,
    ctrlHit:(r.ctrlHit||0)*CONV.ctrlHitPerPt,
    ctrlRes:Math.min(CONV.ctrlResCap,(r.ctrlRes||0)*CONV.ctrlResPerPt),
    healPow:(r.healPow||0)*0.0005,   /* v1020: 20 points = 1% */
    kit:KITS[key]||extra.kit||DEFAULT_KIT,
    /* v762 - the four skill levels, and the multiplier the ultimate fires at. */
    skillLv:(Array.isArray(extra.skillLv)&&extra.skillLv.length===4)?extra.skillLv.slice():[1,1,1,1],
    ultMul:skillMul(Array.isArray(extra.skillLv)?extra.skillLv[0]:1),
    gearSkillSlot:extra.gearSkillSlot||null, gearSkill:extra.gearSkill||null,
    shieldPool:0, _stunR:0, _skipR:0, _buffR:0, _buffMul:1, _drR:0, _markR:0, _markMul:1, _gearSkillUsed:false
  };
}

const ROLE_FRONT_ORDER={Tank:0,Bruiser:1,Assassin:2,Mage:3,Marksman:3,Support:4};
function lineUp(units, carry, capToEntry){
  const out=units.filter(Boolean).slice(0,5).map((u,i)=>{ const c=Object.assign({},u);
    c.hp=carry&&carry[i]?Math.max(0,Math.min(u.maxHp,carry[i].hp|0)):u.maxHp;
    c.healCap=capToEntry?c.hp:u.maxHp;
    c.energy=carry&&carry[i]?Math.max(0,Math.min(100,carry[i].energy|0)):(u.startEnergy||0);
    c.shieldPool=0; c._stunR=0; c._skipR=0; c._buffR=0; c._buffMul=1; c._drR=0; c._markR=0; c._markMul=1; c._gearSkillUsed=false;
    c._hexUntilR=0; c._healCutUntilR=0; c._ripReadyR=0;   /* v1372 affinity timers: rounds restart at 1 in every battle */
    return c; });
  out.sort((a,b)=>(ROLE_FRONT_ORDER[a.role]??5)-(ROLE_FRONT_ORDER[b.role]??5));
  return out;
}
function anyAlive(us){ return us.some(u=>u.hp>0); }
function firstAlive(us){ for(const u of us) if(u.hp>0) return u; return null; }
function weakestAlive(us){ let w=null; for(const u of us){ if(u.hp>0&&(!w||u.hp/u.maxHp<w.hp/w.maxHp)) w=u; } return w; }
function aliveList(us){ return us.filter(u=>u.hp>0); }
function state(us){ return us.map(u=>({key:u.key,hp:Math.max(0,Math.round(u.hp)),maxHp:u.maxHp,energy:Math.round(u.energy),alive:u.hp>0})); }

/* ---- the ONE typed damage entry point (also used by gear actives) ----
   kind: 'phys' | 'magic' | 'true'. Returns damage actually removed from hp+shields. */
function applyDamage(rnd, log, round, side, src, tgt, raw, kind, opts){
  opts=opts||{};
  raw*=elemMul(src,tgt); const edge=classEdge(src,tgt);   /* v1372 elements (client dealDamage: amt*=elemMul(src,tgt)) */
  /* v1372 Shield wall: the Tank blocks 25% of a Marksman's basic attacks. The roll is drawn only for that pair (decided by the units, never by a roll) */
  if(AFF_ON && edge==='' && unitClass(src)==='Marksman' && unitClass(tgt)==='Tank' && opts.auto && kind!=='true' && rnd()<EDGE.block){
    if(log.length<600) log.push([round,side,tgt.key,'block',src.key,0,0,kind,0]);
    return 0; }
  // evasion (countered point-for-point by accuracy) — roll ALWAYS consumed
  const evaRoll=rnd();
  const eva=Math.max(0, (tgt.eva||0) - (src.acc||0)*CONV.evaPerPt);
  if(kind!=='true' && !opts.noDodge && evaRoll<eva){
    if(log.length<600) log.push([round,side,src.key,'miss',tgt.key,0,opts.ult?1:0,kind,0]);
    return 0; }
  let dmg=raw*(src.dmgBonus||1);
  // crit — rolls ALWAYS consumed
  const critRoll=rnd(); let crit=false;
  if(!opts.noCrit && (src.crit||0)>0 && critRoll<Math.max(0,(src.crit||0)-(tgt.defense||0))){   /* Academy v2: the target's Defense comes off the crit chance; the roll is still always consumed */
    crit=true; dmg*= 1 + Math.max(0, (src.critDmg||0.6) - (tgt.critRes||0)); }   /* Academy v2 (11 Oct, Phil): crit resist SUBTRACTS from crit damage % (+60% vs 10% = +50%), never below a normal hit. = client dealDamage */
  if(tgt._markR>0) dmg*=(tgt._markMul||1);
  // TYPED mitigation: armor vs phys (blockable), MR vs magic — each countered only by its own pen
  const rk=(edge==='Support')?EDGE.armorIgnore:1;   /* v1372 Sundering grace: a Support's hit reads the Tank's Armor / MR at x0.5 (client _defMulRaw rk) */
  if(kind==='phys'){
    dmg*=1-defToDR(Math.max(0,(tgt.armor||0)*rk-(src.armorPen||0)), tgt.level);
    const blockRoll=rnd();
    if((tgt.block||0)>0 && blockRoll<(tgt.block||0)){ dmg*=0.5; if(log.length<600) log.push([round,side,tgt.key,'block',src.key,0,0,kind,0]); }
  } else if(kind==='magic'){
    dmg*=1-defToDR(Math.max(0,(tgt.mr||0)*rk-(src.magicPen||0)), tgt.level);
    rnd();   // parity roll so phys/magic consume identical stream length
  } else { rnd(); }
  if(edge==='Assassin' && tgt.shieldPool>0) tgt.shieldPool-=Math.min(tgt.shieldPool,Math.round(dmg));   /* v1372 Silence the healer: double damage to a shield - only a blow that lands */
  if(tgt._drR>0) dmg*=0.65;                      // gear brace
  dmg*=1-(tgt.dmgRed||0);                        // Damage Reduction rating
  dmg=Math.max(0,Math.round(dmg));
  let removed=0;
  if(tgt.shieldPool>0){ const ab=Math.min(tgt.shieldPool,dmg); tgt.shieldPool-=ab; dmg-=ab; removed+=ab; }
  tgt.hp-=dmg; removed+=dmg;
  if(dmg>0&&tgt.templeDamageEnergy) tgt.energy=Math.min(100,tgt.energy+100*dmg/Math.max(1,tgt.maxHp)*tgt.templeDamageEnergy);
  if(log.length<600) log.push([round,side,src.key,'>',tgt.key,removed,opts.ult?1:0,kind,crit?1:0]);
  /* v1372 class edges that act after the hit (client dealDamage, same order) */
  if(edge && tgt.hp>0 && src.hp>0){
    if(edge==='Marksman' && unitClass(tgt)==='Mage') tgt.energy=Math.max(0,(tgt.energy||0)-EDGE.drain);   /* Interrupt */
    else if(edge==='Mage' && kind!=='phys' && !opts.auto) tgt._hexUntilR=round+EDGE.hexDur;   /* Hex */
    else if(edge==='Assassin') tgt._healCutUntilR=round+EDGE.healCutDur; }   /* Silence the healer */
  if(AFF_ON && tgt.hp>0 && src.hp>0 && unitClass(src)==='Assassin' && unitClass(tgt)==='Bruiser' && (tgt._ripReadyR||0)<=round && !(tgt._stunR>0)){   /* Riposte */
    tgt._ripReadyR=round+EDGE.riposteCd;
    if(log.length<600) log.push([round,side==='A'?'B':'A',tgt.key,'riposte',src.key,0,0,'phys',0]);
    applyDamage(rnd,log,round,side==='A'?'B':'A',tgt,src,(tgt.atkP||0)*((tgt._buffR>0)?(tgt._buffMul||1):1),'phys',{}); }
  // lifesteal off damage actually removed
  if((src.lifesteal||0)>0 && removed>0 && src.hp>0){ const ls=Math.round(removed*src.lifesteal*affHealMul(src,side,round)); src.hp=Math.min(src.healCap==null?src.maxHp:src.healCap,src.hp+ls); }   /* v1372: lifesteal is a heal (client healUnit) - the heal edges apply */
  return removed;
}
function applyHeal(log, round, side, src, tgt, amt, ult){
  const a=Math.round(amt*(1+(src.healPow||0))*affHealMul(tgt,side,round));   /* v1372 heal edges on the unit healed (client healUnit) */
  tgt.hp=Math.min(tgt.healCap==null?tgt.maxHp:tgt.healCap,tgt.hp+a);
  if(log.length<600) log.push([round,side,src.key,'+',tgt.key,a,ult?1:0,'heal',0]);
  return a;
}
function grantShield(log, round, side, src, tgt, amt){
  const a=Math.round(amt*(src.shieldStr||1));
  tgt.shieldPool+=a;
  if(log.length<600) log.push([round,side,src.key,'shield',tgt.key,a,0,'shield',0]);
  return a;
}

/* v762 (Phil: "skill level directly increases the scale of skills") - SKILL LEVELS SCALE THE KIT.
   They reached this file for the first time in v762: `skillLv` appeared nowhere in it, so every
   war fight was resolved as though every skill sat at level 1 and a player's upgrades did nothing.
   The curve is the client's, to the digit - SKILL_STEP 0.0120, x2.188 at level 100 (was 0.0135 / x2.337 until v1022) - and it lives
   here because this file owns the formulas both sides share.
   Slot 0 is the ultimate, which is the only ability this resolver has; 1/2/3 are the client's
   green, blue and passive and have nothing to scale here. They ride along on the unit so a future
   resolver can use them, and they change nothing today. */
const SKILL_STEP=0.0120;
/* v787 - control loses one percentage point of its chance for every level the SKILL is below the
   TARGET. Phil's figures: a level 70 skill on a level 70 hero always lands; a level 1 skill on a
   level 100 hero lands 1 time in 100. */
const CC_MISS_PER_LEVEL=0.01;
function skillMul(lv){ return 1+(Math.max(1,(lv|0)||1)-1)*SKILL_STEP; }

/* ---- kit executor: the hero's authored ultimate ---- */
function fireKit(rnd, log, round, side, u, own, foe, variance){
  const k=u.kit||DEFAULT_KIT;
  /* v762 - the skill level multiplies the MAGNITUDE of the ultimate, which is what the client's
     _castSM does. Control effects (stun length, shape, target count) are untouched: the client
     scales magnitude only, and a stun that grew with level would be a balance change nobody asked
     for. */
  const SM=u.ultMul||1;
  const targetsFor=shape=>{ const alive=aliveList(foe); if(!alive.length) return [];
    if(shape==='lowest'){ const w=weakestAlive(foe); return w?[w]:[]; }
    if(shape==='aoe') return alive.slice(0,Math.max(1,k.n||3));
    if(shape==='cleave') return alive.slice(0,Math.max(1,k.n||2));
    return [alive[0]]; };
  /* v787 (Phil: "a level 1 stun has a 1% chance of stunning a level 100 hero") - THE SKILL'S LEVEL
     DECIDES WHETHER CONTROL LANDS. This roll knew nothing about levels, so in a war a level 1 stun
     and a level 100 stun landed equally often - the same class of gap as v762, where skill levels
     did not reach this file at all. The level term MULTIPLIES the existing ctrlHit/ctrlRes model
     rather than replacing it, so the ratings a player has built still matter, and it can only ever
     reduce: a skill at or above the target's level multiplies by 1. */
  const ccLevelMul=t=>{
    const lv=((u.skillLv&&u.skillLv[0])|0)||((u.level|0)||1);
    const tl=((t&&t.level)|0)||((u.level|0)||1);
    return Math.max(0, Math.min(1, 1-Math.max(0, tl-lv)*CC_MISS_PER_LEVEL));
  };
  const tryStun=t=>{ if(!k.stun) { rnd(); return; }
    const roll=rnd(); const ch=Math.max(0.15, 0.55+(u.ctrlHit||0)-(t.ctrlRes||0))*ccLevelMul(t);
    if(roll<ch) t._stunR=Math.max(t._stunR||0, Math.max(1,Math.round(k.stun*(1-(t.ctrlRes||0))))); };
  if(k.kind==='heal'){ const who=k.who==='allies'?aliveList(own):[weakestAlive(own)].filter(Boolean);
    for(const w of who) applyHeal(log,round,side,u,w,u.heal*(k.coef||1.1)*SM*variance(),true); return; }
  if(k.kind==='shieldTeam'){ for(const w of aliveList(own)) grantShield(log,round,side,u,w,w.maxHp*(k.pct||0.2)*SM); return; }
  if(k.kind==='hybrid'){ for(const t of targetsFor(k.shape||'aoe')){
      applyDamage(rnd,log,round,side,u,t,u.atkP*(k.coef||1.2)*SM*variance(),'phys',{ult:true});
      applyDamage(rnd,log,round,side,u,t,u.atkM*(k.coef||1.2)*SM*variance(),'magic',{ult:true}); tryStun(t); } return; }
  const kind=k.kind==='magic'?'magic':'phys';
  const line=kind==='magic'?u.atkM:u.atkP;
  for(const t of targetsFor(k.shape||'nuke')){ applyDamage(rnd,log,round,side,u,t,line*(k.coef||2.2)*SM*variance(),kind,{ult:true}); tryStun(t); }
}

/* ---- gear actives (unchanged semantics, typed executor) ---- */
function fireGearSkill(rnd,log,round,side,u,own,foe){ const g=u.gearSkill;
  const pickT=(how,n)=>{ const alive=aliveList(foe); if(!alive.length)return[];
    if(how==='far') return [alive[alive.length-1]];
    if(how==='lowest'){ const w=weakestAlive(foe); return w?[w]:[]; }
    if(how==='all') return alive;
    if(how==='chain'||how==='random'||how==='aoe'||how==='line') return alive.slice(0,Math.max(1,n||3));
    return [alive[0]]; };
  if(!g||!g.type||!g.params){ grantShield(log,round,side,u,u,u.maxHp*0.12); return; }
  const p=g.params, atk=Math.max(u.atkP,u.atkM);
  switch(g.type){
    case 'dmg': for(const t of pickT(p.target,p.n)) applyDamage(rnd,log,round,side,u,t,atk*(p.mult||1),'phys',{noDodge:true,noCrit:true}); break;
    case 'stun': { const ts=pickT(p.target==='aoe'?'aoe':'near',p.target==='aoe'?3:1);
      for(const t of ts){ t._skipR=Math.max(t._skipR||0,1); if(p.dmgMult) applyDamage(rnd,log,round,side,u,t,atk*p.dmgMult,'phys',{noDodge:true,noCrit:true}); } break; }
    case 'silence': { const t=pickT('near',1)[0]; if(t) t._skipR=Math.max(t._skipR||0,1); break; }
    case 'slow': case 'move': for(const t of pickT(p.target==='aoe'?'aoe':'near',3)){ t._buffR=0; } break;
    case 'shield': { const who=p.who==='allies'||p.who==='nearAllies'?aliveList(own):(p.who==='lowest'?[weakestAlive(own)].filter(Boolean):[u]);
      for(const w of who){ const amt=p.ap?Math.round(atk*(p.ap||1)):Math.round(w.maxHp*(p.pct||0.1)); grantShield(log,round,side,u,w,amt); if(p.energy) w.energy=Math.min(100,w.energy+p.energy); } break; }
    case 'heal': { const who=p.who==='allies'?aliveList(own):(p.who==='lowest'?[weakestAlive(own)].filter(Boolean):[u]);
      for(const w of who){ const amt=p.missing?Math.round((w.maxHp-w.hp)*p.missing):Math.round(w.maxHp*(p.pct||0.1)); applyHeal(log,round,side,u,w,amt,false); } break; }
    case 'energy': u.energy=Math.min(100,u.energy+(p.n||20)); break;
    case 'buff': u._buffR=Math.max(u._buffR||0,Math.round(p.dur||3)); u._buffMul=Math.max(u._buffMul||1,p.atk||p.as||1.15); if(p.dr!=null) u._drR=Math.max(u._drR||0,Math.round(p.dur||3)); break;
    case 'mark': for(const t of pickT(p.target==='aoe'||p.target==='all'?'all':(p.target==='far'?'far':'near'),5)){ t._markMul=Math.max(t._markMul||1,p.mult||1.15); t._markR=Math.max(t._markR||0,Math.round(p.dur||3)); } break;
    case 'taunt': grantShield(log,round,side,u,u,u.maxHp*0.10); break;
    case 'cleanse': for(const w of own){ if(w.hp>0){ w._skipR=0; w._stunR=0; } } break;
    case 'untarget': case 'ward': grantShield(log,round,side,u,u,u.maxHp*0.15); break;
    case 'next': u._buffR=Math.max(u._buffR||0,2); u._buffMul=Math.max(u._buffMul||1,p.mult||1.3); break;
    default: break;
  } }

/* ---- THE resolver: attacker a must eliminate b; round-cap stall = defender win. ---- */
function resolveBattle(a, b, seed){
  const _ctx0=AFF_CTX; AFF_CTX={a,b};   /* v1372: the heal edges read the two lines */
  try{ return _resolveBattle(a, b, seed); } finally{ AFF_CTX=_ctx0; }
}
function _resolveBattle(a, b, seed){
  const rnd=mulberry32(seed>>>0); const log=[]; let round=0;
  const fA=0.85+0.30*rnd(), fB=0.85+0.30*rnd();     // per-fight team performance band (seeded)
  const act=(u, side, own, foe)=>{
    if(u.hp<=0) return;
    if(u._stunR>0){ u._stunR--; if(log.length<600) log.push([round,side,u.key,'stunned',u.key,0,0,'ctrl',0]); return; }
    if(u._skipR>0){ u._skipR--; return; }
    const swings=u.speed>=1.1?2:1;
    for(let s=0;s<swings;s++){
      if(!anyAlive(foe)) return;
      const hexMul=(AFF_ON && round<(u._hexUntilR||0))?1/EDGE.hexAtk:1;   /* v1372 Hex: a hexed swing counts x1/1.3 (attack interval x1.3) */
      u.energy=Math.min(100,u.energy+25*(u.haste||1)*hexMul);
      const ult=u.energy>=100;
      const variance=()=> (side==='A'?fA:fB)*(0.85+0.3*rnd());
      if(ult){ fireKit(rnd,log,round,side,u,own,foe,variance); u.energy=0; continue; }
      if(u.healer){ const w=weakestAlive(own);
        if(w && w.hp<w.maxHp*0.72){ applyHeal(log,round,side,u,w,u.heal*variance(),false); continue; } }
      const t=firstAlive(foe); if(!t) return;
      const buff=(u._buffR>0)?(u._buffMul||1):1;
      // BASIC ATTACK: always the PHYSICAL line — casters poke physically, their power is the kit
      applyDamage(rnd,log,round,side,u,t,u.atkP*buff*hexMul*variance(),'phys',{auto:true});   /* auto: the basic attack (Shield wall reads it, Hex skips it) */
    }
  };
  while(anyAlive(a)&&anyAlive(b)&&round<300){
    round++;
    for(const u of a.concat(b)){ if(u.hp<=0) continue;
      if(u.energyReg) u.energy=Math.min(100,u.energy+u.energyReg*(u.haste||1));
      if(u.regen) u.hp=Math.min(u.healCap==null?u.maxHp:u.healCap,u.hp+u.maxHp*u.regen);
      if(u._buffR>0){ u._buffR--; if(u._buffR<=0) u._buffMul=1; }
      if(u._drR>0) u._drR--;
      if(u._markR>0){ u._markR--; if(u._markR<=0) u._markMul=1; } }
    if(round===2 && !a._gsDone){ a._gsDone=true;
      for(const u of a){ if(u.hp>0&&(u.gearSkill||u.gearSkillSlot)&&!u._gearSkillUsed){ u._gearSkillUsed=true; fireGearSkill(rnd,log,round,'A',u,a,b); } }
      for(const u of b){ if(u.hp>0&&(u.gearSkill||u.gearSkillSlot)&&!u._gearSkillUsed){ u._gearSkillUsed=true; fireGearSkill(rnd,log,round,'B',u,b,a); } } }
    const n=Math.max(a.length,b.length), aLeads=(round%2===1);
    for(let i=0;i<n;i++){
      if(aLeads){ if(i<a.length) act(a[i],'A',a,b); if(i<b.length) act(b[i],'B',b,a); }
      else      { if(i<b.length) act(b[i],'B',b,a); if(i<a.length) act(a[i],'A',a,b); } }
  }
  const won=anyAlive(a)&&!anyAlive(b);
  return { won, rounds:round, aState:state(a), bState:state(b), log };
}

module.exports={ AFFINITIES_LIVE, AFF_ELEMENT, ELEM_BEATS, ELEM_BONUS, CLASS_BEATS, EDGE, unitElement, unitClass, elemMul, classEdge, affHealMul,
  skillMul, SKILL_STEP, CC_MISS_PER_LEVEL, mulberry32, seedFrom, defToDR, defK, CONV, KITS, buildUnit, lineUp, resolveBattle,
  applyDamage, applyHeal, grantShield, state };
