'use strict';
// v1183 /internal/save-stats: the deploy's on-box check reads the save counters (layout, io.failed, pieceMissed, undeclared) without a
// dev account. Loopback only and never through the tunnel (x-forwarded-for / cf-ray / cf-connecting-ip -> 404, as /internal/strain);
// counters only - no player name, id or token in the answer. Control: v1182 (6c07be8b) has no such route (its page fallback answers).
const R = require('./helpers/split-rig.cjs');
const CONTROL = '6c07be8b';
async function probe(S) {
  const get = async h => { const r = await fetch(S.base + '/internal/save-stats', { headers: h || {} }); return { status: r.status, text: await r.text() }; };
  return { plain: await get(), xff: await get({ 'x-forwarded-for': '203.0.113.9' }), cf: await get({ 'cf-ray': 'abc' }), cfip: await get({ 'cf-connecting-ip': '203.0.113.9' }) };
}
(async () => {
  let failed = false;
  try {
    const S = await R.server({});
    const B = await R.boot(S, 'iss', 2, { world: false });
    const p = await probe(S); let j = {}; try { j = JSON.parse(p.plain.text); } catch (e) {}
    R.ok(p.plain.status === 200 && j.store && j.store.layout === 'journal' && j.store.io && j.store.io.failed === 0,
      'loopback: 200, layout ' + (j.store && j.store.layout) + ', io.failed ' + (j.store && j.store.io && j.store.io.failed));
    R.ok(p.xff.status === 404 && p.cf.status === 404 && p.cfip.status === 404, 'through the tunnel (x-forwarded-for / cf-ray / cf-connecting-ip): 404 (' + [p.xff.status, p.cf.status, p.cfip.status].join('/') + ')');
    const leak = B.players.some(pl => p.plain.text.includes(pl.id) || p.plain.text.includes(pl.name) || p.plain.text.includes(pl.token));
    R.ok(!leak && !p.plain.text.includes(B.adminId), 'no player id, name or token in the answer (' + p.plain.text.length + ' B)');
    await S.kill();
    const C = await R.server({ dir: R.controlTree(CONTROL) }); await C.start('');
    const c = await probe(C); await C.kill();
    let cj = null; try { cj = JSON.parse(c.plain.text); } catch (e) {}
    R.ok(!(cj && cj.store), 'CONTROL ' + CONTROL + ': no save counters at /internal/save-stats (' + c.plain.status + ', ' + (cj ? 'JSON without store' : 'not JSON - the page fallback') + ')');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { try { R.removeControlTree(CONTROL); } catch (e) {} }
  console.log('test_internal_save_stats_1183.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
