/* v1197 - THE SPLASH IS SILENT (Phil 17 Oct 2026: "Remove the mute button from load screen, make it no volume on this screen").
   The first splash (#rotateGate: the key art, the logo, the studio + build bottom-left, Online bottom-right) shows no mute button and plays
   nothing - no music, no sound effect, no voice - even after the tap that unlocks audio; the player's sound settings are never touched; on the
   next screen the button is back and the music plays.
   Real page (Chromium, phone 844x390) on a local server with a temp DB. EVERY RIG IS SILENT: --mute-audio and every connection to an
   AudioContext's destination goes through a gain of 0. WebGL on SwiftShader (CPU).
     (1) every inline script parses, and the check catches a broken one
     (2) on the splash, before any tap: splashOn(), no visible mute button, nothing playing
     (3) the Play tap unlocks audio while the splash stays up (enterGame held): the AudioContext runs, but no music lane plays, no audio
         element plays a real file (the iOS warm-up clip is silent data), sndPlay / sfxPlay refuse (no buffer sound starts), the button stays hidden
     (4) the player's settings (ew_sound, ew_mute, SND_MUTE, the channel gains) are exactly as before
     (5) the splash lifts (enterGame): the button is visible and on top, the music plays (a lane's element playing a music file), sndPlay works
   CONTROL: a second page with splashOn() forced false plays music and shows the button on the very same held splash - the instrument sees both. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + d : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => {
  window.__starts = 0; const st0 = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function () { window.__starts++; return st0.apply(this, arguments); };   /* every buffer sound that starts */
  const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); };
};
const PROBE = async () => { const b = document.getElementById('muteBtn'); let btn = 'none';
  if (b) { try { muteBtnPlace(true); } catch (e) {} const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    const vis = r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
    const top = vis ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    btn = vis ? ((top === b || (top && b.contains(top))) ? 'visible-top' : 'visible-covered') : 'hidden'; }
  const real = el => !el.paused && !el.ended && el.currentSrc && !/^data:/.test(el.currentSrc) && !el.muted;
  const pool = (typeof MUS !== 'undefined' ? MUS.pool : []).filter(s => real(s.el)).map(s => s.el.currentSrc.split('/').pop());
  const dom = [...document.querySelectorAll('audio,video')].filter(real).map(e => e.currentSrc.split('/').pop());
  /* a sound of each path with its buffer in place (a short silent buffer: a headless Chromium cannot decode the game's AAC files) */
  const fx = 'test.splash1197', sn = Object.keys(SFX_DATA.files)[0]; let sfx2 = 'no ctx';
  if (SND.ctx) { const buf = SND.ctx.createBuffer(1, 4410, 44100); AUDIO_MAP[fx] = [{ f: '__splash1197.wav', vol: 1 }]; SND.buf['__splash1197.wav'] = buf; SND.buf[SFX_DATA.files[sn][0]] = buf;
    const n0 = window.__starts; try { SFX.last = {}; } catch (e) {} const r = sfxPlay(sn, SND.ctx.currentTime + 0.05, { fromStart: true }); sfx2 = !!r && window.__starts > n0; }
  return { splash: splashOn(), gate: getComputedStyle(document.getElementById('rotateGate')).display, btn, why: (MUT_D => MUT_D && MUT_D.why)(MUTE_DBG.last),
    ctx: SND.ctx ? SND.ctx.state : null, mus: MUS.cur, lanes: Object.values(MUS.lanes).filter(L => L.slot && L.slot.song).map(L => L.name), pool, dom,
    fx, sn, sfx2, starts: window.__starts, sfx: (() => { if (!SND.ctx) return 'no ctx'; try { SND.last = {}; const n0 = window.__starts; return sndPlay(fx) && window.__starts > n0; } catch (e) { return 'err ' + e.message; } })(),
    cfg: JSON.stringify(SND.cfg), mute: SND_MUTE.on, ls: [localStorage.getItem('ew_sound'), localStorage.getItem('ew_mute')], gains: SND.bus ? Object.keys(SND.bus).map(k => +SND.bus[k].gain.value.toFixed(3)) : [] }; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-splash1197-'));
  let srv = null, browser = null;
  try {
    const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
    const parseAll = src => { const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, n = 0; const bad = [];
      while ((m = re.exec(src))) { if (m[1] && /\bsrc=/.test(m[1])) continue; n++; try { new Function(m[2]); } catch (e) { bad.push(n + ': ' + e.message); } } return { n, bad }; };
    const pa = parseAll(html); ck(pa.n >= 3 && !pa.bad.length, '(1) every inline script parses (' + pa.n + ' blocks)', pa.bad.join('; '));
    ck(parseAll(html.replace('function splashOn(){', 'function splashOn(){ var q=\'it\'s\'; ')).bad.length > 0, '(1) CONTROL: the parse check catches an unescaped quote');
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const page = async control => { const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
      await ctx.addInitScript(SILENT);
      await ctx.addInitScript(() => { try { localStorage.setItem('ew_sound', JSON.stringify({ fx: { on: true, vol: 0.7 }, music: { on: true, vol: 0.5 }, voice: { on: true, vol: 0.8 } })); localStorage.setItem('ew_mute', '0'); } catch (e) {} });
      const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function' && typeof splashOn === 'function', null, { timeout: 90000 }); await delay(2500);
      if (control) await pg.evaluate(() => { window.__realSplashOn = splashOn; splashOn = () => false; try { muteBtnPlace(true); } catch (e) {} });
      return { ctx, pg, errs }; };
    /* ---- (2)-(5) the real page ---- */
    { const { ctx, pg, errs } = await page(false);
      const a = await pg.evaluate(PROBE);
      ck(a.splash === true && a.gate !== 'none' && a.btn !== 'visible-top' && a.btn !== 'visible-covered' && !a.pool.length && !a.dom.length && a.mus == null,
        '(2) on the splash before any tap: no mute button (' + a.btn + ', placement "' + a.why + '"), nothing plays', JSON.stringify(a));
      await pg.evaluate(() => { window.__enter = enterGame; enterGame = function () { window.__entered = (window.__entered || 0) + 1; }; });   /* the splash stays up after the tap */
      await pg.tap('.splashPlay'); await delay(2500);
      const b = await pg.evaluate(PROBE);
      ck(b.splash === true && b.ctx === 'running' && (b.btn === 'hidden' || b.btn === 'none') && !b.pool.length && !b.dom.length && b.mus == null && !b.lanes.length && b.sfx === false && b.sfx2 === false && b.starts === 0,
        '(3) after the Play tap (audio unlocked: context ' + b.ctx + ', the splash still up): no music (' + JSON.stringify(b.lanes) + '), no audio element plays a file, sndPlay(' + b.fx + ') and sfxPlay(' + b.sn + ') refused, ' + b.starts + ' buffer sounds started, the button hidden (' + b.btn + ')', JSON.stringify(b));
      ck(b.cfg === a.cfg && b.mute === a.mute && JSON.stringify(b.ls) === JSON.stringify(a.ls) && b.mute === false && JSON.parse(b.cfg).music.vol === 0.5 && b.gains.length === 3 && b.gains.every(g => g > 0),
        '(4) the player\'s own settings are untouched (' + b.cfg + ', mute ' + b.mute + ', channel gains ' + b.gains.join('/') + ')', JSON.stringify({ a: [a.cfg, a.mute, a.ls], b: [b.cfg, b.mute, b.ls] }));
      await pg.evaluate(() => { enterGame = window.__enter; enterGame(); });
      let c = null; for (let i = 0; i < 40; i++) { await delay(250); c = await pg.evaluate(PROBE); if (!c.splash && c.pool.length) break; }
      ck(c && c.splash === false && c.gate === 'none' && c.btn === 'visible-top' && c.pool.length >= 1 && /^(city|map)$/.test(c.mus || '') && c.sfx === true && c.sfx2 === true,
        '(5) the splash lifts: the button is back on top (' + (c && c.why) + '), the ' + (c && c.mus) + ' music plays (' + (c && c.pool.join(',')) + '), sndPlay and sfxPlay play', JSON.stringify(c));
      ck(!errs.length, 'no page errors', errs.join(' | '));
      await ctx.close(); }
    /* ---- CONTROL: the same held splash with the silence switched off ---- */
    { const { ctx, pg } = await page(true);
      await pg.evaluate(() => { enterGame = function () {}; });
      await pg.tap('.splashPlay'); let d = null; for (let i = 0; i < 20; i++) { await delay(250); d = await pg.evaluate(PROBE); if (d.pool.length) break; }
      const gate = await pg.evaluate(() => window.__realSplashOn());
      ck(gate === true && d.pool.length >= 1 && d.btn === 'visible-top' && d.sfx === true && d.sfx2 === true,
        'CONTROL: on the same held splash with splashOn() forced false the music plays (' + d.pool.join(',') + ') and the sounds, and the button shows (' + d.btn + ') - the checks above see both', JSON.stringify(d));
      await ctx.close(); }
  } catch (e) { fail++; console.log('  FAIL ' + (e.stack || e.message)); }
  finally { try { if (browser) await browser.close(); } catch (e) {} try { if (srv) srv.kill(); } catch (e) {} }
  console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
  process.exitCode = fail ? 1 : 0;
})();
