'use strict';
/* Lockdown audit 25 Nov 2026, Heroes Panel (heroes-A-list-to-skills.md / heroes-B-equipment-to-squad.md FAIL rows, fixed in v1452 / v1455 /
   v1463), in a real browser on this checkout's server (temp DB), at phone 844x390 (touch) and desktop 1280x720:
   1. Skills tab of Sylthaine / Bloatus / Fritz: every caster damage number on screen = the page's own number for that skill worked out from
      the fight's Ability Power (snapAllySquad apow, = skillSheetApow, the Stats tab), and the Ability Power icon sits right before it.
   2. No emoji or text symbol in any skill line of Sylthaine, Bloatus, Fritz, Vael, Vireo, Kharos (on screen, and every slot's readout).
   3. Critical Strike preview row = the fight's crit chance (class base crit included) for Vael (Tank) and Kharos (Assassin).
   4. Summon window of a not-owned start:2 hero (Orryn on desktop, Mirelle on phone): the line names the stars the server grants (3) and
      SUMMON NOW summons him at that star count (server ledger + the Heroes list after).
   5. Glyphs tab after a real Campaign 1-1 fight (page's own start / battle / resolve, auto on): the FIRST Quick Slot tap builds all six
      slots (no "Refreshed - try again"), and the FIRST ASCEND tap on a hero with six built slots ascends.
   6. Lore tab of Morvayne: his title line shows above the paragraphs.
   One screenshot per check per size (SHOT64 lines). Every check prints what it measured. Exit 0 = all passed. Never run on PC 1. */
const fs=require('fs'), H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_heroes_1463.js', C=H.checker(TEST), shot=H.shooter(TEST);
const CASTERS=['sylthaine','bloatus','fritz'], SIX=['sylthaine','bloatus','fritz','vael','vireo','kharos'];
/* glyph heroes: Q = Quick Slot (empty board), A = Ascend (six slots built at setup) - one pair per size, a board ascends once */
const GLY={desktop:{q:'vireo',a:'grosk',summon:'orryn'},phone:{q:'kharos',a:'oakmir',summon:'mirelle'}};
const OWNED=['vael','vireo','sylthaine','bloatus','fritz','kharos','grosk','oakmir','hero61'];
const HEROES={}; OWNED.forEach(k=>HEROES[k]=60);
const AT6=['vael','sylthaine','bloatus','fritz'];   // Purple boards: all four skills unlocked, so every skill line is on screen
const press=(pg,touch,sel)=>touch?pg.tap(sel,{timeout:15000}):pg.click(sel,{timeout:15000});
const SYM=/[←-⇿☀-➿✀-➿]|\p{Extended_Pictographic}/u, ALLOW=/[→×·−]/g;   // = test_heroes_fixes_1455 section 5 (the audit's ♥ 🕳 🃏 🔇 ✚ ↺ included)

function glyphSeed(frags){ const now=Date.now(), boards={};
  for(const k of AT6) boards[k]={slots:[null,null,null,null,null,null],ascensionIndex:6,ascended:{},personalPathVersion:1};
  return {revision:1,fragments:frags||{},subGlyphs:{},finished:{},boards,audit:[],seq:1,migratedAt:now,flow2At:now}; }
function seed(frags){ return H.seedDB(HEROES,u=>{ u.team=['vael','vireo','sylthaine']; u.led.frags={orryn:200,mirelle:200}; u.led.stam={v:120,ts:Date.now()}; u.glyphs=glyphSeed(frags); }); }

/* the fragments the four glyph boards need: read from the server's own build trees on a probe copy */
async function probeFragments(){ const {file}=seed({}); const s=await H.server(file); const need={};
  try{ for(const g of Object.values(GLY)) for(const h of [g.q,g.a]) for(let i=0;i<6;i++){
      const r=(await s.api('/api/glyphs/build-tree?heroKey='+h+'&slot='+i)).body||{};
      if(!r.totals) throw new Error('build-tree '+h+' '+i+': '+JSON.stringify(r).slice(0,200));
      for(const t of r.totals) need[t.key]=(need[t.key]||0)+(t.need|0); } }
  finally{ await s.stop(); }
  for(const k of Object.keys(need)) need[k]+=20; return need; }

async function openHero(pg,S,key,tab){
  await pg.evaluate(k=>{ try{ closePopout(); }catch(e){} detailHero=k; heroTab='stats'; popoutScreen('heroDetail'); },key);
  await pg.waitForFunction(k=>detailHero===k&&document.querySelector('#heroDetail.active #heroDetailBody .hd-tab'),key,{timeout:20000}).catch(()=>{});
  await H.wait(600); await H.clean(pg);
  if(tab&&tab!=='stats'){ await press(pg,S.touch,'#heroDetailBody .hd-tab[data-tab="'+tab+'"]'); await pg.waitForFunction(t=>heroTab===t,tab,{timeout:15000}).catch(()=>{}); await H.wait(900); }
  await H.prep(pg); }

async function casterNumbers(pg,S){
  for(const k of CASTERS){ await openHero(pg,S,k,'skills');
    const r=await pg.evaluate(k=>{ const snap=snapAllySquad([k])[0], ap=Math.round(snap.apow||0), sheet=skillSheetApow(k);
      const rows=[0,1,2,3].map(i=>{ const row=document.querySelector('#heroDetailBody .skrow[data-skill="'+i+'"]'), line=row&&row.querySelector('div[style*="font-weight:600"]');
        const want=String(skillEffectStr(k,i,Math.round(snap.dmg||0),Math.round(snap.maxHp||snap.hp||1),ap)||'');
        const wantNums=[...want.matchAll(/\{i:t:apow\} (\d+(?:\.\d+)?)/g)].map(m=>+m[1]);
        const got=[]; if(line) line.querySelectorAll('img').forEach(im=>{ if(!/\/icons\/stat\/apow-/.test(im.getAttribute('src')||'')) return; let s='', n=im.nextSibling; while(n&&n.nodeType===3){ s+=n.textContent; n=n.nextSibling; } const m=s.match(/^\s*(\d+(?:\.\d+)?)/); got.push(m?+m[1]:null); });
        return {i,shown:!!line&&SL.vis(line),text:line?SL.txt(line):null,want,wantNums,gotNums:got}; });
      return {ap,sheet,unlocked:[0,1,2,3].map(i=>skillUnlocked(k,i)),rows}; },k);
    const sh=await shot(pg,S.tag+' Skills '+k+' caster numbers');
    const dmg=r.rows.filter(x=>x.i<=2);   // the audit: all three damage lines of each (Sylthaine, Bloatus, Fritz) lacked the icon
    C.ok(r.ap>0&&r.ap===r.sheet,S.tag+' '+k+': the Ability Power the readout uses (Stats tab '+r.sheet+') = the fight\'s ('+r.ap+')',{stats:r.sheet,fight:r.ap});
    C.ok(r.unlocked.every(Boolean)&&dmg.every(x=>x.shown&&x.wantNums.length>0&&x.gotNums.length===x.wantNums.length&&x.gotNums.every((n,j)=>n===x.wantNums[j])),
      S.tag+' '+k+': each damage number on lines 0-2 = the page\'s own number from the fight\'s Ability Power, with the Ability Power icon right before it',
      {rows:r.rows.map(x=>({slot:x.i,screen:x.text,iconNumbers:x.gotNums,want:x.wantNums})),shot:sh}); } }

async function noEmoji(pg,S){
  for(const k of SIX){ await openHero(pg,S,k,'skills');
    const r=await pg.evaluate(k=>{ const rows=[...document.querySelectorAll('#heroDetailBody .skrow')].map(row=>({slot:row.dataset.skill,text:SL.txt(row)}));
      const raw=[0,1,2,3].map(i=>{ try{ const tmp=document.createElement('div'); tmp.innerHTML=iconize(skillEffectStr(k,i,100,1000,skillSheetApow(k))||''); return tmp.textContent; }catch(e){ return 'ERR '+e.message; } });
      return {rows,raw}; },k);
    const bad=r.rows.filter(x=>SYM.test(x.text.replace(ALLOW,''))).map(x=>x.slot+': '+x.text).concat(r.raw.filter(x=>SYM.test(x.replace(ALLOW,''))||/^ERR/.test(x)).map(x=>'readout: '+x));
    const sh=await shot(pg,S.tag+' Skills '+k+' no emoji');
    C.ok(r.rows.length>=4&&bad.length===0,S.tag+' '+k+': no emoji or text symbol in any skill line ('+r.rows.length+' rows on screen + all 4 readouts)',{bad,lines:r.rows.map(x=>x.slot+': '+x.text.slice(0,90)),shot:sh}); } }

async function critRow(pg,S){
  for(const k of ['vael','kharos']){ await openHero(pg,S,k,'skills');
    const r=await pg.evaluate(k=>{ const row=document.querySelector('#heroDetailBody .skrow[data-skill="crit"]'), t=HERO_TYPES[k];
      const snap=snapAllySquad([k])[0], txt=row?SL.txt(row):null, m=txt&&txt.match(/(\d+)\s*%/);
      return {role:t.role,base:Math.round((CLASS_BASE_CRIT[t.role]||0)*100),shown:!!row&&SL.vis(row),text:txt,row:m?+m[1]:null,fight:Math.round((snap.glyphCrit||0)*100)}; },k);
    const sh=await shot(pg,S.tag+' Crit row '+k);
    C.ok(r.shown&&r.row!=null&&r.row===r.fight&&r.row>=r.base,S.tag+' '+k+' ('+r.role+'): the Critical Strike row shows '+r.row+'% = the fight\'s '+r.fight+'% (class base '+r.base+'% included)',{text:r.text,shot:sh}); } }

async function summon(pg,S,s,key){
  const table=((await s.api('/api/hero/summon-table')).body||{}).table||{}, grant=(table[key]||{}).stars;
  await openHero(pg,S,key,'stats');
  const r=await pg.evaluate(k=>{ const b=document.getElementById('hdSummon'), line=b&&b.nextElementSibling;
    return {btn:!!b&&SL.vis(b)&&!b.disabled,line:line?SL.txt(line):null,starIcon:!!(line&&line.querySelector('img[src*="star-filled"]')),start:HERO_TYPES[k].start,cost:summonCost(k),frags:heroFrag(k)}; },key);
  const m=r.line&&r.line.match(/ at (\d+)/), said=m?+m[1]:null;
  const sh=await shot(pg,S.tag+' Summon window '+key);
  C.ok(r.btn&&grant===3&&said===grant&&r.starIcon,S.tag+' '+key+' (HERO_TYPES start:'+r.start+'): the line under SUMMON NOW names '+said+' stars = the server grant ('+grant+')',{line:r.line,fragments:r.frags+'/'+r.cost,shot:sh});
  await press(pg,S.touch,'#hdSummon');
  await pg.waitForFunction(k=>G.unlocked&&G.unlocked[k],key,{timeout:30000}).catch(()=>{}); await H.wait(800);
  const led=(await s.api('/api/ledger')).body||{}, srvStars=((led.hero||{})[key]||{}).stars;
  await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} popoutScreen('heroesPanel'); }); await H.wait(1200); await H.prep(pg);
  const after=await pg.evaluate(k=>{ const c=document.querySelector('#heroList .hero-card[data-hero-key="'+k+'"]');
    return {owned:!!(G.unlocked&&G.unlocked[k]),pageStars:heroStars(k),card:!!c,cardOwned:!!(c&&c.querySelector('.hc-lv')),cardText:c?SL.txt(c).slice(0,60):null}; },key);
  const sh2=await shot(pg,S.tag+' Summoned '+key+' in the Heroes list');
  C.ok(after.owned&&srvStars===grant&&after.pageStars===grant&&after.card&&after.cardOwned,S.tag+' SUMMON NOW: '+key+' is summoned at '+srvStars+' stars on the server ('+after.pageStars+' on the page), as the line said ('+said+'), and sits in YOUR HEROES',{after,shot:sh2}); }

async function campaignFight(pg,S){
  const resp=pg.waitForResponse(r=>/\/api\/campaign\/resolve/.test(r.url())&&r.request().method()==='POST',{timeout:300000});
  const f=await pg.evaluate(async()=>{ const sl=ms=>new Promise(r=>setTimeout(r,ms));
    try{ closePopout(); }catch(e){} try{ show('home'); }catch(e){}
    CUR={node:1,mode:'campaign',portal:'normal'}; const ids=['vael','vireo','sylthaine'];
    const st=await api('/api/campaign/start','POST',{mode:'normal',node:1,heroIds:ids,requestId:'sl'+Date.now()});
    if(!st||!st.ok) return {error:'start: '+JSON.stringify(st).slice(0,200)};
    CUR.attemptId=st.attemptId; CUR.cwaves=(st.stage&&st.stage.waves)||null; CUR.serverSnaps=st.snaps; CUR.seed=st.seed>>>0; CUR.engine=st.engine;
    G.squads=G.squads||{}; G.squads.campaign=ids.slice(); G.team=ids.slice();
    paused=true; startBattle();
    for(let i=0;i<200&&!(state==='battle'&&units.some(u=>u.team==='ally'));i++) await sl(100);
    if(state!=='battle') return {error:'no battle (state '+state+')'};
    let ticks=0, autoOn=false;
    for(let chunk=0;chunk<6000&&!ended&&state==='battle';chunk++){
      for(let i=0;i<6&&!ended&&state==='battle';i++){ updateBattle(SIM_STEP); ticks++; }
      drawOverlay();
      if(!autoOn&&ticks>=40){ window.patEgp1=()=>true; try{ document.getElementById('autoBtn').onclick(); }catch(e){} autoOn=true; await sl(400); }
      if(chunk%5===0) await sl(4); }
    paused=false; return {ticks,simSeconds:+(ticks*SIM_STEP).toFixed(1),ended:!!ended}; });
  if(f.error) return f;
  let body=null; try{ body=await (await resp).json(); }catch(e){ return Object.assign(f,{error:'no campaign resolve reply: '+String(e.message||e).slice(0,160)}); }
  await H.wait(2500);   // the page's after-fight glyph re-read (glyphAfterFight) runs on the reply
  /* v1388 Damage Done: the game opens its damage panel (#ddPop) over the result after every fight, and a player closes it with Continue.
     Run 1126-184949 left it open and it took the taps meant for the hero window - close it as a player does. */
  await pg.waitForSelector('#ddPop .ddGo',{timeout:15000}).catch(()=>{});
  let dd='not shown';
  if(await pg.$('#ddPop .ddGo')){ await press(pg,S.touch,'#ddPop .ddGo'); await pg.waitForFunction(()=>!document.getElementById('ddPop'),null,{timeout:10000}).catch(()=>{}); dd=(await pg.$('#ddPop'))?'still open after Continue':'closed with its Continue button'; }
  console.log('  INFO   after the fight: the Damage Done panel (#ddPop) '+dd);
  if(dd==='still open after Continue') return Object.assign(f,{error:'the Damage Done panel stayed open after Continue'});
  await H.wait(600); await H.clean(pg);
  return Object.assign(f,{won:!!(body&&body.won),glyphFragments:(body&&body.reward&&body.reward.glyphFragments)||(body&&body.glyphFragments)||null}); }

async function glyphs(pg,S,s,q,a){
  const srvRev=async()=>((await s.api('/api/glyphs/state')).body||{});
  /* the page holds glyph state from before the fight (as a player who looked at Glyphs first) */
  await pg.evaluate(async()=>{ await glyphV2Sync(); }); const pageRevBefore=await pg.evaluate(()=>RUNE2.st&&RUNE2.st.revision);
  const before=await srvRev();
  const fight=await campaignFight(pg,S);
  const mid=await srvRev();
  C.ok(!fight.error&&fight.won,S.tag+' Glyphs: a real Campaign 1-1 fight ran through the page (start, battle with auto, resolve) and was won',{fight,serverRevision:before.revision+' -> '+mid.revision,pageRevisionBeforeFight:pageRevBefore});
  if(!(mid.revision>pageRevBefore)) C.look(S.tag+' Glyphs: this fight did not move the glyph revision past the page\'s copy (no glyph fragments paid?), so the first-tap checks below did not meet a stale state',{pageBefore:pageRevBefore,server:mid.revision});
  const banners=()=>pg.evaluate(()=>(window._slBanners||[]).slice());
  await pg.evaluate(()=>{ window._slBanners=[]; if(!window._slBanWrap){ window._slBanWrap=true; const o=window.bannerMsg; window.bannerMsg=function(t){ try{ window._slBanners.push(String(t).replace(/<[^>]+>/g,'')); }catch(e){} return o.apply(this,arguments); }; } });
  const calls=[]; const onResp=r=>{ const u=r.url(); if(/\/api\/glyphs\/(build-all|ascend)/.test(u)) calls.push(u.replace(/^.*\/api\/glyphs\//,'')+' '+r.status()); }; pg.on('response',onResp);
  const retry=await pg.evaluate(()=>ewT('hero.refreshed_retry'));
  try{
    /* Quick Slot */
    await openHero(pg,S,q,'glyphs');
    await pg.waitForSelector('#heroDetailBody button[onclick="g2buildAll()"]:not([disabled])',{timeout:45000}).catch(()=>{});
    const qs0=await pg.evaluate(()=>{ const b=document.querySelector('#heroDetailBody button[onclick="g2buildAll()"]'); return {btn:!!b,enabled:!!b&&!b.disabled,on:!!b&&SL.inView(b),front:!!b&&SL.front(b)}; });
    calls.length=0; await pg.evaluate(()=>{ window._slBanners=[]; });
    if(qs0.enabled){ await pg.evaluate(()=>document.querySelector('#heroDetailBody button[onclick="g2buildAll()"]').scrollIntoView({block:'center'})); await press(pg,S.touch,'#heroDetailBody button[onclick="g2buildAll()"]'); }
    await pg.waitForFunction(()=>!RUNE2.busy,null,{timeout:30000}).catch(()=>{}); await H.wait(1500);
    const qb=((await srvRev()).boards||{})[q]||{}, qFilled=(qb.slots||[]).filter(Boolean).length, qBan=await banners();
    const sh=await shot(pg,S.tag+' Glyphs Quick Slot '+q);
    C.ok(qs0.enabled&&qFilled===6&&!qBan.some(x=>x.indexOf(retry)>=0),S.tag+' Glyphs: after the fight, ONE tap on Quick Slot ('+q+') builds all six slots ('+qFilled+'/6 on the server), no "'+retry+'"',
      {button:qs0,requests:calls.slice(),banners:qBan,shot:sh});
    /* Ascend */
    await openHero(pg,S,a,'glyphs');
    await pg.waitForSelector('#heroDetailBody button[onclick="g2ascend()"]',{timeout:30000}).catch(()=>{});
    const ab0=((await srvRev()).boards||{})[a]||{};
    const as0=await pg.evaluate(()=>{ const b=document.querySelector('#heroDetailBody button[onclick="g2ascend()"]'); return {btn:!!b,enabled:!!b&&!b.disabled}; });
    calls.length=0; await pg.evaluate(()=>{ window._slBanners=[]; });
    if(as0.btn){ await pg.evaluate(()=>document.querySelector('#heroDetailBody button[onclick="g2ascend()"]').scrollIntoView({block:'center'})); await press(pg,S.touch,'#heroDetailBody button[onclick="g2ascend()"]'); }
    await pg.waitForFunction(()=>!RUNE2.busy,null,{timeout:30000}).catch(()=>{}); await H.wait(1500);
    const ab=((await srvRev()).boards||{})[a]||{}, aBan=await banners();
    const sh2=await shot(pg,S.tag+' Glyphs Ascend '+a);
    C.ok(as0.btn&&(ab0.slots||[]).filter(Boolean).length===6&&(ab0.ascensionIndex|0)===0&&(ab.ascensionIndex|0)===1&&!aBan.some(x=>x.indexOf(retry)>=0),
      S.tag+' Glyphs: ONE tap on ASCEND ('+a+', six slots built) ascends (rank '+(ab0.ascensionIndex|0)+' -> '+(ab.ascensionIndex|0)+' on the server), no "'+retry+'"',{button:as0,requests:calls.slice(),banners:aBan,shot:sh2});
  } finally{ pg.off('response',onResp); } }

async function lore(pg,S){
  await openHero(pg,S,'hero61','lore');
  const r=await pg.evaluate(()=>{ const body=document.querySelector('#heroDetailBody .hd-tabcontent'), want=langDesc((HERO_LORE.hero61||{}).title||'');
    const p=body&&body.querySelector('p'), divs=body?[...body.querySelectorAll('div')]:[];
    const t=divs.find(d=>!d.children.length&&want&&SL.txt(d).indexOf(want)>=0);
    const above=!!(t&&p&&(t.compareDocumentPosition(p)&Node.DOCUMENT_POSITION_FOLLOWING));
    return {want,title:t?SL.txt(t):null,shown:!!t&&SL.vis(t),above,paras:body?body.querySelectorAll('p').length:0,name:HERO_TYPES.hero61.name}; });
  const sh=await shot(pg,S.tag+' Lore Morvayne');
  C.ok(r.want.length>0&&r.shown&&r.above&&r.paras>=4,S.tag+' Lore: '+r.name+'\'s title line "'+r.title+'" shows above his '+r.paras+' paragraphs',{r,shot:sh}); }

(async()=>{
  let frags=null; try{ frags=await probeFragments(); }catch(e){ C.ok(false,'probe: the glyph boards\' fragment needs read from the server',String(e&&e.stack||e).slice(0,500)); C.done(); return; }
  console.log('  INFO   glyph fragments seeded for the Quick Slot / Ascend boards: '+JSON.stringify(frags));
  const {file}=seed(frags); const s=await H.server(file); let pg=null;
  try{
    /* the Ascend heroes get their six slots built through the server's own route before the page opens */
    for(const g of Object.values(GLY)){ const st=(await s.api('/api/glyphs/state')).body||{};
      const r=(await s.api('/api/glyphs/build-all','POST',{heroKey:g.a,expectedRevision:st.revision,requestId:'sl-setup-'+g.a})).body||{};
      C.ok(r.ok&&(r.built||[]).length===6,'setup: '+g.a+'\'s six glyph slots built through /api/glyphs/build-all',{built:(r.built||[]).length,error:r.error}); }
    for(const k of ['desktop','phone']){ const S=H.SIZES[k], g=GLY[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      try{ await pg.evaluate(async()=>{ await glyphV2Sync(); }); await H.prep(pg);
        await casterNumbers(pg,S);
        await noEmoji(pg,S);
        await critRow(pg,S);
        await lore(pg,S);
        await summon(pg,S,s,g.summon);
        await glyphs(pg,S,s,g.q,g.a);
      }catch(e){ C.ok(false,S.tag+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; await H.closeBrowser(); }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
