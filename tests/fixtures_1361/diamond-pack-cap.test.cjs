const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf("    const out=durableCommit(me,me.id+':purchase:'"),z=s.indexOf("    if(b.provider==='play'&&out.ok)",a);
assert(a>=0&&z>a);
for(const [balance,fit] of [[91,false],[90,true]]){
 const led={gems:balance};let tokenRecords=0;
 const r=vm.runInNewContext(s.slice(a,z)+'\nout;',{
  me:{id:'fixture'},b:{provider:'play'},v:{tokenHash:'fixture-hash',ref:'receipt'},offer:{id:'pack',kind:'gems',amount:10,usd:1},
  DB:{users:{}},durableCommit:(u,_,work)=>work(u),ensureLedger:()=>led,ECON_CAP:{gems:100},
  PLAY_TOKENS:{recordToken:()=>{tokenRecords++;return true;}},
  creditGems:(_,l,n)=>{const prev=l.gems;l.gems=Math.min(100,l.gems+n);return l.gems-prev;},
  patronState(){},patronCreditPurchase:()=>({rebate:0}),ledTx(){},writeDB(){},plansView:()=>({}),ledgerView:()=>led,
 });
 assert.equal(r.ok,fit);assert.equal(tokenRecords,fit?1:0);assert.equal(led.gems,fit?100:balance);
 if(fit) assert.equal(r.granted.gems,10); else assert.equal(led.purchases,undefined);
}
