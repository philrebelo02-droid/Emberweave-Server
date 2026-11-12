// v1377 (Phil 12 Nov 2026, live: "floor 80 still 1 shotting level 100s"). In the Vault no single enemy hit may take more than
// VAULT_HIT_CAP (45%) of a hero's max HP, so a full-HP hero never dies to one hit - Orryx's Labyrinth Charge slam, the late-fight
// rageMul ramp, crits and class edges included. Real client battle code (server/sim-host.js -> simCampaignReplay(..., 'vault')), the
// page's own switches, the live server/vault-encounters.json, level-100 teams frozen in tests/fixtures/vault_l100_1377.json
// (five comps, fully maxed and 90% geared). Every enemy -> hero dealDamage call over the WHOLE fight is checked.
//  1. floor 80: 5 comps x maxed / 90% x 4 seeds - no full-HP hero dies to one hit, no hit over 45% of the hero's max HP;
//  2. floors 60-100: 5 comps at 90% x 1 seed - the same;
//  3. sanity: every fight's enemies actually hit the heroes (the Vault waves spawned);
// CONTROL 1: the same build with the cap switched off (VAULT_HIT_CAP = Infinity) one-shots on floor 80.
// CONTROL 2: 6f1b947a's page (before this fix) one-shots on floor 80 (campaign-mode replay of the same waves: its Vault replay
//            spawned nothing) and has no Vault cap.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const CAP = 0.45, OLD_SHA = '6f1b947a';
const FL = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/vault-encounters.json'), 'utf8')).floors;
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'vault_l100_1377.json'), 'utf8'));
const COMPS = ['Free', 'Phil', 'Common', 'TwoTank', 'Dive'];
function engine(htmlPath) { const host = require(path.join(ROOT, 'server', 'sim-host.js')).load(htmlPath); vm.runInContext('autoUlt=true;', host.ctx);
  vm.runInContext(`var __h=null; var __dd=dealDamage;
  dealDamage=function(src,tgt,amt,color,kind,silent){
    if(!__h||!tgt||!src||tgt.team!=='ally'||src.team!=='enemy'||!tgt.alive) return __dd.apply(this,arguments);
    const b=tgt.hp+(tgt.shield||0), full=tgt.hp>=tgt.maxHp*0.999; const r=__dd.apply(this,arguments);
    const loss=b-(Math.max(0,tgt.hp)+(tgt.shield||0)), f=loss/Math.max(1,tgt.maxHp), h=__h;
    if(loss>0){ h.hits++; if(f>h.max){ h.max=f; h.who=src.key+'>'+tgt.key+' @'+battleTime.toFixed(0)+'s x'+rageMul.toFixed(1); }
      if(full&&(!tgt.alive||tgt.hp<=0)){ h.os++; h.osWho=src.key+'>'+tgt.key+' @'+battleTime.toFixed(0)+'s x'+rageMul.toFixed(1); } }
    return r; };`, host.ctx);
  return host; }
function fight(host, ids, waves, seed, mode) { const SB = host.sandbox, h = { hits: 0, max: 0, os: 0, who: '', osWho: '' }; SB.__h = h; let won = false;
  try { won = !!SB.simCampaignReplay(ids.map(id => host.snapFromSpecs([FX.specs[id]])[0]), JSON.parse(JSON.stringify(waves)), seed >>> 0, [], false, mode || 'vault'); } finally { SB.__h = null; }
  return { won, h }; }
function scan(host, floors, tags, seeds, mode) { const S = { n: 0, wins: 0, os: 0, max: 0, who: '', osWho: [], noHits: 0 };
  for (const f of floors) for (const cn of COMPS) for (const tag of tags) for (const s of seeds) { const r = fight(host, FX.teams[cn + ':' + tag], FL[f - 1].waves, s + f * 13, mode);
    S.n++; if (r.won) S.wins++; S.os += r.h.os; if (r.h.os) S.osWho.push(f + ' ' + cn + ':' + tag + ' ' + r.h.osWho); if (!r.h.hits) S.noHits++; if (r.h.max > S.max) { S.max = r.h.max; S.who = f + ' ' + r.h.who; } }
  return S; }
const pc = x => (100 * x).toFixed(0) + '%';

const host = engine(path.join(ROOT, 'emberweave-heroes.html'));
ck('the page carries the Vault one-hit cap at 45%', vm.runInContext('typeof VAULT_HIT_CAP', host.ctx) === 'number' && vm.runInContext('VAULT_HIT_CAP', host.ctx) === CAP);
// 1. floor 80
const A = scan(host, [80], ['M', '90'], [1, 2, 3, 4]);
ck('floor 80, level-100 teams (5 comps, maxed and 90% geared, 40 fights): no full-HP hero dies to one hit (' + A.os + ')', A.os === 0, A.osWho.slice(0, 5).join('; '));
ck('floor 80: no hit takes over 45% of a hero (biggest ' + pc(A.max) + ' ' + A.who + '); level-100 teams win ' + A.wins + '/' + A.n, A.max <= CAP + 1e-6);
// 2. floors 60-100
const fl = []; for (let f = 60; f <= 100; f++) fl.push(f);
const B = scan(host, fl, ['90'], [7]);
ck('floors 60-100, level-100 teams at 90% gear (5 comps, 205 fights): no full-HP hero dies to one hit (' + B.os + ')', B.os === 0, B.osWho.slice(0, 5).join('; '));
ck('floors 60-100: no hit takes over 45% of a hero (biggest ' + pc(B.max) + ' ' + B.who + ')', B.max <= CAP + 1e-6);
// 3. sanity
ck('every fight\'s enemies hit the heroes (the Vault waves spawned): ' + (A.noHits + B.noHits) + ' fights without a hit', A.noHits + B.noHits === 0);
// CONTROL 1: cap off
vm.runInContext('VAULT_HIT_CAP=Infinity;', host.ctx);
const C1 = scan(host, [80], ['M', '90'], [1, 2, 3, 4]);
ck('CONTROL: the same build with the cap off one-shots on floor 80 (' + C1.os + ' one-hit kills, biggest hit ' + pc(C1.max) + ')', C1.os > 0 && C1.max > CAP);
vm.runInContext('VAULT_HIT_CAP=' + CAP + ';', host.ctx);
// CONTROL 2: the page before this fix
const TMP = path.join(ROOT, '.test_vault_no_oneshot_1377.tmp.html');
fs.writeFileSync(TMP, cp.execSync('git show ' + OLD_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
let old; try { old = engine(TMP); } finally { try { fs.unlinkSync(TMP); } catch (e) {} }
const C2 = scan(old, [80], ['M', '90'], [1, 2, 3, 4], 'campaign');
ck('CONTROL: ' + OLD_SHA + ' has no Vault cap and one-shots level-100 teams on floor 80 (' + C2.os + ' one-hit kills in ' + C2.n + ' fights, ' + C2.osWho.slice(0, 2).join('; ') + ')', vm.runInContext('typeof VAULT_HIT_CAP', old.ctx) === 'undefined' && C2.os > 0);
console.log('test_vault_no_oneshot_1377.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
