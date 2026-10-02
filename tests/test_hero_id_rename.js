/* HERO-ID RENAME (v926) fixture/control proof — spec 26SEP2026 "RENAME OLD HERO IDS":
   a fixture save containing every old id (unlocked, frags, glyphs, stars, skills, team) loads after
   the rename with every hero, level, star, skill and glyph intact; a CONTROL save with a deliberately
   unmapped id FAILS the check (i.e. the unmapped id survives untouched and is detected).
   The migration functions under test are extracted verbatim from the shipped server.js source.
   Run: node tests/test_hero_id_rename.js   (exit 0 = PASS) */
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// Extract the migration block verbatim from server.js (from HERO_ID_RENAME to migrateHeroIdsBlob).
const start = src.indexOf('const HERO_ID_RENAME=');
const end = src.indexOf('function migrateHeroIdsBlob');
if (start < 0 || end < 0) { console.error('FAIL: migration block not found in server.js'); process.exit(1); }
const block = src.slice(start, src.indexOf('\n', src.indexOf('return _renameIdKeysDeep(g);')) + 1);
// Load the verbatim block in an isolated scope (strict-mode eval would keep the functions private).
const factory = new Function('DB', '_bootDirty', block + '\nreturn { HERO_ID_RENAME, _renameIdKeysDeep, migrateHeroIdsUser, migrateHeroIdsAll, migrateHeroIdsBlob };');
const M = factory({ users: {} }, false);
const { HERO_ID_RENAME, _renameIdKeysDeep, migrateHeroIdsUser, migrateHeroIdsAll, migrateHeroIdsBlob } = M;

const OLD = ['tallow','vharn','fathom','sprocket','sablewick','arrears','meryln'];
const NEW = ['gruel','korvux','maren','rivet','tessit','grimsby','dandra'];
const MAP = {tallow:'gruel',vharn:'korvux',fathom:'maren',sprocket:'rivet',sablewick:'tessit',arrears:'grimsby',meryln:'dandra'};

let failures = 0;
function ok(cond, msg){ if(cond) console.log('  ok -', msg); else { console.error('  FAIL -', msg); failures++; } }

// ---- FIXTURE: every old id in every storage position -------------------------------
const fixtureLed = {
  hero: {}, unlocked: {}, frags: {}, xpPotions: {}, xpPotionUsed: {},
  temple: { heroes: {} },
};
for (const k of OLD) {
  fixtureLed.hero[k] = { xp: 12345, stars: 3, pips: 2, ref: 1 };
  fixtureLed.unlocked[k] = true;
  fixtureLed.frags[k] = 17;
  fixtureLed.xpPotions[k] = 4;
  fixtureLed.xpPotionUsed[k] = 2;
  fixtureLed.temple.heroes[k] = { cinders: { bar1: 10 } };
}
const fixtureUser = {
  led: fixtureLed,
  team: OLD.slice(0, 5).map(k => ({ key: k, name: 'x' })),
  wall: [{ key: 'meryln' }],
  roster: { __save: JSON.stringify({
    unlocked: Object.fromEntries(OLD.map(k => [k, true])),
    heroXP: Object.fromEntries(OLD.map(k => [k, 999])),
    starLevel: Object.fromEntries(OLD.map(k => [k, 3])),
    skillLevel: Object.fromEntries(OLD.map(k => [k, 5])),
    glyphRank: Object.fromEntries(OLD.map(k => [k, 2])),
    glyphs: Object.fromEntries(OLD.map(k => [k, ['g1']])),
    frags: Object.fromEntries(OLD.map(k => [k, 8])),
    team: OLD.slice(0, 3),
    arenaDef: ['vharn', 'tallow'],
    squads: { 'Fathom': ['tallow', 'meryln'], 'my team': ['vharn'] },  // squad NAMES are player-chosen
    avatarHero: 'sprocket',
  }) },
};

console.log('== fixture: server ledger/profile migration ==');
const changed = migrateHeroIdsUser(fixtureUser);
ok(changed === true, 'migration reports changes');
ok(fixtureUser.led.idv === 2, 'ledger stamped idv=2');
for (const k of OLD) {
  const n = MAP[k];
  ok(fixtureLed.hero[n] && fixtureLed.hero[n].xp === 12345 && fixtureLed.hero[n].stars === 3 && fixtureLed.hero[n].pips === 2 && fixtureLed.hero[n].ref === 1, `led.hero ${k}->${n} intact (xp/stars/pips/ref)`);
  ok(fixtureLed.hero[k] === undefined, `old led.hero.${k} gone`);
  ok(fixtureLed.unlocked[n] === true && fixtureLed.unlocked[k] === undefined, `unlocked ${k}->${n}`);
  ok(fixtureLed.frags[n] === 17 && fixtureLed.xpPotions[n] === 4 && fixtureLed.xpPotionUsed[n] === 2, `frags/potions ${k}->${n}`);
  ok(fixtureLed.temple.heroes[n] && fixtureLed.temple.heroes[n].cinders.bar1 === 10, `temple heroes ${k}->${n}`);
}
ok(fixtureUser.team.map(h => h.key).join() === NEW.slice(0, 5).join(), 'team[].key renamed');
ok(fixtureUser.wall[0].key === 'dandra', 'wall[].key renamed');

console.log('== fixture: idempotence ==');
const xp2 = JSON.stringify(fixtureUser.led);
ok(migrateHeroIdsUser(fixtureUser) === false, 'second run is a no-op (idv=2 stamped)');
ok(JSON.stringify(fixtureUser.led) === xp2, 'ledger byte-identical after second run');

console.log('== fixture: save-blob translate (ingest boundary) ==');
const blob = JSON.parse(fixtureUser.roster.__save);
ok(migrateHeroIdsBlob(blob) === true, 'blob migration reports changes');
for (const k of OLD) {
  const n = MAP[k];
  ok(blob.unlocked[n] === true && blob.heroXP[n] === 999 && blob.starLevel[n] === 3 && blob.skillLevel[n] === 5 && blob.glyphRank[n] === 2, `blob maps ${k}->${n} intact`);
  ok(blob.glyphs[n][0] === 'g1' && blob.frags[n] === 8, `blob glyphs/frags ${k}->${n}`);
}
ok(blob.team.join() === NEW.slice(0, 3).join(), 'blob team array renamed');
ok(blob.arenaDef.join() === 'korvux,gruel', 'blob arenaDef renamed');
ok(blob.squads['Fathom'] && blob.squads['Fathom'].join() === 'gruel,dandra', "squad CONTENTS renamed, squad NAME 'Fathom' (player-chosen) untouched");
ok(blob.squads['my team'].join() === 'korvux', 'second squad contents renamed');
ok(blob.avatarHero === 'rivet', 'avatarHero renamed');

console.log('== control: unmapped id must survive (and be detectable) ==');
const controlBlob = { unlocked: { notahero: true, tallow: true }, team: ['notahero', 'tallow'] };
migrateHeroIdsBlob(controlBlob);
const leftover = Object.keys(controlBlob.unlocked).filter(k => !NEW.includes(k));
ok(controlBlob.unlocked.notahero === true, 'unmapped id "notahero" preserved');
ok(controlBlob.team[0] === 'notahero', 'unmapped id in arrays preserved');
ok(leftover.includes('notahero'), 'control FAIL check: leftover scan detects the unmapped id');
ok(!leftover.includes('tallow') && controlBlob.unlocked.gruel === true, 'no old id left except the deliberate control');

console.log(failures ? `\nFAILED (${failures})` : '\nPASS');
process.exit(failures ? 1 : 0);
