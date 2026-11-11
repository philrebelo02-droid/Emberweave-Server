const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('async function gearPlanRun(');
const end = source.indexOf('function gearConfirmQuick(', start);
assert(start >= 0 && end > start);
const forge = {busy: false, st: {revision: 1}};
const calls = [];
const messages = [];
const run = vm.runInNewContext(source.slice(start, end) + '\ngearPlanRun;', {
  FORGE: forge,
  api: async path => {
    calls.push(path);
    if (path === '/api/gear/equip') throw Error('Equip interrupted');
    return calls.length === 1 ? {crafted: 'fixture-item'} : {error: 'Refused'};
  },
  bannerMsg: text => messages.push(text),
  forgeSync: async () => {},
  renderHeroDetail: () => {},
  uiIcon: () => '',
  t: key => key,
});
const plan = {steps: [{kind: 'craft', gearId: 'fixture-gear'}]};
(async () => {
  await run(plan, 'fixture-hero').catch(() => {});
  assert.equal(forge.busy, false);
  assert.equal(messages.at(-1), 'gear.equip_failed');
  await run(plan, 'fixture-hero');
  assert.equal(forge.busy, false);
  assert.equal(messages.at(-1), 'Refused');
  assert.deepEqual(calls, ['/api/gear/craft', '/api/gear/equip', '/api/gear/craft']);
})().catch(error => { console.error(error); process.exitCode = 1; });
