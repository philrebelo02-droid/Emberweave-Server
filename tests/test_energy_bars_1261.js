// v1261 (Phil 2 Nov 2026: "Something is wrong with energy bars. Its not accurate. It shows they have ult with zero energy and doesn't show
// them gaining"). Runs the page's own buildPortraitBar + updatePortraits on a fake DOM: after a mid-fight rebuild the NEW bars must show each
// hero's energy (the cache used to keep writing the old, detached bars). Plus the 1-1 scripted ults fill steadily. Exit 0 = passed.
// Control: EB_HTML=<the v1260 page> FAILS (the rebuilt bars stay empty).
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(process.env.EB_HTML || path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); };
const grab = name => { const i = html.indexOf('function ' + name + '('); assert(i >= 0, name + ' is defined'); let d = 0, k = html.indexOf('{', i);
  for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) break; } } return html.slice(i, k + 1); };
// the cache drop sits in buildPortraitBar, right before the elements are stored on the unit
const bp = grab('buildPortraitBar');
ok(/u\._hpFill=undefined; u\._enFill=undefined; u\._hpW=undefined; u\._enW=undefined; u\._hpLow=undefined; u\._slotCN=undefined;(?:\s*u\._\w+=undefined;)*\s*u\.portraitEl=el;/.test(bp)   /* v1372: the combat cards (B4.5) drop _hpN / _hpM too */, 'every portrait-bar rebuild drops the cached bar elements and values');
// behaviour: the real updatePortraits against two generations of bar elements
const mkEl = () => { const fill = { style: { width: '' } }; return { fill, querySelector: () => fill, classList: { toggle() {} }, className: '' }; };
const ctx = { units: [], updateEnemyBar() {} }; vm.createContext(ctx); vm.runInContext(grab('updatePortraits'), ctx);
const u = { team: 'ally', alive: true, hp: 50, maxHp: 100, energy: 20 };
const gen = () => { u.portraitEl = {}; u.hpEl = mkEl(); u.enEl = mkEl(); u.slotEl = mkEl(); };
gen(); ctx.units = [u]; vm.runInContext('updatePortraits()', ctx);
ok(u.enEl.fill.style.width === '20%', 'the first bar shows 20% energy');
// a mid-fight rebuild: new elements, then the cache drop exactly as buildPortraitBar does it
gen(); const drop = bp.match(/u\._hpFill=undefined;[^\n]*/)[0]; vm.runInContext('(u=>{' + drop + '})', ctx)(u);
u.energy = 100; vm.runInContext('updatePortraits()', ctx);
ok(u.enEl.fill.style.width === '100%' && /ready/.test(u.slotEl.className), 'after a rebuild the NEW bar shows the real energy (100%) and the ready glow matches it - ' + u.enEl.fill.style.width + ' / ' + u.slotEl.className);
u.energy = 40; vm.runInContext('updatePortraits()', ctx);
ok(u.enEl.fill.style.width === '40%' && !/ready/.test(u.slotEl.className), 'and keeps following it (40%, not ready)');
ok(/I\.vireo\.energy=Math\.max\(I\.vireo\.energy\|\|0, Math\.min\(99,100\*\(I\.t-I\.vireoIn\)\/4\.8\)\)/.test(html) && /I\.syl\.energy=Math\.max\(I\.syl\.energy\|\|0, Math\.min\(99,100\*\(I\.t-I\.sylIn\)\/5\)\)/.test(html), '1-1: Vireo and Sylthaine fill steadily to their scripted ult instead of jumping from empty to full');
console.log('test_energy_bars_1261.js: ' + pass + ' checks passed');
