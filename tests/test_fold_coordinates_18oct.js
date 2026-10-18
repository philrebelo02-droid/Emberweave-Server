'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const api=require('../assets/ui/fold-viewport.js'),{chromium}=require('playwright');
const sizes=[[344,882],[390,844],[844,390]];
let checks=0;const ck=(s,v)=>{assert(v,s);checks++;console.log('ok '+s)};
for(const [w,h]of sizes){const view={rotated:w/h<.8,physicalWidth:w};for(const [x,y]of [[0,0],[w/2,h/2],[w,h],[1,h-1]]){const p=api.point(x,y,view),q=api.screenPoint(p.x,p.y,view);ck(w+'x'+h+' pointer inverse '+x+','+y,Math.abs(q.x-x)<1e-9&&Math.abs(q.y-y)<1e-9)}}
(async()=>{const browser=await chromium.launch({headless:true,args:['--mute-audio','--disable-gpu','--disable-software-rasterizer']});try{
 const script=fs.readFileSync(path.join(__dirname,'../assets/ui/fold-viewport.js'),'utf8');
 for(const [width,height]of sizes){const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),p=await ctx.newPage();
 await p.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden}body{position:fixed;left:0;top:0;height:100vh;width:100vw;transform-origin:0 0}#tap{position:absolute;left:50px;top:50px;width:100px;height:40px}#range{position:absolute;left:50px;top:110px;width:150px}#list{position:absolute;left:220px;top:50px;width:100px;height:230px;overflow-y:auto;touch-action:pan-y}#input{position:absolute;left:50px;top:160px;width:130px}</style><script>${script}</script><button id="tap">Tap</button><input id="range" type="range" value="0"><input id="input"><div id="list"><div style="height:1200px">A long list</div></div><script>document.querySelector('#tap').onclick=e=>window.hit={x:e.ewGameX,y:e.ewGameY,nativeX:e.clientX,nativeY:e.clientY};</script>`);
 await p.waitForTimeout(150);await p.locator('#tap').click();const hit=await p.evaluate(()=>window.hit);
 ck(width+'x'+height+' trusted tap maps to layout coordinates',Math.abs(hit.x-100)<2&&Math.abs(hit.y-70)<2);
 ck(width+'x'+height+' native coordinates remain native',width/height<.8?Math.abs(hit.nativeX-hit.x)>10:hit.nativeX===hit.x);
 const point=await p.evaluate(()=>EWViewport.screenPoint(180,120));await p.mouse.click(point.x,point.y);
 ck(width+'x'+height+' native slider works through root transform',+(await p.locator('#range').inputValue())>50);
 await p.locator('#input').fill('Emberweave');ck(width+'x'+height+' input accepts keyboard text',await p.locator('#input').inputValue()==='Emberweave');
 if(width/height<.8){await p.waitForTimeout(100);await p.setViewportSize({width,height:400});await p.waitForTimeout(100);ck(width+'x'+height+' keyboard-sized viewport keeps its rotation while typing',await p.evaluate(()=>EWViewport.state.rotated));await p.setViewportSize({width,height});await p.waitForTimeout(100)}
 await p.locator('#input').blur();
 await p.evaluate(()=>{const e=document.createElement('div');e.id='formation-drag';e.dataset.unit='vael';e.style.cssText='position:absolute;left:50px;top:240px;width:100px;height:40px;background:gold;touch-action:none';let start=null;e.onpointerdown=p=>{start=p.ewGameX;e.setPointerCapture(p.pointerId)};e.onpointermove=p=>{if(start!=null)e.style.left=(50+p.ewGameX-start)+'px'};e.onpointerup=()=>{start=null};document.body.append(e)});
 const move=await p.evaluate(()=>[EWViewport.screenPoint(100,260),EWViewport.screenPoint(140,260)]);await p.mouse.move(move[0].x,move[0].y);await p.mouse.down();await p.mouse.move(move[1].x,move[1].y,{steps:5});await p.mouse.up();
 ck(width+'x'+height+' captured formation-style drag moves in its layout direction',await p.locator('#formation-drag').evaluate(e=>Math.abs(parseFloat(e.style.left)-90)<2));
 const ends=await p.evaluate(()=>[EWViewport.screenPoint(270,240),EWViewport.screenPoint(270,80)]),cdp=await ctx.newCDPSession(p);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[ends[0]]});
 for(let i=1;i<=12;i++){const t=i/12;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:ends[0].x+(ends[1].x-ends[0].x)*t,y:ends[0].y+(ends[1].y-ends[0].y)*t}]});await p.waitForTimeout(12)}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(100);
 ck(width+'x'+height+' native touch scroll follows rotated local axis',await p.locator('#list').evaluate(e=>e.scrollTop)>30);
 await ctx.close();
 }
}finally{await browser.close()}console.log('PASS '+checks+' checks')})().catch(e=>{console.error(e);process.exitCode=1});
