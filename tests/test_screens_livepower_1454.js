'use strict';
/* Lockdown audit 25 Nov 2026 (live v1454), Heroes building, heroes-B-equipment-to-squad.md "Live power": your own heroes' power updates instantly
   everywhere, including Skyfall, after an upgrade. In a real browser on this checkout's server (temp DB), at 1280x720 and 844x390 (phone, touch):
   a skill upgrade is pressed on the Skills tab (the server's /api/skill/upgrade), then WITHOUT a reload the same hero's power is read off every
   screen that shows it: the hero window, the Heroes list card, the campaign squad picker (card + picked slot), Arena defence, the Vault picker,
   the world-map march picker and attack panel, and the Skyfall Edit Team line. All must equal the new card number (and differ from the old one).
   Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-1450.js');
const C=H.checker('test_screens_livepower_1454.js');
const HEROES={vael:60,sylthaine:60,vireo:40,lumi:30,umbris:30,grosk:30};
const press=(pg,touch,sel)=>touch?pg.tap(sel):pg.click(sel);
const NUM=`(s=>{ const m=String(s||'').match(/\\d[\\d,]*/); return m?+m[0].replace(/,/g,''):null; })`;

/* every screen that shows the hero's power: [name, opener (page), reader (page) -> number or null] */
const SCREENS=[
  ['hero window',`()=>{ closePopout(); popoutScreen('heroesPanel'); detailHero=K; heroTab='skills'; popoutScreen('heroDetail'); renderHeroDetail(); }`,`()=>N((document.querySelector('#heroDetailBody .hd-power b')||{}).textContent)`],
  ['Heroes list card',`()=>{ closePopout(); popoutScreen('heroesPanel'); }`,`()=>N((document.querySelector('#heroList .hero-card[data-hero-key="'+K+'"] .hc-sub')||{}).textContent)`],
  ['campaign squad picker (card)',`()=>{ closePopout(); CUR={mode:'campaign',node:1}; teamCtx='campaign'; menuReturn='home'; show('menu'); }`,`()=>N((document.querySelector('#roster .rsCard[data-hero-key="'+K+'"] .rsPow')||{}).textContent)`],
  ['campaign squad picker (picked slot)',null,`()=>{ const s=[...document.querySelectorAll('#rosterSlots .rsSlot.full')].find(x=>x.querySelector('.rsName')&&x.querySelector('.rsName').textContent===HERO_TYPES[K].name); return s?N(s.querySelector('.rsPow').textContent):null; }`],
  ['Arena defence',`()=>{ closePopout(); teamCtx='arena'; menuReturn='arena'; show('menu'); }`,`()=>N((document.querySelector('#roster .rsCard[data-hero-key="'+K+'"] .rsPow')||{}).textContent)`],
  ['Vault picker',`()=>{ closePopout(); vaultSelectHeroes(); }`,`()=>N((document.querySelector('#roster .rsCard[data-hero-key="'+K+'"] .rsPow')||{}).textContent)`],
  ['world map march picker',`()=>{ closePopout(); show('home'); MC_CLEAR(); openMarchSelect('defend',{x:5,y:5,name:'Test Keep'}); }`,`()=>N((document.querySelector('.mc-hero[data-k="'+K+'"] .rsPow')||{}).textContent)`],
  ['world map attack panel (line power)',`()=>{ MC_CLEAR(); openAttackPrep('attack',{x:5,y:5,name:'Test Keep'},[K]); }`,`()=>{ const p=document.querySelector('#atkPrep .apPow'); const r=N(p&&p.textContent); document.getElementById('atkPrep')&&document.getElementById('atkPrep').remove(); return r; }`],
  ['Skyfall Edit Team line',`async()=>{ closePopout(); show('skyfall'); for(let i=0;i<100&&!document.getElementById('skyStage');i++) await new Promise(r=>setTimeout(r,100)); await new Promise(r=>setTimeout(r,3000));   /* the screen draws, fetches its status and draws again: Edit Team after it settles, like a player */ const was=document.querySelector('#skyStage .skyBrk'); if(was) was.remove(); const eb=document.getElementById('skyEditTeam'); if(eb) eb.click(); else skyEditTeamOpen(); for(let i=0;i<100&&(SKYTEAM.loading||!document.querySelector('#skyStage .skyBrk[data-kind="team"] [data-k]'));i++) await new Promise(r=>setTimeout(r,100)); }`,
    `()=>{ const c=document.querySelector('#skyStage .skyBrk[data-kind="team"] [data-k="'+K+'"] .skyTPw'); return c?N(c.textContent):null; }`],
];

const CLEAR=`window.MC_CLEAR=()=>{ document.querySelectorAll('.mc-hero').forEach(e=>{ let o=e; while(o.parentElement&&o.parentElement!==document.body) o=o.parentElement; if(o.parentElement) o.remove(); }); const a=document.getElementById('atkPrep'); if(a) a.remove(); };`;
async function readAll(pg,key){ const out={}; await pg.evaluate(CLEAR);
  for(const [name,open,read] of SCREENS){
    if(open){ await pg.evaluate(`(async()=>{ const K=${JSON.stringify(key)}; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); await (${open})(); })()`).catch(e=>{ out[name+' (open error)']=String(e.message).slice(0,160); }); await H.wait(name.startsWith('Skyfall')?400:800); await H.clean(pg); }
    out[name]=await pg.evaluate(`(()=>{ const K=${JSON.stringify(key)}, N=${NUM}; return (${read})(); })()`).catch(e=>'error '+String(e.message).slice(0,120));
    if(name.startsWith('Skyfall')) out[name+' (seen)']=await pg.evaluate(()=>{ const st=document.getElementById('skyStage'), p=st&&st.querySelector('.skyBrk[data-kind="team"]');
      return {state,stage:!!st,panel:!!p,text:p?p.textContent.replace(/\s+/g,' ').slice(0,200):null,lines:SKYTEAM.lines,bench:SKYTEAM.bench.length,tiles:p?[...p.querySelectorAll('[data-k]')].map(e=>e.dataset.k+':'+((e.querySelector('.skyTPw')||{}).textContent||'')):[],enabled:SKY.st&&SKY.st.enabled}; }).catch(e=>String(e.message).slice(0,200));
  }
  return out; }

async function run(pg,tag,touch,key,s){
  await pg.evaluate(k=>{ G.team=[k].concat((G.team||[]).filter(x=>x!==k)).slice(0,5); G.arenaDef=[k]; saveG(); },key);
  const before=await readAll(pg,key);
  const cardBefore=await pg.evaluate(k=>heroPower(k),key);
  /* the upgrade: the Skills tab, the first lit "+" button, a real press */
  await pg.evaluate(()=>{ MC_CLEAR(); closePopout(); show('home'); }); await H.wait(800);
  await pg.evaluate(k=>{ closePopout(); popoutScreen('heroesPanel'); detailHero=k; heroTab='stats'; popoutScreen('heroDetail'); renderHeroDetail(); },key); await H.wait(600); await H.clean(pg);
  await press(pg,touch,'#heroDetailBody .hd-tab[data-tab="skills"]'); await H.wait(700);
  const btn=await pg.evaluate(()=>{ const b=[...document.querySelectorAll('#heroDetailBody [data-skillup]')].find(x=>!x.disabled); if(!b) return null; b.scrollIntoView({block:'center'}); return b.dataset.skillup; });
  if(btn==null){ C.ok(false,tag+' a skill upgrade button is lit for '+key); return; }
  const lvBefore=await pg.evaluate(([k,i])=>skillLevel(k,+i),[key,btn]);
  const t0=Date.now();
  await press(pg,touch,'#heroDetailBody [data-skillup="'+btn+'"]');
  await pg.waitForFunction(([k,p])=>{ const b=document.querySelector('#heroDetailBody .hd-power b'); return b&&+b.textContent.replace(/\D/g,'')!==p; },[key,cardBefore],{timeout:15000}).catch(()=>{});
  const ms=Date.now()-t0;
  const now=await pg.evaluate(([k,i])=>({card:heroPower(k),lv:skillLevel(k,+i),win:+(document.querySelector('#heroDetailBody .hd-power b')||{textContent:''}).textContent.replace(/\D/g,'')}),[key,btn]);
  const srv=s.disk().led.hero[key];
  C.ok(now.lv===lvBefore+1&&now.card!==cardBefore&&now.win===now.card,tag+' '+key+': the skill upgrade (skill '+btn+' Lv '+lvBefore+' -> '+now.lv+', server '+JSON.stringify(srv.sk||srv.skills||null)+') changes the card power '+cardBefore.toLocaleString()+' -> '+now.card.toLocaleString()+' on the hero window '+ms+' ms after the press, no reload',
    {before:cardBefore,after:now.card,window:now.win,ms});
  await pg.evaluate(()=>{ MC_CLEAR(); closePopout(); show('home'); }); await H.wait(600);
  const after=await readAll(pg,key);
  const rows=SCREENS.map(([n])=>n);
  for(const n of rows){ const b=before[n], a=after[n];
    C.ok(a===now.card&&b===cardBefore,tag+' Live power, '+n+': '+(b==null?'-':Number(b).toLocaleString())+' before, '+(a==null?'-':Number(a).toLocaleString())+' after = the new card number '+now.card.toLocaleString()+' (no reload)',
      {before:b,after:a,card:now.card,openErr:after[n+' (open error)'],seen:after[n+' (seen)']}); }
  const reloads=await pg.evaluate(()=>performance.getEntriesByType('navigation').length);
  C.ok(reloads===1,tag+' the page was never reloaded (one navigation entry)',{navigations:reloads});
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.gold=10000000; for(const k of Object.keys(HEROES)) u.led.hero[k].stars=5; });
  const s=await H.server(file); let pg=null;
  try{
    for(const [w,h,touch,tag,key] of [[1280,720,false,'1280x720','vael'],[844,390,true,'844x390','sylthaine']]){
      pg=await H.game(s.port,{w,h,touch});
      try{ await run(pg,tag,touch,key,s); }catch(e){ C.ok(false,tag+' the live power part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null;
    }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
