'use strict';
// v1309 (Phil 8 Nov 2026, asked "Make DoTs respect armor and magic resist, like every other hit" - "Yes"):
//   every damage-over-time tick (pushDot / plagueDot) and every ground-hazard tick is mitigated by the TARGET's Armor (a physical DoT) or
//   Magic Resist (a magic DoT) through defMul - the same rating, shred, pen and defToDR curve dealDamage applies to a hit of that kind.
//   Before v1309 the ticks called damage() straight: a Bitwraith Corruption tick did 100.3 against 0 and against 3000 armour / MR.
// Runs the real battle engine (server/sim-host.js), side by side with the live page (git 9dc5b320).
// CONTROL: TP_ROOT=<the live checkout (9dc5b320)> must FAIL.
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process');
const HERE = path.resolve(__dirname, '..');
const ROOT = process.env.TP_ROOT || HERE, control = !!process.env.TP_ROOT;
const LIVE_SHA = process.env.LIVE_SHA || '9dc5b320';
const liveHtml = path.join(HERE, '.test-dot1309-live-' + process.pid + '.html');   // next to this tree's hero-profiles.js etc. (unchanged since live)
fs.writeFileSync(liveHtml, cp.execFileSync('git', ['-C', HERE, 'show', LIVE_SHA + ':emberweave-heroes.html'], { maxBuffer: 1 << 28 }));
process.on('exit', () => { try { fs.unlinkSync(liveHtml); } catch (e) {} });
const load = p => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(p); return src => vm.runInContext(src, h.ctx); };
const run = load(path.join(ROOT, 'emberweave-heroes.html')), runLive = load(liveHtml);
// the older-tests rewrite (DOT_MITIGATION=false); in CONTROL the live page itself (nothing is written into the control tree)
const runUndo = control ? runLive : load(require('./helpers/global-1254-1260.js').page(path.join(ROOT, 'emberweave-heroes.html')));
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9) * Math.max(1, Math.abs(b));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const prep = `units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; if(typeof _pendingDots!=='undefined') _pendingDots.length=0;
  const mk=(k,t,x,y)=>{ const z=makeUnit(k,t,x,y,50,{owned:false,rank:3}); z.atkInterval=99; z.speed=0; z.energy=0; z.critChance=0; z.crit=0; z.glyphCrit=0; z.dodge=0; z.evaStat=0; z.blockStat=0; z.maxHp=z.hp=1e7; z.greenCd=z.blueCd=999; z.armorPen=0; z.magicPen=0; return z; };
  const D0=(D,d)=>{ D.armorRating=d.arm||0; D.mrRating=d.mr||0; D._shredT=d.shred?9:0; D._shredPct=d.shred||0; D._mrShredT=d.mrShred?9:0; D._mrShredPct=d.mrShred||0; };
  /* the silent ticks D takes (DoT / hazard), in order, as HP removed */
  const watch=(D,color)=>{ const out=[]; const _dm=damage; damage=function(u,a,c,noE){ if(u===D&&noE&&(!color||c===color)){ const h=u.hp; const r=_dm.apply(this,arguments); out.push(+(h-u.hp).toFixed(9)); return r; } return _dm.apply(this,arguments); }; return {out,off:()=>{ damage=_dm; }}; };
  const step=(s,us)=>{ for(let i=0;i<Math.round(s/SIM_STEP);i++){ us.forEach(z=>{ z.energy=0; }); updateBattle(SIM_STEP); } };
  /* dealDamage's own mitigation on a plain hit of that kind (no crit / miss / block): the reference curve */
  const hitMul=(S,D,kind)=>{ const h=D.hp; dealDamage(S,D,1000,'#123456',kind); const lost=h-D.hp; D.hp=D.maxHp; return lost/1000; };`;
try {
  // ---- 1. Bitwraith Corruption (a named curse colour -> magic): MR scales the ticks by dealDamage's MR curve, Armor does not ----
  const corr = r => JSON.parse(r(`(()=>{ ${prep} const out={};
    for(const [tag,d] of [['zero',{}],['mr',{mr:3000}],['arm',{arm:3000}],['mrShred',{mr:3000,mrShred:0.5}]]){
      const W=mk('bitwraith','enemy',700,700), D=mk('vael','ally',600,700); D0(D,d); W.target=D; units=[W,D]; const w=watch(D,'#b06bff');
      try{ W._castLv=1; doEffect(W,W.greenAb.type,W.greenAb); step(8,units); } finally{ w.off(); }
      out[tag]={ticks:w.out, lvl:D.lvl, magicHit:hitMul(W,D,'magic'), physHit:hitMul(W,D,'phys')}; }
    out.ref=1-defToDR(3000,out.zero.lvl); out.refShred=1-defToDR(1500,out.zero.lvl); return JSON.stringify(out); })()`));
  const c = corr(run), cL = corr(runLive), cU = corr(runUndo);
  const r0 = c.zero.ticks, rMr = c.mr.ticks;
  ck('Corruption ticks at all (4 ticks in 8 s)', r0.length === 4, JSON.stringify(r0));
  ck('Corruption vs 3000 MR: every tick x (1 - defToDR(3000)) - dealDamage\'s MR curve', rMr.length === r0.length && r0.every((t, i) => near(rMr[i], t * c.ref, 1e-7)), JSON.stringify({ zero: r0, mr: rMr, mul: c.ref }));
  ck('... and exactly what dealDamage takes off a magic hit on the same target', near(c.mr.magicHit, c.ref, 1e-7) && near(rMr[0] / r0[0], c.mr.magicHit, 1e-7), JSON.stringify({ tick: rMr[0] / r0[0], hit: c.mr.magicHit }));
  ck('Corruption vs 3000 Armor (0 MR): ticks unchanged (it is magic)', same(c.arm.ticks, r0), JSON.stringify(c.arm.ticks));
  ck('MR shred 50% on 3000 MR: ticks x (1 - defToDR(1500)), the shred dealDamage reads', c.mrShred.ticks.every((t, i) => near(t, r0[i] * c.refShred, 1e-7)) && near(c.mrShred.magicHit, c.refShred, 1e-7), JSON.stringify({ t: c.mrShred.ticks, mul: c.refShred }));
  ck('Corruption on 0 Armor / 0 MR: tick for tick the live numbers', same(r0, cL.zero.ticks), JSON.stringify({ now: r0, live: cL.zero.ticks }));
  ck('live: Corruption ticks are the same against 3000 MR (true damage - what v1309 changes)', same(cL.mr.ticks, cL.zero.ticks), JSON.stringify(cL.mr.ticks));
  // (the helper also puts the v1308 Corruption numbers back, so its ticks are compared with its own 0-MR ticks, not with live's)
  ck('helper undo (DOT_MITIGATION=false): Corruption ticks the same vs 3000 MR as vs 0 (pre-v1309)', cU.zero.ticks.length === 4 && same(cU.mr.ticks, cU.zero.ticks), JSON.stringify({ undo: cU.mr.ticks, zero: cU.zero.ticks }));

  // ---- 2. a physical DoT: Hollow's bleed (named bleed colour -> physical) scales with Armor and Armor Pen / shred; MR does nothing ----
  const bl = r => JSON.parse(r(`(()=>{ ${prep} const out={};
    for(const [tag,d,pen] of [['zero',{},0],['arm',{arm:2400},0],['mr',{mr:2400},0],['pen',{arm:2400},600],['shred',{arm:2400,shred:0.25},0]]){
      const S=mk('hollow','ally',600,700), D=mk('skulk','enemy',700,700); D0(D,d); S.armorPen=pen; units=[S,D]; const w=watch(D,'#8f8fa8');
      try{ addBleedStack(S,D,{}); step(7,units); } finally{ w.off(); }
      out[tag]={ticks:w.out, lvl:D.lvl, physHit:hitMul(S,D,'phys')}; }
    out.prof=HERO_TYPES.hollow.damageProfile; const L=out.zero.lvl; out.ref=1-defToDR(2400,L); out.refPen=1-defToDR(1800,L); out.refShred=1-defToDR(1800,L); return JSON.stringify(out); })()`));
  const b = bl(run), bL = bl(runLive), bU = bl(runUndo);
  ck('Hollow bleed ticks (6 in 6 s)', b.zero.ticks.length === 6, JSON.stringify(b.zero.ticks));
  ck('bleed vs 2400 Armor: every tick x (1 - defToDR(2400)) = dealDamage\'s physical hit', b.arm.ticks.every((t, i) => near(t, b.zero.ticks[i] * b.ref, 1e-7)) && near(b.arm.physHit, b.ref, 1e-7), JSON.stringify({ arm: b.arm.ticks, mul: b.ref, hit: b.arm.physHit }));
  ck('bleed vs 2400 MR: unchanged (physical)', same(b.mr.ticks, b.zero.ticks), JSON.stringify(b.mr.ticks));
  ck('the caster\'s 600 Armor Pen counts on the bleed as on his hits (2400 - 600)', b.pen.ticks.every((t, i) => near(t, b.zero.ticks[i] * b.refPen, 1e-7)) && near(b.pen.physHit, b.refPen, 1e-7), JSON.stringify({ pen: b.pen.ticks, mul: b.refPen }));
  ck('a 25% armour shred counts on the bleed as on a hit (2400 x 0.75)', b.shred.ticks.every((t, i) => near(t, b.zero.ticks[i] * b.refShred, 1e-7)) && near(b.shred.physHit, b.refShred, 1e-7), JSON.stringify({ shred: b.shred.ticks }));
  ck('bleed on 0 Armor / 0 MR: tick for tick the live numbers', same(b.zero.ticks, bL.zero.ticks), JSON.stringify({ now: b.zero.ticks, live: bL.zero.ticks }));
  ck('helper undo (DOT_MITIGATION=false): bleed vs 2400 Armor = live', same(bU.arm.ticks, bL.arm.ticks) && same(bL.arm.ticks, bL.zero.ticks), JSON.stringify({ undo: bU.arm.ticks, live: bL.arm.ticks }));

  // ---- 3. the kind rule: a plain burn follows the caster's damage profile (Magic hero -> MR; Attack hero -> Armor); a named bleed stays physical ----
  const kr = r => JSON.parse(r(`(()=>{ ${prep} const out={};
    for(const [key,col] of [['astra','#ff6a3a'],['grimsby','#ff6a3a'],['astra','#c0392b']]){ for(const [tag,d] of [['zero',{}],['arm',{arm:2000}],['mr',{mr:2000}]]){
      const S=mk(key,'ally',600,700), D=mk('skulk','enemy',700,700); D0(D,d); units=[S,D]; const w=watch(D,col);
      try{ pushDot(D,100,3,1,col,S); step(4,units); } finally{ w.off(); }
      out[key+col+tag]=w.out; } }
    out.pa=HERO_TYPES.astra.damageProfile; out.pg=HERO_TYPES.grimsby.damageProfile; out.ref=1-defToDR(2000,50); return JSON.stringify(out); })()`));
  const k = kr(run);
  const scaled = (a, z) => a.length === z.length && a.every((t, i) => near(t, z[i] * k.ref, 1e-7));
  ck('profiles: Astra ' + k.pa + ', Grimsby ' + k.pg, k.pa === 'Magic' && k.pg === 'Attack', k.pa + '/' + k.pg);
  ck('a burn from a Magic hero (Astra) is magic: MR cuts it, Armor does not', scaled(k['astra#ff6a3amr'], k['astra#ff6a3azero']) && same(k['astra#ff6a3aarm'], k['astra#ff6a3azero']), JSON.stringify([k['astra#ff6a3azero'], k['astra#ff6a3amr'], k['astra#ff6a3aarm']]));
  ck('a burn from an Attack hero (Grimsby) is physical: Armor cuts it, MR does not', scaled(k['grimsby#ff6a3aarm'], k['grimsby#ff6a3azero']) && same(k['grimsby#ff6a3amr'], k['grimsby#ff6a3azero']), JSON.stringify([k['grimsby#ff6a3azero'], k['grimsby#ff6a3aarm']]));
  ck('a named bleed is physical even from a Magic hero', scaled(k['astra#c0392barm'], k['astra#c0392bzero']) && same(k['astra#c0392bmr'], k['astra#c0392bzero']), JSON.stringify([k['astra#c0392bzero'], k['astra#c0392barm']]));

  // ---- 4. a ground hazard (ashfall patch from an Attack hero): Armor mitigates its ticks; 0 armour = live ----
  const hz = r => JSON.parse(r(`(()=>{ ${prep} const out={};
    for(const [tag,d] of [['zero',{}],['arm',{arm:2000}],['mr',{mr:2000}]]){
      const S=mk('grimsby','ally',600,700), D=mk('skulk','enemy',700,700); D0(D,d); units=[S,D]; const w=watch(D,'#ff6a3a');
      try{ S._castLv=1; doEffect(S,'ashfall',{dps:0.5,dur:3,radius:3*METER,color:'#ff6a3a'},D); step(4,units); } finally{ w.off(); }
      out[tag]=w.out; }
    out.ref=1-defToDR(2000,50); return JSON.stringify(out); })()`));
  const h = hz(run), hL = hz(runLive);
  ck('ashfall patch ticks (6 in 3 s)', h.zero.length === 6, JSON.stringify(h.zero));
  ck('ashfall vs 2000 Armor: every tick x (1 - defToDR(2000))', h.arm.length === h.zero.length && h.arm.every((t, i) => near(t, h.zero[i] * h.ref, 1e-7)), JSON.stringify({ arm: h.arm, mul: h.ref }));
  ck('ashfall vs 2000 MR: unchanged (physical caster)', same(h.mr, h.zero), JSON.stringify(h.mr));
  ck('ashfall on 0 Armor: the live ticks', same(h.zero, hL.zero), JSON.stringify({ now: h.zero, live: hL.zero }));

  // ---- 5. the shared function: dealDamage's own hits are unchanged by the extraction (live vs new, phys / magic / split / true, with pen + shreds) ----
  const dd = r => JSON.parse(r(`(()=>{ ${prep} const out=[];
    for(const kind of ['phys','magic','true',undefined]){ for(const d of [{},{arm:1500,mr:900},{arm:1500,mr:900,shred:0.3,mrShred:0.2}]){
      const S=mk('aureth','ally',600,700), D=mk('skulk','enemy',700,700); D0(D,d); S.armorPen=200; S.magicPen=100; units=[S,D];
      out.push(+hitMul(S,D,kind).toFixed(12)); } } return JSON.stringify(out); })()`));
  const dN = dd(run), dLv = dd(runLive);
  ck('dealDamage hits (phys / magic / true / split auto, pen, shreds) identical to live', same(dN, dLv), JSON.stringify({ now: dN, live: dLv }));
} catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
console.log((control ? 'CONTROL ' : '') + 'test_dot_mitigation_1309.js: ' + pass + ' passed, ' + fail + ' failed');
if (control) process.exit(fail > 0 ? 0 : 1);
process.exit(fail ? 1 : 0);
