'use strict';
// v1217 - Grosk's Hammer Fists burst (Phil approved 23 Oct 22:36) and Fritz's three 18 Oct spell FX (Phil OK 23 Oct 23:07), DISPLAY ONLY:
//   HAMMER FISTS     grosk_hammer_fists_burst_single.mp4 (1.17 s, green key, no fist prop): ONE burst per punch, from that punch's damage tick (hitTimes
//                    1.083 / 2.0 / 2.833 s of his blue clip), its origin on his fist as those cells draw it, mirrored with his facing; 24 fps real time, once
//   STORM SURGE      fritz_green_storm_surge_18oct.mp4: one strike per bolt, upright on the enemy that bolt hits, its `land` cell (the bolt meets the
//                    ground) drawn on that bolt's damage tick; 12 fps real time, once
//   CHAIN LIGHTNING  fritz_blue_chain_lightning_18oct.mp4: one bolt per jump, its base on the unit it leaves, stretched to the unit it hits; once
//   THUNDER SHOWER   fritz_ult_thunder_shower_18oct.mp4: over Fritz from the ult press (its first bolts reach the ground with the channel's first
//                    tick), pinned on the storm centre at the release, faded on a cancelled cast; once. The old 1 Oct plates stay on disk.
//   GLAZEBREAKER     hobb_green_glazebreaker_18oct.mp4 (Hobb, Grok 23 Oct 23:09): the jar on the enemy from the press, shattering (cell `smash`) on the
//                    damage tick; held through a stun, faded on a cancel; once.
// CONTROL against the live build (git show BASE): casts and whole fights with Grosk and Fritz are tick-identical (FX never move game logic).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const VER = process.env.EW_VER || '1217';
const BASE_SHA = process.env.EW_BASE || 'd1930405';   // live v1216, before this change
const SRC = 'C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/_fx2_accepted/';
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-gf1217-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = OLD ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) { const b = fs.readFileSync(file), tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; }
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const KEYS = ['grosk_blue', 'fritz_green', 'fritz_blue', 'fritz_ult', 'hobb_green'];
const FILES = { grosk_blue: 'grosk_hammer_fists_23oct', fritz_green: 'fritz_storm_surge_18oct', fritz_blue: 'fritz_chain_lightning_18oct', fritz_ult: 'fritz_thunder_shower_18oct', hobb_green: 'hobb_glazebreaker_18oct' };
const MP4 = { grosk_blue: ['grosk_hammer_fists_burst_single.mp4', 'e279aea3'], fritz_green: ['fritz_green_storm_surge_18oct.mp4', '45326727'],
  fritz_blue: ['fritz_blue_chain_lightning_18oct.mp4', '357af741'], fritz_ult: ['fritz_ult_thunder_shower_18oct.mp4', '9ae7d8f1'], hobb_green: ['hobb_green_glazebreaker_18oct.mp4', '384ae974'] };
function sheetProblems(F) { const bad = [];
  for (const k of KEYS) { const d = F[k]; if (!d) { bad.push(k + ' missing'); continue; } const f = fileOf(d.u);
    if (!fs.existsSync(f)) { bad.push(k + ' missing file'); continue; }
    const sz = webpSize(f), ch = chunks(fs.readFileSync(f));
    if (d.n > d.cols * d.rows || d.n <= (d.cols - 1) * d.rows) bad.push(k + ' n does not fill its grid');
    if (d.fw * d.cols > 2048 || d.fh * d.rows > 2048) bad.push(k + ' > 2048 px');
    if (fs.statSync(f).size > 4e6) bad.push(k + ' > 4 MB');
    if (!sz || sz[0] !== d.fw * d.cols || sz[1] !== d.fh * d.rows) bad.push(k + ' file ' + sz + ' != grid');
    if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) bad.push(k + ' not a q95 lossy WebP with alpha');
    if (Math.abs(d.dur - d.n / d.fps2) > 1e-3 || !d.rt) bad.push(k + ' dur != n / fps2 or not real time'); }
  return bad; }
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));
/* one cast: the hero + an ally + five enemies (the first touching him, on his RIGHT or, with left, on his LEFT); every effect / hit / unit for 10 s; the art (new page) */
const CAST = (hero, kind, opt) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123();
  const OPT=${JSON.stringify(opt || {})}, s=OPT.left?-1:1;
  const g=makeUnit('${hero}','ally',600,700,30,{owned:false,rank:3}); const a=makeUnit('vael','ally',600-s*150,560,30,{owned:false});
  const E=[['tick',50,0],['sylthaine',160,90],['korvux',260,-80],['umbris',330,60],['nox',420,-20]].map(([k,dx,dy])=>{ const e=makeUnit(k,'enemy',600+s*dx,700+dy,30,{owned:false}); e._px=600+s*dx; e._py=700+dy; return e; });
  units=[g,a].concat(E); units.forEach(u=>{ try{ buildFigure(u); }catch(_e){} }); g.anim=BATTLE_ANIM['${hero}']; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;});
  const park=()=>{ units.forEach(x=>{ x.atkInterval=x===g?x.atkInterval:99; x.atkCd=99; x.greenCd=x.blueCd=99; if(x!==g) x.speed=0; }); };
  park(); for(let i=0;i<Math.round(20/SIM_STEP)&&(g._dropHidden||g.x<0||g._noTarget);i++){ updateBattle(SIM_STEP); units.forEach(x=>{ x.hp=x.maxHp; x.energy=0; }); park(); }
  g.x=600; g.y=700; g._ax=g.x; g._ay=g.y; E.forEach(e=>{ e.x=e._ax=e._px; e.y=e._ay=e._py; }); park(); g.speed=0; g.glyphCrit=0; g.target=E[0]; g._faceDir=s; g._fxMirror=OPT.left?true:false;
  const fx=[], hits=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const _dd=dealDamage; dealDamage=function(sr,t){ if(sr===g) hits.push(t.key+'@'+battleTime.toFixed(4)); return _dd.apply(this,arguments); };
  let plates=[], fplates=[], bolts=0; const _sg=spawnGroundFx; spawnGroundFx=function(k){ if(/^(grosk|fritz)_/.test(k)) plates.push(k); return _sg.apply(this,arguments); };
  const _sf=spawnFxPlate; spawnFxPlate=function(k){ if(/^fritz_/.test(k)) fplates.push(k); return _sf.apply(this,arguments); };
  const _sb=spawnBoltFx; spawnBoltFx=function(){ bolts++; return _sb.apply(this,arguments); };
  const texs=[]; const _ft=fx2Tex; fx2Tex=function(k){ if(/^(grosk|fritz|hobb)_/.test(k)&&FX2_DEF[k]) texs.push(FX2_DEF[k].u); return _ft.apply(this,arguments); };   /* every sheet a painter fetches during the cast */
  g._castSM=1; g._castLv=1; const press=battleTime;
  try{
    if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,'${kind}'==='blue'?(g.blueAb||KITS['${hero}'].blue):(g.greenAb||KITS['${hero}'].green));
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; const seen=new Map(), arts=[];
    const tr=[]; for(let i=0;i<Math.round(10/SIM_STEP);i++){ if(OPT.cancel&&i===3){ castCancel(g); }
      if(OPT.stun&&i===3){ g.stunned=1.0; }
      updateBattle(SIM_STEP); park(); if('${kind}'!=='ult') g.energy=0;
      const live=(typeof _fx1123!=='undefined')?_fx1123.filter(o=>/^(gfist|fstrike|fchain|fstorm|hglaze)$/.test(o.kind)):[];
      for(const o of live){ if(!seen.has(o)){ const r={kind:o.kind,made:+battleTime.toFixed(4),shown:null,from:o.u?o.u.key:null,on:o.T?o.T.key:null,frs:[],lastFr:-1,gone:null,mir:o.mir,P:null,land:null,bolts:null,cut:false}; seen.set(o,r); arts.push(r); } const r=seen.get(o);
        const fr=o.fr; if(fr!=null&&r.shown==null) r.shown=+battleTime.toFixed(4);   /* o.fr = the cell the painter drew (the sim host's sprites are stubs) */
        if(fr!=null&&fr!==r.lastFr){ r.frs.push(fr); r.lastFr=fr; if(fr>=(o.d.land||1e9)&&r.land==null) r.land=+battleTime.toFixed(4); if(fr>=(o.d.bolts||1e9)&&r.bolts==null) r.bolts=+battleTime.toFixed(4); if(fr>=(o.d.smash||1e9)&&r.smash==null) r.smash=+battleTime.toFixed(4); }
        if(o.P) r.P=[+o.P.x.toFixed(2),+o.P.y.toFixed(2)]; if(o.cut!=null) r.cut=true; }
      for(const [o,r] of seen) if(r.gone==null&&!live.includes(o)) r.gone=+battleTime.toFixed(4);
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),+(u.silencedT||0).toFixed(2),u.forcedTarget?u.forcedTarget.key:'-'].join(':')).join('|')); }
    return JSON.stringify({press,hold,anim,fx,hits,trace:crypto_like(tr.join('#')),plates,fplates,bolts,texs:[...new Set(texs)],arts,storm:[g._stormX,g._stormY]});
  } finally { doEffect=_de; dealDamage=_dd; spawnGroundFx=_sg; spawnFxPlate=_sf; spawnBoltFx=_sb; fx2Tex=_ft; } })()`;
const fight = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10)].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');

try {
  ck('control file (BASE emberweave-heroes.html from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; '));
    let cb = 0; try { new vm.Script(html.replace('function _fx22FChain(o){', 'function _fx22FChain(o){ if( ').match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken painter', cb === 1); }
  const src = fs.readFileSync(HTML, 'utf8'), baseSrc = fs.readFileSync(OLD, 'utf8');
  // 1. sources + sheets
  { const got = KEYS.map(k => { const f = SRC + MP4[k][0]; return fs.existsSync(f) ? crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8) : null; });
    ck('the five sources are the Phil-approved clips in _fx2_accepted (md5 ' + got.join(' ') + ')', KEYS.every((k, i) => got[i] === MP4[k][1])); }
  const FXQ = 'JSON.stringify(Object.assign({FX_RT,METER,SC,STEP:SIM_STEP},Object.fromEntries(' + JSON.stringify(KEYS) + '.map(k=>[k,FX2_DEF[k]]))))', F = JSON.parse(run(FXQ)), F0 = JSON.parse(R0(FXQ));
  const bad = sheetProblems(F);
  ck('the five sheets exist, file = declared grid, within 2048 px per side and 4 MB, q95 lossy + alpha, real time with dur = n / fps2', bad.length === 0, bad.join('; '));
  { const sz = KEYS.map(k => { const d = F[k]; return k + ' ' + d.fw * d.cols + 'x' + d.fh * d.rows + ' ' + (fs.statSync(fileOf(d.u)).size / 1e6).toFixed(2) + ' MB file'; }); console.log('  info sheets: ' + sz.join('; ')); }
  ck('new files at ?v=' + VER + ' that BASE never referenced; the old sheets stay on disk (rollback needs nothing)',
    KEYS.every(k => F[k].u === '/assets/anim/fx/' + FILES[k] + '.webp?v=' + VER && !baseSrc.includes(FILES[k]) && fs.existsSync(fileOf(F0[k].u))));
  { const ctl = JSON.parse(JSON.stringify(F)); ctl.fritz_blue.fw = 900; ctl.fritz_ult.u = '/assets/anim/fx/fritz_missing.webp?v=1';
    ck('CONTROL: the sheet check catches an oversized grid and a missing file', sheetProblems(ctl).length >= 2); }
  { const PY = cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'hollow_fx_1191_check.py')].concat(KEYS.map(k => fileOf(F[k].u))), { maxBuffer: 1 << 24 }).toString();
    const Q = JSON.parse(PY), M = KEYS.map(k => Q[FILES[k] + '.webp']);
    ck('no fringe: visible green 0 on every sheet (edge <= 0.01%, body 0), the soft edge no more olive than 0.5%: ' + PY,
      M.every(m => m && m.green_edge <= 0.01 && m.green_body === 0 && m.olive_edge <= 0.5));
    ck('CONTROL: the plate mixed back into the edges reads as olive / green (' + M.map(m => m.control_green_edge + '/' + m.control_olive_edge).join(', ') + '%)', M.every(m => m.control_green_edge > 20 || m.control_olive_edge > 20)); }
  // 2. data = BASE apart from the display tags
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'ownFx' ? undefined : v));
  const kit = (r, h) => JSON.stringify(strip(JSON.parse(r(`JSON.stringify([KITS.${h},HERO_TYPES.${h},ABILITY_CAST.${h}||null,ULT_DEF[HERO_TYPES.${h}.ability]||null,BATTLE_ANIM.${h}])`))));
  ck('Grosk, Fritz and Hobb: kits, hero stats, cast times, ult numbers and battle clips identical to BASE apart from the ownFx display tags (gfist / fstrike / fchain / hglaze)',
    kit(run, 'grosk') === kit(R0, 'grosk') && kit(run, 'fritz') === kit(R0, 'fritz') && kit(run, 'hobb') === kit(R0, 'hobb') && run("[KITS.grosk.blue.ownFx,KITS.fritz.green.ownFx,KITS.fritz.blue.ownFx,KITS.hobb.green.ownFx].join('/')") === 'gfist/fstrike/fchain/hglaze' && R0('KITS.grosk.blue.ownFx||KITS.fritz.green.ownFx||KITS.fritz.blue.ownFx||KITS.hobb.green.ownFx||null') === null);
  ck('CONTROL: the kit comparison sees a changed number', (() => { run('globalThis.__m=KITS.grosk.blue.mul; KITS.grosk.blue.mul=0.61; 1'); const d = kit(run, 'grosk') !== kit(R0, 'grosk'); run('KITS.grosk.blue.mul=globalThis.__m; 1'); return d; })());
  ck('the ult art: BASE\'s plate (gfx fritz_ult) becomes the storm painter (ownFx fstorm)', run('JSON.stringify(HERO_ULT_ART.fritz)') === '{"ownFx":"fstorm","previewAt":"self"}' && R0('JSON.stringify(HERO_ULT_ART.fritz)') === '{"gfx":"fritz_ult","gdur":3,"previewAt":"self"}');
  const others = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>!/^(grosk_blue|fritz_green|fritz_blue|fritz_ult|hobb_green)$/.test(k)).map(k=>[k,FX2_DEF[k]]))");
  ck('every other FX2_DEF entry is byte-for-byte BASE', H(others(run)) === H(others(R0)));
  ck('their sheets load with their figures (FX1123_WARM)', run('JSON.stringify([FX1123_WARM.grosk,FX1123_WARM.fritz,FX1123_WARM.hobb])') === '[["grosk_blue"],["fritz_green","fritz_blue","fritz_ult"],["hobb_green"]]' && R0('typeof FX1123_WARM.grosk+typeof FX1123_WARM.fritz+typeof FX1123_WARM.hobb') === 'undefinedundefinedundefined');
  // 3. tick-identical
  const STEP = F.STEP, RT = F.FX_RT, casts = {};
  for (const [hero, kind, opt] of [['grosk', 'blue', {}], ['grosk', 'blue', { left: true }], ['fritz', 'green', {}], ['fritz', 'blue', {}], ['fritz', 'ult', {}], ['fritz', 'ult', { cancel: true }], ['hobb', 'green', {}], ['hobb', 'green', { stun: true }], ['hobb', 'green', { cancel: true }]]) {
    const tag = hero + '-' + kind + (opt.left ? 'L' : opt.cancel ? 'C' : opt.stun ? 'S' : ''), x = JSON.parse(run(CAST(hero, kind, opt))), y = JSON.parse(R0(CAST(hero, kind, opt))); casts[tag] = x; casts[tag + '0'] = y;
    const pick = o => JSON.stringify([o.hold, o.anim, o.fx, o.hits, o.trace]);
    ck(`${tag}: the effects and every hit land on the same ticks (${x.fx.join(' ')}; ${x.hits.slice(0, 6).join(' ')}) and every unit (hp, position, stun, silence, taunt) = BASE for 10 s`, pick(x) === pick(y), JSON.stringify({ now: pick(x), base: pick(y) }));
  }
  { const T = [[11, ['grosk', 'fritz', 'vael'], ['tick', 'sylthaine', 'korvux']], [23, ['fritz', 'veyr', 'grosk', 'lumi', 'vex'], ['mirelle', 'aureth', 'carn', 'oakmir', 'grosk']], [5, ['fritz', 'deepcleft', 'hobb'], ['umbris', 'nox', 'fritz', 'hobb']]];
    const a = T.map(([s, x, y]) => fight(run, s, x, y)), b = T.map(([s, x, y]) => fight(R0, s, x, y));
    ck('whole fights (3 seeds, Grosk, Fritz and Hobb on both sides, their auto-cast spells and ults) are tick-identical to BASE', JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
    run('globalThis.__s=KITS.fritz.blue.mul; KITS.fritz.blue.mul*=0.5; 1'); const c = fight(run, T[1][0], T[1][1], T[1][2]); run('KITS.fritz.blue.mul=globalThis.__s; 1');
    ck('CONTROL: the seed-23 fight with Chain Lightning\'s damage halved is NOT identical (the instrument sees game logic)', c !== b[1]); }
  // 4. the moments
  { const x = casts['grosk-blue'], d = F.grosk_blue, A = x.arts.filter(r => r.kind === 'gfist'), ht = x.hits.map(h => +h.split('@')[1]);
    ck(`Hammer Fists: three bursts, each made and shown on its punch's damage tick (punches ${ht.join(' ')}; bursts ${A.map(r => r.shown).join(' ')}), no old plate`,
      ht.length === 3 && A.length === 3 && A.every((r, i) => Math.abs(r.shown - ht[i]) <= STEP + 1e-6) && x.plates.length === 0, JSON.stringify(x));
    ck(`... each plays its ${d.n} cells once at ${d.fps2} fps real time (${(d.n / d.fps2).toFixed(3)} s; drawn to cell ${A.map(r => r.lastFr).join('/')}, for ${A.map(r => r.gone && ((r.gone - r.made) / RT).toFixed(2)).join('/')} s)`,
      A.every(r => r.lastFr === d.n - 1 && r.frs[0] === 0 && r.gone && Math.abs((r.gone - r.made) - d.n / d.fps2 * RT) <= 2 * STEP));
    const L = casts['grosk-blueL'].arts.filter(r => r.kind === 'gfist');
    ck('... painted facing right: unmirrored when he faces right, mirrored when the enemy is on his left', A.every(r => r.mir === false) && L.length === 3 && L.every(r => r.mir === true));
    const y = casts['grosk-blue0'];
    ck('CONTROL: BASE drew the old badge plate (' + JSON.stringify(y.plates) + ') and no bursts', y.plates.includes('grosk_blue') && y.arts.length === 0); }
  { const x = casts['fritz-green'], d = F.fritz_green, A = x.arts.filter(r => r.kind === 'fstrike'), H2 = x.hits.map(h => h.split('@')), M = A.map(r => [r.on, r.land]);
    const okEach = H2.every(([k, t]) => M.some(([on, land]) => on === k && Math.abs(land - +t) <= 2 * STEP));
    ck(`Storm Surge: one strike per bolt on the enemy it hits (${H2.length} bolts: ${H2.map(h => h.join('@')).join(' ')}), its land cell ${d.land} drawn on that bolt's damage tick (${M.map(m => m.join('@')).join(' ')}), no old plates`,
      H2.length === 5 && A.length === 5 && okEach && x.plates.length === 0, JSON.stringify(x));
    ck(`... each plays once to its last cell (${d.n} cells, ${(d.n / d.fps2).toFixed(2)} s)`, A.every(r => r.lastFr === d.n - 1 && r.frs[0] === 0), JSON.stringify(A.map(r => [r.frs.slice(0, 4), r.lastFr, r.made, r.shown, r.gone])));
    const y = casts['fritz-green0'];
    ck('CONTROL: BASE drew its old storm plate per bolt (' + y.plates.length + ' fritz_green) and no strikes', y.plates.filter(k => k === 'fritz_green').length === 5 && y.arts.length === 0); }
  { const x = casts['fritz-blue'], d = F.fritz_blue, A = x.arts.filter(r => r.kind === 'fchain'), order = x.hits.map(h => h.split('@')[0]);
    const pairs = A.map(r => r.from + '>' + r.on), want = order.map((k, i) => (i ? order[i - 1] : 'fritz') + '>' + k);
    ck(`Chain Lightning: one bolt per jump, from the unit it leaves to the unit it hits (${pairs.join(' ')} = ${want.join(' ')}), made with the damage (${[...new Set(A.map(r => r.made))].join(',')}; hits ${[...new Set(x.hits.map(h => h.split('@')[1]))].join(',')}), no old bolt sprites`,
      A.length === 4 && JSON.stringify(pairs) === JSON.stringify(want) && A.every(r => x.hits.some(h => Math.abs(+h.split('@')[1] - r.made) <= STEP + 1e-6)) && x.bolts === 0, JSON.stringify(x));
    ck(`... each plays once to its last cell (${d.n} cells, ${(d.n / d.fps2).toFixed(2)} s)`, A.every(r => r.lastFr === d.n - 1 && r.frs[0] === 0 && Math.abs((r.gone - r.made) - d.n / d.fps2 * RT) <= 2 * STEP));
    const y = casts['fritz-blue0'];
    ck('CONTROL: BASE drew its old chain bolt sprites (' + y.bolts + ') and none of the new', y.bolts === 4 && y.arts.length === 0); }
  { const x = casts['fritz-ult'], d = F.fritz_ult, A = x.arts.filter(r => r.kind === 'fstorm'), first = x.hits.length ? +x.hits[0].split('@')[1] : null, rel = x.fx.find(s => /^thundershower@/.test(s)), relT = rel ? +rel.split('@')[1] : null;
    ck(`Thunder Shower: one storm, made at the press (${x.press}; made ${A.length ? A[0].made : '-'}), pinned on the storm centre at the release (${relT}: ${A.length ? JSON.stringify(A[0].P) : '-'} = ${JSON.stringify(x.storm.map(v => +(+v).toFixed(2)))}), no old plates`,
      A.length === 1 && Math.abs(A[0].made - x.press - STEP) <= STEP + 1e-6 && A[0].P && Math.abs(A[0].P[0] - x.storm[0]) < 0.01 && Math.abs(A[0].P[1] - x.storm[1]) < 0.01 && x.plates.length === 0 && x.fplates.length === 0, JSON.stringify(x));
    ck(`... its first bolts (cell ${d.bolts}) reach the ground with the channel's first damage tick (bolts ${A.length ? A[0].bolts : '-'}, first tick ${first}; within 0.1 s)`, A.length === 1 && first != null && Math.abs(A[0].bolts - first) <= 0.1, JSON.stringify(A));
    ck(`... the whole clip once (${d.n} cells, ${(d.n / d.fps2).toFixed(2)} real s)`, A.length === 1 && A[0].lastFr === d.n - 1 && A[0].frs[0] === 0 && Math.abs((A[0].gone - A[0].made) - d.n / d.fps2 * RT) <= 2 * STEP);
    const C = casts['fritz-ultC'], Ca = C.arts.filter(r => r.kind === 'fstorm');
    ck(`... a cancelled cast (castCancel before the release: no case, ${C.fx.length} effects) fades its storm before the bolts (last cell ${Ca.length ? Ca[0].lastFr : '-'} < ${d.bolts}, gone ${Ca.length ? Ca[0].gone : '-'})`,
      Ca.length === 1 && C.fx.length === 0 && Ca[0].cut && Ca[0].lastFr < d.bolts && Ca[0].gone != null && Ca[0].gone < 0.6, JSON.stringify(C));
    const y = casts['fritz-ult0'];
    ck('CONTROL: BASE drew the old plates (' + JSON.stringify(y.plates.concat(y.fplates)) + ') and no storm', (y.plates.includes('fritz_ult') || y.fplates.includes('fritz_showerfx')) && y.arts.length === 0); }
  { const x = casts['hobb-green'], d = F.hobb_green, A = x.arts.filter(r => r.kind === 'hglaze'), hit = x.hits.length ? +x.hits[0].split('@')[1] : null;
    ck(`Glazebreaker: one jar on the enemy it hits (${A.length ? A[0].on : '-'} = ${x.hits.length ? x.hits[0].split('@')[0] : '-'}), made at the press (${x.press}; made ${A.length ? A[0].made : '-'}), its shatter cell ${d.smash} drawn on the damage tick (shatter ${A.length ? A[0].smash : '-'}, hit ${hit}), no old plate`,
      A.length === 1 && hit != null && A[0].on === x.hits[0].split('@')[0] && Math.abs(A[0].made - x.press - STEP) <= STEP + 1e-6 && Math.abs(A[0].smash - hit) <= STEP + 1e-6 && x.plates.length === 0, JSON.stringify(x));
    ck(`... cells in order to its last (${d.n - 1}), once`, A.length === 1 && A[0].frs[0] === 0 && A[0].frs.every((v, i, a) => i === 0 || v >= a[i - 1]) && A[0].lastFr === d.n - 1, JSON.stringify(A));
    const S = casts['hobb-greenS'], Sa = S.arts.filter(r => r.kind === 'hglaze'), sh = S.hits.length ? +S.hits[0].split('@')[1] : null;
    ck(`... a cast held by a stun (hit ${sh}): the jar hangs before the shatter, never runs backwards, and still shatters on the (later) damage tick (${Sa.length ? Sa[0].smash : '-'})`,
      Sa.length === 1 && sh != null && sh > hit && Math.abs(Sa[0].smash - sh) <= STEP + 1e-6 && Sa[0].frs.every((v, i, a) => i === 0 || v >= a[i - 1]), JSON.stringify(S));
    const C = casts['hobb-greenC'], Ca = C.arts.filter(r => r.kind === 'hglaze');
    ck(`... a cancelled cast (no hit: ${C.hits.length}) fades the jar before it shatters (last cell ${Ca.length ? Ca[0].lastFr : '-'} < ${d.smash})`, Ca.length === 1 && C.hits.length === 0 && Ca[0].cut && Ca[0].lastFr < d.smash && Ca[0].gone != null, JSON.stringify(C));
    const y = casts['hobb-green0'];
    ck('... the old v20 plate is never fetched (sheets used: ' + JSON.stringify(x.texs) + ')', !x.texs.some(u => /hobb_green\.webp/.test(u)) && x.texs.some(u => /hobb_glazebreaker_18oct/.test(u)));
    ck('CONTROL: BASE drew its old plate (sheets used: ' + JSON.stringify(y.texs) + ') and no jar', y.texs.some(u => /hobb_green\.webp\?v=20/.test(u)) && y.arts.length === 0); }
  // 5. the painters (a fake sprite): the burst's origin on his fist, the chain's base on the unit it leaves, stretched to the unit it hits, mirrored to its left
  { const P = JSON.parse(run(`(()=>{ const out={}; const fake=()=>({center:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},scale:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;},copy(p){this.x=p.x;this.y=p.y;this.z=p.z;}},rotation:{},_uv:[0.2,0.1,0.2,0.1],material:{}});
      const V3=(x,y,z)=>({x,y,z,clone(){return V3(this.x,this.y,this.z);},applyMatrix4(){ return V3(this.x,this.y,-10-this.z); }});
      const _on=_fx22On, _hd=_fx22Head, _cam=camera; try{ _fx22On=(u,up)=>V3(u.x/100,up,u.y/100); _fx22Head=()=>4; camera={matrixWorldInverse:{}};
        const g={key:'fritz',x:400,y:0,alive:true}, R={key:'r',x:700,y:0,alive:true}, L={key:'l',x:100,y:0,alive:true};
        for(const [n,T] of [['right',R],['left',L]]){ const o={kind:'fchain',s:fake(),d:FX2_DEF.fritz_blue,u:g,T,t:0}; _fx22FChain(o); out[n]={W:o.s.scale.x,cx:o.s.center.x,uv:Math.sign(o.s._uv[0]),rot:o.s.material.rotation,pos:[o.s.position.x,o.s.position.z]}; }
        const st={kind:'fstorm',s:fake(),d:FX2_DEF.fritz_ult,u:g,t:0,ok:true,P:{x:400,y:700}}; _fx22FStorm(st); out.storm={W:st.s.scale.x,H:st.s.scale.y,cx:st.s.center.x,cy:st.s.center.y};
      } finally{ _fx22On=_on; _fx22Head=_hd; camera=_cam; } return JSON.stringify(out); })()`));
    const d = F.fritz_blue, r = P.right, l = P.left;
    ck('the chain bolt through its painter: base (cell ' + d.base + ') on the unit it leaves, its ' + d.len + '-px reach stretched to the unit it hits (3.0 world: ' + (r.W * d.len / d.fw).toFixed(4) + '), right unmirrored, left mirrored (UV -, anchor 1 - base), both at 0 rad: ' + JSON.stringify(P),
      Math.abs(r.W * d.len / d.fw - 3) < 1e-6 && Math.abs(l.W * d.len / d.fw - 3) < 1e-6 && r.uv > 0 && l.uv < 0 && Math.abs(r.cx - d.base[0]) < 1e-9 && Math.abs(l.cx - (1 - d.base[0])) < 1e-9 && Math.abs(r.rot) < 1e-9 && Math.abs(l.rot) < 1e-9 && Math.abs(r.pos[0] - 4) < 1e-9);
    const U = F.fritz_ult, R8 = 8 * F.METER * F.SC, sp = P.storm.W * U.spread / U.fw / 2;
    ck(`the storm through its painter: its bolts' ground spread (${U.spread} cell px) spans the 8 m channel circle (half-spread ${sp.toFixed(4)} = R ${R8.toFixed(4)} world), standing on its ground anchor (${U.anchor}), as tall as the cell's aspect`,
      Math.abs(sp - R8) < 1e-6 && Math.abs(P.storm.H / P.storm.W - U.fh / U.fw) < 1e-9 && P.storm.cx === U.anchor[0] && P.storm.cy === U.anchor[1], JSON.stringify(P.storm));
    const A = JSON.parse(run('JSON.stringify(BATTLE_ANIM.grosk.blue)')), gb = F.grosk_blue;
    ck(`the burst's origin = his fist on the punch cells (hand ${gb.hand} in his blue sheet: ${((gb.hand[0] - A.cx) / A.figH).toFixed(3)} of his height ahead, ${((A.feet - gb.hand[1]) / A.figH).toFixed(3)} up), the cell ${(gb.heroPx / A.figH).toFixed(2)} of his height wide`,
      gb.hand[0] > A.cx && gb.hand[1] < A.feet && gb.heroPx > 0); }
  // 6. previews
  { const P = JSON.parse(run(`JSON.stringify(['grosk','fritz','hobb'].map(h=>[2,1,0].map(sl=>{ const p=skillPreviewPlan(h,sl); return p?{rel:+p.rel.toFixed(4),fx:p.fx.map(e=>({k:e.k,kind:e.kind,at:e.at||null,t0:+e.t0.toFixed(4)}))}:null; })))`));
    const gb = P[0][0], fg = P[1][1], fb = P[1][0], fu = P[1][2], hg = P[2][1];
    ck('Skills tab previews: Grosk three bursts on his fist at the punch times (fx16hand), Fritz\'s strike on the target (fx16puff), the storm over him from the press (fx16puff), no chain in a one-enemy preview: ' + JSON.stringify(P),
      gb && gb.fx.filter(e => e.k === 'grosk_blue' && e.kind === 'fx16hand').length === 3 && fg && fg.fx.length === 1 && fg.fx[0].k === 'fritz_green' && fg.fx[0].at === 'target' &&
      fu && fu.fx.length === 1 && fu.fx[0].k === 'fritz_ult' && fu.fx[0].at === 'self' && fb && fb.fx.every(e => e.k !== 'fritz_blue') && hg && hg.fx.length === 1 && hg.fx[0].k === 'hobb_green' && hg.fx[0].kind === 'fx16over' && hg.fx[0].at === 'target', JSON.stringify(P)); }
  { const s = src.slice(src.indexOf('function _fx22Rt(o)'), src.indexOf('function _fx22Kill(o){'));
    ck('the painters only read the fight: no RNG, no damage, no unit state written', s.length > 1000 && !/brnd\(|rng\(|Math\.random|dealDamage|healFrom|ccApply|\.hp\s*=|\b(u|T|e|a|b)\.(x|y|target|forcedTarget)\s*=[^=]/.test(s));
    ck('no emoji added', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)); }
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
