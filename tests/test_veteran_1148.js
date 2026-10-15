// v1148 (Phil 15 Oct 2026: "All normal/ elite/ veteran should go from 1-16" / "Elite and veteran are 50% and 100% scaling of normal").
// Veteran is generated from Normal (scripts/author_veteran_1148.js): 160 stages, each = the matching Normal stage with every enemy's
// hpMul and dmgMul x2; rewards one step above Elite (gold Elite x1.6, glyph one band above Elite, two per run); chapter c opens after
// Elite c-10; every stage is capped 3/day and costs 12 stamina, like Elite.
// Three parts, all asserting (non-zero exit):
//   1. DATA  - the table itself, with a control (a 1.9x copy must fail the 2x check).
//   2. ENGINE - Veteran 1-1, 10-10 and 16-10 fought in the real engine (server/sim-host.js) against Normal with the same squad.
//   3. ROUTES - a real server on a free port: gates, start/resolve on 1-1, 10-10, 16-10, sweep + daily cap on every stage.
// Control for part 3: AUD_SERVER=<pre-v1148 server.js copied into the repo root> must FAIL.
// v1149 (Phil 15 Oct: "Veteran should give hero fragments yes"): Veteran pays the hero fragment of Elite's reward hero on the same 64 stages
// (x-1/4/7/10), x2 Elite's count (first clear 4-8, a repeat run 2), under the same 3-a-day cap. Part 4 is a built-in control: the v1148
// live server (git e94e80a4) on the same data pays NO Veteran hero fragments.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js';
let pass=0; const missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); console.log('  x '+m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const load=f=>JSON.parse(fs.readFileSync(path.join(root,'server',f),'utf8'));
const N=load('campaign-encounters.json'), E=load('elite-campaign-encounters.json'), V=load('veteran-campaign-encounters.json');
const LADDER=['Grey','Green','Green +1','Blue','Blue +1','Blue +2','Purple','Purple +1','Purple +2','Purple +3','Gold','Gold +1','Gold +2','Gold +3','Gold +4','Orange'];
const band=k=>LADDER.indexOf(k.slice(0,k.lastIndexOf(' ')));
const bandOf=s=>Math.max(...s.rewards.glyphFragments.map(f=>band(f.key)));

/* ---------------- 1. DATA ---------------- */
console.log('== v1148 Veteran 1-16 = Normal x2: data ==');
const isTwoX=(vet)=>vet.length===160 && vet.every((v,i)=>{ const n=N[i]; return v.id===n.id && v.node===n.node && v.checkpoint===n.checkpoint
  && v.waves.length===n.waves.length && v.waves.every((w,wi)=>w.length===n.waves[wi].length && w.every((u,ui)=>{ const m=n.waves[wi][ui];
    return (u.key===m.key || (u.rewardHero && u.key===v.rewardHero)) && u.lvl===m.lvl && !!u.boss===!!m.boss && Math.abs(u.hpMul/(m.hpMul*2)-1)<1e-3 && Math.abs(u.dmgMul/(m.dmgMul*2)-1)<1e-3; })); });
ok(V.length===160 && V[0].id==='1-1' && V[159].id==='16-10','Veteran has 160 stages, 1-1 to 16-10 ('+V.length+')');
ok(isTwoX(V),'every Veteran stage = the matching Normal stage, same units/levels/bosses, hp x2 AND dmg x2');
{ const ctl=JSON.parse(JSON.stringify(V)); ctl[57].waves[1][0].dmgMul=+(N[57].waves[1][0].dmgMul*1.9).toFixed(4);
  ok(!isTwoX(ctl),'control: a copy with one 6-8 enemy at 1.9x dmg FAILS the 2x check'); }
const st=x=>x.waves.reduce((t,w)=>t+w.reduce((a,u)=>a+Math.sqrt(u.hpMul*u.dmgMul)*(1+0.05*u.lvl),0),0);
ok(V.every((v,i)=>Math.abs(st(v)/st(N[i])-2)<0.01),'on the test_farm_map strength measure every Veteran stage is 2.0x Normal (Elite is 1.5x)');
ok(V[9].waves.every((w,wi)=>w.every((u,ui)=>Math.abs(u.dmgMul-N[9].waves[wi][ui].dmgMul*2)<1e-3)) && V[9].waves[0][0].dmgMul===+(N[9].waves[0][0].dmgMul*2).toFixed(4),
  'Veteran 1-10 dmg = Normal 1-10 x2, so it carries the v1143 x0.85 cut (Normal '+N[9].waves[0][0].dmgMul+' -> Veteran '+V[9].waves[0][0].dmgMul+')');
ok(V.every((v,i)=>Math.abs(v.recommendedPower-N[i].recommendedPower*2)<=1),'recommendedPower = Normal x2 on every stage');
ok(V.every(v=>v.mode==='veteran'&&v.portalMode==='veteran'&&v.farmFragment===v.rewards.glyphFragments[0].fragmentId),'mode / portalMode / farmFragment on every stage');
ok(V.every(v=>v.rewards.glyphFragments.length===1&&v.rewards.glyphFragments[0].quantity===2),'every Veteran stage pays two of one named Glyph Fragment (Elite rule)');
ok(V.every(v=>v.recommendedQuality===LADDER[bandOf(v)]&&v.targetLevel===v.qualityMinHeroLevel),'recommendedQuality = the paid band, targetLevel = its min hero level (Elite rule)');
ok(V.every((v,i)=>v.bossLevelGate===N[i].bossLevelGate),'bossLevelGate follows Normal (as Elite does)');
ok(V.filter(v=>v.rewardHero).length===64 && V.every((v,i)=>(v.rewardHero||null)===(E[i].rewardHero||null)),'v1149: Veteran names a reward hero on exactly the 64 stages Elite does, the same hero ('+V.filter(v=>v.rewardHero).length+')');
ok(V.filter(v=>v.rewardHero).every(v=>[1,4,7,0].includes(v.node%10)),'v1149: Veteran hero stages are x-1/4/7/10, as Elite');
{ const eliteHeroes=new Set(E.filter(e=>e.rewardHero).map(e=>e.rewardHero));
  ok(V.filter(v=>v.rewardHero).every(v=>eliteHeroes.has(v.rewardHero)),'v1149: Veteran pays only heroes Elite already pays ('+[...eliteHeroes].join(', ')+') - no shop, arena or mythical heroes'); }
ok(V.every(v=>{ const tagged=v.waves.flat().filter(u=>u.rewardHero); return v.rewardHero ? (tagged.length===1&&tagged[0].key===v.rewardHero&&tagged[0].isHero&&!tagged[0].boss&&v.waves[v.waves.length-1].includes(tagged[0])) : tagged.length===0; }),
  'v1149: each hero stage fights its reward hero once, in the final wave, never as the boss; other stages tag no unit');
/* reward ordering Normal < Elite < Veteran */
ok(V.every((v,i)=>N[i].rewards.firstGold<E[i].rewards.firstGold&&E[i].rewards.firstGold<v.rewards.firstGold
  && N[i].rewards.repeatGold<E[i].rewards.repeatGold&&E[i].rewards.repeatGold<v.rewards.repeatGold),'gold: Normal < Elite < Veteran on every stage (first and repeat)');
ok(V.every((v,i)=>Math.abs(v.rewards.firstGold-E[i].rewards.firstGold*1.6)<=1&&Math.abs(v.rewards.repeatGold-E[i].rewards.repeatGold*1.6)<=1),'gold: Veteran = Elite x1.6, as Elite = Normal x1.6');
ok(V.every((v,i)=>bandOf(N[i])<=bandOf(E[i])&&bandOf(E[i])<=bandOf(v)&&(bandOf(E[i])===15||bandOf(v)===bandOf(E[i])+1)),
  'glyph band: Normal <= Elite <= Veteran, Veteran exactly one band above Elite until Orange caps it');
ok(V.filter((v,i)=>bandOf(v)>bandOf(E[i])).length>=135,'Veteran pays a strictly higher band than Elite on '+V.filter((v,i)=>bandOf(v)>bandOf(E[i])).length+'/160 stages (the rest are Orange = Orange)');
ok(V.every((v,i)=>v.rewards.playerXpFirst>=E[i].rewards.playerXpFirst&&E[i].rewards.playerXpFirst>=N[i].rewards.playerXpFirst
  && v.rewards.heroXpFirst>=E[i].rewards.heroXpFirst),'XP: Normal <= Elite <= Veteran (Veteran = Elite: same 12-stamina cost)');
ok(new Set(V.filter(v=>v.rewards.glyphFragments[0].key.startsWith('Orange ')).map(v=>v.rewards.glyphFragments[0].key)).size===18,'all 18 Orange families have a Veteran source');
/* client map: Veteran boss = Normal boss = CHAPTER_MAP_BOSS_KEYS */
const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
const bossKeys=eval(html.match(/const CHAPTER_MAP_BOSS_KEYS=(\[[^\]]*\])/)[1]);
ok(V.filter(v=>v.node%10===0).every(v=>{ const b=v.waves[v.waves.length-1].find(u=>u.boss); return b&&b.key===bossKeys[v.node/10]; }),
  'every Veteran x-10 boss is the boss the campaign map draws (CHAPTER_MAP_BOSS_KEYS, 1-10 = '+bossKeys[1]+')');
ok(!/CHAPTER_VETERAN_BOSS_KEYS\s*[=\[]/.test(html.replace(/\/\*[\s\S]*?\*\//g,'')),'the client no longer reads a separate Veteran boss table');
ok(/veteran:\{label:'Veteran', stages:160/.test(html),'the client portal meta says Veteran has 160 stages');
ok(!/'veteran'\?10:/.test(html),'no client path pins Veteran to chapter 10');
{ const srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
  ok(/const PORTAL_HERO_FRAG_MUL=\{normal:1, elite:1, veteran:2\}/.test(html) && /PORTAL_HERO_FRAG_MUL=Object\.freeze\(\{normal:1, elite:1, veteran:2\}\)/.test(srv),
    'v1149: the stage card and the server agree - Veteran pays x2 hero fragments (card shows x4-8)');
  ok(/portalHardMode\(mode\)&&stg&&stg\.rewardHero/.test(html),'v1149: the stage card shows the reward hero chip on Veteran like Elite'); }

/* ---------------- 2. ENGINE ---------------- */
console.log('== v1148: Veteran 1-1, 10-10, 16-10 in the real engine ==');
const host=require(path.join(root,'server','sim-host.js')).load(path.join(root,'emberweave-heroes.html'));
/* v1149: a plain 1-star trio whose flat stats scale by k in sqrt(2) steps - the 5-star line used in v1148 beat 1-1 at any k once Tick
   took a slot, so "harder" could not be seen there. The weakest k that wins measures the stage. */
const squad=['vael','sylthaine','vireo'];
const mk=(lvl,k)=>host.snapFromSpecs(squad.map(key=>({key,level:lvl,stars:1,pips:0,ref:0,glyphRank:0,
  tt:{hp:100*k,atk:10*k,armor:5*k,mr:5*k},ex:{},fAtk:10*k,fHp:100*k,fApow:0,apMul:1,skillLv:[1,1,1,1]})));
const minK=(stage,lvl)=>{ for(let e=0;e<=44;e++){ const k=+Math.pow(2,e/2).toFixed(3), r=host.campaign(mk(lvl,k),stage.waves,4242,[]); if(r.won) return {k,r}; } return null; };
for(const i of [0,99,159]){ const lvl=Math.max(1,N[i].targetLevel|0);
  const a=minK(N[i],lvl), b=minK(V[i],lvl);
  ok(!!a&&!!b,'Veteran '+V[i].id+' is winnable in the engine (Normal needs squad x'+(a&&a.k)+', Veteran x'+(b&&b.k)+')');
  if(a&&b){ const same=host.campaign(mk(lvl,a.k),V[i].waves,4242,[]);
    ok(b.k>a.k || (same.hpFrac<a.r.hpFrac),'Veteran '+V[i].id+' is harder than Normal with the same squad (Normal at x'+a.k+': won hp '+a.r.hpFrac.toFixed(2)
      +'; Veteran: '+(same.won?'won hp '+same.hpFrac.toFixed(2):'lost')+')');
    ok(typeof same.digest==='string'&&same.digest.length>0,'the engine returns a replay digest for Veteran '+V[i].id); } }

/* ---------------- 3. ROUTES ---------------- */
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-vt1148-')), dbFile=path.join(dir,'db.json');
let port,base,child,token,id;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDBWith(file,fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db));
  child=spawn(process.execPath,[file],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
let rq=0; const R=()=>'v1148-'+(rq++);
(async()=>{ try{
  console.log('== v1148: Veteran routes on a real server ('+srvFile+') ==');
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'vt1148-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const P=(await call('/api/portals')).data, pv=(P.modes||[]).find(m=>m.mode==='veteran')||{};
  ok(pv.stages===160&&(pv.map||[]).length===160,'/api/portals serves 160 Veteran stages ('+pv.stages+')');
  ok(/Elite 1-10/.test(pv.locked||''),'a new account sees Veteran locked until Elite 1-10 ('+pv.locked+')');
  /* Normal done, Elite chapter 1 done: Veteran chapter 1 opens, chapter 2 does not */
  await editDB(u=>{ u.led.px=99000000; u.led.camp.cleared=160; u.led.stam={v:999,t:Date.now()};
    u.led.portals=u.led.portals||{}; u.led.portals.elite={cleared:10,stars:{},att:null,runs:{}}; u.led.portals.veteran={cleared:0,stars:{},att:null,runs:{}}; });
  const team=Object.keys((await call('/api/ledger')).data.ledger?.unlocked||(await call('/api/ledger')).data.unlocked||{}).slice(0,3);
  const heroIds=team.length?team:['vex'];
  let s=(await call('/api/campaign/start',{mode:'veteran',node:1,heroIds,requestId:R()})).data;
  ok(s.ok===true&&s.stage&&s.stage.id==='1-1'&&s.stage.mode==='veteran','after Elite 1-10, Veteran 1-1 starts ('+(s.error||s.stage&&s.stage.id)+')');
  ok(JSON.stringify(s.stage.waves)===JSON.stringify(V[0].waves),'the started session fights the authored Veteran 1-1 waves');
  const stam0=s.stamina&&s.stamina.v;
  /* resolve it through the real engine with the server's own snapshots */
  const rep=host.campaign(s.snaps,s.stage.waves,s.seed>>>0,[]);
  const rs=(await call('/api/campaign/resolve',{attemptId:s.attemptId,requestId:R(),inputLog:[],digest:rep.digest,won:!!rep.won,stars:rep.won?(rep.stars|0):0})).data;
  ok(rs.ok===true,'Veteran 1-1 resolves on the server replay ('+(rs.error||('won '+rs.won))+')');
  ok(999-(stam0|0)===12,'a Veteran start costs 12 stamina like Elite ('+(999-(stam0|0))+')');
  const c11=(await call('/api/campaign/stage?mode=veteran&node=11')).data;
  ok(/Elite 2-10/.test(c11.locked||''),'Veteran 2-1 stays locked until Elite 2-10 ('+c11.locked+')');
  /* Elite fully cleared: 10-10 and 16-10 start and resolve */
  await editDB(u=>{ u.led.stam={v:999,t:Date.now()}; u.led.portals.elite.cleared=160; u.led.portals.veteran.cleared=159; });
  for(const node of [100,160]){ const x=(await call('/api/campaign/start',{mode:'veteran',node,heroIds,requestId:R()})).data;
    ok(x.ok===true&&x.stage&&x.stage.id===V[node-1].id,'Veteran '+V[node-1].id+' starts ('+(x.error||x.stage&&x.stage.id)+')');
    if(x.ok){ const r=host.campaign(x.snaps,x.stage.waves,x.seed>>>0,[]);
      const y=(await call('/api/campaign/resolve',{attemptId:x.attemptId,requestId:R(),inputLog:[],digest:r.digest,won:!!r.won,stars:r.won?(r.stars|0):0})).data;
      ok(y.ok===true,'Veteran '+V[node-1].id+' resolves (an unlevelled squad '+(y.won?'won':'lost')+')'); } }
  /* sweep + daily cap on an ORDINARY stage (Veteran 4-2), like every Elite stage */
  await editDB(u=>{ u.led.stam={v:999,t:Date.now()}; u.led.portals.veteran.cleared=160; u.led.portals.veteran.stars={32:3}; u.led.portals.veteran.runs={}; });
  const sw=[]; for(let i=0;i<4;i++) sw.push((await call('/api/campaign/sweep',{mode:'veteran',node:32,times:1,requestId:R()})).data);
  ok(sw.slice(0,3).every(x=>x.ok===true),'the first 3 sweeps of Veteran 4-2 pay ('+sw.slice(0,3).map(x=>x.ok?'ok':x.error).join(', ')+')');
  ok(sw[3].ok===false&&/Daily limit/.test(sw[3].error||''),'the 4th sweep of Veteran 4-2 is refused - every Veteran stage is capped like Elite ('+(sw[3].error||'paid')+')');
  const gf=sw[0].glyphFragments||[];
  ok(gf.length===1&&gf[0].key===V[31].rewards.glyphFragments[0].key&&(gf[0].quantity|0)===2,'a Veteran sweep pays its farm fragment x2 ('+JSON.stringify(gf)+')');
  ok(sw[0].gold===V[31].rewards.repeatGold,'a Veteran sweep pays the authored repeat gold ('+sw[0].gold+' / '+V[31].rewards.repeatGold+')');
  const card=(await call('/api/campaign/stage?mode=veteran&node=32')).data;
  ok(card.runsLeft===0,'the stage card shows 0 runs left on Veteran 4-2 ('+card.runsLeft+')');
  /* ---- v1149: hero fragments ---- */
  const fragsOf=async k=>{ const l=(await call('/api/ledger')).data; return ((l.ledger||l).frags||{})[k]|0; };
  const hs=V[33];   // Veteran 4-4, Elite's reward hero
  await editDB(u=>{ u.led.stam={v:999,t:Date.now()}; u.led.portals.veteran.stars={34:3}; u.led.portals.veteran.runs={}; u.led.portals.elite.stars={34:3}; u.led.portals.elite.runs={}; });
  const f0=await fragsOf(hs.rewardHero);
  const vs=[]; for(let i=0;i<4;i++) vs.push((await call('/api/campaign/sweep',{mode:'veteran',node:34,times:1,requestId:R()})).data);
  const es=(await call('/api/campaign/sweep',{mode:'elite',node:34,times:1,requestId:R()})).data;
  ok(vs.slice(0,3).every(x=>x.ok&&x.eliteFrag&&x.eliteFrag.heroKey===hs.rewardHero&&x.eliteFrag.qty===2),'v1149: each Veteran '+hs.id+' sweep pays 2 '+hs.rewardHero+' fragments ('+vs.slice(0,3).map(x=>JSON.stringify(x.eliteFrag||x.error)).join(' ')+')');
  ok(es.ok&&es.eliteFrag&&es.eliteFrag.heroKey===hs.rewardHero&&vs[0].eliteFrag&&vs[0].eliteFrag.qty>=es.eliteFrag.qty,'v1149: Veteran pays at least Elite for the same stage and hero (Elite '+JSON.stringify(es.eliteFrag||es.error)+')');
  ok(vs[3].ok===false&&/Daily limit/.test(vs[3].error||'')&&!vs[3].eliteFrag,'v1149: the 4th Veteran sweep is refused and pays no hero fragments - the cap holds ('+(vs[3].error||'paid')+')');
  ok((await fragsOf(hs.rewardHero))-f0===6+(es.eliteFrag?es.eliteFrag.qty:0),'v1149: the ledger gained exactly 3x2 Veteran + the Elite sweep ('+((await fragsOf(hs.rewardHero))-f0)+')');
  const ns=V.find(v=>!v.rewardHero&&v.node%10===2);   // x-2: no hero
  await editDB(u=>{ u.led.stam={v:999,t:Date.now()}; u.led.portals.veteran.stars={[ns.node]:3}; u.led.portals.veteran.runs={}; });
  const nsw=(await call('/api/campaign/sweep',{mode:'veteran',node:ns.node,times:1,requestId:R()})).data;
  ok(nsw.ok===true&&!nsw.eliteFrag,'v1149: a Veteran stage with no reward hero ('+ns.id+') pays no hero fragments');
  /* first clear: Veteran 1-1 (Tick) with the server's own replay - pays the 2-4 roll x2 */
  await editDB(u=>{ u.led.stam={v:999,t:Date.now()}; u.led.portals.veteran={cleared:0,stars:{},att:null,runs:{}};
    for(const k of heroIds){ u.led.hero[k]=Object.assign(u.led.hero[k]||{},{xp:99000000,stars:5,pips:0}); } });   // a levelled squad, so 1-1 is won
  const fs1=(await call('/api/campaign/start',{mode:'veteran',node:1,heroIds,requestId:R()})).data;
  const fr=host.campaign(fs1.snaps,fs1.stage.waves,fs1.seed>>>0,[]);
  const fc=(await call('/api/campaign/resolve',{attemptId:fs1.attemptId,requestId:R(),inputLog:[],digest:fr.digest,won:!!fr.won,stars:fr.won?(fr.stars|0):0})).data;
  if(fr.won) ok(fc.reward&&fc.reward.eliteFrag&&fc.reward.eliteFrag.heroKey==='tick'&&fc.reward.eliteFrag.qty>=4&&fc.reward.eliteFrag.qty<=8,
    'v1149: a Veteran 1-1 first clear pays 4-8 Tick fragments (Elite 2-4) ('+JSON.stringify(fc.reward&&fc.reward.eliteFrag)+')');
  else ok(false,'v1149: the levelled squad should win Veteran 1-1 (heroes '+heroIds.join(',')+')');
  const card34=(await call('/api/campaign/stage?mode=veteran&node=34')).data;
  ok(card34.stage&&card34.stage.rewardHero===hs.rewardHero,'v1149: the stage card is served the reward hero ('+(card34.stage&&card34.stage.rewardHero)+')');
  await stop();
  /* ---- v1149 control: the v1148 live server (e94e80a4) on the same data pays no Veteran hero fragments ---- */
  if(!process.env.AUD_SERVER){ const ctlFile='.ctl_v1148_server_'+process.pid+'.js';
    try{ fs.writeFileSync(path.join(root,ctlFile), require('child_process').execFileSync('git',['show','e94e80a46b83d9882c2e6cc41f140939cd8c2c09:server.js'],{cwd:root,maxBuffer:64<<20}));
      const keep=srvFile; child=spawn(process.execPath,[ctlFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',ADMIN_IDS:''},stdio:'ignore',windowsHide:true});
      for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)break; }catch(_){} await delay(100); }
      await editDBWith(ctlFile,u=>{ u.led.stam={v:999,t:Date.now()}; u.led.portals.veteran={cleared:160,stars:{34:3},att:null,runs:{}}; });
      const cs=(await call('/api/campaign/sweep',{mode:'veteran',node:34,times:1,requestId:R()})).data;
      ok(cs.ok===true&&!cs.eliteFrag,'control: the v1148 server (e94e80a4) sweeps Veteran '+hs.id+' and pays NO hero fragments ('+JSON.stringify(cs.eliteFrag||cs.error||null)+')');
    } finally { await stop(); try{ fs.unlinkSync(path.join(root,ctlFile)); }catch(_){} } }
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_veteran_1148.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
