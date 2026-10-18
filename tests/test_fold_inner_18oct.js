'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),{chromium}=require('playwright'),view=require('../assets/ui/fold-viewport.js');
const sizes=[[344,882,false,true],[673,841,true,false],[841,673,true,false],[390,844,false,true],[844,390,false,false],[717,512,true,false],[512,717,true,false]];
let count=0;const check=(name,ok)=>{assert(ok,name);count++;console.log('ok '+name)};
(async()=>{const browser=await chromium.launch({headless:true,args:['--mute-audio','--disable-gpu','--disable-software-rasterizer']});try{
 const script=fs.readFileSync(path.join(__dirname,'../assets/ui/fold-viewport.js'),'utf8');
 for(const [width,height,inner,rotated]of sizes){
  check(`${width}x${height} inner classification`,view.innerView(width,height)===inner);
  const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),p=await ctx.newPage();
  await p.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body.ew-rotated{position:fixed;transform-origin:0 0}.screen.popout{position:fixed;inset:12px;overflow:auto}</style><script>${script}</script><section class="screen popout"><button class="popoutClose">Close</button><div style="height:1500px">Long window</div></section>`);await p.waitForTimeout(100);
  check(`${width}x${height} rotation`,await p.evaluate(()=>EWViewport.state.rotated)===rotated);
  check(`${width}x${height} pinned exit when full screen needs it`,await p.locator('.ew-pinned-exits').count()===(inner||rotated?1:0));
  const data=await p.evaluate(()=>({w:EWViewport.state.width,h:EWViewport.state.height,body:document.body.getBoundingClientRect().toJSON()}));
  check(`${width}x${height} full logical viewport`,data.w===(rotated?height:width)&&data.h===(rotated?width:height));
  if(inner){await p.evaluate(()=>{const input=document.createElement('input');input.id='keyboard';document.body.append(input);input.focus()});await p.waitForTimeout(100);await p.setViewportSize({width,height:300});await p.waitForTimeout(100);check(`${width}x${height} keyboard retains inner layout`,await p.evaluate(()=>EWViewport.state.inner&&!EWViewport.state.rotated));await p.locator('#keyboard').blur();await p.waitForTimeout(100);await p.setViewportSize({width:844,height:390});await p.waitForTimeout(100);check(`${width}x${height} folding back restores original exit`,await p.locator('.ew-pinned-exits').count()===0&&await p.locator('.screen>.popoutClose').count()===1)}
  await ctx.close();
 }
}finally{await browser.close()}console.log('PASS '+count+' checks')})().catch(e=>{console.error(e);process.exitCode=1});
