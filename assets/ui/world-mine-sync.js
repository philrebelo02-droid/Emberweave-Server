(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EmberweaveWorldMineSync=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const EPOCH_MS=8*3600000,COUNT=240,RES=['iron','crystal','silver','coal'],MAX_LEVEL=10;   // v1131: server/world-mines.js MAX_LEVEL (region 1-6, wild 7-10; legacy fields 1-8)
  // v1227: the grid comes from world-realm.js (GEO: META.cols x rows); a node's gx,gy is the grid intersection it stands on
  function geo(){const g=typeof window!=='undefined'?window:globalThis,R=g.EmberweaveRealm||(typeof require==='function'?require('../../world-realm.js'):null);if(!R||!R.GEO)throw Error('No realm grid');return R.GEO;}
  function validate(data){
    if(!data||!data.ok||data.locked||!Number.isSafeInteger(data.epoch)||data.epoch<0||!Number.isFinite(data.serverNow)||
      Math.floor(data.serverNow/EPOCH_MS)!==data.epoch||data.epochEndsAt!==(data.epoch+1)*EPOCH_MS||
      !Array.isArray(data.nodes)||data.nodes.length!==COUNT)throw Error('Unavailable field');
    const positions=new Set(),G=geo();
    const nodes=data.nodes.map((n,i)=>{
      if(!n||n.id!=='mn'+data.epoch+'_'+i||!RES.includes(n.res)||!Number.isInteger(n.level)||n.level<1||n.level>MAX_LEVEL||
        !Number.isInteger(n.gx)||!Number.isInteger(n.gy)||n.gx<2||n.gy<2||n.gx>G.COLS-2||n.gy>G.ROWS-2||
        n.x!==G.mineX(n.gx)||n.y!==G.mineY(n.gy)||typeof n.region!=='string')throw Error('Invalid node');   // v1227: a mine is ON an intersection
      const key=n.gx+','+n.gy;if(positions.has(key))throw Error('Duplicate node');positions.add(key);
      return {id:n.id,res:n.res,level:n.level,gx:n.gx,gy:n.gy,x:n.x,y:n.y,region:n.region};
    });
    return {epoch:data.epoch,serverNow:data.serverNow,epochEndsAt:data.epochEndsAt,nodes};
  }
  function create({token,online,fetchState,clock=()=>performance.now(),ttl=15000}){
    let account=null,generation=0,pending=null,receipt=null,received=0,lastAttempt=-Infinity,failed=false;
    function own(){const current=token()||null;if(current!==account){account=current;generation++;pending=null;receipt=null;received=0;lastAttempt=-Infinity;failed=false;}return account;}
    function state(){own();const now=receipt?receipt.serverNow+Math.max(0,clock()-received):null;
      const ready=!!receipt&&now<receipt.epochEndsAt;
      return {status:ready?'ready':pending?'loading':'unavailable',loaded:ready,failed,pending:!!pending,
        now,epoch:receipt?receipt.epoch:null,epochEndsAt:receipt?receipt.epochEndsAt:null,
        nodes:ready?receipt.nodes.map(n=>({...n})):[]};}
    function sync(force=false){const who=own();if(!who||!online())return Promise.resolve(state());if(pending)return pending;
      if(!force&&clock()-lastAttempt<ttl)return Promise.resolve(state());lastAttempt=clock();const stamp=generation;
      const job=Promise.resolve().then(fetchState).then(data=>{
        if(own()!==who||generation!==stamp)return state();
        const next=validate(data);
        if(receipt&&next.serverNow<receipt.serverNow)throw Error('Stale field receipt');
        receipt=next;received=clock();failed=false;return state();
      }).catch(()=>{if(own()===who&&generation===stamp)failed=true;return state();}).finally(()=>{if(pending===job)pending=null;});
      pending=job;return job;
    }
    return {state,sync};
  }
  return {create,validate,MAX_LEVEL};
});
