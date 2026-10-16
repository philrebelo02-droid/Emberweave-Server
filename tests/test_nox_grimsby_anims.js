'use strict';
// v1169 - NOX QUILLFINGER's eight and GRIMSBY's seven new animations (Phil PASS 16 Oct 2026, ChatGPT handoff 08:51:28, REVIEW 16OCT2026 H3,
//   clean-source-manifest.json - every clip "Phil PASS", official Hailuo Without Watermark exports, sha256 matched, cut from the silent twins).
//   NOX: idle, walk, attack (the final take, creation 567361975987597318 - never the rejected first attack), hit, green Lockpick Soul, blue
//   Forbidden Key, ult Open Every Door, passive Skeleton-Key Savant (an event clip the fifth key fires). No crit. His crescent hook throughout.
//   GRIMSBY: idle, walk, ranged notice attack, hit, green Overdue, blue Ledger Slam, ult Foreclosure. No passive, no crit. Four arms.
// ONE FRAMING, ONE SIZE (the Korvux v1162 method): the NEW standing art is the scale and anchor reference - the wide standing GREEN animation
//   reference, keyed and fitted onto each clip's frame 0, lands on every state of a hero at the same scale (x1.410-1.414 = 2176/1536) and the
//   same spot, so every state anchors on idle's frame-0 figure mapped into its own sheet. Checked on the sheets' own pixels as the engine
//   draws them (figH-normalised, cx / feet on one point) against idle, with a CONTROL (a state cut on a different framing fails).
// THE ART IS TIMED TO THE ENGINE: the timing data the engine reads is BASE's (clipDur 2.0 s, relFrac 0.5, the hit's 0.6 s hold); each clip's
//   contact cell is the cell drawn when the engine releases / lands it, re-derived from the engine's own ticks. GRIMSBY's fights are tick-for-tick
//   BASE's (CONTROL: the timing moved diverges). NOX's fights change - Phil's ranged magic change (tests/test_nox_ranged_1166.js) - so his
//   casts are checked tick for tick against BASE (cast, release, hold, effect ticks) and his passive clip against the fifth-key moment.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'fb3dca16';   // live v1166 (the hotfix; v1165 sound + v1167 walls under it), the build this change sits on
const VER = process.env.EW_NOXGRIM_VER || '1169';
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'noxg-base-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server')); for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
  fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE_SHA + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { baseOk = false; }
const OLD = path.join(BD, 'emberweave-heroes.html');
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); const r = src => vm.runInContext(src, h.ctx); require('./helpers/anim-meridian-rafe-1173.js').undoMR1173(r); return r; };   // v1173: Meridian / Rafe as v1169 on every page - tests/test_meridian_rafe_1173.js checks them
const run = load(HTML), R0 = baseOk ? load(OLD) : null;
require('./helpers/vael-fx-1171.js').undoVaelFx1171(run);   // v1171: Vael's and Deepcleft's FX entries + ownFx tags go back to v1169's (tests/test_vael_deepcleft_fx_1171.js checks them)
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 700) : '')); } };
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) { const b = fs.readFileSync(file); const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; }
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const py = args => JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'noxgrim_1166_check.py'), ROOT, JSON.stringify(args)], { maxBuffer: 1 << 24 }).toString());
const FR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/nox_grimsby_1166_frames.json'), 'utf8'));
// [state, cells, fps, contact cell (null = none), source frame on it]
const NEW = {
  nox: [['idle', 62, 12, null], ['walk', 36, 36 * 24 / 49, null], ['attack', 48, 24, 27, 48], ['hit', 15, 25, null], ['green', 48, 24, 18, 44], ['blue', 48, 24, 18, 40], ['ult', 48, 24, 40, 64], ['passive', 48, 24, null]],
  grimsby: [['idle', 62, 12, null], ['walk', 36, 17.28, null], ['attack', 48, 24, 30, 49], ['hit', 15, 25, null], ['green', 48, 24, 18, 42], ['blue', 48, 24, 30, 42], ['ult', 48, 24, 29, 76]] };
const WALK = { nox: [32, 49], grimsby: [29, 50] }, REF0 = { nox: [355, 1063, 1030.8676], grimsby: [349, 1069, 1081.2726] };
const ACT = ['attack', 'green', 'blue', 'ult'];
function gridProblems(G, list, hero) {
  const bad = [];
  for (const st of list) { const A = G[st]; if (!A) { bad.push(st + ' missing entry'); continue; }
    const f = fileOf(A.u); if (!fs.existsSync(f)) { bad.push(st + ' missing file'); continue; }
    const sz = webpSize(f), ch = chunks(fs.readFileSync(f));
    if (A.n > A.cols * A.rows) bad.push(st + ' n>grid');
    if (A.fw * A.cols > 2048 || A.fh * A.rows > 2048) bad.push(st + ' >2048 (the v1140 phone budget)');
    if (fs.statSync(f).size > 4e6) bad.push(st + ' file > 4 MB');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) bad.push(st + ' not a q95 lossy WebP with alpha (v1158)');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top >= 0 && A.top < A.feet)) bad.push(st + ' anchor outside cell'); }
  return bad;
}
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const CLK = 0.6724;
const dur = A => (A.pingpong ? 2 * A.n - 2 : A.n) / A.fps, rel = A => (A.relFrac != null ? A.relFrac : 0.5);
// scripted swings: the hero vs a still dummy 8 m away (both are ranged now) - every swing: start tick, the release (the projectile leaves), the hit
const SWING = (hero, haste) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('${hero}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',${500 + 8 * 28.2},700,30,{owned:false});
  g.anim=BATTLE_ANIM.${hero}; e.anim=null; g.glyphCrit=0; units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.atkCd=0;
  const out=[]; let cur=null; const _dd=dealDamage, _sp=spawnProjFx, _ss=spawnShot;
  const rel=()=>{ if(cur&&cur.rel==null) cur.rel=battleTime; };
  spawnProjFx=function(){ rel(); return _sp.apply(this,arguments); }; spawnShot=function(s){ if(s===g) rel(); return _ss.apply(this,arguments); };
  dealDamage=function(s,t,a){ if(s===g&&cur&&cur.hit==null){ cur.hit=battleTime; cur.amt=Math.round(a); out.push(cur); cur=null; } return _dd.apply(this,arguments); };
  try{ for(let i=0;i<500&&out.length<3;i++){ ${haste ? 'g.hasteMul=' + haste + '; g.hasteT=1;' : ''} const a0=g.attackAnim||0; updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.energy=0;
      if(!cur&&(g.attackAnim||0)>a0+1e-9) cur={st:battleTime,mul:g._atkSpdMul,ai:(g._atkI0||g.atkInterval)/g._atkSpdMul,free:null,clip:g._atkClip||'attack'};
      else if(cur&&cur.free==null&&!((g.attackAnim||0)>0)) cur.free=battleTime; } } finally{ dealDamage=_dd; spawnProjFx=_sp; spawnShot=_ss; }
  return JSON.stringify(out); })()`;
const CAST = (hero, kind) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
  const g=makeUnit('${hero}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false}); const e2=makeUnit('tick','enemy',560,740,30,{owned:false});
  g.anim=BATTLE_ANIM.${hero}; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=50;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.hp=g.maxHp*0.5;
  const fx=[], dm=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const _dd=dealDamage; dealDamage=function(s,t){ if(s===g) dm.push(t.key+'@'+battleTime.toFixed(4)); return _dd.apply(this,arguments); };
  g._castSM=1; g._castLv=1;
  try{ if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS.${hero}['${kind}']);
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let fired=null; let pend=!!g._pend; const tr=[];
    for(let i=0;i<Math.round(6/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=50; e2.energy=50;
      if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4); if(g._pend) pend=true;
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),Math.round(u.energy||0)].join(':')).join('|')); }
    return JSON.stringify({hold,anim,fired,fx,dm,trace:tr.join('#').length+':'+tr.join('#').split('').reduce((h,c)=>(Math.imul(h^c.charCodeAt(0),16777619)>>>0),2166136261)});
  } finally { doEffect=_de; dealDamage=_dd; } })()`;
const FIGHT = (seed, a, f, extra) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
  try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
    units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
    ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
    units.forEach(u=>buildFigure(u)); ${extra || ''}
    let pc={}, keys5=[]; const _fp=firePassiveClip; firePassiveClip=function(o,h){ if(o&&o.anim===BATTLE_ANIM[o.key]) (pc[o.key]=pc[o.key]||[]).push([+battleTime.toFixed(4),+(+h).toFixed(3)]); return _fp.apply(this,arguments); };
    const tr=[]; try{ for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ const k0=units.filter(u=>u.key==='nox').map(u=>u._masterT||0); updateBattle(SIM_STEP);
        units.filter(u=>u.key==='nox').forEach((u,j)=>{ if((u._masterT||0)===1&&!k0[j]) keys5.push(+battleTime.toFixed(4)); });
        tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); } }
    finally{ firePassiveClip=_fp; }
    let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return JSON.stringify({h:s.length+':'+h.toString(16),pc,keys5}); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
const fight = (f, s, a, e, extra) => JSON.parse(load(f)(FIGHT(s, a, e, extra)));   // a fresh load per fight (a fight leaves global counters behind)

try {
  ck('control file (BASE page + its own external scripts from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  // the sources: the manifests, Phil PASS, the final Nox attack
  { const ARCH = process.env.EW_ARCHIVE || 'C:\\Users\\Home\\OneDrive\\Desktop\\Emberweave Archive';
    const man = h => { try { return JSON.parse(fs.readFileSync(path.join(ARCH, 'Game Art', 'Heroes', h, 'clips', 'REVIEW 16OCT2026 H3', 'clean-source-manifest.json'), 'utf8')); } catch (e) { return null; } };
    const mn = man('Nox Quillfinger'), mg = man('Grimsby');
    if (mn && mg) ck('sources: Nox 8 and Grimsby 7 clean-source-manifest rows, every one "Phil PASS" from the official Without Watermark export; Nox\'s attack is the final take (creation 567361975987597318)',
      mn.length === 8 && mg.length === 7 && mn.concat(mg).every(x => x.status === 'Phil PASS' && /Without Watermark/.test(x.export) && x.frames === 124) && mn.find(x => /attack/.test(x.slot)).creationId === '567361975987597318');
    else console.log('  info the Archive is not reachable here - source manifests not re-read'); }
  const G = { nox: JSON.parse(run('JSON.stringify(BATTLE_ANIM.nox)')), grimsby: JSON.parse(run('JSON.stringify(BATTLE_ANIM.grimsby)')) };
  const G0 = { nox: JSON.parse(R0('JSON.stringify(BATTLE_ANIM.nox)')), grimsby: JSON.parse(R0('JSON.stringify(BATTLE_ANIM.grimsby)')) };
  ck('Nox has exactly eight states (idle walk attack hit green blue ult passive) - no crit; Grimsby exactly seven (no passive, no crit); BASE had neither crit nor passive',
    Object.keys(G.nox).sort().join() === NEW.nox.map(x => x[0]).sort().join() && Object.keys(G.grimsby).sort().join() === NEW.grimsby.map(x => x[0]).sort().join() && !G0.nox.passive && !G0.grimsby.passive && !G0.nox.crit && !G0.grimsby.crit);
  const baseSrc = fs.readFileSync(OLD, 'utf8');
  for (const hero of ['nox', 'grimsby']) {
    const S = NEW[hero].map(x => x[0]), A = G[hero], A0 = G0[hero];
    const bad = gridProblems(A, S, hero);
    ck(hero + ': every new sheet exists, file = declared grid, within 2048 px and 4 MB (v1140), q95 lossy + alpha (v1158), anchors in the cell', bad.length === 0, bad.join('; '));
    ck(hero + ': new files at ?v=' + VER + ' that BASE never referenced (never a reused asset version); the v21 sheets are still on disk', S.every(s => A[s].u === `/assets/anim/${hero}/${hero}_${s}_${VER}.webp?v=${VER}` && !baseSrc.includes(`${hero}_${s}_${VER}`)) &&
      Object.keys(A0).every(s => fs.existsSync(fileOf(A0[s].u))));
    ck(hero + ': grids as cut (cells / fps / contact cell): ' + NEW[hero].map(x => x[0] + ' ' + x[1] + '@' + (+x[2].toFixed(4)) + (x[3] != null ? ' c' + x[3] : '')).join(', '),
      NEW[hero].every(([s, n, fps, c]) => A[s].n === n && Math.abs(A[s].fps - fps) < 1e-5 && (c == null ? A[s].contact == null : A[s].contact === c)), JSON.stringify(S.map(s => [s, A[s].n, A[s].fps, A[s].contact])));
    ck(hero + ': the art faces RIGHT (flip:false), each state stands on its frame-0 pose (feet - top = figH), no ax drift table, no pingpong', S.every(s => A[s].flip === false && A[s].feet - A[s].top === A[s].figH && !A[s].ax && !A[s].pingpong));
    const [w0, L] = WALK[hero], F = FR[hero].frames;
    ck(hero + `: walk = 36 cells over the ${L}-frame stride f${w0}-f${w0 + L - 1} (loop [0,36], ${(36 * 24 / L).toFixed(3)} fps = the stride's own ${(L / 24).toFixed(3)} s, stride 0.12 x 36/${L}) - the v1155 slim walk`,
      A.walk.n === 36 && JSON.stringify(A.walk.loop) === '[0,36]' && Math.abs(A.walk.n / A.walk.fps - L / 24) < 1e-5 && Math.abs(A.walk.stride - 0.12 * 36 / L) < 1e-6 && F.walk.length === 36 && F.walk[0] === w0 && F.walk.every((x, i) => Math.abs(x - (w0 + i * L / 36)) <= 0.5));
    ck(hero + ': idle keeps the clip\'s own timing, 62 @12 over the whole 5.17 s breath (no clean sub-loop - 24 cells would be 4.6 fps, steppy), as Korvux / Veyr', A.idle.n === 62 && A.idle.fps === 12 && JSON.stringify(F.idle) === JSON.stringify(Array.from({ length: 62 }, (_, i) => 2 * i)));
    const K = JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(S)}.map(s=>{ const c=BATTLE_ANIM.${hero}[s]; return texSheetK(c.fw,c.fh,c.cols,c.rows,c.figH/c.fh); })); } finally{ window.__texPhone=null; } })()`));
    ck(hero + ': phone - every new sheet uploads at its own size (texSheetK 1), every figure drawn from 140-240 px', K.every(k => k === 1) && S.every(s => A[s].figH >= 140 && A[s].figH <= 240), JSON.stringify(K));
    // SCALE + ANCHOR: the new standing art as the reference
    { const RF = FR[hero].reference.states, r0 = REF0[hero];
      ck(hero + ': the NEW standing art (wide standing GREEN animation reference) fits every clip\'s frame 0 at one scale x' + Object.values(RF).map(x => x.k).join(' / ') + ' (2176/1536 = 1.4167), IoU ' + Object.values(RF).map(x => x.iou).join(' / ') + ', its sole on ' + Object.values(RF).map(x => x.sole).join(' / ') + ' - one framing for every state',
        S.every(s => RF[s] && RF[s].k >= 1.405 && RF[s].k <= 1.420 && RF[s].iou > 0.94 && Math.abs(RF[s].sole - r0[1]) <= 1.5 && Math.abs(RF[s].cx - r0[2]) <= 1.5 && RF[s].iou_vs_idle_f0 > 0.97));
      const want = s => { const C = FR[hero].cut[s]; return { top: (r0[0] - C.box[1]) * C.sy, feet: (r0[1] - C.box[1]) * C.sy, cx: (r0[2] - C.box[0]) * C.sx }; };
      const off = S.map(s => { const w = want(s); return [s, +(A[s].feet - w.feet).toFixed(2), +(A[s].figH - (w.feet - w.top)).toFixed(2), +(A[s].cx - w.cx).toFixed(2)]; });
      ck(hero + `: every state anchors on idle's frame-0 figure (top ${r0[0]} / sole ${r0[1]} / cx ${r0[2]}) mapped into its own sheet: feet within 0.6 px, figH within 1 px (top and feet are each rounded to a whole px), cx within 0.06 px - [state, feet, figH, cx] ` + JSON.stringify(off),
        off.every(([, a, b, c]) => Math.abs(a) <= 0.6 && Math.abs(b) <= 1.0 && Math.abs(c) <= 0.06)); }
    const cells0 = {}; for (const s of S) { const c = FR[hero].frames[s].indexOf(0); if (c === 0) cells0[s] = c; }
    const anim = {}; for (const s of S) anim[s] = A[s];
    const SC = py({ anim, cells0 }).scale;
    ck(hero + ': SAME SIZE, SAME SPOT - every state with a frame-0 cell (' + Object.keys(SC).join(' ') + '), drawn as the engine draws it, matches idle\'s at best scale 1.00 +-0.01 and a best shift within 2 px (best IoU ' + Object.values(SC).map(x => x.best_iou).join(' / ') + '; the frame-0 poses differ a little - a swinging chain, a coat tail)',
      Object.keys(SC).length >= 5 && Object.values(SC).every(x => Math.abs(x.k - 1) <= 0.0101 && Math.abs(x.dx) <= 2 && Math.abs(x.dy) <= 2 && x.best_iou > 0.92), JSON.stringify(SC));
    { const bad2 = JSON.parse(JSON.stringify(anim)); for (const s of ACT) { bad2[s].figH = Math.round(bad2[s].figH / 0.7); bad2[s].top = bad2[s].feet - bad2[s].figH; }
      const SC2 = py({ anim: bad2, cells0 }).scale;
      ck(hero + ': CONTROL - anchored as if the action clips were on another framing (figH off by x0.7, as Korvux\'s headroom reference) they draw ~30% small and the check sees it (best scale ' + ACT.map(s => SC2[s].k).join(' / ') + ', IoU ' + ACT.map(s => SC2[s].iou).join(' / ') + ')',
        ACT.every(s => SC2[s].iou < 0.75 && SC2[s].k >= 1.03 - 1e-9)); }
    // timing DATA
    ck(hero + ': every action clip (attack, green, blue, ult) keeps clipDur 2.0 s and relFrac 0.5 exactly as BASE\'s; the hit keeps its 0.6 s hold (min(0.6, 15 @25)); no hold override',
      ACT.every(s => Math.abs(dur(A[s]) - 2) < 1e-12 && rel(A[s]) === 0.5 && !A[s].hold && Math.abs(dur(A0[s]) - 2) < 1e-12 && rel(A0[s]) === 0.5) && Math.min(0.6, A.hit.n / A.hit.fps) === 0.6 && Math.min(0.6, A0.hit.n / A0.hit.fps) === 0.6);
    ck(hero + ': frame maps (tests/fixtures/nox_grimsby_1166_frames.json) - one source frame per cell, every contact cell on its named source frame with the frames either side consecutive round it',
      NEW[hero].every(([s, n, , c, f]) => FR[hero].frames[s].length === n && (c == null || (FR[hero].frames[s][c] === f && FR[hero].frames[s][c - 1] === f - 1 && FR[hero].frames[s][c + 1] === f + 1))));
  }
  ck('every other hero and monster has BATTLE_ANIM byte-for-byte BASE', H(run("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='nox'&&k!=='grimsby').map(k=>[k,BATTLE_ANIM[k]]))")) === H(R0("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='nox'&&k!=='grimsby').map(k=>[k,BATTLE_ANIM[k]]))")));
  const kit = (r, h) => r(`JSON.stringify([KITS.${h},HERO_ULT_ART.${h}||null,ABILITY_CAST.${h}||null,FX2_DEF.${h}_green||null,FX2_DEF.${h}_blue||null,FX2_DEF.${h}_ult||null])`);
  ck('kits, ult art, cast times and spell FX plates of both heroes identical to BASE; Grimsby\'s HERO_TYPES line identical to BASE (no gameplay change for him)', kit(run, 'nox') === kit(R0, 'nox') && kit(run, 'grimsby') === kit(R0, 'grimsby') &&
    run('JSON.stringify(HERO_TYPES.grimsby)') === R0('JSON.stringify(HERO_TYPES.grimsby)'));
  ck('every FX2_DEF entry is byte-for-byte BASE', H(run('JSON.stringify(FX2_DEF)')) === H(R0('JSON.stringify(FX2_DEF)')));
  // GRIMSBY: casts and whole fights on BASE's ticks
  for (const kind of ['green', 'blue', 'ult']) { const x = JSON.parse(run(CAST('grimsby', kind))), y = JSON.parse(R0(CAST('grimsby', kind)));
    ck(`grimsby ${kind}: the cast fires on the same tick, effects on the same ticks (${x.fx.join(' ')}), held as long (${x.hold} s), every unit matches BASE for 6 s`, x.fired != null && x.anim === kind && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ x, y })); }
  { const a = JSON.parse(run(SWING('grimsby'))), b = JSON.parse(R0(SWING('grimsby')));
    ck('grimsby swings: every release and hit on the same tick, same amount, as BASE (' + a.length + ' swings)', a.length >= 3 && JSON.stringify(a.map(x => [x.st, x.rel, x.hit, x.amt])) === JSON.stringify(b.map(x => [x.st, x.rel, x.hit, x.amt])), JSON.stringify({ a, b })); }
  const GF = [[['grimsby', 'askel', 'vex'], ['grimsby', 'vesper', 'grosk'], 11], [['grimsby', 'pellucid'], ['rhukk', 'korvux', 'vael'], 222], [['grimsby', 'sloe', 'umbris'], ['askel', 'hurne', 'carn'], 5],
    [['gruel', 'aureth', 'tharl'], ['grimsby', 'hollow', 'calypsa'], 77], [['astra', 'quorrel', 'grimsby'], ['maren', 'lumi', 'hollow'], 31]];
  ck('grimsby: whole fights (autoUlt, both sides, heroes carry BATTLE_ANIM as the server replay) are tick-for-tick BASE (hp, x, y, alive, energy, swing timer)', GF.every(([a, f, s]) => fight(HTML, s, a, f).h === fight(OLD, s, a, f).h));
  { const broken = JSON.parse(JSON.stringify(G.grimsby)); broken.attack.fps = 20; broken.ult.n = 40;
    ck('grimsby CONTROL: the same fights with his timing moved (attack 20 fps, ult 40 cells) diverge - the trace sees a timing change', GF.every(([a, f, s]) => fight(HTML, s, a, f, `BATTLE_ANIM.grimsby=${JSON.stringify(broken)}; units.forEach(u=>{ if(u.key==='grimsby') u.anim=BATTLE_ANIM.grimsby; });`).h !== fight(OLD, s, a, f).h)); }
  // NOX: the casts are BASE's ticks (the gameplay change is his range and damage type, tests/test_nox_ranged_1166.js)
  for (const kind of ['green', 'blue', 'ult']) { const x = JSON.parse(run(CAST('nox', kind))), y = JSON.parse(R0(CAST('nox', kind)));
    ck(`nox ${kind}: the cast fires on the same tick, every effect on the same tick (${x.fx.join(' ')}; hits ${x.dm.slice(0, 2).join(' ') || 'none'}), held as long (${x.hold} s) as BASE (the amounts change: his damage is Magic now)`,
      x.fired != null && x.anim === kind && x.fired === y.fired && x.hold === y.hold && JSON.stringify(x.fx) === JSON.stringify(y.fx) && JSON.stringify(x.dm) === JSON.stringify(y.dm), JSON.stringify({ x, y })); }
  // contact cells re-derived from the engine: the swing's release (the projectile leaves) at x1 / x1.25 / x0.8, casts at x1
  for (const hero of ['nox', 'grimsby']) for (const hs of [0, 1.25, 0.8]) {
    const w = JSON.parse(run(SWING(hero, hs)))[0], A = G[hero].attack, D = dur(A) / w.mul, ah = Math.min(0.95 * w.ai, D), fit = D > ah && D <= ah * 1.6;
    const d = fit ? (w.rel - w.free) / CLK / ah * A.n : (w.rel - w.st) / CLK * A.fps * w.mul, ok = hs ? Math.abs(d - A.contact) <= 1.5 : Math.floor(d) === A.contact;   // hasted / slowed: the engine fits the clip into a shorter / longer hold, so the release drifts up to ~1.5 cells (Aureth's v1153 swing the same: 26.0 / 29.3 round 27)
    ck(`${hero} attack (attack speed x${w.mul.toFixed(2)}, ${fit ? 'fitted into his ' + ah.toFixed(2) + ' s swing hold' : 'natural speed'}): the release is drawn on cell ${d.toFixed(2)} - ${hs ? 'within 1.5 cells of the contact ' + A.contact : 'the contact cell ' + A.contact + ' (source f' + NEW[hero][2][4] + ')'}`,
      ok && run(`clipContactCell(BATTLE_ANIM.${hero}.attack)`) === A.contact && fit === (hero === 'nox'), JSON.stringify(w) + ' ' + d.toFixed(2));
  }
  for (const hero of ['nox', 'grimsby']) for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(hero, kind))), A = G[hero][kind], c = A.contact, f = NEW[hero].find(z => z[0] === kind)[4];
    const land = +x.fx[x.fx.length - 1].split('@')[1], t = c >= 30 && x.fx.length > 1 ? land : x.fired, d = t / CLK * A.fps;
    ck(`${hero} ${kind}: the ${t === x.fired ? 'release' : 'landing'} at ${t} fight s = ${(t / CLK).toFixed(3)} real s is drawn on cell ${c} (source f${f}) - ${d.toFixed(2)}`, Math.floor(d) === c && d - c > 0.15 && run(`clipContactCell(BATTLE_ANIM.${hero}.${kind})`) === c, d.toFixed(2));
  }
  { const x = JSON.parse(run(CAST('nox', 'ult'))), d = x.fired / CLK * 24;
    ck(`nox ult: the 0.8 s release (${x.fired} fight s) is drawn on cell ${d.toFixed(2)} = cell 29, the lock held out (f53), before the shatter on 40`, Math.floor(d) === 29 && FR.nox.frames.ult[29] === 53); }
  // NOX's PASSIVE: the fifth key fires it, as an event clip of 2.0 s
  { const NF = [[['nox', 'askel', 'vesper'], ['vael', 'tick', 'lumi'], 11], [['grosk', 'nox'], ['pellucid', 'veyr', 'oakmir'], 222], [['nox', 'sloe', 'astra'], ['askel', 'hurne', 'carn'], 5]];
    const res = NF.map(([a, f, s]) => fight(HTML, s, a, f)), all = res.flatMap(r => r.pc.nox || []), k5 = res.flatMap(r => r.keys5);
    ck('nox passive: in whole fights the fifth key (Skeleton-Key Savant reaching 5) plays his passive clip on that very tick, 2.0 s (' + all.length + ' plays at ' + all.map(x => x[0]).join(', ') + '; 5-key moments ' + k5.join(', ') + ')',
      all.length > 0 && all.length === k5.length && all.every((x, i) => Math.abs(x[0] - k5[i]) < 1e-6 && x[1] === 2) && G.nox.passive.event === true);
    const b = NF.map(([a, f, s]) => fight(OLD, s, a, f)).flatMap(r => r.pc.nox || []);
    ck('nox passive CONTROL: on BASE (no passive clip since v1155) the same fights play none', b.length === 0); }
  // sound rows: peaks on the contact cells
  { const SD = JSON.parse(run('JSON.stringify({n:SFX_DATA.heroes.nox,g:SFX_DATA.heroes.grimsby})')), SD0 = JSON.parse(R0('JSON.stringify({n:SFX_DATA.heroes.nox,g:SFX_DATA.heroes.grimsby})'));
    const on = (x, slot, id) => ((x[slot] || []).find(e => e.id === id) || {}).on;
    const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8'));
    ck('sound peaks on contact: Nox Lockpick Soul S0329 release (cell 18), Forbidden Key S0331 cast -> release (cell 18), Open Every Door S0332 cast -> release (cell 29) + S0333 land (the shatter, cell 40); Grimsby Overdue S0413 cast -> release (cell 18), Ledger Slam S0414 land (cell 30), Foreclosure S0415 cast -> release (cell 29); the files unchanged',
      on(SD.n, 'green', 'S0329') === 'release' && on(SD.n, 'blue', 'S0331') === 'release' && on(SD.n, 'ult', 'S0332') === 'release' && on(SD.n, 'ult', 'S0333') === 'land' &&
      on(SD.g, 'green', 'S0413') === 'release' && on(SD.g, 'blue', 'S0414') === 'land' && on(SD.g, 'ult', 'S0415') === 'release' &&
      on(SD0.n, 'blue', 'S0331') === 'cast' && on(SD0.n, 'ult', 'S0332') === 'cast' && on(SD0.g, 'green', 'S0413') === 'cast' && on(SD0.g, 'ult', 'S0415') === 'cast' &&
      ['S0329', 'S0331', 'S0332', 'S0413', 'S0415'].every(k => MAN.rows[k].rule === 'release') && H(run('JSON.stringify(SFX_DATA.files)')) === H(R0('JSON.stringify(SFX_DATA.files)')));
    ck('sound: every other hero\'s rows are BASE\'s; Grimsby keeps his thrown-paper weapon sound', H(run("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='nox'&&k!=='grimsby').map(k=>[k,SFX_DATA.heroes[k]]))")) === H(R0("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='nox'&&k!=='grimsby').map(k=>[k,SFX_DATA.heroes[k]]))")) && SD.g.atk === SD0.g.atk); }
  const ctl = JSON.parse(JSON.stringify(G.nox)); ctl.blue.u = '/assets/anim/nox/nox_missing.webp?v=' + VER; ctl.attack.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, ['blue', 'attack']).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
