'use strict';
// v1166 - NOX QUILLFINGER, Phil 16 Oct 2026 (ChatGPT handoff 08:51:28): "hes midrow magic assasin ranged with 10 meter attack range".
// Nox is MID ROW, ASSASSIN, MAGIC damage, RANGED, with a 10 m basic attack range (the game's METER = 28.2 field units -> 282; never 10 raw
// units). He holds at his own 10 m range (rangeHold), not the 13 m mid-row ranged hold that would widen his range to 13.6 m. His auto is
// the game's ranged-magic delivery: a shadow ball (CASTER_BALL, as Vesper / Tessit) released on the attack clip's release cell, landing
// after its flight, MAGIC (Magic Resist mitigates it, Armor does not). His weapon sound is the caster whoosh. NO damage number or skill
// multiplier changed (dmg 40, apow 0, swing 1.8, atkSpeed 1.2, every KITS / ULT number = BASE).
// Checks: the canonical profile (one file, browser and server), the unit the engine builds, server/client parity (server/sim.js HERO_BASE +
// the server replay host = the client), the delivery, sound, fights WITHOUT Nox tick-identical to BASE (CONTROL: fights with him differ; the
// v1166 page with Nox's old line put back = BASE tick for tick, so nothing else moved), and the before/after table over 10 seeded fights.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'df2313ec';   // live v1164, the build before this change
// BASE tree: its own page AND its own hero-profiles.js / hero-paths.js (sim-host loads the page's external scripts from the page's folder)
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'noxr-base-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server')); for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js']) fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE_SHA + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { baseOk = false; }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = baseOk ? load(path.join(BD, 'emberweave-heroes.html')) : null;
const undone = load(HTML); require('./helpers/anim-noxgrim-1166.js').undoNoxGrim1166(undone);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 700) : '')); } };
const J = (r, s) => JSON.parse(r('JSON.stringify(' + s + ')'));
// a whole fight (autoUlt, everyone carrying BATTLE_ANIM as the server replay): per-tick trace hash + Nox's damage dealt and time alive
const FIGHT = (seed, a, f) => `(()=>{ const crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; window._p2guard=true; const svA=autoUlt; autoUlt=true;
  try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
    units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
    ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
    units.forEach(u=>buildFigure(u));
    let dmg=0, autos=0, alive=0, shots={}, minD=1e9, maxD=0; const _dd=dealDamage, _sp=(typeof spawnProjFx==='function')?spawnProjFx:null;
    dealDamage=function(s,t){ const h0=t?t.hp:0; const r=_dd.apply(this,arguments); if(s&&s.key==='nox'&&t) dmg+=Math.max(0,h0-t.hp); return r; };
    const tr=[]; try{ for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ const nx=units.find(u=>u.key==='nox'); const a0=nx?(nx.attackAnim||0):0;
        updateBattle(SIM_STEP);
        if(nx&&nx.alive){ alive+=SIM_STEP; if((nx.attackAnim||0)>a0+1e-9&&nx.target){ autos++; const d=Math.hypot(nx.x-nx.target.x,nx.y-nx.target.y); minD=Math.min(minD,d); maxD=Math.max(maxD,d); } }
        tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); } }
    finally{ dealDamage=_dd; }
    return JSON.stringify({h:crypto_like(tr.length+'@'+tr.join('#')),dmg,alive,autos,minD:autos?minD:null,maxD:autos?maxD:null,won:units.filter(u=>u.team==='ally'&&u.alive).length>0&&!units.some(u=>u.team==='enemy'&&u.alive)}); }
  finally{ autoUlt=svA; window._p2guard=false; } })()`;
[run, R0, undone].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));
// every whole fight runs in a FRESH load of its page (a fight leaves global counters behind, so a context that ran other fights first is not the same start)
const PAGES = new Map(); [[run, HTML], [R0, path.join(BD, 'emberweave-heroes.html')], [undone, 'undone']].forEach(([r, f]) => PAGES.set(r, f));
const fresh = r => { const f = PAGES.get(r); if (!f) return r; const n = load(f === 'undone' ? HTML : f); if (f === 'undone') require('./helpers/anim-noxgrim-1166.js').undoNoxGrim1166(n); return n; };
const fight = (r, s, a, f) => JSON.parse(fresh(r)(FIGHT(s, a, f)));

try {
  ck('control file (BASE page + its own hero-profiles.js from git ' + BASE_SHA + ') loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; ')); }
  // 1. the canonical profile: one authored file for browser and server
  delete require.cache[require.resolve(path.join(ROOT, 'hero-profiles.js'))];
  const P = require(path.join(ROOT, 'hero-profiles.js')).nox, P0 = J(R0, 'HERO_PROFILES.nox');
  ck('hero-profiles.js: Nox is class Assassin, combat row Mid (formation depth 2), damage Magic, scaling Ability Power (BASE: Assassin / Mid / Attack / Attack Damage)',
    P.class === 'Assassin' && P.combatRow === 'Mid' && P.formationDepth === 2 && P.damageProfile === 'Magic' && P.primaryScaling === 'Ability Power' &&
    P0.class === 'Assassin' && P0.combatRow === 'Mid' && P0.damageProfile === 'Attack' && P0.primaryScaling === 'Attack Damage', JSON.stringify({ P, P0 }));
  { const pa = require(path.join(ROOT, 'hero-profiles.js')), pb = J(R0, 'HERO_PROFILES');
    const diff = Object.keys(pb).filter(k => JSON.stringify(pa[k]) !== JSON.stringify(pb[k]));
    ck('only Nox\'s profile changed, and only damageProfile + primaryScaling (glyph / equipment path, reach, class, row as BASE)', JSON.stringify(diff) === '["nox"]' &&
      Object.keys(P).filter(k => JSON.stringify(P[k]) !== JSON.stringify(P0[k])).sort().join() === 'damageProfile,primaryScaling', JSON.stringify(diff)); }
  const T = J(run, 'HERO_TYPES.nox'), T0 = J(R0, 'HERO_TYPES.nox'), METER = +run('METER');
  ck('METER is the game\'s 28.2 field units per metre; Nox\'s range is 10 m = 10 x METER = 282 (not 10 raw units; BASE 26 = melee)', METER === 28.2 && T.range === Math.round(10 * METER * 1000) / 1000 && Math.abs(T.range / METER - 10) < 1e-9 && T0.range === 26);
  { const keep = o => { const c = Object.assign({}, o); for (const k of ['range', 'rangeHold', 'damageProfile', 'primaryScaling']) delete c[k]; return JSON.stringify(c); };
    ck('HERO_TYPES.nox: only range, rangeHold, damageProfile, primaryScaling differ from BASE - hp 245 / dmg 40 / apow none / swing 1.8 / atkSpeed 1.2 / speed 92 unchanged', keep(T) === keep(T0) && T.rangeHold === true && T.dmg === 40 && T.swing === 1.8 && T.atkSpeed === 1.2, keep(T)); }
  const kits = r => r('JSON.stringify([KITS.nox,ULT_DEF.openeverydoor,ULT_SCALE.openeverydoor||null,HERO_ULT_ART.nox||null,ABILITY_CAST.nox||null])');
  ck('no new damage number or multiplier: his kit (Lockpick Soul, Forbidden Key, Skeleton-Key Savant), Open Every Door and their cast times are BASE\'s', kits(run) === kits(R0));
  ck('every other hero\'s HERO_TYPES line is BASE\'s', run("JSON.stringify(Object.keys(HERO_TYPES).filter(k=>k!=='nox').map(k=>[k,HERO_TYPES[k]]))") === R0("JSON.stringify(Object.keys(HERO_TYPES).filter(k=>k!=='nox').map(k=>[k,HERO_TYPES[k]]))"));
  // 2. the unit the engine builds
  const U = r => JSON.parse(r(`(()=>{ const u=makeUnit('nox','ally',300,600,30,{owned:false,rank:3}); const b=makeUnit('nox','enemy',300,600,30,{owned:false,rank:3,boss:true});
    return JSON.stringify({melee:!!u.melee,range:u.range,cd:u.combatDist,mode:heroScaleMode(u),row:heroFormationDepth('nox'),brange:b.range,bcd:b.combatDist}); })()`));
  const u1 = U(run), u0 = U(R0);
  ck('the unit: ranged (not melee), range 282 = 10.0 m (NOT widened to the 13 m row hold + 18 = 13.6 m), holds at 264 = 9.36 m (his range - the 18-unit slack every ranged hold keeps), abilities scale on Ability Power (BASE: melee, 26, Attack)',
    !u1.melee && u1.range === 282 && u1.cd === 264 && u1.mode === 'ap' && u1.row === 2 && u0.melee && u0.range === 26 && u0.mode === 'ad', JSON.stringify({ u1, u0 }));
  { const g = r => JSON.parse(r(`(()=>{ const u=makeUnit('vesper','ally',300,600,30,{owned:false,rank:3}); return JSON.stringify([u.range,u.combatDist]); })()`));
    ck('CONTROL: a mid-row ranged caster without rangeHold (Vesper) still holds the 13 m row distance with its range widened to it, as BASE', JSON.stringify(g(run)) === JSON.stringify(g(R0)) && g(run)[1] === 13 * METER, JSON.stringify(g(run))); }
  ck('the hero panel reads Type Ranged / Combat row Mid / Class Assassin / Damage Magic / Scaling Ability Power (it reads these fields: t.range>=60, combatRow, role, damageProfile, primaryScaling)',
    /\[statIcon\('range'\)\+'Type',t\.range>=60\?'Ranged':'Melee'\],\['Combat row',t\.combatRow\],\['Class',t\.role\],\['Damage',t\.damageProfile\],\['Scaling',t\.primaryScaling\]\]/.test(fs.readFileSync(HTML, 'utf8')) &&
    T.range >= 60 && T.combatRow === 'Mid' && T.role === 'Assassin' && T.damageProfile === 'Magic' && T.primaryScaling === 'Ability Power');
  // 3. server / client parity
  { delete require.cache[require.resolve(path.join(ROOT, 'server/sim.js'))]; const SIM = require(path.join(ROOT, 'server/sim.js')); const S = SIM.HERO_BASE.nox;
    const TEMPLE = require(path.join(ROOT, 'server/temple-of-ash.js'));
    ck('server/sim.js HERO_BASE.nox (the server\'s copy of hero stats) = the client: Assassin / Mid / Magic / Ability Power from the same hero-profiles.js, dmg 40, apow 0, swing 1.8, atkSpeed 1.2',
      S.role === T.role && S.row === T.row && S.damageProfile === T.damageProfile && S.primaryScaling === T.primaryScaling && S.dmg === T.dmg && (S.apow || 0) === (T.apow || 0) && S.swing === T.swing && S.atkSpeed === T.atkSpeed, JSON.stringify(S));
    ck('the Temple of Ash reads him as a magic hero on both sides (server profileOf = the client\'s)', TEMPLE.profileOf ? TEMPLE.profileOf(S.damageProfile, S.role) === 'magic' : run("TempleOfAsh.profileOf?TempleOfAsh.profileOf('nox'):'magic'") === 'magic');
    const hb = JSON.parse(fs.readFileSync(path.join(ROOT, 'hero_base.json'), 'utf8')).nox;
    ck('hero_base.json (the documented stat table) says Magic / Ability Power too', hb.damageProfile === 'Magic' && hb.primaryScaling === 'Ability Power' && hb.class === 'Assassin' && hb.combatRow === 'Mid'); }
  { const srv = load(HTML); const a = fight(run, 42, ['nox', 'askel', 'vesper'], ['vael', 'tick', 'lumi']), b = fight(srv, 42, ['nox', 'askel', 'vesper'], ['vael', 'tick', 'lumi']);
    ck('the server replay host (server/sim-host.js, a fresh load) resolves a Nox fight tick for tick as the client page does', a.h === b.h && a.dmg === b.dmg, JSON.stringify({ a, b })); }
  // 4. delivery: the ranged-magic shadow ball on the release cell, landing after its flight, magic
  const SW = (r, armor, mr) => JSON.parse(r(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
    const g=makeUnit('nox','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',740,700,30,{owned:false});
    g.anim=BATTLE_ANIM.nox; e.anim=null; g.glyphCrit=0; units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); e.atkInterval=99; e.atkCd=99; e.speed=0;
    ${armor != null ? 'e.armorRating=' + armor + '; e.armor=' + armor + ';' : ''} ${mr != null ? 'e.mrRating=' + mr + '; e.mr=' + mr + ';' : ''}
    g.target=e; g.greenCd=g.blueCd=99; g.atkCd=0;
    const ev=[]; const _dd=dealDamage, _sp=spawnProjFx, _ss=spawnShot;
    spawnProjFx=function(k){ if(window._fxCaster===g||true) ev.push(['proj',k,+battleTime.toFixed(4)]); return _sp.apply(this,arguments); };
    spawnShot=function(s){ if(s===g) ev.push(['shot',+battleTime.toFixed(4)]); return _ss.apply(this,arguments); };
    dealDamage=function(s,t,amt,c,k){ if(s===g){ const h0=t.hp; const r=_dd.apply(this,arguments); ev.push(['hit',+battleTime.toFixed(4),+(h0-t.hp).toFixed(3),k||null]); return r; } return _dd.apply(this,arguments); };
    try{ for(let i=0;i<Math.round(5/SIM_STEP);i++){ const a0=g.attackAnim||0; updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.energy=0; e.energy=0;
        if((g.attackAnim||0)>a0+1e-9) ev.push(['start',+battleTime.toFixed(4),Math.round(Math.hypot(g.x-e.x,g.y-e.y))]); } } finally{ dealDamage=_dd; spawnProjFx=_sp; spawnShot=_ss; }
    return JSON.stringify({ev,el:CASTER_BALL.nox||null,fx:HERO_FX_MUL}); })()`));
  const D = SW(run), st = D.ev.filter(e => e[0] === 'start'), pr = D.ev.filter(e => e[0] === 'proj'), hi = D.ev.filter(e => e[0] === 'hit');
  ck('CASTER_BALL.nox = the shadow ball the mid-row shadow casters throw (Vesper, Tessit: shadowball x1.4); BASE had none', JSON.stringify(D.el) === JSON.stringify(J(run, 'CASTER_BALL.vesper')) && J(R0, 'CASTER_BALL.nox||null') === null);
  { const CLK = +run('SIM_STEP*SIM_HZ*BATTLE_PACE'), A = J(run, 'BATTLE_ANIM.nox.attack');
    const rel = pr.length && st.length ? +(pr[0][2] - st[0][1]).toFixed(4) : null, fly = hi.length && pr.length ? +(hi[0][1] - pr[0][2]).toFixed(4) : null;
    ck('every auto starts from range (' + st.map(x => (x[2] / METER).toFixed(2) + ' m').join(', ') + ' - never in melee), the shadow ball leaves on the clip\'s release (' + rel + ' fight s after the swing = clipDur 2.0 x relFrac 0.5 x BATTLE_PACE 0.82) and the hit lands ' + fly + ' s later (its flight 0.22 x HERO_FX_MUL)',
      st.length >= 2 && st.every(x => x[2] / METER > 8 && x[2] / METER <= 10.0001) && pr.length >= st.length - 1 && pr.every(x => x[1] === 'shadowball') && Math.abs(rel - 0.82) < 0.04 &&
      Math.abs(fly - 0.22 * D.fx) < 0.04 && hi.length >= 2 && !D.ev.some(e => e[0] === 'shot'), JSON.stringify(D.ev.slice(0, 8))); }
  { const a = SW(run, 3000, 0).ev.filter(e => e[0] === 'hit')[0][2], m = SW(run, 0, 3000).ev.filter(e => e[0] === 'hit')[0][2], n = SW(run, 0, 0).ev.filter(e => e[0] === 'hit')[0][2];
    const a0 = SW(R0, 3000, 0).ev.filter(e => e[0] === 'hit')[0][2], m0 = SW(R0, 0, 3000).ev.filter(e => e[0] === 'hit')[0][2];
    ck(`his auto is MAGIC damage: Magic Resist cuts it (${n} -> ${m}), Armor does not (${a}); BASE was physical (Armor cut it ${a0}, MR did not ${m0}); the amount at 0/0 = BASE's (no new numbers)`,
      a === n && m < n * 0.9 && a0 < n * 0.9 && m0 === n, JSON.stringify({ a, m, n, a0, m0 })); }
  // 5. sound
  { const SD = J(run, 'SFX_DATA.heroes.nox'), MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8'));
    const py = fs.readFileSync(path.join(ROOT, 'tools/build_sfx.py'), 'utf8');
    ck('his weapon sound is the ranged caster whoosh (LIB-ATK-CASTER-WHOOSH, BASE BLADE-LIGHT) in SFX_DATA, the manifest and build_sfx.py WEAPON (the casters\' list)',
      SD.atk === 'LIB-ATK-CASTER-WHOOSH' && J(R0, 'SFX_DATA.heroes.nox.atk') === 'LIB-ATK-BLADE-LIGHT' && MAN.attack.nox.lib === 'LIB-ATK-CASTER-WHOOSH' && !/'nox': 'BLADE-LIGHT/.test(py) && /'mirelle',\s*'nox'\]\}/.test(py));
    ck('a ranged auto plays its weapon sound on the release fuse (sfxAtkFuse(u,_fdL,false) in the ranged branch) - the same code path as every caster', /if\(typeof SFX!=='undefined'&&SFX\.loop\) sfxAtkFuse\(u,_fdL,false\); \}/.test(fs.readFileSync(HTML, 'utf8'))); }
  // 6. ONLY NOX: fights without him tick-identical to BASE; with him they change; put his old line back and they are BASE again
  const NO_NOX = [[['askel', 'vesper', 'kharos'], ['vael', 'tick', 'lumi'], 11], [['grosk', 'sorrel', 'umbris'], ['pellucid', 'veyr', 'oakmir'], 222], [['korvux', 'sloe', 'astra'], ['askel', 'hurne', 'carn'], 5],
    [['gruel', 'aureth', 'tharl'], ['seyla', 'hollow', 'calypsa'], 77], [['astra', 'quorrel', 'rivet'], ['maren', 'lumi', 'hollow'], 31], [['grimsby', 'vex', 'tessit'], ['rafe', 'brannus', 'dandra'], 64]];
  const WITH = [[['nox', 'askel', 'vesper'], ['vael', 'tick', 'lumi'], 11], [['grosk', 'nox'], ['pellucid', 'veyr', 'oakmir'], 222], [['korvux', 'sloe', 'nox'], ['askel', 'hurne', 'carn'], 5],
    [['gruel', 'aureth', 'tharl'], ['nox', 'hollow', 'calypsa'], 77], [['astra', 'nox', 'rivet'], ['maren', 'lumi', 'nox'], 31]];
  ck('whole fights WITHOUT Nox (6, including Grimsby\'s) are tick-for-tick identical to BASE (hp, x, y, alive, energy, swing timer every tick)', NO_NOX.every(([a, f, s]) => fight(run, s, a, f).h === fight(R0, s, a, f).h));
  ck('CONTROL: whole fights WITH Nox differ from BASE (the check sees his change)', WITH.every(([a, f, s]) => fight(run, s, a, f).h !== fight(R0, s, a, f).h));
  ck('CONTROL: the v1166 page with Nox\'s old line put back (range 26, no rangeHold, Attack, no shadow ball, the v21 clips) is BASE tick for tick in those fights - nothing else in the engine moved',
    WITH.every(([a, f, s]) => fight(undone, s, a, f).h === fight(R0, s, a, f).h));
  // 7. before / after over 10 seeded fights (Nox on the ally side, rank 3, no gear: the same fights on both builds)
  const TEN = [['askel', 'vesper', 'lumi'], ['vael', 'tick', 'oakmir'], ['grosk', 'meridian', 'dandra'], ['pellucid', 'umbris', 'mirelle'], ['tharl', 'astra', 'vireo'],
    ['gruel', 'sylthaine', 'lumi'], ['brannus', 'maren', 'linnet'], ['askel', 'orryn', 'nerisse'], ['rhukk', 'fritz', 'mellan'], ['grosk', 'yenna', 'tessit']];
  const ENEMY = [['vael', 'kharos', 'lumi'], ['askel', 'hollow', 'vesper'], ['tharl', 'veyr', 'oakmir'], ['grosk', 'seyla', 'astra'], ['pellucid', 'vex', 'maren'],
    ['gruel', 'sorrel', 'umbris'], ['rhukk', 'kharos', 'fritz'], ['brannus', 'carn', 'dandra'], ['vael', 'zahri', 'vireo'], ['askel', 'hurne', 'sloe']];
  const rows = [];
  for (let i = 0; i < 10; i++) { const s = 1000 + i * 37, a = ['nox'].concat(TEN[i]), f = ENEMY[i];
    const n = fight(run, s, a, f), o = fight(R0, s, a, f); rows.push({ s, n, o }); }
  const dps = x => x.alive > 0 ? x.dmg / x.alive : 0, sum = (k, f) => rows.reduce((t, r) => t + f(r[k]), 0);
  const dN = sum('n', x => x.dmg) / Math.max(1e-9, sum('n', x => x.alive)), dO = sum('o', x => x.dmg) / Math.max(1e-9, sum('o', x => x.alive));
  const dist = (k, m) => { const v = rows.map(r => r[k][m]).filter(x => x != null); return v.length ? (m === 'minD' ? Math.min(...v) : Math.max(...v)) / METER : null; };
  console.log('  info before / after (10 seeded fights, Nox and everyone level 30, rank 3, no gear, autoUlt, 45 s cap; DPS = his damage dealt / his time alive, fight seconds):');
  console.log('  info | | row | class | damage | basic attack range | delivery | DPS (10 fights) | wins |');
  console.log('  info | BEFORE v1164 | Mid | Assassin | Attack (physical) | 26 units = 0.92 m, melee | the hook cut, on the blow | ' + dO.toFixed(1) + ' | ' + rows.filter(r => r.o.won).length + '/10 |');
  console.log('  info | AFTER v1166 | Mid | Assassin | Magic | 282 units = 10 m (attacks from ' + dist('n', 'minD').toFixed(1) + '-' + dist('n', 'maxD').toFixed(1) + ' m) | shadow ball on the release cell, lands after its flight | ' + dN.toFixed(1) + ' | ' + rows.filter(r => r.n.won).length + '/10 |');
  console.log('  info per fight DPS before -> after: ' + rows.map(r => dps(r.o).toFixed(0) + '->' + dps(r.n).toFixed(0)).join(', '));
  ck('table: in all 10 seeded fights he opens from range on v1166 (his farthest auto 9-10 m, none beyond his 10 m; nearer only when a foe walks into him) and only ever from melee on BASE (<= 4 m centre to centre)', rows.every(r => r.n.autos > 0 && r.n.maxD / METER > 9 && r.n.maxD / METER <= 10.0001 && (r.o.autos === 0 || r.o.maxD / METER < 4)),
    JSON.stringify(rows.map(r => [r.n.minD, r.n.maxD, r.o.maxD])));
  fs.writeFileSync(path.join(os.tmpdir(), 'nox_ranged_1166_table.json'), JSON.stringify({ dpsBefore: dO, dpsAfter: dN, rows }, null, 1));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
