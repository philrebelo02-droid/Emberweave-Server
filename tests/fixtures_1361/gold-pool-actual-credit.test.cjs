const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf('function poolRollGold('),b=s.indexOf('function poolRollGem(',a);
assert(a>=0&&b>a);
for(const [roll,type,n] of [[0.8,'gold',2],[0.99,'gems',0]]){
  const random=[0.5,roll,0];
  const run=vm.runInNewContext(s.slice(a,b)+'\npoolRollGold;',{
    Math:{random:()=>random.shift(),floor:Math.floor,max:Math.max},
    poolTopGlyphTier:()=>0,GLYPH_LADDER:['grey'],creditGold:()=>2,creditGems:()=>0,
  });
  assert.deepEqual({...run({led:{}})},{type,n});
}
