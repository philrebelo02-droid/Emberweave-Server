'use strict';
// Private entry-only validator. Caller must authenticate transport, fence the
// captured session after every await and prove no result slot under its lock.
const keys=(x,want)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===want.slice().sort().join(',');
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
async function validate({reply,entry,scope,recoveryStatus,digest}){
 if(recoveryStatus!=='entry-recovery-only'||typeof digest!=='function'||!scope||typeof scope.accountId!=='string'||!scope.accountId||typeof scope.guildId!=='string'||!scope.guildId)return null;
 if(!keys(entry,['requestId','heroIds'])||typeof entry.requestId!=='string'||!/^r3:\d{4}-\d{2}-\d{2}:[-a-z0-9]{1,24}$/.test(entry.requestId)||!Array.isArray(entry.heroIds)||!entry.heroIds.length||entry.heroIds.length>10||entry.heroIds.some(k=>typeof k!=='string'||!k||k.length>128)||new Set(entry.heroIds).size!==entry.heroIds.length)return null;
 const p=entry.requestId.slice(3,13),b=reply?.body,c=b?.entryClosure;
 if(reply?.status!==409||b?.ok!==false||b?.entryPeriodHeld!==true||!keys(c,['v','kind','spent','accountId','guildId','requestId','heroIds','serverPeriod','packetHash']))return null;
 if(c.v!==1||c.kind!=='period-closed'||c.spent!=='unknown'||c.accountId!==scope.accountId||c.guildId!==scope.guildId||c.requestId!==entry.requestId||JSON.stringify(c.heroIds)!==JSON.stringify(entry.heroIds)||!day(p)||!day(c.serverPeriod)||p>=c.serverPeriod||typeof c.packetHash!=='string'||! /^[0-9a-f]{64}$/.test(c.packetHash))return null;
 if(await digest(JSON.stringify({requestId:entry.requestId,heroIds:entry.heroIds}))!==c.packetHash)return null;
 return {v:1,kind:'period-closed',spent:'unknown',accountId:c.accountId,guildId:c.guildId,entry:structuredClone(entry),serverPeriod:c.serverPeriod,packetHash:c.packetHash};
}
module.exports={validate};
