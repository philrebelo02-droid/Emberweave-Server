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
ck('v1326: the Forge item-list panel drops the stretched laurel frame (Phil 9 Nov Forge screenshot) - each row keeps its own', /#forge:not\(:has\(#fgPop\)\) #forgeBody>\.panel:has\(\.fgRow\),#forge #forgeBody>\.panel:has\(\.fgRow\)\{background:none!important/.test(html));
ck('v1326: the City Wall tab bar fills (no row padding on it) and its rows clear the laurel corners (Phil 9 Nov screenshot)', html.includes('.wdPanel>.wdBar{padding:0!important;height:14px!important') && html.includes('.wdPanel{padding:72px 15% 112px!important}'));
ck('v1326: the six big framed panels pad 62 px / 16 % so the laurels never touch text ("I dont like the boarders touching lettering")', (html.match(/padding:62px 16%!important/g) || []).length === 6);
ck('v1326: Forge qualities are a tab column on the RIGHT of the list ("Qualitys should be on the right like tabs")', html.includes('#forge .fgTabs{order:2!important;display:flex!important;flex-direction:column!important') && html.includes('#forge .fgWrap{flex-direction:row!important') && html.includes('#forge .fgTabs .fgQ{min-height:28px!important'));
ck('v1326: the redesigned building screens fill a wide phone ("why is it not fit to screen")', /const FILL_WIDE=\{campaign:1,home:1,skyisland:1,arena:1,skyfall:1,forge:1,tech:1,market:1,shadymarket:1,wall:1,rankings:1,dungeon:1,watchtower:1,guild:1,wishing:1\};/.test(html));
ck('v1326: Forge - one row per equipment, title raised ("each equipment 1 row" / "raise the forge title up")', html.includes('#forge .fgRow{background:url('/assets/img/ui/building-main/inset-card.webp?v=1') center/100% 100%!important;min-height:0!important;padding:7px max(52px,12%)!important;flex-wrap:nowrap!important') && html.includes('#forge .fgBy{display:none!important}') && html.includes('.titlebar{top:52px!important}'));
console.log('test_building_mains_1325.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
