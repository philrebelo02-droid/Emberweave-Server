// v1240 (Phil 31 Oct 2026: "im not in a guild anymore, i should instantly not own this"): only a guild holds a city, oasis or the
// World Tree. Leaving or being removed from the guild sends that player's garrison lines home (the guild keeps the site); a guild
// that disbands (or whose last member leaves) loses its sites; a v1235 player holder in no guild loses the site on the next World
// Map read. Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server copied into the repo root> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gs1240-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100'},stdio:'ignore'});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; await delay(300); }
async function call(route,data,tok){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
const now=Date.now();
const line=(uid,name,mid)=>({marchId:mid,uid,name,heroIds:['vael'],snaps:[],power:100,arriveAt:now-60000,since:now-120000});
const march=mid=>({id:mid,kind:'garrison',siteId:'city-oriel',siteName:'Oriel',station:'city-oriel',heroIds:['vael'],depart:now-120000,arriveAt:now-60000,
  homeAt:now+86400000,resolved:false,target:{x:400,y:240},route:null});
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const reg=n=>call('/api/register',{name:n,pass:'password1'}).then(r=>r.data);
  const L=await reg('gsLead'), A=await reg('gsAnna'), B=await reg('gsBram'), C=await reg('gsCole'), S=await reg('gsSolo');
  const id=x=>x.profile.id;
  await delay(400); await stop();
  { const db=disk(); db.guilds=db.guilds||{};
    db.guilds.g1={id:'g1',name:'Ash Wardens',leader:id(L),members:[id(L),id(A),id(B)],log:[]};
    db.guilds.g2={id:'g2',name:'Cole Alone',leader:id(C),members:[id(C)],log:[]};
    for(const [u,g] of [[L,'g1'],[A,'g1'],[B,'g1'],[C,'g2']]) db.users[id(u)].guildId=g;
    db.users[id(A)].worldCityMarches=[march('mA')]; db.users[id(B)].worldCityMarches=[march('mB')];
    db.worldSieges={version:1,rev:1,sites:{
      'city-oriel':{type:'guild',id:'g1',name:'Ash Wardens',since:now-3600000,protectedUntil:0,by:id(A),byName:'gsAnna',marchId:'mA',garrison:[line(id(A),'gsAnna','mA'),line(id(B),'gsBram','mB')]},
      'city-durrakh':{type:'guild',id:'g2',name:'Cole Alone',since:now-3600000,protectedUntil:0,by:id(C),byName:'gsCole',marchId:'x',garrison:[]},
      'city-hallowrime':{type:'player',id:id(S),name:'gsSolo',since:now-3600000,protectedUntil:0,by:id(S),byName:'gsSolo',marchId:'y',garrison:[]}}};
    fs.writeFileSync(dbFile,JSON.stringify(db)); }
  await start();
  const tok=async u=>(await call('/api/login',{name:u.profile.name,pass:'password1'})).data.token;
  const TA=await tok(A), TL=await tok(L), TC=await tok(C), TS=await tok(S);
  // ---- a member leaves: their line goes home, the guild keeps the site ----
  let r=await call('/api/guild/leave',{},TA);
  ok(r.status===200,'Anna leaves the guild ('+r.status+')');
  await delay(600); await stop();
  let db=disk(), h=db.worldSieges.sites['city-oriel'];
  ok(h&&h.type==='guild'&&h.id==='g1','the guild still holds Oriel after one member leaves');
  ok(h&&h.garrison.length===1&&h.garrison[0].uid===id(B),'only the leaver\'s line left the garrison (Bram\'s stays)');
  const mA=(db.users[id(A)].worldCityMarches||[]).find(m=>m.id==='mA');
  ok(mA&&mA.recall&&mA.resolved===true&&mA.homeAt>now,'the leaver\'s garrison march is on its way home');
  ok(!(db.users[id(B)].worldCityMarches||[]).find(m=>m.id==='mB').recall,'the staying member\'s march is untouched');
  await start();
  // ---- the last member leaves: the guild is gone and so is its site ----
  r=await call('/api/guild/leave',{},TC);
  ok(r.status===200&&r.data.disbanded===true,'Cole leaves his one-man guild, which disbands');
  // ---- the leader removes a member: that member's line goes home ----
  r=await call('/api/guild/kick',{id:id(B)},TL);
  ok(r.status===200,'the leader removes Bram ('+r.status+')');
  // ---- a v1235 player holder in no guild: the site goes on the next World Map read ----
  r=await call('/api/world/state',null,TS);
  await delay(600); await stop();
  db=disk(); h=db.worldSieges.sites;
  ok(!h['city-durrakh'],'a disbanded guild\'s site is released (Durrakh)');
  ok(h['city-oriel']&&h['city-oriel'].garrison.length===0,'the removed member\'s line left the garrison');
  ok((db.users[id(B)].worldCityMarches||[]).find(m=>m.id==='mB').recall,'the removed member\'s march is on its way home');
  ok(!h['city-hallowrime'],'a player holder in no guild loses the site on the World Map read (Hallowrime)');
  ok(db.worldSieges.rev>1,'the holder table revision moved');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_guild_sites_1240.js: '+pass+' checks passed, '+missed.length+' failed');
}catch(e){ console.error('FAIL',e&&e.stack||e); process.exitCode=1; } finally{ await stop(); try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(_){} } })();
