'use strict';
/* v1036 (Phil 5 Oct 2026, "use both cores?" / "do it all"): a battle worker. It loads the SAME client battle engine the main
   thread uses (server/sim-host.js on the shipped emberweave-heroes.html) and runs one battle per message, so a fight costs the
   second core instead of the thread that answers players. The engine does not touch its inputs and is deterministic (checked
   5 Oct: same squads + seed -> same winner and digest), so a result from here equals the main thread's. */
const { parentPort, workerData } = require('worker_threads');
let host = null, loadError = null;
try { host = require('./sim-host.js').load(workerData.gameFile); }
catch (e) { loadError = e.message; }
const METHODS = new Set(['auto', 'campaign', 'raid', 'replay']);
parentPort.postMessage({ ready: !loadError, error: loadError, buildVersion: host ? host.buildVersion : null });
parentPort.on('message', msg => {
  const { id, method, args } = msg || {};
  if (!host) return parentPort.postMessage({ id, error: 'battle engine not loaded: ' + loadError });
  if (!METHODS.has(method)) return parentPort.postMessage({ id, error: 'unknown battle method ' + method });
  try { parentPort.postMessage({ id, result: host[method](...args) }); }
  catch (e) { parentPort.postMessage({ id, error: e.message }); }
});
