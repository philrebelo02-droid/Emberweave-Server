// v1050 - the diamond shop is server-side (Phil 7 Oct 2026: "Please make the diamonds shop server side" / "So that people receive
// diamonds when they purchase"). Real HTTP against two local servers: an ordinary one (players cannot buy yet - no payment provider)
// and a test-purchase one (SHOP_TEST_PURCHASES=1, the simulation servers). Control: on the v1049 server every purchase/claim check fails.
'use strict';
const assert = require('assert'), cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
const root = path.resolve(__dirname, '..');
const L = b => (b && b.ledger) || b;   // /api/ledger answers the view itself
let checks = 0; const ok = (c, m) => { assert(c, m); checks++; };
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
async function boot(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-shop1050-')), port = await freePort();
  const child = cp.spawn(process.execPath, ['server.js'], { cwd: root, env: Object.assign({}, process.env, { PORT: String(port), DB_FILE: path.join(dir, 'db.json'),
    SIM_WORKERS: '0', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', DB_STORE: '', DATABASE_URL: '' }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', d => log += d); child.stderr.on('data', d => log += d);
  for (let i = 0; i < 80; i++) { try { await fetch('http://127.0.0.1:' + port + '/api/health'); break; } catch (e) { await new Promise(r => setTimeout(r, 250)); } }
  const call = async (route, body, token) => { const r = await fetch('http://127.0.0.1:' + port + route, { method: body ? 'POST' : 'GET',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'x-token': token } : {}), body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) {} return { status: r.status, body: j }; };
  const guest = (await call('/api/guest', { deviceId: 'shop1050-' + Math.random() })).body.token;
  return { call, guest, stop: () => new Promise(r => { child.once('exit', r); child.kill(); }), log: () => log };
}
(async () => {
  // 1. an ordinary server: a player cannot buy (no payment provider yet), and the old free plan claim is closed
  const A = await boot({});
  try {
    const offers = await A.call('/api/shop/offers', null, A.guest);
    ok(offers.status === 200 && offers.body.offers.length === 6, 'the server lists the six offers');
    ok(offers.body.offers.some(o => o.id === 'cluster' && o.kind === 'plan' && o.amount === 150 && o.days === 14), 'Cluster Pack = 150 a day for 14 days');
    ok(offers.body.offers.some(o => o.id === 'burger' && o.plan === 'stamina' && o.amount === 120 && o.days === 30), 'Burger Meal = 120 stamina a day for 30 days');
    const buy = await A.call('/api/shop/purchase', { offerId: 'd500', provider: 'test', requestId: 'p1' }, A.guest);
    ok(buy.status === 403 && /coming soon/i.test(buy.body.error || ''), 'a player cannot buy without a verified payment');
    const fake = await A.call('/api/shop/purchase', { offerId: 'd500', provider: 'appstore', receipt: 'x', requestId: 'p2' }, A.guest);
    ok(fake.status === 403, 'an unverified store receipt credits nothing');
    const g0 = L((await A.call('/api/ledger', null, A.guest)).body).gems;
    const hole1 = await A.call('/api/tx/earn', { what: 'gems', reason: 'pack', amount: 150, requestId: 'h1' }, A.guest);
    const hole2 = await A.call('/api/tx/earn', { what: 'stamina', reason: 'pack', amount: 120, requestId: 'h2' }, A.guest);
    ok(!(hole1.body && hole1.body.ok) && !(hole2.body && hole2.body.ok), "the old 'pack' earn (free diamonds and stamina) is refused");
    ok(L((await A.call('/api/ledger', null, A.guest)).body).gems === g0, 'no diamonds moved');
    const claim0 = await A.call('/api/shop/plan-claim', { requestId: 'c0' }, A.guest);
    ok(claim0.body.ok === false, 'nothing to claim without a purchase');
  } finally { await A.stop(); }

  // 2. a test-purchase server (the simulations): purchases are credited by the server
  const B = await boot({ SHOP_TEST_PURCHASES: '1' });
  try {
    const led0 = L((await B.call('/api/ledger', null, B.guest)).body);
    const d1 = await B.call('/api/shop/purchase', { offerId: 'd1200', provider: 'test', requestId: 'b1' }, B.guest);
    ok(d1.body.ok && d1.body.granted.gems === 1200, 'a diamond pack credits its diamonds at once');
    ok(d1.body.ledger.gems === led0.gems + 1200, 'the ledger holds them');
    const again = await B.call('/api/shop/purchase', { offerId: 'd1200', provider: 'test', requestId: 'b1' }, B.guest);
    ok(again.body.ledger.gems === led0.gems + 1200, 'a re-sent purchase (same request id) is not paid twice');
    const c1 = await B.call('/api/shop/purchase', { offerId: 'cluster', provider: 'test', requestId: 'b2' }, B.guest);
    ok(c1.body.ok && c1.body.granted.planDays === 14 && c1.body.plans.gems.daysLeft === 14 && c1.body.plans.gems.ready === true, 'the Cluster Pack adds 14 days, ready today');
    const c2 = await B.call('/api/shop/purchase', { offerId: 'cluster', provider: 'test', requestId: 'b3' }, B.guest);
    ok(c2.body.plans.gems.daysLeft === 28, 'buying it again adds the days');
    const m1 = await B.call('/api/shop/purchase', { offerId: 'burger', provider: 'test', requestId: 'b4' }, B.guest);
    ok(m1.body.plans.stamina.daysLeft === 30, 'the Burger Meal adds 30 days of stamina');
    const before = L((await B.call('/api/ledger', null, B.guest)).body);
    const cl = await B.call('/api/shop/plan-claim', { requestId: 'cl1' }, B.guest);
    ok(cl.body.ok && cl.body.paid.gems === 150 && cl.body.paid.stamina === 120, 'one claim pays both plans for today');
    ok(cl.body.ledger.gems === before.gems + 150, 'the claimed diamonds are on the ledger');
    ok(cl.body.plans.gems.daysLeft === 27 && cl.body.plans.stamina.daysLeft === 29 && !cl.body.plans.gems.ready, 'one day used from each; not ready again today');
    const cl2 = await B.call('/api/shop/plan-claim', { requestId: 'cl2' }, B.guest);
    ok(cl2.body.ok === false, 'a second claim the same day pays nothing');
    const view = L((await B.call('/api/ledger', null, B.guest)).body).plans;
    ok(view && view.gems.daysLeft === 27 && view.stamina.daysLeft === 29, 'the ledger view carries the plans');
    ok(!(await B.call('/api/shop/purchase', { offerId: 'nope', provider: 'test', requestId: 'b5' }, B.guest)).body.ok, 'an unknown offer is refused');
  } finally { await B.stop(); }

  // 3. the client routes purchases and plan claims through the server
  const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
  ok(/api\('\/api\/shop\/purchase','POST',\{offerId:o\.id/.test(html), 'the buy confirms through /api/shop/purchase');
  ok(html.includes("api('/api/shop/plan-claim'"), 'plans are claimed from the server');
  ok(html.includes('LED.st.plans') && !/txEarnP\(\(p\.type==='gems'\?'gems':'stamina'\), p\.amount, 'pack'\)/.test(html), "the Quest log reads the server's plans; the old pack earn call is gone");
  console.log('shop 1050: ' + checks + ' checks pass');
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
