(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EmberweaveWorldMarchVisual=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function valid(m){
    const r=m?.route;
    if(!r||r.version!==1||r.coordinateSpace!=='world-percent'||!['city','mine'].includes(m.kind)
      ||typeof m.id!=='string'||![m.depart,m.arriveAt,m.homeAt,r.travelMs,r.gatherMs].every(Number.isFinite)
      ||r.travelMs<0||r.gatherMs<0||m.arriveAt!==m.depart+r.travelMs+r.gatherMs
      ||m.homeAt!==m.arriveAt+r.travelMs)return false;
    return [r.from,r.to].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<100&&p.y>=0&&p.y<100);
  }
  // Renderer descriptors only: never insert these rows into persistent marches.
  function views(rows,now,local=[]){
    if(!Number.isFinite(now))return [];
    const result=[],seen=new Set();
    for(const m of Array.isArray(rows)?rows:[]){
      if(!valid(m)||now<m.depart||(!m.resultPending&&now>=m.homeAt))continue;
      const key=m.kind+':'+m.id;if(seen.has(key))continue;seen.add(key);
      const old=local.find(x=>m.kind==='mine'?x.serverMineId===m.id:x.serverCityId===m.id);
      // Preserve local recall and a newly settled local outcome while the cache catches up.
      if(old?.retreated||(old?.resolved&&m.resultPending))continue;
      const r=m.route,reach=m.depart+r.travelMs;
      let from=r.from,to=r.to,phase='outbound',p=0,etaMs=Math.max(0,reach-now);
      if(now<reach)p=r.travelMs?(now-m.depart)/r.travelMs:1;
      else if(now<m.arriveAt){from=to=r.to;phase='gathering';etaMs=m.arriveAt-now;}
      else if(m.resultPending){from=to=r.to;phase='awaiting-resolution';etaMs=0;}
      else{from=r.to;to=r.from;phase='returning';p=r.travelMs?(now-m.arriveAt)/r.travelMs:1;etaMs=Math.max(0,m.homeAt-now);}
      p=Math.max(0,Math.min(1,p));
      result.push({key,sourceId:m.id,localId:old?.id||null,kind:m.kind,phase,etaMs,progress:p,
        from:{x:from.x,y:from.y},to:{x:to.x,y:to.y},x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p,
        targetName:typeof r.targetName==='string'?r.targetName:null});
    }
    return result;
  }
  return {views};
});
