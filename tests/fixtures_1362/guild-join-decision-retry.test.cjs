const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('function renderGuildRequests(');
const end = source.indexOf('// ---- EMBASSY tab', start);
assert(start >= 0 && end > start);
const approved = {disabled: false, dataset: {appr: 'applicant'}};
const denied = {disabled: false, dataset: {deny: 'applicant'}};
const list = {querySelectorAll: selector => selector === '[data-appr]' ? [approved] : [denied]};
const el = {querySelector: () => list, contains: button => [approved, denied].includes(button)};
const actions = [];
const messages = [];
let renders = 0;
const bind = vm.runInNewContext(source.slice(start, end) + '\nrenderGuildRequests;', {
  t: key => key,
  escapeHTML: text => text,
  guildAct: async (action, body) => {
    assert.equal(body.id, 'applicant');
    actions.push(action);
    if (actions.length % 2) throw Error('Interrupted request');
    return {error: 'Refused'};
  },
  bannerMsg: message => messages.push(message),
  renderGuild: () => { renders++; },
});
bind(el, {requests: [{id: 'applicant', name: 'Applicant', rank: 1}]});

(async () => {
  for (const button of [approved, denied]) {
    await button.onclick().catch(() => {});
    assert.equal(button.disabled, false);
    assert.equal(messages.at(-1), 'net.connection_lost');
    await button.onclick();
    assert.equal(button.disabled, false);
    assert.equal(messages.at(-1), 'Refused');
  }
  assert.deepEqual(actions, ['approve', 'approve', 'deny', 'deny']);
  assert.equal(renders, 2);
})().catch(error => { console.error(error); process.exitCode = 1; });
