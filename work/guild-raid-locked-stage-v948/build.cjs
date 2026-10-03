'use strict';const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
let h=fs.readFileSync(path.join(__dirname,'../guild-raid-canonical-namespace-v948/private-client-namespaced.html'),'utf8');a.equal(hash(h),'ea8540e8afc23e8d541d104bb92b7e750c99555341ca224f8f1defa8a7a2d20e');const parent=h;
const change=(before,after)=>{a.equal(h.split(before).length,2);h=h.replace(before,after)};
change(" function stage(r,p){guard();if(!r||!acceptedAttempts.has(r.id)||p?.attemptId!==acceptedAttempts.get(r.id))throw Error('Accepted attempt binding required');return h.stage(r,p)}"," async function stage(r,p){guard();if(!r||!acceptedAttempts.has(r.id)||p?.attemptId!==acceptedAttempts.get(r.id))throw Error('Accepted attempt binding required');const row=copy(r),saved=copy(p);return locked(async()=>{await legacy();guard();const found=(await h.recover(scope)).find(x=>x.row.id===row.id);guard();if(!found||found.row.state!=='pending'||JSON.stringify(found.row)!==JSON.stringify(row))throw Error('Stage directory changed');return h.stage(row,saved);})}");
change(` function stageAndSchedule(packet){guard();if(busy||!owner||owner.phase!=='fight')throw Error('No accepted fight owner');
  if(packet?.attemptId!==owner.attemptId)throw Error('Bootstrap attempt mismatch');
  facade.stage(owner.row,packet);guard();owner.phase='result';
  // The synchronous durable slot write/readback precedes ANY delayed send.
  // If scheduling throws, the saved result/owner remains held for recovery.
  scheduleSettlement({raidInstanceId:owner.id,raidEntryRequestId:owner.entryRequestId,attemptId:owner.attemptId});return {staged:true};
 }`,` async function stageAndSchedule(packet){guard();if(busy||!owner||owner.phase!=='fight')throw Error('No accepted fight owner');
  if(packet?.attemptId!==owner.attemptId)throw Error('Bootstrap attempt mismatch');
  busy=true;const held=owner;try{await facade.stage(held.row,packet);guard();if(owner!==held)throw Error('Stage owner changed');held.phase='result';
  // Shared account lock, directory guard and durable slot readback must finish
  // BEFORE ANY delayed send. Failure retains the fight owner and exact packet.
  scheduleSettlement({raidInstanceId:held.id,raidEntryRequestId:held.entryRequestId,attemptId:held.attemptId});return {staged:true};
  }finally{busy=false;}
 }`);
change('r.bootstrap.stageAndSchedule(packet);','await r.bootstrap.stageAndSchedule(packet);');
const b=h.indexOf('const EW_RAID_V3_MODULES='),e=h.indexOf('// PRIVATE guarded v3 cutover.',b);new vm.Script(h.slice(b,e));fs.writeFileSync(__dirname+'/private-client-locked-stage.html',h);fs.writeFileSync(__dirname+'/build-certificate.json',JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),parentSHA256:hash(parent),clientSHA256:hash(h),spans:3,scope:'Private prerequisite for safe entry terminal cleanup. Async stage uses existing account lock+legacy guard+exact pending directory row, bootstrap awaits before schedule, actual retry awaits. Not closure implementation/native/release approval.'},null,2));console.log(hash(h));
