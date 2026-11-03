"use strict";
const crypto=require('node:crypto');
function validateClaims(p,clientId,nonce,now=Date.now()){
  if(!clientId||p.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(p.iss)||
    !Number.isFinite(p.exp)||p.exp*1000<=now||!Number.isFinite(p.iat)||p.iat*1000>now+60000||
    typeof p.sub!=='string'||!p.sub||p.sub.length>255||!nonce||p.nonce!==nonce) throw Error('Invalid Google credential.');
  return {sub:p.sub,email:p.email_verified===true&&typeof p.email==='string'?p.email.slice(0,320):''};
}
function createGoogleVerifier({fetchImpl=globalThis.fetch,clientId=()=>process.env.GOOGLE_OAUTH_CLIENT_ID,verifySignature}={}){
  let keys=[],until=0;
  return async(credential,nonce)=>{
    if(typeof credential!=='string'||credential.length>16000) throw Error('Invalid Google credential.');
    if(verifySignature) return validateClaims(await verifySignature(credential),clientId(),nonce);
    const parts=credential.split('.'); if(parts.length!==3) throw Error('Invalid Google credential.');
    const h=JSON.parse(Buffer.from(parts[0],'base64url')),p=JSON.parse(Buffer.from(parts[1],'base64url'));
    if(h.alg!=='RS256'||typeof h.kid!=='string') throw Error('Invalid Google signature.');
    if(Date.now()>until||!keys.some(k=>k.kid===h.kid)){
      const r=await fetchImpl('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000)});
      if(!r.ok) throw Error('Google verification unavailable.');
      keys=(await r.json()).keys||[]; until=Date.now()+300000;
    }
    const jwk=keys.find(k=>k.kid===h.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
    if(!jwk||!crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),crypto.createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))
      throw Error('Invalid Google signature.');
    return validateClaims(p,clientId(),nonce);
  };
}
// Caller supplies only verified claims and the current server-authenticated account, never a client user ID.
function resolveAccount({users,claims,current,create,isBanned=()=>false}){
  const matches=Object.values(users).filter(u=>!u.isNpc&&u.google?.sub===claims.sub);
  if(matches.length>1) throw Error('Google account needs support review.');
  let u=matches[0];
  if(current&&!current.guest&&u&&u.id!==current.id) throw Error('This Google account is linked to another commander.');
  if(current?.google&&current.google.sub!==claims.sub&&!current.guest) throw Error('A different Google account is already linked.');
  u=u||current||null;
  if(u&&isBanned(u)) throw Error('This account cannot sign in.');
  const created=!u;if(!u) u=create(claims.sub);
  if(!u.login)u.login=u.name; // Freeze the pre-existing username before a guest upgrade.
  if(u.guest)u.googleOnly=true; // Guests have no password; linking must not enable unlinking their only login.
  u.google={sub:claims.sub,email:claims.email}; // Display-only email; never a password-reset identity.
  delete u.guest;
  return {u,created};
}
module.exports={createGoogleVerifier,resolveAccount,validateClaims};
