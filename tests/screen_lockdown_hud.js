'use strict';
/* Lockdown audit 25 Nov 2026, round 3, section 21 - Hub HUD and UI Art (account-hud-sound-servers.md, the UNPROVEN-ON-SCREEN lines), in a real
   browser on this checkout's server (temp DB, one seeded max-level player, so every building is open):
   - Commander group (top left): level shield, laurel ring with its XP arc and the Commander plate sit top-left, together, not clipped, art loaded.
   - Currency row: food / gold / diamond chips in one row, left of MENU (and its book icon), clear of the Market's box, 0.72x under 1100 px wide.
   - Building tap boxes: every one of the 17 town boxes probed at its centre and 4 inset corners (elementFromPoint): each point opens that
     building or nothing (HUD), never another one; no two boxes overlap; a real tap on each box opens that building's screen.
   - Chat bar: the town's minimised chat bar wears hud2/chat-bar.webp, sits snug in the bottom-left corner, the word Chat clear of the bar's icon.
   - Fits a phone: MENU on 844x390, 740x360 and the Fold cover - every medallion reachable (on screen and on top, or scrolled to), none off-screen.
   - Centred pop-outs: Heroes and a hero window centred in the game frame with the gold frame on all four sides (7 sizes).
   - Floating Isle fits: Island of Trials map fills the screen, nothing scrolls, no flat backdrop shows.
   - Hero loading cards: a real campaign fight's loading screen (your heroes: painted card, rarity banner, ascension border, stars) and the
     game's own versus loader as the Arena draws it (enemy heroes: banner only), phone and desktop.
   - Fold and tablet fit: town, campaign map, Heroes pop-out and a battle - HUD in its corners, nothing clipped, nothing scrolls.
   One screenshot per line per size (SHOT64 lines). Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_hud.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:60,aureth:60,sylthaine:60,vireo:60,brannus:60,tick:60,grosk:60,lumi:60};
const FOLD_OPEN={w:1104,h:884,touch:true,tag:'Fold open 1104x884'}, PHONE740={w:740,h:360,touch:true,tag:'phone 740x360'};
const S_=H.SIZES;
/* which lines run at which size */
const PLAN=[
  [S_.phone,    ['commander','currency','tapboxes','chat','menu','popouts','isle','loading','fit']],
  [S_.desktop,  ['commander','currency','tapboxes','chat','popouts','isle','loading','fit']],
  [FOLD_OPEN,   ['commander','currency','tapboxes','popouts','isle','fit']],
  [S_.fold,     ['commander','currency','chat','menu','popouts','isle','fit']],
  [S_.tablet,   ['commander','currency','chat','popouts','isle','fit']],
  [PHONE740,    ['menu']],
  [S_.popout,   ['popouts']],
  [S_.full,     ['popouts','isle']],
];
const NAMES={commander:'Commander group (top left)',currency:'Currency row',tapboxes:'Building tap boxes',chat:'Chat bar',menu:'Fits a phone',
  popouts:'Centred pop-outs',isle:'Floating Isle fits',loading:'Hero loading cards',fit:'Fold and tablet fit'};
const CHIPS={};   /* chip height per size (smaller on phones) */

const press=async(pg,touch,sel)=>{ try{ if(touch) await pg.tap(sel,{timeout:8000}); else await pg.click(sel,{timeout:8000}); return 'tap'; }
  catch(e){ await pg.evaluate(s=>{ const el=document.querySelector(s); if(el) el.click(); },sel); return 'js'; } };
async function goHome(pg){ await H.prep(pg);
  await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} try{ const w=document.getElementById('wlMap'); if(w) w.remove(); }catch(e){} try{ CAMP_RETURN=null; }catch(e){} try{ show('home'); }catch(e){} });
  await H.wait(1200); await H.clean(pg);
  await pg.evaluate(()=>{ try{ townHudPlace(); }catch(e){} }); await H.wait(300); await H.prep(pg); }
/* page-side: plain viewport rect + the game frame (#app) */
const PAGE=()=>{ if(window.HB) return true;
  const B=e=>{ if(typeof e==='string') e=document.querySelector(e); if(!e) return null; const b=e.getBoundingClientRect(); const f=v=>Math.round(v*10)/10; return {x:f(b.left),y:f(b.top),w:f(b.width),h:f(b.height),r:f(b.right),b:f(b.bottom)}; };
  const F=()=>{ const a=B('#app'); const v={x:0,y:0,w:innerWidth,h:innerHeight,r:innerWidth,b:innerHeight}; if(!a||a.w<10) return v;
    return {x:Math.max(0,a.x),y:Math.max(0,a.y),w:Math.min(a.r,innerWidth)-Math.max(0,a.x),h:Math.min(a.b,innerHeight)-Math.max(0,a.y),r:Math.min(a.r,innerWidth),b:Math.min(a.b,innerHeight)}; };
  const inF=(b,s)=>{ const f=F(); s=s==null?1:s; return !!b&&b.w>0&&b.h>0&&b.x>=f.x-s&&b.y>=f.y-s&&b.r<=f.r+s&&b.b<=f.b+s; };
  const uni=bs=>{ bs=bs.filter(Boolean); if(!bs.length) return null; const x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y)),r=Math.max(...bs.map(b=>b.r)),b=Math.max(...bs.map(b=>b.b)); return {x,y,r,b,w:r-x,h:b-y}; };
  const gap=(a,b)=>!a||!b?null:Math.max(0,Math.max(a.x,b.x)-Math.min(a.r,b.r),Math.max(a.y,b.y)-Math.min(a.b,b.b));
  const urlOf=s=>((String(s||'').match(/url\(["']?([^"')]+)/)||[])[1])||null;
  const canPaint=cv=>{ try{ const c=cv.getContext('2d'), d=c.getImageData(0,0,cv.width,cv.height).data; let n=0; for(let i=3;i<d.length;i+=4*37) if(d[i]>20) n++; return n; }catch(e){ return -1; } };
  window.HB={B,F,inF,uni,gap,urlOf,canPaint}; return true; };
async function prep(pg){ await H.prep(pg); await pg.evaluate(PAGE); }
const fail=(S,k,e)=>C.ok(false,S.tag+' '+NAMES[k]+': ran to the end',String(e&&e.stack||e).replace(/Error:/g,'Err -').slice(0,500));

/* ---------------- Commander group (top left) ---------------- */
async function commander(pg,S){ await goHome(pg); await prep(pg);
  const r=await pg.evaluate(async()=>{ const f=HB.F(), g=id=>document.getElementById(id);
    const pname=document.querySelector('#pfName .pname');
    const P={badge:g('pfLvBadge'),ring:g('xpRing'),frame:g('pfFrame'),plate:pname};
    const box={}, on={}, vis={}; for(const k in P){ box[k]=HB.B(P[k]); on[k]=HB.inF(box[k]); vis[k]=SL.vis(P[k]); }
    const badgeArt=await SL.bgLoaded(P.badge), plateArt=pname?await SL.bgLoaded(pname):[];
    const fu=P.frame?HB.urlOf(getComputedStyle(P.frame).content)||P.frame.currentSrc:null, frameArt=fu?await SL.loadImg(fu):null;
    const rcs=P.ring?getComputedStyle(P.ring):null, xp=rcs?rcs.getPropertyValue('--xp').trim():null, want=(xpIntoLevel()*3.6)+'deg';
    const uni=HB.uni(Object.values(box)), dist={}; for(const k of ['badge','frame','plate']) dist[k]=HB.gap(box[k],box.ring);
    return {frame:f,box,on,vis,uni,dist,level:SL.txt('#resLevel'),wantLevel:String(playerLevel()),
      badgeArt:badgeArt.map(x=>x.url.replace(location.origin,'')+(x.ok?' ok':' NOT LOADED')),badgeOk:badgeArt.some(x=>x.ok&&/hud2\/level-badge/.test(x.url)),
      frameArt:frameArt?frameArt.url.replace(location.origin,'')+(frameArt.ok?' ok':' NOT LOADED'):null,frameOk:!!(frameArt&&frameArt.ok&&/hud2\/commander-ring/.test(frameArt.url)),
      plateArt:plateArt.map(x=>x.url.replace(location.origin,'')+(x.ok?' ok':' NOT LOADED')),plateOk:plateArt.some(x=>x.ok&&/hud2\/commander-plate/.test(x.url)),
      xp,want,ringBg:rcs?String(rcs.backgroundImage).slice(0,120):null,name:SL.txt('#resName'),
      badgeFront:SL.front(P.badge),plateFront:pname?SL.front(pname):false}; });
  const s=await shot(pg,S.tag+' commander group');
  const f=r.frame, u=r.uni, topLeft=!!u&&(u.x-f.x)<=f.w*0.3&&(u.y-f.y)<=f.h*0.3;
  const together=Object.values(r.dist).every(d=>d!=null&&d<=30);
  C.ok(Object.values(r.vis).every(Boolean)&&Object.values(r.on).every(Boolean)&&r.badgeOk&&r.frameOk&&r.plateOk&&topLeft&&together&&r.badgeFront&&r.plateFront&&r.level===r.wantLevel&&r.xp===r.want,
    S.tag+' Commander group (top left): level shield (Lv '+r.level+'), laurel ring with XP arc '+r.xp+' and the Commander plate are drawn, top-left, together (gaps '+JSON.stringify(r.dist)+' px), none clipped, art loaded',
    Object.assign({shot:s,topLeft,together},r)); }

/* ---------------- Currency row ---------------- */
async function currency(pg,S){ await goHome(pg); await prep(pg);
  const r=await pg.evaluate(()=>{ const h=document.getElementById('townHud'), fr=[...h.querySelectorAll('.resframe')];
    const fb=fr.map(HB.B), parts=[...h.querySelectorAll('.resframe,.resicon,.resplus')].map(HB.B).filter(b=>b&&b.w>0), row=HB.uni(parts);
    const cy=fb.map(b=>b.y+b.h/2), ys=Math.max(...cy)-Math.min(...cy), order=fb.every((b,i)=>i===0||b.x>=fb[i-1].x+fb[i-1].w*0.5);
    const mb=HB.B('#menuBtn'), ic=HB.B('#menuBtn .mbIc'), menuL=Math.min(mb.x,ic?ic.x:mb.x);
    const lab=[...document.querySelectorAll('#townHots .townlbl')].find(l=>l.dataset.nav==='market'), hot=lab&&[...document.querySelectorAll('#townHots .hot')].find(x=>x.title===lab.textContent.trim());
    const hb=hot?HB.B(hot):null, overMarket=hb?parts.filter(p=>SL.overlap(p,hb)).length:null;
    const tf=getComputedStyle(h).transform, m=tf&&tf!=='none'?tf.match(/matrix\(([^,]+)/):null, sc=m?+(+m[1]).toFixed(3):1;
    return {n:fr.length,fb,row,ys:+ys.toFixed(1),order,menuL,menu:mb,icon:ic,rowR:row?row.r:null,market:hb,overMarket,scale:sc,tf,iw:innerWidth,
      on:parts.every(p=>HB.inF(p)),vals:['resStamina','resGold','resGems'].map(id=>SL.txt('#'+id)),chipH:fb[0]?fb[0].h:0}; });
  CHIPS[S.tag]=r.chipH;
  const s=await shot(pg,S.tag+' currency row');
  const small=r.iw<1100, scOk=small?Math.abs(r.scale-0.72)<0.01:r.scale<=1.0001;
  C.ok(r.n===3&&r.ys<=2&&r.order&&r.rowR!=null&&r.rowR<=r.menuL+1&&r.overMarket===0&&scOk&&r.on&&r.vals.every(v=>v.length>0),
    S.tag+' Currency row: food, gold and diamond chips in one row (centres within '+r.ys+' px), row ends at '+r.rowR+' left of MENU at '+r.menuL+', clear of the Market box, scale '+r.scale+(small?' (0.72 wanted under 1100 px)':' (full size or less on PC)'),
    Object.assign({shot:s},r)); }

/* ---------------- Building tap boxes ---------------- */
const BKEYS=['wall','wall','market','shadymarket','temple','campaign','tech','rankings','dungeon','wishing','arena','watchtower','guild','skyisland','cauldron','forge','well'];
async function tapboxes(pg,S){ await goHome(pg); await prep(pg);
  const P=await pg.evaluate(KEYS=>{ const hots=[...document.querySelectorAll('#townHots .hot')], witch=(t('bld.witches_hut')||'').trim();
    const keyOf=el=>{ if(!el) return null; const h=el.closest('#townHots .hot'); if(h) return KEYS[hots.indexOf(h)]||'?';
      const l=el.closest('#townHots .townlbl'); if(l){ const tx=l.textContent.trim(); return (witch&&tx.startsWith(witch))?'cauldron':(l.dataset.nav||'?'); } return null; };
    const desc=el=>el?(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/)[0]:'')):'nothing';
    const boxes=hots.map(HB.B), over=[];
    for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) if(KEYS[i]!==KEYS[j]&&SL.overlap(boxes[i],boxes[j])) over.push(KEYS[i]+'#'+i+' x '+KEYS[j]+'#'+j);
    const out=[];
    hots.forEach((h,i)=>{ const hit=h.querySelector('.hit');
      const anc=[]; for(let a=hit.parentElement;a;a=a.parentElement){ const cs=getComputedStyle(a); if(/hidden|clip/.test(cs.overflowX+' '+cs.overflowY)||a===document.documentElement||a===document.body) anc.push([a,a.scrollLeft,a.scrollTop]); }
      hit.scrollIntoView({block:'center',inline:'center'}); for(const [a,l,t] of anc){ a.scrollLeft=l; a.scrollTop=t; }
      const b=HB.B(hit), f=HB.F(), pts=[[.5,.5],[.08,.08],[.92,.08],[.08,.92],[.92,.92]].map(([fx,fy])=>{ const x=b.x+b.w*fx, y=b.y+b.h*fy;
        if(x<f.x||y<f.y||x>f.r-1||y>f.b-1) return {fx,fy,off:true};
        const el=document.elementFromPoint(x,y), k=keyOf(el); return {fx,fy,x:Math.round(x),y:Math.round(y),k,who:desc(el)}; });
      out.push({i,key:KEYS[i],box:b,pts}); });
    return {n:hots.length,over,out}; },BKEYS);
  const s=await shot(pg,S.tag+' building tap boxes');
  const wrong=[], hud=[], off=[];
  for(const o of P.out) for(const p of o.pts){ if(p.off) off.push(o.key+'#'+o.i+'@'+p.fx+','+p.fy); else if(p.k&&p.k!==o.key) wrong.push(o.key+'#'+o.i+'@'+p.fx+','+p.fy+' opens '+p.k+' ('+p.who+')'); else if(!p.k) hud.push(o.key+'#'+o.i+'@'+p.fx+','+p.fy+' '+p.who); }
  if(hud.length) console.log('  INFO   '+S.tag+' Building tap boxes: points under the HUD (open no building): '+hud.join('; '));
  if(off.length) console.log('  INFO   '+S.tag+' Building tap boxes: points outside the screen after scrolling the town: '+off.join('; '));
  C.ok(P.n===17&&P.over.length===0&&wrong.length===0,S.tag+' Building tap boxes: all '+P.n+' boxes probed at the centre and 4 corners - no point opens another building, no two boxes overlap',
    {shot:s,overlaps:P.over,wrong,hudCovered:hud.length,offScreen:off.length,boxes:P.out.map(o=>o.key+' '+o.box.x+','+o.box.y+' '+o.box.w+'x'+o.box.h)});
  /* a real tap on each box (a point of the box itself, not a plate) */
  const res=[];
  for(let i=0;i<17;i++){ await goHome(pg); await prep(pg);
    const pt=await pg.evaluate(([i,KEYS])=>{ const hots=[...document.querySelectorAll('#townHots .hot')], h=hots[i]; if(!h) return null; const hit=h.querySelector('.hit');
      const anc=[]; for(let a=hit.parentElement;a;a=a.parentElement){ const cs=getComputedStyle(a); if(/hidden|clip/.test(cs.overflowX+' '+cs.overflowY)||a===document.documentElement||a===document.body) anc.push([a,a.scrollLeft,a.scrollTop]); }
      hit.scrollIntoView({block:'center',inline:'center'}); for(const [a,l,t] of anc){ a.scrollLeft=l; a.scrollTop=t; }
      const b=HB.B(hit), f=HB.F();
      for(const [fx,fy] of [[.5,.5],[.5,.35],[.5,.65],[.35,.5],[.65,.5],[.3,.3],[.7,.7],[.3,.7],[.7,.3],[.2,.5],[.8,.5]]){ const x=b.x+b.w*fx, y=b.y+b.h*fy;
        if(x<f.x+2||y<f.y+2||x>f.r-2||y>f.b-2) continue; const el=document.elementFromPoint(x,y); if(el&&el.closest('.hit')===hit) return {x,y,fx,fy}; }
      return {none:true,box:b}; },[i,BKEYS]);
    if(!pt||pt.none){ res.push({i,key:BKEYS[i],tapped:false,why:'no point of the box is on top',pt}); continue; }
    if(S.touch) await pg.touchscreen.tap(pt.x,pt.y); else await pg.mouse.click(pt.x,pt.y);
    await H.wait(1600);
    const st=await pg.evaluate(()=>({state:typeof state!=='undefined'?state:null,tab:typeof WALL_TAB!=='undefined'?WALL_TAB:null,well:!!document.getElementById('wlMap')}));
    const k=BKEYS[i], ok=k==='cauldron'?(st.state==='wall'&&st.tab==='cauldron'):k==='wall'?(st.state==='wall'&&st.tab==='wall'):k==='well'?st.well:(st.state===k);
    res.push({i,key:k,at:[Math.round(pt.x),Math.round(pt.y)],opened:st,ok}); }
  const bad=res.filter(x=>!x.ok);
  C.ok(bad.length===0,S.tag+' Building tap boxes: a real '+(S.touch?'tap':'click')+' on each of the 17 boxes opens that building ('+(17-bad.length)+'/17)',{shot:s,bad,all:res.map(x=>x.key+(x.ok?' ok':' -> '+JSON.stringify(x.opened||x.why)))}); }

/* ---------------- Chat bar ---------------- */
async function chat(pg,S){ await goHome(pg); await prep(pg);
  await pg.waitForFunction(()=>{ const w=document.getElementById('chatWidget'); return w&&w.classList.contains('min')&&w.querySelector('.cw-head'); },null,{timeout:15000}).catch(()=>{});
  const r=await pg.evaluate(async()=>{ const w=document.getElementById('chatWidget'); if(!w) return {missing:true};
    const head=w.querySelector('.cw-head'), hb=HB.B(head), f=HB.F(), art=await SL.bgLoaded(head);
    const sp=head.querySelector('span'); let tn=null; if(sp) for(const n of sp.childNodes) if(n.nodeType===3&&n.textContent.trim()){ tn=n; break; }
    let tb=null; if(tn){ const rg=document.createRange(); rg.selectNodeContents(tn); const b=rg.getBoundingClientRect(); tb={x:+b.left.toFixed(1),r:+b.right.toFixed(1),y:+b.top.toFixed(1),b:+b.bottom.toFixed(1)}; }
    const pl=hb.x+hb.w*21/276, pb=hb.b-hb.h*3/46, iconR=hb.x+hb.w*58/276;
    return {min:w.classList.contains('min'),vis:SL.vis(head),head:hb,frame:f,art:art.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),artOk:art.some(x=>x.ok&&/hud2\/chat-bar/.test(x.url)),
      gapL:+(pl-f.x).toFixed(1),gapB:+(f.b-pb).toFixed(1),word:tn?tn.textContent.trim():null,wordBox:tb,iconR:+iconR.toFixed(1),front:SL.front(head,.6,.5)}; });
  const s=await shot(pg,S.tag+' chat bar');
  if(r.missing){ C.ok(false,S.tag+' Chat bar: the town shows the minimised chat bar',{shot:s,missing:true}); return; }
  const snug=r.gapL>=-1&&r.gapL<=10&&r.gapB>=-1&&r.gapB<=10, clear=!!r.wordBox&&r.wordBox.x>=r.iconR-0.5&&r.wordBox.r<=r.head.r;
  C.ok(r.min&&r.vis&&r.artOk&&snug&&clear&&r.front,S.tag+' Chat bar: the painted chat bar (chat-bar.webp) sits snug in the bottom-left corner (painted edge '+r.gapL+' px from the left, '+r.gapB+' px from the bottom) and "'+r.word+'" starts at '+(r.wordBox&&r.wordBox.x)+', clear of the bar icon (ends '+r.iconR+')',
    Object.assign({shot:s,snug,clear},r)); }

/* ---------------- Fits a phone (MENU) ---------------- */
async function menu(pg,S){ await goHome(pg); await prep(pg);
  const how=await press(pg,S.touch,'#menuBtn'); await H.wait(700); await prep(pg);
  const r0=await pg.evaluate(()=>{ const p=document.getElementById('menuPanel'); return {open:document.getElementById('hubMenu').classList.contains('open'),panel:HB.B(p),panelOn:HB.inF(HB.B(p)),sc:SL.scrolls(p),
    items:[...p.querySelectorAll('.mitem')].filter(m=>SL.vis(m)).map(m=>({nav:m.dataset.nav||m.id,box:HB.B(m),on:HB.inF(HB.B(m)),front:SL.front(m)}))}; });
  const s=await shot(pg,S.tag+' MENU open');
  const reach=[];
  for(const it of r0.items){ if(it.on&&it.front){ reach.push({nav:it.nav,ok:true,how:'on screen'}); continue; }
    const r=await pg.evaluate(nav=>{ const p=document.getElementById('menuPanel'), m=[...p.querySelectorAll('.mitem')].find(x=>(x.dataset.nav||x.id)===nav);
      const sc=SL.scrolls(p); if(!sc||!sc.canY) return {ok:false,how:'panel cannot scroll',box:HB.B(m)};
      const before=p.scrollTop; const pb=p.getBoundingClientRect(), mb=m.getBoundingClientRect(); p.scrollTop+=(mb.top+mb.height/2)-(pb.top+pb.height/2);
      const b=HB.B(m), ok=HB.inF(b)&&SL.front(m)&&b.y>=pb.top-1&&b.b<=pb.bottom+1; const out={ok,how:'scrolled '+before+' -> '+p.scrollTop,box:b}; return out; },it.nav);
    reach.push(Object.assign({nav:it.nav},r)); }
  const s2=reach.some(x=>/scrolled/.test(x.how))?await shot(pg,S.tag+' MENU scrolled'):null;
  C.ok(r0.open&&r0.panelOn&&r0.items.length>=7&&reach.every(x=>x.ok),S.tag+' Fits a phone: MENU opened ('+how+'), the panel is on screen and all '+r0.items.length+' medallions are reachable ('+reach.filter(x=>x.how==='on screen').length+' on screen, '+reach.filter(x=>/scrolled/.test(x.how)).length+' by scrolling the panel)',
    {shot:s,shot2:s2,panel:r0.panel,scroll:r0.sc,reach});
  await pg.evaluate(()=>{ try{ document.getElementById('hubMenu').classList.remove('open'); }catch(e){} }); }

/* ---------------- Centred pop-outs ---------------- */
const popMeasure=(pg,id)=>pg.evaluate(async id=>{ const el=document.getElementById(id); if(!el) return {missing:true};
  const b=HB.B(el), f=HB.F(), cs=getComputedStyle(el), fu=HB.urlOf(cs.borderImageSource), art=fu?await SL.loadImg(fu):null;
  const bw=['Top','Right','Bottom','Left'].map(k=>parseFloat(cs['border'+k+'Width'])||0);
  return {active:el.classList.contains('active'),popout:el.classList.contains('popout'),box:b,frame:f,gaps:{l:+(b.x-f.x).toFixed(1),r:+(f.r-b.r).toFixed(1),t:+(b.y-f.y).toFixed(1),b:+(f.b-b.b).toFixed(1)},
    borderImage:fu?fu.replace(location.origin,''):null,artOk:!!(art&&art.ok),borderWidths:bw,biWidth:cs.borderImageWidth}; },id);
const popOk=m=>!m.missing&&m.active&&m.popout&&Math.abs(m.gaps.l-m.gaps.r)<=4&&Math.abs(m.gaps.t-m.gaps.b)<=4&&Object.values(m.gaps).every(g=>g>=-1)&&m.artOk&&/hud-panel/.test(m.borderImage||'')&&m.borderWidths.every(w=>w>0);
async function openHeroes(pg,S){ await goHome(pg);
  await press(pg,S.touch,'#menuBtn'); await H.wait(600);
  const how=await press(pg,S.touch,'#menuPanel .mitem[data-nav="heroesPanel"]');
  await pg.waitForFunction(()=>{ const e=document.getElementById('heroesPanel'); return e&&e.classList.contains('active')&&e.classList.contains('popout')&&document.querySelectorAll('#heroList .hero-card').length>0; },null,{timeout:20000}).catch(()=>{});
  await H.wait(1500); await H.clean(pg); await prep(pg); return how; }
async function popouts(pg,S){
  const how=await openHeroes(pg,S);
  const m1=await popMeasure(pg,'heroesPanel'); const s1=await shot(pg,S.tag+' Heroes pop-out');
  C.ok(popOk(m1),S.tag+' Centred pop-outs: the Heroes window (opened from MENU by '+how+') is centred (gaps '+JSON.stringify(m1.gaps)+') with the gold frame on all four sides (border '+JSON.stringify(m1.borderWidths)+')',Object.assign({shot:s1},m1));
  /* a hero window: tap an owned hero's card */
  const sel=await pg.evaluate(()=>{ const c=[...document.querySelectorAll('#heroList .hero-card')].find(x=>x._pick&&!x.classList.contains('locked')); if(!c) return null; c.id=c.id||'slHeroCard'; c.scrollIntoView({block:'center'}); return '#'+c.id; });
  let how2='none';
  if(sel){ how2=await press(pg,S.touch,sel); await H.wait(900);
    const ok=await pg.evaluate(()=>document.getElementById('heroDetail').classList.contains('active'));
    if(!ok){ how2+='+_pick'; await pg.evaluate(s=>document.querySelector(s)._pick(),sel); } }
  await pg.waitForFunction(()=>{ const e=document.getElementById('heroDetail'); return e&&e.classList.contains('active')&&e.classList.contains('popout'); },null,{timeout:20000}).catch(()=>{});
  await H.wait(1500); await H.clean(pg); await prep(pg);
  const m2=await popMeasure(pg,'heroDetail'); const s2=await shot(pg,S.tag+' hero window');
  C.ok(popOk(m2),S.tag+' Centred pop-outs: the hero window (tapped a hero card: '+how2+') is centred (gaps '+JSON.stringify(m2.gaps)+') with the gold frame on all four sides (border '+JSON.stringify(m2.borderWidths)+')',Object.assign({shot:s2},m2)); }

/* ---------------- Floating Isle fits ---------------- */
async function isle(pg,S){ await goHome(pg);
  const how=await H.openBuilding(pg,'skyisland',S.touch);
  await pg.waitForFunction(()=>document.getElementById('skyisland').classList.contains('active')&&document.querySelector('#skyIslandBody .islemap'),null,{timeout:30000}).catch(()=>{});
  await H.wait(1500); await prep(pg);
  const r=await pg.evaluate(async()=>{ const scr=document.getElementById('skyisland'), body=document.getElementById('skyIslandBody'), map=body&&body.querySelector('.islemap');
    if(!map) return {missing:true,active:scr.classList.contains('active')};
    const f=HB.F(), sb=HB.B(scr), mb=HB.B(map), art=await SL.bgLoaded(map);
    const covers=(a,b)=>a.x<=b.x+1&&a.y<=b.y+1&&a.r>=b.r-1&&a.b>=b.b-1;
    const pts=[]; for(let i=0;i<7;i++) for(let j=0;j<5;j++){ const x=f.x+f.w*(i+.5)/7, y=f.y+f.h*(j+.5)/5, el=document.elementFromPoint(x,y);
      const inMap=!!el&&(el===map||map.contains(el)), ui=!!el&&!!el.closest('button,.btn,.backbtn,.islespot,.titlebar,.hdrbox,h1,.sub,#muteBtn,#chatWidget,.popoutClose');
      if(!inMap&&!ui) pts.push({x:Math.round(x),y:Math.round(y),who:el?(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/)[0]:'')):'nothing',bg:el?getComputedStyle(el).backgroundColor:null}); }
    return {active:scr.classList.contains('active'),frame:f,screen:sb,map:mb,mapCoversScreen:covers(mb,sb),screenCoversFrame:covers(sb,f),
      art:art.map(x=>x.url.replace(location.origin,'').slice(0,90)+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),artOk:art.length>0&&art.every(x=>x.ok),
      scroll:{screen:SL.scrolls(scr),body:SL.scrolls(body),doc:SL.scrolls(document.scrollingElement)},offMap:pts}; });
  const s=await shot(pg,S.tag+' Floating Isle');
  if(r.missing){ C.ok(false,S.tag+' Floating Isle fits: the Island of Trials map is drawn [opened by '+how+']',{shot:s,r}); return; }
  const noScroll=['screen','body','doc'].every(k=>r.scroll[k]&&!r.scroll[k].canX&&!r.scroll[k].canY);
  C.ok(r.active&&r.mapCoversScreen&&r.screenCoversFrame&&r.artOk&&noScroll&&r.offMap.length===0,S.tag+' Floating Isle fits: the painted Island of Trials map ('+r.map.w+'x'+r.map.h+') fills the screen ('+r.frame.w+'x'+r.frame.h+'), nothing scrolls, no bare backdrop shows (35 sample points) [opened by '+how+']',
    Object.assign({shot:s,noScroll},r)); }

/* ---------------- battle: loading screen + fit ---------------- */
const HOOK=()=>{ if(window._slBLw) return; const o=window.showBattleLoader; window.showBattleLoader=function(){ const u=o.apply(this,arguments);
    if(u&&u.close&&window._slHold){ const c=u.close.bind(u); u.close=function(){ window._slBLc=c; }; } window._slBL=u; return u; }; window._slBLw=1; };
const loaderMeasure=pg=>pg.evaluate(async()=>{ const L=document.getElementById('battleLoader'); if(!L) return {missing:true};
  const cards=[...L.querySelectorAll('.bl-card')];
  const out=[]; for(const c of cards){ const side=c.classList.contains('foe')?'foe':(c.classList.contains('ally')?'ally':'');
    const cv=c.querySelector('canvas'), asc=c.querySelector('.ascf'), rbn=c.querySelector('.rbn'), st=c.querySelector('.ascf-st');
    const au=asc?HB.urlOf(getComputedStyle(asc).borderImageSource):null, aa=au?await SL.loadImg(au):null, ra=rbn?await SL.bgLoaded(rbn):[];
    out.push({side,lit:c.classList.contains('lit'),painted:cv?HB.canPaint(cv):0,box:HB.B(c),on:HB.inF(HB.B(c)),
      asc:au?au.replace(location.origin,'').replace(/\?.*/,'')+(aa&&aa.ok?' ok':' NOT LOADED'):null,ascOk:!!(aa&&aa.ok),
      banner:ra.map(x=>x.url.replace(location.origin,'').replace(/\?.*/,'')+(x.ok?' ok':' NOT LOADED')).join(','),bannerOk:ra.length>0&&ra.every(x=>x.ok),bannerText:rbn?SL.txt(rbn):null,
      stars:st?st.querySelectorAll('*').length:0}); }
  return {layout:L.className,cards:out}; });
async function waitLit(pg){ await pg.waitForFunction(()=>{ const L=document.getElementById('battleLoader'); if(!L) return false; const c=[...L.querySelectorAll('.bl-card')]; return c.length>0&&c.every(x=>x.classList.contains('lit')); },null,{timeout:30000}).catch(()=>{}); await H.wait(800); }
async function startFight(pg,S,hold){ await goHome(pg); await prep(pg);
  await pg.evaluate(h=>{ window._slHold=h; window._slBLc=null; },hold);
  await pg.evaluate(HOOK);
  await pg.evaluate(()=>show('campaign')); await H.wait(1500); await H.clean(pg);
  await pg.evaluate(()=>openStageModal(14,'normal'));
  await pg.waitForFunction(()=>document.getElementById('stageModal').classList.contains('active'),null,{timeout:20000});
  await H.wait(700); await press(pg,S.touch,'#smBattle');
  await pg.waitForFunction(()=>state==='menu',null,{timeout:20000}); await H.wait(1500); await H.clean(pg);
  await pg.evaluate(()=>document.getElementById('startBtn').click());
  await pg.waitForFunction(()=>!!document.getElementById('battleLoader'),null,{timeout:30000}); }
async function releaseFight(pg){ await pg.evaluate(()=>{ window._slHold=false; if(window._slBLc){ const c=window._slBLc; window._slBLc=null; c(); } });
  await pg.waitForFunction(()=>state==='battle'&&!document.getElementById('battleLoader')&&units.length>0,null,{timeout:180000}); await H.wait(3000); await prep(pg); }
async function loading(pg,S){
  /* Arena: the game's own versus loader (the layout an Arena fight shows) with your five heroes against five enemy heroes */
  await goHome(pg); await prep(pg); await pg.evaluate(HOOK);
  const mine=Object.keys(HEROES).slice(0,5), foe=['oakmir','konwu','fritz','meridian','hurne'];
  await pg.evaluate(([m,f])=>{ window._slHold=true; window._slBLc=null; window._slVs=showBattleLoader({mine:m,foe:f,title:'ARENA'}); },[mine,foe]);
  await waitLit(pg); const a=await loaderMeasure(pg); const sa=await shot(pg,S.tag+' Arena versus loading cards');
  await pg.evaluate(()=>{ window._slHold=false; const c=window._slBLc; window._slBLc=null; if(c) c(); else { const e=document.getElementById('battleLoader'); if(e) e.remove(); } }); await H.wait(600);
  const ally=a.cards?a.cards.filter(c=>c.side==='ally'):[], foes=a.cards?a.cards.filter(c=>c.side==='foe'):[];
  const allyOk=c=>c.lit&&c.painted>0&&c.ascOk&&c.bannerOk&&c.stars>0&&c.on;
  C.ok(!a.missing&&ally.length===5&&foes.length===5&&ally.every(allyOk)&&foes.every(c=>c.lit&&c.painted>0&&c.bannerOk&&!c.asc&&c.stars===0&&c.on),
    S.tag+' Hero loading cards: Arena (the game\'s versus loader): your 5 heroes show the painted card, ascension border, rarity banner and stars; the 5 enemy heroes the painted card and banner only',
    {shot:sa,layout:a.layout,ally,foes});
  /* Campaign: a real fight from the map (2-4), the loading screen held open until measured */
  await startFight(pg,S,true); await waitLit(pg);
  const c=await loaderMeasure(pg); const sc=await shot(pg,S.tag+' campaign loading cards');
  const own=c.cards?c.cards.filter(x=>x.side==='ally'):[];
  C.ok(!c.missing&&own.length>=1&&own.every(allyOk),S.tag+' Hero loading cards: campaign 2-4 loading screen - each of your '+own.length+' heroes shows the painted card, rarity banner, ascension border and stars',
    {shot:sc,layout:c.layout,cards:c.cards});
  await releaseFight(pg); }

/* ---------------- Fold and tablet fit ---------------- */
const NOSCROLL=(...ids)=>ids.map(id=>{ const e=id==='doc'?document.scrollingElement:document.querySelector(id); const s=e?SL.scrolls(e):null; return {id,canX:!!(s&&s.canX),canY:!!(s&&s.canY)}; });
async function fitTown(pg,S){ await goHome(pg); await prep(pg);
  const r=await pg.evaluate(NS=>{ const NOS=eval(NS), f=HB.F(), L=HB.uni([...document.querySelectorAll('#leftHud > *')].filter(SL.vis).map(HB.B)), M=HB.B('#menuBtn'), T=HB.B('#townHud'), ch=document.querySelector('#chatWidget .cw-head');
    const pieces={leftHud:L,menu:M,currency:HB.uni([...document.querySelectorAll('#townHud .resframe')].map(HB.B)),chat:ch?HB.B(ch):null};
    const on={}; for(const k in pieces) on[k]=k==='chat'?(pieces.chat?pieces.chat.x>=f.x-25&&pieces.chat.b<=f.b+5&&pieces.chat.r<=f.r:false):HB.inF(pieces[k]);
    return {frame:f,pieces,on,leftTop:!!L&&L.x-f.x<=f.w*0.3&&L.y-f.y<=f.h*0.3,menuTopRight:!!M&&f.r-M.r<=f.w*0.2&&M.y-f.y<=f.h*0.25,scroll:NOS('doc','#app','#home')}; },'('+NOSCROLL.toString()+')');
  return r; }
async function fit(pg,S){
  const t=await fitTown(pg,S); const s1=await shot(pg,S.tag+' fit town');
  const ns=x=>x.every(s=>!s.canX&&!s.canY);
  C.ok(Object.values(t.on).every(Boolean)&&t.leftTop&&t.menuTopRight&&ns(t.scroll),S.tag+' Fold and tablet fit: town - Commander top-left, MENU top-right, the currency row and chat bar on screen, nothing scrolls',Object.assign({shot:s1},t));
  /* campaign map */
  await goHome(pg); await pg.evaluate(()=>show('campaign')); await H.wait(2500); await H.clean(pg); await prep(pg);
  const c=await pg.evaluate(NS=>{ const NOS=eval(NS), f=HB.F(), q=s=>HB.B(s);
    const pieces={base:q('#campaign .backbtn'),glossary:q('#campGlossBtn'),portalTabs:q('#portalTabs'),map:q('#cmapScroll')}, on={}; for(const k in pieces) on[k]=HB.inF(pieces[k],2);
    return {frame:f,pieces,on,baseTopLeft:!!pieces.base&&pieces.base.x-f.x<=f.w*0.15&&pieces.base.y-f.y<=f.h*0.15,glossTopRight:!!pieces.glossary&&f.r-pieces.glossary.r<=f.w*0.15&&pieces.glossary.y-f.y<=f.h*0.15,scroll:NOS('doc','#app','#campaign')}; },'('+NOSCROLL.toString()+')');
  const s2=await shot(pg,S.tag+' fit campaign');
  C.ok(Object.values(c.on).every(Boolean)&&c.baseTopLeft&&c.glossTopRight&&ns(c.scroll),S.tag+' Fold and tablet fit: campaign map - Base top-left, Glossary top-right, portal tabs and map on screen, the screen does not scroll',Object.assign({shot:s2},c));
  /* Heroes pop-out */
  await openHeroes(pg,S);
  const h=await pg.evaluate(NS=>{ const NOS=eval(NS), el=document.getElementById('heroesPanel'), x=el.querySelector('.popoutClose'), b=HB.B(el), xb=x?HB.B(x):null;
    return {frame:HB.F(),box:b,on:HB.inF(b),close:xb,closeOn:!!xb&&HB.inF(xb)&&SL.front(x),cards:[...document.querySelectorAll('#heroList .hero-card')].filter(SL.vis).length,scroll:NOS('doc','#app')}; },'('+NOSCROLL.toString()+')');
  const s3=await shot(pg,S.tag+' fit Heroes pop-out');
  C.ok(h.on&&h.closeOn&&h.cards>0&&ns(h.scroll),S.tag+' Fold and tablet fit: Heroes pop-out - the whole window and its close button on screen, the page does not scroll',Object.assign({shot:s3},h));
  /* a battle (the phone and desktop fight was started by the loading-card check) */
  const inFight=await pg.evaluate(()=>state==='battle'&&units.length>0&&!ended).catch(()=>false);
  if(!inFight){ await startFight(pg,S,false); await releaseFight(pg); }
  const b=await pg.evaluate(NS=>{ const NOS=eval(NS), f=HB.F(), p=document.getElementById('pauseBtn'), pb=HB.B(p), cv=HB.B('#three canvas')||HB.B('#three');
    return {state,frame:f,pause:pb,pauseOn:HB.inF(pb)&&SL.front(p),pauseCorner:!!pb&&(pb.y-f.y<=f.h*0.2)&&(pb.x-f.x<=f.w*0.2||f.r-pb.r<=f.w*0.2),view:cv,viewCovers:!!cv&&cv.x<=f.x+1&&cv.y<=f.y+1&&cv.r>=f.r-1&&cv.b>=f.b-1,
      scroll:NOS('doc','#app')}; },'('+NOSCROLL.toString()+')');
  const s4=await shot(pg,S.tag+' fit battle');
  C.ok(b.state==='battle'&&b.pauseOn&&b.pauseCorner&&b.viewCovers&&ns(b.scroll),S.tag+' Fold and tablet fit: battle - the battlefield fills the frame, the pause button on screen in its top corner, nothing scrolls',Object.assign({shot:s4},b)); }

const RUN={commander,currency,tapboxes,chat,menu,popouts,isle,loading,fit};

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.camp={cleared:160,stars:{},att:null}; for(let i=1;i<=160;i++) u.led.camp.stars[i]=3; u.led.stam={v:300,ts:Date.now()}; u.team=Object.keys(HEROES).slice(0,5); });
  const s=await H.server(file); let pg=null;
  try{
    for(const [S,lines] of PLAN){
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch}); await prep(pg);
      for(const k of lines){ try{ await RUN[k](pg,S); }catch(e){ fail(S,k,e); try{ await pg.evaluate(()=>{ const e=document.getElementById('battleLoader'); if(e&&!window._slHold) e.remove(); }); }catch(_){} } }
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
    /* chips are smaller on the phone sizes than on the desktop */
    const d=CHIPS[S_.desktop.tag], ph=[S_.phone.tag,S_.fold.tag].map(t=>CHIPS[t]);
    console.log('  INFO   Currency row: chip height per size '+JSON.stringify(CHIPS));
    C.ok(d>0&&ph.every(h=>h>0&&h<d),'Currency row: the chips are smaller on the phone and Fold cover than on the desktop',CHIPS);
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).replace(/Error:/g,'Err -').slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
