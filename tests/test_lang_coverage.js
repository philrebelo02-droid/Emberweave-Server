// LANGUAGES step 2 - FINISH CHECK 1 (Phil 4 Nov 2026: "I need everything thats translatable to be translated").
// The game runs in the dev pseudo-language qps (/play?lang=qps): t() wraps every text in ⟦…⟧ and langDesc() wraps every content text it
// knows. A crawler on a well-stocked guest opens every hub screen and building, every tab it can find in each, the Heroes panel and a
// hero's detail tabs, Settings tabs, mail, quests, a campaign battle (HUD) and its result, and lists every visible line with letters
// that is not inside ⟦…⟧ and is not an in-game proper name (heroes, monsters, skills, items, places - Phil's rule) or the player's own
// name. Finish line: 0 leaks. Leaks are written to tools/lang/coverage_leaks.json (text -> screens) for the next pass.
// Usage: node tests/test_lang_coverage.js [--keep]   (exit 1 when any leak is found)
'use strict';
const fs=require('fs'),path=require('path');
const H=require('../tools/lang/harness.js');
const ROOT=path.join(__dirname,'..');
(async()=>{
  // ---- a guest with most of the game open (heroes, gold, levels) so the deep tabs have content ----
  const S=await H.startServer();
  const guest=await (await fetch(S.base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:'lang-cov-'+Date.now()})})).json();
  await fetch(S.base+'/api/ledger',{headers:{'x-token':guest.token}});
  S.srv.kill(); await (async(c)=>{ for(let i=0;i<400&&c.exitCode===null&&c.signalCode===null;i++){ if(i===200) try{ c.kill('SIGKILL'); }catch(_){} await new Promise(r=>setTimeout(r,50)); } if(c.exitCode===null&&c.signalCode===null) throw new Error('server pid '+c.pid+' did not exit within 20 s (SIGKILL sent at 10 s) - stopping the test here, no DB edit or restart'); })(S.srv);   /* 11 Nov: until it has exited (the port is free); 12 Nov: throws if it never does */
  { const dbFile=path.join(S.tmp,'db.json'), db=JSON.parse(fs.readFileSync(dbFile,'utf8')), u=db.users[guest.profile.id];
    const bases=require('../server/sim.js').HERO_BASE; u.led=u.led||{}; u.led.unlocked=u.led.unlocked||{};
    for(const k of Object.keys(bases).slice(0,30)) u.led.unlocked[k]=true;
    u.led.px=99000000; u.led.gold=(u.led.gold|0)+5e6; u.led.gems=(u.led.gems|0)+50000;
    u.led.pool={goldUsedDay:'',goldFree:0,goldLast:0,gemFreeDay:'',gemFirstDone:false,pity:0,history:[
      {t:Date.now(),pool:'gold',n:1,cost:0,results:['gold']},
      {t:Date.now(),pool:'gem',n:1,cost:0,results:['frags:vael']},
      {t:Date.now(),pool:'myth',n:1,cost:0,results:['prayer']}
    ]};
    fs.writeFileSync(dbFile,JSON.stringify(db)); }
  const h=await (async()=>{ // restart on the same DB, then the page
    const cp=require('child_process'); const port=+S.base.split(':').pop(); const log=fs.openSync(path.join(S.tmp,'srv2.log'),'a');
    const srv=cp.spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:path.join(S.tmp,'db.json'),RL_MUL:'1000',SIM_WORKERS:'0',ALLOW_NEW_GUESTS:'1'},stdio:['ignore',log,log],windowsHide:true});
    for (const _t0 = Date.now(); Date.now() - _t0 < 60000 && !(srv && srv.exitCode !== null); ){ try{ if((await fetch(S.base+'/api/health')).ok) break; }catch(_){} await H.delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count (was 300 tries) */
    const { chromium }=require(path.join(ROOT,'node_modules','playwright'));
    const browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});
    const ctx=await browser.newContext({viewport:{width:900,height:420}});
    await ctx.addInitScript(([tok,gid,nm])=>{ localStorage.setItem('ew_acc',JSON.stringify({token:tok,id:gid,name:nm,guest:true})); localStorage.setItem('ew_guest_step_'+gid,'1'); },[guest.token,guest.profile.id,guest.profile.name]);
    const page=await ctx.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
    await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    await page.goto(S.base+'/play?lang=qps',{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>typeof show==='function'&&LANG.cur==='qps',null,{timeout:120000});
    return {page,browser,srv,errors,close:async()=>{ try{ await browser.close(); }catch(_){} try{ srv.kill(); }catch(_){} }}; })();
  const page=h.page; const leaks={}; let stops=0;
  const settle=ms=>page.waitForTimeout(ms||450);
  try{
    await settle(2500);
    await page.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await settle(900);
    await page.evaluate(()=>{ const s=document.getElementById('tutSkip'); if(s&&s.offsetParent) s.click(); });
    await page.waitForFunction(()=>LANG.cur==='qps'&&LANG.content&&Object.keys(LANG.content).length>0,null,{timeout:30000});
    // Exercise actual packs and DOM updates before the pseudo-language screen crawl.
    const realLocales=await page.evaluate(()=>EW_LANGS.map(([code])=>code).filter(code=>code!=='en'));
    const latestNote=JSON.parse(fs.readFileSync(path.join(ROOT,'patchnotes.json'),'utf8')).patches[0];
    for(const locale of realLocales){
      const ui=JSON.parse(fs.readFileSync(path.join(ROOT,'lang',locale+'.json'),'utf8'));
      const content=JSON.parse(fs.readFileSync(path.join(ROOT,'lang',locale+'.content.json'),'utf8'));
      const talents=JSON.parse(fs.readFileSync(path.join(ROOT,'lang',locale+'.talents.json'),'utf8'));
      const contentKey='Broadside';
      const [talentId,[talentName,talentText]]=Object.entries(talents.vael)[0];
      const loaded=await page.evaluate(code=>langLoad(code,true),locale);
      if(!loaded) throw new Error('Could not load UI translation pack '+locale);
      await page.evaluate(()=>talentLangLoad());
      const expected={locale,contentKey,contentText:content[contentKey],back:ui['common.back'],resume:ui['hud.resume'],talentId,talentName,talentText};
      await page.waitForFunction(x=>
        document.documentElement.lang===x.locale &&
        document.getElementById('menuBack')?.getAttribute('aria-label')===x.back &&
        document.querySelector('#resumeBtn [data-i18n="hud.resume"]')?.textContent===x.resume &&
        !!x.contentText && langDesc(x.contentKey)===x.contentText &&
        TAL_LANG.code===x.locale &&
        talentTr('vael',x.talentId,0,'')===x.talentName &&
        talentTr('vael',x.talentId,1,'')===x.talentText,
      expected,{timeout:15000});
      await page.evaluate(()=>show('settings'));
      await page.locator('#settings [data-settab="general"]').click({timeout:10000});
      const graphicsKeys=await page.evaluate(()=>GRAPHICS_ORDER.map(preset=>'set.graphics_'+preset));
      const slider=page.locator('#setGraphicsSel');
      await slider.waitFor({state:'visible',timeout:10000});
      const presetLabel=ui[graphicsKeys[Number(await slider.inputValue())]];
      if(!presetLabel || await slider.getAttribute('aria-valuetext')!==presetLabel){
        throw new Error('Graphics setting did not expose its translated value in '+locale);
      }
      await page.locator('#settings [data-settab="support"]').click({timeout:10000});
      await page.locator('#setPatchNotes').click({timeout:10000});
      const note=page.locator('#patchNotesOv ul').first();
      await note.waitFor({state:'visible',timeout:10000});
      const paragraphs=await note.locator('li').allTextContents();
      const translated=await page.evaluate(items=>items.map(item=>langDesc(item)),latestNote.items);
      if(translated.some((item,i)=>!item||item===latestNote.items[i]) ||
         JSON.stringify(paragraphs)!==JSON.stringify(translated)){
        throw new Error('Latest patch note '+latestNote.ver+' did not render fully translated in '+locale);
      }
      await page.locator('#_pnOk').click({timeout:10000});
      await page.evaluate(()=>show('wishing'));
      await page.locator('#wishing.active .wpsHelp').click({timeout:10000});
      await page.locator('#wishInfoHist').click({timeout:10000});
      const history=page.locator('#wishHistRows');
      await history.waitFor({state:'visible',timeout:10000});
      const historyText=await history.textContent();
      for(const key of ['wish.gold_pool','wish.diamond_pool','wish.mythical_pool','wish.prayer']){
        if(!ui[key]||!historyText.includes(ui[key])) throw new Error('Missing wish history label '+key+' in '+locale);
      }
      await page.locator('#wishInfoX').click({timeout:10000});
      await page.evaluate(()=>show('home'));
      console.log('locale smoke: '+locale+' UI, content, talents and patch notes loaded');
    }
    // Switch languages with each market already open to exercise its live redraw path.
    for(const screen of ['market','shadymarket']){
      await page.evaluate(screen=>show(screen),screen);
      await page.locator('#'+screen+'.active .merc-wallet').waitFor({state:'visible',timeout:10000});
      for(const locale of realLocales){
        const ui=JSON.parse(fs.readFileSync(path.join(ROOT,'lang',locale+'.json'),'utf8'));
        if(!await page.evaluate(code=>langLoad(code,true),locale)) throw new Error('Could not switch '+screen+' to '+locale);
        const expected={screen,locale,diamondsOnly:ui['shady.diamonds_only'],warChest:ui['shady.war_chest']};
        await page.waitForFunction(x=>{
          const root=document.querySelector('#'+x.screen+'.active');
          const wallet=root?.querySelector('.merc-wallet');
          if(!wallet||document.documentElement.lang!==x.locale) return false;
          const walletText=wallet.textContent;
          if(!walletText.includes((G.gems||0).toLocaleString(x.locale))) return false;
          if(x.screen==='market') return walletText.includes((G.gold||0).toLocaleString(x.locale));
          const chest=x.warChest.replace('{n}',(80000).toLocaleString(x.locale));
          return walletText.includes(x.diamondsOnly)&&root.querySelector('.merc-offer b')?.textContent===chest;
        },expected,{timeout:15000});
      }
    }
    await page.evaluate(()=>show('home'));
    await page.evaluate(async()=>{ await langLoad('en',true); return langLoad('qps',true); });
    await page.waitForFunction(()=>LANG.cur==='qps'&&LANG.content&&Object.keys(LANG.content).length>0,null,{timeout:30000});
    // the names the game never translates, from its own tables (+ the player's own name)
    await page.evaluate((gname)=>{ const N=new Set([gname,'Emberweave','Emberweave Heroes','Xanthyr Games','Google','Facebook','Discord']);
      const add=v=>{ if(typeof v==='string'&&v.trim()) N.add(v.trim()); };
      try{ for(const t of Object.values(HERO_TYPES)){ add(t.name); add(t.abilityName); } }catch(e){}
      try{ for(const k of Object.values(KITS)) for(const s of ['green','blue','purple']) if(k[s]) add(k[s].name); }catch(e){}
      try{ for(const t of Object.values(MONSTER_TYPES)){ add(t.name); add(t.abilityName); } }catch(e){}
      try{ for(const k of Object.values(MONSTER_KITS)) for(const s of Object.values(k||{})) if(s&&typeof s==='object') add(s.name); }catch(e){}
      try{ Object.values(HERO_SUBNAME).forEach(add); }catch(e){}
      try{ JSON.stringify(EQ_NAMES,(k,v)=>{ if(typeof v==='string') add(v); return v; }); }catch(e){}
      try{ CHAPTER_NAMES.forEach(add); }catch(e){}
      try{ Object.values(ZONES).forEach(z=>add(z&&z.name)); }catch(e){}
      try{ NPC_NAMES.forEach(add); ARENA_SURNAMES.forEach(add); }catch(e){}
      try{ Object.values(WAR_LANE_NAMES).forEach(v=>typeof v==='string'?add(v):Object.values(v||{}).forEach(add)); }catch(e){}
      try{ EW_LANGS.forEach(([c,n])=>add(n)); }catch(e){}   // each language's own name (written in that language, on purpose)
      try{ JSON.stringify(ED_FINISHED,(k,v)=>{ if(k==='name') add(v); return v; }); JSON.stringify(ED_PURPLE,(k,v)=>{ if(k==='name') add(v); return v; }); }catch(e){}
      window.__langNames=[...N].sort((a,b)=>b.length-a.length); },(await page.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('ew_acc')).name; }catch(e){ return ''; } })));
    const collect=async where=>{ stops++;
      const found=await page.evaluate(()=>{ const out=new Set();
        const strip=s=>{ let o='',d=0; for(const ch of s){ if(ch==='⟦'){ d++; continue; } if(ch==='⟧'){ if(d) d--; continue; } if(!d) o+=ch; } return o; };
        // Ranking rows contain player, guild, and seeded opponent names from the server.
        const rankingNames=Array.from(document.querySelectorAll('#bbRows .bb-row > span:nth-child(2)'))
          .filter(el=>el.getClientRects().length).map(el=>el.innerText.trim()).filter(Boolean);
        const names=[...new Set([...(window.__langNames||[]),...rankingNames])].sort((a,b)=>b.length-a.length);
        const escaped=names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
        const fullName=escaped.length?new RegExp('(?<![\\p{L}])(?:'+escaped.join('|')+')(?![\\p{L}])','gu'):null;
        const clean=s=>fullName?s.replace(fullName,' '):s;
        const consider=(s,tag)=>{ s=strip(String(s||'')); for(let line of s.split(/\n+/)){ line=clean(line).replace(/\s+/g,' ').trim(); if(/\p{L}{2,}/u.test(line.replace(/\b(?:HP|ATK|AP|EGP|PvP|DPS|XP|EXP|Lv|VIP|ID|OK|x\d+|v\d+)\b/g,''))) out.add((tag||'')+line.slice(0,140)); } };
        consider(document.body.innerText);
        for(const el of document.querySelectorAll('[title],[placeholder],[aria-label],[aria-description],[aria-valuetext],img[alt]')){
          if(!el.getClientRects().length||getComputedStyle(el).visibility==='hidden'||el.closest('[aria-hidden="true"]')) continue;
          for(const a of ['title','placeholder','aria-label','aria-description','aria-valuetext','alt']) if(el.hasAttribute(a)) consider(el.getAttribute(a),'['+a+'] ');
        }
        // where each leak sits (the innermost element showing exactly that line): id / class path for the next pass
        const where=s=>{ const t0=s.replace(/^\[[a-z-]+\] /,''); let best=null; for(const el of document.querySelectorAll('body *')){ if(!el.getClientRects().length) continue; const tx=strip(el.innerText||'').replace(/\s+/g,' ').trim(); if(tx===t0) best=el; }
          if(!best) return ''; const p=[]; for(let e=best;e&&e!==document.body&&p.length<5;e=e.parentElement) p.unshift(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):''));
          return p.join(' > '); };
        return [...out].map(s=>s+(window.__langWhere?'   @@ '+where(s):'')); });
      for(const f of found)(leaks[f]=leaks[f]||new Set()).add(where); };
    const clickNextTab=seen=>page.evaluate(seen=>{
      const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
      const roots=[...document.querySelectorAll('.screen.active, .modal:not([hidden]), .overlay:not([hidden])')].filter(visible);
      const root=roots.at(-1)||document.body;
      const selectors='[role=tab],[data-tab],[data-settab],.tab,.tabBtn,.subtab,button[class*="Tab"],.fgTabs button,.skyHubTabs button,.arTabs button';
      const used=new Set(seen);
      for(const el of root.querySelectorAll(selectors)){
        if(!visible(el)||el.matches(':disabled')||el.closest('[aria-hidden="true"],[data-lang-skip]')) continue;
        const identity=[...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value]);
        const key=JSON.stringify([root.id,el.id|| (identity.length?identity:el.getAttribute('onclick')||el.textContent.trim())]);
        if(used.has(key)) continue;
        el.click();
        return {key,label:el.textContent.trim()};
      }
      return null;
    },seen);
    const visit=async(name,fn,screenId)=>{ try{
        await page.evaluate(fn);
        if(screenId) await page.locator('#'+screenId+'.active').waitFor({state:'visible',timeout:5000});
      }catch(e){ (leaks['(could not open '+name+': '+String(e.message).slice(0,80)+')']=new Set()).add(name); return; }
      await settle(); await collect(name);
      const seen=[];
      for(let tab=await clickNextTab(seen);tab;tab=await clickNextTab(seen)){
        seen.push(tab.key);
        if(seen.length>100) throw new Error('Tab traversal did not converge on '+name);
        await settle(300);
        await collect(name+' tab '+tab.label);
      }
    };
    if(process.env.LANG_COV_WHERE) await page.evaluate(()=>{ window.__langWhere=1; });
    await collect('home');
    const SCREENS=['campaign','glossary','tech','wall','world','account','arena','arenaShop','dungeon','forge','elite','skyfall','guild','temple','market','shadymarket','watchtower','rankings','wishing','online','heroesPanel','bag','settings','quest','signin','tutorial','skyisland','mail'];
    for(const s of SCREENS) await visit(s,new Function('try{ show('+JSON.stringify(s)+'); }catch(e){ popoutScreen('+JSON.stringify(s)+'); }'),s);
    // every hub building (the town's hot spots), each opened from the hub - the player's level raised on this page so none is locked
    const hots=await page.evaluate(()=>{ G.playerXP=Number.MAX_SAFE_INTEGER; show('home'); try{ renderHome(); }catch(e){} return document.querySelectorAll('#townHots .hot .hit').length; });
    for(let i=0;i<hots;i++) await visit('building '+i,new Function('show("home"); const e=document.querySelectorAll("#townHots .hot .hit")['+i+']; if(e) e.click();'));
    // a hero's detail (every tab), the second hero too
    for(const n of [0,1]) await visit('heroDetail '+n,new Function('detailHero=HERO_KEYS.filter(k=>G.unlocked[k])['+n+']; popoutScreen("heroDetail");'),'heroDetail');
    // Campaign starts in a fresh document so hub overlays cannot cover its battle button.
    await page.reload({waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>typeof show==='function'&&LANG.cur==='qps'&&LANG.content,null,{timeout:120000});
    await page.evaluate(()=>document.querySelector('.splashPlay')?.click());
    await settle(900);
    await page.evaluate(()=>{ const skip=document.getElementById('tutSkip'); if(skip?.offsetParent) skip.click(); });
    // a campaign stage: its card, the squad screen, the battle HUD and the result
    await visit('stage card',()=>{ show('campaign'); openStageModal(1,'normal'); });
    await page.locator('#smBattle').click({timeout:15000});
    await page.locator('#menu.active').waitFor({state:'visible',timeout:15000});
    await page.evaluate(()=>{
      const squad=squadFor('campaign');
      if(!squad.length){
        const hero=HERO_KEYS.find(k=>G.unlocked[k]);
        if(!hero) throw new Error('Localization fixture has no unlocked hero for the campaign squad');
        squad.push(hero);
        renderRoster();
      }
    });
    await collect('squad');
    await page.locator('#startBtn').click({timeout:15000});
    await page.waitForFunction(()=>state==='battle',null,{timeout:30000});
    await collect('battle');
    await page.locator('#pauseBtn').click({timeout:10000});
    await page.locator('#pauseModal.active').waitFor({state:'visible',timeout:10000});
    await collect('battle pause');
    await page.locator('#resumeBtn').click({timeout:10000});
    await page.evaluate(()=>{ G.speed=3; });
    await page.locator('#result.active').waitFor({state:'visible',timeout:120000});
    await collect('result');
    if(process.argv.includes('--keep')) await settle(1e9);
  } finally {
    try{
      const AL=(JSON.parse(fs.readFileSync(path.join(ROOT,'tools','lang','coverage_allow.json'),'utf8')).patterns||[]).map(p=>new RegExp(p.re));
      const list=Object.entries(leaks).filter(([t])=>!AL.some(r=>r.test(t.replace(/   @@ .*$/,'').replace(/^\[[a-z-]+\] /,'')))).map(([t,w])=>({text:t,where:[...w].slice(0,6)})).sort((a,b)=>a.text.localeCompare(b.text));
      fs.writeFileSync(path.join(ROOT,'tools','lang','coverage_leaks.json'),JSON.stringify(list,null,1));
      const errors=[...new Set(h.errors)];
      console.log('coverage: '+stops+' views, '+list.length+' untranslated visible lines, '+errors.length+' distinct page errors');
      for(const l of list.slice(0,200)) console.log('  '+l.text+'   <- '+l.where.join(', '));
      for(const error of errors) console.error('  page error: '+error);
      if(list.length||errors.length) process.exitCode=1;
    }finally{
      await h.close();
    }
  }
})().catch(e=>{ console.error(e); process.exit(2); });
