'use strict';
// Maren four (attack, Tide Pool, Tsunami, Maelstrom) + Orryn three (attack, Pressure Sphere, Spiral Current), Phil-approved takes
// (handoff MAREN-FOUR-13OCT2026; Orryn APPROVED 13OCT2026 H3), cut from ChatGPT's CLEAN NO WATERMARK exports (clean-source-manifest.json, every sha256
// matched). Every other state, both kits and all FX are untouched.
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND. Checked three ways:
//   1. the timing DATA the engine reads is unchanged: every new clip keeps clipDur 2.0 s (the old 48 @24) and no relFrac (0.5), so the swing fuse
//      (clipDur x relFrac x BATTLE_PACE), the skill hold (_abilHold = one playthrough), the cast times and the ult root read the same numbers;
//   2. CONTROL against the pre-change file (git show BASE): the same scripted swings, casts and whole fights through server/sim-host.js (the file the
//      server replays with), heroes carrying BATTLE_ANIM via buildFigure as the replay does, land every hit and effect on the same tick, same numbers;
//   3. the art lands on those moments: the release cell (`contact`) is the cell drawn when the engine releases - measured in the 844x390 rig
//      (rig_mo.js PROBE, two reps) and re-derived here from the engine's own release tick.
// Neither hero has a crit clip, so the v532 crit-clip rule does not apply: the battle RNG stream is untouched.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '0734321d';   // origin/main before this change (v1136; the branch was cut from v1134 b2aea01e and rebased)
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-maren-orryn-base-control.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
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
// The seven new clips: [hero, state, cells, fps, release cell, source frame on it]
const NEW = [['maren', 'attack', 28, 14, 17, 16], ['maren', 'green', 30, 15, 11, 21], ['maren', 'blue', 36, 18, 13, 46], ['maren', 'ult', 34, 17, 20, 82],
             ['orryn', 'attack', 48, 24, 27, 46], ['orryn', 'green', 44, 22, 16, 73], ['orryn', 'blue', 44, 22, 16, 60]];
const KEEP = { maren: ['idle', 'walk', 'hit', 'passive'], orryn: ['idle', 'walk', 'hit', 'ult', 'passive'] };
const FLIP = { maren: false, orryn: true };
function gridProblems(G, hero, states) {
  const bad = [];
  for (const st of states) { const A = G[st]; if (!A) { bad.push(hero + '.' + st + ' missing entry'); continue; }
    const f = path.join(ROOT, A.u.split('?')[0]);
    if (!fs.existsSync(f)) { bad.push(hero + '.' + st + ' missing file'); continue; }
    const sz = webpSize(f);
    if (A.n > A.cols * A.rows) bad.push(hero + '.' + st + ' n>grid');
    if (A.fw * A.cols > 4096 || A.fh * A.rows > 4096) bad.push(hero + '.' + st + ' >4096');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(hero + '.' + st + ' file ' + sz + ' != grid');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top >= 0 && A.top < A.feet)) bad.push(hero + '.' + st + ' anchor outside cell'); }
  return bad;
}
// scripted swings against a dummy (same script on both files): every blow (tick, amount) and the tick the ball leaves (the release fuse)
const SWING = (hero) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('${hero}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',780,700,30,{owned:false});
  g.anim=BATTLE_ANIM.${hero}; e.anim=null; g.glyphCrit=0;
  units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; e.greenCd=e.blueCd=99;
  const hits=[], _dd=dealDamage; let st=null, rel=null, ball=null;
  dealDamage=function(s,t,amt){ if(s===g){ hits.push([+battleTime.toFixed(4),Math.round(amt)]); } return _dd.apply(this,arguments); };
  try{ g.atkCd=0;
    for(let i=0;i<Math.round(9/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; e.energy=0; g.energy=0;
      if(st==null&&g.attackAnim>0){ st=battleTime; ball=(g._fuse||[]).reduce((m,x)=>(!m||x.t<m.t)?x:m,null); }   /* the ball's fuse = the shortest (no flight added) */
      else if(st!=null&&rel==null&&ball&&!(g._fuse||[]).includes(ball)) rel=battleTime; }
    return JSON.stringify({hits,st:+st.toFixed(4),rel:rel==null?null:+rel.toFixed(4),lock:+(g._animLockT||0).toFixed(4)});
  } finally { dealDamage=_dd; } })()`;
// green / blue / ult through castKit / castAbility: cast tick, clip hold, every hp/x/y on every tick for 6 s
const CAST = (hero, kind) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
  const g=makeUnit('${hero}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',640,700,30,{owned:false}); const e2=makeUnit('tick','enemy',660,760,30,{owned:false});
  g.anim=BATTLE_ANIM.${hero}; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99;
  g._castSM=1; g._castLv=1;
  if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS['${hero}']['${kind}']);
  const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let fired=null; let pend=!!g._pend;
  const tr=[]; for(let i=0;i<Math.round(6/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=0; e2.energy=0;
    if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4); if(g._pend) pend=true;
    tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.slowT||0).toFixed(2),+(u.rootT||0).toFixed(2)].join(':')).join('|')); }
  return JSON.stringify({hold,anim,fired,trace:crypto_like(tr.join('#'))}); })()`;
// whole fights, autoUlt both sides: per-tick hp/x/y/alive of every unit, heroes carry u.anim (buildFigure under _p2guard, as the server replay does)
const trace = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));

try {
  const G = { maren: run('JSON.parse(JSON.stringify(BATTLE_ANIM.maren))'), orryn: run('JSON.parse(JSON.stringify(BATTLE_ANIM.orryn))') };
  const G0 = R0 && { maren: R0('JSON.parse(JSON.stringify(BATTLE_ANIM.maren))'), orryn: R0('JSON.parse(JSON.stringify(BATTLE_ANIM.orryn))') };
  ck('control file (BASE emberweave-heroes.html from git) loaded', !!R0, 'git show failed');
  ck('Maren keeps her eight states, Orryn his eight (no state added or removed)', Object.keys(G.maren).join() === Object.keys(G0.maren).join() && Object.keys(G.orryn).join() === Object.keys(G0.orryn).join(), Object.keys(G.maren) + ' / ' + Object.keys(G.orryn));
  const bad = [].concat(...['maren', 'orryn'].map(h => gridProblems(G[h], h, NEW.filter(x => x[0] === h).map(x => x[1]))));
  ck('every new sheet exists, file = declared grid, under 4096, anchors in the cell', bad.length === 0, bad.join('; '));
  /* v1140 memory hotfix: the seven were re-cut within 2048 px per side (same grid, anchors x S) as new files ?v=1140 */
  ck('the seven new sheets are new files at ?v=1140 (v1140 re-cut within 2048 px; never a reused asset version)', NEW.every(([h, s]) => G[h][s].u === `/assets/anim/${h}/${h}_${s}_1140.webp?v=1140` && G[h][s].fw * G[h][s].cols <= 2048 && G[h][s].fh * G[h][s].rows <= 2048));
  ck('the old v21 sheets are still on disk (rollback needs nothing)', NEW.every(([h, s]) => fs.existsSync(path.join(ROOT, G0[h][s].u.split('?')[0]))));
  ck('untouched states are byte-for-byte the BASE entries (Maren idle/walk/hit/passive, Orryn idle/walk/hit/ult/passive)', ['maren', 'orryn'].every(h => KEEP[h].every(s => JSON.stringify(G[h][s]) === JSON.stringify(G0[h][s]))));
  /* v1137 = one combined animation release (Maren + Orryn, Sylthaine, Rivet): the other parts' heroes are checked by their own tests (Rivet: test_rivet_weapons.js) */
  /* v1142: Carn's eight new sheets (a later animation release) are checked by their own test, tests/test_carn_anim_eight.js */
  /* v1153: Aureth's eleven new sheets (a later animation release) are checked by their own test, tests/test_aureth_anim_eleven.js */
  const V1137_ANIM = JSON.stringify(['maren', 'orryn', 'sylthaine', 'rivet', 'carn', 'aureth']);
  const others = r => r('JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>!'+V1137_ANIM+'.includes(k)).map(k=>[k,BATTLE_ANIM[k]]))');
  ck('every hero outside the v1137 animation release has BATTLE_ANIM byte-for-byte BASE', H(others(run)) === H(others(R0)));
  ck('grids as cut (cells / fps / release cell): ' + NEW.map(x => x[0][0] + '.' + x[1] + ' ' + x[2] + '@' + x[3] + ' c' + x[4]).join(', '),
    NEW.every(([h, s, n, fps, c]) => G[h][s].n === n && G[h][s].fps === fps && G[h][s].contact === c));
  ck('each faces like the rest of its hero (Maren flip:false, Orryn flip:true - he strikes to sheet-left) and stands on its frame-0 standing pose (feet - top = figH, no ax drift table)',
    NEW.every(([h, s]) => G[h][s].flip === FLIP[h] && G[h][s].flip === G0[h].idle.flip && G[h][s].feet - G[h][s].top === G[h][s].figH && !G[h][s].ax));

  // 1. timing DATA
  const dur = A => (A.pingpong ? 2 * A.n - 2 : A.n) / A.fps, rel = A => (A.relFrac != null ? A.relFrac : 0.5);
  ck('every new clip keeps clipDur 2.0 s and relFrac 0.5 exactly as BASE (old 48 @24, no relFrac): the swing fuse, the skill hold and the cast clock read the same numbers',
    NEW.every(([h, s]) => Math.abs(dur(G[h][s]) - 2) < 1e-12 && Math.abs(dur(G0[h][s]) - 2) < 1e-12 && rel(G[h][s]) === 0.5 && rel(G0[h][s]) === 0.5 && !G[h][s].pingpong && !G[h][s].hold && G0[h][s].hold == null),
    NEW.map(([h, s]) => h + '.' + s + ' ' + dur(G[h][s])).join(' '));
  const kit = r => r('JSON.stringify([KITS.maren,KITS.orryn,HERO_ULT_ART.maren,HERO_ULT_ART.orryn,HERO_TYPES.maren,HERO_TYPES.orryn,ABILITY_CAST.maren||null,ABILITY_CAST.orryn||null,CASTER_BALL.maren,CASTER_BALL.orryn||null])');
  ck('kits, ult art, hero stats, cast times and caster balls identical to BASE', kit(run) === kit(R0));

  // 2. CONTROL: scripted actions and whole fights on BASE
  for (const hero of ['maren', 'orryn']) {
    const a = JSON.parse(run(SWING(hero))), b = JSON.parse(R0(SWING(hero)));
    ck(hero + ' swings: every blow on the same tick with the same number as BASE, same release fuse, same swing lock', a.hits.length >= 3 && JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ now: a, base: b }).slice(0, 400));
    for (const kind of hero === 'maren' ? ['green', 'blue', 'ult'] : ['green', 'blue']) {
      const x = JSON.parse(run(CAST(hero, kind))), y = JSON.parse(R0(CAST(hero, kind)));
      ck(`${hero} ${kind}: the cast fires on the same tick, the clip is held as long (${x.hold} s) and every unit's hp/x/y/slow/root matches BASE for 6 s`, x.fired != null && x.anim === kind && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ now: x, base: y }));
    }
  }
  const fights = [[['maren', 'orryn', 'askel'], ['vesper', 'maren', 'grosk'], 11], [['orryn', 'pellucid', 'maren'], ['rhukk', 'orryn', 'vael'], 222], [['maren', 'sloe', 'umbris'], ['orryn', 'hurne', 'vex'], 5], [['orryn', 'maren'], ['maren', 'orryn'], 31]];
  ck('whole fights (autoUlt, Maren and Orryn on both sides, heroes carry BATTLE_ANIM as the server replay) are tick-for-tick identical to BASE',
    fights.every(([a, f, s]) => trace(run, s, a, f) === trace(R0, s, a, f)));
  const broken = JSON.parse(JSON.stringify(G)); broken.maren.attack.fps = 12; broken.maren.blue.n = 40; broken.orryn.green.relFrac = 0.6; broken.orryn.attack.fps = 20;
  ck('CONTROL: the same fights with the timing moved (Maren attack 12 fps, blue 40 cells, Orryn green relFrac 0.6, attack 20 fps) diverge - the trace sees a timing change',
    fights.every(([a, f, s]) => { run(`globalThis.__svM=BATTLE_ANIM.maren; globalThis.__svO=BATTLE_ANIM.orryn; BATTLE_ANIM.maren=${JSON.stringify(broken.maren)}; BATTLE_ANIM.orryn=${JSON.stringify(broken.orryn)}; 1`);
      try { return trace(run, s, a, f) !== trace(R0, s, a, f); } finally { run('BATTLE_ANIM.maren=globalThis.__svM; BATTLE_ANIM.orryn=globalThis.__svO; 1'); } }));
  const bs = JSON.parse(JSON.stringify(G)); bs.maren.green.n = 36;
  run(`globalThis.__svM=BATTLE_ANIM.maren; BATTLE_ANIM.maren=${JSON.stringify(bs.maren)}; 1`);
  let ctlCast; try { ctlCast = JSON.parse(run(CAST('maren', 'green'))); } finally { run('BATTLE_ANIM.maren=globalThis.__svM; 1'); }
  ck('CONTROL: a green clip 0.4 s longer changes the skill hold the engine queues on (the cast check sees clip length)', ctlCast.hold !== JSON.parse(R0(CAST('maren', 'green'))).hold, JSON.stringify(ctlCast.hold));

  // 3. the art lands on those moments. Clips play in real time from the press and the fight clock runs at SIM_STEP*SIM_HZ*BATTLE_PACE = 0.6724 of it.
  //    Maren's swing and every skill clip play whole (hold >= clip): the cell drawn at the release = (release tick - start tick) / CLK x fps.
  //    Orryn's swing is FITTED to his 1.71 s hold (rig: 27.5/48 of the clip drawn at the release) - its cell is asserted from the rig, both cells extended.
  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE');
  const sw = JSON.parse(run(SWING('maren')));
  const drawnSw = (sw.rel - sw.st) / CLK * G.maren.attack.fps;
  ck('Maren swing: the ball leaves while attack cell 17 is drawn (source f16, the palm\'s first full extension) - engine release tick, natural-speed clip', Math.floor(drawnSw) === 17 && run('clipContactCell(BATTLE_ANIM.maren.attack)') === 17, drawnSw.toFixed(2));
  for (const [h, s, n, fps, c] of NEW.filter(x => x[1] !== 'attack')) {
    const x = JSON.parse(run(CAST(h, s))); const d = x.fired / CLK * fps;
    ck(`${h} ${s}: the cast releases while cell ${c} is drawn (${(x.fired).toFixed(3)} fight s = ${(x.fired / CLK).toFixed(3)} real s x ${fps} fps = ${d.toFixed(2)})`, Math.floor(d) === c && run(`clipContactCell(BATTLE_ANIM.${h}.${s})`) === c, d.toFixed(2));
  }
  const oa = JSON.parse(run(SWING('orryn')));
  ck('Orryn swing: his hold (0.95 x 1.8 s) is shorter than the 2.0 s clip, as on BASE (fitted swing; rig: cells 27-28 = f46/f47 on screen at the release)', oa.lock < 2 && Math.abs(oa.lock - JSON.parse(R0(SWING('orryn'))).lock) < 1e-9 && run('clipContactCell(BATTLE_ANIM.orryn.attack)') === 27, String(oa.lock));
  const ctl = JSON.parse(JSON.stringify(G)); ctl.maren.green.u = '/assets/anim/maren/maren_missing.webp?v=1135'; ctl.orryn.blue.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl.maren, 'maren', ['green']).length + gridProblems(ctl.orryn, 'orryn', ['blue']).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
