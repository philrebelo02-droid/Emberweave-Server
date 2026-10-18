'use strict';
// v1191 - Hollow's two spell FX (Grok renders, Phil approved 16 Oct 2026; Grok's handoff 16:47), DISPLAY ONLY:
//   LACERATE         hollow_blue_lacerate_16oct.mp4 (green key): on the target from his FIRST SLASH - blue2 cell 16 (the white smear, source f22 = 0.92 s),
//                    measured on the clip; it rides the target; painted travelling left to right - as painted facing right, mirrored facing left;
//                    real time, once (faded by ~2 s)
//   VANISHING POINT  hollow_ult_vanishing_point_16oct.mp4 (green key): on EACH enemy he strikes (hollowStrike, up to 3 hops), from that strike; 0.9 x the
//                    unit's height across; stays where the enemy fell if the strike kills; mirrored with his facing; real time, once (shut by ~5.5 s)
//   FAN OF KNIVES    his green clip replaced by the Phil-approved natural draw (ChatGPT 17:16; sha256 61d90da2, release = source f88): the draw retimed into the
//                    0.5 fight-s cast (cells 0-17), the throw at natural speed from cell 18 = f88 = the release; Grok's hollow_green_fan_of_knives_16oct.mp4
//                    from that cell, its fan's root on his empty throwing hand, the fan the size of the one he held, mirrored with his facing.
// CONTROL against the live build (git show BASE): casts and whole fights with Hollow are tick-identical (FX never move game logic).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const VER = process.env.EW_VER || '1191';
const BASE_SHA = process.env.EW_BASE || '659d7d2f';   // live v1190 (deaths stream, on v1189 Tessit, v1186 Kharos FX, v1181 facing), before this change
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-hfx1191-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = OLD ? load(OLD) : null;
require('./helpers/tolley-fx-1197.js').undoTolleyFx1197(run);   // v1197: Tolley's FX entries, ownFx tags and his FX1123_WARM / SKP_OWNFX rows (a later release) go back to v1195's - tests/test_tolley_fx_1197.js checks them
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) { const b = fs.readFileSync(file), tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; }
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const KEYS = ['hollow_blue', 'hollow_ult', 'hollow_green'], FILES = { hollow_blue: 'hollow_lacerate_16oct', hollow_ult: 'hollow_vanishing_point_16oct', hollow_green: 'hollow_fan_of_knives_16oct' };
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
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));
// one cast: Hollow + an ally + three enemies (weak for the ult, so it chains); every effect / hit and every unit for 8 s; the art (new page)
const CAST = (kind, opt) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123();
  const g=makeUnit('hollow','ally',420,700,30,{owned:false,rank:3}); const a=makeUnit('vael','ally',360,660,30,{owned:false});
  const e=makeUnit('tick','enemy',470,700,30,{owned:false}); const e2=makeUnit('sylthaine','enemy',760,560,30,{owned:false}); const e3=makeUnit('grosk','enemy',820,840,30,{owned:false});
  const e4=makeUnit('umbris','enemy',1100,300,30,{owned:false});   /* untargetable and unkillable: keeps the fight running after the chain */
  units=[g,a,e,e2,e3,e4]; units.forEach(u=>{ try{ buildFigure(u); }catch(_e){} }); g.anim=BATTLE_ANIM.hollow; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;});
  [a,e,e2,e3,e4].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.greenCd=x.blueCd=99; x.speed=0;}); g.greenCd=g.blueCd=99; g.atkCd=99;
  /* his passive drops him in late (off the field at the start): wait until he is on it */
  for(let i=0;i<Math.round(20/SIM_STEP)&&(g._dropHidden||g.x<0||g._noTarget);i++){ updateBattle(SIM_STEP); units.forEach(x=>{ x.hp=x.maxHp; x.energy=0; x.greenCd=x.blueCd=99; x.atkCd=99; }); }
  e4._noTarget=true; g.x=420; g.y=700; g._ax=g.x; g._ay=g.y; g.speed=0; e.x=470; e.y=700;
  const OPT=${JSON.stringify(opt || {})}; if('${kind}'==='ult') [e,e2,e3].forEach(x=>{ x.maxHp=4000; x.hp=OPT.full?4000:300; });
  [a,e,e2,e3].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.greenCd=x.blueCd=99; x.speed=0;}); g.atkCd=99; g.speed=0; g.glyphCrit=0;
  g.target=e; g.greenCd=g.blueCd=99; if(OPT.left) g._fxMirror=true;
  const fx=[], hits=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const _dd=dealDamage; dealDamage=function(s,t){ if(s===g) hits.push(t.key+'@'+battleTime.toFixed(4)); return _dd.apply(this,arguments); };
  let plates=[]; const _sg=spawnGroundFx; spawnGroundFx=function(k){ if(/^hollow_/.test(k)) plates.push(k); return _sg.apply(this,arguments); };
  g._castSM=1; g._castLv=1; const press=battleTime;
  try{
    if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,'${kind}'==='blue'?(g.blueAb||KITS.hollow.blue):(g.greenAb||KITS.hollow.green));
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; const seen=new Map(), arts=[];
    const tr=[]; for(let i=0;i<Math.round(8/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e4._noTarget=true; e4.hp=e4.maxHp; units.forEach(x=>{ x.energy=(x===g&&'${kind}'!=='ult')?0:x.energy; }); if(OPT.left) g._fxMirror=true;
      const live=(typeof _fx1123!=='undefined')?_fx1123.filter(o=>o.kind==='fx16'&&o.u===g):[];
      for(const o of live){ if(!seen.has(o)){ const r={vk:o.vk,made:+battleTime.toFixed(4),shown:null,on:null,mir:null,gone:null,lastFr:-1,pos:null}; seen.set(o,r); arts.push(r); } const r=seen.get(o);
        if(o.s&&r.shown==null){ r.shown=+battleTime.toFixed(4); r.on=o.T?o.T.key:null; r.mir=!!o.mir; } if(o.s){ r.lastFr=o.fr; r.pos=o.pos?[+o.pos.x.toFixed(3),+o.pos.z.toFixed(3)]:null; } }
      for(const [o,r] of seen) if(r.gone==null&&!live.includes(o)) r.gone=+battleTime.toFixed(4);
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),(u.bleedStacks||0)].join(':')).join('|')); }
    return JSON.stringify({press,hold,anim,fx,hits,trace:crypto_like(tr.join('#')),plates,arts,dead:[e,e2,e3].filter(x=>!x.alive).map(x=>x.key)});
  } finally { doEffect=_de; dealDamage=_dd; spawnGroundFx=_sg; } })()`;
const fight = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10)].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
// facing, drawn through the painter itself with a fake sprite: UV x sign and anchor, facing right vs left
const FAKE = `const fake=()=>({center:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},scale:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;},copy(p){this.x=p.x||0;this.y=p.y||0;this.z=p.z||0;}},rotation:{},_uv:[0.2,0.1,0.2,0.1],material:{}});`;
const FACE = brk => `(()=>{ ${FAKE} const out=[]; const _spr=_fx22Spr; _fx22Spr=function(){ return fake(); };
  try{ const h=makeUnit('hollow','ally',500,700,30,{owned:false}); h.anim=BATTLE_ANIM.hollow; const e=makeUnit('tick','enemy',540,700,30,{owned:false});
    for(const vk of ['hlacer','hvoid']) for(const left of [false,true]){ h._fxMirror=left; h.target=e; const o={vk,d:FX2_DEF[FX16_ART[vk].k],u:h,t:0,ts:0,T:vk==='hvoid'?e:null}; o.s=fx16Show(o); if(${brk ? 'true' : 'false'}) o.mir=false;
      fx2SetFrame(o.s,o.d,3); _fx22Fx16Cut(o); out.push({vk,left,on:o.T&&o.T.key,mir:!!o.mir,uv:Math.sign(o.s._uv[0]),cx:+o.s.center.x.toFixed(4),ax:o.d.anchor[0],W:+o.s.scale.x.toFixed(4),Hs:+o.s.scale.y.toFixed(4),hd:+o.hd.toFixed(4)}); }
  } finally{ _fx22Spr=_spr; } return JSON.stringify(out); })()`;
const facingOk = F => [0, 2].every(i => { const r = F[i], l = F[i + 1]; return r.on === 'tick' && l.on === 'tick' && !r.mir && l.mir && r.uv > 0 && l.uv < 0 && Math.abs(r.cx - r.ax) < 1e-6 && Math.abs(l.cx - (1 - l.ax)) < 1e-6; });

try {
  ck('control file (BASE emberweave-heroes.html from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; '));
    let cb = 0; try { new vm.Script(html.replace('function _fx22Fx16Cut(o){', 'function _fx22Fx16Cut(o){ if( ').match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken painter', cb === 1); }
  const src = fs.readFileSync(HTML, 'utf8'), baseSrc = fs.readFileSync(OLD, 'utf8');
  // 1. sheets
  const FXQ = 'JSON.stringify(Object.assign({FX_RT,METER},Object.fromEntries(' + JSON.stringify(KEYS) + '.map(k=>[k,FX2_DEF[k]]))))', F = JSON.parse(run(FXQ)), F0 = JSON.parse(R0(FXQ));
  const bad = sheetProblems(F);
  ck('the two sheets exist, file = declared grid, within 2048 px per side and 4 MB, q95 lossy + alpha', bad.length === 0, bad.join('; '));
  ck('they replace hollow_blue / hollow_ult in place: new files at ?v=' + VER + ' that BASE never referenced; the old plates stay on disk (rollback needs nothing)',
    KEYS.every(k => F[k].u === '/assets/anim/fx/' + FILES[k] + '.webp?v=' + VER && !baseSrc.includes(FILES[k]) && fs.existsSync(fileOf(F0[k].u))));
  { const A = JSON.parse(run('JSON.stringify(BATTLE_ANIM.hollow.green)')), A0 = JSON.parse(R0('JSON.stringify(BATTLE_ANIM.hollow.green)')), f = fileOf(A.u), sz = webpSize(f), ch = chunks(fs.readFileSync(f)), ct = +run("castTimeFor({key:'hollow',t:HERO_TYPES.hollow},'green')");
    const relReal = A.release / A.fps, castReal = ct / F.FX_RT, sha = crypto.createHash('sha256').update(fs.readFileSync('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/Heroes/Hollow/clips/Hollow-Fan-of-Knives-natural-draw-clean REVIEW 16OCT2026.mp4')).digest('hex');
    ck(`his green clip is the approved natural draw (source sha256 ${sha.slice(0, 8)} = the handoff's 61d90da2): ${A.n} cells ${A.fw}x${A.fh} (${sz}) q95 within 2048 px and 4 MB at ?v=${VER}; the RELEASE cell ${A.release} (source f88) at ${relReal.toFixed(4)} real s lands on the engine's cast end ${castReal.toFixed(4)} (0.5 fight s), within one cell`,
      sha === '61d90da2338ca7f218c88abcb14400531d64fc9003b656915c80e3748238c01e' && A.u === '/assets/anim/hollow/hollow_green_1191.webp?v=' + VER && !baseSrc.includes('hollow_green_1191') && sz && sz[0] === A.fw * A.cols && sz[1] === A.fh * A.rows && sz[0] <= 2048 && sz[1] <= 2048 && fs.statSync(f).size <= 4e6 && ch.includes('VP8 ') && ch.includes('ALPH') &&
      A.n === 60 && A.release === 18 && A.fps === 24 && Math.abs(relReal - castReal) < 1 / A.fps && relReal >= castReal && Math.abs(ct - 0.5) < 1e-9 && A0.release === 8 && fs.existsSync(fileOf(A0.u)), JSON.stringify({ A, sz, ct })); }
  { const anim = JSON.parse(run('JSON.stringify(BATTLE_ANIM.hollow)')), py = a => JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'noxgrim_1166_check.py'), ROOT, JSON.stringify({ anim: a, cells0: { idle: 0, green: 0 } })], { maxBuffer: 1 << 24 }).toString()).scale.green;
    const s = py(anim), bad = JSON.parse(JSON.stringify(anim)); bad.green.figH = 208; bad.green.feet = 217; bad.green.cx = 130; const c = py(bad);
    ck(`his new green clip is drawn at his idle's size and spot: frame 0 against idle's frame 0 (figH 300 each) - IoU ${s.iou}, best scale ${s.k} and shift ${s.dx} / ${s.dy} px`, s.iou >= 0.93 && s.k === 1 && Math.abs(s.dx) <= 2 && Math.abs(s.dy) <= 2, JSON.stringify(s));
    ck(`CONTROL: the first cut's anchors (figH 208, feet 217, cx 130) read as off: best scale ${c.k}, shift ${c.dx} / ${c.dy}`, c.k !== 1 || Math.abs(c.dx) > 0 || Math.abs(c.dy) > 0); }
  // v1203: his death states were re-keyed (the plate key, tests/test_death_state.js) - they leave the comparison, as in the other per-hero tables
  const hcl = (r, d) => r("JSON.stringify(Object.keys(BATTLE_ANIM.hollow).filter(k=>k!=='green'" + (d ? "&&!/^death\\d*$/.test(k)" : '') + ").map(k=>[k,BATTLE_ANIM.hollow[k]]))");
  ck('his other battle clips are byte-for-byte BASE (his death states aside: re-keyed in v1203)', hcl(run, 1) === hcl(R0, 1));
  ck('CONTROL: with the death states in, the clips differ from BASE - and only by his death states (death .. death12)', hcl(run, 0) !== hcl(R0, 0) && run("Object.keys(BATTLE_ANIM.hollow).filter(k=>/^death\\d*$/.test(k)).length") === 12);
  { const ctl = JSON.parse(JSON.stringify(F)); ctl.hollow_blue.fw = 900; ctl.hollow_ult.u = '/assets/anim/fx/hollow_missing.webp?v=1';
    ck('CONTROL: the sheet check catches an oversized grid and a missing file', sheetProblems(ctl).length >= 2); }
  { const PY = cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'hollow_fx_1191_check.py')].concat(KEYS.map(k => fileOf(F[k].u))), { maxBuffer: 1 << 24 }).toString();
    const Q = JSON.parse(PY), b = Q[FILES.hollow_blue + '.webp'], u = Q[FILES.hollow_ult + '.webp'], g = Q[FILES.hollow_green + '.webp'];
    ck('no fringe on Grok\'s knives: visible green 0, olive <= 0.01% (the knives are pink-lavender - no violet clamp): ' + JSON.stringify(g), g.green_edge === 0 && g.green_body === 0 && g.olive_edge <= 0.01 && g.olive_body <= 0.01 && g.control_green_edge > 20);
    { const PH = JSON.parse(cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'hollow_fx_1191_check.py'), path.join(ROOT, 'assets/anim/hollow/hollow_green_1191.webp'), path.join(ROOT, 'assets/anim/hollow/hollow_blue_1126.webp')], { maxBuffer: 1 << 24 }).toString());
      const c = PH['hollow_green_1191.webp'], c0 = PH['hollow_blue_1126.webp'];
      ck(`no fringe on his new green clip: visible green 0, olive edge ${c.olive_edge}% (his live blue2 ${c0.olive_edge}%; <= 0.6%), body ${c.olive_body}%; CONTROL: the plate mixed back reads green (${c.control_green_edge}%)`, c.green_edge === 0 && c.green_body === 0 && c.olive_edge <= 0.6 && c.olive_body <= 0.05 && c.control_green_edge > 20, JSON.stringify(PH)); }
    ck('no fringe, measured: visible green 0 and olive (plate left in a soft edge) <= 0.01% on edge and body; no magenta (the green\'s complement: a pink haze round the cut) on either: ' + PY,
      [b, u].every(m => m.green_edge === 0 && m.green_body === 0 && m.olive_edge <= 0.01 && m.olive_body <= 0.01) && b.magenta_edge === 0 && b.magenta_body === 0 && u.magenta_edge <= 2 * u.magenta_body + 0.05);
    /* the void's rim is painted violet-pink (it is in the opaque body too): the Lacerate owns none, so it must read 0; on the ult the soft edge may carry no more of it than its body does */
    ck('CONTROL: the plate mixed back into the edges reads as visible green (' + b.control_green_edge + '%, ' + u.control_green_edge + '%) and olive once despilled (' + b.control_olive_edge + '%, ' + u.control_olive_edge + '%)',
      [b, u].every(m => m.control_green_edge > 20 && m.control_olive_edge > 5)); }
  // 2. data = BASE
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'ownFx' ? undefined : v));
  const kit = r => JSON.stringify(strip(JSON.parse(r('JSON.stringify([KITS.hollow,HERO_TYPES.hollow,ABILITY_CAST.hollow||null,ULT_DEF.vanishpoint])'))));
  ck('kit, hero stats, cast times, ult numbers and battle clips identical to BASE apart from the ownFx display tags (Fan of Knives: hfan, Lacerate: hlacer)', kit(run) === kit(R0) && run("KITS.hollow.green.ownFx+'/'+KITS.hollow.blue.ownFx") === 'hfan/hlacer' && R0('KITS.hollow.blue.ownFx||KITS.hollow.green.ownFx||null') === null);
  ck('the ult art: BASE\'s one plate on him (gfx hollow_ult) becomes the per-strike draw (ownFx hvoid, a strike mode: no press start, no release plate)',
    run('JSON.stringify(HERO_ULT_ART.hollow)') === '{"ownFx":"hvoid"}' && R0('JSON.stringify(HERO_ULT_ART.hollow)') === '{"gfx":"hollow_ult","gdur":5.88}' && run('FX16_ART.hvoid.strike') === true &&
    /FX16_ART\[_ua\.ownFx\]&&!FX16_ART\[_ua\.ownFx\]\.strike\) fx16Cast/.test(src) && /else if\(FX16_ART\[o\.ownFx\]&&FX16_ART\[o\.ownFx\]\.strike\)\{\}/.test(src));
  const others = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>!/^hollow_(green|blue|ult)$/.test(k)).map(k=>[k,FX2_DEF[k]]))");
  ck('his two sheets load with his figure (FX1123_WARM.hollow), as the other FX16 heroes sheets do', run('JSON.stringify(FX1123_WARM.hollow)') === '["hollow_green","hollow_blue","hollow_ult"]' && R0('typeof FX1123_WARM.hollow') === 'undefined');
  ck('every other FX2_DEF entry is byte-for-byte BASE', H(others(run)) === H(others(R0)));
  // 3. tick-identical
  const C = { FX_RT: F.FX_RT, step: +run('SIM_STEP') }, casts = {};
  for (const [kind, opt] of [['blue', {}], ['ult', {}], ['ult', { full: true }], ['green', {}]]) {
    const x = JSON.parse(run(CAST(kind, opt))), y = JSON.parse(R0(CAST(kind, opt))); casts[kind + (opt.full ? 'F' : '')] = x;
    const pick = o => JSON.stringify([kind === 'green' ? null : o.hold, o.anim, o.fx, o.hits, o.trace]);   /* green: the clip's own playthrough (render only) is the new clip's, checked below */
    ck(`${kind}${opt.full ? ' (healthy enemies: no chain)' : ''}: the effect and every hit land on the same ticks (${x.fx.join(' ')}; ${x.hits.slice(0, 4).join(' ')}) and every unit = BASE for 8 s`, x.anim === kind && pick(x) === pick(y), JSON.stringify({ now: pick(x), base: pick(y) }));
  }
  { const T = [[11, ['hollow', 'vael', 'tick'], ['grosk', 'vireo', 'sylthaine']], [23, ['hollow', 'veyr', 'korvux', 'lumi', 'vex'], ['mirelle', 'aureth', 'carn', 'oakmir', 'hollow']], [5, ['hollow', 'deepcleft'], ['umbris', 'nox', 'tick']]];
    const a = T.map(([s, x, y]) => fight(run, s, x, y)), b = T.map(([s, x, y]) => fight(R0, s, x, y));
    ck('whole fights (3 seeds, Hollow on both sides, his auto-cast green / blue / ult) are tick-identical to BASE', JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
    run("globalThis.__s=KITS.hollow.blue.mul; KITS.hollow.blue.mul*=0.5; 1"); const c = fight(run, T[0][0], T[0][1], T[0][2]); run('KITS.hollow.blue.mul=globalThis.__s; 1');
    ck('CONTROL: the same fight with Lacerate\'s damage halved is NOT identical (the instrument sees game logic)', c !== b[0]); }
  // 4. the moments and the units
  { const x = casts.blue, d = F.hollow_blue, A = JSON.parse(run('JSON.stringify(BATTLE_ANIM.hollow.blue)')), L = x.arts.filter(r => r.vk === 'hlacer');
    const want = x.press + d.spawn / A.fps * C.FX_RT, hit = x.hits.length ? +x.hits[0].split('@')[1] : null;
    ck(`Lacerate: one cut, on the unit the cut hits (${L.length ? L[0].on : '-'}), shown at blue2 cell ${d.spawn} = his first slash (press ${x.press} + ${d.spawn}/${A.fps} real s = ${want.toFixed(4)}; shown ${L.length ? L[0].shown : '-'}), one cell before the damage at the release (cell ${A.release}, hit ${hit})`,
      L.length === 1 && L[0].on === x.hits[0].split('@')[0] && Math.abs(L[0].shown - want) <= 2 * C.step + 1e-6 && d.spawn === 16 && A.release === 17 && hit != null && L[0].shown < hit + 1e-9 && L[0].mir === false && x.plates.length === 0, JSON.stringify(x));
    ck(`... plays once in real time: ${d.n} cells at 12 fps = ${(d.n / 12).toFixed(2)} real s (shown for ${((L[0].gone - L[0].shown) / C.FX_RT).toFixed(2)}), every cell drawn (last ${L[0].lastFr})`,
      Math.abs((L[0].gone - L[0].shown) - d.n / 12 * C.FX_RT) <= 2 * C.step && L[0].lastFr === d.n - 1 && Math.abs(d.dur - d.n / 12) < 1e-3);
    const Lf = JSON.parse(run(CAST('blue', { left: true }))).arts.filter(r => r.vk === 'hlacer');
    ck(`... mirrored when he faces left (mirrored ${Lf.length ? Lf[0].mir : '-'})`, Lf.length === 1 && Lf[0].mir === true);
    const y = JSON.parse(R0(CAST('blue')));
    ck('CONTROL: BASE drew the old plate for Lacerate and no cut (' + JSON.stringify(y.plates) + ', ' + y.arts.length + ' arts)', y.plates.includes('hollow_blue') && y.arts.length === 0); }
  { const x = casts.green, d = F.hollow_green, A = JSON.parse(run('JSON.stringify(BATTLE_ANIM.hollow.green)')), G = x.arts.filter(r => r.vk === 'hfan'), want = x.press + d.spawn / A.fps * C.FX_RT, hit = x.fx.length ? +x.fx[0].split('@')[1] : null;
    ck(`... his green hold is the new clip's one playthrough, ${x.hold} s = 60 cells / 24 fps (render only; BASE 4 s)`, Math.abs(x.hold - 2.5) < 1e-9);
    ck(`Fan of Knives: Grok's knives once, shown on his green clip's release cell ${d.spawn} (press ${x.press.toFixed(4)} + ${d.spawn}/${A.fps} real s = ${want.toFixed(4)}; shown ${G.length ? G[0].shown : '-'}), the fan's damage on the release (${hit}); as painted facing right`,
      G.length === 1 && d.spawn === A.release && Math.abs(G[0].shown - want) <= 2 * C.step + 1e-6 && hit != null && Math.abs(G[0].shown - hit) <= 2 * C.step + 1e-6 && G[0].mir === false && x.plates.length === 0, JSON.stringify(x));
    ck(`... plays once, 4x the clip's speed (Phil: faster, then double that): ${d.n} cells at ${d.fps2} fps = ${(d.n / d.fps2).toFixed(2)} real s (shown ${G.length ? ((G[0].gone - G[0].shown) / C.FX_RT).toFixed(2) : '-'}), played to its last cells (48 fps outruns the fight tick: a cell may be skipped)`, d.fps2 === 48 && Math.abs(d.dur - d.n / d.fps2) < 1e-3 && G.length === 1 && G[0].lastFr >= d.n - 2 && Math.abs((G[0].gone - G[0].shown) - d.n / d.fps2 * C.FX_RT) <= 2 * C.step);
    ck('... and in a rendered fight the knives are made one cell early and SHOWN by syncMesh on the frame that draws the release cell (the fight tick runs before the render: without this they appeared one frame late in the rig)',
      /if\(V\.mode==='hand'&&live&&a<d\.spawn\)\{ o\.vis=false; u\._fxHand=o; \}/.test(src) && /else if\(fr>=q\.d\.spawn\)\{ q\.vis=true; q\.ts=q\.t; q\.s\.visible=true; u\._fxHand=null; \}/.test(src) && /o\.s\.visible=\(o\.vis!==false\)/.test(src));
    const Gl = JSON.parse(run(CAST('green', { left: true }))).arts.filter(r => r.vk === 'hfan');
    ck(`... mirrored when he faces left (${Gl.length ? Gl[0].mir : '-'})`, Gl.length === 1 && Gl[0].mir === true);
    const y = JSON.parse(R0(CAST('green')));
    ck('CONTROL: BASE drew the old cone plate and no knives from his hand (' + JSON.stringify(y.plates) + ')', y.plates.includes('hollow_green') && y.arts.length === 0); }
  { const x = casts.ult, d = F.hollow_ult, V = x.arts.filter(r => r.vk === 'hvoid'), struck = x.hits.map(h => h.split('@'));
    ck(`Vanishing Point: one void slash per strike, on the enemy struck, made on the strike's tick (${struck.length} strikes: ${x.hits.join(' ')}; arts ${V.map(r => r.on + '@' + r.made).join(' ')}; killed ${x.dead.join(',')})`,
      struck.length === 3 && V.length === 3 && V.every((r, i) => r.on === struck[i][0] && Math.abs(r.made - +struck[i][1]) <= 1e-6) && new Set(V.map(r => r.on)).size === 3 && x.dead.length === 3, JSON.stringify(x));
    ck(`... each plays once in real time to its end (${d.n} cells at 12 fps = ${(d.n / 12).toFixed(2)} real s) although its enemy died on that strike - it stays where the enemy fell`,
      V.every(r => r.lastFr === d.n - 1 && Math.abs((r.gone - r.shown) - d.n / 12 * C.FX_RT) <= 2 * C.step && r.pos), JSON.stringify(V));
    const xf = casts.ultF, Vf = xf.arts.filter(r => r.vk === 'hvoid');
    ck(`... and with healthy enemies (no execution: one strike, no chain) exactly one (${Vf.length}, on ${Vf.map(r => r.on)})`, Vf.length === 1 && xf.hits.length === 1 && Vf[0].on === xf.hits[0].split('@')[0]);
    ck('... nothing at the press or on him (no hollow plate, no other art)', x.plates.length === 0 && x.arts.every(r => r.vk === 'hvoid'));
    const y = JSON.parse(R0(CAST('ult')));
    ck('CONTROL: BASE drew one plate on him for the whole ult and no per-strike art (' + JSON.stringify(y.plates) + ')', y.plates.filter(p => p === 'hollow_ult').length === 1 && y.arts.length === 0); }
  // 5. facing and size
  { const HF = brk => JSON.parse(run(`(()=>{ ${FAKE} const out=[]; const _spr=_fx22Spr; _fx22Spr=function(){ return fake(); };
      try{ const h=makeUnit('hollow','ally',500,700,30,{owned:false}); h.anim=BATTLE_ANIM.hollow; for(const left of [false,true]){ h._fxMirror=left; const o={vk:'hfan',d:FX2_DEF.hollow_green,u:h,t:0,ts:0}; o.s=fx16Show(o); if(${brk}) o.mir=false;
        fx2SetFrame(o.s,o.d,0); _fx22Fx16Hand(o); const A=BATTLE_ANIM.hollow.green, wpp=_fx22Head(h)/A.figH, W=o.s.scale.x, ax=o.d.anchor[0];
        out.push({left,mir:!!o.mir,uv:Math.sign(o.s._uv[0]),cx:+o.s.center.x.toFixed(5),cy:+o.s.center.y.toFixed(5),W:+W.toFixed(4),rootX:+((((o.mir?1-ax:ax))-o.s.center.x)*W).toFixed(4),rootY:+((o.d.anchor[1]-o.s.center.y)*o.s.scale.y).toFixed(4),handX:+((A.hand[0]-A.cx)*wpp).toFixed(4),handY:+((A.feet-A.hand[1])*wpp).toFixed(4),fan:+(44/314*W/wpp).toFixed(2),open:(()=>{ o.t=(o.d.grow||0)*FX_RT*1.001; _fx22Fx16Hand(o); const r=+(o.s.scale.x/W).toFixed(4), rx=+((((o.mir?1-ax:ax))-o.s.center.x)*o.s.scale.x).toFixed(4); o.t=0; return [r,rx]; })()}); }
      } finally{ _fx22Spr=_spr; } return JSON.stringify(out); })()`));
    const ok = R => { const [r, l] = R; return !r.mir && l.mir && r.uv > 0 && l.uv < 0 && Math.abs(r.rootX - r.handX) < 1e-3 && Math.abs(l.rootX + l.handX) < 1e-3 && Math.abs(r.rootY - r.handY) < 1e-3 && Math.abs(l.rootY - l.handY) < 1e-3; };
    const R1 = HF(false), R2 = HF(true), FX2_DEF_GROW = run("JSON.stringify({flyMul:FX2_DEF.hollow_green.flyMul,grow:FX2_DEF.hollow_green.grow})");
    ck('Fan of Knives through its painter: the fan\'s root sits on his throwing hand (cell 18) facing right, on the mirrored hand facing left, UV + / -; the fan on frame 0 is ' + R1[0].fan + ' of his cell px across (the fan he held: 25): ' + JSON.stringify(R1), ok(R1) && Math.abs(R1[0].fan - 25) < 1);
    ck('... and it OPENS as it flies (Phil could not see the held-size fan): ' + FX2_DEF_GROW + ' - after grow it is flyMul x the held size, its root still on his hand: ' + JSON.stringify(R1.map(r => r.open)), R1.every(r => Math.abs(r.open[0] - 2.5) < 1e-3 && Math.abs(r.open[1] - r.rootX) < 1e-3));
    ck('CONTROL: the knives painter forced to ignore his facing FAILS it', !ok(R2)); }
  { const Fc = JSON.parse(run(FACE(false))), Cb = JSON.parse(run(FACE(true)));
    ck('both flip with his facing, through the painter: facing right UV + / anchor a, facing left UV - / anchor 1 - a: ' + JSON.stringify(Fc), facingOk(Fc));
    ck('CONTROL: a painter forced to ignore his facing FAILS the same check', !facingOk(Cb));
    const v = Fc[2], l = Fc[0];
    ck(`sizes: Lacerate ${(l.Hs / l.hd).toFixed(2)} x the target's height tall (${(l.W / l.hd).toFixed(2)} across); Vanishing Point ${(v.W / v.hd).toFixed(2)} x across (${(v.Hs / v.hd).toFixed(2)} tall) - small, one per struck enemy`,
      Math.abs(l.Hs / l.hd - 0.95) < 1e-3 && Math.abs(v.W / v.hd - 0.6 * 292 / 195) < 1e-3 && v.W / v.hd <= 1.0); }
  // 6. previews
  { const P = JSON.parse(run(`JSON.stringify([1].map(sl=>{ const p=skillPreviewPlan('hollow',sl); return p?{rel:p.rel,fx:p.fx.map(e=>({k:e.k,kind:e.kind,at:e.at||null,t0:+e.t0.toFixed(4),hx:e.hx,hy:e.hy,hw:e.hw}))}:null; }))`))[0];
    ck('Skills tab preview of Fan of Knives: Grok\'s knives (fx16hand) from the release cell at his hand: ' + JSON.stringify(P), P && P.fx.length === 1 && P.fx[0].k === 'hollow_green' && P.fx[0].kind === 'fx16hand' && P.fx[0].hx > 0.5 && P.fx[0].hy > 0.5);
    const stage = fs.readFileSync(path.join(ROOT, 'assets/ui/skill-preview-stage.js'), 'utf8');
    ck('the preview stage draws fx16hand (box + draw, in front) and the page loads it at a new ?v= (sp' + VER + ')', (stage.match(/case 'fx16hand'/g) || []).length === 2 && /e\.kind==='fx16hand'\);/.test(stage) && src.includes('skill-preview-stage.js?v=sp' + VER) && !baseSrc.includes('skill-preview-stage.js?v=sp' + VER)); }
  { const P = JSON.parse(run(`JSON.stringify([0,2].map(sl=>{ const p=skillPreviewPlan('hollow',sl); return p?{rel:p.rel,T0:p.T0!=null?p.T0:null,fx:p.fx.map(e=>({k:e.k,kind:e.kind,at:e.at||null,t0:+e.t0.toFixed(4),real:e.real!=null?+e.real.toFixed(3):null}))}:null; }))`));
    const [u, b] = P;
    ck('Skills tab previews show the new art on the target (fx16over): Lacerate from cell 16, Vanishing Point after he is gone (the ult\'s gone): ' + JSON.stringify(P),
      b && b.fx.length === 1 && b.fx[0].k === 'hollow_blue' && b.fx[0].kind === 'fx16over' && b.fx[0].at === 'target' && u && u.fx.length === 1 && u.fx[0].k === 'hollow_ult' && u.fx[0].kind === 'fx16over' && u.fx[0].at === 'target' && u.fx[0].t0 > u.rel, JSON.stringify(P)); }
  ck('no emoji added', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src.slice(src.indexOf('function _fx22Fx16Cut'), src.indexOf('function _fx22Fx16Cut') + 2000)));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
