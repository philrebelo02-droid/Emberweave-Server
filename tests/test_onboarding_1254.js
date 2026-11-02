// v1254 (Phil 2 Nov 2026: "Not a single one of the testers made it to 1 exp" / "center the sign in better, give the sign in, terms of
// service, and start here a better art frame"). Static checks on the client + a real server for the funnel route. Exit 0 = all passed.
// Control: OB_HTML / OB_DIR = the v1253 page / repo must FAIL.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), http = require('http'), assert = require('assert');
const dir = process.env.OB_DIR || path.join(__dirname, '..');
const html = fs.readFileSync(process.env.OB_HTML || path.join(dir, 'emberweave-heroes.html'), 'utf8');
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); };
ok(!/c\.since/.test(html) && !/coach-auto/.test(html), 'the 1-1 ult coach does NOT auto-cast (Phil: "Dont make the ults in 1-1 auto active")');
ok(/nb\.scrollIntoView\(\{block:'center'\}\)/.test(html), 'START HERE brings the current step\'s button on screen');
ok(/#authGate\{justify-content:center\}/.test(html), 'the sign-in card is centred');
ok((html.match(/class="ewFrame"/g) || []).length === 2, 'both Terms of Service windows wear the frame');
ok(/#tutorial #tutorialBody\{[^}]*hud-panel\.webp/.test(html) && /#authGate \.agCard,\.ewFrame\{[^}]*hud-panel\.webp/.test(html), 'sign-in, terms and START HERE use the game\'s gold frame art');
ok(/function ewFunnel\(ev\)/.test(html) && /ewFunnel\('go:'\+s\.id\)/.test(html), 'the client reports the first-session funnel');
ok(fs.existsSync(path.join(dir, 'assets', 'img', 'ui', 'hud-panel.webp')), 'the frame art exists');
ok(/const ENEMY_NERF=0\.95, ENEMY_NERF_MODES=new Set\(\['campaign','elite','province','well','vault','dungeon','graid','raid'\]\)/.test(html), 'PvE enemies are nerfed 5% (Phil: "nerf all enemies by 5% stats game wide"), PvP modes untouched');
ok(/if\(team==='enemy'&&typeof CUR!=='undefined'&&CUR&&ENEMY_NERF_MODES\.has\(CUR\.mode\)\) BL=Object\.assign\(\{\},BL,\{hp:BL\.hp\*ENEMY_NERF, dmg:BL\.dmg\*ENEMY_NERF, apow:\(BL\.apow\|\|0\)\*ENEMY_NERF, armor:\(BL\.armor\|\|0\)\*ENEMY_NERF, mr:\(BL\.mr\|\|0\)\*ENEMY_NERF\}\)/.test(html), '...on every base stat, enemy team only');

// the server keeps each funnel event once, refuses others
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v1254-')); const DB = path.join(tmp, 's1', 'db.json'); fs.mkdirSync(path.dirname(DB));
const P = 8820 + Math.floor(Math.random() * 40);
const srv = cp.spawn(process.execPath, ['server.js'], { cwd: dir, env: Object.assign({}, process.env, { PORT: String(P), DB_FILE: DB, REG_PER_MIN: '50', NODE_PATH: path.join(process.argv[2] || dir, 'node_modules') }), stdio: 'ignore' });
const call = (p, body, token) => new Promise(res => { const d = body ? JSON.stringify(body) : null;
  const rq = http.request({ host: '127.0.0.1', port: P, path: p, method: d ? 'POST' : 'GET', headers: Object.assign({ 'content-type': 'application/json' }, token ? { 'x-token': token } : {}, d ? { 'content-length': Buffer.byteLength(d) } : {}) },
    r => { let x = ''; r.on('data', c => x += c); r.on('end', () => { let j = {}; try { j = JSON.parse(x); } catch (e) {} res({ status: r.statusCode, body: j }); }); });
  rq.on('error', () => res({ status: 0, body: {} })); if (d) rq.write(d); rq.end(); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try {
    for (let i = 0; i < 80; i++) { if ((await call('/version.json')).status === 200) break; await sleep(250); }
    const r = await call('/api/register', { name: 'funnelfox', pass: 'funnelpass1' }); const t = r.body.token;
    ok(!!t, 'a new player signs up');
    ok((await call('/api/funnel', { ev: 'tut-open' }, t)).status === 200, 'a funnel event is accepted');
    ok((await call('/api/funnel', { ev: 'go:first-squad' }, t)).status === 200, 'a Go step is accepted');
    ok((await call('/api/funnel', { ev: '<script>' }, t)).status === 400, 'anything else is refused');
    ok((await call('/api/funnel', { ev: 'tut-open' })).status === 401, 'signed-out calls are refused');
  } finally { srv.kill(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
  console.log('test_onboarding_1254.js: ' + pass + ' checks passed');
})().catch(e => { srv.kill(); console.log('FAIL ' + e.message); process.exit(1); });
