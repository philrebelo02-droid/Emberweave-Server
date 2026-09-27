// A refused gauntlet bank must keep loot and retry each grant with the same request ID.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
const start = html.indexOf('let _gaunt=null;');
const end = html.indexOf('/* ---- TOWER OF TRIALS', start);
assert(start >= 0 && end > start, 'gauntlet source found');
const requests = [];
let failGold = true, failGems = true;
const ctx = vm.createContext({
  G: { gold: 50, gems: 10, gauntlet: { day: '2026-09-27', runs: 0, best: 0 } },
  ACC: { token: 'signed-in' }, GAUNT_RUNS_DAY: 3,
  arenaDayKey: () => '2026-09-27', uid8: () => 'run-unique',
  saveG: () => {}, updateHubChrome: () => {},
  txEarnP: async (what, amount, reason, extra) => {
    requests.push({ what, amount, reason, requestId: extra.requestId });
    if (what === 'gold' && failGold) { failGold = false; return false; }
    if (what === 'gems' && failGems) { failGems = false; return false; }
    return true;
  },
});
vm.runInContext(html.slice(start, end), ctx);
(async () => {
  assert(ctx.gauntStart());
  vm.runInContext('_gaunt.wave=30; _gaunt.gold=329400; _gaunt.gems=4; _gaunt.runes=2;', ctx);
  assert.strictEqual(await ctx.gauntBank(), false, 'gold refusal blocks bank');
  assert.strictEqual(ctx.G.gold, 50, 'no optimistic gold');
  assert.strictEqual(ctx.G.gems, 10, 'no optimistic gems');
  assert.strictEqual(ctx.G.gauntRun.gold, 329400, 'run survives refusal');
  assert.strictEqual(await ctx.gauntBank(), false, 'gem refusal blocks bank');
  assert.strictEqual(ctx.G.gauntRun.gems, 4, 'run survives partial booking');
  assert.strictEqual(await ctx.gauntBank(), true, 'retry can finish bank');
  assert.strictEqual(ctx.G.gauntRun, null, 'run clears only after all grants');
  assert.strictEqual(ctx.G.gauntlet.best, 30, 'best wave recorded on success');
  assert(requests.every(r => r.reason === 'gauntlet'));
  assert(requests.filter(r => r.what === 'gold').every(r => r.amount <= 200000), 'gold stays within per-request rule');
  assert.strictEqual(new Set(requests.filter(r => r.what === 'gold').map(r => r.requestId)).size, 2, 'each gold chunk has one stable retry ID');
  assert.strictEqual(new Set(requests.filter(r => r.what === 'gems').map(r => r.requestId)).size, 1, 'gem retry ID stable');
  console.log('wallet gauntlet bank: pass');
})().catch(e => { console.error(e); process.exitCode = 1; });
