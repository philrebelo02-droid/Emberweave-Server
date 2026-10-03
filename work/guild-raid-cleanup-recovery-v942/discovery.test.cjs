'use strict';
const assert=require('node:assert/strict'),A=require('./composition-facade.cjs'),H=require('./hybrid-adapter.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const entry={requestId:'entry',heroIds:['hero']},packet={requestId:'result',attemptId:'attempt',inputLog:[],dmg:1};
 const row={v:3,accountId:'actor',guildId:'guild',id:'one',entry,state:'pending'};
 const f={rows:[row],calls:0,inserts:0,locks:0,current:true,quiescent:true,busy:false};const slots=new Map();
 const storage={get length(){return slots.size},key:i=>[...slots.keys()][i]??null,getItem:k=>slots.get(k)??null,setItem:(k,v)=>slots.set(k,v)};
 const directory={list:async()=>{if(f.afterList)await f.afterList();return copy(f.rows)},insertBounded:async()=>{f.inserts++}};
 const client=A.create({directory,storage,context:()=>({accountId:'actor',guildId:'guild',token:'memory-only',epoch:f.current?1:2}),locks:{request:async(name,options,fn)=>{f.locks++;assert.equal(name,'ew_raid_pending_v1_actor');assert.deepEqual(options,{mode:'exclusive',ifAvailable:true});return fn(f.busy?null:{})}},transport:async()=>{f.calls++;throw Error('Discovery must not send')},legacyWritersQuiescent:async()=>f.quiescent});
 return {f,client,row,packet,slots,stage:()=>slots.set(H.key(row),JSON.stringify({v:3,accountId:'actor',guildId:'guild',instanceId:'one',entryRequestId:'entry',packet}))};
}
const tests=[];function test(name,fn){tests.push({name,fn})}
test('entry discovery exposes identity/status only, with zero network or enrollment',async()=>{const x=fixture();assert.deepEqual(await x.client.discover(),[{id:'one',status:'entry-recovery-only'}]);assert.equal(x.f.calls,0);assert.equal(x.f.inserts,0);assert.equal(x.f.locks,1)});
test('staged result discovery is token-free and packet-free',async()=>{const x=fixture();x.stage();assert.deepEqual(await x.client.discover(),[{id:'one',status:'result-recovery-only'}]);assert.equal(x.f.calls,0)});
test('durable confirmation is discoverable without its slot marker',async()=>{const x=fixture();x.row.state='confirmed';x.row.confirmedPacket=x.packet;assert.deepEqual(await x.client.discover(),[{id:'one',status:'confirmed-cleanup'}]);assert.equal(x.f.calls,0)});
test('busy lock prevents directory inspection',async()=>{const x=fixture();x.f.busy=true;x.f.afterList=()=>{throw Error('Unexpected inspection')};await assert.rejects(x.client.discover(),/Busy recovery/)});
test('session change during directory read refuses stale presentation',async()=>{const x=fixture();x.f.afterList=()=>{x.f.current=false};await assert.rejects(x.client.discover(),/Stale context/)});
test('legacy unresolved or nonquiescent state remains held',async()=>{const x=fixture();x.slots.set('ew_raid_pending_v1_actor','{}');await assert.rejects(x.client.discover(),/Legacy canonical unresolved/);x.slots.clear();x.f.quiescent=false;await assert.rejects(x.client.discover(),/not proven quiescent/);assert.equal(x.f.calls,0)});
test('out-of-scope row and over-cap directory are held',async()=>{const x=fixture();x.row.guildId='other';await assert.rejects(x.client.discover(),/Directory shape/);x.row.guildId='guild';x.f.rows=Array.from({length:5},()=>x.row);await assert.rejects(x.client.discover(),/Directory bound/)});
test('corrupt slot cannot become a fresh paid intent',async()=>{const x=fixture();x.slots.set(H.key(x.row),'not-json');await assert.rejects(x.client.discover(),SyntaxError);assert.equal(x.f.calls,0);assert.equal(x.f.inserts,0)});
test('duplicate instance or entry identity remains held',async()=>{const x=fixture();x.f.rows.push(copy(x.row));await assert.rejects(x.client.discover(),/Ambiguous/);x.f.rows[1].id='two';await assert.rejects(x.client.discover(),/Ambiguous/);assert.equal(x.f.calls,0)});
test('empty directory returns no recovery choice, without starting a raid',async()=>{const x=fixture();x.f.rows=[];assert.deepEqual(await x.client.discover(),[]);assert.equal(x.f.calls,0);assert.equal(x.f.inserts,0)});
(async()=>{const results=[];for(const t of tests){try{await t.fn();results.push({name:t.name,pass:true})}catch(e){results.push({name:t.name,pass:false,error:e.message})}}process.stdout.write(JSON.stringify({scope:'Private discovery boundary; not native/HTTP/game integration',results},null,2)+'\n');if(results.some(x=>!x.pass))process.exitCode=1})().catch(e=>{console.error(e);process.exitCode=1});
