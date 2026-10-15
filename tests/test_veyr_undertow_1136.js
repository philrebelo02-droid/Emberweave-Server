'use strict';
// v1136 - Veyr's own ult, Abyssal Undertow (Phil 14 Oct 2026: "rename astras, rename and change veyrs").
//   Veyr ran Absalie's exact eventhorizon code under the name Event Horizon (and Astra's gravcrush carried the same name).
//   Now: Astra = "Collapsing Star" (name only); Veyr = "Abyssal Undertow" - the same drag (7 m, 1.2 s pull) and the same damage (AP x1.9),
//   but the collapse SLOWS 2 s instead of silencing. Absalie keeps Event Horizon (silence) untouched.
// Checked against BASE (git show of v1135, the release before) through server/sim-host.js (the file the server replays with):
//   - scripted ult: Veyr's caught enemies are slowed 2 s (through the game-wide CC cut, ccDur = x0.70 -> 1.4 s in the fight, like every CC) and NOT silenced; Absalie's are silenced, as in BASE; damage per hit identical to BASE;
//   - whole fights without Veyr are tick-for-tick identical to BASE;
//   - CONTROL: run with EW_HTML=<BASE file> and the slow check fails (BASE silences).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '5a515dc5';   // v1135, main before this change
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-veyr-base-control.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
const R0 = OLD ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };

// scripted ult: caster at (500,700), three dummies 120-200 px away, nobody attacks; cast the ult, step 4 s.
// returns every ult-window hit by the caster [tick, amount] and per enemy the most silence / slow it carried.
const ULT = key => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(13);
  const c=makeUnit('${key}','ally',500,700,30,{owned:false,rank:3});
  const es=[makeUnit('vael','enemy',640,700,30,{owned:false}),makeUnit('umbris','enemy',660,760,30,{owned:false}),makeUnit('tick','enemy',620,640,30,{owned:false})];
  units=[c].concat(es); units.forEach(u=>{ u.anim=null; u.maxHp=u.hp=1e9; u.energy=0; u.greenCd=u.blueCd=99; u.atkCd=99; u.atkInterval=99; });
  es.forEach(e=>{ e.speed=0; }); c.target=es[0];
  const hits=[], _dd=dealDamage, mx=es.map(()=>({sil:0,slow:0}));
  dealDamage=function(s,t,amt){ if(s===c) hits.push([+battleTime.toFixed(4),Math.round(amt*1000)/1000,t.key]); return _dd.apply(this,arguments); };
  try{
    c.energy=100; castAbility(c);
    for(let i=0;i<Math.round(4/SIM_STEP);i++){ updateBattle(SIM_STEP); units.forEach(u=>{ u.atkCd=Math.max(u.atkCd,9); u.greenCd=u.blueCd=99; if(u!==c) u.energy=0; });
      es.forEach((e,j)=>{ mx[j].sil=Math.max(mx[j].sil,e.silencedT||0); mx[j].slow=Math.max(mx[j].slow,e.slow||0); }); }
    return JSON.stringify({hits,mx,name:HERO_TYPES['${key}'].abilityName});
  } finally { dealDamage=_dd; } })()`;
const trace = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');

try {
  ck('control file (BASE emberweave-heroes.html from git) loaded', !!R0, 'git show failed');
  const names = run("JSON.stringify([HERO_TYPES.veyr.abilityName,HERO_TYPES.astra.abilityName,HERO_TYPES.absalie.abilityName,HERO_TYPES.veyr.ability,HERO_TYPES.astra.ability,HERO_TYPES.absalie.ability])");
  ck('names: Veyr "Abyssal Undertow", Astra "Collapsing Star", Absalie keeps "Event Horizon"; abilities unchanged (eventhorizon / gravcrush / eventhorizon)',
    names === JSON.stringify(['Abyssal Undertow', 'Collapsing Star', 'Event Horizon', 'eventhorizon', 'gravcrush', 'eventhorizon']), names);
  ck('Veyr\'s ult text names Abyssal Undertow and the slow, not a silence', /Abyssal Undertow/.test(run('HERO_ULT_DESC.veyr')) && /slowed/.test(run('HERO_ULT_DESC.veyr')) && !/silenc/i.test(run('HERO_ULT_DESC.veyr')));
  const mv = run("abilityMeta('veyr',0)"), ma = run("abilityMeta('absalie',0)");
  ck('skill card control line: Veyr "Slow 1.4s (area)" and no Silence; Absalie keeps "Silence 1.05s (area)"', /Slow 1\.4s \(area\)/.test(mv) && !/Silence/.test(mv) && /Silence 1\.05s \(area\)/.test(ma) && !/Slow/.test(ma), mv + ' | ' + ma);

  const v = JSON.parse(run(ULT('veyr'))), v0 = R0 && JSON.parse(R0(ULT('veyr')));
  const a = JSON.parse(run(ULT('absalie'))), a0 = R0 && JSON.parse(R0(ULT('absalie')));
  ck('the scripted ult catches all three dummies (Veyr and Absalie)', v.hits.length >= 3 && a.hits.length >= 3 && new Set(v.hits.map(h => h[2])).size === 3, JSON.stringify({ v: v.hits, a: a.hits }));
  const want = +run('ccDur(2)'), tick = +run('SIM_STEP');   // 2 s through the game-wide CC cut (CC_NERF 0.70, v818) like every CC: 1.4 s in the fight
  ck('SLOW: Veyr\'s collapse slows every caught enemy ccDur(2 s) = ' + want.toFixed(2) + ' s (within one tick)', Math.abs(want - 1.4) < 1e-9 && v.mx.every(m => m.slow >= want - tick - 1e-9 && m.slow <= want + 1e-9), JSON.stringify(v.mx));
  ck('Veyr\'s collapse does NOT silence', v.mx.every(m => m.sil === 0), JSON.stringify(v.mx));
  ck('Absalie\'s Event Horizon still silences every caught enemy and does not slow', a.mx.every(m => m.sil > 0 && m.slow === 0), JSON.stringify(a.mx));
  ck('Veyr\'s damage: every hit on the same tick with the same amount as BASE', v0 && JSON.stringify(v.hits) === JSON.stringify(v0.hits), JSON.stringify({ now: v.hits, base: v0 && v0.hits }));
  ck('Absalie\'s ult: hits, silence and slow identical to BASE', a0 && JSON.stringify([a.hits, a.mx]) === JSON.stringify([a0.hits, a0.mx]));
  ck('BASE Veyr silenced (what changed): BASE caught enemies carry silence, no slow', v0 && v0.mx.every(m => m.sil > 0 && m.slow === 0), JSON.stringify(v0 && v0.mx));

  const fights = [[['absalie', 'astra', 'vex'], ['vael', 'absalie', 'grosk'], 11], [['astra', 'pellucid', 'askel'], ['rhukk', 'absalie', 'vael'], 222], [['absalie', 'sloe', 'umbris'], ['astra', 'hurne', 'vex'], 5]];
  ck('whole fights without Veyr (Absalie and Astra on both sides) are tick-for-tick identical to BASE', R0 && fights.every(([x, f, s]) => trace(run, s, x, f) === trace(R0, s, x, f)));
  const vf = [['veyr', 'askel', 'vex'], ['vael', 'umbris', 'grosk'], 11];
  const same = R0 && trace(run, vf[2], vf[0], vf[1]) === trace(R0, vf[2], vf[0], vf[1]);
  ck('CONTROL: a whole fight WITH Veyr differs from BASE (the trace sees his ult change)', R0 && !same);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
