// A signed-in quest is paid by /api/quest/claim, never a second local earn.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
const start = html.indexOf('function claimQuest(q)');
const end = html.indexOf('/* 30 Aug', start);
assert(start >= 0 && end > start, 'claimQuest source found');
const calls = { claim: 0, capture: 0, adopt: 0, messages: [] };
const ctx = {
  G: { questClaimed: {} }, ACC: { token: 'test' }, uid8: () => 'req-1',
  api: async () => ({ ok: true, ledger: { gems: 20 } }),
  ledCapture: () => { calls.capture++; throw new Error('signed-in claim must not run ledCapture'); },
  adoptLedger: () => { calls.adopt++; },
  saveG: () => {}, updateHubChrome: () => {}, updateMailBadges: () => {},
  bannerMsg: msg => calls.messages.push(msg), renderQuests: () => {}, tutReturnAfterAction: () => {},
};
vm.runInNewContext(html.slice(start, end), ctx);
ctx.claimQuest({ id: 'q_name', ready: true, title: 'Make a Name', reward: '💎 20 diamonds', claim: () => { calls.claim++; } });
setImmediate(() => {
  assert.strictEqual(calls.claim, 0, 'client reward closure did not mint a second payment');
  assert.strictEqual(calls.capture, 0, 'no generic earn was submitted');
  assert.strictEqual(calls.adopt, 1, 'server ledger was adopted once');
  assert.strictEqual(ctx.G.questClaimed.q_name, true);
  assert(calls.messages[0].includes('💎 20 diamonds'));
  console.log('wallet quest claim: pass');
});
