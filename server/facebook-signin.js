"use strict";
/* v1271 FACEBOOK LOGIN (Phil 4 Nov 2026: "Can you make a Facebook link and log in also"). Built the same way as server/google-signin.js.
   The client gets a Facebook user access token from the Facebook JS SDK (FB.login) and sends it here. The server never trusts the
   client's word for who that is: it asks the Graph API debug_token endpoint with the APP access token (app id | app secret) whether the
   token is valid and was issued to OUR app, takes the user id from Facebook's answer, then reads /me with appsecret_proof (HMAC-SHA256 of
   the token keyed with the app secret) and requires the same id. Any error, timeout, non-200 or odd value fails closed.
   FACEBOOK_APP_ID + FACEBOOK_APP_SECRET come from the environment only (never the repo, never logged, never sent to a client).
   The HTTP transport (fetchImpl) is injectable so tests/test_facebook_signin.js runs offline. */
const crypto=require('node:crypto');
const GRAPH='https://graph.facebook.com/v21.0';
const pubErr=m=>{const e=Error(m);e.code='FB_PUBLIC';return e;};   // safe to show the player (conflicts, caps); everything else is generic
const appSecretProof=(token,secret)=>crypto.createHmac('sha256',String(secret)).update(String(token)).digest('hex');
const clip=(v,n)=>typeof v==='string'?v.slice(0,n):'';
function createFacebookVerifier({fetchImpl=globalThis.fetch,appId=()=>process.env.FACEBOOK_APP_ID,appSecret=()=>process.env.FACEBOOK_APP_SECRET,timeoutMs=10000}={}){
  const getJson=async url=>{
    let r;try{r=await fetchImpl(url,{signal:AbortSignal.timeout(timeoutMs)});}catch(_){throw Error('Facebook verification unavailable.');}
    if(!r||!r.ok)throw Error('Facebook verification unavailable.');
    try{return await r.json();}catch(_){throw Error('Facebook verification unavailable.');}
  };
  return async token=>{
    const id=String(appId()||''),secret=String(appSecret()||'');
    if(!id||!secret)throw Error('Facebook sign-in is not configured.');
    if(typeof token!=='string'||!token||token.length>4096||!/^[A-Za-z0-9._|-]+$/.test(token))throw Error('Invalid Facebook token.');
    const dbg=await getJson(GRAPH+'/debug_token?input_token='+encodeURIComponent(token)+'&access_token='+encodeURIComponent(id+'|'+secret));
    const d=dbg&&dbg.data;
    if(!d||typeof d!=='object'||d.is_valid!==true||String(d.app_id)!==id)throw Error('Invalid Facebook token.');
    if(d.type!=null&&d.type!=='USER')throw Error('Invalid Facebook token.');
    const exp=+d.expires_at||0;if(exp&&exp*1000<=Date.now())throw Error('Invalid Facebook token.');   // 0 = no expiry
    const userId=String(d.user_id==null?'':d.user_id);if(!/^\d{1,32}$/.test(userId))throw Error('Invalid Facebook token.');
    const me=await getJson(GRAPH+'/me?fields=id,name,email&access_token='+encodeURIComponent(token)+'&appsecret_proof='+appSecretProof(token,secret));
    if(!me||String(me.id)!==userId)throw Error('Invalid Facebook token.');
    return {id:userId,name:clip(me.name,80),email:clip(me.email,320)};
  };
}
/* Meta's data-deletion callback: signed_request = base64url(HMAC-SHA256(payloadPart, appSecret)) + '.' + payloadPart.
   Returns the payload (with a numeric-string user_id) or throws. */
function parseSignedRequest(signed,secret){
  if(!secret)throw Error('Facebook is not configured.');
  if(typeof signed!=='string'||signed.length>8192)throw Error('Bad signed request.');
  const parts=signed.split('.');if(parts.length!==2||!parts[0]||!parts[1])throw Error('Bad signed request.');
  const sig=Buffer.from(parts[0],'base64url'),want=crypto.createHmac('sha256',String(secret)).update(parts[1]).digest();
  if(sig.length!==want.length||!crypto.timingSafeEqual(sig,want))throw Error('Bad signed request.');
  let p;try{p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch(_){throw Error('Bad signed request.');}
  if(!p||String(p.algorithm||'').toUpperCase()!=='HMAC-SHA256')throw Error('Bad signed request.');
  const userId=String(p.user_id==null?'':p.user_id);if(!/^\d{1,32}$/.test(userId))throw Error('Bad signed request.');
  return {...p,user_id:userId};
}
// Caller supplies only verified claims and the current server-authenticated account, never a client user ID.
function resolveAccount({users,claims,current,create,isBanned=()=>false,now=Date.now()}){
  const matches=Object.values(users).filter(u=>u&&!u.isNpc&&u.facebook?.id===claims.id);
  if(matches.length>1)throw pubErr('This Facebook account needs support review.');
  let u=matches[0];
  if(current&&!current.guest&&u&&u.id!==current.id)throw pubErr('This Facebook account is linked to another commander.');
  if(current?.facebook&&current.facebook.id!==claims.id&&!current.guest)throw pubErr('A different Facebook account is already linked.');
  u=u||current||null;
  if(u&&isBanned(u))throw pubErr('This account cannot sign in.');
  const created=!u;if(!u)u=create(claims.id);
  if(!u.login)u.login=u.name;   // freeze the pre-existing username before a guest upgrade
  if(u.guest)u.facebookOnly=true;   // guests have no password; linking must not let them unlink their only login
  const fb={id:claims.id,linkedAt:(u.facebook&&u.facebook.id===claims.id&&u.facebook.linkedAt)||now};
  if(claims.name)fb.name=claims.name;if(claims.email)fb.email=claims.email;   // display-only; never a password-reset identity
  u.facebook=fb;delete u.guest;
  return {u,created};
}
/* Meta deletion request: remove every stored Facebook field for that Facebook user id. The game account itself stays (its owner can still
   delete it in Settings); returns the ids touched. */
function eraseFacebookData(users,fbId){
  const touched=[];
  for(const u of Object.values(users)){if(u&&!u.isNpc&&u.facebook&&u.facebook.id===String(fbId)){delete u.facebook;touched.push(u.id);}}
  return touched;
}
module.exports={pubErr,createFacebookVerifier,resolveAccount,parseSignedRequest,eraseFacebookData,appSecretProof,GRAPH};
