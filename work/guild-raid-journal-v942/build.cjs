'use strict';const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');assert(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const source=fs.readFileSync(path.join(__dirname,'../guild-raid-client-v942/payload/combined/emberweave-heroes.html'),'utf8');assert.equal(hash(source),'b9f5e394011d1e1312d1c182f7e918887359fa75c6eab8ca8aff4b99190755da');let next=source;const spans=[];function change(a,b){assert.equal(next.split(a).length,2,a);next=next.replace(a,b);spans.push([a,b]);}
const a=next.indexOf("  if(CUR.mode==='graid' && CUR.attemptId){"),z=next.indexOf("  if(CUR.mode==='well')",a),old=next.slice(a,z);assert(a>0&&z>a);
const begin=old.indexOf('    const pending='),finish=old.lastIndexOf('pending.retry();return; }');let settlement=old.slice(begin,finish)+'pending.retry();\n}';settlement=settlement.replace('packet:{attemptId:att,requestId:uid8(),inputLog:_log,dmg:_dmg}','packet,kind:\'resolve\',createdAt').replace('RAID_SETTLEMENT=null;','{raidJournalClear(pending);RAID_SETTLEMENT=null;}');
settlement=settlement.replace("try{r=await api('/api/guild/raid/resolve','POST',pending.packet);}","try{r=raidJournalWrite(pending,RB)?await api('/api/guild/raid/resolve','POST',pending.packet):{ok:false,error:'Could not save result recovery identity. No request sent.'};}").replace('pending.retry();\n}', 'raidJournalWrite(pending,RB);pending.retry();\n}');
change(old,`  if(CUR.mode==='graid' && CUR.attemptId){const att=CUR.attemptId,RB=CUR.raid||{};
    const packet={attemptId:att,requestId:uid8(),inputLog:(INPUT_LOG||[]).slice(0,400),dmg:raidDamageDone()};
    CUR.attemptId=null;raidSettlementQueue(packet,RB);return;}
`);
const helpers=`function raidJournalKey(){return ACC&&typeof ACC.id==='string'&&ACC.id&&ACC.token?'ew_raid_pending_v1_'+encodeURIComponent(ACC.id):null;}
function raidJournalRead(){const key=raidJournalKey();if(!key)return null;try{
 const raw=localStorage.getItem(key);if(raw===null)return null;if(raw.length>160000)throw Error('Oversized saved raid');
 const p=JSON.parse(raw),b=p.packet;
 if(!p||p.v!==1||p.accountId!==ACC.id||p.guildId!==(G.guild&&G.guild.id)||!['start','resolve'].includes(p.kind)||!Number.isFinite(p.createdAt)||p.createdAt<0||!b||typeof b.requestId!=='string'||!b.requestId||b.requestId.length>48)throw Error('Saved raid identity is invalid or belongs to another guild');
 if(p.kind==='start'&&(!Array.isArray(b.heroIds)||!b.heroIds.length||b.heroIds.length>10||b.heroIds.some(x=>typeof x!=='string'||!x||x.length>128)))throw Error('Invalid saved squad');
 if(p.kind==='resolve'&&(typeof b.attemptId!=='string'||!b.attemptId||b.attemptId.length>128||!Array.isArray(b.inputLog)||b.inputLog.length>400||!Number.isFinite(b.dmg)||b.dmg<0))throw Error('Invalid saved result');
 return p;
 }catch(e){return{blocked:true,error:'Saved raid recovery is unavailable. No new raid request will be sent.'};}}
function raidJournalWrite(p,RB){const key=raidJournalKey();if(!key||!p.current())return false;try{
 const old=raidJournalRead();if(old&&old.blocked)return false;
 if(old&&!(old.kind==='start'&&p.kind==='resolve')&&(old.kind!==p.kind||old.packet.requestId!==p.packet.requestId))return false;
 const row={v:1,accountId:ACC.id,guildId:G.guild&&G.guild.id,kind:p.kind,createdAt:p.createdAt,packet:p.packet,RB:RB?{name:String(RB.name||'Raid Boss').slice(0,120),tier:RB.tier|0}:undefined},raw=JSON.stringify(row);
 if(raw.length>160000)return false;localStorage.setItem(key,raw);return localStorage.getItem(key)===raw&&!raidJournalRead()?.blocked;
 }catch(e){return false;}}
function raidJournalClear(p){if(!p.current())return false;const key=raidJournalKey();try{const old=raidJournalRead();if(!old||old.blocked||old.kind!==p.kind||old.packet.requestId!==p.packet.requestId)return false;localStorage.removeItem(key);return localStorage.getItem(key)===null;}catch(e){return false;}}
function raidRecoverSaved(){const p=raidJournalRead();if(!p)return;if(p.blocked){bannerMsg(p.error);return;}if(p.kind==='resolve'){raidSettlementQueue(p.packet,p.RB||{},p.createdAt);}else raidLaunch();}
function raidSettlementQueue(packet,RB,createdAt=Date.now()){
if(RAID_SETTLEMENT&&RAID_SETTLEMENT.current()&&RAID_SETTLEMENT.packet.requestId===packet.requestId&&RAID_SETTLEMENT.packet.attemptId===packet.attemptId){raidResolveRetry();return;}
${settlement}
`;
change('async function raidLaunch(){',helpers+'async function raidLaunch(){');
change("  const sq=squadFor('graid').slice(0,TEAM_SIZE*2);", "  const saved=raidJournalRead();if(saved?.blocked){bannerMsg(saved.error);return;}if(saved?.kind==='resolve'){bannerMsg('Recover the pending raid result first.');return;}\n  const sq=saved?.kind==='start'?saved.packet.heroIds:squadFor('graid').slice(0,TEAM_SIZE*2);");
change("  if(!RAID_START_PENDING)RAID_START_PENDING={current:raidClientFence(),packet:{heroIds:sq,requestId:uid8()},busy:false,createdAt:Date.now()};", "  if(!RAID_START_PENDING)RAID_START_PENDING={current:raidClientFence(),kind:'start',packet:saved?.packet||{heroIds:sq,requestId:uid8()},busy:false,createdAt:saved?.createdAt??Date.now()};");
change('  pending.busy=true;\n  let st;',"  if(!raidJournalWrite(pending)){bannerMsg('Could not save raid entry identity. No request sent.');return;}\n  pending.busy=true;\n  let st;");
change('  const r=d.raid, pct=Math.round(r.hp/r.max*100);',"  const r=d.raid, pct=Math.round(r.hp/r.max*100),pendingRaid=raidJournalRead();");
change('  el.innerHTML=`<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">', '  el.innerHTML=(pendingRaid?`<div class="panel">${pendingRaid.blocked?escapeHTML(pendingRaid.error):\'A raid request is saved for recovery.\'}${pendingRaid.blocked?\'\':\'<button onclick="raidRecoverSaved()">Recover saved raid entry or result</button>\'}</div>`:\'\')+`<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">');
const dest=path.join(__dirname,'payload/combined/emberweave-heroes.html');fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest))assert.equal(hash(fs.readFileSync(dest)),'b128243c1bf195d34477c10af39269e9903d506d16435f14ebdecf0632a0b533','Only replace owned previous candidate');fs.writeFileSync(dest,next);fs.writeFileSync(path.join(__dirname,'spans.json'),JSON.stringify({base:hash(source),output:hash(next),spans},null,2));console.log(hash(next));
