/* v1442 - THE BONUS STAGE BUG SCAN, SERVER SIDE (Phil 24 Nov 2026: "Fix all of those bugs").
   The scan (Open Projects, TALENT ERA BALANCE 24NOV2026, 03 - BONUS STAGES BUG SCAN) found that nothing automated covered the
   hourly accrual, which is why B2 and B3 were never caught. This drives server/bonus-stages.js through its own route handler
   with the real glyph and campaign tables and a ledger held in memory; time is moved by shifting the account's clocks.
     B2  the 36-hour cap is a cap: 100 h away pays 36 h once, the next claim pays nothing, the part-hour is kept
     B3  a new clear earns from its own clear time (also the dev "Unlock all stages" shape), exact across claims
     B4  the 45 minutes count from the last reported firebreak
     B5  a win faster than MIN_RESOLVE_MS is refused (and still flagged); the attempt stays open; a loss is never held to it
     B10 Bonus 1-3 checks the squad: no unowned, duplicate, oversized or empty squad; one empty road is still allowed
     B11 a claim re-sent with the same requestId answers the stored receipt and pays once
     B12 whole numbers only on /window and /resolve; one crossing per hero per firebreak; every refusal has a translated code
   Asserts (non-zero exit). No server process, no browser. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.EW_ROOT ? path.resolve(process.env.EW_ROOT) : path.join(__dirname, '..');
const BS = require(path.join(ROOT, 'server', 'bonus-stages.js'));
const EC = require(path.join(ROOT, 'server', 'error-codes.js'));
const GLYPHS = { raw: require(path.join(ROOT, 'server', 'glyph-source.json')) };
const CAMP_ENC = require(path.join(ROOT, 'server', 'campaign-encounters.json'));
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d !== undefined ? ' - ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } };
const H = 3600000, MIN = 60000;

/* one account: a ledger in memory and the helpers server.js hands the module */
function account(owned) {
  const A = { me: { id: 'u' + Math.random().toString(36).slice(2) }, led: { camp: { cleared: 160 } }, grants: [], signals: [], tx: [], n: 0 };
  const own = new Set(owned || ['vael', 'sylthaine', 'vireo']);
  A.ctx = body => ({ me: A.me, led: A.led, body: () => Promise.resolve(body || {}), query: new URLSearchParams(),
    glyphGrantNamedList: (me, list) => { A.grants.push(...list); return list.map(x => ({ key: x.key, quantity: x.quantity })); },
    srvSeed: (...a) => { let h = 2166136261; for (const ch of a.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; },
    ledTx: (me, kind, d) => A.tx.push([kind, d]), ledgerView: () => ({}), writeDB: () => {}, feedbackCheatSignal: (me, sig) => A.signals.push(sig),
    GLYPHS, CAMP_ENC, uid: () => 'att' + (++A.n), playerLevel: () => 10, isUnlocked: k => own.has(k) });
  A.post = (p, body) => BS.handle('/api/bonus/' + p, 'POST', A.ctx(body));
  A.state = async () => (await BS.handle('/api/bonus/state', 'GET', A.ctx())).body;
  A.paid = () => A.grants.reduce((a, g) => a + g.quantity, 0);
  /* move every accrual clock of the account back by ms: the pot clock, each stage's clear time and its own clock */
  A.age = ms => { const b = A.led.bonus; b.ts -= ms; for (const k of Object.keys(b.done)) { const r = b.done[k]; if (r.at) r.at -= ms; if (r.from) r.from -= ms; } };
  /* a full run reported as a three-road win, started two minutes ago so the speed floor is not in the way */
  A.clear = async (id, body) => { const s = await A.post('start', { id, assign: { 1: ['sylthaine'], 2: ['vael'], 3: ['vireo'] } }); if (!s.body.ok) return s;
    A.led.bonus.att.startedAt -= 2 * MIN; for (let i = 1; i <= 4; i++) await A.post('window', { attemptId: s.body.attemptId, windowIndex: i, moves: [] });
    return A.post('resolve', Object.assign({ attemptId: s.body.attemptId, lanesCleared: 3, lanesLost: 0, heroesLost: 0 }, body || {})); };
  return A;
}
let rid = 0; const RID = () => 'rid-' + (++rid);

(async () => {
  console.log('== B3: a new clear earns from its own clear time ==');
  { const A = account(); let r = await A.clear('1-3'); ck(r.status === 200 && r.body.firstClear, 'Bonus 1-3 cleared (1 an hour)', r.body);
    A.age(30 * H + 20 * MIN);
    let st = await A.state(); ck(st.claim.total === 30 && st.claim.hours === 30, '30 h later one stage has saved 30', st.claim);
    for (const id of ['1-4', '1-6', '1-7', '1-9', '1-10']) await A.clear(id);
    st = await A.state(); ck(st.perHour === 12, 'six chapter-1 stages earn 12 an hour', st.perHour);
    ck(st.claim.total === 30, 'clearing five more stages just now leaves the pot at 30 (the scan measured 360)', st.claim);
    const g0 = A.paid(); r = await A.post('claim', { requestId: RID() });
    ck(r.status === 200 && r.body.hours === 30 && A.paid() - g0 === 30, 'the claim pays 30 fragments for 30 h', [r.body.hours, A.paid() - g0]);
    /* exact across the claim: the old stage has 20 min of its next hour, the five new stages none */
    A.age(45 * MIN); st = await A.state(); ck(st.claim.total === 1, '45 min after the claim only the old stage has ticked (its part-hour was kept)', st.claim);
    A.age(20 * MIN); st = await A.state(); ck(st.claim.total === 12, '65 min after their clear the five new stages have each earned their first hour (1 + 11)', st.claim);
    r = await A.post('claim', { requestId: RID() }); A.age(60 * MIN); st = await A.state();
    ck(st.claim.total === 12, 'one hour after that claim every stage has earned exactly one hour (12)', st.claim);
    /* the dev "Unlock all stages" shape: stages marked done with at = now on an account with an older, unclaimed clear */
    const B = account(); await B.clear('1-3'); B.age(30 * H); const now = Date.now();
    for (let ch = 1; ch <= BS.CHAPTERS; ch++) for (const c of BS.BONUS_CODES) { const id = ch + '-' + c; if (!B.led.bonus.done[id]) B.led.bonus.done[id] = { stars: 3, at: now }; }
    st = await B.state(); ck(st.perHour === 192 && st.claim.total === 30, 'all 96 stages marked done now: 192 an hour from now on, the pot stays 30 (the scan measured 5,760)', [st.perHour, st.claim.total]);
    /* nothing accrues before the first clear, and a clock in the future pays nothing */
    const C = account(); await C.state(); C.led.bonus.ts -= 50 * H; await C.clear('1-3'); st = await C.state(); ck(st.claim.total === 0, 'nothing accrued before the first clear', st.claim);
    C.led.bonus.ts += 5 * H; C.led.bonus.done['1-3'].at += 5 * H; st = await C.state(); ck(st.claim.total === 0, 'a clock in the future pays nothing', st.claim); }

  console.log('== B2: the 36-hour cap really caps ==');
  { const A = account(); for (const id of ['1-3', '1-4', '1-6', '1-7', '1-9', '1-10']) await A.clear(id);
    A.age(100 * H + 30 * MIN);
    let st = await A.state(); ck(st.claim.total === 432 && st.claim.hours === 36 && st.claim.capped === true, '100 h away at 12 an hour shows 432 saved, 36 h, capped', st.claim);
    const paid = []; for (let i = 0; i < 3; i++) { const g0 = A.paid(); const r = await A.post('claim', { requestId: RID() }); paid.push(r.status === 200 ? A.paid() - g0 : r.body.error); }
    ck(paid[0] === 432 && paid[1] === 'Nothing has accrued yet.' && paid[2] === 'Nothing has accrued yet.', 'three presses of Claim pay 432 once (the scan measured 432 + 432 + 336)', paid);
    st = await A.state(); const partH = (st.serverNow - st.since) / H;
    ck(partH > 0.49 && partH < 0.52, 'the part-hour is kept: the clock is half an hour old after the capped claim', partH);
    A.age(31 * MIN); st = await A.state(); ck(st.claim.total === 12, '31 min later the next hour lands (12)', st.claim);
    /* under the cap the clock still moves by the hours paid only */
    const B = account(); await B.clear('1-3'); B.age(5 * H + 30 * MIN); let r = await B.post('claim', { requestId: RID() });
    ck(r.body.hours === 5 && B.paid() - 0 > 0, '5.5 h away pays 5 h', r.body.hours); B.age(31 * MIN); st = await B.state(); ck(st.claim.total === 1, '... and the half hour was kept', st.claim);
    ck(BS.clockAfterClaim(1000, 1000 + 40 * H + 7) === 1000 + 40 * H + 7 - 7 && BS.clockAfterClaim(1000, 1000 + 3 * H + 7) === 1000 + 3 * H, 'clockAfterClaim: at the cap -> now minus the part-hour; under it -> forward by whole hours'); }

  console.log('== B11: a re-sent claim answers the stored receipt ==');
  { const A = account(); await A.clear('1-3'); A.age(5 * H + 10 * MIN); const r1 = RID();
    const a = await A.post('claim', { requestId: r1 }), g1 = A.paid(), b = await A.post('claim', { requestId: r1 });
    ck(a.status === 200 && a.body.hours === 5, 'the claim pays 5 h', a.body.hours);
    ck(b.status === 200 && b.body.ok === true && b.body.replay === true && JSON.stringify(b.body.granted) === JSON.stringify(a.body.granted) && b.body.hours === 5, 'the same requestId answers the same receipt (was "Nothing has accrued yet.")', b.body);
    ck(A.paid() === g1 && A.tx.filter(t => t[0] === 'bonus:claim').length === 1, 'nothing is paid twice: one bonus:claim, fragments unchanged');
    const c = await A.post('claim', { requestId: RID() }); ck(c.status === 400 && c.body.error === 'Nothing has accrued yet.', 'a new requestId right after is still refused', c.body);
    const d = await A.post('claim', {}); ck(d.status === 400 && d.body.error === 'requestId required', 'no requestId is still refused'); }

  console.log('== B10: Bonus 1-3 checks the squad ==');
  { const A = account(); const S = assign => A.post('start', { id: '1-3', assign });
    let r = await S({ 1: [], 2: [], 3: [] }); ck(r.status === 400 && r.body.error === 'No squad was sent.', 'a squad of no heroes is refused', r.body);
    r = await S({ 1: [], 2: ['askel', 'askel', 'rivet', 'mirelle', 'aureth', 'sloe', 'gruel', 'yenna', 'dandra', 'carn', 'astra', 'brannus', 'orryn', 'nerisse', 'joss', 'umbris', 'hobb', 'kharos', 'linnet', 'nox'], 3: ['vael'] });
    ck(r.status === 400, 'road 1 empty + 20 unowned heroes with a duplicate is refused (the scan: it started)', r.body.error);
    r = await S({ 1: [], 2: ['vael', 'vael'], 3: [] }); ck(r.status === 400 && r.body.error === 'A hero cannot walk two lanes.', 'road 1 empty + a duplicate is refused', r.body.error);
    r = await S({ 1: [], 2: ['askel'], 3: ['vael'] }); ck(r.status === 400 && r.body.error === 'You do not own askel.', 'road 1 empty + an unowned hero is refused', r.body.error);
    r = await S({ 1: [], 2: ['vael'], 3: ['sylthaine', 'vireo'] }); ck(r.status === 200 && r.body.ok, 'one empty road is still allowed on the teaching stage', r.body.error);
    r = await S({ 1: ['sylthaine'], 2: ['vael'], 3: ['vireo'] }); ck(r.status === 200 && r.body.ok, 'a 1/1/1 squad starts');
    r = await A.post('start', { id: '1-4', assign: { 1: [], 2: ['vael'], 3: ['sylthaine', 'vireo'] } }); ck(r.status === 400 && /is empty/.test(r.body.error), 'every other stage still refuses an empty road', r.body.error); }

  console.log('== B4: the 45 minutes count from the last firebreak ==');
  { const A = account(); const asg = { 1: ['sylthaine'], 2: ['vael'], 3: ['vireo'] };
    let s = await A.post('start', { id: '2-4', assign: asg }); let a = s.body.attemptId;
    for (let i = 1; i <= 3; i++) await A.post('window', { attemptId: a, windowIndex: i, moves: [] });
    A.led.bonus.att.startedAt -= 46 * MIN; A.led.bonus.att.lastAt -= 46 * MIN;   // a 46-minute pause, then firebreak 4 and the finish
    let r = await A.post('window', { attemptId: a, windowIndex: 4, moves: [] }); ck(r.status === 200, 'firebreak 4 is booked 46 min after the start');
    r = await A.post('resolve', { attemptId: a, lanesCleared: 3, lanesLost: 0, heroesLost: 0 }); ck(r.status === 200 && r.body.won === true && r.body.firstClear === true, 'the result right after that firebreak counts (it used to answer "expired")', r.body);
    s = await A.post('start', { id: '2-6', assign: asg }); a = s.body.attemptId; for (let i = 1; i <= 4; i++) await A.post('window', { attemptId: a, windowIndex: i, moves: [] });
    A.led.bonus.att.startedAt -= 46 * MIN; A.led.bonus.att.lastAt -= 46 * MIN;   // nothing reported for 46 minutes
    r = await A.post('resolve', { attemptId: a, lanesCleared: 3, lanesLost: 0, heroesLost: 0 }); ck(r.status === 400 && r.body.expired === true && EC.errorInfo(r.body.error).code === 'that_bonus_run_expired_start_it', '46 min after the last firebreak the run has expired', r.body);
    r = await A.post('resolve', { attemptId: a, lanesCleared: 3, lanesLost: 0, heroesLost: 0 }); ck(r.status === 400 && EC.errorInfo(r.body.error).code === 'no_matching_bonus_run', 'sent again: "No matching bonus run." - the two answers the page treats as final', r.body);
    s = await A.post('start', { id: '2-7', assign: asg }); a = s.body.attemptId; delete A.led.bonus.att.lastAt; A.led.bonus.att.startedAt -= 46 * MIN;
    r = await A.post('resolve', { attemptId: a, lanesCleared: 0, lanesLost: 2, heroesLost: 3 }); ck(r.status === 400 && r.body.expired === true, 'an attempt started before v1442 (no lastAt) still expires 45 min after its start'); }

  console.log('== B5: a win faster than any real clear is refused ==');
  { const A = account(); const asg = { 1: ['sylthaine'], 2: ['vael'], 3: ['vireo'] };
    ck(BS.MIN_RESOLVE_MS === 10000, 'the floor is 10 s (x2 speed halves the scan\'s 30 s / 57 s of fight)', BS.MIN_RESOLVE_MS);
    const s = await A.post('start', { id: '1-3', assign: asg }), a = s.body.attemptId; for (let i = 1; i <= 4; i++) await A.post('window', { attemptId: a, windowIndex: i, moves: [] });
    let r = await A.post('resolve', { attemptId: a, lanesCleared: 3, lanesLost: 0, heroesLost: 0 });
    ck(r.status === 400 && r.body.tooFast === true && !A.led.bonus.done['1-3'] && A.grants.length === 0, 'start, four windows and a win at once: refused, nothing paid (the scan: 200, 3 stars, fragments)', r.body);
    ck(A.signals.length === 1 && /^bonus-fast:/.test(A.signals[0]), 'the bonus-fast signal is still filed', A.signals);
    ck(A.led.bonus.att && A.led.bonus.att.id === a, 'the attempt stays open');
    A.led.bonus.att.startedAt -= 11000; r = await A.post('resolve', { attemptId: a, lanesCleared: 3, lanesLost: 0, heroesLost: 0 }); ck(r.status === 200 && r.body.won === true, 'the same result 11 s after the start counts', r.body);
    const s2 = await A.post('start', { id: '1-3', assign: asg }); r = await A.post('resolve', { attemptId: s2.body.attemptId, lanesCleared: 0, lanesLost: 2, heroesLost: 3 }); ck(r.status === 200 && r.body.won === false, 'an instant loss is never held to the floor'); }

  console.log('== B12: whole numbers, one crossing per firebreak, translated refusals ==');
  { const A = account(); const asg = { 1: ['sylthaine'], 2: ['vael'], 3: ['vireo'] };
    let s = await A.post('start', { id: '1-3', assign: asg }), a = s.body.attemptId; const W = b => A.post('window', Object.assign({ attemptId: a }, b));
    for (const bad of [1.9, '1', null, true, [1], NaN]) { const r = await W({ windowIndex: bad }); ck(r.status === 400 && A.led.bonus.att.windowsSeen === 0, 'windowIndex ' + JSON.stringify(bad) + ' is refused', r.body); }
    let r = await W({ windowIndex: 1, moves: [['vael', 2, 1], ['vael', 1, 2]] }); ck(r.status === 400 && r.body.error === 'A hero can cross only once at each firebreak.' && A.led.bonus.att.windowsSeen === 0, 'a hero listed twice in one firebreak is refused and the window is not booked', r.body);
    r = await W({ windowIndex: 1, moves: [['vael', 1, 2]] }); ck(r.status === 400 && r.body.error === 'That hero is not on that road.', 'a hero leaving a road it is not on is refused', r.body);
    for (const m of [['vael', 2, 2], ['vael', 2, 4], ['vael', 2, 1.5], ['vael', '2', 1], 'vael']) { r = await W({ windowIndex: 1, moves: [m] }); ck(r.status === 400, 'move ' + JSON.stringify(m) + ' is refused', r.body); }
    r = await W({ windowIndex: 1, moves: [['vael', 2, 1], ['boar', 2, 3], ['askel', 1, 3]] }); ck(r.status === 200 && r.body.windowsSeen === 1 && A.led.bonus.att.pos.vael === 1, 'one crossing is booked; keys outside the squad are ignored', r.body);
    r = await W({ windowIndex: 1, moves: [['vael', 2, 1]] }); ck(r.status === 200 && r.body.alreadyBooked === true && A.led.bonus.att.pos.vael === 1, 're-sending a booked window is still an ack and moves nobody twice');
    r = await W({ windowIndex: 2, moves: [['vael', 1, 2], ['vireo', 3, 1]] }); ck(r.status === 200 && A.led.bonus.att.pos.vireo === 1 && A.led.bonus.att.pos.vael === 2, 'next firebreak: the same hero may cross again; Bottom -> Top through the Middle is one crossing');
    r = await W({ windowIndex: 3 }); ck(r.status === 200 && A.led.bonus.att.posLost === 1, 'a window without the list (an older cached page) is accepted as before');
    r = await W({ windowIndex: 4, moves: [['sylthaine', 3, 2]] }); ck(r.status === 200, '... and from then on the from-road is not checked for that run');
    A.led.bonus.att.startedAt -= 2 * MIN; const R = b => A.post('resolve', Object.assign({ attemptId: a }, b));
    for (const [nm, b] of [['lanesCleared "3"', { lanesCleared: '3', lanesLost: 0, heroesLost: 0 }], ['lanesCleared 2.9', { lanesCleared: 2.9, lanesLost: 0, heroesLost: 0 }], ['lanesCleared 1e12', { lanesCleared: 1e12, lanesLost: 0, heroesLost: 0 }],
      ['lanesCleared 4294967299 (wrapped to 3 before)', { lanesCleared: 4294967299, lanesLost: 0, heroesLost: 0 }], ['lanesCleared -1', { lanesCleared: -1, lanesLost: 0, heroesLost: 0 }], ['lanesLost "abc"', { lanesCleared: 3, lanesLost: 'abc', heroesLost: 0 }],
      ['heroesLost 0.9', { lanesCleared: 3, lanesLost: 0, heroesLost: 0.9 }], ['no counts at all', {}], ['3 + 1 lanes', { lanesCleared: 3, lanesLost: 1, heroesLost: 0 }]]) {
      r = await R(b); ck(r.status === 400 && r.body.error === 'Impossible lane count.' && !!A.led.bonus.att, nm + ' is refused and the attempt is kept', r.body); }
    r = await R({ lanesCleared: 3, lanesLost: 0 }); ck(r.status === 200 && r.body.won === true && r.body.heroesLost === 0, 'heroesLost may be left out (0)', r.body);
    s = await A.post('start', { id: '1-3', assign: asg }); A.led.bonus.att.startedAt -= 2 * MIN; for (let i = 1; i <= 4; i++) await A.post('window', { attemptId: s.body.attemptId, windowIndex: i, moves: [] });
    r = await A.post('resolve', { attemptId: s.body.attemptId, lanesCleared: 2, lanesLost: 0, heroesLost: 1e9 }); ck(r.status === 200 && r.body.heroesLost === 3 && r.body.stars === 1, 'a huge heroesLost still clamps to the squad the server recorded', r.body);
    /* every refusal a squad or a window can get has a code, and the code is translated in all 16 language files */
    const CODES = ['en', 'es', 'pt-BR', 'fr', 'de', 'it', 'nl', 'ru', 'tr', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'th', 'id', 'hi'];
    const packs = Object.fromEntries(CODES.map(c => [c, JSON.parse(fs.readFileSync(path.join(ROOT, 'lang', c + '.json'), 'utf8'))]));
    const toks = t => (String(t).match(/\{\w+\}/g) || []).sort().join(' ');
    for (const text of ['No squad was sent.', 'Lane 2 is not a list of heroes.', 'Lane 2 is empty — every lane walks.', 'At most 10 heroes on one road.', 'A hero cannot walk two lanes.', 'At most 15 heroes.',
      'That result arrived too fast to count.', 'A hero can cross only once at each firebreak.', 'That hero is not on that road.']) {
      const i = EC.errorInfo(text), k = i && 'err.' + i.code;
      const miss = !i ? ['no code'] : CODES.filter(c => typeof packs[c][k] !== 'string' || !packs[c][k].trim() || toks(packs[c][k]) !== toks(packs.en[k]) || (c !== 'en' && packs[c][k] === packs.en[k]));
      ck(miss.length === 0, '"' + text + '" has a code translated in all 16 languages (' + (i ? i.code : '-') + ')', miss); }
    ck(JSON.stringify(EC.errorInfo('At most 10 heroes on one road.').vars) === '{"n":"10"}' && JSON.stringify(EC.errorInfo('Lane 2 is empty — every lane walks.').vars) === '{"lane":"2"}', 'the built refusals carry their values'); }

  console.log('test_bonus_fixes_1442: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
