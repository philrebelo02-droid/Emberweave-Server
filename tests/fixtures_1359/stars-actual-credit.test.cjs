const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(process.argv[2], 'utf8');
const start = src.indexOf("  if(p==='/api/stars/claim'");
const end = src.indexOf('  /* v1081:', start);
assert(start >= 0 && end > start);
const run = vm.runInNewContext('(async () => {' + src.slice(start,end) + '})', {
  p:'/api/stars/claim',req:{method:'POST'},res:{},me:{id:'fixture'},
  body:async () => ({requestId:'claim'}),ensureLedger:() => ({starClaimed:0,camp:{stars:Object.fromEntries(Array.from({length:5},(_,i)=>[i,3]))}}),
  durableCommit:(account,_,work) => work(account),
  creditGold:() => 2,
  ledTx:(_,__,got) => assert.equal(got.gold,2),writeDB(){},
  ledgerView:() => ({}),send:(_,status,payload) => ({status,payload}),
});
run().then(r => {assert.equal(r.status,200);assert.equal(r.payload.got.gold,2);}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
