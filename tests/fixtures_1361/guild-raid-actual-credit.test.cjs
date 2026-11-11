const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8').replace(/\r\n/g,'\n');
const a=s.indexOf("        { const led=ensureLedger(du);\n          if(reward.gold)"),tail="ledTx(du,'guild-raid',reward); }";
const b=s.indexOf(tail,a);
assert(a>=0&&b>a);
const ledger={guildCoins:99},reward={gold:80,gems:20,guildCoins:10,tier:1};
let logged;
vm.runInNewContext(s.slice(a,b+tail.length),{
  reward,du:{},ensureLedger:()=>ledger,creditGold:()=>2,creditGems:()=>0,
  ECON_CAP:{guildCoins:100},ledTx:(_,__,delta)=>{logged={...delta};},
});
assert.deepEqual(reward,{gold:2,gems:0,guildCoins:1,tier:1});
assert.deepEqual(logged,reward);
assert.equal(ledger.guildCoins,100);

