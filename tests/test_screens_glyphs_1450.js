'use strict';
/* Lockdown audit 25 Nov 2026, section 19 Glyphs, the on-screen lines (live v1450), in a real browser on this checkout's server (temp DB):
   - Glyph board per hero: Heroes > hero > Glyphs tab, a six-slot board per hero, at phone size (390x844 touch) and desktop (1280x720);
     every slot on screen with its art really loaded (not the grey placeholder).
   - Recipe tree: tapping a slot opens the glyph's ingredient tree with have / need pills that match the server and source pills;
     an inner node tapped opens its own tree on top.
   - Next bonus shown: the ASCEND button shows the hero's next personal bonus (the server's number).
   Known open bugs being fixed on another branch are reported as KNOWN-BUG lines (grey core icons, English words on the ASCEND button /
   bonus line / Bag, % on glyph rating values). Every check prints what it measured. Exit 0 = all checks passed. */
const H=require('./helpers/screens-1450.js');
const C=H.checker('test_screens_glyphs_1450.js');
const HEROES={vael:30,sylthaine:45,vireo:30};
const NOW=Date.now();
/* glyph state already migrated (so the server keeps the fragments we give): Vael on Grey (index 0), Sylthaine on Purple (index 6, level 45 >= 36) */
const board=i=>({slots:[null,null,null,null,null,null],ascensionIndex:i,ascended:{},personalPathVersion:1});
const glyphs=frags=>({revision:3,fragments:frags||{},subGlyphs:{},finished:{},boards:{vael:board(0),sylthaine:board(6),vireo:board(0)},audit:[],seq:1,migratedAt:NOW-5000,flow2At:NOW-5000});

async function probe(){   /* phase A: read the trees the server builds, to know which fragments to hand out and which node is an inner one */
  const {file}=H.seedDB(HEROES,u=>{ u.glyphs=glyphs(); }); const s=await H.server(file); const out={};
  try{ for(const [h,sl] of [['vael',0],['vael',1],['sylthaine',0],['sylthaine',1],['sylthaine',2],['sylthaine',3],['sylthaine',4],['sylthaine',5]]){
      const r=await s.api('/api/glyphs/build-tree?heroKey='+h+'&slot='+sl); out[h+':'+sl]=r.body; } } finally{ await s.stop(); }
  return out; }

const IMGS=`(root=>[...root.querySelectorAll('img')].map(im=>({src:(im.getAttribute('src')||'').slice(0,90),w:im.naturalWidth,done:im.complete,fallback:(im.getAttribute('src')||'')===G2_FALLBACK})))`;
async function openGlyphs(pg,key,touch){
  await pg.evaluate(()=>{ closePopout(); popoutScreen('heroesPanel'); }); await H.wait(600);
  await pg.evaluate(k=>{ RUNE2.build=null; try{ g2RenderOverlays(); }catch(e){} detailHero=k; heroTab='stats'; popoutScreen('heroDetail'); renderHeroDetail(); },key); await H.wait(500); await H.clean(pg);
  const sel='#heroDetailBody .hd-tab[data-tab="glyphs"]';
  if(touch) await pg.tap(sel); else await pg.click(sel);
  await pg.waitForFunction(()=>document.querySelectorAll('#heroDetailBody .hd-armorgrid>div').length===6,null,{timeout:40000}).catch(()=>{});
  await H.wait(800); }
async function boardCheck(pg,tag,key){
  const r=await pg.evaluate(async([IMGS])=>{ const imgs=eval(IMGS); const cells=[...document.querySelectorAll('#heroDetailBody .hd-armorgrid>div')], out=[];
    for(const c of cells){ c.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,120)); const im=c.querySelector('img'); for(let i=0;i<40&&im&&!im.complete;i++) await new Promise(r=>setTimeout(r,100));
      const r=c.getBoundingClientRect(); const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      out.push({w:Math.round(r.width),h:Math.round(r.height),on:r.width>40&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,front:!!top&&c.contains(top),img:imgs(c)[0]||null}); }
    const head=document.querySelector('#heroDetailBody .panel .pill'); return {cells:out,step:head&&head.textContent,hero:detailHero,boardIdx:g2board(detailHero).ascensionIndex,vw:innerWidth,vh:innerHeight}; },[IMGS]);
  const okCells=r.cells.length===6&&r.cells.every(c=>c.on&&c.front&&c.img&&c.img.w>0&&c.img.done&&!c.img.fallback);
  C.ok(okCells,tag+' '+key+' glyph board: six slots, each on screen (scrolled to), not covered, its glyph art loaded (not the grey placeholder)',
    {step:r.step,cells:r.cells.map(c=>c.w+'x'+c.h+(c.on?'':' OFF')+(c.front?'':' COVERED')+' '+(c.img?(c.img.fallback?'PLACEHOLDER':c.img.w+'px'):'no img')).join(', ')});
  return r; }
/* the in-panel recipe tree of the slot just opened, compared with the server's own tree */
async function treeCheck(pg,tag,key,slot,server,touch){
  const srv=(await server.api('/api/glyphs/build-tree?heroKey='+key+'&slot='+slot)).body;   /* the server's tree right now (have counts move with builds) */
  const cell=`#heroDetailBody .hd-armorgrid>div:nth-child(${slot+1})`;
  await pg.evaluate(c=>document.querySelector(c).scrollIntoView({block:'center'}),cell);
  if(touch) await pg.tap(cell); else await pg.click(cell);
  await pg.waitForFunction(()=>RUNE2.build&&!RUNE2.build.loading&&document.querySelector('.g2treeBox'),null,{timeout:30000}).catch(()=>{});
  await H.wait(1200);
  const r=await pg.evaluate(async([IMGS])=>{ const imgs=eval(IMGS); const box=document.querySelector('#heroDetailBody .g2treeBox'); if(!box) return {open:false};
    for(let i=0;i<50&&[...box.querySelectorAll('img')].some(x=>!x.complete);i++) await new Promise(r=>setTimeout(r,100));
    const D=RUNE2.build.data, root=document.getElementById('g2n_m_r');
    const leaves=[]; (D.root.children||[]).forEach((n,i)=>{ const walk=(n,p)=>{ const el=document.getElementById('g2n_m_'+p); if(n.kind==='fragment'&&el){ const pills=[...el.querySelectorAll('.pill')].map(x=>x.textContent.trim());
          leaves.push({path:p,key:n.key,have:n.have,need:n.need,inherited:!!n.inherited,pill:pills[0]||null,sources:pills.slice(1),name:(el.querySelector('div[style*="font-size:9.5px"]')||{}).textContent}); }
        if(n.kind!=='fragment'&&p.split('.').length<3) (n.children||[]).forEach((c,j)=>walk(c,p+'.'+j)); }; walk(n,'r.'+i); });
    const inner=(D.root.children||[]).map((n,i)=>({n,i})).filter(x=>x.n.kind!=='fragment'&&(x.n.children||[]).length).map(x=>({path:'r.'+x.i,kind:x.n.kind,name:x.n.kind==='subGlyph'?(x.n.displayName||x.n.key):x.n.name}));
    const all=imgs(box), byNode=[...box.querySelectorAll('[id^="g2n_m_"]')].map(el=>({id:el.id,name:((el.querySelector('div[style*="font-weight:800"]')||el.querySelector('div[style*="font-weight:700"]')||{}).textContent||'').trim(),fallback:[...el.querySelectorAll(':scope img')].some(im=>(im.getAttribute('src')||'')===G2_FALLBACK)}));
    const cores=(D.root.children||[]).map((n,i)=>({n,i})).filter(x=>x.n.kind==='subGlyph').map(x=>{ const el=document.getElementById('g2n_m_r.'+x.i); const nm=el&&el.querySelector('div[style*="font-weight:800"]'); const im=el&&el.querySelector('img');
      return {name:nm&&nm.textContent.trim(),color:nm&&getComputedStyle(nm).color,src:im&&(im.getAttribute('src')===G2_FALLBACK?'PLACEHOLDER':(im.getAttribute('src')||'').replace(/^.*glyphs-v3\//,'')),w:im&&im.naturalWidth}; });
    const rr=root.getBoundingClientRect();
    return {open:true,rootName:(root.querySelector('div[style*="font-size:15px"]')||{}).textContent,rootStats:(root.querySelector('div[style*="font-size:10px"]')||{}).textContent||'',badge:(root.querySelector('.pill')||{}).textContent,
      rootOn:rr.width>0&&rr.top<innerHeight&&rr.bottom>0,leaves,inner,images:all.length,loaded:all.filter(x=>x.w>0&&!x.fallback).length,fallback:all.filter(x=>x.fallback).length,fallbackNodes:byNode.filter(x=>x.fallback).map(x=>x.name),
      cores,buildBtn:!!document.querySelector('#heroDetail [data-tut-glyph-build]')&&!document.querySelector('#heroDetail [data-tut-glyph-build]').disabled}; },[IMGS]);
  if(!r.open){ C.ok(false,tag+' '+key+' slot '+slot+': tapping the slot opens its recipe tree'); return r; }
  const sv=srv&&srv.root; const at=p=>{ let n=sv; for(const i of p.split('.').slice(1)) n=n&&n.children&&n.children[+i]; return n; };
  const own=r.leaves.filter(l=>!l.inherited);
  const pillsOk=own.length>0&&own.every(l=>{ const n=at(l.path); return l.pill===l.have+' / '+l.need&&n&&l.pill===n.have+' / '+n.need; });
  const srcOk=own.length>0&&own.every(l=>l.sources.length>0&&l.sources.every(s=>/\d+-\d+/.test(s)));
  C.ok(r.rootOn&&r.rootName===(sv&&sv.name)&&pillsOk&&srcOk,tag+' '+key+' slot '+slot+' recipe tree: the glyph "'+r.rootName+'", every fragment with its have / need pill (= the server) and its source pill',
    {rootOn:r.rootOn,name:r.rootName===(sv&&sv.name),pills:pillsOk,sources:srcOk,badge:r.badge,leaves:own.map(l=>l.name+' '+l.pill+' ['+l.sources.join(',')+']').join(' | ').slice(0,400)});
  C.ok(r.images>0&&r.loaded+r.fallback===r.images,tag+' '+key+' slot '+slot+' tree art: '+r.loaded+' of '+r.images+' images loaded',{fallback:r.fallback});
  C.bug(r.fallback>0||(r.cores||[]).some(c=>c.src==='PLACEHOLDER'||/139, 152, 169/.test(c.color||'')),tag+' '+key+' slot '+slot+' grey placeholder icon or grey name on a "Core" node in the recipe tree',{placeholderNodes:r.fallbackNodes,cores:r.cores});
  C.bug(/%/.test(r.rootStats),tag+' '+key+' slot '+slot+' the glyph card prints rating values with a % sign',{stats:r.rootStats});
  return r; }
async function innerTap(pg,tag,key,r,touch){
  if(!r.inner||!r.inner.length){ C.ok(false,tag+' '+key+' an inner node to tap exists in the tree',r.inner); return; }
  const n=r.inner[0], sel='[id="g2n_m_'+n.path+'"]';
  await pg.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),sel); await H.wait(200);
  if(touch) await pg.tap(sel); else await pg.click(sel);
  await H.wait(1200);
  const o=await pg.evaluate(()=>{ const host=document.getElementById('g2ovlHost'); const box=host&&host.querySelector('.g2treeBox'); if(!box) return {open:false};
    const vp=RUNE2.build.stack[0], root=document.getElementById('g2n_o0_'+vp); if(!root) return {open:true,root:false,stack:RUNE2.build.stack.slice()}; const rr=root.getBoundingClientRect(); const pills=[...box.querySelectorAll('.pill')].map(p=>p.textContent.trim());
    return {open:true,name:(root.querySelector('div[style*="font-size:15px"]')||{}).textContent,on:rr.width>0&&rr.top>=-1&&rr.bottom<=innerHeight+1,stack:RUNE2.build.stack.slice(),pills:pills.slice(0,8),children:box.querySelectorAll('[id^="g2n_o0_'+vp+'."]').length}; });
  C.ok(o.open&&o.on&&o.children>0&&o.stack[0]===n.path,tag+' '+key+' tapping the inner node "'+n.name+'" ('+n.kind+') opens its own tree on top, on screen',o);
  await pg.evaluate(()=>{ try{ g2TreeCloseTo(0); }catch(e){} }); }

(async()=>{
  let s, pg;
  try{
    const P=await probe();
    const v0=P['vael:0'], v1=P['vael:1'];
    C.ok(v0&&v0.totals&&v0.totals.length&&v1&&v1.totals&&v1.totals.length,'server build trees read for Vael slots 1 and 2',{slot1:v0&&v0.totals&&v0.totals.map(t=>t.key+' x'+t.need),slot2:v1&&v1.totals&&v1.totals.map(t=>t.key+' x'+t.need)});
    const frags={}; for(const t of v0.totals) frags[t.key]=(frags[t.key]||0)+t.need;   /* slot 1: everything */
    const t2=v1.totals.find(t=>!v0.totals.some(x=>x.key===t.key))||v1.totals[0]; frags[t2.key]=(frags[t2.key]||0)+Math.max(0,t2.need-1);   /* slot 2: one short */
    const sKey=Object.keys(P).filter(k=>k.startsWith('sylthaine:')).find(k=>P[k]&&P[k].root&&(P[k].root.children||[]).some(n=>n.kind!=='fragment'&&(n.children||[]).length));
    C.ok(!!sKey,'a Sylthaine Purple slot has an inner node (a core or an earlier glyph) in its tree',{slot:sKey,kinds:sKey&&P[sKey].root.children.map(n=>n.kind)});
    const sSlot=sKey?+sKey.split(':')[1]:0;
    const {file}=H.seedDB(HEROES,u=>{ u.glyphs=glyphs(frags); u.led.gold=0; }); s=await H.server(file);
    const st=(await s.api('/api/glyphs/state')).body;
    console.log('  server: Vael board index '+(st.boards.vael||{}).ascensionIndex+', next bonus '+JSON.stringify((st.boards.vael||{}).nextAscensionBonus)+', fragments given '+JSON.stringify(st.fragments));
    for(const [w,h,touch,tag] of [[1280,720,false,'1280x720'],[390,844,true,'phone 390x844']]){
      pg=await H.game(s.port,{w,h,touch});
      // ---- a six-slot board for each hero
      const boards={};
      for(const k of ['vael','vireo','sylthaine']){ await openGlyphs(pg,k,touch); boards[k]=(await boardCheck(pg,tag,k)).step; }
      C.ok(boards.vael&&boards.sylthaine&&boards.vael!==boards.sylthaine,tag+' each hero has his own board (Vael and Sylthaine on different steps)',boards);
      // ---- Next bonus on the ASCEND button (Vael, the server's next personal bonus)
      await openGlyphs(pg,'vael',touch);
      const nb=await pg.evaluate(()=>{ const pre=ewT('hero.ascend_to',{q:'',bonus:''}).split(' ')[0]; const b=[...document.querySelectorAll('#heroDetailBody button')].find(x=>x.textContent.trim().startsWith(pre)); if(!b) return {found:false}; b.scrollIntoView({block:'center'});
        const r=b.getBoundingClientRect(); return {found:true,text:b.textContent.trim(),on:r.width>0&&r.top>=-1&&r.bottom<=innerHeight+1,disabled:b.disabled,bonus:g2board(detailHero).nextAscensionBonus}; });
      const want=st.boards.vael&&st.boards.vael.nextAscensionBonus;
      C.ok(nb.found&&nb.on&&want&&nb.text.includes('+'+want.amount)&&nb.text.includes(want.stat),tag+' ASCEND button shows the next personal bonus (+'+(want&&want.amount)+' '+(want&&want.stat)+')',{text:nb.text,disabled:nb.disabled});
      // ---- recipe tree: slot 2 (one fragment short), then slot 1 (all there) built with Quick Build
      const r1=await treeCheck(pg,tag,'vael',1,s,touch);
      const short=(r1.leaves||[]).find(l=>l.key===t2.key);
      C.ok(short&&short.have<short.need&&short.pill===short.have+' / '+t2.need&&!r1.buildBtn,tag+' Vael slot 2: the fragment given one short reads '+(short&&short.pill)+' and Quick Build stays off',{pill:short&&short.pill,badge:r1.badge,quickBuild:r1.buildBtn});
      await pg.evaluate(()=>g2buildCancel()); await H.wait(400);
      if(tag==='1280x720'){
        const r0=await treeCheck(pg,tag,'vael',0,s,touch);
        C.ok(r0.buildBtn,tag+' Vael slot 1: every fragment there, Quick Build is lit',{badge:r0.badge});
        if(r0.buildBtn){ await pg.click('#heroDetail [data-tut-glyph-build]'); await pg.waitForFunction(()=>!RUNE2.build&&g2board('vael').slots[0],null,{timeout:20000}).catch(()=>{}); await H.wait(800); }
        const disk=s.disk().glyphs.boards.vael.slots[0];
        const cell=await pg.evaluate(()=>{ const c=document.querySelector('#heroDetailBody .hd-armorgrid>div'); const im=c&&c.querySelector('img'); return {img:im&&im.naturalWidth,ghost:!!(c&&c.querySelector('span[style*="opacity:.30"]')),plus:!!(c&&/＋/.test(c.textContent))}; });
        C.ok(!!disk&&cell.img>0&&!cell.plus,'1280x720 Quick Build builds slot 1 on the first tap (server slot filled, the board shows the glyph)',{server:disk,cell});
      }
      // ---- an inner node tapped (Sylthaine, Purple)
      await openGlyphs(pg,'sylthaine',touch);
      const rs=await treeCheck(pg,tag,'sylthaine',sSlot,s,touch);
      await innerTap(pg,tag,'sylthaine',rs,touch);
      await pg.evaluate(()=>{ try{ g2buildCancel(); }catch(e){} });
      C.ok(pg._errs.length===0,tag+' no page errors',pg._errs.slice(0,3).map(e=>e.replace(/Error:/g,'Err')));
      await pg._ctx.close(); pg=null;
    }
    // ---- German: the ASCEND button, the ascended-bonus line and the Bag fragment names (known English words)
    pg=await H.game(s.port,{w:1280,h:720,lang:'de'});
    await openGlyphs(pg,'vael',false);
    const de=await pg.evaluate(()=>{ const pre=ewT('hero.ascend_to',{q:'',bonus:''}).split(' ')[0]; const b=[...document.querySelectorAll('#heroDetailBody button')].find(x=>x.textContent.trim().startsWith(pre)); const bd=g2board(detailHero), cat=RUNE2.cat;
      const nxtEn=cat.ladder[bd.ascensionIndex+1], bonus=bd.nextAscensionBonus; const key=Object.keys(RUNE2.st.fragments||{})[0];
      return {text:b&&b.textContent.trim(),qualityEn:nxtEn,qualityShown:g2QualName(nxtEn),stat:bonus&&bonus.stat,bag:key?g2FragmentName(key):null,bagKey:key,family:key?key.slice(key.lastIndexOf(' ')+1):null,cur:LANG.cur}; });
    C.ok(de.cur==='de'&&!!de.text,'de: the ASCEND button is drawn in German',{text:de.text});
    C.bug(!!de.text&&(de.text.includes(de.qualityEn+' ')||de.text.includes(de.stat))&&de.qualityShown!==de.qualityEn,'de: English words on the ASCEND button (quality "'+de.qualityEn+'" / stat "'+de.stat+'"; German quality is "'+de.qualityShown+'")',{text:de.text});
    C.bug(!!de.bag&&!!de.family&&de.bag.endsWith(de.family),'de: the Bag fragment name ends with the English family word',{bag:de.bag});
    await pg._ctx.close(); pg=null;
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).replace(/Error:/g,'Err').slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); if(s) await s.stop(); }
  C.done();
})();
