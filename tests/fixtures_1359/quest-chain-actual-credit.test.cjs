const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('function questChainDurable(');
const end = source.indexOf('function durableUserCommit(', start);
assert(start >= 0 && end > start);
const user = {id:'fixture', led:{quests:{chainStep:0}, camp:{cleared:1}, gems:99, frags:{vex:9998}}};
let saved;
const context = {
  user, DB:{users:{fixture:user},idem:{}}, PG_BOOT_PENDING:false, _worldSettlementPlanning:null,
  ensureLedger: u => u.led, questChainStepsSrv: () => [{node:1,frags:5,gems:10}],
  creditFrags: (_, led, key, n) => { const actual = Math.min(n, 9999-led.frags[key]); led.frags[key] += actual; return actual; },
  creditGems: (_, led, n) => { const actual = Math.min(n, 100-led.gems); led.gems += actual; return actual; },
  ledTx: (u, _, got) => { u.lastGain = got; }, ledgerView: u => u.led,
  durableCommit: (_, __, ___, {prepared}) => { saved = prepared; return {ok:true}; },
};
const reply = vm.runInNewContext(source.slice(start,end) + '\nquestChainDurable(user,"claim")', context);
assert.equal(reply.ok, true);
assert.equal(reply.step, 1);
assert.equal(reply.got.vexFrags, 1);
assert.equal(reply.got.gems, 1);
assert.equal(saved.draft.lastGain.vexFrags, 1);
assert.equal(saved.draft.lastGain.gems, 1);
