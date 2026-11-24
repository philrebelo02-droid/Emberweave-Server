'use strict';
/* v1441 REPLAY DISAGREEMENT (Phil 24 Nov 2026, on the player card's "digest-mismatch" lines: "If the server is doing auto on and not using
   ults when they matter. Players like this will always mismatch").
   The server replays every recorded press on its tick - but a HAND-AIMED ultimate was cast in the player's own fight at the raw spot the
   finger let go, while the record (and so the replay) holds that spot rounded to 2 decimals and held inside the field. Same tick, same
   hero, a hair to the side: the two fights drifted apart and ended on different digests (every stored incident on Server 1 that had a
   manual ultimate had an aimed one).
   This test plays the fight the way the page does - the engine's own queueInput() takes each press (raw aim, long decimals), the fight
   runs, INPUT_LOG is what the page would submit - then the server's replay (sim-host campaign) is run from that log, normalised the way
   server.js sanitizeInputLog does.
     1. hand-aimed ultimates: the player's fight and the server's replay end on the same digest, every fight;
     2. an aim released outside the field is held to the field in BOTH fights;
     3. the record is full (400 actions): the 401st action is not played either (it used to be played and not recorded);
     4. CONTROL: the v1439 page (git af4aab45c) fails 1, 2 and 3 on the same fights.
   Asserts (non-zero exit). */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), CONTROL_SHA = 'af4aab45c';
const SH = require(path.join(ROOT, 'server', 'sim-host.js'));
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'replay_aim_1441.json'), 'utf8')).fights;
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok  ' + m); };
const cl = x => JSON.parse(JSON.stringify(x));
// server.js sanitizeInputLog, for ult / auto entries (the limits as they are in this tree)
const clamp = (v, hi) => (v == null || !isFinite(v)) ? null : Math.max(0, Math.min(hi, +(+v).toFixed(2)));
const sanitize = log => log.slice(0, 400).map(e => e[1] === 'auto' ? [e[0] | 0, 'auto', -1, (e[3] ? 1 : 0), null, null] : [e[0] | 0, e[1], e[2] | 0, (e[3] == null ? -1 : e[3] | 0), clamp(e[4], 1000), clamp(e[5], 1400)]).sort((a, b) => a[0] - b[0]);

function engine(htmlPath) {
  const host = SH.load(htmlPath);
  // the "player": before each tick's inputs are applied, every hero with a full bar presses its ultimate through the page's own queueInput()
  vm.runInContext(`
    window.__p=null; const __pump1441=pumpInputs;
    pumpInputs=function(){ const P=window.__p;
      if(P&&!REPLAY_IN){
        if(P.kind==='aim'){ for(const u of units){ if(u.team!=='ally'||!u.alive||u.energy<100||u.stunned>0||(u.fearT||0)>0||(u.silencedT||0)>0||u._summon||!HERO_TYPES[u.key]) continue;
            let tgt=null,bd=1e9; for(const o of units){ if(o.alive&&o.team!==u.team){ const d=Math.hypot(o.x-u.x,o.y-u.y); if(d<bd){bd=d;tgt=o;} } }
            if(!tgt) continue; const mode=ultAimMode(u.abilityOverride||u.t.ability), aimed=(mode==='radius'||mode==='line');
            if(aimed) P.aimed++;
            queueInput({k:'ult',uid:u.uid,tid:tgt.uid,wx:aimed?(P.off?P.off[0]:tgt.x+0.3337):null,wy:aimed?(P.off?P.off[1]:tgt.y-0.4183):null}); } }
        else if(P.kind==='spam'){ if(P.n<P.max){ queueInput({k:'auto',uid:-1,tid:(P.n%2===0?1:0)}); P.n++; } }
      }
      return __pump1441(); };
  `, host.ctx);
  const live = (f, seed, p) => { vm.runInContext('window.__p=' + JSON.stringify(p), host.ctx);
    host.sandbox.simCampaignReplay(cl(f.snaps), cl(f.waves), seed >>> 0, null, true, 'campaign');   // no log: the fight takes live input
    const digest = host.sandbox._p2digest, log = JSON.parse(vm.runInContext('JSON.stringify(INPUT_LOG)', host.ctx)), st = JSON.parse(vm.runInContext('JSON.stringify(window.__p)', host.ctx));
    vm.runInContext('window.__p=null', host.ctx); return { digest, log, st }; };
  const replay = (f, seed, log) => host.campaign(cl(f.snaps), cl(f.waves), seed >>> 0, sanitize(log)).digest;
  return { live, replay };
}
function sweep(E) {
  let n = 0, same = 0, aimed = 0, presses = 0;
  for (const f of FX) for (let k = 0; k < 6; k++) { const seed = (f.seed + k * 7919) >>> 0, L = E.live(f, seed, { kind: 'aim', aimed: 0 }), R = E.replay(f, seed, L.log);
    n++; aimed += L.st.aimed; presses += L.log.length; if (L.digest === R) same++; }
  const f = FX[0], O = E.live(f, f.seed, { kind: 'aim', aimed: 0, off: [1180.4321, -37.777] }), offSame = O.digest === E.replay(f, f.seed, O.log), offAimed = O.st.aimed;
  const S = E.live(f, f.seed, { kind: 'spam', n: 0, max: 401 }), spamSame = S.digest === E.replay(f, f.seed, S.log);
  return { n, same, aimed, presses, offSame, offAimed, spamLog: S.log.length, spamSame };
}

console.log('== v1441: a hand-aimed ultimate is replayed where the player cast it ==');
const A = sweep(engine(path.join(ROOT, 'emberweave-heroes.html')));
ok(A.aimed >= 40 && A.presses > A.aimed, 'the fights really are hand-played: ' + A.presses + ' ultimate presses, ' + A.aimed + ' of them aimed at a spot');
ok(A.same === A.n, 'hand-aimed ultimates: the player\'s fight and the server\'s replay end on the same digest in ' + A.same + ' of ' + A.n + ' fights');
ok(A.offAimed > 0 && A.offSame, 'an aim released outside the field (' + A.offAimed + ' casts) is the same spot in both fights');
ok(A.spamLog === 400 && A.spamSame, 'a full record (400 actions): the 401st action is not played either - the replay still matches');

// CONTROL: the v1439 page, with this tree's loader and script files
const ctl = fs.mkdtempSync(path.join(os.tmpdir(), 'aim1441-'));
try {
  const html = cp.execFileSync('git', ['show', CONTROL_SHA + ':emberweave-heroes.html'], { cwd: ROOT, maxBuffer: 256 << 20 });
  fs.writeFileSync(path.join(ctl, 'emberweave-heroes.html'), html);
  for (const m of html.toString('utf8').matchAll(/<script[^>]*\ssrc="\/?([^"?]+)[^"]*"/g)) { const src = m[1]; if (src.startsWith('assets/')) continue;
    const to = path.join(ctl, src); fs.mkdirSync(path.dirname(to), { recursive: true });
    try { fs.writeFileSync(to, cp.execFileSync('git', ['show', CONTROL_SHA + ':' + src], { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (_) { if (fs.existsSync(path.join(ROOT, src))) fs.copyFileSync(path.join(ROOT, src), to); } }
  const C = sweep(engine(path.join(ctl, 'emberweave-heroes.html')));
  ok(C.same < C.n, 'CONTROL v1439: the same hand-aimed fights disagree with their replay in ' + (C.n - C.same) + ' of ' + C.n);
  ok(!C.offSame, 'CONTROL v1439: an aim outside the field is cast at one spot by the player and another by the replay');
  ok(C.spamLog === 400 && !C.spamSame, 'CONTROL v1439: the 401st action is played but not recorded - the replay disagrees');
} finally { try { fs.rmSync(ctl, { recursive: true, force: true }); } catch (_) {} }
console.log(''); console.log('test_replay_aim_1441.js: ' + pass + ' passed, 0 failed');
