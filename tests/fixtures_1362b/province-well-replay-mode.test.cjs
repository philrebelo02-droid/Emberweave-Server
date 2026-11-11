const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(root) {
  return require(path.resolve(root, 'server/sim-host.js')).load(
    path.resolve(root, 'emberweave-heroes.html')
  );
}

const baseline = load(process.argv[2]);
const candidate = load(process.argv[3]);
const province = JSON.parse(fs.readFileSync(path.resolve(
  process.argv[2], 'server/province-encounters.json'
), 'utf8')).types.gold.stages[3];
const campaign = JSON.parse(fs.readFileSync(path.resolve(
  process.argv[2], 'server/campaign-encounters.json'
), 'utf8')).find(stage => stage.id === '1-1');

const original = baseline.sandbox.simCampaignReplay.toString();
const modeMarker = "CUR={mode:'campaign'";
assert(original.includes(modeMarker));
const replayWithLiveMode = mode => vm.runInContext(
  '(' + original.replace(modeMarker, "CUR={mode:'" + mode + "'") + ')',
  baseline.ctx
);

const seed = 4242;
const input = [];
const provinceTeam = ['askel', 'rivet', 'mirelle', 'aureth', 'sloe'];
const copy = value => JSON.parse(JSON.stringify(value));
const provinceSnaps = baseline.snapFromSpecs(provinceTeam.map(key => ({
  key, level: province.levelGate, stars: 3, rank: 1,
})));
const run = (host, snaps, waves, mode) =>
  host.campaign(copy(snaps), copy(waves), seed, copy(input), mode);

for (const mode of ['province', 'well']) {
  const expectedWin = replayWithLiveMode(mode)(
    copy(provinceSnaps), copy(province.waves), seed, copy(input), true
  );
  const expectedDigest = baseline.sandbox._p2digest;
  assert.ok(expectedDigest);
  const actual = run(candidate, provinceSnaps, province.waves, mode);
  assert.equal(actual.digest, expectedDigest, mode + ' digest differs from live mode');
  assert.equal(actual.won, !!expectedWin);
}
const starters = baseline.snapSquad(['vael', 'vireo', 'sylthaine']);
const before = run(baseline, starters, campaign.waves);
const after = run(candidate, starters, campaign.waves);
assert.ok(before.digest);
assert.equal(JSON.stringify(after), JSON.stringify(before), 'Campaign receipt bytes changed');
console.log('Province and Well mode digests match the reference; Campaign receipt is byte-identical.');
