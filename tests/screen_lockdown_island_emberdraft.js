'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 13 - Island of Trials (island-13.md, UNPROVEN-ON-SCREEN), part 2: Emberdraft.
   A Lv 25 account; the lobby opened from the island's Emberdraft label; a real match started with PLAY (the server spends an attempt).
   - Title screen: wordmark, Play, 10 tray portraits, 6 reward plates, 3 lit attempt pips, all inside the screen (desktop + phone).
   - Players panel: 844x390 = a side tab that opens the list on a tap; 1280x800 = open from the start.
   - Drag to buy: round 2, shop card 1 dragged onto an empty board tile -> that hero on that tile, gold - cost; a tap on shop card 2 -> bench.
   - Drag a hero: mid-drag the hero's idle figure is under the finger; a second finger during the drag moves nothing (phone, real touches).
   - Hero info panel: tap a board hero -> HP / attack numbers and its item; tap the item -> its stats and recipe lines.
   - Your avatar: tap empty ground -> the avatar walks there; tap an orb -> it walks over it and the gold rises.
   - Rank insignia: 1/2/3/4 star copies of one hero: 1, 2, 3 chevrons and a star read from the overlay pixels, the health bar above each.
   - Rival avatar: in a PvP fight the rival's avatar stands by the far bench with the rival's name tag; none in a monster round.
   The opening carousel is finished with the page's own edCarFinish and round 1 is followed by the page's own edNextRound (round 2), and
   round 3 by edNextRound (round 4 = PvP); everything checked is the real planning / fight screen. One screenshot per check (SHOT64 lines). */
const fs=require('fs'),path=require('path');
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_island_emberdraft.js', C=H.checker(TEST), shot=H.shooter(TEST);
const INC=JSON.parse(/const D_TROOP_INC=(\[[^\]]+\])/.exec(fs.readFileSync(path.join(H.ROOT,'server.js'),'utf8'))[1]);
const pxFor=L=>{ let x=0; for(let i=0;i<L-1;i++) x+=INC[i]; return x; };
const HEROES={vael:30,aureth:30,brannus:30,sylthaine:30,vireo:30};
const DESK800={w:1280,h:800,touch:false,tag:'desktop 1280x800'};
const press=(pg,touch,sel)=>touch?pg.tap(sel,{timeout:10000}):pg.click(sel,{timeout:10000});

async function openLobby(pg,S){
  await H.openBuilding(pg,'skyisland',S.touch);
  await pg.waitForFunction(()=>document.querySelectorAll('#skyIslandBody .islespot').length===3,null,{timeout:30000}).catch(()=>{});
  await H.wait(800);
  await press(pg,S.touch,'#skyIslandBody .islespot[data-if="emberdraft"]>div');
  await pg.waitForFunction(()=>document.getElementById('edLobby')&&document.querySelectorAll('#edAtt .edl-pip').length>0&&!document.getElementById('edSolo').disabled,null,{timeout:40000}).catch(()=>{});
  await H.wait(2500); await H.clean(pg); await H.prep(pg); }

async function titleScreen(pg,S){
  await openLobby(pg,S);
  const r=await pg.evaluate(async()=>{ const L=document.getElementById('edLobby'); if(!L) return {lobby:false};
    const logo=L.querySelector('.edl-logo'), lg=await SL.bgLoaded(logo), play=document.getElementById('edSolo'), strip=document.getElementById('edAvStrip'), tray=await SL.bgLoaded(strip);
    const ports=[]; for(const b of strip.querySelectorAll('button')){ const o=await SL.imgOk(b.querySelector('img')); ports.push({k:b.dataset.av,ok:o.ok,on:SL.inView(b),front:SL.front(b)}); }
    const plates=[...L.querySelectorAll('.edl-reward')].map(p=>({t:SL.txt(p),on:SL.inView(p),box:SL.R(p)})), plBg=plates.length?await SL.bgLoaded(L.querySelector('.edl-reward')):[];
    return {lobby:true,lv:playerLevel(),logo:lg.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),logoOk:lg.some(x=>x.ok&&/emberdraft-wordmark/.test(x.url)),logoBox:SL.R(logo),logoOn:SL.inView(logo),
      play:{text:SL.txt(play),on:SL.inView(play),front:SL.front(play),disabled:play.disabled,box:SL.R(play)},trayOk:tray.some(x=>x.ok&&/avatar-tray/.test(x.url)),trayOn:SL.inView(strip),ports,
      plates,plateArt:plBg.some(x=>x.ok),pipsOn:L.querySelectorAll('#edAtt .edl-pip.on').length,pips:L.querySelectorAll('#edAtt .edl-pip').length,att:SL.txt('#edAtt'),pipsBox:SL.R('#edAtt'),pipsIn:SL.inView('#edAtt')}; });
  const s=await shot(pg,S.tag+' emberdraft title screen');
  const vals=['36','30','24','18','12','6'];
  C.ok(r.lobby&&r.logoOk&&r.logoOn&&r.play.on&&r.play.front&&!r.play.disabled&&r.trayOk&&r.trayOn&&r.ports.length===10&&r.ports.every(p=>p.ok&&p.on)&&r.plates.length===6&&r.plates.every((p,i)=>p.on&&p.t.endsWith(vals[i]))&&r.plateArt&&r.pipsOn===3&&r.pipsIn,
    S.tag+' Title screen: wordmark, Play, 10 tray portraits, 6 reward plates (36/30/24/18/12/6) and 3 lit pips, all inside the screen [Lv '+r.lv+']',
    {logo:r.logo,logoBox:r.logoBox,play:r.play,tray:r.trayOk,portraits:r.ports&&r.ports.map(p=>p.k+(p.ok?'':' NO-ART')+(p.on?'':' OFF')),plates:r.plates,pips:r.pipsOn+'/'+r.pips,att:r.att,pipsBox:r.pipsBox,shot:s});
}

/* ---- a real match up to round 2 planning ---- */
async function startMatch(pg,S){
  await openLobby(pg,S);
  await press(pg,S.touch,'#edSolo');
  await pg.waitForFunction(()=>window.ED&&ED.active&&ED.phase==='carousel'&&ED.car,null,{timeout:90000});
  await H.wait(2000);
  await pg.evaluate(()=>edCarFinish());
  await pg.waitForFunction(()=>ED.phase==='plan'&&ED.round===1&&!ED.car,null,{timeout:30000});
  await H.wait(800);
  await pg.evaluate(()=>edNextRound());
  await pg.waitForFunction(()=>ED.phase==='plan'&&ED.round===2&&document.querySelector('#edRoot .shopb [data-buy]'),null,{timeout:30000});
  await H.wait(2500); await H.clean(pg); await H.prep(pg);
  /* page-side helpers for the board */
  await pg.evaluate(()=>{ window.EDT={
    tile:slot=>{ const q=edBoardQuads().find(b=>b.slot===slot); if(!q) return null; return {x:q.q.reduce((a,p)=>a+p.x,0)/4,y:q.q.reduce((a,p)=>a+p.y,0)/4}; },
    emptyTile:(prefer)=>{ const you=edYou(); for(const s of prefer){ if(!you.board[s]) return 'b:'+s; } for(let r=0;r<ED_ROWS;r++) for(let c=0;c<ED_COLS;c++){ if(!you.board[r+','+c]) return 'b:'+r+','+c; } return null; },
    unitOf:id=>units.find(u=>u._edId===id&&u.alive),
    body:id=>{ const u=units.find(q=>q._edId===id&&q.alive); if(!u) return null; const p=edScreen(u.x,u.y,Math.max(0.3,(u.sprH||1.6)*0.55)); return {x:p.x,y:p.y}; },
    snap:()=>{ const you=edYou(); return {gold:you.gold,board:Object.fromEntries(Object.entries(you.board).map(([p,u])=>[p,u.key+'#'+u.id+'*'+u.rank])),bench:you.bench.map(u=>u?u.key+'#'+u.id+'*'+u.rank:null),shop:you.shop.slice()}; } }; });
}

/* one pointer drag: desktop = the mouse, phone = real touches through the DevTools protocol */
async function dragSteps(pg,touch,cdp,from,to,mid){ const N=14;
  if(touch){ await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]}); }
  else { await pg.mouse.move(from.x,from.y); await pg.mouse.down(); }
  let midOut=null;
  for(let i=1;i<=N;i++){ const x=from.x+(to.x-from.x)*i/N, y=from.y+(to.y-from.y)*i/N;
    if(touch) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y,id:1}]}); else await pg.mouse.move(x,y);
    await H.wait(40); if(i===Math.round(N/2)&&mid) midOut=await mid({x,y}); }
  await H.wait(150);
  if(touch) await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); else await pg.mouse.up();
  await H.wait(800); return midOut; }

async function match(pg,S){
  const cdp=S.touch?await pg._ctx.newCDPSession(pg):null;
  await startMatch(pg,S);
  /* ---- Players panel ---- */
  { const r=await pg.evaluate(()=>({h:ewGameView().height,min:ED.sideMin,tab:!!document.querySelector('#edRoot .sideTab'),tabOn:SL.inView('#edRoot .sideTab'),panel:!!document.querySelector('#edRoot .sidep:not(.heroP)'),rows:document.querySelectorAll('#edRoot .sidep .prow').length,panelOn:SL.inView('#edRoot .sidep')}));
    const s1=await shot(pg,S.tag+' players panel at start');
    if(S.h<450){
      C.ok(r.min===true&&r.tab&&r.tabOn&&!r.panel,S.tag+' Players panel: on the short screen ('+r.h+' px) it starts folded into a side tab',{...r,shot:s1});
      await press(pg,S.touch,'#edRoot .sideTab'); await H.wait(800);
      const o=await pg.evaluate(()=>({min:ED.sideMin,rows:[...document.querySelectorAll('#edRoot .sidep .prow')].map(x=>SL.txt(x)),on:SL.inView('#edRoot .sidep .panel'),tab:!!document.querySelector('#edRoot .sideTab')}));
      const s2=await shot(pg,S.tag+' players panel opened by its tab');
      C.ok(o.min===false&&o.rows.length===8&&o.on&&!o.tab,S.tag+' Players panel: a tap on the side tab opens the list of all 8 players',{...o,shot:s2});
      await press(pg,S.touch,'#edRoot .sideFold'); await H.wait(600);
    } else {
      C.ok(r.min===false&&!r.tab&&r.panel&&r.rows===8&&r.panelOn,S.tag+' Players panel: on a '+r.h+' px tall screen the players list starts open (8 players, no side tab)',{...r,shot:s1});
    }
  }
  /* ---- Drag to buy ---- */
  const before=await pg.evaluate(()=>EDT.snap());
  const k0=before.shop[0], k1=before.shop[1];
  const tileSlot=await pg.evaluate(()=>EDT.emptyTile(['1,6','1,7','2,6']));
  const card0=await pg.evaluate(()=>{ const r=document.querySelector('#edRoot [data-buy="0"]').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  const tile=await pg.evaluate(s=>EDT.tile(s),tileSlot);
  const cost0=await pg.evaluate(k=>edCost(k),k0), cost1=await pg.evaluate(k=>edCost(k),k1);
  let midShot=null;
  const mid0=await dragSteps(pg,S.touch,cdp,card0,tile,async p=>{ const g=await pg.evaluate(()=>{ const d=document.getElementById('edDrag'); if(!d) return null; const r=d.getBoundingClientRect(); return {k:d.dataset.k,cls:d.className,box:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}}; });
    midShot=await shot(pg,S.tag+' drag to buy mid-drag'); return {finger:p,ghost:g}; });
  await H.wait(600);
  const after=await pg.evaluate(()=>EDT.snap());
  const placed=after.board[tileSlot.slice(2)];
  const s3=await shot(pg,S.tag+' drag to buy dropped');
  C.ok(!!k0&&!!placed&&placed.startsWith(k0+'#')&&after.gold===before.gold-cost0,S.tag+' Drag to buy: shop card 1 ('+k0+', '+cost0+' gold) dragged onto empty tile '+tileSlot+' -> the hero stands on that tile, gold '+before.gold+' -> '+after.gold,
    {mid:mid0,placed,boardBefore:before.board,boardAfter:after.board,shot:[midShot,s3]});
  /* tap shop card 2 -> bench */
  const benchN0=after.bench.filter(Boolean).length;
  await press(pg,S.touch,'#edRoot [data-buy="1"]'); await H.wait(900);
  const after2=await pg.evaluate(()=>EDT.snap());
  const s4=await shot(pg,S.tag+' tap buys to bench');
  const newOnBench=after2.bench.filter(Boolean).filter(x=>!after.bench.includes(x));
  C.ok(!!k1&&after2.gold===after.gold-cost1&&newOnBench.length===1&&newOnBench[0].startsWith(k1+'#')&&Object.keys(after2.board).length===Object.keys(after.board).length,S.tag+' Drag to buy: a tap on shop card 2 ('+k1+') buys it to the bench, gold '+after.gold+' -> '+after2.gold,
    {benchBefore:benchN0,new:newOnBench,shot:s4});
  /* ---- Drag a hero (a benched one) ---- */
  { const snap=await pg.evaluate(()=>EDT.snap());
    const hid=await pg.evaluate(()=>{ const you=edYou(); const h=you.bench.find(Boolean); return h?{id:h.id,key:h.key}:null; });
    const from=await pg.evaluate(id=>EDT.body(id),hid&&hid.id);
    const dest=await pg.evaluate(()=>EDT.emptyTile(['2,4','2,5','2,3']));
    const to=await pg.evaluate(s=>EDT.tile(s),dest);
    let second=null, midS=null;
    const mid=await dragSteps(pg,S.touch,cdp,from,to,async p=>{
      const g=await pg.evaluate(()=>{ const d=document.getElementById('edDrag'); if(!d) return null; const r=d.getBoundingClientRect(); let px=0; try{ const c=d.getContext&&d.getContext('2d'); if(c){ const im=c.getImageData(0,0,d.width,d.height).data; for(let i=3;i<im.length;i+=4) if(im[i]>40) px++; } }catch(e){ px=-1; }
        return {k:d.dataset.k,tag:d.tagName,cls:d.className,painted:px,box:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)},n:document.querySelectorAll('#edDrag').length}; });
      midS=await shot(pg,S.tag+' drag a hero mid-drag');
      if(S.touch){ /* a second finger lands on the shop and drags across the board while the first one holds the hero */
        const shopP=await pg.evaluate(()=>{ const r=document.querySelector('#edRoot [data-buy="2"]')||document.querySelector('#edRoot .shopb'); const b=r.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}; });
        const other=await pg.evaluate(()=>EDT.tile(EDT.emptyTile(['0,10','0,11','1,11'])));
        const s0=await pg.evaluate(()=>EDT.snap());
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1},{x:shopP.x,y:shopP.y,id:2}]});
        for(let i=1;i<=8;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y,id:1},{x:shopP.x+(other.x-shopP.x)*i/8,y:shopP.y+(other.y-shopP.y)*i/8,id:2}]}); await H.wait(40); }
        const g2=await pg.evaluate(()=>{ const d=document.getElementById('edDrag'); if(!d) return null; const r=d.getBoundingClientRect(); return {k:d.dataset.k,box:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)},n:document.querySelectorAll('#edDrag').length}; });
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:p.x,y:p.y,id:1}]}); await H.wait(300);
        const s1=await pg.evaluate(()=>EDT.snap());
        second={before:s0,after:s1,ghost:g2,secondFinger:{from:shopP,to:other}}; }
      return {finger:p,ghost:g}; });
    await H.wait(600);
    const end=await pg.evaluate(()=>EDT.snap());
    const s5=await shot(pg,S.tag+' drag a hero dropped');
    const g=mid&&mid.ghost, f=mid&&mid.finger;
    const under=!!g&&!!f&&f.x>=g.box.x-2&&f.x<=g.box.x+g.box.w+2&&f.y>=g.box.y-2&&f.y<=g.box.y+g.box.h+2;
    C.ok(!!hid&&!!g&&g.n===1&&g.k===hid.key&&/edDragSpr/.test(g.cls)&&g.tag==='CANVAS'&&g.painted>200&&under,S.tag+' Drag a hero: mid-drag the hero\'s idle figure ('+(hid&&hid.key)+', a painted '+(g&&g.box.w)+'x'+(g&&g.box.h)+' figure, '+(g&&g.painted)+' px) is under the finger',{hero:hid,mid,shot:midS});
    const moved=end.board[dest.slice(2)];
    C.ok(!!moved&&moved.startsWith(hid.key+'#'+hid.id),S.tag+' Drag a hero: dropped on tile '+dest+', the hero stands there',{dest,boardAfter:end.board,benchAfter:end.bench.filter(Boolean),shot:s5});
    if(S.touch){ const sc=second||{}; const same=sc.before&&sc.after&&JSON.stringify(sc.before)===JSON.stringify(sc.after);
      const ghostKept=!!(sc.ghost&&g&&sc.ghost.n===1&&sc.ghost.k===g.k&&Math.abs(sc.ghost.box.x-g.box.x)<=3&&Math.abs(sc.ghost.box.y-g.box.y)<=3);
      const onlyOne=snap&&end&&Object.keys(end.board).length===Object.keys(snap.board).length+1&&end.gold===snap.gold;
      C.ok(same&&ghostKept&&onlyOne,S.tag+' Drag a hero: a second finger during the drag (from the shop across the board) moves nothing - no buy, no move, the carried figure stays under the first finger',{second:sc.secondFinger,ghost:sc.ghost,first:g&&g.box,changed:!same,goldBefore:snap.gold,goldAfter:end.gold,shot:midS}); }
  }
  /* ---- Hero info panel ---- */
  { const hid=await pg.evaluate(()=>{ const you=edYou(); const e=Object.entries(you.board)[0]; if(!e) return null; const h=e[1]; if(!(h.items||[]).length) h.items.push({c:'Weapon'}); ED._fieldSig=null; edRender(); return {id:h.id,key:h.key}; });
    await H.wait(1000);
    const p=await pg.evaluate(id=>EDT.body(id),hid.id);
    if(S.touch) await pg.touchscreen.tap(p.x,p.y); else await pg.mouse.click(p.x,p.y);
    await H.wait(900);
    const r=await pg.evaluate(id=>{ const P=document.querySelector('#edRoot .heroP'); if(!P) return {panel:false,sel:ED.sel};
      const you=edYou(), h=edUnits(you).find(u=>u.id===id), u=edHeroStats(h), f=v=>Math.round(v||0).toLocaleString();
      const st=[...P.querySelectorAll('.hpStats span')].map(x=>SL.txt(x));
      return {panel:true,name:SL.txt(P.querySelector('.hpHead b')),stats:st,wantHp:f(u.maxHp),wantAtk:f(u.dmg),slots:P.querySelectorAll('.hpSlot[data-a^="ii:"]').length,slotImg:!!P.querySelector('.hpSlot[data-a="ii:0"] img'),on:SL.inView(P),box:SL.R(P)}; },hid.id);
    const s6=await shot(pg,S.tag+' hero info panel');
    C.ok(r.panel&&r.stats.length>=2&&r.stats[0].includes(r.wantHp)&&r.stats[1].includes(r.wantAtk)&&r.slots===1&&r.slotImg&&r.on,S.tag+' Hero info panel: tapping '+hid.key+' on the board shows its real HP '+r.wantHp+' and attack '+r.wantAtk+' and its item',{...r,shot:s6});
    if(r.panel){ await press(pg,S.touch,'#edRoot .heroP .hpSlot[data-a="ii:0"]'); await H.wait(800);
      const it=await pg.evaluate(()=>{ const I=document.querySelector('#edRoot .heroP .hpInfo'); return {text:SL.txt(I).slice(0,260),lines:I?I.querySelectorAll(':scope>div').length:0,recipe:I?I.querySelectorAll('.recipe>span').length:0,on:SL.inView(I)}; });
      const s7=await shot(pg,S.tag+' hero info item');
      C.ok(it.lines>=1&&it.recipe===18&&it.on&&/\d/.test(it.text),S.tag+' Hero info panel: tapping its item shows the item\'s stat line and the recipe lines (9 recipes)',{...it,shot:s7});
      await pg.evaluate(()=>{ ED.sel=null; ED.info=null; edRender(); }); await H.wait(500); }
  }
  /* ---- Your avatar ---- */
  { await pg.evaluate(()=>{ window._edTags=[]; if(!window._edTagW){ window._edTagW=1; const o=edAvTag; edAvTag=function(a,txt,col){ try{ window._edTags.push({txt,col,x:a&&a.x,y:a&&a.y,t:performance.now()}); if(window._edTags.length>400) window._edTags.splice(0,200); }catch(e){} return o.apply(this,arguments); }; } });
    const a0=await pg.evaluate(()=>{ const a=edAvEnsure(); return {x:a.x,y:a.y}; });
    /* empty ground: the middle of the field, between the two sides, nothing standing there */
    const tgt=await pg.evaluate(()=>{ const x=FW*0.5, y=FD*0.47; const s=edScreen(x,y); const el=document.elementFromPoint(s.x,s.y); return {fx:x,fy:y,x:s.x,y:s.y,hit:el&&(el.dataset.field?'field':el.className),unit:!!edUnitAtScreen(s.x,s.y),orb:!!edOrbAtScreen(s.x,s.y)}; });
    if(S.touch) await pg.touchscreen.tap(tgt.x,tgt.y); else await pg.mouse.click(tgt.x,tgt.y);
    await pg.waitForFunction(()=>ED.av&&ED.av.tx==null&&!ED.av.moving,null,{timeout:15000}).catch(()=>{}); await H.wait(600);
    const a1=await pg.evaluate(()=>{ const a=ED.av, f=edScreenToField; const G=ED._avG, r=G&&G.cv?G.cv.getBoundingClientRect():null; return {x:a.x,y:a.y,cv:r?{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),disp:G.cv.style.display}:null,model:!!(G&&G.ok)}; });
    const want=await pg.evaluate(t=>{ const f=edScreenToField(t.x,t.y); return {x:Math.max(FIELD_X_MIN,Math.min(FIELD_X_MAX,f.x)),y:Math.max(FIELD_Y_MIN,Math.min(FD-60,f.y))}; },tgt);
    const s8=await shot(pg,S.tag+' avatar walked to the tapped ground');
    const d1=Math.hypot(a1.x-want.x,a1.y-want.y), moved=Math.hypot(a1.x-a0.x,a1.y-a0.y);
    C.ok(tgt.hit==='field'&&!tgt.unit&&d1<2&&moved>20&&a1.cv&&a1.cv.disp!=='none'&&a1.model,S.tag+' Your avatar: a tap on empty ground walks the avatar there ('+Math.round(moved)+' field units, ends '+d1.toFixed(1)+' from the tap)',{start:a0,end:{x:a1.x,y:a1.y},want,tap:tgt,canvas:a1.cv,shot:s8});
    /* an orb: dropped by the page's own edDropOrb (as a monster kill drops one), then tapped */
    const ob=await pg.evaluate(()=>{ const a=ED.av, x=Math.min(FIELD_X_MAX-20,a.x+FW*0.18), y=Math.max(FIELD_Y_MIN+10,a.y-FD*0.05); edDropOrb(x,y,{gold:3}); const o=ED.orbs[ED.orbs.length-1]; const s=edScreen(o.x,o.y,0.45); return {x:s.x,y:s.y,fx:o.x,fy:o.y,gold:edYou().gold,n:ED.orbs.length}; });
    await H.wait(500); const s9a=await shot(pg,S.tag+' orb on the ground');
    if(S.touch) await pg.touchscreen.tap(ob.x,ob.y); else await pg.mouse.click(ob.x,ob.y);
    await pg.waitForFunction(n=>(ED.orbs||[]).length<n,ob.n,{timeout:20000}).catch(()=>{}); await H.wait(800);
    const a2=await pg.evaluate(()=>({x:ED.av.x,y:ED.av.y,gold:edYou().gold,orbs:(ED.orbs||[]).length,tags:(window._edTags||[]).slice(-3).map(t=>t.txt)}));
    const s9=await shot(pg,S.tag+' avatar picked up the orb');
    C.ok(a2.orbs===ob.n-1&&a2.gold===ob.gold+3&&Math.hypot(a2.x-ob.fx,a2.y-ob.fy)<60,S.tag+' Your avatar: a tap on an orb walks the avatar over it and the gold rises '+ob.gold+' -> '+a2.gold+' (name tag "'+(a2.tags[0]||'')+'")',{orb:ob,after:a2,shot:[s9a,s9]});
  }
  /* ---- Rank insignia ---- */
  { const setup=await pg.evaluate(()=>{ const you=edYou(); you.level=9; const k=Object.values(you.board)[0].key; const slots=['3,2','3,5','3,8','3,11'], ids=[];
      for(let r=1;r<=4;r++){ const h=edMakeHero(k,r); you.board[slots[r-1]]=h; ids.push(h.id); }
      window._ins=[]; window._bars=[];
      if(!window._insW){ window._insW=1; const oi=edDrawInsignia; edDrawInsignia=function(c,cx,by,rank,k){ const H=oi.apply(this,arguments);
          try{ if(window._insOn){ const m=c.getTransform(), X=v=>m.a*v+m.e, Y=v=>m.d*v+m.f; const x=Math.round(X(cx)), y0=Math.max(0,Math.floor(Y(by-H-4*k))), y1=Math.min(c.canvas.height-1,Math.ceil(Y(by+2*k)));
              const col=c.getImageData(x,y0,1,y1-y0+1).data; let runs=0, inRun=false, len=0, maxLen=0, prof='';
              for(let i=0;i<col.length;i+=4){ const br=col[i+3]>150&&Math.max(col[i],col[i+1],col[i+2])>110; prof+=br?'#':(col[i+3]>150?'x':'.'); if(br){ if(!inRun){ runs++; inRun=true; len=0; } len++; maxLen=Math.max(maxLen,len); } else inRun=false; }
              window._ins.push({rank,cx,by,H,k:+k.toFixed(2),runs,maxLenPx:maxLen,scale:+m.d.toFixed(2),prof}); } }catch(e){ window._ins.push({err:String(e)}); }
          return H; };
        const ob=drawBarFrame; drawBarFrame=function(g,x,y,w,h){ try{ if(window._insOn) window._bars.push({cx:x+w/2,y,h,w}); }catch(e){} return ob.apply(this,arguments); }; }
      ED._fieldSig=null; edRender(); return {key:k,ids}; });
    await H.wait(1500);
    await pg.evaluate(()=>{ window._ins=[]; window._bars=[]; window._insOn=true; }); await H.wait(700); await pg.evaluate(()=>{ window._insOn=false; });
    const r=await pg.evaluate(ids=>{ const out=[]; const ins=window._ins.filter(x=>!x.err), bars=window._bars;
      for(let i=0;i<4;i++){ const u=units.find(q=>q._edId===ids[i]&&q.alive); if(!u){ out.push({rank:i+1,missing:true}); continue; }
        const p=project(u.x,u.y,0.001); const mine=ins.filter(c=>c.rank===i+1).sort((a,b)=>Math.abs(a.cx-p.x)-Math.abs(b.cx-p.x));
        const c=mine[0]; if(!c){ out.push({rank:i+1,noDraw:true}); continue; }
        const bar=bars.filter(b=>Math.abs(b.cx-c.cx)<3).sort((a,b)=>Math.abs(a.y-c.by)-Math.abs(b.y-c.by))[0];
        const ov=overlay.getBoundingClientRect(), sx=ov.left+c.cx*ov.width/CW, sy=ov.top+c.by*ov.height/CH;
        out.push({rank:i+1,runs:c.runs,maxLenPx:c.maxLenPx,k:c.k,scale:c.scale,H:+c.H.toFixed(1),top:+(c.by-c.H).toFixed(1),barBottom:bar?+(bar.y+bar.h).toFixed(1):null,barY:bar?+bar.y.toFixed(1):null,prof:c.prof,screen:{x:Math.round(sx),y:Math.round(sy)},calls:mine.length,errs:window._ins.filter(x=>x.err).slice(0,1)}); }
      return out; },setup.ids);
    const zs=[]; for(const x of r){ if(x.screen) zs.push(await shot(pg,S.tag+' insignia '+x.rank+' star zoom',{clip:{x:Math.max(0,x.screen.x-45),y:Math.max(0,x.screen.y-110),width:90,height:150}})); }
    const sAll=await shot(pg,S.tag+' insignia 1-4 star board');
    const wantRuns=[1,2,3,1];
    r.forEach((x,i)=>{ const shape=i<3?(x.runs===wantRuns[i]&&x.maxLenPx<8*x.k*x.scale):(x.runs===1&&x.maxLenPx>=8*x.k*x.scale);
      C.ok(!x.missing&&!x.noDraw&&shape&&x.barBottom!=null&&x.barBottom<=x.top+0.5,S.tag+' Rank insignia: the '+(i+1)+' star '+setup.key+' shows '+(i<3?(i+1)+' chevron'+(i?'s':''):'a star')+' ('+x.runs+' marks read on the overlay, tallest '+x.maxLenPx+' px) and the health bar above it (bar bottom '+x.barBottom+' <= insignia top '+x.top+')',{...x,shot:[zs[i],sAll]}); });
  }
  /* ---- Rival avatar: a monster round first (none), then a PvP round ---- */
  { await pg.evaluate(()=>{ window._edTags=[]; });
    await press(pg,S.touch,'#edRoot [data-a="ready"]');
    await pg.waitForFunction(()=>ED.phase==='fight'&&ED.fighting&&state==='battle'&&battleTime>2.5,null,{timeout:90000}).catch(()=>{});
    await pg.evaluate(()=>{ window._edTags=[]; }); await H.wait(1500);
    const m=await pg.evaluate(()=>({round:ED.round,pve:!!(ED.opp&&ED.opp.pve),phase:ED.phase,bt:+battleTime.toFixed(1),tags:[...new Set((window._edTags||[]).map(t=>t.txt+'|'+t.col))],foe:!!(ED._avF&&ED._avF.cv&&ED._avF.cv.style.display!=='none')}));
    const s10=await shot(pg,S.tag+' monster round fight');
    C.ok(m.pve&&m.round===2&&m.phase==='fight'&&!m.foe&&m.tags.length>0&&m.tags.every(t=>!t.endsWith('#ff9a8a')),S.tag+' Rival avatar: in a monster round (round '+m.round+') no rival avatar and no rival name tag (tags drawn: '+m.tags.join(', ')+')',{...m,shot:s10});
    /* let the monster round finish (the board is far stronger than round 2's wave) */
    let ok=await pg.waitForFunction(()=>ED.phase==='plan'&&ED.round===3,null,{timeout:200000}).then(()=>true,()=>false);
    if(!ok){ await pg.evaluate(()=>{ for(const u of units) if(u.team==='enemy'&&u.alive) u.hp=0; }); ok=await pg.waitForFunction(()=>ED.phase==='plan'&&ED.round===3,null,{timeout:90000}).then(()=>true,()=>false); }
    if(!ok){ const st=await pg.evaluate(()=>({phase:ED.phase,round:ED.round,state})); C.ok(false,S.tag+' Rival avatar: the match reaches round 3 planning after the monster round',st); }
    else {
      await H.wait(1200); await pg.evaluate(()=>edNextRound());
      await pg.waitForFunction(()=>ED.phase==='plan'&&ED.round===4,null,{timeout:30000}); await H.wait(1500); await H.clean(pg);
      await pg.evaluate(()=>{ const you=edYou(); while(edBoardCount(you)>edFieldCap(you)){ const k=Object.keys(you.board).pop(); delete you.board[k]; } ED._fieldSig=null; edRender(); }); await H.wait(800);
      await press(pg,S.touch,'#edRoot [data-a="ready"]');
      await pg.waitForFunction(()=>ED.phase==='fight'&&ED.fighting&&state==='battle'&&battleTime>2.5&&ED._avF&&ED._avF.ok,null,{timeout:120000}).catch(()=>{});
      await pg.evaluate(()=>{ window._edTags=[]; }); await H.wait(1500);
      const v=await pg.evaluate(()=>{ const pl=ED.opp&&ED.opp.p, G=ED._avF, r=G&&G.cv?G.cv.getBoundingClientRect():null, a=ED.avF;
        const pads=[]; for(let i=0;i<ED_BENCH;i++){ try{ const f=edBenchPosEnemy(i); if(f) pads.push(f); }catch(e){} }
        const near=a&&pads.length?Math.min(...pads.map(f=>Math.hypot(f.x-a.x,f.y-a.y))):null;
        const tags=(window._edTags||[]).filter(t=>t.col==='#ff9a8a');
        return {round:ED.round,pvp:!!(ED.opp&&!ED.opp.pve&&pl),rival:pl&&pl.name,phase:ED.phase,bt:+battleTime.toFixed(1),model:!!(G&&G.ok),cv:r?{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),disp:G.cv.style.display}:null,
          on:!!r&&r.width>0&&r.left<innerWidth&&r.right>0&&r.top<innerHeight&&r.bottom>0,av:a?{x:Math.round(a.x),y:Math.round(a.y)}:null,nearPad:near==null?null:Math.round(near),tagTexts:[...new Set(tags.map(t=>t.txt))],tagN:tags.length,
          tagAtAv:tags.length?Math.hypot(tags[tags.length-1].x-a.x,tags[tags.length-1].y-a.y):null}; });
      const s11=await shot(pg,S.tag+' PvP fight rival avatar');
      C.ok(v.pvp&&v.round===4&&v.model&&v.cv&&v.cv.disp!=='none'&&v.on&&v.nearPad!=null&&v.nearPad<=140&&v.tagN>0&&v.tagTexts.length===1&&v.tagTexts[0]===v.rival&&v.tagAtAv<1,
        S.tag+' Rival avatar: in the PvP fight (round '+v.round+') '+v.rival+'\'s avatar stands by the far bench ('+v.nearPad+' field units from a pad) with the name tag "'+(v.tagTexts[0]||'')+'"',{...v,shot:s11});
    }
  }
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.px=pxFor(25); u.led.gems=0; });
  const s=await H.server(file); let pg=null;
  const run=async(S,fn)=>{ pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
    try{ await fn(pg,S); }catch(e){ C.ok(false,S.tag+' '+fn.name+' ran to the end',String(e&&e.stack||e).slice(0,600)); try{ await shot(pg,S.tag+' '+fn.name+' error'); }catch(_){} }
    C.ok(pg._errs.length===0,S.tag+' '+fn.name+': no page errors',pg._errs.slice(0,3)); await pg._ctx.close(); pg=null; };
  try{
    for(const S of [H.SIZES.desktop,H.SIZES.phone]) await run(S,titleScreen);   /* before any attempt is spent: 3 lit pips */
    for(const S of [DESK800,H.SIZES.phone]) await run(S,match);
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
