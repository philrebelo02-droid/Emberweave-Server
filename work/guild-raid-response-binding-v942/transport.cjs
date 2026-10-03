'use strict';const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function createTransport({context,fetch}){
 const captured={...context()};if(!captured.accountId||!captured.guildId||typeof captured.token!=='string'||!captured.token||!Number.isSafeInteger(captured.epoch))throw Error('Authenticated session required');
 function guard(){const now=context();if(!now||!['accountId','guildId','token','epoch'].every(k=>now[k]===captured[k]))throw Error('Stale transport session')}
 return async function transport({mode,scope,packet}){guard();if(!same(scope,{accountId:captured.accountId,guildId:captured.guildId}))throw Error('Transport scope mismatch');
  if(!['fresh-entry','entry-recovery-only','result-recovery-only'].includes(mode))throw Error('Transport mode');
  const raw=JSON.stringify(packet);if(!raw||raw.length>160000||/"(?:token|accessToken|authorization|password)"\s*:/i.test(raw))throw Error('Transport packet size/secrets');const body=JSON.parse(raw);
  const entry=mode!=='result-recovery-only';if(entry&&Object.keys(body).some(k=>!['requestId','heroIds'].includes(k)))throw Error('Entry packet fields');if(!entry&&Object.keys(body).some(k=>!['requestId','attemptId','inputLog','dmg'].includes(k)))throw Error('Result packet fields');
  if(mode==='entry-recovery-only')body.recoverOnly=true;
  const response=await fetch(entry?'/api/guild/raid/start':'/api/guild/raid/resolve',{method:'POST',headers:{'content-type':'application/json','x-token':captured.token},body:JSON.stringify(body)});guard();
  const result=await response.json();guard();return {status:response.status,body:result};
 };
}
module.exports={createTransport};
