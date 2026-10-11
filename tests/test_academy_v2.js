// Academy v2 (11 Oct 2026, Phil): "remove defense, reduce crit should be 10% crit and 10% crit res at level 60, scale down from there /
// ability power and attack damage should be equal stats while leveling / add healing and shielding at level 60 should be 10% increased
// healing and shielding"; "Crit resist% reduces crit damage % not crit%" (SUBTRACTIVE: +60% crit damage vs 10% crit resist = +50%);
// "tanks however can gain defense stat this reduces crit chance%" (a Defense RATING, 20 = 1%, cap 60%: crit chance minus Defense).
// 1. tracks: the 8 stat tracks are atk hp ap heal armor mr crit critres (no def) on server ACAD_TRACKS, client TECH_TRACKS, both tables.
// 2. bases: atk = ap = 0.78, crit / critres / heal 0.8404, hp 10, armor / mr 0.13; at track 60 crit / critres / heal = 200 rating = 10%;
//    atk == ap at every level 0..60. Prints the table at 1 / 10 / 30 / 37 / 60.
// 3. heal track: the server unit (acadApply + heroCombatStats) gains healPow +0.10 and shieldStr +0.10 at 60; the client unit built
//    from the server spec gains healPowMul / shieldStrMul x1.10, and the resolved snapshot keeps both; the client's own helpers agree.
// 4. crit resist 10% = crit bonus +60% -> +50% (x1.50); 0% -> x1.60; resist above the bonus floors at x1.00 - server core and client
//    dealDamage give the same multiplier.
// 5. Defense: 30% crit vs 0 Defense = 30% of rolls crit, vs 200 (10%) = 20%, vs 800 (40%) = 0% - server core and client equal;
//    a Defense rating reaches the unit on both sides (combat-core buildUnit r.defense, client makeUnit spec tt.defense).
// 6. old saves: an account holding lv.def 60 and a pending / finished learn.def loads and collects without error, def is cancelled
//    (lv.def unchanged, gives nothing), the heal track is researchable at once (live server).
// Control: the same checks run against v1122 (git show ebd45c1a) and must FAIL. Asserts, non-zero exit.
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const BASE_REF = process.env.AV2_BASE || 'ebd45c1a';
let pass = 0;
const ok = (c, m) => { assert(c, m); pass++; console.log('  ok ' + m); };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);
const TRACKS = ['atk', 'hp', 'ap', 'heal', 'armor', 'mr', 'crit', 'critres'];
const WANT = { atk: 0.78, hp: 10, ap: 0.78, heal: 0.8404, armor: 0.13, mr: 0.13, crit: 0.8404, critres: 0.8404 };

/* ---- one source set (current tree, or v1122 for the control) ---- */
function sources(ref) {
  if (!ref) return { srv: fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), htmlPath: path.join(ROOT, 'emberweave-heroes.html'),
    core: require('../server/combat-core.js'), SIM: require('../server/sim.js') };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-acadv2-ctl-'));
  const show = f => execFileSync('git', ['show', ref + ':' + f], { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8');
  fs.mkdirSync(path.join(dir, 'server'));
  for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'hero_base.json', 'server/temple-of-ash.js', 'server/patron-benefits.js',
    'server/temple-effects.js', 'server/combat-core.js', 'server/sim.js']) {
    try { fs.writeFileSync(path.join(dir, f), show(f)); } catch (e) { /* a file the ref did not have */ } }
  return { srv: show('server.js'), htmlPath: path.join(dir, 'emberweave-heroes.html'), core: require(path.join(dir, 'server/combat-core.js')),
    SIM: require(path.join(dir, 'server/sim.js')), dir };
}
function serverAcademy(srv) {
  const a = srv.indexOf('const TECH_MAX_SRV='), b = srv.indexOf('function learnDurSrv', a);
  const c = srv.indexOf('function acadCombat(u)'), d = srv.indexOf('/* ---- v250', c);
  assert(a > 0 && b > a && c > 0 && d > c, 'server Academy blocks found');
  const ctx = vm.createContext({ Math });
  vm.runInContext(srv.slice(a, b) + '\n' + srv.slice(c, d) + '\n;this.out={TECH_BASE_SRV,TECH_GROWTH_SRV,ACAD_TRACKS,acadCombatOf,acadApply,techFlatSrv};', ctx);
  return ctx.out;
}

/* every check returns [name, passed, detail]; the current tree must pass all, v1122 must fail the Academy v2 ones */
function checks(src) {
  const out = [], add = (n, c, d) => out.push([n, !!c, d || '']);
  const S = serverAcademy(src.srv), SIM = src.SIM, CORE = src.core;
  const host = require('../server/sim-host.js').load(src.htmlPath);
  const run = e => vm.runInContext(e, host.ctx);
  const lv = (L, only) => { const o = { academy: L }; TRACKS.concat(['def']).forEach(k => { o[k] = (!only || only === k) ? L : 0; }); return { lv: o }; };

  /* 1. tracks */
  const st = S.ACAD_TRACKS.filter(k => k !== 'academy'), ct = JSON.parse(run('JSON.stringify(TECH_TRACKS.map(t=>t[0]))'));
  add('the 8 tracks are ' + TRACKS.join(' ') + ' on the server and the client, no def', JSON.stringify(st) === JSON.stringify(TRACKS) && JSON.stringify(ct) === JSON.stringify(TRACKS), 'server ' + st + ' / client ' + ct);
  const hrow = JSON.parse(run('JSON.stringify((TECH_TRACKS.find(t=>t[0]==="heal")||[]).slice(2,4))')), crow = JSON.parse(run('JSON.stringify((TECH_TRACKS.find(t=>t[0]==="critres")||[]).slice(2,4))'));
  add('Healing & Shielding row ("Healing and shield strength"); Crit Resist reads "Reduces critical damage taken"', hrow[0] === 'Healing & Shielding' && hrow[1] === 'Healing and shield strength' && /^Reduces critical damage taken/.test(crow[1] || ''), JSON.stringify([hrow, crow]));
  const CB = JSON.parse(run('JSON.stringify(TECH_BASE)'));
  add('bases ' + JSON.stringify(WANT) + ' on both tables', JSON.stringify(CB) === JSON.stringify(WANT) && JSON.stringify(Object.assign({}, S.TECH_BASE_SRV)) === JSON.stringify(WANT), JSON.stringify(CB));

  /* 2. totals */
  const tot = (k, L) => S.techFlatSrv(lv(L), k);
  add('track 60: crit / crit resist / Healing & Shielding = 200 rating (10%)', tot('crit', 60) === 200 && tot('critres', 60) === 200 && tot('heal', 60) === 200, [tot('crit', 60), tot('critres', 60), tot('heal', 60)].join('/'));
  let eq = true; for (let L = 0; L <= 60; L++) if (tot('atk', L) !== tot('ap', L)) eq = false;
  add('Attack == Ability power at every level 0..60', eq, 'atk60 ' + tot('atk', 60) + ' ap60 ' + tot('ap', 60));
  const ctot = JSON.parse(run('JSON.stringify([1,10,30,37,60].map(L=>' + JSON.stringify(TRACKS) + '.map(k=>techFlat(k,L))))'));
  add('client techFlat = server techFlatSrv at 1/10/30/37/60', JSON.stringify(ctot) === JSON.stringify([1, 10, 30, 37, 60].map(L => TRACKS.map(k => tot(k, L)))), '');
  if (!src.dir) { console.log('    level ' + TRACKS.map(k => k.padStart(7)).join(''));
    for (const L of [1, 10, 30, 37, 60]) console.log('    ' + String(L).padStart(5) + TRACKS.map(k => String(tot(k, L)).padStart(7)).join('')); }

  /* 3. heal track in the built unit */
  const key = Object.keys(SIM.HERO_BASE).find(k => SIM.HERO_BASE[k].role === 'Support') || Object.keys(SIM.HERO_BASE)[0];
  const OPT = { level: 100, stars: 5, pips: 0, ref: 0 };
  const sUnit = A => { const R = {}, XT = {}; S.acadApply(R, XT, A ? S.acadCombatOf(A) : null); return SIM.heroCombatStats(key, Object.assign({}, OPT, { ratings: R, extra: XT })); };
  const s0 = sUnit(null), s1 = sUnit(lv(60, 'heal'));
  add('server unit, Healing & Shielding 60: healPow +0.10 and shieldStr +0.10 (' + key + ')', near(s1.healPow - s0.healPow, 0.1) && near(s1.shieldStr - s0.shieldStr, 0.1), (s1.healPow - s0.healPow) + ' / ' + (s1.shieldStr - s0.shieldStr));
  const AC = S.acadCombatOf(lv(60, 'heal'));
  const spec = { key, level: 100, stars: 5, pips: 0, ref: 0, glyphRank: 6, tt: {}, ex: { techCrit: AC.critRating, techCritRes: AC.critResRating, techHeal: AC.healRating, equip: {} },
    fAtk: AC.atkFlat, fHp: AC.hpFlat, fApow: AC.apFlat, techArmor: AC.armorRating, techMr: AC.mrRating, techHeal: AC.healRating, apMul: 1, skillLv: [1, 1, 1, 1] };
  const cu = JSON.parse(run('(()=>{ const u=makeUnit(' + JSON.stringify(key) + ',"ally",0,0,100,{spec:' + JSON.stringify(spec) + '}); return JSON.stringify({h:u.healPowMul,s:u.shieldStrMul}); })()'));
  const snap = host.snapFromSpecs([spec])[0];
  add('client unit from the server spec: healPowMul x1.10 and shieldStrMul x1.10, and the resolved snapshot keeps both', near(cu.h, 1.1) && near(cu.s, 1.1) && near(snap.healPowMul || 1, 1.1) && near(snap.shieldStrMul, 1.1), JSON.stringify(cu) + ' snap ' + snap.healPowMul + '/' + snap.shieldStrMul);
  const snapSrc = src.srv.slice(src.srv.indexOf('ex:{ techCrit:AC?AC.critRating:0'), src.srv.indexOf('skillLv:ledSkillArr(led,key).slice(), gearSkill, templeBonuses'));
  add('snapshotHeroFromServer sends techHeal in ex (healPow) and on the spec (shieldStr)', /techHeal:AC\?\(AC\.healRating\|\|0\):0,/.test(snapSrc) && /techMr:AC\?AC\.mrRating:0, techHeal:AC\?\(AC\.healRating\|\|0\):0/.test(snapSrc), '');
  run('G.tech=' + JSON.stringify(lv(60, 'heal').lv));
  const ch = JSON.parse(run('JSON.stringify({m:mulsFromTotals({},{techHeal:techFlat("heal")}).healPow, ar:techArmorFlat(), mr:techMrFlat()})'));
  add('client owned-hero helpers: heal 60 -> healPow 0.10; an old G.tech.def 60 adds no Armor / MR', near(ch.m, 0.1) && ch.ar === 0 && ch.mr === 0, JSON.stringify(ch));
  const od = S.acadCombatOf({ lv: { academy: 60, def: 60 } });
  add('server: an old lv.def 60 gives nothing', Object.keys(od).every(k => !od[k]), JSON.stringify(od));

  /* 4 + 5. crit resist (subtractive) and Defense - server core and client dealDamage */
  const coreMult = (critDmg, critRes) => { const a = CORE.buildUnit('a', { hp: 1e6, dmg: 100, role: 'Tank' }, 1, 1, {}, {}), b = CORE.buildUnit('b', { hp: 1e9, dmg: 1, role: 'Tank' }, 1, 1, {}, {});
    a.crit = 0.5; a.critDmg = critDmg; b.critRes = critRes; b.hp = b.maxHp = 1e9;
    const hit = r => CORE.applyDamage(() => r, [], 1, 'A', a, b, 10000, 'true', {});
    return hit(0.1) / hit(0.99); };
  const coreRate = (crit, defPts) => { const a = CORE.buildUnit('a', { hp: 1e6, dmg: 100, role: 'Tank' }, 1, 1, {}, {}), b = CORE.buildUnit('b', { hp: 1e9, dmg: 1, role: 'Tank' }, 1, 1, { defense: defPts }, {});
    a.crit = crit; b.hp = b.maxHp = 1e9; let n = 0; const N = 1000;
    for (let i = 0; i < N; i++) { const log = []; CORE.applyDamage(() => (i + 0.5) / N, log, 1, 'A', a, b, 100, 'true', {}); if (log[log.length - 1][8]) n++; }
    return n / N; };
  run(`globalThis.__av2=(function(){ const keys=Object.keys(HERO_TYPES).filter(k=>!HERO_TYPES[k].monster);
    const mk=(team)=>{ const u=makeUnit(keys[0],team,500,700,1,{owned:false}); u.pass=null; u.glyphCrit=0; u.critDmg=0.6; u.critRes=0; u.defenseStat=0;
      u.armorRating=0; u.mrRating=0; u.evaStat=0; u.blockStat=0; u.glyphDR=0; u.shield=0; u.maxHp=u.hp=1e9; u.immovable=true; return u; };
    const fire=(src,tgt,r)=>{ _brng=()=>r; tgt.hp=tgt.maxHp=1e9; tgt.shield=0; tgt._critHit=false; const h0=tgt.hp; dealDamage(src,tgt,10000,'#fff','phys',true); _brng=null; return {d:h0-tgt.hp, c:!!tgt._critHit}; };
    return { mult(cd,cr){ const a=mk('ally'), b=mk('enemy'); a.glyphCrit=0.5; a.critDmg=cd; b.critRes=cr; return fire(a,b,0.1).d/fire(a,b,0.99).d; },
      rate(crit,defPts){ const a=mk('ally'), b=mk('enemy'); a.glyphCrit=crit; b.defenseStat=Math.min(0.6,defPts*0.0005); let n=0; const N=1000; for(let i=0;i<N;i++) if(fire(a,b,(i+0.5)/N).c) n++; return n/N; } }; })()`);
  const cMult = (cd, cr) => run('__av2.mult(' + cd + ',' + cr + ')'), cRate = (c, d) => run('__av2.rate(' + c + ',' + d + ')');
  const M = [[0.6, 0.1, 1.5], [0.6, 0, 1.6], [0.6, 0.75, 1.0]];
  for (const [cd, cr, want] of M) { const s = coreMult(cd, cr), c = cMult(cd, cr);
    add('crit resist ' + (cr * 100) + '% vs +' + (cd * 100) + '% crit damage = x' + want.toFixed(2) + ' (server core ' + s.toFixed(4) + ', client ' + c.toFixed(4) + ')', near(s, want, 2e-4) && near(c, want, 2e-4), ''); }
  const coreDefUnit = CORE.buildUnit('b', { hp: 1, dmg: 1, role: 'Tank' }, 1, 1, { defense: 2000 }, {});
  add('combat-core buildUnit: r.defense -> unit.defense at 20 = 1%, capped at 60% (2000 points -> 0.6)', coreDefUnit.defense === 0.6 && CORE.buildUnit('b', { hp: 1, dmg: 1 }, 1, 1, { defense: 200 }, {}).defense === 0.1, String(coreDefUnit.defense));
  const cdef = JSON.parse(run('(()=>{ const u=makeUnit(' + JSON.stringify(key) + ',"ally",0,0,100,{spec:' + JSON.stringify(Object.assign({}, spec, { tt: { defense: 200 } })) + '}); const s=snapUnitResolved(u); return JSON.stringify({u:u.defenseStat,s:s.defenseStat,b:buildUnitFromSnapshot(s,"ally",0,0).defenseStat}); })()'));
  add('client: a spec with 200 Defense builds defenseStat 0.10 and the snapshot carries it', near(cdef.u, 0.1) && near(cdef.s, 0.1) && near(cdef.b, 0.1), JSON.stringify(cdef));
  for (const [crit, d, want] of [[0.3, 0, 0.3], [0.3, 200, 0.2], [0.3, 800, 0]]) { const s = coreRate(crit, d), c = cRate(crit, d);
    add('30% crit vs ' + d + ' Defense = ' + (want * 100) + '% of rolls crit (server core ' + (s * 100).toFixed(1) + '%, client ' + (c * 100).toFixed(1) + '%)', near(s, want, 1e-9) && near(c, want, 1e-9), ''); }
  return out;
}

/* ---- live: an old account with def research ---- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-acadv2-')), dbFile = path.join(dir, 'db.json');
let child, base;
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start(port) { child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', PORT: String(port), DB_FILE: dbFile }, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); } throw Error('server did not start'); }
async function stop() { if (!child) return; await delay(400); child.kill(); for (let i = 0; i < 60 && child.exitCode === null; i++) await delay(50); child = null; }
async function call(tok, route, data) { const r = await fetch(base + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-token': tok }, body: data ? JSON.stringify(data) : undefined });
  let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, data: j }; }

(async () => {
  let ctl = null;
  try {
    console.log('current tree:');
    const cur = checks(sources(null));
    for (const [n, c, d] of cur) ok(c, n + (c ? '' : ' -- ' + d));

    console.log('control (v1122 ' + BASE_REF + '):');
    ctl = sources(BASE_REF);
    const old = checks(ctl), failed = old.filter(x => !x[1]).map(x => x[0]);
    const mustFail = ['the 8 tracks are', 'bases ', 'track 60: crit', 'Attack == Ability power', 'server unit, Healing', 'crit resist 10%', '30% crit vs 200 Defense', '30% crit vs 800 Defense'];
    for (const m of mustFail) ok(failed.some(n => n.indexOf(m) === 0), 'control: v1122 fails "' + m + '..."');
    ok(old.some(x => x[0].indexOf('crit resist 0%') === 0 && x[1]) && old.some(x => x[0].indexOf('30% crit vs 0 Defense') === 0 && x[1]), 'control: v1122 still passes the unchanged cases (0% resist x1.60, 0 Defense 30%) - the harness measures, not breaks');

    console.log('live server, old account:');
    const port = await freePort(); base = 'http://127.0.0.1:' + port; await start(port);
    const g = (await call('', '/api/guest', { deviceId: 'acadv2-' + Date.now() })).data; await call(g.token, '/api/ledger');
    await stop();
    const edit = f => { const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); f(db.users[g.profile.id]); fs.writeFileSync(dbFile, JSON.stringify(db)); };
    const read = () => JSON.parse(fs.readFileSync(dbFile, 'utf8')).users[g.profile.id].led.acad;
    edit(u => { u.led.px = 1e9; u.led.gold = 1e7;
      u.led.acad = { lv: { academy: 10, atk: 0, hp: 0, ap: 0, def: 60, armor: 0, mr: 0, crit: 0, critres: 0 }, learn: { def: Date.now() - 1000 },
        res: { iron: 1e6, crystal: 1e6, silver: 1e6, coal: 1e6 }, mineDay: null, incAt: Date.now() }; });
    await start(port);
    const r1 = await call(g.token, '/api/academy');
    ok(r1.status === 200 && r1.data.lv && r1.data.lv.def === 60 && r1.data.lv.heal === 0 && !('def' in (r1.data.learn || {})),
      'GET /api/academy on an account with lv.def 60 and a FINISHED learn.def: 200, def cancelled not collected (lv.def stays 60), lv.heal 0 (' + JSON.stringify(r1.data.lv) + ')');
    await stop();
    { const A = read(); ok(A.lv.def === 60, 'on disk the finished def was never collected (lv.def 60); the cancel is re-applied on every load (ensureAcad normalizes), so a restart cannot revive it (' + JSON.stringify({ lv: A.lv, learn: A.learn }) + ')'); }
    edit(u => { u.led.acad.learn = { def: Date.now() + 3600000 }; });
    await start(port);
    const r2 = await call(g.token, '/api/academy/collect', { requestId: 'av2-c' });
    ok(r2.status === 200 && r2.data.ok && !('def' in (r2.data.learn || {})), 'POST /api/academy/collect with a PENDING learn.def: 200, cancelled');
    const r3 = await call(g.token, '/api/academy/research', { track: 'heal', requestId: 'av2-h' });
    ok(r3.status === 200 && r3.data.ok && r3.data.track === 'heal', 'the Healing & Shielding track is researchable straight away (no def in progress blocks it): ' + JSON.stringify(r3.data.error || 'ok'));
    const r4 = await call(g.token, '/api/academy/research', { track: 'def', requestId: 'av2-d' });
    ok(r4.data.ok === false && /Unknown research track/.test(r4.data.error || ''), 'research on def is refused: ' + r4.data.error);
    console.log('test_academy_v2.js: ' + pass + ' checks passed');
  } catch (e) { console.error('FAIL', e && e.message || e); process.exitCode = 1; }
  finally { await stop(); if (ctl && ctl.dir) fs.rmSync(ctl.dir, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
})();
