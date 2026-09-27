// Tower floor/tribute claims consume progress only after the ledger confirms rewards.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
const start = html.indexOf('function towerState()');
const end = html.indexOf('/* ============================ MAIL', start);
assert(start >= 0 && end > start, 'tower source found');
const calls = [];
let goldFails = 1, gemFails = 1;
const ctx = vm.createContext({
  G: { gold: 50, gems: 10, tower: { floor: 9, trib: '' } }, ACC: { token: 'signed-in' },
  POWER_SCALE: 1, battlePow: () => 1e9, arenaDayKey: () => '2026-09-27',
  saveG: () => {}, updateHubChrome: () => {},
  txEarnP: async (what, amount, reason, extra) => {
    calls.push({ what, amount, reason, requestId: extra.requestId });
    if (what === 'gold' && goldFails > 0) { goldFails--; return false; }
    if (what === 'gems' && gemFails > 0) { gemFails--; return false; }
    return true;
  },
});
vm.runInContext(html.slice(start, end), ctx);
(async () => {
  assert((await ctx.towerAscend()).pending, 'gold refusal defers floor');
  assert.strictEqual(ctx.G.tower.floor, 9);
  assert.strictEqual(ctx.G.gold, 50, 'no optimistic gold');
  assert((await ctx.towerAscend()).pending, 'gem refusal defers floor');
  assert.strictEqual(ctx.G.tower.floor, 9);
  assert.strictEqual(ctx.G.gems, 10, 'no optimistic gems');
  assert((await ctx.towerAscend()).win, 'retry advances once');
  assert.strictEqual(ctx.G.tower.floor, 10);
  assert.strictEqual(new Set(calls.filter(c => c.what === 'gold').map(c => c.requestId)).size, 1, 'floor gold ID stable');
  assert.strictEqual(new Set(calls.filter(c => c.what === 'gems').map(c => c.requestId)).size, 1, 'floor gem ID stable');
  goldFails = 1;
  assert((await ctx.towerTribute()).pending, 'tribute refusal does not consume daily claim');
  assert.strictEqual(ctx.G.tower.trib, '');
  assert((await ctx.towerTribute()).gold > 0, 'tribute retry succeeds');
  assert.strictEqual(ctx.G.tower.trib, '2026-09-27');
  assert.strictEqual(new Set(calls.filter(c => c.requestId.startsWith('tower:tribute')).map(c => c.requestId)).size, 1, 'tribute ID stable');
  console.log('wallet tower claim: pass');
})().catch(e => { console.error(e); process.exitCode = 1; });
