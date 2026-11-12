// v1378 (Phil 12 Nov 2026: "floor 80 still 1 shotting level 100s" / "why not just nerf his slam? it was probably too strong" /
// "i think 1 shotting is ok if the player isnt ready"). Stats only: the monsters that one-shot a READY team had their dmgMul cut in
// server/vault-encounters.json (no hit cap, no new mechanic). A team is ready for a floor at its benchmark - level 70 + (floor-60)/2 at
// 90% gear (floor 100 = level 90) - or above. Real client battle code (server/sim-host.js -> simCampaignReplay(..., 'vault')), the page's
// own switches, teams frozen in tests/fixtures/vault_l100_1377.json (five comps). Every enemy -> hero hit over the WHOLE fight is checked
// (the late-fight rageMul ramp and counter-hits such as the Affinities Riposte included).
//  1. floors 60-100, the benchmark team of the floor (the competent Phil, Common and Dive comps x 1 seed): no full-HP hero dies to one hit;
//  2. floors 60-100, level-100 teams at 90% gear and fully maxed (5 comps x 1 seed each): no full-HP hero dies to one hit;
//  3. floor 80 (Orryx), 5 comps x benchmark / level 100 at 90% / maxed x 4 seeds: no one-hit kill, and still a fight - the benchmark
//     loses heroes and Phil's level-100 comp (Askel Rivet Mirelle Aureth Sloe) takes real damage;
//  4. the page has no hit cap (VAULT_HIT_CAP is gone - balance is numbers only);
//  5. numbers only: floors 1-59 identical to 6f1b947a, 60-100 differ only in dmgMul.
//  For information: teams ten levels under the benchmark (not ready) - their one-hit kills are printed, not failed.
// CONTROL: 6f1b947a's table (no nerf) one-shots ready teams in the same fights.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const OLD_SHA = '6f1b947a';
const NOW = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/vault-encounters.json'), 'utf8')).floors;
const OLD = JSON.parse(cp.execSync('git show ' + OLD_SHA + ':server/vault-encounters.json', { cwd: ROOT, maxBuffer: 64 << 20 }).toString()).floors;
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'vault_l100_1377.json'), 'utf8'));
const COMPS = ['Free', 'Phil', 'Common', 'TwoTank', 'Dive'];
const host = require(path.join(ROOT, 'server', 'sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html')); vm.runInContext('autoUlt=true;', host.ctx);
vm.runInContext(`var __h=null; var __dd=dealDamage;
dealDamage=function(src,tgt,amt,color,kind,silent){
  if(!__h||!tgt||!src||tgt.team!=='ally'||src.team!=='enemy'||!tgt.alive) return __dd.apply(this,arguments);
  const b=tgt.hp+(tgt.shield||0), full=tgt.hp>=tgt.maxHp*0.999; const r=__dd.apply(this,arguments);
  const loss=b-(Math.max(0,tgt.hp)+(tgt.shield||0)), f=loss/Math.max(1,tgt.maxHp), h=__h, dead=!tgt.alive||tgt.hp<=0;
  if(loss>0){ h.hits++; h.dmg+=loss; if(dead) h.deaths++; if(f>h.max){ h.max=f; h.who=src.key+'>'+tgt.key+' @'+battleTime.toFixed(0)+'s x'+rageMul.toFixed(1); }
    if(full&&dead){ h.os++; h.osWho=src.key+'>'+tgt.key+' @'+battleTime.toFixed(0)+'s x'+rageMul.toFixed(1); } }
  return r; };`, host.ctx);
function fight(ids, waves, seed) { const SB = host.sandbox, h = { hits: 0, dmg: 0, deaths: 0, max: 0, os: 0, who: '', osWho: '' }; SB.__h = h; let won = false;
  try { won = !!SB.simCampaignReplay(ids.map(id => host.snapFromSpecs([FX.specs[id]])[0]), JSON.parse(JSON.stringify(waves)), seed >>> 0, [], false, 'vault'); } finally { SB.__h = null; }
  return { won, h }; }
/* teams: 'F' benchmark of the floor, 'U' ten levels under it, 'M' level 100 maxed, '90' level 100 at 90% */
const team = (kind, f, cn) => FX.teams[(kind === 'F' || kind === 'U') ? kind + f + ':' + cn : cn + ':' + kind];
/* the benchmark that defines "ready" is the three competent comps (as the Vault retune); level-100 teams are checked in all five */
const READY = ['Phil', 'Common', 'Dive'];
function scan(table, floors, kinds, seeds) { const S = { n: 0, wins: 0, os: 0, deaths: 0, noHits: 0, osWho: [], max: 0, who: '' };
  for (const f of floors) for (const kind of kinds) for (const cn of ((kind === 'F' || kind === 'U') ? READY : COMPS)) for (const s of seeds) { const r = fight(team(kind, f, cn), table[f - 1].waves, s + f * 13 + cn.length);
    S.n++; if (r.won) S.wins++; S.deaths += r.h.deaths; if (!r.h.hits) S.noHits++; S.os += r.h.os; if (r.h.os) S.osWho.push(f + ' ' + kind + ' ' + cn + ' ' + r.h.osWho); if (r.h.max > S.max) { S.max = r.h.max; S.who = f + ' ' + r.h.who; } }
  return S; }
const pc = x => (100 * x).toFixed(0) + '%', ALL = []; for (let f = 60; f <= 100; f++) ALL.push(f);

// 1-2. ready teams on every floor
const R1 = scan(NOW, ALL, ['F'], [1]);
ck('floors 60-100: the floor benchmark (level 70+(floor-60)/2 at 90%, Phil / Common / Dive comps, ' + R1.n + ' fights) is never one-shot (' + R1.os + '; biggest hit ' + pc(R1.max) + ' ' + R1.who + ')', R1.os === 0, R1.osWho.slice(0, 6).join('; '));
const R2 = scan(NOW, ALL, ['90', 'M'], [1]);
ck('floors 60-100: level-100 teams at 90% gear and maxed (5 comps, ' + R2.n + ' fights) are never one-shot (' + R2.os + '; biggest hit ' + pc(R2.max) + ' ' + R2.who + ')', R2.os === 0, R2.osWho.slice(0, 6).join('; '));
ck('every fight\'s enemies hit the heroes (the Vault waves spawned): ' + (R1.noHits + R2.noHits) + ' fights without a hit', R1.noHits + R2.noHits === 0);
// 3. floor 80 in depth
const A = scan(NOW, [80], ['F', '90', 'M'], [1, 2, 3, 4]);   /* benchmark: 3 comps, level 100: 5 comps */
ck('floor 80 (Orryx): benchmark (3 comps), level 100 at 90% and maxed (5 comps), 4 seeds (' + A.n + ' fights): never one-shot (' + A.os + '; biggest hit ' + pc(A.max) + ' ' + A.who + ')', A.os === 0, A.osWho.slice(0, 6).join('; '));
const B80 = scan(NOW, [80], ['F'], [1, 2, 3, 4]), P80 = (() => { let n = 0, w = 0, d = 0, dmg = 0, max = 0; for (const s of [1, 2, 3, 4, 5, 6]) { const r = fight(FX.teams['Phil:90'], NOW[79].waves, s * 101); n++; if (r.won) w++; d += r.h.deaths; dmg += r.h.dmg; max = Math.max(max, r.h.max); } return { n, w, d, dmg, max }; })();
ck('floor 80 is still a fight: the benchmark loses heroes (' + (B80.deaths / B80.n).toFixed(2) + ' per fight, wins ' + B80.wins + '/' + B80.n + ') and Phil\'s level-100 comp at 90% takes heavy hits (biggest ' + pc(P80.max) + ', ' + P80.d + ' deaths in ' + P80.n + ', wins ' + P80.w + '/' + P80.n + ')', B80.deaths / B80.n >= 0.25 && P80.max >= 0.25 && P80.w >= P80.n - 1);   /* not a stomp: heroes fall at the benchmark, a level-100 hero loses a quarter of its health to one hit */
// 4. no cap
ck('no hit cap in the page (balance is numbers only)', vm.runInContext('typeof VAULT_HIT_CAP', host.ctx) === 'undefined' && !/VAULT_HIT_CAP/.test(fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8')));
// 5. numbers only
ck('floors 1-59 identical to ' + OLD_SHA, NOW.slice(0, 59).every((f, i) => JSON.stringify(f) === JSON.stringify(OLD[i])));
const strip = f => JSON.stringify(Object.assign({}, f, { waves: f.waves.map(w => w.map(m => Object.assign({}, m, { dmgMul: 0 }))) }));
ck('floors 60-100 differ from ' + OLD_SHA + ' only in dmgMul (never raised)', NOW.slice(59).every((f, i) => strip(f) === strip(OLD[59 + i]) && f.waves.every((w, a) => w.every((m, b) => m.dmgMul <= OLD[59 + i].waves[a][b].dmgMul))));
// information: not ready
const U = scan(NOW, ALL, ['U'], [1]);
console.log('  info teams ten levels under the benchmark (not ready, ' + U.n + ' fights): ' + U.os + ' one-hit kills, wins ' + U.wins + '/' + U.n + ' - allowed (Phil: "1 shotting is ok if the player isnt ready")');
// CONTROL
const C = scan(OLD, [80, 90, 95, 100], ['F', '90'], [1]);
ck('CONTROL: ' + OLD_SHA + '\'s table one-shots ready teams on floors 80/90/95/100 (' + C.os + ' one-hit kills in ' + C.n + ' fights, ' + C.osWho.slice(0, 2).join('; ') + ')', C.os > 0);
console.log('test_vault_no_oneshot_1377.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
