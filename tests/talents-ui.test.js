'use strict';
/* The Talents tab of the hero panel, in a real browser against a real local server on a temp DB (never live).
   Phil 14 Nov 2026: "The new order of the tabs should be: Stats, Glyphs, Talents, Equipment, Skills, Lore";
   "they are only activated when someone clicks learn talent".
   Covers: the tab order with the server switch on and off; the three trees; the talent card (hover, click, tap);
   learning by the card's button and by a double click / double tap, down to the tier-13 signature (61 points);
   a pick-one fork's locked half; reset with its in-page confirm; a hero under level 10; no page errors; nothing
   wider than the screen at 390 x 844 and 1400 x 900; a hero whose talents are not wired yet (trees shown, a notice, nothing learnable);
   the Talents red dot on the tab and the hero card, with in-page controls, and its cost on the hero list.
   Run: node --test tests/talents-ui.test.js      Screenshots: set TALENT_SHOTS=<folder>. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),net=require('node:net'),os=require('node:os');
const root=path.resolve(__dirname,'..'),T=require(path.join(root,'talents.js')),TEMPLE=require(path.join(root,'server/temple-of-ash.js')),token='talent-ui-token',start=Date.now();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const STEP=JSON.parse(/const D_HERO_STEP=(\[[^\]]+\])/.exec(fs.readFileSync(path.join(root,'server.js'),'utf8'))[1]);
const xpFor=level=>{ let x=0; for(let L=2;L<=level;L++) x+=STEP[L-2]; return x; };
const SHOTS=process.env.TALENT_SHOTS||''; if(SHOTS) fs.mkdirSync(SHOTS,{recursive:true});
const LOW='konwu';     // a hero seeded at level 9: no points, his talents not open yet (his art was painted on 14 Nov: the rule holds whatever art exists)
const ORDER_ON=['stats','glyphs','talents','equip','skills','lore'], ORDER_OFF=['stats','glyphs','equip','skills','lore'];
/* 14 Nov 2026 locked heroes: a hero is wired when talents-mech/<key>.js exists (TalentFx.mechHeroes()). LOCKED = the last unwired hero in the data's order. */
const FX=require(path.join(root,'talents-fx.js')), DATA=require(path.join(root,'talents-data.js')), SIMB=require(path.join(root,'server/sim.js')).HERO_BASE;
const WIRED=new Set(FX.mechHeroes()), LOCKED=Object.keys(DATA.heroes).filter(k=>!WIRED.has(k)&&SIMB[k]).pop()||null, DOTH='vex';   // DOTH: a wired hero seeded at level 10 (one point)

async function server(flag,extra){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'emberweave-talents-ui-')),file=path.join(dir,'db.json');
  const user={id:'talent-ui-user',name:'Talent Screen',created:start-1000,rank:1,coins:0,team:['vael'],wall:['vael'],roster:{},qc:{wish:0},
    led:{v:1,migratedAt:start-1000,rev:1,gold:100000,gems:1000,px:2000000000,hero:{vael:{xp:xpFor(100),stars:1,pips:0,ref:0},[LOW]:{xp:xpFor(9),stars:1,pips:0,ref:0}},unlocked:{vael:true,[LOW]:true},frags:{},camp:{cleared:20,stars:{},att:null},stam:{v:60,ts:start},temple:TEMPLE.newState(),txs:[],quests:{claimed:{},chainStep:0}}};
  if(extra) extra(user);   /* more heroes on the seeded account (the locked-hero and red-dot test) */
  fs.writeFileSync(file,JSON.stringify({users:{[user.id]:user},byName:{'talent screen':user.id},tokens:{[crypto.createHash('sha256').update(token).digest('hex')]:{id:user.id,iat:start,exp:start+90*86400000}},seeded:true,seedVersion:3,heroIdV:3,guilds:{},idem:{},feedback:[],reports:[],meta:{rollSecret:'talent-ui-test'}}));
  const s=net.createServer(); await new Promise(r=>s.listen(0,'127.0.0.1',r)); const port=s.address().port; await new Promise(r=>s.close(r));
  let log=''; const env={...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:file,NODE_ENV:'test',SIM_WORKERS:'0',GAME_URL:'http://127.0.0.1:1'}; if(flag) env.TALENTS_ENABLED='true'; else delete env.TALENTS_ENABLED; delete env.CLOCK_FILE;
  const child=cp.spawn(process.execPath,[path.join(root,'server.js')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env});
  child.stdout.on('data',x=>log+=x); child.stderr.on('data',x=>log+=x);
  for(let i=0;;i++){ if(child.exitCode!==null) throw Error(log.slice(-2000)); try{ if((await fetch('http://127.0.0.1:'+port+'/api/health')).ok) break; }catch{} if(i>400) throw Error('server not ready: '+log.slice(-1000)); await wait(50); }
  const stop=async()=>{ if(child.exitCode===null) await new Promise(r=>{ child.once('exit',r); child.kill(); }); };
  return {port,stop,disk:()=>JSON.parse(fs.readFileSync(file,'utf8')).users[user.id]};
}
let _browser=null;
async function browser(){ if(_browser) return _browser; const {chromium}=require('playwright');
  const launch=o=>chromium.launch(Object.assign({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output']},o||{}));
  try{ _browser=await launch(); }catch(e){ _browser=await launch({channel:'chrome'}); } return _browser; }
/* the game, signed in as the seeded player (the page reads its session from localStorage 'ew_acc' at boot) */
async function game(port,w,h,touch){ const b=await browser();
  const ctx=await b.newContext(Object.assign({viewport:{width:w,height:h}},touch?{hasTouch:true,isMobile:true,deviceScaleFactor:2}:{}));
  await ctx.addInitScript(tok=>{ try{ localStorage.setItem('ew_acc',JSON.stringify({token:tok,name:'Talent Screen',rank:1,coins:0,id:'talent-ui-user',created:Date.now()-1000})); }catch(e){}
    const Px=new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:(k===Symbol.toPrimitive?()=>0:(['value','currentTime','sampleRate'].includes(k)?0:Px)),apply:()=>Px,construct:()=>Px,set:()=>true});
    window.AudioContext=function(){ return Px; }; window.webkitAudioContext=window.AudioContext; },token);
  const pg=await ctx.newPage(); pg._errs=[]; pg.on('pageerror',e=>pg._errs.push(String(e.message)));
  pg._dialogs=0; pg.on('dialog',d=>{ pg._dialogs++; d.dismiss().catch(()=>{}); });
  await pg.goto('http://127.0.0.1:'+port+'/play',{waitUntil:'domcontentloaded'});
  await pg.waitForFunction(()=>typeof renderHeroDetail==='function'&&typeof api==='function'&&typeof adoptLedger==='function',null,{timeout:90000});
  await wait(1500); await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await wait(1000);
  const ok=await pg.evaluate(async()=>{ G.tutSkipped=true; G.tutDone=true; G.ftutOff=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); const d=await ledgerSync(); return !!(d&&ACC.token&&G.unlocked.vael); });
  assert.equal(ok,true,'signed in as the seeded player');
  return pg; }
const openHero=(pg,key,tab)=>pg.evaluate(([key,tab])=>{ document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); detailHero=key; heroTab=tab; popoutScreen('heroDetail'); renderHeroDetail(); },[key,tab]);
const tabs=pg=>pg.evaluate(()=>[...document.querySelectorAll('#heroDetailBody .hd-tab')].map(b=>b.dataset.tab));
const build=pg=>pg.evaluate(()=>JSON.parse(JSON.stringify((G.talents&&G.talents.vael)||{r:{}})));
const cls=(pg,id)=>pg.evaluate(id=>{ const e=document.getElementById('tl_'+id); return e?e.className:null; },id);
const shot=async(pg,name)=>{ if(SHOTS){ await wait(250); await pg.screenshot({path:path.join(SHOTS,name+'.png')}); } };
/* nothing of the hero panel is wider than the screen, and the Talents board is inside its panel */
const fits=pg=>pg.evaluate(()=>{ const V=ewGameView(), out=[]; for(const el of document.querySelectorAll('#heroDetailBody .hd-tabbar,#heroDetailBody .hd-tab,#heroDetailBody .tl-panel,#tlBoard,.tl-cell,.tl-head .glTab,#tlCard')){ const r=el.ewGameRect(); if(r.width&&(r.left<-1||r.right>V.width+1)) out.push((el.id||el.className)+' '+Math.round(r.left)+'..'+Math.round(r.right)+' of '+V.width); } return out.slice(0,5); });
/* the points to spend, in order, to reach the tree's tier-13 signature with exactly 61: the arrows that lead to it first, lowest tier first */
function pathToSignature(hero,tree){ const sig=tree.talents.find(t=>t[1]===13), by={}; for(const t of tree.talents) by[t[0]]=t;
  const need=new Set(); for(let t=sig;t&&t[6];t=by[t[6]]) need.add(t[6]);
  let b={r:{}}; const order=[];
  for(let guard=0;guard<200&&!T.canLearn(hero,b,sig[0],100);guard++){
    const open=tree.talents.filter(t=>t!==sig&&T.canLearn(hero,b,t[0],100)).sort((x,y)=>(need.has(y[0])-need.has(x[0]))||(x[1]-y[1])||(x[2]-y[2]));
    assert.ok(open.length,'a talent can always be learned on the way down'); b=T.learn(hero,b,open[0][0],100).build; order.push(open[0][0]); }
  order.push(sig[0]); return {order,sig:sig[0]}; }

test('flag on: tab order, the trees, the card, learn to the signature, a locked fork half, reset (1400 x 900)',async()=>{ const s=await server(true); let pg; try{
  pg=await game(s.port,1400,900,false);
  await openHero(pg,'vael','stats');
  assert.deepEqual(await tabs(pg),ORDER_ON,'the six tabs in Phil\'s order');
  await shot(pg,'desktop-01-tab-row');
  // deep links that set heroTab still land on their tab; a locked hero keeps the view-only row
  await openHero(pg,'vael','glyphs'); assert.equal(await pg.evaluate(()=>document.querySelector('#heroDetailBody .hd-tab.on').dataset.tab),'glyphs');
  const notOwned=await pg.evaluate(()=>HERO_KEYS.find(k=>!G.unlocked[k]&&TALENTS.has(k))); assert.ok(notOwned);
  await openHero(pg,notOwned,'talents'); assert.deepEqual(await tabs(pg),['stats','skills','lore'],'a hero the player does not own: view-only row, no Talents');
  await openHero(pg,'vael','stats');
  assert.equal(await pg.evaluate(()=>!!document.querySelector('#heroDetailBody .hd-tab[data-tab="talents"] .hupDot')),true,'unspent points put the red dot on the Talents tab');
  await pg.click('#heroDetailBody .hd-tab[data-tab="talents"]');
  const trees=T.trees('vael');
  assert.deepEqual(await pg.evaluate(()=>[...document.querySelectorAll('.tl-head .glTab span:first-child')].map(e=>e.textContent)),trees.map(t=>t.name),'three sub-tabs, the trees by name');
  assert.equal(await pg.evaluate(()=>document.getElementById('tlPts').textContent),'Points: 0 / 91');
  assert.equal(await pg.evaluate(()=>!!document.querySelector('.tl-pts span')),false,'"Talents open at hero level 10" is not shown once the hero is level 10 or more');
  assert.equal(await pg.evaluate(()=>document.getElementById('heroDetail').classList.contains('tl-short')),false,'a tall window keeps the full hero header');
  assert.equal(await pg.evaluate(()=>getComputedStyle(document.querySelector('.tl-top')).position),'sticky','the tree tabs and the points line stay in view while the board scrolls');
  assert.equal(await pg.evaluate(()=>document.querySelector('.tl-plays').textContent),trees[0].plays);
  await pg.waitForFunction(()=>document.querySelectorAll('.tl-cell img.tl-art').length>0,null,{timeout:15000});
  for(let i=0;i<3;i++){ await pg.click('.tl-head .glTab:nth-child('+(i+1)+')');
    const got=await pg.evaluate(()=>({n:document.querySelectorAll('.tl-cell').length,art:document.querySelectorAll('.tl-cell img.tl-art').length,arrows:document.querySelectorAll('.tl-arrow').length,tiers:document.querySelectorAll('.tl-tier').length,
      bad:[...document.querySelectorAll('.tl-cell img.tl-art')].filter(im=>im.complete&&!im.naturalWidth).length,letters:[...document.querySelectorAll('.tl-cell')].filter(c=>/[A-Za-z]/.test(c.textContent)).length}));
    assert.equal(got.n,trees[i].talents.length,'every talent of '+trees[i].name+' is on the board'); assert.equal(got.tiers,13);
    assert.equal(got.arrows,trees[i].talents.filter(t=>t[6]).length,'one arrow per prerequisite');
    assert.equal(got.art,got.n,'Vael is painted: every icon has art'); assert.equal(got.letters,0,'no initials on an icon, only the rank counter');
    assert.deepEqual(await fits(pg),[]);
    await shot(pg,'desktop-02-vael-tree-'+(i+1)+'-'+trees[i].id); await pg.evaluate(()=>{ const b=document.getElementById('tlBoard'); b.scrollIntoView({block:'end'}); }); await shot(pg,'desktop-02-vael-tree-'+(i+1)+'-'+trees[i].id+'-bottom'); }
  await pg.click('.tl-head .glTab:nth-child(1)');
  const tree=trees[0], first=tree.talents.find(t=>t[1]===1), deep=tree.talents.find(t=>t[1]===2);
  // every arrow runs straight down from the bottom of its prerequisite to the top of its talent
  const geo=await pg.evaluate(()=>{ const r=e=>e.getBoundingClientRect(), out=[]; const cells={}; document.querySelectorAll('.tl-cell').forEach(c=>cells[c.style.gridRow+'/'+c.style.gridColumn]=r(c));
    document.querySelectorAll('.tl-arrow').forEach(a=>{ const m=/^(\d+) \/ (\d+)$/.exec(a.style.gridRow), col=a.style.gridColumn, p=cells[m[1]+'/'+col], c=cells[(m[2]-1)+'/'+col], ar=r(a);
      out.push(!!(p&&c&&ar.top>=p.bottom-1&&ar.bottom<=c.top+1&&ar.height>8&&Math.abs((ar.left+ar.right)/2-(p.left+p.right)/2)<2)); }); return out; });
  assert.ok(geo.length>0&&geo.every(Boolean),'arrows sit between the two icons, centred on the column');
  // hover: the card, no button; it tells why a tier-2 talent cannot be learned yet
  await pg.evaluate(()=>document.querySelector('#heroDetailBody .hd-tabbar').scrollIntoView({block:'start'})); await wait(300);   // tier 1 clear of the pinned tree tabs
  await pg.hover('#tl_'+first[0]);
  assert.equal(await pg.evaluate(()=>document.querySelector('#tlCard .tl-cn').textContent),first[3]);
  assert.equal(await pg.evaluate(()=>document.querySelector('#tlCard .tl-ct').textContent),first[5],'the talent text exactly as the data file has it');
  assert.equal(await pg.evaluate(()=>document.querySelector('#tlCard .tl-cr').textContent),'Rank 0 / '+first[4]);
  assert.equal(await pg.evaluate(()=>!!document.getElementById('tlLearn')),false,'the hover card has no button');
  await pg.hover('#tl_'+deep[0]);
  assert.match(await pg.evaluate(()=>document.querySelector('#tlCard .tl-cw').textContent),/Spend 5 more points in this tree/);
  assert.match(await cls(pg,deep[0]),/\bno\b/); assert.match(await cls(pg,first[0]),/\bcan\b/);
  await pg.mouse.move(5,5); assert.equal(await pg.evaluate(()=>!!document.getElementById('tlCard')),false,'the hover card leaves with the mouse');
  // a click opens the card with Learn; nothing is learned until Learn is pressed
  await pg.click('#tl_'+first[0]); await wait(450);
  assert.equal(await pg.evaluate(()=>!!document.getElementById('tlLearn')),true); assert.deepEqual(await build(pg),{r:{}},'opening a card learns nothing');
  await shot(pg,'desktop-03-talent-card');
  await pg.click('#tlLearn'); await pg.waitForFunction(id=>(G.talents.vael||{r:{}}).r[id]===1,first[0]);
  assert.equal(await pg.evaluate(()=>document.getElementById('tlPts').textContent),'Points: 1 / 91');
  assert.equal(await pg.evaluate(()=>document.querySelector('#tlCard .tl-cr').textContent),'Rank 1 / '+first[4],'the card stays open on the talent after a learn');
  assert.deepEqual(s.disk().led.talents.vael,{r:{[first[0]]:1}},'the server saved it');
  // a double click learns too; a tier-2 double click is refused by the rules and spends nothing
  await pg.click('.tl-plays'); assert.equal(await pg.evaluate(()=>!!document.getElementById('tlCard')),false,'a press anywhere else closes the card'); await wait(450);
  await pg.dblclick('#tl_'+first[0]); await pg.waitForFunction(id=>(G.talents.vael||{r:{}}).r[id]===2,first[0]);
  await wait(450); await pg.dblclick('#tl_'+deep[0]); await wait(600);
  assert.deepEqual(await build(pg),{r:{[first[0]]:2}}); assert.match(await pg.evaluate(()=>document.querySelector('#tlCard .tl-cw').textContent),/more points? in this tree/);
  assert.equal(await pg.evaluate(()=>document.getElementById('tlLearn').disabled),true,'Learn is off on a talent that cannot be learned');
  // down to the signature: 61 points, each one by the card's Learn button
  const {order,sig}=pathToSignature('vael',tree); assert.equal(order.length,61,'the signature is reachable with exactly 61 points');
  let have={r:{[first[0]]:2}}; const todo=order.slice(); for(let k=0;k<2;k++){ const i=todo.indexOf(first[0]); assert.ok(i>=0); todo.splice(i,1); }
  let last=null; for(const id of todo){ if(id!==last){ await pg.evaluate(()=>talentCardHide()); await pg.click('#tl_'+id); last=id; }
    const want=(have.r[id]|0)+1; await pg.waitForFunction(()=>{ const b=document.getElementById('tlLearn'); return b&&!b.disabled; });
    await pg.click('#tlLearn'); await pg.waitForFunction(([id,want])=>(G.talents.vael||{r:{}}).r[id]===want&&!TAL.busy,[id,want]); have.r[id]=want; }
  assert.equal(T.spent('vael',await build(pg)).total,61); assert.equal(T.rankOf(await build(pg),sig),1,'the tier-13 signature is learned');
  assert.equal(T.invalid('vael',s.disk().led.talents.vael,100),'','the saved build is legal'); assert.equal(T.spent('vael',s.disk().led.talents.vael).total,61);
  assert.match(await cls(pg,sig),/\bmax\b/); assert.equal(await pg.evaluate(()=>document.getElementById('tlPts').textContent),'Points: 61 / 91');
  assert.equal(await pg.evaluate(()=>document.querySelector('.tl-head .glTab.on .tl-subn').textContent),'61');
  assert.equal(await pg.evaluate(()=>document.querySelectorAll('.tl-tier.open').length),13,'all thirteen tiers read as open');
  assert.equal(await pg.evaluate(()=>!!document.querySelector('.tl-arrow.on')),true,'an arrow whose prerequisite is maxed lights up');
  await pg.evaluate(()=>talentCardHide()); await shot(pg,'desktop-04-vael-61-points-bottom');
  await pg.evaluate(()=>document.querySelector('.tl-head').scrollIntoView({block:'start'})); await shot(pg,'desktop-04-vael-61-points-top');
  // a pick-one fork: take one half (in a second tree if the first tree's forks were not on the way), then the other half is locked
  let fk=null, fkTree=0; const cur=await build(pg);
  for(let i=0;i<3&&!fk;i++){ const c=trees[i].talents.find(t=>t[7]&&T.rankOf(cur,t[0])>0); if(c){ fk={taken:c[0],other:c[7]}; fkTree=i; } }
  if(!fk){ for(let i=0;i<3&&!fk;i++){ const c=trees[i].talents.find(t=>t[7]&&T.canLearn('vael',cur,t[0],100)); if(c){ fk={take:c[0],other:c[7]}; fkTree=i; } } }
  assert.ok(fk,'a fork is within reach');
  await pg.click('.tl-head .glTab:nth-child('+(fkTree+1)+')');
  if(fk.take){ await pg.dblclick('#tl_'+fk.take); await pg.waitForFunction(id=>(G.talents.vael||{r:{}}).r[id]===1,fk.take); fk.taken=fk.take; await wait(450); }
  assert.match(await cls(pg,fk.other),/\block\b/,'the other half of the fork shows as locked');
  const before=await build(pg); await pg.evaluate(()=>talentCardHide()); await pg.dblclick('#tl_'+fk.other); await wait(600);
  assert.deepEqual(await build(pg),before,'a locked fork half cannot be learned');
  assert.match(await pg.evaluate(()=>document.querySelector('#tlCard .tl-cw').textContent),/^Locked: .+ was chosen\.$/);
  assert.equal(await pg.evaluate(()=>document.getElementById('tlLearn').disabled),true);
  await pg.evaluate(id=>document.getElementById('tl_'+id).scrollIntoView({block:'center'}),fk.other); await shot(pg,'desktop-05-locked-fork-half');
  // the server refuses it too (the page's check is not the only one)
  const direct=await pg.evaluate(id=>api('/api/talents/learn','POST',{key:'vael',id,requestId:'ui-direct-1'}),fk.other); assert.equal(direct.ok,false); assert.match(direct.error,/^Locked:/);
  // reset: an in-page confirm step, Cancel keeps everything, Reset gives every point back
  const spentNow=T.spent('vael',before).total;
  await pg.evaluate(()=>{ talentCardHide(); document.querySelector('.tl-head').scrollIntoView({block:'start'}); });
  await pg.click('#tlReset'); assert.match(await pg.evaluate(()=>document.querySelector('#tlAsk span').textContent),new RegExp('Reset all '+spentNow+' talent points of Vael\\?'));
  assert.match(await pg.evaluate(()=>document.getElementById('tlResetCost').textContent),/Costs\s*1000 \(you have\s*1000\)\./,'the confirm shows the price and her diamonds (Phil: "1000 diamonds to reset talents")'); assert.equal(await pg.evaluate(()=>document.getElementById('tlResetYes').disabled),false);
  await shot(pg,'desktop-06-reset-confirm');
  await pg.click('#tlResetNo'); assert.deepEqual(await build(pg),before); assert.equal(await pg.evaluate(()=>!!document.getElementById('tlAsk')),false);
  await pg.click('#tlReset'); await pg.click('#tlResetYes'); await pg.waitForFunction(()=>!(G.talents&&G.talents.vael));
  assert.equal(await pg.evaluate(()=>document.getElementById('tlPts').textContent),'Points: 0 / 91'); assert.equal(s.disk().led.talents.vael,undefined,'reset is saved; the hero has no entry');
  assert.equal(await pg.evaluate(()=>document.getElementById('tlReset').disabled),true,'nothing to reset');
  assert.equal(await pg.evaluate(()=>G.gems),0,'1000 diamonds paid'); assert.equal(s.disk().led.gems,0);
  assert.equal(await pg.evaluate(()=>'vael' in (G.talents||{})),false,'a hero with nothing learned has no entry in G.talents');
  // with fewer than 1000 diamonds the confirm says so and its Reset is off; the server refuses too
  { const t1=T.trees('vael')[0].talents.find(x=>x[1]===1&&!x[7]); await pg.evaluate(id=>talentLearn('vael',id),t1[0]); await pg.waitForFunction(id=>(G.talents.vael||{r:{}}).r[id]===1&&!TAL.busy,t1[0]);
    await pg.evaluate(()=>{ talentCardHide(); document.querySelector('.tl-head').scrollIntoView({block:'start'}); }); await pg.click('#tlReset');
    assert.match(await pg.evaluate(()=>document.getElementById('tlResetCost').textContent),/Costs\s*1000 \(you have\s*0\)\. Not enough diamonds\./); assert.equal(await pg.evaluate(()=>document.getElementById('tlResetYes').disabled),true,'Reset is off');
    const direct=await pg.evaluate(()=>api('/api/talents/reset','POST',{key:'vael',requestId:'ui-direct-reset'})); assert.equal(direct.ok,false); assert.match(direct.error,/Not enough diamonds/);
    await shot(pg,'desktop-07-reset-short'); await pg.click('#tlResetNo'); assert.deepEqual(s.disk().led.talents.vael,{r:{[t1[0]]:1}},'nothing changed'); }
  // a hero under level 10: no points, every talent shown as not open (whatever art is painted for him: dimmed if any), the reason on the card
  await openHero(pg,LOW,'talents'); assert.deepEqual(await tabs(pg),ORDER_ON);
  assert.equal(await pg.evaluate(()=>document.getElementById('tlPts').textContent),'Points: 0 / 0');
  assert.match(await pg.evaluate(()=>document.querySelector('.tl-pts span').textContent),/Talents open at hero level 10/,'shown while the hero is under level 10');
  const low=await pg.evaluate(()=>({cells:document.querySelectorAll('.tl-cell').length,no:document.querySelectorAll('.tl-cell.no').length,can:document.querySelectorAll('.tl-cell.can,.tl-cell.some,.tl-cell.max').length,
    art:document.querySelectorAll('.tl-cell img.tl-art').length,dim:document.querySelectorAll('.tl-cell.no img.tl-art').length}));
  assert.equal(low.cells,T.trees(LOW)[0].talents.length,'the whole tree is drawn'); assert.equal(low.no,low.cells,'every talent is shown as not open'); assert.equal(low.can,0,'none learnable or learned');
  assert.equal(low.dim,low.art,'the art painted for him ('+low.art+' tiles) is all on not-open tiles');
  assert.equal(await pg.evaluate(()=>!!document.querySelector('#heroDetailBody .hd-tab[data-tab="talents"] .hupDot')),false,'no points, no red dot');
  await shot(pg,'desktop-07-no-art-hero');
  const nf=T.trees(LOW)[0].talents[0]; await pg.dblclick('#tl_'+nf[0]); await wait(500);
  assert.match(await pg.evaluate(()=>document.querySelector('#tlCard .tl-cw').textContent),WIRED.has(LOW)?/Talents open at hero level 10/:/^Coming soon$/,'the reason on the card (a hero whose talents are not wired yet says so instead)'); assert.equal(s.disk().led.talents[LOW],undefined);
  assert.deepEqual(await fits(pg),[]);
  assert.deepEqual(pg._errs,[],'no page errors'); assert.equal(pg._dialogs,0,'no browser alert / confirm / prompt');
} finally{ if(pg) await pg.context().close(); await s.stop(); } });

test('flag on, a phone (390 x 844, touch): tab row fits, tap opens the card, double tap learns, the board fits',async()=>{ const s=await server(true); let pg; try{
  pg=await game(s.port,390,844,true);
  await openHero(pg,'vael','stats'); assert.deepEqual(await tabs(pg),ORDER_ON);
  const row=await pg.evaluate(()=>{ const V=ewGameView(); return [...document.querySelectorAll('#heroDetailBody .hd-tab')].map(b=>{ const r=b.ewGameRect(); return {in:r.left>=-1&&r.right<=V.width+1,cut:b.scrollWidth>b.clientWidth+1,top:Math.round(r.top)}; }); });
  assert.ok(row.every(x=>x.in&&!x.cut),'six tabs fit the phone, no label cut: '+JSON.stringify(row)); assert.equal(new Set(row.map(x=>x.top)).size,1,'one row');
  await pg.evaluate(()=>document.querySelector('#heroDetailBody .hd-tabbar').scrollIntoView({block:'center'})); await shot(pg,'phone-01-tab-row');
  await pg.tap('#heroDetailBody .hd-tab[data-tab="talents"]');
  await pg.waitForFunction(()=>document.querySelectorAll('.tl-cell img.tl-art').length>0,null,{timeout:15000});
  const trees=T.trees('vael');
  for(let i=0;i<3;i++){ await pg.tap('.tl-head .glTab:nth-child('+(i+1)+')'); assert.deepEqual(await fits(pg),[]);
    assert.equal(await pg.evaluate(()=>[...document.querySelectorAll('.tl-head .glTab')].some(b=>b.scrollWidth>b.clientWidth+1)),false,'tree names are not cut');
    await pg.evaluate(()=>document.querySelector('#heroDetailBody .hd-tabbar').scrollIntoView({block:'center'})); await shot(pg,'phone-02-vael-tree-'+(i+1)+'-'+trees[i].id);
    await pg.evaluate(()=>document.getElementById('tlBoard').scrollIntoView({block:'end'})); await shot(pg,'phone-02-vael-tree-'+(i+1)+'-'+trees[i].id+'-bottom'); }
  await pg.tap('.tl-head .glTab:nth-child(1)');
  const tree=trees[0], first=tree.talents.find(t=>t[1]===1);
  await pg.evaluate(()=>document.getElementById('tlBoard').scrollIntoView({block:'start'}));
  await pg.tap('#tl_'+first[0]); await wait(500);
  assert.equal(await pg.evaluate(()=>document.querySelector('#tlCard .tl-cn').textContent),first[3]); assert.deepEqual(await build(pg),{r:{}},'one tap only opens the card');
  const card=await pg.evaluate(id=>{ const c=document.getElementById('tlCard').ewGameRect(), a=document.getElementById('tl_'+id).ewGameRect(), V=ewGameView(); return {in:c.left>=0&&c.right<=V.width&&c.top>=0&&c.bottom<=V.height, clear:c.bottom<=a.top||c.top>=a.bottom||c.right<=a.left||c.left>=a.right}; },first[0]);
  assert.deepEqual(card,{in:true,clear:true},'the card is on the screen and does not cover its icon');
  await shot(pg,'phone-03-talent-card');
  await pg.tap('#tlLearn'); await pg.waitForFunction(id=>(G.talents.vael||{r:{}}).r[id]===1,first[0]);
  await pg.evaluate(()=>talentCardHide()); await wait(450);
  await pg.tap('#tl_'+first[0]); await pg.tap('#tl_'+first[0]); await pg.waitForFunction(id=>(G.talents.vael||{r:{}}).r[id]===2,first[0]);
  assert.equal(await pg.evaluate(()=>document.getElementById('tlPts').textContent),'Points: 2 / 91');
  await pg.evaluate(()=>talentCardHide()); await shot(pg,'phone-04-two-points');
  // reset on the phone
  await pg.evaluate(()=>document.querySelector('.tl-head').scrollIntoView({block:'start'}));
  await pg.tap('#tlReset'); assert.deepEqual(await fits(pg),[]); await shot(pg,'phone-05-reset-confirm'); await pg.tap('#tlResetYes'); await pg.waitForFunction(()=>!(G.talents&&G.talents.vael));
  await openHero(pg,LOW,'talents'); assert.deepEqual(await fits(pg),[]);
  await pg.evaluate(()=>document.querySelector('#heroDetailBody .hd-tabbar').scrollIntoView({block:'center'})); await shot(pg,'phone-06-no-art-hero');
  assert.deepEqual(pg._errs,[],'no page errors'); assert.equal(pg._dialogs,0);
} finally{ if(pg) await pg.context().close(); await s.stop(); } });

/* Round 2 (14 Nov): a phone held in landscape is the game's normal phone view and is only about 390 px tall. On the Talents tab the hero header is a
   slim strip, the tree tabs / points / Reset stand in a column, and the board takes the rest with its own scroll. No other tab changes. */
test('flag on, a phone in landscape (844 x 390): at least 4 tiers of the board without scrolling; the other tabs keep their layout',async()=>{ const s=await server(true); let pg; try{
  pg=await game(s.port,844,390,true);
  const lay=()=>pg.evaluate(()=>{ const r=e=>e?e.ewGameRect():null, L=document.querySelector('#heroDetailBody .hd-left'), host=document.getElementById('heroDetail'), pw=document.querySelector('#heroDetailBody .hd-power');
    return {short:host.classList.contains('tl-short'),leftPos:getComputedStyle(L).position,leftH:Math.round(r(L).height),leftW:Math.round(r(L).width),stars:getComputedStyle(L.querySelector('.hd-starrow')).display,power:pw?getComputedStyle(pw).display:'none',overflow:getComputedStyle(host).overflowY,scroll:host.scrollHeight>host.clientHeight+2}; });
  await openHero(pg,'vael','stats'); const stats0=await lay(); assert.equal(stats0.short,false); assert.equal(stats0.leftPos,'static'); assert.notEqual(stats0.stars,'none'); assert.notEqual(stats0.power,'none');
  await pg.tap('#heroDetailBody .hd-tab[data-tab="talents"]'); await pg.waitForFunction(()=>document.querySelectorAll('.tl-cell img.tl-art').length>0,null,{timeout:15000}); await wait(300);
  const t=await lay(); assert.equal(t.short,true,'the short layout is on'); assert.ok(t.leftH<=40,'the hero header is a slim strip ('+t.leftH+' px)'); assert.equal(t.stars,'none'); assert.equal(t.power,'none'); assert.equal(t.scroll,false,'the page itself does not scroll: the board does');
  assert.deepEqual(await tabs(pg),ORDER_ON,'the tab row is still there');
  const vis=await pg.evaluate(()=>{ const V=ewGameView(), sc=document.getElementById('tlScroll').ewGameRect(), ok=el=>{ const r=el.ewGameRect(); return r.height>0&&r.top>=sc.top-1&&r.bottom<=Math.min(sc.bottom,V.height)+1&&r.left>=0&&r.right<=V.width+1; };
    const tiers=[...document.querySelectorAll('.tl-tier')].filter(ok).length, rows=new Set([...document.querySelectorAll('.tl-cell')].filter(ok).map(c=>c.style.gridRow)).size;
    const strip=[...document.querySelectorAll('#heroDetailBody .hd-left > .hd-name,#heroDetailBody .hd-left > .hd-lvl,#heroDetailBody .hd-port')].map(e=>{ const r=e.ewGameRect(); return r.width>0&&r.top>=0&&r.bottom<=V.height; });
    const side=['.tl-head','#tlPts','#tlReset'].map(q=>{ const r=document.querySelector(q).ewGameRect(); return r.height>0&&r.top>=0&&r.bottom<=V.height+1; });
    return {tiers,rows,strip,side,plays:getComputedStyle(document.getElementById('tlPlays')).display,sy:getComputedStyle(document.getElementById('tlScroll')).overflowY,name:document.querySelector('#heroDetailBody .hd-left > .hd-name').textContent.trim().slice(0,4),lvl:document.querySelector('#heroDetailBody .hd-lvl').textContent}; });
  assert.ok(vis.tiers>=4&&vis.rows>=4,'at least 4 whole tiers of the board are on screen without scrolling ('+vis.tiers+' tier labels, '+vis.rows+' icon rows)');
  assert.deepEqual(vis.strip,[true,true,true],'portrait, name and level are on the strip'); assert.equal(vis.name,'Vael'); assert.match(vis.lvl,/100/);
  assert.deepEqual(vis.side,[true,true,true],'tree tabs, points and Reset are on screen'); assert.equal(vis.plays,'none','the description is hidden until asked for'); assert.equal(vis.sy,'auto');
  assert.deepEqual(await fits(pg),[]); await shot(pg,'landscape-01-talents-open');
  // the description: a tap on the open tree's name shows it, a tap on it puts it away; another tree's name switches tree
  await pg.tap('.tl-head .glTab.on'); assert.equal(await pg.evaluate(()=>getComputedStyle(document.getElementById('tlPlays')).display),'block');
  assert.equal(await pg.evaluate(()=>document.getElementById('tlPlays').textContent),T.trees('vael')[0].plays); await shot(pg,'landscape-02-description-open');
  await pg.tap('#tlPlays'); assert.equal(await pg.evaluate(()=>getComputedStyle(document.getElementById('tlPlays')).display),'none');
  await pg.tap('.tl-head .glTab:nth-child(2)'); assert.equal(await pg.evaluate(()=>document.getElementById('tlBoard').dataset.tree),T.trees('vael')[1].id); await pg.tap('.tl-head .glTab:nth-child(1)');
  // the board scrolls by itself, and a learn keeps it where it was
  const first=T.trees('vael')[0].talents.find(x=>x[1]===1);
  await pg.tap('#tl_'+first[0]); await wait(450); const card=await pg.evaluate(id=>{ const c=document.getElementById('tlCard').ewGameRect(), a=document.getElementById('tl_'+id).ewGameRect(), V=ewGameView(); return {in:c.left>=0&&c.right<=V.width&&c.top>=0&&c.bottom<=V.height,clear:c.bottom<=a.top||c.top>=a.bottom||c.right<=a.left||c.left>=a.right,narrow:c.width<=V.width*0.42+1}; },first[0]);
  assert.deepEqual(card,{in:true,clear:true,narrow:true},'the card is on screen, beside its icon, and narrow'); await shot(pg,'landscape-03-card');
  for(let k=1;k<=first[4];k++){ await pg.waitForFunction(()=>{ const b=document.getElementById('tlLearn'); return b&&!b.disabled; }); await pg.tap('#tlLearn'); await pg.waitForFunction(([id,k])=>(G.talents.vael||{r:{}}).r[id]===k&&!TAL.busy,[first[0],k]); }
  await pg.evaluate(()=>talentCardHide());
  const t2=T.trees('vael')[0].talents.find(x=>x[1]===2&&!x[7]);
  await pg.evaluate(()=>{ document.getElementById('tlScroll').scrollTop=70; }); await wait(150);
  await pg.tap('#tl_'+t2[0]); const at=await pg.evaluate(()=>Math.round(document.getElementById('tlScroll').scrollTop)); assert.ok(at>20); await pg.tap('#tlLearn'); await pg.waitForFunction(id=>(G.talents.vael||{r:{}}).r[id]===1&&!TAL.busy,t2[0]);
  assert.equal(await pg.evaluate(()=>Math.round(document.getElementById('tlScroll').scrollTop)),at,'the board stays where it was after a learn');
  await pg.evaluate(()=>{ talentCardHide(); const sc=document.getElementById('tlScroll'); sc.scrollTop=sc.scrollHeight; }); await wait(200);
  assert.equal(await pg.evaluate(()=>{ const sc=document.getElementById('tlScroll').ewGameRect(), r=[...document.querySelectorAll('.tl-tier')].pop().ewGameRect(), c=[...document.querySelectorAll('.tl-cell .tl-rk')].pop().ewGameRect(); return r.bottom<=sc.bottom+1&&c.bottom<=sc.bottom+1; }),true,'tier 13 and its counter are reachable at the end of the board');
  await shot(pg,'landscape-04-board-end');
  // reset in the side column
  await pg.tap('#tlReset'); assert.deepEqual(await fits(pg),[]); assert.equal(await pg.evaluate(()=>{ const V=ewGameView(), r=document.getElementById('tlResetYes').ewGameRect(); return r.top>=0&&r.bottom<=V.height; }),true); await shot(pg,'landscape-05-reset-confirm');
  await pg.tap('#tlResetYes'); await pg.waitForFunction(()=>!(G.talents&&G.talents.vael));
  // every other tab is exactly as it was before the Talents tab was opened
  await pg.tap('#heroDetailBody .hd-tab[data-tab="stats"]'); assert.deepEqual(await lay(),stats0,'Stats after Talents = Stats before');
  for(const tab of ['glyphs','equip','skills','lore']){ await pg.tap('#heroDetailBody .hd-tab[data-tab="'+tab+'"]'); const l=await lay(); assert.equal(l.short,false,tab); assert.equal(l.leftPos,'static',tab); assert.equal(l.leftH,stats0.leftH,tab+': the full hero header'); }
  await openHero(pg,LOW,'talents'); await wait(300); assert.equal((await lay()).short,true); assert.match(await pg.evaluate(()=>document.querySelector('.tl-pts span').textContent),/level 10/); assert.deepEqual(await fits(pg),[]); await shot(pg,'landscape-06-no-art-hero');
  assert.deepEqual(pg._errs,[],'no page errors'); assert.equal(pg._dialogs,0);
} finally{ if(pg) await pg.context().close(); await s.stop(); } });

/* LOCKED HEROES and the RED DOT (14 Nov 2026). Phil: "Yes red dot on any tab with available upgrades."
   A hero whose talents are not wired yet: its trees (art, text) are shown with one notice ("Coming soon"), nothing can be learned, no dot, and a build
   in the save reaches neither its fights nor its power. A wired hero: the Talents tab's dot is on while a talent can be learned and goes the moment the
   last point is spent, on the tab and on the hero's card in the list. Each check has its control in the page itself: the same check run with that piece
   of the page put back as it was (the lock removed, the old points-only dot, a cache that ignores the build, no card refresh) must come out the other way.
   Also measures what the dot costs the hero list. */
/* LOCKDOTS_OUT=<file>: this test's notes (the cost, a failure's message) are also written there - the queue script shows only ok / not ok lines */
const note=x=>{ if(process.env.LOCKDOTS_OUT) try{ fs.appendFileSync(process.env.LOCKDOTS_OUT,x+String.fromCharCode(10)); }catch(e){} };
function statBuild(hero,level,n){ let b={r:{}}; const tr=T.trees(hero)[0];
  for(let g=0;g<400&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>(FX.has(hero,c[0])-FX.has(hero,a[0]))||a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return b; }
test('flag on: an unwired hero shows its trees with a notice and cannot learn; the red dot follows what can be learned; the hero list is no slower (1400 x 900)',{skip:!LOCKED&&'every hero is wired'},async()=>{
  assert.equal(WIRED.has(DOTH),true,DOTH+' is wired'); assert.equal(WIRED.has('vael'),true);
  const s=await server(true,u=>{ const L=u.led; L.gold=0; L.gems=10000;   /* no gold: no skill can be raised, so a hero card's dot is the Talents one alone; gems for three 1000-diamond resets */
    L.hero[LOCKED]={xp:xpFor(50),stars:1,pips:0,ref:0}; L.unlocked[LOCKED]=true; L.hero[DOTH]={xp:xpFor(10),stars:1,pips:0,ref:0}; L.unlocked[DOTH]=true; }); let pg; try{
  pg=await game(s.port,1400,900,false); try{
  const view=k=>pg.evaluate(k=>({soon:(document.getElementById('tlSoon')||{}).textContent||null,cells:document.querySelectorAll('.tl-cell').length,can:document.querySelectorAll('.tl-cell.can').length,
    art:document.querySelectorAll('.tl-cell img.tl-art').length,lit:document.querySelectorAll('.tl-cell:not(.no):not(.lock) img.tl-art').length,plays:document.getElementById('tlPlays').textContent,
    dot:heroUpgrades(k).talents,tabDot:!!document.querySelector('#heroDetailBody .hd-tab[data-tab="talents"] .hupDot')}),k);
  const cardDot=k=>pg.evaluate(k=>!!document.querySelector('#heroList .hero-card[data-hero-key="'+k+'"] > .hupDot'),k);
  // ---- the unwired hero ----
  await openHero(pg,LOCKED,'stats'); assert.deepEqual(await tabs(pg),ORDER_ON,'the Talents tab is there for an unwired hero');
  await pg.click('#heroDetailBody .hd-tab[data-tab="talents"]'); await pg.waitForFunction(()=>document.querySelectorAll('.tl-cell img.tl-art').length>0,null,{timeout:15000});
  const tr=T.trees(LOCKED)[0], v=await view(LOCKED);
  assert.equal(v.soon,'Coming soon','one short notice'); assert.equal(v.cells,tr.talents.length,'the whole tree is drawn'); assert.equal(v.plays,tr.plays,'the tree\'s text');
  assert.equal(v.art,v.cells,'every icon has its art'); assert.ok(v.lit>0,'the open tier\'s art is shown at full colour'); assert.equal(v.can,0,'no talent is shown as learnable');
  assert.equal(v.dot,false,'unspent points, but no red dot'); assert.equal(v.tabDot,false);
  assert.deepEqual(await fits(pg),[]); await shot(pg,'desktop-09-locked-hero');
  const t1=tr.talents.find(t=>t[1]===1&&!t[7]);
  await pg.click('#tl_'+t1[0]); await wait(450);
  const card=await pg.evaluate(()=>({ct:document.querySelector('#tlCard .tl-ct').textContent,cw:(document.querySelector('#tlCard .tl-cw')||{}).textContent||null,learn:!!document.getElementById('tlLearn')}));
  assert.deepEqual(card,{ct:t1[5],cw:'Coming soon',learn:false},'the card: the talent\'s text, the notice, no Learn button'); await shot(pg,'desktop-10-locked-card');
  await pg.evaluate(()=>talentCardHide()); await wait(450); await pg.dblclick('#tl_'+t1[0]); await wait(700);
  assert.equal(await pg.evaluate(k=>!!(G.talents&&G.talents[k]),LOCKED),false,'a double click learns nothing'); assert.equal(((s.disk().led.talents)||{})[LOCKED],undefined,'and nothing reached the server');
  // a build in the save (as if one got there): no fight list, no power
  const sb=statBuild(LOCKED,50,7); assert.ok(Object.keys(FX.totals(LOCKED,T.learned(LOCKED,sb))).length>0);
  const pw=await pg.evaluate(([k,b])=>{ const p0=heroPower(k), keep=G.talents; G.talents=Object.assign({},keep,{[k]:b}); const p1=heroPower(k), l=talentListLocal(k), u=heroTalentsCanUp(k); G.talents=keep; return {p0,p1,l,u}; },[LOCKED,sb]);
  assert.equal(pw.l,null,'no learned list for its fights'); assert.equal(pw.p1,pw.p0,'the power number is the no-talent one'); assert.equal(pw.u,false);
  /* controls: the same checks with the lock taken out (talentsWired always yes), and with the old dot (any unspent point) */
  const ctl=await pg.evaluate(([k,b,id])=>{ const W=talentsWired, H=heroTalentsCanUp, out={}; try{
      talentsWired=function(){ return true; }; renderHeroDetail(); out.soon=!!document.getElementById('tlSoon'); out.can=document.querySelectorAll('.tl-cell.can').length>0; out.dot=heroUpgrades(k).talents;
      talentCardShow(k,id,true); out.learn=!!document.getElementById('tlLearn')&&!document.getElementById('tlLearn').disabled; talentCardHide();
      const keep=G.talents; G.talents=Object.assign({},keep,{[k]:b}); out.list=!!talentListLocal(k); G.talents=keep;   /* (the power: talents-power.js itself prices an unwired hero at 0, a second guard) */
      talentsWired=W; heroTalentsCanUp=function(key){ try{ if(!talentsOn(key)||!heroOwned(key)) return false; return TALENTS.spent(key,talentBuild(key)).total<TALENTS.pointsTotal(heroLevel(key)); }catch(e){ return false; } };
      out.oldDot=heroUpgrades(k).talents; return out; } finally{ talentsWired=W; heroTalentsCanUp=H; renderHeroDetail(); } },[LOCKED,sb,t1[0]]);
  assert.deepEqual(ctl,{soon:false,can:true,dot:true,learn:true,list:true,oldDot:true},'control: without the lock every check above comes out the other way');
  assert.equal((await view(LOCKED)).soon,'Coming soon','the page is itself again');
  // ---- the red dot on a wired hero: level 10, one point ----
  await pg.evaluate(()=>{ renderHeroList(); });
  const up0=await pg.evaluate(k=>heroUpgrades(k),DOTH); assert.deepEqual(up0,{skills:false,glyphs:false,equip:false,talents:true},'a talent can be learned, nothing else waits');
  assert.equal(await cardDot(DOTH),true,'the hero\'s card in the list has the dot'); assert.equal(await cardDot(LOCKED),false,'the unwired hero\'s card has none');
  await openHero(pg,DOTH,'stats');
  assert.equal(await pg.evaluate(()=>[...document.querySelectorAll('#heroDetailBody .hd-tab')].filter(b=>b.querySelector('.hupDot')).map(b=>b.dataset.tab).join()),'talents','the Talents tab has the dot, and no other tab');
  await shot(pg,'desktop-11-dot-on');
  const d1=T.trees(DOTH)[0].talents.find(t=>t[1]===1&&!t[7]);
  const learnOne=async()=>{ await pg.click('#heroDetailBody .hd-tab[data-tab="talents"]'); await pg.evaluate(()=>talentCardHide()); await pg.click('#tl_'+d1[0]); await pg.waitForFunction(()=>{ const b=document.getElementById('tlLearn'); return b&&!b.disabled; });
    await pg.click('#tlLearn'); await pg.waitForFunction(([k,id])=>(G.talents&&G.talents[k]&&G.talents[k].r[id])===1&&!TAL.busy,[DOTH,d1[0]]); await wait(200); };
  const dots=()=>pg.evaluate(k=>({tab:!!document.querySelector('#heroDetailBody .hd-tab[data-tab="talents"] .hupDot'),card:!!document.querySelector('#heroList .hero-card[data-hero-key="'+k+'"] > .hupDot'),up:heroUpgrades(k).talents}),DOTH);
  const resetAll=async()=>{ await pg.evaluate(k=>talentReset(k),DOTH); await pg.waitForFunction(k=>!(G.talents&&G.talents[k])&&!TAL.busy,DOTH); await wait(200); };
  await learnOne(); assert.deepEqual(await dots(),{tab:false,card:false,up:false},'the last point spent: the dot goes from the tab and from the card at once');
  await shot(pg,'desktop-12-dot-off');
  await resetAll(); assert.deepEqual(await dots(),{tab:true,card:true,up:true},'a reset gives the point back, and the dot');
  /* control 1: an answer cached per hero with no regard to its build would keep the dot after the learn */
  await pg.evaluate(k=>{ const H=heroTalentsCanUp, memo={}; window.__tdH=H; heroTalentsCanUp=function(x){ return (x in memo)?memo[x]:(memo[x]=H(x)); }; heroTalentsCanUp(k); },DOTH);
  await learnOne(); const c1=await dots(); await pg.evaluate(()=>{ heroTalentsCanUp=window.__tdH; renderHeroDetail(); heroUpDotsAll(); });
  assert.deepEqual(c1,{tab:true,card:true,up:true},'control: a cache that ignores the build leaves the dot on'); assert.deepEqual(await dots(),{tab:false,card:false,up:false});
  /* control 2: without the card refresh after a learn, the card in the list keeps its dot */
  await resetAll(); assert.equal((await dots()).card,true);
  await pg.evaluate(()=>{ window.__tdR=heroUpDotsRefresh; heroUpDotsRefresh=function(){}; });
  await learnOne(); const c2=await dots(); await pg.evaluate(()=>{ heroUpDotsRefresh=window.__tdR; heroUpDotsAll(); });
  assert.deepEqual(c2,{tab:false,card:true,up:false},'control: no refresh, the card keeps a dot the hero no longer has'); assert.equal((await dots()).card,false);
  // ---- cost: every hero owned (as a late account has them), each with a build, the hero list drawn with and without the Talents dot ----
  const builds={}; for(const k of Object.keys(DATA.heroes)) if(SIMB[k]) builds[k]=statBuild(k,60,30);
  const perf=await pg.evaluate(B=>{ const keep={u:G.unlocked,x:G.heroXP,t:G.talents}; G.unlocked=Object.assign({},keep.u); G.heroXP=Object.assign({},keep.x); G.talents=Object.assign({},keep.t||{});
    for(const k of HERO_KEYS){ G.unlocked[k]=true; G.heroXP[k]=Math.max(G.heroXP[k]||0,xpForLevel(60)); if(B[k]&&!G.talents[k]) G.talents[k]=B[k]; }
    const med=n=>{ const a=[]; for(let i=0;i<n;i++){ const t0=performance.now(); renderHeroList(); a.push(performance.now()-t0); } a.sort((x,y)=>x-y); return a[n>>1]; };
    const H=heroTalentsCanUp; let out; try{
      med(2); heroTalentsCanUp=function(){ return false; }; const base=med(9); heroTalentsCanUp=H;
      for(const k in TAL_DOT) delete TAL_DOT[k]; let t0=performance.now(), on=0; for(const k of HERO_KEYS) if(heroTalentsCanUp(k)) on++; const cold=performance.now()-t0;
      t0=performance.now(); for(const k of HERO_KEYS) heroTalentsCanUp(k); const warm=performance.now()-t0;
      const real=med(9); out={heroes:HERO_KEYS.length,on,base:+base.toFixed(2),real:+real.toFixed(2),cold:+cold.toFixed(3),warm:+warm.toFixed(3)};
    } finally{ heroTalentsCanUp=H; G.unlocked=keep.u; G.heroXP=keep.x; G.talents=keep.t; for(const k in TAL_DOT) delete TAL_DOT[k]; renderHeroList(); }
    return out; },builds);
  note('hero list cost: '+JSON.stringify(perf)); console.log('    hero list cost: '+JSON.stringify(perf)+' (ms; base = the list with no Talents dot, real = with it; cold / warm = the dot asked for every hero, uncached / cached)');
  assert.ok(perf.on>=10,'many owned heroes have a dot ('+perf.on+')');
  assert.ok(perf.warm<2,'the cached answer for every hero takes '+perf.warm+' ms'); assert.ok(perf.cold<60,'uncached, every hero takes '+perf.cold+' ms');
  assert.ok(perf.real<=perf.base*1.25+5,'the hero list takes '+perf.real+' ms with the dot against '+perf.base+' ms without');
  assert.deepEqual(pg._errs,[],'no page errors'); assert.equal(pg._dialogs,0,'no browser alert / confirm / prompt');
  } catch(e){ note('FAILED: '+String(e&&e.stack||e).slice(0,1500)+' | page errors: '+JSON.stringify(pg._errs)); throw e; }
} finally{ if(pg) await pg.context().close(); await s.stop(); } });

test('flag off: five tabs in the new order, no Talents anywhere, a deep link to it falls back to Stats',async()=>{ const s=await server(false); let pg; try{
  for(const [w,h,touch,tag] of [[1400,900,false,'desktop'],[390,844,true,'phone']]){ pg=await game(s.port,w,h,touch);
    assert.equal(await pg.evaluate(()=>'talents' in G),false,'the ledger carries no talents, so the page keeps none');
    await openHero(pg,'vael','stats'); assert.deepEqual(await tabs(pg),ORDER_OFF);
    await openHero(pg,'vael','talents'); assert.deepEqual(await tabs(pg),ORDER_OFF); assert.equal(await pg.evaluate(()=>heroTab),'stats');
    assert.equal(await pg.evaluate(()=>!!document.getElementById('tlBoard')),false);
    assert.equal(await pg.evaluate(()=>heroUpgrades('vael').talents),false,'no red dot from talents');
    for(const tab of ORDER_OFF){ await pg.click('#heroDetailBody .hd-tab[data-tab="'+tab+'"]'); assert.equal(await pg.evaluate(()=>document.querySelector('#heroDetailBody .hd-tab.on').dataset.tab),tab); }
    await openHero(pg,'vael','stats'); await pg.evaluate(()=>document.querySelector('#heroDetailBody .hd-tabbar').scrollIntoView({block:'center'})); await shot(pg,tag+'-08-flag-off-tab-row');
    assert.deepEqual(pg._errs,[],'no page errors'); await pg.context().close(); pg=null; }
} finally{ if(pg) await pg.context().close(); await s.stop(); } });

test.after(async()=>{ if(_browser) await _browser.close(); });
