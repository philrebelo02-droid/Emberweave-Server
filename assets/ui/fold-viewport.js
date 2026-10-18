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
  let focusRotation=null;
  function fit(){if(!d.body)return;const de=d.documentElement,vv=w.visualViewport;
   const layoutW=de.clientWidth||w.innerWidth,layoutH=de.clientHeight||w.innerHeight;
   const input=d.activeElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(d.activeElement.tagName);
   if(!input)focusRotation=null;
   const rotate=input&&focusRotation!=null?focusRotation:layoutW/layoutH<.8;
   if(input&&focusRotation==null)focusRotation=rotate;
   const width=Math.min(layoutW,vv&&vv.width?Math.round(vv.width*(vv.scale||1)):layoutW),height=Math.min(layoutH,vv&&vv.height?Math.round(vv.height*(vv.scale||1)):layoutH);
   Object.assign(state,{rotated:rotate,physicalWidth:width,physicalHeight:height,width:rotate?height:width,height:rotate?width:height});
   const b=d.body,square=!rotate&&layoutW/layoutH>=.8&&layoutW/layoutH<=1.25;
   if(b.classList.contains('ew-rotated')!==rotate)b.classList.toggle('ew-rotated',rotate);
   if(b.classList.contains('ew-square')!==square)b.classList.toggle('ew-square',square);
   b.style.width=state.width+'px';b.style.height=state.height+'px';b.style.transform=rotate?'translateX('+width+'px) rotate(90deg)':'none';
   d.documentElement.style.setProperty('--ew-game-width',state.width+'px');d.documentElement.style.setProperty('--ew-game-height',state.height+'px');
  }
  function background(){if(!d.body)return;const active=d.querySelector('.screen.active:not(.popout)'),town=d.getElementById('townImg'),battle=d.getElementById('battleBg');let image='';
   if(active&&active.id==='home'&&town&&town.getAttribute('src'))image='url("'+town.getAttribute('src').replace(/"/g,'%22')+'")';
   else if(active&&active.id==='battle'&&battle)image=w.getComputedStyle(battle).backgroundImage;
   else if(active&&active.id==='world'){const map=d.getElementById('worldPictureMaster');if(map&&map.getAttribute('src'))image='url("'+map.getAttribute('src').replace(/"/g,'%22')+'")'}
   else if(active&&active.id==='campaign')image=w.getComputedStyle(active).getPropertyValue('--campbg');
   if(!image||image==='none')image=active?w.getComputedStyle(active).backgroundImage:'';
   if(!image||image==='none')image='url("/assets/img/ui/screen-bg.webp?v=1")';
   d.body.style.setProperty('--ew-stage-background',image);
   for(const pop of d.querySelectorAll('.screen.popout')){
    const close=pop.querySelector('.popoutClose'),back=pop.id==='heroDetail'?pop.querySelector('.backbtn'):null;if(!close&&!back)continue;
    let header=pop.querySelector(':scope > .ew-pinned-exits');if(!header){header=d.createElement('div');header.className='ew-pinned-exits';pop.prepend(header)}
    if(back&&back.parentElement!==header)header.append(back);if(close&&close.parentElement!==header)header.append(close);
   }
  }
  let scheduled=false;function refresh(){if(scheduled)return;scheduled=true;w.requestAnimationFrame(()=>{scheduled=false;fit();background()})}
  // Chromium's native touch scroll axes stay physical after a CSS root rotation.
  // Scroll ordinary lists in their own axes; leave controls and game drags alone.
  let drag=null;
  function scrollHost(target){for(let e=target;e&&e!==d.body;e=e.parentElement){const c=w.getComputedStyle(e);if(((/auto|scroll/.test(c.overflowY))&&e.scrollHeight>e.clientHeight+1)||((/auto|scroll/.test(c.overflowX))&&e.scrollWidth>e.clientWidth+1))return e}return null}
  d.addEventListener('touchstart',e=>{drag=null;if(!state.rotated||e.touches.length!==1||e.target.closest('input,textarea,select,[draggable=true],[data-unit],[data-field],[data-buy]'))return;const host=scrollHost(e.target);if(host){const t=e.touches[0],p=point(t.clientX,t.clientY);drag={host,x:p.x,y:p.y,left:host.scrollLeft,top:host.scrollTop}}},{passive:true,capture:true});
  d.addEventListener('touchmove',e=>{if(!drag||e.touches.length!==1)return;const t=e.touches[0],p=point(t.clientX,t.clientY);if(Math.hypot(p.x-drag.x,p.y-drag.y)<6)return;e.preventDefault();drag.host.scrollTop=drag.top-(p.y-drag.y);drag.host.scrollLeft=drag.left-(p.x-drag.x)},{passive:false,capture:true});
  for(const ev of ['touchend','touchcancel'])d.addEventListener(ev,()=>{drag=null},{passive:true,capture:true});
  d.addEventListener('DOMContentLoaded',()=>{fit();background();new w.MutationObserver(refresh).observe(d.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','src']})});
  w.addEventListener('resize',refresh);if(w.visualViewport)w.visualViewport.addEventListener('resize',refresh);
  d.addEventListener('focusin',refresh);d.addEventListener('focusout',()=>w.setTimeout(refresh,50));
  d.addEventListener('fullscreenchange',()=>{if(d.fullscreenElement&&w.screen.orientation&&w.screen.orientation.lock)Promise.resolve().then(()=>w.screen.orientation.lock('landscape')).catch(()=>{});refresh()});
  api.fit=fit;fit();
 }
 const api={state,point,screenPoint,rect,install};return api;
});
