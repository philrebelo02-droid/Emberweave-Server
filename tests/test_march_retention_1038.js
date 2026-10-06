'use strict';
// v1038 (Phil 6 Oct 2026: "the finished marches are held onto for a bit to authenticate the battle was legit then let go").
// A settled city or mine march is held 2 days (past the 24 h receipt, so a late retry still meets it) and then dropped - for every
// player, not only above 100 marches. Unfinished marches are always kept, however old. Control: the v1037 code kept them all.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok  ' + m); };
function load(src) {
  const a = src.indexOf('const MARCH_KEEP_MS='), b = src.indexOf('function worldHeroReturnAt(');
  const c = src.indexOf('function worldCityMarches('), start = a >= 0 && a < c ? a : c;
  assert.ok(start >= 0 && b > start, 'march helpers found');
  const ctx = { Date }; vm.createContext(ctx);
  vm.runInContext(src.slice(start, b).replace(/function worldMineDurable[\s\S]*?\n}\r?\n/, ''), ctx);
  return ctx;
}
const H = 3600000, now = Date.UTC(2026, 9, 6, 12);
const fixture = () => [
  { id: 'old1', resolved: true, resolvedAt: now - 72 * H }, { id: 'old2', resolved: true, homeAt: now - 49 * H },
  { id: 'day1', resolved: true, resolvedAt: now - 24 * H }, { id: 'edge', resolved: true, resolvedAt: now - 47 * H },
  { id: 'openOld', resolved: false, arriveAt: now - 96 * H }, { id: 'openNew', resolved: false, arriveAt: now + H }];
try {
  const cur = load(fs.readFileSync(path.join(root, 'server.js'), 'utf8'));
  for (const [fn, field] of [['worldCityMarches', 'worldCityMarches'], ['worldMineMarches', 'worldMineMarches']]) {
    const u = { [field]: fixture() }, kept = cur[fn](u, now).map(m => m.id).sort().join();
    ok(kept === 'day1,edge,openNew,openOld', fn + ': settled marches older than 2 days are let go, newer ones and every unfinished one kept (' + kept + ')');
    const u2 = { [field]: fixture().slice(2) }, same = u2[field]; cur[fn](u2, now);
    ok(u2[field] === same, fn + ': nothing to drop -> the list is left as it is (no rewrite)');
  }
  const keep = vm.runInContext('MARCH_KEEP_MS', cur);
  ok(keep === 2 * 24 * H && keep > 24 * H, 'held 2 days - longer than the 24 h receipt it backs up');
  let old = null; try { old = require('node:child_process').execSync('git show 1d07b1ce:server.js', { cwd: root, maxBuffer: 64 << 20 }).toString(); } catch (e) {}
  if (old) { const prev = load(old), u = { worldCityMarches: fixture() };
    ok(prev.worldCityMarches(u, now).length === 6, 'control (v1037 code): a player under 100 marches kept every settled march'); }
  console.log('PASS ' + pass + ' checks');
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; }
