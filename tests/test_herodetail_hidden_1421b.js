// v1421b (Phil 18 Nov: "Talents bugged AGAIN" / "I just clicked a hero then talents" / "Another way to get bugged is open skills then talents then hit back").
// On a phone in landscape the Talents tab puts the short layout on the hero window (#heroDetail.tl-short), whose CSS sets display:flex. That class stays on
// the window after it closes, so the CLOSED hero window (no .active) kept showing as a full hero screen (tab row, ‹ › arrows, the talent board) behind the
// Heroes window and under the town. Reproduced with real taps at 915x412: Heroes -> hero -> Talents -> Skills -> Talents -> Heroes: elementsFromPoint behind
// the Heroes pop-out hit #heroDetail .hd-tab; after the fix it hits the town. The fix: a hidden hero window is display:none even in the short layout.
// CONTROL: the v1421 page (c0bb9c48) lacks the rule and fails.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const html=fs.readFileSync(process.env.EW_HTML||path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok   '+m); };
const css=html.slice(0,html.indexOf('</style>'));
ok(/#heroDetail\.tl-short\{[^}]*display:flex/.test(css),'the short layout still lays the open hero window out as a column (display:flex)');
ok(/#heroDetail\.tl-short:not\(\.active\)\{display:none!important\}/.test(css),'a closed hero window (no .active) is display:none even in the short layout');
const i1=css.search(/#heroDetail\.tl-short\{[^}]*display:flex/), i2=css.search(/#heroDetail\.tl-short:not\(\.active\)\{display:none!important\}/);
ok(i2>i1,'the hide rule comes after the short layout rule, so it wins');
console.log('test_herodetail_hidden_1421b.js: '+pass+' checks passed');
