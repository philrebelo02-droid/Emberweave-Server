'use strict';
// v1127 CHAT CAP (Phil 11 Oct 2026: "chat should disappear after 100 messages and immediately be removed from cache unless saving by a
// 'report' player option"). A real server + the real client:
//  - world chat over the WebSocket: the 101st line drops the 1st - a new joiner's history is the last 100 (line 2..101), the saved
//    world (read through world-store) holds the same 100 within ~CHAT_SAVE_MS, and after a hard kill + restart too;
//  - a line reported before it fell off (racism -> the moderation queue, other -> the feedback inbox) is kept there with its
//    context lines, the reporter, the sender and the time - after the cap, after the save and after the restart (/api/dev/reports);
//    reporting the dropped line afterwards answers "no longer available";
//  - guild chat: 101 posts keep the last 100, the reported first post survives in the report store;
//  - the stored game save keeps at most 100 lines per whisper conversation and of the offline guild log;
//  - the client (Chromium): a save with 150 whisper lines and 120 guild-log lines is cut to 100 in memory AND in localStorage on
//    load; 101 live world lines / whispers keep the last 100.
// Control: 59eaefba must fail (no save cut, no client cut, the dropped line still on disk, no context on an 'other' report).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const WebSocket = require('ws');
const { chromium } = require('playwright');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sock(S, p, ip) { return new Promise((res, rej) => {
  const ws = new WebSocket('ws://127.0.0.1:' + S.port, { headers: { 'x-forwarded-for': ip } }); const s = { ws, inbox: [], p };
  ws.on('message', d => { try { s.inbox.push(JSON.parse(d.toString())); } catch (_) {} });
  s.send = o => ws.send(JSON.stringify(Object.assign({ token: p.token }, o)));
  ws.on('open', () => { s.send({ t: 'chatjoin', name: p.name }); res(s); }); ws.on('error', rej); }); }
async function until(f, ms, what) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await R.sleep(20); } throw Error('timed out: ' + what); }

async function serverPart(S, check) {
  const B = await R.boot(S, 'cc', 24, { world: false });
  const senders = B.players.slice(0, 21), V = B.players[21], Z = B.players[22], Q = B.players[23];
  for (const p of [V, ...senders.slice(0, 2)]) await S.req('POST', '/api/admin/led-grant', { userId: p.id, px: 900000 }, B.A);   // level 13+: the Guild Hall
  const socks = []; for (let i = 0; i < senders.length; i++) socks.push(await sock(S, senders[i], '10.90.' + i + '.1'));
  const sv = await sock(S, V, '10.90.200.1'); await R.sleep(300);
  // line 1, and the viewer reports it (racism -> moderation queue) and line 3 (other -> feedback inbox) while they are live
  const lines = [];
  for (let n = 1; n <= 101; n++) {
    const s = socks[(n - 1) % socks.length], txt = 'cap-' + n;
    s.send({ t: 'chat', channel: 'world', text: txt });
    const m = await until(() => sv.inbox.find(x => x.t === 'chatmsg' && x.txt === txt), 5000, 'line ' + n);
    lines.push(m);
    if (n === 5) {
      const r1 = await S.req('POST', '/api/chat/report', { mid: lines[0].mid, reason: 'racism' }, V.token, '10.91.0.1');
      const r3 = await S.req('POST', '/api/chat/report', { mid: lines[2].mid, reason: 'other' }, V.token, '10.91.0.2');
      check(r1.status === 200 && r1.body.queue === 'moderation' && r3.status === 200 && r3.body.queue === 'feedback', 'lines 1 and 3 reported while live (' + r1.status + ' ' + r1.body.queue + ', ' + r3.status + ' ' + r3.body.queue + ')');
    }
  }
  // a new joiner's history: the last 100
  const sz = await sock(S, Z, '10.90.201.1');
  const hist = await until(() => sz.inbox.find(x => x.t === 'chathist'), 5000, 'history');
  check(hist.world.length === 100 && hist.world[0].txt === 'cap-2' && hist.world[99].txt === 'cap-101' && !hist.world.some(x => x.txt === 'cap-1'),
    'the 101st line dropped the 1st: a new joiner gets lines 2..101 (' + hist.world.length + ' lines, first ' + (hist.world[0] || {}).txt + ')');
  const again = await S.req('POST', '/api/chat/report', { mid: lines[0].mid, reason: 'harassment' }, Q.token, '10.91.0.3');
  check(again.status === 404, 'the dropped line can no longer be reported - it is gone from the server (' + again.status + ')');
  // the saved world drops it at once (CHAT_SAVE_MS=300 here, 2 s by default)
  await R.sleep(1200);
  const disk = WS.readWorld(S.db), dw = (disk.chat && disk.chat.world) || [];
  check(dw.length === 100 && dw[0].txt === 'cap-2' && !dw.some(x => x.txt === 'cap-1'), 'the saved world holds the same 100 lines within ~1 s (' + dw.length + ' lines, first ' + (dw[0] || {}).txt + ')');
  const repOk = (reps, fb) => {
    const rr = (reps || []).find(x => x && x.chat && x.chat.text === 'cap-1'), ff = (fb || []).find(x => x && x.chat && x.chat.text === 'cap-3');
    return { rr, ff, ok: !!rr && rr.reporterId === V.id && rr.reporterName === V.name && rr.chat.senderId === senders[0].id && rr.chat.sender === senders[0].name && rr.chat.t > 0 && rr.context.length >= 4 && rr.context.some(c => c.text === 'cap-2')
      && !!ff && ff.reporterId === V.id && ff.chat.senderId === senders[2].id && Array.isArray(ff.context) && ff.context.some(c => c.text === 'cap-2') && ff.context.some(c => c.text === 'cap-4') };
  };
  const onDisk = repOk(disk.reports, disk.feedback);
  check(onDisk.ok, 'both reports are in the saved report stores with the reporter, the sender, the time and the lines around them (' + (onDisk.rr ? onDisk.rr.context.length : 0) + ' / ' + (onDisk.ff && onDisk.ff.context ? onDisk.ff.context.length : 0) + ' context lines)');
  // guild chat: 101 posts, the first reported
  const G0 = senders[0];
  const gc = await S.req('POST', '/api/guild/create', { name: 'Cap Guild' }, G0.token, '10.92.0.1');
  assert.equal(gc.status, 200, JSON.stringify(gc.body).slice(0, 160));
  let first = null;
  for (let n = 1; n <= 101; n++) {
    const r = await S.req('POST', '/api/guild/chat', { tx: 'gcap-' + n }, G0.token, '10.93.' + (n >> 4) + '.' + (n & 15));
    assert.equal(r.status, 200, 'guild post ' + n + ': ' + JSON.stringify(r.body).slice(0, 120));
    if (n === 1) { first = (r.body.log || []).find(e => e.tx === 'gcap-1'); const rp = await S.req('POST', '/api/chat/report', { mid: first.mid, reason: 'harassment' }, G0.token, '10.91.0.4');
      check(rp.status === 200 && rp.body.queue === 'moderation', 'guild line 1 reported while live (' + rp.status + ')'); }
  }
  await R.sleep(800);
  const gd = WS.readWorld(S.db), glog = (gd.guilds[gc.body.guild.id].log || []);
  check(glog.length <= 100 && !glog.some(e => e.tx === 'gcap-1') && glog.some(e => e.tx === 'gcap-101'), 'guild chat keeps its last 100 lines (' + glog.length + ' stored, gcap-1 gone)');
  // the stored save: whisper conversations and the offline guild log are cut to 100
  const big = { whispers: { Bob: Array.from({ length: 150 }, (_, i) => ({ who: 'Bob', txt: 'w' + (i + 1) })), Ann: [{ who: 'Ann', txt: 'hi' }] }, guildLog: Array.from({ length: 120 }, (_, i) => 'g' + (i + 1)) };
  const sr = await S.req('POST', '/api/save', { roster: { __save: JSON.stringify(big) } }, Q.token, '10.94.0.1');
  await R.sleep(700);
  const sv2 = JSON.parse((WS.readWorld(S.db).users[Q.id].roster || {}).__save || '{}');
  check(sr.status === 200 && sv2.whispers && sv2.whispers.Bob.length === 100 && sv2.whispers.Bob[0].txt === 'w51' && sv2.whispers.Ann.length === 1 && sv2.guildLog.length === 100 && sv2.guildLog[0] === 'g21',
    'the stored save keeps the last 100 lines of each whisper conversation and of the guild log (' + (sv2.whispers ? sv2.whispers.Bob.length : '-') + ', ' + (sv2.guildLog || []).length + ')');
  // hard kill + restart: the reports and the 100 lines are still there
  for (const s of [...socks, sv, sz]) { try { s.ws.terminate(); } catch (_) {} }
  await S.kill(); await S.start(B.adminId);
  const A2 = (await S.req('POST', '/api/login', { name: 'ccAdm', pass: 'password1' })).body.token;
  const reps = (await S.req('GET', '/api/dev/reports?all=1', null, A2)).body.reports || [];
  const after = repOk(reps, WS.readWorld(S.db).feedback);
  const guildRep = reps.find(x => x.chat && x.chat.text === 'gcap-1');
  check(after.ok && !!guildRep, 'after a hard kill and restart both chat reports and the guild report are where admins review them (/api/dev/reports + the feedback inbox)');
  const sq = await sock(S, Q, '10.90.202.1'); const h2 = await until(() => sq.inbox.find(x => x.t === 'chathist'), 5000, 'history after restart'); sq.ws.terminate();
  check(h2.world.length === 100 && !h2.world.some(x => x.txt === 'cap-1'), 'after the restart the history is still lines 2..101 (' + h2.world.length + ')');
}

async function clientPart(S, check) {
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const seed = { whispers: { Bob: Array.from({ length: 150 }, (_, i) => ({ who: 'Bob', txt: 'w' + (i + 1) })) }, guildLog: Array.from({ length: 120 }, (_, i) => 'g' + (i + 1)) };
    await page.addInitScript(s => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('emberweave_save_v08', s); sessionStorage.setItem('seeded', '1'); } } catch (e) {} }, JSON.stringify(seed));
    await page.goto(S.base + '/play', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof G === 'object' && typeof onChatNet === 'function', null, { timeout: 15000 });
    await page.waitForTimeout(500);
    const loaded = await page.evaluate(() => { const ls = JSON.parse(localStorage.getItem('emberweave_save_v08') || '{}');
      return { mem: (G.whispers && G.whispers.Bob || []).length, memFirst: ((G.whispers && G.whispers.Bob) || [])[0], ls: ((ls.whispers || {}).Bob || []).length, lsFirst: (((ls.whispers || {}).Bob) || [])[0], glMem: (G.guildLog || []).length, glLs: (ls.guildLog || []).length }; });
    check(loaded.mem === 100 && loaded.memFirst && loaded.memFirst.txt === 'w51' && loaded.ls === 100 && loaded.lsFirst && loaded.lsFirst.txt === 'w51' && loaded.glMem === 100 && loaded.glLs === 100,
      'client: a stored 150-line whisper conversation and 120-line guild log are cut to the last 100 in memory and in localStorage on load (' + loaded.mem + '/' + loaded.ls + ', ' + loaded.glMem + '/' + loaded.glLs + ')');
    const live = await page.evaluate(() => { initChat(); CHAT.world = [];
      for (let i = 1; i <= 101; i++) onChatNet({ t: 'chatmsg', channel: 'world', who: 'X', txt: 'live-' + i, mid: 'm' + i });
      for (let i = 1; i <= 101; i++) onChatNet({ t: 'whispermsg', from: 'Zed', txt: 'z' + i, mid: 'z' + i });
      const ls = JSON.parse(localStorage.getItem('emberweave_save_v08') || '{}');
      return { n: CHAT.world.length, first: CHAT.world[0] && CHAT.world[0].txt, last: CHAT.world[CHAT.world.length - 1].txt, wz: G.whispers.Zed.length, wzFirst: G.whispers.Zed[0].txt, lsZ: ((ls.whispers || {}).Zed || []).length }; });
    check(live.n === 100 && live.first === 'live-2' && live.last === 'live-101', 'client: 101 live world lines keep lines 2..101 (' + live.n + ', first ' + live.first + ')');
    check(live.wz === 100 && live.wzFirst === 'z2' && live.lsZ === 100, 'client: 101 whispers keep the last 100, in memory and in localStorage (' + live.wz + '/' + live.lsZ + ')');
    check(errors.length === 0, 'client: no page errors (' + errors.slice(0, 2).join(' | ') + ')');
  } finally { await browser.close(); }
}

async function runOn(dir, check) {
  const S = await R.server({ dir, env: { CHAT_SAVE_MS: '300', RL_MUL: '1000' } });
  try { await serverPart(S, check); await clientPart(S, check); } finally { await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== this tree');
    await runOn(R.root, R.ok);
    console.log('== control ' + R.CONTROL_SHA + ' (must fail)');
    const misses = [];
    try { await runOn(R.controlTree(), (c, m) => { if (!c) misses.push(m); }); } catch (e) { misses.push('threw: ' + e.message.slice(0, 160)); }
    misses.forEach(m => console.log('  control fails as it must: ' + m));
    R.ok(misses.length >= 3, 'CONTROL: ' + R.CONTROL_SHA + ' fails ' + misses.length + ' of the checks');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(); }
  console.log('test_chat_cap.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
