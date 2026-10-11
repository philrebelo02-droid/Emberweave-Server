'use strict';
// v1120 (Phil 10 Oct 2026: "on my desktop and phone it lags in battle" / keep the full-size sheets - load everything before the fight):
//   1. the loading screen's spell list also takes the auto-attack ball (CASTER_BALL), Fritz's chain bolt and the shared void zone;
//   2. FX plates draw from ONE shared texture per sheet (a clone per cast was a fresh GPU upload mid-fight in three r128) and
//      a plate ending never disposes the shared sheet;
//   3. the hero-sheet gate and the spell warm-up wait while sheets are still arriving (stall timers), with a 45 s ceiling.
// Control: the same checks against the v1119 file (git c17fb592) must fail.
const path = require('path'), vm = require('vm'), fs = require('fs'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'emberweave-heroes.html');
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };

function keysOf(file, keys) {
  const host = require(path.join(ROOT, 'server/sim-host.js')).load(file);
  return JSON.parse(vm.runInContext('JSON.stringify(fxSheetKeys(' + JSON.stringify(keys) + '))', host.ctx));
}
function checks(file) {
  const src = fs.readFileSync(file, 'utf8');
  const r = {};
  const lumi = keysOf(file, ['lumi']), fritz = keysOf(file, ['fritz']), syl = keysOf(file, ['sylthaine']), none = keysOf(file, []);
  r.lumiBall = lumi.includes('natureball');
  r.frostBall = syl.includes('frostball');
  r.fritzBolt = fritz.includes('__fritzbolt') && fritz.includes('fritz_showerfx');
  r.voidzone = lumi.includes('voidzone') && !none.includes('voidzone');
  const sp = src.slice(src.indexOf('function spawnFxPlate('), src.indexOf('function updateFxPlates('));
  r.sharedTex = sp.length > 0 && !/base\.clone\(\)/.test(sp) && /const tex=base;/.test(sp) && /fx2Hook\(spr\)/.test(sp) && /sharedMap=true/.test(sp);
  r.noDisposeShared = (src.match(/material\.map&&!p\.spr\.userData\.sharedMap\)/g) || []).length === 3
    && !/if\(p\.spr\.material\.map\)p\.spr\.material\.map\.dispose\(\)/.test(src);
  const fw = src.slice(src.indexOf('function fxWarmKeys('), src.indexOf('function fxFreeAll('));
  r.fxStall = /performance\.now\(\)-tProg>cap/.test(fw) && /45000/.test(fw);
  const pf = src.slice(src.indexOf('function preloadBattleArtFull('), src.indexOf('function preloadBattleArtFull(') + 2600);
  r.heroStall = /const arm=\(\)=>/.test(pf) && /else arm\(\)/.test(pf) && /setTimeout\(finish, 45000\)/.test(pf);
  return r;
}

const now = checks(FILE);
ck('Lumi\'s auto-attack nature ball is on the loading list', now.lumiBall);
ck('Sylthaine\'s frost ball is on the loading list', now.frostBall);
ck('Fritz\'s chain bolt (and storm shower) are on the loading list', now.fritzBolt);
ck('the shared void zone is loaded for any fight, not for an empty one', now.voidzone);
ck('FX plates draw from the one shared sheet (no clone per cast)', now.sharedTex);
ck('a plate ending never disposes the shared sheet (all 3 clean-up sites)', now.noDisposeShared);
ck('spell warm-up waits while sheets arrive (stall cap) with a 45 s ceiling', now.fxStall);
ck('hero-sheet gate re-arms on every sheet that lands, 45 s ceiling', now.heroStall);

// CONTROL: v1119 must fail every one of these
let old = null;
try {
  const tmp = path.join(ROOT, '.ew_v1119_ctl_' + process.pid + '.html');   // beside the real file: sim-host loads its sibling scripts
  fs.writeFileSync(tmp, cp.execSync('git show c17fb592:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 1 << 30 }));
  try { old = checks(tmp); } finally { fs.unlinkSync(tmp); }
} catch (e) { console.log('  control error: ' + e.message); old = null; }
if (old) ck('CONTROL: the v1119 file fails all eight checks', Object.values(old).every(v => v === false), JSON.stringify(old));
else console.log('  skip CONTROL (git history not available)');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail);
