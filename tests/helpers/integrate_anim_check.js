'use strict';
// The generated hero-animation test (tools/integrate_hero.py wire -> tests/test_<hero>_anim_<ver>.js) - every check the hand-made v1153-v1175 tests ran,
// read from tests/fixtures/<hero>_<ver>_integrate.json instead of written out per hero:
//   sources (the Archive manifest's PASS rows and creation ids), sheets (grid = file, <= 2048 px / 4 MB, q95 lossy + alpha, new ?v=, old files kept),
//   grids / fps / contact as cut, walk + idle rules, phone texSheetK 1 and figures 140-240 px, anchors = the reference mapped into each sheet,
//   SAME SIZE SAME SPOT as drawn (+ CONTROL), timing data (clipDur 2.0 / relFrac 0.5 / hit 0.6 s), frame maps, every other hero / kit / FX / hero
//   line = BASE (autoAlt the only allowed change), casts identical, swings on BASE ticks with BASE amounts, A / B alternation, forced crit plays the
//   crit clip, contact cells re-derived (x1, haste x1.25, slow x0.8), whole fights tick-identical (crit 0 = BASE; real crit = BASE + the v532 rule
//   when the crit clip is new; CONTROL: a slowed swing diverges), fights without the hero = BASE, sound rows, skill previews, ghost alpha, grid CONTROL.
// usage (from the generated test): require('./helpers/integrate_anim_check.js')(path.join(__dirname, 'fixtures', '<hero>_<ver>_integrate.json'))
module.exports = function checkHero(FIXTURE) {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const ROOT = path.resolve(__dirname, '..', '..');
const FX = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const HERO = FX.hero, VER = process.env.EW_INT_VER || FX.version, S = FX.order;
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || FX.base;
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'int-base-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server'));
  for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js']) {
    try { fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE_SHA + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { if (f === 'emberweave-heroes.html') throw e; } } } catch (e) { baseOk = false; }
const OLD = path.join(BD, 'emberweave-heroes.html');
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = baseOk ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 700) : '')); } };
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) { const b = fs.readFileSync(file); const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; }
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const py = args => JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'integrate_scale_check.py'), ROOT, JSON.stringify(args)], { maxBuffer: 1 << 24 }).toString());
const SWINGS = ['attack', 'attackB', 'crit', 'melee', 'critMelee'], CASTS = ['green', 'blue', 'ult'];
const ACT = S.filter(s => SWINGS.includes(s) || CASTS.includes(s) || s === 'passive');
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
const SWING = (hero, gap, crit, haste, armN) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('${hero}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',${500 + gap},700,30,{owned:false});
  g.anim=BATTLE_ANIM.${hero}; e.anim=null; g.glyphCrit=0; units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.atkCd=0; ${crit ? "g._gearNextCrit='hit';" : ''} ${armN != null ? 'g._armN=' + armN + ';' : ''}
  const starts=[], hits=[], rels=[]; const _dd=dealDamage, _sp=spawnProjFx, _ss=spawnShot;
  spawnProjFx=function(){ rels.push(battleTime); return _sp.apply(this,arguments); }; spawnShot=function(s){ if(s===g) rels.push(battleTime); return _ss.apply(this,arguments); };
  dealDamage=function(s,t,a){ if(s===g){ const r=_dd.apply(this,arguments); hits.push({hit:battleTime,amt:Math.round(a),crit:t._critHit?1:0,clip:g._atkClip||'attack'}); t._critHit=false; return r; } return _dd.apply(this,arguments); };
  try{ for(let i=0;i<500&&hits.length<3;i++){ ${haste ? 'g.hasteMul=' + haste + '; g.hasteT=1;' : ''} const a0=g.attackAnim||0; updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.energy=0;
      e.x=${500 + gap}; e.y=700; g.x=500; g.y=700;
      if((g.attackAnim||0)>a0+1e-9) starts.push({st:battleTime,mul:g._atkSpdMul,ai:(g._atkI0||g.atkInterval)/g._atkSpdMul,free:null});
      const c=starts[starts.length-1]; if(c&&c.free==null&&!((g.attackAnim||0)>0)) c.free=battleTime;
      if(${crit ? 1 : 0}&&hits.length>=1) break; } } finally{ dealDamage=_dd; spawnProjFx=_sp; spawnShot=_ss; }
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
    units.forEach(u=>buildFigure(u)); let clips={}; if(globalThis.__crit0) units.forEach(u=>{ if(u.key==='${HERO}') u.glyphCrit=0; });
    const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ const a0=units.map(u=>u.attackAnim||0); updateBattle(SIM_STEP);
      units.forEach((u,j)=>{ if(u.key==='${HERO}'&&(u.attackAnim||0)>a0[j]+1e-9){ const c=u.key+':'+(u._atkClip||'attack'); clips[c]=(clips[c]||0)+1; } });
      if(globalThis.__crit0) units.forEach(u=>{ if(u.key==='${HERO}') u.glyphCrit=0; }); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); }
    let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return JSON.stringify({h:s.length+':'+h.toString(16),clips}); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
const SLOW = k => `(()=>{ const _mu=makeUnit; makeUnit=function(kk){ const u=_mu.apply(this,arguments); if(kk==='${k}'){ u._atkI0*=1.05; u.atkInterval*=1.05; } return u; }; return 1; })()`;   // CONTROL: a slower swing
const fight = (f, s, a, e, pre) => { const r = load(f); if (pre) r(pre); return JSON.parse(r(FIGHT(s, a, e))); };
const WITHRULE = `(()=>{ const A=BATTLE_ANIM['${HERO}']; if(A&&A.attack&&!A.crit) BATTLE_ANIM['${HERO}']=Object.assign({},A,{crit:Object.assign({},A.attack)}); return 1; })()`;   // BASE + the v532 crit-clip rule (render data only)
const NOPASS = `delete BATTLE_ANIM['${HERO}'].passive; 1`;
const GHOST = `import json,sys,numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGBA'))[...,3]; fw,fh,cols,n=int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5])
out=[]
for c in (0,n//2-4,n//2+6,n-1):
  q,p=divmod(c,cols); x=a[q*fh:(q+1)*fh,p*fw:(p+1)*fw]; m=x>8; out.append([c,int(m.sum()),round(float(x[m].mean()),1) if m.any() else 0])
print(json.dumps(out))`;
// the fight line-ups: the config's, else four mixed fights with the hero and three without (the hero never on both sides)
const POOL = ['askel', 'vex', 'grimsby', 'vesper', 'grosk', 'pellucid', 'veyr', 'kharos', 'sloe', 'astra', 'hurne', 'carn', 'tharl', 'nox', 'lumi', 'hobb', 'tick', 'umbris', 'oakmir', 'sorrel', 'rafe', 'korvux', 'seyla', 'vael'].filter(k => k !== HERO);
const pick = (i, n) => Array.from({ length: n }, (_, j) => POOL[(i * 5 + j * 3) % POOL.length]);
const HF = (FX.fights && FX.fights.with) || [[[HERO, ...pick(0, 2)], pick(1, 3), 11], [[pick(2, 1)[0], HERO], pick(3, 3), 222], [[HERO, ...pick(4, 2)], pick(5, 3), 5], [pick(6, 2), [HERO, ...pick(7, 2)], 64]];
const NONE = (FX.fights && FX.fights.without) || [[pick(8, 3), pick(9, 3), 11], [pick(10, 3), pick(11, 3), 222], [pick(12, 3), pick(13, 3), 5]];
try {
  ck('control file (BASE page + its own external scripts from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  { const ARCH = process.env.EW_ARCHIVE || 'C:\\Users\\Home\\OneDrive\\Desktop\\Emberweave Archive';
    let man = null; try { man = JSON.parse(fs.readFileSync(path.join(ARCH, 'Game Art', 'Heroes', FX.archiveDir, 'clips', FX.review, 'clean-source-manifest.json'), 'utf8')); } catch (e) {}
    if (man) { const ids = Object.values(FX.creations);
      const rows = man.filter(x => ids.includes(String(x.creationId || x.creation)));
      ck('sources: the ' + S.length + ' manifest rows the sheets were cut from are Phil PASS, official Without Watermark, 124 frames (creations ' + ids.join(' ') + ')',
        rows.length === S.length && rows.every(x => /PASS/.test(x.status) && /Without Watermark/.test(x.export) && x.frames === 124), JSON.stringify(rows.map(x => [x.slot, x.status]))); }
    else console.log('  info the Archive is not reachable here - the source manifest is not re-read'); }
  const A = JSON.parse(run(`JSON.stringify(BATTLE_ANIM.${HERO})`)), A0 = JSON.parse(R0(`JSON.stringify(BATTLE_ANIM.${HERO}||{})`));
  ck(HERO + ' has exactly the ' + S.length + ' states cut (' + S.join(' ') + ')', Object.keys(A).sort().join() === S.slice().sort().join(), Object.keys(A).join());
  { const bad = gridProblems(A, S); ck('every new sheet exists, file = declared grid, within 2048 px and 4 MB (v1140), q95 lossy + alpha (v1158), anchors in the cell', bad.length === 0, bad.join('; ')); }
  { const baseSrc = fs.readFileSync(OLD, 'utf8');
    ck('new files at ?v=' + VER + ' that BASE never referenced; the old sheets are still on disk', S.every(s => A[s].u === `/assets/anim/${HERO}/${HERO}_${s}_${VER}.webp?v=${VER}` && !baseSrc.includes(`${HERO}_${s}_${VER}`)) &&
      Object.keys(A0).every(s => !A0[s].u || fs.existsSync(fileOf(A0[s].u)))); }
  ck('grids as cut: ' + S.map(s => s + ' ' + FX.states[s].n + '@' + (+FX.states[s].fps.toFixed(4)) + (FX.states[s].contact != null ? ' c' + FX.states[s].contact : '')).join(', '),
    S.every(s => A[s].n === FX.states[s].n && Math.abs(A[s].fps - FX.states[s].fps) < 1e-5 && (FX.states[s].contact == null ? A[s].contact == null : A[s].contact === FX.states[s].contact) &&
      A[s].fw === FX.states[s].cut.fw && A[s].fh === FX.states[s].cut.fh && A[s].cols === FX.states[s].cut.cols && A[s].feet === FX.states[s].cut.feet && A[s].cx === FX.states[s].cut.cx));
  ck('flip:false, feet - top = figH, no ax drift, no pingpong; a passive is an event clip', S.every(s => A[s].flip === false && A[s].feet - A[s].top === A[s].figH && !A[s].ax && !A[s].pingpong) && (!A.passive || A.passive.event === true));
  if (A.walk) { const w = FX.walk;
    ck(`walk = 36 cells over the ${w.len}-frame stride from f${w.from}, loop [0,36], stride 0.12 x 36/${w.len}`,
      A.walk.n === 36 && JSON.stringify(A.walk.loop) === '[0,36]' && Math.abs(A.walk.n / A.walk.fps - w.len / 24) < 1e-5 && Math.abs(A.walk.stride - 0.12 * 36 / w.len) < 1e-6 && FX.states.walk.frames[0] === w.from); }
  if (A.idle) ck(FX.idle && FX.idle.loop ? 'idle 24 cells over its clean loop' : 'idle 62 @12 over the whole 5.17 s clip (no clean loop plays 24 cells at >= 8 fps)',
    FX.idle && FX.idle.loop ? (A.idle.n === 24) : (A.idle.n === 62 && A.idle.fps === 12 && JSON.stringify(FX.states.idle.frames) === JSON.stringify(Array.from({ length: 62 }, (_, i) => 2 * i))));
  { const K = JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(S)}.map(s=>{ const c=BATTLE_ANIM.${HERO}[s]; return texSheetK(c.fw,c.fh,c.cols,c.rows,c.figH/c.fh); })); } finally{ window.__texPhone=null; } })()`));
    ck('phone - every sheet at its own size (texSheetK 1), figures 140-240 px', K.every(k => k === 1) && S.every(s => A[s].figH >= 140 && A[s].figH <= 240), JSON.stringify(K)); }
  { const off = S.map(s => { const C = FX.states[s].cut, an = FX.states[s].anchors; const feet = (an.sole - C.box[1]) * C.sy, fh = an.h * C.sy, cx = (an.cx - C.box[0]) * C.sx;
      return [s, +(A[s].feet - feet).toFixed(2), +(A[s].figH - fh).toFixed(2), +(A[s].cx - cx).toFixed(2), an.framing, an.k]; });
    ck(`every state anchors on the reference figure (${FX.reference.state} frame 0: top ${FX.reference.top} / sole ${FX.reference.sole} / cx ${FX.reference.cx}) mapped into its sheet: feet within 0.6 px, figH within 0.6 px, cx within 0.06 px ` + JSON.stringify(off),
      off.every(([, a, b, c]) => Math.abs(a) <= 0.6 && Math.abs(b) <= 0.6 && Math.abs(c) <= 0.06)); }
  const cells0 = {}; for (const s of S) { if (FX.states[s].frames[0] === 0 && FX.states[s].anchors.framing !== 'manual') cells0[s] = 0; }
  const anim = {}; for (const s of S) anim[s] = A[s];
  if (A.idle && Object.keys(cells0).length >= 2) {
    const SC = py({ anim, cells0 }).scale;
    ck('SAME SIZE, SAME SPOT - every state starting on the standing frame 0 (' + Object.keys(SC).join(' ') + ') drawn as the engine draws it matches idle at scale 1.00 +-0.01 within 2 px (best IoU ' + Object.values(SC).map(x => x.best_iou).join(' / ') + ')',
      Object.values(SC).every(x => Math.abs(x.k - 1) <= 0.0101 && Math.abs(x.dx) <= 2 && Math.abs(x.dy) <= 2 && x.best_iou > 0.9), JSON.stringify(SC));
    const ctl = Object.keys(cells0).filter(s => s !== 'idle').slice(0, 2), bad2 = JSON.parse(JSON.stringify(anim));
    for (const s of ctl) { bad2[s].figH = Math.round(bad2[s].figH / 0.7); bad2[s].top = bad2[s].feet - bad2[s].figH; }
    const SC2 = py({ anim: bad2, cells0 }).scale;
    ck('CONTROL - ' + ctl.join(' / ') + ' anchored as if on another framing draw ~30% small and the check sees it', ctl.every(s => SC2[s].iou < 0.75 && SC2[s].k >= 1.03 - 1e-9), JSON.stringify(SC2)); }
  ck('every action clip keeps clipDur 2.0 s and relFrac 0.5, the hit its 0.6 s hold (timing is the engine\'s)',
    ACT.every(s => Math.abs(dur(A[s]) - 2) < 1e-12 && rel(A[s]) === 0.5 && !A[s].hold) && (!A.hit || Math.min(0.6, A.hit.n / A.hit.fps) === 0.6));
  ck('frame maps - one source frame per cell, every contact cell on its named source frame', S.every(s => FX.states[s].frames.length === FX.states[s].n && (FX.states[s].contact == null || FX.states[s].contactFrame == null || FX.states[s].frames[FX.states[s].contact] === FX.states[s].contactFrame)));
  ck('every other hero and monster has BATTLE_ANIM byte-for-byte BASE', H(run(`JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='${HERO}').map(k=>[k,BATTLE_ANIM[k]]))`)) === H(R0(`JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='${HERO}').map(k=>[k,BATTLE_ANIM[k]]))`)));
  { const kit = r => r(`JSON.stringify([KITS.${HERO},HERO_ULT_ART.${HERO}||null,ABILITY_CAST.${HERO}||null,CASTER_BALL.${HERO}||null])`);
    const T = JSON.parse(run(`JSON.stringify(HERO_TYPES.${HERO})`)), T0 = JSON.parse(R0(`JSON.stringify(HERO_TYPES.${HERO})`)); const t1 = Object.assign({}, T), t0 = Object.assign({}, T0); delete t1.autoAlt; delete t0.autoAlt;
    ck('kit, ult art, cast times, FX2_DEF and the hero line identical to BASE' + (FX.autoAlt ? ' (autoAlt ' + JSON.stringify(FX.autoAlt) + ' the only change)' : ''),
      kit(run) === kit(R0) && H(run('JSON.stringify(FX2_DEF)')) === H(R0('JSON.stringify(FX2_DEF)')) && JSON.stringify(t1) === JSON.stringify(t0) && JSON.stringify(T.autoAlt || null) === JSON.stringify(FX.autoAlt || T0.autoAlt || null)); }
  for (const kind of CASTS.filter(k => A[k])) { const x = JSON.parse(run(CAST(HERO, kind))), y = JSON.parse(R0(CAST(HERO, kind)));
    ck(`${kind}: cast, effects (${x.fx.join(' ')}), hold (${x.hold} s) and every unit for 6 s identical to BASE`, x.fired != null && x.anim === kind && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ x, y })); }
  const SW = (r, crit, haste, armN) => JSON.parse(r(SWING(HERO, 40, crit, haste, armN)));
  if (A.attack) { const h1 = SW(run), h0 = SW(R0);
    ck('swings (crit 0): every blow on the same tick with the same amount as BASE (' + h1.length + ')', h1.length >= 3 && JSON.stringify(h1.map(x => [x.st, x.hit, x.amt])) === JSON.stringify(h0.map(x => [x.st, x.hit, x.amt])), JSON.stringify({ h1, h0 }));
    if (FX.autoAlt) ck(`autos alternate ${FX.autoAlt.join(', ')} (${h1.map(x => x.clip).join(', ')}) at BASE's cadence`, JSON.stringify(h1.map(x => x.clip)) === JSON.stringify([FX.autoAlt[0], FX.autoAlt[1], FX.autoAlt[0]]) && Math.abs((h1[1].st - h1[0].st) - (h0[1].st - h0[0].st)) < 1e-9);
    if (A.crit) { const hc = SW(run, 1); ck('a forced crit plays the crit clip, flagged crit', hc[0].clip === 'crit' && hc[0].crit === 1, JSON.stringify(hc)); } }
  const drawnSwing = (w, Ac) => { const D = dur(Ac) / w.mul, ah = Math.min(0.95 * w.ai, D), fit = D > ah && D <= ah * 1.6; return { d: fit ? (w.rel - w.free) / CLK / ah * Ac.n : (w.rel - w.st) / CLK * Ac.fps * w.mul, fit }; };
  const swingCases = []; if (A.attack && A.attack.contact != null) swingCases.push([0, 0, null]); if (FX.autoAlt) swingCases.push([0, 1, null]); if (A.crit && A.crit.contact != null) swingCases.push([1, 0, null]);
  for (const [crit, idx] of swingCases) for (const hs of (crit || idx ? [0] : [0, 1.25, 0.8])) {
    const w = SW(run, crit, hs)[idx], Ac = A[w.clip], { d, fit } = drawnSwing(w, Ac), ok = hs ? Math.abs(d - Ac.contact) <= 1.5 : Math.floor(d) === Ac.contact;
    ck(`${w.clip} (x${w.mul.toFixed(2)}, ${fit ? 'fitted' : 'natural'}): the blow is drawn on cell ${d.toFixed(2)} - ${hs ? 'within 1.5 cells of' : 'the'} contact ${Ac.contact} (f${FX.states[w.clip].contactFrame})`, ok && run(`clipContactCell(BATTLE_ANIM.${HERO}.${w.clip})`) === Ac.contact, JSON.stringify(w) + ' ' + d.toFixed(2)); }
  for (const kind of CASTS.filter(k => A[k] && A[k].contact != null)) {
    const x = JSON.parse(run(CAST(HERO, kind))), Ac = A[kind], c = Ac.contact, land = +x.fx[x.fx.length - 1].split('@')[1], t = FX.states[kind].moment === 'land' ? land : x.fired, d = t / CLK * Ac.fps;
    ck(`${kind}: the ${t === x.fired ? 'release' : 'landing'} at ${t} fight s is drawn on cell ${d.toFixed(2)} = the contact ${c}`, Math.floor(d) === c && run(`clipContactCell(BATTLE_ANIM.${HERO}.${kind})`) === c, d.toFixed(2)); }
  const C0 = 'globalThis.__crit0=1; ' + (A.passive ? NOPASS : '1');
  ck('whole fights with ' + HERO + ', crit held at 0' + (A.passive ? ' and the passive clip held back' : '') + ', are tick-for-tick BASE', HF.every(([a, f, s]) => fight(HTML, s, a, f, C0).h === fight(OLD, s, a, f, 'globalThis.__crit0=1; 1').h));
  ck('at the real crit the same fights are BASE' + (FX.newCrit ? ' + the v532 crit-clip rule (the roll moves to the wind-up, same chance)' : '') + ' tick for tick', HF.every(([a, f, s]) => fight(HTML, s, a, f, A.passive ? NOPASS : null).h === fight(OLD, s, a, f, FX.newCrit ? WITHRULE : null).h));
  if (A.passive) ck('and WITH the passive clip the same fights are still the same tick for tick - the passive clip is display only', HF.every(([a, f, s]) => fight(HTML, s, a, f).h === fight(OLD, s, a, f, FX.newCrit ? WITHRULE : null).h));
  { const swung = HF.filter(([a, f, s]) => Object.keys(fight(HTML, s, a, f).clips).length > 0);
    ck('CONTROL: the same fights with ' + HERO + '\'s swing slowed x1.05 diverge in every fight he swings in (' + swung.length + ' of ' + HF.length + ') - the trace sees a timing change',
      swung.length > 0 && swung.every(([a, f, s]) => fight(HTML, s, a, f, SLOW(HERO)).h !== fight(OLD, s, a, f, FX.newCrit ? WITHRULE : null).h)); }
  ck('whole fights without ' + HERO + ' are tick-for-tick BASE', NONE.every(([a, f, s]) => fight(HTML, s, a, f).h === fight(OLD, s, a, f).h));
  { const q = `JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='${HERO}').map(k=>[k,SFX_DATA.heroes[k]]))`;
    ck('sound: every other hero\'s rows are BASE\'s; the sound files table is BASE\'s', H(run(q)) === H(R0(q)) && H(run('JSON.stringify(SFX_DATA.files)')) === H(R0('JSON.stringify(SFX_DATA.files)')));
    const SD = JSON.parse(run(`JSON.stringify(SFX_DATA.heroes.${HERO}||null)`)), SD0 = JSON.parse(R0(`JSON.stringify(SFX_DATA.heroes.${HERO}||null)`));
    if (FX.sound) { const on = (x, id) => { for (const k in (x || {})) { const e = (Array.isArray(x[k]) ? x[k] : []).find(e => e.id === id); if (e) return e.on; } };
      const MV = Object.entries(FX.sound), strip = x => JSON.stringify(Object.fromEntries(Object.entries(x || {}).map(([k, v]) => [k, Array.isArray(v) ? v.map(e => FX.sound[e.id] ? Object.assign({}, e, { on: '*' }) : e) : v])));
      ck('sound peaks on contact: ' + JSON.stringify(FX.sound) + ' in SFX_DATA.heroes.' + HERO, MV.every(([id, rule]) => on(SD, id) === rule), JSON.stringify(SD));
      ck('CONTROL: BASE\'s rows fail that check (every moved row had another rule there)', MV.every(([id, rule]) => on(SD0, id) !== undefined && on(SD0, id) !== rule), JSON.stringify(SD0));
      ck(HERO + '\'s sound rows are otherwise BASE\'s (only the moved rows\' "on" differs)', strip(SD) === strip(SD0));
      const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8')).rows, BS = fs.readFileSync(path.join(ROOT, 'tools/build_sfx.py'), 'utf8'),
        RB = BS.slice(BS.indexOf('\nRULES = {'), BS.indexOf('\n}', BS.indexOf('\nRULES = {')));
      ck('the same rules in sfx_manifest.json rows and tools/build_sfx.py RULES (a rebuild keeps them)', MV.every(([id, rule]) => MAN[id] && MAN[id].rule === rule &&
        new RegExp("\\n    '" + id + "': \\{'rule': '" + rule + "'").test(RB)), MV.map(([id]) => id + '=' + (MAN[id] || {}).rule).join(' ')); }
    else ck(HERO + '\'s sound rows are BASE\'s (no sound change in this release)', JSON.stringify(SD) === JSON.stringify(SD0)); }
  if (run("typeof skillPreviewStates") !== 'function') console.log('  info no skill previews on this page (before v1164)');
  else { const sp = JSON.parse(run(`JSON.stringify(skillPreviewStates('${HERO}','attack'))`));
    ck('skill preview: the Attack row plays ' + JSON.stringify(sp) + (FX.autoAlt ? ' (the autoAlt pair)' : '') + '; the crit row ' + (A.crit ? 'plays the crit clip' : 'is empty'),
      (FX.autoAlt ? JSON.stringify(sp) === JSON.stringify(FX.autoAlt) : sp.length >= 1) && JSON.stringify(JSON.parse(run(`JSON.stringify(skillPreviewStates('${HERO}','crit'))`))) === (A.crit ? '["crit"]' : '[]')); }
  for (const s of S.filter(s => FX.states[s].ghost)) { const Ag = A[s];
    const al = JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', '-c', GHOST, fileOf(Ag.u), String(Ag.fw), String(Ag.fh), String(Ag.cols), String(Ag.n)]).toString());
    ck(s + ' (ghost): the mid-clip cells keep a readable see-through figure (' + al[1][1] + ' / ' + al[2][1] + ' px at ' + al[1][2] + ' / ' + al[2][2] + ' of 255), the ends opaque (' + al[0][2] + ' / ' + al[3][2] + ')',
      al[1][1] > al[0][1] * 0.6 && al[2][1] > al[0][1] * 0.6 && al[1][2] > 70 && al[1][2] < 190 && al[2][2] > 70 && al[2][2] < 190 && al[0][2] > 200 && al[3][2] > 200, JSON.stringify(al)); }
  { const ctl = JSON.parse(JSON.stringify(A)); const [s1, s2] = S.slice(-2); ctl[s1].u = '/assets/anim/' + HERO + '/' + HERO + '_missing.webp?v=' + VER; ctl[s2].fw = 900;
    ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, [s1, s2]).length >= 2); }
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
};
