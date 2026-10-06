'use strict';
// v1041 the cluster helps itself (Phil 6 Oct 2026: "When ever a server is using less than 30% of its cpu it allots up to 50% of its cpu
// to helping other server" / "node 1-3 will actually allot 100% of their cpu to help main" / "First the server will reach for main and
// node1-3. If the strained server still needs help my cpu will kick in." / "A strained server will never offer help to another
// strained server."). Real server/sim-helper.js processes and real pools on 12 recorded battles:
// - tiers: the cluster helper (tier 1) takes the battles; the PC (tier 2) only when no tier-1 helper can;
// - a dedicated helper serves only its assigned servers; a shared helper's size is its share of the machine;
// - a helper whose home server turns strained refuses, and the battle goes on to the next helper - never lost, never different;
// - the helper list file (release phase switch) takes effect without a restart;
// - a real game server answers /internal/strain on loopback.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net'), http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..'), GAME = path.join(root, 'emberweave-heroes.html');
const HOST = require(path.join(root, 'server/sim-host.js')), POOL = require(path.join(root, 'server/sim-pool.js'));
const BATTLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/battles_1039.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const KEY = 'test-helper-key-' + 'c'.repeat(16), kids = [];
async function startHelper(extra) {
  const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-helper-')), cfg = path.join(dir, 'cfg.json');
  fs.writeFileSync(cfg, JSON.stringify(Object.assign({ key: KEY, port, host: '127.0.0.1', workers: 3, busyCpu: 5 }, extra || {})));
  const child = spawn(process.execPath, [path.join(root, 'server/sim-helper.js')], { env: { ...process.env, SIM_HELPER_CONFIG: cfg }, stdio: 'ignore', windowsHide: true });
  kids.push(child); const url = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 150; i++) { try { const j = await (await fetch(url + '/health')).json(); if (j.ready > 0) return { url, child }; } catch (e) {} await sleep(200); }
  throw Error('helper did not start');
}
const health = async url => (await fetch(url + '/health')).json();
async function waitOk(pool, url, want = true, ms = 12000) { const t = Date.now(); while (Date.now() - t < ms) { const h = (pool.stats.helper.helpers || []).find(x => x.url === url); if (h && h.ok === want) return h; await sleep(200); } return (pool.stats.helper.helpers || []).find(x => x.url === url); }
async function waitReady(pool) { for (let i = 0; i < 150 && !pool.stats.ready; i++) await sleep(200); }
(async () => {
  try {
    const host = HOST.load(GAME), want = BATTLES.map(b => JSON.stringify(host.auto(b.snaps, b.foe, b.seed))), FP = HOST.fingerprint(GAME);
    const one = async (pool, i) => JSON.stringify(await pool.run('auto', [BATTLES[i].snaps, BATTLES[i].foe, BATTLES[i].seed])) === want[i];

    // a fake "home game server" whose strain we control (what /internal/strain answers)
    let homeStrained = false; const sp = await freePort();
    const home = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ strained: homeStrained })); });
    await new Promise(r => home.listen(sp, '127.0.0.1', r));

    const C = await startHelper({ serve: ['1'], role: 'dedicated', strainUrl: 'http://127.0.0.1:' + sp + '/' });   // node, dedicated to server 1
    const PC = await startHelper({});                                                                            // Phil's PC: any server
    const S = await startHelper({ share: 0.5, busyCpu: 5, workers: undefined });                                                     // shared: half the machine
    const hs = await health(S.url);
    ok(hs.limit === Math.max(1, Math.round(os.cpus().length * 0.5)) && hs.role === 'shared', 'shared helper: allots half the machine (' + hs.limit + ' of ' + os.cpus().length + ' CPUs)');

    // tiers: server 1 under strain -> the cluster helper takes them; the PC is not used while the cluster has room
    const P1 = POOL.create(GAME, { size: 1, self: '1', helpers: [{ url: C.url, key: KEY, tier: 1 }, { url: PC.url, key: KEY, tier: 2 }], fp: FP, stressLagMs: 0.000001 });
    await waitReady(P1); await waitOk(P1, C.url); await waitOk(P1, PC.url); await sleep(1500);
    let good = true; for (let i = 0; i < BATTLES.length; i++) good = (await one(P1, i)) && good;
    ok(good && P1.stats.helper.byTier[1] === BATTLES.length && !P1.stats.helper.byTier[2], 'strained server 1: all ' + BATTLES.length + ' battles to the cluster helper, none to the PC (tier 1 first)');

    // the cluster helper's home server turns strained: it refuses; each battle moves on to the PC - none lost, none different
    homeStrained = true; await sleep(2500);
    good = true; for (let i = 0; i < BATTLES.length; i++) good = (await one(P1, i)) && good;
    ok(good && (P1.stats.helper.byTier[2] || 0) >= 1, 'its home server strained: the cluster helper refuses and the PC takes over (' + (P1.stats.helper.byTier[2] || 0) + ' to the PC, ' + P1.stats.helper.nextHelper + ' moved on), identical results');
    ok((await health(C.url)).busy === true && (await health(C.url)).homeStrained === true, 'a strained server offers no help (its helper reports busy)');
    homeStrained = false;

    // dedicated helper: serves only its assigned server
    const P2 = POOL.create(GAME, { size: 1, self: '2', helpers: [{ url: C.url, key: KEY, tier: 1 }], fp: FP, stressLagMs: 0.000001 });
    await waitReady(P2); const h2 = await waitOk(P2, C.url, false, 4000); await sleep(1200);
    good = true; for (let i = 0; i < 4; i++) good = (await one(P2, i)) && good;
    ok(good && h2.why === 'serves others' && P2.stats.helper.sent === 0, 'dedicated to server 1: server 2 is refused (' + h2.why + '), fights its own battles');
    const direct = await fetch(C.url + '/battle', { method: 'POST', headers: { 'x-helper-key': KEY }, body: JSON.stringify({ fp: FP, method: 'auto', args: [BATTLES[0].snaps, BATTLES[0].foe, BATTLES[0].seed], from: '3' }) });
    ok(direct.status === 503, 'a battle sent anyway by another server is refused (503)');

    // the release-phase switch: a helpers file re-read without restart
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ember-phase-')), 'helpers.json'); fs.writeFileSync(file, '[]');
    const P3 = POOL.create(GAME, { size: 1, self: '3', helpersFile: file, key: KEY, fp: FP, stressLagMs: 0.000001 });
    await waitReady(P3); await sleep(1200);
    ok(P3.stats.helper.helpers.length === 0 && (await one(P3, 0)) && P3.stats.helper.sent === 0, 'phase file empty: no helpers, the server fights alone');
    fs.writeFileSync(file, JSON.stringify([{ url: S.url, tier: 1 }]));
    const hf = await waitOk(P3, S.url, true, 12000);
    good = true; for (let i = 0; i < 4; i++) good = (await one(P3, i)) && good;
    ok(hf && hf.ok && good && P3.stats.helper.byTier[1] >= 1, 'phase file rewritten: the new helper is used within one poll, no restart');

    // a real game server answers /internal/strain on loopback
    const port = await freePort(), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-strain-'));
    const srv = spawn(process.execPath, ['server.js'], { cwd: root, stdio: 'ignore', windowsHide: true, env: { ...process.env, PORT: String(port), DB_FILE: path.join(temp, 'db.json'), NODE_ENV: 'test', SIM_WORKERS: '1', SERVER_ID: '1', SERVER_SECRET: 'strain-test' } });
    kids.push(srv); let st = null;
    for (let i = 0; i < 200 && !st; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/internal/strain'); if (r.ok) st = await r.json(); } catch (e) {} if (!st) await sleep(100); }
    ok(st && st.strained === false && typeof st.lagMs === 'number', 'real server: /internal/strain on loopback -> ' + JSON.stringify(st));
    const viaTunnel = await fetch('http://127.0.0.1:' + port + '/internal/strain', { headers: { 'cf-connecting-ip': '203.0.113.9', 'cf-ray': 'x' } });
    ok(viaTunnel.status === 404, 'the same request arriving through the Cloudflare tunnel (cf-* headers) is refused (404)');

    for (const p of [P1, P2, P3]) p.close(); home.close();
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
  finally { for (const k of kids) { try { k.kill(); } catch (e) {} } setTimeout(() => process.exit(), 300); }
})();
