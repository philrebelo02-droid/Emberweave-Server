// LANGUAGES step 2: phone + PC screenshots of a stocked guest in several languages (hub, a hero's skills, the glossary lore, Settings).
// Usage: node tools/lang/shots.js <outDir> [codes...]   (default codes: de ru ja th hi)
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const H=require('./harness.js'); const ROOT=H.ROOT;
const out=process.argv[2]; const codes=process.argv.slice(3).length?process.argv.slice(3):['de','ru','ja','th','hi'];
(async()=>{ fs.mkdirSync(out,{recursive:true});
  const S=await H.startServer();
  const GUESTS={};   // one guest per language and device: the account's saved language wins over the device pick (langAdoptSave)
  for(const code of codes) for(const dev of ['phone','pc']){ const g=await (await fetch(S.base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:'lang-shots-'+code+dev+Date.now()})})).json(); await fetch(S.base+'/api/ledger',{headers:{'x-token':g.token}}); GUESTS[code+dev]=g; }
  S.srv.kill(); await H.delay(500);
  { const f=path.join(S.tmp,'db.json'), db=JSON.parse(fs.readFileSync(f,'utf8')); const bases=require(path.join(ROOT,'server','sim.js')).HERO_BASE;
    for(const g of Object.values(GUESTS)){ const u=db.users[g.profile.id]; u.led.unlocked=u.led.unlocked||{}; for(const k of Object.keys(bases).slice(0,30)) u.led.unlocked[k]=true; } fs.writeFileSync(f,JSON.stringify(db)); }
  const port=+S.base.split(':').pop(), log=fs.openSync(path.join(S.tmp,'srv2.log'),'a');
  const srv=cp.spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:path.join(S.tmp,'db.json'),RL_MUL:'1000',SIM_WORKERS:'0',ALLOW_NEW_GUESTS:'1'},stdio:['ignore',log,log],windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(S.base+'/api/health')).ok) break; }catch(_){} await H.delay(100); }
  const { chromium }=require(path.join(ROOT,'node_modules','playwright'));
  const browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});
  try{
    for(const code of codes) for(const [dev,vp] of [['phone',{width:844,height:390}],['pc',{width:1280,height:720}]]){
      const ctx=await browser.newContext({viewport:vp,deviceScaleFactor:dev==='phone'?2:1}); const guest=GUESTS[code+dev];
      await ctx.addInitScript(([tok,gid,nm,l])=>{ localStorage.setItem('ew_acc',JSON.stringify({token:tok,id:gid,name:nm,guest:true})); localStorage.setItem('ew_guest_step_'+gid,'1'); localStorage.setItem('ew_lang',l); },[guest.token,guest.profile.id,guest.profile.name,code]);
      const page=await ctx.newPage(); await page.goto(S.base+'/play',{waitUntil:'domcontentloaded',timeout:120000});
      await page.waitForFunction(()=>typeof show==='function'&&LANG.dict&&LANG.content,null,{timeout:120000}); await page.waitForTimeout(2500);
      await page.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await page.waitForTimeout(1200);
      await page.evaluate(()=>{ const s=document.getElementById('tutSkip'); if(s&&s.offsetParent) s.click(); G.playerXP=Number.MAX_SAFE_INTEGER; show('home'); try{ renderHome(); }catch(e){} });
      await page.waitForTimeout(1500); await page.screenshot({path:path.join(out,code+'-'+dev+'-1-hub.png')});
      await page.evaluate(()=>{ detailHero=HERO_KEYS.filter(k=>G.unlocked[k])[0]; popoutScreen('heroDetail'); }); await page.waitForTimeout(1500);
      await page.screenshot({path:path.join(out,code+'-'+dev+'-2-hero.png')});
      await page.evaluate(()=>{ const tabs=[...document.querySelectorAll('#heroDetail [data-tab],#heroDetail .tab,#heroDetail [class*="Tab"]')].filter(e=>e.getClientRects().length); const sk=tabs.find(e=>/skill|habil|fähig|навык|スキル|ทักษะ|कौशल/i.test(e.textContent)); (sk||tabs[1]||{click(){}}).click(); });
      await page.waitForTimeout(1200); await page.screenshot({path:path.join(out,code+'-'+dev+'-3-skills.png')});
      await page.evaluate(()=>{ show('settings'); }); await page.waitForTimeout(1200); await page.screenshot({path:path.join(out,code+'-'+dev+'-4-settings.png')});
      await page.evaluate(()=>{ show('quest'); }); await page.waitForTimeout(1200); await page.screenshot({path:path.join(out,code+'-'+dev+'-5-quests.png')});
      await ctx.close(); console.log('shots: '+code+' '+dev); }
  } finally { await browser.close(); srv.kill(); }
})().catch(e=>{ console.error(e); process.exit(1); });
