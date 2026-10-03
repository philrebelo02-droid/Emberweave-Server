'use strict';
// Private contract component. No HTML cutover, network adapter or auth authority.
const H=require('./hybrid-adapter.cjs'),copy=x=>JSON.parse(JSON.stringify(x));
function inspectLegacy(storage,accountId){
 if(typeof accountId!=='string'||!accountId||accountId.length>128)throw Error('Legacy scope');
 const canonical='ew_raid_pending_v1_'+encodeURIComponent(accountId),prefix=canonical+'_result_';
 const n=storage.length;if(!Number.isSafeInteger(n)||n<0||n>4096)throw Error('Legacy inspection bound');
 if(storage.getItem(canonical)!==null)throw Error('Legacy canonical unresolved');
 const seen=new Set();for(let i=0;i<n;i++){const k=storage.key(i);if(typeof k!=='string'||seen.has(k))throw Error('Legacy enumeration uncertain');seen.add(k);if(k.startsWith(prefix))throw Error('Legacy stage unresolved');}
 if(storage.length!==n||storage.getItem(canonical)!==null)throw Error('Legacy changed');return 'clear';
}
function create({directory,storage,context,locks,transport,legacyWritersQuiescent,validateEntryReply,validateFreshEntryReply,validateSettlementReply}){
 const c=context();if(!c||typeof c.accountId!=='string'||!c.accountId||typeof c.guildId!=='string'||!c.guildId||typeof c.token!=='string'||!c.token||!Number.isSafeInteger(c.epoch))throw Error('Session required');const captured={...c};
 const current=()=>{const now=context();return !!now&&['accountId','guildId','token','epoch'].every(k=>now[k]===captured[k]);};
 function guard(){if(!current())throw Error('Stale session');}
 async function legacy(){guard();if(await legacyWritersQuiescent(captured)!==true)throw Error('Legacy writers not proven quiescent');guard();return inspectLegacy(storage,captured.accountId)}
 const scope={accountId:captured.accountId,guildId:captured.guildId},h=H.create(directory,storage,{isCurrent:current,legacyCheck:legacy});
 const acceptedAttempts=new Map();
 async function locked(fn){guard();if(!locks||typeof locks.request!=='function')throw Error('Safe lock unavailable');const result=await locks.request('ew_raid_pending_v1_'+encodeURIComponent(scope.accountId),{mode:'exclusive',ifAvailable:true},async lock=>{guard();if(!lock)throw Error('Busy recovery');return fn()});guard();return result}
 async function start(entry,id){return locked(async()=>{await legacy();guard();const outstanding=await h.recover(scope);guard();if(outstanding.length)throw Error('Recover existing instance first');const r=await h.enroll(scope,entry,id);guard();await legacy();guard();const reply=await transport({mode:'fresh-entry',packet:copy(r.entry),scope:copy(scope)});guard();
  if(typeof validateFreshEntryReply!=='function')throw Error('Authenticated fresh entry validator required');
  const proof=await validateFreshEntryReply({reply,entry:copy(r.entry),scope:copy(scope)});guard();
  if(reply?.status!==200||reply.body?.ok!==true||!proof||proof.accountId!==scope.accountId||proof.guildId!==scope.guildId||proof.entryRequestId!==r.entry.requestId||JSON.stringify(proof.entry)!==JSON.stringify(r.entry)||typeof proof.attemptId!=='string'||!proof.attemptId||proof.attemptId.length>128||proof.attemptId!==reply.body.attemptId)throw Error('Fresh entry response refused');
  acceptedAttempts.set(id,proof.attemptId);return {row:r,reply};})}
 async function stage(r,p){guard();if(!r||!acceptedAttempts.has(r.id)||p?.attemptId!==acceptedAttempts.get(r.id))throw Error('Accepted attempt binding required');const row=copy(r),saved=copy(p);return locked(async()=>{await legacy();guard();const found=(await h.recover(scope)).find(x=>x.row.id===row.id);guard();if(!found||found.row.state!=='pending'||JSON.stringify(found.row)!==JSON.stringify(row))throw Error('Stage directory changed');return h.stage(row,saved);})}
 async function discover(){return locked(async()=>{await legacy();guard();const rows=await h.recover(scope);guard();
  // Presentation receives bounded identities/status only, never saved packets,
  // tokens or a fresh intent. Invalid or ambiguous storage remains held.
  const ids=new Set(),entries=new Set();for(const found of rows){if(ids.has(found.row.id)||entries.has(found.row.entry.requestId))throw Error('Ambiguous recovery directory');ids.add(found.row.id);entries.add(found.row.entry.requestId);}
  return rows.map(found=>({id:found.row.id,status:found.status}));
 })}
 async function recover(id){return locked(async()=>{await legacy();guard();const rows=await h.recover(scope);guard();const found=rows.find(x=>x.row.id===id);if(!found||found.status==='confirmed-cleanup')throw Error('No recoverable instance');const entry=found.status==='entry-recovery-only',p=entry?found.row.entry:found.packet;
  // Transport must prove server support for strict recovery-only; never paid fallback.
  const reply=await transport({mode:entry?'entry-recovery-only':'result-recovery-only',packet:copy(p),scope:copy(scope)});guard();return {status:found.status,packet:copy(p),reply};})}
 async function resume(id){return locked(async()=>{await legacy();guard();const found=(await h.recover(scope)).find(x=>x.row.id===id);guard();if(!found||found.status!=='entry-recovery-only')throw Error('Resume state refused');
  const reply=await transport({mode:'entry-recovery-only',packet:copy(found.row.entry),scope:copy(scope)});guard();
  if(typeof validateEntryReply!=='function')throw Error('Authenticated entry validator required');
  const proof=await validateEntryReply({reply,entry:copy(found.row.entry),scope:copy(scope)});guard();
  if(!proof||proof.accountId!==scope.accountId||proof.guildId!==scope.guildId||proof.entryRequestId!==found.row.entry.requestId||proof.attemptId!==reply?.body?.attemptId||reply.status!==200||reply.body?.ok!==true||reply.body?.resumed!==true)throw Error('Resume response refused');
  const row=await h.resumeValidated(scope,id,proof);guard();acceptedAttempts.set(id,proof.attemptId);return {row,reply};})}
 async function settle(id){return locked(async()=>{await legacy();guard();const found=(await h.recover(scope)).find(x=>x.row.id===id);guard();
  // A durable confirmation survives a failed retirement. Finish storage only;
  // do not replay the paid/result intent or manufacture another server grant.
  if(found?.status==='confirmed-cleanup'){await h.cleanup(scope,id);guard();return {status:200,body:{cleanupOnly:true}};}
  if(!found||found.status!=='result-recovery-only')throw Error('No staged result');
  const reply=await transport({mode:'result-recovery-only',packet:copy(found.packet),scope:copy(scope)});guard();if(typeof validateSettlementReply!=='function')throw Error('Settlement validator required');
  if(await validateSettlementReply({reply,packet:copy(found.packet),scope:copy(scope)})!==true)throw Error('Unconfirmed settlement');guard();await h.confirm(scope,id,found.packet);guard();await h.cleanup(scope,id);guard();return reply;
 })}
 return {start,stage,recover,current,resume,settle,discover};
}
module.exports={create,inspectLegacy};

