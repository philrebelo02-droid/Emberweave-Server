// v1100 (Phil 9 Oct): "the hero fragment should be their hero card" + the 20 approved icons wired. Static checks on the page.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), page = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const ICONS = ['res-forge-dust','res-xp-potion','mode-tower-of-trials','mode-mine','mode-forge','mode-portal-veteran','mode-vault','mode-skyfall',
  'class-tank','class-bruiser','class-assassin','class-marksman','class-mage','class-support','fx-heart','fx-spade','fx-diamond','fx-club','ed-item-reforge','ed-item-magnet'];
const missing = ICONS.filter(n => !fs.existsSync(path.join(ROOT, 'assets/img/icons/ui', n + '-v1.webp')));
ok(missing.length === 0, 'all 20 approved icons are on disk (' + (missing.join() || 'none missing') + ')');
const unused = ICONS.filter(n => page.indexOf("'" + n + "'") < 0 && page.indexOf(':' + n + '}') < 0);
ok(unused.length === 0, 'every approved icon is used by the page (' + (unused.join() || 'all used') + ')');
ok(!fs.existsSync(path.join(ROOT, 'assets/img/icons/ui/res-hero-fragment-v1.webp')) && page.indexOf('res-hero-fragment') < 0, 'no generic hero-fragment icon (Phil: fragments are the hero card)');
ok(page.indexOf('\u{1F9E9}') < 0, 'no puzzle-piece emoji left anywhere in the page');
ok(/function fragCard\(key,px\)\{[^\n]*heroIcon\(key,px\)/.test(page), 'fragCard draws the hero\'s own card (heroIcon)');
const fragUses = (page.match(/fragCard\(/g) || []).length - 1;
ok(fragUses >= 10, 'hero fragments show the hero card in ' + fragUses + ' places (Elite, results, summon, star-up, wishes)');
ok(/function glyphFragChip\(k\)[^\n]*g2NodeArtSrc\(\{kind:'fragment',key:k\}\)/.test(page) && (page.match(/glyphFragChip\(k\)/g) || []).length >= 4, 'Vault glyph fragments show their glyph art');
ok((page.match(/img:'fx-(heart|spade|diamond|club)'/g) || []).length === 4 && /if\(f\.img\)\{ const im=ftImg\(f\.img\)/.test(page), "Sorrel's four suits draw their card art on the battle canvas");
ok(/function edToolIcName\(it\)\{ return it\.anv \? 'mode-forge' : \(it\.rf \? 'ed-item-reforge' : 'ed-item-magnet'\); \}/.test(page), 'Emberdraft Anvil / Reforger / Magnet use their art');
ok(['Tank','Bruiser','Mage','Marksman','Assassin','Support'].every(c => page.indexOf(c + ":{ic:uiIcon('class-" + c.toLowerCase() + "')") >= 0), 'Emberdraft class synergies use the six class icons');
ok(page.indexOf("s.indexOf('⛏')>=0||s.indexOf('{i:u:mode-mine}')>=0") >= 0, 'control: old saved mine mail (pick emoji) still routes to the Mines tab, new mail carries the icon token');
console.log('test_icons_1100.js: ' + pass + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
