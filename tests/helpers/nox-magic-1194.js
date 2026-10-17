'use strict';
// v1194 Nox to magic assassin gear. undoNoxMagic1194(run) takes the engine side back out of a loaded page - HERO_TYPES.nox's base Ability Power
// (none before) and the merged profile paths (assassin_other) - so the older whole-fight and per-hero tests keep comparing with their own BASE.
// Safe on any page. tests/test_nox_magic_gear_1194.js checks the change itself.
const CODE = `(()=>{ if(typeof HERO_TYPES==='undefined'||!HERO_TYPES.nox||HERO_TYPES.nox.apow!==31) return 0;   /* not a page with the change */
  delete HERO_TYPES.nox.apow; HERO_TYPES.nox.glyphPath='assassin_other'; HERO_TYPES.nox.equipmentPath='assassin_other';
  try{ if(typeof HERO_PROFILES!=='undefined'&&HERO_PROFILES.nox&&HERO_PROFILES.nox!==HERO_TYPES.nox){ HERO_PROFILES.nox.glyphPath='assassin_other'; HERO_PROFILES.nox.equipmentPath='assassin_other'; } }catch(e){}
  return 1; })()`;
module.exports = { undoNoxMagic1194: run => run(CODE) };
