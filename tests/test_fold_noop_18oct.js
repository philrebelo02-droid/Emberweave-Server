'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../assets/ui/fold-viewport.js'),'utf8');let checks=0;
const check=(name,v)=>{assert(v,name);checks++;console.log('ok '+name)};
(async()=>{const b=await chromium.launch({headless:true,args:['--disable-gpu','--disable-software-rasterizer','--mute-audio']});try{
 for(const [width,height]of [[844,390],[673,841],[841,673]]){
  const ctx=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),p=await ctx.newPage();
  await p.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{height:100%;margin:0}body.ew-rotated{position:fixed;transform-origin:0 0}</style><button class="probe">Tap</button><section class="screen popout"><button class="popoutClose">Close</button></section><script>window.writes=0;window.callbacks=0;for(const k of ['setProperty','removeProperty']){const f=CSSStyleDeclaration.prototype[k];CSSStyleDeclaration.prototype[k]=function(...a){if(this===document.body.style||this===document.documentElement.style)writes++;return f.apply(this,a)}}const NativeObserver=MutationObserver;window.MutationObserver=class extends NativeObserver{constructor(f){super((...a)=>{callbacks++;f(...a)})}}</script><script>${source}</script>`);
  await p.waitForTimeout(100);await p.evaluate(()=>{writes=callbacks=0;for(let i=0;i<100;i++){EWViewport.fit();document.querySelector('.probe').className='probe state'+i}});await p.waitForTimeout(100);
  const counts=await p.evaluate(()=>({writes,callbacks,rotated:EWViewport.state.rotated,inner:!!EWViewport.state.inner}));
  if(!counts.inner){check(`${width}x${height} no root style calls`,counts.writes===0);check(`${width}x${height} no mutation callbacks`,counts.callbacks===0);check(`${width}x${height} original exits untouched`,await p.locator('.screen>.popoutClose').count()===1)}
  await p.setViewportSize({width:344,height:882});await p.waitForTimeout(100);check(`${width}x${height} resize enables rotation`,await p.evaluate(()=>EWViewport.state.rotated));
  await p.evaluate(()=>{callbacks=0;document.querySelector('.probe').className='probe changed'});await p.waitForTimeout(100);check(`${width}x${height} active observation works`,await p.evaluate(()=>callbacks)>0);
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(150);await p.evaluate(()=>{writes=callbacks=0;for(let i=0;i<100;i++){EWViewport.fit();document.querySelector('.probe').className='probe back'+i}});await p.waitForTimeout(100);
  check(`${width}x${height} landscape restores and disconnects`,await p.evaluate(()=>!EWViewport.state.rotated&&writes===0&&callbacks===0)&&await p.locator('.screen>.popoutClose').count()===1);await ctx.close();
 }
}finally{await b.close()}console.log('PASS '+checks+' checks')})().catch(e=>{console.error(e);process.exitCode=1});
