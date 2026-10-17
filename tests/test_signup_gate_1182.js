// v1182 SIGN-UP GATE (Phil 16 Oct 2026: "ok thats good"). Three real servers: Server 1 (the account server) + Servers 2 and 3
// (ACCOUNT_AUTHORITY = Server 1), split world store with DB_STORE_VERIFY on Server 1 (every partial save is checked for changes it
// did not declare). Checks:
//   - old hashes (60k without iters, 210k) still sign in, on Server 1 and through a satellite; the 60k one is upgraded;
//   - a sign-up on Server 2 is hashed on Server 2 only (Server 1 hashes nothing), Server 1 stores that exact hash, Server 2 keeps it;
//   - a sign-in on a satellite with a tagged local copy: Server 1 hashes nothing; no copy / wrong password: Server 1's full check;
//   - a password changed on Server 1 by a tool (no passAt) or by a reset made through Server 2: the old one stops working everywhere;
//   - lockout: 10 wrong from one network lock that network even for the right password through the local check; others still sign in;
//   - look-alike names refused exactly as the old scan refused them (index vs scan, on NAMES_FILE = a real copy of the user list
//     if given: JSON [{id,name,isNpc}], else a synthetic list) - and over HTTP across servers, freed again after a delete;
//   - the main thread stays responsive (health ping p99 < 100 ms) during 200 parallel sign-ups on Server 1, and on Server 1 during
//     200 parallel sign-ups on Server 2;
//   - no password or hash in any log; no undeclared change on Server 1.
// Usage: node tests/test_signup_gate_1182.js [repo dir]     exit 0 = every check passed. Control: the dir of a pre-v1182 checkout
// must FAIL (CONTROL=1 prints every miss and exits 1 without stopping at the first).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), http = require('http'), crypto = require('crypto'), vm = require('vm');
const dir = process.argv[2] || path.join(__dirname, '..');
const WS = require(path.join(dir, 'server', 'world-store.js'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v1182-'));
const DB1 = path.join(tmp, 'db1.json'), DB2 = path.join(tmp, 'db2.json'), DB3 = path.join(tmp, 'db3.json');
const P1 = 8800 + Math.floor(Math.random() * 60), P2 = P1 + 70, P3 = P1 + 140, SECRET = 'test-link-secret-1182';
const FLAGS = { VAULT_MIN_BATTLE_MS: '0', REG_PER_MIN: '2000', REG_ACCOUNTS_PER_IP: '2000', GLYPH_RL_PER_MIN: '1000', BUSY_SHED: '0', DATABASE_URL: '', SMTP_HOST: '', DB_STORE: 'split' };
let pass = 0, fail = 0; const procs = {}, secrets = [];
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function start(name, port, env) {
  const e = Object.assign({}, process.env, FLAGS, { PORT: String(port), NODE_PATH: path.join(dir, 'node_modules') }, env);
  const log = fs.openSync(path.join(tmp, name + '.log'), 'a');
  procs[name] = cp.spawn(process.execPath, ['server.js'], { cwd: dir, env: e, stdio: ['ignore', log, log], windowsHide: true });
}
async function stop(name) { const p = procs[name]; if (!p) return; p.kill(); for (let i = 0; i < 80 && p.exitCode === null && p.signalCode === null; i++) await sleep(50); await sleep(300); delete procs[name]; }
const agent = new http.Agent({ keepAlive: true, maxSockets: 1000 });
function call(port, p, body, token, ip) {
  return new Promise(res => {
    const t0 = Date.now(), data = body ? JSON.stringify(body) : null;
    const rq = http.request({ host: '127.0.0.1', port, path: p, method: data ? 'POST' : 'GET', agent,
      headers: Object.assign({ 'content-type': 'application/json', 'x-forwarded-for': ip || '10.1.0.1' }, token ? { 'x-token': token } : {}, data ? { 'content-length': Buffer.byteLength(data) } : {}) },
      r => { let d = ''; r.on('data', x => d += x); r.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch (e) {} res({ status: r.statusCode, body: j, ms: Date.now() - t0 }); }); });
    rq.on('error', () => res({ status: 0, body: {}, ms: Date.now() - t0 })); if (data) rq.write(data); rq.end();
  });
}
async function up(port) { for (let i = 0; i < 160; i++) { const r = await call(port, '/version.json'); if (r.status === 200) return true; await sleep(250); } return false; }
const S1env = () => ({ DB_FILE: DB1, ACCOUNT_LINK_SECRET: SECRET, ADMIN_IDS: ADM, DB_STORE_VERIFY: '1' });
const SATenv = (db, n) => ({ DB_FILE: db, ACCOUNT_LINK_SECRET: SECRET, ACCOUNT_AUTHORITY: 'http://127.0.0.1:' + P1, ACCOUNT_STATUS_MS: '1000', SERVER_NAME: 'Server ' + n });
const pw = s => { secrets.push(s); return s; };
const cred = (p, iters) => { const salt = crypto.randomBytes(16).toString('hex'); const o = { salt, hash: crypto.pbkdf2Sync(p, salt, iters, 32, 'sha256').toString('hex') }; if (iters !== 60000) o.iters = iters; secrets.push(o.hash); return o; };
let ADM = null, ATOK = null;
async function hashes() { const r = await call(P1, '/api/dev/save-stats', null, ATOK); return (r.body && r.body.signup && r.body.signup.hash) ? r.body.signup.hash.n : NaN; }
const signed = r => r.status === 200 && !!r.body.token;
function pct(a, q) { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; }
async function pingDuring(port, work) {
  let run = true; const lat = [];
  const pinger = (async () => { while (run) { const r = await call(port, '/api/health'); lat.push(r.ms); await sleep(10); } })();
  const out = await work(); run = false; await pinger; return { out, p99: pct(lat, 0.99), max: Math.max(...lat), n: lat.length };
}

// ---------- the look-alike index against the old scan (in-process, the server's own code) ----------
function nameIndexCheck() {
  const src = fs.readFileSync(path.join(dir, 'server.js'), 'utf8');
  const conf = src.match(/const NAME_CONFUSABLE=\{[\s\S]*?\};/), sk = src.match(/function nameSkeleton\(n\)\{[^\n]*\n[^\n]*/);
  const a = src.indexOf('const _nameIdx='), b = src.indexOf('function nameTaken(');
  if (!conf || !sk || a < 0 || b < 0) { ok(false, 'name index: the index code is in server.js'); return; }
  let e = src.indexOf('\n', src.indexOf('return false; }', b)); const idxCode = src.slice(a, e);
  const ctx = { console: { error() {}, log() {} }, Map, Set, Date, Object, String, DB: null };
  vm.runInNewContext(conf[0] + '\n' + sk[0] + '\n' + idxCode + '\nthis.nameTaken=nameTaken; this.put=nameIdxPut; this.drop=nameIdxDrop; this.sk=nameSkeleton; this.idx=_nameIdx;'
    + '\nthis.setDB=function(d){ DB=d; };', ctx);
  // the old scan, line for line; each player's skeleton is computed once per comparison round (the same values the scan computes per call)
  let skOf = new Map(); const fresh = () => { skOf = new Map(); for (const u of Object.values(DB.users)) if (u && u.name) skOf.set(u, ctx.sk(u.name)); };
  const scan = (DB, name, exceptId) => { const lid = DB.byName[String(name || '').toLowerCase()]; if (lid && lid !== exceptId) return true;
    const s = ctx.sk(name); if (!s) return false;
    for (const u of Object.values(DB.users || {})) { if (u && u.id !== exceptId && !u.isNpc && u.name && (skOf.has(u) ? skOf.get(u) : ctx.sk(u.name)) === s) return true; } return false; };
  let list; const real = !!process.env.NAMES_FILE;
  if (real) list = JSON.parse(fs.readFileSync(process.env.NAMES_FILE, 'utf8'));
  else { list = []; const base = ['Phil', 'Marigold', 'Kaela', 'Rook', 'Sylva', 'Bramble', 'Oakmir', 'Tessa', 'Vaelin', 'Ashwin'];
    for (let i = 0; i < 4000; i++) list.push({ id: 'u' + i, name: base[i % base.length] + (i < 10 ? '' : i.toString(36)) });
    for (let i = 0; i < 300; i++) list.push({ id: 'bot_' + i, name: 'Bot ' + i, isNpc: true });
    list.push({ id: 'g1', name: 'Guest-AB12' }, { id: 'x1', name: '!!!' }, { id: 'x2', name: 'Ünïcödé' }); }
  const DB = { users: {}, byName: {} };
  for (const r of list) { if (!r || !r.id || DB.users[r.id]) continue; DB.users[r.id] = { id: r.id, name: r.name, isNpc: !!r.isNpc }; if (r.name) DB.byName[String(r.name).toLowerCase()] = r.id; }
  ctx.setDB(DB);
  const ids = Object.keys(DB.users), probes = new Set();
  const vary = n => { const s = String(n || ''); return [s, s.toUpperCase(), s.toLowerCase(), s.replace(/a/g, 'а').replace(/o/g, 'о'), s.replace(/l/g, '1'), s.replace(/i/g, 'l'), s.replace(/o/gi, '0'),
    s.split('').map(c => /[A-Za-z]/.test(c) ? String.fromCharCode(c.charCodeAt(0) + 0xFEE0) : c).join(''), s + '!', '_' + s, s + 'x', s.slice(1), s.replace(/e/g, 'é')]; };
  for (let i = 0; i < ids.length; i++) { if (i % Math.max(1, Math.floor(ids.length / 1500)) === 0) for (const v of vary(DB.users[ids[i]].name)) probes.add(v); }
  for (let i = 0; i < 400; i++) probes.add(crypto.randomBytes(4).toString('hex'));
  probes.add(''); probes.add('!!!'); probes.add('Guest-AB12'); probes.add('guestab12');
  const compare = label => { fresh(); let diff = 0, taken = 0, n = 0;
    for (const p of probes) { const ex = [undefined, ids[n % ids.length]]; for (const x of ex) { n++; const want = scan(DB, p, x), got = ctx.nameTaken(p, x); if (want) taken++; if (want !== got) { diff++; if (diff < 4) console.log('     differs: ' + JSON.stringify(p) + ' except ' + x + ' scan ' + want + ' index ' + got); } } }
    ok(diff === 0, 'name index = old scan, ' + label + ': ' + n + ' checks, ' + taken + ' taken, ' + diff + ' different');
  };
  compare((real ? 'REAL user list (' : 'synthetic list (') + ids.length + ' accounts)');
  // the changes the server makes: create, rename, delete - through the hooks, then one that bypasses them (drift)
  const add = (id, name) => { DB.users[id] = { id, name }; DB.byName[name.toLowerCase()] = id; ctx.put(DB.users[id]); };
  add('n1', 'Zephyrine'); add('n2', 'Qorvalis');
  const ren = DB.users[ids[5]]; delete DB.byName[String(ren.name).toLowerCase()]; ren.name = 'Renamedone'; DB.byName['renamedone'] = ren.id; ctx.put(ren);
  const del = ids[7]; delete DB.byName[String(DB.users[del].name).toLowerCase()]; delete DB.users[del]; ctx.drop(del);
  for (const nme of ['Zephyrine', 'Qorvalis', 'Renamedone']) for (const v of vary(nme)) probes.add(v);
  compare('after create / rename / delete');
  DB.users.n3 = { id: 'n3', name: 'Hiddenwalker' };   // a change that did not tell the index (a missed site): the 1 s sync must find it
  ctx.idx.lastSyncAt = 0; for (const v of vary('Hiddenwalker')) probes.add(v);
  compare('after a change the index was not told about');
  ok(ctx.idx.drift === 1, 'that change is counted as drift (' + ctx.idx.drift + ') - it would be logged on a server');
  const t0 = process.hrtime.bigint(); for (let i = 0; i < 200; i++) ctx.nameTaken('Fresh' + i); const per = Number(process.hrtime.bigint() - t0) / 1e6 / 200;
  const t1 = process.hrtime.bigint(); skOf = new Map(); for (let i = 0; i < 20; i++) scan(DB, 'Fresh' + i); const perScan = Number(process.hrtime.bigint() - t1) / 1e6 / 20;
  ok(per < perScan / 5, 'a name check costs ' + per.toFixed(3) + ' ms with the index vs ' + perScan.toFixed(2) + ' ms for the scan');
}

(async () => {
  try {
    nameIndexCheck();

    // ---------- servers ----------
    start('s1a', P1, { DB_FILE: DB1, ACCOUNT_LINK_SECRET: SECRET, DB_STORE: '' }); await up(P1);
    const adm = await call(P1, '/api/register', { name: 'dev1', pass: pw('password1') }, null, '10.1.0.2'); ADM = adm.body.profile && adm.body.profile.id;
    await sleep(500); await stop('s1a');
    // two accounts with hashes made the OLD way (pbkdf2Sync): one 60k without iters (before 26 Aug), one 210k
    { const db = JSON.parse(fs.readFileSync(DB1, 'utf8')); const tpl = db.users[ADM];
      const mk = (id, name, c) => { const u = JSON.parse(JSON.stringify(tpl)); delete u.role; u.id = id; u.name = name; delete u.iters; Object.assign(u, c); db.users[id] = u; db.byName[name.toLowerCase()] = id; };
      mk('legacy60', 'OldTimer', cred(pw('oldpass99'), 60000)); mk('modern210', 'Modern', cred(pw('modernpass1'), 210000));
      fs.writeFileSync(DB1, JSON.stringify(db)); }
    start('s1', P1, S1env()); start('s2', P2, SATenv(DB2, 2)); start('s3', P3, SATenv(DB3, 3));
    ok(await up(P1) && await up(P2) && await up(P3), 'three servers up (Server 1 account server, Servers 2 and 3 linked)');
    ATOK = (await call(P1, '/api/login', { name: 'dev1', pass: 'password1' }, null, '10.1.0.2')).body.token;
    ok(!Number.isNaN(await hashes()), 'Server 1 reports its hash counter (save-stats signup.hash)');

    // ---------- old hashes ----------
    ok(signed(await call(P1, '/api/login', { name: 'OldTimer', pass: 'oldpass99' }, null, '10.2.0.1')), 'an old 60k hash (no iters) signs in on Server 1');
    ok(signed(await call(P1, '/api/login', { name: 'Modern', pass: 'modernpass1' }, null, '10.2.0.1')), 'an old-made 210k hash signs in on Server 1');
    ok((await call(P1, '/api/login', { name: 'OldTimer', pass: 'wrongpass99' }, null, '10.2.0.1')).status === 401, 'a wrong password for it is refused (401)');
    ok(signed(await call(P2, '/api/login', { name: 'OldTimer', pass: 'oldpass99' }, null, '10.2.0.2')), 'the 60k account signs in on Server 2 too (Server 1 checks it)');
    ok(signed(await call(P1, '/api/login', { name: 'OldTimer', pass: 'oldpass99' }, null, '10.2.0.1')), 'and again on Server 1 after its upgrade to 210k');

    // ---------- who hashes ----------
    let h0 = await hashes();
    const amyPw = pw('amyPassword1');
    const reg = await call(P2, '/api/register', { name: 'gateAmy', pass: amyPw }, null, '10.3.0.1');
    let h1 = await hashes();
    ok(signed(reg), 'gateAmy signs up on Server 2');
    ok(h1 - h0 === 0, 'Server 1 hashed nothing for a Server 2 sign-up (' + (h1 - h0) + ' hashes)');
    ok(signed(await call(P1, '/api/login', { name: 'gateAmy', pass: amyPw }, null, '10.3.0.2')), 'gateAmy signs in on Server 1 with that password (Server 1 stored Server 2\'s hash)');
    h0 = await hashes(); let r = await call(P2, '/api/login', { name: 'gateAmy', pass: amyPw }, null, '10.3.0.3'); h1 = await hashes();
    ok(signed(r) && h1 - h0 === 0, 'sign-in on Server 2 (tagged local copy): Server 1 hashed nothing (' + (h1 - h0) + ')');
    h0 = await hashes(); r = await call(P3, '/api/login', { name: 'gateAmy', pass: amyPw }, null, '10.3.0.4'); h1 = await hashes();
    ok(signed(r) && h1 - h0 === 1, 'first sign-in on Server 3 (no local copy): Server 1 checks it once (' + (h1 - h0) + ')');
    h0 = await hashes(); r = await call(P3, '/api/login', { name: 'gateAmy', pass: amyPw }, null, '10.3.0.4'); h1 = await hashes();
    ok(signed(r) && h1 - h0 === 0, 'second sign-in on Server 3: its own copy now, Server 1 hashed nothing (' + (h1 - h0) + ')');
    h0 = await hashes(); r = await call(P2, '/api/login', { name: 'gateAmy', pass: 'notmypass1' }, null, '10.3.0.5'); h1 = await hashes();
    ok(r.status === 401 && h1 - h0 === 1, 'a wrong password on Server 2 is refused and gets Server 1\'s full check (' + r.status + ', ' + (h1 - h0) + ' hash)');

    // ---------- a password changed on Server 1 by a tool (no passAt): the tag catches it ----------
    await stop('s1');
    const amyNew = pw('amyChanged22');
    { const w = WS.readWorld(DB1); const id = Object.keys(w.users).find(k => w.users[k].name === 'gateAmy'); Object.assign(w.users[id], cred(amyNew, 210000), { iters: 210000 }); WS.writeWorld(DB1, w); }
    start('s1', P1, S1env()); await up(P1); ATOK = (await call(P1, '/api/login', { name: 'dev1', pass: 'password1' }, null, '10.1.0.2')).body.token;
    r = await call(P2, '/api/login', { name: 'gateAmy', pass: amyPw }, null, '10.4.0.1');
    ok(!r.body.token && r.status === 401, 'after a tool changed the password on Server 1, the OLD one no longer signs in on Server 2 (' + r.status + ')');
    ok(!(await call(P3, '/api/login', { name: 'gateAmy', pass: amyPw }, null, '10.4.0.2')).body.token, '... nor on Server 3');
    ok(signed(await call(P2, '/api/login', { name: 'gateAmy', pass: amyNew }, null, '10.4.0.1')), 'the new one signs in on Server 2');
    h0 = await hashes(); r = await call(P2, '/api/login', { name: 'gateAmy', pass: amyNew }, null, '10.4.0.1'); h1 = await hashes();
    ok(signed(r) && h1 - h0 === 0, '... and its refreshed copy is trusted next time (' + (h1 - h0) + ' hashes on Server 1)');

    // ---------- reset through Server 2, and a reset on Server 1 ----------
    await call(P1, '/api/register', { name: 'resetRay', pass: pw('rayPassword1') }, null, '10.5.0.9');
    ok(signed(await call(P3, '/api/login', { name: 'resetRay', pass: 'rayPassword1' }, null, '10.5.0.3')), 'resetRay (made on Server 1) signs in on Server 3');
    await stop('s1');
    const codeHash = c => { const salt = crypto.randomBytes(8).toString('hex'); return { hash: crypto.pbkdf2Sync(c, salt, 60000, 32, 'sha256').toString('hex'), salt, exp: Date.now() + 15 * 60000, tries: 0 }; };
    { const w = WS.readWorld(DB1); for (const u of Object.values(w.users)) { if (u.name === 'gateAmy') { u.email = 'amy@example.test'; u.reset = codeHash('123456'); } if (u.name === 'resetRay') { u.email = 'ray@example.test'; u.reset = codeHash('654321'); } } WS.writeWorld(DB1, w); }
    start('s1', P1, S1env()); await up(P1); ATOK = (await call(P1, '/api/login', { name: 'dev1', pass: 'password1' }, null, '10.1.0.2')).body.token;
    const amyReset = pw('amyResetPass3');
    ok((await call(P2, '/api/reset-verify', { name: 'gateAmy', code: '000000', newPass: amyReset }, null, '10.5.0.1')).status === 400, 'a wrong reset code through Server 2 is refused');
    h0 = await hashes(); r = await call(P2, '/api/reset-verify', { name: 'gateAmy', code: '123456', newPass: amyReset }, null, '10.5.0.1'); h1 = await hashes();
    ok(signed(r), 'the right code resets gateAmy\'s password through Server 2 and signs in');
    ok(h1 - h0 === 1, 'Server 1 hashed only the code, not the new password (' + (h1 - h0) + ')');
    ok(!(await call(P2, '/api/login', { name: 'gateAmy', pass: amyNew }, null, '10.5.0.2')).body.token, 'after the reset the old password fails on Server 2');
    ok(!(await call(P3, '/api/login', { name: 'gateAmy', pass: amyNew }, null, '10.5.0.3')).body.token, '... on Server 3 (its old copy is no longer trusted)');
    ok(!(await call(P1, '/api/login', { name: 'gateAmy', pass: amyNew }, null, '10.5.0.4')).body.token, '... and on Server 1');
    ok(signed(await call(P1, '/api/login', { name: 'gateAmy', pass: amyReset }, null, '10.5.0.4')) && signed(await call(P3, '/api/login', { name: 'gateAmy', pass: amyReset }, null, '10.5.0.3')), 'the new password signs in on Server 1 and Server 3');
    h0 = await hashes(); r = await call(P2, '/api/login', { name: 'gateAmy', pass: amyReset }, null, '10.5.0.2'); h1 = await hashes();
    ok(signed(r) && h1 - h0 === 0, 'on Server 2 the reset left a trusted copy (' + (h1 - h0) + ' hashes on Server 1)');
    const rayNew = pw('rayResetPass4');
    ok(signed(await call(P1, '/api/reset-verify', { name: 'resetRay', code: '654321', newPass: rayNew }, null, '10.5.0.9')), 'a reset on Server 1 itself works');
    ok(!(await call(P3, '/api/login', { name: 'resetRay', pass: 'rayPassword1' }, null, '10.5.0.3')).body.token && signed(await call(P3, '/api/login', { name: 'resetRay', pass: rayNew }, null, '10.5.0.3')), 'and applies on Server 3: old refused, new signs in');

    // ---------- lockout ----------
    const lk = [];
    for (let i = 0; i < 11; i++) lk.push((await call(P2, '/api/login', { name: 'gateAmy', pass: 'guess' + i + 'xx' }, null, '10.6.6.6')).status);
    ok(lk.slice(0, 10).every(s => s === 401) && lk[10] === 429, 'Server 2: 10 wrong passwords from one network, the 11th is locked (' + lk.join(',') + ')');
    r = await call(P2, '/api/login', { name: 'gateAmy', pass: amyReset }, null, '10.6.6.6');
    ok(r.status === 429 && !r.body.token, 'the RIGHT password from that network is locked too, though the local copy matched (' + r.status + ')');
    ok(signed(await call(P2, '/api/login', { name: 'gateAmy', pass: amyReset }, null, '10.6.6.7')), 'the player on another network still signs in');
    const lk1 = [];
    for (let i = 0; i < 11; i++) lk1.push((await call(P1, '/api/login', { name: 'Modern', pass: 'guess' + i + 'xx' }, null, '10.6.7.7')).status);
    ok(lk1[10] === 429 && (await call(P1, '/api/login', { name: 'Modern', pass: 'modernpass1' }, null, '10.6.7.7')).status === 429, 'Server 1: the same lock (' + lk1.join(',') + ')');
    const par = await Promise.all(Array.from({ length: 14 }, (_, i) => call(P1, '/api/login', { name: 'OldTimer', pass: 'parallel' + i + 'x' }, null, '10.6.8.8')));
    const st = par.map(x => x.status);
    ok(st.filter(s => s === 401).length === 10 && st.filter(s => s === 429).length === 4, '14 wrong passwords AT ONCE from one network: exactly 10 counted, 4 locked (' + st.sort().join(',') + ')');

    // ---------- look-alike names over HTTP ----------
    const mg = await call(P2, '/api/register', { name: 'Marigold', pass: pw('marigold11') }, null, '10.7.0.1');
    ok(signed(mg), 'Marigold signs up on Server 2');
    const looks = [[P3, 'MARIG0LD'], [P1, 'Mаrigold'], [P2, 'Ｍarigold'], [P1, 'marigold'], [P3, 'Mar.igold']];
    for (const [port, nm] of looks) { const x = await call(port, '/api/register', { name: nm, pass: 'whatever11' }, null, '10.7.0.2'); ok(x.status === 409, 'look-alike ' + JSON.stringify(nm) + ' refused on port ' + port + ' (' + x.status + ')'); }
    const two = await Promise.all([call(P1, '/api/register', { name: 'Twinname', pass: 'twinpass11' }, null, '10.7.1.1'), call(P2, '/api/register', { name: 'TWINNAME', pass: 'twinpass11' }, null, '10.7.1.2')]);
    ok(two.filter(signed).length === 1, 'two sign-ups of one name at the same moment on two servers: one account (' + two.map(x => x.status).join(',') + ')');
    const mgS1 = (await call(P1, '/api/login', { name: 'Marigold', pass: 'marigold11' }, null, '10.7.0.3'));
    const del = await call(P1, '/api/admin/delete', { name: 'Marigold' }, ATOK);
    ok(del.status === 200 && !!mgS1.body.token, 'the admin deletes Marigold on Server 1');
    ok(signed(await call(P1, '/api/register', { name: 'MARIG0LD', pass: 'marigold22' }, null, '10.7.0.4')), 'after the delete the look-alike name is free again');

    // ---------- the main thread stays free ----------
    const burst = async (port, tag) => { const res = await Promise.all(Array.from({ length: 200 }, (_, i) => call(port, '/api/register', { name: 'Burst' + tag + i, pass: 'burstpass' + i, deviceId: 'dev' + tag + i }, null, '10.8.' + (i >> 6) + '.' + (i & 63))));
      return { okN: res.filter(signed).length, p95: pct(res.map(x => x.ms), 0.95) }; };
    let m = await pingDuring(P1, () => burst(P1, 'a'));
    ok(m.out.okN === 200, '200 parallel sign-ups on Server 1 all made (' + m.out.okN + ', sign-up p95 ' + m.out.p95 + ' ms)');
    ok(m.p99 < 100, 'Server 1 answers during them: health p99 ' + m.p99 + ' ms (max ' + m.max + ', ' + m.n + ' pings) < 100');
    m = await pingDuring(P1, () => burst(P2, 'b'));
    ok(m.out.okN === 200, '200 parallel sign-ups on Server 2 all made (' + m.out.okN + ', sign-up p95 ' + m.out.p95 + ' ms)');
    ok(m.p99 < 100, 'Server 1 answers during Server 2\'s burst: health p99 ' + m.p99 + ' ms (max ' + m.max + ') < 100');

    // ---------- disk and logs ----------
    await sleep(800);
    for (const n of Object.keys(procs)) await stop(n);
    const w1 = WS.readWorld(DB1), w2 = WS.readWorld(DB2);
    const a1 = Object.values(w1.users).find(u => u.name === 'Burstb7'), a2 = Object.values(w2.users).find(u => u.name === 'Burstb7');
    ok(!!a1 && !!a2 && a1.hash === a2.hash && a1.salt === a2.salt && a2.gid === a1.id && !!a2.s1Tag, 'on disk: Server 1 stores the hash Server 2 made, Server 2 keeps the same hash as its copy, tagged');
    ok(Object.values(w1.users).filter(u => /^Burst[ab]\d+$/.test(u.name)).length === 400, 'on disk: all 400 burst accounts are on Server 1');
    const logs = ['s1', 's2', 's3', 's1a'].map(n => { try { return fs.readFileSync(path.join(tmp, n + '.log'), 'utf8'); } catch (e) { return ''; } }).join('\n');
    const leak = secrets.filter(s => logs.indexOf(s) >= 0);
    ok(leak.length === 0, 'no password or hash appears in any server log (' + leak.length + ' found)');
    ok(!/changed outside their save/.test(logs), 'Server 1 (DB_STORE_VERIFY=1): no change outside the players a save declared');
    ok(!/v1182 drift/.test(logs), 'no name reached a world without the name index');
  } catch (e) { fail++; console.log('  FAIL harness: ' + (e && e.stack || e)); }
  for (const n of Object.keys(procs)) procs[n].kill();
  console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' passed, ' + fail + ' failed  (logs ' + tmp + ')');
  process.exit(fail ? 1 : 0);
})();
