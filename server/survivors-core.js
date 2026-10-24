/* =============================================================================
 * HERO SURVIVORS - the simulation core (Claude, 24 Oct 2026). One module for both sides: the server require()s it, the browser
 * gets window.SurvivorsCore. The new Tower of Trials (Phil, 24 Oct 2026: "check vampire survivors" / "heroes against monster
 * hordes"), design: 1. Emberweave Brain/taskings/TOWER ROUND 2 - 20 IDEAS 24OCT2026/TOWER - HERO SURVIVORS - DESIGN v1.
 * -----------------------------------------------------------------------------
 *   - ONE hero, its REAL card (the frozen snapshot's maxHp / dmg / armour / crit / lifesteal), steered with a joystick.
 *   - Auras and the base shot fire on their own; directional things aim the way the hero moves (Phil: "aim your abilities the
 *     direction of movement"). The hero's OWN skills are buttons, roguelike style, bottom right beside the ULT (Phil 24 Oct:
 *     "like a rogue likes, the player can use their skills" / "On the bottom right of the screen"), each on its own cooldown.
 *   - Monster hordes from every side, growing with time and stage. Kills drop XP gems; a level-up offers 3 picks.
 *   - Loadout: up to 5 own skills (buttons) + 5 auras from the hero's CLASS pool of 10 + 5 passives. Auras have 10 levels; level 10 is
 *     the special form (its own art).
 *   - STORY: 30 minutes, then the stage boss; SURVIVE: endless.
 *   - DETERMINISTIC: a seed + the recorded inputs reproduce the run exactly, with no rendering, so the server can replay it
 *     (Phil 28 Sep: the player's run is the result; the replay only checks it).
 * Nothing here draws. The renderer reads state; the art keys (aura key, lv10 flag) say what to draw.
 * ============================================================================= */
(function (global) {
  "use strict";
  var TICK = 1 / 30;                              // the sim's fixed step (s)
  var STORY_SECONDS = 30 * 60;                    // Phil: "30 minutes to clear stage"
  var STAGES = 10;                                // Phil: "10 stages for now"
  var SLOTS = { aura: 5, passive: 5, skill: 5 };  // Phil: "5 skill / 5 possible aura skills / 5 possible passives"
  var AURA_MAX = 10, PASSIVE_MAX = 5;
  var MAX_MONSTERS = 300;                         // waves stop topping up at 300 alive (as Vampire Survivors does)
  var HARD_MAX = 360;                             // phone budget: bosses + map events may go over 300, never over this
  // the VIEW, in metres, the same for every player (a bigger phone must not see more of the horde). Landscape (the game is
  // landscape); Phil 24 Oct "Zoom out more the game is too zoomed in": 22 m high -> 30 m, then "just slightly more": 34 m.
  // Spawns land just outside it.
  var VIEW = { w: 72, h: 34 };
  var CELL = 2.5;                                 // spatial-hash cell (world units ~ metres)

  function mulberry32(a) { return function () { var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function r4(v) { return Math.round(v * 1e4) / 1e4; }

  /* ---- passives (Phil: "the passive are easy because they essentially wont have art") - 5 levels each ---------------------- */
  var PASSIVES = {
    might:    { name: "Might",        per: 0.10, what: "+10% damage" },
    swift:    { name: "Swiftness",    per: 0.08, what: "+8% move speed" },
    haste:    { name: "Haste",        per: 0.07, what: "-7% cooldowns" },
    reach:    { name: "Reach",        per: 0.10, what: "+10% area" },
    magnet:   { name: "Magnet",       per: 0.25, what: "+25% pickup range" },
    keen:     { name: "Keen Eye",     per: 0.05, what: "+5% crit chance" },
    leech:    { name: "Leech",        per: 0.02, what: "+2% lifesteal" },
    plating:  { name: "Plating",      per: 0.08, what: "-8% damage taken" },
    vigor:    { name: "Vigor",        per: 0.12, what: "+12% max health" },
    growth:   { name: "Growth",       per: 0.10, what: "+10% XP" },
    plenty:   { name: "Plenty",       per: 1,    what: "+1 projectile / unit (levels 2 and 4)" },
    renewal:  { name: "Renewal",      per: 0.004, what: "+0.4% max health per second" },
  };

  /* ---- aura family ladders: what levels 1..10 give (Phil's Ember Orbit example) -------------------------------------------- */
  // n = unit count, dmg = damage multiplier on the hero's attack, spd = speed factor, size = size factor, rad = reach factor,
  // cd = seconds between activations. Level 10 sets `special` (the new-art form) and is the strongest step of each ladder.
  var LADDER = {
    orbit:   [ { n: 1, dmg: 0.40, spd: 1.0, size: 1.0, rad: 1.0 }, { n: 1, dmg: 0.50, spd: 1.2, size: 1.0, rad: 1.0 }, { n: 2, dmg: 0.50, spd: 1.2, size: 1.0, rad: 1.0 },
               { n: 2, dmg: 0.62, spd: 1.2, size: 1.3, rad: 1.0 }, { n: 3, dmg: 0.62, spd: 1.4, size: 1.3, rad: 1.0 }, { n: 3, dmg: 0.75, spd: 1.4, size: 1.3, rad: 1.25 },
               { n: 4, dmg: 0.75, spd: 1.4, size: 1.3, rad: 1.25 }, { n: 4, dmg: 0.90, spd: 1.6, size: 1.3, rad: 1.25 }, { n: 5, dmg: 0.90, spd: 1.6, size: 1.3, rad: 1.25 },
               { n: 5, dmg: 1.30, spd: 1.8, size: 1.6, rad: 1.35, special: true } ],
    pulse:   [ { cd: 4.0, dmg: 0.70, rad: 2.6, rings: 1 }, { cd: 4.0, dmg: 0.85, rad: 2.6, rings: 1 }, { cd: 3.0, dmg: 0.85, rad: 2.6, rings: 1 }, { cd: 3.0, dmg: 0.85, rad: 3.2, rings: 1 },
               { cd: 3.0, dmg: 0.85, rad: 3.2, rings: 2 }, { cd: 3.0, dmg: 1.05, rad: 3.2, rings: 2, fx: 1.4 }, { cd: 2.0, dmg: 1.05, rad: 3.2, rings: 2, fx: 1.4 },
               { cd: 2.0, dmg: 1.25, rad: 3.8, rings: 2, fx: 1.4 }, { cd: 2.0, dmg: 1.25, rad: 3.8, rings: 3, fx: 1.4 }, { cd: 1.6, dmg: 1.70, rad: 4.6, rings: 3, fx: 1.8, special: true } ],
    trail:   [ { dmg: 0.25, len: 6, life: 2.0, w: 0.8 }, { dmg: 0.32, len: 6, life: 2.0, w: 0.8 }, { dmg: 0.32, len: 9, life: 2.0, w: 0.8 }, { dmg: 0.32, len: 9, life: 3.0, w: 0.8 },
               { dmg: 0.32, len: 9, life: 3.0, w: 0.8, fx: 1 }, { dmg: 0.42, len: 9, life: 3.0, w: 1.1, fx: 1 }, { dmg: 0.42, len: 12, life: 3.0, w: 1.1, fx: 1 },
               { dmg: 0.52, len: 12, life: 3.0, w: 1.1, fx: 1.5 }, { dmg: 0.52, len: 12, life: 3.0, w: 1.1, fx: 1.5, split: true }, { dmg: 0.80, len: 16, life: 4.0, w: 1.6, fx: 2, split: true, special: true } ],
    rain:    [ { cd: 3.0, n: 1, dmg: 1.0, rad: 1.2 }, { cd: 3.0, n: 1, dmg: 1.2, rad: 1.2 }, { cd: 3.0, n: 2, dmg: 1.2, rad: 1.2 }, { cd: 3.0, n: 2, dmg: 1.2, rad: 1.6 },
               { cd: 2.0, n: 2, dmg: 1.2, rad: 1.6 }, { cd: 2.0, n: 3, dmg: 1.45, rad: 1.6 }, { cd: 2.0, n: 3, dmg: 1.45, rad: 2.0 }, { cd: 2.0, n: 4, dmg: 1.45, rad: 2.0 },
               { cd: 1.5, n: 4, dmg: 1.7, rad: 2.0 }, { cd: 1.5, n: 6, dmg: 2.4, rad: 2.8, special: true } ],
    shot:    [ { cd: 2.0, n: 1, dmg: 0.9, spd: 12, pierce: 0, size: 1.0 }, { cd: 2.0, n: 1, dmg: 1.1, spd: 12, pierce: 0, size: 1.0 }, { cd: 2.0, n: 2, dmg: 1.1, spd: 12, pierce: 0, size: 1.0 },
               { cd: 2.0, n: 2, dmg: 1.1, spd: 15, pierce: 1, size: 1.0 }, { cd: 2.0, n: 3, dmg: 1.1, spd: 15, pierce: 1, size: 1.0 }, { cd: 2.0, n: 3, dmg: 1.35, spd: 15, pierce: 1, size: 1.3 },
               { cd: 2.0, n: 4, dmg: 1.35, spd: 15, pierce: 1, size: 1.3 }, { cd: 1.5, n: 4, dmg: 1.35, spd: 15, pierce: 1, size: 1.3 }, { cd: 1.5, n: 5, dmg: 1.35, spd: 15, pierce: 3, size: 1.3 },
               { cd: 1.2, n: 7, dmg: 1.9, spd: 18, pierce: 6, size: 1.6, special: true } ],
    buddy:   [ { n: 1, cd: 1.6, dmg: 0.8, range: 6 }, { n: 1, cd: 1.6, dmg: 1.0, range: 6 }, { n: 1, cd: 1.2, dmg: 1.0, range: 6 }, { n: 2, cd: 1.2, dmg: 1.0, range: 6 },
               { n: 2, cd: 1.2, dmg: 1.2, range: 8 }, { n: 2, cd: 0.9, dmg: 1.2, range: 8 }, { n: 3, cd: 0.9, dmg: 1.2, range: 8 }, { n: 3, cd: 0.9, dmg: 1.45, range: 8 },
               { n: 3, cd: 0.9, dmg: 1.45, range: 8, fx: 1 }, { n: 4, cd: 0.7, dmg: 2.0, range: 10, fx: 1.5, special: true } ],
    zone:    [ { rad: 2.0, dmg: 0.30, tick: 0.5 }, { rad: 2.0, dmg: 0.38, tick: 0.5 }, { rad: 2.5, dmg: 0.38, tick: 0.5 }, { rad: 2.5, dmg: 0.38, tick: 0.4 },
               { rad: 3.0, dmg: 0.47, tick: 0.4 }, { rad: 3.0, dmg: 0.47, tick: 0.4, fx: 1 }, { rad: 3.5, dmg: 0.47, tick: 0.4, fx: 1 }, { rad: 3.5, dmg: 0.58, tick: 0.4, fx: 1.5 },
               { rad: 4.3, dmg: 0.58, tick: 0.4, fx: 1.5 }, { rad: 5.2, dmg: 0.85, tick: 0.3, fx: 2, special: true } ],
    trigger: [ { p: 1.0 }, { p: 1.25 }, { p: 1.25, often: 1.25 }, { p: 1.25, often: 1.25, dur: 1.3 }, { p: 1.5, often: 1.25, dur: 1.3, area: 1.3 },
               { p: 1.5, often: 1.55, dur: 1.3, area: 1.3 }, { p: 1.5, often: 1.55, dur: 1.6, area: 1.3 }, { p: 1.8, often: 1.55, dur: 1.6, area: 1.3 },
               { p: 2.1, often: 1.55, dur: 1.6, area: 1.6 }, { p: 3.0, often: 2.0, dur: 2.0, area: 2.0, special: true } ],
  };
  // what a secondary effect does when it lands (the aura table's `fx` words -> one mechanic each)
  function fxKind(word) {
    var w = String(word || "").toLowerCase();
    if (/burn|bleed|poison|shock/.test(w)) return "dot";
    if (/slow|blind|charm/.test(w)) return "slow";
    if (/stun|freeze/.test(w)) return "stun";
    if (/knock/.test(w)) return "knock";
    if (/pull/.test(w)) return "pull";
    if (/vulnerab|bonus damage|crit|execute/.test(w)) return "vuln";
    if (/heal|lifesteal/.test(w)) return "heal";
    if (/block|reflect|dodge/.test(w)) return "guard";
    if (/xp/.test(w)) return "magnet";
    if (/speed/.test(w)) return "speed";
    return "none";                                  // pierce / bounce / chain are handled by the family itself
  }

  /* ---- monsters: archetypes; the stage + clock scale them ------------------------------------------------------------------ */
  // r = body radius in metres (sized to the real monster art at the 30 m view, 24 Oct: the art reads at ~1.4-6 m tall)
  var MONSTERS = {
    swarmer: { hp: 30,  dmg: 6,  spd: 2.6, r: 0.55, xp: 1 },
    brute:   { hp: 140, dmg: 14, spd: 1.5, r: 0.85, xp: 4 },
    runner:  { hp: 22,  dmg: 5,  spd: 4.2, r: 0.45, xp: 1 },
    elite:   { hp: 900, dmg: 26, spd: 1.8, r: 1.20, xp: 25 },
    boss:    { hp: 24000, dmg: 45, spd: 1.6, r: 2.20, xp: 0 },
    wall:    { hp: 260, dmg: 12, spd: 0.9, r: 0.90, xp: 3 },     // slow and tanky: wall waves + the encircling wall event
    caster:  { hp: 26,  dmg: 4,  spd: 2.8, r: 0.50, xp: 2 },      // keeps its distance and shoots a slow bolt you can dodge
  };
  // CASTERS (Phil 24 Oct: "projectiles you can dodge if they are casters"): a caster holds ~8 m off and, every 3-4.5 s, fires one
  // slow bolt at where the hero IS - keep moving and it misses. The stage boss fires a 5-bolt fan every 4 s.
  var CAST = { range: 8, cd: 3.2, cdRand: 1.3, speed: 7, r: 0.35, life: 2.6, dmgMul: 1.1, maxShots: 60 };
  /* ROSTERS: which of OUR monsters wear each role on a stage (in-game keys, as in MONSTER_TYPES). Stage 1 = Emberfall Vale, the
   * campaign's Chapter 1 cast: fodder = Ooznik / Skulk, fast = Cinder Skulk, casters (the Mage-role flyers) = Sootwing Imp /
   * Vexmite / Skarrn, heavies =
   * Grushak / Cindertusk, the slow wall = Shellwark, elites = Grushak (Cindertusk for the 3x "big" one), the stage boss = Brukk,
   * Master of the Black Kiln (Chapter 1's own x-10 boss). Stages without a roster yet borrow Stage 1's. The skin is cosmetic:
   * the role's numbers drive the fight. */
  var ROSTERS = {
    1: { name: "Emberfall Vale", swarmer: ["ooznik", "skulk"], runner: ["cinder skulk"], caster: ["sootwing imp", "vexmite", "skarrn"],
         brute: ["grushak", "cindertusk"], wall: ["shellwark"], elite: ["grushak"], big: ["cindertusk"], boss: ["brukk"] },
  };
  function roster(stage) { return ROSTERS[stage] || ROSTERS[1]; }

  /* ---- WAVES, the Vampire Survivors way (studied 24 Oct 2026 from its first stage's wave table; notes in the design folder:
   * "HERO SURVIVORS - WAVES STUDY (Claude 24 Oct).md"). One wave per minute. Each wave has:
   *   min  - the horde it keeps alive: every interval, if fewer than min are alive it tops up to min at once
   *   iv   - the interval in seconds; at or above min it adds ONE of each type in the wave per interval
   *   ty   - the monster types of that minute
   *   boss - an elite at the start of the minute ("big" = a 3x elite)
   *   ev   - a map event: swarm = a pack that sweeps straight across, wall = a ring that closes in; n repeats, p chance each
   * The count is NOT a rising line: it breathes - lulls (min 10-20) right after spikes (min 300 at 0.1 s), so a run has rhythm.
   * Waves stop topping up at 300 alive. The stage multiplies HP (stageScale) and a little of the min; time multiplies HP (clockScale).
   * Row i is minute i of a 30-minute stage; after 30:00 Story has its boss, Survive loops minutes 20-29. */
  var WAVES = [
    { min: 15,  iv: 1.0,  ty: ["swarmer"] },
    { min: 30,  iv: 1.0,  ty: ["swarmer", "runner"], boss: "elite" },
    { min: 50,  iv: 0.5,  ty: ["swarmer", "runner", "caster"], ev: { k: "swarm", n: 3, p: 1 } },
    { min: 40,  iv: 0.25, ty: ["swarmer"], boss: "elite", ev: { k: "swarm", n: 2, p: 0.1 } },
    { min: 30,  iv: 1.0,  ty: ["swarmer", "runner"], ev: { k: "swarm", n: 2, p: 0.1 } },
    { min: 10,  iv: 1.0,  ty: ["brute"], boss: "big", ev: { k: "wall", n: 1, p: 1, dur: 30 } },
    { min: 20,  iv: 0.5,  ty: ["swarmer", "brute"], ev: { k: "swarm", n: 2, p: 0.1 } },
    { min: 80,  iv: 0.5,  ty: ["runner", "caster", "brute"], boss: "elite", ev: { k: "swarm", n: 6, p: 0.8 } },
    { min: 100, iv: 1.5,  ty: ["swarmer"], boss: "elite", ev: { k: "swarm", n: 3, p: 0.8 } },
    { min: 30,  iv: 0.5,  ty: ["brute", "swarmer"], boss: "elite", ev: { k: "swarm", n: 3, p: 0.7 } },
    { min: 10,  iv: 0.5,  ty: ["brute", "brute"], boss: "big", ev: { k: "wall", n: 1, p: 1, dur: 60 } },
    { min: 300, iv: 0.1,  ty: ["swarmer"], boss: "elite", ev: { k: "swarm", n: 2, p: 0.1 } },
    { min: 20,  iv: 0.25, ty: ["caster", "swarmer", "swarmer"], boss: "elite", ev: { k: "swarm", n: 2, p: 0.1 } },
    { min: 150, iv: 0.5,  ty: ["runner", "swarmer"], ev: { k: "swarm", n: 6, p: 0.7 } },
    { min: 20,  iv: 0.1,  ty: ["brute", "runner"], boss: "elite" },
    { min: 100, iv: 0.1,  ty: ["runner", "brute", "brute"], boss: "big", ev: { k: "wall", n: 1, p: 0.8, dur: 60 } },
    { min: 100, iv: 0.1,  ty: ["caster", "brute", "brute"], boss: "elite" },
    { min: 20,  iv: 1.0,  ty: ["brute"] },
    { min: 60,  iv: 0.5,  ty: ["brute", "brute"], boss: "elite" },
    { min: 100, iv: 0.5,  ty: ["brute", "brute"] },
    { min: 100, iv: 0.1,  ty: ["brute", "brute", "runner"], boss: "big", ev: { k: "swarm", n: 6, p: 0.7 } },
    { min: 300, iv: 0.1,  ty: ["wall"], boss: "elite" },
    { min: 200, iv: 0.1,  ty: ["wall", "brute"], boss: "elite" },
    { min: 300, iv: 0.1,  ty: ["wall", "brute"], boss: "elite" },
    { min: 300, iv: 0.1,  ty: ["wall", "brute"], boss: "elite" },
    { min: 100, iv: 0.1,  ty: ["brute"], boss: "big", ev: { k: "wall", n: 6, p: 1, dur: 10 } },
    { min: 150, iv: 0.1,  ty: ["brute", "wall"] },
    { min: 300, iv: 0.1,  ty: ["brute", "brute", "brute"], boss: "elite", ev: { k: "swarm", n: 6, p: 1 } },
    { min: 300, iv: 0.1,  ty: ["runner", "runner", "caster"] },
    { min: 300, iv: 0.1,  ty: ["runner", "runner", "caster"], boss: "elite", ev: { k: "swarm", n: 20, p: 1 } },
  ];
  function waveIndex(t) { var w = Math.floor(t / 60); return w < WAVES.length ? w : 20 + (w - WAVES.length) % 10; }
  function stageScale(stage) { return Math.pow(1.6, (stage | 0) - 1); }        // each stage ~1.6x the last
  function clockScale(t) { return 1 + t / 300; }                               // +100% every 5 minutes inside a run

  /* ---- create a run ---------------------------------------------------------------------------------------------------------
   * hero: { key, cls, maxHp, atk, armor, crit, critDmg, lifesteal, speedMul } - from the real hero card snapshot
   * opts: { mode: 'story'|'survive', stage: 1..10, seed, auras: [aura table rows] } */
  function create(hero, opts) {
    opts = opts || {};
    var seed = (opts.seed >>> 0) || 1;
    var S = {
      v: 1, seed: seed, rng: mulberry32(seed), tick: 0, t: 0,
      mode: opts.mode === "survive" ? "survive" : "story", stage: clamp(opts.stage | 0 || 1, 1, STAGES),
      aurasTable: (opts.auras || []).filter(function (a) { return a && a.cls === hero.cls; }),
      hero: {
        key: hero.key, cls: hero.cls, x: 0, y: 0, dirx: 1, diry: 0, mvx: 0, mvy: 0,
        baseHp: Math.max(1, +hero.maxHp || 500), maxHp: Math.max(1, +hero.maxHp || 500), hp: Math.max(1, +hero.maxHp || 500),
        atk: Math.max(1, +hero.atk || 40), armor: Math.max(0, +hero.armor || 0), crit: clamp(+hero.crit || 0.05, 0, 1),
        critDmg: Math.max(0.5, +hero.critDmg || 0.6), lifesteal: Math.max(0, +hero.lifesteal || 0), speed: 4.0 * (+hero.speedMul || 1),
        level: 1, xp: 0, xpNext: 5, iframes: 0, ult: 0, ultMax: 100,
        auras: {}, passives: {}, skills: {},
        kit: (hero.skills || []).slice(0, SLOTS.skill).map(function (k) {
          return { key: String(k.key), name: String(k.name || k.key), kind: SKILL_KINDS[k.kind] ? k.kind : "nova",
                   cd: Math.max(1, +k.cd || 10), power: Math.max(0, +k.power || 1), dur: Math.max(0, +k.dur || 0), cdLeft: 0 };
        }),
        wardT: 0,
      },
      monsters: [], nextId: 1, gems: [], shots: [], zones: [], fx: [], rollers: [], notes: [],
      bossSpawned: false, boss: null, noSpawn: false, eshots: [],
      choice: null, kills: 0, dealt: 0, taken: 0, ended: false, won: false, score: 0,
      inputs: [],                                   // the run's input log - replayed by the server
      _state: {},                                   // per-aura timers
    };
    return S;
  }

  /* ---- derived stats from passives -------------------------------------------------------------------------------------------- */
  function pas(S, k) { return (S.hero.passives[k] | 0) * PASSIVES[k].per; }
  function heroDmg(S, mul) {
    var h = S.hero, d = h.atk * mul * (1 + pas(S, "might"));
    if (S.rng() < h.crit + pas(S, "keen")) d *= 1 + h.critDmg;
    return d;
  }
  function areaMul(S) { return 1 + pas(S, "reach"); }
  function cdMul(S) { return Math.max(0.35, 1 - pas(S, "haste")); }
  function plenty(S) { var l = S.hero.passives.plenty | 0; return l >= 4 ? 2 : l >= 2 ? 1 : 0; }

  /* ---- spatial hash over monsters (rebuilt each tick) ----------------------------------------------------------------------- */
  function buildGrid(S) {
    var g = {};
    for (var i = 0; i < S.monsters.length; i++) { var m = S.monsters[i]; var k = Math.floor(m.x / CELL) + "," + Math.floor(m.y / CELL); (g[k] || (g[k] = [])).push(m); }
    S._grid = g;
  }
  function near(S, x, y, rad, fn) {
    var g = S._grid, c0 = Math.floor((x - rad) / CELL), c1 = Math.floor((x + rad) / CELL), r0 = Math.floor((y - rad) / CELL), r1 = Math.floor((y + rad) / CELL), rr = rad * rad;
    for (var cx = c0; cx <= c1; cx++) for (var cy = r0; cy <= r1; cy++) {
      var b = g[cx + "," + cy]; if (!b) continue;
      for (var i = 0; i < b.length; i++) { var m = b[i]; if (m.hp <= 0) continue; var dx = m.x - x, dy = m.y - y, rm = rad + m.r; if (dx * dx + dy * dy <= rm * rm) fn(m, dx, dy); }
    }
  }
  function nearest(S, x, y, rad) { var best = null, bd = 1e18; near(S, x, y, rad, function (m, dx, dy) { var d = dx * dx + dy * dy; if (d < bd) { bd = d; best = m; } }); return best; }

  /* ---- damage and effects ---------------------------------------------------------------------------------------------------- */
  function hit(S, m, amount, kind, power) {
    if (!m || m.hp <= 0) return;
    if (m.vuln > 0) amount *= 1.25;
    if (m.frozenT > 0 && amount > 0) { amount *= 2; m.frozenT = 0; m.shatter = 0.3; }        // Frost Nova: a frozen monster shatters
    if (m.marked) amount *= 2;                                                                 // Death Mark: double damage
    m.hp -= amount; S.dealt += amount; S.hero.ult = Math.min(S.hero.ultMax, S.hero.ult + amount * 0.002);
    var ls = S.hero.lifesteal + pas(S, "leech"); if (ls > 0) S.hero.hp = Math.min(S.hero.maxHp, S.hero.hp + amount * ls * 0.1);
    power = power || 1;
    if (kind === "dot") m.dot = Math.max(m.dot || 0, amount * 0.15 * power), m.dotT = 2.0;
    else if (kind === "slow") m.slowT = Math.max(m.slowT || 0, 1.0 * power);
    else if (kind === "stun") m.stunT = Math.max(m.stunT || 0, 0.35 * power);
    else if (kind === "knock" || kind === "pull") {
      var dx = m.x - S.hero.x, dy = m.y - S.hero.y, d = Math.sqrt(dx * dx + dy * dy) || 1, s = (kind === "knock" ? 0.9 : -0.6) * power;
      m.x += dx / d * s; m.y += dy / d * s;
    } else if (kind === "vuln") m.vuln = Math.max(m.vuln || 0, 2.0 * power);
    if (m.marked && m.hp > 0 && m.type !== "boss" && m.hp < m.maxHp * (m.exec || 0.2)) { m.hp = 0; m.executed = 1; }   // ...and executed under the line
    if (m.hp <= 0) kill(S, m);
  }
  function kill(S, m) {
    S.kills++; (S._kills || (S._kills = [])).push([m.x, m.y]);
    if (m.type === "boss") { S.won = true; S.ended = true; }
    if (m.type === "elite") S.gems.push({ x: m.x, y: m.y, v: 0, heal: 0.25 });   // an elite drops a heal orb (25% max HP), as Vampire Survivors' floor food
    if (MONSTERS[m.type].xp) {
      if (S.gems.length < 400) S.gems.push({ x: m.x, y: m.y, v: MONSTERS[m.type].xp });
      else { var gk = S.gems[S.tick % 400]; if (!gk.heal) gk.v += MONSTERS[m.type].xp; }                 // phone budget: past 400 gems, XP folds into an old one
    }
    var trig = S.hero._onKill; if (trig) trig(m);
  }

  /* ===== SPELLS v3: one behaviour per spell (Phil 24 Oct: "All of them should be different in nature" / "Not repeating").
   * Design table: taskings/.../HERO SURVIVORS - 60 SPELLS v3 - EACH UNIQUE (Claude 24 Oct).md. A spell with an entry here runs
   * ITS function; the rest still use the v2 shared family until their turn. lin(lv, a, b) = a at level 1 .. b at level 9;
   * level 10 is each spell's final form. Everything is deterministic (S.rng only), so the server replay matches.          */
  function lin(lv, a, b) { return a + (b - a) * (Math.min(lv, 9) - 1) / 8; }
  function segDist(px, py, x, y, ang, len) { var ux = Math.cos(ang), uy = Math.sin(ang), t = clamp((px - x) * ux + (py - y) * uy, 0, len), qx = x + ux * t - px, qy = y + uy * t - py; return Math.sqrt(qx * qx + qy * qy); }
  // the shield bubble (Blessed Shield) soaks damage before HP
  function absorb(S, a) { var h = S.hero; if (h.bubble > 0) { var t = Math.min(h.bubble, a); h.bubble -= t; a -= t; if (h.bubble <= 0) { h.bubble = 0; h.bubblePopped = true; } } return a; }
  function crack(S, key, x, y, ang, len, w, dmg, life, fk) { S.zones.push({ kind: "crack", key: key, x: x, y: y, ang: ang, len: len, w: w, t: 0, life: life, grow: 0.25, dmg: dmg, fk: fk, hit: {}, tick: 0 }); }
  var SPELL = {
    // 2. ripples of spikes roll OUTWARD; L10 the hedge stays up round you and roots what touches it
    "spike-ring": function (S, st, lv, dt, h, am) {
      if (lv >= 10) { st.hedge = 4.5 * am; st.t -= dt; if (st.t > 0) return; st.t = 0.4;
        near(S, h.x, h.y, st.hedge + 0.9, function (m, dx, dy) { if (Math.abs(Math.sqrt(dx * dx + dy * dy) - st.hedge) <= m.r + 0.6) { m.stunT = Math.max(m.stunT || 0, 0.7); hit(S, m, heroDmg(S, 0.9), "none"); } }); return; }
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 4, 2) * cdMul(S);
      var waves = lv >= 9 ? 3 : lv >= 5 ? 2 : 1, R = lin(lv, 4, 7) * am;
      for (var k = 0; k < waves; k++) S.zones.push({ kind: "ripple", key: "spike-ring", x: h.x, y: h.y, r0: 0.6, r1: R, t: 0, life: 0.55, delay: k * 0.35, n: Math.round(lin(lv, 10, 22)), dmg: heroDmg(S, lin(lv, 0.8, 1.6)), fk: "stun", fp: 1.5, hit: {} });
    },
    // 3. plates hover IN FRONT and shove the horde ahead (and stop bolts); L10 a full turning wall round you
    "iron-bulwark": function (S, st, lv, dt, h, am) {
      st.t = (st.t || 0) - dt; var tick = st.t <= 0; if (tick) st.t = 0.3;
      if (lv >= 10) { st.a = (st.a || 0) + dt * 0.8; var R = 2.6 * am; st.plates = null;
        for (var e = S.eshots.length - 1; e >= 0; e--) { var es = S.eshots[e], ex = es.x - h.x, ey = es.y - h.y; if (Math.abs(Math.sqrt(ex * ex + ey * ey) - R) < 0.6) S.eshots.splice(e, 1); }
        if (tick) near(S, h.x, h.y, R + 0.9, function (m, dx, dy) { if (Math.abs(Math.sqrt(dx * dx + dy * dy) - R) <= m.r + 0.6) hit(S, m, heroDmg(S, 1.2), "knock", 2.5); }); return; }
      var n = lv >= 7 ? 4 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1, D = 1.9 * am, px = -h.diry, py = h.dirx, push = lin(lv, 1.0, 2.0); st.plates = [];
      for (var i = 0; i < n; i++) { var off = (i - (n - 1) / 2) * 1.15 * am, x = h.x + h.dirx * D + px * off, y = h.y + h.diry * D + py * off; st.plates.push([x, y]);
        for (var e2 = S.eshots.length - 1; e2 >= 0; e2--) { var b = S.eshots[e2], bx = b.x - x, by = b.y - y; if (bx * bx + by * by < 0.8) S.eshots.splice(e2, 1); }
        if (tick) near(S, x, y, 0.8 * am, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.5, 1.0)), "none"); m.x += h.dirx * push; m.y += h.diry * push; }); }
    },
    // 4. every few steps a crack shoots FORWARD and forks; L10 one fissure across the screen
    "quake-step": function (S, st, lv, dt, h, am) {
      if (h.mvx || h.mvy) st.walk = (st.walk || 0) + h.speed * dt;
      if ((st.walk || 0) < (lv >= 10 ? 6 : lin(lv, 3.0, 1.8))) return; st.walk = 0;
      var a0 = Math.atan2(h.diry, h.dirx), d = heroDmg(S, lin(lv, 0.9, 1.8));
      if (lv >= 10) { crack(S, "quake-step", h.x, h.y, a0, VIEW.w / 2 * am, 1.6, heroDmg(S, 2.5), 3.3, "slow"); return; }
      var len = lin(lv, 4, 8) * am, forks = lv >= 7 ? 2 : lv >= 3 ? 1 : 0; crack(S, "quake-step", h.x, h.y, a0, len, 0.7, d, 0.8, "slow");
      for (var f = 1; f <= forks; f++) crack(S, "quake-step", h.x + Math.cos(a0) * len * 0.5, h.y + Math.sin(a0) * len * 0.5, a0 + (f % 2 ? 0.5 : -0.5), len * 0.55, 0.6, d, 0.8, "slow");
    },
    // 5. a monster that hits you gets LASHED by a vine (and, higher, its neighbours); L10 a thicket grows out in 8 directions
    "thorn-hide": function (S, st, lv, dt, h, am) {
      var extra = Math.floor(lin(lv, 0, 3)), reach = lin(lv, 3, 6) * am;
      function lash(m) { hit(S, m, heroDmg(S, lin(lv, 1.2, 2.6)), "dot", 1.5); S.fx.push({ kind: "lash", key: "thorn-hide", x: h.x, y: h.y, tx: m.x, ty: m.y, t: 0, life: 0.3 }); }
      (S._hurtPrev || []).forEach(function (m) { if (m.hp <= 0) return; lash(m); var c = 0; if (extra) near(S, h.x, h.y, reach, function (o) { if (o !== m && c < extra) { c++; lash(o); } }); });
      if (lv >= 10) { st.t -= dt; if (st.t <= 0) { st.t = 3; for (var i = 0; i < 8; i++) crack(S, "thorn-hide", h.x, h.y, i * Math.PI / 4 + S.t * 0.7, 6 * am, 0.8, heroDmg(S, 2), 1.2, "dot"); } }
    },
    // 6. the roar SUCKS monsters in, then stuns them in a heap; L10 the whole screen
    "taunting-roar": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 7, 4) * cdMul(S);
      var R = lv >= 10 ? VIEW.w / 2 : lin(lv, 6, 9) * am, stun = lin(lv, 1.0, 2.0), d = heroDmg(S, lin(lv, 0.6, 1.2));
      near(S, h.x, h.y, R, function (m) { if (m.type === "boss") return; m.pullT = 0.45; m.pullStun = stun; m.pullDmg = d; });
      S.zones.push({ kind: "roar", key: "taunting-roar", x: h.x, y: h.y, r0: R, r1: 0.5, t: 0, life: 0.45, delay: 0, hit: {} });
    },
    // 7. a boulder ROLLS forward, GROWING as it goes, then crumbles; L10 a mountain rolls the screen
    "boulder-roll": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 4, 2.5) * cdMul(S);
      var big = lv >= 10, n = !big && lv >= 7 ? 2 : 1, a0 = Math.atan2(h.diry, h.dirx);
      for (var i = 0; i < n; i++) { var a = a0 + (n > 1 ? (i ? 0.35 : -0.35) : 0), sp = big ? 7 : 6;
        S.rollers.push({ key: "boulder-roll", x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: (big ? 3 : lin(lv, 0.6, 1.0)) * am, grow: big ? 0 : lin(lv, 0.25, 0.45) * am,
                         rmax: (big ? 3 : lin(lv, 1.6, 2.6)) * am, life: big ? 6 : lin(lv, 3, 5), dmg: heroDmg(S, big ? 6 : lin(lv, 1.2, 2.4)), hit: {}, big: big ? 1 : 0 }); }
    },
    // 8. lava wells up where you STAND STILL and widens the longer you hold; walk off and it cools
    "molten-ground": function (S, st, lv, dt, h, am) {
      var still = !(h.mvx || h.mvy), max = (lv >= 10 ? 9 : lin(lv, 2.5, 4.5)) * am, p = st.pool;
      if (still) { if (!p || p.cool) p = st.pool = { x: h.x, y: h.y, r: 0.6, cool: false, heat: 1 }; p.r = Math.min(max, p.r + dt * lin(lv, 0.8, 1.6) * (lv >= 10 ? 2 : 1)); p.heat = 1; }
      else if (p && !p.cool) { var dx = h.x - p.x, dy = h.y - p.y; if (dx * dx + dy * dy > (p.r * 0.5 + 0.5) * (p.r * 0.5 + 0.5)) p.cool = true; }
      if (p && p.cool) { p.heat -= dt / 1.5; if (p.heat <= 0) { st.pool = null; return; } }
      if (!p) return; st.t -= dt; if (st.t > 0) return; st.t = 0.5;
      near(S, p.x, p.y, p.r, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.5, 1.0) * p.heat), "slow", 1.5); });
    },
    // 9. a dome DROPS where you are and stays: monsters inside crawl, you take less inside; L10 a golden sphere that travels with you
    "bastion-dome": function (S, st, lv, dt, h, am) {
      h.domeDR = 0;
      if (lv >= 10) st.dome = { x: h.x, y: h.y, r: 3.5 * am, life: 1, max: 1, follow: 1 };
      else { st.t -= dt; if (st.t <= 0) { st.t = lin(lv, 12, 7) * cdMul(S); var L = lin(lv, 5, 8); st.dome = { x: h.x, y: h.y, r: lin(lv, 3, 4.5) * am, life: L, max: L }; }
        if (st.dome) { st.dome.life -= dt; if (st.dome.life <= 0) st.dome = null; } }
      var dm = st.dome; if (!dm) return;
      near(S, dm.x, dm.y, dm.r, function (m) { m.slowT = Math.max(m.slowT || 0, 0.3); });
      var dx = h.x - dm.x, dy = h.y - dm.y; if (dx * dx + dy * dy <= dm.r * dm.r) h.domeDR = lv >= 10 ? 0.5 : lin(lv, 0.4, 0.6);
      if (lv >= 10) for (var e = S.eshots.length - 1; e >= 0; e--) { var es = S.eshots[e], ex = es.x - dm.x, ey = es.y - dm.y; if (ex * ex + ey * ey <= dm.r * dm.r) S.eshots.splice(e, 1); }
    },
    // 10. rocks fall on the THICKEST crowd on screen; L10 one colossal rock
    "avalanche-fall": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = (lv >= 10 ? 5 : lin(lv, 3, 2)) * cdMul(S);
      var best = null, bc = 0;
      for (var k in S._grid) { var b = S._grid[k]; if (b.length > bc && Math.abs(b[0].x - h.x) < VIEW.w / 2 && Math.abs(b[0].y - h.y) < VIEW.h / 2) { bc = b.length; best = b[0]; } }
      var tx = best ? best.x : h.x + h.dirx * 6, ty = best ? best.y : h.y + h.diry * 6;
      if (lv >= 10) { S.zones.push({ kind: "drop", key: "avalanche-fall", x: tx, y: ty, r1: 5 * am, t: 0, life: 0.3, delay: 0.9, dmg: heroDmg(S, 8), fk: "stun", fp: 3, hit: {}, big: 1 }); return; }
      for (var j = 0, n = Math.round(lin(lv, 1, 4)); j < n; j++) S.zones.push({ kind: "drop", key: "avalanche-fall", x: tx + (S.rng() - 0.5) * 3, y: ty + (S.rng() - 0.5) * 3, r1: lin(lv, 1.4, 2.2) * am, t: 0, life: 0.15, delay: 0.6 + j * 0.1, dmg: heroDmg(S, lin(lv, 1.4, 2.6)), fk: "stun", fp: 1.5, hit: {} });
    },
    // ===== SUPPORT =====
    // 31. a halo over your head heals you; its light slowly PURIFIES monsters standing in it; L10 the light fills the screen
    "halo-of-light": function (S, st, lv, dt, h, am) {
      st.r = (lv >= 10 ? VIEW.h / 2 : lin(lv, 3, 5.5)) * am; st.t -= dt; if (st.t > 0) return; st.t = 0.5;
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * lin(lv, 0.002, 0.004) * (lv >= 10 ? 1.5 : 1));
      near(S, h.x, h.y, st.r, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.25, 0.5) * (lv >= 10 ? 1.4 : 1)), "none"); });
    },
    // 32. notes float out on a WAVY line; a monster hit is CHARMED and fights the horde; L10 notes spiral out every way
    "song-notes": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 2.4, 1.4) * cdMul(S);
      var n = lv >= 10 ? 8 : Math.round(lin(lv, 1, 3)), a0 = Math.atan2(h.diry, h.dirx);
      for (var i = 0; i < n; i++) { var a = lv >= 10 ? a0 + i * Math.PI / 4 : a0 + (i - (n - 1) / 2) * 0.25;
        S.notes.push({ key: "song-notes", x0: h.x, y0: h.y, ang: a, t: 0, sp: 7, amp: 1.1 * am, fq: 6, life: 1.8, spiral: lv >= 10 ? 1 : 0, hit: {}, dmg: heroDmg(S, lin(lv, 0.6, 1.1)), charm: lin(lv, 2, 4) }); }
    },
    // 33. a holy circle is laid WHERE YOU STAND and stays; monsters in it crawl; L10 it follows you
    "sanctuary": function (S, st, lv, dt, h, am) {
      if (lv >= 10) st.c = { x: h.x, y: h.y, r: 5 * am, life: 1, max: 1, follow: 1 };
      else { st.t -= dt; if (st.t <= 0) { st.t = lin(lv, 10, 6) * cdMul(S); var L = lin(lv, 6, 10); st.c = { x: h.x, y: h.y, r: lin(lv, 3, 5) * am, life: L, max: L }; }
        if (st.c) { st.c.life -= dt; if (st.c.life <= 0) st.c = null; } }
      var c = st.c; if (!c) return; st.k = (st.k || 0) - dt; var tick = st.k <= 0; if (tick) st.k = 0.5;
      near(S, c.x, c.y, c.r, function (m) { m.slowT = Math.max(m.slowT || 0, 0.4); m.crawl = 1; if (tick) hit(S, m, heroDmg(S, lin(lv, 0.15, 0.35)), "none"); });
    },
    // 34. a beam SWEEPS ROUND you like a lighthouse and blinds; L10 six coloured beams
    "prism-beam": function (S, st, lv, dt, h, am) {
      st.a = (st.a || 0) + dt * lin(lv, 1.6, 2.6); st.len = (lv >= 10 ? 12 : lin(lv, 6, 10)) * am; st.n = lv >= 10 ? 6 : lv >= 6 ? 2 : 1;
      st.t -= dt; if (st.t > 0) return; st.t = 0.2;
      for (var i = 0; i < st.n; i++) { var a = st.a + i * Math.PI * 2 / st.n;
        near(S, h.x + Math.cos(a) * st.len / 2, h.y + Math.sin(a) * st.len / 2, st.len / 2 + 0.6, function (m) { if (segDist(m.x, m.y, h.x, h.y, a, st.len) <= 0.55 + m.r) { hit(S, m, heroDmg(S, lin(lv, 0.3, 0.6)), "none"); m.blindT = Math.max(m.blindT || 0, lin(lv, 0.8, 1.6)); } }); }
    },
    // 35. a bubble soaks damage, then POPS in a burst and regrows; L10 the pop flares angel wings: untouchable + a feather burst
    "blessed-shield": function (S, st, lv, dt, h, am) {
      var cap = h.maxHp * lin(lv, 0.1, 0.25) * (lv >= 10 ? 1.3 : 1);
      if (h.bubblePopped) { h.bubblePopped = false; st.t = lin(lv, 9, 5) * cdMul(S);
        S.zones.push({ kind: "ripple", key: "blessed-shield", x: h.x, y: h.y, r0: 0.5, r1: lin(lv, 3, 5) * am * (lv >= 10 ? 1.5 : 1), t: 0, life: 0.4, delay: 0, n: 12, dmg: heroDmg(S, lin(lv, 1.0, 2.0)), fk: "knock", fp: 1.5, hit: {} });
        if (lv >= 10) { h.iframes = Math.max(h.iframes, 3); h.wings = 3; } }
      if (h.wings > 0) h.wings -= dt;
      if (!(h.bubble > 0)) { st.t -= dt; if (st.t <= 0) h.bubble = cap; }
      h.bubbleMax = cap;
    },
    // 36. a lantern floats out to GATHER XP GEMS, lighting monsters as it passes; L10 every 10 s it calls in every gem on screen
    "spirit-lantern": function (S, st, lv, dt, h, am) {
      if (st.lx == null) { st.lx = h.x; st.ly = h.y; }
      var R = lin(lv, 6, 12) * am, tgt = null, bd = R * R;
      for (var i = 0; i < S.gems.length; i++) { var gm = S.gems[i], gx = gm.x - h.x, gy = gm.y - h.y, gd = gx * gx + gy * gy; if (gd < bd) { bd = gd; tgt = gm; } }
      var tx = tgt ? tgt.x : h.x + 1.5, ty = tgt ? tgt.y : h.y - 1.5, dx = tx - st.lx, dy = ty - st.ly, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = lin(lv, 8, 12) * dt;
      st.lx += dx / d * Math.min(d, sp); st.ly += dy / d * Math.min(d, sp);
      S.gems.forEach(function (gm) { var ex = gm.x - st.lx, ey = gm.y - st.ly; if (ex * ex + ey * ey < 1.2) { gm.x = h.x; gm.y = h.y; } });   // carried home
      st.k = (st.k || 0) - dt; if (st.k <= 0) { st.k = 0.4; near(S, st.lx, st.ly, 1.4, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.3, 0.6)), "none"); }); }
      if (lv >= 10) { st.t -= dt; if (st.t <= 0) { st.t = 10; st.call = 1.2; S.gems.forEach(function (gm) { if (Math.abs(gm.x - h.x) < VIEW.w / 2 && Math.abs(gm.y - h.y) < VIEW.h / 2) { gm.x = h.x; gm.y = h.y; } }); } if (st.call > 0) st.call -= dt; }
    },
    // 37. flowers bloom where you walk; walk back OVER one and it bursts in healing pollen; L10 they burst on their own
    "bloom-path": function (S, st, lv, dt, h, am) {
      st.fl = st.fl || []; var max = Math.round(lin(lv, 12, 30));
      if (h.mvx || h.mvy) { st.walk = (st.walk || 0) + h.speed * dt; if (st.walk >= 1.5) { st.walk = 0; st.fl.push({ x: h.x, y: h.y, age: 0 }); if (st.fl.length > max) st.fl.shift(); } }
      var R = lin(lv, 2.2, 3.2) * am;
      for (var i = st.fl.length - 1; i >= 0; i--) { var f = st.fl[i]; f.age += dt; var dx = h.x - f.x, dy = h.y - f.y;
        if ((f.age > 2 && dx * dx + dy * dy < 1.0) || (lv >= 10 && f.age > 3)) {
          h.hp = Math.min(h.maxHp, h.hp + h.maxHp * lin(lv, 0.01, 0.02));
          near(S, f.x, f.y, R, function (m) { hit(S, m, heroDmg(S, lin(lv, 1.0, 2.0)), "none"); });
          S.fx.push({ kind: "pollen", key: "bloom-path", x: f.x, y: f.y, r: R, t: 0, life: 0.6 }); st.fl.splice(i, 1); } }
    },
    // 38. a chime RINGS: thin echo rings roll out one after another, the last one stuns; L10 a giant bell drops from the sky
    "chime-pulse": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 4, 2.5) * cdMul(S);
      if (lv >= 10) { S.zones.push({ kind: "drop", key: "chime-pulse", x: h.x, y: h.y, r1: 8 * am, t: 0, life: 0.3, delay: 0.8, dmg: heroDmg(S, 3), fk: "stun", fp: 5, hit: {}, big: 1 }); return; }
      var k = Math.round(lin(lv, 2, 5)), R = lin(lv, 4, 6) * am;
      for (var i = 0; i < k; i++) S.zones.push({ kind: "ripple", key: "chime-pulse", x: h.x, y: h.y, r0: 0.5, r1: R, t: 0, life: 0.5, delay: i * 0.22, n: 0, dmg: heroDmg(S, lin(lv, 0.4, 0.7)), fk: i === k - 1 ? "stun" : "none", fp: 3, hit: {} });
    },
    // 39. spirits STAND GUARD at the corners of a square round you: they block what comes (and bolts); L10 a ring of 8 ancestors
    "guardian-spirits": function (S, st, lv, dt, h, am) {
      var n = lv >= 10 ? 8 : lv >= 7 ? 4 : lv >= 4 ? 3 : 2, R = (lv >= 10 ? 3 : 2.4) * am; st.sp = [];
      for (var i = 0; i < n; i++) { var a = (lv >= 10 ? i / n : (i / 4 + 0.125)) * Math.PI * 2; st.sp.push([h.x + Math.cos(a) * R, h.y + Math.sin(a) * R]); }
      st.k = (st.k || 0) - dt; var tick = st.k <= 0; if (tick) st.k = 0.35;
      st.sp.forEach(function (p) {
        for (var e = S.eshots.length - 1; e >= 0; e--) { var es = S.eshots[e], ex = es.x - p[0], ey = es.y - p[1]; if (ex * ex + ey * ey < 1.0) S.eshots.splice(e, 1); }
        if (tick) near(S, p[0], p[1], 0.9 * am, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.5, 1.0)), "none"); var dx = m.x - h.x, dy = m.y - h.y, d = Math.sqrt(dx * dx + dy * dy) || 1; m.x += dx / d * lin(lv, 1.2, 2.2); m.y += dy / d * lin(lv, 1.2, 2.2); }); });
    },
    // 40. (v2, Phil 24 Oct: "sunburst is lame") the star BURSTS OUT as a ring of sun rays flying outward, burning and blinding each
    // monster they pass; L10 DAWNBREAK: a sun hangs over you, firing a turning wheel of 12 rays every 0.8 s and scorching what is near
    "sunburst": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt;
      var big = lv >= 10, n = big ? 12 : Math.round(lin(lv, 8, 16)), range = (big ? 14 : lin(lv, 7, 11)) * am;
      if (st.t <= 0) { st.t = big ? 0.8 : lin(lv, 6, 3.5) * cdMul(S); st.flash = big ? 0.12 : 0.25; st.wheel = (st.wheel || 0) + (big ? 0.26 : 0.4);
        for (var i = 0; i < n; i++) st.o.push({ a: st.wheel + i * Math.PI * 2 / n, d: 0.6, R: range, hit: {} }); }
      for (var k = st.o.length - 1; k >= 0; k--) { var r = st.o[k]; r.d += dt * 15; if (r.d >= r.R) { st.o.splice(k, 1); continue; }
        r.x = h.x + Math.cos(r.a) * r.d; r.y = h.y + Math.sin(r.a) * r.d;
        near(S, r.x, r.y, 0.8 * am, function (m) { if (r.hit[m.id]) return; r.hit[m.id] = 1; hit(S, m, heroDmg(S, big ? 1.3 : lin(lv, 0.8, 1.4)), "dot", 1); m.blindT = Math.max(m.blindT || 0, lin(lv, 1.0, 2.5)); }); }
      if (big) { st.sun = 1; st.k = (st.k || 0) - dt; if (st.k <= 0) { st.k = 0.5; near(S, h.x, h.y, 3 * am, function (m) { hit(S, m, heroDmg(S, 0.8), "dot", 1); }); } }
    },
    // ===== MAGE =====
    // 21. orbs SPIRAL OUTWARD from you; L10 the orrery: big orbs orbit you and small ones orbit them
    "arcane-orbs": function (S, st, lv, dt, h, am) {
      st.o = st.o || [];
      if (lv >= 10) { st.a = (st.a || 0) + dt * 1.2; st.o = []; for (var i = 0; i < 3; i++) { var a = st.a + i * Math.PI * 2 / 3, bx = h.x + Math.cos(a) * 3.6 * am, by = h.y + Math.sin(a) * 3.6 * am; st.o.push({ x: bx, y: by, big: 1 });
          for (var j = 0; j < 3; j++) { var b = -st.a * 3 + j * Math.PI * 2 / 3; st.o.push({ x: bx + Math.cos(b) * 1.3, y: by + Math.sin(b) * 1.3 }); } }
        st.k = (st.k || 0) - dt; if (st.k <= 0) { st.k = 0.3; st.o.forEach(function (o) { near(S, o.x, o.y, o.big ? 1.0 : 0.6, function (m) { hit(S, m, heroDmg(S, o.big ? 1.2 : 0.6), "none"); }); }); } return; }
      st.t -= dt; if (st.t <= 0) { st.t = lin(lv, 2.5, 1.4) * cdMul(S); for (var n = Math.round(lin(lv, 1, 4)), q = 0; q < n; q++) st.o.push({ a: Math.atan2(h.diry, h.dirx) + q * Math.PI * 2 / n, r: 0.5, hit: {} }); }
      for (var k = st.o.length - 1; k >= 0; k--) { var o = st.o[k]; o.r += dt * 3.2; o.a += dt * lin(lv, 2.2, 3.2); o.x = h.x + Math.cos(o.a) * o.r; o.y = h.y + Math.sin(o.a) * o.r;
        if (o.r > lin(lv, 7, 11) * am) { st.o.splice(k, 1); continue; }
        near(S, o.x, o.y, 0.6 * am, function (m) { if (!o.hit[m.id]) { o.hit[m.id] = 1; hit(S, m, heroDmg(S, lin(lv, 0.9, 1.6)), "none"); } }); }
    },
    // 22. a ring of fire FOLLOWS a second behind you: its EDGE burns, its middle is safe; L10 a crown that flares out in pulses
    "fire-halo": function (S, st, lv, dt, h, am) {
      if (st.cx == null) { st.cx = h.x; st.cy = h.y; } var f = Math.min(1, dt * lin(lv, 1.0, 1.8)); st.cx += (h.x - st.cx) * f; st.cy += (h.y - st.cy) * f;
      st.r = (lv >= 10 ? 3 + 3 * (0.5 + 0.5 * Math.sin(S.t * Math.PI)) : lin(lv, 2.5, 4)) * am;
      st.k = (st.k || 0) - dt; if (st.k > 0) return; st.k = 0.4;
      near(S, st.cx, st.cy, st.r + 0.8, function (m, dx, dy) { if (Math.abs(Math.sqrt(dx * dx + dy * dy) - st.r) <= 0.7 + m.r) hit(S, m, heroDmg(S, lin(lv, 0.6, 1.1) * (lv >= 10 ? 1.5 : 1)), "dot", 1); });
    },
    // 23. FREEZES monsters solid; a frozen monster SHATTERS for double when hit; L10 a blizzard follows you
    "frost-nova": function (S, st, lv, dt, h, am) {
      if (lv >= 10) { st.k = (st.k || 0) - dt; if (st.k <= 0) { st.k = 0.5; near(S, h.x, h.y, 5 * am, function (m) { hit(S, m, heroDmg(S, 0.8), "none"); if (m.type !== "boss") m.frozenT = Math.max(m.frozenT || 0, 1.2); }); } return; }   // hit (shatters), THEN refreeze
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 5, 3) * cdMul(S); st.burst = 0.4;
      near(S, h.x, h.y, lin(lv, 3.5, 5.5) * am, function (m) { hit(S, m, heroDmg(S, 0.5), "none"); if (m.type !== "boss") m.frozenT = Math.max(m.frozenT || 0, lin(lv, 1.5, 3)); });   // hit, THEN freeze
    },
    // 24. a bolt JUMPS monster to monster; L10 three chains from a crown over your head every second
    "chain-lightning": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = (lv >= 10 ? 1 : lin(lv, 2.4, 1.3)) * cdMul(S); st.paths = [];
      for (var c = 0; c < (lv >= 10 ? 3 : 1); c++) { var from = { x: h.x, y: h.y - (lv >= 10 ? 2 : 0) }, seen = {}, path = [[from.x, from.y]], jumps = lv >= 10 ? 8 : Math.round(lin(lv, 3, 8)), rad = 8;
        for (var j = 0; j < jumps; j++) { var best = null, bd = rad * rad; near(S, from.x, from.y, rad, function (m, dx, dy) { var d = dx * dx + dy * dy; if (!seen[m.id] && d < bd && !(st.paths.some(function (p) { return p.ids && p.ids[m.id]; }))) { bd = d; best = m; } });
          if (!best) break; seen[best.id] = 1; hit(S, best, heroDmg(S, lin(lv, 1.0, 1.6)), "stun", 0.6); path.push([best.x, best.y]); from = best; rad = 4.5; }
        st.paths.push({ pts: path, ids: seen, t: 0.25 }); }
    },
    // 25. shooting stars STREAK DIAGONALLY across the screen; L10 one comet sweeps it all
    "starfall": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt;
      if (st.t <= 0) { st.t = (lv >= 10 ? 6 : lin(lv, 2.2, 1.2)) * cdMul(S); var n = lv >= 10 ? 1 : Math.round(lin(lv, 1, 4));
        for (var i = 0; i < n; i++) { var off = (S.rng() - 0.5) * 10; st.o.push({ x: h.x - 20 + off, y: h.y - 14 - off * 0.3, vx: 16, vy: 11, r: (lv >= 10 ? 2.6 : 0.8) * am, life: 3, hit: {}, big: lv >= 10 ? 1 : 0 }); } }
      for (var k = st.o.length - 1; k >= 0; k--) { var o = st.o[k]; o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt; if (o.life <= 0) { st.o.splice(k, 1); continue; }
        near(S, o.x, o.y, o.r, function (m) { if (!o.hit[m.id]) { o.hit[m.id] = 1; hit(S, m, heroDmg(S, o.big ? 6 : lin(lv, 1.4, 2.4)), "dot", 1); } }); }
    },
    // 26. an orb is placed FAR AHEAD: it PULLS monsters in, then IMPLODES; L10 a drifting black hole
    "gravity-well": function (S, st, lv, dt, h, am) {
      if (lv >= 10) { if (!st.w) st.w = { x: h.x + h.dirx * 6, y: h.y + h.diry * 6 }; var w = st.w, dx = h.x + h.dirx * 6 - w.x, dy = h.y + h.diry * 6 - w.y; w.x += dx * dt * 0.4; w.y += dy * dt * 0.4;
        near(S, w.x, w.y, 7 * am, function (m, ex, ey) { if (m.type === "boss") return; var d = Math.sqrt(ex * ex + ey * ey) || 1; m.x -= ex / d * Math.min(d, 6 * dt); m.y -= ey / d * Math.min(d, 6 * dt); });
        st.k = (st.k || 0) - dt; if (st.k <= 0) { st.k = 0.4; near(S, w.x, w.y, 2 * am, function (m) { hit(S, m, heroDmg(S, 0.9), "none"); }); } return; }
      if (!st.w) { st.t -= dt; if (st.t <= 0) { st.t = lin(lv, 7, 4.5) * cdMul(S); st.w = { x: h.x + h.dirx * 7, y: h.y + h.diry * 7, life: 2 }; } return; }
      var g = st.w; g.life -= dt; var R = lin(lv, 4, 6) * am;
      near(S, g.x, g.y, R, function (m, ex, ey) { if (m.type === "boss") return; var d = Math.sqrt(ex * ex + ey * ey) || 1; m.x -= ex / d * Math.min(d, 5 * dt); m.y -= ey / d * Math.min(d, 5 * dt); });
      if (g.life <= 0) { near(S, g.x, g.y, R * 0.6, function (m) { hit(S, m, heroDmg(S, lin(lv, 2.5, 4.5)), "knock", 1.5); }); S.fx.push({ kind: "implode", key: "gravity-well", x: g.x, y: g.y, r: R, t: 0, life: 0.4 }); st.w = null; }
    },
    // 27. runes are left WHERE YOU WERE 2 s AGO, then explode; L10 a huge sigil burns under the biggest crowd
    "rune-circle": function (S, st, lv, dt, h, am) {
      st.hist = st.hist || []; st.hist.push([S.t, h.x, h.y]); while (st.hist.length && st.hist[0][0] < S.t - 2) st.hist.shift(); st.o = st.o || [];
      st.t -= dt; if (st.t <= 0) { st.t = (lv >= 10 ? 5 : lin(lv, 1.6, 0.9)) * cdMul(S);
        if (lv >= 10) { var best = null, bc = 0; for (var kk in S._grid) { var b = S._grid[kk]; if (b.length > bc) { bc = b.length; best = b[0]; } } if (best) st.o.push({ x: best.x, y: best.y, r: 7 * am, fuse: 1.2, max: 1.2, big: 1 }); }
        else { var p = st.hist[0]; st.o.push({ x: p[1], y: p[2], r: lin(lv, 1.8, 3) * am, fuse: 1, max: 1 }); } }
      for (var k = st.o.length - 1; k >= 0; k--) { var o = st.o[k]; o.fuse -= dt; if (o.fuse <= 0) { near(S, o.x, o.y, o.r, function (m) { hit(S, m, heroDmg(S, o.big ? 5 : lin(lv, 1.6, 2.8)), "dot", 1); }); S.fx.push({ kind: "rune", key: "rune-circle", x: o.x, y: o.y, r: o.r, t: 0, life: 0.35 }); st.o.splice(k, 1); } }
    },
    // 28. wisps fly off ON THEIR OWN to hunt single monsters, then come back; L10 a choir of 10
    "wisp-familiars": function (S, st, lv, dt, h, am) {
      var n = lv >= 10 ? 10 : Math.round(lin(lv, 1, 4)); st.o = st.o || []; while (st.o.length < n) st.o.push({ x: h.x, y: h.y, tg: null, cd: st.o.length * 0.3 });
      st.o.forEach(function (w, i) { w.cd -= dt;
        if (!w.tg || w.tg.hp <= 0) { if (w.cd > 0) { var a = S.t * 1.5 + i * Math.PI * 2 / n; w.x += (h.x + Math.cos(a) * 1.6 - w.x) * Math.min(1, dt * 4); w.y += (h.y + Math.sin(a) * 1.6 - w.y) * Math.min(1, dt * 4); return; }
          w.tg = nearest(S, h.x, h.y, 10 * am); if (!w.tg) return; }
        var dx = w.tg.x - w.x, dy = w.tg.y - w.y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = lin(lv, 9, 13) * dt;
        if (d <= sp + w.tg.r) { hit(S, w.tg, heroDmg(S, lin(lv, 1.0, 1.8)), "dot", 1); w.tg = null; w.cd = lin(lv, 0.9, 0.5); } else { w.x += dx / d * sp; w.y += dy / d * sp; } });
    },
    // 29. a cloud floats ABOVE you, firing random lightning beneath it; L10 a storm centred on you
    "mana-storm": function (S, st, lv, dt, h, am) {
      if (st.cx == null) { st.cx = h.x; st.cy = h.y; } st.cx += (h.x - st.cx) * Math.min(1, dt * 1.5); st.cy += (h.y - st.cy) * Math.min(1, dt * 1.5);
      st.r = (lv >= 10 ? 8 : lin(lv, 3, 5)) * am; st.strikes = (st.strikes || []).filter(function (s2) { s2.t -= dt; return s2.t > 0; });
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 0.6, 0.3);
      for (var i = 0; i < (lv >= 10 ? 3 : 1); i++) { var a = S.rng() * Math.PI * 2, rr = Math.sqrt(S.rng()) * st.r, x = st.cx + Math.cos(a) * rr, y = st.cy + Math.sin(a) * rr;
        near(S, x, y, 1.3, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.9, 1.5)), "stun", 0.6); }); st.strikes.push({ x: x, y: y, t: 0.18 }); }
    },
    // 30. one big meteor lands WHERE YOU'RE HEADING, after a long warning; L10 a rain of six
    "meteor-call": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 6, 4) * cdMul(S);
      var n = lv >= 10 ? 6 : 1;
      for (var i = 0; i < n; i++) { var a = Math.atan2(h.diry, h.dirx) + (n > 1 ? (i - 2.5) * 0.45 : 0), d = n > 1 ? 7 + (i % 2) * 3 : 8;
        S.zones.push({ kind: "drop", key: "meteor-call", x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d, r1: (lv >= 10 ? 4 : lin(lv, 3, 4.5)) * am, t: 0, life: 0.3, delay: 1.5 + i * 0.25, dmg: heroDmg(S, lin(lv, 4, 7)), fk: "dot", fp: 2, hit: {}, big: lv >= 10 ? 1 : 0 }); }
    },

    // ===== BRUISER =====
    // 11. you SPIN: the axe sweeps a full circle round you once, then rests; L10 a blade cyclone that travels with you
    "blade-whirl": function (S, st, lv, dt, h, am) {
      var R = (lv >= 10 ? 3 : lin(lv, 2.4, 3.6)) * am;
      if (lv >= 10) { st.sw = (st.sw || 0) + dt * 9; st.k = (st.k || 0) - dt; if (st.k <= 0) { st.k = 0.25; near(S, h.x, h.y, R, function (m) { hit(S, m, heroDmg(S, 0.8), "dot", 1); }); } return; }
      if (st.sp > 0) { var prev = st.sw; st.sw += dt * Math.PI * 2 / 0.4; st.sp -= dt;
        near(S, h.x, h.y, R, function (m, dx, dy) { var a = Math.atan2(dy, dx), da = ((a - prev) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2); if (da <= st.sw - prev + 0.2 && !st.hit[m.id]) { st.hit[m.id] = 1; hit(S, m, heroDmg(S, lin(lv, 1.4, 2.6)), "dot", 1); } });
        return; }
      st.t -= dt; if (st.t <= 0) { st.t = lin(lv, 3, 1.8) * cdMul(S); st.sp = lv >= 6 ? 0.8 : 0.4; st.sw = Math.atan2(h.diry, h.dirx); st.hit = {}; }
    },
    // 12. a stomp sends a shockwave ROLLING ALONG THE GROUND in a straight line forward; L10 four lines in a cross
    "shock-stomp": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt;
      if (st.t <= 0) { st.t = lin(lv, 3.5, 2) * cdMul(S); var a0 = Math.atan2(h.diry, h.dirx), dirs = lv >= 10 ? [0, 1, 2, 3].map(function (i) { return a0 + i * Math.PI / 2; }) : lv >= 7 ? [a0 - 0.35, a0 + 0.35] : [a0];
        dirs.forEach(function (a) { st.o.push({ x: h.x, y: h.y, a: a, d: 0, len: (lv >= 10 ? 14 : lin(lv, 6, 10)) * am, w: lin(lv, 1.0, 1.6) * am, hit: {} }); }); }
      for (var k = st.o.length - 1; k >= 0; k--) { var o = st.o[k]; o.d += dt * 12; if (o.d >= o.len) { st.o.splice(k, 1); continue; }
        var fx = o.x + Math.cos(o.a) * o.d, fy = o.y + Math.sin(o.a) * o.d; o.fx = fx; o.fy = fy;
        near(S, fx, fy, o.w, function (m) { if (!o.hit[m.id]) { o.hit[m.id] = 1; hit(S, m, heroDmg(S, lin(lv, 1.2, 2.2)), "knock", 1.5); } }); }
    },
    // 13. the flail SWINGS BEHIND you like a pendulum and WHIPS out when you turn; L10 a giant wrecking star
    "chain-flail": function (S, st, lv, dt, h, am) {
      var L = (lv >= 10 ? 4.5 : lin(lv, 2.6, 3.6)) * am; if (st.fx == null) { st.fx = h.x - h.dirx * L; st.fy = h.y - h.diry * L; st.vx = 0; st.vy = 0; }
      var tx = h.x - h.dirx * L, ty = h.y - h.diry * L; st.vx += (tx - st.fx) * 18 * dt; st.vy += (ty - st.fy) * 18 * dt; st.vx *= Math.pow(0.15, dt); st.vy *= Math.pow(0.15, dt);
      st.fx += st.vx * dt; st.fy += st.vy * dt; var dx = st.fx - h.x, dy = st.fy - h.y, d = Math.sqrt(dx * dx + dy * dy) || 1; if (d > L) { st.fx = h.x + dx / d * L; st.fy = h.y + dy / d * L; }
      var speed = Math.sqrt(st.vx * st.vx + st.vy * st.vy); st.k = (st.k || 0) - dt; if (st.k > 0) return; st.k = 0.2;
      near(S, st.fx, st.fy, (lv >= 10 ? 2 : 1.0) * am, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.5, 0.9) * (1 + speed / 6) * (lv >= 10 ? 1.5 : 1)), "knock", 1 + speed / 8); });
    },
    // 14. flames grow ON YOUR BODY with every monster near you; at full they BURST; L10 you stay ablaze
    "rage-ember": function (S, st, lv, dt, h, am) {
      var c = 0; near(S, h.x, h.y, 4, function () { c++; }); st.rage = Math.min(100, (st.rage || 0) + c * dt * lin(lv, 4, 8));
      if (lv >= 10) { st.k = (st.k || 0) - dt; if (st.k <= 0) { st.k = 0.3; near(S, h.x, h.y, 1.8 * am, function (m) { hit(S, m, heroDmg(S, 0.7), "dot", 1); }); } }
      if (st.rage >= 100) { st.rage = 0; var R = lin(lv, 3, 5) * am * (lv >= 10 ? 1.3 : 1); near(S, h.x, h.y, R, function (m) { hit(S, m, heroDmg(S, lin(lv, 2.5, 4.5)), "knock", 1.5); }); S.fx.push({ kind: "burst", key: "rage-ember", x: h.x, y: h.y, r: R, t: 0, life: 0.45 }); }
    },
    // 15. fists JAB out one-two at the nearest monsters, then snap back; L10 two giant hands slam the ground either side
    "iron-fists": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 1.6, 0.9) * cdMul(S);
      if (lv >= 10) { var px = -h.diry, py = h.dirx; [1, -1].forEach(function (sd) { var x = h.x + px * 3.5 * sd, y = h.y + py * 3.5 * sd; near(S, x, y, 3 * am, function (m) { hit(S, m, heroDmg(S, 3), "stun", 2); }); S.fx.push({ kind: "slam", key: "iron-fists", x: x, y: y, r: 3 * am, t: 0, life: 0.4 }); }); st.t = 2.5; return; }
      var n = Math.round(lin(lv, 1, 4)), reach = lin(lv, 3, 5) * am, got = [];
      near(S, h.x, h.y, reach, function (m, dx, dy) { got.push([dx * dx + dy * dy, m]); }); got.sort(function (a, b) { return a[0] - b[0] || a[1].id - b[1].id; });
      got.slice(0, n).forEach(function (g, i) { var m = g[1]; hit(S, m, heroDmg(S, lin(lv, 1.0, 1.8)), "knock", 1.2); S.fx.push({ kind: "jab", key: "iron-fists", x: h.x, y: h.y, tx: m.x, ty: m.y, t: -i * 0.08, life: 0.25 }); });
    },
    // 16. cleavers are hurled UP in an ARC and come down in a line ahead; L10 they whirl down all round you
    "cleaver-rain": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 3, 1.8) * cdMul(S);
      if (lv >= 10) { for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; S.zones.push({ kind: "drop", key: "cleaver-rain", x: h.x + Math.cos(a) * 4 * am, y: h.y + Math.sin(a) * 4 * am, r1: 1.6 * am, t: 0, life: 0.15, delay: 0.4 + i * 0.06, dmg: heroDmg(S, 2.2), fk: "dot", fp: 1.5, hit: {}, arc: 1, fx0: h.x, fy0: h.y }); } return; }
      var n = Math.round(lin(lv, 2, 6));
      for (var j = 0; j < n; j++) { var d = 2 + j * 1.6; S.zones.push({ kind: "drop", key: "cleaver-rain", x: h.x + h.dirx * d, y: h.y + h.diry * d, r1: lin(lv, 1.2, 1.7) * am, t: 0, life: 0.15, delay: 0.35 + d * 0.05, dmg: heroDmg(S, lin(lv, 1.2, 2.0)), fk: "dot", fp: 1.5, hit: {}, arc: 1, fx0: h.x, fy0: h.y }); }
    },
    // 17. beats on a RHYTHM: every 4th beat is big and leaves monsters taking more damage; L10 lightning on every big beat
    "war-drum": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 1.0, 0.6); st.beat = ((st.beat || 0) + 1) % 4; var big = st.beat === 0, R = (big ? lin(lv, 5, 7) : 3) * am;
      near(S, h.x, h.y, R, function (m) { hit(S, m, heroDmg(S, big ? lin(lv, 1.2, 2) : 0.4), big ? "vuln" : "none", big ? lin(lv, 1, 2) : 1); });
      S.fx.push({ kind: "beat", key: "war-drum", x: h.x, y: h.y, r: R, big: big ? 1 : 0, t: 0, life: 0.35 });
      if (big && lv >= 10) for (var i = 0; i < 5 && S.monsters.length; i++) { var m = S.monsters[(S.rng() * S.monsters.length) | 0]; if (Math.abs(m.x - h.x) < VIEW.w / 2 && Math.abs(m.y - h.y) < VIEW.h / 2) { hit(S, m, heroDmg(S, 3), "stun", 1); S.fx.push({ kind: "bolt", key: "war-drum", x: m.x, y: m.y, t: 0, life: 0.25 }); } }
    },
    // 18. an axe HUNTS the last monster that hit you, then returns; L10 it chains through everyone who hurt you
    "grudge-mark": function (S, st, lv, dt, h, am) {
      st.foes = (st.foes || []).filter(function (f) { return f.m.hp > 0 && S.t - f.at < 6; });
      (S._hurtPrev || []).forEach(function (m) { st.foes = st.foes.filter(function (f) { return f.m !== m; }); st.foes.push({ m: m, at: S.t }); });
      var n = lv >= 6 ? 2 : 1; st.o = st.o || []; while (st.o.length < n) st.o.push({ x: h.x, y: h.y, tg: null, back: false, chain: 0 });
      st.o.forEach(function (ax, i) {
        if (!ax.tg && !ax.back) { var f = st.foes[st.foes.length - 1 - i]; if (f) { ax.tg = f.m; ax.chain = lv >= 10 ? st.foes.length : 1; } else { ax.x += (h.x - ax.x) * Math.min(1, dt * 6); ax.y += (h.y - ax.y) * Math.min(1, dt * 6); return; } }
        var tx = ax.back ? h.x : ax.tg.x, ty = ax.back ? h.y : ax.tg.y, dx = tx - ax.x, dy = ty - ax.y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = lin(lv, 10, 15) * dt;
        if (d <= sp + 0.5) { if (ax.back) { ax.back = false; return; } hit(S, ax.tg, heroDmg(S, lin(lv, 2.0, 3.5)), "vuln", 1); ax.chain--;
          var nx = ax.chain > 0 ? st.foes.filter(function (f) { return f.m !== ax.tg && f.m.hp > 0; })[0] : null; if (nx) ax.tg = nx.m; else { ax.tg = null; ax.back = true; } }
        else { ax.x += dx / d * sp; ax.y += dy / d * sp; ax.rot = (ax.rot || 0) + dt * 14; } });
    },
    // 19. a wind blade SWEEPS SIDEWAYS across your front, left to right; L10 a tornado wanders the field
    "rending-gale": function (S, st, lv, dt, h, am) {
      if (lv >= 10) { if (!st.tw) st.tw = { x: h.x + 6, y: h.y }; var tw = st.tw, wa = S.t * 0.7; tw.x += (Math.cos(wa) * 3 + (h.x - tw.x) * 0.25) * dt; tw.y += (Math.sin(wa * 1.3) * 3 + (h.y - tw.y) * 0.25) * dt;
        near(S, tw.x, tw.y, 3.5 * am, function (m, ex, ey) { var d = Math.sqrt(ex * ex + ey * ey) || 1; m.x -= ey / d * 4 * dt + ex / d * 2 * dt; m.y += ex / d * 4 * dt - ey / d * 2 * dt; });
        st.k = (st.k || 0) - dt; if (st.k <= 0) { st.k = 0.3; near(S, tw.x, tw.y, 3.5 * am, function (m) { hit(S, m, heroDmg(S, 0.9), "none"); }); } return; }
      if (st.sp > 0) { var prog = 1 - st.sp / 0.35, a = st.a0 - 1.2 + 2.4 * prog, r0 = 1.5, r1 = lin(lv, 5, 7) * am; st.cur = a; st.sp -= dt;
        near(S, h.x + Math.cos(a) * r1 / 2, h.y + Math.sin(a) * r1 / 2, r1 / 2 + 1, function (m) { if (!st.hit[m.id] && segDist(m.x, m.y, h.x, h.y, a, r1) <= 0.9 + m.r) { st.hit[m.id] = 1; hit(S, m, heroDmg(S, lin(lv, 1.2, 2.0)), "knock", 1.5); } }); return; }
      st.t -= dt; if (st.t <= 0) { st.t = lin(lv, 2.5, 1.4) * cdMul(S); st.sp = 0.35; st.a0 = Math.atan2(h.diry, h.dirx); st.hit = {}; if (lv >= 6) st.again = 1; }
      else if (st.again && st.t < lin(lv, 2.5, 1.4) * cdMul(S) - 0.4) { st.again = 0; st.sp = 0.35; st.a0 = Math.atan2(h.diry, h.dirx); st.hit = {}; }
    },
    // 20. kills spill blood that FLIES BACK into you, healing and speeding you; L10 a wave of blood rolls outward
    "bloodlust": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; (S._killsPrev || []).forEach(function (k) { if (st.o.length < 40) st.o.push({ x: k[0], y: k[1] }); });
      for (var i = st.o.length - 1; i >= 0; i--) { var o = st.o[i], dx = h.x - o.x, dy = h.y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = 12 * dt;
        if (d <= sp + 0.4) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * lin(lv, 0.002, 0.005)); h.haste = Math.max(h.haste || 0, lin(lv, 0.5, 1.2)); st.o.splice(i, 1); } else { o.x += dx / d * sp; o.y += dy / d * sp; } }
      if (lv >= 10) { st.t -= dt; if (st.t <= 0) { st.t = 6; S.zones.push({ kind: "ripple", key: "bloodlust", x: h.x, y: h.y, r0: 0.5, r1: 8 * am, t: 0, life: 0.7, delay: 0, n: 0, dmg: heroDmg(S, 2), fk: "knock", fp: 1.5, hit: {} }); } }
    },
    // ===== ASSASSIN =====
    // 41. knives are thrown BEHIND you, at whatever is chasing; L10 knives in every direction
    "shadow-knives": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 1.4, 0.8) * cdMul(S);
      var n = lv >= 10 ? 16 : Math.round(lin(lv, 2, 5)), back = Math.atan2(-h.diry, -h.dirx);
      for (var i = 0; i < n; i++) { var a = lv >= 10 ? i * Math.PI * 2 / n : back + (i - (n - 1) / 2) * 0.18;
        S.shots.push({ key: "shadow-knives", x: h.x, y: h.y, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16, r: 0.35 * am, life: 0.8, pierce: 1, dmg: heroDmg(S, lin(lv, 0.8, 1.3)), fk: "dot", hit: {}, bounce: 0 }); }
    },
    // 42. a cloud is released and DRIFTS slowly with the wind; L10 three great fogs creep over the field
    "poison-cloud": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt;
      if (st.t <= 0) { st.t = (lv >= 10 ? 4 : lin(lv, 4, 2.5)) * cdMul(S); var big = lv >= 10; if (!big || st.o.length < 3) st.o.push({ x: h.x, y: h.y, r: (big ? 5 : lin(lv, 1.8, 3)) * am, life: big ? 14 : lin(lv, 4, 7), max: big ? 14 : lin(lv, 4, 7) }); }
      st.k = (st.k || 0) - dt; var tick = st.k <= 0; if (tick) st.k = 0.5;
      for (var i = st.o.length - 1; i >= 0; i--) { var c = st.o[i]; c.x += 0.9 * dt; c.y += 0.35 * dt; c.life -= dt; c.r += dt * 0.15; if (c.life <= 0) { st.o.splice(i, 1); continue; }
        if (tick) near(S, c.x, c.y, c.r, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.3, 0.6)), "slow", 1); }); }
    },
    // 43. blades fly out and come BACK like boomerangs, cutting both ways; L10 a blossom of 12 all round
    "phantom-blades": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt;
      if (st.t <= 0) { st.t = lin(lv, 2.4, 1.4) * cdMul(S); var n = lv >= 10 ? 12 : Math.round(lin(lv, 1, 4)), a0 = Math.atan2(h.diry, h.dirx);
        for (var i = 0; i < n; i++) st.o.push({ a: lv >= 10 ? i * Math.PI * 2 / n : a0 + (i - (n - 1) / 2) * 0.4, d: 0, out: 1, R: (lv >= 10 ? 7 : lin(lv, 5, 8)) * am, hit: {} }); }
      for (var k = st.o.length - 1; k >= 0; k--) { var o = st.o[k]; o.d += (o.out ? 1 : -1) * dt * 11; if (o.out && o.d >= o.R) { o.out = 0; o.hit = {}; } if (!o.out && o.d <= 0) { st.o.splice(k, 1); continue; }
        o.x = h.x + Math.cos(o.a) * o.d; o.y = h.y + Math.sin(o.a) * o.d; o.spin = (o.spin || 0) + dt * 16;
        near(S, o.x, o.y, 0.7 * am, function (m) { if (!o.hit[m.id]) { o.hit[m.id] = 1; hit(S, m, heroDmg(S, lin(lv, 0.9, 1.6)), "dot", 1); } }); }
    },
    // 44. a smoke puff, and you VANISH: the horde runs to where you were; L10 you walk unseen
    "smoke-veil": function (S, st, lv, dt, h, am) {
      if (lv >= 10) { if (h.mvx || h.mvy) { if (!(h.hidden > 0)) { h.decoyX = h.x; h.decoyY = h.y; } h.hidden = 0.3; } else if (h.hidden > 0) h.hidden -= dt; return; }
      if (h.hidden > 0) { h.hidden -= dt; return; }
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 10, 6) * cdMul(S); h.hidden = lin(lv, 2, 4); h.decoyX = h.x; h.decoyY = h.y;
      S.fx.push({ kind: "puff", key: "smoke-veil", x: h.x, y: h.y, r: lin(lv, 2, 3.5) * am, t: 0, life: 0.8 });
    },
    // 45. the strongest monster is MARKED to take double damage; under 20% it is EXECUTED; L10 a scythe falls on five marks
    "death-mark": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = (lv >= 10 ? 3 : lin(lv, 4, 2.5)) * cdMul(S);
      var cands = S.monsters.filter(function (m) { return !m.marked && m.hp > 0 && Math.abs(m.x - h.x) < VIEW.w / 2 && Math.abs(m.y - h.y) < VIEW.h / 2; }).sort(function (a, b) { return b.hp - a.hp || a.id - b.id; });
      cands.slice(0, lv >= 10 ? 5 : 1).forEach(function (m) { m.marked = 1; m.exec = lin(lv, 0.2, 0.35);
        if (lv >= 10) S.zones.push({ kind: "drop", key: "death-mark", x: m.x, y: m.y, r1: 1.4, t: 0, life: 0.2, delay: 0.7, dmg: heroDmg(S, 4), fk: "none", fp: 1, hit: {} }); });
    },
    // 46. shurikens are thrown ahead and STICK IN THE GROUND, spinning there as saw traps; L10 a field of 8 spinning stars
    "shuriken-storm": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt;
      if (st.t <= 0) { st.t = lin(lv, 3, 1.8) * cdMul(S);
        if (lv >= 10) { st.o = []; for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; st.o.push({ x: h.x + Math.cos(a) * 5, y: h.y + Math.sin(a) * 5, life: 3, fly: 0, r: 1.4 * am }); } }
        else for (var n = Math.round(lin(lv, 1, 3)), q = 0; q < n; q++) { var a2 = Math.atan2(h.diry, h.dirx) + (q - (n - 1) / 2) * 0.5; st.o.push({ x: h.x, y: h.y, tx: h.x + Math.cos(a2) * 5, ty: h.y + Math.sin(a2) * 5, fly: 0.3, life: lin(lv, 3, 6), r: 1.0 * am }); } }
      st.k = (st.k || 0) - dt; var tick = st.k <= 0; if (tick) st.k = 0.3;
      for (var k = st.o.length - 1; k >= 0; k--) { var o = st.o[k]; if (o.fly > 0) { var f = Math.min(1, dt / o.fly); o.x += (o.tx - o.x) * f; o.y += (o.ty - o.y) * f; o.fly -= dt; continue; }
        o.life -= dt; o.spin = (o.spin || 0) + dt * 18; if (o.life <= 0) { st.o.splice(k, 1); continue; }
        if (tick) near(S, o.x, o.y, o.r, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.5, 0.9)), "dot", 1); }); }
    },
    // 47. venom drips into a SNAKE that SLITHERS after monsters; L10 a giant serpent
    "venom-trail": function (S, st, lv, dt, h, am) {
      var len = lv >= 10 ? 24 : Math.round(lin(lv, 5, 12)), big = lv >= 10;
      if (!st.body) { st.body = []; for (var i = 0; i < len; i++) st.body.push([h.x, h.y]); st.hx = h.x; st.hy = h.y; }
      while (st.body.length < len) st.body.push(st.body[st.body.length - 1].slice());
      var tg = nearest(S, st.hx, st.hy, 12) || { x: h.x + h.dirx * 3, y: h.y + h.diry * 3 }, dx = tg.x - st.hx, dy = tg.y - st.hy, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = lin(lv, 5, 7.5) * dt;
      var wig = Math.sin(S.t * 8) * 0.6; st.hx += (dx / d + -dy / d * wig) * sp; st.hy += (dy / d + dx / d * wig) * sp;
      var ex = h.x - st.hx, ey = h.y - st.hy; if (ex * ex + ey * ey > 225) { st.hx = h.x; st.hy = h.y; }   // too far: it slips back to you
      st.body.unshift([st.hx, st.hy]); st.body.length = len;
      st.k = (st.k || 0) - dt; if (st.k > 0) return; st.k = 0.35; var w = (big ? 1.2 : 0.6) * am;
      for (var j = 0; j < st.body.length; j += 3) near(S, st.body[j][0], st.body[j][1], w, function (m) { hit(S, m, heroDmg(S, (j ? 0.35 : 1.0) * lin(lv, 1, 1.6) * (big ? 1.5 : 1)), "slow", 1); });
    },
    // 48. a clone MIRRORS your moves on the other side of you, cutting what it meets; L10 a legion of six round you
    "shadow-clone": function (S, st, lv, dt, h, am) {
      st.c = st.c || [];
      if (lv >= 10) { st.a = (st.a || 0) + dt * 0.9; st.c = []; for (var i = 0; i < 6; i++) { var a = st.a + i * Math.PI / 3; st.c.push([h.x + Math.cos(a) * 3.2, h.y + Math.sin(a) * 3.2]); } }
      else { if (!st.o) st.o = [[-2, 0], [0, 2]]; var n = lv >= 6 ? 2 : 1; st.c = [];
        for (var q = 0; q < n; q++) { var o = st.o[q]; o[0] -= h.mvx * h.speed * dt * (q ? 0 : 1) + (q ? h.mvx * 0 : 0); o[1] -= h.mvy * h.speed * dt * (q ? -1 : 1) * (q ? -1 : 1);
          if (q) { o[0] += h.mvx * h.speed * dt; o[1] -= h.mvy * h.speed * dt * 2; }
          var ol = Math.sqrt(o[0] * o[0] + o[1] * o[1]) || 1; if (ol > 4) { o[0] *= 4 / ol; o[1] *= 4 / ol; } if (ol < 1.5) { o[0] *= 1.5 / ol; o[1] *= 1.5 / ol; }
          st.c.push([h.x + o[0], h.y + o[1]]); } }
      st.k = (st.k || 0) - dt; if (st.k > 0) return; st.k = lin(lv, 0.6, 0.35);
      st.c.forEach(function (p) { near(S, p[0], p[1], 1.6 * am, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.8, 1.4)), "dot", 1); }); });
    },
    // 49. when you CHANGE DIRECTION you DASH-SLASH through what's in the way; L10 after-images keep slashing
    "swift-strikes": function (S, st, lv, dt, h, am) {
      st.cd = (st.cd || 0) - dt; st.ai = (st.ai || []).filter(function (a) { a.t -= dt; return a.t > 0; });
      if (lv >= 10) { st.k = (st.k || 0) - dt; if (st.k <= 0) { st.k = 0.3; st.ai.forEach(function (a) { near(S, a.x, a.y, 1.5, function (m) { hit(S, m, heroDmg(S, 0.8), "dot", 1); }); }); } }
      var moving = h.mvx || h.mvy; if (!moving) return; var a = Math.atan2(h.mvy, h.mvx);
      if (st.pa == null) { st.pa = a; return; } var turn = Math.abs(((a - st.pa) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); st.pa = a;
      if (turn < 1.0 || st.cd > 0) return; st.cd = lin(lv, 1.0, 0.5);
      var L = lin(lv, 2.5, 4.5) * am, x0 = h.x, y0 = h.y; h.x += Math.cos(a) * L; h.y += Math.sin(a) * L; h.iframes = Math.max(h.iframes, 0.25);
      near(S, x0 + Math.cos(a) * L / 2, y0 + Math.sin(a) * L / 2, L / 2 + 1, function (m) { if (segDist(m.x, m.y, x0, y0, a, L) <= 1 + m.r) { hit(S, m, heroDmg(S, lin(lv, 1.6, 2.8)), "dot", 1); if (lv >= 5) hit(S, m, heroDmg(S, 0.6), "none"); } });
      S.fx.push({ kind: "dash", key: "swift-strikes", x: x0, y: y0, tx: h.x, ty: h.y, t: 0, life: 0.3 }); if (lv >= 10) st.ai.push({ x: x0 + Math.cos(a) * L / 2, y: y0 + Math.sin(a) * L / 2, t: 1.5 });
    },
    // 50. sickles fly a WIDE FIGURE-8 round you; L10 a crescent moon sweeps the field
    "night-sickles": function (S, st, lv, dt, h, am) {
      st.a = (st.a || 0) + dt * lin(lv, 1.4, 2.2); var n = lv >= 10 ? 1 : Math.round(lin(lv, 1, 3)), R = (lv >= 10 ? 9 : lin(lv, 4, 6)) * am; st.p = [];
      for (var i = 0; i < n; i++) { var t = (lv >= 10 ? st.a * 0.4 : st.a) + i * Math.PI * 2 / n; st.p.push(lv >= 10 ? [h.x + Math.cos(t) * R, h.y + Math.sin(t) * R * 0.6, t] : [h.x + Math.sin(t) * R, h.y + Math.sin(t) * Math.cos(t) * R, t]); }
      st.k = (st.k || 0) - dt; if (st.k > 0) return; st.k = 0.2;
      st.p.forEach(function (p) { near(S, p[0], p[1], (lv >= 10 ? 2.6 : 0.9) * am, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.6, 1.0) * (lv >= 10 ? 1.6 : 1)), "dot", 1); }); });
    },

    // ===== MARKSMAN =====
    // 51. a FAN of arrows forward; L10 arrows rain from the sky across your front
    "arrow-volley": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 1.6, 1.0) * cdMul(S);
      if (lv >= 10) { var px = -h.diry, py = h.dirx; for (var j = 0; j < 20; j++) { var o = (j - 9.5) * 0.9; S.zones.push({ kind: "drop", key: "arrow-volley", x: h.x + h.dirx * 7 + px * o, y: h.y + h.diry * 7 + py * o, r1: 0.9, t: 0, life: 0.12, delay: 0.3 + (j % 5) * 0.06, dmg: heroDmg(S, 1.4), fk: "none", fp: 1, hit: {} }); } return; }
      var n = Math.round(lin(lv, 3, 7)), a0 = Math.atan2(h.diry, h.dirx), spread = lin(lv, 0.5, 0.9);
      for (var i = 0; i < n; i++) { var a = a0 + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0); S.shots.push({ key: "arrow-volley", x: h.x, y: h.y, vx: Math.cos(a) * 18, vy: Math.sin(a) * 18, r: 0.3 * am, life: 0.9, pierce: 0, dmg: heroDmg(S, lin(lv, 0.8, 1.3)), fk: "none", hit: {}, bounce: 0 }); }
    },
    // 52. a turret is PLANTED and shoots the nearest monster; L10 one siege ballista whose bolts pierce everything
    "hunter-s-turret": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt; var max = lv >= 10 ? 1 : Math.round(lin(lv, 1, 3));
      if (st.t <= 0) { st.t = lin(lv, 6, 4) * cdMul(S); st.o.push({ x: h.x, y: h.y, life: lv >= 10 ? 1e9 : 12, cd: 0, aim: 0 }); while (st.o.length > max) st.o.shift(); }
      if (lv >= 10 && st.o[0]) { var b = st.o[0], bx = h.x - b.x, by = h.y - b.y; if (bx * bx + by * by > 100) { b.x = h.x; b.y = h.y; } }   // the ballista keeps up
      for (var i = st.o.length - 1; i >= 0; i--) { var tu = st.o[i]; tu.life -= dt; if (tu.life <= 0) { st.o.splice(i, 1); continue; } tu.cd -= dt; if (tu.cd > 0) continue;
        var tg = nearest(S, tu.x, tu.y, lv >= 10 ? 16 : 9); if (!tg) continue; tu.cd = lv >= 10 ? 1 : lin(lv, 0.7, 0.4); var dx = tg.x - tu.x, dy = tg.y - tu.y, d = Math.sqrt(dx * dx + dy * dy) || 1; tu.aim = Math.atan2(dy, dx);
        S.shots.push({ key: "hunter-s-turret", x: tu.x, y: tu.y, vx: dx / d * 20, vy: dy / d * 20, r: (lv >= 10 ? 0.6 : 0.3) * am, life: 1, pierce: lv >= 10 ? 99 : 0, dmg: heroDmg(S, lv >= 10 ? 3 : lin(lv, 0.7, 1.2)), fk: "knock", hit: {}, bounce: 0 }); }
    },
    // 53. a bolt CHARGES up, then fires through a long line; L10 a beam across the whole screen
    "piercing-bolt": function (S, st, lv, dt, h, am) {
      st.ch = (st.ch || 0) + dt; var need = lin(lv, 2.0, 1.2) * cdMul(S); st.need = need; if (st.ch < need) return; st.ch = 0;
      if (lv >= 10) { var a = Math.atan2(h.diry, h.dirx), L = VIEW.w; near(S, h.x + h.dirx * L / 2, h.y + h.diry * L / 2, L / 2 + 1.5, function (m) { if (segDist(m.x, m.y, h.x, h.y, a, L) <= 1.2 + m.r) hit(S, m, heroDmg(S, 6), "none"); });
        S.fx.push({ kind: "rail", key: "piercing-bolt", x: h.x, y: h.y, a: a, len: L, t: 0, life: 0.35 }); return; }
      S.shots.push({ key: "piercing-bolt", x: h.x, y: h.y, vx: h.dirx * 30, vy: h.diry * 30, r: 0.5 * am, life: lin(lv, 0.6, 0.9), pierce: 99, dmg: heroDmg(S, lin(lv, 2.4, 4)), fk: "none", hit: {}, bounce: 0 });
    },
    // 54. a falcon DIVES on monsters from above, then climbs; L10 the stormhawk: each dive throws lightning to 3 more
    "falcon-companion": function (S, st, lv, dt, h, am) {
      var f = st.f || (st.f = { x: h.x, y: h.y, alt: 1, tg: null, cd: 0 }); f.cd -= dt;
      if (!f.tg) { var a = S.t * 1.2; f.x += (h.x + Math.cos(a) * 3 - f.x) * Math.min(1, dt * 3); f.y += (h.y + Math.sin(a) * 2 - f.y) * Math.min(1, dt * 3); f.alt = Math.min(1, f.alt + dt * 2);
        if (f.cd <= 0) { f.tg = nearest(S, h.x, h.y, 11); } return; }
      if (f.tg.hp <= 0) { f.tg = null; return; }
      var dx = f.tg.x - f.x, dy = f.tg.y - f.y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = 18 * dt; f.alt = Math.max(0, f.alt - dt * 3);
      if (d <= sp + f.tg.r) { hit(S, f.tg, heroDmg(S, lin(lv, 1.6, 2.8) * (lv >= 10 ? 1.4 : 1)), "dot", 1.5);
        if (lv >= 10) { var tg0 = f.tg, c = 0; near(S, tg0.x, tg0.y, 5, function (m) { if (m !== tg0 && c < 3) { c++; hit(S, m, heroDmg(S, 1.5), "stun", 0.6); S.fx.push({ kind: "bolt2", key: "falcon-companion", x: tg0.x, y: tg0.y, tx: m.x, ty: m.y, t: 0, life: 0.2 }); } }); }
        f.tg = null; f.cd = lin(lv, 1.6, 0.8); } else { f.x += dx / d * sp; f.y += dy / d * sp; }
    },
    // 55. mines are dropped BEHIND you as you walk and blow when stepped on; L10 a minefield
    "spark-mines": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; var max = lv >= 10 ? 30 : Math.round(lin(lv, 3, 8));
      if (h.mvx || h.mvy) { st.walk = (st.walk || 0) + h.speed * dt; if (st.walk >= (lv >= 10 ? 1.2 : 2)) { st.walk = 0; st.o.push({ x: h.x - h.dirx * 0.8, y: h.y - h.diry * 0.8, arm: 0.5 }); if (st.o.length > max) st.o.shift(); } }
      for (var i = st.o.length - 1; i >= 0; i--) { var mn = st.o[i]; if (mn.arm > 0) { mn.arm -= dt; continue; } var trip = false; near(S, mn.x, mn.y, 0.9, function () { trip = true; });
        if (trip) { var R = lin(lv, 1.8, 2.6) * am * (lv >= 10 ? 1.2 : 1); near(S, mn.x, mn.y, R, function (m) { hit(S, m, heroDmg(S, lin(lv, 1.6, 2.6)), "stun", 1); }); S.fx.push({ kind: "boom", key: "spark-mines", x: mn.x, y: mn.y, r: R, t: 0, life: 0.35 }); st.o.splice(i, 1); } }
    },
    // 56. a CROSSHAIR settles on a FAR monster, then a sniper shot crits it; L10 every far monster is marked
    "eagle-eye": function (S, st, lv, dt, h, am) {
      st.aims = st.aims || [];
      if (!st.aims.length) { st.t -= dt; if (st.t > 0) return; var far = S.monsters.filter(function (m) { var dx = m.x - h.x, dy = m.y - h.y; return m.hp > 0 && dx * dx + dy * dy > 64 && Math.abs(dx) < VIEW.w / 2 && Math.abs(dy) < VIEW.h / 2; });
        far.sort(function (a, b) { return Math.hypot(b.x - h.x, b.y - h.y) - Math.hypot(a.x - h.x, a.y - h.y) || a.id - b.id; });
        st.aims = far.slice(0, lv >= 10 ? 6 : 1).map(function (m) { return { m: m, t: lin(lv, 1.2, 0.6) }; }); st.t = lin(lv, 3, 1.8) * cdMul(S); return; }
      for (var i = st.aims.length - 1; i >= 0; i--) { var a = st.aims[i]; a.t -= dt; if (a.m.hp <= 0) { st.aims.splice(i, 1); continue; }
        if (a.t <= 0) { hit(S, a.m, heroDmg(S, lin(lv, 5, 9)) * (1 + h.critDmg), "none"); S.fx.push({ kind: "snipe", key: "eagle-eye", x: h.x, y: h.y, tx: a.m.x, ty: a.m.y, t: 0, life: 0.2 }); st.aims.splice(i, 1); } }
    },
    // 57. shots BOUNCE OFF THE SCREEN EDGES like pinballs; L10 they never stop
    "ricochet-shots": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt;
      if (st.t <= 0) { st.t = lin(lv, 2.4, 1.4) * cdMul(S); if (lv < 10 || st.o.length < 4) for (var n = lv >= 10 ? 4 : Math.round(lin(lv, 1, 3)), i = 0; i < n; i++) { var a = Math.atan2(h.diry, h.dirx) + (i - (n - 1) / 2) * 0.5;
          st.o.push({ x: h.x, y: h.y, vx: Math.cos(a) * 15, vy: Math.sin(a) * 15, b: lv >= 10 ? 1e9 : Math.round(lin(lv, 2, 6)), life: lv >= 10 ? 1e9 : 6, hit: {}, rh: 0 }); } }
      var hx = VIEW.w / 2 - 0.5, hy = VIEW.h / 2 - 0.5;
      for (var k = st.o.length - 1; k >= 0; k--) { var o = st.o[k]; o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt; o.rh -= dt; if (o.rh <= 0) { o.rh = 0.4; o.hit = {}; }
        if (o.x < h.x - hx || o.x > h.x + hx) { o.vx = -o.vx; o.x = clamp(o.x, h.x - hx, h.x + hx); o.b--; } if (o.y < h.y - hy || o.y > h.y + hy) { o.vy = -o.vy; o.y = clamp(o.y, h.y - hy, h.y + hy); o.b--; }
        if (o.b < 0 || o.life <= 0) { st.o.splice(k, 1); continue; }
        near(S, o.x, o.y, 0.5 * am, function (m) { if (!o.hit[m.id]) { o.hit[m.id] = 1; hit(S, m, heroDmg(S, lin(lv, 0.9, 1.5)), "none"); } }); }
    },
    // 58. arrows rain in a RING round you, hitting what comes close; L10 rain over the whole screen
    "rain-of-arrows": function (S, st, lv, dt, h, am) {
      st.t -= dt; if (st.t > 0) return; st.t = lin(lv, 0.35, 0.18);
      for (var i = 0, n = lv >= 10 ? 6 : 1; i < n; i++) { var a = S.rng() * Math.PI * 2, r = lv >= 10 ? Math.sqrt(S.rng()) * VIEW.h / 2 : lin(lv, 3, 4.5) * am * (0.85 + S.rng() * 0.3);
        S.zones.push({ kind: "drop", key: "rain-of-arrows", x: h.x + Math.cos(a) * r * (lv >= 10 ? VIEW.w / VIEW.h : 1), y: h.y + Math.sin(a) * r, r1: 0.9, t: 0, life: 0.1, delay: 0.25, dmg: heroDmg(S, lin(lv, 0.7, 1.1)), fk: "none", fp: 1, hit: {} }); }
    },
    // 59. a gust shot BLOWS a corridor clear ahead; L10 an arrow carrying a tornado that drags monsters along
    "wind-shot": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt;
      if (st.t <= 0) { st.t = lin(lv, 2.6, 1.6) * cdMul(S); st.o.push({ x: h.x, y: h.y, vx: h.dirx * 12, vy: h.diry * 12, w: (lv >= 10 ? 2.4 : lin(lv, 1.2, 2)) * am, life: lin(lv, 1.0, 1.5), hit: {}, big: lv >= 10 ? 1 : 0 }); }
      for (var k = st.o.length - 1; k >= 0; k--) { var o = st.o[k]; o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt; if (o.life <= 0) { st.o.splice(k, 1); continue; }
        var vl = Math.sqrt(o.vx * o.vx + o.vy * o.vy) || 1;
        near(S, o.x, o.y, o.w, function (m) { if (m.type === "boss") return; if (o.big) { m.x += (o.x - m.x) * Math.min(1, dt * 8) + o.vx * dt; m.y += (o.y - m.y) * Math.min(1, dt * 8) + o.vy * dt; } else { m.x += o.vx / vl * lin(lv, 3, 5) * dt * 4; m.y += o.vy / vl * lin(lv, 3, 5) * dt * 4; }
          if (!o.hit[m.id]) { o.hit[m.id] = 1; hit(S, m, heroDmg(S, lin(lv, 0.8, 1.4) * (o.big ? 2 : 1)), "none"); } }); }
    },
    // 60. flares are shot UP and land round you, leaving fire that blinds; L10 a signal column calls a barrage
    "flare-trail": function (S, st, lv, dt, h, am) {
      st.o = st.o || []; st.t -= dt;
      if (st.t <= 0) { st.t = lin(lv, 3.5, 2.2) * cdMul(S);
        if (lv >= 10) { st.col = 1.2; for (var j = 0; j < 12; j++) S.zones.push({ kind: "drop", key: "flare-trail", x: h.x + (S.rng() - 0.5) * VIEW.w * 0.8, y: h.y + (S.rng() - 0.5) * VIEW.h * 0.8, r1: 2.2, t: 0, life: 0.2, delay: 1 + j * 0.12, dmg: heroDmg(S, 2.5), fk: "dot", fp: 1.5, hit: {}, big: 1 }); }
        else for (var n = Math.round(lin(lv, 2, 5)), i = 0; i < n; i++) { var a = S.rng() * Math.PI * 2, r = 3 + S.rng() * 3; st.o.push({ x: h.x, y: h.y, tx: h.x + Math.cos(a) * r, ty: h.y + Math.sin(a) * r, fly: 0.8, fly0: 0.8, life: lin(lv, 3, 5), r: lin(lv, 1.2, 1.8) * am }); } }
      if (st.col > 0) st.col -= dt;
      st.k = (st.k || 0) - dt; var tick = st.k <= 0; if (tick) st.k = 0.4;
      for (var k = st.o.length - 1; k >= 0; k--) { var o = st.o[k]; if (o.fly > 0) { o.fly -= dt; continue; } o.life -= dt; if (o.life <= 0) { st.o.splice(k, 1); continue; }
        if (tick) near(S, o.tx, o.ty, o.r, function (m) { hit(S, m, heroDmg(S, lin(lv, 0.4, 0.7)), "dot", 1); m.blindT = Math.max(m.blindT || 0, 0.8); }); }
    },
  };

  /* ---- auras ------------------------------------------------------------------------------------------------------------------- */
  function auraRow(S, key) { for (var i = 0; i < S.aurasTable.length; i++) if (S.aurasTable[i].key === key) return S.aurasTable[i]; return null; }
  function runAura(S, key, lvl, dt) {
    var row = auraRow(S, key); if (!row) return;
    var L = LADDER[row.fam][clamp(lvl, 1, AURA_MAX) - 1], st = S._state[key] || (S._state[key] = { t: 0, a: 0, trail: [] });
    if (SPELL[key]) { SPELL[key](S, st, clamp(lvl, 1, AURA_MAX), dt, S.hero, areaMul(S)); return; }   // v3: its own behaviour
    var h = S.hero, fk = fxKind(row.fx), am = areaMul(S), cm = cdMul(S);
    switch (row.fam) {
      case "orbit": {                               // units circle the hero and hit what they touch (0.5 s per-monster re-hit)
        st.a += dt * 2.2 * L.spd;
        var n = L.n + plenty(S), R = 2.0 * L.rad * am, ur = 0.45 * L.size * am;
        if (L.special) {                            // level 10: one wheel - the whole ring hits
          near(S, h.x, h.y, R + ur, function (m, dx, dy) { var d = Math.sqrt(dx * dx + dy * dy); if (Math.abs(d - R) <= ur + m.r && !(m._hitBy && m._hitBy[key] > S.t)) { (m._hitBy || (m._hitBy = {}))[key] = S.t + 0.35; hit(S, m, heroDmg(S, L.dmg), fk, 1.5); } });
          break;
        }
        for (var i = 0; i < n; i++) {
          var a = st.a + i * Math.PI * 2 / n, ox = h.x + Math.cos(a) * R, oy = h.y + Math.sin(a) * R;
          near(S, ox, oy, ur, function (m) { if (!(m._hitBy && m._hitBy[key] > S.t)) { (m._hitBy || (m._hitBy = {}))[key] = S.t + 0.5; hit(S, m, heroDmg(S, L.dmg), fk, 1); } });
        }
        break;
      }
      case "pulse": {
        st.t -= dt; if (st.t > 0) break; st.t = L.cd * cm;
        for (var k = 0; k < L.rings; k++) S.zones.push({ kind: "ring", key: key, x: h.x, y: h.y, r0: 0.3, r1: L.rad * am * (1 + k * 0.35), t: 0, life: 0.45 + k * 0.15, delay: k * 0.2, dmg: heroDmg(S, L.dmg), fk: fk, fp: L.fx || 1, hit: {} });
        break;
      }
      case "trail": {
        st.t -= dt; if (st.t > 0) break; st.t = 0.25;
        if (h.mvx || h.mvy) {
          S.zones.push({ kind: "puddle", key: key, x: h.x, y: h.y, r: L.w * am, t: 0, life: L.life, tick: 0, dmg: heroDmg(S, L.dmg), fk: L.fx ? fk : "none", fp: L.fx || 1, ang: Math.atan2(h.diry, h.dirx) });
          if (L.split) S.zones.push({ kind: "puddle", key: key, x: h.x - h.diry * 1.2, y: h.y + h.dirx * 1.2, r: L.w * am, t: 0, life: L.life, tick: 0, dmg: heroDmg(S, L.dmg), fk: L.fx ? fk : "none", fp: L.fx || 1, ang: Math.atan2(h.diry, h.dirx) });
        }
        break;
      }
      case "rain": {
        st.t -= dt; if (st.t > 0) break; st.t = L.cd * cm;
        var nr = L.n + plenty(S);
        for (var j = 0; j < nr; j++) {
          var tgt = S.monsters.length ? S.monsters[(S.rng() * S.monsters.length) | 0] : null;
          var tx = tgt ? tgt.x : h.x + (S.rng() - 0.5) * 10, ty = tgt ? tgt.y : h.y + (S.rng() - 0.5) * 10;
          S.zones.push({ kind: "drop", key: key, x: tx, y: ty, r1: L.rad * am, t: 0, life: 0.15, delay: 0.5 + j * 0.08, dmg: heroDmg(S, L.dmg), fk: fk, fp: 1, hit: {} });
        }
        break;
      }
      case "shot": {
        st.t -= dt; if (st.t > 0) break; st.t = L.cd * cm;
        var ns = L.n + plenty(S), spread = 0.22;
        for (var q = 0; q < ns; q++) {
          var off = (q - (ns - 1) / 2) * spread, ca = Math.cos(off), sa = Math.sin(off);
          var vx = (h.dirx * ca - h.diry * sa) * L.spd, vy = (h.dirx * sa + h.diry * ca) * L.spd;
          S.shots.push({ key: key, x: h.x, y: h.y, vx: vx, vy: vy, r: 0.3 * L.size * am, life: 1.6, pierce: L.pierce, dmg: heroDmg(S, L.dmg), fk: fk, hit: {}, bounce: /bounce|chain/.test(row.fx) ? 2 : 0 });
        }
        break;
      }
      case "buddy": {                               // companions orbit loosely and strike the nearest enemy in range
        st.t -= dt; if (st.t > 0) break; st.t = L.cd * cm;
        for (var b = 0; b < L.n; b++) { var bt = nearest(S, h.x, h.y, L.range * am); if (bt) hit(S, bt, heroDmg(S, L.dmg), L.fx ? fk : "none", L.fx || 1); }
        break;
      }
      case "zone": {
        st.t -= dt; if (st.t > 0) break; st.t = L.tick;
        var zr = L.rad * am, zd = heroDmg(S, L.dmg);
        near(S, h.x, h.y, zr, function (m) { hit(S, m, zd, L.fx ? fk : "none", L.fx || 1); });
        if (fk === "heal") h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.002 * (L.fx || 1));
        break;
      }
      case "trigger": {                             // a small set of rules; the aura's fx word picks which
        st.t -= dt;
        var often = L.often || 1, P = L.p;
        if (fk === "guard") { if (st.t <= 0) { h.guard = Math.max(h.guard || 0, Math.round(P)); st.t = 8 / often; } }
        else if (fk === "heal" || fk === "speed") { if (!h._onKill) h._onKill = function () { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.004 * P); h.haste = Math.max(h.haste || 0, 1.0 * (L.dur || 1)); }; }
        else if (fk === "vuln") { if (st.t <= 0) { var mk = nearest(S, h.x, h.y, 9 * (L.area || 1)); if (mk) mk.vuln = 3 * (L.dur || 1) * (L.special ? 2 : 1); st.t = 3 / often; } }
        else if (fk === "dot" || fk === "knock") { h.thorns = 0.5 * P; }
        else if (st.t <= 0) { near(S, h.x, h.y, 3 * (L.area || 1), function (m) { hit(S, m, heroDmg(S, 0.4 * P), fk, P); }); st.t = 4 / often; }
        break;
      }
    }
  }

  /* ---- the ultimate: one press, a cone the way you move (the hero's own ult art comes later) ------------------------------------ */
  function ult(S) {
    var h = S.hero; if (h.ult < h.ultMax) return false;
    h.ult = 0;
    var R = 7 * areaMul(S), cosHalf = Math.cos(Math.PI / 3), d = heroDmg(S, 6);
    near(S, h.x, h.y, R, function (m, dx, dy) { var l = Math.sqrt(dx * dx + dy * dy) || 1; if ((dx * h.dirx + dy * h.diry) / l >= cosHalf) hit(S, m, d, "knock", 2); });
    S.fx.push({ kind: "ult", x: h.x, y: h.y, dx: h.dirx, dy: h.diry, t: 0, life: 0.6, seq: S.fxN = (S.fxN | 0) + 1 });
    return true;
  }

  /* ---- the hero's own skills: buttons, each on its own cooldown ----------------------------------------------------------------
   * kit row: { key, name, kind, cd (s), power, dur (s) }. The kind says what the press does; the hero's own spell art plays on top.
   *   heal  - restore power x max HP          (Linnet: Mending Stitch)
   *   ward  - for dur s her HP cannot drop below 1   (Linnet: Reinforced Seam - "can't drop below 1 HP")
   *   nova  - power x attack to everything within 4 m, knocked back
   *   bolt  - a piercing bolt the way you move, power x attack
   *   dash  - power metres the way you move, untouchable for 0.3 s */
  var SKILL_KINDS = {
    heal: function (S, k, h) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * k.power); },
    ward: function (S, k, h) { h.wardT = Math.max(h.wardT, k.dur || 4); },
    nova: function (S, k, h) { var d = heroDmg(S, k.power); near(S, h.x, h.y, 4 * areaMul(S), function (m) { hit(S, m, d, "knock", 1.5); }); },
    bolt: function (S, k, h) { S.shots.push({ key: k.key, x: h.x, y: h.y, vx: h.dirx * 18, vy: h.diry * 18, r: 0.6, life: 1.0, pierce: 99, dmg: heroDmg(S, k.power), fk: "none", hit: {}, bounce: 0 }); },
    dash: function (S, k, h) { h.x += h.dirx * k.power; h.y += h.diry * k.power; h.iframes = Math.max(h.iframes, 0.3); },
  };
  function useSkill(S, i) {
    var h = S.hero, k = h.kit[i | 0]; if (!k || k.cdLeft > 0) return false;
    SKILL_KINDS[k.kind](S, k, h); k.cdLeft = k.cd * cdMul(S);
    S.fx.push({ kind: "cast", key: k.key, slot: i | 0, x: h.x, y: h.y, t: 0, life: 0.5, seq: S.fxN = (S.fxN | 0) + 1 });
    return true;
  }

  /* ---- level-ups: 3 picks from what can still grow --------------------------------------------------------------------------- */
  function offers(S) {
    var h = S.hero, pool = [];
    var nA = Object.keys(h.auras).length, nP = Object.keys(h.passives).length;
    S.aurasTable.forEach(function (a) { var l = h.auras[a.key] | 0; if (l > 0 && l < AURA_MAX) pool.push({ t: "aura", key: a.key, to: l + 1, w: 3 }); else if (!l && nA < SLOTS.aura) pool.push({ t: "aura", key: a.key, to: 1, w: 2 }); });
    Object.keys(PASSIVES).forEach(function (k) { var l = h.passives[k] | 0; if (l > 0 && l < PASSIVE_MAX) pool.push({ t: "passive", key: k, to: l + 1, w: 2 }); else if (!l && nP < SLOTS.passive) pool.push({ t: "passive", key: k, to: 1, w: 1 }); });
    var out = [];
    while (out.length < 3 && pool.length) {
      var tw = 0; for (var i = 0; i < pool.length; i++) tw += pool[i].w;
      var r = S.rng() * tw, j = 0; for (; j < pool.length; j++) { r -= pool[j].w; if (r <= 0) break; }
      out.push(pool.splice(Math.min(j, pool.length - 1), 1)[0]);
    }
    if (!out.length) out.push({ t: "heal", key: "heal", to: 0 });
    return out.map(function (o) { return { t: o.t, key: o.key, to: o.to }; });
  }
  function choose(S, idx) {
    if (!S.choice) return false;
    var o = S.choice[clamp(idx | 0, 0, S.choice.length - 1)], h = S.hero;
    if (o.t === "aura") h.auras[o.key] = o.to;
    else if (o.t === "passive") { h.passives[o.key] = o.to; h.maxHp = h.baseHp * (1 + pas(S, "vigor")); }
    else h.hp = h.maxHp;
    S.choice = null;
    return true;
  }

  /* ---- spawning ------------------------------------------------------------------------------------------------------------------ */
  function spawn(S, type, o) {
    o = o || {};
    if (S.monsters.length >= HARD_MAX && type !== "boss") return null;
    var base = MONSTERS[type], sc = stageScale(S.stage) * (type === "boss" ? 1 : clockScale(S.t)) * (o.hpMul || 1);
    // a point on a frame 1-4 m outside the view, edges picked by length so the horde comes evenly from all round
    var hx = VIEW.w / 2 + 1 + S.rng() * 3, hy = VIEW.h / 2 + 1 + S.rng() * 3, u = S.rng() * 2 * (hx + hy), ox, oy;
    if (u < hx) { ox = -hx + 2 * u; oy = -hy; } else if (u < 2 * hx) { ox = -hx + 2 * (u - hx); oy = hy; }
    else if (u < 2 * hx + hy) { ox = -hx; oy = -hy + 2 * (u - 2 * hx); } else { ox = hx; oy = -hy + 2 * (u - 2 * hx - hy); }
    // AHEAD: while the hero moves, 2 in 3 spawns come from the side it is heading to, so the horde meets it instead of trailing
    var h = S.hero; if ((h.mvx || h.mvy) && S.rng() < 0.67 && ox * h.dirx + oy * h.diry < 0) { ox = -ox; oy = -oy; }
    if (o.x != null) { ox = o.x - S.hero.x; oy = o.y - S.hero.y; }
    var ro = roster(S.stage), pool = ro[o.big ? "big" : type] || ro.swarmer;
    var m = { id: S.nextId++, type: type, x: S.hero.x + ox, y: S.hero.y + oy, hp: base.hp * sc, maxHp: base.hp * sc,
              dmg: base.dmg * Math.sqrt(sc), spd: base.spd, r: base.r * (o.rMul || 1), skin: pool[Math.floor(S.rng() * pool.length)] };
    if (o.vx != null) { m.vx = o.vx; m.vy = o.vy; m.life = o.life; }      // a swarm member: flies straight, then leaves
    else if (o.life != null) m.life = o.life;                          // a wall member: chases, then fades when the event ends
    if (o.ev) m.ev = 1;
    if (o.wb) m.wb = 1;
    if (type === "caster" || type === "boss") m.cdT = 1.5 + S.rng() * 2;
    S.monsters.push(m);
    if (type === "boss") S.boss = m;
    return m;
  }
  // map events (outside the wave count, may go past 300)
  function swarm(S) {        // a tight pack of 14 runners that sweeps straight across the screen, aimed at where the hero is now
    var h = S.hero, a = S.rng() * Math.PI * 2, R = VIEW.w / 2 + 3, sx = h.x + Math.cos(a) * R, sy = h.y + Math.sin(a) * R * VIEW.h / VIEW.w;
    var dx = h.x - sx, dy = h.y - sy, dl = Math.sqrt(dx * dx + dy * dy) || 1, px = -dy / dl, py = dx / dl;
    for (var i = 0; i < 14; i++) { var k = (i % 7) - 3, row = Math.floor(i / 7);
      spawn(S, "runner", { x: sx + px * k * 0.9 - dx / dl * row * 0.9, y: sy + py * k * 0.9 - dy / dl * row * 0.9, vx: dx / dl * 7, vy: dy / dl * 7, life: (2 * R) / 7 + 1, ev: 1 }); }
  }
  function wallRing(S, dur) {  // a ring of 36 walls round the hero, on screen, closing in; gone when the event ends
    var h = S.hero, R = VIEW.h / 2 - 2;
    for (var i = 0; i < 36; i++) { var a = i / 36 * Math.PI * 2; spawn(S, "wall", { x: h.x + Math.cos(a) * R, y: h.y + Math.sin(a) * R, life: dur, ev: 1 }); }
  }
  function spawnStep(S, dt) {
    if (S.noSpawn) return;                                                                    // tests: a quiet field
    var wi = waveIndex(S.t), W = WAVES[wi], w0 = Math.floor(S.t / 60) * 60;
    if (wi !== S._wave || w0 !== S._waveAt) {                                                  // a new minute: its boss, its events
      S._wave = wi; S._waveAt = w0; S._evDone = 0; S._waveT = 0;
      if (S.t < TICK) {                                   // the opening batch ON screen (Vampire Survivors spawns one on entry): no dead first 12 s
        for (var ib = 0; ib < W.min; ib++) { var ab = ib / W.min * Math.PI * 2 + S.rng() * 0.3; spawn(S, W.ty[ib % W.ty.length], { x: S.hero.x + Math.cos(ab) * 12, y: S.hero.y + Math.sin(ab) * 12 * 0.8 }); }
        S._waveT = W.iv;                                  // the batch IS this interval's top-up
      }
      if (W.boss === "elite") spawn(S, "elite", { wb: 1 });                                     // wave bosses sit outside the 300
      else if (W.boss === "big") spawn(S, "elite", { hpMul: 3, rMul: 1.35, wb: 1, big: 1 });
    }
    // the wave: every iv seconds, top up to min, or add one of each type
    S._waveT -= dt;
    if (S._waveT <= 0) {
      S._waveT += W.iv;
      var min = Math.min(MAX_MONSTERS, Math.round(W.min * (1 + (S.stage - 1) * 0.05))), alive = 0;
      for (var i = 0; i < S.monsters.length; i++) if (!S.monsters[i].ev && !S.monsters[i].wb && S.monsters[i].type !== "boss") alive++;
      if (alive < MAX_MONSTERS) {
        if (alive < min) for (var n = alive; n < min; n++) spawn(S, W.ty[n % W.ty.length]);
        else for (var j = 0; j < W.ty.length && alive + j < MAX_MONSTERS; j++) spawn(S, W.ty[j]);
      }
    }
    // map events: n repeats spread over the minute (from :05), each with chance p
    if (W.ev) { var due = 5 + S._evDone * (50 / W.ev.n);
      if (S._evDone < W.ev.n && S.t - w0 >= due) { S._evDone++; if (S.rng() < W.ev.p) { if (W.ev.k === "swarm") swarm(S); else wallRing(S, W.ev.dur || 20); } } }
    if (S.mode === "story" && !S.bossSpawned && S.t >= STORY_SECONDS) { S.bossSpawned = true; spawn(S, "boss"); }
  }

  /* ---- one fixed tick -------------------------------------------------------------------------------------------------------------
   * input: { mx, my } joystick (-1..1), ult: true on the tick it is pressed, skill: kit slot pressed this tick,
   * pick: index when a level-up is open.
   * Every call is recorded in S.inputs as compact changes, so a replay feeds the same values on the same ticks. */
  function record(S, input) {
    var last = S._lastIn || { mx: 0, my: 0 };
    var qx = Math.round(clamp(+input.mx || 0, -1, 1) * 100), qy = Math.round(clamp(+input.my || 0, -1, 1) * 100);
    if (qx !== last.mx || qy !== last.my) { S.inputs.push([S.tick, "m", qx, qy]); S._lastIn = { mx: qx, my: qy }; }
    if (input.ult) S.inputs.push([S.tick, "u"]);
    if (input.skill != null && !S.choice) S.inputs.push([S.tick, "s", input.skill | 0]);
    if (input.pick != null && S.choice) S.inputs.push([S.tick, "c", input.pick | 0]);
    return { mx: qx / 100, my: qy / 100 };
  }
  function step(S, input) {
    if (S.ended) return S;
    input = input || {};
    var mv = record(S, input), h = S.hero, dt = TICK;
    if (S.choice) { if (input.pick != null) choose(S, input.pick); S.tick++; return S; }     // the run pauses while a pick is open
    // move + facing (aim = the way you move; standing still keeps the last facing)
    var ml = Math.sqrt(mv.mx * mv.mx + mv.my * mv.my);
    h.mvx = 0; h.mvy = 0;
    if (ml > 0.05) {
      var nx = mv.mx / Math.max(1, ml), ny = mv.my / Math.max(1, ml), sp = h.speed * (1 + pas(S, "swift")) * (h.haste > 0 ? 1.25 : 1);
      h.x += nx * sp * dt; h.y += ny * sp * dt; h.mvx = nx; h.mvy = ny; h.dirx = nx / (Math.min(1, ml) || 1); h.diry = ny / (Math.min(1, ml) || 1);
      var dl = Math.sqrt(h.dirx * h.dirx + h.diry * h.diry) || 1; h.dirx /= dl; h.diry /= dl;
    }
    if (h.haste > 0) h.haste -= dt;
    if (input.ult) ult(S);
    for (var ki = 0; ki < h.kit.length; ki++) if (h.kit[ki].cdLeft > 0) h.kit[ki].cdLeft = Math.max(0, h.kit[ki].cdLeft - dt);
    if (input.skill != null) useSkill(S, input.skill);
    if (h.wardT > 0) h.wardT -= dt;
    spawnStep(S, dt);
    buildGrid(S);
    // auras
    var keys = Object.keys(h.auras).sort();
    S._hurtPrev = S._hurt || []; S._hurt = []; S._killsPrev = S._kills || []; S._kills = [];                // who hit the hero last tick (Thorn Hide lashes them)
    for (var i = 0; i < keys.length; i++) runAura(S, keys[i], h.auras[keys[i]], dt);
    // song notes (Song Notes): along a wavy line (or a spiral), each monster charmed once
    for (var ni = S.notes.length - 1; ni >= 0; ni--) { var nt = S.notes[ni]; nt.t += dt; if (nt.t >= nt.life) { S.notes.splice(ni, 1); continue; }
      var ds = nt.sp * nt.t, na = nt.ang + (nt.spiral ? nt.t * 1.6 : 0), wv = Math.sin(nt.t * nt.fq) * nt.amp;
      nt.x = nt.x0 + Math.cos(na) * ds - Math.sin(na) * wv; nt.y = nt.y0 + Math.sin(na) * ds + Math.cos(na) * wv;
      near(S, nt.x, nt.y, 0.6, function (m) { if (nt.hit[m.id] || m.type === "boss") return; nt.hit[m.id] = 1; hit(S, m, nt.dmg, "none"); m.charmT = Math.max(m.charmT || 0, nt.charm); }); }
    // rolling things (Boulder Roll): roll, grow, flatten each monster once, crumble at the end
    for (var ri = S.rollers.length - 1; ri >= 0; ri--) { var ro = S.rollers[ri]; ro.x += ro.vx * dt; ro.y += ro.vy * dt; ro.life -= dt; ro.r = Math.min(ro.rmax, ro.r + ro.grow * dt);
      near(S, ro.x, ro.y, ro.r, function (m) { if (ro.hit[m.id]) return; ro.hit[m.id] = 1; hit(S, m, ro.dmg, "none"); var vl = Math.sqrt(ro.vx * ro.vx + ro.vy * ro.vy) || 1; m.x += ro.vx / vl * 2.2; m.y += ro.vy / vl * 2.2; m.stunT = Math.max(m.stunT || 0, 0.3); });
      if (ro.life <= 0) { S.fx.push({ kind: "crumble", key: ro.key, x: ro.x, y: ro.y, r: ro.r, t: 0, life: 0.5 }); S.rollers.splice(ri, 1); } }
    // a base attack so a fresh hero is never helpless: a shot the way you move every 1.1 s
    S._baseT = (S._baseT || 0) - dt;
    if (S._baseT <= 0) { S._baseT = 1.1 * cdMul(S); S.shots.push({ key: "_base", x: h.x, y: h.y, vx: h.dirx * 13, vy: h.diry * 13, r: 0.3, life: 1.2, pierce: 0, dmg: heroDmg(S, 1.0), fk: "none", hit: {}, bounce: 0 }); }
    // shots
    for (var s = S.shots.length - 1; s >= 0; s--) {
      var sh = S.shots[s]; sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt;
      var spent = false;
      near(S, sh.x, sh.y, sh.r, function (m) {
        if (spent || sh.hit[m.id]) return; sh.hit[m.id] = 1; hit(S, m, sh.dmg, sh.fk, 1);
        if (sh.bounce > 0) { var nb = null, bd = 1e9; near(S, m.x, m.y, 5, function (o, dx, dy) { if (!sh.hit[o.id]) { var dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; nb = o; } } });
          if (nb) { var bx = nb.x - sh.x, by = nb.y - sh.y, bl = Math.sqrt(bx * bx + by * by) || 1, sp2 = Math.sqrt(sh.vx * sh.vx + sh.vy * sh.vy); sh.vx = bx / bl * sp2; sh.vy = by / bl * sp2; sh.bounce--; return; } }
        if (sh.pierce-- <= 0) spent = true;
      });
      if (spent || sh.life <= 0) S.shots.splice(s, 1);
    }
    // zones (rings, drops, puddles)
    for (var z = S.zones.length - 1; z >= 0; z--) {
      var zn = S.zones[z];
      if (zn.delay > 0) { zn.delay -= dt; continue; }
      zn.t += dt;
      if (zn.kind === "ripple") { var rq = zn.r0 + (zn.r1 - zn.r0) * Math.min(1, zn.t / zn.life); near(S, zn.x, zn.y, rq + 0.9, function (m, dx, dy) { if (!zn.hit[m.id] && Math.abs(Math.sqrt(dx * dx + dy * dy) - rq) <= m.r + 0.8) { zn.hit[m.id] = 1; hit(S, m, zn.dmg, zn.fk, zn.fp); } }); }
      else if (zn.kind === "crack") { var cl = zn.len * Math.min(1, zn.t / zn.grow); zn.tick -= dt; if (zn.tick <= 0 && zn.life > 1.5) { zn.tick = 0.5; zn.hit = {}; }
        near(S, zn.x + Math.cos(zn.ang) * cl / 2, zn.y + Math.sin(zn.ang) * cl / 2, cl / 2 + zn.w, function (m) { if (!zn.hit[m.id] && segDist(m.x, m.y, zn.x, zn.y, zn.ang, cl) <= zn.w + m.r) { zn.hit[m.id] = 1; hit(S, m, zn.dmg, zn.fk, 1.5); } }); }
      else if (zn.kind === "roar") { }
      else if (zn.kind === "ring") { var rr = zn.r0 + (zn.r1 - zn.r0) * Math.min(1, zn.t / zn.life); near(S, zn.x, zn.y, rr, function (m) { if (!zn.hit[m.id]) { zn.hit[m.id] = 1; hit(S, m, zn.dmg, zn.fk, zn.fp); } }); }
      else if (zn.kind === "drop") { if (!zn.done) { zn.done = true; near(S, zn.x, zn.y, zn.r1, function (m) { hit(S, m, zn.dmg, zn.fk, zn.fp); }); } }
      else if (zn.kind === "puddle") { zn.tick -= dt; if (zn.tick <= 0) { zn.tick = 0.5; near(S, zn.x, zn.y, zn.r, function (m) { hit(S, m, zn.dmg, zn.fk, zn.fp); }); } }
      if (zn.t >= zn.life) S.zones.splice(z, 1);
    }
    // monsters: chase, contact damage, status timers
    var armorDR = h.armor / (h.armor + 600), taken = Math.max(0.2, 1 - armorDR - pas(S, "plating"));
    for (var mi = S.monsters.length - 1; mi >= 0; mi--) {
      var m = S.monsters[mi];
      if (m.hp <= 0) { S.monsters.splice(mi, 1); continue; }
      if (m.dotT > 0) { m.dotT -= dt; m.hp -= m.dot * dt; S.dealt += m.dot * dt; if (m.hp <= 0) { kill(S, m); S.monsters.splice(mi, 1); continue; } }
      if (m.vuln > 0) m.vuln -= dt;
      if (m.pullT > 0) { m.pullT -= dt; var px0 = h.x - m.x, py0 = h.y - m.y, pd = Math.sqrt(px0 * px0 + py0 * py0) || 1;
        if (pd > 1.4 + m.r) { var pv = Math.min(pd - 1.4 - m.r, 16 * dt); m.x += px0 / pd * pv; m.y += py0 / pd * pv; }
        if (m.pullT <= 0) { m.stunT = m.pullStun || 1; hit(S, m, m.pullDmg || 0, "none"); }
        continue; }
      if (m.stunT > 0) { m.stunT -= dt; continue; }
      if (m.frozenT > 0) { m.frozenT -= dt; continue; }                                                  // frozen solid: no move, no bite
      if (m.charmT > 0) { m.charmT -= dt; var foe = null, fd = 49;                                       // CHARMED: turns on the horde
        near(S, m.x, m.y, 7, function (o, ox, oy) { if (o !== m && !(o.charmT > 0)) { var od = ox * ox + oy * oy; if (od < fd) { fd = od; foe = o; } } });
        if (foe) { var fx2 = foe.x - m.x, fy2 = foe.y - m.y, fl2 = Math.sqrt(fx2 * fx2 + fy2 * fy2) || 1; if (fl2 > m.r + foe.r) { m.x += fx2 / fl2 * m.spd * dt; m.y += fy2 / fl2 * m.spd * dt; }
          else { m.biteT = (m.biteT || 0) - dt; if (m.biteT <= 0) { m.biteT = 0.5; hit(S, foe, m.dmg * 3, "none"); } } }
        continue; }
      if (m.blindT > 0) { m.blindT -= dt; var wa = m.id * 1.7 + S.t * 0.6; m.x += Math.cos(wa) * m.spd * 0.4 * dt; m.y += Math.sin(wa) * m.spd * 0.4 * dt; continue; }   // BLIND: wanders
      if (m.life != null) { m.life -= dt; if (m.life <= 0) { S.monsters.splice(mi, 1); continue; } }   // an event member leaves
      var dx = h.x - m.x, dy = h.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp3 = m.spd * (m.slowT > 0 ? 0.5 : 1);
      if (h.hidden > 0 && m.type !== "boss") { var qx = h.decoyX - m.x, qy = h.decoyY - m.y, qd = Math.sqrt(qx * qx + qy * qy) || 1;   // Smoke Veil: they lost you
        if (Math.abs(dx) > VIEW.w / 2 + 8 || Math.abs(dy) > VIEW.h / 2 + 8) { if (!m.ev && !m.wb) { S.monsters.splice(mi, 1); continue; } }
        if (qd > 0.8) { m.x += qx / qd * sp3 * dt; m.y += qy / qd * sp3 * dt; } continue; }
      if (m.slowT > 0) m.slowT -= dt;
      // left behind: a wave monster 8 m past the view's edge is recycled (the wave refills near the hero). Bosses and wave elites never are.
      if (!m.ev && !m.wb && m.type !== "boss" && (Math.abs(dx) > VIEW.w / 2 + 8 || Math.abs(dy) > VIEW.h / 2 + 8)) { S.monsters.splice(mi, 1); continue; }
      if (m.vx != null) { m.x += m.vx * (m.slowT > 0 ? 0.5 : 1) * dt; m.y += m.vy * (m.slowT > 0 ? 0.5 : 1) * dt; }   // swarm: straight on
      else if (m.type === "caster") {                      // hold the range: close in, back off, or drift sideways
        var dir = d > CAST.range ? 1 : d < CAST.range - 2.5 ? -0.6 : 0, side = (m.id & 1) ? 0.35 : -0.35;
        m.x += (dx / d * dir - dy / d * side) * sp3 * dt; m.y += (dy / d * dir + dx / d * side) * sp3 * dt;
      }
      else { m.x += dx / d * sp3 * dt; m.y += dy / d * sp3 * dt; }
      if (m.cdT != null) { m.cdT -= dt;
        if (m.cdT <= 0 && S.eshots.length < CAST.maxShots && d <= (m.type === "boss" ? 16 : CAST.range + 1.5)) {
          var n = m.type === "boss" ? 5 : 1, a0 = Math.atan2(dy, dx);
          for (var q = 0; q < n; q++) { var aq = a0 + (q - (n - 1) / 2) * 0.32;
            S.eshots.push({ x: m.x, y: m.y, vx: Math.cos(aq) * CAST.speed, vy: Math.sin(aq) * CAST.speed, r: CAST.r * (m.type === "boss" ? 1.6 : 1),
                            life: CAST.life * (m.type === "boss" ? 1.6 : 1), dmg: m.dmg * CAST.dmgMul, skin: m.skin }); }
          m.cdT = m.type === "boss" ? 4 : CAST.cd + S.rng() * CAST.cdRand;
        } }
      if ((mi & 1) === (S.tick & 1)) {                     // half the horde per tick: a light push away from overlapping neighbours
        var px = 0, py = 0; near(S, m.x, m.y, m.r * 2, function (o, ex, ey) { if (o === m) return; var dd = ex * ex + ey * ey, rr = m.r + o.r;
          if (dd > 1e-6 && dd < rr * rr) { var l = Math.sqrt(dd), f = (rr - l) / rr; px -= ex / l * f; py -= ey / l * f; } });
        m.x += clamp(px, -1, 1) * 6 * dt * 2; m.y += clamp(py, -1, 1) * 6 * dt * 2;            // strong enough to beat the chase
      }
      if (d <= m.r + 0.45 && h.iframes <= 0) {
        if (h.guard > 0) { h.guard--; h.iframes = 0.4; }
        else { var dmg = absorb(S, m.dmg * taken * (1 - (h.domeDR || 0))); h.hp -= dmg; S.taken += dmg; h.iframes = 0.5; S._hurt.push(m); if (h.wardT > 0 && h.hp < 1) h.hp = 1; if (h.thorns) hit(S, m, h.atk * h.thorns, "dot", 1); }
      }
    }
    for (var ei = S.eshots.length - 1; ei >= 0; ei--) {
      var es = S.eshots[ei]; es.x += es.vx * dt; es.y += es.vy * dt; es.life -= dt;
      var ex = h.x - es.x, ey = h.y - es.y;
      if (ex * ex + ey * ey <= (es.r + 0.45) * (es.r + 0.45)) {
        if (h.iframes <= 0) { if (h.guard > 0) { h.guard--; h.iframes = 0.4; }
          else { var ed = absorb(S, es.dmg * taken * (1 - (h.domeDR || 0))); h.hp -= ed; S.taken += ed; S.shotTaken = (S.shotTaken || 0) + ed; h.iframes = 0.3; if (h.wardT > 0 && h.hp < 1) h.hp = 1; } }
        S.eshots.splice(ei, 1); continue;
      }
      if (es.life <= 0) S.eshots.splice(ei, 1);
    }
    if (h.iframes > 0) h.iframes -= dt;
    if (pas(S, "renewal")) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * pas(S, "renewal") * dt);
    // gems -> XP -> level-up
    var pick = 1.6 * (1 + pas(S, "magnet"));
    for (var gi = S.gems.length - 1; gi >= 0; gi--) {
      var gm = S.gems[gi], gx = h.x - gm.x, gy = h.y - gm.y, gd = Math.sqrt(gx * gx + gy * gy);
      if (gd <= pick) { h.xp += gm.v * (1 + pas(S, "growth")); if (gm.heal) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * gm.heal); S.gems.splice(gi, 1); }
      else if (gd <= pick * 2.2) { gm.x += gx / gd * 9 * dt; gm.y += gy / gd * 9 * dt; }
    }
    if (h.xp >= h.xpNext) { h.xp -= h.xpNext; h.level++; h.xpNext = Math.round(5 + h.level * 4 + h.level * h.level * 0.35); S.choice = offers(S); }
    // fx life
    for (var fi = S.fx.length - 1; fi >= 0; fi--) { S.fx[fi].t += dt; if (S.fx[fi].t >= S.fx[fi].life) S.fx.splice(fi, 1); }
    S.tick++; S.t += dt;                          // sim time only moves outside a pick (a paused tick is an input tick, not game time)
    if (h.hp <= 0) { h.hp = 0; S.ended = true; S.won = false; }
    if (S.mode === "survive") S.score = Math.floor(S.t) * 10 + S.kills;
    return S;
  }

  /* ---- replay: the same seed + the recorded inputs -> the same end state --------------------------------------------------------- */
  function replay(hero, opts, inputs, maxTicks) {
    var S = create(hero, opts), byTick = {};
    (inputs || []).forEach(function (e) { (byTick[e[0]] || (byTick[e[0]] = [])).push(e); });
    var cur = { mx: 0, my: 0 }, limit = maxTicks || Math.ceil((STORY_SECONDS + 600) / TICK);
    while (!S.ended && S.tick < limit) {
      var evs = byTick[S.tick], inp = { mx: cur.mx, my: cur.my };
      if (evs) evs.forEach(function (e) { if (e[1] === "m") { cur = { mx: e[2] / 100, my: e[3] / 100 }; inp.mx = cur.mx; inp.my = cur.my; } else if (e[1] === "u") inp.ult = true; else if (e[1] === "s") inp.skill = e[2]; else if (e[1] === "c") inp.pick = e[2]; });
      if (S.choice && inp.pick == null && !evs) break;                                              // a log that stops at an open pick ends there
      step(S, inp);
    }
    return S;
  }
  function digest(S) {
    var h = S.hero;
    return JSON.stringify({ t: r4(S.t), tick: S.tick, won: S.won, ended: S.ended, kills: S.kills, level: h.level, hp: Math.round(h.hp),
      dealt: Math.round(S.dealt), cds: h.kit.map(function (k) { return r4(k.cdLeft); }), x: r4(h.x), y: r4(h.y), auras: h.auras, passives: h.passives, mode: S.mode, stage: S.stage });
  }

  global.SurvivorsCore = {
    TICK: TICK, VIEW: VIEW, WAVES: WAVES, CAST: CAST, ROSTERS: ROSTERS, roster: roster, MAX_MONSTERS: MAX_MONSTERS, HARD_MAX: HARD_MAX, waveIndex: waveIndex, STORY_SECONDS: STORY_SECONDS, STAGES: STAGES, SLOTS: SLOTS, AURA_MAX: AURA_MAX, PASSIVE_MAX: PASSIVE_MAX,
    PASSIVES: PASSIVES, LADDER: LADDER, MONSTERS: MONSTERS, fxKind: fxKind,
    SKILL_KINDS: Object.keys(SKILL_KINDS), useSkill: useSkill,
    create: create, step: step, choose: choose, offers: offers, replay: replay, digest: digest, stageScale: stageScale,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.SurvivorsCore;
})(typeof window !== "undefined" ? window : globalThis);
