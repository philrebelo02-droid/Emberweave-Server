const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const expression = html.match(/\$\{(t\('bonuspick\.selected',\{[^}]+\}\))\}/);
assert.ok(expression, 'picker counter exists');
const display = (ownedCount, cap, picked) => vm.runInNewContext(expression[1], {
  owned: Array(ownedCount), CAP: cap, E: {picked: Array(picked)},
  t: (key, values) => `Selected ${values.n} / ${values.cap}`
});
assert.equal(display(4, 15, 0), 'Selected <b>0</b> / 4');
assert.equal(display(12, 7, 3), 'Selected <b>3</b> / 7');
assert.equal(display(0, 15, 0), 'Selected <b>0</b> / 0');
