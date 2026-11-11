const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const tick = html.match(/^function musTick\(\)\{[\s\S]*?\}catch\(e\)\{\} \}/m);
assert.ok(tick, 'music tick exists');
const heal = html.match(/^function musHeal\(L\)\{[\s\S]*?^\}/m);
const lane = {name:'map', slot:{el:{paused:true, ended:false}}};
const recovered = [];
let now = 3000;
let enabled = true;
const context = {
  MUS:{cur:'map', pool:[{}], lanes:{map:lane}}, state:'campaign',
  performance:{now:() => now}, SND:{ctx:{},cfg:{music:{on:true}}},
  musOK:() => enabled, musWant:() => 'map', musSwitch:() => {},
  musFree:() => {}, musWatch:() => {}, musLog:event => recovered.push(event[2]),
  musEnter:L => { L.slot = {el:{paused:false, ended:false}}; }
};
vm.createContext(context);
vm.runInContext(tick[0] + '\n' + (heal?.[0] || ''), context);
context.musTick();
assert.deepEqual(recovered, ['paused']);
assert.equal(lane.slot.el.paused, false);
lane.slot.el.error = {};
context.musTick();
assert.equal(recovered.length, 1, 'recovery is throttled');
now += 2000;
context.musTick();
assert.deepEqual(recovered, ['paused', 'error']);
now += 2000;
enabled = false;
lane.slot.el.paused = true;
context.musTick();
assert.equal(recovered.length, 2, 'inactive music does not restart');
