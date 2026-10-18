'use strict';
// v1197 - Tolley's three spell FX (Grok renders, Phil approved 17 Oct 2026), DISPLAY ONLY:
//   FORGE STRIKE   tolley_green_forge_strike_17oct.mp4 (the NEW 15:45 cut, 4.2 s; green key): the hammer on the target from the press, its forming spread over
//                  press -> landing (the engine's cast 0.5 + fall 0.55 fight s) so its IMPACT cell (source f61, the head meets the ground) is drawn on the
//                  damage tick; then 12 fps real time, once; upright on the land point, the splash as wide as the kit's 3 m radius circle
//   CHAIN QUENCH   tolley_blue_chain_quench_chain_17oct.mp4: ONE chain per enemy the case hits (the engine: every enemy within 4.5 m of TOLLEY), all from the
//                  form launch, the BASE (left end, where it coils) on Tolley, aimed at each enemy and stretched to its distance;
//                  tolley_blue_chain_quench_explosion_17oct.mp4 ONCE flat under Tolley 1.8 s into the chain clip, at the 4.5 m radius
//   LIVING FORGE   tolley_ult_living_forge_17oct.mp4 (8.8 s): flat under his feet from the release, following him, the whole clip once, at the ult's 6 m radius
// CONTROL against the live build (git show BASE): casts and whole fights with Tolley are tick-identical (FX never move game logic).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const VER = process.env.EW_VER || '1197';
const BASE_SHA = process.env.EW_BASE || '0219c16c';   // live v1198 (on v1192, v1196 all 60 deaths), before this change
const SRC = 'C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/_fx2_accepted/';
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-tfx1197-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = OLD ? load(OLD) : null;
require('./helpers/art-18oct-undo.js').undoArt18Oct(run);   // the 18 Oct art (Iver, Joss, Ambrel, seven Grok FX: a later release) goes back to v1199's - its own tests check it
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) { const b = fs.readFileSync(file), tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; }
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const KEYS = ['tolley_green', 'tolley_blue', 'tolley_blue_boom', 'tolley_ult'];
const FILES = { tolley_green: 'tolley_forge_strike_17oct', tolley_blue: 'tolley_chain_quench_chain_17oct', tolley_blue_boom: 'tolley_chain_quench_explosion_17oct', tolley_ult: 'tolley_living_forge_17oct' };
const MP4 = { tolley_green: ['tolley_green_forge_strike_17oct.mp4', '40ec278141cdd42ba58c753c2516a00f'], tolley_blue: ['tolley_blue_chain_quench_chain_17oct.mp4', '1e5c8347a5f1c18c16535a7927a9c888'],
  tolley_blue_boom: ['tolley_blue_chain_quench_explosion_17oct.mp4', 'b378f0d530142a53d7a4b56fb9cd7726'], tolley_ult: ['tolley_ult_living_forge_17oct.mp4', '9c0d24c61b8c81e41ecf57f8b24d47c8'] };
function sheetProblems(F) { const bad = [];
  for (const k of KEYS) { const d = F[k]; if (!d) { bad.push(k + ' missing'); continue; } const f = fileOf(d.u);
    if (!fs.existsSync(f)) { bad.push(k + ' missing file'); continue; }
    const sz = webpSize(f), ch = chunks(fs.readFileSync(f));
    if (d.n > d.cols * d.rows || d.n <= (d.cols - 1) * d.rows) bad.push(k + ' n does not fill its grid');
    if (d.fw * d.cols > 2048 || d.fh * d.rows > 2048) bad.push(k + ' > 2048 px');
    if (fs.statSync(f).size > 4e6) bad.push(k + ' > 4 MB');
    if (!sz || sz[0] !== d.fw * d.cols || sz[1] !== d.fh * d.rows) bad.push(k + ' file ' + sz + ' != grid');
    if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) bad.push(k + ' not a q95 lossy WebP with alpha');
    if (Math.abs(d.dur - d.n / d.fps2) > 1e-3) bad.push(k + ' dur != n / fps2'); }
  return bad; }
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));
/* one cast: Tolley + an ally + four enemies (three in his 4.5 m Chain Quench reach - one on his LEFT - and one far, untargetable, to keep the fight going);
   every effect / hit and every unit for 10 s; the art (new page) */
const CAST = (kind, opt) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123();
  const g=makeUnit('tolley','ally',420,700,30,{owned:false,rank:3}); const a=makeUnit('vael','ally',360,560,30,{owned:false});
  const e=makeUnit('tick','enemy',450,700,30,{owned:false}); const e2=makeUnit('sylthaine','enemy',480,770,30,{owned:false}); const e3=makeUnit('grosk','enemy',330,720,30,{owned:false});
  const e4=makeUnit('umbris','enemy',1100,300,30,{owned:false});
  units=[g,a,e,e2,e3,e4]; units.forEach(u=>{ try{ buildFigure(u); }catch(_e){} }); g.anim=BATTLE_ANIM.tolley; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;});
  [a,e,e2,e3,e4].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.greenCd=x.blueCd=99; x.speed=0;}); g.greenCd=g.blueCd=99; g.atkCd=99;
  for(let i=0;i<Math.round(20/SIM_STEP)&&(g._dropHidden||g.x<0||g._noTarget);i++){ updateBattle(SIM_STEP); units.forEach(x=>{ x.hp=x.maxHp; x.energy=0; x.greenCd=x.blueCd=99; x.atkCd=99; }); }
  e4._noTarget=true; g.x=420; g.y=700; g._ax=g.x; g._ay=g.y; e.x=450; e.y=700; e2.x=480; e2.y=770; e3.x=330; e3.y=720; [e,e2,e3].forEach(x=>{x._ax=x.x; x._ay=x.y;});
  const OPT=${JSON.stringify(opt || {})};
  [a,e,e2,e3].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.greenCd=x.blueCd=99; x.speed=0;}); g.atkCd=99; g.speed=OPT.walk?g.speed:0; if(!OPT.walk) g.speed=0; g.glyphCrit=0;
  g.target=e; g.greenCd=g.blueCd=99;
  const fx=[], hits=[], tpos=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g){ fx.push(ty+'@'+battleTime.toFixed(4)); tpos.push([+e.x.toFixed(2),+e.y.toFixed(2)]); } return _de.apply(this,arguments); };
  const _dd=dealDamage; dealDamage=function(s,t){ if(s===g) hits.push(t.key+'@'+battleTime.toFixed(4)); return _dd.apply(this,arguments); };
  let plates=[], projs=[]; const _sg=spawnGroundFx; spawnGroundFx=function(k){ if(/^tolley_/.test(k)) plates.push(k); return _sg.apply(this,arguments); };
  const _sp=spawnProjFx; spawnProjFx=function(k){ if(/^tolley_/.test(k)) projs.push(k); return _sp.apply(this,arguments); };
  g._castSM=1; g._castLv=1; const press=battleTime;
  try{
    if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,'${kind}'==='blue'?(g.blueAb||KITS.tolley.blue):(g.greenAb||KITS.tolley.green));
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; const seen=new Map(), arts=[];
    const tr=[]; for(let i=0;i<Math.round(10/SIM_STEP);i++){ if(OPT.stun&&i===3){ g.stunned=1.0; } if(OPT.cancel&&i===3){ castCancel(g); }
      if(OPT.walk&&battleTime-press>2.5){ g.x+=2; g._ax=g.x; }
      updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e4._noTarget=true; e4.hp=e4.maxHp; units.forEach(x=>{ x.energy=(x===g&&'${kind}'!=='ult')?0:x.energy; });
      const live=(typeof _fx1123!=='undefined')?_fx1123.filter(o=>o.u===g&&/^t(forge|chain|boom|ult)$/.test(o.kind)):[];
      for(const o of live){ if(!seen.has(o)){ const r={kind:o.kind,made:+battleTime.toFixed(4),shown:null,on:o.T?o.T.key:null,frs:[],P:null,fr19:null,gone:null,lastFr:-1,mir:null,trackX:[]}; seen.set(o,r); arts.push(r); } const r=seen.get(o);
        if(o.s&&o.s.visible&&r.shown==null&&o.fr!=null){ r.shown=+battleTime.toFixed(4); r.gxShow=[+g.x.toFixed(2),+g.y.toFixed(2)]; }
        if(o.fr!=null){ if(o.fr!==r.lastFr) r.frs.push(o.fr+'@'+battleTime.toFixed(4)); r.lastFr=o.fr; if(o.fr===(o.d.impact||-1)&&r.fr19==null) r.fr19=+battleTime.toFixed(4); }
        if(o.P) r.P=[+o.P.x.toFixed(2),+o.P.y.toFixed(2)]; if(o.kind==='tchain'){ r.mir=o.mir; r.cut=o.cut!=null; } if(o.kind==='tult'){ r.trackX.push(+(o.P.x-g.x).toFixed(3)); if(!r.P0) r.P0=r.P.slice(); } }
      for(const [o,r] of seen) if(r.gone==null&&!live.includes(o)) r.gone=+battleTime.toFixed(4);
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),(u.dots||[]).length].join(':')).join('|')); }
    return JSON.stringify({press,hold,anim,fx,hits,tpos,trace:crypto_like(tr.join('#')),plates,projs,arts,gx:g.x,dist:[e,e2,e3,e4].map(x=>x.key+':'+(Math.hypot(x.x-420,x.y-700)/METER).toFixed(2))});
  } finally { doEffect=_de; dealDamage=_dd; spawnGroundFx=_sg; spawnProjFx=_sp; } })()`;
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
    let cb = 0; try { new vm.Script(html.replace('function _fx22TolChain(o){', 'function _fx22TolChain(o){ if( ').match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken painter', cb === 1); }
  const src = fs.readFileSync(HTML, 'utf8'), baseSrc = fs.readFileSync(OLD, 'utf8');
  // 1. sources + sheets
  { const got = KEYS.map(k => { const f = SRC + MP4[k][0]; return fs.existsSync(f) ? crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex') : null; });
    ck('the four sources are Grok\'s Phil-approved clips (md5 ' + got.map(x => x && x.slice(0, 8)).join(' ') + '; Forge Strike = the new 15:45 cut)', KEYS.every((k, i) => got[i] === MP4[k][1])); }
  const FXQ = 'JSON.stringify(Object.assign({FX_RT,METER,SC},Object.fromEntries(' + JSON.stringify(KEYS) + '.map(k=>[k,FX2_DEF[k]]))))', F = JSON.parse(run(FXQ)), F0 = JSON.parse(R0(FXQ));
  const bad = sheetProblems(F);
  ck('the four sheets exist, file = declared grid, within 2048 px per side and 4 MB, q95 lossy + alpha, dur = n / fps2', bad.length === 0, bad.join('; '));
  { const sz = KEYS.map(k => { const d = F[k]; return k + ' ' + d.fw * d.cols + 'x' + d.fh * d.rows + ' ' + (fs.statSync(fileOf(d.u)).size / 1e6).toFixed(2) + ' MB file, ' + (d.fw * d.cols * d.fh * d.rows * 4 * 4 / 3 / 1048576).toFixed(1) + ' MB GPU'; });
    console.log('  info sheets: ' + sz.join('; ')); }
  ck('new files at ?v=' + VER + ' that BASE never referenced; the old plates stay on disk (rollback needs nothing)',
    KEYS.every(k => F[k].u === '/assets/anim/fx/' + FILES[k] + '.webp?v=' + VER && !baseSrc.includes(FILES[k])) && ['tolley_green', 'tolley_blue', 'tolley_ult'].every(k => fs.existsSync(fileOf(F0[k].u))) && F0.tolley_blue_boom == null);
  { const ctl = JSON.parse(JSON.stringify(F)); ctl.tolley_blue.fw = 900; ctl.tolley_ult.u = '/assets/anim/fx/tolley_missing.webp?v=1';
    ck('CONTROL: the sheet check catches an oversized grid and a missing file', sheetProblems(ctl).length >= 2); }
  { const PY = cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'hollow_fx_1191_check.py')].concat(KEYS.map(k => fileOf(F[k].u))), { maxBuffer: 1 << 24 }).toString();
    const Q = JSON.parse(PY), M = KEYS.map(k => Q[FILES[k] + '.webp']);
    /* the art is molten metal and fire: yellow-orange flames sit in the 'olive' hue band, so the edge is held to the art's own body share (+0.6 pt), not to 0 */
    ck('no fringe: visible green 0 on every sheet (edge and body), the soft edge no more yellow-olive than the art\'s own body (+0.6 pt), no magenta haze (<= 1%): ' + PY,
      M.every(m => m && m.green_edge <= 0.01 && m.green_body === 0 && m.olive_edge <= m.olive_body + 0.6 && m.magenta_edge <= 1 && m.magenta_body <= 0.05));
    ck('CONTROL: the plate mixed back into the edges reads as visible green (' + M.map(m => m.control_green_edge).join(', ') + '%)', M.every(m => m.control_green_edge > 20)); }
  // 2. data = BASE
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'ownFx' ? undefined : v));
  // v1203: his death states were re-keyed (the plate key, tests/test_death_state.js) - they leave the comparison (nodeath), as in the other per-hero tables
  const nodeath = a => { a[4] = Object.fromEntries(Object.entries(a[4]).filter(([k]) => !/^death\d*$/.test(k))); return a; };
  const kit = r => JSON.stringify(strip(nodeath(JSON.parse(r('JSON.stringify([KITS.tolley,HERO_TYPES.tolley,ABILITY_CAST.tolley||null,ULT_DEF.ashfall,BATTLE_ANIM.tolley])')))));
  const kitD = r => JSON.stringify(strip(JSON.parse(r('JSON.stringify([KITS.tolley,HERO_TYPES.tolley,ABILITY_CAST.tolley||null,ULT_DEF.ashfall,BATTLE_ANIM.tolley])'))));
  ck('CONTROL: with his death states in, the data differs from BASE (they are the v1203 re-key) - 12 death states', kitD(run) !== kitD(R0) && run("Object.keys(BATTLE_ANIM.tolley).filter(k=>/^death\\d*$/.test(k)).length") === 12);
  ck('kit, hero stats, cast times, ult numbers and battle clips identical to BASE apart from the ownFx display tags (Forge Strike: tforge, Chain Quench: tquench)',
    kit(run) === kit(R0) && run("KITS.tolley.green.ownFx+'/'+KITS.tolley.blue.ownFx") === 'tforge/tquench' && R0('KITS.tolley.green.ownFx||KITS.tolley.blue.ownFx||null') === null);
  ck('the ult art: BASE\'s plate (gfx tolley_ult) becomes the ring under his feet (ownFx tlforge)', run('JSON.stringify(HERO_ULT_ART.tolley)') === '{"ownFx":"tlforge"}' && R0('JSON.stringify(HERO_ULT_ART.tolley)') === '{"gfx":"tolley_ult","gdur":2.4}');
  const others = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>!/^tolley_(green|blue|blue_boom|ult)$/.test(k)&&k!=='nerisse_blue').map(k=>[k,FX2_DEF[k]]))");
  ck('every other FX2_DEF entry is byte-for-byte BASE (nerisse_blue: its v1197 fxMul, tests/test_nerisse_half_1197.js)', H(others(run)) === H(others(R0)));
  ck('his four sheets load with his figure (FX1123_WARM.tolley)', run('JSON.stringify(FX1123_WARM.tolley)') === '["tolley_green","tolley_blue","tolley_blue_boom","tolley_ult"]' && R0('typeof FX1123_WARM.tolley') === 'undefined');
  // 3. tick-identical
  const C = { FX_RT: F.FX_RT, step: +run('SIM_STEP') }, casts = {};
  for (const [kind, opt] of [['green', {}], ['blue', {}], ['ult', {}], ['ult', { walk: true }], ['green', { stun: true }], ['green', { cancel: true }]]) {
    const x = JSON.parse(run(CAST(kind, opt))), y = JSON.parse(R0(CAST(kind, opt))); casts[kind + (opt.walk ? 'W' : opt.stun ? 'S' : opt.cancel ? 'C' : '')] = x;
    const pick = o => JSON.stringify([o.hold, o.anim, o.fx, o.hits, o.trace]);
    ck(`${kind}${opt.walk ? ' (he walks during the ult)' : opt.stun ? ' (stunned during the cast: the engine holds it)' : opt.cancel ? ' (the cast cancelled before the release)' : ''}: the effects and every hit land on the same ticks (${x.fx.join(' ')}; ${x.hits.slice(0, 5).join(' ')}) and every unit = BASE for 10 s`, pick(x) === pick(y), JSON.stringify({ now: pick(x), base: pick(y) }));
  }
  { const T = [[11, ['tolley', 'vael', 'tick'], ['grosk', 'vireo', 'sylthaine']], [23, ['tolley', 'veyr', 'korvux', 'lumi', 'vex'], ['mirelle', 'aureth', 'carn', 'oakmir', 'tolley']], [5, ['tolley', 'deepcleft'], ['umbris', 'nox', 'tick']]];
    const a = T.map(([s, x, y]) => fight(run, s, x, y)), b = T.map(([s, x, y]) => fight(R0, s, x, y));
    ck('whole fights (3 seeds, Tolley on both sides, his auto-cast Forge Strike / Chain Quench / Living Forge) are tick-identical to BASE', JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
    run("globalThis.__s=KITS.tolley.blue.mul; KITS.tolley.blue.mul*=0.5; 1"); const c = fight(run, T[1][0], T[1][1], T[1][2]); run('KITS.tolley.blue.mul=globalThis.__s; 1');
    ck('CONTROL: the seed-23 fight with Chain Quench\'s damage halved is NOT identical (the instrument sees game logic)', c !== b[1]); }
  // 4. the moments and the units
  { const x = casts.green, d = F.tolley_green, A = x.arts.filter(r => r.kind === 'tforge'), hit = x.fx.length > 1 ? +x.fx[1].split('@')[1] : null;   /* the delivery's arrival: the cleave case (its damage) runs on this tick */
    const land = x.press + 0.5 + 0.55;
    ck(`Forge Strike: one hammer, made at the press (${x.press}; made ${A.length ? A[0].made : '-'}), its impact cell ${d.impact} (source f61) first drawn on the damage tick (impact ${A.length ? A[0].fr19 : '-'}, the cleave case ${hit}; cast 0.5 + fall 0.55 = ${land.toFixed(4)})`,
      A.length === 1 && hit != null && Math.abs(A[0].made - x.press - C.step) <= C.step + 1e-6 && Math.abs(A[0].fr19 - hit) <= C.step + 1e-6 && Math.abs(hit - land) <= 2 * C.step && x.plates.length === 0 && x.projs.length === 0, JSON.stringify(x));
    const fr = A[0].frs.map(s => +s.split('@')[0]);
    ck(`... cells 0-${d.impact - 1} before it in order, then real time to its last cell (${d.n - 1}) and gone after ${(d.n - d.impact) / d.fps2} real s (${A[0].gone != null ? ((A[0].gone - A[0].fr19) / C.FX_RT).toFixed(2) : '-'})`,
      fr[0] === 0 && fr.every((v, i) => i === 0 || v >= fr[i - 1]) && fr.filter(v => v < d.impact).length >= d.impact - 2 && A[0].lastFr === d.n - 1 && Math.abs((A[0].gone - A[0].fr19) - (d.n - d.impact) / d.fps2 * C.FX_RT) <= 2 * C.step, JSON.stringify(A[0]));
    ck(`... on the land point: where the target stood when the delivery fired (${JSON.stringify(A[0].P)} = ${JSON.stringify(x.tpos[0])})`, A[0].P && JSON.stringify(A[0].P) === JSON.stringify(x.tpos[0]));
    { const S = casts.greenS, Sa = S.arts.filter(r => r.kind === 'tforge'), sh = S.fx.length > 1 ? +S.fx[1].split('@')[1] : null;
      ck(`... a cast the engine holds through a stun (release ${S.fx[0]}): the hammer hangs, never runs backwards, and its impact cell still lands on the (later) cleave case tick (impact ${Sa.length ? Sa[0].fr19 : '-'}, case ${sh})`,
        Sa.length === 1 && sh != null && Math.abs(Sa[0].fr19 - sh) <= C.step + 1e-6 && Sa[0].frs.map(v => +v.split('@')[0]).every((v, i, a) => i === 0 || v >= a[i - 1]), JSON.stringify(S)); }
    { const S = casts.greenC, Sa = S.arts.filter(r => r.kind === 'tforge');
      ck(`... a cancelled cast (castCancel before the release: no cleave case ${S.fx.length}) fades its hammer before the impact (last cell ${Sa.length ? Sa[0].lastFr : '-'} < ${d.impact}, gone ${Sa.length ? Sa[0].gone : '-'})`, Sa.length === 1 && S.fx.length === 0 && Sa[0].lastFr < d.impact && Sa[0].gone != null && Sa[0].gone < 0.5, JSON.stringify(S)); }
    const y = JSON.parse(R0(CAST('green')));
    ck('CONTROL: BASE dropped the old plate (' + JSON.stringify(y.projs) + ') and drew no hammer', y.projs.includes('tolley_green') && y.arts.length === 0); }
  { const x = casts.blue, d = F.tolley_blue, Ch = x.arts.filter(r => r.kind === 'tchain'), Bm = x.arts.filter(r => r.kind === 'tboom');
    const first = x.hits.length ? x.hits[0].split('@')[1] : null, struck = x.hits.filter(h => h.split('@')[1] === first).map(h => h.split('@')[0]).sort();
    ck(`Chain Quench: ONE chain per enemy the case hits (the engine: within 4.5 m of Tolley - ${x.dist.join(' ')} m): struck ${struck.join(',')}, chains ${Ch.map(r => r.on).sort().join(',')}, all made on one tick (${[...new Set(Ch.map(r => r.made))].join(',')}) before the case (${first})`,
      struck.length === 3 && JSON.stringify(Ch.map(r => r.on).sort()) === JSON.stringify(struck) && new Set(Ch.map(r => r.made)).size === 1 && Ch[0].made < +first && Ch.every(r => !r.cut), JSON.stringify(x));
    ck(`... each plays once in real time to its last cell (${d.n} cells at 12 fps = ${(d.n / 12).toFixed(2)} s)`, Ch.every(r => r.lastFr === d.n - 1 && Math.abs((r.gone - r.made) - d.n / 12 * C.FX_RT) <= 2 * C.step));
    ck(`... the explosion once, ${d.boomAt} real s into the chain clip (made ${Bm.length ? Bm[0].made : '-'}, shown ${Bm.length ? Bm[0].shown : '-'}; chains ${Ch.length ? Ch[0].made : '-'}), under Tolley, to its last cell`,
      Bm.length === 1 && Math.abs((Bm[0].shown - Ch[0].made) - d.boomAt * C.FX_RT) <= 2 * C.step && Bm[0].P && JSON.stringify(Bm[0].P) === JSON.stringify(Bm[0].gxShow) && Bm[0].lastFr === F.tolley_blue_boom.n - 1, JSON.stringify(Bm));
    const y = JSON.parse(R0(CAST('blue')));
    ck('CONTROL: BASE drew the old plate on him and no chains (' + JSON.stringify(y.plates) + ', ' + y.arts.length + ' arts)', y.plates.includes('tolley_blue') && y.arts.length === 0); }
  { const x = casts.ult, d = F.tolley_ult, U = x.arts.filter(r => r.kind === 'tult'), rel = x.fx.find(s => /^ashfall@/.test(s)), relT = rel ? +rel.split('@')[1] : null;
    ck(`Living Forge: one ring, from the release (${relT}; made ${U.length ? U[0].made : '-'}), the whole clip once (${d.n} cells, ${(d.n / 12).toFixed(2)} real s; drawn to cell ${U.length ? U[0].lastFr : '-'}, for ${U.length && U[0].gone ? ((U[0].gone - U[0].made) / C.FX_RT).toFixed(2) : '-'} s)`,
      U.length === 1 && relT != null && Math.abs(U[0].made - relT) <= C.step + 1e-6 && U[0].lastFr === d.n - 1 && Math.abs((U[0].gone - U[0].made) - d.n / 12 * C.FX_RT) <= 2 * C.step && x.plates.length === 0, JSON.stringify(x));
    const W = casts.ultW.arts.filter(r => r.kind === 'tult');
    ck(`... it follows him as he walks (the ring moved from x ${W.length ? W[0].P0[0] : '-'} to ${W.length ? W[0].P[0] : '-'} with him; its offset from him every tick: ${W.length ? [...new Set(W[0].trackX)].join(',') : '-'})`, W.length === 1 && W[0].trackX.length > 100 && W[0].trackX.every(v => Math.abs(v) < 1e-6) && W[0].P[0] - W[0].P0[0] > 100);
    const y = JSON.parse(R0(CAST('ult')));
    ck('CONTROL: BASE drew the old plate and no ring (' + JSON.stringify(y.plates) + ')', y.plates.includes('tolley_ult') && y.arts.length === 0); }
  // 5. the painters (a fake sprite): the chain's base on him, aimed and stretched to the enemy, mirrored on his left; the ring and the burst at the radius
  { const P = JSON.parse(run(`(()=>{ const out={}; const fake=()=>({center:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},scale:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;},copy(p){this.x=p.x;this.y=p.y;this.z=p.z;}},rotation:{},_uv:[0.2,0.1,0.2,0.1],material:{}});
      const V3=(x,y,z)=>({x,y,z,clone(){return V3(this.x,this.y,this.z);},applyMatrix4(){ return V3(this.x,this.y,-10-this.z); }});
      const _on=_fx22On, _hd=_fx22Head, _cam=camera; try{ _fx22On=(u,up)=>V3(u.x/100,up,u.y/100); _fx22Head=()=>4; camera={matrixWorldInverse:{}};
        const g={key:'tolley',x:400,y:0,alive:true}, R={key:'r',x:700,y:0,alive:true}, L={key:'l',x:100,y:0,alive:true};
        for(const [n,T] of [['right',R],['left',L]]){ const o={kind:'tchain',s:fake(),d:FX2_DEF.tolley_blue,u:g,T,t:0}; _fx22TolChain(o); out[n]={W:o.s.scale.x,L:o.L,mir:o.mir,cx:o.s.center.x,uv:Math.sign(o.s._uv[0]),rot:o.s.material.rotation,pos:[o.s.position.x,o.s.position.z]}; }
        const r={kind:'tult',s:fake(),d:FX2_DEF.tolley_ult,u:g,t:0,R:6*METER}; _fx22TolUlt(r); out.ult={W:r.s.scale.x,H:r.s.scale.y};
        const b={kind:'tboom',s:fake(),d:FX2_DEF.tolley_blue_boom,u:g,t:0,R:4.5*METER}; _fx22TolBoom(b); out.boom={W:b.s.scale.x};
        const f={kind:'tforge',s:fake(),d:FX2_DEF.tolley_green,u:g,t:0,ok:true,land:1,R:3*METER,P:{x:470,y:700}}; _fx22TolForge(f); out.forge={W:f.s.scale.x,cx:f.s.center.x,cy:f.s.center.y};
      } finally{ _fx22On=_on; _fx22Head=_hd; camera=_cam; } return JSON.stringify(out); })()`));
    const d = F.tolley_blue, r = P.right, l = P.left;
    ck('the chain through its painter: its base (cell ' + d.base + ') on Tolley, its 637-px reach stretched to the enemy (3.0 world: ' + (r.W * d.len / d.fw).toFixed(4) + '), toward it: right unmirrored at 0 rad, left mirrored (UV -, anchor 1 - base) at 0 rad: ' + JSON.stringify(P),
      Math.abs(r.W * d.len / d.fw - 3) < 1e-6 && Math.abs(l.W * d.len / d.fw - 3) < 1e-6 && !r.mir && l.mir && r.uv > 0 && l.uv < 0 && Math.abs(r.cx - d.base[0]) < 1e-9 && Math.abs(l.cx - (1 - d.base[0])) < 1e-9 && Math.abs(r.rot) < 1e-9 && Math.abs(l.rot) < 1e-9 && Math.abs(r.pos[0] - 4) < 1e-9);
    const R6 = 6 * F.METER * F.SC, R45 = 4.5 * F.METER * F.SC, R3 = 3 * F.METER * F.SC;
    ck(`sizes: the ring's rim spans the ult's 6 m radius (${(P.ult.W * F.tolley_ult.disc.dw / 2).toFixed(4)} = ${R6.toFixed(4)}), the burst the 4.5 m Chain Quench radius (${(P.boom.W * F.tolley_blue_boom.disc.dw / 2).toFixed(4)} = ${R45.toFixed(4)}), the forge splash the 3 m circle (${(P.forge.W * F.tolley_green.splash / F.tolley_green.fw / 2).toFixed(4)} = ${R3.toFixed(4)}), the hammer standing on its ground line`,
      Math.abs(P.ult.W * F.tolley_ult.disc.dw / 2 - R6) < 1e-6 && Math.abs(P.boom.W * F.tolley_blue_boom.disc.dw / 2 - R45) < 1e-6 && Math.abs(P.forge.W * F.tolley_green.splash / F.tolley_green.fw / 2 - R3) < 1e-6 && P.forge.cx === 0.5 && Math.abs(P.forge.cy - 0.043) < 1e-9); }
  // 6. previews
  { const P = JSON.parse(run(`JSON.stringify([1,2,0].map(sl=>{ const p=skillPreviewPlan('tolley',sl); return p?{rel:p.rel,fx:p.fx.map(e=>({k:e.k,kind:e.kind,at:e.at||null,t0:+e.t0.toFixed(4),R:e.R||null}))}:null; }))`));
    const [g, b, u] = P;
    ck('Skills tab previews: the hammer on the target from the press (fx16puff), the explosion flat under him after the release (disc22, 4.5 m), the ring flat under him from the release (disc22, 6 m): ' + JSON.stringify(P),
      g && g.fx.length === 1 && g.fx[0].k === 'tolley_green' && g.fx[0].kind === 'fx16puff' && g.fx[0].at === 'target' && b && b.fx.length === 1 && b.fx[0].k === 'tolley_blue_boom' && b.fx[0].kind === 'disc22' && b.fx[0].t0 > b.rel &&
      u && u.fx.length === 1 && u.fx[0].k === 'tolley_ult' && u.fx[0].kind === 'disc22' && Math.abs(u.fx[0].t0 - u.rel) < 1e-3, JSON.stringify(P)); }
  { const s = src.slice(src.indexOf('function tolleyForgeCastFx'), src.indexOf('function _fx22Kill(o){'));
    ck('the painters only read the fight: no RNG, no damage, no unit position written', s.length > 1000 && !/rng\(|Math\.random|dealDamage|healUnit|\.hp\s*=|\b(u|T|e)\.(x|y)\s*=[^=]/.test(s));
    ck('no emoji added', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)); }
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
