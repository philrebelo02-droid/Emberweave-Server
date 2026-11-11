const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const tap = html.slice(html.search(/^let _tapSwallowUntil|^const _tapClickUntil/m), html.indexOf('let rosterClassF'));
const confirm = html.slice(html.indexOf('function gameConfirm('), html.indexOf('function playerLevel('));
const element = () => ({
  listeners: {}, style: {},
  addEventListener(name, handler) { this.listeners[name] = handler; },
  remove() {}
});
const document = element();
const overlay = element();
const buttons = {'#_gcYes': {}, '#_gcNo': {}};
overlay.querySelector = key => buttons[key];
document.createElement = () => overlay;
document.body = {appendChild() {}};
let time = 1000;
let paint;
const ctx = vm.createContext({
  document, Date: {now: () => time}, performance: {now: () => time},
  requestAnimationFrame: callback => { paint = callback; }, t: key => key
});
vm.runInContext(tap + confirm, ctx);
const trigger = (el, name, timeStamp, target = el) =>
  el.listeners[name]({timeStamp, target, ewGameX: 10, ewGameY: 10});
let taps = 0;
const control = element();
ctx.wireTap(control, () => taps++);
trigger(control, 'pointerdown', 1000);
time = 2200;
trigger(control, 'pointerup', 1080);
assert.equal(taps, 1, 'a short physical tap survives a delayed handler');
const roster = element();
const card = {_pick: () => taps++, closest() {return this;}};
ctx.wireRosterTaps(roster);
trigger(roster, 'pointerdown', 2300, card);
time = 3500;
trigger(roster, 'pointerup', 2380, card);
assert.equal(taps, 2, 'roster uses physical tap duration');
let confirmed = 0;
ctx.gameConfirm('Confirm?', () => confirmed++);
time = 4000;
assert.equal(typeof paint, 'function');
paint();
buttons['#_gcYes'].onclick({isTrusted: true, timeStamp: 4100});
assert.equal(confirmed, 0, 'guard begins at paint');
buttons['#_gcYes'].onclick({isTrusted: true, timeStamp: 4450});
buttons['#_gcYes'].onclick({isTrusted: true, timeStamp: 4500});
assert.equal(confirmed, 1, 'confirm fires once after the guard');
