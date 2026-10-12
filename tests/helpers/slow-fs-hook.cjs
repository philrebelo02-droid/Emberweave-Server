'use strict';
// Preload hook (node -r), v1128 save-io tests: a SLOW DISK for the world folder, in whichever thread does the file work.
//   SLOW_FS_DIR   the folder (the world file's folder)
//   SLOW_FS_ON    a file: while it exists, every writeFileSync / appendFileSync / renameSync / unlinkSync under SLOW_FS_DIR first
//                 sleeps SLOW_FS_MS (the thread is blocked, like a write on a saturated SSD)
//   SLOW_FS_LOG   a file: one line per such call made on the MAIN thread while SLOW_FS_ON exists ("<op>\t<basename>")
// The same hook loads in worker threads (node runs -r preloads there too), so the delay lands wherever the server does its I/O.
const fs = require('node:fs'), path = require('node:path'), wt = require('node:worker_threads');
const DIR = process.env.SLOW_FS_DIR ? path.resolve(process.env.SLOW_FS_DIR) : null, ON = process.env.SLOW_FS_ON, MS = +(process.env.SLOW_FS_MS || 200), LOG = process.env.SLOW_FS_LOG;
if (DIR && ON) {
  const nap = new Int32Array(new SharedArrayBuffer(4)); let on = false, checked = 0;
  const active = () => { const now = Date.now(); if (now - checked > 50) { checked = now; on = fs.existsSync(ON); } return on; };
  const under = f => { try { return typeof f === 'string' && path.resolve(f).startsWith(DIR) && path.resolve(f) !== path.resolve(LOG || '') && path.resolve(f) !== path.resolve(ON); } catch (_) { return false; } };
  const append = fs.appendFileSync;
  for (const op of ['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync']) {
    const real = fs[op];
    fs[op] = function (f) {
      if (under(f) && active()) {
        if (LOG && wt.isMainThread) { try { append(LOG, op + '\t' + path.basename(String(f)) + '\n'); } catch (_) {} }
        Atomics.wait(nap, 0, 0, MS);
      }
      return real.apply(this, arguments);
    };
  }
}
