'use strict';
// v1182 - DEATH, a NEW animation type (Phil 16 Oct 2026 via ChatGPT, AI channel 17:32: "a separate death state/type, not hit or any attack/ability/passive
//   slot. Play once when dead, then remain dead/hidden; never loop, return to idle or revive"; then Phil: full size, "make the deaths 6 seconds", "do 48").
//   First four: Vael (magenta plate), Sylthaine, Vex (final 567611634823962632), Vireo (final 567612665947455488) - the Phil PASS SILENT files (96 frames):
//   every 2nd frame = 48 cells over 6.0 s (8 fps), drawn at each hero's own scale (idle figH on the death's frame-0 figure), split over sheets <= 2048 px
//   with a tight cell per sheet; lazy (loaded under 30% hp, on a phone only inside the GPU gate), released when the death ends.
// HEADLESS: sources (sha256), entries and parts, sheets (size / q95 / no plate colour / the ash ending), the same size and foot as the hero's idle
//   (CONTROL), not a skill preview, nothing in the fight reads it, whole fights tick-identical to BASE (CONTROL: the 0.9 s removal moved to 1.5 s).
// BROWSER (phone 844x390 @2x, Android UA, swiftshader, muted): lazy (nothing in the loading screen / warm-up, one request per sheet once under 30% hp),
//   the death plays ONCE (cells 0..47 in order across its sheets, 6.0 s, never loops / idles / revives; CONTROL: a looping variant fails), its sheets are
//   released when it ends, an enemy's body outlives its 0.9 s removal on screen only, a fight that ends mid-death plays it out and nothing freezes, the
//   fallback fade (no clip, not loaded yet, switch off, the phone GPU gate) is today's curve exactly, a rendered fight tick-identical with the clips on and
//   off (CONTROL: the harness sees a logic change), the phone GPU peak of the heaviest fight with all four deaths overlapping, and the hub holds nothing.
(async function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), os = require('os'), net = require('net');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '625db3e7';   // live v1195 (on v1190 streamed deaths + Batch 3), the build this change sits on
const VER = process.env.EW_DEATH_VER || '1182';
const HEROES = ['vael', 'sylthaine', 'vex', 'vireo'];   // the first four: the browser scenarios run on them
const SRCS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'death_sources.json'), 'utf8'));   // every hero with a death (tools: death_batch.py adds each batch)
const ALL = SRCS.map(r => r.key), SRC = Object.fromEntries(SRCS.map(r => [r.key, Object.assign({ dir: r.hero, sha: r.sha256, id: r.creationId, bg: r.plate }, r)]));
const GPU_BUDGET_MB = 2048, PEAK_V1182 = 1918.7;   // v1182's measured phone worst-case peak (four deaths, every sheet held) - the v1190 stretch goal, reported
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'death-base-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server')); for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
  fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE_SHA + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { baseOk = false; }
const OLD = path.join(BD, 'emberweave-heroes.html');
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = baseOk ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 700) : '')); } };
const J = s => JSON.parse(run('JSON.stringify(' + s + ')'));
// a seeded 45 s fight, headless (the server's replay path): hp / x / y / alive / energy / swing timer every tick, hashed
const FIGHT = (seed, a, f) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
  try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
    units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
    ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
    units.forEach(u=>buildFigure(u)); let deaths=0;
    const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ const al=units.filter(u=>u.alive).length; updateBattle(SIM_STEP); deaths+=Math.max(0,al-units.filter(u=>u.alive).length);
      tr.push(units.map(u=>[u.key,u.team[0],Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); }
    let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return JSON.stringify({h:s.length+':'+h.toString(16),deaths,ticks:tr.length,ended}); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
const fight = (f, s, a, e, pre) => { const r = load(f); if (pre) r(pre); return JSON.parse(r(FIGHT(s, a, e))); };
const LATE = `(()=>{ const s=String(updateBattle).replace("u.deathT>.9).forEach","u.deathT>1.5).forEach"); if(s===String(updateBattle)) return 0; updateBattle=eval('('+s+')'); return 1; })()`;   // CONTROL: the removal moved
try {
  // ------------------------------------------------------------------ 1. the page and the sources
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  ck('control file (BASE page + its own external scripts from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  { const ARCH = process.env.EW_ARCHIVE || 'C:\\Users\\Home\\OneDrive\\Desktop\\Emberweave Archive';
    const dir = h => path.join(ARCH, 'Game Art', 'Heroes', SRC[h].dir, 'clips', 'DEATH REVIEW 16OCT2026');
    if (fs.existsSync(dir('vael'))) {
      const bad = [];
      for (const h of ALL) { const S = SRC[h]; let m = null; try { m = JSON.parse(fs.readFileSync(path.join(dir(h), 'clean-source-manifest.json'), 'utf8')); } catch (e) {}
        const f = S.src ? path.join(ARCH, S.src) : path.join(dir(h), S.dir + ' - 90 death - 4 seconds SILENT Phil PASS.mp4');
        const sha = fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : 'missing';
        if (sha !== S.sha) bad.push(h + ' sha ' + sha.slice(0, 12));
        if (m && (m.sha256 !== S.sha || m.creationId !== S.id || (S.not && JSON.stringify(m).includes(S.not)) || !/Phil PASS/.test(m.status) || m.frames !== 96 || m.sourceBackground !== S.bg)) bad.push(h + ' manifest ' + JSON.stringify([m.status, m.frames, m.sourceBackground])); }
      ck('sources: every death (' + ALL.length + ') is its Phil PASS SILENT file, sha256 = the fixture (the handoff / batch manifest) and, where the folder has one, its clean-source-manifest.json (Vex 567611634823962632 / Vireo 567612665947455488 finals)', bad.length === 0, bad.join('; ')); }
    else console.log('  info the Archive is not reachable here - the source files were not re-hashed'); }

  // ------------------------------------------------------------------ 2. the entries, the parts and the sheets
  const ALLD = J(`Object.keys(BATTLE_ANIM).filter(k=>BATTLE_ANIM[k]&&BATTLE_ANIM[k].death)`);
  ck('the heroes with a death state are exactly the fixture\'s ' + ALL.length + ' (the rest are still being made): ' + ALLD.join(','), JSON.stringify(ALLD.slice().sort()) === JSON.stringify(ALL.slice().sort()));
  const D = {}, I = {}, PT = {}; ALL.forEach(k => { D[k] = J('BATTLE_ANIM.' + k + '.death'); I[k] = J('BATTLE_ANIM.' + k + '.idle'); PT[k] = D[k].parts.map(s => Object.assign({ st: s }, J('BATTLE_ANIM.' + k + '.' + s))); });
  ck('each death is 48 cells over exactly 6.0 s (8 fps), lazy, ends as its clip does (ash -> hide, a fallen body -> hold), its own states (death, death2 ..; never hit / attack / an ability / a passive)',
    ALL.every(k => D[k].dn === 48 && D[k].fps === 8 && D[k].dn / D[k].fps === 6 && D[k].end === (SRC[k].end || 'hide') && PT[k].every(p => p.lazy === true && p.fps === 8) &&
      PT[k].every(p => !['hit', 'attack', 'crit', 'green', 'blue', 'ult', 'passive'].some(s => J('(BATTLE_ANIM.' + k + '.' + s + '&&BATTLE_ANIM.' + k + '.' + s + '.u)||null') === p.u))));
  ck('the parts tile cells 0..47 in order with no gap or overlap: ' + ALL.map(k => k + ' ' + PT[k].map(p => p.first + '-' + (p.first + p.n - 1)).join('/')).join(', '),
    ALL.every(k => { let c = 0; for (const p of PT[k]) { if (p.first !== c) return false; c += p.n; } return c === 48; }));
  ck('facing: every clip carries its own source facing (the fit to the hero\'s idle; Vex faces left like her idle, flip:true)', ALL.every(k => PT[k].every(p => p.flip === SRC[k].flip)) && D.vex.flip === true);
  ck('every sheet is new: /assets/anim/<hero>/<hero>_<death|deathN>_' + VER + '.webp?v=' + VER + ' (RULE 24)', ALL.every(k => PT[k].every(p => p.u === '/assets/anim/' + k + '/' + k + '_' + p.st + '_' + (SRC[k].ver || VER) + '.webp?v=' + (SRC[k].ver || VER))));
  const PX = JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'death_1182_check.py'), ROOT, '@' + (() => { const f = path.join(BD, 'px-args.json'); fs.writeFileSync(f, JSON.stringify(ALL.map(k => ({ k, parts: PT[k], idle: I[k] })))); return f; })()], { maxBuffer: 1 << 24 }).toString());
  ck('sheets: each file is exactly its grid, <= 2048 px a side, <= 4 MB, q95 (VP8 + ALPH, v1158 recipe); decoded per hero ' + ALL.map(k => k + ' ' + PX[k].decoded_mb + ' MB').join(', '),
    ALL.every(k => PX[k].sheets.every((S, i) => { const A = PT[k][i]; return S.size[0] === A.fw * A.cols && S.size[1] === A.fh * A.rows && Math.max(...S.size) <= 2048 && S.bytes <= 4e6 && S.kind.includes('VP8 ') && S.kind.includes('ALPH'); })));
  /* v1196: a hero whose OWN art is the plate colour (Mirelle, a peacock on a green plate: 7.9% of her approved idle leans green) keeps those pixels - the
     limit is max(0.01%, 5% of his own idle's share), so plate residue stays far under what the hero himself contains */
  const leanLim = k => Math.max(0.01, 0.05 * (SRC[k].bg === 'magenta' ? PX[k].idle_magenta_pct : PX[k].idle_green_pct)), leanOf = k => SRC[k].bg === 'magenta' ? PX[k].magenta_pct : PX[k].green_pct;
  ck('no plate colour is left: the ash Hailuo drew in the plate colour is unmixed - visible pixels leaning to the hero\'s OWN plate (green or magenta) <= 0.01% (or 5% of his own idle art\'s share of that colour)',
    ALL.every(k => leanOf(k) <= leanLim(k)), ALL.map(k => k + ' ' + SRC[k].bg + ' ' + leanOf(k) + (leanLim(k) > 0.01 ? ' (limit ' + leanLim(k).toFixed(3) + ')' : '')).join(', '));
  ck('CONTROL: plate residue the size of the hero\'s own art (his idle share) fails the plate-colour check for every hero', ALL.every(k => !(Math.max(0.011, SRC[k].bg === 'magenta' ? PX[k].idle_magenta_pct : PX[k].idle_green_pct) <= leanLim(k))));
  const ASH46 = { nox: 0.25, umbris: 0.11 };   // v1196: cell 46 of these two ash clips is wide scattered specks (measured 23.6% / 10.2% of cell 0), looked at cell by cell
  ck('CONTROL: the ash allowance names only measured ash clips that need it (each over 10% and under its limit) - a hero with no entry keeps 10%', Object.keys(ASH46).every(k => SRC[k] && SRC[k].end === 'hide' && PX[k].cellpx[46] >= 0.10 * PX[k].cellpx[0] && PX[k].cellpx[46] < ASH46[k] * PX[k].cellpx[0]), JSON.stringify(Object.keys(ASH46).map(k => SRC[k] ? [k, PX[k].cellpx[46], PX[k].cellpx[0]] : [k, 'no death'])));
  ck('the ending: an ash clip (end hide) ends on an empty cell (< 2% of cell 0\'s pixels) with only drifting ash before it (cell 46 < 10%: Kharos 4%, Lumi 6% - scattered specks, seen by eye; v1196 ASH46 names the two above it, seen by eye as specks only with the body gone by cell 44-45: Nox 23.6%, Umbris 10.2%) - the body is gone; a fallen body (end hold) keeps its last cell', ALL.every(k => { const c = PX[k].cellpx; return c.length === 48 && ((SRC[k].end || 'hide') === 'hide' ? c[47] < 0.02 * c[0] && c[46] < (ASH46[k] || 0.10) * c[0] : c[47] > 0.05 * c[0]); }),
    ALL.map(k => k + ' ' + (SRC[k].end || 'hide') + ' ' + PX[k].cellpx[0] + '>' + PX[k].cellpx.slice(44).join('/')).join(', '));
  // full size: the standing figure is drawn as tall as the hero's idle cell 0, on the same foot line (the engine draws figH = sprH), every part at that one scale
  const sizeAt = (k, F) => { const d = PX[k].death_fig0, A = PT[k][0];   // Phil's approved scale: the frame-0 figure (bbox) drawn at the hero's own figH
    return { h: (d[1] - d[0]) / (A.figH * F), foot: (d[1] - A.feet) / A.figH }; };
  const vsIdle = k => { const d = PX[k].death_fig0, i = PX[k].idle_fig0, A = PT[k][0], B = I[k]; return ((d[1] - d[0]) / A.figH) / ((i[1] - i[0]) / B.figH); };
  const SZ = ALL.map(k => [k, sizeAt(k, 1)]);
  // New idle sheets use different cell resolutions. Compare their drawn figure
  // scale, while retaining exact metadata agreement for unchanged legacy art.
  ck('FULL SIZE: every death\'s frame-0 figure is drawn at the hero\'s own figH (within 3%), standing on its feet line (within 2%), every part at that one scale = the idle\'s figH (Phil\'s approved rule)',
    SZ.every(([k, s]) => Math.abs(s.h - 1) <= 0.03 && Math.abs(s.foot) <= 0.02) && ALL.every(k => PT[k].every(p => p.figH === PT[k][0].figH) && (PT[k][0].figH === I[k].figH || (['iver', 'joss', 'ambrel'].includes(k) && Math.abs(vsIdle(k) - 1) <= 0.03))),
    SZ.map(([k, s]) => k + ' x' + s.h.toFixed(3) + ' foot ' + s.foot.toFixed(3)).join(', '));
  console.log('  info frame 0 vs idle cell 0 as drawn (a different start pose differs): ' + ALL.map(k => k + ' x' + vsIdle(k).toFixed(3)).join(', '));
  ck('CONTROL: a death figH 10% off fails the size check', ALL.every(k => Math.abs(sizeAt(k, 1.1).h - 1) > 0.03));

  // ------------------------------------------------------------------ 3. display only
  const src = fs.readFileSync(HTML, 'utf8');
  const uses = [...src.matchAll(/^.*\.death\d*\b(?![_T]).*$/gm)].map(m => m[0].trim().slice(0, 70));
  ck('nothing in the fight reads a death state: every .death access is the table, deathClip, deathRelease, or the render\'s load trigger (' + uses.length + ' lines)',
    uses.every(l => /^BATTLE_ANIM\.\w+\.death\d*=|^function deathClip|^function deathRelease|^if\(DEATH_CLIPS\.on&&u\.anim\.death/.test(l)) && uses.length === ALL.reduce((s, k) => s + PT[k].length, 0) + 3, uses.join(' | '));
  const ub = run('String(updateBattle)');
  ck('updateBattle matches BASE except the death mesh hand-over and Joss approved passive display hook',
    !!R0 && (() => { const norm = x => x.replace('if(u.mesh&&!deathCorpse(u)){', 'if(u.mesh){').replace('if(u.anim&&u.anim.passive) firePassiveClip(u,clipDur(u.anim.passive)); else firePassiveFx(u);', 'firePassiveFx(u);').replace(/   \/\* v\d{4}: a body mid death clip moves to _corpses \(display\) \*\//, '').split('\r').join(''); return norm(ub) === norm(R0('String(updateBattle)')); })() && (ub.match(/death(Corpse|Draw|Clip|Preload|Release)/g) || []).length === 1);
  ck('not a skill preview: no slot of the four ever previews a death state; none is in a load tier (loading screen / warm-up) and loadAnimSet skips lazy clips',
    J(`(()=>{ const o=[]; for(const k of ${JSON.stringify(ALL)}) for(const sl of ['attack','crit',0,1,2,3]) o.push(...skillPreviewStates(k,sl)); return o.filter(s=>/^death/.test(s)); })()`).length === 0 &&
    J(`ANIM_TIERS.every(t=>!t||!t.some(s=>/^death/.test(s)))`) && /if\(set\[st\]&&set\[st\]\.lazy\)continue;/.test(run('String(loadAnimSet)')));
  { const all = J(`allAssetUrls()`).map(u => u.split('?')[0]); ck('Update all lists every death sheet (allAssetUrls)', ALL.every(k => PT[k].every(p => all.includes(p.u.split('?')[0])))); }
  const FS = [[11, HEROES, ['askel', 'korvux', 'hobb', 'oakmir']], [12, ['askel', 'korvux', 'hobb', 'oakmir'], HEROES], [15, ['absalie', 'aldren', 'ambrel', 'astra', 'aureth'], ['bloatus', 'brannus', 'askel', 'vex', 'vael']], [13, ['vael', 'vex', 'umbris'], ['sylthaine', 'vireo', 'tick']], [14, HEROES.concat(['askel']), HEROES.concat(['askel'])]];
  if (R0) {
    const rows = FS.map(([s, a, e]) => [fight(HTML, s, a, e), fight(OLD, s, a, e)]);
    ck('REPLAYS: whole seeded fights (the four as allies, as enemies, a mirror match; deaths on both sides; results, deaths, targets, wave end) are tick-for-tick live ' + BASE_SHA + ' (' + rows.map(r => r[0].deaths + ' deaths' + (r[0].ended ? ' ended' : '')).join(', ') + ')',
      rows.every(([n, o]) => n.h === o.h && n.ended === o.ended) && rows.reduce((s, r) => s + r[0].deaths, 0) >= 6, rows.map(r => r[0].h + ' vs ' + r[1].h).join('; '));
    ck('CONTROL: the same fight with the 0.9 s removal moved to 1.5 s is NOT live (the check sees the removal)', fight(HTML, FS[0][0], FS[0][1], FS[0][2], LATE).h !== rows[0][1].h);
  }

  // ------------------------------------------------------------------ 4. BROWSER
  let chromium = null; try { chromium = require('playwright').chromium; } catch (e) {}
  if (process.env.EW_NO_BROWSER) console.log('  info EW_NO_BROWSER: the browser half was skipped');
  else if (!chromium) { ck('playwright is available for the browser half', false); }
  else {
    const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-death-'));
    const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: path.join(tmp, 'db.json') }, stdio: 'ignore', windowsHide: true });
    const INIT = (fs.readFileSync(path.join(__dirname, 'test_memory_budget_1140.js'), 'utf8').match(/const INIT = `([\s\S]*?)`;/) || [])[1];   // the budget test's own GPU tally (texImage2D / mipmaps / deletes)
    let browser;
    try {
      for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {} await new Promise(r => setTimeout(r, 200)); }
      browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36' });
      await ctx.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
      if (INIT) await ctx.addInitScript(INIT);
      const pg = await ctx.newPage(); const errs = [], dreq = [];
      pg.on('pageerror', e => errs.push(String(e.message))); pg.on('request', r => { if (/_death\d*_/.test(r.url())) dreq.push(r.url().split('/').pop()); });
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
      await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await pg.waitForTimeout(1200);
      await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'dth' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
        G.tutStarted = true; G.tutDone = true; document.body.classList.remove('gated'); show('home'); try { if (SND && SND.out) SND.out.gain.value = 0; } catch (e) {} });
      await pg.waitForTimeout(600);
      await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Skip Tutorial/i.test(x.textContent) && x.offsetParent); if (b) b.click(); });
      const T = HEROES.concat(['korvux']);   // Korvux: the hero with no death clip (the fallback)
      /* v1196: Korvux has his own death since Batch 4 (and every hero gets one), so the fallback filler is Korvux with his death states taken out of this page */
      ck('the fallback filler: Korvux\'s death states are taken out of this page (' + (await pg.evaluate(() => { let n = 0; for (const st of Object.keys(BATTLE_ANIM.korvux || {})) if (/^death\d*$/.test(st)) { delete BATTLE_ANIM.korvux[st]; n++; } return n; })) + ') - he plays the old fade',
        await pg.evaluate(() => !BATTLE_ANIM.korvux.death && !deathClip({ anim: BATTLE_ANIM.korvux })));
      const start = async (seed, frozen, A, E) => { A = A || T; E = E || T;
        await pg.evaluate(([A, E, seed]) => { try { A.concat(E).forEach(k => G.unlocked[k] = true); } catch (e) {} G.team = A.slice(); CUR = { mode: 'arena', seed };
          window.requestAnimationFrame = window.__raf0 || window.requestAnimationFrame; startVersus(E.map(k => ({ key: k, level: 30 })), true, A.slice()); }, [A, E, seed]);
        for (let i = 0; i < 240; i++) { if (await pg.evaluate(() => state === 'battle' && units.length >= 10 && units.every(u => u.mesh))) break; await pg.waitForTimeout(250); }
        await pg.evaluate((frozen) => { window.__raf0 = window.__raf0 || window.requestAnimationFrame; window.requestAnimationFrame = () => 0; window.__t = performance.now(); last = window.__t;
          if (frozen) units.forEach(u => { u.greenCd = 999; u.blueCd = 999; u.energy = 0; u.maxHp = u.hp = 1e7; u.speed = 0; u.atkCd = 99; });
          const a = units.filter(u => u.team === 'ally'), e = units.filter(u => u.team === 'enemy');
          if (frozen) { a.forEach((u, i) => { u.x = u._ax = 260 + (i % 3) * 120; u.y = u._ay = 500 + i * 200; }); e.forEach((u, i) => { u.x = u._ax = 1240 + (i % 3) * 120; u.y = u._ay = 500 + i * 200; }); } }, frozen);
        await pg.waitForTimeout(frozen ? 12000 : 9000); };   // the fight's own sheets load
      const HOLD = `units.forEach(u=>{ if(u.alive){ u.greenCd=999; u.blueCd=999; u.energy=0; u.atkCd=Math.max(u.atkCd||0,9); u.speed=0; } });`;
      // the cell DRAWN: which death sheet is on the sprite, and its cell from the UV window, + that sheet's first cell
      const frame = () => pg.evaluate((H) => { window.__t += 1000 / 60; loop(window.__t); eval(H); const u = window.__dying; if (!u) return null;
        const s = u.sprite, set = u.anim || BATTLE_ANIM[u.key], A = set && set.death, v = s && s._uv; let cell = null, P = null;
        if (A && A.parts) for (const st of A.parts) { const c = set[st]; if (c && c.tex && s && s.material.map === c.tex) P = c; }
        if (v && P) { const c = P._lay ? P._lay.c : P.cols, r = P._lay ? P._lay.r : P.rows, x0 = Math.min(v[2], v[2] + v[0]); cell = (P.first || 0) + Math.round(r * (1 - v[3]) - 1) * c + Math.round(x0 * c - 0.0001 * c); }
        const full = P ? (P.tex.image.width === P.fw * P.cols && P.tex.image.height === P.fh * P.rows) : null, st = u._die ? +(u._die.st || 0).toFixed(4) : 0;
        return { cell, full, st, mirror: v ? v[0] < 0 : null, op: s ? +s.material.opacity.toFixed(4) : null, dT: +(u.deathT || 0).toFixed(4), alive: u.alive, inUnits: units.includes(u), corpse: _corpses.includes(u), inScene: !!(u.mesh && u.mesh.parent),
          mapDeath: !!P, idle: !!(set && set.idle && set.idle.tex && s.material.map === set.idle.tex), held: A && A.parts ? A.parts.filter(st => set[st] && set[st].tex).length : 0 }; }, HOLD);
      const pick = (k, team) => pg.evaluate(([k, team]) => { const u = units.find(x => x.key === k && x.team === team && x.alive); window.__dying = u; u._faceDir = team === 'ally' ? 1 : -1; u.target = units.find(x => x.team !== team && x.alive); return !!u; }, [k, team]);
      const kill = () => pg.evaluate(() => { const u = window.__dying; damage(u, u.maxHp * 100, 0xffffff, true); return u.alive; });
      const ready = k => pg.evaluate(k => deathReady({ anim: BATTLE_ANIM[k] }), k);
      const lowAndWait = async (k, team) => { await pick(k, team); await pg.evaluate(() => { window.__dying.hp = window.__dying.maxHp * 0.2; });
        for (let i = 0; i < 200; i++) { await frame(); if (await ready(k)) break; await pg.waitForTimeout(50); } for (let i = 0; i < 10; i++) await frame(); };
      const watch = async (n) => { const rows = []; for (let i = 0; i < n; i++) rows.push(await frame()); return rows; };
      const SECS = 6.0;
      const once = rows => { const d = rows.filter(r => r.cell != null), c = d.map(r => r.cell); let mono = true; for (let i = 1; i < c.length; i++) if (c[i] < c[i - 1]) mono = false;
        const last = rows.map(r => r.cell != null && r.op > 0).lastIndexOf(true);
        return { mono, distinct: new Set(c).size, first: c[0], lastCell: c[c.length - 1], sec: (last + 1) / 60, hiddenAfter: rows.slice(last + 1).length >= 60 && rows.slice(last + 1).every(r => r.op === 0 || !r.inScene),
          neverIdle: rows.slice(0, last + 1).every(r => r.mapDeath && !r.idle), neverAlive: rows.every(r => !r.alive), releasedAfter: rows.slice(last + 2).every(r => r.held === 0) };
      };
      const okOnce = o => o.mono && o.distinct === 48 && o.first === 0 && o.lastCell === 47 && Math.abs(o.sec - SECS) <= 2 / 60 && o.hiddenAfter && o.neverIdle && o.neverAlive;
      /* v1190 STREAMING: while a death plays it holds at most two of its sheets (+ the first, kept for another body of the same hero still waiting
         under 30% hp), every sheet it draws is decoded at full size, and none arrived late (no hold, so 6.0 s exactly) */
      const streamed = (rows, extra) => { const d = rows.filter(r => r.cell != null); return { maxHeld: Math.max(...d.map(r => r.held)), full: d.every(r => r.full === true), stall: Math.max(...d.map(r => r.st)), extra }; };
      const okStream = s => s.maxHeld <= 2 + (s.extra || 0) && s.full && s.stall === 0;
      const fade = rows => rows.slice(0, 60).every(r => Math.abs(r.op - Math.max(0, 1 - r.dT / 0.9)) < 2e-3);
      const LONG = Math.round(60 * (SECS + 1.5));

      await start(7, true);
      ck('lazy: no death sheet was requested by the loading screen, the tiered preload or the GPU warm-up, and none is resident before anyone is hurt', dreq.length === 0 &&
        (await pg.evaluate((H) => H.every(k => BATTLE_ANIM[k].death.parts.every(st => !BATTLE_ANIM[k][st].tex)), HEROES)), dreq.join(','));
      // both Vaels (ally + enemy, one key) under 30% hp: each of his sheets requested ONCE
      await pg.evaluate(() => { units.filter(u => u.key === 'vael').forEach(u => { u.hp = u.maxHp * 0.25; }); units.filter(u => u.key === 'vex' && u.team === 'ally').forEach(u => { u.hp = u.maxHp * 0.31; }); });
      for (let i = 0; i < 200; i++) { await frame(); if (await ready('vael')) break; await pg.waitForTimeout(50); }
      for (let i = 0; i < 20; i++) await frame();
      ck('lazy + STREAMED: under 30% hp each of the ' + D.vael.parts.length + ' death sheets is requested once for one key however many units (two Vaels) - only the FIRST is decoded and on the GPU, the rest are bytes in the browser cache; nothing for a hero at 31%',
        dreq.length === D.vael.parts.length && D.vael.parts.every(st => dreq.filter(x => x.startsWith('vael_' + st + '_')).length === 1) &&
        (await pg.evaluate(() => BATTLE_ANIM.vael.death.parts.map(st => !!BATTLE_ANIM.vael[st].tex).join(''))) === 'true' + 'false'.repeat(D.vael.parts.length - 1), dreq.join(','));
      ck('the first sheet is decoded at its own full size on the phone tier (' + (await pg.evaluate(() => { const im = BATTLE_ANIM.vael.death.tex.image; return im.width + 'x' + im.height; })) + ')',
        await pg.evaluate(() => { const A = BATTLE_ANIM.vael.death, im = A.tex.image; return texPhone() && im.width === A.fw * A.cols && im.height === A.fh * A.rows; }));
      // ALLY Vael (facing right) dies - the enemy Vael is still alive at 25%, so his sheets stay until HE is done too
      await pick('vael', 'ally'); await kill(); const ra = await watch(LONG); const oa = once(ra);
      ck('the death plays ONCE: cells 0..47 in order across its sheets, all 48, ' + oa.sec.toFixed(3) + ' s (6.0 s at game speed 1), then hidden; never loops, never an idle cell, never alive again (ally Vael)', okOnce(oa), JSON.stringify(oa));
      ck('a dead ALLY stays in the fight as before (units), drawn by its own clip, never the fade', ra.every(r => r.inUnits) && !fade(ra));
      { const sa = streamed(ra, 1);
        ck('STREAMED (ally Vael): while it plays at most ' + sa.maxHeld + ' of his ' + D.vael.parts.length + ' sheets are on the GPU (the one shown + the next, + the first kept for the other Vael waiting at 25%), every sheet drawn at full size, none late', okStream(sa), JSON.stringify(sa)); }
      ck('released when the death ends: only the first sheet stays, for the other Vael still waiting under 30% hp', ra.slice(Math.round(60 * SECS) + 3).every(r => r.held === 1), JSON.stringify(ra.slice(-3).map(r => r.held)));
      // CONTROL: a looping variant fails the same check
      await pg.evaluate(() => { window.__dd0 = deathDraw; deathDraw = eval('(' + String(deathDraw).replace('let t=Math.min(dur,D.t+dt)', 'let t=(D.t+dt)%dur').replace("const fin=D.t>=dur;", "const fin=false;") + ')'); });
      await lowAndWait('sylthaine', 'ally'); await kill(); const oc = once(await watch(LONG));
      await pg.evaluate(() => { deathDraw = window.__dd0; });
      ck('CONTROL: a death that loops (cell = t x fps mod 48, never ends) FAILS the plays-once check', !okOnce(oc), JSON.stringify(oc));
      // ENEMY Vex (facing left): the fight removes her at 0.9 s; her body stays on screen for the clip, then is disposed, and her sheets released
      await lowAndWait('vex', 'enemy'); await kill(); const re = await watch(LONG); const oe = once(re);
      const left = re.findIndex(r => !r.inUnits), gone = re.findIndex(r => !r.inScene);
      ck('facing: ally Vael (facing right, source right) draws unmirrored; enemy Vex (facing left, her source faces left) unmirrored too - the engine\'s own rule mirror = (facing right) != (source right)',
        ra.filter(r => r.cell != null).every(r => r.mirror === false) && re.filter(r => r.cell != null).every(r => r.mirror === false));
      ck('an ENEMY plays it too (Vex, facing left) ' + oe.sec.toFixed(3) + ' s, once, and her sheets are released right after (no other Vex is dying)', okOnce(oe) && oe.releasedAfter, JSON.stringify(oe));
      { const se = streamed(re, 0); ck('STREAMED (enemy Vex, the only Vex under 30%): at most ' + se.maxHeld + ' sheets on the GPU at any frame (the one shown + the next), all full size, none late', okStream(se) && se.maxHeld === 2, JSON.stringify(se)); }
      ck('the fight removes the enemy exactly as before, on the tick its deathT (battle time) passes 0.9 (render frame ' + left + '); only its mesh stays (_corpses) until the clip ends, then it leaves the scene (frame ' + gone + ') and _corpses is empty',
        left > 0 && re[left - 1].dT <= 0.9 && re[left].dT > 0.9 && re.slice(left, gone).every(r => r.corpse && r.inScene) && Math.abs(gone - 60 * SECS) <= 4 && !re[re.length - 1].corpse, JSON.stringify({ left, gone, dT: [re[left - 1] && re[left - 1].dT, re[left] && re[left].dT] }));
      // FALLBACK 1: a hero with no death clip (Askel)
      await pick('korvux', 'ally'); await kill(); const rk = await watch(80);
      ck('FALLBACK: a hero without a death clip (Korvux) fades exactly as before (opacity = 1 - deathT/0.9 every frame)', fade(rk) && rk.every(r => r.cell == null), JSON.stringify(rk.slice(0, 4)));
      // FALLBACK 2: Vireo dies at FULL hp (her sheets never asked for) -> the fade, and it never pops in mid-fade
      await pick('vireo', 'ally'); await kill(); const rv = await watch(80);
      ck('FALLBACK: a death-clip hero killed before her sheets arrived (Vireo, one blow from full hp) fades as before and the clip never pops in', fade(rv) && rv.every(r => r.cell == null) && !dreq.some(x => /vireo_death/.test(x)), JSON.stringify(rv.slice(0, 3)));
      // FALLBACK 3: the switch off (enemy Vael, his sheets loaded)
      await pg.evaluate(() => { DEATH_CLIPS.on = false; }); await pick('vael', 'enemy'); await kill(); const rs = await watch(80); await pg.evaluate(() => { DEATH_CLIPS.on = true; });
      ck('FALLBACK: with DEATH_CLIPS off a hero whose sheets ARE loaded (enemy Vael) fades exactly as before', fade(rs) && rs.every(r => r.cell == null));
      // FALLBACK 4: the phone GPU gate (the tally + the sheets past gpuMB -> no request, the fade)
      const n0 = dreq.length;
      await pg.evaluate(() => { DEATH_CLIPS.gpuMB = texTallyMB() + 1; const v = units.find(u => u.alive && u.key === 'vireo'); v.hp = v.maxHp * 0.2; window.__dying = v; BATTLE_ANIM.vireo.death._gateAt = 0; });
      for (let i = 0; i < 40; i++) await frame(); await pg.waitForTimeout(800); for (let i = 0; i < 10; i++) await frame();
      await kill(); const rq = await watch(80); const gated = await pg.evaluate(() => BATTLE_ANIM.vireo.death._gated || 0);
      ck('FALLBACK: the phone GPU gate - with the tally + Vireo\'s sheets over DEATH_CLIPS.gpuMB she requests nothing and fades as before (live gate 1990 of 2048 MB)', gated > 0 && dreq.length === n0 && fade(rq) && rq.every(r => r.cell == null), dreq.slice(n0).join(',') + ' gated ' + gated);
      await pg.evaluate(() => { DEATH_CLIPS.gpuMB = 1990; });
      // a FIGHT THAT ENDS mid-death: the body plays out on the result screen (no frozen half-dead body), then the sheets go
      await lowAndWait('sylthaine', 'enemy'); await kill(); const rf1 = await watch(90);
      await pg.evaluate(() => { endBattle(true); }); const rf2 = await watch(LONG); const of = once(rf1.concat(rf2));
      ck('a fight that ENDS mid-death (2 s in): the death plays on to its last cell behind the result screen and is hidden - no frozen half-dead body - then its sheets are released', okOnce(of) && of.releasedAfter && rf2.slice(-30).every(r => r.op === 0 || !r.inScene), JSON.stringify(of));
      await pg.evaluate(() => { window.requestAnimationFrame = window.__raf0; requestAnimationFrame(loop); }); await pg.waitForTimeout(1200);
      await pg.evaluate(() => { try { document.getElementById('resultBtn').click(); } catch (e) {} }); await pg.waitForTimeout(800);
      await pg.evaluate(() => show('home')); await pg.waitForTimeout(2500);
      const heldAll = () => pg.evaluate((H) => H.reduce((s, k) => s + BATTLE_ANIM[k].death.parts.filter(st => BATTLE_ANIM[k][st].tex).length, 0), HEROES);
      const hub = { held: await heldAll(), corpses: await pg.evaluate(() => _corpses.length) };
      ck('back on the hub no death sheet is held and _corpses is empty', hub.held === 0 && hub.corpses === 0, JSON.stringify(hub));

      // a WAVE that turns mid-death: the body fades in 0.25 s and ends cleanly (sheets released), never left on the field
      await start(9, true);
      await lowAndWait('vireo', 'ally'); await kill(); const rw1 = await watch(60);
      await pg.evaluate(() => { waveXfer = { phase: 'exit', t: 0 }; }); const rw2 = await watch(40); await pg.evaluate(() => { waveXfer = null; }); const rw3 = await watch(30);
      ck('a WAVE transfer mid-death: the body fades out over 0.25 s and ends there (hidden, sheets released) - never frozen half-dead, never walked through', rw1.every(r => r.cell != null && r.op === 1) &&
        rw2.slice(16).every(r => r.op === 0) && rw2.some(r => r.op > 0 && r.op < 1) && rw3.every(r => r.op === 0 && r.held === 0), JSON.stringify(rw2.slice(0, 18).map(r => r.op)));
      // v1190 a LATE SHEET: Sylthaine's third sheet answers 2.5 s late (a slow phone / network) - the death holds the last cell shown (the end of her second
      // sheet) for as long as it takes, then plays on: all 48 cells in order, never idle, never skipped; the rest of the fight is untouched (display only)
      { const S3 = PT.sylthaine[2].u.split('?')[0].split('/').pop(), last2 = PT.sylthaine[1].first + PT.sylthaine[1].n - 1;
        const parked = []; await pg.route('**/' + S3 + '*', r => { parked.push(r); });   /* its requests wait until 1.5 s of the death after the sheet was due */
        await lowAndWait('sylthaine', 'ally'); await kill(); const rl1 = await watch(Math.round(60 * PT.sylthaine[2].first / 8) + 90);
        for (const r of parked) { try { await r.continue(); } catch (e) {} } await pg.unroute('**/' + S3 + '*');
        const rl = rl1.concat(await watch(Math.round(60 * (SECS + 1.5))));
        const ol = once(rl), sl = streamed(rl, 0), heldRows = rl.filter((r, i) => i > 0 && r.st > rl[i - 1].st);
        ck('a LATE sheet (Sylthaine\'s 3rd, held back 1.5 s past its turn): the death holds cell ' + last2 + ' (the last of her 2nd sheet) while it waits (' + heldRows.length + ' frames), then plays on - all 48 cells in order, ' + ol.sec.toFixed(2) + ' s, never idle, never alive, at most 2 sheets',
          ol.mono && ol.distinct === 48 && ol.first === 0 && ol.lastCell === 47 && ol.neverIdle && ol.neverAlive && ol.hiddenAfter && heldRows.length > 10 && heldRows.every(r => r.cell === last2 && r.op === 1) && sl.maxHeld <= 2 && sl.stall > 0 && sl.stall < 3,
          JSON.stringify({ ol, sl, held: heldRows.length })); }
      // a death that ENDS ON THE BODY (end:'hold' - Ambrel, Askel, Grosk ..): an enemy's body stays drawn on its last cell after the 6 s (in _corpses, its sheets
      // kept), and leaving the fight for the hub clears it - no corpse and no death sheet outlives the fight (Vex's clip set to hold for this check)
      await pg.evaluate(() => { BATTLE_ANIM.vex.death.end = 'hold'; });
      await lowAndWait('vex', 'enemy'); await kill(); const rh = await watch(Math.round(60 * (SECS + 1.5)));
      const hEnd = rh.slice(Math.round(60 * SECS) + 6);
      await pg.evaluate(() => { window.requestAnimationFrame = window.__raf0; requestAnimationFrame(loop); endBattle(true); }); await pg.waitForTimeout(1200);
      await pg.evaluate(() => { try { document.getElementById('resultBtn').click(); } catch (e) {} }); await pg.waitForTimeout(800);
      await pg.evaluate(() => show('home')); await pg.waitForTimeout(2500);
      const hHub = await pg.evaluate(() => ({ corpses: _corpses.length, held: BATTLE_ANIM.vex.death.parts.filter(st => BATTLE_ANIM.vex[st].tex).length }));
      await pg.evaluate(() => { BATTLE_ANIM.vex.death.end = 'hide'; });
      ck('end:hold - after its 6 s the enemy body stays on its last cell (drawn, in _corpses, sheets kept), never loops; going to the hub clears it (no corpse, no death sheet)',
        hEnd.length > 30 && hEnd.every(r => r.cell === 47 && r.op === 1 && r.corpse && r.inScene && r.held === 1) && hHub.corpses === 0 && hHub.held === 0, JSON.stringify({ last: hEnd.slice(-1), hHub }));
      /* v1190: a held body keeps ONLY its last sheet (it was all of them) */
      ck('STREAMED end:hold - the held body keeps one sheet (its last), not all ' + D.vex.parts.length, hEnd.every(r => r.held === 1) && streamed(rh, 0).maxHeld <= 2);

      // RENDERED fights: clips on (sheets loaded up front so they play) vs off - the fight underneath is the same tick for tick
      /* one battle scene; each run clears it (clearBattle) and rebuilds the fight from tick 0 (seedBattle: RNG, accumulator, inputs, unit ids), then
         renders one 60 fps frame at a time (syncMesh, deathDraw, _corpses, deathRelease all run) inside ONE synchronous evaluate, so no real-time timer of the
         page can interleave with the synthetic clock. The trace is per SIM TICK (after every updateBattle), the unit of "tick-identical": the client loop
         has wall-clock gates of its own (the action stream, the net gate) that can move which render frame a tick falls on, never what the tick computes. */
      await start(21, true);
      await pg.evaluate(() => { window.__upd0 = updateBattle; });
      const loadAll = async () => { await pg.evaluate((H) => H.forEach(k => BATTLE_ANIM[k].death.parts.forEach(st => { if (!BATTLE_ANIM[k][st].tex) _loadClip(BATTLE_ANIM[k][st]); })), HEROES);
        for (let i = 0; i < 100; i++) { if (await pg.evaluate((H) => H.every(k => deathReady({ anim: BATTLE_ANIM[k] })), HEROES)) break; await pg.waitForTimeout(100); } };
      const TRACE = async (seed, on, pre) => { if (on) await loadAll(); return pg.evaluate(([T, seed, on, pre]) => { updateBattle = window.__upd0; if (pre) eval(pre); DEATH_CLIPS.on = on;
        clearBattle(); ended = false; paused = false; waveXfer = null; battleTime = 0; gameSpeed = 1; seedBattle(seed); last = window.__t;   /* the first frame's dt is 1/60 too */
        ultCoachArmed = () => false; ultCoachReset(); actHold = () => false; _actWait = 0;   /* the first-fight ult lesson and the action-stream ack wait are wall-clock gates, not part of this check */
        T.forEach((k, i) => units.push(makeUnit(k, 'ally', 300 + i * 40, 600 + i * 90, 30, { owned: false, rank: 3 }))); T.forEach((k, i) => units.push(makeUnit(k, 'enemy', 900 + i * 40, 600 + i * 90, 30, { owned: false, rank: 3 })));
        units.forEach(u => buildFigure(u));
        const tr = []; let clips = 0; const seen = new Set(); const U = updateBattle;
        updateBattle = function () { const r = U.apply(this, arguments);
          tr.push(battleTime.toFixed(3) + '/' + units.map(u => u.key + u.team[0] + ':' + Math.round(u.hp * 100) + ':' + Math.round(u.x * 10) + ':' + Math.round(u.y * 10) + ':' + (u.alive ? 1 : 0) + ':' + Math.round((u.energy || 0) * 10)).join('|')); return r; };
        for (let j = 0; j < 60 * 60 && !ended && tr.length < 900; j++) { window.__t += 1000 / 60; loop(window.__t); units.concat(_corpses).forEach(u => { if (u._die && !seen.has(u)) { seen.add(u); clips++; } }); }
        tr.length = Math.min(tr.length, 900);
        let h = 2166136261 >>> 0; const s = tr.join('#'); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        DEATH_CLIPS.on = true; updateBattle = window.__upd0; return { h: tr.length + ':' + h.toString(16), clips, n: tr.length, tr }; }, [T, seed, on, pre || '']); };
      const firstDiff = (a, b) => { const i = a.tr.findIndex((x, j) => x !== b.tr[j]); if (i < 0) return 'none'; const A = a.tr[i].split('|'), B = (b.tr[i] || '').split('|');
        return 'tick ' + i + ': ' + A.map((x, j) => x !== B[j] ? x + ' vs ' + B[j] : null).filter(Boolean).slice(0, 3).join('; '); };
      const tOn = await TRACE(21, true), tOn2 = await TRACE(21, true), tOff = await TRACE(21, false);
      ck('CONTROL: the rendered harness is deterministic (the same seed with clips on twice gives the same trace)', tOn.h === tOn2.h, tOn.h + ' vs ' + tOn2.h + ' first diff ' + firstDiff(tOn, tOn2));
      ck('a rendered seeded fight with death clips ON (' + tOn.clips + ' bodies played their clip) is tick-identical to the same fight with them OFF (hp / x / y / alive / energy after every one of ' + tOn.n + ' sim ticks)', tOn.h === tOff.h && tOn.clips >= 1, tOn.h + ' vs ' + tOff.h + ' ' + firstDiff(tOn, tOff));
      const tLate = await TRACE(21, true, LATE);
      ck('CONTROL: the same rendered harness sees a logic change (the removal at 1.5 s) - non-death control', tLate.h !== tOn.h);
      await pg.evaluate(() => { try { endBattle(true); } catch (e) {} }); await pg.waitForTimeout(600);

      // PHONE GPU PEAK: the heaviest fight that holds all four (the four + Askel vs the five heaviest others), every unit's art loaded, all four deaths at once
      if (INIT) {
        const HEAVY = ['rivet', 'hollow', 'aureth', 'rafe', 'tharl'];
        /* from the hub, as a player comes to a fight: the last fight's art (and the death sheets the trace runs preloaded) is freed there first */
        await pg.evaluate(() => { window.requestAnimationFrame = window.__raf0; requestAnimationFrame(loop); }); await pg.waitForTimeout(1200);
        await pg.evaluate(() => { try { document.getElementById('resultBtn').click(); } catch (e) {} }); await pg.waitForTimeout(800);
        await pg.evaluate(() => show('home')); await pg.waitForTimeout(2500);
        const hubMB = await pg.evaluate(() => +__gpuMB().toFixed(1));
        await start(31, true, HEROES.concat(['kharos']), HEAVY);
        const base0 = await pg.evaluate(() => +__gpuMB().toFixed(1));
        await pg.evaluate((H) => { H.forEach(k => { const u = units.find(x => x.key === k); u.hp = u.maxHp * 0.2; BATTLE_ANIM[k].death._gateAt = 0; }); }, HEROES);
        for (let i = 0; i < 300; i++) { await pg.evaluate(() => { window.__t += 1000 / 60; loop(window.__t); });
          if (await pg.evaluate((H) => H.every(k => deathReady({ anim: BATTLE_ANIM[k] })), HEROES)) break; await pg.waitForTimeout(50); }
        const loaded = await pg.evaluate((H) => H.filter(k => deathReady({ anim: BATTLE_ANIM[k] })), HEROES);
        for (let i = 0; i < 20; i++) await pg.evaluate(() => { window.__t += 1000 / 60; loop(window.__t); });
        const preDeath = await pg.evaluate(() => +__gpuMB().toFixed(1));
        await pg.evaluate((H) => { H.forEach(k => { const u = units.find(x => x.key === k); damage(u, u.maxHp * 100, 0xffffff, true); }); }, HEROES);
        let peak = preDeath, played = 0;
        for (let i = 0; i < 60 * 7; i++) { const r = await pg.evaluate(() => { window.__t += 1000 / 60; loop(window.__t); return { g: __gpuMB(), p: units.filter(u => u._die).length }; }); peak = Math.max(peak, r.g); played = Math.max(played, r.p); }
        const after = await pg.evaluate(() => +__gpuMB().toFixed(1));
        console.log('  info PHONE GPU (four + Kharos vs Rivet, Hollow, Aureth, Rafe, Tharl): hub ' + hubMB + ' MB, fight art ' + base0 + ' MB, four death sets loaded ' + preDeath + ' MB (+' + (preDeath - base0).toFixed(1) + '), peak with all four dying ' + peak.toFixed(1) + ' MB, after the deaths ' + after + ' MB');
        ck('PHONE BUDGET: the heaviest fight holding all four, every death loaded and all four dying at once (' + played + ' clips), peaks at ' + peak.toFixed(1) + ' MB <= ' + GPU_BUDGET_MB + ' MB, and the deaths give their memory back when they end (' + after + ' MB)',
          peak <= GPU_BUDGET_MB && loaded.length === 4 && played === 4 && after <= base0 + 8, JSON.stringify({ base0, preDeath, peak, after, loaded }));
        await pg.evaluate(() => { try { endBattle(true); } catch (e) {} });
        // THE WORST CASE: the ten heaviest heroes on the phone (test_memory_budget_1140's own sum, every clip incl. the lazy deaths) in one fight, every
        // one of them that has a death under 30% hp, then all killed at once - the deaths overlap; the live gate may refuse some (they fade), never the budget
        const TOP = await pg.evaluate(() => { const per = {}, dp = {};   /* test_memory_budget_1140's sum: a streamed death counts its heaviest two neighbouring sheets */
          for (const k in BATTLE_ANIM) { if (!HERO_TYPES[k] || HERO_TYPES[k].monster) continue; for (const st in BATTLE_ANIM[k]) { const c = BATTLE_ANIM[k][st]; if (st[0] === '_' || !c || !c.u || !c.fw) continue;
            window.__texPhone = 1; const kk = texSheetK(c.fw, c.fh, c.cols || c.n, c.rows || 1, (c.figH && c.fh) ? c.figH / c.fh : 0); window.__texPhone = null;
            const m = Math.round(c.fw * kk) * (c.cols || c.n) * Math.round(c.fh * kk) * (c.rows || 1) * 4 * 4 / 3 / 1048576;
            if (/^death\d*$/.test(st)) { (dp[k] = dp[k] || [])[st === 'death' ? 0 : +st.slice(5) - 1] = m; continue; }
            per[k] = (per[k] || 0) + m; } }
          for (const k in dp) { const a = dp[k]; let m = a[0] || 0; for (let i = 0; i + 1 < a.length; i++) m = Math.max(m, (a[i] || 0) + (a[i + 1] || 0)); per[k] = (per[k] || 0) + m; }
          return Object.keys(per).sort((a, b) => per[b] - per[a]).slice(0, 10); }).then(t => process.env.EW_WORST ? process.env.EW_WORST.split(',') : t);   /* EW_WORST=k1,..,k10: measure another ten */
        await pg.evaluate(() => { window.requestAnimationFrame = window.__raf0; requestAnimationFrame(loop); }); await pg.waitForTimeout(1200);
        await pg.evaluate(() => { try { document.getElementById('resultBtn').click(); } catch (e) {} }); await pg.waitForTimeout(800);
        await pg.evaluate(() => show('home')); await pg.waitForTimeout(2500);
        await start(41, true, TOP.slice(0, 5), TOP.slice(5, 10));
        const w0 = await pg.evaluate(() => +__gpuMB().toFixed(1));
        const WD = await pg.evaluate(() => { const d = units.filter(u => u.anim && u.anim.death && u.anim.death.parts); d.forEach(u => { u.hp = u.maxHp * 0.2; u.anim.death._gateAt = 0; }); return d.map(u => u.key); });
        for (let i = 0; i < 300; i++) { await pg.evaluate(() => { window.__t += 1000 / 60; loop(window.__t); });
          if (await pg.evaluate((K) => K.every(k => deathReady({ anim: BATTLE_ANIM[k] }) || (BATTLE_ANIM[k].death._gated || 0) > 0), WD)) break; await pg.waitForTimeout(80); }
        for (let i = 0; i < 20; i++) await pg.evaluate(() => { window.__t += 1000 / 60; loop(window.__t); });
        const wLoaded = await pg.evaluate(() => +__gpuMB().toFixed(1)), wReady = await pg.evaluate((K) => K.filter(k => deathReady({ anim: BATTLE_ANIM[k] })), WD);
        await pg.evaluate(() => { units.filter(u => u.anim && u.anim.death && u.anim.death.parts).forEach(u => damage(u, u.maxHp * 100, 0xffffff, true)); });
        let wPeak = wLoaded, wPlayed = 0;
        for (let i = 0; i < 60 * 7; i++) { const r = await pg.evaluate(() => { window.__t += 1000 / 60; loop(window.__t); return { g: __gpuMB(), p: units.concat(_corpses).filter(u => u._die).length }; }); wPeak = Math.max(wPeak, r.g); wPlayed = Math.max(wPlayed, r.p); }
        const wAfter = await pg.evaluate(() => +__gpuMB().toFixed(1));
        console.log('  info PHONE WORST CASE (the ten heaviest: ' + TOP.join(', ') + '; with a death: ' + WD.join(', ') + '): fight art ' + w0 + ' MB, deaths loaded ' + wLoaded + ' MB (' + wReady.length + ' of ' + WD.length + ' inside the gate), all dying at once peak ' + wPeak.toFixed(1) + ' MB (' + wPlayed + ' clips), after ' + wAfter + ' MB');
        ck('PHONE BUDGET, worst case: the ten heaviest heroes in one fight, every death among them overlapping, peaks at ' + wPeak.toFixed(1) + ' MB <= ' + GPU_BUDGET_MB + ' MB (' + wPlayed + ' of ' + WD.length + ' played their clip, the rest faded at the gate)',
          wPeak <= GPU_BUDGET_MB && wPlayed === wReady.length && WD.length >= 1, JSON.stringify({ w0, wLoaded, wPeak, wAfter, wReady, WD }));
        /* v1190 STREAMING (the coordinator, 17 Oct): with every death in, the worst case stays under the live gate (1990 MB), every death among the ten plays
           its clip (none faded at the gate), the deaths themselves cost <= 12 MB each at the peak (streamed: measured ~7; v1188's whole sheets ~36), and the
           gate's tally IS the real GPU total. v1182's measured peak (1918.7 MB) was the stretch goal - reported, not a gate (the fight art itself grows with
           new spell FX: v1186's Kharos FX alone +30.6 MB) */
        const gateVsGl = await pg.evaluate(() => [+texTallyMB().toFixed(1), +__gpuMB().toFixed(1), _glTally.on]);
        console.log('  info vs v1182\'s measured peak ' + PEAK_V1182 + ' MB: ' + (wPeak - PEAK_V1182 >= 0 ? '+' : '') + (wPeak - PEAK_V1182).toFixed(1) + ' MB; the deaths add ' + (wPeak - w0).toFixed(1) + ' MB over the fight art (' + WD.length + ' at once)');
        ck('STREAMED worst case: peak ' + wPeak.toFixed(1) + ' MB <= the live gate 1990 MB with ' + ALL.length + ' deaths in, all ' + WD.length + ' deaths among the ten played (' + wPlayed + '), none gated, the deaths adding ' + (wPeak - w0).toFixed(1) + ' MB (<= 12 per death)',
          wPeak <= 1990 && wPlayed === WD.length && wReady.length === WD.length && wPeak - w0 <= 12 * WD.length, JSON.stringify({ w0, wPeak, wPlayed, WD }));
        ck('the gate counts the REAL GPU total: texTallyMB() ' + gateVsGl[0] + ' MB = the WebGL tally ' + gateVsGl[1] + ' MB (within 1 MB; it counted only the battle sheets before)', gateVsGl[2] === true && Math.abs(gateVsGl[0] - gateVsGl[1]) <= 1, JSON.stringify(gateVsGl));
        await pg.evaluate(() => { try { endBattle(true); } catch (e) {} });
      } else ck('the budget test\'s GPU tally was found', false);
      ck('no page error', errs.length === 0, errs.slice(0, 4).join(' | '));
      await ctx.close();
    } finally { try { await browser.close(); } catch (e) {} try { srv.kill(); } catch (e) {} }
  }
} catch (e) { console.log('  FAIL test crashed - ' + (e && e.stack || e)); fail++; }
console.log((fail ? 'FAIL ' : 'PASS ') + (pass + fail) + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
})();
