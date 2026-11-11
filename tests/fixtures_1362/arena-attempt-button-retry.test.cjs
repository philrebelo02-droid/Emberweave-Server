const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf("  { const ba=b.querySelector('#arenaBuyAtt');");
const end = source.indexOf("  const el=b.querySelector('#arenaOpps');", start);
assert(start >= 0 && end > start);

async function check(reply, expectedMessages, expectedRenders) {
  const button = {disabled: false, isConnected: true};
  const messages = [];
  let renders = 0;
  let request;
  vm.runInNewContext(source.slice(start, end), {
    b: {querySelector: () => button},
    ACC: {token: 'fixture', id: 'fixture'},
    state: 'arena',
    apiOnce: () => { request = Promise.resolve().then(reply); return request; },
    ARENA: {},
    bannerMsg: message => messages.push(message),
    renderArena: () => { renders++; },
    t: key => key,
  });
  await button.onclick();
  await request.catch(() => {});
  assert.equal(button.disabled, false);
  assert.deepEqual(messages, expectedMessages);
  assert.equal(renders, expectedRenders);
}

(async () => {
  await check(() => ({busy: true}), [], 0);
  await check(() => { throw Error('interrupted'); }, ['arena.attempt_fail'], 0);
  await check(() => ({error: 'Refused'}), ['Refused'], 1);
})().catch(error => { console.error(error); process.exitCode = 1; });
