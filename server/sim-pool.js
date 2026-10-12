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
const ROLES = require('./sim-roles.js');
/* v1127 HELPER ROLES (server/sim-roles.js holds the mode -> role table). Each helper entry may carry role 'live' | 'async' | 'any'
   (default 'any') and reserve (0-1, default 0.25). A battle's role comes from its mode (run(m, args, {mode}) / {role}):
     live  -> helpers with role live/any only; an async helper only when every live/any helper is down (never because live is busy);
              on a live/any helper, live battles leave `reserve` of its slots to async work while async work is waiting;
     async -> async helpers first (any tier), then live/any helpers: up to their reserved share while there was live work in the
              last 2 s, all their free slots when there was none.
   Dispatch is event-driven: onFree(cb) is called when a helper slot frees or a health poll finds a helper ready, and canTake(role)
   says whether a battle of that role would find a slot now - the check backlog waits for that instead of asking over and over. */

function create(gameFile, opts = {}) {
  const size = Math.max(1, Math.min(opts.size || (os.cpus().length - 1) || 1, opts.maxSize || 4));   // v1040: a helper machine may run more
  const timeoutMs = opts.timeoutMs || 15000, queueMax = opts.queueMax || +process.env.SIM_QUEUE_MAX || 200;
  /* v1124 OVERLOAD (load test 11 Oct 2026: at ~1900 players the check queue grew past what it could drain and the server never
     recovered). A battle waiting longer than queueWaitMs is shed (rejected - its caller decides what a missing check means), so the
     queue holds only work that can still help someone; a job past timeoutMs is rejected but its worker is only killed when it is
     still silent at hangMs (a starved worker used to be killed and reloaded - minutes of lost capacity - exactly under overload). */
  const queueWaitMs = opts.queueWaitMs || +process.env.SIM_QUEUE_WAIT_MS || 10000, hangMs = opts.hangMs || 60000;
  const workers = [], waiting = [], pending = new Map();
  const stats = { size, ready: 0, runs: 0, errors: 0, timeouts: 0, rejectedFull: 0, shed: 0, late: 0, hung: 0, buildVersion: null };
  const helperMode = !!((opts.helpers && opts.helpers.length) || opts.helpersFile);
  const helpers = [];   // {url, key, tier, ok, why, disabled, limit, mine}
  function setHelpers(list) {
    const want = (list || []).filter(h => h && h.url).map(h => ({ url: String(h.url).replace(/\/$/, ''), key: h.key || opts.key, tier: +h.tier || 1,
      duty: ROLES.helperRole(h.role), reserve: Number.isFinite(+h.reserve) && h.reserve !== null && h.reserve !== '' ? Math.max(0, Math.min(1, +h.reserve)) : ROLES.DEFAULT_RESERVE }));   // v1127: duty = the configured role
    for (let i = helpers.length - 1; i >= 0; i--) if (!want.some(w => w.url === helpers[i].url)) helpers.splice(i, 1);
    for (const w of want) { const h = helpers.find(x => x.url === w.url);
      if (h) { h.tier = w.tier; h.key = w.key; h.duty = w.duty; h.reserve = w.reserve; } else helpers.push({ ...w, ok: false, why: 'not checked', disabled: false, limit: 0, mine: 0, live: 0, async: 0, backoffUntil: 0,
        n: { sent: 0, done: 0, busy: 0, errors: 0, ms: 0, maxMine: 0 }, cpu: null, mode: null, role: null, theirInFlight: null }); }
    helperView();
  }
  /* v1124 per-helper numbers (capacity run 11 Oct 2026: ~22 checks/s across all helpers - which one is the limit?): what this
     server sent, finished, was refused (busy) and its mean battle time, and from the helper's /health its limit, its own in-flight
     count, mode, role and the CPU the rest of its machine uses. */
  function helperView() { if (!stats.helper) return;
    stats.helper.helpers = helpers.map(h => ({ url: h.url, tier: h.tier, duty: h.duty, reserve: h.reserve, ok: h.ok, why: h.disabled ? 'disabled' : h.why, limit: h.limit, mine: h.mine, live: h.live, async: h.async,
      maxMine: h.n ? h.n.maxMine : 0, sent: h.n ? h.n.sent : 0, done: h.n ? h.n.done : 0, busy: h.n ? h.n.busy : 0, errors: h.n ? h.n.errors : 0,
      avgMs: h.n && h.n.done ? Math.round(h.n.ms / h.n.done) : null, otherCpu: h.cpu, theirInFlight: h.theirInFlight, mode: h.mode, role: h.role })); }
  function readFile() { if (!opts.helpersFile) return; try { setHelpers([...(opts.helpers || []), ...JSON.parse(fs.readFileSync(opts.helpersFile, 'utf8'))]); } catch (e) { setHelpers(opts.helpers || []); } }
  const stressQueue = opts.stressQueue || size, helperTimeoutMs = opts.helperTimeoutMs || 4000, checkEvery = opts.checkEvery || 25;
  if (helperMode) stats.helper = { sent: 0, done: 0, fellBack: 0, nextHelper: 0, checked: 0, mismatches: 0, byTier: {}, helpers: [],
    byRole: { live: 0, async: 0 }, liveOnAsync: 0, asyncOnLive: 0, wakeups: 0, noHelper: 0 };   // v1127
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
        else console.error('battle worker ' + i + ' failed to load: ' + m.error);
        return;
      }
      const job = pending.get(m.id);
      if (!job) { if (slot.busy === m.id) { slot.busy = null; clearTimeout(slot.hang); stats.late++; pump(); } return; }   // v1124: a timed-out job finally answered - the worker is free again
      pending.delete(m.id); clearTimeout(job.timer); clearTimeout(slot.hang); slot.busy = null;
      if (m.error) { stats.errors++; job.reject(new Error(m.error)); } else { stats.runs++; job.resolve(m.result); }
      pump();
    });
    w.on('error', e => { console.error('battle worker ' + i + ' error: ' + e.message); });
    w.on('exit', code => {
      if (slot.ready) stats.ready--;
      slot.ready = false;
      if (slot.busy) { const job = pending.get(slot.busy); if (job) { pending.delete(slot.busy); clearTimeout(job.timer); job.reject(new Error('battle worker exited')); } slot.busy = null; }
      if (!closed) setTimeout(() => { workers[i] = spawn(i); }, 1000);   // a crashed worker is replaced
    });
    return slot;
  }
  for (let i = 0; i < size; i++) workers.push(spawn(i));
  function shedOld() {   // v1124: drop battles that waited past queueWaitMs
    const now = Date.now();
    while (waiting.length && now - waiting[0].at > queueWaitMs) { const job = waiting.shift(); stats.shed++; job.reject(new Error('battle queue timeout')); }
  }
  { const t = setInterval(shedOld, 1000); if (t.unref) t.unref(); }
  function pump() {
    shedOld();
    while (waiting.length) {
      const slot = workers.find(s => s.ready && !s.busy); if (!slot) return;
      const job = waiting.shift(); slot.busy = job.id; pending.set(job.id, job);
      job.timer = setTimeout(() => { if (pending.has(job.id)) { pending.delete(job.id); stats.timeouts++; job.reject(new Error('battle worker timeout'));
        slot.hang = setTimeout(() => { if (slot.busy === job.id) { stats.hung++; slot.busy = null; try { slot.w.terminate(); } catch (e) {} } }, hangMs); } }, timeoutMs);
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
      h.limit = +j.limit || 1; h.cpu = typeof j.others === 'number' ? j.others : null; h.theirInFlight = typeof j.inFlight === 'number' ? j.inFlight : null; h.mode = j.mode || null; h.role = j.role || null;
      const slotsFull = !!j.busy && !j.homeStrained && typeof j.inFlight === 'number' && j.inFlight >= h.limit;   // v1124: busy only because its slots are full
      h.ok = j.fp === opts.fp && serves && (!j.busy || slotsFull) && j.ready > 0;   // a full helper stays in the list (its 503 is a short backoff); a busy MACHINE is left alone
      h.why = j.fp !== opts.fp ? 'other build' : !serves ? 'serves others' : j.busy ? 'busy' : j.ready > 0 ? '' : 'loading'; }
    catch (e) { h.ok = false; h.why = 'unreachable'; }
    helperView(); if (h.ok) freed();
  }
  // v1127 event-driven dispatch: whoever waits for a helper slot is woken when one frees (at most once per tick)
  const freeListeners = []; let freeQueued = false;
  function freed() { if (freeQueued || !freeListeners.length) return; freeQueued = true;
    setImmediate(() => { freeQueued = false; if (stats.helper) stats.helper.wakeups++; for (const f of freeListeners.slice()) { try { f(); } catch (e) {} } }); }
  let lastLiveAt = 0;
  const asyncWaiting = () => { try { return typeof opts.asyncWaiting === 'function' ? +opts.asyncWaiting() || 0 : 0; } catch (e) { return 0; } };
  /* Phil's layout (11 Oct 2026): the reserve holds while async work waits; when the backlog would take more than leanAfterMin minutes
     to drain (opts.asyncDrainMinutes), the flex machines (role 'any', e.g. Phil's PC) lean async - half their slots. */
  const leanAsync = () => { try { return typeof opts.asyncDrainMinutes === 'function' && +opts.asyncDrainMinutes() > (opts.leanAfterMin || +process.env.SIM_LEAN_AFTER_MIN || 5); } catch (e) { return false; } };
  const reserved = h => Math.ceil((h.limit || 1) * (h.duty === 'any' && leanAsync() ? Math.max(h.reserve || 0, 0.5) : (h.reserve || 0)));
  // the slots a battle of this role may use on this helper now
  function roomFor(h, role) {
    const limit = h.limit || 1, free = limit - h.mine; if (free <= 0) return 0;
    if (role === 'live') { if (h.duty === 'async') return free;   // only reached when every live helper is down (pick)
      const cap = limit - (asyncWaiting() > 0 ? Math.max(0, reserved(h) - h.async) : 0); return Math.max(0, Math.min(free, cap - h.live)); }
    if (h.duty === 'async') return free;
    const cap = Date.now() - lastLiveAt < 2000 ? reserved(h) : limit; return Math.max(0, Math.min(free, cap - h.async)); }
  if (helperMode) { const t = setInterval(() => { readFile(); helpers.forEach(poll); }, 5000); if (t.unref) t.unref(); helpers.forEach(poll); }
  // the free helper for the next battle: the lowest tier that has room, then the most free room in it (room = its limit minus the
  // battles this server has in flight there)
  function pick(skip, role) {
    role = role === 'live' ? 'live' : 'async';
    let best = null;
    const now = Date.now(), usable = h => h.ok && !h.disabled && !skip.has(h) && now >= (h.backoffUntil || 0);
    // live: the live/any helpers; the async ones only when every live/any helper is down. async: the async helpers first.
    const liveUp = helpers.some(h => h.ok && !h.disabled && h.duty !== 'async');
    const rank = h => role === 'live' ? (h.duty === 'async' ? (liveUp ? -1 : 1) : 0) : (h.duty === 'async' ? 0 : 1);
    for (const h of helpers) { if (!usable(h)) continue; const r = rank(h); if (r < 0) continue; const free = roomFor(h, role); if (free <= 0) continue;
      if (!best || r < best.r || (r === best.r && (h.tier < best.h.tier || (h.tier === best.h.tier && free > best.free)))) best = { h, free, r }; }
    return best && best.h;
  }
  async function remote(h, method, args, role) {
    role = role === 'live' ? 'live' : 'async'; h[role]++; stats.helper.byRole[role]++;
    if (role === 'live' && h.duty === 'async') stats.helper.liveOnAsync++; if (role === 'async' && h.duty !== 'async') stats.helper.asyncOnLive++;
    stats.helper.sent++; h.mine++; const t0 = Date.now(); if (h.n) { h.n.sent++; if (h.mine > h.n.maxMine) h.n.maxMine = h.mine; }
    try {
      const r = await fetch(h.url + '/battle', { method: 'POST', headers: { 'content-type': 'application/json', 'x-helper-key': h.key },
        body: JSON.stringify({ fp: opts.fp, method, args, from: opts.self || undefined, war: major() ? 'major' : undefined }), signal: AbortSignal.timeout(helperTimeoutMs) });
      if (r.status !== 200) {
        if (r.status === 409 || r.status === 401) { h.ok = false; h.why = r.status === 409 ? 'other build' : 'key refused'; }
        else { h.why = 'busy'; h.backoffUntil = Date.now() + 750; if (h.n) h.n.busy++; }   // v1124: busy = try it again in a moment (was: out until the next 5 s poll)
        throw new Error('helper ' + r.status); }
      const j = await r.json(); stats.helper.done++; stats.helper.byTier[h.tier] = (stats.helper.byTier[h.tier] || 0) + 1;
      if (h.n) { h.n.done++; h.n.ms += Date.now() - t0; }
      if (stats.helper.done % checkEvery === 0 && checks.length < 50) checks.push({ h, method, args, want: JSON.stringify(j.result) });
      return j.result;
    } catch (e) { if (h.n && !/^helper (409|401|503)/.test(e.message)) h.n.errors++; throw e; }
    finally { h.mine--; h[role]--; helperView(); freed(); }
  }
  function spotCheck() {   // only when this pool has nothing waiting: never slows a player's battle
    if (!checks.length || waiting.length || workers.some(s => s.busy)) return;
    const c = checks.shift();
    local(c.method, c.args).then(r => { stats.helper.checked++;
      if (JSON.stringify(r) !== c.want) { stats.helper.mismatches++; c.h.disabled = true; c.h.ok = false; console.error('battle helper ' + c.h.url + ' gave a different result - not used again'); } }, () => {});
  }
  if (helperMode) { const t = setInterval(spotCheck, 1000); if (t.unref) t.unref(); }
  /* v1124 (Phil: "the helpers are there specifically to carry the fight checks, so Server 1 does none itself"): a fight CHECK goes
     to a helper; with no helper free it is refused (the server's backlog keeps it and asks again) - it runs on this machine's workers
     only when no helper is configured at all, or SIM_CHECKS_LOCAL=1. checkCapacity() = the checks worth keeping in flight. */
  const checksLocal = opts.checksLocal !== undefined ? !!opts.checksLocal : process.env.SIM_CHECKS_LOCAL === '1';
  function checkCapacity(role) { role = role === 'live' ? 'live' : 'async';   // v1127: the slots this role may use (async: the nodes + the fast helpers' share)
    const hs = helpers.filter(h => h.ok && !h.disabled); const slots = hs.reduce((s, h) => s + (role === 'async' && h.duty !== 'async' ? (Date.now() - lastLiveAt < 2000 ? reserved(h) : (h.limit || 1)) : (h.limit || 1)), 0);
    return helperMode && helpers.length ? Math.max(1, slots + (checksLocal ? stats.ready : 0)) : Math.max(1, stats.ready || size); }
  const canTake = role => !(helperMode && helpers.length) || checksLocal || !!pick(new Set(), role);   // v1127: would a battle of this role find a slot now
  function runCheck(method, args, role) {
    if (!(helperMode && helpers.length)) return local(method, args);
    const tried = new Set();
    const attempt = () => { const h = pick(tried, role); if (!h) { if (checksLocal) return local(method, args); stats.helper.noHelper++; return Promise.reject(new Error('no helper free')); }
      tried.add(h); return remote(h, method, args, role).catch(() => { stats.helper.nextHelper++; return attempt(); }); };
    return attempt();
  }
  function run(method, args, o) {
    const role = (o && o.role) || ROLES.roleOf(o && o.mode);   // v1127: unknown or no mode = async
    if (role === 'live') lastLiveAt = Date.now();
    if (o && o.check) return runCheck(method, args, role);
    // STRESS ("high war time") = the main thread is running late (event-loop lag), or every local worker is fighting, or a queue
    // formed. Then EVERY battle goes to a helper: that frees this machine's cores for the main thread, which cannot move (measured
    // 6 Oct: on an i5-650 the battle workers and the main thread compete for the same 2 physical cores).
    if (helperMode && helpers.length && (stressed() || waiting.length >= stressQueue || !stats.ready || !workers.some(s => s.ready && !s.busy))) {
      const tried = new Set();
      const attempt = () => { const h = pick(tried, role); if (!h) { stats.helper.fellBack++; return local(method, args); }
        tried.add(h); return remote(h, method, args, role).catch(() => { stats.helper.nextHelper++; return attempt(); }); };
      return attempt();
    }
    return local(method, args);
  }
  /* v1129 LIVE BATTLES ON THE LIVE HELPERS (Phil: World Tree is "the server's largest pvp event"; World Tree and Skyfall are
     "fast machines" work). runLive(method, args, {mode}) never fights on this server's main thread and, when helpers are
     configured, never on this server's own workers either: a live helper (role live/any; an async node only when every live
     helper is down - pick()) or nothing.
     - With no live slot free the battle WAITS in one FIFO queue, bounded in length (liveQueueMax, SIM_LIVE_QUEUE_MAX, default
       4 x the live slots, at least 32) and in time (liveWaitMs, SIM_LIVE_WAIT_MS, 3 s). A battle past either bound is refused
       ('battle servers busy', err.busy) - the server answers busy / retry and the client sends the same request again later.
     - Fair: the oldest waiting battle takes the next free slot (a slot freed, a helper back up, a backoff over); a battle a
       helper refused (503 / error) goes back to the FRONT, not the back. Nothing jumps the queue: a new battle starts directly
       only when nobody is waiting.
     - No helper configured at all (one machine, a dev box): the same queue feeds this server's battle WORKERS (still not the
       main thread). SIM_LIVE_LOCAL=1 also lets the workers take live battles while every configured helper is down. */
  const liveWaitMs = opts.liveWaitMs || +process.env.SIM_LIVE_WAIT_MS || 3000;
  const liveLocalWhenDown = opts.liveLocalWhenDown !== undefined ? !!opts.liveLocalWhenDown : process.env.SIM_LIVE_LOCAL === '1';
  const liveQ = []; let liveTimer = null;
  stats.live = { asked: 0, started: 0, done: 0, failed: 0, queued: 0, maxQueued: 0, refusedFull: 0, timedOut: 0, requeued: 0, onHelper: 0, onWorkers: 0, waitMsMax: 0, cap: 0 };
  const liveHelpers = () => helperMode && helpers.length > 0;
  const liveSlots = () => helpers.filter(h => h.ok && !h.disabled && h.duty !== 'async').reduce((s, h) => s + (h.limit || 1), 0);
  const liveCap = () => { const c = opts.liveQueueMax || +process.env.SIM_LIVE_QUEUE_MAX || Math.max(32, 4 * (liveHelpers() ? liveSlots() : size)); stats.live.cap = c; return c; };
  const busyErr = why => { const e = new Error('battle servers busy (' + why + ')'); e.busy = true; return e; };
  const anyHelperUp = () => helpers.some(h => h.ok && !h.disabled);
  function liveStart(job) {   // start the job now if a slot is free; false = it must wait
    if (closed) return false;
    if (liveHelpers() && !(liveLocalWhenDown && !anyHelperUp())) {
      const h = pick(job.tried, 'live'); if (!h) return false;
      job.tried.add(h); stats.live.started++; stats.live.onHelper++;
      remote(h, job.method, job.args, 'live').then(r => { stats.live.done++; job.resolve(r); }, e => {
        stats.helper.nextHelper++;
        if (/^helper 503/.test(e.message)) job.tried.delete(h);   // busy is a moment (its backoff), not a refusal of this battle
        if (Date.now() - job.at > liveWaitMs) { stats.live.failed++; return job.reject(busyErr('helpers refused')); }
        stats.live.requeued++; liveQ.unshift(job); liveDrain(); });
      return true;
    }
    if (!stats.ready || waiting.length || !workers.some(s => s.ready && !s.busy)) return false;
    stats.live.started++; stats.live.onWorkers++;
    local(job.method, job.args).then(r => { stats.live.done++; job.resolve(r); liveDrain(); }, e => { stats.live.failed++; job.reject(e); liveDrain(); });
    return true;
  }
  function liveDrain() {
    const now = Date.now();
    while (liveQ.length && now - liveQ[0].at > liveWaitMs) { const j = liveQ.shift(); stats.live.timedOut++; j.reject(busyErr('waited ' + liveWaitMs + ' ms')); }
    while (liveQ.length) { const j = liveQ[0]; if (!liveStart(j)) break; liveQ.shift(); if (j.queuedAt) { const w = Date.now() - j.queuedAt; if (w > stats.live.waitMsMax) stats.live.waitMsMax = w; } }
    stats.live.queued = liveQ.length;
    if (liveQ.length && !liveTimer) { liveTimer = setTimeout(() => { liveTimer = null; liveDrain(); }, 100); if (liveTimer.unref) liveTimer.unref(); }   // a backoff ends / a wait expires
  }
  freeListeners.push(liveDrain);   // a helper slot freed or a helper came back: the oldest waiting battle goes first
  function runLive(method, args) {
    stats.live.asked++; lastLiveAt = Date.now();
    return new Promise((resolve, reject) => {
      const job = { method, args, resolve, reject, at: Date.now(), tried: new Set() };
      if (!liveQ.length && liveStart(job)) return;
      if (liveQ.length >= liveCap()) { stats.live.refusedFull++; return reject(busyErr('queue full')); }
      job.queuedAt = Date.now(); liveQ.push(job); if (liveQ.length > stats.live.maxQueued) stats.live.maxQueued = liveQ.length; liveDrain();
    });
  }
  function local(method, args) {
    if (closed || !stats.ready) return Promise.reject(new Error('battle workers not ready'));
    if (waiting.length >= queueMax) { stats.rejectedFull++; return Promise.reject(new Error('battle queue full')); }
    return new Promise((resolve, reject) => { waiting.push({ id: ++seq, method, args, resolve, reject, at: Date.now() }); pump(); });
  }
  function close() { closed = true; for (const j of liveQ.splice(0)) j.reject(busyErr('closed')); for (const s of workers) { try { s.w.terminate(); } catch (e) {} } }
  /* v1043: STRAINED (what this server's own helper is told - "a strained server never offers help") = running late in at least 3 of the
     last 5 seconds, or battles queuing here. One slow second (a full save) is not strain: it used to lock a quiet server's helper out for
     10 s (measured 6 Oct: 20 of 75 samples on a server whose own CPU use had a median of 7%). stressed() - when THIS server hands its
     battles to helpers - stays as sensitive as before. */
  const sustained = () => lagWindow.filter(x => x > stressLagMs).length >= 3;
  return { run, runLive, close, stats, checkCapacity, canTake, onFree: f => { freeListeners.push(f); }, strained: () => sustained() || waiting.length >= stressQueue, lagMs: () => lastLag, get queued() { return waiting.length; } };
}
module.exports = { create };
