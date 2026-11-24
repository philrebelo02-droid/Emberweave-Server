'use strict';
/* v1441 REPLAY DISAGREEMENT - AUTO THAT NEVER CAME ON (Phil 24 Nov 2026: "make sure the game is actually replaying with auto on").
   In a streamed campaign fight the AUTO switch is sent to the server, which answers with the tick it lands on (its own clock + 9).
   The page files the action under that tick and pumpInputs applies whatever is filed under the CURRENT tick. When the answer named a
   tick the fight had already played (the server's clock behind the page's, or the answer late while the page waited at its hold), the
   action sat under a past tick for ever: AUTO was never applied in the player's fight (the button stayed on "switching", no hero used
   an ultimate) but it WAS in the record at that tick - so the server replayed the fight with AUTO on. Stored record, Server 1,
   10 Nov, stage 9-8: speed at tick 12, AUTO at tick 17, the replay won, the player lost.
   The page's own onActAck / pumpInputs are run in the engine host:
     1. an answer naming a tick already played: the action is applied on the next tick, logged on the tick it is really applied,
        nothing is left under the past tick, and the fight hands over to its own log (stream off);
     2. an answer naming a coming tick is filed and applied on that tick, exactly as before;
     2b. HOW A TICK GETS PASSED: the answer to a SPEED change (nothing waits on it) took one off the count of actions the fight is
        holding for, so with speed and AUTO pressed close together (every 2x + AUTO player) the fight stopped waiting for AUTO's tick.
        Reproduced in a real browser on v1439 with 250 ms each way: AUTO logged at tick 30, never on in the player's fight, replay differs.
        Now a speed answer releases nothing;
     3. CONTROL: the v1439 page (git af4aab45c) files case 1 under the past tick - AUTO never turns on, the log says it did.
   Asserts (non-zero exit). */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), CONTROL_SHA = 'af4aab45c';
const SH = require(path.join(ROOT, 'server', 'sim-host.js'));
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok  ' + m); };
const probe = htmlPath => { const host = SH.load(htmlPath);
  return JSON.parse(vm.runInContext(`(function(){
    const run=(ackTick)=>{ CUR={mode:'campaign',attemptId:'t1441'}; seedBattle(4242); units=[]; REPLAY_IN=null;
      simTick=50; autoUlt=false; autoPendingTarget=true;                      // the player pressed AUTO at tick 41; the fight waited at the hold and is now on tick 50
      _actStreamOn=true; _actSeq=5; _actSent[5]={k:'auto',uid:-1,tid:1}; _actWait=1; _actWaitFrom=41; _actWaitAt=Date.now();
      onActAck({seq:5, ok:true, tick:ackTick, accepted:5, clientTick:41});
      const o={ filed:Object.keys(_actSched).map(Number), queued:_inputQ.length, log:JSON.parse(JSON.stringify(INPUT_LOG)), stream:_actStreamOn, wait:_actWait };
      const at=[]; for(let i=0;i<8;i++){ pumpInputs(); at.push([simTick,autoUlt?1:0]); simTick++; }   // the next eight ticks
      o.onAt=(at.find(x=>x[1])||[-1])[0]; o.pending=autoPendingTarget; o.left=Object.keys(_actSched).length; return o; };
    /* speed, then AUTO, pressed close together on a live stream: the speed's answer comes back while AUTO is still waiting for its own */
    const hold=()=>{ CUR={mode:'campaign',attemptId:'t1441'}; seedBattle(4242); units=[]; REPLAY_IN=null; const sent=[];
      const acc=ACC.token, ws=CHATNET.ws; ACC.token='t'; CHATNET.ws={readyState:1,send:x=>sent.push(JSON.parse(x))}; _actStreamOn=true; _actSeq=1;   // seq 1 was 'begin'
      try{ simTick=41; streamSpeed(2); queueInput({k:'auto',uid:-1,tid:1}); const kinds=sent.map(x=>x.kind+':'+x.seq).join(',');
        onActAck({seq:2, ok:true, tick:50, accepted:2}); simTick=50;                          // the speed's answer; the fight has reached the hold (41 + 9)
        return { kinds, wait:_actWait, held:actHold(), log:INPUT_LOG.length }; }
      finally{ ACC.token=acc; CHATNET.ws=ws; _actStreamOn=false; _actWait=0; _actSent={}; } };
    const out={ past:run(44), future:run(53), hold:hold() }; units=[]; autoUlt=false; autoPendingTarget=null; return JSON.stringify(out); })()`, host.ctx)); };

console.log('== v1441: an AUTO switch answered with a tick already played still turns AUTO on ==');
const A = probe(path.join(ROOT, 'emberweave-heroes.html'));
ok(A.past.onAt === 50 && A.past.pending === null, 'answer names tick 44, the fight is on tick 50: AUTO comes on at tick ' + A.past.onAt + ' (the button leaves "switching")');
ok(JSON.stringify(A.past.log) === JSON.stringify([[50, 'auto', -1, 1, null, null]]), 'the record holds AUTO on the tick it was really applied: ' + JSON.stringify(A.past.log));
ok(A.past.filed.indexOf(44) < 0 && A.past.left === 0 && A.past.stream === false && A.past.wait === 0, 'nothing is left under the past tick; the fight hands over to its own log (stream off)');
ok(A.hold.kinds === 'speed:2,auto:3' && A.hold.wait === 1 && A.hold.held === true, 'speed then AUTO on a live stream: the answer to the speed change does not release the hold - the fight still waits for the tick of AUTO (sent ' + A.hold.kinds + ')');
ok(A.future.onAt === 53 && JSON.stringify(A.future.log) === JSON.stringify([[53, 'auto', -1, 1, null, null]]) && A.future.stream === true, 'an answer naming a coming tick (53) is applied on that tick and the stream stays on, as before');

const ctl = fs.mkdtempSync(path.join(os.tmpdir(), 'ack1441-'));
try {
  const html = cp.execFileSync('git', ['show', CONTROL_SHA + ':emberweave-heroes.html'], { cwd: ROOT, maxBuffer: 256 << 20 });
  fs.writeFileSync(path.join(ctl, 'emberweave-heroes.html'), html);
  for (const m of html.toString('utf8').matchAll(/<script[^>]*\ssrc="\/?([^"?]+)[^"]*"/g)) { const src = m[1]; if (src.startsWith('assets/')) continue;
    const to = path.join(ctl, src); fs.mkdirSync(path.dirname(to), { recursive: true });
    try { fs.writeFileSync(to, cp.execFileSync('git', ['show', CONTROL_SHA + ':' + src], { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (_) { if (fs.existsSync(path.join(ROOT, src))) fs.copyFileSync(path.join(ROOT, src), to); } }
  const C = probe(path.join(ctl, 'emberweave-heroes.html'));
  ok(C.past.onAt === -1 && C.past.pending === true && C.past.filed.indexOf(44) >= 0, 'CONTROL v1439: the action is filed under tick 44 and AUTO never comes on (button stuck on "switching")');
  ok(JSON.stringify(C.past.log) === JSON.stringify([[44, 'auto', -1, 1, null, null]]), 'CONTROL v1439: yet the record says AUTO came on at tick 44 - the replay fights with AUTO, the player without');
  ok(C.future.onAt === 53, 'CONTROL v1439: a coming tick works there too (the check is fair)');
  ok(C.hold.kinds === 'speed:2,auto:3' && C.hold.wait === 0 && C.hold.held === false, 'CONTROL v1439: the answer to the speed change releases the hold of AUTO - the fight runs on past the tick the server is about to name');
} finally { try { fs.rmSync(ctl, { recursive: true, force: true }); } catch (_) {} }
console.log(''); console.log('test_auto_ack_tick_1441.js: ' + pass + ' passed, 0 failed');
