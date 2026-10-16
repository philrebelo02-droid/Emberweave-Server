'use strict';
// Mirelle's three spell FX (Grok, Phil approved 16 Oct 2026; tests/fixtures/mirelle_fx_1172_before.json). Tests of earlier releases compare the page
// with their own BASE. undoMirelleFx1172(run) puts what the live build before this change had back in a loaded page - FX2_DEF.mirelle_green /
// mirelle_blue / mirelle_ult and the two ownFx display tags (KITS.mirelle green / blue) - so those checks keep testing what they were written for.
// On a q95 test view of the page (tests/helpers/q95-1158.js page()) the restored entries get the same inverse. tests/test_mirelle_fx_1172.js checks
// the change itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'mirelle_fx_1172_before.json'), 'utf8'));
const Q = require('./q95-1158.js');
const probe = Q.Q95.sheets.map(e => e.path + '?v=1158');
function undoMirelleFx1172(run) {
  const q95view = run(`(()=>{ const s=JSON.stringify(FX2_DEF)+JSON.stringify(BATTLE_ANIM); return !${JSON.stringify(probe)}.some(u=>s.indexOf(u)>=0); })()`) === true;
  const B = q95view ? JSON.parse(Q.undoText(JSON.stringify(FIX.fx))) : FIX.fx;
  return run(`(()=>{ const B=${JSON.stringify(B)};
    if(typeof FX2_DEF==='undefined'||!FX2_DEF.mirelle_green||!/mirelle_scent_of_courage_16oct/.test(FX2_DEF.mirelle_green.u||'')) return 0;   /* not a page with the change */
    for(const k in B) FX2_DEF[k]=JSON.parse(JSON.stringify(B[k]));
    try{ delete KITS.mirelle.green.ownFx; delete KITS.mirelle.blue.ownFx; }catch(e){}
    return 1; })()`); }
module.exports = { undoMirelleFx1172, FIX_MIRELLE_FX_1172: FIX };
