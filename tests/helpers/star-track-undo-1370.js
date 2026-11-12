'use strict';
// v1370 HERO STAR TRACK (Phil 11 Nov 2026: "make sure the stats they gain is flat, not percentage" / "All flat damage"; approved "push when
// caught up"): stars stopped MULTIPLYING a hero's base stats (old STAR_MULT 1.00 / 1.15 / 1.35 / 1.60 / 1.90 by stars and pips) and add FLAT
// Health / Attack / Ability power / Armor / Magic resist instead. Older tests that compare whole fights with a commit from before v1370
// (test_attack_copy vs 59eaefba, ...) put the OLD star rule back in the copy of this tree they run, the same way tests/helpers/global-1254-1260.js
// backs out the other later global changes - so they keep checking only what they were written for. tests/test_refine_mythical_1369.js and
// the power-parity tests check v1370 itself. Refine is taken as 0 (the old fixtures never refine). Each rewrite throws if its line is missing.
const one = (s, find, rep, what) => { const n = s.split(find).length - 1; if (n !== 1) throw Error('star-track-undo-1370: ' + what + ': expected one match, found ' + n); return s.replace(find, rep); };
const OLD_MULT = '_SM=[1,1.15,1.35,1.6,1.9], _lv=Math.max(1,Math.min(5,LV|0)), _p=Math.max(0,Math.min(5,PP|0))';
/* server/sim.js: the star multiplier back on base stats and Armor / MR (defScale), no star flats */
function undoSim(s) {
  s = one(s, 'const mul=1, defScale=1;', 'const ' + OLD_MULT.replace('LV', 'stars').replace('PP', 'pips') + '; const mul=_lv>=5?1.9:_SM[_lv-1]+(_SM[_lv]-_SM[_lv-1])*(_p/5), defScale=mul;   /* star-track-undo-1370 */', 'sim multiplier');
  s = one(s, 'const SF=starFlatFrom(stars,pips,ref);', 'const SF={hp:0,atk:0,apow:0,armor:0,mr:0};   /* star-track-undo-1370 */', 'sim flats');
  return s; }
/* server.js: the campaign / fight spec carries no star flats */
function undoServer(s) {
  const re = /const SF=SIM\.starFlatFrom\([^;]*\);/; if (!re.test(s)) throw Error('star-track-undo-1370: server spec flats not found');
  return s.replace(re, 'const SF={hp:0,atk:0,apow:0,armor:0,mr:0};   /* star-track-undo-1370 */'); }
/* emberweave-heroes.html: starMultFrom / starMult multiply again, starFlat is zero */
function undoPage(s) {
  s = one(s, 'function starMultFrom(lv,pip,rl){ return 1; }', 'function starMultFrom(lv,pip,rl){ const ' + OLD_MULT.replace('LV', 'lv').replace('PP', 'pip') + '; return _lv>=5?1.9:_SM[_lv-1]+(_SM[_lv]-_SM[_lv-1])*(_p/5); }   /* star-track-undo-1370 */', 'page starMultFrom');
  s = one(s, 'function starMult(key){ return 1; }', 'function starMult(key){ return starMultFrom(heroStars(key), starPips(key), 0); }', 'page starMult');
  s = one(s, 'function starFlat(key){ return starFlatFrom(heroStars(key), starPips(key), refineLevel(key)); }', 'function starFlat(key){ return {hp:0,atk:0,apow:0,armor:0,mr:0}; }', 'page starFlat');
  return s; }
module.exports = { undoSim, undoServer, undoPage };
