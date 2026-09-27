// Signed-in star milestone rewards wait for the server instead of mutating the wallet mirror.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
const start = html.indexOf('function starMilestoneReward(idx)');
const end = html.indexOf('function starTrackClaimable()', start);
assert(start >= 0 && end > start, 'star reward source found');
const requests = [];
const ctx = {
  G: { gold: 50, gems: 20, stamina: 10 }, ACC: { token: 'test' }, LED: { st: { born: 123 } },
  txEarnP: (what, amount, reason, extra) => { requests.push({ what, amount, reason, extra }); return Promise.resolve(true); },
  randLockedHero: () => 'vael', giveHeroFrag: () => { throw new Error('signed-in fragment mutation'); },
};
vm.runInNewContext(html.slice(start, end), ctx);
(async () => {
  await ctx.starMilestoneReward(0).give();
  await ctx.starMilestoneReward(0).give();
  assert.strictEqual(ctx.G.gold, 50, 'no optimistic gold');
  assert.strictEqual(requests[0].extra.requestId, requests[1].extra.requestId, 'retry is idempotent');
  await ctx.starMilestoneReward(1).give();
  assert.strictEqual(ctx.G.stamina, 10, 'no optimistic stamina');
  await ctx.starMilestoneReward(2).give();
  assert.strictEqual(ctx.G.gems, 20, 'no optimistic diamonds');
  await ctx.starMilestoneReward(3).give();
  assert(requests.some(r => r.what === 'frag' && r.extra.heroKey === 'vael'));
  ctx.ACC.token = null;
  await ctx.starMilestoneReward(0).give();
  assert.strictEqual(ctx.G.gold, 2050, 'signed-out fallback still grants locally');
  console.log('wallet star milestone: pass');
})().catch(e => { console.error(e); process.exitCode = 1; });
