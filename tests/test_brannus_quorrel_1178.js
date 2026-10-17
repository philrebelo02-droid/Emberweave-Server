'use strict';
// v1178 - BRANNUS's eight and QUORREL's eight new animations (Phil PASS 16 Oct 2026, ChatGPT 10:16, REVIEW 16OCT2026 H3, clean-source-manifest.json - the
//   final sets, official Hailuo Without Watermark exports, cut from the silent twins) and BRANNUS's three Grok spell FX (Phil approved 16 Oct, _fx2_accepted).
//   BRANNUS: idle, walk, attack (the wheel thrust), crit (his first), hit, green Rim Breaker, blue Arena Lock, ult Lionwheel Rampage; the corrected wide
//   SCREEN-RIGHT reference. No passive.
//   QUORREL: idle, walk (the insect walk, in place), attack, crit (his first), hit, green Gag Order, blue Contempt (FINAL 567500168624025606, never
//   567488847710978057), ult Contempt Storm; the gavels on him. No passive.
//   FX (display only, the v1171 FX16 painter): RIM BREAKER from where he stands toward the target on green cell 18 (the forward thrust), real time, once,
//   gone by 5.5 s, mirrored when he faces left, nothing else flies; ARENA LOCK at his feet on blue cell 7 (the wheel plants), its chain the kit's 3 m radius,
//   faded by 4.1 s; LIONWHEEL RAMPAGE from where he starts the charge toward the front line on ult cell 29 (the release), the embers faded by 5.1 s.
// ONE FRAMING, ONE SIZE (with CONTROLS), TIMING DATA = BASE, contact cells re-derived from the engine; with crit clips the v532 rule moves the crit roll to
//   the wind-up (same chance): whole fights at crit 0 are BASE's tick for tick, at real crit BASE + the rule.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'ced6c818';   // live v1177 (Esc fix, on v1176 dev info + names, v1175 Hobb + Kharos), the build this change sits on
const VER = process.env.EW_BQ_VER || '1178';
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-base-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server')); for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
  fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE_SHA + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { baseOk = false; }
const OLD = path.join(BD, 'emberweave-heroes.html');
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); const r = src => vm.runInContext(src, h.ctx); require('./helpers/rim-breaker-1180.js').undoRim1180(r); return r; };   // v1180: Rim Breaker as v1178 (tests/test_rim_breaker_1180.js checks the glide and the pierce)
const run = load(HTML), R0 = baseOk ? load(OLD) : null;
require('./helpers/plumage-1181.js').undoPlumage1181(run);   // v1181: Imperial Plumage's badgeH (a later release) comes back off before the FX2_DEF comparison
require('./helpers/death-1182.js').undoDeath1182(run);   // v1182: the four new death states go back out (tests/test_death_state.js checks them)
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) { const b = fs.readFileSync(file); const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; }
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const py = args => JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'noxgrim_1166_check.py'), ROOT, JSON.stringify(args)], { maxBuffer: 1 << 24 }).toString());
const FR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/brannus_quorrel_1178_frames.json'), 'utf8'));
const NEW = {
  brannus: [['idle', 62, 12, null], ['walk', 36, 36 * 24 / 59, null], ['attack', 48, 24, 27, 30], ['crit', 48, 24, 27, 55], ['hit', 15, 25, null], ['green', 48, 24, 18, 48], ['blue', 48, 24, 18, 48], ['ult', 48, 24, 29, 44]],
  quorrel: [['idle', 62, 12, null], ['walk', 36, 36 * 24 / 56, null], ['attack', 48, 24, 30, 84], ['crit', 48, 24, 30, 60], ['hit', 15, 25, null], ['green', 48, 24, 30, 74], ['blue', 48, 24, 18, 50], ['ult', 48, 24, 39, 66]] };
const WALK = { brannus: [59, 59], quorrel: [33, 56] }, REF0 = { brannus: [395, 1197, 1112.522], quorrel: [409, 1281, 1101.025] };
const ACT = ['attack', 'crit', 'green', 'blue', 'ult'];
// the moment each cast's contact cell shows: the release, the form landing (the last doEffect), or the ult's first blow. Brannus's Rim Breaker (a shot)
// and Lionwheel Rampage (a dash) land a distance-dependent time after the release (0.12-0.8 s / 0.15-0.8 s), so their clips' contact is the release
const MOMENT = { brannus: { green: 'fired', blue: 'fired', ult: 'fired' }, quorrel: { green: 'land', blue: 'fired', ult: 'blow' } };
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
const FXK = ['brannus_green', 'brannus_blue', 'brannus_ult'], FXF = { brannus_green: 'brannus_rim_breaker_16oct', brannus_blue: 'brannus_arena_lock_16oct', brannus_ult: 'brannus_lionwheel_rampage_16oct' };
function sheetProblems(F) { const bad = [];
  for (const k of FXK) { const d = F[k]; if (!d) { bad.push(k + ' missing'); continue; } const f = fileOf(d.u);
    if (!fs.existsSync(f)) { bad.push(k + ' missing file'); continue; }
    const sz = webpSize(f), ch = chunks(fs.readFileSync(f));
    if (d.n > d.cols * d.rows || d.n <= (d.cols - 1) * d.rows) bad.push(k + ' n does not fill its grid');
    if (d.fw * d.cols > 2048 || d.fh * d.rows > 2048) bad.push(k + ' > 2048 px');
    if (fs.statSync(f).size > 4e6) bad.push(k + ' > 4 MB');
    if (!sz || sz[0] !== d.fw * d.cols || sz[1] !== d.fh * d.rows) bad.push(k + ' file ' + sz + ' != grid');
    if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) bad.push(k + ' not a q95 lossy WebP with alpha'); }
  return bad; }
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
      e.x=${500 + gap}; e.y=700; g.x=500; g.y=700;
      if((g.attackAnim||0)>a0+1e-9) starts.push({st:battleTime,mul:g._atkSpdMul,ai:(g._atkI0||g.atkInterval)/g._atkSpdMul,free:null});
      const c=starts[starts.length-1]; if(c&&c.free==null&&!((g.attackAnim||0)>0)) c.free=battleTime;
      if(${crit ? 1 : 0}&&hits.length>=1) break; } } finally{ dealDamage=_dd; spawnProjFx=_sp; spawnShot=_ss; }
  return JSON.stringify(hits.map(h=>{ const st=starts.filter(x=>x.st<=h.hit+1e-9).pop()||{}; const rl=rels.filter(t=>t>=(st.st||0)-1e-9&&t<=h.hit+1e-9); return Object.assign({},st,h,{rel:rl.length?rl[0]:h.hit}); })); })()`;
// a cast through castKit / castAbility: the cast tick, every effect and damage tick and every unit for 7 s; on the new page also Brannus's art (the FX16
// entry he owns): when it shows, its cells / opacity, when it was confirmed (ok), its pin, facing and size; and every projectile the cast launches
const CAST = (hero, kind, opt) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123();
  const g=makeUnit('${hero}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false}); const e2=makeUnit('tick','enemy',560,740,30,{owned:false});
  g.anim=BATTLE_ANIM.${hero}; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=50;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.hp=g.maxHp*0.5; const OPT=${JSON.stringify(opt || {})}; if(OPT.mirror!=null) g._fxMirror=OPT.mirror;
  const fx=[], dm=[], proj=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const _dd=dealDamage; dealDamage=function(s,t){ if(s===g) dm.push(t.key+'@'+battleTime.toFixed(4)); return _dd.apply(this,arguments); };
  const _sp=spawnProjFx; spawnProjFx=function(k){ if(window._fxCaster===g) proj.push(k); return _sp.apply(this,arguments); };
  g._castSM=1; g._castLv=1;
  try{ if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS.${hero}['${kind}']);
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let fired=null; let pend=!!g._pend; const tr=[];
    const art=()=>(typeof _fx1123!=='undefined')?_fx1123.find(o=>o.kind==='fx16'&&o.u===g):null; let shown=null, gone=null, okAt=null, cut=null, cells=[], pin=null;
    for(let i=0;i<Math.round(7/SIM_STEP);i++){
      if(OPT.cancelAt!=null&&Math.abs(battleTime-OPT.cancelAt)<SIM_STEP/2) castCancel(g,'TEST');
      if(OPT.mirror!=null) g._fxMirror=OPT.mirror;
      updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=50; e2.energy=50;
      if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4); if(g._pend) pend=true;
      const o=art(); if(o&&o.ok&&okAt==null) okAt=+battleTime.toFixed(4); if(o&&o.cut!=null&&cut==null) cut=+battleTime.toFixed(4);
      if(o&&o.s&&shown==null){ shown=+battleTime.toFixed(4); pin={P:o.P?{x:+o.P.x.toFixed(3),y:+o.P.y.toFixed(3)}:null,gx:+g.x.toFixed(3),gy:+g.y.toFixed(3),mir:o.mir==null?null:!!o.mir,R:o.R||null,cell0:o.cell0,vk:o.vk}; }
      if(o&&o.s) cells.push([+battleTime.toFixed(4),o.fr,+(o.op!=null?o.op:-1).toFixed(3)]);
      if(shown!=null&&!o&&gone==null) gone=+battleTime.toFixed(4);
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),Math.round(u.energy||0)].join(':')).join('|')); }
    return JSON.stringify({hold,anim,fired,fx,dm,trace:tr.join('#').length+':'+tr.join('#').split('').reduce((h,c)=>(Math.imul(h^c.charCodeAt(0),16777619)>>>0),2166136261),
      shown,gone,okAt,cut,pin,proj,cells:cells.filter((c,i,a)=>i===0||c[1]!==a[i-1][1]||i===a.length-1)});
  } finally { doEffect=_de; dealDamage=_dd; spawnProjFx=_sp; } })()`;
const FIGHT = (seed, a, f) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
  try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
    units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
    ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
    units.forEach(u=>buildFigure(u)); let clips={}; if(globalThis.__crit0) units.forEach(u=>{ if(u.key==='brannus'||u.key==='quorrel') u.glyphCrit=0; });
    const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ const a0=units.map(u=>u.attackAnim||0); updateBattle(SIM_STEP);
      units.forEach((u,j)=>{ if((u.key==='brannus'||u.key==='quorrel')&&(u.attackAnim||0)>a0[j]+1e-9){ const c=u.key+':'+(u._atkClip||'attack'); clips[c]=(clips[c]||0)+1; } });
      if(globalThis.__crit0) units.forEach(u=>{ if(u.key==='brannus'||u.key==='quorrel') u.glyphCrit=0; }); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); }
    let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return JSON.stringify({h:s.length+':'+h.toString(16),clips}); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
const SLOW = (...ks) => `(()=>{ const _mu=makeUnit, K=${JSON.stringify(ks)}; makeUnit=function(k){ const u=_mu.apply(this,arguments); if(K.includes(k)){ u._atkI0*=1.05; u.atkInterval*=1.05; } return u; }; return 1; })()`;   // CONTROL: a slower swing
const fight = (f, s, a, e, pre) => { const r = load(f); if (pre) r(pre); return JSON.parse(r(FIGHT(s, a, e))); };   // a fresh load per fight
const WITHRULE = `(()=>{ for(const k of ['brannus','quorrel']){ const A=BATTLE_ANIM[k]; if(A&&A.attack&&!A.crit) BATTLE_ANIM[k]=Object.assign({},A,{crit:Object.assign({},A.attack)}); } return 1; })()`;   // BASE + the v532 crit-clip rule (render data only)

try {
  ck('control file (BASE page + its own external scripts from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  const src = fs.readFileSync(HTML, 'utf8'), baseSrc = fs.readFileSync(OLD, 'utf8');
  { let n = 0, bad = [];
    for (const m of src.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; '));
    let cb = 0; try { new vm.Script(src.replace('function _fx22Fx16Side(o){', 'function _fx22Fx16Side(o){ if( ').match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken painter', cb === 1); }
  { const ARCH = process.env.EW_ARCHIVE || 'C:\\Users\\Home\\OneDrive\\Desktop\\Emberweave Archive';
    const man = h => { try { return JSON.parse(fs.readFileSync(path.join(ARCH, 'Game Art', 'Heroes', h, 'clips', 'REVIEW 16OCT2026 H3', 'clean-source-manifest.json'), 'utf8')); } catch (e) { return null; } };
    const mb = man('Brannus'), mq = man('Quorrel');
    if (mb && mq) { const id = (m, re) => (m.find(x => re.test(x.slot)) || {}).creation;
      ck('sources: Brannus 8 and Quorrel 8 manifest rows, every one Phil PASS, official Without Watermark, 124 frames; Quorrel blue = the FINAL 567500168624025606 (never 567488847710978057)',
        mb.length === 8 && mq.length === 8 && mb.concat(mq).every(x => /Phil PASS/.test(x.status) && /Without Watermark/.test(x.export) && x.frames === 124) &&
        id(mq, /blue/) === '567500168624025606' && !mq.some(x => x.creation === '567488847710978057'));
      const A = path.join(ARCH, 'Game Art', '_fx2_accepted'), md5 = f => crypto.createHash('md5').update(fs.readFileSync(path.join(A, f))).digest('hex').slice(0, 8);
      ck('FX sources: Grok\'s three accepted Brannus clips (rim breaker 8fcf84ba, arena lock 18f632dd, lionwheel rampage c6f77d0e)',
        md5('brannus_green_rim_breaker_16oct.mp4') === '8fcf84ba' && md5('brannus_blue_arena_lock_16oct.mp4') === '18f632dd' && md5('brannus_ult_lionwheel_rampage_16oct.mp4') === 'c6f77d0e'); }
    else console.log('  info the Archive is not reachable here - source manifests not re-read'); }

  // 1. the hero sheets
  const G = { brannus: JSON.parse(run('JSON.stringify(BATTLE_ANIM.brannus)')), quorrel: JSON.parse(run('JSON.stringify(BATTLE_ANIM.quorrel)')) };
  const G0 = { brannus: JSON.parse(R0('JSON.stringify(BATTLE_ANIM.brannus)')), quorrel: JSON.parse(R0('JSON.stringify(BATTLE_ANIM.quorrel)')) };
  ck('Brannus and Quorrel have exactly eight states each (their first crit, no passive)',
    ['brannus', 'quorrel'].every(h => Object.keys(G[h]).sort().join() === NEW[h].map(x => x[0]).sort().join() && !G0[h].crit && !G0[h].passive));
  for (const hero of ['brannus', 'quorrel']) {
    const S = NEW[hero].map(x => x[0]), A = G[hero], A0 = G0[hero];
    const bad = gridProblems(A, S);
    ck(hero + ': every new sheet exists, file = declared grid, within 2048 px and 4 MB (v1140), q95 lossy + alpha (v1158), anchors in the cell', bad.length === 0, bad.join('; '));
    ck(hero + ': new files at ?v=' + VER + ' that BASE never referenced; the old sheets are still on disk', S.every(s => A[s].u === `/assets/anim/${hero}/${hero}_${s}_${VER}.webp?v=${VER}` && !baseSrc.includes(`${hero}_${s}_${VER}`)) &&
      Object.keys(A0).every(s => fs.existsSync(fileOf(A0[s].u))));
    ck(hero + ': grids as cut: ' + NEW[hero].map(x => x[0] + ' ' + x[1] + '@' + (+x[2].toFixed(4)) + (x[3] != null ? ' c' + x[3] : '')).join(', '),
      NEW[hero].every(([s, n, fps, c]) => A[s].n === n && Math.abs(A[s].fps - fps) < 1e-5 && (c == null ? A[s].contact == null : A[s].contact === c)), JSON.stringify(S.map(s => [s, A[s].n, A[s].fps, A[s].contact])));
    ck(hero + ': flip:false (BASE ' + A0.idle.flip + '), feet - top = figH, no ax drift, no pingpong', S.every(s => A[s].flip === false && A[s].feet - A[s].top === A[s].figH && !A[s].ax && !A[s].pingpong));
    const [w0, L] = WALK[hero], F = FR[hero].frames;
    ck(hero + `: walk = 36 cells over the ${L}-frame stride from f${w0}${hero === 'quorrel' ? ' (the insect walk, in place)' : ''}, loop [0,36], stride 0.12 x 36/${L}`,
      A.walk.n === 36 && JSON.stringify(A.walk.loop) === '[0,36]' && Math.abs(A.walk.n / A.walk.fps - L / 24) < 1e-5 && Math.abs(A.walk.stride - 0.12 * 36 / L) < 1e-6 && F.walk[0] === w0);
    ck(hero + ': idle 62 @12 over the whole 5.17 s clip', A.idle.n === 62 && A.idle.fps === 12 && JSON.stringify(F.idle) === JSON.stringify(Array.from({ length: 62 }, (_, i) => 2 * i)));
    const K = JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(S)}.map(s=>{ const c=BATTLE_ANIM.${hero}[s]; return texSheetK(c.fw,c.fh,c.cols,c.rows,c.figH/c.fh); })); } finally{ window.__texPhone=null; } })()`));
    ck(hero + ': phone - every sheet at its own size (texSheetK 1), figures 140-240 px', K.every(k => k === 1) && S.every(s => A[s].figH >= 140 && A[s].figH <= 240), JSON.stringify(K));
    { const RF = FR[hero].reference.states, r0 = REF0[hero];
      ck(hero + ': the wide right-facing GREEN reference fits every frame 0 at one scale x' + S.map(s => RF[s].k).join(' / ') + ' (IoU ' + S.map(s => RF[s].iou).join(' / ') + '), sole / cx within 2.5 source px',
        S.every(s => RF[s].k >= 1.40 && RF[s].k <= 1.42 && RF[s].iou > 0.95 && Math.abs(RF[s].sole - r0[1]) <= 2.5 && Math.abs(RF[s].cx - r0[2]) <= 2.5), JSON.stringify(RF));
      const want = s => { const C = FR[hero].cut[s]; return { top: (r0[0] - C.box[1]) * C.sy, feet: (r0[1] - C.box[1]) * C.sy, cx: (r0[2] - C.box[0]) * C.sx }; };
      const off = S.map(s => { const w = want(s); return [s, +(A[s].feet - w.feet).toFixed(2), +(A[s].figH - (w.feet - w.top)).toFixed(2), +(A[s].cx - w.cx).toFixed(2)]; });
      ck(hero + `: every state anchors on idle's frame-0 figure mapped into its sheet: feet within 0.6 px, figH within 1 px, cx within 0.06 px ` + JSON.stringify(off), off.every(([, a, b, c]) => Math.abs(a) <= 0.6 && Math.abs(b) <= 1.0 && Math.abs(c) <= 0.06)); }
    const cells0 = {}; for (const s of S) { if (FR[hero].frames[s][0] === 0) cells0[s] = 0; }
    const anim = {}; for (const s of S) anim[s] = A[s];
    const SC = py({ anim, cells0 }).scale;
    ck(hero + ': SAME SIZE, SAME SPOT - every state starting on the standing frame 0 (' + Object.keys(SC).join(' ') + ') drawn as the engine draws it matches idle at scale 1.00 +-0.01 within 2 px (best IoU ' + Object.values(SC).map(x => x.best_iou).join(' / ') + ')',
      Object.keys(SC).length >= 5 && Object.values(SC).every(x => Math.abs(x.k - 1) <= 0.0101 && Math.abs(x.dx) <= 2 && Math.abs(x.dy) <= 2 && x.best_iou > 0.92), JSON.stringify(SC));
    { const bad2 = JSON.parse(JSON.stringify(anim)); const ctl = ['attack', 'blue']; for (const s of ctl) { bad2[s].figH = Math.round(bad2[s].figH / 0.7); bad2[s].top = bad2[s].feet - bad2[s].figH; }
      const SC2 = py({ anim: bad2, cells0 }).scale;
      ck(hero + ': CONTROL - attack / blue anchored as if on another framing draw ~30% small and the check sees it', ctl.every(s => SC2[s].iou < 0.75 && SC2[s].k >= 1.03 - 1e-9), JSON.stringify(SC2)); }
    ck(hero + ': every action clip keeps clipDur 2.0 s and relFrac 0.5 (as BASE\'s attack / green / blue / ult), the hit its 0.6 s hold',
      ACT.every(s => Math.abs(dur(A[s]) - 2) < 1e-12 && rel(A[s]) === 0.5 && !A[s].hold) && ['attack', 'green', 'blue', 'ult'].every(s => Math.abs(dur(A0[s]) - 2) < 1e-12) && Math.min(0.6, A.hit.n / A.hit.fps) === 0.6);
    ck(hero + ': frame maps - one source frame per cell, every contact cell on its named source frame', NEW[hero].every(([s, n, , c, f]) => FR[hero].frames[s].length === n && (c == null || FR[hero].frames[s][c] === f)));
  }
  ck('every other hero and monster has BATTLE_ANIM byte-for-byte BASE', H(run("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='brannus'&&k!=='quorrel').map(k=>[k,BATTLE_ANIM[k]]))")) === H(R0("JSON.stringify(Object.keys(BATTLE_ANIM).filter(k=>k!=='brannus'&&k!=='quorrel').map(k=>[k,BATTLE_ANIM[k]]))")));

  // 2. the data the engine reads is BASE's
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'ownFx' ? undefined : v));
  const kit = (r, h) => JSON.stringify(strip(JSON.parse(r(`JSON.stringify([KITS.${h},HERO_ULT_ART.${h}||null,HERO_TYPES.${h},ABILITY_CAST.${h}||null,CASTER_BALL.${h}||null,ULT_DEF[HERO_TYPES.${h}.ability]||null])`))));
  ck('kits, ult art, hero stats, cast times and ult numbers of both heroes identical to BASE apart from Brannus\'s three ownFx display tags (bgreen / bblue / bult)',
    kit(run, 'brannus') === kit(R0, 'brannus') && kit(run, 'quorrel') === kit(R0, 'quorrel') && run("[KITS.brannus.green.ownFx,KITS.brannus.blue.ownFx,HERO_ULT_ART.brannus.ownFx].join('/')") === 'bgreen/bblue/bult' &&
    R0("[KITS.brannus.green.ownFx,KITS.brannus.blue.ownFx,HERO_ULT_ART.brannus.ownFx].join('/')") === '//' && !/ownFx/.test(run('JSON.stringify([KITS.quorrel,HERO_ULT_ART.quorrel||null])')));
  const others = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>!/^brannus_(green|blue|ult)$/.test(k)).map(k=>[k,FX2_DEF[k]]))");
  ck('every other FX2_DEF entry is byte-for-byte BASE', H(others(run)) === H(others(R0)));
  const casts = {};
  for (const hero of ['brannus', 'quorrel']) for (const kind of ['green', 'blue', 'ult']) { const x = JSON.parse(run(CAST(hero, kind))), y = JSON.parse(R0(CAST(hero, kind))); casts[hero + kind] = x;
    const pick = o => JSON.stringify([o.hold, o.anim, o.fired, o.fx, o.dm, o.trace]);
    ck(`${hero} ${kind}: cast, effects (${x.fx.join(' ')}), damage (${x.dm.slice(0, 2).join(' ')}), hold (${x.hold} s) and every unit for 7 s identical to BASE`, x.fired != null && x.anim === kind && pick(x) === pick(y), JSON.stringify({ now: pick(x), base: pick(y) })); }
  const SW = (r, hero, crit, haste) => JSON.parse(r(SWING(hero, 40, crit, haste)));
  { const b1 = SW(run, 'brannus'), b0 = SW(R0, 'brannus'), q1 = SW(run, 'quorrel'), q0 = SW(R0, 'quorrel'), p = x => JSON.stringify(x.map(y => [y.st, y.hit, y.amt]));
    ck('swings (crit 0): every blow on the same tick with the same amount as BASE (Brannus ' + b1.length + ', Quorrel ' + q1.length + '), each plays his attack sheet', b1.length >= 3 && q1.length >= 3 && p(b1) === p(b0) && p(q1) === p(q0) && b1.concat(q1).every(x => x.clip === 'attack'), JSON.stringify({ b1, b0, q1, q0 }));
    const bc = SW(run, 'brannus', 1), qc = SW(run, 'quorrel', 1);
    ck('a forced crit plays each hero\'s new crit clip, flagged crit', bc[0].clip === 'crit' && bc[0].crit === 1 && qc[0].clip === 'crit' && qc[0].crit === 1, JSON.stringify({ bc, qc })); }

  // 3. contact cells, re-derived from the engine
  const drawnSwing = (w, A) => { const D = dur(A) / w.mul, ah = Math.min(0.95 * w.ai, D), fit = D > ah && D <= ah * 1.6; return { d: fit ? (w.rel - w.free) / CLK / ah * A.n : (w.rel - w.st) / CLK * A.fps * w.mul, fit }; };
  for (const [hero, crit] of [['brannus', 0], ['brannus', 1], ['quorrel', 0], ['quorrel', 1]]) for (const hs of (crit ? [0] : [0, 1.25, 0.8])) {
    const w = JSON.parse(run(SWING(hero, 40, crit, hs)))[0], A = G[hero][w.clip], { d, fit } = drawnSwing(w, A), ok = hs ? Math.abs(d - A.contact) <= 1.5 : Math.floor(d) === A.contact;
    ck(`${hero} ${w.clip} (x${w.mul.toFixed(2)}, ${fit ? 'fitted' : 'natural'}): the blow is drawn on cell ${d.toFixed(2)} - ${hs ? 'within 1.5 cells of' : 'the'} contact ${A.contact} (f${NEW[hero].find(x => x[0] === w.clip)[4]})`, ok && run(`clipContactCell(BATTLE_ANIM.${hero}.${w.clip})`) === A.contact, JSON.stringify(w) + ' ' + d.toFixed(2)); }
  for (const hero of ['brannus', 'quorrel']) for (const kind of ['green', 'blue', 'ult']) {
    const x = casts[hero + kind], A = G[hero][kind], c = A.contact, m = MOMENT[hero][kind];
    const t = m === 'fired' ? x.fired : m === 'land' ? +x.fx[x.fx.length - 1].split('@')[1] : +x.dm[0].split('@')[1], d = t / CLK * A.fps;
    ck(`${hero} ${kind}: the ${m === 'fired' ? 'release' : m === 'land' ? 'landing' : 'first blow'} at ${t} fight s is drawn on cell ${d.toFixed(2)} = the contact ${c}` + (m !== 'fired' ? ` (the release ${x.fired} on cell ${(x.fired / CLK * A.fps).toFixed(2)})` : ''),
      Math.floor(d) === c && run(`clipContactCell(BATTLE_ANIM.${hero}.${kind})`) === c && (m === 'fired' || t > x.fired), d.toFixed(2)); }

  // 4. whole fights
  const HF = [[['brannus', 'askel', 'vex'], ['grimsby', 'vesper', 'grosk'], 11], [['grosk', 'quorrel'], ['pellucid', 'veyr', 'brannus'], 222], [['quorrel', 'sloe', 'astra'], ['askel', 'hurne', 'carn'], 5], [['tharl', 'brannus'], ['quorrel', 'nox', 'lumi'], 64]];
  const C0 = 'globalThis.__crit0=1; 1';
  ck('whole fights with Brannus / Quorrel, their crit held at 0, are tick-for-tick BASE - the new sheets and Brannus\'s art move nothing', HF.every(([a, f, s]) => fight(HTML, s, a, f, C0).h === fight(OLD, s, a, f, C0).h));
  { const res = HF.map(([a, f, s]) => fight(HTML, s, a, f)), cl = res.reduce((o, x) => { for (const k in x.clips) o[k] = (o[k] || 0) + x.clips[k]; return o; }, {});
    ck('at their real crit the same fights are BASE + the v532 crit-clip rule tick for tick (the roll moves to the wind-up, same chance); their swings ran ' + JSON.stringify(cl),
      HF.every(([a, f, s], i) => res[i].h === fight(OLD, s, a, f, WITHRULE).h) && (cl['brannus:attack'] || 0) > 0 && (cl['quorrel:attack'] || 0) > 0); }
  ck('CONTROL: the same fights with their swings moved (each one\'s attack interval x1.05) diverge - the trace sees a timing change', HF.every(([a, f, s]) => fight(HTML, s, a, f, SLOW('brannus', 'quorrel')).h !== fight(OLD, s, a, f, WITHRULE).h));
  const NONE = [[['askel', 'vesper', 'seyla'], ['vael', 'tick', 'lumi'], 11], [['nox', 'sorrel', 'umbris'], ['pellucid', 'veyr', 'oakmir'], 222], [['korvux', 'rafe', 'kharos'], ['hobb', 'hurne', 'carn'], 5]];
  ck('whole fights without Brannus or Quorrel are tick-for-tick BASE', NONE.every(([a, f, s]) => fight(HTML, s, a, f).h === fight(OLD, s, a, f).h));

  // 5. sound
  { const SD = JSON.parse(run('JSON.stringify({b:SFX_DATA.heroes.brannus,q:SFX_DATA.heroes.quorrel})')), SD0 = JSON.parse(R0('JSON.stringify({b:SFX_DATA.heroes.brannus,q:SFX_DATA.heroes.quorrel})'));
    const on = (x, slot, id) => ((x[slot] || []).find(e => e.id === id) || {}).on;
    const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8'));
    ck('sound peaks on contact: Brannus Arena Lock S0274 cast -> release (18); Quorrel Gag Order S0162 cast -> land (30), Contempt Storm S0165 release -> land (39, the first hit); Rim Breaker S0273 / Lionwheel Rampage S0276 already land, Contempt S0164 already release; files unchanged',
      on(SD.b, 'blue', 'S0274') === 'release' && on(SD.q, 'green', 'S0162') === 'land' && on(SD.q, 'ult', 'S0165') === 'land' &&
      on(SD0.b, 'blue', 'S0274') === 'cast' && on(SD0.q, 'green', 'S0162') === 'cast' && on(SD0.q, 'ult', 'S0165') === 'release' &&
      on(SD.b, 'green', 'S0273') === 'land' && on(SD.b, 'ult', 'S0276') === 'land' && on(SD.q, 'blue', 'S0164') === 'release' &&
      MAN.rows.S0274.rule === 'release' && MAN.rows.S0162.rule === 'land' && MAN.rows.S0165.rule === 'land' && H(run('JSON.stringify(SFX_DATA.files)')) === H(R0('JSON.stringify(SFX_DATA.files)')), JSON.stringify({ SD, SD0 }).slice(0, 600));
    ck('weapon sounds: both stay on their melee weapon (v1165 fused swings), the crit through the same path; rows as BASE', SD.b.atk === SD0.b.atk && SD.q.atk === SD0.q.atk);
    ck('sound: every other hero\'s rows are BASE\'s', H(run("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='brannus'&&k!=='quorrel').map(k=>[k,SFX_DATA.heroes[k]]))")) === H(R0("JSON.stringify(Object.keys(SFX_DATA.heroes).filter(k=>k!=='brannus'&&k!=='quorrel').map(k=>[k,SFX_DATA.heroes[k]]))"))); }

  // 6. Brannus's three spell FX
  const FXQ = 'JSON.stringify(Object.assign({FX_RT,METER,SC},Object.fromEntries(' + JSON.stringify(FXK) + '.map(k=>[k,FX2_DEF[k]]))))', F = JSON.parse(run(FXQ)), F0 = JSON.parse(R0(FXQ));
  { const bad = sheetProblems(F);
    ck('the three FX sheets exist, file = declared grid, within 2048 px per side and 4 MB, q95 lossy + alpha, real time at 12 fps', bad.length === 0 && FXK.every(k => F[k].rt === true && F[k].fps2 === 12 && Math.abs(F[k].dur - F[k].n / 12) < 1e-3), bad.join('; '));
    ck('they replace brannus_green / blue / ult in place: new files at ?v=' + VER + ' that BASE never referenced; the old plates still on disk', FXK.every(k => F[k].u === '/assets/anim/fx/' + FXF[k] + '.webp?v=' + VER && !baseSrc.includes(FXF[k]) && fs.existsSync(fileOf(F0[k].u))));
    const ctl = JSON.parse(JSON.stringify(F)); ctl.brannus_blue.fw = 900; ctl.brannus_ult.u = '/assets/anim/fx/brannus_missing.webp?v=1';
    ck('CONTROL: the sheet check catches an oversized grid and a missing file', sheetProblems(ctl).length >= 2);
    ck('frames as cut: Rim Breaker 0-132, Arena Lock 0-96, Lionwheel Rampage 0-120, every 2nd source frame (24 fps clips)', ['rim_breaker', 'arena_lock', 'lionwheel_rampage'].map((n, i) => FR.fx[n].frames.join() === Array.from({ length: [67, 49, 61][i] }, (_, j) => 2 * j).join()).every(Boolean) &&
      F.brannus_green.n === 67 && F.brannus_blue.n === 49 && F.brannus_ult.n === 61); }
  { const PY = cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'brannus_fx_1178_check.py')].concat(FXK.map(k => fileOf(F[k].u))), { maxBuffer: 1 << 24 }).toString();
    const Q = Object.entries(JSON.parse(PY));
    ck('green key, no fringe (measured on the shipped sheets): visible green (G > max(R,B)+24) <= 0.01% of edge px and 0 of body; dark olive (a leaked plate) <= 0.01%; teal 0.1% / 0 body. The art\'s own bright yellow kept (' + Q.map(([n, m]) => n + ' green ' + m.green_edge + '% olive ' + m.olive_edge + '% teal ' + m.teal_edge + '% yellow ' + m.yellow_all + '%').join(', ') + ')',
      Q.length === 3 && Q.every(([, m]) => m.green_edge <= 0.01 && m.green_body === 0 && m.olive_edge <= 0.01 && m.olive_body <= 0.01 && m.teal_edge <= 0.1 && m.teal_body === 0 && m.edge > 50000) && Q.every(([, m]) => m.yellow_all > 1), PY);
    ck('CONTROL: 35% of the plate mixed back into the edges and despilled reads as olive on every sheet (' + Q.map(([, m]) => m.control_olive_edge + '%').join(', ') + ')', Q.every(([, m]) => m.control_olive_edge > 5)); }
  ck('FX16: Rim Breaker and Lionwheel Rampage in the new side mode (in front, ro 2), Arena Lock in the ring mode (behind, 3 m), Rim Breaker confirmed at its launch with nothing else flying; the sheets warm with his figure',
    run('JSON.stringify([FX16_ART.bgreen,FX16_ART.bblue,FX16_ART.bult])') === JSON.stringify([{ k: 'brannus_green', st: 'green', mode: 'side', ro: 2, noFly: true, atLaunch: true }, { k: 'brannus_blue', st: 'blue', mode: 'ring', ro: -1, R: 3 * F.METER }, { k: 'brannus_ult', st: 'ult', mode: 'side', ro: 2 }]) &&
    run('JSON.stringify(FX1123_WARM.brannus)') === '["brannus_green","brannus_blue","brannus_ult"]' && run('KITS.brannus.blue.gfxR') === 3 * F.METER);
  const cellT = c => c / 24 * F.FX_RT, step = +run('SIM_STEP');
  for (const [kind, k, cell, real] of [['green', 'brannus_green', 18, 67 / 12], ['blue', 'brannus_blue', 7, 49 / 12], ['ult', 'brannus_ult', 29, 61 / 12]]) {
    const x = casts['brannus' + kind], want = cellT(cell);
    ck(`Brannus ${kind}: the art shows on ${kind} cell ${cell} (${want.toFixed(3)} fight s after the press, measured ${x.shown}), by the release (${x.fired}), and is confirmed by it (ok ${x.okAt})`,
      F[k].spawn === cell && x.shown != null && Math.abs(x.shown - want) <= step + 1e-6 && x.shown <= x.fired + step + 1e-6 && x.okAt != null && x.okAt <= x.fired + 1e-6 && x.cut == null, JSON.stringify(x));
    ck(`Brannus ${kind}: real time at 12 fps, once (${F[k].n} cells = ${real.toFixed(3)} real s = ${(real * F.FX_RT).toFixed(3)} fight s; shown for ${(x.gone - x.shown).toFixed(3)})` + (F[k].fadeR ? `, faded over its last ${F[k].fadeR} real s (last opacity ${x.cells[x.cells.length - 1][2]})` : ' (it clears on its own)'),
      x.gone != null && Math.abs((x.gone - x.shown) - real * F.FX_RT) <= 2 * step && x.cells.every((c, i, a) => i === 0 || c[1] >= a[i - 1][1]) && (!F[k].fadeR || x.cells[x.cells.length - 1][2] < 0.2), JSON.stringify(x.cells.slice(-4)));
    ck(`Brannus ${kind}: pinned where he stood at the show (${JSON.stringify(x.pin && x.pin.P)}; him ${x.pin && x.pin.gx}, ${x.pin && x.pin.gy})`, !!x.pin && !!x.pin.P && Math.abs(x.pin.P.x - x.pin.gx) < 1e-6 && Math.abs(x.pin.P.y - x.pin.gy) < 1e-6, JSON.stringify(x.pin)); }
  { const x = casts.brannusgreen;
    ck('Rim Breaker: the old plate no longer flies with the shot (projectiles launched: ' + JSON.stringify(x.proj) + '); BASE flew brannus_green', !x.proj.includes('brannus_green') && JSON.parse(R0(CAST('brannus', 'green'))).proj.includes('brannus_green')); }
  { const S = JSON.parse(run(`(()=>{ const g=makeUnit('brannus','ally',500,700,30,{owned:false}); const mk=()=>({center:{set(x,y){this.x=x;this.y=y;}},scale:{set(x,y){this.x=x;this.y=y;}},position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;return this;},add(v){this.x+=v.x||0;this.y+=v.y||0;this.z+=v.z||0;return this;}},_uv:[0.16,0.08,0.3,0.4]});
      const out=[]; for(const [vk,k,mir,tr] of [['bgreen','brannus_green',false,0],['bgreen','brannus_green',true,0],['bblue','brannus_blue',false,0],['bgreen','brannus_green',false,0.225],['bgreen','brannus_green',false,0.45],['bgreen','brannus_green',false,2]]){ const o={vk,d:FX2_DEF[k],u:g,s:mk(),P:{x:500,y:700},mir,ts:0,t:tr*FX_RT};
        if(vk==='bblue') o.R=3*METER; _fx22Fx16Side(o); out.push({vk,mir,tr,uv:o.s._uv[0],cx:+o.s.center.x.toFixed(4),W:+o.s.scale.x.toFixed(4),Hh:+o.s.scale.y.toFixed(4),head:+_fx22Head(g).toFixed(4),px:+o.s.position.x.toFixed(4),gx:+wx(500).toFixed(4),up:o.up!=null?+o.up.toFixed(4):null}); }
      return JSON.stringify(out); })()`));
    const [a, b, c, m1, m2, m3] = S, d = F.brannus_green, e = F.brannus_blue, w = d.weapon || {};
    ck('Rim Breaker: side view, the art wheel\'s start (anchor ' + JSON.stringify(d.anchor) + ') on his weapon on the release cell - ' + w.fwd + ' x his height in front of his feet and ' + w.up0 + ' x up (Phil: from his weapon height, not the floor); mirrored (UV window, anchor and the forward offset) when he faces left, so it rolls left; the wheel ' + d.size + ' x his height cell = 0.474 x his height, as the one he holds: ' + JSON.stringify([a, b]),
      a.uv > 0 && b.uv < 0 && Math.abs(a.cx - d.anchor[0]) < 1e-4 && Math.abs(b.cx - (1 - d.anchor[0])) < 1e-4 && Math.abs(a.Hh - d.size * a.head) < 1e-3 && w.fwd > 0.5 && w.up0 > 0.5 &&
      Math.abs(a.px - (a.gx + w.fwd * a.head)) < 1e-3 && Math.abs(b.px - (b.gx - w.fwd * b.head)) < 1e-3 && Math.abs(a.up - w.up0 * a.head) < 1e-3, JSON.stringify(S));
    ck('Rim Breaker: from the weapon a smooth arc down to roll on the ground - height ' + [a.up, m1.up, m2.up, m3.up].join(' -> ') + ' at 0 / 0.225 / 0.45 / 2 real s (smoothstep: half way at half time, the wheel\'s own radius ' + w.up1 + ' x his height from 0.45 s), never a pop at floor level',
      Math.abs(m1.up - (w.up0 + w.up1) / 2 * a.head) < 1e-3 && Math.abs(m2.up - w.up1 * a.head) < 1e-3 && Math.abs(m3.up - w.up1 * a.head) < 1e-3 && a.up > m1.up && m1.up > m2.up && w.up1 > 0.2, JSON.stringify(S));
    ck('Arena Lock: its chain line (span ' + e.span + ' of the cell) is the kit\'s 3 m radius each side: width ' + c.W + ' = 2 x 3 m x SC / span (' + (2 * 3 * F.METER * F.SC / e.span).toFixed(4) + ')', Math.abs(c.W - 2 * 3 * F.METER * F.SC / e.span) < 1e-3 && Math.abs(c.cx - e.anchor[0]) < 1e-4, JSON.stringify(c)); }
  { const L = JSON.parse(run(CAST('brannus', 'green', { mirror: true })));
    ck('in a cast facing left the art takes his facing at the show (mir ' + (L.pin && L.pin.mir) + '); facing right it does not (' + (casts.brannusgreen.pin && casts.brannusgreen.pin.mir) + ')', !!L.pin && L.pin.mir === true && casts.brannusgreen.pin.mir === false, JSON.stringify(L.pin)); }
  { const pre = JSON.parse(run(CAST('brannus', 'green', { cancelAt: 0.1 }))), post = JSON.parse(run(CAST('brannus', 'blue', { cancelAt: 0.3 })));
    ck(`an interrupted cast: before its cell the art never shows (Rim Breaker cancelled at 0.1 s: shown ${pre.shown}); after it, it fades out (Arena Lock cancelled at 0.3 s, after cell 7: shown ${post.shown}, cut ${post.cut}, gone ${post.gone})`,
      pre.shown === null && post.shown != null && post.cut != null && post.gone != null && post.gone - post.cut <= 0.15 + 2 * step, JSON.stringify({ pre, post: post.cells })); }
  ck('hooks: the shot launch confirms an atLaunch art and abilArt skips it at the landing; the show / tick run the two new modes',
    /if\(mode==='shot'&&o\.ownFx&&typeof FX16_ART!=='undefined'&&FX16_ART\[o\.ownFx\]&&FX16_ART\[o\.ownFx\]\.atLaunch(&&FX16_ART\[o\.ownFx\]\.mode!=='glide')?&&TH&&scene\) fx16Release\(u,o\.ownFx,o\.dur\|\|6,null,0\)/.test(src) &&
    /else if\(FX16_ART\[o\.ownFx\]&&!FX16_ART\[o\.ownFx\]\.atLaunch\)\{ try\{/.test(src) && /if\(V\.mode==='side'\|\|V\.mode==='ring'\)\{ o\.P=\{x,y\}; o\.mir=!!u\._fxMirror;/.test(src) && /if\(V\.mode==='side'\|\|V\.mode==='ring'\) _fx22Fx16Side\(o\); return 0; \}/.test(src));
  { const P = JSON.parse(run(`JSON.stringify([0,1,2].map(sl=>{ const p=skillPreviewPlan('brannus',sl); return p?p.fx.map(e=>({k:e.k,kind:e.kind,at:e.at||null,t0:+e.t0.toFixed(4),real:e.real!=null?+e.real.toFixed(3):null})):null; }))`));
    const [u, g, b] = P, one = (p, k, cell, real) => p && p.length === 1 && p[0].k === k && p[0].kind === 'fx16puff' && p[0].at === 'self' && p[0].t0 === +(cell / 24).toFixed(4) && Math.abs(p[0].real - real) < 1e-3;
    ck('Skills tab previews (v1164) show the new art at the moment the fight shows it, upright at his feet for its real length: Rim Breaker from green cell 18, Arena Lock blue 7, Lionwheel Rampage ult 29 (' + JSON.stringify(P) + ')',
      one(g, 'brannus_green', 18, 67 / 12) && one(b, 'brannus_blue', 7, 49 / 12) && one(u, 'brannus_ult', 29, 61 / 12), JSON.stringify(P)); }
  { const t0 = cp.execSync('git show ' + BASE_SHA + ':assets/anim/tiers_1141.json', { cwd: ROOT }).toString();
    ck('the tier table is BASE byte for byte (no ?v= change): the new FX sheets are each <= 2048 px (no tier file), the replaced plates\' entries left unreferenced', fs.readFileSync(path.join(ROOT, 'assets/anim/tiers_1141.json'), 'utf8') === t0); }
  { const i = src.indexOf('bgreen:{k:'); ck('no emoji added', i > 0 && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src.slice(i - 400, i + 600))); }
  const ctl = JSON.parse(JSON.stringify(G.quorrel)); ctl.blue.u = '/assets/anim/quorrel/quorrel_missing.webp?v=' + VER; ctl.attack.fw = 900;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl, ['blue', 'attack']).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
