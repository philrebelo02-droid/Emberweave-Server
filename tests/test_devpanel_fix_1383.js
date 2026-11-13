/* v1383 DEV PANEL HUNT FIXES (Grok): the visual faults the hunt found, on the real page (Chromium, SwiftShader, silent: --disable-audio-output,
   no --mute-audio), real server on a free port + temp DB, at 844x390 and PC 1440x900.
   F1 an announcement is up: the banner (#ewNotice) must not cover the open dev panel - every tab, header chip and Close stays on top - and it
      still shows in the game once the panel is closed.
   F2 the report audit (Reports > Cheat Detection > Audit) and the ban menu (player card > Ban) are drawn at the panel's text size: every text
      line at least 16 layout px tall (the rest of the panel's body text is 16-17 px; the old look was 10.5-12 px, about 5 px on a phone).
   F3 the red ban buttons' labels are readable: contrast with their red at least 4.5:1 (it was dark text on red).
   F4 the audit of an account with no ledger says "Balance now —", never "null".
   CONTROL (passes on both): the panel opens with its 6 tabs, the audit opens, the ban menu has its 5 ban buttons, the banner is up in the game.
   Run on a pre-fix checkout: FIX_ROOT=<checkout> must FAIL F1-F4. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.FIX_ROOT || path.join(__dirname, '..'), control = !!process.env.FIX_ROOT;
const SHOTS = process.env.FIX_SHOTS || '';
let pass = 0, fail = 0; const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 600) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-dvpfix-')), dbFile = path.join(tmp, 'db.json'); let srv = null, br = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const env0 = { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0', ADMIN_IDS: '', MUT_PER_MIN: '5000' };
  const start = async () => { srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: env0, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); srv.log = ''; srv.stdout.on('data', d => { srv.log += d; }); srv.stderr.on('data', d => { srv.log += d; });
    for (const t0 = Date.now(); Date.now() - t0 < 60000 && srv.exitCode === null;) { try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); } throw new Error('server did not start'); };
  const stop = async () => { if (!srv) return; const c = srv; await delay(800); c.kill(); for (let i = 0; i < 400 && c.exitCode === null && c.signalCode === null; i++) { if (i === 200) try { c.kill('SIGKILL'); } catch (_) {} await delay(50); } srv = null; };
  const post = async (u, b, t) => { const r = await fetch(base + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { 'x-token': t } : {}) }, body: JSON.stringify(b || {}) }); let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, body: j }; };
  try {
    await start(); const tag = Date.now().toString(36).slice(-4), PW = 'password1', ADM = 'fAdm' + tag, VIC = 'fVic' + tag;
    for (const n of [ADM, VIC]) { const r = await post('/api/register', { name: n, pass: PW }); if (!r.body.token) throw new Error('register ' + JSON.stringify(r.body)); }
    await stop();
    { const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); const by = n => Object.values(db.users).find(x => x.name === n); by(ADM).role = 'admin'; const v = by(VIC); delete v.led;
      db.reports = [{ id: 'rF' + tag, t: Date.now() - 60000, userId: v.id, name: v.name, kind: 'gems', amount: 9000, detail: 'Fixture: +9000 diamonds in 2 min', resolved: false, action: null }];
      db.notice = { id: 'nF' + tag, text: 'Fixture notice: server update in 10 minutes', t: Date.now(), by: ADM, until: 0 }; fs.writeFileSync(dbFile, JSON.stringify(db)); }
    await start();
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    br = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args: ['--disable-audio-output', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const errs = [];
    for (const [lab, w, h] of [['phone-844x390', 844, 390], ['pc-1440x900', 1440, 900]]) {
      const ctx = await br.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); await ctx.addInitScript(SILENT); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(lab + ': ' + e.message));
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof renderSettings === 'function' && typeof devAction === 'function', null, { timeout: 90000 }); await delay(1500);
      await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(400);
      await pg.evaluate(async ([n, p]) => { const r = await api('/api/login', 'POST', { name: n, pass: p }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; ACC.admin = !!r.profile.admin; G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); try { authGateRefresh(); } catch (e) {} show('home'); try { await ledgerSync(); } catch (e) {} }, [ADM, PW]);
      await pg.waitForSelector('#ewNotice', { timeout: 15000 }).catch(() => {});
      const bannerGame = await pg.evaluate(() => { const n = document.getElementById('ewNotice'); return !!n && n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== 'none'; });
      ck('CONTROL ' + lab + ': the announcement banner is up in the game', bannerGame);
      const openDev = async tab => { await pg.evaluate(async (tab) => { devTab = tab; setTab = 'dev'; popoutScreen('settings'); await new Promise(r => setTimeout(r, 300)); renderSettings(); const tb = document.querySelector('#settingsBody [data-settab="dev"]'); if (tb) tb.click(); await new Promise(r => setTimeout(r, 300)); }, tab); await pg.waitForSelector('#dvpOv .dvp', { timeout: 10000 }); };
      await openDev('liveops'); await pg.waitForFunction(() => document.querySelectorAll('#dvpHdStat .dvp-chip').length >= 3, null, { timeout: 15000 }).catch(() => {}); await delay(600);
      ck('CONTROL ' + lab + ': the panel opens with its 6 tabs', (await pg.locator('#dvpOv [data-devtab]').count()) === 6);
      const cover = await pg.evaluate(() => [...document.querySelectorAll('#dvpOv .dvp-tab, #dvpOv .dvp-chip, #dvpOv .dvp-close')].filter(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(hit && el.contains(hit)); }).map(el => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 20)));
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, 'fix-notice-' + lab + '.png') }); }
      ck('F1 ' + lab + ': with an announcement up, every tab, header chip and Close of the dev panel is on top (not under the banner)', cover.length === 0, 'covered: ' + cover.join(', '));
      /* F2 + F4: the audit */
      await pg.locator('#dvpOv [data-devtab="reports"]').click(); await pg.waitForSelector('#dvpRk [data-rk="integrity"]', { timeout: 15000 }); await pg.locator('#dvpRk [data-rk="integrity"]').click();
      await pg.waitForSelector('#devIntegrity [data-raudit]', { timeout: 15000 }); await pg.locator('#devIntegrity [data-raudit]').click();
      await pg.waitForFunction(() => /Where they came from/.test((document.getElementById('devIntegrity') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
      const sizeOf = sel => pg.evaluate((sel) => { const host = document.querySelector(sel); const d = document.querySelector('#dvpOv .dvp'); if (!host || !d) return null; const sc = d.getBoundingClientRect().width / d.offsetWidth; let min = 99, minT = '';
        const tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); for (let n; (n = tw.nextNode());) { if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
          if (el.closest('input,select,textarea')) continue; const rg = document.createRange(); rg.selectNodeContents(n); const rs = [...rg.getClientRects()].filter(r => r.height > 0); if (!rs.length) continue;
          const hgt = Math.min(...rs.map(r => r.height)) / sc; if (hgt < min) { min = +hgt.toFixed(1); minT = n.textContent.trim().slice(0, 30); } }
        return { min, minT, onScreen: +(min * sc).toFixed(1) }; }, sel);
      const au = await sizeOf('#devIntegrity'); const auTxt = await pg.locator('#devIntegrity').textContent();
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'fix-audit-' + lab + '.png') });
      ck('CONTROL ' + lab + ': the audit opens', /Where they came from/.test(auTxt));
      ck('F2 ' + lab + ': every text line of the report audit is at least 16 layout px tall (the panel\'s body size)', au && au.min >= 16, JSON.stringify(au));
      ck('F4 ' + lab + ': an account with no ledger shows "Balance now —", never "null"', /Balance now/.test(auTxt) && !/null/.test(auTxt), (auTxt.match(/Balance now[^·]*/) || [''])[0]);
      /* F2 + F3: the ban menu on the player card */
      await pg.locator('#dvpOv [data-devtab="players"]').click(); await pg.waitForSelector('#dvpOv .dvp-prow', { timeout: 15000 });
      await pg.locator('#dvpOv .dvp-prow', { hasText: VIC }).first().click(); await pg.waitForFunction((n) => (document.querySelector('#dvpDetail .pai-nm') || {}).textContent === n, VIC, { timeout: 15000 });
      await pg.locator('#paBan').click(); await pg.waitForSelector('#paBanBox [data-ban]', { timeout: 5000 }); await delay(200);
      const bm = await sizeOf('#paBanBox'); const nBan = await pg.locator('#paBanBox [data-ban]').count();
      const con = await pg.evaluate(() => { const L = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
        return [...document.querySelectorAll('#paBanBox [data-ban]')].map(b => { const cs = getComputedStyle(b); const fg = L(cs.color), bg = L(cs.backgroundColor); const r = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05); return { t: b.textContent.trim(), r: +r.toFixed(2), fg: cs.color, bg: cs.backgroundColor }; }); });
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'fix-banmenu-' + lab + '.png') });
      ck('CONTROL ' + lab + ': the ban menu has its 5 ban buttons', nBan === 5);
      ck('F2 ' + lab + ': every text line of the ban menu is at least 16 layout px tall', bm && bm.min >= 16, JSON.stringify(bm));
      ck('F3 ' + lab + ': every red ban button\'s label has contrast >= 4.5:1 with its red', con.length === 5 && con.every(x => x.r >= 4.5), JSON.stringify(con));
      /* the banner is back in the game once the panel is closed */
      await pg.locator('#dvpOv [data-dvclose]').click(); await delay(300);
      const back = await pg.evaluate(() => { const n = document.getElementById('ewNotice'); return !!n && getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().height > 0; });
      ck('CONTROL ' + lab + ': with the panel closed the banner shows in the game', back);
      await ctx.close();
    }
    ck('no page errors', errs.length === 0, errs.join(' | '));
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); if (srv) console.log(srv.log.slice(-600)); }
  finally { try { if (br) await br.close(); } catch (_) {} await stop(); }
  console.log('test_devpanel_fix_1383.js: ' + (control ? 'CONTROL ' + ROOT + ' ' : '') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
