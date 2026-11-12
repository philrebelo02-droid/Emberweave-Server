// v1376 (Phil 12 Nov: "Did we ever finish building the mini tutorial for all new features?" / "a conversation on the bottom of the screen between
// vael, syl, vireo about how to use each thing" + "vael, vireo, sylthaine, vex to have a portrait"): the first time each feature is opened, a short talk
// plays in a bar at the bottom (or top) of that screen. Checks XP potion, Glyphs, Temple, Academy, Vault, Arena: appears on first open, 3+ speakers,
// Next / Skip, never again after a reload (G.ftutSeen, also in the server's cloud save), not in a battle or during the first-run tutorial, inside the
// screen at 844x390 and 1440x900, no page errors. CONTROL: EW_ROOT=<089f7f15 copy> must FAIL.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-ftut-'));
const SHOTS=process.env.FTUT_SHOTS||'';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
let L=null;
async function boot(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'ft'+Date.now().toString(36),pass:'password1'}); L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  await J('/api/admin/led-grant',{px:99000000,gold:1000000,gems:5000},L.token);
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  const ctx=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await load(page,base); return {page,errs,base}; }
async function load(page,base){
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await page.evaluate(async()=>{ const ks=Object.keys(HERO_TYPES); await api('/api/admin/led-grant','POST',{unlock:ks.slice(0,12),campCleared:45}); if(typeof ledgerSync==='function') await ledgerSync(); });
  await delay(500); }
const bar=page=>page.evaluate(()=>{ const b=document.getElementById('ftutBar'); if(!b) return null; const v=ewGameView(), box=b.querySelector('.ftut-box'), por=b.querySelector('.ftut-por');
  const r=box.ewGameRect(), p=por.ewGameRect(); return {guide:b.dataset.guide,line:+b.dataset.line,speaker:b.dataset.speaker,name:b.querySelector('.ftut-name').textContent,
    text:b.querySelector('.ftut-text').textContent,step:b.querySelector('.ftut-step').textContent,hold:b.classList.contains('ftut-hold'),
    box:{l:r.left,t:r.top,r:r.right,b:r.bottom},por:{l:p.left,t:p.top,r:p.right,b:p.bottom},vw:v.width,vh:v.height,img:b.querySelector('.ftut-img').getAttribute('src')||''}; });
async function waitBar(page,guide,ms){ const end=Date.now()+(ms||6000); while(Date.now()<end){ const b=await bar(page); if(b&&(!guide||b.guide===guide)&&!b.hold) return b; await delay(200); } return await bar(page); }
const inside=(b)=>b&&b.box.l>=-0.5&&b.box.t>=-0.5&&b.box.r<=b.vw+0.5&&b.box.b<=b.vh+0.5&&b.por.t>=-0.5&&b.por.b<=b.vh+0.5&&b.por.l>=-0.5;
async function shot(page,name){ if(!SHOTS) return; try{ fs.mkdirSync(SHOTS,{recursive:true}); await page.screenshot({path:path.join(SHOTS,name+'.jpg'),type:'jpeg',quality:80}); }catch(e){} }
/* play one guide through: every line, its speakers; Next (or Skip) */
async function playGuide(page,key,open,mode,tag){
  await page.evaluate(()=>{ const b=document.getElementById('ftutBar'); if(b&&FTUT&&FTUT.cur) ftutEnd(false); });
  await page.evaluate(open); const b0=await waitBar(page,key,8000);
  ok(b0&&b0.guide===key, tag+': '+key+' guide appears on first open ('+(b0?b0.guide+' '+b0.step:'no bar')+')');
  if(!b0||b0.guide!==key) return null;
  ok(inside(b0), tag+': '+key+' bar + portrait inside the screen (box '+Math.round(b0.box.t)+'..'+Math.round(b0.box.b)+' portrait top '+Math.round(b0.por.t)+', screen 0..'+b0.vh+')');
  ok(/^[A-Z]/.test(b0.text)&&b0.text.indexOf('ftut.')<0&&b0.text.length<=110, tag+': '+key+' line 1 is real text: "'+b0.text+'"');
  await shot(page,key+'-'+tag);
  const total=+b0.step.split('/')[1], speakers=new Set([b0.speaker]); let last=b0;
  if(mode==='skip'){ await page.click('#ftutBar .ftut-skip'); await delay(300); }
  else { for(let i=1;i<total;i++){ await page.click('#ftutBar .ftut-next'); await delay(150); const b=await bar(page); if(!b) break; ok(b.line===i+1, tag+': '+key+' Next -> line '+(i+1)+' ('+b.speaker+': "'+b.text+'")'); speakers.add(b.speaker); last=b; }
    ok(last&&last.line===total, tag+': '+key+' all '+total+' lines shown');
    await page.click('#ftutBar .ftut-next'); await delay(300); }
  const after=await page.evaluate(k=>({gone:!document.getElementById('ftutBar')||(document.getElementById('ftutBar').dataset.guide!==k),seen:!!(G.ftutSeen&&G.ftutSeen[k])}),key);
  ok(after.gone&&after.seen, tag+': '+key+' '+(mode==='skip'?'Skip':'last Next')+' closes it and marks it seen in G');
  return {speakers,total}; }
(async()=>{ try{
  const {page,errs,base}=await boot();
  const lv=await page.evaluate(()=>playerLevel()); ok(lv>=61,'test account is level '+lv);
  ok(await page.evaluate(()=>typeof FTUT_GUIDES!=='undefined'&&Array.isArray(FTUT_GUIDES)), 'feature guide table exists');
  const hk=await page.evaluate(()=>{ const k=Object.keys(HERO_TYPES).find(k=>G.unlocked&&G.unlocked[k]); return k; });
  const all=new Set();
  /* 844x390 phone */
  const plan=[['arena',()=>show('arena'),'next'],['dungeon',()=>show('dungeon'),'skip'],['temple',()=>show('temple'),'next'],['tech',()=>show('tech'),'skip']];
  for(const [k,open,mode] of plan){ const r=await playGuide(page,k,open,mode,'844x390'); if(r){ r.speakers.forEach(s=>all.add(s)); if(mode==='next') ok(r.speakers.size>=3, '844x390: '+k+' has '+r.speakers.size+' speakers ('+[...r.speakers].join(', ')+')'); } }
  /* XP potion: only once the player holds one */
  await page.evaluate(h=>{ show('home'); G.xpPotions={minor:0,greater:0,major:0,superior:0}; detailHero=h; heroTab='stats'; show('heroDetail'); },hk); await delay(1600);
  let b=await bar(page); ok(!b||b.guide!=='xp','no XP potion guide while the player holds no potion ('+(b?b.guide:'none')+')');
  await page.evaluate(()=>{ if(FTUT.cur) ftutEnd(false); G.ftutSeen=Object.assign(G.ftutSeen||{}, {heroes:1}); });
  await page.setViewportSize({width:1440,height:900}); await delay(600);
  const r1=await playGuide(page,'xp',()=>{ G.xpPotions={minor:3,greater:0,major:0,superior:0}; heroTab='stats'; show('heroDetail'); },'next','1440x900'); if(r1){ r1.speakers.forEach(s=>all.add(s)); ok(r1.speakers.size>=3,'1440x900: xp has '+r1.speakers.size+' speakers'); }
  const r2=await playGuide(page,'glyph',()=>{ heroTab='glyphs'; renderHeroDetail(); },'next','1440x900'); if(r2){ r2.speakers.forEach(s=>all.add(s)); ok(r2.speakers.size>=3,'1440x900: glyph has '+r2.speakers.size+' speakers'); }
  ok(['vael','sylthaine','vireo','vex'].every(s=>all.has(s)), 'Vael, Sylthaine, Vireo and Vex all speak ('+[...all].join(', ')+')');
  /* the other size for the same kind of screen: Academy guide replayed at 1440x900, Vault at 844x390 (layout check only) */
  await page.evaluate(()=>{ delete G.ftutSeen.tech; }); const bt=await (async()=>{ await page.evaluate(()=>show('tech')); return waitBar(page,'tech',6000); })();
  ok(bt&&inside(bt),'1440x900: Academy guide inside the screen'); await shot(page,'tech-1440x900'); await page.evaluate(()=>{ if(FTUT.cur) ftutEnd(true); });
  await page.setViewportSize({width:844,height:390}); await delay(500);
  await page.evaluate(()=>{ delete G.ftutSeen.glyph; heroTab='glyphs'; show('heroDetail'); }); const bg=await waitBar(page,'glyph',6000);
  ok(bg&&inside(bg),'844x390: Glyph guide inside the screen'); await shot(page,'glyph-844x390'); await page.evaluate(()=>{ if(FTUT.cur) ftutEnd(true); });
  /* never in a battle, never during the first-run tutorial, never over a modal */
  await page.evaluate(()=>{ show('home'); delete G.ftutSeen.forge; show('forge'); state='battle'; }); await delay(1800);
  b=await bar(page); ok(!b,'no guide while a battle runs ('+(b?b.guide:'none')+')');
  await page.evaluate(()=>{ state='home'; show('home'); G.tutDone=false; G.tutStarted=true; G.tutSkipped=false; show('forge'); }); await delay(1800);
  b=await bar(page); ok(!b,'no guide while the first-run tutorial runs ('+(b?b.guide:'none')+')');
  await page.evaluate(()=>{ show('home'); G.tutDone=true; show('forge'); gameConfirm('Test modal',()=>{}); }); await delay(1800);
  b=await bar(page); ok(!b||b.hold,'no guide over an open modal ('+(b?b.guide+(b.hold?' held':''):'none')+')');
  await page.click('#_gcNo');
  b=await waitBar(page,'forge',6000); ok(b&&b.guide==='forge','the waiting guide plays once the modal closes ('+(b?b.guide:'none')+')');
  await page.evaluate(()=>{ show('home'); }); await delay(900);
  b=await bar(page); ok(!b,'leaving the screen part-way closes the guide'); ok(!(await page.evaluate(()=>!!(G.ftutSeen&&G.ftutSeen.forge))),'a guide left part-way is not marked seen (plays again next time)');
  /* seen state survives a sync, the cloud save and a reload */
  await page.evaluate(async()=>{ await ledgerSync(); flushCloud(); }); await delay(2500);
  const cloud=await page.evaluate(async()=>{ const d=await api('/api/profile'); try{ return JSON.parse(d.profile.roster.__save).ftutSeen||null; }catch(e){ return 'err'; } });
  ok(cloud&&cloud.arena&&cloud.dungeon&&cloud.temple&&cloud.xp, 'seen guides are in the server cloud save ('+JSON.stringify(cloud)+')');
  await load(page,base);
  const seen=await page.evaluate(()=>G.ftutSeen||{}); ok(seen.arena&&seen.dungeon&&seen.temple&&seen.tech&&seen.xp&&seen.glyph,'after a reload G.ftutSeen still holds them ('+Object.keys(seen).join(',')+')');
  for(const [k,open] of [['arena',()=>show('arena')],['dungeon',()=>show('dungeon')],['temple',()=>show('temple')],['tech',()=>show('tech')]]){ await page.evaluate(()=>show('home')); await delay(300); await page.evaluate(open); await delay(1800); const x=await bar(page); ok(!x||x.guide!==k,'after reload: '+k+' guide does not show again ('+(x?x.guide:'none')+')'); }
  await page.evaluate(()=>{ show('home'); G.xpPotions={minor:3,greater:0,major:0,superior:0}; detailHero=Object.keys(G.unlocked).find(k=>G.unlocked[k]); heroTab='stats'; show('heroDetail'); }); await delay(1800);
  b=await bar(page); ok(!b||b.guide!=='xp','after reload: XP potion guide does not show again'); await page.evaluate(()=>{ if(FTUT.cur) ftutEnd(false); });
  /* Settings toggle off: nothing plays */
  await page.evaluate(()=>{ show('home'); G.ftutOff=true; delete G.ftutSeen.arena; show('arena'); }); await delay(1800);
  b=await bar(page); ok(!b,'Settings "Feature guides" off: no guide'); await page.evaluate(()=>{ G.ftutOff=false; show('home'); });
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { console.log('feature tutorials: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1;
  if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{ fs.rmSync(temp,{recursive:true,force:true}); }catch(e){} } })();
