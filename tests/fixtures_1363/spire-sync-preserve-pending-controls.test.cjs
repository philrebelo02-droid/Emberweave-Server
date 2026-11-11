const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('function openTower()');
const end = source.indexOf('/* ============================ MAIL', start);
assert(start >= 0 && end > start);

const buttons = new Map();
const overlay = {
  set innerHTML(html) {
    for (const id of ['#twGo', '#twTrib', '#twX']) buttons.set(id, {dataset: {}});
  },
  querySelector: id => buttons.get(id),
};
let finishSync;
let finishFirst;
let climbs = 0;
const label = key => key;
const open = vm.runInNewContext(source.slice(start, end) + '\nopenTower', {
  isleOverlay: () => overlay, isleCard: html => html,
  towerState: () => ({floor: 1}), towerReq: () => 1, battlePow: () => 2,
  towerTribReady: () => true, towerTribute: async () => ({none: true}),
  uiIcon: label, statusIcon: label, hudIcon: label, ewT: label,
  towerSync: () => new Promise(resolve => { finishSync = resolve; }),
  towerAscend() {
    climbs++;
    if (climbs === 1) return new Promise(resolve => { finishFirst = resolve; });
    return Promise.resolve({win: false});
  },
  document: {body: {contains: () => true}},
});

(async () => {
  open();
  const first = buttons.get('#twGo').onclick();
  finishSync({ok: true});
  await Promise.resolve();
  await buttons.get('#twGo').onclick();
  assert.equal(climbs, 1);
  finishFirst({win: false});
  await first;
  await buttons.get('#twGo').onclick();
  assert.equal(climbs, 2);
})().catch(error => { console.error(error); process.exitCode = 1; });
