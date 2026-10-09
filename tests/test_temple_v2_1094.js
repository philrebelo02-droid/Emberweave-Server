// v1094 - TEMPLE OF ASH v2 (Phil 9 Oct 2026: "copy their prayer system verbatim but use our names"; Open Projects/The Temple of Ash/
// TEMPLE OF ASH v2 - the reference copied (09OCT2026).md). Four flat-stat bars in STEPS (health / attack / armor & MR / penetration),
// the cap by Temple level, every bar rolls on every prayer, pay on pray / Save applies / Cancel never refunds, power = 10 x net steps,
// blessings (dots) at their step thresholds, AUTO PRAY at Temple 12 (saves only gains), the 10 % tier discounts, keeper points per tier,
// migration of the old bar points, and CLIENT/SERVER PARITY: the same Temple steps give the same numbers in the server's combat unit and
// in the client battle unit built from the server-frozen spec (the engine the server replays with).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-v1094 server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-t1094-'));
const dbFile=path.join(dir,'db.json');
const T=require('../server/temple-of-ash.js'), FX=require('../server/temple-effects.js'), SIM=require('../server/sim.js');
let port,base,child,token,id,pass=0,missed=[],admin=false;
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:admin?id:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
let rq=0; const R=()=>'t'+(rq++);
const BARS=['health','attack','armorMr','pen'];
const PHYS='vael', MAG='sylthaine';   // Tank / Attack and Mage / Magic; neither has a build-time attack passive
/* v1098: every hero rolls ITS OWN four bars (HERO_BARS) - Vael: Health / Crit chance / Attack speed / Lifesteal */
const VB=T.heroBars(PHYS), MB=T.heroBars(MAG);
const stepOf=(key,b)=>T.stepValue(SIM.HERO_BASE[key].damageProfile,b);
const levelPoints=lv=>{ let s=0; for(let i=0;i<lv;i++) s+=T.FLAMEKEEPER_TRACK[i].exp; return s; };
const steps=(h,a,m,p)=>({health:h,attack:a,armorMr:m,pen:p});
const setHero=(key,st,lit)=>editDB(u=>{ u.led.temple.heroes[key]={steps:st,boonsUnlocked:lit||[false,false,false,false,false]}; u.led.temple._pending=null; });

(async()=>{ try{
  /* ---- the module's numbers are the spec's ---- */
  const C=T.CONFIG;
  ok(JSON.stringify(C.STEP.magic)===JSON.stringify({health:25,attack:3.2,armorMr:4.8,pen:7.2})&&JSON.stringify(C.STEP.physical)===JSON.stringify({health:35,attack:2.4,armorMr:7.2,pen:4.8}),'step sizes are the spec\'s "Ours" table (magic 25/3.2/4.8/7.2, physical 35/2.4/7.2/4.8)');
  ok([[1,40],[4,40],[5,75],[8,75],[9,110],[12,110],[13,140],[15,140],[16,170],[18,170],[19,200],[40,200]].every(([l,c])=>T.capSteps(l)===c),'the cap in steps by Temple level: 40 / 75 / 110 / 140 / 170 / 200 at 1 / 5 / 9 / 13 / 16 / 19');
  ok(T.profileOf('Magic')==='magic'&&T.profileOf('Healer')==='magic'&&T.profileOf('Attack')==='physical'&&T.profileOf('Hybrid')==='hybrid','damage type -> step profile (Magic/Healer magic, Attack physical, Hybrid both)');
  ok(T.heroCompletion({steps:steps(40,20,0,20)},1)===0.75&&T.heroCompletion({steps:steps(40,20,0,20)},19)===0.1,'completion = sum of the OPEN bar steps / (open bars x cap) (v1098: bars 3-4 open at Temple 7 / 11)');
  { const full=T.heroBonuses({steps:steps(200,200,200,200),boonsUnlocked:[]},'Bruiser','Attack');
    ok(full.hpFlat===7000&&full.adFlat===480&&full.armorFlat===1440&&full.mrFlat===1440&&full.armorPenFlat===960&&full.magicPenFlat===960&&!full.apFlat,'a full physical hero: +7,000 health / +480 Attack damage / +1,440 armor and MR / +960 both pens (spec §2)');
    const mag=T.heroBonuses({steps:steps(0,100,0,0),boonsUnlocked:[]},'Mage','Magic');
    ok(mag.apFlat===320&&!mag.adFlat,'a magic hero\'s Attack bar is Ability power');
    const five=T.heroBonuses({steps:steps(200,0,0,0),boonsUnlocked:[false,false,false,false,true]},'Bruiser','Attack');
    ok(five.hpFlat===7000,'the 5th dot never touches the bars: a 200-step health bar stays +7,000 (Phil 9 Oct: 15% of BONUS stats only)'); }
  { const st=T.newState(); st.playerLevel=100; st.keeperPoints=levelPoints(19); st.heroes.h={steps:steps(200,200,200,200),boonsUnlocked:[]};
    let a=11; T.setRng(()=>{ a=(a*16807)%2147483647; return a/2147483647; });
    let drops=0,n=0; for(let i=0;i<400;i++){ const s=T.pray(st,'h','gold',{profile:'Attack'}); for(const b of BARS){ n++; if(s.rolls[b].deltaSteps<0) drops++; } T.discardSession(st); }
    ok(drops/n>0.5,'past a tier\'s reach the pressure turns gains into drops (Gold ritual at the cap: '+Math.round(100*drops/n)+' % of bars go down)');
    st.heroes.h.steps=steps(0,0,0,0); drops=0; n=0;
    for(let i=0;i<400;i++){ const s=T.pray(st,'h','kindled',{profile:'Attack'}); for(const b of BARS){ n++; if(s.rolls[b].deltaSteps<0) drops++; } T.discardSession(st); }
    ok(drops===0,'control: a fresh hero on Kindled never goes down (the measured table has no negative roll)'); }

  /* ---- live server ---- */
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'t1094-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  await stop(); admin=true; await start();
  const grant=await call('/api/admin/led-grant',{px:99000000,gold:90000000,gems:900000,maxGlyphs:true,unlock:[PHYS,MAG],heroKeys:[PHYS,MAG],heroXp:99000000});
  ok(grant.data.ok!==false&&grant.data.ledger&&grant.data.ledger.playerLevel>=70,'fixture: player level '+(grant.data.ledger&&grant.data.ledger.playerLevel)+', two Orange heroes, gold and diamonds');

  let L=await led();
  const g0=L.gold;
  const p1=await call('/api/temple/pray',{heroKey:PHYS,tier:'gold',requestId:R()});
  const rolls=p1.data.rolls||{};
  ok(p1.data.ok===true&&Object.keys(rolls).join()===VB.join(),'one prayer rolls all four of Vael\'s own bars, in order: '+Object.keys(rolls).join(', '));
  ok(VB.every(b=>{ const x=rolls[b]; return x&&x.toSteps===x.fromSteps+x.deltaSteps&&Math.abs(x.toValue-x.toSteps*stepOf(PHYS,b))<1e-6&&Math.abs(x.deltaValue-x.deltaSteps*stepOf(PHYS,b))<1e-6; }),
    'each bar answers from / delta / to in steps and in real stat values ('+VB.map(b=>b+' '+(rolls[b]&&rolls[b].deltaSteps)).join(' ')+')');
  const net1=VB.reduce((a,b)=>a+rolls[b].deltaSteps,0);
  ok(p1.data.power===10*net1,'power = 10 x net steps ('+p1.data.power+' for '+net1+')');
  ok(p1.data.ledger.gold===g0-C.GOLD_LADDER[0],'the Gold ritual is paid on pray ('+(g0-p1.data.ledger.gold)+')');
  const d1=await call('/api/temple/discard',{requestId:R()}); L=await led();
  ok(d1.data.ok===true&&L.gold===g0-C.GOLD_LADDER[0],'Cancel never refunds');
  ok(VB.every(b=>((L.temple.heroes[PHYS].steps||{})[b]|0)===0)&&L.temple.heroes[PHYS].bars.join()===VB.join(),'Cancel applies nothing (the hero is stored on its own four bars)');
  let saved=null;
  for(let i=0;i<6&&!saved;i++){ const p=await call('/api/temple/pray',{heroKey:PHYS,tier:'gold',requestId:R()});
    const s=await call('/api/temple/save',{requestId:R()});
    if(VB.some(b=>p.data.rolls[b].toSteps>0)) saved={p:p.data,s:s.data}; }
  ok(saved&&VB.every(b=>saved.s.ledger.temple.heroes[PHYS].steps[b]===saved.p.rolls[b].toSteps),'Save applies every bar\'s rolled steps');
  ok(saved&&saved.s.power===saved.p.power,'Save answers the prayer\'s power');

  /* cap by Temple level: at Temple 1 nothing passes 40 steps */
  await setHero(PHYS,steps(40,39,40,38));
  await editDB(u=>{ u.led.temple.keeperPoints=0; u.led.temple.levelSeen=1; });
  let maxSeen=0;
  for(let i=0;i<8;i++){ const p=await call('/api/temple/pray',{heroKey:PHYS,tier:'gold',requestId:R()}); await call('/api/temple/save',{requestId:R()});
    for(const b of VB) maxSeen=Math.max(maxSeen,p.data.rolls[b].toSteps); if(i===0) ok(p.data.cap===40,'the prayer reports the Temple 1 cap (40)'); }
  L=await led();
  ok(maxSeen<=40&&VB.every(b=>L.temple.heroes[PHYS].steps[b]<=40),'no bar passes the Temple 1 cap of 40 steps (highest '+maxSeen+')');

  /* blessings: Temple 5, hero level 60+: dot 1 (bar 1 >= 20) and dot 2 (bar 2 >= 50) light; dot 3 needs Temple 13. v1098: the v1096-keyed
     fixture (health 25 / attack 60 / armorMr 70 / pen 10) moves positionally onto Vael's own bars (Health 25 / Crit chance 60 / ...) */
  await setHero(PHYS,steps(25,60,70,10));
  await editDB(u=>{ u.led.temple.keeperPoints=levelPoints(5); u.led.temple.levelSeen=5; });
  L=await led(); ok(L.temple.level===5,'the ledger reports Temple level 5');
  await call('/api/temple/pray',{heroKey:PHYS,tier:'gold',requestId:R()});
  const sv=await call('/api/temple/save',{requestId:R()});
  const lit=sv.data.ledger.temple.heroes[PHYS].boonsUnlocked;
  ok(sv.data.unlocked.includes(1)&&sv.data.unlocked.includes(2)&&lit[0]&&lit[1],'blessings 1 and 2 light at bar 1 (Health) 20 / bar 2 (Crit chance) 50 steps ('+JSON.stringify(sv.data.unlocked)+')');
  ok(!lit[2]&&!lit[3]&&!lit[4],'control: blessing 3 stays dark below Temple 13 and its 130 steps on bar 3 (Attack speed)');
  { const b=T.heroBonuses(sv.data.ledger.temple.heroes[PHYS],'Tank','Attack',PHYS), s=sv.data.ledger.temple.heroes[PHYS].steps;
    ok(b.hpFlat===s.health*35+320&&Math.abs(b['crit chance']-(s.critChance*0.0003+0.03))<1e-9,'v1096/v1098: Vael\'s OWN earned dots add Health +320 and Crit chance +3% on top of his Health and Crit chance bars ('+b.hpFlat+', '+b['crit chance']+')'); }

  /* auto pray: closed below Temple 12, open at 12; saves only prayers whose power goes up */
  await setHero(PHYS,steps(10,10,10,10));
  const shut=await call('/api/temple/auto',{heroKey:PHYS,tier:'gold',count:5,requestId:R()});
  ok(shut.data.ok===false&&/12/.test(shut.data.error||''),'auto pray is closed below Temple 12 ('+(shut.data.error||'')+')');
  await editDB(u=>{ u.led.temple.keeperPoints=levelPoints(12); u.led.temple.levelSeen=12; u.led.temple.goldLadderStep=0; u.led.temple.freeRitualDay=null; });
  L=await led(); const before=L.temple.heroes[PHYS].steps, gB=L.gold, ladder=L.temple.goldLadderStep|0;
  ok(L.temple.level===12,'Temple level 12');
  const big=await call('/api/temple/auto',{heroKey:PHYS,tier:'gold',count:11,requestId:R()});
  ok(big.data.ok===false,'auto pray runs at most 10');
  const ridA=R(), auto=await call('/api/temple/auto',{heroKey:PHYS,tier:'gold',count:10,requestId:ridA});
  const A=auto.data;
  ok(A.ok===true&&A.ran===10&&A.saved+A.cancelled===10,'auto pray ran 10 ('+A.saved+' saved, '+A.cancelled+' cancelled)');
  ok(A.results.every(x=>x.saved===(x.power>0)),'every prayer with power > 0 was saved and every other one cancelled');
  ok(A.results.every(x=>Object.keys(x.rolls).length===4),'every auto prayer rolled all four bars');
  ok(VB.every(b=>A.results.some(x=>x.rolls[b].deltaSteps!==0)),'each bar moved at least once across the run');
  const lastSaved=A.results.filter(x=>x.saved).pop();
  ok(VB.every(b=>A.after[b]===(lastSaved?lastSaved.rolls[b].toSteps:before[b])),'the hero ends on the last saved prayer\'s steps');
  ok(A.power===A.results.filter(x=>x.saved).reduce((a,x)=>a+x.power,0)&&A.power>0,'auto pray reports the saved power ('+A.power+')');
  let want=0; for(let i=0;i<10;i++) want+=Math.round(C.GOLD_LADDER[Math.min(ladder+i,C.GOLD_LADDER.length-1)]*0.9);
  L=await led();
  ok(A.cost.gold===want&&gB-L.gold===want,'each auto prayer is paid at the Gold ritual price less the Temple 6 discount ('+A.cost.gold+' = '+want+')');
  const again=await call('/api/temple/auto',{heroKey:PHYS,tier:'gold',count:10,requestId:ridA});
  ok(again.data.ledger&&again.data.ledger.rev===A.ledger.rev&&(await led()).gold===L.gold,'the same requestId runs the auto prayers once');

  /* discounts and keeper points: Kindled costs 45 at Temple 10+, a Kindled prayer earns 5 points */
  L=await led(); const gemB=L.gems, kpB=L.temple.keeperPoints;
  const kp=await call('/api/temple/pray',{heroKey:PHYS,tier:'kindled',requestId:R()}); await call('/api/temple/discard',{requestId:R()});
  ok(kp.data.ok===true&&gemB-kp.data.ledger.gems===45,'Kindled costs 45 diamonds after the Temple 10 discount');
  ok(kp.data.ledger.temple.keeperPoints-kpB===5,'a Kindled prayer earns 5 keeper points (not 5 + 1)');
  { const tiers=T.prayerTiers({keeperPoints:levelPoints(20),playerLevel:100});
    ok(tiers.map(t=>t.id==='gold'?t.gold:t.gems).join()==='900,45,90,180,360','at Temple 20 every tier is 10 % off (Gold ritual 900, 45/90/180/360 diamonds)'); }
  ok(T.bonusPrayerChance(7)===0.10&&T.bonusPrayerChance(8)===0.12&&T.bonusPrayerChance(11)===0.14&&T.bonusPrayerChance(15)===0.16,'the bonus-prayer chance rises at Temple 8 / 11 / 15');

  /* migration: old bar points -> steps by the same share of the old maximum; earned orbs stay */
  await editDB(u=>{ u.led.temple.keeperPoints=levelPoints(9); u.led.temple.levelSeen=9;
    u.led.temple.heroes[MAG]={cinders:{bar1:100,bar2:150,bar3:50,bar4:0},boonsUnlocked:[true,false,false,false,false]}; });
  L=await led(); const mh=L.temple.heroes[MAG], om=T.effectMax(9), cap9=T.capSteps(9);
  ok(mh&&mh.steps&&mh.steps[MB[0]]===Math.round(100/om*cap9)&&mh.steps[MB[1]]===Math.round(150/om*cap9)&&mh.steps[MB[2]]===Math.round(50/om*cap9)&&mh.steps[MB[3]]===0&&mh.bars.join()===MB.join(),
    'old bar points become steps by the same share, then land on Sylthaine\'s own bars in order (old max '+om+', cap '+cap9+': '+JSON.stringify(mh&&mh.steps)+')');
  ok(mh.boonsUnlocked[0]===true,'an earned old orb stays earned');

  /* CLIENT / SERVER PARITY: the same Temple steps, server combat unit vs the client battle unit from the server-frozen spec */
  const host=require('../server/sim-host.js').load(path.join(root,'emberweave-heroes.html'));
  for(const key of [PHYS,MAG]){
    await setHero(key,steps(0,0,0,0));
    const s0=(await call('/api/admin/snapshot?hero='+key)).data.snapshot, sp0=(await call('/api/admin/snapshot?hero='+key+'&spec=1')).data.spec;
    await setHero(key,steps(30,33,27,21));
    const s1=(await call('/api/admin/snapshot?hero='+key)).data.snapshot, sp1=(await call('/api/admin/snapshot?hero='+key+'&spec=1')).data.spec;
    const b=T.heroBonuses({steps:steps(30,33,27,21)},SIM.HERO_BASE[key].role,SIM.HERO_BASE[key].damageProfile,key);
    ok(JSON.stringify(sp1.templeBonuses)===JSON.stringify(b),key+': the frozen battle spec carries the Temple bonuses '+JSON.stringify(b));
    const c0=host.snapFromSpecs([sp0])[0], c1=host.snapFromSpecs([sp1])[0];
    const srv={hp:s1.maxHp-s0.maxHp, ad:s1.atkP-s0.atkP, ap:s1.atkM-s0.atkM, armor:s1.armor-s0.armor, mr:s1.mr-s0.mr, aPen:s1.armorPen-s0.armorPen, mPen:s1.magicPen-s0.magicPen};
    const cli={hp:c1.maxHp-c0.maxHp, ad:c1.dmg-c0.dmg, ap:c1.apow-c0.apow, armor:c1.armorRating-c0.armorRating, mr:c1.mrRating-c0.mrRating, aPen:c1.armorPen-c0.armorPen, mPen:c1.magicPen-c0.magicPen};
    const want={hp:b.hpFlat|0, ad:b.adFlat|0, ap:b.apFlat|0, armor:b.armorFlat|0, mr:b.mrFlat|0, aPen:b.armorPenFlat|0, mPen:b.magicPenFlat|0};
    const near=(x,y)=>Math.abs(x-y)<1e-6;
    ok(Object.keys(want).every(k=>near(srv[k],want[k])),key+': the server combat unit gains exactly the Temple flats '+JSON.stringify(srv));
    ok(Object.keys(want).every(k=>near(cli[k],want[k])),key+': the client battle unit gains exactly the same '+JSON.stringify(cli));
    ok(want.hp>0&&Object.keys(b).length>=3,key+': control - the fixture really carries Temple stats ('+Object.keys(b).join()+')');
  }

  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_temple_v2_1094.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.stack||e); process.exitCode=1; } finally { await stop(); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(_){} } })();
