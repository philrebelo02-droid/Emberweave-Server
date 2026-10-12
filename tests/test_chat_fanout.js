'use strict';
// v1128 CHAT FAN-OUT (S1 copy run 12 Oct 2026: world chat broadcast was 10% of the main thread at 2,000 players, 21% at 4,000 - one
// socket write per line per listener). A real server, 120 listeners on real WebSocket clients, five chatters sending 30 lines in a
// burst (6 each - the per-account chat pace):
//  - every listener gets every line, all in the same order (each chatter's in the order sent), as a TEXT message with the exact
//    fields; a line over 125 bytes arrives whole; a listener who blocked one chatter gets every line but that one's; a whisper reaches its
//    target only; a reply sent right after queued lines arrives after them;
//  - the burst costs well under one socket write per line per listener (lines are framed once and written together);
// CONTROL c9f40cd8: at least one socket write per line per listener.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const WebSocket = require('ws');
const R = require('./helpers/split-rig.cjs');
const HOOK = path.join(__dirname, 'helpers', 'socket-write-hook.cjs');
const CONTROL = 'c9f40cd8';
const N_LIS = 120, N_LINES = 30;

function sock(S, p, ip) { return new Promise((res, rej) => { const ws = new WebSocket('ws://127.0.0.1:' + S.port, { headers: { 'x-forwarded-for': ip } }); const s = { ws, inbox: [], binary: 0 };
  ws.on('message', (d, isBin) => { if (isBin) s.binary++; try { s.inbox.push(JSON.parse(d.toString())); } catch (_) { s.inbox.push({ bad: d.toString().slice(0, 40) }); } });
  s.send = o => ws.send(JSON.stringify(Object.assign({ token: p.token }, o)));
  ws.on('open', () => { s.send({ t: 'chatjoin', name: p.name }); res(s); }); ws.on('error', rej); }); }
const writesNow = f => { try { return +fs.readFileSync(f, 'utf8') || 0; } catch (_) { return 0; } };

async function run(dir, check) {
  const side = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-fanout-')), wlog = path.join(side, 'writes.txt');
  const S = await R.server({ dir, nodeArgs: ['-r', HOOK], env: { SOCKET_WRITE_LOG: wlog, CHAT_SAVE_MS: '5000' } });
  const socks = [];
  try {
    const B = await R.boot(S, 'cf', 8, { world: false });
    const talkers = B.players.slice(0, 5), [blocker, whisperTo, other] = B.players.slice(5), talker = talkers[0];
    const bl = await S.req('POST', '/api/chat/block', { id: talker.id }, blocker.token, blocker.ip);
    check(bl.status === 200, 'setup: one listener blocks one chatter (' + bl.status + ')');
    const TS = []; for (let i = 0; i < talkers.length; i++) TS.push(await sock(S, talkers[i], '10.70.0.' + (i + 1))); const T = TS[0];
    for (let i = 0; i < N_LIS; i++) socks.push(await sock(S, i === 0 ? blocker : i === 1 ? whisperTo : other, '10.71.' + (i >> 4) + '.' + (i & 15)));
    await R.sleep(800); for (const s of socks) s.inbox.length = 0;
    const LONG = 'long '.repeat(36).trim();   // a 179-character line
    const w0 = writesNow(wlog); await R.sleep(250); const w0b = writesNow(wlog);
    for (let k = 0; k < N_LINES; k++) TS[k % 5].send({ t: 'chat', channel: 'world', text: 'fan line ' + k + (k === 5 ? ' ' + LONG : '') });
    await R.sleep(1500);
    const w1 = writesNow(wlog), burstWrites = Math.max(0, w1 - w0b - (w0b - w0) * 6);   // minus the idle background (~1.5 s)
    const listeners = socks.slice(1), seq = s => s.inbox.filter(m => m.t === 'chatmsg').map(m => m.txt).join('|'), first = seq(listeners[0]);
    const byTalker = s => talkers.every((t, i) => { const mine = s.inbox.filter(m => m.t === 'chatmsg' && m.who === t.name).map(m => +m.txt.split(' ')[2]); return mine.length === 6 && mine.every((k, j) => k === i + 5 * j); });
    const okAll = listeners.every(s => { const lines = s.inbox.filter(m => m.t === 'chatmsg'); return lines.length === N_LINES && seq(s) === first && byTalker(s) && lines.every(m => m.channel === 'world' && m.mid); });
    const chipOk = listeners.every(s => s.inbox.some(x => x.txt === 'fan line 5 ' + LONG));
    check(okAll && listeners.every(s => s.binary === 0), 'all ' + listeners.length + ' listeners got the ' + N_LINES + ' lines in order, as text, fields exact');
    check(chipOk, 'a line over 125 bytes (' + JSON.stringify({ t: 'chatmsg', txt: 'fan line 5 ' + LONG }).length + '+ B: a 2-byte frame length) arrives whole');
    const bLines = socks[0].inbox.filter(m => m.t === 'chatmsg');
    check(bLines.length === N_LINES - 6 && bLines.every(m => m.who !== talker.name), 'the listener who blocked one chatter got every line but that one\'s (' + bLines.length + ')');
    // a whisper reaches its target's sockets only; a reply right after queued lines comes after them
    T.send({ t: 'whisper', to: whisperTo.name, text: 'psst' }); await R.sleep(400);
    const gotW = socks.filter(s => s.inbox.some(m => m.t === 'whispermsg' && m.txt === 'psst'));
    check(gotW.length === 1 && gotW[0] === socks[1], 'a whisper reaches its target only (' + gotW.length + ' socket)');
    const L = socks[2]; L.inbox.length = 0;
    await R.sleep(10500);   // the chat pace (6 lines / 10 s / account)
    T.send({ t: 'chat', channel: 'world', text: 'before join' }); await R.sleep(5); L.send({ t: 'chatjoin', name: other.name }); await R.sleep(500);
    const iLine = L.inbox.findIndex(m => m.t === 'chatmsg' && m.txt === 'before join'), iHist = L.inbox.findIndex(m => m.t === 'chathist');
    check(iLine >= 0 && iHist > iLine, 'a reply to a listener (chat history) arrives after the lines queued for it (line ' + iLine + ', history ' + iHist + ')');
    const perLine = burstWrites / (N_LINES * listeners.length);
    check(perLine < 0.35, 'socket writes for the burst: ' + burstWrites + ' for ' + N_LINES + ' lines x ' + listeners.length + ' listeners = ' + perLine.toFixed(2) + ' per line per listener');
    return { perLine, burstWrites };
  } finally { for (const s of socks) try { s.ws.terminate(); } catch (_) {} await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== this tree'); const mine = await run(R.root, R.ok);
    console.log('== control ' + CONTROL + ' (must fail)');
    const misses = []; let ctl = null;
    try { ctl = await run(R.controlTree(CONTROL), (c, m) => { if (!c) misses.push(m); }); } catch (e) { misses.push('threw: ' + e.message.slice(0, 160)); }
    misses.forEach(m => console.log('  control fails as it must: ' + m));
    R.ok(ctl && misses.length >= 1 && ctl.perLine >= 1, 'CONTROL: on ' + CONTROL + ' the burst made ' + (ctl ? ctl.perLine.toFixed(2) : '?') + ' socket writes per line per listener (this tree: ' + mine.perLine.toFixed(2) + ')');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(CONTROL); }
  console.log('test_chat_fanout.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
