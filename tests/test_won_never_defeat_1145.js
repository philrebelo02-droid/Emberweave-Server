/* v1145 - A FIGHT THE PLAYER WON NEVER SHOWS DEFEAT (Phil 15 Oct 2026, pre-beta: "Players trying 50 times and then seeing defeat,
   its bad"). The campaign result screen used to say DEFEAT for ANY reply that was not ok and whose error text did not match
   /verified|expired|stamina/ - so a won fight answered "No matching campaign battle." (the attempt was replaced or its receipt pruned),
   "Slow down" (429), "server error" (500), "Request too large." (413), "auth" or an empty body was painted as a loss.
   Only the server's own receipt of a LOSS, or a fight the player actually lost, may say DEFEAT.
   Real page (Chromium, 844x390, muted) on a real local server; /api/campaign/resolve is answered by a stubbed fetch with each
   reply a won fight can get. Controls: a real win says VICTORY, a real loss says DEFEAT, a front-door 503 says NOT COUNTED.
   Asserts (non-zero exit). */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), net = require('net');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
let pass = 0, fail = 0; const ck = (n, c, d) => { c ? (pass++, console.log('  ok ' + n)) : (fail++, console.log('  x  ' + n + (d ? ' - ' + d : ''))); };

const WIN = { ok: true, mode: 'normal', won: true, stars: 3, verified: true, reward: { gold: 10, playerXp: 1, heroXp: 1, first: false, glyphFragments: [] } };
const CASES = [
  // [name, player won?, [status, body] replies in order, expect title]
  ['won + attempt lost by the server ("No matching campaign battle.")', true, [[400, { ok: false, error: 'No matching campaign battle.' }]], 'NOT COUNTED'],
  ['won + 429 "Slow down - too many requests."', true, [[429, { error: 'Slow down — too many requests.' }]], 'NOT COUNTED'],
  ['won + 500 "server error"', true, [[500, { error: 'server error' }]], 'NOT COUNTED'],
  ['won + 413 "Request too large."', true, [[413, { error: 'Request too large.' }]], 'NOT COUNTED'],
  ['won + 401 auth', true, [[401, { error: 'auth' }]], 'NOT COUNTED'],
  ['won + empty (null) body', true, [[200, null]], 'NOT COUNTED'],
  ['won + "Stage data missing."', true, [[400, { ok: false, error: 'Stage data missing.' }]], 'NOT COUNTED'],
  ['won + 500, then the receipt -> VICTORY (re-sent with the same requestId)', true, [[500, { error: 'server error' }], [200, WIN]], 'VICTORY'],
  ['won + empty body, then the receipt -> VICTORY', true, [[200, null], [200, WIN]], 'VICTORY'],
  // controls
  ['CONTROL won + the server receipt says won -> VICTORY', true, [[200, WIN]], 'VICTORY'],
  ['CONTROL lost + the server receipt says lost -> DEFEAT', false, [[200, { ok: true, mode: 'normal', won: false, stars: 0, verified: true, reward: null }]], 'DEFEAT'],
  ['CONTROL lost + an error reply -> DEFEAT (the player lost)', false, [[400, { ok: false, error: 'No matching campaign battle.' }]], 'DEFEAT'],
  ['CONTROL won + front-door 503 serverDown x3 -> NOT COUNTED (v1144)', true, [[503, { error: 'Server 1 is down right now - your other servers are still open.', serverDown: 1 }]], 'NOT COUNTED'],
  ['CONTROL won + one lost reply, then the receipt -> VICTORY', true, [[503, { error: 'Server 1 is down right now - your other servers are still open.', serverDown: 1 }], [200, WIN]], 'VICTORY'],
];

(async () => {
  const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew1145-'));
  const env = { ...process.env, DATABASE_URL: '', PORT: String(port), DB_FILE: path.join(dir, 'db.json'), SIM_WORKERS: '0', NODE_ENV: '' }; delete env.CLOCK_FILE;
  const srv = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: 'ignore', windowsHide: true });
  let b;
  try {
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch('http://127.0.0.1:' + port + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    try { b = await chromium.launch({ args: ['--mute-audio'] }); } catch (e) { b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] }); }
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript(() => { const P = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : (k === Symbol.toPrimitive ? () => 0 : (['value', 'currentTime', 'sampleRate'].includes(k) ? 0 : P)), apply: () => P, construct: () => P, set: () => true });
      window.AudioContext = function () { return P; }; window.webkitAudioContext = window.AudioContext; });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message)));
    await pg.goto('http://127.0.0.1:' + port + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof endBattle === 'function' && typeof api === 'function', null, { timeout: 60000 });
    await delay(1500);
    console.log('== v1145: a won campaign fight never shows DEFEAT ==');
    for (const [name, won, replies, expect] of CASES) {
      const got = await pg.evaluate(async ({ won, replies }) => {
        // the resolve route answers with the scripted replies (the last one repeats); everything else is the real server
        let n = 0; const rids = []; const _f = window.__realFetch || (window.__realFetch = window.fetch);
        window.fetch = function (u, o) { if (String(u).indexOf('/api/campaign/resolve') >= 0) { try { rids.push(JSON.parse(o.body).requestId); } catch (_) {} const [st, body] = replies[Math.min(n++, replies.length - 1)];
            return Promise.resolve(new Response(JSON.stringify(body), { status: st, headers: { 'content-type': 'application/json' } })); }
          return _f.apply(this, arguments); };
        ACC.token = ACC.token || 'test-token';
        // a campaign fight that has just ended, with an open server attempt
        units = []; ended = false; state = 'battle'; CUR = { node: 3, mode: 'campaign', portal: 'normal', attemptId: 'att-test' };
        document.getElementById('resultTitle').textContent = '';
        const titles = []; const el = document.getElementById('resultTitle');
        const mo = new MutationObserver(() => titles.push(el.textContent)); mo.observe(el, { childList: true, characterData: true, subtree: true });
        endBattle(won);
        for (let i = 0; i < 200 && !(document.getElementById('result').classList.contains('active') && el.textContent); i++) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => setTimeout(r, 300)); mo.disconnect();
        const out = { title: el.textContent, titles, calls: n, sameRid: rids.length > 0 && rids.every(x => x === rids[0]), reward: (document.getElementById('resultReward').textContent || '').slice(0, 160) };
        window.fetch = window.__realFetch; show('hub'); return out;
      }, { won, replies });
      ck(name + ' -> ' + expect, got.sameRid && got.title === expect && !(expect !== 'DEFEAT' && got.titles.some(t => /DEFEAT/.test(t))),
        'title ' + JSON.stringify(got.title) + ' (seen ' + JSON.stringify(got.titles) + ', ' + got.calls + ' resolve calls) reward: ' + got.reward);
    }
    ck('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  } finally { try { if (b) await b.close(); } catch (_) {} srv.kill(); }
  console.log(''); console.log('PASS: ' + pass + '  FAIL: ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
