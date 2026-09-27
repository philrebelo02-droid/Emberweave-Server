/* =============================================================================
 * THE TEMPLE OF ASH — client module (candidate, 27 Sep 2026)
 * -----------------------------------------------------------------------------
 * Source of truth: Open Projects/The Temple of Ash/TEMPLE OF ASH - design
 * (21 Sep 2026).md — SETTLED sections only. The reference prayer mode structure,
 * Emberweave wording, ash-curve RNG from design §9b.
 *
 * STATUS: candidate code for review. NOT wired into the game. Claude owns
 * wiring, server-side persistence (this state must live behind server
 * authority — save data is his lane), tuning simulation and shipping.
 *
 * Every [TUNE] value lives in TEMPLE_CONFIG below. Nothing else in the file
 * hard-codes a tunable number. OPEN: Phil items are marked // OPEN: Phil.
 * ========================================================================== */
(function (global) {
  "use strict";

  /* ===========================================================================
   * TEMPLE_CONFIG — the one place every tunable lives.
   * ========================================================================= */
  const TEMPLE_CONFIG = {
    /* --- building --- */
    UNLOCK_PLAYER_LEVEL: 50,
    PLAYER_LEVEL_OFFSET: -10,         // Phil 27 Sep 10:2x: every reference-game troop-level gate minus 10 (our temple opens at 50, the reference at 60)          // SETTLED: player level 50 (was 40 in live Prayer of Power)
    // Phil 27 Sep 09:4x (new guidance, replaces "purple 2"): "level 50 player unlocks the temple. but all purple + heroes can
    // use it". Purple = glyph ascension index 6 (GLYPH_LADDER: ... Blue +2 = 5, Purple = 6 ... Orange = 15, blueprint 19).
    MIN_ASCENSION_INDEX: 6,           // any Purple, Purple +1..+3, Gold .. Orange hero can pray; no hero-level gate

    /* --- attributes --- */
    /* Phil 27 Sep 12:3x: "4 attribute bars, but the 5th dot increases all bonuses 10%". Every hero prays 4 bars; what each bar IS
       comes from the hero's class (CLASS_BARS - the class's 4 strongest effects from design §10; the other 2 are the boon
       bonuses). Bars 3 and 4 open at temple 3 and 4 (BAR_UNLOCK_TEMPLE); a locked bar never rolls and is not in completion. */
    ATTRIBUTES: ["bar1", "bar2", "bar3", "bar4"],
    BAR_UNLOCK_TEMPLE: [1, 1, 3, 4],
    CLASS_BARS: {
      Support:  ["heal/shield strength", "energy regen", "cooldown reduction", "max health"],
      Tank:     ["max health", "armor", "magic resist", "damage reduction"],
      Bruiser:  ["attack damage", "max health", "lifesteal", "armor"],
      Assassin: ["attack damage", "crit chance", "crit damage", "armor penetration"],
      Marksman: ["attack damage", "attack speed", "crit chance", "crit damage"],
      Mage:     ["ability power", "magic penetration", "cooldown reduction", "energy regen"],
    },
    CLASS_BOON_EFFECTS: {       // the 2 class effects that are not bars - the boon slots' bonuses [TUNE which slot gets which]
      Support: ["magic resist", "control resistance"], Tank: ["control resistance", "energy from damage taken"],
      Bruiser: ["attack speed", "cooldown reduction"], Assassin: ["dodge", "energy regen"],
      Marksman: ["armor penetration", "lifesteal"],     Mage: ["max health", "magic resist"],
    },
    FIFTH_ORB_BONUS: 0.10,
    /* What a FULL bar gives (points = effectMax(50) = 475), as a fraction of that stat unless noted. Claude 27 Sep 13:1x, [TUNE]:
       a late star-up is worth ~+19% of a hero's stats (STAR_MULT 1.60 -> 1.90), so a full Temple (4 bars full at temple 50) is
       sized at about +20% of the hero's power. Phil can change any number here; nothing else moves. */
    BAR_FULL_AT_TEMPLE: 50,
    EFFECT_FULL: {
      "attack damage": 0.20, "ability power": 0.20, "max health": 0.20, "armor": 0.20, "magic resist": 0.20,
      "heal/shield strength": 0.20, "attack speed": 0.15, "crit chance": 0.10 /* +10 points */, "crit damage": 0.30,
      "armor penetration": 0.20, "magic penetration": 0.20, "lifesteal": 0.08 /* +8 points */, "cooldown reduction": 0.10,
      "energy regen": 0.20, "damage reduction": 0.08 /* +8 points */, "dodge": 0.06 /* +6 points */,
      "control resistance": 0.20, "energy from damage taken": 0.20,
    },
    BOON_VALUE: 0.25,        // each unlocked boon (orbs 1-4) grants 25% of EFFECT_FULL of its class boon effect (slots alternate the 2)      // Phil 12:3x: the 5th orb raises ALL of that hero's temple bonuses by 10%

    /* --- the ash curve (design §9b, PROPOSAL picks) --- */
    CINDER_START_P_UP: 0.55,          // fresh attribute: sessions usually net positive
    CINDER_FLOOR_P_UP: 0.45,          // near-cap attribute: you save only great rolls
    CINDER_DECAY_PP: 10,              // percentage points of p lost from start to floor
    FLARE_CHANCE: 0.05,               // drama roll: ±3 cinders instead of ±1
    FLARE_SHIFT: 3,
    BASE_CAP: 100,                    // cinder cap per attribute (base)
    CAP_RAISE_PER_MILESTONE: 25,      // Flamekeeper cap raises 5/9/13/16/19 (design §3)
    CINDER_TO_STAT_BONUS: 0.002,      // OPEN [TUNE]: 1 cinder = +0.2% to that attribute
    ANTI_TILT_VALVE: false,           // parked OFF at launch (design §9b); see antiTiltCheck()

    /* --- cost ladder (design §2, copied from the reference) --- */
    GOLD_LADDER: [1000, 2000, 4000, 6000, 8000, 10000, 20000, 40000, 60000,
                  80000, 100000, 200000, 400000, 600000, 800000],
    DIAMOND_TIERS: [                  // gem tiers buy ROLLS, never ODDS (integrity rule)
      { id: "kindled", name: "Kindled", price: 50,  keeperPoints: 1  },
      { id: "stoked",  name: "Stoked",  price: 100, keeperPoints: 5  },
      { id: "blazing", name: "Blazing", price: 200, keeperPoints: 20 }, // §9a primary pick
      { id: "inferno", name: "Inferno", price: 400, keeperPoints: 40 },
    ],
    GEM_TIER_DAILY_SOFT_CAP: 0,       // OPEN [TUNE]: 0 = none (design §9b sub-point b)
    FREE_RITUAL_KEEPER_POINTS: 1,     // free daily grants the base point (reference-game table)
    BONUS_PRAYER_CHANCE: 0.10,        // Phil 27 Sep 10:4x: "every prayer should give a 10% chance to give 1 free prayer" / "1 free prayer is always the highest one you can do"

    /* --- ember boons (design §4) --- */
    FIFTH_ORB: { templeLevel: 25, heroLevel: 100 },   // Phil 27 Sep 10:5x "the orbs open by hero levels": the 100 is the HERO's level
    /* Phil 27 Sep 11:0x: "the limits should be reduced to make sense for the dots". Player level needed for a temple level =
       the PREVIOUS dot's hero level, so a player can already build the temple for the next orb while the hero levels toward it:
       orb 3's slot (temple 13) opens at player 60 (orb 2's level), orb 4's (19) at 70, orb 5's (25) at 80. Every gate is at or
       below the old reference-minus-10 table. Replaces the per-row playerLevel in keeperLevel (the reference-game column stays as reference). */
    TEMPLE_PLAYER_GATES: [[1, 50], [13, 60], [19, 70], [25, 80], [41, 90]],   // [from temple level, player level]
    HERO_ORB_LEVELS: [50, 60, 70, 80],       // Phil 27 Sep 10:5x "the orbs open by hero levels" + "1st orb is available at 50, second orb available at 60, third available at 70, 4th at 80, 5th at 100"   // Phil 27 Sep 10:3x: "the 5th one is achievable at 100" / "temple level 25" - OURS, not the reference ("this is another thing that will seperate us from [the reference]")
    BOON_KEEPER_GATES: [1, 5, 13, 19],       // the reference (Phil screenshots 27 Sep): bonus slots open at temple level 1 / 5 / 13 / 19
    BOON_ATTRIBUTE_THRESHOLD_BASE: 40,       // OPEN [TUNE]: cinder threshold per boon slot
    BOON_ATTRIBUTE_THRESHOLD_STEP: 25,       // successive boons demand higher thresholds

    /* --- PRAYERS, PHIL'S MODEL (27 Sep 2026 08:3x) --------------------------------------------------------------
     * Phil: "Gold prayers can 1 point, premium(50 diamonds) 5 points, expert (100 diamonds) 10 points, master (200
     * diamonds) 20 points, guru (400 diamonds) 40 points. I want it like this." / "As you start leveling the prior prayer
     * stops helping and your fail rate% starts increasing to reduce your stats." / "Every temple level you get increases
     * your maximum stats to gain, this lowers your percent of completion per hero everytime the temple levels up. So by
     * the time your temple level is 11 or 12 your gold prayers are failing at around 50% completion with like a 1% pass
     * rate and 99% fail." / "It will not be stat stick increases. The effects will matter."
     * HOW: every prayer type works up to its own absolute CEILING of points on an effect; its pass rate falls as the
     * effect nears that ceiling (a fail takes points AWAY); the effect's MAXIMUM grows with temple level, so the same
     * ceiling is a lower completion % at a higher temple. Gold's ceiling = the temple-1 maximum, which the temple-12
     * maximum doubles -> gold dies at ~50% completion by temple 11-12. Inferno's ceiling = the final maximum.
     * Tier unlock levels are the reference's (Kindled 2, Stoked 7, Blazing 14, Inferno 17 - the FLAMEKEEPER_TRACK unlocks). [TUNE]
     * ------------------------------------------------------------------------------------------------------------ */
    PRAYER_TIERS: [
      /* OUR names (Phil 27 Sep 11:5x: "these names arent the same, we have our own names in our prayers") - the reference's gold / 50 / 100 /
         200 / 400-diamond prayers are ours as the Gold ritual / Kindled / Stoked / Blazing / Inferno (design §2). */
      { id: "gold",    name: "Gold ritual", gems: 0,   keeperPoints: 1,  ceiling: 100, unlockKeeper: 1  },
      { id: "kindled", name: "Kindled", gems: 50,  keeperPoints: 5,  ceiling: 160, unlockKeeper: 2  },
      { id: "stoked",  name: "Stoked",  gems: 100, keeperPoints: 10, ceiling: 230, unlockKeeper: 7  },
      { id: "blazing",  name: "Blazing",  gems: 200, keeperPoints: 20, ceiling: 310, unlockKeeper: 14 },
      { id: "inferno",    name: "Inferno",    gems: 400, keeperPoints: 40, ceiling: 400, unlockKeeper: 17 },
    ],
    /* HOW A PRAYER SUCCEEDS (Phil 27 Sep 11:2x-11:4x - supersedes the tier ceilings of 08:3x):
       "heroes at zero percent completion will always have 100% success rate with gold prayer or higher, as the completion % raises
       the prayer percentages of success drops. as temple level raises, this % of success also reduces, meaning to pass a certain
       threshold you need to use the higher prayer" / "each hero has its own prayer completion".
       (11:4x shape below; the REACH form was replaced by the doubling rule the same hour) completion = heroCompletion() (this hero, 0-1).
       REACH = the completion where a tier stops working = REACH_AT5[tier] x REACH_DROP[tier]^(temple-5): it shrinks every temple
       level, and a dearer tier reaches further - so past a tier's reach you need the next prayer up.
       Fitted to Phil's examples (shape, not exact - "this was an example"): gold at temple 5 ~ 44/30/15/5% at 40/60/80/90%, and
       gold at ~50% completion ~1% by temple 12 (08:4x). [TUNE] until the reference's rates are read from the videos. */
    /* Phil 11:4x "the next prayer should pretty much double the success rate of the one before": GOLD sets the curve, each
       tier up doubles it (x2 kindled, x4 stoked, x8 blazing, x16 inferno), capped at 100%, floored at PASS_FLOOR.
       gold = exp(-A x completion) x (1 - completion)^GOLD_END; A = GOLD_A5 + A_PER_LEVEL x (temple - 5) grows every temple
       level. Fit (shape only): gold at temple 5 = 44/28/15/10% at 40/60/80/90% complete; gold at 50% ~1% by temple 12. [TUNE] */
    /* Anchors for gold at 50% completion: ~35% at temple 5 (the example), ~1% at temple 12 (08:4x), ~0.1% at temple 30
       (11:5x "by temple level 30, gold prayer should essentially be .1 % success rate for a hero at 50% completion").
       GOLD_A = the steepness at each temple level through those anchors (straight lines between; 1 and 50 are ours). */
    GOLD_A: [[1, 0.30], [5, 1.54], [12, 8.66], [30, 13.26], [50, 16.0]], GOLD_END: 0.4,
    TIER_MULT: { gold: 1, kindled: 2, stoked: 4, blazing: 8, inferno: 16 },
    PASS_MAX: 0.60,        // unused since the 11:2x curve (kept for the sim header line)
    PASS_FLOOR: 0.0005,    // 11:5x: gold must be able to reach 0.1% (was 1%)      // Phil: "like a 1% pass rate and 99% fail" at/over the ceiling

    // the effect MAXIMUM by temple (Flamekeeper) level: 100 at temple 1, 199 at temple 12, 400 at temple 40 [TUNE]
    MAX_BASE: 100, MAX_PER_LEVEL_TO_12: 9, MAX_PER_LEVEL_AFTER_12: 7.25,

    /* --- flame tokens (design §5) --- */
    TOKEN_TIERS: [                           // event-gated supply only; no shop (SETTLED)
      { id: "spark",   name: "Spark",        keeperPoints: 1,  tierUnlock: "kindled" },
      { id: "glow",    name: "Glow Flame",   keeperPoints: 5,  tierUnlock: "stoked"  },
      { id: "bright",  name: "Bright Flame", keeperPoints: 10, tierUnlock: "blazing" },
      { id: "pyre",    name: "Pyre Flame",   keeperPoints: 20, tierUnlock: "blazing" },
      { id: "phoenix", name: "Phoenix Flame",keeperPoints: 40, tierUnlock: "inferno" },
    ],
    // OPEN: Phil — token tier names are working names; event roadmap decides
    // which events award which tier. Unplunderable is a SERVER rule.
  };

  /* ===========================================================================
   * FLAMEKEEPER_TRACK — full 40-level table, transcribed 27 Sep 2026 from
   * The reference handbook site (prayer page) (the handbook is newer than the wiki;
   * the wiki/handbook lv4-5 conflict resolves to handbook 25/50, per design §3).
   * `exp` = cumulative keeper points to REACH the level. `unlock` names the
   * level's granted feature. Auras 20-23 are from the wiki (handbook blanks).
   * `playerLevel` is the handbook Troop Level gate (60..95) — our player level.
   * ========================================================================= */
  const FLAMEKEEPER_TRACK = [
    { lv: 1,  exp: 0,     playerLevel: 60, unlock: null },
    { lv: 2,  exp: 5,     playerLevel: 60, unlock: "kindled_unlock" },
    { lv: 3,  exp: 15,    playerLevel: 60, unlock: null },
    { lv: 4,  exp: 25,    playerLevel: 60, unlock: null },
    { lv: 5,  exp: 50,    playerLevel: 65, unlock: "attribute_cap_raise_1" },
    { lv: 6,  exp: 100,   playerLevel: 65, unlock: null },
    { lv: 7,  exp: 200,   playerLevel: 65, unlock: "stoked_unlock" },
    { lv: 8,  exp: 400,   playerLevel: 65, unlock: "free_ritual_boost_1" },
    { lv: 9,  exp: 600,   playerLevel: 70, unlock: "attribute_cap_raise_2" },
    { lv: 10, exp: 800,   playerLevel: 70, unlock: null },
    { lv: 11, exp: 1000,  playerLevel: 70, unlock: "free_ritual_boost_2" },
    { lv: 12, exp: 1200,  playerLevel: 70, unlock: "ritual_mode" },
    { lv: 13, exp: 1400,  playerLevel: 75, unlock: "attribute_cap_raise_3" },
    { lv: 14, exp: 1800,  playerLevel: 75, unlock: "blazing_unlock" },
    { lv: 15, exp: 2200,  playerLevel: 75, unlock: "free_ritual_boost_3" },
    { lv: 16, exp: 2800,  playerLevel: 80, unlock: "attribute_cap_raise_4" },
    { lv: 17, exp: 3200,  playerLevel: 80, unlock: "inferno_unlock" },
    { lv: 18, exp: 3900,  playerLevel: 80, unlock: null },
    { lv: 19, exp: 4600,  playerLevel: 85, unlock: "attribute_cap_raise_5" },
    { lv: 20, exp: 6500,  playerLevel: 85, unlock: "aura_1" },
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
    { lv:  34, exp: 12000, playerLevel: 95, unlock: null },
    { lv: 35, exp: 12000, playerLevel: 95, unlock: null },
    { lv: 36, exp: 12000, playerLevel: 95, unlock: null },
    { lv: 37, exp: 13000, playerLevel: 95, unlock: null },
    { lv: 38, exp: 13000, playerLevel: 95, unlock: null },
    { lv: 39, exp: 13000, playerLevel: 95, unlock: null },
    { lv: 40, exp: 13000, playerLevel: 95, unlock: null },
    /* Phil 27 Sep 10:5x: "the temple levels should be higher, since we added a 5th dot" - OURS, past the reference's 40. Cost keeps the reference's
       +1000 every few levels; playerLevel is stored reference-equivalent (the -10 offset makes 41-45 = player 95, 46-50 = player 100). */
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

  /* ===========================================================================
   * STATE SCHEMA — what one player's temple record looks like.
   * Persistence is SERVER-side (Claude's lane, server authority + replay).
   * This module is pure logic over a plain object so the server can own
   * storage without touching the rules.
   *
   *   {
   *     keeperPoints: 0,             // lifetime, feeds FLAMEKEEPER_TRACK
   *     freeRitualDay: "2026-09-27", // last free daily claim (server date)
   *     goldLadderStep: 0,           // position in GOLD_LADDER today (resets daily)
   *     gemTierCounts: { kindled: 0, stoked: 0, blazing: 0, inferno: 0 }, // today
   *     discardsInRow: 0,
   *     heroes: {
   *       "<heroId>": {
   *         cinders: { power: 12, attack: 3, ... },   // per-attribute, 0..cap
   *         boonsUnlocked: [true, false, false, false],
   *         meditationTicks: 0
   *       }
   *     }
   *   }
   * ========================================================================= */

  /* --- tiny RNG seam: the server/Claude can inject a seeded RNG for tests -- */
  let rng = Math.random;
  function setRng(fn) { rng = fn; }

  function roll() { return rng(); }

  /* --- quality gate ------------------------------------------------------- */
  function heroCanKindle(hero) {             // hero.ascensionIndex = the board's GLYPH_LADDER index (blueprint 19)
    return !!hero && (hero.ascensionIndex | 0) >= TEMPLE_CONFIG.MIN_ASCENSION_INDEX;
  }

  function templeUnlocked(playerLevel) {
    return playerLevel >= TEMPLE_CONFIG.UNLOCK_PLAYER_LEVEL;
  }

  /* --- cinder cap grows with keeper milestones ---------------------------- */
  function cinderCap(keeperLevel) {
    let raises = CAP_RAISE_LEVELS.filter(function (lv) { return keeperLevel >= lv; }).length;
    return TEMPLE_CONFIG.BASE_CAP + raises * TEMPLE_CONFIG.CAP_RAISE_PER_MILESTONE;
  }

  /* Phil 27 Sep 10:1x: "follow their levels where it is achievable based off their 1 dot prayer 2 dot 3 dot 4 dot". The reference's keeper
     table gates each level by troop (player) level: keeper 5 needs 65, 9 needs 70, 13 needs 75, 16 needs 80, 19 needs 85, 22 needs
     90, 31 needs 95 - so 2-orb (keeper 5) opens at player 65, 3-orb (13) at 75, 4-orb (19) at 85. Points keep banking past the cap
     and count the moment the player levels. Rows 1-4 (the reference 60) open with our building at 50 (Phil's unlock ruling).
     playerLevel omitted = no cap (old callers, tests). */
  /* 27 Sep 10:5x FIX: a row's exp is the points to climb INTO that level from the one below, NOT a running total. The reference's screen
     proves it: "Lv.19 [keeper] 2747/6500" (KOE-zkwQrM0 @5:08) - 6500 is lv 20's exp, and the bar restarts each level
     (walkthrough: 0/5 at lv1, 0/15 at lv2, 0/25 at lv3). The old running-total read put temple 40 at 13,000 points;
     the real sum is 256,795 (about 6,400 Inferno rituals). */
  function templePlayerGate(templeLevel) {
    let g = 0;
    TEMPLE_CONFIG.TEMPLE_PLAYER_GATES.forEach(function (x) { if (templeLevel >= x[0]) g = x[1]; });
    return g;
  }
  function keeperLevel(points, playerLevel) {
    let lv = 1, need = 0;
    for (let i = 0; i < FLAMEKEEPER_TRACK.length; i++) {
      const row = FLAMEKEEPER_TRACK[i];
      const gate = templePlayerGate(row.lv);            // Phil 11:0x: gates follow the dots (TEMPLE_PLAYER_GATES)
      if (playerLevel != null && playerLevel < gate) break;
      need += row.exp;
      if (points >= need) lv = row.lv; else break;
    }
    return lv;
  }
  /* The Flamekeeper bar under the keeper (the reference "2747/6500"): points into the current level / the next level's exp. */
  function keeperProgress(points, playerLevel) {
    const lv = keeperLevel(points, playerLevel);
    let spent = 0; for (let i = 0; i < lv; i++) spent += FLAMEKEEPER_TRACK[i].exp;
    const next = FLAMEKEEPER_TRACK[lv];
    return { level: lv, into: points - spent, need: next ? next.exp : 0, max: !next };
  }

  /* --- the ash curve ------------------------------------------------------ */
  function pUp(cinders, cap) {
    const start = TEMPLE_CONFIG.CINDER_START_P_UP;
    const floor = TEMPLE_CONFIG.CINDER_FLOOR_P_UP;
    const decay = (start - floor) * Math.min(1, cinders / cap);
    return start - decay;
  }

  function rollAttribute(cinders, cap) {
    const isFlare = roll() < TEMPLE_CONFIG.FLARE_CHANCE;
    const shift = isFlare ? TEMPLE_CONFIG.FLARE_SHIFT : 1;
    return roll() < pUp(cinders, cap) ? +shift : -shift;
  }

  /* --- Phil's model (27 Sep): max by temple level, pass rate by prayer ceiling, one prayer rolls every effect --- */
  function effectMax(templeLevel) {
    const C = TEMPLE_CONFIG, L = Math.max(1, templeLevel);
    return Math.round(C.MAX_BASE + C.MAX_PER_LEVEL_TO_12 * (Math.min(L, 12) - 1) + C.MAX_PER_LEVEL_AFTER_12 * Math.max(0, L - 12));
  }
  /* A hero's prayer completion at a temple level: all its bars against the maximum (0-1). Each hero has its own. */
  function barsOpen(templeLevel) {                    // the bars that roll at this temple level
    const L = Math.max(1, templeLevel || 1);
    return TEMPLE_CONFIG.ATTRIBUTES.filter(function (a, i) { return L >= TEMPLE_CONFIG.BAR_UNLOCK_TEMPLE[i]; });
  }
  function heroCompletion(heroState, templeLevel) {
    const A = barsOpen(templeLevel), max = effectMax(Math.max(1, templeLevel || 1));
    let sum = 0; A.forEach(function (a) { sum += Math.min(max, (heroState && heroState.cinders && heroState.cinders[a]) || 0); });
    return sum / (max * A.length);
  }
  /* What a hero's temple is worth, as a multiplier on its bar and boon bonuses: x1.10 once the 5th orb is lit (Phil 12:3x). */
  function templeBonusMult(heroState) {
    return (heroState && heroState.boonsUnlocked && heroState.boonsUnlocked[4]) ? 1 + TEMPLE_CONFIG.FIFTH_ORB_BONUS : 1;
  }
  function passRate(tierId, completion, templeLevel) {                          // completion = heroCompletion(), 0-1
    const C = TEMPLE_CONFIG, L = Math.max(1, templeLevel || 1);
    const c = Math.min(1, Math.max(0, completion));
    const G = C.GOLD_A; let A = G[G.length - 1][1];                          // steeper every temple level
    for (let i = 1; i < G.length; i++) if (L <= G[i][0]) { A = G[i - 1][1] + (G[i][1] - G[i - 1][1]) * (L - G[i - 1][0]) / (G[i][0] - G[i - 1][0]); break; }
    const gold = Math.exp(-A * c) * Math.pow(1 - c, C.GOLD_END);               // 1.0 at 0% completion
    return Math.max(C.PASS_FLOOR, Math.min(1, gold * (C.TIER_MULT[tierId] || 1)));
  }


  function tiersOpen(templeLevel) {
    return TEMPLE_CONFIG.PRAYER_TIERS.filter(function (t) { return templeLevel >= t.unlockKeeper; });
  }
  function pray(state, heroId, tierId) {              // rolls; nothing applies until saveSession / discardSession
    const heroState = state.heroes[heroId];
    const L = keeperLevel(state.keeperPoints, state.playerLevel), max = effectMax(L);
    const tier = TEMPLE_CONFIG.PRAYER_TIERS.find(function (x) { return x.id === tierId; });
    if (!tier || L < tier.unlockKeeper) return { ok: false, reason: "tier_locked" };
    const done = heroCompletion(heroState, L), p = passRate(tierId, done, L);   // this hero's completion -> one chance
    const session = { heroId: heroId, tier: tierId, rolls: {}, net: 0, max: max, completion: done, chance: p };
    barsOpen(L).forEach(function (attr) {
      const cur = heroState.cinders[attr] || 0;
      const shift = roll() < TEMPLE_CONFIG.FLARE_CHANCE ? TEMPLE_CONFIG.FLARE_SHIFT : 1;
      const delta = roll() < p ? +shift : -shift;
      const to = Math.max(0, Math.min(max, cur + delta));
      session.rolls[attr] = { from: cur, delta: to - cur, to: to };
      session.net += to - cur;
    });
    state.keeperPoints += tier.keeperPoints;          // points are earned by praying, pass or fail (the reference)
    session.levelUps = grantLevelUps(state);          // Phil 27 Sep: "when you level you get 1 free"
    if (roll() < TEMPLE_CONFIG.BONUS_PRAYER_CHANCE) {   // Phil 27 Sep: every prayer (free ones too) - 10% for 1 free prayer
      state.bonusPrayers = (state.bonusPrayers | 0) + 1;
      session.bonusPrayer = true;
    }
    state._pending = session;
    return session;
  }

  /* --- one kindling session: EVERY unlocked attribute rolls --------------- */
  function startSession(state, heroId) {
    const heroState = state.heroes[heroId];
    const cap = cinderCap(keeperLevel(state.keeperPoints, state.playerLevel));
    const session = { heroId: heroId, rolls: {}, net: 0 };
    TEMPLE_CONFIG.ATTRIBUTES.forEach(function (attr) {
      const cur = heroState.cinders[attr] || 0;
      const delta = rollAttribute(cur, cap);
      session.rolls[attr] = { from: cur, delta: delta, to: cur + delta };
      session.net += delta;
    });
    state._pending = session;              // save OR discard — nothing applies yet
    return session;
  }

  function saveSession(state) {
    const s = state._pending;
    if (!s) return null;
    const heroState = state.heroes[s.heroId];
    // 27 Sep 13:0x (ChatGPT's read-through): the old ash-curve cinderCap (225 max) clipped every save and made the upper half of a
    // bar unreachable. The bar's ceiling is effectMax(temple level) - the same clamp pray() rolls against.
    const cap = effectMax(keeperLevel(state.keeperPoints, state.playerLevel));
    Object.keys(s.rolls).forEach(function (attr) {
      const to = s.rolls[attr].to;
      heroState.cinders[attr] = Math.max(0, Math.min(to, cap));  // saved = permanent
    });
    state.discardsInRow = 0;
    state._pending = null;
    return heroState.cinders;
  }

  function discardSession(state) {
    const s = state._pending;
    if (!s) return null;
    state.discardsInRow += 1;
    state._pending = null;
    if (TEMPLE_CONFIG.ANTI_TILT_VALVE && state.discardsInRow >= 3) {
      state._guaranteeNext = true;         // 4th session guaranteed net >= +2
    }
    return s;
  }

  function antiTiltCheck(state, session) {
    if (!state._guaranteeNext) return session;
    state._guaranteeNext = false;
    if (session.net >= 2) return session;
    // lift the weakest attribute to reach net +2 — frustration insurance only
    let need = 2 - session.net;
    TEMPLE_CONFIG.ATTRIBUTES.forEach(function (attr) {
      if (need <= 0) return;
      session.rolls[attr].delta += 1;
      session.rolls[attr].to += 1;
      session.net += 1;
      need -= 1;
    });
    return session;
  }

  /* --- economy ------------------------------------------------------------ */
  /* The day key for the free prayer and the gold ladder: the game's New York day (the server's nyDayKey), not UTC - they
     differ every evening. The server injects its own key with setDayKey(fn); the default computes the NY date. */
  let dayKey = function () { return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); };
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

  /* Phil 27 Sep 09:3x: "free daily prayer is always the highest tier you have unlocked, not the cheapest". The day's free
     prayer rolls with the best OPEN tier's ceiling and earns that tier's keeper points, at no cost. Returns the pray() session. */
  function freeDailyPray(state, heroId) {
    if (!freeRitualAvailable(state)) return { ok: false, reason: "free_ritual_used" };
    const open = tiersOpen(keeperLevel(state.keeperPoints, state.playerLevel));
    const best = open[open.length - 1];
    const s = pray(state, heroId, best.id);
    if (s && s.ok === false) return s;
    state._freeClaimedDay = todayStamp();
    s.free = true; s.cost = { gold: 0, gems: 0 };
    return s;
  }

  /* Phil 27 Sep 10:5x (the reference: "Each time you level your [keeper], you got free 1 time"): "yes it does, when you level you get 1 free".
     Every temple level gained banks 1 free prayer (same bank as the 10% bonus, prays as the best open tier). Called by pray();
     the server also calls it when the PLAYER levels up, because banked points can lift a capped temple level with no prayer. */
  function grantLevelUps(state) {
    const now = keeperLevel(state.keeperPoints, state.playerLevel);
    if (state.levelSeen == null) state.levelSeen = 1;
    const gained = Math.max(0, now - state.levelSeen);
    if (gained) { state.bonusPrayers = (state.bonusPrayers | 0) + gained; state.levelSeen = now; }
    return gained;
  }

  /* A banked bonus prayer (the 10% roll in pray()). Phil: "1 free prayer is always the highest one you can do" - it rolls as the
     best OPEN tier at the moment it is used (like freeDailyPray), no cost, full keeper points; it can roll another bonus. */
  function useBonusPrayer(state, heroId) {
    if (!((state.bonusPrayers | 0) > 0)) return { ok: false, reason: "no_bonus_prayer" };
    const open = tiersOpen(keeperLevel(state.keeperPoints, state.playerLevel));
    state.bonusPrayers -= 1;                         // spent before the roll, so a roll that wins a new one adds it back
    const s = pray(state, heroId, open[open.length - 1].id);
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

  function nextGoldCost(state) {
    dailyResetIfNeeded(state);
    const i = Math.min(state.goldLadderStep, TEMPLE_CONFIG.GOLD_LADDER.length - 1);
    return TEMPLE_CONFIG.GOLD_LADDER[i];
  }

  function buyGoldRitual(state) {
    dailyResetIfNeeded(state);
    const cost = nextGoldCost(state);
    state.goldLadderStep += 1;             // server verifies the gold before calling
    return { ok: true, cost: { gold: cost, gems: 0 } };
  }

  function buyGemTier(state, tierId) {
    dailyResetIfNeeded(state);
    const tier = TEMPLE_CONFIG.DIAMOND_TIERS.find(function (t) { return t.id === tierId; });
    if (!tier) return { ok: false, reason: "no_such_tier" };
    if (TEMPLE_CONFIG.GEM_TIER_DAILY_SOFT_CAP > 0 &&
        state.gemTierCounts[tierId] >= TEMPLE_CONFIG.GEM_TIER_DAILY_SOFT_CAP) {
      return { ok: false, reason: "daily_soft_cap" };
    }
    state.gemTierCounts[tierId] += 1;
    state.keeperPoints += tier.keeperPoints;   // points from gems — rolls, never odds
    return { ok: true, cost: { gold: 0, gems: tier.price }, keeperPoints: tier.keeperPoints };
  }

  /* --- ember boons ---------------------------------------------------------- */
  function boonsFor(keeperPts, heroState, heroLevel) {
    const klv = keeperLevel(keeperPts);
    const hl = heroLevel == null ? Infinity : heroLevel;   // no hero level passed = old callers, hero gate not applied
    const result = [];
    TEMPLE_CONFIG.BOON_KEEPER_GATES.forEach(function (gate, i) {
      const threshold = TEMPLE_CONFIG.BOON_ATTRIBUTE_THRESHOLD_BASE +
                        i * TEMPLE_CONFIG.BOON_ATTRIBUTE_THRESHOLD_STEP;
      const anyAttrAt = Object.keys(heroState.cinders).some(function (a) {
        return heroState.cinders[a] >= threshold;
      });
      result.push({
        slot: i + 1,
        keeperGate: gate,
        keeperMet: klv >= gate || (gate === 0),
        heroGate: TEMPLE_CONFIG.HERO_ORB_LEVELS[i],
        heroMet: hl >= TEMPLE_CONFIG.HERO_ORB_LEVELS[i],
        threshold: threshold,
        thresholdMet: anyAttrAt,
        unlocked: Boolean(heroState.boonsUnlocked[i]),
        canUnlock: (klv >= gate || gate === 0) && hl >= TEMPLE_CONFIG.HERO_ORB_LEVELS[i] && anyAttrAt && !heroState.boonsUnlocked[i],
      });
    });
    return result;
  }

  /* Phil 27 Sep 09:5x (reference-game screenshots): each hero's 4 Bonus Rewards open by the TEMPLE level the player reaches -
     slot 1 at 1, slot 2 at 5, slot 3 at 13, slot 4 at 19 ("Need Lv 13 [keeper]") - and a slot whose level is reached still needs
     its bar filled to the threshold shown ("420/1400 Unlock", "88/400 Unlock"). Phil: "unlocks a fire orb" / "this indicates
     the bonus they unlocked" - one FIRE ORB per unlocked bonus, shown on that bonus row and on the hero. */
  function fireOrbs(heroState) {                    // 0-5: slots 1-4 are the reference's bonuses, slot 5 (index 4) is the centre orb
    return (heroState.boonsUnlocked || []).slice(0, 5).filter(Boolean).length;
  }
  function fifthOrbReachable(state, heroLevel) {    // the big centre orb: the HERO at level 100 AND temple level 25 (Phil 27 Sep)
    const f = TEMPLE_CONFIG.FIFTH_ORB;
    return (heroLevel | 0) >= f.heroLevel && keeperLevel(state.keeperPoints, state.playerLevel) >= f.templeLevel;
  }

  /* --- flame tokens --------------------------------------------------------- */
  function useFlameToken(state, tokenId) {
    const token = TEMPLE_CONFIG.TOKEN_TIERS.find(function (t) { return t.id === tokenId; });
    if (!token) return { ok: false, reason: "no_such_token" };
    // tier unlock respected: a token never kindles above its tier's line
    const tierIdx = TEMPLE_CONFIG.DIAMOND_TIERS.findIndex(function (t) { return t.id === token.tierUnlock; });
    const anyTierOwned = TEMPLE_CONFIG.DIAMOND_TIERS.some(function (t, i) {
      return i >= tierIdx && (state.gemTierCounts[t.id] > 0 || i === 0);
    });
    if (!anyTierOwned) return { ok: false, reason: "tier_locked" };
    state.keeperPoints += token.keeperPoints;   // grants points, bypasses gold ladder
    return { ok: true, keeperPoints: token.keeperPoints, bypassesGoldLadder: true };
  }

  /* --- stat bonus derivation (display + server combat hook) ------------------ */
  function attributeBonus(cinders) {
    return cinders * TEMPLE_CONFIG.CINDER_TO_STAT_BONUS;   // e.g. 0.002 = +0.2%/cinder
  }

  /* THE numbers the one power function uses (RULE 26): {effect name: bonus} for one hero of class heroClass.
     bar i -> CLASS_BARS[class][i], value = EFFECT_FULL x points / effectMax(BAR_FULL_AT_TEMPLE); each lit boon 1-4 adds
     BOON_VALUE x EFFECT_FULL of CLASS_BOON_EFFECTS[class][i % 2]; everything x1.10 once the 5th orb is lit. */
  function heroBonuses(heroState, heroClass) {
    const C = TEMPLE_CONFIG, out = {}, full = effectMax(C.BAR_FULL_AT_TEMPLE);
    const bars = C.CLASS_BARS[heroClass], boons = C.CLASS_BOON_EFFECTS[heroClass];
    if (!bars || !heroState) return out;
    const add = function (eff, v) { if (v) out[eff] = (out[eff] || 0) + v; };
    C.ATTRIBUTES.forEach(function (a, i) {
      const pts = Math.max(0, Math.min(full, (heroState.cinders && heroState.cinders[a]) || 0));
      add(bars[i], (C.EFFECT_FULL[bars[i]] || 0) * pts / full);
    });
    (heroState.boonsUnlocked || []).slice(0, 4).forEach(function (lit, i) {
      if (lit) add(boons[i % 2], C.BOON_VALUE * (C.EFFECT_FULL[boons[i % 2]] || 0));
    });
    const m = templeBonusMult(heroState);
    Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k] * m * 10000) / 10000; });
    return out;
  }

  /* --- hero meditation (Flamekeeper 30): offline kindling progress ---------- */
  function meditationTick(state, heroId) {
    if (keeperLevel(state.keeperPoints, state.playerLevel) < 30) return { ok: false, reason: "locked" };
    const hs = state.heroes[heroId];
    hs.meditationTicks = (hs.meditationTicks || 0) + 1;
    return { ok: true, ticks: hs.meditationTicks };
  }

  /* --- exports --------------------------------------------------------------- */
  global.TempleOfAsh = {
    CONFIG: TEMPLE_CONFIG,
    FLAMEKEEPER_TRACK: FLAMEKEEPER_TRACK,
    CAP_RAISE_LEVELS: CAP_RAISE_LEVELS,
    setRng: setRng,
    templeUnlocked: templeUnlocked,
    heroCanKindle: heroCanKindle,
    cinderCap: cinderCap,
    keeperLevel: keeperLevel,
    pUp: pUp,
    startSession: startSession,
    saveSession: saveSession,
    discardSession: discardSession,
    antiTiltCheck: antiTiltCheck,
    claimFreeRitual: claimFreeRitual,
    freeRitualAvailable: freeRitualAvailable,
    nextGoldCost: nextGoldCost,
    buyGoldRitual: buyGoldRitual,
    buyGemTier: buyGemTier,
    boonsFor: boonsFor,
    useFlameToken: useFlameToken,
    heroBonuses: heroBonuses,
    setDayKey: setDayKey,
    meditationTick: meditationTick,
    effectMax: effectMax,
    passRate: passRate,
    tiersOpen: tiersOpen,
    pray: pray,
    fireOrbs: fireOrbs,
    fifthOrbReachable: fifthOrbReachable,
    freeDailyPray: freeDailyPray,
    keeperProgress: keeperProgress,
    heroCompletion: heroCompletion,
    barsOpen: barsOpen,
    templeBonusMult: templeBonusMult,
    grantLevelUps: grantLevelUps,
    useBonusPrayer: useBonusPrayer,
    newState: function () {
      return { keeperPoints: 0, freeRitualDay: null, goldLadderStep: 0,
               gemTierCounts: { kindled: 0, stoked: 0, blazing: 0, inferno: 0 },
               discardsInRow: 0, heroes: {}, bonusPrayers: 0, levelSeen: 1, _pending: null };
    },
  };
  /* one file for both sides (WIRING SPEC): the browser gets window.TempleOfAsh, the server require()s it */
  if (typeof module !== "undefined" && module.exports) module.exports = global.TempleOfAsh;
})(typeof window !== "undefined" ? window : globalThis);
