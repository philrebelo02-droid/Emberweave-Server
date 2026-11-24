'use strict';
/* v1441 REPLAY DISAGREEMENT - the server side (Phil 24 Nov 2026: "make sure the game is actually replaying with auto on" / "And the
   properly gear they have"). A real server, no battle workers (the replay runs in the resolve).
   A. THE SQUAD OF A RESUMED ATTEMPT. Quit a campaign fight and the attempt stays open; BATTLE on the same stage with the same heroes
      resumes it. It used to hand back the squad as frozen at the FIRST start - so after a level-up / new gear / a talent the fight (the
      player's and the replay alike) was fought with the old heroes. Now the squad is re-frozen when a hero's build changed; the attempt
      id, the seed and the stamina already paid stay (no re-charge, no reroll); an unchanged squad is handed back as it was.
   B. THE RECORD'S LIMITS. An action after tick 14400 (fights run to ~19,750 ticks since v1399's 180 s waves) and a target whose unit id
      is 64 or more (ids count every enemy and summon made in the fight) were cut from / blanked in the record the replay is fed.
      Both now reach it as the player made them.
   C. THE WORDS. The stored reason stays 'digest-mismatch' and the signal 'campaign-replay' (data and tests read them); the review
      text says it is a replay disagreement and not proof of cheating.
   CONTROL: the v1439 tree (git af4aab45c) fails A and B on the same calls.
   Asserts (non-zero exit). */
const fs = require('node:fs'), path = require('node:path');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const { ok } = R;
const CONTROL_SHA = 'af4aab45c', SQ = ['vael', 'sylthaine', 'vireo'];
const WON = JSON.stringify({ t: 60, won: true, stars: 3, wave: 2, u: SQ.map(k => [k, 'ally', 1, 500, 0, 100, 100]) });   // a witnessed win the replay does not reproduce
const LOG = [[20, 'auto', -1, 1, null, null], [300, 'ult', 1, 70, 512.345678, 640.5], [15000, 'ult', 2, 9, null, null]];

async function play(dir, tag) {
  const BUILD = (/const\s+BUILD_ID\s*=\s*'(\d+)'/.exec(fs.readFileSync(path.join(dir, 'emberweave-heroes.html'), 'utf8')) || [])[1];
  const S = await R.server({ dir });
  try {
    const B = await R.boot(S, tag, 1, { world: false }), p = B.players[0];
    const grant = d => S.req('POST', '/api/admin/led-grant', Object.assign({ userId: p.id, heroKeys: SQ }, d), B.A);
    await grant({ unlock: SQ, px: 900000, heroXp: 60000, campCleared: 40 });
    const start = id => S.req('POST', '/api/campaign/start', { mode: 'normal', node: 12, heroIds: SQ, requestId: tag + id }, p.token, p.ip);
    const sum = r => (r.body.snaps || []).map(s => s.level + ':' + Math.round(s.maxHp)).join(',');
    const a = await start('a');
    await grant({ heroXp: 900000, stars: 5 });               // the player quits the fight and builds the heroes up
    const b = await start('b');
    const c = await start('c');                               // nothing changed since b
    const res = (await S.req('POST', '/api/campaign/resolve', { attemptId: b.body.attemptId, requestId: tag + 'r', inputLog: LOG, digest: WON, won: true, stars: 3, build: BUILD }, p.token, p.ip)).body;
    const fresh = await S.req('POST', '/api/campaign/start', { mode: 'normal', node: 13, heroIds: SQ, requestId: tag + 'f' }, p.token, p.ip);   // a new attempt: the account as it is now
    await R.sleep(600); await S.stop();
    const w = WS.readWorld(S.db), inc = (w.users[p.id].led.battleIncidents || []), cheats = (w.feedback || []).filter(f => f && f.kind === 'cheat' && f.userId === p.id && f.signal === 'campaign-replay');
    return { a, b, c, res, fresh, sum, inc, cheats };
  } finally { await S.kill(); }
}

(async () => {
  console.log('== v1441: this tree ==');
  const N = await play(R.root, 'rf');
  ok(N.a.status === 200 && N.b.status === 200 && N.b.body.resumed === true && N.b.body.attemptId === N.a.body.attemptId && N.b.body.seed === N.a.body.seed,
    'A: the second BATTLE on the same stage resumes the open attempt - same attempt id, same seed');
  ok(N.b.body.stamina.v === N.a.body.stamina.v, 'A: no stamina is taken again (' + N.a.body.stamina.v + ' after both starts)');
  ok(N.b.body.refrozen === true && N.sum(N.b) !== N.sum(N.a) && N.sum(N.b) === N.sum(N.fresh),
    'A: the resumed fight is given the heroes as they are NOW (' + N.sum(N.a) + ' -> ' + N.sum(N.b) + ', the same as a brand-new attempt)');
  ok(N.c.body.resumed === true && N.c.body.refrozen === false && JSON.stringify(N.c.body.snaps) === JSON.stringify(N.b.body.snaps), 'A: an unchanged squad is handed back exactly as it was frozen');
  ok(N.res.ok === true && N.res.won === true && N.res.digestMatch === false && N.inc.length === 1 && N.inc[0].why === 'digest-mismatch',
    'the made-up result is paid (player truth) and one record is filed; its stored reason is still digest-mismatch');
  const T = N.inc[0].transcript || [];
  ok(T.some(e => e[0] === 15000 && e[1] === 'ult' && e[2] === 2), 'B: an ultimate pressed on tick 15000 is in the record the replay was fed (' + JSON.stringify(T) + ')');
  ok(T.some(e => e[0] === 300 && e[3] === 70 && e[4] === 512.35 && e[5] === 640.5), 'B: a target with unit id 70 is kept (not blanked to -1), its aim to 2 decimals');
  ok(N.cheats.length === 1 && /Replay disagreement at normal stage/.test(N.cheats[0].detail || N.cheats[0].text || JSON.stringify(N.cheats[0])) && /not proof of cheating/.test(JSON.stringify(N.cheats[0])),
    'C: the review entry (signal campaign-replay, unchanged) says replay disagreement, not proof of cheating');

  console.log('== CONTROL: v1439 (' + CONTROL_SHA + ') ==');
  const dir = R.controlTree(CONTROL_SHA);
  try {
    const C = await play(dir, 'rc');
    ok(C.b.body.resumed === true && C.b.body.attemptId === C.a.body.attemptId, 'CONTROL: v1439 resumes the same attempt too');
    ok(C.sum(C.b) === C.sum(C.a) && C.sum(C.b) !== C.sum(C.fresh), 'CONTROL: v1439 hands back the OLD heroes after the build-up (' + C.sum(C.b) + ' - a new attempt gets ' + C.sum(C.fresh) + ')');
    const CT = (C.inc[0] || {}).transcript || [];
    ok(C.inc.length === 1 && !CT.some(e => e[0] === 15000), 'CONTROL: v1439 drops the tick-15000 ultimate from the record (' + JSON.stringify(CT) + ')');
    ok(CT.some(e => e[0] === 300 && e[3] === -1), 'CONTROL: v1439 blanks the unit-id-70 target to -1');
  } finally { R.removeControlTree(CONTROL_SHA); }
  console.log(''); console.log('test_resume_refreeze_1441.js: ' + R.passed() + ' passed, 0 failed');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
