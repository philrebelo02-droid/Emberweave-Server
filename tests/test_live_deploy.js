/* ===========================================================================
   v273 — DEPLOYMENT PROOF (audit response P0 #1 and evidence §9.1/§9.2).
   Black-box, against a LIVE server. Nothing here reads the local checkout: it asks the deployed
   host what it is, then tries to cheat it.
     BASE=https://emberweave-server-production.up.railway.app node test_live_deploy.js
   =========================================================================== */
const BASE=process.env.BASE||'http://localhost:8871';
const url=(p)=>BASE.replace(/\/$/,'')+p;
async function J(p, body, token){
  const r=await fetch(url(p),{method:body?'POST':'GET',
    headers:Object.assign({'content-type':'application/json'},token?{'x-token':token}:{}),
    body:body?JSON.stringify(body):undefined});
  let j=null; try{ j=await r.json(); }catch(e){}
  return {status:r.status, body:j};
}
let pass=0,fail=0; const ck=(n,c,d)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+d:''))); };
const rid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

(async()=>{
  console.log('== DEPLOYMENT PROOF against '+BASE+' ==');
  const ver=await (await fetch(url('/version.json?x='+Date.now()))).json().catch(()=>null);
  console.log('   client build: '+(ver&&ver.build));

  const reg=await J('/api/register',{name:'dp'+Math.floor(Math.random()*1e7),pass:'password1'});
  const T=reg.body&&reg.body.token;
  if(!T){ console.log('  ✗ could not register on the live host ('+reg.status+') — '+JSON.stringify(reg.body).slice(0,120)); process.exit(1); }
  ck('registered on the live host', true);

  const man=(await J('/api/manifest',null,T)).body||{};
  console.log('   server build: '+man.serverBuild+'   engine: '+man.engine);
  ck('the deployed server reports a build id', typeof man.serverBuild==='string'&&man.serverBuild.length>0);
  ck('the deployed server carries the v275 server-tick build', man.serverBuild==='v275-server-ticks', String(man.serverBuild));
  ck('the deployed campaign authority is transcript replay', man.authority&&man.authority.campaign==='player-transcript-replay');
  ck('the deployed server refunds on mismatch', man.authority&&man.authority.campaignMismatch==='unverified-refund');
  ck('the deployed raid power is ledger-derived', man.authority&&man.authority.raidPower==='ledger');
  ck('the deployed client engine matches the deployed client build', !ver||!man.engine||String(man.engine)===String(ver.build),
     'engine '+man.engine+' vs client '+(ver&&ver.build));

  // --- tamper: a forged line-up ---
  const forged=[]; for(let i=0;i<40;i++) forged.push({key:'vael',level:99999,rank:999});
  await J('/api/save',{team:forged, wall:forged, requestId:rid()},T);
  const g=await J('/api/guild/create',{name:'DP'+Math.floor(Math.random()*99999),requestId:rid()},T);
  const raid=await J('/api/guild/raid/assault',{requestId:rid(), power:5000000},T);
  const rb=raid.body||{};
  const hp=rb.raid&&rb.raid.hp, max=rb.raid&&rb.raid.max;
  ck('the live raid route answers', raid.status===200, JSON.stringify(rb).slice(0,120));
  ck('a forged line-up does not one-shot the live raid boss', !(hp===0),
     'boss hp '+hp+' / '+max);
  ck('a forged line-up does no more than a level-1 account should', (max&&hp!=null)?((max-hp)<max*0.02):true,
     'damage '+(max!=null&&hp!=null?(max-hp):'?')+' of '+max);

  // --- tamper: a forged save blob ---
  const before=(await J('/api/ledger',null,T)).body||{};
  await J('/api/save',{roster:{__save:JSON.stringify({gold:999999999,gems:4999999,playerXP:98000000,
    starRefine:{vael:15}, skillLevel:{vael:[10,10,10,10]}, unlocked:{konwu:true}, campaignCleared:100})}, requestId:rid()},T);
  const after=(await J('/api/ledger',null,T)).body||{};
  ck('a forged save cannot buy gold on the live host', after.gold===before.gold, before.gold+' -> '+after.gold);
  ck('a forged save cannot buy gems on the live host', after.gems===before.gems);
  ck('a forged save cannot clear the campaign on the live host', (after.camp&&after.camp.cleared|0)===0);
  ck('a forged save cannot unlock a hero on the live host', !(after.unlocked&&after.unlocked.konwu));

  // --- tamper: a declared campaign win ---
  const st=(await J('/api/campaign/start',{mode:'normal',node:1,heroIds:['vael','sylthaine','vireo'],requestId:rid()},T)).body||{};
  ck('the live server freezes the session and issues the seed', st.ok===true && typeof st.seed==='number' && Array.isArray(st.snaps));
  const claim=(await J('/api/campaign/resolve',{attemptId:st.attemptId,requestId:rid(),inputLog:[],
    won:true, stars:3, reward:{gold:999999}},T)).body||{};
  ck('a declared win with no end state is refused as unverified', claim.ok===false && claim.unverified===true,
     JSON.stringify(claim).slice(0,140));
  const led=(await J('/api/ledger',null,T)).body||{};
  ck('the refused battle granted nothing', (led.camp&&led.camp.cleared|0)===0 && led.gold===after.gold,
     'cleared '+(led.camp&&led.camp.cleared)+' gold '+led.gold);

  console.log(''); console.log('PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
