// v1314 (Phil 8 Nov 2026, Magmourn): "ignite all is way too big, it should be 20 meters wide" / "fire ball should be an actual fireball
// projectile enlarged to the size of the one in his hand, when it lands it hits everyone within 5 meters of impact" / "magmourn needs 30% more
// ability power". CONTROL: live v1313 (git show 0884d29a) - Ignite All 20 m radius, Fireball a 2.4 m instant burst, Ability Power = damage.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1314-mag.html');
fs.writeFileSync(oldFile, cp.execSync('git show 0884d29a:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const R = (h, c) => vm.runInContext(c, h.ctx);
const kit = h => JSON.parse(R(h, `JSON.stringify({g:MONSTER_KITS.magmourn.green, b:MONSTER_KITS.magmourn.blue, M:METER})`));
const n = kit(NEW), o = kit(OLD);
ck('Ignite All: 20 m wide = 10 m radius', Math.abs(n.b.radius - 10 * n.M) < 1e-6, n.b.radius / n.M);
ck('Ignite All: its ground fire is drawn to the same 10 m', Math.abs(n.b.gfxR - 10 * n.M) < 1e-6, n.b.gfxR / n.M);
ck('Fireball: a real fireball projectile (deliver shot, the fireball sheet)', n.g.deliver === 'shot' && n.g.pfx === 'fireball' && n.g.pscale >= 6, n.g);
ck('Fireball: hits everyone within 5 m of impact', Math.abs(n.g.radius - 5 * n.M) < 1e-6, n.g.radius / n.M);
ck('Fireball: still aims at the weakest back-row hero', n.g.target === 'weakestBack');
// a 5 m burst in the fight: a hero 4 m from the impact is hit, one 6 m away is not
const burst = JSON.parse(R(NEW, `(function(){ units.length=0; const m=makeUnit('magmourn','enemy',900,700,30,{owned:false}); const t=makeUnit('sylthaine','ally',300,700,30,{owned:false,rank:3});
  const a=makeUnit('rhukk','ally',300+4*METER,700,30,{owned:false,rank:3}), b=makeUnit('vireo','ally',300,700+6*METER,30,{owned:false,rank:3});
  [t,a,b].forEach(x=>{ x.maxHp=x.hp=1e9; }); units.push(m,t,a,b); m.target=t; m._castSM=1; m._castLv=1;
  const o=Object.assign({},MONSTER_KITS.magmourn.green,{deliver:null,_arrived:true}); _doEffectCore(m,'fireball',o);
  return JSON.stringify({t:1e9-t.hp, near:1e9-a.hp, far:1e9-b.hp}); })()`));
ck('the burst hits the target and a hero 4 m away, not one 6 m away', burst.t > 0 && burst.near > 0 && burst.far === 0, burst);
const ap = h => JSON.parse(R(h, `(function(){ const m=makeUnit('magmourn','enemy',900,700,30,{owned:false}); return JSON.stringify({dmg:m.dmg, ap:monSkillStat(m)}); })()`));
const an = ap(NEW);
ck('Magmourn Ability Power = 130% of his damage number', Math.abs(an.ap - an.dmg * 1.3) < 1e-6, an);
ck('his card shows the +30% (level 1)', R(NEW, `statAtLevel('magmourn','bosses',1).dmg`) === Math.round(R(OLD, `statAtLevel('magmourn','bosses',1).dmg`) * 1.3), [R(NEW, `statAtLevel('magmourn','bosses',1).dmg`), R(OLD, `statAtLevel('magmourn','bosses',1).dmg`)]);
const other = h => JSON.parse(R(h, `(function(){ const m=makeUnit('nerissa','enemy',900,700,30,{owned:false}); return JSON.stringify({dmg:m.dmg, ap:monSkillStat(m)}); })()`));
ck('other magic bosses unchanged (Nerissa AP = damage)', other(NEW).ap === other(NEW).dmg, other(NEW));
ck('CONTROL: live v1313 had Ignite All at 20 m radius and a 2.4 m instant Fireball', Math.abs(o.b.radius - 20 * o.M) < 1e-6 && !o.g.deliver && Math.abs(o.g.radius - 2.4 * o.M) < 1e-6, { b: o.b.radius / o.M, g: o.g.radius / o.M });
console.log('test_magmourn_1314.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
