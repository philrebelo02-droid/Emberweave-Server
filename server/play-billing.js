"use strict";
const fs=require('node:fs'), crypto=require('node:crypto');
const PACKAGE='com.emberweave.heroes', SOON='Diamond packs are coming soon.';
const tokenHash=token=>crypto.createHash('sha256').update(token).digest('hex');
// Transport injection is for offline tests; production endpoints are fixed, never client supplied.
function createPlayBilling({env=process.env,fetchImpl=globalThis.fetch,readKey=p=>fs.readFileSync(p,'utf8')}={}){
  let access=null;
  async function call(sku,token,action){
    if(!access||access.until<Date.now()){
      const key=JSON.parse(readKey(env.GOOGLE_PLAY_SA_KEY)), now=Math.floor(Date.now()/1000);
      const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
      const data=enc({alg:'RS256',typ:'JWT'})+'.'+enc({iss:key.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
      const assertion=data+'.'+crypto.sign('RSA-SHA256',Buffer.from(data),key.private_key).toString('base64url');
      const r=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
      if(!r.ok) throw Error('Play authentication unavailable');
      const a=await r.json(); if(!a.access_token) throw Error('Play authentication unavailable');
      access={token:a.access_token,until:Date.now()+Math.max(0,Math.min(3600,Number(a.expires_in)||0)-60)*1000};
    }
    const url='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PACKAGE+'/purchases/products/'+encodeURIComponent(sku)+'/tokens/'+encodeURIComponent(token)+(action?':'+action:'');
    const r=await fetchImpl(url,{method:action?'POST':'GET',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+access.token,...(action?{'Content-Type':'application/json'}:{})},...(action?{body:'{}'}:{})});
    if(!r.ok){ if(r.status===401) access=null; throw Error('Play verification unavailable'); }
    return action?{}:r.json();
  }
  return {
    enabled:()=>!!env.GOOGLE_PLAY_SA_KEY,
    async verify(token,offer){
      if(!env.GOOGLE_PLAY_SA_KEY) return {ok:false,error:SOON};
      if(typeof token!=='string'||!token||token.length>4096||!offer?.id) return {ok:false,error:'Invalid purchase receipt.'};
      try{
        const p=await call(offer.id,token);
        if(p.purchaseState!==0||p.consumptionState!==0||typeof p.orderId!=='string'||!p.orderId|| (p.quantity!==undefined&&p.quantity!==1)||
          (p.productId!==undefined&&p.productId!==offer.id)||(p.purchaseToken!==undefined&&p.purchaseToken!==token)||
          (p.refundableQuantity!==undefined&&p.refundableQuantity!==1))
          return {ok:false,error:'Purchase is not an unconsumed completed order.'};
        return {ok:true,ref:p.orderId,tokenHash:tokenHash(token)};
      }catch(_){ return {ok:false,error:'Play verification unavailable. Please try again.'}; }
    },
    // All seven offers (including repeatable plan durations) are consumable one-time products.
    // Consume acknowledges too. Always AFTER the durable credit, never on a rejected purchase.
    async settle(token,sku){ await call(sku,token,'consume'); }
  };
}
function usedToken(users,hash){ return Object.values(users).some(u=>Object.hasOwn(u.led?.playTokens||{},hash)); }
function recordToken(users,led,v,sku){
  if(usedToken(users,v.tokenHash)) return false;
  if(!led.playTokens) led.playTokens={};
  led.playTokens[v.tokenHash]={sku,ref:v.ref,t:Date.now()}; // Permanent: unlike the capped purchase history.
  return true;
}
module.exports={createPlayBilling,recordToken,usedToken,tokenHash};
