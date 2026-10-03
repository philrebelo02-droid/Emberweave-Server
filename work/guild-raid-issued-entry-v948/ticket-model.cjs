'use strict';
// Private server-issued intent contract model. Not an installed server route.
const crypto=require('node:crypto'),clone=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function packet(p){if(!p||Object.keys(p).sort().join(',')!=='heroIds,requestId'||typeof p.requestId!=='string'||!/^r3-[-a-z0-9]{8,40}$/i.test(p.requestId)||!Array.isArray(p.heroIds)||!p.heroIds.length||p.heroIds.length>10||p.heroIds.some(k=>typeof k!=='string'||!k||k.length>128)||new Set(p.heroIds).size!==p.heroIds.length)throw Error('Exact v3 intent required');return {requestId:p.requestId,heroIds:clone(p.heroIds)}}
function create(store,{context,clock,secret,maxRecords=8,sessionMs=600000}={}){
 if(typeof context!=='function'||typeof clock!=='function'||typeof secret!=='string'||secret.length<16)throw Error('Trusted server adapters required');
 if(!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>64||!Number.isSafeInteger(sessionMs)||sessionMs<1||sessionMs>600000)throw Error('Bounded server configuration required');
 const principal=clone(context()),current=()=>{const p=context();return p&&p.accountId===principal.accountId&&p.epoch===principal.epoch};
 if(typeof principal?.accountId!=='string'||!principal.accountId||!Number.isSafeInteger(principal.epoch))throw Error('Authenticated actor required');
 const sign=t=>crypto.createHmac('sha256',secret).update(JSON.stringify(t)).digest('hex');
 function validateTicket(t){if(!t||Object.keys(t).sort().join(',')!=='claims,signature')throw Error('Ticket');const q=t.claims;if(!q||Object.keys(q).sort().join(',')!=='accountId,expiresAt,guildId,heroIds,issuedAt,period,requestId,v'||q.v!==1||q.accountId!==principal.accountId||typeof q.guildId!=='string'||!q.guildId||!Number.isSafeInteger(q.issuedAt)||!Number.isSafeInteger(q.expiresAt)||q.expiresAt-q.issuedAt!==sessionMs||q.period!==new Date(q.issuedAt).toISOString().slice(0,10))throw Error('Ticket binding');packet({requestId:q.requestId,heroIds:q.heroIds});const normalized={v:1,accountId:q.accountId,guildId:q.guildId,requestId:q.requestId,heroIds:clone(q.heroIds),period:q.period,issuedAt:q.issuedAt,expiresAt:q.expiresAt};if(typeof t.signature!=='string'||t.signature!==sign(normalized))throw Error('Ticket signature');return {claims:normalized,signature:t.signature}}
 async function atomic(fn){if(!current())throw Error('Stale actor');const r=await store.atomic(async db=>{if(!current())throw Error('Stale actor');const u=db.users[principal.accountId];if(!u)throw Error('Unknown actor');const now=clock();if(!Number.isSafeInteger(now)||now<0)throw Error('Server clock');return fn(u,now)});if(!current())throw Error('Stale actor after commit');return r}
 const terminal=(row,kind,spent)=>({status:200,terminal:{ticket:clone(row.ticket),kind,spent,lateStartRefused:true}});
 async function prepare(p,{recoverOnly=false}={}){p=packet(p);if(typeof recoverOnly!=='boolean')throw Error('Mode');return atomic((u,now)=>{const rows=u.raidEntryTickets||[],old=rows.find(r=>r.ticket.claims.requestId===p.requestId);
  if(old){if(!same(old.ticket.claims.heroIds,p.heroIds))return {status:409,held:true};return {status:200,ticket:clone(old.ticket)}}
  if(recoverOnly)return {status:409,held:true};if(typeof u.guildId!=='string'||!u.guildId)return {status:403,held:true};if(rows.length>=maxRecords)return {status:503,held:true};
  if(!Number.isSafeInteger(now+sessionMs)||now+sessionMs>8640000000000000)throw Error('Bounded server clock required');
  const claims={v:1,accountId:principal.accountId,guildId:u.guildId,requestId:p.requestId,heroIds:p.heroIds,period:new Date(now).toISOString().slice(0,10),issuedAt:now,expiresAt:now+sessionMs},ticket={claims,signature:sign(claims)};
  u.raidEntryTickets=[...rows,{ticket,state:'prepared'}];return {status:200,ticket:clone(ticket)};
 })}
 async function decide(ticket,mode){const t=validateTicket(ticket);return atomic((u,now)=>{const row=(u.raidEntryTickets||[]).find(r=>r.ticket.claims.requestId===t.claims.requestId);
  if(!row||!same(row.ticket,t))return {status:409,held:true};if(row.reply)return clone(row.reply);
  if(now<t.claims.issuedAt)return {status:409,held:true};
  if(mode==='cancel'||now>t.claims.expiresAt||u.guildId!==t.claims.guildId){row.state='cancelled';row.reply=terminal(row,mode==='cancel'?'cancelled':u.guildId!==t.claims.guildId?'guild-changed':'expired-unspent',false);return clone(row.reply)}
  u.spent=(u.spent||0)+1;row.state='accepted';row.reply={status:200,accepted:{ticket:clone(t),attemptId:'attempt-'+u.spent,spent:true}};return clone(row.reply);
 })}
 // All legacy/no-ticket requests in the new protocol namespace must be refused
 // before spend. This does not implement compatibility for older namespaces.
 return {prepare,start:t=>decide(t,'start'),cancel:t=>decide(t,'cancel'),legacyV3Start:async()=>({status:426,held:true})};
}
module.exports={create};
