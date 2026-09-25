/* THE STARLESS WELL v2 - Magic Rush's Fractalia, inside the black hole (blueprint 22). Claude, 25 Sep 2026.
   Phil: "I want the well to be almost like fractalia" / "You clear one map, then at the end there is portals/ hard and normal · hard and
   normal has 2 maps to push each" / "you choose 1 lane to choose the difficulty" / "energy levels is kept each fight, used for ultimates
   the same as other modes" / "tent heroes are loaned maxed for your level" / "resurrect is free for the first res, 50 diamonds per res
   after that" / "If you clear it once you can sweep after that for minimum rewards, or you can not sweep and possible get different
   rewards (10-15% more diamonds, gold, or exp pots)".

   A RUN (one per 72 h cycle): Map 1 Standard -> portal Normal | Hard (the pick is the difficulty) -> 2 maps on that path.
   A MAP: 7 columns x 3 rows of squares. Column 0 = where you stand; you step to a square in the NEXT column whose row is within 1 of yours;
   the rest of that column is gone (Magic Rush's rule). Column 6 = the boss (map 1: the Gatekeeper); when it falls the portals APPEAR (map 1: blue Normal + purple Hard; map 2: one). Every column keeps its middle square,
   so a path always exists. Generated from a server seed per player per cycle - fixed until the reset.
   SQUARES: fight | chest | tent (a LOANED hero, maxed for your level, joins the run) | spring (surviving heroes +50% HP) | boss.
   FIGHTS: real battles (Training Province flow: frozen snapshots + seed, transcript replayed on the server). Each is ONE wave of 5 enemy
   heroes (server/starless-well-heroes.json: k per mode per level band 61/65/72/75/79/86/93/100 x ramp per fight). Each hero's HP and energy CARRY: read
   from the server's own replay after every fight; the next fight starts from them. Dead heroes stay dead until resurrected.
   BUFFS: after each fight won, pick 1 of 3; run-only. RESURRECT: first free, then 50 diamonds. REWARDS: each fight's shown prize; the run's
   end pays 2% (Normal) / 4% (Hard) of the XP the current level needs. SWEEP: once a path has been cleared, a later cycle can be swept for
   the minimum (end XP only); a played run on a cleared path rolls +10-15% on one prize kind (diamonds, gold or XP potions). */
'use strict';
const WELL_EPOCH = Date.UTC(2026, 8, 25, 6, 0, 0), CYCLE_MS = 72 * 3600 * 1000;
const COLS = 7, ROWS = 3, RES_COST = 50;
const OPEN = { normal: 61, hard: 75 }, PCT = { normal: 0.02, hard: 0.04 };
const SESSION_MS = 24 * 3600 * 1000, MIN_BATTLE_MS = +(process.env.WELL_MIN_BATTLE_MS || 8000), STRICT = process.env.WELL_STRICT_REPLAY === '1';
let TABLE = null; try { TABLE = require('./starless-well-heroes.json'); } catch (e) { console.error('starless-well-heroes.json missing - The Starless Well is OFF (' + e.message + ')'); }
let HERO_BASE = {}; try { HERO_BASE = require('./sim.js').HERO_BASE; } catch (e) {}

/* ---- buffs: 1 of 3 after every win (Magic Rush's sizes; class = the hero's role family) ---- */
const CLASS_OF = { Tank: 'Tank', Bruiser: 'Tank', Brute: 'Tank', Warrior: 'Warrior', Assassin: 'Warrior', Marksman: 'Marksman', Mage: 'Mage', Support: 'Support' };
const BUFFS = [];
for (const c of ['Tank', 'Warrior', 'Marksman', 'Mage', 'Support']) {
  BUFFS.push({ id: c + ':hp', cls: c, hp: 0.06, label: c + ' heroes +6% HP' });
  BUFFS.push({ id: c + ':atk', cls: c, atk: 0.05, label: c + ' heroes +5% attack' });
  BUFFS.push({ id: c + ':def', cls: c, def: 0.08, label: c + ' heroes +8% armor and magic resist' });
}
BUFFS.push({ id: 'All:hp', cls: 'All', hp: 0.03, label: 'All heroes +3% HP' }, { id: 'All:atk', cls: 'All', atk: 0.025, label: 'All heroes +2.5% attack' },
  { id: 'All:def', cls: 'All', def: 0.04, label: 'All heroes +4% armor and magic resist' });
const BUFF = Object.fromEntries(BUFFS.map(b => [b.id, b]));

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function cycleOf(t) { return Math.max(0, Math.floor(((t || Date.now()) - WELL_EPOCH) / CYCLE_MS)); }
function cycleEnds(c) { return WELL_EPOCH + (c + 1) * CYCLE_MS; }
function band(level) { const A = TABLE.anchors; let i = 0; for (let k = 0; k < A.length; k++) if (level >= A[k]) i = k; return i; }

/* Phil 25 Sep ~16:00: "Well fights should be 1 fight not waves" / "And it should be 5 heroes against 5 heroes".
   A Well fight = ONE wave of 5 enemy HEROES (Magic Rush Fractalia's defenders): a front-liner, a bruiser, a marksman/assassin, a mage
   and a support, picked by the map seed (fixed for the cycle, shown on the square). They fight at the band start level, quality
   tier 3, stats x d where d = k[mode][band] x ramp[mode][idx] (the table: server/starless-well-heroes.json, whole-run tuned). */
const FOE_SLOTS = [['Tank'], ['Bruiser'], ['Marksman', 'Assassin'], ['Mage'], ['Support']];
function foesFor(r) { const out = [];
  for (const roles of FOE_SLOTS) { const pool = Object.keys(HERO_BASE).filter(k => roles.indexOf(HERO_BASE[k].role) >= 0 && out.indexOf(k) < 0).sort();
    if (pool.length) out.push(pool[Math.floor(r() * pool.length)]); }
  return out; }
function fightWaves(mode, idx, level, foes) {
  if (!TABLE || !TABLE.k[mode] || !Array.isArray(foes) || !foes.length) return null;
  const bi = band(level), L = TABLE.anchors[bi], i = Math.max(0, Math.min(TABLE.ramp[mode].length - 1, idx));
  const d = TABLE.k[mode][bi] * TABLE.ramp[mode][i], dd = Math.pow(d, 0.7);
  return [foes.map(key => ({ key, lvl: L, hpMul: +d.toFixed(4), dmgMul: +dd.toFixed(4), isHero: true, rank: TABLE.rank }))];
}
/* which pool fight a square uses: map 1 = normal 0..4 (by column), Normal path maps 2/3 = normal 5..9 / 10..14 (boss = the last),
   Hard path maps 2/3 = hard 0..5 + boss 6 / 7..11 + boss 14 (a boss index is never reused by a column) */
function poolFor(map, path, col) {
  if (map === 1) return { mode: 'normal', idx: col >= 6 ? 4 : Math.min(3, col - 1) };   // col 6 = the Gatekeeper
  if (path === 'normal') return { mode: 'normal', idx: map === 2 ? (col >= 6 ? 9 : 4 + Math.min(4, col)) : (col >= 6 ? 14 : 9 + Math.min(4, col)) };   // map 2: 5-8 + boss 9; map 3: 10-13 + boss 14
  return { mode: 'hard', idx: map === 2 ? (col >= 6 ? 6 : Math.min(5, col - 1)) : (col >= 6 ? 14 : 6 + col) };   // Hard: 0-5 + boss 6; 7-11 + boss 14
}

/* ---- the map ---- */
function genMap(seed, map, path, heroKeys) {
  const r = rng(seed), grid = [];
  for (let c = 0; c < COLS; c++) {
    const col = [null, null, null];
    if (c === 0) { col[1] = { type: 'start' }; grid.push(col); continue; }
    if (c === COLS - 1) {
      col[1] = { type: 'boss' };   // Phil 25 Sep: portals are not squares - they APPEAR when the map's last square falls (POST /api/well/portal)
      grid.push(col); continue;
    }
    const rows = [1]; for (const x of [0, 2]) if (r() < 0.75) rows.push(x);   // the middle always exists -> always a path
    for (const row of rows) {
      const fightCol = (c % 2 === 1);                                             // columns 1, 3, 5: fights on every square
      const roll = r();
      col[row] = fightCol || roll < 0.40 ? { type: 'fight' }
        : roll < 0.62 ? { type: 'chest', big: r() < 0.25 }
        : roll < 0.82 ? { type: 'tent', hero: heroKeys[Math.floor(r() * heroKeys.length)] }
        : { type: 'spring' };
    }
    grid.push(col);
  }
  for (let c = 1; c < COLS; c++) for (let row = 0; row < ROWS; row++) { const s = grid[c][row];
    if (s && (s.type === 'fight' || s.type === 'boss')) { const p = poolFor(map, path, c); s.mode = p.mode; s.idx = p.idx; s.foes = foesFor(r); } }
  return grid;
}

/* ---- state ---- */
function fresh(cyc) { return { cycle: cyc, level: 0, map: 1, path: null, pos: { col: 0, row: 1 }, heroes: {}, loans: [], buffs: [], offer: null,
  resUsed: 0, done: false, att: null, prizes: [], started: false }; }
function well(led) { const c = cycleOf(); const W = led.well2 = led.well2 || {};
  if (!W.run || W.run.cycle !== c) W.run = fresh(c);
  W.cleared = W.cleared || {}; return W; }
function mapOf(ctx, W) { const R = W.run;
  return genMap(ctx.srvSeed('well2map', ctx.me.id, R.cycle, R.map, R.path || '-'), R.map, R.path, ctx.loanPool()); }

/* prizes (what a fight shows before you fight it; paid on the win) */
function prizeFor(ctx, W, sq, col) { const R = W.run, lvl = R.level || ctx.playerLevel();
  const hard = sq.mode === 'hard', boss = sq.type === 'boss';
  const gold = Math.round((600 + lvl * 90) * (hard ? 1.5 : 1) * (boss ? 2 : 1));
  const gems = boss ? (hard ? 30 : 15) : (col === 5 ? 5 : 0);
  return { gold, gems, potions: boss ? 2 : (col >= 3 ? 1 : 0) }; }
function payPrize(ctx, W, pr, tag) { const led = ctx.led, out = Object.assign({}, pr);
  const bonus = W.cleared[W.run.path || 'normal'] && W.run.path ? ['gems', 'gold', 'potions'][Math.floor(rng(ctx.srvSeed('well2bonus', ctx.me.id, tag))() * 3)] : null;
  if (bonus && out[bonus] > 0) { const pct = 0.10 + rng(ctx.srvSeed('well2pct', ctx.me.id, tag))() * 0.05; out[bonus] = Math.round(out[bonus] * (1 + pct) + (bonus === 'potions' ? 0.5 : 0)); out.bonus = bonus; }
  led.gold = Math.min(2000000000, (led.gold | 0) + (out.gold | 0));
  if (out.gems) led.gems = Math.min(2000000, (led.gems | 0) + out.gems);
  if (out.potions) { led.xpPotions = led.xpPotions || {}; led.xpPotions.superior = Math.min(999999, (led.xpPotions.superior | 0) + out.potions); }
  ctx.ledTx(ctx.me, 'well2:prize:' + tag, { gold: out.gold, gems: out.gems || 0, xpPotions: out.potions || 0 });
  W.run.prizes.push(out); return out; }
function endXP(ctx, mode) { const L = ctx.playerLevel(); if (L >= 100) return 0; return Math.round(PCT[mode] * (ctx.D_TROOP_INC[L - 1] || 0)); }

/* ---- the squad: own heroes + loans, with carried HP/energy and the run's buffs ---- */
function loanSpec(ctx, key) {   // "tent heroes are loaned maxed for your level": your level, 5 stars, your best hero's board/gear totals, full skills
  const lvl = ctx.playerLevel(); let best = null;
  for (const k of Object.keys(ctx.led.unlocked || {})) { const s = ctx.campaignHeroSpec(ctx.me, k); if (s && (!best || (s.tt.hp + s.tt.atk * 6) > (best.tt.hp + best.tt.atk * 6))) best = s; }
  const base = ctx.SIM.HERO_BASE[key]; if (!base || !best) return null;
  return Object.assign({}, best, { key, level: lvl, stars: 5, pips: 0, skillLv: [lvl, lvl, lvl, lvl], gearSkill: null }); }
function applyRun(ctx, R, snaps) {
  for (const s of snaps) { const cls = CLASS_OF[(ctx.SIM.HERO_BASE[s.key] || {}).role] || 'Warrior';
    let hp = 0, atk = 0, def = 0;
    for (const id of R.buffs) { const b = BUFF[id]; if (b && (b.cls === 'All' || b.cls === cls)) { hp += b.hp || 0; atk += b.atk || 0; def += b.def || 0; } }
    if (hp) s.maxHp = Math.round(s.maxHp * (1 + hp));
    if (atk) { s.dmg = Math.round(s.dmg * (1 + atk)); if (s.atk) s.atk = Math.round(s.atk * (1 + atk)); if (s.atkP) s.atkP = Math.round(s.atkP * (1 + atk)); if (s.atkM) s.atkM = Math.round(s.atkM * (1 + atk)); }
    if (def) { s.armorRating = Math.round((s.armorRating || 0) * (1 + def)); s.mrRating = Math.round((s.mrRating || 0) * (1 + def)); }
    const h = R.heroes[s.key]; if (h) { s.hp = Math.max(1, Math.round(s.maxHp * h.hpFrac)); s.energy = h.energy | 0; } }
  return snaps; }

/* ---- the view the client draws ---- */
function view(ctx, W) { const R = W.run, lvl = ctx.playerLevel(), dev = ctx.isDev(ctx.me), grid = mapOf(ctx, W);
  const g = grid.map((col, c) => col.map(s => s && Object.assign({}, s, (s.type === 'fight' || s.type === 'boss') ? { prize: prizeFor(ctx, W, s, c) } : {})));
  return { ok: true, cycle: R.cycle, endsAt: cycleEnds(R.cycle), playerLevel: lvl, open: dev || lvl >= OPEN.normal, hardOpen: dev || lvl >= OPEN.hard,
    opensAt: OPEN, map: R.map, path: R.path, pos: R.pos, grid: g, heroes: R.heroes, loans: R.loans, buffs: R.buffs.map(id => BUFF[id]).filter(Boolean),
    offer: R.offer ? R.offer.map(id => BUFF[id]) : null, portals: portalsOf(R), resUsed: R.resUsed, resCost: R.resUsed ? RES_COST : 0, done: R.done,
    canSweep: !R.started && !R.done && Object.keys(W.cleared).length > 0, cleared: W.cleared, endXP: { normal: endXP(ctx, 'normal'), hard: endXP(ctx, 'hard') },
    prizes: R.prizes }; }

function reach(R, col, row) { return col === R.pos.col + 1 && Math.abs(row - R.pos.row) <= 1; }
/* the portals open once the map's boss (col 6) has fallen: map 1 offers both paths, map 2 the one you took */
function portalsOf(R) { if (R.done || R.pos.col !== COLS - 1) return null; return R.map === 1 ? ['normal', 'hard'] : R.map === 2 ? [R.path] : null; }

async function handle(p, method, ctx) {
  if (p.indexOf('/api/well/') !== 0) return null;
  if (!TABLE) return { status: 503, body: { ok: false, error: 'The Starless Well is unavailable.' } };
  const W = well(ctx.led), R = W.run, lvl = ctx.playerLevel(), dev = ctx.isDev(ctx.me);
  const ok = () => ({ status: 200, body: view(ctx, W) }), no = (e, s) => ({ status: s || 400, body: { ok: false, error: e } });
  if (p === '/api/well/state' && method === 'GET') { ctx.writeDB(); return ok(); }
  if (method !== 'POST') return no('well', 404);
  if (!dev && lvl < OPEN.normal) return no('The Starless Well opens at account level ' + OPEN.normal + ' (you are ' + lvl + ').');
  const b = await ctx.body(); const reqId = String(b.requestId || '').slice(0, 48); if (!reqId) return no('requestId required');
  return ctx.idem(ctx.me.id + ':well2:' + p + ':' + reqId, () => {
    if (R.done && p !== '/api/well/state') return no('This run is complete - the Well resets in ' + Math.ceil((cycleEnds(R.cycle) - Date.now()) / 3600000) + ' h.');
    const grid = mapOf(ctx, W);
    if (!R.level) R.level = lvl;
    /* STEP to a non-fight square (fights go through start/resolve) */
    if (p === '/api/well/move') {
      if (R.offer) return no('Pick your buff first.');
      const col = b.col | 0, row = b.row | 0, sq = grid[col] && grid[col][row];
      if (!sq || !reach(R, col, row)) return no('You can only step to a square next to you in the next column.');
      if (sq.type === 'fight' || sq.type === 'boss') return no('That square is guarded - fight it.');
      R.started = true; R.pos = { col, row };
      let got = null;
      if (sq.type === 'chest') { const pr = { gold: Math.round((400 + R.level * 60) * (sq.big ? 2 : 1)), gems: sq.big ? 10 : 0, potions: sq.big ? 2 : 1 }; got = payPrize(ctx, W, pr, R.cycle + ':' + R.map + ':' + col + ':' + row); }
      else if (sq.type === 'tent') { if (sq.hero && R.loans.indexOf(sq.hero) < 0 && !ctx.led.unlocked[sq.hero]) R.loans.push(sq.hero); got = { loan: sq.hero }; }
      else if (sq.type === 'spring') { for (const k of Object.keys(R.heroes)) { const h = R.heroes[k]; if (!h.dead) h.hpFrac = Math.min(1, h.hpFrac + 0.5); } got = { healed: 0.5 }; }
      ctx.ledTx(ctx.me, 'well2:move:' + sq.type, {}); ctx.writeDB();
      return { status: 200, body: Object.assign(view(ctx, W), { got }) };
    }
    if (p === '/api/well/portal') {
      const P = portalsOf(R), to = String(b.to || '');
      if (!P) return no('No portal is open - clear this map first.');
      if (R.offer) return no('Pick your buff first.');
      if (P.indexOf(to) < 0) return no('That portal is not open.');
      if (to === 'hard' && !dev && lvl < OPEN.hard) return no('The Hard path opens at account level ' + OPEN.hard + '.');
      if (R.map === 1) R.path = to;
      R.map++; R.pos = { col: 0, row: 1 };
      ctx.ledTx(ctx.me, 'well2:portal:' + R.path + ':' + R.map, {}); ctx.writeDB();
      return { status: 200, body: Object.assign(view(ctx, W), { got: { path: R.path, map: R.map } }) };
    }
    if (p === '/api/well/buff') {
      if (!R.offer || R.offer.indexOf(String(b.id)) < 0) return no('That buff is not on offer.');
      R.buffs.push(String(b.id)); R.offer = null; ctx.writeDB(); return ok();
    }
    if (p === '/api/well/resurrect') {
      const k = String(b.hero || ''), h = R.heroes[k]; if (!h || !h.dead) return no('That hero is not fallen.');
      const cost = R.resUsed ? RES_COST : 0; if ((ctx.led.gems | 0) < cost) return no('Not enough diamonds (' + cost + ').');
      if (cost) ctx.led.gems -= cost; R.resUsed++; h.dead = false; h.hpFrac = 1; h.energy = 0;
      ctx.ledTx(ctx.me, 'well2:resurrect', { gems: -cost }); ctx.writeDB(); return ok();
    }
    if (p === '/api/well/sweep') {
      const path = String(b.path || ''); if (!W.cleared[path]) return no('Clear the ' + path + ' path once before sweeping it.');
      if (R.started) return no('This run has already started - finish it instead.');
      if (path === 'hard' && !dev && lvl < OPEN.hard) return no('The Hard path opens at account level ' + OPEN.hard + '.');
      const xp = endXP(ctx, path); if (xp > 0) ctx.ledAddPlayerXP(ctx.led, xp);
      R.done = true; R.path = path; ctx.ledTx(ctx.me, 'well2:sweep:' + path, { px: xp }); ctx.writeDB();
      return { status: 200, body: Object.assign(view(ctx, W), { reward: { xp, swept: true } }) };
    }
    if (p === '/api/well/start') {
      if (R.offer) return no('Pick your buff first.');
      const col = b.col | 0, row = b.row | 0, sq = grid[col] && grid[col][row];
      if (!sq || !reach(R, col, row) || (sq.type !== 'fight' && sq.type !== 'boss')) return no('Pick a guarded square next to you.');
      const ids = Array.isArray(b.heroIds) ? [...new Set(b.heroIds.map(String))].slice(0, 5) : [];
      if (!ids.length) return no('Pick your squad (no duplicates).');
      for (const k of ids) { if (!ctx.SIM.HERO_BASE[k] || !(ctx.led.unlocked[k] || R.loans.indexOf(k) >= 0)) return no('You do not have ' + k + ' in this run.');
        if (R.heroes[k] && R.heroes[k].dead) return no(k + ' has fallen - resurrect them first.'); }
      const specs = ids.map(k => ctx.led.unlocked[k] ? ctx.campaignHeroSpec(ctx.me, k) : loanSpec(ctx, k));
      if (specs.some(x => !x)) return no('Unknown hero.');
      const host = ctx.simHost(); let snaps = null;
      if (host) { try { snaps = applyRun(ctx, R, host.snapFromSpecs(specs)); } catch (e) { console.error('sim-host snapFromSpecs failed (well2):', e.message); } }
      const waves = fightWaves(sq.mode, sq.idx, R.level, sq.foes), seed = (ctx.crypto.randomBytes(4).readUInt32BE(0)) >>> 0;
      R.att = { id: ctx.uid(), col, row, heroIds: ids, snaps, seed, waves, engine: (host && host.buildVersion) || null, startedAt: Date.now(), reqId };
      R.started = true; ctx.writeDB();
      return { status: 200, body: { ok: true, attemptId: R.att.id, seed, snaps, waves, engine: R.att.engine, square: sq, prize: prizeFor(ctx, W, sq, col) } };
    }
    if (p === '/api/well/resolve') {
      const a = R.att; if (!a || a.id !== String(b.attemptId || '')) return no('No matching Well battle (the Well may have reset).');
      R.att = null;
      if (Date.now() - a.startedAt > SESSION_MS) { ctx.writeDB(); return no('That battle expired - nothing was spent.'); }
      const clientEnd = (typeof b.digest === 'string') ? b.digest : ''; let witnessed = null;
      try { const d = JSON.parse(clientEnd), cs = Number(b.stars);
        if (d && typeof d.won === 'boolean' && d.won === b.won && Number.isFinite(d.t) && Array.isArray(d.u) && d.u.length >= a.heroIds.length
          && ((d.won && Number.isInteger(cs) && cs >= 1 && cs <= 3) || (!d.won && cs === 0))) witnessed = { won: d.won, stars: cs };
      } catch (e) {}
      if (!witnessed) { ctx.writeDB(); return no('Battle result was incomplete - nothing was spent.'); }
      const inputLog = ctx.sanitizeInputLog(b.inputLog), host = ctx.simHost(); let rep = null;
      try { if (host && a.snaps && a.snaps.length) rep = host.campaign(a.snaps, a.waves, a.seed >>> 0, inputLog); } catch (e) { console.error('sim-host replay failed (well2):', e.message); }
      const srv = rep ? String(rep.digest || '') : '', match = !!srv && ctx.sha256hex(clientEnd) === ctx.sha256hex(srv), led = ctx.led;
      /* the game's rule (Province, Campaign): what the player watched is the result; a replay difference is an incident, and
         WELL_STRICT_REPLAY=1 refuses an unconfirmed win */
      if (!match) { led.battleIncidents = (led.battleIncidents || []).concat([{ t: Date.now(), stage: 'well-' + R.map + '-' + a.col, mode: 'well:' + (R.path || 'standard'),
          why: rep ? 'digest-mismatch' : 'replay-unavailable', source: 'submitted-log', playerTruth: !STRICT, engine: a.engine, seed: a.seed >>> 0, inputs: inputLog.length,
          server: srv ? ctx.sha256hex(srv) : null, client: ctx.sha256hex(clientEnd), serverWon: rep ? !!rep.won : null, witnessedWon: witnessed.won,
          witnessedStars: witnessed.stars, transcript: inputLog }]).slice(-20); console.warn('well replay incident - map ' + R.map + ' col ' + a.col); }
      if (witnessed.won && STRICT && !(rep && rep.won)) { ctx.writeDB(); return no('The server could not confirm this win - nothing was spent. Fight it again.'); }
      if (witnessed.won && Date.now() - a.startedAt < MIN_BATTLE_MS) { ctx.writeDB(); return no('That was too fast to be a real battle - nothing was spent.'); }
      led.battleReceipts = (led.battleReceipts || []).concat([{ t: Date.now(), stage: 'well-' + R.map + '-' + a.col, mode: 'well:' + (R.path || 'standard'), node: a.col,
        seed: a.seed >>> 0, engine: a.engine, source: 'submitted-log', heroes: a.heroIds.slice(), inputs: inputLog.length, won: witnessed.won, stars: witnessed.stars,
        digest: srv ? ctx.sha256hex(srv) : null, transcript: inputLog, clientDigest: ctx.sha256hex(clientEnd), match }]).slice(-40);
      /* HP and energy carry: from the server's replay when it saw the same result the player did, else from what the player watched */
      let endU = []; try { endU = JSON.parse(rep && !!rep.won === witnessed.won ? srv : clientEnd).u || []; } catch (e) {}
      const maxOf = Object.fromEntries((a.snaps || []).map(s => [s.key, s.maxHp || 1]));
      for (const k of a.heroIds) { const e = endU.find(x => x[0] === k && x[1] === 'ally'); if (!e) continue;
        R.heroes[k] = { hpFrac: e[2] ? Math.max(0.01, Math.min(1, e[3] / (maxOf[k] || 1))) : 0, energy: e[4] | 0, dead: !e[2] }; }
      let reward = null, sq = grid[a.col] && grid[a.col][a.row];
      if (witnessed.won && sq) {
        R.pos = { col: a.col, row: a.row };
        reward = payPrize(ctx, W, prizeFor(ctx, W, sq, a.col), R.cycle + ':' + R.map + ':' + a.col + ':' + a.row);
        const r = rng(ctx.srvSeed('well2buff', ctx.me.id, R.cycle, R.map, a.col, a.row)), pool = BUFFS.map(x => x.id), pick = [];
        while (pick.length < 3) { const id = pool[Math.floor(r() * pool.length)]; if (pick.indexOf(id) < 0) pick.push(id); }
        R.offer = pick;
        if (sq.type === 'boss') { if (R.map === 3) { R.done = true; W.cleared[R.path] = (W.cleared[R.path] | 0) + 1; const xp = endXP(ctx, R.path);
            if (xp > 0) ctx.ledAddPlayerXP(ctx.led, xp); reward.endXP = xp; ctx.ledTx(ctx.me, 'well2:complete:' + R.path, { px: xp }); R.offer = null; }
        }
      }
      ctx.ledTx(ctx.me, 'well2:' + (witnessed.won ? 'win' : 'loss'), { match });
      ctx.writeDB();
      return { status: 200, body: Object.assign(view(ctx, W), { won: witnessed.won, stars: witnessed.stars, reward, digestMatch: match, serverWon: rep ? !!rep.won : null }) };
    }
    return no('well', 404);
  });
}

module.exports = { handle, genMap, poolFor, fightWaves, foesFor, rng, BUFFS, cycleOf, OPEN, PCT, RES_COST };
