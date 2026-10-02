/* HERO-ID RENAME (v926; v929 audit extension) fixture/control proof — spec 26SEP2026 "RENAME OLD HERO IDS":
   a fixture save containing every old id (unlocked, frags, glyphs, stars, skills, team) loads after
   the rename with every hero, level, star, skill and glyph intact; a CONTROL save with a deliberately
   unmapped id FAILS the check (i.e. the unmapped id survives untouched and is detected).
   v929 (Claude's audit on a copy of the LIVE player DB) found the v926 pass missed u.roster line-ups
   (incl. ladder bots, which have no ledger), glyphs.boards, glyph application receipts, frozen battle
   snapshots, and the roster.__save cloud-blob string. Those paths are asserted here too.
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
  txs: [ { id: 1, t: 1, src: 'glyph-build', d: { hero: 'arrears', slot: 2 } },   // ledger HISTORY: plain record, no hash chain
           { id: 2, t: 2, src: 'march', d: { key: 'sablewick', floor: 3 } } ],
};
for (const k of OLD) {
  fixtureLed.hero[k] = { xp: 12345, stars: 3, pips: 2, ref: 1 };
  fixtureLed.unlocked[k] = true;
  fixtureLed.frags[k] = 17;
  fixtureLed.xpPotions[k] = 4;
  fixtureLed.xpPotionUsed[k] = 2;
  fixtureLed.temple.heroes[k] = { cinders: { bar1: 10 } };
}
// v929 positions found by the live-DB audit (were MISSED by the v926 pass):
const OLD_BLOB = {   // the stored client save blob (a STRING inside roster.__save)
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
};
const fixtureUser = {
  led: fixtureLed,
  team: OLD.slice(0, 5).map(k => ({ key: k, name: 'x' })),
  wall: [{ key: 'meryln' }],
  glyphs: {   // server-owned glyph state
    revision: 7,
    boards: Object.fromEntries(OLD.map(k => [k, { ascended: 3, slots: { s1: 'g11' } }])),
    applied: { rid1: { ok: true, hero: 'tallow', slot: 1 }, rid2: { ok: true, hero: 'vharn', slot: 2 } },
  },
  arenaDefenses: [   // frozen battle snapshots (the "mineSnap" the audit flagged)
    { v: 2, seed: 42, mineSnap: [{ key: 'fathom', hp: 100 }], foe: [{ key: 'sablewick', hp: 90 }], won: true, atkName: 'x', t: 1 },
  ],
  roster: { __save: JSON.stringify(OLD_BLOB) },
};

console.log('== fixture: server ledger/profile migration ==');
const changed = migrateHeroIdsUser(fixtureUser);
ok(changed === true, 'migration reports changes');
ok(fixtureUser.led.idv === 3, 'ledger stamped idv=3');
for (const k of OLD) {
  const n = MAP[k];
  ok(fixtureLed.hero[n] && fixtureLed.hero[n].xp === 12345 && fixtureLed.hero[n].stars === 3 && fixtureLed.hero[n].pips === 2 && fixtureLed.hero[n].ref === 1, `led.hero ${k}->${n} intact (xp/stars/pips/ref)`);
  ok(fixtureLed.hero[k] === undefined, `old led.hero.${k} gone`);
  ok(fixtureLed.unlocked[n] === true && fixtureLed.unlocked[k] === undefined, `unlocked ${k}->${n}`);
  ok(fixtureLed.frags[n] === 17 && fixtureLed.xpPotions[n] === 4 && fixtureLed.xpPotionUsed[n] === 2, `frags/potions ${k}->${n}`);
  ok(fixtureLed.temple.heroes[n] && fixtureLed.temple.heroes[n].cinders.bar1 === 10, `temple heroes ${k}->${n}`);
  ok(fixtureUser.glyphs.boards[n] && fixtureUser.glyphs.boards[n].ascended === 3 && fixtureUser.glyphs.boards[k] === undefined, `glyphs.boards ${k}->${n}`);
}
ok(fixtureUser.glyphs.applied.rid1.hero === 'gruel' && fixtureUser.glyphs.applied.rid2.hero === 'korvux', 'glyph application receipt .hero values renamed');
ok(fixtureUser.glyphs.applied.rid1.ok === true && fixtureUser.glyphs.revision === 7, 'glyph receipt non-id fields untouched');
ok(fixtureUser.arenaDefenses[0].mineSnap[0].key === 'maren' && fixtureUser.arenaDefenses[0].foe[0].key === 'tessit', 'arenaDefenses mineSnap/foe snapshot keys renamed');
ok(fixtureUser.arenaDefenses[0].seed === 42 && fixtureUser.arenaDefenses[0].won === true, 'snapshot non-id fields untouched');
ok(fixtureLed.txs[0].d.hero === 'grimsby' && fixtureLed.txs[1].d.key === 'tessit', 'ledger tx history d.hero/d.key renamed (no hash chain)');
ok(fixtureUser.team.map(h => h.key).join() === NEW.slice(0, 5).join(), 'team[].key renamed');
ok(fixtureUser.wall[0].key === 'dandra', 'wall[].key renamed');

console.log('== fixture: idempotence ==');
const xp2 = JSON.stringify(fixtureUser.led);
ok(migrateHeroIdsUser(fixtureUser) === false, 'second run is a no-op (idv=3 stamped)');
ok(JSON.stringify(fixtureUser.led) === xp2, 'ledger byte-identical after second run');

console.log('== fixture: save-blob translate (ingest boundary) ==');
// NOTE: migrateHeroIdsUser now translates roster.__save itself, so use a FRESH old-format blob here.
const blob = JSON.parse(JSON.stringify(OLD_BLOB));
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

console.log('== fixture: boot sweep incl. ladder bots + dungeonProgress (v929 audit) ==');
function botUser(){ return { id: 'bot1', name: 'Bot', isNpc: true, roster: OLD.map((k, i) => ({ key: k, level: 100, rank: i % 4 })) }; }   // bots have NO ledger
function freshLedUser(){ return { led: { v: 1, unlocked: { tallow: true, vharn: true }, frags: { tallow: 5 }, hero: { tallow: { xp: 1 } }, temple: { heroes: {} }, txs: [] }, team: [{ key: 'tallow' }], roster: { __save: JSON.stringify({ unlocked: { tallow: true }, team: ['vharn'] }) } }; }
const dbFix = {
  users: { u1: freshLedUser(), bot1: botUser() },
  dungeonProgress: { p1: { accountId: 'p1', currentFloor: 3, lastTeamHeroIds: ['meryln', 'tallow'], activeAttempt: { floor: 3, heroes: [{ key: 'sprocket' }] } } },
  heroIdV: 0,
};
const M2 = factory(dbFix, false);
ok(M2.migrateHeroIdsAll() >= 2, 'sweep reports migrated accounts');
ok(dbFix.heroIdV === 3, 'DB stamped heroIdV=3');
const bu = dbFix.users.bot1;
ok(bu.roster.every(h => NEW.includes(h.key)) && bu.roster[0].level === 100 && bu.roster[0].rank === 0, 'ladder bot roster {key,level,rank} renamed (no ledger)');
ok(dbFix.users.u1.led.idv === 3 && dbFix.users.u1.led.unlocked.gruel === true, 'fresh ledger user migrated + stamped');
ok(JSON.parse(dbFix.users.u1.roster.__save).unlocked.gruel === true, 'fresh user roster.__save blob translated by the sweep');
ok(dbFix.dungeonProgress.p1.lastTeamHeroIds.join() === 'dandra,gruel', 'dungeonProgress.lastTeamHeroIds renamed');
ok(dbFix.dungeonProgress.p1.activeAttempt.heroes[0].key === 'rivet', 'dungeonProgress.activeAttempt hero keys renamed');
ok(dbFix.dungeonProgress.p1.currentFloor === 3, 'dungeonProgress non-id fields untouched');
ok(M2.migrateHeroIdsAll() === 0, 'second sweep is a no-op (heroIdV=3)');

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
