'use strict';
/* v1441 REPLAY DISAGREEMENT - the Gear Active of a server-frozen fight comes from the snapshot only (Phil 24 Nov 2026: "And the properly
   gear they have").
   Campaign / Province / Well / Guild raid fights are fought on the squad the server froze (CUR.serverSnaps); the server replays that
   same squad. The portrait bar used to ADD a Gear Active from this device's Forge state to any hero whose snapshot had none - a
   client-only change to the fight: with AUTO on the hero then cast it 2.5 s in (think -> castGearSkill) and the server's replay, which
   never had it, ended differently. Reproduced in a real browser on v1439 (quit a stage, set a Gear Active, BATTLE again: the resumed
   snapshot had no active, the page added one, the fights split on the tick it was cast and a digest-mismatch record was filed).
   The check runs the page's own buildPortraitBar() in the server's engine host:
     1. a snapshot fight, hero without a Gear Active in the snapshot, Forge state says the hero has one -> the unit gets NONE;
     2. a fight built from the local save (no snapshot - e.g. the Vault) -> the unit still gets it from the Forge state, as before;
     3. a snapshot that carries a Gear Active keeps exactly that one;
     4. CONTROL: the v1439 page (git af4aab45c) adds the Forge state's active in case 1.
   Asserts (non-zero exit). */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), CONTROL_SHA = 'af4aab45c';
const SH = require(path.join(ROOT, 'server', 'sim-host.js'));
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok  ' + m); };
const probe = htmlPath => { const host = SH.load(htmlPath);
  return JSON.parse(vm.runInContext(`(function(){
    FORGE.cat={items:[{id:'T1',slot:'weapon',active:'Test Active',activeType:'dmg',activeParams:{mul:1},effect:'test'}]};
    FORGE.st={enabled:true,active:{vael:'it1'},items:{it1:{d:'T1'}},equipped:{vael:{weapon:'it1'}}};
    const mk=(gs)=>{ const u=makeUnit('vael','ally',100,100,5,{owned:true}); u.gearSkill=gs||null; return u; };
    const id=()=>{ const g=units[0].gearSkill; return g?(g.defId||'?'):null; };
    const out={ forge:(gearActiveFor('vael')||{}).defId||null };
    CUR={mode:'campaign',node:3,serverSnaps:[{key:'vael'}]}; units=[mk()]; buildPortraitBar(); out.snapNone=id();
    CUR={mode:'vault',floor:3}; units=[mk()]; buildPortraitBar(); out.local=id();
    CUR={mode:'campaign',node:3,serverSnaps:[{key:'vael'}]}; units=[mk({used:false,name:'Frozen',defId:'S9',type:'heal',params:{}})]; buildPortraitBar(); out.snapOwn=id();
    units=[]; return JSON.stringify(out); })()`, host.ctx)); };

console.log('== v1441: a frozen fight takes its Gear Active from the snapshot only ==');
const A = probe(path.join(ROOT, 'emberweave-heroes.html'));
ok(A.forge === 'T1', 'fixture: this device\'s Forge state says Vael has a Gear Active (' + A.forge + ')');
ok(A.snapNone === null, 'a snapshot fight whose snapshot has no Gear Active: the portrait bar adds none (got ' + A.snapNone + ')');
ok(A.local === 'T1', 'a fight built from the local save (no snapshot) still gets it from the Forge state');
ok(A.snapOwn === 'S9', 'a snapshot that carries a Gear Active keeps exactly that one');

const ctl = fs.mkdtempSync(path.join(os.tmpdir(), 'gear1441-'));
try {
  const html = cp.execFileSync('git', ['show', CONTROL_SHA + ':emberweave-heroes.html'], { cwd: ROOT, maxBuffer: 256 << 20 });
  fs.writeFileSync(path.join(ctl, 'emberweave-heroes.html'), html);
  for (const m of html.toString('utf8').matchAll(/<script[^>]*\ssrc="\/?([^"?]+)[^"]*"/g)) { const src = m[1]; if (src.startsWith('assets/')) continue;
    const to = path.join(ctl, src); fs.mkdirSync(path.dirname(to), { recursive: true });
    try { fs.writeFileSync(to, cp.execFileSync('git', ['show', CONTROL_SHA + ':' + src], { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (_) { if (fs.existsSync(path.join(ROOT, src))) fs.copyFileSync(path.join(ROOT, src), to); } }
  const C = probe(path.join(ctl, 'emberweave-heroes.html'));
  ok(C.forge === 'T1' && C.snapNone === 'T1', 'CONTROL v1439: the portrait bar adds the Forge state\'s active to a snapshot hero that has none (' + C.snapNone + ')');
} finally { try { fs.rmSync(ctl, { recursive: true, force: true }); } catch (_) {} }
console.log(''); console.log('test_gear_snapshot_1441.js: ' + pass + ' passed, 0 failed');
