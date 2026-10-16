'use strict';
// v1174 - Mirelle's three spell FX (Grok renders, Phil approved 16 Oct 2026; Grok's handoff 12:51), DISPLAY ONLY:
//   SCENT OF COURAGE  mirelle_green_scent_of_courage_16oct.mp4 (green key): upright behind the ally the heal lands on (the case's own pick - the lowest
//                     health fraction), from the heal, riding that ally; real time, once (clears itself by 5.4 s)
//   SOPORIFIC BOUQUET mirelle_blue_soporific_bouquet_16oct.mp4 (green key): over the enemy the shot sleeps, from the landing; drifting away from her
//                     (as painted when it is on her right, mirrored on her left); nothing flies; real time, once (faded by ~5.8 s)
//   IMPERIAL PLUMAGE  mirelle_ult_imperial_plumage_16oct.mp4 (MAGENTA key): the fieldWide 'both' draw it always had (v591) - over every ally's bar, under
//                     every enemy's feet - playing ONCE (dur = its real-time length, hold)
// CONTROL against the live build (git show BASE): casts and whole fights with Mirelle are tick-identical (FX never move game logic).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const VER = process.env.EW_VER || '1174';
const BASE_SHA = process.env.EW_BASE || '1fabc0e2';   // live v1173 (Meridian + Rafe, on v1172 / v1171), before this change
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-mfx1174-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
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
const KEYS = ['mirelle_green', 'mirelle_blue', 'mirelle_ult'], FILES = { mirelle_green: 'mirelle_scent_of_courage_16oct', mirelle_blue: 'mirelle_soporific_bouquet_16oct', mirelle_ult: 'mirelle_imperial_plumage_16oct' };
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
// one cast: Mirelle + a hurt ally + two enemies (one charged); every effect / heal / sleep tick and every unit for 7 s; the art (new page) and its unit
const CAST = (kind, opt) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123();
  const g=makeUnit('mirelle','ally',420,700,30,{owned:false,rank:3}); const a=makeUnit('vael','ally',520,660,30,{owned:false}); const e=makeUnit('tick','enemy',700,700,30,{owned:false}); const e2=makeUnit('sylthaine','enemy',760,740,30,{owned:false});
  g.anim=BATTLE_ANIM.mirelle; a.anim=null; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,a,e,e2]; units.forEach(u=>{ try{ buildFigure(u); }catch(_e){} }); g.anim=BATTLE_ANIM.mirelle; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); a.hp=a.maxHp*0.4; e2.energy=80; [a,e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.greenCd=x.blueCd=99; x.speed=0;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99;
  const OPT=${JSON.stringify(opt || {})}; if(OPT.left){ e.x=200; e2.x=160; e2.energy=80; }
  const fx=[], heal=[], cc=[], proj=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const _hf=healFrom; healFrom=function(s,t){ if(s===g) heal.push(t.key+'@'+battleTime.toFixed(4)); return _hf.apply(this,arguments); };
  const _cc=ccApply; ccApply=function(s,t,k){ if(s===g) cc.push(t.key+':'+k+'@'+battleTime.toFixed(4)); return _cc.apply(this,arguments); };
  const _pf=spawnProjFx; spawnProjFx=function(k){ proj.push(k); return _pf.apply(this,arguments); };
  let badge=0; const _ba=buffArtAll; buffArtAll=function(uu){ if(uu===g) badge++; return _ba.apply(this,arguments); };
  const _sg=spawnGroundFx; let plates=[]; spawnGroundFx=function(k){ if(/^mirelle_/.test(k)) plates.push(k+'@'+battleTime.toFixed(4)+(window._fxAboveBar?':bar':'')+(window._fxBelowFeet?':feet':'')); return _sg.apply(this,arguments); };
  g._castSM=1; g._castLv=1;
  try{
    if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,'${kind}'==='blue'?(g.blueAb||KITS.mirelle.blue):(g.greenAb||KITS.mirelle.green));
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let shown=null, on=null, gone=null, cells=[], mir=null;
    const art=()=>(typeof _fx1123!=='undefined')?_fx1123.find(o=>o.kind==='fx16'&&o.u===g):null;
    const tr=[]; for(let i=0;i<Math.round(7/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; units.forEach(x=>{ if(x!==g) x.energy=(x===e2?80:0); });
      const o=art(); if(o&&o.s&&shown==null){ shown=+battleTime.toFixed(4); on=o.T?o.T.key:null; mir=!!o.mir; } if(o&&o.s) cells.push([+battleTime.toFixed(4),o.fr,+(o.op!=null?o.op:-1).toFixed(3)]);
      if(shown!=null&&!o&&gone==null) gone=+battleTime.toFixed(4);
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),+(u._sleepT||0).toFixed(2),+(u.dmgBuffT||0).toFixed(2),Math.round(u.shield||0),+(u._shredT||0).toFixed(2)].join(':')).join('|')); }
    return JSON.stringify({hold,anim,fx,heal,cc,proj,trace:crypto_like(tr.join('#')),badge,plates,shown,on,mir,gone,cells:cells.filter((c,i,a)=>i===0||c[1]!==a[i-1][1]||i===a.length-1)});
  } finally { doEffect=_de; healFrom=_hf; ccApply=_cc; spawnProjFx=_pf; buffArtAll=_ba; spawnGroundFx=_sg; } })()`;
const fight = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10)].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');

try {
  ck('control file (BASE emberweave-heroes.html from git ' + BASE_SHA + ', the live build) loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; '));
    let cb = 0; try { new vm.Script(html.replace('function _fx22Fx16On(o){', 'function _fx22Fx16On(o){ if( ').match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken painter', cb === 1); }
  const src = fs.readFileSync(HTML, 'utf8'), baseSrc = fs.readFileSync(OLD, 'utf8');
  // 1. sheets
  const FXQ = 'JSON.stringify(Object.assign({FX_RT,METER},Object.fromEntries(' + JSON.stringify(KEYS) + '.map(k=>[k,FX2_DEF[k]]))))', F = JSON.parse(run(FXQ)), F0 = JSON.parse(R0(FXQ));
  const bad = sheetProblems(F);
  ck('the three sheets exist, file = declared grid, within 2048 px per side and 4 MB, q95 lossy + alpha', bad.length === 0, bad.join('; '));
  ck('they replace mirelle_green / mirelle_blue / mirelle_ult in place: new files at ?v=' + VER + ' that BASE never referenced', KEYS.every(k => F[k].u === '/assets/anim/fx/' + FILES[k] + '.webp?v=' + VER && !baseSrc.includes(FILES[k])));
  ck('the old plates are still on disk (rollback needs nothing)', KEYS.every(k => fs.existsSync(fileOf(F0[k].u))));
  { const ctl = JSON.parse(JSON.stringify(F)); ctl.mirelle_blue.fw = 900; ctl.mirelle_ult.u = '/assets/anim/fx/mirelle_missing.webp?v=1';
    ck('CONTROL: the sheet check catches an oversized grid and a missing file', sheetProblems(ctl).length >= 2); }
  { const PY = cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'mirelle_fx_1174_check.py')].concat(KEYS.map(k => fileOf(F[k].u))), { maxBuffer: 1 << 24 }).toString();
    const Q = JSON.parse(PY), g = Q[FILES.mirelle_green + '.webp'], b = Q[FILES.mirelle_blue + '.webp'], u = Q[FILES.mirelle_ult + '.webp'];
    ck('no fringe, measured: the two green-plate sheets - visible green 0 and olive (plate left in a soft edge) <= 0.01% (they own lavender, so no violet clamp); the magenta-plate ult - visible magenta (min(R,B) - G > 60, R >= 0.85 B) 0 on edge and body: ' + PY,
      [g, b].every(m => m.green_edge === 0 && m.green_body === 0 && m.olive_edge <= 0.01 && m.olive_body <= 0.01) && u.magenta_edge === 0 && u.magenta_body === 0);
    ck('CONTROL: the plate mixed back into the edges reads as visible green on the green sheets (' + g.control_green_edge + '%, ' + b.control_green_edge + '%) and as magenta on the ult (' + u.control_magenta_edge + '%)', g.control_green_edge > 20 && b.control_green_edge > 20 && u.control_magenta_edge > 20); }
  // 2. data = BASE
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'ownFx' ? undefined : v));
  const kit = r => JSON.stringify(strip(JSON.parse(r('JSON.stringify([KITS.mirelle,HERO_ULT_ART.mirelle,HERO_TYPES.mirelle,ABILITY_CAST.mirelle||null,ULT_DEF.plumage,BATTLE_ANIM.mirelle])'))));
  ck('kit, ult art, hero stats, cast times, ult numbers and battle clips identical to BASE apart from the two ownFx display tags (mcourage / msleep)', kit(run) === kit(R0) && run("KITS.mirelle.green.ownFx+'/'+KITS.mirelle.blue.ownFx") === 'mcourage/msleep');
  const others = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>!/^mirelle_(green|blue|ult)$/.test(k)).map(k=>[k,FX2_DEF[k]]))");
  ck('every other FX2_DEF entry is byte-for-byte BASE', H(others(run)) === H(others(R0)));
  // 3. tick-identical
  const C = { FX_RT: F.FX_RT, step: +run('SIM_STEP') }, casts = {};
  for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(kind))), y = JSON.parse(R0(CAST(kind))); casts[kind] = x;
    const pick = o => JSON.stringify([o.hold, o.anim, o.fx, o.heal, o.cc, o.trace]);
    ck(`${kind}: the effect, heals and controls land on the same ticks (${x.fx.join(' ')}; ${x.heal.concat(x.cc).slice(0, 3).join(' ')}) and every unit = BASE for 7 s`, x.anim === kind && pick(x) === pick(y), JSON.stringify({ now: pick(x), base: pick(y) }));
  }
  { const T = [[11, ['mirelle', 'vael', 'tick'], ['grosk', 'vireo', 'sylthaine']], [23, ['mirelle', 'veyr', 'korvux', 'lumi', 'vex'], ['mirelle', 'aureth', 'carn', 'oakmir', 'rhukk']], [5, ['mirelle', 'deepcleft'], ['umbris', 'hollow', 'nox']]];
    const a = T.map(([s, x, y]) => fight(run, s, x, y)), b = T.map(([s, x, y]) => fight(R0, s, x, y));
    ck('whole fights (3 seeds, Mirelle on both sides, her auto-cast green / blue / ult) are tick-identical to BASE', JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
    run("globalThis.__s=KITS.mirelle.green.mul; KITS.mirelle.green.mul*=0.5; 1"); const c = fight(run, T[0][0], T[0][1], T[0][2]); run('KITS.mirelle.green.mul=globalThis.__s; 1');
    ck('CONTROL: the same fight with Scent of Courage\'s heal halved is NOT identical (the instrument sees game logic)', c !== b[0]); }
  // 4. the moments and the units
  { const x = casts.green, hT = x.heal.length ? +x.heal[0].split('@')[1] : null, d = F.mirelle_green;
    ck(`Scent of Courage shows on the heal (${hT}; shown ${x.shown}) on the ally it heals (${x.heal[0]} -> the art on ${x.on}), plays once in real time (${d.n} cells = ${(d.n / 12).toFixed(2)} real s; shown for ${((x.gone - x.shown) / C.FX_RT).toFixed(2)})`,
      hT != null && Math.abs(x.shown - hT) <= C.step + 1e-6 && x.on === x.heal[0].split('@')[0] && x.on === 'vael' && Math.abs((x.gone - x.shown) - d.n / 12 * C.FX_RT) <= 2 * C.step && x.badge === 0, JSON.stringify(x)); }
  { const x = casts.blue, sl = x.cc.find(q => /:stunned@/.test(q)), sT = sl ? +sl.split('@')[1] : null, d = F.mirelle_blue;
    ck(`Soporific Bouquet shows when the shot lands and sleeps (${sl}; shown ${x.shown}) over that enemy (${x.on}), drifting away from her (on her right: as painted, mirrored ${x.mir}), nothing flies (projectiles: ${JSON.stringify(x.proj)}), once in real time`,
      sT != null && Math.abs(x.shown - sT) <= C.step + 1e-6 && x.on === sl.split(':')[0] && x.mir === false && !x.proj.includes('mirelle_blue') && Math.abs((x.gone - x.shown) - d.n / 12 * C.FX_RT) <= 2 * C.step, JSON.stringify(x));
    const L = JSON.parse(run(CAST('blue', { left: true })));
    ck(`... and mirrored when the enemy is on her left (mirrored ${L.mir}, over ${L.on})`, L.mir === true && L.on === 'sylthaine', JSON.stringify(L));
    const y = JSON.parse(R0(CAST('blue')));
    ck('CONTROL: BASE flew the old plate as the shot (' + JSON.stringify(y.proj) + ')', y.proj.includes('mirelle_blue')); }
  { const x = casts.ult, d = F.mirelle_ult, n = x.plates.length;
    ck(`Imperial Plumage keeps the fieldWide 'both' draw (v591: the ult reaches every unit): one burst per unit - ${x.plates.filter(p => /:bar$/.test(p)).length} over ally bars, ${x.plates.filter(p => /:feet$/.test(p)).length} under enemy feet`, n === 4 && x.plates.filter(p => /:bar$/.test(p)).length === 2 && x.plates.filter(p => /:feet$/.test(p)).length === 2, JSON.stringify(x.plates));
    ck(`... playing ONCE: dur ${d.dur} fight s = ${d.n} cells at 12 fps in real time (${(d.n / 12 * C.FX_RT).toFixed(4)}), held on its empty last cell for the rest of the plate's life (gdur ${run('HERO_ULT_ART.mirelle.gdur')})`, d.hold === true && Math.abs(d.dur - d.n / 12 * C.FX_RT) < 1e-3 && run('HERO_ULT_ART.mirelle.fieldWide') === 'both'); }
  ck('hooks: the release confirms Scent (the weakest ally - the case\'s own pick) and Bouquet (the shot\'s enemy), no press start for them (atRelease), no flight for the Bouquet (noFly)',
    /\(o\.ownFx==='mcourage'\)\?_fx16Weakest\(u\):\(o\.ownFx==='msleep'\)\?_fx16Sleeper\(u,o\)/.test(src) && /FX16_ART\[ab\.ownFx\]&&!FX16_ART\[ab\.ownFx\]\.atRelease\) fx16Cast/.test(src) && /FX16_ART\[o\.ownFx\]\.noFly\)\?null:\(o\.pfx\|\|o\.gfx\)/.test(src));
  // 5. previews
  { const P = JSON.parse(run(`JSON.stringify([0,1,2].map(sl=>{ const p=skillPreviewPlan('mirelle',sl); return p?{rel:p.rel,fx:p.fx.map(e=>({k:e.k,kind:e.kind,at:e.at||null,t0:+e.t0.toFixed(4),real:e.real!=null?+e.real.toFixed(3):null}))}:null; }))`));
    const [u, g, b] = P;
    ck('Skills tab previews show the new art: Scent (fx16puff on him, from the release), Bouquet (fx16over on the target, from the landing), Plumage (over his bar / the target\'s feet): ' + JSON.stringify(P),
      g && g.fx.length === 1 && g.fx[0].kind === 'fx16puff' && Math.abs(g.fx[0].t0 - g.rel) < 1e-3 && b && b.fx.length === 1 && b.fx[0].kind === 'fx16over' && b.fx[0].at === 'target' && b.fx[0].t0 > b.rel &&
      u && u.fx.some(e => e.k === 'mirelle_ult'), JSON.stringify(P));
    const stage = fs.readFileSync(path.join(ROOT, 'assets/ui/skill-preview-stage.js'), 'utf8');
    ck('the preview stage draws fx16over and the page loads it at a new ?v= (sp' + VER + ')', /case 'fx16over': \{ const L=e\.real\|\|6;/.test(stage) && src.includes('skill-preview-stage.js?v=sp' + VER) && !baseSrc.includes('skill-preview-stage.js?v=sp' + VER)); }
  ck('no emoji added', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src.slice(src.indexOf('function _fx16Weakest'), src.indexOf('function _fx16Weakest') + 3000)));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
