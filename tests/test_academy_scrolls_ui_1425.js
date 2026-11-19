// v1425 (Phil 19 Nov 2026: Academy Scrolls - 1 hour off a research each, one a day from the Guild Shop; without one 30 diamonds an hour):
// the REAL page against a throwaway server, in English, Spanish and Japanese, desktop and phone-landscape sizes:
//  1. a research in progress shows "Scroll -1h (2)", "-1h · 30" and "Finish now · 120" (3 h 20 min left = 4 hours) - all inside the card
//  2. tapping Scroll takes an hour off and the count drops to 1; tapping -1h spends 30 diamonds
//  3. Finish now asks first, then finishes the research (the level lands, the speed row is gone)
//  4. the Guild Shop (a level-1 guild) lists the Academy Scroll with "1 left today"; buying it shows "bought today"
// Screenshots: ACAD_SHOTS=<dir>.
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-acscui-')), dbFile=path.join(temp,'db.json');
const OUT=process.env.ACAD_SHOTS||'';
const delay=ms=>new Promise(r=>setTimeout(r,ms)), H=3600000;
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let fails=0; const ok=(c,m)=>{ if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
(async()=>{ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:dbFile,ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',DATABASE_URL:''};
  const up=async()=>{for(let i=0;i<300;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('server did not start');};
  let child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const stop=async()=>{ child.kill(); for(let i=0;i<200&&child.exitCode===null&&child.signalCode===null;i++) await delay(50); };
  const accounts=[];
  for(const lang of ['en','es','ja']) for(const vp of [{w:1280,h:720,n:'desktop'},{w:844,h:390,n:'phone'}]){
    const reg=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'as'+lang+vp.n+Date.now().toString(36).slice(-4),pass:'password1'})})).json();
    await fetch(base+'/api/academy',{headers:{'x-token':reg.token}});
    accounts.push({lang,vp,token:reg.token,id:reg.profile.id}); }
  await delay(400); await stop();
  const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); db.guilds=db.guilds||{};
  const T0=Date.now();
  for(const a of accounts){ const u=db.users[a.id]; db.guilds['g'+a.id]={id:'g'+a.id,name:'Scroll Guild',members:[a.id],level:1,exp:0}; u.guildId='g'+a.id;
    u.led.guildCoins=1000; u.led.gems=500; u.led.acad.lv.academy=5; u.led.acad.lv.atk=2; u.led.acad.learn={atk:T0+3*H+20*60000+60000}; u.led.acad.scrolls=2; }
  fs.writeFileSync(dbFile,JSON.stringify(db));
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  let browser;
  try{ browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output']});
    for(const A of accounts){ const tag=A.lang+'/'+A.vp.n;
      const ctx=await browser.newContext({viewport:{width:A.vp.w,height:A.vp.h},serviceWorkers:'block'}); const page=await ctx.newPage();
      await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
      await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
      await page.waitForFunction(()=>typeof show==='function'&&typeof renderTech==='function',null,{timeout:120000});
      for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none') return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
      await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; if(typeof ledgerSync==='function') await ledgerSync(); },A); await delay(800);
      await page.evaluate(()=>{ G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); const a=document.getElementById('authGate'); if(a) a.style.display='none'; const to=document.getElementById('tutOffer'); if(to) to.remove(); });
      const openAcad=async()=>{ await page.evaluate(async l=>{ await langLoad(l); await academySync(); show('tech'); const sc=document.getElementById('tech');
        document.querySelectorAll('.screen.active').forEach(x=>x!==sc&&x.classList.remove('active')); sc.classList.add('active'); techSel='atk'; renderTech(); },A.lang); await delay(900); };
      await openAcad();
      const read=()=>page.evaluate(()=>{ const q=s=>document.querySelector(s), card=q('.tw-detail'), cr=card&&card.getBoundingClientRect();
        const b=['#acSpdScroll','#acSpdGem','#acSpdAll'].map(s=>{ const e=q(s); if(!e) return null; const r=e.getBoundingClientRect(); return {txt:e.textContent.trim(),dis:e.disabled,inCard:!!cr&&r.left>=cr.left-1&&r.right<=cr.right+1&&r.top>=cr.top-1&&r.bottom<=cr.bottom+1,vis:r.width>0&&r.height>0}; });
        return {b,left:(G.techLearn.atk||0)-Date.now(),gems:G.gems|0,lv:G.tech.atk|0,scrolls:G.acadScrolls|0}; });
      let r=await read();
      ok(r.b[0]&&/\(2\)|（2）/.test(r.b[0].txt)&&!r.b[0].dis&&r.b[1]&&/30/.test(r.b[1].txt)&&r.b[2]&&/120/.test(r.b[2].txt),tag+': scroll (2), -1h 30, finish 120 buttons ('+r.b.map(x=>x&&x.txt).join(' | ')+')');
      ok(r.b.every(x=>x&&x.vis&&x.inCard),tag+': all three buttons are visible inside the research card');
      if(OUT){ fs.mkdirSync(OUT,{recursive:true}); await page.screenshot({path:path.join(OUT,'acad-'+A.lang+'-'+A.vp.n+'.png')}); }
      const left0=r.left; await page.click('#acSpdScroll'); await delay(900); r=await read();
      ok(r.scrolls===1&&Math.abs((left0-r.left)-H)<20000&&/\(1\)|（1）/.test(r.b[0].txt),tag+': Scroll takes 1 hour off, 1 left ('+Math.round((left0-r.left)/60000)+' min)');
      const g0=r.gems; await page.click('#acSpdGem'); await delay(900); r=await read();
      ok(g0-r.gems===30,tag+': -1h spends 30 diamonds ('+g0+' -> '+r.gems+')');
      const lv0=r.lv; await page.click('#acSpdAll'); await delay(500);
      const asked=await page.evaluate(()=>!!document.getElementById('uiConfirmWrap'));
      ok(asked,tag+': Finish now asks before spending');
      if(OUT&&A.vp.n==='desktop') await page.screenshot({path:path.join(OUT,'finish-confirm-'+A.lang+'.png')});
      await page.evaluate(()=>{ const w=document.getElementById('uiConfirmWrap'); const bs=[...w.querySelectorAll('button')]; (bs.find(b=>!/cancel|cancelar|キャンセル/i.test(b.textContent))||bs[0]).click(); }); await delay(1200);
      r=await read();
      ok(r.lv===lv0+1&&!r.b[0]&&r.gems===g0-30-60,tag+': Finish now finished the research (Lv '+lv0+' -> '+r.lv+', diamonds '+r.gems+')');
      // the Guild Shop
      await page.evaluate(()=>{ if(!G.guild) G.guild={id:'g',name:'Scroll Guild',level:1}; document.querySelectorAll('.modal,.modalShell').forEach(()=>{}); openGuildShop(); }); await delay(700);
      const row=()=>page.evaluate(()=>{ const btn=[...document.querySelectorAll('[data-buy]')].find(b=>b.dataset.buy==='15'); if(!btn) return null; const rowEl=btn.parentElement, r=btn.getBoundingClientRect();
        return {txt:rowEl.textContent.replace(/\s+/g,' ').trim(),dis:btn.disabled,vis:r.width>0&&r.height>0,count:document.querySelectorAll('[data-buy]').length}; });
      let s=await row();
      ok(s&&s.vis&&!s.dis&&s.count===5,tag+': the level-1 Guild Shop shows its 4 items + the Academy Scroll ('+(s&&s.txt)+')');
      await page.evaluate(()=>{ const b=[...document.querySelectorAll('[data-buy]')].find(b=>b.dataset.buy==='15'); b.scrollIntoView({block:'center'}); });
      if(OUT&&A.vp.n==='desktop') await page.screenshot({path:path.join(OUT,'gshop-'+A.lang+'.png')});
      await page.evaluate(()=>{ [...document.querySelectorAll('[data-buy]')].find(b=>b.dataset.buy==='15').click(); }); await delay(1500);
      await page.evaluate(async()=>{ await ledgerSync(); }); await delay(300);
      await page.evaluate(()=>{ document.querySelectorAll('#modalShell,.modalShell,.modal').forEach(m=>{}); openGuildShop(); }); await delay(600);
      s=await row();
      ok(s&&s.dis,tag+': after buying, the scroll is bought for today ('+(s&&s.txt)+')');
      const sc=await page.evaluate(async()=>{ await academySync(); return G.acadScrolls|0; });
      ok(sc===2,tag+': the bought scroll is in the Academy (1 left + 1 bought = '+sc+')');
      await ctx.close(); }
  } finally { try{ await browser.close(); }catch(e){} await stop(); }
  console.log(fails?'FAIL '+fails:'PASS'); process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
