const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf("      if(what==='gold'){ if(sh.gold"),b=s.indexOf('      /* v274: equipment materials',a);
assert(a>=0&&b>a);
for(const [gold,ok] of [[9001,false],[9000,true]]){
 const led={gold,gems:100},sh={gold:0};
 const result=vm.runInNewContext('(()=>{'+s.slice(a,b)+'})()',{
  what:'gold',led,sh,me:{id:'fixture'},patronRow:()=>1,SHOP_GOLD_COSTS:[20],ledPlayerLevel:()=>1,
  patronLevels:()=>({egp:0}),PATRON_DOUBLE_GOLD_EGP:6,ECON_CAP:{gold:10000},
  creditGold:(_,l,n)=>{l.gold=Math.min(10000,l.gold+n);},ledTx(){},writeDB(){},ledgerView:()=>led,
 });
 assert.equal(result.ok,ok);
 assert.equal(led.gems,ok?80:100);
 assert.equal(sh.gold,ok?1:0);
 assert.equal(led.gold,ok?10000:gold);
}
