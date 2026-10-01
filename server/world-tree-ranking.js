'use strict';
// Pure final ranking. Guild creation timestamps must be supplied from the server DB.
// ID is only the final deterministic fallback for identical creation timestamps.
function standings(score,control,guilds){
  if(!score||!control||score.eventId!==control.eventId||score.asOf!==control.endsAt||control.through<control.endsAt||!Array.isArray(score.scores)||!Array.isArray(control.controlChanges))throw Error('Unsettled final score');
  const times=new Map();let holder=null,since=control.startsAt;
  for(const c of control.controlChanges.filter(x=>x.siteId==='tree')){
    if(c.at<since||c.at>control.endsAt||c.fromGuildId!==holder)throw Error('Invalid Tree history');
    if(holder)times.set(holder,(times.get(holder)||0)+c.at-since);holder=c.toGuildId;since=c.at;
  }
  if(holder)times.set(holder,(times.get(holder)||0)+control.endsAt-since);
  const seen=new Set();
  const rows=score.scores.map(x=>{
    const createdAt=guilds?.[x.guildId]?.createdAt;
    if(typeof x.guildId!=='string'||!x.guildId||seen.has(x.guildId)||!Number.isSafeInteger(x.points)||x.points<0||!Number.isSafeInteger(x.reachedAt)||x.reachedAt<control.startsAt||x.reachedAt>control.endsAt||!Number.isSafeInteger(createdAt)||createdAt<0)throw Error('Invalid final guild score or creation timestamp');
    seen.add(x.guildId);return {...x,treeHeldMs:times.get(x.guildId)||0,guildCreatedAt:createdAt};
  });
  rows.sort((a,b)=>b.points-a.points||a.reachedAt-b.reachedAt||b.treeHeldMs-a.treeHeldMs||a.guildCreatedAt-b.guildCreatedAt||(a.guildId<b.guildId?-1:a.guildId>b.guildId?1:0));
  rows.forEach((row,i)=>{row.rank=i+1;});
  return {eventId:control.eventId,endedAt:control.endsAt,rows,winnerGuildId:rows[0]?.guildId||null,rewards:{status:'awaiting-Phil-approval',paid:false,table:[]}};
}
module.exports={standings};
