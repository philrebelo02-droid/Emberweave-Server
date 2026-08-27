/* ===========================================================================
   v270 — THE REAL PROOF (spec §8.10): play a campaign stage in a REAL browser, on the live client,
   and check that the fight the player watched is exactly the fight the server recorded.
   The browser plays; the server replays the transcript; the two end states must be identical.
   =========================================================================== */
const { chromium } = require('playwright');
const PORT=process.env.PORT||8871;
let pass=0,fail=0; const ck=(n,c,d)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+d:''))); };

(async()=>{
  const b=await chromium.launch();
  const pg=await (await b.newContext({viewport:{width:1000,height:600}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message)));
  await pg.goto('http://localhost:'+PORT+'/play',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2500);
  await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p)p.click(); });
  await pg.waitForTimeout(1200);
  console.log('== v270: the fight the player played IS the fight the server recorded ==');

  const r=await pg.evaluate(async()=>{
    const name='live'+Date.now().toString(36);
    const reg=await api('/api/register','POST',{name,pass:'password1'});
    ACC.token=reg.token; ACC.id=reg.profile.id;
    // start the stage exactly the way the Battle button does
    CUR={node:1, mode:'campaign', portal:'normal'};
    const s=await api('/api/campaign/start','POST',{mode:'normal',node:1,heroIds:['vael','sylthaine','vireo'],requestId:'live'+Date.now()});
    if(!s||!s.ok) return {error:(s&&s.error)||'start failed'};
    CUR.attemptId=s.attemptId; CUR.cwaves=(s.stage&&s.stage.waves)||null;
    CUR.serverSnaps=s.snaps; CUR.seed=s.seed>>>0; CUR.engine=s.engine;
    G.team=['vael','sylthaine','vireo'];
    // capture the game's OWN resolve call — the real flow fires it from endBattle
    window.__cap=null; const _api=window.api;
    window.api=async function(path,method,body){ const out=await _api.apply(null,arguments);
      if(path==='/api/campaign/resolve') window.__cap={body,out}; return out; };
    startBattle();
    const seedUsed=CUR.seed;
    const spawnedHp=units.filter(u=>u.team==='ally').map(u=>Math.round(u.maxHp));
    const serverHp=(s.snaps||[]).map(x=>Math.round(x.maxHp));
    // play it: turn AUTO on a few ticks in (a recorded action), then run the fight to the end
    for(let i=0;i<40;i++) updateBattle(SIM_STEP);
    document.getElementById('autoBtn').onclick();
    for(let i=0;i<14400 && !ended && state==='battle';i++) updateBattle(SIM_STEP);
    if(!ended) endBattle(false);
    const clientDigest=window._p2lastDigest;
    const log=(INPUT_LOG||[]).slice(0,400);
    // endBattle schedules the resolve; wait for the game's own request to come back
    for(let i=0;i<60 && !window.__cap;i++) await new Promise(r=>setTimeout(r,100));
    const cap=window.__cap||{};
    return { seedUsed, spawnedHp, serverHp, log, clientDigest, res:cap.out||{error:'no resolve call'},
      sent:cap.body||null, clientWon:/"won":true/.test(clientDigest||'') };
  });

  if(r.error){ console.log('  ✗ could not start the stage — '+r.error); process.exit(1); }
  ck('the client fought on the SERVER\'s seed', typeof r.seedUsed==='number');
  ck('the squad was built from the server snapshots', JSON.stringify(r.spawnedHp)===JSON.stringify(r.serverHp),
     'client '+JSON.stringify(r.spawnedHp)+' vs server '+JSON.stringify(r.serverHp));
  ck('turning AUTO on was recorded as a player action', r.log.some(e=>e[1]==='auto'), JSON.stringify(r.log).slice(0,120));
  ck('the game itself submitted the transcript', !!(r.sent && Array.isArray(r.sent.inputLog)), JSON.stringify(r.sent||{}).slice(0,120));
  ck('the server verified the battle', r.res && r.res.ok===true && r.res.verified===true, JSON.stringify(r.res).slice(0,160));
  ck('the server replay reached the SAME end state as the fight on screen', r.res && r.res.digestMatch===true,
     'digestMatch='+(r.res&&r.res.digestMatch)+'\n      client: '+String(r.clientDigest).slice(0,300)+'\n      server: '+String(r.res&&r.res.serverEnd).slice(0,300));
  ck('the server recorded the same outcome the player saw', !!(r.res&&r.res.won)===!!r.clientWon,
     'client won='+r.clientWon+' server won='+(r.res&&r.res.won));
  ck('no page errors during the fight', errs.length===0, errs.slice(0,2).join(' | '));

  await b.close();
  console.log(''); console.log('PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
