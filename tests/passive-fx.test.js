const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const end = html.indexOf('\n}', start);
  assert.notEqual(end, -1, `${name} ends`);
  return html.slice(start, end + 2);
}

test('triggered passive sheet follows the normal ability art route', () => {
  const calls = [];
  const context = {
    FX2_DEF: {lumi_passive: {dur: 2.4}}, METER: 10, _fxAllow: false,
    abilArt(...args) { calls.push({args, allowed: context._fxAllow}); },
  };
  vm.createContext(context);
  vm.runInContext(functionSource('firePassiveFx'), context);
  vm.runInContext(functionSource('firePassiveClip'), context);
  const caster = {key: 'lumi'};
  const target = {x: 4, y: 8, alive: true};

  assert.equal(context.firePassiveFx(caster, target, {aboveBar: true}), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args[1].gfx, 'lumi_passive');
  assert.equal(calls[0].args[1].gdur, 2.4);
  assert.equal(calls[0].args[2], target);
  assert.equal(calls[0].args[4], 'heal');
  assert.equal(calls[0].allowed, true);
  assert.equal(context._fxAllow, false);

  // A timed proc with no body-animation sheet still fires its FX sheet.
  context.firePassiveClip(caster, 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].args[4], 'passive');

  // An unwired hero stays a no-op; constant passives never call this route.
  assert.equal(context.firePassiveFx({key: 'unwired'}), false);
  assert.equal(calls.length, 2);
});
