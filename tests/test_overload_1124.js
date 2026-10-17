'use strict';
// v1124 overload protection (load test 11 Oct 2026: past ~1900 players the fight-check queue outgrew its drain, resolves waited in it,
// the main thread fell back to fighting replays itself and the server never recovered). One battle worker (SIM_WORKERS=1) and 400
// players looping campaign start -> resolve is far more than one worker can check:
//  - resolves answer from the player's result within ~SIM_RESOLVE_WAIT_MS (no 30-60 s waits, no failures), checks finish later or
//    are shed and marked 'skipped' (recording kept), and no replay ever runs on the main thread;
//  - a probe (GET /api/ledger) stays answered during the overload, and when the load stops the server is quiet within seconds;
//  - control: the same load on 103eb989 (before this fix) leaves resolves waiting in the queue for many seconds.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net'), crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const WS = require(path.join(root, 'server/world-store.js'));
const CONTROL = '103eb989';
const servers = [];
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
const SQUAD = ['vael', 'sylthaine', 'vireo'];
const WON = JSON.stringify({ t: 60, won: true, stars: 3, wave: 2, u: SQUAD.map(k => [k, 'ally', 1, 500, 0, 100, 100]) });
const N = 400, LOAD_MS = 15000;
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

async function server(script, db) {
  const port = await freePort(), base = 'http://127.0.0.1:' + port; let child;
  const req = async (method, route, data, token, tmo) => { const t0 = Date.now();
    try { const r = await fetch(base + route, { method, headers: { ...(token ? { 'x-token': token } : {}), ...(data ? { 'content-type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(tmo || 60000) });
      return { status: r.status, body: await r.json().catch(() => ({})), ms: Date.now() - t0 }; } catch (e) { return { status: 0, body: {}, ms: Date.now() - t0 }; } };
  const start = async adminId => {
    child = spawn(process.execPath, [script], { cwd: path.dirname(script), windowsHide: true, stdio: 'ignore', env: { ...process.env, PORT: String(port), DB_FILE: db, ADMIN_IDS: adminId || '',
      DB_STORE: 'split', NODE_ENV: 'test', SIM_WORKERS: '1', REG_PER_MIN: '1000', REG_ACCOUNTS_PER_IP: '1000', SERVER_SECRET: 'overload-secret', RL_MUL: '1000' } });
    for (let i = 0; i < 300; i++) { if (child.exitCode !== null) throw Error('server exited'); try { if ((await fetch(base + '/health')).ok) break; } catch (_) {} await sleep(100); }
    await sleep(3000);   // the battle worker loads the engine
  };
  const kill = async () => { if (!child) return; const c = child; child = null; c.kill('SIGKILL'); await Promise.race([new Promise(r => c.once('exit', r)), sleep(3000)]); };
  const S = { req, start, kill }; servers.push(S); return S;
}
async function world(dir) {   // N players with full stamina and tokens, cloned from one registered account
  const db = path.join(dir, 'db.json'), S = await server(path.join(root, 'server.js'), db);
  await S.start('');
  const adm = (await S.req('POST', '/api/register', { name: 'olAdm', pass: 'password1' })).body;
  const tpl = (await S.req('POST', '/api/register', { name: 'olTpl', pass: 'password1' })).body;
  await S.req('GET', '/api/ledger', null, tpl.token); await sleep(600); await S.kill();
  const w = WS.readWorld(db), base = w.users[tpl.profile.id], players = [];
  for (let i = 0; i < N + 1; i++) { const id = 'olp' + String(i).padStart(4, '0'), u = JSON.parse(JSON.stringify(base)); u.id = id; u.name = 'olPlayer' + i; u.led.stam = { v: 999, ts: Date.now() };
    w.users[id] = u; w.byName[u.name.toLowerCase()] = id; const raw = crypto.randomBytes(16).toString('hex');
    w.tokens[crypto.createHash('sha256').update(raw).digest('hex')] = { id, iat: Date.now(), exp: Date.now() + 86400000 }; players.push({ id, token: raw }); }
  WS.writeWorld(db, w);
  return { db, adminId: adm.profile.id, players };
}
async function overload(S, W, tag) {
  let stop = false; const res = [], probe = [];
  const loop = async (p, i) => { let n = 0; while (!stop) {
    const s = await S.req('POST', '/api/campaign/start', { mode: 'normal', node: 1, heroIds: SQUAD, requestId: tag + i + '-' + n + 's' }, p.token);
    if (s.status !== 200) { await sleep(300); continue; }
    const r = await S.req('POST', '/api/campaign/resolve', { attemptId: s.body.attemptId, requestId: tag + i + '-' + n + 'r', inputLog: [[1, 'auto', -1, 1]], digest: WON, won: true, stars: 3 }, p.token);
    res.push({ ms: r.ms, ok: r.status === 200, pending: r.body && r.body.verify === 'pending' }); n++; } };
  const pr = W.players[N];
  const probing = (async () => { while (!stop) { probe.push((await S.req('GET', '/api/ledger', null, pr.token)).ms); await sleep(1000); } })();
  const loops = W.players.slice(0, N).map(loop);
  await sleep(LOAD_MS); stop = true; const stoppedAt = Date.now();
  await Promise.race([Promise.all(loops), sleep(90000)]); await probing;
  const drainMs = Date.now() - stoppedAt;
  let quietAt = null; for (let i = 0; i < 30; i++) { const q = await S.req('GET', '/api/ledger', null, pr.token); if (q.ms < 200) { quietAt = Date.now() - stoppedAt; break; } await sleep(500); }
  return { res, probe, drainMs, quietAt };
}

(async () => {
  let tmpCtl = null, ctlSha = null;   /* v1181: the control runs in its own commit's tree (its server/ data too) - a lone old server.js broke on today's data (veteran portal 160 stages) */
  try {
    const W = await world(fs.mkdtempSync(path.join(os.tmpdir(), 'ember-overload-')));
    const S = await server(path.join(root, 'server.js'), W.db); await S.start(W.adminId);
    const r = await overload(S, W, 'f');
    const at = (await S.req('POST', '/api/login', { name: 'olAdm', pass: 'password1' })).body.token;
    const st = (await S.req('GET', '/api/dev/save-stats', null, at)).body.battles || {};
    await sleep(15000);   // idle: the backlog drains
    const st2 = (await S.req('GET', '/api/dev/save-stats', null, at)).body.battles || {};
    await S.kill();
    const ms = r.res.map(x => x.ms), pend = r.res.filter(x => x.pending).length;
    console.log('  --  fixed: ' + r.res.length + ' resolves, p50 ' + pct(ms, 0.5) + ' ms, p95 ' + pct(ms, 0.95) + ' ms, max ' + Math.max(...ms) + ' ms; ' + pend + ' answered before their check; probe max ' + Math.max(...r.probe) + ' ms; quiet ' + r.quietAt + ' ms after the load stopped; checks ' + JSON.stringify(st.verify) + ', pool shed ' + (st.pool && st.pool.shed) + ', main-thread replays ' + st.mainThread);
    ok(r.res.length > N && r.res.every(x => x.ok), 'every resolve answered 200 under the overload (' + r.res.length + ')');
    ok(pct(ms, 0.95) < 6000 && pend > 0, 'resolves do not wait for the overloaded check queue (p95 ' + pct(ms, 0.95) + ' ms; ' + pend + ' answered first, checked later)');
    ok(st.mainThread === 0, 'no replay ran on the main thread (' + st.mainThread + ')');
    const v = st.verify || {}, v2 = st2.verify || {};
    ok(v.queued > 0 && v.backlog + v.inFlight + v.attached + v.accepted + v.flagged >= v.queued, 'no check is lost: every fight answered first is checked or waiting in the backlog (' + JSON.stringify(v) + ')');
    const left = x => x.backlog + x.attached + x.inFlight;
    ok(left(v2) < left(v) && v2.accepted + v2.flagged > v.accepted + v.flagged, 'the backlog drains once the load stops (' + left(v) + ' -> ' + left(v2) + ' waiting in 15 s, ' + (v2.accepted + v2.flagged - v.accepted - v.flagged) + ' checked on one worker)');
    ok(r.quietAt !== null && r.quietAt < 10000, 'the server is quiet again ' + r.quietAt + ' ms after the load stops');

    let src = null; try { src = execFileSync('git', ['show', CONTROL + ':server.js'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }); } catch (e) {}
    if (!src) console.log('  --  control skipped: git cannot read ' + CONTROL);
    else {
      ctlSha = CONTROL; tmpCtl = path.join(require('./helpers/split-rig.cjs').controlTree(ctlSha), 'server.js');
      execFileSync(process.execPath, [path.join(root, 'server/world-store.js'), 'downgrade', W.db], { stdio: 'ignore' });   /* v1181: the control's own store reads split-v1 only (the rollback step) */ const C = await server(tmpCtl, W.db); await C.start(W.adminId);
      const c = await overload(C, W, 'c'); await C.kill();
      const cms = c.res.map(x => x.ms);
      console.log('  --  control ' + CONTROL + ': ' + c.res.length + ' resolves, p50 ' + pct(cms, 0.5) + ' ms, p95 ' + pct(cms, 0.95) + ' ms; probe max ' + Math.max(...c.probe) + ' ms; quiet ' + c.quietAt + ' ms after');
      ok(pct(cms, 0.95) > 2 * pct(ms, 0.95) && c.res.length < r.res.length, 'control: before the fix resolves wait in the check queue (p95 ' + pct(cms, 0.95) + ' ms, ' + c.res.length + ' resolves in the same time)');
    }
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
  finally { for (const s of servers) await s.kill().catch(() => {}); try { if (ctlSha) require('./helpers/split-rig.cjs').removeControlTree(ctlSha); } catch (e) {} }
})();
