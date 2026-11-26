// Vault re-ramp 24 Nov (Phase 2, block 81-100): pin the SHAPE of the tuned table so a later
// edit cannot silently flatten the curve or un-tune a floor. Pure file checks - no server boot.
// Asserts (non-zero exit).
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const enc = JSON.parse(fs.readFileSync(path.join(root, 'server', 'vault-encounters.json'), 'utf8'));
const floors = enc.floors;
let pass = 0;
const ok = (c, m) => { assert(c, m); pass++; console.log('  ✓ ' + m); };

const MODEL = 'kimi-vault-ladder-24NOV2026';
const first = 81, last = 100;

// 1. the block exists and is stamped with this tuning run
for (let f = first; f <= last; f++) {
  const e = floors[f - 1];
  ok(e && e.floor === f, `floor ${f} is present at index ${f - 1}`);
  ok(e.tunedFor && e.tunedFor.model === MODEL, `floor ${f} tunedFor names ${MODEL}`);
  ok(Number.isFinite(e.recommendedPower) && e.recommendedPower > 0, `floor ${f} has a positive recommendedPower (${e.recommendedPower})`);
}

// 2. recommendedPower never falls UNLESS the authored level dips (post-boss dip is in the floor->level table)
for (let f = first + 1; f <= last; f++) {
  const a = floors[f - 2], b = floors[f - 1];
  const lvlDip = b.tunedFor.level < a.tunedFor.level;
  if (lvlDip) {
    ok(b.recommendedPower <= a.recommendedPower * 1.02, `floor ${f}: level dips ${a.tunedFor.level}->${b.tunedFor.level}, recommendedPower ${a.recommendedPower}->${b.recommendedPower} may dip`);
  } else {
    ok(b.recommendedPower >= a.recommendedPower, `floor ${f} recommendedPower does not fall (${a.recommendedPower} -> ${b.recommendedPower})`);
  }
}

// 3. boss floors carry their rule
for (const f of [85, 90, 95, 100]) {
  const e = floors[f - 1];
  ok(e.bossRule && e.bossRule.id && e.bossRule.warn, `floor ${f} boss floor keeps its bossRule (${e.bossRule && e.bossRule.id})`);
}

// 4. every monster entry is sane: positive multipliers, real level
for (let f = first; f <= last; f++) {
  const e = floors[f - 1];
  let n = 0;
  for (const w of e.waves) for (const m of w) {
    n++;
    assert(m.hpMul > 0 && m.dmgMul > 0, `floor ${f} monster ${m.key} has non-positive multipliers`);
    assert(m.lvl >= 1 && m.lvl <= 130, `floor ${f} monster ${m.key} lvl ${m.lvl} out of range`);
  }
  ok(n >= 4, `floor ${f} has its waves (${n} monsters)`);
}

// 5. the block as a whole got harder than the old table's floor 80 (no slip back to pre-ramp numbers)
const f80 = floors[79].recommendedPower;
const f100 = floors[99].recommendedPower;
ok(f100 > f80, `floor 100 recommendedPower (${f100}) is above floor 80's (${f80})`);

console.log(`test_vault_shape_81_100: ${pass} passed, 0 failed`);
