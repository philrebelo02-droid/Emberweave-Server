'use strict';
// v1129 probe, preloaded into a test server (node -r tests/helpers/live-probe.cjs server.js), main thread only. Works on any tree:
//  - counts World Tree fights (server/world-tree-battle.js create() -> battle fn) and Skyfall line fights (server/sim.js
//    resolveLineBattle) run on the MAIN thread, with their time;
//  - logs every battle the pool's live path returned (sim-pool.js runLive: method, args, result) for the byte-identity check;
//  - samples the event loop every 250 ms: cumulative utilisation (active / idle ms) and the worst delay in each sample.
// Everything goes to LIVE_PROBE_DIR (status.json rewritten each sample, live.jsonl appended).
const { isMainThread } = require('node:worker_threads');
if (isMainThread && process.env.LIVE_PROBE_DIR) {
  const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), { performance, monitorEventLoopDelay } = require('node:perf_hooks');
  const dir = process.env.LIVE_PROBE_DIR, st = { wt: 0, wtMs: 0, line: 0, lineMs: 0, liveLogged: 0, samples: [] };
  const timed = (fn, n, ms) => function (...a) { const t = performance.now(); try { return fn.apply(this, a); } finally { st[n]++; st[ms] += performance.now() - t; } };
  const origLoad = Module._load; const done = new Set();
  Module._load = function (request, parent, isMain) {
    const out = origLoad.apply(this, arguments);
    let file = ''; try { file = Module._resolveFilename(request, parent, isMain).replace(/\\/g, '/'); } catch (_) { return out; }
    if (done.has(file)) return out;
    if (/\/server\/world-tree-battle\.js$/.test(file)) { done.add(file); const c = out.create; out.create = function (host) { return timed(c.call(this, host), 'wt', 'wtMs'); }; }
    else if (/\/server\/sim\.js$/.test(file)) { done.add(file); out.resolveLineBattle = timed(out.resolveLineBattle, 'line', 'lineMs'); }
    else if (/\/server\/sim-pool\.js$/.test(file)) { done.add(file); const c = out.create;
      out.create = function (...a) { const P = c.apply(this, a); if (typeof P.runLive === 'function') { const rl = P.runLive;
        P.runLive = (m, args, o) => rl(m, args, o).then(r => { st.liveLogged++; try { fs.appendFileSync(path.join(dir, 'live.jsonl'), JSON.stringify({ m, args, r }) + '\n'); } catch (_) {} return r; }); }
        return P; }; }
    return out;
  };
  const h = monitorEventLoopDelay({ resolution: 5 }); h.enable();
  const t = setInterval(() => { const e = performance.eventLoopUtilization();
    st.samples.push([Date.now(), +(h.max / 1e6).toFixed(1), +e.active.toFixed(1), +e.idle.toFixed(1)]); if (st.samples.length > 2400) st.samples.shift(); h.reset();
    try { fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(st)); } catch (_) {} }, 250);
  t.unref();
}
