'use strict';
// v1173 - MERIDIAN's seven and RAFE MARROW's ten new animations (Phil PASS 16 Oct 2026 "Both pass send them to claude", ChatGPT 11:28, REVIEW 16OCT2026 H3,
//   clean-source-manifest.json - the CORRECTED sets, official Hailuo Without Watermark exports, sha256 matched, cut from the silent twins).
//   MERIDIAN: idle, walk, ranged attack, hit, green Golden Quill, blue Plumb Line, ult Final Expedition (the final casts 567519836126564353 /
//   567519850848542723 / 567519866933702658). NO crit (Phil: he is ranged), no passive.
//   RAFE: idle, walk, attack = GUN, melee = SWORD (final 567520055807434758, never 567510731072684036), crit = GUN crit, critMelee = SWORD crit,
//   hit, green Pistol Barrage, blue Grappling Hook, ult Dead Man's Fortune. No passive. Sword and gun stay apart for the attack AND the crit:
//   each swing picks its clip by range (2.5 m, v339) and by its crit (rolled at the wind-up, v532), with the matching sound (gun / cutlass).
// ONE FRAMING, ONE SIZE: each hero's wide right-facing GREEN reference fits every clip's frame 0 at one scale; every state anchors on idle's
//   frame-0 figure, checked on the sheets as the engine draws them, with a CONTROL. TIMING DATA = BASE (clipDur 2.0 s, relFrac 0.5, hit 0.6 s).
// MERIDIAN's fights are tick-for-tick BASE's. RAFE's swing now LANDS ON ITS FUSE - the release cell of the clip it plays (the shot's flash, the
//   cutlass at full reach) - as every other hero's swing; on BASE it landed on the press. Same amounts; his casts are BASE's tick for tick.
//   CONTROLS: fights with Rafe differ from BASE; with RAFE_SWING.fuse off and his old clips back they are BASE again; fights without either hero
//   are BASE's.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'd37ad2b6';   // live v1172 (v1171 Vael + Deepcleft FX, website patch notes), the build this change sits on
const VER = process.env.EW_MR_VER || '1173';
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-base-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server')); for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
  fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE_SHA + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { baseOk = false; }
const OLD = path.join(BD, 'emberweave-heroes.html');
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const UMR = require('./helpers/anim-meridian-rafe-1173.js');
const run = load(HTML), R0 = baseOk ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 700) : '')); } };
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) { const b = fs.readFileSync(file); const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; }
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const py = args => JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'noxgrim_1166_check.py'), ROOT, JSON.stringify(args)], { maxBuffer: 1 << 24 }).toString());
const FR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/meridian_rafe_1173_frames.json'), 'utf8'));
const NEW = {
  meridian: [['idle', 62, 12, null], ['walk', 36, 36 * 24 / 49, null], ['attack', 48, 24, 24, 20], ['hit', 15, 25, null], ['green', 48, 24, 18, 20], ['blue', 48, 24, 18, 30], ['ult', 48, 24, 29, 60]],
  rafe: [['idle', 62, 12, null], ['walk', 36, 36 * 24 / 38, null], ['attack', 48, 24, 24, 64], ['melee', 48, 24, 24, 57], ['crit', 48, 24, 24, 67], ['critMelee', 48, 24, 24, 40],
         ['hit', 15, 25, null], ['green', 48, 24, 18, 72], ['blue', 48, 24, 21, 54], ['ult', 48, 24, 36, 81]] };
const WALK = { meridian: [27, 49], rafe: [46, 38] }, REF0 = { meridian: [405, 1052, 1079.903], rafe: [428, 1014, 1067.2617] };
const ACT = { meridian: ['attack', 'green', 'blue', 'ult'], rafe: ['attack', 'melee', 'crit', 'critMelee', 'green', 'blue', 'ult'] };
function gridProblems(G, list) {
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
// scripted swings vs a still dummy `gap` units away; crit = force the next swing's crit: start tick, release (shot FX or the blow), hit, amount, crit flag, clip
const SWING = (hero, gap, crit, haste) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('${hero}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',${500 + gap},700,30,{owned:false});
  g.anim=BATTLE_ANIM.${hero}; e.anim=null; g.glyphCrit=0; units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.atkCd=0; ${crit ? "g._gearNextCrit='hit';" : ''}
  const starts=[], hits=[], rels=[]; const _dd=dealDamage, _sp=spawnProjFx, _ss=spawnShot;
  spawnProjFx=function(){ rels.push(battleTime); return _sp.apply(this,arguments); }; spawnShot=function(s){ if(s===g) rels.push(battleTime); return _ss.apply(this,arguments); };
  dealDamage=function(s,t,a){ if(s===g){ const r=_dd.apply(this,arguments); hits.push({hit:battleTime,amt:Math.round(a),crit:t._critHit?1:0,clip:g._atkClip||'attack'}); t._critHit=false; return r; } return _dd.apply(this,arguments); };
  try{ for(let i=0;i<500&&hits.length<3;i++){ ${haste ? 'g.hasteMul=' + haste + '; g.hasteT=1;' : ''} const a0=g.attackAnim||0; updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.energy=0;
      e.x=${500 + gap}; e.y=700; g.x=500; g.y=700;   /* bodies held where staged (a sword-range dummy would be shoved out of 2.5 m) */
      if((g.attackAnim||0)>a0+1e-9) starts.push({st:battleTime,mul:g._atkSpdMul,ai:(g._atkI0||g.atkInterval)/g._atkSpdMul,free:null});
      const c=starts[starts.length-1]; if(c&&c.free==null&&!((g.attackAnim||0)>0)) c.free=battleTime;
      if(${crit ? 1 : 0}&&hits.length>=1) break; } } finally{ dealDamage=_dd; spawnProjFx=_sp; spawnShot=_ss; }
  /* pair each hit with the latest swing start at or before it (on BASE Rafe's hit lands in the start tick itself) */
  return JSON.stringify(hits.map(h=>{ const st=starts.filter(x=>x.st<=h.hit+1e-9).pop()||{}; const rl=rels.filter(t=>t>=(st.st||0)-1e-9&&t<=h.hit+1e-9); return Object.assign({},st,h,{rel:rl.length?rl[0]:h.hit}); })); })()`;
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
const FIGHT = (seed, a, f) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
  try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
    units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
    ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
    units.forEach(u=>buildFigure(u)); let clips={};
    const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ const a0=units.map(u=>u.attackAnim||0); updateBattle(SIM_STEP);
      units.forEach((u,j)=>{ if(u.key==='rafe'&&(u.attackAnim||0)>a0[j]+1e-9){ const c=u._atkClip||'attack'; clips[c]=(clips[c]||0)+1; } });
      tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); }
    let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return JSON.stringify({h:s.length+':'+h.toString(16),clips}); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
const fight = (f, s, a, e, undo) => { const r = load(f); if (undo) UMR.undoMR1173(r); return JSON.parse(r(FIGHT(s, a, e))); };   // a fresh load per fight

try {
  ck('control file (BASE page + its own external scripts from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  { const ARCH = process.env.EW_ARCHIVE || 'C:\\Users\\Home\\OneDrive\\Desktop\\Emberweave Archive';
    const man = h => { try { return JSON.parse(fs.readFileSync(path.join(ARCH, 'Game Art', 'Heroes', h, 'clips', 'REVIEW 16OCT2026 H3', 'clean-source-manifest.json'), 'utf8')); } catch (e) { return null; } };
    const mm = man('Meridian'), mr = man('Rafe Marrow');
    if (mm && mr) { const id = (m, re) => (m.find(x => re.test(x.slot)) || {}).creation;
      ck('sources: Meridian 7 and Rafe 10 manifest rows, every one Phil PASS, official Without Watermark; Meridian\'s final casts 567519836126564353 / 567519850848542723 / 567519866933702658 and no crit row; Rafe\'s final sword attack 567520055807434758 (not 567510731072684036)',
        mm.length === 7 && mr.length === 10 && mm.concat(mr).every(x => /Phil PASS/.test(x.status) && /Without Watermark/.test(x.export) && x.frames === 124) && !mm.some(x => /crit/.test(x.slot)) &&
        id(mm, /green/) === '567519836126564353' && id(mm, /blue/) === '567519850848542723' && id(mm, /ult/) === '567519866933702658' && id(mr, /attack sword/) === '567520055807434758' && !mr.some(x => x.creation === '567510731072684036')); }
    else console.log('  info the Archive is not reachable here - source manifests not re-read'); }
  const G = { meridian: JSON.parse(run('JSON.stringify(BATTLE_ANIM.meridian)')), rafe: JSON.parse(run('JSON.stringify(BATTLE_ANIM.rafe)')) };
  const G0 = { meridian: JSON.parse(R0('JSON.stringify(BATTLE_ANIM.meridian)')), rafe: JSON.parse(R0('JSON.stringify(BATTLE_ANIM.rafe)')) };
  ck('Meridian has exactly seven states (no crit, no passive); Rafe exactly ten (attack = gun, melee = sword, crit = gun crit, critMelee = sword crit; no passive)',
    Object.keys(G.meridian).sort().join() === NEW.meridian.map(x => x[0]).sort().join() && Object.keys(G.rafe).sort().join() === NEW.rafe.map(x => x[0]).sort().join() && !G.meridian.crit && !G0.rafe.crit);
  const baseSrc = fs.readFileSync(OLD, 'utf8');
  for (const hero of ['meridian', 'rafe']) {
    const S = NEW[hero].map(x => x[0]), A = G[hero], A0 = G0[hero];
    const bad = gridProblems(A, S);
    ck(hero + ': every new sheet exists, file = declared grid, within 2048 px and 4 MB (v1140), q95 lossy + alpha (v1158), anchors in the cell', bad.length === 0, bad.join('; '));
    ck(hero + ': new files at ?v=' + VER + ' that BASE never referenced; the old sheets are still on disk', S.every(s => A[s].u === `/assets/anim/${hero}/${hero}_${s}_${VER}.webp?v=${VER}` && !baseSrc.includes(`${hero}_${s}_${VER}`)) &&
      Object.keys(A0).every(s => fs.existsSync(fileOf(A0[s].u))));
    ck(hero + ': grids as cut: ' + NEW[hero].map(x => x[0] + ' ' + x[1] + '@' + (+x[2].toFixed(4)) + (x[3] != null ? ' c' + x[3] : '')).join(', '),
      NEW[hero].every(([s, n, fps, c]) => A[s].n === n && Math.abs(A[s].fps - fps) < 1e-5 && (c == null ? A[s].contact == null : A[s].contact === c)), JSON.stringify(S.map(s => [s, A[s].n, A[s].fps, A[s].contact])));
    ck(hero + ': the art faces RIGHT (flip:false), each state stands on its frame-0 pose (feet - top = figH), no ax drift, no pingpong', S.every(s => A[s].flip === false && A[s].feet - A[s].top === A[s].figH && !A[s].ax && !A[s].pingpong));
    const [w0, L] = WALK[hero], F = FR[hero].frames;
    ck(hero + `: walk = 36 cells over the ${L}-frame stride from f${w0} (loop [0,36], the stride's own ${(L / 24).toFixed(3)} s, stride 0.12 x 36/${L})`,
      A.walk.n === 36 && JSON.stringify(A.walk.loop) === '[0,36]' && Math.abs(A.walk.n / A.walk.fps - L / 24) < 1e-5 && Math.abs(A.walk.stride - 0.12 * 36 / L) < 1e-6 && F.walk[0] === w0 && F.walk.every((x, i) => Math.abs(x - (w0 + i * L / 36)) <= 0.5));
    ck(hero + ': idle 62 @12 over the whole 5.17 s clip', A.idle.n === 62 && A.idle.fps === 12 && JSON.stringify(F.idle) === JSON.stringify(Array.from({ length: 62 }, (_, i) => 2 * i)));
    const K = JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(S)}.map(s=>{ const c=BATTLE_ANIM.${hero}[s]; return texSheetK(c.fw,c.fh,c.cols,c.rows,c.figH/c.fh); })); } finally{ window.__texPhone=null; } })()`));
    ck(hero + ': phone - every sheet uploads at its own size (texSheetK 1), every figure drawn from 140-240 px', K.every(k => k === 1) && S.every(s => A[s].figH >= 140 && A[s].figH <= 240), JSON.stringify(K));
    { const RF = FR[hero].reference.states, r0 = REF0[hero];
      ck(hero + ': the wide right-facing GREEN reference fits every clip\'s frame 0 at one scale x' + Object.values(RF).map(x => x.k).join(' / ') + ', IoU ' + Object.values(RF).map(x => x.iou).join(' / ') + ' - one framing (its sole / cx within 2 source px = 0.7 sheet px of the anchors)',
        S.every(s => RF[s] && RF[s].k >= 1.40 && RF[s].k <= 1.42 && RF[s].iou > 0.95 && Math.abs(RF[s].sole - r0[1]) <= 2 && Math.abs(RF[s].cx - r0[2]) <= 2 && RF[s].iou_vs_idle_f0 > 0.97));
      const want = s => { const C = FR[hero].cut[s]; return { top: (r0[0] - C.box[1]) * C.sy, feet: (r0[1] - C.box[1]) * C.sy, cx: (r0[2] - C.box[0]) * C.sx }; };
      const off = S.map(s => { const w = want(s); return [s, +(A[s].feet - w.feet).toFixed(2), +(A[s].figH - (w.feet - w.top)).toFixed(2), +(A[s].cx - w.cx).toFixed(2)]; });
      ck(hero + `: every state anchors on idle's frame-0 figure (top ${r0[0]} / sole ${r0[1]} / cx ${r0[2]}) mapped into its sheet: feet within 0.6 px, figH within 1 px, cx within 0.06 px ` + JSON.stringify(off),
        off.every(([, a, b, c]) => Math.abs(a) <= 0.6 && Math.abs(b) <= 1.0 && Math.abs(c) <= 0.06)); }
    const cells0 = {}; for (const s of S) { if (FR[hero].frames[s][0] === 0) cells0[s] = 0; }
    const anim = {}; for (const s of S) anim[s] = A[s];
    const SC = py({ anim, cells0 }).scale;
    ck(hero + ': SAME SIZE, SAME SPOT - every state starting on frame 0 (' + Object.keys(SC).join(' ') + ') drawn as the engine draws it matches idle at best scale 1.00 +-0.01 within 2 px (best IoU ' + Object.values(SC).map(x => x.best_iou).join(' / ') + ')',
      Object.keys(SC).length >= 5 && Object.values(SC).every(x => Math.abs(x.k - 1) <= 0.0101 && Math.abs(x.dx) <= 2 && Math.abs(x.dy) <= 2 && x.best_iou > 0.92), JSON.stringify(SC));
    { const bad2 = JSON.parse(JSON.stringify(anim)); const ctl = ['attack', 'blue']; for (const s of ctl) { bad2[s].figH = Math.round(bad2[s].figH / 0.7); bad2[s].top = bad2[s].feet - bad2[s].figH; }
      const SC2 = py({ anim: bad2, cells0 }).scale;
      ck(hero + ': CONTROL - anchored as if attack / blue were on another framing (figH off by x0.7) they draw ~30% small and the check sees it', ctl.every(s => SC2[s].iou < 0.75 && SC2[s].k >= 1.03 - 1e-9), JSON.stringify(SC2)); }
    ck(hero + ': every action clip keeps clipDur 2.0 s and relFrac 0.5 (as BASE\'s), the hit its 0.6 s hold',
      ACT[hero].every(s => Math.abs(dur(A[s]) - 2) < 1e-12 && rel(A[s]) === 0.5 && !A[s].hold) && Object.keys(A0).filter(s => s !== 'idle' && s !== 'walk' && s !== 'hit').every(s => Math.abs(dur(A0[s]) - 2) < 1e-12) && Math.min(0.6, A.hit.n / A.hit.fps) === 0.6);
    ck(hero + ': frame maps - one source frame per cell, every contact cell on its named source frame',
      NEW[hero].every(([s, n, , c, f]) => FR[hero].frames[s].length === n && (c == null || FR[hero].frames[s][c] === f)));
  }
  ck('every other hero and monster has BATTLE_ANIM byte-for-byte BASE', H(run("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='meridian'&&k!=='rafe').map(k=>[k,BATTLE_ANIM[k]]))")) === H(R0("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='meridian'&&k!=='rafe').map(k=>[k,BATTLE_ANIM[k]]))")));
  const kit = (r, h) => r(`JSON.stringify([KITS.${h},HERO_ULT_ART.${h}||null,ABILITY_CAST.${h}||null,HERO_TYPES.${h},CASTER_BALL.${h}||null])`);
  ck('kits, ult art, cast times and hero lines of both heroes identical to BASE; every FX2_DEF entry BASE\'s', kit(run, 'meridian') === kit(R0, 'meridian') && kit(run, 'rafe') === kit(R0, 'rafe') && H(run('JSON.stringify(FX2_DEF)')) === H(R0('JSON.stringify(FX2_DEF)')));
  // MERIDIAN: swings, casts, whole fights on BASE's ticks
  { const a = JSON.parse(run(SWING('meridian', 250))), b = JSON.parse(R0(SWING('meridian', 250)));
    ck('meridian swings: every release and hit on the same tick, same amount, as BASE (' + a.length + ')', a.length >= 3 && JSON.stringify(a.map(x => [x.st, x.rel, x.hit, x.amt])) === JSON.stringify(b.map(x => [x.st, x.rel, x.hit, x.amt])), JSON.stringify({ a, b })); }
  for (const hero of ['meridian', 'rafe']) for (const kind of ['green', 'blue', 'ult']) { const x = JSON.parse(run(CAST(hero, kind))), y = JSON.parse(R0(CAST(hero, kind)));
    ck(`${hero} ${kind}: cast, effects (${x.fx.join(' ')}), hold (${x.hold} s) and every unit for 6 s identical to BASE`, x.fired != null && x.anim === kind && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ x, y })); }
  // RAFE: the clip by range and crit, the blow on the fuse
  const SW = (r, gap, crit, haste) => JSON.parse(r(SWING('rafe', gap, crit, haste)));
  { const far = SW(run, 250), close = SW(run, 40), farC = SW(run, 250, 1), closeC = SW(run, 40, 1);
    const far0 = SW(R0, 250), close0 = SW(R0, 40), farC0 = SW(R0, 250, 1), closeC0 = SW(R0, 40, 1);
    ck('rafe picks per swing: beyond 2.5 m the GUN (attack), within it the SWORD (melee); a crit swing plays the matching crit (crit = gun, critMelee = sword) and is flagged crit',
      far.every(x => x.clip === 'attack' && !x.crit) && close.every(x => x.clip === 'melee' && !x.crit) && farC[0].clip === 'crit' && farC[0].crit === 1 && closeC[0].clip === 'critMelee' && closeC[0].crit === 1,
      JSON.stringify({ far: far.map(x => x.clip), close: close.map(x => x.clip), farC, closeC }));
    ck('rafe: the blow lands on the swing\'s fuse (' + (far[0].hit - far[0].st).toFixed(4) + ' fight s after the swing starts = clipDur 2.0 x relFrac 0.5 x 0.82), the shot leaving with it; BASE landed it on the press (' + (far0[0].hit - far0[0].st).toFixed(4) + ' s)',
      [far, close].every(w => w.every(x => Math.abs(x.hit - x.st - 0.82) < 0.04 && Math.abs(x.rel - x.hit) < 1e-9)) && far0.every(x => Math.abs(x.hit - x.st) < 0.04));
    ck('rafe: the same amounts as BASE (gun ' + far[0].amt + ', sword x1.15 ' + close[0].amt + '; crits ' + farC[0].amt + ' / ' + closeC[0].amt + '), the same swing timer',
      far[0].amt === far0[0].amt && close[0].amt === close0[0].amt && farC[0].amt === farC0[0].amt && closeC[0].amt === closeC0[0].amt && far.map(x => (x.st).toFixed(3)).join() === far0.map(x => (x.st).toFixed(3)).join(), JSON.stringify({ far, far0, farC, farC0, closeC, closeC0 }));
    const u = load(HTML); UMR.undoMR1173(u); const fu = SW(u, 250), fu0 = far0;
    ck('CONTROL: with RAFE_SWING.fuse off and his old clips back the swing lands on the press again, as BASE, tick for tick', JSON.stringify(fu.map(x => [x.st, x.hit, x.amt])) === JSON.stringify(fu0.map(x => [x.st, x.hit, x.amt]))); }
  // contact cells re-derived from the engine: each swing clip at x1 (and the plain attacks at x1.25 / x0.8), the casts at x1
  const drawnSwing = (w, A) => { const D = dur(A) / w.mul, ah = Math.min(0.95 * w.ai, D), fit = D > ah && D <= ah * 1.6; return { d: fit ? (w.rel - w.free) / CLK / ah * A.n : (w.rel - w.st) / CLK * A.fps * w.mul, fit }; };
  for (const [hero, gap, crit, clip] of [['meridian', 250, 0, 'attack'], ['rafe', 250, 0, 'attack'], ['rafe', 40, 0, 'melee'], ['rafe', 250, 1, 'crit'], ['rafe', 40, 1, 'critMelee']]) for (const hs of (crit ? [0] : [0, 1.25, 0.8])) {
    const w = JSON.parse(run(SWING(hero, gap, crit, hs)))[0], A = G[hero][w.clip], { d, fit } = drawnSwing(w, A), ok = hs ? Math.abs(d - A.contact) <= 1.5 : Math.floor(d) === A.contact;
    ck(`${hero} ${w.clip} (x${w.mul.toFixed(2)}, ${fit ? 'fitted' : 'natural'}): the blow / release is drawn on cell ${d.toFixed(2)} - ${hs ? 'within 1.5 cells of' : 'the'} contact ${A.contact} (f${NEW[hero].find(x => x[0] === clip)[4]})`, w.clip === clip && ok && run(`clipContactCell(BATTLE_ANIM.${hero}.${clip})`) === A.contact, JSON.stringify(w) + ' ' + d.toFixed(2)); }
  for (const hero of ['meridian', 'rafe']) for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(hero, kind))), A = G[hero][kind], c = A.contact, d = x.fired / CLK * A.fps;
    ck(`${hero} ${kind}: the release at ${x.fired} fight s is drawn on cell ${d.toFixed(2)} = the contact ${c} (f${NEW[hero].find(z => z[0] === kind)[4]})`, Math.floor(d) === c && run(`clipContactCell(BATTLE_ANIM.${hero}.${kind})`) === c, d.toFixed(2)); }
  // whole fights
  const MF = [[['meridian', 'askel', 'vex'], ['grimsby', 'vesper', 'grosk'], 11], [['gruel', 'meridian', 'tharl'], ['hollow', 'calypsa', 'meridian'], 77], [['astra', 'quorrel', 'meridian'], ['maren', 'lumi', 'nox'], 31]];
  ck('meridian: whole fights (both sides) tick-for-tick BASE', MF.every(([a, f, s]) => fight(HTML, s, a, f).h === fight(OLD, s, a, f).h));
  const RF = [[['rafe', 'askel', 'vex'], ['grimsby', 'vesper', 'grosk'], 11], [['grosk', 'rafe'], ['pellucid', 'veyr', 'oakmir'], 222], [['rafe', 'sloe', 'astra'], ['askel', 'hurne', 'carn'], 5], [['tharl', 'vael'], ['rafe', 'kharos', 'lumi'], 64]];
  const rf = RF.map(([a, f, s]) => fight(HTML, s, a, f)), clips = rf.reduce((o, x) => { for (const k in x.clips) o[k] = (o[k] || 0) + x.clips[k]; return o; }, {});
  ck('CONTROL: whole fights with Rafe differ from BASE (his blow moved to its fuse); in them he plays ' + JSON.stringify(clips), RF.every(([a, f, s], i) => rf[i].h !== fight(OLD, s, a, f).h) && clips.attack > 0);
  ck('CONTROL: the same fights with his old clips and the press landing put back (undoMR1173) are BASE tick for tick - nothing else moved', RF.every(([a, f, s]) => fight(HTML, s, a, f, true).h === fight(OLD, s, a, f).h));
  const NONE = [[['askel', 'vesper', 'kharos'], ['vael', 'tick', 'lumi'], 11], [['nox', 'sorrel', 'umbris'], ['pellucid', 'veyr', 'oakmir'], 222], [['korvux', 'sloe', 'astra'], ['askel', 'hurne', 'carn'], 5]];
  ck('whole fights without Meridian or Rafe are tick-for-tick BASE', NONE.every(([a, f, s]) => fight(HTML, s, a, f).h === fight(OLD, s, a, f).h));
  // sound
  { const SD = JSON.parse(run('JSON.stringify({m:SFX_DATA.heroes.meridian,r:SFX_DATA.heroes.rafe})')), SD0 = JSON.parse(R0('JSON.stringify({m:SFX_DATA.heroes.meridian,r:SFX_DATA.heroes.rafe})'));
    const on = (x, slot, id) => ((x[slot] || []).find(e => e.id === id) || {}).on;
    const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8'));
    ck('sound peaks on contact: Meridian Final Expedition S0138 cast -> release (cell 29), Golden Quill S0134 / Plumb Line S0136 release; Rafe Pistol Barrage S0510 cast -> release (cell 18), Grappling Hook S0513 land, Dead Man\'s Fortune S0514 release; files unchanged',
      on(SD.m, 'ult', 'S0138') === 'release' && on(SD0.m, 'ult', 'S0138') === 'cast' && on(SD.m, 'green', 'S0134') === 'release' && on(SD.m, 'blue', 'S0136') === 'release' &&
      on(SD.r, 'green', 'S0510') === 'release' && on(SD0.r, 'green', 'S0510') === 'cast' && on(SD.r, 'blue', 'S0513') === 'land' && on(SD.r, 'ult', 'S0514') === 'release' &&
      MAN.rows.S0138.rule === 'release' && MAN.rows.S0510.rule === 'release' && H(run('JSON.stringify(SFX_DATA.files)')) === H(R0('JSON.stringify(SFX_DATA.files)')));
    ck('rafe\'s swing sound: the gun shot beyond 2.5 m, the (fused) cutlass within (sfxAtk melee flag = close), played on the blow\'s fuse; weapon rows as BASE',
      SD.r.atk === 'LIB-ATK-GUN' && SD.r.melee === 'LIB-ATK-BLADE-LIGHT' && JSON.stringify([SD.r.atk, SD.r.melee]) === JSON.stringify([SD0.r.atk, SD0.r.melee]) &&
      /if\(typeof SFX!=='undefined'&&SFX\.loop\) sfxAtk\(u,_fd,close\); \}/.test(fs.readFileSync(HTML, 'utf8')));
    ck('sound: every other hero\'s rows are BASE\'s', H(run("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='meridian'&&k!=='rafe').map(k=>[k,SFX_DATA.heroes[k]]))")) === H(R0("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='meridian'&&k!=='rafe').map(k=>[k,SFX_DATA.heroes[k]]))"))); }
  const ctl = JSON.parse(JSON.stringify(G.rafe)); ctl.crit.u = '/assets/anim/rafe/rafe_missing.webp?v=' + VER; ctl.attack.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, ['crit', 'attack']).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
