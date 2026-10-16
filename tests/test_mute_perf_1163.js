/* v1163 LAG FIX - the mute button costs nothing while the player browses (Phil 16 Oct 2026: "Game is lagging alot lately", "While im
   going through hero tab it was"). v1159-v1162 re-measured the button's spot every second (setInterval) with up to ~435 elementFromPoint
   probes on a busy window, forcing layout over the Heroes grid again and again.
   Real page (Chromium, phone 915x412, Phil's) on a local server with a temp DB; silent (--mute-audio + every destination through a gain of
   0); SwiftShader. The Heroes window (60 hero cards: owned + still collecting) is opened from the hub, then 5 s idle and 5 s of real wheel
   scrolling are measured three ways:
     NOW      this page as it ships
     NO BTN   the same page with the button removed (muteBtnPlace a no-op) - the floor
     CONTROL  this page with v1162's 1 s re-measure put back (setInterval(muteBtnPlace(true), 1000))
   Time in muteBtnPlace is summed by a wrapper installed before the game script runs (setInterval / setTimeout callbacks named muteBtnPlace
   and every call by name), long tasks by PerformanceObserver('longtask').
   Asserts: NOW spends < 1 ms per second in muteBtnPlace, idle and scrolling; NOW has no more long tasks than NO BTN (+1 for noise); the
   CONTROL breaks the 1 ms/s budget (so the check can fail). PERF_ROOT=<a v1162 checkout> measures v1162 the same way (it must FAIL).
   Prints the figures for the SHIPPED note. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.PERF_ROOT || path.join(__dirname, '..');
const control = !!process.env.PERF_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 500) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const INIT = () => {
  const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); };
  window.__AC = []; const AC = window.AudioContext; window.AudioContext = function () { const c = new AC(...arguments); window.__AC.push(c); return c; };
  window.AudioContext.prototype = AC.prototype; window.webkitAudioContext = window.AudioContext;
  /* time spent in muteBtnPlace, however it is called */
  const P = window.__mp = { ms: 0, n: 0, depth: 0 };
  const timed = f => function () { if (P.depth) return f.apply(this, arguments); P.depth++; const a = performance.now(); try { return f.apply(this, arguments); } finally { P.ms += performance.now() - a; P.n++; P.depth--; } };
  window.__mpTimed = timed;
  for (const k of ['setInterval', 'setTimeout']) { const o = window[k]; window[k] = function (f, ...r) { if (typeof f === 'function' && f.name === 'muteBtnPlace') f = timed(f); return o.call(this, f, ...r); }; }
  window.__lt = { n: 0, ms: 0 };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__lt.n++; window.__lt.ms += e.duration; } }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
};
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-mperf-'));
  let srv = null, browser = null; const R = {};
  try {
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1200);
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'pf' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await delay(2500);
    // every call by name goes through the timer too (calls from show(), the observer, resize...)
    await pg.evaluate(() => { if (typeof muteBtnPlace === 'function' && !window.__mpReal) { window.__mpReal = muteBtnPlace; window.muteBtnPlace = window.__mpTimed(window.__mpReal); } });
    await pg.evaluate(() => popoutScreen('heroesPanel')); await delay(3000);
    const cards = await pg.evaluate(() => document.querySelectorAll('#heroList .hero-card').length);
    ck(cards >= 60, 'the Heroes window shows ' + cards + ' hero cards (all 60: owned + still collecting)');
    const box = await pg.evaluate(() => { const r = document.getElementById('heroesPanel').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const measure = async label => {
      await pg.evaluate(() => { const el = document.getElementById('heroesPanel'); el.scrollTop = 0; }); await delay(1500);
      await pg.evaluate(() => { window.__mp.ms = 0; window.__mp.n = 0; window.__lt.n = 0; window.__lt.ms = 0; });
      await delay(5000);
      const idle = await pg.evaluate(() => ({ ms: window.__mp.ms, n: window.__mp.n, lt: window.__lt.n, ltms: window.__lt.ms }));
      await pg.evaluate(() => { window.__mp.ms = 0; window.__mp.n = 0; window.__lt.n = 0; window.__lt.ms = 0; });
      await pg.mouse.move(box[0], box[1]); const t0 = Date.now(); let dir = 1;
      while (Date.now() - t0 < 5000) { await pg.mouse.wheel(0, 120 * dir); await delay(40);
        const st = await pg.evaluate(() => { const el = document.getElementById('heroesPanel'); return [el.scrollTop, el.scrollHeight - el.clientHeight]; });
        if (st[0] >= st[1] - 2) dir = -1; else if (st[0] <= 0) dir = 1; }
      const scroll = await pg.evaluate(() => ({ ms: window.__mp.ms, n: window.__mp.n, lt: window.__lt.n, ltms: window.__lt.ms, top: document.getElementById('heroesPanel').scrollTop }));
      const out = { idle: { msPerS: +(idle.ms / 5).toFixed(2), calls: idle.n, longTasks: idle.lt, longMs: Math.round(idle.ltms) }, scroll: { msPerS: +(scroll.ms / 5).toFixed(2), calls: scroll.n, longTasks: scroll.lt, longMs: Math.round(scroll.ltms) } };
      console.log('  ' + label.padEnd(8) + JSON.stringify(out)); R[label] = out; return out; };
    const now = await measure(control ? 'BASE' : 'NOW');
    ck(now.idle.msPerS < 1 && now.scroll.msPerS < 1, (control ? 'BASE' : 'NOW') + ': under 1 ms per second in muteBtnPlace, idle (' + now.idle.msPerS + ') and scrolling the hero grid (' + now.scroll.msPerS + ')');
    // NO BTN: the floor
    await pg.evaluate(() => { window.muteBtnPlace = function () {}; const b = document.getElementById('muteBtn'); if (b) b.remove(); });
    const nob = await measure('NO BTN');
    ck(now.idle.longTasks + now.scroll.longTasks <= nob.idle.longTasks + nob.scroll.longTasks + 1, (control ? 'BASE' : 'NOW') + ': no more long tasks than with the button removed (' + (now.idle.longTasks + now.scroll.longTasks) + ' vs ' + (nob.idle.longTasks + nob.scroll.longTasks) + ')');
    if (!control) {   // CONTROL: v1162's once-a-second re-measure put back
      await pg.evaluate(() => { window.muteBtnPlace = window.__mpTimed(window.__mpReal); window.muteBtnPlace(true); window.__ctlIv = setInterval(() => window.muteBtnPlace(true), 1000); });
      const c = await measure('CONTROL');
      await pg.evaluate(() => clearInterval(window.__ctlIv));
      ck(!(c.idle.msPerS < 1 && c.scroll.msPerS < 1), 'CONTROL: with a 1 s re-measure put back the budget check FAILS (' + c.idle.msPerS + ' / ' + c.scroll.msPerS + ' ms per second, ' + c.idle.calls + ' + ' + c.scroll.calls + ' calls)');
    }
    ck(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
    await pg.evaluate(async () => { try { for (const c of (window.__AC || [])) await c.close(); } catch (e) {} });
  } catch (e) { fail++; console.log('  FAIL harness: ' + (e && e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (_) {} try { if (srv) srv.kill(); } catch (_) {} try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  console.log('FIGURES ' + JSON.stringify(R));
  console.log(''); console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (control) { console.log(fail ? 'CONTROL: failed as it must' : 'CONTROL DID NOT FAIL'); process.exit(fail ? 0 : 1); }
  process.exit(fail ? 1 : 0);
})();
