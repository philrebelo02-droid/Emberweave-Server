(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EmberweaveWorldMarchVisual=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const LOW=90*100/220,HIGH=130*100/220;
  function segment(from,to){
    if(![from,to].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<100&&p.y>=0&&p.y<100))return null;
    let a=0,b=1,hit=true;
    for(const axis of ['x','y']){const d=to[axis]-from[axis];
      if(d===0){if(from[axis]<LOW||from[axis]>=HIGH)hit=false;continue;}
      const u=(LOW-from[axis])/d,v=(HIGH-from[axis])/d;
      a=Math.max(a,Math.min(u,v));b=Math.min(b,Math.max(u,v));
    }
    if(!hit||b<=a)a=b=0;
    return {a,b,f:b-a};
  }
  function multiplier(from,to){const s=segment(from,to);return s?1+s.f:1;}
  function validPacing(r){
    if(r.pacing===undefined)return true;
    const p=r.pacing,s=segment(r.from,r.to);
    return !!(p&&s&&p.version===1&&p.rule==='void-half-speed'
      &&Number.isSafeInteger(p.normalTravelMs)&&p.normalTravelMs>=0
      &&p.entryFraction===s.a&&p.exitFraction===s.b&&p.insideFraction===s.f
      &&Number.isSafeInteger(r.travelMs)&&r.travelMs===Math.round(p.normalTravelMs*(1+s.f))
      &&Object.keys(p).length===6);
  }
  function paced(r,p,reverse){
    p=Math.max(0,Math.min(1,p));
    if(!r.pacing)return p;
    const s=r.pacing,f=s.insideFraction,a=reverse?1-s.exitFraction:s.entryFraction;
    const u=p*(1+f);
    return Math.max(0,Math.min(1,u<a?u:u<=a+2*f?a+(u-a)/2:u-f));
  }
  function valid(m){
    const r=m?.route;
    if(!r||r.version!==1||r.coordinateSpace!=='world-percent'||!['city','mine'].includes(m.kind)
      ||typeof m.id!=='string'||![m.depart,m.arriveAt,m.homeAt,r.travelMs,r.gatherMs].every(Number.isFinite)
      ||r.travelMs<0||r.gatherMs<0||m.arriveAt!==m.depart+r.travelMs+r.gatherMs
      ||m.homeAt!==m.arriveAt+r.travelMs)return false;
    return validPacing(r)&&[r.from,r.to].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<100&&p.y>=0&&p.y<100);
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
      p=paced(r,p,phase==='returning');
      result.push({key,sourceId:m.id,localId:old?.id||null,kind:m.kind,phase,etaMs,progress:p,
        from:{x:from.x,y:from.y},to:{x:to.x,y:to.y},x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p,
        targetName:typeof r.targetName==='string'?r.targetName:null});
    }
    return result;
  }
  return {views,multiplier};
});
