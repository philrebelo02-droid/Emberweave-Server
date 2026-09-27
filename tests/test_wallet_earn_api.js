// Run against a throwaway local server/DB: node tests/test_wallet_earn_api.js http://127.0.0.1:18081
const assert = require('assert');
const base = process.argv[2];
if (!base) throw new Error('Pass the isolated local server URL');
let token = '';
async function post(route, data) {
  const res = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-token': token }, body: JSON.stringify(data) });
  return { status: res.status, data: await res.json() };
}
(async () => {
  const guest = await post('/api/guest', { deviceId: 'wallet-qa-' + Date.now() });
  assert.strictEqual(guest.status, 200); token = guest.data.token;
  const requestId = 'retry-after-refusal';
  const tooLarge = await post('/api/tx/earn', { what: 'gold', amount: 200001, reason: 'gauntlet', requestId });
  assert.strictEqual(tooLarge.status, 400, 'refused by authored per-earn rule');
  const accepted = await post('/api/tx/earn', { what: 'gold', amount: 100, reason: 'gauntlet', requestId });
  assert.strictEqual(accepted.status, 200, 'a refused request ID is retryable');
  const once = accepted.data.ledger.gold;
  const repeat = await post('/api/tx/earn', { what: 'gold', amount: 100, reason: 'gauntlet', requestId });
  assert.strictEqual(repeat.data.ledger.gold, once, 'accepted receipt is idempotent');
  const reset = await post('/api/account/reset-progress', {});
  assert.strictEqual(reset.status, 200);
  const afterReset = await post('/api/tx/earn', { what: 'gold', amount: 100, reason: 'gauntlet', requestId });
  assert.strictEqual(afterReset.status, 200);
  assert.strictEqual(afterReset.data.ledger.gold, 100, 'reset ledger has its own earn epoch');
  console.log('wallet earn API: pass');
})().catch(e => { console.error(e); process.exitCode = 1; });
