'use strict';
// v1150 AURETH (Phil 15 Oct 2026, relayed by ChatGPT in the AI channel): "aureth has 70% attack damage and 30% magic damage per auto,
// 1.8 seconds per auto attack swing". Basic attacks alternate arms every swing (LIGHT, DARK, LIGHT, DARK), one swing per clip; the crit is
// the both-swords X slice. The new clips are not delivered yet: the swing switches between attackLight / attackDark when they exist and
// falls back to his `attack` clip until then. This test:
//   1. SPLIT: an auto's total (the v1149 hybrid amount, unchanged) lands 70% physical + 30% magic; Armor cuts only the physical part, MR only
//      the magic part, Block halves only the physical part; one number on screen (the total), one lifesteal off the HP removed.
//   2. THROUGH THE SWING: in a real fight every Aureth auto reaches dealDamage as kind 'split' with the v1149 amount.
//   3. INTERVAL: swing 1.8 s on the fight clock = 66 ticks of SIM_STEP (was 2.4 s = 88 ticks), read off the engine's tick log.
//   4. ALTERNATION: swings go L/D/L/D (no RNG); with no attackLight/attackDark sheet the swing shows `attack`; with them it alternates the
//      two slots; a crit (with a crit clip) plays `crit` and spends that arm's turn. Clip slots with the attack's own timing change nothing.
//   5. EVERY OTHER HERO is tick-identical to v1149 in whole fights (all 59 others, Calypsa - the other hybrid - included).
//   6. CONTROLS: the split / interval / alternation checks run on v1149 must fail; the Aureth fight must differ from v1149.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '76c785c7';   // live v1149
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
let OLD = null;
try { OLD = path.join(ROOT, '.test-aureth-1150-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const t = OLD; process.on('exit', () => { try { fs.unlinkSync(t); } catch (e) {} }); } catch (e) { OLD = null; }
const BAL = require('./helpers/balance-1143-1150.js');   // v1161: the intended v1143-v1150 gameplay changes, for the BASE side of whole-fight checks
const writeTmp = (name, text) => { const f = path.join(ROOT, name); fs.writeFileSync(f, text); process.on('exit', () => { try { fs.unlinkSync(f); } catch (e) {} }); return f; };
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const J = (r, src) => JSON.parse(r(src));

try {
  // ---------------------------------------------------------------- 0. PARSE
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  const runN = load(HTML);
  ck('control file (v1149 emberweave-heroes.html from git ' + BASE_SHA + ') loaded', !!OLD);
  const runB = load(OLD);

  // ---------------------------------------------------------------- 1. SPLIT (direct hits)
  // one hit of `amt` from Aureth onto a dummy with the given ratings; crit forced off, no dodge, no shield, no other modifier
  const HIT = (r, o) => J(r, `(()=>{ state='battle'; CUR={mode:'replay',seed:1}; seedBattle(1); battleTime=0; floatTexts.length=0;
    const u=makeUnit('aureth','ally',300,600,30,{owned:false}), t=makeUnit('askel','enemy',330,600,30,{owned:false}); units=[u,t];
    u.glyphCrit=0; u.pass={}; u.lifestealStat=${o.ls || 0}; u.armorPen=0; u.magicPen=0; u.dmgBonusMul2=1; u.hp=u.maxHp*0.5;
    t.maxHp=t.hp=1e6; t.shield=0; t.evaStat=0; t.blockStat=${o.block || 0}; t.armorRating=${o.armor || 0}; t.mrRating=${o.mr || 0}; t.critRes=0; t.defenseStat=0; t.pass={};
    const lvl=t.lvl; _preCrit=false; const h0=u.hp; let lost=0, split=null;
    try{ dealDamage(u,t,${o.amt || 100},'#ffe6b0',${JSON.stringify(o.kind || 'split')}); lost=1e6-t.hp; split=t._splitLast||null; } finally{ _preCrit=null; }
    const nums=floatTexts.filter(f=>/^-\\d+$/.test(f.txt||'')).map(f=>f.txt);
    return JSON.stringify({lost, split, nums, heal:u.hp-h0, drA:defToDR(${o.armor || 0},lvl), drM:defToDR(${o.mr || 0},lvl), blocks:floatTexts.filter(f=>f.txt==='BLOCK').length}); })()`);
  const splitChecks = (r, tag) => {
    const out = [];
    const z = HIT(r, {});
    out.push([tag + 'a 0-resist target takes the whole hit (100 -> ' + z.lost.toFixed(3) + '), split 70 / 30', near(z.lost, 100) && !!z.split && near(z.split.phys, 70) && near(z.split.mag, 30)]);
    const A = HIT(r, { armor: 400 });
    out.push([tag + 'Armor 400 (DR ' + (A.drA * 100).toFixed(1) + '%) cuts only the physical 70: ' + A.lost.toFixed(3) + ' = 70x' + (1 - A.drA).toFixed(4) + ' + 30',
      near(A.lost, 70 * (1 - A.drA) + 30) && !!A.split && near(A.split.mag, 30)]);
    const M = HIT(r, { mr: 400 });
    out.push([tag + 'MR 400 (DR ' + (M.drM * 100).toFixed(1) + '%) cuts only the magic 30: ' + M.lost.toFixed(3) + ' = 70 + 30x' + (1 - M.drM).toFixed(4),
      near(M.lost, 70 + 30 * (1 - M.drM)) && !!M.split && near(M.split.phys, 70)]);
    const AM = HIT(r, { armor: 400, mr: 150 });
    out.push([tag + 'Armor 400 + MR 150: each resist on its own part (' + AM.lost.toFixed(3) + ')', near(AM.lost, 70 * (1 - AM.drA) + 30 * (1 - AM.drM))]);
    const B = HIT(r, { block: 1 });
    out.push([tag + 'a sure Block halves only the physical part (35 + 30 = ' + B.lost.toFixed(3) + ', one BLOCK)', near(B.lost, 65) && B.blocks === 1]);
    out.push([tag + 'one number on screen per hit: the total (' + JSON.stringify(A.nums) + ')', A.nums.length === 1 && A.nums[0] === '-' + Math.round(A.lost)]);
    const L = HIT(r, { armor: 400, ls: 0.2 });
    out.push([tag + 'lifesteal 20% heals off the HP the whole hit removed (' + L.heal.toFixed(3) + ' = 0.2x' + L.lost.toFixed(3) + ')', near(L.heal, 0.2 * L.lost, 1e-6)]);
    return out; };
  splitChecks(runN, '1 ').forEach(([n, ok]) => ck(n, ok));
  { const P = HIT(runN, { armor: 400, kind: 'phys' }), Mg = HIT(runN, { mr: 400, kind: 'magic' });
    ck('1 the physical / magic paths themselves are unchanged (100 phys vs Armor 400 = ' + P.lost.toFixed(3) + ', 100 magic vs MR 400 = ' + Mg.lost.toFixed(3) + ')',
      near(P.lost, 100 * (1 - P.drA)) && near(Mg.lost, 100 * (1 - Mg.drM)) && !P.split && !Mg.split); }
  ck('1 the kit carries the split: HERO_TYPES.aureth.autoSplit = {phys:0.7, mag:0.3}; no other hero has one',
    J(runN, `JSON.stringify([HERO_TYPES.aureth.autoSplit, Object.keys(HERO_TYPES).filter(k=>HERO_TYPES[k].autoSplit||HERO_TYPES[k].autoAlt)])`).toString() === [{ phys: 0.7, mag: 0.3 }, ['aureth']].toString() &&
    JSON.stringify(J(runN, `JSON.stringify(Object.keys(HERO_TYPES).filter(k=>HERO_TYPES[k].autoSplit||HERO_TYPES[k].autoAlt))`)) === '["aureth"]');
  { const sc = J(runN, `JSON.stringify([HERO_TYPES.aureth.primaryScaling, HERO_TYPES.aureth.damageProfile])`);
    ck('1 the stats panel reads "70% Attack / 30% Ability Power" (Scaling row; Damage stays Hybrid)', sc[0] === '70% Attack / 30% Ability Power' && sc[1] === 'Hybrid', JSON.stringify(sc)); }

  // ---------------------------------------------------------------- whole-fight driver
  // a replay-clock fight ticked straight through updateBattle(SIM_STEP); `rec` logs Aureth's swings and his auto hits
  const fight = (r, a, f, seed, mut) => J(r, `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true; let draws=0;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; waveXfer=null; chapterWaves=1; waveIdx=0; /* v1161: as the replay starts a fight */ seedBattle(${seed});
      const _r0=_brng; _brng=function(){ draws++; return _r0(); };
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u)); ${mut || ''}
      window._p2guard=false; const tr=[]; const sw=[]; const hits=[]; let tick=0;
      const au=units.find(u=>u.key==='aureth'); const _dd=dealDamage;
      if(au){ dealDamage=function(s,t,amt,c,kind,sil){ if(s===au&&(c==='#ffe6b0')) hits.push({tick,bt:battleTime,amt,kind:kind||null,exp:au.dmg*0.6*((au.dmgBuffT>0?au.dmgBuffMul:1))+(au.apow||0)*0.6*(au.apMul||1)}); return _dd(s,t,amt,c,kind,sil); }; }
      try{ for(; tick<30*90 && !ended; tick++){ const c0=au&&au.atkCd; updateBattle(SIM_STEP);
        if(au&&au.alive&&au.atkCd>c0+1e-9) sw.push({tick, bt:+battleTime.toFixed(5), arm:au._atkArm||null, clip:au._atkClip||null, shown:animShown(au), ai:au.atkInterval});
        tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),Math.round((u.atkCd||0)*1000)].join(',')).join('|')+'#'+draws); } }
      finally{ dealDamage=_dd; }
      return JSON.stringify({n:tr.length, h:require_hash(tr.join('\\n')), sw, hits, step:SIM_STEP, i0:au?au._atkI0:null}); } finally{ autoUlt=svA; window._p2guard=false; } })()`);
  const HASH = `globalThis.require_hash=function(s){ let h1=0x811c9dc5, h2=0x01000193; for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); h1=Math.imul(h1^c,16777619)>>>0; h2=Math.imul(h2+c,2246822519)>>>0; } return h1.toString(16)+':'+h2.toString(16)+':'+s.length; }; 1`;
  [runN, runB].forEach(r => r(HASH));
  // Aureth alone against a long-lived front line, so he swings for a while (rank 3 kit, level 30, autoUlt both sides)
  const AF = [['aureth'], ['askel', 'tharl', 'brannus'], 41];
  const fN = fight(runN, ...AF), fB = fight(runB, ...AF);
  // the interval rig: Aureth with his skills off (no Sunburst / Duality / Eclipse, energy held at 0) against one harmless dummy (no damage, no
  // skills, no passive, 10M HP), so nothing but the swing clock sits between two autos and nothing changes the amount
  const ISO = `const _hold=o=>{ o.greenAb=null; o.blueAb=null; Object.defineProperty(o,'energy',{get(){ return 0; },set(v){},configurable:true}); };
    units.forEach(o=>{ _hold(o); if(o.key!=='aureth'){ o.dmg=0; o.apow=0; o.pass={}; o.maxHp=o.hp=1e7; } });`;
  const RIG = [['aureth'], ['askel'], 41];
  const iN = fight(runN, ...RIG, ISO), iB = fight(runB, ...RIG, ISO);

  // ---------------------------------------------------------------- 2. THROUGH THE SWING
  ck('2 every Aureth auto in a real fight (full kit) reaches dealDamage as one split hit (' + fN.hits.length + ' hits)', fN.hits.length >= 8 && fN.hits.every(h => h.kind === 'split'));
  ck('2 every auto in the interval rig is one split hit of the v1149 amount, 0.6 Attack + 0.6 AP, before the 22 s rage ramp (' + iN.hits.length + ' hits, ' + (iN.hits[0] && iN.hits[0].amt) + ' each)',
    iN.hits.length >= 20 && iN.hits.every(h => h.kind === 'split') && iN.hits.filter(h => h.bt < 22).length >= 10 && iN.hits.filter(h => h.bt < 22).every(h => near(h.amt, h.exp, 1e-9)), JSON.stringify(iN.hits.filter(h => h.bt < 22 && !(h.kind === 'split' && near(h.amt, h.exp, 1e-9))).slice(0, 3)));
  ck('2 v1149 dealt the same amount as one physical hit (kind unset): the total is unchanged, only its type is split',
    iB.hits.length >= 15 && iB.hits.every(h => h.kind === null) && iB.hits.filter(h => h.bt < 22).every(h => near(h.amt, h.exp, 1e-9)) && near(iB.hits[0].amt, iN.hits[0].amt, 1e-9));

  // ---------------------------------------------------------------- 3. INTERVAL
  const gaps = s => s.slice(1).map((x, i) => x.tick - s[i].tick);
  const gN = gaps(iN.sw), gB = gaps(iB.sw), want = Math.ceil(1.8 / iN.step - 1e-9), want0 = Math.ceil(2.4 / iN.step - 1e-9);
  ck('3 swing interval = 1.8 s on the fight clock: atkInterval ' + iN.i0 + '; ' + iN.sw.length + ' swings, every gap ' + want + ' ticks x SIM_STEP ' + iN.step.toFixed(5) + ' = ' + (want * iN.step).toFixed(4) + ' s',
    iN.i0 === 1.8 && gN.length >= 20 && gN.every(g => g === want), JSON.stringify(gN));
  console.log('  info tick log (v1150, rig): swings at ticks ' + iN.sw.slice(0, 8).map(s => s.tick + '@' + s.bt + 's').join(', ') + ' ...; gaps ' + gN.slice(0, 10).join(', '));
  console.log('  info tick log (v1149, rig): swings at ticks ' + iB.sw.slice(0, 8).map(s => s.tick + '@' + s.bt + 's').join(', ') + ' ...; gaps ' + gB.slice(0, 10).join(', '));
  console.log('  info full-kit fight gaps (casts and CC only lengthen them): v1150 ' + gaps(fN.sw).join(',') + ' | v1149 ' + gaps(fB.sw).join(','));
  const minN = want, minB = Math.min(...gB);

  // ---------------------------------------------------------------- 4. ALTERNATION
  const alt = s => s.length >= 6 && s.every((x, i) => x.arm === (i % 2 ? 'attackDark' : 'attackLight'));
  ck('4 swings alternate L/D/L/D (' + fN.sw.slice(0, 8).map(s => s.arm === 'attackLight' ? 'L' : s.arm === 'attackDark' ? 'D' : '?').join('') + ')', alt(fN.sw));
  /* v1153: the clips are delivered (tests/test_aureth_anim_eleven.js) - every swing plays its arm's own sheet, a crit the X slice; the fallback is
     still checked on a copy of the page data with the two slots taken out */
  ck('4 with the v1153 sheets every swing plays its own arm (attackLight / attackDark) or, on a crit, the X slice', fN.sw.length >= 6 && fN.sw.every(s => (s.clip === s.arm && s.shown === s.arm) || (s.clip === 'crit' && s.shown === 'crit')) && fN.sw.some(s => s.shown === 'attackDark') && fN.sw.some(s => s.shown === 'attackLight'),
    fN.sw.slice(0, 6).map(s => s.arm + '/' + s.clip + '/' + s.shown).join(' '));
  { const runF = load(HTML); runF(HASH); runF('delete BATTLE_ANIM.aureth.attackLight; delete BATTLE_ANIM.aureth.attackDark; delete BATTLE_ANIM.aureth.crit; 1'); const fF = fight(runF, ...AF);
    ck('4 with no attackLight/attackDark sheet the swing falls back to his attack clip', fF.sw.length >= 6 && fF.sw.every(s => s.clip === null && s.shown === 'attack')); }
  { const fN2 = fight(runN, ...AF);
    ck('4 deterministic: the same fight twice is tick-identical (' + fN.h + ')', fN2.h === fN.h && JSON.stringify(fN2.sw) === JSON.stringify(fN.sw)); }
  // the two clip slots delivered (the attack's own timing), a crit clip delivered too; then crits forced
  const runS = load(HTML); runS(HASH);
  runS(`BATTLE_ANIM.aureth.attackLight=Object.assign({},BATTLE_ANIM.aureth.attack); BATTLE_ANIM.aureth.attackDark=Object.assign({},BATTLE_ANIM.aureth.attack); 1`);
  const fS = fight(runS, ...AF);
  ck('4 with both slots the swing plays attackLight / attackDark in turn (' + fS.sw.slice(0, 6).map(s => s.shown).join(',') + ')',
    alt(fS.sw) && fS.sw.every(s => s.clip === s.arm && s.shown === s.arm));
  ck('4 slots with the attack clip\'s own timing leave the fight tick-identical (render only)', fS.h === fN.h);
  runS(`BATTLE_ANIM.aureth.crit=Object.assign({},BATTLE_ANIM.aureth.attack); 1`);
  const fC = fight(runS, ...AF, `units.forEach(u=>{ if(u.key==='aureth'){ const _o=u; Object.defineProperty(_o,'glyphCrit',{get(){ return ((_o._armN|0)%3===2)?1:0; },set(v){},configurable:true}); } });`);
  const crits = fC.sw.filter(s => s.clip === 'crit');
  ck('4 a crit plays the crit clip and spends that arm\'s turn (' + fC.sw.slice(0, 9).map(s => s.clip === 'crit' ? 'X' : s.arm === 'attackLight' ? 'L' : 'D').join('') + ', ' + crits.length + ' crits)',
    crits.length >= 2 && alt(fC.sw) && fC.sw.every(s => s.clip === 'crit' || s.clip === s.arm));

  // ---------------------------------------------------------------- 5. EVERY OTHER HERO vs v1149
  const FIGHTS = [
    [['vex', 'grosk', 'ceraline'], ['tick', 'sloe', 'sylthaine'], 11],
    [['konwu', 'vulmar', 'hurne'], ['bloatus', 'vireo', 'fritz'], 5],
    [['vael', 'oakmir', 'rhukk'], ['umbris', 'meridian', 'gruel'], 77],
    [['astra', 'quorrel', 'korvux'], ['maren', 'lumi', 'hollow'], 31],
    [['rivet', 'carn', 'vesper'], ['tessit', 'linnet', 'calypsa'], 9],
    [['lysara', 'nerisse', 'nox'], ['seyla', 'vaelora', 'zahri'], 13],
    [['kharos', 'yenna', 'sorrel'], ['brannus', 'deepcleft', 'askel'], 17],
    [['tharl', 'hobb', 'orryn'], ['pellucid', 'mirelle', 'veyr'], 19],
    [['grimsby', 'dandra', 'pyroclast'], ['iver', 'absalie', 'joss'], 23],
    [['ambrel', 'tolley', 'mellan'], ['aldren', 'rafe', 'calypsa'], 29],
  ];
  const covered = new Set(FIGHTS.flatMap(F => F[0].concat(F[1])));
  const others = J(runN, `JSON.stringify(Object.keys(KITS).filter(k=>HERO_TYPES[k]&&!HERO_TYPES[k].monster&&k!=='aureth'))`);
  ck('5 the fights cover every hero but Aureth (' + others.length + ')', others.length === 59 && others.every(k => covered.has(k)) && !covered.has('aureth'), others.filter(k => !covered.has(k)).join(','));
  /* v1161 re-baseline: v1150 also shipped the summon-level fix (cf3bf0c4: a summon takes its owner's fight level), which moves the two summoner
     fights (seed 5 Hurne's pack, seed 29 Tolley / Mellan) on purpose - so the comparison file is v1149 + that one change (tests/helpers/
     balance-1143-1150.js, copied from its commit); every other difference from v1149 still fails this check. The controls in 6 keep plain v1149. */
  const runB5 = load(writeTmp('.test-aureth-1150-base-summon.html', BAL.withChanges(fs.readFileSync(OLD, 'utf8'), ['v1150-summon-level']))); runB5(HASH);
  /* v1160: Veyr and Deepcleft got their first crit clips, so by the v532 crit-clip rule their crit is rolled at the wind-up (same chance, earlier in
     the RNG stream); the comparison file's Veyr / Deepcleft get a crit clip with their OLD attack timing (render data only, tests/helpers/anim-1160.js) */
  require('./helpers/anim-1160.js').critRule1160(runB5);
  const res = FIGHTS.map(F => ({ F, n: fight(runN, ...F), b: fight(runB5, ...F) }));
  const same = res.filter(x => x.n.h === x.b.h && x.n.n > 100);
  ck('5 whole fights without Aureth are tick-identical to v1149 + the v1150 summon-level fix (hp/x/y/alive/energy/atkCd + RNG draws, ' + res.reduce((s, x) => s + x.n.n, 0) + ' ticks)',
    same.length === FIGHTS.length, res.filter(x => !same.includes(x)).map(x => x.F[2] + ':' + x.n.h + '/' + x.b.h).join(' '));
  { const runBR = load(OLD); runBR(HASH); require('./helpers/anim-1160.js').critRule1160(runBR);   // plain v1149 (+ the same v1160 crit-clip rule)
    const moved = res.filter(x => x.b.h !== fight(runBR, ...x.F).h).map(x => x.F[2]);
    ck('5 CONTROL: plain v1149 differs in exactly the summoner fights the summon-level fix moves (seeds ' + moved.join(',') + ')', moved.join() === '5,29', moved.join()); }

  // ---------------------------------------------------------------- 6. CONTROLS (v1149 must fail every new check)
  const cs = splitChecks(runB, '');
  ck('6 CONTROL: the split checks run on v1149 fail (' + cs.filter(c => !c[1]).length + ' of ' + cs.length + ' fail; the armor check among them)', !cs[1][1] && !cs[2][1]);
  ck('6 CONTROL: v1149 swings every ' + minB + ' ticks (' + (minB * iB.step).toFixed(4) + ' s), not 1.8 s - the interval check fails on it', iB.i0 === 2.4 && !gB.every(g => g === want) && gB.every(g => g === want0));
  ck('6 CONTROL: v1149 does not alternate arms', !alt(fB.sw));
  ck('6 CONTROL: the Aureth fight differs from v1149 (' + fN.h + ' vs ' + fB.h + ')', fN.h !== fB.h);

  // ---------------------------------------------------------------- numbers for the report
  const N = J(runN, `(()=>{ const u=makeUnit('aureth','ally',0,0,1,{owned:false}); const tot=u.dmg*0.6+(u.apow||0)*0.6*(u.apMul||1); const lv=1;
    const ticks=Math.ceil(1.8/SIM_STEP-1e-9), ticks0=Math.ceil(2.4/SIM_STEP-1e-9); const iv=ticks*SIM_STEP, iv0=ticks0*SIM_STEP;
    const row=(arm,mr)=>{ const dA=defToDR(arm,lv), dM=defToDR(mr,lv); return {old:+(tot*(1-dA)).toFixed(2), now:+(tot*(0.7*(1-dA)+0.3*(1-dM))).toFixed(2), dA:+(dA*100).toFixed(1), dM:+(dM*100).toFixed(1)}; };
    const z=row(0,0), h=row(1200,0), hm=row(1200,1200);
    return JSON.stringify({dmg:u.dmg, apow:u.apow, tot:+tot.toFixed(2), iv:+iv.toFixed(4), iv0:+iv0.toFixed(4), ticks, ticks0, z, h, hm,
      dps:{z0:+(z.old/iv0).toFixed(2), z1:+(z.now/iv).toFixed(2), h0:+(h.old/iv0).toFixed(2), h1:+(h.now/iv).toFixed(2), hm0:+(hm.old/iv0).toFixed(2), hm1:+(hm.now/iv).toFixed(2)}}); })()`);
  console.log('  info L1 Aureth: Attack ' + N.dmg + ', AP ' + N.apow + ' -> auto total ' + N.tot + ' (0.6 Attack + 0.6 AP, unchanged) = ' + (N.tot * 0.7).toFixed(2) + ' phys + ' + (N.tot * 0.3).toFixed(2) + ' magic');
  console.log('  info interval: v1149 swing 2.4 = ' + N.ticks0 + ' ticks = ' + N.iv0 + ' s fight clock; v1150 swing 1.8 = ' + N.ticks + ' ticks = ' + N.iv + ' s');
  console.log('  info per auto / DPS, 0-resist:            v1149 ' + N.z.old + ' / ' + N.dps.z0 + '   v1150 ' + N.z.now + ' / ' + N.dps.z1);
  console.log('  info per auto / DPS, Armor 1200 (' + N.h.dA + '% DR), MR 0: v1149 ' + N.h.old + ' / ' + N.dps.h0 + '   v1150 ' + N.h.now + ' / ' + N.dps.h1);
  console.log('  info per auto / DPS, Armor 1200 + MR 1200 (' + N.hm.dM + '% DR each): v1149 ' + N.hm.old + ' / ' + N.dps.hm0 + '   v1150 ' + N.hm.now + ' / ' + N.dps.hm1);
} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
