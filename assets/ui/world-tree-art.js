(function(root){
  'use strict';
  const BASE='/assets/img/world-map/world-v02/overlays/worldtree-cycle-v1/';
  let current=null;
  function frameFor(phase){
    if(!phase||!Number.isFinite(phase.lifeFraction))return null;
    // wt_01 is fully dead, reserved for previews. The live tree never reaches death.
    const life=Math.max(0,Math.min(1,(phase.lifeFraction-1/28)/(27/28)));
    // 27 frames (2..28) share the phase in EQUAL time slices: 13 d / 27 = 11 h 33 m each while decaying
    return 2+Math.min(26,Math.floor(life*27));
  }
  function mount(inner){
    if(current)current.stop();
    const target=inner.querySelector('#worldTreeTerrain');if(!target)return null;
    let stopped=false,requested=null,pending=null,generation=0;
    function update(event){
      const frame=frameFor(event.detail);if(frame===null||frame===requested||stopped)return;
      requested=frame;const ticket=++generation;
      if(pending){pending.onload=null;pending.onerror=null;}
      const image=new Image();pending=image;
      image.onload=()=>{if(!stopped&&ticket===generation&&target.isConnected){target.src=image.src;target.dataset.worldTreeFrame=String(frame);pending=null;}};
      image.onerror=()=>{if(ticket===generation){requested=null;pending=null;}};
      image.src=BASE+'wt_'+String(frame).padStart(2,'0')+'.webp';
    }
    function stop(){stopped=true;generation++;inner.removeEventListener('world-tree-phase',update);if(pending){pending.onload=null;pending.onerror=null;}if(current?.stop===stop)current=null;}
    inner.addEventListener('world-tree-phase',update);
    current={stop};return current;
  }
  const api={mount,stop:()=>current?.stop(),frameFor};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EmberweaveWorldTreeArt=api;
})(typeof globalThis==='object'?globalThis:this);
