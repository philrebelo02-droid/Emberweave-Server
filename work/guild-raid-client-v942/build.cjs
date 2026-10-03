'use strict';const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));const file=path.join(__dirname,'../guild-client-session-v942/payload/combined/emberweave-heroes.html'),source=fs.readFileSync(file,'utf8');
let next=source;const spans=[];function change(a,b){assert.equal(next.split(a).length,2,a);next=next.replace(a,b);spans.push([a,b]);}
change('async function raidLaunch(){',`let RAID_START_PENDING=null,RAID_SETTLEMENT=null;
function raidClientFence(){const game=G,account=ACC,id=ACC&&ACC.id,token=ACC&&ACC.token,guildId=G.guild&&G.guild.id;return()=>G===game&&ACC===account&&(ACC&&ACC.id)===id&&(ACC&&ACC.token)===token&&(G.guild&&G.guild.id)===guildId;}
function raidResolveRetry(){const p=RAID_SETTLEMENT;if(p&&p.current()&&!p.busy&&p.retry)p.retry();}
async function raidLaunch(){`);
change("  const st=await api('/api/guild/raid/start','POST',{heroIds:sq, requestId:uid8()});",`  if(RAID_SETTLEMENT&&RAID_SETTLEMENT.current()){bannerMsg('Recover the pending raid result before starting another fight.');return;}
  if(RAID_START_PENDING&&!RAID_START_PENDING.current())RAID_START_PENDING=null;
  if(!RAID_START_PENDING)RAID_START_PENDING={current:raidClientFence(),packet:{heroIds:sq,requestId:uid8()},busy:false,createdAt:Date.now()};
  const pending=RAID_START_PENDING;if(pending.busy)return;
  if(Date.now()<pending.createdAt||Date.now()-pending.createdAt>=600000){bannerMsg('Raid entry remains unconfirmed. Retry window closed; do not start a replacement fight.');return;}
  pending.busy=true;
  let st;try{st=await api('/api/guild/raid/start','POST',pending.packet);}catch(e){st=null;}finally{pending.busy=false;}
  if(!pending.current())return;
  if(st&&!st.error&&(st.none||typeof st.attemptId==='string'&&st.attemptId)){RAID_START_PENDING=null;}
  else if(st&&!st.error){bannerMsg('Raid entry reply was incomplete. Retry the same request.');return;}`);
change("  if(CUR.mode==='graid' && CUR.attemptId){ const att=CUR.attemptId, RB=CUR.raid||{}; CUR.attemptId=null;", "  if(CUR.mode==='graid' && CUR.attemptId){ const att=CUR.attemptId, RB=CUR.raid||{}; CUR.attemptId=null;");
change("    resultLater(async(ep)=>{ let r=null;\n      try{ r=await api('/api/guild/raid/resolve','POST',{attemptId:att, requestId:uid8(), inputLog:_log, dmg:_dmg}); }catch(e){ r=null; }\n      if(resultStale(ep)){ if(r&&r.ledger) adoptLedger(r.ledger); return; }",`    const pending={current:raidClientFence(),packet:{attemptId:att,requestId:uid8(),inputLog:_log,dmg:_dmg},busy:false,retry:null};RAID_SETTLEMENT=pending;
    pending.retry=()=>resultLater(async(ep)=>{ if(!pending.current()||pending.busy)return;pending.busy=true;let r=null;
      try{r=await api('/api/guild/raid/resolve','POST',pending.packet);}catch(e){r=null;}finally{pending.busy=false;}
      if(!pending.current())return;
      if(r&&(r.ok||r.expired)&&RAID_SETTLEMENT===pending)RAID_SETTLEMENT=null;
      if(resultStale(ep))return;`);
change("const ok=!!(r&&r.ok), dealt=ok?(r.dmg|0):_dmg, fell=!!(r&&r.killed);", "const ok=!!(r&&r.ok), dealt=ok?(r.dmg|0):0, fell=!!(r&&r.killed);");
change("document.getElementById('resultTitle').textContent=fell?'BOSS FELLED':(dealt>0?'DAMAGE DEALT':'NO DAMAGE');", "document.getElementById('resultTitle').textContent=!ok?(r&&r.expired?'RAID EXPIRED':'RESULT UNCONFIRMED'):(fell?'BOSS FELLED':(dealt>0?'DAMAGE DEALT':'NO DAMAGE'));");
change("This run was not counted.</div><span style=\"color:#ff8b8b\">${escapeHTML(String((r&&r.error)||'Could not reach the realm.'))}</span>`;", "Result not confirmed. No new fight has been started.</div><span style=\"color:#ff8b8b\">${escapeHTML(String((r&&r.error)||'Could not reach the realm. Retry this same result.'))}</span>`+(!r||!r.expired?'<button onclick=\"raidResolveRetry()\">Retry same result</button>':'');");
change("      updateHubChrome(); gameSpeed=1; show('result'); },800); return; }\n  if(CUR.mode==='well')", "      updateHubChrome(); gameSpeed=1; show('result'); },800);pending.retry();return; }\n  if(CUR.mode==='well')");
const dest=path.join(__dirname,'payload/combined/emberweave-heroes.html');fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest)){assert.equal(hash(fs.readFileSync(dest)),'04b7848d10ae46a5297ebe6fee63f3a9cd0999bf76c5571e0fe397d40ec68fb8');fs.writeFileSync(dest,next);}else fs.writeFileSync(dest,next,{flag:'wx'});fs.writeFileSync(path.join(__dirname,'spans.json'),JSON.stringify({base:hash(source),output:hash(next),spans},null,2));console.log(JSON.stringify({base:hash(source),output:hash(next)}));
