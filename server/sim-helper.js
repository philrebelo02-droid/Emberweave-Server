'use strict';
/* v1039 BATTLE HELPER (Phil 6 Oct 2026: "When the server is stressing - high war time - my computer comes to support it if its not
   busy"). Runs on a machine that is NOT a game server (Phil's PC) and fights battles for the game servers when their own battle
   workers are backed up. It holds no world and saves nothing: a battle in, its result out.

   - Same engine or nothing: it fights only for a server whose engine fingerprint (server/sim-host.js fingerprint()) equals its
     own checkout's - the PC's C:/Emberweave/game-live is reset to the deployed commit on every deploy. A mismatch answers 409.
   - Lowest priority: the process (and its worker threads) run at the OS's lowest priority, so anything else on the machine
     (Ember, games, the desktop) always comes first.
   - Not busy: when the rest of the machine uses more than `busyCpu` of the CPU, or its own queue is full, it answers 503 and the
     server fights the battle itself. The server never waits on the helper beyond a short timeout.
   - Shared key: every battle request carries x-helper-key; anything else answers 401.
   - When its checkout changes (a deploy), it exits; the launcher starts it again on the new engine.
   Config: JSON file SIM_HELPER_CONFIG (default %LOCALAPPDATA%/Emberweave/sim-helper.json): {key, port=8890, host="0.0.0.0",
   workers, busyCpu=0.6}. Start: node server/sim-helper.js */
const http = require('http'), os = require('os'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), GAME = path.join(ROOT, 'emberweave-heroes.html');
const CFG_FILE = process.env.SIM_HELPER_CONFIG || path.join(process.env.LOCALAPPDATA || os.homedir(), 'Emberweave', 'sim-helper.json');
const cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
if (typeof cfg.key !== 'string' || cfg.key.length < 24) { console.error('sim-helper: config needs a key of 24+ characters'); process.exit(2); }
const PORT = +cfg.port || 8890, HOST = cfg.host || '0.0.0.0', BUSY = +cfg.busyCpu || 0.6;
const WORKERS = Math.max(1, Math.min(+cfg.workers || Math.floor(os.cpus().length / 2), 12));
const KEY = Buffer.from(cfg.key);

try { os.setPriority(0, os.constants.priority.PRIORITY_LOW); } catch (e) { console.error('sim-helper: could not lower priority: ' + e.message); }
const FP = require('./sim-host.js').fingerprint(GAME);
const pool = require('./sim-pool.js').create(GAME, { size: WORKERS, queueMax: WORKERS * 4, timeoutMs: 15000 });
const stats = { started: Date.now(), battles: 0, refusedBusy: 0, refusedBuild: 0, refusedKey: 0, errors: 0 };

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
const busy = () => others > BUSY || pool.queued >= WORKERS * 2;

// a deploy changed the checkout -> exit; the launcher restarts on the new engine
setInterval(() => { try { if (require('./sim-host.js').fingerprint(GAME) !== FP) { console.log('sim-helper: engine changed on disk - restarting'); process.exit(0); } } catch (e) {} }, 60000).unref();

function keyOk(req) { const k = Buffer.from(String(req.headers['x-helper-key'] || '')); return k.length === KEY.length && crypto.timingSafeEqual(k, KEY); }
function reply(res, code, obj) { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b) }); res.end(b); }
const METHODS = new Set(['auto', 'campaign', 'raid', 'replay']);

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health')
    return reply(res, 200, { ok: true, fp: FP, busy: busy(), others: +others.toFixed(2), ready: pool.stats.ready, size: WORKERS, queued: pool.queued, ...stats });
  if (req.method !== 'POST' || req.url !== '/battle') return reply(res, 404, { error: 'not found' });
  if (!keyOk(req)) { stats.refusedKey++; req.resume(); return reply(res, 401, { error: 'key' }); }
  let body = '', size = 0;
  req.on('data', d => { size += d.length; if (size > 4 * 1024 * 1024) { req.destroy(); return; } body += d; });
  req.on('end', () => {
    let msg; try { msg = JSON.parse(body); } catch (e) { return reply(res, 400, { error: 'json' }); }
    if (msg.fp !== FP) { stats.refusedBuild++; return reply(res, 409, { error: 'different build', fp: FP }); }
    if (!METHODS.has(msg.method) || !Array.isArray(msg.args)) return reply(res, 400, { error: 'method' });
    if (busy()) { stats.refusedBusy++; return reply(res, 503, { busy: true }); }
    pool.run(msg.method, msg.args).then(result => { stats.battles++; reply(res, 200, { result }); },
      e => { stats.errors++; reply(res, 503, { busy: true, error: e.message }); });
  });
});
server.listen(PORT, HOST, () => console.log('sim-helper: ' + WORKERS + ' battle workers at lowest priority on ' + HOST + ':' + PORT + ', engine ' + FP.slice(0, 12)));
