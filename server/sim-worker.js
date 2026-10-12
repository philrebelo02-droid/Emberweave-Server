'use strict';
/* v1036 (Phil 5 Oct 2026, "use both cores?" / "do it all"): a battle worker. It loads the SAME client battle engine the main
   thread uses (server/sim-host.js on the shipped emberweave-heroes.html) and runs one battle per message, so a fight costs the
   second core instead of the thread that answers players. The engine does not touch its inputs and is deterministic (checked
   5 Oct: same squads + seed -> same winner and digest), so a result from here equals the main thread's. */
const { parentPort, workerData } = require('worker_threads');
let host = null, loadError = null;
try { host = require('./sim-host.js').load(workerData.gameFile); }
catch (e) { loadError = e.message; }
const METHODS = new Set(['auto', 'campaign', 'raid', 'replay', 'worldtree', 'line']);
/* v1129 LIVE BATTLES OFF THE MAIN THREAD (Phil: World Tree is "the server's largest pvp event"; World Tree and Skyfall are
   "fast machines" work). Two more battles a worker (and so a helper) fights:
     worldtree - one World Tree site fight: server/world-tree-battle.js's resolver built on THIS engine - the function server.js
                 ran on its main thread until v1129 - (ally, foe, seed) -> its result object;
     line      - one Skyfall assault: the shared line resolver (server/sim.js) -
                 (aSnaps, aCarry, bSnaps, bCarry, seed, capToEntry) ->
                 SIM.resolveLineBattle(SIM.makeLine(aSnaps, aCarry, capToEntry), SIM.makeLine(bSnaps, bCarry, capToEntry), seed).
   Both files are in the engine fingerprint (sim-host.js), so a helper with another copy of them is never sent one. */
let worldTree = null, SIM = null;
const LIVE = {
  worldtree: (ally, foe, seed) => { if (!worldTree) worldTree = require('./world-tree-battle.js').create(host); return worldTree(ally, foe, seed); },
  line: (aSnaps, aCarry, bSnaps, bCarry, seed, cap) => { if (!SIM) SIM = require('./sim.js');
    return SIM.resolveLineBattle(SIM.makeLine(aSnaps, aCarry, cap), SIM.makeLine(bSnaps, bCarry, cap), seed); },
};
parentPort.postMessage({ ready: !loadError, error: loadError, buildVersion: host ? host.buildVersion : null });
parentPort.on('message', msg => {
  const { id, method, args } = msg || {};
  if (!host) return parentPort.postMessage({ id, error: 'battle engine not loaded: ' + loadError });
  if (!METHODS.has(method)) return parentPort.postMessage({ id, error: 'unknown battle method ' + method });
  try { parentPort.postMessage({ id, result: LIVE[method] ? LIVE[method](...args) : host[method](...args) }); }
  catch (e) { parentPort.postMessage({ id, error: e.message }); }
});
