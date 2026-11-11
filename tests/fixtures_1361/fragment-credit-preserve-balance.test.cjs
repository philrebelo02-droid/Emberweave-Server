const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('function creditFrags(');
const end = source.indexOf('function creditStamina(', start);
assert(start >= 0 && end > start);
const reported = [];
const grant = vm.runInNewContext(source.slice(start,end) + '\ncreditFrags;', {
  resourceGain: (_, __, amount) => reported.push(amount),
});
const ledger = {frags:{vex:9998}};
assert.equal(grant({},ledger,'vex',5,'ordinary reward'),1);
assert.equal(grant({},ledger,'vex',7,'uncapped reward',{uncapped:true}),7);
assert.equal(ledger.frags.vex,10006);
assert.equal(grant({},ledger,'vex',5,'ordinary reward'),0);
assert.equal(ledger.frags.vex,10006);
assert.deepEqual(reported,[1,7,0]);
