'use strict';
// v1178 Brannus (eight + his three Grok spell FX) and Quorrel (eight) - tests/fixtures/anim_brannus_quorrel_1178_before.json. undoBQ1178(run) puts what
// live v1175 had back in a loaded page - BATTLE_ANIM brannus / quorrel, SFX_DATA heroes brannus / quorrel, FX2_DEF brannus_green / blue / ult, the kit's
// green / blue and HERO_ULT_ART.brannus without their ownFx, and no Brannus FX16 entries - so the older per-hero, sound, slim, FX and whole-fight tests keep
// testing what they were written for. Safe on any page. tests/test_brannus_quorrel_1178.js checks v1178 itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'anim_brannus_quorrel_1178_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX.before)}, J=o=>JSON.parse(JSON.stringify(o));
  if(typeof BATTLE_ANIM==='undefined'||!BATTLE_ANIM.brannus||!/brannus_idle_\\d{4}\\.webp/.test(BATTLE_ANIM.brannus.idle.u)) return 0;   /* not a v1178 page: nothing to undo */
  BATTLE_ANIM.brannus=J(B.anim.brannus); BATTLE_ANIM.quorrel=J(B.anim.quorrel);
  if(typeof SFX_DATA!=='undefined'&&SFX_DATA.heroes){ SFX_DATA.heroes.brannus=J(B.sfx.brannus); SFX_DATA.heroes.quorrel=J(B.sfx.quorrel); }
  for(const k in B.fx) FX2_DEF[k]=J(B.fx[k]);
  KITS.brannus.green=J(B.kit.green); KITS.brannus.blue=J(B.kit.blue); HERO_ULT_ART.brannus=J(B.ult);
  if(typeof FX16_ART!=='undefined'){ delete FX16_ART.bgreen; delete FX16_ART.bblue; delete FX16_ART.bult; }
  if(typeof FX1123_WARM!=='undefined') delete FX1123_WARM.brannus;
  if(typeof SKP_OWNFX!=='undefined'){ delete SKP_OWNFX.bgreen; delete SKP_OWNFX.bblue; delete SKP_OWNFX.bult; }
  return 1; })()`;
const UD = require('./death-1182.js'), UKF = require('./kharos-fx-1186.js'), UT = require('./tessit-hourglass-1189.js'), UN = require('./nox-magic-1194.js');   /* v1182: the four death states go back out too; v1186: Kharos's FX too; v1189: Tessit's Hourglass too; v1194: Nox's base AP and paths too (every caller of this helper compares with a BASE before them) */
module.exports = { undoBQ1178: run => { UD.undoDeath1182(run); UKF.undoKFX1186(run); UT.undoTessit1189(run); UN.undoNoxMagic1194(run); return run(CODE); }, FIX_BQ_1178: FIX };
