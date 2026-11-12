// v1374 AFFINITY BADGES + ENEMY CARDS (Phil 12 Nov 2026: "All hero cards need their affinities. Also campaign and vault previews that show monster
// line up when you hover or double tap the monster it should show the monsters card with their full stats for that level and affinities"; a tester
// asked how to tell an enemy's class or element before a fight).
//   A. every hero card in the Heroes list and the squad picker wears a class + an element badge; for 5 sample heroes they are the right ones
//      (class = the hero's role, element = the fight's unitElement, Aureth Light), and the badges sit inside the card's art, clear of the Lv tag
//   B. the campaign stage window (2-10, a boss stage with a wave hero) and the Vault floor show the enemy lineup; hovering a chip (mouse) and
//      double-tapping it (touch) open the enemy card; a single tap does not; the card closes on mouse leave / the X / a tap outside
//   C. the card's numbers are the fight's: every enemy of the stage, read off its card, equals the unit buildEnemyWave spawns for that wave of a
//      real BATTLE (/api/campaign/start, /api/dungeon/start-battle) - HP, attack, ability power, armour, magic resist, attack speed, crit, class, element
//   D. the card is inside the screen at 844x390 and 1440x900; no page errors
// SHOTS=<dir> also saves the screenshots. CONTROL: EW_ROOT=<a b843ce52 copy> must FAIL.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const SHOTS=process.env.SHOTS?path.resolve(process.env.SHOTS):null; if(SHOTS) fs.mkdirSync(SHOTS,{recursive:true});
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-afc1374-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
const shot=async(page,name)=>{ if(SHOTS) await page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{}); };
async function boot(){ const port=await freePort(),base='http://127.0.0.1:'+port;
  const env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',SIM_WORKERS:'0'};
  const up=async()=>{for(let i=0;i<300;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
  const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
  const reg=await J('/api/register',{name:'af'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); child.kill(); await delay(900);
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
  await J('/api/admin/led-grant',{px:99000000,gold:1000000},L.token);
  try{browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});}catch(_){browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], channel:'chrome',args:['--disable-audio-output']});}
  const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
  for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
  await delay(900);
  await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); if(typeof ledgerSync==='function') await ledgerSync(); },L);
  await delay(500); return {page,errs,base}; }
const finish=(name)=>{ console.log(name+': '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1; };
const cleanup=async()=>{ if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} };
const SAMPLE=['aureth','sylthaine','fritz','umbris','maren'];   // Light Mage-ish, Ice, Lightning, Dark, Water - checked against HERO_TYPES.role / AFF_ELEMENT
/* the badges of every card in a grid: present, right class + element, inside the art, clear of the Lv tag */
const readBadges=(page,sel,lvSel)=>page.evaluate(([sel,lvSel])=>{ const out=[];
  document.querySelectorAll(sel).forEach(card=>{ const key=card.dataset.heroKey||card.dataset.k||null; const w=card.querySelector('.afbW');
    const imgs=w?[...w.querySelectorAll('img')].map(i=>i.getAttribute('src')):[];
    const art=card.querySelector('.hc-imgwrap,.rsImg'), lv=lvSel?card.querySelector(lvSel):null;
    const wr=w&&w.getBoundingClientRect(), ar=art&&art.getBoundingClientRect(), lr=lv&&lv.getBoundingClientRect();
    /* v1374 (Phil 12 Nov: "Instead put the power then the affinities under it"): on the Heroes list the pair sits under the power line, inside the card, and no class word */
    const sub=card.querySelector('.hc-sub'), sr=sub&&sub.getBoundingClientRect(), cr=card.getBoundingClientRect();
    const inside=w&&w.classList.contains('afbRow') ? !!(sr&&wr.width>6&&wr.top>=sr.bottom-1&&wr.bottom<=cr.bottom+0.5&&wr.left>=cr.left&&wr.right<=cr.right&&!card.querySelector('.hc-role'))
      : !!(wr&&ar&&wr.width>6&&wr.left>=ar.left-0.5&&wr.right<=ar.right+0.5&&wr.top>=ar.top-0.5&&wr.bottom<=ar.bottom+0.5);
    const clearLv=!lr||!wr||(wr.right<=lr.left||wr.left>=lr.right||wr.bottom<=lr.top||wr.top>=lr.bottom);
    out.push({key,cls:w&&w.dataset.afbClass,elem:w&&w.dataset.afbElem,imgs,inside,clearLv,w:wr?Math.round(wr.width):0}); }); return out; },[sel,lvSel]);
async function checkGrid(page,label,rows,nameKey){
  ok(rows.length>=10, label+': '+rows.length+' hero cards');
  ok(rows.length&&rows.every(r=>r.imgs.length===2), label+': every card has 2 badges ('+rows.filter(r=>r.imgs.length!==2).length+' without)');
  ok(rows.length&&rows.every(r=>r.inside&&r.clearLv), label+': every badge pair inside the art and clear of the Lv tag ('+rows.filter(r=>!(r.inside&&r.clearLv)).map(r=>r.key).slice(0,5).join(',')+')');
  const truth=await page.evaluate(ks=>ks.map(k=>({k,role:HERO_TYPES[k].role,elem:k==='aureth'?'Light':(AFF_ELEMENT[k]||'Neutral')})),SAMPLE);
  for(const t of truth){ const r=rows.find(x=>x.key===t.k);
    ok(!!r&&r.cls===t.role&&r.elem===t.elem&&r.imgs[0].includes('class-'+t.role.toLowerCase()+'-v1')&&r.imgs[1].includes('elem-'+t.elem.toLowerCase()+'-v1'),
      label+': '+t.k+' shows '+t.role+' + '+t.elem+' ('+(r?r.cls+' + '+r.elem+' '+r.imgs.map(s=>s.split('/').pop()).join(' '):'no card')+')'); } }
/* the card for a chip as the page opens it, plus its placement */
const cardRead=(page)=>page.evaluate(()=>{ const c=document.querySelector('#mcLayer .mcCard'); if(!c) return null; const r=c.getBoundingClientRect(); const num=s=>+String(s).replace(/[^0-9.]/g,'');
  const stats={}; c.querySelectorAll('.mcStats>div').forEach(d=>{ const k=d.dataset.st; const b=d.querySelector('b'); stats[k]=num((b.firstChild&&b.firstChild.nodeType===3)?b.firstChild.textContent:b.textContent); });
  return { name:c.querySelector('.mcName').textContent, sub:c.querySelector('.mcSub').textContent, cls:c.querySelector('[data-mc-class]').dataset.mcClass, elem:c.querySelector('[data-mc-elem]').dataset.mcElem,
    clsImg:!!c.querySelector('[data-mc-class] img'), elemImg:!!c.querySelector('[data-mc-elem] img'), stats, abil:c.querySelectorAll('.mcAb').length,
    box:{l:r.left,t:r.top,r:r.right,b:r.bottom}, vw:innerWidth, vh:innerHeight }; });
const inScreen=c=>!!c&&c.box.l>=0&&c.box.t>=0&&c.box.r<=c.vw+0.5&&c.box.b<=c.vh+0.5;
/* the fight's unit -> the numbers the card prints */
const unitNums=`(u)=>{ const mm=(u.t&&u.t.monster)?monScaleMode(u):null, ap=(mm==='ap'&&!(u.t.apow>0))?monSkillStat(u):(u.apow||0);
  return { key:u.key, hp:Math.round(u.maxHp), atk:Math.round(u.dmg), ap:Math.round(ap), armor:Math.round(u.armorRating||0), mr:Math.round(u.mrRating||0), aps:+(1/Math.max(0.05,u.atkInterval)).toFixed(2), crit:Math.round((u.glyphCrit||0)*100), cls:unitClass(u), elem:unitElement(u), level:u.level }; }`;
function sameNums(card,u){ const s=card.stats; return s.hp===u.hp&&s.atk===u.atk&&(u.ap>0?s.apow===u.ap:s.apow===undefined)&&s.armor===u.armor&&s.mr===u.mr&&s.atkSpd===u.aps&&s.crit===u.crit&&card.cls===u.cls&&card.elem===u.elem&&card.sub.includes(String(u.level)); }
(async()=>{ try{
  const {page,errs}=await boot();
  const hasBadges=await page.evaluate(()=>typeof affBadgesHTML==='function');
  ok(hasBadges,'the game has the affinity badges (affBadgesHTML)');
  await page.evaluate(async()=>{ const ks=Object.keys(HERO_TYPES); await api('/api/admin/led-grant','POST',{unlock:ks,campCleared:45,stamina:300}); if(typeof ledgerSync==='function') await ledgerSync(); });
  await delay(600);
  for(const [nm,w,h] of [['phone',844,390],['pc',1440,900]]){ await page.setViewportSize({width:w,height:h}); await delay(500);
    /* A1. Heroes list */
    await page.evaluate(()=>{ show('home'); popoutScreen('heroesPanel'); }); await delay(1200);
    await checkGrid(page,nm+' Heroes list',await readBadges(page,'#heroList .hero-card','.hc-lv'));
    await shot(page,'heroes-list-'+nm);
    /* hero window: the portrait carries the badges and the stats say the element */
    await page.evaluate(()=>{ detailHero='umbris'; heroTab='stats'; popoutScreen('heroDetail'); }); await delay(900);
    const hd=await page.evaluate(()=>{ const w=document.querySelector('#hdPortrait .afbW'); return w?{c:w.dataset.afbClass,e:w.dataset.afbElem}:null; });
    ok(!!hd&&hd.e==='Dark', nm+' hero window: Umbris portrait shows '+(hd?hd.c+' + '+hd.e:'no badges'));
    await shot(page,'hero-window-'+nm);
    await page.evaluate(()=>{ try{ closePopout&&closePopout(); }catch(e){} show('home'); }); await delay(400);
    /* A2. squad picker (the campaign team screen) */
    await page.evaluate(()=>{ CUR={node:12,mode:'campaign',portal:'normal',opp:null}; teamCtx='campaign'; rosterClassF='All'; show('menu'); }); await delay(1200);
    await page.evaluate(()=>{ const sq=squadFor(squadModeKey()); sq.length=0; ['aureth','sylthaine','fritz','umbris','maren'].forEach(k=>sq.push(k)); reRenderRoster(); }); await delay(700);
    await checkGrid(page,nm+' squad picker',await readBadges(page,'#roster .hero-card','.rsLv'));
    const slots=await page.evaluate(()=>[...document.querySelectorAll('#rosterSlots .rsSlot.full .afbW')].length);
    ok(slots===5, nm+' squad picker: the 5 picked slots wear badges ('+slots+')');
    await shot(page,'squad-picker-'+nm);
  }
  /* B + C. the campaign stage window, 2-10 */
  for(const [nm,w,h] of [['phone',844,390],['pc',1440,900]]){ await page.setViewportSize({width:w,height:h}); await page.waitForFunction(([w,h])=>document.body.offsetWidth===w&&document.body.offsetHeight===h,[w,h],{timeout:8000}).catch(()=>{}); await delay(600);   /* a big resize lands after the game's 4 s size hold (fold-viewport.js) */
    await page.evaluate(()=>{ show('campaign'); }); await delay(900);
    await page.evaluate(()=>openStageModal(20,'normal'));
    await page.waitForFunction(()=>document.querySelectorAll('#stageModal [data-mc]').length>0,null,{timeout:20000}).catch(()=>{});
    await delay(800);
    const chips=await page.evaluate(()=>[...document.querySelectorAll('#stageModal [data-mc]')].length);
    ok(chips>=5, nm+' stage 2-10: the lineup chips carry their enemy ('+chips+')');
    if(!chips) continue;
    /* hover */
    const box=await page.evaluate(()=>{ const c=document.querySelector('#stageModal .smWave:last-child [data-mc]'); c.scrollIntoView({block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    await page.mouse.move(box.x,box.y); await delay(500);
    let card=await cardRead(page);
    ok(!!card, nm+' stage 2-10: hovering a monster opens its card');
    ok(inScreen(card), nm+' stage 2-10: the card is inside the screen ('+(card?JSON.stringify(card.box):'')+' in '+w+'x'+h+')');
    ok(!!card&&card.clsImg&&card.elemImg&&!!card.cls&&!!card.elem, nm+' stage 2-10: the card shows class + element badges and words ('+(card?card.cls+' / '+card.elem:'')+')');
    await shot(page,'stage-card-hover-'+nm);
    await page.mouse.move(2,h-2); await delay(500);
    ok(!(await cardRead(page)), nm+' stage 2-10: the card closes when the mouse leaves');
    /* a single tap does nothing; a double tap opens it; a tap outside closes it */
    await page.touchscreen.tap(box.x,box.y); await delay(700);
    ok(!(await cardRead(page)), nm+' stage 2-10: a single tap does not open the card');
    await page.touchscreen.tap(box.x,box.y); await delay(150); await page.touchscreen.tap(box.x,box.y); await delay(600);
    card=await cardRead(page);
    ok(!!card&&inScreen(card), nm+' stage 2-10: a double tap opens the card inside the screen');
    await shot(page,'stage-card-tap-'+nm);
    await page.touchscreen.tap(4,4); await delay(500);
    ok(!(await cardRead(page)), nm+' stage 2-10: a tap outside closes the card');
    /* the X closes it */
    await page.touchscreen.tap(box.x,box.y); await delay(150); await page.touchscreen.tap(box.x,box.y); await delay(500);
    await page.evaluate(()=>{ const x=document.querySelector('#mcLayer .mcX'); if(x) x.click(); }); await delay(300);
    ok(!(await cardRead(page)), nm+' stage 2-10: the X closes the card');
  }
  /* C. every enemy of 2-10 on its card = the unit the real fight spawns for its wave */
  await page.setViewportSize({width:1440,height:900}); await delay(300);
  const campCards=await page.evaluate(async()=>{ const out=[]; for(const c of document.querySelectorAll('#stageModal [data-mc]')){ c.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
      await new Promise(r=>setTimeout(r,60)); const card=document.querySelector('#mcLayer .mcCard'); const wave=[...document.querySelectorAll('#stageModal .smWave')].indexOf(c.closest('.smWave'));
      out.push({wave,html:card?card.outerHTML:''}); mcardClose(); } return out; });
  await page.evaluate(()=>{ try{ closeStageModal(); }catch(e){} document.getElementById('stageModal').classList.remove('active'); });
  /* B + C. the Vault floor (a boss floor: 10) */
  await page.evaluate(async()=>{ await api('/api/dungeon/dev-floor','POST',{floor:10,requestId:uid8()}); VAULT.st=null; }); await delay(300);
  for(const [nm,w,h] of [['phone',844,390],['pc',1440,900]]){ await page.setViewportSize({width:w,height:h}); await page.waitForFunction(([w,h])=>document.body.offsetWidth===w&&document.body.offsetHeight===h,[w,h],{timeout:8000}).catch(()=>{}); await delay(600);   /* a big resize lands after the game's 4 s size hold (fold-viewport.js) */
    await page.evaluate(()=>{ VAULT.st=null; show('dungeon'); }); await delay(2200);
    const chips=await page.evaluate(()=>[...document.querySelectorAll('#dungeon [data-mc]')].length);
    ok(chips>=4, nm+' Vault floor 10: the floor shows its enemy lineup ('+chips+' chips)');
    if(!chips){ await shot(page,'vault-'+nm); continue; }
    const box=await page.evaluate(()=>{ const all=[...document.querySelectorAll('#dungeon [data-mc]')]; const c=all[all.length-1]; c.scrollIntoView({block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    await page.mouse.move(box.x,box.y); await delay(500);
    let card=await cardRead(page);
    ok(!!card&&inScreen(card), nm+' Vault floor 10: hovering an enemy opens its card inside the screen ('+(card?JSON.stringify(card.box):'none')+')');
    await shot(page,'vault-card-hover-'+nm);
    await page.mouse.move(2,h-2); await delay(500);
    ok(!(await cardRead(page)), nm+' Vault floor 10: the card closes when the mouse leaves');
    await page.touchscreen.tap(box.x,box.y); await delay(150); await page.touchscreen.tap(box.x,box.y); await delay(600);
    card=await cardRead(page);
    ok(!!card&&inScreen(card), nm+' Vault floor 10: a double tap opens the card inside the screen');
    await shot(page,'vault-card-tap-'+nm);
    await page.touchscreen.tap(4,h-4); await delay(500);
    ok(!(await cardRead(page)), nm+' Vault floor 10: a tap outside closes the card');
  }
  const vCards=await page.evaluate(async()=>{ const out=[]; for(const c of document.querySelectorAll('#dungeon [data-mc]')){ c.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); await new Promise(r=>setTimeout(r,60));
        const card=document.querySelector('#mcLayer .mcCard'); const wave=[...document.querySelectorAll('#dungeon .smWave')].indexOf(c.closest('.smWave')); out.push({wave,html:card?card.outerHTML:''}); mcardClose(); } return out; });
  /* C. (after the Vault screens: a fight holds the game's size, so the screens are driven first) */
  /* a real BATTLE on 2-10, then every wave built by buildEnemyWave from the server's own waves */
  await page.evaluate(()=>{ CUR={node:20,mode:'campaign',portal:'normal',opp:null}; teamCtx='campaign'; G.stamina=999; show('menu'); }); await delay(900);
  await page.evaluate(()=>document.getElementById('startBtn').click());
  await page.waitForFunction(()=>state==='battle'&&units.some(u=>u.team==='enemy'),null,{timeout:60000}).catch(()=>{});
  const fight=await page.evaluate(`(()=>{ const N=${unitNums}; const W=[]; const keep=units.slice(); const n=(CUR.cwaves||[]).length;
    for(let w=0;w<n;w++){ const before=units.length; const wi=waveIdx; waveIdx=w; buildEnemyWave(); W.push(units.slice(before).map(N)); waveIdx=wi; }
    return {waves:W, mode:CUR.mode}; })()`);
  ok(fight.waves.length===3, 'stage 2-10 BATTLE: the server sent 3 waves ('+fight.waves.length+')');
  { let matched=0, tried=0; const bad=[];
    for(const cc of campCards){ tried++;
      const read=await page.evaluate(h=>{ const host=document.createElement('div'); host.id='mcProbe'; host.innerHTML=h; document.body.appendChild(host); const c=host.firstElementChild; const num=s=>+String(s).replace(/[^0-9.]/g,''); const stats={};
        c.querySelectorAll('.mcStats>div').forEach(d=>{ const k=d.dataset.st; const b=d.querySelector('b'); stats[k]=num((b.firstChild&&b.firstChild.nodeType===3)?b.firstChild.textContent:b.textContent); });
        const o={ name:c.querySelector('.mcName').textContent, sub:c.querySelector('.mcSub').textContent, cls:c.querySelector('[data-mc-class]').dataset.mcClass, elem:c.querySelector('[data-mc-elem]').dataset.mcElem, stats }; host.remove(); return o; },cc.html);
      const pool=fight.waves[cc.wave]||[]; const u=pool.find(x=>sameNums(read,x));
      if(u) matched++; else bad.push(read.name+' w'+(cc.wave+1)+' '+JSON.stringify(read.stats)+' vs '+JSON.stringify(pool.map(x=>[x.key,x.hp,x.atk,x.armor,x.mr])));
    }
    ok(tried>=8&&matched===tried, 'stage 2-10: every enemy card ('+matched+'/'+tried+', boss + wave hero included) = the unit the fight spawns'+(bad.length?' - '+bad.slice(0,2).join(' | '):'')); }
  const hasBoss=fight.waves.flat().length&&campCards.length; ok(!!hasBoss,'stage 2-10: the lineup reached the fight');
  await page.evaluate(()=>{ try{ ended=true; }catch(e){} try{ cancelResult(); }catch(e){} show('home'); }); await delay(800);

  { await page.evaluate(()=>{ VAULT.st=null; show('dungeon'); }); await delay(2000);
    /* a real Vault BATTLE on floor 10 */
    const started=await page.evaluate(async()=>{ const sq=squadFor('vault'); sq.length=0; Object.keys(HERO_TYPES).filter(k=>G.unlocked[k]).slice(0,5).forEach(k=>sq.push(k)); await vaultLaunch(); return CUR&&CUR.mode==='vault'&&(CUR.vwaves||[]).length; });
    await page.waitForFunction(()=>state==='battle'&&units.some(u=>u.team==='enemy'),null,{timeout:60000}).catch(()=>{});
    const vf=await page.evaluate(`(()=>{ const N=${unitNums}; const W=[]; const n=(CUR.vwaves||[]).length;
      for(let w=0;w<n;w++){ const before=units.length; const wi=waveIdx; waveIdx=w; buildEnemyWave(); W.push(units.slice(before).map(N)); waveIdx=wi; } return W; })()`).catch(()=>[]);
    ok(started===2&&vf.length===2, 'Vault floor 10 BATTLE: the server sent 2 waves ('+vf.length+')');
    let matched=0; const bad=[];
    for(const cc of vCards){ const read=await page.evaluate(h=>{ const host=document.createElement('div'); host.innerHTML=h; document.body.appendChild(host); const c=host.firstElementChild; const num=s=>+String(s).replace(/[^0-9.]/g,''); const stats={};
        c.querySelectorAll('.mcStats>div').forEach(d=>{ const k=d.dataset.st; const b=d.querySelector('b'); stats[k]=num((b.firstChild&&b.firstChild.nodeType===3)?b.firstChild.textContent:b.textContent); });
        const o={ name:c.querySelector('.mcName').textContent, sub:c.querySelector('.mcSub').textContent, cls:c.querySelector('[data-mc-class]').dataset.mcClass, elem:c.querySelector('[data-mc-elem]').dataset.mcElem, stats, boss:/kind_boss|Boss/.test(c.querySelector('.mcSub').textContent) }; host.remove(); return o; },cc.html);
      const u=(vf[cc.wave]||[]).find(x=>sameNums(read,x)); if(u) matched++; else bad.push(read.name+' '+JSON.stringify(read.stats)); }
    ok(vCards.length>=5&&matched===vCards.length, 'Vault floor 10: every enemy card ('+matched+'/'+vCards.length+', the boss included) = the unit the fight spawns'+(bad.length?' - '+bad.slice(0,2).join(' | '):''));
    await page.evaluate(()=>{ try{ ended=true; }catch(e){} try{ cancelResult(); }catch(e){} show('home'); }); }
  ok(errs.length===0,'no page errors ('+errs.slice(0,3).join(' | ')+')');
}catch(e){ console.error(e); fails++; } finally { finish('affinity cards'); await cleanup(); } })();
