'use strict';
// v1155 ANIMATION SLIM (Phil 15 Oct 2026: "walk try 36 frames, idle 24", "Hit react shorten to flinch", "remove passive for anyone without
// an active passive"). Every change is listed in tests/fixtures/anim_slim_1155.json (before / after against live v1153 c5adff17). This test:
//   1. FIXTURE = PAGE: the fixture is exactly the difference between BASE and this page (BATTLE_ANIM, FX2_DEF, HERO_SKILL_CLIPS).
//   2. RE-CUT SHEETS: new file + ?v=1155 that BASE never referenced; same cell size / anchors / facing; file = declared grid; every new
//      cell is a pixel-exact copy of the BASE cell it names (lossless); walk = 36 cells with the stride loop's duration and its cycles per
//      distance unchanged; idle = 24 cells with the loop's duration unchanged; hit = exactly the cells the engine ever drew (the crit
//      flinch is held min(0.6 s, clip) - that hold is unchanged at 0.6 s); a walk loop wraps no harder than its own largest step.
//   3. PASSIVES: removed only for the heroes no fight event plays (FILLER, counted on BASE: 0 firePassiveClip calls with a clip in
//      whole fights of every hero), kept for every hero that fires it (ACTIVE) and for Aureth's two crowns (Phil, v1153).
//   4. FIGHTS: whole fights of every hero (ranks 1/3/5, crit on/off) are tick-identical to BASE (hp, x, y, alive, energy, swing and
//      skill timers every tick). CONTROL: a 1-cell change to an attack clip (sim-read timing data) changes the digest.
//   5. CONTROLS: a wrong loop, a hit hold under 0.6 s, a shifted cell and a re-added filler passive each fail their check.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const Q95 = require('./helpers/q95-1158.js');   // v1158: q95 sheets are checked as the v1157 lossless originals they were (tests/test_q95_1158.js checks the q95 files)
const HTML = Q95.page(path.join(ROOT, 'emberweave-heroes.html'));
const BASE_SHA = process.env.EW_BASE || 'c5adff17';   // live v1153
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/anim_slim_1155.json'), 'utf8'));
const NFIGHTS = +(process.env.EW_SLIM_FIGHTS || 120);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 600) : '')); } };
const OLD = path.join(ROOT, '.test-slim-base-control.html');
fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-slim-'));
process.on('exit', () => { try { fs.unlinkSync(OLD); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = load(OLD);
require('./helpers/anim-1160.js').undo1160(run);   // v1160: Veyr's and Deepcleft's new entries go back to their v1158 (slim) state - tests/test_veyr_deepcleft_1160.js checks them
require('./helpers/anim-korvux-1162.js').undoKorvux1162(run);   // v1162: Korvux's new entries go back to their v1159 (slim) state - tests/test_korvux_anim_eight.js checks them
const SNAP = r => JSON.parse(r(`JSON.stringify({BA:BATTLE_ANIM,FX:FX2_DEF,SC:HERO_SKILL_CLIPS,HT:Object.keys(HERO_TYPES)})`));
const NOW = SNAP(run), BASE = SNAP(R0);
const deep = o => o == null ? 'null' : JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);
const webpSize = f => { const b = fs.readFileSync(f); const t = b.toString('ascii', 12, 16);
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; };
const isLossless = f => { const b = fs.readFileSync(f); return b.indexOf('VP8L') >= 0 && b.indexOf('VP8 ') < 0; };
const ppPer = A => (A.pingpong && A.n > 1) ? (A.rbk ? (A.n + Math.ceil((A.n - 1) / A.rbk)) : (2 * A.n - 2)) : A.n;
const WALK_STRIDE = +run('WALK_STRIDE');
const FILLER_ALL = ['joss', 'vulmar', 'tick', 'vireo', 'fritz', 'umbris', 'rhukk', 'meridian', 'gruel', 'astra', 'quorrel', 'korvux', 'maren', 'veyr',
  'mirelle', 'pellucid', 'orryn', 'hobb', 'askel', 'deepcleft', 'brannus', 'sorrel', 'yenna', 'kharos', 'vaelora', 'seyla', 'nox', 'nerisse', 'lysara', 'calypsa',
  'linnet', 'rivet', 'tessit', 'vex', 'grimsby', 'dandra', 'pyroclast', 'iver', 'sloe', 'tolley', 'mellan', 'rafe', 'ceraline', 'absalie'];
const ACTIVE = ['hurne', 'lumi', 'hollow', 'tharl', 'zahri', 'ambrel', 'aldren'];   // zahri / aldren: _soulHome when their summon dies (line ~9739)
const SKILL3_ALL = ['dandra', 'tick', 'vulmar', 'umbris', 'vireo'];
const KEPT = ['sylthaine'];   // v1157 (Phil 15 Oct): Cold Snap stays - approved 14 Oct, removed as filler by mistake; Aureth/Carn idle stay at their originals
const PASSIVES_DONE = FIX.changes.some(c => c.kind === 'anim' && c.state === 'passive');   // the passive commit of the slim (the walk/idle/hit commits come first)
const FILLER = PASSIVES_DONE ? FILLER_ALL : [], SKILL3 = PASSIVES_DONE ? SKILL3_ALL : [];
try {
  // ------------------------------------------------------------ 1. FIXTURE = PAGE
  const diff = [];
  for (const k of new Set([...Object.keys(BASE.BA), ...Object.keys(NOW.BA)])) { const b = BASE.BA[k] || {}, c = NOW.BA[k] || {};
    for (const s of new Set([...Object.keys(b), ...Object.keys(c)])) if (s[0] !== '_' && deep(b[s]) !== deep(c[s])) diff.push('anim ' + k + '.' + s); }
  for (const k of new Set([...Object.keys(BASE.FX), ...Object.keys(NOW.FX)])) if (deep(BASE.FX[k]) !== deep(NOW.FX[k])) diff.push('fx ' + k);
  const fx = FIX.changes.map(c => c.kind === 'anim' ? 'anim ' + c.key + '.' + c.state : 'fx ' + c.key);
  ck('the fixture lists exactly the BATTLE_ANIM / FX2_DEF entries this page changed against ' + BASE_SHA + ' (' + diff.length + ')', diff.sort().join() === fx.sort().join(),
    'page-only: ' + diff.filter(x => !fx.includes(x)).join(', ') + ' | fixture-only: ' + fx.filter(x => !diff.includes(x)).join(', '));
  ck('every fixture entry matches BASE before and this page after', FIX.changes.every(c => c.kind === 'anim'
    ? deep((BASE.BA[c.key] || {})[c.state]) === deep(c.before) && deep((NOW.BA[c.key] || {})[c.state]) === deep(c.after)
    : deep(BASE.FX[c.key]) === deep(c.before) && deep(NOW.FX[c.key]) === deep(c.after)));
  const scDiff = []; for (const k of new Set([...Object.keys(BASE.SC), ...Object.keys(NOW.SC)])) { const b = BASE.SC[k] || {}, c = NOW.SC[k] || {};
    for (const s of new Set([...Object.keys(b), ...Object.keys(c)])) if (deep(b[s]) !== deep(c[s])) scDiff.push(k + '.' + s); }
  /* v1164: the hand table is gone - the Skills tab reads the fight's own clips (skillPreviewPlan; tests/test_skill_previews_1164.js). The v1155 intent
     (no passive preview for the five) is checked on the derived preview when the page has no hand table. */
  const derived = Object.keys(NOW.SC).length === 0;
  ck('Skills-tab hand table: only the passive slot (3) of ' + SKILL3.join('/') + ' is gone' + (derived ? ' (v1164: no hand table - the derived preview has no passive for them)' : ''), derived
    ? JSON.parse(run(`JSON.stringify(${JSON.stringify(SKILL3)}.every(k=>!skillPreviewPlan(k,3)))`))
    : (scDiff.sort().join() === SKILL3.map(k => k + '.3').sort().join() && SKILL3.every(k => BASE.SC[k][3] && !NOW.SC[k][3])), scDiff.join(','));

  // ------------------------------------------------------------ 2. RE-CUT SHEETS
  const recut = FIX.changes.filter(c => c.kind === 'anim' && c.before && c.after);
  const baseSrc = fs.readFileSync(OLD, 'utf8');
  const KEEP_FIELDS = (b, a) => Object.keys(b).filter(f => !['u', 'n', 'fps', 'cols', 'rows', 'loop', 'ax', 'stride'].includes(f)).every(f => deep(b[f]) === deep(a[f])) &&
    Object.keys(a).every(f => f in b || f === 'stride');
  const bad = []; const shape = [];
  for (const c of recut) { const b = c.before, a = c.after, id = c.key + '.' + c.state, f = Q95.file(ROOT, a.u);
    const nm = a.u.split('?')[0];
    if (!/_1155\.webp\?v=1155$/.test(a.u) || baseSrc.includes(path.basename(nm))) bad.push(id + ' not a new _1155 file');
    if (!KEEP_FIELDS(b, a)) bad.push(id + ' changed a field other than u/n/fps/cols/rows/loop/ax/stride (anchors, size, facing must stay)');
    if (!fs.existsSync(f)) { bad.push(id + ' missing file'); continue; }
    const sz = webpSize(f); if (!sz || sz[0] !== a.cols * a.fw || sz[1] !== a.rows * a.fh || a.n > a.cols * a.rows) bad.push(id + ' file ' + sz + ' != grid');
    if (!isLossless(f)) bad.push(id + ' not lossless WebP');
    if (!Array.isArray(c.cells) || c.cells.length !== a.n || c.cells.some((x, i) => !(x >= 0 && x < b.n) || (i && x <= c.cells[i - 1]))) bad.push(id + ' cell map');
    if (b.ax && (!a.ax || a.ax.length !== a.n || a.ax.some((x, j) => x !== b.ax[c.cells[j]]))) bad.push(id + ' ax not the cells\' own offsets');
    if (c.state === 'walk') { const L0 = b.loop || [0, b.n], L1 = a.loop || [0, a.n], l0 = L0[1] - L0[0], l1 = L1[1] - L1[0];
      if (a.n !== 36) bad.push(id + ' walk is not 36 cells');
      if (!!b.loop !== !!a.loop || L1[0] < 0 || L1[1] > a.n) bad.push(id + ' loop');
      if (Math.abs(l1 / a.fps - l0 / b.fps) > 1e-3) bad.push(id + ' stride-loop duration ' + l1 / a.fps + ' != ' + l0 / b.fps);
      if (Math.abs(a.stride / l1 - (b.stride || WALK_STRIDE) / l0) > 1e-6) bad.push(id + ' cycles per distance changed');
      if (c.cells.slice(L1[0], L1[1]).some(x => x < L0[0] || x >= L0[1])) bad.push(id + ' a loop cell from outside BASE\'s loop');
      shape.push({ id, a, c }); }
    else if (c.state === 'idle') { if (a.n !== 24) bad.push(id + ' idle is not 24 cells');
      if (Math.abs(ppPer(a) / a.fps - ppPer(b) / b.fps) > 1e-3) bad.push(id + ' idle loop duration ' + ppPer(a) / a.fps + ' != ' + ppPer(b) / b.fps);
      if (!!a.pingpong !== !!b.pingpong || (b.pingpong && (c.cells[0] !== 0 || c.cells[a.n - 1] !== b.n - 1)) || (!b.pingpong && c.cells[0] !== 0)) bad.push(id + ' idle ends');
      shape.push({ id, a, c }); }
    else if (c.state === 'hit') { const m = Math.ceil(0.6 * b.fps - 1e-9);
      if (!(b.n / b.fps > 0.96)) bad.push(id + ' BASE hit was already short');
      if (Math.min(0.6, a.n / a.fps) !== Math.min(0.6, b.n / b.fps)) bad.push(id + ' crit-flinch hold changed: ' + Math.min(0.6, a.n / a.fps));
      if (!(a.n / a.fps <= 0.62)) bad.push(id + ' hit plays longer than its hold');
      if (a.n !== m || c.cells.some((x, i) => x !== i)) bad.push(id + ' hit is not exactly the ' + m + ' cells BASE drew in its 0.6 s'); }
    else bad.push(id + ' unexpected re-cut state'); }
  ck('re-cut sheets (' + recut.length + '): new _1155 files, same anchors / cell size / facing, file = grid, lossless, cells mapped in order, ax = the cells\' own offsets', bad.length === 0, bad.join('; '));
  ck('walk 36 / idle 24 / hit = the drawn flinch: ' + ['walk', 'idle', 'hit'].map(s => recut.filter(c => c.state === s).length + ' ' + s).join(', '), recut.length > 0 && bad.length === 0);
  // every hit clip on the page keeps the crit-flinch hold BASE had (the hold is min(0.6, n/fps) - line ~14828)
  const holdBad = Object.keys(BASE.BA).filter(k => BASE.BA[k].hit && (!NOW.BA[k].hit || Math.min(0.6, NOW.BA[k].hit.n / NOW.BA[k].hit.fps) !== Math.min(0.6, BASE.BA[k].hit.n / BASE.BA[k].hit.fps)));
  ck('every hit clip (heroes and monsters) keeps BASE\'s crit-flinch hold exactly', holdBad.length === 0, holdBad.join(','));
  ck('the engine still reads the hit hold as min(0.6, n/fps) and the walk as A.loop / A.stride', /u\._hitHold=_h\?Math\.min\(0\.6,_h\.n\/\(_h\.fps\|\|16\)\):0\.28;/.test(fs.readFileSync(HTML, 'utf8')) &&
    /moved\*\(A\.stride\|\|WALK_STRIDE\)/.test(fs.readFileSync(HTML, 'utf8')));

  // pixels: every new cell is the BASE cell it names, bit for bit (BASE sheets read from git, so this holds after old files leave the repo)
  const jobs = recut.map((c, i) => { const bf = path.join(TMP, 'b' + i + '.webp'); fs.writeFileSync(bf, cp.execSync('git show ' + BASE_SHA + ':' + c.before.u.split('?')[0].slice(1), { cwd: ROOT, maxBuffer: 64 << 20 }));
    return { id: c.key + '.' + c.state, b: bf, a: Q95.file(ROOT, c.after.u), fw: c.after.fw, fh: c.after.fh, c0: c.before.cols, c1: c.after.cols, cells: c.cells,
      loop: c.state === 'walk' ? (c.after.loop || [0, c.after.n]) : null }; });
  const PY = `
import sys,json
from PIL import Image
import numpy as np
J=json.load(open(sys.argv[1])); out=[]
for j in J:
  B=np.asarray(Image.open(j['b']).convert('RGBA')); A=np.asarray(Image.open(j['a']).convert('RGBA')); fw,fh=j['fw'],j['fh']
  cb=lambda i:B[(i//j['c0'])*fh:(i//j['c0']+1)*fh,(i%j['c0'])*fw:(i%j['c0']+1)*fw]; ca=lambda i:A[(i//j['c1'])*fh:(i//j['c1']+1)*fh,(i%j['c1'])*fw:(i%j['c1']+1)*fw]
  ex=all(np.array_equal(ca(n),cb(i)) for n,i in enumerate(j['cells']))
  pad=all(not A[(n//j['c1'])*fh:(n//j['c1']+1)*fh,(n%j['c1'])*fw:(n%j['c1']+1)*fw,3].any() for n in range(len(j['cells']),(A.shape[0]//fh)*j['c1']))
  seam=None
  if j['loop']:
    a,b=j['loop']; f=lambda i:ca(i).astype(np.float32)*(ca(i)[...,3:4].astype(np.float32)/255)
    st=[float(np.abs(f(i)-f(i+1)).mean()) for i in range(a,b-1)]; w=float(np.abs(f(b-1)-f(a)).mean()); seam=[w,max(st)]
  out.append([j['id'],ex,pad,seam])
print(json.dumps(out))`;
  fs.writeFileSync(path.join(TMP, 'jobs.json'), JSON.stringify(jobs)); fs.writeFileSync(path.join(TMP, 'px.py'), PY);
  const px = JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(TMP, 'px.py'), path.join(TMP, 'jobs.json')], { maxBuffer: 64 << 20 }).toString());
  ck('LOSSLESS: every cell of every re-cut sheet is bit-for-bit the BASE cell it names; unused grid slots are empty (' + px.length + ' sheets)', px.length === recut.length && px.every(r => r[1] && r[2]), px.filter(r => !r[1] || !r[2]).map(r => r[0]).join(','));
  const seams = px.filter(r => r[3]); const hard = seams.filter(r => r[3][0] > r[3][1] * 1.0001);
  ck('SEAMLESS: every walk stride loop wraps (last cell -> first) no harder than its own largest step (' + seams.length + ' walks)', seams.length === recut.filter(c => c.state === 'walk').length && hard.length === 0,
    hard.map(r => r[0] + ' wrap ' + r[3][0].toFixed(2) + ' > ' + r[3][1].toFixed(2)).join(','));

  // ------------------------------------------------------------ 3. PASSIVES
  const removed = FIX.changes.filter(c => c.kind === 'anim' && c.state === 'passive' && c.before && !c.after).map(c => c.key);
  ck('passive clip removed for the ' + FILLER.length + ' FILLER heroes and nobody else', removed.sort().join() === FILLER.slice().sort().join() && FILLER.every(k => BASE.BA[k].passive && !NOW.BA[k].passive), removed.join(','));
  ck('kept for the ACTIVE heroes (' + ACTIVE.join(', ') + ') and for Aureth\'s two crowns (byte-for-byte BASE)', ACTIVE.concat(['aureth']).every(k => deep(NOW.BA[k].passive) === deep(BASE.BA[k].passive)) && deep(NOW.BA.aureth.passiveDark) === deep(BASE.BA.aureth.passiveDark));
  ck('no hero outside the two lists had a passive clip in BASE', NOW.HT.filter(k => BASE.BA[k] && BASE.BA[k].passive).every(k => FILLER_ALL.includes(k) || ACTIVE.includes(k) || KEPT.includes(k) || k === 'aureth'));
  ck('v1157: the Sylthaine Cold Snap passive (battle clip + Skills slot 3) and the Aureth + Carn idles are byte-for-byte BASE', KEPT.every(k => deep(NOW.BA[k].passive) === deep(BASE.BA[k].passive) && !!NOW.BA[k].passive && (derived ? JSON.parse(run(`JSON.stringify((()=>{ const p=skillPreviewPlan('${k}',3); return !!p&&p.clips[0].A===BATTLE_ANIM['${k}'].passive; })())`)) : (deep(NOW.SC[k][3]) === deep(BASE.SC[k][3]) && !!NOW.SC[k][3])))
    && ['aureth', 'carn'].every(k => deep(NOW.BA[k].idle) === deep(BASE.BA[k].idle)) && !FIX.changes.some(c => (c.key === 'aureth' || c.key === 'carn') && c.state === 'idle'));
  ck('the Skills tab derives no passive preview for a FILLER hero (ensureSkillPreview, the no-stage fallback)', JSON.parse(run(`JSON.stringify(${JSON.stringify(FILLER)}.map(k=>{ try{ ensureSkillPreview(k); }catch(e){} const s=HERO_SKILL_CLIPS[k]||{}; return !s[3] || (k==='fritz'); }))`)).every(Boolean));
  const firePlays = r => JSON.parse(r(`(()=>{ const out=[]; units=[]; seedBattle(3); for(const k of ${JSON.stringify(FILLER.concat(ACTIVE))}){ const g=makeUnit(k,'ally',500,700,30,{owned:false,rank:5}); g.anim=BATTLE_ANIM[k]; units=[g];
      g._abilHold=0; g._lockPri=0; g._animLockT=0; g._abilAnim=null; firePassiveClip(g,2.0); out.push([k,g._abilAnim==='passive'?1:0]); } return JSON.stringify(out); })()`));
  const fpN = firePlays(run);
  ck('a passive trigger on a FILLER hero now plays no clip (firePassiveClip returns after its FX plate); ACTIVE heroes still play theirs',
    fpN.every(([k, p]) => FILLER.includes(k) ? p === 0 : p === 1), JSON.stringify(fpN.filter(([k, p]) => FILLER.includes(k) ? p : !p)));

  // ------------------------------------------------------------ 4. FIGHTS (BASE vs this page, every tick)
  const heroes = NOW.HT;
  const INSTR = `globalThis.__pc={}; if(!globalThis.__fpWrapped){ globalThis.__fpWrapped=1; const __f=firePassiveClip; firePassiveClip=function(o){ if(o&&o.key&&o.anim&&o.anim.passive){ globalThis.__pc[o.key]=(globalThis.__pc[o.key]||0)+1; } return __f.apply(this,arguments); }; } 1`;
  run(INSTR); R0(INSTR);
  const FIGHT = (a, b, seed, rank, crit) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:${rank}})));
      ${JSON.stringify(b)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:${rank}})));
      units.forEach(u=>buildFigure(u)); ${crit ? "units.forEach(u=>{ u.glyphCrit=(u.glyphCrit||0)+0.3; });" : ''}
      let H=2166136261>>>0; const mix=s=>{ for(let i=0;i<s.length;i++){ H^=s.charCodeAt(i); H=Math.imul(H,16777619)>>>0; } };
      let t=0; for(let i=0;i<Math.round(60/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); t++;
        mix(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*100),Math.round((u.atkCd||0)*1000),Math.round((u.greenCd||0)*1000),Math.round((u.blueCd||0)*1000)].join(':')).join('|')); }
      return t+':'+H.toString(16); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
  const F = []; for (let f = 0; f < NFIGHTS; f++) { const a = [], b = []; for (let i = 0; i < 5; i++) { a.push(heroes[(f * 10 + i) % heroes.length]); b.push(heroes[(f * 10 + 5 + i) % heroes.length]); }
    F.push([a, b, 1000 + f, [1, 3, 5][f % 3], f % 2]); }
  const diffF = []; let ticks = 0;
  for (const [a, b, s, rk, cr] of F) { const x = run(FIGHT(a, b, s, rk, cr)), y = R0(FIGHT(a, b, s, rk, cr)); ticks += +x.split(':')[0]; if (x !== y) diffF.push(s + ' ' + x + ' vs ' + y); }
  const per = Math.round(NFIGHTS * 10 / heroes.length);
  ck('FIGHTS: ' + NFIGHTS + ' whole 5v5 fights (every hero ' + per + ' times, ranks 1/3/5, crit on/off, ' + ticks + ' ticks) are tick-identical to ' + BASE_SHA + ' (hp, x, y, alive, energy, swing and skill timers)', diffF.length === 0, diffF.slice(0, 4).join('; '));
  const pc0 = JSON.parse(R0('JSON.stringify(globalThis.__pc)'));
  ck('BASE fights: no FILLER hero ever fired its passive clip (firePassiveClip with a clip: ' + Object.keys(pc0).sort().map(k => k + ' ' + pc0[k]).join(', ') + ')', FILLER.every(k => !pc0[k]) && Object.keys(pc0).every(k => ACTIVE.includes(k)) && FILLER_ALL.every(k => !pc0[k]));
  { const fi = F.find(([a, b]) => a.includes('grimsby') || b.includes('grimsby')); const base = fi && run(FIGHT(...fi));
    const mut = fi && run(`(()=>{ const A=BATTLE_ANIM.grimsby.attack, sv=A.n; A.n=sv-12; try{ return eval(${JSON.stringify(FIGHT(...fi))}); } finally{ A.n=sv; } })()`);
    ck('CONTROL: the fight harness sees a change to sim-read clip data (Grimsby\'s attack clip 12 cells shorter -> a different digest)', !!fi && base !== mut, base + ' vs ' + mut); }

  // ------------------------------------------------------------ 5. CONTROLS on the data checks
  const w = recut.find(c => c.state === 'walk' && c.after.loop), h = recut.find(c => c.state === 'hit'), i1 = recut.find(c => c.state === 'idle');
  if (w) ck('CONTROL: a walk loop one cell short fails the loop-duration check', w && Math.abs((w.after.loop[1] - 1 - w.after.loop[0]) / w.after.fps - (w.before.loop[1] - w.before.loop[0]) / w.before.fps) > 1e-3);
  if (h) ck('CONTROL: a hit at 26 fps (hold 0.577 s) fails the hold check', h && Math.min(0.6, h.after.n / 26) !== Math.min(0.6, h.before.n / h.before.fps));
  if (i1) ck('CONTROL: an idle at 12.5 fps fails the idle-duration check', i1 && Math.abs(ppPer(i1.after) / (i1.after.fps * 1.04) - ppPer(i1.before) / i1.before.fps) > 1e-3);
  { const j = jobs.find(x => x.id === (w ? w.key + '.walk' : '')); if (j) { const jj = Object.assign({}, j, { cells: j.cells.map((x, k) => k === 3 ? x + 1 : x) });
      fs.writeFileSync(path.join(TMP, 'ctl.json'), JSON.stringify([jj]));
      const r = JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(TMP, 'px.py'), path.join(TMP, 'ctl.json')]).toString());
      ck('CONTROL: a cell map shifted by one cell fails the bit-for-bit check', r[0][1] === false); } }
  ck('CONTROL: a FILLER passive put back would be caught (the removed list must equal FILLER)', removed.slice(1).sort().join() !== FILLER.slice().sort().join());
} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
})();
