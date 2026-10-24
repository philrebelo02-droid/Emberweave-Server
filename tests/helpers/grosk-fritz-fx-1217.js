'use strict';
// v1217 Grosk's Hammer Fists burst + Fritz's three 18 Oct spell FX (Phil approved 23 Oct 2026) - tests/fixtures/grosk_fritz_fx_1217_before.json.
// undoGroskFritzFx1217(run) puts what live v1216 (d1930405) had back in a loaded page - FX2_DEF grosk_blue / fritz_green / fritz_blue / fritz_ult (the old
// sheets), Hammer Fists / Storm Surge / Chain Lightning without their ownFx, HERO_ULT_ART.fritz with its old plate, no FX1123_WARM.grosk / fritz, no SKP_OWNFX
// gfist / fstrike / fchain / fstorm - so the older FX, kit and whole-fight tests keep testing what they were written for (the cases fall back to their old art
// without the ownFx tags). Safe on any page. tests/test_grosk_fritz_fx_1217.js checks v1217 itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'grosk_fritz_fx_1217_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX)}, J=o=>JSON.parse(JSON.stringify(o));
  if(typeof FX2_DEF==='undefined'||!FX2_DEF.grosk_blue||!/grosk_hammer_fists_23oct/.test(FX2_DEF.grosk_blue.u||'')) return 0;   /* not a v1217 page: nothing to undo */
  for(const k in B.fx) FX2_DEF[k]=J(B.fx[k]);
  KITS.grosk.blue=J(B.groskBlue); KITS.fritz.green=J(B.fritzGreen); KITS.fritz.blue=J(B.fritzBlue); HERO_ULT_ART.fritz=J(B.ultArt);
  if(typeof FX1123_WARM!=='undefined'){ delete FX1123_WARM.grosk; delete FX1123_WARM.fritz; }
  if(typeof SKP_OWNFX!=='undefined'){ delete SKP_OWNFX.gfist; delete SKP_OWNFX.fstrike; delete SKP_OWNFX.fchain; delete SKP_OWNFX.fstorm; }
  return 1; })()`;
module.exports = { undoGroskFritzFx1217: run => run(CODE), FIX_GROSK_FRITZ_FX_1217: FIX };
