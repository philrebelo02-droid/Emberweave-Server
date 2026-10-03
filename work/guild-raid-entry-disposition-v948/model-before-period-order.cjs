'use strict';
// Isolated contract model, not an API route or deployment candidate.
const clone=x=>structuredClone(x),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
function intent(x){if(!x||Object.keys(x).sort().join(',')!=='accountId,guildId,heroIds,period,requestId'||['accountId','guildId','period','requestId'].some(k=>typeof x[k]!=='string'||!x[k])||x.requestId.length>48||!Array.isArray(x.heroIds)||!x.heroIds.length||x.heroIds.length>10||x.heroIds.some(k=>typeof k!=='string'||!k)||new Set(x.heroIds).size!==x.heroIds.length)throw Error('Exact intent required');return clone(x)}
function create(store,{period,maxRecords=8}={}){
 if(typeof period!=='string'||!period||!Number.isSafeInteger(maxRecords)||maxRecords<1)throw Error('Authoritative period required');
 async function decide(input,mode){const x=intent(input);if(!['start','cancel'].includes(mode))throw Error('Mode');
  // An old-period proof makes no claim that nothing was spent. It ONLY proves
  // this identity can no longer start. This same guard must precede all sends.
  if(x.period!==period)return {status:200,terminal:{v:1,intent:x,kind:'period-closed',spent:'unknown',lateStartRefused:true}};
  return store.atomic(async db=>{
   const u=db.users[x.accountId];if(!u||u.guildId!==x.guildId)return {status:403,held:true};
   const rows=u.raidEntryDispositions||[],old=rows.find(r=>r.intent.period===x.period&&r.intent.requestId===x.requestId);
   if(old){if(!same(old.intent,x))return {status:409,held:true};return clone(old.reply)}
   // Never evict current-period dispositions. Old-period eviction is safe only
   // because the guard above permanently prevents delayed starts in that era.
   const keep=rows.filter(r=>r.intent.period===period);if(keep.length>=maxRecords)return {status:503,held:true};
   if(mode==='cancel'){
    const reply={status:200,terminal:{v:1,intent:x,kind:'entry-cancelled',spent:false,lateStartRefused:true}};
    u.raidEntryDispositions=[...keep,{intent:x,reply}];return reply;
   }
   u.spent=(u.spent||0)+1;
   const reply={status:200,accepted:{v:1,intent:x,attemptId:'attempt-'+u.spent,spent:true}};
   u.raidEntryDispositions=[...keep,{intent:x,reply}];return reply;
  });
 }
 return {start:x=>decide(x,'start'),cancel:x=>decide(x,'cancel')};
}
module.exports={create};
