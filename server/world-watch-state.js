'use strict';
const {summarize}=require('./world-march-state.js');
// Read-only, server-recorded activity. Client reports are deliberately not read.
function snapshot(db,me,now=Date.now()){
  if(!me||typeof me.id!=='string')throw Error('Authenticated user required');
  const users=db?.users||{}, guilds=db?.guilds||{};
  const gid=typeof me.guildId==='string'?me.guildId:null;
  const guild=gid&&Object.prototype.hasOwnProperty.call(guilds,gid)?guilds[gid]:null;
  const roster=Array.isArray(guild?.members)?guild.members:[];
  const guilded=!!(guild&&roster.includes(me.id));
  const ids=guilded?[me.id,...roster.filter(id=>id!==me.id)]:[me.id];
  const mates=[];
  for(const id of new Set(ids)){
    if(typeof id!=='string')continue;
    const user=id===me.id?me:Object.prototype.hasOwnProperty.call(users,id)?users[id]:null;
    if(!user||user.id!==id||(id!==me.id&&user.guildId!==gid))continue;
    const marches=summarize(user,now).marches.map(m=>{
      const row={id:m.id,kind:m.kind,phase:m.phase,depart:m.depart,
        arriveAt:m.arriveAt,homeAt:m.homeAt,arriveInMs:m.arriveInMs,
        homeInMs:m.homeInMs,resultPending:m.resultPending,
        resolveReady:m.resolveReady,homeReached:m.homeReached};
      if(m.kind==='mine'){row.mineId=m.mineId;row.resource=m.resource;row.level=m.level;}
      // Target identifier was already shared by own-march route. Never include
      // target account data, hero IDs, combat snapshots, receipts or currency.
      if(m.kind==='city')row.defId=m.defId;
      return row;
    });
    if(id!==me.id&&!marches.length)continue;
    mates.push({id,name:typeof user.name==='string'?user.name:'',you:id===me.id,marches});
  }
  return {serverNow:now,guilded,source:'server-recorded',mates};
}
module.exports={snapshot};
