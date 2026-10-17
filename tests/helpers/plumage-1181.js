'use strict';
// v1181 Imperial Plumage small (Phil 16 Oct: "make her feather burst small"): FX2_DEF.mirelle_ult gained badgeH 0.45. Tests of earlier releases that
// compare the whole FX2_DEF with their own BASE call undoPlumage1181(run) to take that one field back off (tests/test_fx_facing_plumage_1181.js checks it).
function undoPlumage1181(run) { return run(`(()=>{ if(typeof FX2_DEF==='undefined'||!FX2_DEF.mirelle_ult||!(FX2_DEF.mirelle_ult.badgeH>0)) return 0; delete FX2_DEF.mirelle_ult.badgeH; return 1; })()`); }
module.exports = { undoPlumage1181 };
