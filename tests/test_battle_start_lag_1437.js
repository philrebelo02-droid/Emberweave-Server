// v1437 (Phil 24 Nov 2026, forwarding tester Soul Eater: "optimizing the start of the battle, which causes lag at the beginning"; Phil: "push all together").
// Measured (ew-v1437-vaultlag-report.md, floor 80, 10 heaviest-art heroes, desktop + 4x CPU): two causes of the opening lag -
//  1. the loading screen's gate skipped every sheet an earlier preloadBattleArt had queued (vaultLaunch -> preloadVaultArt, the stage card),
//     so it closed after ~40 ms and the hero/monster sheets uploaded during the fight's first seconds (20-21 uploads, 8-16 frames over 50 ms);
//  2. _startBattleNow -> preloadAimArt keyed and tinted every hero's aim art on the battle's first frame (0.5-0.6 s desktop, 1.8-2.4 s at 4x).
// Fix: every sheet's loader callback marks it landed (s._lq), the gate waits for EVERY sheet of the match's fighters (existing timeouts kept);
// the aim art is prepared in ~8 ms slices behind the loading screen (preloadAimArtSliced). Measured after: desktop Vault 16 -> 2 frames over
// 50 ms, second fight worst frame 650 -> 33 ms, 0 sheet uploads after the start. CONTROL: v1436 (09c1c3180) has neither.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n); } };
function checks(src) {
  const sb = src.slice(src.indexOf('function startBattle(){'), src.indexOf('function _startBattleNow(){'));
  const sn = src.slice(src.indexOf('function _startBattleNow(){'), src.indexOf('function vaultReinforce(){'));
  return {
    landed: /s\._lq=0;/.test(src) && /_fired=true; s\._lq=1;/.test(src),
    gate: /const _wait=\[\]; \(keys\|\|\[\]\)\.filter\(Boolean\)\.forEach\(k=>\{ const set=\(typeof BATTLE_ANIM!=='undefined'\)&&BATTLE_ANIM\[k\];/.test(src) && /const total=_wait\.length;/.test(src),
    sliced: /function preloadAimArtSliced\(\)\{/.test(src) && /performance\.now\(\)-t0<8/.test(src),
    behindLoader: sb.indexOf('preloadAimArtSliced()') > -1 && sb.indexOf('preloadAimArtSliced()') < sb.indexOf('_blBusy=true;'),
    notFirstFrame: !/preloadAimArt\(\);/.test(sn),
    compiles: [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].every(m => { try { new vm.Script(m[1]); return true; } catch (e) { return false; } }) };
}
const NOW = checks(fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'));
const OLD = checks(cp.execSync('git show 09c1c3180:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 128 << 20 }).toString());
ck('every battle sheet marks itself landed (s._lq) when its loader fires', NOW.landed);
ck('the loading screen waits for EVERY sheet of the match, including ones queued earlier', NOW.gate);
ck('the aim art is prepared in 8 ms slices (preloadAimArtSliced)', NOW.sliced);
ck('startBattle prepares the aim art behind the loading screen', NOW.behindLoader);
ck('_startBattleNow no longer keys/tints the aim art on the first frame', NOW.notFirstFrame);
ck('every inline script compiles', NOW.compiles);
ck('CONTROL: v1436 has none of it', !OLD.landed && !OLD.gate && !OLD.sliced && !OLD.behindLoader && !OLD.notFirstFrame);
console.log('test_battle_start_lag_1437.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
