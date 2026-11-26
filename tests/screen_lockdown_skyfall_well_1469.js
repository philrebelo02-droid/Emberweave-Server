'use strict';
/* Lockdown checklist 25 Nov 2026 (01 - EVERY FEATURE IN THE GAME.md), v1469 screen checks, in a real browser on this checkout's server
   (temp DBs), at phone 844x390 (touch) and desktop 1280x720. One screenshot per check per size; every check prints what it measured.

   PART A - Skyfall on a REAL war (not the dev simulator). The war is made through the server's own routes, the way v1458's
   test_skyfall_real_fights_1458 does: two guilds (ours: the signed-in player + 5 members, theirs: 5 members) register, every member but
   one places a tower in the placement window (one per lane), the clock is warped past the registration lock and the 18:00 line lock, and
   five real marches are fought through POST /api/guild-war/assault (one per lane, three by our side, two by theirs; the lane-0 march is a
   Lv 60 line against a Lv 1 line = a short fight, the others are equal Lv 30 lines = long ones). Then 14 more guilds are written into the
   round (cosmetic matches, so the bracket has 16 crests) and the server is restarted on that DB.
   - No auto-placement: the member who never placed shows on the guild's war board as missed: the 'skyMissed' line, its members and lines
     counts = the server's missedMembers / missedLines.
   - Five lanes at once: the 5 lanes play side by side (all 5 fighting and all 5 swords up at one moment); no lane shows a result (a
     garrison disc going down, a tower falling, a verdict in its Live or Records panel) before its fight has finished playing.
   - Fight duration: each fight is on the board for skyFightMs(rounds) (10-180 s) - measured for the shortest and the longest fight.
   - Marching heroes: each lane's two line leads walk the bridge (from their own tower to the middle) and are gone before the swords go up.
   - Lane report: tapping a lane's swords opens its Live / Records; tapping a spent lane's tower opens its Records.
   - Records rows: each fight shows both line-ups facing each other with a Watch button, your side on the left (also on a fight THEY marched).
   - Live fight view: both guilds with their lines left, the current fight with a running clock, waiting troops in two columns.
   - Watch a march: Watch plays the STORED fight (the server's seed and both stored lines), the war keeps running behind it, the battle
     has Leave and no Skip; after Leave the lanes carry on from where they were.
   - Bracket panel: what is drawn (crests, rows, paths to the cup) is PRINTED as WATCH (C.look) - Phil is deciding the wording.
   PART B - one Lv 100 player:
   - Starless Well Tent (v1457): standing next to a tent square (the run's position is written into the DB; the map and the tent are the
     server's own, from its map seed), the tent offers 3 different loan heroes, each with its buff (+30% HP / +20% damage, +45% / +30%
     when upgraded a quality) = the server's options, an owned hero is one of them (desktop picks it, the phone picks one not owned), and
     the picked loan joins the run's squad (server loans, the Heroes list "Loan" card, the squad screen of the next fight).
   - City Wall Tap mode tint (v1457): in teleport tap mode #teleVeil is green at an own-region cell and red at an other-region cell (its
     pixels, and the screen pixels with and without the veil), and a tap on the red region drops the refusal pin.
   - Emberdraft Avatar picker: 10 3D avatars offered; a drag on the avatar turns the model (its rotation.y, read from the lobby's own
     three.js scene); a picked avatar sticks (reopen the lobby, reload the page); the rivals' avatars differ from yours and from each other.
   Exit 0 = all passed. WATCH lines are printed for a person to read, never a pass. */
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_skyfall_well_1469.js', C=H.checker(TEST), shot=H.shooter(TEST);
const SIZES=[H.SIZES.phone,H.SIZES.desktop];
const ADMIN_TOKEN='sl1469-admin-token', ADMIN_ID='sl1469-admin';
const K10=['vael','aureth','sylthaine','vireo','brannus','calypsa','dandra','grosk','umbris','lumi'], K5=K10.slice(0,5);
const FAKE_NAMES=['Iron Choir','Storm Ledger','Gilded Thorn','Night Anvil','Crown Embers','Rift Walkers','Salt Crowns','Hollow Pike',
  'Lantern Oath','Frost Banner','Cinder Court','Pale Harbor','Oak Sentinels','Last Beacon'];
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const press=(pg,S,sel)=>S.touch?pg.tap(sel,{timeout:10000}):pg.click(sel,{timeout:10000});
/* a player's tap; if something covers the element (playwright refuses the tap), the element's own click, and that is printed */
async function tapEl(pg,S,sel){ try{ await press(pg,S,sel); return 'tap'; }catch(e){
  const ok=await pg.evaluate(s=>{ const el=document.querySelector(s); if(!el) return false; el.click(); return true; },sel);
  const why=String(e.message||e).split('\n'), line=why.find(l=>/intercept|not visible|outside/i.test(l))||why[0];
  return ok?'js click (tap refused: '+line.trim().slice(0,140)+')':'missing'; } }
async function tapAt(pg,S,x,y){ if(S.touch) await pg.touchscreen.tap(x,y); else await pg.mouse.click(x,y); }
const mmss=s=>{ const m=/^(\d+):(\d+)$/.exec(String(s||'').trim()); return m?(+m[1])*60+(+m[2]):null; };

/* ============================== PART A: a real Skyfall war ============================== */
async function setupWar(){
  const {file}=H.seedDB(Object.fromEntries(K10.map(k=>[k,60])),u=>{ u.led.gold=100000; });
  { const db=JSON.parse(fs.readFileSync(file,'utf8')), me=db.users[H.UID], now=Date.now();
    const a=JSON.parse(JSON.stringify(me)); a.id=ADMIN_ID; a.name='Skyfall Admin'; a.role='admin'; db.users[ADMIN_ID]=a; db.byName[a.name.toLowerCase()]=ADMIN_ID;
    db.tokens[sha(ADMIN_TOKEN)]={id:ADMIN_ID,iat:now,exp:now+90*86400000}; fs.writeFileSync(file,JSON.stringify(db)); }
  let s=await H.server(file,{ADMIN_IDS:ADMIN_ID});
  /* every call through the server's routes; a 429 (the war routes allow 30 calls per 30 s per address) waits and tries again */
  const req=async(method,route,data,token)=>{ for(let i=0;;i++){
    const r=await fetch(s.base+route,{method,headers:Object.assign({'content-type':'application/json'},token===null?{}:{'x-token':token||H.TOKEN}),body:data?JSON.stringify(data):undefined});
    let j=null; try{ j=await r.json(); }catch(_){}
    if(r.status===429&&i<15){ await H.wait(5000); continue; } return j||{status:r.status}; } };
  const need=(c,what,v)=>{ if(!c) throw new Error(what+': '+JSON.stringify(v).slice(0,300)); };
  const mk=async(name,keys,level)=>{ const u=await req('POST','/api/register',{name,pass:'password1'},null); need(u&&u.token&&u.profile,'register '+name,u);
    const g=await req('POST','/api/admin/led-grant',{userId:u.profile.id,unlock:keys,heroKeys:keys,heroXp:level>1?H.xpFor(level):0,px:900000},ADMIN_TOKEN); need(g&&g.ok,'led-grant '+name,g);
    return {name,id:u.profile.id,token:u.token,keys,level}; };
  const me={name:'Screen Check',id:H.UID,token:H.TOKEN,keys:K10,level:60};
  const A={a1:await mk('Alder69',K10,30),a2:await mk('Birch69',K5,30),a3:await mk('Cedar69',K5,30),a4:await mk('Elm69',K5,30),miss:await mk('Late69',K5,30)};
  const B={b0:await mk('Raw69',K5,1),b1:await mk('Rowan69',K10,30),b2:await mk('Spruce69',K5,30),b3:await mk('Thorn69',K5,30),b4:await mk('Yew69',K5,30)};
  const ga=await req('POST','/api/guild/create',{name:'Ember Vanguard'},me.token); need(ga&&ga.guild,'guild A',ga);
  const gb=await req('POST','/api/guild/create',{name:'Ashen Pact'},B.b1.token); need(gb&&gb.guild,'guild B',gb);
  const join=async(u,gid,lead)=>{ const r1=await req('POST','/api/guild/request',{guildId:gid},u.token); need(r1&&r1.ok,'request '+u.name,r1);
    const r2=await req('POST','/api/guild/approve',{id:u.id},lead.token); need(r2&&r2.guild,'approve '+u.name,r2); };
  for(const u of Object.values(A)) await join(u,ga.guild.id,me);
  for(const u of [B.b0,B.b2,B.b3,B.b4]) await join(u,gb.guild.id,B.b1);
  /* the war calendar, as test_skyfall_real_fights_1458 runs it */
  const status=await req('GET','/api/guild-war/status',null,me.token); need(status&&status.tournament,'status',status);
  const t=status.tournament, now=Date.now();
  let opening=t.registrationOpensAt; if(now>=t.registrationLocksAt) opening=t.nextRegistrationOpensAt||opening+14*86400000;
  const warp=async at=>req('POST','/api/guild-war/debug-warp',{offsetMs:at-Date.now()},ADMIN_TOKEN);
  const w1=await warp(Math.max(now,opening+60000)); need(w1&&w1.state==='registration','warp to registration',w1);
  const active=await req('GET','/api/guild-war/status',null,me.token);
  for(const u of [me,B.b1]){ const r=await req('POST','/api/guild-war/register',{},u.token); need(r&&r.ok,'war register '+u.name,r); }
  /* one tower per member, one member per lane on each side; Late69 never places (the missed member) */
  const lanes=[[me,0],[A.a1,1],[A.a2,2],[A.a3,3],[A.a4,4],[B.b0,0],[B.b1,1],[B.b2,2],[B.b3,3],[B.b4,4]];
  for(const [u,l] of lanes){ const r=await req('POST','/api/guild-war/place',{lane:l},u.token); need(r&&r.ok,'place '+u.name,r); }
  const w2=await warp(active.tournament.registrationLocksAt+60000); need(w2&&w2.state==='bracket','warp to the bracket',w2);
  const first=(await req('GET','/api/guild-war/status',null,me.token)).tournament.bracket[0];
  await warp(first.schedule.lockAt+60000);
  const live=await req('GET','/api/guild-war/match',null,me.token); need(live&&live.match&&live.match.state==='live','live match',live);
  /* five real marches, one per lane: ours on 0, 2, 4, theirs on 1, 3 */
  const marches=[[me,0],[B.b1,1],[A.a2,2],[B.b3,3],[A.a4,4]], results=[];
  for(const [u,l] of marches){ const r=await req('POST','/api/guild-war/assault',{fromLane:l,requestId:'sl1469-'+l},u.token); need(r&&r.ok,'assault lane '+l+' by '+u.name,r);
    results.push({lane:l,by:u.name,won:r.won,rounds:r.result&&r.result.rounds,seed:r.replay&&r.replay.seed}); }
  await H.wait(1500); await s.stop();
  injectBracket(file,ga.guild.id,gb.guild.id);
  s=await H.server(file,{ADMIN_IDS:ADMIN_ID});
  return {s,file,gA:ga.guild.id,gB:gb.guild.id,gAName:ga.guild.name,gBName:gb.guild.name,results,missName:A.miss.name}; }

/* 14 more guilds in round 1 (live cosmetic matches like screen_lockdown_guild.js writes), so the bracket draws 16 crests: ours seed 1 vs theirs seed 16 */
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

async function openGuild(pg,S,tab){ await H.openBuilding(pg,'guild',S.touch);
  await pg.waitForFunction(()=>document.getElementById('guild').classList.contains('active')&&document.querySelector('#guildBody .gTabStrip'),null,{timeout:30000}).catch(()=>{});
  if(tab){ await pg.evaluate(t=>{ const b=document.querySelector('#guildBody [data-gt="'+t+'"]'); if(b) b.scrollIntoView({block:'center',inline:'center'}); },tab);
    await press(pg,S,'#guildBody [data-gt="'+tab+'"]'); }
  await H.wait(1800); await H.prep(pg); }

/* ---------------- No auto-placement ---------------- */
async function missedLine(pg,S,s){ await openGuild(pg,S,'war');
  await pg.waitForSelector('#gTabBody .skyMissed',{timeout:15000}).catch(()=>{});
  const srv=(await s.api('/api/guild-war/status')).body, you=srv&&srv.match&&srv.match.you||{};
  const r=await pg.evaluate(([n,m])=>{ const el=document.querySelector('#gTabBody .skyMissed'); if(el) el.scrollIntoView({block:'center'});
    return {shown:!!el&&SL.vis(el),inView:!!el&&SL.inView(el,2),text:SL.txt(el),want:t('skyfall.missed_lock',{n,m})}; },[you.missedMembers|0,you.missedLines|0]);
  const nums=(r.text.match(/\d+/g)||[]).map(Number);
  const s1=await shot(pg,S.tag+' No auto-placement missed line');
  C.ok(r.shown&&r.inView&&r.text.endsWith(r.want)&&nums[0]===(you.missedMembers|0)&&nums[1]===(you.missedLines|0),
    S.tag+' No auto-placement: the guild\'s war board shows "'+r.text+'" = the server\'s missedMembers '+(you.missedMembers|0)+' / missedLines '+(you.missedLines|0),{...r,server:{missedMembers:you.missedMembers,missedLines:you.missedLines},shot:s1});
  C.ok((you.missedMembers|0)===1&&(you.missedLines|0)===1,S.tag+' No auto-placement: the server counts the one member who never placed (Late69, 1 line) as missed - nobody placed him',{server:{missedMembers:you.missedMembers,missedLines:you.missedLines},shot:s1}); }

/* the page-side sampler: every 40 ms, each lane's state (the board's own laneStart / laneDone), its swords, its spent mark, its two
   garrison discs, its two towers, and every marching figure (where it started, where it is, when it went) */
const SAMPLER=()=>{ if(window._slS) clearInterval(window._slS.iv);
  const S={lanes:[0,1,2,3,4].map(()=>({starts:[],dones:[],clashOn:null,spent:null,gar:{you:[],foe:[]},towerFall:{you:null,foe:null}})),walkers:{},maxFight:0,maxSwords:0,samples:0,nextId:1,stageSwaps:0,lastStage:null,maxFightAt:null};
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
    if(fighting>S.maxFight){ S.maxFight=fighting; S.maxFightAt=now; } S.maxSwords=Math.max(S.maxSwords,swords);
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

async function openSkyfall(pg,S){ await openGuild(pg,S,'war');
  await pg.evaluate(SAMPLER); await pg.evaluate(()=>{ SKYSIM.speed=1; });
  const btn=await pg.evaluate(()=>{ const b=[...document.querySelectorAll('#gTabBody button')].find(x=>/show\('skyfall'\)/.test(x.getAttribute('onclick')||'')); if(b){ b.id='slSkyEnter'; b.scrollIntoView({block:'center'}); } return !!b; });
  if(btn) await press(pg,S,'#slSkyEnter'); else await pg.evaluate(()=>show('skyfall'));
  await pg.waitForFunction(()=>document.getElementById('skyfall').classList.contains('active')&&document.querySelectorAll('#skyStage .skyTower').length===10&&SKY.st&&SKY.st.match,null,{timeout:30000}).catch(()=>{});
  await H.prep(pg); return btn; }

/* the lane hub (#skyHub) as it is drawn */
const HUB=()=>{ const hub=document.getElementById('skyHub'); if(!hub) return {none:true}; const q=s=>hub.querySelector(s);
  return {open:!hub.hidden&&SL.vis(hub),lane:SKYSIM.hubLane,tab:SKYSIM.hubTab,title:SL.txt(q('.skyHubHd b')),tabs:[...hub.querySelectorAll('.skyHubTabs button')].map(b=>SL.txt(b)+(b.classList.contains('on')?'*':'')),box:SL.R(hub)}; };
const BOUTS=aNames=>{ const hub=document.getElementById('skyHub');
  return [...hub.querySelectorAll('.skyBout')].map(b=>{ const m=b.querySelector('.skyBoutSide.mine'), f=b.querySelector('.skyBoutSide.foe'), w=b.querySelector('.skyBoutWatch'); if(w) w.scrollIntoView({block:'nearest'});
    const M=SL.R(m), F=SL.R(f), nm=SL.txt(m&&m.querySelector('.nm'));
    return {n:+(SL.txt(b.querySelector('.skyBoutMid .skyBoutNo')).replace(/\D/g,'')),mine:nm,foe:SL.txt(f&&f.querySelector('.nm')),mineCards:m?m.querySelectorAll('.skyBoutCard').length:0,foeCards:f?f.querySelectorAll('.skyBoutCard').length:0,
      mineLeft:!!M&&!!F&&M.r<=F.x+1,facing:!!M&&!!F&&Math.abs((M.y+M.h/2)-(F.y+F.h/2))<Math.max(M.h,F.h)/2,mineIsUs:aNames.includes(nm),verdict:SL.txt(b.querySelector('.skyBoutVerdict')),
      watch:!!w&&SL.vis(w),watchOn:!!w&&SL.inView(w,2),watchText:SL.txt(w)}; }); };

async function liveAndRecords(pg,S,W,info,long){
  const on=await pg.waitForFunction(i=>{ const c=document.getElementById('skyLC-'+i); return c&&c.classList.contains('skyHot')&&SL.vis(c); },long,{timeout:40000}).then(()=>true,()=>false);
  const how=on?await tapEl(pg,S,'#skyLC-'+long):'swords never went up';
  await H.wait(700);
  const read=()=>pg.evaluate(()=>{ const hub=document.getElementById('skyHub'), q=s=>hub.querySelector(s), g1=q('.skyLFG.mine'), g2=q('.skyLFG.foe'), sm=q('.skyLFSide.mine'), sf=q('.skyLFSide.foe'), ck=q('.skyLFClock');
    const R=e=>e?SL.R(e):null, cols=[...hub.querySelectorAll('.skyLFWait .skyLFCol')];
    return {gMine:SL.txt(g1&&g1.querySelector('.gn')),gMineLines:SL.txt(g1&&g1.querySelector('.tl')),gFoe:SL.txt(g2&&g2.querySelector('.gn')),gFoeLines:SL.txt(g2&&g2.querySelector('.tl')),
      guildsRow:!!g1&&!!g2&&R(g1).r<=R(g2).x+1,
      order:!!sm&&!!ck&&!!sf&&R(sm).r<=R(ck).x+1&&R(ck).r<=R(sf).x+1,mineName:SL.txt(sm&&sm.querySelector('.skyLFNm .n')),foeName:SL.txt(sf&&sf.querySelector('.skyLFNm .n')),
      mineCards:sm?sm.querySelectorAll('.skyLFCard').length:0,foeCards:sf?sf.querySelectorAll('.skyLFCard').length:0,
      lbl:SL.txt(ck&&ck.querySelector('.lbl')),clock:SL.txt(document.getElementById('skyLFClockT')),verdict:!!(ck&&ck.querySelector('.verdict')),sub:ck?[...ck.querySelectorAll('.sub')].map(SL.txt):[],
      waitHd:SL.txt(q('.skyLFWaitHd')),cols:cols.map(c=>({box:SL.R(c),rows:[...c.querySelectorAll('.skyLFRow')].map(x=>SL.txt(x.querySelector('.nm'))),empty:!!c.querySelector('.skyLFEmpty')})),
      laneDone:(SKYSIM.laneDone||{})[SKYSIM.hubLane]}; });
  const h0=await pg.evaluate(HUB), v0=await read(), t0=Date.now(); await H.wait(2600); const v1=await read(), dt=(Date.now()-t0)/1000;
  const s1=await shot(pg,S.tag+' Live fight view lane '+long);
  const L=W.view.you.citadels[long], F=W.view.foe.citadels[long], laneName=L.name;
  C.ok(on&&h0.open&&h0.lane===long&&h0.title.includes(laneName)&&h0.tab==='live',S.tag+' Lane report: tapping lane '+long+'\'s swords ['+how+'] opens that lane\'s report ("'+h0.title+'", tabs '+h0.tabs.join(' / ')+')',{hub:h0,shot:s1});
  const c0=mmss(v0.clock), c1=mmss(v1.clock), num=s=>+((String(s).match(/\d+/)||[])[0]);
  const wantMine=L.defenders.length, wantFoe=F.defenders.length;
  C.ok(v0.gMine===W.gAName&&v0.gFoe===W.gBName&&v0.guildsRow&&num(v0.gMineLines)===wantMine&&num(v0.gFoeLines)===wantFoe,
    S.tag+' Live fight view: both guilds side by side - "'+v0.gMine+'" ('+v0.gMineLines+') and "'+v0.gFoe+'" ('+v0.gFoeLines+'), lines left = the lane\'s '+wantMine+' / '+wantFoe+' lines (none down yet)',{v:v0,shot:s1});
  C.ok(v0.order&&v0.mineCards===5&&v0.foeCards===5&&v0.lbl==='IN BATTLE'&&!v0.verdict&&v0.laneDone===false&&c0!=null&&c1!=null&&c1-c0>=Math.floor(dt)-1&&c1-c0<=Math.ceil(dt)+1,
    S.tag+' Live fight view: the current fight ('+v0.mineName+' vs '+v0.foeName+', 5 cards each, yours left) with its clock running '+v0.clock+' -> '+v1.clock+' in '+dt.toFixed(1)+' s, "'+v0.lbl+'", no verdict while it plays',{v0,v1,shot:s1});
  const mineQ=L.defenders.map(d=>d.name).filter(n=>n!==v0.mineName), foeQ=F.defenders.map(d=>d.name).filter(n=>n!==v0.foeName);
  C.ok(v0.waitHd==='WAITING TROOPS'&&v0.cols.length===2&&v0.cols[0].box.r<=v0.cols[1].box.x+1&&JSON.stringify(v0.cols[0].rows.slice().sort())===JSON.stringify(mineQ.slice().sort())&&JSON.stringify(v0.cols[1].rows.slice().sort())===JSON.stringify(foeQ.slice().sort()),
    S.tag+' Live fight view: waiting troops in two columns side by side - yours ['+v0.cols.map(c=>c.rows.join(', ')||'-').join('] / theirs [')+'] = the lane\'s lines not in the fight',{cols:v0.cols,want:{mine:mineQ,foe:foeQ},shot:s1});
  /* Records while the fight is still playing: the lane's fights, and no verdict for the one being played */
  await pg.evaluate(()=>{ const b=document.querySelectorAll('#skyHub .skyHubTabs button')[1]; if(b) b.id='slRecTab'; });
  const how2=await tapEl(pg,S,'#slRecTab'); await H.wait(600);
  const rec=await pg.evaluate(()=>({hub:{tab:SKYSIM.hubTab,lane:SKYSIM.hubLane},fighting:(SKYSIM.laneDone||{})[SKYSIM.hubLane]===false,cur:(SKYFALL_VIEW.log[(SKYSIM.laneCur||{})[SKYSIM.hubLane]]||{}).n}));
  rec.bouts=await pg.evaluate(BOUTS,W.aLineNames);
  const s2=await shot(pg,S.tag+' Lane report records while fighting lane '+long);
  const laneNs=W.log.filter(e=>e.lane===long).map(e=>e.n);
  C.ok(rec.hub&&rec.hub.tab==='records'&&rec.bouts.every(b=>laneNs.includes(b.n)),S.tag+' Lane report: the swords\' Records tab ['+how2+'] lists only lane '+long+'\'s fights (#'+(rec.bouts||[]).map(b=>b.n).join(', #')+')',{rec,laneNs,shot:s2});
  const early=(rec.bouts||[]).filter(b=>b.n===rec.cur&&b.verdict);
  C.ok(rec.fighting&&!early.length,S.tag+' Five lanes at once: while lane '+long+'\'s fight #'+rec.cur+' is still playing its Records row shows no result'+(early.length?' (it shows "'+early[0].verdict+'")':''),{fighting:rec.fighting,current:rec.cur,rows:rec.bouts,shot:s2});
  await tapEl(pg,S,'#skyHub .skyHubHd button'); await H.wait(400); }

async function recordsRows(pg,S,W,lane,label){
  await pg.evaluate(()=>{ const h=document.getElementById('skyHub'); if(h&&!h.hidden){ SKYSIM.hubOn=false; h.hidden=true; } });
  const spent=await pg.evaluate(i=>!!document.querySelector('#skyLC-'+i+'.spent'),lane);
  const how=await tapEl(pg,S,'#skyTower-you-'+lane); await H.wait(800);
  const h=await pg.evaluate(HUB), bouts=await pg.evaluate(BOUTS,W.aLineNames);
  const s1=await shot(pg,S.tag+' Records rows lane '+lane+' '+label);
  const laneLog=W.log.filter(e=>e.lane===lane);
  C.ok(spent&&h.open&&h.lane===lane&&h.tab==='records'&&bouts.length===laneLog.length&&bouts.every((b,i)=>b.n===laneLog[laneLog.length-1-i].n),
    S.tag+' Lane report: tapping spent lane '+lane+'\'s tower ['+how+'] opens its Records ("'+h.title+'"): '+bouts.length+' fight(s) #'+bouts.map(b=>b.n).join(', #')+' = the server\'s',{spent,hub:h,server:laneLog.map(e=>e.n),shot:s1});
  const e=laneLog[0], b=bouts.find(x=>x.n===(e&&e.n));
  C.ok(!!b&&b.mineCards===5&&b.foeCards===5&&b.facing&&b.mineLeft&&b.mineIsUs&&b.watch&&b.watchOn,
    S.tag+' Records rows: fight #'+(e&&e.n)+' ('+(e&&e.side==='A'?'we marched':'THEY marched')+') shows both line-ups facing each other, ours on the left ("'+(b&&b.mine)+'" | "'+(b&&b.foe)+'", '+(b&&b.mineCards)+' + '+(b&&b.foeCards)+' cards) with a "'+(b&&b.watchText)+'" button',{row:b,server:e&&{n:e.n,side:e.side,a:e.a,d:e.d},shot:s1});
  return {bouts,hub:h}; }

async function watchMarch(pg,S,W,s,lane){
  const n=await pg.evaluate(()=>{ const w=document.querySelector('#skyHub .skyBout .skyBoutWatch'); if(!w) return null; w.id='slWatch'; w.scrollIntoView({block:'center'});
    return +(SL.txt(w.closest('.skyBout').querySelector('.skyBoutMid .skyBoutNo')).replace(/\D/g,'')); });
  if(!n){ C.ok(false,S.tag+' Watch a march: a Watch button in lane '+lane+'\'s Records'); return null; }
  const before=await pg.evaluate(()=>({tok:SKYREAL.tok,on:SKYREAL.on,done:Object.assign({},SKYSIM.laneDone),cur:Object.assign({},SKYSIM.laneCur)}));
  const srv=(await s.api('/api/guild-war/fight','POST',{n})).body||{};
  const how=await tapEl(pg,S,'#slWatch');
  const inBattle=await pg.waitForFunction(()=>state==='battle'&&CUR&&CUR.mode==='replay',null,{timeout:90000}).then(()=>true,()=>false);
  await H.wait(2500);
  const b=await pg.evaluate(()=>({state,mode:CUR&&CUR.mode,seed:CUR&&CUR.seed,ally:((CUR&&CUR.replayAlly)||[]).map(h=>h.key),foe:((CUR&&CUR.replayFoe)||[]).map(h=>h.key),allyHp:((CUR&&CUR.replayAlly)||[]).map(h=>h.hp),
    leave:SL.vis('#leaveBtn')&&SL.inView('#leaveBtn'),leaveText:SL.txt('#leaveBtn'),skip:SL.vis('#skipBtn'),tok:SKYREAL.tok,on:SKYREAL.on,paused:!!SKYSIM.paused,stage:!!document.getElementById('skyStage')}));
  const s1=await shot(pg,S.tag+' Watch a march battle');
  const f=srv.fight||{}, sa=((f.a||{}).snaps||[]).map(h=>h.key), sd=((f.d||{}).snaps||[]).map(h=>h.key);
  C.ok(inBattle&&b.mode==='replay'&&srv.ok&&(b.seed>>>0)===(f.seed>>>0)&&JSON.stringify(b.ally)===JSON.stringify(sa)&&JSON.stringify(b.foe)===JSON.stringify(sd),
    S.tag+' Watch a march: Watch on fight #'+n+' ['+how+'] plays the STORED fight - seed '+b.seed+' = the server\'s '+(f.seed>>>0)+', lines ['+b.ally.join(',')+'] vs ['+b.foe.join(',')+'] = the stored '+(f.a&&f.a.name)+' vs '+(f.d&&f.d.name),
    {battle:b,server:{n:f.n,seed:f.seed,a:sa,d:sd,aHp:((f.a||{}).hp||[]).map(x=>x.hp),won:srv.won},shot:s1});
  C.ok(b.leave&&!b.skip,S.tag+' Watch a march: the battle has "'+b.leaveText+'" and no Skip',{leave:b.leave,skip:b.skip,shot:s1});
  /* the war behind it: the same lane player, not paused; whatever was still fighting keeps going */
  await H.wait(8000);
  const mid=await pg.evaluate(()=>({tok:SKYREAL.tok,on:SKYREAL.on,paused:!!SKYSIM.paused,done:Object.assign({},SKYSIM.laneDone),cur:Object.assign({},SKYSIM.laneCur),state}));
  const wasFighting=[0,1,2,3,4].filter(i=>before.done[i]===false), finished=wasFighting.filter(i=>mid.done[i]===true);
  const s2=await shot(pg,S.tag+' Watch a march war still running');
  const reset=wasFighting.filter(i=>mid.done[i]!==true&&mid.cur[i]!==before.cur[i]);
  C.ok(mid.state==='battle'&&mid.tok===before.tok&&mid.on&&!mid.paused&&!reset.length,
    S.tag+' Watch a march: the war keeps running while the fight is watched (same lane player, not paused; lanes fighting when Watch was tapped: '+(wasFighting.join(',')||'none')+', finished meanwhile: '+(finished.join(',')||'none')+')',{before,mid,shot:s2});
  const tLeave=Date.now();
  await tapEl(pg,S,'#leaveBtn');
  await pg.waitForFunction(()=>document.getElementById('skyfall').classList.contains('active')&&document.getElementById('skyStage'),null,{timeout:20000}).catch(()=>{});
  await H.wait(1200); await H.prep(pg);
  return {n,tLeave,before,mid}; }

async function bracketLook(pg,S){
  await pg.evaluate(()=>{ const h=document.getElementById('skyHub'); if(h&&!h.hidden){ SKYSIM.hubOn=false; h.hidden=true; } });
  await tapEl(pg,S,'#skyMenuBtn'); await H.wait(300); await tapEl(pg,S,'#skyBracket'); await H.wait(1200);
  const r=await pg.evaluate(()=>{ const b=document.querySelector('.skyBrkBody'); if(!b) return {none:true}; const B=b.getBoundingClientRect();
    const nodes=[...b.querySelectorAll('.skyBrkNode')], cup=b.querySelector('.skyBrkCup2'), svg=b.querySelector('svg.skyBrkSvg'), paths=svg?[...svg.querySelectorAll('path')]:[];
    const segs=paths.map(p=>{ const n=(p.getAttribute('d').match(/-?[\d.]+/g)||[]).map(Number); const o=[]; for(let i=0;i<n.length;i+=2) o.push({x:n[i],y:n[i+1]}); return o; });
    const near=(a,b)=>Math.abs(a.x-b.x)<0.05&&Math.abs(a.y-b.y)<0.05, cupX=cup?parseFloat(cup.style.left):NaN, cupY=cup?parseFloat(cup.style.top):NaN;
    const reach=nodes.map(n=>{ let at={x:parseFloat(n.style.left),y:parseFloat(n.style.top)}; for(let k=0;k<6;k++){ const s=segs.find(s=>near(s[0],at)); if(!s) return false; at=s[s.length-1]; if(Math.abs(at.x-cupX)<0.05&&Math.abs(at.y-cupY)<=10) return true; } return false; });
    const ys=[...new Set(nodes.map(n=>Math.round(n.getBoundingClientRect().top)))].sort((a,b)=>a-b);
    return {nodes:nodes.length,crests:nodes.filter(n=>n.querySelector('.crest svg')).length,names:nodes.map(n=>SL.txt(n.querySelector('.nm'))),rows:ys.length,perRow:ys.map(y=>nodes.filter(n=>Math.round(n.getBoundingClientRect().top)===y).length),
      cup:!!cup&&SL.vis(cup),cupAt:cup?Math.round((cup.getBoundingClientRect().left+cup.getBoundingClientRect().width/2-B.left)/B.width*100)+'%,'+Math.round((cup.getBoundingClientRect().top+cup.getBoundingClientRect().height/2-B.top)/B.height*100)+'%':null,
      paths:paths.length,reachCup:reach.filter(Boolean).length,allOn:nodes.every(n=>SL.inView(n,2)),title:SL.txt(document.querySelector('#skyPanel .skyPanelHd, .skyPanel b'))}; });
  const s1=await shot(pg,S.tag+' Bracket panel');
  C.look(S.tag+' Bracket panel (for Phil\'s wording): '+(r.none?'no bracket panel opened':r.crests+' guild crests ('+r.nodes+' nodes) in '+r.rows+' rows of '+r.perRow.join(' + ')+', '+r.paths+' path pieces, '+r.reachCup+' of '+r.nodes+' crests\' paths run to the cup at '+r.cupAt+' (the centre), all on screen: '+r.allOn),{...r,shot:s1});
  await pg.evaluate(()=>{ document.querySelectorAll('.skyPanel,#skyPanel').forEach(n=>n.remove()); }); }

/* the lane-by-lane verdicts from the sampler */
function analyse(S,W,smp,lanes,leaveAt,shots){
  const L=smp.lanes, dur=i=>{ const d=L[i].dones[0]; if(d==null) return null; const st=L[i].starts.filter(x=>x.t<=d).pop(); return st?d-st.laneStart:null; };
  const iv=lanes.map(x=>({lane:x.lane,start:(L[x.lane].starts[0]||{}).laneStart||null,done:L[x.lane].dones[0]||null}));
  const overlap=iv.every(x=>x.start&&x.done)&&Math.max(...iv.map(x=>x.start))<Math.min(...iv.map(x=>x.done));
  C.ok(smp.maxFight===5&&smp.maxSwords===5&&overlap,S.tag+' Five lanes at once: all 5 lanes fight side by side (5 lanes fighting and 5 crossed swords on the board at one moment; every lane\'s fight overlaps every other\'s)',
    {maxFighting:smp.maxFight,maxSwords:smp.maxSwords,intervals:iv.map(x=>({lane:x.lane,ms:x.start&&x.done?x.done-x.start:null})),samples:smp.samples,err:smp.err,shots});
  /* nothing shows the result early: discs and towers only move once the fight has finished */
  const early=[], late=[];
  for(const x of lanes){ const l=L[x.lane], st=(l.starts[0]||{}).laneStart, dn=l.dones[0]; if(!st||!dn) continue;
    for(const sd of ['you','foe']){ for(const g of l.gar[sd].slice(1)) if(g.t>st&&g.t<dn-60) early.push({lane:x.lane,side:sd,disc:g.v,atMs:g.t-st,doneMs:dn-st});
      if(l.towerFall[sd]!=null&&l.towerFall[sd]<dn-60) early.push({lane:x.lane,side:sd,tower:'fell',atMs:l.towerFall[sd]-st,doneMs:dn-st}); }
    const e=x.e, mineDown=e.side==='A'?e.aDown:e.dDown, foeDown=e.side==='A'?e.dDown:e.aDown;
    late.push({lane:x.lane,expect:{you:mineDown?'down':'same',foe:foeDown?'down':'same'},discs:{you:l.gar.you.map(g=>g.v).join(' > '),foe:l.gar.foe.map(g=>g.v).join(' > ')}}); }
  C.ok(early.length===0,S.tag+' Five lanes at once: no lane shows its result before its fight has finished playing (no garrison disc goes down and no tower falls mid-fight)',{early,afterwards:late,shots});
  /* Fight duration: the shortest and the longest */
  const sorted=lanes.slice().sort((a,b)=>a.e.ms-b.e.ms);
  for(const [which,x] of [['short',sorted[0]],['long',sorted[sorted.length-1]]]){ const d=dur(x.lane), exp=x.e.ms, tol=1500+0.10*exp;
    C.ok(d!=null&&exp>=10000&&exp<=180000&&Math.abs(d-exp)<=tol&&x.e.rounds===x.srvRounds,
      S.tag+' Fight duration ('+which+'): lane '+x.lane+'\'s fight #'+x.e.n+' ('+x.e.rounds+' rounds) is on the board '+(d==null?'?':(d/1000).toFixed(1))+' s; skyFightMs says '+(exp/1000).toFixed(1)+' s (10-180 s)',
      {lane:x.lane,n:x.e.n,rounds:x.e.rounds,serverRounds:x.srvRounds,measuredMs:d,expectedMs:exp,toleranceMs:Math.round(tol),starts:L[x.lane].starts.length,shots}); }
  /* Marching heroes */
  const walks=lanes.map(x=>{ const l=L[x.lane], st=(l.starts[0]||{}).t||0, ws=Object.values(smp.walkers).filter(w=>w.lane===x.lane&&w.first.t>=st-300&&(l.clashOn==null||w.first.t<=l.clashOn));
    const chk=w=>{ const d0=Math.hypot(w.first.x-w.mid.x,w.first.y-w.mid.y), d1=Math.hypot(w.last.x-w.mid.x,w.last.y-w.mid.y);
      return {mine:w.mine,from:w.end,startDist:+w.endDist,toMid:+(d1/Math.max(0.01,d0)).toFixed(2),goneBeforeSwords:w.gone!=null&&l.clashOn!=null&&w.gone<=l.clashOn+100,sprite:w.sprite,name:w.name,onScreen:w.onScreen}; };
    const mine=ws.find(w=>w.mine), foe=ws.find(w=>!w.mine), M=mine&&chk(mine), F=foe&&chk(foe);
    const ok=!!M&&!!F&&M.from==='a'&&F.from==='b'&&M.startDist<3&&F.startDist<3&&M.toMid<0.25&&F.toMid<0.25&&M.goneBeforeSwords&&F.goneBeforeSwords&&M.onScreen&&F.onScreen&&!!M.sprite&&M.sprite===x.leadMine&&!!F.sprite&&F.sprite===x.leadFoe;
    return {lane:x.lane,ok,walkers:ws.length,mine:M,foe:F,wantSprite:{mine:x.leadMine,foe:x.leadFoe,mineKey:x.leadMineKey,foeKey:x.leadFoeKey}}; });
  C.ok(walks.every(w=>w.ok),S.tag+' Marching heroes: on every lane both lines\' lead heroes walk the bridge from their own tower to the middle (the line\'s lead hero\'s walk sheet) and are gone before the swords go up ('+walks.map(w=>'lane '+w.lane+(w.ok?' ok':' NO')).join(', ')+')',{walks,shots});
  /* after Leave: no lane starts its fight over */
  const again=lanes.filter(x=>L[x.lane].starts.length>1).map(x=>({lane:x.lane,starts:L[x.lane].starts.map(s=>s.t-(leaveAt||0)),dones:L[x.lane].dones.map(t=>t-(leaveAt||0))}));
  C.ok(leaveAt!=null&&again.length===0,S.tag+' Watch a march: after Leave the board carries on from where the war was - no lane plays its fight again from the start (board rebuilt '+smp.stageSwaps+' time(s))',{restarted:again,stageSwaps:smp.stageSwaps,shots}); }

async function warSize(pg,S,W){
  await missedLine(pg,S,W.s);
  const btn=await openSkyfall(pg,S);
  const info=await pg.evaluate(()=>{ const r=SKYFALL_VIEW||{}, norm=u=>{ try{ return new URL(u,location.href).pathname; }catch(e){ return u||''; } };
    const walkU=team=>{ for(const k of (team||[])) if(BATTLE_ANIM[k]&&BATTLE_ANIM[k].walk&&BATTLE_ANIM[k].walk.u) return {k,u:norm(BATTLE_ANIM[k].walk.u)}; return {k:null,u:null}; };
    return {real:!!r.real,on:SKYREAL.on,speed:SKYSIM.speed,sandbox:skySimSandbox(),stage:SL.txt('#skyStagePill'),
      log:(r.log||[]).map(e=>{ const mineT=(e.side==='A'?e.aTeam:e.dTeam)||[], foeT=(e.side==='A'?e.dTeam:e.aTeam)||[], wm=walkU(mineT.map(h=>h.k)), wf=walkU(foeT.map(h=>h.k));
        return {n:e.n,lane:e.lane,side:e.side,a:e.a,d:e.d,won:e.won,rounds:e.rounds,ms:skyFightMs(e),aDown:e.aDown,dDown:e.dDown,lead:{mine:(mineT[0]||{}).k,foe:(foeT[0]||{}).k},walk:{mine:wm,foe:wf}}; })}; });
  const s0=await shot(pg,S.tag+' Skyfall real war board');
  C.ok(info.real&&info.on&&!info.sandbox&&info.log.length===5&&info.speed===1,S.tag+' Skyfall: the board is the REAL war ('+info.log.length+' real fights in its log, played by the real-war lane player, not the simulator; board speed x'+info.speed+', stage '+info.stage+')'+(btn?'':' [opened with show(), no Enter button found]'),
    {real:info.real,on:info.on,sandbox:info.sandbox,log:info.log.map(e=>({n:e.n,lane:e.lane,side:e.side,rounds:e.rounds,ms:e.ms})),shot:s0});
  const lanes=[0,1,2,3,4].map(i=>{ const e=info.log.find(x=>x.lane===i)||{lane:i,ms:0,rounds:-1}, srv=W.results.find(x=>x.lane===i)||{};   /* the rounds the assault route itself fought */
    if(e.walk&&e.lead&&(e.walk.mine.k!==e.lead.mine||e.walk.foe.k!==e.lead.foe)) console.log('  INFO   '+S.tag+' lane '+i+': a lead hero has no walk sheet - the board walks the first hero of the line that has one ('+JSON.stringify({lead:e.lead,walks:[e.walk.mine.k,e.walk.foe.k]})+')');
    return {lane:i,e,srvRounds:srv.rounds,leadMine:e.walk&&e.walk.mine.u,leadFoe:e.walk&&e.walk.foe.u,leadMineKey:e.lead&&e.lead.mine,leadFoeKey:e.lead&&e.lead.foe}; });
  const byMs=lanes.slice().sort((a,b)=>a.e.ms-b.e.ms), short=byMs[0].lane, long=byMs[4].lane;
  console.log('  INFO   '+S.tag+' the fights: '+lanes.map(x=>'lane '+x.lane+' #'+x.e.n+' '+x.e.side+' '+x.e.rounds+'r '+(x.e.ms/1000).toFixed(1)+'s').join(' | ')+' -> short lane '+short+', long lane '+long);
  const shots=[s0];
  try{ await liveAndRecords(pg,S,W,info,long); }catch(e){ C.ok(false,S.tag+' Live fight view / lane report ran to the end',String(e&&e.stack||e).slice(0,500)); }
  /* the short lane finishes: its tower opens its Records; Watch from there while the long lane still fights */
  await pg.waitForFunction(i=>!!document.querySelector('#skyLC-'+i+'.spent'),short,{timeout:byMs[0].e.ms+60000}).catch(()=>{});
  let watch=null;
  try{ await recordsRows(pg,S,W,short,'(short lane, spent)'); watch=await watchMarch(pg,S,W,W.s,short); }catch(e){ C.ok(false,S.tag+' Records rows / Watch a march ran to the end',String(e&&e.stack||e).slice(0,500)); }
  /* every lane plays out */
  await pg.waitForFunction(()=>[0,1,2,3,4].every(i=>(SKYSIM.laneDone||{})[i]===true&&document.querySelector('#skyLC-'+i+'.spent')),null,{timeout:byMs[4].e.ms+120000,polling:500}).catch(()=>{});
  await H.wait(800); shots.push(await shot(pg,S.tag+' Skyfall all lanes played'));
  /* a fight THEY marched: our side still on the left */
  const theirs=lanes.find(x=>x.e.side==='B'&&x.lane!==short)||lanes.find(x=>x.e.side==='B');
  if(theirs){ try{ await recordsRows(pg,S,W,theirs.lane,'(a fight they marched)'); }catch(e){ C.ok(false,S.tag+' Records rows (their march) ran to the end',String(e&&e.stack||e).slice(0,500)); } }
  else C.ok(false,S.tag+' Records rows: the war has a fight the other guild marched',{log:info.log});
  const smp=await pg.evaluate(()=>{ const S=window._slS; clearInterval(S.iv); const o=Object.assign({},S); delete o.lastStage; delete o.iv; return JSON.parse(JSON.stringify(o)); });
  analyse(S,W,smp,lanes,watch&&watch.tLeave,shots);
  try{ await bracketLook(pg,S); }catch(e){ C.ok(false,S.tag+' Bracket panel ran to the end',String(e&&e.stack||e).slice(0,500)); } }

/* ============================== PART B: Well tent, teleport tint, avatar picker ============================== */
const WELL_KEYS=['vael','aureth','sylthaine','vireo','brannus','lumi','umbris','grosk','calypsa','dandra'];
function wellSeed(secret,id,cycle,map,pth){ return crypto.createHmac('sha256',secret).update(['well2map',id,cycle,map,pth||'-'].join('|')).digest().readUInt32BE(0)>>>0; }
/* the server's own map (server/starless-well.js genMap on the server's map seed) - which (map, path) has a tent next to a square */
function findTent(){ const WL=require(path.join(H.ROOT,'server','starless-well.js')), SIM=require(path.join(H.ROOT,'server','sim.js'));
  const pool=Object.keys(SIM.HERO_BASE).sort(), cyc=WL.cycleOf(Date.now()), secret=process.env.SERVER_SECRET||'screens-1450';
  for(const [map,pth] of [[1,null],[2,'normal'],[3,'normal'],[2,'hard'],[3,'hard']]){ const grid=WL.genMap(wellSeed(secret,H.UID,cyc,map,pth),map,pth,pool);
    for(const c of [2,4]) for(let row=0;row<3;row++){ const sq=grid[c][row]; if(!sq||sq.type!=='tent'||WL.tentOptions(sq).length<3) continue;
      for(const pr of [row,row-1,row+1]) if(pr>=0&&pr<3&&grid[c-1][pr]) return {map,path:pth,cycle:cyc,col:c,row,pos:{col:c-1,row:pr},options:WL.tentOptions(sq).slice(),up:(sq.up||[]).slice()}; } }
  return null; }
const freshRun=T=>({cycle:T.cycle,level:0,map:T.map,path:T.path,pos:{col:T.pos.col,row:T.pos.row},heroes:{},loans:[],loanUp:{},buffs:[],offer:null,resUsed:0,done:false,att:null,prizes:[],started:true});
function resetRun(file,T){ const db=JSON.parse(fs.readFileSync(file,'utf8')); const led=db.users[H.UID].led; led.well2=led.well2||{}; led.well2.run=freshRun(T); led.well2.cleared=led.well2.cleared||{}; fs.writeFileSync(file,JSON.stringify(db)); }

async function wellTent(pg,S,s,T,pickOwned){
  const how=await H.openBuilding(pg,'well',S.touch);
  await pg.waitForFunction(()=>document.querySelectorAll('#wlMap .wlSq').length>0,null,{timeout:40000}).catch(()=>{});
  await H.wait(1500); await H.prep(pg);
  const srv=(await s.api('/api/well/state')).body||{}, sq=((srv.grid||[])[T.col]||[])[T.row]||{}, opts=sq.options||[];
  const sel='#wlMap .wlSq.wlReach[data-c="'+T.col+'"][data-r="'+T.row+'"]';
  const tapHow=await tapEl(pg,S,sel); await H.wait(900);
  const r=await pg.evaluate(()=>{ const c=document.getElementById('wlCard'); if(!c) return {card:false};
    return {card:true,inView:SL.inView(c.firstElementChild,2),title:SL.txt(c.firstElementChild.firstElementChild),opts:[...c.querySelectorAll('.wlLoanOpt')].map(b=>({key:b.dataset.loan,text:SL.txt(b),front:SL.front(b),on:SL.inView(b,2),h:SL.R(b).h}))}; });
  const s1=await shot(pg,S.tag+' Tent three loans');
  const pct=v=>'+'+Math.round(v*100)+'%';
  const rows=(r.opts||[]).map(o=>{ const so=opts.find(x=>x.key===o.key)||{}, want=pct(so.hp)+' health, '+pct(so.atk)+' damage', buffRule=so.up?(so.hp===0.45&&so.atk===0.30):(so.hp===0.30&&so.atk===0.20);
    return {key:o.key,up:!!so.up,owned:!!so.owned,buff:want,buffShown:o.text.includes(want),buffRule,upShown:/Upgraded to/.test(o.text)===!!so.up,ownedShown:/a stronger copy of yours/.test(o.text)===!!so.owned,tappable:o.front&&o.on&&o.h>=40,text:o.text}; });
  const keys=rows.map(x=>x.key);
  C.ok(r.card&&rows.length===3&&new Set(keys).size===3&&JSON.stringify(keys)===JSON.stringify(opts.map(o=>o.key))&&rows.every(x=>x.tappable)&&sq.type==='tent',
    S.tag+' Tent: the tent square ['+tapHow+', Well opened by '+how+'] offers 3 different loan heroes ('+keys.join(', ')+') = the server\'s options, each a tappable row',{title:r.title,rows,server:opts,shot:s1});
  C.ok(rows.length===3&&rows.every(x=>x.buffShown&&x.buffRule&&x.upShown),S.tag+' Tent: each loan shows its buff - '+rows.map(x=>x.key+' '+x.buff+(x.up?' (upgraded a quality)':'')).join('; ')+' (+30% / +20%, +45% / +30% upgraded)',{rows,shot:s1});
  const own=rows.find(x=>x.owned), other=rows.find(x=>!x.owned);
  C.ok(!!own&&own.ownedShown,S.tag+' Tent: a hero you own is on offer ('+(own&&own.key)+', marked "a stronger copy of yours")',{rows,shot:s1});
  const pick=pickOwned?own:other;
  if(!pick){ C.ok(false,S.tag+' Tent: a '+(pickOwned?'owned':'not-owned')+' loan to pick',{rows}); return; }
  const how2=await tapEl(pg,S,'#wlCard .wlLoanOpt[data-loan="'+pick.key+'"]'); await H.wait(1500);
  const got=await pg.evaluate(()=>({card:SL.txt('#wlCard'),loans:(WELL.state&&WELL.state.loans)||[]}));
  const srv2=(await s.api('/api/well/state')).body||{};
  const s2=await shot(pg,S.tag+' Tent picked loan');
  C.ok((srv2.loans||[]).includes(pick.key)&&got.loans.includes(pick.key)&&/joins the run/.test(got.card)&&srv2.pos&&srv2.pos.col===T.col,
    S.tag+' Tent: picking '+pick.key+' ('+(pickOwned?'owned':'not owned')+') ['+how2+'] - "'+got.card.slice(0,90)+'"; the server\'s run loans '+JSON.stringify(srv2.loans),{got,server:{loans:srv2.loans,pos:srv2.pos,loanInfo:srv2.loanInfo&&srv2.loanInfo[pick.key]},shot:s2});
  await pg.evaluate(()=>{ const b=document.querySelector('#wlCard button[data-k]'); if(b) b.click(); }); await H.wait(600);
  /* the run's Heroes list, and the squad screen of the next fight */
  await tapEl(pg,S,'#wlMap .wlHeroesB'); await H.wait(1500);
  const list=await pg.evaluate(k=>{ const c=document.querySelector('.wlHeroCard[data-hero-key="'+k+'"]'); if(c) c.scrollIntoView({block:'center'}); return {card:!!c&&SL.vis(c),text:SL.txt(c)}; },pick.key);
  const s3=await shot(pg,S.tag+' Tent loan in the run heroes');
  await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} }); await H.wait(600);
  if(!(await pg.$('#wlMap'))){ await H.openBuilding(pg,'well',S.touch); await pg.waitForFunction(()=>document.querySelectorAll('#wlMap .wlSq').length>0,null,{timeout:40000}).catch(()=>{}); await H.wait(1000); }
  await H.prep(pg);
  const nx=await pg.evaluate(c=>{ const q=[...document.querySelectorAll('#wlMap .wlSq.wlReach')].find(b=>+b.dataset.c===c); if(!q) return null; q.id='slNextSq'; return {c:+q.dataset.c,r:+q.dataset.r}; },T.col+1);
  let squad={menu:false};
  if(nx){ await tapEl(pg,S,'#slNextSq'); await pg.waitForFunction(()=>document.getElementById('menu').classList.contains('active')&&document.querySelectorAll('#roster .hero-card').length>0,null,{timeout:20000}).catch(()=>{}); await H.wait(800);
    squad=await pg.evaluate(k=>{ const c=document.querySelector('#roster .hero-card[data-hero-key="'+k+'"]'); if(c) c.scrollIntoView({block:'center'}); return {menu:document.getElementById('menu').classList.contains('active'),mode:CUR&&CUR.mode,card:!!c&&SL.vis(c),locked:!!c&&c.classList.contains('locked'),cards:document.querySelectorAll('#roster .hero-card').length}; },pick.key); }
  const s4=await shot(pg,S.tag+' Tent loan on the squad screen');
  C.ok(list.card&&/Loan/.test(list.text)&&squad.menu&&squad.mode==='well'&&squad.card&&!squad.locked,
    S.tag+' Tent: the picked loan joins the run\'s squad - its Heroes card ("'+list.text.slice(0,60)+'") and a pickable card on the next fight\'s squad screen ('+squad.cards+' cards)',{list,next:nx,squad,shots:[s3,s4]});
  await pg.evaluate(()=>{ try{ show('home'); }catch(e){} }); await H.wait(500); }

async function openWorld(pg,S){ await H.openBuilding(pg,'wall',S.touch); await H.wait(500);
  await press(pg,S,'#wall>[data-nav="world"]');
  await pg.waitForFunction(()=>state==='world'&&document.getElementById('wzone')&&document.getElementById('worldPictureMaster'),null,{timeout:60000});
  await H.wait(2500); await H.prep(pg); }
async function screenAvg(pg,x,y){ const png=(await pg.screenshot({type:'png',scale:'css'})).toString('base64');
  return pg.evaluate(async([png,x,y])=>{ const im=new Image(); await new Promise(r=>{ im.onload=r; im.onerror=r; im.src='data:image/png;base64,'+png; });
    const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; const g=c.getContext('2d'); g.drawImage(im,0,0);
    const d=g.getImageData(Math.max(0,Math.round(x)-3),Math.max(0,Math.round(y)-3),7,7).data; let r=0,gg=0,b=0; for(let i=0;i<d.length;i+=4){ r+=d[i]; gg+=d[i+1]; b+=d[i+2]; } const n=d.length/4; return [Math.round(r/n),Math.round(gg/n),Math.round(b/n)]; },[png,x,y]); }

async function teleTint(pg,S){ await openWorld(pg,S);
  await press(pg,S,'#wbTele'); await pg.waitForSelector('#tpTargeted',{timeout:10000}); await press(pg,S,'#tpTargeted');
  await pg.waitForSelector('#teleVeil',{timeout:15000}).catch(()=>{}); await H.wait(1500); await H.prep(pg);
  const r=await pg.evaluate(()=>{ const cv=document.getElementById('teleVeil'); if(!cv) return {veil:false,teleMode:_teleMode,total:teleportTotal()};
    const g=cv.getContext('2d'), mine=myRegion(), Y0=REALM_MAP.GEO.Y0, me=document.querySelector('#wzoneInner .wnode.city.me');
    const cxM=Math.floor(parseFloat(me.style.left)/100*GRID_COLS), cyM=Math.floor((parseFloat(me.style.top)-Y0)/GRID_CELL);
    const pct=(cx,cy)=>({x:(cx+0.5)/GRID_COLS*100,y:Y0+(cy+0.5)*GRID_CELL});
    const deep=(cx,cy,z)=>{ for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){ const X=cx+dx,Y=cy+dy; if(REALM_MAP.landZone(X,Y)!==z) return false; if(REALM_MAP.isCity(X,Y)||REALM_MAP.isOasis(X,Y)||(REALM_MAP.isTree&&REALM_MAP.isTree(X,Y))) return false; } return true; };
    let own=null, other=null;
    for(let cy=4;cy<GRID_ROWS-4;cy+=3) for(let cx=4;cx<GRID_COLS-4;cx+=3){ const z=REALM_MAP.landZone(cx,cy); if(!z) continue; const d=Math.hypot(cx-cxM,cy-cyM);
      if(z===mine&&d>6&&(!own||d<own.d)&&deep(cx,cy,z)) own={cx,cy,z,d,...pct(cx,cy)};
      if(ZONES[z]&&ZONES[z].type==='region'&&z!==mine&&!zoneAccessible(z)&&(!other||d<other.d)&&deep(cx,cy,z)){ const p=pct(cx,cy); if(teleSquareFree(snapX(p.x),snapY(p.y))) other={cx,cy,z,d,...p}; } }
    const px=c=>c?[...g.getImageData(c.cx,c.cy,1,1).data]:null;
    return {veil:true,teleMode:_teleMode,size:cv.width+'x'+cv.height,open:+cv.dataset.open,veiled:+cv.dataset.veiled,mine,castleCell:[cxM,cyM],own:own&&Object.assign(own,{px:px(own),access:zoneAccessible(own.z)}),other:other&&Object.assign(other,{px:px(other),access:zoneAccessible(other.z)}),tintOk:TELE_TINT_OK,tintNo:TELE_TINT_NO,vis:SL.vis(cv)}; });
  const s1=await shot(pg,S.tag+' Tap mode tint veil');
  const green=p=>!!p&&p[1]>p[0]+60&&p[1]>p[2]+40&&Math.abs(p[3]-Math.round(0.22*255))<=3, red=p=>!!p&&p[0]>p[1]+80&&p[0]>p[2]+80&&Math.abs(p[3]-Math.round(0.30*255))<=3;
  C.ok(r.veil&&r.vis&&!!r.own&&!!r.other&&green(r.own.px)&&red(r.other.px),S.tag+' Tap mode tint: in teleport tap mode #teleVeil ('+r.size+', '+r.open+' green / '+r.veiled+' red land cells) is green at own-region cell '+(r.own&&r.own.cx+','+r.own.cy)+' ('+(r.own&&r.own.z)+' rgba '+(r.own&&r.own.px)+') and red at other-region cell '+(r.other&&r.other.cx+','+r.other.cy)+' ('+(r.other&&r.other.z)+' rgba '+(r.other&&r.other.px)+')',{...r,shot:s1});
  if(!r.veil||!r.own||!r.other) return;
  /* on screen: the map pixels at each cell with the veil and without it */
  const centre=c=>pg.evaluate(c=>{ const zone=document.getElementById('wzone'); zone.scrollLeft=WORLD_W*worldZoom*c.x/100-zone.clientWidth/2; wzSetTop(zone,c.y/100*WORLD_H-zone.clientHeight/2/worldZoom); zone.dispatchEvent(new Event('scroll')); },c);
  const at=c=>pg.evaluate(c=>{ const V=document.getElementById('teleVeil').getBoundingClientRect(); const x=V.left+(c.cx+0.5)/GRID_COLS*V.width, y=V.top+(c.cy+0.5)/GRID_ROWS*V.height;
    const t=document.elementFromPoint(x,y); return {x,y,inZone:!!t&&!!t.closest('#wzone'),hit:t?(t.tagName.toLowerCase()+(t.id?'#'+t.id:'')+(t.className&&typeof t.className==='string'?'.'+t.className.split(' ')[0]:'')):null}; },c);
  const veil=v=>pg.evaluate(v=>{ document.getElementById('teleVeil').style.visibility=v?'':'hidden'; },v);
  const sample=async c=>{ await centre(c); await H.wait(1800); const p=await at(c); const withV=await screenAvg(pg,p.x,p.y); await veil(false); await H.wait(200); const noV=await screenAvg(pg,p.x,p.y); await veil(true); await H.wait(200); return {p,withV,noV}; };
  const so=await sample(r.own), s2=await shot(pg,S.tag+' Tap mode tint own region on screen');
  const sr=await sample(r.other), s3=await shot(pg,S.tag+' Tap mode tint other region on screen');
  const gShift=x=>(x.withV[1]-x.withV[0])-(x.noV[1]-x.noV[0]), rShift=x=>(x.withV[0]-x.withV[1])-(x.noV[0]-x.noV[1]);
  C.ok(so.p.inZone&&sr.p.inZone&&gShift(so)>=8&&rShift(sr)>=8,S.tag+' Tap mode tint: on screen the own-region land turns greener (green-minus-red +'+gShift(so)+') and the other region redder (red-minus-green +'+rShift(sr)+') with the veil',{own:so,other:sr,shots:[s2,s3]});
  /* a tap on the red region: the refusal pin, and no teleport */
  const before=await pg.evaluate(()=>({pos:JSON.stringify(myCastlePos()),pin:!!document.getElementById('telePin')}));
  await tapAt(pg,S,sr.p.x,sr.p.y); await H.wait(900);
  const pin=await pg.evaluate(()=>{ const p=document.getElementById('telePin'); const img=p&&p.querySelector('img');
    return {pin:!!p&&SL.vis(p),icon:img?(img.getAttribute('src')||'').replace(/^.*\//,''):SL.txt(p),box:p?SL.R(p):null,banner:SL.txt('#banner'),confirm:!!document.getElementById('_gcYes'),pos:JSON.stringify(myCastlePos())}; });
  const s4=await shot(pg,S.tag+' Tap mode tint refusal pin');
  const near=pin.box&&Math.hypot(pin.box.x+pin.box.w/2-sr.p.x,pin.box.y+pin.box.h/2-sr.p.y)<Math.max(40,pin.box.w*2);
  C.ok(pin.pin&&/blocked/.test(pin.icon)&&near&&!pin.confirm&&pin.pos===before.pos,S.tag+' Tap mode tint: a tap on the red region ('+r.other.z+') drops the refusal pin ('+pin.icon+') where it was tapped, no teleport asked or made ("'+pin.banner+'")',{tap:sr.p,pin,before,shot:s4});
  await tapEl(pg,S,'#wbTele'); await H.wait(800); }

/* the lobby's three.js scene, read by wrapping the renderer the lobby creates (test-side only: the game code is not changed) */
const PATCH_THREE=()=>{ if(window._slThree) return THREE.WebGLRenderer===window._slThree; const O=THREE.WebGLRenderer;
  const W=function(p){ const r=new O(p), rr=r.render; r.render=function(sc,cam){ try{ if(this.domElement&&this.domElement.id==='edAvCv') window._slAvScene=sc; }catch(e){} return rr.call(this,sc,cam); }; return r; };
  W.prototype=O.prototype; try{ THREE.WebGLRenderer=W; }catch(e){} window._slThree=W; return THREE.WebGLRenderer===W; };
const AV=()=>{ const sc=window._slAvScene, m=sc&&sc.children.find(o=>o.userData&&o.userData.h); return {model:!!m,uuid:m?m.uuid:null,rotY:m?+m.rotation.y.toFixed(3):null,av:G.edAvatar||null,mine:edMyAvatarId(),
  name:SL.txt('#edAvName'),on:[...document.querySelectorAll('#edAvStrip button.on')].map(b=>b.dataset.av),strip:[...document.querySelectorAll('#edAvStrip button')].map(b=>b.dataset.av),cv:SL.vis('#edAvCv')}; };
async function openLobby(pg,S){ await H.openBuilding(pg,'skyisland',S.touch);
  await pg.waitForFunction(()=>document.querySelectorAll('#skyIslandBody .islespot').length===3,null,{timeout:30000}).catch(()=>{});
  await H.wait(800); const patched=await pg.evaluate(PATCH_THREE); await pg.evaluate(()=>{ window._slAvScene=null; });
  await press(pg,S,'#skyIslandBody .islespot[data-if="emberdraft"]>div');
  await pg.waitForFunction(()=>document.getElementById('edLobby')&&document.querySelectorAll('#edAvStrip button').length>0,null,{timeout:40000}).catch(()=>{});
  await pg.waitForFunction(()=>{ const sc=window._slAvScene; return !!(sc&&sc.children.find(o=>o.userData&&o.userData.h)); },null,{timeout:40000}).catch(()=>{});
  await H.wait(2000); await H.clean(pg); await H.prep(pg); return patched; }
async function reloadGame(pg){ await pg.reload({waitUntil:'domcontentloaded',timeout:180000});
  await pg.waitForFunction(()=>typeof renderHeroDetail==='function'&&typeof api==='function'&&typeof adoptLedger==='function'&&typeof LANG==='object',null,{timeout:180000});
  await H.wait(1500); await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await H.wait(1000);
  await pg.evaluate(async()=>{ G.tutSkipped=true; G.tutDone=true; G.ftutOff=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); try{ await ledgerSync(); }catch(e){} }); await H.wait(800); }

async function avatarPicker(pg,S){
  const patched=await openLobby(pg,S);
  const a0=await pg.evaluate(AV), picks=await pg.evaluate(()=>ED_AV_PICK.map(a=>a.id));
  const s1=await shot(pg,S.tag+' Avatar picker lobby');
  C.ok(patched&&a0.strip.length===10&&new Set(a0.strip).size===10&&JSON.stringify(a0.strip)===JSON.stringify(picks)&&a0.model&&a0.cv&&a0.on.length===1&&a0.on[0]===a0.mine,
    S.tag+' Avatar picker: the lobby offers 10 3D avatars ('+a0.strip.join(', ')+'); "'+a0.name+'" ('+a0.mine+') stands on the pedestal as a 3D model',{...a0,shot:s1});
  /* drag on the avatar: the model turns */
  const box=await pg.evaluate(()=>{ const r=document.getElementById('edAvHit').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width}; });
  const cdp=S.touch?await pg._ctx.newCDPSession(pg):null, from={x:box.x-40,y:box.y}, to={x:box.x+80,y:box.y}, N=12;
  const rest=(await pg.evaluate(AV)).rotY; let mid=null;
  if(S.touch) await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]}); else { await pg.mouse.move(from.x,from.y); await pg.mouse.down(); }
  for(let i=1;i<=N;i++){ const x=from.x+(to.x-from.x)*i/N; if(S.touch) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from.y,id:1}]}); else await pg.mouse.move(x,from.y); await H.wait(40); }
  await H.wait(250); mid=(await pg.evaluate(AV)).rotY; const s2=await shot(pg,S.tag+' Avatar picker drag turns the model');
  if(S.touch) await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); else await pg.mouse.up();
  await H.wait(2500); const after=(await pg.evaluate(AV)).rotY;
  C.ok(rest!=null&&mid!=null&&Math.abs(mid-rest)>=0.8,S.tag+' Avatar picker: a '+(to.x-from.x)+' px drag on the avatar turns the model (rotation.y '+rest+' -> '+mid+' rad while held; eases back to '+after+' after)',{rest,held:mid,after,shot:s2});
  /* pick another avatar: it sticks */
  const want=picks.find((k,i)=>i>=3&&k!==a0.mine)||picks.find(k=>k!==a0.mine);
  await tapEl(pg,S,'#edAvStrip button[data-av="'+want+'"]');
  await pg.waitForFunction(u=>{ const sc=window._slAvScene, m=sc&&sc.children.find(o=>o.userData&&o.userData.h); return !!m&&m.uuid!==u; },a0.uuid,{timeout:30000}).catch(()=>{});
  await H.wait(800); const a1=await pg.evaluate(AV), s3=await shot(pg,S.tag+' Avatar picker picked '+want);
  await tapEl(pg,S,'#edX'); await H.wait(1200);
  await openLobby(pg,S); const a2=await pg.evaluate(AV), s4=await shot(pg,S.tag+' Avatar picker reopened');
  await reloadGame(pg); await openLobby(pg,S); const a3=await pg.evaluate(AV), s5=await shot(pg,S.tag+' Avatar picker after reload');
  const sticks=a=>a.av===want&&a.mine===want&&a.on.length===1&&a.on[0]===want&&a.model;
  C.ok(a1.uuid!==a0.uuid&&sticks(a1)&&sticks(a2)&&sticks(a3)&&a1.name===a2.name&&a2.name===a3.name,S.tag+' Avatar picker: a picked avatar sticks - '+want+' ("'+a1.name+'", a new model on the pedestal) is still the one after reopening the lobby and after reloading the game',{picked:a1,reopened:a2,reloaded:a3,shots:[s3,s4,s5]});
  /* a match: every seat's avatar */
  const cards=[]; const poll=setInterval(async()=>{ try{ const c=await pg.evaluate(()=>[...document.querySelectorAll('img')].map(i=>i.getAttribute('src')||'').filter(s=>/\/assets\/img\/avatars\/card-/.test(s))); for(const x of c) if(!cards.includes(x)) cards.push(x); }catch(e){} },250);
  await pg.waitForFunction(()=>{ const b=document.getElementById('edSolo'); return b&&!b.disabled; },null,{timeout:30000}).catch(()=>{});
  await tapEl(pg,S,'#edSolo');
  const started=await pg.waitForFunction(()=>window.ED&&ED.active&&Array.isArray(ED.players)&&ED.players.length===8,null,{timeout:60000}).then(()=>true,()=>false);
  await H.wait(1500); const s6=await shot(pg,S.tag+' Avatar picker match seats');
  await pg.waitForFunction(()=>ED.phase==='carousel'||ED.phase==='plan',null,{timeout:60000}).catch(()=>{}); clearInterval(poll);
  const seats=await pg.evaluate(()=>ED.players.map(p=>({ai:!!p.ai,name:p.ai?p.name:'you',av:edAvatarFor(p).id})));
  const mine=seats.find(x=>!x.ai), rivals=seats.filter(x=>x.ai), ids=rivals.map(x=>x.av), cardIds=cards.map(u=>(/card-([a-z]+)\.webp/.exec(u)||[])[1]).filter(Boolean);
  const s7=await shot(pg,S.tag+' Avatar picker rivals');
  C.ok(started&&!!mine&&mine.av===want&&rivals.length===7&&new Set(ids).size===7&&!ids.includes(want)&&ids.every(k=>picks.includes(k)),
    S.tag+' Avatar picker: you play as '+(mine&&mine.av)+'; the 7 rivals each get a different avatar, none of them yours ('+rivals.map(x=>x.name+'='+x.av).join(', ')+'; loader cards seen: '+(cardIds.join(', ')||'none')+')',{seats,loaderCards:cardIds,shots:[s6,s7]}); }

/* ============================== run ============================== */
(async()=>{
  let pg=null, s=null;
  const run=async(S,name,fn)=>{ try{ await fn(); }catch(e){ C.ok(false,S.tag+' '+name+' ran to the end',String(e&&e.stack||e).slice(0,600)); try{ if(pg) await shot(pg,S.tag+' '+name+' error'); }catch(_){} } };
  const ctxDone=async S=>{ if(!pg) return; C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3)); await pg._ctx.close(); pg=null; };
  try{
    /* ---- PART A ---- */
    let W=null;
    try{ W=await setupWar(); s=W.s; }catch(e){ C.ok(false,'setup: a real Skyfall war through the server\'s routes',String(e&&e.stack||e).slice(0,600)); }
    if(W){ const st=(await s.api('/api/guild-war/status')).body||{}, m=st.match||{};
      W.view=m; W.log=(m.log||[]).map(e=>({n:e.n,lane:e.lane,side:e.side,a:e.a,d:e.d,rounds:e.rounds,won:e.won}));
      W.aLineNames=((m.you||{}).citadels||[]).flatMap(c=>(c.defenders||[]).map(d=>d.name));
      C.ok(m.state==='live'&&W.log.length===5&&[0,1,2,3,4].every(i=>W.log.filter(e=>e.lane===i).length===1)&&st.tournament&&st.tournament.bracket&&st.tournament.bracket[0].matches.length===8,
        'setup: a LIVE real war ('+W.gAName+' vs '+W.gBName+'), 5 real fights on the server (one per lane, '+W.log.filter(e=>e.side==='B').length+' marched by them), a 16-guild round of 8 matches',
        {fights:W.log,results:W.results,missed:{members:(m.you||{}).missedMembers,lines:(m.you||{}).missedLines},bracket:st.tournament&&(st.tournament.bracket||[]).map(r=>r.name+':'+r.matches.length)});
      for(const S of SIZES){ pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch}); await run(S,'Skyfall real war',()=>warSize(pg,S,W)); await ctxDone(S); await H.closeBrowser(); }
      await s.stop(); s=null; }
    /* ---- PART B ---- */
    const T=findTent();
    if(!T){ C.ok(false,'setup: a tent square next to a square on one of the Well\'s maps (server map seed)'); }
    const owned=T?T.options[0]:null, notOwned=T?T.options.slice(1):[];
    const keys=WELL_KEYS.filter(k=>!notOwned.includes(k)); if(owned&&!keys.includes(owned)) keys.push(owned);
    const {file}=H.seedDB(Object.fromEntries(keys.map(k=>[k,80])),u=>{ u.team=keys.slice(0,5); u.led.gold=100000; u.led.gems=5000; if(T) u.led.well2={run:freshRun(T),cleared:{}}; });
    s=await H.server(file);
    if(T){ const v=(await s.api('/api/well/state')).body||{}, sq=((v.grid||[])[T.col]||[])[T.row]||{};
      const ok=sq.type==='tent'&&JSON.stringify((sq.options||[]).map(o=>o.key))===JSON.stringify(T.options)&&v.pos&&v.pos.col===T.pos.col;
      C.ok(ok,'setup: the Well run stands at column '+T.pos.col+' row '+T.pos.row+' of map '+T.map+(T.path?' ('+T.path+')':'')+', next to the server\'s tent at '+T.col+'/'+T.row+' offering '+T.options.join(', ')+' (we own '+owned+')',
        {server:{type:sq.type,options:(sq.options||[]).map(o=>({key:o.key,up:o.up,owned:o.owned,hp:o.hp,atk:o.atk})),pos:v.pos,map:v.map,path:v.path},want:T});
      if(ok){ for(const [k,S] of [[0,H.SIZES.desktop],[1,H.SIZES.phone]]){
          if(k===1){ await s.stop(); resetRun(file,T); s=await H.server(file); }
          pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch}); await run(S,'Tent',()=>wellTent(pg,S,s,T,k===0)); await ctxDone(S); await H.closeBrowser(); } } }
    for(const S of SIZES){ pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      await run(S,'Tap mode tint',()=>teleTint(pg,S));
      await run(S,'Avatar picker',()=>avatarPicker(pg,S));
      await ctxDone(S); await H.closeBrowser(); }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); if(s) await s.stop(); }
  C.done();
})();
