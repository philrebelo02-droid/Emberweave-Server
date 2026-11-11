/* v1299 (Phil 6 Nov: "the issue isnt how many opted in, its the fact that none of them made it passed the load screen"). Real server (temp
   DB) + real page (phone-sized Chromium): (1) the splash shows TAP TO PLAY once online and hides it after the tap; (2) a new player's phone
   reports its steps to /api/boot-step and the server appends them to boot-steps.jsonl beside the DB (boot, splash-online, tap-play, the
   sign-in gate) with the device line and no name; (3) the endpoint caps junk (no sid -> nothing written; 2 KB body cap; 60/min per address).
   CONTROL: BOOT_ROOT=<a pre-v1299 checkout> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.BOOT_ROOT || path.join(__dirname, '..'), control = !!process.env.BOOT_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-boot1299-')), dbFile = path.join(tmp, 'db.json'), steps = path.join(tmp, 'boot-steps.jsonl');
  let srv = null, browser = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const read = () => { try { return fs.readFileSync(steps, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (_) { return []; } };
  try {
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    for(const _t0=Date.now();Date.now()-_t0<60000&&!(srv&&srv.exitCode!==null);) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {} await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count */
    // (3) junk handling over HTTP
    await fetch(base + '/api/boot-step', { method: 'POST', body: JSON.stringify({ st: 'nosid' }) });
    await fetch(base + '/api/boot-step', { method: 'POST', body: 'x'.repeat(5000) });
    await delay(300);
    ck(read().length === 0, 'a step without a session id, or an oversized body, writes nothing');
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 800, height: 360 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
      userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await delay(6000);
    const tap1 = await pg.evaluate(() => { const e = document.getElementById('splashTap'); return e ? { on: e.classList.contains('on'), txt: e.innerText, op: getComputedStyle(e).opacity } : null; });
    ck(tap1 && tap1.on && /tap to play/i.test(tap1.txt), 'the splash says TAP TO PLAY once online', JSON.stringify(tap1));
    await pg.click('#splashPlay').catch(() => {}); await delay(2500);
    const tap2 = await pg.evaluate(() => { const e = document.getElementById('splashTap'); return e ? e.classList.contains('on') : null; });
    ck(tap2 === false, 'the prompt goes away after the tap');
    await delay(800);
    const rows = read(), st = rows.map(r => r.st);
    ck(['boot', 'splash-online', 'tap-play'].every(s => st.includes(s)) && st.some(s => /^auth:/.test(s)), 'the phone reported boot, splash-online, tap-play and the sign-in gate (' + st.join(', ') + ')');
    const r0 = rows[0] || {};
    ck(/Android 12; SM-A125F/.test(r0.dev || '') && r0.sid && r0.sid.length >= 8 && !('name' in r0) && !('ip' in r0), 'each row carries the device line and a random session id, no name or IP', JSON.stringify(r0));
    ck(new Set(rows.map(r => r.sid)).size === 1 && st.length === new Set(st).size, 'one session id, each step reported once');
    ck(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch (e) { ck(false, 'run', e.stack || e); }
  finally { try { if (browser) await browser.close(); } catch (_) {} if (srv) srv.kill(); }
  if (control) { console.log('CONTROL: ' + fail + ' check(s) failed as expected'); process.exit(fail ? 0 : 1); }
  console.log('test_boot_steps_1299.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
