'use strict';
// v1174 Hobb Kilnmask (eight) and Kharos Bloomknife (ten) - tests/fixtures/anim_hobb_kharos_1174_before.json. undoHK1174(run) puts what live v1173 had
// back in a loaded page - BATTLE_ANIM hobb / kharos, SFX_DATA heroes hobb / kharos, and no A / B alternation on Kharos - so the older per-hero, sound,
// slim and whole-fight tests keep testing what they were written for. Safe on any page. tests/test_hobb_kharos_1174.js checks v1174 itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'anim_hobb_kharos_1174_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX.before)};
  if(typeof BATTLE_ANIM==='undefined'||!BATTLE_ANIM.kharos||!/kharos_idle_\\d{4}\\.webp/.test(BATTLE_ANIM.kharos.idle.u)) return 0;   /* not a v1174 page: nothing to undo */
  BATTLE_ANIM.hobb=JSON.parse(JSON.stringify(B.anim.hobb)); BATTLE_ANIM.kharos=JSON.parse(JSON.stringify(B.anim.kharos));
  if(typeof SFX_DATA!=='undefined'&&SFX_DATA.heroes){ SFX_DATA.heroes.hobb=JSON.parse(JSON.stringify(B.sfx.hobb)); SFX_DATA.heroes.kharos=JSON.parse(JSON.stringify(B.sfx.kharos)); }
  if(typeof HERO_TYPES!=='undefined'&&HERO_TYPES.kharos) delete HERO_TYPES.kharos.autoAlt;
  return 1; })()`;
module.exports = { undoHK1174: run => run(CODE), FIX_HK_1174: FIX };
