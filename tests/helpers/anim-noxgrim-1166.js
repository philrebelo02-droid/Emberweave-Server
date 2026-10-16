'use strict';
// v1166 Nox (eight animations + Phil's ranged magic change) and Grimsby (seven animations) - tests/fixtures/anim_noxgrim_1166_before.json.
// The per-hero, sound, slim and whole-fight tests of earlier releases compare the page with their own BASE. undoNoxGrim1166(run) puts what
// live v1164 had back in a loaded page - BATTLE_ANIM nox / grimsby, SFX_DATA heroes nox / grimsby, and Nox's melee Attack-damage line
// (HERO_TYPES.nox range 26, no rangeHold, damageProfile Attack / Attack Damage, no CASTER_BALL entry; his passive clip goes with his
// BATTLE_ANIM entry, so the fifth key fires none) - so those checks keep testing what they were written for. Call it on their BASE page
// too: an older page loaded from this checkout reads this checkout's hero-profiles.js (Nox Magic) - the profile half runs on any page.
// tests/test_nox_grimsby_anims.js and tests/test_nox_ranged_1166.js check v1166 itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'anim_noxgrim_1166_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX.before)};
  /* the profile half runs on ANY page: an older BASE page loaded from this checkout reads THIS hero-profiles.js (Magic) - it goes back too */
  if(typeof HERO_TYPES!=='undefined'&&HERO_TYPES.nox){ HERO_TYPES.nox.damageProfile=B.hero.nox.damageProfile; HERO_TYPES.nox.primaryScaling=B.hero.nox.primaryScaling; }
  if(typeof BATTLE_ANIM==='undefined'||!BATTLE_ANIM.nox||!/nox_idle_\\d{4}\\.webp/.test(BATTLE_ANIM.nox.idle.u)) return 0;   /* not a v1166 page: nothing else to undo */
  BATTLE_ANIM.nox=JSON.parse(JSON.stringify(B.anim.nox)); BATTLE_ANIM.grimsby=JSON.parse(JSON.stringify(B.anim.grimsby));
  if(typeof SFX_DATA!=='undefined'&&SFX_DATA.heroes){ SFX_DATA.heroes.nox=JSON.parse(JSON.stringify(B.sfx.nox)); SFX_DATA.heroes.grimsby=JSON.parse(JSON.stringify(B.sfx.grimsby)); }
  const t=HERO_TYPES.nox; t.range=B.hero.nox.range; delete t.rangeHold; t.damageProfile=B.hero.nox.damageProfile; t.primaryScaling=B.hero.nox.primaryScaling;
  if(typeof CASTER_BALL!=='undefined') delete CASTER_BALL.nox;
  return 1; })()`;
module.exports = { undoNoxGrim1166: run => run(CODE), FIX_NOXGRIM_1166: FIX };
