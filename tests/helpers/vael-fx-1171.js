'use strict';
// Vael's and Deepcleft's three spell FX each (Grok, Phil approved 16 Oct 2026; tests/fixtures/vael_fx_1171_before.json). The FX, condense, slim and per-hero tests of
// earlier releases compare the page with their own BASE. undoVaelFx1171(run) puts what live v1163 had for the entries this change replaced back in a
// loaded page - FX2_DEF.vael_* / deepcleft_* (green, blue, ult) and the six ownFx display tags (KITS green / blue, HERO_ULT_ART) - so those
// checks keep testing what they were written for. On a q95 test view of the page (tests/helpers/q95-1158.js page(): every q95 URL put back to its
// v1157 ?v=) the restored entries get the same inverse, so they read as that view of v1163 would. tests/test_vael_deepcleft_fx_1171.js checks the change itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'vael_fx_1171_before.json'), 'utf8'));
const Q = require('./q95-1158.js');
const probe = Q.Q95.sheets.map(e => e.path + '?v=1158');
function undoVaelFx1171(run) { require('./mirelle-fx-1172.js').undoMirelleFx1172(run);   // v1172: Mirelle's entries (replaced after this release) go back too
  const q95view = run(`(()=>{ const s=JSON.stringify(FX2_DEF)+JSON.stringify(BATTLE_ANIM); return !${JSON.stringify(probe)}.some(u=>s.indexOf(u)>=0); })()`) === true;
  const B = q95view ? JSON.parse(Q.undoText(JSON.stringify(FIX.fx))) : FIX.fx;
  return run(`(()=>{ const B=${JSON.stringify(B)};
    if(typeof FX2_DEF==='undefined'||!FX2_DEF.vael_green||!/vael_warcry_16oct/.test(FX2_DEF.vael_green.u||'')) return 0;   /* not a page with the change: nothing to undo */
    for(const k in B) FX2_DEF[k]=JSON.parse(JSON.stringify(B[k]));
    try{ delete KITS.vael.green.ownFx; delete KITS.vael.blue.ownFx; delete HERO_ULT_ART.vael.ownFx; delete KITS.deepcleft.green.ownFx; delete KITS.deepcleft.blue.ownFx; delete HERO_ULT_ART.deepcleft.ownFx; }catch(e){}
    if(typeof FX1123_WARM!=='undefined'){ delete FX1123_WARM.vael; delete FX1123_WARM.deepcleft; }
    return 1; })()`); }
module.exports = { undoVaelFx1171, FIX_VAEL_FX_1171: FIX };
