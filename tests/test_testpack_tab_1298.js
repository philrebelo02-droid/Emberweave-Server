/* v1298 (Phil 6 Nov: "also please put it in a seperate tab" / "put it in limited"): the real $1 TEST PACK is in the Limited tab of the
   diamond shop and not among the Diamonds chests. Real server (temp DB) + real page (Chromium). CONTROL: TP_ROOT=<a pre-v1298 checkout> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-tp1298-')), dbFile = path.join(tmp, 'db.json');
  let srv = null, browser = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  try {
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    for(const _t0=Date.now();Date.now()-_t0<60000&&!(srv&&srv.exitCode!==null);) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {} await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count */
    await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'tpTester', pass: 'password1' }) });
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--disable-audio-output', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'],  args }); } catch (e) { browser = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'],  channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(800);
    await pg.evaluate(async () => { const r = await api('/api/login', 'POST', { name: 'tpTester', pass: 'password1' }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name;
      G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} try { document.body.classList.remove('gated'); } catch (e) {} show('home'); });
    await delay(1500);
    await pg.evaluate(() => openHudShop('gem')); await delay(1500);
    const names = () => pg.evaluate(() => [...document.querySelectorAll('#hudShopBody .st2-card')].map(c => c.getAttribute('aria-label') || ''));
    const dia = await names();
    ck(dia.length >= 5 && !dia.some(n => /TEST PACK/.test(n)), 'Diamonds tab: the chests, no TEST PACK (' + dia.length + ' cards)', dia.join(' | '));
    const hasTab = await pg.evaluate(() => !!document.querySelector('.st2-tab[data-tab="limited"]'));
    ck(hasTab, 'the shop has the Limited tab');
    if (hasTab) { await pg.click('.st2-tab[data-tab="limited"]'); await delay(800); }
    const tst = await names();
    ck(hasTab && tst.length === 1 && /TEST PACK \(REAL PURCHASE DONT CLICK\)/.test(tst[0]) && /\$1\.00/.test(tst[0]), 'Limited tab: only the TEST PACK at $1.00', tst.join(' | '));
    if (process.env.TP_SHOT) await pg.screenshot({ path: process.env.TP_SHOT });
    ck(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch (e) { ck(false, 'run', e.stack || e); }
  finally { try { if (browser) await browser.close(); } catch (_) {} if (srv) srv.kill(); }
  if (control) { console.log('CONTROL: ' + fail + ' check(s) failed as expected'); process.exit(fail ? 0 : 1); }
  console.log('test_testpack_tab_1298.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
