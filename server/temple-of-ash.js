/* =============================================================================
 * THE TEMPLE OF ASH v2 — one module for both sides (server require()s it, the browser gets window.TempleOfAsh)
 * -----------------------------------------------------------------------------
 * Source of truth: Open Projects/The Temple of Ash/TEMPLE OF ASH v2 - the reference copied (09OCT2026).md
 * (Phil 9 Oct 2026: "copy their prayer system verbatim but use our names"). Replaces the v839-v1093 abstract-points model
 * (class bars as % effects, +-1 point per bar).
 *
 *   - Four bars per hero, picked from THAT hero's kit (v1098 HERO_BARS; Phil 9 Oct: "all bars should be heroes specific").
 *     A bar kind is a flat stat (health, Attack damage, Ability power, armor / MR, penetration) or a % / rate effect.
 *   - A bar holds whole STEPS; a step is a real flat stat (STEP by profile). Values ride the same ratings path as glyph flats.
 *   - Cap in steps by Temple level (CAP_STEPS). Completion = sum steps / (4 x cap).
 *   - One prayer rolls ALL FOUR bars from the tier's measured table; past a tier's REACH a would-be gain can turn into a drop.
 *   - Pay on pray; Save applies, Cancel (discard) never refunds. Power = 10 x net applied steps.
 *   - Blessings (dots): 4 slots (Temple 1/5/13/19 + hero level 50/60/70/80 + a bar threshold), 5th dot = hero 100 + Temple 25.
 *
 * Every tunable lives in TEMPLE_CONFIG. The server owns the state (/api/temple/pray|save|discard|auto).
 * ========================================================================== */
(function (global) {
  "use strict";

  /* v1096 (Phil 9 Oct 2026: "each hero gets their own spells in prayer ... all heroes should be sort of personalized like this";
     "its not class specific its hero specific"): every hero's four blessings are picked from THAT hero's own kit.
     A hero's slot k pays k x the unit of its kind (slot 1 = 1 unit ... slot 4 = 4 units), so every hero's full set is worth
     the same 10 units; the kind each hero values most sits in slot 4 (Temple 19 + the 190-step bar).
     BLESSING_UNIT values are PROPOSED - Phil tunes. code: [reward key, unit per tier] */
  const BLESSING_UNIT = {
    hp:    ["health", 320],                      // flat Health                       (slot 4 = +1,280)
    atk:   ["attack", 11],                       // flat Attack damage / Ability power by damage type (hybrid: both) (slot 4 = +44)
    arm:   ["armorMr", 220],                     // flat Armor AND Magic resist        (slot 4 = +880)
    pen:   ["pen", 105],                         // flat Armor AND Magic penetration   (slot 4 = +420)
    heal:  ["heal/shield strength", 0.025],      // Healing power (heals and shields)  (slot 4 = +10%)
    en:    ["energy regen", 0.5],                // energy per second (an ultimate is 100 energy) (slot 4 = +2/s)
    edt:   ["energy from damage taken", 0.1],    // losing 100% health gives 100 x this energy (slot 4 = 40)
    cdr:   ["cooldown reduction", 0.02],         // faster energy for the ultimate     (slot 4 = 8%)
    as:    ["attack speed", 0.025],              // (slot 4 = +10%)
    cc:    ["crit chance", 0.015],               // (slot 4 = +6%)
    cd:    ["crit damage", 0.05],                // (slot 4 = +20%)
    ls:    ["lifesteal", 0.02],                  // (slot 4 = 8%)
    dodge: ["dodge", 0.012],                     // (slot 4 = 4.8%)
    dr:    ["damage reduction", 0.012],          // (slot 4 = 4.8%)
    ctrl:  ["control resistance", 0.03],         // (slot 4 = 12%)
  };
  function heroBlessingSet(codes) {
    return codes.map(function (c, i) {
      const u = BLESSING_UNIT[c], r = {};
      if (!u) throw new Error("Temple blessing: unknown kind " + c);
      r[u[0]] = Math.round(u[1] * (i + 1) * 10000) / 10000;
      return r;
    });
  }
  /* One explicit row per hero (all 60), slot 1 -> slot 4. Why each pick: Open Projects/The Temple of Ash/HERO BLESSINGS v1096 (09OCT2026).md */
  const HERO_BLESSING_KINDS = {
    /* Support */
    dandra:    ["dodge", "en", "heal", "cdr"], linnet:    ["as", "cdr", "hp", "heal"], lumi:      ["ctrl", "atk", "cdr", "en"],
    lysara:    ["ctrl", "heal", "en", "atk"], mellan:    ["pen", "heal", "atk", "en"], mirelle:   ["dr", "as", "heal", "en"],
    nerisse:   ["cdr", "dr", "atk", "heal"], oakmir:    ["heal", "hp", "en", "cdr"], tessit:    ["as", "en", "cdr", "ctrl"],
    vireo:     ["en", "arm", "cdr", "heal"],
    /* Tank */
    ambrel:    ["hp", "ctrl", "cdr", "atk"], askel:     ["ctrl", "as", "en", "arm"], bloatus:   ["pen", "hp", "dr", "atk"],
    brannus:   ["atk", "dr", "hp", "arm"], grosk:     ["arm", "ls", "dr", "hp"], gruel:     ["edt", "arm", "ctrl", "hp"],
    joss:      ["ctrl", "arm", "hp", "dr"], pellucid:  ["hp", "atk", "edt", "arm"], rhukk:     ["atk", "edt", "arm", "dr"],
    tharl:     ["en", "ctrl", "arm", "hp"], vael:      ["hp", "cc", "as", "ls"],
    /* Bruiser */
    aureth:    ["arm", "hp", "ls", "atk"], carn:      ["hp", "ls", "as", "atk"], deepcleft: ["hp", "pen", "arm", "as"],
    grimsby:   ["cdr", "hp", "atk", "pen"], hobb:      ["cc", "arm", "atk", "dr"], hurne:     ["arm", "cdr", "hp", "dr"],
    iver:      ["arm", "pen", "as", "en"], konwu:     ["dodge", "hp", "as", "cd"], korvux:    ["cdr", "arm", "pen", "atk"],
    quorrel:   ["ctrl", "cc", "cdr", "as"], tick:      ["hp", "as", "ls", "cd"], tolley:    ["en", "atk", "hp", "cd"],
    zahri:     ["atk", "cc", "as", "pen"],
    /* Marksman */
    calypsa:   ["as", "atk", "cc", "dodge"], meridian:  ["pen", "cc", "ls", "as"], rafe:      ["dodge", "as", "cc", "cd"],
    rivet:     ["hp", "en", "pen", "atk"], sloe:      ["cc", "atk", "as", "cd"], yenna:     ["atk", "cc", "pen", "cd"],
    /* Assassin */
    hollow:    ["ls", "as", "pen", "cd"], kharos:    ["as", "cc", "dodge", "cd"], nox:       ["cd", "dodge", "en", "cdr"],
    seyla:     ["pen", "as", "dodge", "cc"], sorrel:    ["cc", "pen", "as", "atk"], vex:       ["dodge", "pen", "cc", "cd"],
    veyr:      ["atk", "as", "cc", "dodge"],
    /* Mage */
    absalie:   ["cdr", "atk", "en", "pen"], aldren:    ["as", "ctrl", "cdr", "atk"], astra:     ["en", "as", "pen", "atk"],
    ceraline:  ["atk", "hp", "pen", "cdr"], fritz:     ["dodge", "en", "atk", "cdr"], maren:     ["hp", "dr", "en", "atk"],
    orryn:     ["pen", "cdr", "as", "atk"], pyroclast: ["en", "hp", "atk", "pen"], sylthaine: ["hp", "cdr", "atk", "en"],
    umbris:    ["hp", "en", "cdr", "pen"], vaelora:   ["hp", "dodge", "cc", "cd"], vesper:    ["dr", "ctrl", "en", "cdr"],
    vulmar:    ["cdr", "pen", "dr", "atk"],
  };
  const HERO_BLESSINGS = {};
  Object.keys(HERO_BLESSING_KINDS).forEach(function (k) { HERO_BLESSINGS[k] = heroBlessingSet(HERO_BLESSING_KINDS[k]); });

  /* v1098 (Phil 9 Oct 2026, on Oakmir's screen: "how does magic penetration ... help oakmir" and "all bars should be heroes specific"):
     the four PRAYER BARS are picked per hero from that hero's own kit, in the spirit of its blessings. Bar 1 is the hero's survival
     stat (Health for most); bars 2-4 are what the hero actually scales with.
     A kind is a FLAT stat (rides the glyph-flat path: flat = which flat outputs it feeds) or a % / rate EFFECT (rides
     TempleEffects.applyCore / applyClient under the existing effect name). step = the stat value of one step; a {physical, magic}
     step follows the hero's damage type. Flats keep the v1094 step values; every other value is PROPOSED for Phil - a full
     200-step bar is the number in the comment. Power stays 10 x net STEPS whatever the kind. */
  const BAR_KINDS = {
    health:          { name: "Health",               icon: "hp",       flat: ["hp"],                  step: { physical: 35, magic: 25 } },   // 7,000 / 5,000
    attack:          { name: "Attack damage",        icon: "atk",      flat: ["ad"],                  step: 2.4 },                           // 480
    abilityPower:    { name: "Ability power",        icon: "apow",     flat: ["ap"],                  step: 3.2 },                           // 640
    armorMr:         { name: "Armor & Magic resist", icon: "armor",    flat: ["armor", "mr"],         step: { physical: 7.2, magic: 4.8 } }, // 1,440 / 960 each
    armor:           { name: "Armor",                icon: "armor",    flat: ["armor"],               step: 10.8 },                          // 2,160 PROPOSED
    magicResist:     { name: "Magic resist",         icon: "mr",       flat: ["mr"],                  step: 10.8 },                          // 2,160 PROPOSED
    pen:             { name: "Penetration",          icon: "armorPen", iconMagic: "magicPen", flat: ["armorPen", "magicPen"], step: { physical: 4.8, magic: 7.2 } },   // 960 / 1,440 each
    armorPen:        { name: "Armor penetration",    icon: "armorPen", flat: ["armorPen"],            step: 7.2 },                           // 1,440 PROPOSED
    magicPen:        { name: "Magic penetration",    icon: "magicPen", flat: ["magicPen"],            step: 7.2 },                           // 1,440 PROPOSED
    healPow:         { name: "Healing power",        icon: "healPow",  effect: "heal/shield strength", step: 0.001,   pct: true },      // 20%  PROPOSED
    energyRegen:     { name: "Energy regen",         icon: "energy",   effect: "energy regen",         step: 0.01 },                    // 2 / s PROPOSED
    cooldown:        { name: "Cooldown reduction",   icon: "cooldown", effect: "cooldown reduction",   step: 0.0005,  pct: true },      // 10%  PROPOSED (energy haste)
    attackSpeed:     { name: "Attack speed",         icon: "atkSpd",   effect: "attack speed",         step: 0.00075, pct: true },      // 15%  PROPOSED
    critChance:      { name: "Crit chance",          icon: "crit",     effect: "crit chance",          step: 0.0003,  pct: true },      // 6%   PROPOSED
    critDamage:      { name: "Crit damage",          icon: "critDmg",  effect: "crit damage",          step: 0.0015,  pct: true },      // 30%  PROPOSED
    lifesteal:       { name: "Lifesteal",            icon: "lifesteal",effect: "lifesteal",            step: 0.0004,  pct: true },      // 8%   PROPOSED
    dodge:           { name: "Dodge",                icon: "eva",      effect: "dodge",                step: 0.0003,  pct: true },      // 6%   PROPOSED
    damageReduction: { name: "Damage reduction",     icon: "dmgRed",   effect: "damage reduction",     step: 0.0003,  pct: true },      // 6%   PROPOSED
    ctrlRes:         { name: "Control resistance",   icon: "ctrlRes",  effect: "control resistance",   step: 0.00075, pct: true },      // 15%  PROPOSED
  };
  /* One explicit row per hero (all 60), bar 1 -> bar 4. Why each pick: Open Projects/The Temple of Ash/HERO BARS v1098 (09OCT2026).md */
  const HERO_BARS = {
    /* Support */
    dandra:    ["health", "dodge", "healPow", "energyRegen"],          linnet:    ["health", "attackSpeed", "cooldown", "healPow"],
    lumi:      ["health", "abilityPower", "ctrlRes", "energyRegen"],   lysara:    ["health", "abilityPower", "healPow", "ctrlRes"],
    mellan:    ["health", "abilityPower", "healPow", "magicPen"],      mirelle:   ["health", "attackSpeed", "healPow", "damageReduction"],
    nerisse:   ["health", "cooldown", "damageReduction", "healPow"],   oakmir:    ["health", "healPow", "abilityPower", "energyRegen"],
    tessit:    ["health", "attackSpeed", "cooldown", "ctrlRes"],       vireo:     ["health", "armorMr", "cooldown", "healPow"],
    /* Tank */
    ambrel:    ["health", "abilityPower", "ctrlRes", "cooldown"],      askel:     ["health", "armorMr", "ctrlRes", "attackSpeed"],
    bloatus:   ["health", "abilityPower", "magicPen", "damageReduction"], brannus: ["health", "attack", "damageReduction", "armorMr"],
    grosk:     ["health", "armor", "lifesteal", "damageReduction"],    gruel:     ["health", "armorMr", "ctrlRes", "damageReduction"],
    joss:      ["health", "magicResist", "damageReduction", "ctrlRes"], pellucid: ["health", "attack", "armor", "magicResist"],
    rhukk:     ["health", "attack", "armor", "damageReduction"],       tharl:     ["health", "armor", "ctrlRes", "energyRegen"],
    vael:      ["health", "critChance", "attackSpeed", "lifesteal"],
    /* Bruiser */
    aureth:    ["health", "attack", "abilityPower", "lifesteal"],      carn:      ["health", "attack", "lifesteal", "attackSpeed"],
    deepcleft: ["health", "armor", "armorPen", "attackSpeed"],         grimsby:   ["health", "attack", "armorPen", "cooldown"],
    hobb:      ["health", "attack", "critChance", "damageReduction"],  hurne:     ["health", "armorMr", "cooldown", "damageReduction"],
    iver:      ["health", "attackSpeed", "armorPen", "energyRegen"],   konwu:     ["health", "dodge", "attackSpeed", "critDamage"],
    korvux:    ["health", "armorMr", "attack", "cooldown"],            quorrel:   ["health", "ctrlRes", "critChance", "attackSpeed"],
    tick:      ["health", "attackSpeed", "lifesteal", "critDamage"],   tolley:    ["health", "attack", "energyRegen", "critDamage"],
    zahri:     ["health", "attack", "attackSpeed", "armorPen"],
    /* Marksman */
    calypsa:   ["health", "attack", "abilityPower", "dodge"],          meridian:  ["health", "armorPen", "lifesteal", "attackSpeed"],
    rafe:      ["dodge", "attackSpeed", "critChance", "critDamage"],   rivet:     ["health", "attack", "armorPen", "energyRegen"],
    sloe:      ["health", "attack", "critChance", "critDamage"],       yenna:     ["health", "attack", "armorPen", "critDamage"],
    /* Assassin */
    hollow:    ["lifesteal", "attackSpeed", "armorPen", "critDamage"], kharos:    ["dodge", "attack", "critChance", "critDamage"],
    nox:       ["dodge", "critDamage", "energyRegen", "cooldown"],     seyla:     ["health", "armorPen", "attackSpeed", "critChance"],
    sorrel:    ["health", "attack", "critChance", "armorPen"],         vex:       ["dodge", "armorPen", "critChance", "critDamage"],
    veyr:      ["dodge", "abilityPower", "attackSpeed", "critChance"],
    /* Mage */
    absalie:   ["health", "abilityPower", "energyRegen", "magicPen"],  aldren:    ["health", "abilityPower", "attackSpeed", "ctrlRes"],
    astra:     ["health", "abilityPower", "attackSpeed", "magicPen"],  ceraline:  ["health", "abilityPower", "magicPen", "cooldown"],
    fritz:     ["health", "dodge", "abilityPower", "energyRegen"],     maren:     ["health", "damageReduction", "abilityPower", "energyRegen"],
    orryn:     ["health", "abilityPower", "cooldown", "attackSpeed"],  pyroclast: ["health", "armorMr", "abilityPower", "magicPen"],
    sylthaine: ["health", "abilityPower", "cooldown", "energyRegen"],  umbris:    ["health", "energyRegen", "cooldown", "magicPen"],
    vaelora:   ["health", "dodge", "critChance", "critDamage"],        vesper:    ["health", "damageReduction", "ctrlRes", "cooldown"],
    vulmar:    ["health", "cooldown", "damageReduction", "abilityPower"],
  };

  const TEMPLE_CONFIG = {
    /* --- building --- */
    UNLOCK_PLAYER_LEVEL: 50,
    PLAYER_LEVEL_OFFSET: -10,         // Phil 27 Sep: every reference troop-level gate minus 10 (our temple opens at 50)
    MIN_ASCENSION_INDEX: 6,           // Phil 27 Sep: "all purple + heroes can use it" (glyph ascension index 6 = Purple)

    /* --- v2: the four bars (spec §1). v1098: BARS is the LEGACY layout (v1094-v1096 storage, and the technical fallback for a
       key with no HERO_BARS row); every hero's own four come from HERO_BARS. --- */
    BARS: ["health", "attack", "armorMr", "pen"],
    BAR_NAMES: { health: "Health", attack: "Attack", armorMr: "Armor & Magic resist", pen: "Penetration" },
    HERO_BARS: HERO_BARS,
    BAR_KINDS: BAR_KINDS,
    LEGACY_BAR_OF: { bar1: "health", bar2: "attack", bar3: "armorMr", bar4: "pen" },   // migration: old bar i -> new bar i (spec §8)
    /* A step's real stat value (spec §2 "Ours", PROPOSED - Phil sets). magic = Magic/Healer heroes, physical = Attack heroes;
       a Hybrid hero uses the physical steps and its Attack bar adds to BOTH Attack damage and Ability power. */
    STEP: {
      magic:    { health: 25, attack: 3.2, armorMr: 4.8, pen: 7.2 },
      physical: { health: 35, attack: 2.4, armorMr: 7.2, pen: 4.8 },
    },
    /* Cap in steps by Temple level (spec §3): 40 / 110 / 140 / 200 MEASURED, 75 and 170 interpolated. [from temple level, cap] */
    CAP_STEPS: [[1, 40], [5, 75], [9, 110], [13, 140], [16, 170], [19, 200]],
    POWER_PER_STEP: 10,               // MEASURED: "Power +N" = 10 x net steps, exact in all 103 measured prayers

    /* --- prayer tiers (OUR names; costs, exp and unlocks unchanged) --- */
    PRAYER_TIERS: [
      { id: "gold",    name: "Gold ritual", gems: 0,   keeperPoints: 1,  unlockKeeper: 1  },
      { id: "kindled", name: "Kindled",     gems: 50,  keeperPoints: 5,  unlockKeeper: 2  },
      { id: "stoked",  name: "Stoked",      gems: 100, keeperPoints: 10, unlockKeeper: 7  },
      { id: "blazing", name: "Blazing",     gems: 200, keeperPoints: 20, unlockKeeper: 14 },
      { id: "inferno", name: "Inferno",     gems: 400, keeperPoints: 40, unlockKeeper: 17 },
    ],
    /* MEASURED roll tables: per-bar step frequencies counted frame by frame from 103 prayers in 10 gameplay videos
       (Open Projects/The Temple of Ash/reference/measured 09OCT2026/prayers.csv). {stepDelta: times seen}. The big measured
       drops (-4 ... -15) are NOT in these tables: they are what REACH pressure produces near the cap (below). */
    ROLL_TABLES: {
      gold:    { "-3": 1, "-2": 3, "-1": 12, "0": 13, "1": 28, "2": 9, "3": 15 },
      kindled: { "0": 16, "1": 51, "2": 3, "3": 4, "4": 4 },
      stoked:  { "-1": 1, "0": 31, "1": 55, "2": 7, "3": 2, "4": 3, "5": 4 },
      blazing: { "-1": 7, "0": 16, "1": 20, "2": 2, "3": 1, "4": 2, "5": 3, "6": 3 },
      inferno: { "-1": 2, "0": 18, "1": 18, "2": 4, "3": 3, "4": 4, "5": 1, "6": 2, "7": 3 },
    },
    /* "As a hero's bars rise, it gets harder to keep rising" (spec §4). Above REACH x cap a roll that would be positive turns into
       a drop with probability rising linearly from 0 at the reach to PRESSURE_MAX at the cap. PROPOSED. */
    REACH: { gold: 0.50, kindled: 0.65, stoked: 0.80, blazing: 0.90, inferno: 1.00 },
    PRESSURE_MAX: 0.6,
    PRESSURE_DROP: { "1": 3, "2": 2, "3": 1 },                       // a pressure drop: -1..-3, small more likely
    PRESSURE_DROP_BLAZING: (function () { const t = {}; for (let k = 1; k <= 15; k++) t[k] = Math.round(1000 / k); return t; })(),   // -1..-15 weighted 1/k (the measured -5 ... -15 near the cap)

    /* --- cost ladder --- */
    GOLD_LADDER: [1000, 2000, 4000, 6000, 8000, 10000, 20000, 40000, 60000, 80000, 100000],   // Phil 9 Oct: "it should cap at 100,000"
    DIAMOND_TIERS: [                  // gem tiers buy ROLLS, never ODDS (integrity rule); keeper points come from PRAYER_TIERS on the prayer
      { id: "kindled", name: "Kindled", price: 50 },
      { id: "stoked",  name: "Stoked",  price: 100 },
      { id: "blazing", name: "Blazing", price: 200 },
      { id: "inferno", name: "Inferno", price: 400 },
    ],
    GEM_TIER_DAILY_SOFT_CAP: 0,       // 0 = none
    FREE_RITUAL_KEEPER_POINTS: 1,     // claimFreeRitual() only (the free daily PRAYER earns the best open tier's points)

    /* --- reference perks (spec §6, SOURCED) --- */
    DISCOUNT: { gold: [6, 0.10], kindled: [10, 0.10], stoked: [12, 0.10], blazing: [18, 0.10], inferno: [20, 0.10] },   // [temple level, off]
    BONUS_PRAYER_CHANCE: 0.10,        // Phil 27 Sep: every prayer has a 10% chance to bank 1 free prayer
    BONUS_PRAYER_CHANCE_AT: [[8, 0.12], [11, 0.14], [15, 0.16]],     // the reference's free-prayer boosts at 8 / 11 / 15
    AUTO_PRAY_TEMPLE: 12,             // "Auto pray": auto save if power goes up (the reference's level-12 unlock)
    AUTO_PRAY_MAX: 10,

    /* --- blessings (the dots, spec §5) --- */
    FIFTH_ORB: { templeLevel: 25, heroLevel: 100 },   // OURS: the 5th dot (hero level 100 + Temple 25)
    FIFTH_ORB_BONUS: 0.15,                           // Phil 9 Oct: "make 5th dot 15% not 10" and "it gives 15% of BONUS stats not the attribute stats": it raises the earned BLESSING rewards (slots 1-4) only, never the four bars' step values
    TEMPLE_PLAYER_GATES: [[1, 50], [13, 60], [19, 70], [25, 80], [41, 90]],   // [from temple level, player level]
    HERO_ORB_LEVELS: [50, 60, 70, 80],               // our hero-level gates on dots 1-4 (5th: 100)
    BOON_KEEPER_GATES: [1, 5, 13, 19],               // the reference: blessing slots open at Temple 1 / 5 / 13 / 19
    BLESSING_NEEDS: [                                 // MEASURED thresholds, in steps of one bar SLOT (v1098: bar 1..4 of the hero's own four)
      { slot: 0, need: 20 }, { slot: 1, need: 50 }, { slot: 2, need: 130 }, { slot: 3, need: 190 },
    ],
    /* v1096: per-hero rewards (HERO_BLESSINGS, built above from HERO_BLESSING_KINDS x BLESSING_UNIT). blessingReward reads them by
       hero key; BLESSINGS below is only the technical fallback for a key with no row. */
    HERO_BLESSINGS: HERO_BLESSINGS,
    HERO_BLESSING_KINDS: HERO_BLESSING_KINDS,
    BLESSING_UNIT: BLESSING_UNIT,
    /* Fallback rewards by class (v1094 template; used only for a hero key missing from HERO_BLESSINGS). Keys: health / attack / armorMr / pen are flat stats
       (attack = Ability power for magic heroes, Attack damage for physical, both for hybrid; armorMr adds to armor AND magic
       resist; pen to armor AND magic penetration). Other keys are the existing battle effect names, as fractions. */
    BLESSINGS: {
      Tank:     [{ health: 700 },             { health: 500 },  { armorMr: 300 },                  { health: 2800 }],
      Bruiser:  [{ health: 700 },             { attack: 150 },  { armorMr: 200 },                  { attack: 300 }],
      Assassin: [{ "crit chance": 0.05 },     { attack: 150 },  { dodge: 0.04 },                   { pen: 200 }],
      Marksman: [{ "crit chance": 0.05 },     { attack: 150 },  { dodge: 0.04 },                   { attack: 300 }],
      Mage:     [{ "crit chance": 0.05 },     { attack: 150 },  { armorMr: 200 },                  { pen: 200 }],
      Support:  [{ lifesteal: 0.05 },         { health: 500 },  { "heal/shield strength": 0.10 },  { health: 2800 }],
    },

    /* --- legacy (v839-v1093), kept ONLY for the migration and the old Temple screen until its rebuild lands --- */
    ATTRIBUTES: ["bar1", "bar2", "bar3", "bar4"],
    BAR_UNLOCK_TEMPLE: [1, 1, 1, 1],                 // v2: all four bars roll from Temple 1
    CLASS_BARS: {                                    // display labels the old screen reads; NOT a battle path any more
      Support: ["Health", "Attack", "Armor & Magic resist", "Penetration"], Tank: ["Health", "Attack", "Armor & Magic resist", "Penetration"],
      Bruiser: ["Health", "Attack", "Armor & Magic resist", "Penetration"], Assassin: ["Health", "Attack", "Armor & Magic resist", "Penetration"],
      Marksman: ["Health", "Attack", "Armor & Magic resist", "Penetration"], Mage: ["Health", "Attack", "Armor & Magic resist", "Penetration"],
    },
    LEGACY_MAX: { base: 100, perLevelTo12: 9, perLevelAfter12: 7.25 },   // the old bar maximum by temple level (migration denominator)

    /* --- flame tokens (design §5) --- */
    TOKEN_TIERS: [
      { id: "spark",   name: "Spark",        keeperPoints: 1,  tierUnlock: "kindled" },
      { id: "glow",    name: "Glow Flame",   keeperPoints: 5,  tierUnlock: "stoked"  },
      { id: "bright",  name: "Bright Flame", keeperPoints: 10, tierUnlock: "blazing" },
      { id: "pyre",    name: "Pyre Flame",   keeperPoints: 20, tierUnlock: "blazing" },
      { id: "phoenix", name: "Phoenix Flame",keeperPoints: 40, tierUnlock: "inferno" },
    ],
  };

  /* FLAMEKEEPER_TRACK — the Temple (Flame Keeper) levels. `exp` = points to climb INTO that level from the one below. */
  const FLAMEKEEPER_TRACK = [
    { lv: 1,  exp: 0,     playerLevel: 60, unlock: null },
    { lv: 2,  exp: 5,     playerLevel: 60, unlock: "kindled_unlock" },
    { lv: 3,  exp: 15,    playerLevel: 60, unlock: null },
    { lv: 4,  exp: 25,    playerLevel: 60, unlock: null },
    { lv: 5,  exp: 50,    playerLevel: 65, unlock: "attribute_cap_raise_1" },
    { lv: 6,  exp: 100,   playerLevel: 65, unlock: "gold_discount" },
    { lv: 7,  exp: 200,   playerLevel: 65, unlock: "stoked_unlock" },
    { lv: 8,  exp: 400,   playerLevel: 65, unlock: "free_ritual_boost_1" },
    { lv: 9,  exp: 600,   playerLevel: 70, unlock: "attribute_cap_raise_2" },
    { lv: 10, exp: 800,   playerLevel: 70, unlock: "kindled_discount" },
    { lv: 11, exp: 1000,  playerLevel: 70, unlock: "free_ritual_boost_2" },
    { lv: 12, exp: 1200,  playerLevel: 70, unlock: "ritual_mode" },          // auto pray + Stoked discount
    { lv: 13, exp: 1400,  playerLevel: 75, unlock: "attribute_cap_raise_3" },
    { lv: 14, exp: 1800,  playerLevel: 75, unlock: "blazing_unlock" },
    { lv: 15, exp: 2200,  playerLevel: 75, unlock: "free_ritual_boost_3" },
    { lv: 16, exp: 2800,  playerLevel: 80, unlock: "attribute_cap_raise_4" },
    { lv: 17, exp: 3200,  playerLevel: 80, unlock: "inferno_unlock" },
    { lv: 18, exp: 3900,  playerLevel: 80, unlock: "blazing_discount" },
    { lv: 19, exp: 4600,  playerLevel: 85, unlock: "attribute_cap_raise_5" },
    { lv: 20, exp: 6500,  playerLevel: 85, unlock: "aura_1" },               // + Inferno discount
    { lv: 21, exp: 9000,  playerLevel: 85, unlock: "aura_2" },
    { lv: 22, exp: 10000, playerLevel: 90, unlock: "aura_3" },
    { lv: 23, exp: 10000, playerLevel: 90, unlock: "aura_4" },
    { lv: 24, exp: 10000, playerLevel: 90, unlock: null },
    { lv: 25, exp: 10000, playerLevel: 90, unlock: null },
    { lv: 26, exp: 10000, playerLevel: 90, unlock: null },
    { lv: 27, exp: 11000, playerLevel: 90, unlock: null },
    { lv: 28, exp: 11000, playerLevel: 90, unlock: null },
    { lv: 29, exp: 11000, playerLevel: 90, unlock: null },
    { lv: 30, exp: 11000, playerLevel: 90, unlock: "hero_meditation" },
    { lv: 31, exp: 11000, playerLevel: 95, unlock: null },
    { lv: 32, exp: 12000, playerLevel: 95, unlock: null },
    { lv: 33, exp: 12000, playerLevel: 95, unlock: null },
    { lv: 34, exp: 12000, playerLevel: 95, unlock: null },
    { lv: 35, exp: 12000, playerLevel: 95, unlock: null },
    { lv: 36, exp: 12000, playerLevel: 95, unlock: null },
    { lv: 37, exp: 13000, playerLevel: 95, unlock: null },
    { lv: 38, exp: 13000, playerLevel: 95, unlock: null },
    { lv: 39, exp: 13000, playerLevel: 95, unlock: null },
    { lv: 40, exp: 13000, playerLevel: 95, unlock: null },
    /* OURS past the reference's 40 (Phil 27 Sep: "the temple levels should be higher, since we added a 5th dot") */
    { lv: 41, exp: 14000, playerLevel: 105, unlock: null },
    { lv: 42, exp: 14000, playerLevel: 105, unlock: null },
    { lv: 43, exp: 14000, playerLevel: 105, unlock: null },
    { lv: 44, exp: 14000, playerLevel: 105, unlock: null },
    { lv: 45, exp: 14000, playerLevel: 105, unlock: null },
    { lv: 46, exp: 15000, playerLevel: 110, unlock: null },
    { lv: 47, exp: 15000, playerLevel: 110, unlock: null },
    { lv: 48, exp: 15000, playerLevel: 110, unlock: null },
    { lv: 49, exp: 15000, playerLevel: 110, unlock: null },
    { lv: 50, exp: 15000, playerLevel: 110, unlock: null },
  ];
  const CAP_RAISE_LEVELS = [5, 9, 13, 16, 19];

  /* STATE (server-owned, plain object):
     { keeperPoints, playerLevel, freeRitualDay, _freeClaimedDay, goldLadderStep, gemTierCounts, discardsInRow, bonusPrayers, levelSeen,
       heldPrayers, _pending, heroes: { <key>: { key, bars:[4 kinds], steps:{<kind>: n}, boonsUnlocked:[5 x bool], cinders?(legacy) } } }
     v1098: steps are keyed by the hero's own bar kinds and `bars` stores the layout; a state without `bars` is the v1094-v1096
     layout (health / attack / armorMr / pen) and reads positionally onto the hero's four (alignSteps). */

  /* --- RNG seam: the server injects its seeded roll (srvRoll) --- */
  let rng = Math.random;
  function setRng(fn) { rng = fn; }
  function roll() { return rng(); }

  /* --- gates --- */
  function heroCanKindle(hero) { return !!hero && (hero.ascensionIndex | 0) >= TEMPLE_CONFIG.MIN_ASCENSION_INDEX; }
  function templeUnlocked(playerLevel) { return playerLevel >= TEMPLE_CONFIG.UNLOCK_PLAYER_LEVEL; }
  function templePlayerGate(templeLevel) {
    let g = 0;
    TEMPLE_CONFIG.TEMPLE_PLAYER_GATES.forEach(function (x) { if (templeLevel >= x[0]) g = x[1]; });
    return g;
  }
  function keeperLevel(points, playerLevel) {
    let lv = 1, need = 0;
    for (let i = 0; i < FLAMEKEEPER_TRACK.length; i++) {
      const row = FLAMEKEEPER_TRACK[i];
      if (playerLevel != null && playerLevel < templePlayerGate(row.lv)) break;
      need += row.exp;
      if (points >= need) lv = row.lv; else break;
    }
    return lv;
  }
  function keeperProgress(points, playerLevel) {
    const lv = keeperLevel(points, playerLevel);
    let spent = 0; for (let i = 0; i < lv; i++) spent += FLAMEKEEPER_TRACK[i].exp;
    const next = FLAMEKEEPER_TRACK[lv];
    return { level: lv, into: points - spent, need: next ? next.exp : 0, max: !next };
  }
  function stateLevel(state) { return keeperLevel((state && state.keeperPoints) || 0, state ? state.playerLevel : null); }

  /* --- v2 bars --- */
  function capSteps(templeLevel) {
    const L = Math.max(1, templeLevel | 0 || 1); let c = TEMPLE_CONFIG.CAP_STEPS[0][1];
    TEMPLE_CONFIG.CAP_STEPS.forEach(function (x) { if (L >= x[0]) c = x[1]; });
    return c;
  }
  /* A hero's damage type -> step profile. Accepts the hero's damageProfile ('Attack' | 'Magic' | 'Healer' | 'Hybrid'), a hero base
     object, or a profile id. Missing data falls back by class (Mage/Support = magic). */
  function profileOf(x, role) {
    if (typeof x === "string" && !/^(magic|physical|hybrid|Magic|Healer|Hybrid|Attack)$/.test(x)) {   // a hero key (browser: HERO_TYPES)
      try { if (typeof HERO_TYPES !== "undefined" && HERO_TYPES[x]) x = HERO_TYPES[x]; } catch (e) {}
    }
    if (x && typeof x === "object") { role = role || x.role; x = x.damageProfile; }
    if (x === "magic" || x === "physical" || x === "hybrid") return x;
    if (x === "Magic" || x === "Healer") return "magic";
    if (x === "Hybrid") return "hybrid";
    if (x === "Attack") return "physical";
    return (role === "Mage" || role === "Support") ? "magic" : "physical";
  }
  function stepTable(profile) { return TEMPLE_CONFIG.STEP[profile === "magic" ? "magic" : "physical"]; }
  /* v1098: one step of a bar KIND for a profile ({physical, magic} steps follow the damage type; hybrid uses physical). */
  function kindStep(kind, profile) {
    const k = BAR_KINDS[kind]; if (!k) return 0;
    return typeof k.step === "number" ? k.step : (k.step[profileOf(profile) === "magic" ? "magic" : "physical"] || 0);
  }
  function stepValue(profile, bar) { return kindStep(bar, profile); }
  function isPctKind(kind) { const k = BAR_KINDS[kind]; return !!(k && k.effect); }
  function barValue(profile, bar, steps) {
    const v = (steps || 0) * stepValue(profile, bar);
    return isPctKind(bar) ? Math.round(v * 1e6) / 1e6 : Math.round(v * 10) / 10;
  }
  /* What a bar of this kind feeds: flat outputs (hp/ad/ap/armor/mr/armorPen/magicPen) or one battle effect name. */
  function kindTargets(kind) {
    const k = BAR_KINDS[kind]; if (!k) return { flat: [] };
    return k.effect ? { effect: k.effect } : { flat: k.flat.slice() };
  }
  function validLayout(bars) {
    return Array.isArray(bars) && bars.length === 4 && bars.every(function (b) { return Object.prototype.hasOwnProperty.call(BAR_KINDS, b); })
      && new Set(bars).size === 4;
  }
  /* The hero's own four bars (HERO_BARS); the legacy layout only for a key with no row (its Attack bar is Ability power for a
     magic profile, as the v1094 Attack bar was). */
  function heroBars(key, profile) {
    if (key && Object.prototype.hasOwnProperty.call(HERO_BARS, key)) return HERO_BARS[key].slice();
    const out = TEMPLE_CONFIG.BARS.slice();
    if (profile != null && profileOf(profile) === "magic") out[1] = "abilityPower";
    return out;
  }
  function emptySteps(bars) { const o = {}; (bars || TEMPLE_CONFIG.BARS).forEach(function (b) { o[b] = 0; }); return o; }
  /* The stored layout of a hero state: its own `bars`, else the v1094-v1096 legacy keys (health / attack / armorMr / pen). */
  function storedLayout(heroState) { return heroState && validLayout(heroState.bars) ? heroState.bars : TEMPLE_CONFIG.BARS; }
  /* Steps aligned onto a layout POSITIONALLY (stored bar i -> layout bar i, step counts kept) - the same rule migrateState writes,
     so a state read before or after its migration gives the same numbers. */
  function alignSteps(heroState, layout) {
    const s = (heroState && heroState.steps) || {}, src = storedLayout(heroState), out = {};
    layout.forEach(function (b, i) { out[b] = Math.max(0, s[src[i]] | 0); });
    return out;
  }
  function heroLayout(heroState, key, profile) { return heroBars(heroKeyOf(heroState, key), profile); }
  /* heroSteps(heroState [, key, profile]) -> { <kind>: steps } on the hero's own four bars. */
  function heroSteps(heroState, key, profile) { return alignSteps(heroState, heroLayout(heroState, key, profile)); }
  function newHero(key, profile) {
    const h = { steps: emptySteps(), boonsUnlocked: [false, false, false, false, false] };
    if (key) { h.key = key; h.bars = heroBars(key, profile); h.steps = emptySteps(h.bars); }
    return h;
  }
  function heroCompletion(heroState, templeLevel, key) {
    const cap = capSteps(templeLevel), s = heroSteps(heroState, key);
    let sum = 0; Object.keys(s).forEach(function (b) { sum += Math.min(cap, s[b]); });
    return sum / (4 * cap);
  }
  function barsOpen(templeLevel, key, profile) { return key ? heroBars(key, profile) : TEMPLE_CONFIG.BARS.slice(); }
  /* Display helpers: a bar's name, icon key and value text (numbers for flats, % for rates, energy per second as a plain number). */
  function barName(kind) { return (BAR_KINDS[kind] && BAR_KINDS[kind].name) || kind; }
  function barIcon(kind, profile) {
    const k = BAR_KINDS[kind]; if (!k) return "hp";
    return profile != null && profileOf(profile) === "magic" && k.iconMagic ? k.iconMagic : k.icon;
  }
  function barText(kind, value, signed) {
    const k = BAR_KINDS[kind], v = +value || 0, sg = signed && v > 0 ? "+" : "";
    if (k && k.pct) return sg + Math.round(v * 10000) / 100 + "%";
    if (k && k.effect) return sg + Math.round(v * 100) / 100;
    const r = Math.round(v * 10) / 10;
    return sg + (Math.abs(r) >= 1000 ? Math.round(r).toLocaleString("en-US") : String(r));
  }

  /* --- legacy maximum (the old model's bar max by temple level) - the migration denominator only --- */
  function effectMax(templeLevel) {
    const M = TEMPLE_CONFIG.LEGACY_MAX, L = Math.max(1, templeLevel);
    return Math.round(M.base + M.perLevelTo12 * (Math.min(L, 12) - 1) + M.perLevelAfter12 * Math.max(0, L - 12));
  }
  /* MIGRATION (spec §8): a hero with old cinders and no steps gets steps = round(old / oldMax(level) x cap(level)) per bar
     (bar1 -> health, bar2 -> attack, bar3 -> armorMr, bar4 -> pen). Earned orbs stay earned. An old-format pending prayer
     (rolls keyed bar1..) is dropped - it was paid on pray and a cancel never refunds. Returns the number of heroes migrated. */
  function migrateState(state) {
    if (!state || typeof state !== "object") return 0;
    if (!state.heroes || typeof state.heroes !== "object") state.heroes = {};
    const L = stateLevel(state), oldMax = effectMax(L), cap = capSteps(L);
    let n = 0;
    Object.keys(state.heroes).forEach(function (k) {
      const h = state.heroes[k];
      if (!h || typeof h !== "object") { state.heroes[k] = newHero(); state.heroes[k].key = k; return; }
      if (h.key !== k) h.key = k;                    // v1096: the hero's own key rides on its Temple state, so heroBonuses finds its blessings on every path
      if (!Array.isArray(h.boonsUnlocked)) h.boonsUnlocked = [false, false, false, false, false];
      while (h.boonsUnlocked.length < 5) h.boonsUnlocked.push(false);
      if (!h.steps || typeof h.steps !== "object") {
        const steps = emptySteps(), old = h.cinders || {};
        Object.keys(TEMPLE_CONFIG.LEGACY_BAR_OF).forEach(function (ob) {
          const pts = Math.max(0, Number(old[ob]) || 0);
          steps[TEMPLE_CONFIG.LEGACY_BAR_OF[ob]] = Math.max(0, Math.min(cap, Math.round(pts / oldMax * cap)));
        });
        h.steps = steps; delete h.bars; h.migratedV2 = true; n++;
      }
      /* v1098: the hero's own four bars. Old bar i -> new bar i (step counts kept, earned dots kept); the layout is stored with the
         steps, so a second run finds it in place and changes nothing. */
      const layout = heroBars(k);
      const same = validLayout(h.bars) && h.bars.join() === layout.join();
      h.steps = alignSteps(h, layout);
      if (!same) { if (!validLayout(h.bars)) h.barsFromV1096 = true; h.bars = layout; }
    });
    const p = state._pending;
    if (p && p.rolls && !p.v2) state._pending = null;
    else if (p && p.v2 && p.rolls && p.heroId) migratePending(p);
    return n;
  }
  /* A pending v1096 prayer (rolls keyed health / attack / armorMr / pen) gets the same positional move, so Save applies it to the
     hero's own bars; it was paid on pray, so it is kept rather than dropped. */
  function migratePending(p) {
    const layout = heroBars(p.heroId, p.profile), src = validLayout(p.bars) ? p.bars : TEMPLE_CONFIG.BARS;
    if (src.join() === layout.join()) { p.bars = layout; return; }
    const rolls = {};
    layout.forEach(function (b, i) {
      const r = p.rolls[src[i]]; if (!r) return;
      const from = r.fromSteps != null ? r.fromSteps | 0 : r.from | 0, to = r.toSteps != null ? r.toSteps | 0 : r.to | 0;
      rolls[b] = rollRecord(p.profile, b, from, to);
    });
    p.rolls = rolls; p.bars = layout;
  }
  function rollRecord(profile, bar, from, to) {
    const r = { fromSteps: from, deltaSteps: to - from, toSteps: to,
      fromValue: barValue(profile, bar, from), toValue: barValue(profile, bar, to),
      from: from, delta: to - from, to: to };                                           // from/delta/to: step aliases for older readers
    r.deltaValue = isPctKind(bar) ? Math.round((r.toValue - r.fromValue) * 1e6) / 1e6 : Math.round((r.toValue - r.fromValue) * 10) / 10;
    return r;
  }

  /* --- one bar's roll --- */
  function pickWeighted(table) {
    const keys = Object.keys(table).sort(function (a, b) { return Number(a) - Number(b); }); let total = 0;   // lowest roll first (JS lists integer keys before "-1")
    keys.forEach(function (k) { total += table[k]; });
    let r = roll() * total;
    for (let i = 0; i < keys.length; i++) { r -= table[keys[i]]; if (r < 0) return Number(keys[i]); }
    return Number(keys[keys.length - 1]);
  }
  function pressureChance(tierId, cur, cap) {
    const reach = (TEMPLE_CONFIG.REACH[tierId] == null ? 1 : TEMPLE_CONFIG.REACH[tierId]) * cap;
    if (cur <= reach || cap <= reach) return 0;
    return TEMPLE_CONFIG.PRESSURE_MAX * Math.min(1, (cur - reach) / (cap - reach));
  }
  function rollBar(tierId, cur, cap) {
    let d = pickWeighted(TEMPLE_CONFIG.ROLL_TABLES[tierId] || TEMPLE_CONFIG.ROLL_TABLES.gold);
    const p = pressureChance(tierId, cur, cap);
    if (d > 0 && p > 0 && roll() < p)
      d = -pickWeighted(tierId === "blazing" ? TEMPLE_CONFIG.PRESSURE_DROP_BLAZING : TEMPLE_CONFIG.PRESSURE_DROP);
    return d;
  }

  function tiersOpen(templeLevel) { return TEMPLE_CONFIG.PRAYER_TIERS.filter(function (t) { return templeLevel >= t.unlockKeeper; }); }
  function bonusPrayerChance(templeLevel) {
    let c = TEMPLE_CONFIG.BONUS_PRAYER_CHANCE;
    TEMPLE_CONFIG.BONUS_PRAYER_CHANCE_AT.forEach(function (x) { if (templeLevel >= x[0]) c = x[1]; });
    return c;
  }
  /* pray: rolls all four bars; nothing applies until saveSession / discardSession. opts.profile (hero damage type) fills the
     stat values of each roll. */
  function pray(state, heroId, tierId, opts) {
    opts = opts || {};
    if (!state.heroes) state.heroes = {};
    if (!state.heroes[heroId]) state.heroes[heroId] = newHero(heroId, opts.profile);
    migrateState(state);
    const heroState = state.heroes[heroId];
    const L = stateLevel(state), cap = capSteps(L), profile = profileOf(opts.profile);
    const tier = TEMPLE_CONFIG.PRAYER_TIERS.find(function (x) { return x.id === tierId; });
    if (!tier || L < tier.unlockKeeper) return { ok: false, reason: "tier_locked" };
    const bars = heroBars(heroId, opts.profile), cur = alignSteps(heroState, bars);   // v1098: the hero's own four bars, in its order
    const session = { v2: true, heroId: heroId, tier: tierId, profile: profile, bars: bars, rolls: {}, net: 0, power: 0, cap: cap,
      completion: heroCompletion(heroState, L, heroId) };
    bars.forEach(function (bar) {
      const from = Math.min(cap, cur[bar]);
      const to = Math.max(0, Math.min(cap, from + rollBar(tierId, from, cap)));
      session.rolls[bar] = rollRecord(profile, bar, from, to); session.net += to - from;
    });
    session.power = TEMPLE_CONFIG.POWER_PER_STEP * session.net;
    state.keeperPoints = (state.keeperPoints || 0) + tier.keeperPoints;                 // points are earned by praying, saved or not
    session.levelUps = grantLevelUps(state);
    if (roll() < bonusPrayerChance(L)) { state.bonusPrayers = (state.bonusPrayers | 0) + 1; session.bonusPrayer = true; }
    state._pending = session;
    return session;
  }
  function saveSession(state) {
    const s = state._pending;
    if (!s) return null;
    if (!state.heroes[s.heroId]) state.heroes[s.heroId] = newHero(s.heroId, s.profile);
    if (s.v2 && !validLayout(s.bars)) migratePending(s);                              // a v1096 pending prayer saved before any migrate ran
    const h = state.heroes[s.heroId], cap = capSteps(stateLevel(state)), bars = validLayout(s.bars) ? s.bars : heroBars(s.heroId, s.profile);
    const steps = alignSteps(h, bars);
    bars.forEach(function (bar) { if (s.rolls && s.rolls[bar]) steps[bar] = Math.max(0, Math.min(cap, s.rolls[bar].toSteps | 0)); });
    h.steps = steps; h.bars = bars.slice(); if (!h.key) h.key = s.heroId;
    state.discardsInRow = 0;
    state._pending = null;
    return h.steps;
  }
  function discardSession(state) {                   // Cancel: nothing applies, nothing is refunded
    const s = state._pending;
    if (!s) return null;
    state.discardsInRow = (state.discardsInRow | 0) + 1;
    state._pending = null;
    return s;
  }

  /* --- economy --- */
  let dayKey = function () { return new Date(Date.now() - 9 * 3600000).toLocaleDateString("en-CA", { timeZone: "America/New_York" }); };   /* v1086: the GAME day (09:00 ET) */
  function setDayKey(fn) { dayKey = fn; }
  function todayStamp() { return dayKey(); }
  function dailyResetIfNeeded(state) {
    if (state.freeRitualDay !== todayStamp()) {
      state.freeRitualDay = todayStamp();
      state.goldLadderStep = 0;
      state.gemTierCounts = { kindled: 0, stoked: 0, blazing: 0, inferno: 0 };
    }
  }
  function freeRitualAvailable(state) {
    dailyResetIfNeeded(state);
    return state.freeRitualDay !== null && state._freeClaimedDay !== todayStamp();
  }
  function discountFor(templeLevel, tierId) {
    const d = TEMPLE_CONFIG.DISCOUNT[tierId];
    return d && templeLevel >= d[0] ? d[1] : 0;
  }
  function nextGoldCost(state) {                      // the ladder price after the Gold ritual discount (Temple 6)
    dailyResetIfNeeded(state);
    const i = Math.min(state.goldLadderStep | 0, TEMPLE_CONFIG.GOLD_LADDER.length - 1);
    return Math.round(TEMPLE_CONFIG.GOLD_LADDER[i] * (1 - discountFor(stateLevel(state), "gold")));
  }
  function tierGems(state, tierId) {                  // a diamond tier's price after its discount
    const t = TEMPLE_CONFIG.PRAYER_TIERS.find(function (x) { return x.id === tierId; });
    if (!t || !t.gems) return 0;
    return Math.round(t.gems * (1 - discountFor(stateLevel(state), tierId)));
  }
  /* What the UI lists: every tier with its live (discounted) cost, discount and lock. */
  function prayerTiers(state) {
    const L = stateLevel(state);
    return TEMPLE_CONFIG.PRAYER_TIERS.map(function (t) {
      const off = discountFor(L, t.id);
      return { id: t.id, name: t.name, keeperPoints: t.keeperPoints, unlockKeeper: t.unlockKeeper, locked: L < t.unlockKeeper,
        discount: off, gems: t.gems ? tierGems(state, t.id) : 0, baseGems: t.gems,
        gold: t.id === "gold" ? nextGoldCost(state) : 0, reach: TEMPLE_CONFIG.REACH[t.id] };
    });
  }
  function freeDailyPray(state, heroId, opts) {
    if (!freeRitualAvailable(state)) return { ok: false, reason: "free_ritual_used" };
    const open = tiersOpen(stateLevel(state));
    const s = pray(state, heroId, open[open.length - 1].id, opts);
    if (s && s.ok === false) return s;
    state._freeClaimedDay = todayStamp();
    s.free = true; s.cost = { gold: 0, gems: 0 };
    return s;
  }
  function grantLevelUps(state) {                     // every Temple level gained banks 1 free prayer
    const now = stateLevel(state);
    if (state.levelSeen == null) state.levelSeen = 1;
    const gained = Math.max(0, now - state.levelSeen);
    if (gained) { state.bonusPrayers = (state.bonusPrayers | 0) + gained; state.levelSeen = now; }
    return gained;
  }
  function useBonusPrayer(state, heroId, opts) {
    if (!((state.bonusPrayers | 0) > 0)) return { ok: false, reason: "no_bonus_prayer" };
    const open = tiersOpen(stateLevel(state));
    state.bonusPrayers -= 1;
    const s = pray(state, heroId, open[open.length - 1].id, opts);
    if (s && s.ok === false) { state.bonusPrayers += 1; return s; }
    s.free = true; s.fromBonus = true; s.cost = { gold: 0, gems: 0 };
    return s;
  }
  function claimFreeRitual(state) {
    if (!freeRitualAvailable(state)) return { ok: false, reason: "free_ritual_used" };
    state._freeClaimedDay = todayStamp();
    state.keeperPoints += TEMPLE_CONFIG.FREE_RITUAL_KEEPER_POINTS;
    return { ok: true, cost: { gold: 0, gems: 0 } };
  }
  function buyGoldRitual(state) {
    dailyResetIfNeeded(state);
    const cost = nextGoldCost(state);
    state.goldLadderStep = (state.goldLadderStep | 0) + 1;
    return { ok: true, cost: { gold: cost, gems: 0 } };
  }
  /* Counts a diamond tier's use today. v2: keeper points come from the PRAYER only (1/5/10/20/40 - spec §6); this used to add
     the DIAMOND_TIERS points on top, so a Kindled prayer earned 6 and an Inferno 80. */
  function buyGemTier(state, tierId) {
    dailyResetIfNeeded(state);
    const tier = TEMPLE_CONFIG.DIAMOND_TIERS.find(function (t) { return t.id === tierId; });
    if (!tier) return { ok: false, reason: "no_such_tier" };
    if (TEMPLE_CONFIG.GEM_TIER_DAILY_SOFT_CAP > 0 && state.gemTierCounts[tierId] >= TEMPLE_CONFIG.GEM_TIER_DAILY_SOFT_CAP)
      return { ok: false, reason: "daily_soft_cap" };
    state.gemTierCounts[tierId] = (state.gemTierCounts[tierId] | 0) + 1;
    return { ok: true, cost: { gold: 0, gems: tierGems(state, tierId) } };
  }

  /* --- blessings (dots) --- */
  /* v1096: the hero's own reward first (HERO_BLESSINGS[key]); the class template only when the key has no row. */
  function blessingReward(role, i, key) {
    const own = key && Object.prototype.hasOwnProperty.call(TEMPLE_CONFIG.HERO_BLESSINGS, key) ? TEMPLE_CONFIG.HERO_BLESSINGS[key] : null;
    if (own) return own[i] || {};
    const t = TEMPLE_CONFIG.BLESSINGS[role]; return (t && t[i]) || {};
  }
  /* Which hero a Temple state belongs to: an explicit key, else the key migrateState stamps on it, else (browser) the slot in
     G.temple.heroes that holds this very object - so callers that pass (heroState, role, damageProfile) still get the hero's own set. */
  function heroKeyOf(heroState, key) {
    if (key) return key;
    if (heroState && typeof heroState.key === "string" && heroState.key) return heroState.key;
    try {
      const hs = (typeof G !== "undefined" && G && G.temple && G.temple.heroes) || null;
      if (hs && heroState) { for (const k in hs) if (hs[k] === heroState) return k; }
    } catch (e) {}
    return null;
  }
  const PCT = function (v) { return Math.round(v * 1000) / 10 + "%"; };
  const BLESSING_TEXT = {                        // our names; "+" for a gain, cooldown reduction reads as a plain %
    "heal/shield strength": function (v) { return "Healing power +" + PCT(v); },
    "energy regen": function (v) { return "Energy regen +" + Math.round(v * 100) / 100; },
    "energy from damage taken": function (v) { return "Energy from damage taken +" + PCT(v); },
    "cooldown reduction": function (v) { return "Cooldown reduction " + PCT(v); },
    "attack speed": function (v) { return "Attack speed +" + PCT(v); },
    "crit chance": function (v) { return "Crit chance +" + PCT(v); },
    "crit damage": function (v) { return "Crit damage +" + PCT(v); },
    "lifesteal": function (v) { return "Lifesteal +" + PCT(v); },
    "dodge": function (v) { return "Dodge +" + PCT(v); },
    "damage reduction": function (v) { return "Damage reduction +" + PCT(v); },
    "control resistance": function (v) { return "Control resistance +" + PCT(v); },
  };
  function blessingLabel(reward, profile) {
    return Object.keys(reward).map(function (k) {
      const v = reward[k];
      if (k === "health") return "Health +" + v;
      if (k === "attack") return (profile === "magic" ? "Ability power +" : profile === "hybrid" ? "Attack & Ability power +" : "Attack damage +") + v;
      if (k === "armorMr") return "Armor & Magic resist +" + v;
      if (k === "pen") return "Penetration +" + v;
      if (BLESSING_TEXT[k]) return BLESSING_TEXT[k](v);
      return k.charAt(0).toUpperCase() + k.slice(1) + " +" + PCT(v);
    }).join(", ");
  }
  /* The four dot rows (+ the 5th) for one hero. info = { role, damageProfile, heroLevel, key }. */
  function blessingsFor(state, heroState, info) {
    info = info || {};
    const hk = heroKeyOf(heroState, info.key), profile = profileOf(info.damageProfile, info.role);
    const bars = heroBars(hk, profile), steps = alignSteps(heroState, bars);
    const L = stateLevel(state), lit = (heroState && heroState.boonsUnlocked) || [];
    const hl = info.heroLevel == null ? Infinity : info.heroLevel;
    const rows = TEMPLE_CONFIG.BLESSING_NEEDS.map(function (n, i) {
      const gate = TEMPLE_CONFIG.BOON_KEEPER_GATES[i], heroGate = TEMPLE_CONFIG.HERO_ORB_LEVELS[i], reward = blessingReward(info.role, i, hk);
      const bar = bars[n.slot], have = steps[bar];                                     // v1098: the threshold is on bar SLOT n.slot of the hero's own four
      const keeperMet = L >= gate, heroMet = hl >= heroGate, thresholdMet = have >= n.need;
      return { slot: i + 1, barSlot: n.slot + 1, bar: bar, barName: barName(bar), need: n.need, have: have, reward: reward, label: blessingLabel(reward, profile),
        gate: gate, keeperGate: gate, keeperMet: keeperMet, heroGate: heroGate, heroMet: heroMet, threshold: n.need, thresholdMet: thresholdMet,
        earned: !!lit[i], unlocked: !!lit[i], locked: !keeperMet, canUnlock: keeperMet && heroMet && thresholdMet && !lit[i] };
    });
    return rows;
  }
  /* Lights every dot this hero now meets (dots stay lit once earned). Returns the newly lit slots (1-5). */
  function earnBlessings(state, heroId, info) {
    const h = state.heroes && state.heroes[heroId]; if (!h) return [];
    if (!Array.isArray(h.boonsUnlocked)) h.boonsUnlocked = [false, false, false, false, false];
    const out = [];
    if (!h.key) h.key = heroId;
    blessingsFor(state, h, Object.assign({}, info, { key: heroId })).forEach(function (r) { if (r.canUnlock) { h.boonsUnlocked[r.slot - 1] = true; out.push(r.slot); } });
    if (!h.boonsUnlocked[4] && fifthOrbReachable(state, info && info.heroLevel)) { h.boonsUnlocked[4] = true; out.push(5); }
    return out;
  }
  /* legacy signature (keeper points, hero state, hero level) - same rows without class rewards */
  function boonsFor(keeperPts, heroState, heroLevel) {
    return blessingsFor({ keeperPoints: keeperPts }, heroState, { heroLevel: heroLevel });
  }
  function fireOrbs(heroState) { return (heroState.boonsUnlocked || []).slice(0, 5).filter(Boolean).length; }
  function fifthOrbReachable(state, heroLevel) {
    const f = TEMPLE_CONFIG.FIFTH_ORB;
    return (heroLevel | 0) >= f.heroLevel && stateLevel(state) >= f.templeLevel;
  }
  function templeBonusMult(heroState) {
    return (heroState && heroState.boonsUnlocked && heroState.boonsUnlocked[4]) ? 1 + TEMPLE_CONFIG.FIFTH_ORB_BONUS : 1;
  }

  /* THE numbers combat and the card read (RULE 26), for one hero: bar flats (steps) + the hero's own blessing rewards.
     { hpFlat, adFlat, apFlat, armorFlat, mrFlat, armorPenFlat, magicPenFlat (whole numbers), <effect name>: fraction }.
     heroBonuses(heroState, role, damageProfile, key) - key picks HERO_BLESSINGS[key]; without it heroKeyOf finds it.
     v1096 (Phil 9 Oct): the 5th dot (x1.15) multiplies the BLESSING rewards only, flat and %, never the bars' step values. */
  function heroBonuses(heroState, role, damageProfile, key) {
    const out = {};
    if (!heroState) return out;
    const profile = profileOf(damageProfile, role), hk = heroKeyOf(heroState, key);
    const bars = heroBars(hk, profile), steps = alignSteps(heroState, bars);
    const blank = function () { return { hp: 0, ad: 0, ap: 0, armor: 0, mr: 0, armorPen: 0, magicPen: 0 }; };
    const f = blank(), bf = blank(), fx = {}, barFx = {};                           // f / barFx = the bars, bf / fx = the blessings
    const addAttack = function (o, v) { if (profile === "magic") o.ap += v; else if (profile === "hybrid") { o.ad += v; o.ap += v; } else o.ad += v; };
    /* v1098: each of the hero's own four bars feeds its flat outputs (glyph-flat path) or its battle effect (applyCore/applyClient) */
    bars.forEach(function (bar) {
      const v = steps[bar] * stepValue(profile, bar), t = kindTargets(bar);
      if (!v) return;
      if (t.effect) barFx[t.effect] = (barFx[t.effect] || 0) + v;
      else t.flat.forEach(function (o) { f[o] += v; });
    });
    (heroState.boonsUnlocked || []).slice(0, 4).forEach(function (lit, i) {
      if (!lit) return;
      const r = blessingReward(role, i, hk);
      Object.keys(r).forEach(function (k) {
        const v = r[k];
        if (k === "health") bf.hp += v; else if (k === "attack") addAttack(bf, v);
        else if (k === "armorMr") { bf.armor += v; bf.mr += v; } else if (k === "pen") { bf.armorPen += v; bf.magicPen += v; }
        else fx[k] = (fx[k] || 0) + v;
      });
    });
    const mk = Math.round(templeBonusMult(heroState) * 1000);                       // x1000 integer: 150 x 1.15 = 172.5 exactly
    const put = function (k, a, b) { const n = Math.round(a + b * mk / 1000); if (n) out[k] = n; };
    put("hpFlat", f.hp, bf.hp); put("adFlat", f.ad, bf.ad); put("apFlat", f.ap, bf.ap); put("armorFlat", f.armor, bf.armor); put("mrFlat", f.mr, bf.mr);
    put("armorPenFlat", f.armorPen, bf.armorPen); put("magicPenFlat", f.magicPen, bf.magicPen);
    Object.keys(barFx).concat(Object.keys(fx)).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(out, k)) return;
      const n = Math.round(((barFx[k] || 0) + (fx[k] || 0) * mk / 1000) * 1e6) / 1e6;   // the 5th dot multiplies the blessing part only
      if (n) out[k] = n;
    });
    return out;
  }

  /* Everything one hero's Temple panel needs. heroTempleStats(state, key, info) with info = { role, damageProfile, heroLevel };
     in the browser heroTempleStats(key) reads G.temple / HERO_TYPES / heroLevel() itself. */
  function heroTempleStats(state, key, info) {
    if (typeof state === "string" && key === undefined) {
      key = state; state = null; info = {};
      try { state = (typeof G !== "undefined" && G.temple) || null; } catch (e) {}
      try { const t = (typeof HERO_TYPES !== "undefined" && HERO_TYPES[key]) || {}; info.role = t.role; info.damageProfile = t.damageProfile; } catch (e) {}
      try { if (typeof heroLevel === "function") info.heroLevel = heroLevel(key); } catch (e) {}
      try { if (state && typeof playerLevel === "function") state = Object.assign({}, state, { playerLevel: playerLevel() }); } catch (e) {}
    }
    state = state || newState(); info = Object.assign({}, info || {}, { key: key });
    const L = stateLevel(state), cap = capSteps(L), h = (state.heroes && state.heroes[key]) || newHero();
    const profile = profileOf(info.damageProfile, info.role), barKinds = heroBars(key, profile), steps = alignSteps(h, barKinds), values = {}, stepValues = {};
    barKinds.forEach(function (b) { values[b] = barValue(profile, b, Math.min(cap, steps[b])); stepValues[b] = stepValue(profile, b); });
    const sum = barKinds.reduce(function (a, b) { return a + Math.min(cap, steps[b]); }, 0);
    const f = TEMPLE_CONFIG.FIFTH_ORB;
    /* v1098: bars = the hero's own four, in order, each with its name, icon key, steps, value and the value as text */
    const bars = barKinds.map(function (b, i) {
      return { slot: i + 1, kind: b, name: barName(b), icon: barIcon(b, profile), pct: isPctKind(b) && !!BAR_KINDS[b].pct, steps: Math.min(cap, steps[b]),
        value: values[b], text: barText(b, values[b]), capValue: barValue(profile, b, cap), capText: barText(b, barValue(profile, b, cap)), step: stepValues[b] };
    });
    return { key: key, templeLevel: L, profile: profile, bars: bars, barKinds: barKinds, steps: steps, values: values, cap: cap, capValues: barKinds.reduce(function (o, b) { o[b] = barValue(profile, b, cap); return o; }, {}),
      stepValues: stepValues, pct: Math.round(100 * sum / (4 * cap)),
      blessings: blessingsFor(state, h, info),
      fifth: { earned: !!(h.boonsUnlocked && h.boonsUnlocked[4]), templeLevel: f.templeLevel, heroLevel: f.heroLevel,
        locked: L < f.templeLevel, bonus: TEMPLE_CONFIG.FIFTH_ORB_BONUS, label: "5th dot: blessings +" + Math.round(TEMPLE_CONFIG.FIFTH_ORB_BONUS * 100) + "%" },
      bonuses: heroBonuses(h, info.role, info.damageProfile, key) };
  }

  /* --- flame tokens --- */
  function useFlameToken(state, tokenId) {
    const token = TEMPLE_CONFIG.TOKEN_TIERS.find(function (t) { return t.id === tokenId; });
    if (!token) return { ok: false, reason: "no_such_token" };
    const tierIdx = TEMPLE_CONFIG.DIAMOND_TIERS.findIndex(function (t) { return t.id === token.tierUnlock; });
    const anyTierOwned = TEMPLE_CONFIG.DIAMOND_TIERS.some(function (t, i) { return i >= tierIdx && (state.gemTierCounts[t.id] > 0 || i === 0); });
    if (!anyTierOwned) return { ok: false, reason: "tier_locked" };
    state.keeperPoints += token.keeperPoints;
    return { ok: true, keeperPoints: token.keeperPoints, bypassesGoldLadder: true };
  }
  function meditationTick(state, heroId) {
    if (stateLevel(state) < 30) return { ok: false, reason: "locked" };
    const hs = state.heroes[heroId];
    hs.meditationTicks = (hs.meditationTicks || 0) + 1;
    return { ok: true, ticks: hs.meditationTicks };
  }
  function newState() {
    return { keeperPoints: 0, freeRitualDay: null, goldLadderStep: 0,
             gemTierCounts: { kindled: 0, stoked: 0, blazing: 0, inferno: 0 },
             discardsInRow: 0, heroes: {}, bonusPrayers: 0, levelSeen: 1, _pending: null };
  }

  global.TempleOfAsh = {
    CONFIG: TEMPLE_CONFIG, FLAMEKEEPER_TRACK: FLAMEKEEPER_TRACK, CAP_RAISE_LEVELS: CAP_RAISE_LEVELS,
    setRng: setRng, setDayKey: setDayKey,
    templeUnlocked: templeUnlocked, heroCanKindle: heroCanKindle, keeperLevel: keeperLevel, keeperProgress: keeperProgress,
    capSteps: capSteps, profileOf: profileOf, stepValue: stepValue, barValue: barValue, heroSteps: heroSteps,
    heroBars: heroBars, alignSteps: alignSteps, kindStep: kindStep, kindTargets: kindTargets, barName: barName, barIcon: barIcon, barText: barText,
    heroCompletion: heroCompletion, barsOpen: barsOpen, migrateState: migrateState, effectMax: effectMax,
    pressureChance: pressureChance, rollBar: rollBar, tiersOpen: tiersOpen, bonusPrayerChance: bonusPrayerChance,
    pray: pray, saveSession: saveSession, discardSession: discardSession,
    freeRitualAvailable: freeRitualAvailable, freeDailyPray: freeDailyPray, useBonusPrayer: useBonusPrayer, grantLevelUps: grantLevelUps,
    claimFreeRitual: claimFreeRitual, nextGoldCost: nextGoldCost, tierGems: tierGems, discountFor: discountFor, prayerTiers: prayerTiers,
    buyGoldRitual: buyGoldRitual, buyGemTier: buyGemTier,
    blessingsFor: blessingsFor, earnBlessings: earnBlessings, boonsFor: boonsFor, fireOrbs: fireOrbs, fifthOrbReachable: fifthOrbReachable,
    templeBonusMult: templeBonusMult, heroBonuses: heroBonuses, heroTempleStats: heroTempleStats,
    blessingReward: blessingReward, blessingLabel: blessingLabel, heroKeyOf: heroKeyOf,
    useFlameToken: useFlameToken, meditationTick: meditationTick, newHero: newHero, newState: newState,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.TempleOfAsh;
})(typeof window !== "undefined" ? window : globalThis);
