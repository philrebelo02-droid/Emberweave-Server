// ANDROID APP (30 Oct 2026): the Play app (Trusted Web Activity com.emberweave.heroes) only opens full-screen, with no browser bar,
// when https://<host>/.well-known/assetlinks.json names its package and signing-key fingerprint. Checks, on a real server:
//   - GET /.well-known/assetlinks.json is 200, Content-Type application/json, and parses to a handle_all_urls statement for
//     android_app com.emberweave.heroes with the upload key's SHA-256 fingerprint (the file on disk, byte for byte);
//   - the other root static files still answer as before (manifest, icons, sw.js, version.json, patchnotes.json) and / is still
//     the site page, /play the game.
// Usage: node tests/test_assetlinks_android.js [repo dir]    exit 0 = every check passed. Control: a checkout without the route
// (before this branch) must FAIL (the path falls through to the game page as text/html).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), http = require('http');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const PKG = 'com.emberweave.heroes';
const FP = '17:56:1C:F7:05:C3:0A:C4:92:98:CF:1D:97:D0:71:29:2B:B0:A9:07:A7:9B:96:62:3D:F4:E7:E3:A7:FF:71:F7';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'assetlinks-'));
const port = 8900 + Math.floor(Math.random() * 90);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const env = Object.assign({}, process.env, { PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), DATABASE_URL: '', SMTP_HOST: '', BUSY_SHED: '0', GAME_URL: 'http://127.0.0.1:9' });
const log = fs.openSync(path.join(tmp, 'server.log'), 'a');
const srv = cp.spawn(process.execPath, ['server.js'], { cwd: dir, env, stdio: ['ignore', log, log], windowsHide: true });
function get(p) {
  return new Promise(res => {
    const rq = http.get({ host: '127.0.0.1', port, path: p }, r => { const b = []; r.on('data', x => b.push(x)); r.on('end', () => res({ status: r.statusCode, h: r.headers, buf: Buffer.concat(b) })); });
    rq.on('error', () => res({ status: 0, h: {}, buf: Buffer.alloc(0) })); rq.setTimeout(10000, () => rq.destroy());
  });
}
(async () => {
  let up = false;
  for (let i = 0; i < 300 && !up; i++) { const r = await get('/health'); up = r.status === 200; if (!up) await sleep(200); }
  ok(up, 'server started on port ' + port);
  if (up) {
    const r = await get('/.well-known/assetlinks.json');
    ok(r.status === 200, 'GET /.well-known/assetlinks.json -> 200 (got ' + r.status + ')');
    ok(/^application\/json\b/.test(String(r.h['content-type'] || '')), 'Content-Type is application/json (got ' + r.h['content-type'] + ')');
    let j = null; try { j = JSON.parse(r.buf.toString('utf8')); } catch (e) {}
    ok(Array.isArray(j) && j.length >= 1, 'body parses as a JSON array of statements');
    const st = Array.isArray(j) ? j.find(s => s && s.target && s.target.namespace === 'android_app' && s.target.package_name === PKG) : null;
    ok(!!st, 'a statement targets android_app ' + PKG);
    ok(!!st && Array.isArray(st.relation) && st.relation.includes('delegate_permission/common.handle_all_urls'), 'relation delegate_permission/common.handle_all_urls');
    ok(!!st && Array.isArray(st.target.sha256_cert_fingerprints) && st.target.sha256_cert_fingerprints.includes(FP), 'sha256_cert_fingerprints holds the upload key fingerprint');
    const disk = (() => { try { return fs.readFileSync(path.join(dir, '.well-known', 'assetlinks.json')); } catch (e) { return null; } })();
    ok(!!disk && disk.equals(r.buf), 'served bytes are the repo file .well-known/assetlinks.json');
    // the other root static files are unchanged
    const man = await get('/manifest.webmanifest');
    ok(man.status === 200 && /application\/manifest\+json/.test(man.h['content-type'] || ''), '/manifest.webmanifest still 200 application/manifest+json');
    for (const [u, t] of [['/icon-192.png', 'image/png'], ['/icon-512.png', 'image/png'], ['/icon-512-maskable.png', 'image/png'], ['/sw.js', 'application/javascript'], ['/version.json', 'application/json'], ['/patchnotes.json', 'application/json']]) {
      const x = await get(u); ok(x.status === 200 && String(x.h['content-type'] || '').startsWith(t), u + ' still 200 ' + t + ' (got ' + x.status + ' ' + x.h['content-type'] + ')');
    }
    const site = await get('/'), play = await get('/play');
    ok(site.status === 200 && /text\/html/.test(site.h['content-type'] || ''), '/ still the site page (text/html)');
    ok(play.status === 200 && /text\/html/.test(play.h['content-type'] || ''), '/play still the game page (text/html)');
    const other = await get('/.well-known/other.json');
    ok(!/application\/json/.test(other.h['content-type'] || ''), 'only assetlinks.json is served from .well-known (other.json is not JSON)');
  }
  srv.kill(); for (let i = 0; i < 60 && srv.exitCode === null && srv.signalCode === null; i++) await sleep(50);
  console.log((fail ? 'FAILED' : 'PASSED') + ': ' + pass + ' ok, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
