// WS revocation: host a room with a valid token, revoke the token (second login drops it),
// then prove a following 'msg' frame is NOT relayed to the peer (re-audit round 3, High 2).
// Requires: server on :8871 with WS_AUTH_REQUIRED=true (default), npm package 'ws'.
const WebSocket=require('ws'); const http=require('http');
const B='http://localhost:8871';
function post(p,body){ return new Promise((res,rej)=>{ const d=JSON.stringify(body);
  const r=http.request(B+p,{method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(d)}},x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}});}); r.on('error',rej); r.end(d); }); }
(async()=>{
  let pass=0,fail=0; const ck=(n,c)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n)); };
  const reg=await post('/api/register',{name:'wsrv'+Math.floor(Math.random()*1e6),pass:'password1'});
  let tok=reg.token; const name=reg.profile.name;
  const A=new WebSocket('ws://localhost:8871'), Bws=new WebSocket('ws://localhost:8871');
  const wait=(ws,t)=>new Promise(res=>{ const h=d=>{ const m=JSON.parse(d); if(m.t===t){ ws.off('message',h); res(m);} }; ws.on('message',h); setTimeout(()=>res(null),4000); });
  await Promise.all([new Promise(r=>A.on('open',r)), new Promise(r=>Bws.on('open',r))]);
  A.send(JSON.stringify({t:'host',token:tok}));
  const hosted=await wait(A,'hosted'); ck('room hosted with valid token', !!hosted);
  Bws.send(JSON.stringify({t:'join',code:hosted.code,token:tok}));
  ck('peer joined', !!(await wait(Bws,'joined')));
  // relay works while the token is valid
  const p1=wait(Bws,'peer'); A.send(JSON.stringify({t:'msg',token:tok,data:{x:1}}));
  ck('relay works pre-revocation', !!(await p1));
  // REVOKE: logging in again drops all old tokens (single-session rule)
  await post('/api/login',{name,pass:'password1'});
  const p2=wait(Bws,'peer'); const pl=wait(Bws,'peerleft');
  A.send(JSON.stringify({t:'msg',token:tok,data:{x:2}}));   // old token now invalid
  const relayed=await p2;
  ck('REVOKED token frame NOT relayed', relayed===null);
  ck('peer told the host left (room dissolved)', !!(await pl));
  A.close(); Bws.close();
  console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
})().catch(e=>{ console.log('FAIL: '+e.message); process.exit(1); });
