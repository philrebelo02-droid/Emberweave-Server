'use strict';
/* Lockdown checklist 25 Nov 2026 (01 - EVERY FEATURE IN THE GAME.md), v1469 screen check - Starless Well "Tent" (v1457), in a real browser
   on this checkout's server (temp DB), a Lv 100 player, at desktop 1280x720 and phone 844x390 (touch).
   The tent is the server's own: the map is server/starless-well.js genMap on the server's map seed, so the test finds a (map, path) whose
   map has a tent next to a square and writes the run's position next to it into the DB (checked against GET /api/well/state). Then:
   - the tent square offers 3 different loan heroes = the server's options, each a tappable row;
   - each shows its buff (+30% health / +20% damage, or +45% / +30% and "Upgraded to <quality>" when upgraded a quality);
   - a hero you own is on offer ("a stronger copy of yours") - desktop picks it, the phone (run reset, server restarted) one not owned;
   - the picked loan joins the run's squad: the server's run loans, the run's Heroes list ("Loan"), a pickable card on the next fight's
     squad screen. STEP lines mark every phase; every wait is capped; a 12-minute watchdog. */
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const H=require('./helpers/screens-lockdown.js');
const {rig,tapEl}=require('./helpers/lockdown-1469.js');
const TEST='screen_lockdown_well_tent_1469.js', R=rig(TEST,{limitMin:12}), {C,shot,step,waitFor}=R;
const WELL_KEYS=['vael','aureth','sylthaine','vireo','brannus','lumi','umbris','grosk','calypsa','dandra'];

function wellSeed(secret,id,cycle,map,pth){ return crypto.createHmac('sha256',secret).update(['well2map',id,cycle,map,pth||'-'].join('|')).digest().readUInt32BE(0)>>>0; }
function findTent(){ const WL=require(path.join(H.ROOT,'server','starless-well.js')), SIM=require(path.join(H.ROOT,'server','sim.js'));
  const pool=Object.keys(SIM.HERO_BASE).sort(), cyc=WL.cycleOf(Date.now()), secret=process.env.SERVER_SECRET||'screens-1450';
  for(const [map,pth] of [[1,null],[2,'normal'],[3,'normal'],[2,'hard'],[3,'hard']]){ const grid=WL.genMap(wellSeed(secret,H.UID,cyc,map,pth),map,pth,pool);
    for(const c of [2,4]) for(let row=0;row<3;row++){ const sq=grid[c][row]; if(!sq||sq.type!=='tent'||WL.tentOptions(sq).length<3) continue;
      for(const pr of [row,row-1,row+1]) if(pr>=0&&pr<3&&grid[c-1][pr]) return {map,path:pth,cycle:cyc,col:c,row,pos:{col:c-1,row:pr},options:WL.tentOptions(sq).slice(),up:(sq.up||[]).slice()}; } }
  return null; }
const freshRun=T=>({cycle:T.cycle,level:0,map:T.map,path:T.path,pos:{col:T.pos.col,row:T.pos.row},heroes:{},loans:[],loanUp:{},buffs:[],offer:null,resUsed:0,done:false,att:null,prizes:[],started:true});
function resetRun(file,T){ const db=JSON.parse(fs.readFileSync(file,'utf8')); const led=db.users[H.UID].led; led.well2=led.well2||{}; led.well2.run=freshRun(T); led.well2.cleared=led.well2.cleared||{}; fs.writeFileSync(file,JSON.stringify(db)); }

async function openWell(pg,S){ const how=await R.cap(H.openBuilding(pg,'well',S.touch),60000,'opening the Starless Well');
  await waitFor(pg,()=>document.querySelectorAll('#wlMap .wlSq').length>0,null,40000,'the Well map squares');
  await H.wait(1200); await H.prep(pg); return how; }

async function wellTent(pg,S,s,T,pickOwned){
  step(S.tag+' check: Tent offers 3 loans');
  const how=await openWell(pg,S);
  const srv=(await R.api(s,'/api/well/state')).body||{}, sq=((srv.grid||[])[T.col]||[])[T.row]||{}, opts=sq.options||[];
  const tapHow=await tapEl(pg,S,'#wlMap .wlSq.wlReach[data-c="'+T.col+'"][data-r="'+T.row+'"]');
  await waitFor(pg,()=>document.querySelectorAll('#wlCard .wlLoanOpt').length>0,null,10000,'the tent card with its loans');
  const r=await pg.evaluate(()=>{ const c=document.getElementById('wlCard'); if(!c) return {card:false};
    return {card:true,title:SL.txt(c.firstElementChild.firstElementChild),opts:[...c.querySelectorAll('.wlLoanOpt')].map(b=>({key:b.dataset.loan,text:SL.txt(b),front:SL.front(b),on:SL.inView(b,2),h:SL.R(b).h}))}; });
  const s1=await shot(pg,S.tag+' Tent three loans');
  const pct=v=>'+'+Math.round(v*100)+'%';
  const rows=(r.opts||[]).map(o=>{ const so=opts.find(x=>x.key===o.key)||{}, want=pct(so.hp)+' health, '+pct(so.atk)+' damage', buffRule=so.up?(so.hp===0.45&&so.atk===0.30):(so.hp===0.30&&so.atk===0.20);
    return {key:o.key,up:!!so.up,owned:!!so.owned,buff:want,buffShown:o.text.includes(want),buffRule,upShown:/Upgraded to/.test(o.text)===!!so.up,ownedShown:/a stronger copy of yours/.test(o.text)===!!so.owned,tappable:o.front&&o.on&&o.h>=40,text:o.text}; });
  const keys=rows.map(x=>x.key);
  C.ok(r.card&&rows.length===3&&new Set(keys).size===3&&JSON.stringify(keys)===JSON.stringify(opts.map(o=>o.key))&&rows.every(x=>x.tappable)&&sq.type==='tent',
    S.tag+' Tent: the tent square ['+tapHow+', Well opened by '+how+'] offers 3 different loan heroes ('+keys.join(', ')+') = the server\'s options, each a tappable row',{title:r.title,rows,server:opts,shot:s1});
  step(S.tag+' check: Tent buffs');
  C.ok(rows.length===3&&rows.every(x=>x.buffShown&&x.buffRule&&x.upShown),S.tag+' Tent: each loan shows its buff - '+rows.map(x=>x.key+' '+x.buff+(x.up?' (upgraded a quality)':'')).join('; ')+' (+30% / +20%, +45% / +30% upgraded)',{rows,shot:s1});
  const own=rows.find(x=>x.owned), other=rows.find(x=>!x.owned);
  C.ok(!!own&&own.ownedShown,S.tag+' Tent: a hero you own is on offer ('+(own&&own.key)+', marked "a stronger copy of yours")',{rows,shot:s1});
  const pick=pickOwned?own:other;
  if(!pick){ C.ok(false,S.tag+' Tent: a '+(pickOwned?'owned':'not-owned')+' loan to pick',{rows}); return; }
  step(S.tag+' check: Tent pick joins the squad ('+pick.key+')');
  const how2=await tapEl(pg,S,'#wlCard .wlLoanOpt[data-loan="'+pick.key+'"]');
  await waitFor(pg,()=>/joins the run/.test(SL.txt('#wlCard')),null,15000,'the "joins the run" card');
  const got=await pg.evaluate(()=>({card:SL.txt('#wlCard'),loans:(WELL.state&&WELL.state.loans)||[]}));
  const srv2=(await R.api(s,'/api/well/state')).body||{};
  const s2=await shot(pg,S.tag+' Tent picked loan');
  C.ok((srv2.loans||[]).includes(pick.key)&&got.loans.includes(pick.key)&&/joins the run/.test(got.card)&&srv2.pos&&srv2.pos.col===T.col,
    S.tag+' Tent: picking '+pick.key+' ('+(pickOwned?'owned':'not owned')+') ['+how2+'] - "'+got.card.slice(0,90)+'"; the server\'s run loans '+JSON.stringify(srv2.loans),{got,server:{loans:srv2.loans,pos:srv2.pos,loanInfo:srv2.loanInfo&&srv2.loanInfo[pick.key]},shot:s2});
  await pg.evaluate(()=>{ const b=document.querySelector('#wlCard button[data-k]'); if(b) b.click(); }); await H.wait(600);
  await tapEl(pg,S,'#wlMap .wlHeroesB');
  await waitFor(pg,k=>!!document.querySelector('.wlHeroCard[data-hero-key="'+k+'"]'),pick.key,15000,'the run\'s Heroes list with the loan');
  const list=await pg.evaluate(k=>{ const c=document.querySelector('.wlHeroCard[data-hero-key="'+k+'"]'); if(c) c.scrollIntoView({block:'center'}); return {card:!!c&&SL.vis(c),text:SL.txt(c)}; },pick.key);
  const s3=await shot(pg,S.tag+' Tent loan in the run heroes');
  await pg.evaluate(()=>{ try{ closePopout(); }catch(e){} }); await H.wait(600);
  if(!(await pg.$('#wlMap'))) await openWell(pg,S);
  await H.prep(pg);
  const nx=await pg.evaluate(c=>{ const q=[...document.querySelectorAll('#wlMap .wlSq.wlReach')].find(b=>+b.dataset.c===c); if(!q) return null; q.id='slNextSq'; return {c:+q.dataset.c,r:+q.dataset.r}; },T.col+1);
  let squad={menu:false};
  if(nx){ await tapEl(pg,S,'#slNextSq');
    await waitFor(pg,()=>document.getElementById('menu').classList.contains('active')&&document.querySelectorAll('#roster .hero-card').length>0,null,20000,'the next fight\'s squad screen'); await H.wait(800);
    squad=await pg.evaluate(k=>{ const c=document.querySelector('#roster .hero-card[data-hero-key="'+k+'"]'); if(c) c.scrollIntoView({block:'center'}); return {menu:document.getElementById('menu').classList.contains('active'),mode:CUR&&CUR.mode,card:!!c&&SL.vis(c),locked:!!c&&c.classList.contains('locked'),cards:document.querySelectorAll('#roster .hero-card').length}; },pick.key); }
  const s4=await shot(pg,S.tag+' Tent loan on the squad screen');
  C.ok(list.card&&/Loan/.test(list.text)&&squad.menu&&squad.mode==='well'&&squad.card&&!squad.locked,
    S.tag+' Tent: the picked loan joins the run\'s squad - its Heroes card ("'+list.text.slice(0,60)+'") and a pickable card on the next fight\'s squad screen ('+squad.cards+' cards)',{list,next:nx,squad,shots:[s3,s4]});
  await pg.evaluate(()=>{ try{ show('home'); }catch(e){} }); }

(async()=>{
  let pg=null, s=null;
  try{
    step('setup: find the server\'s tent');
    const T=findTent();
    if(!T){ C.ok(false,'setup: a tent square next to a square on one of the Well\'s maps (server map seed)'); }
    else {
      const owned=T.options[0], notOwned=T.options.slice(1);
      const keys=WELL_KEYS.filter(k=>!notOwned.includes(k)); if(!keys.includes(owned)) keys.push(owned);
      step('setup: seed DB + server');
      const {file}=H.seedDB(Object.fromEntries(keys.map(k=>[k,80])),u=>{ u.team=keys.slice(0,5); u.led.gold=100000; u.led.gems=5000; u.led.well2={run:freshRun(T),cleared:{}}; });
      s=await R.server(file);
      const v=(await R.api(s,'/api/well/state')).body||{}, sq=((v.grid||[])[T.col]||[])[T.row]||{};
      const ok=sq.type==='tent'&&JSON.stringify((sq.options||[]).map(o=>o.key))===JSON.stringify(T.options)&&v.pos&&v.pos.col===T.pos.col;
      C.ok(ok,'setup: the Well run stands at column '+T.pos.col+' row '+T.pos.row+' of map '+T.map+(T.path?' ('+T.path+')':'')+', next to the server\'s tent at '+T.col+'/'+T.row+' offering '+T.options.join(', ')+' (we own '+owned+')',
        {server:{type:sq.type,options:(sq.options||[]).map(o=>({key:o.key,up:o.up,owned:o.owned,hp:o.hp,atk:o.atk})),pos:v.pos,map:v.map,path:v.path},want:T});
      if(ok) for(const [k,S] of [[0,H.SIZES.desktop],[1,H.SIZES.phone]]){
        if(k===1){ step('setup: reset the run + restart'); await R.stop(s); resetRun(file,T); s=await R.server(file); }
        step(S.tag+': game load');
        try{ pg=await R.game(s.port,S); await wellTent(pg,S,s,T,k===0); }
        catch(e){ C.ok(false,S.tag+' Tent ran to the end',String(e&&e.stack||e).slice(0,600)); try{ if(pg) await shot(pg,S.tag+' Tent error'); }catch(_){} }
        if(pg){ C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3)); await R.closeCtx(pg); pg=null; }
        await R.cap(H.closeBrowser(),20000,'closing the browser').catch(()=>{}); } }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) await R.closeCtx(pg); await R.stop(s); await R.finish(); }
})();
