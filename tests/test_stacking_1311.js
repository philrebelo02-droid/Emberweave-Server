// v1311 (Phil 8 Nov 2026: "check this game wide, for effects accidentally earning multiple gains") - the stacking classes the audit proved:
// 1) five shields added to the pool with no timer, so recasts piled up for the whole wave (Linnet/Joss lastbreath, Iver Thunder Guard,
//    Askel March, Mirelle Imperial Plumage; Trail of Splendor stacks by design but had no timer);
// 2) an expired buff's multiplier stayed on the unit and seeded the next, weaker buff (Math.max(old,new));
// 3) control resist: a second overlapping cast overwrote the bonus slot, so expiry left a permanent bonus.
// CONTROL: the live v1310 page (git show 67ecbab6) shows each.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const ck = (n, c, x) => { if (c) { PASS++; console.log('  ok   ' + n); } else { FAIL++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1311-stk.html');
fs.writeFileSync(oldFile, cp.execSync('git show 67ecbab6:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const SETUP = `function __team(){ units.length=0; const u=makeUnit('askel','ally',300,300,60), a=makeUnit('linnet','ally',320,300,60), e=makeUnit('grosk','enemy',500,300,60);
    units.push(u,a,e); u.target=e; return {u,a,e}; }
  function __shield(caster,type,n,tick){ const T=__team(); const c=caster==='self'?T.u:makeUnit(caster,'ally',310,300,60); if(caster!=='self') units.push(c);
    const tgt=(type==='thornguard')?c:T.a; const out=[];
    for(let i=0;i<n;i++){ c._castSM=1; c._castLv=1; c._castSlot='blue'; const o=Object.assign({},ULT_DEF[type]||{},(KITS[caster]&&(KITS[caster].blue||{}).type===type)?KITS[caster].blue:{},HERO_ULT_ART[caster]||{});
      _doEffectCore(c,type,o); out.push(Math.round(tgt.shield)); }
    for(let t=0;t<tick;t+=0.1) updateStatusTimers?updateStatusTimers(tgt,0.1):null; return {casts:out, after:Math.round(tgt.shield), T:tgt.shieldT}; }`;
for (const h of [NEW, OLD]) vm.runInContext(SETUP, h.ctx);
const R = (h, c) => vm.runInContext(c, h.ctx);
// shields: cast 3 times directly, the pool must not grow past one cast and must carry a timer
// the audit's setup (t2): a wounded ally (lastbreath picks the weakest), a harmless far-away dummy, 3 casts, then 20 s of battle ticks
const pool = (h, name, caster, kind, self, N) => JSON.parse(R(h, `(function(){ units.length=0; const C=makeUnit('${caster}','ally',300,300,50,{}),
    A=makeUnit('rhukk','ally',320,300,50,{}), E=makeUnit('ooznik','enemy',3000,300,1,{}); E.dmg=0; E.maxHp=E.hp=1e12; units.push(C,A,E); A.hp=A.maxHp*0.3;
  const ab=${kind === 'ult'}?HERO_TYPES['${caster}'].ability:KITS['${caster}'].blue.type;
  const o=${kind === 'ult'}?Object.assign({},ULT_DEF[ab]||{},HERO_ULT_ART['${caster}']||{}):Object.assign({},KITS['${caster}'].blue);
  const W=${self}?C:A; for(let i=0;i<${N};i++) _doEffectCore(C,ab,Object.assign({},o));
  for(let i=0;i<20;i++) _updateBattleCore(0.05);   // 1 s: a delivered effect (Imperial Plumage, deliver:'form') lands when its art arrives
  const s1=Math.round(W.shield||0), T=W.shieldT||0; for(let i=0;i<380;i++) _updateBattleCore(0.05);
  return JSON.stringify({shield1s:s1, T, after20s:Math.round(W.shield||0)}); })()`));
console.log('== shields refresh with a timer, never pile up ==');
for (const [name, caster, kind, self] of [['Linnet Reinforced Seam', 'linnet', 'blue', false], ['Joss Sanctuary Guard', 'joss', 'blue', false],
    ['Iver Thunder Guard', 'iver', 'blue', true], ['Askel March (ult)', 'askel', 'ult', false], ['Mirelle Imperial Plumage (ult)', 'mirelle', 'ult', false]]) {
  const n1 = pool(NEW, name, caster, kind, self, 1), n3 = pool(NEW, name, caster, kind, self, 3), o1 = pool(OLD, name, caster, kind, self, 1), o3 = pool(OLD, name, caster, kind, self, 3);
  ck(name + ': 3 casts give the same shield as 1, with a timer, gone after 20 s', n1.shield1s > 0 && n3.shield1s === n1.shield1s && n3.T > 0 && n3.after20s === 0, { n1, n3 });
  ck('CONTROL: live v1310 ' + name + ': 3 casts gave ~3x and it never expired', o1.shield1s > 0 && o3.shield1s >= o1.shield1s * 2.5 && o3.after20s > 0, { o1, o3 });
}
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
ck('Trail of Splendor still stacks (by design) but now sets the timer', /a\.shield=\(a\.shield\|\|0\)\+a\.maxHp\*0\.04\*\(u\.passMul\|\|1\); a\.shieldT=Math\.max/.test(html));
console.log('== an expired buff multiplier is reset ==');
const stale = h => JSON.parse(R(h, `(function(){ const T=__team(); const a=T.a; a.hasteMul=1.6; a.hasteT=0.05; a.dmgBuffMul=1.5; a.dmgBuffT=0.05; a.drMul=0.5; a.drT=0.05;
  for(let i=0;i<3;i++) _updateBattleCore(0.05); return JSON.stringify({h:a.hasteMul,d:a.dmgBuffMul,r:a.drMul}); })()`));
let staleN, staleO; try { staleN = stale(NEW); staleO = stale(OLD); } catch (e) { staleN = { err: String(e).slice(0, 120) }; }
ck('haste / damage buff / damage-reduction multipliers return to 1 when their timer ends', staleN && staleN.h === 1 && staleN.d === 1 && staleN.r === 1, staleN);
ck('CONTROL: live v1310 kept the expired multipliers', staleO && staleO.h === 1.6 && staleO.d === 1.5 && staleO.r === 0.5, staleO);
console.log('== control-resist bonus: one at a time, expiry removes what was added ==');
const ctrl = h => JSON.parse(R(h, `(function(){ const T=__team(); const a=T.a; a.ctrlRes=0.1; const base=a.ctrlRes;
  const s=(amt,dur)=>{ if(typeof ctrlBonusSet==='function') ctrlBonusSet(a,amt,dur,0.85); else { a.ctrlRes=Math.min(0.85,(a.ctrlRes||0)+amt); a._ctrlBonusT=dur; a._ctrlBonus=amt; } };
  s(0.25,6); s(0.25,6); const peak=a.ctrlRes; for(let i=0;i<80;i++) think(a,0.1); return JSON.stringify({base,peak:+peak.toFixed(3),after:+a.ctrlRes.toFixed(3)}); })()`));
let cN, cO; try { cN = ctrl(NEW); cO = ctrl(OLD); } catch (e) { cN = { err: String(e).slice(0, 120) }; }
ck('two overlapping +0.25 casts give +0.25 (not +0.50) and expiry returns to the base', cN && Math.abs(cN.peak - 0.35) < 1e-9 && Math.abs(cN.after - cN.base) < 1e-9, cN);
ck('CONTROL: live v1310 left a permanent bonus after expiry', cO && cO.after > cO.base + 0.2, cO);
console.log('== Veyr Weightless Predator: dodge crit resets every wave (Phil 8 Nov: "no reset it per wave") ==');
const veyr = h => JSON.parse(R(h, `(function(){ units.length=0; const C=makeUnit('veyr','ally',300,300,50,{spec:{key:'veyr',level:50,stars:5,rank:5}}),
    E=makeUnit('ooznik','enemy',3000,300,1,{}); E.dmg=0; E.maxHp=E.hp=1e12; units.push(C,E); const base=C.glyphCrit||0;
  for(let i=0;i<10;i++){ C._evadeT=5; C._evadeMul=0; dealDamage(E,C,1); }
  const peak=C.glyphCrit||0; try{ buildEnemyWave(); }catch(e){} return JSON.stringify({base:+base.toFixed(3),peak:+peak.toFixed(3),nextWave:+(C.glyphCrit||0).toFixed(3)}); })()`));
let vN, vO; try { vN = veyr(NEW); vO = veyr(OLD); } catch (e) { vN = { err: String(e).slice(0, 160) }; }
ck('10 real dodges raise his crit within the wave', vN && vN.peak > vN.base + 0.2, vN);
ck('the next wave starts him back at his own crit', vN && Math.abs(vN.nextWave - vN.base) < 1e-9, vN);
ck('CONTROL: live v1310 carried the dodge crit into the next wave', vO && vO.nextWave > vO.base + 0.2, vO);
console.log('test_stacking_1311.js: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
