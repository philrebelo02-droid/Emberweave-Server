const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8').replace(/\r\n/g,'\n');
const route=s.indexOf("    if(p==='/api/trial/resolve')");
const a=s.indexOf('        let reward=null;\n        if(first)',route),b=s.indexOf('        /* v273',a);
assert(route>=0&&a>route&&b>a);
const led={px:98999999},nominal={gold:100,px:10};
let tx;
const reward=vm.runInNewContext(s.slice(a,b)+'\nreward;',{
 first:true,K:{reward:()=>nominal},floor:1,me:{},led,kind:'dungeon',
 creditGold:()=>2,ledAddPlayerXP:l=>{l.px+=1;},ledTx:(_,__,delta)=>{tx={...delta};},
});
assert.deepEqual({...reward},{gold:2,px:1});
assert.deepEqual(tx,{gold:2,px:1});
assert.deepEqual(nominal,{gold:100,px:10});
