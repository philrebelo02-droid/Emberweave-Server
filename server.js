/* ===========================================================================
   Emberweave Heroes — cloud game server (v0.8)
   Dependency-free Node (no npm install needed). Serves the PWA and provides
   the accounts + Arena ladder + city world API. Persists to a JSON file.

   Run locally:  node server.js         (http://localhost:8080)
   Deploy: any Node host (Render/Railway/Fly). It reads PORT from env.

   NOTE ON STORAGE: this uses a JSON file (emberweave-db.json). Great for a VPS
   or local run. On hosts with ephemeral disks (e.g. Render free tier) data
   resets on redeploy — swap readDB/writeDB for a real database (Postgres,
   SQLite, Mongo) when you go live. The seam is intentionally tiny.
   =========================================================================== */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const GAME_FILE = path.join(__dirname, 'emberweave-heroes.html');
// Resolve a PERSISTENT db path so accounts survive redeploys. Priority:
//   1) explicit DB_FILE env var  2) a writable mounted /data volume  3) app dir (EPHEMERAL — wiped on every redeploy!)
function resolveDBFile(){
  if(process.env.DB_FILE) return process.env.DB_FILE;
  try{ fs.accessSync('/data', fs.constants.W_OK); return path.join('/data','emberweave-db.json'); }catch(e){}
  return path.join(__dirname, 'emberweave-db.json');
}
const DB_FILE = resolveDBFile();
const DB_PERSISTENT = !!process.env.DB_FILE || DB_FILE.startsWith('/data');
// where to pull the game from when it isn't bundled next to server.js (so the repo can be just server.js + package.json)
const GAME_URL  = (process.env.GAME_URL || 'https://sunny-biscotti-e5128b.netlify.app').replace(/\/+$/,'');
const _rcache={}, RCACHE_TTL=60000;   // re-fetch from GAME_URL at most once a minute so Netlify updates propagate
async function remoteAsset(urlPath){ const c=_rcache[urlPath]; if(c && Date.now()-c.t < RCACHE_TTL) return c;
  try{ const r=await fetch(GAME_URL+urlPath); if(!r.ok) return c||null; const buf=Buffer.from(await r.arrayBuffer()); _rcache[urlPath]={buf,ct:r.headers.get('content-type')||'application/octet-stream',t:Date.now()}; return _rcache[urlPath]; }catch(e){ return c||null; } }

/* ------------------------------- storage ---------------------------------- */
let DB = { users:{}, byName:{}, tokens:{}, seeded:false };
function readDB(){ try{ DB = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }catch(e){ DB={users:{},byName:{},tokens:{},seeded:false}; } }
let saveTimer=null;
function writeDB(){ if(saveTimer)return; saveTimer=setTimeout(()=>{ saveTimer=null;
  try{ const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(DB)); fs.renameSync(tmp, DB_FILE); }   // atomic: write temp, then rename
  catch(e){ console.error('⚠ DB write failed:', e.message); } },200); }

/* ------------------------------- helpers ---------------------------------- */
function uid(){ return crypto.randomBytes(8).toString('hex'); }
function hashPass(pass, salt){ return crypto.pbkdf2Sync(pass, salt, 60000, 32, 'sha256').toString('hex'); }
function send(res, code, obj){ const b=JSON.stringify(obj); res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-token'}); res.end(b); }
function body(req){ return new Promise(r=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{r(JSON.parse(d||'{}'));}catch(e){r({});} }); }); }
function authUser(req){ const t=req.headers['x-token']; if(!t)return null; const id=DB.tokens[t]; return id?DB.users[id]:null; }
function pub(u){ return { id:u.id, name:u.name, rank:u.rank, coins:u.coins, team:u.team, roster:u.roster, wall:u.wall, isNpc:!!u.isNpc }; }
function profileFor(u){ return { id:u.id, name:u.name, rank:u.rank, coins:u.coins, team:u.team, roster:u.roster, wall:u.wall, lastDaily:u.lastDaily||0, email:u.email||'' }; }
const DEV_NAMES=['phil','dev1'];   // usernames that unlock the dev/admin tools (add more devs here later)
function isDev(u){ return !!(u && !u.isNpc && DEV_NAMES.includes((u.name||'').toLowerCase())); }
// --- security helpers: per-IP rate limiting, single-session, admin diamond edits ---
const _hits={};
function clientIP(req){ return ((req.headers['x-forwarded-for']||'').split(',')[0].trim()) || (req.socket&&req.socket.remoteAddress) || 'unknown'; }
function rateLimited(req, key, max, windowMs){ const k=key+'|'+clientIP(req), now=Date.now();
  const arr=(_hits[k]||[]).filter(t=>now-t<windowMs); arr.push(now); _hits[k]=arr; return arr.length>max; }
function dropTokens(id){ for(const t of Object.keys(DB.tokens)){ if(DB.tokens[t]===id) delete DB.tokens[t]; } }   // single-session / force re-login
function adjustGems(u, delta){ try{ if(!u.roster||typeof u.roster.__save!=='string') return null;
  const g=JSON.parse(u.roster.__save); g.gems=Math.max(0,(g.gems||0)+delta); g.mtime=Date.now();
  u.roster.__save=JSON.stringify(g); u.econ={gems:g.gems||0,gold:g.gold||0,t:Date.now()}; return g.gems; }catch(e){ return null; } }
// ---- anti-tamper: the economy is client-side, so the server can't fully trust a save. It CAN reject the impossible:
//      clamp values no legitimate player can reach (undoing "set my diamonds to 2 billion"), and FLAG (never block, to
//      avoid false positives) implausible single-save jumps so a dev can investigate. Not a full server-authoritative
//      economy — that's the pre-real-money rewrite — but it stops casual console cheating cold. ----
const ECON_CAP={ gems:5000000, gold:2000000000, stamina:100000, arenaCoins:50000000, guildCoins:50000000, playerXP:100000000, gemFrac:1000000 };
const MAP_CAP=10000000, GEM_SPIKE=200000, GOLD_SPIKE=200000000;
function clampNum(v,cap){ if(typeof v!=='number'||!isFinite(v)) return v; if(v<0) return 0; if(v>cap) return cap; return v; }
function sanitizeSave(u, roster){
  if(!roster || typeof roster.__save!=='string') return roster;
  let g; try{ g=JSON.parse(roster.__save); }catch(e){ return roster; }   // unparseable → store as-is, nothing to validate
  let clamped=false;
  for(const k in ECON_CAP){ if(typeof g[k]==='number'){ const nv=clampNum(g[k],ECON_CAP[k]); if(nv!==g[k]){ g[k]=nv; clamped=true; } } }
  for(const map of ['mats','eqMats','starShards','heroFrag','glyphRank']){ const o=g[map]; if(o&&typeof o==='object'){ for(const k in o){ if(typeof o[k]==='number'){ const nv=clampNum(o[k],MAP_CAP); if(nv!==o[k]){ o[k]=nv; clamped=true; } } } } }
  const prev=u.econ||{}, now=Date.now(); const dGems=(g.gems||0)-(prev.gems||0), dGold=(g.gold||0)-(prev.gold||0);
  let reason=null;
  if(clamped) reason='impossible value clamped';
  else if(prev.gems!=null && dGems>GEM_SPIKE) reason='diamond spike (+'+dGems+')';
  else if(prev.gold!=null && dGold>GOLD_SPIKE) reason='gold spike (+'+dGold+')';
  if(reason){ u.flag={ reason, t:now, gems:g.gems||0, gold:g.gold||0 }; console.log('⚠ integrity flag — '+u.name+': '+reason); }
  u.econ={ gems:g.gems||0, gold:g.gold||0, t:now };
  roster.__save=JSON.stringify(g); return roster; }
// rotating hourly DB backups (kept alongside the db file)
function backupDB(){ try{ const dir=path.join(path.dirname(DB_FILE),'backups'); fs.mkdirSync(dir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-'); fs.writeFileSync(path.join(dir,'db-'+stamp+'.json'), JSON.stringify(DB));
  const files=fs.readdirSync(dir).filter(f=>f.startsWith('db-')).sort(); while(files.length>48){ try{ fs.unlinkSync(path.join(dir,files.shift())); }catch(e){} }
}catch(e){ console.error('⚠ backup failed:', e.message); } }

// --- email: password-reset codes over SMTP (any provider via env vars). Degrades gracefully: if SMTP
//     isn't configured (or nodemailer isn't installed) the code is logged to the server console so the
//     flow still works for local/dev testing. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM to send real mail.
function normalizeEmail(e){ e=(e||'').toString().trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)?e.slice(0,120):''; }
function maskEmail(e){ e=(e||'').toString(); const i=e.indexOf('@'); if(i<1) return '•••'; const u=e.slice(0,i); return u.slice(0,Math.min(2,u.length))+'•••'+e.slice(i); }
function gen6(){ return String(crypto.randomInt(0,1000000)).padStart(6,'0'); }   // cryptographically-random 6-digit code
let _mailer=null, _mailerTried=false;
function getMailer(){ if(_mailerTried) return _mailer; _mailerTried=true;
  if(!process.env.SMTP_HOST){ console.log('✉  SMTP not configured — password-reset codes will be logged to the console only. Set SMTP_HOST/SMTP_USER/SMTP_PASS to send real email.'); return null; }
  try{ const nm=require('nodemailer');
    _mailer=nm.createTransport({ host:process.env.SMTP_HOST, port:+(process.env.SMTP_PORT||587),
      secure:String(process.env.SMTP_SECURE||'')==='true',
      auth: process.env.SMTP_USER ? {user:process.env.SMTP_USER, pass:process.env.SMTP_PASS} : undefined });
    console.log('✉  SMTP mailer ready ('+process.env.SMTP_HOST+').');
  }catch(e){ console.log('✉  nodemailer not installed — run `npm install`. Reset codes will be logged to the console only.'); _mailer=null; }
  return _mailer; }
function escHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
// a simple branded HTML version — a well-formed multipart email looks more legitimate to spam filters than bare text
function codeHtml(name, intro, code, note){
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:460px;margin:0 auto;padding:8px;color:#1a1f2b">
    <div style="font-size:20px;font-weight:800;color:#c8501e;margin-bottom:14px">🔥 Emberweave Heroes</div>
    <p style="margin:0 0 10px">Hi ${escHtml(name)},</p>
    <p style="margin:0 0 14px">${intro}</p>
    <div style="font-size:30px;font-weight:800;letter-spacing:8px;background:#f4f5f8;border:1px solid #e3e6ee;border-radius:12px;padding:16px;text-align:center;margin:0 0 14px;color:#1a1f2b">${code}</div>
    <p style="margin:0 0 14px;color:#5a6472;font-size:13px">${note}</p>
    <p style="margin:0;color:#9aa2b1;font-size:12px">— Emberweave Heroes</p></div>`;
}
function mailCode(to, name, subject, text, label, code, html){
  const addr=process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@emberweave.game';
  const from='"Emberweave Heroes" <'+addr+'>';   // friendly display name reads as legitimate, not a bare script
  const m=getMailer();
  if(!m){ console.log('✉  [DEV] '+label+' for '+name+' <'+to+'>: '+code); return; }
  const msg={ from, to, replyTo:addr, subject, text }; if(html) msg.html=html;
  m.sendMail(msg).then(()=>console.log('✉  '+label+' emailed to '+to)).catch(e=>console.log('✉  send failed ('+e.message+') — '+label+' for '+name+' is '+code)); }
function sendResetEmail(to, name, code){
  mailCode(to, name, 'Your Emberweave Heroes password reset code',
    `Hi ${name},\n\nYour one-time password reset code is: ${code}\n\nEnter it in the game to set a new password. This code expires in 15 minutes and can only be used once.\n\nIf you didn't request this, you can safely ignore this email — your password will stay the same.\n\n— Emberweave Heroes`,
    'reset code', code,
    codeHtml(name, 'Your one-time password reset code is:', code, 'Enter it in the game to set a new password. This code expires in 15 minutes and can only be used once. If you didn\'t request this, you can safely ignore this email.')); }
function sendChangeCode(to, name, code, toCurrent){
  mailCode(to, name, 'Confirm your Emberweave Heroes recovery email',
    `Hi ${name},\n\nA request was made to change the recovery email on your account. Your confirmation code is: ${code}\n\nEnter it in the game to confirm the change. This code expires in 15 minutes.\n\n${toCurrent?'If this wasn\'t you, do NOT enter this code and change your password right away — someone may have access to your account.':'If you didn\'t request this, you can ignore this email.'}\n\n— Emberweave Heroes`,
    'email-change code', code,
    codeHtml(name, 'A request was made to change the recovery email on your account. Your confirmation code is:', code, toCurrent?'Enter it in the game to confirm the change (expires in 15 minutes). If this wasn\'t you, do NOT enter this code and change your password right away.':'Enter it in the game to confirm the change. Expires in 15 minutes. If you didn\'t request this, you can ignore this email.')); }

const HERO_KEYS=['konwu','grosk','vulmar'];
function defaultTeam(){ return [ {key:'konwu',level:1,rank:0},{key:'grosk',level:1,rank:0},{key:'vulmar',level:1,rank:0} ]; }

/* --------------------------- NPC / world seeding -------------------------- */
const NPC_NAMES=['Ironhold','Stormgate','Ashvale','Highcliff','Duskmere','Ravenspire','Frostholm','Emberton','Wolfden','Goldreach','Thornwick','Mistfall','Grimwater','Sunspear','Blackmoor','Oakenshield','Redkeep','Silverbrook','Winterfell','Stonehaven','Bramblewood','Nightvale','Dawnkeep','Shadowfen','Windmere','Coldharbor','Firebrand','Greymarch','Hollowreach','Larkspur','Direhold','Kingsmoor','Valebright','Ashenford','Cragmaw','Elmsworth','Ferncove','Gale’s Rest','Hearthglen','Ivywatch'];
function randTeam(power){ const t=[]; const pool=HERO_KEYS.slice(); for(let i=0;i<5;i++){ const key=pool[(i*3+power)%pool.length]; t.push({key,level:1+Math.floor(power*0.6+Math.random()*power*0.4),rank:Math.min(3,Math.floor(power/6))}); } return t; }
function seed(){
  if(DB.seeded) return;
  NPC_NAMES.forEach((name,i)=>{
    const id='npc_'+i;
    const rank = Math.max(1, Math.round(5000 - i*(5000/NPC_NAMES.length) + (Math.random()*80-40)));
    const power = Math.max(1, Math.round(20 - (rank/5000)*18)); // better rank -> stronger
    DB.users[id]={ id, name, isNpc:true, rank, coins:0, team:randTeam(power), wall:randTeam(power),
      roster:{}, cityX:Math.round(Math.random()*1000), cityY:Math.round(Math.random()*1000), created:0 };
  });
  DB.seeded=true; writeDB();
}

/* ------------------------------ ladder logic ------------------------------ */
function allUsersByRank(){ return Object.values(DB.users).sort((a,b)=>a.rank-b.rank); }
function pickOpponent(me){
  const pool=Object.values(DB.users).filter(u=>u.id!==me.id);
  // prefer someone slightly ABOVE the player (lower rank number)
  const above=pool.filter(u=>u.rank<me.rank).sort((a,b)=>b.rank-a.rank); // closest above
  const cand = above.length? above.slice(0, Math.min(8,above.length)) : pool;
  return cand[Math.floor(Math.random()*cand.length)] || pool[0];
}
function applyResult(me, opp, won){
  const before=me.rank;
  if(won){
    if(opp && opp.rank < me.rank){ // beat someone above -> take their rank, they drop one
      const taken=opp.rank; opp.rank=Math.min(taken+1, before); me.rank=taken;
    } else { me.rank=Math.max(1, me.rank - (2+Math.floor(Math.random()*4))); }
  } else {
    me.rank = me.rank + (2+Math.floor(Math.random()*4));
  }
  me.rank=Math.max(1,me.rank);
  return { rank:me.rank, delta:before-me.rank };
}
function dailyAmount(rank){ if(rank<=1)return 1000; if(rank<=10)return 600; if(rank<=100)return 350; if(rank<=1000)return 180; return 60; }

/* --------------------------------- routes --------------------------------- */
async function api(req,res,url){
  const p=url.pathname;
  if(req.method==='OPTIONS'){ res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-token'}); res.end(); return; }

  if(p==='/api/register' && req.method==='POST'){ const b=await body(req); const name=(b.name||'').replace(/[<>]/g,'').trim().slice(0,16);
    if(rateLimited(req,'reg',6,60000)) return send(res,429,{error:'Too many attempts — wait a minute and try again.'});
    if(name.length<2||!b.pass) return send(res,400,{error:'Name (2+) and password required'});
    if(DB.byName[name.toLowerCase()]) return send(res,409,{error:'Username is already taken — choose another.'});
    // cap account creation to 3 per device (and a softer per-network cap so clearing storage can't fully bypass it)
    const deviceId=(b.deviceId||'').slice(0,64), ip=clientIP(req); DB.devices=DB.devices||{}; DB.ipAccounts=DB.ipAccounts||{};
    if(deviceId && (DB.devices[deviceId]||0)>=3) return send(res,429,{error:'This device has reached the 3-account limit.'});
    if((DB.ipAccounts[ip]||0)>=6) return send(res,429,{error:'Too many accounts from this network.'});
    const id=uid(), salt=crypto.randomBytes(8).toString('hex');
    const u={ id, name, hash:hashPass(b.pass,salt), salt, rank:5000, coins:0, team:defaultTeam(), wall:defaultTeam(),
      roster:(b.roster||{}), lastDaily:0, cityX:Math.round(Math.random()*1000), cityY:Math.round(Math.random()*1000), created:Date.now() };
    DB.users[id]=u; DB.byName[name.toLowerCase()]=id; if(deviceId) DB.devices[deviceId]=(DB.devices[deviceId]||0)+1; DB.ipAccounts[ip]=(DB.ipAccounts[ip]||0)+1;
    const tok=uid()+uid(); DB.tokens[tok]=id; writeDB();
    return send(res,200,{ token:tok, profile:profileFor(u) }); }

  if(p==='/api/login' && req.method==='POST'){ const b=await body(req);
    if(rateLimited(req,'login',15,60000)) return send(res,429,{error:'Too many attempts — wait a minute and try again.'});
    const id=DB.byName[(b.name||'').trim().toLowerCase()];
    const u=id&&DB.users[id]; if(!u) return send(res,401,{error:'Wrong name or password'});
    // account flagged by an admin for password recovery: the next login sets a brand-new password
    if(u.mustReset){
      if(b.newPass){ if((b.newPass||'').length<1) return send(res,400,{error:'Enter a new password'});
        u.salt=crypto.randomBytes(8).toString('hex'); u.hash=hashPass(b.newPass,u.salt); u.mustReset=false;
        dropTokens(id); const tok=uid()+uid(); DB.tokens[tok]=id; writeDB(); return send(res,200,{ token:tok, profile:profileFor(u) }); }
      return send(res,200,{ reset:true, name:u.name }); }   // tell the client to prompt for a new password
    if(u.hash!==hashPass(b.pass||'',u.salt)) return send(res,401,{error:'Wrong name or password'});
    dropTokens(id);   // single session: signing in here kicks any other device
    const tok=uid()+uid(); DB.tokens[tok]=id; writeDB(); return send(res,200,{ token:tok, profile:profileFor(u) }); }

  // email password reset — step 1: request a one-time 6-digit code sent to the account's linked email.
  // Always responds ok (never reveals whether an account or its email exists); only sends if a valid email is on file.
  if(p==='/api/reset-request' && req.method==='POST'){ const b=await body(req);
    if(rateLimited(req,'resetreq',5,10*60000)) return send(res,429,{error:'Too many requests — wait a few minutes and try again.'});
    const id=DB.byName[(b.name||'').trim().toLowerCase()]; const u=id&&DB.users[id];
    if(u && !u.isNpc && u.email){ const code=gen6(), salt=crypto.randomBytes(8).toString('hex');
      u.reset={ hash:hashPass(code,salt), salt, exp:Date.now()+15*60000, tries:0 }; writeDB();
      sendResetEmail(u.email, u.name, code); }
    return send(res,200,{ ok:true, hasEmail: !!(u && !u.isNpc && u.email) }); }

  // email password reset — step 2: verify the code and set a new password. Signs the user in on success.
  if(p==='/api/reset-verify' && req.method==='POST'){ const b=await body(req);
    if(rateLimited(req,'resetver',12,10*60000)) return send(res,429,{error:'Too many attempts — wait a few minutes.'});
    const id=DB.byName[(b.name||'').trim().toLowerCase()]; const u=id&&DB.users[id];
    if(!u||u.isNpc||!u.reset) return send(res,400,{error:'No active reset — request a new code.'});
    if(Date.now()>u.reset.exp){ delete u.reset; writeDB(); return send(res,400,{error:'That code expired — request a new one.'}); }
    if((u.reset.tries||0)>=5){ delete u.reset; writeDB(); return send(res,400,{error:'Too many wrong codes — request a new one.'}); }
    const code=(b.code||'').toString().replace(/\D/g,'');
    if(hashPass(code,u.reset.salt)!==u.reset.hash){ u.reset.tries=(u.reset.tries||0)+1; writeDB(); return send(res,400,{error:'Incorrect code — check your email and try again.'}); }
    const np=(b.newPass||'').toString(); if(np.length<1) return send(res,400,{error:'Enter a new password.'});
    u.salt=crypto.randomBytes(8).toString('hex'); u.hash=hashPass(np,u.salt); u.mustReset=false; delete u.reset;
    dropTokens(id); const tok=uid()+uid(); DB.tokens[tok]=id; writeDB();   // invalidate other sessions, sign this one in
    return send(res,200,{ ok:true, token:tok, profile:profileFor(u) }); }

  const me=authUser(req);
  if(me) me.lastSeen=Date.now();   // presence, for the dev "players online" view
  // ---- developer/admin endpoints (only usable while signed into a dev account) ----
  if(p==='/api/admin/online'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const cutoff=Date.now()-5*60000;
    const online=Object.values(DB.users).filter(u=>!u.isNpc && (u.lastSeen||0)>=cutoff)
      .sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0)).map(u=>({id:u.id,name:u.name,rank:u.rank,lastSeen:u.lastSeen||0,created:u.created||0,mustReset:!!u.mustReset,email:u.email||'',flag:u.flag||null}));
    return send(res,200,{online, count:online.length}); }
  if(p==='/api/admin/accounts'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const accounts=Object.values(DB.users).filter(u=>!u.isNpc)
      .sort((a,b)=>(b.created||0)-(a.created||0)).map(u=>({id:u.id,name:u.name,rank:u.rank,created:u.created||0,lastSeen:u.lastSeen||0,mustReset:!!u.mustReset,email:u.email||'',flag:u.flag||null}));
    return send(res,200,{accounts, count:accounts.length}); }
  // admin: flag an account for password recovery — its owner sets a new password on next login
  if(p==='/api/admin/reset' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const tid=b.id||DB.byName[(b.name||'').trim().toLowerCase()]; const u=tid&&DB.users[tid];
    if(!u||u.isNpc) return send(res,404,{error:'account not found'});
    u.mustReset=true;
    for(const t of Object.keys(DB.tokens)){ if(DB.tokens[t]===tid) delete DB.tokens[t]; }  // sign out any active sessions
    writeDB(); return send(res,200,{ok:true, name:u.name}); }
  // admin: clear the recovery flag (undo)
  if(p==='/api/admin/unreset' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const tid=b.id||DB.byName[(b.name||'').trim().toLowerCase()]; const u=tid&&DB.users[tid];
    if(!u||u.isNpc) return send(res,404,{error:'account not found'});
    u.mustReset=false; writeDB(); return send(res,200,{ok:true, name:u.name}); }
  // admin: clear or set a player's recovery email (for the "lost my old inbox" case — clearing lets them
  // bind a fresh email through the normal verified flow, since first-time binding sends the code to the new address)
  if(p==='/api/admin/email' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const tid=b.id||DB.byName[(b.name||'').trim().toLowerCase()]; const u=tid&&DB.users[tid];
    if(!u||u.isNpc) return send(res,404,{error:'account not found'});
    if(b.action==='clear'){ delete u.email; delete u.emailChange; writeDB(); return send(res,200,{ok:true, name:u.name, email:''}); }
    const email=normalizeEmail(b.email); if(!email) return send(res,400,{error:'Enter a valid email address.'});
    u.email=email; delete u.emailChange; writeDB(); return send(res,200,{ok:true, name:u.name, email}); }
  // admin: clear an account's integrity flag (after reviewing / resetting them)
  if(p==='/api/admin/clearflag' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const tid=b.id||DB.byName[(b.name||'').trim().toLowerCase()]; const u=tid&&DB.users[tid];
    if(!u||u.isNpc) return send(res,404,{error:'account not found'}); delete u.flag; writeDB(); return send(res,200,{ok:true, name:u.name}); }
  // admin: create an account directly
  if(p==='/api/admin/create' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const name=(b.name||'').replace(/[<>]/g,'').trim().slice(0,16);
    if(name.length<2||!b.pass) return send(res,400,{error:'Name (2+) and password required'});
    if(DB.byName[name.toLowerCase()]) return send(res,409,{error:'Username already taken'});
    const id=uid(), salt=crypto.randomBytes(8).toString('hex');
    DB.users[id]={ id, name, hash:hashPass(b.pass,salt), salt, rank:5000, coins:0, team:defaultTeam(), wall:defaultTeam(),
      roster:{}, lastDaily:0, cityX:Math.round(Math.random()*1000), cityY:Math.round(Math.random()*1000), created:Date.now() };
    DB.byName[name.toLowerCase()]=id; writeDB(); return send(res,200,{ok:true, name}); }
  // admin: delete an account
  if(p==='/api/admin/delete' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const tid=b.id||DB.byName[(b.name||'').trim().toLowerCase()]; const u=tid&&DB.users[tid];
    if(!u||u.isNpc) return send(res,404,{error:'account not found'});
    if(isDev(u)) return send(res,400,{error:'cannot delete a dev account'});
    delete DB.byName[(u.name||'').toLowerCase()]; delete DB.users[tid]; dropTokens(tid);
    writeDB(); return send(res,200,{ok:true, name:u.name}); }
  // admin: grant / take 2000 diamonds (edits the player's cloud save; forces them to reload it)
  if((p==='/api/admin/grant'||p==='/api/admin/take') && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const tid=b.id||DB.byName[(b.name||'').trim().toLowerCase()]; const u=tid&&DB.users[tid];
    if(!u||u.isNpc) return send(res,404,{error:'account not found'});
    const ng=adjustGems(u, p==='/api/admin/grant'?2000:-2000);
    if(ng==null) return send(res,400,{error:'That player has no cloud save yet — they must open the game once first.'});
    dropTokens(tid); writeDB(); return send(res,200,{ok:true, name:u.name, gems:ng}); }
  // admin: download the whole DB as a backup
  if(p==='/api/admin/backup'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'}); backupDB(); return send(res,200, DB); }
  // bug / balance reports: any signed-in player (or a dev's balance bots) can file one
  if(p==='/api/report' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    if(rateLimited(req,'report',12,60000)) return send(res,429,{error:'Too many reports — wait a minute.'});
    const b=await body(req); const text=(b.text||'').toString().slice(0,2000); if(!text.trim()) return send(res,400,{error:'Report is empty'});
    DB.reports=DB.reports||[]; DB.reports.push({ id:uid(), name:me.name, kind:(b.kind==='balance'?'balance':'bug'), text, meta:(b.meta||'').toString().slice(0,400), t:Date.now(), resolved:false });
    if(DB.reports.length>1000) DB.reports=DB.reports.slice(-1000); writeDB(); return send(res,200,{ok:true}); }
  if(p==='/api/admin/reports'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const reports=(DB.reports||[]).slice().reverse().slice(0,200); return send(res,200,{reports, count:(DB.reports||[]).length}); }
  if(p==='/api/admin/report' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); DB.reports=DB.reports||[]; const r=DB.reports.find(x=>x.id===b.id);
    if(b.action==='clearResolved'){ DB.reports=DB.reports.filter(x=>!x.resolved); writeDB(); return send(res,200,{ok:true}); }
    if(!r) return send(res,404,{error:'not found'});
    if(b.action==='delete') DB.reports=DB.reports.filter(x=>x.id!==b.id); else r.resolved=!r.resolved;
    writeDB(); return send(res,200,{ok:true}); }
  if(p==='/api/profile'){ if(!me)return send(res,401,{error:'auth'}); return send(res,200,{profile:profileFor(me)}); }

  // change / link recovery email — STEP 1: request a confirmation code. Signed-in only.
  // If an email is already on file the code goes to the CURRENT email (so a hijacked session can't silently
  // redirect account recovery); if none is on file yet the code goes to the NEW email to prove ownership.
  if(p==='/api/email-request' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    if(rateLimited(req,'emailreq',6,10*60000)) return send(res,429,{error:'Too many requests — wait a few minutes.'});
    const b=await body(req); const email=normalizeEmail(b.email);
    if(!email) return send(res,400,{error:'Enter a valid email address.'});
    if(me.email && email===me.email) return send(res,400,{error:'That is already your recovery email.'});
    const toCurrent=!!me.email, target=toCurrent?me.email:email;
    const code=gen6(), salt=crypto.randomBytes(8).toString('hex');
    me.emailChange={ newEmail:email, hash:hashPass(code,salt), salt, exp:Date.now()+15*60000, tries:0, toCurrent };
    writeDB(); sendChangeCode(target, me.name, code, toCurrent);
    return send(res,200,{ ok:true, toCurrent, sentTo:maskEmail(target) }); }

  // change / link recovery email — STEP 2: verify the code and commit the new email. Signed-in only.
  if(p==='/api/email-verify' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    if(rateLimited(req,'emailver',12,10*60000)) return send(res,429,{error:'Too many attempts — wait a few minutes.'});
    const b=await body(req); if(!me.emailChange) return send(res,400,{error:'No pending email change — start again.'});
    if(Date.now()>me.emailChange.exp){ delete me.emailChange; writeDB(); return send(res,400,{error:'That code expired — start again.'}); }
    if((me.emailChange.tries||0)>=5){ delete me.emailChange; writeDB(); return send(res,400,{error:'Too many wrong codes — start again.'}); }
    const code=(b.code||'').toString().replace(/\D/g,'');
    if(hashPass(code,me.emailChange.salt)!==me.emailChange.hash){ me.emailChange.tries=(me.emailChange.tries||0)+1; writeDB(); return send(res,400,{error:'Incorrect code — check your email and try again.'}); }
    me.email=me.emailChange.newEmail; delete me.emailChange; writeDB();
    return send(res,200,{ ok:true, email:me.email }); }

  if(p==='/api/save' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'}); const b=await body(req);
    if(Array.isArray(b.team)) me.team=b.team; if(Array.isArray(b.wall)) me.wall=b.wall;
    if(b.roster) me.roster=sanitizeSave(me, b.roster);   // clamp impossible values + flag implausible jumps
    writeDB(); return send(res,200,{ok:true}); }

  if(p==='/api/arena/opponent'){ if(!me)return send(res,401,{error:'auth'}); const o=pickOpponent(me);
    return send(res,200,{ opponent:{ id:o.id, name:o.name, rank:o.rank, team:o.team, isNpc:!!o.isNpc } }); }

  if(p==='/api/arena/result' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    if(rateLimited(req,'arena',30,60000)) return send(res,429,{error:'Slow down — too many arena results.'});
    const b=await body(req);
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


  /* ------------------------------- GUILDS (real, cross-device) --------------
     A guild is a shared server object in DB.guilds; each user carries a guildId
     pointer. Membership, join-requests, roster, shared level/exp and chat are all
     server-authoritative. Clients poll /api/guild/mine while the guild screen is open. */
  if(p.startsWith('/api/guild')){
    if(!me) return send(res,401,{error:'auth'});
    DB.guilds = DB.guilds || {};
    const GBASE=30,GPER=5,GMAXCAP=60,GMAXLVL=7;
    const gCap = g => Math.min(GMAXCAP, GBASE+((g.level||1)-1)*GPER);
    const gExpNeed = lvl => 1000*lvl;
    const myGuild = () => me.guildId ? DB.guilds[me.guildId] : null;
    const nameOf = id => { const u=DB.users[id]; return u?u.name:'—'; };
    const rankOf = id => { const u=DB.users[id]; return u?u.rank:99999; };
    const isOnline = id => { const u=DB.users[id]; return !!(u && (Date.now()-(u.lastSeen||0) < 5*60000)); };
    const capWords = s => s.replace(/\b\w/g,c=>c.toUpperCase());
    function guildView(g){
      const mem=(g.members||[]).map(id=>({id,name:nameOf(id),rank:rankOf(id),online:isOnline(id),leader:id===g.leader}))
        .sort((a,b)=>(b.leader?1:0)-(a.leader?1:0) || (b.online?1:0)-(a.online?1:0) || a.rank-b.rank);
      const youLeader = g.leader===me.id;
      return { id:g.id, name:g.name, level:g.level||1, exp:g.exp||0, expNeed:gExpNeed(g.level||1),
        motd:g.motd||'', leader:g.leader, leaderName:nameOf(g.leader), cap:gCap(g),
        members:mem, count:mem.length, youLeader,
        requests: youLeader ? (g.reqs||[]).map(r=>({id:r.id,name:nameOf(r.id),rank:rankOf(r.id),t:r.t})) : [],
        pendingReqCount:(g.reqs||[]).length,
        log:(g.log||[]).slice(-60) };
    }
    // ---- reads ----
    if(p==='/api/guild/mine'){ const g=myGuild(); return send(res,200,{ guild: g?guildView(g):null }); }
    if(p==='/api/guild/browse'){ const q=(url.searchParams.get('q')||'').toLowerCase().trim();
      const list=Object.values(DB.guilds)
        .filter(g=> !q || (g.name||'').toLowerCase().includes(q))
        .map(g=>({id:g.id,name:g.name,level:g.level||1,count:(g.members||[]).length,cap:gCap(g),
                  leaderName:nameOf(g.leader),requested:(g.reqs||[]).some(r=>r.id===me.id)}))
        .sort((a,b)=> b.count-a.count).slice(0,40);
      return send(res,200,{ guilds:list, mine: me.guildId||null }); }

    if(req.method!=='POST') return send(res,404,{error:'not found'});
    const b=await body(req);

    if(p==='/api/guild/create'){
      if(rateLimited(req,'gcreate',10,60000)) return send(res,429,{error:'Slow down and try again in a moment.'});
      if(myGuild()) return send(res,400,{error:'You are already in a guild.'});
      let name=capWords((b.name||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim()).slice(0,24);
      if(name.length<2) return send(res,400,{error:'Guild name must be at least 2 characters.'});
      if(Object.values(DB.guilds).some(g=>(g.name||'').toLowerCase()===name.toLowerCase())) return send(res,409,{error:'That guild name is taken.'});
      const id=uid(); const g={ id, name, leader:me.id, members:[me.id], reqs:[], level:1, exp:0, motd:'Welcome to '+name+'!', log:[], createdAt:Date.now() };
      DB.guilds[id]=g; me.guildId=id; writeDB();
      return send(res,200,{ guild:guildView(g) }); }

    if(p==='/api/guild/request'){
      if(myGuild()) return send(res,400,{error:'Leave your current guild first.'});
      const g=DB.guilds[b.guildId]; if(!g) return send(res,404,{error:'Guild not found.'});
      if((g.members||[]).length>=gCap(g)) return send(res,400,{error:'That guild is full.'});
      g.reqs=g.reqs||[]; if(g.reqs.some(r=>r.id===me.id)) return send(res,200,{ ok:true, already:true });
      if(g.reqs.length>=80) return send(res,400,{error:'That guild has too many pending requests right now.'});
      g.reqs.push({id:me.id,t:Date.now()}); writeDB(); return send(res,200,{ ok:true }); }

    if(p==='/api/guild/cancelRequest'){ const g=DB.guilds[b.guildId]; if(g){ g.reqs=(g.reqs||[]).filter(r=>r.id!==me.id); writeDB(); } return send(res,200,{ok:true}); }

    const g=myGuild();
    if(['/api/guild/approve','/api/guild/deny','/api/guild/kick','/api/guild/transfer','/api/guild/disband','/api/guild/motd'].includes(p)){
      if(!g) return send(res,400,{error:'You are not in a guild.'});
      if(g.leader!==me.id) return send(res,403,{error:'Only the guild leader can do that.'});
    }
    if(p==='/api/guild/approve'){ const tid=b.id; g.reqs=g.reqs||[];
      if(!g.reqs.some(r=>r.id===tid)) return send(res,400,{error:'No such request.'});
      const tu=DB.users[tid]; if(!tu){ g.reqs=g.reqs.filter(r=>r.id!==tid); writeDB(); return send(res,400,{error:'That player no longer exists.'}); }
      if(tu.guildId){ g.reqs=g.reqs.filter(r=>r.id!==tid); writeDB(); return send(res,400,{error:'That player already joined a guild.'}); }
      if((g.members||[]).length>=gCap(g)) return send(res,400,{error:'Your guild is full.'});
      g.members.push(tid); tu.guildId=g.id; g.reqs=g.reqs.filter(r=>r.id!==tid);
      g.log=g.log||[]; g.log.push({sys:1,tx:tu.name+' joined the guild.',t:Date.now()}); if(g.log.length>100)g.log=g.log.slice(-100);
      writeDB(); return send(res,200,{ guild:guildView(g) }); }
    if(p==='/api/guild/deny'){ g.reqs=(g.reqs||[]).filter(r=>r.id!==b.id); writeDB(); return send(res,200,{ guild:guildView(g) }); }
    if(p==='/api/guild/kick'){ if(b.id===me.id) return send(res,400,{error:'Use Leave instead.'});
      if(!(g.members||[]).includes(b.id)) return send(res,400,{error:'Not a member.'});
      g.members=g.members.filter(x=>x!==b.id); const tu=DB.users[b.id]; if(tu&&tu.guildId===g.id) delete tu.guildId;
      g.log=g.log||[]; g.log.push({sys:1,tx:nameOf(b.id)+' was removed from the guild.',t:Date.now()});
      writeDB(); return send(res,200,{ guild:guildView(g) }); }
    if(p==='/api/guild/transfer'){ if(!(g.members||[]).includes(b.id)) return send(res,400,{error:'Not a member.'});
      g.leader=b.id; g.log=g.log||[]; g.log.push({sys:1,tx:nameOf(b.id)+' is now the guild leader.',t:Date.now()});
      writeDB(); return send(res,200,{ guild:guildView(g) }); }
    if(p==='/api/guild/motd'){ g.motd=(b.motd||'').toString().replace(/[<>]/g,'').slice(0,160); writeDB(); return send(res,200,{ guild:guildView(g) }); }
    if(p==='/api/guild/disband'){ for(const mid of (g.members||[])){ const mu=DB.users[mid]; if(mu&&mu.guildId===g.id) delete mu.guildId; }
      delete DB.guilds[g.id]; writeDB(); return send(res,200,{ ok:true, disbanded:true }); }

    if(p==='/api/guild/leave'){ if(!g) return send(res,400,{error:'You are not in a guild.'});
      if(g.leader===me.id && (g.members||[]).length>1) return send(res,400,{error:'Transfer leadership to another member before you leave.'});
      g.members=(g.members||[]).filter(x=>x!==me.id); delete me.guildId;
      if((g.members||[]).length===0){ delete DB.guilds[g.id]; writeDB(); return send(res,200,{ ok:true, disbanded:true }); }
      g.log=g.log||[]; g.log.push({sys:1,tx:me.name+' left the guild.',t:Date.now()});
      writeDB(); return send(res,200,{ ok:true }); }

    if(p==='/api/guild/chat'){ if(!g) return send(res,400,{error:'You are not in a guild.'});
      if(rateLimited(req,'gchat',25,60000)) return send(res,429,{error:'Slow down.'});
      const tx=(b.tx||'').toString().replace(/[<>]/g,'').slice(0,200).trim(); if(!tx) return send(res,200,{ok:true});
      g.log=g.log||[]; g.log.push({id:me.id,name:me.name,tx,t:Date.now()}); if(g.log.length>100)g.log=g.log.slice(-100);
      writeDB(); return send(res,200,{ ok:true, log:g.log.slice(-60) }); }

    if(p==='/api/guild/contribute'){ if(!g) return send(res,400,{error:'You are not in a guild.'});
      if(rateLimited(req,'gcontrib',80,60000)) return send(res,429,{error:'Slow down.'});
      let amt=Math.max(0,Math.min(100000, parseInt(b.exp,10)||0)); if(!amt) return send(res,200,{ guild:guildView(g) });
      g.exp=(g.exp||0)+amt;
      while((g.level||1)<GMAXLVL && g.exp>=gExpNeed(g.level||1)){ g.exp-=gExpNeed(g.level||1); g.level=(g.level||1)+1;
        g.log=g.log||[]; g.log.push({sys:1,tx:'The guild reached Level '+g.level+'!',t:Date.now()}); }
      if((g.level||1)>=GMAXLVL) g.exp=0;
      writeDB(); return send(res,200,{ guild:guildView(g) }); }

    return send(res,404,{error:'not found'});
  }

  return send(res,404,{error:'not found'});
}

/* --------------------------- static PWA files ----------------------------- */
// serve a static asset: local file if present, otherwise proxy it from GAME_URL (so the repo can be tiny)
function serveFile(res, file, type, urlPath){ fs.readFile(path.join(__dirname,file),(e,buf)=>{
  if(!e){ res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'}); res.end(buf); return; }
  remoteAsset(urlPath||('/'+file)).then(r=>{ if(!r){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':type||r.ct,'Cache-Control':'no-cache'}); res.end(r.buf); }); }); }

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://x');
  const p=url.pathname;
  if(p.startsWith('/api/')) return api(req,res,url);
  if(p==='/health'){ res.writeHead(200);res.end('ok');return; }
  if(p==='/sw.js') return serveFile(res,'sw.js','application/javascript');
  if(p==='/version.json'){ res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return fs.readFile(path.join(__dirname,'version.json'),(e,b)=>{ if(!e){res.end(b);return;} remoteAsset('/version.json').then(r=>res.end(r?r.buf:'{}')); }); }
  if(p==='/manifest.webmanifest') return serveFile(res,'manifest.webmanifest','application/manifest+json');
  if(p==='/icon-192.png') return serveFile(res,'icon-192.png','image/png');
  if(p==='/icon-512.png') return serveFile(res,'icon-512.png','image/png');
  if(p==='/icon-512-maskable.png') return serveFile(res,'icon-512-maskable.png','image/png');
  if(p==='/apple-touch-icon.png') return serveFile(res,'apple-touch-icon.png','image/png');
  // everything else -> the game (local file if bundled, else pulled from GAME_URL). Supports /?room deep links.
  fs.readFile(GAME_FILE,(e,buf)=>{ if(!e){ res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}); res.end(buf); return; }
    remoteAsset('/').then(r=>{ if(!r){res.writeHead(502);res.end('Game source unavailable. Set GAME_URL to your game link.');return;} res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}); res.end(r.buf); }); });
});

/* ---------------------- live PvP: 2-player room relay ---------------------- */
let WSS=null;
try{
  const WebSocketServer = require('ws').Server;
  WSS = new WebSocketServer({ server });
  const rooms = {};   // code -> { host, guest }
  const roomCode = ()=>{ let c; do{ c=crypto.randomBytes(3).toString('hex').toUpperCase().slice(0,5); }while(rooms[c]); return c; };
  const wsend = (ws,o)=>{ try{ if(ws && ws.readyState===1) ws.send(JSON.stringify(o)); }catch(e){} };
  // ---- live chat: world/region broadcast + name-addressed whispers ----
  // history is stored in the DB (persists across restarts) and kept for ~3h or the last 100 messages per channel
  const CHAT_KEEP=100, CHAT_AGE_MS=3*3600000;
  const clip = (s,n)=> String(s==null?'':s).slice(0,n);
  function chatStore(){ if(!DB.chat)DB.chat={world:[],region:[]}; if(!Array.isArray(DB.chat.world))DB.chat.world=[]; if(!Array.isArray(DB.chat.region))DB.chat.region=[]; return DB.chat; }
  function pruneChat(ch){ const now=Date.now(), st=chatStore(); let a=st[ch].filter(m=>!m.t||(now-m.t)<CHAT_AGE_MS); if(a.length>CHAT_KEEP)a=a.slice(a.length-CHAT_KEEP); st[ch]=a; return a; }
  const chatBroadcast = (o,except)=>{ const j=JSON.stringify(o); WSS.clients.forEach(c=>{ try{ if(c!==except && c.readyState===1) c.send(j); }catch(e){} }); };
  WSS.on('connection', ws=>{
    ws.on('message', raw=>{ let m; try{ m=JSON.parse(raw.toString()); }catch(e){ return; }
      if(m.t==='host'){ const c=roomCode(); rooms[c]={host:ws,guest:null}; ws._room=c; ws._role='host'; wsend(ws,{t:'hosted',code:c}); }
      else if(m.t==='join'){ const c=(m.code||'').toUpperCase(); const r=rooms[c];
        if(!r){ wsend(ws,{t:'joinfail',reason:'no such room'}); return; }
        if(r.guest){ wsend(ws,{t:'joinfail',reason:'room full'}); return; }
        r.guest=ws; ws._room=c; ws._role='guest'; wsend(ws,{t:'joined',code:c}); wsend(r.host,{t:'peerjoined'}); }
      else if(m.t==='msg'){ const r=rooms[ws._room]; if(!r)return; wsend(ws._role==='host'?r.guest:r.host,{t:'peer',data:m.data}); }
      else if(m.t==='chatjoin'){ ws._chatName=clip(m.name,16)||'Player'; wsend(ws,{t:'chathist',world:pruneChat('world'),region:pruneChat('region')}); }
      else if(m.t==='chat'){ const ch=(m.channel==='region')?'region':'world'; const txt=clip(m.text,200); if(!txt)return; const msg={who:ws._chatName||'Player',txt,t:Date.now()};
        chatStore()[ch].push(msg); pruneChat(ch); writeDB();
        chatBroadcast({t:'chatmsg',channel:ch,who:msg.who,txt:msg.txt}, ws); }   // broadcast to everyone EXCEPT the sender (sender shows it instantly locally)
      else if(m.t==='whisper'){ const to=clip(m.to,16), txt=clip(m.text,200); if(!to||!txt)return;
        WSS.clients.forEach(c=>{ if(c!==ws && c._chatName===to && c.readyState===1){ try{ c.send(JSON.stringify({t:'whispermsg',from:ws._chatName||'Player',txt})); }catch(e){} } }); }
    });
    ws.on('close', ()=>{ const r=rooms[ws._room]; if(!r)return; wsend(ws._role==='host'?r.guest:r.host,{t:'peerleft'}); delete rooms[ws._room]; });
    ws.on('error', ()=>{});
  });
}catch(e){ console.log('⚠ live PvP (ws) unavailable — run `npm install` to enable it. Async online still works.'); }

readDB(); seed();
backupDB(); setInterval(backupDB, 60*60*1000);   // snapshot on boot, then hourly (keeps ~48)
const realAccts=Object.values(DB.users).filter(u=>!u.isNpc).length;
console.log('📁 DB file: '+DB_FILE+'  '+(DB_PERSISTENT?'(persistent ✅)':'(⚠ EPHEMERAL — accounts WILL be wiped on redeploy! Add a Railway Volume mounted at /data, or set DB_FILE to a volume path.)'));
console.log('👤 Player accounts loaded: '+realAccts);
server.listen(PORT,()=>{ console.log('🔥 Emberweave cloud server on http://localhost:'+PORT); console.log('   Seeded '+Object.keys(DB.users).filter(id=>DB.users[id].isNpc).length+' NPC cities · live PvP '+(WSS?'ON':'off')+'. Open the URL to play / install the app.'); });
