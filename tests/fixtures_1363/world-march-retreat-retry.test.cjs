const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf("  s.body.querySelectorAll('[data-retreat]').forEach");
const end = source.indexOf('\n}', start);
assert(start >= 0 && end > start);
const button = {disabled: false, dataset: {retreat: 'fixture-march'}};
const overlay = {isConnected: true};
let requests = 0;
let opens = 0;
let errors = 0;
vm.runInNewContext(source.slice(start, end), {
  s: {body: {querySelectorAll: () => [button]}, ov: overlay},
  retreatMarch: async id => {
    assert.equal(id, 'fixture-march');
    requests++;
    if (requests === 1) throw Error('Interrupted refresh');
    if (requests === 2) return false;
    if (requests === 4) overlay.isConnected = false;
    return true;
  },
  openMarchInfo: () => { opens++; },
  bannerMsg: () => { errors++; },
  ewT: key => key,
});

(async () => {
  for (const expectedOpens of [0, 0, 1, 1]) {
    await button.onclick().catch(() => {});
    assert.equal(button.disabled, false);
    assert.equal(opens, expectedOpens);
  }
  assert.equal(requests, 4);
  assert.equal(errors, 1);
})().catch(error => { console.error(error); process.exitCode = 1; });
