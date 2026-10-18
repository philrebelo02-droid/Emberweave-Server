/* v1197 - THE RESULT WAITS FOR THE LAST DEATH (Phil 18 Oct 2026: "the fights end too fast when winning or losing, please let the death animation
   finish fully before ending. whoever died last to cause the end").
   Real page (Chromium, phone 844x390) on a local server with a temp DB; silent (--mute-audio, AudioContext removed); WebGL on SwiftShader (CPU).
     (1) every inline script parses, and the check catches a broken one
     (2) WIN: a real fight (the replay mode's result path) whose last enemy (Tolley, who has a death clip) dies: the result screen appears only after
         that death clip played its last cell (u._die.end), and not before the clip's own length (48 cells / 8 fps) has passed since he fell
     (3) LOSS: the same with the last ALLY dying (Hollow) - the defeat screen waits for his death too
     (4) a unit with NO death clip (its death entry removed: it fades) does not hold the result: it shows on the result's own delay (+ <= 0.6 s)
     (5) the cap: deathPlaying() forced true forever, the result still shows within the result delay + RESULT_DEATH_CAP (+ 1 s)
     (6) display only: the verdict (resultWon / _p2lastDigest) is set at the end tick, before the wait, and is the same either way
   CONTROL: the same win with the wait switched off (deathPlaying forced false) shows the result BEFORE the death clip ends - the instrument sees it. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 900) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-deathres1197-'));
  let srv = null, browser = null;
  try {
    const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
    const parseAll = src => { const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, n = 0; const bad = [];
      while ((m = re.exec(src))) { if (m[1] && /\bsrc=/.test(m[1])) continue; n++; try { new Function(m[2]); } catch (e) { bad.push(n + ': ' + e.message); } } return { n, bad }; };
    const pa = parseAll(html); ck(pa.n >= 3 && !pa.bad.length, '(1) every inline script parses (' + pa.n + ' blocks)', pa.bad.join('; '));
    ck(parseAll(html.replace('function deathPlaying(){', 'function deathPlaying(){ var q=\'it\'s\'; ')).bad.length > 0, '(1) CONTROL: the parse check catches an unescaped quote');
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function' && typeof deathPlaying === 'function', null, { timeout: 90000 }); await delay(2000);
    await pg.evaluate(() => { const q = document.querySelector('.splashPlay'); if (q) q.click(); }); await delay(1500);
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'dth' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await delay(1500);
    /* one fight: `dies` (the side that loses its last unit) - Tolley as the last enemy, or Hollow as the last ally. opt: noClip / capTest / off */
    const FIGHT = async (dies, opt) => {
      await pg.evaluate(([dies, opt]) => { cancelResult(); try { show('home'); } catch (e) {}
        window.__opt = opt; window.__ev = { end: null, shown: null, fell: null, dieEnd: null, won: null, dur: null, clip: null };
        if (opt.off) { window.__dp = deathPlaying; deathPlaying = () => false; }
        if (opt.capTest) { window.__dp = deathPlaying; deathPlaying = () => true; }
        CUR = { mode: 'replay', seed: 1197, oppName: 'T', replayWon: dies === 'enemy' };
        const mine = dies === 'enemy' ? ['vael'] : ['hollow'], foes = dies === 'enemy' ? ['tolley'] : ['vael'];
        startVersus(foes.map(k => ({ key: k, level: 60, rank: 3 })), true, mine); }, [dies, opt]);
      for (let i = 0; i < 240; i++) { if (await pg.evaluate(() => state === 'battle' && units.length > 0 && !(typeof _blLoading !== 'undefined' && _blLoading))) break; await delay(250); }
      await pg.evaluate(dies => { const v = units.find(u => (dies === 'enemy' ? u.team === 'enemy' : u.team === 'ally')), o = units.find(u => u !== v);
        window.__v = v; if (window.__opt.noClip) { v.anim = Object.assign({}, v.anim); delete v.anim.death; }
        v.maxHp = 1e6; v.hp = 0.2 * v.maxHp; o.maxHp = o.hp = 1e9;   /* under 30%: his death sheet loads */
        const A = v.anim && v.anim.death; window.__ev.clip = A ? { n: A.dn || A.n, fps: A.fps || 8 } : null;
        const _eb = endBattle; endBattle = function (won) { const first = !window.__ev.end; if (first) { window.__ev.end = performance.now(); window.__ev.won = won; window._p2lastDigest = null; } const r = _eb.apply(this, arguments); if (first) { window.__ev.digest = window._p2lastDigest || null; window.__ev.wonAfter = resultWon; window.__ev.shownAtEnd = state === 'result'; } return r; };
        const _sh = show; show = function (s) { if (s === 'result' && window.__ev.end && !window.__ev.shown) window.__ev.shown = performance.now(); return _sh.apply(this, arguments); };
        window.__watch = setInterval(() => { const ev = window.__ev; if (!v.alive && !ev.fell) { ev.fell = performance.now(); try { ev.atFell = { pre: v._dPre || 0, clip: !!deathClip(v), ready: deathReady(v), mesh: !!v.mesh, sprH: v.sprH }; } catch (e) { ev.atFell = String(e); } } if (v._die && v._die.end && !ev.dieEnd) ev.dieEnd = performance.now(); if (ev.fell && (ev.tr = ev.tr || []).length < 40 && Math.random() < 0.1) ev.tr.push([+(v.deathT || 0).toFixed(2), v._die === undefined ? 'u' : v._die === null ? 'n' : v._die === false ? 'f' : (v._die.end ? 'E' : +v._die.t.toFixed(2)), !!(v.mesh && v.mesh.parent), state, units.indexOf(v)]); }, 20); }, dies);
      await delay(2500);   /* the death sheet arrives */
      await pg.evaluate(() => { window.__v.hp = 1; });
      for (let i = 0; i < 160; i++) { const s = await pg.evaluate(() => !!window.__ev.shown); if (s) break; await delay(100); }
      await delay(300);
      return pg.evaluate(() => { clearInterval(window.__watch); if (window.__dp) { deathPlaying = window.__dp; window.__dp = null; }
        const ev = window.__ev, v = window.__v; return Object.assign({}, ev, { die: v._die ? { end: !!v._die.end, t: +(v._die.t || 0).toFixed(3) } : v._die, gs: gameSpeed, cap: RESULT_DEATH_CAP }); }); };
    const f = x => x == null ? '-' : (x / 1000).toFixed(2) + ' s';
    { const w = await FIGHT('enemy', {});
      const len = w.clip ? w.clip.n / w.clip.fps : 0;
      ck(w.end && w.shown && w.fell && w.dieEnd && w.shown >= w.dieEnd && (w.shown - w.fell) >= len * 1000 - 150 && w.die && w.die.end,
        `(2) WIN: Tolley fell (the fight's last death); his death clip (${w.clip ? w.clip.n + ' cells / ' + w.clip.fps + ' fps = ' + len.toFixed(1) + ' s' : '-'}) ended ${f(w.dieEnd - w.fell)} after he fell, the victory screen ${f(w.shown - w.fell)} after (after the clip's last cell)`, JSON.stringify(w));
      ck(w.won === true && w.wonAfter === true && !!w.digest, '(6) the verdict is set on the end tick (won ' + w.won + '), before the wait', JSON.stringify(w)); }
    { const l = await FIGHT('ally', {}); const len = l.clip ? l.clip.n / l.clip.fps : 0;
      ck(l.end && l.shown && l.fell && l.dieEnd && l.shown >= l.dieEnd && (l.shown - l.fell) >= len * 1000 - 150 && l.won === false,
        `(3) LOSS: Hollow fell last; the defeat screen ${f(l.shown - l.fell)} after he fell, after his death clip ended (${f(l.dieEnd - l.fell)})`, JSON.stringify(l)); }
    { const n = await FIGHT('enemy', { noClip: true });
      ck(n.end && n.shown && (n.shown - n.end) <= 800 + 600 && !n.die, `(4) no death clip (it fades): the result shows on its own delay, ${f(n.shown - n.end)} after the end`, JSON.stringify(n)); }
    { const c = await FIGHT('enemy', { capTest: true });
      ck(c.end && c.shown && (c.shown - c.end) >= c.cap - 200 && (c.shown - c.end) <= 800 + c.cap + 1000, `(5) the cap: a death that never ends still lets the result show after ${f(c.shown - c.end)} (delay 0.8 s + cap ${f(c.cap)})`, JSON.stringify(c)); }
    { const o = await FIGHT('enemy', { off: true });
      ck(o.end && o.shown && (o.dieEnd == null || o.shown < o.dieEnd), `CONTROL: with the wait switched off the victory screen shows ${f(o.shown - o.fell)} after he fell, BEFORE his death clip ends (${o.dieEnd ? f(o.dieEnd - o.fell) : 'still playing'}) - the check above sees it`, JSON.stringify(o)); }
    ck(!errs.length, 'no page errors', errs.join(' | '));
  } catch (e) { fail++; console.log('  FAIL ' + (e.stack || e.message)); }
  finally { try { if (browser) await browser.close(); } catch (e) {} try { if (srv) srv.kill(); } catch (e) {} }
  console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
  process.exitCode = fail ? 1 : 0;
})();
