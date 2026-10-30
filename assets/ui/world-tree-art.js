(function(root){
  'use strict';
  // v1226: the realm map's own transparent tree frames (the Phil-approved 05 World Tree/frames, sized by tools/realm/build_realm.py)
  const REALM=root.EmberweaveRealm||(typeof module==='object'&&module.exports?require('../../world-realm.js'):null);
  const BASE='/assets/img/world-map/realm-'+(REALM?REALM.META.version:'v12')+'/tree/';
  const V=root.EW_REALM_ASSET_V||'1';
  let current=null,lastSrc=null,lastFrame=null;   // 30 Oct 2026: the stage last shown, so a redrawn map starts on it (never a flash of another frame)
  // v1228: the no-stage fallback is kept at MODULE level - the first mount sets one deadline (4 s); a remount (every map redraw) waits
  // only for what is left of it, and once wt_28 is up it is the tree shown on every redraw until a real stage replaces it
  let fallbackAt=0,fallbackShown=false;
  function frameFor(phase){
    // v1226 (Phil 30 Oct 2026): the stepped cycle (world-tree-cycle.js) names the frame - one per New York day while it decays,
    // one per hour in the event, all 28 frames (wt_01 = the last decay day and the first event hour)
    if(!phase||!Number.isInteger(phase.framePosition)||phase.framePosition<0||phase.framePosition>27)return null;
    return phase.framePosition+1;
  }
  function mount(inner){
    if(current)current.stop();
    const target=inner.querySelector('#worldTreeTerrain');if(!target)return null;
    let stopped=false,requested=null,pending=null,generation=0;
    if(lastSrc){target.src=lastSrc;target.dataset.worldTreeFrame=String(lastFrame);target.style.visibility='';requested=lastFrame;}
    else{target.style.visibility='hidden';if(!fallbackAt)fallbackAt=Date.now()+4000;
      const fire=()=>{if(stopped||lastSrc||!target.isConnected)return;lastSrc=BASE+'wt_28.webp?v='+V;lastFrame=28;fallbackShown=true;
        target.src=lastSrc;target.dataset.worldTreeFrame='28';target.style.visibility='';requested=28;};
      const wait=fallbackAt-Date.now();if(wait<=0)fire();else target._wtFallback=setTimeout(fire,wait);}
    function update(event){
      const frame=frameFor(event.detail);if(frame===null||frame===requested||stopped)return;
      requested=frame;fallbackShown=false;const ticket=++generation;
      if(pending){pending.onload=null;pending.onerror=null;}
      const image=new Image();pending=image;
      image.onload=()=>{if(!stopped&&ticket===generation&&target.isConnected){target.src=image.src;target.dataset.worldTreeFrame=String(frame);target.style.visibility='';lastSrc=image.src;lastFrame=frame;if(target._wtFallback)clearTimeout(target._wtFallback);pending=null;}};
      image.onerror=()=>{if(ticket===generation){requested=null;pending=null;}};
      image.src=BASE+'wt_'+String(frame).padStart(2,'0')+'.webp?v='+V;
    }
    function stop(){stopped=true;generation++;if(target._wtFallback)clearTimeout(target._wtFallback);inner.removeEventListener('world-tree-phase',update);if(pending){pending.onload=null;pending.onerror=null;}if(current?.stop===stop)current=null;}
    inner.addEventListener('world-tree-phase',update);
    current={stop};return current;
  }
  const api={mount,stop:()=>current?.stop(),frameFor,_state:()=>({lastSrc,lastFrame,fallbackAt,fallbackShown}),_reset:()=>{lastSrc=null;lastFrame=null;fallbackAt=0;fallbackShown=false;}};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EmberweaveWorldTreeArt=api;
})(typeof globalThis==='object'?globalThis:this);
