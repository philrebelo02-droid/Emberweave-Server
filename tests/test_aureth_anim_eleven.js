'use strict';
// v1153 - Aureth's eleven new animations (Phil PASS 15 Oct 2026 "aureth pass", REVIEW 15OCT2026 H3, clean-source-manifest.json - all eleven
//   "Phil PASS", official Hailuo Without Watermark exports, sha256 matched): IDLE, WALK (three-quarter, in place), ATTACK LIGHT (gold sword, creation
//   567200030093381636), ATTACK DARK (dark sword, creation 567201857568399368), CRIT (the both-swords X slice), HIT, GREEN Sunburst, BLUE Duality,
//   ULT Eclipse, PASSIVE DARK CROWN, PASSIVE BRIGHT CROWN. They fill the v1150 slots: his autos alternate attackLight / attackDark (tests/test_aureth_1150.js),
//   `attack` IS the light swing (the same object - one sheet, one texture), a crit plays the X slice.
// TWO CROWNS: Twin Fonts (his passive) has two states - Dark stance (drains the nearest foe) and Light stance (regenerates) - flipped by Duality (or,
//   without Duality, by Twin Fonts' own 5 s turn). It fires no clip (firePassiveFx only), so his passive clip is the resting flourish (v522 idle
//   filler); syncMesh now draws the DARK CROWN while he is in Dark stance and the BRIGHT CROWN in Light stance (the default). Render only.
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND (as tests/test_carn_anim_eight.js):
//   1. the timing DATA the engine reads is unchanged: every action clip keeps clipDur 2.0 s and relFrac 0.5, the hit keeps its 0.6 s hold;
//   2. CONTROL against the live build (git show BASE = v1152): scripted swings, casts and whole fights through server/sim-host.js land every blow and
//      effect on the same tick with the same numbers;
//   3. each clip's `contact` cell is the cell drawn when the engine lands it, re-derived here from the engine's own blow / release / landing tick
//      (clips play in real time; the fight clock is SIM_STEP*SIM_HZ*BATTLE_PACE = 0.6724 of it).
// The v532 CRIT-CLIP RULE (engine code, unchanged): a hero WITH a crit clip rolls a swing's crit at the WIND-UP (same chance). Aureth had none, so his
// roll now happens earlier in the battle RNG stream: with his crit at 0 the fights are identical to BASE; with his real crit they are identical to BASE
// given a crit clip of the OLD attack timing (BASE + the rule) - the art itself moves nothing.
// SOUND (v1138): Sunburst (S0051) now peaks on the burst when the form delivery lands (rule land = green contact 47), Duality (S0053) and Eclipse
// (S0054) on their cast releases (rule release = blue contact 18 / ult contact 42); both swings play his blade sound on their own blow (the fuse).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '34ce183a';   // live v1152, before this change
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-aureth-anim-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
const R0 = OLD ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
function webpSize(file) {
  const b = fs.readFileSync(file); const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return null;
}
// the eleven clips: [state, file stem, cells, fps, contact cell (null = none), source frame on it]
const NEW = [['idle', 'idle', 62, 12, null], ['walk', 'walk', 53, 24, null], ['attackLight', 'attack_light', 48, 24, 27, 23], ['attackDark', 'attack_dark', 48, 24, 27, 29],
             ['crit', 'crit', 48, 24, 27, 38], ['hit', 'hit', 20, 30, null], ['green', 'green', 48, 24, 47, 58], ['blue', 'blue', 48, 24, 18, 48], ['ult', 'ult', 48, 24, 42, 45],
             ['passive', 'passive_bright', 26, 24, null], ['passiveDark', 'passive_dark', 26, 24, null]];
const ACT = ['attackLight', 'attackDark', 'crit', 'green', 'blue', 'ult'];
function gridProblems(G, states) {
  const bad = [];
  for (const st of states) { const A = G[st]; if (!A) { bad.push(st + ' missing entry'); continue; }
    const f = path.join(ROOT, A.u.split('?')[0]);
    if (!fs.existsSync(f)) { bad.push(st + ' missing file'); continue; }
    const sz = webpSize(f);
    if (A.n > A.cols * A.rows) bad.push(st + ' n>grid');
    if (A.fw * A.cols > 2048 || A.fh * A.rows > 2048) bad.push(st + ' >2048 (the v1140 phone budget)');
    if (fs.statSync(f).size > 4e6) bad.push(st + ' file > 4 MB');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top >= 0 && A.top < A.feet)) bad.push(st + ' anchor outside cell'); }
  return bad;
}
// scripted swings: Aureth vs a still dummy, every blow [tick time, amount, crit, clip]
const SWING = (kind, crit, haste) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('aureth','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false});
  g.anim=BATTLE_ANIM.aureth; e.anim=null; g.glyphCrit=${crit};
  units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; e.greenCd=e.blueCd=99;
  const hits=[], _dd=dealDamage;
  dealDamage=function(s,t,amt,c,k){ if(s===g){ const r=_dd.apply(this,arguments); hits.push([+battleTime.toFixed(4),Math.round(amt),t._critHit?1:0,g._atkClip||'attack',k||null]); t._critHit=false; return r; } return _dd.apply(this,arguments); };
  try{
    if('${kind}'==='crit') g._gearNextCrit='hit';
    g.atkCd=0;
    for(let i=0;i<Math.round(12/SIM_STEP);i++){ ${haste ? 'g.hasteMul=' + haste + '; g.hasteT=1;' : ''} updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; e.energy=0; g.energy=0; if('${kind}'==='crit'&&hits.length===0&&battleTime>3) break; }
    return JSON.stringify(hits.filter(h=>h[4]==='split'));
  } finally { dealDamage=_dd; } })()`;
// green / blue / ult through castKit / castAbility: cast tick, clip hold, every effect tick, every hp/x/y for 6 s, and the stance
const CAST = kind => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
  const g=makeUnit('aureth','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false}); const e2=makeUnit('tick','enemy',560,740,30,{owned:false});
  g.anim=BATTLE_ANIM.aureth; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.hp=g.maxHp*0.5;
  const fx=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  g._castSM=1; g._castLv=1;
  try{
    if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS.aureth['${kind}']);
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let fired=null; let pend=!!g._pend;
    const tr=[]; for(let i=0;i<Math.round(6/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=0; e2.energy=0;
      if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4); if(g._pend) pend=true;
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),Math.round(u.shield||0)].join(':')).join('|')); }
    return JSON.stringify({hold,anim,fired,fx,dark:!!g._darkStance,trace:crypto_like(tr.join('#'))});
  } finally { doEffect=_de; } })()`;
const trace = (r, seed, a, f, crit) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      ${crit != null ? 'units.forEach(u=>{ if(u.key===\'aureth\') u.glyphCrit=' + crit + '; });' : ''}
      let pc=0; const _fp=firePassiveClip; firePassiveClip=function(o){ if(o&&o.key==='aureth') pc++; return _fp.apply(this,arguments); };
      const tr=[]; try{ for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); } } finally{ firePassiveClip=_fp; }
      globalThis.__pc=(globalThis.__pc||0)+pc; return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
const withRule = (r, fn) => {   // BASE + the v532 rule: give BASE's Aureth a crit clip with the OLD attack clip's timing (render data only)
  r('globalThis.__svA=BATTLE_ANIM.aureth; BATTLE_ANIM.aureth=Object.assign({},BATTLE_ANIM.aureth,{crit:Object.assign({},BATTLE_ANIM.aureth.attack)}); 1');
  try { return fn(); } finally { r('BATTLE_ANIM.aureth=globalThis.__svA; 1'); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));

try {
  ck('control file (BASE emberweave-heroes.html from git ' + BASE_SHA + ', live v1152) loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.aureth))'), G0 = R0('JSON.parse(JSON.stringify(BATTLE_ANIM.aureth))');
  ck('Aureth has the eleven states (+ `attack`); BASE had no attackLight / attackDark / crit / passiveDark', Object.keys(G).sort().join() === 'attack,attackDark,attackLight,blue,crit,green,hit,idle,passive,passiveDark,ult,walk' &&
    !G0.attackLight && !G0.attackDark && !G0.crit && !G0.passiveDark, Object.keys(G).join(','));
  ck('`attack` IS the light swing: the same object (one sheet, one texture, loaded and freed once)', run('BATTLE_ANIM.aureth.attack===BATTLE_ANIM.aureth.attackLight') === true);
  const bad = gridProblems(G, NEW.map(x => x[0]));
  ck('every new sheet exists, file = declared grid, within 2048 px per side and 4 MB (v1140 budget), anchors in the cell', bad.length === 0, bad.join('; '));
  const baseSrc = fs.readFileSync(OLD, 'utf8');
  ck('the eleven are new files at ?v=1153 that BASE never referenced (never a reused asset version)', NEW.every(([s, stem]) => G[s].u === `/assets/anim/aureth/aureth_${stem}_1153.webp?v=1153` && !baseSrc.includes(`aureth_${stem}_1153`)));
  ck('the old v21 sheets are still on disk (rollback needs nothing)', ['idle', 'walk', 'attack', 'hit', 'green', 'blue', 'ult', 'passive'].every(s => fs.existsSync(path.join(ROOT, G0[s].u.split('?')[0]))));
  const others = r => r("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='aureth').map(k=>[k,BATTLE_ANIM[k]]))");
  ck('every other hero and monster has BATTLE_ANIM byte-for-byte BASE', H(others(run)) === H(others(R0)));
  ck('grids as cut (cells / fps / contact cell): ' + NEW.map(x => x[0] + ' ' + x[2] + '@' + x[3] + (x[4] != null ? ' c' + x[4] : '')).join(', '),
    NEW.every(([s, , n, fps, c]) => G[s].n === n && G[s].fps === fps && (c == null ? G[s].contact == null : G[s].contact === c)));
  ck('the art faces RIGHT (flip:false), every state stands on its frame-0 pose (feet - top = figH, no ax drift table); only the two crowns rubberband (pingpong)',
    NEW.every(([s]) => G[s].flip === false && G[s].feet - G[s].top === G[s].figH && !G[s].ax && (!!G[s].pingpong === (s === 'passive' || s === 'passiveDark'))));
  ck('walk = one clean stride loop over the whole clip (loop [0,53], v1047)', JSON.stringify(G.walk.loop) === '[0,53]');
  ck('the two crowns have the same cells / fps / length (the idle filler fits either the same way)', G.passive.n === G.passiveDark.n && G.passive.fps === G.passiveDark.fps &&
    run('clipDur(BATTLE_ANIM.aureth.passive)===clipDur(BATTLE_ANIM.aureth.passiveDark)') === true);
  const K = JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(NEW.map(x => x[0]))}.map(s=>{ const c=BATTLE_ANIM.aureth[s]; return texSheetK(c.fw,c.fh,c.cols,c.rows,c.figH/c.fh); })); } finally{ window.__texPhone=null; } })()`));
  ck('phone: every new sheet uploads at its own size (texSheetK 1) and every figure is drawn from 160-240 px', K.every(k => k === 1) && NEW.every(([s]) => G[s].figH >= 160 && G[s].figH <= 240), JSON.stringify(K));

  // 1. timing DATA
  const dur = A => (A.pingpong ? 2 * A.n - 2 : A.n) / A.fps, rel = A => (A.relFrac != null ? A.relFrac : 0.5);
  ck('every action clip (light, dark, crit, green, blue, ult) keeps clipDur 2.0 s and relFrac 0.5 exactly as BASE\'s attack / green / blue / ult (48 @24, no hold)',
    ACT.every(s => Math.abs(dur(G[s]) - 2) < 1e-12 && rel(G[s]) === 0.5 && !G[s].hold) && ['attack', 'green', 'blue', 'ult'].every(s => Math.abs(dur(G0[s]) - 2) < 1e-12 && rel(G0[s]) === 0.5 && G0[s].hold == null),
    ACT.map(s => s + ' ' + dur(G[s])).join(' '));
  ck('the hit keeps its 0.6 s hold (min(0.6, clip) - 20 @30 = 0.667 s, BASE 48 @24 = 2.0 s)', Math.min(0.6, G.hit.n / G.hit.fps) === 0.6 && Math.min(0.6, G0.hit.n / G0.hit.fps) === 0.6);
  const kit = r => r('JSON.stringify([KITS.aureth,HERO_ULT_ART.aureth,HERO_TYPES.aureth,ABILITY_CAST.aureth||null,ULT_DEF.eclipse||null,FX2_DEF.aureth_ult,FX2_DEF.aureth_green,FX2_DEF.aureth_blue,FX2_DEF.aureth_passive||null])');
  ck('kit, ult art, hero stats, cast times, Eclipse and every Aureth FX plate identical to BASE', kit(run) === kit(R0));

  // 2. CONTROL: scripted swings, casts and whole fights on BASE
  const sw = (r, k, c, hs) => JSON.parse(r(SWING(k, c, hs)));
  const a0 = sw(run, 'attack', 0), b0 = sw(R0, 'attack', 0);
  ck('swings (crit 0): every blow on the same tick with the same number as BASE (' + a0.length + ' blows)', a0.length >= 5 && JSON.stringify(a0.map(x => x.slice(0, 3))) === JSON.stringify(b0.map(x => x.slice(0, 3))), JSON.stringify({ now: a0.slice(0, 4), base: b0.slice(0, 4) }));
  ck('the swings alternate their sheets LIGHT / DARK / LIGHT ... (BASE: the attack clip)', a0.every((x, i) => x[3] === (i % 2 ? 'attackDark' : 'attackLight')) && b0.every(x => x[3] === 'attack'), a0.map(x => x[3]).join(','));
  const a1 = sw(run, 'crit', 0), b1 = sw(R0, 'crit', 0);
  ck('forced crit (next-hit crit): the crit blow lands on the same tick, same amount, flagged crit, as BASE, and plays the X slice', a1.length > 0 && a1[0][2] === 1 && a1[0][3] === 'crit' &&
    JSON.stringify(a1.map(x => x.slice(0, 3))) === JSON.stringify(b1.map(x => x.slice(0, 3))), JSON.stringify({ now: a1.slice(0, 3), base: b1.slice(0, 3) }));
  const casts = {};
  for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(kind))), y = JSON.parse(R0(CAST(kind))); casts[kind] = x;
    ck(`${kind}: the cast fires on the same tick, the effect lands on the same ticks (${x.fx.join(' ')}), the clip is held as long (${x.hold} s) and every unit matches BASE for 6 s`,
      x.fired != null && x.anim === kind && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ now: x, base: y }));
  }
  ck('Duality turns the stance (Dark after one cast) - the state the crown follows', casts.blue.dark === true && casts.green.dark === false);
  const fights = [[['aureth', 'askel', 'vex'], ['aureth', 'vesper', 'grosk'], 11], [['aureth', 'pellucid'], ['rhukk', 'aureth', 'vael'], 222],
                  [['aureth', 'sloe', 'umbris'], ['askel', 'hurne', 'carn'], 5], [['gruel', 'aureth', 'tharl'], ['sorrel', 'hollow', 'calypsa'], 77]];
  run('globalThis.__pc=0; 1'); R0('globalThis.__pc=0; 1');
  ck('whole fights (autoUlt, Aureth on both sides, heroes carry BATTLE_ANIM as the server replay) with his crit at 0 are tick-for-tick identical to BASE',
    fights.every(([a, f, s]) => trace(run, s, a, f, 0) === trace(R0, s, a, f, 0)));
  ck('whole fights with his real crit are tick-for-tick identical to BASE + the v532 crit-clip rule (the art moves nothing)',
    fights.every(([a, f, s]) => trace(run, s, a, f, null) === withRule(R0, () => trace(R0, s, a, f, null))));
  ck('Twin Fonts never fires a passive clip in those fights (firePassiveClip 0 times for Aureth, either build) - his crowns are render-only filler',
    +run('globalThis.__pc') === 0 && +R0('globalThis.__pc') === 0);
  const broken = JSON.parse(JSON.stringify(G)); broken.attackLight.relFrac = 0.6; broken.crit.fps = 20; broken.ult.n = 40; broken.attack = broken.attackLight;
  ck('CONTROL: the same fights with the timing moved (light relFrac 0.6, crit 20 fps, ult 40 cells) diverge - the trace sees a timing change',
    fights.every(([a, f, s]) => { run(`globalThis.__svAa=BATTLE_ANIM.aureth; BATTLE_ANIM.aureth=${JSON.stringify(broken)}; 1`);
      try { return trace(run, s, a, f, 0) !== trace(R0, s, a, f, 0); } finally { run('BATTLE_ANIM.aureth=globalThis.__svAa; 1'); } }));
  ck('CONTROL: the rule control is real - BASE with and without the crit-clip rule differ at his real crit (the roll moved in the RNG stream)',
    fights.some(([a, f, s]) => trace(R0, s, a, f, null) !== withRule(R0, () => trace(R0, s, a, f, null))));
  const plain = fights.every(([a, f, s]) => trace(run, s, a, f, null) === trace(R0, s, a, f, null));
  console.log('  info Aureth at his real crit vs plain BASE: fights ' + (plain ? 'identical' : 'NOT identical') + ' - the v532 crit-clip rule rolls his crit at the wind-up now that he has a crit clip (same chance, earlier in the RNG stream)');
  { const bs = JSON.parse(JSON.stringify(G)); bs.green.n = 56; bs.attack = bs.attackLight;
    run(`globalThis.__svAa=BATTLE_ANIM.aureth; BATTLE_ANIM.aureth=${JSON.stringify(bs)}; 1`);
    let c; try { c = JSON.parse(run(CAST('green'))); } finally { run('BATTLE_ANIM.aureth=globalThis.__svAa; 1'); }
    ck('CONTROL: a green clip 0.33 s longer changes the skill hold the engine queues on (the cast check sees clip length)', c.hold !== casts.green.hold, String(c.hold)); }

  // 3. the art lands on those moments. HIS SWING IS FITTED (v410): the swing hold is min(0.95 x the swing, the clip) = 1.71 s at x1, shorter than the
  //    2.0 s clip, so the render holds cell 0 while attackAnim runs (until the tick it drops to 0), then plays the 48 cells over the hold (real time).
  //    The blow is drawn on cell (blow tick - attackAnim end) / CLK / hold x 48 - at x1, at x1.25 haste and slowed to x0.8. An unfitted clip
  //    (hold >= clip, or > 1.6x) would play at natural speed: (blow - start) / CLK x fps x speed. The rig (844x390 phone) measures the same cells.
  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE');
  const sweep = (crit, haste) => JSON.parse(run(`(()=>{ units=[]; ended=false; battleTime=0; seedBattle(7); const g=makeUnit('aureth','ally',500,700,30,{owned:false,rank:3}), e=makeUnit('vael','enemy',540,700,30,{owned:false});
    g.anim=BATTLE_ANIM.aureth; e.anim=null; g.glyphCrit=0; units=[g,e]; e.maxHp=e.hp=1e9; e.speed=0; e.atkCd=99; g.target=e; g.greenCd=g.blueCd=99; ${crit ? "g._gearNextCrit='hit';" : ''} g.atkCd=0;
    const out=[]; let cur=null; const _dd=dealDamage; dealDamage=function(s,t,a,c,k){ if(s===g&&k==='split'&&cur&&cur.hit==null){ cur.hit=battleTime; out.push(cur); cur=null; } return _dd.apply(this,arguments); };
    try{ for(let i=0;i<400&&out.length<2;i++){ ${haste ? 'g.hasteMul=' + haste + '; g.hasteT=1;' : ''} const a0=g.attackAnim||0; updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.energy=0;
        if(!cur&&(g.attackAnim||0)>a0+1e-9) cur={st:battleTime,clip:g._atkClip||'attack',mul:g._atkSpdMul,ai:(g._atkI0||g.atkInterval)/g._atkSpdMul,free:null};
        else if(cur&&cur.free==null&&!((g.attackAnim||0)>0)) cur.free=battleTime; } } finally{ dealDamage=_dd; }
    return JSON.stringify(out); })()`));
  const drawn = (w, A) => { const D = dur(A) / w.mul, ah = Math.min(0.95 * w.ai, D), fit = D > ah && D <= ah * 1.6;
    return fit ? (w.hit - w.free) / CLK / ah * A.n : (w.hit - w.st) / CLK * A.fps * w.mul; };
  for (const hs of [0, 1.25, 0.8]) {
    const two = sweep(false, hs), cr = sweep(true, hs)[0];
    for (const w of two.concat([cr])) { const A = G[w.clip], d = drawn(w, A), src = NEW.find(x => x[0] === w.clip);
      const ok = hs ? Math.abs(Math.floor(d) - A.contact) <= 2 : Math.floor(d) === A.contact;
      ck(`${w.clip} (attack speed x${w.mul.toFixed(2)}): the blow is drawn on cell ${d.toFixed(2)} - ${hs ? 'within two cells of the contact ' + A.contact + ' (the blade on its last sweep or at its held reach, cells 25-29)' : 'the contact cell ' + A.contact + ' (source f' + src[5] + ')'}`,
        ok && run(`clipContactCell(BATTLE_ANIM.aureth.${w.clip})`) === A.contact, JSON.stringify(w) + ' ' + d.toFixed(2)); }
    ck(`the two swings at x${hs || 1} are the light then the dark sheet, and the crit is the X slice`, two.length === 2 && two[0].clip === 'attackLight' && two[1].clip === 'attackDark' && cr.clip === 'crit', JSON.stringify(two.map(x => x.clip)));
  }
  { const R = ['attackLight', 'attackDark', 'crit'].map(s => [s, G[s].n, [26, 27, 28].map(c => NEW.find(x => x[0] === s))]);
    const SP = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/aureth_1153_frames.json'), 'utf8'));
    ck('the reach is held: cells 26-28 of each swing are three consecutive source frames around the contact frame (frame map tests/fixtures/aureth_1153_frames.json)',
      ['attackLight', 'attackDark', 'crit'].every(s => { const f = SP[s], c = NEW.find(x => x[0] === s)[5]; return f.length === 48 && f[27] === c && f[26] === c - 1 && f[28] === c + 1; })); }
  const at = { green: +casts.green.fx[casts.green.fx.length - 1].split('@')[1], blue: casts.blue.fired, ult: casts.ult.fired };
  const what = { green: 'the burst when the form delivery lands', blue: 'the stance swap on the cast release', ult: 'the eclipse bursting out on the cast release' };
  for (const [s, , , fps, c, f] of NEW.filter(x => ['green', 'blue', 'ult'].includes(x[0]))) {
    const t = at[s], d = t / CLK * fps;
    ck(`${s}: ${what[s]} at ${t} fight s = ${(t / CLK).toFixed(3)} real s is drawn on cell ${c} (source f${f}) - ${d.toFixed(2)}`,
      Math.floor(d) === c && d - c > 0.15 && run(`clipContactCell(BATTLE_ANIM.aureth.${s})`) === c, d.toFixed(2));
  }
  { const land = +casts.ult.fx[casts.ult.fx.length - 1].split('@')[1], d = land / CLK * G.ult.fps;
    console.log('  info ult: Eclipse\'s damage lands with the form delivery at ' + land + ' fight s = ' + (land / CLK).toFixed(3) + ' real s = cell ' + d.toFixed(1) + ' of a 48-cell 2.0 s clip - after the clip (its hold is the clip, an engine number); the aureth_ult plate carries the landing, the body shows the release (cell 42) and the full ring on its last cells'); }
  // the two crowns (render only): syncMesh picks the stance's crown for the passive state; BASE had one crown
  const src = fs.readFileSync(HTML, 'utf8');
  ck('render: the passive state draws the DARK crown in Dark stance, the BRIGHT crown (passive) otherwise - one line in syncMesh, after the clip is resolved',
    (src.match(/if\(st==='passive' && u\._darkStance && u\.anim\.passiveDark\) A=u\.anim\.passiveDark;/g) || []).length === 1 && src.indexOf("let A=u.anim[st]||u.anim.idle;") < src.indexOf("A=u.anim.passiveDark;") && !baseSrc.includes('passiveDark'));
  { const pick = (dark) => run(`(()=>{ const u={anim:BATTLE_ANIM.aureth,_darkStance:${dark}}; const st='passive'; let A=u.anim[st]||u.anim.idle; if(st==='passive' && u._darkStance && u.anim.passiveDark) A=u.anim.passiveDark; return A.u; })()`);
    ck('the crown rule on its own: Dark stance -> the dark crown sheet, Light stance -> the bright crown sheet', /passive_dark_1153/.test(pick(true)) && /passive_bright_1153/.test(pick(false))); }
  // sound: the rows sit on those moments
  const SD = JSON.parse(run('JSON.stringify(SFX_DATA.heroes.aureth)')), SD0 = JSON.parse(R0('JSON.stringify(SFX_DATA.heroes.aureth)'));
  ck('sound: Sunburst (S0051) peaks on the form landing (land = green contact 47), Duality (S0053) and Eclipse (S0054) on the cast release (release = contacts 18 / 42), both swings on the blow (BLADE-LIGHT, the fuse) - BASE played all three from the press',
    SD.green[0].id === 'S0051' && SD.green[0].on === 'land' && SD.blue[0].id === 'S0053' && SD.blue[0].on === 'release' && SD.ult[0].id === 'S0054' && SD.ult[0].on === 'release' && SD.atk === 'LIB-ATK-BLADE-LIGHT' &&
    SD0.green[0].on === 'cast' && SD0.blue[0].on === 'cast' && SD0.ult[0].on === 'cast');
  { /* v1156 (Phil 15 Oct): the swings are not swords - per-swing sounds by clip (tests/test_combat_sfx_1138.js hears them in a fight, peak on each blow) */
    const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8')), A = SD.arm || {}, F = n => MAN.files[n];
    ck('sound (v1156): the light swing ATK-AURETH-LIGHT (pack 120.0), the dark swing ATK-AURETH-DARK (pack 218.1) - two different files - and the X slice both layered (ATK-AURETH-XSLICE); each <= 1.0 s at the blade loudness, the file on disk',
      A.attackLight === 'ATK-AURETH-LIGHT' && A.attackDark === 'ATK-AURETH-DARK' && A.crit === 'ATK-AURETH-XSLICE' && new Set(Object.values(A)).size === 3 &&
      Object.values(A).every(n => F(n) && F(n).dur <= 1.0 && F(n).target === F('LIB-ATK-BLADE-LIGHT').target && fs.existsSync(path.join(ROOT, 'assets/audio', F(n).f.split('?')[0]))) &&
      run("(()=>{ const H=SFX_DATA.heroes.aureth; return sfxFiles(H).indexOf('ATK-AURETH-DARK')>=0 && sfxFiles(SFX_DATA.heroes.carn).every(n=>!/AURETH/.test(n)); })()") === true, JSON.stringify(A)); }
  const ctl = JSON.parse(JSON.stringify(G)); ctl.crit.u = '/assets/anim/aureth/aureth_missing.webp?v=1153'; ctl.attackDark.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, ['crit', 'attackDark']).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
