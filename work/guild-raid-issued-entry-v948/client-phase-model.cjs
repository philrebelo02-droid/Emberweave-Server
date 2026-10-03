'use strict';
// Isolated protocol model, not installed client code or a storage adapter.
function create(journal,api){let flight=null;
 async function run(intent){let row=await journal.read();
  if(!row){if(!intent)throw Error('No saved intent');row={phase:'prepare',intent:structuredClone(intent)};await journal.save(row)}
  if(row.phase==='prepare'){
   const r=await api.prepare(structuredClone(row.intent));
   if(r.status!==200||!r.ticket)return {held:true};
   row={...row,phase:'start',ticket:structuredClone(r.ticket)};
   await journal.save(row); // A save failure must leave no start network call.
  }
  if(row.phase!=='start'||!row.ticket)throw Error('Held invalid journal');
  // This endpoint accepts ONLY this exact issued ticket. Unknown remains held.
  return api.start(structuredClone(row.ticket));
 }
 return {recover(intent){if(flight)return flight;flight=run(intent).finally(()=>{flight=null});return flight}};
}
module.exports={create};
