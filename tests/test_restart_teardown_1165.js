/* v1165 - RESTART STOPS THE OLD FIGHT AT ONCE (Phil 16 Oct 2026: "when I hit restart stage, it should stop battle music and spell effect
   from that stage until the new one starts. The battle was still going on while I was reloading a new fight").
   Real page (Chromium, phone 844x390) on a local server with a temp DB; silent (--mute-audio + every destination through a gain of 0).
   ("loading" = the loading screen is up and the new fight has not been started yet - _blLoading; the old page has no such flag, so there
   it is the whole time the loading screen is up.)
   A real campaign fight (stage 1-1, BATTLE on the squad screen) runs ~6 s with sound and music, then Pause -> Restart Stage. While the
   loading screen is up, sampled every 150 ms:
     - no battle tick runs (updateBattle not called, battleTime frozen)
     - no unit, spell FX, ground hazard, projectile or particle of the old fight is left
     - no fight sound is alive (no live voice in SFX.act - fused swings, ability tails, capped rows - nothing queued) 0.2 s after the press
     - the battle song is faded out (released, or its element paused / at gain 0)
   then the new fight plays the NEXT song of the battle cycle (ew_battle_track moved by exactly one).
   Control: RT_ROOT=<a v1164 checkout> must FAIL (the old fight ticked on and its sounds stayed alive under the loading screen). */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.RT_ROOT || path.join(__dirname, '..');
const control = !!process.env.RT_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 600) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); };
  window.__AC = []; const AC = window.AudioContext; window.AudioContext = function () { const c = new AC(...arguments); window.__AC.push(c); return c; };
  window.AudioContext.prototype = AC.prototype; window.webkitAudioContext = window.AudioContext; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-rt-'));
  let srv = null, browser = null;
  try {
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    // Chrome first: the fight sounds are AAC (.m4a), which Playwright's own Chromium cannot decode - with it no fight would make a sound
    try { browser = await chromium.launch({ channel: 'chrome', args }); } catch (e) { browser = await chromium.launch({ args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(SILENT);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1200);
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'rt' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await delay(2500);
    await pg.mouse.click(5, 385); await delay(400);   // a tap: audio unlocks
    await pg.evaluate(() => { sndMuteSet(false); try { sndSet('music', { on: true }); sndSet('fx', { on: true }); } catch (e) {} window.__ub = 0; const o = updateBattle; window.updateBattle = function () { window.__ub++; return o.apply(this, arguments); }; });
    // the fight's sounds decoded first (the rig is slow: a sound still loading is skipped, which would leave nothing to silence)
    await pg.evaluate(() => { for (const v of Object.values(SFX_DATA.files)) { try { if (SND.buf[v[0]] === undefined) sndLoad(v[0]); } catch (e) {} } });
    for (let i = 0; i < 60; i++) { const left = await pg.evaluate(() => Object.values(SFX_DATA.files).filter(v => SND.buf[v[0]] === undefined || SND.buf[v[0]] === false).length); if (!left) break; await delay(500); }
    // a real campaign fight: stage 1-1, BATTLE
    await pg.evaluate(() => { CUR = { mode: 'campaign', node: 1, portal: 'normal' }; try { teamCtx = 'campaign'; } catch (e) {} show('menu'); }); await delay(1200);
    await pg.evaluate(() => document.getElementById('startBtn').click());
    for (let i = 0; i < 120; i++) { if (await pg.evaluate(() => state === 'battle' && !document.getElementById('battleLoader') && units.length > 0)) break; await delay(150); }
    await pg.evaluate(() => { window.__maxLive = 0; window.__mlIv = setInterval(() => { const n = SFX.act ? SFX.act.filter(v => !v.dying).length : (SND.live | 0); if (n > window.__maxLive) window.__maxLive = n; }, 50); });
    await delay(6000);
    await pg.evaluate(() => clearInterval(window.__mlIv));
    const before = await pg.evaluate(() => ({ maxLive: window.__maxLive, st: state, units: units.length, ub: window.__ub, live: (SFX.act ? SFX.act.length : (SND.live | 0)), cur: MUS.cur, song: MUS.lanes.battle && MUS.lanes.battle.slot && MUS.lanes.battle.slot.song.f, k: localStorage.getItem('ew_battle_track'), bt: battleTime }));
    ck(before.maxLive > 0, 'the fight was making sound (up to ' + before.maxLive + ' live voices) - the silence check below is not vacuous', JSON.stringify(before));
    ck(before.st === 'battle' && before.units > 0 && before.ub > 50 && before.cur === 'battle' && before.song, 'a campaign fight is running with its battle song (' + before.song + ')', JSON.stringify(before));
    // Pause -> Restart Stage
    await pg.evaluate(() => { document.getElementById('pauseBtn').click(); }); await delay(300);
    await pg.evaluate(() => { window.__ub = 0; window.__t0 = performance.now(); document.getElementById('restartBtn').click(); });
    const S = []; for (let i = 0; i < 40; i++) { const s = await pg.evaluate(() => { const L = MUS.lanes.battle, sl = L && L.slot;
        return { t: Math.round(performance.now() - window.__t0), ldr: !!document.getElementById('battleLoader') && (typeof _blLoading === 'undefined' || _blLoading), ub: window.__ub, bt: +battleTime.toFixed(3), units: units.length, haz: groundHazards.length, shots: shots.length, parts: particles.length,
          plates: (typeof _fxPlates !== 'undefined' ? _fxPlates.length : 0), live: (SFX.act ? SFX.act.filter(v => !v.dying && v.end > SND.ctx.currentTime).length : (SND.live | 0)), q: SFX.q.length, cur: MUS.cur,
          music: MUS.pool.filter(x => x.lane === 'battle' && !x.el.paused && x.g.gain.value > 0.02).length }; });
      S.push(s); if (!s.ldr && i > 2) break; await delay(150); }
    const during = S.filter(s => s.ldr && s.t >= 250);
    ck(during.length >= 2, 'the loading screen was sampled ' + during.length + ' times after the restart', JSON.stringify(S.slice(0, 3)));
    ck(during.every(s => s.ub === 0) && during.every(s => s.bt === during[0].bt), 'loading: no battle tick runs (updateBattle not called, battleTime frozen at ' + (during[0] && during[0].bt) + ')', JSON.stringify(during.map(s => [s.t, s.ub, s.bt])));
    ck(during.every(s => !s.units && !s.haz && !s.shots && !s.parts && !s.plates), 'loading: nothing of the old fight is left - units, ground hazards, projectiles, particles, spell plates', JSON.stringify(during.map(s => [s.units, s.haz, s.shots, s.parts, s.plates])));
    ck(during.every(s => s.live === 0 && s.q === 0), 'loading: no fight sound is alive or queued', JSON.stringify(during.map(s => [s.t, s.live, s.q])));
    const late = during.filter(s => s.t >= 450);
    ck(late.length > 0 && late.every(s => s.music === 0 && s.cur !== 'battle'), 'loading: the battle song has faded out (0.3 s) and does not play on', JSON.stringify(during.map(s => [s.t, s.cur, s.music])));
    // the new fight
    for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => state === 'battle' && !document.getElementById('battleLoader') && units.length > 0 && MUS.cur === 'battle')) break; await delay(150); }
    await delay(1200);
    const after = await pg.evaluate(() => ({ cur: MUS.cur, song: MUS.lanes.battle && MUS.lanes.battle.slot && MUS.lanes.battle.slot.song.f, k: localStorage.getItem('ew_battle_track'), list: MUSIC_LISTS.battle.map(x => x.f), units: units.length, ub: window.__ub }));
    const kb = +before.k, ka = +after.k, n = after.list.length;
    ck(after.cur === 'battle' && after.units > 0 && after.ub > 0 && ka === (kb + 1) % n && after.song === after.list[ka], 'the new fight plays the NEXT song of the cycle (' + after.song + '), the index moved by exactly one (' + kb + ' -> ' + ka + ')', JSON.stringify(after));
    await pg.evaluate(() => { ended = true; }); await delay(400);
    ck(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
    await pg.evaluate(async () => { try { for (const c of (window.__AC || [])) await c.close(); } catch (e) {} });
  } catch (e) { fail++; console.log('  FAIL harness: ' + (e && e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (_) {} try { if (srv) srv.kill(); } catch (_) {} try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  console.log(''); console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (control) { console.log(fail ? 'CONTROL: failed as it must' : 'CONTROL DID NOT FAIL'); process.exit(fail ? 0 : 1); }
  process.exit(fail ? 1 : 0);
})();
