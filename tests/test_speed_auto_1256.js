// v1256 (Phil 2 Nov 2026: "Please make .5 speed only for arena or world map replays." / "When I say x1 lock i mean x2 speed unlocks at
// 1-3. Part of the tutorial now makes the speed flash for them to click it" / "Put a lock on auto and when people click it says requires
// vip 1 or level 30"). Runs the page's own speed / AUTO rules in a sandbox. Exit 0 = all passed. Control: SA_HTML=<the v1255 page> FAILS.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(process.env.SA_HTML || path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); };
const grab = name => { const i = html.indexOf('function ' + name + '('); assert(i >= 0, name + ' is defined'); let d = 0, k = html.indexOf('{', i);
  for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) break; } } return html.slice(i, k + 1); };
const src = ['spd2Open', 'autoOpen', 'spdChoices'].map(grab).join('\n');
const run = (cleared, egp1, lvl, mode) => { const ctx = { G: { campaignCleared: cleared }, CUR: { mode }, patEgp1: () => egp1, playerLevel: () => lvl };
  vm.createContext(ctx); vm.runInContext(src, ctx); return { ch: vm.runInContext('spdChoices()', ctx), auto: vm.runInContext('autoOpen()', ctx) }; };
let r = run(0, false, 1, 'campaign'); ok(JSON.stringify(r.ch) === '[1]', 'a new player has x1 only (x2 locked) - ' + JSON.stringify(r.ch));
r = run(2, false, 5, 'campaign'); ok(JSON.stringify(r.ch) === '[1]', 'still locked before 1-3 is cleared');
r = run(3, false, 6, 'campaign'); ok(JSON.stringify(r.ch) === '[1,2]', 'x2 opens once 1-3 is cleared, with no x0.5 in a normal fight - ' + JSON.stringify(r.ch));
r = run(0, true, 1, 'campaign'); ok(JSON.stringify(r.ch) === '[1,2]', 'EGP 1 keeps x2 (a perk is never taken away)');
r = run(3, false, 6, 'replay'); ok(JSON.stringify(r.ch) === '[0.5,1,2]', 'x0.5 exists only in replays (arena / world map) - ' + JSON.stringify(r.ch));
r = run(0, false, 29, 'campaign'); ok(r.auto === false, 'AUTO is locked at level 29 without EGP');
r = run(0, false, 30, 'campaign'); ok(r.auto === true, 'AUTO opens at player level 30');
r = run(0, true, 1, 'campaign'); ok(r.auto === true, 'AUTO opens at EGP 1');
ok(/bannerMsg\('x2 speed unlocks at stage 1-3'\)/.test(html), 'tapping the locked speed says it unlocks at 1-3');
ok(/bannerMsg\('Requires EGP 1 or level 30'\)/.test(html), 'tapping the locked AUTO says EGP 1 or level 30');
ok(/!G\.spdTaught&&state==='battle'\)\?' tut-next-glow'/.test(html) && /if\(!G\.spdTaught\)\{ G\.spdTaught=1;/.test(html), 'the speed button flashes until the first tap (tutorial)');
const pb = fs.readFileSync(path.join(__dirname, '..', 'server', 'patron-benefits.js'), 'utf8');
ok(/Unlocks auto ultimates \(everyone else at level 30\)/.test(pb) && !/2x battle speed/.test(pb), 'the EGP 1 perk text follows (x2 is no longer an EGP perk)');
ok(/patron-benefits\.js\?v=r1256/.test(html), 'the perk file has a new asset version');
console.log('test_speed_auto_1256.js: ' + pass + ' checks passed');
