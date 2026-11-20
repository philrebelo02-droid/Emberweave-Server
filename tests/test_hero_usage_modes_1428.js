// v1428 HERO USAGE - every mode (Phil 20 Nov 2026: "add the other modes to hero usage too").
// 1) server/hero-usage.js: the new modes are counted and grouped; defence views never inside "All modes"; 15-hero sides (raid 10, bonus 15).
// 2) every new battle route counts its fight, AFTER its battle call (simRun / simRunLive run a planner twice while they fetch the battle:
//    a count before the battle call counted World Map sieges twice in v1427).
// 3) the client's mode filter offers exactly the server's groups.
// CONTROL: run against v1427 907a82e13 (AUD_ROOT=<a checkout of it>) - FAILS (no new modes, siege counted before its battle).
const fs = require('fs'), path = require('path');
const root = process.env.AUD_ROOT || path.join(__dirname, '..');
let checks = 0, fails = 0; const ok = (c, m) => { checks++; if (c) console.log('  ok   ' + m); else { fails++; console.log('  FAIL ' + m); } };
try {
  const HU = require(path.join(root, 'server', 'hero-usage.js')), DB = {}, day = '2026-11-20', known = () => true;
  const modes = ['bonus', 'raid', 'skyfall', 'skyfalldef', 'mine', 'citypvp', 'citydef', 'well'];
  for (const m of modes) ok(HU.note(DB, day, m, ['ash'], true, known) === true, 'mode counted: ' + m);
  const fifteen = Array.from({ length: 15 }, (_, i) => 'h' + i);
  HU.note(DB, day, 'bonus', fifteen, true, known);
  ok(Object.keys(DB.heroUsage.days[day].bonus.h).length === 16, 'a 15-hero bonus run counts all 15 heroes');
  const all = HU.view([{ server: '1', days: DB.heroUsage.days }], day, 1, 'all');
  ok(all.fights === 7, '"All modes" leaves the defence views out (6 attack modes + the 15-hero run = 7 fights, got ' + all.fights + ')');
  const world = HU.view([{ server: '1', days: DB.heroUsage.days }], day, 1, 'world');
  ok(world.fights === 2, 'World Map = mines + City PvP (+ sieges): 2 fights (got ' + world.fights + ')');
  for (const g of ['bonus', 'raid', 'skyfall', 'skyfalldef', 'citydef', 'well'])
    ok(HU.view([{ server: '1', days: DB.heroUsage.days }], day, 1, g).fights >= 1, 'its own view: ' + g);
  ok(JSON.stringify(Object.keys(HU.clean({ [day]: DB.heroUsage.days[day] })[day]).sort()) === JSON.stringify(['bonus', 'citydef', 'citypvp', 'mine', 'raid', 'skyfall', 'skyfalldef', 'well'].sort()),
    'a satellite report keeps the new modes');

  const srv = fs.readFileSync(path.join(root, 'server.js'), 'utf8'), well = fs.readFileSync(path.join(root, 'server', 'starless-well.js'), 'utf8');
  const after = (call, battle, what) => { const i = srv.indexOf(call), j = srv.lastIndexOf(battle, i); ok(i > 0 && j > 0 && i - j < 6000, what + ' - counted after its battle call'); };
  after("heroUsageNote(me,'siege',march.heroIds,won)", 'rep=host.auto(march.snaps,march.foe', 'World Map siege');
  after("heroUsageNote(me,'mine',march.heroIds,battle.won)", 'const battle=host.auto(march.snaps,garrison,seed)', 'World Map mine');
  after("heroUsageNote(me,'citypvp',ids,fight.won)", 'host.auto(', 'City PvP (bot castle)');
  after("heroUsageNote(me,'citypvp',ids,won)", 'won=fight.won', 'City PvP (player city)');
  after("heroUsageNote(me,'skyfall',attacker.lineSnapshot.map(h=>h.key),r.won)", "liveBattle('line'", 'Skyfall');
  ok(/heroUsageNote\(DB\.users\[defender\.memberId\],'skyfalldef',defender\.lineSnapshot\.map\(h=>h\.key\),!r\.won\)/.test(srv), 'Skyfall defending line counted for its owner');
  ok(/if\(defSnaps\.length\)\{ heroUsageNote\(me,'citypvp',ids,won\); if\(!d\.isNpc\) heroUsageNote\(d,'citydef',defOwned,!won\); \}/.test(srv), 'City PvP: no defenders = no fight; the defending city counted only with its own heroes');
  ok(/const _ba=\(L\.bonus&&L\.bonus\.att\)\|\|null;[\s\S]{0,400}heroUsageNote\(me,'bonus',Object\.values\(_ba\.assign\|\|\{\}\)\.flat\(\),!!r\.body\.won\)/.test(srv), 'bonus stages: squad kept before resolveRun clears it, counted inside the idem');
  ok(/heroUsageNote\(du,'raid',sa\.heroIds,killed\);\s*\/\/[^\n]*\n\s*return \{ ok:true, dmg, killed/.test(srv), 'guild raid: counted inside the durable commit (win = boss felled)');
  ok(/WELL2\.handle\(p, req\.method, \{ me, led, heroUsageNote,/.test(srv) && /ctx\.heroUsageNote\(ctx\.me, 'well', a\.heroIds, witnessed\.won\)/.test(well), 'Starless Well: counted inside the module (its idem)');
  ok((srv.match(/heroUsageNote\(me,'siege'/g) || []).length === 1, 'the siege is counted once');

  const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8'), m = html.match(/const HU_MODES=(\[\[[\s\S]*?\]\]);/);
  const client = m ? JSON.parse(m[1].replace(/'/g, '"')).map(x => x[0]) : [];
  ok(client[0] === 'all' && JSON.stringify(client.slice(1).sort()) === JSON.stringify(Object.keys(HU.HU_GROUPS).sort()), 'the window offers exactly the server\'s groups (' + client.join(',') + ')');
} catch (e) { fails++; console.log('  FAIL ' + (e && e.stack || e)); }
console.log(fails ? 'FAIL ' + fails + ' of ' + checks : 'PASS ' + checks + ' checks (hero usage counts every mode with a server-side fight)'); process.exit(fails ? 1 : 0);
