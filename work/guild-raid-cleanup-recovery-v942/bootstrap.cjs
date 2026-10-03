'use strict';
// Private game bootstrap contract. onFight must use the server reply's authored
// fight, never invent stats. This module supplies recovery identity and ordering.
function create({facade,current,onFight,scheduleSettlement}){
 if(!facade||typeof facade.start!=='function'||typeof facade.resume!=='function'||typeof facade.stage!=='function'||typeof facade.discover!=='function'||typeof facade.current!=='function'||typeof onFight!=='function'||typeof scheduleSettlement!=='function')throw Error('Bootstrap dependencies required');
 let busy=false,owner=null;
 const guard=()=>{if(!current()||!facade.current())throw Error('Stale bootstrap')};
 async function accept(mode,entry,id){guard();if(busy||owner)throw Error('Existing bootstrap intent held');busy=true;
  try{const accepted=mode==='fresh'?await facade.start(entry,id):await facade.resume(id);guard();
   if(!accepted?.row||accepted.row.id!==id||accepted.reply?.status!==200||accepted.reply.body?.ok!==true||typeof accepted.reply.body.attemptId!=='string'||!accepted.reply.body.attemptId)throw Error('Accepted bootstrap identity required');
   owner={row:accepted.row,id,attemptId:accepted.reply.body.attemptId,entryRequestId:accepted.row.entry.requestId,phase:'fight'};
   // Retain owner even if the visual start callback fails: never replace a paid
   // identity because a UI callback failed after server acknowledgement.
   onFight({raidInstanceId:id,raidEntryRequestId:owner.entryRequestId,attemptId:owner.attemptId,reply:accepted.reply});guard();return {id,attemptId:owner.attemptId};
  }finally{busy=false;}
 }
 function stageAndSchedule(packet){guard();if(busy||!owner||owner.phase!=='fight')throw Error('No accepted fight owner');
  if(packet?.attemptId!==owner.attemptId)throw Error('Bootstrap attempt mismatch');
  facade.stage(owner.row,packet);guard();owner.phase='result';
  // The synchronous durable slot write/readback precedes ANY delayed send.
  // If scheduling throws, the saved result/owner remains held for recovery.
  scheduleSettlement({raidInstanceId:owner.id,raidEntryRequestId:owner.entryRequestId,attemptId:owner.attemptId});return {staged:true};
 }
 async function discover(){guard();if(busy)throw Error('Bootstrap busy');busy=true;try{const choices=await facade.discover();guard();return choices}finally{busy=false}}
 async function retireCompleted(id){guard();if(busy)throw Error('Bootstrap busy');if(!owner||owner.id!==id||owner.phase!=='result')throw Error('Result owner required');
  busy=true;const held=owner;try{const choices=await facade.discover();guard();if(owner!==held||choices.some(x=>x.id===id))throw Error('Result directory not retired');owner=null;return true;}finally{busy=false}
 }
 return {launch:(entry,id)=>accept('fresh',entry,id),resume:id=>accept('resume',null,id),discover,stageAndSchedule,retireCompleted,owned:()=>{guard();return owner?{id:owner.id,attemptId:owner.attemptId,phase:owner.phase}:null}};
}
module.exports={create};
