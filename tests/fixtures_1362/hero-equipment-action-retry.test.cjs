const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('async function gearHeroPost(');
const end = source.indexOf('/* v365', start);
assert(start >= 0 && end > start);

const model = {busy: false, st: {revision: 1}};
const messages = [];
let calls = 0;
let redraws = 0;
const action = vm.runInNewContext(source.slice(start, end) + '\ngearHeroPost;', {
  FORGE: model,
  api: async () => {
    if (++calls === 1) throw Error('Interrupted request');
    return {error: 'Refused'};
  },
  bannerMsg: message => messages.push(message),
  t: key => key,
  forgeSync: async () => {},
  renderHeroDetail: () => { redraws++; },
});

(async () => {
  await action('/fixture',{}).catch(() => {});
  assert.equal(model.busy, false);
  assert.deepEqual(messages, ['forge.cold']);
  await action('/fixture',{});
  assert.equal(model.busy, false);
  assert.equal(calls, 2);
  assert.equal(redraws, 1);
  assert.deepEqual(messages, ['forge.cold', 'Refused']);
})().catch(error => { console.error(error); process.exitCode = 1; });
