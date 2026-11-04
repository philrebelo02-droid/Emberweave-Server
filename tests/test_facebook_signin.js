"use strict";
// v1271 FACEBOOK LOGIN - offline (stub Graph transport, no network, no game process). Covers: the verifier (debug_token with the app token,
// app_id, is_valid, user_id, expiry, /me with appsecret_proof, fail closed), the server routes run from server.js itself in a sandbox
// (config never leaks the secret, sign-in/create, link, conflicts with clear errors, guest upgrade, device cap, unlink code flow,
// facebook-only must set a password first), Meta's signed_request (good / tampered / wrong secret) and the data-deletion callback.
// CONTROL: the refusal checks are also run against a verifier that skips verification, and must report it. Asserts, exits non-zero.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const FB=require('../server/facebook-signin');
const APP_ID='1234567890',SECRET='test-app-secret-not-real',GRAPH='https://graph.facebook.com/v21.0';
let pass=0;const ok=(c,m)=>{assert(c,m);pass++;};
// Fake Graph API: token -> {debug data, me}. Records each URL it was asked for.
function graph(tokens,{fail}={}){
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(url);if(fail==='throw')throw Error('network down');if(fail==='500')return {ok:false,json:async()=>({})};
    const u=new URL(url);assert.equal(u.origin,'https://graph.facebook.com');
    if(u.pathname==='/v21.0/debug_token'){
      assert.equal(u.searchParams.get('access_token'),APP_ID+'|'+SECRET,'debug_token uses the app access token');
      const t=tokens[u.searchParams.get('input_token')];return {ok:true,json:async()=>({data:t?t.debug:{is_valid:false}})};
    }
    if(u.pathname==='/v21.0/me'){
      const tok=u.searchParams.get('access_token'),t=tokens[tok];
      assert.equal(u.searchParams.get('appsecret_proof'),crypto.createHmac('sha256',SECRET).update(tok).digest('hex'),'/me carries appsecret_proof');
      assert.equal(u.searchParams.get('fields'),'id,name,email');
      return t?{ok:true,json:async()=>t.me}:{ok:false,json:async()=>({})};
    }
    return {ok:false,json:async()=>({})};
  };
  return {calls,fetchImpl};
}
const future=Math.floor(Date.now()/1000)+3600;
const user=(id,extra={})=>({debug:{app_id:APP_ID,type:'USER',is_valid:true,user_id:id,expires_at:future,...extra},me:{id,name:'Player '+id,email:id+'@example.invalid'}});
const TOKENS={
  'good-token':user('1001'),'second-token':user('1002'),'third-token':user('1003'),'fourth-token':user('1004'),'guest-token':user('1005'),
  'other-app':user('1006',{app_id:'999'}),'invalid':user('1007',{is_valid:false}),'expired':user('1008',{expires_at:10}),
  'page-token':user('1009',{type:'PAGE'}),'no-user':user('',{}),
  'me-mismatch':{debug:user('1010').debug,me:{id:'2020',name:'Someone else'}},
};
const verifierFor=(g,env={id:APP_ID,secret:SECRET})=>FB.createFacebookVerifier({fetchImpl:g.fetchImpl,appId:()=>env.id,appSecret:()=>env.secret,timeoutMs:500});
// Every token a correct verifier must refuse; returns the ones that got through (the control feeds a broken verifier here).
async function refusalProblems(verify){
  const out=[];
  for(const t of ['other-app','invalid','expired','page-token','no-user','me-mismatch','unknown-token','bad token with spaces',''])
    try{await verify(t);out.push(t);}catch(_){}
  return out;
}
const keepAlive=setInterval(()=>{},1000);   // AbortSignal.timeout does not hold the event loop open by itself
(async()=>{
  // ---- 1. verifier ----
  { const g=graph(TOKENS),verify=verifierFor(g);
    const c=await verify('good-token');ok(c.id==='1001'&&c.name==='Player 1001'&&c.email==='1001@example.invalid','a valid token gives Facebook\'s id, name, email');
    ok(g.calls.length===2&&g.calls[0].startsWith(GRAPH+'/debug_token?')&&g.calls[1].startsWith(GRAPH+'/me?'),'debug_token first, then /me');
    const bad=await refusalProblems(verify);ok(bad.length===0,'every bad token is refused: '+bad.join(','));
    for(const f of ['throw','500'])await assert.rejects(verifierFor(graph(TOKENS,{fail:f}))('good-token'),'fails closed on '+f),pass++;
    await assert.rejects(verifierFor(g,{id:APP_ID,secret:''})('good-token'),/not configured/);pass++;
    await assert.rejects(verifierFor(g,{id:'',secret:SECRET})('good-token'),/not configured/);pass++;
    const hung=FB.createFacebookVerifier({fetchImpl:(url,o)=>new Promise((_,rej)=>o.signal.addEventListener('abort',()=>rej(Error('aborted')))),appId:()=>APP_ID,appSecret:()=>SECRET,timeoutMs:50});
    await assert.rejects(hung('good-token'),/unavailable/);pass++;   // a hung Graph call times out and refuses
  }
  // ---- CONTROL: a verifier that skips debug_token (trusts the token) must be caught by the same checks ----
  { const skipping=async t=>{if(!t)throw Error('empty');return {id:'1001',name:'',email:''};};
    const caught=await refusalProblems(skipping);ok(caught.length>=8,'CONTROL: a verifier that skips verification is caught ('+caught.length+' bad tokens let through)'); }
  // ---- 2. signed_request (Meta data deletion) ----
  const signed=(payload,secret=SECRET)=>{const p=Buffer.from(JSON.stringify(payload)).toString('base64url');return crypto.createHmac('sha256',secret).update(p).digest('base64url')+'.'+p;};
  { const good=signed({algorithm:'HMAC-SHA256',user_id:'1001',issued_at:Math.floor(Date.now()/1000)});
    ok(FB.parseSignedRequest(good,SECRET).user_id==='1001','a good signed_request verifies');
    const [sig,body]=good.split('.'),tampered=sig+'.'+Buffer.from(JSON.stringify({algorithm:'HMAC-SHA256',user_id:'1002'})).toString('base64url');
    assert.throws(()=>FB.parseSignedRequest(tampered,SECRET));pass++;
    assert.throws(()=>FB.parseSignedRequest(signed({algorithm:'HMAC-SHA256',user_id:'1001'},'wrong-secret'),SECRET));pass++;
    assert.throws(()=>FB.parseSignedRequest(signed({algorithm:'none',user_id:'1001'}),SECRET));pass++;
    assert.throws(()=>FB.parseSignedRequest(good,''));pass++;
    assert.throws(()=>FB.parseSignedRequest(body,SECRET));pass++; }
  // ---- 3. the routes, run from server.js in a sandbox ----
  const server=fs.readFileSync(require.resolve('../server.js'),'utf8'),html=fs.readFileSync(require.resolve('../emberweave-heroes.html'),'utf8');
  const cut=(a,b)=>{const i=server.indexOf(a),j=server.indexOf(b,i);assert(i>=0&&j>i,'slice '+a);return server.slice(i,j);};
  const users={},g=graph(TOKENS),env={};let saved=[];
  const c={DB:{users,byName:{},devices:{},ipAccounts:{}},FACEBOOK_AUTH:FB,facebookVerify:verifierFor(g),facebookNonces:new Map(),Date,URLSearchParams,crypto,console:{log(){}},
    process:{env},facebookOn:()=>!!(env.FACEBOOK_APP_ID&&env.FACEBOOK_APP_SECRET),rateLimited:()=>false,body:async req=>req.input||{},authUser:req=>req.current||null,
    send:(_res,status,value)=>({status,value}),ACCOUNT_AUTHORITY:false,isBanned:u=>!!u.banned,banResp:()=>({error:'banned'}),acctDelCancel:()=>{},dropTokens:()=>{},
    issueToken:id=>'session-'+id,saveSoon:ids=>{saved.push(...ids);return true;},clientIP:req=>req.ip||'test-network',usernameOf:u=>u.login,profileFor:u=>({id:u.id,login:u.login,name:u.name}),
    devKey:id=>id?'h:'+id:'',REG_ACCOUNTS_PER_IP:6,nameIdxPut:()=>{},loginIdxPut:()=>{},_dpk:()=>{},_dp:()=>{},uid:()=>crypto.randomBytes(6).toString('hex'),
    facebookNewUser:fbId=>{const u={id:'fb'+fbId,login:'f'+fbId,name:'f'+fbId,facebookOnly:true,hash:'random'};users[u.id]=u;return u;},
    loginId:name=>Object.values(users).find(u=>u.login&&u.login.toLowerCase()===String(name).toLowerCase())?.id,gen6:()=>'123456',
    hashPassAsync:async(code,salt)=>crypto.createHash('sha256').update(code+salt).digest('hex'),writeDB:()=>{},sendResetEmail:()=>{},credOk:()=>null,makeCredAsync:async()=>({salt:'s',hash:'h',iters:1})};
  vm.createContext(c);
  vm.runInContext(cut('async function facebookResolve(','async function verifyPurchase('),c);
  vm.runInContext(cut('const RESET_CODES_MAX=','// v947: one-time server-switch'),c);
  const run=vm.runInContext('(async function(p,req,res){'+cut("  if(p==='/api/auth/facebook/config'","  if(p==='/api/register'")+'})',c);
  const get=(current)=>run('/api/auth/facebook/config',{method:'GET',current},{setHeader(){}});
  const signIn=async(token,current,extra={})=>{const cfg=await get(current);return run('/api/auth/facebook',{method:'POST',current,input:{accessToken:token,nonce:cfg.value.nonce,deviceId:extra.device||'dev-'+token},ip:extra.ip},{setHeader(){}});};
  // OFF until both env vars are set; the secret never leaves
  ok((await get()).value.enabled===false,'config is {enabled:false} with no env');
  env.FACEBOOK_APP_ID=APP_ID;ok((await get()).value.enabled===false,'config stays off with only the app id');
  ok((await run('/api/auth/facebook',{method:'POST',input:{}},{})).status===503,'sign-in refused while off');
  env.FACEBOOK_APP_SECRET=SECRET;
  const cfg=await get();ok(cfg.value.enabled===true&&cfg.value.appId===APP_ID&&cfg.value.nonce,'config on: app id + nonce');
  ok(!JSON.stringify(cfg.value).includes(SECRET),'config never contains the app secret');
  // create, sign back in, nonce rules
  let r=await signIn('good-token');ok(r.status===200&&r.value.created===true&&r.value.token==='session-fb1001','a valid token creates a Facebook account');
  const fbUser=users.fb1001;ok(fbUser.facebook.id==='1001'&&fbUser.facebook.linkedAt>0&&fbUser.facebookOnly===true,'u.facebook={id,name,email,linkedAt}, facebook-only');
  ok(!JSON.stringify(fbUser).includes('good-token'),'the access token is never stored');
  r=await signIn('good-token');ok(r.status===200&&r.value.created===false&&r.value.profile.id==='fb1001','the same Facebook id signs back in to the same account');
  ok((await run('/api/auth/facebook',{method:'POST',input:{accessToken:'good-token',nonce:'made-up'}},{})).status===403,'an unknown nonce is refused');
  { const n=(await get()).value.nonce;await run('/api/auth/facebook',{method:'POST',input:{accessToken:'good-token',nonce:n}},{});
    ok((await run('/api/auth/facebook',{method:'POST',input:{accessToken:'good-token',nonce:n}},{})).status===403,'a nonce is single-use'); }
  for(const t of ['other-app','invalid','expired','me-mismatch']){const before=Object.keys(users).length;r=await signIn(t);
    ok(r.status===403&&Object.keys(users).length===before,t+' is refused and creates nothing');}
  // link to a password account, conflicts with clear errors
  const pw={id:'pw',login:'pw-user',name:'Password Commander',hash:'password',led:{gems:50}};users.pw=pw;
  r=await signIn('second-token',pw);ok(r.status===200&&r.value.profile.id==='pw'&&pw.facebook.id==='1002'&&pw.login==='pw-user'&&pw.led.gems===50&&!pw.facebookOnly,'linking keeps login, nickname and progress');
  r=await signIn('good-token',pw);ok(r.status===403&&/linked to another commander/.test(r.value.error),'a Facebook id on another account: clear error');
  r=await signIn('third-token',pw);ok(r.status===403&&/different Facebook account is already linked/.test(r.value.error),'a second Facebook on one account: clear error');
  ok(pw.facebook.id==='1002','a refused link changes nothing');
  // guest upgrade
  const guest={id:'guest',guest:true,login:'guest-login',name:'Guesty'};users.guest=guest;
  r=await signIn('guest-token',guest);ok(r.status===200&&r.value.profile.id==='guest'&&guest.guest===undefined&&guest.facebookOnly===true&&guest.login==='guest-login','a guest upgrades in place and is facebook-only');
  // banned
  users.fb1001.banned=true;r=await signIn('good-token');ok(r.status===403,'a banned account cannot sign in');delete users.fb1001.banned;
  // device cap (three accounts per device), like Google
  c.DB.devices['h:shared']=3;r=await signIn('fourth-token',null,{device:'shared'});ok(r.status===403&&/creation limit/.test(r.value.error)&&!users.fb1004,'the device cap blocks a 4th account');
  c.DB.devices['h:shared']=0;c.DB.ipAccounts['capped-net']=Array(6).fill(Date.now());r=await signIn('fourth-token',null,{device:'shared',ip:'capped-net'});ok(r.status===403&&!users.fb1004,'the network/day cap blocks creation');
  // unlink: code to the verified recovery email, purpose-scoped
  const unlink=(path,current,code)=>run('/api/auth/facebook/'+path,{method:'POST',current,input:{code}},{});
  ok((await unlink('unlink-request',pw)).status===400,'no recovery email: unlink refused');
  pw.email='owner@example.invalid';
  ok((await unlink('unlink',pw,'123456')).status!==200,'unlink without a requested code is refused');
  ok((await unlink('unlink-request',pw)).status===200&&pw.reset.purpose==='facebook-unlink','unlink-request sends a facebook-unlink code');
  ok((await unlink('unlink',pw,'999999')).status===400&&pw.facebook,'a wrong code keeps the link');
  ok((await c.acctResetVerify(pw.login,'123456','new-password','test-network')).status===400&&pw.hash==='password','an unlink code cannot reset the password');
  ok((await c.acctResetVerify(pw.login,'123456',null,'test-network',null,'google-unlink')).status===400&&pw.facebook,'an unlink-Facebook code cannot unlink Google');
  r=await unlink('unlink',pw,'123456');ok(r.status===200&&pw.facebook===undefined&&pw.login==='pw-user','the right code unlinks Facebook');
  fbUser.email='fbowner@example.invalid';
  ok((await unlink('unlink-request',fbUser)).status===409&&(await unlink('unlink',fbUser,'123456')).status===409&&fbUser.facebook,'a facebook-only account must set a password first');
  // a password reset makes it unlinkable (clears facebookOnly)
  await c.acctResetRequest(fbUser.login,'reset-network');const rs=await c.acctResetVerify(fbUser.login,'123456','new-password','reset-network');
  ok(rs.u&&fbUser.facebookOnly===undefined,'a password reset clears facebookOnly');
  // ---- 4. data-deletion callback ----
  const post=(raw,host='emberweaveheroes.com')=>{const req=new EventEmitter();req.method='POST';req.headers={host};
    const done=run('/api/auth/facebook/data-deletion',req,{});setImmediate(()=>{req.emit('data',Buffer.from(raw));req.emit('end');});return done;};
  ok(guest.facebook.id==='1005','(guest still linked)');
  r=await post('signed_request='+encodeURIComponent(signed({algorithm:'HMAC-SHA256',user_id:'1005'})));
  ok(r.status===200&&/^[0-9a-f]{16}$/.test(r.value.confirmation_code)&&r.value.url==='https://emberweaveheroes.com/facebook-data-deletion?code='+r.value.confirmation_code,'callback answers {url, confirmation_code}');
  ok(guest.facebook===undefined&&saved.includes('guest'),'callback erased and saved that user\'s Facebook data');
  const before=JSON.stringify(users.fb1001.facebook);
  r=await post('signed_request='+encodeURIComponent(signed({algorithm:'HMAC-SHA256',user_id:'1001'},'forged')));ok(r.status===400&&JSON.stringify(users.fb1001.facebook)===before,'a forged signed_request erases nothing');
  r=await post('signed_request='+encodeURIComponent(signed({algorithm:'HMAC-SHA256',user_id:'1001'})),'evil.example');ok(r.value.url.startsWith('https://emberweaveheroes.com/'),'a forged Host never picks the status URL');
  // ---- 5. static wiring ----
  ok(server.includes("serveFile(res,'legal/facebook-data-deletion.html'")&&fs.existsSync(require.resolve('../legal/facebook-data-deletion.html')),'/facebook-data-deletion page is served');
  ok(server.includes("/api/internal/account/facebook'")&&server.includes("'/api/internal/account/facebook-erase'"),'satellites resolve through Server 1');
  ok(!/FACEBOOK_APP_SECRET\s*[=:]\s*['"][^'"]/.test(server)&&!/console\.\w+\([^)]*FACEBOOK_APP_SECRET/.test(server),'no secret literal and no secret logged');
  ok(html.includes('https://connect.facebook.net/en_US/sdk.js')&&html.includes("scope:'public_profile,email'")&&html.includes('/api/auth/facebook/config'),'client: lazy SDK, FB.login scope, config probe');
  ok(html.includes('#1877F2')&&html.includes("t('auth.fb_continue')"),'client: Facebook blue + translated label');
  console.log('Facebook sign-in: '+pass+' checks PASS (verifier fail-closed, control caught a skipping verifier, routes, conflicts, caps, unlink, signed_request, data deletion)');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearInterval(keepAlive));
