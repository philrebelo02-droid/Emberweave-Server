// v1369 HERO STAR TRACK (Phil 11 Nov 2026: "make sure the stats they gain is flat, not percentage" / "All flat damage" / "yes add it" /
// "increase the power slightly then"; approved "push when caught up"): stars no longer MULTIPLY a hero's base stats - every star, pip and
// star-track step adds FLAT Health / Attack / Ability power / Armor / Magic resist (server/sim.js STAR_FLAT, starFlatFrom).
// Power tests that compare this build with an older live page (test_power_terms_1311, test_power_gear_terms_1316) price the SAME change on
// both sides through this helper: it rewrites the old page's star code to the v1369 flat track, so every other difference those tests
// measure (fury, Academy, gear terms) is still compared byte for byte. The flat numbers come from server/sim.js - this build's intended
// values. The old pages carry the OLD 0-15 refine scale, so the rewrite prices refine 0 only (every fixture in those tests is refine 0).
'use strict';
const path = require('path');
const SIM = require(path.join(__dirname, '..', '..', 'server', 'sim.js'));
const REPL = [
  [/function starMultFrom\(lv,pip,rl\)\{ lv=Math\.max\(1,lv\|0\);[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*smooth across refine steps/,
    () => 'function starMultFrom(lv,pip,rl){ return 1; }   /* v1369 star track (tests/helpers/star-track-1369.js) */\n' +
      'const STAR_FLAT_1369=' + JSON.stringify(SIM.STAR_FLAT) + ', STAR_FLAT_KEYS_1369=' + JSON.stringify(SIM.STAR_FLAT_KEYS) + ';\n' +
      'function starFlat1369(key){ const lv=Math.max(1,Math.min(MAX_STARS,heroStars(key)|0)), p=Math.max(0,Math.min(STAR_PIPS,starPips(key)|0)), o={};\n' +
      '  for(const k of STAR_FLAT_KEYS_1369){ const a=STAR_FLAT_1369[lv-1][k], b=lv<MAX_STARS?STAR_FLAT_1369[lv][k]:a; o[k]=Math.round(a+(b-a)*(lv<MAX_STARS?p/STAR_PIPS:0)); } return o; }'],
  ['function starMult(key){ return starMultFrom(heroStars(key), starPips(key), refineLevel(key)); }', () => 'function starMult(key){ return 1; }'],
  ['function heroFlatAtk(key){ return (sockStatTotal(key).atk||0); }', () => 'function heroFlatAtk(key){ return (sockStatTotal(key).atk||0)+starFlat1369(key).atk; }'],
  ['function heroFlatHp(key){ return (sockStatTotal(key).hp||0); }', () => 'function heroFlatHp(key){ return (sockStatTotal(key).hp||0)+starFlat1369(key).hp; }'],
  ['function heroFlatApow(key){ return (sockStatTotal(key).apow||0); }', () => 'function heroFlatApow(key){ return (sockStatTotal(key).apow||0)+starFlat1369(key).apow; }'],
  ["  const armor= heroStat(key,t.armor||0,'armor') + (typeof techArmorFlat==='function'?techArmorFlat():0) + (tt.armor||0)*3 + TBF.armorFlat;",
    () => "  const armor= heroStat(key,t.armor||0,'armor') + (typeof techArmorFlat==='function'?techArmorFlat():0) + starFlat1369(key).armor + (tt.armor||0)*3 + TBF.armorFlat;"],
  ["  const mr   = heroStat(key,t.mr||0,'mr')       + (typeof techMrFlat==='function'?techMrFlat():0)    + (tt.mr||0)*3 + TBF.mrFlat;",
    () => "  const mr   = heroStat(key,t.mr||0,'mr')       + (typeof techMrFlat==='function'?techMrFlat():0)    + starFlat1369(key).mr + (tt.mr||0)*3 + TBF.mrFlat;"],
  ['    u.armorRating=BL.armor*sm + (S?(S.techArmor||0):(owned?techArmorFlat():0)) + ((tt.armor||0)*3) + TBF.armorFlat;',
    () => '    u.armorRating=BL.armor*sm + (S?(S.techArmor||0):(owned?techArmorFlat()+starFlat1369(key).armor:0)) + ((tt.armor||0)*3) + TBF.armorFlat;'],
  ['    u.mrRating   =BL.mr*sm + (S?(S.techMr||0):(owned?techMrFlat():0)) + ((tt.mr||0)*3) + TBF.mrFlat;',
    () => '    u.mrRating   =BL.mr*sm + (S?(S.techMr||0):(owned?techMrFlat()+starFlat1369(key).mr:0)) + ((tt.mr||0)*3) + TBF.mrFlat;'],
];
/* the old page source with the v1369 flat star track; throws if any expected line is missing (a silent no-op would hide a baseline drift) */
function starTrackPage(src) {
  let s = String(src).replace(/\r\n/g, '\n');
  for (const [find, rep] of REPL) {
    const hit = typeof find === 'string' ? s.split(find).length - 1 : (s.match(new RegExp(find.source, 'g')) || []).length;
    if (hit !== 1) throw Error('star-track-1369: expected one match, got ' + hit + ' for ' + String(find).slice(0, 80));
    s = typeof find === 'string' ? s.replace(find, rep()) : s.replace(find, rep()); }
  return s.replace(/\n/g, '\r\n'); }
module.exports = { starTrackPage };
