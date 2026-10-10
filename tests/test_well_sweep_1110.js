// v1110 (Phil 10 Oct 2026: "sweeping gives about 15% less raw rewards than doing it flat out, like diamonds gold and exp pots. Exp is
// the same" / "I think actually change it to 20% not 15%" / "every battle you win its meant to reward gold and exp pots, there should
// also be chests that offer some diamonds"). Checks the Starless Well rules in server/starless-well.js. Exit code = failures.
'use strict';
const fs = require('fs'), path = require('path');
const W = require(path.join(__dirname, '..', 'server', 'starless-well.js'));
const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'starless-well.js'), 'utf8');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) bad++; };

// a standard run, played, at level L on a path: fights at columns 1, 3, 5 + boss per map (map 1 Normal), one small chest per map
function played(L, p) {
  const G = 600 + 90 * L, t = { gold: 0, gems: 0, potions: 0 };
  for (let map = 1; map <= 3; map++) {
    const hard = p === 'hard' && map > 1;
    for (const col of [1, 3, 5, 6]) { const boss = col === 6;
      t.gold += Math.round(G * (hard ? 1.5 : 1) * (boss ? 2 : 1)); t.gems += boss ? (hard ? 30 : 15) : (col === 5 ? 5 : 0); t.potions += boss ? 2 : 1; }
    t.gold += 400 + 60 * L; t.gems += 5; t.potions += 1;
  }
  return t;
}
for (const [L, p] of [[61, 'normal'], [75, 'normal'], [75, 'hard'], [90, 'hard'], [100, 'hard']]) {
  const s = W.sweepPrize({ playerLevel: () => L }, { run: { level: 0 } }, p), f = played(L, p);
  const share = k => s[k] / f[k];
  ok(Math.abs(share('gold') - 0.8) < 0.001 && Math.abs(share('gems') - 0.8) < 0.02 && Math.abs(share('potions') - 0.8) < 0.04,
     `Lv ${L} ${p}: sweep pays 80% of a played standard run (gold ${s.gold}/${f.gold}, diamonds ${s.gems}/${f.gems}, potions ${s.potions}/${f.potions})`);
}
// control: the old sweep paid the end XP only - a sweep must now pay gold, diamonds and potions
const s75 = W.sweepPrize({ playerLevel: () => 75 }, { run: { level: 0 } }, 'hard');
ok(s75.gold > 0 && s75.gems > 0 && s75.potions > 0, 'control: a sweep is no longer end-XP only');
// the sweep handler credits gold, diamonds and potions and still pays the full end XP
ok(/creditGold\(ctx\.me, ctx\.led, sp\.gold, 'well:sweep'\)/.test(src) && /creditGems\(ctx\.me, ctx\.led, sp\.gems, 'well:sweep'\)/.test(src), 'the sweep credits gold and diamonds');
ok(/const xp = endXP\(ctx, path\); if \(xp > 0\) ctx\.ledAddPlayerXP/.test(src), 'the sweep still pays the full end XP');
// every fight won pays an XP potion; every chest has diamonds
ok(/potions: boss \? 2 : 1 \}/.test(src), 'every fight won pays at least 1 XP potion (boss 2)');
ok(/gems: sq\.big \? 15 : 5,/.test(src), 'every chest pays diamonds (small 5, big 15)');
console.log('test_well_sweep_1110.js: ' + (bad ? bad + ' failed' : 'all passed'));
process.exit(bad ? 1 : 0);
