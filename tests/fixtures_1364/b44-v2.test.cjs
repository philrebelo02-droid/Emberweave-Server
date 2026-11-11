const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const picker = html.slice(html.indexOf('function gsplitPickerRender('));
const line = picker.split('\n').find(line => line.includes("on?uiIcon('check')"));
assert.ok(line);
const expression = line.match(/\$\{(on\?uiIcon\('check'\)[^}]*)\}/);
assert.ok(expression);
const scope = {
  on: false, k: 'vael', uiIcon: () => 'check', statusIcon: () => 'swords',
  powOf: () => 123, t: key => key === 'hero.power' ? 'Puissance' : key,
  gsplitEsc: label => label
};
const rendered = vm.runInNewContext(expression[1], scope);
assert.match(rendered, />Puissance<\/span><span>123<\/span>/);
assert.match(line, /white-space:nowrap/);
assert.equal(vm.runInNewContext(expression[1], {...scope, on:true}), 'check');
