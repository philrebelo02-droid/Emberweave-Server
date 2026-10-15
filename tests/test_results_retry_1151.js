/* v1151 - TRIALS, ELITE, GAUNTLET (and the Vault's wording) ARE SAFE AGAINST A LOST REPLY.
   Phil 15 Oct 2026, pre-beta: "Players trying 50 times and then seeing defeat, its bad". v1145/v1150 made the campaign safe; the
   proof sweep found the Island of Trials (Training Province, Tower of Trials), the legacy dungeon trial, the Elite screen and the
   Gauntlet bonus stages still sent their result once (Gauntlet with no requestId at all), and showed the raw word "offline".
   A. LIVE HTTP (throwaway server): per mode, the SAME requestId sent twice answers the same receipt and pays ONCE
      (Tower ascend, Training Province resolve, dungeon trial resolve, Gauntlet /api/bonus/resolve, retired Elite route).
      Gauntlet also: an old client without a requestId still resolves; a bad requestId is refused.
   B. REAL PAGE (Chromium, muted, timers >=1 s shortened): per mode, the result route answers with scripted replies -
      a lost first reply then the receipt shows the mode's VICTORY title; an error on a WIN shows NOT COUNTED (never DEFEAT,
      never the word "offline"); a real loss still shows DEFEAT; every send of one fight carries ONE requestId.
   C. CONTROL: the same test run against v1150 (9f4d79aa, a temporary worktree) must FAIL.
   Asserts (non-zero exit). EW_ROOT=<tree> runs A+B against another tree (used by C). */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), net = require('net');
const { spawn, spawnSync } = require('child_process');
const root = process.env.EW_ROOT ? path.resolve(process.env.EW_ROOT) : path.join(__dirname, '..');
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
let pass = 0, fail = 0; const ck = (n, c, d) => { c ? (pass++, console.log('  ok ' + n)) : (fail++, console.log('  x  ' + n + (d ? ' - ' + d : ''))); };

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew1151-')), dbFile = path.join(temp, 'db.json');
let port, base, child, token = '';
async function start() { const env = { ...process.env, ALLOW_NEW_GUESTS: '1', PORT: String(port), DB_FILE: dbFile, DATABASE_URL: '', SIM_WORKERS: '0', NODE_ENV: '' }; delete env.CLOCK_FILE;
  child = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 300; i++) { if (child.exitCode !== null) throw new Error('throwaway server exited'); try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); }
  throw new Error('server did not start'); }
async function stop() { if (!child) return; child.kill(); for (let i = 0; i < 40 && child.exitCode === null; i++) await delay(50); child = null; }
async function call(route, data) { const r = await fetch(base + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-token': token }, body: data ? JSON.stringify(data) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) }; }
const gold = async () => { const l = (await call('/api/ledger')).data; return (l.ledger || l).gold; };
const strip = d => { const o = Object.assign({}, d); delete o.ledger; return JSON.stringify(o); };

async function httpLayer() {
  console.log('== A. same requestId = paid once (live server) ==');
  const g = await call('/api/guest', { deviceId: 'rr1151-' + Date.now() }); token = g.data.token; const id = g.data.profile.id;
  await call('/api/tower/state', { legacyFloor: 0 });
  await delay(400); await stop();
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')), u = db.users[id];
  const keys = Object.keys(require(path.join(root, 'server', 'sim.js')).HERO_BASE).slice(0, 5);
  u.led.px = 99000000; for (const k of keys) u.led.unlocked[k] = true; u.team = keys.map(k => ({ key: k }));
  u.led.tower = { floor: 0, trib: '', mig: 1, srv: 0 };
  u.led.camp = Object.assign({}, u.led.camp || {}, { cleared: 30 });
  const assign = { 1: [keys[0]], 2: [keys[1]], 3: [keys[2]] };
  u.led.bonus = { done: {}, ts: Date.now(), att: { id: 'bx-rid', stage: '1-3', startedAt: Date.now() - 120000, level: 50, assign, seed: 7, windowsSeen: 4 } };
  fs.writeFileSync(dbFile, JSON.stringify(db));
  await start();

  // Tower of Trials
  { const g0 = await gold(); const a = await call('/api/tower/ascend', { requestId: 'tower:floor:1' }); const g1 = await gold();
    const b = await call('/api/tower/ascend', { requestId: 'tower:floor:1' }); const g2 = await gold();
    ck('Tower: the floor-1 climb is booked', a.data && a.data.ok === true && a.data.floor === 1, JSON.stringify(a.data).slice(0, 120));
    ck('Tower: same requestId answers the same receipt and pays once', b.data && strip(b.data) === strip(a.data) && g1 > g0 && g2 === g1, g0 + ' -> ' + g1 + ' -> ' + g2); }

  // Training Province (Island of Trials)
  { const s = await call('/api/province/start', { requestId: 'rr-prov-start', type: 'gold', stage: 1, heroIds: [keys[0]] });
    const body = { requestId: 'rr-prov-win', attemptId: s.data && s.data.attemptId, won: true, stars: 3, digest: JSON.stringify({ won: true, t: 1, u: [{}] }), inputLog: [] };
    const g0 = await gold(); const a = await call('/api/province/resolve', body); const g1 = await gold();
    const b = await call('/api/province/resolve', body); const g2 = await gold();
    ck('Province: the witnessed win is booked', s.status === 200 && a.data && a.data.ok === true && a.data.won === true, JSON.stringify(a.data).slice(0, 120));
    ck('Province: same requestId answers the same receipt and pays once', b.data && strip(b.data) === strip(a.data) && g1 > g0 && g2 === g1, g0 + ' -> ' + g1 + ' -> ' + g2); }

  // legacy dungeon trial (/api/trial/resolve)
  { const body = { kind: 'dungeon', floor: 1, heroIds: keys, requestId: 'rr-trial-1' };
    const g0 = await gold(); const a = await call('/api/trial/resolve', body); const g1 = await gold();
    const b = await call('/api/trial/resolve', body); const g2 = await gold();
    ck('Trial: the floor answers a receipt', a.data && a.data.ok === true && typeof a.data.won === 'boolean', JSON.stringify(a.data).slice(0, 120));
    ck('Trial: same requestId answers the same receipt and pays once', b.data && strip(b.data) === strip(a.data) && g2 === g1 && (a.data.won ? g1 >= g0 : g1 === g0), g0 + ' -> ' + g1 + ' -> ' + g2 + ' won ' + (a.data && a.data.won)); }

  // Elite screen route: retired - every send pays nothing
  { const g0 = await gold(); const a = await call('/api/elite/resolve', { node: 3, heroIds: keys, requestId: 'rr-elite' }); const b = await call('/api/elite/resolve', { node: 3, heroIds: keys, requestId: 'rr-elite' }); const g1 = await gold();
    ck('Elite: the retired route answers 410 to both sends and pays nothing', a.status === 410 && b.status === 410 && g1 === g0, a.status + '/' + b.status + ' ' + g0 + '->' + g1); }

  // Gauntlet (/api/bonus/resolve)
  { const body = { attemptId: 'bx-rid', requestId: 'rr-bonus-1', lanesCleared: 3, lanesLost: 0, heroesLost: 0 };
    const bad = await call('/api/bonus/resolve', Object.assign({}, body, { requestId: 12345 }));
    ck('Gauntlet: a non-string requestId is refused (400)', bad.status === 400, bad.status + ' ' + JSON.stringify(bad.data).slice(0, 80));
    const a = await call('/api/bonus/resolve', body); const b = await call('/api/bonus/resolve', body);
    ck('Gauntlet: the won run is booked as a first clear', a.status === 200 && a.data && a.data.ok === true && a.data.won === true && a.data.firstClear === true, a.status + ' ' + JSON.stringify(a.data).slice(0, 140));
    ck('Gauntlet: same requestId answers the same receipt (not "No matching bonus run.")', b.status === 200 && b.data && strip(b.data) === strip(a.data), b.status + ' ' + JSON.stringify(b.data).slice(0, 120)); }
  await delay(400); await stop();
  { const d = JSON.parse(fs.readFileSync(dbFile, 'utf8')), L = d.users[id].led;
    const n = (L.txs || []).filter(t => t.src === 'bonus:clear:1-3').length;
    ck('Gauntlet: the first clear is paid once (one bonus:clear tx)', n === 1, 'txs ' + n);
    // an old client (no requestId) still resolves on the old path
    L.bonus.att = { id: 'bx-old', stage: '1-4', startedAt: Date.now() - 120000, level: 50, assign, seed: 9, windowsSeen: 4 };
    fs.writeFileSync(dbFile, JSON.stringify(d)); }
  await start();
  { const r = await call('/api/bonus/resolve', { attemptId: 'bx-old', lanesCleared: 2, lanesLost: 1, heroesLost: 1 });
    ck('Gauntlet: an old client without a requestId still resolves', r.status === 200 && r.data && r.data.ok === true && r.data.won === true, r.status + ' ' + JSON.stringify(r.data).slice(0, 100)); }
}

/* ---------- B. the page ---------- */
const LOST = [503, { error: 'Server 1 is down right now - your other servers are still open.', serverDown: 1 }];
const E500 = [500, { error: 'server error' }];
const MODES = {
  province: { route: '/api/province/resolve', win: 'STAGE 1 CLEARED',
    receipt: { ok: true, type: 'gold', won: true, stage: 1, stars: 3, cleared: 1, reward: null, playsLeft: 1 },
    loss: { ok: true, type: 'gold', won: false, stage: 1, stars: 0, cleared: 0, reward: null },
    refuse: [400, { ok: false, error: 'No matching province battle.' }],
    setup: () => { CUR = { mode: 'province', attemptId: 'att-p', prov: { t: 'gold', stage: 1 } }; } },
  dungeon: { route: '/api/trial/resolve', win: 'DUNGEON CLEARED',
    receipt: { ok: true, won: true, first: true, best: 1, reward: { gold: 120 }, mats: null },
    loss: null, refuse: [400, { ok: false, error: 'Clear the previous floor first.' }],
    setup: () => { CUR = { mode: 'dungeon' }; } },
  elite: { route: '/api/elite/resolve', win: 'ELITE CLEARED',
    receipt: null, loss: null, refuse: [410, { ok: false, error: 'Elite stages are played from the Campaign map.' }],
    setup: () => { const k = Object.keys(HERO_TYPES)[0]; CUR = { mode: 'elite', eliteKey: k, node: 3, oppName: 'Guard' }; } },
  vault: { route: '/api/dungeon/resolve-battle', win: 'FLOOR 1 CLEARED',
    receipt: { ok: true, result: { won: true }, reward: { fragments: [], gearFragments: [], dust: 5 }, progress: {} },
    loss: { ok: true, result: { won: false, playerTruth: true }, progress: {} },
    refuse: [400, { ok: false, error: 'No matching Vault battle.' }],
    setup: () => { ACC.id = ACC.id || 'rr1151-acct'; CUR = { mode: 'vault', attemptId: 'att-v', floor: 1 }; } },
};

async function pageLayer() {
  console.log('== B. the result screen (real page) ==');
  let b;
  try {
    try { b = await chromium.launch({ args: ['--mute-audio'] }); } catch (e) { b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] }); }
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript(() => { const P = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : (k === Symbol.toPrimitive ? () => 0 : (['value', 'currentTime', 'sampleRate'].includes(k) ? 0 : P)), apply: () => P, construct: () => P, set: () => true });
      window.AudioContext = function () { return P; }; window.webkitAudioContext = window.AudioContext; });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof endBattle === 'function' && typeof api === 'function', null, { timeout: 60000 });
    await delay(1500);
    // the in-page harness: scripted replies for one route (last repeats), the requestIds sent, timers of >=1 s shortened
    await pg.evaluate(() => {
      window.__rr = { real: window.fetch, st: window.setTimeout };
      window.__rrArm = (route, replies) => { const S = { n: 0, rids: [] };
        window.fetch = function (u, o) { if (String(u).indexOf(route) >= 0) { let body = {}; try { body = JSON.parse(o.body); } catch (_) {} S.rids.push(body.requestId);
            const [st, rb] = replies[Math.min(S.n++, replies.length - 1)];
            return Promise.resolve(new Response(JSON.stringify(rb), { status: st, headers: { 'content-type': 'application/json' } })); }
          if (/\/api\/(ledger|bonus\/window|dungeon\/status)/.test(String(u))) return Promise.resolve(new Response('{"ok":true,"windowsSeen":4}', { status: 200, headers: { 'content-type': 'application/json' } }));
          return window.__rr.real.apply(this, arguments); };
        window.setTimeout = function (f, ms, ...a) { return window.__rr.st.call(window, f, (ms >= 1000 ? 5 : ms), ...a); };
        return S; };
      window.__rrDisarm = () => { window.fetch = window.__rr.real; window.setTimeout = window.__rr.st; };
    });
    const runBattle = (mode, won, replies) => pg.evaluate(async ({ mode, won, replies, setupSrc }) => {
      const S = window.__rrArm(MODEROUTE[mode], replies);
      ACC.token = window.__rrTok; (new Function(setupSrc))();
      units = []; ended = false; state = 'battle';
      const el = document.getElementById('resultTitle'); el.textContent = ''; document.getElementById('resultReward').textContent = '';
      document.getElementById('result').classList.remove('active');
      const titles = []; const mo = new MutationObserver(() => titles.push(el.textContent)); mo.observe(el, { childList: true, characterData: true, subtree: true });
      endBattle(won);
      for (let i = 0; i < 300 && !(document.getElementById('result').classList.contains('active') && el.textContent); i++) await new Promise(r => window.__rr.st.call(window, r, 50));
      await new Promise(r => window.__rr.st.call(window, r, 200)); mo.disconnect();
      const out = { title: el.textContent, titles, calls: S.n, rids: S.rids, reward: (document.getElementById('resultReward').textContent || '').slice(0, 200) };
      window.__rrDisarm(); try { localStorage.removeItem('ew_vaultPending_' + ACC.id); } catch (_) {} try { show('home'); } catch (_) {} return out;
    }, { mode, won, replies, setupSrc: '(' + MODES[mode].setup.toString() + ')()' });
    await pg.evaluate(t => { window.__rrTok = t; }, token);   // the guest from layer A: a real session, so a real call never signs the page out mid-case
    await pg.evaluate(m => { window.MODEROUTE = m; }, Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, v.route])));
    const oneRid = g => g.rids.length > 0 && g.rids.every(x => typeof x === 'string' && x && x === g.rids[0]);
    const noDefeat = g => !g.titles.some(t => /DEFEAT/.test(t)) && !/DEFEAT/.test(g.title);
    const noOffline = g => !/\boffline\b/i.test(g.reward);
    for (const [mode, M] of Object.entries(MODES)) {
      if (M.receipt) { const g = await runBattle(mode, true, [LOST, [200, M.receipt]]);
        ck(mode + ': won + lost first reply, then the receipt -> ' + M.win + ' (one requestId)', g.title === M.win && oneRid(g) && g.calls >= 2 && noDefeat(g), JSON.stringify(g).slice(0, 260)); }
      { const g = await runBattle(mode, true, [LOST]);
        const want = mode === 'vault' ? M.win : 'NOT COUNTED';
        ck(mode + ': won + every reply lost -> ' + want + ', plain words, never DEFEAT / "offline"', g.title === want && oneRid(g) && g.calls >= 7 && noDefeat(g) && noOffline(g) && (mode === 'vault' ? /Victory saved/.test(g.reward) : /Connection lost before the server answered/.test(g.reward)), JSON.stringify(g).slice(0, 260)); }
      { const g = await runBattle(mode, true, [E500]);
        const want = mode === 'vault' ? M.win : 'NOT COUNTED';
        ck(mode + ': won + 500 -> ' + want + ', never DEFEAT', g.title === want && noDefeat(g) && noOffline(g), JSON.stringify(g).slice(0, 220)); }
      { const g = await runBattle(mode, true, [M.refuse]);
        ck(mode + ': won + the server refuses -> NOT COUNTED, never DEFEAT', g.title === 'NOT COUNTED' && noDefeat(g) && noOffline(g), JSON.stringify(g).slice(0, 220)); }
      { const g = await runBattle(mode, false, [[200, M.loss || { ok: true, won: false }]]);
        const want = mode === 'vault' ? 'THE VAULT HOLDS' : 'DEFEAT';
        ck(mode + ': a real loss -> ' + want, g.title === want, JSON.stringify(g).slice(0, 200)); }
    }
    // Tower of Trials climb (a power ladder, no battle screen): a lost reply is re-sent and the receipt books the floor
    { const t = await pg.evaluate(async () => { const out = {};
        const rec = { ok: true, floor: 1, gold: 500, gems: 0, elite: false, nextReq: 1 };
        let S = window.__rrArm('/api/tower/ascend', [[503, { error: 'down', serverDown: 1 }], [200, rec]]);
        ACC.token = window.__rrTok; G.tower = { floor: 0, trib: '' };
        const a = await towerAscend(); out.a = { win: !!a.win, floor: a.floor, calls: S.n, rids: S.rids }; window.__rrDisarm();
        S = window.__rrArm('/api/tower/ascend', [[503, { error: 'down', serverDown: 1 }]]); G.tower = { floor: 0, trib: '' };
        const b2 = await towerAscend(); out.b = { pending: !!b2.pending, msg: String(b2.msg || ''), calls: S.n }; window.__rrDisarm(); return out; });
      ck('Tower: lost first reply, then the receipt -> the floor is conquered (same requestId)', t.a.win && t.a.floor === 1 && t.a.calls === 2 && t.a.rids[0] === t.a.rids[1], JSON.stringify(t.a));
      ck('Tower: every reply lost -> 7 sends, then the plain not-confirmed words', t.b.pending && t.b.calls === 7 && /Connection lost before the server answered/.test(t.b.msg), JSON.stringify(t.b)); }
    // Gauntlet (bonus stage): gsplitFinish -> /api/bonus/resolve
    const gauntlet = (verdict, replies) => pg.evaluate(async ({ verdict, replies }) => {
      const S = window.__rrArm('/api/bonus/resolve', replies); const banners = [];
      const keep = { bannerMsg: window.bannerMsg, gsplitEnd: window.gsplitEnd, gsplitWindowHide: window.gsplitWindowHide, gsplitHudExit: window.gsplitHudExit, show: window.show };
      window.bannerMsg = m => banners.push(String(m)); window.gsplitEnd = () => {}; window.gsplitWindowHide = () => {}; window.gsplitHudExit = () => {}; window.show = () => {};
      ACC.token = window.__rrTok;
      Object.assign(GSPLIT, { active: true, stage: '1-3', attemptId: 'bx-page', lanes: verdict === 'won' ? [{ state: 'cleared', units: [] }, { state: 'cleared', units: [] }, { state: 'cleared', units: [] }] : [{ state: 'lost', units: [] }, { state: 'lost', units: [] }, { state: 'cleared', units: [] }],
        _finishing: false, _windowEvidence: [], _windowRetryQueue: [], _verdictPending: null, _resolveRid: null, _resolveVerdict: null });
      gsplitFinish(verdict);
      for (let i = 0; i < 200 && !banners.some(m => /CLEARED|RUN LOST|RETRY RESULT/.test(m)); i++) await new Promise(r => window.__rr.st.call(window, r, 50));
      Object.assign(window, keep); GSPLIT.active = false; GSPLIT._finishing = false; window.__rrDisarm();
      return { banners, calls: S.n, rids: S.rids }; }, { verdict, replies });
    { const WINR = { ok: true, won: true, stars: 3, starNote: '', heroesSent: 3, heroesLost: 0, firstClear: true, granted: [] };
      let g = await gauntlet('won', [LOST, [200, WINR]]);
      ck('Gauntlet: won + lost first reply, then the receipt -> CLEARED (one requestId)', g.banners.some(m => /BONUS 1-3 CLEARED/.test(m)) && oneRid(g) && g.calls === 2 && !g.banners.some(m => /RUN LOST/.test(m)), JSON.stringify(g).slice(0, 300));
      g = await gauntlet('won', [LOST]);
      ck('Gauntlet: won + every reply lost -> not confirmed in plain words, never RUN LOST / "offline"', g.banners.some(m => /RETRY RESULT/.test(m)) && g.calls === 7 && oneRid(g) && !g.banners.some(m => /RUN LOST|\boffline\b/i.test(m)) && g.banners.some(m => /Connection lost before the server answered/.test(m)), JSON.stringify(g).slice(0, 300));
      g = await gauntlet('won', [[400, { ok: false, error: 'No matching bonus run.' }]]);
      ck('Gauntlet: won + the server refuses -> not confirmed, never RUN LOST', g.banners.some(m => /not confirmed/i.test(m)) && !g.banners.some(m => /RUN LOST/.test(m)), JSON.stringify(g).slice(0, 300));
      g = await gauntlet('lost', [[200, { ok: true, won: false, stars: 0, starNote: '', firstClear: false, granted: [] }]]);
      ck('Gauntlet: a real loss -> RUN LOST', g.banners.some(m => /RUN LOST/.test(m)), JSON.stringify(g).slice(0, 200)); }
    ck('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally { try { if (b) await b.close(); } catch (_) {} }
}

/* ---------- C. control: v1150 must fail ---------- */
function control() {
  console.log('== C. control: the same test against v1150 (9f4d79aa) must fail ==');
  const repo = path.join(__dirname, '..'), wt = path.join(os.tmpdir(), 'ew1151-v1150-' + Date.now());
  const add = spawnSync('git', ['worktree', 'add', '--detach', wt, '9f4d79aa70527052d639832f235c426de929f65f'], { cwd: repo, encoding: 'utf8' });
  if (add.status !== 0) { ck('control worktree created', false, add.stderr); return; }
  try { fs.symlinkSync(fs.realpathSync(path.join(repo, 'node_modules')), path.join(wt, 'node_modules'), 'junction');
    const r = spawnSync(process.execPath, [__filename], { cwd: repo, env: { ...process.env, EW_ROOT: wt, EW_CONTROL: '1' }, encoding: 'utf8', timeout: 900000 });
    const m = /PASS: (\d+)\s+FAIL: (\d+)/.exec(r.stdout || '');
    ck('CONTROL v1150 fails this test (exit ' + r.status + ', ' + (m ? 'PASS ' + m[1] + ' FAIL ' + m[2] : 'no count') + ')', r.status !== 0 && m && +m[2] > 0, (r.stdout || '').split('\n').filter(l => /^\s+x /.test(l)).slice(0, 4).join(' | '));
  } finally { try { fs.unlinkSync(path.join(wt, 'node_modules')); } catch (_) { try { fs.rmdirSync(path.join(wt, 'node_modules')); } catch (__) {} }
    spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: repo }); }
}

(async () => {
  port = await freePort(); base = 'http://127.0.0.1:' + port;
  try { await start(); await httpLayer(); await pageLayer(); }
  catch (e) { fail++; console.log('  x  harness error - ' + (e && e.stack || e)); }
  finally { await stop(); }
  if (!process.env.EW_CONTROL) control();
  console.log(''); console.log('PASS: ' + pass + '  FAIL: ' + fail);
  process.exit(fail ? 1 : 0);
})();
