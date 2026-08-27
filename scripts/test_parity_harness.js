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
    // ---- v232: GLYPH BOARD parity — a real locked six-slot board on the same hero ----
    let gstate=await api('/api/glyphs/state');
    for(let sl=0; sl<6; sl++){
      const so=await api('/api/glyphs/slot-options?heroKey=vael&slot='+sl);
      if(so.filled) continue;
      const o=so.options[0];
      for(const m of o.materials){ const parts=m.key.split(' '); const fam=parts.pop(); const q=parts.join(' ');
        gstate=await api('/api/glyphs/state');
        await api('/api/glyphs/grant','POST',{expectedRevision:gstate.revision,quality:q,family:fam,n:Math.max(1,m.need-m.have)});
      }
      gstate=await api('/api/glyphs/state');
      await api('/api/glyphs/build-in-slot','POST',{heroKey:'vael',slot:sl,blueprintId:o.blueprintId,expectedRevision:gstate.revision,requestId:'parity'+sl});
    }
    await glyphV2Sync(); await forgeSync();
    const soN=await api('/api/glyphs/slot-options?heroKey=sylthaine&slot=2');
    const bd=g2board('vael');
    const tot2=sockStatTotal('vael');
    const exp2={ dr:Math.min(0.6,((tot2.armor||0)+(tot2.mr||0))*0.004),
      crit:Math.min(0.6,(tot2.crit||0)*0.005), critRes:Math.min(0.75,(tot2.critRes||0)*0.005),
      energyReg:(tot2.energy||0)*0.01, regen:(tot2.regen||0)*0.001 };
    const snap2=(await api('/api/admin/snapshot?hero=vael')).snapshot;
    // CLIENT-side displayed HP/ATK exactly as makeUnit computes them (v232: NO rank multipliers)
    const mm=heroMuls('vael'); const ht=HERO_TYPES['vael']; const lvl=heroLevel('vael');
    const scale=1+0.05*(lvl-1); const sm=starMult('vael');
    const expHp=ht.hp*scale*mm.hp*sm + heroFlatHp('vael')+techTotal('hp');
    const expAtk=ht.dmg*scale*mm.atk*sm + heroFlatAtk('vael')+techTotal('atk');
    return {tot,exp,snap,clientSkillSlot:gs&&gs.slot,
      board6:bd.slots.every(x=>x&&x.locked), oneOption:(soN.options||[]).length===1,
      exp2, snap2, expHp, expAtk};
  });
  const near=(a,b,tol)=>Math.abs((a||0)-(b||0))<=(tol||0.011);
  ck('server dr == client conversion ('+r.snap.dr.toFixed(4)+' vs '+r.exp.dr.toFixed(4)+')', near(r.snap.dr,r.exp.dr));
  ck('server crit == client conversion', near(r.snap.crit,r.exp.crit));
  ck('server critRes == client conversion', near(r.snap.critRes,r.exp.critRes));
  ck('server energyReg == client conversion', near(r.snap.energyReg,r.exp.energyReg));
  ck('server regen == client conversion', near(r.snap.regen,r.exp.regen,0.002));
  ck('server carries the selected Gear Skill slot ('+r.snap.gearSkillSlot+')', r.snap.gearSkillSlot===r.clientSkillSlot && !!r.snap.gearSkillSlot);
  ck('vael has no base armor → dr from gear only', r.snap.dr>0);
  // v232 glyph-board parity: only locked board stats grant power, identically on both sides
  ck('six-slot board locked for parity test', r.board6);
  ck('slot-options returns ONE pre-chosen glyph', r.oneOption);
  const nearPct=(a2,b2,p)=>Math.abs((a2||0)-(b2||0))<=Math.max(1,(b2||0)*p);
  ck('server maxHp == client displayed HP ('+Math.round(r.snap2.maxHp)+' vs '+Math.round(r.expHp)+')', nearPct(r.snap2.maxHp,r.expHp,0.02));
  ck('server atk == client displayed ATK ('+Math.round(r.snap2.atk)+' vs '+Math.round(r.expAtk)+')', nearPct(r.snap2.atk,r.expAtk,0.02));
  ck('server dr (board+gear) == client conversion', near(r.snap2.dr,r.exp2.dr));
  ck('server crit (board+gear) == client conversion', near(r.snap2.crit,r.exp2.crit));
  ck('server energyReg (board+gear) == client conversion', near(r.snap2.energyReg,r.exp2.energyReg));
  ck('server regen (board+gear) == client conversion', near(r.snap2.regen,r.exp2.regen,0.002));
  await b.close();
  console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
})().catch(e=>{ console.log('FAIL: '+e.message); process.exit(1); });
