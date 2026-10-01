(function(root){
  'use strict';
  let current=null;
  function mount(inner){
    if(current)current.stop();
    const node=document.createElement('div');node.id='worldTreeCountdown';node.className='wnode';
    node.style.cssText='left:50%;top:55.7%;z-index:6;pointer-events:none;cursor:default';
    const box=document.createElement('div');box.className='wlab';
    box.style.cssText='position:relative;left:auto;top:auto;transform:none;background:rgba(13,18,29,.88);border:1px solid #8f7650;border-radius:8px;padding:5px 10px;box-shadow:0 2px 8px #0008';
    const label=document.createElement('div');label.className='nl';label.textContent='World Tree';
    const time=document.createElement('div');time.className='nl';time.style.cssText='color:#ffd45e;font-variant-numeric:tabular-nums;font-size:12px';time.textContent='Syncing event timer…';
    time.setAttribute('role','timer'); // Not an every-second screen-reader announcement.
    box.appendChild(label);box.appendChild(time);node.appendChild(box);inner.appendChild(node);
    let stopped=false,pending=false,receivedAt=0,data=null,interval,request=null,timeout;
    function stop(){stopped=true;clearInterval(interval);clearTimeout(timeout);request?.abort();document.removeEventListener('visibilitychange',visible);node.remove();if(current?.node===node)current=null;}
    function draw(){
      if(!node.isConnected){stop();return;}
      if(!data?.configured)return;
      const now=Math.floor(data.serverNow+performance.now()-receivedAt);
      const phase=root.EmberweaveWorldTreeCycle.phase(data.firstEventAt,now);
      label.textContent=phase.phase==='event'?'Event ends in':'Next event in';
      time.textContent=root.EmberweaveWorldTreeCycle.format(phase.remainingMs);
      node.dataset.phase=phase.phase;node.dataset.lifeFraction=String(phase.lifeFraction);
      // Future approved decay/regrowth art consumes the SAME clock, not a second timer.
      node.dispatchEvent(new CustomEvent('world-tree-phase',{detail:phase,bubbles:true}));
    }
    async function sync(){
      if(stopped||pending||document.hidden)return;pending=true;request=new AbortController();
      timeout=setTimeout(()=>request.abort(),10000);
      const started=performance.now();
      try{
        const response=await fetch('/api/world-tree/status',{signal:request.signal,cache:'no-store'});
        if(!response.ok)throw new Error('Event status unavailable');
        const next=await response.json();
        if(stopped||!node.isConnected)return;
        if(typeof next.configured!=='boolean'||!Number.isSafeInteger(next.serverNow))throw new Error('Invalid event status');
        if(next.configured)root.EmberweaveWorldTreeCycle.phase(next.firstEventAt,next.serverNow);
        data=next;receivedAt=(started+performance.now())/2;
        if(!next.configured){label.textContent='World Tree';time.textContent='Event schedule pending';delete node.dataset.phase;delete node.dataset.lifeFraction;}
        draw();
      }catch(error){if(!stopped&&!data?.configured)time.textContent='Timer unavailable — reconnecting';}
      finally{clearTimeout(timeout);pending=false;}
    }
    function visible(){if(!document.hidden){draw();sync();}}
    document.addEventListener('visibilitychange',visible);
    let ticks=0;interval=setInterval(()=>{draw();if(++ticks%30===0)sync();},1000);
    current={node,stop,setZoom:zoom=>{if(Number.isFinite(zoom)&&zoom>0)box.style.transform='scale('+1/zoom+')';}};sync();return current;
  }
  root.EmberweaveWorldTreeCountdown={mount,stop:()=>current?.stop(),setZoom:zoom=>current?.setZoom(zoom)};
})(window);
