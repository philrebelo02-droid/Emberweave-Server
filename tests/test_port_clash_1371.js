// v1371: server.js must EXIT (code 98) when its port is taken, without writing its world file.
// Before: EADDRINUSE fell into the uncaughtException backstop, which logs and keeps running - a zombie with timers and DB writes.
const cp = require('child_process'), net = require('net'), fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..'); let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
(async () => {
  const blocker = net.createServer(); await new Promise(r => blocker.listen(0, r)); const port = blocker.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clash-')); const db = path.join(dir, 'db.json');
  const t0 = Date.now(); let out = '';
  const ch = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: db, HOST: '127.0.0.1' }, windowsHide: true });
  ch.stdout.on('data', d => out += d); ch.stderr.on('data', d => out += d);
  const code = await new Promise(r => { const t = setTimeout(() => { ch.kill(); r('still running'); }, 30000); ch.on('exit', c => { clearTimeout(t); r(c); }); });
  ok(code === 98, 'server exits with code 98 when the port is taken (got ' + code + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  ok(/unavailable \(EADDRINUSE\)/.test(out), 'it says why');
  ok(!/uncaughtException/.test(out), 'the clash never reaches the backstop');
  blocker.close();
  console.log('test_port_clash_1371.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
