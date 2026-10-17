'use strict';
// v1194 - NOX TO MAGIC ASSASSIN GEAR (Phil 17 Oct 2026: "Switch nox to magic gear and swap everything of his to magic assassin gear").
//   Nox is Magic / Ability Power but sat on the attack assassins' equipment + glyph path (assassin_other, with Sorrel, Hollow, Kharos, Seyla,
//   Vex). The one other magic assassin, Veyr, is on assassin_mid. Now Nox is too: hero-profiles.js paths, his personal glyph tiers = Veyr's,
//   his ascension steps read Ability Power / Magic Penetration (same amounts), and his base Ability Power 0 -> 31 (Veyr 34 x Nox's 40/44).
//   An existing account moves ONCE at boot (server.js migrateNoxMagic1194), nothing lost:
//     gear   - the old-path pieces equipped on Nox become the new path's piece of the same slot + quality: same item id, still bound and his,
//              his gear active kept; the new type takes the higher Temper of the two; another hero's copy of the old type keeps its own.
//     glyphs - an exactly-banked board swaps the old tiers' sum for the new tiers' sum; an older board keeps what it has and is topped up;
//              his current tier's slotted old pre-choices become the new pre-choices. Marker board.noxMagic1194 (a second boot changes nothing).
//   CONTROL: the same checks run on the fixture BEFORE the boot fail.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-noxmagic-')), dbFile = path.join(dir, 'db.json');
const HTML = path.join(root, 'emberweave-heroes.html'), BASE_SHA = process.env.EW_BASE || '3afb75d2';   // live v1193, before this change
let port, base, child, pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start(admin) { child = cp.spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATABASE_URL: '', PORT: String(port), DB_FILE: dbFile, ADMIN_IDS: admin || '' }, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); } throw Error('no start'); }
async function stop() { if (!child) return; child.kill(); for (let i = 0; i < 60 && child.exitCode === null; i++) await delay(50); child = null; }
const call = async (p, b, tok) => { const r = await fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = {}; try { j = await r.json(); } catch (_) {} return j; };
const sumBank = (plan, upto) => { const b = {}; for (let qi = 0; qi < upto; qi++) for (const d of plan[qi]) for (const s of d.stats) { const o = b[s.stat] || { val: 0, pct: s.pct }; o.val = +(o.val + s.val).toFixed(2); b[s.stat] = o; } return b; };
const near = (a, b) => Math.abs(a - b) < 0.02;
// the checks, run on any DB (the fixture before boot must fail them - the control)
function checks(db, ids, P, label) { const out = [];
  const A = db.users[ids.A], B = db.users[ids.B], g = A.gear, bA = A.glyphs.boards.nox, bB = B.glyphs.boards.nox;
  out.push(['gear: the Green Helm on Nox (Falconer Cap E13, Temper 5) is now the magic assassin Helm (Cinder Mask E12): same item id, still bound, still in his Helm slot', g.items.q901 && g.items.q901.d === 'E12' && g.items.q901.bound === true && g.equipped.nox.Helm === 'q901' && g.items.q901.migratedFrom === 'E13']);
  out.push(['gear: the new type takes the HIGHER Temper of the two (E13 5 vs E12 2 -> E12 at 5), and Vex\'s own copy of E13 keeps Temper 5', g.tt && g.tt.E12 && g.tt.E12.temper === 5 && g.tt.E12.prog === 3 && g.items.q904.d === 'E13' && g.tt.E13 && g.tt.E13.temper === 5 && g.equipped.vex.Helm === 'q904']);
  out.push(['gear: a pre-v1054 piece (Deadeye Gloves E39, Temper 7 on the item, no type record) becomes Magma Claws E38 at Temper 7; his gear active (that piece) is kept', g.items.q902.d === 'E38' && g.tt.E38 && g.tt.E38.temper === 7 && g.items.q902.temper === 7 && g.active.nox === 'q902' && g.equipped.nox.Gloves === 'q902']);
  out.push(['gear: a piece both paths share (Skirmisher Axe E03) and an unequipped spare E13 are untouched; no item lost (' + Object.keys(g.items).length + ' items)', g.items.q903.d === 'E03' && g.items.q905.d === 'E13' && Object.keys(g.items).length === 5]);
  const nb = sumBank(P.cur, 3), have = bA.ascended || {};
  out.push(['glyphs: an exactly-banked board (3 tiers of the old attack tiers) now holds the new magic tiers\' sum - ' + JSON.stringify(Object.fromEntries(Object.entries(nb).map(([k, v]) => [k, v.val]))), Object.keys(nb).every(k => have[k] && near(have[k].val, nb[k].val)) && Object.keys(have).every(k => nb[k]) && bA.noxMagic1194 === 1 && bA.noxMagicMode === 'exact-delta']);
  out.push(['glyphs: his current tier\'s slotted old pre-choices are now the new pre-choices (' + P.cur[3].map(d => d.id).join(' ') + ')', bA.slots.every((iid, s) => A.glyphs.finished[iid] && A.glyphs.finished[iid].definitionId === P.cur[3][s].id) && bA.ascensionIndex === 3]);
  const nb2 = sumBank(P.cur, 2), hb = bB.ascended || {};
  out.push(['glyphs: an older board (banked differently) keeps what it had (Physical Attack 1) and is topped up to the new sum', hb['Physical Attack'] && hb['Physical Attack'].val === 1 && Object.keys(nb2).every(k => hb[k] && hb[k].val + 0.01 >= nb2[k].val) && bB.noxMagicMode === 'preserve-legacy']);
  out.push(['an account without Nox is untouched', JSON.stringify(db.users[ids.C].gear || null) === label.C]);
  return out; }
(async () => { try {
  port = await freePort(); base = 'http://127.0.0.1:' + port; await start('');
  const mk = async n => (await call('/api/register', { name: n, pass: 'password1' })).profile.id;
  const ids = { A: await mk('noxmagA'), B: await mk('noxmagB'), C: await mk('noxmagC') }; await delay(400); await stop(); await start(ids.A);
  const tA = (await call('/api/login', { name: 'noxmagA', pass: 'password1' })).token;
  await call('/api/admin/led-grant', { heroKeys: ['nox', 'vex'], unlock: ['nox', 'vex'], heroXp: 99000000 }, tA);
  await call('/api/admin/led-grant', { userId: ids.B, heroKeys: ['nox'], unlock: ['nox'], heroXp: 99000000 }, tA);
  await call('/api/glyphs/state', null, tA);
  const tB = (await call('/api/login', { name: 'noxmagB', pass: 'password1' })).token; await call('/api/glyphs/state', null, tB);
  const P = await call('/api/admin/nox-magic-plan', null, tA);
  ck('the dev read gives both tier sets (16 each) and the gear map ' + JSON.stringify(P.gearMap), P.old && P.old.length === 16 && P.cur.length === 16 && P.gearMap && P.gearMap.E13 === 'E12' && P.gearMap.E39 === 'E38' && !P.gearMap.E03, JSON.stringify(P).slice(0, 300));
  ck('the new tiers are Veyr\'s (AP: Starfire in the onslaught slot), the old ones were attack (Ravager)', P.cur[0][2].family === 'Starfire' && P.old[0][2].family === 'Ravager');
  await delay(500); await stop();
  // the fixture: what an account that played Nox before v1194 holds
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')), A = db.users[ids.A], B = db.users[ids.B];
  A.gear = { revision: 1, fragments: {}, subs: {}, seq: 910, active: { nox: 'q902' }, tt: { E13: { temper: 5, prog: 3, dustSpent: 0 }, E12: { temper: 2, prog: 0, dustSpent: 0 } },
    items: { q901: { d: 'E13', temper: 5, prog: 3, dustSpent: 0, bound: true }, q902: { d: 'E39', temper: 7, prog: 1, dustSpent: 0, bound: true }, q903: { d: 'E03', temper: 0, prog: 0, dustSpent: 0, bound: true },
      q904: { d: 'E13', temper: 5, prog: 3, dustSpent: 0, bound: true }, q905: { d: 'E13', temper: 5, prog: 3, dustSpent: 0, bound: false } },
    equipped: { nox: { Helm: 'q901', Gloves: 'q902', Weapon: 'q903' }, vex: { Helm: 'q904' } } };
  delete A.gear.tt.E39;   // q902 is a pre-v1054 piece: its Temper lives on the item
  const g = A.glyphs; g.finished = g.finished || {}; const slots = [];
  P.old[3].forEach((d, s) => { const iid = 'gx' + s; g.finished[iid] = { definitionId: d.id, status: 'locked', builtAt: 1 }; slots.push(iid); });
  g.paths1022 = 1; g.defense1123 = 1; g.tankPath1019 = 1; B.glyphs.paths1022 = 1; B.glyphs.defense1123 = 1; B.glyphs.tankPath1019 = 1;   // as every live account: the earlier re-bank migrations already ran
  g.boards = g.boards || {}; g.boards.nox = { slots, ascensionIndex: 3, ascended: sumBank(P.old, 3), ascended0: 1, personalPathVersion: 1 }; delete g.boards.nox.ascended0;
  B.glyphs.boards = B.glyphs.boards || {}; B.glyphs.boards.nox = { slots: [null, null, null, null, null, null], ascensionIndex: 2, ascended: { 'Physical Attack': { val: 1, pct: false } }, personalPathVersion: 1 };
  const label = { C: JSON.stringify(db.users[ids.C].gear || null) };
  fs.writeFileSync(dbFile, JSON.stringify(db));
  const before = checks(JSON.parse(JSON.stringify(db)), ids, P, label);
  ck('CONTROL: the fixture before the boot fails the migration checks (' + before.filter(x => !x[1]).length + ' of ' + before.length + ')', before.filter(x => !x[1]).length >= 6, JSON.stringify(before.filter(x => x[1]).map(x => x[0])));
  await start(ids.A); await call('/api/login', { name: 'noxmagA', pass: 'password1' }); await delay(900); await stop();
  const after = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  for (const [name, ok] of checks(after, ids, P, label)) ck(name, ok, JSON.stringify({ gear: after.users[ids.A].gear, nox: after.users[ids.A].glyphs.boards.nox, B: after.users[ids.B].glyphs.boards.nox }));
  // the wire view shows the new glyphs in his slots
  await start(ids.A); const tA2 = (await call('/api/login', { name: 'noxmagA', pass: 'password1' })).token; const st = await call('/api/glyphs/state', null, tA2);
  ck('the player sees the new glyphs on his board (' + ((st.boards && st.boards.nox && st.boards.nox.slots) || []).map(s => s && s.family).join(' ') + ')', st.boards && st.boards.nox && st.boards.nox.slots.every((x, s) => x && x.blueprintId === P.cur[3][s].id));
  const nab = st.boards && st.boards.nox && st.boards.nox.nextAscensionBonus;
  ck('his next ascension step reads Ability Power / Magic Penetration, never Physical Attack / Armor Penetration (' + (nab && nab.stat) + ')', nab && !/Physical Attack|Armor Penetration/.test(nab.stat));
  await delay(300); await stop();
  const again = JSON.parse(fs.readFileSync(dbFile, 'utf8')), pick = d => JSON.stringify([d.users[ids.A].gear, d.users[ids.A].glyphs.boards.nox, d.users[ids.B].glyphs.boards.nox, d.users[ids.A].glyphs.finished]);
  ck('a second boot changes nothing (marker + an idempotent gear map)', pick(again) === pick(after));
  // the data: paths, tiers, steps, base AP (client + server tables)
  const prof = require(path.join(root, 'hero-profiles.js')), paths = require(path.join(root, 'server/hero-personal-glyph-paths.json')), asc = require(path.join(root, 'server/hero-ascension-bonuses.json'));
  ck('hero-profiles.js: Nox on assassin_mid for equipment and glyphs, like Veyr (the other magic assassin)', prof.nox.equipmentPath === 'assassin_mid' && prof.nox.glyphPath === 'assassin_mid' && prof.veyr.equipmentPath === 'assassin_mid' && prof.nox.damageProfile === 'Magic');
  ck('his personal glyph tiers are Veyr\'s', JSON.stringify(paths.heroes.nox.tiers) === JSON.stringify(paths.heroes.veyr.tiers));
  const st0 = cp.execSync('git show ' + BASE_SHA + ':server/hero-ascension-bonuses.json', { cwd: root }).toString(), oldSteps = JSON.parse(st0).heroes.nox.steps, M = { 'Physical Attack': 'Ability Power', 'Armor Penetration': 'Magic Penetration' };
  ck('his ascension steps: Physical Attack -> Ability Power, Armor Penetration -> Magic Penetration, the same amounts; every other step as BASE', asc.heroes.nox.steps.every((s, i) => s.amount === oldSteps[i].amount && s.pct === oldSteps[i].pct && s.stat === (M[oldSteps[i].stat] || oldSteps[i].stat)) && oldSteps.some(s => M[s.stat]));
  const sim = require(path.join(root, 'server/sim.js')).HERO_BASE, hb = JSON.parse(fs.readFileSync(path.join(root, 'hero_base.json'), 'utf8'));
  const html = fs.readFileSync(HTML, 'utf8');
  ck('base Ability Power 31 in the client (HERO_TYPES), the server sim table and hero_base.json (Veyr 34)', /nox:\{name:'Nox Quillfinger',[^}]*apow:31,/.test(html) && sim.nox.apow === 31 && hb.nox.apow === 31 && sim.veyr.apow === 34);
  // ENGINE (the page the client and the server replay both run): his spells scale on AP; fights deterministic; everyone else tick-identical
  const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'noxmagic-base-')); fs.mkdirSync(path.join(BD, 'server'));
  for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
    fs.writeFileSync(path.join(BD, f), cp.execSync('git show ' + BASE_SHA + ':' + f, { cwd: root, maxBuffer: 64 << 20 }));
  const load = f => { const h = require(path.join(root, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
  const run = load(HTML), R0 = load(path.join(BD, 'emberweave-heroes.html'));
  const ap = r => JSON.parse(r(`JSON.stringify((()=>{ const u=makeUnit('nox','ally',300,600,30,{owned:false,rank:3}); return [Math.round(u.apow),Math.round(u.dmg),heroScaleMode(u)]; })())`));
  const a1 = ap(run), a0 = ap(R0);
  ck('a level-30 Nox now has Ability Power ' + a1[0] + ' (BASE ' + a0[0] + '), the same attack (' + a1[1] + ' = ' + a0[1] + '), and scales his spells on AP (' + a1[2] + ')', a1[0] > a0[0] + 20 && a1[1] === a0[1] && a1[2] === 'ap');
  const spell = (r, mul) => JSON.parse(r(`(()=>{ units=[]; ended=false; battleTime=0; groundHazards.length=0; seedBattle(5); const g=makeUnit('nox','ally',500,700,30,{owned:false,rank:3}); g.apow*=${mul};
    const e=makeUnit('vael','enemy',560,700,30,{owned:false,rank:3}); units=[g,e]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0; u.atkCd=99; u.atkInterval=99; u.speed=0;}); g.target=e; g.glyphCrit=0;
    const hits=[]; const _dd=dealDamage; dealDamage=function(s,t,a){ if(s===g) hits.push(Math.round(a)); return _dd.apply(this,arguments); };
    g._castSM=1; g._castLv=1; castKit(g,KITS.nox.green); for(let i=0;i<Math.round(4/SIM_STEP);i++){ updateBattle(SIM_STEP); g.atkCd=99; e.atkCd=99; } dealDamage=_dd; return JSON.stringify(hits); })()`));
  const h1 = spell(run, 1), h2 = spell(run, 2);
  ck('his spell damage follows his AP: Lockpick Soul hits ' + h1.join(',') + ' at his AP, ' + h2.join(',') + ' at double AP', h1.length > 0 && h1.length === h2.length && h2.every((x, i) => Math.abs(x - 2 * h1[i]) <= 2), JSON.stringify({ h1, h2 }));
  const FIGHT = (seed, a, f) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ units.forEach(u=>{u.glyphCrit=0;}); updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return s.length+':'+h.toString(16); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
  const fight = (f, s, a, e) => load(f)(FIGHT(s, a, e));
  const WITH = [[11, ['nox', 'askel', 'lumi'], ['vael', 'tick', 'grosk']], [17, ['tharl', 'nox', 'astra'], ['sorrel', 'kharos', 'veyr']], [23, ['korvux', 'rafe', 'brannus'], ['nox', 'hobb', 'carn']]];
  const NOX = WITH.map(([s, a, e]) => fight(HTML, s, a, e)), NOX0 = WITH.map(([s, a, e]) => fight(path.join(BD, 'emberweave-heroes.html'), s, a, e));
  ck('whole fights with Nox change (' + NOX.filter((h, i) => h !== NOX0[i]).length + ' of 3) and are deterministic (the same seed twice)', NOX.some((h, i) => h !== NOX0[i]) && WITH.every(([s, a, e], i) => fight(HTML, s, a, e) === NOX[i]));
  const NO = [[11, ['askel', 'vesper', 'seyla'], ['vael', 'tick', 'lumi']], [222, ['sorrel', 'umbris', 'veyr'], ['pellucid', 'kharos', 'oakmir']], [5, ['korvux', 'rafe', 'brannus'], ['hobb', 'hurne', 'quorrel']]];
  ck('whole fights without Nox are tick-for-tick BASE (every other hero)', NO.every(([s, a, e]) => fight(HTML, s, a, e) === fight(path.join(BD, 'emberweave-heroes.html'), s, a, e)));
  ck('CONTROL: with his base AP put back to 0 the Nox fights are BASE again (the only engine change is the 31)', WITH.every(([s, a, e], i) => { const r2 = load(HTML); r2("HERO_TYPES.nox.apow=0; 1"); return r2(FIGHT(s, a, e)) === NOX0[i]; }));   // a fresh page per fight (a won fight runs on into the next wave)
  // BROWSER: the client's run of the Nox fights is the server replay's (sim-host), tick for tick
  let chromium = null; try { ({ chromium } = require(path.join(root, 'node_modules/playwright'))); } catch (e) {}
  if (!chromium || process.env.EW_NO_BROWSER) console.log('  info no playwright here / EW_NO_BROWSER - the browser replay check runs with the browser tests');
  else { await start(''); let b;
    try { b = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
      const pg = await b.newPage({ viewport: { width: 844, height: 390 } }); await pg.addInitScript(() => { try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (e) {} });
      await pg.goto(base + '/play', { waitUntil: 'load', timeout: 90000 }); await pg.waitForFunction(() => typeof makeUnit === 'function' && typeof updateBattle === 'function', null, { timeout: 90000 });
      const web = []; for (const [s, a, e] of WITH) { await pg.reload({ waitUntil: 'load', timeout: 90000 }); await pg.waitForFunction(() => typeof makeUnit === 'function' && typeof updateBattle === 'function', null, { timeout: 90000 }); web.push(await pg.evaluate(FIGHT(s, a, e))); }   // a fresh page per fight, as the replay host
      ck('BROWSER: the client\'s Nox fights are the server replay\'s tick for tick (' + web.join(' ') + ')', web.every((h, i) => h === NOX[i]), JSON.stringify({ web, NOX }));
    } finally { try { if (b) await b.close(); } catch (e) {} await stop(); } }
  fs.rmSync(BD, { recursive: true, force: true });
} catch (e) { fail++; console.error('FAIL', e && e.stack || e); } finally { await stop(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
  console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : '')); if (fail) process.exitCode = 1; })();
