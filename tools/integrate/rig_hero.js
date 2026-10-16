// tools/integrate rig (rig_ng.js v1166-v1175, from rig_korvux.js v1162), hero-agnostic. A real battle on a local server (its own free port, temp DB), phone landscape 844x390 @2x,
// Android UA (the phone texture tier), headless, software GL (swiftshader). SOUND: AudioContext removed before load + --mute-audio + headless;
// SND gain 0 and its context closed if any. rAF stubbed, the clock driven by hand one 60 fps frame at a time (real speed).
// PROBE (two reps): for each action the cell DRAWN on the frame the engine releases / lands it - attack: the projectile leaves (spawnProjFx /
//   spawnShot); green / blue / ult: the cast release (u._pend resolves) or the form landing (its 2nd doEffect) where that is the contact.
//   Nox's passive: the fifth key (u._keys = 5) - the clip it plays.
// STILLS: one screenshot per state on its moment (the attack WIDE: him and his target 8.9 m apart, the ball in flight), idle, walk, hit, passive.
// CLIP: every 2nd frame (30 fps) of each state from its start, zoomed on him, for the clip page.
// usage: node rig_hero.js <repo> <outdir> <hero> probe|stills|clip [port] [rig_config.json]
// Run it only through tools/integrate/rig_locked.sh (the shared GPU lock, one browser at a time, >= 2 GB free on the 4080).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = process.argv[2], OUT = process.argv[3], K = process.argv[4], MODE = process.argv[5] || 'probe', PORT = +(process.argv[6] || 9481);
fs.mkdirSync(OUT, { recursive: true });
const delay = ms => new Promise(r => setTimeout(r, ms));
// v-integrate: the hero's moments / states / staging come from a JSON file (tools/integrate/checks.py writes it from the config):
//   { moment: {attack:'shot'|'hit', green:'rel'|'land', ...}, states: [...], close: {state:1}, passive: '<js run on the hero u to bring the passive on>', passiveCell: 20, walkGap: 700 }
const RC = JSON.parse(fs.readFileSync(process.argv[7] || path.join(OUT, 'rig_config.json'), 'utf8'));
const MOMENT = RC.moment, STATES = RC.states, CLOSE = RC.close || {};
const GAP = 250;
const WALKGAP = RC.walkGap || 700;   // the walk needs a target beyond his hold
const HOLD = `{ const c=units.find(x=>x.key===${JSON.stringify(process.argv[4])}), v=units.find(x=>x.key==='vael'); c.x=c._ax=520; c.y=c._ay=980; v.x=v._ax=570; v.y=v._ay=965; }`;
(async () => {
  const db = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ew-ng-rig-')), 'db.json');
  const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DB_FILE: db }, stdio: 'ignore', windowsHide: true });
  let b; const reqFail = [], reqBad = [];
  try {
    for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) break; } catch (_) {} await delay(250); }
    b = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36' });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('requestfailed', r => reqFail.push(r.url() + ' ' + ((r.failure() || {}).errorText || '')));
    p.on('response', r => { if (r.status() >= 400) reqBad.push(r.status() + ' ' + r.url()); });
    await p.addInitScript((br) => { window.AudioContext = undefined; window.webkitAudioContext = undefined; window.__backRowWalk = br; }, !!RC.backRowWalk);
    await p.goto(`http://127.0.0.1:${PORT}/play`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
    await p.evaluate(() => { const q = document.querySelector('.splashPlay'); if (q) q.click(); }); await p.waitForTimeout(1200);
    await p.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'rigng' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; document.body.classList.remove('gated'); show('home'); });
    await p.waitForTimeout(600);
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Skip Tutorial/i.test(x.textContent) && x.offsetParent); if (b) b.click(); });
    console.log('sound', JSON.stringify(await p.evaluate(() => { try { if (typeof SND !== 'undefined' && SND) { if (SND.out) SND.out.gain.value = 0; return { snd: true, ctx: !!SND.ctx }; } } catch (e) { return { err: e.message }; } return { snd: false }; })));
    await p.evaluate((K) => { try { [K, 'askel'].forEach(k => G.unlocked[k] = true); } catch (e) {} G.team = [K, 'askel']; CUR = { mode: 'arena', seed: 7 };
      startVersus([{ key: 'vael', level: 30 }, { key: 'umbris', level: 30 }, { key: 'tick', level: 30 }], true, [K, 'askel']); }, K);
    for (let i = 0; i < 240; i++) { if (await p.evaluate(() => state === 'battle' && units.length > 0 && units.every(u => u.mesh))) break; await p.waitForTimeout(250); }
    await p.waitForTimeout(1500);
    const info = await p.evaluate((K) => {
      window.__raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; window.__t = performance.now();
      units.forEach(u => { u.greenCd = 999; u.blueCd = 999; u.energy = 0; u.maxHp = u.hp = 1e7; u.speed = 0; u.atkCd = 99; });
      const u = units.find(x => x.key === K);
      window.__hits = []; const _dd = dealDamage; dealDamage = function (s) { if (s && s.key === K) window.__hits.push(battleTime); return _dd.apply(this, arguments); };
      window.__fx = []; const _de = doEffect; doEffect = function (uu, ty) { if (uu && uu.key === K) window.__fx.push([ty, battleTime]); return _de.apply(this, arguments); };
      window.__shots = []; const _sp = spawnProjFx, _ss = spawnShot;
      spawnProjFx = function (k) { window.__shots.push([k, battleTime]); return _sp.apply(this, arguments); }; spawnShot = function (s) { if (s && s.key === K) window.__shots.push(['shot', battleTime]); return _ss.apply(this, arguments); };
      window.__pc = []; const _fp = firePassiveClip; firePassiveClip = function (o, h) { if (o && o.key === K) window.__pc.push([battleTime, h]); return _fp.apply(this, arguments); };
      return { build: BUILD_ID, state, phone: texPhone(), units: units.map(u => u.key + ':' + u.team), range: u.range, melee: u.melee, anim: Object.keys(u.anim).filter(s => s[0] !== '_').map(s => s + ' ' + u.anim[s].u.split('/').pop()) };
    }, K);
    console.log('battle', JSON.stringify(info));
    await p.waitForTimeout(20000);   // sheets load while the fight clock is stopped
    console.log('ready', JSON.stringify(await p.evaluate((K) => { const u = units.find(x => x.key === K); return Object.keys(u.anim || {}).map(k => { const c = u.anim[k]; const im = c && c.tex && c.tex.image; return k + ':' + (c && c._err ? 'ERR' : im ? ((im.width | 0) + 'x' + (im.height | 0)) : 'none'); }).join(' '); }, K)));
    const H = (who, move) => `units.forEach(u => { u.greenCd = 999; u.blueCd = 999; if(!(u.key===${JSON.stringify(K)}&&window.__ultOk)) u.energy = 0; u.hp = u.maxHp; if (u.key !== ${JSON.stringify(who)}) u.atkCd = Math.max(u.atkCd || 0, 9); ${move ? 'if(u.key!==' + JSON.stringify(K) + ')' : ''} u.speed = 0; });`;
    const frame = (h) => p.evaluate(([h, K]) => { window.__t += 1000 / 60; loop(window.__t); eval(h); const u = units.find(x => x.key === K); const v = units.find(x => x.key === 'vael');
      return { bt: +battleTime.toFixed(4), st: u._animSt, fr: u._fxFr, x: Math.round(u.x), dm: +(Math.hypot(u.x - v.x, u.y - v.y) / METER).toFixed(2) }; }, [h, K]);
    const step = (sec, h) => p.evaluate(([sec, h]) => { const T = battleTime + sec; let g = 0; while (battleTime < T - 1e-6 && g++ < 5000) { window.__t += 1000 / 60; loop(window.__t); eval(h); } return battleTime; }, [sec, h]);
    const stage = (gap, left) => p.evaluate(([gap, left, K]) => { const kx = left ? 1300 : 520, pos = { [K]: [kx, 980], vael: [kx + (left ? -gap : gap), 930], umbris: [left ? 200 : 1500, 300], tick: [left ? 200 : 1500, 450], askel: [left ? 1600 : 150, 1300] };
      units.forEach(u => { const q = pos[u.key] || [100, 100]; u.x = u._ax = q[0]; u.y = u._ay = q[1]; if (u.rx != null) { u.rx = q[0]; u.ry = q[1]; } u._dash = null; u.atkCd = 99; u._pend = null; u._castT = 0; u._abilHold = 0; u._atkHold = 0; u._hitHold = 0; u._animLockT = 0; u.energy = 0; u._idleHold = 0; });
      const c = units.find(u => u.key === K); c.target = units.find(u => u.key === 'vael'); c._faceDir = left ? -1 : 1; window.__hits = []; window.__fx = []; window.__shots = []; window.__pc = []; window.__ultOk = false; }, [gap, left, K]);
    const focus = (z, mid) => p.evaluate(([z, K, mid]) => { try { battleZoom = 1; battlePanX = 0; battlePanY = 0; applyBattleView(); const u = units.find(x => x.key === K); const v = u.mesh.position.clone();
        if (mid) { const w = units.find(x => x.key === 'vael').mesh.position; v.x = (v.x + w.x) / 2; v.z = (v.z + w.z) / 2; }
        v.y += +(window.__FY || 1.6); v.project(camera);
        const el = document.getElementById('three'); const r = el.getBoundingClientRect(); const sx = (v.x + 1) / 2 * r.width, sy = (1 - v.y) / 2 * r.height;
        battleZoom = z; battlePanX = -(sx - r.width / 2) * z; battlePanY = -(sy - r.height / 2) * z; applyBattleView(); return [sx, sy]; } catch (e) { return e.message; } }, [z, K, mid]);
    const Z = +(process.env.ZOOM || 2.0);
    const shot = async (name, extra, z, mid) => { await focus(z || Z, mid); await p.screenshot({ path: OUT + '/' + name + '.png' }); console.log('shot', name, JSON.stringify(Object.assign(await frame('0'), extra || {}))); };
    const moment = async (kind, h, maxF) => {
      const rows = [];
      for (let i = 0; i < maxF; i++) { const r = await frame(h); const m = await p.evaluate((K) => ({ hits: window.__hits.length, shots: window.__shots.length, fx: window.__fx.length, pc: window.__pc.length, pend: !!units.find(x => x.key === K)._pend }), K);
        rows.push([i, r.bt, r.st, r.fr]); const w = MOMENT[kind];
        if (w === 'shot' && m.shots >= 1) return { i, row: r, rows };
        if (w === 'rel' && m.fx >= 1 && !m.pend) return { i, row: r, rows };
        if (w === 'land' && m.fx >= 2) return { i, row: r, rows };
        if (w === 'hit' && m.hits >= 1) return { i, row: r, rows };
        if (kind === 'passive' && r.st === 'passive' && r.fr >= (RC.passiveCell || 20)) return { i, row: r, rows }; }
      return { i: -1, rows }; };
    const pressAct = (kind) => p.evaluate(([kind, K, RC]) => { const u = units.find(x => x.key === K); u.target = units.find(x => x.key === 'vael'); u._castSM = 1; u._castLv = 1; u._idleHold = 0;
      window.__hits = []; window.__fx = []; window.__shots = []; window.__pc = [];
      if (kind === 'attack' || kind === 'melee') { u.glyphCrit = 0; u.atkCd = 0; u._armN = 0; }
      else if (kind === 'attackB') { u.glyphCrit = 0; u.atkCd = 0; u._armN = 1; }   // Kharos: the next swing is B
      else if (kind === 'crit' || kind === 'critMelee') { u.glyphCrit = 0; u._gearNextCrit = 'hit'; u.atkCd = 0; }
      else if (kind === 'passive') { u.passMul = u.passMul || 1; (new Function('u', 'K', RC.passive || ''))(u, K); }   // the config's own way to bring the passive on
      else if (kind === 'ult') { window.__ultOk = true; u.energy = 100; u._aimWX = u.target.x; u._aimWY = u.target.y; castAbility(u); }
      else { if (!u.greenAb) u.greenAb = KITS[K].green; if (!u.blueAb) u.blueAb = KITS[K].blue; castKit(u, kind === 'blue' ? u.blueAb : u.greenAb); }
      return battleTime; }, [kind, K, RC]);
    await step(1.0, H('-'));
    const res = {};
    const ACTS = MODE === 'clip' ? [] : STATES;
    for (const kind of ACTS) {
      for (let rep = 0; rep < (MODE === 'probe' ? 2 : 1); rep++) {
        await stage(CLOSE[kind] ? 50 : GAP); await step(2.5, H('-'));
        const t0 = await pressAct(kind);
        const SW = /^(attack|attackB|melee|crit|critMelee)$/.test(kind);
        const m = await moment(kind, (SW ? H(K) : H('-')) + (CLOSE[kind] ? HOLD : ''), 240);
        const C = await p.evaluate(([k, K]) => { const u = units.find(x => x.key === K); return { contact: u.anim[k].contact != null ? clipContactCell(u.anim[k]) : null, pc: window.__pc.slice(), shots: window.__shots.slice() }; }, [kind, K]);
        console.log('probe', kind, 'rep', rep, JSON.stringify({ t0: +t0.toFixed(4), frameIdx: m.i, at: m.row, contact: C.contact, pc: C.pc, shots: C.shots, head: m.rows.slice(0, 80).map(r => r[2] + ':' + r[3] + '@' + r[1]).join(' ') }));
        res[kind] = res[kind] || []; res[kind].push(m.row && (m.row.st + ':' + m.row.fr));
        if (MODE === 'stills') { await shot(K + '-' + kind + '-on-contact', { cell: m.row && m.row.fr, contact: C.contact });
          if (kind === 'attack') { const r2 = []; for (let i = 0; i < 8; i++) r2.push(await frame(H(K)));   // the ball in flight between them
            await shot(K + '-attack-from-range-wide', { distM: r2[r2.length - 1].dm }, 1.0, true); } }
        await step(3.0, H('-'));
      }
    }
    await stage(400); await step(3.0, H('-'));
    const idleCells = []; for (let i = 0; i < 90; i++) { const r = await frame(H('-')); idleCells.push(r.st + ':' + r.fr); }
    console.log('probe idle', JSON.stringify({ distinct: new Set(idleCells).size, sample: idleCells.filter((x, i) => i % 15 === 0) }));
    if (MODE === 'stills') await shot(K + '-idle');
    await stage(WALKGAP); await p.evaluate((K) => { const u = units.find(x => x.key === K); u.speed = HERO_TYPES[K].speed; const tk = units.find(x => x.key === 'askel'); if (tk && window.__backRowWalk) { u.x = u._ax = 110; u.y = u._ay = 1260; const v = units.find(x => x.key === 'vael'); v.x = v._ax = 900; v.y = v._ay = 360; tk.x = tk._ax = 700; tk.y = tk._ay = 560; }   /* the field is ~1000 wide: his 25 m hold needs the long diagonal */   /* a back-row hero never walks past his own tank: the tank stands up front */ u.target = units.find(x => x.key === 'vael'); }, K);
    const walkCells = []; let walkShot = false;
    for (let i = 0; i < 150; i++) { const r = await frame(H('-', true)); walkCells.push(r.st + ':' + r.fr + '@' + r.x);
      if (MODE === 'stills' && !walkShot && r.st === 'walk' && i > 40) { await shot(K + '-walk'); walkShot = true; } }
    console.log('probe walk', JSON.stringify({ walkFrames: walkCells.filter(x => x.startsWith('walk')).length, sample: walkCells.filter((x, i) => i % 10 === 0) }));
    const hitArm = () => p.evaluate((K) => { const v = units.find(x => x.key === 'vael'); v.target = units.find(x => x.key === K); v._gearNextCrit = 'hit'; v.atkCd = 0; const c = units.find(x => x.key === K); c.hp = c.maxHp; c._lockPri = 0; window.__hitArm = 1; }, K);
    const HH = H('vael') + "if(window.__hitArm){ const c=units.find(x=>x.key===" + JSON.stringify(K) + "); c._critHit=true; window.__hitArm=0; }";
    await stage(60); await step(1.0, H('-')); await hitArm();
    const hitCells = []; let hitShot = false;
    for (let i = 0; i < 150; i++) { const r = await frame(HH); hitCells.push(r.st + ':' + r.fr); if (MODE === 'stills' && !hitShot && r.st === 'hit' && r.fr >= 6) { await shot(K + '-hit'); hitShot = true; } }
    console.log('probe hit', JSON.stringify({ hitFrames: hitCells.filter(x => x.startsWith('hit')).length, sample: hitCells.filter((x, i) => i % 6 === 0) }));
    if (MODE === 'clip') {
      const grab = async (name, n, h, z, mid) => { fs.mkdirSync(OUT + '/' + name, { recursive: true }); await focus(z || Z, mid); const sts = [];
        for (let i = 0; i < n; i++) { const r = await frame(h); sts.push(r.st + ':' + r.fr); if (i % 2 === 0) await p.screenshot({ path: OUT + '/' + name + '/f' + String(i / 2).padStart(4, '0') + '.png' }); }
        console.log('clip', name, JSON.stringify(sts.filter((x, i) => i % 6 === 0).join(' '))); };
      await stage(400); await step(3.0, H('-')); await grab('idle', 330, H('-'));
      await stage(WALKGAP); await p.evaluate((K) => { const u = units.find(x => x.key === K); u.speed = HERO_TYPES[K].speed; const tk = units.find(x => x.key === 'askel'); if (tk && window.__backRowWalk) { u.x = u._ax = 110; u.y = u._ay = 1260; const v = units.find(x => x.key === 'vael'); v.x = v._ax = 900; v.y = v._ay = 360; tk.x = tk._ax = 700; tk.y = tk._ay = 560; }   /* the field is ~1000 wide: his 25 m hold needs the long diagonal */   /* a back-row hero never walks past his own tank: the tank stands up front */ }, K); await step(0.4, H('-', true)); await grab('walk', 160, H('-', true));
      await stage(GAP); await step(2.5, H('-')); await pressAct('attack'); await grab('attack-wide', 150, H(K), 1.0, true); await step(3.0, H('-'));
      for (const kind of STATES) { const SW = /^(attack|attackB|melee|crit|critMelee)$/.test(kind); await stage(CLOSE[kind] ? 50 : GAP); await step(2.5, H('-')); await pressAct(kind); await grab(kind, kind === 'ult' ? 200 : 150, (SW ? H(K) : H('-')) + (CLOSE[kind] ? HOLD : '')); await step(3.0, H('-')); }
      await stage(60); await step(1.0, H('-')); await hitArm(); await grab('hit', 120, HH);
    }
    console.log('summary', JSON.stringify(res));
    console.log('sound-close', JSON.stringify(await p.evaluate(async () => { try { if (typeof SND !== 'undefined' && SND && SND.ctx) { await SND.ctx.close(); return 'closed'; } } catch (e) { return e.message; } return 'no ctx'; })));
    console.log('errors', JSON.stringify(errs.slice(0, 8)));
    console.log('requests-failed', reqFail.length, JSON.stringify(reqFail.slice(0, 8)), 'http>=400', reqBad.length, JSON.stringify(reqBad.slice(0, 8)));
    await p.close();
  } finally { try { await b.close(); } catch (e) {} srv.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
