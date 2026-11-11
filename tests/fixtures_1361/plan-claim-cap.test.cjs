const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf("  if(p==='/api/shop/plan-claim'"),b=s.indexOf("  if(p==='/api/shop/devpack'",a);
assert(a>=0&&b>a);
async function claim(gems,withStamina){
 const plans={gems:{daysLeft:2},stamina:{daysLeft:withStamina?2:0}},led={gems,stam:{v:90}};
 const run=vm.runInNewContext('(async()=>{'+s.slice(a,b)+'})',{
  p:'/api/shop/plan-claim',req:{method:'POST'},me:{id:'fixture'},res:{},body:async()=>({requestId:'claim'}),
  durableCommit:(u,_,work)=>work(u),ensureLedger:()=>led,shopPlans:()=>plans,planDayKey:()=> 'today',
  SHOP_PLAN_KINDS:['gems','stamina'],SHOP_OFFERS:['gems','stamina'].map(k=>({kind:'plan',plan:k,id:k,amount:10})),
  ledStamRegen(){},ECON_CAP:{gems:100},STAM_CEIL:100,
  creditGems:(_,l,n)=>{const before=l.gems;l.gems=Math.min(100,before+n);return l.gems-before;},
  creditStamina:(_,l,n)=>{const before=l.stam.v;l.stam.v=Math.min(100,before+n);return l.stam.v-before;},
  ledTx(){},writeDB(){},plansView:()=>plans,ledgerView:()=>led,send:(_,status,payload)=>({status,payload}),
 });
 return {r:await run(),plans,led};
}
(async()=>{
 const blocked=await claim(91,false); assert.equal(blocked.r.payload.ok,false); assert.equal(blocked.plans.gems.daysLeft,2); assert.equal(blocked.led.gems,91);
 const mixed=await claim(91,true); assert.equal(mixed.r.payload.paid.stamina,10); assert.equal(mixed.plans.gems.daysLeft,2); assert.equal(mixed.plans.stamina.daysLeft,1);
 const fit=await claim(90,false); assert.equal(fit.r.payload.paid.gems,10); assert.equal(fit.plans.gems.daysLeft,1);
})().catch(e=>{console.error(e);process.exitCode=1;});
