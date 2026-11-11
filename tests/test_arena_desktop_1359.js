// v1359 (Phil 10 Nov, desktop Arena: "the rank and refresh plates in the middle of the art, it should be left side, also arena should be largers and right of base").
// Static check of the rules (the layout itself was rendered at 1900x1000, 1280x700, 1024x768, 841x632, 844x390, 882x344). CONTROL: v1358 has none of them.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'); let P = 0, F = 0; const ck = (n, c) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8').replace(/\r\n/g, '\n');
const old = cp.execSync('git show 47540784:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const a = html.indexOf('/* v1359 (Phil 10 Nov, desktop Arena screenshot'), b = html.indexOf('/* v1352 (Phil 10 Nov: "how many buildings', a), blk = html.slice(a, b);
ck('the v1359 Arena block exists, after the v1344 rules and before v1352', a > html.indexOf('/* v1344 (Phil 10 Nov: "that change should be across all devices types")') && b > a);
ck('tall screens only: every rule sits in a min-height:561px query (phones untouched)', (blk.match(/@media[^{]*\{/g) || []).length === 4 && (blk.match(/@media[^{]*\{/g) || []).every(m => /min-height:561px/.test(m) && /min-width:701px/.test(m)));
ck('title right of Base and larger', /#arena:has\(\.arWrap\)>\.hdrbox\{top:6px!important;left:96px!important;width:auto!important/.test(blk) && /h1\{width:clamp\(260px,calc\(var\(--ew-game-width,100vw\) \* \.2\),380px\)!important/.test(blk));
ck('the two plates slide to the left edge (transform, so defenders and opponents keep their place)', (blk.match(/#arena \.arMedal,#arena \.arDay\{transform:translateX\(calc\(var\(--ew-game-width,100vw\) \* -/g) || []).length === 4);
ck('the body starts below the title', /#arenaBody\{margin-top:120px!important\}/.test(blk) && /#arenaBody\{margin-top:104px!important\}/.test(blk));
ck('tablets and the open Fold (16:9 frame in a taller window) get the one-screen layout scaled to the frame', /max-aspect-ratio:3\/2\) and \(min-width:997px\)\{\n#arena:has\(\.arWrap\) #arenaBody\{zoom:0\.82!important/.test(blk) && /max-aspect-ratio:3\/2\) and \(max-width:996px\)\{\n#arena:has\(\.arWrap\) #arenaBody\{zoom:0\.67!important/.test(blk));
ck('CONTROL v1358: none of it', !/v1359 \(Phil 10 Nov, desktop Arena/.test(old));
console.log('test_arena_desktop_1359.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
