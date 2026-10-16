'use strict';
// Hollow ten (Phil 11 Oct 2026, ChatGPT handoff HOLLOW-REBUILD-TEN-PASSIVE2-11OCT2026, "send to claude"): ENTRANCE2, IDLE1, WALK1,
// ATTACK4, CRIT5, HIT4, GREEN9 Fan of Knives, BLUE2 Lacerate, ULT3 Vanishing Point, PASSIVE2 The Space He Isn't In - wired as sheets.
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND: no damage, cast, root, miss or drop time moves. Checked two ways:
//   1. the timing DATA the engine reads off the clips is the v1123 value (attack/crit clipDur x relFrac = 1.0 clip s, ult clip = 2.0 s
//      = his ult root, no ABILITY_CAST row, kit / ult / passive numbers untouched);
//   2. CONTROL against the live v1123 file (git show 216c328c): the same scripted fights through server/sim-host.js (the file the
//      server replays with) land every blow - swing, crit, Fan of Knives, Lacerate, the Vanishing Point strike, the NOT THERE miss,
//      the drop - on the same tick with the same damage.
// And the art lands on those moments (clips play in real time; the fight clock is SIM_STEP*SIM_HZ*BATTLE_PACE = 0.6724 of it):
//   - swing / crit: the blow lands 1.0 x 0.82 fight s in = 1.2195 real s; the 2.0 s clip is fitted into his 0.95 x 1.7 s swing hold,
//     fitted to the hold and drawn (rig-measured) on attack cell 28 of 48 (source f37, the blade's full reach), crit cell 25 of 42 (f17)
//   - Fan of Knives: cast 0.5 fight s = 0.744 real s = green cell 8 at 12 fps (source f49, the six knives out)
//   - Lacerate: cast 0.5 fight s = blue cell 17 at 24 fps (source f23, the first cut at full reach)
//   - the drop: he is in the air 0.5 fight s = 0.744 real s = entrance cell 16 at 22 fps (source f32, feet down)
//   - Vanishing Point: the clip's `vanish` phases (render only) - wind-up to the empty cell at the cast end, held while he is off the
//     field, the reappear-and-land cells from the strike
//   - the passive clip fires on the miss he causes (the blow aimed at him that never lands)
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const Q95 = require('./helpers/q95-1158.js');   // v1158: q95 sheets are checked as the v1157 lossless originals they were (tests/test_q95_1158.js checks the q95 files)
const HTML = process.env.EW_HTML || Q95.page(path.join(ROOT, 'emberweave-heroes.html'));
const BASE_SHA = '216c328cf4f061ad17965af6ad223416f2c0dc12';   // v1123 live, before the ten
let OLD = process.env.EW_HTML_OLD;
// the control copy sits beside the live file (sim-host loads the page's sibling scripts from its folder; v1126 changed none of them) and is removed on exit
/* v1161 re-baseline: Phil changed Hollow's numbers after v1123 - v1143 Vanishing Point 2.0 -> 1.2 x Attack (0c5e8a29, pre-beta tester report) and
   v1144 his drop 3.5 -> 5.5 s and Attack 40 -> 36 (5121b055). The control file is v1123 + exactly those changes (tests/helpers/balance-1143-1150.js,
   copied from the commits), so every blow below is still compared tick for tick and number for number with the pre-art engine on today's numbers;
   a CONTROL shows plain v1123 deals the old damage. */
const BAL = require('./helpers/balance-1143-1150.js');
const V1123 = (() => { try { return cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString(); } catch (e) { return null; } })();
if (!OLD) { try { OLD = path.join(ROOT, '.test-hollow-v1123-control.html'); fs.writeFileSync(OLD, BAL.withChanges(V1123));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
require('./helpers/anim-slim-1155.js').undoSlim1155(run);   // v1155 slim: this release's checks see the v1153 entries (tests/test_anim_slim_1155.js checks the slim)
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
    if (A.fw * A.cols > 4096 || A.fh * A.rows > 4096) bad.push(st + ' >4096');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top < A.feet)) bad.push(st + ' anchor outside cell');
  }
  return bad;
}
// one scripted Hollow action against one dummy (same script on both files): every Hollow blow on the dummy, the dummy's blow on him
const SCRIPT = kind => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0;
  const g=makeUnit('hollow','ally',500,700,20,{owned:false}); const e=makeUnit('vael','enemy',530,700,20,{owned:false});
  g.anim=BATTLE_ANIM.hollow; e.anim=null;   /* as the headless replay attaches it (buildFigure _p2guard) */
  units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9;}); g._dropHidden=false; g._dropT=0; g.x=500; g.y=700;
  e.atkInterval=99; e.atkCd=99; e.speed=0; e.energy=0; g.energy=0; g.target=e; g.speed=0; g.greenCd=g.blueCd=99; e.greenCd=e.blueCd=99;
  g.greenAb=KITS.hollow.green; g.blueAb=KITS.hollow.blue;
  const hits=[], _dd=dealDamage, pre={};
  dealDamage=function(s,t,amt,c){ if(s===g&&t===e) hits.push([+battleTime.toFixed(4),Math.round(amt)]); return _dd.apply(this,arguments); };
  try{
    if('${kind}'==='green'){ g._castSM=1; g._castLv=1; castKit(g,g.greenAb); }
    else if('${kind}'==='blue'){ g._castSM=1; g._castLv=1; castKit(g,g.blueAb); }
    else if('${kind}'==='ult'){ e.hp=e.maxHp*0.9; g.energy=100; castAbility(g); pre.root=g._ultRootT; }
    else if('${kind}'==='crit'){ g._gearNextCrit='hit'; g.atkCd=0; }
    else if('${kind}'==='miss'){ g.pass={notthere:true}; g._ntReady=true; g.atkCd=99; const h0=g.hp; dealDamage(e,g,50,'#fff');
      pre.missed=(g.hp===h0); pre.clip=g._abilAnim||null; pre.hold=g._abilHold||0; pre.ntReady=g._ntReady; }
    else if('${kind}'==='drop'){ g._dropHidden=true; g._dropT=0.2; g._dropHome={x:500,y:900}; g.x=-9999; g.y=-9999; g.atkCd=99; }
    else { g.atkCd=0; }
    const out={hits, pre};
    for(let i=0;i<Math.round(5/SIM_STEP);i++){ if('${kind}'==='green'){ e.x=g.x+40; e.y=g.y; }   /* bodies shove the dummy past the 3 m fan; keep it inside */
      updateBattle(SIM_STEP); g.energy=0; g.greenCd=g.blueCd=99; e.energy=0;
      if('${kind}'==='drop'&&out.land==null&&!g._dropHidden&&!(g._fallT>0)) out.land=+battleTime.toFixed(4);
      if('${kind}'==='drop'&&out.dropHold==null&&g._abilAnim==='drop') out.dropHold=+g._abilHold.toFixed(4);
      if('${kind}'==='ult'&&out.gone==null&&g._vpT>0) out.gone=+battleTime.toFixed(4); }
    return JSON.stringify(out);
  } finally { dealDamage=_dd; } })()`;
const act = (r, kind) => JSON.parse(r(SCRIPT(kind)));

try {
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.hollow))');
  const states = ['drop', 'idle', 'walk', 'attack', 'crit', 'hit', 'green', 'blue', 'ult', 'passive'];
  ck('Hollow has the ten approved states (drop = the entrance)', states.every(s => G[s]) && Object.keys(G).length === 10, Object.keys(G).join(','));
  const bad = gridProblems(G);
  ck('every sheet exists, file = declared grid, fits 4096, anchors in cell', bad.length === 0, bad.join('; '));
  ck('the ten are new files at ?v=1126 (never a reused asset version)', states.every(s => G[s].u === '/assets/anim/hollow/hollow_' + s + '_1126.webp?v=1126'));
  ck('the source art faces right (flip:false) on all ten', states.every(s => G[s].flip === false));
  ck('walk plays a measured stride loop', Array.isArray(G.walk.loop) && G.walk.loop[0] >= 0 && G.walk.loop[1] <= G.walk.n && G.walk.loop[1] - G.walk.loop[0] >= 16, JSON.stringify(G.walk.loop));
  ck('every state is normalised to the same body (figH from the fitted guard plate, not one number for all)', new Set(states.map(s => G[s].figH)).size > 2);

  // 1. timing DATA = v1123
  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE');
  const prod = A => A.n / A.fps * (A.relFrac != null ? A.relFrac : 0.5);
  ck('swing blow: attack clipDur x relFrac = 1.0 clip s (v1123: 48/24 x 0.5)', Math.abs(prod(G.attack) - 1) < 1e-12, prod(G.attack));
  ck('crit blow: crit clipDur x relFrac = 1.0 clip s (= the attack clip it replaces)', Math.abs(prod(G.crit) - 1) < 1e-12, prod(G.crit));
  ck('ult root = his ult clip = 2.0 s (v1123: 48/24)', run("ultClipDur(makeUnit('hollow','ally',0,0,20,{owned:false}))") === 2);
  ck('no ABILITY_CAST row: casts stay 0.5 / 0.5 / 0.8', !run('ABILITY_CAST.hollow') && run("(()=>{const u=makeUnit('hollow','ally',0,0,20,{owned:false}); return [castTimeFor(u,'green'),castTimeFor(u,'blue'),castTimeFor(u,'ult')].join()})()") === '0.5,0.5,0.8');
  ck('Fan of Knives / Lacerate / The Space He Isn\'t In numbers unchanged', run('JSON.stringify(KITS.hollow)') === JSON.stringify({
    green: { name: 'Fan of Knives', type: 'bladefan', mul: 0.9, radius: 3 * run('METER'), angle: 75, bleed: 0.16, cd: 7, gfx: 'hollow_green', gdur: 2.75 },
    blue: { name: 'Lacerate', type: 'bleedstack', mul: 0.8, bleed: 0.16, rupture: 3, ruptMul: 1.9, stackDur: 6, cd: 6, gfx: 'hollow_blue', gfxR: 3 * run('METER'), gdur: 3.79 },
    purple: { name: "The Space He Isn't In", pass: 'notthere' } }));
  ck('Vanishing Point numbers: v1123 with the v1143 cut (mul 2.0 -> 1.2), the rest unchanged', run('JSON.stringify(ULT_DEF.vanishpoint)') === JSON.stringify({ mul: 1.2, exec: 0.20, chain: 3, falloff: 0.8, gone: 0.9, hop: 0.35, range: 15 * run('METER') }));
  ck('Hollow: Attack 36 and the drop 5.5 s (v1144)', run("HERO_TYPES.hollow.dmg") === 36 && run("makeUnit('hollow','ally',0,0,20,{owned:false})._dropT") === 5.5);

  // 2. CONTROL: the same scripted fights on v1123
  const R0 = OLD ? load(OLD) : null;
  ck('control file (v1123 emberweave-heroes.html from git) loaded', !!R0, 'git show failed');
  { const fx = V1123 && path.join(ROOT, '.test-hollow-v1123-plain.html'); let P = null;
    if (fx) { fs.writeFileSync(fx, V1123); process.on('exit', () => { try { fs.unlinkSync(fx); } catch (e) {} }); P = load(fx); }
    const a = act(run, 'attack'), u = act(run, 'ult'), pa = P && act(P, 'attack'), pu = P && act(P, 'ult');
    ck('CONTROL: plain v1123 (before the v1143 / v1144 changes) lands the same blows on the same ticks with the old numbers (swing ' + (pa && pa.hits[0][1]) + ' vs ' + a.hits[0][1] + ', Vanishing Point ' + (pu && pu.hits[0][1]) + ' vs ' + u.hits[0][1] + ')',
      !!P && JSON.stringify(pa.hits.map(h => h[0])) === JSON.stringify(a.hits.map(h => h[0])) && pa.hits[0][1] > a.hits[0][1] && pu.hits[0][1] > u.hits[0][1] * 1.5); }
  for (const kind of ['attack', 'crit', 'green', 'blue', 'ult', 'miss', 'drop']) {
    const a = act(run, kind), b = R0 ? act(R0, kind) : null;
    const strip = o => JSON.stringify(Object.assign({}, o, { pre: Object.assign({}, o.pre, { clip: undefined, hold: undefined }), dropHold: undefined }));
    ck(kind + ': every blow, miss and landing on the same tick with the same damage as v1123 + the v1143/v1144 Hollow numbers', b && strip(a) === strip(b) && (kind === 'miss' || kind === 'drop' || a.hits.length > 0) && (kind !== 'green' || a.hits.some(h => h[1] !== a.hits[a.hits.length - 1][1] || h[0] < 0.6)),
      JSON.stringify({ now: a, v1123: b }));
    if (kind === 'miss') {
      ck('the miss he causes fires his passive clip (2.0 s, PASSIVE2) on the blow it refuses', a.pre.missed === true && a.pre.ntReady === false && a.pre.clip === 'passive' && Math.abs(a.pre.hold - G.passive.n / G.passive.fps) < 1e-9, JSON.stringify(a.pre));
      ck('CONTROL: v1123 refused the same blow (the miss itself is unchanged)', b && b.pre.missed === true && b.pre.ntReady === false);
      ck('his passive is an event clip: never idle filler, restarted on every miss (render only)', G.passive.event === true && run('firePassiveClip.toString()').includes('passive.event'));
    }
    if (kind === 'drop') {
      ck('the drop holds the entrance clip for its own length (ownFall: no extra half second on the last frame)', G.drop.ownFall === true && Math.abs(a.dropHold - G.drop.n / G.drop.fps) < 1e-3, JSON.stringify(a));
      ck('his feet touch down on entrance cell 16 (source f32) as the 0.5 fight-s fall ends', Math.floor(0.5 / CLK * G.drop.fps) === 16, String(Math.floor(0.5 / CLK * G.drop.fps)));
    }
    if (kind === 'ult') {
      ck('Vanishing Point: he leaves the field at the cast end (0.8 fight s) and is rooted 2.0 s, as v1123', b && Math.abs(a.gone - b.gone) < 1e-9 && a.pre.root === 2 && b.pre.root === 2, JSON.stringify({ now: a.pre, v1123: b && b.pre }));
    }
  }

  // 3. the art lands on those moments
  const ai = run("makeUnit('hollow','ally',0,0,20,{owned:false}).atkInterval");
  // The swing clip is fitted to its render hold (0.95 x 1.7 s, render seconds = real x game speed), and the hold is re-armed every
  // frame while attackAnim (0.18 fight s, counted in sim ticks) is still up - so the fitted clip starts moving 6 ticks late.
  // Measured on the rig (844x390): blow drawn on attack cell 28-29, crit cell 25. This model reproduces it.
  const STEP = run('SIM_STEP');
  const drawn = A => { const hold = Math.min(0.95 * ai, A.n / A.fps), rearm = (Math.ceil(0.18 / STEP) - 1) * STEP / CLK, real = prod(A) * run('BATTLE_PACE') / CLK;
    return Math.floor((real - rearm) / hold * A.n); };
  ck('swing: the blow is drawn on attack cell 28 (rig: 28-29) = source f37-f38, the blade at full reach', [28, 29].includes(drawn(G.attack)) && G.attack.contact === 28, drawn(G.attack));
  ck('crit: the blow is drawn on crit cell 25 of 42 (rig: 25) = source f17, the neck stab at full lunge', drawn(G.crit) === 25 && G.crit.contact === 25, drawn(G.crit));
  ck('CONTROL: the first cut (contact on cell 36 = the naive 75.5% fit) misses the drawn blow by 7+ cells', drawn(G.attack) <= 29);
  ck('Fan of Knives fires on green cell 8 (12 fps, source f49 - the six knives out)', Math.floor(0.5 / CLK * G.green.fps) === 8 && G.green.release === 8);
  ck('Lacerate lands on blue cell 17 (24 fps, source f23 - the first cut at full reach)', Math.floor(0.5 / CLK * G.blue.fps) === 17 && G.blue.release === 17);
  ck('Vanishing Point clip carries its phases: wind-up 0..13, empty cell 14 (held off the field), reappear from 15',
    JSON.stringify(G.ult.vanish) === JSON.stringify({ at: 14, back: 15 }) && G.ult.n === 48 && G.ult.fps === 24);
  ck('skill-tab previews derive from the new sheets (no hand-written Hollow table)', !run('HERO_SKILL_CLIPS.hollow'));

  const ctl = JSON.parse(JSON.stringify(G)); ctl.hit.u = '/assets/anim/hollow/hollow_missing.webp?v=1126'; ctl.walk.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
