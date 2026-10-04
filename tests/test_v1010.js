// 4 Oct 2026 second-pass fixes (v1010). Server: the backup token is accepted in the x-backup-token header only (a ?token= lands in
// access logs) - Account N11; the feedback inbox is capped, received items dropped first - Account N9.
// Client (the page's own functions run with stubs): a Market/Shady tx spend keeps ONE requestId per offer until answered - Market #7;
// an Emberdraft claim refused by a failed save is KEPT and re-sent (it was deleted) - Arena N4.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server> and AUD_PAGE=<pre-fix page> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),vm=require('vm'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', page=process.env.AUD_PAGE||path.join(root,'emberweave-heroes.html');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-v1010-')), dbFile=path.join(dir,'db.json'), BT='bt-'+Date.now()+'-0123456789abcdef';
const control=!!(process.env.AUD_SERVER||process.env.AUD_PAGE);
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(control&&!c){ missed.push(m); return; } assert(c,m); pass++; };   /* control: count every miss */
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,BACKUP_TOKEN:BT},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,hdr){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{'x-token':token}:{}),...(hdr||{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const src=fs.readFileSync(page,'utf8');
const fnSrc=(name,end)=>{ const a=src.indexOf(name), b=src.indexOf(end,a); assert(a>=0&&b>a,name+' found'); return src.slice(a,b); };
(async()=>{ try{
  /* ---- client: tx spend requestId per offer ---- */
  { const sent=[]; const replies=[{error:'offline'},{ok:true,ledger:{}},{ok:true,ledger:{}}];
    const ctx={ACC:{token:'t'}, SHOP_RID:{}, uid8:(()=>{ let n=0; return ()=>'rid'+(++n); })(), adoptLedger:()=>{}, bannerMsg:()=>{}, ledgerSync:async()=>{},
      api:async(p,m,b)=>{ sent.push(b.requestId); return replies.shift(); }};
    vm.createContext(ctx);
    vm.runInContext(fnSrc('function shopRid(k)','\nasync function shopOnce')+fnSrc('async function txSpend(','\n/* v267')+';this.t=txSpend;',ctx);
    await ctx.t('gems',50,'market','mtx:1:0'); await ctx.t('gems',50,'market','mtx:1:0'); await ctx.t('gems',50,'market','mtx:1:0');
    ok(sent[0]===sent[1],'a retap after a lost reply re-sends the SAME requestId ('+sent.join(',')+')');
    ok(sent[2]!==sent[1],'after the server answered, the next purchase gets a new requestId ('+sent.join(',')+')'); }
  /* ---- client: Emberdraft claim kept on a failed save ---- */
  { const store={ew_edClaim:JSON.stringify({attemptId:'A1',requestId:'r1'})}; let got=null;
    const ctx={localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
      setTimeout:(f)=>f(), api:async()=>({ok:false,storageFailed:true,error:'Save failed - try again.'})};
    vm.createContext(ctx); vm.runInContext(fnSrc('function edSendClaim(','\nfunction edResendClaim')+';this.s=edSendClaim;',ctx);
    await new Promise(r=>ctx.s({attemptId:'A1',requestId:'r1'},0,d=>{ got=d; r(); }));
    ok(!!store.ew_edClaim,'a claim refused by a failed save stays saved for the next try (claim '+(store.ew_edClaim?'kept':'deleted')+')'); }
  /* ---- server ---- */
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const q=await call('/api/admin/backup?token='+encodeURIComponent(BT));
  ok(q.status===403,'a backup token in the URL is refused ('+q.status+')');
  const h=await call('/api/admin/backup',null,{'x-backup-token':BT});
  ok(h.status===200&&h.data&&h.data.users,'the backup token in the header works ('+h.status+')');
  const g=await call('/api/guest',{deviceId:'v1010-'+Date.now()}); token=g.data.token; id=g.data.profile.id;
  await editDB(db=>{ db.feedback=[]; for(let i=0;i<5000;i++) db.feedback.push({id:'old'+i,t:1000+i,userId:'x',name:'x',kind:'bug',text:'old '+i,received:i<10,receivedAt:Date.now()}); });
  const rp=await call('/api/report',{text:'the newest report'});
  ok(rp.status===200,'a report is filed ('+rp.status+' '+(rp.data.error||'')+')');
  await delay(500); const fb=disk().feedback||[];
  ok(fb.length===5000,'the inbox stays at 5,000 ('+fb.length+')');
  ok(fb.some(f=>f.text==='the newest report')&&!fb.some(f=>f.id==='old0')&&fb.some(f=>f.id==='old10'),'the oldest RECEIVED item made room; unread ones are kept');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_v1010.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+', page '+path.basename(page)+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
