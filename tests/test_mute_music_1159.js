/* v1159 - MASTER MUTE BUTTON + MUSIC (Phil 15 Oct 2026: "put a sound symbol in the top right so someone can mute all volume whenever
   they want and unmute. put it on every window"; the button sits "left of the profile portrait"; city / map / battle / skyfall
   playlists; "I want the first song to continue even when you are clicking in and out of buildings" / "not pause and restart").
   Real page (Chromium, phone 844x390 landscape) on a real local server with a temp DB. EVERY RIG IS SILENT: --mute-audio, and every
   connection to an AudioContext's destination is rerouted through a gain of 0 (so nothing reaches a speaker even with mute off).
   WebGL runs on SwiftShader (CPU) - no GPU work.
   Asserts (non-zero exit on any failure):
     (1) every inline script parses, and the check catches a broken one
     (2) v1230 (Phil 30 Oct: "only have the mute button on main screens like the city screen, world map, campaign map. every other screen
         remove the mute"): the button shows ONLY on the town, the World map and the campaign map with nothing open over them - absent on
         every building, panel, window, battle, the result screen and the sign-in gate. Where it shows it is the topmost element
         at its own centre, its tap target is >= 40 px, it covers no clickable control (elementFromPoint over a 5x5 grid with the button
         hidden), and on the hub it sits immediately left of the profile portrait, centred on it
     (3) a tap on it mutes: master gain 0, the FX/Music/Voices settings untouched; a second tap restores gain 1 with the same settings;
         the tap reaches no game listener (document click/pointerdown) and queues no battle input
     (4) mute persists over a reload (ew_mute) and is applied before any sound: the master gain is 0 the moment audio unlocks
     (5) the right playlist per screen: city on the hub and in every building, map on the campaign map, battle in a fight, skyfall on a
         live Skyfall board; nothing in a headless replay (window._p2guard)
     (6) the city song never pauses or restarts through 5 buildings opened and closed quickly (no pause event, currentTime only moves
         forward), and resumes where it paused after the map and a battle
     (7) battle: each fight plays the NEXT song (ew_battle_track), from its start; at loopEnd it joins loopStart; it fades out and is
         released when the fight ends; playbackRate stays 1 and currentTime follows real time at 2x battle speed
     (8) a 2-song playlist with a shortened song crossfades into the other song
     (9) no AudioBuffer over 10 MB is ever made (music is streamed, never decoded whole)
    (10) the same seeded fight gives the same per-tick digest with music playing and mute toggled as with music off
   Control: AUD_ROOT=<a checkout of v1158> must FAIL (no button, no music).
   Screenshots: SHOT_DIR (default C:\Users\Home\Downloads\ew-sweep\mute). */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const ROOT = process.env.AUD_ROOT || path.join(__dirname, '..');
const control = !!process.env.AUD_ROOT;
const SHOTS = process.env.SHOT_DIR || (control ? '' : 'C:\\Users\\Home\\Downloads\\ew-sweep\\mute');
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + d : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => {   // every path to the speakers goes through a gain of 0
  const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); };
  window.__bufMax = 0; const cb = BaseAudioContext.prototype.createBuffer, dd = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.createBuffer = function (ch, len, sr) { window.__bufMax = Math.max(window.__bufMax, ch * len * 4); return cb.apply(this, arguments); };
  BaseAudioContext.prototype.decodeAudioData = function (a, ok, bad) { const p = dd.call(this, a, b => { try { window.__bufMax = Math.max(window.__bufMax, b.numberOfChannels * b.length * 4); } catch (e) {} if (ok) ok(b); }, bad);
    if (p && p.then) p.then(b => { try { window.__bufMax = Math.max(window.__bufMax, b.numberOfChannels * b.length * 4); } catch (e) {} }, () => {}); return p; };
  window.__AC = []; const AC = window.AudioContext; window.AudioContext = function () { const c = new AC(...arguments); window.__AC.push(c); return c; };
  window.AudioContext.prototype = AC.prototype; window.webkitAudioContext = window.AudioContext;
  window.__gameHits = { click: 0, down: 0 };
  window.addEventListener('load', () => { document.addEventListener('click', () => window.__gameHits.click++); document.addEventListener('pointerdown', () => window.__gameHits.down++); });
};
const SCREENS = ['home', 'campaign', 'menu', 'heroesPanel', 'bag', 'settings', 'temple', 'wishing', 'forge', 'guild', 'arena', 'arenaShop', 'market',
  'dungeon', 'elite', 'quest', 'signin', 'mail', 'tech', 'wall', 'world', 'skyisland', 'skyfall', 'rankings', 'glossary', 'shadymarket', 'watchtower', 'account'];

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-mute1159-'));
  let srv = null, browser = null;
  try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    /* ---- (1) parse ---- */
    const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
    const parseAll = src => { const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, n = 0; const bad = [];
      while ((m = re.exec(src))) { if (m[1] && /\bsrc=/.test(m[1])) continue; n++; try { new Function(m[2]); } catch (e) { bad.push(n + ': ' + e.message); } } return { n, bad }; };
    const pa = parseAll(html); ck(pa.n >= 3 && !pa.bad.length, 'every inline script parses (' + pa.n + ' blocks)', pa.bad.join('; '));
    ck(parseAll(html.replace('function musTick(){', 'function musTick(){ var q=\'it\'s\'; ').replace('function sndUnlock(){', 'function sndUnlock(){ var q=\'it\'s\'; ')).bad.length > 0, 'the parse check catches an unescaped quote');

    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    let chromium; try { ({ chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))); } catch (e) { ({ chromium } = require('playwright')); }   // (a worktree without node_modules: NODE_PATH)
    const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(SILENT);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    const shot = async name => { if (SHOTS) try { await pg.screenshot({ path: path.join(SHOTS, name + '.png') }); } catch (e) {} };

    /* ---- the sign-in gate (a fresh page, no token) ---- */
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1500);
    const MAIN = ['home', 'campaign', 'world'];
    const probe = () => pg.evaluate(() => { const b = document.getElementById('muteBtn'); if (!b) return { none: true };
      try { muteBtnPlace(true); } catch (e) {} if (b.style.display === 'none' || !b.getClientRects().length || getComputedStyle(b).display === 'none') return { none: true, hidden: true, why: b.dataset.why, state: (typeof state !== 'undefined' ? state : '') };
      const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy); const onTop = !!(top && (top === b || b.contains(top)));
      const clk = el => { for (let e = el, d = 0; e && d < 6; e = e.parentElement, d++) { if (e === document.body || e === document.documentElement) return null;
          if (e.matches && e.matches('button,a[href],input,select,textarea,label,[onclick],[data-nav],[role=button],.btn,.mitem,.resplus')) return e;
          const cs = getComputedStyle(e); if (cs.cursor === 'pointer' && cs.pointerEvents !== 'none') return e; } return null; };
      const sv = b.style.visibility; b.style.visibility = 'hidden'; const hits = new Set();
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = r.left + 1 + (r.width - 2) * i / 4, y = r.top + 1 + (r.height - 2) * j / 4;
        const el = document.elementFromPoint(x, y), c = el && clk(el); if (c) hits.add((c.id ? '#' + c.id : c.tagName.toLowerCase() + (c.className && typeof c.className === 'string' ? '.' + c.className.split(' ')[0] : '')) + (c.textContent ? '[' + c.textContent.trim().slice(0, 18) + ']' : '')); }
      b.style.visibility = sv;
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), onTop, hits: [...hits], state: (typeof state !== 'undefined' ? state : '') }; });
    const g0 = await probe();
    ck(g0.none, 'v1230: no button on the sign-in gate (not a main screen)', JSON.stringify(g0));
    await shot('00-signin-gate');

    /* ---- sign in ---- */
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'mute' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await delay(2500);

    /* ---- (2) the hub: immediately left of the portrait, centred on it ---- */
    const hub = await pg.evaluate(() => { muteBtnPlace(); const b = document.getElementById('muteBtn').getBoundingClientRect(), p = document.getElementById('profileBtn').getBoundingClientRect();
      /* v1163: measured from the portrait as drawn - its ring frame (#pfFrame) reaches past the box; within 8 px of centred (the name plate under it) */
      const f = document.getElementById('pfFrame').getBoundingClientRect(), L = Math.min(p.left, f.width ? f.left : p.left);
      return { gap: Math.round(L - b.right), dy: Math.round((b.top + b.height / 2) - (p.top + p.height / 2)), b: [Math.round(b.left), Math.round(b.top)], p: [Math.round(p.left), Math.round(p.top), Math.round(p.width)] }; }).catch(() => null);
    ck(hub && hub.gap >= 2 && hub.gap <= 12 && Math.abs(hub.dy) <= 8, 'hub: the button sits immediately left of the profile portrait, centred on it (' + JSON.stringify(hub) + ')');
    const screens = [];
    let n = 1;
    for (const s of SCREENS) {
      await pg.evaluate(s => { try { show(s); } catch (e) {} }, s); await delay(1200);
      const r = await probe(); screens.push([s, r]);
      if (MAIN.includes(s)) ck(!r.none && r.onTop && !r.hits.length && r.w >= 40, 'main screen ' + s + ': button shown, on top, covers no control', JSON.stringify(r));
      else ck(r.none, 'screen ' + s + ': no button (only the town, World map and campaign map have it)', JSON.stringify(r));
      if (['home', 'campaign', 'world', 'temple', 'wishing', 'forge', 'guild', 'settings', 'heroesPanel', 'arena', 'skyfall', 'mail', 'quest'].includes(s)) await shot(String(n++).padStart(2, '0') + '-' + s);
    }
    // modals and windows over the hub
    await pg.evaluate(() => show('home')); await delay(600);
    for (const [name, open, close] of [
      ['hub menu (open)', () => { document.getElementById('hubMenu').classList.add('open'); }, () => document.getElementById('hubMenu').classList.remove('open')],
      ['profile window', () => { document.getElementById('profileBtn').click(); }, () => { try { document.getElementById('profClose').click(); } catch (e) {} }],
      ['food shop window', () => { document.getElementById('staminaPlus').click(); }, () => { try { document.getElementById('hudShopClose').click(); } catch (e) {} }] ]) {
      await pg.evaluate(open); await delay(700); const r = await probe();
      if (name === 'hub menu (open)') ck(!r.none && r.onTop && !r.hits.length, 'the town MENU dropdown open: the button stays (part of the town screen), covers no control', JSON.stringify(r));
      else ck(r.none, 'window ' + name + ' open over the town: no button', JSON.stringify(r)); await shot(String(n++).padStart(2, '0') + '-' + name.replace(/\W+/g, '-'));
      await pg.evaluate(close); await delay(300);
    }
    // v1230: the Training Province panel (Phil's screenshot: the button sat on its top-right corner) - none
    await pg.evaluate(() => { show('skyisland'); try { openTrainingProvince(); } catch (e) {} }); await delay(1500);
    const tp = await probe(); ck(tp.none, 'v1230: no button on the Training Province panel', JSON.stringify(tp)); await shot(String(n++).padStart(2, '0') + '-training-province');
    await pg.evaluate(() => { document.querySelectorAll('.provScene').forEach(e => e.remove()); show('home'); }); await delay(800);
    const hb = await probe(); ck(!hb.none && hb.onTop, 'v1230: back on the town the button is shown again', JSON.stringify(hb));

    /* ---- desktop 1920x1080 and phone portrait 390x844 ---- */
    for (const [w, h, list] of [[1920, 1080, ['home', 'campaign', 'world', 'menu', 'temple', 'wall', 'skyfall', 'settings', 'guild']], [390, 844, ['home', 'campaign', 'settings']]]) {
      await pg.setViewportSize({ width: w, height: h }); await delay(900);
      for (const s of list) { await pg.evaluate(s => { try { show(s); } catch (e) {} }, s); await delay(1200); const r = await probe(); screens.push([s + '@' + w + 'x' + h, r]);
        if (!MAIN.includes(s)) ck(r.none, w + 'x' + h + ' ' + s + ': no button', JSON.stringify(r));
        else if (h > w) ck(!r.none && r.onTop && r.w >= 40, w + 'x' + h + ' ' + s + ': button shown (portrait is not a game layout - the game locks landscape; overlap not judged)', JSON.stringify(r));
        else ck(!r.none && r.onTop && !r.hits.length && r.w >= 40, w + 'x' + h + ' ' + s + ': button on top, covers no control', JSON.stringify(r));
        if (s === 'home' || s === 'campaign') await shot(String(n++).padStart(2, '0') + '-' + s + '-' + w + 'x' + h); }
    }
    await pg.setViewportSize({ width: 844, height: 390 }); await pg.evaluate(() => show('home')); await delay(900);
    /* ---- (3) tap = mute / unmute, through the real pointer; the game sees nothing ---- */
    const btnC = async () => pg.evaluate(() => { const r = document.getElementById('muteBtn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const tap = async () => { const [x, y] = await btnC(); await pg.mouse.click(x, y); await delay(250); };
    await pg.evaluate(() => { window.__gameHits.click = 0; window.__gameHits.down = 0; });
    const cfg0 = await pg.evaluate(() => JSON.stringify(SND.cfg));
    await tap();   // first tap: unlocks audio AND mutes
    const m1 = await pg.evaluate(() => ({ on: SND_MUTE.on, gain: SND.out && SND.out.gain.value, cfg: JSON.stringify(SND.cfg), ls: localStorage.getItem('ew_mute'), img: document.querySelector('#muteBtn img').src, hits: window.__gameHits }));
    ck(m1.on && m1.gain === 0 && m1.cfg === cfg0 && m1.ls === '1' && /audio-off/.test(m1.img), 'a tap mutes: master gain 0, FX/Music/Voices untouched, saved, muted icon', JSON.stringify(m1));
    ck(m1.hits.click === 0 && m1.hits.down === 0, 'the tap reached no game listener', JSON.stringify(m1.hits));
    await shot(String(n++).padStart(2, '0') + '-home-muted');
    await pg.evaluate(() => sndSet('music', { vol: 0.42 }));
    const cfgB = await pg.evaluate(() => JSON.stringify(SND.cfg));
    await tap();
    const m2 = await pg.evaluate(() => ({ on: SND_MUTE.on, gain: SND.out.gain.value, cfg: JSON.stringify(SND.cfg), bus: +SND.bus.music.gain.value.toFixed(3), ls: localStorage.getItem('ew_mute') }));
    ck(!m2.on && m2.gain === 1 && m2.cfg === cfgB && m2.bus === 0.42 && m2.ls === '0', 'a second tap unmutes and gives back exactly the Settings levels', JSON.stringify(m2));
    await pg.evaluate(() => sndSet('music', { vol: 0.6 }));
    // the Settings row shows the same flag
    const chk = async () => { await pg.evaluate(() => show('settings')); await delay(600); const c = await pg.evaluate(() => { const c = document.getElementById('snd_mute'); return c ? c.checked : null; }); await pg.evaluate(() => show('home')); await delay(700); return c; };
    await tap(); const st1 = await chk(); await tap(); const st2 = await chk();
    ck(st1 === true && st2 === false, 'Settings "Mute all" follows the button', st1 + '/' + st2);

    /* ---- (5)(6) music per screen; the city song plays straight through the buildings ---- */
    await pg.evaluate(() => show('home')); await delay(1500);
    const cityA = await pg.evaluate(() => { const L = MUS.lanes.city, s = L && L.slot; return { cur: MUS.cur, f: s && s.song && s.song.f, t: s && s.el.currentTime, paused: s && s.el.paused, rate: s && s.el.playbackRate }; });
    ck(cityA.cur === 'city' && /music\/city-/.test(cityA.f || '') && cityA.paused === false, 'hub: a city song is playing', JSON.stringify(cityA));
    const walk = await pg.evaluate(async () => { const L = MUS.lanes.city, s = L.slot, el = s.el, f = s.song.f, ts = [el.currentTime]; MUS.log.length = 0; let pauses = 0; const pz = () => pauses++; el.addEventListener('pause', pz);
      for (const b of ['temple', 'forge', 'wishing', 'guild', 'heroesPanel']) { show(b); for (let i = 0; i < 3; i++) { await new Promise(r => setTimeout(r, 110)); ts.push(el.currentTime); } show('home'); await new Promise(r => setTimeout(r, 110)); ts.push(el.currentTime); }
      el.removeEventListener('pause', pz);
      let back = 0, jump = 0; for (let i = 1; i < ts.length; i++) { const d = ts[i] - ts[i - 1]; if (d < 0) back++; if (d > 0.6) jump++; }
      return { pauses, back, jump, same: L.slot === s && s.song.f === f, cur: MUS.cur, starts: MUS.log.filter(x => x[0] === 'start' || x[0] === 'resume' || x[0] === 'scene').length, t0: ts[0], t1: ts[ts.length - 1], n: ts.length }; });
    ck(walk.pauses === 0 && walk.back === 0 && walk.jump === 0 && walk.same && walk.cur === 'city' && walk.starts === 0 && walk.t1 > walk.t0,
      'city song through 5 buildings opened and closed quickly: no pause, no restart, currentTime only forward', JSON.stringify(walk));
    // the map
    const tCity = await pg.evaluate(() => MUS.lanes.city.slot.el.currentTime);
    await pg.evaluate(() => show('campaign')); await delay(1800);
    const mp = await pg.evaluate(() => { const s = MUS.lanes.map && MUS.lanes.map.slot, c = MUS.lanes.city.slot; return { cur: MUS.cur, f: s && s.song.f, playing: s && !s.el.paused, cityPaused: c && c.el.paused, cityT: c && c.el.currentTime }; });
    ck(mp.cur === 'map' && /music\/map-/.test(mp.f || '') && mp.playing && mp.cityPaused, 'campaign map: a map song plays, the city song is paused where it was', JSON.stringify(mp));
    await shot(String(n++).padStart(2, '0') + '-campaign-map-music');
    await pg.evaluate(() => show('home')); await delay(1500);
    const back1 = await pg.evaluate(() => { const c = MUS.lanes.city.slot; return { cur: MUS.cur, t: c && c.el.currentTime, playing: c && !c.el.paused, mapPaused: MUS.lanes.map.slot && MUS.lanes.map.slot.el.paused }; });
    ck(back1.cur === 'city' && back1.playing && back1.t >= mp.cityT - 0.05 && back1.t < mp.cityT + 3 && back1.mapPaused, 'back on the hub: the city song resumes where it paused (' + mp.cityT.toFixed(2) + ' -> ' + (back1.t || 0).toFixed(2) + ')', JSON.stringify(back1));

    /* ---- (7) battle ---- */
    const startFight = () => pg.evaluate(() => { CUR = { node: 1, mode: 'arena' }; _startVersusNow([{ key: 'grosk', level: 5, rank: 1 }, { key: 'gruel', level: 5, rank: 1 }], true); paused = true; });
    const k0 = await pg.evaluate(() => { try { return localStorage.getItem('ew_battle_track'); } catch (e) { return null; } });
    await startFight(); await delay(1500);
    const b1 = await pg.evaluate(() => { const s = MUS.lanes.battle && MUS.lanes.battle.slot; return { cur: MUS.cur, f: s && s.song.f, t: s && s.el.currentTime, start: s && s.song.start, k: localStorage.getItem('ew_battle_track'), cityPaused: MUS.lanes.city.slot.el.paused }; });
    const list = await pg.evaluate(() => MUSIC_LISTS.battle.map(x => x.f));
    const kExp = k0 == null ? 0 : (+k0 + 1) % list.length;
    ck(b1.cur === 'battle' && b1.f === list[kExp] && b1.t >= b1.start && b1.t < b1.start + 2.5 && b1.cityPaused, 'battle: the next song in the cycle (' + b1.f + ') starts at its start (' + b1.start + ' s)', JSON.stringify(b1));
    await shot(String(n++).padStart(2, '0') + '-battle');
    const br = await probe(); ck(br.none, 'v1230: no button in a battle', JSON.stringify(br));
    // 2x: real time, rate 1
    const rt = await pg.evaluate(async () => { gameSpeed = 2; paused = false; const el = MUS.lanes.battle.slot.el, a = el.currentTime, w = performance.now(); await new Promise(r => setTimeout(r, 2000));
      const out = { rate: el.playbackRate, d: el.currentTime - a, wall: (performance.now() - w) / 1000 }; paused = true; gameSpeed = 1; return out; });
    ck(rt.rate === 1 && Math.abs(rt.d - rt.wall) < 0.35, 'battle at 2x: playbackRate 1, the song moves with real time (' + rt.d.toFixed(2) + ' s in ' + rt.wall.toFixed(2) + ' s)', JSON.stringify(rt));
    // the loop seam
    const seam = await pg.evaluate(async () => { const L = MUS.lanes.battle, s = L.slot, song = s.song; MUS.log.length = 0; s.el.currentTime = song.loopEnd - 2.2;
      for (let i = 0; i < 60 && L.slot === s; i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 400)); const n = L.slot; return { moved: n !== s, t: n && n.el.currentTime, loopStart: song.loopStart, loopEnd: song.loopEnd, same: n && n.song === song, log: MUS.log.filter(x => x[0] === 'seam'), oldFree: !s.lane }; });
    ck(seam.moved && seam.same && seam.t >= seam.loopStart && seam.t < seam.loopStart + 1.2 && seam.log.length === 1 && seam.oldFree,
      'battle: at loopEnd (' + seam.loopEnd + ') the song joins its loopStart (' + seam.loopStart + ') - now ' + (seam.t || 0).toFixed(2), JSON.stringify(seam));
    // the end - v1163 (Phil 16 Oct, Aether Vault FLOOR 28 CLEARED: "make it so the combat music doesnt end until I click continue on the
    // rewards screen. Just loop the song they were listening to"): the same song plays on over the result screen, loops on its seam, and only
    // gives way on Continue; the battle cycle does not move until the next fight
    const toResult = async won => { await pg.evaluate(w => { paused = false; endBattle(w); }, won);
      for (let i = 0; i < 100; i++) { if (await pg.evaluate(() => state === 'result')) break; await delay(100); } await delay(1600); };
    const onResult = () => pg.evaluate(() => { const s = MUS.lanes.battle && MUS.lanes.battle.slot; return { st: state, cur: MUS.cur, f: s && s.song && s.song.f, playing: !!(s && !s.el.paused),
      gain: s ? +s.g.gain.value.toFixed(2) : null, k: localStorage.getItem('ew_battle_track'), rate: s && s.el.playbackRate }; });
    const kBefore = await pg.evaluate(() => localStorage.getItem('ew_battle_track')), fBefore = await pg.evaluate(() => MUS.lanes.battle.slot && MUS.lanes.battle.slot.song.f);
    await toResult(true);
    const r1 = await onResult();
    ck(r1.st === 'result' && r1.cur === 'battle' && r1.f === fBefore && r1.playing && r1.gain > 0.9 && r1.k === kBefore && r1.rate === 1,
      'result screen (a win): the same battle song plays on at full level, rate 1, the cycle index unchanged (' + r1.f + ')', JSON.stringify([r1, fBefore, kBefore]));
    await shot(String(n++).padStart(2, '0') + '-result-music');
    const rr = await probe(); ck(rr.none, 'v1230: no button on the result screen', JSON.stringify(rr));
    const rseam = await pg.evaluate(async () => { const L = MUS.lanes.battle, s = L.slot, song = s.song; MUS.log.length = 0; s.el.currentTime = song.loopEnd - 2.2;
      for (let i = 0; i < 60 && L.slot === s; i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 400)); const nn = L.slot; return { st: state, cur: MUS.cur, moved: nn !== s, same: nn && nn.song === song, t: nn && nn.el.currentTime, loopStart: song.loopStart, loopEnd: song.loopEnd, seams: MUS.log.filter(x => x[0] === 'seam').length }; });
    ck(rseam.st === 'result' && rseam.cur === 'battle' && rseam.moved && rseam.same && rseam.t >= rseam.loopStart && rseam.t < rseam.loopStart + 1.2 && rseam.seams === 1,
      'result screen: at loopEnd (' + rseam.loopEnd + ') the song loops seamlessly to its loopStart (' + rseam.loopStart + ') while the screen is open', JSON.stringify(rseam));
    const cont = await pg.evaluate(async () => { const s = MUS.lanes.battle.slot, t0 = s.el.currentTime; await new Promise(r => setTimeout(r, 1500));
      const still = state === 'result' && MUS.cur === 'battle' && MUS.lanes.battle.slot === s && !s.el.paused && s.el.currentTime > t0;
      document.getElementById('resultBtn').click(); await new Promise(r => setTimeout(r, 1900));
      return { still, st: state, cur: MUS.cur, slot: !!MUS.lanes.battle.slot, busy: MUS.pool.filter(x => x.lane === 'battle').length, k: localStorage.getItem('ew_battle_track') }; });
    ck(cont.still && cont.st !== 'result' && cont.cur && cont.cur !== 'battle' && !cont.slot && cont.busy === 0 && cont.k === kBefore,
      'it switches only after Continue: still playing 1.5 s later, then Continue crossfades to the ' + cont.cur + ' song and releases it; the cycle index still unchanged', JSON.stringify(cont));
    await pg.evaluate(() => { try { cancelResult(); } catch (e) {} show('home'); }); await delay(1500);
    const back2 = await pg.evaluate(() => ({ cur: MUS.cur, t: MUS.lanes.city.slot.el.currentTime, playing: !MUS.lanes.city.slot.el.paused }));
    ck(back2.cur === 'city' && back2.playing && back2.t >= back1.t, 'after the battle the city song resumes (not from the start)', JSON.stringify(back2));
    // the next fight plays the next song
    await startFight(); await delay(1200);
    const b2 = await pg.evaluate(() => MUS.lanes.battle.slot && MUS.lanes.battle.slot.song.f);
    ck(b2 === list[(kExp + 1) % list.length], 'the next fight plays the next song in the cycle (' + b2 + ')');
    // a defeat: the same - the song plays on over the DEFEAT screen
    const kB2 = await pg.evaluate(() => localStorage.getItem('ew_battle_track'));
    await toResult(false);
    const d1 = await onResult();
    ck(d1.st === 'result' && d1.cur === 'battle' && d1.f === b2 && d1.playing && d1.gain > 0.9 && d1.k === kB2, 'defeat screen: the same battle song plays on, the cycle index unchanged', JSON.stringify(d1));
    // a new fight straight from the result screen (Retry / Next): the NEXT song, the old one released
    await startFight(); await delay(1800);
    const b3 = await pg.evaluate(() => ({ f: MUS.lanes.battle.slot && MUS.lanes.battle.slot.song.f, busy: MUS.pool.filter(x => x.lane === 'battle').length, cur: MUS.cur }));
    ck(b3.cur === 'battle' && b3.f === list[(kExp + 2) % list.length] && b3.busy === 1, 'a new fight started from the result screen plays the next song (' + b3.f + '), the held one released', JSON.stringify(b3));
    // CONTROL: v1159's end-of-fight fade put back (musWant -> no music once the fight has ended) must fail the result-screen check
    await pg.evaluate(() => { window.__mwKeep = musWant; window.musWant = function () { const s = state, rep = !!(CUR && CUR.mode === 'replay');
        if (s === 'battle') return (rep && MUS.cur === 'skyfall') ? 'skyfall' : (ended ? null : 'battle'); if (s === 'result') return (rep && MUS.cur === 'skyfall') ? 'skyfall' : null; return window.__mwKeep(); }; });
    await toResult(true); const cr = await onResult();
    await pg.evaluate(() => { window.musWant = window.__mwKeep; });
    const ctlPass = cr.st === 'result' && cr.cur === 'battle' && cr.playing;
    ck(!ctlPass, 'CONTROL: with v1159\'s 1.2 s fade-on-end put back, the result-screen check FAILS (music ' + cr.cur + ' on the result screen)', JSON.stringify(cr));
    await pg.evaluate(() => { try { cancelResult(); } catch (e) {} show('home'); }); await delay(800);

    /* ---- skyfall ---- */
    await pg.evaluate(() => { SKYSIM.running = true; show('skyfall'); }); await delay(1600);
    const sk = await pg.evaluate(() => ({ cur: MUS.cur, f: MUS.lanes.skyfall && MUS.lanes.skyfall.slot && MUS.lanes.skyfall.slot.song.f }));
    ck(sk.cur === 'skyfall' && /music\/sky-/.test(sk.f || ''), 'a live Skyfall board plays a skyfall song', JSON.stringify(sk));
    await pg.evaluate(() => { SKYSIM.running = false; show('home'); }); await delay(1300);

    /* ---- (8) a 2-song playlist with a short song crossfades into the other ---- */
    const xf = await pg.evaluate(async () => { const keep = MUSIC_LISTS.city; MUSIC_LISTS.city = [Object.assign({}, keep[1], { end: 5 }), Object.assign({}, keep[2], { end: 5 })]; const shortF = MUSIC_LISTS.city.map(x => x.f);
      musSwitch(null); const L = MUS.lanes.city; if (L.slot) musFree(L.slot); L.slot = null; L.bag = []; L.last = -1; MUS.log.length = 0;
      await new Promise(r => setTimeout(r, 300)); musTick(); const first = L.slot && L.slot.song.f; MUSIC_LISTS.city.forEach(x => { if (x.f !== first) x.end = 999; });
      for (let i = 0; i < 100 && !MUS.log.some(x => x[0] === 'xfade'); i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 4200)); const second = L.slot && L.slot.song.f, playing = L.slot && !L.slot.el.paused;
      const out = { first, second, playing, xf: MUS.log.filter(x => x[0] === 'xfade').map(x => x.slice(1, 4)), busy: MUS.pool.filter(s => s.lane === 'city').length };
      musSwitch(null); if (L.slot) musFree(L.slot); L.slot = null; L.bag = []; MUSIC_LISTS.city = keep; await new Promise(r => setTimeout(r, 1200)); musTick(); return out; });
    ck(xf.first && xf.second && xf.first !== xf.second && xf.playing && xf.xf.length >= 1 && xf.busy === 1, '2-song playlist: the short song crossfades into the other, the old one is released', JSON.stringify(xf));

    /* ---- (10) the same seeded fight, music playing + mute toggled vs music off ---- */
    const FIGHT = `(async (noisy)=>{ const svG=window._p2guard; window._p2guard=false; if(!noisy){ sndSet('music',{on:false}); }
      ended=false; state='battle'; CUR={mode:'replay',seed:4242}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(4242); paused=true;
      units=[]; ['aureth','carn','sylthaine','grosk','tharl'].forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ['gruel','fritz','hollow','umbris','vael'].forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u)); let H=2166136261>>>0; const mix=s=>{ for(let i=0;i<s.length;i++){ H^=s.charCodeAt(i); H=Math.imul(H,16777619)>>>0; } };
      let t=0, mid=null; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ if(i===600) mid=MUS.cur; updateBattle(SIM_STEP); t++;
        mix(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*100)].join(':')).join('|'));
        if(i%60===0){ if(noisy&&i%180===0) sndMuteSet(!SND_MUTE.on); await new Promise(r=>setTimeout(r,0)); } }
      const out=t+':'+H.toString(16); ended=true; sndMuteSet(false); sndSet('music',{on:true}); window._p2guard=svG; return { out, cur: mid }; })`;
    const fA = await pg.evaluate(FIGHT + '(true)'); await delay(1500); await pg.evaluate(() => { try { cancelResult(); } catch (e) {} show('home'); }); await delay(800);
    const fB = await pg.evaluate(FIGHT + '(false)'); await delay(1500); await pg.evaluate(() => { try { cancelResult(); } catch (e) {} show('home'); }); await delay(800);
    ck(fA.out === fB.out && fA.cur === 'battle' && fB.cur === null, 'the same seeded fight is tick-identical with music + mute toggles as with music off (' + fA.out + ')', JSON.stringify([fA, fB]));

    /* ---- headless replay ---- */
    const hr = await pg.evaluate(() => { const sv = window._p2guard; window._p2guard = true; const w = musWant(), ok = musOK(); window._p2guard = sv; return { w, ok }; });
    ck(hr.w === null && hr.ok === false, 'no music in a headless replay (window._p2guard)', JSON.stringify(hr));

    /* ---- (9) memory ---- */
    const mem = await pg.evaluate(() => ({ max: window.__bufMax, pool: MUS.pool.length }));
    ck(mem.max <= 10 * 1024 * 1024 && mem.pool <= 8, 'no AudioBuffer over 10 MB (largest ' + (mem.max / 1048576).toFixed(2) + ' MB); ' + mem.pool + ' streamed elements', JSON.stringify(mem));

    /* ---- (4) persistence over a reload ---- */
    await pg.evaluate(() => sndMuteSet(true));
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof SND_MUTE !== 'undefined', null, { timeout: 90000 }); await delay(2500);
    const pr0 = await pg.evaluate(() => ({ on: SND_MUTE.on, ctx: !!SND.ctx, img: (document.querySelector('#muteBtn img') || {}).src || '' }));
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(800);
    await pg.mouse.click(5, 385); await delay(400);
    const pr1 = await pg.evaluate(() => ({ on: SND_MUTE.on, gain: SND.out ? SND.out.gain.value : null }));
    ck(pr0.on && /audio-off/.test(pr0.img) && pr1.on && pr1.gain === 0, 'mute persists over a reload and holds from the first unlock (gain ' + pr1.gain + ')', JSON.stringify([pr0, pr1]));
    await pg.evaluate(() => sndMuteSet(false));

    ck(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'screens.json'), JSON.stringify({ hub, screens }, null, 1));
    await pg.evaluate(async () => { try { for (const c of (window.__AC || [])) await c.close(); } catch (e) {} });
  } catch (e) { fail++; console.log('  FAIL harness: ' + (e && e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (_) {} try { if (srv) srv.kill(); } catch (_) {} }
  console.log(''); console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (control) { console.log(fail ? 'CONTROL: failed as it must' : 'CONTROL DID NOT FAIL'); process.exit(fail ? 0 : 1); }
  process.exit(fail ? 1 : 0);
})();
