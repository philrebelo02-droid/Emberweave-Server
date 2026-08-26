// CLIENT/SERVER parity harness (audit round 4, correction #7): builds a real gear loadout on a dev
// account, computes the CLIENT's rate->field conversions in the live page (sockStatTotal), fetches
// the SERVER's resolved snapshot (/api/admin/snapshot), and compares the shared combat fields
// (dr / crit / critRes / energyReg / regen + gearSkillSlot) — not sim.js against itself.
// Known, documented non-shared parts: client-only quality/prayer/tech multipliers on HP/ATK.
const { chromium } = require('playwright');
(async()=>{
  let pass=0,fail=0; const ck=(n,c,d)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+d:''))); };
  const b=await chromium.launch();
  const pg=await (await b.newContext({viewport:{width:1000,height:520}})).newPage();
  await pg.goto('http://localhost:8871/play',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2200);
  await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p)p.click(); });
  await pg.waitForTimeout(1000);
  const r=await pg.evaluate(async()=>{
    const lg=await api('/api/login','POST',{name:'dev1',pass:'password1'});
    ACC.token=lg.token; ACC.id=lg.profile.id; ACC.admin=lg.profile.admin;
    let st=await api('/api/gear/state'); let rv=st.revision;
    const g=await api('/api/gear/grant','POST',{expectedRevision:rv,frag:'E01',n:6,dust:9000}); rv=g.revision;
    const c1=await api('/api/gear/craft','POST',{expectedRevision:rv,gearId:'E01'}); rv=c1.revision;
    const eq=await api('/api/gear/equip','POST',{expectedRevision:rv,heroKey:'vael',itemId:c1.crafted}); rv=eq.revision;
    const tp=await api('/api/gear/temper','POST',{expectedRevision:rv,itemId:c1.crafted,uses:10}); rv=tp.revision;
    await api('/api/gear/select-active','POST',{expectedRevision:rv,heroKey:'vael',itemId:c1.crafted});
    await forgeSync(); await glyphV2Sync();
    // CLIENT-side expected fields from its own stat bundle + its own constants
    const tot=sockStatTotal('vael');
    const exp={ dr:Math.min(0.6,((tot.armor||0)+(tot.mr||0))*0.004),
      crit:Math.min(0.6,(tot.crit||0)*0.005), critRes:Math.min(0.75,(tot.critRes||0)*0.005),
      energyReg:(tot.energy||0)*0.01, regen:(tot.regen||0)*0.001 };
    const snap=(await api('/api/admin/snapshot?hero=vael')).snapshot;
    const gs=gearActiveFor('vael');
    return {tot,exp,snap,clientSkillSlot:gs&&gs.slot};
  });
  const near=(a,b,tol)=>Math.abs((a||0)-(b||0))<=(tol||0.011);
  ck('server dr == client conversion ('+r.snap.dr.toFixed(4)+' vs '+r.exp.dr.toFixed(4)+')', near(r.snap.dr,r.exp.dr));
  ck('server crit == client conversion', near(r.snap.crit,r.exp.crit));
  ck('server critRes == client conversion', near(r.snap.critRes,r.exp.critRes));
  ck('server energyReg == client conversion', near(r.snap.energyReg,r.exp.energyReg));
  ck('server regen == client conversion', near(r.snap.regen,r.exp.regen,0.002));
  ck('server carries the selected Gear Skill slot ('+r.snap.gearSkillSlot+')', r.snap.gearSkillSlot===r.clientSkillSlot && !!r.snap.gearSkillSlot);
  ck('vael has no base armor → dr from gear only', r.snap.dr>0);
  await b.close();
  console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
})().catch(e=>{ console.log('FAIL: '+e.message); process.exit(1); });
