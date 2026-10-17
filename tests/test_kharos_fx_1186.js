'use strict';
// v1186 - KHAROS BLOOMKNIFE's three spell FX (Grok renders, Phil approved 16 Oct 2026 - ChatGPT in the AI channel), DISPLAY ONLY:
//   PETAL SEVER       kharos_green_petal_sever_16oct.mp4     the double-strike X slash ON THE ENEMY he strikes, from green cell 18 (f54: his blades
//                                                            cross in the lunge - his contact cell), 2.0 s real time, once
//   BLOOMSTEP         kharos_blue_bloomstep_16oct.mp4        the petal storm that wraps him and closes to a column, ON HIM (behind him, riding
//                                                            with him), from blue cell 9 (f23: his cape flares), 6.0 s real time, once
//   ORCHID EXECUTION  kharos_ult_orchid_execution_16oct.mp4  the rapid multi-slash ON HIS TARGET, from ult cell 23 (f24: his wings open), 2.4 s
// They replace FX2_DEF.kharos_green / blue / ult in place (same keys); green-plate keyed keeping their magenta (NODEMAG); every 2nd frame of the
// 25 fps clips = 12.5 fps. Mirrored by the side he strikes from (the target's art) or his facing (his own). CONTROL against the live build:
// casts and whole fights with Kharos on both sides are tick-identical (FX never move game logic).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '68b7ffae';   // live v1188 (death batch 2), the build this change sits on
const VER = process.env.EW_KFX_VER || '1186';
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'kfx-base-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server')); for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
  fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE_SHA + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { baseOk = false; }
const OLD = path.join(BD, 'emberweave-heroes.html');
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = baseOk ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) { const b = fs.readFileSync(file), tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; }
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const KEYS = ['kharos_green', 'kharos_blue', 'kharos_ult'], FILES = { kharos_green: 'kharos_petal_sever_16oct', kharos_blue: 'kharos_bloomstep_16oct', kharos_ult: 'kharos_orchid_execution_16oct' };
function sheetProblems(F) { const bad = [];
  for (const k of KEYS) { const d = F[k]; if (!d) { bad.push(k + ' missing'); continue; } const f = fileOf(d.u);
    if (!fs.existsSync(f)) { bad.push(k + ' missing file'); continue; }
    const sz = webpSize(f), ch = chunks(fs.readFileSync(f));
    if (d.n > d.cols * d.rows || d.n <= (d.cols - 1) * d.rows) bad.push(k + ' n does not fill its grid');
    if (d.fw * d.cols > 2048 || d.fh * d.rows > 2048) bad.push(k + ' > 2048 px');
    if (fs.statSync(f).size > 4e6) bad.push(k + ' > 4 MB');
    if (!sz || sz[0] !== d.fw * d.cols || sz[1] !== d.fh * d.rows) bad.push(k + ' file ' + sz + ' != grid');
    if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) bad.push(k + ' not a q95 lossy WebP with alpha'); }
  return bad; }
// a cast through castKit / castAbility; the target at `ex` (right or left of him): every tick, every effect and damage tick, and (new page) the art
const CAST = (kind, ex, opt) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123();
  const g=makeUnit('kharos','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',${ex},700,30,{owned:false}); const e2=makeUnit('tick','enemy',${ex > 500 ? 620 : 380},740,30,{owned:false});
  g.anim=BATTLE_ANIM.kharos; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.greenCd=x.blueCd=99; x.speed=0;}); g.atkCd=99; g.speed=0; g.target=e;
  const fx=[], dm=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const _dd=dealDamage; dealDamage=function(s,t){ if(s===g) dm.push(t.key+'@'+battleTime.toFixed(4)); return _dd.apply(this,arguments); };
  g._castSM=1; g._castLv=1; const OPT=${JSON.stringify(opt || {})};
  try{ if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS.kharos['${kind}']);
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let fired=null, pend=!!g._pend, shown=null, gone=null, cut=null, T=null, mir=null, cells=[]; const tr=[];
    for(let i=0;i<Math.round(7/SIM_STEP);i++){ if(OPT.cancelAt!=null&&Math.abs(battleTime-OPT.cancelAt)<SIM_STEP/2) castCancel(g,'TEST');
      updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=0; e2.energy=0;
      if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4);
      const o=(typeof _fx1123!=='undefined')?_fx1123.find(q=>q.kind==='fx16'&&q.u===g):null;
      if(o&&o.s&&shown==null){ shown=+battleTime.toFixed(4); T=o.T&&o.T.key; mir=!!o.mir; } if(o&&o.s) cells.push([+battleTime.toFixed(4),o.fr]); if(o&&o.cut!=null&&cut==null) cut=+battleTime.toFixed(4);
      if(shown!=null&&!o&&gone==null) gone=+battleTime.toFixed(4);
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),Math.round(u.energy||0)].join(':')).join('|')); }
    return JSON.stringify({hold,anim,fired,fx,dm,trace:tr.join('#').length+':'+tr.join('#').split('').reduce((h,c)=>(Math.imul(h^c.charCodeAt(0),16777619)>>>0),2166136261),shown,gone,cut,T,mir,cells:cells.filter((c,i,a)=>i===0||c[1]!==a[i-1][1])});
  } finally { doEffect=_de; dealDamage=_dd; } })()`;
const fight = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10)].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
try {
  ck('control file (BASE page + its own external scripts from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  const src = fs.readFileSync(HTML, 'utf8'), baseSrc = fs.readFileSync(OLD, 'utf8');
  { let n = 0, bad = [];
    for (const m of src.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  { const ARCH = process.env.EW_ARCHIVE || 'C:\\Users\\Home\\OneDrive\\Desktop\\Emberweave Archive', A = path.join(ARCH, 'Game Art', '_fx2_accepted');
    try { const md5 = f => crypto.createHash('md5').update(fs.readFileSync(path.join(A, f))).digest('hex').slice(0, 8);
      ck('sources: the three accepted Kharos clips (petal sever 22f96399, bloomstep 2ecd6f68, orchid execution de200337)', md5('kharos_green_petal_sever_16oct.mp4') === '22f96399' && md5('kharos_blue_bloomstep_16oct.mp4') === '2ecd6f68' && md5('kharos_ult_orchid_execution_16oct.mp4') === 'de200337');
    } catch (e) { console.log('  info the Archive is not reachable here - sources not re-read'); } }
  // 1. the sheets
  const FXQ = 'JSON.stringify(Object.assign({FX_RT,METER},Object.fromEntries(' + JSON.stringify(KEYS) + '.map(k=>[k,FX2_DEF[k]]))))', F = JSON.parse(run(FXQ)), F0 = JSON.parse(R0(FXQ));
  { const bad = sheetProblems(F);
    ck('the three sheets exist, file = declared grid, within 2048 px per side and 4 MB, q95 lossy + alpha, real time at 12.5 fps (every 2nd frame of the 25 fps clips)', bad.length === 0 && KEYS.every(k => F[k].rt === true && F[k].fps2 === 12.5), bad.join('; '));
    ck('they replace kharos_green / blue / ult in place: new files at ?v=' + VER + ' that BASE never referenced; the old plates still on disk', KEYS.every(k => F[k].u === '/assets/anim/fx/' + FILES[k] + '.webp?v=' + VER && !baseSrc.includes(FILES[k]) && fs.existsSync(fileOf(F0[k].u))));
    ck('lengths: Petal Sever 25 cells = 2.0 s, Bloomstep 75 = 6.0 s, Orchid Execution 30 = 2.4 s (the clips\' own)', F.kharos_green.n === 25 && F.kharos_blue.n === 75 && F.kharos_ult.n === 30);
    const ctl = JSON.parse(JSON.stringify(F)); ctl.kharos_blue.fw = 900; ctl.kharos_ult.u = '/assets/anim/fx/kharos_missing.webp?v=1';
    ck('CONTROL: the sheet check catches an oversized grid and a missing file', sheetProblems(ctl).length >= 2); }
  { const PY = cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'brannus_fx_1178_check.py')].concat(KEYS.map(k => fileOf(F[k].u))), { maxBuffer: 1 << 24 }).toString();
    const Q = Object.entries(JSON.parse(PY));
    ck('green key, no fringe (measured): visible green <= 0.01% of edge px and 0 of body, dark olive (a leaked plate) <= 0.01%, teal <= 0.01%: ' + Q.map(([n, m]) => n + ' ' + m.green_edge + ' / ' + m.olive_edge + ' / ' + m.teal_edge + '%').join(', '),
      Q.length === 3 && Q.every(([, m]) => m.green_edge <= 0.01 && m.green_body === 0 && m.olive_edge <= 0.01 && m.olive_body <= 0.01 && m.teal_edge <= 0.01 && m.edge > 50000), PY);
    ck('CONTROL: 35% of the plate mixed back into the edges reads as olive on every sheet (' + Q.map(([, m]) => m.control_olive_edge + '%').join(', ') + ')', Q.every(([, m]) => m.control_olive_edge > 5)); }
  { const PM = cp.execFileSync(process.env.PYTHON || 'python', ['-I', '-c', "import sys,numpy as np\nfrom PIL import Image\nfor f in sys.argv[1:]:\n  a=np.asarray(Image.open(f).convert('RGBA')).astype(float); m=a[...,3]>200; r,g,b=a[...,0][m],a[...,1][m],a[...,2][m]\n  print(round(100*float(((r>g+40)&(b>g+20)).mean()),1))"].concat(KEYS.map(k => fileOf(F[k].u)))).toString().trim().split(/\s+/).map(Number);
    ck('the art keeps its own magenta / pink (share of the solid pixels: ' + PM.join(' / ') + '%) - the keyer\'s magenta clamp is off for these clips (NODEMAG)', PM.every(v => v > 30), PM.join()); }
  // 2. the data the engine reads is BASE's
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'ownFx' || k === 'bloom' || k === 'desc') ? undefined : v));
  const kit = r => JSON.stringify(strip(JSON.parse(r('JSON.stringify([KITS.kharos,HERO_ULT_ART.kharos,HERO_TYPES.kharos,ABILITY_CAST.kharos||null,BATTLE_ANIM.kharos])'))));
  ck('kit, ult art, hero stats, cast times and battle clips identical to BASE apart from the three ownFx display tags (kgreen / kblue / kult), Bloomstep\'s bloom flag and its text', kit(run) === kit(R0) && run("[KITS.kharos.green.ownFx,KITS.kharos.blue.ownFx,HERO_ULT_ART.kharos.ownFx,KITS.kharos.blue.bloom].join('/')") === 'kgreen/kblue/kult/true' && R0('KITS.kharos.blue.bloom') === undefined);
  { const D = run('KITS.kharos.blue.desc');
    ck('Bloomstep\'s text says what it does now, in plain words: "' + D + '"', /dodges the next hit/.test(D) && /appears behind the enemy and strikes/.test(D) && /2\.2 seconds/.test(D)); }
  const others = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>!/^kharos_(green|blue|ult)$/.test(k)).map(k=>[k,FX2_DEF[k]]))");
  ck('every other FX2_DEF entry is byte-for-byte BASE', H(others(run)) === H(others(R0)));
  ck('FX16: Petal Sever and Orchid Execution on the enemy (onTgt, in front); Bloomstep on him (wrap) IN FRONT of him for this key only (Phil: "the flower pedals need to be above him on a layer"), his fade into the figure from its cell 28 over 4 cells; the sheets warm with his figure',
    run('JSON.stringify([FX16_ART.kgreen,FX16_ART.kblue,FX16_ART.kult])') === '[{"k":"kharos_green","st":"green","mode":"onTgt","ro":995},{"k":"kharos_blue","st":"blue","mode":"wrap","ro":995,"hideAt":28,"hideN":4},{"k":"kharos_ult","st":"ult","mode":"onTgt","ro":995}]' &&
    run('JSON.stringify(FX1123_WARM.kharos)') === '["kharos_green","kharos_blue","kharos_ult"]');
  { const oth = r => r("JSON.stringify(Object.keys(FX16_ART).filter(k=>!/^k(green|blue|ult)$/.test(k)).map(k=>[k,FX16_ART[k].mode,FX16_ART[k].ro===undefined?null:FX16_ART[k].ro]))");
    ck('every other FX16 key keeps its mode and layer (ro) as BASE: ' + oth(run).length + ' chars', oth(run) === oth(R0), JSON.stringify({ now: oth(run), base: oth(R0) })); }
  // 3. casts: green / ult tick-identical; Bloomstep's evade and counter as BASE, plus the jump
  const casts = {};
  for (const kind of ['green', 'ult']) { const x = JSON.parse(run(CAST(kind, 540))), y = JSON.parse(R0(CAST(kind, 540))); casts[kind] = x;
    const pick = o => JSON.stringify([o.hold, o.anim, o.fired, o.fx, o.dm, o.trace]);
    ck(`${kind}: the cast fires on the same tick (${x.fired}), the effect and damage on the same ticks (${x.fx.join(' ')}; ${x.dm.slice(0, 2).join(' ')}), every unit = BASE for 7 s`, x.fired != null && x.anim === kind && pick(x) === pick(y), JSON.stringify({ now: pick(x), base: pick(y) })); }
  casts.blue = JSON.parse(run(CAST('blue', 540)));
  // Bloomstep, staged: Kharos at (500,700), the enemies held where given; `hitAt` - an enemy (`by`) hits him at that fight second; `killAt` - his target falls
  const BS = (r, pos, opt) => JSON.parse(r(`(()=>{ units=[]; ended=false; battleTime=0; groundHazards.length=0; seedBattle(9); const g=makeUnit('kharos','ally',500,700,30,{owned:false,rank:3}); const P=${JSON.stringify(pos)}; const es=P.map((p,i)=>makeUnit(['vael','askel'][i],'enemy',p[0],p[1],30,{owned:false,rank:3})); units=[g,...es];
    units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0; u.atkInterval=99; u.atkCd=99; u.speed=0; u.greenCd=u.blueCd=99;}); g.target=es[0]; const O=${JSON.stringify(opt || {})};
    const ev=[]; const _dd=dealDamage; dealDamage=function(s,t,a){ if(s===g) ev.push([t.key,+battleTime.toFixed(4),Math.round(a)]); return _dd.apply(this,arguments); };
    g._castSM=1; g._castLv=1; let jump=null, rel=null; const _bj=(typeof bloomstepJump==='function')?bloomstepJump:null; if(_bj) bloomstepJump=function(u,T){ const fx=u.x, fy=u.y; _bj.apply(this,arguments); if(u===g&&!jump) jump={t:+battleTime.toFixed(4),from:{x:fx,y:fy},x:+u.x.toFixed(2),y:+u.y.toFixed(2),T:T&&T.key,tx:T&&+T.x.toFixed(2),ty:T&&+T.y.toFixed(2),sum:T?(T.r||18)+(u.r||18):0,face:u._faceDir}; };
    castKit(g,KITS.kharos.blue); let pend=!!g._pend;
    for(let i=0;i<Math.round(4/SIM_STEP);i++){ if(O.hitAt!=null&&Math.abs(battleTime-O.hitAt)<SIM_STEP/2) dealDamage(es[O.by||0],g,10); if(O.killAt!=null&&Math.abs(battleTime-O.killAt)<SIM_STEP/2){ es[0].hp=0; es[0].alive=false; } if(O.killAll!=null&&Math.abs(battleTime-O.killAll)<SIM_STEP/2) es.forEach(e=>{e.hp=0;e.alive=false;});
      updateBattle(SIM_STEP); g.atkCd=99; g.greenCd=g.blueCd=99; if(pend&&!g._pend&&rel==null) rel=+battleTime.toFixed(4);
      if(!jump) es.forEach((e,j)=>{ if(e.alive){ e.x=e._ax=P[j][0]; e.y=e._ay=P[j][1]; } }); }
    dealDamage=_dd; if(_bj) bloomstepJump=_bj; return JSON.stringify({rel,jump,ev,dmg:g.dmg,mul:g._evadeMul,FW,FD}); })()`));
  { const E = BS(run, [[600, 700], [700, 800]]), B0 = BS(R0, [[600, 700], [700, 800]]), j = E.jump;
    ck(`the 2.2 s end with no hit: he appears BEHIND his target (Vael at ${j && j.tx}: him at ${j && j.x}, the far side from where he stood, ${j && j.sum} = both bodies past its centre) facing it, at ${j && j.t} s (release ${E.rel} + 2.2)`,
      !!j && j.T === 'vael' && Math.sign(j.x - j.tx) === Math.sign(j.tx - j.from.x) && Math.abs(Math.abs(j.x - j.tx) - j.sum) < 0.5 && Math.abs(j.y - j.ty) < 0.5 && j.face === -Math.sign(j.x - j.from.x) && Math.abs(j.t - (E.rel + 2.2)) <= 0.04, JSON.stringify(E));
    ck(`and strikes it the same tick with the counter's 2.1x (${E.ev.map(x => x.join('@')).join(' ')} = ${E.dmg} x ${E.mul}); on BASE the same window passes with no strike (${B0.ev.length} hits)`,
      E.ev.length === 1 && E.ev[0][0] === 'vael' && Math.abs(E.ev[0][1] - j.t) < 1e-6 && Math.abs(E.ev[0][2] - Math.round(E.dmg * E.mul)) <= 1 && B0.ev.length === 0, JSON.stringify({ E, B0 })); }
  { const C = BS(run, [[600, 700], [700, 800]], { hitAt: 1.2, by: 1 }), C0 = BS(R0, [[600, 700], [700, 800]], { hitAt: 1.2, by: 1 }), j = C.jump;
    ck(`a hit inside the window: the counter fires as BASE (on the one that hit him, Askel, the same tick and amount: ${C.ev.map(x => x.join('@')).join(' ')} vs BASE ${C0.ev.map(x => x.join('@')).join(' ')}) and first moves him behind it (${j && j.x}, ${j && j.y}); no second strike at the window's end`,
      !!j && j.T === 'askel' && JSON.stringify(C.ev) === JSON.stringify(C0.ev) && C.ev.length === 1 && Math.abs(Math.abs(j.x - j.tx) - j.sum) < 0.5 && Math.abs(j.t - C.ev[0][1]) <= 0.04, JSON.stringify({ C, C0 })); }
  { const Dd = BS(run, [[600, 700], [700, 800]], { killAt: 1.5 });
    ck(`his target falls before the end: he goes behind the nearest enemy instead (${Dd.jump && Dd.jump.T}) and strikes it`, !!Dd.jump && Dd.jump.T === 'askel' && Dd.ev.length === 1 && Dd.ev[0][0] === 'askel', JSON.stringify(Dd)); }
  { const N = BS(run, [[600, 700]], { killAll: 1.5 });
    ck('nobody left: no jump, no strike', N.jump === null && N.ev.length === 0, JSON.stringify(N)); }
  { const Eg = BS(run, [[950, 700]]);
    ck(`at the arena edge the spot behind the target is clamped inside it (target at ${Eg.jump && Eg.jump.tx}: him at ${Eg.jump && Eg.jump.x} = FW - 60)`, !!Eg.jump && Eg.jump.x === Eg.FW - 60, JSON.stringify(Eg)); }
  { const a = JSON.stringify(BS(run, [[600, 700], [700, 800]])), b = JSON.stringify(BS(run, [[600, 700], [700, 800]]));
    ck('seeded: the same staged Bloomstep twice is the same jump and strike on the same tick', a === b); }
  { const T = [[11, ['kharos', 'tick', 'sylthaine'], ['kharos', 'vireo', 'grosk']], [17, ['kharos', 'vael', 'lumi'], ['brannus', 'korvux', 'astra']], [23, ['hobb', 'kharos', 'korvux', 'lumi', 'vex'], ['kharos', 'aureth', 'carn', 'oakmir', 'rhukk']]];
    const nb = T.map(([s, x, y]) => { const r = load(HTML); r('KITS.kharos.blue.bloom=false; 1'); return fight(r, s, x, y); }), b = T.map(([s, x, y]) => fight(load(OLD), s, x, y));
    ck('whole fights with Kharos on both sides and the bloom flag off are tick-identical to BASE (the three FX move nothing)', JSON.stringify(nb) === JSON.stringify(b), JSON.stringify({ nb, b }));
    const a = T.map(([s, x, y]) => fight(load(HTML), s, x, y));   // fresh pages: a won fight runs on into the next wave, whose spawns read page state the harness does not reset
    ck('with Bloomstep\'s jump they change (' + a.filter((h, i) => h !== b[i]).length + ' of ' + a.length + ') and are deterministic (the same seed twice)', a.some((h, i) => h !== b[i]) && T.every(([s, x, y], i) => fight(load(HTML), s, x, y) === a[i]));
    const NO = [[11, ['askel', 'vesper', 'seyla'], ['vael', 'tick', 'lumi']], [222, ['nox', 'sorrel', 'umbris'], ['pellucid', 'veyr', 'oakmir']], [5, ['korvux', 'rafe', 'brannus'], ['hobb', 'hurne', 'quorrel']]];
    ck('whole fights without Kharos are tick-for-tick BASE (every other hero)', NO.every(([s, x, y]) => fight(load(HTML), s, x, y) === fight(load(OLD), s, x, y)));
    const rc = load(HTML); rc('KITS.kharos.green.mul*=0.5; 1'); const c = fight(rc, T[0][0], T[0][1], T[0][2]);
    ck('CONTROL: the same fight with Petal Sever\'s damage halved is NOT identical (the instrument sees game logic)', c !== a[0]); }
  // 4. the moments: on the cell of his own clip where it happens
  const step = +run('SIM_STEP'), A = JSON.parse(run('JSON.stringify({g:BATTLE_ANIM.kharos.green.fps,b:BATTLE_ANIM.kharos.blue.fps,u:BATTLE_ANIM.kharos.ult.fps})'));
  const FR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/hobb_kharos_1175_frames.json'), 'utf8')).kharos.frames;
  for (const [kind, k, cell, fps, f, what, real, tgt] of [['green', 'kharos_green', 18, A.g, 54, 'his blades cross in the lunge', 2.0, 'vael'], ['blue', 'kharos_blue', 9, A.b, 23, 'his cape flares', 6.0, 'kharos'], ['ult', 'kharos_ult', 23, A.u, 24, 'his wings open', 2.4, 'vael']]) {
    const x = casts[kind], want = cell / fps * F.FX_RT;
    ck(`${kind}: the art shows on ${kind} cell ${cell} (f${FR[kind][cell]}: ${what}; ${want.toFixed(3)} fight s after the press, measured ${x.shown}) on ${tgt === 'kharos' ? 'him' : 'the enemy he strikes'} (${x.T})`,
      F[k].spawn === cell && FR[kind][cell] === f && x.shown != null && Math.abs(x.shown - want) <= step + 1e-6 && x.T === tgt, JSON.stringify(x));
    if (kind === 'blue') { const jt = x.fired + 2.2, fade = F[k].figFade * F.FX_RT;
      ck(`blue: real time at 12.5 fps, never looping, until he jumps (the window's end, ${jt.toFixed(3)} s); then the flower figure stays where he stood and fades out over ${F[k].figFade} real s (gone ${x.gone})`, x.gone != null && Math.abs(x.gone - (jt + fade)) <= 3 * step && x.cells.every((c, i, a) => i === 0 || c[1] >= a[i - 1][1]), JSON.stringify(x.cells.slice(-4))); continue; }
    ck(`${kind}: real time at 12.5 fps, once (${F[k].n} cells = ${real} real s = ${(real * F.FX_RT).toFixed(3)} fight s; shown for ${(x.gone - x.shown).toFixed(3)}), never looping`,
      x.gone != null && Math.abs((x.gone - x.shown) - real * F.FX_RT) <= 2 * step && x.cells.every((c, i, a) => i === 0 || c[1] >= a[i - 1][1]), JSON.stringify(x.cells.slice(0, 6))); }
  { const L = JSON.parse(run(CAST('green', 460))), Lu = JSON.parse(run(CAST('ult', 460)));
    ck('flipped by side: struck from its left the art is as painted (mir ' + casts.green.mir + ' / ' + casts.ult.mir + '); with the enemy on his LEFT it is mirrored (mir ' + L.mir + ' / ' + Lu.mir + ')', casts.green.mir === false && casts.ult.mir === false && L.mir === true && Lu.mir === true && L.T === 'vael', JSON.stringify({ L, Lu })); }
  { const M = JSON.parse(run(`(()=>{ const g=makeUnit('kharos','ally',500,700,30,{owned:false}); const T=makeUnit('vael','enemy',600,700,30,{owned:false}); const mk=()=>({center:{set(x,y){this.x=x;this.y=y;}},scale:{set(x,y){this.x=x;this.y=y;}},position:{copy(){}},_uv:[0.12,0.09,0.3,0.4]});
      const out=[]; for(const [vk,mir] of [['kgreen',false],['kgreen',true],['kblue',false]]){ const o={vk,d:FX2_DEF[FX16_ART[vk].k],u:g,T:vk==='kblue'?g:T,s:mk(),mir}; _fx22Fx16On(o); out.push({vk,mir,uv:o.s._uv[0],cx:+o.s.center.x.toFixed(3),cy:+o.s.center.y.toFixed(3)}); }
      return JSON.stringify(out); })()`));
    ck('mirrored on screen (UV window and anchor) when flipped; Bloomstep sits on his feet (anchor ' + F.kharos_blue.anchor + '), the slashes centred on the enemy (anchor ' + F.kharos_green.anchor + ', mid ' + F.kharos_green.mid + ')',
      M[0].uv > 0 && M[1].uv < 0 && Math.abs(M[0].cx - F.kharos_green.anchor[0]) < 1e-3 && Math.abs(M[1].cx - (1 - F.kharos_green.anchor[0])) < 1e-3 && Math.abs(M[2].cy - F.kharos_blue.anchor[1]) < 1e-3 && F.kharos_green.mid === 0.5 && F.kharos_ult.mid === 0.5, JSON.stringify(M)); }
  { const pre = JSON.parse(run(CAST('green', 540, { cancelAt: 0.1 })));
    ck(`an interrupted cast before its cell never shows the art (Petal Sever cancelled at 0.1 s: shown ${pre.shown})`, pre.shown === null, JSON.stringify(pre)); }
  { const P = JSON.parse(run(`JSON.stringify([0,1,2].map(sl=>{ const p=skillPreviewPlan('kharos',sl); return p?p.fx.map(e=>({k:e.k,kind:e.kind,at:e.at||null,t0:+e.t0.toFixed(4),real:e.real!=null?+e.real.toFixed(3):null})):null; }))`));
    const [u, g, b] = P;
    ck('Skills tab previews (v1164) show the same art at the same cells: Petal Sever and Orchid Execution on the target (fx16over) from green 18 / ult 23, Bloomstep on him (fx16puff) from blue 9, each its real length (' + JSON.stringify(P) + ')',
      g && g.length === 1 && g[0].k === 'kharos_green' && g[0].kind === 'fx16over' && Math.abs(g[0].t0 - 18 / A.g) < 1e-3 && Math.abs(g[0].real - 2.0) < 1e-3 &&
      b && b.length === 1 && b[0].k === 'kharos_blue' && b[0].kind === 'fx16puff' && Math.abs(b[0].t0 - 9 / A.b) < 1e-3 && Math.abs(b[0].real - 6.0) < 1e-3 &&
      u && u.length === 1 && u[0].k === 'kharos_ult' && u[0].kind === 'fx16over' && Math.abs(u[0].t0 - 23 / A.u) < 1e-3 && Math.abs(u[0].real - 2.4) < 1e-3, JSON.stringify(P)); }
  { const t0 = cp.execSync('git show ' + BASE_SHA + ':assets/anim/tiers_1141.json', { cwd: ROOT }).toString();
    ck('the tier table is BASE byte for byte (each new sheet <= 2048 px has no tier file)', fs.readFileSync(path.join(ROOT, 'assets/anim/tiers_1141.json'), 'utf8') === t0); }
  { const i = src.indexOf('kgreen:{k:'); ck('no emoji added', i > 0 && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src.slice(i - 300, i + 600))); }
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
