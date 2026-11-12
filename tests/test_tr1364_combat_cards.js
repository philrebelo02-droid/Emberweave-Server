// Tester B 4.5 (11 Nov 2026, "Improve Hero Card Information in Combat"): each combat card (the portrait bar) shows the hero's HP as
// numbers, its class icon (the roster's class art, no emoji) and a lit gold border while the ultimate is ready.
// Real campaign fight on an emulated phone (844x390), Fold cover (882x344) and a PC (1440x800):
//   - the HP number reads hpFmt(hp)/hpFmt(maxHp) of the unit, and follows a hit;
//   - the class icon is assets/img/icons/ui/class-<role>-v1.webp for the hero's role, inside the portrait window;
//   - ready ult: the card gets .ready and its ::before border is drawn gold; under 30% hp the card is .ewcLow;
//   - the bar is no taller than before (85 px phone / 170 px PC) and the number is >= 9 px;
//   - per-frame cost: 120 updatePortraits() calls with no HP change write the DOM 0 times; one hit = one write.
// CONTROL: EW_ROOT=<c48bb4a3 copy> fails (no number, no class icon, no ::before border).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname,path.join(__dirname,'..')]}));
const delay=ms=>new Promise(r=>setTimeout(r,ms)); let child,browser,fails=0,checks=0;
const ok=(c,m)=>{ checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const SHOTS=process.env.SHOTS||'';
const VIEWS=[{id:'844x390',w:844,h:390,dpr:2.625,m:1,barH:85},{id:'882x344',w:882,h:344,dpr:2.625,m:1,barH:85},{id:'1440x800',w:1440,h:800,dpr:1,m:0,barH:170}];
(async()=>{ const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ccards-'));
  try{
    const port=await freePort(), base='http://127.0.0.1:'+port;
    const env={...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
    const up=async()=>{for(const t0=Date.now();Date.now()-t0<60000;){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
    child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
    const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
    const reg=await J('/api/register',{name:'cc'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
    await delay(700); child.kill(); await delay(900);
    child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
    await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
    browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
    for(const V of VIEWS){
      const UA='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
      const ctx=await browser.newContext(Object.assign({viewport:{width:V.w,height:V.h},deviceScaleFactor:V.dpr,serviceWorkers:'block'},V.m?{isMobile:true,hasTouch:true,userAgent:UA}:{}));
      const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
      await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
      await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
      await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
      for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
      await delay(900);
      await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated');
        await api('/api/admin/led-grant','POST',{unlock:Object.keys(HERO_TYPES).slice(0,20).concat(['vael','sylthaine','vireo','grosk','brannus']),campCleared:4}); await ledgerSync(); },L);
      const heroes=['vael','sylthaine','vireo','grosk','brannus'];
      const st=await page.evaluate(async(heroes)=>{ CUR={node:2,mode:'campaign',portal:'normal'};
        const s=await api('/api/campaign/start','POST',{mode:'normal',node:2,heroIds:heroes,requestId:'cc'+Date.now()}); if(!s||!s.ok) return 'start '+(s&&s.error);
        CUR.attemptId=s.attemptId; CUR.cwaves=(s.stage&&s.stage.waves)||null; CUR.serverSnaps=s.snaps; CUR.seed=s.seed>>>0; CUR.engine=s.engine; G.squads=G.squads||{}; G.squads.campaign=heroes.slice(); G.team=heroes.slice();
        startBattle(); for(let i=0;i<300&&!(state==='battle'&&units.some(u=>u.team==='enemy'&&u.alive)&&document.querySelectorAll('#portraitBar .pslot').length);i++) await new Promise(r=>setTimeout(r,100)); return state; },heroes);
      ok(st==='battle',V.id+' campaign fight started ('+st+')');
      await delay(2500); await page.evaluate(()=>{ paused=true; }); await delay(300);
      const C=await page.evaluate(()=>{ const al=units.filter(u=>u.team==='ally'&&u.slotEl&&HERO_TYPES[u.key]);
        return al.map(u=>{ const s=u.slotEl, n=s.querySelector('.ewcHpNum'), c=s.querySelector('.ewcCls img'), sr=s.getBoundingClientRect(), pr=u.portraitEl.getBoundingClientRect();
          const nr=n&&n.getBoundingClientRect(), cr=c&&c.getBoundingClientRect();
          return {key:u.key, role:HERO_TYPES[u.key].role, txt:n?n.textContent:null, want:hpFmt(Math.ceil(u.hp))+'/'+hpFmt(Math.ceil(u.maxHp)), fs:n?parseFloat(getComputedStyle(n).fontSize):0,
            nIn:!!nr&&nr.left>=sr.left-0.5&&nr.right<=sr.right+0.5&&nr.top>=sr.top-0.5&&nr.bottom<=sr.bottom+0.5,
            src:c?c.getAttribute('src'):null, cIn:!!cr&&cr.width>=8&&cr.left>=pr.left-0.5&&cr.right<=pr.right+0.5&&cr.top>=pr.top-0.5&&cr.bottom<=pr.bottom+0.5, cw:cr?cr.width:0 }; }); });
      ok(C.length>=3,V.id+' '+C.length+' hero cards');
      ok(C.every(c=>c.txt===c.want),V.id+' every card shows its HP as numbers ('+C.map(c=>c.key+' '+c.txt).join(', ')+')');
      ok(C.every(c=>c.nIn&&c.fs>=9),V.id+' the number sits inside its card at >= 9 px ('+(C[0]&&C[0].fs)+' px)');
      ok(C.every(c=>c.src&&c.src.indexOf('/icons/ui/class-'+String(c.role).toLowerCase()+'-v1.webp')>=0),V.id+' every card shows its class icon art ('+C.map(c=>c.role).join(', ')+')');
      ok(C.every(c=>c.cIn),V.id+' the class icon sits inside the portrait window ('+(C[0]&&C[0].cw.toFixed(1))+' px)');
      const bar=await page.evaluate(()=>document.getElementById('portraitBar').getBoundingClientRect().height);
      ok(bar<=V.barH+0.5,V.id+' the portrait bar is no taller than before ('+bar+' <= '+V.barH+')');
      /* DOM writes: none while nothing changes, one per changed number */
      const W=await page.evaluate(()=>{ const bar=document.getElementById('portraitBar'); let n=0; const mo=new MutationObserver(l=>{ n+=l.length; }); mo.observe(bar,{subtree:true,childList:true,characterData:true,attributes:true});
        for(let i=0;i<120;i++) updatePortraits(); const still=(mo.takeRecords().length)+n;
        const u=units.find(x=>x.team==='ally'&&x.alive&&x._hpNumEl); u.hp=Math.max(1,u.hp-7); updatePortraits(); updatePortraits(); const recs=mo.takeRecords(); mo.disconnect();
        return {still, hit:recs.filter(r=>r.target===u._hpNumEl).length, other:recs.filter(r=>r.target!==u._hpNumEl).length, txt:u._hpNumEl.textContent, want:hpFmt(Math.ceil(u.hp))+'/'+hpFmt(Math.ceil(u.maxHp))}; });
      ok(W.still===0,V.id+' 120 frames with no HP change: '+W.still+' DOM writes');
      ok(W.hit===1&&W.txt===W.want,V.id+' one hit: '+W.hit+' write on that card, now '+W.txt);
      /* ult ready: the card border lights gold; low HP tints the number */
      const R=await page.evaluate(()=>{ const al=units.filter(u=>u.team==='ally'&&u.alive&&u.slotEl); const a=al[al.length-1], b=al[0]; a.energy=100; b.hp=b.maxHp*0.2; updatePortraits();
        const cs=getComputedStyle(a.slotEl,'::before'); return {ready:a.slotEl.classList.contains('ready'), content:cs.content, bc:cs.borderTopColor, bw:parseFloat(cs.borderTopWidth), shadow:cs.boxShadow, low:b.slotEl.classList.contains('ewcLow'), lowColor:getComputedStyle(b.slotEl.querySelector('.ewcHpNum')||b.slotEl).color}; });
      ok(R.ready&&R.content!=='none'&&R.content!=='normal'&&R.bw>=1&&/255, 212, 94/.test(R.bc)&&R.shadow!=='none',V.id+' ult ready: the card border is lit gold ('+R.bc+', '+R.bw+' px)');
      ok(R.low&&/255, 176, 160/.test(R.lowColor),V.id+' under 30% HP the number turns red ('+R.lowColor+')');
      if(SHOTS){ fs.mkdirSync(SHOTS,{recursive:true}); await delay(400); await page.evaluate(()=>{ try{ renderer.render(scene,camera); }catch(e){} });
        await page.screenshot({path:path.join(SHOTS,'cc_'+V.id+'_full.png')});
        const b=await page.evaluate(()=>{ const r=document.getElementById('portraitBar').getBoundingClientRect(); const s=[...document.querySelectorAll('#portraitBar .pslot')].map(e=>e.getBoundingClientRect()); const l=Math.min(...s.map(q=>q.left)); return {x:l-12,y:r.top-12,w:r.right-l+24,h:r.height+24}; });
        await page.screenshot({path:path.join(SHOTS,'cc_'+V.id+'_cards.png'),clip:{x:Math.max(0,b.x),y:Math.max(0,b.y),width:Math.min(V.w-Math.max(0,b.x),b.w),height:Math.min(V.h-Math.max(0,b.y),b.h)}}); }
      ok(!errs.length,V.id+' no page errors '+errs.slice(0,3).join(' | '));
      await ctx.close();
    }
  } catch(e){ fails++; console.log('  FAIL '+(e&&e.stack||e)); }
  finally{ try{ await browser.close(); }catch(_){} if(child){ child.kill(); for(let i=0;i<100&&child.exitCode===null&&child.signalCode===null;i++) await delay(50); } }
  console.log('test_tr1364_combat_cards.js: '+(checks-fails)+'/'+checks+' passed, '+fails+' failed'); process.exit(fails?1:0); })();
