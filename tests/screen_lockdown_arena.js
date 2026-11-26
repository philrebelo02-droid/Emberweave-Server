'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 10 - Arena (vault-arena-well.md, UNPROVEN-ON-SCREEN lines), in a real browser on this
   checkout's server (temp DB), the Arena opened from its town plate, 5 defenders set, 500 arena coins:
   - Title art: the painted ARENA title beside the Base button, no text title, at desktop / tablet / phone.
   - One-screen board: medal rail, defenders, the four tabs and the opponents on one screen, not covered, no scroll, at every size
     (phone, Fold, tablet, desktop, pop-out, full screen).
   - Arena Shop screen: painted title, framed items, price buttons (painted rail), coin balance, at desktop / tablet / phone.
   One screenshot per check per size (SHOT64 lines). Every check prints what it measured. Exit 0 = all passed. */
const fs=require('fs'), H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_arena.js', C=H.checker(TEST), shot=H.shooter(TEST);
const KEYS=['vael','aureth','sylthaine','vireo','brannus','lumi','umbris','grosk'];
const HEROES={}; KEYS.forEach(k=>HEROES[k]=40);
const COINS=500;
const press=(pg,touch,sel)=>touch?pg.tap(sel):pg.click(sel);

async function openArena(pg,S){
  const how=await H.openBuilding(pg,'arena',S.touch);
  await pg.waitForFunction(()=>document.getElementById('arena').classList.contains('active')&&document.querySelectorAll('#arenaOpps .arOpp').length>0,null,{timeout:40000}).catch(()=>{});
  await H.wait(1500);
  await pg.evaluate(async()=>{ const ims=[...document.querySelectorAll('#arena img')]; for(let k=0;k<80&&ims.some(i=>!i.complete);k++) await new Promise(r=>setTimeout(r,100)); });
  await H.wait(500); await H.prep(pg); return how; }

async function title(pg,S,how){
  const r=await pg.evaluate(async()=>{ const h=document.querySelector('#arena h1'), b=document.querySelector('#arena .backbtn'), cs=getComputedStyle(h), bg=await SL.bgLoaded(h);
    const hr=SL.R(h), br=SL.R(b), cy=x=>x.y+x.h/2;
    return {art:bg.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),ok:bg.length>0&&bg.every(x=>x.ok)&&bg.some(x=>/arena-title/.test(x.url)),font:cs.fontSize,
      title:hr,base:br,on:SL.inView(h),front:SL.front(h,.5,.5)||(()=>{ /* a see-through layout box (no fill, no picture) over the title hides nothing */ const t=document.elementFromPoint(hr.x+hr.w/2,hr.y+hr.h/2), c=t&&getComputedStyle(t); return !!c&&c.backgroundImage==='none'&&/rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor)&&!(t.childNodes&&[...t.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())); })(),who:SL.whoAt(h,.5,.5),baseOn:SL.inView(b)&&SL.front(b),gap:Math.round(hr.x-br.r),dy:Math.round(Math.abs(cy(hr)-cy(br))),overlap:SL.overlap(hr,br)}; });
  const s=await shot(pg,S.tag+' Title art');
  C.ok(r.ok&&parseFloat(r.font)===0&&r.on&&r.front&&r.baseOn&&!r.overlap&&r.gap>=-2&&r.gap<=60&&r.dy<=Math.max(r.base.h,20)&&r.title.w>=40,
    S.tag+' Title art: the painted ARENA title (arena-title.webp, loaded) sits beside the Base button (same row, '+r.gap+' px to its right, centres '+r.dy+' px apart), no text title [opened by '+how+']',
    {art:r.art,title:r.title,base:r.base,font:r.font,front:r.who,shot:s});
}

async function board(pg,S,how){
  await pg.waitForFunction(()=>document.querySelectorAll('#arenaOpps .arOpp').length>0,null,{timeout:30000}).catch(()=>{}); await H.wait(400);
  const r=await pg.evaluate(()=>{ const q=s=>[...document.querySelectorAll('#arena '+s)];
    const parts={medal:q('.arMedal'),dayRail:q('.arDay'),defenders:q('.arDefRow'),   /* the framed defenders panel (the .arDef layout box around it is wider than the frame and paints nothing) */defenderSlots:q('.arDefRow>.arHero'),tabs:q('.arTabs>button'),opponents:q('#arenaOpps .arOpp'),challenge:q('#arenaOpps .arOpp .btn')};
    const out={}, bad=[];
    for(const [k,els] of Object.entries(parts)){ out[k]=els.length; if(!els.length) bad.push(k+' missing');
      els.forEach((el,i)=>{ const on=k==='defenders'?(()=>{ const b=SL.R(el), v=SL.V(); return b.x>=-12&&b.y>=-12&&b.r<=v.width+12&&b.b<=v.height+12; })():SL.inView(el), fr=SL.front(el); if(!SL.vis(el)||!on||!fr) bad.push(k+'['+i+']'+(on?'':' off-screen '+JSON.stringify(SL.R(el)))+(fr?'':' covered by '+SL.whoAt(el))); }); }
    const scr=SL.scrolls(document.getElementById('arena')), body=SL.scrolls(document.getElementById('arenaBody')), doc=SL.scrolls(document.scrollingElement);
    return {counts:out,bad,scroll:scr,body,doc,view:SL.V(),boxes:{medal:SL.R('#arena .arMedal'),def:SL.R('#arena .arDef'),tabs:SL.R('#arena .arTabs'),opps:SL.R('#arenaOpps')}}; });
  const s=await shot(pg,S.tag+' One-screen board');
  C.ok(!r.bad.length&&r.counts.defenderSlots===5&&r.counts.tabs===4&&r.counts.opponents>=1&&!r.scroll.y&&!r.scroll.x&&!r.doc.y&&!r.doc.x,
    S.tag+' One-screen board: medal rail, defenders (5), the 4 tabs and '+r.counts.opponents+' opponents with Challenge all on one screen, not covered, no scroll [opened by '+how+']',
    {problems:r.bad.slice(0,8),counts:r.counts,scroll:r.scroll,doc:r.doc,view:r.view,boxes:r.boxes,shot:s});
}

async function shop(pg,S){
  await press(pg,S.touch,'#arenaShopBtn');
  await pg.waitForFunction(()=>document.getElementById('arenaShop').classList.contains('active')&&document.querySelectorAll('#arenaShopList>div').length>0,null,{timeout:30000}).catch(()=>{});
  await H.wait(1200); await H.prep(pg);
  const r=await pg.evaluate(async coins=>{ const h=document.querySelector('#arenaShop .titlebar h1'), cs=getComputedStyle(h), bg=await SL.bgLoaded(h);
    const bi=el=>((getComputedStyle(el).borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1]||null, bib=el=>((getComputedStyle(el,'::before').borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1]||null;
    const rows=[...document.querySelectorAll('#arenaShopList>div')], fr=rows[0]&&bi(rows[0]), frOk=fr?(await SL.loadImg(fr)).ok:false;
    const btns=rows.map(x=>x.querySelector('.btn')), rail=btns[0]&&bib(btns[0]), railOk=rail?(await SL.loadImg(rail)).ok:false;
    const panel=document.querySelector('#arenaShopBody>.panel'), pf=panel&&bi(panel), pfOk=pf?(await SL.loadImg(pf)).ok:false;
    const rowsOut=[]; for(const [i,row] of rows.entries()){ row.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,60)); const b=btns[i], rr=SL.R(row), br=SL.R(b);
      rowsOut.push({i,name:(row.querySelector('b')||{}).textContent,framed:bi(row)===fr,btnInRow:br.x>=rr.x-1&&br.r<=rr.r+1&&br.y>=rr.y-1&&br.b<=rr.b+1,price:/\d/.test(b.textContent),btnOn:SL.inView(b)&&SL.front(b),rowOn:SL.inView(row),rail:bib(b)===rail}); }
    panel.scrollIntoView({block:'center'}); document.getElementById('arenaShop').scrollTop=0; await new Promise(r=>setTimeout(r,100));
    const bal=panel.querySelector('b'), balTxt=bal?bal.textContent.replace(/[^0-9]/g,''):'';
    return {art:bg.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),ok:bg.length>0&&bg.every(x=>x.ok)&&bg.some(x=>/arena-shop-title/.test(x.url)),font:cs.fontSize,
      titleBox:SL.R(h),titleOn:SL.inView(h)&&SL.front(h),frame:fr&&fr.replace(location.origin,''),frOk,rail:rail&&rail.replace(location.origin,''),railOk,panelFrame:pf&&pf.replace(location.origin,''),pfOk,rows:rowsOut,
      balance:balTxt,balOn:!!bal&&SL.inView(bal),coinIcon:!!panel.querySelector('img[src*="arena-coins"],img[src*="arena_coins"]'),gc:G.arenaCoins}; },COINS);
  const s=await shot(pg,S.tag+' Arena Shop screen');
  C.ok(r.ok&&parseFloat(r.font)===0&&r.titleOn,S.tag+' Arena Shop screen: the painted ARENA SHOP title (arena-shop-title.webp, loaded) on screen, no text title',{art:r.art,box:r.titleBox,font:r.font,shot:s});
  const badRows=r.rows.filter(x=>!(x.framed&&x.btnInRow&&x.price&&x.btnOn&&x.rowOn&&x.rail));
  C.ok(r.frOk&&/market-item-frame/.test(r.frame||'')&&r.railOk&&/market-price-rail/.test(r.rail||'')&&r.rows.length>0&&!badRows.length,
    S.tag+' Arena Shop screen: all '+r.rows.length+' items in their painted frame (market-item-frame), each with its price button (painted price rail) inside the frame, on screen when scrolled to',
    {frame:r.frame,rail:r.rail,panelFrame:r.panelFrame,bad:badRows,items:r.rows.map(x=>x.name),shot:s});
  const s2=await shot(pg,S.tag+' Arena Shop coin balance');
  C.ok(r.balance===String(COINS)&&r.balOn&&r.coinIcon,S.tag+' Arena Shop screen: the coin balance shows '+r.balance+' arena coins (seeded '+COINS+') with the coin icon, on screen',{shown:r.balance,G:r.gc,icon:r.coinIcon,shot:s2});
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.team=KEYS.slice(0,5); u.arenaDef=KEYS.slice(0,5); u.coins=COINS; });
  /* the live ladder has 5,000 bot players; the server seeds them on boot when the DB carries no seed version */
  { const db=JSON.parse(fs.readFileSync(file,'utf8')); delete db.seeded; delete db.seedVersion; fs.writeFileSync(file,JSON.stringify(db)); }
  const s=await H.server(file); let pg=null;
  const PLAN=[['desktop',{title:1,board:1,shop:1}],['popout',{board:1}],['full',{board:1}],['tablet',{title:1,board:1,shop:1}],['fold',{board:1}],['phone',{title:1,board:1,shop:1}]];
  try{
    for(const [k,do_] of PLAN){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      await pg.evaluate(keys=>{ if(!G.arenaDef||!G.arenaDef.filter(Boolean).length){ G.arenaDef=keys.slice(); try{ saveG(); }catch(e){} } },KEYS.slice(0,5));
      try{ const how=await openArena(pg,S);
        if(do_.title) await title(pg,S,how);
        if(do_.board) await board(pg,S,how);
        if(do_.shop) await shop(pg,S);
      }catch(e){ C.ok(false,S.tag+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; await H.closeBrowser(); }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
