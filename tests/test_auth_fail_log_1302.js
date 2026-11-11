/* v1302 (BUG-0006, tester 7 Nov: "Google sign-in account creation is failing." - S1 had no line saying why): every refused Google / Facebook
   sign-in writes "[authfail] <provider> <reason> <status> <session>" to the server log (no name, token or address), the client reports the
   failure to the boot-step log (authfail:* steps pass the tutorial filter), and the sign-in buttons rebuild with a fresh 10-minute token every
   8 minutes. Real server (temp DB, a dummy Google client id) + the page source. CONTROL: TP_ROOT=<a pre-v1302 checkout> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-af1302-')), dbFile = path.join(tmp, 'db.json'), logF = path.join(tmp, 'srv.log');
  let srv = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  try {
    const log = fs.openSync(logF, 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0', GOOGLE_OAUTH_CLIENT_ID: 'test-client.apps.googleusercontent.com', ACCOUNT_AUTHORITY: '' }, stdio: ['ignore', log, log], windowsHide: true });
    for(const _t0=Date.now();Date.now()-_t0<60000&&!(srv&&srv.exitCode!==null);) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {} await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count */
    const post = (u, b) => fetch(base + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ s: r.status, b: await r.json().catch(() => ({})) }));
    const r1 = await post('/api/auth/google', { credential: 'x', nonce: 'never-issued', deviceId: 'd1' });
    ck(r1.s === 403 && /expired/i.test(r1.b.error || ''), 'an unknown sign-in token is refused (403, "Sign-in expired")', JSON.stringify(r1));
    const cfg = await (await fetch(base + '/api/auth/google/config')).json();
    ck(cfg.enabled && cfg.nonce, 'config hands out a fresh token');
    const r2 = await post('/api/auth/google', { credential: 'not-a-real-google-credential', nonce: cfg.nonce, deviceId: 'd1' });
    ck(r2.s === 403, 'a credential Google would not sign is refused (403)', JSON.stringify(r2));
    await delay(400);
    const L = fs.readFileSync(logF, 'utf8');
    ck(/\[authfail\] google nonce-unknown 403 signed-out/.test(L), 'server log: [authfail] google nonce-unknown 403 signed-out', L.split('\n').filter(x => /authfail|auth/i.test(x)).slice(-3).join(' | '));
    ck(/\[authfail\] google verify:\S+ 403 signed-out/.test(L), 'server log: [authfail] google verify:<reason> 403 (the reason Google verification gave)', L.split('\n').filter(x => /authfail/.test(x)).slice(-3).join(' | '));
    ck(!/not-a-real-google-credential|never-issued/.test(L), 'no credential or token text in the log');
    const H = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
    ck(/!\/\^\(err\|authfail\)\/\.test\(st\)/.test(H), 'client: authfail:* boot steps are sent after the tutorial too');
    ck(/ewStep\('authfail:google',/.test(H) && /ewStep\('authfail:facebook',/.test(H), 'client: a refused Google / Facebook sign-in reports its error as a boot step');
    ck(/ewStep\('authfail:google-script'/.test(H) && /ewStep\('authfail:facebook-sdk'/.test(H), 'client: a blocked Google / Facebook script reports it');
    ck((H.match(/mountGoogleSignin\(root\); \} \},8\*60000\)/g) || []).length === 1 && (H.match(/mountFacebookSignin\(root\); \} \},8\*60000\)/g) || []).length === 1, 'client: both buttons rebuild with a fresh token every 8 minutes (the token lives 10)');
    const S = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    ck(/googleNonces\.set\(nonce,\{until:Date\.now\(\)\+10\*60000/.test(S), 'server: the sign-in token still lives 10 minutes (the 8-minute rebuild stays inside it)');
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { if (srv) srv.kill(); }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
