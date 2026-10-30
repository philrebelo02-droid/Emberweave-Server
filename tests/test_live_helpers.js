'use strict';
// v1129 LIVE BATTLES ON THE LIVE HELPERS (Phil: World Tree is "the server's largest pvp event"; World Tree and Skyfall are "fast
// machines" work). Until v1129 a World Tree site fight (the full engine, ~150-200 ms) and a Skyfall assault (the line resolver) ran on
// the game server's MAIN thread inside their planners. Real servers, a real local helper (server/sim-helper.js), and a probe preloaded
// into the server (tests/helpers/live-probe.cjs) that counts fights run on the main thread and samples the event loop:
//  1. Skyfall: 10 players in two guilds assault all five lanes at once until the lanes are spent - every fight on the helper,
//     0 on the main thread;
//  2. no helper: the only helper is down -> the assault answers 503 busy + retryAfterMs and changes nothing; the same requestId goes
//     through once the helper is back. No battle pool at all (SIM_WORKERS=0) -> busy too;
//  3. World Tree peak: 50 garrison lines on the five sites, five attackers arrive together while every player polls the control
//     view - every site fight on the helper, 0 on the main thread; main-thread time, worst stall and /health latency vs the control;
//  4. a peak of N simultaneous live battles at the pool (real helper, 2 slots): every one drains, the queue never passes its bound,
//     the oldest goes first, a battle past the bound or the wait is refused busy, none lands on the server's own workers;
//  5. byte-identical: every result the helper returned in 1 and 3 equals the main-thread function's on the same inputs (this tree,
//     and 6bfeb24d's code - its World Tree result differs only in the engine build id); the worker path too.
// CONTROL 6bfeb24d (World Tree switched on in the control copy, as this test does here): its World Tree and Skyfall fights run on the
// main thread (1, 3 fail), a dead helper does not stop a Skyfall fight (2 fails), its pool has no live path and puts live battles
// on the server's own workers (4 fails).
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const R = require('./helpers/split-rig.cjs');
const CONTROL = '6bfeb24d', KEY = 'live-helpers-key-' + 'l'.repeat(16), PROBE = path.join(__dirname, 'helpers', 'live-probe.cjs');
const SIM_KEYS = Object.keys(require('../server/sim.js').HERO_BASE), HEROES = SIM_KEYS.slice(0, 15), SITES = ['tree', 'oasis-nw', 'oasis-ne', 'oasis-sw', 'oasis-se'];
const sleep = R.sleep, pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };

async function helper(dir, workers) {
  const port = await R.freePort(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-live-helper-')), cfg = path.join(tmp, 'cfg.json');
  fs.writeFileSync(cfg, JSON.stringify({ key: KEY, port, host: '127.0.0.1', workers, majorWorkers: workers, busyCpu: 5, majorBusyCpu: 5 }));
  const url = 'http://127.0.0.1:' + port; let child = null;
  const start = async () => { child = spawn(process.execPath, [path.join(dir, 'server/sim-helper.js')], { cwd: dir, env: { ...process.env, SIM_HELPER_CONFIG: cfg }, stdio: 'ignore', windowsHide: true });
    for (let i = 0; i < 200; i++) { try { const j = await (await fetch(url + '/health')).json(); if (j.ready > 0) return; } catch (e) {} await sleep(150); }
    throw Error('helper did not start'); };
  await start();
  return { url, start, stats: async () => (await fetch(url + '/health')).json(), close: async () => { if (child) { const c = child; child = null; c.kill(); await Promise.race([new Promise(r => c.once('exit', r)), sleep(3000)]); } } };
}
const probeOf = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'status.json'), 'utf8')); } catch (e) { return null; } };
const liveLog = dir => { const f = path.join(dir, 'live.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []; };
async function waitHelperOk(S, A) { for (let i = 0; i < 80; i++) { const st = (await S.req('GET', '/api/dev/save-stats', null, A)).body; const h = st.battles && st.battles.pool && st.battles.pool.helper;
  if (h && h.helpers.length && h.helpers.every(x => x.ok)) return st; await sleep(250); } throw Error('server never saw its helper ready'); }

// one server + probe on `dir` (this tree or the control copy); env adds the helper / pool settings
async function liveServer(dir, tag, n, env) {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-live-probe-'));
  const S = await R.server({ dir, nodeArgs: ['-r', PROBE], env: { LIVE_PROBE_DIR: probe, WORLD_TREE_CONTROL_TEST: '1', DB_STORE_SWEEP_MS: '600000', ...env } });
  let B; try { B = await R.boot(S, tag, n, { heroes: HEROES }); } catch (e) { await S.kill(); throw e; }
  return { S, B, probe };
}
// two guilds: players[0..half) and [half..n); leaders are the first of each half
async function guilds(S, B) {
  const half = B.players.length / 2, out = [];
  for (const [lo, name] of [[0, 'Live Alpha'], [half, 'Live Beta']]) {
    const lead = B.players[lo], g = await S.req('POST', '/api/guild/create', { name }, lead.token, lead.ip);
    assert.ok(g.body.guild && g.body.guild.id, JSON.stringify(g.body).slice(0, 200)); const gid = g.body.guild.id;
    for (let i = lo + 1; i < lo + half; i++) { const p = B.players[i];
      const rq = await S.req('POST', '/api/guild/request', { guildId: gid }, p.token, p.ip); assert.equal(rq.body.ok, true, JSON.stringify(rq.body));
      const ap = await S.req('POST', '/api/guild/approve', { id: p.id }, lead.token, lead.ip); assert.ok(ap.body.guild, JSON.stringify(ap.body).slice(0, 200)); }
    out.push({ gid, members: B.players.slice(lo, lo + half) });
  }
  return out;
}

// ---- 1 + 2: Skyfall ----
async function skyfall(dir, label, tag) {
  const hp = await helper(dir, 2);
  const env = { SIM_WORKERS: '1', SIM_HELPERS: hp.url + '|1|live', SIM_HELPER_KEY: KEY, SERVER_ID: '1', SIM_LIVE_WAIT_MS: '3000' };
  const { S, B, probe } = await liveServer(dir, 'sk' + tag, 10, env);
  try {
    const G = await guilds(S, B), A = B.A, warp = at => S.req('POST', '/api/guild-war/debug-warp', { offsetMs: at - Date.now() }, A);
    const st0 = (await S.req('GET', '/api/guild-war/status', null, B.players[0].token, B.players[0].ip)).body; assert.equal(st0.enabled, true, JSON.stringify(st0).slice(0, 200));
    const t = st0.tournament; let opening = t.registrationOpensAt; if (Date.now() >= t.registrationLocksAt) opening = t.nextRegistrationOpensAt || opening + 14 * 86400000;
    assert.equal((await warp(Math.max(Date.now(), opening + 60000))).body.state, 'registration');
    const locksAt = (await S.req('GET', '/api/guild-war/status', null, B.players[0].token, B.players[0].ip)).body.tournament.registrationLocksAt;
    for (const g of G) { const reg = await S.req('POST', '/api/guild-war/register', {}, g.members[0].token, g.members[0].ip); assert.equal(reg.body.ok, true, JSON.stringify(reg.body).slice(0, 200));
      for (const [i, p] of g.members.entries()) { const pl = await S.req('POST', '/api/guild-war/place', { lane: i % 5 }, p.token, p.ip); assert.equal(pl.body.ok, true, JSON.stringify(pl.body).slice(0, 200)); } }
    assert.equal((await warp(locksAt + 60000)).body.state, 'bracket');
    const round = (await S.req('GET', '/api/guild-war/status', null, B.players[0].token, B.players[0].ip)).body.tournament.bracket[0];
    await warp(round.schedule.lockAt + 60000);
    const live = (await S.req('GET', '/api/guild-war/match', null, B.players[0].token, B.players[0].ip)).body; assert.equal(live.match && live.match.state, 'live', JSON.stringify(live).slice(0, 200));
    await waitHelperOk(S, A);
    const out = {};
    // 2. no helper: kill it, the next assault answers busy and changes nothing; the same requestId goes through once it is back
    let probeLane = -1, probeP = null;
    await hp.close(); await sleep(300);
    // find a player whose lane still has a fight left: try each; a 400 is "nothing to fight", a 503 is what we look for
    const before = (await S.req('GET', '/api/guild-war/match', null, B.players[0].token, B.players[0].ip)).body.match || {};
    let busyAns = null, busyId = null, busyMs = 0;
    for (const [i, p] of B.players.entries()) { const id = 'skdown-' + p.id, tb = Date.now(); const r = await S.req('POST', '/api/guild-war/assault', { fromLane: i % 5, requestId: id }, p.token, p.ip);
      if (r.status === 503 || (r.status === 200 && r.body.result)) { busyAns = r; busyId = id; probeP = p; probeLane = i % 5; busyMs = Date.now() - tb; break; } }
    const after = (await S.req('GET', '/api/guild-war/match', null, B.players[0].token, B.players[0].ip)).body.match || {};
    out.down = busyAns ? { status: busyAns.status, body: busyAns.body, ms: busyMs, unchanged: JSON.stringify(before.version) === JSON.stringify(after.version) } : null;
    await hp.start(); await waitHelperOk(S, A);
    if (busyAns && busyAns.status === 503) {
      const again = await S.req('POST', '/api/guild-war/assault', { fromLane: probeLane, requestId: busyId }, probeP.token, probeP.ip); out.down.retry = { status: again.status, ok: again.body.ok, fought: !!again.body.result }; }
    const p0 = probeOf(probe), h0 = await hp.stats();
    // every player assaults from their lane, all ten at once, until their lane is spent (a busy answer is retried like the client does)
    let fights = 0, busy = 0, rid = 0; const t0 = Date.now();
    await Promise.all(B.players.map(async (p, i) => { for (let k = 0; k < 12; k++) {
      const id = 'sk-' + p.id + '-' + (rid++); let r;
      for (let tr = 0; tr < 8; tr++) { r = await S.req('POST', '/api/guild-war/assault', { fromLane: i % 5, requestId: id }, p.token, p.ip); if (r.status !== 503) break; busy++; await sleep(r.body.retryAfterMs || 500); }
      if (r.status !== 200 || !r.body.ok) break; if (r.body.result) fights++; } }));
    const ms = Date.now() - t0; await sleep(400);
    const p1 = probeOf(probe), h1 = await hp.stats(), stats = (await S.req('GET', '/api/dev/save-stats', null, A)).body.battles;
    Object.assign(out, { fights, busy, ms, mainLine: p1.line - p0.line, mainLineMs: p1.lineMs - p0.lineMs, helperBattles: h1.battles - h0.battles, live: stats.live, poolLive: stats.pool && stats.pool.live });
    console.log('  --  ' + label + ' Skyfall: ' + fights + ' fights in ' + ms + ' ms (' + busy + ' busy answers), main-thread line fights ' + out.mainLine + ' (' + out.mainLineMs.toFixed(1) + ' ms), helper fought ' + out.helperBattles);
    if (process.env.LIVE_DEBUG) console.log(JSON.stringify({ live: out.live, pool: out.poolLive, helper: stats.pool && stats.pool.helper && { sent: stats.pool.helper.sent, byRole: stats.pool.helper.byRole } }));
    out.log = liveLog(probe);
    return out;
  } finally { await S.kill(); await hp.close(); }
}

// ---- 3: World Tree peak ----
async function worldTree(dir, label, tag) {
  const hp = await helper(dir, 2);
  const env = { SIM_WORKERS: '1', SIM_HELPERS: hp.url + '|1|live', SIM_HELPER_KEY: KEY, SERVER_ID: '1', WORLD_TREE_TEST_MS: '2500', WORLD_TREE_FIRST_EVENT_AT: new Date(Date.now() - 3600000).toISOString() };
  const { S, B, probe } = await liveServer(dir, 'wt' + tag, 10, env);
  try {
    const G = await guilds(S, B), A = B.A;
    const cal = await S.req('GET', '/api/world-tree/status', null); assert.equal(cal.body.phase, 'event', JSON.stringify(cal.body).slice(0, 200));
    for (const p of B.players) { const w = await S.req('GET', '/api/witch/state', null, p.token, p.ip); assert.equal(w.body.locked, false, JSON.stringify(w.body).slice(0, 160)); }
    await waitHelperOk(S, A);
    const start = (p, siteId, heroIds, id) => S.req('POST', '/api/world-tree/march/start', { siteId, heroIds, requestId: id }, p.token, p.ip);
    // garrison: every Alpha member sends two single-hero lines to each site (10 lines a site, the oasis limit)
    for (const p of G[0].members) for (let j = 0; j < 10; j++) { const r = await start(p, SITES[j % 5], [HEROES[j < 5 ? j : j + 5]], 'g-' + p.id + j); assert.equal(r.body.ok, true, 'garrison march: ' + JSON.stringify(r.body).slice(0, 200)); }
    await sleep(2500 + 2500);
    const ctl = (await S.req('GET', '/api/world-tree/control', null, G[0].members[0].token, G[0].members[0].ip)).body;
    assert.ok(ctl.sites.every(s => s.garrisonCount === 10), 'garrisons in place: ' + JSON.stringify(ctl.sites.map(s => s.garrisonCount)));
    // the peak: five Beta attackers launch together (five heroes each, one per site) while every player polls the control view and /health is timed
    const p0 = probeOf(probe), h0 = await hp.stats(), t0 = Date.now(); let stop = false; const lat = [];
    const polls = B.players.map(async p => { while (!stop) { await S.req('GET', '/api/world-tree/control', null, p.token, p.ip); await sleep(250); } });
    const health = (async () => { while (!stop) { const a = Date.now(); await fetch(S.base + '/health'); lat.push(Date.now() - a); await sleep(100); } })();
    const launched = await Promise.all(G[1].members.map((p, j) => (async () => { let r; for (let tr = 0; tr < 8; tr++) { r = await start(p, SITES[j], HEROES.slice(5, 10), 'a-' + p.id); if (r.status !== 503) break; await sleep(r.body.retryAfterMs || 500); } return r; })()));
    assert.ok(launched.every(r => r.body.ok), 'attackers launched: ' + JSON.stringify(launched.map(r => r.body.error || r.body.ok)));
    // fights chain at each site: one fixed 45 s window on both trees (on both, a World Tree tick that settles an attacker who lost a
    // hero throws - world-tree-control.js 'finish' reads a result row for a dead hero - and every later tick fails the same way;
    // 6bfeb24d fights that tick's battles again on its main thread every second, v1129 keeps them fetched)
    while (Date.now() - t0 < 45000) await sleep(1000);
    stop = true; await Promise.all(polls.concat([health]));
    const p1 = probeOf(probe), h1 = await hp.stats(), stats = (await S.req('GET', '/api/dev/save-stats', null, A)).body.battles;
    const w = p1.samples.filter(s => s[0] >= t0), act = w.length > 1 ? w[w.length - 1][2] - w[0][2] : 0, idl = w.length > 1 ? w[w.length - 1][3] - w[0][3] : 0;
    const out = { secs: (Date.now() - t0) / 1000, mainWt: p1.wt - p0.wt, mainWtMs: p1.wtMs - p0.wtMs, helperBattles: h1.battles - h0.battles, live: stats.live, poolLive: stats.pool && stats.pool.live,
      elu: act / Math.max(1, act + idl), worstStall: Math.max(0, ...w.map(s => s[1])), stalls100: w.filter(s => s[1] > 100).length, healthP50: pct(lat, 0.5), healthP99: pct(lat, 0.99), healthMax: Math.max(0, ...lat), log: liveLog(probe) };
    console.log('  --  ' + label + ' World Tree peak (' + out.secs.toFixed(0) + ' s): main-thread site fights ' + out.mainWt + ' (' + out.mainWtMs.toFixed(0) + ' ms), helper fought ' + out.helperBattles +
      ', live fetched ' + (out.live ? out.live.fetched : '-') + ' busy ' + (out.live ? out.live.busy : '-') + '; main thread ' + (100 * out.elu).toFixed(1) + '% busy, worst stall ' + out.worstStall + ' ms (' + out.stalls100 + ' samples > 100 ms), /health p50 ' + out.healthP50 + ' / p99 ' + out.healthP99 + ' / max ' + out.healthMax + ' ms');
    return out;
  } finally { await S.kill(); await hp.close(); }
}

// ---- 4: the pool under a peak ----
async function poolPeak(dir, label) {
  const POOL = require(path.join(dir, 'server/sim-pool.js')), HOST = require(path.join(dir, 'server/sim-host.js')), SIM = require(path.join(dir, 'server/sim.js'));
  const GAME = path.join(dir, 'emberweave-heroes.html'), FP = HOST.fingerprint(GAME), hp = await helper(dir, 2);
  const snaps = o => SIM_KEYS.slice(o, o + 5).map(k => SIM.heroCombatStats(k, { level: 60, stars: 4 }));
  const P = POOL.create(GAME, { size: 1, helpers: [{ url: hp.url, key: KEY, tier: 1, role: 'live' }], fp: FP, liveQueueMax: 24, liveWaitMs: 30000 });
  try {
    for (let i = 0; i < 100 && !(P.stats.helper.helpers[0] && P.stats.helper.helpers[0].ok && P.stats.ready); i++) await sleep(150);
    const N = 60, a = snaps(0), b = snaps(5); let maxQ = 0;
    const qT = setInterval(() => { const q = P.stats.live ? P.stats.live.queued : P.queued; if (q > maxQ) maxQ = q; }, 5);
    const order = [], t0 = Date.now();
    const jobs = [...Array(N)].map((_, i) => (P.runLive ? P.runLive('line', [a, null, b, null, 1000 + i, true], { mode: 'skyfall' }) : P.run('auto', [a, b, 1000 + i], { mode: 'skyfall' }))
      .then(r => { order.push(i); return r; }, e => ({ refused: true, busy: !!e.busy, msg: e.message })));
    const res = await Promise.all(jobs); clearInterval(qT);
    const done = res.filter(r => !r.refused).length, refused = res.filter(r => r.refused);
    // fairness: a queued battle never finishes long after one queued behind it (2 slots in flight -> small displacement only)
    const pos = new Map(order.map((i, k) => [i, k])); let worstJump = 0; for (const [i, k] of pos) worstJump = Math.max(worstJump, k - i);
    const s = P.stats; if (s.live) maxQ = Math.max(maxQ, s.live.maxQueued); const out = { N, done, refused: refused.length, refusedBusy: refused.filter(r => r.busy).length, ms: Date.now() - t0, maxQ, worstJump, onWorkers: s.live ? s.live.onWorkers : null, fellBack: s.helper.fellBack, liveStats: s.live, hasLive: !!P.runLive };
    // the wait bound: the helper gone, a live battle waits liveWaitMs at most, then is refused busy (never the workers)
    if (P.runLive) { await hp.close(); const P2 = POOL.create(GAME, { size: 1, helpers: [{ url: hp.url, key: KEY, tier: 1, role: 'live' }], fp: FP, liveWaitMs: 600 }); await sleep(800);
      const tb = Date.now(); const e = await P2.runLive('line', [a, null, b, null, 7, true]).then(() => null, x => x); out.downMs = Date.now() - tb; out.downBusy = !!(e && e.busy); out.downWorkers = P2.stats.live.onWorkers; P2.close(); }
    console.log('  --  ' + label + ' pool peak: ' + done + '/' + N + ' drained in ' + out.ms + ' ms, refused ' + out.refused + ' (busy ' + out.refusedBusy + '), queue max ' + maxQ + ' (bound 24), worst order jump ' + worstJump + ', on the server\'s workers ' + (out.onWorkers ?? ('fellBack ' + out.fellBack)));
    return out;
  } finally { P.close(); await hp.close(); }
}

// ---- the client: a busy answer is sent again (same requestId) with growing waits ----
async function clientRetry(dir, uiFile) {
  const vm = require('node:vm'), html = fs.readFileSync(path.join(dir, 'emberweave-heroes.html'), 'utf8');
  const src = html.slice(html.indexOf('const _apiOnceBusy={};'), html.indexOf('let _kickedNotified=false;'));
  const BUSY = { ok: false, busy: true, retry: true, storageFailed: true, retryAfterMs: 1000, error: 'busy' };
  const calls = [], delays = [], replies = [BUSY, BUSY, BUSY, BUSY, { ok: true, won: true }];
  const ctx = { uid8: () => 'rid-1', api: async (pth, m, body) => { calls.push(body.requestId); return replies.shift(); }, setTimeout: (f, ms) => { delays.push(ms); f(); return 0; }, Math, Promise, Object };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const r = await ctx.apiOnce('skymarch', '/api/guild-war/assault', { fromLane: 0 });
  // the World Tree actions panel (assets/ui/world-tree-actions-ui.js)
  const UI = require(uiFile || path.join(dir, 'assets/ui/world-tree-actions-ui.js')); const wtCalls = [], wtDelays = [], wtReplies = [BUSY, BUSY, { ok: true, control: {} }];
  const el = () => ({ style: {}, append() {}, appendChild() {}, replaceChildren() {}, remove() {}, set textContent(v) {}, isConnected: false });
  const ui = UI.create({ document: { createElement: el, body: { appendChild() {} } }, identity: () => 'u:t', requestId: () => 'wt-rid',
    control: () => ({ load: async () => {}, state: () => ({ data: { active: true, guildId: 'g', marches: [{ id: 'm1', siteId: 'tree', canRetreat: true }] } }), heroes: () => new Set(), adopt() {} }),
    post: async (pth, body) => { wtCalls.push(body.requestId); return wtReplies.shift(); }, heroes: () => [], busy: async () => new Set(), cachedBusy: () => new Set(), power: () => 0 });
  const realST = global.setTimeout; global.setTimeout = (f, ms) => { wtDelays.push(ms); return realST(f, 0); };
  try { await ui.submit('retreat', { marchId: 'm1' }); } finally { global.setTimeout = realST; }
  return { r, calls, delays, wtCalls, wtDelays };
}

// ---- 5: byte-identical ----
function mainThreadOf(dir) {
  const HOST = require(path.join(dir, 'server/sim-host.js')), SIM = require(path.join(dir, 'server/sim.js')), WTB = require(path.join(dir, 'server/world-tree-battle.js'));
  const host = HOST.load(path.join(dir, 'emberweave-heroes.html')), wt = WTB.create(host);
  return { worldtree: (a, d, seed) => wt(a, d, seed), line: (a, ac, b, bc, seed, cap) => SIM.resolveLineBattle(SIM.makeLine(a, ac, cap), SIM.makeLine(b, bc, cap), seed), engine: host.buildVersion };
}

(async () => {
  let failed = false, ctl = null;
  const check = (c, m) => R.ok(c, m);
  try {
    // this tree
    const sky = await skyfall(R.root, 'v1129', 'n');
    check(sky.fights >= 10 && sky.mainLine === 0 && sky.helperBattles >= sky.fights, 'Skyfall: ' + sky.fights + ' assaults fought by 10 players at once, all on the real helper (' + sky.helperBattles + '), 0 on the server\'s main thread');
    check(sky.down && sky.down.status === 503 && sky.down.body.busy === true && sky.down.body.retryAfterMs > 0 && sky.down.unchanged, 'no helper: the assault answers 503 busy + retryAfterMs (' + (sky.down && sky.down.ms) + ' ms) and the match is unchanged');
    check(sky.down && sky.down.retry && sky.down.retry.status === 200 && sky.down.retry.ok && sky.down.retry.fought, 'the same requestId fights once the helper is back');
    {   // no battle pool at all: busy, never the main thread
      const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-live-probe-'));
      const S = await R.server({ nodeArgs: ['-r', PROBE], env: { LIVE_PROBE_DIR: probe, SIM_WORKERS: '0', WORLD_TREE_CONTROL_TEST: '1' } });
      try { const B = await R.boot(S, 'np', 1, { heroes: HEROES, world: false }); void B;
        // a World Tree action with the event off is refused before any fight; use the planner directly via a Skyfall-free check: save-stats shows the warning path
        check(/SIM_WORKERS=0: no battle pool - World Tree and Skyfall battles answer busy/.test(S.log() + ''), 'SIM_WORKERS=0: the server says at boot that live battles answer busy (there is no main-thread path)');
      } finally { await S.kill(); }
    }
    const wt = await worldTree(R.root, 'v1129', 'n');
    check(wt.mainWt === 0 && wt.helperBattles > 0 && wt.live.fetched >= 5, 'World Tree peak: ' + wt.live.fetched + ' site fights on the real helper (' + wt.helperBattles + ' helper battles), 0 on the server\'s main thread');
    const pk = await poolPeak(R.root, 'v1129');
    check(pk.done + pk.refused === pk.N && pk.maxQ <= 24 && pk.onWorkers === 0, 'pool peak: ' + pk.N + ' live battles at once - ' + pk.done + ' drained, ' + pk.refused + ' refused busy, the queue peaked at ' + pk.maxQ + ' (bound 24), none on the server\'s own workers');
    check(pk.refused > 0 && pk.refused === pk.refusedBusy, 'the battles past the bound are refused busy at once (' + pk.refused + '), never queued without end');
    check(pk.worstJump <= 4, 'fair: the oldest waiting battle goes first (worst completion jump ' + pk.worstJump + ' places with 2 in flight)');
    check(pk.downBusy && pk.downMs < 2000 && pk.downWorkers === 0, 'the wait is bounded: with the helper gone a live battle is refused busy after ' + pk.downMs + ' ms (liveWaitMs 600), not fought on the workers');
    const cr = await clientRetry(R.root);
    check(cr.r.ok === true && cr.calls.length === 5 && new Set(cr.calls).size === 1 && cr.delays.length === 4 && cr.delays.every((d, i) => i === 0 || d > cr.delays[i - 1] * 1.1) && cr.delays[0] >= 750,
      'client (Skyfall march): four busy answers, the same requestId sent again with growing waits (' + cr.delays.map(d => Math.round(d)).join(', ') + ' ms) - the fifth fights');
    check(cr.wtCalls.length === 3 && new Set(cr.wtCalls).size === 1 && cr.wtDelays.filter(d => d >= 750).length === 2, 'client (World Tree panel): busy answers are sent again with the same requestId (' + cr.wtCalls.length + ' sends, waits ' + cr.wtDelays.filter(d => d >= 750).map(d => Math.round(d)).join(', ') + ' ms)');
    // 5. identical
    const here = mainThreadOf(R.root), all = sky.log.concat(wt.log);
    const nW = all.filter(x => x.m === 'worldtree').length, nL = all.filter(x => x.m === 'line').length;
    const same = all.filter(x => JSON.stringify(here[x.m](...x.args)) === JSON.stringify(x.r)).length;
    check(nW >= 5 && nL >= 10 && same === all.length, 'byte-identical: ' + same + '/' + all.length + ' helper results (' + nW + ' World Tree, ' + nL + ' Skyfall) equal the main-thread function on the same inputs');
    {   // the worker path (no helper configured): same bytes
      const POOL = require(path.join(R.root, 'server/sim-pool.js')), P = POOL.create(path.join(R.root, 'emberweave-heroes.html'), { size: 1 });
      for (let i = 0; i < 100 && !P.stats.ready; i++) await sleep(100);
      const sample = all.filter(x => x.m === 'worldtree').slice(0, 3).concat(all.filter(x => x.m === 'line').slice(0, 3)); let ok = 0;
      for (const x of sample) { const r = await P.runLive(x.m, x.args); if (JSON.stringify(r) === JSON.stringify(here[x.m](...x.args))) ok++; }
      check(ok === sample.length && P.stats.live.onWorkers === sample.length, 'no helper configured: the server\'s battle workers (not the main thread) give the same bytes (' + ok + '/' + sample.length + ')'); P.close();
    }
    const bad = all.find(x => x.m === 'line'), broken = JSON.parse(JSON.stringify(bad.r)); broken.aState[0].hp += 1;
    check(JSON.stringify(here.line(...bad.args)) !== JSON.stringify(broken), 'the comparison catches a one-point difference');
    // CONTROL 6bfeb24d
    ctl = R.controlTree(CONTROL);
    { const f = path.join(ctl, 'server.js'), s = fs.readFileSync(f, 'utf8'); if (s.includes('const WORLD_TREE_CONTROL_ENABLED=false;'))
      fs.writeFileSync(f, s.replace('const WORLD_TREE_CONTROL_ENABLED=false;', "const WORLD_TREE_CONTROL_ENABLED=process.env.WORLD_TREE_CONTROL_TEST==='1';")); }
    const old = mainThreadOf(ctl);
    const sameOld = all.filter(x => { const a = here[x.m](...x.args), b = old[x.m](...x.args); if (x.m === 'worldtree') { delete a.engine; delete b.engine; } return JSON.stringify(a) === JSON.stringify(b); }).length;
    /* v1181: the engine itself moved after 6bfeb24d (v1135-v1180 hero changes), so the identity that matters for shipping is with
       the LIVE engine this branch sits on (LIVE_BASE, default v1180 15ddba3f): every helper result = live's main-thread functions. */
    const LIVE_BASE = process.env.LIVE_BASE || '15ddba3f', base = mainThreadOf(R.controlTree(LIVE_BASE));
    const sameBase = all.filter(x => { const a = here[x.m](...x.args), c = base[x.m](...x.args); if (x.m === 'worldtree') { delete a.engine; delete c.engine; } return JSON.stringify(a) === JSON.stringify(c); }).length;
    try { R.removeControlTree(LIVE_BASE); } catch (e) {}
    check(sameBase === all.length, 'and equal the main-thread functions of the live engine (' + LIVE_BASE + ') on the same inputs (' + sameBase + '/' + all.length + '; 6bfeb24d, before the v1135-v1180 engine changes: ' + sameOld + '/' + all.length + ')');
    const csky = await skyfall(ctl, 'control ' + CONTROL, 'c');
    check(csky.mainLine > 0, 'CONTROL ' + CONTROL + ': its Skyfall fights run on the main thread (' + csky.mainLine + ') - check 1 fails there');
    check(!(csky.down && csky.down.status === 503), 'CONTROL ' + CONTROL + ': with the helper down the assault is fought anyway (' + (csky.down && csky.down.status) + ') - check 2 fails there');
    const cwt = await worldTree(ctl, 'control ' + CONTROL, 'c');
    check(cwt.mainWt > 0, 'CONTROL ' + CONTROL + ': its World Tree site fights run on the main thread (' + cwt.mainWt + ', ' + cwt.mainWtMs.toFixed(0) + ' ms) - check 3 fails there');
    const ctlUi = path.join(os.tmpdir(), 'world-tree-actions-ui-' + CONTROL + '.js');   // the control copy links this tree's assets: take the file from git
    fs.writeFileSync(ctlUi, require('node:child_process').execFileSync('git', ['show', CONTROL + ':assets/ui/world-tree-actions-ui.js'], { cwd: R.root }));
    const ccr = await clientRetry(ctl, ctlUi);
    check(!(ccr.r && ccr.r.ok) && ccr.wtCalls.length === 1, 'CONTROL ' + CONTROL + ': the client gives up on a busy fight (Skyfall after ' + ccr.calls.length + ' sends, the World Tree panel after ' + ccr.wtCalls.length + ') - the client checks fail there');
    const cpk = await poolPeak(ctl, 'control ' + CONTROL);
    check(!cpk.hasLive && cpk.fellBack > 0, 'CONTROL ' + CONTROL + ': its pool has no live path; with the helper full a live battle falls back to the server\'s own workers (' + cpk.fellBack + ') - check 4 fails there');
    console.log('  --  MAIN THREAD under the World Tree peak, ' + CONTROL + ' -> v1129: site fights on it ' + cwt.mainWt + ' (' + cwt.mainWtMs.toFixed(0) + ' ms) -> ' + wt.mainWt +
      '; busy ' + (100 * cwt.elu).toFixed(1) + '% -> ' + (100 * wt.elu).toFixed(1) + '%; worst stall ' + cwt.worstStall + ' -> ' + wt.worstStall + ' ms; /health p99 ' + cwt.healthP99 + ' -> ' + wt.healthP99 + ' ms, max ' + cwt.healthMax + ' -> ' + wt.healthMax + ' ms');
    console.log('  --  MAIN THREAD under the Skyfall run, ' + CONTROL + ' -> v1129: line fights on it ' + csky.mainLine + ' (' + csky.mainLineMs.toFixed(1) + ' ms) -> ' + sky.mainLine);
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { if (ctl) { await sleep(1500); try { R.removeControlTree(CONTROL); } catch (e) { console.error('control tree left: ' + e.message); } } }
  console.log('test_live_helpers.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
