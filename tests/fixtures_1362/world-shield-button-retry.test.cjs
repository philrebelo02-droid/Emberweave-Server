const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf("  const u=s.body.querySelector('#shUse');");
const end = source.indexOf("\n  else if(u)", start);
assert(start >= 0 && end > start);

const ids = ["shUse"];
const buttons = new Map(ids.map(id => ['#' + id, {disabled: false, dataset: {}}]));
const root = {querySelector: selector => buttons.get(selector)};
const messages = [];
let calls = 0;
const reply = async () => {
  if (++calls % 2) throw Error('Interrupted request');
  return {pending: true, error: 'Refused', msg: 'Refused'};
};
vm.runInNewContext(source.slice(start, end), {
  ACC: {token: 'fixture'},
  ov: root,
  s: {body: root},
  towerAscend: reply,
  towerTribute: reply,
  api: reply,
  uid8: () => 'fixture',
  RESULT_LOST_MSG: 'Unconfirmed',
  escapeHTML: text => text,
  langMsg: text => text,
  ewT: key => key,
  render: message => messages.push(message),
  bannerMsg: message => messages.push(message),
});

(async () => {
  for (const button of buttons.values()) {
    await button.onclick().catch(() => {});
    assert.equal(button.disabled, false);
    assert.equal(button.dataset.busy, undefined);
    await button.onclick();
    assert.equal(button.disabled, false);
    assert.equal(messages.at(-1), 'Refused');
  }
  assert.equal(calls, ids.length * 2);
})().catch(error => { console.error(error); process.exitCode = 1; });
