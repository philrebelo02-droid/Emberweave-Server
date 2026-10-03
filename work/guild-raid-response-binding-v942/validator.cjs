'use strict';const copy=x=>JSON.parse(JSON.stringify(x));
// Only use with the authenticated, captured-session transport. An untrusted JSON
// object cannot prove origin; current-session fences remain the facade's duty.
function validateEntryReply({reply,entry,scope}){
 const b=reply?.body,x=b?.entryBinding;
 if(reply?.status!==200||b?.ok!==true||b?.resumed!==true||!x||x.v!==1||Object.keys(x).sort().join(',')!=='accountId,guildId,heroIds,requestId,v')throw Error('Entry response binding missing or invalid');
 if(x.accountId!==scope.accountId||x.guildId!==scope.guildId||x.requestId!==entry.requestId||!Array.isArray(x.heroIds)||JSON.stringify(x.heroIds)!==JSON.stringify(entry.heroIds))throw Error('Entry response identity mismatch');
 if(typeof b.attemptId!=='string'||!b.attemptId||b.attemptId.length>128||!Number.isSafeInteger(b.seed)||b.seed<0||b.seed>4294967295)throw Error('Entry attempt shape');
 return {...copy(scope),entryRequestId:entry.requestId,entry:copy(entry),attemptId:b.attemptId};
}
module.exports={validateEntryReply};
