'use strict';
// v1189 Tessit's Hourglass (Grok s11, Phil approved 12 Oct 2026). undoTessit1189(run) takes the change back out of a loaded page - FX2_DEF.tessithourglass,
// its sheet warm (FX1123_WARM.tessit) and the ult's ownFx tag - so the FX, condense, slim and per-hero tests of earlier releases keep comparing with
// their own BASE. Safe on any page. tests/test_tessit_hourglass.js checks the change itself.
const CODE = `(()=>{ if(typeof FX2_DEF==='undefined'||!FX2_DEF.tessithourglass) return 0;   /* not a page with the change: nothing to undo */
  delete FX2_DEF.tessithourglass; if(typeof FX1123_WARM!=='undefined') delete FX1123_WARM.tessit;
  try{ delete HERO_ULT_ART.tessit.ownFx; }catch(e){} return 1; })()`;
module.exports = { undoTessit1189: run => run(CODE) };
