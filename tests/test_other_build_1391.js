'use strict';
// v1391 OTHER-BUILD FIGHTS (release safety: v1391 changed where skills land, so a fight played on the old engine does not reproduce on
// the new one). A real server, no battle workers (every replay runs in the resolve):
//  - Campaign: a mismatching result from another page build (build: an old BUILD_ID) and from a page that sends no build (every page
//    before v1391) files nothing - no battle incident, no cheat flag, no recording kept - and the player keeps the witnessed win and
//    its first-clear reward;
//  - Province: a fight whose session was opened by an earlier server engine (the attempt is saved; its engine id is set to an old
//    build while the server is down, i.e. started before the deploy, resolved after it) files nothing even from a current page;
//  - CONTROL: the same mismatch from the CURRENT build (Campaign and Province) files the incident and the cheat flag exactly as before.
const fs = require('node:fs'), path = require('node:path');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const { ok } = R;
const BUILD = (/const\s+BUILD_ID\s*=\s*'(\d+)'/.exec(fs.readFileSync(path.join(R.root, 'emberweave-heroes.html'), 'utf8')) || [])[1];
const OLD = '1790000000000', SQUAD = ['vael', 'sylthaine', 'vireo'];
const WON = JSON.stringify({ t: 60, won: true, stars: 3, wave: 2, u: SQUAD.map(k => [k, 'ally', 1, 500, 0, 100, 100]) });   // a witnessed win the replay does not reproduce

(async () => {
  ok(!!BUILD && BUILD !== OLD, 'the page has a BUILD_ID (' + BUILD + ')');
  const S = await R.server();
  try {
    const B = await R.boot(S, 'ob', 4, { world: false, heroes: SQUAD });
    const [pOld, pNone, pCur, pProv] = B.players;
    const camp = async (p, extra, tag) => {
      const st = await S.req('POST', '/api/campaign/start', { mode: 'normal', node: 1, heroIds: SQUAD, requestId: tag + '-s' }, p.token, p.ip);
      ok(st.status === 200 && st.body.engine === BUILD, tag + ': the session is opened by the current engine (' + st.body.engine + ')');
      return (await S.req('POST', '/api/campaign/resolve', Object.assign({ attemptId: st.body.attemptId, requestId: tag + '-r', inputLog: [[1, 'auto', -1, 1]], digest: WON, won: true, stars: 3 }, extra), p.token, p.ip)).body;
    };
    const rOld = await camp(pOld, { build: OLD }, 'old-build');
    const rNone = await camp(pNone, {}, 'no-build');
    const rCur = await camp(pCur, { build: BUILD }, 'current-build');
    for (const [r, tag] of [[rOld, 'old build'], [rNone, 'no build (a v1390 page)']]) {
      ok(r.ok === true && r.won === true && r.stars === 3 && r.reward && r.reward.first === true && r.reward.gold > 0 && r.ledger.camp.cleared === 1,
        'campaign, ' + tag + ': the witnessed win is kept and paid (first clear, ' + (r.reward && r.reward.gold) + ' gold, stage 1 cleared)');
      ok(r.digestMatch === false && r.replayIncident === false && r.otherBuild === true, 'campaign, ' + tag + ': the replay differs, no incident is reported, otherBuild says why');
    }
    ok(rCur.ok === true && rCur.won === true && rCur.digestMatch === false && rCur.replayIncident === true && !rCur.otherBuild && rCur.ledger.camp.cleared === 1,
      'CONTROL campaign, current build: the same mismatch is a replay incident (still paid - player truth)');

    // Province: start on "the old server" (the saved attempt's engine is an earlier build), resolve after the "deploy"
    { const g = await S.req('POST', '/api/admin/led-grant', { userId: pProv.id, unlock: SQUAD, heroKeys: SQUAD, px: 900000, heroXp: 200000 }, B.A);
      ok(g.body.ok === true, 'province player is past the level gate'); }
    const ps = await S.req('POST', '/api/province/start', { type: 'gold', stage: 1, heroIds: SQUAD, requestId: 'pv-s' }, pProv.token, pProv.ip);
    ok(ps.status === 200 && ps.body.engine === BUILD, 'province: an attempt is open (' + JSON.stringify(ps.body).slice(0, 80) + ')');
    await R.sleep(600); await S.stop();
    { const w = WS.readWorld(S.db), a = w.users[pProv.id].led.prov.gold.att;
      ok(a && a.id === ps.body.attemptId && a.engine === BUILD, 'province: the open attempt is saved with its engine id');
      a.engine = OLD; WS.writeWorld(S.db, w); }
    await S.start(B.adminId);
    const pr = (await S.req('POST', '/api/province/resolve', { attemptId: ps.body.attemptId, requestId: 'pv-r', inputLog: [[1, 'auto', -1, 1]], digest: WON, won: true, stars: 3, build: BUILD }, pProv.token, pProv.ip)).body;
    ok(pr.ok === true && pr.won === true && pr.cleared === 1 && !!pr.reward, 'province, session from an earlier engine: the witnessed win is kept and paid');
    ok(pr.digestMatch === false && pr.replayIncident === false && pr.otherBuild === true, 'province, session from an earlier engine: no incident reported');
    const ps2 = await S.req('POST', '/api/province/start', { type: 'gold', stage: 2, heroIds: SQUAD, requestId: 'pv-s2' }, pProv.token, pProv.ip);
    const pr2 = ps2.status === 200 ? (await S.req('POST', '/api/province/resolve', { attemptId: ps2.body.attemptId, requestId: 'pv-r2', inputLog: [[1, 'auto', -1, 1]], digest: WON, won: true, stars: 3, build: BUILD }, pProv.token, pProv.ip)).body : { start: ps2.body };
    ok(pr2.ok === true && pr2.digestMatch === false && pr2.replayIncident === true && !pr2.otherBuild, 'CONTROL province, current engine + current page: the mismatch is a replay incident (' + JSON.stringify(pr2).slice(0, 100) + ')');

    await R.sleep(600); await S.stop();
    const w = WS.readWorld(S.db), inc = id => (w.users[id].led.battleIncidents || []), rc = id => (w.users[id].led.battleReceipts || []);
    const cheats = id => (w.feedback || []).filter(f => f && f.kind === 'cheat' && f.userId === id && /replay/.test(f.signal || ''));
    for (const [p, tag] of [[pOld, 'old build'], [pNone, 'no build']]) {
      ok(inc(p.id).length === 0 && cheats(p.id).length === 0, 'campaign, ' + tag + ': nothing is filed (0 incidents, 0 cheat flags)');
      const r = rc(p.id).slice(-1)[0];
      ok(r && r.otherBuild === true && r.transcript === undefined && r.won === true, 'campaign, ' + tag + ': the receipt says otherBuild and keeps no recording');
    }
    ok(inc(pCur.id).length === 1 && inc(pCur.id)[0].why === 'digest-mismatch' && cheats(pCur.id).length === 1 && cheats(pCur.id)[0].signal === 'campaign-replay',
      'CONTROL campaign, current build: one digest-mismatch incident and one campaign-replay cheat flag');
    const pi = inc(pProv.id), pc = cheats(pProv.id);
    ok(pi.length === 1 && pi[0].stage === 'province-gold-2' && pc.length === 1 && pc[0].signal === 'province-replay:' + ps2.body.attemptId,
      'province: the earlier-engine fight filed nothing; the CONTROL fight filed one incident and one cheat flag (' + pi.map(x => x.stage) + ' / ' + pc.map(x => x.signal) + ')');
  } finally { await S.kill(); }
  console.log('test_other_build_1391.js: ' + R.passed() + ' passed'); process.exit(0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
