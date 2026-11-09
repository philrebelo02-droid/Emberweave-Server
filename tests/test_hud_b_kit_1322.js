// v1322 (Phil 9 Nov 2026: picked "B" - ChatGPT's Forged Ember Heraldry main-screen kit, Game Art/UI/Main Screen HUD 09NOV2026/kit/):
// the base screen's HUD wears the B kit. CONTROL: live v1321 (git show ee84454e).
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show ee84454e:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const KIT = ['resource-pill', 'food-icon', 'gold-icon', 'diamond-icon', 'plus-button', 'commander-ring', 'commander-plate', 'egp-plate', 'edp-plate', 'menu-plate', 'menu-icon', 'sound-on', 'sound-off', 'chat-bar', 'level-badge'];
const used = KIT.filter(n => html.includes('/assets/img/ui/hud2/' + n + '.webp'));
ck('every B piece the base screen uses is referenced from assets/img/ui/hud2/', used.length === KIT.length, KIT.filter(n => !used.includes(n)));
const missing = KIT.filter(n => !fs.existsSync(path.join(ROOT, 'assets/img/ui/hud2', n + '.webp')));
ck('and each file ships in the build', !missing.length, missing);
ck('the Commander and EGP plates are the same art (byte-identical), EDP its own', (() => { const h = n => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'assets/img/ui/hud2', n + '.webp'))).digest('hex'); return h('commander-plate') === h('egp-plate') && h('edp-plate') !== h('egp-plate'); })());
ck('resource pills are a 9-slice of the kit pill (fixed laurel caps, stretched centre)', /#home #townHud \.resframe\{[^}]*border-image:url\(\/assets\/img\/ui\/hud2\/resource-pill\.webp\?v=1\) 36 150 30 150 fill \/ 7px 26px 6px 26px stretch/.test(html));
ck('the pieces are scoped to the base screen (#home / home active); the sound button is the one shared piece', /#home #pfFrame\{content:url\(\/assets\/img\/ui\/hud2\/commander-ring\.webp/.test(html) && /body:has\(#home\.active\) #chatWidget\.min \.cw-head\{/.test(html) && /im\.src=on\?'\/assets\/img\/ui\/hud2\/sound-off\.webp\?v=1':'\/assets\/img\/ui\/hud2\/sound-on\.webp\?v=1'/.test(html));
ck('CONTROL: v1321 had none of the B kit', !/\/assets\/img\/ui\/hud2\//.test(old));

// same release, Phil 9 Nov
ck('EGP opens on whichever of pointerup / touchend / click comes first, once per press ("Clicking the egp button pulls up nothing" - a phone tap reached nothing)', /pb\.addEventListener\('pointerup',go\); pb\.addEventListener\('touchend',go,\{passive:false\}\); pb\.onclick=go;/.test(html) && /if\(now-\(pb\._openAt\|\|0\)<600\) return; pb\._openAt=now; openPatron\(\);/.test(html));
ck('each building name label is its own building\'s button, above every box ("If i click on the word market it shouldnt be opening the academy")', /lab\.style\.pointerEvents='auto'; lab\.style\.zIndex='40';/.test(html) && /lab\.addEventListener\('click',ev=>\{ ev\.stopPropagation\(\); hit\.onclick\(ev\); \}\)/.test(html));
ck('the Vault label moved right off the Arena art (x 75 -> 81)', /\[75,38,14,22,81,52\]/.test(html) && /\[75,38,14,22,75,52\]/.test(old));
ck('the base HUD hugs its edges ("Cannot waste space for buildings")', /#home #townHud\{top:3px\}/.test(html) && /#home #leftHud\{top:2px;left:calc\(0\.5% \+ 37px\)\}/.test(html) && /#home #cornerHud\{top:2px;right:3px\}/.test(html));
ck('the Heroes list and the hero window open centred on the screen ("its meant to be centered on the screen")', /#heroesPanel\.popout,#heroDetail\.popout\{left:50%!important;right:auto!important;transform:translateX\(-50%\)!important;/.test(html));
ck('the upgrade dot is a small cut gem (9 px, gold rim, lit ruby face, breathing glow) in the card corner and the tab corner ("looks like it was done on paint")', /\.hupDot\{position:absolute;left:3px;bottom:3px;width:9px;height:9px;[^}]*border:1px solid #f4cf6a;background:radial-gradient\(/.test(html) && /@keyframes hupGlow/.test(html) && /\.hd-tab \.hupDot\{left:auto;bottom:auto;right:3px;top:3px;width:9px;height:9px\}/.test(html));
ck('the Heroes list shows rows of 5, in a window wide enough to keep the cards their size ("Rows of 5")', /#heroList\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important\}/.test(html) && /#heroesPanel\.popout\{width:min\(560px,96%\)!important\}/.test(html));
ck('every open reports what this device still holds of the offline art (files, persist, usage/quota, last cache log) - "the 5th time you told me this was fixed"', /ewStep\('offart-open', 'held '\+n\+' persisted '\+per/.test(html) && /if\(!\/\^\(err\|authfail\|offart\)\/\.test\(st\)/.test(html));
console.log('test_hud_b_kit_1322.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
