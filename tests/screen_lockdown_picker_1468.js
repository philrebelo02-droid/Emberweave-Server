'use strict';
/* Lockdown checklist 25 Nov 2026 (01 - EVERY FEATURE IN THE GAME.md; audit notes audit/heroes-B-equipment-to-squad.md), v1468 round: the
   shared squad picker, result screen fit, summoning, lore narration, HD glyph icons and the loading lines, in a real browser on this
   checkout's server (temp DB). Sizes: phone 844x390 (touch) and desktop 1280x720; the result screen also at 740x360 and the Fold cover 915x412.
   Server A (13 owned heroes, every class, all 160 stages cleared, Elite / Veteran open, a Starless Well run holding one loan hero):
   - Squad picker (shared):
     . Mode-specific title: the picker opened from a Campaign stage (stage panel Fight), Arena attack (an opponent), the Vault (Select Heroes),
       the guild raid (raidSelectHeroes, the guild raid Fight handler - no guild is seeded), the Province (Island > Training Province > Drill >
       CHALLENGE), the Starless Well (a fight square) and a City Wall line (Wall > line 1): the title names the mode.
     . Owned heroes by power: only owned heroes, strongest first by the card's power, the order unchanged after two picks.
     . Class filter row: each class button shows only that class (and as many as the player owns of it); All brings everyone back.
     . Starless Well loan heroes: the run's loan hero (not owned) shows in the Well picker with its loan tag and can be picked.
     . Hero tags: a hero put on Wall line 1 shows "on Line 1" (greyed, not pickable) on line 2; a hero on a march shows "marching - not
       defending" on the Wall line and Arena defence pickers, and no such tag on the Campaign picker. The march is a march record put in this
       device's save (G.marches, the record the world map writes) - a real world-map march is outside this test.
     . Pick 5 (or 10): 7 taps give 5 in the Campaign picker; 12 taps give 10 (5 Fighters + 5 Backup) in the Vault and the guild raid.
     . Battle button states: PICK AT LEAST 1 HERO (empty Campaign squad, disabled), PICK 5 FIGHTERS (3/5) in the Vault (disabled), BATTLE with
       the stage's stamina cost and the stamina icon (Campaign), NEED n STAMINA (have/max) with 0 stamina (server B).
     . Reset Comp: one tap empties a 3-hero squad (cards, slots and the saved squad) and greys the button.
     . Empty slots inert: a tap on an empty squad slot changes nothing (squad, list, slots, screen).
     . Squad saved: a Campaign squad is the same squad in Elite, Veteran and Province, the Vault keeps its own, and the Campaign squad is still
       there on reopening and after a page reload.
   - Result screen fits: a real won Campaign fight (1-1, the five strongest) and a real lost one (16-5, one level-1 hero) - the fight stepped
     on the page's own engine with AUTO on, the server resolves it - at 844x390, 740x360 and the Fold cover every result screen in turn (Damage
     Done, then the reward pop on a win / the result page on a loss): its panel, any box in it and the page never scroll (scrollHeight <=
     clientHeight), every visible button on screen and not covered, and each screen's button leads on to the map.
   - Summoning: Summon cost - the server table (/api/hero/summon-table) costs 10 / 30 / 80 for 1 / 2 / 3-star heroes; the Heroes list cards
     and the summon window of one locked hero per tier show the server's cost. Fragment cap (server B): every 2-star hero owned at 9,999
     fragments, the first Diamond wish (always a 2-star hero, so a duplicate) from the Wishing Pool's own button: the hero still has 9,999 on
     the server, in the page and in its Stars panel.
   - Lore narration: Voice ON in Settings > the Lore tab of Vael and KonWu shows the play button; a tap starts the narration audio element
     (playing, time moving), a second tap stops it; Voice OFF hides the button. If this Chromium cannot decode .m4a, the lore file request is
     answered with a silent WAV of the same URL (the real file is fetched and checked separately) so the element can play.
   - HD glyph icons: at deviceScaleFactor 2, every glyph / core / fragment <img> on Vael's Glyphs tab and in the glyph recipe tree a slot
     opens (the game has no screen named "encyclopedia"; the recipe tree is where every glyph, core and fragment icon is shown) has
     naturalWidth >= 2x its displayed width; the placeholder diamond (missing art) fails.
   - Loading lines (a fresh page per size, its first fight): Full loading screen - 0 fight art requests (hero / monster / spell sheets,
     cards, battlefields) after the battle starts; Battle start smooth - requestAnimationFrame gaps over the first 5 s (FAIL only over 250 ms,
     else WATCH: this host's software rendering is not a phone); Phone art tier - how the page picks the tier (ART_TIER from screen size /
     device memory) and, on the phone, every battle sheet loaded is its phone-tier file (assets/anim/tiers_1141.json "p") and it loaded;
     Download all art - Settings > Storage shows the option with true sizes (= /api/asset-sizes summed over this device's file list, and a
     file's table size = its real bytes); Download, a few files, Stop: the files are in the device's art cache.
   One screenshot per check per size (SHOT64 lines). Every check prints what it measured. Exit 0 = all passed. */
const fs=require('fs'), path=require('path'), H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_picker_1468.js', C=H.checker(TEST), shot=H.shooter(TEST);
const WELLMOD=require(path.join(H.ROOT,'server','starless-well.js'));
const HERO_BASE=require(path.join(H.ROOT,'server','sim.js')).HERO_BASE;
const SRV_SRC=fs.readFileSync(path.join(H.ROOT,'server.js'),'utf8');
const POOL_START=JSON.parse(/const POOL_START_STARS=(\{[^}]*\})/.exec(SRV_SRC)[1].replace(/([A-Za-z_][A-Za-z0-9_]*):/g,'"$1":'));
const startStars=k=>POOL_START[k]||(HERO_BASE[k]||{}).stars||1;   /* the server's own rule (server.js summonSpecSrv) */
const SUMMON_RULE={1:10,2:30,3:80};

/* server A: every class twice (three Tanks), distinct levels so the power order is clear; brannus at level 1 loses 16-5 */
const HEROES={vael:100,grosk:96,aureth:92,konwu:88,sylthaine:84,umbris:80,vireo:76,lumi:72,calypsa:68,meridian:64,vex:60,nox:56,brannus:1};
const OWNED=Object.keys(HEROES);
const LOAN='mirelle', WALL_HERO='vex', MARCH_HERO='nox', SAVED=['sylthaine','vireo','calypsa'], WEAK='brannus';
const SMALL={w:740,h:360,touch:true,tag:'phone 740x360'};

/* ---------------------------------------------------------------- page helpers (window.SLP) */
const PICK_HELPERS=()=>{ if(window.SLP) return true;
  /* scroll only the boxes a player can scroll (overflow auto / scroll) so the element is in view - never a clipped game frame */
  const reveal=el=>{ for(let a=el.parentElement;a&&a!==document.body&&a!==document.documentElement;a=a.parentElement){ const cs=getComputedStyle(a);
      if(/auto|scroll/.test(cs.overflowY)&&a.scrollHeight>a.clientHeight+1){ const r=el.getBoundingClientRect(), b=a.getBoundingClientRect(); if(r.top<b.top+4||r.bottom>b.bottom-4) a.scrollTop+=(r.top+r.height/2)-(b.top+b.height/2); }
      if(/auto|scroll/.test(cs.overflowX)&&a.scrollWidth>a.clientWidth+1){ const r=el.getBoundingClientRect(), b=a.getBoundingClientRect(); if(r.left<b.left+4||r.right>b.right-4) a.scrollLeft+=(r.left+r.width/2)-(b.left+b.width/2); } } };
  const point=sel=>{ const el=document.querySelector(sel); if(!el) return {ok:false,missing:true,why:'missing '+sel}; reveal(el); const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, hit=document.elementFromPoint(x,y);
    return {ok:!!hit&&(hit===el||el.contains(hit)),x,y,who:SL.whoAt(el),box:SL.R(el)}; };
  const team=()=>{ try{ return (isWallCtx(teamCtx)?wallArr(teamCtx):(teamCtx==='arena'?G.arenaDef:(teamCtx==='arenaAtk'?squadFor('arenaAtk'):squadFor(squadModeKey()))))||[]; }catch(e){ return null; } };
  const num=s=>{ const m=String(s==null?'':s).replace(/[,.\s  ']/g,'').match(/\d+/); return m?+m[0]:null; };
  const picker=()=>{ const cards=[...document.querySelectorAll('#roster .rsCard')].filter(SL.vis).map(c=>{ const k=c.dataset.heroKey;
      return {k,pow:num((c.querySelector('.rsPow')||{}).textContent),sel:c.classList.contains('selected'),op:c.style.opacity||'1',role:(HERO_TYPES[k]||{}).role,text:SL.txt(c)}; });
    const sb=document.getElementById('startBtn'), rc=document.getElementById('resetCompBtn');
    return {active:state==='menu'&&document.getElementById('menu').classList.contains('active'),title:SL.txt('#menuTitle'),sub:SL.txt('#menuSub'),mode:CUR&&CUR.mode,portal:CUR&&CUR.portal,node:CUR&&CUR.node,ctx:teamCtx,
      squadKey:squadModeKey(),cards,team:(team()||[]).slice(),
      slots:[...document.querySelectorAll('#rosterSlots .rsSlot')].map(x=>({full:x.classList.contains('full'),i:x.dataset.rsSlot==null?null:+x.dataset.rsSlot,name:SL.txt(x.querySelector('.rsName'))})),
      labels:[...document.querySelectorAll('#rosterSlots .rsSlotLbl')].map(SL.txt),
      start:sb?{text:SL.txt(sb),dis:!!sb.disabled,vis:SL.vis(sb),stIcon:!!sb.querySelector('img[src*="res-stamina"]')}:null,reset:rc?{dis:!!rc.disabled,vis:SL.vis(rc)}:null,
      classes:[...document.querySelectorAll('#rosterClass [data-rs-class]')].map(b=>({c:b.dataset.rsClass,on:b.classList.contains('on'),vis:SL.vis(b)})),classF:rosterClassF}; };
  window.SLP={reveal,point,team,picker,num}; return true; };
async function prep(pg){ await H.prep(pg); await pg.evaluate(PICK_HELPERS); }
const P=pg=>pg.evaluate(()=>SLP.picker());

/* a player's tap / click on an element (scrolled into view inside its own list first). Playwright's own element tap, which finds the element's
   real screen box: several screens are drawn with CSS zoom (the Arena board, the Vault), where getBoundingClientRect coordinates miss the element
   (first cluster run: the Arena opponent's Challenge tap landed beside it). The coordinate tap is only the fallback, and says so. */
async function tap(pg,S,sel){ await prep(pg); const p=await pg.evaluate(s=>SLP.point(s),sel); if(p.missing) throw new Error(p.why);
  try{ if(S.touch) await pg.tap(sel,{timeout:8000}); else await pg.click(sel,{timeout:8000}); p.how='element tap'; }
  catch(e){ p.how='coordinate tap ('+String(e.message||e).split('\n')[0].slice(0,90)+')'; if(S.touch) await pg.touchscreen.tap(p.x,p.y); else await pg.mouse.click(p.x,p.y); }
  return p; }
const cardSel=k=>'#roster .rsCard[data-hero-key="'+k+'"]';
async function tapCard(pg,S,k){ const p=await tap(pg,S,cardSel(k)); await H.wait(300); return p; }
async function pickKeys(pg,S,keys){ for(const k of keys) await tapCard(pg,S,k); await H.wait(300); await prep(pg); }
async function resetSquad(pg,S){ const r=await P(pg); if(r.team.length&&r.reset&&!r.reset.dis){ await tap(pg,S,'#resetCompBtn'); await H.wait(400); } await prep(pg); }
async function setClass(pg,S,c){ await tap(pg,S,'#rosterClass [data-rs-class="'+c+'"]'); await H.wait(450); await prep(pg); }

/* ---------------------------------------------------------------- opening the picker */
async function waitPicker(pg){ await pg.waitForFunction(()=>state==='menu'&&document.getElementById('menu').classList.contains('active')&&document.querySelectorAll('#roster .rsCard').length>0,null,{timeout:40000}).catch(()=>{});
  await H.wait(1000); await H.clean(pg); await prep(pg); return pg.evaluate(()=>state==='menu'&&document.getElementById('menu').classList.contains('active')); }
async function fallback(pg,how,fn,arg){ if(await pg.evaluate(()=>state==='menu'&&document.getElementById('menu').classList.contains('active'))) return how;
  await pg.evaluate(fn,arg); await waitPicker(pg); return how+' -> did not open, FALLBACK by the page function'; }
async function openStagePicker(pg,S,portal,node){
  let how=await H.openBuilding(pg,'campaign',S.touch);
  await pg.waitForFunction(()=>state==='campaign'&&document.querySelectorAll('#cmap .cnode').length>0,null,{timeout:30000}).catch(()=>{});
  await pg.evaluate(([m,n])=>{ try{ closeStageModal(); }catch(e){} PORTAL=m; campViewCh=Math.ceil(n/10); campViewUser=true; renderRoadmap(); openStageModal(n,m); },[portal,node]);
  await pg.waitForFunction(k=>window.SM_KEY===k&&document.getElementById('stageModal').classList.contains('active'),portal+':'+node,{timeout:20000}).catch(()=>{});
  await H.wait(800); how='Campaign plate ('+how+') > '+portal+' stage panel '+node+' > Fight';
  try{ await tap(pg,S,'#smBattle'); }catch(e){}
  await waitPicker(pg);
  return fallback(pg,how,()=>document.getElementById('smBattle').click()); }
const OPEN={
  campaign:(pg,S)=>openStagePicker(pg,S,'normal',14),
  elite:(pg,S)=>openStagePicker(pg,S,'elite',1),
  veteran:(pg,S)=>openStagePicker(pg,S,'veteran',1),
  arena:async(pg,S)=>{ const how='Arena plate ('+await H.openBuilding(pg,'arena',S.touch)+') > first opponent';
    await pg.waitForSelector('#arenaOpps [data-opp]',{timeout:40000}).catch(()=>{}); await H.wait(700);
    try{ await tap(pg,S,'#arenaOpps [data-opp]'); }catch(e){} await waitPicker(pg);
    return fallback(pg,how,()=>{ const o=(typeof ARENA!=='undefined'&&ARENA&&ARENA.opps&&ARENA.opps[0])||{name:'x',rank:2,id:'x'}; CUR={mode:'arena',local:true,oppName:o.name,oppRank:o.rank,oppId:o.id}; teamCtx='arenaAtk'; menuReturn='arena'; show('menu'); }); },
  arenaDef:async(pg,S)=>{ const how='Arena plate ('+await H.openBuilding(pg,'arena',S.touch)+') > Set defence';
    await pg.waitForSelector('#setArenaDef',{timeout:40000}).catch(()=>{}); await H.wait(600);
    try{ await tap(pg,S,'#setArenaDef'); }catch(e){} await waitPicker(pg);
    return fallback(pg,how,()=>{ teamCtx='arena'; menuReturn='arena'; show('menu'); }); },
  vault:async(pg,S)=>{ const how='Vault plate ('+await H.openBuilding(pg,'dungeon',S.touch)+') > Select Heroes';
    await pg.waitForSelector('#dungeon .vtPick .btn.secondary',{timeout:40000}).catch(()=>{}); await H.wait(800);
    try{ await tap(pg,S,'#dungeon .vtPick .btn.secondary'); }catch(e){} await waitPicker(pg);
    return fallback(pg,how,()=>vaultSelectHeroes()); },
  graid:async(pg,S)=>{ await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} raidSelectHeroes(); }); await waitPicker(pg);
    return 'raidSelectHeroes() - the guild raid Fight the boss handler (no guild seeded)'; },
  province:async(pg,S)=>{ let how='Island plate ('+await H.openBuilding(pg,'skyisland',S.touch)+') > Training Province > Drill > CHALLENGE';
    try{ await pg.waitForFunction(()=>document.querySelectorAll('#skyIslandBody .islespot').length>0,null,{timeout:30000}); await H.wait(800);
      await tap(pg,S,'#skyIslandBody .islespot[data-if="training"]>div');
      await pg.waitForFunction(()=>document.querySelector('.provScene .provRow[data-prov="rune"]'),null,{timeout:30000}); await H.wait(1200); await H.clean(pg);
      await tap(pg,S,'.provScene .provRow[data-prov="rune"]');
      await pg.waitForFunction(()=>{ const b=document.querySelector('#pvGo'); return b&&!b.disabled; },null,{timeout:30000}); await H.wait(800); await H.clean(pg);
      await tap(pg,S,'#pvGo'); }catch(e){ how+=' (route failed: '+String(e.message||e).slice(0,80)+')'; }
    await waitPicker(pg);
    return fallback(pg,how,async()=>{ document.querySelectorAll('.provScene').forEach(n=>n.remove()); await provSync(); provChallenge('gold'); }); },
  well:async(pg,S)=>{ let how='Well plate ('+await H.openBuilding(pg,'well',S.touch)+') > a fight square';
    await pg.waitForFunction(()=>document.querySelectorAll('#wlMap .wlSq.wlReach').length>0,null,{timeout:40000}).catch(()=>{}); await H.wait(1200);
    const sq=await pg.evaluate(()=>{ const S=WELL.state; const b=[...document.querySelectorAll('#wlMap .wlSq.wlReach')].find(b=>{ const s=S&&S.grid[+b.dataset.c]&&S.grid[+b.dataset.c][+b.dataset.r]; return s&&(s.type==='fight'||s.type==='boss'); });
      if(!b) return null; b.id='slWellSq'; return b.dataset.c+'/'+b.dataset.r; });
    if(sq){ how+=' '+sq; try{ await tap(pg,S,'#slWellSq'); }catch(e){} } else how+=' (no reachable fight square)';
    await waitPicker(pg);
    return fallback(pg,how,()=>{ const S=WELL.state; for(let c=0;c<S.grid.length;c++) for(let r=0;r<(S.grid[c]||[]).length;r++){ const s=S.grid[c][r]; if(s&&s.type==='fight'){ const ov=document.getElementById('wlMap'); if(ov) ov.remove(); CUR={mode:'well',well:{col:c,row:r,map:S.map,type:s.type,foes:(s.foes||[]).slice()}}; teamCtx='campaign'; menuReturn='home'; show('menu'); return; } } }); },
  wall:(pg,S)=>openWallLine(pg,S,'wall'),
  wall2:(pg,S)=>openWallLine(pg,S,'wall2'),
};
async function openWallLine(pg,S,wc){ const how='City Wall plate ('+await H.openBuilding(pg,'wall',S.touch)+') > line '+({wall:1,wall2:2,wall3:3})[wc];
  await pg.waitForSelector('[data-wc="'+wc+'"]',{timeout:30000}).catch(()=>{}); await H.wait(700);
  try{ await tap(pg,S,'[data-wc="'+wc+'"]'); }catch(e){} await waitPicker(pg);
  return fallback(pg,how,c=>{ teamCtx=c; menuReturn='wall'; show('menu'); },wc); }
async function openPicker(pg,S,mode){ const how=await OPEN[mode](pg,S); await prep(pg); return how; }

/* ---------------------------------------------------------------- Squad picker checks */
async function titleCheck(pg,S,mode,how){
  const r=await pg.evaluate(m=>{ const p=SLP.picker(); let want=null, re=null;
    if(m==='campaign'){ want=ewT('roster.stage',{n:stageCode(CUR.node)}); re='^STAGE \\d+-\\d+$'; }
    else if(m==='arena'){ want=ewT('roster.arena_attackers'); re='ARENA.*ATTACK'; }
    else if(m==='vault'){ want=ewT('roster.vault_title'); re='VAULT'; }
    else if(m==='graid'){ want=ewT('roster.graid_title'); re='GUILD RAID'; }
    else if(m==='province'){ const q=CUR.prov||{}, nm=String(((PROV_META[q.t]||PROV_META.gold).nm)).toUpperCase(); want=ewT('roster.prov_title',{name:nm,n:q.stage|0}); re=nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'.*STAGE \\d+'; }
    else if(m==='well'){ const w=CUR.well||{}; want=w.type==='boss'?ewT('roster.well_title_boss',{n:w.map|0}):ewT('roster.well_title',{n:w.map|0}); re='STARLESS WELL.*MAP \\d+'; }
    else if(m==='wall'){ want=ewT('roster.set_wall',{n:1}); re='WALL.*LINE 1'; }
    return {title:p.title,want,re,mode:p.mode,ctx:p.ctx,active:p.active,cards:p.cards.length}; },mode);
  const s=await shot(pg,S.tag+' Mode-specific title '+mode);
  C.ok(r.active&&!!r.want&&r.title===r.want&&new RegExp(r.re).test(r.title)&&r.cards>0,
    S.tag+' Mode-specific title: the '+mode+' picker (opened by '+how+') is titled "'+r.title+'" (the '+mode+' title, names the mode)',{...r,shot:s}); }

async function ownedByPower(pg,S){
  await setClass(pg,S,'All'); await resetSquad(pg,S);
  const a=await P(pg), keys=a.cards.map(c=>c.k), pows=a.cards.map(c=>c.pow);
  const notOwned=keys.filter(k=>OWNED.indexOf(k)<0), missing=OWNED.filter(k=>keys.indexOf(k)<0), sorted=pows.every((p,i)=>p>0&&(i===0||pows[i-1]>=p));
  await tapCard(pg,S,keys[2]); await tapCard(pg,S,keys[0]); await H.wait(400);
  const b=await P(pg), same=b.cards.map(c=>c.k).join()===keys.join(), sel=b.cards.filter(c=>c.sel).map(c=>c.k);
  const s=await shot(pg,S.tag+' Owned heroes by power');
  C.ok(!notOwned.length&&!missing.length&&sorted&&same&&sel.length===2,
    S.tag+' Owned heroes by power: the picker lists exactly the '+OWNED.length+' owned heroes, strongest card power first, and the order stays the same after picking 2',
    {order:a.cards.map(c=>c.k+' '+c.pow),notOwned,missing,sorted,afterPicks:b.cards.map(c=>c.k).join(),picked:sel,shot:s});
  await resetSquad(pg,S); }

async function classFilter(pg,S){
  await setClass(pg,S,'All'); const all=await P(pg);
  const roles=[...new Set(all.cards.map(c=>c.role))], row=all.classes.map(c=>c.c);
  C.ok(row[0]==='All'&&roles.every(r=>row.indexOf(r)>=0)&&all.classes.every(c=>c.vis),S.tag+' Class filter row: the row ('+row.join(', ')+') holds every owned hero\'s class ('+roles.join(', ')+'), all buttons visible',{row,roles});
  for(const c of row.filter(x=>x!=='All')){
    await setClass(pg,S,c); const r=await P(pg), want=all.cards.filter(x=>x.role===c).map(x=>x.k);
    const s=await shot(pg,S.tag+' Class filter '+c);
    C.ok(r.classF===c&&r.cards.length===want.length&&r.cards.every(x=>x.role===c)&&(r.classes.find(x=>x.c===c)||{}).on,
      S.tag+' Class filter row: '+c+' shows only '+c+' heroes ('+r.cards.length+' of the '+want.length+' owned)',{shown:r.cards.map(x=>x.k+' '+x.role),want,shot:s}); }
  await setClass(pg,S,'All'); const back=await P(pg);
  C.ok(back.cards.length===all.cards.length,S.tag+' Class filter row: All shows every owned hero again ('+back.cards.length+')',{n:back.cards.length}); }

async function pick5(pg,S){
  await setClass(pg,S,'All'); await resetSquad(pg,S);
  const a=await P(pg), keys=a.cards.slice(0,7).map(c=>c.k); await pickKeys(pg,S,keys);
  const r=await P(pg), s=await shot(pg,S.tag+' Pick 5 Campaign');
  C.ok(r.team.length===5&&r.cards.filter(c=>c.sel).length===5&&r.slots.length===5&&r.slots.filter(x=>x.full).length===5,
    S.tag+' Pick 5 (or 10): 7 taps in the Campaign picker pick 5 (5 slots, all full; the 6th and 7th taps do nothing)',{tapped:keys,team:r.team,slots:r.slots.length,full:r.slots.filter(x=>x.full).length,shot:s});
  await resetSquad(pg,S); }

async function pick10(pg,S,mode){
  await setClass(pg,S,'All'); await resetSquad(pg,S);
  if(mode==='vault'){ const a=await P(pg); await pickKeys(pg,S,a.cards.slice(0,3).map(c=>c.k));
    const r=await P(pg), want=await pg.evaluate(()=>ewT('roster.pick_fighters',{n:5,have:3})), s=await shot(pg,S.tag+' Battle button PICK 5 FIGHTERS');
    C.ok(r.team.length===3&&r.start&&r.start.text===want&&/PICK 5 FIGHTERS \(3\/5\)/.test(r.start.text)&&r.start.dis,
      S.tag+' Battle button states: the Vault with 3 picked reads "'+(r.start&&r.start.text)+'" and is disabled',{start:r.start,want,team:r.team,shot:s}); }
  const tried=new Set();
  for(let i=0;i<14;i++){ const r=await P(pg); if(r.team.length>=10) break; const c=r.cards.find(c=>!c.sel&&!tried.has(c.k)); if(!c) break;
    tried.add(c.k); await tapCard(pg,S,c.k); }
  /* then two more taps on cards not picked: the cap holds */
  { const r=await P(pg); for(const c of r.cards.filter(c=>!c.sel).slice(0,2)) await tapCard(pg,S,c.k); }
  const r=await P(pg), s=await shot(pg,S.tag+' Pick 10 '+mode);
  C.ok(r.team.length===10&&r.cards.filter(c=>c.sel).length===10&&r.slots.length===10&&r.slots.filter(x=>x.full).length===10&&r.labels.length===2,
    S.tag+' Pick 5 (or 10): the '+(mode==='vault'?'Vault':'guild raid')+' picker takes 10 (5 Fighters + 5 Backup) and no more',{team:r.team,slots:r.slots.length,full:r.slots.filter(x=>x.full).length,labels:r.labels,start:r.start,shot:s});
  return r.team.slice(); }

async function battleStates(pg,S){
  await setClass(pg,S,'All'); await resetSquad(pg,S);
  const e=await P(pg), want0=await pg.evaluate(()=>ewT('roster.pick_one')), s0=await shot(pg,S.tag+' Battle button PICK AT LEAST 1 HERO');
  C.ok(e.team.length===0&&e.start&&e.start.text===want0&&e.start.dis&&e.start.vis,S.tag+' Battle button states: an empty Campaign squad reads "'+(e.start&&e.start.text)+'" and is disabled',{start:e.start,want:want0,shot:s0});
  await tapCard(pg,S,e.cards[0].k);
  const r=await P(pg), c=await pg.evaluate(()=>({cost:stageStamCost(CUR.node,CUR.portal),stam:G.stamina,battle:ewT('roster.battle')})), s1=await shot(pg,S.tag+' Battle button BATTLE with stamina');
  C.ok(r.start&&!r.start.dis&&r.start.text.indexOf(c.battle)===0&&r.start.stIcon&&SLPnum(r.start.text.slice(c.battle.length))===c.cost&&c.stam>=c.cost,
    S.tag+' Battle button states: 1 hero picked, the Campaign button reads "'+(r.start&&r.start.text)+'" (BATTLE + stamina icon + the stage cost '+c.cost+'), enabled',{start:r.start,...c,shot:s1});
  await resetSquad(pg,S); }
const SLPnum=s=>{ const m=String(s||'').replace(/[,.\s ]/g,'').match(/\d+/); return m?+m[0]:null; };

async function resetComp(pg,S){
  await setClass(pg,S,'All'); await resetSquad(pg,S); const a=await P(pg); await pickKeys(pg,S,a.cards.slice(0,3).map(c=>c.k));
  const b=await P(pg); await tap(pg,S,'#resetCompBtn'); await H.wait(500); await prep(pg);
  const r=await P(pg), saved=await pg.evaluate(()=>{ const k=squadModeKey(); return {key:k,saved:((G.squads||{})[k]||[]).slice()}; }), s=await shot(pg,S.tag+' Reset Comp');
  C.ok(b.team.length===3&&r.team.length===0&&r.cards.filter(c=>c.sel).length===0&&r.slots.filter(x=>x.full).length===0&&saved.saved.length===0&&r.reset&&r.reset.dis,
    S.tag+' Reset Comp: one tap empties a 3-hero Campaign squad (no card selected, no slot full, the saved squad empty, RESET greyed)',{before:b.team,after:r.team,...saved,reset:r.reset,shot:s}); }

async function emptySlots(pg,S){
  await setClass(pg,S,'All'); await resetSquad(pg,S); const a=await P(pg); await pickKeys(pg,S,a.cards.slice(0,2).map(c=>c.k));
  const snap=()=>pg.evaluate(()=>({state,team:SLP.team().join(),list:document.getElementById('roster').innerHTML.length,slots:document.getElementById('rosterSlots').innerHTML,title:SL.txt('#menuTitle'),saved:JSON.stringify((G.squads||{})[squadModeKey()]||[]),start:SL.txt('#startBtn')}));
  const info=await pg.evaluate(()=>{ const e=[...document.querySelectorAll('#rosterSlots .rsSlot')].filter(x=>!x.classList.contains('full')); const t=e[1]||e[0]; if(!t) return null; t.id='slEmptySlot';
    return {n:e.length,hasSlotIdx:t.hasAttribute('data-rs-slot'),onclick:!!t.onclick,cursor:getComputedStyle(t).cursor,box:SL.R(t)}; });
  const b0=await snap(); let p=null; if(info) p=await tap(pg,S,'#slEmptySlot'); await H.wait(700); await prep(pg); const b1=await snap();
  const s=await shot(pg,S.tag+' Empty slots inert');
  const same=Object.keys(b0).every(k=>b0[k]===b1[k]);
  C.ok(!!info&&same&&!info.hasSlotIdx&&!info.onclick,S.tag+' Empty slots inert: a tap on an empty squad slot changes nothing (same squad, list, slots, screen; the slot has no tap handler, cursor '+(info&&info.cursor)+')',
    {slot:info,tapped:p&&{at:[Math.round(p.x),Math.round(p.y)],hit:p.who},before:{team:b0.team,state:b0.state,list:b0.list},after:{team:b1.team,state:b1.state,list:b1.list},changed:Object.keys(b0).filter(k=>b0[k]!==b1[k]),shot:s});
  await resetSquad(pg,S); }

async function wellLoan(pg,S,s){
  const r=await pg.evaluate(k=>{ const c=document.querySelector('#roster .rsCard[data-hero-key="'+k+'"]'); return {loans:(WELL.state&&WELL.state.loans)||[],owned:!!(G.unlocked||{})[k],card:!!c&&SL.vis(c),text:c?SL.txt(c):'',loanWord:ewT('isle.loan'),name:(HERO_TYPES[k]||{}).name}; },LOAN);
  const st=(await s.api('/api/well/state')).body||{};
  let picked=null; if(r.card){ await setClass(pg,S,'All'); await resetSquad(pg,S); await tapCard(pg,S,LOAN); picked=(await P(pg)).team; }
  const sh=await shot(pg,S.tag+' Starless Well loan heroes');
  C.ok(r.card&&!r.owned&&r.loans.indexOf(LOAN)>=0&&r.text.indexOf(r.loanWord)>=0&&!!picked&&picked.indexOf(LOAN)>=0,
    S.tag+' Starless Well loan heroes: the run\'s loan hero '+r.name+' (not owned) shows in the Well picker tagged "'+r.loanWord+'" and can be picked',{...r,serverLoans:st.loans||(st.state&&st.state.loans)||null,picked,shot:sh});
  await resetSquad(pg,S); }

async function heroTags(pg,S){
  /* Wall line 1: put WALL_HERO on it */
  let how=await openPicker(pg,S,'wall'); await titleCheck(pg,S,'wall',how);
  await setClass(pg,S,'All'); await resetSquad(pg,S); await tapCard(pg,S,WALL_HERO); const l1=await P(pg);
  /* a march record in this device's save: MARCH_HERO is away for an hour */
  await pg.evaluate(k=>{ const now=Date.now(); activeMarches().push({id:'slMarch1468',dir:'out',ctype:'attack',tName:'Screen check camp',tId:'sl-1468',real:false,fx:0,fy:0,tRank:1,tPower:1,ally:false,heroes:[k],dTeam:[],depart:now,arrive:now+1800000,home:now+3600000,out:1800000,resolved:false}); saveG(); },MARCH_HERO);
  how=await openPicker(pg,S,'wall2');
  const w2=await P(pg), words=await pg.evaluate(()=>({line:ewT('roster.on_line',{n:1}),march:ewT('roster.marching')}));
  const wc=w2.cards.find(c=>c.k===WALL_HERO)||{}, mc=w2.cards.find(c=>c.k===MARCH_HERO)||{};
  await resetSquad(pg,S); await tapCard(pg,S,WALL_HERO); await tapCard(pg,S,MARCH_HERO); const w2b=await P(pg);
  const s1=await shot(pg,S.tag+' Hero tags Wall line 2');
  C.ok(l1.team.indexOf(WALL_HERO)>=0&&wc.text&&wc.text.indexOf(words.line)>=0&&+wc.op<1&&w2b.team.indexOf(WALL_HERO)<0,
    S.tag+' Hero tags: '+WALL_HERO+' on Wall line 1 shows "'+words.line+'" on the line 2 picker (opened by '+how+'), greyed (opacity '+wc.op+') and a tap does not pick it',{line1:l1.team,card:wc,line2Team:w2b.team,shot:s1});
  C.ok(mc.text&&mc.text.indexOf(words.march)>=0&&+mc.op<1&&w2b.team.indexOf(MARCH_HERO)<0,
    S.tag+' Hero tags: '+MARCH_HERO+' on a march shows "'+words.march+'" on the Wall line 2 picker, greyed and not pickable',{card:mc,line2Team:w2b.team,shot:s1});
  how=await openPicker(pg,S,'arenaDef'); const ad=await P(pg), am=ad.cards.find(c=>c.k===MARCH_HERO)||{}, s2=await shot(pg,S.tag+' Hero tags Arena defence');
  C.ok(ad.title===await pg.evaluate(()=>ewT('roster.set_arena_def'))&&am.text&&am.text.indexOf(words.march)>=0&&+am.op<1,
    S.tag+' Hero tags: the Arena defence picker ("'+ad.title+'", opened by '+how+') shows "'+words.march+'" on '+MARCH_HERO,{card:am,shot:s2});
  how=await openPicker(pg,S,'campaign'); const cp=await P(pg), cm=cp.cards.find(c=>c.k===MARCH_HERO)||{}, s3=await shot(pg,S.tag+' Hero tags Campaign has none');
  C.ok(!!cm.text&&cm.text.indexOf(words.march)<0&&cm.op==='1',S.tag+' Hero tags: the Campaign picker (not a defence screen) shows no marching tag on '+MARCH_HERO,{card:cm,shot:s3});
  await pg.evaluate(()=>{ G.marches=activeMarches().filter(m=>m.id!=='slMarch1468'); saveG(); }); }

async function reloadGame(pg){
  await pg.reload({waitUntil:'domcontentloaded',timeout:180000});
  await pg.waitForFunction(()=>typeof renderHeroDetail==='function'&&typeof api==='function'&&typeof adoptLedger==='function'&&typeof LANG==='object',null,{timeout:180000});
  await H.wait(1500); await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await H.wait(1000);
  await pg.evaluate(async()=>{ G.tutSkipped=true; G.tutDone=true; G.ftutOff=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); await ledgerSync(); });
  await H.wait(800); await prep(pg); }

async function squadSaved(pg,S){
  let how=await openPicker(pg,S,'campaign'); await setClass(pg,S,'All'); await resetSquad(pg,S); await pickKeys(pg,S,SAVED);
  const base=await P(pg), s0=await shot(pg,S.tag+' Squad saved Campaign picked');
  C.ok(base.team.join()===SAVED.join(),S.tag+' Squad saved: picked '+SAVED.join(', ')+' in the Campaign picker ('+how+')',{team:base.team,key:base.squadKey,shot:s0});
  const same=r=>r.team.join()===SAVED.join()&&r.cards.filter(c=>c.sel).map(c=>c.k).sort().join()===SAVED.slice().sort().join();
  for(const m of ['elite','veteran','province']){ how=await openPicker(pg,S,m); const r=await P(pg), s=await shot(pg,S.tag+' Squad saved '+m);
    C.ok(r.active&&same(r)&&r.squadKey==='campaign',S.tag+' Squad saved: the '+m+' picker (opened by '+how+') holds the same squad as Campaign ('+r.team.join(', ')+')',{mode:r.mode,portal:r.portal,key:r.squadKey,team:r.team,selected:r.cards.filter(c=>c.sel).map(c=>c.k),shot:s}); }
  how=await openPicker(pg,S,'vault'); const v=await P(pg), sv=await shot(pg,S.tag+' Squad saved Vault keeps its own');
  C.ok(v.active&&v.squadKey==='vault'&&v.team.join()!==SAVED.join(),S.tag+' Squad saved: the Vault picker keeps its own squad ('+v.team.length+' heroes: '+v.team.join(', ')+'), not the Campaign one',{key:v.squadKey,team:v.team,shot:sv});
  how=await openPicker(pg,S,'campaign'); const c2=await P(pg), sc=await shot(pg,S.tag+' Squad saved Campaign reopened');
  C.ok(same(c2),S.tag+' Squad saved: Campaign reopened still holds '+c2.team.join(', '),{team:c2.team,shot:sc});
  await reloadGame(pg); how=await openPicker(pg,S,'campaign'); const c3=await P(pg), st=await pg.evaluate(()=>({squads:G.squads,ls:(()=>{ try{ return Object.keys(localStorage).filter(k=>/save|ew_g/i.test(k)).slice(0,6); }catch(e){ return null; } })()}));
  const sr=await shot(pg,S.tag+' Squad saved after reload');
  C.ok(same(c3),S.tag+' Squad saved: after a page reload the Campaign picker still holds '+c3.team.join(', '),{team:c3.team,squads:st.squads,storageKeys:st.ls,shot:sr}); }

async function pickerSuite(pg,S,s){
  const run=async(name,fn)=>{ try{ await fn(); }catch(e){ C.ok(false,S.tag+' '+name+' ran to the end',String(e&&e.stack||e).slice(0,500)); try{ await shot(pg,S.tag+' '+name+' error'); }catch(_){} } };
  await run('Campaign picker',async()=>{ const how=await openPicker(pg,S,'campaign'); await titleCheck(pg,S,'campaign',how);
    await ownedByPower(pg,S); await classFilter(pg,S); await battleStates(pg,S); await pick5(pg,S); await resetComp(pg,S); await emptySlots(pg,S); });
  await run('Arena attack picker',async()=>{ const how=await openPicker(pg,S,'arena'); await titleCheck(pg,S,'arena',how); });
  await run('Vault picker',async()=>{ const how=await openPicker(pg,S,'vault'); await titleCheck(pg,S,'vault',how); await pick10(pg,S,'vault'); });
  await run('Guild raid picker',async()=>{ const how=await openPicker(pg,S,'graid'); await titleCheck(pg,S,'graid',how); await pick10(pg,S,'graid'); });
  await run('Province picker',async()=>{ const how=await openPicker(pg,S,'province'); await titleCheck(pg,S,'province',how); });
  await run('Well picker',async()=>{ const how=await openPicker(pg,S,'well'); await titleCheck(pg,S,'well',how); await wellLoan(pg,S,s); });
  await run('Hero tags',()=>heroTags(pg,S));
  await run('Squad saved',()=>squadSaved(pg,S)); }

/* ---------------------------------------------------------------- real Campaign fights */
async function stepFight(pg){ return pg.evaluate(async()=>{ const sl=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<900&&!(state==='battle'&&typeof units!=='undefined'&&units.some(u=>u.team==='ally'));i++) await sl(100);
  if(state!=='battle') return {error:'no battle (state '+state+')'};
  paused=true; let ticks=0, autoOn=false;
  for(let chunk=0;chunk<8000&&!ended&&state==='battle';chunk++){ for(let i=0;i<6&&!ended&&state==='battle';i++){ updateBattle(SIM_STEP); ticks++; }
    if(!autoOn&&ticks>=30){ window.patEgp1=()=>true; try{ document.getElementById('autoBtn').onclick(); }catch(e){} autoOn=true; await sl(300); }
    if(chunk%10===0) await sl(2); }
  const won=window._p2lastWon; paused=false;
  for(let i=0;i<900&&state!=='result';i++) await sl(100);
  for(let i=0;i<100&&!/\S/.test((document.getElementById('resultReward')||{}).textContent||'');i++) await sl(100);
  return {ticks,sim:+(ticks*SIM_STEP).toFixed(1),ended,won,state,mode:CUR&&CUR.mode,node:CUR&&CUR.node}; }); }

async function squadFor5(pg,S,keys){ await setClass(pg,S,'All'); await resetSquad(pg,S); await pickKeys(pg,S,keys); return (await P(pg)).team; }

async function resultFit(pg,S,kind){
  const node=kind==='win'?1:155, how=await openStagePicker(pg,S,'normal',node);   /* 16-5: open, not a Guardian / boss stage (no 3-a-day limit, 6 stamina) */
  const all=await P(pg), want=kind==='win'?all.cards.filter(c=>c.k!==WEAK).slice(0,5).map(c=>c.k):[WEAK];
  const missing=want.filter(k=>!all.cards.some(c=>c.k===k));
  if(!all.active||missing.length){ const s0=await shot(pg,S.tag+' Result screen fits '+kind+' picker');
    C.ok(false,S.tag+' Result screen fits '+kind+': the Campaign picker opened with the fight squad ('+want.join(', ')+')',{opened:how,active:all.active,state:await pg.evaluate(()=>state),missing,roster:all.cards.map(c=>c.k),pop:await pg.evaluate(()=>!!document.getElementById('stageRewPop')),shot:s0}); return; }
  const team=await squadFor5(pg,S,want);
  await tap(pg,S,'#startBtn'); const f=await stepFight(pg); await H.wait(1800); await prep(pg);
  /* what the player sees after the fight, in order (second cluster run, screenshot): first the Damage Done pop (#ddPop, Continue), then on a win the
     v1349 reward pop (#stageRewPop, Collect All) over the hidden result page (#result.srUnder), on a loss the result page itself (#result, CONTINUE).
     Each screen is measured while it is the one on top, then left by its own button. */
  const out=[];
  for(let step=0;step<3;step++){
    await H.wait(600); await prep(pg);
    const r=await pg.evaluate(()=>{ const dd=document.getElementById('ddPop'), pop=document.getElementById('stageRewPop'), res=document.getElementById('result');
      let name,top,card,title,go;
      if(dd){ name='Damage Done (#ddPop)'; top=dd; card=dd.querySelector('.ddCard'); title=SL.txt(dd.querySelector('.ddTitle')); go='#ddPop .ddGo'; }
      else if(pop){ name='reward pop (#stageRewPop over #result.srUnder)'; top=pop; card=pop.querySelector('.srCard'); title=SL.txt(pop.querySelector('.srTitle')); go='#stageRewPop .srGo'; }
      else if(state==='result'&&res.classList.contains('active')){ name='result page (#result)'; top=res; card=res; title=SL.txt('#resultTitle'); go='#resultBtn'; }
      else return null;
      const btns=[...top.querySelectorAll('button,.btn')].filter((b,i,a)=>SL.vis(b)&&a.indexOf(b)===i).map(b=>({id:b.id||b.className,t:SL.txt(b).slice(0,30),box:SL.R(b),on:SL.inView(b),front:SL.front(b),who:SL.whoAt(b)}));
      const inner=[...top.querySelectorAll('*')].map(e=>{ const x=SL.scrolls(e); return x&&(x.canY||x.canX)?{el:(e.id?'#'+e.id:'')+'.'+String(e.className||'').trim().split(/\s+/).join('.'),sh:x.sh,ch:x.ch,sw:x.sw,cw:x.cw}:null; }).filter(Boolean);
      return {name,go,title,card:SL.scrolls(card),cardBox:SL.R(card),cardOn:SL.inView(card,2),overlay:top===card?null:SL.scrolls(top),inner,doc:SL.scrolls(document.scrollingElement),body:SL.scrolls(document.body),btns,view:SL.V()}; });
    if(!r) break;
    const fits=x=>!x||(x.sh<=x.ch+1&&x.sw<=x.cw+1), bad=r.btns.filter(b=>!b.on||!b.front);
    const why=[]; if(!fits(r.card)) why.push('panel scrolls/clips '+r.card.sh+'/'+r.card.ch); if(!fits(r.overlay)) why.push('overlay scrolls'); if(r.inner.length) why.push(r.inner.length+' inner box(es) scroll');
    if(!fits(r.doc)||!fits(r.body)) why.push('page scrolls'); if(!r.cardOn) why.push('panel not fully on screen'); if(!r.btns.length) why.push('no button'); if(bad.length) why.push(bad.length+' button(s) off screen or covered');
    const s=await shot(pg,S.tag+' Result screen fits '+kind+' '+(step+1)+' '+r.name.split(' (')[0]);
    out.push(r.name);
    C.ok(!why.length,S.tag+' Result screen fits: '+kind+' ('+team.join(', ')+'), screen '+(step+1)+' '+r.name+' "'+r.title+'" - panel '+(r.card&&r.card.sh)+'/'+(r.card&&r.card.ch)+' px, page '+(r.doc&&r.doc.sh)+'/'+(r.doc&&r.doc.ch)+' px, '+r.btns.length+' button(s) on screen and not covered'+(why.length?' - FAILS: '+why.join('; '):''),
      {opened:how,fight:f,panel:r.card,panelBox:r.cardBox,overlay:r.overlay,innerScroll:r.inner,doc:r.doc,body:r.body,buttons:r.btns.map(b=>b.t+' '+b.box.w+'x'+b.box.h+'@'+b.box.x+','+b.box.y+(b.on?'':' OFF-SCREEN')+(b.front?'':' COVERED by '+b.who)),view:r.view,shot:s});
    const before=r.name; let left='';
    try{ const p=await tap(pg,S,r.go); left=p.how; }catch(e){ left='tap failed: '+String(e.message||e).slice(0,80); }
    await pg.waitForFunction(n=>(document.getElementById('ddPop')?'Damage Done (#ddPop)':document.getElementById('stageRewPop')?'reward pop (#stageRewPop over #result.srUnder)':(state==='result'?'result page (#result)':'none'))!==n,before,{timeout:15000}).catch(()=>{ out.push('(stayed on '+before+' after '+left+')'); });
  }
  C.ok(f.won===(kind==='win')&&out.length>=2&&!out.some(x=>/^\(stayed/.test(x))&&await pg.evaluate(()=>state!=='result'&&!document.getElementById('ddPop')&&!document.getElementById('stageRewPop')),
    S.tag+' Result screen fits: the '+(kind==='win'?'won':'lost')+' fight shows '+out.filter(x=>!/^\(/.test(x)).join(' -> ')+' and each one\'s button leads on, back to the map',{fight:f,screens:out});
  /* never leave an overlay behind for the next fight */
  await pg.evaluate(()=>{ for(const id of ['ddPop','stageRewPop']){ const p=document.getElementById(id); if(p){ const g=p.querySelector('.ddGo,.srGo'); if(g) g.click(); else p.remove(); } } }); await H.wait(1200); }

/* ---------------------------------------------------------------- loading lines (a fresh page: its first fight) */
const FIGHT_ART=/^\/assets\/(anim|models)\/|^\/assets\/img\/(battlefields|hero-cards|hero-portraits|aim|avatars|glossary|loading)\//;
async function loadingLines(pg,S){
  const reqs=[], status={};
  pg._ctx.on('request',q=>{ try{ const u=new URL(q.url()); if(u.origin.indexOf('127.0.0.1')<0) return; reqs.push({u:u.pathname+u.search,p:u.pathname,t:Date.now(),type:q.resourceType()}); }catch(e){} });
  pg._ctx.on('response',r=>{ try{ const u=new URL(r.url()); status[u.pathname+u.search]=r.status(); }catch(e){} });
  const how=await openStagePicker(pg,S,'normal',1); const all=await P(pg);
  const team=await squadFor5(pg,S,all.cards.filter(c=>c.k!==WEAK).slice(0,5).map(c=>c.k));
  await pg.evaluate(()=>{ window.__sl={start:0,p0:0,frames:[],done:false}; const L=window.__sl;
    const poll=()=>{ const now=performance.now();
      if(!L.start&&state==='battle'&&!document.getElementById('battleLoader')&&typeof units!=='undefined'&&units.length>0){ L.start=Date.now(); L.p0=now; }
      if(L.start){ L.frames.push(now); if(now-L.p0>=5000){ L.done=true; return; } }
      requestAnimationFrame(poll); }; requestAnimationFrame(poll); });
  const pressedAt=Date.now(); await tap(pg,S,'#startBtn');
  await pg.waitForFunction(()=>window.__sl&&window.__sl.done,null,{timeout:240000}).catch(()=>{});
  await H.wait(1500); await prep(pg);
  const L=await pg.evaluate(()=>({start:window.__sl.start,frames:window.__sl.frames,done:window.__sl.done,state,units:(typeof units!=='undefined'?units.length:0)}));
  const s=await shot(pg,S.tag+' Full loading screen fight running');
  const img=x=>/\.(webp|png|jpe?g|avif|gif|ktx2|basis)$/i.test(x.p);
  const before=reqs.filter(x=>img(x)&&x.t<L.start&&x.t>=pressedAt), after=reqs.filter(x=>img(x)&&L.start&&x.t>=L.start);
  const fightAfter=after.filter(x=>FIGHT_ART.test(x.p)), uiAfter=after.filter(x=>!FIGHT_ART.test(x.p));
  C.ok(L.start>0&&L.done&&fightAfter.length===0,S.tag+' Full loading screen: a real 1-1 fight ('+team.join(', ')+') - '+before.length+' images loaded behind the loading screen, '+fightAfter.length+' hero / monster / spell art requests after the battle started'+(uiAfter.length?' ('+uiAfter.length+' non-fight UI images)':''),
    {opened:how,battleStartedAfterMs:L.start?L.start-pressedAt:null,fightArtAfterStart:fightAfter.map(x=>x.u+' +'+(x.t-L.start)+'ms'),uiAfterStart:uiAfter.map(x=>x.u+' +'+(x.t-L.start)+'ms').slice(0,20),loadedBefore:before.length,shot:s});
  /* Battle start smooth: requestAnimationFrame gaps over the first 5 s */
  const gaps=[]; for(let i=1;i<L.frames.length;i++) gaps.push(L.frames[i]-L.frames[i-1]);
  const sorted=gaps.slice().sort((a,b)=>a-b), max=sorted.length?sorted[sorted.length-1]:null, p95=sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*0.95))]:null;
  const big=gaps.map((g,i)=>[g,i]).filter(([g])=>g>100).map(([g,i])=>Math.round(g)+' ms at '+Math.round(L.frames[i]-L.frames[0])+' ms');
  const vals={frames:L.frames.length,maxMs:max&&+max.toFixed(1),p95Ms:p95&&+p95.toFixed(1),medianMs:sorted.length?+sorted[Math.floor(sorted.length/2)].toFixed(1):null,gapsOver100ms:big,shot:s};
  if(!L.frames.length||max>250) C.ok(false,S.tag+' Battle start smooth: the first 5 s of the fight - longest frame gap '+(max==null?'none recorded':Math.round(max)+' ms')+' (limit 250 ms), p95 '+(p95==null?'-':Math.round(p95)+' ms'),vals);
  else C.look(S.tag+' Battle start smooth: the first 5 s of the fight - longest frame gap '+Math.round(max)+' ms (under the 250 ms limit), p95 '+Math.round(p95)+' ms, '+L.frames.length+' frames (this host renders in software - a real-phone look is the proof)',vals);
  /* Phone art tier: what this page picked and the files the fight's sheets came from */
  const t=await pg.evaluate(()=>{ const out=[];
    for(const k in BATTLE_ANIM){ const set=BATTLE_ANIM[k]; if(!set) continue; for(const st in set){ if(st[0]==='_') continue; const c=set[st]; if(!c||!c.tex||!c.u) continue;
      const pth=String(c.u).split('?')[0], T=ART_TIERS&&ART_TIERS[pth], keep=_keepsImage(c);
      out.push({k,st,u:c.u,fu:c._fu||null,keep,p:T&&T.p?{u:T.p[0],W:T.p[1],H:T.p[2]}:null,h:T&&T.h?{u:T.h[0],W:T.h[1],H:T.h[2]}:null,done:c._lq===1,err:!!c._err}); } }
    let sw=0,sh=0; try{ sw=screen.width; sh=screen.height; }catch(e){}
    return {tier:ART_TIER,override:(()=>{ try{ return localStorage.getItem('ew_art_tier'); }catch(e){ return null; } })(),screen:[sw,sh],deviceMemory:navigator.deviceMemory||null,phoneSide:ART_PHONE_SIDE,phoneMem:ART_PHONE_MEM,tiersLoaded:!!ART_TIERS&&Object.keys(ART_TIERS).length,clips:out}; });
  const tiered=t.clips.filter(c=>!c.keep&&(c.p||c.h)), wantFile=c=>t.tier==='phone'?(c.p&&c.p.u):((c.h&&c.h.u)||c.u);
  const wrong=tiered.filter(c=>c.fu!==wantFile(c)), notLoaded=tiered.filter(c=>!c.done||c.err||(c.fu&&status[c.fu]!=null&&status[c.fu]>=400)), unseen=tiered.filter(c=>c.fu&&status[c.fu]==null);
  const lighter=tiered.filter(c=>c.p&&c.h).map(c=>c.k+'/'+c.st+' '+c.p.W+'x'+c.p.H+' vs '+c.h.W+'x'+c.h.H);
  const ts=await shot(pg,S.tag+' Phone art tier');
  if(S.touch) C.ok(t.tier==='phone'&&tiered.length>0&&!wrong.length&&!notLoaded.length,
    S.tag+' Phone art tier: the page picks "'+t.tier+'" (screen '+t.screen.join('x')+', the short side <= '+t.phoneSide+' px or device memory <= '+t.phoneMem+' GB), and all '+tiered.length+' battle sheets of the fight are their phone-tier files (_p1141), loaded',
      {pick:{tier:t.tier,override:t.override,screen:t.screen,deviceMemory:t.deviceMemory},sheets:tiered.map(c=>c.k+'/'+c.st+' '+(c.fu||'').split('/').pop()+' '+(status[c.fu]||'?')),wrong:wrong.map(c=>c.k+'/'+c.st+' got '+c.fu+' want '+wantFile(c)),notLoaded:notLoaded.map(c=>c.k+'/'+c.st),notOnTheWire:unseen.length,phoneVsHigh:lighter.slice(0,12),idleWalkOriginals:t.clips.filter(c=>c.keep).length,shot:ts});
  else C.ok(tiered.length>0&&!wrong.length&&!notLoaded.length,
    S.tag+' Phone art tier: the page picks "'+t.tier+'" here (screen '+t.screen.join('x')+', device memory '+t.deviceMemory+'), and all '+tiered.length+' battle sheets are this tier\'s files, loaded'+(t.tier==='phone'?' (this host reports little memory: the phone tier)':' (not the phone files)'),
      {pick:{tier:t.tier,override:t.override,screen:t.screen,deviceMemory:t.deviceMemory},sheets:tiered.map(c=>c.k+'/'+c.st+' '+(c.fu||'').split('/').pop()+' '+(status[c.fu]||'?')),wrong:wrong.map(c=>c.k+'/'+c.st+' got '+c.fu+' want '+wantFile(c)),notLoaded:notLoaded.map(c=>c.k+'/'+c.st),shot:ts});
  /* leave the fight */
  await pg.evaluate(()=>{ try{ document.getElementById('pauseBtn').click(); }catch(e){} }); await H.wait(400);
  await pg.evaluate(()=>{ try{ document.getElementById('exitBtn').click(); }catch(e){} }); await H.wait(1500); }

/* ---------------------------------------------------------------- menus, hero window, settings */
let MENU_S=null;   /* the size of the page being driven (openMenu taps like a player there) */
async function openMenu(pg,nav){ await prep(pg); const S=MENU_S||{touch:false};
  await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} try{ show('home'); }catch(e){} }); await H.wait(900); await H.clean(pg);
  let how='MENU > '+nav;
  try{ await tap(pg,S,'#menuBtn'); await H.wait(600);
    const sel='#menuPanel .mitem[data-nav="'+nav+'"]';
    const vis=await pg.evaluate(s=>{ const el=document.querySelector(s); return !!el&&!!el.offsetParent; },sel);
    if(vis) await tap(pg,S,sel); else { how='popoutScreen('+nav+') (menu item not shown)'; await pg.evaluate(n=>{ try{ document.getElementById('hubMenu').classList.remove('open'); }catch(e){} popoutScreen(n); },nav); } }
  catch(e){ how='popoutScreen('+nav+') (menu: '+String(e.message||e).slice(0,60)+')'; await pg.evaluate(n=>popoutScreen(n),nav); }
  await H.wait(1200); await H.clean(pg);
  const act=await pg.evaluate(n=>{ const e=document.getElementById(n); return !!e&&e.classList.contains('active'); },nav);
  if(!act){ await pg.evaluate(n=>popoutScreen(n),nav); await H.wait(1000); return how+' -> FALLBACK popoutScreen('+nav+')'; }
  await prep(pg); return how; }
async function openHero(pg,S,key,tab){
  let how=await openMenu(pg,'heroesPanel');
  await pg.waitForSelector('#heroesPanel .hero-card[data-hero-key="'+key+'"]',{timeout:20000}).catch(()=>{});
  try{ await tap(pg,S,'#heroesPanel .hero-card[data-hero-key="'+key+'"]'); how+=' > '+key+' card'; }catch(e){ how+=' (no '+key+' card)'; }
  await pg.waitForFunction(k=>detailHero===k&&document.getElementById('heroDetail').classList.contains('active'),key,{timeout:15000}).catch(()=>{});
  if(!await pg.evaluate(k=>detailHero===k&&document.getElementById('heroDetail').classList.contains('active'),key)){ await pg.evaluate(k=>{ detailHero=k; popoutScreen('heroDetail'); },key); how+=' -> FALLBACK popoutScreen(heroDetail)'; }
  await H.wait(1200); await H.clean(pg); await prep(pg);
  if(tab){ const sel='#heroDetail .hd-tab[data-tab="'+tab+'"]';
    if(await pg.$(sel)){ try{ await tap(pg,S,sel); }catch(e){} }
    await pg.waitForFunction(t=>heroTab===t,tab,{timeout:10000}).catch(()=>{});
    if(!await pg.evaluate(t=>heroTab===t,tab)){ await pg.evaluate(t=>{ heroTab=t; renderHeroDetail(); },tab); how+=' -> FALLBACK heroTab='+tab; } else how+=' > '+tab+' tab';
    await H.wait(1000); await prep(pg); }
  return how; }
async function openSettings(pg,S,tab){ const how=await openMenu(pg,'settings');
  await pg.waitForSelector('#settings [data-settab="'+tab+'"]',{timeout:20000}).catch(()=>{});
  try{ await tap(pg,S,'#settings [data-settab="'+tab+'"]'); }catch(e){} await H.wait(900); await prep(pg); return how+' > '+tab+' tab'; }
async function setVoice(pg,S,on){ const how=await openSettings(pg,S,'general');
  const was=await pg.evaluate(()=>!!SND.cfg.voice.on);
  if(was!==on){ try{ await tap(pg,S,'#settings label.set-chk:has(#snd_voice_on)'); }catch(e){ await pg.evaluate(()=>document.getElementById('snd_voice_on').click()); } await H.wait(500); }
  const r=await pg.evaluate(()=>({cfg:!!SND.cfg.voice.on,box:(document.getElementById('snd_voice_on')||{}).checked}));
  return {how,was,...r}; }

/* ---------------------------------------------------------------- Lore narration */
function silentWav(sec){ const sr=8000, n=sr*sec, b=Buffer.alloc(44+n); b.write('RIFF',0); b.writeUInt32LE(36+n,4); b.write('WAVE',8); b.write('fmt ',12); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22);
  b.writeUInt32LE(sr,24); b.writeUInt32LE(sr,28); b.writeUInt16LE(1,32); b.writeUInt16LE(8,34); b.write('data',36); b.writeUInt32LE(n,40); b.fill(128,44); return b; }
async function lore(pg,S,s){
  const codec=await pg.evaluate(()=>new Audio().canPlayType('audio/mp4; codecs="mp4a.40.2"'));
  if(!codec){ const wav=silentWav(30); await pg.route(/\/assets\/audio\/voice\/lore\//,r=>r.fulfill({status:200,contentType:'audio/wav',body:wav})); console.log('  INFO   '+S.tag+' Lore narration: this Chromium cannot play .m4a (canPlayType ""): the lore file request is answered with a 30 s silent WAV under the same URL; the real file is checked below'); }
  const v=await setVoice(pg,S,true);
  for(const k of ['vael','konwu']){
    const how=await openHero(pg,S,k,'lore');
    const pre=await pg.evaluate(()=>{ const b=document.getElementById('loreBtn'); return {btn:!!b&&SL.vis(b),on:!!b&&SL.inView(b),label:b&&b.getAttribute('aria-label'),file:null}; });
    const file=await pg.evaluate(k=>LORE_AUDIO[k]||null,k);
    let real=null; if(file){ try{ const r=await fetch(s.base+'/assets/audio/'+file); const buf=Buffer.from(await r.arrayBuffer()); real={status:r.status,bytes:buf.length,type:r.headers.get('content-type')}; }catch(e){ real={error:String(e)}; } }
    if(pre.btn) await tap(pg,S,'#loreBtn'); await H.wait(1500);
    const a1=await pg.evaluate(()=>{ const a=_lore.a; window.__slLore=a; const b=document.getElementById('loreBtn'); return {key:_lore.key,src:a?a.src.replace(location.origin,''):null,paused:a?a.paused:null,t:a?+a.currentTime.toFixed(2):null,err:a&&a.error?a.error.code:null,ready:a?a.readyState:null,label:b&&b.getAttribute('aria-label'),stopWord:ewT('loreaudio.stop')}; });
    await H.wait(1200);
    const t2=await pg.evaluate(()=>window.__slLore?+window.__slLore.currentTime.toFixed(2):null);
    const sh1=await shot(pg,S.tag+' Lore narration '+k+' playing');
    C.ok(pre.btn&&pre.on&&!!real&&real.status===200&&real.bytes>10000&&a1.key===k&&a1.src&&a1.src.indexOf(k+'_lore.m4a')>=0&&a1.paused===false&&t2>a1.t&&a1.label===a1.stopWord,
      S.tag+' Lore narration: Voice ON ('+v.how+'), '+k+'\'s Lore tab ('+how+') shows the play button; a tap starts '+(a1.src||'no audio')+' (playing, time '+a1.t+' s -> '+t2+' s)',
      {voice:v,button:pre,realFile:real,audio:a1,time2:t2,codec:codec||'none (silent WAV stand-in)',shot:sh1});
    if(pre.btn) await tap(pg,S,'#loreBtn'); await H.wait(800);
    const a2=await pg.evaluate(()=>{ const b=document.getElementById('loreBtn'); return {cur:!!_lore.a,oldPaused:window.__slLore?window.__slLore.paused:null,label:b&&b.getAttribute('aria-label'),playWord:ewT('loreaudio.play')}; });
    const sh2=await shot(pg,S.tag+' Lore narration '+k+' stopped');
    C.ok(pre.btn&&!a2.cur&&a2.oldPaused===true&&a2.label===a2.playWord,S.tag+' Lore narration: a second tap on '+k+'\'s button stops the narration (audio paused and released, the button back to play)',{...a2,shot:sh2}); }
  const off=await setVoice(pg,S,false);
  for(const k of ['vael','konwu']){ const how=await openHero(pg,S,k,'lore');
    const r=await pg.evaluate(()=>({btn:!!document.getElementById('loreBtn'),tab:heroTab,lore:SL.txt('#heroDetailBody').length}));
    const sh=await shot(pg,S.tag+' Lore narration '+k+' voice off');
    C.ok(!off.cfg&&!r.btn&&r.tab==='lore'&&r.lore>100,S.tag+' Lore narration: Voice OFF ('+off.how+'), '+k+'\'s Lore tab ('+how+') shows the lore and no play button',{voice:off,...r,shot:sh}); }
  await setVoice(pg,S,true); }

/* ---------------------------------------------------------------- HD glyph icons */
const measureGlyph=(pg,roots)=>pg.evaluate(async roots=>{ const sel=roots.map(r=>r+' img').join(',');
  const isG=i=>{ const s=i.getAttribute('src')||''; return /\/glyphs-v[23]\//.test(s)||s===G2_FALLBACK; };
  let ims=[...document.querySelectorAll(sel)].filter(i=>isG(i)&&SL.vis(i));
  for(let k=0;k<100&&ims.some(i=>!i.complete);k++) await new Promise(r=>setTimeout(r,100)); await new Promise(r=>setTimeout(r,300));
  ims=[...document.querySelectorAll(sel)].filter(i=>isG(i)&&SL.vis(i));
  const rows=ims.map(i=>{ const b=i.getBoundingClientRect(), src=(i.getAttribute('src')||''), miss=src===G2_FALLBACK, ratio=(b.width>0&&b.height>0&&i.naturalWidth>0)?Math.min(i.naturalWidth/b.width,i.naturalHeight/b.height):0;
    return {src:miss?'PLACEHOLDER (missing art)':src.replace(/^.*\/glyphs-v3\//,'glyphs-v3/'),nw:i.naturalWidth,nh:i.naturalHeight,cssW:+b.width.toFixed(1),cssH:+b.height.toFixed(1),ratio:+ratio.toFixed(2),miss}; });
  const fails=rows.filter(r=>r.miss||r.ratio<2), min=rows.length?rows.reduce((a,b)=>b.ratio<a.ratio?b:a):null;
  return {dpr:devicePixelRatio,n:rows.length,kinds:{fragment:rows.filter(r=>/fragment-/.test(r.src)).length,core:rows.filter(r=>/sub-/.test(r.src)).length,glyph:rows.filter(r=>/finished-/.test(r.src)).length,placeholder:rows.filter(r=>r.miss).length},
    smallest:min,fails:fails.slice(0,30),failCount:fails.length}; },roots);
async function glyphIcons(pg,S){
  const how=await openHero(pg,S,'vael','glyphs');
  await pg.waitForFunction(()=>{ const b=document.getElementById('heroDetailBody'); return b&&!/Loading glyphs/i.test(b.textContent)&&b.querySelector('img[src*="/glyphs-v3/"]'); },null,{timeout:40000}).catch(()=>{});
  await H.wait(1500);
  const a=await measureGlyph(pg,['#heroDetailBody']); const s1=await shot(pg,S.tag+' HD glyph icons Glyphs tab');
  C.ok(a.dpr===2&&a.n>0&&a.failCount===0,S.tag+' HD glyph icons: Vael\'s Glyphs tab ('+how+') at deviceScaleFactor '+a.dpr+' - '+a.n+' glyph / core / fragment icons, smallest '+(a.smallest?a.smallest.ratio+'x ('+a.smallest.src+' '+a.smallest.nw+' px in '+a.smallest.cssW+' CSS px)':'-')+', '+a.failCount+' under 2x',a);
  /* the recipe tree a slot opens (every glyph, core and fragment the slot's glyph is made of), one level deeper into a core */
  let tree='no slot build button on the tab';
  if(await pg.$('#heroDetailBody [onclick^="g2buildOpen("]')){ await tap(pg,S,'#heroDetailBody [onclick^="g2buildOpen("]');
    await pg.waitForFunction(()=>RUNE2.build&&!RUNE2.build.loading&&RUNE2.build.data,null,{timeout:30000}).catch(()=>{}); await H.wait(1500); await prep(pg);
    tree='slot recipe tree';
    const deeper=await pg.$('#heroDetailBody [onclick*="g2TreePush("], #g2ovlHost [onclick*="g2TreePush("]');
    if(deeper){ try{ await tap(pg,S,'#heroDetailBody [onclick*="g2TreePush("], #g2ovlHost [onclick*="g2TreePush("]'); }catch(e){} }
    else await pg.evaluate(()=>{ const b=RUNE2.build, i=(b.data.root.children||[]).findIndex(c=>c.children&&c.children.length); if(i>=0) g2TreePush('r.'+i); });
    await H.wait(1500); if(await pg.evaluate(()=>!!(RUNE2.build&&RUNE2.build.stack&&RUNE2.build.stack.length))) tree+=' + a core opened ('+await pg.evaluate(()=>RUNE2.build.stack.join(' > '))+')'; }
  const b=await measureGlyph(pg,['#heroDetailBody','#g2ovlHost']); const s2=await shot(pg,S.tag+' HD glyph icons recipe tree');
  C.ok(b.dpr===2&&b.n>0&&b.failCount===0&&b.kinds.fragment>0,S.tag+' HD glyph icons: the glyph recipe tree ('+tree+') - '+b.n+' icons ('+b.kinds.glyph+' glyph, '+b.kinds.core+' core, '+b.kinds.fragment+' fragment), smallest '+(b.smallest?b.smallest.ratio+'x ('+b.smallest.src+')':'-')+', '+b.failCount+' under 2x or placeholder',b);
  await pg.evaluate(()=>{ try{ g2buildCancel(); }catch(e){} try{ RUNE2.build=null; g2RenderOverlays(); }catch(e){} }); }

/* ---------------------------------------------------------------- Summoning */
let SUMMON_TABLE_DONE=false;
async function summonCost(pg,S,s){
  const table=((await s.api('/api/hero/summon-table')).body||{}).table||{};
  if(!SUMMON_TABLE_DONE){ SUMMON_TABLE_DONE=true; const tiers={1:0,2:0,3:0}, bad=[];
    for(const k of Object.keys(table)){ const st=startStars(k); tiers[st]=(tiers[st]|0)+1; if(table[k].cost!==SUMMON_RULE[st]) bad.push(k+' '+st+'-star costs '+table[k].cost); }
    C.ok(Object.keys(table).length>0&&!bad.length&&tiers[1]>0&&tiers[2]>0&&tiers[3]>0,'Summon cost: the server table (/api/hero/summon-table) costs 10 / 30 / 80 fragments for 1 / 2 / 3-star heroes ('+tiers[1]+' / '+tiers[2]+' / '+tiers[3]+' heroes)',{tiers,bad}); }
  const how=await openMenu(pg,'heroesPanel');
  await pg.waitForFunction(()=>document.querySelectorAll('#heroesPanel .hero-card.locked').length>0,null,{timeout:20000}).catch(()=>{}); await H.wait(800);
  const cards=await pg.evaluate(()=>[...document.querySelectorAll('#heroesPanel .hero-card.locked')].map(c=>{ const t=SL.txt(c.querySelector('.hc-sub')), m=t.replace(/[,.\s ]/g,'').match(/(\d+)\/(\d+)/); return {k:c.dataset.heroKey,t,have:m?+m[1]:null,need:m?+m[2]:null,summon:/summon/i.test(t)}; }));
  const badC=cards.filter(c=>!c.summon&&(!table[c.k]||c.need!==table[c.k].cost)), per={1:0,2:0,3:0}; cards.forEach(c=>{ per[startStars(c.k)]=(per[startStars(c.k)]|0)+1; });
  const s1=await shot(pg,S.tag+' Summon cost Heroes list');
  C.ok(cards.length>0&&!badC.length&&per[1]>0&&per[2]>0&&per[3]>0,S.tag+' Summon cost: the Heroes list ('+how+') shows each of the '+cards.length+' locked heroes\' summon cost = the server table ('+per[1]+' 1-star, '+per[2]+' 2-star, '+per[3]+' 3-star)',
    {wrong:badC.map(c=>c.k+' shows "'+c.t+'" server '+(table[c.k]||{}).cost),sample:cards.slice(0,8).map(c=>c.k+' '+c.t),shot:s1});
  for(const st of [1,2,3]){ const c=cards.find(x=>startStars(x.k)===st&&!x.summon); if(!c){ C.ok(false,S.tag+' Summon cost: a locked '+st+'-star hero to open'); continue; }
    const h=await openHero(pg,S,c.k,null);
    const r=await pg.evaluate(k=>{ const bar=document.querySelector('#heroDetailBody>div:first-child'), txt=SL.txt(bar);
      return {txt,frags:heroFrag(k),cost:summonCost(k),srv:!!SUMMON_SRV,want:ewT('hero.frags_of',{n:heroFrag(k),max:summonCost(k)})}; },c.k);
    const sh=await shot(pg,S.tag+' Summon cost window '+st+'-star');
    const srvCost=(table[c.k]||{}).cost;
    C.ok(r.srv&&r.cost===SUMMON_RULE[st]&&r.cost===srvCost&&r.txt.indexOf(r.want)>=0&&r.txt.indexOf(r.cost+' →')>=0,
      S.tag+' Summon cost: the summon window of '+c.k+' ('+st+'-star, '+h+') reads "'+r.txt.slice(0,90)+'" = '+SUMMON_RULE[st]+' fragments (server '+srvCost+')',{...r,shot:sh}); } }

/* server B: the first Diamond wish (always a 2-star hero) for a player who owns every 2-star hero at 9,999 fragments */
async function fragmentCap(pg,S,s){
  const how=await H.openBuilding(pg,'wishing',S.touch);
  await pg.waitForFunction(()=>document.getElementById('wishing').classList.contains('active')&&document.getElementById('wpGem')&&!document.getElementById('wpGem').disabled,null,{timeout:40000}).catch(()=>{}); await H.wait(800);
  const btn=await pg.evaluate(()=>{ const b=document.getElementById('wpGem'); return b?{text:SL.txt(b),dis:!!b.disabled,box:SL.R(b),on:SL.inView(b),front:SL.front(b),who:SL.whoAt(b)}:null; });
  const tp=await tap(pg,S,'#wpGem'); let wishHow='Diamond Wish button ('+tp.how+')';
  await pg.waitForFunction(()=>!!document.getElementById('_wishOk'),null,{timeout:30000}).catch(()=>{});
  if(!await pg.$('#_wishOk')){ wishHow+=' -> no result after 30 s, FALLBACK button.click()'; await pg.evaluate(()=>{ const b=document.getElementById('wpGem'); if(b) b.click(); });
    await pg.waitForFunction(()=>!!document.getElementById('_wishOk'),null,{timeout:30000}).catch(()=>{}); }
  await H.wait(1500); await prep(pg);
  const card=await pg.evaluate(()=>{ const ok=document.getElementById('_wishOk'); return ok?SL.txt(ok.parentElement).slice(0,160):null; });
  const sw=await shot(pg,S.tag+' Fragment cap wish result');
  const hist=((await s.api('/api/pool/history')).body||{}).history||[], last=hist[0]||{}, res=String((last.results||[])[0]||''), hk=res.split(':')[1]||null;
  const led=(await s.api('/api/ledger')).body||{}, srv=hk?((led.frags||{})[hk]):null;
  await pg.evaluate(()=>{ const b=document.getElementById('_wishOk'); if(b) b.click(); }); await H.wait(900);
  let shown=null, pageF=null, hh='';
  if(hk){ hh=await openHero(pg,S,hk,'stats'); try{ await tap(pg,S,'#hdStars'); }catch(e){} await H.wait(1200);
    const r=await pg.evaluate(k=>{ const el=[...document.querySelectorAll('div')].filter(d=>/fragments owned/.test(d.textContent||'')&&d.querySelector('b')).pop(); return {txt:el?SL.txt(el):null,n:el?SLP.num(el.querySelector('b').textContent):null,page:heroFrag(k)}; },hk);
    shown=r.n; pageF=r.page; hh+=' > Stars panel "'+r.txt+'"'; }
  const sh=await shot(pg,S.tag+' Fragment cap Stars panel');
  C.ok(/^dupe:/.test(res)&&srv===9999&&pageF===9999&&shown===9999,
    S.tag+' Fragment cap: '+(hk||'?')+' at 9,999 fragments, a Wishing Pool duplicate ('+(res||'no wish')+', '+wishHow+', '+how+'): server '+srv+', page '+pageF+', Stars panel '+shown,
    {tap:wishHow,button:btn,wish:last,resultCard:card,server:srv,page:pageF,starsPanel:shown,opened:hh,shots:[sw,sh]}); }

/* the stage panel's Fight does not open the picker without the stamina (first cluster run: no roster, "reading 'k'"), so NEED STAMINA is the
   picker's answer when the stamina goes while it is open: server B starts with exactly one 1-1 (6), the picker is opened, that stamina is spent
   on a 1-1 sweep (the server's own sweep route, as another tab / device would), the page syncs its ledger, and the player taps a hero */
async function needStamina(pg,S,s){
  const how=await openStagePicker(pg,S,'normal',1); const a=await P(pg);
  if(!a.active||!a.cards.length){ const s0=await shot(pg,S.tag+' Battle button NEED STAMINA picker'); C.ok(false,S.tag+' Battle button states: the Campaign picker opened with stamina for one fight',{opened:how,active:a.active,cards:a.cards.length,stamina:await pg.evaluate(()=>G.stamina),shot:s0}); return; }
  await resetSquad(pg,S);
  const sw=await s.api('/api/campaign/sweep','POST',{mode:'normal',node:1,times:1,requestId:'sl1468-'+Date.now()});
  await pg.evaluate(async()=>{ try{ await ledgerSync(); }catch(e){} }); await H.wait(600);
  await tapCard(pg,S,a.cards[0].k);
  const r=await P(pg), c=await pg.evaluate(()=>({cost:stageStamCost(CUR.node,CUR.portal),have:G.stamina,max:maxStamina(),want:ewT('roster.need_stamina',{n:stageStamCost(CUR.node,CUR.portal),have:G.stamina,max:maxStamina()})}));
  const srv=((await s.api('/api/ledger')).body||{}).stamina||{}, sh=await shot(pg,S.tag+' Battle button NEED STAMINA');
  C.ok(r.team.length===1&&r.start&&r.start.dis&&r.start.text===c.want&&/^NEED \d+ STAMINA \(\d+\/\d+\)$/.test(r.start.text)&&c.have<c.cost,
    S.tag+' Battle button states: with '+c.have+' stamina (server '+srv.v+') and a hero picked the Campaign button reads "'+(r.start&&r.start.text)+'" and is disabled',{opened:how,sweep:{status:sw.status,ok:sw.body&&sw.body.ok,error:sw.body&&sw.body.error},start:r.start,...c,server:srv,shot:sh});
  await resetSquad(pg,S); }

/* ---------------------------------------------------------------- Download all art */
async function downloadArt(pg,S,s){
  const how=await openSettings(pg,S,'storage');
  await pg.waitForFunction(()=>/\d/.test((document.getElementById('alMsg')||{}).textContent||''),null,{timeout:120000}).catch(()=>{}); await H.wait(800); await prep(pg);
  const sizes=((await s.api('/api/asset-sizes')).body||{}).sizes||{};
  const card=await pg.evaluate(async()=>{ try{ await artTiersLoad(); }catch(e){} const urls=allAssetUrls(); const sec=document.getElementById('alDl')&&document.getElementById('alDl').closest('.set-sec');
    return {head:SL.txt(sec&&sec.querySelector('.set-h')),btn:SL.txt('#alDl'),btnOn:SL.inView('#alDl')&&SL.front('#alDl'),msg:SL.txt('#alMsg'),urls,tier:ART_TIER,mbOf:ewT('setx.mb_of',{a:'\u0001',b:'\u0002'})}; });
  let total=0, unknown=0; for(const u of card.urls){ let p=u; try{ p=new URL(u,'http://x').pathname; }catch(e){} if(sizes[p]==null) unknown++; total+=sizes[p]||0; }
  const fmt=b=>(b/1048576).toFixed(1)+' MB', wantTotal=fmt(total);
  /* a file's table size is its true size */
  const sample=[]; for(const u of card.urls.filter((u,i)=>i%Math.max(1,Math.floor(card.urls.length/4))===0).slice(0,4)){ try{ const r=await fetch(s.base+u), b=Buffer.from(await r.arrayBuffer()), p=new URL(u,'http://x').pathname; sample.push({file:p,table:sizes[p],real:b.length,status:r.status}); }catch(e){ sample.push({file:u,error:String(e)}); } }
  const s1=await shot(pg,S.tag+' Download all art Settings card');
  C.ok(!!card.head&&card.btnOn&&card.msg.indexOf(wantTotal)>=0&&new RegExp('\\b'+card.urls.length+'\\b').test(card.msg)&&sample.length>0&&sample.every(x=>x.status===200&&x.table===x.real),
    S.tag+' Download all art: Settings > Storage ('+how+') has "'+card.head+'" with the "'+card.btn+'" button and reads "'+card.msg+'" - '+card.urls.length+' files of this device ('+card.tier+' tier), '+wantTotal+' by the server size table; sampled files\' table size = real bytes',
    {msg:card.msg,files:card.urls.length,totalMB:wantTotal,notInTable:unknown,sample,shot:s1});
  /* Download -> the confirm shows the new files and their size -> Download -> a few files -> Stop */
  await tap(pg,S,'#alDl');
  await pg.waitForSelector('#uiCfOk',{timeout:180000}).catch(()=>{}); await H.wait(600); await prep(pg);
  const conf=await pg.evaluate(async()=>{ const ok=document.getElementById('uiCfOk'); if(!ok) return null; const plan=await assetCachePlan(), sz=await assetSetBytes(plan);
    return {text:SL.txt(ok.closest('div').parentElement),missing:plan.missing.length,library:plan.urls.length,missingMB:sz?fmtMB(sz.missing):null}; });
  const s2=await shot(pg,S.tag+' Download all art confirm');
  C.ok(!!conf&&conf.text.indexOf(String(conf.missing))>=0&&!!conf.missingMB&&conf.text.indexOf(conf.missingMB)>=0,S.tag+' Download all art: the Download question says how many files are new and their true size ("'+(conf&&conf.text.slice(0,140))+'")',{...conf,shot:s2});
  if(!conf) return;
  await tap(pg,S,'#uiCfOk');
  await pg.waitForFunction(()=>{ const m=((document.getElementById('alMsg')||{}).textContent||'').replace(/[,. ]/g,'').match(/(\d+)\s*\/\s*(\d+)/); return (m&&+m[1]>=8)||!_alRunning; },null,{timeout:180000}).catch(()=>{});
  const mid=await pg.evaluate(()=>({msg:SL.txt('#alMsg'),running:_alRunning,btn:SL.txt('#alDl'),bar:(document.getElementById('alBar')||{style:{}}).style.width}));
  if(mid.running) await tap(pg,S,'#alDl');
  await pg.waitForFunction(()=>!_alRunning,null,{timeout:180000}).catch(()=>{}); await H.wait(800);
  const end=await pg.evaluate(async sizes=>{ const urls=new Set(allAssetUrls().map(u=>new URL(u,location.origin).href)); const c=await caches.open(ASSET_CACHE_NAME), keys=await c.keys();
    const mine=keys.filter(r=>urls.has(r.url)), chk=[]; for(const r of mine.slice(0,4)){ const res=await c.match(r), b=await res.blob(), p=new URL(r.url).pathname; chk.push({file:p,cached:b.size,table:sizes[p]}); }
    return {msg:SL.txt('#alMsg'),running:_alRunning,keys:keys.length,inList:mine.length,chk}; },sizes);
  const nSaved=(()=>{ const m=end.msg.replace(/[,. ]/g,'').match(/(\d+)/); return m?+m[1]:null; })();
  const s3=await shot(pg,S.tag+' Download all art stopped');
  C.ok(!end.running&&end.inList>=Math.max(1,nSaved||1)&&end.chk.length>0&&end.chk.every(x=>x.cached===x.table),
    S.tag+' Download all art: pressed Download, then Stop after a few files ("'+mid.msg+'" -> "'+end.msg+'"): '+end.inList+' of this device\'s art files are in its art cache, each the true size',{mid,end,shot:s3}); }

/* ---------------------------------------------------------------- run */
async function gamePage(port,S,dsf2){ if(!dsf2||S.touch) return H.game(port,{w:S.w,h:S.h,touch:S.touch});
  const b=await H.browser(), orig=b.newContext; b.newContext=function(o){ return orig.call(b,Object.assign({},o,{deviceScaleFactor:2})); };
  try{ return await H.game(port,{w:S.w,h:S.h,touch:S.touch}); } finally{ b.newContext=orig; } }
async function onPage(port,S,label,fn,dsf2){ let pg=null; MENU_S=S;
  try{ pg=await gamePage(port,S,dsf2); await prep(pg); await fn(pg); }
  catch(e){ C.ok(false,S.tag+' '+label+' ran to the end',String(e&&e.stack||e).slice(0,600)); if(pg) try{ await shot(pg,S.tag+' '+label+' error'); }catch(_){} }
  if(pg){ C.ok(pg._errs.length===0,S.tag+' '+label+': no page errors',pg._errs.slice(0,3)); try{ await pg._ctx.close(); }catch(_){} }
  await H.closeBrowser(); }

function seedA(){ const NOW=Date.now(), cyc=WELLMOD.cycleOf();
  return H.seedDB(HEROES,u=>{ u.arenaDef=OWNED.slice(0,5);
    u.led.camp={cleared:160,stars:{},att:null}; for(let i=1;i<=160;i++) u.led.camp.stars[i]=3;
    u.led.portals={elite:{cleared:160,stars:{},att:null,runs:{}},veteran:{cleared:159,stars:{},att:null,runs:{}}};
    u.led.stam={v:300,ts:NOW};
    u.led.well2={run:{cycle:cyc,level:0,map:1,path:null,pos:{col:0,row:1},heroes:{},loans:[LOAN],loanUp:{},buffs:[],offer:null,resUsed:0,done:false,att:null,prizes:[],started:true},cleared:{}}; }); }
function seedB(){ const NOW=Date.now(), P2=Object.keys(HERO_BASE).filter(k=>(HERO_BASE[k].stars|0)===2), HB={}; P2.forEach(k=>HB[k]=30);
  return {P2,...H.seedDB(HB,u=>{ P2.forEach(k=>u.led.frags[k]=9999); u.led.stam={v:6,ts:NOW}; for(let i=1;i<=20;i++) u.led.camp.stars[i]=3; })}; }

(async()=>{
  /* ---- server A ---- */
  let s=null;
  try{
    const {file}=seedA(); s=await H.server(file);
    for(const k of ['phone','desktop']){ const S=H.SIZES[k];
      await onPage(s.port,S,'squad picker',pg=>pickerSuite(pg,S,s));
      await onPage(s.port,S,'loading lines',pg=>loadingLines(pg,S));
      await onPage(s.port,S,'lore, glyphs, summoning, download',async pg=>{
        const run=async(name,fn)=>{ try{ await fn(); }catch(e){ C.ok(false,S.tag+' '+name+' ran to the end',String(e&&e.stack||e).slice(0,500)); try{ await shot(pg,S.tag+' '+name+' error'); }catch(_){} } };
        await run('Lore narration',()=>lore(pg,S,s)); await run('HD glyph icons',()=>glyphIcons(pg,S)); await run('Summon cost',()=>summonCost(pg,S,s)); await run('Download all art',()=>downloadArt(pg,S,s)); },true); }
    for(const S of [H.SIZES.phone,SMALL,H.SIZES.fold])
      await onPage(s.port,S,'result screens',async pg=>{ for(const kind of ['win','loss']){ try{ await resultFit(pg,S,kind); }catch(e){ C.ok(false,S.tag+' Result screen fits '+kind+' ran to the end',String(e&&e.stack||e).slice(0,500)); } } });
  }catch(e){ C.ok(false,'server A part ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ await H.closeBrowser(); if(s) await s.stop(); s=null; }
  /* ---- server B (a fresh one per size: the first Diamond wish is a one-off) ---- */
  for(const k of ['phone','desktop']){ const S=H.SIZES[k];
    try{ const {file,P2}=seedB(); s=await H.server(file); console.log('  INFO   server B: '+P2.length+' 2-star heroes owned at 9,999 fragments, 6 stamina (one 1-1)');
      await onPage(s.port,S,'0 stamina and fragment cap',async pg=>{
        try{ await needStamina(pg,S,s); }catch(e){ C.ok(false,S.tag+' NEED STAMINA ran to the end',String(e&&e.stack||e).slice(0,500)); }
        try{ await fragmentCap(pg,S,s); }catch(e){ C.ok(false,S.tag+' Fragment cap ran to the end',String(e&&e.stack||e).slice(0,500)); } }); }
    catch(e){ C.ok(false,S.tag+' server B part ran to the end',String(e&&e.stack||e).slice(0,600)); }
    finally{ await H.closeBrowser(); if(s) await s.stop(); s=null; } }
  C.done();
})();
