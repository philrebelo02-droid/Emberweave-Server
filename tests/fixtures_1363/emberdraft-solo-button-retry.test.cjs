const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('  solo.onclick=()=>{ if(!signed){');
const fixedStart = source.indexOf('  solo.onclick=async()=>{');
const offset = start >= 0 ? start : fixedStart;
const end = source.indexOf('\n}', offset);
assert(offset >= 0 && end > offset);
const solo = {disabled: false};
const ov = {dataset: {}, isConnected: true, remove() { this.isConnected = false; }};
const ids = [];
const messages = [];
let attempt;
const claim = Promise.resolve();
vm.runInNewContext(source.slice(offset, end), {
  solo, ov, signed: true, god: 'fixture',
  ACC: {token: 'session', id: 'account'},
  _claimP: claim,
  uid8: () => 'id-' + (ids.length + 1),
  api: (_, method, body) => {
    ids.push(body.requestId);
    if (ids.length === 1) throw Error('Interrupted start');
    if (ids.length === 2) return {error: 'Refused'};
    return {ok: true, attemptId: 'fixture-attempt'};
  },
  pendingDefinite: d => d && d.error !== 'offline',
  show: (_, msg) => messages.push(msg),
  ewT: key => key,
  edNiceErr: (error, fallback) => error || fallback,
  edNewGame: id => { attempt = id; },
});
(async () => {
  const onUnhandled = () => {};
  process.on('unhandledRejection', onUnhandled);
  await solo.onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(solo.disabled, false);
  assert.equal(ov.dataset.busy, undefined);
  assert.equal(messages.at(-1), 'offline');
  await solo.onclick();
  assert.equal(messages.at(-1), 'Refused');
  await solo.onclick();
  assert.equal(attempt, 'fixture-attempt');
  assert.deepEqual(ids, ['id-1', 'id-1', 'id-3']);
})().catch(error => { console.error(error); process.exitCode = 1; });
