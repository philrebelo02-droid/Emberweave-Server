const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('async function skyMarch(');
const end = source.indexOf('async function skyClaim', start);
assert(start >= 0 && end > start);

const model = {busy: false, st: {revision: 1}};
const messages = [];
let calls = 0;
let redraws = 0;
const action = vm.runInNewContext(source.slice(start, end) + '\nskyMarch;', {
  SKY: model,
  apiOnce: async () => {
    if (++calls === 1) throw Error('Interrupted request');
    return {error: 'Refused'};
  },
  bannerMsg: message => messages.push(message),
  t: key => key,
  skyStatus: async () => {},
  renderGuild: () => { redraws++; },
});

(async () => {
  await action(0).catch(() => {});
  assert.equal(model.busy, false);
  assert.deepEqual(messages, ['skyfall.march_failed']);
  await action(0);
  assert.equal(model.busy, false);
  assert.equal(calls, 2);
  assert.equal(redraws, 1);
  assert.deepEqual(messages, ['skyfall.march_failed', 'Refused']);
})().catch(error => { console.error(error); process.exitCode = 1; });
