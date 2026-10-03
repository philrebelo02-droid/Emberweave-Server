'use strict';
// Diagnostic control: these intentionally fail until authenticated terminal
// refusal retirement exists. Status alone is NOT permission to erase a journal.
const {test}=require('node:test'),a=require('node:assert/strict');
const A=require('./composition-facade.cjs'),F=require('./fresh-entry-validator.cjs');
for(const [label,reply] of [['exhausted',{status:200,body:{none:true}}],['rate limit',{status:429,body:{error:'Slow down.'}}],['boss down',{status:400,body:{error:'This boss is already down — the next tier is spawning.'}}]]){
 test('diagnostic: '+label+' should not permanently obstruct a later explicit launch',async()=>{
  const rows=[],slots=new Map();let calls=0;
  const directory={list:async()=>rows,insertBounded:async r=>rows.push(r)};
  const storage={get length(){return slots.size},key:i=>[...slots.keys()][i]??null,getItem:k=>slots.get(k)??null,setItem:(k,v)=>slots.set(k,v)};
  const client=A.create({directory,storage,context:()=>({accountId:'actor',guildId:'guild',token:'memory',epoch:1}),locks:{request:async(_n,_o,fn)=>fn({})},legacyWritersQuiescent:async()=>true,transport:async()=>{calls++;return reply},validateFreshEntryReply:F.validateFreshEntryReply});
  await a.rejects(client.start({requestId:'first',heroIds:['hero']},'one'));
  a.equal(calls,1);a.equal(slots.size,0);
  // Current facade retains the row indefinitely and the second call refuses
  // BEFORE transport. This is the bug, not a safe fix implemented by this test.
  await client.start({requestId:'second',heroIds:['hero']},'two');
 });
}
