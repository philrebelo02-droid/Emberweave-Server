'use strict';
// Hollow's spell FX and his natural-draw green clip (v1191, Phil approved 16 Oct 2026; tests/fixtures/hollow_fx_1191_before.json). Tests of earlier
// releases compare the page with their own BASE. undoHollowFx1191(run) puts what the live build before this change had back in a loaded page -
// FX2_DEF.hollow_green / hollow_blue / hollow_ult, BATTLE_ANIM.hollow.green, HERO_ULT_ART.hollow, and drops the two ownFx display tags (KITS.hollow
// green / blue) and FX1123_WARM.hollow - so those checks keep testing what they were written for. On a q95 test view of the page
// (tests/helpers/q95-1158.js page()) the restored entries get the same inverse. tests/test_hollow_fx_1191.js checks the change itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'hollow_fx_1191_before.json'), 'utf8'));
const Q = require('./q95-1158.js');
const probe = Q.Q95.sheets.map(e => e.path + '?v=1158');
function undoHollowFx1191(run) {
  const q95view = run(`(()=>{ const s=JSON.stringify(FX2_DEF)+JSON.stringify(BATTLE_ANIM); return !${JSON.stringify(probe)}.some(u=>s.indexOf(u)>=0); })()`) === true;
  const inv = o => q95view ? JSON.parse(Q.undoText(JSON.stringify(o))) : o;
  const B = inv(FIX.fx), A = inv(FIX.anim);
  return run(`(()=>{ const B=${JSON.stringify(B)}, A=${JSON.stringify(A)}, U=${JSON.stringify(FIX.ultArt)};
    if(typeof FX2_DEF==='undefined'||!FX2_DEF.hollow_blue||!/hollow_lacerate_16oct/.test(FX2_DEF.hollow_blue.u||'')) return 0;   /* not a page with the change */
    for(const k in B) FX2_DEF[k]=JSON.parse(JSON.stringify(B[k]));
    if(typeof BATTLE_ANIM!=='undefined'&&BATTLE_ANIM.hollow) for(const k in A) BATTLE_ANIM.hollow[k]=JSON.parse(JSON.stringify(A[k]));
    try{ HERO_ULT_ART.hollow=JSON.parse(JSON.stringify(U)); }catch(e){}
    try{ delete KITS.hollow.green.ownFx; delete KITS.hollow.blue.ownFx; }catch(e){}
    if(typeof FX1123_WARM!=='undefined') delete FX1123_WARM.hollow;
    if(typeof FX16_ART!=='undefined'){ delete FX16_ART.hfan; delete FX16_ART.hlacer; delete FX16_ART.hvoid; }   /* the three FX16 keys this change added */
    return 1; })()`); }
module.exports = { undoHollowFx1191, FIX_HOLLOW_FX_1191: FIX };
