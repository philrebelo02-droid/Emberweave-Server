const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const start=s.indexOf("if(!gg||!(gg.members||[]).includes(me.id))");
const a=s.indexOf('        const got={};',start),b=s.indexOf("        ledTx(me,'gshop:'",a);
assert(start>=0&&a>start&&b>a);
for(const field of ['gold','gems']) for(const [balance,fit] of [[91,false],[90,true]]){
 const led={gold:0,gems:0,[field]:balance,guildCoins:100};
 const credit=(_,l,n)=>{const before=l[field];l[field]=Math.min(100,before+n);return l[field]-before;};
 const r=vm.runInNewContext('(()=>{'+s.slice(a,b)+'return {ok:true,got};})()',{
  it:{[field]:10,cost:30},led,idx:1,me:{},creditGold:credit,creditGems:credit,ECON_CAP:{gold:100,gems:100},
 });
 assert.equal(r.ok,fit);
 assert.equal(led.guildCoins,fit?70:100);
 assert.equal(led[field],fit?100:balance);
 if(fit) assert.equal(r.got[field],10);
}
