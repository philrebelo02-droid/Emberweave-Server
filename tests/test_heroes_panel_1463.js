// v1463 lockdown audit 25 Nov 2026 (Heroes > 15 - Heroes Panel): what was still open after the v1455 fixes.
// Fixes 1-9 of the audit list (arrows, real Ability Power, AP icon, emoji lines, crit row, Quick Slot / Ascend after a fight,
// Morvayne's lore title, SUMMON NOW stars) were already live in v1455 / v1452 and stay covered by test_heroes_fixes_1455.js
// and test_engine_fixes_1452.js. This file covers the one part still open: the page's fragment mirror (giveHeroFrag) had no cap.
// The page runs headless through server/sim-host.js. No browser, no server.
// CONTROL: HP_HTML=<the v1462 page, e.g. from `git show 80eadafa2:emberweave-heroes.html`> must FAIL section 10.
// Exit 0 = all passed.
'use strict';
const path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const HTML = process.env.HP_HTML || path.join(root, 'emberweave-heroes.html');
let pass = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL ' + m); console.log('test_heroes_panel_1463.js: FAILED after ' + pass + ' passed'); process.exit(1); } pass++; console.log('  ok   ' + m); };
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const J = s => JSON.parse(vm.runInContext('JSON.stringify(' + s + ')', host.ctx, { timeout: 60000 }));

console.log('== 10. Fragment cap: the page mirror keeps the 9,999 cap (as server.js creditFrags) ==');
{ const r = J(`(function(){ G.heroFrag={}; const out={};
    G.heroFrag.vael=9998; giveHeroFrag('vael',7); out.dupe=G.heroFrag.vael;          // Wishing Pool duplicate (+7) at 9,998
    G.heroFrag.vex=9999; giveHeroFrag('vex',5); out.atCap=G.heroFrag.vex;             // already at the cap
    G.heroFrag.yenna=9998; for(let i=0;i<3;i++) giveHeroFrag('yenna',1); out.loop=G.heroFrag.yenna;   // quest chain, one at a time
    G.heroFrag.tick=100; giveHeroFrag('tick',5); out.normal=G.heroFrag.tick;          // ordinary grant below the cap
    delete G.heroFrag.zz; giveHeroFrag('zz',3); out.fresh=G.heroFrag.zz;
    return out; })()`);
  ok(r.dupe === 9999, 'Wishing Pool duplicate at 9,998 + 7 shows 9,999 (got ' + r.dupe + ')');
  ok(r.atCap === 9999, 'a grant at 9,999 stays 9,999 (got ' + r.atCap + ')');
  ok(r.loop === 9999, 'three single grants from 9,998 stop at 9,999 (got ' + r.loop + ')');
  ok(r.normal === 105 && r.fresh === 3, 'grants under the cap are paid in full (100 + 5 = ' + r.normal + ', 0 + 3 = ' + r.fresh + ')');
}
console.log('test_heroes_panel_1463.js: ' + pass + ' passed');
