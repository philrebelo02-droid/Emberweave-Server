const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf("    if(p==='/api/arena/daily-claim'){");
const end = source.indexOf('\n  }', start);
assert(start >= 0 && end > start);
const account = { coins: 99, rank: 10 };
const ledger = { gold: 98, gems: 99 };
let transaction;
const credit = field => (_, led, amount) => {
  const delta = Math.min(amount, 100 - led[field]);
  led[field] += delta;
  return delta;
};
const result = vm.runInNewContext('(() => {' + source.slice(start, end) + '})()', {
  p: '/api/arena/daily-claim', reqId: 'claim', me: account, res: {},
  ensureLedger: () => ledger, ledPlayerLevel: () => 10, nyDayKey: () => 'today',
  durableCommit: (user, _, work) => work(user), arenaDailyRewardSrv: () => ({gold:20,gems:5,coins:10}),
  creditGold: credit('gold'), creditGems: credit('gems'), ECON_CAP: {arenaCoins:100},
  ledTx: (_, __, reward) => { transaction = reward; },
  writeDB() {}, ledgerView: () => ledger, send: (_, status, payload) => ({status,payload}),
});
assert.equal(result.status, 200);
assert.deepEqual({...result.payload.reward}, {gold:2,gems:1,coins:1});
assert.deepEqual({...transaction}, {gold:2,gems:1,coins:1});
assert.equal(account.arenaDaily.k, 'today');
