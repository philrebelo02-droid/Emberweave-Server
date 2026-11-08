// v1311 (Phil 8 Nov 2026: "check this game wide, for effects accidentally earning multiple gains" - the stat audit): Hollow's base
// Attack was 36 in the client (v1144, 15 Oct: 40 -> 36) but still 40 in server/sim.js HERO_BASE, so the server priced his card and ran
// his server-side fights on the old number. Every hero's base hp / dmg / apow / atkSpeed / stars must be the SAME on both sides.
// CONTROL: the live v1310 server/sim.js (git show 67ecbab6) has Hollow at 40.
const path = require('path'), vm = require('vm'), cp = require('child_process'), fs = require('fs'), os = require('os');
const ROOT = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const ck = (n, c, x) => { if (c) { PASS++; console.log('  ok   ' + n); } else { FAIL++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const host = require(path.join(ROOT, 'server', 'sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const HT = JSON.parse(vm.runInContext('JSON.stringify(HERO_TYPES)', host.ctx));
const base = file => require(file).HERO_BASE;
const NOW = base(path.join(ROOT, 'server', 'sim.js'));
const KEYS = ['hp', 'dmg', 'apow', 'atkSpeed', 'stars'];
const diff = B => Object.keys(B).filter(k => HT[k]).flatMap(k => KEYS.filter(f => B[k][f] != null && HT[k][f] != null && +B[k][f] !== +HT[k][f]).map(f => k + '.' + f + ' client ' + HT[k][f] + ' server ' + B[k][f]));
const d = diff(NOW);
ck('every hero in server HERO_BASE has the client base stats (' + KEYS.join(', ') + ')', d.length === 0, d);
ck('Hollow base Attack is 36 on both sides (v1144)', HT.hollow.dmg === 36 && NOW.hollow.dmg === 36, { client: HT.hollow.dmg, server: NOW.hollow.dmg });
const oldSim = path.join(ROOT, 'server', '.test-1311-sim-live.js'); process.on('exit', () => { try { fs.unlinkSync(oldSim); } catch (e) {} });
fs.writeFileSync(oldSim, cp.execSync('git show 67ecbab6:server/sim.js', { cwd: ROOT, maxBuffer: 64 << 20 }));
let ctl = []; try { ctl = diff(base(oldSim)); } catch (e) { ctl = ['load failed: ' + e.message.slice(0, 80)]; }
ck('CONTROL: live v1310 server/sim.js differs (Hollow dmg 40)', ctl.some(x => x.startsWith('hollow.dmg')), ctl);
console.log('test_hero_base_parity_1311.js: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
