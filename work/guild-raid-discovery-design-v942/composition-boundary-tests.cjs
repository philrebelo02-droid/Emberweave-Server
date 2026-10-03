'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),A=require(process.env.FACADE_SOURCE||'./composition-facade.cjs'),copy=x=>JSON.parse(JSON.stringify(x));
function fixture(){const slots=new Map(),rows=new Map(),calls=[],f={session:{accountId:'actor',guildId:'guild',token:'memory-only',epoch:1},releaseChange:false};
 const storage={get length(){return slots.size},key:i=>[...slots.keys()][i]??null,getItem:k=>slots.get(k)??null,setItem:(k,v)=>slots.set(k,v)};
 const directory={list:async(a,n)=>[...rows.values()].filter(x=>x.accountId===a).slice(0,n).map(copy),insertBounded:async r=>rows.set(r.id,copy(r)),markConfirmed:async()=>{},retireConfirmed:async()=>{}};
 const opts={directory,storage,context:()=>f.session,locks:{request:async(k,o,fn)=>{const result=await fn({});if(f.releaseChange)f.session={...f.session,epoch:f.session.epoch+1};return result}},transport:async p=>{calls.push(copy(p));return {ok:true}},legacyWritersQuiescent:async()=>true};
 f.rows=rows;f.calls=calls;f.newClient=()=>A.create(opts);return f;
}
test('session change while lock releases refuses fresh reply adoption',async()=>{const f=fixture();f.releaseChange=true;await assert.rejects(f.newClient().start({requestId:'entry',heroIds:['hero']},'one'),/Stale session/);assert.equal(f.calls.length,1);assert.equal(f.rows.size,1)});
test('session change while recovery lock releases refuses recovery reply adoption',async()=>{const f=fixture();await f.newClient().start({requestId:'entry',heroIds:['hero']},'one');f.releaseChange=true;await assert.rejects(f.newClient().recover('one'),/Stale session/);assert.deepEqual(f.calls.map(x=>x.mode),['fresh-entry','entry-recovery-only']);assert.equal(f.rows.size,1)});
test('unknown recovery ID sends no request and creates no new intent',async()=>{const f=fixture();await assert.rejects(f.newClient().recover('unknown'),/No recoverable/);assert.equal(f.calls.length,0);assert.equal(f.rows.size,0)});
