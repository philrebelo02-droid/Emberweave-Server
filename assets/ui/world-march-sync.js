(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EmberweaveWorldMarchSync=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function create({token,online,fetchState,clock=()=>performance.now(),ttl=15000}){
    let account=null,generation=0,pending=null,rows=[],serverNow=0,received=0,lastAttempt=-Infinity,loaded=false,failed=false;
    function own(){const current=token()||null;if(current!==account){account=current;generation++;pending=null;rows=[];serverNow=0;received=0;lastAttempt=-Infinity;loaded=false;failed=false;}return account;}
    function state(){own();const now=loaded?serverNow+Math.max(0,clock()-received):0;
      return {loaded,failed,pending:!!pending,now,rows:rows.filter(m=>m.resultPending||m.homeAt>now).map(m=>({...m,heroIds:m.heroIds.slice()}))};}
    function heroes(){const s=state(),ids=new Set();for(const m of s.rows)if(m.homeAt>s.now)for(const id of m.heroIds)ids.add(id);return ids;}
    function sync(force=false){const who=own();if(!who||!online())return Promise.resolve(state());if(pending)return pending;
      if(!force&&clock()-lastAttempt<ttl)return Promise.resolve(state());lastAttempt=clock();const stamp=generation;
      const job=Promise.resolve().then(fetchState).then(data=>{
        if(own()!==who||generation!==stamp)return state();
        if(!data||!data.ok||data.locked||!Number.isFinite(data.serverNow)||!Array.isArray(data.marches))throw Error('March state unavailable');
        rows=data.marches.filter(m=>m&&typeof m.id==='string'&&['mine','city'].includes(m.kind)&&[m.depart,m.arriveAt,m.homeAt].every(Number.isFinite)&&m.depart<=m.arriveAt&&m.arriveAt<=m.homeAt).map(m=>({...m,heroIds:Array.isArray(m.heroIds)?m.heroIds.filter(id=>typeof id==='string').slice(0,5):[]}));
        serverNow=data.serverNow;received=clock();loaded=true;failed=false;return state();
      }).catch(()=>{if(own()===who&&generation===stamp)failed=true;return state();}).finally(()=>{if(pending===job)pending=null;});
      pending=job;return job;
    }
    return {state,heroes,sync};
  }
  return {create};
});
