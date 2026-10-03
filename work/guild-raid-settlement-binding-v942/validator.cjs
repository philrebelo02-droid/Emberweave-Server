'use strict';
async function validateSettlement({reply,packet,scope,digest}){
 const b=reply?.body,x=b?.settlementBinding;if(reply?.status!==200||!(b?.ok===true||b?.ok===false&&b?.expired===true)||!x||x.v!==1||Object.keys(x).sort().join(',')!=='accountId,attemptId,guildId,packetHash,requestId,v')throw Error('Unconfirmed settlement');
 if(x.accountId!==scope.accountId||x.guildId!==scope.guildId||x.requestId!==packet.requestId||x.attemptId!==packet.attemptId||typeof x.packetHash!=='string'||!/^[a-f0-9]{64}$/.test(x.packetHash))throw Error('Settlement identity mismatch');
 const raw=JSON.stringify({requestId:packet.requestId,attemptId:packet.attemptId,inputLog:packet.inputLog,dmg:packet.dmg});if(raw.length>160000||typeof digest!=='function')throw Error('Settlement digest dependency');
 if(await digest(raw)!==x.packetHash)throw Error('Settlement packet mismatch');return true;
}
module.exports={validateSettlement};
