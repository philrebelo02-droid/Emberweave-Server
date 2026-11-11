const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf("      if(what==='warchest'){"),b=s.indexOf('writeDB(); return {ok:true, gold:g, cost:c, ledger:ledgerView(me)}; }',a)+'writeDB(); return {ok:true, gold:g, cost:c, ledger:ledgerView(me)}; }'.length;
assert(a>=0&&b>a);
for(const [gold,ok] of [[20001,false],[20000,true]]){
 const led={gold,gems:500},sh={warchest:0};
 const result=vm.runInNewContext('(()=>{'+s.slice(a,b)+'})()',{
  what:'warchest',led,sh,me:{id:'fixture'},patronShadyPrice:()=>250,
  ECON_CAP:{gold:100000},
  creditGold:(_,l,n)=>{l.gold=Math.min(100000,l.gold+n);},ledTx(){},writeDB(){},ledgerView:()=>led,
 });
 assert.equal(result.ok,ok);
 assert.equal(led.gems,ok?250:500);
 assert.equal(sh.warchest,ok?1:0);
 assert.equal(led.gold,ok?100000:gold);
}
