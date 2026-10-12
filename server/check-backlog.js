'use strict';
/* v1127 CHECK BACKLOG OUTSIDE THE PLAYER SHARDS (S1 copy run 11 Oct 2026: a fight waiting for its check kept its recording - frozen
   snapshots + the input log, ~3.6 KB - on the player's receipt, up to 40 per player; the world grew from 51 MB to 156 MB in one run
   and every save of that player rewrote them).

   The recordings waiting for a check live in an append-only file beside the world: <DB_FILE>.checks/backlog.jsonl.
     {"a":key,"p":payload}   a check is waiting (written - synchronously - BEFORE the resolve's save, so an acknowledged fight always
                             has its recording on disk; a crash between the two leaves an orphan the boot scan drops)
     {"d":key}               its check is done (accepted or flagged - a flagged fight's recording moves onto its receipt)
   The file is compacted (rewritten with only the waiting entries, temp + rename) when done lines outnumber waiting ones. A torn last
   line (a crash mid-append) is ignored. The world saves never carry these recordings. */
const fs = require('fs'), path = require('path');

function create(dbFile, opts) {
  opts = opts || {};
  const dir = dbFile + '.checks', file = path.join(dir, 'backlog.jsonl');
  const live = new Map(); let lines = 0;
  const stats = { waiting: 0, added: 0, done: 0, compactions: 0, bytes: 0, tornLines: 0 };
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  try {
    for (const l of fs.readFileSync(file, 'utf8').split('\n')) { if (!l) continue; let o; try { o = JSON.parse(l); } catch (e) { stats.tornLines++; continue; }
      lines++; if (o && typeof o.a === 'string') live.set(o.a, o.p); else if (o && typeof o.d === 'string') live.delete(o.d); }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  stats.waiting = live.size;
  /* v1128: with opts.io (the world store's io queue) the appends and the compaction are jobs on the store io worker - FIFO with the
     world saves, so an 'a' line is on disk before the save that acknowledges its fight (a failed append fails that save too) */
  const io = opts.io && opts.io.async ? opts.io : null;
  const ioErr = e => console.error('check backlog: ' + e.message);
  function append(o) { const s = JSON.stringify(o) + '\n'; if (io) io.submit([{ a: file, s }]).catch(ioErr); else fs.appendFileSync(file, s); lines++; stats.bytes += s.length; }
  function compact() {
    const tmp = file + '.tmp'; let s = ''; for (const [a, p] of live) s += JSON.stringify({ a, p }) + '\n';
    if (io) io.submit([{ w: tmp, s }, { r: tmp, to: file }]).catch(ioErr); else { fs.writeFileSync(tmp, s); fs.renameSync(tmp, file); }
    lines = live.size; stats.compactions++; stats.bytes += s.length;
  }
  return {
    file, stats,
    add(key, payload) { append({ a: key, p: payload }); live.set(key, payload); stats.added++; stats.waiting = live.size; },
    get(key) { return live.get(key); },
    has(key) { return live.has(key); },
    keys() { return [...live.keys()]; },
    done(key) { if (!live.has(key)) return; live.delete(key); stats.done++; stats.waiting = live.size;
      try { append({ d: key }); if (lines > 2 * live.size + (opts.compactSlack || 1000)) compact(); } catch (e) { console.error('check backlog: ' + e.message); } },
    compact,
  };
}
module.exports = { create };
