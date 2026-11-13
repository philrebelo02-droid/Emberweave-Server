'use strict';
// v1389 KIT BUGS (found while designing talent trees, 13 Nov 2026; each checked against the hero's blueprint in the Archive,
// Mechanics blueprints/Heroes/<name>.md). ENGINE = the code the client and the server replay both run (server/sim-host.js loads this page).
//   1. Gruel's passive text: PASS_DESC.gruel and the passive chip map's `gruel` entry carried Ceraline's wax text (the 1 Oct key rename
//      tallow->gruel renamed Living Tallow's PASS_DESC key too). Now Gruel's Gluttony: "heals 4% of max HP every second".
//   2. The Reckoning (Gruel's ult, ULT_DEF.taunt radius 6 m, blueprint "every nearby enemy", "radius=6") forced EVERY enemy on the field.
//      A radius in the data now limits the taunt; a taunt with no radius (Arena Lock, Dig In) keeps forcing every enemy.
//   3. Pellucid's Unmovable Mass (blueprint: "cannot be displaced at all"; known gap: knockstun) - the knockstun push (Rim Breaker, Scale Ram),
//      Gravity Knot's pull and Noonday Stampede's shove skipped only unstepped/unstoppable + gear immovability, not `immovable`.
//   4. Korvux's Ember Cleave (blueprint: cleave, 1.6x, radius 3.2 m; OPEN since v1125: "hits no one"): (a) the reach was measured centre to
//      centre, but a melee target stands ~3.3-3.8 m away (his reach + both bodies), so 3.2 m never touched it - now to the enemy's body edge;
//      (b) a Green/Blue cleave swung toward u._aimWX, the spot of his last AIMED ULT (never cleared for an auto caster) - now at its target.
// CONTROLS: every check that proves a fix also runs on the pre-fix page (git HEAD~ of this commit, or EW_BASE) and must FAIL there;
// a fight with none of the touched kits is tick-identical to the pre-fix page.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE = process.env.EW_BASE || '8c73e5f5';   // the commit this fix sits on (v1388 + test acceptance)
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'kit1389-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server'));
  for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'hero61.js', 'world-realm.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
    fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { baseOk = false; }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = baseOk ? load(path.join(BD, 'emberweave-heroes.html')) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 700) : '')); } };
const J = (r, s) => JSON.parse(r(s));
const RESET = `units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);`;
const HOLD = `units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0; u.atkInterval=99; u.atkCd=99; u.speed=0; u.greenCd=u.blueCd=99; u.ctrlRes=0;});`;

try {
  ck('control page (git ' + BASE + ' + its external scripts) loaded', !!R0);
  { const src = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of src.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && !bad.length, bad.join('; '));
    let cb = 0; try { new vm.Script(src.replace("case 'taunt':{const _tR=", "case 'taunt':{const _tR=(").match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken taunt line', cb === 1); }

  // ---------- 1. Gruel's passive text ----------
  const P1 = r => J(r, `JSON.stringify({pd:PASS_DESC.gruel, desc:skillDesc('gruel',3), chipSrc:(String(_skillEffectStrRaw).match(/\\bgruel:'[^\\n]{0,60}/)||[''])[0], pass:KITS.gruel.purple})`);
  const g1 = P1(run), g0 = P1(R0);
  ck('Gruel\'s passive is Gluttony (pass juggernaut) and his passive text is "heals 4% of max HP every second"', g1.pass.name === 'Gluttony' && g1.pass.pass === 'juggernaut' && /^heals 4% of max HP every second/.test(g1.desc), JSON.stringify(g1));
  ck('PASS_DESC.gruel is Gruel\'s text, no wax ("' + g1.pd + '")', g1.pd === 'heals 4% of max HP every second' && !/wax|encase/i.test(g1.pd));
  ck('the passive chip map\'s gruel entry is the self-heal, not "3 casts -> encased"', /self-heal/.test(g1.chipSrc) && !/encased/.test(g1.chipSrc), g1.chipSrc);
  ck('CONTROL: on the pre-fix page PASS_DESC.gruel is Ceraline\'s wax text', /coat of wax/.test(g0.pd) && /encased/.test(g0.chipSrc), JSON.stringify(g0));

  // ---------- 2. taunt radius ----------
  const DM = [3, 5.5, 8, 12];   // enemies at these distances (m) from the caster
  const TAUNT = (r, hk, slotExpr) => J(r, `(()=>{ ${RESET} const g=makeUnit('${hk}','ally',400,700,30,{owned:false,rank:3});
    const es=${JSON.stringify(DM)}.map((d,i)=>makeUnit(['vael','askel','sylthaine','grosk'][i],'enemy',400+d*METER,700,30,{owned:false,rank:3}));
    units=[g,...es]; ${HOLD} g._castSM=1; g._castLv=1; g._castSlot='${slotExpr[0]}'; doEffect(g,'taunt',${slotExpr[1]});
    return JSON.stringify({forced:es.map(e=>e.forcedTarget===g?1:0), t:es.map(e=>+(e.forcedTargetT||0).toFixed(2)), dr:+g.drMul.toFixed(3), R:+(((${slotExpr[1]}).radius||0)/METER).toFixed(2)}); })()`);
  const ULTO = "Object.assign({},ULT_DEF.taunt,(typeof HERO_ULT_ART!=='undefined'&&HERO_ULT_ART.gruel)||{})";
  const r1 = TAUNT(run, 'gruel', ['ult', ULTO]), r0 = TAUNT(R0, 'gruel', ['ult', ULTO]);
  ck('The Reckoning\'s data radius is 6 m (ULT_DEF.taunt), as the blueprint says', r1.R === 6, JSON.stringify(r1));
  ck('The Reckoning forces only the enemies within 6 m (at ' + DM.join(' / ') + ' m: ' + r1.forced.join('') + '), 4 s each; his damage cut is unchanged (x' + r1.dr + ')', JSON.stringify(r1.forced) === '[1,1,0,0]' && r1.t[0] === 4 && r1.t[1] === 4 && r1.dr === r0.dr, JSON.stringify([r1, r0]));
  ck('CONTROL: on the pre-fix page it forced every enemy on the field (' + r0.forced.join('') + ')', JSON.stringify(r0.forced) === '[1,1,1,1]', JSON.stringify(r0));
  for (const [hk, sl] of [['brannus', 'blue'], ['rhukk', 'blue']]) {
    const o = `Object.assign({},KITS.${hk}.${sl})`, a = TAUNT(run, hk, [sl, o]), b = TAUNT(R0, hk, [sl, o]);
    ck(hk + '\'s ' + sl + ' taunt has no radius in its data, so it still forces every enemy, the same as before (' + a.forced.join('') + ')', a.R === 0 && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.forced) === '[1,1,1,1]', JSON.stringify([a, b])); }

  // ---------- 3. immovable ----------
  const PUSH = (r, caster, ty, oExpr, victim) => J(r, `(()=>{ ${RESET} const c=makeUnit('${caster}','ally',400,700,30,{owned:false,rank:3}); const v=makeUnit('${victim}','enemy',400+2*METER,700,30,{owned:false,rank:3});
    units=[c,v]; ${HOLD} updateBattle(SIM_STEP); const x0=v.x, y0=v.y; c._castSM=1; c._castLv=1; c._castSlot='green'; c.target=v;
    doEffect(c,'${ty}',Object.assign(${oExpr},{_arrived:true,_tgtU:v}));
    return JSON.stringify({imm:!!v.immovable, moved:+(Math.hypot(v.x-x0,v.y-y0)/METER).toFixed(3), stun:+(+(v.stunned||0)).toFixed(2)}); })()`);
  for (const [c, ty, o, name] of [['brannus', 'knockstun', '{},KITS.brannus.green', 'Rim Breaker'], ['tharl', 'knockstun', '{},KITS.tharl.green', 'Scale Ram'], ['absalie', 'gravknot', '{},KITS.absalie.blue', 'Gravity Knot']]) {
    const p1 = PUSH(run, c, ty, o, 'pellucid'), p0 = PUSH(R0, c, ty, o, 'pellucid'), v1 = PUSH(run, c, ty, o, 'vael');
    ck(name + ' no longer moves Pellucid (immovable ' + p1.imm + ', moved ' + p1.moved + ' m) - he still takes the hit and its control (stun ' + p1.stun + ')', p1.imm && p1.moved === 0 && (ty !== 'knockstun' || p1.stun > 0), JSON.stringify(p1));
    ck('CONTROL: ' + name + ' moved Pellucid on the pre-fix page (' + p0.moved + ' m); a movable hero is still moved (' + v1.moved + ' m)', p0.moved > 0.2 && v1.moved > 0.2, JSON.stringify([p0, v1])); }
  // Noonday Stampede (Zahri's ult): Pellucid in her lane is struck but not shoved by the stampede. The general body-collision pass (bodies never
  // overlap, mass-weighted) is NOT a skill push and still separates bodies - the stage takes the victim out of it (_pullGhost, both pages)
  // so only the stampede's own shove is measured.
  const STAMP = (r, victim) => J(r, `(()=>{ ${RESET} const z=makeUnit('zahri','ally',300,700,30,{owned:false,rank:3}); const v=makeUnit('${victim}','enemy',300+6*METER,700+0.4*METER,30,{owned:false,rank:3}); const f=makeUnit('grosk','enemy',300+14*METER,700,30,{owned:false,rank:3});
    units=[z,v,f]; ${HOLD} updateBattle(SIM_STEP); const y0=v.y; z._castSM=1; z._castLv=1; z._castSlot='ult'; z.target=f; doEffect(z,'stampede',Object.assign({},ULT_DEF.stampede)); let hit=0;
    for(let i=0;i<Math.round(2/SIM_STEP);i++){ v._pullGhost=true; updateBattle(SIM_STEP); units.forEach(u=>{u.energy=0;u.atkCd=99;}); if(z._stampHit&&z._stampHit.has(v)) hit=1; }
    return JSON.stringify({hit, shoved:+(Math.abs(v.y-y0)/METER).toFixed(3)}); })()`);
  { const s1 = STAMP(run, 'pellucid'), s0 = STAMP(R0, 'pellucid'), sv = STAMP(run, 'vael');
    ck('Noonday Stampede strikes Pellucid but does not shove him (' + JSON.stringify(s1) + ')', s1.hit === 1 && s1.shoved < 0.05, JSON.stringify(s1));
    ck('CONTROL: the pre-fix page shoved him (' + s0.shoved + ' m); a movable hero is still shoved (' + sv.shoved + ' m)', s0.hit === 1 && s0.shoved > 0.5 && sv.shoved > 0.5, JSON.stringify([s0, sv])); }

  // ---------- 4. Ember Cleave ----------
  // staged: Korvux and a melee target at the spacing the engine holds them at (measured 3.3-3.8 m centre to centre)
  const CLV = (r, d, stale) => J(r, `(()=>{ ${RESET} const k=makeUnit('korvux','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('grosk','enemy',500+${d}*METER,700,30,{owned:false,rank:3}); const e2=makeUnit('vael','enemy',500+3*METER,700+1.2*METER,30,{owned:false,rank:3}); const far=makeUnit('lumi','enemy',500+6*METER,700,30,{owned:false,rank:3});
    units=[k,e,e2,far]; ${HOLD} k.target=e; ${stale ? 'k._aimWX=200; k._aimWY=420;' : 'k._aimWX=null; k._aimWY=null;'} const hits=[]; const _dd=dealDamage;
    dealDamage=function(s,t){ if(s===k) hits.push(t.key); return _dd.apply(this,arguments); };
    try{ k._castSM=1; k._castLv=1; k._castSlot='blue'; doEffect(k,'cleave',Object.assign({},KITS.korvux.blue,{_arrived:true,_tgtU:e})); } finally{ dealDamage=_dd; }
    return JSON.stringify({hits, cc:${d}, edge:+((${d}*METER-bodyR(e))/METER).toFixed(2)}); })()`);
  for (const d of [3.35, 3.75]) {
    const a = CLV(run, d, false), b = CLV(R0, d, false);
    ck('Ember Cleave hits the enemy in front of him at melee spacing (' + d + ' m centre to centre, ' + a.edge + ' m to its body): ' + a.hits.join(','), a.hits.includes('grosk') && !a.hits.includes('lumi'), JSON.stringify(a));
    ck('CONTROL: the pre-fix page hit nothing there (' + JSON.stringify(b.hits) + ')', b.hits.length === 0, JSON.stringify(b)); }
  { const a = CLV(run, 3.5, true), b = CLV(R0, 3.5, true);
    ck('after an aimed ult (stale aim behind him) the cleave still swings at its target: ' + a.hits.join(','), a.hits.includes('grosk'), JSON.stringify(a));
    ck('the cleave stays a 3.2 m, 45-degree arc: the enemy 6 m away is not hit', !a.hits.includes('lumi')); }
  { const K = J(run, 'JSON.stringify(Object.assign({},KITS.korvux.blue,{radius:KITS.korvux.blue.radius/METER}))'), K0 = J(R0, 'JSON.stringify(Object.assign({},KITS.korvux.blue,{radius:KITS.korvux.blue.radius/METER}))');
    ck('Ember Cleave keeps its numbers (cleave, 1.6x, 3.2 m, 7 s cooldown): no balance change', JSON.stringify(K) === JSON.stringify(K0) && K.mul === 1.6 && Math.abs(K.radius - 3.2) < 1e-9 && K.cd === 7, JSON.stringify(K)); }
  // whole fights: every Ember Cleave lands now; on the pre-fix page none did
  const FIGHT = (r, seed, a, f, probe) => J(r, `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>{ try{ buildFigure(u); }catch(_){} });
      const casts=[]; let cur=null; const _c=_doEffectCore, _dd=dealDamage;
      ${probe ? `_doEffectCore=function(u,ty,o){ if(u&&u.key==='korvux'&&ty==='cleave'&&(!o.deliver||o._arrived)){ cur={h:0}; casts.push(cur); try{ return _c.apply(this,arguments); } finally{ cur=null; } } return _c.apply(this,arguments); };
      dealDamage=function(s){ if(cur&&s&&s.key==='korvux') cur.h++; return _dd.apply(this,arguments); };` : ''}
      const tr=[]; try{ for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(',')).join(';')); } }
      finally{ _doEffectCore=_c; dealDamage=_dd; }
      let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
      return JSON.stringify({h:s.length+':'+h.toString(16), casts:casts.map(c=>c.h)}); } finally{ autoUlt=svA; window._p2guard=false; } })()`);
  const KF = [[11, ['korvux', 'grosk', 'vael'], ['brannus', 'vex', 'sylthaine', 'grosk']], [5, ['korvux', 'tharl', 'lumi'], ['pellucid', 'carn', 'astra']], [64, ['grosk', 'korvux', 'lumi'], ['vael', 'rhukk', 'nox']]];
  { let n1 = [], n0 = [];
    for (const [s, a, f] of KF) { n1 = n1.concat(FIGHT(run, s, a, f, true).casts); n0 = n0.concat(FIGHT(R0, s, a, f, true).casts); }
    ck('in 3 real fights every Ember Cleave lands (hits per cast: ' + n1.join(',') + ')', n1.length >= 4 && n1.every(x => x >= 1), JSON.stringify(n1));
    ck('CONTROL: on the pre-fix page almost every Ember Cleave in the same fights hit no one (' + n0.join(',') + ')', n0.length >= 4 && n0.filter(x => x === 0).length >= n0.length - 1, JSON.stringify(n0)); }

  // ---------- nothing else moved ----------
  for (const [s, a, f] of [[7, ['vael', 'sylthaine', 'vex'], ['grosk', 'nox', 'lumi']], [21, ['astra', 'hobb', 'vireo'], ['kharos', 'quorrel', 'veyr']]]) {
    const x = FIGHT(run, s, a, f, false), y = FIGHT(R0, s, a, f, false);
    ck('a fight with none of the touched kits (' + a.join('/') + ' v ' + f.join('/') + ', seed ' + s + ') is tick-identical to the pre-fix page', x.h === y.h, x.h + ' vs ' + y.h); }
} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log((fail ? 'FAIL' : 'PASS') + ': ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
