'use strict';
// v1158 q95 (tests/fixtures/q95_1158.json): 238 sheets that were lossless in v1157 are lossy q95 now, at ?v=1158. The tests of earlier
// releases check their own art against what they shipped - exact URLs (?v=), LOSSLESS files, pixel-exact cells. For them:
//   page(htmlPath) -> a copy of the page with every q95 URL put back to the ?v= it had in v1157 (an exact inverse of the v1158 rewrite)
//   file(ROOT, urlOrPath) -> the file to check: for a q95 sheet, its v1157 lossless original (read from git at the fixture's base);
//                            otherwise the file on disk
// tests/test_q95_1158.js checks the q95 files themselves against those originals (size, alpha bit-exact, smaller, quality, URLs).
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'q95_1158.json'), 'utf8'));
const BY = new Map(FIX.sheets.map(s => [s.path, s]));
const ROOT0 = path.resolve(__dirname, '..', '..');
const CACHE = path.join(os.tmpdir(), 'ew-q95-src-' + FIX.base.slice(0, 12));
const made = [];
process.on('exit', () => { for (const f of made) { try { fs.unlinkSync(f); } catch (e) {} } });
function undoText(s) { for (const e of FIX.sheets) s = s.split(e.path + '?v=1158').join(e.path + e.old_v); return s; }
function page(htmlPath) {
  const out = path.join(path.dirname(htmlPath), '.test-q95-page-' + process.pid + '-' + made.length + '.html');
  fs.writeFileSync(out, undoText(fs.readFileSync(htmlPath, 'utf8'))); made.push(out); return out; }
function file(root, u) {
  const p = '/' + String(u).split('?')[0].replace(/^\//, ''); const e = BY.get(p);
  if (!e) return path.join(root, p.slice(1));
  const f = path.join(CACHE, p.slice(1));
  if (!fs.existsSync(f) || fs.statSync(f).size !== e.old_bytes) { fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, cp.execFileSync('git', ['show', FIX.base + ':' + p.slice(1)], { cwd: root || ROOT0, maxBuffer: 256 << 20 })); }
  return f; }
module.exports = { Q95: FIX, BY, page, file, undoText };
