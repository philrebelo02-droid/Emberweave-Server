'use strict';
// v1162 Korvux eight animations + the Ember Cleave FX re-sync (tests/fixtures/anim_korvux_1162_before.json). The per-hero, sound and spell-FX tests
// of earlier releases compare the page with their own BASE. undoKorvux1162(run) puts what live v1159 had for the entries this change replaced back
// in a loaded page - BATTLE_ANIM.korvux, FX2_DEF.korvuxcleave's sync / fit, SFX_DATA.heroes.korvux (Ember Cleave + Falling Star on 'cast') - so those
// checks keep testing what they were written for. tests/test_korvux_anim_eight.js checks v1162 itself.
// critRuleKorvux1162(run) gives a BASE page's Korvux a crit clip with his OLD attack timing (render data only): the v532 rule his new crit clip
// switches on - for whole-fight checks that compare this page (with its real crit clip) with an older BASE.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'anim_korvux_1162_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX.before)};
  if(typeof BATTLE_ANIM==='undefined'||!BATTLE_ANIM.korvux||!BATTLE_ANIM.korvux.crit||!/_1162\.webp/.test(BATTLE_ANIM.korvux.idle.u)) return 0;   /* not a v1162 page: nothing to undo */
  BATTLE_ANIM.korvux=JSON.parse(JSON.stringify(B.anim.korvux));
  if(typeof FX2_DEF!=='undefined'&&FX2_DEF.korvuxcleave){ const d=FX2_DEF.korvuxcleave; d.sync=JSON.parse(JSON.stringify(B.fx.korvuxcleave.sync)); d.fit=JSON.parse(JSON.stringify(B.fx.korvuxcleave.fit)); }   /* only the re-synced fields: the file URL is whatever this page (or the q95 test view of it) has */
  if(typeof SFX_DATA!=='undefined'&&SFX_DATA.heroes) SFX_DATA.heroes.korvux=JSON.parse(JSON.stringify(B.sfx.korvux));
  return 1; })()`;
const RULE = `(()=>{ const A=BATTLE_ANIM.korvux; if(A&&A.attack&&!A.crit) BATTLE_ANIM.korvux=Object.assign({},A,{crit:Object.assign({},A.attack)}); return 1; })()`;
module.exports = { undoKorvux1162: run => run(CODE), critRuleKorvux1162: run => run(RULE), FIX_KORVUX_1162: FIX };
