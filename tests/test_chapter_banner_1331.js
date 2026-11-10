// v1331 (Phil 10 Nov): the Campaign chapter banner wraps the arrows and both text lines, so it is always their size. EW_ROOT points this at another tree for a control run.
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = process.env.EW_ROOT || path.join(__dirname, '..');
const cli = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
assert(cli.includes('hdr.innerHTML=`<div class="chBanner"><button class="btn xs secondary" id="chPrev"'), 'the banner wraps the left arrow');
assert(/id="chNext"[^\n]*<\/button><\/div>`;/.test(cli), 'the banner closes after the right arrow');
assert(/#campaign \.chBanner\{[^}]*inset-card\.webp/.test(cli), 'the banner art is on the wrapper');
assert(!cli.includes("#campaign #cmapHdr::before{content:''"), 'the old fixed-width banner is gone');
console.log('PASS chapter banner 1331');
