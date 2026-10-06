'use strict';
/* v1036 (Phil 5 Oct 2026, "use both cores?" / "do it all"): a small pool of battle workers (server/sim-worker.js), one per spare
   core. run(method, args) resolves with the worker's result, or rejects (not ready, busy past the queue cap, timeout, worker
   error) - callers then fight on the main thread exactly as before, so the pool can only make a battle cheaper, never different. */
const { Worker } = require('worker_threads');
const os = require('os'), path = require('path');

function create(gameFile, opts = {}) {
  const size = Math.max(1, Math.min(opts.size || (os.cpus().length - 1) || 1, 4));
  const timeoutMs = opts.timeoutMs || 15000, queueMax = opts.queueMax || 400;
  const workers = [], waiting = [], pending = new Map();
  const stats = { size, ready: 0, runs: 0, errors: 0, timeouts: 0, rejectedFull: 0, buildVersion: null };
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
  function run(method, args) {
    if (closed || !stats.ready) return Promise.reject(new Error('battle workers not ready'));
    if (waiting.length >= queueMax) { stats.rejectedFull++; return Promise.reject(new Error('battle queue full')); }
    return new Promise((resolve, reject) => { waiting.push({ id: ++seq, method, args, resolve, reject }); pump(); });
  }
  function close() { closed = true; for (const s of workers) { try { s.w.terminate(); } catch (e) {} } }
  return { run, close, stats, get queued() { return waiting.length; } };
}
module.exports = { create };
