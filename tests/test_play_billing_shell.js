"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {createPlayBilling,recordToken,usedToken}=require('../server/play-billing');
const source=fs.readFileSync(require.resolve('../server.js'),'utf8');
const html=fs.readFileSync(require.resolve('../emberweave-heroes.html'),'utf8');
const route=source.slice(source.indexOf("  if((p==='/api/shop/purchase'||p==='/api/shop/buy')"),source.indexOf("  if(p==='/api/shop/plan-claim'"));
const private_key=crypto.generateKeyPairSync('rsa',{modulusLength:1024}).privateKey.export({format:'pem',type:'pkcs8'});
let state=0,consumed=0,failConsume=false,quantity=1,failSave=false,receiptExtra={},googleReject=false;
const calls=[];
const billing=createPlayBilling({env:{GOOGLE_PLAY_SA_KEY:'test-only'},readKey:()=>JSON.stringify({client_email:'test@example.invalid',private_key}),fetchImpl:async(url,opts)=>{
  calls.push({url,opts});
  if(url==='https://oauth2.googleapis.com/token')return {ok:true,json:async()=>({access_token:'stub',expires_in:3600})};
  if(url.endsWith(':consume')){if(failConsume)throw Error('offline');consumed++;return {ok:true};}
  if(googleReject)return {ok:false,status:404};
  return {ok:true,json:async()=>({purchaseState:state,consumptionState:0,orderId:'order-test',quantity,...receiptExtra})};
}});
const users={a:{id:'a',led:{gems:0}},b:{id:'b',led:{gems:0}}};
const offers={d500:{id:'d500',kind:'gems',amount:600,usd:4.99},cluster:{id:'cluster',kind:'plan',plan:'gems',days:14,usd:4.99},burger:{id:'burger',kind:'plan',plan:'stamina',days:30,usd:2.99}};
let verifier=billing;
const pending={waits:new Set()};
const ctx={DB:{users},PLAY_TOKENS:{recordToken,usedToken,tokenHash:require('../server/play-billing').tokenHash},PLAY_BILLING:{verify:(...a)=>verifier.verify(...a),settle:(...a)=>billing.settle(...a)},FREE_PACKS:false,isDev:()=>false,process:{env:{}},_reqCtx:{getStore:()=>pending},_inflight:[],_batchOpen:null,
  SHOP_OFFER_BY_ID:offers,body:async req=>req.input,send:(_r,status,value)=>({status,value}),
  ensureLedger:me=>me.led,shopPlans:led=>led.plans||(led.plans={gems:{daysLeft:0},stamina:{daysLeft:0}}),
  creditGems:(me,led,n)=>{led.gems+=n;return n;},patronState:()=>{},patronCreditPurchase:()=>0,ledTx:()=>{},writeDB:()=>{},plansView:led=>led.plans||{},ledgerView:me=>({gems:me.led.gems}),
  durableCommit:(me,key,fn)=>{const draft=structuredClone(me),result=fn(draft);if(result.ok&&!failSave){Object.assign(me,draft);return result;}return failSave?{ok:false,storageFailed:true}:result;}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('async function verifyPurchase('),source.indexOf('/* ==================== CAMPAIGN')),ctx);
const run=vm.runInContext('(async function(p,req,res,me){'+route+'return {fallthrough:true,body:req._shopBody};})',ctx);
let rid=0;
const buy=(token,user='a',sku='d500')=>run('/api/shop/buy',{method:'POST',input:{provider:'play',sku,purchaseToken:token,requestId:'r'+(++rid)}},{},users[user]);
(async()=>{
  ctx.FREE_PACKS=true;let n=calls.length,r=await buy('free-mode-paid');assert.equal(r.status,403);assert.equal(calls.length,n);assert.equal(consumed,0);assert.equal(users.a.led.gems,0);ctx.FREE_PACKS=false;
  r=await buy('valid');assert.equal(r.value.ok,true);assert.equal(users.a.led.gems,600);assert.equal(consumed,1);
  assert.equal(Object.keys(users.a.led.playTokens).length,1);assert(!JSON.stringify(users.a.led).includes('"valid"'));
  r=await buy('valid');assert.equal(r.status,403);assert.equal(users.a.led.gems,600);
  r=await buy('valid','b');assert.equal(r.status,403);assert.equal(users.b.led.gems,0);
  for(state of [1,2]){const n=consumed;r=await buy('state'+state);assert.equal(r.status,403);assert.equal(consumed,n);}
  state=0;quantity=2;r=await buy('multi');assert.equal(r.status,403);quantity=1;
  for(const extra of [{consumptionState:1},{consumptionState:undefined},{consumptionState:2},{productId:'other-product'},{purchaseToken:'other-token'},{refundableQuantity:0}]){
    receiptExtra=extra;const before=users.a.led.gems,n=consumed;r=await buy('bad-fields-'+JSON.stringify(extra));assert.equal(r.status,403);assert.equal(users.a.led.gems,before);assert.equal(consumed,n);
  }receiptExtra={};
  googleReject=true;r=await buy('wrong-app-or-product');assert.equal(r.status,403);googleReject=false;
  r=await run('/api/shop/buy',{method:'POST',input:{provider:'play',sku:'unknown',purchaseToken:'valid',requestId:'bad-sku'}},{},users.a);assert.equal(r.status,400);
  verifier=createPlayBilling({env:{}});r=await buy('no-key');assert.match(r.value.error,/coming soon/);verifier=billing;
  verifier=createPlayBilling({env:{GOOGLE_PLAY_SA_KEY:'missing'},readKey:()=>{throw Error('missing');}});r=await buy('bad-key');assert.equal(r.status,403);verifier=billing;
  const before=users.a.led.gems,settled=consumed;failSave=true;r=await buy('rollback');assert.equal(r.status,503);assert.equal(users.a.led.gems,before);assert.equal(consumed,settled);failSave=false;
  r=await buy('rollback');assert.equal(r.value.ok,true);assert.equal(users.a.led.gems,before+600);
  r=await buy('plan-a','a','cluster');assert.equal(r.value.granted.planDays,14);assert.equal(users.a.led.plans.gems.daysLeft,14);
  r=await buy('plan-b','a','burger');assert.equal(users.a.led.plans.stamina.daysLeft,30);
  failConsume=true;r=await buy('settle-retry');assert.equal(r.value.ok,true);assert.equal(r.value.settlementPending,true);const after=users.a.led.gems;
  failConsume=false;r=await buy('settle-retry');assert.equal(r.status,403);assert.equal(users.a.led.gems,after);
  const race=await Promise.all([buy('race','a'),buy('race','b')]);assert.equal(race.filter(r=>r.value.ok).length,1);
  const same=await Promise.all([buy('same-race'),buy('same-race')]);assert.equal(same.filter(r=>r.value.ok).length,1);
  // Real route and save barrier: a credit visible in memory is not yet durable.
  for(const saveOk of [false,true]){
    const snapshot=structuredClone(users.a),settled=consumed;let release;
    const disk=new Promise(resolve=>{release=resolve;});pending.waits.add(disk);ctx._batchOpen={promise:disk};
    const token='delayed-'+saveOk,purchase=buy(token);await new Promise(r=>setImmediate(r));
    assert.equal(consumed,settled);const replay=buy(token);await new Promise(r=>setImmediate(r));assert.equal(consumed,settled);
    if(!saveOk){for(const k of Object.keys(users.a))delete users.a[k];Object.assign(users.a,snapshot);}
    release(saveOk);const results=await Promise.all([purchase,replay]);pending.waits.clear();ctx._batchOpen=null;
    if(!saveOk){assert.equal(results[0].status,503);assert.equal(results[1].status,503);assert.equal(consumed,settled);assert.equal(users.a.led.gems,snapshot.led.gems);}
    else{assert.equal(results[0].value.ok,true);assert.equal(results[1].status,403);assert.equal(users.a.led.gems,snapshot.led.gems+600);}
  }
  // A replay has no request-local waits, but must wait for another request's IO.
  let finishDisk;const disk=new Promise(resolve=>{finishDisk=resolve;});ctx._inflight=[{promise:disk}];const settledBefore=consumed;
  const replay=buy('valid');await new Promise(r=>setImmediate(r));assert.equal(consumed,settledBefore);finishDisk(false);assert.equal((await replay).status,503);ctx._inflight=[];
  r=await run('/api/shop/buy',{method:'POST',input:{what:'gold',requestId:'gold'}},{},users.a);assert.equal(r.fallthrough,true);assert.equal(r.body.what,'gold');
  r=await run('/api/shop/purchase',{method:'POST',input:{offerId:'d500',provider:'prebeta',requestId:'no-free'}},{},users.a);assert.equal(r.status,403);
  ctx.FREE_PACKS=true;r=await run('/api/shop/purchase',{method:'POST',input:{offerId:'d500',provider:'prebeta',requestId:'free'}},{},users.a);assert.equal(r.value.ok,true);ctx.FREE_PACKS=false;
  assert(calls.some(c=>c.url.includes('/applications/com.emberweave.heroes/purchases/products/d500/tokens/')));
  const module=html.slice(html.indexOf('const playBilling=(()=>{'),html.indexOf('async function grantGemOffer'));
  let paidCalls=0,ledgerAdopts=0;const sent=[];
  const client={window:{},shopSrv:()=>({playBilling:true}),ACC:{token:'signed-in'},GEM_OFFERS:[offers.d500],api:async(...args)=>{sent.push(args);return {ok:true,ledger:{gems:600}};},uid8:()=> 'client-request',adoptLedger:()=>ledgerAdopts++,saveG:()=>{},updateHubChrome:()=>{},bannerMsg:()=>{}};
  vm.createContext(client);vm.runInContext(module+';globalThis.billing=playBilling;',client);assert.equal(client.billing.available(),false);await client.billing.buy(offers.d500);assert.equal(sent.length,0);
  client.window.getDigitalGoodsService=async method=>{assert.equal(method,'https://play.google.com/billing');return {};};
  client.PaymentRequest=class {constructor(methods){assert.equal(methods[0].data.sku,'d500');paidCalls++;}async show(){return {details:{purchaseToken:'paid'},complete:async status=>assert.equal(status,'success')};}};
  vm.runInContext(module.replace('const playBilling','const secondBilling')+';globalThis.billing=secondBilling;',client);await new Promise(r=>setImmediate(r));await client.billing.buy(offers.d500);
  assert.equal(paidCalls,1);assert.equal(sent[0][0],'/api/shop/buy');assert.equal(sent[0][2].provider,'play');assert.equal(sent[0][2].purchaseToken,'paid');assert.equal(ledgerAdopts,1);
  assert(html.includes('if(!freePacksOn()&&playBilling.available())'));assert(source.includes("const FREE_PACKS = true && process.env.SHOP_FREE_PACKS!=='0'"));
  console.log('Play billing shell: offline Google transport, real route dispatch, replay/race, durable-failure, states, plans, consume retry, browser and TWA checks PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
