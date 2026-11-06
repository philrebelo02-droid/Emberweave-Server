// v1291 (Phil 6 Nov: "setup a $1 pack in the shop that isnt free name it TEST PACK (REAL PURCHASE DONT CLICK), make it legit and
// not free so I can buy it myself and see if it goes to my bank"): the 'testpack' offer is real money only. It is listed at $1.00
// with real:true, the free pre-beta claim and the dev/test grant both refuse it, and Google Play refuses it while no Play key is
// configured. Every other pack stays free. Control: AUD_SERVER=<the v1290 server.js copied into the repo root> must FAIL.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), srvFile = process.env.AUD_SERVER || 'server.js', dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-testpack-'));
let port, base, child, token, pass = 0, missed = [];
const ok = (c, m) => { if (process.env.AUD_SERVER && !c) { missed.push(m); return; } assert(c, m); pass++; };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start() { const env = { ...process.env, ALLOW_NEW_GUESTS: '1', DATABASE_URL: '', PORT: String(port), DB_FILE: path.join(dir, 'db.json'), SHOP_TEST_PURCHASES: '1' };
  delete env.GOOGLE_PLAY_SA_KEY; delete env.SHOP_FREE_PACKS;
  child = spawn(process.execPath, [srvFile], { cwd: root, env, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); } throw Error('no start'); }
async function stop() { if (!child) return; child.kill(); for (let i = 0; i < 60 && child.exitCode === null; i++) await delay(50); child = null; }
async function call(route, data) { const r = await fetch(base + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-token': token }, body: data ? JSON.stringify(data) : undefined });
  let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, data: j }; }
(async () => { try {
  port = await freePort(); base = 'http://127.0.0.1:' + port; await start();
  const g = await call('/api/guest', { deviceId: 'testpack-' + Date.now() }); token = g.data.token; await call('/api/ledger');
  const offers = (await call('/api/shop/offers')).data;
  const tp = (offers.offers || []).find(o => o.id === 'testpack');
  ok(tp && tp.price === '$1.00' && tp.real === true && tp.name === 'TEST PACK (REAL PURCHASE DONT CLICK)', 'the $1 TEST PACK is listed as real (' + JSON.stringify(tp) + ')');
  ok(offers.freePacks === true && offers.playBillingReal === false, 'free packs stay on; real billing reports off with no Play key');
  const gems0 = ((await call('/api/ledger')).data.ledger || {}).gems | 0;
  const free = await call('/api/shop/purchase', { offerId: 'testpack', provider: 'prebeta', requestId: 'tp1' });
  ok(free.status === 403 && /real purchase/i.test(free.data.error || ''), 'the free pre-beta claim refuses it (' + JSON.stringify(free.data).slice(0, 90) + ')');
  const test = await call('/api/shop/purchase', { offerId: 'testpack', provider: 'test', requestId: 'tp2' });
  ok(test.status === 403, 'the test/dev grant refuses it even with SHOP_TEST_PURCHASES=1 (' + test.status + ')');
  const play = await call('/api/shop/buy', { provider: 'play', sku: 'testpack', purchaseToken: 'fake-token-123', requestId: 'tp3' });
  ok(play.status === 403 && /not switched on/i.test(play.data.error || ''), 'Google Play refuses it while no Play key is set (' + (play.data.error || '') + ')');
  const gems1 = ((await call('/api/ledger')).data.ledger || {}).gems | 0;
  ok(gems1 === gems0, 'no diamonds were granted by any refused route (' + gems0 + ' -> ' + gems1 + ')');
  const other = await call('/api/shop/purchase', { offerId: 'd500', provider: 'prebeta', requestId: 'tp4' });
  ok(other.status === 200 && other.data.ok === true, 'every other pack is still free (600 Diamonds claimed)');
  const src = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
  ok(/id:'testpack', price:'\$1\.00', img:'d500', real:true/.test(src) && /free&&!o\.real\?t\('shop\.free_caps'\)/.test(src) && /GEM_OFFERS\[i\]\.real\) return playBilling\.buy/.test(src),
     'the shop card shows $1.00 (never FREE) and buying goes only through Google Play');
  if (process.env.AUD_SERVER) { console.log('CONTROL: ' + missed.length + ' check(s) failed as expected on the old server'); process.exit(missed.length ? 0 : 1); }
  console.log('test_testpack_1291.js: ' + pass + ' checks passed');
} catch (e) { console.error(e); process.exitCode = 1; } finally { await stop(); } })();
