const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('async function gearBuildDo(');
const end = source.indexOf('/* v371', start);
assert(start >= 0 && end > start);

const forge = {busy: false, st: {revision: 1}};
const calls = [];
const messages = [];
const replies = [
  ['/api/gear/craft', new Error('Craft interrupted')],
  ['/api/gear/craft', {crafted: 'fixture-item'}],
  ['/api/gear/equip', new Error('Equip interrupted')],
  ['/api/gear/craft', {error: 'Refused'}],
];
const run = vm.runInNewContext(source.slice(start, end) + '\ngearBuildDo;', {
  FORGE: forge,
  api: async path => {
    const [expected, reply] = replies.shift();
    assert.equal(path, expected);
    calls.push(path);
    if (reply instanceof Error) throw reply;
    return reply;
  },
  bannerMsg: text => messages.push(text),
  forgeSync: async () => {},
  renderHeroDetail: () => {},
  uiIcon: () => '',
  t: key => key,
});

(async () => {
  for (const message of ['forge.cold', 'gear.equip_failed', 'Refused']) {
    await run('fixture-gear', 'fixture-hero').catch(() => {});
    assert.equal(forge.busy, false);
    assert.equal(messages.at(-1), message);
  }
  assert.equal(calls.length, 4);
})().catch(error => { console.error(error); process.exitCode = 1; });
