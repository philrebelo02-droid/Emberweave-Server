/* v1371 - MUSIC AFTER A DEFEAT (tester B 3.2, 11 Nov 2026: "On two separate occasions after losing a battle, the music stopped completely and
   did not resume upon returning to the main menu, leaving the game in silence until another stage was started").
   v1364 healed a song the browser PAUSED or BROKE (musHeal). This re-check drove every path on f1f78a3e: the plain flows all bring the music
   back; the class still open was a song that is "playing" (not paused, no error) but never moves - a song request that stalls on a dropped
   connection - which stayed silent until the next fight, because only the battle lane always starts a fresh element. v1371 watches the
   current lane's clock (musStalled) and heals a song with no progress for MUS_STALL_MS.
   Real page (Chromium, phone 844x390 landscape) on a real local server with a temp DB; the campaign fights are started with BATTLE (the
   server's /api/campaign/start) and lost by the enemy's own blows (dealDamage), so the defeat runs the game's death + result flow.
   SILENT: --disable-audio-output (NEVER --mute-audio, it mutes the owner's Chrome), and every connection to the speakers goes through a gain
   of 0. Music is checked by STATE: which lane the game plays (MUS.cur), that lane's element not paused and its clock moving with real time,
   its gain, the master gain (mute) and the music bus.
   Asserts (non-zero exit on any failure):
     (1) every inline script parses
     (2) a defeat: the result says DEFEAT and the battle song plays on over it (v1163)
     (3) defeat -> Continue -> campaign map: a map song plays and moves; the battle song is released
     (4) defeat -> the town: the city song plays and moves
     (5) defeat -> retry (the same stage again from the map): the fight plays a fresh battle song; a second defeat -> the town plays again
     (6) a win -> Continue -> the town: the city song plays and moves
     (7) Mute all on through a defeat: the songs still run underneath at master gain 0; Mute all off on the town = gain 1, city song moving;
         Music off then on in Settings after a defeat brings the city song back
     (8) v1364 guard: after a defeat, the city song paused from outside the game comes back by itself - and a CONTROL with musHeal switched
         off must stay silent (proves the check sees the failure)
     (9) v1371: after a defeat, the map song's request stalls (held by the test, never answered) - a map song is playing and moving within
         15 s; on f1f78a3e it stays at 0 s for good
    (10) v1371: on the town after a defeat, the city song's request stalls - a city song is playing and moving within 15 s
    (11) no page errors
   MUS_ROOT=<a checkout> runs the same checks against that checkout's game. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const ROOT = process.env.MUS_ROOT || path.join(__dirname, '..');
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + d : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-musdef1371-'));
  let srv = null, browser = null; const held = [];
  try {
    const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
    { const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, n = 0; const bad = [];
      while ((m = re.exec(html))) { if (m[1] && /\bsrc=/.test(m[1])) continue; n++; try { new Function(m[2]); } catch (e) { bad.push(n + ': ' + e.message); } }
      ck(n >= 3 && !bad.length, '(1) every inline script parses (' + n + ' blocks)', bad.join('; ')); }

    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (const _t0 = Date.now(); Date.now() - _t0 < 60000 && !up && !(srv && srv.exitCode !== null); ) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count (was 300 tries) */
    if (!up) throw new Error('server did not start');
    let chromium; try { ({ chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))); } catch (e) { ({ chromium } = require('playwright')); }
    const args = ['--disable-audio-output', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args, ignoreDefaultArgs: ['--mute-audio'] }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args, ignoreDefaultArgs: ['--mute-audio'] }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(SILENT);
    /* a dropped connection: the next song request of a kind is held, never answered (the element stays "playing" at 0 s) */
    const hang = { map: 0 };
    await ctx.route('**/assets/audio/music/**', route => { const u = route.request().url();
      if (/[?&]stall=1/.test(u) || (hang.map > 0 && /\/music\/map-/.test(u) && hang.map--)) { held.push(route); return; }
      route.continue().catch(() => {}); });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1200);
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'md' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await pg.mouse.click(5, 385); await delay(2500);   // the tap that unlocks audio

    /* the music as the game holds it: the current lane, its element, and whether its clock moves with real time */
    const mus = (ms) => pg.evaluate(async ms => { const lane = () => { const L = MUS.cur && MUS.lanes[MUS.cur], s = L && L.slot; return s; };
      const s0 = lane(), t0 = s0 ? s0.el.currentTime : null; await new Promise(r => setTimeout(r, ms || 1500)); const s = lane();
      return { st: state, cur: MUS.cur, f: s && s.song ? s.song.f.replace(/\?.*$/, '') : null, playing: !!(s && !s.el.paused), moved: (s && s === s0) ? +(s.el.currentTime - t0).toFixed(2) : null,
        gain: s ? +s.g.gain.value.toFixed(2) : null, out: SND.out ? SND.out.gain.value : null, bus: SND.bus.music ? +SND.bus.music.gain.value.toFixed(2) : null, mute: SND_MUTE.on,
        battleSlot: !!(MUS.lanes.battle && MUS.lanes.battle.slot), heals: MUS.log.filter(x => x[0] === 'heal').map(x => x[1] + ':' + x[2]) }; }, ms);
    const sounding = (m, lane) => m.cur === lane && m.playing && m.moved != null && m.moved > 0.8 && m.gain > 0.9;
    const until = async (fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(fn, arg).catch(() => false)) return true; await delay(200); } return false; };
    const toHome = async () => { await pg.evaluate(() => { try { cancelResult(); } catch (e) {} show('home'); }); await until(() => MUS.cur === 'city', 4000); await delay(1300); };
    const fight = async () => { await pg.evaluate(() => { CUR = { node: 1, mode: 'campaign', portal: 'normal', opp: null }; teamCtx = 'campaign'; G.stamina = 999; show('menu'); }); await delay(700);
      await pg.evaluate(() => document.getElementById('startBtn').click());
      const ok = await until(() => state === 'battle' && !ended && units.length > 0 && MUS.cur === 'battle', 30000); await delay(1500); return ok; };
    const lose = async () => { await pg.evaluate(() => { paused = false; const e = units.find(u => u.team === 'enemy' && u.alive) || units.find(u => u.team === 'enemy');
        units.filter(u => u.team === 'ally' && u.alive).forEach(u => dealDamage(e, u, 1e9)); });
      await until(() => state === 'result', 30000); await delay(1500); return pg.evaluate(() => ({ title: document.getElementById('resultTitle').textContent, cls: document.getElementById('resultTitle').className })); };
    const cont = async lane => { await pg.evaluate(() => document.getElementById('resultBtn').click()); await until(l => MUS.cur === l, 5000, lane); await delay(1500); };

    /* ---- (9) a defeat, then the map song's request stalls (first visit to the map: a fresh request) ---- */
    ck(await fight(), 'stage 1-1 starts from BATTLE with a battle song');
    const r0 = await lose();
    const d0 = await mus();
    ck(/lose/.test(r0.cls) && d0.st === 'result' && sounding(d0, 'battle'), '(2) defeat screen (' + r0.title + '): the battle song plays on over it', JSON.stringify([r0, d0]));
    hang.map = 1; const h0 = held.length;
    await pg.evaluate(() => document.getElementById('resultBtn').click()); await until(() => MUS.cur === 'map', 5000);
    for (let i = 0; i < 30 && held.length === h0; i++) await delay(100); const stalledReq = held.length > h0;
    await until(() => { const s = MUS.lanes.map && MUS.lanes.map.slot; return !!(s && !s.el.paused && s.el.currentTime > 0.5); }, 15000);
    const m9 = await mus();
    ck(stalledReq && sounding(m9, 'map'), '(9) defeat -> campaign map with the map song\'s request stalled: a map song plays and moves within 15 s (' + m9.f + ')', JSON.stringify({ stalledReq, m9 }));
    hang.map = 0;

    /* ---- (3)(4) a plain defeat -> map -> town ---- */
    ck(await fight(), 'retry from the map: the stage starts again');
    const r1 = await lose(); const d1 = await mus();
    ck(/lose/.test(r1.cls) && sounding(d1, 'battle'), '(2) second defeat: the battle song plays on over the result', JSON.stringify([r1, d1]));
    await cont('map'); const m3 = await mus();
    ck(m3.st === 'campaign' && sounding(m3, 'map') && !m3.battleSlot, '(3) defeat -> Continue -> campaign map: a map song plays and moves, the battle song released', JSON.stringify(m3));
    await toHome(); const m4 = await mus();
    ck(m4.st === 'home' && sounding(m4, 'city'), '(4) defeat -> the town: the city song plays and moves (' + m4.f + ')', JSON.stringify(m4));

    /* ---- (5) defeat -> retry -> defeat -> town ---- */
    ck(await fight(), 'a fight from the town');
    await lose(); await cont('map');
    const f1 = await fight(); const b5 = await mus();
    ck(f1 && sounding(b5, 'battle'), '(5) defeat -> retry the stage: the fight plays a battle song (' + b5.f + ')', JSON.stringify(b5));
    await lose(); await pg.evaluate(() => document.getElementById('resultBtn').click()); await delay(800); await toHome(); const m5 = await mus();
    ck(sounding(m5, 'city'), '(5) ... the second defeat -> the town: the city song plays and moves', JSON.stringify(m5));

    /* ---- (6) a win -> Continue -> town ---- */
    ck(await fight(), 'a fight for the win path');
    await pg.evaluate(() => { paused = false; endBattle(true); }); await until(() => state === 'result', 30000); await delay(1500);
    const w6 = await mus(); await cont('map'); await toHome(); const m6 = await mus();
    ck(sounding(w6, 'battle') && sounding(m6, 'city'), '(6) a win: the battle song over the result, then the town plays the city song', JSON.stringify([w6, m6]));

    /* ---- (7) Mute all through a defeat; Music off/on after a defeat ---- */
    await pg.evaluate(() => sndMuteSet(true));
    ck(await fight(), 'a fight with Mute all on');
    const b7 = await mus(); await lose(); await cont('map'); await toHome(); const m7a = await mus();
    ck(b7.out === 0 && b7.cur === 'battle' && b7.playing && m7a.out === 0 && m7a.cur === 'city' && m7a.playing && m7a.moved > 0.8 && m7a.mute,
      '(7) Mute all on: the battle and city songs run underneath at master gain 0 through the defeat', JSON.stringify([b7, m7a]));
    await pg.evaluate(() => sndMuteSet(false)); const m7b = await mus();
    ck(m7b.out === 1 && !m7b.mute && sounding(m7b, 'city') && m7b.bus > 0, '(7) Mute all off on the town after the defeat: master gain 1, the city song moving', JSON.stringify(m7b));
    ck(await fight(), 'a fight before Music off/on'); await lose(); await cont('map'); await toHome();
    await pg.evaluate(() => sndSet('music', { on: false })); await delay(1500); const off = await pg.evaluate(() => MUS.cur);
    await pg.evaluate(() => sndSet('music', { on: true })); await until(() => MUS.cur === 'city', 4000); await delay(1200); const m7c = await mus();
    ck(off === null && sounding(m7c, 'city'), '(7) after a defeat, Music off then on: off = no lane, on = the city song plays and moves', JSON.stringify([off, m7c]));

    /* ---- (8) v1364 guard: the browser pauses the city song after a defeat ---- */
    ck(await fight(), 'a fight before the outside pause'); await lose(); await cont('map'); await toHome();
    await pg.evaluate(() => { MUS.log.length = 0; MUS.lanes.city.slot.el.pause(); });
    await until(() => { const s = MUS.lanes.city.slot; return !!(s && !s.el.paused && s.el.currentTime > 0.5); }, 8000); const m8 = await mus();
    ck(sounding(m8, 'city') && m8.heals.some(h => /city:paused/.test(h)), '(8) after a defeat, the city song paused from outside comes back by itself (' + m8.heals.join(',') + ')', JSON.stringify(m8));
    await pg.evaluate(() => { window.__heal = musHeal; window.musHeal = function () {}; MUS.lanes.city.slot.el.pause(); }); await delay(4500); const c8 = await mus();
    await pg.evaluate(() => { window.musHeal = window.__heal; }); await until(() => { const s = MUS.lanes.city.slot; return !!(s && !s.el.paused); }, 8000); await delay(800);
    ck(!sounding(c8, 'city'), 'CONTROL: with musHeal switched off the paused city song stays silent - the check sees the failure', JSON.stringify(c8));

    /* ---- (10) v1371: on the town after a defeat, the city song's request stalls ---- */
    ck(await fight(), 'a fight before the city stall'); await lose(); await cont('map'); await toHome();
    await pg.evaluate(() => { MUS.log.length = 0; const s = MUS.lanes.city.slot, el = s.el; el.src = '/assets/audio/' + s.song.f.replace(/\?.*$/, '') + '?stall=1'; try { el.currentTime = 0; } catch (e) {} const p = el.play(); if (p && p.catch) p.catch(() => {}); });
    await delay(1200); const s10 = await pg.evaluate(() => { const el = MUS.lanes.city.slot.el; return { paused: el.paused, t: el.currentTime, err: !!el.error }; });
    await until(() => { const s = MUS.lanes.city.slot; return !!(s && !s.el.paused && s.el.currentTime > 0.5 && !/stall=1/.test(s.el.src)); }, 15000); const m10 = await mus();
    ck(!s10.paused && !s10.err && sounding(m10, 'city'), '(10) on the town after a defeat, a stalled city song (playing, 0 s, no error) is replaced: a city song plays and moves within 15 s', JSON.stringify({ s10, m10 }));

    ck(errs.length === 0, '(11) no page errors', errs.slice(0, 3).join(' | '));
    await pg.evaluate(async () => { try { await SND.ctx.close(); } catch (e) {} }).catch(() => {});
  } catch (e) { fail++; console.log('  FAIL harness: ' + (e && e.stack || e)); }
  finally { held.forEach(r => r.abort().catch(() => {})); try { if (browser) await browser.close(); } catch (_) {} try { if (srv) srv.kill(); } catch (_) {} }
  console.log(''); console.log('PASS: ' + pass + '  FAIL: ' + fail);
  process.exit(fail ? 1 : 0);
})();
