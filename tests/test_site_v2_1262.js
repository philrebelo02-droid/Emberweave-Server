// v1262 (Phil 2 Nov 2026: "Work with chatgpt and update our website. Make it look much more appealing"). Checks the website
// page (emberweave-site.html): the v2 sections are there, the embers canvas the splash script draws on exists (it was missing),
// the featured heroes are real heroes with their in-game sub names and their own lore, the install flow and live patch notes are
// untouched, and no other game's name reached the page. Exit 0 = passed. Control: SITE_HTML=<the v1261 page> FAILS.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const site = fs.readFileSync(process.env.SITE_HTML || path.join(ROOT, 'emberweave-site.html'), 'utf8');
const game = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); };
ok(/<canvas id="embers" aria-hidden="true"><\/canvas>/.test(site), 'the splash has its embers canvas (the ember script had nothing to draw on)');
ok(/<section class="feat" id="featured"/.test(site) && /<section class="finale" id="playnow">/.test(site), 'the featured-hero showcase and the closing call to play are on the page');
ok((site.match(/<div class="divider" aria-hidden="true"><i><\/i><\/div>/g) || []).length >= 3, 'ornate dividers between the sections');
ok(/<article class="mode lead rv">/.test(site) && (site.match(/<article class="mode rv">/g) || []).length === 5, 'six framed mode cards, the Campaign leading');
ok((site.match(/data-tile="/g) || []).length === 6, 'the six feature tiles each carry an icon');
const art = [...new Set((site.match(/\/assets\/img\/site\/[a-z0-9-]+\.webp/g) || []))];
ok(art.length === 9 && art.every(a => fs.existsSync(path.join(ROOT, a.slice(1)))), 'the painted art (divider, showcase hall, six feature scenes, call-to-play charge) is wired and every file exists - ' + art.length);
// featured heroes: real keys, in-game sub names, a line from their own lore
const F = JSON.parse(site.match(/var FEAT=(\[.*?\]);/)[1]);
const S = JSON.parse(game.match(/HERO_SUBNAME = (\{[^}]*\})/)[1]);
const li = game.indexOf('const HERO_LORE = {'); let d = 0, k = game.indexOf('{', li); for (; k < game.length; k++) { if (game[k] === '{') d++; else if (game[k] === '}') { d--; if (!d) break; } }
const L = vm.runInNewContext('(' + game.slice(game.indexOf('{', li), k + 1) + ')');
ok(F.length >= 5 && F.every(f => fs.existsSync(path.join(ROOT, 'assets/img/hero-cards/card-' + f.key + '.webp'))), F.length + ' featured heroes, each with its hero card art');
ok(F.every(f => S[f.key] === f.sub), 'each featured hero shows its in-game sub name');
ok(F.every(f => L[f.key] && L[f.key].title === f.title && L[f.key].text.replace(/—/g, '-').replace(/ - as/, ', as').indexOf(f.line) >= 0), 'each lore line is taken from that hero\'s own lore');
ok(/addEventListener\('beforeinstallprompt'/.test(site) && /fetch\('\/patchnotes\.json'/.test(site), 'the install flow and the live patch notes are untouched');
ok(!/magic rush|fractalia|dragon prayer|chatgpt|openai|\bgrok\b|claude/i.test(site), 'no other game, tool or assistant name on the page');
console.log('test_site_v2_1262.js: ' + pass + ' checks passed');
