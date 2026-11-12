// v1376 Dandra rework (Phil 12 Nov): Seedlight 10%->30% max HP + 30% AP + 50% Healing Power flat, heal-over-time = half; Drowsy Sting slows attack + cast 20%->35%; Swarm 5 s; Queen's Call 5%->15% + 30% AP + 50% HP, energy 20->35, attack+cast speed +5%->+20%. CONTROL: EW_ROOT=<0de81e0f copy> must FAIL.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-tr1364-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
/* a throwaway server + an admin account signed in past the tutorial (the same boot the night smoke used) */
async function boot(o){ o=o||{}; const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'tr'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  if(o.grant!==false) await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  const ctx=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await delay(500); return {page,errs,base}; }
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
(async()=>{ try{
  const {page,errs}=await boot({grant:false});
  const r=await page.evaluate(()=>{ const out={}; const K=KITS.dandra;
    const setup=(lv)=>{ const D=makeUnit('dandra','ally',100,300,30,{owned:false,rank:5}); D.skillLv=[lv,lv,lv,lv]; D.apow=1000; D.healPowMul=1+2000*0.0005;   /* 2000 Healing Power */
      const A=makeUnit('vael','ally',160,300,30,{owned:false,rank:1}); A.maxHp=10000; A.hp=1; A.hots=[];
      const E=makeUnit('vael','enemy',500,300,30,{owned:false,rank:1}); E.hasteMul=1; E.castMul=1;
      units.length=0; units.push(D,A,E); battleTime=10; D._castLv=lv; D._castSM=skillMul(lv); return {D,A,E}; };
    for(const lv of [1,100]){ const o={};
      let {D,A,E}=setup(lv); D.target=E;
      doEffect(D,'mendburst',K.green); o.direct=Math.round(A.hp-1); const h=A.hots[A.hots.length-1]; o.hotTotal=h?Math.round(h.hps*h.remaining):0;
      ({D,A,E}=setup(lv)); D.target=E; doEffect(D,'drowsy',Object.assign({},K.blue,{_tgtU:E,_arrived:true})); o.atkSlow=+(1-E.hasteMul).toFixed(4); o.castSlow=+(1-(E.castMul||1)).toFixed(4);
      ({D,A,E}=setup(lv)); A.energy=0; A.hp=1; doEffect(D,'rally',{}); o.ultHeal=Math.round(A.hp-1); o.ultEnergy=A.energy; o.ultHaste=+(A.hasteMul-1).toFixed(4); o.ultCast=+((A.castMul||1)-1).toFixed(4);
      out['L'+lv]=o; }
    /* swarm spread = 5 s */
    { const D=makeUnit('dandra','ally',100,300,30,{owned:false,rank:5}); D.pass=Object.assign({},D.pass||{},{contagion:true}); D.skillLv=[1,1,1,1];
      const A=makeUnit('vael','enemy',400,300,30,{owned:false,rank:1}), B=makeUnit('vael','enemy',400+METER,300,30,{owned:false,rank:1});
      units.length=0; units.push(D,A,B); battleTime=10; A.dots=[{color:'#f2d84a',dps:5,t:4,src:D}]; A._contagion=true; A._plagueColor='#f2d84a'; damage(A,1e9,'#fff'); out.swarm=+((B._beeCutUntil||0)-battleTime).toFixed(2); }
    /* cast speed speeds the cast clip (Phil: "Cast speed just like attack speed should speed up the animation of the hero") */
    { const _k=Object.keys(BATTLE_ANIM).find(k=>HERO_TYPES[k]&&!HERO_TYPES[k].monster&&BATTLE_ANIM[k].green&&BATTLE_ANIM[k].green.n>1&&!BATTLE_ANIM[k].green.pingpong); const V=makeUnit(_k,'ally',100,300,30,{owned:false,rank:5}); V.anim=V.anim||BATTLE_ANIM[_k]; units.length=0; units.push(V); battleTime=20;
      V._castSlot='green'; startAbilityClip(V,'mendburst'); const h0=V._abilHold, s0=V._abilAnim;
      V._abilAnim=null; V._abilHold=0; V.castMul=1.2; V.castT=5; startAbilityClip(V,'mendburst'); out.castClip={st:s0, h0:+(h0||0).toFixed(3), h1:+(V._abilHold||0).toFixed(3), m:V._castSpdMul}; }
    out.readG=stripIcons(_skillEffectStrRaw('dandra',1,100,1000)); out.readU=stripIcons(_skillEffectStrRaw('dandra',0,100,1000)); return out; });
  console.log(JSON.stringify(r));
  const exp=(pct)=>Math.round(10000*pct+0.30*1000+0.50*2000);
  ok(r.L1.direct===exp(0.10)&&r.L100.direct===exp(0.30), 'Seedlight = 10% -> 30% of the ally max HP + 30% AP + 50% Healing Power (L1 '+r.L1.direct+' / '+exp(0.10)+', L100 '+r.L100.direct+' / '+exp(0.30)+')');
  ok(Math.abs(r.L1.hotTotal-r.L1.direct/2)<=3&&Math.abs(r.L100.hotTotal-r.L100.direct/2)<=3, 'its heal-over-time totals half the direct heal (L1 '+r.L1.hotTotal+', L100 '+r.L100.hotTotal+')');
  ok(Math.abs(r.L1.atkSlow-0.20)<0.001&&Math.abs(r.L100.atkSlow-0.35)<0.001&&Math.abs(r.L1.castSlow-0.20)<0.001&&Math.abs(r.L100.castSlow-0.35)<0.001, 'Drowsy Sting slows attack AND cast speed 20% -> 35% ('+r.L1.atkSlow+'/'+r.L1.castSlow+' -> '+r.L100.atkSlow+'/'+r.L100.castSlow+')');
  ok(r.swarm===5, 'The Swarm Moves On spread lasts 5 s ('+r.swarm+')');
  ok(r.L1.ultHeal===exp(0.05)&&r.L100.ultHeal===exp(0.15), "Queen's Call heal = 5% -> 15% max HP + 30% AP + 50% Healing Power (L1 "+r.L1.ultHeal+', L100 '+r.L100.ultHeal+')');
  ok(r.L1.ultEnergy===20&&r.L100.ultEnergy===35, "Queen's Call energy 20 -> 35 ("+r.L1.ultEnergy+' -> '+r.L100.ultEnergy+')');
  ok(Math.abs(r.L1.ultHaste-0.05)<0.001&&Math.abs(r.L100.ultHaste-0.20)<0.001&&Math.abs(r.L1.ultCast-0.05)<0.001&&Math.abs(r.L100.ultCast-0.20)<0.001, "Queen's Call attack + cast speed +5% -> +20% ("+r.L1.ultHaste+' -> '+r.L100.ultHaste+')');
  ok(/max HP \+ 30% Ability Power \+ 50% Healing Power/.test(r.readG)&&/energy/.test(r.readU), 'the Skills tab shows the new numbers ('+r.readG+' | '+r.readU+')');
  ok(r.castClip&&r.castClip.h0>0&&Math.abs(r.castClip.h1-r.castClip.h0/1.2)<0.01&&r.castClip.m===1.2, 'a +20% cast speed plays the skill clip 1.2x faster ('+JSON.stringify(r.castClip)+')');
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('dandra rework'); await cleanup(); } })();
