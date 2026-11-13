// Grok bug hunt (Starless Well): on phone / Fold screens the hero cards, blessings and sweep buttons sat on top of the map squares you must tap next.
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
  const env={...process.env,DATABASE_URL:'',DB_STORE:'',SIM_WORKERS:'0',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'inherit',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'tr'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'inherit',windowsHide:true}); await up();
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


(async()=>{
  try {
    const {page}=await boot();
    await page.evaluate(()=>{show('home');openWell();});
    await page.waitForSelector('#wlMap .wlSq',{timeout:20000});
    for(const [width,height] of [[844,390],[390,844],[1440,900]]){
      await page.setViewportSize({width,height});
      const result=await page.evaluate(()=>{
        G.unlocked.vael=true;
        const owned=HERO_KEYS.filter(k=>G.unlocked[k]);
        const loan=HERO_KEYS.find(k=>!G.unlocked[k]);
        const S={...WELL.state,heroes:{},buffs:[],offer:null,portals:null};
        wellDraw(S);
        const before=!!document.querySelector('.wlHeroesB');
        const values={hpFrac:.57,energy:42,dead:false};
        const cls=WELL_CLASS_OF[HERO_TYPES[loan].role]||'Bruiser';
        const base=heroPower(loan);
        const afterBoon=wellHeroPower(loan,{buffs:[{cls,hp:.08,atk:.08,def:.08}]});
        wellDraw({...S,heroes:{[loan]:values},buffs:[{cls,label:'+8% stats',hp:.08,atk:.08,def:.08}]});
        document.querySelector('.wlHeroesB').click();
        const cards=[...document.querySelectorAll('#heroList .wlHeroCard')];
        const card=cards.find(e=>e.dataset.heroKey===loan);
        const match=cards.length===owned.length+1&&owned.every(k=>cards.some(e=>e.dataset.heroKey===k));
        const bars=card?.querySelector('.wlBarHp span').textContent==='57%'&&card?.querySelector('.wlBarEn span').textContent.trim()==='42';
        closePopout();
        const map=document.querySelector('#wlMap');
        const b=map.querySelector('.wlBoonsB'),pop=map.querySelector('.wlBoonsPop');
        b.click();b.click();const opened=!pop.hidden;
        pop.querySelector('.wlBoonsX').click();
        const bounds=[map.querySelector('.wlHeroesB'),b].map(e=>e.getBoundingClientRect());
        const visible=bounds.every(r=>r.width>0&&r.height>0&&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1);
        return {before,match,bars,boon:afterBoon>base&&heroPower(loan)===base,returnToWell:!!map&&map.isConnected&&!WELL_HEROVIEW,boons:opened&&pop.hidden,visible};
      });
      for(const [name,pass] of Object.entries(result))ok(pass,width+'x'+height+' '+name);
    }
  } catch(e){console.error(e);fails++;}
  finally{if(browser)await browser.close();if(child)child.kill();console.log(checks-fails+'/'+checks+' passed');process.exitCode=fails?1:0;}
})();

