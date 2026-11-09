// v1325 (Phil 9 Nov 2026: Emberdraft style approved -> every building MAIN screen gets new art AND UI, Temple of Ash excluded; ChatGPT's packages
// Academy / Market + Shady Market / the 12-screen rollout). Every referenced piece ships as WebP; the shared kit is not duplicated; Temple untouched;
// the game-fit rules (panel blur off, header box skipped on the markets, title padding) are in. CONTROL: live v1324 (git show db034166).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show db034166:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const refs = [...new Set([...html.matchAll(/\/assets\/img\/ui\/(academy-main|merchant-main|building-main|emberdraft-main)\/([a-z0-9-]+)\.webp/g)].map(m => m[1] + '/' + m[2]))];
ck('every new building-screen piece the game references ships (' + refs.length + ' files)', refs.length > 20 && refs.every(r => fs.existsSync(path.join(ROOT, 'assets/img/ui', r + '.webp'))), refs.filter(r => !fs.existsSync(path.join(ROOT, 'assets/img/ui', r + '.webp'))));
ck('no PNG paths left from the packages', !/\/assets\/img\/ui\/(academy-main|merchant-main|building-main)\/[a-z0-9-]+\.png/.test(html));
ck('the shared kit is not duplicated (no kit piece inside academy-main / merchant-main / building-main)', ['action-disabled', 'action-secondary', 'dialog-frame', 'item-slot', 'play-button', 'tab-active', 'tab-idle'].every(n => ['academy-main', 'merchant-main', 'building-main'].every(d => !fs.existsSync(path.join(ROOT, 'assets/img/ui', d, n + '.webp')))));
ck('Academy, Market and Shady Market run ChatGPT\'s render functions', /class="ac-|ac-title-art/.test(html) && /merc-title-art/.test(html) && /function renderTech\(/.test(html) && /function renderMarket\(/.test(html) && /function renderShadyMarket\(/.test(html));
ck('game-fit: the .panel blur is off on the new screens; the markets skip the v659 header box; market titles get their full width', /#tech #techPanel\{-webkit-backdrop-filter:none!important/.test(html) && /#market \.panel,#shadymarket \.panel\{-webkit-backdrop-filter:none!important/.test(html) && /const NO_HDRBOX=\{skyisland:1,market:1,shadymarket:1\}/.test(html) && /#market \.titlebar,#shadymarket \.titlebar\{padding-left:0!important/.test(html));
ck('the City Wall / Witches Hut heading follows the tab; no emoji in the Bulletin Board, region and guild search lines', /const key=WALL_TAB==='cauldron'\?'bld\.witches_hut':'bld\.city_wall'/.test(html) && !/<div>🐲 \$\{t\('rank\.dungeon'\)\}/.test(html) && !/🏰 \$\{t\('wall\.region'\)\}/.test(html) && !/&#128269; \$\{t\('guild\.find'\)\}/.test(html));
const fnOf = (s, name) => { const i = s.indexOf('function ' + name + '('); let d = 0, j = s.indexOf('{', i); for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) break; } return s.slice(i, j + 1).split('\r').join(''); };
const tempLines = s => s.split('\n').filter(l => l.includes('#temple')).join('\n').split('\r').join('');
const tOld = fnOf(old, 'renderTemple') + tempLines(old), tNew = fnOf(html, 'renderTemple') + tempLines(html);
ck('Temple of Ash untouched (Phil: excluded)', tOld === tNew && !/#temple[^{]*building-main/.test(html));
ck('CONTROL: v1324 had none of it', !/academy-main|merchant-main|building-main/.test(old));
console.log('test_building_mains_1325.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
