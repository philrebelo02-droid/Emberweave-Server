'use strict';
// v1185: a new account's first ledger (ensureLedger -> ledTx 'migrate:from-save') saves THAT player, not the whole world. On the S1
// copy (17 Oct) it was 18.7 full saves a minute at 500 players - in the journal layout each one a whole new base plus a syncfs (on
// Server 2's shared SSD 1.9-2.7 s each). Checks: ten new accounts open their ledger -> no full save after boot (/internal/save-stats),
// every ledger is on disk after a hard kill, the full-save tracer (DB_STORE_TRACE_FULL=1) names no caller but the boot.
// CONTROL: the tree before this fix (18bdade2) makes one full save per new ledger.
const fs = require('node:fs'), path = require('node:path');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const CONTROL = '18bdade2';
async function run(dir, tag) {
  const S = await R.server({ dir, env: { DB_STORE_TRACE_FULL: '1', DB_FSYNC: '0', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000' } });
  await S.start(''); await R.sleep(1500);
  const stats = async () => { const r = await fetch(S.base + '/internal/save-stats'); return r.json(); };
  const s0 = await stats(), ids = [];
  for (let i = 0; i < 10; i++) {
    const ip = '10.85.0.' + (i + 1), r = await S.req('POST', '/api/register', { name: tag + 'L' + i, pass: 'password1' }, null, ip);
    await S.req('GET', '/api/profile', null, r.body.token, ip); await S.req('GET', '/api/quest/state', null, r.body.token, ip);   // what the client loads first (the generator saw the full saves here)
    const g = await S.req('GET', '/api/ledger', null, r.body.token, ip); ids.push({ id: r.body.profile && r.body.profile.id, gold: g.body.gold }); }
  await R.sleep(1500); const s1 = await stats(); await S.kill();
  const w = WS.readWorld(S.db);
  return { full: s1.store.full - s0.store.full, callers: s1.fullCallers || {}, onDisk: ids.filter(x => x.id && w.users[x.id] && w.users[x.id].led && w.users[x.id].led.gold === x.gold).length, n: ids.length };
}
(async () => {
  let failed = false;
  try {
    const a = await run(R.root, 'lp');
    R.ok(a.full === 0, 'ten new accounts open their ledger: ' + a.full + ' full saves after boot (callers ' + JSON.stringify(a.callers) + ')');
    R.ok(a.onDisk === a.n, 'every new ledger is on disk after a hard kill (' + a.onDisk + '/' + a.n + ')');
    const c = await run(R.controlTree(CONTROL), 'lc');
    R.ok(c.full >= 5, 'CONTROL ' + CONTROL + ': the same ten ledgers made ' + c.full + ' full saves');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { try { R.removeControlTree(CONTROL); } catch (e) {} }
  console.log('test_ledger_partial_1185.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
