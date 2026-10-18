'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../emberweave-heroes.html'),'utf8');
const selectors=['#app','#cmap','#stageModal .pm','#menuPanel','#skyIslandBody .islemap'];
const rules=selectors.map(sel=>{const escaped=sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const matches=[...html.matchAll(new RegExp(escaped+'\\{[^}]*\\}','g'))].map(m=>m[0]);const rule=matches.find(r=>r.includes('100dvh'));assert(rule,'dynamic fallback missing for '+sel);assert(rule.includes('100vh'),'legacy fallback missing for '+sel);return rule});
const css=rules.join('\n');let checks=0;const check=(name,v)=>{assert(v,name);checks++;console.log('ok '+name)};
// Headless browser toolbars do not shrink dvh independently. Resolve the actual
// extracted declarations against separate large/dynamic sizes to test that case.
function resolve(source,s){return source.replace(/100dvw/g,s.w+'px').replace(/100dvh/g,s.h+'px').replace(/100vw/g,s.largeW+'px').replace(/100vh/g,s.largeH+'px')}
(async()=>{const b=await chromium.launch({headless:true,args:['--disable-gpu','--disable-software-rasterizer']});try{
 for(const s of [{w:844,h:390,largeW:900,largeH:450},{w:1200,h:600,largeW:1280,largeH:700}]){
  const p=await b.newPage({viewport:{width:s.w,height:s.largeH}});
  const render=async(source,vars='')=>{await p.setContent(`<style>html,body{margin:0;width:${s.w}px;height:${s.h}px}body{display:flex;align-items:center;justify-content:center}:root{${vars}}${resolve(source,s)}</style><div id="app"><div id="cmap"></div><div id="stageModal"><div class="pm"></div></div><div id="menuPanel"></div><div id="skyIslandBody"><div class="islemap"></div></div></div>`);return p.evaluate(()=>{const e=id=>document.getElementById(id),g=x=>getComputedStyle(x),r=e('app').getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width,stageMax:parseFloat(g(document.querySelector('#stageModal .pm')).maxHeight),menuMax:parseFloat(g(e('menuPanel')).maxHeight),campaignWidth:parseFloat(g(e('cmap')).width),isleWidth:parseFloat(g(document.querySelector('.islemap')).width),isleParent:e('skyIslandBody').clientWidth}})};
  const current=await render(css),old=await render(css.replace(/100dvh/g,'100vh').replace(/100dvw/g,'100vw'));
  check(`${s.w}x${s.h} address-bar control catches old clipping`,old.top<-.5||old.bottom>s.h+.5);
  check(`${s.w}x${s.h} stage stays within visible viewport`,current.top>=-.5&&current.bottom<=s.h+.5);
  check(`${s.w}x${s.h} stage popup uses dynamic height`,Math.abs(current.stageMax-(s.h-12))<.1);
  check(`${s.w}x${s.h} menu uses dynamic height`,Math.abs(current.menuMax-(s.h-150))<.1);
  check(`${s.w}x${s.h} campaign map uses dynamic height`,Math.abs(current.campaignWidth-Math.max(720,Math.min(s.largeW,s.h*1.5)))<.1);
  check(`${s.w}x${s.h} island map uses dynamic height`,Math.abs(current.isleWidth-Math.max(current.isleParent,s.h*1692/930))<.1);
  const variables='--ew-game-width:882px;--ew-game-height:344px;',rot=await render(css,variables),control=await render(css.replace(/100dvh/g,'100vh').replace(/100dvw/g,'100vw'),variables);
  check(`${s.w}x${s.h} rotation variables override both fallback families`,JSON.stringify(rot)===JSON.stringify(control));
  const innerRule=(html.match(/body\.ew-inner \.smStageScroll\{[^}]*\}/)||[])[0];
  if(innerRule){await p.addStyleTag({content:resolve(innerRule,s)});const max=await p.evaluate(()=>{document.body.classList.add('ew-inner');const e=document.createElement('div');e.className='smStageScroll';document.body.append(e);return parseFloat(getComputedStyle(e).maxHeight)});check(`${s.w}x${s.h} inner scroll uses dynamic height`,Math.abs(max-(s.h-150))<.1)}
  await p.close();
 }
}finally{await b.close()}console.log('PASS '+checks+' dynamic viewport checks')})().catch(e=>{console.error(e);process.exitCode=1});
