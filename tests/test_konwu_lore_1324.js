// v1324 (Phil 9 Nov 2026: "im not sure why but konwus lore voice was never put in his lore section" / "Vaels is in good"): KonWu's lore tab plays
// his approved lore read - Kon-Wu v8 (12 Oct 13:13; the voice bar with Vael v9), byte-identical to the Archive's take. CONTROL: live v1323 (96fe6a2a).
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show 96fe6a2a:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const f = path.join(ROOT, 'assets/audio/voice/lore/konwu_lore.m4a');
ck('KonWu has a lore row (no ult lines, lore ?v=1)', /konwu:\{ ult:\[\], lore:1 \}/.test(html));
ck('Vael\'s row is untouched (lore ?v=2)', /vael:\{ ult:\[\], lore:2 \}/.test(html) && /vael:\{ ult:\[\], lore:2 \}/.test(old));
ck('the file ships: the approved v8 read (sha1 b6941130..., 1,204,834 bytes)', fs.existsSync(f) && fs.statSync(f).size === 1204834 && crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').startsWith('b6941130'));
ck('CONTROL: v1323 had no KonWu lore row', !/konwu:\{ ult:/.test(old));
console.log('test_konwu_lore_1324.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
