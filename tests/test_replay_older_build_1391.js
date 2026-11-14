'use strict';
// v1391 STORED REPLAYS FROM ANOTHER BUILD (release safety: v1391 changed where skills land). Arena, city, mine and world-map reports are
// stored as seed + line-ups and re-played on the viewer's engine. In the real page (browser, the game's own watchBattle -> startVersus ->
// endBattle -> result screen):
//  - a report with an older engine id, and one with none (every report from before v1391), shows the plain notice (banner + result line)
//    and the RECORDED outcome as the title - here the recorded win stays a win although the re-played fight ends in a loss;
//  - CONTROL: a report with the page's own BUILD_ID shows no notice (same recorded win, same re-played loss);
//  - the English string is in lang/en.json and the page's inline table, and the en ?v= hash matches the file;
//  - the reports the page and the server make carry the engine id (arena attack + defence, city / mine / world-map march, shared chip).
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net'), crypto = require('crypto');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const done = () => { console.log('test_replay_older_build_1391.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0); };
const KEY = 'result.replay_older_build';

// ---------------- A. source ----------------
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'), srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const enRaw = fs.readFileSync(path.join(ROOT, 'lang', 'en.json'), 'utf8'), EN = JSON.parse(enRaw);
const inlineEn = JSON.parse(html.match(/const EW_LANG_EN=(\{.*?\});\r?\n/)[1]), V = JSON.parse(html.match(/const EW_LANG_V=(\{.*?\});\r?\n/)[1]);
const TEXT = EN[KEY];
ck('the notice is an English string in lang/en.json and the inline table', typeof TEXT === 'string' && TEXT.length > 20 && inlineEn[KEY] === TEXT && !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(TEXT), TEXT);
ck('the en ?v= hash is the hash of lang/en.json', V.en === crypto.createHash('sha1').update(enRaw).digest('hex').slice(0, 8), V.en);
const BUILD = (/const\s+BUILD_ID\s*=\s*'(\d+)'/.exec(html) || [])[1];
ck('page reports carry the engine id (arena attack + defence, march reports, shared chip)',
  /_arepMine=\{[^}]*engine:BUILD_ID\}/.test(html) && /_arepDef=\{[^}]*engine:BUILD_ID\}/.test(html) && (html.match(/engine:r\.replay\.engine\|\|null/g) || []).length === 4
  && (html.match(/oppName:m\.tName, engine:BUILD_ID \}|oppName:m\.tName,engine:BUILD_ID\}|engine:BUILD_ID \};/g) || []).length >= 3 && /const chip=\{[^}]*engine:meta\.engine/.test(html));
ck('server reports carry it (arena defences + top fights, city-attack mail, chat chips)',
  /engine:_defEngine \}\);/.test(srv) && /engine:_defEngine \}\); \}/.test(srv) && /engine:x\.engine\|\|null/.test(srv) && /defender:d\.name,engine:replay\.engine\|\|null/.test(srv) && /out\.engine=bt\.engine\.slice\(0,40\)/.test(srv));

// ---------------- B. browser ----------------
(async () => {
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ck('playwright is installed', false, e.message); return done(); }
  const port = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew1391r-'));
  const env = { ...process.env, DATABASE_URL: '', PORT: String(port), DB_FILE: path.join(dir, 'db.json'), SIM_WORKERS: '0', NODE_ENV: '' }; delete env.CLOCK_FILE;
  const sv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore', windowsHide: true });
  let b;
  try {
    let up = false; for (const t0 = Date.now(); Date.now() - t0 < 60000 && !up && sv.exitCode === null;) { try { up = (await fetch('http://127.0.0.1:' + port + '/api/health')).ok; } catch (_) {} if (!up) await delay(150); }
    if (!up) throw new Error('server did not start');
    const launch = o => chromium.launch(Object.assign({ ignoreDefaultArgs: ['--mute-audio'], args: ['--disable-audio-output'] }, o || {}));
    try { b = await launch(); } catch (e) { b = await launch({ channel: 'chrome' }); }
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => { const Px = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : (k === Symbol.toPrimitive ? () => 0 : (['value', 'currentTime', 'sampleRate'].includes(k) ? 0 : Px)), apply: () => Px, construct: () => Px, set: () => true });
      window.AudioContext = function () { return Px; }; window.webkitAudioContext = window.AudioContext; });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message))); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
    await pg.goto('http://127.0.0.1:' + port + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof watchBattle === 'function' && typeof endBattle === 'function' && typeof snapSquadFromSpecs === 'function', null, { timeout: 90000 });
    await delay(1500); await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); G.tutSkipped = true; G.tutDone = true; }); await delay(1200);
    ck('the page runs build ' + BUILD, (await pg.evaluate(() => BUILD_ID)) === BUILD);
    const login = await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'rp' + Date.now().toString(36), pass: 'password1' });   // a signed-out page reaches no screen but the sign-in gate
      if (!reg || !reg.token) return { error: JSON.stringify(reg).slice(0, 200) }; ACC.token = reg.token; ACC.id = reg.profile.id; try { adoptLedger(await api('/api/ledger')); } catch (e) {}
      G.tutSkipped = true; G.tutDone = true; return { ok: true }; });
    if (login.error) throw new Error('register: ' + login.error);
    // a recorded WIN, re-played; the re-played fight is ended as a LOSS (what an engine change can do)
    const watch = engine => pg.evaluate(async (engine) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 100 && state !== 'home' && state !== 'result'; i++) await sleep(100);
      document.getElementById('banner').innerHTML = '';
      const mine = snapSquadFromSpecs([{ key: 'vael', level: 10 }, { key: 'sylthaine', level: 10 }, { key: 'vireo', level: 10 }]);
      const foe = snapSquadFromSpecs([{ key: 'vireo', level: 10 }, { key: 'vael', level: 10 }]);
      const meta = { v: 2, seed: 4242, mineSnap: mine, foe, won: true, oppName: 'Recorded Foe' }; if (engine !== null) meta.engine = engine;
      const pre = { busy: typeof _blBusy !== 'undefined' ? _blBusy : 'na', st: state, rl: typeof rewardLocked === 'function' ? rewardLocked() : 'na' };
      watchBattle(meta);
      const banner = document.getElementById('banner').textContent;
      for (let i = 0; i < 300 && !(state === 'battle' && units.some(u => u.team === 'ally')); i++) await sleep(100);
      const inBattle = state === 'battle', dbg = { pre, busy: typeof _blBusy !== 'undefined' ? _blBusy : 'na', state, mode: CUR && CUR.mode, old: CUR && CUR.replayOld, units: (typeof units !== 'undefined' && units) ? units.length : -1 };
      paused = true; endBattle(false); paused = false;
      for (let i = 0; i < 200 && !document.getElementById('result').classList.contains('active'); i++) await sleep(100);
      await sleep(400);
      const note = document.getElementById('replayOldNote');
      const out = { inBattle, banner, title: document.getElementById('resultTitle').textContent, won: ewT('result.battle_won'), lost: ewT('result.battle_lost'),
        note: note ? note.textContent : null, hint: document.getElementById('resultHint').textContent, dbg, rew: document.getElementById('resultReward').innerHTML.slice(0, 200) };
      try { const dd = document.getElementById('ddPop'); if (dd) dd.remove(); } catch (e) {}
      show('home'); return out; }, engine);
    for (const [engine, tag] of [['1790000000000', 'older engine id'], [null, 'no engine id (a report from before v1391)'], [BUILD, 'CONTROL: this build\'s engine id']]) {
      const r = await watch(engine), old = engine !== BUILD; if (process.env.DBG) console.log(JSON.stringify(r));
      ck(tag + ': the replay ran in the battle screen', r.inBattle, JSON.stringify(r).slice(0, 200));
      ck(tag + ': the result is the RECORDED win, not the re-played loss', r.title === r.won && r.title !== r.lost, r.title);
      ck(tag + (old ? ': the result screen says it was fought on an earlier version' : ': no earlier-version line'), old ? r.note === TEXT : r.note === null, String(r.note));
      ck(tag + (old ? ': and the banner says so when it starts' : ': and no banner'), old ? r.banner.indexOf(TEXT) >= 0 : r.banner.indexOf(TEXT) < 0, r.banner.slice(0, 120));
    }
    ck('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) { ck('browser run', false, e && e.stack || e); }
  finally { try { if (b) await b.close(); } catch (_) {} try { sv.kill(); } catch (_) {} }
  done();
})();
