'use strict';
// v1186 Kharos's three Grok spell FX - tests/fixtures/kharos_fx_1186_before.json. undoKFX1186(run) puts what live v1180 had back in a loaded page -
// FX2_DEF kharos_green / blue / ult (the old plates), Petal Sever / Bloomstep / HERO_ULT_ART.kharos without their ownFx, no Kharos FX16 entries - so
// the older FX, kit and whole-fight tests keep testing what they were written for. Safe on any page. tests/test_kharos_fx_1186.js checks v1186 itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'kharos_fx_1186_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX.before)}, J=o=>JSON.parse(JSON.stringify(o));
  if(typeof FX2_DEF==='undefined'||!FX2_DEF.kharos_green||!/kharos_petal_sever_16oct/.test(FX2_DEF.kharos_green.u)) return 0;   /* not a v1186 page: nothing to undo */
  for(const k in B.fx) FX2_DEF[k]=J(B.fx[k]);
  KITS.kharos.green=J(B.green); KITS.kharos.blue=J(B.blue); HERO_ULT_ART.kharos=J(B.ult);
  if(typeof FX16_ART!=='undefined'){ delete FX16_ART.kgreen; delete FX16_ART.kblue; delete FX16_ART.kult; }
  if(typeof FX1123_WARM!=='undefined') delete FX1123_WARM.kharos;
  if(typeof SKP_OWNFX!=='undefined'){ delete SKP_OWNFX.kgreen; delete SKP_OWNFX.kblue; delete SKP_OWNFX.kult; }
  return 1; })()`;
module.exports = { undoKFX1186: run => run(CODE), FIX_KFX_1186: FIX };
