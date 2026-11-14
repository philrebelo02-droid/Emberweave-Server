'use strict';
// v1391 (Phil 14 Nov 2026: "please buff vulmars passive, give it 5% increase ability power + .05 per skill level" / "along side the no control
// effects"): Vulmar's Unstepped (KITS.vulmar.purple, pass 'unstepped') keeps "cannot be pulled, knocked or displaced" and ALSO multiplies his
// finished Ability Power by 1 + 0.05 + 0.0005 x passive level (u.skillLv[3], 1..100): 5.05% at 1, 7.5% at 50, 10% at 100. Only from the
// quality that unlocks the passive (rank 3, Purple). The numbers are Vulmar's own kit fields (apPct / apPerLv); Orryx's boss passive
// 'unstepped' (MONSTER_KITS.orryx.pass) carries none and is unchanged. Rule 26: client heroPower == server heroCardPower.
//   1. data: KITS.vulmar.purple apPct 0.05 / apPerLv 0.0005; server/sim.js PURPLE_AP mirrors it; no other kit has the fields.
//   2. fight unit: at passive 1 / 50 / 100 apow = BASE x 1.0505 / 1.075 / 1.10, every other field of the unit and its snap = BASE.
//   3. quality gate: below rank 3 the unit is byte-identical to BASE.
//   4. he still cannot be pulled, knocked or displaced.
//   5. a still-field Gravity Sling deals exactly that much more damage.
//   6. every other hero (60 keys) and Orryx: unit and snap byte-identical to BASE at two levels.
//   7. client heroPower == server heroCardPower for Vulmar at three levels; power rises with the passive level.
//   8. texts: the passive's description and chip show 5.05% at level 1 and 10% at level 100; Orryx's texts unchanged.
// CONTROLS: each check is also run where it must fail (BASE page, a lower quality, the server mirror removed).
// BASE = de094eab69 (origin/main this change sits on). The server stand-in http gets prependListener (server.js calls it at load;
// the stand-in in tests/test_power_terms_1311.js lacks it and crashes there).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os'), Module = require('module');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE = process.env.EW_BASE || 'de094eab69';
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'vulmar1391-'));
const dirs = [BD];
process.on('exit', () => { for (const d of dirs) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server'));
  for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'hero61.js', 'world-realm.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
    fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { baseOk = false; }
const host = f => require(path.join(ROOT, 'server/sim-host.js')).load(f);
const HN = host(HTML), HB = baseOk ? host(path.join(BD, 'emberweave-heroes.html')) : null;
const run = src => vm.runInContext(src, HN.ctx), R0 = src => vm.runInContext(src, HB.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 700) : '')); } };
const J = (r, s) => JSON.parse(r(s));
const near = (a, b) => Math.abs(a - b) < 1e-12;
const WANT = { 1: 1.0505, 50: 1.075, 100: 1.10 };
const SIM = require(path.join(ROOT, 'server', 'sim.js'));

try {
  ck('BASE page (git ' + BASE + ' + its external scripts) loaded', !!HB);
  { const src = fs.readFileSync(HTML, 'utf8'); let n = 0; const bad = [];
    for (const m of src.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && !bad.length, bad.join('; '));
    let cb = 0; try { new vm.Script(src.replace("if(kit.purple.apPct!=null) u.apow*=", "if(kit.purple.apPct!=null) u.apow*=(").match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken Unstepped line', cb === 1); }

  console.log('== 1. data ==');
  const kd = J(run, `JSON.stringify({v:KITS.vulmar.purple, others:Object.keys(KITS).filter(k=>k!=='vulmar'&&KITS[k]&&['green','blue','purple'].some(s=>KITS[k][s]&&(KITS[k][s].apPct!=null||KITS[k][s].apPerLv!=null))), mon:MONSTER_KITS.orryx.pass, monAp:MONSTER_KITS.orryx.apPct===undefined})`);
  ck('KITS.vulmar.purple = Unstepped, pass unstepped, apPct 0.05, apPerLv 0.0005', kd.v.name === 'Unstepped' && kd.v.pass === 'unstepped' && kd.v.apPct === 0.05 && kd.v.apPerLv === 0.0005, kd);
  ck('no other hero kit carries apPct / apPerLv; Orryx (pass ' + kd.mon + ') has no Ability Power field', kd.others.length === 0 && kd.mon === 'unstepped' && kd.monAp, kd);
  ck('server/sim.js PURPLE_AP = the client kit fields (vulmar only)', JSON.stringify(SIM.PURPLE_AP) === JSON.stringify({ vulmar: { pct: kd.v.apPct, perLv: kd.v.apPerLv } }), SIM.PURPLE_AP);
  ck('client passApMul == server purpleApMul at 1 / 50 / 100 (= 1.0505 / 1.075 / 1.10)', [1, 50, 100].every(L => run(`passApMul(KITS.vulmar.purple,${L})`) === SIM.purpleApMul('vulmar', L) && near(SIM.purpleApMul('vulmar', L), WANT[L])));
  ck('CONTROL: BASE has none of it (no apPct, no passApMul)', R0('typeof passApMul') === 'undefined' && R0('KITS.vulmar.purple.apPct') === undefined);

  // ---------- 2/3. the fight unit ----------
  const UNIT = (r, key, lvl, rank, L, team) => J(r, `(()=>{ const u=makeUnit(${JSON.stringify(key)},'${team || 'ally'}',400,700,${lvl},{spec:{rank:${rank},skillLv:[${L},${L},${L},${L}],stars:3}}); const s=snapUnitResolved(u); const o={}; for(const k in u){ if(k==='uid') continue; o[k]=u[k]; } return JSON.stringify({u:JSON.stringify(o), s, apow:u.apow, imm:!!u.immovable, pass:u.pass}); })()`);
  const VUL = (r, lvl, rank, L) => J(r, `(()=>{ const u=makeUnit('vulmar','ally',400,700,${lvl},{spec:{rank:${rank},skillLv:[1,1,1,${L}],stars:3}}); const s=snapUnitResolved(u); const o={}; for(const k in u){ if(k==='uid') continue; o[k]=u[k]; } return JSON.stringify({u:o, s, apow:u.apow, imm:!!u.immovable, pass:u.pass}); })()`);
  const sameBut = (a, b, skip) => { const ks = new Set(Object.keys(a).concat(Object.keys(b))); const d = []; for (const k of ks) if (!skip.includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k])) d.push(k); return d; };
  const AP = {};
  console.log('== 2. fight unit ==');
  for (const lvl of [30, 100]) for (const L of [1, 50, 100]) {
    const n = VUL(run, lvl, 3, L), b = VUL(R0, lvl, 3, L), r = n.apow / b.apow;
    AP[lvl + ':' + L] = [b.apow, n.apow];
    const du = sameBut(n.u, b.u, ['apow']), ds = sameBut(n.s, b.s, ['apow']);
    ck('Vulmar L' + lvl + ' Purple, passive ' + L + ': Ability Power ' + b.apow + ' -> ' + n.apow + ' (x' + r.toFixed(6) + ' = +' + ((WANT[L] - 1) * 100).toFixed(2) + '%), every other unit and snap field = BASE', near(r, WANT[L]) && !du.length && !ds.length && n.s.apow === n.apow, { r, du, ds });
    if (lvl === 30 && L === 100) ck('CONTROL: the same check on BASE against itself fails (ratio 1)', !near(b.apow / b.apow, WANT[L])); }
  console.log('== 3. quality gate ==');
  for (const rank of [0, 1, 2]) { const n = VUL(run, 100, rank, 100), b = VUL(R0, 100, rank, 100);
    ck('Vulmar rank ' + rank + ' (passive locked), passive 100: unit and snap byte-identical to BASE (apow ' + n.apow + ')', JSON.stringify(n) === JSON.stringify(b)); }
  { const n = VUL(run, 100, 3, 100), b = VUL(R0, 100, 3, 100); ck('CONTROL: at rank 3 the same unit differs from BASE', JSON.stringify(n) !== JSON.stringify(b)); }

  console.log('== 4. still unstepped ==');
  const RESET = `units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);`;
  const HOLD = `units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0; u.atkInterval=99; u.atkCd=99; u.speed=0; u.greenCd=u.blueCd=99; u.ctrlRes=0;});`;
  const PUSH = (r, caster, ty, oExpr, rank) => J(r, `(()=>{ ${RESET} const c=makeUnit('${caster}','ally',400,700,30,{owned:false,rank:3}); const v=makeUnit('vulmar','enemy',400+2*METER,700,30,{spec:{rank:${rank},skillLv:[1,1,1,100],stars:3}});
    units=[c,v]; ${HOLD} updateBattle(SIM_STEP); const x0=v.x, y0=v.y; c._castSM=1; c._castLv=1; c._castSlot='green'; c.target=v;
    doEffect(c,'${ty}',Object.assign(${oExpr},{_arrived:true,_tgtU:v})); for(let i=0;i<Math.round(1.5/SIM_STEP);i++){ v._pullGhost=true; updateBattle(SIM_STEP); units.forEach(u=>{u.energy=0;u.atkCd=99;}); }
    return JSON.stringify({imm:!!v.immovable, un:!!(v.pass&&v.pass.unstepped), moved:+(Math.hypot(v.x-x0,v.y-y0)/METER).toFixed(3)}); })()`);
  for (const [c, ty, o, name] of [['brannus', 'knockstun', '{},KITS.brannus.green', 'Rim Breaker (knock)'], ['absalie', 'gravknot', '{},KITS.absalie.blue', 'Gravity Knot (pull)'], ['vulmar', 'tendrilpull', '{},KITS.vulmar.blue,{knockback:0}', 'Grasping Vow (drag)']]) {
    const p3 = PUSH(run, c, ty, o, 3), p2 = PUSH(run, c, ty, o, 2);
    ck(name + ' does not move a Purple Vulmar (immovable ' + p3.imm + ', unstepped ' + p3.un + ', moved ' + p3.moved + ' m)', p3.imm && p3.un && p3.moved === 0, p3);
    ck('CONTROL: ' + name + ' moves Vulmar below Purple (' + p2.moved + ' m)', !p2.imm && p2.moved > 0.2, p2); }

  console.log('== 5. Gravity Sling, still field ==');
  const SLING = (r, rank, L) => J(r, `(()=>{ ${RESET} const v=makeUnit('vulmar','ally',400,700,60,{spec:{rank:${rank},skillLv:[1,1,1,${L}],stars:3}});
    const a=makeUnit('grosk','enemy',400+4*METER,700,60,{owned:false,rank:0}), b=makeUnit('gruel','enemy',400+7*METER,700,60,{owned:false,rank:0});
    units=[v,a,b]; ${HOLD} updateBattle(SIM_STEP); a.maxHp=a.hp=b.maxHp=b.hp=1024;   /* a small power of two: the hp difference is the damage to the last bit (1e9 - d loses ~1e-7) */ const h0=[a.hp,b.hp]; v._castSM=skillMul(1); v._castLv=1; v._castSlot='green'; v.target=a;
    doEffect(v,'gravsling',Object.assign({},KITS.vulmar.green)); return JSON.stringify({d:[h0[0]-a.hp,h0[1]-b.hp], apow:v.apow}); })()`);
  for (const L of [1, 100]) { const n = SLING(run, 3, L), b = SLING(R0, 3, L);
    ck('Gravity Sling, passive ' + L + ': the slung enemy takes ' + b.d[0].toFixed(3) + ' -> ' + n.d[0].toFixed(3) + ' (x' + (n.d[0] / b.d[0]).toFixed(6) + '), the anvil x' + (n.d[1] / b.d[1]).toFixed(6), b.d[0] > 0 && b.d[1] > 0 && Math.abs(n.d[0] / b.d[0] - WANT[L]) < 1e-9 && Math.abs(n.d[1] / b.d[1] - WANT[L]) < 1e-9, [n, b]); }
  { const n = SLING(run, 2, 100), b = SLING(R0, 2, 100); ck('CONTROL: below Purple the same cast deals exactly BASE damage (' + n.d[0].toFixed(3) + ')', JSON.stringify(n) === JSON.stringify(b), [n, b]); }

  console.log('== 6. every other unit ==');
  { const keys = J(run, `JSON.stringify(Object.keys(HERO_TYPES).filter(k=>!HERO_TYPES[k].monster))`), bad = []; let n = 0;
    ck('61 hero keys', keys.length === 61 && keys.includes('vulmar'), keys.length);
    for (const key of keys) { if (key === 'vulmar') continue; for (const [lvl, L] of [[30, 30], [100, 100]]) { n++;
      const a = UNIT(run, key, lvl, 3, L), b = UNIT(R0, key, lvl, 3, L); if (a.u !== b.u || JSON.stringify(a.s) !== JSON.stringify(b.s)) bad.push(key + '@' + lvl); } }
    ck('every other hero (' + (keys.length - 1) + ' keys x 2 levels, Purple, all skills at the level = ' + n + ' units): unit and snap byte-identical to BASE', !bad.length, bad);
    const v1 = UNIT(run, 'vulmar', 100, 3, 100), v0 = UNIT(R0, 'vulmar', 100, 3, 100);
    ck('CONTROL: the same comparison sees Vulmar change', v1.u !== v0.u); }
  { const bad = []; for (const lvl of [30, 100]) { const a = UNIT(run, 'orryx', lvl, 3, lvl, 'enemy'), b = UNIT(R0, 'orryx', lvl, 3, lvl, 'enemy');
      if (a.u !== b.u || JSON.stringify(a.s) !== JSON.stringify(b.s) || !a.pass || !a.pass.unstepped) bad.push(lvl); }
    ck('Orryx (boss passive unstepped): unit and snap byte-identical to BASE at levels 30 and 100, still unstepped', !bad.length, bad); }

  console.log('== 7. card power: client == server ==');
  function loadServer(src) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-vul1391-')); dirs.push(tmp);
    process.env.DB_FILE = path.join(tmp, 'db.json'); process.env.PORT = '0';
    const http = require('http'), fakeHttp = Object.assign({}, http, { createServer: () => ({ listen() {}, on() {}, prependListener() {}, close() {}, address() { return { port: 0 }; } }) });
    const req = Module.createRequire(path.join(ROOT, 'server.js')), myReq = n => n === 'http' ? fakeHttp : req(n);
    const noop = () => ({ unref() {}, ref() {} });
    const log = console.log; console.log = () => {};
    try {
      const wrap = vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){' + src +
        '\n;return {heroCardPower,snapshotHeroFromServer,ensureLedger,ledHeroLevel,D_HERO_CUM,D_TROOP_CUM,getDB:()=>DB};})', { filename: 'server.js' });
      const m = { exports: {} };
      return wrap(m.exports, myReq, m, path.join(ROOT, 'server.js'), ROOT, noop, noop);
    } finally { console.log = log; }
  }
  const S = loadServer(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'));
  let uid = 0; const users = {};
  const sUser = (key, st) => { let u = users[key]; if (!u) { u = { id: 'vul1391-' + (++uid), name: 'V' + uid, guest: true, created: Date.now(), roster: {} }; S.getDB().users[u.id] = u; S.ensureLedger(u); users[key] = u; }
    const led = u.led; led.px = S.D_TROOP_CUM[100]; led.unlocked = led.unlocked || {}; led.unlocked[key] = true;
    led.hero[key] = { xp: S.D_HERO_CUM[st.level], stars: st.stars, pips: 0, ref: 0 }; led.skill = led.skill || {}; led.skill[key] = [1, 1, 1, st.passive];
    led.acad = { lv: { academy: 0, atk: 0, hp: 0, ap: 0, heal: 0, armor: 0, mr: 0, crit: 0, critres: 0 }, learn: {}, res: { iron: 0, crystal: 0, silver: 0, coal: 0 } };
    u.glyphs = { revision: 1, fragments: {}, subGlyphs: {}, finished: {}, boards: { [key]: { slots: [null, null, null, null, null, null], ascensionIndex: st.asc, ascended: {}, personalPathVersion: 1 } } };
    return u; };
  const cSet = (r, key, st) => r('G.playerXP=TROOP_CUM[100]; G.heroXP[' + JSON.stringify(key) + ']=HERO_CUM[' + st.level + ']; G.starLevel[' + JSON.stringify(key) + ']=' + st.stars +
    '; G.starPip=G.starPip||{}; G.starPip[' + JSON.stringify(key) + ']=0; G.starRefine=G.starRefine||{}; G.starRefine[' + JSON.stringify(key) + ']=0;' +
    'G.skillLevel=G.skillLevel||{}; G.skillLevel[' + JSON.stringify(key) + ']=[1,1,1,' + st.passive + ']; G.glyphRank=G.glyphRank||{}; G.glyphRank[' + JSON.stringify(key) + ']=' + st.asc + '; G.tech={}; G.temple=undefined;');
  const cPow = (r, key, st) => { cSet(r, key, st); return r('heroPower(' + JSON.stringify(key) + ')'); };
  const cBase = (r, key, st) => { cSet(r, key, st); return r('(()=>{ _powerNoGlyph=true; try{ return heroPower(' + JSON.stringify(key) + ')-skillPowerBonus(' + JSON.stringify(key) + '); } finally{ _powerNoGlyph=false; } })()'); };
  const sPow = (key, st) => S.heroCardPower(sUser(key, st), key);
  const STATES = [{ level: 20, stars: 3, passive: 1, asc: 6 }, { level: 56, stars: 4, passive: 50, asc: 6 }, { level: 100, stars: 5, passive: 100, asc: 6 }];
  const POW = [];
  for (const st of STATES) { const c = cPow(run, 'vulmar', st), s = sPow('vulmar', st), b = cPow(R0, 'vulmar', st); POW.push([st, b, c]);
    ck('Vulmar L' + st.level + ' ' + st.stars + '* Purple passive ' + st.passive + ': client heroPower ' + c + ' == server heroCardPower ' + s + ' (BASE card ' + b + ')', c === s && c > b, { c, s, b }); }
  { const st = STATES[2], c0 = cPow(R0, 'vulmar', st);
    const keep = SIM.PURPLE_AP.vulmar; delete SIM.PURPLE_AP.vulmar; let sOff; try { sOff = sPow('vulmar', st); } finally { SIM.PURPLE_AP.vulmar = keep; }
    ck('CONTROL: with the server mirror removed (PURPLE_AP.vulmar deleted) the server card (' + sOff + ') no longer equals the client (' + cPow(run, 'vulmar', st) + ') - it falls back to BASE ' + c0, sOff !== cPow(run, 'vulmar', st) && sOff === c0); }
  { const ratios = [1, 50, 100].map(p => { const st = { level: 100, stars: 5, passive: p, asc: 6 }; return cBase(run, 'vulmar', st) / cBase(R0, 'vulmar', st); });
    ck('the card\'s base term rises with the passive level (x' + ratios.map(x => x.toFixed(5)).join(' < x') + ' over BASE)', ratios[0] > 1 && ratios[1] > ratios[0] && ratios[2] > ratios[1], ratios);
    const st5 = { level: 100, stars: 5, passive: 100, asc: 5 };
    ck('below Purple (ascension 5): Vulmar\'s card equals BASE on the client (' + cPow(run, 'vulmar', st5) + ') and the server matches', cPow(run, 'vulmar', st5) === cPow(R0, 'vulmar', st5) && sPow('vulmar', st5) === cPow(run, 'vulmar', st5));
    ck('CONTROL: at Purple the same card differs from BASE', cPow(run, 'vulmar', STATES[2]) !== cPow(R0, 'vulmar', STATES[2])); }
  { const bad = []; for (const key of ['vael', 'aldren', 'quorrel', 'sylthaine', 'grosk']) { const st = { level: 100, stars: 5, passive: 100, asc: 6 };
      if (cPow(run, key, st) !== cPow(R0, key, st) || cPow(run, key, st) !== sPow(key, st)) bad.push(key); }
    ck('other heroes at Purple passive 100 (vael, aldren, quorrel, sylthaine, grosk): card = BASE and client = server', !bad.length, bad); }

  console.log('== 8. texts ==');
  const TX = (r, L) => J(r, `(()=>{ G.skillLevel.vulmar=[1,1,1,${L}]; return JSON.stringify({desc:skillDesc('vulmar',3), chip:_skillEffectStrRaw('vulmar',3,100,1000), tip:passDescAt(KITS.vulmar.purple,${L}), orryxGl:glPassLine('orryx','unstepped'), plain:passDescAt({pass:'unstepped'},${L}), pd:PASS_DESC.unstepped}); })()`);
  const T1 = TX(run, 1), T100 = TX(run, 100), B1 = TX(R0, 1);
  console.log('    L1   desc: ' + T1.desc + '\n    L1   chip: ' + T1.chip + '\n    L100 desc: ' + T100.desc + '\n    L100 chip: ' + T100.chip);
  ck('passive level 1: description says both effects with 5.05% and the next level 5.1%; chip +5.05% ability power', /cannot be pulled, knocked, or displaced/.test(T1.desc) && /Ability Power is 5\.05% higher/.test(T1.desc) && /next level 5\.1%/.test(T1.desc) && /cannot be pulled, knocked or displaced · \{i:t:apow\} \+5\.05% ability power$/.test(T1.chip), T1);
  ck('passive level 100: 10%, no next level; chip +10% ability power; battle tooltip line (passDescAt) the same', /Ability Power is 10% higher/.test(T100.desc) && !/next level/.test(T100.desc) && /\+10% ability power$/.test(T100.chip) && T100.tip === passDescAt100(T100), T100);
  function passDescAt100(t) { return run(`passDescAt(KITS.vulmar.purple,100)`); }
  ck('Orryx\'s glossary line and the plain unstepped line are BASE\'s ("' + T1.orryxGl + '")', T1.orryxGl === B1.orryxGl && T1.plain === B1.plain && T1.pd === B1.pd && !/Ability Power/i.test(T1.plain + T1.orryxGl));
  ck('CONTROL: BASE\'s Vulmar texts have no Ability Power ("' + B1.desc + '")', !/Ability Power/i.test(B1.desc) && !/ability power/.test(B1.chip));

  console.log('== measured ==');
  for (const k of Object.keys(AP)) console.log('  Vulmar L' + k.split(':')[0] + ' passive ' + k.split(':')[1] + ': Ability Power ' + AP[k][0] + ' -> ' + AP[k][1]);
  for (const [st, b, c] of POW) console.log('  Vulmar card L' + st.level + ' ' + st.stars + '* Purple passive ' + st.passive + ': ' + b + ' -> ' + c);
} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
})();
