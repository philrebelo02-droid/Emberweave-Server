const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf('  const wireBlocks='),b=s.indexOf('  if(acBlocks)',a);
assert(a>=0&&b>a);
const bt={disabled:false,dataset:{unblock:'fixture'}};
const el={isConnected:true,querySelectorAll:()=>[bt]};
let banner=0;
const wire=vm.runInNewContext(s.slice(a,b)+'\nwireBlocks;',{
 ACC:{token:'fixture',id:'fixture'},api:()=>{throw Error('request interrupted');},
 bannerMsg:()=>{banner++;},escapeHTML:x=>x,t:x=>x,
});
wire(el);
(async()=>{
 try{await bt.onclick();}catch(_){}
 assert.equal(bt.disabled,false);
 assert.equal(banner,1);
})().catch(e=>{console.error(e);process.exitCode=1;});
