'use strict';
// v1218 Grosk's Gravemaw Pull air pull (Phil approved 23 Oct 2026) - tests/fixtures/grosk_gravemaw_1218_before.json. undoGroskGravemaw1218(run) puts what
// live v1217 (09c717c7) had back in a loaded page - FX2_DEF.grosk_green (the old plate), Gravemaw Pull without its ownFx, FX1123_WARM.grosk without
// grosk_green, no SKP_OWNFX.gpull - so the older FX, kit and whole-fight tests keep testing what they were written for. Safe on any page.
// tests/test_gravemaw_fx_1218.js checks v1218 itself. Called first by tests/helpers/grosk-fritz-fx-1217.js (the release before it).
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'grosk_gravemaw_1218_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX)}, J=o=>JSON.parse(JSON.stringify(o));
  if(typeof FX2_DEF==='undefined'||!FX2_DEF.grosk_green||!/grosk_gravemaw_pull_23oct/.test(FX2_DEF.grosk_green.u||'')) return 0;   /* not a v1218 page: nothing to undo */
  FX2_DEF.grosk_green=J(B.fx.grosk_green); KITS.grosk.green=J(B.groskGreen);
  if(typeof FX1123_WARM!=='undefined') FX1123_WARM.grosk=J(B.warm);
  if(typeof SKP_OWNFX!=='undefined') delete SKP_OWNFX.gpull;
  return 1; })()`;
module.exports = { undoGroskGravemaw1218: run => run(CODE), FIX_GROSK_GRAVEMAW_1218: FIX };
