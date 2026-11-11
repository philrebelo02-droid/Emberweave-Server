const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(process.argv[2], 'utf8');
const start = src.indexOf("  if(p==='/api/signin/claim'");
const end = src.indexOf("  if(p==='/api/stars/claim'", start);
assert(start >= 0 && end > start);
const run = vm.runInNewContext('(async () => {' + src.slice(start,end) + '})', {
  p:'/api/signin/claim',req:{method:'POST'},res:{},me:{id:'fixture'},
  body:async () => ({requestId:'claim'}),ensureLedger:() => ({signin:{month:'2026-11',claimed:[]}}),
  durableCommit:(account,_,work) => work(account),signinCalendarDay:() => ({y:2026,m0:10,day:1}),
  signinReward:() => ({stamina:20}),creditStamina:() => 2,
  ledTx:(_,__,got) => assert.equal(got.stamina,2),writeDB(){},
  ledgerView:() => ({}),send:(_,status,payload) => ({status,payload}),
});
run().then(r => {assert.equal(r.status,200);assert.equal(r.payload.got.stamina,2);}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
