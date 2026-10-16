'use strict';

/* v1165: the ability files were re-rendered ON PURPOSE (ride out + sparkle, Phil 16 Oct; tests/test_sparkle_tails_1165.js checks them: same peak within
   10 ms, same loudness within 0.5 LU) - they (and the new fused melee swings) are left out; every other entry is compared exactly */
function sfxFilesV1165(r, cur) { const o = JSON.parse(r('JSON.stringify(SFX_DATA.files)')), c = JSON.parse(cur('JSON.stringify(SFX_DATA.files)'));
  return JSON.stringify(Object.keys(o).sort().filter(n => !(c[n] && /\?v=1165$/.test(c[n][0]))).map(n => [n, o[n]])); }   // v1165 files (re-rendered or new fused swings) left out on both sides
// v1162 - Korvux's eight new animations (Phil PASS 16 Oct 2026 "all pass", ChatGPT "send to claude" 00:18, REVIEW 15OCT2026 H3,
//   clean-source-manifest.json - all eight "Phil PASS", official Hailuo Without Watermark exports, sha256 matched): IDLE, WALK (natural steps
//   in place), ATTACK, CRIT (his first crit clip), HIT, GREEN Comet Dash, BLUE Ember Cleave, ULT Falling Star. NO passive animation (Phil).
// TWO REFERENCES, ONE SIZE: idle / walk / hit / green were filmed on the wide reference, attack / crit / blue / ult on a smaller one with extra
//   headroom (x0.698-0.700, measured). Every state is drawn at the same size on the same spot: checked on the sheets' own pixels as the engine
//   draws them (figH-normalised, cx/feet on one point) against idle - with a CONTROL that assumes the framings match (it fails by ~30%).
// EMBER CLEAVE: its Phil-approved crescent (same file, same artwork, same gameplay) is re-synced to the NEW blue clip's measured axe head and
//   contact frame: the fit (as painted - the new swing runs the crescent's own way) puts the tip on the axe head within 12 px on sheet cells
//   26-29 and the flash on the contact cell 30; CONTROL: the v1125 fit (the old avatar's frames 24-28, mirrored) misses the new axe by far.
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND (as tests/test_veyr_deepcleft_1160.js):
//   1. the timing DATA the engine reads is unchanged: every action clip keeps clipDur 2.0 s and relFrac 0.5, the hit keeps its 0.6 s hold;
//   2. CONTROL against the live build (git show BASE): scripted swings, casts and whole fights through server/sim-host.js land every blow and
//      effect on the same tick with the same numbers;
//   3. each clip's `contact` cell is the cell drawn when the engine lands it, re-derived from the engine's own blow / release / landing tick.
// The v532 CRIT-CLIP RULE (engine code, unchanged): a hero WITH a crit clip rolls a swing's crit at the WIND-UP (same chance). Korvux had none, so
// his roll now happens earlier in the battle RNG stream: with his crit at 0 the fights are identical to BASE; with his real crit they are identical
// to BASE given a crit clip of the OLD attack timing (BASE + the rule) - the art itself moves nothing.
// SOUND (v1138 rules, files unchanged): Ember Cleave (S0172) and Falling Star (S0174) now peak on their landings (BASE played both from the press);
// Comet Dash (S0171) stays on the dash landing, his weapon sound on the blow.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '1debe711';   // live v1160, the build before this change (its Korvux entries = v1159's)
const VER = process.env.EW_KORVUX_VER || '1162';
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-korvux8-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
require('./helpers/vael-fx-1165.js').undoVaelFx1165(run);   // v1165: Vael's three FX entries + ownFx tags go back to v1163's (tests/test_vael_fx_1165.js checks them)
const R0 = OLD ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 700) : '')); } };
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) {
  const b = fs.readFileSync(file); const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return null;
}
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const py = args => JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'korvux_1162_check.py'), ROOT, JSON.stringify(args)], { maxBuffer: 1 << 24 }).toString());
// the eight clips: [state, cells, fps, contact cell (null = none), source frame on it]
const NEW = [['idle', 62, 12, null], ['walk', 36, 17.28, null], ['attack', 48, 24, 30, 52], ['crit', 48, 24, 30, 43], ['hit', 15, 25, null],
  ['green', 48, 24, 18, 28], ['blue', 48, 24, 30, 37], ['ult', 48, 24, 29, 32]];
const STATES = NEW.map(x => x[0]), ACT = ['attack', 'crit', 'green', 'blue', 'ult'];
const FR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/korvux_1162_frames.json'), 'utf8'));
function gridProblems(G, list) {
  const bad = [];
  for (const st of list) { const A = G[st]; if (!A) { bad.push(st + ' missing entry'); continue; }
    const f = fileOf(A.u);
    if (!fs.existsSync(f)) { bad.push(st + ' missing file'); continue; }
    const sz = webpSize(f), ch = chunks(fs.readFileSync(f));
    if (A.n > A.cols * A.rows) bad.push(st + ' n>grid');
    if (A.fw * A.cols > 2048 || A.fh * A.rows > 2048) bad.push(st + ' >2048 (the v1140 phone budget)');
    if (fs.statSync(f).size > 4e6) bad.push(st + ' file > 4 MB');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) bad.push(st + ' not a q95 lossy WebP with alpha (v1158)');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top >= 0 && A.top < A.feet)) bad.push(st + ' anchor outside cell'); }
  return bad;
}
// scripted swings: Korvux vs a still dummy, every blow [tick time, amount, crit, clip]
const SWING = (kind, crit) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('korvux','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false});
  g.anim=BATTLE_ANIM.korvux; e.anim=null; g.glyphCrit=${crit};
  units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; e.greenCd=e.blueCd=99;
  const hits=[], _dd=dealDamage;
  dealDamage=function(s,t,amt,c,k){ if(s===g){ const r=_dd.apply(this,arguments); hits.push([+battleTime.toFixed(4),Math.round(amt),t._critHit?1:0,g._atkClip||'attack',k||null]); t._critHit=false; return r; } return _dd.apply(this,arguments); };
  try{
    if('${kind}'==='crit') g._gearNextCrit='hit';
    g.atkCd=0;
    for(let i=0;i<Math.round(12/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; e.energy=0; g.energy=0; if('${kind}'==='crit'&&hits.length===0&&battleTime>3) break; }
    return JSON.stringify(hits);
  } finally { dealDamage=_dd; } })()`;
// green / blue / ult through castKit / castAbility: cast tick, clip hold, every effect tick, every hp/x/y for 6 s
const CAST = kind => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
  const g=makeUnit('korvux','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false}); const e2=makeUnit('tick','enemy',560,740,30,{owned:false});
  g.anim=BATTLE_ANIM.korvux; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.hp=g.maxHp*0.5;
  const fx=[], dm=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const _dd=dealDamage; dealDamage=function(s,t){ if(s===g) dm.push(t.key+'@'+battleTime.toFixed(4)); return _dd.apply(this,arguments); };
  g._castSM=1; g._castLv=1;
  try{
    if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS.korvux['${kind}']);
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let fired=null; let pend=!!g._pend;
    const tr=[]; for(let i=0;i<Math.round(6/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=0; e2.energy=0;
      if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4); if(g._pend) pend=true;
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),+(u.slow||0).toFixed(2)].join(':')).join('|')); }
    return JSON.stringify({hold,anim,fired,fx,dm,trace:crypto_like(tr.join('#'))});
  } finally { doEffect=_de; dealDamage=_dd; } })()`;
const trace = (r, seed, a, f, crit) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      let pc=0; const _fp=firePassiveClip; firePassiveClip=function(o){ if(o&&o.key==='korvux') pc++; return _fp.apply(this,arguments); };
      const tr=[]; try{ for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ ${crit != null ? "units.forEach(u=>{ if(u.key==='korvux') u.glyphCrit=" + crit + '; });' : ''} updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); } } finally{ firePassiveClip=_fp; }
      globalThis.__pc=(globalThis.__pc||0)+pc; return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
const withRule = (r, fn) => {   // BASE + the v532 rule: give BASE's Korvux a crit clip with the OLD attack clip's timing (render data only)
  r("globalThis.__svK=BATTLE_ANIM.korvux; BATTLE_ANIM.korvux=Object.assign({},BATTLE_ANIM.korvux,{crit:Object.assign({},BATTLE_ANIM.korvux.attack)}); 1");
  try { return fn(); } finally { r('BATTLE_ANIM.korvux=globalThis.__svK; 1'); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));

try {
  ck('control file (BASE emberweave-heroes.html from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  const G = JSON.parse(run('JSON.stringify(BATTLE_ANIM.korvux)')), G0 = JSON.parse(R0('JSON.stringify(BATTLE_ANIM.korvux)'));
  ck('Korvux has exactly the eight states (idle walk attack crit hit green blue ult) - NO passive; BASE had no crit and no passive',
    Object.keys(G).sort().join() === STATES.slice().sort().join() && !G0.crit && !G0.passive, Object.keys(G).join(','));
  const bad = gridProblems(G, STATES);
  ck('every new sheet exists, file = declared grid, within 2048 px per side and 4 MB (v1140 budget), q95 lossy + alpha (v1158), anchors in the cell', bad.length === 0, bad.join('; '));
  const baseSrc = fs.readFileSync(OLD, 'utf8');
  ck('the eight are new files at ?v=' + VER + ' that BASE never referenced (never a reused asset version)', STATES.every(s => G[s].u === `/assets/anim/korvux/korvux_${s}_${VER}.webp?v=${VER}` && !baseSrc.includes(`korvux_${s}_${VER}`)));
  ck('the old sheets are still on disk (rollback needs nothing)', ['idle', 'walk', 'attack', 'hit', 'green', 'blue', 'ult'].every(s => fs.existsSync(fileOf(G0[s].u))));
  const others = r => r("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='korvux').map(k=>[k,BATTLE_ANIM[k]]))");
  ck('every other hero and monster has BATTLE_ANIM byte-for-byte BASE', H(others(run)) === H(others(R0)));
  ck('grids as cut (cells / fps / contact cell): ' + NEW.map(x => x[0] + ' ' + x[1] + '@' + x[2] + (x[3] != null ? ' c' + x[3] : '')).join(', '),
    NEW.every(([s, n, fps, c]) => G[s].n === n && G[s].fps === fps && (c == null ? G[s].contact == null : G[s].contact === c)));
  ck('the art faces RIGHT (flip:false), every state stands on its frame-0 pose (feet - top = figH), no ax drift table, no pingpong',
    STATES.every(s => G[s].flip === false && G[s].feet - G[s].top === G[s].figH && !G[s].ax && !G[s].pingpong));
  ck('walk = 36 cells over the 50-frame stride f29-f78 (loop [0,36], 17.28 fps = the stride\'s own 2.083 s, stride 0.12 x 36/50 = the source cadence) - the v1155 slim walk',
    G.walk.n === 36 && JSON.stringify(G.walk.loop) === '[0,36]' && Math.abs(G.walk.n / G.walk.fps - 50 / 24) < 1e-9 && Math.abs(G.walk.stride - 0.12 * 36 / 50) < 1e-9 &&
    FR.frames.walk.length === 36 && FR.frames.walk[0] === 29 && FR.frames.walk[35] <= 78 && FR.frames.walk.every((x, i) => i === 0 || (x - FR.frames.walk[i - 1] >= 1 && x - FR.frames.walk[i - 1] <= 2)) && FR.frames.walk.every((x, i) => Math.abs(x - (29 + i * 50 / 36)) <= 0.5));
  ck('idle keeps the clip\'s own timing, 62 @12 over the whole 5.17 s clip (it loops f0 ~ f123 and has no clean sub-loop - 24 cells would be 4.6 fps, steppy), as Veyr / Aureth / Carn',
    G.idle.n === 62 && G.idle.fps === 12 && JSON.stringify(FR.frames.idle) === JSON.stringify(Array.from({ length: 62 }, (_, i) => 2 * i)));
  const K = JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(STATES)}.map(s=>{ const c=BATTLE_ANIM.korvux[s]; return texSheetK(c.fw,c.fh,c.cols,c.rows,c.figH/c.fh); })); } finally{ window.__texPhone=null; } })()`));
  ck('phone: every new sheet uploads at its own size (texSheetK 1) and every figure is drawn from 140-240 px', K.every(k => k === 1) && STATES.every(s => G[s].figH >= 140 && G[s].figH <= 240), JSON.stringify(K));

  // SCALE + ANCHOR across the eight: the two references, measured
  { const RF = FR.reference, W0 = RF.wide_f0, HF = RF.headroom_fit, MF = RF.headroom_measured_f0;
    ck('the extra-headroom reference (attack / crit / blue / ult) is x' + Object.values(HF).map(x => x.k).join(' / ') + ' of the wide one, fitted on the frame-0 silhouettes (IoU ' + Object.values(HF).map(x => x.iou).join(' / ') + '): the idle standing figure maps to sole ' + Object.values(HF).map(x => x.sole).join(' / ') + ' (measured on the clip: ' + Object.values(MF).map(x => x.sole).join(' / ') + ')',
      ['attack', 'crit', 'blue', 'ult'].every(s => HF[s] && HF[s].k >= 0.69 && HF[s].k <= 0.71 && HF[s].iou > 0.97 && HF[s].sole > MF[s].sole && HF[s].sole - HF[s].top > MF[s].sole - MF[s].top) && W0.top === 306 && W0.sole === 1235);
    // every state's anchors = idle's frame-0 figure mapped into that sheet (crop box + cell scale): figH and feet to the rounding, cx to 0.1 px
    const want = s => { const r = (W0.clips.includes(s) ? W0 : HF[s]), C = FR.cut[s]; return { top: (r.top - C.box[1]) * C.sy, feet: (r.sole - C.box[1]) * C.sy, cx: (r.cx - C.box[0]) * C.sx }; };
    const off = STATES.map(s => { const w = want(s); return [s, +(G[s].feet - w.feet).toFixed(2), +(G[s].figH - (w.feet - w.top)).toFixed(2), +(G[s].cx - w.cx).toFixed(2)]; });
    ck('every state anchors on the idle frame-0 figure mapped into its own sheet (wide clips: top 306 / sole 1235 / cx 1073.6; combat clips: the fit): feet and figH within 0.6 px, cx within 0.06 px - [state, feet, figH, cx] ' + JSON.stringify(off),
      off.every(([, a, b, c]) => Math.abs(a) <= 0.6 && Math.abs(b) <= 0.6 && Math.abs(c) <= 0.06)); }
  const cells0 = {}; for (const s of STATES) { const c = FR.frames[s].indexOf(0); if (c >= 0) cells0[s] = c; }
  const anim = {}; for (const s of STATES) anim[s] = G[s];
  const SC = py({ anim, cells0 }).scale;
  ck('SAME SIZE, SAME SPOT: every state with a frame-0 cell (' + Object.keys(SC).join(' ') + '), drawn as the engine draws it, matches idle\'s at best scale 1.00 +-0.01 and a best shift within 2 px of 300 (as drawn IoU ' + Object.values(SC).map(x => x.iou).join(' / ') + ')',
    Object.keys(SC).length === 6 && Object.values(SC).every(x => Math.abs(x.k - 1) <= 0.0101 && Math.abs(x.dx) <= 2 && Math.abs(x.dy) <= 2 && x.iou > 0.92), JSON.stringify(SC));
  { const bad2 = JSON.parse(JSON.stringify(anim)); for (const s of ['attack', 'crit', 'blue', 'ult']) { bad2[s].figH = Math.round(bad2[s].figH / 0.6985); bad2[s].top = bad2[s].feet - bad2[s].figH; }
    const SC2 = py({ anim: bad2, cells0 }).scale;
    ck('CONTROL: drawn as if both framings matched (the combat states given the wide reference\'s height in their cells) they come out ~30% small - the check sees it (best scale ' + ['attack', 'crit', 'blue', 'ult'].map(s => SC2[s].k).join(' / ') + ' at the 0.97-1.03 edge, IoU ' + ['attack', 'crit', 'blue', 'ult'].map(s => SC2[s].iou).join(' / ') + ')',
      ['attack', 'crit', 'blue', 'ult'].every(s => SC2[s].iou < 0.75 && SC2[s].k >= 1.03 - 1e-9)); }

  // 1. timing DATA
  const dur = A => (A.pingpong ? 2 * A.n - 2 : A.n) / A.fps, rel = A => (A.relFrac != null ? A.relFrac : 0.5);
  ck('every action clip (attack, crit, green, blue, ult) keeps clipDur 2.0 s and relFrac 0.5 exactly as BASE\'s attack / green / blue / ult',
    ACT.every(s => Math.abs(dur(G[s]) - 2) < 1e-12 && rel(G[s]) === 0.5 && !G[s].hold) && ['attack', 'green', 'blue', 'ult'].every(s => Math.abs(dur(G0[s]) - 2) < 1e-12 && rel(G0[s]) === 0.5 && G0[s].hold == null),
    ACT.map(s => s + ' ' + dur(G[s])).join(' '));
  ck('the hit keeps its 0.6 s hold (min(0.6, clip) - 15 @25 = 0.6 s, BASE 48 @24 = 2.0 s)', Math.min(0.6, G.hit.n / G.hit.fps) === 0.6 && Math.min(0.6, G0.hit.n / G0.hit.fps) === 0.6);
  const kit = r => r('JSON.stringify([KITS.korvux,HERO_ULT_ART.korvux||null,HERO_TYPES.korvux,ABILITY_CAST.korvux||null,ULT_DEF.ashfall,FX2_DEF.korvux_green,FX2_DEF.korvux_blue,FX2_DEF.korvux_ult,FX1123_WARM.korvux])');
  ck('kit (Comet Dash charge, Ember Cleave form + ownFx chop, Emberskin), ult art (land), hero stats, Falling Star numbers, his FX plates and the FX warm list identical to BASE', kit(run) === kit(R0));
  const fxOld = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>k!=='korvuxcleave').map(k=>[k,FX2_DEF[k]]))");
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'sync' || k === 'fit') ? undefined : v));
  ck('every other FX2_DEF entry is byte-for-byte BASE; korvuxcleave differs only in sync / fit (same file, same cells, same hit cell, same clock)',
    H(fxOld(run)) === H(fxOld(R0)) && JSON.stringify(strip(JSON.parse(run('JSON.stringify(FX2_DEF.korvuxcleave)')))) === JSON.stringify(strip(JSON.parse(R0('JSON.stringify(FX2_DEF.korvuxcleave)')))));

  // 2. CONTROL: scripted swings, casts and whole fights on BASE
  const sw = (r, k, c) => JSON.parse(r(SWING(k, c)));
  { const a0 = sw(run, 'attack', 0), b0 = sw(R0, 'attack', 0);
    ck('swings (crit 0): every blow on the same tick with the same number as BASE (' + a0.length + ' blows), all on the attack sheet', a0.length >= 4 && JSON.stringify(a0.map(x => x.slice(0, 3))) === JSON.stringify(b0.map(x => x.slice(0, 3))) && a0.every(x => x[3] === 'attack'), JSON.stringify({ now: a0.slice(0, 4), base: b0.slice(0, 4) }));
    const a1 = sw(run, 'crit', 0), b1 = sw(R0, 'crit', 0);
    ck('forced crit (next-hit crit): the crit blow lands on the same tick, same amount, flagged crit, as BASE, and plays the crit sheet', a1.length > 0 && a1[0][2] === 1 && a1[0][3] === 'crit' &&
      JSON.stringify(a1.map(x => x.slice(0, 3))) === JSON.stringify(b1.map(x => x.slice(0, 3))), JSON.stringify({ now: a1.slice(0, 3), base: b1.slice(0, 3) })); }
  const casts = {};
  for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(kind))), y = JSON.parse(R0(CAST(kind))); casts[kind] = x;
    ck(`${kind}: the cast fires on the same tick, the effect lands on the same ticks (${x.fx.join(' ')}; damage ${x.dm.slice(0, 2).join(' ') || 'none in reach'}), the clip is held as long (${x.hold} s) and every unit (hp, x, y, stun, slow) matches BASE for 6 s`,
      x.fired != null && x.anim === kind && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ now: x, base: y }));
  }
  const fights = [[['korvux', 'askel', 'vex'], ['korvux', 'vesper', 'grosk'], 11], [['korvux', 'pellucid'], ['rhukk', 'korvux', 'vael'], 222],
                  [['korvux', 'sloe', 'umbris'], ['askel', 'hurne', 'carn'], 5], [['gruel', 'aureth', 'tharl'], ['korvux', 'hollow', 'calypsa'], 77],
                  [['astra', 'quorrel', 'korvux'], ['maren', 'lumi', 'hollow'], 31]];
  run('globalThis.__pc=0; 1'); R0('globalThis.__pc=0; 1');
  ck('whole fights (autoUlt, Korvux on both sides, heroes carry BATTLE_ANIM as the server replay) with his crit held at 0 are tick-for-tick identical to BASE (hp, x, y, alive, energy, swing timer)',
    fights.every(([a, f, s]) => trace(run, s, a, f, 0) === trace(R0, s, a, f, 0)));
  ck('whole fights with his real crit are tick-for-tick identical to BASE + the v532 crit-clip rule (the art moves nothing)',
    fights.every(([a, f, s]) => trace(run, s, a, f, null) === withRule(R0, () => trace(R0, s, a, f, null))));
  ck('no passive clip fires for Korvux in those fights (he has none; BASE had none since v1155)', +run('globalThis.__pc') === 0 && +R0('globalThis.__pc') === 0);
  const broken = JSON.parse(JSON.stringify(G)); broken.attack.fps = 20; broken.ult.n = 40; broken.crit.fps = 20;
  ck('CONTROL: the same fights with the timing moved (attack 20 fps, ult 40 cells, crit 20 fps) diverge - the trace sees a timing change',
    fights.every(([a, f, s]) => { run(`globalThis.__sv1=BATTLE_ANIM.korvux; BATTLE_ANIM.korvux=${JSON.stringify(broken)}; 1`);
      try { return trace(run, s, a, f, 0) !== trace(R0, s, a, f, 0); } finally { run('BATTLE_ANIM.korvux=globalThis.__sv1; 1'); } }));
  const plain = fights.filter(([a, f, s]) => trace(run, s, a, f, null) !== trace(R0, s, a, f, null)).length;
  ck('CONTROL: the rule control is real - BASE with and without the crit-clip rule differ at his real crit (the roll moved in the RNG stream)',
    fights.some(([a, f, s]) => trace(R0, s, a, f, null) !== withRule(R0, () => trace(R0, s, a, f, null))));
  console.log('  info at his real crit vs plain BASE: ' + plain + ' of ' + fights.length + ' fights differ - the v532 crit-clip rule rolls his crit at the wind-up now that he has a crit clip (same chance, earlier in the RNG stream)');

  // 3. the art lands on those moments. HIS SWING IS NOT FITTED: the swing hold is min(0.95 x 2.3 s, the clip) = the whole 2.0 s clip, so the
  //    48 cells play at their own speed from the swing's start (x the attack speed) and the blow is drawn on (blow - start) / CLK x fps x speed.
  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE');
  const sweep = (crit, haste) => JSON.parse(run(`(()=>{ units=[]; ended=false; battleTime=0; seedBattle(7); const g=makeUnit('korvux','ally',500,700,30,{owned:false,rank:3}), e=makeUnit('vael','enemy',540,700,30,{owned:false});
    g.anim=BATTLE_ANIM.korvux; e.anim=null; g.glyphCrit=0; units=[g,e]; e.maxHp=e.hp=1e9; e.speed=0; e.atkCd=99; g.target=e; g.greenCd=g.blueCd=99; ${crit ? "g._gearNextCrit='hit';" : ''} g.atkCd=0;
    const out=[]; let cur=null; const _dd=dealDamage; dealDamage=function(s,t,a,c,k){ if(s===g&&cur&&cur.hit==null){ cur.hit=battleTime; out.push(cur); cur=null; } return _dd.apply(this,arguments); };
    try{ for(let i=0;i<400&&out.length<2;i++){ ${haste ? 'g.hasteMul=' + haste + '; g.hasteT=1;' : ''} const a0=g.attackAnim||0; updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.energy=0;
        if(!cur&&(g.attackAnim||0)>a0+1e-9) cur={st:battleTime,clip:g._atkClip||'attack',mul:g._atkSpdMul,ai:(g._atkI0||g.atkInterval)/g._atkSpdMul,free:null};
        else if(cur&&cur.free==null&&!((g.attackAnim||0)>0)) cur.free=battleTime; } } finally{ dealDamage=_dd; }
    return JSON.stringify(out); })()`));
  const drawn = (w, A) => { const D = dur(A) / w.mul, ah = Math.min(0.95 * w.ai, D), fit = D > ah && D <= ah * 1.6;
    return { d: fit ? (w.hit - w.free) / CLK / ah * A.n : (w.hit - w.st) / CLK * A.fps * w.mul, fit }; };
  for (const hs of [0, 1.25, 0.8]) {
    const ws = sweep(false, hs).slice(0, 1).concat(sweep(true, hs).slice(0, 1));
    for (const w of ws) { const A = G[w.clip], { d, fit } = drawn(w, A), src = NEW.find(x => x[0] === w.clip);
      const ok = hs ? Math.abs(Math.floor(d) - A.contact) <= 1 : Math.floor(d) === A.contact;
      ck(`${w.clip} (attack speed x${w.mul.toFixed(2)}, ${fit ? 'fitted' : 'natural speed'}): the blow is drawn on cell ${d.toFixed(2)} - ${hs ? 'within one cell of the contact ' + A.contact + ' (the reach held, cells 29-31)' : 'the contact cell ' + A.contact + ' (source f' + src[4] + ')'}`,
        ok && !fit && run(`clipContactCell(BATTLE_ANIM.korvux.${w.clip})`) === A.contact, JSON.stringify(w) + ' ' + d.toFixed(2)); }
    ck(`at x${hs || 1}: a plain swing plays the attack sheet, a crit the crit sheet`, ws.length === 2 && ws[0].clip === 'attack' && ws[1].clip === 'crit', JSON.stringify(ws.map(x => x.clip)));
  }
  ck('frame maps (tests/fixtures/korvux_1162_frames.json): one source frame per cell, the contact cell on its named source frame, the swings\' reach held on cells 29-31 (three consecutive frames round the contact)',
    NEW.every(([s, n, , c, f]) => FR.frames[s].length === n && (c == null || FR.frames[s][c] === f)) &&
    ['attack', 'crit'].every(s => { const f = FR.frames[s], c = NEW.find(x => x[0] === s)[4]; return f[29] === c - 1 && f[30] === c && f[31] === c + 1; }));
  { const g = casts.green, b = casts.blue, u = casts.ult;
    const land = +b.fx[b.fx.length - 1].split('@')[1], star = +u.fx[u.fx.length - 1].split('@')[1];
    const M = [['green', g.fired, 'the launch on the cast release (the dash then runs on its own clock)'], ['blue', land, 'the axe at full reach when the Ember Cleave form delivery lands'], ['ult', u.fired, 'the axe raised to call the star on the cast release']];
    for (const [s, t, what] of M) { const A = G[s], d = t / CLK * A.fps, f = NEW.find(x => x[0] === s)[4];
      ck(`${s}: ${what} at ${t} fight s = ${(t / CLK).toFixed(3)} real s is drawn on cell ${A.contact} (source f${f}) - ${d.toFixed(2)}`, Math.floor(d) === A.contact && d - A.contact > 0.15 && run(`clipContactCell(BATTLE_ANIM.korvux.${s})`) === A.contact, d.toFixed(2)); }
    console.log('  info green: Comet Dash slams on arrival (here ' + (g.dm[0] || '?') + ' fight s; 0.15-0.8 s of travel by distance) - the clip shows the dash pose on cells 18-27 and the slam (f48) on cell 28');
    console.log('  info ult: the star lands ' + (star - u.fired).toFixed(4) + ' fight s after the release (' + star + ' = cell ' + (star / CLK * 24).toFixed(1) + ', after the 48-cell clip) on the korvux_ult plate; the body slams the axe (f68) on cell 46'); }

  // 4. EMBER CLEAVE re-sync (display only): the crescent rides the NEW axe
  { const D = JSON.parse(run('JSON.stringify(FX2_DEF.korvuxcleave)')), D0 = JSON.parse(R0('JSON.stringify(FX2_DEF.korvuxcleave)')), f = D.sync.f, c = D.sync.c;
    const AXH = FR.axe_head_blue, src = FR.frames.blue;
    ck(`the sync table reads the NEW sheet's cells ${f.join(',')} (source f${f.map(x => src[x]).join(', f')}) -> crescent cells ${c.join(',')}: the flash (cell ${D.hit}) on the blue contact cell ${G.blue.contact} = f${src[G.blue.contact]}; cells only move forward; the old avatar's frames 24-28 are gone`,
      f[f.length - 1] === G.blue.contact && c[c.length - 1] === D.hit && D.hit === D0.hit && c.every((x, i) => i === 0 || x > c[i - 1]) && f.every((x, i) => i === 0 || x === f[i - 1] + 1) &&
      JSON.stringify(f.map(x => src[x])) === JSON.stringify(FR.fx_fit.frames) && JSON.stringify(D0.sync.f) === '[24,25,26,27,28]' && JSON.stringify(f) !== JSON.stringify(D0.sync.f), JSON.stringify(D.sync));
    const P = py({ fx: { u: D.u, fw: D.fw, fh: D.fh, cols: D.cols, hit: D.hit, flash: D.flash, jobs: { now: { fit: D.fit, mir: !D.fit.paint, cells: c }, old: { fit: D0.fit, mir: true, cells: c }, oldMap: { fit: D0.fit, mir: true, cells: D0.sync.c } } } }).fx;
    const err = (pts) => pts.map((p, i) => { const a = AXH[src[f[i]]]; return Math.round(Math.hypot(p[0] - a[0], p[1] - a[1])); });
    const eNow = err(P.now), eOld = err(P.old), eOldMap = err(P.oldMap);
    ck(`the crescent's tip sits on the measured axe head (blue sheet px, figH ${G.blue.figH}) on every sync cell - off by ${eNow.join(' / ')} px (<= 12), the flash on the axe at full reach`, eNow.every(x => x <= 12), JSON.stringify({ P: P.now, axe: f.map(x => AXH[src[x]]) }));
    ck(`CONTROL: the v1125 fit (k ${D0.fit.k}, mirrored) on the new axe path misses by ${eOld.join(' / ')} px (its own cells: ${eOldMap.join(' / ')}) - the old avatar's fit does not carry over`, Math.max(...eOld) > 40 && Math.max(...eOldMap) > 40);
    ck(`as painted (paint:1) when he faces right: the new swing runs the crescent's own way round; mirrored, the best fit is ${FR.fx_fit_mirrored.err_px.join(' / ')} px off, upside down (rot ${FR.fx_fit_mirrored.rot})`, D.fit.paint === 1 && Math.max(...FR.fx_fit_mirrored.err_px) > 30 && Math.max(...FR.fx_fit.err_px) < 10);
    const srcHtml = fs.readFileSync(HTML, 'utf8');
    ck('render: _fx22ChopAxe shows it as painted for a paint fit when he faces right and the true mirror when he faces left (the v1125 B rule only without paint); _fx22ChopTick still drives the cells by the blue clip cell drawn',
      /const want=F\.paint\?!!o\.mir:!o\.mir;/.test(srcHtml) && /if\(v&&\(\(v\[0\]<0\)!==want\)\) o\.s\._uv=/.test(srcHtml) && /const a=live\?\(u\._animAcc\|\|0\):\(o\.t-o\.ts\)\/FX_RT\*24, f=d\.sync\.f, c=d\.sync\.c;/.test(srcHtml));
    const flashReal = f[f.length - 1] / G.blue.fps, landReal = +casts.blue.fx[casts.blue.fx.length - 1].split('@')[1] / CLK;
    ck(`timing: the flash shows when the clip reaches cell ${f[f.length - 1]} (${flashReal.toFixed(3)} real s after the press), within one cell of the cleave's landing (${landReal.toFixed(3)} real s = cell ${(landReal * 24).toFixed(2)})`, Math.abs(flashReal - landReal) < 1 / 24); }

  // sound: the rows sit on those moments
  const SD = JSON.parse(run('JSON.stringify(SFX_DATA.heroes.korvux)')), SD0 = JSON.parse(R0('JSON.stringify(SFX_DATA.heroes.korvux)'));
  const on = (x, slot, id) => ((x[slot] || []).find(e => e.id === id) || {}).on;
  ck('sound: Ember Cleave S0172 and Falling Star S0174 peak on their landings (land - the cleave = blue contact 30, the star on its plate), Comet Dash S0171 on the dash landing, his weapon sound on the blow - BASE played S0172 / S0174 from the press; the files are unchanged',
    on(SD, 'blue', 'S0172') === 'land' && on(SD, 'ult', 'S0174') === 'land' && on(SD, 'green', 'S0171') === 'land' && on(SD0, 'blue', 'S0172') === 'cast' && on(SD0, 'ult', 'S0174') === 'cast' && on(SD0, 'green', 'S0171') === 'land' &&
    JSON.stringify([SD.atk, SD.green[0].f, SD.blue[0].f, SD.ult[0].f]) === JSON.stringify([SD0.atk, SD0.green[0].f, SD0.blue[0].f, SD0.ult[0].f]));
  { const others2 = r => r("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='korvux').map(k=>[k,SFX_DATA.heroes[k]]))");
    const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8'));
    ck('sound: every other hero\'s rows and every file entry are BASE\'s; the manifest rows say land too', H(others2(run)) === H(others2(R0)) && H(sfxFilesV1165(run, run)) === H(sfxFilesV1165(R0, run)) &&
      MAN.rows.S0172.rule === 'land' && MAN.rows.S0174.rule === 'land' && MAN.rows.S0171.rule === 'land'); }
  const ctl = JSON.parse(JSON.stringify(G)); ctl.crit.u = '/assets/anim/korvux/korvux_missing.webp?v=' + VER; ctl.attack.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, ['crit', 'attack']).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
