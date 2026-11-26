'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 08 - The Vault (vault-arena-well.md, UNPROVEN-ON-SCREEN lines), in a real browser on this
   checkout's server (temp DB), the Vault opened from its town plate, the player on floor 25 (a boss floor) with a 10-hero squad:
   - Title art: the painted Vault title sits in the title spot (top left, beside Base), no text title, at desktop / tablet / phone.
   - Enemy cards: hover (desktop) / double tap (phone) a monster chip in Floor Description: the card shows that floor's level, HP and damage.
   - Landscape layout: phone, Fold, tablet, desktop, pop-out and full screen: title, banners, fighters panel, drops, Sweep and Salvage all
     on screen, not covered, with no scroll.
   - Power on hero cards: Vault > Select Heroes: each hero card shows its power beside HP and attack.
   One screenshot per check per size (SHOT64 lines). Every check prints what it measured. Exit 0 = all passed. */
const fs=require('fs'), H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_vault.js', C=H.checker(TEST), shot=H.shooter(TEST);
const KEYS=['vael','aureth','sylthaine','vireo','brannus','lumi','umbris','grosk','calypsa','dandra'];
const HEROES={}; KEYS.forEach(k=>HEROES[k]=60);
const FLOOR=25;
const press=(pg,touch,sel)=>touch?pg.tap(sel):pg.click(sel);

async function openVault(pg,S){
  const how=await H.openBuilding(pg,'dungeon',S.touch);
  await pg.waitForFunction(()=>document.getElementById('dungeon').classList.contains('active')&&document.querySelector('#dungeon .vtPick')&&document.querySelector('#dungeon .vtRow'),null,{timeout:40000}).catch(()=>{});
  await pg.evaluate(async()=>{ const ims=[...document.querySelectorAll('#dungeon img')]; for(let k=0;k<80&&ims.some(i=>!i.complete);k++) await new Promise(r=>setTimeout(r,100)); });
  await H.wait(1200); await H.prep(pg); return how; }

async function titleArt(pg,S,how){
  const r=await pg.evaluate(async()=>{ const t=document.querySelector('#dungeon .vtTitle'), cs=getComputedStyle(t), bg=await SL.bgLoaded(t), base=document.querySelector('#dungeon .backbtn');
    const box=SL.R(t), br=SL.R(base), st=SL.R('#dungeon .vtStats'), pick=SL.R('#dungeon .vtPick'), v=SL.V();
    /* the painted part of the title: the art is drawn 'left center / contain' in its box; its opaque pixels give the painted rectangle */
    let tr=box, painted=null; try{ const u=bg[0].url, im=new Image(); im.src=u; await im.decode(); const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; const g=c.getContext('2d'); g.drawImage(im,0,0);
      const d=g.getImageData(0,0,c.width,c.height).data; let x0=c.width,x1=-1,y0=c.height,y1=-1; for(let y=0;y<c.height;y+=2) for(let x=0;x<c.width;x+=2){ if(d[(y*c.width+x)*4+3]>40){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
      const sc=Math.min(box.w/c.width,box.h/c.height), dh=c.height*sc, ox=box.x, oy=box.y+(box.h-dh)/2;
      painted={x:+(ox+x0*sc).toFixed(1),y:+(oy+y0*sc).toFixed(1),r:+(ox+x1*sc).toFixed(1),b:+(oy+y1*sc).toFixed(1)}; painted.w=+(painted.r-painted.x).toFixed(1); painted.h=+(painted.b-painted.y).toFixed(1); tr=painted; }catch(e){ painted={error:String(e)}; }
    return {box,painted,bg:bg.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),ok:bg.length>0&&bg.every(x=>x.ok)&&bg.some(x=>/vault-title/.test(x.url)),
      font:cs.fontSize,text:(t.textContent||'').trim(),box:tr,base:br,view:v,on:SL.inView(t),front:SL.front(t,.3,.5),who:SL.whoAt(t,.3,.5),
      clearBase:!SL.overlap(tr,br),clearStats:!SL.overlap(tr,st),clearPick:!SL.overlap(tr,pick),
      spot:tr.x>=br.r&&tr.x<v.width*0.45&&tr.y>=-1&&tr.y<v.height*0.3}; });
  const s=await shot(pg,S.tag+' Title art');
  C.ok(r.ok&&parseFloat(r.font)===0&&r.on&&r.front&&r.spot&&r.clearBase&&r.clearStats&&r.clearPick&&r.box.w>=60&&r.box.h>=20,
    S.tag+' Title art: the painted Vault title (vault-title.webp, loaded) sits in the title spot (top left, its painted part right of Base and clear of the banners and fighters panel), no text title (font size 0) [opened by '+how+']',
    {art:r.bg,box:r.box,painted:r.painted,base:r.base,view:r.view,font:r.font,front:r.who,shot:s});
}

async function enemyCards(pg,S,s){
  await pg.evaluate(()=>{ try{ mcardClose(); }catch(e){} const o=document.getElementById('vtInfoPop'); if(o) o.remove(); });
  await press(pg,S.touch,'#dungeon .vtInfo'); await pg.waitForSelector('#vtInfoPop .smEnemy',{timeout:20000}).catch(()=>{}); await H.wait(800); await H.prep(pg);
  const chips=await pg.evaluate(()=>[...document.querySelectorAll('#vtInfoPop .smEnemy')].map((c,i)=>{ c.dataset.slIdx=i; const rec=MCARD_REG.get(c.dataset.mc); return {i,name:c.getAttribute('aria-label'),spec:rec&&rec.spec,mode:rec&&rec.mode}; }));
  const srv=(await s.api('/api/dungeon/status')).body||{};
  const srvSpecs=[].concat(...(srv.waves||[]));
  C.ok(chips.length>0&&srv.currentFloor===FLOOR,S.tag+' Enemy cards: Floor Description opens with the floor '+FLOOR+' monster chips',{chips:chips.map(c=>c.name),floor:srv.currentFloor});
  const pick=[chips[0],chips.find(c=>c.spec&&c.spec.boss)].filter((c,i,a)=>c&&a.indexOf(c)===i);
  for(const c of pick){
    await pg.evaluate(()=>{ try{ mcardClose(); }catch(e){} });
    const sel='#vtInfoPop .smEnemy[data-sl-idx="'+c.i+'"]';
    await pg.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),sel); await H.wait(200);
    const cp=await pg.evaluate(s=>{ const b=document.querySelector(s).getBoundingClientRect(); return [b.left+b.width/2,b.top+b.height/2]; },sel);
    if(S.touch){ await pg.touchscreen.tap(cp[0],cp[1]); await H.wait(90); await pg.touchscreen.tap(cp[0],cp[1]); } else { await pg.mouse.move(2,2); await H.wait(250); await pg.mouse.move(cp[0],cp[1],{steps:4}); }
    await H.wait(600);
    const r=await pg.evaluate(c=>{ const card=document.querySelector('#mcLayer .mcCard'); if(!card) return {shown:false};
      const st=mcardStats(c.spec,c.mode), num=sel=>{ const e=card.querySelector('[data-st="'+sel+'"] b'); return e?parseInt(e.textContent.replace(/[^0-9]/g,''),10):null; };
      return {shown:true,name:(card.querySelector('.mcName')||{}).textContent,sub:(card.querySelector('.mcSub')||{}).textContent,lvWord:ewT('stage.lv',{n:c.spec.lvl}),
        hp:num('hp'),atk:num('atk'),want:{hp:st.hp,atk:st.atk,level:st.level},box:SL.R(card),on:SL.inView(card),front:SL.front(card)}; },c);
    const sp=c.spec||{}, onSrv=srvSpecs.some(m=>m.key===sp.key&&m.lvl===sp.lvl&&!!m.boss===!!sp.boss);
    const sh=await shot(pg,S.tag+' Enemy cards '+(sp.key||'chip'));
    C.ok(r.shown&&onSrv&&r.sub&&r.sub.indexOf(r.lvWord)>=0&&r.want.level===sp.lvl&&r.hp===r.want.hp&&r.atk===r.want.atk&&r.hp>0&&r.atk>0&&r.on&&r.front,
      S.tag+' Enemy cards: '+(S.touch?'a double tap':'hover')+' on "'+c.name+'" shows its card with floor '+FLOOR+'\'s level ('+r.lvWord+'), HP '+r.hp+' and damage '+r.atk+' (the fight\'s own numbers for this floor\'s lineup)',
      {card:{name:r.name,sub:r.sub,hp:r.hp,atk:r.atk},fight:r.want,serverSpec:sp,onServerFloor:onSrv,box:r.box,shot:sh});
  }
  await pg.evaluate(()=>{ try{ mcardClose(); }catch(e){} const o=document.getElementById('vtInfoPop'); if(o) o.remove(); });
}

async function layout(pg,S,how){
  const r=await pg.evaluate(()=>{ const q=s=>document.querySelector('#dungeon '+s);
    const pk=q('.vtPick'), chips=[...pk.querySelectorAll('[style*="width:58px"]')], pbtn=[...pk.querySelectorAll('.btn')];
    const parts={title:q('.vtTitle'),floorDesc:q('.vtInfo'),floorBanner:q('.vtFloor'),fighters:pk,drops:q('.vtDrops'),sweep:q('.vtRow .btn:nth-child(1)'),salvage:q('.vtRow .btn:nth-child(2)')};
    chips.forEach((c,i)=>parts['heroSlot'+i]=c); pbtn.forEach((c,i)=>parts['fightersButton'+i]=c);
    const out={}; for(const [k,el] of Object.entries(parts)) out[k]=el?{box:SL.R(el),vis:SL.vis(el),on:SL.inView(el),front:SL.front(el),who:SL.whoAt(el)}:null;
    /* a framed panel counts as on screen when its painted frame is (the frame art keeps a transparent edge of a few px) */
    for(const k of ['fighters','drops']) if(out[k]){ const b=out[k].box, v=SL.V(); out[k].on=b.x>=-12&&b.y>=-12&&b.r<=v.width+12&&b.b<=v.height+12; }
    const sc=document.querySelector('#dungeon #dungeonBody>div'), scr=SL.scrolls(sc), scr2=SL.scrolls(document.getElementById('dungeon')), doc=SL.scrolls(document.scrollingElement);
    const ov=[]; const ks=Object.keys(out).filter(k=>out[k]&&k!=='floorDesc'&&k!=='floorBanner'); for(let i=0;i<ks.length;i++) for(let j=i+1;j<ks.length;j++) if(SL.overlap(out[ks[i]].box,out[ks[j]].box)) ov.push(ks[i]+'/'+ks[j]);
    const zoom=(q('#dungeonBody>div>div:has(.vtPick)')||{}).style; return {parts:out,scroll:scr,screen:scr2,doc,overlaps:ov,zoom:zoom&&zoom.zoom,view:SL.V()}; });
  const s=await shot(pg,S.tag+' Landscape layout');
  const bad=Object.entries(r.parts).filter(([k,v])=>!v||!v.vis||!v.on||!v.front).map(([k,v])=>k+(v?(!v.on?' off-screen '+JSON.stringify(v.box):'')+(!v.front?' covered by '+v.who:''):' missing'));
  const nSlots=Object.keys(r.parts).filter(k=>/^heroSlot/.test(k)).length;
  C.ok(!bad.length&&nSlots===10,
    S.tag+' Landscape layout: title, banners (Floor Description + Floor N / 100), fighters panel (its 10 hero slots and 2 buttons), drops, Sweep and Salvage all on screen and not covered [opened by '+how+']',
    {problems:bad,slots:nSlots,zoom:r.zoom,view:r.view,boxes:Object.fromEntries(Object.entries(r.parts).filter(([k])=>!/^(heroSlot|fightersButton)/.test(k)).map(([k,v])=>[k,v&&v.box])),shot:s});
  C.ok(!r.scroll.y&&!r.scroll.x&&!r.screen.y&&!r.screen.x&&!r.doc.y&&!r.doc.x,S.tag+' Landscape layout: no scroll (the Vault page cannot be scrolled up/down or sideways)',
    {page:r.scroll,screen:r.screen,doc:r.doc,overflowRight:Math.round(r.scroll.sw-r.scroll.cw)+' px',fightersFrameRight:r.parts.fighters&&r.parts.fighters.box.r,view:r.view.width,shot:s});
}

async function powerCards(pg,S){
  await press(pg,S.touch,'#dungeon .vtPick .btn.secondary');
  await pg.waitForFunction(()=>document.getElementById('menu').classList.contains('active')&&document.querySelectorAll('#roster .rsCard').length>0,null,{timeout:30000}).catch(()=>{});
  await H.wait(1000); await H.clean(pg); await H.prep(pg);
  const r=await pg.evaluate(()=>{ const cards=[...document.querySelectorAll('#roster .rsCard')];
    return {title:document.getElementById('menuTitle').textContent,mode:CUR&&CUR.mode,cards:cards.map(c=>{ const k=c.dataset.heroKey, pw=c.querySelector('.rsPow'), txt=SL.txt(c);
      const stat=n=>!!c.querySelector('img[src*="/icons/stat/'+n+'-"]');
      const shown=pw?parseInt(pw.textContent.replace(/[^0-9]/g,''),10):null;
      return {k,power:shown,want:myHeroPower(k),powerOn:!!pw&&SL.vis(pw),hp:stat('hp')||/\bHP\b/.test(txt),atk:stat('atk')||stat('attack'),text:txt.slice(0,60)}; })}; });
  const s=await shot(pg,S.tag+' Power on hero cards');
  const pOk=r.cards.length>=KEYS.length&&r.cards.every(c=>c.powerOn&&c.power===c.want&&c.want>0);
  C.ok(r.mode==='vault'&&pOk,S.tag+' Power on hero cards: Vault > Select Heroes ("'+r.title+'"): every hero card shows its power (= the hero\'s power)',{cards:r.cards.map(c=>c.k+' '+c.power+'/'+c.want),shot:s});
  C.ok(r.cards.length>0&&r.cards.every(c=>c.hp&&c.atk),S.tag+' Power on hero cards: each card shows HP and attack beside the power',
    {withHP:r.cards.filter(c=>c.hp).length,withAttack:r.cards.filter(c=>c.atk).length,of:r.cards.length,sample:r.cards.slice(0,3).map(c=>c.text),shot:s});
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.team=KEYS.slice(0,5); });
  { const db=JSON.parse(fs.readFileSync(file,'utf8')), UID=Object.keys(db.users)[0];
    db.dungeonProgress={[UID]:{accountId:UID,currentFloor:FLOOR,highestClearedFloor:FLOOR-1,vaultStatus:'active',claimedFloors:{},sweep:{dateKey:'',freeUsesRemaining:2,totalSweepsToday:0},activeAttempt:null,lastTeamHeroIds:KEYS.slice(),version:1}};
    for(let f=1;f<FLOOR;f++) db.dungeonProgress[UID].claimedFloors[f]=true;
    fs.writeFileSync(file,JSON.stringify(db)); }
  const s=await H.server(file); let pg=null;
  const PLAN=[['desktop',{title:1,cards:1,layout:1,power:1}],['popout',{layout:1}],['full',{layout:1}],['tablet',{title:1,layout:1}],['fold',{layout:1}],['phone',{title:1,cards:1,layout:1,power:1}]];
  try{
    for(const [k,do_] of PLAN){ const S=H.SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch});
      try{ const how=await openVault(pg,S);
        if(do_.title) await titleArt(pg,S,how);
        if(do_.layout) await layout(pg,S,how);
        if(do_.cards) await enemyCards(pg,S,s);
        if(do_.power) await powerCards(pg,S);
      }catch(e){ C.ok(false,S.tag+' ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; await H.closeBrowser(); }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
