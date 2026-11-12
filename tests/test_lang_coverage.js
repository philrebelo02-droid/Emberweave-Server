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
    await page.waitForFunction(()=>LANG.content,null,{timeout:30000}).catch(()=>{});
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
        const names=window.__langNames||[];
        const clean=s=>{ for(const n of names) if(n&&s.includes(n)) s=s.split(n).join(' '); return s; };
        const consider=(s,tag)=>{ s=strip(String(s||'')); for(let line of s.split(/\n+/)){ line=clean(line).replace(/\s+/g,' ').trim(); if(/\p{L}{2,}/u.test(line.replace(/\b(?:HP|ATK|AP|EGP|PvP|DPS|XP|EXP|Lv|VIP|ID|OK|x\d+|v\d+)\b/g,''))) out.add((tag||'')+line.slice(0,140)); } };
        consider(document.body.innerText);
        for(const el of document.querySelectorAll('[title],[placeholder],[aria-label]')){ if(!el.getClientRects().length) continue;
          for(const a of ['title','placeholder','aria-label']) if(el.hasAttribute(a)) consider(el.getAttribute(a),'['+a+'] '); }
        // where each leak sits (the innermost element showing exactly that line): id / class path for the next pass
        const where=s=>{ const t0=s.replace(/^\[[a-z-]+\] /,''); let best=null; for(const el of document.querySelectorAll('body *')){ if(!el.getClientRects().length) continue; const tx=strip(el.innerText||'').replace(/\s+/g,' ').trim(); if(tx===t0) best=el; }
          if(!best) return ''; const p=[]; for(let e=best;e&&e!==document.body&&p.length<5;e=e.parentElement) p.unshift(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):''));
          return p.join(' > '); };
        return [...out].map(s=>s+(window.__langWhere?'   @@ '+where(s):'')); });
      for(const f of found)(leaks[f]=leaks[f]||new Set()).add(where); };
    const tabsHere=()=>page.evaluate(()=>{ const scr=[...document.querySelectorAll('.screen.active, .modal:not([hidden]), .overlay:not([hidden])')].filter(e=>e.getClientRects().length);
      const root=scr[scr.length-1]||document.body; const c=[...root.querySelectorAll('[data-tab],[data-settab],.tab,.tabBtn,.subtab,[class*="Tab"]:not([class*="Table"]),[role=tab]')].filter(e=>e.getClientRects().length&&!e.closest('[data-lang-skip]'));
      c.forEach((e,i)=>e.setAttribute('data-lang-cov-tab',String(i))); return c.length; });
    const clickTab=i=>page.evaluate(i=>{ const e=document.querySelector('[data-lang-cov-tab="'+i+'"]'); if(e) e.click(); },i);
    const visit=async(name,fn)=>{ try{ await page.evaluate(fn); }catch(e){ (leaks['(could not open '+name+': '+String(e.message).slice(0,80)+')']=new Set()).add(name); return; }
      await settle(); await collect(name);
      const n=Math.min(await tabsHere(),24); for(let i=0;i<n;i++){ await clickTab(i); await settle(300); await collect(name+' tab '+i); await tabsHere(); } };
    if(process.env.LANG_COV_WHERE) await page.evaluate(()=>{ window.__langWhere=1; });
    await collect('home');
    const SCREENS=['campaign','glossary','tech','wall','world','account','arena','arenaShop','dungeon','forge','elite','skyfall','guild','temple','market','shadymarket','watchtower','rankings','wishing','online','heroesPanel','bag','settings','quest','signin','tutorial','skyisland','mail'];
    for(const s of SCREENS) await visit(s,new Function('try{ show('+JSON.stringify(s)+'); }catch(e){ popoutScreen('+JSON.stringify(s)+'); }'));
    // every hub building (the town's hot spots), each opened from the hub - the player's level raised on this page so none is locked
    const hots=await page.evaluate(()=>{ G.playerXP=Number.MAX_SAFE_INTEGER; show('home'); try{ renderHome(); }catch(e){} return document.querySelectorAll('#townHots .hot .hit').length; });
    for(let i=0;i<hots;i++) await visit('building '+i,new Function('show("home"); const e=document.querySelectorAll("#townHots .hot .hit")['+i+']; if(e) e.click();'));
    // a hero's detail (every tab), the second hero too
    for(const n of [0,1]) await visit('heroDetail '+n,new Function('detailHero=HERO_KEYS.filter(k=>G.unlocked[k])['+n+']; popoutScreen("heroDetail");'));
    // a campaign stage: its card, the squad screen, the battle HUD and the result
    await visit('stage card',()=>{ show('campaign'); openStageModal(1,'normal'); });
    await page.evaluate(()=>{ const b=document.getElementById('smBattle'); if(b&&!b.disabled) b.click(); }); await settle(900); await collect('squad');
    await page.evaluate(()=>{ const b=document.getElementById('startBtn'); if(b) b.click(); });
    for(const s of [3,8,15]){ await settle(s*1000-(s===3?0:(s===8?3000:8000))); await collect('battle '+s+'s'); }
    await page.evaluate(()=>{ try{ G.speed=3; }catch(e){} });
    for(let i=0;i<60;i++){ const done=await page.evaluate(()=>{ const r=document.getElementById('result'); return !!(r&&r.classList.contains('active')); }); if(done) break; await settle(2000); }
    await settle(1500); await collect('result');
    if(process.argv.includes('--keep')) await settle(1e9);
  } finally {
    const AL=(JSON.parse(fs.readFileSync(path.join(ROOT,'tools','lang','coverage_allow.json'),'utf8')).patterns||[]).map(p=>new RegExp(p.re));
    const list=Object.entries(leaks).filter(([t])=>!AL.some(r=>r.test(t.replace(/   @@ .*$/,'').replace(/^\[[a-z-]+\] /,'')))).map(([t,w])=>({text:t,where:[...w].slice(0,6)})).sort((a,b)=>a.text.localeCompare(b.text));
    fs.writeFileSync(path.join(ROOT,'tools','lang','coverage_leaks.json'),JSON.stringify(list,null,1));
    console.log('coverage: '+stops+' views, '+list.length+' untranslated visible lines'+(h.errors.length?' ; page errors: '+h.errors.slice(0,3).join(' | '):''));
    for(const l of list.slice(0,60)) console.log('  '+l.text+'   <- '+l.where.join(', '));
    await h.close(); try{ S.srv.kill(); }catch(_){}
    if(list.length) process.exitCode=1;
  }
})().catch(e=>{ console.error(e); process.exit(2); });
