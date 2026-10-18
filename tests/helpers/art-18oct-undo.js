'use strict';
// ChatGPT's approved art of 18 Oct 2026 (Iver, Joss and Ambrel remakes incl. Ambrel's new death; Grok's seven FX for Aureth, Aldren and Joss) -
// tests/fixtures/art_18oct_before.json. undoArt18Oct(run) puts what live v1199 (0dc64490) had back in a loaded page: BATTLE_ANIM.iver / joss / ambrel,
// the seven FX2_DEF entries, KITS.aldren / aureth / joss and HERO_ULT_ART.aureth / joss (their ownFx routing), and drops the seven new FX16_ART keys - so the
// older FX, kit, clip and whole-fight tests keep testing what they were written for. Safe on any page. tests/test_iver_art_18oct.js, test_joss_art_18oct.js,
// test_ambrel_art_18oct.js and test_spell_fx_18oct.js check the change itself. (Joss's Unbroken now plays his passive clip: updateBattle's line stays; a fight
// without his passive sheet runs the old branch, so his clip goes with BATTLE_ANIM.joss.)
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'art_18oct_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX)}, J=o=>JSON.parse(JSON.stringify(o));
  if(typeof FX16_ART==='undefined'||!FX16_ART.jhammer) return 0;   /* not a page with the 18 Oct art: nothing to undo */
  for(const k in B.anim) BATTLE_ANIM[k]=J(B.anim[k]);
  for(const k in B.fx){ if(B.fx[k]==null) delete FX2_DEF[k]; else FX2_DEF[k]=J(B.fx[k]); }
  for(const k in B.kits) KITS[k]=J(B.kits[k]);
  for(const k in B.ult) HERO_ULT_ART[k]=J(B.ult[k]);
  B.fx16new.forEach(k=>{ delete FX16_ART[k]; });
  return 1; })()`;
module.exports = { undoArt18Oct: run => run(CODE), FIX_ART_18OCT: FIX };
