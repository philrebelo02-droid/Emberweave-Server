const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-raidatt-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child){ const c=child; child=null; await new Promise(r=>{ if(c.exitCode!==null) return r(); c.once('exit',r); c.kill(); }); } try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
/* v1382 (Claude 12 Nov 18:29, Grok): the client said 5 Guild Raid attempts a day (GUILD_RAID_ATTEMPTS=5) while the online
   server enforces 3 (server.js RAID_ATT). The client must show the SERVER's count from the server's answer and keep no
   second count. Fixture: a fresh guild member sees 3 attempts (server view, the Raid button, the client's attempts helper,
   the Guild guide line), spends them, and the 4th raid is refused with "No assaults left today - back tomorrow."
   CONTROL (main) must FAIL; patched must PASS. */
async function server(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),DATABASE_URL:'',ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  const up=async()=>{for(let i=0;i<400;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  const J=async(p,b,tok)=>(await fetch(base+p,{method:b?'POST':'GET',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:b?JSON.stringify(b):undefined})).json();
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const reg=await J('/api/register',{name:'ra'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); await new Promise(r=>{ child.once('exit',r); child.kill(); });
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  return {base,L,J}; }
async function openPage(base,L,w,h,errs){ const ctx=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:'block'}); const page=await ctx.newPage();
  page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await delay(500); return {ctx,page}; }
async function raidTab(page){ await page.evaluate(async()=>{ if(typeof guildFetch==='function') await guildFetch(); guildTab='raid'; show('guild'); }); await page.waitForFunction(()=>!!document.getElementById('gbAssault'),null,{timeout:20000}).catch(()=>{}); await delay(500);
  return page.evaluate(()=>{ const b=document.getElementById('gbAssault');
    let helper=null; try{ helper=(typeof guildBossAttemptsLeft==='function')?guildBossAttemptsLeft():'missing'; }catch(e){ helper='threw '+e.message; }
    let constType='undefined'; try{ constType=typeof GUILD_RAID_ATTEMPTS; }catch(e){ constType='tdz'; }
    return {state, tab:guildTab, btn:b?b.textContent.trim():null, disabled:b?b.disabled:null, helper, constType, guild:!!G.guild}; }); }
(async()=>{ try{
  const {base,L,J}=await server();
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  const g=await J('/api/guild/create',{name:'Raid Count Guild'},L.token); ok(!!(g&&!g.error),'fixture: guild created '+JSON.stringify(g&&g.error||'ok'));
  const v0=(await J('/api/guild/raid',null,L.token)).raid||{};
  ok(v0.attemptsLeft===3&&v0.attemptsMax===3,'server: a fresh guild member has 3 of 3 raid attempts ('+v0.attemptsLeft+'/'+v0.attemptsMax+')');
  const errs=[]; const {ctx,page}=await openPage(base,L,844,390,errs);
  const own=await page.evaluate(async()=>{ await api('/api/admin/led-grant','POST',{unlock:Object.keys(HERO_TYPES).slice(0,10)}); await ledgerSync(); return Object.keys(HERO_TYPES).filter(k=>G.unlocked&&G.unlocked[k]).slice(0,5); });
  const s0=await raidTab(page);
  ok(s0.state==='guild'&&s0.tab==='raid'&&s0.guild,'fixture: on the Guild Raid tab '+JSON.stringify({state:s0.state,tab:s0.tab,guild:s0.guild}));
  ok(/\b3\b/.test(s0.btn||'')&&!/\b5\b/.test(s0.btn||'')&&s0.disabled===false,'Raid button shows the server count 3 ("'+s0.btn+'")');
  ok(s0.helper===3,'the client attempts helper guildBossAttemptsLeft() = server 3 (got '+JSON.stringify(s0.helper)+')');
  ok(s0.constType==='undefined','no second hardcoded count in the client (typeof GUILD_RAID_ATTEMPTS = '+s0.constType+')');
  const src=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
  ok(!/(const|let|var)\s+GUILD_RAID_ATTEMPTS\b/.test(src),'the html source defines no GUILD_RAID_ATTEMPTS constant');
  const guide=await page.evaluate(()=>t('ftut.guild.3'));
  ok(new RegExp('\\b'+v0.attemptsMax+'\\b').test(guide),'the Guild guide line names the server count '+v0.attemptsMax+' ("'+guide+'")');
  // spend the 3 attempts as real server fights
  for(let i=1;i<=3;i++){ const st=await J('/api/guild/raid/start',{heroIds:own,requestId:'ra-s'+i},L.token);
    const rs=st&&st.attemptId?await J('/api/guild/raid/resolve',{attemptId:st.attemptId,inputLog:[],requestId:'ra-r'+i},L.token):null;
    ok(!!(st&&st.ok&&rs&&rs.ok)&&rs.raid&&rs.raid.attemptsLeft===3-i,'raid '+i+' fought and booked, server says '+(rs&&rs.raid&&rs.raid.attemptsLeft)+' left'+(st&&st.error?' ('+st.error+')':'')); }
  const st4=await J('/api/guild/raid/start',{heroIds:own,requestId:'ra-s4'},L.token);
  ok(st4&&st4.none===true&&!st4.attemptId,'server: the 4th raid start is refused (none, no attempt) '+JSON.stringify(st4).slice(0,80));
  const s1=await raidTab(page);
  ok(s1.disabled===true&&s1.btn===await page.evaluate(()=>t('graid.no_assaults')).then(x=>x.trim()),'Raid button after 3 raids: disabled, "'+s1.btn+'"');
  ok(s1.helper===0,'the client attempts helper = server 0 after 3 raids (got '+JSON.stringify(s1.helper)+')');
  // the 4th raid through the client: the squad screen's Battle is refused with the right message, no fight
  await page.evaluate(()=>{ window._bnSeen=[]; const o=bannerMsg; bannerMsg=function(m){ window._bnSeen.push(String(m)); return o.apply(this,arguments); }; });
  await page.evaluate((own)=>{ G.squads=G.squads||{}; G.squads.graid=own; raidSelectHeroes(); },own); await delay(1200);
  await page.locator('#startBtn').click(); await delay(4000);
  const s2=await page.evaluate(()=>({state, att:!!CUR.attemptId, seen:window._bnSeen, want:t('raid.none_left')}));
  ok(s2.state!=='battle'&&!s2.att,'the 4th raid does not start a fight '+JSON.stringify({state:s2.state,att:s2.att}));
  ok(s2.seen.includes(s2.want),'the 4th raid shows "'+s2.want+'" (banners: '+JSON.stringify(s2.seen)+')');
  const v4=(await J('/api/guild/raid',null,L.token)).raid||{};
  ok(v4.attemptsLeft===0&&v4.attemptsMax===3,'server after the refusal: 0 of 3 left ('+v4.attemptsLeft+'/'+v4.attemptsMax+')');
  ok(errs.length===0,'no page errors '+errs.join(' | ').slice(0,200));
  await ctx.close();
  // guest/offline: no token - the Raid squad Battle asks to sign in, no count is invented
  const errs2=[]; const ctx2=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}); const p2=await ctx2.newPage(); p2.on('pageerror',e=>errs2.push(String(e.message||e)));
  await p2.goto(base+'/play',{waitUntil:'load',timeout:120000}); await p2.waitForFunction(()=>typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000}); await delay(1500);
  const gst=await p2.evaluate(async()=>{ ACC.token=null; let h=null; try{ h=guildBossAttemptsLeft(); }catch(e){ h='threw'; } window._bnSeen=[]; const o=bannerMsg; bannerMsg=function(m){ window._bnSeen.push(String(m)); return o.apply(this,arguments); };
    G.squads=G.squads||{}; G.squads.graid=Object.keys(HERO_TYPES).slice(0,1); try{ await raidLaunch(); }catch(e){} return {h, seen:window._bnSeen, want:t('raid.sign_in'), state}; });
  ok(gst.seen.includes(gst.want)&&gst.state!=='battle','guest: a raid asks to sign in ("'+gst.want+'"), no fight');
  ok(gst.h!==5,'guest: the client never reports 5 attempts (helper = '+JSON.stringify(gst.h)+')');
  ok(errs2.length===0,'guest: no page errors '+errs2.join(' | ').slice(0,200));
  await ctx2.close();
}catch(e){ console.error(e); fails++; } finally { finish('guild raid attempts = server count'); await cleanup(); } })();
