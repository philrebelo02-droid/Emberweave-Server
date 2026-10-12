'use strict';
// v1127 HELPER ROLES + EVENT-DRIVEN DISPATCH (Phil 11 Oct 2026: "campaign, vault, guild raid.. other low priority tasks. world map must
// be done by faster machines" / World Tree and Skyfall are fast-machine work too). The real server/sim-pool.js against stub helpers
// (in-process HTTP: /health + /battle with a fixed fight time and slot count, like sim-helper.js):
//  - the mode table (server/sim-roles.js): world map (city/castle/mine), World Tree, Skyfall live; campaign, Vault, guild raid,
//    Province, Well, bonus stages, the backlog async; an unknown mode async;
//  - a war spike that keeps the live pool saturated while a campaign backlog drains: no live battle ever lands on the async node,
//    the backlog keeps draining at about the reserved rate (the node + 25% of each fast helper), live gets the rest;
//  - with no async work waiting the fast helpers give live every slot; with no live work they flex to async;
//  - every live helper down -> live borrows the node (never just because live is busy);
//  - a backlog that would take > 5 minutes to drain makes the 'any' helper (Phil's PC) lean async (half its slots);
//  - the backlog dispatcher (canTake + onFree) asks for a helper about once per battle, not in a busy loop.
// Control: the 59eaefba pool (no roles) puts live battles on the node and lets the war spike take the fast helpers' every slot.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const R = require('./helpers/split-rig.cjs');
const GAME = path.join(R.root, 'emberweave-heroes.html');
const HOST = require(path.join(R.root, 'server/sim-host.js')), ROLES = require(path.join(R.root, 'server/sim-roles.js'));
const FP = HOST.fingerprint(GAME), KEY = 'roles-test-key-' + 'r'.repeat(16);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function stubHelper(name, limit, fightMs) {
  const s = { name, limit, fightMs, down: false, inFlight: 0, served: { live: 0, async: 0 }, refused: 0, url: null };
  const srv = http.createServer((req, res) => {
    if (s.down) { res.writeHead(503); return res.end('{}'); }
    if (req.url.startsWith('/health')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ fp: FP, ready: 1, limit: s.limit, inFlight: s.inFlight, busy: s.inFlight >= s.limit, others: 0 })); }
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      if (s.inFlight >= s.limit) { s.refused++; res.writeHead(503); return res.end('{}'); }
      s.inFlight++; const j = JSON.parse(body), kind = j.args && j.args[0];
      setTimeout(() => { s.inFlight--; s.served[kind === 'live' ? 'live' : 'async']++; res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ result: { by: name, kind } })); }, s.fightMs);
    });
  });
  s.start = () => new Promise(r => srv.listen(0, '127.0.0.1', () => { s.url = 'http://127.0.0.1:' + srv.address().port; r(s); }));
  s.close = () => srv.close();
  return s;
}

async function scenario(POOL, withRoles, opts) {
  opts = opts || {};
  const L = await stubHelper('live1', 4, 300).start(), A = await stubHelper('pc', 4, 100).start(), N = await stubHelper('node1', 2, 400).start();
  const backlog = { q: opts.asyncN || 0, done: 0, asks: 0, onFast: 0 };
  const helpers = [{ url: L.url, key: KEY, tier: 1, role: 'live' }, { url: A.url, key: KEY, tier: 2, role: 'any' }, { url: N.url, key: KEY, tier: 1, role: 'async' }];
  const P = POOL.create(GAME, { size: 1, helpers: withRoles ? helpers : helpers.map(h => ({ url: h.url, key: h.key, tier: h.tier })), fp: FP, checksLocal: false,
    asyncWaiting: () => backlog.q, asyncDrainMinutes: () => opts.drainMin || 0 });
  for (let i = 0; i < 100 && !(P.stats.helper.helpers.length === 3 && P.stats.helper.helpers.every(h => h.ok)); i++) await sleep(100);
  assert.ok(P.stats.helper.helpers.every(h => h.ok), 'stub helpers ready: ' + JSON.stringify(P.stats.helper.helpers.map(h => h.why)));
  if (opts.liveDown) { L.down = true; A.down = true; await sleep(5600); }   // the next health poll marks them down
  let stop = false; const live = { done: 0, refused: 0, onNode: 0 };
  // the war spike: 14 live battles always wanting a slot (a city battle answers 'busy' and the client retries)
  const liveWorker = async () => { while (!stop && opts.liveN !== 0) { try { const r = await P.run('auto', ['live'], { check: true, mode: 'city' }); live.done++; if (r.by === 'node1') live.onNode++; } catch (e) { live.refused++; await sleep(30); } } };
  // the campaign backlog: the server's dispatcher - send while canTake('async'), else sleep until onFree / 2 s
  let wake = null; if (P.onFree) P.onFree(() => { if (wake) { const w = wake; wake = null; w(); } });
  let inFlight = 0;
  const asyncLoop = async () => { while (!stop && backlog.q > 0) {
      const cap = P.checkCapacity ? P.checkCapacity('async') : 4;
      if (inFlight >= cap || (P.canTake && !P.canTake('async'))) { await new Promise(r => { wake = r; setTimeout(r, P.canTake ? 2000 : 250); }); continue; }
      backlog.q--; inFlight++; backlog.asks++;
      P.run('auto', ['async'], { check: true, mode: 'backlog' }).then(r => { backlog.done++; if (r.by !== 'node1') backlog.onFast++; }, () => { backlog.q++; })
        .finally(() => { inFlight--; if (wake) { const w = wake; wake = null; w(); } });
      if (!P.canTake) await sleep(5); } };
  const t0 = Date.now(), run = [...Array(opts.liveN === 0 ? 0 : 14)].map(liveWorker).concat([asyncLoop()]);
  await sleep(opts.ms || 6000); stop = true; await Promise.race([Promise.all(run), sleep(3000)]);
  const secs = (Date.now() - t0) / 1000, st = P.stats.helper;
  P.close(); L.close(); A.close(); N.close();
  return { secs, live, backlog, L: L.served, A: A.served, N: N.served, refusedByHelpers: L.refused + A.refused + N.refused, liveOnAsync: st.liveOnAsync, asyncOnLive: st.asyncOnLive, noHelper: st.noHelper, wakeups: st.wakeups };
}

(async () => {
  let failed = false, ctlFile = null;
  try {
    const T = ROLES.roleOf;
    R.ok(['city', 'castle', 'mine', 'worldtree', 'skyfall'].every(m => T(m) === 'live') && ['campaign', 'vault', 'raid', 'guildraid', 'province', 'well', 'bonus', 'backlog'].every(m => T(m) === 'async') && T('something-new') === 'async' && T(undefined) === 'async',
      'mode table: world map (city/castle/mine), World Tree and Skyfall are live; campaign, Vault, guild raid, Province, Well, bonus stages and the backlog async; an unknown mode async');
    const POOL = require(path.join(R.root, 'server/sim-pool.js'));
    // 1. war spike + campaign backlog
    const a = await scenario(POOL, true, { asyncN: 100000 });
    const reservedRate = 1 / 0.3 + 1 / 0.1 + 2 / 0.4;   // 25% of live1 (1 of 4 slots) + 25% of the PC (1 of 4) + the node's 2 slots
    const asyncRate = a.backlog.done / a.secs, liveRate = a.live.done / a.secs;
    console.log('  --  war spike + backlog: live ' + liveRate.toFixed(1) + '/s, async ' + asyncRate.toFixed(1) + '/s (reserved ' + reservedRate.toFixed(1) + '/s), live on node ' + a.live.onNode + ', async on fast ' + a.backlog.onFast + ', helper 503s ' + a.refusedByHelpers + ', dispatcher asks ' + a.backlog.asks + ' for ' + a.backlog.done + ' checks');
    R.ok(a.liveOnAsync === 0 && a.live.onNode === 0 && a.N.live === 0, 'a saturated live pool never puts a live battle on the async node (' + a.N.live + ')');
    R.ok(asyncRate >= 0.75 * reservedRate && a.backlog.onFast > 0, 'the campaign backlog keeps draining at about the reserved rate under the war spike: ' + asyncRate.toFixed(1) + '/s of ' + reservedRate.toFixed(1) + '/s reserved (' + a.backlog.onFast + ' on the fast helpers)');
    R.ok(liveRate >= 0.7 * (3 / 0.3 + 3 / 0.1), 'live keeps the other 75% of the fast slots: ' + liveRate.toFixed(1) + '/s');
    R.ok(a.backlog.asks <= a.backlog.done + 12 && a.refusedByHelpers <= 5, 'event-driven: the dispatcher asked ' + a.backlog.asks + ' times for ' + a.backlog.done + ' checks, helpers refused ' + a.refusedByHelpers);
    // 2. no async waiting: live gets every fast slot
    const b = await scenario(POOL, true, { asyncN: 0, ms: 4000 });
    R.ok(b.live.done / b.secs >= 0.8 * (4 / 0.3 + 4 / 0.1) && b.N.live === 0, 'no async work waiting: live takes every fast slot (' + (b.live.done / b.secs).toFixed(1) + '/s), still none on the node');
    // 3. no live work: the fast helpers flex to async
    const c = await scenario(POOL, true, { asyncN: 100000, liveN: 0, ms: 4000 });
    R.ok(c.backlog.done / c.secs >= 0.75 * (4 / 0.3 + 4 / 0.1 + 2 / 0.4), 'no live work: every helper drains the backlog (' + (c.backlog.done / c.secs).toFixed(1) + '/s)');
    // 4. every live helper down: live borrows the node
    const d = await scenario(POOL, true, { asyncN: 0, liveDown: true, ms: 3000 });
    R.ok(d.live.onNode > 0 && d.live.done === d.live.onNode, 'every live helper down: live battles borrow the node (' + d.live.onNode + ')');
    // 5. a long backlog: the PC leans async
    const e = await scenario(POOL, true, { asyncN: 100000, drainMin: 30, ms: 4000 });
    R.ok(e.A.async / Math.max(1, e.A.async + e.A.live) > (a.A.async / Math.max(1, a.A.async + a.A.live)) + 0.15, 'a backlog past 5 minutes of drain makes the PC lean async (async share ' + (100 * e.A.async / Math.max(1, e.A.async + e.A.live)).toFixed(0) + '% vs ' + (100 * a.A.async / Math.max(1, a.A.async + a.A.live)).toFixed(0) + '%)');
    // control: the 59eaefba pool (no roles, busy re-asking)
    ctlFile = path.join(R.root, 'server', '.sim-pool-' + R.CONTROL_SHA + '.js');
    fs.writeFileSync(ctlFile, execFileSync('git', ['show', R.CONTROL_SHA + ':server/sim-pool.js'], { cwd: R.root }));
    const OLD = require(ctlFile), z = await scenario(OLD, false, { asyncN: 100000 });
    console.log('  --  control 59eaefba: live ' + (z.live.done / z.secs).toFixed(1) + '/s, async ' + (z.backlog.done / z.secs).toFixed(1) + '/s, live on node ' + z.live.onNode + ', helper 503s ' + z.refusedByHelpers + ', no-helper refusals ' + z.noHelper + ', dispatcher asks ' + z.backlog.asks);
    R.ok(z.live.onNode > 0, 'CONTROL: the 59eaefba pool puts live battles on the node (' + z.live.onNode + ') - the role check above fails there');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { if (ctlFile) try { fs.unlinkSync(ctlFile); } catch (_) {} }
  console.log('test_helper_roles.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
