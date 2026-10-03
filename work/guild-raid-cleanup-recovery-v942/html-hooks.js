// PRIVATE guarded v3 cutover. Quiescence is deliberately NOT asserted by code.
let RAID_SETTLEMENT=null,RAID_V3=null;
function raidClientFence(){const game=G,account=ACC,id=ACC&&ACC.id,token=ACC&&ACC.token,guildId=G.guild&&G.guild.id;return()=>G===game&&ACC===account&&(ACC&&ACC.id)===id&&(ACC&&ACC.token)===token&&(G.guild&&G.guild.id)===guildId;}
async function raidGetV3(){
 if(RAID_V3&&RAID_V3.current())return await RAID_V3.ready;
 const current=raidClientFence(),account=ACC,game=G;
 if(!account||!account.id||!account.token||!game.guild||!game.guild.id)throw Error('Sign in to raid with your guild.');
 const context=()=>({accountId:ACC&&ACC.id,guildId:G.guild&&G.guild.id,token:ACC&&ACC.token,epoch:current()?1:2});
 const holder={current,ready:null};RAID_V3=holder;
 holder.ready=(async()=>{
  if(!navigator.locks||!indexedDB||!crypto.subtle)throw Error('Safe raid recovery storage unavailable.');
  const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('ew_raid_pending_v3',1);q.onupgradeneeded=()=>{const s=q.result.createObjectStore('slots',{keyPath:['accountId','id']});s.createIndex('account','accountId')};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('Raid recovery storage is busy.'));});
  if(!current()){db.close();throw Error('Stale raid session');}
  const M=EW_RAID_V3_MODULES,transport=M.transport.createTransport({context,fetch:(...args)=>fetch(...args)});
  const facade=M.facade.create({directory:M.directory.create(db),storage:localStorage,context,locks:navigator.locks,transport,
   legacyWritersQuiescent:async scope=>typeof window.EW_RAID_LEGACY_QUIESCENCE_PROOF==='function'&&await window.EW_RAID_LEGACY_QUIESCENCE_PROOF(scope)===true,
   validateEntryReply:M.entry.validateEntryReply,validateFreshEntryReply:M.fresh.validateFreshEntryReply,
   validateSettlementReply:x=>M.settlement.validateSettlement({...x,digest:async raw=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),n=>n.toString(16).padStart(2,'0')).join('')})});
  const runtime={current,facade,db,bootstrap:null};
  runtime.bootstrap=M.bootstrap.create({facade,current,onFight:accepted=>raidStartAccepted(accepted.reply.body,accepted.raidInstanceId,accepted.raidEntryRequestId),scheduleSettlement:x=>raidSettlementRun(x.raidInstanceId,CUR.raid||{})});
  return runtime;
 })();
 try{return await holder.ready}catch(e){if(RAID_V3===holder)RAID_V3=null;throw e;}
}
function raidResolveRetry(){const p=RAID_SETTLEMENT;if(p&&p.current()&&!p.busy&&p.retry)p.retry();}
async function raidRecoverSaved(){try{const runtime=await raidGetV3(),choices=await runtime.bootstrap.discover();if(!runtime.current())return;if(!choices.length)return;if(choices.length!==1)throw Error('Multiple saved raid requests need explicit recovery. No new request sent.');const found=choices[0];if(found.status==='entry-recovery-only')await runtime.bootstrap.resume(found.id);else raidSettlementRun(found.id,{});}catch(e){bannerMsg(String(e.message||e));}}
function raidSettlementQueue(packet,RB){
 const runtime=RAID_V3, id=CUR.raidInstanceId;
 if(!runtime||!runtime.current()||!id){bannerMsg('Raid recovery identity unavailable. No result sent.');return;}
 const held={current:raidClientFence(),busy:false,retry:null};RAID_SETTLEMENT=held;
 held.retry=async()=>{if(!held.current()||held.busy||RAID_SETTLEMENT!==held)return;held.busy=true;try{const r=await runtime.ready;if(!held.current()||RAID_SETTLEMENT!==held)return;r.bootstrap.stageAndSchedule(packet);}catch(e){if(held.current())bannerMsg('Result held: '+String(e.message||e));}finally{held.busy=false;}};
 held.retry();
}
function raidSettlementRun(id,RB){
 const pending={current:raidClientFence(),id,busy:false,retry:null};RAID_SETTLEMENT=pending;
 pending.retry=()=>resultLater(async ep=>{if(!pending.current()||pending.busy||RAID_SETTLEMENT!==pending)return;pending.busy=true;
  try{const runtime=await raidGetV3();if(!pending.current()||RAID_SETTLEMENT!==pending)return;
   const presentation=EW_RAID_V3_MODULES.presentation.create({facade:runtime.facade,current:pending.current,owner:()=>RAID_SETTLEMENT,setOwner:x=>{RAID_SETTLEMENT=x},pending,
    render:r=>{if(RAID_SETTLEMENT===pending)RAID_SETTLEMENT=null;if(resultStale(ep))return;raidRenderConfirmed(r,RB,ep)},
    notice:message=>{if(!resultStale(ep))bannerMsg(message)}});
   await presentation.recover(id);
   // Release only our result owner after the facade's validated confirmation
   // has retired durable discovery. Reload-only recovery may have no owner.
   const owned=runtime.bootstrap.owned();if(owned&&owned.id===id&&owned.phase==='result')await runtime.bootstrap.retireCompleted(id);
  }catch(e){if(pending.current()&&RAID_SETTLEMENT===pending)bannerMsg('Saved raid result held: '+String(e.message||e));}finally{pending.busy=false;}
 },800);
 pending.retry();
}
async function raidLaunch(){try{const r=await raidGetV3();if(RAID_SETTLEMENT&&RAID_SETTLEMENT.current())throw Error('Recover the pending raid result first.');const sq=squadFor('graid').slice(0,TEAM_SIZE*2);if(!sq.length)return;await r.bootstrap.launch({heroIds:sq,requestId:uid8()},'raid-'+uid8());}catch(e){bannerMsg(String(e.message||e));}}
function raidStartAccepted(st,raidInstanceId,raidEntryRequestId){
 const B=st.boss||{},sq=st.entryBinding.heroIds,_sn=Array.isArray(st.snaps)?st.snaps:null;
 CUR={mode:'graid',attemptId:st.attemptId,raidInstanceId,raidEntryRequestId,seed:(st.seed!=null?(st.seed>>>0):null),serverSnaps:_sn,
  backupSnaps:_sn?_sn.slice(TEAM_SIZE):null,backups:sq.slice(TEAM_SIZE),raid:{key:B.key,name:B.name,tier:B.tier|0,hp:Math.max(1,B.hp|0),lvl:Math.max(1,B.lvl|0)},
  cwaves:[[{key:B.key,lvl:Math.max(1,B.lvl|0),boss:true,hp:Math.max(1,B.hp|0),def:Math.max(0,B.def|0),dmgMul:(B.dmgMul||1)}]],engine:st.engine||null};
 startBattle();
}
