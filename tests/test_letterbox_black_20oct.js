// 20 Oct 2026 hotfix (Phil: "desktop version is bugged"): the stage letterbox is plain black except on tall phones.
// The 18 Oct Fold change painted body::before with the active screen's art at cover scale everywhere; on a wide desktop
// window that showed a second, broken copy of the town map beside the real one. The art fill stays for body.ew-rotated.
const fs = require('fs'), path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'emberweave-heroes.html');
const html = fs.readFileSync(file, 'utf8');
let fail = 0;
const base = html.match(/(?:^|[^.\w-])body::before\{[^}]*\}/m);
if (!base) { console.log('FAIL: no body::before rule'); process.exit(1); }
if (/url\(|var\(--ew-stage-background/.test(base[0])) { console.log('FAIL: desktop letterbox paints art'); fail++; }
const rot = html.match(/body\.ew-rotated::before\{[^}]*\}/);
if (!rot || !/--ew-stage-background/.test(rot[0])) { console.log('FAIL: tall-phone art fill missing'); fail++; }
console.log(fail ? 'FAIL ' + fail : 'PASS 2 checks (desktop bars plain, tall-phone fill kept)');
process.exit(fail ? 1 : 0);
