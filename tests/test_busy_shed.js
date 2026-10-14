'use strict';
// v1134 EARLY BUSY (S1 copy run 12 Oct 2026 on 6bfeb24d: past ~95% main thread requests queued to 30 s timeouts and an overload did not
// recover by itself - nothing turned extra work away).
// A real server whose main thread a preload keeps ~95% busy (tests/helpers/burn-main.cjs, the way a full Server 1 is):
//  - polls (GET /api/...) are answered at once with 503 {busy, retry, storageFailed, retryAfterMs} + Retry-After; actions (POST) less often;
//  - /api/health, /api/dev/save-stats and pages are never refused; save-stats counts what was refused (shed.elu, shed.p, shedGet/Post);
//  - a refused cloud save changed nothing (the same request sent again later is saved);
//  - with the main thread idle again nothing is refused; BUSY_SHED unset on a NODE_ENV=test server = off (the suite's servers).
// CONTROL f2043269 (before v1134): the same burn - not one request is refused; every one waits its turn.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const CONTROL = 'f2043269';
const BURN = path.join(__dirname, 'helpers', 'burn-main.cjs');

async function run(dir, tag, check, env) {
  const flag = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ember-burn-')), 'burn.on');
  const S = await R.server({ dir, nodeArgs: ['-r', BURN], env: Object.assign({ BURN_ON: flag, BURN_PCT: '95', BUSY_SHED_WARM_MS: '0', RL_MUL: '1000' }, env || {}) });
  const B = await R.boot(S, tag, 2, { world: false });
  const [p0] = B.players, out = { busyGet: 0, busyPost: 0, sent: 0, health: 0, healthOk: 0, idleBusy: 0 };
  try {
    fs.writeFileSync(flag, '1'); await R.sleep(4500);   // the 2 s window fills with the burn
    const st0 = (await B.stat());
    const jobs = [];
    for (let i = 0; i < 80; i++) jobs.push(S.req('GET', '/api/profile', null, p0.token, p0.ip).then(r => { out.sent++; if (r.status === 503 && r.body.busy) { out.busyGet++; out.lastBusy = r.body; } }));
    for (let i = 0; i < 40; i++) jobs.push(S.req('POST', '/api/pvp/reports', {}, p0.token, p0.ip).then(r => { out.sent++; if (r.status === 503 && r.body.busy) out.busyPost++; }));
    for (let i = 0; i < 10; i++) jobs.push(S.req('GET', '/api/health', null, null, p0.ip).then(r => { out.health++; if (r.status === 200) out.healthOk++; }));
    await Promise.all(jobs);
    const st1 = await B.stat();
    out.stat = st1.shed;
    // a refused cloud save changes nothing: send saves until one is refused, check it is not stored, send it again idle
    let refused = null, lastOk = null;
    for (let i = 0; i < 200 && !refused; i++) { const team = [{ key: i % 2 ? 'vael' : 'vireo' }], r = await fetch(S.base + '/api/save', { method: 'POST', headers: { 'x-token': p0.token, 'content-type': 'application/json', 'x-forwarded-for': p0.ip }, body: JSON.stringify({ team, wall: team, requestId: tag + 's' + i }) });
      const b = await r.json().catch(() => ({})); if (r.status === 503 && b.busy) { if (lastOk) refused = { i, team, retryAfter: r.headers.get('retry-after') }; } else if (r.status === 200) lastOk = team[0].key; }   // a refusal counts once a save was accepted before it
    fs.unlinkSync(flag); await R.sleep(2600);
    if (refused) { out.refused = refused; out.lastOk = lastOk; await R.sleep(800); out.stored = (((WS.readWorld(S.db).users[p0.id] || {}).team || [])[0] || {}).key; }
    for (let i = 0; i < 40; i++) { const r = await S.req('GET', '/api/profile', null, p0.token, p0.ip); if (r.status === 503) out.idleBusy++; }
    const pg = await fetch(S.base + '/'); out.page = pg.status;
    return out;
  } finally { try { fs.unlinkSync(flag); } catch (e) {} await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== BUSY_SHED=1, main thread ~95% busy');
    const a = await run(R.root, 'bs', R.ok, { BUSY_SHED: '1' });
    R.ok(a.busyGet >= 20 && a.lastBusy && a.lastBusy.retry && a.lastBusy.storageFailed && a.lastBusy.retryAfterMs >= 1000,
      'polls refused at once: ' + a.busyGet + ' of 80 GETs answered 503 busy {retry, storageFailed, retryAfterMs ' + (a.lastBusy && a.lastBusy.retryAfterMs) + '}');
    R.ok(a.busyPost < a.busyGet * 40 / 80 + 5, 'actions are refused less often than polls (' + a.busyPost + ' of 40 POSTs, ' + a.busyGet + ' of 80 GETs)');
    R.ok(a.healthOk === a.health && a.stat && a.stat.on && a.stat.shed >= a.busyGet + a.busyPost && a.stat.elu >= 0.85 && a.stat.shedGet >= a.busyGet,
      '/api/health never refused (' + a.healthOk + '/' + a.health + '); save-stats shed: elu ' + (a.stat && a.stat.elu) + ', p ' + (a.stat && a.stat.p) + ', shed ' + (a.stat && a.stat.shed) + ' (GET ' + (a.stat && a.stat.shedGet) + ', POST ' + (a.stat && a.stat.shedPost) + ')');
    R.ok(a.refused && /^\d+$/.test(String(a.refused.retryAfter)) && a.lastOk && a.stored === a.lastOk && a.stored !== a.refused.team[0].key,
      'a cloud save was refused with Retry-After ' + (a.refused && a.refused.retryAfter) + ' s before any work: the stored team is still the last accepted one (' + a.stored + ', the refused one was ' + (a.refused && a.refused.team[0].key) + ')');
    R.ok(a.idleBusy === 0 && a.page === 200, 'main thread idle again: 0 of 40 polls refused; pages always served (' + a.page + ')');
    console.log('== NODE_ENV=test without BUSY_SHED (the suite\'s servers): off');
    const off = await run(R.root, 'bo', R.ok, {});
    R.ok(off.busyGet === 0 && off.busyPost === 0 && off.stat && off.stat.on === false, 'off: 0 of ' + off.sent + ' refused under the same burn');
    console.log('== control ' + CONTROL + ' (must fail)');
    const c = await run(R.controlTree(CONTROL), 'bc', () => {}, { BUSY_SHED: '1' });
    R.ok(c.busyGet === 0 && c.busyPost === 0 && !c.stat, 'CONTROL: ' + CONTROL + ' refused 0 of ' + c.sent + ' requests under the same burn (this tree: ' + (a.busyGet + a.busyPost) + ') - every one waited its turn');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(CONTROL); }
  console.log('test_busy_shed.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
