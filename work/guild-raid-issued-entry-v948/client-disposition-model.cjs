'use strict';
// Private client disposition contract. No game/IndexedDB/WebLocks integration.
const clone=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function create(journal,api){let flight=null;
 function validate(row,r){
  if(!r||r.status!==200)throw Error('Unconfirmed disposition');
  const p=r.accepted||r.terminal;
  if(!p||Boolean(r.accepted)===Boolean(r.terminal)||!same(p.ticket,row.ticket)||p.ticket.claims.requestId!==row.intent.requestId||!same(p.ticket.claims.heroIds,row.intent.heroIds))throw Error('Disposition binding');
  if(r.accepted){if(p.spent!==true||typeof p.attemptId!=='string'||!p.attemptId)throw Error('Accepted proof');return 'active'}
  if(p.spent!==false||p.lateStartRefused!==true||!['cancelled','guild-changed','expired-unspent','exhausted-unspent'].includes(p.kind))throw Error('Terminal proof');return 'done';
 }
 async function run(intent,newEntry){let row=await journal.read();
  if(newEntry&&row&&row.phase!=='done')return {held:true,recoverIntent:clone(row.intent)};
  if(newEntry||!row){if(!intent)throw Error('No saved intent');row={phase:'prepare',intent:clone(intent)};await journal.save(row)}
  if(row.phase==='active'||row.phase==='done')return {phase:row.phase,proof:clone(row.proof),recoverIntent:clone(row.intent)};
  if(row.phase==='prepare'){
   const r=await api.prepare(clone(row.intent));
   if(r.status!==200||!r.ticket)return {held:true,recoverIntent:clone(row.intent)};
   if(r.ticket.claims?.requestId!==row.intent.requestId||!same(r.ticket.claims?.heroIds,row.intent.heroIds))throw Error('Prepared ticket binding');
   row={...row,phase:'start',ticket:clone(r.ticket)};await journal.save(row);
  }
  if(row.phase!=='start'||!row.ticket)throw Error('Held invalid journal');
  const r=await api.start(clone(row.ticket));
  if(r.status!==200)return {held:true,recoverIntent:clone(row.intent)};
  const phase=validate(row,r);await journal.save({...row,phase,proof:clone(r)});
  return {phase,proof:clone(r),recoverIntent:clone(row.intent)};
 }
 function dispatch(intent,newEntry){if(flight)return flight;flight=run(intent,newEntry).finally(()=>{flight=null});return flight}
 return {recover:intent=>dispatch(intent,false),startNew:intent=>dispatch(intent,true)};
}
module.exports={create};
