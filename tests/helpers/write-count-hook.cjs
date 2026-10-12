// Preload hook (node -r): appends "<bytes>\t<basename>" for every fs.writeFileSync under the world file's folder to WRITE_LOG, so a
// test or a measurement can count what each save wrote - the same way for this tree and for a control tree.
const fs = require('node:fs'), path = require('node:path');
const LOG = process.env.WRITE_LOG, DBF = process.env.DB_FILE ? path.resolve(path.dirname(process.env.DB_FILE)) : null;
if (LOG && DBF) {
  const w = fs.writeFileSync, append = fs.appendFileSync;
  fs.writeFileSync = function (f, data) {
    const r = w.apply(this, arguments);
    try { const p = typeof f === 'string' ? path.resolve(f) : ''; if (p.startsWith(DBF) && p !== path.resolve(LOG)) append(LOG, (typeof data === 'string' ? Buffer.byteLength(data) : (data && data.length) || 0) + '\t' + path.basename(p) + '\n'); } catch (_) {}
    return r;
  };
}
