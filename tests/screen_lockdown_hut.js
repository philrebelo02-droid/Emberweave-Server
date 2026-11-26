'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 23 - The Witches Hut (market-shady-board-hut-egp.md, UNPROVEN-ON-SCREEN):
   - Pickers show HP: the world-map march pickers grey a 0% hero ("HP 0%") and show "Lv N" and "HP x%" for a wounded one.
   Seeded on the server: Vael at 0% HP, Aureth at 40% (the Witches Hut's own health store). Pickers:
     1. the mine picker, opened the way a player does: City Wall plate > World > a mine on the map > Send miners;
     2. the march picker (defend / garrison: openMarchSelect, the picker the city menu opens);
     3. the attack picker (openAttackPrep, the picker a live war's Attack opens).
   At desktop 1280x720 and phone 844x390. One screenshot per check per size (SHOT64 lines). Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_hut.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:30,aureth:30,sylthaine:30,vireo:30,brannus:30};
const DEAD='vael', HURT='aureth';

/* rsPickerHTML pickers (mine, march): the 0% hero greyed with "HP 0%"; the wounded one "Lv 30" and "HP 40%"; a full hero no HP line */
async function rsCheck(pg,S,label){
  await pg.waitForFunction(k=>{ const c=document.querySelector('.mc-hero[data-k="'+k+'"] ~ .rsPow, .mc-hero[data-k="'+k+'"] .rsPow'); return [...document.querySelectorAll('.mc-hero')].some(e=>/HP 0%/.test(e.textContent)); },DEAD,{timeout:20000}).catch(()=>{});
  await H.wait(500); await H.prep(pg);
  const r=await pg.evaluate(([dead,hurt])=>{ const card=k=>document.querySelector('.mc-hero[data-k="'+k+'"]');
    const one=k=>{ const c=card(k); if(!c) return null; c.scrollIntoView({block:'center'}); const pow=c.querySelector('.rsPow'), lv=c.querySelector('.rsLv');
      return {opacity:+getComputedStyle(c).opacity,lv:SL.txt(lv),pow:SL.txt(pow),powColor:getComputedStyle(pow.firstElementChild||pow).color,on:SL.inView(c),powOn:SL.inView(pow),selected:c.classList.contains('selected'),box:SL.R(c)}; };
    return {dead:one(dead),hurt:one(hurt),full:one('sylthaine')}; },[DEAD,HURT]);
  await pg.evaluate(k=>{ const c=document.querySelector('.mc-hero[data-k="'+k+'"]'); if(c) c.scrollIntoView({block:'center'}); },DEAD);
  const s=await shot(pg,S.tag+' '+label+' picker');
  /* a tap on the 0% hero picks nothing */
  const before=await pg.evaluate(()=>document.querySelectorAll('.rsSlot.full').length);
  const sel='.mc-hero[data-k="'+DEAD+'"]'; try{ if(S.touch) await pg.tap(sel,{timeout:5000}); else await pg.click(sel,{timeout:5000}); }catch(e){}
  await H.wait(400); const after=await pg.evaluate(k=>({slots:document.querySelectorAll('.rsSlot.full').length,picked:!!document.querySelector('[data-rsp-slot="'+k+'"]')}),DEAD);
  const d=r.dead||{}, h=r.hurt||{}, f=r.full||{};
  C.ok(!!r.dead&&d.pow==='HP 0%'&&d.opacity<=0.5&&d.on&&d.powOn&&!after.picked,S.tag+' Pickers show HP, '+label+' picker: the 0% hero ('+DEAD+') is greyed (opacity '+d.opacity+') and reads "HP 0%", on screen; a tap on it picks nothing',{dead:r.dead,tap:{before,after},shot:s});
  C.ok(!!r.hurt&&/^Lv 30$/.test(h.lv)&&/HP 40%$/.test(h.pow)&&h.opacity===1&&h.on&&h.powOn,S.tag+' Pickers show HP, '+label+' picker: the wounded hero ('+HURT+') shows "'+h.lv+'" and "'+h.pow+'", not greyed',{hurt:r.hurt,shot:s});
  C.ok(!!r.full&&!/HP/.test(f.pow),S.tag+' Pickers show HP, '+label+' picker: a full-health hero shows no HP line ("'+f.pow+'")',{full:r.full});
}

async function minePicker(pg,S){
  await H.openBuilding(pg,'wall',S.touch);
  const wb='#wall>[data-nav="world"]';
  if(S.touch) await pg.tap(wb); else await pg.click(wb);
  await pg.waitForFunction(()=>state==='world'&&!!document.getElementById('wzone'),null,{timeout:40000}).catch(()=>{});
  await pg.waitForFunction(()=>document.querySelectorAll('#wzone .wnode.mine').length>0,null,{timeout:40000}).catch(()=>{}); await H.wait(1500); await H.prep(pg);
  /* tap the first mine that is on screen; else open the nearest mine's info box the way its map node does */
  const m=await pg.evaluate(()=>{ const n=[...document.querySelectorAll('#wzone .wnode.mine')].find(e=>SL.inView(e)&&SL.front(e)); if(n){ n.setAttribute('data-sl-pick','1'); return {how:'tapped a mine on the map',id:n.dataset.mineId}; }
    const all=worldMines().filter(x=>!(Number.isFinite(x.left)&&x.left<=0)); if(!all.length) return {how:'no mine on the map'}; openMineInfo(all[0]); return {how:'mine info opened (no mine node on screen)',id:all[0].id}; });
  if(m.how==='tapped a mine on the map'){ if(S.touch) await pg.tap('[data-sl-pick="1"]'); else await pg.click('[data-sl-pick="1"]'); }
  await pg.waitForFunction(()=>!!document.querySelector('.citymenu [data-a="mine"]'),null,{timeout:15000}).catch(()=>{}); await H.wait(400);
  const btn='.citymenu [data-a="mine"]', has=await pg.$(btn);
  C.ok(!!has,S.tag+' Pickers show HP, mine picker: the mine\'s Send miners button is there ('+m.how+')',m);
  if(!has) return;
  await pg.evaluate(b=>document.querySelector(b).scrollIntoView({block:'center'}),btn);
  if(S.touch) await pg.tap(btn); else await pg.click(btn);
  await pg.waitForFunction(()=>document.querySelectorAll('.mc-hero').length>0,null,{timeout:15000}).catch(()=>{});
  await rsCheck(pg,S,'mine');
  await pg.evaluate(()=>{ const x=document.getElementById('mcX'); if(x) x.click(); });
}

async function marchPicker(pg,S){
  await pg.evaluate(()=>{ document.querySelectorAll('#mcX').forEach(x=>x.click()); openMarchSelect('defend',{name:'Ally Keep',x:40,y:40}); });
  await pg.waitForFunction(()=>document.querySelectorAll('.mc-hero').length>0,null,{timeout:15000}).catch(()=>{});
  await rsCheck(pg,S,'march (defend)');
  await pg.evaluate(()=>{ const x=document.getElementById('mcX'); if(x) x.click(); });
}

async function attackPicker(pg,S){
  await pg.evaluate(()=>{ openAttackPrep('attack',{name:'Rival Keep',x:60,y:60},null); });
  await pg.waitForFunction(k=>!!document.querySelector('#atkPrep .apT[data-k="'+k+'"] .apTag'),DEAD,{timeout:20000}).catch(()=>{}); await H.wait(800); await H.prep(pg);
  const r=await pg.evaluate(([dead,hurt])=>{ const one=k=>{ const c=document.querySelector('#atkPrep .apT[data-k="'+k+'"]'); if(!c) return null; c.scrollIntoView({block:'center'});
      const tag=c.querySelector('.apTag'), lv=c.querySelector('.apLv'), bar=c.querySelector('.apHp i'), img=c.querySelector('.ascw img');
      return {gray:c.classList.contains('gray'),imgFilter:img?getComputedStyle(img).filter:null,tag:tag?SL.txt(tag):null,lv:SL.txt(lv),bar:bar?bar.style.width:null,on:SL.inView(c),box:SL.R(c)}; };
    return {dead:one(dead),hurt:one(hurt)}; },[DEAD,HURT]);
  const s=await shot(pg,S.tag+' attack picker');
  const d=r.dead||{}, h=r.hurt||{};
  C.ok(!!r.dead&&d.gray&&/grayscale\(1\)/.test(d.imgFilter||'')&&d.tag==='HP 0%'&&d.on,S.tag+' Pickers show HP, attack picker: the 0% hero is greyed (grayscale) with the "HP 0%" tag, on screen',{dead:r.dead,shot:s});
  C.ok(!!r.hurt&&!h.gray&&/^Lv 30$/.test(h.lv)&&h.bar==='40%'&&h.on,S.tag+' Pickers show HP, attack picker: the wounded hero shows "'+h.lv+'" and a health bar at '+h.bar,{hurt:r.hurt,shot:s});
  await pg.evaluate(()=>{ const o=document.getElementById('atkPrep'); if(o) o.remove(); });
}

(async()=>{
  const now=Date.now();
  const {file}=H.seedDB(HEROES,u=>{ u.witch={level:20,brew:0,tickAt:now,hp:{[DEAD]:0,[HURT]:4000},spent:[],surgeUntil:0,shopDay:'',shopUses:{first:0,second:0}}; });
  const s=await H.server(file); let pg=null;
  try{
    const ws=(await s.api('/api/witch/state')).body||{};
    C.ok(Array.isArray(ws.heroes)&&ws.heroes.some(h=>h.key===DEAD&&h.hp===0)&&ws.heroes.some(h=>h.key===HURT&&h.hp===4000),'server: the Witches Hut reports '+DEAD+' at 0% and '+HURT+' at 40%',(ws.heroes||[]).map(h=>h.key+' '+h.hp));
    for(const k of ['desktop','phone']){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      for(const [n,f] of [['mine',minePicker],['march',marchPicker],['attack',attackPicker]]){ try{ await f(pg,S); }catch(e){ C.ok(false,S.tag+' '+n+' picker part ran to the end',String(e&&e.stack||e).slice(0,500)); } }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
