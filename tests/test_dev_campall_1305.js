/* v1305 (Phil 7 Nov: "Please make an unlock all stages dev option in dev panel, it unlocks all campaign stages" - hotfix): the Dev panel's
   "Unlock all stages" sets the ledger's campaign to all CAMPAIGN_NODES cleared (the dev-only campCleared field of /api/admin/led-grant);
   a non-admin is refused by the server. Real server (temp DB) + real page. CONTROL: TP_ROOT=<a pre-v1305 checkout> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
let pass = 0, fail = 0; const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-ca1305-')), dbFile = path.join(tmp, 'db.json'); let srv = null, br = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const env = { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0' };
  const start = async () => { srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore', windowsHide: true }); for(const _t0=Date.now();Date.now()-_t0<60000&&!(srv&&srv.exitCode!==null);) { try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count */ };
  const post = (u, b, tok) => fetch(base + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: JSON.stringify(b) }).then(r => r.json().catch(() => ({})));
  try {
    await start();
    const dev = 'cadev' + Date.now().toString(36), plain = 'capl' + Date.now().toString(36);
    await post('/api/register', { name: dev, pass: 'password1' }); const rp = await post('/api/register', { name: plain, pass: 'password1' });
    await delay(1500); srv.kill(); await delay(1500);
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); const du = Object.values(db.users).find(x => x.name === dev || x.login === dev); du.role = 'admin'; du.admin = true;
    fs.writeFileSync(dbFile, JSON.stringify(db)); await start();
    const refused = await post('/api/admin/led-grant', { campCleared: 160 }, (await post('/api/login', { name: plain, pass: 'password1' })).token);
    ck('a normal player cannot use it (the server refuses the grant)', !refused.ok, JSON.stringify(refused).slice(0, 120));
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    br = await chromium.launch({ args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const pg = await (await br.newContext({ viewport: { width: 1000, height: 462 }, serviceWorkers: 'block' })).newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof devAction === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(1500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(500);
    await pg.evaluate(async (n) => { const r = await api('/api/login', 'POST', { name: n, pass: 'password1' }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); show('home'); }, dev);
    await delay(1200);
    const label = await pg.evaluate(() => t('set2.dev_campall'));
    ck('the Dev panel has "Unlock all stages"', label === 'Unlock all stages', label);
    const r = await pg.evaluate(async () => { const box = document.createElement('div'); box.innerHTML = '<div id="devDone"></div>'; document.body.appendChild(box);
      devAction('campall', box); for (let i = 0; i < 40 && !/unlocked|refused|unavailable/i.test(box.querySelector('#devDone').textContent); i++) await new Promise(r => setTimeout(r, 150));
      const l = await api('/api/ledger'); return { msg: box.querySelector('#devDone').textContent, cleared: l && l.ledger ? l.ledger.camp && l.ledger.camp.cleared : (l && l.camp && l.camp.cleared), g: G.campaignCleared, nodes: CAMPAIGN_NODES }; });
    ck('pressing it clears all ' + r.nodes + ' campaign stages on the server', r.cleared === r.nodes && r.nodes === 160, JSON.stringify(r));
    ck('...and the game shows them (G.campaignCleared = 160) with the done line', r.g === 160 && /All 160 campaign stages unlocked/.test(r.msg), JSON.stringify(r));
    ck('no page errors', errs.length === 0, errs.join(' | '));
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { try { if (br) await br.close(); } catch (_) {} if (srv) srv.kill(); }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
