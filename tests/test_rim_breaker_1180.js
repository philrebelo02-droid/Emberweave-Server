'use strict';
// v1180 - RIM BREAKER (Brannus's green), Phil 16 Oct 2026:
//   "it should be thrown at the furthest person within 10 meters, and strikes anyone along the way, stunning them" (the coordinator's defaults: the
//   furthest LIVING enemy within 10 m at the release, else the target it had; the shot's 16 m/s; every enemy whose body - its hit radius e.r - the
//   line passes through takes the full Rim Breaker hit and the 1.2 s stun once, when the wheel reaches it; the far enemy last, on the shot's own
//   arrival; if it falls in flight, the v886 rule: the nearest enemy within 1.5 m of it, else nothing) - ENGINE, the code the client and the server
//   replay both run (sim-host loads this page).
//   "it needs to be treated like a projectile, gliding, not rolling on the ground" - DISPLAY: the wheel leaves his hand on the release, fully opaque
//   from its first frame, glides in a straight line to the target's chest on the shot's own flight time (it lands on the engine's hit tick),
//   spinning, mirrored to the left. Same wheel art.
// CONTROLS: the same line without the pierce hits one; a fight without Brannus is BASE tick for tick; the browser run of a Brannus fight is the
// server replay's tick for tick (the BROWSER section needs playwright; it runs under the GPU lock with the other browser tests).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), os = require('os'), net = require('net');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '1199aafe';   // live v1178 (Brannus + Quorrel), the build this change sits on
const VER = process.env.EW_RIM_VER || '1180';
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'rim-base-'));
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
// a staged Rim Breaker: Brannus at (500,700), the enemies where given (held there every tick), his target `tg`; every hit and stun he lands, the
// shot's flight time, and (new page) the glide art he starts
const RIM = (pos, tg, pre) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123(); ${pre || ''}
  const g=makeUnit('brannus','ally',500,700,30,{owned:false,rank:3}); const P=${JSON.stringify(pos)}; const es=P.map((p,i)=>makeUnit(['vael','askel','sylthaine','grosk'][i],'enemy',p[0],p[1],30,{owned:false,rank:3}));
  units=[g,...es]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0; u.atkInterval=99; u.atkCd=99; u.speed=0; u.greenCd=u.blueCd=99; u.ctrlRes=0;}); g.target=es[${tg}]; if(globalThis.__kill!=null) es[globalThis.__kill].hp=1;
  const hits=[], cc=[], hz=[]; const _dd=dealDamage, _cc=ccApply, _dl=deliverLaunch;
  dealDamage=function(s,t,a){ if(s===g) hits.push([t.key,+battleTime.toFixed(4)]); return _dd.apply(this,arguments); };
  ccApply=function(s,t,k,d){ if(s===g) cc.push([t.key,k,+battleTime.toFixed(4),+(+d).toFixed(3)]); return _cc.apply(this,arguments); };
  deliverLaunch=function(u,ty,o){ const n0=groundHazards.length; const r=_dl.apply(this,arguments); if(u===g) hz.push(groundHazards.slice(n0).map(x=>+x.delay.toFixed(4))); return r; };
  g._castSM=1; g._castLv=1; let rel=null, pend=false, glide=null;
  try{ castKit(g,KITS.brannus.green); pend=!!g._pend;
    for(let i=0;i<Math.round(3/SIM_STEP);i++){ updateBattle(SIM_STEP); g.atkCd=99; g.greenCd=g.blueCd=99; g.x=g._ax=500; g.y=g._ay=700;
      es.forEach((e,j)=>{ if(globalThis.__kill!=null&&j===globalThis.__kill&&rel!=null&&e.alive&&battleTime>rel+0.05){ e.hp=0; e.alive=false; } if(e.alive){ e.x=e._ax=P[j][0]; e.y=e._ay=P[j][1]; } });
      if(pend&&!g._pend&&rel==null) rel=+battleTime.toFixed(4);
      const o=(typeof _fx1123!=='undefined')?_fx1123.find(q=>q.kind==='fx16glide'&&q.u===g):null; if(o&&!glide) glide={t:+battleTime.toFixed(4),dur:+o.dur.toFixed(4),fr:o.fr,op:o.s&&o.s.material?o.s.material.opacity:null,T:o.T&&o.T.key,dir:o.dir}; if(glide&&!o&&glide.gone==null) glide.gone=+battleTime.toFixed(4); }
  } finally { dealDamage=_dd; ccApply=_cc; deliverLaunch=_dl; globalThis.__kill=null; }
  return JSON.stringify({rel,hits,cc,hz,glide,r:es.map(e=>e.r),d:es.map(e=>+(Math.hypot(e.x-500,e.y-700)/METER).toFixed(2))}); })()`;
const FIGHT = (seed, a, f, c0) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
  try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
    units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
    ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
    units.forEach(u=>{ try{ buildFigure(u); }catch(_){} }); let casts=0; const _dl=deliverLaunch; deliverLaunch=function(u,ty,o){ if(u&&u.key==='brannus'&&ty==='knockstun') casts++; return _dl.apply(this,arguments); };
    const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ ${c0 ? "units.forEach(u=>{ u.glyphCrit=0; });" : ''} updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.stunned||0).toFixed(2)].join(':')).join('|')); }
    deliverLaunch=_dl; let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return JSON.stringify({h:s.length+':'+h.toString(16),casts}); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
const fight = (f, s, a, e, c0) => JSON.parse(load(f)(FIGHT(s, a, e, c0)));
let FXD = null;
const BRF = [[['brannus', 'askel', 'vex'], ['grimsby', 'vesper', 'grosk', 'sloe'], 11], [['tharl', 'brannus', 'lumi'], ['quorrel', 'nox', 'kharos'], 64], [['brannus', 'hobb'], ['pellucid', 'veyr', 'carn', 'astra'], 5]];

const tests = async () => {
  ck('control file (BASE page + its own external scripts from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  const src = fs.readFileSync(HTML, 'utf8');
  { let n = 0, bad = [];
    for (const m of src.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; '));
    let cb = 0; try { new vm.Script(src.replace('function _fx22GlideTick(o){', 'function _fx22GlideTick(o){ if( ').match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken painter', cb === 1); }
  // 1. the kit and its text
  const K = JSON.parse(run('JSON.stringify(KITS.brannus.green)')), K0 = JSON.parse(R0('JSON.stringify(KITS.brannus.green)')), M = +run('METER');
  const strip = o => { const c = Object.assign({}, o); delete c.pierce; delete c.desc; return JSON.stringify(c); };
  ck('Rim Breaker keeps its numbers (1.5x knockstun, 1.2 s stun, 1.6 m push, 8 s cooldown, the 16 m/s shot) and gains pierce {range: 10 m}', strip(K) === strip(K0) && K.pierce && K.pierce.range === 10 * M && K.mul === 1.5 && K.stun === 1.2 && !K0.pierce, JSON.stringify({ K, K0 }));
  ck('the skill text says what it does now, in plain words: "' + K.desc + '"', /furthest enemy within 10 m/.test(K.desc) && /every enemy it passes through/.test(K.desc) && !/first enemy struck/.test(K.desc));
  ck('the hero panel stat line names the path', /to every enemy on its path/.test(run("(()=>{ try{ return String(_skillEffectStrRaw('brannus',1,100,1000)); }catch(e){ return String(e.message); } })()")) && /\(ab\.pierce\?' to every enemy on its path':''\)/.test(src));
  // 2. the engine
  const L3 = JSON.parse(run(RIM([[560, 700], [640, 700], [720, 700]], 0)));
  const order = L3.hits.map(x => x[0]), st = L3.cc.filter(c => c[1] === 'stunned');
  ck(`three enemies in a line (${L3.d.join(' / ')} m): all three hit once, in order ${order.join(', ')}, at ${L3.hits.map(x => x[1]).join(' / ')} s, each stunned (${st.map(c => c[0] + '@' + c[2]).join(' ')}), the far one on the shot's own arrival`,
    JSON.stringify(order) === '["vael","askel","sylthaine"]' && L3.hits[0][1] < L3.hits[1][1] && L3.hits[1][1] < L3.hits[2][1] && st.length === 3 && st.map(c => c[0]).join() === order.join() &&
    Math.abs(L3.hits[2][1] - (L3.rel + Math.max(0.12, Math.min(0.8, (220) / (16 * M))))) <= 0.04, JSON.stringify(L3));
  ck('each enemy on the path is struck when the wheel reaches it: its distance along the line at 16 m/s after the release (' + L3.hz[0].join(' / ') + ' s)',
    Math.abs(L3.hits[0][1] - L3.rel - 60 / (16 * M)) <= 0.04 && Math.abs(L3.hits[1][1] - L3.rel - 140 / (16 * M)) <= 0.04, JSON.stringify(L3));
  const OFF = JSON.parse(run(RIM([[560, 700], [640, 700 + 18 + 6], [720, 700]], 0)));
  ck('an enemy just off the line (its body 6 units clear of it) is not hit: ' + OFF.hits.map(x => x[0]).join(', '), JSON.stringify(OFF.hits.map(x => x[0])) === '["vael","sylthaine"]', JSON.stringify(OFF));
  const ON = JSON.parse(run(RIM([[560, 700], [640, 700 + 18 - 4], [720, 700]], 0)));
  ck('CONTROL: the same enemy with the line through its body edge (4 units inside its hit radius) is hit', JSON.stringify(ON.hits.map(x => x[0])) === '["vael","askel","sylthaine"]', JSON.stringify(ON));
  const FAR = JSON.parse(run(RIM([[560, 700], [740, 820]], 0)));
  ck(`the furthest within 10 m (${FAR.d[1]} m) beats the closer current target (${FAR.d[0]} m, off the line): only it is hit and stunned`, JSON.stringify(FAR.hits.map(x => x[0])) === '["askel"]' && FAR.cc.length === 1 && FAR.cc[0][0] === 'askel', JSON.stringify(FAR));
  const NONE = JSON.parse(run(RIM([[900, 700], [1100, 700]], 0)));
  ck(`nobody within 10 m (${NONE.d.join(' / ')} m): the shot goes to the current target as before (hit ${NONE.hits.map(x => x.join('@')).join(' ')})`, JSON.stringify(NONE.hits.map(x => x[0])) === '["vael"]', JSON.stringify(NONE));
  { const B3 = JSON.parse(R0(RIM([[560, 700], [640, 700], [720, 700]], 0)));
    ck('CONTROL: on BASE (no pierce) the same line hits only the target it had (' + B3.hits.map(x => x[0]).join(', ') + ')', JSON.stringify(B3.hits.map(x => x[0])) === '["vael"]', JSON.stringify(B3)); }
  const KILL = JSON.parse(run(RIM([[560, 700], [640, 700], [720, 700]], 0, 'globalThis.__kill=2;')));
  ck('the far enemy falls in flight: the ones on the path are still struck, then the v886 rule (the nearest enemy within 1.5 m of where it fell, else nothing): ' + KILL.hits.map(x => x[0]).join(', '), JSON.stringify(KILL.hits.map(x => x[0])) === '["vael","askel"]', JSON.stringify(KILL));
  { const a = run(RIM([[560, 700], [640, 700], [720, 700]], 0)), b = run(RIM([[560, 700], [640, 700], [720, 700]], 0));
    ck('seeded: the same staged cast twice is the same hits on the same ticks', a === b); }
  // 3. whole fights
  { const NB = [[['askel', 'vesper', 'seyla'], ['vael', 'tick', 'lumi'], 11], [['nox', 'sorrel', 'umbris'], ['pellucid', 'veyr', 'oakmir'], 222], [['korvux', 'rafe', 'kharos'], ['hobb', 'hurne', 'quorrel'], 5]];
    ck('whole fights without Brannus are tick-for-tick BASE', NB.every(([a, f, s]) => fight(HTML, s, a, f).h === fight(OLD, s, a, f).h)); }
  { const res = BRF.map(([a, f, s]) => [fight(HTML, s, a, f, 1), fight(OLD, s, a, f, 1)]);
    ck('whole fights WITH Brannus: he casts Rim Breaker in each (' + res.map(r => r[0].casts).join(' / ') + ' casts) and the new throw changes ' + res.filter(([n, o]) => n.h !== o.h).length + ' of ' + res.length + ' fights against BASE', res.every(([n]) => n.casts > 0) && res.some(([n, o]) => n.h !== o.h));
    const again = BRF.map(([a, f, s]) => fight(HTML, s, a, f, 1).h);
    ck('and they are deterministic: the same seed twice gives the same fight', again.every((h, i) => h === res[i][0].h)); }
  {
    const r2 = BRF.map(([a, f, s]) => { const r = load(HTML); r('delete KITS.brannus.green.pierce; 1'); return JSON.parse(r(FIGHT(s, a, f, 1))).h; });
    ck('CONTROL: the same fights with the pierce taken off are BASE tick for tick (the display change moves nothing)', r2.every((h, i) => h === fight(OLD, BRF[i][2], BRF[i][0], BRF[i][1], 1).h)); }
  // 4. the glide (display)
  const G = JSON.parse(run('JSON.stringify({d:FX2_DEF.brannus_green,a:FX16_ART.bgreen,FX_RT})')), d = G.d;
  ck('FX16: Rim Breaker is a glide - no press start (atRelease), started at the shot\'s launch (atLaunch), the old plate never flies (noFly); same wheel sheet as v1178',
    G.a.mode === 'glide' && G.a.atRelease === true && G.a.atLaunch === true && G.a.noFly === true && d.u === '/assets/anim/fx/brannus_rim_breaker_16oct.webp?v=1178');
  ck('it starts on the release (the shot\'s launch, ' + L3.rel + ' s) and flies exactly the shot\'s flight time (' + (L3.glide && L3.glide.dur) + ' = ' + L3.hz[0][L3.hz[0].length - 1] + ' s), toward the far enemy (' + (L3.glide && L3.glide.T) + ')',
    !!L3.glide && Math.abs(L3.glide.t - L3.rel) <= 1e-6 && Math.abs(L3.glide.dur - L3.hz[0][L3.hz[0].length - 1]) < 1e-4 && L3.glide.T === 'sylthaine', JSON.stringify(L3.glide));
  ck('it is gone the tick the far enemy is struck (gone ' + (L3.glide && L3.glide.gone) + ', hit ' + L3.hits[2][1] + ')', !!L3.glide && L3.glide.gone != null && Math.abs(L3.glide.gone - L3.hits[2][1]) <= 0.03, JSON.stringify(L3.glide));
  ck('it starts on a whole-wheel cell (cell ' + (L3.glide && L3.glide.fr) + ' of ' + d.glide.c0 + '-' + d.glide.c1 + '; cells 0-1 are the grow-in) - its opacity is checked in the browser below',
    !!L3.glide && L3.glide.fr === d.glide.c0 && d.glide.c0 >= 2 && d.wc.length >= d.glide.c1 + 1);
  { const cs = JSON.parse(run(RIM([[560, 700], [640, 700], [720, 700]], 0, '')).replace(/x/g, 'x')), B3c = JSON.parse(R0(RIM([[560, 700]], 0))).cc;
    ck('each stun is BASE Rim Breaker\'s own (' + B3c.map(c => c[3] + ' s').join() + ' at this level, from the kit\'s 1.2 s)', L3.cc.every(c => c[1] === 'stunned' && c[3] === B3c[0][3]) && B3c.length === 1, JSON.stringify({ L3: L3.cc, B3c })); }
  { const Pv = JSON.parse(run(`JSON.stringify((skillPreviewPlan('brannus',1)||{fx:[]}).fx.map(e=>({k:e.k,kind:e.kind,t0:+e.t0.toFixed(4),dur:e.dur!=null?+e.dur.toFixed(4):null})))`));
    const stage = fs.readFileSync(path.join(ROOT, 'assets/ui/skill-preview-stage.js'), 'utf8');
    ck('Skills tab preview: the same glide from the release to the target (fx16glide, ' + JSON.stringify(Pv) + '), drawn by the stage (?v=sp' + VER + ')', Pv.length === 1 && Pv[0].kind === 'fx16glide' && Pv[0].dur > 0 && /case 'fx16glide': \{ const D=e\.dur/.test(stage) && src.includes('skill-preview-stage.js?v=sp' + VER), JSON.stringify(Pv)); }
  FXD = d;
  ck('no emoji added', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src.slice(src.indexOf('function rimGlideFx'), src.indexOf('function rimGlideFx') + 3000)));
  // 5. BROWSER: the client runs the same Brannus fight as the server replay (sim-host), tick for tick
  let chromium = null; try { ({ chromium } = require(path.join(ROOT, 'node_modules/playwright'))); } catch (e) {}
  if (!chromium || process.env.EW_NO_BROWSER) { console.log('  info no playwright here - the browser replay check runs with the browser tests'); return; }
  const port = await new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const db = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rim-db-')), 'db.json');
  const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: db }, stdio: 'ignore', windowsHide: true });
  let b;
  try {
    for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch (_) {} await new Promise(r => setTimeout(r, 250)); }
    b = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
    const p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await p.addInitScript(() => { try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (e) {} });
    await p.goto(`http://127.0.0.1:${port}/play`, { waitUntil: 'load', timeout: 90000 });
    await p.waitForFunction(() => typeof makeUnit === 'function' && typeof updateBattle === 'function', null, { timeout: 90000 });
    const web = []; for (const [a, f, s] of BRF) web.push(JSON.parse(await p.evaluate(FIGHT(s, a, f, 1))));
    const P = JSON.parse(await p.evaluate(`(()=>{ const _spr=_fx22Spr; const mk=()=>({center:new TH.Vector2(),scale:new TH.Vector3(),position:new TH.Vector3(),material:{rotation:0,opacity:0},_uv:[0.16,0.08,0.3,0.4]});
      const out=[], up=new TH.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      try{ _fx22Spr=function(){ return mk(); };
        const g=makeUnit('brannus','ally',500,700,30,{owned:false}); const hd=_fx22Head(g);
        for(const tx of [800,200]){ const T=makeUnit('vael','enemy',tx,700,30,{owned:false}); const o=rimGlideFx(g,T,0.5); const r={tx,hd,dir:o.dir,p0:[+o.P0.x.toFixed(3),+o.P0.y.toFixed(3),+o.P0.z.toFixed(3)],want0:[+(wx(500)+o.dir*FX2_DEF.brannus_green.glide.fwd*hd+up.x*FX2_DEF.brannus_green.glide.up*hd).toFixed(3),+(0.05+up.y*FX2_DEF.brannus_green.glide.up*hd).toFixed(3)],tw:+wx(tx).toFixed(3),pts:[]};
          for(const k of [0,0.25,0.5,0.999]){ o.t=k*o.dur; _fx22GlideTick(o); r.pts.push([k,+o.s.position.x.toFixed(3),+o.s.position.y.toFixed(3),+o.s.material.rotation.toFixed(3),o.fr,+o.s.center.x.toFixed(3),o.s._uv[0]>0?1:-1,o.s.material.opacity]); }
          o.t=o.dur; r.end=_fx22GlideTick(o); _fx1123.splice(_fx1123.indexOf(o),1); out.push(r); }
      } finally{ _fx22Spr=_spr; }
      return JSON.stringify(out); })()`));
    const [R, Lf] = P, gl = FXD.glide;
    const onLine = r => r.pts.every(([k, x, y]) => Math.abs(x - (r.p0[0] + (r.tw - r.p0[0]) * k)) < 1e-2 && Math.abs(y - (r.p0[1] + (gl.chest - r.p0[1]) * k)) < 1e-2);
    ck('BROWSER: it leaves his hand (' + gl.fwd + ' x his height in front of his feet, ' + gl.up + ' x up - the held wheel on the release frame) and glides in a STRAIGHT line to the target\'s chest (world Y ' + gl.chest + ', where projectiles fly): ' + JSON.stringify(R.pts),
      Math.abs(R.p0[0] - R.want0[0]) < 1e-2 && Math.abs(R.p0[1] - R.want0[1]) < 1e-2 && onLine(R) && onLine(Lf), JSON.stringify(P));
    ck('BROWSER: fully opaque from its first frame (opacity ' + R.pts.map(q => q[7]).join(' / ') + ') - no fade-in', R.pts.every(q => q[7] === 1) && Lf.pts.every(q => q[7] === 1));
    ck('BROWSER: it never drops to roll: its height runs straight from the hand to the chest (' + R.pts.map(q => q[2]).join(' -> ') + '), no arc, no ground', R.pts.every((q, i, a) => i === 0 || (q[2] - a[i - 1][2]) * (gl.chest - R.p0[1]) >= -1e-9) && R.pts.every(q => q[2] >= Math.min(gl.chest, R.p0[1]) - 1e-3 && q[2] <= Math.max(gl.chest, R.p0[1]) + 1e-3));
    ck('BROWSER: it spins the whole way (rotation ' + R.pts.map(q => q[3]).join(' / ') + ' plus the art\'s own roll), each cell anchored on its own wheel centre (wc) so the painted travel never shows', R.pts[1][3] !== R.pts[0][3] && R.pts[2][3] !== R.pts[1][3] && R.pts.every(q => Math.abs(q[5] - FXD.wc[q[4]][0]) < 1e-3));
    ck('BROWSER: mirrored when thrown to the left (UV window and anchor), the spin reversed: ' + JSON.stringify(Lf.pts[0]), Lf.dir === -1 && Lf.pts.every(q => q[6] === -1 && Math.abs(q[5] - (1 - FXD.wc[q[4]][0])) < 1e-3) && Math.sign(Lf.pts[1][3]) === -Math.sign(R.pts[1][3]) && R.pts.every(q => q[6] === 1));
    ck('BROWSER: and it ends on arrival (the tick returns -1 once the flight time is up)', R.end === -1 && Lf.end === -1);
    const srvH = BRF.map(([a, f, s]) => fight(HTML, s, a, f, 1));
    ck('BROWSER: the client\'s run of the Brannus fights (' + web.map(w => w.casts + ' casts').join(' / ') + ') is the server replay\'s tick for tick (' + web.map(w => w.h).join(' ') + ')', web.every((w, i) => w.h === srvH[i].h && w.casts > 0), JSON.stringify({ web, srvH }));
  } finally { try { if (b) await b.close(); } catch (e) {} srv.kill(); }
};
tests().then(() => { console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : '')); if (fail) process.exitCode = 1; })
  .catch(e => { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; });
})();
