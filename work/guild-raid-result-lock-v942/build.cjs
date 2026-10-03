'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const source=fs.readFileSync(path.join(__dirname,'../guild-raid-cleanup-lock-v942/payload/combined/emberweave-heroes.html'),'utf8');assert.equal(hash(source),'0f7ee8d2e850bebca11f736b291dc29d814d8b520564a576b0a27de03415b758');let next=source;const spans=[];
function replace(a,b){assert.equal(next.split(a).length,2,a);next=next.replace(a,b);spans.push([a,b]);}
replace('function raidJournalRead(){','function raidJournalReadCanonical(){');
const helpers=`function raidResultStageRead(){const key=raidJournalKey();if(!key)return null;try{
 const raw=sessionStorage.getItem(key+'_result');if(raw===null)return null;if(raw.length>160000)throw Error('Oversized staged result');
 const p=JSON.parse(raw),b=p.packet;
 if(!p||p.v!==1||p.accountId!==ACC.id||p.guildId!==(G.guild&&G.guild.id)||p.kind!=='resolve'||!Number.isFinite(p.createdAt)||p.createdAt<0||!b||typeof b.requestId!=='string'||!b.requestId||b.requestId.length>48||typeof b.attemptId!=='string'||!b.attemptId||b.attemptId.length>128||!Array.isArray(b.inputLog)||b.inputLog.length>400||!Number.isFinite(b.dmg)||b.dmg<0)throw Error('Invalid staged result');
 return p;
 }catch(e){return{blocked:true,error:'Saved result staging is unavailable. No replacement request sent.'};}}
function raidSamePacket(a,b){return !!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);}
function raidJournalRead(){const old=raidJournalReadCanonical(),stage=raidResultStageRead();if(old?.blocked)return old;if(stage?.blocked)return stage;if(!stage)return old;
 if(!old||(old.kind==='start'&&old.packet.requestId===stage.entryRequestId)||(old.kind==='resolve'&&raidSamePacket(old.packet,stage.packet)&&old.entryRequestId===stage.entryRequestId))return stage;
 return{blocked:true,error:'Competing saved raid identities. No replacement request sent.'};}
function raidResultStageWrite(p,RB){const key=raidJournalKey();if(!key||!p.current())return false;try{
 const old=raidResultStageRead();if(old?.blocked||(old&&(!raidSamePacket(old.packet,p.packet)||old.entryRequestId!==p.entryRequestId)))return false;
 const row={v:1,accountId:ACC.id,guildId:G.guild&&G.guild.id,kind:'resolve',createdAt:p.createdAt,packet:p.packet,entryRequestId:p.entryRequestId||null,RB:{name:String(RB.name||'Raid Boss').slice(0,120),tier:RB.tier|0}},raw=JSON.stringify(row);
 if(raw.length>160000)return false;sessionStorage.setItem(key+'_result',raw);return sessionStorage.getItem(key+'_result')===raw&&!raidResultStageRead()?.blocked;
 }catch(e){return false;}}
function raidResultStageClear(p){try{const key=raidJournalKey(),old=raidResultStageRead();if(!key||!p.current()||!old||old.blocked||!raidSamePacket(old.packet,p.packet)||old.entryRequestId!==p.entryRequestId)return false;sessionStorage.removeItem(key+'_result');return sessionStorage.getItem(key+'_result')===null;}catch(e){return false;}}
async function raidSettlementSend(p,RB){const key=raidJournalKey();if(!key||!p.current()||typeof navigator==='undefined'||!navigator.locks||typeof navigator.locks.request!=='function')return{ok:false,error:'Safe result coordination unavailable. No request sent.'};
 try{return await navigator.locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{
  if(!lock||!p.current())return{ok:false,error:'Another tab is handling this raid. Retry the saved result after it finishes.'};
  if(!raidJournalWrite(p,RB))return{ok:false,error:'Competing or unavailable saved result. No replacement request sent.'};
  const r=await api('/api/guild/raid/resolve','POST',p.packet);
  if(p.current()&&r&&(r.ok||r.expired)){raidJournalClearLocked(p);raidResultStageClear(p);}
  return r;
 });}catch(e){return null;}}
`;
replace('function raidJournalWrite(p,RB){',helpers+'function raidJournalWrite(p,RB){');
replace(' const old=raidJournalRead();if(old&&old.blocked)return false;',' const old=raidJournalReadCanonical();if(old&&old.blocked)return false;');
replace("(old.kind!==p.kind||old.packet.requestId!==p.packet.requestId))return false;","(old.kind!==p.kind||!raidSamePacket(old.packet,p.packet)||old.entryRequestId!==(p.entryRequestId||null)))return false;");
replace("function raidJournalClearLocked(p){if(!p.current())return false;const key=raidJournalKey();try{const old=raidJournalRead();if(!old||old.blocked||old.kind!==p.kind||old.packet.requestId!==p.packet.requestId)return false;localStorage.removeItem(key);return localStorage.getItem(key)===null;}catch(e){return false;}}","function raidJournalClearLocked(p){if(!p.current())return false;const key=raidJournalKey();try{const old=raidJournalReadCanonical();if(!old||old.blocked||old.kind!==p.kind||!raidSamePacket(old.packet,p.packet))return false;localStorage.removeItem(key);return localStorage.getItem(key)===null;}catch(e){return false;}}");
replace("    const pending={current:raidClientFence(),packet,kind:'resolve',createdAt,entryRequestId,busy:false,retry:null};RAID_SETTLEMENT=pending;","    try{packet=JSON.parse(JSON.stringify(packet));}catch(e){bannerMsg('Invalid result packet. No request sent.');return;}\n    const pending={current:raidClientFence(),packet,kind:'resolve',createdAt,entryRequestId,busy:false,retry:null};RAID_SETTLEMENT=pending;");
replace("try{r=raidJournalWrite(pending,RB)?await api('/api/guild/raid/resolve','POST',pending.packet):{ok:false,error:'Could not save result recovery identity. No request sent.'};}","try{r=raidResultStageWrite(pending,RB)?await raidSettlementSend(pending,RB):{ok:false,error:'Could not save result recovery identity. No request sent.'};}");
replace('if(r&&(r.ok||r.expired)&&RAID_SETTLEMENT===pending){raidJournalClear(pending);RAID_SETTLEMENT=null;}','if(r&&(r.ok||r.expired)&&RAID_SETTLEMENT===pending){RAID_SETTLEMENT=null;}');
replace('},800);raidJournalWrite(pending,RB);pending.retry();','},800);raidResultStageWrite(pending,RB);pending.retry();');
replace("if(RAID_SETTLEMENT&&RAID_SETTLEMENT.current()&&RAID_SETTLEMENT.packet.requestId===packet.requestId&&RAID_SETTLEMENT.packet.attemptId===packet.attemptId){raidResolveRetry();return;}","if(RAID_SETTLEMENT&&RAID_SETTLEMENT.current()&&RAID_SETTLEMENT.packet.requestId===packet.requestId&&RAID_SETTLEMENT.packet.attemptId===packet.attemptId){if(!raidSamePacket(RAID_SETTLEMENT.packet,packet)||RAID_SETTLEMENT.entryRequestId!==entryRequestId){bannerMsg('Saved result identity has a different packet. No request sent.');return;}raidResolveRetry();return;}");
const dest=path.join(__dirname,'payload/combined/emberweave-heroes.html');fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest))assert.equal(hash(fs.readFileSync(dest)),'a161b66fec138dd474efabe17c4aa85a57d94323925d1976632c55cad8622971');fs.writeFileSync(dest,next);fs.writeFileSync(path.join(__dirname,'spans.json'),JSON.stringify({base:hash(source),output:hash(next),spans},null,2));console.log(hash(next));
