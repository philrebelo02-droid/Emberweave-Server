// v1083 - exploit scan round 5 (resource abuse), batch A:
//  #4 the rate limiter does not store a refused hit (a flood used to grow its list without bound);
//  #1 GET /api/ledger, /api/pvp/reports, /api/glyphs/state save only when the read changed something, and are limited per account;
//  #2 chatjoin sends the history at most once per 30 s per socket / 10 s per account; #3 a chat line saves at most every 30 s;
//  #5 /api/save body 1.2 MB and 60 a minute; #6 /api/guild/mine 30 a minute; #10 every guild log push capped at 100; #11 Well start 10 a minute.
// The per-account limits scale by RL_MUL (default 1; a sim tab - CLOCK_FILE set - uses 1000).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),vm=require('vm'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ab1083-'));
const dbFile=path.join(dir,'db.json'), src=fs.readFileSync(path.join(root,srvFile),'utf8');
let port,base,child,token,pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ const env={...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile}; delete env.CLOCK_FILE; delete env.RL_MUL;
  child=spawn(process.execPath,[srvFile],{cwd:root,env,stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
(async()=>{ try{
  // #4 the limiter, run as plain JS
  const fn=src.match(/function rateLimited\(req, key, max, windowMs\)\{[^\n]*\n[^\n]*/);
  const ctx={_hits:{},_hitWin:{},clientIP:()=>'1.1.1.1'}; if(fn) vm.runInNewContext(fn[0]+'\nthis.rl=rateLimited;',ctx);
  if(ctx.rl){ for(let i=0;i<500;i++) ctx.rl({},'k',10,60000); }
  ok(ctx.rl&&ctx._hits['k|1.1.1.1'].length<=11,'#4 a flood of 500 hits on a 10-a-minute key keeps at most 11 stamps ('+(ctx._hits['k|1.1.1.1']||[]).length+')');
  // #1 live: the ledger read is limited per account (120 a minute)
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'ab1083-'+Date.now()}); token=g.data.token;
  let last=200; for(let i=0;i<125;i++){ const r=await call('/api/ledger'); last=r.status; if(r.status===429) break; }
  ok(last===429,'#1 the 121st ledger read in a minute is refused (429)');
  // static: each read saves only on change; the other limits
  ok(/const _b=_sig\(\); const v=ledgerView\(me\); if\(_sig\(\)!==_b\) writeDB\(\);/.test(src),'#1 /api/ledger saves only when the read changed the account');
  ok(/if\(_noId\) writeDB\(\); return send\(res,200,\{reports:me\.pvpMail\}\);/.test(src),'#1 /api/pvp/reports saves only when an old report got its id');
  ok(/const g=ensureGlyphs\(me\); if\(_gs\(\)!==_gb\) writeDB\(\);/.test(src),'#1 /api/glyphs/state saves only when a migration ran');
  ok(/ws\._chatJoinAt&&now-ws\._chatJoinAt<30000/.test(src)&&/_chatJoinAcct\[ak\]&&now-_chatJoinAcct\[ak\]<10000/.test(src),'#2 chat history at most once per 30 s per socket, 10 s per account');
  ok(/chatStore\(\)\[ch\]\.push\(msg\); pruneChat\(ch\); chatSaveSoon\(\);/.test(src)&&/setTimeout\(\(\)=>\{ _chatSaveT=null; writeDB\(\); \},30000\)/.test(src),'#3 a chat line saves at most every 30 s');
  ok(/BODY_MAX_SAVE \|\| Math\.round\(1\.2\*1024\*1024\)/.test(src)&&/rateLimited\(req,'save:'\+me\.id,Math\.round\(60\*RL_MUL\),60000\)/.test(src),'#5 the save upload: 1.2 MB, 60 a minute');
  ok(/rateLimited\(req,'guildMine:'\+me\.id,Math\.round\(30\*RL_MUL\),60000\)/.test(src),'#6 guild/mine 30 a minute');
  { let uncapped=0; const re=/\b(g|gg)\.log\.push\(/g; let m; while((m=re.exec(src))){ let j=m.index+m[0].length, d=1; while(d&&j<src.length){ const c=src[j]; if(c==='(')d++; else if(c===')')d--; j++; }
      const tail=src.slice(j,j+60); if(!/guildLogCap|\.log\.length>100/.test(tail)) uncapped++; }
    ok(uncapped===0,'#10 every guild log push is capped at 100 ('+uncapped+' uncapped)'); }
  ok(/rateLimited\(req,'wellStart:'\+me\.id,Math\.round\(10\*RL_MUL\),60000\)/.test(src),'#11 Well start 10 a minute');
  ok(/const RL_MUL=Math\.max\(1,\+\(process\.env\.RL_MUL\|\|\(process\.env\.CLOCK_FILE\?1000:1\)\)\);/.test(src),'sim tab servers (CLOCK_FILE) are not throttled by the new limits');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_abuse_1083.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
