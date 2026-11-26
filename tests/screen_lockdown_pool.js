'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 11 - Wishing Pool (forge-academy-pool.md, UNPROVEN-ON-SCREEN):
   - Pool stage: at all sizes the stage fits the screen, the title is the painted art (no text over it), three cards in their painted frames,
     the pool orbs float.
   - Fits small screens: phone, Fold cover, tablet: the three cards and both buttons of each card on screen; a single wish result and the
     x10 result grid fully on screen.
   Opened from its town plate. One screenshot per check per size (SHOT64 lines). Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_pool.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:30,aureth:30,sylthaine:30,vireo:30,brannus:30};

async function openPool(pg,S){ const how=await H.openBuilding(pg,'wishing',S.touch);
  await pg.waitForFunction(()=>document.getElementById('wishing').classList.contains('active')&&document.querySelectorAll('#wpsStage .wpsCard').length===3&&!document.getElementById('wpGold').disabled,null,{timeout:40000}).catch(()=>{});
  await H.wait(1500); await H.prep(pg); return how; }

async function stage(pg,S){
  const how=await openPool(pg,S);
  const r=await pg.evaluate(async()=>{ const st=document.getElementById('wpsStage'), ti=st.querySelector('.wpsTitle'), bcs=getComputedStyle(ti,'::before');
    const tu=((bcs.backgroundImage||'').match(/url\(["']?([^"')]+)/)||[])[1], tImg=tu?await SL.loadImg(tu):null;
    const tText=[...ti.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
    const cards=[...st.querySelectorAll('.wpsCard')], out=[];
    for(const c of cards){ const cs=getComputedStyle(c), fu=((cs.borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1], f=fu?await SL.loadImg(fu):null, orb=c.querySelector('.wpsOrb'), o=await SL.imgOk(orb);
      out.push({cls:c.className.replace('wpsCard','').trim(),box:SL.R(c),on:SL.inView(c),frame:fu?fu.replace(location.origin,''):null,frameOk:!!(f&&f.ok),orb:o,orbAnim:getComputedStyle(orb).animationName,orbState:getComputedStyle(orb).animationPlayState}); }
    const ty=()=>cards.map(c=>{ const m=getComputedStyle(c.querySelector('.wpsOrb')).transform; const p=m&&m!=='none'?m.match(/-?[\d.]+/g).map(Number):[1,0,0,1,0,0]; return Math.round(p[5]*100)/100; });
    const y0=ty(); await new Promise(r=>setTimeout(r,1050)); const y1=ty(); await new Promise(r=>setTimeout(r,1050)); const y2=ty();
    return {stage:SL.R(st),stageOn:SL.inView(st),ratio:Math.round(st.getBoundingClientRect().width/st.getBoundingClientRect().height*1000)/1000,tall:st.classList.contains('tall'),
      title:tu?tu.replace(location.origin,''):null,titleOk:!!(tImg&&tImg.ok)&&/wishing-pool-title/.test(tu||''),titleFont:getComputedStyle(ti).fontSize,titleText:tText,titleBox:SL.R(ti),titleOn:SL.inView(ti),
      cards:out,y0,y1,y2}; });
  const s=await shot(pg,S.tag+' pool stage');
  C.ok(r.stageOn,S.tag+' Pool stage: the stage fits the screen (whole stage on screen) [opened by '+how+']',{stage:r.stage,ratio:r.ratio,tall:r.tall,shot:s});
  C.ok(r.titleOk&&parseFloat(r.titleFont)===0&&r.titleOn,S.tag+' Pool stage: the title is the painted WISHING POOL art, loaded and on screen; no text drawn over it (font size 0)',{title:r.title,font:r.titleFont,text:r.titleText,box:r.titleBox,shot:s});
  C.ok(r.cards.length===3&&r.cards.every(c=>c.frameOk&&/guild-ornate-panel/.test(c.frame||'')&&c.on&&c.orb.ok),S.tag+' Pool stage: three pool cards, each in its painted frame (frame art loaded), on screen, with its pool orb art',
    r.cards.map(c=>c.cls+' '+c.box.w+'x'+c.box.h+'@'+c.box.x+','+c.box.y+' frame '+(c.frameOk?'ok':'MISSING')+' orb '+(c.orb.ok?'ok':'MISSING')+(c.on?'':' OFF-SCREEN')).concat(['shot '+s]));
  const moved=r.cards.map((c,i)=>Math.max(Math.abs(r.y0[i]-r.y1[i]),Math.abs(r.y1[i]-r.y2[i]),Math.abs(r.y0[i]-r.y2[i])));
  C.ok(r.cards.every(c=>c.orbAnim==='poolfloat'&&c.orbState==='running')&&moved.every(m=>m>0.5),S.tag+' Pool stage: the three pool orbs float (poolfloat running, each orb moved up/down over 2 s)',{anim:r.cards.map(c=>c.orbAnim+'/'+c.orbState),y:[r.y0,r.y1,r.y2],moved,shot:s});
}

const fully=(pg,sel)=>pg.evaluate(sel=>{ const pts=[[.5,.5],[.1,.2],[.9,.2],[.1,.8],[.9,.8]]; return [...document.querySelectorAll(sel)].map(el=>({t:SL.txt(el).slice(0,40),box:SL.R(el),on:SL.inView(el),front:pts.every(([x,y])=>SL.front(el,x,y))})); },sel);

async function small(pg,S){
  await openPool(pg,S);
  const cards=await fully(pg,'#wpsStage .wpsCard'), btns=await pg.evaluate(()=>[...document.querySelectorAll('#wpsStage .wpsCard')].map(c=>c.querySelectorAll(':scope>.btn').length));
  const bt=await fully(pg,'#wpsStage .wpsCard>.btn');
  const s1=await shot(pg,S.tag+' pool cards');
  C.ok(cards.length===3&&cards.every(c=>c.on),S.tag+' Fits small screens: the three pool cards are on screen',{cards:cards.map(c=>c.box.w+'x'+c.box.h+'@'+c.box.x+','+c.box.y+(c.on?'':' OFF-SCREEN')),shot:s1});
  C.ok(btns.every(n=>n===2)&&bt.length===6&&bt.every(b=>b.on&&b.front),S.tag+' Fits small screens: both buttons of every card (Wish and 10 Wishes) are fully on screen and not covered',
    {perCard:btns,buttons:bt.map(b=>b.t+' '+b.box.w+'x'+b.box.h+'@'+b.box.x+','+b.box.y+(b.on?'':' OFF-SCREEN')+(b.front?'':' COVERED')),shot:s1});
  /* a single wish (the Gold Pool's free wish, or 1,000 gold) */
  if(S.touch) await pg.tap('#wpGold'); else await pg.click('#wpGold');
  await pg.waitForFunction(()=>!!document.getElementById('_wishOk'),null,{timeout:30000}).catch(()=>{}); await H.wait(1200); await H.prep(pg);
  const one=await pg.evaluate(()=>{ const ok=document.getElementById('_wishOk'); if(!ok) return {shown:false}; const box=ok.parentElement, again=document.getElementById('_wishAgain');
    return {shown:true,box:SL.R(box),boxOn:SL.inView(box),scroll:SL.scrolls(box),ok:SL.inView(ok)&&SL.front(ok),again:again?SL.inView(again)&&SL.front(again):null,text:SL.txt(box).slice(0,120)}; });
  const s2=await shot(pg,S.tag+' single wish result');
  C.ok(one.shown&&one.boxOn&&!one.scroll.y&&one.ok&&one.again!==false,S.tag+' Fits small screens: the single wish result is fully on screen (card, Collect and Wish Again visible, nothing to scroll)',{...one,shot:s2});
  await pg.evaluate(()=>{ const b=document.getElementById('_wishOk'); if(b) b.click(); }); await H.wait(800);
  await pg.waitForFunction(()=>!document.getElementById('wpGold10').disabled,null,{timeout:20000}).catch(()=>{});
  if(S.touch) await pg.tap('#wpGold10'); else await pg.click('#wpGold10');
  await pg.waitForFunction(()=>!!document.getElementById('_w10Ok'),null,{timeout:30000}).catch(()=>{}); await H.wait(2600); await H.prep(pg);
  const ten=await pg.evaluate(()=>{ const ok=document.getElementById('_w10Ok'); if(!ok) return {shown:false}; const box=ok.parentElement, cards=[...box.querySelectorAll('.w10card')], again=document.getElementById('_w10Again');
    return {shown:true,box:SL.R(box),boxOn:SL.inView(box),scroll:SL.scrolls(box),n:cards.length,cardsOn:cards.filter(c=>SL.inView(c)).length,ok:SL.inView(ok)&&SL.front(ok),again:again?SL.inView(again)&&SL.front(again):null,
      off:cards.map((c,i)=>SL.inView(c)?null:i+1+':'+JSON.stringify(SL.R(c))).filter(Boolean)}; });
  const s3=await shot(pg,S.tag+' x10 wish results');
  C.ok(ten.shown&&ten.n===10&&ten.cardsOn===10&&ten.boxOn&&!ten.scroll.y&&ten.ok&&ten.again!==false,S.tag+' Fits small screens: the x10 result grid is fully on screen (10 of 10 cards, Collect All and Wish Again visible, nothing to scroll)',{...ten,shot:s3});
  await pg.evaluate(()=>{ const b=document.getElementById('_w10Ok'); if(b) b.click(); });
}

(async()=>{
  const {file}=H.seedDB(HEROES); const s=await H.server(file); let pg=null;
  try{
    for(const [k,part] of [['desktop','stage'],['popout','stage'],['full','stage'],['tablet','stage'],['fold','stage'],['phone','stage'],['phone','small'],['fold','small'],['tablet','small']]){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      try{ if(part==='stage') await stage(pg,S); else await small(pg,S); }catch(e){ C.ok(false,S.tag+' '+part+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
