'use strict';
const WORLD_MARCH_ROUTE=require('./world-march-route.js');
// Pure read projection: never prune records, settle battles, award resources or
// expose frozen combat snapshots. Pending results survive even after home time.
function summarize(user,now=Date.now()){
  if(!Number.isFinite(now))throw Error('Invalid server time');
  const marches=[];
  for(const [kind,records] of [['mine',user?.worldMineMarches],['city',user?.worldCityMarches]]){
    for(const m of Array.isArray(records)?records:[]){
      if(!m||typeof m.id!=='string'||!m.id||![m.depart,m.arriveAt,m.homeAt].every(Number.isFinite)
          ||m.depart>m.arriveAt||m.arriveAt>m.homeAt||m.depart>now)continue;
      if(m.resolved&&now>=m.homeAt)continue;
      const resultPending=!m.resolved;
      const phase=now<m.arriveAt?(kind==='mine'?'travelling-or-gathering':'outbound'):
        resultPending?'awaiting-resolution':'returning';
      const item={id:m.id,kind,heroIds:Array.isArray(m.heroIds)?m.heroIds.filter(x=>typeof x==='string').slice(0,5):[],
        depart:m.depart,arriveAt:m.arriveAt,homeAt:m.homeAt,phase,resultPending,
        resolveReady:resultPending&&now>=m.arriveAt,homeReached:now>=m.homeAt,
        arriveInMs:Math.max(0,m.arriveAt-now),homeInMs:Math.max(0,m.homeAt-now)};
      item.route=WORLD_MARCH_ROUTE.project(m);
      if(kind==='mine'&&m.node){item.mineId=typeof m.node.id==='string'?m.node.id:null;
        item.resource=typeof m.node.res==='string'?m.node.res:null;
        item.level=Number.isInteger(m.node.level)?m.node.level:null;}
      if(kind==='city')item.defId=typeof m.defId==='string'?m.defId:null;
      marches.push(item);
    }
  }
  marches.sort((a,b)=>a.depart-b.depart||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  return {serverNow:now,marches};
}
module.exports={summarize};
