// v1376 (tester Soul Eater 12 Nov: "if you complete a stage of the campaign with only one hero ... you still get 3 stars"; Phil: "Star issue needs to be fixed").
// Stars count against a FULL team (5, or every owned hero if fewer). The server caps a short squad. CONTROL: EW_ROOT=<d5dca06b copy> must FAIL.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-stars-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,fails=0,checks=0; const ok=(c,m)=>{checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
(async()=>{ try{
  const port=await freePort(), base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<200;i++){ try{ if((await fetch(base+'/api/health')).ok) break; }catch(_){} await delay(150); }
  let token=''; const api=async(p,m,b)=>{ const r=await fetch(base+p,{method:m||'GET',headers:Object.assign({'content-type':'application/json'},token?{'x-token':token}:{}),body:b?JSON.stringify(b):undefined}); return r.json(); };
  const reg=await api('/api/register','POST',{name:'st'+Date.now().toString(36),pass:'password1'}); token=reg.token;
  const me=await api('/api/ledger'); const owned=Object.keys((me.ledger||me).unlocked||{}).filter(k=>((me.ledger||me).unlocked||{})[k]);
  console.log('  owned heroes:',owned.length, owned.join(','));
  const run=async(node,squad,rid)=>{ const s=await api('/api/campaign/start','POST',{mode:'normal',node,heroIds:squad,requestId:rid+'s'});
    const w=JSON.stringify({t:60,won:true,stars:3,wave:2,u:squad.map(k=>[k,'ally',1,500,0,100,100])});
    return api('/api/campaign/resolve','POST',{attemptId:s.attemptId,requestId:rid+'r',inputLog:[[1,'auto',-1,1]],digest:w,won:true,stars:3}); };
  const one=await run(1,[owned[0]],'a'); ok(one.ok&&one.won&&one.stars<3, 'one hero, everyone alive -> NOT 3 stars ('+one.stars+')');
  const full=await run(2,owned.slice(0,5),'b'); ok(full.ok&&full.stars===3, 'a full team ('+Math.min(5,owned.length)+' of '+owned.length+' owned), everyone alive -> 3 stars ('+full.stars+')');
  ok(owned.length>=2, 'the account owns more than one hero (so the test means something)');
}catch(e){ console.error(e); fails++; } finally { console.log('full team stars: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
