const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf('function provGrant('),b=s.indexOf('// server-side plausibility',a);
assert(a>=0&&b>a);
let tx;
const grant=vm.runInNewContext(s.slice(a,b)+'\nprovGrant;',{
 provReward:()=>({gold:200,accountXp:12}),creditGold:()=>2,
 ledAddPlayerXP:led=>{led.px+=1;return 0;},ledTx:(_,__,delta)=>{tx=delta;},
});
const r=grant({},{px:98999999},'gold',1,[],'sweep');
assert.equal(r.gold,2);assert.equal(r.accountXp,1);
assert.equal(tx.gold,2);assert.equal(tx.px,1);
