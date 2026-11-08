// v1311 (Phil 8 Nov 2026: "check this game wide, for effects accidentally earning multiple gains") - the three scaling doubles the audit
// proved in the engine: Vireo's Grand Symphony heal (+ the Perfect Pitch shield it feeds) and Mellan's Hivemind bee heal grew with
// skillMul^2 (apB carries the skill multiplier AND healMul is scaled by skillScaleOpts); Grimsby's Compound Interest stretched a plague
// DoT twice (plagueDot, then pushDot). CONTROL: the live v1310 page (git show 67ecbab6) shows each double.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const ck = (n, c, x) => { if (c) { PASS++; console.log('  ok   ' + n); } else { FAIL++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + x : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1311-dbl.html');
fs.writeFileSync(oldFile, cp.execSync('git show 67ecbab6:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const SETUP = `var __log=[]; healFrom=function(s,t,a){ __log.push(['heal',a]); }; healUnit=function(t,a){ __log.push(['heal',a]); };
  dealDamage=function(s,t,a){ __log.push(['dmg',a]); }; spawnBeeHive=function(u,plan,cfg){ __log.push(['hive',cfg.heal]); };
  function __cast(key,lv,type){ units.length=0; const u=makeUnit(key,'ally',300,300,60), a=makeUnit('vireo','ally',320,300,60), e=makeUnit('mellan','enemy',500,300,60);
    units.push(u,a,e); u.target=e; __log=[]; u._castSM=skillMul(lv); u._castLv=lv; u._castSlot='ult';
    _doEffectCore(u,type,Object.assign({},ULT_DEF[type],HERO_ULT_ART[key]||{})); const h=__log.find(x=>x[0]==='heal'||x[0]==='hive'); return h?h[1]:null; }
  function __dot(lv,sec){ units.length=0; _pendingDots.length=0; const g=makeUnit('grimsby','ally',300,300,60); g.skillLv=[1,1,1,lv]; g.pass={debtaura:true};
    const e=makeUnit('mellan','enemy',350,300,60); e.dots=[]; units.push(e,g); plagueDot(e,10,sec,1,'#ff8844',g); if(_pendingDots.length) updatePendingDots(1);
    return e.dots[0].remaining; }`;
for (const h of [NEW, OLD]) vm.runInContext(SETUP, h.ctx);
const R = (h, c) => vm.runInContext(c, h.ctx);
const ratio = (h, k, t) => R(h, `__cast('${k}',100,'${t}')`) / R(h, `__cast('${k}',1,'${t}')`);
const SM100 = R(NEW, 'skillMul(100)');
console.log('== ult heals scale with the skill level ONCE (x' + SM100.toFixed(3) + ' from level 1 to 100) ==');
ck('Vireo Grand Symphony heal L100/L1 = skillMul(100)', Math.abs(ratio(NEW, 'vireo', 'symphony') - SM100) < 1e-6, ratio(NEW, 'vireo', 'symphony'));
ck('Mellan Hivemind bee heal L100/L1 = skillMul(100)', Math.abs(ratio(NEW, 'mellan', 'hivemind') - SM100) < 1e-6, ratio(NEW, 'mellan', 'hivemind'));
ck('level-1 heals unchanged vs live (Vireo, Mellan)', Math.abs(R(NEW, "__cast('vireo',1,'symphony')") - R(OLD, "__cast('vireo',1,'symphony')")) < 1e-9 && Math.abs(R(NEW, "__cast('mellan',1,'hivemind')") - R(OLD, "__cast('mellan',1,'hivemind')")) < 1e-9);
ck('CONTROL: live v1310 Vireo heal grew with skillMul^2', Math.abs(ratio(OLD, 'vireo', 'symphony') - SM100 * SM100) < 1e-6, ratio(OLD, 'vireo', 'symphony'));
ck('CONTROL: live v1310 Mellan bee heal grew with skillMul^2', Math.abs(ratio(OLD, 'mellan', 'hivemind') - SM100 * SM100) < 1e-6, ratio(OLD, 'mellan', 'hivemind'));
console.log('== Grimsby Compound Interest stretches a DoT once ==');
const want = lv => Math.round(10 * (1 + R(NEW, `SKLV.debtaura(${lv})`)));
ck('10 s plague DoT near Grimsby, passive L1 = ' + want(1) + ' ticks', R(NEW, '__dot(1,10)') === want(1), R(NEW, '__dot(1,10)'));
ck('10 s plague DoT near Grimsby, passive L100 = ' + want(100) + ' ticks', R(NEW, '__dot(100,10)') === want(100), R(NEW, '__dot(100,10)'));
ck('CONTROL: live v1310 stretched it twice (L1 > ' + want(1) + ')', R(OLD, '__dot(1,10)') > want(1), R(OLD, '__dot(1,10)'));
console.log('test_double_gain_1311.js: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
