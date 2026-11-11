const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('function tp2AutoWire(');
const end = source.indexOf('function startDungeon(', start);
assert(start >= 0 && end > start);
const button = {disabled: false};
const modal = {tiers: ['gold'], i: 0, n: 10};
let calls = 0;
let draws = 0;
let banners = 0;
const bind = vm.runInNewContext(source.slice(start, end) + '\ntp2AutoWire;', {
  templeAuto: modal,
  TempleOfAsh: {CONFIG: {}},
  adoptLedger: () => {},
  updateHubChrome: () => {},
  renderTemple: () => { draws++; },
  bannerMsg: () => { banners++; },
  ewT: key => key,
});
bind({querySelector: selector => selector === '#tp2AutoGo' ? button : null}, async () => {
  calls++;
  if (calls === 1) return null;
  if (calls === 2) throw Error('Interrupted request');
  return {ledger: {}, power: 10};
}, 'fixture');

(async () => {
  await button.onclick();
  assert.equal(button.disabled, false);
  await button.onclick().catch(() => {});
  assert.equal(button.disabled, false);
  assert.equal(banners, 1);
  await button.onclick();
  assert.equal(calls, 3);
  assert.equal(modal.result.power, 10);
  assert.equal(draws, 1);
})().catch(error => { console.error(error); process.exitCode = 1; });
