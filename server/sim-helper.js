'use strict';
/* v1039 BATTLE HELPER (Phil 6 Oct 2026: "When the server is stressing - high war time - my computer comes to support it if its not
   busy"). Runs on a machine that is NOT a game server (Phil's PC) and fights battles for the game servers when their own battle
   workers are backed up. It holds no world and saves nothing: a battle in, its result out.

   - Same engine or nothing: it fights only for a server whose engine fingerprint (server/sim-host.js fingerprint()) equals its
     own checkout's - the PC's C:/Emberweave/game-live is reset to the deployed commit on every deploy. A mismatch answers 409.
   - Not busy: when the rest of the machine uses more than its busy limit, or it is already fighting its limit of battles, it
     answers 503 and the server fights the battle itself. The server never waits on the helper beyond a short timeout.
   - Shared key: every battle request carries x-helper-key; anything else answers 401.
   - When its checkout changes (a deploy), it exits; the launcher starts it again on the new engine.

   v1040 TWO MODES (Phil 6 Oct 2026: "if there is major war going on, like world tree day, my computer gives a little more than low
   priority help"):
     normal - the OS's lowest priority (Windows: Idle), `workers` battles at once (4), helps while the rest of the PC is under
              `busyCpu` (0.5);
     major  - one step up (Windows: Below Normal - everything at normal priority, Ember included, still comes first),
              `majorWorkers` battles at once (8), helps while the rest of the PC is under `majorBusyCpu` (0.8).
   A server asks for major (?war=major on its health check, war:"major" on a battle) during World Tree day or after a minute of
   unbroken strain; the helper stays major until `majorHoldMs` (90 s) after the last such ask, then drops back.
   Config: JSON file SIM_HELPER_CONFIG (default %LOCALAPPDATA%/Emberweave/sim-helper.json): {key, port=8890, host="0.0.0.0",
   workers=4, busyCpu=0.5, majorWorkers=8, majorBusyCpu=0.8, majorHoldMs=90000}. Start: node server/sim-helper.js

   v1041 THE CLUSTER HELPS ITSELF (Phil 6 Oct 2026: "When ever a server is using less than 30% of its cpu it allots up to 50% of its
   cpu to helping other server" / "node 1-3 will actually allot 100% of their cpu to help main" / "A strained server will never offer
   help to another strained server"). Extra config, for a helper running beside a game server (its CT):
     share      - fraction of the machine's CPUs it may use (0.5 shared, 1 dedicated); sets workers when workers is not given;
     serve      - "any" or a list of server ids ("1", "2", ...) it fights for; a request from another server answers 503;
     strainUrl  - its own game server's /internal/strain; while that server is strained it offers no help (503);
     nice       - OS priority (Linux nice: 0 dedicated, 10 shared so its own game server always wins);
     role       - a label shown on /health ("shared", "dedicated").
   A shared helper is busy when the rest of the machine (its own game server) uses more than busyCpu (0.5 since v1043 - Phil: "So then
   push it to 50%" / "Instead of 30"; was 0.3) or that server is strained (v1043: late in 3 of the last 5 seconds, or queuing). */
const http = require('http'), os = require('os'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), GAME = path.join(ROOT, 'emberweave-heroes.html');
const CFG_FILE = process.env.SIM_HELPER_CONFIG || path.join(process.env.LOCALAPPDATA || os.homedir(), 'Emberweave', 'sim-helper.json');
const cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
if (typeof cfg.key !== 'string' || cfg.key.length < 24) { console.error('sim-helper: config needs a key of 24+ characters'); process.exit(2); }
const PORT = +cfg.port || 8890, HOST = cfg.host || '0.0.0.0', KEY = Buffer.from(cfg.key);
const cpus = os.cpus().length;
const shareWorkers = cfg.share ? Math.max(1, Math.round(cpus * Math.min(1, +cfg.share))) : 0;
const basePriority = cfg.nice !== undefined ? +cfg.nice : os.constants.priority.PRIORITY_LOW;
const MODES = {
  normal: { workers: Math.max(1, Math.min(+cfg.workers || shareWorkers || 4, cpus)), busy: +cfg.busyCpu || 0.5, priority: basePriority },
  major: { workers: Math.max(1, Math.min(+cfg.majorWorkers || +cfg.workers || shareWorkers || 8, cpus)), busy: +cfg.majorBusyCpu || +cfg.busyCpu || 0.8,
    priority: cfg.nice !== undefined ? +cfg.nice : os.constants.priority.PRIORITY_BELOW_NORMAL },
};
const SERVE = Array.isArray(cfg.serve) ? cfg.serve.map(String) : 'any', ROLE = cfg.role || (cfg.share ? (cfg.share >= 1 ? 'dedicated' : 'shared') : 'pc');
const serves = from => SERVE === 'any' || (from !== undefined && from !== null && SERVE.includes(String(from)));
// v1041: a helper beside a game server asks that server whether it is strained; a strained server never offers help
let homeStrained = false;
if (cfg.strainUrl) setInterval(async () => { try { const j = await (await fetch(cfg.strainUrl, { signal: AbortSignal.timeout(1500) })).json(); homeStrained = !!j.strained; }
  catch (e) { homeStrained = false; } }, 2000).unref();
const HOLD_MS = +cfg.majorHoldMs || 90000;
let mode = 'normal', majorUntil = 0;
function setMode(m) {
  if (m === mode) return; mode = m;
  try { os.setPriority(0, MODES[m].priority); } catch (e) { console.error('sim-helper: could not set priority: ' + e.message); }
  console.log('sim-helper: ' + m + ' mode (' + MODES[m].workers + ' battles at once, priority ' + os.getPriority(0) + ')');
}
function askMajor() { majorUntil = Date.now() + HOLD_MS; setMode('major'); }
setInterval(() => { if (mode === 'major' && Date.now() > majorUntil) setMode('normal'); }, 1000).unref();
try { os.setPriority(0, MODES.normal.priority); } catch (e) { console.error('sim-helper: could not set priority: ' + e.message); }

const FP = require('./sim-host.js').fingerprint(GAME);
const POOL_SIZE = Math.max(MODES.normal.workers, MODES.major.workers);
const pool = require('./sim-pool.js').create(GAME, { size: POOL_SIZE, maxSize: POOL_SIZE, queueMax: POOL_SIZE * 2, timeoutMs: 15000 });
const stats = { started: Date.now(), battles: 0, majorBattles: 0, byServer: {}, refusedBusy: 0, refusedBuild: 0, refusedKey: 0, errors: 0 };
let inFlight = 0;

// "busy" = the REST of the machine: total CPU in use minus this process's own share
let others = 0, lastCpu = null, lastOwn = process.cpuUsage();
function sampleCpu() {
  const c = os.cpus(); let idle = 0, total = 0; for (const x of c) { idle += x.times.idle; for (const k in x.times) total += x.times[k]; }
  const own = process.cpuUsage();
  if (lastCpu) { const dT = total - lastCpu.total, dI = idle - lastCpu.idle, dOwn = ((own.user - lastOwn.user) + (own.system - lastOwn.system)) / 1000;
    if (dT > 0) others = Math.max(0, Math.min(1, (dT - dI - dOwn) / dT)); }
  lastCpu = { total, idle }; lastOwn = own;
}
sampleCpu(); setInterval(sampleCpu, 2000).unref();
const busy = () => homeStrained || others > MODES[mode].busy || inFlight >= MODES[mode].workers;

// a deploy changed the checkout -> exit; the launcher restarts on the new engine
setInterval(() => { try { if (require('./sim-host.js').fingerprint(GAME) !== FP) { console.log('sim-helper: engine changed on disk - restarting'); process.exit(0); } } catch (e) {} }, 60000).unref();

function keyOk(req) { const k = Buffer.from(String(req.headers['x-helper-key'] || '')); return k.length === KEY.length && crypto.timingSafeEqual(k, KEY); }
function reply(res, code, obj) { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b) }); res.end(b); }
const METHODS = new Set(['auto', 'campaign', 'raid', 'replay']);

const server = http.createServer((req, res) => {
  const [route, query] = String(req.url || '').split('?');
  if (req.method === 'GET' && route === '/health') {
    if (/(^|&)war=major(&|$)/.test(query || '') && ROLE === 'pc') askMajor();   // major mode is the PC's (v1040); cluster roles are fixed
    return reply(res, 200, { ok: true, fp: FP, role: ROLE, serves: SERVE, mode, priority: os.getPriority(0), limit: MODES[mode].workers, busy: busy(),
      homeStrained, others: +others.toFixed(2), ready: pool.stats.ready, size: POOL_SIZE, inFlight, ...stats });
  }
  if (req.method !== 'POST' || route !== '/battle') return reply(res, 404, { error: 'not found' });
  if (!keyOk(req)) { stats.refusedKey++; req.resume(); return reply(res, 401, { error: 'key' }); }
  let body = '', size = 0;
  req.on('data', d => { size += d.length; if (size > 4 * 1024 * 1024) { req.destroy(); return; } body += d; });
  req.on('end', () => {
    let msg; try { msg = JSON.parse(body); } catch (e) { return reply(res, 400, { error: 'json' }); }
    if (msg.fp !== FP) { stats.refusedBuild++; return reply(res, 409, { error: 'different build', fp: FP }); }
    if (!METHODS.has(msg.method) || !Array.isArray(msg.args)) return reply(res, 400, { error: 'method' });
    if (!serves(msg.from)) { stats.refusedOther = (stats.refusedOther || 0) + 1; return reply(res, 503, { busy: true, serves: SERVE }); }
    if (msg.war === 'major' && ROLE === 'pc') askMajor();
    if (busy()) { stats.refusedBusy++; return reply(res, 503, { busy: true }); }
    inFlight++; const wasMajor = mode === 'major';
    const who = msg.from ? 'server ' + String(msg.from).slice(0, 8) : 'unnamed';   // v1043: battles fought per server (Phil: "My computer helped server 3 howmuch?")
    pool.run(msg.method, msg.args).then(result => { stats.battles++; if (wasMajor) stats.majorBattles++; stats.byServer[who] = (stats.byServer[who] || 0) + 1; reply(res, 200, { result }); },
      e => { stats.errors++; reply(res, 503, { busy: true, error: e.message }); }).finally(() => { inFlight--; });
  });
});
server.listen(PORT, HOST, () => console.log('sim-helper (' + ROLE + ', serves ' + (SERVE === 'any' ? 'any server' : 'server ' + SERVE.join('+')) + '): ' + POOL_SIZE
  + ' battle workers (normal ' + MODES.normal.workers + ' at once, priority ' + MODES.normal.priority + '; major ' + MODES.major.workers + ') on ' + HOST + ':' + PORT
  + ', engine ' + FP.slice(0, 12)));
