'use strict';
/* v1130 AUTO-OPEN THE NEXT SERVER (Phil, 12 Oct 2026: "auto open server 2 at 1500 players and start making new downloads join
   there. Players still have the option to join server 1 if they switch using server list after they are sent to server 2. We will
   re test when the new machines show up").

   Which server a NEW player (a fresh install: no account and no server stored on the device) starts on. Every game server runs this
   decider, so any live server can answer /api/front/assign - Server 1 being off never stops new players.
   - The servers are an ORDERED list (S1, S2, S3 ...), each with a threshold (default 1500 active players) and a release point
     (default 1300). Active = players with a live session in the last 5 minutes (server.js frontActive), never total accounts.
   - A server is FULL from the moment its count reaches its threshold, and stays full until the count drops below its release
     point (hysteresis, so new players do not flip-flop around the line).
   - New players go to the first server in the list that is KNOWN and not full. A server whose count is missing, refused, from
     another server id, or older than staleMs is UNKNOWN and skipped (never "overfilled" on a guess) - so a server that is down
     sends new players to the next one.
   - Every server full: the known server with the lowest load (active / threshold) - a choice is never blocked.
   - Nothing known at all: server null (the client keeps its old default, Server 1, and the net gate covers "no server").
   Existing players are never moved: this decides only for a device that has no account and no server yet; accounts never change
   server here. Pure functions below are what tests/test_front_door_1130.js checks; createDecider adds the poller. */

const DEFAULT_THRESHOLD = 1500, DEFAULT_RELEASE = 1300, DEFAULT_STALE_MS = 10000, DEFAULT_POLL_MS = 3000;
const DEFAULT_URLS = { 1: 'http://192.168.1.220:8080', 2: 'http://192.168.1.222:8080', 3: 'http://192.168.1.223:8080',
  4: 'http://192.168.1.224:8080', 5: 'http://192.168.1.225:8080' };

function num(v, d) { const n = +v; return Number.isFinite(n) && n > 0 ? Math.floor(n) : d; }
/* "id|url|threshold|release, ..." in list order; threshold / release optional (defaults from env FRONT_THRESHOLD / FRONT_RELEASE). */
function parseServers(spec, defThreshold, defRelease) {
  const th = num(defThreshold, DEFAULT_THRESHOLD), rel = num(defRelease, DEFAULT_RELEASE);
  const out = [], seen = new Set();
  for (const part of String(spec || '').split(',').map(s => s.trim()).filter(Boolean)) {
    const [id, url, t, r] = part.split('|').map(s => (s || '').trim());
    if (!id || seen.has(id)) continue; seen.add(id);
    const threshold = num(t, th); let release = num(r, Math.min(rel, threshold));
    if (release > threshold) release = threshold;
    out.push({ id: String(id), url: (url || '').replace(/\/+$/, ''), threshold, release });
  }
  return out;
}
function defaultServers(defThreshold, defRelease) {
  return parseServers(Object.keys(DEFAULT_URLS).map(id => id + '|' + DEFAULT_URLS[id]).join(','), defThreshold, defRelease);
}
function known(st, now, staleMs) {
  return !!st && st.ok === true && typeof st.active === 'number' && Number.isFinite(st.active) && st.active >= 0
    && typeof st.gotAt === 'number' && now - st.gotAt <= staleMs && (+st.ageMs || 0) <= staleMs;
}
/* hysteresis: full[id] turns on at >= threshold, off below release; an unknown count leaves it as it was */
function updateFull(list, statuses, full, now, staleMs) {
  for (const s of list) { const st = statuses.get(s.id); if (!known(st, now, staleMs)) continue;
    if (st.active >= s.threshold) full[s.id] = true; else if (st.active < s.release) full[s.id] = false; }
}
function pick(list, statuses, full, now, staleMs) {
  staleMs = num(staleMs, DEFAULT_STALE_MS);
  updateFull(list, statuses, full, now, staleMs);
  const rows = list.map(s => { const st = statuses.get(s.id), k = known(st, now, staleMs);
    return { id: s.id, state: !k ? 'unknown' : (full[s.id] ? 'busy' : 'open'), active: k ? st.active : null, threshold: s.threshold, release: s.release }; });
  let rec = rows.find(r => r.state === 'open'), reason = rec ? 'first open server' : '';
  if (!rec) { const busy = rows.filter(r => r.state === 'busy');
    if (busy.length) { rec = busy.reduce((a, b) => (b.active / b.threshold < a.active / a.threshold ? b : a)); reason = 'every server busy - least loaded'; } }
  if (!rec) reason = 'no server count known';
  return { server: rec ? rec.id : null, reason, rows };
}

/* The live decider: polls each other server's /api/front/status every pollMs on the LAN; its own count is read in place. */
function createDecider(opts) {
  const list = opts.servers || [], selfId = opts.selfId ? String(opts.selfId) : '', selfCount = opts.selfCount || (() => null);
  const staleMs = num(opts.staleMs, DEFAULT_STALE_MS), pollMs = num(opts.pollMs, DEFAULT_POLL_MS), timeoutMs = num(opts.timeoutMs, 1500);
  const fetchImpl = opts.fetch || globalThis.fetch, now = opts.now || Date.now;
  const statuses = new Map(), full = {}; let timer = null, busy = false, ready = null;
  function readSelf() { if (!selfId || !list.some(s => s.id === selfId)) return;
    let c = null; try { c = selfCount(); } catch (e) { c = null; }
    if (c && typeof c.active === 'number') statuses.set(selfId, { ok: true, active: c.active, ageMs: Math.max(0, +c.ageMs || 0), gotAt: now() });
    else statuses.set(selfId, { ok: false, gotAt: now() }); }
  async function pollOne(s) {
    if (s.id === selfId) return readSelf();
    if (!s.url) return;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
    try { const r = await fetchImpl(s.url + '/api/front/status', { signal: ctl.signal, headers: { accept: 'application/json' } });
      const j = r && r.ok ? await r.json() : null;
      if (j && j.ok && typeof j.active === 'number' && (j.id === undefined || j.id === '' || String(j.id) === s.id))
        statuses.set(s.id, { ok: true, active: j.active, ageMs: Math.max(0, +j.ageMs || 0), gotAt: now() });
      else statuses.set(s.id, { ok: false, gotAt: now() });
    } catch (e) { statuses.set(s.id, { ok: false, gotAt: now() }); }
    finally { clearTimeout(t); } }
  async function poll() { if (busy) return; busy = true;
    try { await Promise.all(list.map(pollOne)); updateFull(list, statuses, full, now(), staleMs); } finally { busy = false; } }
  function decide() { readSelf(); return pick(list, statuses, full, now(), staleMs); }
  function start() { if (timer || !list.length) return ready; ready = poll(); timer = setInterval(poll, pollMs); if (timer.unref) timer.unref(); return ready; }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return { list, statuses, full, poll, decide, start, stop, staleMs, pollMs, get ready() { return ready || Promise.resolve(); } };
}

module.exports = { parseServers, defaultServers, known, updateFull, pick, createDecider,
  DEFAULT_THRESHOLD, DEFAULT_RELEASE, DEFAULT_STALE_MS, DEFAULT_POLL_MS, DEFAULT_URLS };
