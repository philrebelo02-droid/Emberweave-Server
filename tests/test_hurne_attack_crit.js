'use strict';
// v1132 - Hurne's swapped ATTACK + CRIT (Phil 12 Oct 2026: "make this his attack and the attack his crit"):
//   ChatGPT handoff HURNE-SWAPPED-ATTACK-CRIT-12OCT2026 (approved-two-manifest.json, all four sha256 matched). The roles are SWAPPED against the
//   historical file names: ATTACK = the opposite-arm across-body HAYMAKER (creation 566052885444886537, historically "crit-redo1"), CRIT = the
//   straight PUNCH (565881319327145990, historically "attack-redo2") - his first crit clip. Every other state, the kit and his FX are untouched.
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND. Checked two ways:
//   1. the timing DATA the engine reads is unchanged: attack/crit clipDur = 2.0 clip s and clipDur x relFrac = 1.0 clip s (the old 48 @24 x 0.5);
//   2. CONTROL against the pre-change file (git show BASE): the same scripted swings and whole fights through server/sim-host.js (the file the
//      server replays with) land every blow, summon and ult on the same tick with the same numbers.
// The v532 CRIT-CLIP RULE (engine code, unchanged): a hero WITH a crit clip rolls a swing's crit at the WIND-UP (same chance) so the crit clip
// plays from its first frame. Hurne is a Bruiser (class crit 3%), so his roll now happens earlier in the battle RNG stream. Shown here:
//   - with his crit chance at 0 the fights are identical to BASE;
//   - with his real 3% the fights are identical to BASE given a crit clip of the OLD timing (BASE + the rule) - the art itself moves nothing;
//   - against plain BASE with his 3% the result is printed as an info line (the RNG order changed; same probability).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const Q95 = require('./helpers/q95-1158.js');   // v1158: q95 sheets are checked as the v1157 lossless originals they were (tests/test_q95_1158.js checks the q95 files)
const HTML = process.env.EW_HTML || Q95.page(path.join(ROOT, 'emberweave-heroes.html'));
const BASE_SHA = process.env.EW_BASE || 'd2d97a09';   // main before this change (v1131)
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-hurne-base-control.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
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
function gridProblems(G) {
  const bad = [];
  for (const [st, A] of Object.entries(G)) {
    const f = Q95.file(ROOT, A.u);
    if (!fs.existsSync(f)) { bad.push(st + ' missing'); continue; }
    const sz = webpSize(f);
    if (A.n > A.cols * A.rows) bad.push(st + ' n>grid');
    if ((st === 'attack' || st === 'crit') && (A.fw * A.cols > 4096 || A.fh * A.rows > 4096)) bad.push(st + ' >4096');   // the new sheets; green/ult (v538, 4160 px tall) predate the cap and are untouched
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (A.feet != null && !(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top >= 0 && A.top < A.feet)) bad.push(st + ' anchor outside cell');
  }
  return bad;
}
// scripted swings against a dummy (same script on both files): every Hurne blow (tick, amount, crit flag)
const SWING = (kind, crit) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('hurne','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false});
  g.anim=BATTLE_ANIM.hurne; e.anim=null; g.glyphCrit=${crit};
  units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; e.greenCd=e.blueCd=99;
  const hits=[], _dd=dealDamage;
  dealDamage=function(s,t,amt,c){ if(s===g){ const r=_dd.apply(this,arguments); hits.push([+battleTime.toFixed(4),Math.round(amt),t._critHit?1:0]); t._critHit=false; return r; } return _dd.apply(this,arguments); };
  try{
    if('${kind}'==='crit') g._gearNextCrit='hit';
    g.atkCd=0;
    for(let i=0;i<Math.round(12/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; e.energy=0; g.energy=0; if('${kind}'==='crit'&&hits.length===0&&battleTime>3) break; }
    return JSON.stringify(hits);
  } finally { dealDamage=_dd; } })()`;
// green / blue / ult through castKit / castAbility: summons, the devour, every blow on the same tick
const CAST = kind => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
  const g=makeUnit('hurne','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',560,700,30,{owned:false});
  g.anim=BATTLE_ANIM.hurne; e.anim=null; g.glyphCrit=0;
  units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0; g.atkCd=99;
  g.target=e; g.greenCd=g.blueCd=99; e.greenCd=e.blueCd=99;
  g._castSM=1; g._castLv=1; castKit(g,g.greenAb); g._castSM=1; g._castLv=1; castKit(g,g.blueAb);
  if('${kind}'==='ult'){ g.energy=100; castAbility(g); }
  const tr=[]; for(let i=0;i<Math.round(6/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=0;
    tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
  return tr.join('#'); })()`;
// whole fights, autoUlt both sides: per-tick hp/x/y/alive of every unit. crit: null = as built, a number = Hurne's crit chance
const trace = (r, seed, a, f, crit) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));   /* as the server replay does: under _p2guard buildFigure attaches u.anim = BATTLE_ANIM[key] (strike timing reads it) */
      ${crit != null ?'units.forEach(u=>{ if(u.key===\'hurne\') u.glyphCrit=' + crit + '; });' : ''}
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
const withRule = (r, fn) => {   // BASE + the v532 rule: give BASE's Hurne a crit clip with the OLD attack clip's timing (render data only)
  r('globalThis.__svH=BATTLE_ANIM.hurne; BATTLE_ANIM.hurne=Object.assign({},BATTLE_ANIM.hurne,{crit:Object.assign({},BATTLE_ANIM.hurne.attack)}); 1');
  try { return fn(); } finally { r('BATTLE_ANIM.hurne=globalThis.__svH; 1'); } };

try {
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.hurne))');
  const G0 = R0 && R0('JSON.parse(JSON.stringify(BATTLE_ANIM.hurne))');
  const states = ['idle', 'walk', 'attack', 'crit', 'hit', 'green', 'blue', 'ult', 'passive'];
  ck('Hurne has his eight states + the new crit', states.every(s => G[s]) && Object.keys(G).length === 9, Object.keys(G).join(','));
  ck('BASE had no crit clip (this is his first)', G0 && !G0.crit);
  const bad = gridProblems(G);
  ck('every sheet exists, file = declared grid, anchors in cell; the new attack/crit fit 4096', bad.length === 0, bad.join('; '));
  ck('attack and crit are new files at ?v=1132 (never a reused asset version)', ['attack', 'crit'].every(s => G[s].u === '/assets/anim/hurne/hurne_' + s + '_1132.webp?v=1132'));
  ck('idle, walk, hit, green, blue, ult, passive are byte-for-byte the BASE entries', G0 && ['idle', 'walk', 'hit', 'green', 'blue', 'ult', 'passive'].every(s => JSON.stringify(G[s]) === JSON.stringify(G0[s])));
  ck('both face like his other states (flip:false) and are anchored on his standing pose (frame 0 of both sources: feet - top = figH = 541, no ax drift table)',
    ['attack', 'crit'].every(s => G[s].flip === false && G[s].feet - G[s].top === G[s].figH && G[s].figH === 541 && !G[s].ax));

  // 1. timing DATA
  const dur = A => A.n / A.fps, prod = A => dur(A) * (A.relFrac != null ? A.relFrac : 0.5);
  ck('swing blow: attack clipDur x relFrac = 1.0 clip s and clipDur 2.0 s (before: 48/24 x 0.5)', Math.abs(prod(G.attack) - 1) < 1e-12 && Math.abs(dur(G.attack) - 2) < 1e-12 && prod(G0.attack) === 1, prod(G.attack));
  ck('crit blow: crit clipDur x relFrac = 1.0 clip s and clipDur 2.0 s (= the attack clip it replaces)', Math.abs(prod(G.crit) - 1) < 1e-12 && Math.abs(dur(G.crit) - 2) < 1e-12, prod(G.crit));
  const kit = r => r('JSON.stringify([KITS.hurne,HERO_ULT_ART.hurne,ULT_DEF.devourpack||null,HERO_TYPES.hurne,ABILITY_CAST.hurne||null])');
  ck('Unchain the Dead / Call the Bone-Chanter / Packmaster / Feed Them numbers identical to BASE', R0 && kit(run) === kit(R0), kit(run));

  // 2. CONTROL: scripted actions on BASE
  ck('control file (BASE emberweave-heroes.html from git) loaded', !!R0, 'git show failed');
  const sw = (r, k, c) => JSON.parse(r(SWING(k, c)));
  const a0 = sw(run, 'attack', 0), b0 = R0 && sw(R0, 'attack', 0);
  ck('attack (crit 0): every blow on the same tick with the same number as BASE', b0 && JSON.stringify(a0) === JSON.stringify(b0) && a0.length >= 3, JSON.stringify({ now: a0, base: b0 }));
  const a1 = sw(run, 'crit', 0), b1 = R0 && sw(R0, 'crit', 0);
  ck('forced crit (Brawler-style next-hit crit): the crit blow lands on the same tick, same amount, flagged crit, as BASE', b1 && a1.length > 0 && a1[0][2] === 1 && JSON.stringify(a1) === JSON.stringify(b1), JSON.stringify({ now: a1, base: b1 }));
  const used = run(`(()=>{ units=[]; seedBattle(7); const g=makeUnit('hurne','ally',500,700,30,{owned:false,rank:3}), e=makeUnit('vael','enemy',540,700,30,{owned:false}); g.anim=BATTLE_ANIM.hurne; e.anim=null; units=[g,e];
    e.maxHp=e.hp=1e9; e.speed=0; e.atkCd=99; g.target=e; g.greenCd=g.blueCd=99; g._gearNextCrit='hit'; g.atkCd=0; updateBattle(SIM_STEP); const c=g._atkClip; g.atkCd=0; g.glyphCrit=0; for(let i=0;i<200&&g.atkCd>0.5;i++) updateBattle(SIM_STEP); g.atkCd=0; updateBattle(SIM_STEP); return c+'|'+g._atkClip; })()`);
  ck('the crit clip plays on a crit swing and the attack clip on a normal one (u._atkClip crit / null)', used === 'crit|null', used);
  for (const k of ['summons', 'ult']) {
    const a = run(CAST(k)), b = R0 && R0(CAST(k));
    ck(k === 'ult' ? 'Feed Them (after both summons): devour, heal and burst on the same ticks as BASE' : 'Unchain the Dead + Call the Bone-Chanter: the herd rises and fights on the same ticks as BASE', b && a === b && a.length > 100);
  }
  const fights = [[['hurne', 'askel', 'vex'], ['hurne', 'vesper', 'grosk'], 11], [['hurne', 'pellucid'], ['rhukk', 'hurne', 'vael'], 222], [['hurne', 'sloe', 'umbris'], ['askel', 'hurne', 'vex'], 5]];
  ck('whole fights (autoUlt, Hurne on both sides) with his crit at 0 are tick-for-tick identical to BASE',
    R0 && fights.every(([a, f, s]) => trace(run, s, a, f, 0) === trace(R0, s, a, f, 0)));
  ck('whole fights with his real crit (Bruiser 3%) are tick-for-tick identical to BASE + the v532 crit-clip rule (the art moves nothing)',
    R0 && fights.every(([a, f, s]) => trace(run, s, a, f, null) === withRule(R0, () => trace(R0, s, a, f, null))));
  const broken = JSON.parse(JSON.stringify(G)); broken.attack.relFrac = 0.6; broken.crit.fps = 16;
  ck('CONTROL: the same fights with the swing moved (relFrac 0.6) and the crit clip slowed (fps 16) diverge - the trace sees a timing change',
    R0 && fights.every(([a, f, s]) => { run(`globalThis.__svHu=BATTLE_ANIM.hurne; BATTLE_ANIM.hurne=${JSON.stringify(broken)}; 1`);
      try { return trace(run, s, a, f, 0) !== trace(R0, s, a, f, 0); } finally { run('BATTLE_ANIM.hurne=globalThis.__svHu; 1'); } }));
  ck('CONTROL: the rule control is real - BASE with and without the crit-clip rule differ at his 3% (the roll moved in the RNG stream)',
    R0 && fights.some(([a, f, s]) => trace(R0, s, a, f, null) !== withRule(R0, () => trace(R0, s, a, f, null))));
  const plain = fights.every(([a, f, s]) => trace(run, s, a, f, null) === trace(R0, s, a, f, null));
  console.log('  info Hurne at his real 3% crit vs plain BASE: fights ' + (plain ? 'identical' : 'NOT identical') + ' - the v532 crit-clip rule rolls his crit at the wind-up now that he has a crit clip (same chance, earlier in the RNG stream)');

  // 3. the art lands on those moments. His hold (min(0.95 x 2.5 s, 2.0 s) = the whole clip) means NO fit: the swing clip plays at its own fps in
  //    real time from the tick the swing starts (the fight clock is SIM_STEP*SIM_HZ*BATTLE_PACE = 0.6724 of real time). Rig-measured (844x390,
  //    frame by frame): the clip starts the tick the swing starts and the blow lands 31 ticks later with attack cell 26 / crit cell 22 on screen.
  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE'), ai = run("makeUnit('hurne','ally',0,0,30,{owned:false}).atkInterval");
  const sweep = kind => JSON.parse(run(`(()=>{ units=[]; ended=false; battleTime=0; seedBattle(7); const g=makeUnit('hurne','ally',500,700,30,{owned:false,rank:3}), e=makeUnit('vael','enemy',540,700,30,{owned:false});
    g.anim=BATTLE_ANIM.hurne; e.anim=null; g.glyphCrit=0; units=[g,e]; e.maxHp=e.hp=1e9; e.speed=0; e.atkCd=99; g.target=e; g.greenCd=g.blueCd=99; ${kind === 'crit' ? "g._gearNextCrit='hit';" : ''} g.atkCd=0;
    let st=null, hit=null; const _dd=dealDamage; dealDamage=function(s){ if(s===g&&hit==null) hit=battleTime; return _dd.apply(this,arguments); };
    try{ for(let i=0;i<120&&hit==null;i++){ updateBattle(SIM_STEP); if(st==null&&g.attackAnim>0) st=battleTime; } } finally{ dealDamage=_dd; }
    return JSON.stringify({st,hit,clip:g._atkClip||'attack'}); })()`));
  const at = sweep('attack'), cr = sweep('crit');
  ck('the whole clip is the hold (no fit): 0.95 x atkInterval >= clipDur for both', 0.95 * ai >= dur(G.attack) && 0.95 * ai >= dur(G.crit), ai);
  const drawn = (A, w) => (w.hit - w.st) / CLK * A.fps;   // real s since the clip started x its fps
  ck('swing: the blow is drawn on attack cell 26 (source f32, the fist at full across-body reach) - 31 ticks after the swing starts', at.clip === 'attack' && Math.floor(drawn(G.attack, at)) === 26 && G.attack.contact === 26 && run('clipContactCell(BATTLE_ANIM.hurne.attack)') === 26, JSON.stringify(at) + ' ' + drawn(G.attack, at).toFixed(2));
  ck('crit: the blow is drawn on crit cell 22 (source f38, the first full extension of the punch)', cr.clip === 'crit' && Math.floor(drawn(G.crit, cr)) === 22 && G.crit.contact === 22 && run('clipContactCell(BATTLE_ANIM.hurne.crit)') === 22, JSON.stringify(cr) + ' ' + drawn(G.crit, cr).toFixed(2));
  const ctl = JSON.parse(JSON.stringify(G)); ctl.crit.u = '/assets/anim/hurne/hurne_missing.webp?v=1132'; ctl.attack.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
