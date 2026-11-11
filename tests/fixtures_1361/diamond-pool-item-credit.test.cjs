const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.argv[2];
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
const roll=server.split(/\r?\n/).find(l=>l.includes("return hit(()=>{")&&l.includes("type:'stamItem'"));
const display=ui.split(/\r?\n/).find(l=>l.includes("if(r.type==='stamItem') return"));
assert(roll&&display);
for(const [before,n] of [[9999,0],[9998,1]]){
 const led={stamItems:before};
 const r=vm.runInNewContext('(()=>{'+roll.slice(0,roll.lastIndexOf('}'))+'})()',{
   led,STAM_ITEM_MAX:9999,STAM_ITEM_STAMINA:120,STAM_ITEM_NAME:'Ember Roast',hit:f=>f(),
 });
 assert.equal(r.n,n); assert.equal(led.stamItems,9999);
 const out=vm.runInNewContext('(()=>{'+display+'})()',{
   r,STAM_ITEM_NAME:'Ember Roast',STAM_ITEM_STAMINA:120,hudIcon:()=>'',STAM_ITEM_ART:()=>'',ewT:key=>key,
 });
 assert.equal(out.extra,n?'wish.kept_in_bag':'');
}
