'use strict';
// Authenticated captured-session transport must establish origin. This validates
// the fresh response shape/identity only; it does not mint or recover an intent.
function validateFreshEntryReply({reply,entry,scope}){
 const b=reply?.body,x=b?.entryBinding;
 if(reply?.status!==200||b?.ok!==true||b.none===true||!x||x.v!==1||Object.keys(x).sort().join(',')!=='accountId,guildId,heroIds,requestId,v')throw Error('Fresh entry response binding missing');
 if(x.accountId!==scope.accountId||x.guildId!==scope.guildId||x.requestId!==entry.requestId||!Array.isArray(x.heroIds)||JSON.stringify(x.heroIds)!==JSON.stringify(entry.heroIds))throw Error('Fresh entry response identity mismatch');
 if(typeof b.attemptId!=='string'||!b.attemptId||b.attemptId.length>128||!Number.isSafeInteger(b.seed)||b.seed<0||b.seed>4294967295)throw Error('Fresh entry attempt shape');
 return {...scope,entryRequestId:entry.requestId,entry:JSON.parse(JSON.stringify(entry)),attemptId:b.attemptId};
}
module.exports={validateFreshEntryReply};
