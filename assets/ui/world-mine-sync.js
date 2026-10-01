(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EmberweaveWorldMineSync=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const EPOCH_MS=8*3600000,COUNT=240,COLS=220,CELL=100/COLS,RES=['iron','crystal','silver','coal'];
  function validate(data){
    if(!data||!data.ok||data.locked||!Number.isSafeInteger(data.epoch)||data.epoch<0||!Number.isFinite(data.serverNow)||
      Math.floor(data.serverNow/EPOCH_MS)!==data.epoch||data.epochEndsAt!==(data.epoch+1)*EPOCH_MS||
      !Array.isArray(data.nodes)||data.nodes.length!==COUNT)throw Error('Unavailable field');
    const positions=new Set();
    const nodes=data.nodes.map((n,i)=>{
      if(!n||n.id!=='mn'+data.epoch+'_'+i||!RES.includes(n.res)||!Number.isInteger(n.level)||n.level<1||n.level>8||
        !Number.isInteger(n.gx)||!Number.isInteger(n.gy)||n.gx<2||n.gy<2||n.gx>=COLS-1||n.gy>=COLS-1||
        n.x!==n.gx*CELL||n.y!==n.gy*CELL||typeof n.region!=='string')throw Error('Invalid node');
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
  return {create,validate};
});
