'use strict';const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
if(fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'))throw Error('Shutdown');
const adapter=fs.readFileSync(path.join(__dirname,'indexed-adapter.cjs'),'utf8'),sha=crypto.createHash('sha256').update(adapter).digest('hex'),session=crypto.randomUUID();
let reports=[];
const html=`<!doctype html><meta charset="utf-8"><title>Private indexed recovery fixture</title><style>body{font:16px system-ui;background:#121923;color:#edf2f8;max-width:1000px;margin:32px auto}button{padding:12px;margin:6px}pre{white-space:pre-wrap;background:#1f2b3b;padding:18px}</style><h1>Private indexed recovery fixture</h1><p>Results-only adapter. No game, paid entry, network grant or legacy migration. Native IndexedDB; fixture data only.</p><button id="run">Run native cases</button><button id="refresh">Refresh saved records</button><button id="cross">Register cross-tab result</button><pre id="out">Opening private fixture database...</pre><script>
const module={exports:{}};
${adapter}
const A=module.exports,session=${JSON.stringify(session)},adapterHash=${JSON.stringify(sha)},database='codex-private-raid-'+session;
let db,logs=[],results=[],running=false;
const row=(id,account,dmg=10)=>({v:2,id,accountId:account,guildId:'fixture-guild',createdAt:1,entryRequestId:null,packet:{requestId:id,attemptId:'fixture-attempt',inputLog:[],dmg}});
const check=(v,msg)=>{if(!v)throw Error(msg)};
function open(){return new Promise((resolve,reject)=>{const q=indexedDB.open(database,1);q.onupgradeneeded=()=>{const s=q.result.createObjectStore('results',{keyPath:['accountId','id']});s.createIndex('account','accountId',{unique:false})};q.onerror=()=>reject(q.error);q.onsuccess=()=>resolve(q.result);q.onblocked=()=>reject(Error('Upgrade blocked'));});}
function wrapped(base,abort=false){return {transaction(store,mode){
 const tx=base.transaction(store,mode);
 tx.addEventListener('complete',()=>logs.push('transaction-complete'));
 tx.addEventListener('abort',()=>logs.push('transaction-abort'));
 return {get error(){return tx.error},set oncomplete(v){tx.oncomplete=v},set onabort(v){tx.onabort=v},set onerror(v){tx.onerror=v},abort:()=>tx.abort(),objectStore(name){
  const s=tx.objectStore(name);
  return {index:n=>s.index(n),get:k=>s.get(k),delete:k=>s.delete(k),add:p=>{
   const q=s.add(p);q.addEventListener('success',()=>{logs.push('add-request-success');if(abort)tx.abort()});return q;
  }};
 }};
}};}
function records(){return new Promise((resolve,reject)=>{const tx=db.transaction('results','readonly'),q=tx.objectStore('results').getAll();let data;q.onsuccess=()=>data=q.result;tx.oncomplete=()=>resolve(data);tx.onabort=()=>reject(tx.error)});}
async function show(){const saved=await records();document.getElementById('out').textContent=JSON.stringify({session,adapterHash,running,results,logs,saved,unrelatedFixtureKeys:localStorage.length},null,2);return saved;}
async function publish(){await show();await fetch('/report',{method:'POST',headers:{'content-type':'application/json'},body:document.getElementById('out').textContent});}
async function expectReject(p,fragment){let failed=false;try{await p}catch(e){failed=String(e.message).includes(fragment)}check(failed,'Expected rejection '+fragment);}
async function test(name,fn){try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:String(e)})}await publish();}
document.getElementById('run').onclick=async()=>{if(running)return;running=true;document.getElementById('run').disabled=true;const prefix=crypto.randomUUID();
 await test('Native request success then transaction commit then acknowledgment',async()=>{logs=[];await A.register(wrapped(db),row('commit',prefix+'-commit'));logs.push('adapter-ack');check(logs.indexOf('add-request-success')<logs.indexOf('transaction-complete')&&logs.indexOf('transaction-complete')<logs.indexOf('adapter-ack'),'Commit ordering');});
 await test('Native abort after add success leaves no committed result',async()=>{const account=prefix+'-abort';await expectReject(A.register(wrapped(db,true),row('abort',account)),'abort');check((await A.discover(db,account,'fixture-guild')).length===0,'Abort rollback');});
 await test('Native concurrent transactions preserve distinct immutable rows and hold ambiguity',async()=>{const account=prefix+'-distinct';await Promise.all([A.register(db,row('A',account)),A.register(db,row('B',account))]);await expectReject(A.discover(db,account,'fixture-guild'),'Competing');check((await records()).filter(r=>r.accountId===account).length===2,'Both rows retained');});
 await test('Native concurrent duplicate packet reuses one immutable row',async()=>{const account=prefix+'-duplicate',p=row('same',account);const q=await Promise.all([A.register(db,p),A.register(db,{...p,id:'second'})]);check(q.filter(r=>r.reused).length===1,'One duplicate reuse');check((await A.discover(db,account,'fixture-guild')).length===1,'One row');});
 await test('Native atomic account cap refuses fifth without eviction',async()=>{const account=prefix+'-cap';const rs=await Promise.allSettled(Array.from({length:5},(_,i)=>A.register(db,row('cap'+i,account))));check(rs.filter(r=>r.status==='fulfilled').length===4,'Four commits');check(rs.filter(r=>r.status==='rejected').length===1,'One refusal');check((await records()).filter(r=>r.accountId===account).length===4,'No eviction');});
 await test('Native indexed discovery independent of 600 unrelated fixture keys',async()=>{const account=prefix+'-unrelated';await A.register(db,row('stored',account));for(let i=0;i<600;i++)localStorage.setItem('private-fixture-'+session+'-'+i,'x');check((await A.discover(db,account,'fixture-guild')).length===1,'Scoped discovery');});
 await test('Native closed connection reopened retains committed exact packet',async()=>{const account=prefix+'-reopen',p=row('reload',account);await A.register(db,p);db.close();db=await open();const r=await A.discover(db,account,'fixture-guild');check(r.length===1&&JSON.stringify(r[0])===JSON.stringify(p),'Exact reopened row');});
 running=false;await publish();};
document.getElementById('refresh').onclick=publish;
document.getElementById('cross').onclick=async()=>{const side=new URLSearchParams(location.search).get('side')||'A';try{await A.register(db,row('cross-'+side,'cross-tab-'+session));results.push({name:'cross-tab '+side,pass:true})}catch(e){results.push({name:'cross-tab '+side,pass:false,error:String(e)})}await publish();};
open().then(async d=>{db=d;await publish()}).catch(e=>document.getElementById('out').textContent='FAILED '+String(e));
</script>`;
const server=http.createServer(async(req,res)=>{if(req.url==='/shutdown'){res.end('Stopped');server.close(()=>process.exit(0));return}if(req.url==='/evidence'){res.setHeader('content-type','application/json');res.end(JSON.stringify({session,adapterHash:sha,reports}));return}if(req.url==='/report'&&req.method==='POST'){let raw='';for await(const b of req){raw+=b;if(raw.length>1000000){res.writeHead(413).end();return}}try{reports.push(JSON.parse(raw));res.end('Saved')}catch{res.writeHead(400).end()}return}res.setHeader('content-type','text/html');res.end(html)});
server.listen(0,'127.0.0.1',()=>{const meta={url:'http://127.0.0.1:'+server.address().port,session,adapterHash:sha};fs.writeFileSync(path.join(__dirname,'browser-session.json'),JSON.stringify(meta,null,2));console.log(JSON.stringify(meta))});setTimeout(()=>server.close(()=>process.exit(0)),600000).unref();
