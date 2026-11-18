(function(root){
  'use strict';
  const IDS=['tree','oasis-nw','oasis-ne','oasis-sw','oasis-se'];
  const _t=(k,en,vars)=>(typeof t==='function'&&t(k,vars))||en;   /* v1271 LANGUAGES step 2: names through the page's t() */
  const NAMES={get tree(){return _t('world2.world_tree','World Tree');},get 'oasis-nw'(){return _t('world2.oasis_nw','North-west Oasis');},get 'oasis-ne'(){return _t('world2.oasis_ne','North-east Oasis');},get 'oasis-sw'(){return _t('world2.oasis_sw','South-west Oasis');},get 'oasis-se'(){return _t('world2.oasis_se','South-east Oasis');}};   // v1228: the 4 painted ponds
  const title=id=>NAMES[id]||_t('world2.oasis','Oasis');
  const marchPhases=new Map([
    ['outbound',['hut.marching','Marching']],
    ['queued',['draft.waiting','Waiting…']],
    ['fighting',['skyhub.in_battle','In battle']],
    ['garrison',['march.stationed','Stationed']],
    ['returning',['world2.march_returning','Returning']],
    ['home',['fx2.returned','Returned']],
  ]);
  function marchLabel(m){
    const phase=marchPhases.get(m.phase);
    const status=phase?_t(...phase):m.phase;
    const locale=typeof LANG==='object'&&LANG.cur!=='qps'?LANG.cur:'en';
    const health=(m.healthPercent/100).toLocaleString(locale,{style:'percent',maximumFractionDigits:1});
    return status+' · '+health+' '+_t('gloss.hp','HP');
  }
  function create(hooks){
    let overlay=null,identity=null,siteId=null,selected=null,error='',operation=null,inflight=false,checking=false,generation=0;
    const doc=hooks.document;
    function reset(){generation++;identity=hooks.identity();overlay?.remove();overlay=null;siteId=null;selected=null;error='';operation=null;inflight=false;checking=false;}
    function current(){if(identity!==hooks.identity())reset();return !!identity;}
    function el(tag,text){const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
    function button(text,fn,disabled=false){const n=el('button',text);n.className='btn';n.disabled=disabled;n.onclick=fn;return n;}
    function close(){overlay?.remove();overlay=null;selected=null;}
    async function fresh(){if(!current())return null;const key=identity,epoch=generation;await hooks.control().load(true);if(key!==hooks.identity()||epoch!==generation)return null;return hooks.control().state().data;}
    async function submit(kind,payload){
      if(!current()||inflight||checking)return;
      if(operation&&(operation.kind!==kind||JSON.stringify(operation.payload)!==JSON.stringify(payload)))return;
      const key=identity,epoch=generation;checking=true;
      try{if(!operation){
        const data=await fresh();if(!data?.active){error=_t('err.world_tree_control_unavailable','Unavailable');render();return;}
        if(kind==='start'){
          const busy=await hooks.busy();if(key!==hooks.identity()||epoch!==generation){reset();return;}
          if(!data.guildId){error=_t('siege.join_to_attack','Guild required',{name:title(siteId)});render();return;}
          const owned=new Set(hooks.heroes().map(h=>h.key));
          if(!payload.heroIds.length||payload.heroIds.length>5||payload.heroIds.some(k=>!owned.has(k)||busy.has(k)||hooks.control().heroes().has(k))){error=_t('world2.hero_unavailable','Hero unavailable');render();return;}
        }else if(!data.marches.some(m=>m.id===payload.marchId&&m.canRetreat)){error=_t('world2.retreat_unavailable','Retreat unavailable');render();return;}
      }}catch(_e){error=_t('err.world_tree_control_unavailable','Unavailable');render();return;}finally{if(epoch===generation)checking=false;}
      if(key!==hooks.identity()||epoch!==generation){reset();return;}
      if(!operation)operation={kind,payload:JSON.parse(JSON.stringify(payload)),requestId:hooks.requestId()};
      const op=operation;inflight=true;error='';render();
      // v1129: busy battle servers (a World Tree peak) answer retryAfterMs - the same requestId again, waits growing ~1, 2, 4, 8 s, jittered
      let result;for(let t=0;;t++){try{result=await hooks.post('/api/world-tree/march/'+kind,{...op.payload,requestId:op.requestId});}catch(_e){result={error:'offline'};}
        if(!(result?.busy&&result.retryAfterMs)||t>=5||epoch!==generation)break;
        await new Promise(z=>setTimeout(z,Math.min(10000,Math.max(+result.retryAfterMs||1000,1000*2**t))*(0.75+Math.random()*0.5)));}
      if(epoch!==generation||key!==hooks.identity()){reset();return;}
      inflight=false;
      if(result?.ok){operation=null;selected=null;hooks.control().adopt(result.control);await fresh();error='';}
      else if(!result||['offline','timeout'].includes(result.error)||result.busy){error=_t('world2.action_unconfirmed','The action could not be confirmed.');}
      else{operation=null;error=hooks.message?.(result.error)||result.error||_t('err.world_tree_control_unavailable','Unavailable');}
      render();
    }
    function render(){
      if(!overlay?.isConnected||!current())return;
      const data=hooks.control().state().data;overlay.replaceChildren();
      if(data&&!data.active&&!operation){close();return;}
      const card=el('section');card.style.cssText='background:#141b2b;color:#eee;border:1px solid #33405e;border-radius:14px;padding:14px;width:92%;max-width:420px;max-height:84vh;overflow:auto';overlay.appendChild(card);
      const head=el('div');head.style.cssText='display:flex;justify-content:space-between;align-items:center';const dismiss=button('✕',close);dismiss.setAttribute('aria-label',_t('common.close','Close'));head.append(el('b',title(siteId)),dismiss);card.appendChild(head);
      if(error)card.appendChild(el('div',error));
      if(operation){card.appendChild(button(inflight?_t('common.in_progress','Pending'):_t('common.retry','Retry'),()=>submit(operation.kind,operation.payload),inflight));return;}
      if(!data?.active){card.appendChild(el('div',_t('err.world_tree_control_unavailable','Unavailable')));return;}
      const site=data.sites.find(s=>s.id===siteId);card.appendChild(el('div',site?.holderGuildId?(site.holderName||_t('nav.guild','Guild')):_t('world2.unclaimed','Unclaimed')));
      if(selected){
        const grid=el('div');grid.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin:10px 0';card.appendChild(grid);const busy=hooks.cachedBusy();
        for(const h of hooks.heroes()){const away=busy.has(h.key)||hooks.control().heroes().has(h.key);if(away)selected.delete(h.key);const b=button(h.name+' · '+_t('stage.lv','Lv '+h.level,{n:h.level})+(away?' · '+_t('world2.hero_away','Away'):''),()=>{if(selected.has(h.key))selected.delete(h.key);else if(selected.size<5)selected.add(h.key);render();},away);b.dataset.hero=h.key;b.setAttribute('aria-pressed',String(selected.has(h.key)));grid.appendChild(b);}
        card.append(el('div',selected.size+'/5 · '+hooks.power([...selected])),button(_t('castle.attack','Launch'),()=>submit('start',{siteId,heroIds:[...selected]}),!selected.size));return;
      }
      card.appendChild(button(_t('castle.attack','Launch'),async()=>{const d=await fresh();if(!d?.active||!current())return;await hooks.busy();if(!current())return;selected=new Set();render();},!data.guildId));
      for(const m of data.marches.filter(m=>m.siteId===siteId)){const row=el('div',marchLabel(m));row.style.cssText='margin-top:10px';if(m.canRetreat)row.appendChild(button(_t('march.retreat','Retreat'),()=>submit('retreat',{marchId:m.id})));card.appendChild(row);}
    }
    async function open(id){if(!IDS.includes(id)||!current())return;const data=await fresh();if(!data?.active||!current())return;close();siteId=id;error='';overlay=el('div');overlay.className='worldTreeActions';overlay.style.cssText='position:fixed;inset:0;background:rgba(4,6,10,.75);z-index:12000;display:flex;align-items:center;justify-content:center';overlay.onclick=e=>{if(e.target===overlay)close();};doc.body.appendChild(overlay);render();}
    return {open,reset,render,submit};
  }
  const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.EmberweaveWorldTreeActionsUI=api;
})(typeof globalThis==='object'?globalThis:this);
