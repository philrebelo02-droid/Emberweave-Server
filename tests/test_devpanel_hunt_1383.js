/* v1383 DEV PANEL HUNT (Grok, Claude 12 Nov 21:16: "hunt the new dev panel: every tab at 844x390, Fold, PC - every button works end to end for an
   admin, a player and a tester get 403 on admin routes, nothing cut off, and the Total users chip adds up across all 5 servers").
   Real servers on free ports + temp DBs (no live server touched), real page (Chromium, SwiftShader, silent: --disable-audio-output, --mute-audio NOT used).
   A. 403: every /api/admin/* and /api/dev/* route the server has (GET and POST) for signed out, a normal player and a test account
      (the tester's own Economy grant is the one allowed route; a tester's grant aimed at another player must not reach them).
   B. layout at 844x390, Fold 906x1088 and PC 1440x900: every tab + the player card + the report audit + the ban menu: nothing outside the view,
      nothing clipped sideways by its box, no text cut with an ellipsis, no two controls overlapping, every tab hit-testable; screenshots.
   C. every button end to end for an admin (real Playwright clicks: the click lands only if the button is visible and on top), checked on the server.
   D. Total users across a real Server 1 + Servers 2-5 (account server + 4 satellites with link secret): the chip on every server equals
      Server 1's signed-up players + every server's own guests (crew left out, a linked guest not twice).
   CONTROL: HUNT_ROOT=<checkout>. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.HUNT_ROOT || path.join(__dirname, '..'), control = !!process.env.HUNT_ROOT;
const SHOTS = process.env.HUNT_SHOTS || '';
const ONLY = (process.env.HUNT_ONLY || 'ABCD').toUpperCase();
let pass = 0, fail = 0; const fails = [];
const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; fails.push(m); console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 900) : '')); } };
const note = m => console.log('  note ' + m);
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
const BASEENV = { DATABASE_URL: '', DB_STORE: '', RL_MUL: '1000', REG_PER_MIN: '5000', REG_ACCOUNTS_PER_IP: '5000', SIM_WORKERS: '0', MUT_PER_MIN: '5000', ALLOW_NEW_GUESTS: '1', GUEST_PER_MIN: '5000' };
function mkServer(name, dbFile, extra) {
  const S = { name, port: 0, base: '', proc: null, log: '' };
  S.start = async () => { if (!S.port) { S.port = await freePort(); S.base = 'http://127.0.0.1:' + S.port; }
    const env = { ...process.env, ...BASEENV, PORT: String(S.port), DB_FILE: dbFile, ...(typeof extra === 'function' ? extra() : extra || {}) }; delete env.SHOP_FREE_PACKS;
    S.proc = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    S.proc.stdout.on('data', d => { S.log += d; if (S.log.length > 400000) S.log = S.log.slice(-200000); }); S.proc.stderr.on('data', d => { S.log += d; });
    for (const t0 = Date.now(); Date.now() - t0 < 90000 && S.proc.exitCode === null;) { try { if ((await fetch(S.base + '/api/health')).ok) return; } catch (_) {} await delay(100); }
    throw new Error(name + ' did not start: ' + S.log.slice(-600)); };
  S.stop = async () => { const c = S.proc; if (!c) return; await delay(800); c.kill(); for (let i = 0; i < 400 && c.exitCode === null && c.signalCode === null; i++) { if (i === 200) try { c.kill('SIGKILL'); } catch (_) {} await delay(50); } S.proc = null; };
  S.req = async (method, u, b, tok) => { const r = await fetch(S.base + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(b || {}) }); let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, body: j }; };
  S.post = (u, b, t) => S.req('POST', u, b, t); S.get = (u, t) => S.req('GET', u, null, t);
  S.login = async (n, p, dev) => (await S.post('/api/login', { name: n, pass: p, deviceId: dev })).body;
  S.led = async t => { const r = (await S.get('/api/ledger', t)).body; return r.ledger || r; };
  return S;
}
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-dvphunt-')); const servers = []; let br = null;
  const tag = Date.now().toString(36).slice(-4), PW = 'password1', ADM = 'hAdm' + tag, PL = 'hPl' + tag, TG = 'hTg' + tag, VIC = 'hVic' + tag;
  try {
  if (/[ABC]/.test(ONLY)) {
    fs.mkdirSync(path.join(tmp, 'one')); const db1 = path.join(tmp, 'one', 'db.json');
    const S = mkServer('single', db1, { ADMIN_IDS: '' }); servers.push(S); await S.start();
    for (const n of [ADM, PL, TG, VIC]) { const r = await S.post('/api/register', { name: n, pass: PW }); if (!r.body.token) throw new Error('register ' + n + ' ' + JSON.stringify(r.body)); }
    /* 90 more players so the list needs "Show more" (80 a page) */
    for (let i = 0; i < 90; i++) { const r = await S.post('/api/register', { name: 'hz' + String(i).padStart(2, '0') + tag, pass: PW }); if (!r.body.token) throw new Error('register filler ' + i + ' ' + JSON.stringify(r.body)); }
    const plT = (await S.login(PL, PW)).token; await S.get('/api/ledger', plT);
    await S.post('/api/report', { kind: 'bug', text: 'Hunt bug: the forge button is stuck', screen: 'forge' }, plT);
    await S.post('/api/report', { kind: 'suggestion', text: 'Hunt idea: a sort by power', screen: 'home' }, plT);
    await S.stop();
    { const db = JSON.parse(fs.readFileSync(db1, 'utf8')); const by = n => Object.values(db.users).find(x => x.name === n); const now = Date.now();
      by(ADM).role = 'admin'; by(TG).role = 'tester';
      const p = by(PL), v = by(VIC); p.email = 'hunt' + tag + '@example.com'; p.flag = { reason: 'hunt fixture flag', t: now, gems: 1, gold: 1 };
      if (p.led) { p.led.purchases = [{ t: now - 3600000, id: 'd500', usd: 4.99, order: 'GPA.hunt-' + tag }]; }
      db.reports = (db.reports || []).concat([
        { id: 'rInt' + tag, t: now - 60000, userId: v.id, name: v.name, kind: 'gems', amount: 9000, detail: 'Hunt integrity: +9000 diamonds in 2 min', resolved: false, action: null },
        { id: 'rMod' + tag, t: now - 30000, kind: 'moderation', priority: 'high', reason: 'racism', reasonLabel: 'Racism', userId: v.id, name: v.name, reporterId: p.id, reporterName: p.name,
          chat: { channel: 'world', sender: v.name, text: 'hunt fixture bad line', t: now - 40000 }, context: [{ who: p.name, text: 'hello', t: now - 50000 }], resolved: false, action: null }]);
      fs.writeFileSync(db1, JSON.stringify(db)); }
    await S.start();
    const al = await S.login(ADM, PW), pl = await S.login(PL, PW), tl = await S.login(TG, PW);
    ck('fixture: admin, player and tester sign in (single server, temp DB)', al.profile && al.profile.admin && pl.token && tl.profile && tl.profile.tester, JSON.stringify([al.profile, tl.profile]).slice(0, 200));
    const plId = pl.profile.id, vicId = (await S.login(VIC, PW)).profile.id;
    /* ---------------- A. 403 ---------------- */
    if (ONLY.includes('A')) {
      const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
      const R = new Set(); for (const m of src.matchAll(/p===?'(\/api\/(?:admin|dev)\/[a-z0-9\-\/]+)'/g)) R.add(m[1]);
      const rx = src.match(/\^\\\/api\\\/admin\\\/\(([a-z\-|]+)\)\$/); if (rx) rx[1].split('|').forEach(x => R.add('/api/admin/' + x));
      const routes = [...R].sort(); const ALLOW_TESTER = new Set(['/api/admin/led-grant']);
      const body = { id: vicId, playerId: vicId, userId: vicId, res: 'gems', amount: 5, text: 'x', days: 1, on: true, requestId: 'h' + tag, action: 'clear', done: true, name: VIC };
      const g0 = (await S.led((await S.login(VIC, PW)).token)).gems | 0;
      for (const [who, tok] of [['signed out', null], ['a normal player', pl.token], ['a test account', tl.token]]) {
        const open = [], nf = []; let n = 0;
        for (const r of routes) for (const m of ['GET', 'POST']) { if (who === 'a test account' && ALLOW_TESTER.has(r)) continue; n++;
          const q = m === 'GET' ? r + '?id=' + vicId + '&all=1&raw=1&q=a' : r; const x = await S.req(m, q, body, tok); if (x.status === 403) continue; if (x.status === 404 || x.status === 405) { nf.push(m + ' ' + r); continue; } open.push(m + ' ' + r + ' -> ' + x.status); }
        const real = n - nf.length; ck('403: ' + who + ' gets 403 on every admin/dev route (' + real + ' route+method pairs that exist; ' + nf.length + ' wrong-method calls answer 404/405 = no such route, nothing runs)', open.length === 0, open.join(' | ')); if (who === 'signed out') note('wrong-method (404/405): ' + nf.join(', ')); }
      const vt = (await S.login(VIC, PW)).token;
      ck('403: none of those calls touched the target player (diamonds ' + g0 + ', not banned)', ((await S.led(vt)).gems | 0) === g0 && !!vt);
      const tg = await S.post('/api/admin/led-grant', { userId: vicId, gems: 777 }, tl.token);
      ck('a tester\'s Economy grant aimed at another player goes to the tester only', tg.status === 200 && ((await S.led(vt)).gems | 0) === g0, JSON.stringify(tg.body).slice(0, 120));
      note('routes checked: ' + routes.join(' '));
    }
    /* ---------------- B + C. page ---------------- */
    if (/[BC]/.test(ONLY)) {
      const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
      br = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args: ['--disable-audio-output', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
      const errs = [];
      const page = async (n, vp) => { const ctx = await br.newContext({ viewport: vp, serviceWorkers: 'block', acceptDownloads: true }); await ctx.addInitScript(SILENT); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
        await pg.goto(S.base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof renderSettings === 'function' && typeof api === 'function' && typeof devAction === 'function', null, { timeout: 90000 }); await delay(1500);
        await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(400);
        pg.tok = await pg.evaluate(async ([n, p]) => { const r = await api('/api/login', 'POST', { name: n, pass: p }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; ACC.admin = !!r.profile.admin; ACC.tester = !!r.profile.tester; G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); try { authGateRefresh(); } catch (e) {} show('home'); return r.token; }, [n, PW]);
        await delay(900); return pg; };
      const openDev = async (pg, tab) => { await pg.evaluate(async (tab) => { if (tab) devTab = tab; setTab = 'dev'; popoutScreen('settings'); await new Promise(r => setTimeout(r, 300)); renderSettings();
        const tb = document.querySelector('#settingsBody [data-settab="dev"]'); if (tb) tb.click(); await new Promise(r => setTimeout(r, 300)); }, tab); await pg.waitForSelector('#dvpOv .dvp', { timeout: 10000 }); };
      const FILL = { players: '.dvp-prow', reports: '.dvp-rep', economy: '.dvp-erow', liveops: '#dvpLive .dvp-srow', servers: '.dvp-srow', qa: '.dvp-srow' };
      const waitFill = (pg, tb) => pg.waitForFunction(([tb, sel]) => { const d = document.querySelector('#dvpOv .dvp'); return d && d.dataset.dvp === tb && d.querySelectorAll(sel).length > 0 && !/Loading/.test((d.querySelector('.dvp-right') || {}).textContent || '') && (tb !== 'servers' || /Accounts/.test(d.textContent)); }, [tb, FILL[tb]], { timeout: 20000 }).then(() => true).catch(() => false);
      /* the layout probe: everything inside the panel window */
      const probe = (pg, scope) => pg.evaluate((scope) => {
        const d = document.querySelector('#dvpOv .dvp') || document.querySelector('.pai-card'); if (!d) return { none: true };
        const root = scope ? (document.querySelector(scope) || d) : d;
        const vw = innerWidth, vh = innerHeight, dr = d.getBoundingClientRect(); const sc = dr.width / (d.offsetWidth || 1);
        const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
        const name = el => (el.id ? '#' + el.id : '') + (el.dataset && Object.keys(el.dataset).length ? '[' + Object.entries(el.dataset).filter(([k]) => k !== 'pw').map(([k, v]) => k + '=' + String(v).slice(0, 14)).join(',') + ']' : '') + '<' + el.tagName.toLowerCase() + ' ' + String(el.className || '').slice(0, 30) + '> "' + (el.textContent || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"';
        const rot = Math.abs(dr.width / dr.height - d.offsetWidth / d.offsetHeight) > 0.2; const R = el => { const r = el.getBoundingClientRect(); return rot ? { left: r.top, right: r.bottom, top: r.left, bottom: r.right, width: r.height, height: r.width } : r; };
        const out = { rot, sc: +(rot ? dr.height / d.offsetWidth : sc).toFixed(4), outView: [], clipped: [], cut: [], overlap: [], minFont: 99, minFontEl: '' };
        if (dr.left < -1 || dr.top < -1 || dr.right > vw + 1 || dr.bottom > vh + 1) out.outView.push('panel ' + JSON.stringify([dr.left, dr.top, dr.right, dr.bottom].map(Math.round)));
        const ctrls = [...root.querySelectorAll('button,a.dvp-btn,input,select,textarea,.dvp-chip,.dvp-tab,.dvp-pill,.dvp-tag,.dvp-sw')].filter(vis);
        const texts = [...root.querySelectorAll('*')].filter(el => vis(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
        const DR = R(d); for (const el of new Set(ctrls.concat(texts))) { const r = R(el);
          /* clipped by an ancestor box (sideways always; up/down only when the box does not scroll) */
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a);
            const ox = cs.overflowX !== 'visible', oy = cs.overflowY !== 'visible'; if (!ox && !oy) { if (a === d) break; continue; }
            const ar = R(a); const scrollY = /auto|scroll/.test(cs.overflowY);
            if (ox && (r.left < ar.left - 1.5 || r.right > ar.right + 1.5)) { out.clipped.push(name(el) + ' sideways by ' + name(a).slice(0, 40)); break; }
            if (oy && !scrollY && (r.top < ar.top - 1.5 || r.bottom > ar.bottom + 1.5)) { out.clipped.push(name(el) + ' up/down by ' + name(a).slice(0, 40)); break; }
            if (scrollY) break; if (a === d) break; }
          if (r.right > DR.right + 1 || r.left < DR.left - 1) out.clipped.push(name(el) + ' outside the panel');
          if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && getComputedStyle(el).overflowX !== 'visible') out.cut.push(name(el) + ' ' + el.scrollWidth + '>' + el.clientWidth);
          const fs = parseFloat(getComputedStyle(el).fontSize) * (rot ? dr.height / d.offsetWidth : sc) * (parseFloat(getComputedStyle(el).zoom) || 1); if (texts.includes(el) && fs < out.minFont) { out.minFont = +fs.toFixed(1); out.minFontEl = name(el); } }
        for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) { const a = ctrls[i], b = ctrls[j]; if (a.contains(b) || b.contains(a)) continue;
          const p = R(a), q = R(b); const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
          if (w > 2 && h > 2) { /* both on screen in a scroll box? only if both visible in the same viewport area */ out.overlap.push(name(a) + ' x ' + name(b) + ' ' + Math.round(w) + 'x' + Math.round(h)); } }
        return out; }, scope || null);
      const shot = async (pg, n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
      const confirmYes = async pg => { await pg.waitForSelector('#_gcYes', { timeout: 5000 }); await delay(600); await pg.locator('#_gcYes').click(); };
      const done = pg => pg.evaluate(() => (document.getElementById('devDone') || {}).textContent || '');
      const waitDone = (pg, re, ms) => pg.waitForFunction((re) => new RegExp(re, 'i').test((document.getElementById('devDone') || {}).textContent || ''), re, { timeout: ms || 15000 }).then(() => true).catch(() => false);
      const TABS = ['players', 'reports', 'economy', 'liveops', 'servers', 'qa'];
      const SIZES = [['phone-844x390', 844, 390], ['fold-906x1088', 906, 1088], ['pc-1440x900', 1440, 900]];
      const layoutTable = {};
      if (ONLY.includes('B')) for (const [lab, w, h] of SIZES) {
        const pg = await page(ADM, { width: w, height: h }); await openDev(pg, 'players'); await waitFill(pg, 'players');
        for (const tb of TABS) {
          let clickErr = ''; try { await pg.locator('#dvpOv [data-devtab="' + tb + '"]').click({ timeout: 5000 }); } catch (e) { clickErr = e.message.split('\n')[0]; }
          const filled = await waitFill(pg, tb); await delay(500);
          const p = await probe(pg); await shot(pg, 'devpanel-' + tb + '-' + lab);
          const okL = !clickErr && filled && !p.outView.length && !p.clipped.length && !p.cut.length && !p.overlap.length;
          layoutTable[tb + ' ' + lab] = okL ? 'PASS' : 'FAIL';
          ck('B ' + lab + ' ' + tb + ': tab click lands, fills, nothing outside / clipped / cut / overlapping (min text ' + p.minFont + ' px on screen)', okL, JSON.stringify({ clickErr, filled, ...p }));
        }
        /* the player card, the ban menu, the report audit */
        await pg.locator('#dvpOv [data-devtab="players"]').click(); await waitFill(pg, 'players');
        await pg.locator('#dvpOv .dvp-prow', { hasText: PL }).first().click().catch(() => {});
        await pg.waitForFunction((n) => (document.querySelector('#dvpDetail .pai-nm') || {}).textContent === n && document.querySelectorAll('#dvpDetail #paInfo .pai-sec').length >= 3, PL, { timeout: 15000 }).catch(() => {});
        let p = await probe(pg); await shot(pg, 'devpanel-playercard-' + lab);
        ck('B ' + lab + ' player card: nothing clipped / cut / overlapping (min text ' + p.minFont + ' px)', !p.clipped.length && !p.cut.length && !p.overlap.length, JSON.stringify(p));
        layoutTable['playercard ' + lab] = (!p.clipped.length && !p.cut.length && !p.overlap.length) ? 'PASS' : 'FAIL';
        await pg.locator('#paBan').click().catch(() => {}); await delay(400);
        p = await probe(pg, '#paBanBox'); await shot(pg, 'devpanel-banmenu-' + lab);
        ck('B ' + lab + ' ban menu: nothing clipped / cut / overlapping (min text ' + p.minFont + ' px)', !p.clipped.length && !p.cut.length && !p.overlap.length, JSON.stringify(p));
        layoutTable['banmenu ' + lab] = (!p.clipped.length && !p.cut.length && !p.overlap.length) ? 'PASS' : 'FAIL';
        layoutTable['banmenu ' + lab + ' font'] = p.minFont;
        await pg.locator('#paBan').click().catch(() => {});
        await pg.locator('#dvpOv [data-devtab="reports"]').click(); await waitFill(pg, 'reports');
        await pg.locator('#dvpRk [data-rk="integrity"]').click().catch(() => {}); await delay(300);
        await pg.locator('#devIntegrity [data-raudit]').click().catch(() => {});
        await pg.waitForFunction(() => /Where they came from/.test((document.getElementById('devIntegrity') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
        p = await probe(pg, '#devIntegrity'); await shot(pg, 'devpanel-audit-' + lab);
        ck('B ' + lab + ' report audit view: nothing clipped / cut / overlapping (min text ' + p.minFont + ' px)', !p.clipped.length && !p.cut.length && !p.overlap.length, JSON.stringify(p));
        layoutTable['audit ' + lab] = (!p.clipped.length && !p.cut.length && !p.overlap.length) ? 'PASS' : 'FAIL'; layoutTable['audit ' + lab + ' font'] = p.minFont;
        await pg.context().close();
      }
      note('LAYOUT ' + JSON.stringify(layoutTable));
      /* ---------------- C. every button, admin, 844x390 ---------------- */
      if (ONLY.includes('C')) {
        const pg = await page(ADM, { width: 844, height: 390 }); const T = pg.tok; await openDev(pg, 'players'); await waitFill(pg, 'players');
        const C = async (m, fn) => { try { const r = await fn(); ck('C ' + m, r === true || (r && r.ok), typeof r === 'object' ? JSON.stringify(r).slice(0, 600) : r); } catch (e) { ck('C ' + m, false, e.message.split('\n').slice(0, 2).join(' ')); } };
        const card = async n => { if ((await pg.evaluate(() => document.querySelector('#dvpOv .dvp').dataset.dvp)) !== 'players') { await pg.locator('#dvpOv [data-devtab="players"]').click(); await waitFill(pg, 'players'); }
          await pg.locator('#dvpQ').fill(n); await delay(150); await pg.locator('#dvpOv .dvp-prow', { hasText: n }).first().click({ timeout: 5000 }); await pg.locator('#dvpQ').fill('');
          await pg.waitForFunction((n) => (document.querySelector('#dvpDetail .pai-nm') || {}).textContent === n && document.querySelectorAll('#dvpDetail #paInfo .pai-sec').length >= 3, n, { timeout: 15000 }); };
        const paMsg = (re, ms) => pg.waitForFunction((re) => new RegExp(re, 'i').test((document.getElementById('paMsg') || {}).textContent || ''), re, { timeout: ms || 15000 }).then(() => true).catch(() => false);
        const tokOf = async n => (await S.login(n, PW)).token;
        /* Players */
        await C('Players: search box finds one player', async () => { await pg.locator('#dvpQ').fill(VIC); await delay(200); const n = await pg.locator('#dvpOv .dvp-prow').count(); await pg.locator('#dvpQ').fill(''); return n === 1; });
        await C('Players: Show filter Testers / Online / Banned / All', async () => { const r = {}; for (const f of ['tester', 'online', 'banned', 'all']) { await pg.locator('#dvpFilt').selectOption(f); await delay(150); r[f] = await pg.locator('#dvpOv .dvp-prow').count(); } return { ok: r.tester >= 1 && r.all >= 80 && r.banned === 0, r }; });
        await C('Players: Sort select + column header sort', async () => { await pg.locator('#dvpSort').selectOption('name:1'); await delay(150); const a = await pg.locator('#dvpOv .dvp-prow b').first().textContent();
          await pg.locator('#dvpOv [data-dvsort="name"]').click(); await delay(150); const b = await pg.locator('#dvpOv .dvp-prow b').first().textContent(); await pg.locator('#dvpOv [data-dvsort="seen"]').click(); return { ok: a !== b, a, b }; });
        await C('Players: Show more adds the next page', async () => { const c0 = await pg.locator('#dvpOv .dvp-prow').count(); await pg.locator('#dvpOv [data-dvmore]').click({ timeout: 5000 }); await delay(200); const c1 = await pg.locator('#dvpOv .dvp-prow').count(); return { ok: c0 === 80 && c1 > 80, c0, c1 }; });
        await C('Players: Refresh reloads the list', async () => { await pg.locator('#dvpOv [data-dvrefresh="players"]').click(); await delay(800); return (await pg.locator('#dvpOv .dvp-prow').count()) >= 80; });
        await C('Players: Create test account makes a tester the server knows', async () => { await pg.locator('#dvpOv [data-dev="mktest"]').click(); await pg.waitForSelector('#devTestMade', { timeout: 15000 });
          const t = await pg.locator('#devTestMade').textContent(); const L = (await S.get('/api/admin/testers', T)).body; const pv = await probe(pg, '.dvp-foot'); await shot(pg, 'C-mktest-844x390');
          return { ok: (L.count | 0) >= 2, made: t.slice(0, 80), testers: L.count, footClip: pv.clipped.concat(pv.cut).slice(0, 3) }; });
        await card(PL);
        await C('Card: Grant 45 diamonds reaches the server', async () => { const g0 = (await S.led(await tokOf(PL))).gems | 0; await pg.locator('#paRes').selectOption('gems'); await pg.locator('#paAmt').fill('45'); await pg.locator('#paGrant').click();
          const m = await paMsg('Gave'); return { ok: m && ((await S.led(await tokOf(PL))).gems | 0) === g0 + 45, g0 }; });
        await C('Card: Take 5 (confirm) reaches the server', async () => { const g0 = (await S.led(await tokOf(PL))).gems | 0; await pg.locator('#paAmt').fill('5'); await pg.locator('#paTake').click(); await confirmYes(pg);
          const m = await paMsg('Took'); return { ok: m && ((await S.led(await tokOf(PL))).gems | 0) === g0 - 5 }; });
        await C('Card: Hero fragments shows the hero picker and grants that hero', async () => { await pg.locator('#paRes').selectOption('frags'); const hv = await pg.locator('#paHero').isVisible(); const k = await pg.locator('#paHero').inputValue();
          await pg.locator('#paAmt').fill('7'); await pg.locator('#paGrant').click(); const m = await paMsg('Gave'); const f = ((await S.led(await tokOf(PL))).frags || {})[k] | 0; await pg.locator('#paRes').selectOption('gems'); return { ok: hv && m && f >= 7, k, f }; });
        await C('Card: Send to their Mail reaches the player', async () => { await pg.locator('#paSubj').fill('Hunt subj'); await pg.locator('#paText').fill('Hunt message body'); await pg.locator('#paSend').click(); const m = await paMsg('Sent');
          const L = await S.led(await tokOf(PL)); return { ok: m && (L.amail || []).some(x => x.subj === 'Hunt subj') }; });
        await C('Card: Raw save opens and closes', async () => { await pg.locator('#paRaw').click(); await pg.waitForSelector('#paRawBox textarea', { timeout: 10000 }); const v = await pg.locator('#paRawBox textarea').inputValue(); await pg.locator('#paRaw').click(); return { ok: v.includes('"ledger"') && !(await pg.locator('#paRawBox textarea').count()) }; });
        await C('Card: Clear flag (shown for a flagged player) clears it on the server', async () => { const vis = await pg.locator('#paFlag').isVisible(); await pg.locator('#paFlag').click({ timeout: 5000 }); const m = await paMsg('Flag cleared');
          const info = (await S.get('/api/admin/player?id=' + plId, T)).body.player || {}; return { ok: vis && m && !(info.integrity && info.integrity.flag) }; });
        await C('Card: Clear recovery email (confirm) clears it', async () => { await card(PL); const vis = await pg.locator('#paEmail').isVisible(); await pg.locator('#paEmail').click({ timeout: 5000 }); await confirmYes(pg); const m = await paMsg('email cleared');
          const info = (await S.get('/api/admin/player?id=' + plId, T)).body.player || {}; return { ok: vis && m && !(info.identity && info.identity.hasEmail) }; });
        await C('Card: Make tester / Remove tester', async () => { await card(PL); const b = pg.locator('#paTst .adm-tst-b'); await pg.waitForFunction(() => { const b = document.querySelector('#paTst .adm-tst-b'); return b && !b.disabled; }, null, { timeout: 10000 });
          await b.click(); await delay(1200); const on = (await S.get('/api/admin/tester?id=' + plId, T)).body.player || {}; await pg.waitForFunction(() => { const b = document.querySelector('#paTst .adm-tst-b'); return b && !b.disabled; }, null, { timeout: 10000 }).catch(() => {});
          await b.click(); await delay(1200); const off = (await S.get('/api/admin/tester?id=' + plId, T)).body.player || {}; return { ok: on.tester === true && off.tester === false, on: on.tester, off: off.tester }; });
        await C('Card: Reset progress (confirm) then Undo reset (confirm)', async () => { await card(PL); await pg.locator('#paReset').click(); await confirmYes(pg); const m1 = await paMsg('Progress reset');
          await pg.waitForFunction(() => { const u = document.getElementById('paUndo'); return u && !u.hidden; }, null, { timeout: 10000 }).catch(() => {}); await pg.locator('#paUndo').click({ timeout: 5000 }); await confirmYes(pg); const m2 = await paMsg('put back');
          const L = await S.led(await tokOf(PL)); return { ok: m1 && m2 && (L.amail || []).some(x => x.subj === 'Hunt subj'), m1, m2 }; });
        await C('Card: Ban 1 day (confirm) then Unban', async () => { await card(VIC); await pg.locator('#paBan').click(); await pg.locator('#paBanBox [data-ban="1"]').click(); await confirmYes(pg);
          await pg.waitForFunction(() => /banned for 1 day/i.test((document.querySelector('#paBanBox [data-banmsg]') || {}).textContent || ''), null, { timeout: 10000 });
          const banOf = async () => (((await S.get('/api/admin/player?id=' + vicId, T)).body.player || {}).identity || {}).ban; const b1 = await banOf(); await delay(800); await pg.locator('#paBan').click(); await delay(200); if (!(await pg.locator('#paBanBox [data-ban]').count())) await pg.locator('#paBan').click(); await pg.locator('#paBanBox [data-unban]').click({ timeout: 5000 });
          await pg.waitForFunction(() => /unbanned/i.test((document.querySelector('#paBanBox [data-banmsg]') || {}).textContent || ''), null, { timeout: 10000 }); const b2 = await banOf();
          return { ok: !!b1 && !b2, b1, b2 }; });
        /* Reports */
        await pg.locator('#dvpOv [data-devtab="reports"]').click(); await waitFill(pg, 'reports');
        await C('Reports: the 4 kind tabs show the right counts (bug 1, suggestion 1, player report 1, cheat 1)', async () => { const t = await pg.locator('#dvpRk').textContent(); const items = await pg.evaluate(() => (DVP.items || []).filter(x => x.kind === 'integrity').map(x => x.text.slice(0, 80))); const srv = ((await S.get('/api/dev/reports', T)).body.reports || []).filter(r => r.kind !== 'moderation' && r.kind !== 'balance' && r.meta !== 'test-bots').length;
          return { ok: /Bug\s*1/.test(t) && /Suggestion\s*1/.test(t) && /Player Report\s*1/.test(t) && new RegExp('Cheat Detection\\s*' + srv).test(t), t, cheatItems: items, serverOpenCheat: srv }; });
        await C('Reports: Bug: Resolve then Reopen (server)', async () => { await pg.locator('#dvpRk [data-rk="bug"]').click(); await pg.locator('#dvpRf').selectOption('all'); await delay(200);
          await pg.locator('#devIntegrity [data-rres]').click(); await pg.waitForFunction(() => /Reopen/.test((document.querySelector('#devIntegrity [data-rres]') || {}).textContent || ''), null, { timeout: 10000 });
          const f1 = ((await S.get('/api/admin/feedback?all=1', T)).body.items || []).find(x => /Hunt bug/.test(x.text)); await pg.locator('#devIntegrity [data-rres]').click();
          await pg.waitForFunction(() => /Resolve/.test((document.querySelector('#devIntegrity [data-rres]') || {}).textContent || ''), null, { timeout: 10000 }); const f2 = ((await S.get('/api/admin/feedback?all=1', T)).body.items || []).find(x => /Hunt bug/.test(x.text));
          return { ok: f1 && f1.done === true && f2 && f2.done === false }; });
        await C('Reports: Suggestion tab lists the suggestion; Open player jumps to that player', async () => { await pg.locator('#dvpRk [data-rk="suggestion"]').click(); await delay(200); const t = await pg.locator('#dvpRList').textContent();
          await pg.locator('#devIntegrity [data-ropen]').click(); await pg.waitForFunction((n) => (document.querySelector('#dvpDetail .pai-nm') || {}).textContent === n, PL, { timeout: 10000 }); const tab = await pg.evaluate(() => document.querySelector('#dvpOv .dvp').dataset.dvp);
          await pg.locator('#dvpOv [data-devtab="reports"]').click(); await waitFill(pg, 'reports'); return { ok: /Hunt idea/.test(t) && tab === 'players' }; });
        await C('Reports: Player Report: Review opens the chat line + ban menu, Back returns', async () => { await pg.locator('#dvpRk [data-rk="moderation"]').click(); await delay(200); await pg.locator('#devIntegrity [data-raudit]').click();
          await pg.waitForFunction(() => /hunt fixture bad line/.test((document.getElementById('devIntegrity') || {}).textContent || ''), null, { timeout: 10000 }); const ban = await pg.locator('#intBanBox [data-ban="1"]').count();
          await pg.locator('#devIntegrity [data-intback]').click(); await delay(300); return { ok: ban === 1 && (await pg.locator('#devIntegrity [data-raudit]').count()) === 1 }; });
        await C('Reports: Cheat Detection: Audit, then "Clear report - not guilty" resolves it on the server', async () => { await pg.locator('#dvpRk [data-rk="integrity"]').click(); await delay(200); await pg.locator('#devIntegrity [data-raudit]').click();
          await pg.waitForFunction(() => /Where they came from/.test((document.getElementById('devIntegrity') || {}).textContent || ''), null, { timeout: 10000 }); const rid = await pg.evaluate(() => INTEG.open && INTEG.open.reportId); await pg.locator('#devIntegrity [data-intclear]').click(); await delay(1500);
          const r = ((await S.get('/api/dev/reports?all=1', T)).body.reports || []).find(x => x.id === rid); const back = await pg.locator('#devIntegrity [data-intback]').count(); return { ok: r && r.resolved === true && back === 0, resolved: r && r.resolved, back }; });
        await C('Reports: Player Report Resolve then Reopen (server)', async () => { await pg.locator('#dvpRf').selectOption('all'); await pg.locator('#dvpRk [data-rk="moderation"]').click(); await delay(200); await pg.locator('#devIntegrity [data-rres]').click();
          await pg.waitForFunction(() => /Reopen/.test((document.querySelector('#devIntegrity [data-rres]') || {}).textContent || ''), null, { timeout: 10000 }); const r1 = ((await S.get('/api/dev/reports?all=1', T)).body.reports || []).find(x => x.id === 'rMod' + tag);
          await pg.locator('#devIntegrity [data-rres]').click(); await pg.waitForFunction(() => /Resolve/.test((document.querySelector('#devIntegrity [data-rres]') || {}).textContent || ''), null, { timeout: 10000 }); const r2 = ((await S.get('/api/dev/reports?all=1', T)).body.reports || []).find(x => x.id === 'rMod' + tag);
          return { ok: r1.resolved === true && r2.resolved === false }; });
        await C('Reports: status select Open / Resolved and Refresh', async () => { await pg.locator('#dvpRf').selectOption('done'); await pg.locator('#dvpRk [data-rk="integrity"]').click(); await delay(200); const n = await pg.locator('#dvpRList .dvp-rep').count();
          await pg.locator('#dvpOv [data-dvrefresh="reports"]').click(); await delay(1200); const n2 = await pg.locator('#dvpRList .dvp-rep').count(); await pg.locator('#dvpRf').selectOption('open'); return { ok: n === 1 && n2 === 1, n, n2 }; });
        await C('Header: the open reports chip matches the open queue (after resolve / reopen / clear)', async () => { await pg.locator('#dvpOv [data-dvrefresh="reports"]').click(); await delay(1200);
          const chip = await pg.evaluate(() => +((([...document.querySelectorAll('#dvpHdStat .dvp-chip')].find(c => /open reports/.test(c.textContent)) || {}).textContent || '').match(/\d+/) || [-1])[0]);
          const st = (await S.get('/api/admin/status', T)).body.openReports; const q = await pg.evaluate(() => (DVP.items || []).filter(x => !x.resolved).length); return { ok: chip === st && st === q, chip, st, queue: q }; });
        /* Economy */
        await pg.locator('#dvpOv [data-devtab="economy"]').click(); await waitFill(pg, 'economy');
        const EC = [['gold', 'gold'], ['gems', 'gems'], ['stam', 'stamina'], ['arenacoin', 'arena coins'], ['guildcoins', 'guild coins'], ['shielditem', 'shields'], ['shards', 'fragments'], ['pieces', 'equipment'], ['level', 'level'], ['squadlvl', 'squad'], ['campstage', 'campaign']];
        for (const [k, re] of EC) await C('Economy: ' + k + ' Grant answers from the server', async () => { await pg.evaluate(() => { document.getElementById('devDone').textContent = ''; }); await pg.locator('#dvpOv [data-dev="' + k + '"]').click(); await pg.waitForFunction(() => { const t = (document.getElementById('devDone') || {}).textContent || ''; return t && !/…|Applying|Adding|Levelling|Advancing/.test(t); }, null, { timeout: 20000 }); const t = await done(pg); return { ok: !/refused|unavailable|No squad|above 0/i.test(t), t }; });
        await C('Economy: the Gold grant really moved the server balance', async () => { const g0 = (await S.led(T)).gold | 0; await pg.locator('#dvpOv [data-amt="gold"]').fill('1234'); await pg.locator('#dvpOv [data-dev="gold"]').click(); await waitDone(pg, '1,234 gold'); return { ok: ((await S.led(T)).gold | 0) === g0 + 1234 }; });
        for (const k of ['heroes', 'lv100', 'maxteam', 'campall']) await C('Economy: Roster ' + k + ' Apply answers from the server', async () => { await pg.evaluate(() => { document.getElementById('devDone').textContent = ''; }); await pg.locator('#dvpOv .dvp-right [data-dev="' + k + '"]').click(); await pg.waitForFunction(() => { const t = (document.getElementById('devDone') || {}).textContent || ''; return t && !/…/.test(t); }, null, { timeout: 60000 }); const t = await done(pg); return { ok: !/refused|unavailable|No heroes/i.test(t), t }; });
        await C('Economy: One hero\'s fragments: Choose opens the picker ON TOP of the panel and grants 100', async () => { await pg.locator('#dvpOv [data-dev="givefrags"]').click(); await pg.waitForSelector('#dfgList [data-fk]', { timeout: 5000 }); const k = await pg.locator('#dfgList [data-fk]').first().getAttribute('data-fk');
          const f0 = ((await S.led(T)).frags || {})[k] | 0; await pg.locator('#dfgList [data-fk]').first().click({ timeout: 5000 }); await pg.waitForFunction(() => /\+100/.test((document.getElementById('dfgMsg') || {}).textContent || ''), null, { timeout: 10000 }); const f1 = ((await S.led(T)).frags || {})[k] | 0;
          await shot(pg, 'C-givefrags-844x390'); await pg.locator('#dfgX').click(); return { ok: f1 === f0 + 100, k, f0, f1 }; });
        await C('Economy: Find purchase finds the player\'s purchase and Open player jumps to them', async () => { await pg.locator('#dvpBuyQ').fill(PL); await pg.locator('#dvpOv [data-dev="findbuy"]').click(); await waitDone(pg, 'found'); const n = await pg.locator('#dvpBuys .dvp-srow').count();
          const pv = await probe(pg, '#dvpBuys'); await shot(pg, 'C-findbuy-844x390'); if (n) { await pg.locator('#dvpBuys [data-ropen]').first().click(); await pg.waitForFunction((n) => (document.querySelector('#dvpDetail .pai-nm') || {}).textContent === n, PL, { timeout: 10000 }); }
          return { ok: n >= 1, n, t: await done(pg), clip: pv.clipped.concat(pv.cut, pv.overlap).slice(0, 4) }; });
        /* Live Ops */
        await pg.locator('#dvpOv [data-devtab="liveops"]').click(); await waitFill(pg, 'liveops');
        await C('Live Ops: Mail all players (confirm) reaches a player and shows under Sent recently', async () => { await pg.locator('#dvpAllSubj').fill('Hunt all ' + tag); await pg.locator('#dvpAllText').fill('Hunt to everyone'); await pg.locator('#dvpOv [data-dev="mailall"]').click(); await confirmYes(pg); await waitDone(pg, 'Sent to every');
          await delay(800); const L = await S.led(await tokOf(VIC)); const sent = await pg.locator('#dvpLive').textContent(); return { ok: (L.amail || []).some(x => x.subj === 'Hunt all ' + tag) && sent.includes('Hunt all ' + tag), amail: (L.amail || []).map(x => x.subj), sent: sent.slice(0, 120) }; });
        await C('Live Ops: Announcement: Show to players then Take it down (server notice)', async () => { await pg.locator('#dvpOv [data-lsel="notice"]').click(); await pg.locator('#dvpNotice').fill('Hunt notice ' + tag); await pg.locator('#dvpNoticeMin').selectOption('15');
          await pg.locator('#dvpOv [data-dev="noticeset"]').click(); await waitDone(pg, 'showing'); const n1 = (await S.led(await tokOf(VIC))).notice; await delay(300); await shot(pg, 'C-notice-844x390'); const pv = await probe(pg);
          const cover = await pg.evaluate(() => [...document.querySelectorAll('#dvpOv .dvp-tab, #dvpOv .dvp-chip, #dvpOv .dvp-close')].filter(el => { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(h && el.contains(h)); }).map(el => el.textContent.trim().slice(0, 20)));
          ck('C Live Ops: with an announcement on, every tab, header chip and Close is still on top (the banner does not cover the panel)', cover.length === 0, 'covered by the notice banner: ' + cover.join(', '));
          await pg.locator('#dvpOv [data-dev="noticeclr"]').click({ timeout: 5000 }); await waitDone(pg, 'cleared'); const n2 = (await S.led(await tokOf(VIC))).notice;
          return { ok: n1 && n1.text === 'Hunt notice ' + tag && !(n2 && n2.text), n1, n2, layout: pv.clipped.concat(pv.cut, pv.overlap).slice(0, 4) }; });
        /* Servers */
        await pg.locator('#dvpOv [data-devtab="servers"]').click(); await waitFill(pg, 'servers');
        await C('Servers: Refresh, Details, Backup now (server writes one)', async () => { const c0 = (await S.get('/api/admin/status', T)).body.backups.count | 0; await pg.locator('#dvpOv [data-dvrefresh="servers"]').click(); await delay(600);
          await pg.locator('#dvpOv .dvp-left [data-ssel]').first().click(); await pg.locator('#dvpOv [data-dev="backupnow"]').click(); await waitDone(pg, 'Backup written'); const c1 = (await S.get('/api/admin/status', T)).body.backups.count | 0; return { ok: c1 >= c0 + 1 || (c1 >= 1 && c0 >= 1), c0, c1 }; });
        await C('Servers: Download a copy downloads the DB', async () => { const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), pg.locator('#dvpOv [data-dev="backup"]').click()]); const f = await dl.path(); const j = JSON.parse(fs.readFileSync(f, 'utf8')); return { ok: !!(j.users && Object.keys(j.users).length >= 90), name: dl.suggestedFilename() }; });
        await C('Servers: the "here" server shows Accounts = the server\'s count', async () => { const st = (await S.get('/api/admin/status', T)).body; const t = await pg.locator('#dvpOv .dvp-right').textContent(); return { ok: t.replace(/,/g, '').includes('Accounts' + st.accounts), accounts: st.accounts, t: t.slice(0, 160) }; });
        /* QA */
        await pg.locator('#dvpOv [data-devtab="qa"]').click(); await waitFill(pg, 'qa');
        await C('QA: God mode switch', async () => { await pg.locator('#devGod').click(); const on = await pg.evaluate(() => DEV.god); await pg.locator('#devGod').click(); return { ok: on === true && (await pg.evaluate(() => DEV.god)) === false }; });
        for (const [k, re] of [['perf', 'Performance HUD'], ['fxmiss', 'FX|No FX'], ['cachelog', 'Offline Art|held'], ['orbs', 'Temple orbs'], ['savecode', 'Save code']])
          await C('QA: ' + k, async () => { await pg.locator('#dvpOv [data-dev="' + k + '"]').click(); const ok = await waitDone(pg, re, 5000); if (k === 'perf') await pg.locator('#dvpOv [data-dev="perf"]').click(); return { ok, t: await done(pg) }; });
        await C('QA: Save code shows the save below', async () => (await pg.locator('#saveOut').textContent()).length > 100);
        await C('QA: Simulations runs and shows a result', async () => { await pg.locator('#dvpOv [data-dev="bots"]').click(); await pg.waitForFunction(() => { const t = (document.getElementById('devAdmin') || {}).textContent || ''; return t && !/Simulating/.test(t); }, null, { timeout: 60000 }); await delay(300);
          const pv = await probe(pg); await shot(pg, 'C-bots-844x390'); return { ok: true, len: (await pg.locator('#devAdmin').textContent()).length, layout: pv.clipped.concat(pv.cut, pv.overlap).slice(0, 4) }; });
        await C('Close button closes the panel; tapping outside closes it', async () => { await pg.locator('#dvpOv [data-dvclose]').click(); const a = await pg.locator('#dvpOv').count(); await openDev(pg, 'qa'); await pg.mouse.click(2, 2); await delay(200); const b = await pg.locator('#dvpOv').count(); return { ok: a === 0, closeBtn: a, outside: b }; });
        await C('QA: Check for update reloads the page', async () => { await openDev(pg, 'qa'); await Promise.all([pg.waitForEvent('load', { timeout: 30000 }), pg.locator('#dvpOv [data-dev="update"]').click()]); return true; });
        await pg.context().close();
      }
      ck('no page errors', errs.length === 0, errs.join(' | '));
      await br.close(); br = null;
    }
    await S.stop();
  }
  /* ---------------- D. Total users across 5 servers ---------------- */
  if (ONLY.includes('D')) {
    const SECRET = 'hunt-link-' + tag; const dirs = [1, 2, 3, 4, 5].map(i => { const d = path.join(tmp, 's' + i); fs.mkdirSync(d); return path.join(d, 'db.json'); });
    const S1 = mkServer('S1', dirs[0], () => ({ ACCOUNT_LINK_SECRET: SECRET, SERVER_NAME: 'Server 1', ADMIN_IDS: S1.adm || '' })); servers.push(S1); await S1.start();
    const a = await S1.post('/api/register', { name: 'dAdm' + tag, pass: PW }); S1.adm = a.body.profile.id; await S1.stop(); await S1.start();
    const SAT = [2, 3, 4, 5].map(i => { const s = mkServer('S' + i, dirs[i - 1], () => ({ ACCOUNT_LINK_SECRET: SECRET, ACCOUNT_AUTHORITY: S1.base, SERVER_NAME: 'Server ' + i, ADMIN_IDS: S1.adm, ACCOUNT_STATUS_MS: '1000' })); servers.push(s); return s; });
    for (const s of SAT) await s.start();
    const ALL = [S1, ...SAT]; const plan = { S1: { acc: 3, guests: 2 }, S2: { acc: 2, guests: 3 }, S3: { acc: 1, guests: 1 }, S4: { acc: 0, guests: 4 }, S5: { acc: 2, guests: 0 } };
    for (const s of ALL) { const p = plan[s.name]; for (let i = 0; i < p.acc; i++) { const r = await s.post('/api/register', { name: 'u' + s.name + 'a' + i + tag, pass: PW }); if (!r.body.token) throw new Error('reg ' + s.name + ' ' + JSON.stringify(r.body)); }
      for (let i = 0; i < p.guests; i++) { const r = await s.post('/api/guest', { deviceId: 'hunt-' + s.name + '-g' + i + tag }); if (!r.body.token) throw new Error('guest ' + s.name + ' ' + JSON.stringify(r.body)); } }
    /* a guest upgraded to an account on Server 2 (counts once), a guest on Server 3 whose device then signs in to a real account (not twice) */
    { const g = (await SAT[0].post('/api/guest', { deviceId: 'hunt-up-' + tag })).body; const up = await SAT[0].post('/api/register', { name: 'uUp' + tag, pass: PW, deviceId: 'hunt-up-' + tag }, g.token); if (!up.body.token) note('guest upgrade on S2: ' + JSON.stringify(up.body).slice(0, 160)); }
    { await SAT[1].post('/api/guest', { deviceId: 'hunt-ln-' + tag }); const li = await SAT[1].post('/api/login', { name: 'uS1a0' + tag, pass: PW, deviceId: 'hunt-ln-' + tag }); if (!li.body.token) note('link sign-in on S3: ' + JSON.stringify(li.body).slice(0, 160)); }
    /* a test account made on Server 1 (crew: not counted) */
    const at1 = (await S1.login('dAdm' + tag, PW)).token; const mk = await S1.post('/api/admin/test-account', {}, at1);
    const expect = 3 + 2 + 1 + 0 + 2 + 1 /* signed up (S1..S5 + the upgraded guest) */ + 2 + 3 + 1 + 4 + 0 /* guests that stayed guests */;
    const st = {}; for (const s of ALL) { const t = (await s.login('dAdm' + tag, PW)).token; st[s.name] = { tok: t }; }
    for (const s of SAT) await s.get('/api/admin/status', st[s.name].tok);   // each satellite reports its guest count on a status read
    for (const s of ALL) { const b = (await s.get('/api/admin/status', st[s.name].tok)).body; st[s.name].tu = b.totalUsers; st[s.name].accounts = b.accounts; st[s.name].guests = b.guests; st[s.name].testers = b.testers; }
    const truth = {}; for (const s of ALL) { const db = JSON.parse(fs.readFileSync(dirs[ALL.indexOf(s)], 'utf8')); truth[s.name] = 0; }
    const sumAcc = ALL.reduce((a, s) => a + (st[s.name].accounts | 0), 0);
    note('D status per server: ' + JSON.stringify(Object.fromEntries(ALL.map(s => [s.name, { tu: st[s.name].tu, accounts: st[s.name].accounts, guests: st[s.name].guests }]))));
    note('D expected total users ' + expect + ' (made: 9 signed-up players incl. 1 upgraded guest, 10 guests, 1 linked guest left out, admin + test account left out); naive sum of the 5 servers\' "Accounts" = ' + sumAcc);
    ck('D Total users chip on Server 1 = ' + expect + ' (Server 1 accounts + every server\'s own guests, crew out, linked guest once), across 5 servers', st.S1.tu && st.S1.tu.total === expect && st.S1.tu.servers === 5, JSON.stringify(st.S1.tu));
    ck('D every satellite shows the same Total users as Server 1', SAT.every(s => st[s.name].tu && st[s.name].tu.total === st.S1.tu.total), JSON.stringify(SAT.map(s => st[s.name].tu)));
    /* the page chip on Server 1 and on Server 4 */
    { const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright')); br = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args: ['--disable-audio-output', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
      for (const s of [S1, SAT[2]]) { const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' }); await ctx.addInitScript(SILENT); const pg = await ctx.newPage();
        await pg.goto(s.base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof devPanelOpen === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(1200);
        await pg.evaluate(async ([n, p]) => { const r = await api('/api/login', 'POST', { name: n, pass: p }); ACC.token = r.token; ACC.id = r.profile.id; ACC.admin = !!r.profile.admin; DEV.on = true; G.tutStarted = true; G.tutDone = true; document.body.classList.remove('gated'); devTab = 'servers'; devPanelOpen(); }, ['dAdm' + tag, PW]);
        await pg.waitForSelector('#dvpTotalUsers', { timeout: 15000 }).catch(() => {}); const chip = await pg.evaluate(() => { const c = document.getElementById('dvpTotalUsers'); return c ? { n: +c.querySelector('b').textContent.replace(/,/g, ''), title: c.title } : null; });
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'D-total-users-' + s.name + '-844x390.png') });
        ck('D page on ' + s.name + ': the Total users chip shows ' + expect, chip && chip.n === expect, JSON.stringify(chip)); await ctx.close(); }
      await br.close(); br = null; }
    /* after a Server 1 restart (a deploy restarts it): does the chip still add up before the satellites' next 10-minute report? */
    await S1.stop(); await S1.start(); const t1 = (await S1.login('dAdm' + tag, PW)).token; const after = (await S1.get('/api/admin/status', t1)).body.totalUsers;
    ck('D right after a Server 1 restart its chip still counts all 5 servers (or says it is partial)', after && ((after.total === expect && after.servers === 5) || after.partial === true), JSON.stringify(after));
    for (const s of ALL) await s.stop();
  }
  } catch (e) { fail++; fails.push('run'); console.log('  FAIL run: ' + (e.stack || e)); for (const s of servers) if (s.log) console.log('--- ' + s.name + ' log tail: ' + s.log.slice(-800)); }
  finally { try { if (br) await br.close(); } catch (_) {} for (const s of servers) { try { if (s.proc) s.proc.kill(); } catch (_) {} } }
  console.log('test_devpanel_hunt_1383.js: ' + (control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed' + (fails.length ? '\nFAILED: ' + fails.join(' || ') : ''));
  process.exit(fail ? 1 : 0);
})();
