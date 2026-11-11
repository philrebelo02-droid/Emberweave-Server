const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf('    let goldReward=0; if(won)'), b=s.indexOf('    if(opp && b.def',a);
const c=s.indexOf('    let milestoneGems=0;',b),d=s.indexOf('    let glyphFrags=',c);
assert(a>=0&&b>a&&c>b&&d>c);
const ledger={}, tx=[];
const got=vm.runInNewContext(s.slice(a,b)+s.slice(c,d)+'\n[goldReward,milestoneGems];',{
  won:true,me:{rank:4999,bestRank:5000},ensureLedger:()=>ledger,nyDayKey:()=> 'today',
  creditGold:()=>2,creditGems:()=>0,ledTx:(_,__,delta)=>tx.push(delta),
});
assert.deepEqual(Array.from(got),[2,0]);
assert.deepEqual(tx.map(x=>x.gold??x.gems),[2,0]);
