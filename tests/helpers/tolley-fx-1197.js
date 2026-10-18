'use strict';
// v1197 Tolley's three Grok spell FX (Phil approved 17 Oct 2026) - tests/fixtures/tolley_fx_1197_before.json. undoTolleyFx1197(run) puts what live v1196
// (0605c5a1) had back in a loaded page - FX2_DEF tolley_green / tolley_blue / tolley_ult (the old plates), no tolley_blue_boom, Forge Strike / Chain Quench /
// HERO_ULT_ART.tolley without their ownFx, no FX1123_WARM.tolley, no SKP_OWNFX tforge / tquench / tlforge - so the older FX, kit and whole-fight tests keep
// testing what they were written for. Safe on any page. tests/test_tolley_fx_1197.js checks v1197 itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'tolley_fx_1197_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX)}, J=o=>JSON.parse(JSON.stringify(o));
  if(typeof FX2_DEF==='undefined'||!FX2_DEF.tolley_green||!/tolley_forge_strike_17oct/.test(FX2_DEF.tolley_green.u||'')) return 0;   /* not a v1197 page: nothing to undo */
  for(const k in B.fx) FX2_DEF[k]=J(B.fx[k]); delete FX2_DEF.tolley_blue_boom;
  KITS.tolley.green=J(B.green); KITS.tolley.blue=J(B.blue); HERO_ULT_ART.tolley=J(B.ultArt);
  if(typeof FX1123_WARM!=='undefined') delete FX1123_WARM.tolley;
  if(typeof SKP_OWNFX!=='undefined'){ delete SKP_OWNFX.tforge; delete SKP_OWNFX.tquench; delete SKP_OWNFX.tlforge; }
  try{ delete FX2_DEF.nerisse_blue.fxMul; }catch(e){}   /* the same release halves Nerisse's Drifting Constellation (tests/test_nerisse_half_1197.js) */
  return 1; })()`;
module.exports = { undoTolleyFx1197: run => run(CODE), FIX_TOLLEY_FX_1197: FIX };
