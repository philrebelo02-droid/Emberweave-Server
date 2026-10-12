'use strict';
// Preload hook (node -r), v1128 chat fan-out test: counts net.Socket writes on the main thread and keeps the count in
// SOCKET_WRITE_LOG (rewritten every 100 ms) - the same way for this tree and for a control tree.
const net = require('node:net'), fs = require('node:fs'), wt = require('node:worker_threads');
const LOG = process.env.SOCKET_WRITE_LOG;
if (LOG && wt.isMainThread) {
  let n = 0; const w = net.Socket.prototype.write;
  net.Socket.prototype.write = function () { n++; return w.apply(this, arguments); };
  const t = setInterval(() => { try { fs.writeFileSync(LOG, String(n)); } catch (_) {} }, 100); t.unref();
}
