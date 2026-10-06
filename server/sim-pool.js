'use strict';
/* v1036 (Phil 5 Oct 2026, "use both cores?" / "do it all"): a small pool of battle workers (server/sim-worker.js), one per spare
   core. run(method, args) resolves with the worker's result, or rejects (not ready, busy past the queue cap, timeout, worker
   error) - callers then fight on the main thread exactly as before, so the pool can only make a battle cheaper, never different.

   v1039 BATTLE HELPERS (Phil 6 Oct 2026: "When the server is stressing - high war time - my computer comes to support it if its
   not busy"). opts.helpers = [{url, key}] (server/sim-helper.js on another machine), opts.fp = this server's engine fingerprint.
   When `stressQueue` or more battles are already waiting for this pool's workers, a battle goes to a helper that last reported
   the same engine, not busy, and ready. Any refusal (busy 503, other build 409, key 401), error or `helperTimeoutMs` runs it here
   instead, so a helper can only make a battle sooner, never different or missing. Every `checkEvery`-th helper result is fought
   again here when this pool is idle; a different result stops that helper for good (logged, counted in stats.helper). */
const { Worker } = require('worker_threads');
const os = require('os'), path = require('path');

function create(gameFile, opts = {}) {
  const size = Math.max(1, Math.min(opts.size || (os.cpus().length - 1) || 1, 4));
  const timeoutMs = opts.timeoutMs || 15000, queueMax = opts.queueMax || 400;
  const workers = [], waiting = [], pending = new Map();
  const stats = { size, ready: 0, runs: 0, errors: 0, timeouts: 0, rejectedFull: 0, buildVersion: null };
  const helpers = (opts.helpers || []).filter(h => h && h.url && h.key).map(h => ({ url: String(h.url).replace(/\/$/, ''), key: h.key, ok: false, why: 'not checked', disabled: false }));
  const stressQueue = opts.stressQueue || size, helperTimeoutMs = opts.helperTimeoutMs || 4000, checkEvery = opts.checkEvery || 25;
  if (helpers.length) stats.helper = { sent: 0, done: 0, fellBack: 0, checked: 0, mismatches: 0, helpers: helpers.map(h => ({ url: h.url })) };
  const checks = [];
  let seq = 0, closed = false;
  function spawn(i) {
    const w = new Worker(path.join(__dirname, 'sim-worker.js'), { workerData: { gameFile } });
    const slot = { w, busy: null, ready: false, i };
    w.on('message', m => {
      if (m && m.ready !== undefined && m.id === undefined) {
        slot.ready = !!m.ready; if (slot.ready) { stats.ready++; stats.buildVersion = m.buildVersion; pump(); }
        else console.error('⚠ battle worker ' + i + ' failed to load: ' + m.error);
        return;
      }
      const job = pending.get(m.id); if (!job) return;
      pending.delete(m.id); clearTimeout(job.timer); slot.busy = null;
      if (m.error) { stats.errors++; job.reject(new Error(m.error)); } else { stats.runs++; job.resolve(m.result); }
      pump();
    });
    w.on('error', e => { console.error('⚠ battle worker ' + i + ' error: ' + e.message); });
    w.on('exit', code => {
      if (slot.ready) stats.ready--;
      slot.ready = false;
      if (slot.busy) { const job = pending.get(slot.busy); if (job) { pending.delete(slot.busy); clearTimeout(job.timer); job.reject(new Error('battle worker exited')); } slot.busy = null; }
      if (!closed) setTimeout(() => { workers[i] = spawn(i); }, 1000);   // a crashed worker is replaced
    });
    return slot;
  }
  for (let i = 0; i < size; i++) workers.push(spawn(i));
  function pump() {
    while (waiting.length) {
      const slot = workers.find(s => s.ready && !s.busy); if (!slot) return;
      const job = waiting.shift(); slot.busy = job.id; pending.set(job.id, job);
      job.timer = setTimeout(() => { if (pending.has(job.id)) { pending.delete(job.id); stats.timeouts++; job.reject(new Error('battle worker timeout'));
        slot.busy = null; try { slot.w.terminate(); } catch (e) {} } }, timeoutMs);
      slot.w.postMessage({ id: job.id, method: job.method, args: job.args });
    }
  }
  // helpers: health every 5 s; "ok" = same engine, not busy, ready
  async function poll(h) {
    if (h.disabled || closed) return;
    try { const r = await fetch(h.url + '/health', { signal: AbortSignal.timeout(1500) }); const j = await r.json();
      h.ok = j.fp === opts.fp && !j.busy && j.ready > 0; h.why = j.fp !== opts.fp ? 'other build' : j.busy ? 'busy' : j.ready > 0 ? '' : 'loading'; }
    catch (e) { h.ok = false; h.why = 'unreachable'; }
    const v = stats.helper.helpers.find(x => x.url === h.url); if (v) { v.ok = h.ok; v.why = h.disabled ? 'disabled' : h.why; }
  }
  if (helpers.length) { const t = setInterval(() => helpers.forEach(poll), 5000); if (t.unref) t.unref(); helpers.forEach(poll); }
  async function remote(h, method, args) {
    stats.helper.sent++;
    const r = await fetch(h.url + '/battle', { method: 'POST', headers: { 'content-type': 'application/json', 'x-helper-key': h.key },
      body: JSON.stringify({ fp: opts.fp, method, args }), signal: AbortSignal.timeout(helperTimeoutMs) });
    if (r.status !== 200) { h.ok = false; h.why = r.status === 409 ? 'other build' : r.status === 401 ? 'key refused' : 'busy'; throw new Error('helper ' + r.status); }
    const j = await r.json(); stats.helper.done++;
    if (stats.helper.done % checkEvery === 0 && checks.length < 50) checks.push({ h, method, args, want: JSON.stringify(j.result) });
    return j.result;
  }
  function spotCheck() {   // only when this pool has nothing waiting: never slows a player's battle
    if (!checks.length || waiting.length || workers.some(s => s.busy)) return;
    const c = checks.shift();
    local(c.method, c.args).then(r => { stats.helper.checked++;
      if (JSON.stringify(r) !== c.want) { stats.helper.mismatches++; c.h.disabled = true; c.h.ok = false; console.error('⚠ battle helper ' + c.h.url + ' gave a different result - not used again'); } }, () => {});
  }
  if (helpers.length) { const t = setInterval(spotCheck, 1000); if (t.unref) t.unref(); }
  function run(method, args) {
    const h = helpers.find(x => x.ok && !x.disabled);
    if (h && (waiting.length >= stressQueue || !stats.ready))
      return remote(h, method, args).catch(() => { stats.helper.fellBack++; return local(method, args); });
    return local(method, args);
  }
  function local(method, args) {
    if (closed || !stats.ready) return Promise.reject(new Error('battle workers not ready'));
    if (waiting.length >= queueMax) { stats.rejectedFull++; return Promise.reject(new Error('battle queue full')); }
    return new Promise((resolve, reject) => { waiting.push({ id: ++seq, method, args, resolve, reject }); pump(); });
  }
  function close() { closed = true; for (const s of workers) { try { s.w.terminate(); } catch (e) {} } }
  return { run, close, stats, get queued() { return waiting.length; } };
}
module.exports = { create };
