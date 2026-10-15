'use strict';
// v1142 - Carn's eight new animations (Phil PASS 15 Oct 2026, REVIEW 15OCT2026 H3, clean-source-manifest.json - all eight "Phil PASS", official
//   Hailuo Without Watermark exports, sha256 matched): IDLE, WALK, ATTACK, CRIT (creation 566994430037954560 - his first crit clip), HIT,
//   GREEN Reckless Blow (corrected creation 566993116109373444), BLUE Vein Burst, ULT Crimson Reap. No passive was made, and Phil (15 Oct): "Make sure
//   you remove his passive animation" - Carn has NO passive clip: the v21 sheet (old art) never plays, not as idle filler, not after the ult, not in the
//   Skills tab; his passive (Unrelenting, a static attack-speed buff) never fired a clip, so no fight moved (80 whole fights = the build before).
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND. Checked three ways:
//   1. the timing DATA the engine reads is unchanged: every action clip keeps clipDur 2.0 s and relFrac 0.5 (the old 48 @24), so the swing fuse,
//      the skill hold (_abilHold = one playthrough), the cast clock and the ult root read the same numbers;
//   2. CONTROL against the pre-change file (git show BASE): scripted swings, casts and whole fights through server/sim-host.js (the file the server
//      replays with), heroes carrying BATTLE_ANIM via buildFigure as the replay does, land every blow and effect on the same tick, same numbers;
//   3. the art lands on those moments: each clip's `contact` cell is the cell drawn when the engine lands it, re-derived here from the engine's own
//      blow / release / landing tick (clips play in real time; the fight clock is SIM_STEP*SIM_HZ*BATTLE_PACE = 0.6724 of it).
// The v532 CRIT-CLIP RULE (engine code, unchanged): a hero WITH a crit clip rolls a swing's crit at the WIND-UP (same chance) so the crit clip
// plays from its first frame. Carn is a Bruiser (class crit 3%), so his roll now happens earlier in the battle RNG stream. Shown here as for
// Hurne v1132: with his crit at 0 the fights are identical to BASE; with his real crit they are identical to BASE given a crit clip of the OLD
// attack timing (BASE + the rule) - the art itself moves nothing; against plain BASE the result is printed as an info line.
// SOUND (v1138): his Crimson Reap sound (S0382) now peaks on the cleave landing (rule 'land'), the ult clip's contact cell; Reckless Blow (release)
// and Vein Burst (land) already sat on their engine moments; tests/test_combat_sfx_1138.js measures every peak against its frame.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '25d88920';   // origin/main before this change (v1140)
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-carn-base-control.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
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
// the eight new clips: [state, cells, fps, contact cell (null = none), source frame on it]
const NEW = [['idle', 62, 12, null], ['walk', 34, 24, null], ['attack', 48, 24, 30, 23], ['crit', 48, 24, 30, 45], ['hit', 48, 24, null],
             ['green', 48, 24, 18, 32], ['blue', 48, 24, 30, 41], ['ult', 44, 22, 37, 48]];
const ACT = ['attack', 'crit', 'hit', 'green', 'blue', 'ult'];
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
const SWING = (kind, crit, rank) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('carn','ally',500,700,30,{owned:false,rank:${rank || 3}}); const e=makeUnit('vael','enemy',540,700,30,{owned:false});
  g.anim=BATTLE_ANIM.carn; e.anim=null; g.glyphCrit=${crit};
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
// green / blue / ult through castKit / castAbility: cast tick, clip hold, every effect tick, every hp/x/y for 6 s
const CAST = kind => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
  const g=makeUnit('carn','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false}); const e2=makeUnit('tick','enemy',560,740,30,{owned:false});
  g.anim=BATTLE_ANIM.carn; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.hp=g.maxHp*0.5;
  const fx=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  g._castSM=1; g._castLv=1;
  try{
    if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS.carn['${kind}']);
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let fired=null; let pend=!!g._pend;
    const tr=[]; for(let i=0;i<Math.round(6/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=0; e2.energy=0;
      if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4); if(g._pend) pend=true;
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.slowT||0).toFixed(2),+(u.rootT||0).toFixed(2)].join(':')).join('|')); }
    return JSON.stringify({hold,anim,fired,fx,trace:crypto_like(tr.join('#'))});
  } finally { doEffect=_de; } })()`;
const trace = (r, seed, a, f, crit) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      ${crit != null ? 'units.forEach(u=>{ if(u.key===\'carn\') u.glyphCrit=' + crit + '; });' : ''}
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
const withRule = (r, fn) => {   // BASE + the v532 rule: give BASE's Carn a crit clip with the OLD attack clip's timing (render data only)
  r('globalThis.__svC=BATTLE_ANIM.carn; BATTLE_ANIM.carn=Object.assign({},BATTLE_ANIM.carn,{crit:Object.assign({},BATTLE_ANIM.carn.attack)}); 1');
  try { return fn(); } finally { r('BATTLE_ANIM.carn=globalThis.__svC; 1'); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));

try {
  ck('control file (BASE emberweave-heroes.html from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  const G = run('JSON.parse(JSON.stringify(BATTLE_ANIM.carn))'), G0 = R0('JSON.parse(JSON.stringify(BATTLE_ANIM.carn))');
  ck('Carn has exactly the eight new states (with his first crit) and NO passive clip; BASE had a passive and no crit', Object.keys(G).sort().join() === 'attack,blue,crit,green,hit,idle,ult,walk' && !G.passive && !!G0.passive && !G0.crit, Object.keys(G).join(','));
  const bad = gridProblems(G, NEW.map(x => x[0]));
  ck('every new sheet exists, file = declared grid, within 2048 px per side and 4 MB (v1140 budget), anchors in the cell', bad.length === 0, bad.join('; '));
  const baseSrc = fs.readFileSync(OLD, 'utf8');
  ck('the eight are new files at ?v=1142 that BASE never referenced (never a reused asset version)', NEW.every(([s]) => G[s].u === `/assets/anim/carn/carn_${s}_1142.webp?v=1142` && !baseSrc.includes(`carn_${s}_1142`)));
  ck('the old v21 sheets are still on disk (rollback needs nothing)', NEW.filter(([s]) => s !== 'crit').every(([s]) => fs.existsSync(path.join(ROOT, G0[s].u.split('?')[0]))));
  ck('no passive clip anywhere: not in BATTLE_ANIM, not in the Skills-tab preview (hand table or derived), and no page reference to the v21 sheet (its file stays on disk)',
    !G.passive && run("(()=>{ ensureSkillPreview('carn'); const s=HERO_SKILL_CLIPS.carn||{}; return !s[3] && !!s[0]; })()") && !/carn_passive\.webp\?/.test(fs.readFileSync(HTML, 'utf8'))
    && fs.existsSync(path.join(ROOT, G0.passive.u.split('?')[0])));
  { const r = JSON.parse(run(`(()=>{ units=[]; seedBattle(3); const g=makeUnit('carn','ally',500,700,30,{owned:false,rank:3}); g.anim=BATTLE_ANIM.carn; units=[g]; g._abilHold=0; g._lockPri=0; g._animLockT=0;
      firePassiveClip(g, 2.0); const fired=[g._abilAnim||null,g._abilHold,g._lockPri,g._animLockT,!!g._passFired,g._qPass||null];
      const cand=[]; if(g.anim.idle) cand.push('idle'); if(!g._passFired && g.anim.passive) cand.push('passive'); return JSON.stringify({fired,cand}); })()`));
    ck('a passive trigger plays no clip and sets no hold or lock (firePassiveClip returns after its FX plate); idle has no passive filler to alternate with', JSON.stringify(r.fired) === JSON.stringify([null, 0, 0, 0, false, null]) && r.cand.join() === 'idle', JSON.stringify(r)); }
  const others = r => r("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='carn').map(k=>[k,BATTLE_ANIM[k]]))");
  ck('every other hero and monster has BATTLE_ANIM byte-for-byte BASE', H(others(run)) === H(others(R0)));
  ck('grids as cut (cells / fps / contact cell): ' + NEW.map(x => x[0] + ' ' + x[1] + '@' + x[2] + (x[3] != null ? ' c' + x[3] : '')).join(', '),
    NEW.every(([s, n, fps, c]) => G[s].n === n && G[s].fps === fps && (c == null ? G[s].contact == null : G[s].contact === c)));
  ck('the new art faces RIGHT (flip:false on all eight) and every state stands on the shared frame-0 pose (feet - top = figH, no ax drift table, no pingpong)',
    NEW.every(([s]) => G[s].flip === false && G[s].feet - G[s].top === G[s].figH && !G[s].ax && !G[s].pingpong));
  ck('walk = one clean stride loop over the whole clip (loop [0,34], v1047)', JSON.stringify(G.walk.loop) === '[0,34]');
  const K = JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(NEW.map(x => x[0]))}.map(s=>{ const c=BATTLE_ANIM.carn[s]; return texSheetK(c.fw,c.fh,c.cols,c.rows,c.figH/c.fh); })); } finally{ window.__texPhone=null; } })()`));
  ck('phone: every new sheet uploads at its own size (texSheetK 1 - nothing resized on the device) and every figure is drawn from >= 160 px', K.every(k => k === 1) && NEW.every(([s]) => G[s].figH >= 160), JSON.stringify(K));

  // 1. timing DATA
  const dur = A => (A.pingpong ? 2 * A.n - 2 : A.n) / A.fps, rel = A => (A.relFrac != null ? A.relFrac : 0.5);
  ck('every action clip (attack, crit, hit, green, blue, ult) keeps clipDur 2.0 s and relFrac 0.5 exactly as BASE (48 @24, no relFrac, no hold)',
    ACT.every(s => Math.abs(dur(G[s]) - 2) < 1e-12 && rel(G[s]) === 0.5 && !G[s].hold) && ACT.filter(s => s !== 'crit').every(s => Math.abs(dur(G0[s]) - 2) < 1e-12 && rel(G0[s]) === 0.5 && G0[s].hold == null),
    ACT.map(s => s + ' ' + dur(G[s])).join(' '));
  const kit = r => r('JSON.stringify([KITS.carn,HERO_ULT_ART.carn,HERO_TYPES.carn,ABILITY_CAST.carn||null,ULT_DEF.cleave,FX2_DEF.carnreap,FX2_DEF.carn_ult,FX2_DEF.carn_green,FX2_DEF.carn_blue])');
  ck('kit, ult art, hero stats, cast times, Crimson Reap and every Carn FX plate identical to BASE', kit(run) === kit(R0));

  // 2. CONTROL: scripted swings, casts and whole fights on BASE
  const sw = (r, k, c, rk) => JSON.parse(r(SWING(k, c, rk)));
  const a0 = sw(run, 'attack', 0), b0 = sw(R0, 'attack', 0);
  ck('swings (crit 0): every blow on the same tick with the same number as BASE', a0.length >= 3 && JSON.stringify(a0) === JSON.stringify(b0), JSON.stringify({ now: a0, base: b0 }));
  const a1 = sw(run, 'crit', 0), b1 = sw(R0, 'crit', 0);
  ck('forced crit (next-hit crit): the crit blow lands on the same tick, same amount, flagged crit, as BASE', a1.length > 0 && a1[0][2] === 1 && JSON.stringify(a1) === JSON.stringify(b1), JSON.stringify({ now: a1, base: b1 }));
  const used = run(`(()=>{ units=[]; seedBattle(7); const g=makeUnit('carn','ally',500,700,30,{owned:false,rank:3}), e=makeUnit('vael','enemy',540,700,30,{owned:false}); g.anim=BATTLE_ANIM.carn; e.anim=null; units=[g,e];
    e.maxHp=e.hp=1e9; e.speed=0; e.atkCd=99; g.target=e; g.greenCd=g.blueCd=99; g._gearNextCrit='hit'; g.atkCd=0; updateBattle(SIM_STEP); const c=g._atkClip; g.atkCd=0; g.glyphCrit=0; for(let i=0;i<200&&g.atkCd>0.5;i++) updateBattle(SIM_STEP); g.atkCd=0; updateBattle(SIM_STEP); return c+'|'+g._atkClip; })()`);
  ck('the crit clip plays on a crit swing and the attack clip on a normal one (u._atkClip crit / null)', used === 'crit|null', used);
  const casts = {};
  for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(kind))), y = JSON.parse(R0(CAST(kind))); casts[kind] = x;
    ck(`${kind}: the cast fires on the same tick, the effect lands on the same ticks (${x.fx.join(' ')}), the clip is held as long (${x.hold} s) and every unit matches BASE for 6 s`,
      x.fired != null && x.anim === kind && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ now: x, base: y }));
  }
  const fights = [[['carn', 'askel', 'vex'], ['carn', 'vesper', 'grosk'], 11], [['carn', 'pellucid'], ['rhukk', 'carn', 'vael'], 222],
                  [['carn', 'sloe', 'umbris'], ['askel', 'hurne', 'vex'], 5], [['gruel', 'carn', 'tharl'], ['sorrel', 'hollow', 'rhukk'], 77]];
  ck('whole fights (autoUlt, Carn on both sides, heroes carry BATTLE_ANIM as the server replay) with his crit at 0 are tick-for-tick identical to BASE',
    fights.every(([a, f, s]) => trace(run, s, a, f, 0) === trace(R0, s, a, f, 0)));
  ck('whole fights with his real crit (Bruiser 3%) are tick-for-tick identical to BASE + the v532 crit-clip rule (the art moves nothing)',
    fights.every(([a, f, s]) => trace(run, s, a, f, null) === withRule(R0, () => trace(R0, s, a, f, null))));
  const broken = JSON.parse(JSON.stringify(G)); broken.attack.relFrac = 0.6; broken.crit.fps = 20; broken.ult.n = 40;
  ck('CONTROL: the same fights with the timing moved (attack relFrac 0.6, crit 20 fps, ult 40 cells) diverge - the trace sees a timing change',
    fights.every(([a, f, s]) => { run(`globalThis.__svCa=BATTLE_ANIM.carn; BATTLE_ANIM.carn=${JSON.stringify(broken)}; 1`);
      try { return trace(run, s, a, f, 0) !== trace(R0, s, a, f, 0); } finally { run('BATTLE_ANIM.carn=globalThis.__svCa; 1'); } }));
  ck('CONTROL: the rule control is real - BASE with and without the crit-clip rule differ at his 3% (the roll moved in the RNG stream)',
    fights.some(([a, f, s]) => trace(R0, s, a, f, null) !== withRule(R0, () => trace(R0, s, a, f, null))));
  const plain = fights.every(([a, f, s]) => trace(run, s, a, f, null) === trace(R0, s, a, f, null));
  console.log('  info Carn at his real 3% crit vs plain BASE: fights ' + (plain ? 'identical' : 'NOT identical') + ' - the v532 crit-clip rule rolls his crit at the wind-up now that he has a crit clip (same chance, earlier in the RNG stream)');
  { const bs = JSON.parse(JSON.stringify(G)); bs.green.n = 56;
    run(`globalThis.__svCa=BATTLE_ANIM.carn; BATTLE_ANIM.carn=${JSON.stringify(bs)}; 1`);
    let c; try { c = JSON.parse(run(CAST('green'))); } finally { run('BATTLE_ANIM.carn=globalThis.__svCa; 1'); }
    ck('CONTROL: a green clip 0.33 s longer changes the skill hold the engine queues on (the cast check sees clip length)', c.hold !== casts.green.hold, String(c.hold)); }

  // 3. the art lands on those moments. Carn's swing hold (min(0.95 x atkInterval, clipDur / speed)) is the whole clip, so it plays at natural speed
  //    x his attack speed from the tick it starts; the blow is drawn at (blow tick - start tick) / CLK x fps x speed.
  const CLK = run('SIM_STEP*SIM_HZ*BATTLE_PACE');
  const sweep = (kind, rank) => JSON.parse(run(`(()=>{ units=[]; ended=false; battleTime=0; seedBattle(7); const g=makeUnit('carn','ally',500,700,30,{owned:false,rank:${rank}}), e=makeUnit('vael','enemy',540,700,30,{owned:false});
    g.anim=BATTLE_ANIM.carn; e.anim=null; g.glyphCrit=0; units=[g,e]; e.maxHp=e.hp=1e9; e.speed=0; e.atkCd=99; g.target=e; g.greenCd=g.blueCd=99; ${kind === 'crit' ? "g._gearNextCrit='hit';" : ''} g.atkCd=0;
    let st=null, hit=null, mul=null, lock=null, ai=null; const _dd=dealDamage; dealDamage=function(s){ if(s===g&&hit==null) hit=battleTime; return _dd.apply(this,arguments); };
    try{ for(let i=0;i<160&&hit==null;i++){ updateBattle(SIM_STEP); if(st==null&&g.attackAnim>0){ st=battleTime; mul=g._atkSpdMul; lock=g._animLockT; ai=g.atkInterval; } } } finally{ dealDamage=_dd; }
    return JSON.stringify({st,hit,clip:g._atkClip||'attack',mul,lock,ai}); })()`));
  for (const kind of ['attack', 'crit']) for (const rank of [1, 3, 5]) {
    const w = sweep(kind, rank), A = G[kind], d = (w.hit - w.st) / CLK * A.fps * w.mul;
    ck(`${kind} (rank ${rank}, attack speed x${w.mul}): the whole clip is the hold and the blow is drawn on cell ${A.contact} (source f${NEW.find(x => x[0] === kind)[4]}, the blade at full reach)`,
      w.clip === kind && Math.abs(w.lock - dur(A) / w.mul) < 1e-9 && Math.floor(d) === A.contact && run(`clipContactCell(BATTLE_ANIM.carn.${kind})`) === A.contact, JSON.stringify(w) + ' ' + d.toFixed(2));
  }
  const land = k => { const x = casts[k]; return k === 'green' ? x.fired : +x.fx[x.fx.length - 1].split('@')[1]; };
  for (const [s, , fps, c, f] of NEW.filter(x => ['green', 'blue', 'ult'].includes(x[0]))) {
    const t = land(s), d = t / CLK * fps;
    ck(`${s}: its blow ${s === 'green' ? '(the cast release)' : '(the form delivery landing)'} at ${t} fight s = ${(t / CLK).toFixed(3)} real s is drawn on cell ${c} (source f${f}) - ${d.toFixed(2)}`,
      Math.floor(d) === c && d - c > 0.15 && run(`clipContactCell(BATTLE_ANIM.carn.${s})`) === c, d.toFixed(2));
  }
  // sound: the rows sit on those moments
  const SD = JSON.parse(run('JSON.stringify(SFX_DATA.heroes.carn)')), SD0 = R0('JSON.stringify(SFX_DATA.heroes.carn)');
  ck('sound: Crimson Reap (S0382) peaks on the cleave landing (rule land = the ult contact cell), Reckless Blow on the release, Vein Burst on its landing, the swing on the blow (BLADE-HEAVY)',
    SD.ult[0].id === 'S0382' && SD.ult[0].on === 'land' && SD.green[0].on === 'release' && SD.blue[0].on === 'land' && SD.atk === 'LIB-ATK-BLADE-HEAVY' && JSON.parse(SD0).ult[0].on === 'cast');
  const ctl = JSON.parse(JSON.stringify(G)); ctl.crit.u = '/assets/anim/carn/carn_missing.webp?v=1142'; ctl.attack.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, ['crit', 'attack']).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
