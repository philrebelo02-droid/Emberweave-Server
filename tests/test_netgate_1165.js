/* v1165 - NO FALSE "Lost Server 1" (Phil 16 Oct 2026 08:31: "the server constantly says its disconnected. I am fairly certain its not
   actually disconnected" - /api/health answered in 0.2 s every time; his overlay sat over a running Vault fight).
   Real page (Chromium, phone 844x390) on a local server with a temp DB; silent. /api/health and /api/* are steered with page.route.
     A  a phone under load: /api/health answers only after 6.5 s, a chat socket close, and a 5 s main-thread stall - no overlay in 25 s
     A2 a 12 s main-thread stall while a check is out (its timer fires 2 s+ late, the check does not count) - no overlay
     B  a real outage: every /api/ request fails (502) for 22 s - the overlay appears, and goes when the server answers again
     C  the battle loading screen: misses while it is up show nothing unless a real game request failed
   Control: NG_ROOT=<a v1164 checkout> must FAIL A (the old 6 s abort + two quick checks on a socket close showed the false overlay). */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.NG_ROOT || path.join(__dirname, '..');
const control = !!process.env.NG_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 500) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-ng-'));
  let srv = null, browser = null;
  try {
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(SILENT);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    let mode = 'pass';   // how /api/* answers: pass | slowHealth | down
    await pg.route('**/api/**', async route => { const u = route.request().url();
      try { if (mode === 'down') return await route.fulfill({ status: 502, contentType: 'text/html', body: '<h1>502</h1>' });
        if (mode === 'slowHealth' && /\/api\/health/.test(u)) { await delay(6500); return await route.continue(); }
        return await route.continue(); } catch (e) {} });
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1200);
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'ng' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await delay(4000);
    const shown = () => pg.evaluate(() => { const e = document.getElementById('netGate'); return !!(e && e.style.display !== 'none' && /Lost|down/.test(e.textContent || '')); });
    const watch = async (ms, stopEarly) => { let any = false, firstAt = null; const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await shown()) { any = true; if (firstAt == null) firstAt = Date.now() - t0; if (stopEarly) break; } await delay(400); } return { any, firstAt }; };
    const settle = async () => { mode = 'pass'; await pg.evaluate(async () => { NETGATE.busy = false; await netGateCheck(); }); await delay(800); };
    ck(!(await shown()), 'start: no overlay');

    /* A: slow health (6.5 s), a chat socket close, a 5 s stall */
    mode = 'slowHealth';
    await pg.evaluate(() => { try { if (CHATNET.ws && CHATNET.ws.onclose) CHATNET.ws.onclose(); else netGateCheck(); } catch (e) {} });
    await delay(150);
    await pg.evaluate(() => { const t = performance.now(); while (performance.now() - t < 5000) {} });
    const A = await watch(25000, true);
    ck(!A.any, 'A  a phone under load (health answers after 6.5 s, a chat socket close, a 5 s stall): no overlay in 25 s', JSON.stringify(A));
    await settle();

    /* A2: a 12 s stall while a check is out */
    mode = 'pass';
    if (!control) {
      await pg.evaluate(() => { NETGATE.busy = false; netGateCheck(); });
      await pg.evaluate(() => { const t = performance.now(); while (performance.now() - t < 12000) {} });
      const A2 = await watch(6000, true);
      const st = await pg.evaluate(() => ({ down: NETGATE.down }));
      ck(!A2.any && st.down === 0, 'A2 a 12 s main-thread stall during a check: the late timer does not count a miss, no overlay', JSON.stringify([A2, st]));
      await settle();
    }

    /* B: a real outage */
    mode = 'down';
    await pg.evaluate(() => { try { if (CHATNET.ws && CHATNET.ws.onclose) CHATNET.ws.onclose(); } catch (e) {} NETGATE.busy = false; netGateCheck(); });
    const B = await watch(22000, true);
    ck(B.any && B.firstAt >= 9000, 'B  a real outage (every /api/ request 502): the overlay appears (after ' + B.firstAt + ' ms - 3 misses over 12 s)', JSON.stringify(B));
    mode = 'pass';
    let gone = false; for (let i = 0; i < 30 && !gone; i++) { await delay(500); gone = !(await shown()); }
    ck(gone, 'B  the server answers again: the overlay goes');
    await settle();

    /* C: misses during the battle loading screen show nothing unless a game request failed */
    if (!control) {
      // (NETGATE.busy holds the background checks off while the state is set by hand; the overlay is read in the same task)
      const vis = () => { const e = document.getElementById('netGate'); return !!(e && e.style.display !== 'none' && /Lost|down/.test(e.textContent || '')); };
      const c1 = await pg.evaluate(v => { window.__ldr = showBattleLoader({ mine: ['vael', 'vex'], foe: [], title: 'THE VAULT' }); NETGATE.busy = true; NETGATE.apiFail = 0; NETGATE.down = 5; NETGATE.first = Date.now() - 20000; NETGATE.serverDown = false; netGateUpdate(); return eval(v)(); }, '(' + vis + ')');
      const c2 = await pg.evaluate(v => { NETGATE.apiFail = Date.now(); netGateUpdate(); return eval(v)(); }, '(' + vis + ')');
      await pg.evaluate(() => { try { window.__ldr.close(); } catch (e) {} const l = document.getElementById('battleLoader'); if (l) l.remove(); NETGATE.down = 0; NETGATE.first = 0; NETGATE.apiFail = 0; NETGATE.busy = false; netGateUpdate(); });
      ck(!c1 && c2, 'C  the battle loading screen: 5 health misses alone show nothing; with a failed game request the overlay shows', JSON.stringify([c1, c2]));
      /* real traffic wins: a game request answering resets the count */
      const rt = await pg.evaluate(async () => { NETGATE.down = 2; NETGATE.first = Date.now() - 5000; await api('/api/health'); return NETGATE.down; });
      ck(rt === 0, 'any answered game request (/api/*) resets the miss count', rt);
    }
    ck(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
  } catch (e) { fail++; console.log('  FAIL harness: ' + (e && e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (_) {} try { if (srv) srv.kill(); } catch (_) {} try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  console.log(''); console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (control) { console.log(fail ? 'CONTROL: failed as it must' : 'CONTROL DID NOT FAIL'); process.exit(fail ? 0 : 1); }
  process.exit(fail ? 1 : 0);
})();
