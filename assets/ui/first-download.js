(function(root){
  'use strict';
  const CACHE='ember-assets-v1',KEY='ew_first_download_v1';
  function urls(value,out,depth){
    out=out||new Set();depth=depth||0;if(depth>12||value==null)return out;
    if(typeof value==='string'){if(value.startsWith('/assets/')&&!value.includes('${'))out.add(value);}
    else if(typeof value==='object')for(const v of Object.values(value))urls(v,out,depth+1);
    return out;
  }
  function partition(config){
    const parts=Array.from({length:4},()=>new Set()),claimed=new Set();
    const add=(n,list)=>{for(const u of list||[])if(typeof u==='string'&&u.startsWith('/assets/')&&!claimed.has(u)){parts[n].add(u);claimed.add(u);}};
    const starters=config.starters||['vael','sylthaine','vireo'];
    const heroes=[...new Set(config.heroes||[])].filter(k=>!starters.includes(k)).sort();
    add(0,config.essentials);for(const k of starters)add(0,config.byHero[k]);
    for(let i=0;i<heroes.length;i++)add(i<25?1:i<50?2:3,config.byHero[heroes[i]]);
    add(3,config.remaining);
    return {parts:parts.map(s=>[...s].sort()),heroes:[starters,heroes.slice(0,25),heroes.slice(25,50),heroes.slice(50)]};
  }
  function bounded(task,ms,controller){
    let timer;return Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{timer=setTimeout(()=>{if(controller)controller.abort();reject(new Error('Download is taking too long'));},ms);})]).finally(()=>clearTimeout(timer));
  }
  function create(options){
    const opt=options||{},store=opt.storage||root.localStorage,cacheStorage=opt.caches||root.caches,fetcher=opt.fetch||root.fetch.bind(root);
    const origin=opt.origin||root.location.origin,timeout=opt.timeout||15000,listeners=new Set();
    let plan=null,cache=null,saved=new Set(),running=null,pause=false,controllers=new Set(),receipt={started:false,resumeOnOpen:false},state={status:'checking',percent:0,completed:0,part:0,error:null};
    try{receipt=Object.assign(receipt,JSON.parse(store.getItem(KEY)||'{}'));}catch(_){}
    const abs=u=>new URL(u,origin).href;
    const persist=()=>{try{store.setItem(KEY,JSON.stringify(receipt));}catch(_){};};
    const update=()=>{
      if(plan){let percent=0,completed=0,part=4;plan.parts.forEach((list,i)=>{const have=list.filter(u=>saved.has(abs(u))).length;const full=have===list.length;if(full)completed++;else if(part===4)part=i;percent+=25*(list.length?have/list.length:1);});
        state.percent=Math.floor(percent);state.completed=completed;state.part=part;receipt.completed=plan.parts.map(list=>list.every(u=>saved.has(abs(u))));persist();}
      const copy=snapshot();for(const fn of listeners){try{fn(copy);}catch(_){}}return copy;
    };
    function snapshot(){return Object.assign({},state,{started:receipt.started,resumeOnOpen:receipt.resumeOnOpen,essentialsReady:!!(plan&&plan.parts[0].every(u=>saved.has(abs(u))))});}
    async function refresh(){
      state.status='checking';update();
      try{plan=await bounded(()=>opt.plan(),timeout);if(!plan||plan.parts.length!==4)throw Error('Download list unavailable');
        cache=await bounded(()=>cacheStorage.open(CACHE),timeout);const keys=await bounded(()=>cache.keys(),timeout);saved=new Set(keys.map(r=>r.url));state.status='ready';state.error=null;const s=update();if(s.percent===100){state.status='complete';receipt.resumeOnOpen=false;return update();}return s;
      }catch(e){state.status='waiting';state.error='Downloads are unavailable. Please try again.';return update();}
    }
    function init(){return running?Promise.resolve(snapshot()):refresh();}
    function next(){
      if(running)return running;
      pause=false;
      running=(async()=>{
        if(!plan||!cache||state.status==='waiting'){await refresh();if(!plan||!cache||state.status==='waiting')return snapshot();}
        else{try{const keys=await bounded(()=>cache.keys(),timeout);saved=new Set(keys.map(r=>r.url));update();}catch(_){state.status='waiting';state.error='Saved content could not be checked. Please retry.';return update();}}
        if(state.percent===100||pause)return snapshot();
        if(opt.persistStorage)await bounded(()=>opt.persistStorage(),3000).catch(()=>{});
        if(pause)return snapshot();receipt.started=true;receipt.resumeOnOpen=true;state.status='downloading';state.error=null;persist();update();
        const index=state.part,queue=plan.parts[index].filter(u=>!saved.has(abs(u)));let failed=false,quotaFailed=false;
        const worker=async()=>{while(queue.length&&!pause){const u=queue.shift(),controller=new AbortController();controllers.add(controller);
          try{await bounded(async()=>{const response=await fetcher(u,{cache:'no-store',signal:controller.signal});if(!response||!response.ok||response.status===206||/text\/html/i.test(response.headers?.get('content-type')||''))throw Error('Asset unavailable');
            // A cache write, including the response body, must succeed before progress advances.
            await cache.put(u,response);},timeout,controller);saved.add(abs(u));try{if(opt.assetSaved)opt.assetSaved(u);}catch(_){}update();
          }catch(e){failed=true;if(e?.name==='QuotaExceededError')quotaFailed=true;}finally{controllers.delete(controller);}}};
        await Promise.all(Array.from({length:opt.concurrency||3},worker));
        if(state.percent===100){state.status='complete';receipt.resumeOnOpen=false;}
        else if(pause)state.status='paused';else if(failed){state.status='waiting';state.error=quotaFailed?'This device could not save more content. Free some space and retry.':'Some content is still loading. Retry when your connection is ready.';}
        else state.status='saved';return update();
      })().finally(()=>{running=null;});return running;
    }
    async function saveAndExit(){pause=true;for(const c of controllers)c.abort();if(running)await running;receipt.resumeOnOpen=true;persist();state.status='paused';return update();}
    async function reset(){await saveAndExit();receipt={started:false,resumeOnOpen:false};plan=null;cache=null;saved.clear();persist();state={status:'checking',percent:0,completed:0,part:0,error:null};return update();}
    return {init,next,saveAndExit,reset,snapshot,subscribe(fn){listeners.add(fn);fn(snapshot());return()=>listeners.delete(fn);},get plan(){return plan;}};
  }
  const api={CACHE,KEY,urls,partition,bounded,create};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EmberweaveFirstDownload=api;
})(typeof globalThis==='object'?globalThis:this);
