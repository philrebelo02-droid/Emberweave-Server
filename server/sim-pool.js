'use strict';
/* v1036 (Phil 5 Oct 2026, "use both cores?" / "do it all"): a small pool of battle workers (server/sim-worker.js), one per spare
   core. run(method, args) resolves with the worker's result, or rejects (not ready, busy past the queue cap, timeout, worker
   error) - callers then fight on the main thread exactly as before, so the pool can only make a battle cheaper, never different.

   v1039 BATTLE HELPERS (Phil 6 Oct 2026: "When the server is stressing - high war time - my computer comes to support it if its
   not busy"). Helpers are server/sim-helper.js on other machines; opts.fp = this server's engine fingerprint. Under stress (below)
   a battle goes to a helper that last reported the same engine, ready and free. Any refusal (busy 503, other build 409, key 401),
   error or `helperTimeoutMs` tries the next helper, then runs it here, so a helper can only make a battle sooner, never different
   or missing. Every `checkEvery`-th helper result is fought again here when this pool is idle; a different result stops that
   helper for good (logged, counted in stats.helper).

   v1041 THE CLUSTER HELPS ITSELF (Phil 6 Oct 2026: "First the server will reach for main and node1-3. If the strained server still
   needs help my cpu will kick in. A strained server will never offer help to another strained server."):
   - helpers come from opts.helpers [{url, key, tier}] and/or opts.helpersFile (JSON [{url, tier}], re-read every 5 s - the release
     phase switch rewrites it, no restart); tier 1 = the cluster's machines, tier 2 = Phil's PC. A battle goes to the tier-1 helper
     with the most free room; only when no tier-1 helper can take it does a tier-2 helper get it;
   - every request names this server (opts.self) so a dedicated helper serves only the servers it is assigned to;
   - strained() tells the server's own helper (via /internal/strain) that this server is strained, so it offers no help. */
const { Worker } = require('worker_threads');
const os = require('os'), path = require('path'), fs = require('fs');

function create(gameFile, opts = {}) {
  const size = Math.max(1, Math.min(opts.size || (os.cpus().length - 1) || 1, opts.maxSize || 4));   // v1040: a helper machine may run more
  const timeoutMs = opts.timeoutMs || 15000, queueMax = opts.queueMax || 400;
  const workers = [], waiting = [], pending = new Map();
  const stats = { size, ready: 0, runs: 0, errors: 0, timeouts: 0, rejectedFull: 0, buildVersion: null };
  const helperMode = !!((opts.helpers && opts.helpers.length) || opts.helpersFile);
  const helpers = [];   // {url, key, tier, ok, why, disabled, limit, mine}
  function setHelpers(list) {
    const want = (list || []).filter(h => h && h.url).map(h => ({ url: String(h.url).replace(/\/$/, ''), key: h.key || opts.key, tier: +h.tier || 1 }));
    for (let i = helpers.length - 1; i >= 0; i--) if (!want.some(w => w.url === helpers[i].url)) helpers.splice(i, 1);
    for (const w of want) { const h = helpers.find(x => x.url === w.url);
      if (h) { h.tier = w.tier; h.key = w.key; } else helpers.push({ ...w, ok: false, why: 'not checked', disabled: false, limit: 0, mine: 0 }); }
    if (stats.helper) stats.helper.helpers = helpers.map(h => ({ url: h.url, tier: h.tier, ok: h.ok, why: h.why }));
  }
  function readFile() { if (!opts.helpersFile) return; try { setHelpers([...(opts.helpers || []), ...JSON.parse(fs.readFileSync(opts.helpersFile, 'utf8'))]); } catch (e) { setHelpers(opts.helpers || []); } }
  const stressQueue = opts.stressQueue || size, helperTimeoutMs = opts.helperTimeoutMs || 4000, checkEvery = opts.checkEvery || 25;
  if (helperMode) stats.helper = { sent: 0, done: 0, fellBack: 0, nextHelper: 0, checked: 0, mismatches: 0, byTier: {}, helpers: [] };
  setHelpers(opts.helpers || []); readFile();
  const checks = [];
  // main-thread lag, sampled every second: stressed while the mean lag of the last second is above stressLagMs (default 25 ms),
  // and for stressHoldMs (10 s) after, so a war rush does not flap between helper and local
  const stressLagMs = opts.stressLagMs || 25, stressHoldMs = opts.stressHoldMs || 10000; let stressUntil = 0, eld = null, lastLag = 0;
  const lagWindow = [];   // v1043: the last 5 one-second lag readings
  if (helperMode || opts.trackStrain) { try { eld = require('perf_hooks').monitorEventLoopDelay({ resolution: 10 }); eld.enable();
    const t = setInterval(() => { lastLag = eld.mean / 1e6; if (lastLag > stressLagMs) stressUntil = Date.now() + stressHoldMs; if (stats.helper) stats.helper.lagMs = +lastLag.toFixed(1);
      lagWindow.push(lastLag); if (lagWindow.length > 5) lagWindow.shift(); eld.reset(); }, 1000);
    if (t.unref) t.unref(); } catch (e) { eld = null; } }
  const stressed = () => Date.now() < stressUntil;
  /* v1040 MAJOR WAR (Phil 6 Oct 2026: "if there is major war going on, like world tree day, my computer gives a little more than low
     priority help"): opts.warLevel() names a scheduled one (the server passes World Tree day); a strain that has lasted
     majorAfterMs (60 s) without a break counts too. Every helper poll and battle carries war=major; the helper steps up. */
  const majorAfterMs = opts.majorAfterMs || 60000; let strainSince = 0;
  if (helperMode) { const t = setInterval(() => { strainSince = stressed() ? (strainSince || Date.now()) : 0; }, 1000); if (t.unref) t.unref(); }
  const major = () => { let w = null; try { w = typeof opts.warLevel === 'function' ? opts.warLevel() : null; } catch (e) {}
    return w === 'major' || (strainSince > 0 && Date.now() - strainSince >= majorAfterMs); };
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
  // helpers: health every 5 s; "ok" = same engine, serves this server, not busy, ready
  const selfQ = opts.self ? 'from=' + encodeURIComponent(opts.self) : '';
  async function poll(h) {
    if (h.disabled || closed) return;
    try { const m = major(); if (stats.helper) stats.helper.major = m;
      const q = [selfQ, m ? 'war=major' : ''].filter(Boolean).join('&');
      const r = await fetch(h.url + '/health' + (q ? '?' + q : ''), { signal: AbortSignal.timeout(1500) }); const j = await r.json();
      const serves = !j.serves || j.serves === 'any' || (Array.isArray(j.serves) && opts.self && j.serves.map(String).includes(String(opts.self)));
      h.limit = +j.limit || 1;
      h.ok = j.fp === opts.fp && serves && !j.busy && j.ready > 0;
      h.why = j.fp !== opts.fp ? 'other build' : !serves ? 'serves others' : j.busy ? 'busy' : j.ready > 0 ? '' : 'loading'; }
    catch (e) { h.ok = false; h.why = 'unreachable'; }
    if (stats.helper) stats.helper.helpers = helpers.map(x => ({ url: x.url, tier: x.tier, ok: x.ok, why: x.disabled ? 'disabled' : x.why }));
  }
  if (helperMode) { const t = setInterval(() => { readFile(); helpers.forEach(poll); }, 5000); if (t.unref) t.unref(); helpers.forEach(poll); }
  // the free helper for the next battle: the lowest tier that has room, then the most free room in it (room = its limit minus the
  // battles this server has in flight there)
  function pick(skip) {
    let best = null;
    for (const h of helpers) { if (!h.ok || h.disabled || skip.has(h)) continue; const free = h.limit - h.mine; if (free <= 0) continue;
      if (!best || h.tier < best.h.tier || (h.tier === best.h.tier && free > best.free)) best = { h, free }; }
    return best && best.h;
  }
  async function remote(h, method, args) {
    stats.helper.sent++; h.mine++;
    try {
      const r = await fetch(h.url + '/battle', { method: 'POST', headers: { 'content-type': 'application/json', 'x-helper-key': h.key },
        body: JSON.stringify({ fp: opts.fp, method, args, from: opts.self || undefined, war: major() ? 'major' : undefined }), signal: AbortSignal.timeout(helperTimeoutMs) });
      if (r.status !== 200) { h.ok = false; h.why = r.status === 409 ? 'other build' : r.status === 401 ? 'key refused' : 'busy'; throw new Error('helper ' + r.status); }
      const j = await r.json(); stats.helper.done++; stats.helper.byTier[h.tier] = (stats.helper.byTier[h.tier] || 0) + 1;
      if (stats.helper.done % checkEvery === 0 && checks.length < 50) checks.push({ h, method, args, want: JSON.stringify(j.result) });
      return j.result;
    } finally { h.mine--; }
  }
  function spotCheck() {   // only when this pool has nothing waiting: never slows a player's battle
    if (!checks.length || waiting.length || workers.some(s => s.busy)) return;
    const c = checks.shift();
    local(c.method, c.args).then(r => { stats.helper.checked++;
      if (JSON.stringify(r) !== c.want) { stats.helper.mismatches++; c.h.disabled = true; c.h.ok = false; console.error('⚠ battle helper ' + c.h.url + ' gave a different result - not used again'); } }, () => {});
  }
  if (helperMode) { const t = setInterval(spotCheck, 1000); if (t.unref) t.unref(); }
  function run(method, args) {
    // STRESS ("high war time") = the main thread is running late (event-loop lag), or every local worker is fighting, or a queue
    // formed. Then EVERY battle goes to a helper: that frees this machine's cores for the main thread, which cannot move (measured
    // 6 Oct: on an i5-650 the battle workers and the main thread compete for the same 2 physical cores).
    if (helperMode && helpers.length && (stressed() || waiting.length >= stressQueue || !stats.ready || !workers.some(s => s.ready && !s.busy))) {
      const tried = new Set();
      const attempt = () => { const h = pick(tried); if (!h) { stats.helper.fellBack++; return local(method, args); }
        tried.add(h); return remote(h, method, args).catch(() => { stats.helper.nextHelper++; return attempt(); }); };
      return attempt();
    }
    return local(method, args);
  }
  function local(method, args) {
    if (closed || !stats.ready) return Promise.reject(new Error('battle workers not ready'));
    if (waiting.length >= queueMax) { stats.rejectedFull++; return Promise.reject(new Error('battle queue full')); }
    return new Promise((resolve, reject) => { waiting.push({ id: ++seq, method, args, resolve, reject }); pump(); });
  }
  function close() { closed = true; for (const s of workers) { try { s.w.terminate(); } catch (e) {} } }
  /* v1043: STRAINED (what this server's own helper is told - "a strained server never offers help") = running late in at least 3 of the
     last 5 seconds, or battles queuing here. One slow second (a full save) is not strain: it used to lock a quiet server's helper out for
     10 s (measured 6 Oct: 20 of 75 samples on a server whose own CPU use had a median of 7%). stressed() - when THIS server hands its
     battles to helpers - stays as sensitive as before. */
  const sustained = () => lagWindow.filter(x => x > stressLagMs).length >= 3;
  return { run, close, stats, strained: () => sustained() || waiting.length >= stressQueue, lagMs: () => lastLag, get queued() { return waiting.length; } };
}
module.exports = { create };
