// Load a game page in the server's sim host (no browser, no GPU) and print JSON.stringify(<expr>) - the pipeline's window into the page's
// own tables (BATTLE_ANIM, HERO_TYPES, SFX_DATA, KITS ...). A page from git is written next to its own external scripts first (sim-host needs them).
// usage: node page_dump.js <repo root> <html file | git:<sha>> <js expression>
'use strict';
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os');
const [ROOT0, SRC, EXPR] = process.argv.slice(2), ROOT = path.resolve(ROOT0);
let file = SRC, tmp = null;
if (SRC.startsWith('git:')) {
  const sha = SRC.slice(4);
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-dump-'));
  fs.mkdirSync(path.join(tmp, 'server'));
  for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js']) {
    try { fs.writeFileSync(path.join(tmp, f), cp.execSync('git show ' + sha + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) { /* older trees lack some */ }
  }
  file = path.join(tmp, 'emberweave-heroes.html');
}
try {
  const h = require(path.join(ROOT, 'server/sim-host.js')).load(file);
  process.stdout.write(String(vm.runInContext('JSON.stringify(' + EXPR + ')', h.ctx)));
} finally { if (tmp) try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
