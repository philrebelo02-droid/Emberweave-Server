// v1343 (Phil 10 Nov): the Nameless Admiral's passive is a 4th-attack 15 m knockback (+100% Ability Power, the path takes it too), no Lifesteal; brighter upgrade dots.
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..'); const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
function problems(h) { const o = [];
  if (!/MONSTER_KITS\['nameless admiral'\]\.pass='knock4';/.test(h) || /MONSTER_KITS\['nameless admiral'\]\.pass='lifesteal';/.test(h)) o.push('the Admiral still has Lifesteal');
  const blk = h.slice(h.indexOf('if(u.pass.knock4)'), h.indexOf('if(u.pass.knock4)') + 1600);
  if (!/%4/.test(blk) || !/15\*METER/.test(blk) || !/enemiesOf\(u\)\.forEach/.test(blk) || !/dealDamage\(u,t,bonus,/.test(blk)) o.push('knockback passive incomplete');
  if (!/\.hupDot\{filter:brightness\(1\.45\)/.test(h)) o.push('upgrade dots not brighter');
  return o; }
assert.deepStrictEqual(problems(html), [], problems(html).join('; '));
// the passive sits in the per-swing block every basic attack runs
const sw = html.indexOf('/* v527 - PER-SWING PACK PASSIVES'), kn = html.indexOf('if(u.pass.knock4)'), lp = html.indexOf('// Living Pages (Librarian)');
assert(sw > 0 && kn > sw && kn < lp, 'knock4 must run on every basic attack');
const bad = html.replace("MONSTER_KITS['nameless admiral'].pass='knock4';", "MONSTER_KITS['nameless admiral'].pass='lifesteal';");
assert(bad !== html && problems(bad).length === 1, 'CONTROL failed');
console.log('PASS admiral + dots 1343');
