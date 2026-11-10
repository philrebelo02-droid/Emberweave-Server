// v1338 (Phil 10 Nov: "The vault isnt setup the way we made it" / "Make sure the frames dont blurr art like this" / "EDP is so lame man")
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..'); const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
function problems(h) { const out = [];
  if (!/@media\(min-width:701px\) and \(orientation:landscape\)\{\s*#dungeon #dungeonBody>div>div:has\(\.vtPick\)\{display:grid/.test(h)) out.push('the Vault layout is not on for every landscape screen');
  if (!/function vtFit\(\)/.test(h) || !/vtFit\(\); return; \}/.test(h)) out.push('the Vault is not fitted to its screen');
  if (!/class="vtBoss"/.test(h)) out.push('the boss box has no place in the layout');
  if (/\.panel\{[^}]*\n?\s*-webkit-backdrop-filter:blur|backdrop-filter:blur\(3px\) saturate/.test(h)) out.push('panel frames still blur the art');
  if (!/#patScreen:has\(\.patLv\.edp\) \.patCard/.test(h) || !/edp-diamond-panel\.webp\?v=1/.test(h) || !/edp-diamond-phoenix\.webp\?v=1/.test(h)) out.push('the EDP art is not wired');
  return out; }
assert.deepStrictEqual(problems(html), [], problems(html).join('; '));
for (const f of ['edp-diamond-panel.webp', 'edp-diamond-phoenix.webp']) assert(fs.statSync(path.join(ROOT, 'assets/img/ui/egp-display', f)).size > 1000, f + ' missing');
// CONTROL: the phone-only switch that hid the layout must be caught
const bad = html.replace('@media(min-width:701px) and (orientation:landscape){', '@media(max-height:560px) and (min-width:701px){');
assert(bad !== html && problems(bad).length === 1, 'CONTROL failed: ' + problems(bad).join('; '));
console.log('PASS vault fit 1338');
