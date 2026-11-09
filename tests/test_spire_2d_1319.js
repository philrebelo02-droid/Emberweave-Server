// v1319 (Phil 9 Nov 2026: "2d yes" / "swap all heroes in spire to 2d" / "The 3d project for spire will be done on the side, and only swap
// back if i OK all 61 heroes"): the Spire roster sends every hero playable with its own 2D battle sheets and no 3D model; SURV_MODELS is kept
// for the side project behind SURV_3D_ON (false). The frame draws the hero from those sheets. CONTROL: live v1318 (git show 3074e375).
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1319-spire.html');
fs.writeFileSync(oldFile, cp.execSync('git show 3074e375:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const R = (h, c) => JSON.parse(vm.runInContext(c, h.ctx));
const n = R(NEW, `JSON.stringify(survivorsRoster().map(r=>({k:r.key,p:r.playable,m:r.model,a:r.art2d?Object.keys(r.art2d):null,kit:!!r.kit})))`);
const o = R(OLD, `JSON.stringify(survivorsRoster().map(r=>({k:r.key,p:r.playable,m:r.model})))`);
const heroes = R(NEW, 'JSON.stringify(Object.keys(HERO_TYPES))');
ck('every hero is in the Spire roster and playable', n.length === heroes.length && n.every(r => r.p), [n.length, heroes.length, n.filter(r => !r.p).map(r => r.k)]);
ck('no hero loads a 3D model (SURV_3D_ON is false)', n.every(r => !r.m) && R(NEW, 'JSON.stringify(SURV_3D_ON)') === false);
ck('every hero carries its 2D idle, walk, attack and ult sheets, and green / blue where the game has them (Fritz: none - his skills play his attack)', n.every(r => r.a && ['idle', 'walk', 'attack', 'ult'].every(s => r.a.includes(s)) && (r.k === 'fritz' || r.a.includes('green') || r.a.includes('blue'))), n.filter(r => !r.a || !r.a.includes('idle')).map(r => r.k));
ck('a skill with no cast sheet falls back to the attack sheet', /art\.green \? 'green' : art\.blue \? 'blue' : art\.attack \? 'attack'/.test(fs.readFileSync(path.join(ROOT, 'survivors-dev.html'), 'utf8')));
ck('every hero has its Spire kit', n.every(r => r.kit));
ck('the 3D models are kept for the side project (SURV_MODELS unchanged)', vm.runInContext('JSON.stringify(SURV_MODELS)', NEW.ctx) === vm.runInContext('JSON.stringify(SURV_MODELS)', OLD.ctx));
const dev = fs.readFileSync(path.join(ROOT, 'survivors-dev.html'), 'utf8');
ck('the frame draws a hero with art2d in 2D and skips the 3D load', /window\._heroArt2d = \(hh && hh\.art2d\)/.test(dev) && /H2 = window\._heroArt2d \? mk2d/.test(dev) && /if \(!H2 && document\.getElementById\('use3d'\)\.checked\) load3d/.test(dev));
ck('skills play green / blue, the ult plays ult, blows play attack', /anim2d: i === 0 \? 'green' : 'blue'/.test(dev) && /H2\.act\(f\.kind === 'ult' \? 'ult'/.test(dev) && /H2\.act\('attack', 1\.0\)/.test(dev));
ck('CONTROL: live v1318 sent 3D models for the model heroes', o.filter(r => r.m).length >= 50, o.filter(r => r.m).length);
console.log('test_spire_2d_1319.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
