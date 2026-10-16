'use strict';
// v1160 Veyr + Deepcleft eight animations + Veyr's three spell FX (tests/fixtures/anim_1160_before.json). The per-hero and size tests of earlier
// releases compare the page with their own BASE (BATTLE_ANIM, FX2_DEF, kits, sound rows). undo1160(run) puts what live v1158 had for the entries
// v1160 changed back in a loaded page - BATTLE_ANIM.veyr / .deepcleft, the three ownFx tags (KITS.veyr green / blue, HERO_ULT_ART.veyr), the
// three new FX2_DEF keys and their warm list, Veyr's and Deepcleft's SFX rows - so those checks keep testing what they were written for.
// tests/test_veyr_deepcleft_1160.js checks v1160 itself (sheets, timing on the engine's moments, whole fights = BASE + the v532 crit-clip rule).
// critRule1160(run) gives a BASE page's Veyr and Deepcleft a crit clip with their OLD attack timing (render data only): the v532 rule their new
// crit clips switch on - for whole-fight checks that compare this page (with its real crit clips) with an older BASE.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'anim_1160_before.json'), 'utf8'));
const KEYS = Object.keys(FIX.before.anim), FX_KEYS = FIX.fxAdded;
const CODE = `(()=>{ const B=${JSON.stringify(FIX.before)};
  if(typeof FX2_DEF==='undefined'||!FX2_DEF.veyrcrescent) return 0;   /* not a v1160 page: nothing to undo */
  for(const k in B.anim) BATTLE_ANIM[k]=JSON.parse(JSON.stringify(B.anim[k]));
  for(const s of ['green','blue']) delete KITS.veyr[s].ownFx;
  HERO_ULT_ART.veyr=JSON.parse(JSON.stringify(B.ultArt.veyr));
  for(const k of ${JSON.stringify(FX_KEYS)}) delete FX2_DEF[k];
  if(typeof FX1123_WARM!=='undefined') delete FX1123_WARM.${FIX.warmAdded};
  for(const k in B.sfx) SFX_DATA.heroes[k]=JSON.parse(JSON.stringify(B.sfx[k]));
  return 1; })()`;
const RULE = `(()=>{ for(const k of ${JSON.stringify(KEYS)}){ const A=BATTLE_ANIM[k]; if(A&&A.attack&&!A.crit) BATTLE_ANIM[k]=Object.assign({},A,{crit:Object.assign({},A.attack)}); } return 1; })()`;
module.exports = { undo1160: run => run(CODE), critRule1160: run => run(RULE), KEYS_1160: KEYS, FX_KEYS_1160: FX_KEYS, FIX_1160: FIX };
