'use strict';
/* Lockdown audit 25 Nov 2026, section 28 Affinities, the on-screen lines (live v1450), in a real browser on this checkout's server (temp DB):
   - Class and element icons: the Heroes list card and the campaign + Vault enemy cards show both, the icon images really loaded.
   - Affinities button: left of Glossary on the campaign map (1280x720 and a phone 844x390), and a click opens the chart.
   - Art chart: one picture (loaded, on screen, big) with the 6 class and the 8 element tap areas on it (classes left half, elements right half).
   - Rule cards: hover (PC) and tap (phone) a class or element shows its rule with the exact numbers.
   - Translated chart: German, Japanese and Thai - headings, the 14 name plates and the rule cards in the player's language, same numbers.
   Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-1450.js');
const C=H.checker('test_screens_affinities_1450.js');
const PROF=require('../hero-profiles.js'), CORE=require('../server/combat-core.js');   /* the expected class (hero profile) and element (the server's fight table) */
const HEROES={vael:30,vireo:30,sylthaine:30,lumi:30,umbris:30,grosk:30};
/* the numbers each English rule card must carry (checklist section 28 class edges and elements) */
const NUMS={Support:['50','20'],Tank:['25','1'],Marksman:['10'],Mage:['30','20','2'],Bruiser:['100','3'],Assassin:['40','4'],
  Water:['20'],Fire:['20'],Ice:['20'],Nature:['20'],Lightning:['20'],Light:['20'],Dark:['20'],Neutral:[]};
const nums=s=>(String(s).match(/\d+(?:[.,]\d+)?/g)||[]).sort();
const IMGCHK=`(im=>({src:(im.getAttribute('src')||'').replace(/^.*\\/assets\\//,'assets/'),w:im.naturalWidth,h:im.naturalHeight,done:im.complete}))`;
const VIS=`(el=>{ const r=el.getBoundingClientRect(), V={w:innerWidth,h:innerHeight}; const cx=r.left+r.width/2, cy=r.top+r.height/2;
  const top=document.elementFromPoint(Math.min(V.w-1,Math.max(0,cx)),Math.min(V.h-1,Math.max(0,cy)));
  return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),on:r.width>0&&r.height>0&&r.left>=-1&&r.top>=-1&&r.right<=V.w+1&&r.bottom<=V.h+1,
    front:!!top&&(top===el||el.contains(top)||top.contains(el))}; })`;

async function heroCards(pg,tag){
  await pg.evaluate(()=>{ closePopout(); popoutScreen('heroesPanel'); }); await H.wait(1500); await H.clean(pg);
  const keys=Object.keys(HEROES);
  for(const k of keys){
    const r=await pg.evaluate(async([k,IMG,VIS,WANT])=>{ const img=eval(IMG), vis=eval(VIS);
      const pic=document.getElementById('rcp_'+k); const card=pic&&pic.closest('.hero-card'); if(!card) return {missing:true};
      card.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,250));
      const row=card.querySelector('.afbW.afbRow'); if(!row) return {noRow:true};
      const ims=[...row.querySelectorAll('img')];
      for(let i=0;i<40&&ims.some(x=>!x.complete);i++) await new Promise(r=>setTimeout(r,100));
      return {cls:row.dataset.afbClass,elem:row.dataset.afbElem,want:WANT,
        imgs:ims.map(img),alts:ims.map(x=>x.alt),vis:vis(row),classIcon:!!row.querySelector('.afbC img'),elemIcon:!!row.querySelector('.afbE img')}; },[k,IMGCHK,VIS,[PROF[k].class,CORE.AFF_ELEMENT[k]||'Neutral']]);
    C.ok(!r.missing&&!r.noRow&&r.classIcon&&r.elemIcon&&r.imgs.length===2&&r.imgs.every(i=>i.w>0&&i.done)&&r.vis.on&&r.vis.w>=20&&r.cls===r.want[0]&&r.elem===r.want[1],
      tag+' Heroes list card '+k+': class + element icons loaded and on screen, the right ones',r);
  }
}
async function enemyCard(pg,tag,mode){
  let chips;
  if(mode==='campaign'){
    await pg.evaluate(()=>{ closePopout(); PORTAL='normal'; show('campaign'); }); await H.wait(1200); await H.clean(pg);
    await pg.evaluate(()=>openStageModal(1,'normal'));
  } else {
    const st=await pg.evaluate(async()=>{ closePopout(); try{ closeStageModal(); }catch(e){} const s=await vaultStatus(); return {enabled:s&&s.enabled,floor:s&&s.currentFloor,waves:(s&&s.waves||[]).length}; });
    C.ok(st.enabled&&st.waves>0,tag+' the Vault answers with floor '+st.floor+' and its waves',st);
    await pg.evaluate(()=>vaultInfo());
  }
  for(let i=0;i<150;i++){ chips=await pg.evaluate(()=>[...document.querySelectorAll('.smEnemy')].filter(c=>c.offsetWidth>0).length); if(chips) break; await H.wait(200); }
  C.ok(chips>0,tag+' '+mode+' lineup shows enemy chips',{chips});
  if(!chips) return;
  const chip=await pg.evaluate(()=>{ const c=[...document.querySelectorAll('.smEnemy')].find(c=>c.offsetWidth>0); c.scrollIntoView({block:'center'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,name:c.getAttribute('aria-label')}; });
  await pg.mouse.move(5,5); await H.wait(150); await pg.mouse.move(chip.x,chip.y,{steps:4}); await H.wait(500);
  let open=await pg.evaluate(()=>!!document.querySelector('#mcLayer .mcAff'));
  if(!open){ await pg.mouse.dblclick(chip.x,chip.y); await H.wait(500); }
  const r=await pg.evaluate(async([IMG,VIS])=>{ const img=eval(IMG), vis=eval(VIS); const a=document.querySelector('#mcLayer .mcAff'); if(!a) return {open:false};
    const ims=[...a.querySelectorAll('img')]; for(let i=0;i<40&&ims.some(x=>!x.complete);i++) await new Promise(r=>setTimeout(r,100));
    const c=a.querySelector('[data-mc-class]'), e=a.querySelector('[data-mc-elem]');
    return {open:true,name:(document.querySelector('#mcLayer .mcName')||{}).textContent,cls:c&&c.dataset.mcClass,clsWord:c&&c.textContent.trim(),elem:e&&e.dataset.mcElem,elemWord:e&&e.textContent.trim(),
      imgs:ims.map(img),vis:vis(a)}; },[IMGCHK,VIS]);
  C.ok(r.open&&r.cls&&r.elem&&r.clsWord&&r.elemWord&&r.imgs.length===2&&r.imgs.every(i=>i.w>0&&i.done)&&r.vis.on,
    tag+' '+mode+' enemy card ('+chip.name+'): class and element, both icons loaded, on screen',r);
  await pg.evaluate(()=>{ try{ mcardClose(); }catch(e){} try{ closeStageModal(); }catch(e){} const v=document.getElementById('vtInfoPop'); if(v) v.remove(); });
}
async function button(pg,tag){
  await pg.evaluate(()=>{ closePopout(); try{ closeStageModal(); }catch(e){} PORTAL='normal'; show('campaign'); }); await H.wait(1500); await H.clean(pg);
  const r=await pg.evaluate(VIS=>{ const vis=eval(VIS); affBtnPlace(); const a=document.getElementById('campAffBtn'), g=document.getElementById('campGlossBtn'); if(!a||!g) return {missing:true};
    const ar=a.getBoundingClientRect(), gr=g.getBoundingClientRect();
    return {aff:vis(a),gloss:vis(g),gap:Math.round(gr.left-ar.right),dy:Math.round(Math.abs((ar.top+ar.height/2)-(gr.top+gr.height/2))),label:a.textContent.trim()}; },VIS);
  C.ok(!r.missing&&r.aff.on&&r.aff.front&&r.gloss.on&&r.gap>=0&&r.gap<=24&&r.dy<=6,tag+' Affinities button sits just left of Glossary on the campaign map, on one line, not covered',r);
  return r;
}
async function chart(pg,tag,touch,lang){
  await pg.evaluate(()=>{ const o=document.getElementById('affOv'); if(o) o.remove(); });
  const b=await pg.evaluate(()=>{ const a=document.getElementById('campAffBtn'); const r=a.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  if(touch) await pg.tap('#campAffBtn'); else await pg.mouse.click(b.x,b.y);
  for(let i=0;i<50;i++){ if(await pg.evaluate(()=>{ const im=document.querySelector('#affOv img'); return !!im&&im.complete; })) break; await H.wait(100); }
  const r=await pg.evaluate(([IMG,VIS])=>{ const img=eval(IMG), vis=eval(VIS); const ov=document.getElementById('affOv'); if(!ov) return {open:false};
    const im=ov.querySelector('#affBox>img'), box=ov.querySelector('#affBox').getBoundingClientRect(), hits=[...ov.querySelectorAll('.affHit')];
    const cls=hits.filter(h=>Object.hasOwn(CLASS_BEATS,h.dataset.k)), el=hits.filter(h=>!Object.hasOwn(CLASS_BEATS,h.dataset.k));
    const cx=h=>{ const r=h.getBoundingClientRect(); return (r.left+r.width/2-box.left)/box.width; };
    return {open:true,img:img(im),art:AFF_ART.replace(/^.*\/assets\//,'assets/'),pictures:ov.querySelectorAll('img').length,vis:vis(im),boxW:Math.round(box.width),boxH:Math.round(box.height),vw:innerWidth,vh:innerHeight,
      classes:cls.map(h=>h.dataset.k),elements:el.map(h=>h.dataset.k),classX:Math.max(...cls.map(cx)).toFixed(2),elemX:Math.min(...el.map(cx)).toFixed(2),
      hitsOnArt:hits.every(h=>{ const r=h.getBoundingClientRect(); return r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1&&r.width>8; })}; },[IMGCHK,VIS]);
  if(lang==='en') C.ok(r.open&&r.img.w>=1000&&r.img.done&&r.img.src===r.art&&r.vis.on&&(r.boxW>=0.85*r.vw||r.boxH>=0.8*r.vh)&&r.classes.length===6&&r.elements.length===8&&+r.classX<0.5&&+r.elemX>0.5&&r.hitsOnArt,
    tag+' Affinities chart: one picture, loaded, on screen and big, the 6 class tap areas on its left half and the 8 element ones on its right half',r);
  else C.ok(r.open&&r.img.w>0&&r.vis.on&&r.classes.length===6&&r.elements.length===8,tag+' the chart opens with its picture and 14 tap areas',{w:r.img.w,src:r.img.src,classes:r.classes.length,elements:r.elements.length});
  return r;
}
/* hover (PC) or tap (phone) every class and element: its card shows, inside the chart, with the rule's numbers */
async function ruleCards(pg,tag,touch,en){
  const keys=await pg.evaluate(()=>[...document.querySelectorAll('#affOv .affHit')].map(h=>h.dataset.k)); const got={};
  for(const k of keys){
    const p=await pg.evaluate(k=>{ const h=document.querySelector('#affOv .affHit[data-k="'+k+'"]'); const r=h.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; },k);
    let diag=null;
    if(touch){ diag=await pg.evaluate(([x,y,k])=>{ const e=document.elementFromPoint(x,y); return {ov:!!document.getElementById('affOv'),atCentre:e?(e.className||e.id||e.tagName)+(e.dataset&&e.dataset.k?':'+e.dataset.k:''):null,
        zoom:getComputedStyle(document.body).zoom,dpr:devicePixelRatio,vv:window.visualViewport?Math.round(visualViewport.width)+'x'+Math.round(visualViewport.height)+' s'+visualViewport.scale:null}; },[p.x,p.y,k]);
      await pg.evaluate(()=>{ window.__affEv=[]; const ov=document.getElementById('affOv'); if(ov) ['pointerdown','pointerup','touchstart','touchend','mouseenter','click','mouseleave'].forEach(t=>ov.addEventListener(t,e=>window.__affEv.push(t+':'+((e.target&&e.target.dataset&&e.target.dataset.k)||e.target.id||e.target.tagName)),true)); });
      await pg.tap('#affOv .affHit[data-k="'+k+'"]'); }
    else { await pg.mouse.move(2,2); await pg.mouse.move(p.x,p.y,{steps:3}); }
    await H.wait(200);
    if(touch){ diag.after=await pg.evaluate(()=>({ov:!!document.getElementById('affOv'),tip:(document.getElementById('affTip')||{style:{}}).style.display,events:(window.__affEv||[]).join(' ')})); }
    const t=await pg.evaluate(k=>{ const tip=document.getElementById('affTip'), box=document.getElementById('affBox').getBoundingClientRect(); if(!tip||tip.style.display==='none') return {shown:false};
      const r=tip.getBoundingClientRect(); const want=affTip(k);
      return {shown:true,title:tip.querySelector('b').textContent,text:tip.textContent.slice(tip.querySelector('b').textContent.length),want,inside:r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1}; },k);
    got[k]=t;
    const n=nums(t.text), need=en?NUMS[k]:nums(en?'':(await enTip(pg,k)));
    const hasNums=need.every(x=>n.includes(x))&&(!en||true);   /* every number of the rule is on the card (ja adds a '2' for 'these 2 elements') */
    C.ok(t.shown&&t.inside&&t.title===t.want[0]&&t.text===t.want[1]&&hasNums,tag+' '+(touch?'tap':'hover')+' '+k+': its rule card shows inside the chart with the numbers '+JSON.stringify(n),
      Object.assign({title:t.title,text:String(t.text||'').slice(0,140)},diag&&!t.shown?{diag}:{}));
  }
  return got;
}
const enTip=(pg,k)=>pg.evaluate(k=>{ const T=(key,v)=>{ let s=EW_LANG_EN[key]||''; for(const x in (v||{})) s=s.split('{'+x+'}').join(v[x]); return s; };
  if(Object.hasOwn(CLASS_BEATS,k)) return T('aff.'+k.toLowerCase()+'_d'); if(k==='Neutral') return T('aff.element_neutral'); if(k==='Light'||k==='Dark') return T('aff.element_mutual',{pct:20});
  return T('aff.element_cycle',{pct:20}); },k);
async function translated(pg,lang){
  const r=await pg.evaluate(lang=>{ const ov=document.getElementById('affOv'); const spans=[...ov.querySelectorAll('#affBox>span[aria-hidden]')].map(s=>s.textContent);
    const keys=['nav.affinities','aff.chart_classes','aff.chart_legend','aff.chart_elements'];
    const plates=[...ov.querySelectorAll('.affHit span')].map(s=>({k:s.parentElement.dataset.k,txt:s.textContent}));
    const en={}; for(const p of plates){ en[p.k]=Object.hasOwn(CLASS_BEATS,p.k)?(EW_LANG_EN['roster.class_'+p.k.toLowerCase()]||p.k):(EW_LANG_EN['aff.'+p.k.toLowerCase()+'_t']||p.k); }
    const script={ja:/[぀-ヿ一-鿿]/,th:/[฀-๿]/,de:/[A-Za-zÄÖÜäöüß]/}[lang];
    const vis=plates.length?(()=>{ const s=ov.querySelector('.affHit span').getBoundingClientRect(); return s.width>0&&s.height>0; })():false;
    return {cur:LANG.cur,headings:spans,want:keys.map(k=>t(k)),english:keys.map(k=>EW_LANG_EN[k]),plates,platesEnglish:plates.filter(p=>p.txt===en[p.k]).map(p=>p.k),
      scriptOk:spans.concat(plates.map(p=>p.txt)).filter(s=>script.test(s)).length,total:spans.length+plates.length,platesVisible:vis}; },lang);
  C.ok(r.cur===lang&&JSON.stringify(r.headings)===JSON.stringify(r.want)&&r.headings.every((h,i)=>h!==r.english[i]),lang+' chart headings in '+lang+', none left in English',{headings:r.headings,english:r.english});
  C.ok(r.plates.length===14&&r.platesVisible&&r.platesEnglish.length<=2&&r.scriptOk===r.total,lang+' the 14 class / element name plates on the art are in '+lang+' (English left: '+JSON.stringify(r.platesEnglish)+')',r.plates.map(p=>p.txt).join(' | '));
}

(async()=>{
  const {file}=H.seedDB(HEROES); const s=await H.server(file); let pg;
  try{
    // ---- desktop, English
    pg=await H.game(s.port,{w:1280,h:720});
    await heroCards(pg,'1280x720');
    await enemyCard(pg,'1280x720','campaign');
    await enemyCard(pg,'1280x720','vault');
    await button(pg,'1280x720');
    await chart(pg,'1280x720',false,'en');
    await ruleCards(pg,'1280x720',false,true);
    C.ok(pg._errs.length===0,'1280x720 no page errors',pg._errs.slice(0,3).map(e=>e.replace(/Error:/g,'Err')));
    await pg._ctx.close(); pg=null;
    // ---- phone landscape, English, touch
    pg=await H.game(s.port,{w:844,h:390,touch:true});
    await heroCards(pg,'phone 844x390');
    await button(pg,'phone 844x390');
    await chart(pg,'phone 844x390',true,'en');
    await ruleCards(pg,'phone 844x390',true,true);
    await pg._ctx.close(); pg=null;
    // ---- translated: German, Japanese, Thai
    for(const lang of ['de','ja','th']){
      pg=await H.game(s.port,{w:1280,h:720,lang});
      await button(pg,lang+' 1280x720');
      await chart(pg,lang+' 1280x720',false,lang);
      await translated(pg,lang);
      const tips=await ruleCards(pg,lang+' 1280x720',false,false);
      const eng=[]; for(const k in tips){ if(tips[k].shown&&tips[k].text===(await enTip(pg,k))&&tips[k].text) eng.push(k); }
      C.ok(eng.length===0,lang+' every rule card text is in '+lang+', none equal to the English',{english:eng,sample:(tips.Support||{}).text});
      C.ok(pg._errs.length===0,lang+' no page errors',pg._errs.slice(0,3).map(e=>e.replace(/Error:/g,'Err')));
      await pg._ctx.close(); pg=null;
    }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).replace(/Error:/g,'Err').slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
