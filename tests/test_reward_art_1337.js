// v1337 (Phil 10 Nov: "the rewards in any mode should show the rewards of the actual items" / "no emojis or generic items" / "please put under the 600 diamonds how much base it gives")
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..'); const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
function problems(h) { const out = [];
  const rp = h.slice(h.indexOf('function rewardPanel('), h.indexOf('function pvpRecap('));
  if (!/gearFragImg\(m\?m\[1\]:String\(n\),52\)/.test(rp)) out.push('reward tiles do not use the fragment art');
  if (/uiIcon\('mode-forge'\)/.test(rp)) out.push('reward tiles use the Forge icon');
  const it = h.slice(h.indexOf('function stageRewardItems('), h.indexOf('function stageRewardPop('));
  if (/lore-book/.test(it)) out.push('XP potion shows a book in the pop-up');
  if (!/res-xp-potion-v1\.webp/.test(it)) out.push('XP potion art missing from the pop-up');
  if (/XP Potion'\+\(n===1\?'':'s'\)\}\)\}<\/div>/.test(h) && /uiIcon\('lore-book'\)\} \$\{ewT\('res2\.plus_n_item'/.test(h)) out.push('XP potion shows a book on the result screen');
  if (!/class="st2-base"/.test(h) || !/basePerUsd\|\|6/.test(h)) out.push('store cards have no Base Diamonds line');
  if (!/forge-title\.webp\?v=1/.test(h) || !/vault-title\.webp\?v=1/.test(h)) out.push('title art is not wired');
  return out; }
assert.deepStrictEqual(problems(html), [], problems(html).join('; '));
for (const f of ['forge-title.webp', 'vault-title.webp']) assert(fs.statSync(path.join(ROOT, 'assets/img/ui/building-main', f)).size > 1000, f + ' missing');
// every gear fragment the game can drop has its own picture
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/gear-catalog.json'), 'utf8')).items, slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const miss = [...new Set(cat.map(i => i.frag).filter(Boolean))].filter(n => !fs.existsSync(path.join(ROOT, 'assets/img/gear/frags', slug(n) + '.webp')));
assert.deepStrictEqual(miss, []);
// CONTROL: the old generic icon must be caught
const bad = html.replace("gearFragImg(m?m[1]:String(n),52)", "uiIcon('mode-forge')");
assert(bad !== html && problems(bad).length === 2, 'CONTROL failed: ' + problems(bad).join('; '));
console.log('PASS reward art 1337');
