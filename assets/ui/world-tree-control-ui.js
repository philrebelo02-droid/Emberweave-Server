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
      return {id,bounds:{...b},holderGuildId:gid,holderName:typeof held[0]?.holderGuildName==='string'?held[0].holderGuildName:'Guild',holderTag:typeof held[0]?.holderGuildTag==='string'?held[0].holderGuildTag:'',colour:colour(gid)};
    });
    const scores=score.scores.map(x=>{if(typeof x.guildId!=='string'||x.guildId.length>200||!Number.isSafeInteger(x.points)||x.points<0)throw Error('Invalid score');return {guildId:x.guildId,guildName:typeof x.guildName==='string'?x.guildName:'Guild',guildTag:typeof x.guildTag==='string'?x.guildTag:'',points:x.points};});
    const active=control.enabled&&control.eventActive===true&&Number.isSafeInteger(control.startsAt)&&Number.isSafeInteger(control.endsAt)&&Number.isSafeInteger(control.serverNow)&&control.serverNow>=control.startsAt&&control.serverNow<control.endsAt;
    return {enabled:control.enabled,active,sites,scores,asOf:Number.isSafeInteger(score.asOf)?score.asOf:null};
  }
  function create(hooks){
    let identity=null,pending=null,data=null,failed=false,epoch=0,loadedAt=0,mounted=null,timer=null;
    function reset(){identity=hooks.identity();pending=null;data=null;failed=false;loadedAt=0;epoch++;}
    function current(){if(identity!==hooks.identity())reset();return data;}
    async function load(force=false){current();if(!identity)return null;if(pending)return pending;
      if(!force&&data&&hooks.now()-loadedAt<5000)return data;
      const key=identity,generation=epoch;
      pending=Promise.all([hooks.api('/api/world-tree/control'),hooks.api('/api/world-tree/score'),hooks.layout()]).then(([c,s,l])=>{
        const next=read(c,s,l);if(generation!==epoch||key!==hooks.identity())return null;data=next;failed=false;loadedAt=hooks.now();return data;
      }).catch(()=>{if(generation===epoch&&key===hooks.identity()){data=null;failed=true;}return null;}).finally(()=>{if(generation===epoch)pending=null;});return pending;
    }
    function state(){current();return {data,failed,signedIn:!!identity};}
    function node(doc,tag,text){const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
    function render(inner,board){const st=state(),doc=inner.ownerDocument;
      inner.querySelectorAll('.worldTreeHolder').forEach(x=>x.remove());board.replaceChildren();
      board.style.display=st.data?.active?'block':'none';if(!st.data?.active)return;
      const heading=node(doc,'b','World Tree');board.appendChild(heading);
      if(!st.data){board.appendChild(node(doc,'div',!st.signedIn?'Sign in':st.failed?'Unavailable':'Loading…'));return;}
      board.appendChild(node(doc,'span',st.data.enabled?' · Active':' · Disabled'));
      const list=node(doc,'div');list.style.cssText='display:flex;gap:10px;flex-wrap:wrap;max-height:90px;overflow:auto';board.appendChild(list);
      if(!st.data.scores.length)list.appendChild(node(doc,'span','No scores'));
      for(const row of st.data.scores){const el=node(doc,'span',(row.guildTag?'['+row.guildTag+'] ':'')+row.guildName+' · '+row.points);el.style.color=colour(row.guildId);list.appendChild(el);}
      for(const s of st.data.sites){const label=s.holderGuildId?(s.holderTag?'['+s.holderTag+'] ':'')+s.holderName:'Unclaimed';const el=node(doc,'div',label),b=s.bounds;el.className='worldTreeHolder';el.dataset.siteId=s.id;el.title=title(s.id)+' · '+label;
        el.style.cssText='position:absolute;left:'+((b.left+b.right)/2)+'%;top:'+b.bottom+'%;transform:translate(-50%,4px);color:'+s.colour+';font-size:10px;font-weight:800;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px #000;pointer-events:none;z-index:7;zoom:'+1/hooks.zoom();inner.appendChild(el);
      }
    }
    async function mount(inner,container){const doc=inner.ownerDocument;let board=container.querySelector('.worldTreeScoreboard');if(!board){board=node(doc,'section');board.className='worldTreeScoreboard';board.style.cssText='padding:6px 8px;background:#141b2b;border-radius:8px;font-size:12px;margin:4px 0';container.insertBefore(board,container.firstChild);}
      mounted={inner,board};if(timer!==null&&hooks.cancel)hooks.cancel(timer);timer=null;
      render(inner,board);await load();if(!inner.isConnected||!board.isConnected||mounted.inner!==inner)return;render(inner,board);poll();
    }
    function poll(){if(!hooks.schedule||timer!==null)return;timer=hooks.schedule(async()=>{timer=null;const m=mounted;if(!m?.inner.isConnected||!m.board.isConnected){mounted=null;return;}await load(true);if(mounted===m&&m.inner.isConnected){render(m.inner,m.board);poll();}},5000);}
    function zoom(inner){if(!inner)return;inner.querySelectorAll('.worldTreeHolder').forEach(el=>{el.style.zoom=1/hooks.zoom();});}
    return {load,state,mount,zoom,reset};
  }
  const api={create,read,colour};if(typeof module==='object'&&module.exports)module.exports=api;else root.EmberweaveWorldTreeControlUI=api;
})(typeof globalThis==='object'?globalThis:this);
