// v1344 (Phil 10 Nov): Arena title art, painted thumbs, the five reward icons in place of stand-ins.
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..'); const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const code = html.slice(html.indexOf('\n', html.indexOf('const EW_LANG_EN=')));
function problems(h, c) { const o = [];
  if (!/arena-title\.webp\?v=1/.test(h)) o.push('Arena title art missing');
  if (!/thumbs-up\.webp\?v=1/.test(h) || !/thumbs-down\.webp\?v=1/.test(h)) o.push('thumbs art missing');
  if (/⧗/.test(c)) o.push('a stamina glyph is still in the code');
  if (/rpXp">XP</.test(h)) o.push('Player XP still the text XP');
  if (/uiIcon\('medal'\)\} \$\{\(\(r\.reward&&r\.reward\.guildCoins\)/.test(h) || /\$\{uiIcon\('ticket'\)\} \+\$\{rw\.coins/.test(h)) o.push('coin stand-ins still used');
  return o; }
assert.deepStrictEqual(problems(html, code), [], problems(html, code).join('; '));
for (const f of ['assets/img/ui/building-main/arena-title.webp', 'assets/img/ui/arena/thumbs-up.webp', 'assets/img/ui/arena/thumbs-down.webp', ...['hero-xp', 'player-xp', 'guild-coins', 'arena-coins', 'stamina'].map(n => 'assets/img/icons/ui/res-' + n + '-v1.webp')])
  assert(fs.statSync(path.join(ROOT, f)).size > 1000, f + ' missing');
const bad = code + "'⧗ '";
assert(problems(html, bad).length === 1, 'CONTROL failed');
console.log('PASS art + icons 1344');
