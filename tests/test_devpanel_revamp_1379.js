/* v1379 DEV PANEL REVAMP (Phil 12 Nov 2026: "Please revamp my dev panel completely, its confusing and alot of redundant things" / "The players should
   have a sort also. By level, name, last played, patron level" / "Wow me, make it flashy and organized. Functional and no redundant things").
   Real server on a free port + temp DB, then the real page (Chromium, SwiftShader, silent, service workers blocked):
   - server: the new admin routes (adjust, message, notice, status, backup-now, log, feedback, reset-progress) answer an admin; a non-admin, a
     signed-out caller and a TEST ACCOUNT get 403 on every one, and on the old admin-only routes; a tester still has the Economy grant + Reset;
     grant / take never go below 0; a message reaches the player's ledger (Mail); the notice reaches every player's ledger; reset progress keeps
     a copy and Undo puts it back; every action lands in the admin log, which survives a restart; the player list carries level / Patron / last seen.
   - page, admin, at phone 844x390, phone 390x844, Fold 906x1088 and PC 1440x900: the 5 tabs open, each fills, nothing wider than the panel
     (no sideways scroll); a screenshot of each tab (DVP_SHOTS, default the project's shots folder).
   - page, admin: the player sort by Last played, Level, Name and Patron, both directions, matches the server's numbers; tapping a player opens
     the card with its actions; Give on the card changes the server balance.
   - page, tester: only the Economy tab's actions + Reset all progress, no tab bar; page, normal player: no dev panel; the player sees the
     notice banner and the message in their Mail inbox.
   CONTROL: TP_ROOT=<origin/main before v1379> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
const SHOTS = control ? '' : (process.env.DVP_SHOTS || 'C:\\Users\\Home\\OneDrive\\Desktop\\Emberweave Archive\\Open Projects\\DEV PANEL REVAMP 12NOV2026\\shots');
let pass = 0, fail = 0; const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 400) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-dvp1379-')), dbFile = path.join(tmp, 'db.json'); let srv = null, br = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const env0 = { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0', ADMIN_IDS: '', MUT_PER_MIN: '5000', ALLOW_NEW_GUESTS: '1' };
  delete env0.SHOP_FREE_PACKS;
  const start = async () => { srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: env0, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    srv.log = ''; srv.stdout.on('data', d => { srv.log += d; }); srv.stderr.on('data', d => { srv.log += d; });
    for (const t0 = Date.now(); Date.now() - t0 < 60000 && !(srv && srv.exitCode !== null);) { try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); } throw new Error('server did not start'); };
  const stop = async () => { if (!srv) return; const c = srv; await delay(1200); c.kill(); for (let i = 0; i < 400 && c.exitCode === null && c.signalCode === null; i++) { if (i === 200) try { c.kill('SIGKILL'); } catch (_) {} await delay(50); } srv = null; };
  const req = async (method, u, b, tok) => { const r = await fetch(base + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(b || {}) }); let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, body: j }; };
  const post = (u, b, tok) => req('POST', u, b, tok), get = (u, tok) => req('GET', u, null, tok);
  const login = async (n, p) => (await post('/api/login', { name: n, pass: p })).body;
  const led = async tok => { const r = (await get('/api/ledger', tok)).body; return r.ledger || r; };
  try {
    await start();
    const tag = Date.now().toString(36).slice(-4), PW = 'password1', ADM = 'dAdm' + tag, PL = 'dPl' + tag, TG = 'dTg' + tag;
    /* six fixture players with different level / Patron / last played, so every sort has one right order */
    const FX = ['Ash', 'Birch', 'Cedar', 'Dune', 'Elm', 'Fern'].map((n, i) => ({ name: 'zq' + n + tag, px: [900, 52000, 9000, 230000, 2600, 120000][i], usd: [0, 600, 40, 3, 150, 9][i], seen: [5, 1, 40, 200, 3000, 15][i] }));
    for (const n of [ADM, PL, TG].concat(FX.map(f => f.name))) { const r = await post('/api/register', { name: n, pass: PW }); if (!r.body.token) throw new Error('register ' + n + ': ' + JSON.stringify(r.body)); }
    for (const f of FX) { const t = (await login(f.name, PW)).token; await get('/api/ledger', t); }
    await stop();
    { const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); const by = n => Object.values(db.users).find(x => x.name === n);
      by(ADM).role = 'admin'; by(TG).role = 'tester'; const now = Date.now();
      for (const f of FX) { const u = by(f.name); u.led.px = f.px; u.led.purchases = f.usd ? [{ t: now - 86400000, id: 'gems_fixture', usd: f.usd }] : []; u.led.patron = { v: 1, base: f.usd * 6, prestiged: false, edpBase: 0 }; u.lastSeen = now - f.seen * 60000; }
      fs.writeFileSync(dbFile, JSON.stringify(db)); }
    await start();
    const al = await login(ADM, PW), pl = await login(PL, PW), tl = await login(TG, PW); let aTok = al.token, pTok = pl.token, tTok = tl.token;
    ck('fixture: admin, player and tester sign in', !!aTok && al.profile.admin === true && !!pTok && !!tTok && tl.profile.tester === true, JSON.stringify([al.profile, tl.profile]).slice(0, 300));
    const plId = pl.profile.id; const gem0 = (await led(pTok)).gems | 0;   // a new account's starting diamonds
    // --- the player list carries what the Players tab sorts by
    const acc = await get('/api/admin/accounts', aTok); const rows = acc.body.accounts || [];
    const fr = FX.map(f => rows.find(r => r.name === f.name));
    ck('accounts list: level, Patron, last seen, tester and username on every row', fr.every(r => r && typeof r.level === 'number' && typeof r.patron === 'number' && r.lastSeen > 0 && 'tester' in r && 'login' in r), JSON.stringify(fr[0]));
    ck('accounts list: the fixtures have distinct levels and Patron levels (a real sort check)', new Set(fr.map(r => r.level)).size === 6 && new Set(fr.map(r => r.patron)).size >= 5, JSON.stringify(fr.map(r => [r.level, r.patron])));
    ck('accounts list: the tester row says tester', (rows.find(r => r.name === TG) || {}).tester === true);
    // --- every new route: admin only (403 signed out, player, tester)
    const NEW = [['POST', '/api/admin/adjust', { id: plId, res: 'gems', amount: 5 }], ['POST', '/api/admin/message', { id: plId, text: 'hi' }], ['POST', '/api/admin/mail-all', { text: 'hi' }], ['GET', '/api/admin/mail-all'], ['POST', '/api/admin/notice', { text: 'x' }],
      ['GET', '/api/admin/status'], ['GET', '/api/admin/purchase?q=gems'], ['GET', '/api/admin/player?raw=1&id=' + plId], ['POST', '/api/admin/backup-now', {}], ['GET', '/api/admin/log'], ['GET', '/api/admin/feedback'], ['POST', '/api/admin/feedback', { id: 'x', done: true }],
      ['POST', '/api/admin/reset-progress', { id: plId }], ['POST', '/api/admin/reset-progress', { id: plId, undo: true }]];
    const OLD = [['GET', '/api/admin/accounts'], ['GET', '/api/admin/online'], ['GET', '/api/admin/player?id=' + plId], ['POST', '/api/admin/ban', { playerId: plId, days: 1, requestId: 'r1' }],
      ['POST', '/api/admin/delete', { id: plId }], ['POST', '/api/admin/tester', { id: plId, on: true }], ['POST', '/api/admin/test-account', {}], ['GET', '/api/dev/reports'], ['POST', '/api/admin/report', { action: 'clearResolved' }]];
    for (const [who, tok] of [['signed out', null], ['a normal player', pTok], ['a test account', tTok]]) {
      const open = []; for (const [m, u, b] of NEW.concat(OLD)) { const r = await req(m, u, b, tok); if (r.status !== 403) open.push(m + ' ' + u + ' -> ' + r.status); }
      ck(who + ' is refused all ' + (NEW.length + OLD.length) + ' admin-only routes (403), the new ones included', open.length === 0, open.join(' | ')); }
    ck('the player was not touched by those attempts (diamonds unchanged)', ((await led(pTok)).gems | 0) === gem0, gem0);
    // --- the tester keeps exactly its powers
    const tg = await post('/api/admin/led-grant', { gold: 1234 }, tTok);
    ck('a tester still uses the Economy grant on itself', tg.status === 200 && tg.body.ok && tg.body.ledger.gold >= 1234);
    ck('a tester still uses Reset all progress', (await post('/api/account/reset-progress', {}, tTok)).status === 200 && ((await led(tTok)).gold | 0) === 0);
    // --- grant / take
    let r = await post('/api/admin/adjust', { id: plId, res: 'gems', amount: 500 }, aTok);
    ck('admin grants 500 diamonds to a player', r.status === 200 && r.body.after === gem0 + 500 && ((await led(pTok)).gems | 0) === gem0 + 500, JSON.stringify(r.body));
    r = await post('/api/admin/adjust', { id: plId, res: 'gems', amount: -200 }, aTok);
    ck('admin takes 200 back', r.status === 200 && r.body.after === gem0 + 300 && r.body.delta === -200 && ((await led(pTok)).gems | 0) === gem0 + 300, JSON.stringify(r.body));
    r = await post('/api/admin/adjust', { id: plId, res: 'gold', amount: -999999 }, aTok);
    ck('a take never goes below 0', r.status === 200 && r.body.after === 0 && ((await led(pTok)).gold | 0) === 0, JSON.stringify(r.body));
    r = await post('/api/admin/adjust', { id: plId, res: 'frags', hero: 'vael', amount: 30 }, aTok);
    ck('admin grants 30 fragments of one hero', r.status === 200 && ((await led(pTok)).frags.vael | 0) >= 30, JSON.stringify(r.body));
    ck('a bad resource / amount is refused (400)', (await post('/api/admin/adjust', { id: plId, res: 'souls', amount: 5 }, aTok)).status === 400 && (await post('/api/admin/adjust', { id: plId, res: 'gems', amount: 0 }, aTok)).status === 400);
    // --- message + notice reach the player's ledger
    r = await post('/api/admin/message', { id: plId, subj: 'Your pack', text: 'We added your 300 diamonds.' }, aTok);
    let pled = await led(pTok);
    ck('a message reaches the player (ledger amail)', r.status === 200 && Array.isArray(pled.amail) && pled.amail.some(m => m.text === 'We added your 300 diamonds.' && m.subj === 'Your pack'), JSON.stringify(pled.amail));
    r = await post('/api/admin/mail-all', { subj: 'Launch week', text: 'Thank you for testing.' }, aTok);
    const pl2led = await led(pTok);
    ck('Live Ops: a mail to every player reaches every player (ledger amail)', r.status === 200 && Array.isArray(pl2led.amail) && pl2led.amail.some(m => m.subj === 'Launch week'), JSON.stringify(pl2led.amail));
    r = await post('/api/admin/notice', { text: 'Server update in 10 minutes', minutes: 30 }, aTok);
    pled = await led(pTok);
    ck('the maintenance notice reaches every player (ledger notice)', r.status === 200 && pled.notice && pled.notice.text === 'Server update in 10 minutes' && pled.notice.until > Date.now(), JSON.stringify(pled.notice));
    // --- reset progress + undo
    await post('/api/admin/led-grant', { userId: plId, campCleared: 25, gold: 7777 }, aTok);
    r = await post('/api/admin/reset-progress', { id: plId }, aTok); pled = await led(pTok);
    ck('admin resets a player\'s progress (campaign 0, gold 0)', r.status === 200 && pled.camp.cleared === 0 && (pled.gold | 0) === 0, JSON.stringify(r.body));
    r = await post('/api/admin/reset-progress', { id: plId, undo: true }, aTok); pled = await led(pTok);
    ck('Undo reset puts it back (campaign 25, gold 7777, diamonds as before)', r.status === 200 && pled.camp.cleared === 25 && (pled.gold | 0) === 7777 && (pled.gems | 0) === gem0 + 300, JSON.stringify([r.body, pled.camp, pled.gold, pled.gems]));
    ck('a second Undo has nothing to undo (400)', (await post('/api/admin/reset-progress', { id: plId, undo: true }, aTok)).status === 400);
    ck('an admin account cannot be reset by the panel', (await post('/api/admin/reset-progress', { id: al.profile.id }, aTok)).status === 400);
    // --- feedback queue
    await post('/api/report', { kind: 'bug', text: 'The arena button is stuck', screen: 'arena' }, pTok);
    let fb = await get('/api/admin/feedback', aTok); const item = (fb.body.items || []).find(x => x.text === 'The arena button is stuck');
    ck('the Reports queue reads a player\'s bug report', fb.status === 200 && !!item && item.kind === 'bug' && item.done === false, JSON.stringify(fb.body).slice(0, 200));
    r = await post('/api/admin/feedback', { id: item && item.id, done: true }, aTok); fb = await get('/api/admin/feedback', aTok); const fbAll = await get('/api/admin/feedback?all=1', aTok);
    ck('resolving it hides it from Open and keeps it under All', r.body.done === true && !(fb.body.items || []).some(x => x.id === item.id) && (fbAll.body.items || []).some(x => x.id === item.id && x.done), JSON.stringify(r.body));
    // --- status + backup now
    r = await post('/api/admin/backup-now', {}, aTok); const st = await get('/api/admin/status', aTok);
    ck('Backup now writes a backup; status shows it, the build, players and the notice', r.status === 200 && st.status === 200 && st.body.backups && st.body.backups.last && st.body.backups.count >= 1 && st.body.accounts >= 9 && st.body.notice && st.body.notice.text === 'Server update in 10 minutes', JSON.stringify(st.body).slice(0, 300));
    { const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); const real = Object.values(db.users).filter(u => !u.isNpc && u.role !== 'tester' && u.role !== 'admin' && !/^LT-/i.test(u.name || '')).length;
      const tu = st.body.totalUsers || {};
      ck('Total users = every account in the DB minus the crew (tester, admin): ' + real + ' (player + 6 fixtures)', tu.total === real && real === 7, JSON.stringify([tu, real])); }
    { const tot = async () => ((await get('/api/admin/status', aTok)).body.totalUsers || {}).total;
      const t0 = await tot(); const gA = (await post('/api/guest', { deviceId: 'dvp-dev-A-' + tag })).body; const t1 = await tot();
      const up = await post('/api/register', { name: 'dUp' + tag, pass: PW, deviceId: 'dvp-dev-A-' + tag }, gA.token); const t2 = await tot();
      ck('Total users: a new guest (device) counts 1; that guest upgraded to an account still counts 1 (same player)', t1 === t0 + 1 && !!(up.body && up.body.token) && t2 === t1, JSON.stringify([t0, t1, t2, up.status]));
      const gB = (await post('/api/guest', { deviceId: 'dvp-dev-B-' + tag })).body; const t3 = await tot();
      const li = await post('/api/login', { name: PL, pass: PW, deviceId: 'dvp-dev-B-' + tag }); pTok = li.body.token; const t4 = await tot();
      ck('Total users: a guest whose device then signs in to a real account is linked to it and not counted twice', !!gB.token && t3 === t2 + 1 && !!pTok && t4 === t2, JSON.stringify([t2, t3, t4])); }
    ck('status carries the recent server errors list', Array.isArray(st.body.errors) && typeof st.body.saveFails === 'number', JSON.stringify(st.body.errors));
    const raw = await get('/api/admin/player?raw=1&id=' + plId, aTok);
    ck('Raw save on the card: the ledger and save as stored (no password hash)', raw.status === 200 && raw.body.raw && raw.body.raw.ledger && raw.body.raw.ledger.camp.cleared === 25 && !JSON.stringify(raw.body).includes('"hash"'), JSON.stringify(raw.body).slice(0, 200));
    await post('/api/report', { kind: 'bug', text: 'Tester: the forge shakes', screen: 'forge' }, tTok);
    const fbt = await get('/api/admin/feedback', aTok);
    ck('a test account report is marked tester in the queue (Testers filter)', (fbt.body.items || []).some(x => x.text === 'Tester: the forge shakes' && x.tester === true), JSON.stringify(fbt.body.items).slice(0, 300));
    const buy = await get('/api/admin/purchase?q=' + encodeURIComponent(FX[1].name), aTok);
    ck('Economy > Purchase support finds a player purchases (by player name)', buy.status === 200 && (buy.body.purchases || []).some(x => x.name === FX[1].name && x.usd === 600), JSON.stringify(buy.body).slice(0, 200));
    // --- the admin log
    let lg = await get('/api/admin/log?id=' + plId, aTok); const acts = (lg.body.log || []).map(x => x.act);
    ck('the admin log holds who / what / when for that player', ['grant', 'take', 'message', 'reset:progress', 'reset:undo', 'feedback:done'].every(a => acts.includes(a)) && lg.body.log.every(x => x.by === ADM && x.t > 0), acts.join());
    const info = await get('/api/admin/player?id=' + plId, aTok);
    ck('the player card info carries that log and the purchases list', Array.isArray(info.body.player.log) && info.body.player.log.length >= 5 && info.body.player.account && Array.isArray(info.body.player.account.recent), JSON.stringify(info.body.player.account));
    // --- page
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    br = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args: ['--disable-audio-output', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const errs = [];
    const page = async (n, p, vp) => { const ctx = await br.newContext({ viewport: vp || { width: 844, height: 390 }, serviceWorkers: 'block' }); await ctx.addInitScript(SILENT); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof renderSettings === 'function' && typeof api === 'function' && typeof devAction === 'function', null, { timeout: 90000 }); await delay(1500);
      await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(400);
      pg.tok = await pg.evaluate(async ([n, p]) => { const r = await api('/api/login', 'POST', { name: n, pass: p }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; ACC.admin = !!r.profile.admin; ACC.tester = !!r.profile.tester; G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); try { authGateRefresh(); } catch (e) {} show('home'); return r.token; }, [n, p]);
      await delay(800); return pg; };
    const openDev = (pg, tab) => pg.evaluate(async (tab) => { if (tab) devTab = tab; setTab = 'dev'; popoutScreen('settings'); await new Promise(r => setTimeout(r, 300)); renderSettings();
      const tb = document.querySelector('#settingsBody [data-settab="dev"]'); if (tb) tb.click(); await new Promise(r => setTimeout(r, 200)); return !!document.querySelector('#dvpOv .dvp'); }, tab);
    const TABS = ['players', 'reports', 'economy', 'liveops', 'servers', 'qa'];
    const SIZES = [['phone-844x390', 844, 390], ['phone-390x844', 390, 844], ['fold-906x1088', 906, 1088], ['pc-1440x900', 1440, 900]];
    let apg = null;
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    for (const [lab, w, h] of SIZES) {
      if (apg) await apg.context().close();   // one session per account: each new sign-in replaces the last page's token
      const pg = await page(ADM, PW, { width: w, height: h }); apg = pg;
      const okTabs = [], bad = [];
      for (const tb of TABS) {
        await openDev(pg, 'players');
        const clicked = await pg.evaluate((tb) => { const b = document.querySelector('#dvpOv .dvp [data-devtab="' + tb + '"]'); if (!b) return false; b.click(); return true; }, tb);
        if (!clicked) { bad.push(tb + ': no tab button'); continue; }
        const filled = await pg.waitForFunction((tb) => { const d = document.querySelector('#dvpOv .dvp'); if (!d || d.dataset.dvp !== tb) return false;
          const sel = { players: '.dvp-prow', reports: '.dvp-rep,.dvp-empty:not(.bad)', economy: '.dvp-erow', liveops: '#dvpLive .dvp-srow', servers: '.dvp-srow', qa: '.dvp-srow' }[tb];
          if (tb === 'reports' && document.querySelector('#devIntegrity .dvp-empty') && /Loading/i.test(document.querySelector('#devIntegrity').textContent)) return false;
          return d.querySelectorAll(sel).length > 0; }, tb, { timeout: 15000 }).then(() => true).catch(() => false);
        await delay(250);
        const fit = await pg.evaluate(() => { const d = document.querySelector('#dvpOv .dvp'); const over = [];
          for (const el of d.querySelectorAll('*')) { if (el.closest('.dvp-search') && el.tagName === 'INPUT') continue; if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'hidden' && !['SELECT', 'INPUT', 'TEXTAREA'].includes(el.tagName) && el.clientWidth > 0) over.push((el.className || el.tagName) + ' ' + el.scrollWidth + '>' + el.clientWidth); }
          const r = d.getBoundingClientRect(), p = d.parentElement.getBoundingClientRect(); const sb = d.querySelector('.dvp-body'); const tr = d.querySelector('.dvp-tabs'), t0 = tr.children[0].getBoundingClientRect(), tl = tr.lastElementChild.getBoundingClientRect();
          const oneLine = tr.children[0].offsetTop === tr.lastElementChild.offsetTop && [...tr.children].every(b => b.scrollWidth <= b.clientWidth + 1 && b.querySelector('span').scrollWidth <= b.querySelector('span').clientWidth + 1);
          const hit = document.elementFromPoint(t0.left + t0.width / 2, t0.top + t0.height / 2);
          const ov = d.parentElement, sc = +getComputedStyle(ov).getPropertyValue('--dvp-scale'), want = Math.min(ov.clientWidth / 1280, ov.clientHeight / 800), rr = d.getBoundingClientRect(), orr = ov.getBoundingClientRect();
          const fixed = d.offsetWidth === 1280 && d.offsetHeight === 800 && Math.abs(sc - want) < 0.002 && (Math.abs(Math.max(rr.width, rr.height) - Math.max(orr.width, orr.height)) < 3 || Math.abs(Math.min(rr.width, rr.height) - Math.min(orr.width, orr.height)) < 3);
          const L = d.querySelector('.dvp-left'), R = d.querySelector('.dvp-right'); const split = !L || !R || (R.offsetLeft >= L.offsetLeft + L.offsetWidth - 1 && Math.abs(R.offsetTop - L.offsetTop) < 4);
          return { fixed, sc, split, over: over.slice(0, 4), panelOut: r.right > p.right + 2 || r.left < p.left - 2 || r.bottom > p.bottom + 2, bodySide: sb.scrollWidth > sb.clientWidth + 2, tabs: d.querySelectorAll('[data-devtab]').length, oneLine, onTop: !!(hit && hit.closest('.dvp-tabs')) }; });
        if (filled && !fit.over.length && !fit.panelOut && !fit.bodySide && fit.tabs === 6 && fit.oneLine && fit.onTop && fit.split && fit.fixed) okTabs.push(tb); else bad.push(tb + ' ' + JSON.stringify({ filled, ...fit }));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'devpanel-' + tb + '-' + lab + '.png') });
      }
      ck('page, admin, ' + lab + ': all 6 tabs open and fill; the fixed 1280x800 panel at one scale filling the view; ONE row of tabs; list left + detail right; nothing sideways', okTabs.length === 6, bad.join(' | '));
      // the player card at this size
      await openDev(pg, 'players'); await pg.waitForFunction(() => document.querySelectorAll('#dvpOv .dvp-prow').length > 0, null, { timeout: 15000 }).catch(() => {});
      const card = await pg.evaluate(async (n) => { const row = [...document.querySelectorAll('#dvpOv .dvp-prow')].find(x => x.textContent.includes(n)); if (!row) return { row: false }; row.click();
        for (let i = 0; i < 60 && !(document.querySelectorAll('#dvpDetail #paInfo .pai-sec').length >= 5 && /dPl/.test((document.querySelector('#dvpDetail .pai-nm') || {}).textContent || '')); i++) await new Promise(r => setTimeout(r, 150));
        const c = document.querySelector('#dvpDetail .pai-card'); if (!c) return { row: true, inline: false }; const cr = document.getElementById('dvpDetail').getBoundingClientRect(); const over = [...c.querySelectorAll('*')].filter(el => el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !['SELECT', 'INPUT', 'TEXTAREA'].includes(el.tagName) && getComputedStyle(el).overflowX !== 'hidden').map(el => el.className || el.id).slice(0, 4);
        return { row: true, ids: ['paGrant', 'paTake', 'paSend', 'paBan', 'paReset', 'paDel'].filter(id => !!document.getElementById(id)), secs: document.querySelectorAll('#paInfo .pai-sec').length, tst: !!document.querySelector('#paTst .adm-tst-b'), over, inView: cr.left >= -1 && cr.top >= -1 }; }, PL);
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'devpanel-playercard-' + lab + '.png') });
      ck('page, admin, ' + lab + ': tapping a player shows the card on the right (Grant, Take, Send, Ban, Reset, Delete, tester, info), nothing cut off sideways', card.row && card.inline !== false && card.ids.length === 6 && card.secs >= 5 && card.tst && !card.over.length && card.inView, JSON.stringify(card));
      
    }
    { const chip = await apg.evaluate(() => { const c = document.getElementById('dvpTotalUsers'); const h = document.getElementById('dvpHdStat'); return c ? { t: c.textContent, n: +(c.querySelector('b').textContent.replace(/,/g, '')), fits: h.scrollWidth <= h.clientWidth + 1 } : null; });
      ck('page, admin: the header shows "N total users" from the server, in the one header line', chip && /total users/.test(chip.t) && chip.n >= 7 && chip.fits, JSON.stringify(chip)); }
    // --- the sort, all 4 keys, both directions (relative order of the six fixtures against the server's own numbers)
    await openDev(apg, 'players'); await apg.waitForFunction(() => document.querySelectorAll('#dvpOv .dvp-prow').length > 0, null, { timeout: 15000 }).catch(() => {});
    const exp = (key, dir) => { const v = { seen: r => r.lastSeen, level: r => r.level, name: r => r.name.toLowerCase(), patron: r => r.patron }[key];
      return fr.slice().sort((a, b) => { const x = v(a), y = v(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir; }).map(r => r.name); };
    const sortRes = [];
    for (const key of ['seen', 'level', 'name', 'patron']) for (const want of ['first', 'flip']) {
      const got = await apg.evaluate(async ([key, want, names]) => { const b = document.querySelector('#dvpOv [data-dvsort="' + key + '"]'); if (!b) return null;
        if (want === 'first' && DVP.sort === key) { b.click(); }   // re-arm: the first click on a new key gives its default direction
        if (want === 'first') { const other = document.querySelector('#dvpOv [data-dvsort="' + (key === 'name' ? 'level' : 'name') + '"]'); other.click(); await new Promise(r => setTimeout(r, 50)); document.querySelector('#dvpOv [data-dvsort="' + key + '"]').click(); }
        else b.click();
        await new Promise(r => setTimeout(r, 120)); DVP.shown = 9999; devPlayersPaint();
        const order = [...document.querySelectorAll('#dvpOv .dvp-prow b')].map(x => x.textContent).filter(n => names.includes(n));
        const dir = document.querySelector('#dvpOv [data-dvsort="' + key + '"] .dvp-dir'); return { order, dir: dir ? (dir.classList.contains('dn') ? -1 : 1) : 0 }; }, [key, want, FX.map(f => f.name)]);
      const defDir = key === 'name' ? 1 : -1, d = want === 'first' ? defDir : -defDir, e = exp(key, d);
      const ok = got && got.dir === d && JSON.stringify(got.order) === JSON.stringify(e); sortRes.push(ok);
      ck('page, admin: sort by ' + key + (d < 0 ? ' (high to low / newest first)' : ' (low to high / A-Z / oldest first)') + ' matches the server numbers', ok, JSON.stringify({ got, e }));
    }
    // search + filter
    const sf = await apg.evaluate(async (n) => { const q = document.getElementById('dvpQ'); q.value = n; q.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 100));
      const one = [...document.querySelectorAll('#dvpOv .dvp-prow b')].map(x => x.textContent); q.value = ''; q.dispatchEvent(new Event('input'));
      const fl = document.getElementById('dvpFilt'); fl.value = 'tester'; fl.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 100)); const tst = [...document.querySelectorAll('#dvpOv .dvp-prow b')].map(x => x.textContent);
      fl.value = 'all'; fl.dispatchEvent(new Event('change')); return { one, tst }; }, FX[2].name);
    ck('page, admin: search finds the one player; the Testers filter shows only test accounts', sf.one.length === 1 && sf.one[0] === FX[2].name && sf.tst.length >= 1 && sf.tst.includes(TG) && !sf.tst.includes(PL), JSON.stringify(sf));
    // Give on the card changes the server balance
    const give = await apg.evaluate(async (n) => { const row = [...document.querySelectorAll('#dvpOv .dvp-prow')].find(x => x.querySelector('b').textContent === n); row.click();
      const det = () => document.getElementById('dvpDetail');
      for (let i = 0; i < 60 && !(((det().querySelector('.pai-nm') || {}).textContent === n) && det().querySelector('#paInfo .pai-sec')); i++) await new Promise(r => setTimeout(r, 100));
      det().querySelector('#paRes').value = 'gems'; det().querySelector('#paAmt').value = '45'; det().querySelector('#paGrant').click();
      for (let i = 0; i < 60 && !/Gave/.test(det().querySelector('#paMsg').textContent); i++) await new Promise(r => setTimeout(r, 100));
      return det().querySelector('#paMsg').textContent; }, PL);
    ck('page, admin: Give 45 diamonds on the card reaches the server', /Gave 45 Diamonds/.test(give) && ((await led(pTok)).gems | 0) === gem0 + 345, give);
    // economy row with an amount box
    const eco = await apg.evaluate(async () => { devTab = 'economy'; devPanelRender(); const inp = document.querySelector('#dvpOv [data-amt="gold"]'); inp.value = '4321';
      document.querySelector('#dvpOv [data-dev="gold"]').click(); for (let i = 0; i < 40 && !/gold|refused/i.test(document.getElementById('devDone').textContent); i++) await new Promise(r => setTimeout(r, 120));
      return document.getElementById('devDone').textContent; });
    ck('page, admin: Economy > Gold with an amount of 4,321 grants exactly that', /\+4,321 gold/.test(eco), eco);
    // --- tester page
    const tpg = await page(TG, PW); await openDev(tpg, 'players');
    const tv = await tpg.evaluate(() => { const b = document.getElementById('settingsBody'), o = document.getElementById('dvpOv') || document.createElement('div'); return { tabBtn: !!b.querySelector('[data-settab="dev"]'), tabs: o.querySelectorAll('[data-devtab]').length,
      acts: [...o.querySelectorAll('.dvp [data-dev]')].map(x => x.dataset.dev), reset: !!b.querySelector('#resetBtn'), badge: (o.querySelector('.dvp-title') || {}).textContent, pane: o.querySelector('.dvp') ? o.querySelector('.dvp').dataset.dvp : '', hd: (o.querySelector('.dvp-hd') || {}).textContent || '' }; });
    const ECON = ['gold', 'gems', 'stam', 'arenacoin', 'guildcoins', 'shielditem', 'shards', 'pieces', 'level', 'squadlvl', 'campstage', 'heroes', 'lv100', 'maxteam', 'campall', 'givefrags'];
    ck('page, tester: only the Economy tab (no tab bar, TEST badge) + Reset all progress', tv.tabBtn && tv.tabs === 0 && tv.pane === 'economy' && tv.reset && tv.badge === 'TEST ACCOUNT' && tv.acts.length === ECON.length && tv.acts.every(a => ECON.includes(a)) && !/Lv [0-9]/.test(tv.hd), JSON.stringify(tv));
    if (SHOTS) { await delay(200); await tpg.screenshot({ path: path.join(SHOTS, 'devpanel-tester-economy-phone-844x390.png') }); }
    const tAdm = await tpg.evaluate(async () => { const box = document.createElement('div'); box.innerHTML = '<div id="devDone"></div><div id="devAdmin"></div>'; document.body.appendChild(box);
      devAction('mktest', box); devAction('backupnow', box); devAction('noticeset', box); await new Promise(r => setTimeout(r, 600)); return box.textContent; });
    ck('page, tester: admin actions do nothing from the page either', tAdm === '', tAdm);
    // --- normal player page: no dev panel; sees the notice + the message
    const ppg = await page(PL, PW); await ppg.evaluate(async () => { try { await ledgerSync(); } catch (e) {} }); await delay(500);
    const pv = await ppg.evaluate(() => { setTab = 'dev'; renderSettings(); try { devPanelOpen(); } catch (e) {} const b = document.getElementById('settingsBody'); const n = document.getElementById('ewNotice');
      return { devTab: !!b.querySelector('[data-settab="dev"]'), dvp: !!document.querySelector('.dvp'), notice: n ? n.textContent : '', mail: (G.mail && G.mail.inbox || []).filter(m => m.amid).map(m => m.subj + '|' + m.body) }; });
    ck('page, normal player: no Dev tab and no dev panel', !pv.devTab && !pv.dvp, JSON.stringify(pv));
    ck('page, normal player: the maintenance notice shows as a banner', /Server update in 10 minutes/.test(pv.notice), pv.notice);
    ck('page, normal player: the admin\'s message and the mail to everyone are in their Mail inbox (once each)', pv.mail.length === 2 && pv.mail.includes('Your pack|We added your 300 diamonds.') && pv.mail.includes('Launch week|Thank you for testing.'), JSON.stringify(pv.mail));
    if (SHOTS) { await ppg.evaluate(() => show('home')); await delay(400); await ppg.screenshot({ path: path.join(SHOTS, 'player-notice-banner-phone-844x390.png') }); }
    ck('no page errors', errs.length === 0, errs.join(' | '));
    await br.close(); br = null;
    // --- the log survives a restart
    await stop(); await start(); aTok = (await login(ADM, PW)).token;
    lg = await get('/api/admin/log?id=' + plId, aTok);
    ck('the admin log survives a server restart', (lg.body.log || []).length >= 6, JSON.stringify(lg.body).slice(0, 200));
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { try { if (br) await br.close(); } catch (_) {} if (srv) { try { srv.kill(); } catch (_) {} } }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
