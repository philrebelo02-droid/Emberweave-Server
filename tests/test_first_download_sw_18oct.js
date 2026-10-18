'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('deploy activation keeps downloaded art; a versioned asset is served offline without another request',async()=>{
 const listeners={},asset=new Map([['https://game.test/assets/example.webp?v=kept',new Response('saved-art')]]),names=new Set(['ember-shell-old','ember-assets-v1']);let network=0;
 const sandbox={URL,Request,Response,location:{origin:'https://game.test'},self:{clients:{claim:async()=>{}},addEventListener:(k,fn)=>{listeners[k]=fn;}},caches:{keys:async()=>[...names],delete:async k=>names.delete(k),open:async name=>({match:async req=>asset.get(typeof req==='string'?req:req.url),put:async(req,res)=>asset.set(typeof req==='string'?req:req.url,res)})},fetch:async()=>{network++;throw Error('offline');}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8').replace(/const BUILD='[^']+'/,"const BUILD='a-new-deploy'"),sandbox);
 let activation;listeners.activate({waitUntil:p=>{activation=p;}});await activation;
 assert.ok(names.has('ember-assets-v1'));assert.ok(!names.has('ember-shell-old'));
 let response;listeners.fetch({request:new Request('https://game.test/assets/example.webp?v=kept'),respondWith:p=>{response=p;},waitUntil:()=>{}});
 assert.equal(await (await response).text(),'saved-art');assert.equal(network,0);
});
test('an endless asset trickle cannot re-arm the battle loading screen forever, even when warm-up hangs',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../emberweave-heroes.html'),'utf8');const code=html.slice(html.indexOf('function preloadBattleArtFull('),html.indexOf('/* v306: loading-card',html.indexOf('function preloadBattleArtFull(')));
 // Extract this one function through the next known section marker.
 const end=code.indexOf('\n}\n')>=0?code.indexOf('\n}\n')+2:code.indexOf('\r\n}\r\n')+3;
 const fn=code.slice(0,end);assert.ok(fn.includes('deadline=setTimeout(finish'));
 let now=0,id=0,tick=null;const timers=new Map();const ctx={Promise,Set,Map,Math,isFinite,window:{},_LOADQ:{n:0,done:0},_artWarmed:{},HERO_SPRITES:{},battleUiArt(){},battleCodeWarm(){},gpuWarmKeys:()=>new Promise(()=>{}),fxWarmKeys:()=>new Promise(()=>{}),fxSheetKeys:()=>[],_lqOnDone:f=>{tick=f;return()=>{tick=null;}},heroHasAnim:()=>true,loadAnimSet:()=>{ctx._LOADQ.n+=10;},CUR:{mode:'campaign'},setTimeout:(fn,ms)=>{const n=++id;timers.set(n,{fn,t:now+ms});return n;},clearTimeout:n=>timers.delete(n)};
 vm.createContext(ctx);vm.runInContext(fn,ctx);let resolved=false;ctx.preloadBattleArtFull(['vael'],null,()=>{},12000).then(()=>{resolved=true;});
 for(now=1000;now<=21000;now+=1000){if(tick&&now%4000===0){ctx._LOADQ.done++;tick(ctx._LOADQ.done,ctx._LOADQ.n);}for(const [key,row] of [...timers])if(row.t<=now){timers.delete(key);row.fn();}await Promise.resolve();await Promise.resolve();}
 assert.equal(resolved,true);assert.equal(tick,null);
});
