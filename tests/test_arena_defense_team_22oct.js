// 22 Oct 2026 (Phil: "Make it real"): the Arena defense team picked under Defenders -> Adjust (G.arenaDef) lived only on the
// device; every defense fought with me.team (ChatGPT's run-ahead audit, confirmed by Claude + Grok). Now the save carries it,
// the server stores it like the team, and the opponent previews and the real defense fight use it (main team when none is set).
// Runs the real arenaDefTeam / sanitizeRoster / rosterKeys from server.js; checks every reader and the client's save payload.
// Not an end-to-end fight (two fresh accounts cannot be made each other's opponent here) - Phil checks that in the sim.
// Usage: node test_arena_defense_team_22oct.js [repo root]
const fs = require('fs'), path = require('path');
const root = process.argv[2] || path.join(__dirname, '..');
const srv = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
let fail = 0, n = 0;
const check = (ok, what) => { n++; if (!ok) { fail++; console.log('FAIL: ' + what); } };
// the whole function by brace matching (strings and regex literals in these three hold no braces)
const fn = name => { const i = srv.indexOf('function ' + name + '('); if (i < 0) return null;
  let d = 0, j = srv.indexOf('{', i); for (; j < srv.length; j++) { if (srv[j] === '{') d++; else if (srv[j] === '}' && --d === 0) return srv.slice(i, j + 1); }
  return null; };

// 1) the client's save sends the defense team
check(/arenaDef:teamPayload\(\(G\.arenaDef\|\|\[\]\)\.filter\(Boolean\)\)/.test(html), 'the client save does not send G.arenaDef');
// 2) the save route stores it, cleaned like the team
check(/if\(Array\.isArray\(b\.arenaDef\)\) me\.arenaDef=sanitizeRoster\(b\.arenaDef\);/.test(srv), 'the save route does not store arenaDef via sanitizeRoster');
// 3) every Arena defender read goes through arenaDefTeam (no raw opp.team / o.team / u.team left in them)
check(/team:hydrateRoster\(o,arenaDefTeam\(o\)\)/.test(srv), '/api/arena/opponent preview does not use the defense team');
check(/team:hydrateRoster\(u,arenaDefTeam\(u\)\)/.test(srv), '/api/arena/opponents preview does not use the defense team');
check(/opSnaps=rosterKeys\(arenaDefTeam\(opp\)\)\.filter\(k=>opLed&&ownsHeroK\(opLed,k\)\)/.test(srv), 'the real defense fight does not use the defense team');
// 4) the helper's behaviour, with the server's own sanitizeRoster and rosterKeys
const helper = fn('arenaDefTeam'), san = fn('sanitizeRoster'), keys = fn('rosterKeys');
check(!!helper && !!san && !!keys, 'arenaDefTeam / sanitizeRoster / rosterKeys not found');
if (helper && san && keys) {
  const SIM = require(path.join(root, 'server', 'sim.js'));   // the real hero table sanitizeRoster checks keys against
  const ctx = Function('SIM', san + '\n' + keys + '\n' + helper + '\nreturn {sanitizeRoster, rosterKeys, arenaDefTeam};')(SIM);
  const def = ctx.sanitizeRoster([{ key: 'vireo', level: 999, rank: 99 }, { key: 'vael' }]);
  const team = ctx.sanitizeRoster([{ key: 'sylthaine' }, { key: 'vael' }, { key: 'vireo' }]);
  const set = { team, arenaDef: def }, unset = { team }, empty = { team, arenaDef: [] }, npc = { isNpc: true, team: [{ key: 'grosk' }], arenaDef: def };
  check(JSON.stringify(ctx.rosterKeys(ctx.arenaDefTeam(set))) === JSON.stringify(['vireo', 'vael']), 'a set defense team is not what defends: ' + JSON.stringify(ctx.rosterKeys(ctx.arenaDefTeam(set))));
  check(JSON.stringify(ctx.rosterKeys(ctx.arenaDefTeam(unset))) === JSON.stringify(['sylthaine', 'vael', 'vireo']), 'with no defense team the main team should defend');
  check(JSON.stringify(ctx.rosterKeys(ctx.arenaDefTeam(empty))) === JSON.stringify(['sylthaine', 'vael', 'vireo']), 'an empty defense team should fall back to the main team');
  check(ctx.arenaDefTeam(npc) === npc.team, 'an NPC must keep its own team');
  check(!JSON.stringify(def).includes('999'), 'sanitizeRoster kept a client-sent level (the ledger supplies stats)');
}
console.log(fail ? 'FAIL ' + fail + ' of ' + n : 'PASS ' + n + ' checks (the Arena defense team is saved, stored and used to defend)');
process.exit(fail ? 1 : 0);
