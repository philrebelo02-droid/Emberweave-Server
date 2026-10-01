'use strict';
// Points derive only from settled server holder transitions; GET never awards.
const SITES=['tree','oasis-north','oasis-south','oasis-east','oasis-west'];
const every=id=>id==='tree'?600000:300000;
const ms=x=>Number.isSafeInteger(x)&&x>=0;
const guild=x=>typeof x==='string'&&x.length>0&&x.length<=200&&!['__proto__','constructor','prototype'].includes(x);
function advance(previous,control,now){
  if(!control)return previous||null;
  if(control.version!==1||!ms(now)||!ms(control.startsAt)||!ms(control.endsAt)||control.endsAt-control.startsAt!==86400000||!ms(control.through)||!Array.isArray(control.controlChanges))throw Error('Invalid score authority');
  const asOf=Math.min(now,control.through,control.endsAt);
  if(asOf<control.startsAt)throw Error('Invalid score clock');
  if(previous&&(previous.version!==1||previous.eventId!==control.eventId||previous.asOf>asOf))throw Error('Score event or clock mismatch');
  const changes=control.controlChanges;
  for(let i=0;i<changes.length;i++){const c=changes[i];
    if(c.sequence!==i+1||!SITES.includes(c.siteId)||!ms(c.at)||c.at<control.startsAt||c.at>control.through||c.at>control.endsAt||
      (c.fromGuildId!==null&&!guild(c.fromGuildId))||(c.toGuildId!==null&&!guild(c.toGuildId))||c.fromGuildId===c.toGuildId||
      (i&&c.at<changes[i-1].at))throw Error('Invalid holder history');
  }
  const entries=[];
  function credit(siteId,gid,start,end){if(!gid)return;const period=every(siteId);
    for(let at=start+period;at<=end;at+=period)entries.push({id:control.eventId+':'+siteId+':'+start+':'+at,siteId,guildId:gid,at,points:1});
  }
  for(const siteId of SITES){let owner=null,since=null;
    for(const c of changes.filter(c=>c.siteId===siteId&&c.at<=asOf)){
      if(c.fromGuildId!==owner)throw Error('Holder transition discontinuity');
      credit(siteId,owner,since,c.at);owner=c.toGuildId;since=owner?c.at:null;
    }
    credit(siteId,owner,since,asOf);
  }
  entries.sort((a,b)=>a.at-b.at||a.siteId.localeCompare(b.siteId)||a.guildId.localeCompare(b.guildId));
  if(previous){if(!Array.isArray(previous.entries))throw Error('Invalid saved score ledger');const expected=new Map(entries.map(e=>[e.id,e]));
    for(const e of previous.entries)if(JSON.stringify(expected.get(e.id))!==JSON.stringify(e))throw Error('Previously credited score changed');
  }
  const totals=new Map();for(const e of entries){const row=totals.get(e.guildId)||{guildId:e.guildId,points:0,reachedAt:e.at};row.points+=e.points;row.reachedAt=e.at;totals.set(e.guildId,row);}
  return {version:1,eventId:control.eventId,startsAt:control.startsAt,endsAt:control.endsAt,asOf,entries,
    scores:[...totals.values()].sort((a,b)=>b.points-a.points||a.reachedAt-b.reachedAt||a.guildId.localeCompare(b.guildId))};
}
function view(score,serverNow,enabled=false){if(!ms(serverNow))throw Error('Invalid server clock');
  return {enabled:enabled===true,serverNow,eventId:score?.eventId||null,startsAt:score?.startsAt??null,endsAt:score?.endsAt??null,
    asOf:score?.asOf??null,scores:(score?.scores||[]).map(x=>({...x}))};
}
module.exports={advance,view};
