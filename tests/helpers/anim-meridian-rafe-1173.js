'use strict';
// v1173 Meridian (seven) and Rafe Marrow (ten) - tests/fixtures/anim_meridian_rafe_1173_before.json. undoMR1173(run) puts what live v1169 had back in
// a loaded page - BATTLE_ANIM meridian / rafe, SFX_DATA heroes meridian / rafe, and Rafe's swing landing on the press (RAFE_SWING.fuse = false) - so the
// older per-hero, sound, slim and whole-fight tests keep testing what they were written for. Safe on any page (an older page has none of it).
// tests/test_meridian_rafe_1173.js checks v1173 itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'anim_meridian_rafe_1173_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX.before)};
  if(typeof BATTLE_ANIM==='undefined'||!BATTLE_ANIM.rafe||!/rafe_idle_\\d{4}\\.webp/.test(BATTLE_ANIM.rafe.idle.u)) return 0;   /* not a v1173 page: nothing to undo */
  BATTLE_ANIM.meridian=JSON.parse(JSON.stringify(B.anim.meridian)); BATTLE_ANIM.rafe=JSON.parse(JSON.stringify(B.anim.rafe));
  if(typeof SFX_DATA!=='undefined'&&SFX_DATA.heroes){ SFX_DATA.heroes.meridian=JSON.parse(JSON.stringify(B.sfx.meridian)); SFX_DATA.heroes.rafe=JSON.parse(JSON.stringify(B.sfx.rafe)); }
  if(typeof RAFE_SWING!=='undefined') RAFE_SWING.fuse=false;
  return 1; })()`;
const UHK = require('./anim-hobb-kharos-1174.js');   /* v1174: Hobb's and Kharos's entries go back too (every caller of this helper compares with a BASE before v1174) */
module.exports = { undoMR1173: run => { UHK.undoHK1174(run); return run(CODE); }, FIX_MR_1173: FIX };
