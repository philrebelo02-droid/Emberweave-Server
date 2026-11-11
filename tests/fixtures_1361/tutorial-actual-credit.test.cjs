const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf("  if(p==='/api/tutorial/claim'"),b=s.indexOf("  if(p==='/api/hero/xp-potion'",a);
assert(a>=0&&b>a);
let tx;
const run=vm.runInNewContext('(async()=>{'+s.slice(a,b)+'})',{
  p:'/api/tutorial/claim',req:{method:'POST'},me:{id:'fixture'},res:{},
  body:async()=>({step:'lesson'}),_saveScope(){},TUTORIAL_REWARDS:{lesson:{gold:10,gems:5,stam:20,frag:5}},
  ensureLedger:()=>({}),tutorialStepMet:()=>true,TUTORIAL_GROUPS:[],creditGold:()=>2,creditGems:()=>0,
  creditStamina:()=>3,creditFrags:()=>1,ledTx:(_,__,delta)=>{tx=delta;},writeDB(){},
  ledgerView:()=>({}),send:(_,status,payload)=>({status,payload}),
});
run().then(({status,payload})=>{
  assert.equal(status,200);
  assert.deepEqual([payload.reward.gold,payload.reward.gems,payload.reward.stam,payload.reward.frag.qty],[2,0,3,1]);
  assert.deepEqual([tx.gold,tx.gems,tx.stamina,tx.frag],[2,0,3,1]);
}).catch(e=>{console.error(e);process.exitCode=1;});
