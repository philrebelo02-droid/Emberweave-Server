'use strict';
// Private storage prototype. Directory must commit transactions before resolving.
// No game/server/network/legacy migration. Only the enrolling context can stage.
const copy=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function scope(s){if(!s||typeof s.accountId!=='string'||!s.accountId||s.accountId.length>128||typeof s.guildId!=='string'||!s.guildId||s.guildId.length>128)throw Error('Scope');return {accountId:s.accountId,guildId:s.guildId};}
function entry(p){if(!p||typeof p.requestId!=='string'||!p.requestId||p.requestId.length>48||!Array.isArray(p.heroIds)||!p.heroIds.length||p.heroIds.length>8||p.heroIds.some(x=>typeof x!=='string'||!x||x.length>128)||Object.keys(p).some(k=>!['requestId','heroIds'].includes(k)))throw Error('Entry shape');return copy(p);}
function packet(p){if(!p||typeof p.requestId!=='string'||!p.requestId||p.requestId.length>48||typeof p.attemptId!=='string'||!p.attemptId||p.attemptId.length>128||!Array.isArray(p.inputLog)||p.inputLog.length>400||!Number.isFinite(p.dmg)||p.dmg<0||Object.keys(p).some(k=>!['requestId','attemptId','inputLog','dmg'].includes(k)))throw Error('Result shape');const raw=JSON.stringify(p);if(raw.length>160000||/"(?:token|accessToken|authorization|password)"\s*:/i.test(raw))throw Error('Result size/secrets');return JSON.parse(raw);}
const key=r=>'codex_private_raid_slot_v3_'+encodeURIComponent(r.accountId)+'_'+r.id;
function directoryRow(r,s){if(!r||r.v!==3||typeof r.id!=='string'||!/^[-a-z0-9]{1,64}$/i.test(r.id)||r.accountId!==s.accountId||r.guildId!==s.guildId||!['pending','confirmed'].includes(r.state))throw Error('Directory shape');entry(r.entry);if(r.state==='confirmed')packet(r.confirmedPacket);return r;}
function create(directory,storage,options){
 const writers=new Map(),resumedAttempts=new Map(),current=()=>options.isCurrent()===true;
 async function list(s){scope(s);if(!current())throw Error('Stale context');const rows=await directory.list(s.accountId,5);if(!current())throw Error('Stale context');if(!Array.isArray(rows)||rows.length>4)throw Error('Directory bound');return rows.map(r=>directoryRow(r,s));}
 async function enroll(s,p,id){s=scope(s);p=entry(p);if(typeof id!=='string'||!/^[-a-z0-9]{1,64}$/i.test(id))throw Error('Instance ID');if(!current())throw Error('Stale context');if(await options.legacyCheck(s)!=='clear')throw Error('Legacy enrollment held');if(!current())throw Error('Stale context');
  const r={v:3,...s,id,entry:p,state:'pending'};
  // atomic directory implementation must reject duplicate entry identities/cap.
  await directory.insertBounded(r,4);if(!current())throw Error('Stale context after enrollment');writers.set(id,copy(r));return copy(r);
 }
 async function resumeValidated(s,id,proof){s=scope(s);if(!current())throw Error('Stale context');const found=(await recover(s)).find(x=>x.row.id===id);if(!current())throw Error('Stale context');if(!found||found.status!=='entry-recovery-only'||found.row.state!=='pending')throw Error('Resume state refused');
  if(!proof||proof.accountId!==s.accountId||proof.guildId!==s.guildId||proof.entryRequestId!==found.row.entry.requestId||!same(proof.entry,found.row.entry)||typeof proof.attemptId!=='string'||!proof.attemptId||proof.attemptId.length>128)throw Error('Resume proof binding');
  // Only the facade's authenticated-response validator may supply this proof.
  writers.set(id,copy(found.row));resumedAttempts.set(id,proof.attemptId);return copy(found.row);
 }
 function stage(r,p){if(!current())throw Error('Stale context');const own=writers.get(r.id);if(!own||!same(own,r))throw Error('No writer lease');p=packet(p);if(resumedAttempts.has(r.id)&&p.attemptId!==resumedAttempts.get(r.id))throw Error('Resumed attempt binding');
  const data={v:3,accountId:r.accountId,guildId:r.guildId,instanceId:r.id,entryRequestId:r.entry.requestId,packet:p};const raw=JSON.stringify(data),k=key(r),old=storage.getItem(k);
  if(old!==null&&old!==raw)throw Error('Immutable slot conflict');storage.setItem(k,raw);if(storage.getItem(k)!==raw)throw Error('Slot readback');return copy(data);
 }
 async function recover(s){s=scope(s);const rows=await list(s),results=[];
  for(const r of rows){const raw=storage.getItem(key(r));if(raw===null){results.push({row:copy(r),status:r.state==='confirmed'?'confirmed-cleanup':'entry-recovery-only'});continue;}
   if(raw.length>160000)throw Error('Slot size');const p=JSON.parse(raw);if(p.v!==3||p.accountId!==s.accountId||p.guildId!==s.guildId||p.instanceId!==r.id||p.entryRequestId!==r.entry.requestId)throw Error('Slot binding');packet(p.packet);
   if(p.confirmed===true&&r.state!=='confirmed')throw Error('Unexpected confirmation marker');if(r.state==='confirmed'&&!same(r.confirmedPacket,p.packet))throw Error('Confirmed packet conflict');results.push({row:copy(r),status:r.state==='confirmed'?'confirmed-cleanup':'result-recovery-only',packet:copy(p.packet)});
  }if(results.filter(r=>r.status==='result-recovery-only').length>1)throw Error('Competing results');return results;
 }
 async function confirm(s,id,p){s=scope(s);p=packet(p);const row=(await list(s)).find(r=>r.id===id);if(!row)throw Error('Unknown instance');const recovered=(await recover(s)).find(r=>r.row.id===id);if(!recovered?.packet||!same(recovered.packet,p))throw Error('Confirmation binding');
  // Caller must have independently validated current server confirmation.
  await directory.markConfirmed(row,p);if(!current())throw Error('Stale context');return true;
 }
 async function cleanup(s,id){s=scope(s);const found=(await recover(s)).find(r=>r.row.id===id);if(!found)return false;if(found.row.state!=='confirmed')throw Error('Unconfirmed cleanup refused');
  const r=found.row,k=key(r),raw=storage.getItem(k);
  const p=raw===null?{v:3,accountId:r.accountId,guildId:r.guildId,instanceId:r.id,entryRequestId:r.entry.requestId,packet:copy(r.confirmedPacket)}:JSON.parse(raw);
  if(!same(p.packet,r.confirmedPacket))throw Error('Cleanup conflict');
  // Reconstruct a missing terminal fence from the committed confirmation BEFORE
  // retiring discovery. Storage failure must keep the confirmed row recoverable.
  const marker=JSON.stringify({...p,confirmed:true});storage.setItem(k,marker);if(storage.getItem(k)!==marker)throw Error('Cleanup readback');
  // Keep terminal slot marker: other contexts may still hold an old writer lease.
  // No automatic marker eviction; quota/retention design remains unresolved.
  if(!current())throw Error('Stale context');await directory.retireConfirmed(found.row);writers.delete(id);return true;
 }
 return {enroll,stage,recover,confirm,cleanup,resumeValidated};
}
module.exports={create,key};
