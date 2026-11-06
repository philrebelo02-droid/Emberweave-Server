'use strict';
// 4 Nov 2026: three global engine changes of 2 Nov make every older "same as BASE" fight / table check fail although nothing they protect moved:
//   v1254 (acc1571f): every PvE enemy's base stats x ENEMY_NERF (0.95) in campaign / elite / province / well / vault / dungeon / graid / raid;
//   v1258 (1eaa3a21): every fighter UNIT_SIZE (1.15) bigger and every battle distance follows - METER, unit radius, range, reach, row hold, speed
//                     and the raw table distances are all written as x UNIT_SIZE (tests/test_size_1258.js checks the resize itself);
//   v1260 (8f58bdf2): after a wave's walk-in everyone stands on their spot WAVE_READY_HOLD (0.7 s, sim time) before the fight starts;
//   v1283: every released Green/Blue cast gives SPELL_ENERGY (11) energy, like an auto-attack (Phil 5 Nov).
// The tests of earlier releases compare the live engine with a BASE from before them (kit / stat / ULT_DEF tables, seeded fights tick-for-tick).
//   page(htmlPath) -> a copy of the page with ENEMY_NERF set to 1, UNIT_SIZE to 1 and WAVE_READY_HOLD to 0 - the inverse of all three (checked
//                     4 Nov: the v1254 .. v1264 pages with this rewrite pass the BASE comparisons the v1253 page passed), so "nothing but those
//                     changed since BASE" is still what the older tests check
//   undoText(s)    -> the same rewrite on a source string (safe on an older page, and on one already rewritten)
const fs = require('fs'), path = require('path');
const SWAPS = [
  ['const ENEMY_NERF=0.95,', 'const ENEMY_NERF=1,', /const ENEMY_NERF\s*=/],
  ['const UNIT_SIZE=1.15;', 'const UNIT_SIZE=1;', /const UNIT_SIZE\s*=/],
  ['const WAVE_READY_HOLD=0.7;', 'const WAVE_READY_HOLD=0;', /const WAVE_READY_HOLD\s*=/],
  ['const SPELL_ENERGY=11;', 'const SPELL_ENERGY=0;', /const SPELL_ENERGY\s*=/],
  ["type:'hot',hps:0.06,dur:6,cd:7,gfx:'oakmir_green'", "type:'hot',hps:0.06,dur:6,cd:6,gfx:'oakmir_green'", /hps:0\.06,dur:6,cd:\d+,gfx:'oakmir_green'/],   // v1287 (5 Nov, tester via Phil): Oakmir Green cd 6 -> 7
  ["mul:0.22,cd:10,gfx:'oakmir_blue'", "mul:0.22,cd:9,gfx:'oakmir_blue'", /mul:0\.22,cd:\d+,gfx:'oakmir_blue'/],
  ["locked:true,start:2,source:'arena',signinSlot:true}", "locked:true,start:2}", /locked:true,start:2,source:'arena',signinSlot:true\}/],
  ["   gruel:  {name:'Gruel',emoji:'🪙',role:'Tank',swing:2.6,stars:1,hp:560,dmg:26,range:30,speed:55,atkSpeed:0.85,color:0xb9a06a,abilityName:'The Reckoning',ability:'taunt',locked:true,start:1},", "   gruel:  {name:'Gruel',emoji:'🪙',role:'Tank',swing:2.6,stars:2,hp:560,dmg:26,range:30,speed:55,atkSpeed:0.85,color:0xb9a06a,abilityName:'The Reckoning',ability:'taunt',locked:true,start:2},", /gruel:\s*\{name:'/],   // v1289: gruel 2 -> 1 star (Phil 5 Nov)
  ["   sorrel:{name:'Sorrel',emoji:'🃏',role:'Assassin',swing:1.9,stars:1,hp:230,dmg:40,apow:0,range:190,speed:77,atkSpeed:0.95,color:0x6a5a8a,abilityName:'Grand Reveal',ability:'volley',locked:true,start:1},", "   sorrel:{name:'Sorrel',emoji:'🃏',role:'Assassin',swing:1.9,stars:2,hp:230,dmg:40,apow:0,range:190,speed:77,atkSpeed:0.95,color:0x6a5a8a,abilityName:'Grand Reveal',ability:'volley',locked:true,start:2},", /sorrel:\s*\{name:'/],   // v1289: sorrel 2 -> 1 star (Phil 5 Nov)
  ["   yenna:{name:'Yenna Cacklefang',emoji:'🐺',role:'Marksman',swing:1.8,stars:1,hp:245,dmg:36,range:215,speed:75,atkSpeed:1.0,color:0x8a7a4a,abilityName:'Crescent Stampede',ability:'multiShot',locked:true,start:1},", "   yenna:{name:'Yenna Cacklefang',emoji:'🐺',role:'Marksman',swing:1.8,stars:2,hp:245,dmg:36,range:215,speed:75,atkSpeed:1.0,color:0x8a7a4a,abilityName:'Crescent Stampede',ability:'multiShot',locked:true,start:2},", /yenna:\s*\{name:'/],   // v1289: yenna 2 -> 1 star (Phil 5 Nov)
  ];   // v1287: Zahri is an Arena hero (Phil 5 Nov)   // v1287: Oakmir Blue cd 9 -> 10   // v1283 (5 Nov): +11 energy per released Green/Blue cast, every hero
const made = [];
process.on('exit', () => { for (const f of made) { try { fs.unlinkSync(f); } catch (e) {} } });
function undoText(s) {
  for (const [from, to, any] of SWAPS) {
    const n = s.split(from).length - 1;
    if (n === 0 && (!any.test(s) || s.split(to).length === 2)) continue;   /* a page from before the change, or one already undone */
    if (n !== 1) throw new Error('global-1254-1260: expected exactly one "' + from + '" in the page, found ' + n);
    s = s.replace(from, to); }
  return s; }
function page(htmlPath) {
  const out = path.join(path.dirname(htmlPath), '.test-global1260-page-' + process.pid + '-' + made.length + '.html');
  fs.writeFileSync(out, undoText(fs.readFileSync(htmlPath, 'utf8'))); made.push(out); return out; }
module.exports = { page, undoText };
