// The engine's own moments for a hero (sim host, no browser, no GPU) -> the CONTACT CELL each 48 @24 action clip must draw its blow / release on.
// Timing is the engine's and the pipeline never moves it: every action clip plays 2.0 s (relFrac 0.5), so the cell is fixed by the swing / cast clock.
//   swing: the blow (melee: the hit; ranged: the shot leaving) of a 2.0 s 48-cell clip - fitted into the swing's hold (0.95 x interval) when the
//          clip is longer, natural speed otherwise (the v1162 / v1175 drawnSwing rule) -> floor(cell).
//   casts: green / blue release (the cast resolving, u._pend clears) and its landing (the last doEffect: a form delivery); ult the same.
// usage: node engine_moments.js <repo> <html | git:<sha>> <hero>
'use strict';
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os');
const [ROOT0, SRC, HERO] = process.argv.slice(2), ROOT = path.resolve(ROOT0);
let file = SRC, tmp = null;
if (SRC.startsWith('git:')) { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-em-')); fs.mkdirSync(path.join(tmp, 'server'));
  for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
    try { fs.writeFileSync(path.join(tmp, f), cp.execSync('git show ' + SRC.slice(4) + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) {}
  file = path.join(tmp, 'emberweave-heroes.html'); }
const h = require(path.join(ROOT, 'server/sim-host.js')).load(file), run = s => vm.runInContext(s, h.ctx);
const CLK = 0.6724, N = 48, FPS = 24, D = N / FPS;
const swing = JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('${HERO}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false});
  g.anim=Object.assign({},BATTLE_ANIM.${HERO}||{},{attack:{n:${N},fps:${FPS},fw:1,fh:1,cols:1,rows:${N},figH:1,feet:1,cx:1,top:0}}); e.anim=null; g.glyphCrit=0; units=[g,e];
  units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0; g.speed=0; g.target=e; g.greenCd=g.blueCd=99; g.atkCd=0;
  let st=null, free=null, mul=1, ai=0, rel=null, hit=null; const _dd=dealDamage, _sp=spawnProjFx, _ss=spawnShot;
  spawnProjFx=function(){ if(rel==null) rel=battleTime; return _sp.apply(this,arguments); }; spawnShot=function(s){ if(s===g&&rel==null) rel=battleTime; return _ss.apply(this,arguments); };
  dealDamage=function(s){ if(s===g&&hit==null) hit=battleTime; return _dd.apply(this,arguments); };
  try{ for(let i=0;i<600&&hit==null;i++){ const a0=g.attackAnim||0; updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.energy=0; e.x=540; e.y=700; g.x=500; g.y=700;
      if(st==null&&(g.attackAnim||0)>a0+1e-9){ st=battleTime; mul=g._atkSpdMul||1; ai=(g._atkI0||g.atkInterval)/mul; }
      if(st!=null&&free==null&&!((g.attackAnim||0)>0)) free=battleTime; } } finally{ dealDamage=_dd; spawnProjFx=_sp; spawnShot=_ss; }
  return JSON.stringify({st,free,mul,ai,rel:rel==null?hit:rel,hit,melee:!!g.melee,range:g.range}); })()`));
const Dm = D / swing.mul, ah = Math.min(0.95 * swing.ai, Dm), fit = Dm > ah && Dm <= ah * 1.6;
const dSwing = fit ? (swing.rel - swing.free) / CLK / ah * N : (swing.rel - swing.st) / CLK * FPS * swing.mul;
const out = { hero: HERO, swing: Object.assign(swing, { fitted: fit, cellExact: +dSwing.toFixed(2), cell: Math.floor(dSwing) }) };
for (const kind of ['green', 'blue', 'ult']) {
  const r = JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);
    const g=makeUnit('${HERO}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',540,700,30,{owned:false}); const e2=makeUnit('tick','enemy',560,740,30,{owned:false});
    g.anim=BATTLE_ANIM.${HERO}; e.anim=null; e2.anim=null; g.glyphCrit=0; units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=50;});
    [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0; g.target=e; g.greenCd=g.blueCd=99; g.hp=g.maxHp*0.5;
    const fx=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push([ty,+battleTime.toFixed(4)]); return _de.apply(this,arguments); }; g._castSM=1; g._castLv=1;
    try{ if(!KITS.${HERO}||('${kind}'!=='ult'&&!KITS.${HERO}['${kind}'])) return 'null';
      if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,KITS.${HERO}['${kind}']);
      let fired=null, pend=!!g._pend; for(let i=0;i<Math.round(4/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4); if(g._pend) pend=true; }
      return JSON.stringify({fired,fx}); } finally{ doEffect=_de; } })()`));
  if (!r) continue;
  const land = r.fx.length ? r.fx[r.fx.length - 1][1] : null;
  out[kind] = { release: r.fired, land, releaseCell: r.fired != null ? Math.floor(r.fired / CLK * FPS) : null, landCell: land != null ? Math.floor(land / CLK * FPS) : null, effects: r.fx };
}
process.stdout.write(JSON.stringify(out));
if (tmp) try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
