'use strict';
// v@@VER@@ @@NAME@@ (tools/integrate_hero.py wire) - tests/fixtures/anim_@@HERO@@_@@VER@@_before.json. @@UNDO@@(run) puts what BASE @@BASE@@ had back
// in a loaded page - BATTLE_ANIM.@@HERO@@, SFX_DATA.heroes.@@HERO@@ and HERO_TYPES.@@HERO@@.autoAlt - so the older per-hero, sound, slim and
// whole-fight tests keep testing what they were written for. Safe on any page. tests/test_@@HERO@@_anim_@@VER@@.js checks v@@VER@@ itself.
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'anim_@@HERO@@_@@VER@@_before.json'), 'utf8'));
const CODE = `(()=>{ const B=${JSON.stringify(FIX.before)};
  if(typeof BATTLE_ANIM==='undefined'||!BATTLE_ANIM.@@HERO@@||!/@@HERO@@_idle_@@VER@@\\.webp/.test((BATTLE_ANIM.@@HERO@@.idle||{}).u||'')) return 0;   /* not a v@@VER@@ page: nothing to undo */
  if(B.anim) BATTLE_ANIM.@@HERO@@=JSON.parse(JSON.stringify(B.anim)); else delete BATTLE_ANIM.@@HERO@@;
  if(typeof SFX_DATA!=='undefined'&&SFX_DATA.heroes&&B.sfx) SFX_DATA.heroes.@@HERO@@=JSON.parse(JSON.stringify(B.sfx));
  if(typeof HERO_TYPES!=='undefined'&&HERO_TYPES.@@HERO@@&&B.type){ if(B.type.autoAlt) HERO_TYPES.@@HERO@@.autoAlt=B.type.autoAlt; else delete HERO_TYPES.@@HERO@@.autoAlt; }
  return 1; })()`;
module.exports = { @@UNDO@@: run => run(CODE), FIX: FIX };
