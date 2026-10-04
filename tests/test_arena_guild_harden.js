// 3 Oct 2026 Arena+Campaign and Guild audits (v974), real server on a free port + temp DB:
//  - /api/elite/resolve is retired (410), it paid fragments for a server-decided fight;
//  - a campaign sweep with the same hero five times pays that hero ONE share of hero XP;
//  - a raid input log of [null,null] is sanitised and replayed (it used to throw into the claim fallback);
//  - a raid fight that cannot be replayed books NOTHING: no boss damage, the attempt is kept, the client's number is ignored;
//  - contributing at max guild level is refused before any gold is taken;
//  - the Arena (daily claim + fight) is refused below player level 10, and nobody fights themselves.
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-agh-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; }   /* control: count every miss */, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'agh-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');
  const g2=await call('/api/guest',{deviceId:'agh2-'+Date.now()}); const oppId=g2.data.profile.id; await call('/api/ledger',null,g2.data.token);

  // Arena below level 10
  const dc1=await call('/api/arena/daily-claim',{requestId:'dc-l1'});
  ok(dc1.data.ok===false&&/level 10/.test(dc1.data.error||''),'arena daily claim refused at level 1 ('+(dc1.data.error||JSON.stringify(dc1.data).slice(0,80))+')');
  const ar1=await call('/api/arena/result',{oppId,won:true,requestId:'ar-l1'});
  ok(ar1.data.ok===false&&/level 10/.test(ar1.data.error||''),'arena fight refused at level 1 ('+(ar1.data.error||JSON.stringify(ar1.data).slice(0,80))+')');

  // Elite route retired
  const el=await call('/api/elite/resolve',{node:3,heroIds:['vael'],requestId:'el-1'});
  ok(el.status===410,'/api/elite/resolve answers 410 (got '+el.status+' '+JSON.stringify(el.data).slice(0,80)+')');

  // level 14, vael owned, stage 2 three-starred, a level-7 guild and a level-1 guild member
  await editDB((db,u)=>{ u.led.px=1000; u.led.unlocked.vael=true; u.led.hero.vael=u.led.hero.vael||{xp:0,stars:1,pips:0}; u.led.gold=5000; u.led.stam={v:999,t:Date.now()};
    u.led.camp=u.led.camp||{}; u.led.camp.cleared=5; u.led.camp.stars=Object.assign({},u.led.camp.stars,{2:3}); u.team=['vael'];
    db.guilds=db.guilds||{}; db.guilds.gmax={id:'gmax',name:'Max Guild',members:[id],level:7,exp:0}; u.guildId='gmax'; });

  // Arena at level 14
  const self=await call('/api/arena/result',{oppId:id,won:true,requestId:'ar-self'});
  ok(self.data.ok===false&&/Unknown opponent/.test(self.data.error||''),'fighting yourself is refused ('+(self.data.error||JSON.stringify(self.data).slice(0,80))+')');
  const ar2=await call('/api/arena/result',{oppId,won:true,requestId:'ar-l14'});
  ok(ar2.data.authoritative===true,'a level-14 arena fight against another player is resolved ('+JSON.stringify(ar2.data).slice(0,80)+')');
  const dc2=await call('/api/arena/daily-claim',{requestId:'dc-l14'});
  ok(dc2.data.ok===true,'arena daily claim pays at level 14 ('+(dc2.data.error||'ok')+')');

  // Contribute at max guild level
  const c0=await led(); const cm=await call('/api/guild/contribute',{});
  const c1=await led();
  ok(/max level/.test(cm.data.error||'')&&c1.gold===c0.gold,'contributing at max guild level is refused, no gold taken ('+(cm.data.error||JSON.stringify(cm.data).slice(0,80))+', gold '+c0.gold+' -> '+c1.gold+')');

  // Sweep: five copies of one hero earn one share
  const h0=(await led()).hero.vael.xp;
  const s1=await call('/api/campaign/sweep',{mode:'normal',node:2,times:1,heroIds:['vael'],requestId:'sw-1'});
  const h1=(await led()).hero.vael.xp;
  const s5=await call('/api/campaign/sweep',{mode:'normal',node:2,times:1,heroIds:['vael','vael','vael','vael','vael'],requestId:'sw-5'});
  const h2=(await led()).hero.vael.xp;
  ok(s1.data.ok===true&&s5.data.ok===true&&h1-h0>0,'both sweeps run ('+(s1.data.error||s5.data.error||'ok')+')');
  ok(h2-h1===h1-h0,'five copies of Vael earn the same hero XP as one ('+(h1-h0)+' vs '+(h2-h1)+')');

  // Raid: a level-1 guild
  await editDB((db,u)=>{ db.guilds.graid={id:'graid',name:'Raid Guild',members:[id],level:1,exp:0}; u.guildId='graid'; });
  const rs=await call('/api/guild/raid/start',{heroIds:['vael'],requestId:'rs-1'});
  ok(rs.data.ok===true&&rs.data.attemptId,'raid fight starts ('+(rs.data.error||'ok')+')');
  const rr=await call('/api/guild/raid/resolve',{attemptId:rs.data.attemptId,inputLog:[null,null],dmg:999999999,requestId:'rr-1'});
  ok(rr.data.ok===true&&!rr.data.incident&&rr.data.dmg<999999999,'a [null,null] log is sanitised and replayed, not a claim ('+JSON.stringify({ok:rr.data.ok,dmg:rr.data.dmg,incident:rr.data.incident,err:rr.data.error})+')');
  const rs2=await call('/api/guild/raid/start',{heroIds:['vael'],requestId:'rs-2'});
  await editDB((db)=>{ db.guilds.graid.raid.att[id].snaps=null; });
  const hp0=disk().guilds.graid.raid.hp;
  const rr2=await call('/api/guild/raid/resolve',{attemptId:rs2.data.attemptId,inputLog:[],dmg:999999999,requestId:'rr-2'});
  ok(rr2.data.ok===false&&rr2.data.unverified===true,'a fight that cannot be replayed is refused ('+JSON.stringify({ok:rr2.data.ok,dmg:rr2.data.dmg,incident:rr2.data.incident,err:rr2.data.error})+')');
  ok(rr2.data.raid&&rr2.data.raid.hp===hp0,'the boss takes no damage from the refused fight');
  await delay(400); await stop(); const att=disk().guilds.graid.raid.att||{}; await start();
  ok(att[id]&&att[id].id===rs2.data.attemptId,'the refused fight\'s attempt is kept');
  // v979 (Guild audit #3): the contribute screen shows the server's one offer, and the reply brings the spent gold back
  const srcS=fs.readFileSync(path.join(root,srvFile),'utf8'), srcC=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  const gcm=srcC.match(/const GUILD_CONTRIB=\{gold:(\d+), exp:(\d+)\}/), sg=srcS.match(/const GUILD_CONTRIB_GOLD=(\d+)/), se=srcS.match(/GUILD_CONTRIB_EXP=(\d+)/);
  ok(gcm&&sg&&se&&+gcm[1]===+sg[1]&&+gcm[2]===+se[1],'the page offers what the server charges and grants ('+(gcm?gcm[1]+'/'+gcm[2]:'no GUILD_CONTRIB')+' vs '+(sg&&sg[1])+'/'+(se&&se[1])+')');
  const k0=await led(); const kc=await call('/api/guild/contribute',{});
  ok(kc.data.guild&&kc.data.ledger&&kc.data.ledger.gold===k0.gold-200,'a contribution reply carries the ledger with 200 gold gone ('+(kc.data.error||(kc.data.ledger?k0.gold+' -> '+kc.data.ledger.gold:'no ledger'))+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_arena_guild_harden.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
