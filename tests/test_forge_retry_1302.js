/* v1302 (Phil 7 Nov, a tester's hero Equipment tab: "Could not reach the Forge - open it again to retry." / "This is unacceptable"): one failed
   gear request left the Equipment tab on that error for good. Now a load retries (3 tries), and the tab keeps retrying by itself; the error,
   with a Retry button, shows only after 3 failed rounds. Real server (temp DB) + real page (Chromium, phone size); the gear requests are made
   to fail with Playwright routes. CONTROL: TP_ROOT=<a pre-v1302 checkout> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-fr1302-')), dbFile = path.join(tmp, 'db.json');
  let srv = null, browser = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  try {
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    for(const _t0=Date.now();Date.now()-_t0<60000&&!(srv&&srv.exitCode!==null);) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {} await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count */
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    let failLeft = 0, gearCalls = 0;
    await pg.route('**/api/gear/state*', route => { gearCalls++; if (failLeft > 0) { failLeft--; return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"busy"}' }); } return route.continue(); });
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(1500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(600);
    await pg.evaluate(async () => { const r = await api('/api/register', 'POST', { name: 'fr' + Date.now().toString(36), pass: 'password1' }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name;
      G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); show('home'); });
    await delay(1500);
    const openTab = () => pg.evaluate(() => { FORGE.st = null; FORGE.stAt = 0; FORGE.fails = 0; const k = HERO_KEYS.find(k => G.unlocked && G.unlocked[k]) || HERO_KEYS[0];
      detailHero = k; heroTab = 'equip'; popoutScreen('heroDetail'); renderHeroDetail(); return k; });
    const text = () => pg.evaluate(() => (document.getElementById('heroDetailBody') || {}).innerText || '');
    // A) the first 2 gear-state requests fail (a restart blip): the tab must end on the gear, never on the error
    failLeft = 2; gearCalls = 0; await openTab(); await delay(6000);
    let T = await text();
    ck(!/Could not reach the Forge/.test(T), 'two failed gear loads: the Equipment tab never shows "Could not reach the Forge"', T.slice(0, 200));
    ck(gearCalls >= 3, 'it retried the gear state by itself (' + gearCalls + ' requests)');
    ck(await pg.evaluate(() => !!(FORGE.st && FORGE.st.enabled && !FORGE.st.offline)), 'the Forge state is loaded after the blip');
    // B) the server stays down for many tries: loading first, then the error WITH a Retry button; Retry after recovery loads the gear
    failLeft = 1000; gearCalls = 0; await openTab(); await delay(2000);
    T = await text(); ck(!/Could not reach the Forge/.test(T), 'while still retrying the tab shows loading, not the error', T.slice(0, 160));
    for (let i = 0; i < 40 && !/Could not reach the Forge/.test(await text()); i++) await delay(1000);
    if (process.env.DBG) console.log('DBG', JSON.stringify(await pg.evaluate(() => ({ fails: FORGE.fails, refresh: FORGE._refresh, st: FORGE.st, vis: !!(document.getElementById('heroDetail') || {}).offsetParent, state, tab: heroTab, len: ((document.getElementById('heroDetailBody') || {}).innerHTML || '').length }))), gearCalls);
    T = await text();
    ck(/Could not reach the Forge/.test(T) && await pg.evaluate(() => [...document.querySelectorAll('#heroDetailBody button')].some(b => /Retry/.test(b.innerText))), 'after 3 failed rounds: the error and a Retry button', T.slice(0, 200));
    failLeft = 0; await pg.evaluate(() => [...document.querySelectorAll('#heroDetailBody button')].find(b => /Retry/.test(b.innerText)).click()); await delay(4000);
    T = await text(); ck(!/Could not reach the Forge/.test(T) && await pg.evaluate(() => !!(FORGE.st && FORGE.st.enabled && !FORGE.st.offline)), 'Retry after the server is back loads the gear', T.slice(0, 160));
    ck(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (_) {} if (srv) srv.kill(); }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
