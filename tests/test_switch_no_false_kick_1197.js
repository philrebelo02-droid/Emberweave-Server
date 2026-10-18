/* v1197 - NO FALSE "You've been logged out" ON A SERVER SWITCH (Phil 18 Oct 2026: he switched servers, got "Someone just logged into your account
   on another device", yet stayed signed in). An {error:'auth'} reply signs the device out only when the CURRENT server rejects the CURRENT token
   (authConfirmKick): a reply that carried an older token is ignored, a switch in progress is waited out, and the current server is asked again.
   Real page (Chromium, phone 844x390) on a local server with a temp DB; silent (AudioContext removed); WebGL on SwiftShader.
     (1) every inline script parses, and the check catches a broken one
     (2) S1 -> S2 -> S1: two real switches (a handoff code from the session, redeemed with svrRedeem on arrival), each with a stray 'auth' reply
         arriving mid-switch (what the server being left answers): no notice, still signed in as the same account, the profile answers
     (3) a stray 'auth' reply with no switch running, while the server still accepts the token: no notice, still signed in
     (4) a real login elsewhere (the same account signs in from a second browser: single session) still signs this device out with the notice
   CONTROL: with v1196's rule put back (any 'auth' reply kicks at once), the stray reply of (3) shows the false notice - the checks above see it. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 900) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-kick1197-'));
  let srv = null, browser = null;
  try {
    const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
    const parseAll = src => { const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, n = 0; const bad = [];
      while ((m = re.exec(src))) { if (m[1] && /\bsrc=/.test(m[1])) continue; n++; try { new Function(m[2]); } catch (e) { bad.push(n + ': ' + e.message); } } return { n, bad }; };
    const pa = parseAll(html); ck(pa.n >= 3 && !pa.bad.length, '(1) every inline script parses (' + pa.n + ' blocks)', pa.bad.join('; '));
    ck(parseAll(html.replace('async function authConfirmKick(tok){', 'async function authConfirmKick(tok){ var q=\'it\'s\'; ')).bad.length > 0, '(1) CONTROL: the parse check catches an unescaped quote');
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const NAME = 'kick' + Date.now().toString(36), PASS = 'password1';
    const open = async () => { const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' });
      await ctx.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
        /* the stray reply: the next request to a path in window.__stray answers {error:'auth'} (what the server being left answers) */
        window.__stray = null; const F = window.fetch; window.fetch = function (u, o) { const s = window.__stray; if (s && String(u).indexOf(s) >= 0) { window.__stray = null; window.__strayHit = (window.__strayHit || 0) + 1;
            return Promise.resolve(new Response(JSON.stringify({ error: 'auth' }), { status: 401, headers: { 'Content-Type': 'application/json' } })); } return F.apply(this, arguments); }; });
      const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => typeof api === 'function' && typeof authConfirmKick === 'function' && typeof svrRedeem === 'function', null, { timeout: 90000 }); await delay(1500);
      return { ctx, pg, errs }; };
    const A = await open();
    await A.pg.evaluate(async ([n, p]) => { const reg = await api('/api/register', 'POST', { name: n, pass: p }); ACC = { token: reg.token, name: reg.profile.name, id: reg.profile.id, guest: false }; saveAcc();
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} }, [NAME, PASS]);
    const state = () => A.pg.evaluate(async () => { const pr = await fetch('/api/profile', { headers: { 'x-token': ACC.token || '' } }).then(r => r.json()).catch(() => null);
      return { notice: !!document.getElementById('kickedNotice'), token: !!ACC.token, name: ACC.name, id: ACC.id, profile: !!(pr && pr.profile), profName: pr && pr.profile && pr.profile.name, stray: window.__strayHit || 0 }; });
    const s0 = await state();
    /* (2) S1 -> S2 -> S1 */
    const hops = [];
    for (const hop of ['S1->S2', 'S2->S1']) {
      const r = await A.pg.evaluate(async () => { const tokBefore = ACC.token; const code = await svrHandoffCode(); if (!code) return { err: 'no code' };
        _svrSwitchT = Date.now();   /* svrGo's own first step (the page then leaves for the other server) */
        window.__stray = '/api/'; const p = api('/api/quests');   /* a request the server being left answers 'auth' */
        window._svrHandoff = true; svrRedeem(code);   /* the arrival: the switch code signs in where the page stands */
        await p; for (let i = 0; i < 60 && (window._svrSigningIn || window._svrHandoff); i++) await new Promise(z => setTimeout(z, 100));
        return { changed: ACC.token !== tokBefore, code: !!code }; });
      await delay(1500); hops.push(Object.assign({ hop }, r, await state())); }
    ck(hops.every(h => h.code && !h.notice && h.token && h.name === NAME && h.profile && h.profName === NAME && h.stray >= 1) && s0.token && !s0.notice,
      '(2) S1 -> S2 -> S1 with a stray auth reply mid-switch on each hop: no notice, still signed in as ' + NAME + ', the profile answers: ' + JSON.stringify(hops), JSON.stringify({ s0, hops }));
    /* (3) a stray reply, no switch, the token still good */
    await A.pg.evaluate(async () => { _svrSwitchT = 0; window.__stray = '/api/'; await api('/api/quests'); });
    await delay(1500); const s3 = await state();
    ck(!s3.notice && s3.token && s3.profile && s3.stray >= 3, '(3) a stray auth reply with no switch running, the server still accepting the token: no notice, still signed in (' + JSON.stringify(s3) + ')');
    /* (4) a real login elsewhere */
    const B = await open();
    const lb = await B.pg.evaluate(async ([n, p]) => { const r = await api('/api/login', 'POST', { name: n, pass: p, deviceId: 'other-device' }); return !!(r && r.token); }, [NAME, PASS]);
    await A.pg.evaluate(async () => { await api('/api/profile'); }); await delay(2000);
    const s4 = await A.pg.evaluate(() => ({ notice: !!document.getElementById('kickedNotice'), token: !!ACC.token }));
    ck(lb && s4.notice && !s4.token, '(4) a real login elsewhere (signed in from a second browser) still signs this device out with the notice (' + JSON.stringify({ lb, s4 }) + ')');
    /* CONTROL: v1196's rule back */
    const C = await open();
    await C.pg.evaluate(async ([n, p]) => { const r = await api('/api/login', 'POST', { name: n, pass: p }); ACC = { token: r.token, name: r.profile.name, id: r.profile.id, guest: false }; saveAcc();
      authConfirmKick = function () { handleSignedOutElsewhere(); }; window.__stray = '/api/'; await api('/api/quests'); }, [NAME, PASS]);
    await delay(800); const sc = await C.pg.evaluate(() => ({ notice: !!document.getElementById('kickedNotice'), token: !!ACC.token }));
    ck(sc.notice && !sc.token, 'CONTROL: with v1196\'s rule (any auth reply kicks at once) the same stray reply shows the false notice (' + JSON.stringify(sc) + ') - the checks above see it');
    ck(!A.errs.length && !B.errs.length && !C.errs.length, 'no page errors', A.errs.concat(B.errs, C.errs).join(' | '));
  } catch (e) { fail++; console.log('  FAIL ' + (e.stack || e.message)); }
  finally { try { if (browser) await browser.close(); } catch (e) {} try { if (srv) srv.kill(); } catch (e) {} }
  console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
  process.exitCode = fail ? 1 : 0;
})();
