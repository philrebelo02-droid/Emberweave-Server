const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf('function xpPotionGrant('),b=s.indexOf('function xpPotionAmount(',a);
assert(a>=0&&b>a);
const grant=vm.runInNewContext(s.slice(a,b)+'\nxpPotionGrant;',{xpPotionTier:()=> 'minor',srvSeed:()=>1});
for(const [before,expected] of [[999998,{minor:1}],[999999,{}],[1000000,{}]]){
 const l={xpPotions:{minor:before}};
 assert.deepEqual({...grant(l,'normal',1,2,1)},expected);
 assert.equal(l.xpPotions.minor,Math.max(before,999999));
}
