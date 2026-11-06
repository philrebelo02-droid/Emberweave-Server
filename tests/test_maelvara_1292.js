// v1292 (Phil 6 Nov, Maelvara the 7-10 boss): "She needs 15% more health. And her blue now should be 10 meters wide, and more damage
// by 15%" ("10 meters across total" = radius 5 m) / "her green does magic damage also. 30% extra damage per strike as magical".
// Checks the live engine source. Control: AUD_HTML=<the v1291 html> must FAIL.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.env.AUD_HTML || path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
const T = src.match(/\n  'maelvara':\{name:[^\n]*/), K = src.match(/\n  'maelvara':\{green:[^\n]*/);
const checks = [
  ['health +15% (300 -> 345)', T && /hp:345,/.test(T[0])],
  ['Cyclone Choir 10 m across (radius 5 m, effect matches)', K && /radius:5\*METER/.test(K[0]) && /featherstorm',gfxR:5\*METER/.test(K[0])],
  ['Cyclone Choir damage +15% (dps 0.5 -> 0.575)', K && /type:'ashfall',dps:0\.575,/.test(K[0])],
  ['Thunder Talons strikes add 30% as magic', K && /type:'punchflurry',hits:3,mul:0\.7,magicRider:0\.3,/.test(K[0])],
  ['the engine deals the rider as MAGIC damage (timed and instant flurries)', (src.match(/if\(o\.magicRider&&tg\.alive\) dealDamage\(u,tg,[^;]*\*o\.magicRider,'#b79bff','magic'\)/g) || []).length === 2],
  ['the skill text shows the magic hit', /ab\.magicRider\?' \+ '\+Math\.round/.test(src)]];
const bad = checks.filter(c => !c[1]).map(c => c[0]);
if (process.env.AUD_HTML) { console.log('CONTROL: ' + bad.length + ' check(s) failed as expected'); process.exit(bad.length ? 0 : 1); }
if (bad.length) { console.error('FAIL: ' + bad.join('; ')); process.exit(1); }
console.log('test_maelvara_1292.js: ' + checks.length + ' checks passed');
