// v1255 (Phil 2 Nov 2026: "Basically its a scripted fight, nearly animation, the fight starts out and just vael runs in. Against 2 enemies"
// ... Vireo rushes in after his ult, Sylthaine at wave 2, wave 3 = 4 enemies). Runs the REAL client engine through server/sim-host.js
// (the server's own replay path, simCampaignReplay) on stage 1-1's authored waves. Exit 0 = every check passed.
// Control: INTRO_HTML=<the v1254 page> must FAIL (no script: all three heroes start on the field).
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.INTRO_HTML || path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const enc = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'campaign-encounters.json'), 'utf8'));
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); };
const e11 = enc.find(e => e.id === '1-1'), W = e11.waves;
ok(W.length === 3 && W[0].length === 2 && W[1].length === 3 && W[2].length === 4, 'stage 1-1 waves are 2 / 3 / 4 enemies');
ok(W[0][0].intro === '1-1', 'wave 1 carries the intro marker (the server replay switches the script on from the same data)');
ok(/const INTRO_LINES=\{/.test(html) && /function introDrawBubble\(\)/.test(html) && !/id='introDlg'|#introDlg\{/.test(html), 'the lines are speech bubbles over the speaker - no bottom text box (Phil: "go back to the bubble, remove the bottom text box")');
ok(/body\.intro11 \.portrait\.ult-coach-glow\{animation-duration:2\.2s\}/.test(html), 'the coached portrait flashes slowly in the intro');

const host = require(path.join(ROOT, 'server/sim-host.js')).load(process.env.INTRO_HTML || path.join(ROOT, 'emberweave-heroes.html')); const run = s => vm.runInContext(s, host.ctx);   // load() takes the page's PATH
// wrap introTick to watch the beats (sim time) - the same function the live fight and the server replay call
run(`globalThis._ib=[]; (function(){ const o=introTick; introTick=function(dt){ o(dt); const I=CUR._intro;
  globalThis._ib.push({w:waveIdx, al:units.filter(u=>u.team==='ally').map(u=>u.key).join(','), full:I.vaelFull||0, vireo:I.vireoIn||0, syl:I.sylIn==null?0:1}); }; })(); 1`);
const snaps = run(`JSON.stringify(snapAllySquad(['vael','vireo','sylthaine']))`);
const digests = [];
for (const seed of [11, 22, 33]) {
  run('globalThis._ib=[]');
  const r = JSON.parse(run(`(()=>{ const won=simCampaignReplay(${snaps}, ${JSON.stringify(W)}, ${seed}, [], false); return JSON.stringify({won, alive:globalThis._p2alive|0, d:globalThis._p2digest}); })()`));
  const B = JSON.parse(run('JSON.stringify(globalThis._ib)'));
  ok(B.length > 0 && B[0].al === 'vael', 'seed ' + seed + ': the fight starts with Vael alone on the field (' + (B[0] && B[0].al) + ')');
  ok(B.some(b => b.full > 0 && b.w === 0), 'seed ' + seed + ': Vael\'s ult arrives in wave 1 (at ~75% HP)');
  const w2 = B.filter(b => b.w === 1).pop();   // the LAST wave-2 sample: the first ones are taken during the wave change, before the entries
  ok(w2 && w2.al.split(',').sort().join(',') === 'sylthaine,vael,vireo', 'seed ' + seed + ': by wave 2 all three are on the field (' + (w2 && w2.al) + ')');
  ok(r.won, 'seed ' + seed + ': the scripted 1-1 is won');
  digests.push(r.d);
  const again = JSON.parse(run(`(()=>{ simCampaignReplay(${snaps}, ${JSON.stringify(W)}, ${seed}, [], false); return JSON.stringify({d:globalThis._p2digest}); })()`));
  ok(again.d === r.d, 'seed ' + seed + ': the replay is deterministic (same digest twice)');
}
// any other squad plays 1-1 as a normal stage
run('globalThis._ib=[]');
const other = run(`JSON.stringify(snapAllySquad(['vael','vireo','lumi']))`);
run(`simCampaignReplay(${other}, ${JSON.stringify(W)}, 11, [], false)`);
ok(JSON.parse(run('JSON.stringify(globalThis._ib)')).length === 0, 'a different squad gets no script (the intro needs the starter trio)');
console.log('test_intro_1255.js: ' + pass + ' checks passed');
