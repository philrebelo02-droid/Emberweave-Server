function raidResultStageDecode(raw,key){
 if(typeof raw!=='string'||raw.length>160000)throw Error('Oversized staged result');
 const p=JSON.parse(raw),b=p&&p.packet;
 if(!p||p.v!==1||p.accountId!==ACC.id||p.guildId!==(G.guild&&G.guild.id)||p.kind!=='resolve'||!Number.isFinite(p.createdAt)||p.createdAt<0||!(p.entryRequestId===null||(typeof p.entryRequestId==='string'&&p.entryRequestId.length>0&&p.entryRequestId.length<=48))||!b||typeof b.requestId!=='string'||!b.requestId||b.requestId.length>48||typeof b.attemptId!=='string'||!b.attemptId||b.attemptId.length>128||!Array.isArray(b.inputLog)||b.inputLog.length>400||!Number.isFinite(b.dmg)||b.dmg<0)throw Error('Invalid staged result');
 return {...p,stageKey:key};
}
function raidResultStageRows(){const key=raidJournalKey();if(!key)return[];try{
 const n=localStorage.length,rows=[];if(!Number.isSafeInteger(n)||n<0||n>512)throw Error('Recovery key bound');
 for(let i=0;i<n;i++){const k=localStorage.key(i);if(typeof k!=='string'||!k.startsWith(key+'_result_'))continue;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k.slice((key+'_result_').length)))throw Error('Invalid stage key');
  rows.push(raidResultStageDecode(localStorage.getItem(k),k));if(rows.length>4)throw Error('Too many staged results');
 }return rows;
 }catch(e){return{blocked:true,error:'Saved result staging is unavailable or exceeds its bound. No replacement request sent.'};}}
function raidSamePacket(a,b){return !!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);}
function raidResultStageRead(){const rows=raidResultStageRows();if(rows.blocked)return rows;if(!rows.length)return null;
 const old=raidJournalReadCanonical();if(old?.blocked)return old;
 if(old?.kind==='resolve'){const match=rows.find(p=>raidSamePacket(p.packet,old.packet)&&p.entryRequestId===old.entryRequestId);if(match)return match;}
 const p=rows[0];if(rows.some(q=>!raidSamePacket(p.packet,q.packet)||p.entryRequestId!==q.entryRequestId))return{blocked:true,error:'Competing staged raid results. No replacement request sent.'};return p;
}
function raidJournalRead(){const old=raidJournalReadCanonical(),stage=raidResultStageRead();if(old?.blocked)return old;if(stage?.blocked)return stage;if(!stage)return old;
 if(!old||(old.kind==='start'&&old.packet.requestId===stage.entryRequestId)||(old.kind==='resolve'&&raidSamePacket(old.packet,stage.packet)&&old.entryRequestId===stage.entryRequestId))return stage;
 return{blocked:true,error:'Competing saved raid identities. No replacement request sent.'};}
function raidResultStageWrite(p,RB){const key=raidJournalKey();if(!key||!p.current())return false;try{
 const rows=raidResultStageRows();if(rows.blocked)return false;const match=rows.find(q=>raidSamePacket(q.packet,p.packet)&&q.entryRequestId===p.entryRequestId);
 const old=raidJournalReadCanonical();if(old?.blocked)return false;
 if(old&&!(old.kind==='start'&&old.packet.requestId===p.entryRequestId)&&!(old.kind==='resolve'&&raidSamePacket(old.packet,p.packet)&&old.entryRequestId===p.entryRequestId))return false;
 if(match){if(rows.some(q=>!raidSamePacket(q.packet,p.packet)||q.entryRequestId!==p.entryRequestId)&&!(old?.kind==='resolve'&&raidSamePacket(old.packet,p.packet)&&old.entryRequestId===p.entryRequestId))return false;return true;}
 if(rows.length||typeof crypto==='undefined'||typeof crypto.randomUUID!=='function')return false;
 const stageKey=key+'_result_'+crypto.randomUUID();if(localStorage.getItem(stageKey)!==null)return false;
 const row={v:1,accountId:ACC.id,guildId:G.guild&&G.guild.id,kind:'resolve',createdAt:p.createdAt,packet:p.packet,entryRequestId:p.entryRequestId||null,RB:{name:String(RB.name||'Raid Boss').slice(0,120),tier:RB.tier|0}},raw=JSON.stringify(row);
 raidResultStageDecode(raw,stageKey);localStorage.setItem(stageKey,raw);
 if(localStorage.getItem(stageKey)!==raw)return false;const after=raidResultStageRows();
 return!after.blocked&&after.length>0&&after.every(q=>raidSamePacket(q.packet,p.packet)&&q.entryRequestId===p.entryRequestId);
 }catch(e){return false;}}
function raidResultStageClear(p){try{if(!p.current())return false;const rows=raidResultStageRows();if(rows.blocked)return false;let removed=false;
 for(const row of rows){if(!raidSamePacket(row.packet,p.packet)||row.entryRequestId!==p.entryRequestId)continue;const raw=localStorage.getItem(row.stageKey);if(!raidSamePacket(raidResultStageDecode(raw,row.stageKey).packet,p.packet))continue;localStorage.removeItem(row.stageKey);removed=true;}
 return removed;
 }catch(e){return false;}}
