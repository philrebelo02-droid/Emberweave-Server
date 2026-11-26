'use strict';
// v1391 OTHER-BUILD FIGHTS (release safety: v1391 changed where skills land, so a fight played on the old engine does not reproduce on
// the new one). A real server, no battle workers (every replay runs in the resolve):
//  - Campaign: a mismatching result from another page build (build: an old BUILD_ID) and from a page that sends no build (every page
//    before v1391) files nothing - no battle incident, no cheat flag, no recording kept - and the player keeps the witnessed win and
//    its first-clear reward;
//  - Province: a fight whose session was opened by an earlier server engine (the attempt is saved; its engine id is set to an old
//    build while the server is down, i.e. started before the deploy, resolved after it) files nothing even from a current page;
//  - CONTROL: the same mismatch from the CURRENT build (Campaign and Province) files the incident and the cheat flag exactly as before.
// v1391 GRACE (security follow-up): the page's build is the client's claim, so it excuses a mismatch only for OTHER_BUILD_GRACE_HOURS
// (48) after the server first ran its engine (DB.meta.engineSeen[id], set once at boot):
//  - the first-seen time is on disk from the first boot and a restart does not move it;
//  - grace over (first seen 49 h ago): a no-build mismatch and a made-up-build mismatch each file one incident + one cheat flag (the
//    in-grace no-build fight above is their control); a province session the server recorded under an earlier engine is still
//    excused (CONTROL: a current-engine province fight is filed);
//  - OTHER_BUILD_GRACE_HOURS=0 with a fresh first-seen time: a no-build mismatch is filed at once.
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
    const B = await R.boot(S, 'ob', 8, { world: false, heroes: SQUAD });
    const [pOld, pNone, pCur, pProv, pNoneLate, pFakeLate, pProvLate, pZero] = B.players;
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
    let seen0 = null;
    { const w = WS.readWorld(S.db), a = w.users[pProv.id].led.prov.gold.att;
      ok(a && a.id === ps.body.attemptId && a.engine === BUILD, 'province: the open attempt is saved with its engine id');
      seen0 = w.meta && w.meta.engineSeen && w.meta.engineSeen[BUILD];
      ok(Number.isFinite(seen0) && Date.now() - seen0 < 30 * 60000, 'grace: the engine first-seen time is on disk from the first boot (' + seen0 + ')');
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
    const cheats = id => (w.feedback || []).filter(f => f && (f.kind === 'cheat' || f.kind === 'desync') &&   /* v1455: replay disagreements are kind 'desync' */ f.userId === id && /replay/.test(f.signal || ''));
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
    ok(w.meta && w.meta.engineSeen && w.meta.engineSeen[BUILD] === seen0, 'grace: a restart does not move the first-seen time (' + (w.meta && w.meta.engineSeen && w.meta.engineSeen[BUILD]) + ')');

    // ---- GRACE OVER: the server first saw this engine 49 h ago (written while it is down; the boot must not move it) ----
    const AGO49 = Date.now() - 49 * 3600000;
    await S.start(B.adminId);
    { const g = await S.req('POST', '/api/admin/led-grant', { userId: pProvLate.id, unlock: SQUAD, heroKeys: SQUAD, px: 900000, heroXp: 200000 }, B.A);
      ok(g.body.ok === true, 'late province player is past the level gate'); }
    const pls = await S.req('POST', '/api/province/start', { type: 'gold', stage: 1, heroIds: SQUAD, requestId: 'pvl-s' }, pProvLate.token, pProvLate.ip);
    ok(pls.status === 200 && pls.body.engine === BUILD, 'late province: an attempt is open');
    await R.sleep(600); await S.stop();
    { const w2 = WS.readWorld(S.db); w2.meta.engineSeen[BUILD] = AGO49; w2.users[pProvLate.id].led.prov.gold.att.engine = OLD; WS.writeWorld(S.db, w2); }
    await S.start(B.adminId);
    const rNoneLate = await camp(pNoneLate, {}, 'late-no-build');
    const rFakeLate = await camp(pFakeLate, { build: 'made-up-build' }, 'late-fake-build');
    for (const [r, tag] of [[rNoneLate, 'no build'], [rFakeLate, 'a made-up build']]) {
      ok(r.ok === true && r.won === true && r.digestMatch === false && r.replayIncident === true && !r.otherBuild,
        'grace over, campaign, ' + tag + ': the mismatch is a replay incident again (still paid - player truth)');
    }
    const plr = (await S.req('POST', '/api/province/resolve', { attemptId: pls.body.attemptId, requestId: 'pvl-r', inputLog: [[1, 'auto', -1, 1]], digest: WON, won: true, stars: 3 }, pProvLate.token, pProvLate.ip)).body;
    ok(plr.ok === true && plr.digestMatch === false && plr.replayIncident === false && plr.otherBuild === true,
      'grace over, province session the server recorded under an earlier engine (no build sent): still excused (' + JSON.stringify(plr).slice(0, 100) + ')');
    const pls2 = await S.req('POST', '/api/province/start', { type: 'gold', stage: 2, heroIds: SQUAD, requestId: 'pvl-s2' }, pProvLate.token, pProvLate.ip);
    const plr2 = pls2.status === 200 ? (await S.req('POST', '/api/province/resolve', { attemptId: pls2.body.attemptId, requestId: 'pvl-r2', inputLog: [[1, 'auto', -1, 1]], digest: WON, won: true, stars: 3 }, pProvLate.token, pProvLate.ip)).body : { start: pls2.body };
    ok(plr2.ok === true && plr2.digestMatch === false && plr2.replayIncident === true && !plr2.otherBuild,
      'CONTROL grace over, province, current engine + no build: the mismatch is a replay incident');
    await R.sleep(600); await S.stop();
    { const w3 = WS.readWorld(S.db), inc3 = id => (w3.users[id].led.battleIncidents || []);
      const cheats3 = id => (w3.feedback || []).filter(f => f && (f.kind === 'cheat' || f.kind === 'desync') && f.userId === id && /replay/.test(f.signal || ''));
      ok(w3.meta.engineSeen[BUILD] === AGO49, 'grace over: the boot kept the recorded first-seen time (49 h ago)');
      for (const [p, tag] of [[pNoneLate, 'no build'], [pFakeLate, 'a made-up build']])
        ok(inc3(p.id).length === 1 && inc3(p.id)[0].why === 'digest-mismatch' && cheats3(p.id).length === 1 && cheats3(p.id)[0].signal === 'campaign-replay',
          'grace over, campaign, ' + tag + ': one digest-mismatch incident and one campaign-replay cheat flag');
      const pi3 = inc3(pProvLate.id), pc3 = cheats3(pProvLate.id);
      ok(pi3.length === 1 && pi3[0].stage === 'province-gold-2' && pc3.length === 1 && pc3[0].signal === 'province-replay:' + pls2.body.attemptId,
        'grace over, province: the earlier-engine fight filed nothing; the CONTROL fight filed one incident and one cheat flag (' + pi3.map(x => x.stage) + ' / ' + pc3.map(x => x.signal) + ')');
      delete w3.meta.engineSeen[BUILD]; WS.writeWorld(S.db, w3); }   // a server meeting this engine for the first time

    // ---- OTHER_BUILD_GRACE_HOURS=0: no grace at all, even on the engine's first boot ----
    await S.start(B.adminId, { OTHER_BUILD_GRACE_HOURS: '0' });
    const rZero = await camp(pZero, {}, 'zero-no-build');
    ok(rZero.ok === true && rZero.digestMatch === false && rZero.replayIncident === true && !rZero.otherBuild, 'grace 0, campaign, no build: the mismatch is a replay incident');
    await R.sleep(600); await S.stop();
    { const w4 = WS.readWorld(S.db), i4 = w4.users[pZero.id].led.battleIncidents || [];
      const c4 = (w4.feedback || []).filter(f => f && f.kind === 'cheat' && f.userId === pZero.id && f.signal === 'campaign-replay');
      ok(Number.isFinite(w4.meta.engineSeen[BUILD]) && Date.now() - w4.meta.engineSeen[BUILD] < 10 * 60000, 'grace 0: the boot recorded a fresh first-seen time');
      ok(i4.length === 1 && i4[0].why === 'digest-mismatch' && c4.length === 1, 'grace 0, campaign, no build: one incident and one cheat flag'); }
  } finally { await S.kill(); }
  console.log('test_other_build_1391.js: ' + R.passed() + ' passed'); process.exit(0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
