// 22 Oct 2026 - three display fixes from the building sweep (ChatGPT's second pass, Ember's Sky Island sweep; peer-checked by Grok):
//  1) Watchtower: the shared projection dropped 'defend', so a player's own stationed defender was listed as an incoming attack.
//  2) Campaign: the stage details read Normal's stars on every mode ("sweepable" on Veteran while the button said Needs 3 stars).
//  3) Offline grantRewards: a "+80 gold" nothing paid, beside a dead kind:'tower' call (the hidden ladder is retired, server 8531).
// Usage: node test_display_fixes_22oct.js [repo root]
const fs = require('fs'), path = require('path'), Module = require('module');
const root = process.argv[2] || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
let fail = 0, n = 0;
const check = (ok, what) => { n++; if (!ok) { fail++; console.log('FAIL: ' + what); } };

// 1) Watchtower: run the real snapshot() with summarize() stubbed to return one stationed defender and one real attack
const watchPath = path.join(root, 'server', 'world-watch-state.js');
const marchPath = path.join(root, 'server', 'world-march-state.js');
const stub = new Module(marchPath); stub.filename = marchPath; stub.loaded = true;
stub.exports = { summarize: () => ({ marches: [
  { id: 'd1', kind: 'city', defend: true, phase: 'stationed', defId: 'c9', arriveInMs: 0 },
  { id: 'a1', kind: 'city', phase: 'outbound', defId: 'c7', arriveInMs: 5000 } ] }) };
require.cache[require.resolve(marchPath)] = stub;
delete require.cache[require.resolve(watchPath)];
const { snapshot } = require(watchPath);
const me = { id: 'u1', name: 'Phil' };
const rows = snapshot({ users: { u1: me }, guilds: {} }, me, 1000).mates[0].marches;
const def = rows.find(r => r.id === 'd1'), atk = rows.find(r => r.id === 'a1');
check(def && def.defend === true, 'the stationed defender lost its defend flag in the Watchtower projection');
check(atk && !atk.defend, 'a real attack is marked as defend');
// and the client's attack filter (html) drops exactly the defender
const filt = /if\(\(m\.kind!=='city'&&m\.kind!=='mine'\)\|\|m\.defend\)return;/.test(html);
check(filt, 'the Watchtower attack filter on m.defend is missing');
const shown = rows.filter(m => !((m.kind !== 'city' && m.kind !== 'mine') || m.defend)).map(m => m.id);
check(shown.length === 1 && shown[0] === 'a1', 'the Watchtower would list ' + JSON.stringify(shown) + ' as attacks (want only a1)');

// 2) Campaign: stage details use the selected mode's stars
const sig = /function stageDetailHTML\(stg,node,mode\)\{ mode=mode\|\|PORTAL\|\|'normal';/.test(html);
check(sig, 'stageDetailHTML does not take the mode');
check(/\$\{portalStars\(mode,node\)>=3\?/.test(html) && !/G\.stageStars&&G\.stageStars\[node\]\)\|0\)>=3\?\(\(isEliteStage/.test(html),
      'the stage details still read Normal stars (G.stageStars) for sweepability');
const calls = (html.match(/[^ ]stageDetailHTML\(([^)]*)\)/g) || []).filter(c => !/function stageDetailHTML/.test(c));
check(calls.length >= 2 && calls.every(c => /,mode\)$/.test(c)), 'not every stageDetailHTML call passes the mode: ' + JSON.stringify(calls));
const ps = (html.match(/function portalStars\(m,node\)\{[\s\S]*?\}\n?/) || [''])[0];
const portalStars = Function('G', ps + '; return portalStars;')({ stageStars: { 1: 3 }, portals: { veteran: { stars: { 1: 0 } } } });
check(portalStars('veteran', 1) === 0 && portalStars('normal', 1) === 3, 'portalStars does not separate the modes');

// 3) the "+80 gold" nothing pays, and the dead kind:'tower' call
check(!/\+12 trophies · <span class="coins">\$\{hudIcon\('gold'\)\} \+80<\/span>/.test(html), 'the offline result still shows +80 gold that nothing pays');
check(!/if\(ACC\.token\) api\('\/api\/trial\/resolve','POST',\{kind:'tower'/.test(html), "the dead kind:'tower' call is still live code");

console.log(fail ? 'FAIL ' + fail + ' of ' + n : 'PASS ' + n + ' checks (Watchtower defenders, Campaign mode stars, no unpaid +80 gold)');
process.exit(fail ? 1 : 0);
