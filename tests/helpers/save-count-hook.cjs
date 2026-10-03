// Preload hook for tests: counts real database saves (renames onto DB_FILE) into SAVE_COUNTER, and - when WELL_MODULE is set -
// loads that file instead of server/starless-well.js (used to run a test against a pre-fix copy of the module as a control).
const fs = require('node:fs'), Module = require('node:module'), rename = fs.renameSync;
fs.renameSync = function (a, b) {
  const r = rename.apply(this, arguments);
  if (b === process.env.DB_FILE && process.env.SAVE_COUNTER) fs.appendFileSync(process.env.SAVE_COUNTER, '1');
  return r;
};
if (process.env.WELL_MODULE) {
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...rest) {
    const f = orig.call(this, request, parent, ...rest);
    return f.split('\\').join('/').endsWith('/server/starless-well.js') ? process.env.WELL_MODULE : f;
  };
  console.error('[save-count-hook] starless-well.js -> ' + process.env.WELL_MODULE);
}
