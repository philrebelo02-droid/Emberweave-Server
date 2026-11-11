const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const anchor = source.indexOf('function drawServerMarchInfo(');
const start = source.indexOf('btn.onclick=async()=>', anchor);
const end = source.indexOf('line.appendChild(btn)', start);
assert(anchor >= 0 && start > anchor && end > start);

const button = {disabled: false};
const box = {isConnected: true};
let calls = 0;
let redraws = 0;
let notices = 0;
vm.runInNewContext(source.slice(start, end), {
  btn: button,
  box,
  m: {id: 'fixture-city-march'},
  recallServerCity: async id => {
    assert.equal(id, 'fixture-city-march');
    if (++calls === 1) throw Error('Interrupted recall');
    if (calls === 2) return false;
    if (calls === 4) box.isConnected = false;
    return true;
  },
  render: () => { redraws++; },
  bannerMsg: () => { notices++; },
  ewT: key => key,
});

(async () => {
  for (const expectedRedraws of [0, 0, 1, 1]) {
    await button.onclick().catch(() => {});
    assert.equal(button.disabled, false);
    assert.equal(redraws, expectedRedraws);
  }
  assert.equal(calls, 4);
  assert.equal(notices, 1);
})().catch(error => { console.error(error); process.exitCode = 1; });
