// v1216 (23 Oct 2026, Ember's sweep 24 - the /api/tx/earn route family): EARN_RULES is empty, so /api/tx/earn pays NOTHING for any
// reason. This test keeps it that way: every reason a client ever sent (the 17 Ember listed) x every currency the route knows is refused
// and the wallet does not move; the static half checks every EARN_RULES currency table is empty.
// It replaces test_wallet_earn_api.js, which still expected gold/gauntlet to pay (removed with the 3 Oct P0 audit) and was never in the suite.
// Control 2: AUD_SERVER=<a server copy with gold/quest switched back on> must FAIL (static AND behaviour).
// Control: the static checker is fed an EARN_RULES text with one live rule and must flag it. Real server on a free port + temp DB. Asserts.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-earn-')), dbFile=path.join(dir,'db.json');
let port,base,child,token,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<150;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
// EARN_RULES = { what:{reason:{max,day}} ... } on one statement; a live rule is any reason key inside a currency's braces
function liveRules(src){
  const m=src.match(/const EARN_RULES\s*=\s*\{([\s\S]*?)\};/); if(!m) return null;
  const body=m[1].replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  return [...body.matchAll(/([a-zA-Z]+)\s*:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].filter(x=>/[a-zA-Z_]+\s*:\s*\{/.test(x[2])).map(x=>x[1]);
}
const WHAT=['gold','guildCoins','gems','stamina','px','heroXp','frag'];
const REASONS=['convert','quest','march','misc','tower','gauntlet','city','pack','signin','stars','arena','arenashop','guildshop','wish','daily','hax','elite'];
(async()=>{ try{
  const srv=fs.readFileSync(path.join(root,srvFile),'utf8');
  const live=liveRules(srv);
  ok(Array.isArray(live),'server.js defines EARN_RULES');
  ok(live.length===0,'every EARN_RULES currency table is empty (live: '+live+')');
  ok(JSON.stringify(liveRules("const EARN_RULES={gold:{quest:{max:500,day:2000}},gems:{}};"))==='["gold"]','CONTROL: the checker flags a live gold/quest rule');
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'earn-closed-'+Date.now()}); token=g.data.token; await call('/api/ledger');
  const before=await led(), snap=w=>JSON.stringify(WHAT.map(k=>before[k]===undefined?null:before[k]));
  let refused=0;
  for(const w of WHAT) for(const r of REASONS){
    const e=await call('/api/tx/earn',{what:w,amount:100,reason:r,heroKey:'grosk',requestId:'ec-'+w+'-'+r});
    ok(e.data.ok===false&&e.status>=400,'tx/earn '+w+'/'+r+' is refused ('+e.status+' '+(e.data.error||JSON.stringify(e.data).slice(0,60))+')');
    refused++;
  }
  const after=await led();
  ok(JSON.stringify(WHAT.map(k=>after[k]===undefined?null:after[k]))===snap(),'the wallet did not move after '+refused+' earn attempts');
  console.log('earn route closed (v1216): '+pass+' checks pass ('+refused+' reason x currency pairs refused)');
  await stop(); process.exit(0);
}catch(e){ console.error('FAIL',e.message); await stop(); process.exit(1); } })();
