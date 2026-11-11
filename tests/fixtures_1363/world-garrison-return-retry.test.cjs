const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const anchor = source.indexOf("b.dataset.return=l.marchId;");
const start = source.indexOf('b.onclick=async()=>', anchor);
const end = source.indexOf('row.appendChild(b)', start);
assert(anchor >= 0 && start > anchor && end > start);
const button = {disabled: false, isConnected: true};
let recalls = 0;
let refreshes = 0;
let opens = 0;
let notices = 0;
vm.runInNewContext(source.slice(start, end), {
  b: button,
  l: {marchId: 'fixture-march'},
  recallServerCity: async id => {
    assert.equal(id, 'fixture-march');
    return ++recalls !== 2;
  },
  siegeRefresh: async () => {
    if (++refreshes === 1) throw Error('Interrupted refresh');
    if (refreshes === 3) button.isConnected = false;
  },
  viewGarrison: () => { opens++; },
  bannerMsg: () => { notices++; },
  ewT: key => key,
});
(async () => {
  for (const expectedOpens of [0, 0, 1, 1]) {
    await button.onclick().catch(() => {});
    assert.equal(button.disabled, false);
    assert.equal(opens, expectedOpens);
  }
  assert.equal(recalls, 4);
  assert.equal(refreshes, 3);
  assert.equal(notices, 1);
})().catch(error => { console.error(error); process.exitCode = 1; });
