'use strict';
/* Talents on the server: /api/talents/learn and /api/talents/reset against a seeded player, and the off switch.
   Run: node --test tests/talents-server.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),net=require('node:net'),os=require('node:os');
const root=path.resolve(__dirname,'..'),T=require(path.join(root,'talents.js')),TEMPLE=require(path.join(root,'server/temple-of-ash.js')),token='talent-fixture-token',start=Date.now();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const STEP=JSON.parse(/const D_HERO_STEP=(\[[^\]]+\])/.exec(fs.readFileSync(path.join(root,'server.js'),'utf8'))[1]);
const xpFor=level=>{ let x=0; for(let L=2;L<=level;L++) x+=STEP[L-2]; return x; };
async function server(flag,heroLevel,playerPx,led,extra){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'emberweave-talents-')),file=path.join(dir,'db.json');
  const user={id:'talent-user',name:'Talent Fixture',created:start-1000,rank:1,coins:0,team:['vael'],wall:['vael'],roster:{},qc:{wish:0},
    led:{v:1,migratedAt:start-1000,rev:1,gold:100000,gems:1000,px:playerPx,hero:{vael:{xp:xpFor(heroLevel),stars:1,pips:0,ref:0}},unlocked:{vael:true},frags:{},camp:{cleared:20,stars:{},att:null},stam:{v:60,ts:start},temple:TEMPLE.newState(),txs:[],quests:{claimed:{},chainStep:0}}}; if(led) Object.assign(user.led,led);
  if(extra) extra(user);   /* more heroes / a saved build on the seeded account (the locked-hero tests) */
  fs.writeFileSync(file,JSON.stringify({users:{[user.id]:user},byName:{'talent fixture':user.id},tokens:{[crypto.createHash('sha256').update(token).digest('hex')]:{id:user.id,iat:start,exp:start+90*86400000}},seeded:true,seedVersion:3,heroIdV:3,guilds:{},idem:{},feedback:[],reports:[],meta:{rollSecret:'talent-test'}}));
  const s=net.createServer(); await new Promise(r=>s.listen(0,'127.0.0.1',r)); const port=s.address().port; await new Promise(r=>s.close(r));
  let log=''; const env={...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:file,NODE_ENV:'test',GAME_URL:'http://127.0.0.1:1'}; if(flag) env.TALENTS_ENABLED='true'; else env.TALENTS_ENABLED='false';   /* on by default since the talents release: off = 'false' */
  const child=cp.spawn(process.execPath,[path.join(root,'server.js')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env});
  child.stdout.on('data',x=>log+=x); child.stderr.on('data',x=>log+=x);
  for(let i=0;;i++){ if(child.exitCode!==null) throw Error(log.slice(-2000)); try{ await fetch('http://127.0.0.1:'+port+'/api/manifest'); break; }catch{} if(i>200) throw Error('server not ready: '+log.slice(-1000)); await wait(50); }
  let n=0;
  const call=async(route,packet,raw)=>{ const r=await fetch('http://127.0.0.1:'+port+route,{method:packet?'POST':'GET',headers:{'content-type':'application/json','x-token':token},body:packet?JSON.stringify(Object.assign({requestId:'t'+(++n)},packet)):undefined}); return raw?r:r.json(); };
  const stop=async()=>{ if(child.exitCode===null) await new Promise(r=>{ child.once('exit',r); child.kill(); }); };
  return {call,stop,disk:()=>JSON.parse(fs.readFileSync(file,'utf8'))};
}
const tree0=T.trees('vael')[0], tier1=tree0.talents.filter(t=>t[1]===1&&!t[7]), tier2=tree0.talents.find(t=>t[1]===2&&!t[6]&&!t[7]);

test('flag off: the routes do not exist and the ledger carries no talents',async()=>{ const s=await server(false,50,5000000); try{
  const r=await s.call('/api/talents/learn',{key:'vael',id:tier1[0][0]},true); assert.equal(r.status,404);
  const L=await s.call('/api/ledger'); assert.equal((L.ledger||L).talents,undefined);
} finally{ await s.stop(); } });

test('flag on: learning, the rules, the ledger, idempotent replays and reset',async()=>{ const s=await server(true,50,50000000); try{
  let L=await s.call('/api/ledger'); L=L.ledger||L; assert.deepEqual(L.talents,{},'an account that never learned a talent has none');
  const want=T.pointsTotal(50);
  // tier 2 is shut before 5 points are in the tree
  let r=await s.call('/api/talents/learn',{key:'vael',id:tier2[0]}); assert.equal(r.ok,false); assert.match(r.error,/more points? in this tree/);
  // one point, and the same request replayed changes nothing
  r=await s.call('/api/talents/learn',{key:'vael',id:tier1[0][0],requestId:'same'}); assert.equal(r.ok,true); assert.equal(r.rank,1); assert.equal(r.spent,1); assert.equal(r.points,want);
  const again=await s.call('/api/talents/learn',{key:'vael',id:tier1[0][0],requestId:'same'}); assert.equal(again.rank,1); assert.equal(again.spent,1);
  assert.deepEqual((r.ledger||{}).talents,{vael:{r:{[tier1[0][0]]:1}}});
  // fill tier 1 to five points, then tier 2 opens
  let spent=1; for(const t of tier1) for(let k=0;k<t[4]&&spent<5;k++){ if(t===tier1[0]&&k===0) continue; const q=await s.call('/api/talents/learn',{key:'vael',id:t[0]}); assert.equal(q.ok,true,q.error); spent=q.spent; }
  assert.equal(spent,5);
  r=await s.call('/api/talents/learn',{key:'vael',id:tier2[0]}); assert.equal(r.ok,true,r.error); assert.equal(r.spent,6);
  // refusals
  assert.match((await s.call('/api/talents/learn',{key:'vael',id:'nope'})).error,/Unknown talent/);
  assert.match((await s.call('/api/talents/learn',{key:'sylthaine',id:'x'})).error,/not unlocked/);
  assert.match((await s.call('/api/talents/learn',{key:'not_a_hero',id:'x'})).error,/Unknown hero/);
  assert.equal((await s.call('/api/talents/learn',{key:'vael',id:tier1[0][0],requestId:''},true)).status,400);
  // it is on disk, and it is legal
  const saved=s.disk().users['talent-user'].led.talents.vael; assert.equal(T.invalid('vael',saved,50),''); assert.equal(T.spent('vael',saved).total,6);
  // reset gives every point back, for 1,000 diamonds (Phil 14 Nov: "1000 diamonds to reset talents"), through the ledger
  assert.equal((r.ledger||{}).talentResetGems,1000,'the ledger view carries the price');
  r=await s.call('/api/talents/reset',{key:'vael',requestId:'rs1'}); assert.equal(r.ok,true); assert.equal(r.refunded,6); assert.equal(r.spent,0); assert.equal(r.cost,1000);
  assert.equal(r.ledger.gems,0,'1,000 diamonds paid'); let D=s.disk().users['talent-user'].led; assert.equal(D.gems,0); assert.equal(D.talents.vael,undefined);
  const tx=D.txs.filter(t=>t.src==='talentreset:vael'); assert.equal(tx.length,1); assert.deepEqual(tx[0].d,{points:6,gems:-1000},'one ledger transaction with the diamonds');
  const rep=await s.call('/api/talents/reset',{key:'vael',requestId:'rs1'}); assert.equal(rep.ok,true); assert.equal(s.disk().users['talent-user'].led.gems,0,'a replayed request does not charge twice');
  assert.match((await s.call('/api/talents/reset',{key:'vael'})).error,/no talents learned/);
  // not enough diamonds: refused, nothing changes
  r=await s.call('/api/talents/learn',{key:'vael',id:tier1[0][0]}); assert.equal(r.ok,true);
  r=await s.call('/api/talents/reset',{key:'vael'}); assert.equal(r.ok,false); assert.match(r.error,/Not enough diamonds - a talent reset costs 1000/); assert.equal(r.cost,1000); assert.equal(r.gems,0);
  D=s.disk().users['talent-user'].led; assert.deepEqual(D.talents.vael,{r:{[tier1[0][0]]:1}},'the build stays'); assert.equal(D.gems,0);
} finally{ await s.stop(); } });

test('a hero under level 10 cannot learn; points never exceed the hero level',async()=>{ const s=await server(true,9,50000000); try{
  const r=await s.call('/api/talents/learn',{key:'vael',id:tier1[0][0]}); assert.equal(r.ok,false); assert.match(r.error,/level 10/);
} finally{ await s.stop(); } });

test('a build the rules already found illegal (a data correction) is reset free, even with no diamonds',async()=>{ const s=await server(true,50,50000000,{gems:0,talents:{vael:{r:{no_such_talent:2}}}}); try{
  const r=await s.call('/api/talents/reset',{key:'vael'}); assert.equal(r.ok,true,r.error); assert.equal(r.cost,0); assert.equal(r.ledger.gems,0);
  assert.equal(s.disk().users['talent-user'].led.talents.vael,undefined);
} finally{ await s.stop(); } });

/* ---- LOCKED HEROES (14 Nov 2026): a hero is wired when talents-mech/<key>.js exists (TalentFx.mechHeroes()). An unwired hero cannot learn,
   and a save that somehow holds talents for it keeps them (nothing is deleted) but they reach no fight unit, spec or power number.
   LOCKED = the last unwired hero in the data's order (heroes are wired roughly in that order, so it stays unwired longest); when every hero
   is wired these tests have nothing to lock and are skipped. Controls: tests/talents-lockdots-controls.js. ---- */
const FX=require(path.join(root,'talents-fx.js')), DATA=require(path.join(root,'talents-data.js')), SIMB=require(path.join(root,'server/sim.js')).HERO_BASE;
const WIRED=new Set(FX.mechHeroes()), LOCKED=Object.keys(DATA.heroes).filter(k=>!WIRED.has(k)&&SIMB[k]).pop()||null;
/* a legal build of `n` points into tree 0, stat talents first (so the build would change the hero's numbers if it were let through) */
function statBuild(hero,level,n){ let b={r:{}}; const tr=T.trees(hero)[0];
  for(let g=0;g<400&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>(FX.has(hero,c[0])-FX.has(hero,a[0]))||a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return b; }

test('locked hero: learning is refused with a clear reason, a saved build is kept untouched, the points stay; a wired hero learns as before',{skip:!LOCKED&&'every hero is wired'},async()=>{
  const lv=50, saved=statBuild(LOCKED,lv,7), first=T.trees(LOCKED)[0].talents.find(t=>t[1]===1&&!t[7]);
  assert.equal(T.invalid(LOCKED,saved,lv),'','the saved build is a legal one'); assert.equal(T.canLearn(LOCKED,saved,first[0],lv)||T.canLearn(LOCKED,{r:{}},first[0],lv),true,'the rules alone would allow the learn');
  const s=await server(true,lv,50000000,null,u=>{ const L=u.led; L.hero[LOCKED]={xp:xpFor(lv),stars:1,pips:0,ref:0}; L.unlocked[LOCKED]=true; L.talents={[LOCKED]:JSON.parse(JSON.stringify(saved))}; }); try{
    assert.equal(WIRED.has('vael'),true,'Vael is wired'); assert.equal(WIRED.has(LOCKED),false);
    let r=await s.call('/api/talents/learn',{key:LOCKED,id:first[0]}); assert.equal(r.ok,false); assert.equal(r.locked,true); assert.match(r.error,/not ready yet/);
    assert.deepEqual(s.disk().users['talent-user'].led.talents[LOCKED],saved,'nothing in the save is changed or deleted');
    r=await s.call('/api/talents/learn',{key:LOCKED,id:'no_such'}); assert.equal(r.locked,true,'refused before the talent is even looked at');
    let L=await s.call('/api/ledger'); L=L.ledger||L; assert.deepEqual(L.talents[LOCKED],saved,'the page still sees what the save holds');
    r=await s.call('/api/talents/learn',{key:'vael',id:tier1[0][0]}); assert.equal(r.ok,true,r.error); assert.equal(r.rank,1,'a wired hero learns');
    assert.deepEqual(s.disk().users['talent-user'].led.talents[LOCKED],saved);
  } finally{ await s.stop(); }
  // an unwired hero with nothing saved: refused, and no entry is created
  const s2=await server(true,lv,50000000,null,u=>{ u.led.hero[LOCKED]={xp:xpFor(lv),stars:1,pips:0,ref:0}; u.led.unlocked[LOCKED]=true; }); try{
    const r=await s2.call('/api/talents/learn',{key:LOCKED,id:first[0]}); assert.equal(r.locked,true);
    assert.equal(((s2.disk().users['talent-user'].led.talents)||{})[LOCKED],undefined);
  } finally{ await s2.stop(); }
});

/* server.js in-process (the way tests/talents-line.test.js loads it): the learned list, the spec, the fight unit and the power number */
function loadServerInProcess(flag){
  const vm=require('node:vm'),Module=require('node:module');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-lock-'));
  process.env.DB_FILE=path.join(tmp,'db.json'); process.env.PORT='0'; process.env.DATABASE_URL='';
  if(flag) process.env.TALENTS_ENABLED='true'; else process.env.TALENTS_ENABLED='false';   /* the switch is on by default since the talents release: off = 'false' */
  const http=require('http'), fakeHttp=Object.assign({},http,{createServer:()=>({listen(){},on(){},prependListener(){},close(){},address(){ return {port:0}; }})});
  const req=Module.createRequire(path.join(root,'server.js')), myReq=n=>n==='http'?fakeHttp:req(n), noop=()=>({unref(){},ref(){}}), log=console.log; console.log=()=>{};
  try{ const wrap=vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){'+fs.readFileSync(path.join(root,'server.js'),'utf8')+
      '\n;return {heroCardPower,snapshotHeroFromServer,campaignHeroSpec,ensureLedger,talentListFor,D_HERO_CUM,D_TROOP_CUM,getDB:()=>DB};})',{filename:'server.js'});
    const m={exports:{}}; return Object.assign(wrap(m.exports,myReq,m,path.join(root,'server.js'),root,noop,noop),{tmp});
  } finally{ console.log=log; delete process.env.TALENTS_ENABLED; } }
test('locked hero: a saved build reaches no learned list, spec, fight unit, card unit or power number; a wired hero\'s does',{skip:!LOCKED&&'every hero is wired'},()=>{
  const S=loadServerInProcess(true), J=JSON.stringify, strip=x=>JSON.parse(J(x)); let uid=0;
  try{ for(const [key,wired] of [[LOCKED,false],['vael',true]]){ const lv=60, b=statBuild(key,lv,30);
      assert.ok(Object.keys(FX.totals(key,T.learned(key,b))).length>0,key+': the build has stat talents (it would move the numbers)');
      const u={id:'tlock-'+(++uid),name:'TL'+uid,guest:true,created:Date.now(),roster:{}}; S.getDB().users[u.id]=u; S.ensureLedger(u);
      const led=u.led; led.px=S.D_TROOP_CUM[100]; led.unlocked=led.unlocked||{}; led.unlocked[key]=true; led.hero[key]={xp:S.D_HERO_CUM[lv],stars:5,pips:0,ref:0};
      const look=build=>{ if(build) led.talents={[key]:JSON.parse(J(build))}; else delete led.talents;
        return {list:S.talentListFor(led,key),spec:strip(S.campaignHeroSpec(u,key)),unit:strip(S.snapshotHeroFromServer(u,key)),card:strip(S.snapshotHeroFromServer(u,key,null,{noGlyphStats:true,noTempleEffects:true})),power:S.heroCardPower(u,key)}; };
      const none=look(null), got=look(b);
      if(!wired){ assert.equal(got.list,null,key+': no learned list'); assert.equal('talents' in got.spec,false,key+': no talents on the spec');
        assert.deepEqual(got.unit,none.unit,key+': the fight unit is the no-talent one'); assert.deepEqual(got.card,none.card,key+': and so is the card unit');
        assert.equal(got.power,none.power,key+': the power number is the no-talent one'); assert.deepEqual(led.talents[key],b,key+': the saved build is not deleted'); }
      else { assert.deepEqual(got.list,T.learned(key,b),key+': the learned list'); assert.deepEqual(got.spec.talents,T.learned(key,b),key+': on the spec');
        assert.notDeepEqual(got.unit,none.unit,key+': the stat talents change the fight unit'); assert.notEqual(got.power,none.power,key+': and the power number'); } }
  } finally{ try{ fs.rmSync(S.tmp,{recursive:true,force:true}); }catch(e){} }
});
