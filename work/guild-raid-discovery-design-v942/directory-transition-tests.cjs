'use strict';
const A=require(process.argv[2]||'./native-directory.cjs'),clone=x=>JSON.parse(JSON.stringify(x));
const packet={requestId:'result',attemptId:'attempt',inputLog:[],dmg:10},base={v:3,accountId:'actor',guildId:'guild',id:'slot',entry:{requestId:'entry',heroIds:['hero']},state:'confirmed',confirmedPacket:packet};let pass=0,fail=0;
function model(initial){let saved=clone(initial);return {get saved(){return clone(saved)},transaction(){let pending=clone(saved),aborted=false;const t={abort(){aborted=true;queueMicrotask(()=>t.onabort?.())},objectStore(){return {get(){const q={};queueMicrotask(()=>{q.result=clone(pending);q.onsuccess?.();setImmediate(()=>{if(!aborted){saved=pending;t.oncomplete?.()}})});return q},put(v){const q={};pending=clone(v);queueMicrotask(()=>q.onsuccess?.());return q}}}};return t}}}
async function test(name,f){try{await f();pass++;console.log('PASS '+name)}catch(e){fail++;console.log('FAIL '+name+': '+e.message)}}
async function refuses(f){let bad=false;try{await f()}catch{bad=true}if(!bad)throw Error('transition accepted')}
(async()=>{
 await test('identical terminal confirmation remains idempotent',async()=>{const db=model(base);await A.create(db).markConfirmed(base,packet);if(JSON.stringify(db.saved)!==JSON.stringify(base))throw Error('changed row')});
 await test('terminal packet cannot be replaced',async()=>{const db=model(base);await refuses(()=>A.create(db).markConfirmed(base,{...packet,dmg:11}));if(db.saved.confirmedPacket.dmg!==10)throw Error('replacement persisted')});
 await test('malformed confirmation refuses before transition',async()=>{const p={...base,state:'pending'};delete p.confirmedPacket;const db=model(p);await refuses(()=>A.create(db).markConfirmed(p,{...packet,dmg:-1}));if(db.saved.state!=='pending')throw Error('malformed persisted')});
 console.log(JSON.stringify({pass,fail,scope:'Synthetic transition model, not native transactions'}));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=2});
