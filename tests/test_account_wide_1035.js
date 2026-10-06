// v1035 check: account-wide bans + password reset across a real Server 1 (account server) and Server 2 (satellite).
// Usage: node tests/test_account_wide_1035.js [repo dir]     exit 0 = every check passed (Phil 5 Oct: "ban should be account wide" / "and so should password reset")
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), http = require('http');
const dir = process.argv[2] || path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v1035-'));
const DB1 = path.join(tmp, 'db1.json'), DB2 = path.join(tmp, 'db2.json');
const P1 = 8700 + Math.floor(Math.random() * 40), P2 = P1 + 50, SECRET = 'test-link-secret-123';
const FLAGS = { VAULT_MIN_BATTLE_MS: '0', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', GLYPH_RL_PER_MIN: '1000' };
let pass = 0, fail = 0; const procs = {};
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function start(name, port, env) {
  const e = Object.assign({}, process.env, FLAGS, { PORT: String(port), NODE_PATH: path.join(process.argv[3] || dir, 'node_modules') }, env);
  procs[name] = cp.spawn(process.execPath, ['server.js'], { cwd: dir, env: e, stdio: ['ignore', fs.openSync(path.join(tmp, name + '.log'), 'a'), fs.openSync(path.join(tmp, name + '.log'), 'a')] });
}
async function stop(name) { if (procs[name]) { procs[name].kill(); await sleep(1200); delete procs[name]; } }
function call(port, p, body, token, method) {
  return new Promise(res => {
    const data = body ? JSON.stringify(body) : null;
    const rq = http.request({ host: '127.0.0.1', port, path: p, method: method || (data ? 'POST' : 'GET'),
      headers: Object.assign({ 'content-type': 'application/json' }, token ? { 'x-token': token } : {}, data ? { 'content-length': Buffer.byteLength(data) } : {}) },
      r => { let d = ''; r.on('data', x => d += x); r.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch (e) {} res({ status: r.statusCode, body: j }); }); });
    rq.on('error', () => res({ status: 0, body: {} })); if (data) rq.write(data); rq.end();
  });
}
async function up(port) { for (let i = 0; i < 80; i++) { const r = await call(port, '/version.json'); if (r.status === 200) return true; await sleep(250); } return false; }
const signedIn = r => r.status === 200 && !r.body.error;
(async () => {
  try {
    // Server 1 with an admin
    start('s1a', P1, { DB_FILE: DB1, ACCOUNT_LINK_SECRET: SECRET }); await up(P1);
    const adm = await call(P1, '/api/register', { name: 'dev1', pass: 'password1' }); const ADM = adm.body.profile && adm.body.profile.id;
    await stop('s1a');
    start('s1', P1, { DB_FILE: DB1, ACCOUNT_LINK_SECRET: SECRET, ADMIN_IDS: ADM }); await up(P1);
    start('s2', P2, { DB_FILE: DB2, ACCOUNT_LINK_SECRET: SECRET, ACCOUNT_AUTHORITY: 'http://127.0.0.1:' + P1, ADMIN_IDS: ADM, ACCOUNT_STATUS_MS: '1000', SERVER_NAME: 'Server 2' }); await up(P2);
    const bob = await call(P1, '/api/register', { name: 'bob', pass: 'bobpass123' }); const BOB = bob.body.profile.id;
    await call(P1, '/api/register', { name: 'carl', pass: 'carlpass123' });
    ok(!!ADM && !!BOB, 'setup: admin and players registered on Server 1');

    // --- a ban made on Server 1 follows the account to Server 2
    let b2 = await call(P2, '/api/login', { name: 'bob', pass: 'bobpass123' }); const tB2 = b2.body.token;
    ok(signedIn(await call(P2, '/api/profile', null, tB2)), 'bob signs in on Server 2');
    const a1 = (await call(P1, '/api/login', { name: 'dev1', pass: 'password1' })).body.token;
    const ban = await call(P1, '/api/dev/ban', { id: BOB, days: 1, reason: 'test' }, a1);
    ok(ban.status === 200, 'admin bans bob on Server 1');
    await sleep(2600);
    let pr = await call(P2, '/api/profile', null, tB2);
    ok(!signedIn(pr), 'bob\'s Server 2 session ends within the sync (got ' + pr.status + ' ' + JSON.stringify(pr.body).slice(0, 60) + ')');
    b2 = await call(P2, '/api/login', { name: 'bob', pass: 'bobpass123' });
    pr = await call(P2, '/api/profile', null, b2.body.token);
    ok(pr.status === 403 && pr.body.banned === true, 'bob signing in again on Server 2 is suspended (403 banned)');
    const iss = await new Promise(res => { const d = JSON.stringify({ gid: BOB });
      const rq = http.request({ host: '127.0.0.1', port: P1, path: '/api/internal/account/handoff-issue', method: 'POST', headers: { 'content-type': 'application/json', 'x-link-secret': SECRET, 'content-length': d.length } }, r => { r.resume(); r.on('end', () => res(r.statusCode)); });
      rq.on('error', () => res(0)); rq.write(d); rq.end(); });
    ok(iss === 403, 'Server 1 refuses a server-switch code for the banned account (got ' + iss + ')');
    await call(P1, '/api/dev/ban', { id: BOB, lift: true }, a1);
    await sleep(2600);
    pr = await call(P2, '/api/profile', null, b2.body.token);
    ok(signedIn(pr), 'lifting the ban on Server 1 lifts it on Server 2 (got ' + pr.status + ')');

    // --- a ban made on Server 2 is made on the account
    const a2 = (await call(P2, '/api/login', { name: 'dev1', pass: 'password1' })).body.token;
    const c2 = await call(P2, '/api/login', { name: 'carl', pass: 'carlpass123' });
    const ban2 = await call(P2, '/api/dev/ban', { id: c2.body.profile.id, days: 7, reason: 'test2' }, a2);
    ok(ban2.status === 200 && ban2.body.accountWide === true, 'admin bans carl on Server 2 (account-wide)');
    ok(!signedIn(await call(P2, '/api/profile', null, c2.body.token)), 'carl is signed out on Server 2');
    const c1 = await call(P1, '/api/login', { name: 'carl', pass: 'carlpass123' });
    pr = await call(P1, '/api/profile', null, c1.body.token);
    ok(pr.status === 403 && pr.body.banned === true, 'carl is suspended on Server 1 too');

    // --- a password change on Server 1 signs the account out on Server 2 and kills the old local copy
    const b3 = await call(P2, '/api/login', { name: 'bob', pass: 'bobpass123' }); const tB3 = b3.body.token;
    ok(signedIn(await call(P2, '/api/profile', null, tB3)), 'bob signed in on Server 2 again');
    await stop('s1');
    const db = JSON.parse(fs.readFileSync(DB1, 'utf8')); db.users[BOB].passAt = Date.now(); fs.writeFileSync(DB1, JSON.stringify(db));   // the state a reset leaves
    start('s1', P1, { DB_FILE: DB1, ACCOUNT_LINK_SECRET: SECRET, ADMIN_IDS: ADM }); await up(P1);
    await sleep(2600);
    pr = await call(P2, '/api/profile', null, tB3);
    ok(!signedIn(pr), 'after a password change on Server 1, bob\'s Server 2 session ends (got ' + pr.status + ')');
    await stop('s1');   // Server 1 down: the old password must no longer work through Server 2's local copy
    const old = await call(P2, '/api/login', { name: 'bob', pass: 'bobpass123' });
    ok(!old.body.token, 'with Server 1 down, the old password no longer signs in on Server 2 (got ' + old.status + ' ' + (old.body.error || '') + ')');
    const carlDown = await call(P2, '/api/login', { name: 'dev1', pass: 'password1' });
    ok(!!carlDown.body.token, 'control: an unchanged account still signs in on Server 2 while Server 1 is down');
  } catch (e) { fail++; console.log('  FAIL harness: ' + e.message); }
  for (const n of Object.keys(procs)) procs[n].kill();
  console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' passed, ' + fail + ' failed  (logs ' + tmp + ')');
  process.exit(fail ? 1 : 0);
})();
