// v1135 - pre-beta free packs (Phil 14 Oct 2026: "make the shop diamond packs available to all players without them having to pay
// anything" / "we will turn it off in december"). Real HTTP against local servers: switch ON (default) every player can take a pack
// for free, credited by the server at usd 0 and never counted toward EGP; switch OFF (SHOP_FREE_PACKS=0) the shop is "coming soon".
// CONTROL: run with BASE=<dir of an older checkout> - the free claim must FAIL there.
'use strict';
const assert = require('assert'), cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
const root = process.env.BASE ? path.resolve(process.env.BASE) : path.resolve(__dirname, '..');
const L = b => (b && b.ledger) || b;
let checks = 0; const ok = (c, m) => { assert(c, m); checks++; console.log('  ok', m); };
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
async function boot(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-free1135-')), port = await freePort();
  const child = cp.spawn(process.execPath, ['server.js'], { cwd: root, env: Object.assign({}, process.env, { PORT: String(port), DB_FILE: path.join(dir, 'db.json'),
    SIM_WORKERS: '0', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', DB_STORE: '', DATABASE_URL: '', SHOP_TEST_PURCHASES: '' }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  for (let i = 0; i < 80; i++) { try { await fetch('http://127.0.0.1:' + port + '/api/health'); break; } catch (e) { await new Promise(r => setTimeout(r, 250)); } }
  const call = async (route, body, token) => { const r = await fetch('http://127.0.0.1:' + port + route, { method: body ? 'POST' : 'GET',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'x-token': token } : {}), body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) {} return { status: r.status, body: j }; };
  const guest = (await call('/api/guest', { deviceId: 'free1135-' + Math.random() })).body.token;
  return { call, guest, stop: () => new Promise(r => { child.once('exit', r); child.kill(); }) };
}
(async () => {
  const A = await boot({});
  try {
    const offers = await A.call('/api/shop/offers', null, A.guest);
    ok(offers.status === 200 && offers.body.freePacks === true, 'the server reports free packs ON');
    const led0 = L((await A.call('/api/ledger', null, A.guest)).body);
    ok(led0.shop && led0.shop.freePacks === true, 'the ledger tells the client (shop.freePacks) so the shop shows FREE');
    const g0 = led0.gems, egp0 = JSON.stringify(led0.patron);
    const buy = await A.call('/api/shop/purchase', { offerId: 'd1200', provider: 'prebeta', requestId: 'f1' }, A.guest);
    ok(buy.status === 200 && buy.body.ok && buy.body.granted.gems === 1200, 'a normal player takes 1,200 diamonds for free');
    ok(buy.body.granted.patron === undefined, 'a free pack does not credit EGP/Patron');
    const led1 = L((await A.call('/api/ledger', null, A.guest)).body);
    ok(led1.gems === g0 + 1200, 'the diamonds are on the server ledger');
    ok(JSON.stringify(led1.patron) === egp0, 'EGP/Patron state unchanged by a free pack');
    const again = await A.call('/api/shop/purchase', { offerId: 'd1200', provider: 'prebeta', requestId: 'f1' }, A.guest);
    ok(L((await A.call('/api/ledger', null, A.guest)).body).gems === g0 + 1200, 'the same request id is not paid twice');
    const plan = await A.call('/api/shop/purchase', { offerId: 'cluster', provider: 'prebeta', requestId: 'f2' }, A.guest);
    ok(plan.body.ok && plan.body.granted.planDays === 14, 'a daily plan (Cluster Pack) is free too: 14 days');
    const paid = await A.call('/api/shop/purchase', { offerId: 'd500', provider: 'test', requestId: 'f3' }, A.guest);
    ok(paid.status === 403, "the dev-only 'test' provider is still closed to players");
  } finally { await A.stop(); }
  const B = await boot({ SHOP_FREE_PACKS: '0' });
  try {
    const off = await B.call('/api/shop/purchase', { offerId: 'd500', provider: 'prebeta', requestId: 'o1' }, B.guest);
    ok(off.status === 403 && /coming soon/i.test(off.body.error || ''), 'switch OFF (December): the free claim is refused, "coming soon"');
    ok((await B.call('/api/shop/offers', null, B.guest)).body.freePacks === false, 'switch OFF: the shop reports freePacks false');
  } finally { await B.stop(); }
  console.log('PASS ' + checks + '  FAIL 0');
})().catch(e => { console.error('FAIL', e.message); console.log('PASS ' + checks + '  FAIL 1'); process.exit(1); });
