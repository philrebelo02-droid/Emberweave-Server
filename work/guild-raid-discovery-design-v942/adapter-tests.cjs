'use strict';const test=require('node:test'),assert=require('node:assert/strict'),a=require('./indexed-adapter.cjs');
// Explicit model: serial transactions with copy-on-commit and abort rollback.
// Tests validate adapter event handling under this model, NOT native IndexedDB semantics.
const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function fixture(){const f={rows:new Map(),queue:[],active:null,manual:false,failAdd:false,reads:[]};
 f.transaction=()=>{const tx={pending:0,aborted:false,error:null,abort(){this.aborted=true;this.error=Error('Abort');}};f.queue.push(tx);queueMicrotask(start);return tx;};
 function start(){if(f.active||!f.queue.length)return;const tx=f.active=f.queue.shift();tx.rows=new Map([...f.rows].map(([k,v])=>[k,copy(v)]));
  function request(operation){const q={};tx.pending++;queueMicrotask(()=>{if(!tx.aborted){try{q.result=operation();q.onsuccess?.();}catch(e){q.error=e;tx.error=e;q.onerror?.();if(!tx.aborted)tx.abort();}}tx.pending--;finish();});return q;}
  tx.objectStore=()=>({index:()=>({getAll(account,count){f.reads.push({account,count});return request(()=>[...tx.rows.values()].filter(p=>p.accountId===account).slice(0,count));}}),add:p=>request(()=>{if(f.failAdd)throw Error('Quota fixture');const key=JSON.stringify([p.accountId,p.id]);if(tx.rows.has(key))throw Error('Constraint');tx.rows.set(key,copy(p));return key;}),get:k=>request(()=>copy(tx.rows.get(JSON.stringify(k)))),delete:k=>request(()=>tx.rows.delete(JSON.stringify(k)))});
  tx.finish=finish;tx.ready=true;
  // The adapter requests objectStore synchronously; install the deferred facade below.
  tx.launch?.();finish();
 }
 function finish(){const tx=f.active;if(!tx||!tx.ready||tx.pending||f.manual)return;if(tx.aborted)tx.onabort?.();else{f.rows=tx.rows;tx.oncomplete?.();}f.active=null;queueMicrotask(start);}
 // Defer API operations until the model starts this serialized transaction.
 const real=f.transaction;f.transaction=()=>{const tx=real();const proxy={index:()=>({getAll:(x,n)=>deferred('indexRead',[x,n])}),add:p=>deferred('add',[p]),get:k=>deferred('get',[k]),delete:k=>deferred('delete',[k])};const actions=[];tx.objectStore=()=>proxy;
  function deferred(name,args){const q={};const run=()=>{const store=tx.objectStore();const r=name==='indexRead'?store.index('account').getAll(...args):store[name](...args);r.onsuccess=()=>{q.result=r.result;q.onsuccess?.();};r.onerror=()=>{q.error=r.error;q.onerror?.();};};if(tx.ready)run();else actions.push(run);return q;}
  tx.launch=()=>{for(const fn of actions)fn();};return tx;
 };
 f.release=()=>{f.manual=false;f.active?.finish();};return f;
}
const row=(id='one',account='actor',guild='guild',dmg=10)=>({v:2,id,accountId:account,guildId:guild,createdAt:1,entryRequestId:null,packet:{requestId:id,attemptId:'attempt',inputLog:[],dmg}});
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
test('Request success is not commit; caller data copied before async work',async()=>{const f=fixture();f.manual=true;const p=row();p.packet.inputLog=[{t:1,x:2}];let settled=false;const wait=a.register(f,p).then(r=>{settled=true;return r;});p.packet.dmg=999;p.packet.inputLog[0].x=999;await tick();assert.equal(settled,false);assert.equal(f.rows.size,0);f.release();const r=await wait;assert.equal(r.row.packet.dmg,10);assert.equal(r.row.packet.inputLog[0].x,2);assert.equal(f.rows.size,1);});
test('Abort after successful request never acknowledges durability',async()=>{const f=fixture();f.manual=true;const wait=a.register(f,row());await tick();f.active.abort();f.release();await assert.rejects(wait,/Abort/);assert.equal(f.rows.size,0);});
test('Injected write failure rejects and preserves existing data',async()=>{const f=fixture();await a.register(f,row('old'));f.failAdd=true;await assert.rejects(a.register(f,row('new')),/Quota/);assert.equal(f.rows.size,1);});
test('Serialized model concurrent distinct results survive; discovery holds ambiguity',async()=>{const f=fixture();await Promise.all([a.register(f,row('A')),a.register(f,row('B'))]);assert.equal(f.rows.size,2);await assert.rejects(a.discover(f,'actor','guild'),/Competing/);assert.equal(f.rows.size,2);});
test('Serialized model concurrent exact duplicate reuses immutable row',async()=>{const f=fixture(),p=row();const result=await Promise.all([a.register(f,p),a.register(f,{...p,id:'other'})]);assert.equal(f.rows.size,1);assert.equal(result.filter(x=>x.reused).length,1);});
test('Changed packet with existing request identity refuses without overwriting',async()=>{const f=fixture();await a.register(f,row());await assert.rejects(a.register(f,row('one','actor','guild',99)),/Changed/);assert.equal([...f.rows.values()][0].packet.dmg,10);});
test('Fifth account result refused; no automatic eviction',async()=>{const f=fixture();for(let i=0;i<4;i++)await a.register(f,row('r'+i));await assert.rejects(a.register(f,row('fifth')),/capacity/);assert.equal(f.rows.size,4);});
test('Account lookup bounded to five and independent of unrelated origin storage',async()=>{const f=fixture();f.unrelated=new Map(Array.from({length:10000},(_,i)=>['unrelated'+i,'x']));await a.register(f,row());assert.equal((await a.discover(f,'actor','guild')).length,1);assert.equal(f.unrelated.size,10000);assert(f.reads.every(r=>r.count===5&&r.account==='actor'));});
test('Account separation and guild transition refusal preserve records',async()=>{const f=fixture();await a.register(f,row('one'));await a.register(f,row('one','other'));assert.equal((await a.discover(f,'other','guild')).length,1);await assert.rejects(a.discover(f,'actor','changed'),/Guild/);assert.equal(f.rows.size,2);});
test('Cleanup only exact confirmed identity, no other-account deletion',async()=>{const f=fixture();await a.register(f,row());await a.register(f,row('one','other'));await assert.rejects(a.clearConfirmed(f,row('one','actor','guild',99)),/mismatch/);assert.equal(await a.clearConfirmed(f,row()),true);assert.equal(await a.clearConfirmed(f,row()),false);assert.equal(f.rows.size,1);});
test('Secrets and oversize/malformed packets refused before transaction',async()=>{const f=fixture();await assert.rejects(a.register(f,{...row(),token:'secret'}),/shape/);const p=row();p.packet.inputLog=[{token:'secret'}];await assert.rejects(a.register(f,p),/Secrets/);await assert.rejects(a.register(f,row('one','actor','guild',Infinity)),/shape/);assert.equal(f.rows.size,0);});
test('Missing immutable row ID must refuse before storage work',async()=>{const f=fixture(),p=row();delete p.id;await assert.rejects(a.register(f,p),/Row shape/);assert.equal(f.reads.length,0);assert.equal(f.rows.size,0);});
test('Missing account discovery scope must refuse before index read',async()=>{const f=fixture();await assert.rejects(a.discover(f,undefined,'guild'),/Scope/);assert.equal(f.reads.length,0);});
