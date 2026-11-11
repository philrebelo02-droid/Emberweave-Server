const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('async function skyTeamSave()');
const end = source.indexOf('\n\n', start);
assert(start >= 0 && end > start);

const team = {editable: true, dirty: true, lines: [['hero']]};
let calls = 0;
let failFirst;
const save = vm.runInNewContext(source.slice(start, end) + '\nskyTeamSave', {
  SKYTEAM: team, t: key => key, skyTeamRender() {},
  skyTeamIngest() { team.dirty = false; },
  api() {
    calls++;
    if (calls === 1) return new Promise((resolve, reject) => { failFirst = reject; });
    return Promise.resolve({ok: true});
  },
});

(async () => {
  const first = save();
  const second = save();
  assert.equal(calls, 1);
  await second;
  failFirst(Error('Connection dropped'));
  await first;
  assert.equal(team.saving, false);
  assert.equal(team.dirty, true);
  assert.equal(team.bad, true);
  await save();
  assert.equal(calls, 2);
  assert.equal(team.dirty, false);
  assert.equal(team.saving, false);
  assert.equal(team.msg, 'skyfall.team_saved');
})().catch(error => { console.error(error); process.exitCode = 1; });
