'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 14 - Academy (forge-academy-pool.md, UNPROVEN-ON-SCREEN):
   - Academy screen: at all sizes the hall art, the title art, eight labelled track cards and the Academy centre (grimoire) are all visible,
     nothing overlapping.
   - Compact layout: phone landscape, Fold cover and a short desktop window: every track card fully visible, the detail card covers no track.
   Opened from its town plate. One screenshot per check per size (SHOT64 lines). Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_academy.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:30,aureth:30,sylthaine:30,vireo:30,brannus:30};

async function measure(pg){ await H.prep(pg); return pg.evaluate(async()=>{ const scr=document.getElementById('tech'), h1=scr.querySelector('h1');
  const title=await SL.bgLoaded(h1), hall=await SL.bgLoaded(scr);
  const nodes=[...scr.querySelectorAll('.ac-tracks .tw-node')], cen=document.getElementById('twAcademy'), gim=cen&&cen.querySelector('img'), det=scr.querySelector('.tw-detail');
  const g=gim?await SL.imgOk(gim):{ok:false};
  /* fully visible = inside the view and the card itself is what is hit at its centre and four inner corners */
  const pts=[[.5,.5],[.15,.15],[.85,.15],[.15,.85],[.85,.85]];
  const card=el=>({name:SL.txt(el.querySelector('.tw-name')),box:SL.R(el),on:SL.inView(el),front:pts.every(([x,y])=>SL.front(el,x,y)),hit:pts.map(([x,y])=>SL.front(el,x,y)?1:SL.whoAt(el,x,y))});
  const cards=nodes.map(card), dr=det?SL.R(det):null, cr=cen?SL.R(cen):null, tr=SL.R(h1);
  const over=[]; const boxes=[['title',tr],['centre',cr],['detail',dr]].concat(cards.map((c,i)=>['card'+(i+1)+' '+c.name,c.box]));
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) if(boxes[i][1]&&boxes[j][1]&&SL.overlap(boxes[i][1],boxes[j][1])) over.push(boxes[i][0]+' x '+boxes[j][0]);
  return {active:scr.classList.contains('active'),title:title.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),titleOk:title.some(x=>x.ok&&/academy-wordmark/.test(x.url))&&title.every(x=>x.ok),
    titleFont:getComputedStyle(h1).fontSize,titleBox:tr,titleOn:SL.inView(h1),titleFront:SL.front(h1),
    hall:hall.map(x=>x.url.replace(location.origin,'').slice(0,80)+(x.ok?' ok':' NOT LOADED')),hallOk:hall.some(x=>x.ok&&/academy-hall/.test(x.url)),
    cards,centre:cr,centreOn:cen?SL.inView(cen):false,centreFront:cen?SL.front(cen):false,centreLbl:cen?SL.txt(cen.querySelector('.tw-lbl')):'',grimoire:g,
    detail:dr,detailOn:det?SL.inView(det):false,detailOverCards:cards.filter(c=>dr&&SL.overlap(c.box,dr)).map(c=>c.name),over,
    screenScroll:SL.scrolls(scr)}; }); }

async function check(pg,S,compact){
  const how=await H.openBuilding(pg,'tech',S.touch);
  await pg.waitForFunction(()=>document.getElementById('tech').classList.contains('active')&&document.querySelectorAll('#tech .tw-node').length>=8,null,{timeout:40000}).catch(()=>{});
  await H.wait(1500);
  const r=await measure(pg);
  const s=await shot(pg,S.tag+' academy');
  const named=r.cards.filter(c=>c.name&&c.name.length>1).length;
  if(!compact){
    C.ok(r.active&&r.hallOk,S.tag+' Academy screen: the sunset hall art is behind the screen (loaded) [opened by '+how+']',{hall:r.hall,shot:s});
    C.ok(r.titleOk&&parseFloat(r.titleFont)===0&&r.titleOn&&r.titleFront,S.tag+' Academy screen: the painted ACADEMY title art is loaded, on screen and not covered (no text title)',{title:r.title,box:r.titleBox,font:r.titleFont,front:r.titleFront,shot:s});
    C.ok(r.cards.length===8&&named===8&&r.cards.every(c=>c.on&&c.front),S.tag+' Academy screen: eight labelled research cards, each fully on screen and not covered',
      {n:r.cards.length,cards:r.cards.map(c=>c.name+' '+c.box.w+'x'+c.box.h+'@'+c.box.x+','+c.box.y+(c.on?'':' OFF-SCREEN')+(c.front?'':' COVERED '+JSON.stringify(c.hit))),shot:s});
    C.ok(r.grimoire.ok&&/academy-grimoire/.test(r.grimoire.src||'')&&r.centreOn&&r.centreFront&&!!r.centreLbl,S.tag+' Academy screen: the Academy centre (grimoire art loaded, label "'+r.centreLbl+'") is on screen and not covered',
      {grimoire:r.grimoire,box:r.centre,shot:s});
    C.ok(r.over.length===0,S.tag+' Academy screen: nothing overlaps (title, centre, detail card and the eight cards each have their own space)',{overlaps:r.over,detail:r.detail,shot:s});
  } else {
    C.ok(r.cards.length===8&&r.cards.every(c=>c.on&&c.front),S.tag+' Compact layout: every one of the 8 track cards is fully visible (on screen, centre and four corners not covered)',
      {cards:r.cards.map(c=>c.name+' '+c.box.w+'x'+c.box.h+'@'+c.box.x+','+c.box.y+(c.on?'':' OFF-SCREEN')+(c.front?'':' COVERED '+JSON.stringify(c.hit))),shot:s});
    C.ok(!!r.detail&&r.detailOverCards.length===0,S.tag+' Compact layout: the detail card covers no track card',{detail:r.detail,detailOn:r.detailOn,covers:r.detailOverCards,shot:s});
  }
}

(async()=>{
  const {file}=H.seedDB(HEROES); const s=await H.server(file); let pg=null;
  try{
    for(const [k,compact] of [['desktop',false],['popout',false],['full',false],['tablet',false],['fold',false],['phone',false],['phone',true],['fold',true],['short',true]]){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      try{ await check(pg,S,compact); }catch(e){ C.ok(false,S.tag+(compact?' compact':'')+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
