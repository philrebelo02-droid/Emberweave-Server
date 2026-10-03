'use strict';
// Private v3 directory. No game, auth, payment or migration integration.
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=p=>p!==null&&typeof p==='object'&&!Array.isArray(p);
const keys=(p,allowed)=>object(p)&&Object.keys(p).every(k=>allowed.includes(k));
const text=(p,n)=>typeof p==='string'&&p.length>0&&p.length<=n;
function packet(p){if(!keys(p,['requestId','attemptId','inputLog','dmg'])||!text(p.requestId,48)||!text(p.attemptId,128)||!Array.isArray(p.inputLog)||p.inputLog.length>400||!Number.isFinite(p.dmg)||p.dmg<0)throw Error('Confirmed packet');return clone(p)}
function row(p){
 if(!keys(p,['v','accountId','guildId','id','entry','state','confirmedPacket'])||p.v!==3||!text(p.accountId,128)||!text(p.guildId,128)||!text(p.id,64)||!/^[-a-z0-9]+$/i.test(p.id)||!['pending','confirmed'].includes(p.state)||!keys(p.entry,['requestId','heroIds'])||!text(p.entry.requestId,48)||!Array.isArray(p.entry.heroIds)||!p.entry.heroIds.length||p.entry.heroIds.length>10||p.entry.heroIds.some(x=>!text(x,128))||new Set(p.entry.heroIds).size!==p.entry.heroIds.length)throw Error('Directory row');
 if(p.state==='pending'&&Object.prototype.hasOwnProperty.call(p,'confirmedPacket'))throw Error('Unexpected confirmed packet');
 if(p.state==='confirmed')packet(p.confirmedPacket);
 const raw=JSON.stringify(p);if(raw.length>160000||/"(?:token|accessToken|authorization|password)"\s*:/i.test(raw))throw Error('Directory size/secrets');return JSON.parse(raw);
}
function create(db){
 function tx(mode,fn){return new Promise((resolve,reject)=>{let t,value,problem,ended=false;const fail=e=>{problem=e;try{t.abort()}catch{if(!ended){ended=true;reject(e)}}};try{t=db.transaction('slots',mode);t.oncomplete=()=>{if(!ended){ended=true;problem?reject(problem):resolve(clone(value))}};t.onabort=()=>{if(!ended){ended=true;reject(problem||t.error||Error('Directory aborted'))}};t.onerror=()=>{problem=t.error||Error('Directory error')};fn(t.objectStore('slots'),v=>value=v,fail)}catch(e){if(t)fail(e);else reject(e)}})}
 function read(s,account,n,done,fail){const q=s.index('account').getAll(account,n);q.onerror=()=>fail(q.error);q.onsuccess=()=>{try{const rows=q.result.map(row);if(rows.some(r=>r.accountId!==account))throw Error('Scope mismatch');done(rows)}catch(e){fail(e)}}}
 return {
  list(account,n){if(typeof account!=='string'||!account||account.length>128||n!==5)return Promise.reject(Error('Bounded scope required'));return tx('readonly',(s,done,fail)=>read(s,account,5,done,fail))},
  insertBounded(p,cap){let r;try{r=row(p);if(cap!==4||r.state!=='pending')throw Error('Enrollment contract')}catch(e){return Promise.reject(e)}return tx('readwrite',(s,done,fail)=>read(s,r.accountId,5,rows=>{if(rows.length>=4)return fail(Error('Capacity'));if(rows.some(x=>x.id===r.id||x.entry.requestId===r.entry.requestId))return fail(Error('Duplicate intent'));const q=s.add(r);q.onerror=()=>fail(q.error);q.onsuccess=()=>done(true)},fail))},
  markConfirmed(p,result){let r,b;try{r=row(p);b=packet(result)}catch(e){return Promise.reject(e)}return tx('readwrite',(s,done,fail)=>{const q=s.get([r.accountId,r.id]);q.onerror=()=>fail(q.error);q.onsuccess=()=>{try{const old=row(q.result);if(!same(old,r))throw Error('Confirmation row changed');if(old.state==='confirmed'){if(!same(old.confirmedPacket,b))throw Error('Terminal packet changed');return done(true)}const next=row({...old,state:'confirmed',confirmedPacket:b});const w=s.put(next);w.onerror=()=>fail(w.error);w.onsuccess=()=>done(true)}catch(e){fail(e)}}})},
  retireConfirmed(p){let r;try{r=row(p);if(r.state!=='confirmed')throw Error('Not confirmed')}catch(e){return Promise.reject(e)}return tx('readwrite',(s,done,fail)=>{const q=s.get([r.accountId,r.id]);q.onerror=()=>fail(q.error);q.onsuccess=()=>{try{if(!q.result)return done(false);if(!same(row(q.result),r))throw Error('Retirement row changed');const d=s.delete([r.accountId,r.id]);d.onerror=()=>fail(d.error);d.onsuccess=()=>done(true)}catch(e){fail(e)}}})}
 };
}
module.exports={create,row};

