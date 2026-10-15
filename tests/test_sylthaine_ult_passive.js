'use strict';
// Sylthaine ULT Blizzard 'contained snow' (H3 creation 566969598953037827) + PASSIVE Cold Snap (566967168584491017), Phil PASS 14 Oct 2026
// (REVIEW 14OCT2026 H3, clean-source-manifest.json sha256 matched, silent twins). Every other state, her kit and all FX are untouched.
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND. Checked three ways:
//   1. the timing DATA the engine reads is unchanged: both clips stay 48 @24 = clipDur 2.0 s (ultClipDur roots her for it - SIM-SIDE), the ult keeps
//      apex 31 (v525 wind-up / hold / return), neither has a relFrac or a hold;
//   2. CONTROL against the pre-change file (git show BASE): the same scripted ult and skill casts and whole fights through server/sim-host.js (the file
//      the server replays with), heroes carrying BATTLE_ANIM via buildFigure as the replay does, land every hit and effect on the same tick, same numbers;
//   3. the art lands on those moments (844x390 rig, rig_syl.js PROBE, two reps, BASE identical): the 0.6 s cast draws ult cells 0-20 and the Blizzard
//      starts on cell 20; the channel holds apex cell 31 (f44, the full snow ring) for the storm; Cold Snap's flare (cell 9 = f12) is its contact cell.
// Sylthaine has no crit clip, so the v532 crit-clip rule does not apply: the battle RNG stream is untouched.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '0734321d';   // origin/main this branch was cut from (v1136)
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-sylthaine-base-control.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
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
// The two new clips: [state, cells, fps, cols, rows, contact field, cell]
const NEW = [['ult', 48, 24, 8, 6, 'apex', 31], ['passive', 48, 24, 8, 6, 'contact', 9]];
const KEEP = ['idle', 'walk', 'attack', 'hit', 'green', 'blue'];
function gridProblems(G, states) {
  const bad = [];
  for (const st of states) { const A = G[st]; if (!A) { bad.push(st + ' missing entry'); continue; }
    const f = path.join(ROOT, A.u.split('?')[0]);
    if (!fs.existsSync(f)) { bad.push(st + ' missing file'); continue; }
    const sz = webpSize(f);
    if (A.n > A.cols * A.rows) bad.push(st + ' n>grid');
    if (A.fw * A.cols > 4096 || A.fh * A.rows > 4096) bad.push(st + ' >4096');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top >= 0 && A.top < A.feet)) bad.push(st + ' anchor outside cell'); }
  return bad;
}
// green / blue / ult through castKit / castAbility: cast tick, clip hold, ult root, every hp/x/y/slow/stun on every tick for 7 s (the 4 s storm + its tail)
const CAST = (kind) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
  const g=makeUnit('sylthaine','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',640,700,30,{owned:false}); const e2=makeUnit('tick','enemy',660,760,30,{owned:false});
  g.anim=BATTLE_ANIM.sylthaine; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99;
  g._castSM=1; g._castLv=1;
  if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS.sylthaine['${kind}']);
  const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim, root=+(g._ultRootT||0).toFixed(4), lock=+(g._animLockT||0).toFixed(4); let fired=null; let pend=!!g._pend; let storm=0;
  const tr=[]; for(let i=0;i<Math.round(7/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=0; e2.energy=0;
    if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4); if(g._pend) pend=true; if((g._blizzT||0)>0) storm++;
    tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.slowT||0).toFixed(2),+(u.stunned||0).toFixed(2),+(g._ultRootT||0).toFixed(3)].join(':')).join('|')); }
  return JSON.stringify({hold,anim,root,lock,fired,storm,trace:crypto_like(tr.join('#'))}); })()`;
// scripted swings against a dummy: every blow (tick, amount) and the swing lock
const SWING = `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('sylthaine','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',780,700,30,{owned:false});
  g.anim=BATTLE_ANIM.sylthaine; e.anim=null; g.glyphCrit=0;
  units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; e.greenCd=e.blueCd=99;
  const hits=[], _dd=dealDamage; dealDamage=function(s,t,amt){ if(s===g){ hits.push([+battleTime.toFixed(4),Math.round(amt)]); } return _dd.apply(this,arguments); };
  try{ g.atkCd=0; for(let i=0;i<Math.round(9/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; e.energy=0; g.energy=0; }
    return JSON.stringify({hits,lock:+(g._animLockT||0).toFixed(4)}); } finally { dealDamage=_dd; } })()`;
// a timed passive would hold its clip for clipDur (firePassiveClip) - the engine field it writes (_animLockT) must read the same number
const PASSLOCK = `(()=>{ units=[]; battleTime=0; const g=makeUnit('sylthaine','ally',500,700,30,{owned:false,rank:3}); g.anim=BATTLE_ANIM.sylthaine; units=[g];
  firePassiveClip(g); return JSON.stringify({lock:+(g._animLockT||0).toFixed(6),hold:+(g._abilHold||0).toFixed(6)}); })()`;
// whole fights, autoUlt both sides: per-tick hp/x/y/alive of every unit, heroes carry u.anim (buildFigure under _p2guard, as the server replay does)
const fightSrc = (seed, a, f) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; let storm=0; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); if(units.some(u=>u.key==='sylthaine'&&(u._blizzT||0)>0)) storm++; tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      return storm+'|'+tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
const trace = (r, seed, a, f) => { const s = r(fightSrc(seed, a, f)); return { storm: +s.split('|')[0], h: crypto.createHash('sha256').update(s).digest('hex') }; };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));

try {
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.sylthaine))');
  const G0 = R0 && R0('JSON.parse(JSON.stringify(BATTLE_ANIM.sylthaine))');
  ck('control file (BASE emberweave-heroes.html from git) loaded', !!R0, 'git show failed');
  ck('Sylthaine keeps her eight states (no state added or removed)', Object.keys(G).join() === Object.keys(G0).join(), Object.keys(G).join());
  const bad = gridProblems(G, NEW.map(x => x[0]));
  ck('both new sheets exist, file = declared grid (8 x 6), under 4096, anchors in the cell', bad.length === 0, bad.join('; '));
  const baseSrc = fs.readFileSync(OLD, 'utf8');
  /* v1140 memory hotfix: both re-cut within 2048 px per side (same 8 x 6 grid, anchors x S) as new files ?v=1140 */
  ck('both are new files at ?v=1140 that BASE never referenced (v1140 re-cut within 2048 px; never a reused asset version)', NEW.every(([s]) => G[s].u === `/assets/anim/sylthaine/sylthaine_${s}_1140.webp?v=1140` && !baseSrc.includes(`sylthaine_${s}_1140`) && G[s].fw * G[s].cols <= 2048 && G[s].fh * G[s].rows <= 2048));
  ck('the old v26 sheets are still on disk (rollback needs nothing)', NEW.every(([s]) => fs.existsSync(path.join(ROOT, G0[s].u.split('?')[0]))));
  ck('untouched states are byte-for-byte the BASE entries (idle/walk/attack/hit/green/blue)', KEEP.every(s => JSON.stringify(G[s]) === JSON.stringify(G0[s])));
  /* v1137 = one combined animation release (Maren + Orryn, Sylthaine, Rivet): the other parts' heroes are checked by their own tests (Rivet: test_rivet_weapons.js) */
  /* v1142: Carn's eight new sheets (a later animation release) are checked by their own test, tests/test_carn_anim_eight.js */
  /* v1153: Aureth's eleven new sheets (a later animation release) are checked by their own test, tests/test_aureth_anim_eleven.js */
  const V1137_ANIM = JSON.stringify(['maren', 'orryn', 'sylthaine', 'rivet', 'carn', 'aureth']);
  const others = r => r('JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>!'+V1137_ANIM+'.includes(k)).map(k=>[k,BATTLE_ANIM[k]]))');
  ck('every hero outside the v1137 animation release has BATTLE_ANIM byte-for-byte BASE', H(others(run)) === H(others(R0)));
  ck('grids as cut: ult 48 @24 apex 31, passive 48 @24 contact 9', NEW.every(([s, n, fps, c, r, f, v]) => G[s].n === n && G[s].fps === fps && G[s].cols === c && G[s].rows === r && G[s][f] === v));
  ck('flip:false like the rest of her states, standing on the frame-0 plate pose (feet - top = figH), no ax drift table',
    NEW.every(([s]) => G[s].flip === false && G0.idle.flip === false && G[s].feet - G[s].top === G[s].figH && !G[s].ax));

  // 1. timing DATA
  const dur = A => (A.pingpong ? 2 * A.n - 2 : A.n) / A.fps;
  ck('both clips keep clipDur 2.0 s exactly as BASE (48 @24), the ult keeps apex 31, no relFrac / hold / root / pingpong on either',
    NEW.every(([s]) => Math.abs(dur(G[s]) - 2) < 1e-12 && Math.abs(dur(G0[s]) - 2) < 1e-12 && G[s].relFrac == null && G0[s].relFrac == null && G[s].hold == null && G[s].root == null && !G[s].pingpong) && G.ult.apex === G0.ult.apex,
    NEW.map(([s]) => s + ' ' + dur(G[s])).join(' '));
  const ucd = r => r(`(()=>{ const u=makeUnit('sylthaine','ally',500,700,30,{owned:false}); return ultClipDur(u); })()`);
  ck('ultClipDur (the sim-side ult root) reads 2.0 s on both files', ucd(run) === 2 && ucd(R0) === 2, ucd(run) + ' / ' + ucd(R0));
  const kit = r => r('JSON.stringify([KITS.sylthaine,HERO_ULT_ART.sylthaine||null,HERO_TYPES.sylthaine,ABILITY_CAST.sylthaine,CASTER_BALL.sylthaine||null,ULT_DEF.blizzard||null,ABIL_ANIM.blizzard,PASS_DESC.coldsnap||null])');
  ck('kit, ult art, hero stats, cast times, caster ball, Blizzard def and Cold Snap identical to BASE', kit(run) === kit(R0));
  const pl = run(PASSLOCK), pl0 = R0(PASSLOCK);
  ck('a timed passive would lock her for the same time (firePassiveClip writes _animLockT = clipDur = 2.0 s on both)', pl === pl0 && JSON.parse(pl).lock === 2, pl + ' / ' + pl0);

  // 2. CONTROL: scripted actions and whole fights on BASE
  const a = JSON.parse(run(SWING)), b = JSON.parse(R0(SWING));
  ck('swings: every blow on the same tick with the same number as BASE, same swing lock', a.hits.length >= 3 && JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ now: a, base: b }).slice(0, 300));
  const ult = JSON.parse(run(CAST('ult'))), ult0 = JSON.parse(R0(CAST('ult')));
  ck(`ult Blizzard: the cast fires on the same tick (${ult.fired} fight s), the same root (${ult.root} s) and lock, the storm runs as long (${ult.storm} ticks) and every unit's hp/x/y/slow/stun matches BASE for 7 s`,
    ult.fired != null && ult.anim === 'ult' && ult.storm > 0 && JSON.stringify(ult) === JSON.stringify(ult0), JSON.stringify({ now: ult, base: ult0 }));
  for (const kind of ['green', 'blue']) {
    const x = JSON.parse(run(CAST(kind))), y = JSON.parse(R0(CAST(kind)));
    ck(`${kind}: identical to BASE (cast tick, hold, every unit for 7 s)`, x.fired != null && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ now: x, base: y }));
  }
  const fights = [[['sylthaine', 'askel', 'maren'], ['vaelora', 'sylthaine', 'grosk'], 11], [['sylthaine', 'pellucid'], ['rhukk', 'sylthaine', 'vael'], 222],
                  [['sylthaine', 'sloe', 'umbris'], ['orryn', 'hurne', 'vex'], 5], [['sylthaine', 'sylthaine'], ['sylthaine', 'vael'], 31]];
  const T1 = fights.map(([x, f, s]) => trace(run, s, x, f)), T0 = fights.map(([x, f, s]) => trace(R0, s, x, f));
  ck('the fights exercise her ult: a Blizzard is raging on ' + T1.map(t => t.storm).join('/') + ' ticks', T1.every(t => t.storm > 0));
  ck('whole fights (autoUlt, Sylthaine on both sides, heroes carry BATTLE_ANIM as the server replay) are tick-for-tick identical to BASE', T1.every((t, i) => t.h === T0[i].h));
  // The Blizzard channel already roots her for the 0.6 s cast + 4 s storm, so in these fights even a 6 s ult clip root changed nothing measurable
  // (measured: same ult ticks, same 30 swings, same hash) - fights are blind to her ult clip length. So the ult clip is guarded by the scripted cast
  // (_ultRootT is in its trace), and the fight control moves a clip number the fights DO read (her swing's relFrac), proving the trace sees anim data.
  const short = JSON.parse(JSON.stringify(G)); short.ult.n = 40; short.ult.rows = 5;
  run(`globalThis.__svS=BATTLE_ANIM.sylthaine; BATTLE_ANIM.sylthaine=${JSON.stringify(short)}; 1`);
  let ctlUlt; try { ctlUlt = JSON.parse(run(CAST('ult'))); } finally { run('BATTLE_ANIM.sylthaine=globalThis.__svS; 1'); }
  ck('CONTROL: an ult clip shortened to 40 @24 (1.67 s) moves the sim-side root in the scripted cast (the cast check sees ult clip length)', ctlUlt.root !== ult0.root && ctlUlt.trace !== ult0.trace, JSON.stringify(ctlUlt.root));
  const broken = JSON.parse(JSON.stringify(G)); broken.attack.relFrac = 0.8;
  ck('CONTROL: the same fights with her swing release moved (attack relFrac 0.5 -> 0.8, carried on u.anim via buildFigure) diverge - the fight trace sees clip timing',
    fights.every(([x, f, s], i) => { run(`globalThis.__svS=BATTLE_ANIM.sylthaine; BATTLE_ANIM.sylthaine=${JSON.stringify(broken)}; 1`);
      try { return trace(run, s, x, f).h !== T0[i].h; } finally { run('BATTLE_ANIM.sylthaine=globalThis.__svS; 1'); } }));
  const bp = JSON.parse(JSON.stringify(G)); bp.passive.fps = 20;
  run(`globalThis.__svS=BATTLE_ANIM.sylthaine; BATTLE_ANIM.sylthaine=${JSON.stringify(bp)}; 1`);
  let ctlPass; try { ctlPass = run(PASSLOCK); } finally { run('BATTLE_ANIM.sylthaine=globalThis.__svS; 1'); }
  ck('CONTROL: a passive clip at 20 fps (2.4 s) changes the passive lock (the check sees clip length)', ctlPass !== pl0, ctlPass);

  // 3. the art lands on those moments. Clips play in real time from the press; the fight clock runs at SIM_STEP*SIM_HZ*BATTLE_PACE of it.
  //    The 0.6 s ult cast plays the clip one-shot from cell 0 at 24 fps; the Blizzard starts on the tick the cast resolves. The rig drew cell 20 on the
  //    last render frame before the release (BASE and new, two reps) - re-derived here: the last cell drawn before the release tick is 20.
  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE'), STEP = run('SIM_STEP');
  const lastCast = Math.floor((ult.fired - STEP) / CLK * G.ult.fps);
  ck(`ult: the Blizzard starts as cast cell 20 is on screen (the last cell before the ${ult.fired} fight s release = ${((ult.fired - STEP) / CLK * 24).toFixed(2)}), and the channel's held cell is apex 31`,
    lastCast === 20 && run('clipContactCell(BATTLE_ANIM.sylthaine.ult)') === 31, String(lastCast));
  ck('passive: Cold Snap\'s contact cell is 9 (the flare in her raised hand, source f12)', run('clipContactCell(BATTLE_ANIM.sylthaine.passive)') === 9);
  const ctl = JSON.parse(JSON.stringify(G)); ctl.ult.u = '/assets/anim/sylthaine/sylthaine_missing.webp?v=1137'; ctl.passive.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, ['ult']).length + gridProblems(ctl, ['passive']).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
