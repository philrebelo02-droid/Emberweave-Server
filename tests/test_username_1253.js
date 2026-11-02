// v1253 (Phil 1 Nov 2026: "USERNAME is not the same as your NICKNAME" / "usernames should never be changeable" / "which made my log in
// for the other servers not devs"). A real Server 1 (account server) and Server 2 (satellite): a rename changes the nickname only, the
// username still signs in (on both servers), the nickname does not, nobody can take another player's username, a dev on Server 1 is a
// dev on Server 2, and an account renamed before v1253 gets its first name back as its username.
// Usage: node tests/test_username_1253.js [repo dir]     exit 0 = every check passed. Control: run against the v1252 server.js - it FAILS.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), http = require('http');
const dir = process.argv[2] || path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v1253-'));
const DB1 = path.join(tmp, 's1', 'db1.json'), DB2 = path.join(tmp, 's2', 'db2.json');
fs.mkdirSync(path.dirname(DB1)); fs.mkdirSync(path.dirname(DB2));
const P1 = 8760 + Math.floor(Math.random() * 40), P2 = P1 + 50, SECRET = 'test-link-secret-1253';
const FLAGS = { VAULT_MIN_BATTLE_MS: '0', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', GLYPH_RL_PER_MIN: '1000' };
let pass = 0, fail = 0; const procs = {};
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function start(name, port, env) {
  const e = Object.assign({}, process.env, FLAGS, { PORT: String(port), NODE_PATH: path.join(process.argv[3] || dir, 'node_modules') }, env);
  delete e.ADMIN_IDS; Object.assign(e, env);
  procs[name] = cp.spawn(process.execPath, ['server.js'], { cwd: dir, env: e, stdio: ['ignore', fs.openSync(path.join(tmp, name + '.log'), 'a'), fs.openSync(path.join(tmp, name + '.log'), 'a')] });
}
async function stop(name) { if (procs[name]) { procs[name].kill(); await sleep(1200); delete procs[name]; } }
function call(port, p, body, token) {
  return new Promise(res => {
    const data = body ? JSON.stringify(body) : null;
    const rq = http.request({ host: '127.0.0.1', port, path: p, method: data ? 'POST' : 'GET',
      headers: Object.assign({ 'content-type': 'application/json' }, token ? { 'x-token': token } : {}, data ? { 'content-length': Buffer.byteLength(data) } : {}) },
      r => { let d = ''; r.on('data', x => d += x); r.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch (e) {} res({ status: r.statusCode, body: j }); }); });
    rq.on('error', () => res({ status: 0, body: {} })); if (data) rq.write(data); rq.end();
  });
}
async function up(port) { for (let i = 0; i < 80; i++) { const r = await call(port, '/version.json'); if (r.status === 200) return true; await sleep(250); } return false; }
const login = (port, name, pw) => call(port, '/api/login', { name, pass: pw });
(async () => {
  try {
    start('s1a', P1, { DB_FILE: DB1, ACCOUNT_LINK_SECRET: SECRET }); await up(P1);
    const ph = await call(P1, '/api/register', { name: 'phil', pass: 'philpass123' }); const PHIL = ph.body.profile && ph.body.profile.id;
    await call(P1, '/api/register', { name: 'bob', pass: 'bobpass123' });
    await call(P1, '/api/register', { name: 'carl', pass: 'carlpass123' });
    await stop('s1a');
    // Server 1 makes phil a dev; Server 2 has NO admin list of its own - the role must come from Server 1
    start('s1', P1, { DB_FILE: DB1, ACCOUNT_LINK_SECRET: SECRET, ADMIN_IDS: PHIL }); await up(P1);
    start('s2', P2, { DB_FILE: DB2, ACCOUNT_LINK_SECRET: SECRET, ACCOUNT_AUTHORITY: 'http://127.0.0.1:' + P1, ACCOUNT_STATUS_MS: '1000', SERVER_NAME: 'Server 2' }); await up(P2);
    ok(!!PHIL, 'setup: phil, bob, carl registered on Server 1');

    const t1 = (await login(P1, 'phil', 'philpass123')).body.token;
    const rn = await call(P1, '/api/account/rename', { name: 'Emberweave TEST', requestId: 'r1253a' }, t1);
    ok(rn.status === 200 && rn.body.ok, 'phil renames to "Emberweave TEST" (got ' + rn.status + ' ' + JSON.stringify(rn.body).slice(0, 80) + ')');
    let a = await login(P1, 'phil', 'philpass123');
    ok(a.status === 200 && a.body.profile && a.body.profile.name === 'Emberweave TEST' && a.body.profile.login === 'phil',
      'Server 1: username "phil" still signs in; nickname is "Emberweave TEST" (got ' + a.status + ' ' + JSON.stringify(a.body.profile && { n: a.body.profile.name, l: a.body.profile.login }) + ')');
    a = await login(P1, 'Emberweave TEST', 'philpass123');
    ok(a.status === 401 && !a.body.token, 'Server 1: the nickname is not a username (got ' + a.status + ')');

    const tb = (await login(P1, 'bob', 'bobpass123')).body.token;
    a = await call(P1, '/api/account/rename', { name: 'phil', requestId: 'r1253b' }, tb);
    ok(a.status === 400 && /taken/i.test(a.body.error || ''), 'bob cannot take "phil" as a nickname - it is phil\'s username (got ' + JSON.stringify(a.body).slice(0, 70) + ')');
    a = await call(P1, '/api/register', { name: 'Phil', pass: 'otherpass123' });
    ok(a.status === 409, 'nobody can sign up as "Phil" (got ' + a.status + ')');
    a = await call(P1, '/api/account/rename', { name: 'phil', requestId: 'r1253c' }, (await login(P1, 'phil', 'philpass123')).body.token);
    ok(!/taken/i.test(a.body.error || ''), 'phil may set his nickname back to his own username on purpose (got ' + JSON.stringify(a.body).slice(0, 70) + ')');

    a = await login(P2, 'phil', 'philpass123');
    ok(a.status === 200 && a.body.profile && a.body.profile.login === 'phil', 'Server 2: username "phil" signs in (got ' + a.status + ')');
    ok(!!(a.body.profile && a.body.profile.admin), 'Server 2: phil is a dev there too - the role comes from Server 1');
    a = await login(P2, 'Emberweave TEST', 'philpass123');
    ok(a.status !== 200 && !a.body.token, 'Server 2: the nickname does not sign in (got ' + a.status + ')');
    a = await login(P2, 'bob', 'bobpass123');
    ok(a.status === 200 && !(a.body.profile && a.body.profile.admin), 'Server 2: bob is not a dev');

    // an account renamed BEFORE v1253 (no login stored, sign-in moved with the rename): its first name comes back as its username
    await stop('s2'); await stop('s1');
    const db = JSON.parse(fs.readFileSync(DB1, 'utf8')); const C = db.byName.carl, cu = db.users[C];
    delete cu.login; cu.name = 'Carlito'; cu.renames = 1; delete db.byName.carl; db.byName.carlito = C;
    cu.led = cu.led || {}; cu.led.txs = (cu.led.txs || []).concat([{ id: 'x1253', t: Date.now() - 60000, src: 'account:rename', d: { gems: 0, from: 'carl', to: 'Carlito' } }]);
    fs.writeFileSync(DB1, JSON.stringify(db));
    start('s1', P1, { DB_FILE: DB1, ACCOUNT_LINK_SECRET: SECRET, ADMIN_IDS: PHIL }); await up(P1);
    a = await login(P1, 'carl', 'carlpass123');
    ok(a.status === 200 && a.body.profile && a.body.profile.name === 'Carlito', 'old rename: "carl" signs in again, nickname stays "Carlito" (got ' + a.status + ')');
    a = await login(P1, 'Carlito', 'carlpass123');
    ok(a.status === 401, 'old rename: the nickname "Carlito" no longer signs in (got ' + a.status + ')');
  } catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
  for (const n of Object.keys(procs)) procs[n].kill();
  console.log('test_username_1253.js: ' + pass + ' passed, ' + fail + ' failed');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail ? 1 : 0);
})();
