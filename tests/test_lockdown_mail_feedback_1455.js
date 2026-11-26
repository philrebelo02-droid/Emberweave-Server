// v1455 lockdown audit 25 Nov 2026 - Mail, Quests, Tutorial, Player Feedback (audit/mail-quests-tutorial-feedback.md) fixes.
// Server in-process (temp DB, tests/lockdown-1455-lib.js); page source + headless page (server/sim-host.js).
//  1. Feedback inbox - over 5,000 items, automatic flags are evicted before any player report.
//  2. Every server reaches Ember - Servers 2-5 keep each player / chat report in an outbox until Server 1 accepts it (retry), chat reports too.
//  3. No lost reports - undelivered war reports kept up to 200 per player (was 20).
//  4. Make a Name - the quest needs a real rename.
//  5. Replay disagreement is not cheating - filed as kind 'desync', not 'cheat'.
//  6. Claim notice - stage-chain and daily-pack claims use the line above the quest list.
//  7. Claim pop-up - a compensation already claimed elsewhere says "Already claimed." with no reward pop-up.
//  8. Report limits - X-Forwarded-For is trusted only from our own proxy.
//  9. Empty Inbox text says what the Inbox holds, in all 16 languages.
// Modes: no argument = the main run (satellite parts run in child processes of this file: --satellite, --server1).
// CONTROL: LF_HTML=<v1454 page> LF_SERVER=<v1454 server.js> LF_SOFT=1 lists the checks the old code fails. Exit 0 = all passed.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), http = require('http'), cp = require('child_process');
const root = path.join(__dirname, '..');
const MODE = process.argv[2] || '';
const SOFT = !!process.env.LF_SOFT; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); return; } fail++; console.log('  FAIL ' + m); if (!SOFT) { console.log('test_lockdown_mail_feedback_1455.js' + (MODE ? ' ' + MODE : '') + ': FAILED after ' + pass + ' passed'); process.exit(1); } };
const SRC = fs.readFileSync(process.env.LF_SERVER || path.join(root, 'server.js'), 'utf8');

if (MODE === '--server1') {   // Server 1 receiving satellites' reports
  process.env.ACCOUNT_LINK_SECRET = 'lf-secret'; delete process.env.ACCOUNT_AUTHORITY;
  const { S, call } = require('./lockdown-1455-lib.js').loadServer(module);
  const post = (route, data, hdr) => new Promise(resolve => { const EE = require('events'); const req = new EE(); req.method = 'POST'; req.url = route; req.headers = Object.assign({ 'content-type': 'application/json' }, hdr || {});
    req.socket = { remoteAddress: '192.168.1.50' }; req.pause = () => {}; req.destroy = () => {};
    const res = { statusCode: 200, _h: {}, setHeader(k, v) { this._h[k] = v; }, getHeader(k) { return this._h[k]; }, writeHead(c) { this.statusCode = c; }, end(b) { let j = null; try { j = JSON.parse(String(b || '')); } catch (e) { j = String(b || ''); } resolve({ status: this.statusCode, data: j }); }, write() {}, on() {} };
    S.server.emit('request', req, res); setImmediate(() => { req.emit('data', Buffer.from(JSON.stringify(data))); req.emit('end'); }); });
  (async () => {
    const H = { 'x-link-secret': 'lf-secret' };
    const mod = { id: 'm1', t: Date.now(), kind: 'moderation', reason: 'racism', reasonLabel: 'Racism', userId: 'bad1', name: 'Bad', reporterId: 'p9', reporterName: 'Rep', detail: 'Racism report (world): x', text: 'Racism report by Rep (world) - Bad: x', chat: { mid: 'c1', channel: 'world', text: 'x' }, context: [] };
    const r1 = await post('/api/internal/account/feedback', { server: '3', store: 'reports', item: mod }, H), r1b = await post('/api/internal/account/feedback', { server: '3', store: 'reports', item: mod }, H);
    const reps = (S.DB.reports || []).filter(x => x && x.id === 'S3-m1');
    ok(r1.status === 200 && r1b.status === 200 && reps.length === 1 && reps[0].kind === 'moderation' && reps[0].priority === 'high' && /^\[Server 3\]/.test(reps[0].text) && reps[0].reporterId === 'S3:p9', 'Server 1 files a satellite\'s racism report in its moderation list once (a retry does not file it twice)');
    const chat = { id: 'FB-c2', userId: 'p9', name: 'Rep', kind: 'chat', text: 'Chat report (world) - Bad: y', chat: { mid: 'c2', channel: 'world' }, context: [{ s: 'a' }], t: Date.now() };
    await post('/api/internal/account/feedback', { server: '3', item: chat }, H);
    const fb = (S.DB.feedback || []).find(x => x && x.id === 'S3-FB-c2');
    ok(fb && fb.kind === 'chat' && fb.chat && fb.chat.mid === 'c2', 'an "Other" chat report joins the feedback inbox as a chat report, with its message');
    const no = await post('/api/internal/account/feedback', { server: '3', store: 'reports', item: mod }, {});
    ok(no.status === 404, 'without the link secret: 404');
    console.log('CHILD ' + pass + ' ' + fail); process.exit(fail ? 1 : 0);
  })().catch(e => { console.error(e); process.exit(1); });
  return;
}

if (MODE === '--satellite') {   // Server 2-5 with a fake Server 1 that is down for the first two tries
  const got = []; let down = 2;
  const fake = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { if (down > 0) { down--; res.writeHead(503); res.end('{}'); return; }
    let j = {}; try { j = JSON.parse(b); } catch (e) {} got.push(j); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, id: 'S2-' + (j.item && j.item.id) })); }); });
  fake.listen(0, '127.0.0.1', async () => {
    process.env.ACCOUNT_AUTHORITY = 'http://127.0.0.1:' + fake.address().port; process.env.ACCOUNT_LINK_SECRET = 'lf-secret'; process.env.SERVER_ID = '2';
    const { S, call, guest } = require('./lockdown-1455-lib.js').loadServer(module);
    try {
      const a = await guest('relay'); S.DB.users[a.id].led.px = 100000;
      const r = await call('/api/report', { text: 'The bridge button does nothing', kind: 'bug' }, a.T);
      await new Promise(z => setTimeout(z, 300));
      const it = (S.DB.feedback || []).find(x => x && x.id === r.data.id);
      ok(r.status === 200 && it && it.relay === 'pending' && got.length === 0, 'Server 1 down: the report is kept in the outbox (relay pending), nothing lost');
      if (typeof S.feedbackRelayKick === 'function') { await S.feedbackRelayKick(); await S.feedbackRelayKick(); }
      ok(it && it.relay === 'sent' && got.length === 1 && got[0].item && got[0].item.text === 'The bridge button does nothing' && got[0].server === '2' && !('relay' in got[0].item), 'Server 1 back: the retry delivers it once and marks it sent (' + got.length + ' delivered)');
      if (typeof S.feedbackRelayKick === 'function') await S.feedbackRelayKick();
      ok(got.length === 1, 'a sent report is not sent again');
      // a chat report: the server must find the message - plant one in the world chat log the route reads
      ok(/if\(ACCOUNT_AUTHORITY\) item\.relay='pending';   \/\/ v1455 lockdown: chat reports reach Server 1 too/.test(SRC) && (SRC.match(/item\.relay='pending'/g) || []).length === 3, 'chat reports (moderation and Other) enter the same outbox');
      ok(/setInterval\(\(\)=>feedbackRelayKick\(\),60000\)/.test(SRC), 'a 60 s timer keeps retrying (and a boot pass after a restart)');
    } catch (e) { console.error(e); fail++; }
    console.log('CHILD ' + pass + ' ' + fail); const code = fail ? 1 : 0;
    try { fake.closeAllConnections && fake.closeAllConnections(); } catch (e) {} fake.close(() => setTimeout(() => process.exit(code), 50)); setTimeout(() => process.exit(code), 3000).unref();   // close the fake Server 1 first (libuv aborts an exit with live sockets on Windows)
  });
  return;
}

// ---------------- main run ----------------
const HTML = process.env.LF_HTML || path.join(root, 'emberweave-heroes.html');
const html = fs.readFileSync(HTML, 'utf8');
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const R = s => vm.runInContext(s, host.ctx, { timeout: 60000 });
const J = s => { try { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); } catch (e) { return { __err: String(e && e.message || e) }; } };
const CODES = ['en', 'es', 'pt-BR', 'fr', 'de', 'it', 'nl', 'ru', 'tr', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'th', 'id', 'hi'];
const { S, call, guest } = require('./lockdown-1455-lib.js').loadServer(module);
const child = mode => new Promise(resolve => { const c = cp.spawn(process.execPath, [__filename, mode], { cwd: root, env: Object.assign({}, process.env), stdio: ['ignore', 'pipe', 'pipe'] }); let out = '';
  c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d); c.on('exit', code => resolve({ code, out })); });

(async () => {
  console.log('== 1. automatic flags never evict a player report ==');
  { const DB = S.worldPlanningDB(); DB.feedback = [];
    for (let i = 0; i < 30; i++) S.feedbackAppend({ id: 'P' + i, userId: 'u' + i, kind: i % 2 ? 'suggestion' : 'bug', text: 'player ' + i, t: 1000 + i, received: false });
    for (let i = 0; i < 5100; i++) S.feedbackAppend({ id: 'C' + i, userId: 'bot', kind: 'cheat', signal: 's' + i, text: 'flag', t: 2000 + i, received: false });
    const fb = S.worldPlanningDB().feedback, players = fb.filter(f => /^P/.test(f.id)).length;
    ok(fb.length === 5000 && players === 30, '30 unread player reports + 5,100 cheat flags: ' + fb.length + ' kept, ' + players + ' player reports left (was 0)');
    for (let i = 0; i < 20; i++) S.feedbackAppend({ id: 'D' + i, userId: 'bot', kind: 'desync', signal: 'campaign-replay', text: 'd', t: 9000 + i, received: false });
    ok(S.worldPlanningDB().feedback.filter(f => /^P/.test(f.id)).length === 30, 'desync diagnostics are automatic too: the player reports stay');
    S.worldPlanningDB().feedback = []; }

  console.log('== 2. satellite outbox (child processes) ==');
  for (const m of ['--server1', '--satellite']) { const r = await child(m); const mm = /CHILD (\d+) (\d+)/.exec(r.out) || [];
    process.stdout.write(r.out.split('\n').filter(l => /^\s+(ok|FAIL) /.test(l)).map(l => '    ' + l.trim()).join('\n') + '\n');
    ok(r.code === 0 && +mm[2] === 0 && +mm[1] > 0, m.slice(2) + ' part: ' + (mm[1] || 0) + ' passed, ' + (mm[2] || '?') + ' failed'); }

  console.log('== 3. undelivered war reports: 200 kept ==');
  { ok(/const PVP_MAIL_KEEP=200;/.test(SRC) && !/pvpMail\.slice\(-20\)/.test(SRC) && (SRC.match(/pvpMail\.slice\(-PVP_MAIL_KEEP\)/g) || []).length === 9, 'every war-mail queue keeps PVP_MAIL_KEEP (200), no slice(-20) left');
    const d = await guest('war-def'); const u = S.DB.users[d.id]; u.pvpMail = [];
    for (let i = 0; i < 23; i++) { u.pvpMail.push({ id: 'w' + i, kind: 'war-declared', from: 'A' + i, t: Date.now() + i }); if (u.pvpMail.length > S.PVP_MAIL_KEEP) u.pvpMail = u.pvpMail.slice(-S.PVP_MAIL_KEEP); }
    const r = await call('/api/pvp/reports', null, d.T);
    ok(r.status === 200 && Array.isArray(r.data.reports) && r.data.reports.length === 23 && r.data.reports[0].id === 'w0', '23 war declarations on an away player: all 23 delivered (was the newest 20)'); }

  console.log('== 4. "Make a Name" needs a real rename ==');
  { const q = S.QUEST_DEFS_SRV.q_name;
    ok(q && q.cond({ renames: 0, name: 'Guest 123' }) === false, 'renames 0: not complete (was ready for everyone)');
    ok(q.cond({ renames: 1, name: 'Ash', login: 'ash01' }) === true, 'renamed here: complete');
    ok(q.cond({ renames: 0, name: 'Ash', login: 'ash01' }) === true && q.cond({ renames: 0, name: 'ash01', login: 'ash01' }) === false, 'renamed on Server 1 (name differs from the username): complete; same name: not');
    ok(S.QUEST_DEFS_SRV.q_name.reward.gems === 20, 'the reward is unchanged (20 diamonds)');
    const a = await guest('qname'); const st = await call('/api/quest/state', null, a.T);
    ok(st.status === 200 && st.data && st.data.ready && st.data.ready.q_name === false, 'a fresh account: /api/quest/state says q_name not ready');
    const c = await call('/api/quest/claim', { id: 'q_name', requestId: 'lf-qn' }, a.T);
    ok(c.data && c.data.ok !== true, 'and the claim is refused (' + JSON.stringify(c.data && c.data.error) + ')'); }

  console.log('== 5. replay disagreements are desync diagnostics ==');
  { const u = { id: 'rp1', name: 'Rp' }; S.worldPlanningDB().feedback = [];
    if (typeof S.feedbackDesyncSignal === 'function') S.feedbackDesyncSignal(u, 'campaign-replay', 'Replay disagreement ...', 'battle integrity');
    const f = (S.worldPlanningDB().feedback || [])[0] || {};
    ok(f.kind === 'desync' && f.signal === 'campaign-replay', 'filed as kind "desync" (' + f.kind + ')');
    for (const [sig, re] of [['campaign-replay', /feedbackDesyncSignal\(u,'campaign-replay',/], ['province-replay', /feedbackDesyncSignal\(me,'province-replay:'/], ['siege-replay', /feedbackDesyncSignal\(me,flag\.signal,flag\.detail,'battle integrity'\)/]])
      ok(re.test(SRC), sig + ': filed through feedbackDesyncSignal');
    ok(!/'(Province|Siege) replay mismatch/.test(SRC), 'no "replay mismatch" wording left for province / siege');
    const well = fs.readFileSync(path.join(root, 'server', 'starless-well.js'), 'utf8');
    ok(/\(ctx\.feedbackDesyncSignal \|\| ctx\.feedbackCheatSignal\)\(ctx\.me, 'well-replay:'/.test(well) && /feedbackCheatSignal, feedbackDesyncSignal, fightOtherBuild/.test(SRC), 'Well: through the desync signal');
    const adm = await call('/api/admin/feedback', null, null);
    ok(/filter\(x=>x&&!feedbackIsAuto\(x\)&&\(all\|\|!x\.adminDone\)\)/.test(SRC) && /\.sort\(\(a,b\)=>\(feedbackIsAuto\(a\)-feedbackIsAuto\(b\)\)/.test(SRC), 'the dev panel\'s player-report list leaves them out and Ember\'s feed sorts them after player reports');
    S.worldPlanningDB().feedback = []; }

  console.log('== 6. stage-chain and daily-pack claims use the line above the list ==');
  {
    ok(!/bannerMsg\(uiIcon\('check'\)\+' '\+t\('quest2\.stage_complete'\)/.test(html) && (html.match(/showQuestClaim\(uiIcon\('check'\)\+' '\+t\('quest2\.stage_complete'\)/g) || []).length === 2, 'both stage-chain claim paths (signed in / out) use showQuestClaim');
    ok(/const pd=r\.paid\|\|\{\}; showQuestClaim\(\[pd\.gems\?/.test(html), 'the daily-pack claim uses showQuestClaim');
    const r = J(`(function(){ const keep=state, kb=bannerMsg; let b=null; bannerMsg=m=>{ b=m; }; try{ state='home'; showQuestClaim('X'); return b; } finally { state=keep; bannerMsg=kb; } })()`);
    ok(r === 'X', 'outside the Quests screen it still falls back to the banner'); }

  console.log('== 7. an already-claimed compensation shows no reward pop-up ==');
  { const s = html.slice(html.indexOf('async function compClaim('), html.indexOf('function pushWar('));
    const iA = s.indexOf("if(r.already){ bannerMsg(ewT('err.already_claimed')); return true; }"), iP = s.indexOf('stageRewardPop(');
    ok(iA > 0 && iP > iA, 'already:true answers "Already claimed." and returns before the pop-up');
    ok(J(`ewT('err.already_claimed')`) === 'Already claimed.', 'existing translated text');
    ok(/if\(me\.compClaims&&me\.compClaims\[c\.id\]\) return \{ ok:true, already:true,/.test(SRC), 'the server answers already:true for a second claim'); }

  console.log('== 8. X-Forwarded-For only from our own proxy ==');
  { const ip = (sock, xff) => S.clientIP({ socket: { remoteAddress: sock }, headers: xff ? { 'x-forwarded-for': xff } : {} });
    ok(ip('203.0.113.9', '1.2.3.4') === '203.0.113.9', 'a direct client that sets X-Forwarded-For: its own address counts (' + ip('203.0.113.9', '1.2.3.4') + ')');
    ok(ip('127.0.0.1', '9.9.9.9, 1.2.3.4') === '1.2.3.4' && ip('::ffff:127.0.0.1', '5.6.7.8') === '5.6.7.8', 'from the tunnel on loopback: the proxy\'s (last) entry, as before');
    ok(ip('192.168.1.242', '7.7.7.7') === '7.7.7.7' && ip('10.0.0.5', '8.8.8.8') === '8.8.8.8', 'from our own LAN (front door / CTs): trusted');
    ok(ip('203.0.113.9') === '203.0.113.9' && ip('127.0.0.1') === '127.0.0.1', 'no header: the socket address');
    const lim = []; for (let i = 0; i < 3; i++) lim.push(S.rateLimited({ socket: { remoteAddress: '198.51.100.7' }, headers: { 'x-forwarded-for': '10.1.1.' + i } }, 'lftest', 1, 60000));
    ok(JSON.stringify(lim) === '[false,true,true]', 'a spoofed header cannot buy a fresh limit (' + JSON.stringify(lim) + ')'); }

  console.log('== 9. the empty Inbox says what it holds ==');
  { const V = JSON.parse(html.match(/\nconst EW_LANG_V=(\{.*?\});\r?\n/)[1]); const en = JSON.parse(fs.readFileSync(path.join(root, 'lang', 'en.json'), 'utf8'));
    ok(en['mail.empty_inbox'] === 'No messages yet. Messages from the Emberweave team and compensation appear here.', 'English: "' + en['mail.empty_inbox'] + '"');
    const OLD = /gremio|guilda|guilde|Gilden|gilda|gildes|гильдии|Lonca|ギルド|길드|公会|公會|กิลด์|guild|गिल्ड/i;
    for (const c of CODES) { const raw = fs.readFileSync(path.join(root, 'lang', c + '.json'), 'utf8'), s = JSON.parse(raw)['mail.empty_inbox'] || '';
      ok(s && !OLD.test(s) && /Emberweave/.test(s) && (c === 'en' || s !== en['mail.empty_inbox']) && crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8) === V[c], c + ': "' + s + '" (no guild / player messages), hash matches'); } }
})().then(() => { console.log((SOFT ? 'SOFT ' : '') + 'test_lockdown_mail_feedback_1455.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); },
  e => { console.error(e && e.stack || e); process.exit(1); });
