const { chromium } = require('playwright');
(async()=>{
  let pass=0,fail=0; const ck=(n,c,d)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+String(d).slice(0,140):''))); };
  const b=await chromium.launch();
  const pg=await (await b.newContext({viewport:{width:1000,height:520}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
  await pg.goto('http://localhost:8871/play',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p)p.click(); });
  await pg.waitForTimeout(1500);
  const r=await pg.evaluate(async()=>{
    const out={};
    const lg=await api('/api/login','POST',{name:'dev1',pass:'password1'});
    ACC.token=lg.token; ACC.id=lg.profile.id; ACC.admin=lg.profile.admin;
    await ledgerSync();
    out.ledgerAdopted=!!LED.st; out.gold0=G.gold; out.stam0=G.stamina;
    // grant stamina+gold for the run
    const gr=await api('/api/admin/led-grant','POST',{gold:5000,gems:1000,stamina:60,px:2000});
    if(gr&&gr.ok) adoptLedger(gr.ledger);
    out.goldAfterGrant=G.gold;
    // CAMPAIGN: server start → authored waves → battle spawns them → server resolve
    const st=await api('/api/campaign/start','POST',{node:1,heroIds:['vael','sylthaine','vireo'],requestId:uid8()});
    out.campStart=!!(st&&st.ok); out.campWaves=st&&st.stage&&st.stage.waves&&st.stage.waves.length;
    if(st&&st.ok){
      CUR={mode:'campaign',node:1,attemptId:st.attemptId,cwaves:st.stage.waves};
      const cq=squadFor('campaign'); cq.length=0; cq.push('vael','sylthaine','vireo'); G.team=['vael','sylthaine','vireo'];
      startBattle();
      const foes=units.filter(u=>u.team==='enemy');
      out.spawnedFromAuthored=foes.length===st.stage.waves[0].length && foes.every((u,i)=>u.key===st.stage.waves[0][i].key||st.stage.waves[0].some(m=>m.key===u.key));
      out.enemyKeys=foes.map(u=>u.key);
      ended=true; clearBattle();
      const rs=await api('/api/campaign/resolve','POST',{attemptId:st.attemptId,requestId:uid8()});
      out.resolve=rs&&rs.ok; out.resolveWon=rs&&rs.won; out.rewardGold=rs&&rs.reward&&rs.reward.gold;
      if(rs&&rs.ledger) adoptLedger(rs.ledger);
      out.goldAfterWin=G.gold;
    }
    // WISH (server)
    const w=await serverWish('gold',1); out.wish=!!(w&&w.results&&w.results.length===1);
    // GEAR SKILL executor: craft/equip/select then fight and fire
    let s2=await api('/api/gear/state'); let rv=s2.revision;
    const g2=await api('/api/gear/grant','POST',{expectedRevision:rv,frag:'E01',n:2,dust:100}); rv=g2.revision;
    const c1=await api('/api/gear/craft','POST',{expectedRevision:rv,gearId:'E01'}); rv=c1.revision;
    const eq=await api('/api/gear/equip','POST',{expectedRevision:rv,heroKey:'vael',itemId:c1.crafted}); rv=eq.revision;
    await api('/api/gear/select-active','POST',{expectedRevision:rv,heroKey:'vael',itemId:c1.crafted});
    await forgeSync();
    const ga=gearActiveFor('vael');
    out.itemActive=ga&&{name:ga.name,type:ga.type,hasParams:!!ga.params};
    CUR={mode:'campaign',node:1,cwaves:null}; G.stamina=99;
    startBattle();
    const u=units.find(x=>x.key==='vael'&&x.team==='ally');
    const foe0=units.filter(x=>x.team==='enemy')[0]; const hp0=foe0?foe0.hp:0;
    if(u&&u.gearSkill){ castGearSkill(u); out.gearFired=u.gearSkill.used; out.stun=foe0?+(foe0.stunned||0).toFixed(2):null; out.dmgDone=foe0?Math.round(hp0-foe0.hp):null; }
    ended=true; clearBattle();
    // STAR STEP via server
    const fr=await api('/api/tx/earn','POST',{what:'frag',amount:3,reason:'quest',heroKey:'vael',requestId:uid8()});
    if(fr&&fr.ok) adoptLedger(fr.ledger);
    const before={s:G.starLevel.vael,p:G.starPip.vael,f:G.heroFrag.vael};
    const ssr=await api('/api/hero/star-step','POST',{heroKey:'vael',requestId:uid8()});
    if(ssr&&ssr.ok) adoptLedger(ssr.ledger);
    out.starStep={ok:!!(ssr&&ssr.ok), before, after:{s:G.starLevel.vael,p:G.starPip.vael,f:G.heroFrag.vael}};
    return out;
  });
  ck('ledger adopted at boot', r.ledgerAdopted);
  ck('admin grant reflected in mirror', r.goldAfterGrant>r.gold0);
  ck('campaign server start + authored waves ('+r.campWaves+')', r.campStart && r.campWaves>=2);
  ck('battle spawned the AUTHORED lineup ['+(r.enemyKeys||[]).join(',')+']', r.spawnedFromAuthored);
  ck('server-resolved campaign (won='+r.resolveWon+', +'+r.rewardGold+'g)', r.resolve && r.resolveWon===true && r.rewardGold>0);
  ck('gold banked on the ledger', r.goldAfterWin>r.goldAfterGrant);
  ck('server wish returned a result', r.wish);
  ck('ITEM-specific active loaded ('+(r.itemActive&&r.itemActive.name)+' / '+(r.itemActive&&r.itemActive.type)+')', r.itemActive && r.itemActive.type==='stun' && r.itemActive.hasParams);
  ck('gear skill fired: damage+stun ('+r.dmgDone+' dmg, '+r.stun+'s)', r.gearFired && r.dmgDone>0 && r.stun>=0.7);
  ck('star step server-side (pips '+(r.starStep&&r.starStep.before.p)+'→'+(r.starStep&&r.starStep.after.p)+')', r.starStep&&r.starStep.ok&&r.starStep.after.p===(r.starStep.before.p||0)+1);
  console.log('page errors:',JSON.stringify(errs.filter(e=>!e.includes('ServiceWorker'))));
  await b.close();
  console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
})().catch(e=>{ console.log('FAIL: '+e.message); process.exit(1); });
