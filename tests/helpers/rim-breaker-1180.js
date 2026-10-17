'use strict';
// v1180 Rim Breaker - tests/fixtures/rim_breaker_1180_before.json. undoRim1180(run) puts what live v1178 had back in a loaded page - KITS.brannus.green
// (no pierce, the old text), FX2_DEF.brannus_green and FX16_ART.bgreen (the v1178 'side' art) - so tests/test_brannus_quorrel_1178.js keeps testing
// the v1178 release it was written for. Safe on any page. tests/test_rim_breaker_1180.js checks v1180 itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'rim_breaker_1180_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX.before)}, J=o=>JSON.parse(JSON.stringify(o));
  if(typeof KITS==='undefined'||!KITS.brannus||!KITS.brannus.green||!KITS.brannus.green.pierce) return 0;   /* not a v1180 page: nothing to undo */
  KITS.brannus.green=J(B.kit); FX2_DEF.brannus_green=J(B.fx); if(typeof FX16_ART!=='undefined') FX16_ART.bgreen=J(B.art);
  return 1; })()`;
module.exports = { undoRim1180: run => { require('./kharos-fx-1186.js').undoKFX1186(run); return run(CODE); }, FIX_RIM_1180: FIX };   // v1186: Kharos's FX back too
