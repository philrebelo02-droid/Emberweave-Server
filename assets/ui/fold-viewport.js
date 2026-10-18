/* Layout-space adapters. Native browser hit testing and native event coordinates
   stay unchanged; game handlers explicitly read ewGameX/Y and ewGameRect(). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.EWViewport=api;api.install(root);}})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const state={rotated:false,width:0,height:0,physicalWidth:0,physicalHeight:0};
 function point(x,y,view=state){return view.rotated?{x:y,y:view.physicalWidth-x}:{x,y};}
 function screenPoint(x,y,view=state){return view.rotated?{x:view.physicalWidth-y,y:x}:{x,y};}
 function rect(r,view=state){const a=point(r.left,r.top,view),b=point(r.right,r.bottom,view),left=Math.min(a.x,b.x),top=Math.min(a.y,b.y),right=Math.max(a.x,b.x),bottom=Math.max(a.y,b.y);return {x:left,y:top,left,top,right,bottom,width:right-left,height:bottom-top};}
 function install(w){
  const d=w.document,nativeRect=w.Element.prototype.getBoundingClientRect,nativeHit=d.elementFromPoint.bind(d);
  Object.defineProperty(w.Element.prototype,'ewGameRect',{configurable:true,value:function(){return rect(nativeRect.call(this));}});
  for(const Type of [w.MouseEvent,w.Touch])if(Type)for(const axis of ['X','Y'])Object.defineProperty(Type.prototype,'ewGame'+axis,{configurable:true,get:function(){return point(this.clientX,this.clientY)[axis.toLowerCase()];}});
  w.ewGameElementFromPoint=(x,y)=>{const p=screenPoint(x,y);return nativeHit(p.x,p.y)};
  w.ewGameView=()=>({width:state.width||w.innerWidth,height:state.height||w.innerHeight});
  let focusRotation=null;const moved=[];let observing=false,lastScreen=null;const observer=new w.MutationObserver(()=>{if(state.rotated)refresh(false)});
  function observe(on){if(on===observing)return;observing=on;if(on)observer.observe(d.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','src']});else observer.disconnect();}
  function fit(){if(!d.body)return;const de=d.documentElement,vv=w.visualViewport;
   const layoutW=de.clientWidth||w.innerWidth,layoutH=de.clientHeight||w.innerHeight;
   const input=d.activeElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(d.activeElement.tagName);
   if(!input)focusRotation=null;
   const rotate=input&&focusRotation!=null?focusRotation:layoutW/layoutH<.8;
   if(input&&focusRotation==null)focusRotation=rotate;
   const width=Math.min(layoutW,vv&&vv.width?Math.round(vv.width*(vv.scale||1)):layoutW),height=Math.min(layoutH,vv&&vv.height?Math.round(vv.height*(vv.scale||1)):layoutH);
   const wasRotated=state.rotated,wasActive=state.rotated,active=rotate,changed=wasRotated!==rotate||state.width!==(rotate?height:width)||state.height!==(rotate?width:height)||lastScreen!==state.screen;
   Object.assign(state,{rotated:rotate,physicalWidth:width,physicalHeight:height,width:rotate?height:width,height:rotate?width:height});
   lastScreen=state.screen;observe(active);if(!active&&!wasActive)return;
   const b=d.body;
   if(b.classList.contains('ew-rotated')!==rotate)b.classList.toggle('ew-rotated',rotate);

   if(rotate){for(const [k,v]of [['width',state.width+'px'],['height',state.height+'px'],['transform','translateX('+width+'px) rotate(90deg)']])if(b.style[k]!==v)b.style[k]=v;
    for(const [k,v]of [['--ew-game-width',state.width],['--ew-game-height',state.height]])if(d.documentElement.style.getPropertyValue(k)!==v+'px')d.documentElement.style.setProperty(k,v+'px');
   }else if(wasRotated){for(const k of ['width','height','transform'])b.style.removeProperty(k);for(const k of ['--ew-game-width','--ew-game-height'])d.documentElement.style.removeProperty(k)}
   if(changed||wasActive&&!active)background();
  }
  function background(){if(!d.body)return;
   const notice=state.rotated&&state.screen!=='battle';if(d.body.classList.contains('ew-home-notice')!==notice)d.body.classList.toggle('ew-home-notice',notice);
   if(!state.rotated){for(const {node,anchor}of moved.splice(0)){if(anchor.parentNode){anchor.replaceWith(node)}}for(const e of d.querySelectorAll('.ew-pinned-exits,.ew-stage-exit')){const mute=e.querySelector('#muteBtn');if(mute)d.body.append(mute);e.remove()}return}
   const move=(node,host)=>{const anchor=d.createComment('original exit');node.before(anchor);moved.push({node,anchor});host.append(node)};
   for(const pop of d.querySelectorAll('.screen.popout')){
    const close=pop.querySelector('.popoutClose'),back=pop.id==='heroDetail'?pop.querySelector('.backbtn'):null;if(!close&&!back)continue;
    let header=pop.querySelector(':scope > .ew-pinned-exits');if(!header){header=d.createElement('div');header.className='ew-pinned-exits';pop.prepend(header)}
    if(back&&back.parentElement!==header)move(back,header);if(close&&close.parentElement!==header)move(close,header);
   }
   const modal=d.querySelector('#stageModal.active > .pm');
   if(modal&&!modal.querySelector(':scope > .ew-stage-exit')){const header=d.createElement('div');header.className='ew-stage-exit';const close=d.createElement('button');close.className='btn secondary sm';close.setAttribute('aria-label','Close stage');close.textContent='×';close.onclick=()=>{if(typeof w.closeStageModal==='function')w.closeStageModal()};header.append(close);modal.prepend(header)}
  }
  let scheduled=false,needsLayout=false;function refresh(layout){if(layout!==true&&!(state.rotated))return;needsLayout=needsLayout||layout===true;if(scheduled)return;scheduled=true;w.requestAnimationFrame(()=>{scheduled=false;const doLayout=needsLayout;needsLayout=false;if(doLayout)fit();else background()})}
  // Chromium's native touch scroll axes stay physical after a CSS root rotation.
  // Scroll ordinary lists in their own axes; leave controls and game drags alone.
  let drag=null;
  function scrollHost(target){for(let e=target;e&&e!==d.body;e=e.parentElement){const c=w.getComputedStyle(e);if(((/auto|scroll/.test(c.overflowY))&&e.scrollHeight>e.clientHeight+1)||((/auto|scroll/.test(c.overflowX))&&e.scrollWidth>e.clientWidth+1))return e}return null}
  d.addEventListener('touchstart',e=>{drag=null;if(!state.rotated||e.touches.length!==1||e.target.closest('input,textarea,select,[draggable=true],[data-unit],[data-field],[data-buy]'))return;const host=scrollHost(e.target);if(host){const t=e.touches[0],p=point(t.clientX,t.clientY);drag={host,x:p.x,y:p.y,left:host.scrollLeft,top:host.scrollTop}}},{passive:true,capture:true});
  d.addEventListener('touchmove',e=>{if(!drag||e.touches.length!==1)return;const t=e.touches[0],p=point(t.clientX,t.clientY);if(Math.hypot(p.x-drag.x,p.y-drag.y)<6)return;e.preventDefault();drag.host.scrollTop=drag.top-(p.y-drag.y);drag.host.scrollLeft=drag.left-(p.x-drag.x)},{passive:false,capture:true});
  for(const ev of ['touchend','touchcancel'])d.addEventListener(ev,()=>{drag=null},{passive:true,capture:true});
  d.addEventListener('DOMContentLoaded',fit);
  for(const ev of ['resize','orientationchange'])w.addEventListener(ev,()=>refresh(true));if(w.visualViewport)w.visualViewport.addEventListener('resize',()=>refresh(true));
  d.addEventListener('focusin',()=>{if(state.rotated)refresh(true)});d.addEventListener('focusout',()=>{if(state.rotated)w.setTimeout(()=>refresh(true),50)});
  d.addEventListener('fullscreenchange',()=>{if(d.fullscreenElement&&state.rotated&&w.screen.orientation&&w.screen.orientation.lock)Promise.resolve().then(()=>w.screen.orientation.lock('landscape')).catch(()=>{});if(state.rotated)refresh(true)});
  api.fit=fit;fit();
 }
 const api={state,point,screenPoint,rect,install};return api;
});
