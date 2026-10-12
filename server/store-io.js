'use strict';
/* v1128 SAVE I/O OFF THE MAIN THREAD (S1 copy run 12 Oct 2026: player-shard saves were 40-45% of the main thread, written with
   writeFileSync / renameSync / unlinkSync; with the SSD shared by the sims container one save blocked the whole server 7.5-8.1 s
   and unlink alone was 34% of the main thread in the war).

   One dedicated worker thread owns every file operation of a world save. The main thread still decides WHAT to write (it
   stringifies the changed units - the bytes are fixed at that moment, so later changes cannot leak into a save) and hands the job
   over; the worker writes the files, writes the manifest temp file and renames it over the world file - the same temp + rename
   commit as before, in the same order, so a crash at any point still leaves the previous manifest naming only complete files.
   The reply of every action in the save is held until the worker reports the rename done.

   Jobs run strictly in the order they were submitted (one FIFO, one thread). A job that fails removes the files it created and
   POISONS every job submitted after it until the main thread has seen the failure (a later save's manifest may name a file of the
   failed one): those fail too, the store's onFailure runs once, and the next save rewrites the world in full.

   Superseded files are unlinked lazily, in batches, when the queue is idle (a crash leaves them as orphans the boot sweep removes,
   exactly as a crash between a rename and its unlinks always did).

   A synchronous save (boot, exit, timers outside a request) submits its job and waits for it with Atomics.wait - every job before
   it is on disk first, so the order of commits never changes.

   DB_STORE_IO=sync keeps every file operation on the main thread (the v1127 behaviour). */
const fs = require('fs'), path = require('path');
const wt = require('worker_threads');

/* one job: ops run in order; on failure every file the job created is removed */
function runOps(ops, ctx) {
  const created = [];
  try {
    for (const op of ops) {
      if (op.j !== undefined) { runJournal(op, ctx); continue; }   // v1128: the journal layout's engine (server/store-journal.js)
      if (op.w !== undefined) { fs.writeFileSync(op.w, op.s); created.push(op.w); }
      else if (op.a !== undefined) fs.appendFileSync(op.a, op.s);
      else if (op.r !== undefined) { fs.renameSync(op.r, op.to); const i = created.indexOf(op.r); if (i >= 0) created.splice(i, 1); }
      else if (op.mk !== undefined) fs.mkdirSync(op.mk, { recursive: true });
      else if (op.u !== undefined) { try { fs.unlinkSync(op.u); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
      else if (op.sweep !== undefined) {   // remove every file matching rx that keep does not name (orphans after a failed save)
        const keep = new Set(op.keep), rx = new RegExp(op.rx); let files = []; try { files = fs.readdirSync(op.sweep); } catch (e) {}
        for (const f of files) if (rx.test(f) && !keep.has(f)) { try { fs.unlinkSync(path.join(op.sweep, f)); } catch (e) {} }
      }
    }
    return null;
  } catch (e) {
    for (const f of created) { try { fs.unlinkSync(f); } catch (e2) {} }
    return e;
  }
}

/* journal ops: {j:'init', m, cfg} | {j:'rec', units, pieces, core} | {j:'full', shards, pieces, core}. ctx.engine is this thread's engine. */
function runJournal(op, ctx) {
  if (op.j === 'init') { ctx.engine = require('./store-journal.js').createEngine(Object.assign({}, op.cfg, { shardOf: id => require('./store-journal.js').shardOfN(id, op.cfg.shards) })); ctx.engine.init(op.m); return; }
  if (!ctx.engine) { const e = Error('world store: journal engine not started'); e.code = 'EJOURNAL'; throw e; }
  if (op.j === 'rec') ctx.engine.record(op.units, op.receipts, op.pieces, op.core);
  else if (op.j === 'full') ctx.engine.full(op.shards, op.pieces, op.core, op.sweep);
  if (ctx.sync) { if (ctx.engine.due()) ctx.engine.settle(); else ctx.engine.unlinkSome(1 << 30); }   // DB_STORE_IO=sync / tools: a due checkpoint runs to its end here
}

if (!wt.isMainThread && wt.workerData && wt.workerData.__storeIo) {
  /* ---------------- the worker ---------------- */
  const { ctl: ctlBuf, port } = wt.workerData; const ctl = new Int32Array(ctlBuf);
  const queue = []; let lazy = [], scheduled = false, poisonedUpTo = -1; const ctx = { engine: null, sync: false };
  const ckptStep = () => { if (ctx.engine && ctx.engine.busy) { try { ctx.engine.step(); } catch (e) { console.error('world store checkpoint: ' + e.message); } } };
  const LAZY_BATCH = 64;
  const kick = () => { if (!scheduled) { scheduled = true; setImmediate(pump); } };
  function pump() {
    scheduled = false;
    while (queue.length) {
      const j = queue.shift(), t0 = Date.now(); let err = null;
      if (j.epoch <= poisonedUpTo) err = { message: 'an earlier save failed', code: 'SAVE_POISONED' };
      else { const e = runOps(j.ops, ctx); if (e) { err = { message: e.message, code: e.code || 'EIO' }; poisonedUpTo = j.epoch; } }
      if (!err && j.lazy) for (const f of j.lazy) lazy.push(f);
      if (j.drain && lazy.length) { for (const f of lazy) { try { fs.unlinkSync(f); } catch (e) {} } Atomics.add(ctl, 1, lazy.length); lazy = []; }   // flush(): superseded files too
      port.postMessage({ seq: j.seq, err, ms: Date.now() - t0, lazy: lazy.length, journal: ctx.engine ? Object.assign({ gen: ctx.engine.gen }, ctx.engine.stats) : undefined });
      Atomics.store(ctl, 0, j.seq); Atomics.notify(ctl, 0);
      ckptStep();   // a checkpoint advances one shard per save even when saves never stop
    }
    if (ctx.engine && (ctx.engine.busy || ctx.engine.lazyCount)) { ckptStep(); Atomics.add(ctl, 1, ctx.engine.unlinkSome(32)); kick(); }
    if (lazy.length) {   // idle: remove superseded files a batch at a time - a new job always goes first
      const batch = lazy.splice(0, lazy.length > 16 * LAZY_BATCH ? 4 * LAZY_BATCH : LAZY_BATCH);
      for (const f of batch) { try { fs.unlinkSync(f); } catch (e) {} }
      Atomics.add(ctl, 1, batch.length);
      kick();
    }
  }
  port.on('message', m => { if (m && m.job) { queue.push(m.job); kick(); } });
} else {
  module.exports = { create, runOps };
}

/* ---------------- the main-thread side ----------------
   create({mode:'worker'|'sync', onFailure}) -> { submit(ops, lazy) -> Promise, submitSync(ops, lazy) (throws), async, pending, stats }
   ops: [{w:path,s:string} | {a:path,s} | {r:tmp,to:path} | {mk:dir} | {u:path} | {sweep:dir,keep:[names],rx:'regex'}]
   lazy: paths to unlink once the job has committed, when the queue is idle */
function create(opts) {
  opts = opts || {};
  const stats = { mode: 'sync', jobs: 0, failed: 0, poisoned: 0, inFlight: 0, maxInFlight: 0, lastMs: 0, maxMs: 0, totalMs: 0, lazyQueued: 0, unlinked: 0,
    syncWaits: 0, syncWaitMs: 0, maxSyncWaitMs: 0, workerErrors: 0 };
  let worker = null, port = null, ctl = null, seq = 0, epoch = 0; const ctx = { engine: null, sync: true };
  const waiting = new Map();   // seq -> {resolve, reject, epoch, sync, err, done}
  const onFailure = opts.onFailure || (() => {}), onWorkerLost = opts.onWorkerLost || (() => {});
  const timeIt = ms => { stats.lastMs = ms; stats.totalMs += ms; if (ms > stats.maxMs) stats.maxMs = ms; };
  function syncRun(ops, lazy) {
    const t0 = Date.now(), e = runOps(ops, ctx); stats.jobs++; timeIt(Date.now() - t0); if (ctx.engine) stats.journal = ctx.engine.stats;
    if (e) { stats.failed++; throw e; }
    if (lazy) for (const f of lazy) { try { fs.unlinkSync(f); stats.unlinked++; } catch (e2) {} }
  }
  function settle(w, e) {
    if (e) { if (e.code === 'SAVE_POISONED') stats.poisoned++; else stats.failed++;
      if (w.epoch === epoch) { epoch++; try { onFailure(e); } catch (e2) { console.error('store io: failure handler: ' + e2.message); } } }   // jobs posted from now on are a new epoch
    w.done = true; w.err = e || null;
    if (w.sync) return;
    if (e) w.reject(e); else w.resolve();
  }
  function handle(m) {
    const w = waiting.get(m.seq); if (!w) return; waiting.delete(m.seq);
    stats.inFlight = waiting.size; timeIt(m.ms); stats.lazyQueued = m.lazy; stats.unlinked = Atomics.load(ctl, 1); if (m.journal) stats.journal = m.journal;
    let e = null; if (m.err) { e = Error('world save: ' + m.err.message); e.code = m.err.code; }
    settle(w, e);
  }
  function failAll(why) {   // the worker is gone: every waiting job failed; later saves run on this thread
    if (worker) { const w = worker; worker = null; stats.mode = 'sync'; stats.workerErrors++; try { w.terminate(); } catch (e) {} try { onWorkerLost(); } catch (e) {} }
    const e = Error('world save: the store io worker stopped (' + why + ')'); e.code = 'EIO';
    const ws = [...waiting.values()]; waiting.clear(); stats.inFlight = 0;
    for (const w of ws) settle(w, e);
  }
  if (opts.mode === 'worker') {
    try {
      const sab = new SharedArrayBuffer(8); ctl = new Int32Array(sab);
      const ch = new wt.MessageChannel(); port = ch.port1;
      worker = new wt.Worker(__filename, { workerData: { __storeIo: true, ctl: sab, port: ch.port2 }, transferList: [ch.port2] });
      worker.unref(); port.unref();
      port.on('message', handle);
      worker.on('error', e => { console.error('store io worker error: ' + (e && e.message)); failAll(e && e.message); });
      worker.on('exit', c => { if (worker) failAll('exit ' + c); });
      stats.mode = 'worker';
    } catch (e) { console.error('store io: no worker (' + e.message + ') - saves stay on the main thread'); worker = null; }
  }
  function post(ops, lazy, rec, drain) {
    const s = ++seq; rec.epoch = epoch; waiting.set(s, rec); stats.jobs++;
    stats.inFlight = waiting.size; if (waiting.size > stats.maxInFlight) stats.maxInFlight = waiting.size;
    port.postMessage({ job: { seq: s, epoch, ops, lazy: lazy || null, drain: !!drain } });
    return s;
  }
  // resolves when the job's last op is done; rejects with the job's (or an earlier job's) failure
  function submit(ops, lazy) {
    if (!worker) { try { syncRun(ops, lazy); return Promise.resolve(); } catch (e) { return Promise.reject(e); } }
    let rec; const p = new Promise((resolve, reject) => { rec = { resolve, reject }; });
    post(ops, lazy, rec); return p;
  }
  // every job submitted before it, then this one, are done when it returns; throws on failure
  function submitSync(ops, lazy, drain) {
    if (!worker) return syncRun(ops, lazy);
    const t0 = Date.now(), rec = { sync: true, done: false, err: null }, s = post(ops, lazy, rec, drain);
    stats.syncWaits++;
    for (let spins = 0; ; spins++) {
      const done = Atomics.load(ctl, 0);
      if (done >= s || !worker) break;
      if (Atomics.wait(ctl, 0, done, 60000) === 'timed-out' && spins > 4) break;   // 5 minutes without an answer: the worker is stuck
    }
    let m; while (worker && (m = wt.receiveMessageOnPort(port))) handle(m.message);   // every result up to ours, in order
    if (!rec.done) failAll('no answer');
    const ms = Date.now() - t0; stats.syncWaitMs += ms; if (ms > stats.maxSyncWaitMs) stats.maxSyncWaitMs = ms;
    if (rec.err) throw rec.err;
  }
  return {
    get async() { return !!worker; }, get pending() { return waiting.size; }, stats,
    submit, submitSync,
    flush() { submitSync([], null, true); },   // wait for every job and remove every superseded file (tests, exit)
    lose(why) { failAll(why || 'stopped by hand'); },   // as if the worker had died (tests): waiting jobs fail, later ones run on this thread
    close() { if (worker) { const w = worker; worker = null; stats.mode = 'sync'; w.terminate(); } },
  };
}
