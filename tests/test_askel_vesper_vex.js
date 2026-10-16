'use strict';
// v1128 - Askel five + Vesper Puncture + Vex Razor Tempest (Phil 11 Oct 2026):
//   Askel Greatbrow: ChatGPT handoff ASKEL-APPROVED-FIVE-REMAKES-11OCT2026 ("send to claude") - ATTACK attack-redo3, CRIT crit-redo2 (his first
//   crit clip), GREEN green-redo1 Standard Crash, BLUE blue-redo2 Rallying Ground, ULT ult-redo3 March of the Greatbrow - wired as sheets.
//   Vesper ult Puncture: Grok s09 (a standing tear, opens on the cast, closes as the effect ends). Vex ult Razor Tempest: Grok s10 (crossing
//   slashes standing 40% along her wedge, from the cast) - replaces the static vex_ult.webp pinwheel.
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND. Checked two ways:
//   1. the timing DATA the engine reads is unchanged: attack/crit clipDur x relFrac = 1.0 clip s, ult root 2.0 s, kit / ult numbers untouched;
//   2. CONTROL against the pre-change file (git show BASE): the same scripted actions and whole fights through server/sim-host.js (the file
//      the server replays with) land every blow, shield, knock-aside, freeze and cleave on the same tick with the same numbers.
// And the art lands on those moments (clips play in real time; the fight clock is SIM_STEP*SIM_HZ*BATTLE_PACE = 0.6724 of it).
// Disclosed (v532 crit-clip rule, unchanged engine code): a hero WITH a crit clip rolls a swing's crit at the wind-up instead of on the blow.
// Askel is a Tank (class crit 0): with no crit glyph/buff nothing is rolled and fights are identical; with crit chance > 0 the same-probability
// roll moves earlier in the RNG stream - shown below as an informational line, not a check.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '994ebada';   // main before this change (v1127 skill hold, live on all five servers)
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-askel-base-control.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
require('./helpers/anim-slim-1155.js').undoSlim1155(run);   // v1155 slim: this release's checks see the v1153 entries (tests/test_anim_slim_1155.js checks the slim)
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
    const f = path.join(ROOT, A.u.split('?')[0]);
    if (!fs.existsSync(f)) { bad.push(st + ' missing'); continue; }
    const sz = webpSize(f);
    if (A.n > A.cols * A.rows) bad.push(st + ' n>grid');
    if (A.fw * A.cols > 4096 || A.fh * A.rows > 4096) bad.push(st + ' >4096');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (A.feet != null && !(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top >= 0 && A.top < A.feet)) bad.push(st + ' anchor outside cell');
  }
  return bad;
}
// one scripted Askel action against a dummy (same script on both files); records every Askel blow, the ally's shield, the dummy's position
const SCRIPT = (kind, ex) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('askel','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',${ex || 530},700,30,{owned:false}); const m=makeUnit('vael','enemy',${ex ? Math.round((500 + ex) / 2) : 560},712,30,{owned:false});
  const a=makeUnit('vael','ally',470,700,30,{owned:false});
  g.anim=BATTLE_ANIM.askel; [e,m,a].forEach(x=>{x.anim=null;});   /* as the headless replay attaches it (buildFigure _p2guard) */
  units=[g,e,m,a]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.atkInterval=(u===g)?u.atkInterval:99; u.atkCd=(u===g)?99:99; u.energy=0;}); [e,m,a].forEach(x=>{x.speed=0;});
  g.target=e; g.greenCd=g.blueCd=99; if('${kind}'==='green'||'${kind}'==='blue') g.speed=0; e.greenCd=e.blueCd=m.greenCd=m.blueCd=a.greenCd=a.blueCd=99;
  const hits=[], _dd=dealDamage, out={hits,shield:null,pos:null,dash:null,land:null,root:null,buff:null};
  dealDamage=function(s,t,amt,c){ if(s===g) hits.push([+battleTime.toFixed(4),Math.round(amt),t===e?'e':'m']); return _dd.apply(this,arguments); };
  try{
    if('${kind}'==='green'){ g._castSM=1; g._castLv=1; g.greenAb=Object.assign({},g.greenAb,{radius:10*METER}); castKit(g,g.greenAb); }   /* the shove carries the dummy past 3.2 m inside the tick; a wide test radius keeps it in (timing only) */
    else if('${kind}'==='blue'){ g._castSM=1; g._castLv=1; castKit(g,g.blueAb); }
    else if('${kind}'==='ult'){ g.energy=100; castAbility(g); out.root=g._ultRootT; }
    else if('${kind}'==='crit'){ g._gearNextCrit='hit'; g.atkCd=0; }
    else { g.atkCd=0; }
    for(let i=0;i<Math.round(4/SIM_STEP);i++){ if('${kind}'==='green'){ g.x=500; g.y=700; e.x=540; e.y=700; }
      updateBattle(SIM_STEP); if('${kind}'!=='attack'&&'${kind}'!=='crit') g.atkCd=99; g.greenCd=g.blueCd=99; e.energy=m.energy=a.energy=0; if('${kind}'!=='ult') g.energy=0;
      if('${kind}'==='green'){ g.x=500; g.y=700; e.x=540; e.y=700; }
      if(out.dash==null&&g._dash) out.dash=+battleTime.toFixed(4);
      if(out.land==null&&g._rushLandAt!=null) out.land=+g._rushLandAt.toFixed(4);
      if(out.shield==null&&(a.shield||0)>0) out.shield=[+battleTime.toFixed(4),Math.round(a.shield)];
      if(out.buff==null&&(a.hasteT||0)>0) out.buff=[+battleTime.toFixed(4),a.hasteMul,+(a.drMul||1).toFixed(4)]; }
    out.pos=[Math.round(m.x*10),Math.round(m.y*10),Math.round(g.x*10),Math.round(g.y*10)];
    return JSON.stringify(out);
  } finally { dealDamage=_dd; } })()`;
const act = (r, kind, ex) => JSON.parse(r(SCRIPT(kind, ex)));
// whole fights, autoUlt both sides: per-tick hp/x/y/alive of every unit
const trace = (r, seed, a, f, crit) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      ${crit ? "units.forEach(u=>{ if(u.key==='askel') u.glyphCrit=0.3; });" : ''}
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      return tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');

try {
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.askel))');
  const states = ['idle', 'walk', 'attack', 'crit', 'hit', 'green', 'blue', 'ult', 'passive'];
  ck('Askel has his eight states + the new crit', states.every(s => G[s]) && Object.keys(G).length === 9, Object.keys(G).join(','));
  const bad = gridProblems(G);
  ck('every sheet exists, file = declared grid, fits 4096, anchors in cell', bad.length === 0, bad.join('; '));
  const FIVE = ['attack', 'crit', 'green', 'blue', 'ult'];
  ck('the five are new files at ?v=1128 (never a reused asset version)', FIVE.every(s => G[s].u === '/assets/anim/askel/askel_' + s + '_1128.webp?v=1128'));
  ck('idle, walk, hit, passive are untouched (?v=21)', ['idle', 'walk', 'hit', 'passive'].every(s => /askel_[a-z]+\.webp\?v=21$/.test(G[s].u)));
  ck('the five face like his other states (flip:true) and are anchored on his standing pose: feet - top = figH, figH 446-448 (frame 0 of every source)',
    FIVE.every(s => G[s].flip === true && G[s].feet - G[s].top === G[s].figH && G[s].figH >= 446 && G[s].figH <= 448 && !G[s].ax));

  // 1. timing DATA
  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE');
  const prod = A => A.n / A.fps * (A.relFrac != null ? A.relFrac : 0.5);
  ck('swing blow: attack clipDur x relFrac = 1.0 clip s (before: 48/24 x 0.5)', Math.abs(prod(G.attack) - 1) < 1e-12, prod(G.attack));
  ck('crit blow: crit clipDur x relFrac = 1.0 clip s (= the attack clip it replaces)', Math.abs(prod(G.crit) - 1) < 1e-12, prod(G.crit));
  ck('ult root = 2.0 s (root:2; before: 48/24)', run("ultClipDur(makeUnit('askel','ally',0,0,30,{owned:false}))") === 2 && G.ult.root === 2);
  ck('no ABILITY_CAST row: casts stay 0.5 / 0.5 / 0.8', !run('ABILITY_CAST.askel') && run("(()=>{const u=makeUnit('askel','ally',0,0,30,{owned:false}); return [castTimeFor(u,'green'),castTimeFor(u,'blue'),castTimeFor(u,'ult')].join()})()") === '0.5,0.5,0.8');
  const kitNow = run('JSON.stringify([KITS.askel,HERO_ULT_ART.askel,ULT_DEF.charge||null,HERO_TYPES.askel])'), kitOld = R0 && R0('JSON.stringify([KITS.askel,HERO_ULT_ART.askel,ULT_DEF.charge||null,HERO_TYPES.askel])');
  ck('Standard Crash / Rallying Ground / Unshaken Herd / March of the Greatbrow numbers identical to BASE (ally shield 12% max HP, knock-aside 2 m)',
    kitNow === kitOld && run('HERO_ULT_ART.askel.allyShield') === 0.12 && run('HERO_ULT_ART.askel.knockAside/METER') === 2, kitNow);

  // 2. CONTROL: scripted actions on BASE
  ck('control file (BASE emberweave-heroes.html from git) loaded', !!R0, 'git show failed');
  const runs = [['attack'], ['crit'], ['green'], ['blue'], ['ult', 530], ['ult', 800], ['ult', 1200], ['ult', 1700]];
  const got = {};
  for (const [kind, ex] of runs) {
    const a = act(run, kind, ex), b = R0 ? act(R0, kind, ex) : null; got[kind + (ex || '')] = a;
    ck(kind + (ex ? ' (farthest foe ' + ex + ')' : '') + ': every blow / shield / buff / knock-aside / dash / landing on the same tick with the same numbers as BASE',
      b && JSON.stringify(a) === JSON.stringify(b) && (kind === 'blue' ? !!a.buff : kind === 'ult' ? (a.land != null && !!a.shield) : a.hits.length > 0), JSON.stringify({ now: a, base: b }));
  }
  const fights = [[['askel', 'vesper', 'vex'], ['askel', 'vex', 'vesper'], 11], [['askel', 'pellucid'], ['grosk', 'askel', 'rhukk'], 222], [['vesper', 'sloe', 'vex'], ['umbris', 'vesper', 'vael'], 5]];
  ck('whole fights (autoUlt, Askel / Vesper / Vex on both sides) are tick-for-tick identical to BASE',
    R0 && fights.every(([a, f, s]) => trace(run, s, a, f) === trace(R0, s, a, f)));
  const broken = JSON.parse(JSON.stringify(G)); delete broken.ult.root; broken.attack.relFrac = 0.6;
  ck('CONTROL: the same fights with the ult root removed and the swing moved (relFrac 0.6) diverge - the trace sees a timing change',
    R0 && fights.some(([a, f, s]) => { run(`globalThis.__svAskel=BATTLE_ANIM.askel; BATTLE_ANIM.askel=${JSON.stringify(broken)}; 1`);
      try { return trace(run, s, a, f) !== trace(R0, s, a, f); } finally { run('BATTLE_ANIM.askel=globalThis.__svAskel; 1'); } }));
  const critSame = fights.slice(0, 2).every(([a, f, s]) => trace(run, s, a, f, true) === trace(R0, s, a, f, true));
  console.log('  info Askel with crit chance 0.3 (crit glyphs): fights ' + (critSame ? 'identical' : 'NOT identical') + ' to BASE - the v532 crit-clip rule rolls his crit at the wind-up now that he has a crit clip (same chance)');

  // 3. the art lands on those moments
  const ai = run("makeUnit('askel','ally',0,0,30,{owned:false}).atkInterval"), STEP = run('SIM_STEP');
  // the swing clip is fitted to its render hold (0.95 x 1.8 s) and starts moving once attackAnim's re-arm ends (Hollow v1126 model, rig-checked)
  const drawn = A => { const hold = Math.min(0.95 * ai, A.n / A.fps), rearm = (Math.ceil(0.18 / STEP) - 1) * STEP / CLK, real = prod(A) * run('BATTLE_PACE') / CLK;
    return (real - rearm) / hold * A.n; };
  ck('swing: the blow is drawn on attack cell 23-24 (source f25, the bottom cap at full reach; cells 23 and 24 both show it)', Math.floor(drawn(G.attack)) === 23 && G.attack.contact === 23, drawn(G.attack).toFixed(2));
  ck('crit: the blow is drawn on crit cell 27 (source f65, the antlers at the bottom of the drive)', Math.floor(drawn(G.crit)) === 27 && G.crit.contact === 27, drawn(G.crit).toFixed(2));
  const gT = got.green.hits[0] && got.green.hits[0][0], bT = got.blue.buff && got.blue.buff[0];
  ck('Standard Crash lands on green cell 25 (20 fps, source f39 - the cap meets the ground)', gT != null && Math.floor(gT / CLK * G.green.fps) === 25 && G.green.contact === 25, String(gT));
  ck('Rallying Ground lands on blue cell 15 (20 fps, source f45 - the fist at the top of the salute)', bT != null && Math.floor(bT / CLK * G.blue.fps) === 15 && G.blue.contact === 15, String(bT));
  // ult: the render's charge phases, replayed off the recorded sim moments (cast end, dash, landing)
  const C = G.ult.charge, k = G.ult.fps / CLK;
  ck('ult: the wind-up reaches its launch cell (14, source f33) by the cast end (0.8 fight s) and holds it', Math.floor(0.8 * k) >= C.launch && Math.floor(0.75 * k) <= C.launch + 1, (0.8 * k).toFixed(2));
  const ultOK = [530, 800, 1200, 1700].every(ex => { const u = got['ult' + ex]; if (!u || u.land == null || u.dash == null) return false;
    const dur = u.land - u.dash + STEP;   // the dash's own duration (it starts the tick after the cast and lands on its last tick)
    const cellAt = t => { const rem = Math.max(0, dur - t) * k, nl = C.land - C.lift; return rem < nl ? Math.max(C.lift, C.land - Math.ceil(rem)) : C.loop[0] + Math.floor(t * k) % (C.loop[1] - C.loop[0]); };
    return cellAt(dur - 1e-6) === C.land - 1 && cellAt(0) === (dur * k > C.land - C.lift ? C.loop[0] : Math.max(C.lift, C.land - Math.ceil(dur * k))); });
  ck('ult: during the dash the stride loop (15-23) runs and the lift (24-27) ends as he arrives; the planted slam (cell 28, source f92) shows from the landing', ultOK && C.land === 28 && G.ult.contact === 28);
  ck('ult: the clip runs 46 cells at 12 fps (3.83 s) - the recovery ends on his standing pose; cells fit the sheet', G.ult.n === 46 && C.loop[1] === C.lift && C.lift < C.land);

  // 4. Vesper / Vex
  const F = run('JSON.parse(JSON.stringify({p:FX2_DEF.vesperpuncture,t:FX2_DEF.vextempest,v:HERO_ULT_ART.vesper,x:HERO_ULT_ART.vex,w:[FX1123_WARM.vesper,FX1123_WARM.vex]}))');
  const fxBad = gridProblems({ puncture: F.p, tempest: F.t });
  ck('Puncture and Razor Tempest sheets exist, file = declared grid, fit 4096, new files at ?v=1128', fxBad.length === 0 && F.p.u === '/assets/anim/fx/vesper_puncture.webp?v=1128' && F.t.u === '/assets/anim/fx/vex_razor_tempest.webp?v=1128', fxBad.join('; '));
  ck('Vesper ult: ownFx puncture, still delivered as a form (the freeze lands where it did)', F.v.ownFx === 'puncture' && F.v.deliver === 'form');
  ck('Vex ult: ownFx tempest, the static vex_ult pinwheel plate retired (no gfx)', F.x.ownFx === 'tempest' && !F.x.gfx);
  ck('both sheets warm with the hero figure', JSON.stringify(F.w) === JSON.stringify([['vesperpuncture'], ['vextempest']]));
  const ultNums = r => r('JSON.stringify([ULT_DEF.riftpuncture,ULT_DEF.triplecleave,HERO_TYPES.vesper,HERO_TYPES.vex])');
  ck('Puncture / Razor Tempest numbers identical to BASE', R0 && ultNums(run) === ultNums(R0), ultNums(run));
  // Puncture close timing: the tear is a line (cell shut) exactly as freeze + silence end; Tempest starts on the cast with the damage
  const pc = run(`(()=>{ const d=FX2_DEF.vesperpuncture, o={d,t:0,endT:0.8+0.35+2}; const out=[]; for(const t of [0, (d.holdA/d.fps)*FX_RT-1e-6, o.endT-((d.shut-d.close)/d.fps)*FX_RT+1e-6, o.endT-1e-6, o.endT+1e-6]){ o.t=t; out.push(_fx22PunctCell(o)); } return JSON.stringify(out); })()`);
  const pcA = JSON.parse(pc);
  ck('Puncture: opens from cell 0 on the press, holds, starts closing at cell 28 and is a line (cell 40) as the freeze + silence end', pcA[0] === 0 && pcA[1] === 15 && pcA[2] === 28 && pcA[3] === 39 && pcA[4] === 40, pc);
  const snap = "JSON.stringify(units.map(x=>[x.key,x.hp,x.x,x.y,x.stunned||0,x.silencedT||0,x.shield||0,x.energy]))+'|'+battleTime+'|'+groundHazards.length";
  ck('the new FX helpers draw only: press, launch, landing and the slashes leave every unit, the clock and the hazards untouched',
    run(`(()=>{ units=[]; seedBattle(3); const u=makeUnit('vesper','ally',300,600,30,{owned:false}), x=makeUnit('vex','ally',300,700,30,{owned:false}), e=makeUnit('vael','enemy',600,600,30,{owned:false}); units=[u,x,e];
      const a=${snap}; vesperPunctureCastFx(u,0.8,null); vesperPunctureLaunchFx(u,e.x,e.y); vesperPunctureLandFx(u,2); vexTempestFx(x,e,null,10*METER); updateFx1123(0.5); const b=${snap}; clearFx1123(); return a===b; })()`) === true);
  const ctl = JSON.parse(JSON.stringify(G)); ctl.crit.u = '/assets/anim/askel/askel_missing.webp?v=1128'; ctl.green.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
