"use strict";
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const {createGoogleVerifier,resolveAccount}=require('../server/google-signin');
const nonce='test-nonce',clientId='test-client',claims={sub:'google-sub',email:'display@example.invalid',email_verified:true,iss:'https://accounts.google.com',aud:clientId,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,nonce};
const stub=payload=>createGoogleVerifier({clientId:()=>clientId,verifySignature:async()=>payload});
(async()=>{
  assert.equal((await stub(claims)('token',nonce)).sub,'google-sub');
  for(const bad of [{aud:'wrong'},{exp:1},{iss:'wrong'},{nonce:'wrong'},{sub:''}])await assert.rejects(stub({...claims,...bad})('token',nonce));
  const users={},create=sub=>{const u={id:'new',login:'fixed-login',name:'Commander',googleOnly:true};users[u.id]=u;return u;};
  const safe=await stub(claims)('token',nonce);
  let r=resolveAccount({users,claims:safe,create});assert(r.created);assert.equal(r.u.google.sub,claims.sub);assert(!JSON.stringify(r.u).includes('token'));
  r=resolveAccount({users,claims:{...safe,email:'changed@example.invalid'},create});assert(!r.created);assert.equal(r.u.id,'new');assert.equal(r.u.login,'fixed-login');
  const existing={id:'existing',login:'unchanged-user',name:'Chosen Commander',led:{gems:123},hash:'password'};users.existing=existing;
  r=resolveAccount({users,current:existing,claims:{sub:'other-sub',email:''},create});assert.equal(r.u.id,'existing');assert.equal(r.u.login,'unchanged-user');assert.equal(r.u.name,'Chosen Commander');assert.equal(r.u.led.gems,123);
  assert.throws(()=>resolveAccount({users,current:existing,claims:safe,create}),/another commander/);
  const guest={id:'guest',guest:true,login:'guest-login',led:{gems:10}};users.guest=guest;
  r=resolveAccount({users,current:guest,claims:safe,create});assert.equal(r.u.id,'new');assert.equal(guest.guest,true);
  r=resolveAccount({users,current:guest,claims:{sub:'fresh',email:''},create});assert.equal(r.u.id,'guest');assert.equal(r.u.login,'guest-login');assert.equal(r.u.guest,undefined);assert.equal(r.u.googleOnly,true);
  assert.throws(()=>resolveAccount({users,claims:safe,create,isBanned:()=>true}));
  const kp=crypto.generateKeyPairSync('rsa',{modulusLength:1024}),jwk=kp.publicKey.export({format:'jwk'});jwk.kid='kid';jwk.alg='RS256';
  const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=enc({alg:'RS256',kid:'kid'})+'.'+enc(claims),jwt=data+'.'+crypto.sign('RSA-SHA256',Buffer.from(data),kp.privateKey).toString('base64url');
  const real=createGoogleVerifier({clientId:()=>clientId,fetchImpl:async url=>{assert.equal(url,'https://www.googleapis.com/oauth2/v3/certs');return {ok:true,json:async()=>({keys:[jwk]})};}});
  assert.equal((await real(jwt,nonce)).sub,claims.sub);await assert.rejects(real(jwt.slice(0,-8)+'xxxxxxxx',nonce));
  const server=fs.readFileSync(require.resolve('../server.js'),'utf8'),html=fs.readFileSync(require.resolve('../emberweave-heroes.html'),'utf8');
  const staleContext={DB:{users:{}},googleVerify:async()=>safe};vm.createContext(staleContext);
  vm.runInContext(server.slice(server.indexOf('async function googleResolve('),server.indexOf("const PLAY_BILLING=require(")),staleContext);
  await assert.rejects(staleContext.googleResolve('token',nonce,{id:'deleted'},'network','device'),/Account changed/);
  const authRoute=server.slice(server.indexOf("  if(p==='/api/auth/google/config'"),server.indexOf("  if(p==='/api/register'"));
  const nonces=new Map(),sessions=[],c={process:{env:{GOOGLE_OAUTH_CLIENT_ID:clientId}},googleNonces:nonces,Date,rateLimited:()=>false,body:async req=>req.input,
    authUser:req=>req.current||null,send:(_res,status,value)=>({status,value}),ACCOUNT_AUTHORITY:false,isBanned:()=>false,acctDelCancel:()=>{},dropTokens:()=>{},issueToken:id=>{sessions.push(id);return 'session-'+id;},saveSoon:()=>true,clientIP:()=> 'test-network',usernameOf:u=>u.login,profileFor:u=>({id:u.id,login:u.login}),
    googleResolve:async(credential,n,current)=>{const cl=await stub(credential==='expired'?{...claims,exp:1}:credential==='wrong'?{...claims,aud:'wrong'}:claims)(credential,n);return resolveAccount({users,claims:cl,current,create});}};
  Object.assign(c,{DB:{users},crypto,loginId:name=>Object.values(users).find(u=>u.login.toLowerCase()===String(name).toLowerCase())?.id,gen6:()=> '123456',hashPassAsync:async(code,salt)=>crypto.createHash('sha256').update(code+salt).digest('hex'),writeDB:()=>{},sendResetEmail:()=>{},credOk:()=>null,makeCredAsync:async()=>({salt:'s',hash:'h',iters:1})});
  vm.createContext(c);
  vm.runInContext(server.slice(server.indexOf('const RESET_CODES_MAX='),server.indexOf('// v947: one-time server-switch')),c);
  const authRun=vm.runInContext('(async function(p,req,res){'+authRoute+'})',c);
  const sign=async(token,current)=>{nonces.set(nonce,{id:current?.id||null,until:Date.now()+10000});return authRun('/api/auth/google',{method:'POST',input:{credential:token,nonce},current},{})};
  let signed=await sign('valid');assert.equal(signed.status,200);assert.equal(signed.value.token,'session-new');assert.equal(signed.value.profile.login,'fixed-login');
  assert.equal((await sign('valid')).value.profile.id,'new');assert.equal((await sign('expired')).status,403);assert.equal((await sign('wrong')).status,403);
  assert.equal((await authRun('/api/auth/google',{method:'POST',input:{credential:'valid',nonce}},{})).status,403);
  const linked={id:'linked',login:'same-login',name:'My nickname',hash:'password'};users.linked=linked;
  // Give this credential a new Google subject for the linking route.
  c.googleResolve=async(token,n,current)=>resolveAccount({users,claims:{sub:'linked-sub',email:''},current,create});
  signed=await sign('link',linked);assert.equal(signed.value.profile.id,'linked');assert.equal(linked.login,'same-login');
  linked.email='recovery@example.invalid';
  const unlinkCall=(path,code)=>authRun('/api/auth/google/'+path,{method:'POST',current:linked,input:{code}},{});
  assert.equal((await unlinkCall('unlink','123456')).status,400);assert(linked.google);
  assert.equal((await unlinkCall('unlink-request')).status,200);assert.equal(linked.reset.purpose,'google-unlink');
  assert.equal((await unlinkCall('unlink','999999')).status,400);assert(linked.google);assert.equal(linked.reset.tries,1);
  linked.reset.exp=Date.now()-1;assert.equal((await unlinkCall('unlink','123456')).status,400);assert(linked.google);
  await unlinkCall('unlink-request');assert.equal((await unlinkCall('unlink','123456')).value.ok,true);assert.equal(linked.google,undefined);assert.equal(linked.login,'same-login');
  assert.equal((await unlinkCall('unlink','123456')).status,400);
  const passwordUser={id:'password',login:'password-user',name:'Password Commander',email:'owner@example.invalid',googleOnly:true};users.password=passwordUser;
  await c.acctResetRequest(passwordUser.login,'password-network');assert.equal(passwordUser.reset.purpose,'password');
  assert.equal((await c.acctResetVerify(passwordUser.login,'123456',null,'password-network',null,'google-unlink')).status,400);
  const reset=await c.acctResetVerify(passwordUser.login,'123456','new-password','password-network');assert.equal(reset.u.id,'password');assert.equal(reset.u.hash,'h');assert.equal(reset.u.googleOnly,undefined);
  const only=await authRun('/api/auth/google/unlink',{method:'POST',current:users.new,input:{}},{});assert.equal(only.status,409);
  guest.email='verified@example.invalid';
  assert.equal((await authRun('/api/auth/google/unlink-request',{method:'POST',current:guest,input:{}},{})).status,409);
  assert.equal((await authRun('/api/auth/google/unlink',{method:'POST',current:guest,input:{code:'123456'}},{})).status,409);assert(guest.google);
  // Purpose tags also prohibit an unlink code from setting a password.
  const isolated={id:'isolated',login:'isolated',email:'owner@example.invalid',google:{sub:'isolated-sub'},hash:'password'};users.isolated=isolated;
  await c.acctResetRequest(isolated.login,'purpose-network','google-unlink');
  assert.equal((await c.acctResetVerify(isolated.login,'123456','new-password','purpose-network')).status,400);assert.equal(isolated.hash,'password');
  assert(server.includes("linkSecretOk(req)"));assert(server.includes("googleNonces.delete(b.nonce)"));assert(server.includes("nonce.id!==(current?.id||null)"));assert(server.includes("/api/internal/account/google"));
  assert(html.includes('https://accounts.google.com/gsi/client'));assert(html.includes("text:'continue_with'"));assert(html.includes('Unlink Google account'));assert(html.includes("api(isCreate?'/api/register':'/api/login'"));
  // Compile every inline JavaScript block; no browser, network or game process is started.
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(/src=|application\/ld\+json|application\/json/i.test(match[1]))continue;
    new vm.Script(match[2]);
  }
  console.log('Google sign-in: stub claims, actual RSA signature, account identity/link conflicts, fixed login, guest behavior and all inline-script syntax PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
