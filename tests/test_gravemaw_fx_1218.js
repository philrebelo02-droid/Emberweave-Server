'use strict';
// v1218 - Grosk's Gravemaw Pull air pull (Grok take07, Phil approved 23 Oct 2026 16:01), DISPLAY ONLY:
//   grosk_gravemaw_pull_airpull_take07.mp4 (magenta plate, soft-edge despill): from the press, ONCE in real time at 12 fps; the streams' point on Grosk's
//   middle, the streams reaching the kit's 5 m pull radius on the side he faces (painted to the left of the point: mirrored when he faces right);
//   follows him; faded on an interrupted cast; the release (the form launch) confirms it. The old v33 plate stays on disk.
// CONTROL against the live build (git show BASE): casts and whole fights with Grosk are tick-identical (FX never move game logic).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const VER = process.env.EW_VER || '1218';
const BASE_SHA = process.env.EW_BASE || '09c717c7';   // live v1217, before this change
const SRC = 'C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/_fx2_accepted/grosk_gravemaw_pull_airpull_take07.mp4';
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-gm1218-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
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
function sheetProblems(d) { const bad = []; if (!d) return ['missing']; const f = fileOf(d.u);
  if (!fs.existsSync(f)) return ['missing file'];
  const sz = webpSize(f), ch = chunks(fs.readFileSync(f));
  if (d.n > d.cols * d.rows || d.n <= (d.cols - 1) * d.rows) bad.push('n does not fill its grid');
  if (d.fw * d.cols > 2048 || d.fh * d.rows > 2048) bad.push('> 2048 px');
  if (fs.statSync(f).size > 4e6) bad.push('> 4 MB');
  if (!sz || sz[0] !== d.fw * d.cols || sz[1] !== d.fh * d.rows) bad.push('file ' + sz + ' != grid');
  if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) bad.push('not a q95 lossy WebP with alpha');
  if (Math.abs(d.dur - d.n / d.fps2) > 1e-3 || !d.rt) bad.push('dur != n / fps2 or not real time');
  return bad; }
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));
/* one cast: Grosk + an ally + five enemies (three inside his 5 m pull, on his RIGHT or, with left, on his LEFT); every effect / hit / unit for 10 s */
const CAST = (opt) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123();
  const OPT=${JSON.stringify(opt || {})}, s=OPT.left?-1:1;
  const g=makeUnit('grosk','ally',600,700,30,{owned:false,rank:3}); const a=makeUnit('vael','ally',600-s*150,560,30,{owned:false});
  const E=[['tick',60,0],['sylthaine',100,60],['korvux',120,-50],['umbris',330,60],['nox',420,-20]].map(([k,dx,dy])=>{ const e=makeUnit(k,'enemy',600+s*dx,700+dy,30,{owned:false}); e._px=600+s*dx; e._py=700+dy; return e; });
  units=[g,a].concat(E); units.forEach(u=>{ try{ buildFigure(u); }catch(_e){} }); g.anim=BATTLE_ANIM.grosk; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;});
  const park=()=>{ units.forEach(x=>{ x.atkCd=99; x.greenCd=x.blueCd=99; if(x!==g) x.speed=0; }); };
  park(); for(let i=0;i<Math.round(20/SIM_STEP)&&(g._dropHidden||g.x<0||g._noTarget);i++){ updateBattle(SIM_STEP); units.forEach(x=>{ x.hp=x.maxHp; x.energy=0; }); park(); }
  g.x=600; g.y=700; g._ax=g.x; g._ay=g.y; E.forEach(e=>{ e.x=e._ax=e._px; e.y=e._ay=e._py; }); park(); g.speed=0; g.glyphCrit=0; g.target=E[0]; g._faceDir=s; g._fxMirror=OPT.left?true:false;
  const fx=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const texs=[]; const _ft=fx2Tex; fx2Tex=function(k){ if(/^grosk_/.test(k)&&FX2_DEF[k]) texs.push(FX2_DEF[k].u); return _ft.apply(this,arguments); };
  g._castSM=1; g._castLv=1; const press=battleTime;
  try{
    castKit(g,g.greenAb||KITS.grosk.green);
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; const seen=new Map(), arts=[];
    const tr=[]; for(let i=0;i<Math.round(10/SIM_STEP);i++){ if(OPT.cancel&&i===3){ castCancel(g); }
      updateBattle(SIM_STEP); park(); g.energy=0;
      const live=(typeof _fx1123!=='undefined')?_fx1123.filter(o=>o.kind==='gpull'):[];
      for(const o of live){ if(!seen.has(o)){ const r={made:+battleTime.toFixed(4),frs:[],lastFr:-1,gone:null,mir:o.mir,cut:false,ok:null}; seen.set(o,r); arts.push(r); } const r=seen.get(o);
        if(o.fr!=null&&o.fr!==r.lastFr){ r.frs.push(o.fr); r.lastFr=o.fr; } if(o.cut!=null) r.cut=true; if(o.ok&&r.ok==null) r.ok=+battleTime.toFixed(4); }
      for(const [o,r] of seen) if(r.gone==null&&!live.includes(o)) r.gone=+battleTime.toFixed(4);
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.silencedT||0).toFixed(2),u.forcedTarget?u.forcedTarget.key:'-',u.pulledBy?1:0].join(':')).join('|')); }
    return JSON.stringify({press,hold,anim,fx,trace:crypto_like(tr.join('#')),texs:[...new Set(texs)],arts,pulled:E.filter(e=>Math.abs(e.x-e._px)>0.5).map(e=>e.key)});
  } finally { doEffect=_de; fx2Tex=_ft; } })()`;
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
    let cb = 0; try { new vm.Script(html.replace('function _fx22GPull(o){', 'function _fx22GPull(o){ if( ').match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken painter', cb === 1); }
  const baseSrc = fs.readFileSync(OLD, 'utf8'), src = fs.readFileSync(HTML, 'utf8');
  { const md5 = fs.existsSync(SRC) ? crypto.createHash('md5').update(fs.readFileSync(SRC)).digest('hex').slice(0, 8) : null;
    ck('the source is the Phil-approved take07 in _fx2_accepted (md5 ' + md5 + ')', md5 === '2a20e890'); }
  const FXQ = "JSON.stringify({FX_RT,METER,SC,STEP:SIM_STEP,d:FX2_DEF.grosk_green})", F = JSON.parse(run(FXQ)), F0 = JSON.parse(R0(FXQ)), d = F.d;
  const bad = sheetProblems(d);
  ck('the sheet exists, file = declared grid, within 2048 px per side and 4 MB, q95 lossy + alpha, real time with dur = n / fps2', bad.length === 0, bad.join('; '));
  ck('a new file at ?v=' + VER + ' that BASE never referenced; the old v33 plate stays on disk', d.u === '/assets/anim/fx/grosk_gravemaw_pull_23oct.webp?v=' + VER && !baseSrc.includes('grosk_gravemaw_pull_23oct') && fs.existsSync(fileOf(F0.d.u)));
  ck('CONTROL: the sheet check catches an oversized grid', sheetProblems(Object.assign({}, d, { fw: 900 })).length >= 1);
  { const PY = cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'hollow_fx_1191_check.py'), fileOf(d.u)], { maxBuffer: 1 << 24 }).toString();
    const m = JSON.parse(PY)['grosk_gravemaw_pull_23oct.webp'];
    ck('no fringe: no magenta plate left (edge <= 0.05%, body 0) and no green cast from the despill (edge <= 0.01%, body 0): ' + PY, m.magenta_edge <= 0.05 && m.magenta_body === 0 && m.green_edge <= 0.01 && m.green_body === 0);
    ck('CONTROL: the plate mixed back into the edges reads as magenta (' + m.control_magenta_edge + '%)', m.control_magenta_edge > 20); }
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'ownFx' ? undefined : v));
  const kit = r => JSON.stringify(strip(JSON.parse(r('JSON.stringify([KITS.grosk,HERO_TYPES.grosk,ABILITY_CAST.grosk||null,BATTLE_ANIM.grosk])'))));
  ck('kit, hero stats, cast times and battle clips identical to BASE apart from the ownFx display tag (gpull)', kit(run) === kit(R0) && run('KITS.grosk.green.ownFx') === 'gpull' && R0('KITS.grosk.green.ownFx||null') === null);
  const others = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>k!=='grosk_green').map(k=>[k,FX2_DEF[k]]))");
  ck('every other FX2_DEF entry is byte-for-byte BASE', H(others(run)) === H(others(R0)));
  ck('the sheet loads with his figure (FX1123_WARM.grosk)', run('JSON.stringify(FX1123_WARM.grosk)') === '["grosk_blue","grosk_green"]');
  const STEP = F.STEP, RT = F.FX_RT, casts = {};
  for (const opt of [{}, { left: true }, { cancel: true }]) {
    const tag = opt.left ? 'L' : opt.cancel ? 'C' : 'R', x = JSON.parse(run(CAST(opt))), y = JSON.parse(R0(CAST(opt))); casts[tag] = x; casts[tag + '0'] = y;
    const pick = o => JSON.stringify([o.hold, o.anim, o.fx, o.trace, o.pulled]);
    ck(`cast ${tag}: the effects land on the same ticks (${x.fx.join(' ')}), the same enemies are pulled (${x.pulled.join(',')}) and every unit (hp, position, silence, taunt, pull) = BASE for 10 s`, pick(x) === pick(y), JSON.stringify({ now: pick(x), base: pick(y) }));
  }
  { const T = [[11, ['grosk', 'fritz', 'vael'], ['tick', 'sylthaine', 'korvux']], [23, ['grosk', 'veyr', 'lumi', 'vex', 'hobb'], ['mirelle', 'aureth', 'carn', 'oakmir', 'grosk']], [5, ['grosk', 'deepcleft'], ['umbris', 'nox', 'tick']]];
    const a = T.map(([s, x, y]) => fight(run, s, x, y)), b = T.map(([s, x, y]) => fight(R0, s, x, y));
    ck('whole fights (3 seeds, Grosk on both sides, his auto-cast Gravemaw Pull) are tick-identical to BASE', JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
    run('globalThis.__r=KITS.grosk.green.radius; KITS.grosk.green.radius*=0.5; 1'); const c = fight(run, T[0][0], T[0][1], T[0][2]); run('KITS.grosk.green.radius=globalThis.__r; 1');
    ck('CONTROL: the seed-11 fight with the pull radius halved is NOT identical (the instrument sees game logic)', c !== b[0]); }
  { const x = casts.R, A = x.arts, rel = x.fx.length ? +x.fx[0].split('@')[1] : null;
    ck(`one air pull, made at the press (${x.press}; made ${A.length ? A[0].made : '-'}), confirmed at the release (${rel}; ok ${A.length ? A[0].ok : '-'}), no old plate fetched (sheets used: ${JSON.stringify(x.texs)})`,
      A.length === 1 && Math.abs(A[0].made - x.press - STEP) <= STEP + 1e-6 && rel != null && Math.abs(A[0].ok - rel) <= STEP + 1e-6 && !x.texs.some(u => /grosk_green\.webp/.test(u)), JSON.stringify(x));
    ck(`... the whole clip once in real time (${d.n} cells, ${(d.n / d.fps2).toFixed(2)} s): cells in order to ${A.length ? A[0].lastFr : '-'}, gone after ${A.length && A[0].gone ? ((A[0].gone - A[0].made) / RT).toFixed(2) : '-'} s`,
      A.length === 1 && A[0].frs[0] === 0 && A[0].frs.every((v, i, a) => i === 0 || v >= a[i - 1]) && A[0].lastFr === d.n - 1 && Math.abs((A[0].gone - A[0].made) - d.n / d.fps2 * RT) <= 2 * STEP && !A[0].cut);
    ck('... the streams reach out on the side he faces: mirrored when he faces right (enemies right), as painted when he faces left', A.length === 1 && A[0].mir === true && casts.L.arts.length === 1 && casts.L.arts[0].mir === false);
    const C = casts.C, Ca = C.arts;
    ck(`... a cancelled cast (no release: ${C.fx.length} effects) fades it at once (cut, gone ${Ca.length ? Ca[0].gone : '-'})`, Ca.length === 1 && C.fx.length === 0 && Ca[0].cut && Ca[0].gone != null && Ca[0].gone < 0.5, JSON.stringify(C));
    const y = casts.R0;
    ck('CONTROL: BASE drew its old plate (sheets used: ' + JSON.stringify(y.texs) + ') and no air pull', y.texs.some(u => /grosk_green\.webp\?v=33/.test(u)) && y.arts.length === 0); }
  { const P = JSON.parse(run(`(()=>{ const fake=()=>({center:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},scale:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},position:{x:0,y:0,z:0,copy(p){this.x=p.x;this.y=p.y;this.z=p.z;}},_uv:[0.2,0.1,0.2,0.1],material:{}});
      const _on=_fx22On, _hd=_fx22Head; const out={}; try{ _fx22On=(u,up)=>({x:u.x/100,y:up,z:0}); _fx22Head=()=>4.5;
        for(const mir of [true,false]){ const o={kind:'gpull',s:fake(),d:FX2_DEF.grosk_green,u:{x:600,alive:true},t:0,ok:true,R:5*METER,mir}; _fx22GPull(o); out[mir?'right':'left']={W:o.s.scale.x,H:o.s.scale.y,cx:o.s.center.x,cy:o.s.center.y,uv:Math.sign(o.s._uv[0]),pos:[o.s.position.x,o.s.position.y]}; }
      } finally{ _fx22On=_on; _fx22Head=_hd; } return JSON.stringify(out); })()`));
    const R5 = 5 * F.METER * F.SC, r = P.right, l = P.left;
    ck(`the painter: the streams' reach (${d.reach} cell px) = the 5 m pull radius (${(r.W * d.reach / d.fw).toFixed(4)} = ${R5.toFixed(4)} world), their point (${d.point}) on his middle (${d.mid} x his height), mirrored (UV -, anchor 1 - point) when he faces right: ` + JSON.stringify(P),
      Math.abs(r.W * d.reach / d.fw - R5) < 1e-6 && Math.abs(l.W - r.W) < 1e-9 && Math.abs(r.cx - (1 - d.point[0])) < 1e-9 && Math.abs(l.cx - d.point[0]) < 1e-9 && r.cy === d.point[1] && r.uv < 0 && l.uv > 0 && Math.abs(r.pos[1] - d.mid * 4.5) < 1e-9 && Math.abs(r.pos[0] - 6) < 1e-9); }
  { const s = src.slice(src.indexOf('function groskPullCastFx'), src.indexOf('/* v1217 HOBB Glazebreaker'));
    ck('the painters only read the fight: no RNG, no damage, no unit state written', s.length > 500 && !/brnd\(|rng\(|Math\.random|dealDamage|ccApply|\.hp\s*=|\b(u|e)\.(x|y|target|forcedTarget|pulledBy)\s*=[^=]/.test(s));
    ck('no emoji added', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)); }
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
