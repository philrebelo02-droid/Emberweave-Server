// v1342 (Phil 10 Nov): the Record and Top Pick pop-outs, thumbs not plus/minus, the snug Defenders border, Rafe's passive 50% -> 200% on melee and ranged.
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..'); const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
function problems(h) { const o = [];
  if (!/function renderArenaReports\(\)\{[\s\S]{0,4000}id='arRecPop'/.test(h)) o.push('Record is not the pop-out');
  if (!/tp\.onclick=\(\)=>openArenaTop\(\)/.test(h)) o.push('Top Pick does not open the top battles');
  if (/data-v="1" aria-label="Like">\$\{uiIcon\('plus'\)\}/.test(h) || !/ARC_THUMB/.test(h)) o.push('likes are not thumbs');
  if (!/#arena:has\(\.arWrap\) \.arDefRow \{[\s\S]{0,900}dialog-frame\.webp\?v=1/.test(h)) o.push('Defenders border not fitted');
  if (!/function instinctPct\(lv\)\{[^}]*return 0\.5\+1\.5\*\(lv-1\)\/99; \}/.test(h) || !/dmg\*instinctDmg\(u\)/.test(h)) o.push('Rafe passive not 50-200%');
  return o; }
assert.deepStrictEqual(problems(html), [], problems(html).join('; '));
// the curve itself, as written
const pct = eval('(' + html.match(/function instinctPct\(lv\)\{[^}]*\}/)[0] + ')');
assert.strictEqual(pct(1), 0.5); assert.strictEqual(Math.round(pct(100) * 1000) / 1000, 2); assert(pct(50) > 1.2 && pct(50) < 1.3);
// the passive is in the per-swing block every basic attack runs (melee and ranged share it)
const blk = html.slice(html.indexOf('/* v527 - PER-SWING PACK PASSIVES'), html.indexOf("// Pirate's Instinct (Corsair)") + 400);
assert(/if\(u\.pass\.instinct\)/.test(blk) && !/u\.melee/.test(blk.slice(blk.indexOf("// Pirate's Instinct"))), 'the passive must not be limited to one attack kind');
const bad = html.replace("return 0.5+1.5*(lv-1)/99; }", "return 0.45; }");
assert(bad !== html && problems(bad).length === 1, 'CONTROL failed');
console.log('PASS arena ui + Rafe 1342');
