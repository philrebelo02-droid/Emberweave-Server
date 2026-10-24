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
  // landscape); Phil 24 Oct "Zoom out more the game is too zoomed in": 22 m high -> 30 m. Spawns land just outside it.
  var VIEW = { w: 64, h: 30 };
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
      monsters: [], nextId: 1, gems: [], shots: [], zones: [], fx: [],
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
    if (m.hp <= 0) kill(S, m);
  }
  function kill(S, m) {
    S.kills++;
    if (m.type === "boss") { S.won = true; S.ended = true; }
    if (m.type === "elite") S.gems.push({ x: m.x, y: m.y, v: 0, heal: 0.25 });   // an elite drops a heal orb (25% max HP), as Vampire Survivors' floor food
    if (MONSTERS[m.type].xp) {
      if (S.gems.length < 400) S.gems.push({ x: m.x, y: m.y, v: MONSTERS[m.type].xp });
      else { var gk = S.gems[S.tick % 400]; if (!gk.heal) gk.v += MONSTERS[m.type].xp; }                 // phone budget: past 400 gems, XP folds into an old one
    }
    var trig = S.hero._onKill; if (trig) trig(m);
  }

  /* ---- auras ------------------------------------------------------------------------------------------------------------------- */
  function auraRow(S, key) { for (var i = 0; i < S.aurasTable.length; i++) if (S.aurasTable[i].key === key) return S.aurasTable[i]; return null; }
  function runAura(S, key, lvl, dt) {
    var row = auraRow(S, key); if (!row) return;
    var L = LADDER[row.fam][clamp(lvl, 1, AURA_MAX) - 1], st = S._state[key] || (S._state[key] = { t: 0, a: 0, trail: [] });
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
          S.zones.push({ kind: "puddle", key: key, x: h.x, y: h.y, r: L.w * am, t: 0, life: L.life, tick: 0, dmg: heroDmg(S, L.dmg), fk: L.fx ? fk : "none", fp: L.fx || 1 });
          if (L.split) S.zones.push({ kind: "puddle", key: key, x: h.x - h.diry * 1.2, y: h.y + h.dirx * 1.2, r: L.w * am, t: 0, life: L.life, tick: 0, dmg: heroDmg(S, L.dmg), fk: L.fx ? fk : "none", fp: L.fx || 1 });
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
    for (var i = 0; i < keys.length; i++) runAura(S, keys[i], h.auras[keys[i]], dt);
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
      if (zn.kind === "ring") { var rr = zn.r0 + (zn.r1 - zn.r0) * Math.min(1, zn.t / zn.life); near(S, zn.x, zn.y, rr, function (m) { if (!zn.hit[m.id]) { zn.hit[m.id] = 1; hit(S, m, zn.dmg, zn.fk, zn.fp); } }); }
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
      if (m.stunT > 0) { m.stunT -= dt; continue; }
      if (m.life != null) { m.life -= dt; if (m.life <= 0) { S.monsters.splice(mi, 1); continue; } }   // an event member leaves
      var dx = h.x - m.x, dy = h.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp3 = m.spd * (m.slowT > 0 ? 0.5 : 1);
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
        else { var dmg = m.dmg * taken; h.hp -= dmg; S.taken += dmg; h.iframes = 0.5; if (h.wardT > 0 && h.hp < 1) h.hp = 1; if (h.thorns) hit(S, m, h.atk * h.thorns, "dot", 1); }
      }
    }
    for (var ei = S.eshots.length - 1; ei >= 0; ei--) {
      var es = S.eshots[ei]; es.x += es.vx * dt; es.y += es.vy * dt; es.life -= dt;
      var ex = h.x - es.x, ey = h.y - es.y;
      if (ex * ex + ey * ey <= (es.r + 0.45) * (es.r + 0.45)) {
        if (h.iframes <= 0) { if (h.guard > 0) { h.guard--; h.iframes = 0.4; }
          else { var ed = es.dmg * taken; h.hp -= ed; S.taken += ed; S.shotTaken = (S.shotTaken || 0) + ed; h.iframes = 0.3; if (h.wardT > 0 && h.hp < 1) h.hp = 1; } }
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
