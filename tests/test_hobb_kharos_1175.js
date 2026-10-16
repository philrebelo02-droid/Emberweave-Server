'use strict';
// v1175 - HOBB KILNMASK's eight and KHAROS BLOOMKNIFE's ten new animations (Phil PASS 16 Oct 2026, ChatGPT 13:23, REVIEW 16OCT2026 H3, clean-source-manifest.json -
//   the final sets, official Hailuo Without Watermark exports, sha256 matched, cut from the silent twins). Both MELEE (Phil).
//   HOBB: idle, walk, attack, crit (his first), hit, green Glazebreaker, blue Sealed Vessel, ult Grand Kiln Shape. No passive.
//   KHAROS: idle, walk, attack A, attack B (567549954798575616, the far arm), crit (his first), hit, green Petal Sever (567544138133647364), blue Bloomstep,
//   ult Orchid Execution (567536284886573058), passive Perfect Camouflage (an event clip the camouflage fires). Phil: his autos alternate A, B, A, B
//   like Aureth's, one swing every 1.8 s - his own swing; no damage or stat changes. Attack B starts on the far arm raised: the wind-up is held on the
//   first cells so the contact lands on the real blow. The camouflage keeps a faint see-through figure (keyed as a ghost, never keyed away).
// ONE FRAMING, ONE SIZE (with CONTROLS), TIMING DATA = BASE, contact cells re-derived from the engine; with crit clips the v532 rule moves the crit roll to
//   the wind-up (same chance): whole fights at crit 0 (Kharos's passive clip held back) are BASE's tick for tick, at real crit BASE + the rule.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'af209869';   // live v1174 (Mirelle FX, on v1173 Meridian + Rafe), the build this change sits on
const VER = process.env.EW_HK_VER || '1175';
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-base-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server')); for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
  fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE_SHA + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { baseOk = false; }
const OLD = path.join(BD, 'emberweave-heroes.html');
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); const r = src => vm.runInContext(src, h.ctx); require('./helpers/anim-brannus-quorrel-1178.js').undoBQ1178(r); return r; };   // v1178: Brannus's / Quorrel's entries back to v1175's (tests/test_brannus_quorrel_1178.js checks them)
const UHK = require('./helpers/anim-hobb-kharos-1175.js');
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
const FR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/hobb_kharos_1175_frames.json'), 'utf8'));
const NEW = {
  hobb: [['idle', 62, 12, null], ['walk', 36, 36 * 24 / 49, null], ['attack', 48, 24, 27, 51], ['crit', 48, 24, 27, 46], ['hit', 15, 25, null], ['green', 48, 24, 18, 53], ['blue', 48, 24, 18, 42], ['ult', 48, 24, 40, 105]],
  kharos: [['idle', 62, 12, null], ['walk', 36, 36 * 24 / 55, null], ['attack', 48, 24, 27, 27], ['attackB', 48, 24, 27, 9], ['crit', 48, 24, 27, 43], ['hit', 15, 25, null],
           ['green', 48, 24, 18, 54], ['blue', 48, 24, 18, 45], ['ult', 48, 24, 29, 30], ['passive', 48, 24, null]] };
const WALK = { hobb: [51, 49], kharos: [12, 55] }, REF0 = { hobb: [373, 1227, 1079.9145], kharos: [314, 1215, 1030.483] };
const ACT = { hobb: ['attack', 'crit', 'green', 'blue', 'ult'], kharos: ['attack', 'attackB', 'crit', 'green', 'blue', 'ult'] };
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
    units.forEach(u=>buildFigure(u)); let clips={}; if(globalThis.__crit0) units.forEach(u=>{ if(u.key==='hobb'||u.key==='kharos') u.glyphCrit=0; }); let pcs=[]; const _fp=firePassiveClip; firePassiveClip=function(o,h){ if(o&&o.key==='kharos'&&o.anim===BATTLE_ANIM.kharos) pcs.push([+battleTime.toFixed(4),+(+h).toFixed(3),o._camOn|0]); return _fp.apply(this,arguments); };
    const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ const a0=units.map(u=>u.attackAnim||0); updateBattle(SIM_STEP);
      units.forEach((u,j)=>{ if((u.key==='kharos'||u.key==='hobb')&&(u.attackAnim||0)>a0[j]+1e-9){ const c=u.key+':'+(u._atkClip||'attack'); clips[c]=(clips[c]||0)+1; } });
      if(globalThis.__crit0) units.forEach(u=>{ if(u.key==='hobb'||u.key==='kharos') u.glyphCrit=0; }); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); }
    let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    firePassiveClip=_fp; return JSON.stringify({h:s.length+':'+h.toString(16),clips,pcs}); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
const SLOW = (...ks) => `(()=>{ const _mu=makeUnit, K=${JSON.stringify(ks)}; makeUnit=function(k){ const u=_mu.apply(this,arguments); if(K.includes(k)){ u._atkI0*=1.05; u.atkInterval*=1.05; } return u; }; return 1; })()`;   // CONTROL: a slower swing
const fight = (f, s, a, e, pre) => { const r = load(f); if (pre) r(pre); return JSON.parse(r(FIGHT(s, a, e))); };   // a fresh load per fight

const WITHRULE = `(()=>{ for(const k of ['hobb','kharos']){ const A=BATTLE_ANIM[k]; if(A&&A.attack&&!A.crit) BATTLE_ANIM[k]=Object.assign({},A,{crit:Object.assign({},A.attack)}); } return 1; })()`;   // BASE + the v532 crit-clip rule (render data only)
const PASSCHECK = `import json,sys,numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGBA'))[...,3]; fw,fh,cols=int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4])
out=[]
for c in (0,20,30,47):
  q,p=divmod(c,cols); x=a[q*fh:(q+1)*fh,p*fw:(p+1)*fw]; m=x>8; out.append([c,int(m.sum()),round(float(x[m].mean()),1)])
print(json.dumps(out))`;
try {
  ck('control file (BASE page + its own external scripts from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  { const ARCH = process.env.EW_ARCHIVE || 'C:\\Users\\Home\\OneDrive\\Desktop\\Emberweave Archive';
    const man = h => { try { return JSON.parse(fs.readFileSync(path.join(ARCH, 'Game Art', 'Heroes', h, 'clips', 'REVIEW 16OCT2026 H3', 'clean-source-manifest.json'), 'utf8')); } catch (e) { return null; } };
    const mh = man('Hobb Kilnmask'), mk = man('Kharos Bloomknife');
    if (mh && mk) { const id = (m, re) => (m.find(x => re.test(x.slot)) || {}).creation;
      ck('sources: Hobb 8 and Kharos 10 manifest rows, every one Phil PASS, official Without Watermark; Kharos attack B 567549954798575616 (never 567544124577665027 / 567547516884594693), green 567544138133647364 (not 567529942213963785), ult 567536284886573058 (not 567529977295134720)',
        mh.length === 8 && mk.length === 10 && mh.concat(mk).every(x => /Phil PASS/.test(x.status) && /Without Watermark/.test(x.export) && x.frames === 124) &&
        id(mk, /03b/) === '567549954798575616' && id(mk, /green/) === '567544138133647364' && id(mk, /ult/) === '567536284886573058' && !mk.some(x => ['567544124577665027', '567547516884594693', '567529942213963785', '567529977295134720'].includes(x.creation))); }
    else console.log('  info the Archive is not reachable here - source manifests not re-read'); }
  const G = { hobb: JSON.parse(run('JSON.stringify(BATTLE_ANIM.hobb)')), kharos: JSON.parse(run('JSON.stringify(BATTLE_ANIM.kharos)')) };
  const G0 = { hobb: JSON.parse(R0('JSON.stringify(BATTLE_ANIM.hobb)')), kharos: JSON.parse(R0('JSON.stringify(BATTLE_ANIM.kharos)')) };
  ck('Hobb has exactly eight states (his first crit, no passive); Kharos exactly ten (attack A, attackB, his first crit, the passive)',
    Object.keys(G.hobb).sort().join() === NEW.hobb.map(x => x[0]).sort().join() && Object.keys(G.kharos).sort().join() === NEW.kharos.map(x => x[0]).sort().join() && !G0.hobb.crit && !G0.kharos.crit && !G0.kharos.passive);
  const baseSrc = fs.readFileSync(OLD, 'utf8');
  for (const hero of ['hobb', 'kharos']) {
    const S = NEW[hero].map(x => x[0]), A = G[hero], A0 = G0[hero];
    const bad = gridProblems(A, S);
    ck(hero + ': every new sheet exists, file = declared grid, within 2048 px and 4 MB (v1140), q95 lossy + alpha (v1158), anchors in the cell', bad.length === 0, bad.join('; '));
    ck(hero + ': new files at ?v=' + VER + ' that BASE never referenced; the old sheets are still on disk', S.every(s => A[s].u === `/assets/anim/${hero}/${hero}_${s}_${VER}.webp?v=${VER}` && !baseSrc.includes(`${hero}_${s}_${VER}`)) &&
      Object.keys(A0).every(s => fs.existsSync(fileOf(A0[s].u))));
    ck(hero + ': grids as cut: ' + NEW[hero].map(x => x[0] + ' ' + x[1] + '@' + (+x[2].toFixed(4)) + (x[3] != null ? ' c' + x[3] : '')).join(', '),
      NEW[hero].every(([s, n, fps, c]) => A[s].n === n && Math.abs(A[s].fps - fps) < 1e-5 && (c == null ? A[s].contact == null : A[s].contact === c)), JSON.stringify(S.map(s => [s, A[s].n, A[s].fps, A[s].contact])));
    ck(hero + ': flip:false, feet - top = figH, no ax drift, no pingpong' + (hero === 'kharos' ? ', the passive an event clip' : ''), S.every(s => A[s].flip === false && A[s].feet - A[s].top === A[s].figH && !A[s].ax && !A[s].pingpong) && (hero !== 'kharos' || A.passive.event === true));
    const [w0, L] = WALK[hero], F = FR[hero].frames;
    ck(hero + `: walk = 36 cells over the ${L}-frame stride from f${w0}, loop [0,36], stride 0.12 x 36/${L}`,
      A.walk.n === 36 && JSON.stringify(A.walk.loop) === '[0,36]' && Math.abs(A.walk.n / A.walk.fps - L / 24) < 1e-5 && Math.abs(A.walk.stride - 0.12 * 36 / L) < 1e-6 && F.walk[0] === w0);
    ck(hero + ': idle 62 @12 over the whole 5.17 s clip', A.idle.n === 62 && A.idle.fps === 12 && JSON.stringify(F.idle) === JSON.stringify(Array.from({ length: 62 }, (_, i) => 2 * i)));
    const K = JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(S)}.map(s=>{ const c=BATTLE_ANIM.${hero}[s]; return texSheetK(c.fw,c.fh,c.cols,c.rows,c.figH/c.fh); })); } finally{ window.__texPhone=null; } })()`));
    ck(hero + ': phone - every sheet at its own size (texSheetK 1), figures 140-240 px', K.every(k => k === 1) && S.every(s => A[s].figH >= 140 && A[s].figH <= 240), JSON.stringify(K));
    { const RF = FR[hero].reference.states, r0 = REF0[hero];
      const std = S.filter(s => s !== 'attackB');
      ck(hero + ': the wide right-facing GREEN reference fits every standing frame 0 at one scale x' + std.map(s => RF[s].k).join(' / ') + ' (IoU ' + std.map(s => RF[s].iou).join(' / ') + '), sole / cx within 2 source px' +
        (hero === 'kharos' ? '; attack B starts on the far arm raised and fits its own START FRAME reference (x' + RF.attackB.k + ', IoU ' + RF.attackB.iou + ', sole ' + RF.attackB.sole + ') - the same framing' : ''),
        std.every(s => RF[s].k >= 1.40 && RF[s].k <= 1.42 && RF[s].iou > 0.95 && Math.abs(RF[s].sole - r0[1]) <= 2 && Math.abs(RF[s].cx - r0[2]) <= 2) &&
        (hero !== 'kharos' || (RF.attackB.k >= 1.40 && RF.attackB.k <= 1.42 && RF.attackB.iou > 0.95 && Math.abs(RF.attackB.sole - r0[1]) <= 2)));
      const want = s => { const C = FR[hero].cut[s]; return { top: (r0[0] - C.box[1]) * C.sy, feet: (r0[1] - C.box[1]) * C.sy, cx: (r0[2] - C.box[0]) * C.sx }; };
      const off = S.map(s => { const w = want(s); return [s, +(A[s].feet - w.feet).toFixed(2), +(A[s].figH - (w.feet - w.top)).toFixed(2), +(A[s].cx - w.cx).toFixed(2)]; });
      ck(hero + `: every state anchors on idle's frame-0 figure mapped into its sheet: feet within 0.6 px, figH within 1 px, cx within 0.06 px ` + JSON.stringify(off), off.every(([, a, b, c]) => Math.abs(a) <= 0.6 && Math.abs(b) <= 1.0 && Math.abs(c) <= 0.06)); }
    const cells0 = {}; for (const s of S) { if (s !== 'attackB' && FR[hero].frames[s][0] === 0) cells0[s] = 0; }
    const anim = {}; for (const s of S) anim[s] = A[s];
    const SC = py({ anim, cells0 }).scale;
    ck(hero + ': SAME SIZE, SAME SPOT - every state starting on the standing frame 0 (' + Object.keys(SC).join(' ') + ') drawn as the engine draws it matches idle at scale 1.00 +-0.01 within 2 px (best IoU ' + Object.values(SC).map(x => x.best_iou).join(' / ') + ')',
      Object.keys(SC).length >= 5 && Object.values(SC).every(x => Math.abs(x.k - 1) <= 0.0101 && Math.abs(x.dx) <= 2 && Math.abs(x.dy) <= 2 && x.best_iou > 0.92), JSON.stringify(SC));
    { const bad2 = JSON.parse(JSON.stringify(anim)); const ctl = ['attack', 'blue']; for (const s of ctl) { bad2[s].figH = Math.round(bad2[s].figH / 0.7); bad2[s].top = bad2[s].feet - bad2[s].figH; }
      const SC2 = py({ anim: bad2, cells0 }).scale;
      ck(hero + ': CONTROL - attack / blue anchored as if on another framing draw ~30% small and the check sees it', ctl.every(s => SC2[s].iou < 0.75 && SC2[s].k >= 1.03 - 1e-9), JSON.stringify(SC2)); }
    ck(hero + ': every action clip keeps clipDur 2.0 s and relFrac 0.5 (as BASE\'s attack / green / blue / ult), the hit its 0.6 s hold',
      ACT[hero].every(s => Math.abs(dur(A[s]) - 2) < 1e-12 && rel(A[s]) === 0.5 && !A[s].hold) && ['attack', 'green', 'blue', 'ult'].every(s => Math.abs(dur(A0[s]) - 2) < 1e-12) && Math.min(0.6, A.hit.n / A.hit.fps) === 0.6);
    ck(hero + ': frame maps - one source frame per cell, every contact cell on its named source frame', NEW[hero].every(([s, n, , c, f]) => FR[hero].frames[s].length === n && (c == null || FR[hero].frames[s][c] === f)));
  }
  ck('every other hero and monster has BATTLE_ANIM byte-for-byte BASE', H(run("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='hobb'&&k!=='kharos').map(k=>[k,BATTLE_ANIM[k]]))")) === H(R0("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='hobb'&&k!=='kharos').map(k=>[k,BATTLE_ANIM[k]]))")));
  { const kit = (r, h) => r(`JSON.stringify([KITS.${h},HERO_ULT_ART.${h}||null,ABILITY_CAST.${h}||null,CASTER_BALL.${h}||null])`);
    const T = JSON.parse(run('JSON.stringify(HERO_TYPES.kharos)')), T0 = JSON.parse(R0('JSON.stringify(HERO_TYPES.kharos)')); const t1 = Object.assign({}, T); delete t1.autoAlt;
    ck('kits, ult art, cast times and spell FX of both heroes identical to BASE; Hobb\'s hero line BASE\'s; Kharos\'s differs only by autoAlt [attack, attackB] (swing 1.8 s, damage and stats unchanged)',
      kit(run, 'hobb') === kit(R0, 'hobb') && kit(run, 'kharos') === kit(R0, 'kharos') && H(run('JSON.stringify(FX2_DEF)')) === H(R0('JSON.stringify(FX2_DEF)')) && run('JSON.stringify(HERO_TYPES.hobb)') === R0('JSON.stringify(HERO_TYPES.hobb)') &&
      JSON.stringify(t1) === JSON.stringify(T0) && JSON.stringify(T.autoAlt) === '["attack","attackB"]' && T.swing === 1.8); }
  for (const hero of ['hobb', 'kharos']) for (const kind of ['green', 'blue', 'ult']) { const x = JSON.parse(run(CAST(hero, kind))), y = JSON.parse(R0(CAST(hero, kind)));
    ck(`${hero} ${kind}: cast, effects (${x.fx.join(' ')}), hold (${x.hold} s) and every unit for 6 s identical to BASE`, x.fired != null && x.anim === kind && JSON.stringify(x) === JSON.stringify(y), JSON.stringify({ x, y })); }
  const SW = (r, hero, crit, haste) => JSON.parse(r(SWING(hero, 40, crit, haste)));
  { const h1 = SW(run, 'hobb'), h0 = SW(R0, 'hobb'), k1 = SW(run, 'kharos'), k0 = SW(R0, 'kharos');
    ck('swings (crit 0): every blow on the same tick with the same amount as BASE (Hobb ' + h1.length + ', Kharos ' + k1.length + ')', h1.length >= 3 && JSON.stringify(h1.map(x => [x.st, x.hit, x.amt])) === JSON.stringify(h0.map(x => [x.st, x.hit, x.amt])) && JSON.stringify(k1.map(x => [x.st, x.hit, x.amt])) === JSON.stringify(k0.map(x => [x.st, x.hit, x.amt])), JSON.stringify({ h1, h0, k1, k0 }));
    ck('Kharos alternates his autos A, B, A (' + k1.map(x => x.clip).join(', ') + '), a swing every ' + (k1[1].st - k1[0].st).toFixed(4) + ' fight s - his 1.8 s swing, BASE\'s cadence; Hobb plays his attack sheet every swing',
      JSON.stringify(k1.map(x => x.clip)) === '["attack","attackB","attack"]' && Math.abs((k1[1].st - k1[0].st) - (k0[1].st - k0[0].st)) < 1e-9 && h1.every(x => x.clip === 'attack'));
    const hc = SW(run, 'hobb', 1), kc = SW(run, 'kharos', 1);
    ck('a forced crit plays each hero\'s new crit clip, flagged crit', hc[0].clip === 'crit' && hc[0].crit === 1 && kc[0].clip === 'crit' && kc[0].crit === 1, JSON.stringify({ hc, kc })); }
  const drawnSwing = (w, A) => { const D = dur(A) / w.mul, ah = Math.min(0.95 * w.ai, D), fit = D > ah && D <= ah * 1.6; return { d: fit ? (w.rel - w.free) / CLK / ah * A.n : (w.rel - w.st) / CLK * A.fps * w.mul, fit }; };
  for (const [hero, crit, idx] of [['hobb', 0, 0], ['hobb', 1, 0], ['kharos', 0, 0], ['kharos', 0, 1], ['kharos', 1, 0]]) for (const hs of (crit || idx ? [0] : [0, 1.25, 0.8])) {
    const w = JSON.parse(run(SWING(hero, 40, crit, hs)))[idx], A = G[hero][w.clip], { d, fit } = drawnSwing(w, A), ok = hs ? Math.abs(d - A.contact) <= 1.5 : Math.floor(d) === A.contact;
    ck(`${hero} ${w.clip} (x${w.mul.toFixed(2)}, ${fit ? 'fitted' : 'natural'}): the blow is drawn on cell ${d.toFixed(2)} - ${hs ? 'within 1.5 cells of' : 'the'} contact ${A.contact} (f${NEW[hero].find(x => x[0] === w.clip)[4]})`, ok && run(`clipContactCell(BATTLE_ANIM.${hero}.${w.clip})`) === A.contact, JSON.stringify(w) + ' ' + d.toFixed(2)); }
  for (const hero of ['hobb', 'kharos']) for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(hero, kind))), A = G[hero][kind], c = A.contact, land = +x.fx[x.fx.length - 1].split('@')[1], t = (hero === 'hobb' && kind === 'ult') ? land : x.fired, d = t / CLK * A.fps;
    ck(`${hero} ${kind}: the ${t === x.fired ? 'release' : 'form landing'} at ${t} fight s is drawn on cell ${d.toFixed(2)} = the contact ${c}`, Math.floor(d) === c && run(`clipContactCell(BATTLE_ANIM.${hero}.${kind})`) === c, d.toFixed(2)); }
  const HF = [[['hobb', 'askel', 'vex'], ['grimsby', 'vesper', 'grosk'], 11], [['grosk', 'hobb'], ['pellucid', 'veyr', 'kharos'], 222], [['kharos', 'sloe', 'astra'], ['askel', 'hurne', 'carn'], 5], [['tharl', 'kharos'], ['hobb', 'nox', 'lumi'], 64]];
  const C0 = 'globalThis.__crit0=1; 1', NOPASS = 'globalThis.__crit0=1; delete BATTLE_ANIM.kharos.passive; 1';
  ck('whole fights with Hobb / Kharos, their crit held at 0 and Kharos\'s passive clip held back, are tick-for-tick BASE - the A / B alternation and the new sheets move nothing', HF.every(([a, f, s]) => fight(HTML, s, a, f, NOPASS).h === fight(OLD, s, a, f, C0).h));
  ck('at their real crit the same fights (passive clip held back) are BASE + the v532 crit-clip rule tick for tick (the roll moves to the wind-up, same chance)', HF.every(([a, f, s]) => fight(HTML, s, a, f, 'delete BATTLE_ANIM.kharos.passive; 1').h === fight(OLD, s, a, f, WITHRULE).h));
  { const res = HF.map(([a, f, s]) => fight(HTML, s, a, f)), pcs = res.flatMap(r => r.pcs), cl = res.reduce((o, x) => { for (const k in x.clips) o[k] = (o[k] || 0) + x.clips[k]; return o; }, {});
    ck('Kharos\'s camouflage plays his passive clip the tick it comes on (' + pcs.length + ' plays, each 2.0 s); in the fights his swings ran ' + JSON.stringify(cl), pcs.length > 0 && pcs.every(p => p[1] === 2 && p[2] === 1) && (cl['kharos:attack'] || 0) > 0 && (cl['kharos:attackB'] || 0) > 0);
    ck('and WITH his passive clip the same fights are still BASE + the rule tick for tick - the camouflage clip is display only (it plays while he acts)', HF.every(([a, f, s], i) => res[i].h === fight(OLD, s, a, f, WITHRULE).h)); }
  // CONTROL: a fight's timing comes from the timing data, never the sheet (a sheet's fps / cells move nothing - BASE above), so the control moves the swing itself
  ck('CONTROL: the same fights with Kharos\'s swing moved (his attack interval x1.05) diverge in every fight he swings in (seed 64 he never reaches a swing) - the trace sees a timing change', HF.filter(([a, f, s]) => Object.keys(fight(HTML, s, a, f).clips).some(k => /^kharos:/.test(k))).every(([a, f, s]) => fight(HTML, s, a, f, SLOW('kharos')).h !== fight(OLD, s, a, f, WITHRULE).h));
  const NONE = [[['askel', 'vesper', 'seyla'], ['vael', 'tick', 'lumi'], 11], [['nox', 'sorrel', 'umbris'], ['pellucid', 'veyr', 'oakmir'], 222], [['korvux', 'rafe', 'astra'], ['askel', 'hurne', 'carn'], 5]];
  ck('whole fights without Hobb or Kharos are tick-for-tick BASE', NONE.every(([a, f, s]) => fight(HTML, s, a, f).h === fight(OLD, s, a, f).h));
  { const SD = JSON.parse(run('JSON.stringify({h:SFX_DATA.heroes.hobb,k:SFX_DATA.heroes.kharos})')), SD0 = JSON.parse(R0('JSON.stringify({h:SFX_DATA.heroes.hobb,k:SFX_DATA.heroes.kharos})'));
    const on = (x, slot, id) => ((x[slot] || []).find(e => e.id === id) || {}).on;
    const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8'));
    ck('sound peaks on contact: Hobb Sealed Vessel S0245 cast -> release (18), Grand Kiln Shape S0246 cast -> land (40); Kharos Bloomstep S0298 cast -> release (18), Orchid Execution S0300 cast -> release (29); Glazebreaker S0244 / Petal Sever S0296 already release; files unchanged',
      on(SD.h, 'blue', 'S0245') === 'release' && on(SD.h, 'ult', 'S0246') === 'land' && on(SD.k, 'blue', 'S0298') === 'release' && on(SD.k, 'ult', 'S0300') === 'release' &&
      on(SD0.h, 'blue', 'S0245') === 'cast' && on(SD0.h, 'ult', 'S0246') === 'cast' && on(SD0.k, 'blue', 'S0298') === 'cast' && on(SD0.k, 'ult', 'S0300') === 'cast' &&
      on(SD.h, 'green', 'S0244') === 'release' && on(SD.k, 'green', 'S0296') === 'release' && ['S0245', 'S0298', 'S0300'].every(k => MAN.rows[k].rule === 'release') && MAN.rows.S0246.rule === 'land' && H(run('JSON.stringify(SFX_DATA.files)')) === H(R0('JSON.stringify(SFX_DATA.files)')));
    ck('weapon sounds: both stay on their melee weapon (Hobb blunt, Kharos light blade: v1165 fused swings), every A and B swing and the crit through the same path; rows as BASE', SD.h.atk === SD0.h.atk && SD.k.atk === SD0.k.atk && !SD.k.arm);
    ck('sound: every other hero\'s rows are BASE\'s', H(run("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='hobb'&&k!=='kharos').map(k=>[k,SFX_DATA.heroes[k]]))")) === H(R0("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='hobb'&&k!=='kharos').map(k=>[k,SFX_DATA.heroes[k]]))"))); }
  ck('skill preview: Kharos\'s Attack row plays A then B (skillPreviewStates reads his autoAlt pair); Aureth\'s unchanged', run("JSON.stringify(skillPreviewStates('kharos','attack'))") === '["attack","attackB"]' && run("JSON.stringify(skillPreviewStates('aureth','attack'))") === R0("JSON.stringify(skillPreviewStates('aureth','attack'))"));
  { const P = path.join(ROOT, 'assets', 'anim', 'kharos', 'kharos_passive_' + VER + '.webp'), Pa = G.kharos.passive;
    const al = JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', '-c', PASSCHECK, P, String(Pa.fw), String(Pa.fh), String(Pa.cols)]).toString());
    ck('the camouflage stays a readable see-through figure: mid-clip cells keep the figure (' + al[1][1] + ' / ' + al[2][1] + ' px) at about half alpha (' + al[1][2] + ' / ' + al[2][2] + ' of 255), the start and end cells opaque (' + al[0][2] + ' / ' + al[3][2] + ')',
      al[1][1] > al[0][1] * 0.6 && al[2][1] > al[0][1] * 0.6 && al[1][2] > 70 && al[1][2] < 190 && al[2][2] > 70 && al[2][2] < 190 && al[0][2] > 200 && al[3][2] > 200, JSON.stringify(al)); }
  const ctl = JSON.parse(JSON.stringify(G.kharos)); ctl.attackB.u = '/assets/anim/kharos/kharos_missing.webp?v=' + VER; ctl.attack.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, ['attackB', 'attack']).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
