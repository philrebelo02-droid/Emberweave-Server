const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf("  buy.onclick=()=>gameConfirm(ewT('draft.buy_confirm'");
const end = source.indexOf('  solo.onclick=', start);
assert(start >= 0 && end > start);
const button = {disabled: false, dataset: {}};
const receipt = {id: null, acct: null};
const messages = [];
const ids = [];
let request;
vm.runInNewContext(source.slice(start, end), {
  buy: button,
  ov: {isConnected: true},
  ACC: {id: 'fixture', token: 'session'},
  ED_BUY_RID: receipt,
  uid8: () => 'fixture-request',
  ewT: key => key,
  hudIcon: () => '',
  gameConfirm: (_, confirm) => confirm(),
  api: (_, method, body) => {
    ids.push(body.requestId);
    if (ids.length === 1) throw Error('Interrupted purchase');
    request = Promise.resolve({error: 'Refused'});
    return request;
  },
  pendingDefinite: response => Boolean(response),
  edNiceErr: (error, fallback) => error || fallback,
  updateHubChrome: () => {},
  show: (_, message) => messages.push(message),
});
(async () => {
  try { await button.onclick(); } catch (_) {}
  assert.equal(button.disabled, false);
  assert.equal(messages.at(-1), 'draft.err_buy');
  assert.equal(receipt.id, 'fixture-request');
  await button.onclick();
  await request;
  assert.equal(button.disabled, false);
  assert.equal(messages.at(-1), 'Refused');
  assert.equal(receipt.id, null);
  assert.deepEqual(ids, ['fixture-request', 'fixture-request']);
})().catch(error => { console.error(error); process.exitCode = 1; });
