"use strict";
// v1434 (Phil 23 Nov 2026, the $1 test pack: "You did this as a 1 time offer I cant buy it" - Play: "You already own this item").
// A paid Play purchase the game never booked stays OWNED in Play: it cannot be bought again and the diamonds never arrive.
// The client now asks Play what is still owned (listPurchases) when the store is ready, after a sign-in and on every return to the
// app, and hands each token to the SAME server route, which verifies it, credits it once and then consumes it.
// This test runs the real client module against the real /api/shop/buy route with an offline Google transport.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const {createPlayBilling,recordToken,usedToken,tokenHash}=require('../server/play-billing');
const source=fs.readFileSync(require.resolve('../server.js'),'utf8'), html=fs.readFileSync(require.resolve('../emberweave-heroes.html'),'utf8');
const _EN=JSON.parse(fs.readFileSync(path.join(__dirname,'..','lang','en.json'),'utf8')), _t=(k,v)=>(_EN[k]==null?k:_EN[k]).replace(/\{(\w+)\}/g,(m,x)=>v&&v[x]!=null?String(v[x]):'');
let P=0,F=0; const ck=(n,c,x)=>{ if(c){P++;console.log('  ok   '+n);} else {F++;console.log('  FAIL '+n+(x!==undefined?' - '+JSON.stringify(x):''));} };
// ---- server side: the real purchase route, Google faked ----
const route=source.slice(source.indexOf("  if((p==='/api/shop/purchase'||p==='/api/shop/buy')"),source.indexOf("  if(p==='/api/shop/plan-claim'"));
const private_key=crypto.generateKeyPairSync('rsa',{modulusLength:1024}).privateKey.export({format:'pem',type:'pkcs8'});
const consumedTokens=new Set(); let googleDown=false, pendingTokens=new Set();
const billing=createPlayBilling({env:{GOOGLE_PLAY_SA_KEY:'test-only'},readKey:()=>JSON.stringify({client_email:'t@example.invalid',private_key}),fetchImpl:async(url)=>{
  if(url==='https://oauth2.googleapis.com/token') return {ok:true,json:async()=>({access_token:'stub',expires_in:3600})};
  if(googleDown) throw Error('offline');
  const tok=decodeURIComponent(url.split('/tokens/')[1].split(':')[0]);
  if(url.endsWith(':consume')){ consumedTokens.add(tok); return {ok:true}; }
  return {ok:true,json:async()=>({purchaseState:pendingTokens.has(tok)?2:0,consumptionState:consumedTokens.has(tok)?1:0,orderId:'GPA.'+tok,quantity:1})};
}});
const users={a:{id:'a',led:{gems:0}},b:{id:'b',led:{gems:0}}};
const offers={testpack:{id:'testpack',kind:'gems',amount:10,usd:1,real:true,name:'TEST PACK'},d500:{id:'d500',kind:'gems',amount:600,usd:4.99,name:'600'}};
const ctx={DB:{users},PLAY_TOKENS:{recordToken,usedToken,tokenHash},PLAY_BILLING:billing,FREE_PACKS:true,isDev:()=>false,process:{env:{}},_reqCtx:{getStore:()=>null},
  ECON_CAP:{gems:1e12},SHOP_OFFER_BY_ID:offers,body:async req=>req.input,send:(_r,status,value)=>({status,value}),
  ensureLedger:me=>me.led,shopPlans:led=>led.plans||(led.plans={gems:{daysLeft:0},stamina:{daysLeft:0}}),
  creditGems:(me,led,n)=>{led.gems+=n;return n;},patronState:()=>{},patronCreditPurchase:()=>0,ledTx:()=>{},writeDB:()=>{},plansView:led=>led.plans||{},ledgerView:me=>({gems:me.led.gems}),
  durableCommit:(me,key,fn)=>{const draft=structuredClone(me),result=fn(draft);if(result.ok){Object.assign(me,draft);}return result;}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('async function verifyPurchase('),source.indexOf('/* ==================== CAMPAIGN')),ctx);
const run=vm.runInContext('(async function(p,req,res,me){'+route+'return {fallthrough:true};})',ctx);
// ---- client side: the real playBilling module ----
const clientSrc=html.slice(html.indexOf('const playBilling=(()=>{'),html.indexOf('async function grantGemOffer'));
let owned=[], banners=[], adopts=0, posts=0, listCalls=0, visHandler=null; const who={user:'a'};
const client={t:_t,ewT:_t,langMsg:s=>s,window:{},ACC:{token:'tok-a'},GEM_OFFERS:[offers.d500,offers.testpack],uid8:()=>'rq'+Math.random().toString(36).slice(2,8),
  shopSrv:()=>({playBilling:false,playBillingReal:true}),adoptLedger:()=>adopts++,saveG:()=>{},updateHubChrome:()=>{},bannerMsg:m=>banners.push(m),setTimeout:(f)=>f(),
  document:{visibilityState:'visible',addEventListener:(ev,f)=>{ if(ev==='visibilitychange') visHandler=f; }},
  api:async(p,m,b)=>{ posts++; const r=await run(p,{method:m,input:b},{},users[who.user]); return r.value; }};
client.window.getDigitalGoodsService=async()=>({listPurchases:async()=>{ listCalls++; return owned.map(o=>Object.assign({},o)); }});
vm.createContext(client);
const tick=()=>new Promise(r=>setTimeout(r,5));
(async()=>{
  // Phil's case: a paid test pack Play still owns, never booked by any server.
  owned=[{itemId:'testpack',purchaseToken:'phil-paid'}];
  vm.runInContext(clientSrc+';globalThis.billing=playBilling;',client); await tick(); await tick();
  ck('when the store is ready, an owned purchase the game never booked is booked: +10 diamonds', users.a.led.gems===10, users.a.led);
  ck('...and Google is told to CONSUME it, so the pack can be bought again', consumedTokens.has('phil-paid'));
  ck('...the ledger is adopted and the player is told ("'+(banners[0]||'')+'")', adopts===1 && banners.length===1 && /TEST PACK/.test(banners[0]));
  // Play still lists it (Play updates late): asking again never credits twice and costs no server call this session.
  let n=posts; await client.billing.recover(); await tick();
  ck('a second check never books it twice, and does not ask the server again', users.a.led.gems===10 && posts===n);
  // Booked before but never consumed (the old consume failed): the server consumes it, credits nothing.
  const h=tokenHash('booked-not-consumed'); users.a.led.playTokens[h]={sku:'d500',ref:'x',t:1}; const g0=users.a.led.gems;
  owned=[{itemId:'d500',purchaseToken:'booked-not-consumed'}]; await client.billing.recover(); await tick();
  ck('a purchase this account already booked is consumed now, with no second credit', consumedTokens.has('booked-not-consumed') && users.a.led.gems===g0);
  // Another account's token: never credited here.
  users.b.led.playTokens={[tokenHash('b-token')]:{sku:'d500',ref:'y',t:1}}; owned=[{itemId:'d500',purchaseToken:'b-token'}]; await client.billing.recover(); await tick();
  ck('another account\'s purchase is never credited to this one', users.a.led.gems===g0 && !consumedTokens.has('b-token'));
  // Google down: nothing credited, asked again on the next return to the app.
  googleDown=true; owned=[{itemId:'testpack',purchaseToken:'later'}]; await client.billing.recover(); await tick();
  ck('Google unreachable: nothing booked, nothing consumed', users.a.led.gems===g0 && !consumedTokens.has('later'));
  googleDown=false; n=listCalls; visHandler && visHandler(); await tick(); await tick();
  ck('returning to the app asks Play again and books it then (+10)', listCalls>n && users.a.led.gems===g0+10 && consumedTokens.has('later'), {gems:users.a.led.gems,g0});
  // A pending payment (cash / slow card) is not booked until Google says it is paid.
  pendingTokens.add('slow-card'); owned=[{itemId:'testpack',purchaseToken:'slow-card'}]; await client.billing.recover(); await tick();
  ck('a payment still pending is not booked', users.a.led.gems===g0+10 && !consumedTokens.has('slow-card'));
  pendingTokens.delete('slow-card'); await client.billing.recover(); await tick();
  ck('...and is booked once Google says it is paid', users.a.led.gems===g0+20 && consumedTokens.has('slow-card'));
  // Pre-beta (free packs on, as live today): only the real $1 test pack is booked; a diamond pack waits in Play, untouched, until launch.
  const g1=users.a.led.gems; owned=[{itemId:'d500',purchaseToken:'prebeta-d500'}]; await client.billing.recover(); await tick();
  ck('free-pack mode: a paid diamond pack is not booked or consumed (it waits for launch)', users.a.led.gems===g1 && !consumedTokens.has('prebeta-d500'));
  ctx.FREE_PACKS=false; await client.billing.recover(); await tick();
  ck('...and is booked once free packs are switched off (+600)', users.a.led.gems===g1+600 && consumedTokens.has('prebeta-d500')); ctx.FREE_PACKS=true;
  // Unknown products and a signed-out player are left alone.
  n=posts; owned=[{itemId:'not_ours',purchaseToken:'zz'}]; await client.billing.recover();
  client.ACC.token=''; owned=[{itemId:'d500',purchaseToken:'signed-out'}]; await client.billing.recover(); client.ACC.token='tok-a';
  ck('unknown products and signed-out players send nothing', posts===n);
  // Wiring in the page.
  ck('the sign-in path asks Play too', html.includes("try{ playBilling.recover(); }catch(e){}   /* v1434"));
  ck('the module exports recover', /return \{available:\(\)=>!!service,buy,recover\};/.test(html));
  console.log('test_play_recover_1434.js: '+P+' passed, '+F+' failed'); process.exitCode=F?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
