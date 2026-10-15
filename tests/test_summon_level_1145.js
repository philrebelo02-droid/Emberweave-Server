/* v1145 - A SUMMON'S LEVEL COMES FROM THE FIGHT, NOT FROM THIS DEVICE'S SAVE.
   15 Oct 2026 proof sweep (Phil: "every 1-10 fight logged battle replay incident (digest-mismatch)"). On live Server 1 every
   campaign digest miss had Hurne in the squad; the same squad with Vael in his place matched. summonUnit() built the summon with
   makeUnit(..., heroLevel(owner.key)) - heroLevel() reads the browser's LOCAL save (G.heroXP / G.playerXP). The player's browser
   built Hurne's boars at his real level; the server's replay (server/sim-host.js: a blank G) built them at level 1. Same snaps,
   seed, waves and transcript - two different fights, so every Hurne fight was logged as a replay incident (and filed a review
   flag), and any server-decided fight with a summoner (arena, city) ran weaker summons than the player saw.
   Now a summon takes its owner's own fight level (owner.lvl, from the server's snapshot).
   The check: the server engine replays three real tester fights (fixture) with a blank local save and with the player's local
   save - the digests must be identical, and summons must actually have been made. Control: a repeat of each run is identical.
   Asserts (non-zero exit). */
const assert = require('assert'), path = require('path'), vm = require('vm'), fs = require('fs');
const root = path.join(__dirname, '..');
const host = require(path.join(root, 'server', 'sim-host.js')).load(path.join(root, 'emberweave-heroes.html'));
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'summon_level_1145.json'), 'utf8'));
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok ' + m); };
vm.runInContext(`window.__sc=[]; const __su=summonUnit; summonUnit=function(o,k){ const u=__su.apply(this,arguments); if(u) window.__sc.push(k+'@'+u.lvl); return u; };`, host.ctx);
const saved = vm.runInContext('JSON.stringify({heroXP:G.heroXP||{}, playerXP:G.playerXP||0})', host.ctx);
const blankG = () => vm.runInContext(`(function(){ const s=${saved}; G.heroXP=JSON.parse(JSON.stringify(s.heroXP)); G.playerXP=s.playerXP; })()`, host.ctx);
const playerG = () => vm.runInContext('(function(){ G.heroXP={}; for(const k in HERO_TYPES) G.heroXP[k]=1152; G.playerXP=1212; })()', host.ctx);
const run = f => { vm.runInContext('window.__sc.length=0', host.ctx); const r = host.campaign(f.snaps, f.waves, f.seed >>> 0, f.log); return { d: r.digest, sc: vm.runInContext('JSON.stringify(window.__sc)', host.ctx) }; };
console.log('== v1145: a summon is built at its owner\'s fight level, never from the device save ==');
for (const f of FX.fights) {
  blankG(); const A = run(f), A2 = run(f); playerG(); const B = run(f), B2 = run(f); blankG();
  const owner = f.snaps.find(s => s.key === 'hurne').level;
  ok(JSON.parse(A.sc).length > 0, 'stage node ' + f.node + ' seed ' + f.seed + ': Hurne summoned (' + JSON.parse(A.sc).length + ' summons) - the path is exercised');
  ok(A.d === A2.d && B.d === B2.d, 'CONTROL: a repeat of the same replay is byte-identical');
  ok(JSON.parse(A.sc).every(s => s.endsWith('@' + owner)), 'with a blank save (the server) every summon is at Hurne\'s fight level ' + owner + ' - got ' + A.sc.slice(0, 80));
  ok(A.d === B.d, 'the player\'s local save does not change the fight: blank-save replay == player-save replay');
}
console.log(''); console.log('PASS: ' + pass + '  FAIL: 0');
