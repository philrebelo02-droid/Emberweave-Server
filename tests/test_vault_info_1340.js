// v1340 (Phil 10 Nov: "Make the gatekeeper a button and move next to the others" / "9 and grey doesn't even tell me anything" / "Make the records taller")
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..'); const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
function problems(h) { const o = []; const v = h.slice(h.indexOf('function vaultScreenHTML('), h.indexOf('function vaultScreenHTML(') + 6000);
  if (/vault\.highest_cleared|vault\.fragment_band/.test(v)) o.push('Highest Cleared / Fragment Band still shown');
  if (!/class="vtInfo" role="button"[^>]*onclick="vaultInfo\(\)"/.test(v)) o.push('no Gatekeeper/Info button');
  if (/vault\.boss_floor_note/.test(v) || /vaultBossLabel\(s\.bossRule\)/.test(v)) o.push('boss text still on the screen, not in the pop-out');
  if (!/function vaultInfo\(\)\{/.test(h) || !/panel-frame\.webp\?v=1\) 175 44 64 44 fill/.test(h.slice(h.indexOf('#vtInfoPop .viCard')))) o.push('pop-out missing or not on the Bonus frame');
  if (!/vtDrops:nth-child\(3\):not\(\.panel\)\{height:132px!important\}/.test(h)) o.push('drops box not taller');
  if (/#market\{position:relative;min-height:100dvh/.test(h) || /height:max\(740px,100dvh\)/.test(h)) o.push('screens still window-height');
  return o; }
assert.deepStrictEqual(problems(html), [], problems(html).join('; '));
const bad = html.replace("${stat(t('vault.floor_desc')", "${stat(t('vault.highest_cleared'),'9')}${stat(t('vault.floor_desc')");   /* v1376: the Info button is the Floor Description button */
assert(bad !== html && problems(bad).length === 1, 'CONTROL failed: ' + problems(bad).join('; '));
console.log('PASS vault info 1340');
