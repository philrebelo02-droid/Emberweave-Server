// 29 Oct 2026 (Phil: "Adren green and ult"): a hero whose game ult is a summon summons it in the Spire; every other ult is unchanged
const C = require('../server/survivors-core.js'); let n = 0; const ok = (c, m) => { if (!c) { console.error('FAIL ' + m); process.exit(1); } n++; };
const S = C.create({ key: 'aldren', cls: 'Mage', maxHp: 3000, atk: 200, skills: [], ultSummon: { unit: 'ink horror', n: 1, dur: 22, power: 0.8 } }, { mode: 'story', stage: 1, seed: 7 });
S.hero.ult = S.hero.ultMax; C.step(S, { mx: 0, my: 0, ult: true });
ok((S.allies || []).length === 1 && S.allies[0].unit === 'ink horror', 'ult summons one Elder Ink Horror'); ok(S.hero.ult === 0, 'ult spent');
ok(S.fx.some(f => f.kind === 'ult' && f.summon), 'ult fx marked summon');
const T = C.create({ key: 'x', cls: 'Mage', maxHp: 3000, atk: 200, skills: [] }, { mode: 'story', stage: 1, seed: 7 }); T.hero.ult = T.hero.ultMax; C.step(T, { mx: 0, my: 0, ult: true });
ok(!(T.allies || []).length && T.hero.ult === 0, 'a normal ult summons nothing');
const R = C.restore(JSON.parse(JSON.stringify(C.snapshot(S))), []); ok(R.hero.ultSummon && R.hero.ultSummon.unit === 'ink horror', 'ultSummon survives save/continue');
console.log('PASS ' + n);
