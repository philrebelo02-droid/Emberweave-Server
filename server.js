/* ===========================================================================
   Emberweave Heroes — cloud game server (v0.8)
   Serves the PWA and provides accounts + Arena ladder + city world API.
   Pulls the game from GAME_URL (Netlify) so this repo can stay tiny.
   =========================================================================== */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const GAME_FILE = path.join(__dirname, 'emberweave-heroes.html');
const DB_FILE   = process.env.DB_FILE || path.join(__dirname, 'emberweave-db.json');
const GAME_URL  = (process.env.GAME_URL || 'https://sunny-biscotti-e5128b.netlify.app').replace(/\/+$/,'');
const _rcache={}, RCACHE_TTL=60000;   // re-fetch from GAME_URL at most once a minute so Netlify updates propagate
async function remoteAsset(urlPath){ const c=_rcache[urlPath]; if(c && Date.now()-c.t < RCACHE_TTL) return c;
  try{ const r=await fetch(GAME_URL+urlPath); if(!r.ok) return c||null; const buf=Buffer.from(await r.arrayBuffer()); _rcache[urlPath]={buf,ct:r.headers.get('content-type')||'application/octet-stream',t:Date.now()}; return _rcache[urlPath]; }catch(e){ return c||null; } }

/* ------------------------------- storage ---------------------------------- */
let DB = { users:{}, byName:{}, tokens:{}, seeded:false };
function readDB(){ try{ DB = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }catch(e){ DB={users:{},byName:{},tokens:{},seeded:false}; } }
let saveTimer=null;
function writeDB(){ if(saveTimer)return; saveTimer=setTimeout(()=>{ saveTimer=null; try{ fs.writeFileSync(DB_FILE, JSON.stringify(DB)); }catch(e){} },200); }

/* ------------------------------- helpers ---------------------------------- */
function uid(){ return crypto.randomBytes(8).toString('hex'); }
function hashPass(pass, salt){ return crypto.pbkdf2Sync(pass, salt, 60000, 32, 'sha256').toString('hex'); }
function send(res, code, obj){ const b=JSON.stringify(obj); res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-token'}); res.end(b); }
function body(req){ return new Promise(r=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{r(JSON.parse(d||'{}'));}catch(e){r({});} }); }); }
function authUser(req){ const t=req.headers['x-token']; if(!t)return null; const id=DB.tokens[t]; return id?DB.users[id]:null; }
function pub(u){ return { id:u.id, name:u.name, rank:u.rank, coins:u.coins, team:u.team, roster:u.roster, wall:u.wall, isNpc:!!u.isNpc }; }
function profileFor(u){ return { id:u.id, name:u.name, rank:u.rank, coins:u.coins, team:u.team, roster:u.roster, wall:u.wall, lastDaily:u.lastDaily||0 }; }

const HERO_KEYS=['aldric','thorne','grohm','vex','sylva','rook','zephyr','lumi','aria'];
function defaultTeam(){ return [ {key:'aldric',level:1,rank:0},{key:'sylva',level:1,rank:0},{key:'zephyr',level:1,rank:0},{key:'lumi',level:1,rank:0},{key:'vex',level:1,rank:0} ]; }

/* --------------------------- NPC / world seeding -------------------------- */
const NPC_NAMES=['Ironhold','Stormgate','Ashvale','Highcliff','Duskmere','Ravenspire','Frostholm','Emberton','Wolfden','Goldreach','Thornwick','Mistfall','Grimwater','Sunspear','Blackmoor','Oakenshield','Redkeep','Silverbrook','Winterfell','Stonehaven','Bramblewood','Nightvale','Dawnkeep','Shadowfen','Windmere','Coldharbor','Firebrand','Greymarch','Hollowreach','Larkspur','Direhold','Kingsmoor','Valebright','Ashenford','Cragmaw','Elmsworth','Ferncove','Galesrest','Hearthglen','Ivywatch'];
function randTeam(power){ const t=[]; const pool=HERO_KEYS.slice(); for(let i=0;i<5;i++){ const key=pool[(i*3+power)%pool.length]; t.push({key,level:1+Math.floor(power*0.6+Math.random()*power*0.4),rank:Math.min(3,Math.floor(power/6))}); } return t; }
function seed(){
  if(DB.seeded) return;
  NPC_NAMES.forEach((name,i)=>{
    const id='npc_'+i;
    const rank = Math.max(1, Math.round(5000 - i*(5000/NPC_NAMES.length) + (Math.random()*80-40)));
    const power = Math.max(1, Math.round(20 - (rank/5000)*18));
    DB.users[id]={ id, name, isNpc:true, rank, coins:0, team:randTeam(power), wall:randTeam(power),
      roster:{}, cityX:Math.round(Math.random()*1000), cityY:Math.round(Math.random()*1000), created:0 };
  });
  DB.seeded=true; writeDB();
}

/* ------------------------------ ladder logic ------------------------------ */
function allUsersByRank(){ return Object.values(DB.users).sort((a,b)=>a.rank-b.rank); }
function pickOpponent(me){
  const pool=Object.values(DB.users).filter(u=>u.id!==me.id);
  const above=pool.filter(u=>u.rank<me.rank).sort((a,b)=>b.rank-a.rank);
  const cand = above.length? above.slice(0, Math.min(8,above.length)) : pool;
  return cand[Math.floor(Math.random()*cand.length)] || pool[0];
}
function applyResult(me, opp, won){
  const before=me.rank;
  if(won){
    if(opp && opp.rank < me.rank){ const taken=opp.rank; opp.rank=Math.min(taken+1, before); me.rank=taken; }
    else { me.rank=Math.max(1, me.rank - (2+Math.floor(Math.random()*4))); }
  } else { me.rank = me.rank + (2+Math.floor(Math.random()*4)); }
  me.rank=Math.max(1,me.rank);
  return { rank:me.rank, delta:before-me.rank };
}
function dailyAmount(rank){ if(rank<=1)return 1000; if(rank<=10)return 600; if(rank<=100)return 350; if(rank<=1000)return 180; return 60; }

/* --------------------------------- routes --------------------------------- */
async function api(req,res,url){
  const p=url.pathname;
  if(req.method==='OPTIONS'){ res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-token'}); res.end(); return; }

  if(p==='/api/register' && req.method==='POST'){ const b=await body(req); const name=(b.name||'').trim().slice(0,16);
    if(name.length<2||!b.pass) return send(res,400,{error:'Name (2+) and password required'});
    if(DB.byName[name.toLowerCase()]) return send(res,409,{error:'Name taken'});
    const id=uid(), salt=crypto.randomBytes(8).toString('hex');
    const u={ id, name, hash:hashPass(b.pass,salt), salt, rank:5000, coins:0, team:defaultTeam(), wall:defaultTeam(),
      roster:(b.roster||{}), lastDaily:0, cityX:Math.round(Math.random()*1000), cityY:Math.round(Math.random()*1000), created:Date.now() };
    DB.users[id]=u; DB.byName[name.toLowerCase()]=id; const tok=uid()+uid(); DB.tokens[tok]=id; writeDB();
    return send(res,200,{ token:tok, profile:profileFor(u) }); }

  if(p==='/api/login' && req.method==='POST'){ const b=await body(req); const id=DB.byName[(b.name||'').trim().toLowerCase()];
    const u=id&&DB.users[id]; if(!u||u.hash!==hashPass(b.pass||'',u.salt)) return send(res,401,{error:'Wrong name or password'});
    const tok=uid()+uid(); DB.tokens[tok]=id; writeDB(); return send(res,200,{ token:tok, profile:profileFor(u) }); }

  const me=authUser(req);
  if(p==='/api/profile'){ if(!me)return send(res,401,{error:'auth'}); return send(res,200,{profile:profileFor(me)}); }

  if(p==='/api/save' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'}); const b=await body(req);
    if(Array.isArray(b.team)) me.team=b.team; if(Array.isArray(b.wall)) me.wall=b.wall; if(b.roster) me.roster=b.roster; writeDB();
    return send(res,200,{ok:true}); }

  if(p==='/api/arena/opponent'){ if(!me)return send(res,401,{error:'auth'}); const o=pickOpponent(me);
    return send(res,200,{ opponent:{ id:o.id, name:o.name, rank:o.rank, team:o.team, isNpc:!!o.isNpc } }); }

  if(p==='/api/arena/result' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'}); const b=await body(req);
    const opp=DB.users[b.oppId]; const r=applyResult(me,opp,!!b.won); const reward=b.won?(20+Math.floor((5000-me.rank)/50)):5; me.coins+=reward; writeDB();
    return send(res,200,{ rank:me.rank, delta:r.delta, reward, coins:me.coins }); }

  if(p==='/api/arena/ladder'){ if(!me)return send(res,401,{error:'auth'}); const top=allUsersByRank().slice(0,10).map(u=>({name:u.name,rank:u.rank,isNpc:!!u.isNpc}));
    return send(res,200,{ top, you:{name:me.name,rank:me.rank} }); }

  if(p==='/api/daily' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'}); const now=Date.now();
    if(now-(me.lastDaily||0) < 20*60*60*1000) return send(res,200,{granted:0, coins:me.coins, next:(me.lastDaily+20*60*60*1000)});
    const amt=dailyAmount(me.rank); me.coins+=amt; me.lastDaily=now; writeDB(); return send(res,200,{granted:amt, coins:me.coins}); }

  if(p==='/api/world'){ if(!me)return send(res,401,{error:'auth'});
    const cities=Object.values(DB.users).filter(u=>u.id!==me.id).sort((a,b)=>a.rank-b.rank).slice(0,24)
      .map(u=>({id:u.id,name:u.name,rank:u.rank,isNpc:!!u.isNpc}));
    return send(res,200,{ cities, me:{name:me.name,rank:me.rank} }); }

  if(p==='/api/raid' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'}); const b=await body(req); const c=DB.users[b.id];
    if(!c) return send(res,404,{error:'no city'}); return send(res,200,{ defense:c.wall||c.team, name:c.name, rank:c.rank }); }

  return send(res,404,{error:'not found'});
}

/* --------------------------- static PWA files ----------------------------- */
function serveFile(res, file, type, urlPath){ fs.readFile(path.join(__dirname,file),(e,buf)=>{
  if(!e){ res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'}); res.end(buf); return; }
  remoteAsset(urlPath||('/'+file)).then(r=>{ if(!r){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':type||r.ct,'Cache-Control':'no-cache'}); res.end(r.buf); }); }); }

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://x');
  const p=url.pathname;
