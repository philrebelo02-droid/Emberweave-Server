'use strict';
// v1043 (Phil 6 Oct 2026: "They are meant to help 50% if using less than 30% for their own server" -> "So then push it to 50%" /
// "Instead of 30" / "My computer helped server 3 howmuch? In this phase 4 test"):
// - one slow second (a save) does not make a server "strained" - its helper keeps helping; a sustained slowdown (3 of the last 5
//   seconds) still does; battles queuing still does;
// - a helper counts the battles it fought for each server (/health byServer).
// (The 50% threshold lives in the Archive's tools/helper_phase.sh - checked on the machines, not here.)
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..'), GAME = path.join(root, 'emberweave-heroes.html');
const HOST = require(path.join(root, 'server/sim-host.js')), POOL = require(path.join(root, 'server/sim-pool.js'));
const BATTLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/battles_1039.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const block = ms => { const t = Date.now(); while (Date.now() - t < ms) {} };
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const KEY = 'test-helper-key-' + 's'.repeat(16); let helper = null;
(async () => {
  try {
    // 1) strain: one slow second is not strain; a sustained slowdown is
    const P = POOL.create(GAME, { size: 1, trackStrain: true, stressLagMs: 25 });
    for (let i = 0; i < 150 && !P.stats.ready; i++) await sleep(200);
    await sleep(2500);
    ok(P.strained() === false, 'idle server: not strained');
    block(400); await sleep(3200);
    ok(P.strained() === false, 'one slow second (a 400 ms stall, like a full save): still not strained - its helper keeps helping');
    const until = Date.now() + 5200; while (Date.now() < until) { block(180); await sleep(60); }
    ok(P.strained() === true, 'running late second after second (5 s): strained - its helper stays out');
    await sleep(6500);
    ok(P.strained() === false, 'once it catches up (5 calm seconds): not strained again');
    P.close();

    // 2) per-server battle counts on a helper
    const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-helper-')), cfg = path.join(dir, 'cfg.json');
    fs.writeFileSync(cfg, JSON.stringify({ key: KEY, port, host: '127.0.0.1', workers: 2, busyCpu: 5 }));
    helper = spawn(process.execPath, [path.join(root, 'server/sim-helper.js')], { env: { ...process.env, SIM_HELPER_CONFIG: cfg }, stdio: 'ignore', windowsHide: true });
    const url = 'http://127.0.0.1:' + port; let h0 = null;
    for (let i = 0; i < 150; i++) { try { h0 = await (await fetch(url + '/health')).json(); if (h0.ready > 0) break; } catch (e) {} await sleep(200); }
    const FP = HOST.fingerprint(GAME), fight = (from, b) => fetch(url + '/battle', { method: 'POST', headers: { 'x-helper-key': KEY },
      body: JSON.stringify({ fp: FP, method: 'auto', args: [b.snaps, b.foe, b.seed], from }) }).then(r => r.status);
    const st = []; for (const b of BATTLES.slice(0, 5)) st.push(await fight('3', b)); for (const b of BATTLES.slice(5, 7)) st.push(await fight('1', b));
    const h1 = await (await fetch(url + '/health')).json();
    ok(st.every(s => s === 200) && h1.byServer['server 3'] === 5 && h1.byServer['server 1'] === 2, 'the helper counts battles per server: ' + JSON.stringify(h1.byServer));
    console.log('PASS ' + pass + ' checks');
  } catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
  finally { if (helper) helper.kill(); setTimeout(() => process.exit(), 300); }
})();
