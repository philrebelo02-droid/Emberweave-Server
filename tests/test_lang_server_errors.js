/* v1271 LANGUAGES step 2, group C (Phil 4 Nov 2026: "I need everything thats translatable to be translated"): every player-facing error
   text the server sends carries a stable CODE (+ vars for a text built from values); {error} stays the English, byte for byte.
   (1) TABLE <-> SPEC: every code in server/error-codes.js has err.<code> in tools/lang/specs/C_server.json with the same English, and
       every err.* key there has a code; codes are lower snake_case; no English holds < > " .
   (2) LOOKUP: exact texts map; a built text maps with the right vars; unknown text, machine tokens and non-strings get no code.
   (3) HOOK: attach() returns a copy (the caller's object is untouched), keeps an existing code, never throws.
   (4) REAL ROUTES (server.js over HTTP): a blocked name gets {error (unchanged), code, vars}; a reserved name gets an exact code;
       an unknown-text error ('auth') gets no code.
   (5) LANG ROUTE: /lang/<code>.content.json is admitted, nothing else new is.
   CONTROL: a spec with one key removed and a table entry whose English differs are both caught by the same check function. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 400) : '')); } };
const EC = require(path.join(ROOT, 'server', 'error-codes.js'));
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'lang', 'specs', 'C_server.json'), 'utf8'));

function tableSpecProblems(table, keys) {
  const out = [], seen = new Set();
  for (const e of table) {
    if (!/^[a-z][a-z0-9_]*$/.test(e.code)) out.push('bad code ' + e.code);
    if (seen.has(e.code)) out.push('duplicate code ' + e.code); seen.add(e.code);
    const k = 'err.' + e.code; if (!(k in keys)) out.push('missing key ' + k); else if (keys[k] !== e.en) out.push('English differs for ' + k);
    if (/[<>"]/.test(e.en)) out.push('< > or " in ' + e.code); }
  for (const k of Object.keys(keys)) if (/^err\./.test(k) && !seen.has(k.slice(4))) out.push('key without a code ' + k);
  return out; }

(async () => {
  /* (1) */
  const table = EC.table();
  const probs = tableSpecProblems(table, SPEC.keys);
  ck(probs.length === 0, 'table and C_server.json agree (' + table.length + ' codes: ' + table.filter(e => !e.re).length + ' exact, ' + table.filter(e => e.re).length + ' patterns)', probs.slice(0, 10).join('; '));
  ck(Array.isArray(SPEC.edits) && SPEC.edits.length === 0, 'C_server.json has no page edits');
  { const k2 = Object.assign({}, SPEC.keys); delete k2['err.not_enough_gold'];
    const t2 = table.map(e => e.code === 'slow_down' ? Object.assign({}, e, { en: 'Slow down!!' }) : e);
    const p1 = tableSpecProblems(table, k2), p2 = tableSpecProblems(t2, SPEC.keys);
    ck(p1.some(x => /missing key err\.not_enough_gold/.test(x)), 'CONTROL: a deliberately missing key is caught (' + p1[0] + ')');
    ck(p2.some(x => /English differs for err\.slow_down/.test(x)), 'CONTROL: a changed English is caught (' + p2[0] + ')');
    const p3 = tableSpecProblems(table.filter(e => e.code !== 'slow_down'), SPEC.keys);
    ck(p3.some(x => /key without a code err\.slow_down/.test(x)), 'CONTROL: a key with no code is caught'); }
  // every pattern's own English, filled with its var names, maps back to itself
  { let bad = []; for (const e of table.filter(e => e.re)) { const txt = e.en.replace(/\{(\w+)\}/g, (_, v) => 'V' + v);
      const i = EC.errorInfo(txt); if (!i || (i.code !== e.code && !table.find(x => x.code === i.code && !x.re && x.en === txt))) bad.push(e.code + '->' + (i && i.code)); }
    ck(bad.length === 0, 'every pattern recognises its own filled-in English', bad.slice(0, 8).join(', ')); }

  /* (2) */
  ck(JSON.stringify(EC.errorInfo('Not enough gold.')) === '{"code":"not_enough_gold"}', 'exact: Not enough gold. -> not_enough_gold');
  ck(JSON.stringify(EC.errorInfo('Slow down.')) === '{"code":"slow_down"}', 'exact: Slow down. -> slow_down');
  { const i = EC.errorInfo('You need 250 diamonds.'); ck(i && i.code === 'you_need_diamonds' && i.vars && i.vars.cost === '250', 'pattern: You need 250 diamonds. -> you_need_diamonds {cost:250}', JSON.stringify(i)); }
  { const i = EC.errorInfo('Complete Normal 3-10 to unlock Elite Chapter 3.'); ck(i && i.code === 'complete_10_to_unlock_chapter' && JSON.stringify(i.vars) === '{"portal":"Normal","ch":"3","portal2":"Elite","ch2":"3"}', 'pattern with 4 vars', JSON.stringify(i)); }
  { const a = EC.errorInfo('You need 7 diamonds.'), b = EC.errorInfo('You need 7 diamonds.'); a.vars.cost = 'x'; ck(b.vars.cost === '7' && EC.errorInfo('You need 7 diamonds.').vars.cost === '7', 'cached result is not shared with callers'); }
  for (const t of ['Something nobody sends.', 'auth', 'STALE', '', null, 42, {}]) ck(EC.errorInfo(t) === null, 'no code for ' + JSON.stringify(t));

  /* (3) */
  { const o = { error: 'Not enough gold.', ok: false }, r = EC.attach(o);
    ck(r !== o && r.errCode === 'not_enough_gold' && r.error === 'Not enough gold.' && r.ok === false && o.errCode === undefined, 'attach: a copy gains errCode, the original is untouched');
    const keep = { error: 'Not enough gold.', errCode: 'mine' }; ck(EC.attach(keep) === keep && keep.errCode === 'mine', 'attach: an existing errCode is kept');
    const v = EC.attach({ error: 'You need 3 diamonds.' }); ck(v.errVars && v.errVars.cost === '3', 'attach: pattern adds errVars');
    const un = { error: 'auth' }; ck(EC.attach(un) === un && !('code' in un), 'attach: unknown text unchanged');
    let threw = false; try { for (const x of [null, undefined, 'x', 5, [], [1], { error: 5 }, Object.freeze({ error: 'Slow down.' }), Object.create({ error: 'Slow down.' })]) EC.attach(x); } catch (e) { threw = true; }
    ck(!threw, 'attach never throws');
    const ok = { ok: true, gold: 5 }; ck(EC.attach(ok) === ok, 'attach: a reply without error is the same object'); }

  /* (5) */
  { const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const m = src.match(/if\((\/\^\\\/lang\\\/[^\n]*?\$\/)\.test\(p\)\)/); ck(!!m, 'found the /lang/ route');
    if (m) { const re = eval(m[1]);
      for (const ok of ['/lang/en.json', '/lang/pt-BR.json', '/lang/zh-Hant.json', '/lang/en.content.json', '/lang/zh-Hans.content.json']) ck(re.test(ok), 'lang route admits ' + ok);
      for (const no of ['/lang/en.content.content.json', '/lang/en.contentx.json', '/lang/../server.json', '/lang/en.content.js', '/lang/.content.json', '/lang/english.content.json', '/lang/en/x.content.json']) ck(!re.test(no), 'lang route refuses ' + no); } }

  /* (4) */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-langerr-')), dbFile = path.join(tmp, 'db.json');
  const port = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); }), base = 'http://127.0.0.1:' + port;
  const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
  const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0', ADMIN_IDS: '' }, stdio: ['ignore', log, log], windowsHide: true });
  try {
    let up = false; for (const _t0 = Date.now(); Date.now() - _t0 < 60000 && !up && !(srv && srv.exitCode !== null); ) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await new Promise(r => setTimeout(r, 100)); }   /* 11 Nov: a 60 s deadline, not an iteration count (was 300 tries) */
    ck(up, 'server started');
    const call = async (r, b) => { const x = await fetch(base + r, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let j = {}; try { j = await x.json(); } catch (_) {} return { status: x.status, data: j }; };
    { const r = await call('/api/register', { name: 'Ab<cd', pass: 'password1' });
      ck(r.status === 400 && /^Names cannot use < - letters/.test(r.data.error || '') && r.data.errCode === 'names_cannot_use_letters_numbers_spaces' && r.data.errVars && r.data.errVars.bad === '<',
        'route: blocked name -> English kept + code + vars', JSON.stringify(r)); }
    { const r = await call('/api/register', { name: 'Guest12', pass: 'password1' });
      const want = EC.errorInfo(r.data.error || ''); ck(r.status === 400 && want && r.data.errCode === want.code && !('errVars' in r.data), 'route: reserved name -> exact code ' + r.data.errCode, JSON.stringify(r)); }
    { const r = await call('/api/chat/blocks');
      ck(r.status === 401 && r.data.error === 'auth' && !('code' in r.data), 'route: unknown-text error carries no code', JSON.stringify(r)); }
    { const r = await call('/api/register', { name: 'LangOk1', pass: 'password1' }); ck(r.status === 200 && !('code' in r.data), 'route: a success reply is unchanged (no code)'); }
  } finally { srv.kill(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
