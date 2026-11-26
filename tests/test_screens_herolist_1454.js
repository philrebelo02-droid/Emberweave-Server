'use strict';
/* Lockdown audit 25 Nov 2026 (live v1454), Heroes building, the on-screen lines of heroes-A-list-to-skills.md and heroes-B-equipment-to-squad.md,
   in a real browser on this checkout's server (temp DB), at 1280x720 and 844x390 (phone landscape, touch):
   - In-game dropdowns: each filter in the Heroes list opens a game-styled menu ABOVE the hero cards (and their Temple orbs), capped in height so the
     last option is on screen and can be tapped (it applies the filter). Also the Fold cover 904x1136.
   - Grid layout: 5 hero cards to a full row, the Heroes window centred, the card size the same on the phone and the PC.
   - Tabs keep their place: every hero tab click leaves the tab row at the same height (under the pinned row), never back at the top.
   - Phone short layout: on the landscape phone the Talents tab uses the compact layout, and the hero window is really gone when it closes
     (Heroes -> hero -> Talents -> Skills -> Talents -> Heroes, real taps: display none, nothing of it under the town or the Heroes window).
   - Star track display: always five stars; the middle star large from the bronze 6th star (step 1); silver pips recolour the outer stars left to right,
     the middle star last; steps 0/1/2/3/4/5/6/11/16 read from the screen pixels (hero window and hero card).
   Every check prints what it measured. Exit 0 = all passed. */
const fs=require('fs'), path=require('path'), H=require('./helpers/screens-1450.js');
const C=H.checker('test_screens_herolist_1454.js');
const TRACK=+(/const REFINE_TRACK_V=(\d+)/.exec(fs.readFileSync(path.join(H.ROOT,'server/sim.js'),'utf8'))[1]);
/* star heroes: 5 stars at refine step N (the server's led.hero[k].ref, already on the v1369 track) */
const STARS={vael:0,vireo:1,sylthaine:2,lumi:3,umbris:4,grosk:5,aureth:6,brannus:11,calypsa:16};
const WANT={0:'BBBBB',1:'BBBBB',2:'SBBBB',3:'SSBBB',4:'SSBSB',5:'SSBSS',6:'SSSSS',11:'GGGGG',16:'MMMMM'};
const HEROES={vael:60,vireo:40,sylthaine:45,lumi:30,umbris:30,grosk:30,aureth:50,brannus:50,calypsa:40,dandra:30,vex:20,askel:30};

const openList=async pg=>{ await pg.evaluate(()=>{ document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); heroClassF='all'; heroElemF='all'; heroRarF='all'; heroSort='power'; closePopout(); popoutScreen('heroesPanel'); }); await H.wait(900); await H.clean(pg); };
const openHero=(pg,key,tab)=>pg.evaluate(([key,tab])=>{ document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); try{ talentCardHide(); }catch(e){}
  closePopout(); popoutScreen('heroesPanel'); detailHero=key; heroTab=tab; popoutScreen('heroDetail'); renderHeroDetail(); },[key,tab]);
const press=(pg,touch,sel)=>touch?pg.tap(sel):pg.click(sel);
const pressXY=(pg,touch,x,y)=>touch?pg.touchscreen.tap(x,y):pg.mouse.click(x,y);

// ---------------------------------------------------------------- In-game dropdowns
async function dropdowns(pg,tag,touch){
  await openList(pg);
  const n=await pg.evaluate(()=>document.querySelectorAll('#heroList .ewDDb').length);
  C.ok(n===4,tag+' the Heroes list has its 4 filter / sort dropdowns',{n});
  const vars=['heroClassF','heroElemF','heroRarF','heroSort'];
  for(let i=0;i<n;i++){
    await openList(pg);
    await pg.evaluate(i=>document.querySelectorAll('#heroList .ewDDb')[i].scrollIntoView({block:'nearest'}),i); await H.wait(200);
    const b=pg.locator('#heroList .ewDDb').nth(i); if(touch) await b.tap(); else await b.click(); await H.wait(350);
    const m=await pg.evaluate(i=>{ const b=document.querySelectorAll('#heroList .ewDDb')[i], m=b.parentElement.querySelector('.ewDDm'); if(!m||m.hidden) return {open:false};
      const V=ewGameView(), g=m.ewGameRect(), r=m.getBoundingClientRect(), cs=getComputedStyle(m), bcs=getComputedStyle(b);
      /* is the menu the top thing everywhere on it? a 5 x 5 grid of points inside it */
      let mine=0, total=0, other=[]; for(let a=1;a<=5;a++) for(let c=1;c<=5;c++){ const x=r.left+r.width*a/6, y=r.top+r.height*c/6; if(y<0||y>innerHeight||x<0||x>innerWidth) continue; total++;
        const e=document.elementFromPoint(x,y); if(e&&m.contains(e)) mine++; else if(other.length<3) other.push(e?(e.className||e.tagName):null); }
      /* the cards' Temple orbs under the menu: the menu wins at every overlap */
      const orbs=[...document.querySelectorAll('#heroList .hero-card .tOrbs')].map(o=>o.getBoundingClientRect()).filter(o=>o.width>0&&o.right>r.left&&o.left<r.right&&o.bottom>r.top&&o.top<r.bottom);
      const orbWin=orbs.every(o=>{ const x=(Math.max(o.left,r.left)+Math.min(o.right,r.right))/2, y=(Math.max(o.top,r.top)+Math.min(o.bottom,r.bottom))/2; const e=document.elementFromPoint(x,y); return !!e&&m.contains(e); });
      const cards=[...document.querySelectorAll('#heroList .hero-card')].map(o=>o.getBoundingClientRect()).filter(o=>o.right>r.left&&o.left<r.right&&o.bottom>r.top&&o.top<r.bottom).length;
      const opts=[...m.querySelectorAll('.ewDDo')], last=opts[opts.length-1];
      m.scrollTop=m.scrollHeight; const lr=last.getBoundingClientRect(), lg=last.ewGameRect(), mr=m.getBoundingClientRect();
      const hit=document.elementFromPoint(lr.left+lr.width/2,lr.top+lr.height/2);
      return {open:true,opts:opts.length,last:last.textContent,lastV:last.dataset.v,menu:{top:Math.round(g.top),bottom:Math.round(g.bottom),h:Math.round(g.height)},game:{w:Math.round(V.width),h:Math.round(V.height)},
        maxH:cs.maxHeight,scrolls:m.scrollHeight>m.clientHeight+1,scrollH:m.scrollHeight,clientH:m.clientHeight,inGame:g.top>=-1&&g.bottom<=V.height+1,
        lastOn:lg.top>=-1&&lg.bottom<=V.height+1&&lr.top>=mr.top-1&&lr.bottom<=mr.bottom+1,lastHit:!!hit&&(hit===last||last.contains(hit)),lastXY:[lr.left+lr.width/2,lr.top+lr.height/2],
        onTop:mine+'/'+total,other,orbsUnder:orbs.length,orbWin,cardsUnder:cards,z:cs.zIndex,bg:cs.backgroundColor,border:cs.borderTopColor,font:bcs.fontFamily.split(',')[0]}; },i);
    if(!m.open){ C.ok(false,tag+' dropdown '+(i+1)+' opens',m); continue; }
    C.ok(m.inGame&&m.lastOn&&m.lastHit,tag+' dropdown '+(i+1)+': the menu is inside the game area (or scrolls) and its last option "'+m.last+'" is on screen and is the thing under the finger',
      {menu:m.menu,game:m.game,maxH:m.maxH,scrolls:m.scrolls,opts:m.opts,lastHit:m.lastHit});
    const [top,tot]=m.onTop.split('/').map(Number);
    C.ok(top===tot&&tot>0&&m.orbWin&&m.cardsUnder>0,tag+' dropdown '+(i+1)+': drawn above the hero cards (every point of the menu is the menu; '+m.orbsUnder+' Temple orb rows under it, the menu wins there too)',
      {onTop:m.onTop,other:m.other,cardsUnder:m.cardsUnder,orbsUnder:m.orbsUnder,z:m.z});
    C.ok(m.bg==='rgb(11, 17, 34)'&&m.border==='rgb(201, 162, 78)'&&/Georgia/.test(m.font),tag+' dropdown '+(i+1)+': game-styled menu (dark navy, gold border, Georgia button), not the browser\'s own list',{bg:m.bg,border:m.border,font:m.font});
    /* tap the last option where it is on screen: the filter applies, the menu closes */
    await pressXY(pg,touch,m.lastXY[0],m.lastXY[1]); await H.wait(500);
    const after=await pg.evaluate(([v])=>({val:window[v]!==undefined?window[v]:eval(v),open:[...document.querySelectorAll('#heroList .ewDDm')].some(x=>!x.hidden)}),[vars[i]]);
    C.ok(String(after.val)===String(m.lastV)&&!after.open,tag+' dropdown '+(i+1)+': tapping the last option applies it ('+vars[i]+' = '+after.val+') and closes the menu',after);
  }
  await openList(pg);
}

// ---------------------------------------------------------------- Grid layout
async function grid(pg,tag){
  await openList(pg);
  const g=await pg.evaluate(()=>{ const V=ewGameView(), p=document.getElementById('heroesPanel'), pr=p.ewGameRect();
    const cards=[...document.querySelectorAll('#heroList .hero-card')].filter(c=>c.offsetParent!==null), rows=new Map();
    cards.forEach(c=>{ const t=Math.round(c.offsetTop); if(!rows.has(t)) rows.set(t,[]); rows.get(t).push(c); });
    const counts=[...rows.values()].map(r=>r.length), widths=cards.map(c=>Math.round(c.ewGameRect().width*10)/10), list=document.getElementById('heroList').ewGameRect();
    return {cards:cards.length,rows:counts.length,perRow:counts,widthMin:Math.min(...widths),widthMax:Math.max(...widths),cardH:Math.round(cards[0].ewGameRect().height),
      panel:{left:Math.round(pr.left),right:Math.round(V.width-pr.right),w:Math.round(pr.width)},game:{w:Math.round(V.width),h:Math.round(V.height)},popout:p.classList.contains('popout'),
      listW:Math.round(list.width),cols:getComputedStyle(document.getElementById('heroList')).gridTemplateColumns.split(' ').length}; });
  const full=g.perRow.slice(0,-1), lastRow=g.perRow[g.perRow.length-1];
  C.ok(g.cols===5&&full.length>3&&full.every(n=>n===5)&&lastRow>=1&&lastRow<=5,tag+' Grid layout: 5 hero cards to every full row ('+g.cards+' cards, '+g.rows+' rows, last row '+lastRow+')',{cols:g.cols,perRow:g.perRow.join(',')});
  C.ok(g.popout&&Math.abs(g.panel.left-g.panel.right)<=2,tag+' Grid layout: the Heroes window is centred (left gap '+g.panel.left+' px, right gap '+g.panel.right+' px)',{panel:g.panel,game:g.game});
  C.ok(g.widthMax-g.widthMin<=1,tag+' Grid layout: every card the same size',{min:g.widthMin,max:g.widthMax,h:g.cardH});
  return g; }

// ---------------------------------------------------------------- Tabs keep their place
async function tabs(pg,tag,touch){
  await openList(pg);
  await openHero(pg,'vael','stats'); await H.wait(700); await H.clean(pg);
  const names=await pg.evaluate(()=>[...document.querySelectorAll('#heroDetailBody .hd-tab')].map(b=>b.dataset.tab));
  const order=names.filter(t=>t!=='stats').concat(['stats']).concat(names.filter(t=>t!=='stats').reverse());
  const rows=[];
  for(const tb of order){
    await press(pg,touch,'#heroDetailBody .hd-tab[data-tab="'+tb+'"]'); await H.wait(700);
    rows.push(await pg.evaluate(tb=>{ const host=document.getElementById('heroDetail'), bar=document.querySelector('#heroDetailBody .hd-tabbar'), pin=host.querySelector('.ew-pinned-exits');
      const br=bar.ewGameRect(), pr=pin&&pin.ewGameRect(), V=ewGameView();
      return {tab:tb,on:heroTab,short:host.classList.contains('tl-short'),barTop:Math.round(br.top*10)/10,pinBottom:pr?Math.round(pr.bottom*10)/10:null,scrollTop:Math.round(host.scrollTop),onScreen:br.top>=-1&&br.bottom<=V.height+1}; },tb));
  }
  const tops=rows.filter(r=>!r.short).map(r=>r.barTop), spread=Math.max(...tops)-Math.min(...tops), shorts=rows.filter(r=>r.short);
  const under=rows.filter(r=>!r.short).every(r=>r.pinBottom==null||Math.abs(r.barTop-(r.pinBottom+2))<=2);
  C.ok(rows.every(r=>r.on===r.tab)&&tops.length>=8&&spread<=2&&under&&rows.every(r=>r.onScreen),tag+' Tabs keep their place: '+tops.length+' tab clicks ('+order.join(' > ')+'), the tab row at the same height every time (spread '+spread.toFixed(1)+' px), right under the pinned row, on screen',
    rows.map(r=>r.tab+(r.short?' (short)':'')+' top '+r.barTop+' pin '+r.pinBottom+' scroll '+r.scrollTop).join('; '));
  C.ok(rows.some(r=>!r.short&&r.scrollTop>0)||rows.every(r=>!r.short&&r.scrollTop===0&&Math.abs(r.barTop-(r.pinBottom+2))<=2),tag+' Tabs keep their place: the window stays scrolled to the tab row (no jump back to the top)',{scrollTops:rows.map(r=>r.scrollTop).join(',')});
  if(shorts.length) console.log('  info '+tag+' Talents (short layout, its own layout): '+JSON.stringify(shorts[0]));
}

// ---------------------------------------------------------------- Phone short layout (844x390 touch)
async function shortLayout(pg,tag){
  await openList(pg);
  await pg.evaluate(()=>{ const c=document.querySelector('#heroList .hero-card[data-hero-key="vael"]'); if(c) c.scrollIntoView({block:'center'}); }); await H.wait(300);
  await pg.tap('#heroList .hero-card[data-hero-key="vael"]'); await H.wait(900); await H.clean(pg);
  const opened=await pg.evaluate(()=>({state,detailHero,active:document.getElementById('heroDetail').classList.contains('active')}));
  C.ok(opened.detailHero==='vael'&&opened.active,tag+' a tap on the Vael card opens his hero window',opened);
  const step=async tb=>{ await pg.tap('#heroDetailBody .hd-tab[data-tab="'+tb+'"]'); await H.wait(800); };
  const lay=()=>pg.evaluate(()=>{ const h=document.getElementById('heroDetail'), V=ewGameView(), q=s=>document.querySelector(s), R=e=>e?e.ewGameRect():null;
    const left=q('#heroDetail .hd-left'), pw=q('#heroDetail .hd-power'), bar=q('#heroDetailBody .hd-tabbar'), panel=q('#heroDetail .tl-panel'), lr=R(left), br=R(bar), pr=R(panel);
    return {short:h.classList.contains('tl-short'),display:getComputedStyle(h).display,game:Math.round(V.width)+'x'+Math.round(V.height),headerH:lr?Math.round(lr.height):null,power:pw?getComputedStyle(pw).display:null,
      tabsTop:br?Math.round(br.top):null,board:pr?{top:Math.round(pr.top),bottom:Math.round(pr.bottom),w:Math.round(pr.width)}:null,boardOn:!!pr&&pr.top>=-1&&pr.bottom<=V.height+1&&pr.height>100,hostScroll:h.scrollHeight-h.clientHeight}; });
  await step('talents'); const t1=await lay();
  C.ok(t1.short&&t1.display==='flex'&&t1.headerH<=40&&t1.power==='none'&&t1.boardOn&&t1.tabsTop<=60,tag+' Phone short layout: the Talents tab uses the compact layout (slim header strip '+t1.headerH+' px, tabs at y '+t1.tabsTop+', the board on screen, no power line)',t1);
  await step('skills'); const s1=await lay();
  C.ok(!s1.short,tag+' the Skills tab leaves the compact layout',{short:s1.short,display:s1.display});
  await step('talents'); const t2=await lay();
  C.ok(t2.short,tag+' back on Talents: compact again',{short:t2.short});
  /* Heroes (the window's back button), real tap */
  await pg.tap('#heroDetail .backbtn'); await H.wait(1000);
  const gone=await pg.evaluate(()=>{ const h=document.getElementById('heroDetail'), cs=getComputedStyle(h), V=innerWidth, Hh=innerHeight, hits=[];
    for(let a=1;a<=7;a++) for(let c=1;c<=5;c++){ const els=document.elementsFromPoint(V*a/8,Hh*c/6); if(els.some(e=>h.contains(e))) hits.push([Math.round(V*a/8),Math.round(Hh*c/6)]); }
    return {state,display:cs.display,active:h.classList.contains('active'),short:h.classList.contains('tl-short'),heroesOpen:document.getElementById('heroesPanel').classList.contains('active'),pointsHittingHeroWindow:hits.length,at:hits.slice(0,3),rect:Math.round(h.getBoundingClientRect().width)+'x'+Math.round(h.getBoundingClientRect().height)}; });
  C.ok(gone.display==='none'&&!gone.active&&gone.heroesOpen&&gone.pointsHittingHeroWindow===0,tag+' Phone short layout hides properly: after Heroes > hero > Talents > Skills > Talents > Heroes the hero window is display:none, the Heroes window shows, and no point of the screen (35 sampled) reaches the closed hero window',gone);
}

// ---------------------------------------------------------------- Star track display
/* the colour of each star art file, measured from the file the page loads (the mean colour of its painted pixels) */
const REF=`(async()=>{ const out={}; for(const t of ['bronze','silver','gold','mythical']){ const im=new Image(); im.src=heroStarUrl(t); await im.decode().catch(()=>{});
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.drawImage(im,0,0,64,64); const d=g.getImageData(16,16,32,32).data; let r=0,gg=0,b=0,n=0;
  for(let i=0;i<d.length;i+=4){ if(d[i+3]<200) continue; r+=d[i]; gg+=d[i+1]; b+=d[i+2]; n++; } out[t]=n?[Math.round(r/n),Math.round(gg/n),Math.round(b/n)]:null; } return out; })()`;
async function stars(pg,tag){
  const ref=await pg.evaluate(REF);
  console.log('  info star art colours (mean of the painted middle of each file): '+JSON.stringify(ref));
  const L={bronze:'B',silver:'S',gold:'G',mythical:'M'};
  const classify=rgb=>{ let best=null, bd=1e9; for(const [t,c] of Object.entries(ref)){ if(!c) continue; const d=Math.hypot(rgb[0]-c[0],rgb[1]-c[1],rgb[2]-c[2]); if(d<bd){ bd=d; best=t; } } return {t:best,d:Math.round(bd)}; };
  const shot=async(sel)=>{ const loc=pg.locator(sel).first(); await loc.scrollIntoViewIfNeeded().catch(()=>{}); await H.wait(250);
    await pg.waitForFunction(s=>{ const e=document.querySelector(s); return !!e; },sel).catch(()=>{});
    const buf=await loc.screenshot({animations:'disabled'});
    return pg.evaluate(async([b64,sel])=>{ const e=document.querySelector(sel), er=e.getBoundingClientRect(); const im=new Image(); im.src='data:image/png;base64,'+b64; await im.decode();
      const k=im.width/er.width, c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const g=c.getContext('2d'); g.drawImage(im,0,0);
      return [...e.querySelectorAll('svg')].map(s=>{ const r=s.getBoundingClientRect(), x=(r.left-er.left+r.width*0.38)*k, y=(r.top-er.top+r.height*0.40)*k, w=r.width*0.24*k, h=r.height*0.24*k;
        const d=g.getImageData(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h))).data; let R=0,G=0,B=0,n=0; for(let i=0;i<d.length;i+=4){ R+=d[i]; G+=d[i+1]; B+=d[i+2]; n++; }
        const href=[...s.querySelectorAll('image')].map(i=>i.getAttribute('href')).pop()||'';
        return {w:Math.round(r.width),rgb:[Math.round(R/n),Math.round(G/n),Math.round(B/n)],art:(href.match(/hero-stars\/([^.?]+)/)||[])[1]}; }); },[buf.toString('base64'),sel]); };
  for(const [k,step] of Object.entries(STARS)){
    await openHero(pg,k,'stats'); await H.wait(700); await H.clean(pg);
    await pg.waitForFunction(()=>[...document.querySelectorAll('#hdStars image')].length>=5,null,{timeout:15000}).catch(()=>{});
    await H.wait(500);
    const lv=await pg.evaluate(k=>({stars:heroStars(k),refine:refineLevel(k)}),k);
    const row=await shot('#hdStars');
    const got=row.map(s=>L[classify(s.rgb).t]||'?').join(''), widths=row.map(s=>s.w), mid=widths[2], outer=[widths[0],widths[1],widths[3],widths[4]];
    const bigOk=step>=1?(outer.every(w=>w===outer[0])&&mid>=outer[0]*1.25):(widths.every(w=>w===widths[0]));
    C.ok(lv.stars===5&&lv.refine===step&&row.length===5&&got===WANT[step]&&bigOk,tag+' Star track, hero window, '+k+' step '+step+': five stars, read from the screen pixels '+got+' (want '+WANT[step]+'), middle star '+(step>=1?'large':'normal')+' ('+widths.join('/')+' px)',
      {stars:lv.stars,refine:lv.refine,rgb:row.map(s=>s.rgb.join(',')).join(' | '),art:row.map(s=>s.art).join(','),dist:row.map(s=>classify(s.rgb).d).join(',')});
  }
  /* the same rows on the Heroes list cards (the plate's star row) */
  await openList(pg); const cardRows=[];
  for(const [k,step] of Object.entries(STARS)){ const sel='#heroList .hero-card[data-hero-key="'+k+'"] .ascf-st';
    const has=await pg.evaluate(s=>!!document.querySelector(s),sel); if(!has){ cardRows.push(k+' none'); continue; }
    const row=await shot(sel); const got=row.map(s=>L[classify(s.rgb).t]||'?').join(''); cardRows.push({k,step,got,want:WANT[step],w:row.map(s=>s.w).join('/')}); }
  C.ok(cardRows.every(r=>typeof r==='object'&&r.got===r.want),tag+' Star track, Heroes list cards: every hero card shows the same five-star colours as its hero window',cardRows.map(r=>typeof r==='object'?r.k+' '+r.step+': '+r.got+' ('+r.w+')':r).join('; '));
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.refTrack=TRACK; u.led.gold=100000; for(const [k,st] of Object.entries(STARS)){ u.led.hero[k].stars=5; u.led.hero[k].pips=0; u.led.hero[k].ref=st; } });
  const s=await H.server(file); let pg=null; const grids={};
  try{
    const back=s.disk().led.hero; console.log('  seed: stars/ref on the server '+Object.keys(STARS).map(k=>k+' '+back[k].stars+'/'+back[k].ref).join(', '));
    for(const [w,h,touch,tag] of [[1280,720,false,'1280x720'],[844,390,true,'844x390']]){
      pg=await H.game(s.port,{w,h,touch});
      try{ await dropdowns(pg,tag,touch); }catch(e){ C.ok(false,tag+' dropdown part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      try{ grids[tag]=await grid(pg,tag); }catch(e){ C.ok(false,tag+' grid part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      try{ await tabs(pg,tag,touch); }catch(e){ C.ok(false,tag+' tabs part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      if(touch) try{ await shortLayout(pg,tag); }catch(e){ C.ok(false,tag+' short layout part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      try{ await stars(pg,tag); }catch(e){ C.ok(false,tag+' star part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null;
    }
    const a=grids['1280x720'], b=grids['844x390'];
    if(a&&b) C.ok(Math.abs(a.widthMin-b.widthMin)<=2&&a.widthMin>=100&&b.widthMin>=90,'Grid layout keeps the card size: 1280x720 card '+a.widthMin+' px, 844x390 card '+b.widthMin+' px (same window width '+a.panel.w+' / '+b.panel.w+')',{pc:a.widthMin+'x'+a.cardH,phone:b.widthMin+'x'+b.cardH});
    /* the Fold cover (904x1136, touch): the dropdown menus only */
    pg=await H.game(s.port,{w:904,h:1136,touch:true});
    try{ await dropdowns(pg,'904x1136',true); }catch(e){ C.ok(false,'904x1136 dropdown part ran to the end',String(e&&e.stack||e).slice(0,500)); }
    await pg._ctx.close(); pg=null;
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
