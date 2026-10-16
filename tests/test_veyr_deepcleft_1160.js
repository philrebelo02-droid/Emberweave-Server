'use strict';

/* v1165: the ability files were re-rendered ON PURPOSE (ride out + sparkle, Phil 16 Oct; tests/test_sparkle_tails_1165.js checks them: same peak within
   10 ms, same loudness within 0.5 LU) - they (and the new fused melee swings) are left out; every other entry is compared exactly */
function sfxFilesV1165(r, cur) { const o = JSON.parse(r('JSON.stringify(SFX_DATA.files)')), c = JSON.parse(cur('JSON.stringify(SFX_DATA.files)'));
  return JSON.stringify(Object.keys(o).sort().filter(n => !(c[n] && /\?v=1165$/.test(c[n][0]))).map(n => [n, o[n]])); }   // v1165 files (re-rendered or new fused swings) left out on both sides
// v1160 - Veyr's and Deepcleft's eight new animations each (Phil PASS 15 Oct 2026, REVIEW 15OCT2026 H3, clean-source-manifest.json - all sixteen
//   "Phil PASS", official Hailuo Without Watermark exports, sha256 matched): IDLE, WALK (in place), ATTACK, CRIT (their first crit clips), HIT,
//   GREEN, BLUE, ULT. NO passive animation for either (Phil: "not doing passive for him"; Deepcleft's set has none). Plus Veyr's three Grok
//   spell FX (Phil PASS 15 Oct 22:59 "pass it all to claude"): Gravity Crescent, Abyssal Mantle, Abyssal Undertow - DISPLAY ONLY.
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND (as tests/test_aureth_anim_eleven.js):
//   1. the timing DATA the engine reads is unchanged: every action clip keeps clipDur 2.0 s and relFrac 0.5, the hit keeps its 0.6 s hold;
//   2. CONTROL against the live build (git show BASE = v1158): scripted swings, casts and whole fights through server/sim-host.js land every blow and
//      effect on the same tick with the same numbers;
//   3. each clip's `contact` cell is the cell drawn when the engine lands it, re-derived here from the engine's own blow / release / landing tick
//      (clips play in real time; the fight clock is SIM_STEP*SIM_HZ*BATTLE_PACE = 0.6724 of it).
// The v532 CRIT-CLIP RULE (engine code, unchanged): a hero WITH a crit clip rolls a swing's crit at the WIND-UP (same chance). Neither had one, so
// their roll now happens earlier in the battle RNG stream: with their crit at 0 the fights are identical to BASE; with their real crit they are
// identical to BASE given a crit clip of the OLD attack timing (BASE + the rule) - the art itself moves nothing.
// SOUND (v1138): Veyr's Gravity Crescent (S0207), Abyssal Mantle (S0209) and Undertow cast (S0211) now peak on their releases (contacts 18 / 18 / 29;
// S0213 stays on the collapse), Deepcleft's Burrow Guard (S0266) on its release (contact 18) and Quarry Collapse (S0268) on the form landing
// (contact 37); Fault Claws (S0265) was already on its release.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'c6c0523e';   // live v1159, before this change (its Veyr / Deepcleft entries = v1158's)
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-vd1160-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
require('./helpers/anim-korvux-1162.js').undoKorvux1162(run);   // v1162: Korvux's new entries go back to their v1159 state (tests/test_korvux_anim_eight.js checks them)
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
// the sixteen clips: [hero, state, cells, fps, contact cell (null = none), source frame on it]
const NEW = [
  ['veyr', 'idle', 62, 12, null], ['veyr', 'walk', 36, 16.3019, null], ['veyr', 'attack', 48, 24, 27, 32], ['veyr', 'crit', 48, 24, 27, 59], ['veyr', 'hit', 15, 25, null],
  ['veyr', 'green', 48, 24, 18, 40], ['veyr', 'blue', 48, 24, 18, 30], ['veyr', 'ult', 48, 24, 29, 28],
  ['deepcleft', 'idle', 24, 10.8679, null], ['deepcleft', 'walk', 36, 16.9412, null], ['deepcleft', 'attack', 48, 24, 27, 41], ['deepcleft', 'crit', 48, 24, 27, 59], ['deepcleft', 'hit', 15, 25, null],
  ['deepcleft', 'green', 48, 24, 18, 16], ['deepcleft', 'blue', 48, 24, 18, 28], ['deepcleft', 'ult', 44, 22, 37, 84]];
const HEROES = ['veyr', 'deepcleft'], STATES = ['idle', 'walk', 'attack', 'crit', 'hit', 'green', 'blue', 'ult'], ACT = ['attack', 'crit', 'green', 'blue', 'ult'];
function gridProblems(G, list) {
  const bad = [];
  for (const [h, st] of list) { const A = G[h] && G[h][st]; if (!A) { bad.push(h + '.' + st + ' missing entry'); continue; }
    const f = fileOf(A.u);
    if (!fs.existsSync(f)) { bad.push(h + '.' + st + ' missing file'); continue; }
    const sz = webpSize(f), ch = chunks(fs.readFileSync(f));
    if (A.n > A.cols * A.rows) bad.push(h + '.' + st + ' n>grid');
    if (A.fw * A.cols > 2048 || A.fh * A.rows > 2048) bad.push(h + '.' + st + ' >2048 (the v1140 phone budget)');
    if (fs.statSync(f).size > 4e6) bad.push(h + '.' + st + ' file > 4 MB');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(h + '.' + st + ' file ' + sz + ' != grid');
    if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) bad.push(h + '.' + st + ' not a q95 lossy WebP with alpha (v1158)');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top >= 0 && A.top < A.feet)) bad.push(h + '.' + st + ' anchor outside cell'); }
  return bad;
}
// scripted swings: the hero vs a still dummy, every blow [tick time, amount, crit, clip]
const SWING = (K, kind, crit) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('${K}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false});
  g.anim=BATTLE_ANIM.${K}; e.anim=null; g.glyphCrit=${crit};
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
const CAST = (K, kind) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
  const g=makeUnit('${K}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false}); const e2=makeUnit('tick','enemy',560,740,30,{owned:false});
  g.anim=BATTLE_ANIM.${K}; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.hp=g.maxHp*0.5;
  const fx=[], dm=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const _dd=dealDamage; dealDamage=function(s,t){ if(s===g) dm.push(t.key+'@'+battleTime.toFixed(4)); return _dd.apply(this,arguments); };
  g._castSM=1; g._castLv=1;
  try{
    if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS.${K}['${kind}']);
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let fired=null; let pend=!!g._pend, hz=null;
    const tr=[]; for(let i=0;i<Math.round(6/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=0; e2.energy=0;
      if(pend&&!g._pend&&fired==null){ fired=+battleTime.toFixed(4); if(g._horizon) hz=+g._horizon.t.toFixed(5); } if(g._pend) pend=true;
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),+(u.slow||0).toFixed(2),+(u._evadeT||0).toFixed(2)].join(':')).join('|')); }
    return JSON.stringify({hold,anim,fired,hz,fx,dm,trace:crypto_like(tr.join('#'))});
  } finally { doEffect=_de; dealDamage=_dd; } })()`;
const trace = (r, seed, a, f, crit) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      ${crit != null ? "units.forEach(u=>{ if(u.key==='veyr'||u.key==='deepcleft') u.glyphCrit=" + crit + '; });' : ''}
      let pc=0; const _fp=firePassiveClip; firePassiveClip=function(o){ if(o&&(o.key==='veyr'||o.key==='deepcleft')&&o.anim&&o.anim.passive) pc++; return _fp.apply(this,arguments); };
      const tr=[]; try{ for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ ${crit != null ? "units.forEach(u=>{ if(u.key==='veyr'||u.key==='deepcleft') u.glyphCrit=" + crit + '; });' : ''} updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); } } finally{ firePassiveClip=_fp; }
      globalThis.__pc=(globalThis.__pc||0)+pc; return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
const withRule = (r, fn) => {   // BASE + the v532 rule: give BASE's Veyr and Deepcleft a crit clip with the OLD attack clip's timing (render data only)
  r("globalThis.__svV=BATTLE_ANIM.veyr; globalThis.__svD=BATTLE_ANIM.deepcleft; BATTLE_ANIM.veyr=Object.assign({},BATTLE_ANIM.veyr,{crit:Object.assign({},BATTLE_ANIM.veyr.attack)}); BATTLE_ANIM.deepcleft=Object.assign({},BATTLE_ANIM.deepcleft,{crit:Object.assign({},BATTLE_ANIM.deepcleft.attack)}); 1");
  try { return fn(); } finally { r('BATTLE_ANIM.veyr=globalThis.__svV; BATTLE_ANIM.deepcleft=globalThis.__svD; 1'); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));

try {
  ck('control file (BASE emberweave-heroes.html from git ' + BASE_SHA + ', live v1159) loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  const G = JSON.parse(run('JSON.stringify({veyr:BATTLE_ANIM.veyr,deepcleft:BATTLE_ANIM.deepcleft})')), G0 = JSON.parse(R0('JSON.stringify({veyr:BATTLE_ANIM.veyr,deepcleft:BATTLE_ANIM.deepcleft})'));
  ck('each has exactly the eight states (idle walk attack crit hit green blue ult) - NO passive; BASE had no crit and no passive either',
    HEROES.every(h => Object.keys(G[h]).sort().join() === STATES.slice().sort().join() && !G0[h].crit && !G0[h].passive), HEROES.map(h => Object.keys(G[h]).join(',')).join(' | '));
  const bad = gridProblems(G, NEW.map(x => [x[0], x[1]]));
  ck('every new sheet exists, file = declared grid, within 2048 px per side and 4 MB (v1140 budget), q95 lossy + alpha (v1158), anchors in the cell', bad.length === 0, bad.join('; '));
  const baseSrc = fs.readFileSync(OLD, 'utf8');
  ck('the sixteen are new files at ?v=1160 that BASE never referenced (never a reused asset version)', NEW.every(([h, s]) => G[h][s].u === `/assets/anim/${h}/${h}_${s}_1160.webp?v=1160` && !baseSrc.includes(`${h}_${s}_1160`)));
  ck('the old v21 sheets are still on disk (rollback needs nothing)', HEROES.every(h => ['idle', 'walk', 'attack', 'hit', 'green', 'blue', 'ult'].every(s => fs.existsSync(fileOf(G0[h][s].u)))));
  const others = r => r("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='veyr'&&k!=='deepcleft').map(k=>[k,BATTLE_ANIM[k]]))");
  ck('every other hero and monster has BATTLE_ANIM byte-for-byte BASE', H(others(run)) === H(others(R0)));
  ck('grids as cut (cells / fps / contact cell): ' + NEW.map(x => x[0][0] + '.' + x[1] + ' ' + x[2] + '@' + x[3] + (x[4] != null ? ' c' + x[4] : '')).join(', '),
    NEW.every(([h, s, n, fps, c]) => G[h][s].n === n && G[h][s].fps === fps && (c == null ? G[h][s].contact == null : G[h][s].contact === c)));
  ck('the art faces RIGHT (flip:false), every state stands on its frame-0 pose (feet - top = figH), no ax drift table, no pingpong',
    NEW.every(([h, s]) => G[h][s].flip === false && G[h][s].feet - G[h][s].top === G[h][s].figH && !G[h][s].ax && !G[h][s].pingpong));
  ck('walk = 36 cells, one clean stride loop over the whole sheet (loop [0,36]) - the v1155 slim walk', HEROES.every(h => G[h].walk.n === 36 && JSON.stringify(G[h].walk.loop) === '[0,36]' && G[h].walk.stride > 0));
  ck('idle: Deepcleft 24 cells (the v1155 slim idle, his 2.2 s sub-loop); Veyr keeps his clip\'s own timing, 62 @12 (no sub-loop - 24 cells over 5.17 s = 4.6 fps, steppy, as Aureth / Carn)',
    G.deepcleft.idle.n === 24 && Math.abs(G.deepcleft.idle.n / G.deepcleft.idle.fps - 53 / 24) < 1e-3 && G.veyr.idle.n === 62 && G.veyr.idle.fps === 12);
  const K = JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(NEW.map(x => [x[0], x[1]]))}.map(([h,s])=>{ const c=BATTLE_ANIM[h][s]; return texSheetK(c.fw,c.fh,c.cols,c.rows,c.figH/c.fh); })); } finally{ window.__texPhone=null; } })()`));
  ck('phone: every new sheet uploads at its own size (texSheetK 1) and every figure is drawn from 150-240 px', K.every(k => k === 1) && NEW.every(([h, s]) => G[h][s].figH >= 150 && G[h][s].figH <= 240), JSON.stringify(K));

  // 1. timing DATA
  const dur = A => (A.pingpong ? 2 * A.n - 2 : A.n) / A.fps, rel = A => (A.relFrac != null ? A.relFrac : 0.5);
  ck('every action clip (attack, crit, green, blue, ult) keeps clipDur 2.0 s and relFrac 0.5 exactly as BASE\'s attack / green / blue / ult',
    HEROES.every(h => ACT.every(s => Math.abs(dur(G[h][s]) - 2) < 1e-12 && rel(G[h][s]) === 0.5 && !G[h][s].hold) && ['attack', 'green', 'blue', 'ult'].every(s => Math.abs(dur(G0[h][s]) - 2) < 1e-12 && rel(G0[h][s]) === 0.5 && G0[h][s].hold == null)),
    HEROES.map(h => ACT.map(s => h + '.' + s + ' ' + dur(G[h][s])).join(' ')).join(' | '));
  ck('the hit keeps its 0.6 s hold (min(0.6, clip) - 15 @25 = 0.6 s, BASE 48 @24 = 2.0 s)', HEROES.every(h => Math.min(0.6, G[h].hit.n / G[h].hit.fps) === 0.6 && Math.min(0.6, G0[h].hit.n / G0[h].hit.fps) === 0.6));
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'ownFx' ? undefined : v));
  const kit = r => JSON.stringify(strip(JSON.parse(r('JSON.stringify([KITS.veyr,KITS.deepcleft,HERO_ULT_ART.veyr||null,HERO_ULT_ART.deepcleft||null,HERO_TYPES.veyr,HERO_TYPES.deepcleft,ABILITY_CAST.veyr||null,ABILITY_CAST.deepcleft||null,ULT_DEF.eventhorizon,ULT_DEF.aoeStun||null])'))));
  ck('kits, ult art, hero stats, cast times and ult numbers identical to BASE apart from the three ownFx display tags (crescent / mantle / undertow)', kit(run) === kit(R0) &&
    run("KITS.veyr.green.ownFx+'/'+KITS.veyr.blue.ownFx+'/'+HERO_ULT_ART.veyr.ownFx") === 'crescent/mantle/undertow' && run('KITS.deepcleft.green.ownFx||KITS.deepcleft.blue.ownFx||null') === null);
  const fxOld = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>!/^veyr(crescent|mantle|undertow)$/.test(k)).map(k=>[k,FX2_DEF[k]]))");
  ck('every FX2_DEF entry BASE had is byte-for-byte BASE (veyr_green.dur 3.33 is still the pull\'s length - line ~11727 reads it)', H(fxOld(run)) === H(fxOld(R0)) && run('FX2_DEF.veyr_green.dur') === 3.33);

  // 2. CONTROL: scripted swings, casts and whole fights on BASE
  const sw = (r, K, k, c) => JSON.parse(r(SWING(K, k, c)));
  for (const h of HEROES) {
    const a0 = sw(run, h, 'attack', 0), b0 = sw(R0, h, 'attack', 0);
    ck(h + ' swings (crit 0): every blow on the same tick with the same number as BASE (' + a0.length + ' blows), all on the attack sheet', a0.length >= 5 && JSON.stringify(a0.map(x => x.slice(0, 3))) === JSON.stringify(b0.map(x => x.slice(0, 3))) && a0.every(x => x[3] === 'attack'), JSON.stringify({ now: a0.slice(0, 4), base: b0.slice(0, 4) }));
    const a1 = sw(run, h, 'crit', 0), b1 = sw(R0, h, 'crit', 0);
    ck(h + ' forced crit (next-hit crit): the crit blow lands on the same tick, same amount, flagged crit, as BASE, and plays the crit sheet', a1.length > 0 && a1[0][2] === 1 && a1[0][3] === 'crit' &&
      JSON.stringify(a1.map(x => x.slice(0, 3))) === JSON.stringify(b1.map(x => x.slice(0, 3))), JSON.stringify({ now: a1.slice(0, 3), base: b1.slice(0, 3) }));
  }
  const casts = {};
  for (const h of HEROES) for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(h, kind))), y = JSON.parse(R0(CAST(h, kind))); casts[h + '.' + kind] = x;
    ck(`${h} ${kind}: the cast fires on the same tick, the effect lands on the same ticks (${x.fx.join(' ')}; damage ${x.dm.slice(0, 2).join(' ')}), the clip is held as long (${x.hold} s) and every unit (hp, x, y, stun, slow, evade) matches BASE for 6 s`,
      x.fired != null && x.anim === kind && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ now: x, base: y }));
  }
  const fights = [[['veyr', 'askel', 'vex'], ['deepcleft', 'vesper', 'grosk'], 11], [['deepcleft', 'pellucid'], ['rhukk', 'veyr', 'vael'], 222],
                  [['veyr', 'deepcleft', 'umbris'], ['askel', 'hurne', 'carn'], 5], [['gruel', 'aureth', 'tharl'], ['veyr', 'deepcleft', 'calypsa'], 77],
                  [['deepcleft', 'veyr', 'sloe', 'oakmir', 'lumi'], ['vael', 'deepcleft', 'veyr', 'konwu', 'sylthaine'], 31]];
  run('globalThis.__pc=0; 1'); R0('globalThis.__pc=0; 1');
  ck('whole fights (autoUlt, both heroes on both sides, heroes carry BATTLE_ANIM as the server replay) with their crit held at 0 (Weightless Predator adds 5% a dodge - held at 0 every tick, both builds) are tick-for-tick identical to BASE (hp, x, y, alive, energy, swing timer)',
    fights.every(([a, f, s]) => trace(run, s, a, f, 0) === trace(R0, s, a, f, 0)));
  ck('whole fights with their real crit are tick-for-tick identical to BASE + the v532 crit-clip rule (the art moves nothing)',
    fights.every(([a, f, s]) => trace(run, s, a, f, null) === withRule(R0, () => trace(R0, s, a, f, null))));
  ck('no passive clip fires for either in those fights (they have none; BASE had none since v1155)', +run('globalThis.__pc') === 0 && +R0('globalThis.__pc') === 0);
  const broken = JSON.parse(JSON.stringify(G)); broken.veyr.attack.fps = 20; broken.deepcleft.ult.n = 40; broken.deepcleft.crit.fps = 20;
  ck('CONTROL: the same fights with the timing moved (Veyr attack 20 fps, Deepcleft ult 40 cells / crit 20 fps) diverge - the trace sees a timing change',
    fights.every(([a, f, s]) => { run(`globalThis.__sv1=BATTLE_ANIM.veyr; globalThis.__sv2=BATTLE_ANIM.deepcleft; BATTLE_ANIM.veyr=${JSON.stringify(broken.veyr)}; BATTLE_ANIM.deepcleft=${JSON.stringify(broken.deepcleft)}; 1`);
      try { return trace(run, s, a, f, 0) !== trace(R0, s, a, f, 0); } finally { run('BATTLE_ANIM.veyr=globalThis.__sv1; BATTLE_ANIM.deepcleft=globalThis.__sv2; 1'); } }));
  const plain = fights.filter(([a, f, s]) => trace(run, s, a, f, null) !== trace(R0, s, a, f, null)).length;
  ck('CONTROL: the rule control is real - BASE with and without the crit-clip rule differ at their real crit (the roll moved in the RNG stream)',
    fights.some(([a, f, s]) => trace(R0, s, a, f, null) !== withRule(R0, () => trace(R0, s, a, f, null))));
  console.log('  info at their real crit vs plain BASE: ' + plain + ' of ' + fights.length + ' fights differ - the v532 crit-clip rule rolls their crit at the wind-up now that they have a crit clip (same chance, earlier in the RNG stream)');

  // 3. the art lands on those moments. THE SWING IS FITTED (v410): the swing hold is min(0.95 x the swing, the clip) = 1.71 s at x1, shorter than the
  //    2.0 s clip, so the render holds cell 0 while attackAnim runs, then plays the 48 cells over the hold (real time).
  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE');
  const sweep = (h, crit, haste) => JSON.parse(run(`(()=>{ units=[]; ended=false; battleTime=0; seedBattle(7); const g=makeUnit('${h}','ally',500,700,30,{owned:false,rank:3}), e=makeUnit('vael','enemy',540,700,30,{owned:false});
    g.anim=BATTLE_ANIM.${h}; e.anim=null; g.glyphCrit=0; units=[g,e]; e.maxHp=e.hp=1e9; e.speed=0; e.atkCd=99; g.target=e; g.greenCd=g.blueCd=99; ${crit ? "g._gearNextCrit='hit';" : ''} g.atkCd=0;
    const out=[]; let cur=null; const _dd=dealDamage; dealDamage=function(s,t,a,c,k){ if(s===g&&cur&&cur.hit==null){ cur.hit=battleTime; out.push(cur); cur=null; } return _dd.apply(this,arguments); };
    try{ for(let i=0;i<400&&out.length<2;i++){ ${haste ? 'g.hasteMul=' + haste + '; g.hasteT=1;' : ''} const a0=g.attackAnim||0; updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.energy=0;
        if(!cur&&(g.attackAnim||0)>a0+1e-9) cur={st:battleTime,clip:g._atkClip||'attack',mul:g._atkSpdMul,ai:(g._atkI0||g.atkInterval)/g._atkSpdMul,free:null};
        else if(cur&&cur.free==null&&!((g.attackAnim||0)>0)) cur.free=battleTime; } } finally{ dealDamage=_dd; }
    return JSON.stringify(out); })()`));
  const drawn = (w, A) => { const D = dur(A) / w.mul, ah = Math.min(0.95 * w.ai, D), fit = D > ah && D <= ah * 1.6;
    return fit ? (w.hit - w.free) / CLK / ah * A.n : (w.hit - w.st) / CLK * A.fps * w.mul; };
  const FR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/veyr_deepcleft_1160_frames.json'), 'utf8'));
  for (const h of HEROES) for (const hs of [0, 1.25, 0.8]) {
    const ws = sweep(h, false, hs).slice(0, 1).concat(sweep(h, true, hs).slice(0, 1));
    for (const w of ws) { const A = G[h][w.clip], d = drawn(w, A), src = NEW.find(x => x[0] === h && x[1] === w.clip);
      const ok = hs ? Math.abs(Math.floor(d) - A.contact) <= 2 : Math.floor(d) === A.contact;
      ck(`${h} ${w.clip} (attack speed x${w.mul.toFixed(2)}): the blow is drawn on cell ${d.toFixed(2)} - ${hs ? 'within two cells of the contact ' + A.contact + ' (the reach held, cells 25-29)' : 'the contact cell ' + A.contact + ' (source f' + src[5] + ')'}`,
        ok && run(`clipContactCell(BATTLE_ANIM.${h}.${w.clip})`) === A.contact, JSON.stringify(w) + ' ' + d.toFixed(2)); }
    ck(`${h} at x${hs || 1}: a plain swing plays the attack sheet, a crit the crit sheet`, ws.length === 2 && ws[0].clip === 'attack' && ws[1].clip === 'crit', JSON.stringify(ws.map(x => x.clip)));
  }
  ck('frame maps (tests/fixtures/veyr_deepcleft_1160_frames.json): one source frame per cell, the contact cell on its named source frame, and the swings\' reach held on cells 26-28 (three consecutive frames round the contact)',
    NEW.every(([h, s, n, , c, f]) => FR[h][s].length === n && (c == null || FR[h][s][c] === f)) &&
    HEROES.every(h => ['attack', 'crit'].every(s => { const f = FR[h][s], c = NEW.find(x => x[0] === h && x[1] === s)[5]; return f[26] === c - 1 && f[27] === c && f[28] === c + 1; })));
  const what = { 'veyr.green': 'the crescent cut on the release', 'veyr.blue': 'the mantle closed round him on the release (the evade starts)', 'veyr.ult': 'his arm out where the deep opens, on the release',
    'deepcleft.green': 'both claws ripping the ground on the release', 'deepcleft.blue': 'dug in on the release (untargetable from then)', 'deepcleft.ult': 'the slam that buries them, when the form delivery lands' };
  for (const [h, s, , fps, c, f] of NEW.filter(x => ['green', 'blue', 'ult'].includes(x[1]))) {
    const x = casts[h + '.' + s], t = (h === 'deepcleft' && s === 'ult') ? +x.dm[0].split('@')[1] : x.fired, d = t / CLK * fps;
    ck(`${h} ${s}: ${what[h + '.' + s]} at ${t} fight s = ${(t / CLK).toFixed(3)} real s is drawn on cell ${c} (source f${f}) - ${d.toFixed(2)}`,
      Math.floor(d) === c && d - c > 0.15 && run(`clipContactCell(BATTLE_ANIM.${h}.${s})`) === c, d.toFixed(2));
  }
  { const land = +casts['veyr.ult'].dm[0].split('@')[1], bg = +casts['deepcleft.blue'].dm[0].split('@')[1];
    console.log('  info Veyr ult: the Undertow collapses (damage + 2 s slow) at ' + land + ' fight s = ' + (land / CLK).toFixed(3) + ' real s, after the 2.0 s clip - the veyrundertow plate carries it (its crash cell on that moment)');
    console.log('  info Deepcleft blue: his emerge strike lands at ' + bg + ' fight s = ' + (bg / CLK).toFixed(3) + ' real s, 0.89 s after the 2.0 s clip (Burrow Guard 1.4 s from the release - an engine number; the clip shows him burrowed and emerging on its last cells)'); }

  // 4. Veyr's spell FX (display only): sheets, their timing on the engine's moments, the hooks
  const FXD = JSON.parse(run("JSON.stringify({c:FX2_DEF.veyrcrescent,m:FX2_DEF.veyrmantle,u:FX2_DEF.veyrundertow,FX_RT})"));
  { const b2 = [];
    for (const [k, d] of [['veyrcrescent', FXD.c], ['veyrmantle', FXD.m], ['veyrundertow', FXD.u]]) { if (!d) { b2.push(k + ' missing'); continue; }
      const f = fileOf(d.u), sz = fs.existsSync(f) && webpSize(f), ch = fs.existsSync(f) ? chunks(fs.readFileSync(f)) : [];
      if (!/_1160\.webp\?v=1160$/.test(d.u) || baseSrc.includes(path.basename(f))) b2.push(k + ' not a new ?v=1160 file');
      if (!sz || sz[0] !== d.fw * d.cols || sz[1] !== d.fh * d.rows || d.n > d.cols * d.rows) b2.push(k + ' file ' + sz + ' != grid');
      if (d.fw * d.cols > 2048 || d.fh * d.rows > 2048 || fs.statSync(f).size > 4e6) b2.push(k + ' over 2048 px / 4 MB');
      if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) b2.push(k + ' not q95 lossy + alpha');
      if (!d.rt) b2.push(k + ' not real time'); }
    ck('Veyr FX sheets: veyrcrescent / veyrmantle / veyrundertow are new ?v=1160 files, file = grid, within 2048 px / 4 MB, q95 + alpha, real time', b2.length === 0, b2.join('; ')); }
  const kv = JSON.parse(run('JSON.stringify(KITS.veyr)')), UD = JSON.parse(run('JSON.stringify(ULT_DEF.eventhorizon)'));
  ck(`Gravity Crescent: its life (dur x FX_RT = ${(FXD.c.dur * FXD.FX_RT).toFixed(3)} fight s) is the status (kit dur ${kv.green.dur} s), its flight a beat (${FXD.c.fly} fight s)`, Math.abs(FXD.c.dur * FXD.FX_RT - kv.green.dur) < 0.01 && FXD.c.fly < 0.2);
  ck(`Abyssal Mantle: the swirl plays over the evade (${(FXD.m.dur * FXD.FX_RT).toFixed(3)} fight s = kit dur ${kv.blue.dur}), started at the release with the evade itself`, Math.abs(FXD.m.dur * FXD.FX_RT - kv.blue.dur) < 0.005);
  { const tc = (UD.pull || 1.2) * +run('BATTLE_PACE'), hz = casts['veyr.ult'].hz, land = +casts['veyr.ult'].dm[0].split('@')[1], fired = casts['veyr.ult'].fired;
    ck(`Abyssal Undertow: the foam crash (cell ${FXD.u.crash}) is timed onto the collapse - the plate's clock (pull x BATTLE_PACE = ${tc.toFixed(4)} fight s from the release) is the engine's own collapse timer (${hz}), and the damage lands that far after the release (${(land - fired).toFixed(4)})`,
      hz != null && Math.abs(tc - hz) < 1e-6 && Math.abs((land - fired) - tc) <= +run('SIM_STEP') + 1e-6 && FXD.u.crash < FXD.u.n && FXD.u.disc && FXD.u.disc.dw > 0.9); }
  const src = fs.readFileSync(HTML, 'utf8');
  ck('hooks: abilArt draws the mantle and the undertow from their ownFx (the undertow on the case\'s own clamp of the aim), the tendrilpull case draws the crescent on the enemy it drags',
    /else if\(o\.ownFx==='mantle'\)\{ try\{ veyrMantleFx\(u,o\.dur\|\|2\.4\); \}catch\(_e\)\{\} \}/.test(src) && /veyrUndertowFx\(Math\.max\(60,Math\.min\(FW-60,c\.x\)\),Math\.max\(80,Math\.min\(FD-60,c\.y\)\)/.test(src) &&
    /if\(o\.ownFx==='crescent'\)\{ try\{ veyrCrescentFx\(u,tg2\); \}catch\(_e\)\{\} \}/.test(src));
  { const L = JSON.parse(run(`(()=>{ clearFx1123(); units=[]; const v=makeUnit('veyr','ally',500,700,30,{owned:false,rank:3}), e=makeUnit('vael','enemy',540,700,30,{owned:false}); units=[v,e]; v._evadeT=2.4;
      const snap=()=>JSON.stringify(units.map(u=>[u.x,u.y,u.hp,u.alive,u._evadeT,u.stunned||0,u.slow||0,u.energy||0])); v._evadeT=2.4; const s0=snap();
      veyrCrescentFx(v,e); veyrMantleFx(v,2.4); veyrUndertowFx(600,700,7*METER,0.984); const n0=_fx1123.length, life=[];
      for(let i=0;i<Math.round(8/SIM_STEP);i++){ if(i===Math.round(1/SIM_STEP)) v._evadeT=0; updateFx1123(SIM_STEP); life.push(_fx1123.map(o=>o.kind).join(',')); }
      v._evadeT=2.4; const s1=snap();
      return JSON.stringify({n0,s0,s1,end:_fx1123.length,at:life.map((x,i)=>[+((i+1)*SIM_STEP).toFixed(3),x]).filter((x,i,a)=>i===0||x[1]!==a[i-1][1])}); })()`));
    const t = k => (L.at.find(x => !x[1].includes(k)) || [null])[0];
    ck('the three plates run on their own and end on their own, touching no unit: the crescent gone at ' + t('vcres') + ' fight s (life 1.2), the mantle folds when the evade is spent (spent at 1.0 here, gone at ' + t('vmantle') + '), the undertow drained at ' + t('vund') + ' (crash 0.98 + the 2.08 real-s drain)',
      L.n0 === 3 && L.s0 === L.s1 && L.end === 0 && Math.abs(t('vcres') - 1.2) < 0.06 && t('vmantle') > 1.0 && t('vmantle') < 1.35 && t('vund') > 2.2 && t('vund') < 2.6, JSON.stringify(L)); }
  ck('FX textures warm with his figure (FX1123_WARM.veyr)', run("JSON.stringify(FX1123_WARM.veyr)") === '["veyrcrescent","veyrmantle","veyrundertow"]' && run("FX1115_WARM.veyr===undefined") === true);

  // sound: the rows sit on those moments
  const SD = JSON.parse(run('JSON.stringify({v:SFX_DATA.heroes.veyr,d:SFX_DATA.heroes.deepcleft})')), SD0 = JSON.parse(R0('JSON.stringify({v:SFX_DATA.heroes.veyr,d:SFX_DATA.heroes.deepcleft})'));
  const on = (x, slot, id) => (x[slot] || []).find(e => e.id === id).on;
  ck('sound: Veyr S0207 / S0209 / S0211 on their releases (contacts 18 / 18 / 29), S0213 on the collapse (land); Deepcleft S0265 / S0266 on the release (contact 18), S0268 on the form landing (land = contact 37) - BASE played S0207 S0209 S0211 S0266 S0268 from the press; the files are unchanged',
    on(SD.v, 'green', 'S0207') === 'release' && on(SD.v, 'blue', 'S0209') === 'release' && on(SD.v, 'ult', 'S0211') === 'release' && on(SD.v, 'ult', 'S0213') === 'land' &&
    on(SD.d, 'green', 'S0265') === 'release' && on(SD.d, 'blue', 'S0266') === 'release' && on(SD.d, 'ult', 'S0268') === 'land' &&
    ['S0207', 'S0209', 'S0211'].every(i => on(SD0.v, i === 'S0207' ? 'green' : i === 'S0209' ? 'blue' : 'ult', i) === 'cast') && on(SD0.d, 'blue', 'S0266') === 'cast' && on(SD0.d, 'ult', 'S0268') === 'cast' &&
    JSON.stringify([SD.v.atk, SD.d.atk, SD.v.green[0].f, SD.v.blue[0].f, SD.d.blue[0].f, SD.d.ult[0].f]) === JSON.stringify([SD0.v.atk, SD0.d.atk, SD0.v.green[0].f, SD0.v.blue[0].f, SD0.d.blue[0].f, SD0.d.ult[0].f]));
  { const others2 = r => r("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='veyr'&&k!=='deepcleft').map(k=>[k,SFX_DATA.heroes[k]]))");
    ck('sound: every other hero\'s rows and every file entry are BASE\'s', H(others2(run)) === H(others2(R0)) && H(sfxFilesV1165(run, run)) === H(sfxFilesV1165(R0, run))); }
  // v1160 sound + music (Phil 16 Oct, held from v1159): weapon strikes 15% quieter; the 6th battle song and the 6th map song
  ck('weapon strikes 15% quieter: SFX_ATK_GAIN 0.85 on every sfxPlay with the atk flag (sfxAtk sets it for every swing, crit and Aureth\'s ARM cuts), 1 for everything else; BASE played all at 1',
    run('SFX_ATK_GAIN') === 0.85 && /g\.gain\.value=o\.atk\?SFX_ATK_GAIN:1;/.test(src) && /sfxQ\(nm,T,\{key:u\.key,atk:1,u,swing:1,log:rec,rate,jdb\}\)/.test(src) && /g\.gain\.value=1; src\.connect\(g\)/.test(baseSrc) && !/SFX_ATK_GAIN/.test(baseSrc));
  { const M = JSON.parse(run('JSON.stringify(MUSIC_LISTS)')), M0 = JSON.parse(R0('JSON.stringify(MUSIC_LISTS)'));
    const NEWB = ['battle-epic-fight', 'battle-warrior-fight', 'battle-war-preparations', 'battle-the-mountain', 'battle-the-bale-begins'], nb = NEWB.map(n => M.battle.find(x => x.f.indexOf('music/' + n + '.mp3?v=1160') === 0));
    const fresh = [].concat(...Object.values(M)).filter(x => /\?v=1160$/.test(x.f));
    const fileOk = x => { const f = path.join(ROOT, 'assets/audio', x.f.split('?')[0]); return fs.existsSync(f) && fs.statSync(f).size > 5e5 && /^(494433|fffb|fff3)/.test(fs.readFileSync(f).slice(0, 3).toString('hex')) && !baseSrc.includes(x.f.split('?')[0]); };
    const whole = x => { const bar = 240 / x.bpm, k = (x.loopEnd - x.loopStart) / bar; return Math.abs(k - Math.round(k)) < 0.01 && Math.round(k) > 20; };
    const ends = [[0, 90, 240 / 115], [1, 142.5, 3], [2, 257, 2], [3, 136, 2.83], [4, 150.8, 1.92]];
    ck('music: 10 songs in every list (city 7+3, map 5+1+4, battle 5+5, skyfall 5+5; Phil 16 Oct "download them" - his last downloads + kept suggestions): ' + fresh.length + ' new ?v=1160 files on disk, playlists from 0, every new battle loop a whole number of its bars ending on the bar line before the song end (Epic Fight 90 s, Warrior Fight 142.5, War Preparations 257, the_mountain 136, The Bale Begins 150.8); every v1159 song unchanged',
      ['city', 'map', 'battle', 'skyfall'].every(k => M[k].length === 10) && fresh.length === 18 && fresh.every(fileOk) && fresh.filter(x => !x.bpm).every(x => x.start === 0 && x.end > 100) &&
      nb.every(x => x && whole(x)) && ends.every(([k, e, b]) => nb[k].loopEnd < e && nb[k].loopEnd > e - b) &&
      JSON.stringify(Object.fromEntries(Object.entries(M).map(([k, v]) => [k, v.filter(x => !/\?v=1160$/.test(x.f))]))) === JSON.stringify(M0), JSON.stringify({ nb }));
    /* ACTION START (Phil 16 Oct, "only pick up where the action actually starts" - a standing rule for every battle song): the 4 bars a fight first hears
       are within 3 dB of the song's own median loudness (0.5 s windows), and the bars before a later start are the quiet intro it skips */
    const PYM = ['import sys, json, subprocess', 'import numpy as np', 'out = []', 'for f, st, bpm in json.loads(sys.argv[1]):',
      "    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-'], capture_output=True).stdout, dtype=np.float32); SR = 22050",
      '    w = SR // 2; n = len(x) // w; r = 20 * np.log10(np.sqrt((x[:n * w].reshape(n, w) ** 2).mean(1)) + 1e-9); med = float(np.median(r)); bar = 240 / bpm',
      '    db = lambda a, b: float(20 * np.log10(np.sqrt(np.mean(x[int(a * SR):int(b * SR)] ** 2)) + 1e-9))',
      '    out.append([round(med, 1), round(db(st, st + 4 * bar), 1), round(db(max(0, st - 4 * bar), st), 1) if st > 1 else None])', 'print(json.dumps(out))'].join('\n');
    const pyf = path.join(require('os').tmpdir(), 'ew-vd1160-music.py'); fs.writeFileSync(pyf, PYM);
    const B = M.battle.map(x => [path.join(ROOT, 'assets/audio', x.f.split('?')[0]), x.start, x.bpm]).concat([[path.join(ROOT, 'assets/audio/music/battle-warrior-fight.mp3'), 0, 80]]);   /* + CONTROL: Warrior Fight from 0 (its quiet intro) */
    const E = JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', pyf, JSON.stringify(B)], { maxBuffer: 1 << 24 }).toString());
    const rep = M.battle.map((x, i) => x.name + ' start ' + x.start + ' s: first 4 bars ' + E[i][1] + ' dB vs median ' + E[i][0] + (E[i][2] != null ? ', the 4 bars it skips ' + E[i][2] : ''));
    const Ec = E.pop(); ck('CONTROL: Warrior Fight played from 0 s (its intro: first 4 bars ' + Ec[1] + ' dB vs median ' + Ec[0] + ') fails the action-start rule', !(Ec[1] >= Ec[0] - 3));
    ck('battle songs start where the action starts: ' + rep.join('; '), E.every(([med, first, skipped]) => first >= med - 3 && (skipped == null || skipped < first - 1.5)), rep.join(' | '));
    console.log('  info ' + rep.join('\n  info ')); }
  const ctl = JSON.parse(JSON.stringify(G)); ctl.veyr.crit.u = '/assets/anim/veyr/veyr_missing.webp?v=1160'; ctl.deepcleft.attack.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, [['veyr', 'crit'], ['deepcleft', 'attack']]).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
