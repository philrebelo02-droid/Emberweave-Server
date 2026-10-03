'use strict';
// Private adapter prototype. No game integration, migration, paid intent or network.
const clone=x=>JSON.parse(JSON.stringify(x));
function validated(row){
 const raw=JSON.stringify(row);if(!raw||raw.length>160000)throw Error('Row size');
 const p=clone(row),b=p.packet;
 const fields=['v','id','accountId','guildId','createdAt','packet','entryRequestId'];
 if(Object.keys(p).some(k=>!fields.includes(k))||p.v!==2||!/^[-a-z0-9]{1,64}$/i.test(p.id)||typeof p.accountId!=='string'||!p.accountId||p.accountId.length>128||typeof p.guildId!=='string'||!p.guildId||p.guildId.length>128||!Number.isFinite(p.createdAt)||p.createdAt<0||!(p.entryRequestId===null||(typeof p.entryRequestId==='string'&&p.entryRequestId.length>0&&p.entryRequestId.length<=48)))throw Error('Row shape');
 if(!b||Object.keys(b).some(k=>!['requestId','attemptId','inputLog','dmg'].includes(k))||typeof b.requestId!=='string'||!b.requestId||b.requestId.length>48||typeof b.attemptId!=='string'||!b.attemptId||b.attemptId.length>128||!Array.isArray(b.inputLog)||b.inputLog.length>400||!Number.isFinite(b.dmg)||b.dmg<0)throw Error('Packet shape');
 // Input records are still only shape/size bounded here, not gameplay validated.
 if(/"(?:token|accessToken|authorization|password)"\s*:/i.test(raw))throw Error('Secrets prohibited');
 return p;
}
const identity=(a,b)=>a.accountId===b.accountId&&a.guildId===b.guildId&&a.entryRequestId===b.entryRequestId&&JSON.stringify(a.packet)===JSON.stringify(b.packet);
function transact(db,mode,operation){return new Promise((resolve,reject)=>{
 let tx,value,problem,finished=false;
 const fail=e=>{problem=e instanceof Error?e:Error(String(e));try{tx.abort();}catch{if(!finished){finished=true;reject(problem);}}};
 try{
  tx=db.transaction('results',mode);
  tx.oncomplete=()=>{if(finished)return;finished=true;problem?reject(problem):resolve(clone(value));};
  tx.onabort=()=>{if(!finished){finished=true;reject(problem||tx.error||Error('Transaction aborted'));}};
  // An error event is not a durable commit. Only oncomplete resolves.
  tx.onerror=()=>{problem=tx.error||Error('Transaction error');};
  operation(tx.objectStore('results'),v=>{value=v;},fail);
 }catch(e){if(tx)fail(e);else reject(e);}
});}
function readBounded(store,account,done,fail){
 const q=store.index('account').getAll(account,5);
 q.onerror=()=>fail(q.error||Error('Read failed'));
 q.onsuccess=()=>{try{const rows=q.result.map(validated);if(rows.length>4||rows.some(p=>p.accountId!==account))throw Error('Account bound');done(rows);}catch(e){fail(e);}};
}
function register(db,row){let p;try{p=validated(row);}catch(e){return Promise.reject(e);}
 return transact(db,'readwrite',(store,done,fail)=>readBounded(store,p.accountId,rows=>{
  const prior=rows.find(q=>q.packet.requestId===p.packet.requestId);
  if(prior){if(!identity(prior,p))return fail(Error('Changed identity'));return done({row:prior,reused:true});}
  if(rows.length>=4)return fail(Error('Account capacity'));
  const q=store.add(p);q.onerror=()=>fail(q.error||Error('Immutable add failed'));q.onsuccess=()=>done({row:p,reused:false});
 },fail));
}
function discover(db,account,guild){return transact(db,'readonly',(store,done,fail)=>readBounded(store,account,rows=>{
 if(rows.some(p=>p.guildId!==guild))return fail(Error('Guild transition held'));
 if(rows.length>1&&rows.some(p=>!identity(p,rows[0])))return fail(Error('Competing results'));
 done(rows);
},fail));}
function clearConfirmed(db,row){let p;try{p=validated(row);}catch(e){return Promise.reject(e);}
 return transact(db,'readwrite',(store,done,fail)=>{
  const q=store.get([p.accountId,p.id]);q.onerror=()=>fail(q.error||Error('Read failed'));
  q.onsuccess=()=>{try{if(!q.result)return done(false);const old=validated(q.result);if(!identity(old,p))return fail(Error('Cleanup identity mismatch'));const del=store.delete([p.accountId,p.id]);del.onerror=()=>fail(del.error||Error('Delete failed'));del.onsuccess=()=>done(true);}catch(e){fail(e);}};
 });
}
module.exports={register,discover,clearConfirmed,validated};
