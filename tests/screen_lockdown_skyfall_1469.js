'use strict';
/* Lockdown checklist 25 Nov 2026 (01 - EVERY FEATURE IN THE GAME.md), v1469 screen checks - Skyfall on a REAL war (not the dev simulator),
   in a real browser on this checkout's server (temp DB), at phone 844x390 (touch) and desktop 1280x720.
   THE WAR is made through the server's own routes, as test_skyfall_real_fights_1458 does: our guild (the signed-in player + 5 members)
   and theirs (5 members) register; every member but one places a tower in the placement window (one member per lane on each side); the
   clock is warped past the registration lock and the 18:00 line lock; five real marches are fought through POST /api/guild-war/assault,
   one per lane (ours on 0, 2, 4, theirs on 1, 3). Every march is a strong line on a weak one (Lv 60 on Lv 1, Lv 30 on Lv 12), so every
   fight is a short one: the longest stays at or under 60 s of board time (checked at setup). Then 14 cosmetic guilds are written into the
   round (16 crests on the bracket) and the server restarts on that DB.
   THE BOARD is played twice per size:
   - Pass 1 at x20 (the page's fastest speed, SKYSIM_SPEEDS; the real board reads SKYSIM.speed too): the lines that do not depend on real
     time - no result shown early, the longest fight's duration (measured x20 = skyFightMs), lane report from a spent tower, Records rows
     (a fight we marched and one they marched), the bracket drawing.
   - Pass 2 at x1, the same war seen as a fresh device (this device's played-fights record cleared): the lines that need real time - live
     fight view with its running clock, lane report from the swords, Records while a fight plays, five lanes side by side, marching
     heroes, the shortest fight's duration, Watch a march (stored fight, Leave no Skip, the war keeps running, no restart after Leave).
   Lines: No auto-placement, Five lanes at once, Fight duration, Marching heroes, Lane report, Records rows, Live fight view, Watch a march;
   Bracket panel printed as WATCH (Phil is deciding the wording). STEP lines mark every phase; every wait is capped; a 12-minute watchdog. */
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const H=require('./helpers/screens-lockdown.js');
const {rig,press,tapEl,mmss}=require('./helpers/lockdown-1469.js');
const TEST='screen_lockdown_skyfall_1469.js', R=rig(TEST,{limitMin:12}), {C,shot,step,cap,waitFor}=R;
const SIZES=[H.SIZES.phone,H.SIZES.desktop], FAST=20;
const ADMIN_TOKEN='sl1469-admin-token', ADMIN_ID='sl1469-admin';
const K10=['vael','aureth','sylthaine','vireo','brannus','calypsa','dandra','grosk','umbris','lumi'], K5=K10.slice(0,5);
const FAKE_NAMES=['Iron Choir','Storm Ledger','Gilded Thorn','Night Anvil','Crown Embers','Rift Walkers','Salt Crowns','Hollow Pike',
  'Lantern Oath','Frost Banner','Cinder Court','Pale Harbor','Oak Sentinels','Last Beacon'];
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
/* the board's own fight length (skyFightMs), its constants read from the page source */
const HTML=fs.readFileSync(path.join(H.ROOT,'emberweave-heroes.html'),'utf8');
const K=n=>{ const m=new RegExp('const '+n+'\\s*=\\s*([0-9.]+)').exec(HTML); return m?+m[1]:NaN; };
const RLO=+(/SKY_ROUNDS_LO\s*=\s*([0-9]+)/.exec(HTML)||[])[1], RHI=+(/SKY_ROUNDS_HI\s*=\s*([0-9]+)/.exec(HTML)||[])[1];
const fightMs=rounds=>{ const r=Math.min(RHI,Math.max(RLO,Math.max(1,rounds|0||8))); const t=Math.log(r/RLO)/Math.log(RHI/RLO); return Math.round((K('SKY_FIGHT_MIN_S')+(K('SKY_FIGHT_CAP_S')-K('SKY_FIGHT_MIN_S'))*t)*1000); };

/* ============================== setup: a real war ============================== */
async function setupWar(){
  step('setup: seed DB');
  const {file}=H.seedDB(Object.fromEntries(K10.map(k=>[k,60])),u=>{ u.led.gold=100000; });
  { const db=JSON.parse(fs.readFileSync(file,'utf8')), me=db.users[H.UID], now=Date.now();
    const a=JSON.parse(JSON.stringify(me)); a.id=ADMIN_ID; a.name='Skyfall Admin'; a.role='admin'; db.users[ADMIN_ID]=a; db.byName[a.name.toLowerCase()]=ADMIN_ID;
    db.tokens[sha(ADMIN_TOKEN)]={id:ADMIN_ID,iat:now,exp:now+90*86400000}; fs.writeFileSync(file,JSON.stringify(db)); }
  step('setup: server');
  let s=await R.server(file,{ADMIN_IDS:ADMIN_ID});
  /* every call through the server's routes, 20 s each; a 429 (the war routes allow 30 calls per 30 s per address) waits 5 s, at most 8 times */
  const req=async(method,route,data,token)=>{ for(let i=0;;i++){
    const r=await fetch(s.base+route,{method,signal:AbortSignal.timeout(20000),headers:Object.assign({'content-type':'application/json'},token===null?{}:{'x-token':token||H.TOKEN}),body:data?JSON.stringify(data):undefined});
    let j=null; try{ j=await r.json(); }catch(_){}
    if(r.status===429&&i<8){ console.log('  INFO   '+route+' answered 429 - waiting 5 s'); await H.wait(5000); continue; }
    /* a live battle answers busy + retry while the battle helper warms up or is full; the game client sends the same requestId again after
       retryAfterMs (test_live_helpers 'client (Skyfall march)'), so the setup does the same, at most 20 times (run 1126-224808: lane 0 busy at t=3.2 s) */
    if(j&&j.busy&&j.retry&&i<20){ console.log('  INFO   '+route+' answered busy - again in '+(j.retryAfterMs||1000)+' ms'); await H.wait(j.retryAfterMs||1000); continue; }
    return j||{status:r.status}; } };
  const need=(c,what,v)=>{ if(!c) throw new Error(what+': '+JSON.stringify(v).slice(0,300)); };
  const mk=async(name,keys,level)=>{ const u=await req('POST','/api/register',{name,pass:'password1'},null); need(u&&u.token&&u.profile,'register '+name,u);
    const g=await req('POST','/api/admin/led-grant',{userId:u.profile.id,unlock:keys,heroKeys:keys,heroXp:level>1?H.xpFor(level):0,px:900000},ADMIN_TOKEN); need(g&&g.ok,'led-grant '+name,g);
    return {name,id:u.profile.id,token:u.token,keys,level}; };
  step('setup: 10 members');
  const me={name:'Screen Check',id:H.UID,token:H.TOKEN};
  /* strong on weak on every lane: the marching side Lv 60 / Lv 30, the side marched on Lv 1 / Lv 12 */
  const A={a1:await mk('Alder69',K10,12),a2:await mk('Birch69',K5,30),a3:await mk('Cedar69',K5,12),a4:await mk('Elm69',K5,30),miss:await mk('Late69',K5,30)};
  const B={b0:await mk('Raw69',K5,1),b1:await mk('Rowan69',K10,30),b2:await mk('Spruce69',K5,12),b3:await mk('Thorn69',K5,30),b4:await mk('Yew69',K5,12)};
  step('setup: guilds');
  const ga=await req('POST','/api/guild/create',{name:'Ember Vanguard'},me.token); need(ga&&ga.guild,'guild A',ga);
  const gb=await req('POST','/api/guild/create',{name:'Ashen Pact'},B.b1.token); need(gb&&gb.guild,'guild B',gb);
  const join=async(u,gid,lead)=>{ const r1=await req('POST','/api/guild/request',{guildId:gid},u.token); need(r1&&r1.ok,'request '+u.name,r1);
    const r2=await req('POST','/api/guild/approve',{id:u.id},lead.token); need(r2&&r2.guild,'approve '+u.name,r2); };
  for(const u of Object.values(A)) await join(u,ga.guild.id,me);
  for(const u of [B.b0,B.b2,B.b3,B.b4]) await join(u,gb.guild.id,B.b1);
  step('setup: war calendar');
  const status=await req('GET','/api/guild-war/status',null,me.token); need(status&&status.tournament,'status',status);
  const t=status.tournament, now=Date.now();
  let opening=t.registrationOpensAt; if(now>=t.registrationLocksAt) opening=t.nextRegistrationOpensAt||opening+14*86400000;
  const warp=async at=>req('POST','/api/guild-war/debug-warp',{offsetMs:at-Date.now()},ADMIN_TOKEN);
  const w1=await warp(Math.max(now,opening+60000)); need(w1&&w1.state==='registration','warp to registration',w1);
  const active=await req('GET','/api/guild-war/status',null,me.token);
  for(const u of [me,B.b1]){ const r=await req('POST','/api/guild-war/register',{},u.token); need(r&&r.ok,'war register '+u.name,r); }
  for(const [u,l] of [[me,0],[A.a1,1],[A.a2,2],[A.a3,3],[A.a4,4],[B.b0,0],[B.b1,1],[B.b2,2],[B.b3,3],[B.b4,4]]){ const r=await req('POST','/api/guild-war/place',{lane:l},u.token); need(r&&r.ok,'place '+u.name,r); }
  const w2=await warp(active.tournament.registrationLocksAt+60000); need(w2&&w2.state==='bracket','warp to the bracket',w2);
  const first=(await req('GET','/api/guild-war/status',null,me.token)).tournament.bracket[0];
  await warp(first.schedule.lockAt+60000);
  const live=await req('GET','/api/guild-war/match',null,me.token); need(live&&live.match&&live.match.state==='live','live match',live);
  step('setup: five marches');
  const results=[];
  for(const [u,l] of [[me,0],[B.b1,1],[A.a2,2],[B.b3,3],[A.a4,4]]){ const r=await req('POST','/api/guild-war/assault',{fromLane:l,requestId:'sl1469-'+l},u.token); need(r&&r.ok,'assault lane '+l+' by '+u.name,r);
    results.push({lane:l,by:u.name,won:r.won,rounds:r.result&&r.result.rounds,ms:fightMs(r.result&&r.result.rounds)}); }
  console.log('  INFO   the five fights: '+results.map(x=>'lane '+x.lane+' '+x.by+' '+x.rounds+'r = '+(x.ms/1000).toFixed(1)+' s').join(' | '));
  step('setup: 16-guild bracket + restart');
  await H.wait(1500); await R.stop(s);
  injectBracket(file,ga.guild.id,gb.guild.id);
  s=await R.server(file,{ADMIN_IDS:ADMIN_ID});
  return {s,file,gA:ga.guild.id,gB:gb.guild.id,gAName:ga.guild.name,gBName:gb.guild.name,results}; }

/* 14 more guilds in round 1 (live cosmetic matches like screen_lockdown_guild.js writes): ours seed 1 vs theirs seed 16 */
function injectBracket(file,gA,gB){ const db=JSON.parse(fs.readFileSync(file,'utf8')), t=db.tournaments.current, now=Date.now();
  const real=t.matches[t.rounds[0].matchIds[0]], EA=t.entrants.find(e=>e.guildId===gA), EB=t.entrants.find(e=>e.guildId===gB);
  const keys=real.sides[gA].citadels.map(c=>c.key), proto=db.users[ADMIN_ID], fakes=[];
  for(let i=0;i<14;i++){ const gid='sl69g'+(i+3), uid='sl69-lead-'+(i+3), name=FAKE_NAMES[i];
    const u=JSON.parse(JSON.stringify(proto)); u.id=uid; u.name='Lord '+(i+3); delete u.role; u.guildId=gid; db.users[uid]=u; db.byName[u.name.toLowerCase()]=uid;
    db.guilds[gid]={id:gid,name,leader:uid,members:[uid],officers:[],reqs:[],level:2,exp:0,motd:'',log:[],createdAt:now-86400000,banner:{shape:i%5,emblem:(i*3)%7,color:(i*5)%9,img:null}};
    fakes.push({guildId:gid,name,banner:db.guilds[gid].banner,seed:0,powerPool:9000-i*100,seedPool:9000-i*100,lines:[{memberId:uid,line:0,power:4000,name:u.name+' · line 1'}]}); }
  const ent=[EA,...fakes,EB]; ent.forEach((e,i)=>e.seed=i+1); t.entrants=ent;
  const def=(uid,name)=>({memberId:uid,line:0,power:4000,name,alive:true,kills:0,fights:0,lineSnapshot:[{key:'vael',maxHp:5000,atk:200,level:30}],hpState:[{hp:5000,energy:0}]});
  const side=e=>({guildId:e.guildId,name:e.name,unplaced:[],missed:[],missedMembers:[],citadels:keys.map((k,i)=>({lane:i,key:k,destroyed:false,defenders:[def(e.lines[0].memberId,e.lines[0].name)]}))});
  [[7,8],[3,12],[4,11],[1,14],[6,9],[2,13],[5,10]].forEach(([a,b],k)=>{ const ea=ent[a], eb=ent[b], id='gwm_sl69_'+k;
    t.matches[id]={id,tournamentId:t.id,roundIndex:0,state:'live',aGuildId:ea.guildId,bGuildId:eb.guildId,revealAt:real.revealAt,lockedAt:real.lockedAt,
      planningEndsAt:real.planningEndsAt,startsAt:real.startsAt,endsAt:real.endsAt,winnerGuildId:null,sides:{[ea.guildId]:side(ea),[eb.guildId]:side(eb)},assaults:{},eventLog:[],version:1};
    t.rounds[0].matchIds.push(id); });
  t.rounds[0].name='R16'; t.roundBase=0; t.version=(t.version|0)+1; fs.writeFileSync(file,JSON.stringify(db)); }

/* ============================== page helpers ============================== */
async function openGuild(pg,S,tab){ await R.cap(H.openBuilding(pg,'guild',S.touch),60000,'opening the Guild Hall');
  await waitFor(pg,()=>document.getElementById('guild').classList.contains('active')&&document.querySelector('#guildBody .gTabStrip'),null,30000,'the Guild Hall tabs');
  if(tab){ await pg.evaluate(t=>{ const b=document.querySelector('#guildBody [data-gt="'+t+'"]'); if(b) b.scrollIntoView({block:'center',inline:'center'}); },tab);
    await press(pg,S,'#guildBody [data-gt="'+tab+'"]'); }
  await H.wait(1800); await H.prep(pg); }

/* every 40 ms: each lane's state (the board's laneStart / laneDone), swords, spent mark, garrison discs, towers, and every marching figure */
const SAMPLER=()=>{ if(window._slS) clearInterval(window._slS.iv);
  const S={lanes:[0,1,2,3,4].map(()=>({starts:[],dones:[],clashOn:null,spent:null,gar:{you:[],foe:[]},towerFall:{you:null,foe:null}})),walkers:{},maxFight:0,maxSwords:0,samples:0,nextId:1,stageSwaps:0,lastStage:null};
  const lastDone=[undefined,undefined,undefined,undefined,undefined], norm=u=>{ try{ return new URL(u,location.href).pathname; }catch(e){ return u||''; } };
  S.iv=setInterval(()=>{ try{ const st=document.getElementById('skyStage'); if(!st) return; const now=Date.now(); S.samples++;
    if(st!==S.lastStage){ if(S.lastStage) S.stageSwaps++; S.lastStage=st; }
    const LD=SKYSIM.laneDone||{}, LS=SKYSIM.laneStart||{}; let fighting=0, swords=0;
    for(let i=0;i<5;i++){ const L=S.lanes[i], d=LD[i];
      if(d===false){ fighting++; if(lastDone[i]!==false) L.starts.push({t:now,laneStart:LS[i]||now,cur:(SKYSIM.laneCur||{})[i]}); }
      if(d===true&&lastDone[i]===false) L.dones.push(now);
      lastDone[i]=d;
      const lc=document.getElementById('skyLC-'+i); if(lc){ if(lc.classList.contains('skyHot')&&SL.vis(lc)){ swords++; if(L.clashOn==null) L.clashOn=now; } if(lc.classList.contains('spent')&&L.spent==null) L.spent=now; }
      for(const sd of ['you','foe']){ const g=document.getElementById('skyGar-'+sd+'-'+i), tx=g?SL.txt(g).replace(/\s/g,''):null, arr=L.gar[sd];
        if(!arr.length||arr[arr.length-1].v!==tx) arr.push({t:now,v:tx});
        const tw=document.getElementById('skyTower-'+sd+'-'+i); if(tw&&(tw.classList.contains('falling')||tw.classList.contains('down'))&&L.towerFall[sd]==null) L.towerFall[sd]=now; } }
    S.maxFight=Math.max(S.maxFight,fighting); S.maxSwords=Math.max(S.maxSwords,swords);
    const G=skyLanes(), seen=new Set();
    st.querySelectorAll('.skyMarch').forEach(el=>{ const x=parseFloat(el.style.left), y=parseFloat(el.style.top);
      if(!el._slId){ el._slId=S.nextId++; let best=null;
        G.forEach((L,i)=>{ for(const [end,p] of [['a',L.a],['b',L.b]]){ const d=Math.hypot(p.x-x,p.y-y); if(!best||d<best.d) best={lane:i,end,d}; } });
        const sp=el.querySelector('.skyMarchSprite'), bg=sp?(sp.style.backgroundImage||'').replace(/^url\(["']?|["']?\)$/g,''):'';
        S.walkers[el._slId]={id:el._slId,mine:el.classList.contains('mine'),lane:best.lane,end:best.end,endDist:+best.d.toFixed(2),first:{t:now,x,y},last:{t:now,x,y},
          mid:{x:G[best.lane].mid.x,y:G[best.lane].mid.y},sprite:bg?norm(bg):'',name:SL.txt(el.querySelector('.skyMarchName')),onScreen:SL.inView(el,4),gone:null}; }
      const w=S.walkers[el._slId]; w.last={t:now,x,y}; seen.add(el._slId); });
    for(const w of Object.values(S.walkers)) if(w.gone==null&&!seen.has(w.id)) w.gone=now;
  }catch(e){ S.err=String(e&&e.message||e); } },40);
  window._slS=S; return true; };
const SAMPLES=()=>{ const S=window._slS; if(!S) return null; const o=Object.assign({},S); delete o.lastStage; delete o.iv; return JSON.parse(JSON.stringify(o)); };
const HUB=()=>{ const hub=document.getElementById('skyHub'); if(!hub) return {none:true}; const q=s=>hub.querySelector(s);
  return {open:!hub.hidden&&SL.vis(hub),lane:SKYSIM.hubLane,tab:SKYSIM.hubTab,title:SL.txt(q('.skyHubHd b')),tabs:[...hub.querySelectorAll('.skyHubTabs button')].map(b=>SL.txt(b)+(b.classList.contains('on')?'*':'')),box:SL.R(hub)}; };
const BOUTS=aNames=>{ const hub=document.getElementById('skyHub');
  return [...hub.querySelectorAll('.skyBout')].map(b=>{ const m=b.querySelector('.skyBoutSide.mine'), f=b.querySelector('.skyBoutSide.foe'), w=b.querySelector('.skyBoutWatch'); if(w) w.scrollIntoView({block:'nearest'});
    const M=SL.R(m), F=SL.R(f), nm=SL.txt(m&&m.querySelector('.nm'));
    return {n:+(SL.txt(b.querySelector('.skyBoutMid .skyBoutNo')).replace(/\D/g,'')),mine:nm,foe:SL.txt(f&&f.querySelector('.nm')),mineCards:m?m.querySelectorAll('.skyBoutCard').length:0,foeCards:f?f.querySelectorAll('.skyBoutCard').length:0,
      mineLeft:!!M&&!!F&&M.r<=F.x+1,facing:!!M&&!!F&&Math.abs((M.y+M.h/2)-(F.y+F.h/2))<Math.max(M.h,F.h)/2,mineIsUs:aNames.includes(nm),verdict:SL.txt(b.querySelector('.skyBoutVerdict')),
      watch:!!w&&SL.vis(w),watchOn:!!w&&SL.inView(w,2),watchText:SL.txt(w)}; }); };
const hubClose=pg=>pg.evaluate(()=>{ const h=document.getElementById('skyHub'); if(h&&!h.hidden){ SKYSIM.hubOn=false; h.hidden=true; } });
/* a LIVE real war never marks a lane spent (its lanes wait for the next march while the war is live); a finished war's lanes do */
const allDone=()=>[0,1,2,3,4].every(i=>(SKYSIM.laneDone||{})[i]===true);
const allSpent=()=>[0,1,2,3,4].every(i=>(SKYSIM.laneDone||{})[i]===true&&document.querySelector('#skyLC-'+i+'.spent'));

/* the board at a speed, the sampler running from its first frame. first=true: entered from the Guild war tab; else redrawn as a fresh
   device (this device's record of played fights cleared, the way a first visit sees it) */
async function board(pg,S,speed,first){
  if(first){ await pg.evaluate(SAMPLER); await pg.evaluate(sp=>{ skySimSetSpeed(sp); },speed);
    const btn=await pg.evaluate(()=>{ const b=[...document.querySelectorAll('#gTabBody button')].find(x=>/show\('skyfall'\)/.test(x.getAttribute('onclick')||'')); if(b){ b.id='slSkyEnter'; b.scrollIntoView({block:'center'}); } return !!b; });
    if(btn) await press(pg,S,'#slSkyEnter'); else await pg.evaluate(()=>show('skyfall'));
    await waitFor(pg,()=>document.getElementById('skyfall').classList.contains('active')&&document.querySelectorAll('#skyStage .skyTower').length===10&&SKY.st&&SKY.st.match,null,30000,'the Skyfall board drawn');
    await H.prep(pg); return btn; }
  await hubClose(pg);
  await pg.evaluate(sp=>{ try{ localStorage.removeItem('ew.skyseen'); }catch(e){} SKYREAL.mid=null; SKYREAL.seen=null; skySimSetSpeed(sp); SKYFALL_VIEW=null; },speed);
  await pg.evaluate(SAMPLER); await pg.evaluate(()=>{ renderSkyfall(null); });
  await H.wait(300); await H.prep(pg); return true; }

async function readBoard(pg){ return pg.evaluate(()=>{ const r=SKYFALL_VIEW||{}, norm=u=>{ try{ return new URL(u,location.href).pathname; }catch(e){ return u||''; } };
  const walkU=team=>{ for(const k of (team||[])) if(BATTLE_ANIM[k]&&BATTLE_ANIM[k].walk&&BATTLE_ANIM[k].walk.u) return {k,u:norm(BATTLE_ANIM[k].walk.u)}; return {k:null,u:null}; };
  return {real:!!r.real,on:SKYREAL.on,speed:SKYSIM.speed,speeds:SKYSIM_SPEEDS,sandbox:skySimSandbox(),stage:SL.txt('#skyStagePill'),
    log:(r.log||[]).map(e=>{ const mineT=(e.side==='A'?e.aTeam:e.dTeam)||[], foeT=(e.side==='A'?e.dTeam:e.aTeam)||[];
      return {n:e.n,lane:e.lane,side:e.side,a:e.a,d:e.d,won:e.won,rounds:e.rounds,ms:skyFightMs(e),aDown:e.aDown,dDown:e.dDown,lead:{mine:(mineT[0]||{}).k,foe:(foeT[0]||{}).k},walk:{mine:walkU(mineT.map(h=>h.k)),foe:walkU(foeT.map(h=>h.k))}}; })}; }); }

/* ============================== checks ============================== */
async function missedLine(pg,S,W){ step(S.tag+' check: No auto-placement');
  await openGuild(pg,S,'war');
  await waitFor(pg,()=>!!document.querySelector('#gTabBody .skyMissed'),null,15000,'the skyMissed line on the war tab');
  const srv=(await R.api(W.s,'/api/guild-war/status')).body, you=srv&&srv.match&&srv.match.you||{};
  const r=await pg.evaluate(([n,m])=>{ const el=document.querySelector('#gTabBody .skyMissed'); if(el) el.scrollIntoView({block:'center'});
    return {shown:!!el&&SL.vis(el),inView:!!el&&SL.inView(el,2),text:SL.txt(el),want:t('skyfall.missed_lock',{n,m})}; },[you.missedMembers|0,you.missedLines|0]);
  const nums=(r.text.match(/\d+/g)||[]).map(Number), s1=await shot(pg,S.tag+' No auto-placement missed line');
  C.ok(r.shown&&r.inView&&r.text.endsWith(r.want)&&nums[0]===(you.missedMembers|0)&&nums[1]===(you.missedLines|0),
    S.tag+' No auto-placement: the guild\'s war board shows "'+r.text+'" = the server\'s missedMembers '+(you.missedMembers|0)+' / missedLines '+(you.missedLines|0),{...r,shot:s1});
  C.ok((you.missedMembers|0)===1&&(you.missedLines|0)===1,S.tag+' No auto-placement: the server counts the one member who never placed (Late69, 1 line) as missed - nobody placed him',{server:{missedMembers:you.missedMembers,missedLines:you.missedLines},shot:s1}); }

/* a lane's Records: via its swords (a live war: they stay up once the lane has fought) then the Records tab, or via a spent lane's tower */
async function recordsRows(pg,S,W,lane,label,via,check){
  await hubClose(pg);
  const spent=await pg.evaluate(i=>!!document.querySelector('#skyLC-'+i+'.spent'),lane);
  let how;
  if(via==='tower'){ how=await tapEl(pg,S,'#skyTower-you-'+lane); await H.wait(800); }
  else { how=await tapEl(pg,S,'#skyLC-'+lane); await H.wait(600);
    await pg.evaluate(()=>{ const b=document.querySelectorAll('#skyHub .skyHubTabs button')[1]; if(b) b.id='slRecTab'; }); how+=' + Records tab '+(await tapEl(pg,S,'#slRecTab')); await H.wait(600); }
  const h=await pg.evaluate(HUB), bouts=await pg.evaluate(BOUTS,W.aLineNames), laneLog=W.log.filter(e=>e.lane===lane);
  if(!check) return {bouts,hub:h};
  const s1=await shot(pg,S.tag+' Records rows lane '+lane+' '+label);
  const listed=h.open&&h.lane===lane&&h.tab==='records'&&bouts.length===laneLog.length&&bouts.every((b,i)=>b.n===laneLog[laneLog.length-1-i].n);
  if(via==='tower') C.ok(spent&&listed,S.tag+' Lane report: tapping spent lane '+lane+'\'s tower ['+how+'] opens its Records ("'+h.title+'"): '+bouts.length+' fight(s) #'+bouts.map(b=>b.n).join(', #')+' = the server\'s',{spent,hub:h,server:laneLog.map(e=>e.n),shot:s1});
  else {
    C.ok(listed,S.tag+' Lane report: lane '+lane+'\'s swords ['+how+'] open its Records ("'+h.title+'"): #'+bouts.map(b=>b.n).join(', #')+' = the server\'s fights on that lane',{hub:h,server:laneLog.map(e=>e.n),shot:s1});
    const e=laneLog[0], b=bouts.find(x=>x.n===(e&&e.n));
    C.ok(!!b&&b.mineCards===5&&b.foeCards===5&&b.facing&&b.mineLeft&&b.mineIsUs&&b.watch&&b.watchOn,
      S.tag+' Records rows: fight #'+(e&&e.n)+' ('+(e&&e.side==='A'?'we marched':'THEY marched')+') shows both line-ups facing each other, ours on the left ("'+(b&&b.mine)+'" | "'+(b&&b.foe)+'", '+(b&&b.mineCards)+' + '+(b&&b.foeCards)+' cards) with a "'+(b&&b.watchText)+'" button',{row:b,server:e&&{n:e.n,side:e.side,a:e.a,d:e.d},shot:s1}); }
  return {bouts,hub:h}; }

async function bracketLook(pg,S){ step(S.tag+' check: Bracket panel');
  await hubClose(pg);
  await tapEl(pg,S,'#skyMenuBtn'); await H.wait(300); await tapEl(pg,S,'#skyBracket');
  await waitFor(pg,()=>!!document.querySelector('.skyBrkBody'),null,10000,'the bracket panel'); await H.wait(800);
  const r=await pg.evaluate(()=>{ const b=document.querySelector('.skyBrkBody'); if(!b) return {none:true}; const B=b.getBoundingClientRect();
    const nodes=[...b.querySelectorAll('.skyBrkNode')], cup=b.querySelector('.skyBrkCup2'), svg=b.querySelector('svg.skyBrkSvg'), paths=svg?[...svg.querySelectorAll('path')]:[];
    const segs=paths.map(p=>{ const n=(p.getAttribute('d').match(/-?[\d.]+/g)||[]).map(Number); const o=[]; for(let i=0;i<n.length;i+=2) o.push({x:n[i],y:n[i+1]}); return o; });
    const near=(a,b)=>Math.abs(a.x-b.x)<0.05&&Math.abs(a.y-b.y)<0.05, cupX=cup?parseFloat(cup.style.left):NaN, cupY=cup?parseFloat(cup.style.top):NaN;
    const reach=nodes.map(n=>{ let at={x:parseFloat(n.style.left),y:parseFloat(n.style.top)}; for(let k=0;k<6;k++){ const s=segs.find(s=>near(s[0],at)); if(!s) return false; at=s[s.length-1]; if(Math.abs(at.x-cupX)<0.05&&Math.abs(at.y-cupY)<=10) return true; } return false; });
    const ys=[...new Set(nodes.map(n=>Math.round(n.getBoundingClientRect().top)))].sort((a,b)=>a-b), CR=cup?cup.getBoundingClientRect():null;
    return {nodes:nodes.length,crests:nodes.filter(n=>n.querySelector('.crest svg')).length,names:nodes.map(n=>SL.txt(n.querySelector('.nm'))),rows:ys.length,perRow:ys.map(y=>nodes.filter(n=>Math.round(n.getBoundingClientRect().top)===y).length),
      cup:!!cup&&SL.vis(cup),cupAt:CR?Math.round((CR.left+CR.width/2-B.left)/B.width*100)+'%,'+Math.round((CR.top+CR.height/2-B.top)/B.height*100)+'%':null,
      paths:paths.length,reachCup:reach.filter(Boolean).length,allOn:nodes.every(n=>SL.inView(n,2))}; });
  const s1=await shot(pg,S.tag+' Bracket panel');
  C.look(S.tag+' Bracket panel (for Phil\'s wording): '+(r.none?'no bracket panel opened':r.crests+' guild crests ('+r.nodes+' nodes) in '+r.rows+' rows of '+r.perRow.join(' + ')+', '+r.paths+' path pieces, '+r.reachCup+' of '+r.nodes+' crests\' paths run to the cup at '+r.cupAt+' (the centre), all on screen: '+r.allOn),{...r,shot:s1});
  await pg.evaluate(()=>{ document.querySelectorAll('.skyPanel,#skyPanel').forEach(n=>n.remove()); }); }

/* no garrison disc goes down and no tower falls while that lane's fight is still playing */
function earlyResults(smp,lanes){ const early=[], seen=[];
  for(const x of lanes){ const l=smp.lanes[x.lane], st=(l.starts[0]||{}).laneStart, dn=l.dones[0]; if(!st||!dn) continue; seen.push(x.lane);
    for(const sd of ['you','foe']){ for(const g of l.gar[sd].slice(1)) if(g.t>st&&g.t<dn-60) early.push({lane:x.lane,side:sd,disc:g.v,atMs:g.t-st,doneMs:dn-st});
      if(l.towerFall[sd]!=null&&l.towerFall[sd]<dn-60) early.push({lane:x.lane,side:sd,tower:'fell',atMs:l.towerFall[sd]-st,doneMs:dn-st}); } }
  return {early,seen,discs:lanes.map(x=>({lane:x.lane,you:smp.lanes[x.lane].gar.you.map(g=>g.v).join(' > '),foe:smp.lanes[x.lane].gar.foe.map(g=>g.v).join(' > ')}))}; }
const durOf=(smp,i)=>{ const L=smp.lanes[i], d=L.dones[0]; if(d==null) return null; const st=L.starts.filter(x=>x.t<=d).pop(); return st?d-st.laneStart:null; };

/* ---------------- pass 1: x20 ---------------- */
async function fastPass(pg,S,W,lanes){ step(S.tag+' pass 1 (x'+FAST+'): board');
  const btn=await board(pg,S,FAST,true);
  const info=await readBoard(pg), s0=await shot(pg,S.tag+' Skyfall real war board x'+FAST);
  C.ok(info.real&&info.on&&!info.sandbox&&info.log.length===5&&info.speed===FAST&&Math.max(...info.speeds)===FAST,S.tag+' Skyfall: the board is the REAL war ('+info.log.length+' real fights, the real-war lane player, not the simulator), played at x'+info.speed+' (the page\'s fastest of '+info.speeds.join('/')+'), stage '+info.stage+(btn?'':' [opened with show(), no Enter button found]'),
    {real:info.real,on:info.on,sandbox:info.sandbox,log:info.log.map(e=>({n:e.n,lane:e.lane,side:e.side,rounds:e.rounds,ms:e.ms})),shot:s0});
  lanes.forEach(x=>{ const e=info.log.find(y=>y.lane===x.lane); if(e) Object.assign(x,{e,leadMine:e.walk.mine.u,leadFoe:e.walk.foe.u,leadMineKey:e.lead.mine,leadFoeKey:e.lead.foe});
    if(e&&(e.walk.mine.k!==e.lead.mine||e.walk.foe.k!==e.lead.foe)) console.log('  INFO   '+S.tag+' lane '+x.lane+': a lead hero has no walk sheet - the board walks the line\'s first hero that has one ('+JSON.stringify({lead:e.lead,walks:[e.walk.mine.k,e.walk.foe.k]})+')'); });
  const maxMs=Math.max(...lanes.map(x=>(x.e&&x.e.ms)||0));
  step(S.tag+' pass 1: all lanes play out');
  const done=await waitFor(pg,allDone,null,Math.round(maxMs/FAST)+30000,'all 5 lanes played out at x'+FAST,200);
  await H.wait(500); const smp=await pg.evaluate(SAMPLES), s1=await shot(pg,S.tag+' Skyfall all lanes played x'+FAST);
  step(S.tag+' check: Five lanes at once (no early result)');
  const iv=lanes.map(x=>({lane:x.lane,start:(smp.lanes[x.lane].starts[0]||{}).laneStart||null,done:smp.lanes[x.lane].dones[0]||null}));
  const overlap=iv.every(x=>x.start&&x.done)&&Math.max(...iv.map(x=>x.start))<Math.min(...iv.map(x=>x.done));
  const er=earlyResults(smp,lanes);
  C.ok(done&&er.seen.length===5&&er.early.length===0,S.tag+' Five lanes at once: no lane shows its result before its fight has finished playing (x'+FAST+': no garrison disc goes down and no tower falls mid-fight on any of the 5 lanes)',{...er,shots:[s0,s1]});
  step(S.tag+' check: Fight duration (longest, x'+FAST+')');
  const lng=lanes.slice().sort((a,b)=>(b.e?b.e.ms:0)-(a.e?a.e.ms:0))[0], d=durOf(smp,lng.lane), exp=lng.e?lng.e.ms:0, tol=FAST*150+0.08*exp;
  C.ok(d!=null&&exp>=10000&&exp<=180000&&Math.abs(d*FAST-exp)<=tol&&lng.e.rounds===lng.srvRounds,
    S.tag+' Fight duration (longest): lane '+lng.lane+'\'s fight #'+(lng.e&&lng.e.n)+' ('+(lng.e&&lng.e.rounds)+' rounds) plays '+(d==null?'?':(d/1000).toFixed(2))+' s at x'+FAST+' = '+(d==null?'?':(d*FAST/1000).toFixed(1))+' s of board time; skyFightMs says '+(exp/1000).toFixed(1)+' s (10-180 s)',
    {lane:lng.lane,rounds:lng.e&&lng.e.rounds,serverRounds:lng.srvRounds,measuredMs:d,boardMs:d==null?null:d*FAST,expectedMs:exp,toleranceMs:Math.round(tol),overlap,intervals:iv,shot:s1});
  step(S.tag+' check: Records rows (a fight we marched, a fight they marched)');
  const ours=lanes.find(x=>x.e&&x.e.side==='A'), theirs=lanes.find(x=>x.e&&x.e.side==='B');
  if(ours) await recordsRows(pg,S,W,ours.lane,'(we marched)','swords',true); else C.ok(false,S.tag+' Records rows: a fight we marched',{});
  if(theirs) await recordsRows(pg,S,W,theirs.lane,'(they marched)','swords',true); else C.ok(false,S.tag+' Records rows: a fight they marched',{});
  await bracketLook(pg,S);
  return {overlap,iv}; }

/* ---------------- pass 2: x1 (real time) ---------------- */
async function realPass(pg,S,W,lanes,p1){ step(S.tag+' pass 2 (x1, a fresh device): board');
  await board(pg,S,1,false);
  const info=await readBoard(pg), s0=await shot(pg,S.tag+' Skyfall real war board x1');
  C.ok(info.on&&info.speed===1&&info.log.length===5,S.tag+' Skyfall: the same real war replayed from its start at x1 (this device\'s played-fights record cleared, as a first visit)',{on:info.on,speed:info.speed,shot:s0});
  const byMs=lanes.slice().sort((a,b)=>a.e.ms-b.e.ms), short=byMs[0].lane, long=byMs[4].lane;
  console.log('  INFO   '+S.tag+' the fights: '+lanes.map(x=>'lane '+x.lane+' #'+x.e.n+' '+x.e.side+' '+x.e.rounds+'r '+(x.e.ms/1000).toFixed(1)+'s').join(' | ')+' -> short lane '+short+', long lane '+long);
  /* the long lane's swords: Live, then Records, while it fights */
  step(S.tag+' check: Lane report (swords) + Live fight view, lane '+long);
  const on=await waitFor(pg,i=>{ const c=document.getElementById('skyLC-'+i); return c&&c.classList.contains('skyHot')&&SL.vis(c); },long,Math.round(byMs[4].e.ms*0.5)+15000,'lane '+long+'\'s swords going up');
  const how=on?await tapEl(pg,S,'#skyLC-'+long):'swords never went up';
  await H.wait(700);
  const read=()=>pg.evaluate(()=>{ const hub=document.getElementById('skyHub'), q=s=>hub.querySelector(s), g1=q('.skyLFG.mine'), g2=q('.skyLFG.foe'), sm=q('.skyLFSide.mine'), sf=q('.skyLFSide.foe'), ck=q('.skyLFClock');
    const RR=e=>e?SL.R(e):null, cols=[...hub.querySelectorAll('.skyLFWait .skyLFCol')];
    return {gMine:SL.txt(g1&&g1.querySelector('.gn')),gMineLines:SL.txt(g1&&g1.querySelector('.tl')),gFoe:SL.txt(g2&&g2.querySelector('.gn')),gFoeLines:SL.txt(g2&&g2.querySelector('.tl')),
      guildsRow:!!g1&&!!g2&&RR(g1).r<=RR(g2).x+1,order:!!sm&&!!ck&&!!sf&&RR(sm).r<=RR(ck).x+1&&RR(ck).r<=RR(sf).x+1,
      mineName:SL.txt(sm&&sm.querySelector('.skyLFNm .n')),foeName:SL.txt(sf&&sf.querySelector('.skyLFNm .n')),mineCards:sm?sm.querySelectorAll('.skyLFCard').length:0,foeCards:sf?sf.querySelectorAll('.skyLFCard').length:0,
      lbl:SL.txt(ck&&ck.querySelector('.lbl')),clock:SL.txt(document.getElementById('skyLFClockT')),verdict:!!(ck&&ck.querySelector('.verdict')),
      waitHd:SL.txt(q('.skyLFWaitHd')),cols:cols.map(c=>({box:SL.R(c),rows:[...c.querySelectorAll('.skyLFRow')].map(x=>SL.txt(x.querySelector('.nm'))),empty:!!c.querySelector('.skyLFEmpty')})),
      laneDone:(SKYSIM.laneDone||{})[SKYSIM.hubLane]}; });
  const h0=await pg.evaluate(HUB), v0=await read(), t0=Date.now(); await H.wait(2600); const v1=await read(), dt=(Date.now()-t0)/1000;
  const s1=await shot(pg,S.tag+' Live fight view lane '+long);
  const L=W.view.you.citadels[long], F=W.view.foe.citadels[long];
  C.ok(on&&h0.open&&h0.lane===long&&h0.title.includes(L.name)&&h0.tab==='live',S.tag+' Lane report: tapping lane '+long+'\'s swords ['+how+'] opens that lane\'s report ("'+h0.title+'", tabs '+(h0.tabs||[]).join(' / ')+')',{hub:h0,shot:s1});
  const c0=mmss(v0.clock), c1=mmss(v1.clock), num=x=>+((String(x).match(/\d+/)||[])[0]), wantMine=L.defenders.length, wantFoe=F.defenders.length;
  C.ok(v0.gMine===W.gAName&&v0.gFoe===W.gBName&&v0.guildsRow&&num(v0.gMineLines)===wantMine&&num(v0.gFoeLines)===wantFoe,
    S.tag+' Live fight view: both guilds side by side - "'+v0.gMine+'" ('+v0.gMineLines+') and "'+v0.gFoe+'" ('+v0.gFoeLines+'), lines left = the lane\'s '+wantMine+' / '+wantFoe+' lines (none down yet)',{v:v0,shot:s1});
  C.ok(v0.order&&v0.mineCards===5&&v0.foeCards===5&&v0.lbl==='IN BATTLE'&&!v0.verdict&&v0.laneDone===false&&c0!=null&&c1!=null&&c1-c0>=Math.floor(dt)-1&&c1-c0<=Math.ceil(dt)+1,
    S.tag+' Live fight view: the current fight ('+v0.mineName+' vs '+v0.foeName+', 5 cards each, yours left) with its clock running '+v0.clock+' -> '+v1.clock+' in '+dt.toFixed(1)+' s, "'+v0.lbl+'", no verdict while it plays',{v0,v1,shot:s1});
  const mineQ=L.defenders.map(d=>d.name).filter(n=>n!==v0.mineName), foeQ=F.defenders.map(d=>d.name).filter(n=>n!==v0.foeName), srt=a=>JSON.stringify(a.slice().sort());
  C.ok(v0.waitHd==='WAITING TROOPS'&&v0.cols.length===2&&v0.cols[0].box.r<=v0.cols[1].box.x+1&&srt(v0.cols[0].rows)===srt(mineQ)&&srt(v0.cols[1].rows)===srt(foeQ),
    S.tag+' Live fight view: waiting troops in two columns side by side - yours ['+v0.cols.map(c=>c.rows.join(', ')||'-').join('] / theirs [')+'] = the lane\'s lines not in the fight',{cols:v0.cols,want:{mine:mineQ,foe:foeQ},shot:s1});
  await pg.evaluate(()=>{ const b=document.querySelectorAll('#skyHub .skyHubTabs button')[1]; if(b) b.id='slRecTab'; });
  const how2=await tapEl(pg,S,'#slRecTab'); await H.wait(600);
  const rec=await pg.evaluate(()=>({hub:{tab:SKYSIM.hubTab,lane:SKYSIM.hubLane},fighting:(SKYSIM.laneDone||{})[SKYSIM.hubLane]===false,cur:(SKYFALL_VIEW.log[(SKYSIM.laneCur||{})[SKYSIM.hubLane]]||{}).n}));
  rec.bouts=await pg.evaluate(BOUTS,W.aLineNames);
  const s2=await shot(pg,S.tag+' Lane report records while fighting lane '+long), laneNs=W.log.filter(e=>e.lane===long).map(e=>e.n);
  C.ok(rec.hub.tab==='records'&&rec.bouts.every(b=>laneNs.includes(b.n)),S.tag+' Lane report: the swords\' Records tab ['+how2+'] lists only lane '+long+'\'s fights (#'+rec.bouts.map(b=>b.n).join(', #')+')',{rec,laneNs,shot:s2});
  const early=rec.bouts.filter(b=>b.n===rec.cur&&b.verdict);
  C.ok(rec.fighting&&!early.length,S.tag+' Five lanes at once: while lane '+long+'\'s fight #'+rec.cur+' is still playing, its Records row shows no result'+(early.length?' (it shows "'+early[0].verdict+'")':''),{fighting:rec.fighting,current:rec.cur,rows:rec.bouts,shot:s2});
  await hubClose(pg);
  /* every lane has reached its clash (so every walk is over), and the short lane has finished */
  step(S.tag+' pass 2: every lane clashed, short lane '+short+' finished');
  await waitFor(pg,()=>window._slS&&window._slS.lanes.every((l,i)=>l.clashOn!=null||(SKYSIM.laneDone||{})[i]===true),null,40000,'every lane\'s swords going up at x1',200);
  await waitFor(pg,i=>(SKYSIM.laneDone||{})[i]===true,short,byMs[0].e.ms+20000,'short lane '+short+' finishing at x1',200);
  const smpA=await pg.evaluate(SAMPLES), s3=await shot(pg,S.tag+' Skyfall x1 short lane done');
  step(S.tag+' check: Five lanes at once (side by side, x1)');
  C.ok(smpA.maxFight===5&&smpA.maxSwords===5&&p1.overlap,S.tag+' Five lanes at once: all 5 lanes fight side by side (5 lanes fighting and 5 crossed swords on the board at one moment at x1; at x'+FAST+' every lane\'s fight overlapped every other\'s)',
    {maxFighting:smpA.maxFight,maxSwords:smpA.maxSwords,x20:p1.iv,samples:smpA.samples,err:smpA.err,shot:s3});
  step(S.tag+' check: Fight duration (shortest, x1)');
  const sl=byMs[0], d=durOf(smpA,short), exp=sl.e.ms, tol=1500+0.10*exp;
  C.ok(d!=null&&exp>=10000&&exp<=180000&&Math.abs(d-exp)<=tol&&sl.e.rounds===sl.srvRounds,S.tag+' Fight duration (shortest): lane '+short+'\'s fight #'+sl.e.n+' ('+sl.e.rounds+' rounds) is on the board '+(d==null?'?':(d/1000).toFixed(1))+' s at x1; skyFightMs says '+(exp/1000).toFixed(1)+' s (10-180 s)',
    {lane:short,rounds:sl.e.rounds,serverRounds:sl.srvRounds,measuredMs:d,expectedMs:exp,toleranceMs:Math.round(tol),shot:s3});
  step(S.tag+' check: Marching heroes');
  const walks=lanes.map(x=>{ const l=smpA.lanes[x.lane], st=(l.starts[0]||{}).t||0, ws=Object.values(smpA.walkers).filter(w=>w.lane===x.lane&&w.first.t>=st-300&&(l.clashOn==null||w.first.t<=l.clashOn));
    const chk=w=>{ const d0=Math.hypot(w.first.x-w.mid.x,w.first.y-w.mid.y), d1=Math.hypot(w.last.x-w.mid.x,w.last.y-w.mid.y);
      return {mine:w.mine,from:w.end,startDist:w.endDist,toMid:+(d1/Math.max(0.01,d0)).toFixed(2),goneBeforeSwords:w.gone!=null&&l.clashOn!=null&&w.gone<=l.clashOn+100,sprite:w.sprite,name:w.name,onScreen:w.onScreen}; };
    const mine=ws.find(w=>w.mine), foe=ws.find(w=>!w.mine), M=mine&&chk(mine), Fo=foe&&chk(foe);
    const ok=!!M&&!!Fo&&M.from==='a'&&Fo.from==='b'&&M.startDist<3&&Fo.startDist<3&&M.toMid<0.25&&Fo.toMid<0.25&&M.goneBeforeSwords&&Fo.goneBeforeSwords&&M.onScreen&&Fo.onScreen&&!!M.sprite&&M.sprite===x.leadMine&&!!Fo.sprite&&Fo.sprite===x.leadFoe;
    return {lane:x.lane,ok,walkers:ws.length,mine:M,foe:Fo,want:{mine:x.leadMine,foe:x.leadFoe,mineKey:x.leadMineKey,foeKey:x.leadFoeKey}}; });
  C.ok(walks.every(w=>w.ok),S.tag+' Marching heroes: on every lane both lines\' lead heroes walk the bridge from their own tower to the middle (the lead hero\'s walk sheet) and are gone before the swords go up ('+walks.map(w=>'lane '+w.lane+(w.ok?' ok':' NO')).join(', ')+')',{walks,shot:s3});
  /* Watch from the short lane's Records while the others may still fight */
  step(S.tag+' check: Watch a march');
  await recordsRows(pg,S,W,short,'(for Watch)','swords',false);
  const n=await pg.evaluate(()=>{ const w=document.querySelector('#skyHub .skyBout .skyBoutWatch'); if(!w) return null; w.id='slWatch'; w.scrollIntoView({block:'center'});
    return +(SL.txt(w.closest('.skyBout').querySelector('.skyBoutMid .skyBoutNo')).replace(/\D/g,'')); });
  if(!n){ C.ok(false,S.tag+' Watch a march: a Watch button in lane '+short+'\'s Records'); return; }
  const before=await pg.evaluate(()=>({tok:SKYREAL.tok,on:SKYREAL.on,done:Object.assign({},SKYSIM.laneDone),cur:Object.assign({},SKYSIM.laneCur)}));
  const srv=(await R.api(W.s,'/api/guild-war/fight','POST',{n})).body||{};
  const how3=await tapEl(pg,S,'#slWatch');
  const inBattle=await waitFor(pg,()=>state==='battle'&&CUR&&CUR.mode==='replay',null,60000,'the Watch replay battle starting');
  await H.wait(2000);
  const b=await pg.evaluate(()=>({state,mode:CUR&&CUR.mode,seed:CUR&&CUR.seed,ally:((CUR&&CUR.replayAlly)||[]).map(h=>h.key),foe:((CUR&&CUR.replayFoe)||[]).map(h=>h.key),
    leave:SL.vis('#leaveBtn')&&SL.inView('#leaveBtn'),leaveText:SL.txt('#leaveBtn'),skip:SL.vis('#skipBtn'),tok:SKYREAL.tok,on:SKYREAL.on,paused:!!SKYSIM.paused}));
  const s4=await shot(pg,S.tag+' Watch a march battle');
  const f=srv.fight||{}, sa=((f.a||{}).snaps||[]).map(h=>h.key), sd=((f.d||{}).snaps||[]).map(h=>h.key);
  C.ok(inBattle&&b.mode==='replay'&&srv.ok&&(b.seed>>>0)===(f.seed>>>0)&&JSON.stringify(b.ally)===JSON.stringify(sa)&&JSON.stringify(b.foe)===JSON.stringify(sd),
    S.tag+' Watch a march: Watch on fight #'+n+' ['+how3+'] plays the STORED fight - seed '+b.seed+' = the server\'s '+(f.seed>>>0)+', lines ['+b.ally.join(',')+'] vs ['+b.foe.join(',')+'] = the stored '+(f.a&&f.a.name)+' vs '+(f.d&&f.d.name),
    {battle:b,server:{n:f.n,seed:f.seed,a:sa,d:sd,won:srv.won},shot:s4});
  C.ok(inBattle&&b.leave&&!b.skip,S.tag+' Watch a march: the battle has "'+b.leaveText+'" and no Skip',{leave:b.leave,skip:b.skip,shot:s4});
  await H.wait(6000);
  const mid=await pg.evaluate(()=>({tok:SKYREAL.tok,on:SKYREAL.on,paused:!!SKYSIM.paused,done:Object.assign({},SKYSIM.laneDone),cur:Object.assign({},SKYSIM.laneCur),state}));
  const wasFighting=[0,1,2,3,4].filter(i=>before.done[i]===false), finished=wasFighting.filter(i=>mid.done[i]===true), reset=wasFighting.filter(i=>mid.done[i]!==true&&mid.cur[i]!==before.cur[i]);
  const s5=await shot(pg,S.tag+' Watch a march war still running');
  C.ok(mid.state==='battle'&&mid.tok===before.tok&&mid.on&&!mid.paused&&!reset.length,
    S.tag+' Watch a march: the war keeps running while the fight is watched (same lane player, not paused; lanes fighting when Watch was tapped: '+(wasFighting.join(',')||'none')+', finished meanwhile: '+(finished.join(',')||'none')+')',{before,mid,shot:s5});
  const tLeave=Date.now(); await tapEl(pg,S,'#leaveBtn');
  await waitFor(pg,()=>document.getElementById('skyfall').classList.contains('active')&&!!document.getElementById('skyStage'),null,20000,'back on the Skyfall board after Leave');
  await H.wait(6000); await H.prep(pg);
  const smpB=await pg.evaluate(SAMPLES), s6=await shot(pg,S.tag+' Watch a march after Leave');
  const again=lanes.filter(x=>smpB.lanes[x.lane].starts.some(st=>st.t>=tLeave)).map(x=>({lane:x.lane,starts:smpB.lanes[x.lane].starts.map(st=>st.t-tLeave),dones:smpB.lanes[x.lane].dones.map(t=>t-tLeave)}));
  C.ok(again.length===0,S.tag+' Watch a march: after Leave the board carries on from where the war was - no lane plays its fight again from the start (board rebuilt '+smpB.stageSwaps+' time(s); lanes still fighting at Leave: '+([0,1,2,3,4].filter(i=>mid.done[i]===false).join(',')||'none')+')',{restarted:again,shot:s6});
  await pg.evaluate(()=>{ if(window._slS) clearInterval(window._slS.iv); }); }

/* ---------------- after the bell: a finished war's spent lanes hand their report to the tower ---------------- */
async function spentTower(pg,S,W){ step(S.tag+' check: Lane report (spent lane\'s tower, finished war)');
  await hubClose(pg);
  await pg.evaluate(async()=>{ try{ await skyStatus(); }catch(e){} });
  const st=await pg.evaluate(()=>((SKY.st&&SKY.st.match)||{}).state);
  await board(pg,S,FAST,false);
  const maxMs=Math.max(...W.results.map(x=>x.ms));
  const ok=await waitFor(pg,allSpent,null,Math.round(maxMs/FAST)+30000,'every lane of the finished war spent at x'+FAST,200);
  const lane=(W.log.find(e=>e.side==='A')||W.log[0]).lane;
  const s0=await shot(pg,S.tag+' Skyfall finished war lanes spent');
  C.ok(st==='finished'&&ok,S.tag+' Lane report: after the 20:00 bell the war is finished ('+st+') and its replayed lanes are spent (swords and lines off)',{state:st,spent:ok,shot:s0});
  await recordsRows(pg,S,W,lane,'(spent tower, finished war)','tower',true);
  await pg.evaluate(()=>{ if(window._slS) clearInterval(window._slS.iv); }); }

async function warSize(pg,S,W){
  const lanes=[0,1,2,3,4].map(i=>({lane:i,srvRounds:(W.results.find(x=>x.lane===i)||{}).rounds}));
  await missedLine(pg,S,W);
  const p1=await fastPass(pg,S,W,lanes);
  if(lanes.some(x=>!x.e)){ C.ok(false,S.tag+' the board\'s log has one fight per lane',lanes.map(x=>x.lane+':'+!!x.e)); return; }
  await realPass(pg,S,W,lanes,p1); }

/* ============================== run ============================== */
(async()=>{
  let pg=null, s=null;
  try{
    let W=null;
    try{ W=await setupWar(); s=W.s; }catch(e){ C.ok(false,'setup: a real Skyfall war through the server\'s routes',String(e&&e.stack||e).slice(0,600)); }
    if(W){ step('setup: read the war');
      const st=(await R.api(s,'/api/guild-war/status')).body||{}, m=st.match||{};
      W.view=m; W.log=(m.log||[]).map(e=>({n:e.n,lane:e.lane,side:e.side,a:e.a,d:e.d,rounds:e.rounds,won:e.won}));
      W.aLineNames=((m.you||{}).citadels||[]).flatMap(c=>(c.defenders||[]).map(d=>d.name));
      C.ok(m.state==='live'&&W.log.length===5&&[0,1,2,3,4].every(i=>W.log.filter(e=>e.lane===i).length===1)&&st.tournament&&st.tournament.bracket&&st.tournament.bracket[0].matches.length===8,
        'setup: a LIVE real war ('+W.gAName+' vs '+W.gBName+'), 5 real fights on the server (one per lane, '+W.log.filter(e=>e.side==='B').length+' marched by them), a 16-guild round of 8 matches',
        {fights:W.log,results:W.results,missed:{members:(m.you||{}).missedMembers,lines:(m.you||{}).missedLines}});
      const longest=Math.max(...W.results.map(x=>x.ms));
      C.ok(longest<=60000,'setup: every fight is bounded - the longest is '+(longest/1000).toFixed(1)+' s of board time (<= 60 s)',W.results);
      /* both sizes on the live war (each context kept open), then the bell, then each size's spent-tower check */
      const open=[];
      for(const S of SIZES){ step(S.tag+': game load');
        try{ pg=await R.game(s.port,S); open.push({pg,S}); await warSize(pg,S,W); }
        catch(e){ C.ok(false,S.tag+' Skyfall real war ran to the end',String(e&&e.stack||e).slice(0,600)); try{ if(pg) await shot(pg,S.tag+' error'); }catch(_){} }
        pg=null; }
      step('setup: warp past the 20:00 bell');
      const warped=await R.cap(fetch(s.base+'/api/guild-war/debug-warp',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json','x-token':ADMIN_TOKEN},
        body:JSON.stringify({offsetMs:(W.view.endsAt+60000)-Date.now()})}).then(r=>r.json()),25000,'the bell warp').catch(e=>({error:String(e)}));
      console.log('  INFO   warped past the bell: '+JSON.stringify(warped).slice(0,200));
      for(const o of open){ try{ await spentTower(o.pg,o.S,W); }catch(e){ C.ok(false,o.S.tag+' spent-tower check ran to the end',String(e&&e.stack||e).slice(0,600)); }
        C.ok(o.pg._errs.length===0,o.S.tag+' no page errors',o.pg._errs.slice(0,3)); await R.closeCtx(o.pg); }
      await R.cap(H.closeBrowser(),20000,'closing the browser').catch(()=>{}); }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) await R.closeCtx(pg); await R.stop(s); await R.finish(); }
})();
