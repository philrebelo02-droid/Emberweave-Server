/* v1302 (Phil 7 Nov: "Try doing like 20+ tempers" / "there should be no limit on someone's upgrade amount"): 50 quick Temper x1 taps (10 a
   second) then 5 x 10 in the real Forge popup must ALL land - 100 uses = Temper 7 with 9 progress - with no "Slow down." and no failed gear
   call (v1301: the 80/min gear fence ran out after ~40 taps and the next state read made the Forge "unreachable"). Real server (temp DB, real
   rate limits) + real page. CONTROL: TP_ROOT=<a pre-v1302 checkout> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || require('path').join(__dirname, '..'), control = !!process.env.TP_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-t20-')), dbFile = path.join(tmp, 'db.json'); let srv, br; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const env = { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, SIM_WORKERS: '0' };   // real rate limits (no RL_MUL)
  const start = async () => { srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore', windowsHide: true }); for(const _t0=Date.now();Date.now()-_t0<60000&&!(srv&&srv.exitCode!==null);) { try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count */ };
  try {
    await start();
    const name = 't20' + Date.now().toString(36);
    const reg = await (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, pass: 'password1' }) })).json();
    const cat = await (await fetch(base + '/api/gear/catalog', { headers: { 'x-token': reg.token } })).json();
    await delay(1500); srv.kill(); await delay(1500);
    // seed: lots of dust + one built Grey item (the db file the server wrote)
    let raw = fs.readFileSync(dbFile, 'utf8'); const db = JSON.parse(raw); const u = Object.values(db.users).find(x => x.name === name || x.login === name);
    const grey = cat.items.find(d => d.quality === 'Grey');
    u.dust = 5000000; u.gear = Object.assign(u.gear || {}, { revision: (u.gear && u.gear.revision) || 1, items: { q1: { d: grey.id, temper: 0, prog: 0, dustSpent: 0, bound: false, createdAt: Date.now() } } });
    fs.writeFileSync(dbFile, JSON.stringify(db)); await start();
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    br = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'],  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-audio-output'] });
    const pg = await (await br.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' })).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    const reqs = []; pg.on('response', r => { if (/\/api\/gear\//.test(r.url())) reqs.push(r.status() + ' ' + r.url().replace(/.*\/api/, '')); });
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(1500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(600);
    await pg.evaluate(async (n) => { const r = await api('/api/login', 'POST', { name: n, pass: 'password1' }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); show('home'); }, name);
    await delay(1500);
    await pg.evaluate(async () => { show('forge'); await new Promise(r => setTimeout(r, 3000)); });
    const id = await pg.evaluate(() => { const c = FORGE.st && FORGE.st.items && FORGE.st.items.q1; return c && c.d; });
    await pg.evaluate(id => forgeRow(id), id); await delay(800);
    const log = [];
    for (let i = 0; i < 50; i++) {
      try { await pg.click('#fgPop .fgTBtn', { timeout: 3000 }); } catch (e) { log.push('x1 #' + (i + 1) + ' click failed'); } await delay(100);
      const s = await pg.evaluate(() => ({ t: (FORGE.st.temperByType || {})[FORGE.open] || null, banner: (document.getElementById('banner') || {}).innerText || '', busy: FORGE.busy }));
      log.push('x1 #' + (i + 1) + ' ' + JSON.stringify(s.t) + (s.banner ? ' | ' + s.banner.slice(0, 80) : ''));
    }
    for (let i = 0; i < 5; i++) { const b = await pg.$('#fgPop .fgTBtn2'); if (!b) { log.push('x10: no button'); break; } await b.click(); await delay(400);
      const s = await pg.evaluate(() => ({ t: (FORGE.st.temperByType || {})[FORGE.open] || null, banner: (document.getElementById('banner') || {}).innerText || '' })); log.push('x10 #' + (i + 1) + ' ' + JSON.stringify(s.t) + (s.banner ? ' | ' + s.banner.slice(0, 80) : '')); }
    await delay(1500);
    const fin = await pg.evaluate(() => ({ t: (FORGE.st.temperByType || {})[FORGE.open] || null, off: !!FORGE.st.offline }));
    const bad = reqs.filter(r => !/^200/.test(r)), slow = log.filter(l => /Slow down/.test(l));
    ck(fin.t && fin.t.temper === 7 && fin.t.prog === 9, 'all 100 uses landed: Temper 7, progress 9 (bars 10..16 + 9)', JSON.stringify(fin.t));
    ck(!slow.length, 'no "Slow down." while tapping', slow.slice(0, 2).join(' | '));
    ck(!bad.length, 'every gear call answered 200 (' + reqs.length + ' calls)', bad.slice(0, 4).join(' ; '));
    ck(reqs.length < 100, 'fewer gear calls than tempers (' + reqs.length + ' for 55 taps / 100 uses)');
    ck(!fin.off, 'the Forge is not marked unreachable afterwards');
    ck(!log.some(l => /click failed/.test(l)), 'no tap was lost to a redraw');
    ck(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); } finally { try { await br.close(); } catch (_) {} if (srv) srv.kill(); }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
