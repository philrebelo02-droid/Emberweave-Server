const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf("    if(p==='/api/tower/ascend'"),b=s.indexOf("    return send(res,404,{error:'not found'});",a);
assert(a>=0&&b>a);
for(const p of ['/api/tower/ascend','/api/tower/tribute']){
 const led={gold:98,gems:100},T={mig:1,floor:1};
 let tx;
 const credit=(field,_,l,n)=>{const before=l[field];l[field]=Math.min(100,before+n);return l[field]-before;};
 const result=vm.runInNewContext('(()=>{'+s.slice(a,b)+'})()',{
  p,me:{id:'fixture'},reqId:'claim',res:{},ensureLedger:()=>led,towerLed:()=>T,
  durableCommit:(u,_,f)=>f(u),ledPlayerLevel:()=>40,towerReqS:()=>10,ledgerTeamPower:()=>20,
  towerFloorPay:()=>({gold:10,gems:5}),towerTribPay:()=>10,towerOldReceipt:()=>false,towerDayKey:()=> 'today',
  ECON_CAP:{gold:100,gems:100},resourceGain(){},creditGold:credit.bind(null,'gold'),creditGems:credit.bind(null,'gems'),
  ledTx:(_,__,delta)=>{tx=delta;},ledgerView:()=>led,send:(_,status,payload)=>({status,payload}),
 });
 assert.equal(result.status,200);
 assert.equal(result.payload.gold,2);
 assert.equal(tx.gold,2);
 if(p.endsWith('ascend')){assert.equal(result.payload.gems,0);assert.equal(tx.gems,0);assert.equal(T.floor,2);}
 else assert.equal(T.trib,'today');
}
