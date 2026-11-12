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

const OUT=process.env.SHOTS||temp;
(async()=>{
  try {
    const {page,errs}=await boot();
    const heroes=['vael','sylthaine','vireo','tick','fritz'];
    await page.evaluate(async(h)=>{ await api('/api/admin/led-grant','POST',{unlock:h}); await ledgerSync(); G.team=h.slice(); },heroes);
    const B=n=>Array.from({length:n},(_,i)=>({label:['+10% HP (All)','+15% ATK (Bruiser)','+10% DEF (Mage)','+20% ATK (Ranger)','+10% HP (Support)','+12% ATK (All)'][i%6]}));
    const H=(dead)=>Object.fromEntries(heroes.map((k,i)=>[k,{hpFrac:[1,.6,.35,.8,.5][i],energy:[60,10,40,100,0][i],dead:dead&&i===2}]));
    const STATES=[
      ['start-with-sweeps',{pos:{col:0,row:1},heroes:{},buffs:[],canSweep:true,cleared:{normal:1,hard:1},hardOpen:true,endXP:{normal:123456,hard:246912}}],
      ['after-fight-1-middle',{pos:{col:1,row:1},heroes:H(false),buffs:B(1),canSweep:false}],
      ['after-fight-1-top',{pos:{col:1,row:0},heroes:H(false),buffs:B(1),canSweep:false}],
      ['after-fight-1-bottom',{pos:{col:1,row:2},heroes:H(false),buffs:B(1),canSweep:false}],
      ['map-3-one-fallen',{pos:{col:3,row:2},heroes:H(true),buffs:B(9),resUsed:1,resCost:50,canSweep:false}],
      ['map-3-late',{pos:{col:4,row:1},heroes:H(true),buffs:B(11),resUsed:1,resCost:50,canSweep:false}],
    ];
    for(const [w,h] of [[844,390],[882,344],[1440,800]]){
      const tag=w+'x'+h; await page.setViewportSize({width:w,height:h}); await delay(1200);
      await page.evaluate(()=>{ show('home'); openWell(); }); await page.waitForSelector('#wlMap .wlSq',{timeout:20000}); await delay(900);
      const base=await page.evaluate(()=>JSON.stringify(WELL.state));
      for(const [nm,over] of STATES){
        const res=await page.evaluate(([base,over])=>{ const S=Object.assign(JSON.parse(base),over,{offer:null,portals:null,done:false}); wellDraw(S);
          const vw=innerWidth,vh=innerHeight,bad=[],R=e=>e.getBoundingClientRect();
          const inside=(el,x,y)=>{ const e=document.elementFromPoint(x,y); return !!e&&(e===el||el.contains(e)); };
          const reach=[...document.querySelectorAll('#wlMap .wlSq')].filter(s=>+s.dataset.c>S.pos.col);   /* every square still ahead: the next step and the route you plan */
          for(const s of reach){ const r=R(s), id='c'+s.dataset.c+'r'+s.dataset.r, pts=[[r.left+r.width/2,r.top+r.height/2,'centre']]; const pz=s.querySelector('.wlPz'); if(pz){ const q=R(pz); pts.push([q.left+q.width/2,q.top+q.height/2,'prize']); }
            { let cov=0,tot=0; for(let i=0;i<5;i++) for(let j=0;j<5;j++){ const x=r.left+r.width*(0.15+0.175*i), y=r.top+r.height*(0.15+0.175*j); tot++; if(x<0||y<0||x>=vw||y>=vh||!inside(s,x,y)) cov++; } if(cov/tot>0.2) bad.push(id+' '+Math.round(100*cov/tot)+'% hidden'); }
            for(const [x,y,what] of pts){ if(x<0||y<0||x>vw||y>vh){ bad.push(id+' '+what+' off screen'); continue; } if(!inside(s,x,y)){ const e=document.elementFromPoint(x,y); bad.push(id+' '+what+' covered by '+((e&&e.closest('.wlHero,.wlBuff,.wlSweep,.wlRes,.wlTtl,.wlStrip,.wlBuffs,.wlSweeps'))||e||{className:'?'}).className); } } }
          for(const el of document.querySelectorAll('#wlMap .wlRes,#wlMap .wlSweep,#wlMap .wlBackB')){ const r=R(el); if(!inside(el,r.left+r.width/2,r.top+r.height/2)) bad.push('button '+el.className+' not tappable'); }
          for(const el of document.querySelectorAll('#wlMap .wlHero,#wlMap .wlSweep,#wlMap .wlRes')){ const r=R(el); if(r.left<-.5||r.top<-.5||r.right>vw+.5||r.bottom>vh+.5) bad.push('off screen '+el.className); }
          return {n:reach.length,bad}; },[base,over]);
        ok(res.n>0&&res.bad.length===0,tag+' '+nm+': '+res.n+' squares ahead, at least 80% visible, centre and prize tappable'+(res.bad.length?' -- '+[...new Set(res.bad)].join('; '):''));
        await page.screenshot({path:path.join(OUT,'well_'+nm+'_'+tag+'.png')});
      }
      await page.evaluate(()=>{ const o=document.getElementById('wlMap'); if(o) o.remove(); });
    }
    ok(errs.length===0,'no page errors '+errs.join(' | '));
  } catch(error){console.error(error);fails++;}
  finally{ if(browser)await browser.close(); if(child)child.kill(); console.log('Well HUD vs squares: '+(checks-fails)+'/'+checks+' checks passed'); process.exitCode=fails?1:0; }
})();