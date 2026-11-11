// v1367 AFFINITIES (Phil 11 Nov 2026): elements (+20% to the beaten, beaten -20% back, Light <-> Dark +20% both ways, Neutral untouched,
// Aureth by stance) and the six class edges. Runs the real rule text. CONTROL: v1365 has none of it.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const src = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const a = src.indexOf('const AFF_ELEMENT='), b = src.indexOf('function dealDamage(', a);
ck('affinity rules present', a > 0 && b > a);
ck('the release switch exists (AFFINITIES_LIVE)', /const AFFINITIES_LIVE=(true|false);/.test(src));
const ctx = {}; vm.runInNewContext('var AFFINITIES_LIVE=true;' + src.slice(a, b) + '\nthis.e=elemMul; this.c=classEdge; this.ue=unitElement; this.AFF=AFF_ELEMENT;', ctx);
const U = (key, team, role) => ({ key, team, t: { role } });
const ofEl = el => Object.keys(ctx.AFF).find(k => ctx.AFF[k] === el && k !== 'aureth');
for (const [x, y] of [['Water', 'Fire'], ['Fire', 'Ice'], ['Ice', 'Nature'], ['Nature', 'Lightning'], ['Lightning', 'Water']]) {
  const kx = ofEl(x), ky = ofEl(y);
  ck(x + ' deals +20% to ' + y, Math.abs(ctx.e(U(kx, 0), U(ky, 1)) - 1.2) < 1e-9);
  ck(y + ' deals 20% less to ' + x, Math.abs(ctx.e(U(ky, 0), U(kx, 1)) - 0.8) < 1e-9);
}
ck('Light deals +20% to Dark', Math.abs(ctx.e(U(ofEl('Light'), 0), U(ofEl('Dark'), 1)) - 1.2) < 1e-9);
ck('Dark deals +20% to Light', Math.abs(ctx.e(U(ofEl('Dark'), 0), U(ofEl('Light'), 1)) - 1.2) < 1e-9);
ck('Neutral deals normal damage', ctx.e(U(ofEl('Neutral'), 0), U(ofEl('Fire'), 1)) === 1);
ck('Neutral takes normal damage', ctx.e(U(ofEl('Water'), 0), U(ofEl('Neutral'), 1)) === 1);
ck('no element effect inside a team', ctx.e(U(ofEl('Water'), 0), U(ofEl('Fire'), 0)) === 1);
ck('Aureth is Light in his Light stance', ctx.ue({ key: 'aureth', t: {} }) === 'Light');
ck('Aureth is Dark in his Dark stance', ctx.ue({ key: 'aureth', _darkStance: true, t: {} }) === 'Dark');
ck('every one of the 61 heroes has an element', ['vael', 'vex', 'sylthaine', 'fritz', 'maren', 'lumi', 'umbris', 'korvux'].every(k => ctx.AFF[k]) && Object.keys(ctx.AFF).length >= 136, String(Object.keys(ctx.AFF).length));
const cyc = [['Support', 'Tank'], ['Tank', 'Marksman'], ['Marksman', 'Mage'], ['Mage', 'Bruiser'], ['Bruiser', 'Assassin'], ['Assassin', 'Support']];
for (const [x, y] of cyc) { ck(x + ' has the edge over ' + y, ctx.c(U('a', 0, x), U('b', 1, y)) === x); ck(y + ' has no edge over ' + x, ctx.c(U('a', 0, y), U('b', 1, x)) === ''); }
ck('no Warrior / Brute class anywhere in the rules', !/Warrior|Brute/.test(src.slice(a, b)));
for (const hook of ['amt*=elemMul(src,tgt)', "'BLOCK'", 'EDGE.drain', '_hexUntil', 'RIPOSTE', '_healCutUntil', 'edgeTauntPlus(u,', 'classEdge(src,tgt)===\'Support\''])
  ck('wired: ' + hook, src.indexOf(hook) > 0);
const old = cp.execSync('git show 7e49f874:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
ck('CONTROL: v1365 has no affinities', old.indexOf('AFF_ELEMENT') < 0 && old.indexOf('classEdge') < 0);
console.log('test_affinities_1367.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
