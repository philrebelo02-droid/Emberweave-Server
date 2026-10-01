(function(root){
  'use strict';
  const IDS=['tree','oasis-north','oasis-south','oasis-east','oasis-west'];
  const title=id=>id==='tree'?'World Tree':id.slice(6).replace(/^./,x=>x.toUpperCase())+' oasis';
  function colour(id){if(!id)return '#97a3b5';let hash=0;for(const c of id)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;return 'hsl('+(hash%360)+',75%,72%)';}
  function read(control,score,layout){
    if(!control?.ok||!score?.ok||typeof control.enabled!=='boolean'||control.enabled!==score.enabled||!Array.isArray(control.sites)||!Array.isArray(score.scores)||layout?.coordinateSpace!=='world-percent'||layout.gridColumns!==220||!Array.isArray(layout.sites))throw Error('Unavailable');
    if(control.eventId&&score.eventId&&control.eventId!==score.eventId)throw Error('Event mismatch');
    const sites=IDS.map(id=>{const rows=layout.sites.filter(x=>x.id===id),held=control.sites.filter(x=>x.id===id);if(rows.length!==1||held.length>1)throw Error('Site mismatch');
      const b=rows[0].bounds;if(!b||!['left','top','right','bottom'].every(k=>Number.isFinite(b[k])&&b[k]>=0&&b[k]<=100)||b.left>=b.right||b.top>=b.bottom)throw Error('Invalid bounds');
      const gid=held[0]?.holderGuildId??null;if(gid!==null&&(typeof gid!=='string'||gid.length>200))throw Error('Invalid holder');
      const benefit=held[0]?.benefit;
      return {id,bounds:{...b},holderGuildId:gid,holderName:typeof held[0]?.holderGuildName==='string'?held[0].holderGuildName:'Guild',holderTag:typeof held[0]?.holderGuildTag==='string'?held[0].holderGuildTag:'',colour:colour(gid),benefit:benefit?.damagePercent===10&&benefit?.regenPercent===1&&benefit?.regenEveryMs===30000};
    });
    const scores=score.scores.map(x=>{if(typeof x.guildId!=='string'||x.guildId.length>200||!Number.isSafeInteger(x.points)||x.points<0)throw Error('Invalid score');return {guildId:x.guildId,guildName:typeof x.guildName==='string'?x.guildName:'Guild',guildTag:typeof x.guildTag==='string'?x.guildTag:'',points:x.points};});
    const active=control.enabled&&control.eventActive===true&&Number.isSafeInteger(control.startsAt)&&Number.isSafeInteger(control.endsAt)&&Number.isSafeInteger(control.serverNow)&&control.serverNow>=control.startsAt&&control.serverNow<control.endsAt;
    const marches=(control.marches||[]).map(m=>{
      if(typeof m.id!=='string'||!IDS.includes(m.siteId)||!Array.isArray(m.heroIds)||m.heroIds.some(k=>typeof k!=='string')||!['outbound','queued','fighting','garrison','returning','home'].includes(m.phase)||!Number.isSafeInteger(m.homeAt)||!Number.isFinite(m.healthPercent)||m.healthPercent<0||m.healthPercent>100)throw Error('Invalid own march');
      return {id:m.id,siteId:m.siteId,heroIds:m.heroIds.slice(0,5),phase:m.phase,homeAt:m.homeAt,healthPercent:m.healthPercent,canRetreat:m.canRetreat===true};
    });
    return {enabled:control.enabled,active,sites,scores,marches,guildId:typeof control.guildId==='string'?control.guildId:null,serverNow:control.serverNow,asOf:Number.isSafeInteger(score.asOf)?score.asOf:null};
  }
  function create(hooks){
    let identity=null,pending=null,data=null,failed=false,epoch=0,loadedAt=0,mounted=null,timer=null,knownMarches=[];
    function reset(){identity=hooks.identity();pending=null;data=null;knownMarches=[];failed=false;loadedAt=0;epoch++;}
    function current(){if(identity!==hooks.identity())reset();return data;}
    async function load(force=false){current();if(!identity)return null;if(pending)return pending;
      if(!force&&data&&hooks.now()-loadedAt<5000)return data;
      const key=identity,generation=epoch;
      pending=Promise.all([hooks.api('/api/world-tree/control'),hooks.api('/api/world-tree/score'),hooks.layout()]).then(([c,s,l])=>{
        const next=read(c,s,l);if(generation!==epoch||key!==hooks.identity())return null;data=next;knownMarches=next.marches;failed=false;loadedAt=hooks.now();if(hooks.changed)hooks.changed();return data;
      }).catch(()=>{if(generation===epoch&&key===hooks.identity()){data=null;failed=true;}return null;}).finally(()=>{if(generation===epoch)pending=null;});return pending;
    }
    function state(){current();return {data,failed,signedIn:!!identity};}
    function node(doc,tag,text){const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
    function render(inner,board){const st=state(),doc=inner.ownerDocument;
      const focus=doc.activeElement,focusSite=focus?.classList&&(focus.classList.contains('worldTreeCompactSite')||focus.classList.contains('worldTreeSiteHit'))?focus.dataset.siteId:null;
      inner.querySelectorAll('.worldTreeHolder,.worldTreeSiteHit').forEach(x=>x.remove());board.replaceChildren();
      board.style.display=st.data?.active?'block':'none';if(!st.data?.active)return;
      const z=hooks.zoom(),physicalWidth=inner.clientWidth*z;
      const compact=st.data.sites.some(s=>(s.bounds.right-s.bounds.left)*physicalWidth/100<44);
      board.dataset.compact=String(compact);
      const heading=node(doc,'b','World Tree');board.appendChild(heading);
      if(!st.data){board.appendChild(node(doc,'div',!st.signedIn?'Sign in':st.failed?'Unavailable':'Loading…'));return;}
      board.appendChild(node(doc,'span',st.data.enabled?' · Active':' · Disabled'));
      const list=node(doc,'div');list.style.cssText='display:flex;gap:10px;flex-wrap:wrap;max-height:90px;overflow:auto';board.appendChild(list);
      if(!st.data.scores.length)list.appendChild(node(doc,'span','No scores'));
      for(const row of st.data.scores){const el=node(doc,'span',(row.guildTag?'['+row.guildTag+'] ':'')+row.guildName+' · '+row.points);el.style.color=colour(row.guildId);list.appendChild(el);}
      const controls=node(doc,'div');controls.className='worldTreeCompactSites';controls.style.cssText='display:flex;flex-wrap:wrap;gap:4px;margin-top:4px';if(compact)board.appendChild(controls);
      for(const s of st.data.sites){const label=(s.holderGuildId?(s.holderTag?'['+s.holderTag+'] ':'')+s.holderName:'Unclaimed')+(s.benefit?' · +10% DMG · 1% HP/30s':'');const el=node(doc,'div',label),b=s.bounds;el.className='worldTreeHolder';el.dataset.siteId=s.id;el.title=title(s.id)+' · '+label;
        el.style.cssText='position:absolute;left:'+((b.left+b.right)/2)+'%;top:'+b.bottom+'%;transform:translate(-50%,4px);color:'+s.colour+';font-size:10px;font-weight:800;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px #000;pointer-events:none;z-index:7;zoom:'+1/hooks.zoom();inner.appendChild(el);if(compact)el.style.display='none';
        if(compact&&hooks.openSite){const pick=node(doc,'button');pick.type='button';pick.className='worldTreeCompactSite';pick.dataset.siteId=s.id;pick.setAttribute('aria-label',title(s.id));pick.style.cssText='flex:1 1 145px;min-width:0;min-height:44px;padding:6px;border:1px solid #596778;border-radius:5px;background:#26354c;color:'+s.colour+';font-size:11px;text-align:left;overflow:hidden';const name=node(doc,'b',title(s.id)),holder=node(doc,'div',label);holder.style.cssText='white-space:nowrap;overflow:hidden;text-overflow:ellipsis';pick.appendChild(name);pick.appendChild(holder);pick.onclick=e=>{if(hooks.canOpen&&!hooks.canOpen())return;e.stopPropagation();hooks.openSite(s.id);};controls.appendChild(pick);}
        if(hooks.openSite){const hit=node(doc,'button');hit.className='worldTreeSiteHit';hit.dataset.siteId=s.id;hit.setAttribute('aria-label',title(s.id));hit.style.cssText='position:absolute;left:'+b.left+'%;top:'+b.top+'%;width:'+(b.right-b.left)+'%;height:'+(b.bottom-b.top)+'%;background:transparent;border:0;padding:0;z-index:8;cursor:pointer';hit.onclick=e=>{if(hooks.canOpen&&!hooks.canOpen())return;e.stopPropagation();hooks.openSite(s.id);};inner.appendChild(hit);if(compact)hit.style.display='none';}
      }
      if(focusSite){const next=[...board.querySelectorAll('.worldTreeCompactSite'),...inner.querySelectorAll('.worldTreeSiteHit')].find(x=>x.dataset.siteId===focusSite&&x.style.display!=='none');if(next)next.focus({preventScroll:true});}
    }
    async function mount(inner,container){const doc=inner.ownerDocument;let board=container.querySelector('.worldTreeScoreboard');if(!board){board=node(doc,'section');board.className='worldTreeScoreboard';board.style.cssText='padding:6px 8px;background:#141b2b;border-radius:8px;font-size:12px;margin:4px 0';container.insertBefore(board,container.firstChild);}
      mounted={inner,board};if(timer!==null&&hooks.cancel)hooks.cancel(timer);timer=null;
      render(inner,board);await load();if(!inner.isConnected||!board.isConnected||mounted.inner!==inner)return;render(inner,board);poll();
    }
    function poll(){if(!hooks.schedule||timer!==null)return;timer=hooks.schedule(async()=>{timer=null;const m=mounted;if(!m?.inner.isConnected||!m.board.isConnected){mounted=null;return;}await load(true);if(mounted===m&&m.inner.isConnected){render(m.inner,m.board);poll();}},5000);}
    function zoom(inner){if(!inner)return;if(mounted?.inner===inner){render(inner,mounted.board);return;}inner.querySelectorAll('.worldTreeHolder').forEach(el=>{el.style.zoom=1/hooks.zoom();});}
    function heroes(){current();const now=hooks.now();return new Set(knownMarches.filter(m=>m.phase!=='home'&&(m.phase!=='returning'||m.homeAt>now)).flatMap(m=>m.heroIds));}
    function adopt(receipt){current();if(!identity||!Array.isArray(receipt?.marches))return;epoch++;pending=null;loadedAt=0;knownMarches=receipt.marches.filter(m=>typeof m.id==='string'&&IDS.includes(m.siteId)&&Array.isArray(m.heroIds)&&m.heroIds.every(k=>typeof k==='string')&&Number.isSafeInteger(m.homeAt)&&['outbound','queued','fighting','garrison','returning','home'].includes(m.phase)).map(m=>({id:m.id,siteId:m.siteId,heroIds:m.heroIds.slice(0,5),phase:m.phase,homeAt:m.homeAt}));}
    return {load,state,mount,zoom,reset,heroes,adopt};
  }
  const api={create,read,colour};if(typeof module==='object'&&module.exports)module.exports=api;else root.EmberweaveWorldTreeControlUI=api;
})(typeof globalThis==='object'?globalThis:this);
