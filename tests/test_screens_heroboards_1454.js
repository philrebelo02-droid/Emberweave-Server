'use strict';
/* Lockdown audit 25 Nov 2026 (live v1454), Heroes building, heroes-B-equipment-to-squad.md on-screen lines, in a real browser on this checkout's
   server (temp DB), at 1280x720 and 844x390 (phone landscape, touch):
   - Six-slot glyph board: Heroes > hero > Glyphs shows the hero's six glyph slots (3 x 2) and the current glyph rank (= the server's board).
   - Talent board: the painted talent board per hero; a tap selects (learns nothing), Learn learns (screen and server), the tooltip shows beside the
     talent on hover (PC) / double tap (phone).
   Every check prints what it measured. Exit 0 = all passed. */
const path=require('path'), H=require('./helpers/screens-1450.js');
const T=require(path.join(H.ROOT,'talents.js'));
const C=H.checker('test_screens_heroboards_1454.js');
const HEROES={vael:10,aureth:10,sylthaine:45,vireo:30,brannus:60};
const NOW=Date.now();
const board=i=>({slots:[null,null,null,null,null,null],ascensionIndex:i,ascended:{},personalPathVersion:1});
const GLY={revision:3,fragments:{},subGlyphs:{},finished:{},boards:{vael:board(0),sylthaine:board(6),vireo:board(3)},audit:[],seq:1,migratedAt:NOW-5000,flow2At:NOW-5000};
const t1=hero=>T.trees(hero)[0].talents.find(t=>t[1]===1&&!t[7]);

const openHero=(pg,key,tab)=>pg.evaluate(([key,tab])=>{ document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); try{ talentCardHide(); }catch(e){}
  closePopout(); popoutScreen('heroesPanel'); detailHero=key; heroTab=tab; popoutScreen('heroDetail'); renderHeroDetail(); },[key,tab]);
const press=(pg,touch,sel)=>touch?pg.tap(sel):pg.click(sel);

async function glyphs(pg,tag,touch,s){
  const st=(await s.api('/api/glyphs/state')).body;
  for(const k of ['vael','vireo','sylthaine']){
    await openHero(pg,k,'stats'); await H.wait(600); await H.clean(pg);
    await press(pg,touch,'#heroDetailBody .hd-tab[data-tab="glyphs"]');
    await pg.waitForFunction(()=>document.querySelectorAll('#heroDetailBody .hd-armorgrid>div').length===6,null,{timeout:40000}).catch(()=>{}); await H.wait(800);
    const r=await pg.evaluate(async()=>{ const cells=[...document.querySelectorAll('#heroDetailBody .hd-armorgrid>div')], out=[];
      for(const c of cells){ c.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,120)); const im=c.querySelector('img'); for(let i=0;i<40&&im&&!im.complete;i++) await new Promise(r=>setTimeout(r,100));
        const r=c.getBoundingClientRect(), top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        out.push({x:Math.round(r.left),y:Math.round(r.top+document.getElementById('heroDetail').scrollTop),w:Math.round(r.width),h:Math.round(r.height),on:r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,front:!!top&&c.contains(top),
          img:!!im&&im.complete&&im.naturalWidth>0&&(im.getAttribute('src')||'')!==G2_FALLBACK}); }
      const pill=document.querySelector('#heroDetailBody .panel .pill'); pill.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,120)); const pr=pill.getBoundingClientRect();
      const b=g2board(detailHero), q0=RUNE2.cat.ladder[b.ascensionIndex];
      return {cells:out,pill:pill.textContent.trim(),pillOn:pr.width>0&&pr.top>=-1&&pr.bottom<=innerHeight+1,pillColor:getComputedStyle(pill).color,idx:b.ascensionIndex,quality:g2QualName(q0),qualityColor:g2col(q0),max:RUNE2.cat.ladder.length,fmt:ewT('hero.glyph_step',{q:'@Q',n:'@N',max:'@M'})}; });
    const xs=[...new Set(r.cells.map(c=>c.x))].length, ys=[...new Set(r.cells.map(c=>c.y))].length, srvIdx=(st.boards[k]||{}).ascensionIndex;
    const want=r.fmt.replace('@Q',r.quality).replace('@N',String(srvIdx+1)).replace('@M',String(r.max));
    C.ok(r.cells.length===6&&r.cells.every(c=>c.on&&c.front&&c.img)&&((xs===3&&ys===2)||(xs===2&&ys===3)),tag+' Six-slot glyph board, '+k+': six slots ('+xs+' x '+ys+'), each on screen when scrolled to, not covered, its glyph art loaded',
      r.cells.map(c=>c.w+'x'+c.h+'@'+c.x+','+c.y+(c.on?'':' OFF')+(c.front?'':' COVERED')+(c.img?'':' NO-ART')).join(' | '));
    C.ok(r.idx===srvIdx&&r.pill===want&&r.pillOn,tag+' Six-slot glyph board, '+k+': the current glyph rank "'+r.pill+'" on screen = the server\'s board (step '+(srvIdx+1)+')',{shown:r.pill,want,server:srvIdx,colour:r.pillColor});
  }
}

async function talents(pg,tag,touch,s,key){
  await openHero(pg,key,'stats'); await H.wait(600); await H.clean(pg);
  await press(pg,touch,'#heroDetailBody .hd-tab[data-tab="talents"]'); await H.wait(900);
  await pg.waitForFunction(()=>[...document.querySelectorAll('#tlPnl img.tl-fr')].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});
  const p=await pg.evaluate(()=>{ const pn=document.getElementById('tlPnl'), el=pn&&pn.dataset.el, pw=document.getElementById('tlPw'), V=ewGameView(), r=pw.ewGameRect();
    const fr=[...pn.querySelectorAll('img.tl-fr')], art=[...pn.querySelectorAll('.tl-cell img.tl-art')], bg=[...pn.querySelectorAll('.tl-hdr,.tl-board,.tl-btn,.tl-rk')].map(e=>e.style.backgroundImage).filter(Boolean);
    return {el,want:talentTreeElement(detailHero,TALENTS.trees(detailHero)[TAL.tree[detailHero]|0].id),frames:fr.length,framesLoaded:fr.filter(i=>i.naturalWidth>0).length,own:fr.map(i=>i.getAttribute('src')).concat(bg).every(x=>x.includes('/ui/talents/'+el+'/')),
      cells:document.querySelectorAll('.tl-cell').length,icons:art.filter(i=>i.complete&&i.naturalWidth>0).length,board:Math.round(r.width)+'x'+Math.round(r.height),inside:r.left>=-1&&r.right<=V.width+1,short:!!TAL.short,pts:document.getElementById('tlPts').textContent}; });
  C.ok(p.el===p.want&&p.own&&p.frames>0&&p.framesLoaded===p.frames&&p.cells>=20&&p.icons===p.cells&&p.inside,tag+' Talent board, '+key+': the painted board ('+p.el+' kit, '+p.frames+' painted pieces loaded, '+p.cells+' talents with their icons, '+p.board+' px'+(p.short?', phone short layout':'')+')',p);
  const v1=t1(key);
  await pg.evaluate(id=>document.getElementById('tl_'+id).scrollIntoView({block:'center'}),v1[0]); await H.wait(400);
  await press(pg,touch,'#tl_'+v1[0]); await H.wait(500);
  const sel=await pg.evaluate(id=>({sel:document.getElementById('tl_'+id).classList.contains('sel'),learnOn:!document.getElementById('tlLearn').disabled,pts:document.getElementById('tlPts').textContent}),v1[0]);
  const srv0=s.disk().led.talents;
  C.ok(sel.sel&&sel.learnOn&&sel.pts===p.pts&&!(srv0&&srv0[key]),tag+' Talent board, '+key+': one '+(touch?'tap':'click')+' selects "'+v1[3]+'" and lights Learn, learns nothing (points still "'+sel.pts+'", server build empty)',{...sel,server:srv0&&srv0[key]||null});
  await press(pg,touch,'#tlLearn'); await pg.waitForFunction(([k,id])=>(G.talents&&G.talents[k]||{r:{}}).r[id]===1,[key,v1[0]],{timeout:15000}).catch(()=>{}); await H.wait(500);
  const pts=await pg.evaluate(()=>document.getElementById('tlPts').textContent), srv=s.disk().led.talents;
  C.ok(/^Points: 1 \/ 1$/.test(pts)&&srv&&srv[key]&&srv[key].r[v1[0]]===1,tag+' Talent board, '+key+': Learn learns it ("'+p.pts+'" -> "'+pts+'", server rank 1)',{pts,server:srv&&srv[key]});
  /* the tooltip: hover on the PC, a double tap on the phone */
  if(touch){ await pg.tap('#tl_'+v1[0]); await pg.tap('#tl_'+v1[0]); } else { await pg.mouse.move(3,3); await H.wait(150); await pg.hover('#tl_'+v1[0]); }
  await H.wait(400);
  const tip=await pg.evaluate(()=>{ const c=document.getElementById('tlCard'); if(!c) return {shown:false}; const a=document.getElementById('tl_'+c.dataset.tl), r=c.ewGameRect(), s=a.ewGameRect(), b=a.querySelector('.tl-rk'), br=b?b.ewGameRect():s, V=ewGameView();
    const off=q=>r.bottom<=q.top+0.5||r.top>=q.bottom-0.5||r.right<=q.left+0.5||r.left>=q.right-0.5, gap=Math.round(Math.max(r.left-s.right,s.left-r.right,r.top-s.bottom,s.top-r.bottom));
    return {shown:true,id:c.dataset.tl,side:c.dataset.side,gap,clear:off(s)&&off(br),inView:r.left>=-1&&r.right<=V.width+1&&r.top>=-1&&r.bottom<=V.height+1,name:(c.querySelector('.tl-cn')||{}).textContent,size:Math.round(r.width)+'x'+Math.round(r.height)}; });
  C.ok(tip.shown&&tip.id===v1[0]&&tip.clear&&tip.inView&&tip.gap>=-1&&tip.gap<=40&&tip.name===v1[3],tag+' Talent board, '+key+': '+(touch?'a double tap':'hover')+' shows the tooltip beside the talent ('+tip.side+', '+tip.gap+' px), not over it, on screen',tip);
  const srv2=s.disk().led.talents[key];
  C.ok(srv2&&srv2.r[v1[0]]===1,tag+' Talent board, '+key+': the tooltip learned nothing more',{server:srv2});
  await pg.evaluate(()=>{ try{ talentCardHide(); }catch(e){} });
}

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.glyphs=JSON.parse(JSON.stringify(GLY)); u.led.gold=0; });
  const s=await H.server(file); let pg=null;
  try{
    for(const [w,h,touch,tag,key] of [[1280,720,false,'1280x720','vael'],[844,390,true,'844x390','aureth']]){
      pg=await H.game(s.port,{w,h,touch});
      try{ await glyphs(pg,tag,touch,s); }catch(e){ C.ok(false,tag+' glyph part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      try{ await talents(pg,tag,touch,s,key); }catch(e){ C.ok(false,tag+' talent part ran to the end',String(e&&e.stack||e).slice(0,500)); }
      C.ok(pg._errs.length===0,tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null;
    }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
