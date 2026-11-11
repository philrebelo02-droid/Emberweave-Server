const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf("    if(p==='/api/quest/claim'){");
const end = source.indexOf('    /* v993', start);
assert(start >= 0 && end > start);
const receipts = [];
const ledger = { gold: 98, gems: 99 };
const capCredit = field => (_, led, amount) => {
  const delta = Math.min(amount, 100 - led[field]);
  led[field] += delta;
  return delta;
};
const context = {
  p: '/api/quest/claim', me: { id: 'fixture' }, reqId: 'ordinary-claim', res: {},
  led: ledger, b: { id: 'completed-quest' },
  QUEST_DEFS_SRV: { 'completed-quest': { cond: () => true, reward: { gold: 10, gems: 10 } } },
  creditGold: capCredit('gold'), creditGems: capCredit('gems'),
  idem: (_, fn) => fn(), ledTx: (_, __, got) => receipts.push(got),
  writeDB() {}, ledgerView: () => ledger, send: (_, status, value) => ({ status, value }),
};
const result = vm.runInNewContext(`(() => { ${source.slice(start, end)} })()`, context);
assert.equal(result.status, 200);
assert.equal(result.value.got.gold, 2);
assert.equal(result.value.got.gems, 1);
assert.equal(receipts[0].gold, 2);
assert.equal(receipts[0].gems, 1);
