// v1323 (Phil 9 Nov 2026): (1) "The plus signs when clicked dont actually open stam or diamond shops" / "They open only when you exit to main
// screen" - #hudShop lived inside #home, so from the campaign it opened inside a hidden screen; it now moves beside #stageModal when it opens.
// (2) Spire 2D: "Spell art is to large and infront of the heroes. Should be behind and also scaled to their hero" - the hero's spell art is
// drawn before the 2D hero, and sized to her (an upright plate 1.2x the 3.6 m hero, not 6.9 m). CONTROL: live v1322 (git show 4eccf066).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show 4eccf066:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const dev = fs.readFileSync(path.join(ROOT, 'survivors-dev.html'), 'utf8');
const odev = cp.execSync('git show 4eccf066:survivors-dev.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const shopMove = /if\(m&&sm&&m\.parentElement!==sm\.parentElement\) sm\.parentElement\.insertBefore\(m, sm\.nextSibling\);/;
ck('the resource shop moves out of the base screen (beside the stage window) before it opens, so the campaign + opens it', shopMove.test(html) && html.indexOf('id="hudShop"') < html.indexOf('id="campaign"'));
ck('CONTROL: v1322 opened it inside #home', !shopMove.test(old));
const iArt = dev.indexOf('drawSpellArt(X, Y, sc, W, H);'), iHero = dev.indexOf('    if (H2) {\n') >= 0 ? dev.indexOf('    if (H2) {\n') : dev.indexOf('    if (H2) {\r\n');
ck('Spire: the spell art is drawn before the 2D hero (behind her)', iArt > 0 && iHero > 0 && iArt < iHero, [iArt, iHero]);
const oA = odev.indexOf('drawSpellArt(X, Y, sc, W, H);'), oH = odev.indexOf('    if (H2) {');
ck('CONTROL: v1322 drew it after the hero (in front)', oA > oH);
ck('Spire 2D: spell art scaled to the hero (FXK2 = 3.6 x 1.2 / 6.9)', /FXK2 = 3\.6 \* 1\.2 \/ \(4\.6 \* 1\.5\)/.test(dev) && /if \(H2\) \{ w \*= FXK2; hh \*= FXK2; \}/.test(dev));
console.log('test_shop_spire_1323.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
