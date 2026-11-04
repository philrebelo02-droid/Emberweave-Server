'use strict';
// v1263 Hero 61 (3 Nov 2026) - a new hero, added after every older BASE. undoHero61_1263(run) takes it back out of a loaded page: BATTLE_ANIM.hero61,
// KITS.hero61, HERO_TYPES.hero61, FX2_DEF hero61_heal / hero61_bubble, FX16_ART h61green / h61blue / h61ult, FX1123_WARM.hero61, SFX_DATA.heroes.hero61 - the whole table
// footprint of v1263 (4 Nov 2026: a table diff of v1257 vs v1264 with the v1258 resize undone shows nothing else) - so the older "every other entry
// byte-for-byte BASE" checks keep testing what they were written for. Safe on any page (an older page has no hero61). Called only by the
// tests whose BASE checks walk every hero (not from the undo chain: newer tests count Hero 61); Hero 61's own tests check v1263 itself.
const CODE = `(()=>{ let n=0; const del=(T,k)=>{ if(T&&Object.prototype.hasOwnProperty.call(T,k)){ delete T[k]; n++; } };
  const g=name=>{ try{ return eval('typeof '+name+'!=="undefined"?'+name+':null'); }catch(e){ return null; } };
  del(g('BATTLE_ANIM'),'hero61'); del(g('KITS'),'hero61'); del(g('HERO_TYPES'),'hero61'); del(g('FX1123_WARM'),'hero61');
  del(g('FX2_DEF'),'hero61_heal'); del(g('FX2_DEF'),'hero61_bubble');
  const sfx=g('SFX_DATA'); if(sfx) del(sfx.heroes,'hero61');
  ['h61green','h61blue','h61ult'].forEach(k=>del(g('FX16_ART'),k));
  return n; })()`;
module.exports = { undoHero61_1263: run => run(CODE) };
