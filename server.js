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
const zlib = require('zlib');   // v252 (audit P2): text responses are compressed — the 1.7MB client ships ~10x smaller
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
/* v251 (audit P2): OPTIONAL POSTGRESQL PERSISTENCE. Set DATABASE_URL and the world state is
   UPSERTed into a transactional Postgres row on every debounced write and loaded from there at boot
   (newer of file vs PG wins by mtime stamp). The JSON file stays as a local mirror + dev fallback.
   This makes accounts survive redeploys/instance moves properly; the per-entity schema migration
   remains the pre-monetisation step (tracked). */
let PG=null, PG_READY=false, _pgWriting=false, _pgDirty=false;
let PG_BOOT_PENDING=false, _bootDirty=false, _booted=false;   // v327: nothing persists until the PG restore decision has landed
function pgInit(){ if(!process.env.DATABASE_URL) return;
  try{ const {Pool}=require('pg');
    PG=new Pool({connectionString:process.env.DATABASE_URL, ssl:process.env.PGSSL==='false'?false:{rejectUnauthorized:false}, max:3});
    console.log('🐘 PostgreSQL persistence ENABLED (DATABASE_URL set).');
  }catch(e){ console.error('⚠ DATABASE_URL set but pg unavailable ('+e.message+') — falling back to the JSON file.'); PG=null; } }
async function pgSetup(){ if(!PG) return;
  await PG.query('CREATE TABLE IF NOT EXISTS emberweave_state (id TEXT PRIMARY KEY, mtime BIGINT NOT NULL, blob TEXT NOT NULL)');
  PG_READY=true; }
async function pgLoad(){ if(!PG) return null;
  const r=await PG.query('SELECT mtime, blob FROM emberweave_state WHERE id=$1',['world']);
  if(!r.rows.length) return null;
  return { mtime:+r.rows[0].mtime, db:JSON.parse(r.rows[0].blob) }; }
function pgSave(){ if(PG_BOOT_PENDING) return;   // v327: never UPSERT the pre-restore (freshly seeded) DB over the saved world
  if(!PG||!PG_READY) return;
  if(_pgWriting){ _pgDirty=true; return; }
  _pgWriting=true; const blob=JSON.stringify(DB), mt=Date.now();
  PG.query('INSERT INTO emberweave_state (id,mtime,blob) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET mtime=$2, blob=$3',['world',mt,blob])
    .catch(e=>console.error('⚠ PG write failed:', e.message))
    .finally(()=>{ _pgWriting=false; if(_pgDirty){ _pgDirty=false; pgSave(); } }); }
function readDB(){ try{ DB = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }catch(e){ DB={users:{},byName:{},tokens:{},seeded:false}; } }
let saveTimer=null;
function writeDB(){ if(PG_BOOT_PENDING){ _bootDirty=true; return; }   // v327: see bootFinish()
  if(saveTimer)return; saveTimer=setTimeout(()=>{ saveTimer=null;
  try{ const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(DB)); fs.renameSync(tmp, DB_FILE); }   // atomic: write temp, then rename
  catch(e){ console.error('⚠ DB write failed:', e.message); }
  pgSave(); },200); }

/* ------------------------------- helpers ---------------------------------- */
function uid(){ return crypto.randomBytes(8).toString('hex'); }
function hashPass(pass, salt, iters){ return crypto.pbkdf2Sync(pass, salt, iters||60000, 32, 'sha256').toString('hex'); }
// AUDIT (26 Aug, high): 60k PBKDF2 is below current guidance. NEW password hashes use 210k iterations
// with a 16-byte salt and store their iteration count on the account; old 60k hashes keep verifying
// (u.iters undefined → 60000) and are transparently re-hashed at the next successful login.
const PBKDF2_ITERS=210000;
function makeCred(pass){ const salt=crypto.randomBytes(16).toString('hex'); return { salt, iters:PBKDF2_ITERS, hash:hashPass(pass,salt,PBKDF2_ITERS) }; }
function checkPass(u,pass){ try{ const a=Buffer.from(u.hash||'','hex'), b=Buffer.from(hashPass(pass||'',u.salt,u.iters),'hex');
  return a.length===b.length && crypto.timingSafeEqual(a,b); }catch(e){ return false; } }   // RE-AUDIT: constant-time compare
const MIN_PASS_LEN=8;   // AUDIT: 1-char passwords were accepted. New/changed passwords only — existing logins unaffected.
// RE-AUDIT (26 Aug): API CORS is no longer '*'. The game is served from the SAME origin, which
// needs no CORS at all; cross-origin callers must be listed in CORS_ORIGINS (comma-separated).
const CORS_ORIGINS=new Set((process.env.CORS_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean));
let _corsReqOrigin='';   // set per-request in the server handler
function corsHeaders(){ const h={'Content-Type':'application/json'};
  if(_corsReqOrigin && CORS_ORIGINS.has(_corsReqOrigin)){ h['Access-Control-Allow-Origin']=_corsReqOrigin; h['Vary']='Origin'; h['Access-Control-Allow-Headers']='content-type,x-token'; }
  return h; }
function send(res, code, obj){ const b=JSON.stringify(obj); res.writeHead(code,corsHeaders()); res.end(b); }
// Request bodies are byte-capped (audit: body() used to accumulate d+=c with no limit → trivial memory DoS).
// On overflow we stop reading, destroy the socket, and reject with a BODY_TOO_LARGE error that the
// api() dispatcher turns into a 413. Default cap is small; /api/save passes a larger one for cloud saves.
const BODY_MAX = +(process.env.BODY_MAX || 65536);        // 64 KB default for ordinary API calls
const BODY_MAX_SAVE = +(process.env.BODY_MAX_SAVE || 4*1024*1024);  // 4 MB for the whole-roster cloud save
function body(req, max){ max = max || BODY_MAX; return new Promise((resolve,reject)=>{
  let d='', len=0, done=false;
  req.on('data',c=>{ if(done) return; len+=c.length; if(len>max){ done=true; try{req.pause();}catch(_){} const e=new Error('body too large'); e.code='BODY_TOO_LARGE'; reject(e); return; } d+=c; });
  req.on('end',()=>{ if(done) return; done=true; try{resolve(JSON.parse(d||'{}'));}catch(e){resolve({});} });
  req.on('error',()=>{ if(!done){ done=true; resolve({}); } });
}); }
function authUser(req){ const id=lookupToken(req.headers['x-token']); return id?DB.users[id]:null; }
function pub(u){ return { id:u.id, name:u.name, rank:u.rank, coins:u.coins, team:u.team, roster:u.roster, wall:u.wall, isNpc:!!u.isNpc }; }
function profileFor(u){ return { id:u.id, name:u.name, rank:u.rank, coins:u.coins, team:u.team, roster:u.roster, wall:u.wall, lastDaily:u.lastDaily||0, email:u.email||'', guest:!!u.guest, created:u.created||0, admin:isDev(u)||undefined }; }   // admin: server-confirmed role — the client's Developer Panel gates on THIS, never a name list
// --- admin authority is an IMMUTABLE per-account ROLE, never a display name ---
// A display name is not a permission boundary (audit crit #7): anyone who registered the name
// 'phil' used to inherit admin + DB-backup download. Authority now lives in u.role==='admin'
// (or an explicit account id in ADMIN_IDS), stamped once at boot by migrateAdminRoles() below.
const ADMIN_IDS = new Set((process.env.ADMIN_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));
// v232 (audit P0-6): the anti-abuse register caps are env-tunable so the clean-checkout test
// runner can create its fixture accounts without weakening production (defaults unchanged).
const REG_PER_MIN=Math.max(1,parseInt(process.env.REG_PER_MIN||'6',10));
const REG_ACCOUNTS_PER_IP=Math.max(1,parseInt(process.env.REG_ACCOUNTS_PER_IP||'6',10));
const GLYPH_RL_PER_MIN=Math.max(1,parseInt(process.env.GLYPH_RL_PER_MIN||'60',10));
// One-time bootstrap: the accounts CURRENTLY holding these names get role:'admin' stamped on them
// at startup. After that, authority is the role — renaming, or a (impossible, names are unique)
// same-name re-register, grants nothing. (Name-based bootstrap fully removed in the 26 Aug re-audit.)
// RE-AUDIT (26 Aug): name-based bootstrap REMOVED entirely. Admin authority = the stored
// role:'admin' (already stamped on the real accounts in prod) or an explicit account id in
// ADMIN_IDS. migrateAdminRoles stamps roles from ADMIN_IDS so the grant survives env changes.
function migrateAdminRoles(){ let n=0;
  for(const id of ADMIN_IDS){ const u=DB.users[id];
    if(u && !u.isNpc && u.role!=='admin'){ u.role='admin'; n++; } }
  if(n){ console.log('🔐 stamped role:admin on '+n+' account(s) from ADMIN_IDS'); writeDB(); } }
function isDev(u){ return !!(u && !u.isNpc && (u.role==='admin' || ADMIN_IDS.has(u.id))); }
// headless/cloud DB backups: a shared secret lets an unattended job pull /api/admin/backup
// without a logged-in admin browser session. Set BACKUP_TOKEN in the deployment env to enable.
function backupTokenValid(tok){
  const want = process.env.BACKUP_TOKEN || '';
  if(!want || !tok) return false;
  try { const a=Buffer.from(String(tok)), b=Buffer.from(want); return a.length===b.length && crypto.timingSafeEqual(a,b); }
  catch(e){ return false; }
}
// --- security helpers: per-IP rate limiting, single-session, admin diamond edits ---
const _hits={};
function clientIP(req){ // AUDIT: the FIRST x-forwarded-for entry is client-suppliable (spoofs the rate
  // limiter). The LAST entry is the one appended by the trusted platform proxy (Railway) — use that.
  const xff=(req.headers['x-forwarded-for']||'').split(',').map(s=>s.trim()).filter(Boolean);
  return xff[xff.length-1] || (req.socket&&req.socket.remoteAddress) || 'unknown'; }
function rateLimited(req, key, max, windowMs){ const k=key+'|'+clientIP(req), now=Date.now();
  const arr=(_hits[k]||[]).filter(t=>now-t<windowMs); arr.push(now); _hits[k]=arr; return arr.length>max; }
// AUDIT (26 Aug, high): session tokens are no longer stored in plaintext. DB.tokens is keyed by
// sha256(rawToken) with {id, iat, exp} metadata; the raw value exists only in the client. Tokens
// expire after TOKEN_TTL_MS (default 90 days) with sliding renewal at half-life. Legacy plaintext
// entries are hashed once at boot — existing sessions keep working (their raw token hashes to the
// migrated key).
const TOKEN_TTL_MS=+(process.env.TOKEN_TTL_MS||90*86400000);
function tokHash(t){ return crypto.createHash('sha256').update(String(t)).digest('hex'); }
/* v273: a session that a player is holding must survive a crash — a token created seconds before a
   restart used to disappear with the debounced write, logging them out and, for a new account,
   losing the account itself. Issuing a token is rare; make it durable. */
function issueToken(id){ const raw=uid()+uid(); DB.tokens[tokHash(raw)]={id, iat:Date.now(), exp:Date.now()+TOKEN_TTL_MS}; writeDBNow(); return raw; }
function lookupToken(raw){ if(!raw) return null; const e=DB.tokens[tokHash(raw)]||DB.tokens[raw];
  if(!e) return null;
  if(typeof e==='string') return e;                              // pre-migration straggler
  if(e.exp && Date.now()>e.exp){ delete DB.tokens[tokHash(raw)]; writeDB(); return null; }
  if(e.exp && e.exp-Date.now()<TOKEN_TTL_MS/2){ e.exp=Date.now()+TOKEN_TTL_MS; writeDB(); }   // sliding renewal
  return e.id; }
function tokOwner(v){ return typeof v==='string'?v:(v&&v.id); }
function dropTokens(id){ for(const t of Object.keys(DB.tokens)){ if(tokOwner(DB.tokens[t])===id) delete DB.tokens[t]; } }   // single-session / force re-login
function migrateTokenHashes(){ let n=0;
  for(const k of Object.keys(DB.tokens)){ const v=DB.tokens[k];
    if(typeof v==='string'){ DB.tokens[tokHash(k)]={id:v, iat:Date.now(), exp:Date.now()+TOKEN_TTL_MS}; delete DB.tokens[k]; n++; } }
  if(n){ console.log('🔐 hashed '+n+' plaintext session token(s) — raw values now live only on clients'); writeDB(); } }
function adjustGems(u, delta){ try{
  /* THE LEDGER IS THE BALANCE. Editing the save blob was a silent no-op for every migrated account:
     sanitizeSave deletes 'gems' (SERVER_OWNED_SAVE_FIELDS) out of the stored save on the player's next
     /api/save, and ensureLedger returns early for a migrated account so the poked number is never read
     back. The dev saw a confirmed new balance the player never received. Move led.gems instead, through
     ledTx so it is audited, rev-bumped and written synchronously. The blob path below is kept for
     accounts that are genuinely not on the ledger yet — for those it is still the real balance. */
  if(u && u.led && u.led.migratedAt){ const led=ensureLedger(u); const before=led.gems|0;
    led.gems=Math.max(0,Math.min(ECON_CAP.gems, before+delta));
    ledTx(u, delta>=0?'admin:grant':'admin:take', {gems:led.gems-before});
    u.econ={gems:led.gems, gold:led.gold|0, t:Date.now()}; return led.gems; }
  if(!u.roster||typeof u.roster.__save!=='string') return null;
  const g=JSON.parse(u.roster.__save); g.gems=Math.max(0,(g.gems||0)+delta); g.mtime=Date.now();
  u.roster.__save=JSON.stringify(g); u.econ={gems:g.gems||0,gold:g.gold||0,t:Date.now()}; return g.gems; }catch(e){ return null; } }
// ---- anti-tamper: the economy is client-side, so the server can't fully trust a save. It CAN reject the impossible:
//      clamp values no legitimate player can reach (undoing "set my diamonds to 2 billion"), and FLAG (never block, to
//      avoid false positives) implausible single-save jumps so a dev can investigate. Not a full server-authoritative
//      economy — that's the pre-real-money rewrite — but it stops casual console cheating cold. ----
const ECON_CAP={ gems:5000000, gold:2000000000, stamina:100000, arenaCoins:50000000, guildCoins:50000000, playerXP:100000000, gemFrac:1000000 };
const MAP_CAP=10000000, GEM_SPIKE=200000, GOLD_SPIKE=200000000;
/* Everything on this list is decided by the server ledger. None of it is stored from a client save. */
const SERVER_OWNED_SAVE_FIELDS=Object.freeze(['gold','gems','playerXP','heroXP','starLevel','starPip',
  'starRefine','heroFrag','heroFrags','unlocked','stamina','campaignCleared','stageStars','tech',
  'techLearn','skillLevel','dust','starShards','eqMats','mats',
  /* 28 Aug — 'prayer' and 'arenaCoins' were REMOVED from this list. Deleting a field only makes
     sense when the ledger holds the real value. The server has no led.arenaCoins at all, and never
     writes led.prayer after the one-time import, so stripping them from the save destroyed progress
     the player had legitimately paid for and handed back nothing. They stay in the save (still
     clamped by ECON_CAP) until they are properly server-owned. 'guildCoins' DOES live on the ledger
     and is now read back by the client, so it stays stripped. */
  'guildCoins',
  /* v274 (hardening directive §2.4): gear and equipment too. The Forge (u.gear) is server-owned and
     the legacy equip bundle no longer reaches combat, so there is no reason to keep either in a blob
     the client writes. */
  /* 31 Aug — 'equip' and 'eqInv' are BACK OFF this list. Stripping a field only makes sense when the
     ledger holds the real value, and it never did: ledgerView returns no equip/eqInv and adoptLedger
     reads none, so every crafted piece was deleted on the next load. Since /api/eq/craft now debits
     real ledger materials for a Tier-0 craft, the player was PAYING for items the server then threw
     away. equipMul() returns zeros for any signed-in account, so a forged local inventory still buys
     no combat power — the blob is display/inventory storage only, and eqInv is MAP_CAP-clamped below. */
  'gear','gearFrag','temper','equipped','active']);
function clampNum(v,cap){ if(typeof v!=='number'||!isFinite(v)) return v; if(v<0) return 0; if(v>cap) return cap; return v; }
function sanitizeSave(u, roster){
  if(!roster || typeof roster.__save!=='string') return roster;
  let g; try{ g=JSON.parse(roster.__save); }catch(e){ return roster; }   // unparseable → store as-is, nothing to validate
  let clamped=false;
  for(const k in ECON_CAP){ if(typeof g[k]==='number'){ const nv=clampNum(g[k],ECON_CAP[k]); if(nv!==g[k]){ g[k]=nv; clamped=true; } } }
  for(const map of ['mats','eqMats','starShards','heroFrag','glyphRank','eqInv']){ const o=g[map]; if(o&&typeof o==='object'){ for(const k in o){ if(typeof o[k]==='number'){ const nv=clampNum(o[k],MAP_CAP); if(nv!==o[k]){ o[k]=nv; clamped=true; } } } } }
  const prev=u.econ||{}, now=Date.now(); const dGems=(g.gems||0)-(prev.gems||0), dGold=(g.gold||0)-(prev.gold||0);
  let reason=null;
  if(clamped) reason='impossible value clamped';
  else if(prev.gems!=null && dGems>GEM_SPIKE) reason='diamond spike (+'+dGems+')';
  else if(prev.gold!=null && dGold>GOLD_SPIKE) reason='gold spike (+'+dGold+')';
  if(reason){ u.flag={ reason, t:now, gems:g.gems||0, gold:g.gold||0 }; console.log('⚠ integrity flag — '+u.name+': '+reason); }
  u.econ={ gems:g.gems||0, gold:g.gold||0, t:now };
  // GLYPH v2 (spec §9.3): once an account is migrated, legacy glyph fields in the uploaded save are
  // stripped and noted — the server copy is the only glyph truth from then on.
  if(u.glyphs && u.glyphs.migratedAt){ let strip=false;
    for(const k of ['glyphInv','glyphRank','glyphCur','glyphLocked']){ if(g[k]!==undefined){ delete g[k]; strip=true; } }
    if(strip){ glyphAudit(u.glyphs,'stripSave',{}); } }
  /* v273 (audit response P0) — THE LEDGER OWNS PROGRESSION, SO THE BLOB DOES NOT KEEP IT.
     Clamping a forged number is not authority: a forged value under the cap is still forged. Once an
     account is on the ledger, every server-owned field is DELETED from the stored save, so there is
     nothing left in it for the server to be fooled by and nothing for a migration to pick up later.
     The browser may keep its own copy for offline display; this is only what we agree to store. */
  if(u.led && u.led.migratedAt){
    for(const k of SERVER_OWNED_SAVE_FIELDS){ if(g[k]!==undefined) delete g[k]; }
  }
  roster.__save=JSON.stringify(g); return roster; }
// rotating hourly DB backups (kept alongside the db file)
function backupDB(){ try{ const dir=path.join(path.dirname(DB_FILE),'backups'); fs.mkdirSync(dir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-'); fs.writeFileSync(path.join(dir,'db-'+stamp+'.json'), JSON.stringify(DB));
  const files=fs.readdirSync(dir).filter(f=>f.startsWith('db-')).sort(); while(files.length>48){ try{ fs.unlinkSync(path.join(dir,files.shift())); }catch(e){} }
}catch(e){ console.error('⚠ backup failed:', e.message); } }

// off-site backup: push the whole DB to a private GitHub repo.
// Enabled only when GITHUB_BACKUP_TOKEN and GITHUB_BACKUP_REPO ("owner/repo") are both set.
async function pushBackupToGitHub(){
  const token=process.env.GITHUB_BACKUP_TOKEN, repo=process.env.GITHUB_BACKUP_REPO;
  if(!token || !repo) return;
  try{
    const iso=new Date().toISOString();
    const ts=iso.slice(0,10)+'_'+iso.slice(11,13)+iso.slice(14,16); // YYYY-MM-DD_HHMM (UTC)
    const relPath='Player Data Backups/emberweave-playerdata-'+ts+'.json';
    const body=JSON.stringify(DB);
    const res=await fetch('https://api.github.com/repos/'+repo+'/contents/'+encodeURI(relPath), {
      method:'PUT',
      headers:{ 'Authorization':'Bearer '+token, 'Accept':'application/vnd.github+json',
                'User-Agent':'emberweave-backup', 'X-GitHub-Api-Version':'2022-11-28' },
      body:JSON.stringify({ message:'backup '+ts+' UTC', content:Buffer.from(body).toString('base64'), branch:'main' })
    });
    if(res.ok){ console.log('☁ off-site backup pushed: '+relPath+' ('+body.length+' bytes)'); }
    else { const t=await res.text().catch(()=>''); console.error('⚠ github backup failed '+res.status+': '+t.slice(0,200)); }
  }catch(e){ console.error('⚠ github backup error:', e.message); }
}
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

const HERO_KEYS=['konwu','grosk','vulmar','tick','sylthaine','aureth','bloatus','vireo','fritz'];
function defaultTeam(){ return [ {key:'konwu',level:1,rank:0},{key:'grosk',level:1,rank:0},{key:'vulmar',level:1,rank:0} ]; }

/* --------------------------- NPC / world seeding -------------------------- */
const NPC_NAMES=['Ironhold','Stormgate','Ashvale','Highcliff','Duskmere','Ravenspire','Frostholm','Emberton','Wolfden','Goldreach','Thornwick','Mistfall','Grimwater','Sunspear','Blackmoor','Oakenshield','Redkeep','Silverbrook','Winterfell','Stonehaven','Bramblewood','Nightvale','Dawnkeep','Shadowfen','Windmere','Coldharbor','Firebrand','Greymarch','Hollowreach','Larkspur','Direhold','Kingsmoor','Valebright','Ashenford','Cragmaw','Elmsworth','Ferncove','Gale’s Rest','Hearthglen','Ivywatch'];
function randTeam(power){ const pool=HERO_KEYS.slice(), t=[], n=Math.min(5,pool.length);
  for(let i=0;i<n;i++){ const idx=Math.floor(Math.random()*pool.length); const key=pool.splice(idx,1)[0];   // splice => never repeats a hero
    t.push({ key, level:1+Math.floor(power*0.6+Math.random()*power*0.4), rank:Math.min(3,Math.floor(power/6)) }); }
  return t; }
const BOT_FIRST=['Ash','Storm','Iron','Frost','Dusk','Dawn','Grim','Raven','Wolf','Gold','Thorn','Mist','Grey','Sun','Black','Oak','Red','Silver','Winter','Stone','Bramble','Night','Shadow','Wind','Cold','Fire','Hollow','Lark','Dire','King','Vale','Fern','Crag','Elm','Gale','Hearth','Ivy','Bright','Pale','Swift'];
const BOT_LAST=['caller','hand','blade','heart','born','breaker','fell','wood','scar','bane','mark','guard','watch','reach','moor','vale','crest','fall','wind','forge','claw','fang','song','veil','thorn','ridge','holt','mere','gate','spire'];
function botName(i){ const n=BOT_FIRST[i%BOT_FIRST.length]+BOT_LAST[Math.floor(i/BOT_FIRST.length)%BOT_LAST.length]; return (i>=BOT_FIRST.length*BOT_LAST.length)? n+' '+(i+1) : n; }
const BOT_COUNT=5000, SEED_VERSION=3;
function seed(){
  if(DB.seedVersion===SEED_VERSION) return;
  const bots=Object.values(DB.users).filter(u=>u.isNpc);
  if(bots.length>=BOT_COUNT){
    // upgrade in place: regenerate every bot's team (distinct heroes) but KEEP ranks & players intact
    for(const u of bots){ const r=Math.max(1,Math.min(BOT_COUNT,u.rank||2500)); const power=Math.max(1, Math.round(20-(r/BOT_COUNT)*18)); u.team=randTeam(power); if(u.wall)u.wall=randTeam(power); }
    DB.seedVersion=SEED_VERSION; writeDB(); return;
  }
  // fresh seed: 5000 bots fill ranks 1..5000 (rank 1 = strongest); players inherit 5001, 5002, ...
  for(const id of Object.keys(DB.users)){ if(DB.users[id] && DB.users[id].isNpc) delete DB.users[id]; }
  for(let r=1;r<=BOT_COUNT;r++){ const i=r-1; const power=Math.max(1, Math.round(20 - (r/BOT_COUNT)*18));
    DB.users['bot_'+i]={ id:'bot_'+i, name:botName(i), isNpc:true, rank:r, coins:0, team:randTeam(power),
      cityX:Math.round(Math.random()*1000), cityY:Math.round(Math.random()*1000), created:0 };
  }
  const reals=Object.values(DB.users).filter(u=>!u.isNpc).sort((a,b)=>(a.created||0)-(b.created||0));
  reals.forEach((u,i)=>{ u.rank=BOT_COUNT+1+i; });
  DB.seeded=true; DB.seedVersion=SEED_VERSION; writeDB();
}
// the next open rank a newly-registered player inherits (just below the 5000 bots)
function nextJoinRank(){ const occ=new Set(Object.values(DB.users).map(u=>u.rank)); let r=BOT_COUNT+1; while(occ.has(r)) r++; return r; }

/* ------------------------------ ladder logic ------------------------------ */
function allUsersByRank(){ return Object.values(DB.users).sort((a,b)=>a.rank-b.rank); }
/* v272 (full-game audit): the account's REAL power, derived from the ledger alone. `me.team` is a
   client-authored array — /api/save takes it verbatim — so anything that PAYS OUT must never read a
   level or rank out of it. This reads the roster keys only, and takes every stat from the ledger. */
/* A stored line-up is a list of hero keys and nothing else. No level, no rank, no stats — those are
   the ledger's to say. Capped at five so a client cannot grow the record without bound. */
/* v327 — A STORED ROSTER LINE IS AN OBJECT, NOT A KEY. defaultTeam():259, sanitizeRoster() below
   and randTeam():262 all write {key,...}, so anything that indexes led.unlocked / SIM.HERO_BASE with
   a roster entry silently reads undefined. Every such call site goes through here. */
function rosterKeys(arr){
  const out=[], seen={}; const src=Array.isArray(arr)?arr:[];
  for(let i=0;i<src.length;i++){ const h=src[i];
    const key=(h&&typeof h==='object')?String(h.key||''):String(h||'');
    if(!key || !SIM.HERO_BASE[key] || seen[key]) continue;
    seen[key]=1; out.push(key); }
  return out;
}
/* A ladder bot has NO ledger and must never be given one: snapshotHeroFromServer() calls
   ensureLedger(), which would write a ledger onto all 5,000 seeded NPCs and resolve every one of
   their heroes at level 1 — turning "arena is unwinnable" into "arena is a free win at every rank".
   A bot's strength lives on its seeded roster entry ({key,level,rank}), so read it from there. */
function snapshotNpcHero(entry){
  try{
    const key=(entry&&typeof entry==='object')?String(entry.key||''):String(entry||'');
    const base=SIM.HERO_BASE[key]; if(!base) return null;
    const lvl=Math.max(1,Math.min(200,((entry&&entry.level)|0)||1));
    const pips=Math.max(0,Math.min(5,((entry&&entry.rank)|0)||0));
    return SIM.heroCombatStats(key,{level:lvl, stars:base.stars, pips:pips});
  }catch(e){ return null; }
}
function sanitizeRoster(arr){
  const out=[]; const seen=new Set();
  for(const h of (Array.isArray(arr)?arr.slice(0,10):[])){
    const key=(h&&typeof h==='object')?String(h.key||''):String(h||'');
    if(!key || !SIM.HERO_BASE[key] || seen.has(key)) continue;
    seen.add(key); out.push({key});
    if(out.length>=5) break;
  }
  return out;
}
function ledgerTeamPower(u){
  const led=ensureLedger(u);
  const keys=Array.isArray(u.team)?u.team.map(h=>h&&h.key).filter(k=>k&&led.unlocked[k]).slice(0,5):[];
  const use=keys.length?keys:Object.keys(led.unlocked).slice(0,5);
  let p=0;
  for(const k of use){
    const h=led.hero[k]; if(!h) continue;
    const lvl=ledHeroLevel(led,k);
    const base=SIM.HERO_BASE[k]||{stars:1};
    const stars=Math.max(base.stars||1, Math.min(5, h.stars|0));
    p += lvl*14 + stars*70 + 60;
    if(u.glyphs) p += glyphHeroPower(u,k);
    if(u.gear) p += gearHeroPower(u,k);
  }
  return Math.round(p);
}
/* v328 — A STORED ROSTER LINE HAS NO LEVEL AND NO RANK. sanitizeRoster():337 writes bare {key}, so
   every `h.level`/`h.rank` read off a REAL player's team is undefined and their power collapses to a
   flat 370 (5 x 60) — leaderboards, world-map cities, guild strength and, worst, the guild-war duel
   roll at 3921. Rehydrate from the ledger, the same source ledgerTeamPower():347 already trusts.
   Untouched: NPC bots (their seeded roster really does carry {key,level,rank}) and any account with
   no ledger yet — never call ensureLedger() from here, this runs on read paths (up to 500 users per
   /api/world/cities) and ensureLedger CREATES and persists a ledger. */
function hydrateRoster(u, arr){
  const src=Array.isArray(arr)?arr:[];
  if(!u || u.isNpc || !u.led || !u.led.hero) return src;
  const led=u.led, unl=led.unlocked||{};
  let use=rosterKeys(src).filter(function(k){ return !!unl[k]; }).slice(0,5);
  if(!use.length) use=Object.keys(unl).filter(function(k){ return unl[k] && Object.prototype.hasOwnProperty.call(SIM.HERO_BASE,k); }).slice(0,5);
  const out=[];
  for(let i=0;i<use.length;i++){ const k=use[i], h=led.hero[k]||{}, base=SIM.HERO_BASE[k]||{stars:1};
    out.push({ key:k, level:ledHeroLevel(led,k)||1, rank:Math.max(base.stars||1, Math.min(5, h.stars|0)) }); }
  return out;
}
function serverTeamPower(team, owner){ if(!Array.isArray(team))return 0; team=hydrateRoster(owner, team); let p=0; for(const h of team){ p += (h.level||1)*14 + (h.rank||0)*70 + 60; if(owner&&owner.glyphs) p += glyphHeroPower(owner, h.key); if(owner&&owner.gear) p += gearHeroPower(owner, h.key); } return Math.round(p); }
/* ==================== GLYPH ASCENSION v2 — server-authoritative ====================
   The browser NEVER computes a craft result, passive value, socket result, or promotion.
   Catalog: server/glyph-source.json (218 finished-glyph definitions). Recipes are compiled
   from recipeText at startup — an unknown token is a STARTUP ERROR, not a runtime surprise.
   LIVE FOR EVERYONE since 26 Aug (Phil: "implement the glyph system and strip the last one") —
   the legacy client glyph system is deleted; v2 is the only glyph system. GLYPHS_V2_ENABLED=false
   in the env can still force it off in an emergency (default is now ON).
   Optimistic concurrency: every mutation carries expectedRevision; mismatch → 409 STALE. */
const GLYPHS_V2_ENABLED = String(process.env.GLYPHS_V2_ENABLED||'true')==='true';
// CANONICAL 16-step ladder (Correction Spec v1): the ONLY quality model. Frozen; every label,
// lock, gate and recipe tier derives from an index into this. Grey +1 / Blue +3 do not exist.
const GLYPH_LADDER=Object.freeze(['Grey','Green','Green +1','Blue','Blue +1','Blue +2','Purple','Purple +1','Purple +2','Purple +3','Gold','Gold +1','Gold +2','Gold +3','Gold +4','Orange']);
const GLYPH_MAX_ASC = GLYPH_LADDER.length; // ascensionIndex 16 = fully ascended
/* v258 — Launch Progression Blueprint v1 §"Exact Glyph ascension path and level gates".
   A GLYPH TIER HAS A MINIMUM HERO LEVEL; a level-15 hero can never wear Gold. Player Level unlocks
   the hero-level ceiling, it never grants a quality for free. Index matches GLYPH_LADDER exactly. */
const GLYPH_MIN_LEVEL=Object.freeze([1,7,13,18,24,30,36,43,50,57,65,72,79,86,93,100]);
function glyphLevelGate(i){ return GLYPH_MIN_LEVEL[Math.max(0,Math.min(GLYPH_MIN_LEVEL.length-1,i|0))]|0; }
const GLYPH_FAMS=Object.freeze(['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye','Lifebloom']);
let GLYPH_TIER_FAMS={};   // filled by glyphCompile: quality -> families that exist at that tier
function glyphTierFams(q){ return (GLYPH_TIER_FAMS&&GLYPH_TIER_FAMS[q]&&GLYPH_TIER_FAMS[q].length)?GLYPH_TIER_FAMS[q]:GLYPH_FAMS; }
const glyphFragSlug=k=>k.toLowerCase().replace(/\s*\+\s*/g,'-plus-').replace(/\s+/g,'-');
const GLYPH_SLOTS=['vitality','bulwark','onslaught','spirit','tempo','mastery'];
// which material families each board slot accepts (data-driven; per-role overrides seed later)
const GLYPH_SLOT_FAMILIES={
  vitality:['Stoneheart','Worldheart'],
  bulwark:['Ironwall','Veilward','Bastion','Dawnshield'],
  onslaught:['Ravager','Sunder','Cataclysm'],
  spirit:['Starfire','Voidbind','Keenmind'],
  tempo:['Windstep','Shadepath','Tidecall'],
  mastery:['Hawkeye','Lifebloom','Bloodroot']
};
// AUDIT (26 Aug): role board templates SEEDED. Boards stay universal (any hero may run any slot's
// base families — a Marksman can absolutely take a Vitality survival glyph); a role's signature slot
// additionally accepts its natural off-slot families. STRICT SUPERSETS of the universal lists only —
// an override must never restrict, or already-socketed boards would turn illegal retroactively.
const GLYPH_ROLE_OVERRIDES={ // heroRole (sim HERO_BASE vocabulary) -> {slotName:[families]}
  'Tank':     { bulwark:['Ironwall','Veilward','Bastion','Dawnshield','Stoneheart','Worldheart'],
                spirit:['Starfire','Voidbind','Keenmind','Bastion','Worldheart'] },
  'Bruiser':  { onslaught:['Ravager','Sunder','Cataclysm','Bloodroot'], spirit:['Starfire','Voidbind','Keenmind','Sunder','Hawkeye'] },
  'Fighter':  { onslaught:['Ravager','Sunder','Cataclysm','Hawkeye'], spirit:['Starfire','Voidbind','Keenmind','Sunder','Hawkeye'] },
  'Assassin': { tempo:['Windstep','Shadepath','Tidecall','Sunder'], spirit:['Starfire','Voidbind','Keenmind','Sunder','Hawkeye'] },
  // 27 Aug (Phil): casters/supports must never be FORCED into melee/armor-pen families — their
  // offensive slots additionally accept caster families (AP/magic pen, healing, energy). Supersets.
  'Mage':     { spirit:['Starfire','Voidbind','Keenmind','Cataclysm'],
                onslaught:['Ravager','Sunder','Cataclysm','Starfire','Voidbind','Keenmind'],
                mastery:['Hawkeye','Lifebloom','Bloodroot','Keenmind','Voidbind'] },
  'Marksman': { mastery:['Hawkeye','Lifebloom','Bloodroot','Sunder'], spirit:['Starfire','Voidbind','Keenmind','Sunder','Hawkeye'] },
  'Support':  { vitality:['Stoneheart','Worldheart','Lifebloom'],
                onslaught:['Ravager','Sunder','Cataclysm','Starfire','Lifebloom','Tidecall'],
                mastery:['Hawkeye','Lifebloom','Bloodroot','Tidecall','Keenmind'] }
};
let GLYPHS=null;
function glyphCompile(){
  const file=path.join(__dirname,'server','glyph-source.json');
  let txt=null; try{ txt=fs.readFileSync(file,'utf8'); }catch(e){
    // AUDIT v229 (P0): the Glyph catalog is REQUIRED — a deployment without it must FAIL, not
    // silently ship with the feature off. ALLOW_DEGRADED=1 is for local experiments only.
    console.error('✖ FATAL — server/glyph-source.json is missing ('+e.message+'). Deploy the catalog with the server.');
    if(process.env.ALLOW_DEGRADED!=='1') process.exit(1);
    GLYPHS=null; return; }
  const raw=JSON.parse(txt);   // present-but-corrupt STILL fails startup, by design (spec: unknown token = startup error)
  if(!Array.isArray(raw)||raw.length!==218) throw new Error('glyph-source.json: expected 218 definitions, got '+(raw&&raw.length));
  const byId={}, byName={};
  for(const d of raw){ if(byId[d.id]) throw new Error('duplicate glyph id '+d.id); byId[d.id]=d; byName[d.name]=d; }
  GLYPH_TIER_FAMS={};   // quality -> the families that EXIST at that tier (drives every drop rotation)
  const FRAG=/^(\d+)\s*[×x]\s*(.+?)\s+Fragments$/;
  for(const d of raw){
    const m=/(\w+)\s+(Glyph|Core|Crown)$/.exec(d.name); if(!m) throw new Error('glyph name unparsable: '+d.name);
    d.family=m[1];
    d.qi=GLYPH_LADDER.indexOf(d.quality); if(d.qi<0) throw new Error('glyph quality unknown: '+d.quality+' ('+d.id+')');
    d.stats=(d.passiveStats||'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>{
      const mm=/^(.+?)\s*\+([\d.]+)(%?)$/.exec(s); if(!mm) throw new Error('glyph passive unparsable: '+d.id+' "'+s+'"');
      return { stat:mm[1], val:+mm[2], pct:mm[3]==='%' };
    });
    d.ing=[];
    for(const part of d.recipeText.split(' + ').map(s=>s.trim())){
      const fm=FRAG.exec(part);
      if(fm){ d.ing.push({kind:'frag', key:fm[2], qty:+fm[1]}); continue; }
      if(/Sub-Glyph$/.test(part)){ d.ing.push({kind:'sub', key:part, qty:1}); continue; }
      const ref=byName[part]; if(!ref) throw new Error('glyph recipe token unknown: "'+part+'" in '+d.id);
      d.ing.push({kind:'finished', defId:ref.id, qty:1});
    }
  }
  // derived Sub-Glyph recipes (tunable): plain=3 / Superior=4 / Rare=5 / Mythic=6 same-(quality,family)
  // fragments; Worldfire subs draw Orange fragments and ALSO need 2× Gold +4 fragments (the "Gold+4 history").
  // Census the Gold +4 families BEFORE deriving sub recipes: GLYPH_TIER_FAMS is not built until
  // after this loop, so the loop cannot otherwise tell that a family is absent at that tier.
  const goldPlus4Fams={}; for(const d of raw){ if(d.quality==='Gold +4') goldPlus4Fams[d.family]=1; }
  const subs={};
  for(const d of raw){ for(const g of d.ing){ if(g.kind==='sub' && !subs[g.key]){
    const mm=/^(?:(Rare|Superior|Mythic)\s+)?(.+?)\s+(\w+)\s+Sub-Glyph$/.exec(g.key);
    if(!mm) throw new Error('sub-glyph name unparsable: '+g.key);
    const prefix=mm[1]||'', qual=mm[2], fam=mm[3];
    const fragQual = qual==='Worldfire' ? 'Orange' : qual;
    if(qual!=='Worldfire' && GLYPH_LADDER.indexOf(qual)<0) throw new Error('sub-glyph quality unknown: '+g.key);
    const n={'':3,'Superior':4,'Rare':5,'Mythic':6}[prefix];
    const ing=[{kind:'frag', key:fragQual+' '+fam, qty:n}];
    if(qual==='Worldfire'){ if(goldPlus4Fams[fam]) ing.push({kind:'frag', key:'Gold +4 '+fam, qty:2});
      else ing[0].qty+=2; }   // Orange-only family (Worldheart/Cataclysm) has no Gold +4 tier — charge the shortfall in Orange
    subs[g.key]={ key:g.key, ing };
  } } }
  for(const d of raw){ const l=(GLYPH_TIER_FAMS[d.quality]=GLYPH_TIER_FAMS[d.quality]||[]); if(!l.includes(d.family)) l.push(d.family); }
  // canonical order: the 8 base families first (Stoneheart leads — stage 1-1 stays Stoneheart),
  // then the tier's extended families alphabetically
  for(const q in GLYPH_TIER_FAMS){ const l=GLYPH_TIER_FAMS[q];
    GLYPH_TIER_FAMS[q]=[...GLYPH_FAMS.filter(f=>l.includes(f)), ...l.filter(f=>!GLYPH_FAMS.includes(f)).sort()]; }
  GLYPHS={ raw, byId, byName, subs, version:1 };
  console.log('🔮 Glyph catalog compiled: '+raw.length+' definitions, '+Object.keys(subs).length+' sub-glyph recipes. v2 '+(GLYPHS_V2_ENABLED?'ENABLED':'off (dev-only)'));
}
glyphCompile();
// A definition whose expanded lineage needs a fragment key no tier can drop is unforgeable —
// glyphPreChoice silently filters it out and its drops become dead loot. Surface it at boot.
try{ if(GLYPHS){ const dead=GLYPHS.raw.filter(d=>!glyphSupplyOK(d)); if(dead.length) console.error('✖ unfarmable glyph definitions: '+dead.map(d=>d.id+' '+d.name).join(', ')); } }catch(e){}
function glyphsEnabledFor(u){ return GLYPHS_V2_ENABLED || isDev(u); }
function ensureGlyphs(u){ if(!u.glyphs) u.glyphs={ revision:1, fragments:{}, subGlyphs:{}, finished:{}, boards:{}, audit:[], seq:1 }; return u.glyphs; }
function glyphAudit(g,op,extra){ g.audit.push(Object.assign({t:Date.now(),op},extra||{})); if(g.audit.length>100)g.audit=g.audit.slice(-100); }
function glyphBoard(g,hero){ if(!g.boards[hero]) g.boards[hero]={ slots:[null,null,null,null,null,null], ascensionIndex:0, ascended:{} }; return g.boards[hero]; }
/* v232 (Phil): every board slot has EXACTLY ONE pre-chosen glyph per hero — no option lists.
   The choice is deterministic from the hero's role (and healer flag), a per-slot ordered family
   preference, and the current board quality; physical heroes get physical damage growth, casters
   get AP/magic-pen/energy, supports/healers get healing/energy — HP/defense stay universal. */
const GLYPH_PREF={
  vitality:{ _:['Stoneheart','Worldheart'] },
  bulwark:{ Tank:['Ironwall','Bastion','Dawnshield','Veilward'], Mage:['Veilward','Ironwall','Dawnshield'],
            Support:['Veilward','Ironwall','Dawnshield'], _:['Ironwall','Veilward','Bastion','Dawnshield'] },
  onslaught:{ Mage:['Starfire','Voidbind','Keenmind','Cataclysm'], 'Support:healer':['Lifebloom','Tidecall','Starfire'],
              Support:['Starfire','Tidecall','Lifebloom'], _:['Ravager','Sunder','Cataclysm'] },
  spirit:{ Mage:['Starfire','Voidbind','Keenmind'], 'Support:healer':['Tidecall','Starfire','Keenmind'],
           Support:['Starfire','Keenmind','Voidbind'], Tank:['Bastion','Worldheart','Keenmind'],
           _:['Sunder','Hawkeye','Keenmind','Starfire'] },
  tempo:{ Assassin:['Shadepath','Sunder','Windstep'], Mage:['Windstep','Tidecall','Shadepath'],
          'Support:healer':['Tidecall','Windstep','Shadepath'], Support:['Windstep','Tidecall','Shadepath'],
          Tank:['Windstep','Tidecall','Shadepath'], _:['Shadepath','Windstep','Tidecall'] },
  mastery:{ Mage:['Keenmind','Voidbind','Hawkeye'], 'Support:healer':['Lifebloom','Tidecall','Keenmind'],
            Support:['Tidecall','Lifebloom','Keenmind'], Tank:['Bloodroot','Lifebloom','Hawkeye'],
            Marksman:['Hawkeye','Sunder','Bloodroot'], _:['Hawkeye','Bloodroot','Lifebloom'] }
};
// A pre-choice must be FARMABLE all the way down: every fragment its full expanded lineage needs
// (including every Sub-Glyph's ingredients) must belong to a family the game actually drops
// (campaign/vault/arena/daily/pool all draw from GLYPH_FAMS). Otherwise a slot could demand a
// fragment no stage awards — a dead end. (Ancestry-tree work, 27 Aug.)
function glyphSupplyOK(def){ try{
  const ex=g2ExpandIngredients(def);
  const keys=Object.keys(ex.frags);
  for(const sk in ex.subs){ const sd=GLYPHS.subs[sk]; if(!sd) return false; for(const i of sd.ing) keys.push(i.key); }
  return keys.every(k=>{ const q=k.slice(0,k.lastIndexOf(' ')), f=k.slice(k.lastIndexOf(' ')+1);
    return glyphTierFams(q).includes(f); });
}catch(e){ return false; } }
function glyphPreChoice(heroKey, slotIdx, qi){
  const hb=SIM.HERO_BASE[heroKey]||{}; const role=hb.role||'Fighter'; const healer=!!hb.healer;
  const slot=GLYPH_SLOTS[slotIdx]; const tbl=GLYPH_PREF[slot]||{};
  const prefs=(healer&&tbl[role+':healer'])||tbl[role]||tbl._||GLYPH_SLOT_FAMILIES[slot]||[];
  const pick=fams=>{ for(const fam of fams){
    const cands=GLYPHS.raw.filter(d=>d.qi===qi&&d.family===fam&&glyphAllowed(slotIdx,d,role)&&glyphSupplyOK(d)).sort((a,b)=>a.id<b.id?-1:1);
    if(cands.length) return cands[0]; } return null; };
  return pick(prefs) || pick(GLYPH_SLOT_FAMILIES[slot]||[]) ||
    GLYPHS.raw.filter(d=>d.qi===qi&&glyphAllowed(slotIdx,d,role)&&glyphSupplyOK(d)).sort((a,b)=>a.id<b.id?-1:1)[0] ||
    GLYPHS.raw.filter(d=>d.qi===qi&&glyphAllowed(slotIdx,d,role)).sort((a,b)=>a.id<b.id?-1:1)[0] || null;
}
/* ---- Glyph Ancestry Tree (spec 27 Aug): the server derives the FULL canonical build lineage
   of a slot's one pre-chosen glyph — finished glyph at the root, virtual predecessor glyphs and
   Sub-Glyphs as branches, named fragments as the leaves. Purely a read model: nothing here (and
   no client allocation) ever creates a loose Sub-Glyph or finished-glyph item. ---- */
function glyphTreeLeaf(g, key, qty){ return { kind:'fragment', key, fragmentId:glyphFragSlug(key),
  displayName:key+' Fragment', need:qty, have:(g.fragments[key]|0),
  sources:portalSourcesFor(key) }; }
/* AUDIT (glyph-tree-cost): every `finished` ingredient used to be re-expanded IN FULL wherever it
   appeared. Measured on the live catalog the worst root (R16-18 Worldfire Cataclysm Crown) reaches
   6,514 nodes at depth 10 — roughly 1 MB of JSON per slot tap, and the client fetches this once per
   empty slot. The walk is now bounded by a depth limit AND a node budget; anything past the bound is
   emitted as a normal-shaped childless node with truncated:true, so an OLD CACHED CLIENT renders it
   as a plain leaf glyph rather than breaking. 190 of 218 roots are unchanged; the worst drops to ~912
   nodes. The BUILD COST is untouched: `totals` / `canBuild` come from g2BuildCost(), which still
   expands the whole lineage. The depth cap also makes a cyclic recipe terminate. */
const GLYPH_TREE_MAX_DEPTH=6, GLYPH_TREE_MAX_NODES=900;
function glyphTreeStub(def){ return { kind:'finishedGlyph', blueprintId:def.id, name:def.name,
  quality:def.quality, family:def.family, strength:def.strength,
  stats:def.stats.map(s=>s.stat+' +'+s.val+(s.pct?'%':'')), children:[], truncated:true }; }
function glyphTreeChildren(g, def, ctx){ const kids=[];
  for(const ing of def.ing){
    if(ing.kind==='frag'){ ctx.nodes++; kids.push(glyphTreeLeaf(g, ing.key, ing.qty)); }
    else if(ing.kind==='sub'){ const sd=GLYPHS.subs[ing.key]; ctx.nodes++;
      kids.push({ kind:'subGlyph', key:ing.key, qty:ing.qty, virtual:true,
        children: sd?sd.ing.map(si=>{ ctx.nodes++; return glyphTreeLeaf(g, si.key, si.qty*ing.qty); }):[] }); }
    else if(ing.kind==='finished'){ const fd=GLYPHS.byId[ing.defId]; if(!fd) continue;
      if(ctx.depth<GLYPH_TREE_MAX_DEPTH && ctx.nodes<GLYPH_TREE_MAX_NODES)
        kids.push(Object.assign(glyphTreeFinished(g, fd, ctx), {virtual:true}));
      else { ctx.nodes++; kids.push(Object.assign(glyphTreeStub(fd), {virtual:true})); } } }
  return kids; }
function glyphTreeFinished(g, def, ctx){ ctx=ctx||{depth:0,nodes:0}; ctx.nodes++;
  const node={ kind:'finishedGlyph', blueprintId:def.id, name:def.name,
    quality:def.quality, family:def.family, strength:def.strength,
    stats:def.stats.map(s=>s.stat+' +'+s.val+(s.pct?'%':'')), children:[] };
  ctx.depth++; node.children=glyphTreeChildren(g, def, ctx); ctx.depth--;
  return node; }
/* v242: can EVERY empty slot on this board be built at once (combined cumulative cost)? */
function glyphBuildAllPlan(g,hero,board){
  const pool={}; for(const k in (g.fragments||{})) pool[k]=g.fragments[k]|0;
  const slots=[]; let canAll=true;
  for(let slot=0;slot<6;slot++){ if(board.slots[slot]) continue;
    const def=glyphPreChoice(hero, slot, board.ascensionIndex);
    if(!def){ canAll=false; continue; }
    const cost=g2BuildCost(g,def); if(!cost){ canAll=false; continue; }
    for(const k in cost.need){ pool[k]=(pool[k]|0)-cost.need[k]; if(pool[k]<0) canAll=false; }
    slots.push({slot,def,cost}); }
  return {slots, canAll: canAll&&slots.length>0};
}
function glyphBoardsView(g){ const out={};   // wire view: slots carry {blueprintId, locked} — internal instance ids never leave the server
  for(const h of Object.keys(g.boards||{})){ const b=g.boards[h];
    out[h]={ ascensionIndex:b.ascensionIndex, ascended:b.ascended,
      levelRequired:glyphLevelGate(b.ascensionIndex),   // v257: this tier's minimum hero level
      nextTierLevelRequired:glyphLevelGate(b.ascensionIndex+1),
      slots:(b.slots||[]).map(iid=>{ if(!iid) return null; const inst=g.finished[iid]; const d=inst&&GLYPHS.byId[inst.definitionId];
        return d?{ blueprintId:d.id, name:d.name, family:d.family, quality:d.quality, stats:d.stats, locked:true }:null; }) }; }
  return out; }
function glyphAllowed(slotIdx, def, heroRole){ const slot=GLYPH_SLOTS[slotIdx]; if(!slot) return false;
  const ov=GLYPH_ROLE_OVERRIDES[heroRole||'']; const fams=(ov&&ov[slot])||GLYPH_SLOT_FAMILIES[slot]||[]; return fams.includes(def.family); }
function glyphPruneConsumed(g){ // consumed instances are kept for the audit trail, but bounded
  const con=Object.entries(g.finished).filter(([id,i])=>i.status==='consumed');
  if(con.length>200){ con.sort((a,b)=>(a[1].consumedAt||0)-(b[1].consumedAt||0));
    for(const [id] of con.slice(0,con.length-200)) delete g.finished[id]; } }
// one-time migration from the legacy client-owned glyph system (spec §9)
function glyphMigrate(u){
  if(!GLYPHS) return;
  const g=ensureGlyphs(u); if(g.migratedAt) return;
  /* 26 Aug (public flip): legacy glyphRank in saves is IGNORED — beta force-maxed it for every
     account. 27 Aug (Phil): the fragment starter pack is REMOVED — accounts start with ZERO
     fragments; the campaign's named stage drops are the only early source, so the
     farm-the-stage → build-in-slot loop matters from the very first glyph. */
  g.migratedAt=Date.now(); glyphAudit(g,'migrate',{steps:0,legacyIgnored:true,starterPack:false}); g.revision++;
}
/* ============ Correction Spec v1: DIRECT-BUILD flow — helpers ============ */
// Recursively expand a blueprint into exact named fragment + Sub-Glyph requirements.
// finished-glyph ingredients (higher-tier recipes) expand into THEIR recipes — there is no
// loose finished-Glyph inventory any more.
function g2ExpandIngredients(def){ const frags={}, subs={};
  const walk=d=>{ for(const ing of d.ing){
    if(ing.kind==='frag') frags[ing.key]=(frags[ing.key]||0)+ing.qty;
    else if(ing.kind==='sub') subs[ing.key]=(subs[ing.key]||0)+ing.qty;
    else if(ing.kind==='finished'){ const fd=GLYPHS.byId[ing.defId]; if(fd) walk(fd); } } };
  walk(def); return {frags,subs}; }
// Effective fragment cost: any required Sub-Glyph is built INLINE from its own fragment recipe
// (sub stock from the pre-migration era is consumed first).
function g2BuildCost(g, def){ const ex=g2ExpandIngredients(def); const need=Object.assign({},ex.frags); const useSubs={};
  for(const sk in ex.subs){ const stock=(g.subGlyphs&&g.subGlyphs[sk])|0; const use=Math.min(stock, ex.subs[sk]);
    if(use>0) useSubs[sk]=use;
    const short=ex.subs[sk]-use;
    if(short>0){ const sd=GLYPHS.subs[sk]; if(!sd) return null;
      for(const ing of sd.ing){ need[ing.key]=(need[ing.key]||0)+ing.qty*short; } } }
  return {need, useSubs}; }
// ONE-TIME flow migration (audited): loose finished Glyphs refund 100% of their exact named
// ingredients; socketed Glyphs become permanently LOCKED in their slot; loose Sub-Glyph stock
// converts to its named fragments; ascended bonuses are untouched.
function glyphFlowMigrate(u){ if(!GLYPHS) return; const g=ensureGlyphs(u); if(g.flow2At) return;
  const refund={}; const addRefund=(k,n)=>{ g.fragments[k]=(g.fragments[k]||0)+n; refund[k]=(refund[k]||0)+n; };
  for(const iid of Object.keys(g.finished||{})){ const inst=g.finished[iid];
    if(inst.status==='inventory'){ const def=GLYPHS.byId[inst.definitionId];
      if(def){ const ex=g2ExpandIngredients(def);
        for(const k in ex.frags) addRefund(k, ex.frags[k]);
        for(const sk in ex.subs){ const sd=GLYPHS.subs[sk]; if(sd) for(const ing of sd.ing) addRefund(ing.key, ing.qty*ex.subs[sk]); } }
      inst.status='consumed'; inst.consumedAt=Date.now(); inst.flow2Refunded=true; }
    else if(inst.status==='socketed'){ inst.status='locked'; } }
  for(const sk of Object.keys(g.subGlyphs||{})){ const n=g.subGlyphs[sk]|0; const sd=GLYPHS.subs[sk];
    if(n>0&&sd) for(const ing of sd.ing) addRefund(ing.key, ing.qty*n); }
  g.subGlyphs={};
  g.flow2At=Date.now(); glyphAudit(g,'flow2-migrate',{refund}); g.revision++; }
// Named, deterministic fragment grants — the ONLY live reward path for Glyph materials.
function glyphGrantNamedList(u, list){ if(!GLYPHS||!Array.isArray(list)||!list.length) return null;
  const g=ensureGlyphs(u); glyphMigrate(u); glyphFlowMigrate(u);
  const receipt=[];
  for(const it of list){ const q=Math.max(1,it.quantity|0); g.fragments[it.key]=(g.fragments[it.key]||0)+q;
    receipt.push({ fragmentId:glyphFragSlug(it.key), displayName:it.key+' Fragment', quantity:q }); }
  g.revision++; return receipt; }
// Authored named drops: campaign stages (chapter sets the quality band, family cycles by stage),
// vault boss floors (band by floor, family by boss index), arena wins (band by rank), daily
// (fixed rotation by NY day). Deterministic — no unseeded family roll anywhere.
// Phil's banding (27 Aug): ch1 Grey · ch2 Green tiers · ch3-4 Blue tiers · ch5-7 Purple tiers ·
// ch8-10 Gold tiers — EVERY (tier, family) pair is authored onto some stage, so every fragment
// in the game is farmable and sweepable. (Orange arrives with chapter 11/12; until then Orange
// fragments drop from Vault floors 81-100.) The DATA in campaign-encounters.json is the truth;
// this helper just reads it.
function campFragFor(node){ const st=campStageOf(node);
  return st&&st.rewards&&st.rewards.glyphFragments?st.rewards.glyphFragments.map(f=>({key:f.key,quantity:f.quantity})):[]; }
function vaultGlyphFragsFor(floor){ const q=dungeonQualityForFloor(floor); const bi=floor/5; const fams=glyphTierFams(q);
  return [ q+' '+fams[bi%fams.length], q+' '+fams[(bi+3)%fams.length] ]; }
function arenaGlyphFragsFor(rank){ const t=Math.min(9, 3+Math.floor((5000-rank)/800)); const out=[];
  for(let i=0;i<4;i++){ const q=GLYPH_LADDER[Math.max(0,t-i)]; const fams=glyphTierFams(q);
    out.push({ key:q+' '+fams[(rank+i)%fams.length], quantity:1 }); }
  return out; }
function dailyGlyphFragsFor(dayKey){ let h=0; for(const c of String(dayKey)) h=(h*31+c.charCodeAt(0))>>>0; const out=[];
  for(let i=0;i<12;i++){ const q=GLYPH_LADDER[i%4]; const fams=glyphTierFams(q);
    out.push({ key:q+' '+fams[(h+i)%fams.length], quantity:1 }); }
  return out; }
// glyph combat/power contribution — flat + % stats reduced to one scalar, added into serverTeamPower
const GLYPH_POWER_WEIGHT=+(process.env.GLYPH_POWER_WEIGHT||0.2);
function glyphStatScore(stats){ let p=0; for(const s of stats){ if(s.pct) p+=s.val*4; else if(/^HP$/i.test(s.stat)) p+=s.val/8; else if(/Regen/i.test(s.stat)) p+=s.val/6; else p+=s.val*1.2; } return p; }
function glyphHeroPower(u, heroKey){
  if(!GLYPHS) return 0;
  const g=u&&u.glyphs; if(!g) return 0; const b=g.boards&&g.boards[heroKey]; if(!b) return 0;
  let p=0;
  for(const st in (b.ascended||{})){ const a=b.ascended[st]; p+= a.pct? a.val*4 : (/^HP$/i.test(st)? a.val/8 : (/Regen/i.test(st)? a.val/6 : a.val*1.2)); }
  for(const iid of (b.slots||[])){ if(!iid) continue; const inst=g.finished[iid]; const def=inst&&GLYPHS.byId[inst.definitionId]; if(def) p+=glyphStatScore(def.stats); }
  return p*GLYPH_POWER_WEIGHT;
}
/* ================== end Glyph Ascension module (routes live in api()) ================== */
/* ==================== AETHER VAULT (Dungeon v2) — server-authoritative ====================
   SPEC-dungeon-aether-vault.md. Permanent server-saved 100-floor climb, two waves per floor,
   Dust every floor, 2 fragments every 5th, 2 free daily Sweeps, manual salvage.
   Server owns floor, seed, enemy snapshots, outcome, and every reward roll. The client sends
   ONLY heroIds + requestId; a resolve carries NO result payload — the shared deterministic
   resolver (server/sim.js) decides the fight.
   v258: the Vault is authored (server/vault-encounters.json, boot-validated), server-resolved and
   covered by the suite, so it ships ON BY DEFAULT — no Railway variable required. Set
   DUNGEON_V2_ENABLED=false to force it off. */
const DUNGEON_V2_ENABLED = String(process.env.DUNGEON_V2_ENABLED||'true')!=='false';
let SIM=null; try{ SIM=require('./server/sim.js'); }catch(e){ console.error('⚠ DUNGEON DISABLED — server/sim.js missing ('+e.message+')'); }
function dungeonEnabledFor(u){ return !!SIM && !!GLYPHS && (DUNGEON_V2_ENABLED || isDev(u)); }

// ---- client-exact level curves (mirrors emberweave-heroes.html tables) ----
const D_MAX_LEVEL=100;   // v258 (Launch Blueprint v1): the launch cap. Orange sits at level 100.
const D_TROOP_INC=[8,10,35,45,60,70,70,80,90,110,110,120,120,130,130,130,130,130,150,250,0,0,0,300,330,350,0,370,0,0,450,0,0,600,700,800,0,0,1200,1200,1300,1400,0,0,1900,0,0,0,3000,3250,0,3250,3250,3250,0,3400,0,3520,3640,0,3760,0,3880,4000,0,4120,4240,0,4360,0,4480,0,4600,4720,0,4840,4960,0,5080,0,5200,0,5320,5440,0,5560,5680,0,5800,0,5920,0,6040,6160,0,6280,6400,0,6520];
const D_HERO_STEP=[8,10,12,26,40,60,80,100,120,140,200,260,320,380,440,500,560,620,680,740,800,1000,1200,1400,1600,1800,2000,2200,2500,2800,3100,3400,3700,4000,4300,4600,4900,5200,5500,5800,6900,7200,7500,7800,8100,8400,8700,9000,9300,10200,10500,10800,11100,11700,12300,12900,13500,14100,14700,15300,15900,16500,17100,17700,18300,18900,19500,20100,20700,21300,21900,22500,23100,23700,24300,24900,25500,26100,26700,27300,27900,28500,29100,29700,30300,30900,31500,32100,32700,33300,33900,34500,35100,35700,36300,36900,37500,38100,38700];
function d_runSum(inc){ const o=[]; let r=0; for(const v of inc){ r+=v; o.push(r); } return o; }
function d_cum(steps){ const c=new Array(D_MAX_LEVEL+1); c[1]=0; for(let L=2;L<=D_MAX_LEVEL;L++) c[L]=c[L-1]+steps[L-2]; return c; }
const D_TROOP_CUM=d_cum(d_runSum(D_TROOP_INC)), D_HERO_CUM=d_cum(D_HERO_STEP);
function d_levelForXP(xp,cum){ let L=1; while(L<D_MAX_LEVEL && xp>=cum[L+1]) L++; return L; }

/* ---- v249 Academy on the ledger: mirrors of the client's research tables ---- */
const TECH_MAX_SRV=60;
const TECH_BASE_SRV={atk:0.7, hp:10, ap:0.5, def:0.13, armor:0.13, mr:0.13, crit:0.13, critres:0.2};
const TECH_GROWTH_SRV=1.04;
const ACAD_TRACKS=['academy','atk','hp','ap','def','armor','mr','crit','critres'];
function techGainSrv(k,lvl){ return (TECH_BASE_SRV[k]!=null?TECH_BASE_SRV[k]:0.1)*Math.pow(TECH_GROWTH_SRV,lvl||0); }
function techTotalSrv(A,k){ const lvl=(A&&A.lv&&A.lv[k])|0; let v=0; for(let i=0;i<lvl;i++) v+=techGainSrv(k,i); return v; }
function learnDurSrv(lvl,acadLvl){ return Math.round((120+lvl*lvl*45)*1000*(1-Math.min(0.6,(acadLvl|0)*0.02))); }
function learnResCostSrv(track,lvl){ const base={atk:{iron:6,coal:4},hp:{silver:6,crystal:3},def:{iron:5,silver:4},armor:{iron:7,coal:3},mr:{crystal:6,silver:3},crit:{crystal:5,coal:4},critres:{silver:5,coal:5}}[track]||{iron:5}; const c={}; for(const k in base) c[k]=base[k]+lvl*2; return c; }
const ACADEMY_CUTOFF=1787841600000;   // v249 deploy: earlier accounts seed once from their save; new accounts start at zero
function ensureAcad(u){ const led=ensureLedger(u);
  if(led.acad) return led.acad;
  const A={ lv:{academy:0,atk:0,hp:0,ap:0,def:0,armor:0,mr:0,crit:0,critres:0}, learn:{}, res:{iron:0,crystal:0,silver:0,coal:0}, mineDay:null };
  if((led.migratedAt||0) && led.migratedAt<ACADEMY_CUTOFF){ const sv=parseSaveOf(u);
    const t=sv.tech||{}; for(const k of ACAD_TRACKS){ const v=t[k]|0; if(v>0) A.lv[k]=Math.min(TECH_MAX_SRV,v); }
    const r=sv.res||{}; for(const k of ['iron','crystal','silver','coal']){ if((r[k]|0)>0) A.res[k]=Math.min(99999,r[k]|0); } }
  led.acad=A; led.rev++; return A; }
function acadCollect(A){ let changed=false; const now=Date.now();
  for(const k in A.learn){ const done=A.learn[k]; if(done&&now>=done){ A.lv[k]=Math.min(TECH_MAX_SRV,(A.lv[k]|0)+1); delete A.learn[k]; changed=true; } }
  return changed; }
function acadCombat(u){ const led=u&&u.led; if(!led||!led.acad) return null; const A=led.acad;
  return { atkFlat:Math.round(techTotalSrv(A,'atk')), hpFlat:Math.round(techTotalSrv(A,'hp')),
    armorRating:techTotalSrv(A,'armor'), mrRating:techTotalSrv(A,'mr'),
    critFrac:techTotalSrv(A,'crit')/100, critResFrac:techTotalSrv(A,'critres')/100,
    dmgRedFrac:techTotalSrv(A,'def')/100, apMul:1+techTotalSrv(A,'ap')/100 }; }
/* ---- v250: per-loop server authorities (audit P1 — generic tx/earn retired) ---- */
const ELITE_SEQ_SRV=["tick","sylthaine","vireo","vael","fritz","rhukk","bloatus","umbris","oakmir"];
function isEliteStageSrv(g){ const st=((g-1)%10)+1; return st===3||st===6||st===9; }
function eliteHeroForSrv(g){ if(!isEliteStageSrv(g)) return null;
  const ch=Math.floor((g-1)/10)+1, st=((g-1)%10)+1;
  const idx=(ch-1)*3 + ({3:0,6:1,9:2})[st];
  return ELITE_SEQ_SRV[idx%ELITE_SEQ_SRV.length]; }
const ARENA_DAILY_BANDS=[[1,1,600,30000,800],[2,2,520,27000,775],[3,3,440,24000,750],[4,4,380,21000,725],[5,5,320,19000,700],[6,6,260,17000,680],[7,7,200,15000,660],[8,8,180,14000,640],[9,10,160,12500,610],[11,20,150,11000,590],[21,30,140,10000,575],[31,40,130,9000,560],[41,50,120,8000,545],[51,70,110,7500,530],[71,100,100,7000,500],[101,150,90,6500,475],[151,200,80,6000,450],[201,300,70,5500,425],[301,400,60,5000,388],[401,500,55,4500,350],[501,700,55,4000,300],[701,1000,50,3500,260],[1001,1500,50,3300,220],[1501,2000,50,3100,180],[2001,2500,50,2900,140],[2501,3500,45,2700,100],[3501,5000,45,2500,50],[5001,15000,45,2200,30]];
function arenaDailyRewardSrv(rank){ for(const [lo,hi,g,gold,c] of ARENA_DAILY_BANDS){ if(rank>=lo&&rank<=hi) return {gems:g,gold,coins:c}; } return {gems:0,gold:0,coins:0}; }
const QUEST_DEFS_SRV={
  q_arena:  { reward:{gold:50},  cond:(u,led)=>((u.qc&&u.qc.arena)|0)>=1 },
  q_name:   { reward:{gems:20},  cond:()=>true },                                  // attested (cosmetic condition), reward fixed + once
  q_collect:{ reward:{randFrags:5}, cond:(u,led)=>Object.keys(led.unlocked||{}).filter(k=>led.unlocked[k]).length>=5 },
  q_vex:    { reward:{hero:'vex'}, cond:(u,led)=>(led.camp.cleared|0)>=6 },
  q_wish:   { reward:{gems:20},  cond:(u,led)=>((u.qc&&u.qc.wish)|0)>=3 }
};
function questChainStepsSrv(){ const steps=[{node:1,frags:2},{node:2,frags:2},{node:3,frags:3},{node:4,frags:3}];
  for(let n=6;n<=100;n+=3) steps.push({node:n,gems:20}); return steps; }
const TRIAL_KINDS={ tower:{mul:0.85, reward:f=>({gold:80+8*f, heroXp:60})},
                    gauntlet:{mul:1.0, reward:f=>({gold:100+10*f, heroXp:70})},
                    dungeon:{mul:0.9, reward:f=>({gold:200, px:100, heroXp:90})} };
const DUNGEON_MATS_PER_DAY=10;   // v328: winning dungeon resolves that roll equipment materials, per ET day (anti-farm; the floor/gold/px are unaffected)
/* 30 Aug — PROTOTYPE POLLUTION VIA heroKey.
   /api/gear/equip did `g.equipped[hero] = g.equipped[hero] || {}` with `hero` taken straight from
   the request body. Sent as "__proto__" that reads and then WRITES Object.prototype — a single
   request could add a property to every object in the server process. The gear and glyph routes had
   no whitelist at all; the ledger routes had one, but `SIM.HERO_BASE['__proto__']` is itself truthy,
   so `if(!SIM.HERO_BASE[k])` did not stop it either. hasOwnProperty is the check that does. */
function validHero(k){ return typeof k==='string' && Object.prototype.hasOwnProperty.call(SIM.HERO_BASE, k); }
function parseSaveOf(u){ try{ return (u.roster&&typeof u.roster.__save==='string')?JSON.parse(u.roster.__save):{}; }catch(e){ return {}; } }
// glyph v2 flat stat bridge for the sim (same mapping the client uses)
function glyphFlatStats(u,key){
  // hp/atk/heal flats (unchanged) + v225: the RATE stats the client's glyphV2Mul collects
  // (Armor/MR/Crit Chance/Tenacity/Control Resist/Starting Energy), same MAP, crit capped at 60.
  // v242 (COMBAT CORE): EVERY catalog stat is collected and typed — nothing is silently dropped.
  const out={hp:0,atk:0,apow:0,heal:0,pen:0,armorPen:0,magicPen:0,armor:0,mr:0,crit:0,critDmg:0,critRes:0,
    energy:0,regenRating:0,ctrlRes:0,ctrlHit:0,startEnergy:0,healPow:0,lifesteal:0,atkSpd:0,haste:0,
    eva:0,acc:0,block:0,dmgBonus:0,dmgRed:0,shieldStr:0}; const g=u&&u.glyphs; if(!g||!GLYPHS) return out;
  const b=g.boards&&g.boards[key]; if(!b) return out;
  const add=(stat,val)=>{ if(/^HP$/i.test(stat)) out.hp+=val;
    else if(/^Physical Attack$/i.test(stat)) out.atk+=val;                 // physical line ONLY
    else if(/^Ability Power$/i.test(stat)) out.apow+=val;                  // spell/ability line ONLY
    else if(/^Armor Penetration$/i.test(stat)){ out.armorPen+=val; out.pen+=val; }
    else if(/^Magic Penetration$/i.test(stat)){ out.magicPen+=val; out.pen+=val; } };
  // AUDIT C6: DISTINCT stats — never folded into lookalikes.
  const addRate=(stat,val)=>{ if(/^Armor$/i.test(stat)) out.armor+=val;
    else if(/^Magic Resist$/i.test(stat)) out.mr+=val;
    else if(/^Crit Chance$/i.test(stat)) out.crit+=val;
    else if(/^Crit Damage$/i.test(stat)) out.critDmg+=val;
    else if(/^(Tenacity|Control Resist)$/i.test(stat)) out.ctrlRes+=val;
    else if(/^Control Hit$/i.test(stat)) out.ctrlHit+=val;
    else if(/^Starting Energy$/i.test(stat)) out.startEnergy+=val;
    else if(/^Healing Power$/i.test(stat)) out.healPow+=val;
    else if(/^Energy Regen$/i.test(stat)) out.energy+=val;
    else if(/^HP Regen$/i.test(stat)) out.regenRating+=val;
    else if(/^Lifesteal$/i.test(stat)) out.lifesteal+=val;
    else if(/^Attack Speed$/i.test(stat)) out.atkSpd+=val;
    else if(/^Haste$/i.test(stat)) out.haste+=val;
    else if(/^Evasion$/i.test(stat)) out.eva+=val;
    else if(/^Accuracy$/i.test(stat)) out.acc+=val;
    else if(/^Block$/i.test(stat)) out.block+=val;
    else if(/^Damage Bonus$/i.test(stat)) out.dmgBonus+=val;
    else if(/^Damage Reduction$/i.test(stat)) out.dmgRed+=val;
    else if(/^Shield Strength$/i.test(stat)) out.shieldStr+=val; };
  for(const st in (b.ascended||{})){ if(!b.ascended[st].pct) add(st,b.ascended[st].val); addRate(st,b.ascended[st].val); }
  for(const iid of (b.slots||[])){ if(!iid) continue; const inst=g.finished[iid]; const d=inst&&GLYPHS.byId[inst.definitionId];
    if(d) for(const sst of d.stats){ if(!sst.pct) add(sst.stat,sst.val); addRate(sst.stat,sst.val); } }
  out.crit=Math.min(60,out.crit);
  for(const k in out) out[k]=Math.round(out[k]);
  return out;
}
// server-owned hero snapshot: level from saved XP (capped by player level), stars/pips from save, glyphs from server
function snapshotHeroFromServer(u, key, save){
  const base=SIM.HERO_BASE[key]; if(!base) return null;
  // AUDIT C1: progression comes from the SERVER-owned ledger, never from the uploaded save blob.
  // v267 (release gate 1): migrate FIRST, so the legacy save-blob branch below can never be the
  // source of a live snapshot — it survives only as an unreachable safety net.
  try{ if(u && !(u.led && u.led.migratedAt)) ensureLedger(u); }catch(e){}
  let lvl,stars,pips;
  let refLvl=0;
  if(u&&u.led&&u.led.migratedAt){ const led=u.led, h=led.hero[key]||{xp:0,stars:base.stars,pips:0};
    lvl=ledHeroLevel(led,key);
    stars=Math.max(base.stars,Math.min(5,h.stars|0)); pips=Math.max(0,Math.min(5,h.pips|0)); refLvl=Math.max(0,Math.min(15,h.ref|0));
  } else {
    /* v274 (hardening directive §2.5) — THE FALLBACK IS DELETED, NOT LEFT UNREACHABLE.
       This branch used to rebuild a hero from the uploaded browser save. It was unreachable in
       practice (ensureLedger runs first, immediately above), but "unreachable" is not a security
       boundary — it is a line of code waiting for a refactor to reach it. A snapshot now comes from
       the ledger or it does not exist. */
    console.error('🚨 snapshotHeroFromServer: no ledger for account '+((u&&u.id)||'?')+' — refusing to build a snapshot from a client save');
    return null;
  }
  const fl=glyphFlatStats(u,key);
  let gf=null;
  if(typeof gearHeroFlats==='function'&&u.gear){ gf=gearHeroFlats(u,key); }
  // v242 (COMBAT CORE): the snapshot hands the core RAW TYPED RATINGS — the core owns every
  // rating→percentage conversion (server/combat-core.js CONV), so client and server can never
  // diverge on a formula. Gear 'atk' stays on the physical line (catalog typing refinement tracked).
  const R={
    hpFlat:(fl.hp|0)+((gf&&gf.hp)|0), atkFlat:(fl.atk|0)+((gf&&gf.atk)|0), apowFlat:(fl.apow|0)+((gf&&gf.apow)|0),
    healFlat:((gf&&gf.heal)|0),
    armor:(fl.armor|0)+((gf&&gf.armor)|0), mr:(fl.mr|0)+((gf&&gf.mr)|0),
    armorPen:(fl.armorPen|0)+((gf&&gf.armorPen)|0), magicPen:(fl.magicPen|0)+((gf&&gf.magicPen)|0),
    crit:(fl.crit|0)+((gf&&gf.crit)|0), critDmg:(fl.critDmg|0)+((gf&&gf.critDmg)|0), critRes:(fl.critRes|0)+((gf&&gf.critRes)|0),
    energy:(fl.energy|0)+((gf&&gf.energy)|0), startEnergy:(fl.startEnergy|0)+((gf&&gf.startEnergy)|0),
    regen:(fl.regenRating|0)+((gf&&gf.regenRating)|0),
    lifesteal:(fl.lifesteal|0)+((gf&&gf.lifesteal)|0), atkSpd:(fl.atkSpd|0)+((gf&&gf.atkSpd)|0), haste:(fl.haste|0)+((gf&&gf.haste)|0),
    eva:(fl.eva|0)+((gf&&gf.eva)|0), acc:(fl.acc|0)+((gf&&gf.acc)|0), block:(fl.block|0)+((gf&&gf.block)|0),
    dmgBonus:(fl.dmgBonus|0)+((gf&&gf.dmgBonus)|0), dmgRed:(fl.dmgRed|0)+((gf&&gf.dmgRed)|0), shieldStr:(fl.shieldStr|0)+((gf&&gf.shieldStr)|0),
    ctrlHit:(fl.ctrlHit|0)+((gf&&gf.ctrlHit)|0), ctrlRes:(fl.ctrlRes|0)+((gf&&gf.ctrlRes)|0), healPow:(fl.healPow|0)+((gf&&gf.healPow)|0)
  };
  let gearSkillSlot=null, gearSkill=null;
  if(u.gear&&GEARCAT){ const aid=(u.gear.active||{})[key]; const it=aid&&u.gear.items[aid]; const d=it&&GEARCAT.byId[it.d];
    if(d&&d.active){ const eq=(u.gear.equipped||{})[key]||{}; if(Object.values(eq).includes(aid)){ gearSkillSlot=d.slot;
      gearSkill={ id:d.id, name:d.active, type:d.activeType||null, params:d.activeParams||null, slot:d.slot }; } } }
  // v249: Academy research is SERVER-owned and reaches combat here (flats, ratings, fractions, AP multiplier)
  const AC=acadCombat(u);
  if(AC){ R.atkFlat+=AC.atkFlat; R.hpFlat+=AC.hpFlat; }
  return SIM.heroCombatStats(key,{level:lvl, stars, pips, ref:refLvl, ratings:R, gearSkillSlot, gearSkill,
    extra:AC?{armorRating:AC.armorRating, mrRating:AC.mrRating, critFrac:AC.critFrac, critResFrac:AC.critResFrac, dmgRedFrac:AC.dmgRedFrac, apMul:AC.apMul}:null});
}

// ---- spec constants (server-only tuning) ----
const DUNGEON_MAX_FLOOR=100;
const VAULT_UNLOCK_LEVEL=10;
const VAULT_HERO_XP_PER_FLOOR=30;
const VAULT_SWEEP_FREE=2, VAULT_SWEEP_PAID_COST=[200,400,600];   // v372 (Phil): 3rd, 4th and 5th sweep of the day cost 200 / 400 / 600 diamonds   // v370 (Phil): "heroes should get 30 exp per floor, sweeps also" — every hero on the line, per floor, never the player   // v364 (Phil): the Vault opens at player level 10; floor 1 is tuned to be hard for a level-10 line
const DUNGEON_QUALITY_BANDS=[
  {min:1,max:10,q:'Grey'},{min:11,max:20,q:'Green'},{min:21,max:30,q:'Blue'},{min:31,max:40,q:'Blue +2'},
  {min:41,max:50,q:'Purple'},{min:51,max:60,q:'Purple +3'},{min:61,max:70,q:'Gold +1'},{min:71,max:80,q:'Gold +4'},
  {min:81,max:100,q:'Orange'}];
function dungeonQualityForFloor(f){ const b=DUNGEON_QUALITY_BANDS.find(b=>f>=b.min&&f<=b.max); return b?b.q:'Grey'; }
function isDungeonBossFloor(f){ return f%5===0; }
function isDungeonMilestoneFloor(f){ return f%10===0; }
const DUNGEON_TUNE={ dustFloor1:30, dustGrowthPerFloor:0.065, bossPowerMultiplier:1.30, milestonePowerMultiplier:1.55 };
function dustForDungeonFloor(f){ return VAULT_ENC ? vaultFloorRecord(f).dust : Math.floor(DUNGEON_TUNE.dustFloor1*Math.pow(1+DUNGEON_TUNE.dustGrowthPerFloor,f-1)); }   // v241: the authored table is the source once compiled
function difficultyForDungeonFloor(f){ const n=1+(f-1)*0.085;
  return n*(isDungeonBossFloor(f)?DUNGEON_TUNE.bossPowerMultiplier:1)*(isDungeonMilestoneFloor(f)?DUNGEON_TUNE.milestonePowerMultiplier:1); }
const DUNGEON_BOSS_RULES=['stoneguard_barrier','bloodfire_enrage','broodcall','riftblade_leap','blight_aura','storm_chain','ironwall_challenge','voidstep','cinderbrand','vault_warden'];
const DUNGEON_BOSS_WARN={stoneguard_barrier:'Begins with a large shield; bring sustained damage',bloodfire_enrage:'At 40% HP, attack speed and damage rise sharply',broodcall:'Summons weak adds that distract the frontline',riftblade_leap:'Periodically jumps to the backline',blight_aura:'Reduces healing received by all enemies hit',storm_chain:'Lightning bounces between clustered heroes',ironwall_challenge:'Taunts the frontline and gains defence while taunting',voidstep:'Teleports behind the team, attacks the weakest backliner',cinderbrand:'Stacking burn; cleansing and healing matter',vault_warden:'Three phases: shield, add wave, enrage'};
function bossRuleForFloor(f){ if(!isDungeonBossFloor(f)) return null;
  const id=DUNGEON_BOSS_RULES[(f/5-1)%DUNGEON_BOSS_RULES.length];
  return { id, warn:DUNGEON_BOSS_WARN[id]||'', ascended:f>=55, gatekeeper:isDungeonMilestoneFloor(f) }; }
// fragment→Dust salvage rates: spec anchors, intermediate qualities interpolated. Server-only.
const FRAG_SALVAGE_DUST={'Grey':2,'Green':5,'Green +1':8,'Blue':12,'Blue +1':18,'Blue +2':25,'Purple':50,'Purple +1':65,'Purple +2':80,'Purple +3':100,'Gold':150,'Gold +1':200,'Gold +2':260,'Gold +3':330,'Gold +4':400,'Orange':800};

// AUDIT C7: ONE game reset clock — America/New_York, same as Guild War (was UTC).
function dungeonServerDayKey(){ return nyDayKey(); }
function dungeonNextReset(){ const now=Date.now(), off=etOffsetMs(now); const d=new Date(now-off);
  return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)+etOffsetMs(now+86400000); }
function getDungeonProgress(id){
  DB.dungeonProgress=DB.dungeonProgress||{};
  if(!DB.dungeonProgress[id]) DB.dungeonProgress[id]={ accountId:id, currentFloor:1, highestClearedFloor:0,
    vaultStatus:'active', claimedFloors:{}, sweep:{dateKey:dungeonServerDayKey(),freeUsesRemaining:2,totalSweepsToday:0},
    activeAttempt:null, lastTeamHeroIds:[], version:0 };
  return DB.dungeonProgress[id]; }
function resetDungeonSweepIfNewDay(sw){ const k=dungeonServerDayKey(); if(sw.dateKey!==k){ sw.dateKey=k; sw.freeUsesRemaining=VAULT_SWEEP_FREE; sw.totalSweepsToday=0; } }
function vaultSweepNextCost(sw){ if(sw.freeUsesRemaining>0) return 0; const paid=Math.max(0,(sw.totalSweepsToday|0)-VAULT_SWEEP_FREE); return paid<VAULT_SWEEP_PAID_COST.length?VAULT_SWEEP_PAID_COST[paid]:null; }   // 0 = free, null = none left today
// bounded idempotency ledger: retried requests return the committed result instead of paying twice
/* v273 — A REWARD AND ITS RECEIPT ARE ONE DURABLE TRANSACTION.
   writeDB() coalesces on a 200 ms timer, so a crash in that window used to lose the idempotency
   record along with the reward — and the client's retry would then be paid a second time. Every
   idem() result is now flushed to disk BEFORE the response is written. */
function writeDBNow(){
  if(PG_BOOT_PENDING){ _bootDirty=true; return; }   // v327: boot restore window — see bootFinish()
  try{ if(saveTimer){ clearTimeout(saveTimer); saveTimer=null; }
    const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(DB)); fs.renameSync(tmp, DB_FILE);
  }catch(e){ console.error('⚠ DB durable write failed:', e.message); }
  try{ pgSave(); }catch(e){}
}
function idem(key, fn){ DB.idem=DB.idem||{}; const now=Date.now();
  for(const k of Object.keys(DB.idem)){ if(now-DB.idem[k].t>86400000) delete DB.idem[k]; }
  if(DB.idem[key]) return DB.idem[key].resp;
  const resp=fn(); DB.idem[key]={t:now,resp};
  writeDBNow();                       // the receipt lands with the reward, or neither does
  return resp; }

/* Monster roster mirror (client MONSTER_TYPES essentials). Vault fights are REAL client
   battles vs monsters, campaign-style. Floors are PRE-DETERMINED: the lineup for a floor
   is seeded by the floor number alone, so every attempt at a floor faces exactly the same
   monsters — a floor is learnable and beatable by practice, never by reroll luck. */
const VAULT_MONSTERS={
  'bug':{hp:110,dmg:18,role:'Mage'}, 'creep':{hp:155,dmg:16,role:'Warrior'}, 'dyrmen':{hp:155,dmg:16,role:'Warrior'},
  'fire boar':{hp:155,dmg:16,role:'Warrior'}, 'fire skeleton':{hp:155,dmg:16,role:'Warrior'}, 'garbage mob':{hp:250,dmg:13,role:'Tank'},
  'ghoul fiend':{hp:155,dmg:16,role:'Warrior'}, 'glitch phantom':{hp:110,dmg:18,role:'Mage'}, 'golem':{hp:250,dmg:13,role:'Tank'},
  'knat':{hp:110,dmg:18,role:'Mage'}, 'lost soulss':{hp:110,dmg:18,role:'Mage'}, 'mimic chest':{hp:250,dmg:13,role:'Tank'},
  'orc':{hp:155,dmg:16,role:'Warrior'}, 'raven':{hp:110,dmg:18,role:'Mage'}, 'rock golem':{hp:250,dmg:13,role:'Tank'},
  'shadow ghoul':{hp:155,dmg:16,role:'Warrior'}, 'skeletal warrior':{hp:155,dmg:16,role:'Warrior'}, 'slime':{hp:155,dmg:16,role:'Warrior'},
  'slug beast':{hp:220,dmg:18,role:'Warrior'}, 'tin beast':{hp:250,dmg:13,role:'Tank'}, 'turtle':{hp:250,dmg:13,role:'Tank'},
  'whisp candle':{hp:110,dmg:18,role:'Mage'} ,
  /* v337 — the 28 new monsters (v331 roster) */
  'cinder skulk':{hp:155,dmg:16,role:'Warrior'},
  'furnace gnawer':{hp:155,dmg:16,role:'Warrior'},
  'sootwing imp':{hp:110,dmg:18,role:'Mage'},
  'basalt mauler':{hp:250,dmg:13,role:'Tank'},
  'magma hound':{hp:155,dmg:16,role:'Warrior'},
  'crucible acolyte':{hp:110,dmg:18,role:'Mage'},
  'reef prowler':{hp:155,dmg:16,role:'Warrior'},
  'kelp hexer':{hp:110,dmg:18,role:'Mage'},
  'shellguard sentinel':{hp:250,dmg:13,role:'Tank'},
  'mudsnap crab':{hp:110,dmg:18,role:'Mage'},
  'storm eel':{hp:110,dmg:18,role:'Mage'},
  'saltglass siren':{hp:110,dmg:18,role:'Mage'},
  'graveclaw ghoul':{hp:155,dmg:16,role:'Warrior'},
  'wispweaver shade':{hp:110,dmg:18,role:'Mage'},
  'bonepike guard':{hp:250,dmg:13,role:'Tank'},
  'rotbloom ooze':{hp:155,dmg:16,role:'Warrior'},
  'nightcap mimic':{hp:110,dmg:18,role:'Mage'},
  'mourn moth':{hp:110,dmg:18,role:'Mage'},
  'riftling spider':{hp:155,dmg:16,role:'Warrior'},
  'crystalhorn grazer':{hp:155,dmg:16,role:'Warrior'},
  'skyroot dryad':{hp:155,dmg:16,role:'Warrior'},
  'luminant orb':{hp:110,dmg:18,role:'Mage'},
  'zephyr harrier':{hp:110,dmg:18,role:'Mage'},
  'runic automaton':{hp:250,dmg:13,role:'Tank'},
  'ironjaw raider':{hp:155,dmg:16,role:'Warrior'},
  'vineback boar':{hp:155,dmg:16,role:'Warrior'},
  'frostjaw troll':{hp:250,dmg:13,role:'Tank'},
  'clockwork lantern':{hp:110,dmg:18,role:'Mage'}
};
const VAULT_BOSSES=['ice beast','monster with fireball','nashor beast','ogre beast','water monster','water serpent'];
const VAULT_MIN_BATTLE_MS=+(process.env.VAULT_MIN_BATTLE_MS||6000);   // a real two-wave fight can't finish faster than this
const VAULT_BOSS_STATS={'ice beast':{hp:300,dmg:26},'monster with fireball':{hp:450,dmg:26},'nashor beast':{hp:300,dmg:26},'ogre beast':{hp:300,dmg:26},'water monster':{hp:300,dmg:26},'water serpent':{hp:300,dmg:26},
  /* v337 — the 14 new bosses: Brutes 300/26, Mages 450/26 (same archetypes as the originals) */
  'vharok':{hp:300,dmg:26},'barrowmaw':{hp:300,dmg:26},'asterion':{hp:300,dmg:26},'maelvara':{hp:300,dmg:26},'brukk':{hp:300,dmg:26},'irix':{hp:300,dmg:26},'kharos':{hp:300,dmg:26},'miregor':{hp:300,dmg:26},'orryx':{hp:300,dmg:26},'nameless admiral':{hp:300,dmg:26},
  'nerissa':{hp:450,dmg:26},'nymira':{hp:450,dmg:26},'sable vesper':{hp:450,dmg:26},'thorneveil':{hp:450,dmg:26}};
function vaultMonsterLevel(floor){ return Math.max(1,Math.min(D_MAX_LEVEL, Math.round(2+floor*0.6))); }
// deterministic per floor+wave — NO per-attempt randomness anywhere in here
/* v241 (full-game audit): the Vault is AUTHORED DATA, not runtime generation. server/vault-encounters.json
   carries all 100 floors — waves, boss rule, recommended power, Dust, the boss-floor glyph fragments,
   and the two TARGETED gear fragments each floor drops. vaultCompile validates the whole table at
   boot (missing/corrupt file = the server refuses to start, same rule as glyph-source). */
let VAULT_ENC=null;
let GEAR_SOURCES=null;   // v256: memoised gear-fragment → vault-floor source map (80/20 §5)
function vaultCompile(){
  const raw=require('./server/vault-encounters.json');
  const fl=raw&&raw.floors;
  if(!Array.isArray(fl)||fl.length!==DUNGEON_MAX_FLOOR) throw new Error('vault-encounters: need exactly '+DUNGEON_MAX_FLOOR+' floors');
  const gearFrags=new Set(); if(typeof GEARCAT!=='undefined'&&GEARCAT) for(const id in GEARCAT.byId){ const d=GEARCAT.byId[id]; if(d.frag) gearFrags.add(d.frag); }
  fl.forEach((r,i)=>{ const f=i+1;
    if(r.floor!==f) throw new Error('vault-encounters: floor '+f+' out of order');
    if(!Array.isArray(r.waves)||r.waves.length!==2) throw new Error('vault-encounters: floor '+f+' must have exactly two waves');
    for(const w of r.waves){ if(!Array.isArray(w)||!w.length) throw new Error('vault-encounters: floor '+f+' empty wave');
      for(const s of w){ if(!VAULT_MONSTERS[s.key]&&!VAULT_BOSS_STATS[s.key]) throw new Error('vault-encounters: floor '+f+' unknown monster '+s.key); } }
    const hasBoss=r.waves[1].some(s=>s.boss);
    if((f%5===0)!==hasBoss) throw new Error('vault-encounters: floor '+f+' boss rule mismatch');
    if(!(r.dust>0)) throw new Error('vault-encounters: floor '+f+' missing dust');
    if(!Array.isArray(r.gearFragments)||r.gearFragments.length!==2) throw new Error('vault-encounters: floor '+f+' needs exactly 2 gear fragment targets');
    if(gearFrags.size) for(const k of r.gearFragments){ if(!gearFrags.has(k)) throw new Error('vault-encounters: floor '+f+' unknown gear fragment '+k); }
    if(f%5===0 && (!Array.isArray(r.glyphFragments)||!r.glyphFragments.length)) throw new Error('vault-encounters: boss floor '+f+' missing glyph fragments'); });
  VAULT_ENC=fl;
  console.log('🏛  Vault encounters compiled: '+fl.length+' authored floors (fixed waves, authored boss rules, targeted gear fragments).');
}
function vaultFloorRecord(floor){ if(!VAULT_ENC) throw new Error('vault-encounters not compiled'); return VAULT_ENC[Math.max(1,Math.min(DUNGEON_MAX_FLOOR,floor))-1]; }
function buildDungeonWaves(floor){ return vaultFloorRecord(floor).waves; }
// server-side plausibility score of a floor's monsters (mirrors client makeUnit scale=1+0.05*(lvl-1))
function vaultFloorScore(floor){
  let s=0; for(const w of buildDungeonWaves(floor)){ for(const m of w){
    const base=VAULT_MONSTERS[m.key]||VAULT_BOSS_STATS[m.key]||{hp:200,dmg:18};
    const sc=1+0.05*(m.lvl-1); s+= base.hp*sc*(m.hpMul||1)/8 + base.dmg*sc*(m.dmgMul||1)*3; } }
  return s;
}
function vaultTeamScore(snaps){ let s=0; for(const h of snaps){ if(!h) continue; s+= (h.maxHp||0)/8 + (h.atk||0)*3 + (h.heal||0)*2; } return s; }
// AUDIT CR-1 (26 Aug): the client reports the battle outcome BY DESIGN (Phil: real fights, beatable by
// practice, player-chosen backups — a pure server sim can't represent that). But a claimed win is no
// longer taken on faith: the server re-fights the floor with the deterministic sim, granting the player
// a generous SKILL BAND (manual ability timing, focus targeting, backup step-ins beat the auto-sim by a
// lot — but not by anything). A win the boosted sim can't reproduce is rejected and logged. Tune with
// VAULT_SKILL_BAND (default 1.75); set 0 to disable the gate entirely (emergency rollback).
const VAULT_SKILL_BAND=parseFloat(process.env.VAULT_SKILL_BAND||'1.75');
if(!(VAULT_SKILL_BAND>0)) console.warn('🚨 VAULT_SKILL_BAND<=0 — the Vault win sim gate is DISABLED. Never run production like this; wins are then accepted on the score gate alone.');
function vaultSpecToCombatUnit(m){
  const base=VAULT_MONSTERS[m.key]||VAULT_BOSS_STATS[m.key]||{hp:200,dmg:18};
  const sc=1+0.05*((m.lvl|0||1)-1);
  // AUDIT v229 (P0 stat parity): mirror the client's generic boss multipliers exactly — makeUnit
  // applies ×2.4 HP / ×1.8 DMG to boss units and the vault/campaign spawners add a further
  // ×1.15 HP. Without these the estimate fought far weaker bosses than the player does.
  const bh=m.boss?2.4*1.15:1, bd=m.boss?1.8:1;
  // v242 (COMBAT CORE): monsters are typed units too — physical attackers with real base armor/MR
  // through the same diminishing curve; bosses fire a physical cleave kit.
  return { key:m.key, role:(base.role==='Tank'||m.boss)?'Tank':'Bruiser', healer:false,
    maxHp:Math.round(base.hp*sc*(m.hpMul||1)*bh), hp:0, energy:0,
    atkP:Math.round(base.dmg*sc*(m.dmgMul||1)*bd), atkM:0, atk:Math.round(base.dmg*sc*(m.dmgMul||1)*bd),
    heal:0, speed:1,
    armor:(base.armor||0)*sc, mr:(base.mr||0)*sc, armorPen:0, magicPen:0,
    crit:0, critDmg:0.6, critRes:0, energyReg:0, startEnergy:0, regen:0,
    lifesteal:0, eva:0, acc:0, block:0, dmgBonus:1, dmgRed:0, haste:1, shieldStr:1,
    ctrlHit:0, ctrlRes:m.boss?0.5:0, healPow:0,
    kit:m.boss?{kind:'phys',shape:'cleave',coef:2.2,n:2}:{kind:'phys',shape:'nuke',coef:2.2},
    gearSkillSlot:null, gearSkill:null, shieldPool:0 };
}
function vaultWinPlausible(a){
  if(!(VAULT_SKILL_BAND>0)||!SIM) return true;
  try{
    const band=s=>Object.assign({},s,{maxHp:Math.round((s.maxHp||1)*VAULT_SKILL_BAND),
      atk:Math.round((s.atk||0)*VAULT_SKILL_BAND), heal:Math.round((s.heal||0)*VAULT_SKILL_BAND),
      atkP:Math.round((s.atkP||s.atk||0)*VAULT_SKILL_BAND), atkM:Math.round((s.atkM||0)*VAULT_SKILL_BAND)});
    const all=(a.teamSnapshot||[]).filter(Boolean).map(band)
      .sort((x,y)=>((y.maxHp/8+y.atk*3)-(x.maxHp/8+x.atk*3)));
    const five=all.slice(0,5);
    // backups are a real second wind: fold the bench's HP pool onto the line (capped ×2 total)
    if(all.length>5){ const benchHp=all.slice(5).reduce((s,h)=>s+h.maxHp,0);
      const lineHp=five.reduce((s,h)=>s+h.maxHp,0)||1;
      const mul=Math.min(2, 1+benchHp/lineHp);
      five.forEach(h=>{h.maxHp=Math.round(h.maxHp*mul);}); }
    const waves=(a.enemyWaves||[]).map(w=>w.map(vaultSpecToCombatUnit));
    return SIM.resolveTwoWaveBattle(five, waves, SIM.seedFrom('vaultcheck:'+a.id)).result.won;
  }catch(e){ console.error('⚠ vault win validator error:', e&&e.message); return true; }   // never brick the Vault on a validator bug
}
// (rollFragmentOfQuality deleted — Correction Spec v1: no random family roll exists in any live
//  reward path; vault/campaign/arena/daily all use named deterministic tables.)
function makeStandardDungeonFloorReward(floor,rnd){
  // v241 (full-game audit): every part of the floor reward is AUTHORED in vault-encounters.json —
  // Dust, the boss-floor glyph fragments, and the two TARGETED gear fragments (no random roll, so
  // a player can farm a specific floor for a specific item's fragments, like Campaign).
  const rec=vaultFloorRecord(floor);
  const r={ dust:rec.dust };
  if(isDungeonBossFloor(floor)){ r.fragments=(rec.glyphFragments||[]).slice(); }
  if(typeof GEARCAT!=='undefined'&&GEARCAT){ r.gearFragments=(rec.gearFragments||[]).slice(); }
  return r;
}
function makeFirstClearDungeonReward(floor){
  const r=makeStandardDungeonFloorReward(floor);
  if(isDungeonBossFloor(floor)){ r.dust*=2; if(r.fragments) r.fragments=r.fragments.concat(r.fragments); if(r.gearFragments) r.gearFragments=r.gearFragments.concat(r.gearFragments); r.firstClearDoubled=true; }
  return r;
}
function grantDungeonReward(u, r){
  u.dust=(u.dust||0)+r.dust;
  if(r.fragments&&r.fragments.length){ const g=ensureGlyphs(u); for(const k of r.fragments){ g.fragments[k]=(g.fragments[k]||0)+1; } g.revision++; }
  if(r.gearFragments&&r.gearFragments.length&&typeof ensureGear==='function'&&GEARCAT){ const gg=ensureGear(u); for(const k of r.gearFragments){ gg.fragments[k]=(gg.fragments[k]||0)+1; } gg.revision++; }
}
function dungeonView(p){ const floor=p.currentFloor, rule=floor<=DUNGEON_MAX_FLOOR?bossRuleForFloor(floor):null;
  return { currentFloor:p.currentFloor, highestClearedFloor:p.highestClearedFloor, vaultStatus:p.vaultStatus,
    band:dungeonQualityForFloor(Math.min(floor,DUNGEON_MAX_FLOOR)), bossRule:rule,
    isBoss:floor<=DUNGEON_MAX_FLOOR&&isDungeonBossFloor(floor), isMilestone:floor<=DUNGEON_MAX_FLOOR&&isDungeonMilestoneFloor(floor),
    dust:dustForDungeonFloor(Math.min(floor,DUNGEON_MAX_FLOOR)),
    // v255 (80/20 contract §3/§5): the player sees EXACTLY which named materials this floor drops
    // before spending an attempt — glyph fragments on boss floors, gear fragments every floor.
    targets:(function(){ const f=Math.min(floor,DUNGEON_MAX_FLOOR); const rec=VAULT_ENC?vaultFloorRecord(f):null;
      return rec?{ glyphFragments:(rec.glyphFragments||[]).slice(), gearFragments:(rec.gearFragments||[]).slice() }:null; })(),
    sweep:{ freeUsesRemaining:p.sweep.freeUsesRemaining, nextResetAt:dungeonNextReset(), nextCost:vaultSweepNextCost(p.sweep), paidLeft:Math.max(0,VAULT_SWEEP_PAID_COST.length-Math.max(0,(p.sweep.totalSweepsToday|0)-VAULT_SWEEP_FREE)), costs:VAULT_SWEEP_PAID_COST },
    lastTeamHeroIds:p.lastTeamHeroIds||[], activeAttemptId:p.activeAttempt?p.activeAttempt.id:null, version:p.version };
}
/* ====================== end Aether Vault module (routes in api()) ====================== */
/* ==================== SKYFALL TOURNAMENT (Guild Wars v2) — server-authoritative ====================
   SPEC-guild-wars-skyfall.md. Weekly knockout: register Sat→Mon, lock+seed top 16 by Tournament
   Power Pool, rounds Tue–Fri with planning until 6 PM ET and a 2-hour live window. Five locked
   citadels per side; a citadel falls when its last committed defender line is defeated; first to
   three destroyed citadels wins, else the spec's tie-breaker (never a coin flip).
   Everything resolves through the shared deterministic resolver (server/sim.js). The client never
   supplies power, rosters, outcomes, tower state or rewards.
   v258: Skyfall is server-resolved with a tested 16-guild bracket, so it ships ON BY DEFAULT — no
   Railway variable required. Set GUILD_WAR_V2_ENABLED=false to force it off. */
const GUILD_WAR_V2_ENABLED = String(process.env.GUILD_WAR_V2_ENABLED||'true')!=='false';
function warEnabledFor(u){ return !!SIM && (GUILD_WAR_V2_ENABLED || isDev(u)); }
function warNow(){ return Date.now()+((DB.warTimeOffset|0)||0); }   // dev time-warp for lifecycle tests
// AUDIT (26 Aug, high): the old ET_OFFSET_MS=4h constant broke every winter. Exact America/New_York
// offset at any instant via Intl (built into Node, DST-proof, no deps): positive ms behind UTC.
const _etFmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour12:false,
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
function etOffsetMs(t){ const g={}; for(const p of _etFmt.formatToParts(new Date(t))) g[p.type]=p.value;
  return t-Date.UTC(+g.year,+g.month-1,+g.day,(+g.hour)%24,+g.minute,+g.second); }
function nyDayKey(t){ const off=etOffsetMs(t||Date.now()); return new Date((t||Date.now())-off).toISOString().slice(0,10); }
const WAR_LANES=[{key:'iron_gate',name:'Iron Gate'},{key:'storm_watch',name:'Storm Watch'},{key:'crown_spire',name:'Crown Spire'},{key:'verdant_sanctuary',name:'Verdant Sanctuary'},{key:'rift_tower',name:'Rift Tower'}];
const WAR_ASSAULTS_PER_LINE=3;
const WAR_ROUND_NAMES=['R16','QF','SF','F'];

function warWeekAnchor(now){ // most recent Saturday 00:00 ET (DST-exact)
  const off=etOffsetMs(now);
  const et=new Date(now-off);
  const day=et.getUTCDay();                       // 0 Sun … 6 Sat
  const back=(day-6+7)%7;
  const sat=Date.UTC(et.getUTCFullYear(),et.getUTCMonth(),et.getUTCDate()-back);
  return sat+etOffsetMs(sat+off);                 // offset AT the anchor (handles a DST flip mid-week)
}
function warWeekKey(now){ const d=new Date(warWeekAnchor(now)); return d.toISOString().slice(0,10); }
function warSchedule(anchor){ const D=86400000, H=3600000;
  return { registrationOpensAt:anchor, registrationLocksAt:anchor+2*D,           // Sat 00:00 → Mon 00:00 ET
    rounds:[0,1,2,3].map(i=>({ name:WAR_ROUND_NAMES[i],
      planningOpensAt:anchor+(3+i)*D,                                            // AUDIT: Tue/Wed/Thu/Fri 00:00 ET — opponents reveal at planning open, NOT when the Monday bracket is computed
      lockAt:anchor+(3+i)*D+18*H,                                                // Tue–Fri 6 PM ET
      endsAt:anchor+(3+i)*D+20*H })) };                                          // Tue–Fri 8 PM ET
}
function warTierOfGuild(t,gid){
  if(!gid) return 'participant';
  if(t.championGuildId===gid) return 'champion';
  const fin=(t.rounds||[]).some(r=>r.name==='F'&&r.matchIds.some(mid=>{ const m=t.matches[mid]; return m&&(m.aGuildId===gid||m.bGuildId===gid)&&m.winnerGuildId!==gid; }));
  return fin?'finalist':'participant';
}
function warTierAmount(tier){ return tier==='champion'?2000:tier==='finalist'?1000:300; }
function warEscrowRewards(t){   // AUDIT: pay into a per-USER pending list the moment the bracket ends, so
  if(!t||t.escrowedAt) return;  // nothing is lost when the week rolls over and `current` is replaced.
  t.escrowedAt=warNow(); let changed=false;
  for(const e of (t.entrants||[])){
    const tier=warTierOfGuild(t,e.guildId), amt=warTierAmount(tier);
    for(const l of (e.lines||[])){
      const u=DB.users[l.memberId]; if(!u) continue;
      if((t.rewards||{})[e.guildId+':'+l.memberId]) continue;   // already paid under the old live-claim route
      u.pendingWarRewards=u.pendingWarRewards||[];
      if(u.pendingWarRewards.some(x=>x&&x.tid===t.id)) continue;
      u.pendingWarRewards.push({tid:t.id, weekKey:t.weekKey, gid:e.guildId, tier, amt});
      changed=true;
    }
  }
  if(changed) writeDB();
}
function getTournament(){
  DB.tournaments=DB.tournaments||{};
  const now=warNow(), wk=warWeekKey(now);
  if(!DB.tournaments.current || DB.tournaments.current.weekKey!==wk){
    const prev=DB.tournaments.current;
    if(prev){   // AUDIT: settle and archive the outgoing week instead of dropping it on the floor
      try{ for(let i=0;i<8 && prev.state!=='finished';i++){ const v=prev.version; warAdvance(prev); if(prev.version===v) break; } }catch(err){}
      try{ if(prev.state==='finished') warEscrowRewards(prev); }catch(err){}
      DB.tournaments.archive=DB.tournaments.archive||{};
      DB.tournaments.archive[prev.weekKey]=prev;
      const ak=Object.keys(DB.tournaments.archive).sort(); while(ak.length>8) delete DB.tournaments.archive[ak.shift()];
    }
    const anchor=warWeekAnchor(now), sch=warSchedule(anchor);
    DB.tournaments.current={ id:'gw_'+wk, weekKey:wk, state:'registration',
      registrationOpensAt:sch.registrationOpensAt, registrationLocksAt:sch.registrationLocksAt,
      schedule:sch.rounds, entrants:[], rounds:[], matches:{}, rewards:{}, version:0 };
    writeDB();
  }
  return DB.tournaments.current;
}
function buildRegisteredLine(u){ // best legal five-hero line from SERVER-owned data
  const save=parseSaveOf(u);
  const rled=ensureLedger(u);   // AUDIT v229 (P0): only heroes this member actually OWNS count toward war power
  const all=Object.keys(SIM.HERO_BASE).filter(k=>rled.unlocked[k]).map(k=>snapshotHeroFromServer(u,k,save)).filter(Boolean);
  all.sort((a,b)=>(b.maxHp/8+b.atk)-(a.maxHp/8+a.atk));
  const line=all.slice(0,5);
  return { memberId:u.id, name:u.name, heroes:line, power:Math.round(line.reduce((s,h)=>s+h.maxHp/8+h.atk,0)) };
}
function warQualifyGuild(g){
  const lines=(g.members||[]).map(id=>DB.users[id]).filter(u=>u&&!u.isNpc).map(buildRegisteredLine);
  return { guildId:g.id, name:g.name, lines, powerPool:lines.reduce((s,l)=>s+l.power,0) };
}
function warNewMatch(t, roundIndex, aEnt, bEnt){
  const mkSide=ent=>({ guildId:ent?ent.guildId:null, name:ent?ent.name:'— bye —',
    citadels:WAR_LANES.map((l,i)=>({ lane:i, key:l.key, destroyed:false, defenders:[] })),
    unplaced:(ent?ent.lines.map(l=>l.memberId):[]) });
  const m={ id:'gwm_'+uid(), tournamentId:t.id, roundIndex, state:'planning',
    aGuildId:aEnt?aEnt.guildId:null, bGuildId:bEnt?bEnt.guildId:null,
    revealAt:t.schedule[roundIndex].planningOpensAt,   // opponent hidden + placement closed before this
    planningEndsAt:t.schedule[roundIndex].lockAt, startsAt:t.schedule[roundIndex].lockAt, endsAt:t.schedule[roundIndex].endsAt,
    winnerGuildId:null, sides:{}, assaults:{}, eventLog:[], version:0 };
  if(aEnt) m.sides[aEnt.guildId]=mkSide(aEnt);
  if(bEnt) m.sides[bEnt.guildId]=mkSide(bEnt);
  if(aEnt&&!bEnt){ m.state='finished'; m.winnerGuildId=aEnt.guildId; m.eventLog.push({t:warNow(),e:'BYE'}); }
  if(!aEnt&&bEnt){ m.state='finished'; m.winnerGuildId=bEnt.guildId; m.eventLog.push({t:warNow(),e:'BYE'}); }
  t.matches[m.id]=m; return m;
}
function warEntrant(t,gid){ return t.entrants.find(e=>e.guildId===gid); }
function warLockMatch(t,m){ // 6 PM: snapshot every line into its citadel; unassigned members auto-spread
  // AUDIT (26 Aug, CR-4): snapshots are rebuilt FRESH at lock time from server-owned data — glyph/gear/
  // level changes made during planning count. The registration-time entrant is only the fallback if the
  // guild object has vanished. After this, m.state='live' and every placement change is rejected.
  m.lockedAt=warNow();
  for(const gid of Object.keys(m.sides)){ const side=m.sides[gid];
    const gobj=(DB.guilds||{})[gid];
    const ent=gobj?warQualifyGuild(gobj):warEntrant(t,gid); if(!ent) continue;
    // auto-place any member the leader never assigned, round-robin across lanes
    let lane=0;
    for(const mid of (side.unplaced||[])){ side.citadels[lane%5].defenders.push({memberId:mid}); lane++; }
    side.unplaced=[];
    for(const c of side.citadels){ c.defenders=c.defenders.map(d=>{ const line=ent.lines.find(l=>l.memberId===d.memberId);
      return line?{ memberId:d.memberId, name:line.name, lineSnapshot:JSON.parse(JSON.stringify(line.heroes)),
        hpState:line.heroes.map(h=>({hp:h.maxHp,energy:0})), alive:true }:null; }).filter(Boolean); } }
  m.state='live'; m.version++; m.eventLog.push({t:warNow(),e:'WAR_LOCKED'});
}
function warSurvivorHpPct(side){ let hp=0,max=0;
  for(const c of side.citadels) for(const d of c.defenders){ for(let i=0;i<d.lineSnapshot.length;i++){ max+=d.lineSnapshot[i].maxHp; if(d.alive) hp+=Math.max(0,d.hpState[i].hp); } }
  return max?hp/max:0; }
function warDestroyedCount(m,gid){ const opp=Object.keys(m.sides).find(x=>x!==gid); return opp?m.sides[opp].citadels.filter(c=>c.destroyed).length:0; }
function warFinishMatch(t,m,winnerGid,why){ m.state='finished'; m.winnerGuildId=winnerGid; m.version++; m.eventLog.push({t:warNow(),e:'FINISHED',winner:winnerGid,why}); }
function warTiebreak(t,m){ // destroyed → surviving HP% → power at lock → higher seed. No coin flip.
  const [ga,gb]=Object.keys(m.sides);
  const da=warDestroyedCount(m,ga), db=warDestroyedCount(m,gb);
  if(da!==db) return warFinishMatch(t,m, da>db?ga:gb, 'citadels');
  const ha=warSurvivorHpPct(m.sides[ga]), hb=warSurvivorHpPct(m.sides[gb]);
  if(Math.abs(ha-hb)>1e-9) return warFinishMatch(t,m, ha>hb?ga:gb, 'hp');
  const pa=(warEntrant(t,ga)||{}).powerPool||0, pb=(warEntrant(t,gb)||{}).powerPool||0;
  if(pa!==pb) return warFinishMatch(t,m, pa>pb?ga:gb, 'power');
  const sa=(warEntrant(t,ga)||{}).seed||99, sb=(warEntrant(t,gb)||{}).seed||99;
  return warFinishMatch(t,m, sa<sb?ga:sb<sa?gb:ga, 'seed');
}
function warAdvance(t){ // lazy state machine, called on every /api/guild-war request
  const now=warNow(); let changed=false;
  if(t.state==='registration' && now>=t.registrationLocksAt){
    // AUDIT C8: qualification is computed AT the Monday lock, not at signup. Registration held only
    // {guildId, registeredAt}; here every registered guild's power pool is recomputed from CURRENT
    // server data (current members, current ledger-backed lines), then the top 16 are seeded.
    t.entrants=t.entrants.map(e=>{ const g=(DB.guilds||{})[e.guildId];
      return g?Object.assign(warQualifyGuild(g),{registeredAt:e.registeredAt||0}):e; }).filter(e=>e&&e.lines);
    t.entrants.sort((a,b)=>b.powerPool-a.powerPool);
    t.entrants=t.entrants.slice(0,16);
    t.entrants.forEach((e,i)=>e.seed=i+1);
    t.state=t.entrants.length>=2?'bracket':'finished';
    if(t.state==='bracket'){ // standard seeding on the smallest power-of-two bracket (2..16): 1 v N, 2 v N-1, …
      const n=t.entrants.length; let size=2; while(size<n) size*=2; size=Math.min(16,size);
      const pairs=[]; for(let i=0;i<size/2;i++){ pairs.push([t.entrants[i]||null, t.entrants[size-1-i]||null]); }
      /* v327 — NAME THE ROUNDS FOR THE BRACKET THAT ACTUALLY EXISTS. Every bracket used to start at
         'R16', so a 4- or 8-guild tournament never produced a round named 'F': the runner-up check
         at warRewardFor() found no final, and the losing finalist was paid the participant reward.
         base is chosen so the LAST round is always 'F' (16->0, 8->1, 4->2, 2->3). */
      const base=WAR_ROUND_NAMES.length-Math.round(Math.log2(size));
      t.roundBase=base;
      const round={name:WAR_ROUND_NAMES[base]||'R16', matchIds:[]};
      for(const [a,b] of pairs){ if(!a&&!b) continue; const m=warNewMatch(t,0,a,b); round.matchIds.push(m.id); }
      t.rounds=[round]; t.roundIndex=0;
    }
    changed=true;
  }
  if(t.state==='bracket'){
    const ri=t.roundIndex, sch=t.schedule[ri]; const round=t.rounds[ri];
    if(round){
      for(const mid of round.matchIds){ const m=t.matches[mid];
        if(m.state==='planning' && now>=m.planningEndsAt){ warLockMatch(t,m); changed=true; }
        if(m.state==='live' && now>=m.endsAt){ warTiebreak(t,m); changed=true; } }
      const allDone=round.matchIds.every(mid=>t.matches[mid].state==='finished');
      if(allDone){
        const winners=round.matchIds.map(mid=>warEntrant(t,t.matches[mid].winnerGuildId)).filter(Boolean);
        const _rb=(t.roundBase|0);
        if(winners.length<=1 || (_rb+ri)>=3){ t.state='finished'; t.championGuildId=winners.length?winners[0].guildId:null; warEscrowRewards(t); changed=true; }
        else if(now>=t.schedule[ri+1].planningOpensAt){
          const next={name:WAR_ROUND_NAMES[_rb+ri+1]||'F', matchIds:[]};
          for(let i=0;i<winners.length;i+=2){ const m=warNewMatch(t,ri+1,winners[i]||null,winners[i+1]||null); next.matchIds.push(m.id); }
          t.rounds.push(next); t.roundIndex=ri+1; changed=true; }
      }
    }
  }
  if(changed){ t.version++; writeDB(); }
  return t;
}
function warMatchOfGuild(t,gid){ if(!t.rounds) return null;
  for(let ri=t.rounds.length-1;ri>=0;ri--){ for(const mid of t.rounds[ri].matchIds){ const m=t.matches[mid];
    if(m.aGuildId===gid||m.bGuildId===gid) return m; } } return null; }
function warSideView(m,gid,full){ const s=m.sides[gid]; if(!s) return null;
  return { guildId:gid, name:s.name, citadels:s.citadels.map(c=>({ lane:c.lane, key:c.key, destroyed:c.destroyed,
    defenders:c.defenders.map(d=>({ memberId:d.memberId, name:d.name||nameOfUser(d.memberId), alive:d.alive!==false,
      hpPct:d.hpState?Math.round(100*d.hpState.reduce((x,h,i)=>x+Math.max(0,h.hp),0)/Math.max(1,d.lineSnapshot.reduce((x,h)=>x+h.maxHp,0))):100,
      assaultsLeft: WAR_ASSAULTS_PER_LINE-((m.assaults||{})[d.memberId]||0) })), unplaced:(c===s.citadels[0])?(s.unplaced||[]).length:undefined })) };
}
function nameOfUser(id){ const u=DB.users[id]; return u?u.name:'—'; }
function warMatchView(t,m,meGid){
  const preReveal=m.state==='planning' && warNow()<(m.revealAt||0);   // AUDIT: opponent hidden until the round's planning opens (Tue+ 00:00 ET)
  const v={ id:m.id, round:WAR_ROUND_NAMES[m.roundIndex], state:m.state,
    revealAt:m.revealAt||0, preReveal, lockedAt:m.lockedAt||0,
    planningEndsAt:m.planningEndsAt, startsAt:m.startsAt, endsAt:m.endsAt, winnerGuildId:m.winnerGuildId,
    you:warSideView(m,meGid), foe:preReveal?null:warSideView(m, Object.keys(m.sides).find(g=>g!==meGid)),
    lanes:WAR_LANES, version:m.version, eventLog:(m.eventLog||[]).slice(-30) };
  if(m.state==='planning' && v.you){ // officer placement roster: every registered member + current lane
    const ent=warEntrant(t,meGid), side=m.sides[meGid];
    if(ent&&side){ const laneOf={}; side.citadels.forEach(c=>c.defenders.forEach(d=>{laneOf[d.memberId]=c.lane;}));
      v.you.roster=ent.lines.map(l=>({memberId:l.memberId,name:l.name,power:l.power,
        lane:(l.memberId in laneOf)?laneOf[l.memberId]:null})); } }
  return v;
}
/* ====================== end Skyfall module (routes in api()) ====================== */

/* ==================== LEDGER (economy authority, audit C1 — Phase A) ====================
   Server-owned per-account ledgers: wallet (gold/gems), player XP, hero progression (xp/stars/pips/
   unlocked/fragments), campaign progress (cleared/stars), stamina, and a bounded transaction log —
   every grant/debit carries a source transaction id. Seeded ONCE from the legacy client save
   (legitimate balances kept, clamped by the same sanitize rules), after which the ledger is the only
   authority: the client mirrors it for display and requests mutations through validated endpoints.
   Client-resolved legacy loops (tower/gauntlet/quests/mail/market) earn ONLY through the capped,
   logged /api/tx/earn table until they are individually moved server-side. */
const STARTER_HEROES=['vael','sylthaine','vireo'];
const LEDGER_TX_KEEP=300;
const LEDGER_MIGRATE_CUTOFF=1787776176312;   // v227 transformation deploy time
/* ==================== INTEGRITY REPORTS + BANS (Phil, 30 Aug) ====================
   The ruling: DO NOT ROLL BACK. A rollback punishes a legitimate player for a detector's guess, and
   the detector is guessing. Instead every suspicious gain is recorded, surfaced in the dev panel,
   and left in the player's account until a human looks at it. If they are guilty the account is
   banned for 1, 7 or 30 days; if they are not, nothing was taken from them in the meantime.

   The trigger is Phil's: more than SPIKE_GEMS diamonds gained inside SPIKE_MS. */
const SPIKE_GEMS = 2000;            // diamonds…
const SPIKE_MS   = 60000;           // …inside one minute → report it
const SEED_REPORT_GEMS = 20000;     // an account whose FIRST ledger is seeded above this is reported
const REPORTS_KEEP = 500;
const GEM_LOG_KEEP = 400;           // per-account gem-gain history the weekly audit reads
const BAN_DAYS_ALLOWED = [1, 7, 30];

function devReport(u, kind, amount, detail){
  DB.reports = Array.isArray(DB.reports) ? DB.reports : [];
  const r = { id: uid(), t: Date.now(), userId: u.id, name: u.name || u.id,
              kind, amount: amount|0, detail: String(detail||'').slice(0,300),
              resolved: false, action: null };
  DB.reports.push(r);
  if(DB.reports.length > REPORTS_KEEP) DB.reports = DB.reports.slice(-REPORTS_KEEP);
  console.log('🚩 integrity report — ' + (u.name||u.id) + ': ' + r.detail);
  writeDB();
  return r;
}

/* Every diamond GAIN goes through here. It records the gain, watches the rolling window, and files
   a report when the window is exceeded. It never blocks and never reverses — the caller's grant
   stands either way. */
function gemGain(u, amount, reason){
  amount = Math.floor(+amount || 0);
  if(!(amount > 0)) return amount;
  const now = Date.now();
  u.gemLog = Array.isArray(u.gemLog) ? u.gemLog : [];
  u.gemLog.push({ t: now, n: amount, r: String(reason||'misc').slice(0,32) });
  if(u.gemLog.length > GEM_LOG_KEEP) u.gemLog = u.gemLog.slice(-GEM_LOG_KEEP);
  let win = 0;
  for(let i = u.gemLog.length - 1; i >= 0; i--){
    if(now - u.gemLog[i].t > SPIKE_MS) break;
    win += u.gemLog[i].n;
  }
  if(win > SPIKE_GEMS){
    // one report per window, not one per grant, or a burst files fifty of them
    const last = (DB.reports||[]).filter(r => r.userId === u.id && r.kind === 'gem-spike').pop();
    if(!last || now - last.t > SPIKE_MS){
      devReport(u, 'gem-spike', win, '+' + win + ' diamonds in under ' +
        Math.round(SPIKE_MS/1000) + 's (latest: ' + amount + ' from ' + reason + ')');
    }
  }
  return amount;
}

/* A player's diamond history for the dev panel's weekly audit. */
function gemAudit(u, days){
  const since = Date.now() - (days||7)*86400000;
  const gains = (u.gemLog||[]).filter(e => e.t >= since);
  const led = u.led;
  const txs = (led && Array.isArray(led.txs) ? led.txs : [])
    .filter(t => t.t >= since && t.d && typeof t.d.gems === 'number');
  const byReason = {};
  for(const g of gains) byReason[g.r] = (byReason[g.r]||0) + g.n;
  return {
    userId: u.id, name: u.name || u.id, days: days||7,
    balance: led ? (led.gems|0) : null,
    totalGained: gains.reduce((a,g) => a + g.n, 0),
    byReason,
    gains: gains.slice(-200),
    ledgerTxs: txs.slice(-200),
    banned: banInfo(u),
  };
}

function banInfo(u){
  const until = u.bannedUntil || 0;
  return until > Date.now() ? { until, daysLeft: Math.ceil((until - Date.now())/86400000), reason: u.banReason || '' } : null;
}
function isBanned(u){ return !!(u && (u.bannedUntil||0) > Date.now()); }

function ensureLedger(u){

  if(u.led && u.led.migratedAt) return u.led;
  // AUDIT v229 (P0): only accounts that EXISTED before the v227 transformation may seed their
  // ledger from the uploaded save (their real pre-ledger progress, one time). Accounts created
  // after the cutoff get the fixed STARTER ledger — a forged client save can never become
  // server progress on a new account.
  /* 30 Aug (Phil) — A NEW ACCOUNT NO LONGER THROWS THE PLAYER'S WALLET AWAY.
     This used to seed from the uploaded save ONLY for accounts that existed before the v227
     transformation; everyone else got `led.gold=1000; led.gems=300` and whatever they had actually
     earned was discarded. Because 'gems' is on SERVER_OWNED_SAVE_FIELDS it was then deleted out of
     the stored save, so the number was gone for good. A guest who played for a week and then made
     an account watched their diamonds reset to 300, permanently. That was the missing diamonds.
     The cutoff existed to stop a forged client save becoming server progress on a fresh account.
     Phil's ruling (30 Aug) is that we do not punish on suspicion: seed the real balance, clamp the
     impossible, and REPORT anything implausible to the dev panel for a human to judge — never a
     silent rollback. So every account is now seeded from its own save, clamped by ECON_CAP exactly
     as sanitizeSave clamps it, and a large seed files a report. */
  const legacy=((u.created||0)===0) || ((u.created||0)<LEDGER_MIGRATE_CUTOFF);
  const sv=parseSaveOf(u)||{};
  /* "Has this player actually played?" cannot be answered by asking whether the save HAS a gold
     field — a brand-new client's DEFAULT_G already carries gold:200, gems:0, so that test seeded
     every new account with 200/0 instead of the 1,000/300 starter. Take the LARGER of the save and
     the starter instead: a fresh player gets the starter, a guest who earned keeps their earnings,
     and a guest who spent down is topped back up (harmless, and in the player's favour). */
  const STARTER_GOLD=1000, STARTER_GEMS=300;
  const led={ v:1, migratedAt:Date.now(), rev:1,
    gold:Math.max(0,Math.min(100000000, (sv.gold|0)||0)),
    gems:Math.max(0,Math.min(2000000, (sv.gems|0)||0)),
    px:Math.max(0,Math.min(99000000,(sv.playerXP|0)||0)),
    hero:{}, unlocked:{}, frags:{},
    camp:{ cleared:Math.max(0,Math.min(100,(sv.campaignCleared|0)||0)), stars:{}, att:null },
    stam:{ v:60, ts:Date.now() },
    txs:[] };
  const hx=sv.heroXP||{}, st=sv.starLevel||{}, sp=sv.starPip||{}, un=sv.unlocked||{}, fr=sv.heroFrag||sv.heroFrags||{}, rf=sv.starRefine||{};
  for(const k of Object.keys(SIM.HERO_BASE)){
    const anyx=(hx[k]|0)||0;
    if(anyx>0||un[k]||STARTER_HEROES.includes(k)) led.unlocked[k]=true;
    led.hero[k]={ xp:Math.max(0,Math.min(99000000,anyx)),
      stars:Math.max(SIM.HERO_BASE[k].stars,Math.min(5,(st[k]|0)||SIM.HERO_BASE[k].stars)),
      pips:Math.max(0,Math.min(5,(sp[k]|0)||0)), ref:Math.max(0,Math.min(15,(rf[k]|0)||0)) };
    if((fr[k]|0)>0) led.frags[k]=Math.min(9999,fr[k]|0);
  }
  const ss=sv.stageStars||{}; for(const n in ss){ const v=ss[n]|0; if(v>=1&&v<=3) led.camp.stars[n]=v; }
  led.stam.v=Math.max(0,Math.min(200,(sv.stamina|0)||60));
  if(!legacy){ led.gold=Math.max(led.gold, STARTER_GOLD); led.gems=Math.max(led.gems, STARTER_GEMS); }
  u.led=led;
  ledTx(u, legacy?'migrate:legacy-save':'migrate:from-save', {gold:led.gold, gems:led.gems});
  // an implausible opening balance is REPORTED, not reversed — a human decides
  if(led.gems>SEED_REPORT_GEMS){
    devReport(u,'seed', led.gems, 'account seeded with '+led.gems+' diamonds from its uploaded save');
  }
  return led;
}
/* ===================== v270 — PLAYER-TRUTH BATTLE SPEC =====================
   The server freezes what a hero IS at the moment Battle is pressed, in the shape the client's own
   unit builder consumes. The browser never supplies combat power: it is handed the resolved snapshot
   and fights with exactly the numbers the server will replay. */
/* The server runs THE CLIENT'S OWN battle code (server/sim-host.js loads it into a VM with a stubbed
   browser). One engine, one result: the fight the player played is the fight the server replays. */
let _SIMHOST=null, _SIMHOST_ERR=null;
function simHost(){
  if(_SIMHOST||_SIMHOST_ERR) return _SIMHOST;
  try{ const t0=Date.now(); _SIMHOST=require('./server/sim-host.js').load(GAME_FILE);
    console.log('⚔️  sim-host ready — the client battle engine is loaded server-side ('+(Date.now()-t0)+'ms)');
  }catch(e){ _SIMHOST_ERR=e; console.error('🚨 sim-host FAILED to load — campaign results cannot be verified:', e.message); }
  return _SIMHOST;
}
/* v274 (hardening directive §4) — VALUABLE ROLLS COME FROM A SERVER SECRET.
   Several rewards were seeded from `SIM.seedFrom(... + requestId)`, and requestId is chosen by the
   client — so a player could grind request ids locally until one produced a win or a bigger fragment
   drop, without ever touching the game. Rolls are now HMAC(server secret, domain | account | index),
   which the client cannot search, and the secret never leaves the server. */
/* v275 (§2 P0) — the roll secret is deployment-managed, or durably persisted and SAID OUT LOUD.
   A secret that lives only in memory would change on every restart, which would change the audited
   result of an in-flight transaction and break replay of anything derived from it. Preference order:
   the deployment's own secret; otherwise one generated ONCE and written durably before it is used. */
let _secretWarned=false;
function serverSecret(){
  if(process.env.SERVER_SECRET) return process.env.SERVER_SECRET;
  DB.meta=DB.meta||{};
  if(!DB.meta.rollSecret){
    DB.meta.rollSecret=crypto.randomBytes(32).toString('hex');
    writeDBNow();                                   // durable BEFORE any roll can use it
  }
  if(!_secretWarned){ _secretWarned=true;
    console.warn('⚠️  SERVER_SECRET is not set — using the durably stored fallback secret. Set SERVER_SECRET in deployment secrets.'); }
  return DB.meta.rollSecret;
}
function secretSource(){ return process.env.SERVER_SECRET?'deployment-env':'persisted-fallback'; }
function srvSeed(domain, ...parts){
  const h=crypto.createHmac('sha256', serverSecret()).update([domain,...parts].join('|')).digest();
  return h.readUInt32BE(0)>>>0;
}
/* The live action channel's server half. Kept next to the other authority helpers, not inside the
   websocket block, so the campaign routes can read the accepted list without reaching into it. */
/* v275 (§2 P0) — THE ACTION CHANNEL HAS ITS OWN BUDGET.
   MUT_PER_MIN covers POST routes; a socket bypasses it entirely. A session may send only so many
   actions, only so fast, and may only be wrong so many times before the socket is closed. Nothing
   here punishes a legitimate player: a real battle produces a handful of actions a second at most. */
const ACT_KINDS=Object.freeze(['ult','gear','auto','speed','begin','abandon']);
const ACT_PER_SEC=8;                   // ceiling on accepted actions per second, per session
const ACT_INVALID_BUDGET=25;           // refusals a session may accumulate before the socket closes
const ACT_BYTES_MAX=512;               // one action frame is tiny; anything larger is not an action
const ACT_MAX=400;                     // the same cap the transcript has always had
function findOpenSession(u, sid){
  const led=u.led; if(!led) return null;
  for(const m of PORTAL_MODES){ const pr=portalProg(led,m);
    if(pr && pr.att && pr.att.id===sid) return {mode:m, prog:pr, att:pr.att}; }
  return null;
}
/* v275 (§2 P0) — THE SERVER ASSIGNS THE TICK.
   v274 let the browser name the tick and only refused one that was too far ahead. That still allowed
   a modified client to place an action at a chosen earlier-but-monotonic moment after watching how
   the fight developed. Now the server runs its own clock for the session — anchored by a `begin`
   receipt, integrated across the player's own `speed` changes, at the client's exact tick rate — and
   the accepted tick is computed HERE. The tick the client sends is recorded as diagnostics only and
   never decides where the action lands.

   The client cannot apply an action before it knows the accepted tick, so the tick is placed
   ACT_INPUT_DELAY ticks in the future: enough for the receipt to come back over a normal connection.
   If the round trip is slower than that, the client holds the simulation rather than guessing — a
   brief hitch on a bad network, never a fight that disagrees with its own record. */
const STALL_BUDGET_MS=300*1000;        // total wall time a session may hold its clock frozen
const ACT_INPUT_DELAY=9;               // ≈300 ms of headroom at the client's real tick rate
const SIM_HZ_SRV=30, BATTLE_PACE_SRV=0.82;   // must match the client's constants exactly
function sessionClock(a){
  a.clock=a.clock||{ beginAt:0, speed:1, tick:0, at:0, stalled:false, stallMs:0 };
  return a.clock;
}
function clockAdvance(a, now){
  const c=sessionClock(a);
  if(!c.beginAt) return c;                       // the battle has not started yet
  const dt=Math.max(0,(now-(c.at||c.beginAt))/1000);
  /* v327: the browser's sim is stopped (pause, aim, wave cinematic) — do not invent ticks it did
     not run. The frozen time is spent against a budget instead. */
  if(c.stalled){ c.stallMs=(c.stallMs||0)+dt*1000; c.at=now; return c; }
  c.tick += dt*SIM_HZ_SRV*BATTLE_PACE_SRV*(c.speed||1);
  c.at=now;
  return c;
}
function findOpenSession(u, sid){
  const led=u.led; if(!led) return null;
  for(const m of PORTAL_MODES){ const pr=portalProg(led,m);
    if(pr && pr.att && pr.att.id===sid) return {mode:m, prog:pr, att:pr.att}; }
  return null;
}
function streamAction(u, m, ws){
  const sid=String(m.sessionId||'').slice(0,48);
  const found=findOpenSession(u, sid);
  if(!found) return {ok:false, reason:'no-session'};
  const a=found.att;
  const now=Date.now();
  if(now-(a.startedAt||0) > CAMP_SESSION_MS) return {ok:false, reason:'expired'};
  a.stream=a.stream||{ seq:0, acts:[], chain:'', invalid:0, sec:{t:0,n:0} };
  const st=a.stream;
  if(st.closed) return {ok:false, reason:'session-ended'};
  /* v328: the give-up frame must tear down the partial list REGARDLESS of sequence — after a
     dropped frame the client is one ahead, and an abandon refused 'out-of-order' left a truncated
     server transcript that then out-ranked the client's complete log at resolve. */
  if(String(m.kind||'')==='abandon'){
    st.acts=[]; st.broken=true; st.seq=Math.max(st.seq|0, m.seq|0);
    return {ok:true, abandoned:true, accepted:st.seq};
  }
  /* A battle RESTARTED (or resumed) on the same attempt starts its stream over: the client resets its
     sequence and re-sends `begin` at seq 1. Without this the first fight's stream refuses every message
     of the second one ('out-of-order', and 'already-begun' on the anchored clock), the client silently
     drops those actions, and the attempt resolves from the ABANDONED fight's transcript. Rebuild the
     stream and the clock, but carry the refusal count over so restarting cannot launder strikes. */
  if(String(m.kind||'')==='begin' && (m.seq|0)===1 && ((st.seq|0)>0 || (a.clock && a.clock.beginAt))){
    const rs=(st.restarts|0)+1;
    if(rs>12) return {ok:false, reason:'too-many-restarts', strikes:(st.invalid|0)};
    a.stream={ seq:0, acts:[], chain:'', invalid:(st.invalid|0), sec:{t:0,n:0}, restarts:rs };
    a.clock={ beginAt:0, speed:1, tick:0, at:0 };
    return streamAction(u, m, ws);          // re-enter against the fresh stream: normal `begin` path
  }

  const bad=(reason,extra)=>{ st.invalid=(st.invalid|0)+1;
    if(st.invalid>ACT_INVALID_BUDGET && ws){ try{ ws.close(); }catch(e){} }
    return Object.assign({ok:false, reason, strikes:st.invalid}, extra||{}); };

  /* v327 — WHEN THE CLIENT'S SIM STOPS, THIS CLOCK MUST STOP WITH IT.
     A pause, an aim-drag and the wave-transition cinematic all hold the browser's tick while this
     clock kept integrating wall time, so every later action was scheduled further into the future —
     ultimates landing seconds late, then past the end of the fight and never firing at all. A
     `stall` frame is handled OUT OF BAND: it carries no sequence number, adds nothing to the
     transcript or the chain, cannot desync the action channel, and the time it buys is bounded. */
  if(String(m.kind||'')==='stall'){
    const cs=sessionClock(a);
    if(!cs.beginAt) return {ok:false, reason:'not-begun', stall:true};
    const ssec=Math.floor(now/1000);
    if(cs.sn!==ssec){ cs.sn=ssec; cs.snN=0; }
    cs.snN=(cs.snN|0)+1;
    if(cs.snN>16) return {ok:true, stall:true, ignored:true};   // spam is dropped, not punished
    clockAdvance(a, now);
    cs.stalled = m.value ? ((cs.stallMs||0) < STALL_BUDGET_MS) : false;
    cs.at=now;
    return {ok:true, stall:true, stalled:!!cs.stalled};
  }

  const seq=m.seq|0;
  if(seq!==st.seq+1) return bad('out-of-order',{expected:st.seq+1});
  if(st.acts.length>=ACT_MAX) return bad('too-many-actions');

  /* a per-second ceiling on ACCEPTED actions, per session */
  const sec=Math.floor(now/1000);
  if(st.sec.t!==sec){ st.sec={t:sec,n:0}; }
  if(st.sec.n>=ACT_PER_SEC) return bad('too-fast');

  const kind=String(m.kind||'');
  if(ACT_KINDS.indexOf(kind)<0) return bad('bad-kind');

  /* v275 — WHEN THE CHANNEL DIES MID-FIGHT.
     A receipt that never arrives would otherwise hold the player's battle forever. The client gives
     up after a few seconds and says so; the server then drops its partial list, because half a
     transcript would replay as a different fight than the one being played. The session falls back to
     the submitted log and the RESULT SAYS SO — `submitted-log-after-stream-loss` — so a lost stream
     is visible in the receipt rather than looking like a clean live session. */
  /* (abandon is handled above the sequence check — see the v328 note near the top of this function) */

  /* `begin` anchors the server's clock to the moment the battle actually started running. */
  if(kind==='begin'){
    const c=sessionClock(a);
    if(c.beginAt) return bad('already-begun');
    c.beginAt=now; c.at=now; c.tick=0; c.speed=1;
    st.seq=seq; st.sec.n++;
    return {ok:true, tick:0, accepted:st.seq, chain:st.chain.slice(0,16), begun:true};
  }
  const c=clockAdvance(a, now);
  if(!c.beginAt) return bad('not-begun');

  /* THE ACCEPTED TICK — computed here, from this clock, never taken from the message. */
  const lastTick=st.acts.length?st.acts[st.acts.length-1][0]:-1;
  let acceptedTick=Math.ceil(c.tick)+ACT_INPUT_DELAY;
  if(acceptedTick<=lastTick) acceptedTick=lastTick+1;
  if(acceptedTick>SIM_TICK_MAX) return bad('past-the-end');

  if(kind==='speed'){
    const v=+m.value; const sp=(v===0.5||v===1||v===2)?v:null;
    if(sp===null) return bad('bad-speed');
    c.speed=sp;                                   // integrated from here on
    st.seq=seq; st.sec.n++;
    st.acts.push([acceptedTick,'speed',-1,Math.round(sp*100),null,null]);
    st.chain=sha256hex(st.chain+'|'+acceptedTick+',speed,'+sp);
    return {ok:true, tick:acceptedTick, accepted:st.seq, chain:st.chain.slice(0,16)};
  }

  const uid=m.casterUid|0, tid=(m.targetUid==null?-1:(m.targetUid|0));
  if(kind!=='auto' && !(uid>=0&&uid<64)) return bad('bad-caster');
  const clamp=(v,hi)=>(v==null||!isFinite(v))?null:Math.max(0,Math.min(hi,+(+v).toFixed(2)));
  const entry=[acceptedTick, kind, (kind==='auto'?-1:uid),
    (kind==='auto'?((m.value?1:0)) : ((tid>=0&&tid<64)?tid:-1)),
    clamp(m.wx,FIELD_W), clamp(m.wy,FIELD_D)];
  st.acts.push(entry);
  st.seq=seq; st.sec.n++;
  st.chain=sha256hex(st.chain+'|'+entry.join(','));
  st.lastAt=now;
  /* clientTick is kept ONLY to measure drift between the two clocks; it decides nothing. */
  st.drift=(m.tick|0)-acceptedTick;
  return {ok:true, tick:acceptedTick, accepted:st.seq, chain:st.chain.slice(0,16), clientTick:(m.tick|0)};
}
function srvRoll(domain, ...parts){ return srvSeed(domain,...parts)/4294967296; }
function sha256hex(x){ return crypto.createHash('sha256').update(String(x)).digest('hex').slice(0,32); }
/* Bumped by hand on every server change that a deployment proof needs to see. */
const EQ_MAT_KEYS=Object.freeze(['cloth','blade','wood','ore']);   // the four equipment materials
/* Which base material a Grey (Tier-0) piece of each slot is crafted from, per group — the exact
   table the client draws its recipes from (EQ_SLOT_BASE), indexing into EQ_MAT_KEYS. */
const EQ_SLOT_BASE_SRV=Object.freeze({ plate:[1,0,3,0,3,2], ranged:[2,0,0,2,2,3], caster:[2,0,0,0,0,3] });
const EQ_CRAFT_MAT_COST=2;   // a Grey piece costs 2 of its base material
const SERVER_BUILD='v275-server-ticks';
const CAMP_SESSION_MS=30*60*1000;   // v273: a frozen battle session is good for 30 minutes
const SKILL_MAX_SRV=10;
const SKILL_UP_BASE_SRV=[300,220,260,400];   // mirrors the client's SKILL_UP_BASE (ult / green / blue / passive)
function ledSkillArr(led,key){ led.skill=led.skill||{}; const a=led.skill[key];
  if(!Array.isArray(a)||a.length!==4){ led.skill[key]=[1,1,1,1]; }
  return led.skill[key]; }
/* One-time import: skill levels have only ever lived in the browser save, so an existing player would
   otherwise lose what they bought. Imported once, clamped, and server-owned from then on. */
function ledSkillImport(u){ const led=u.led; if(!led || led.skillImported) return;
  led.skill=led.skill||{}; led.prayer=led.prayer|0;
  /* v273 (audit response P0): ONLY an account that predates the ledger may seed from the uploaded
     save — exactly the rule ensureLedger() uses. Importing for everyone (as v270 did) meant a
     modified client could post skill levels and prayer and have the server adopt them once. */
  const legacy=((u.created||0)===0) || ((u.created||0)<LEDGER_MIGRATE_CUTOFF);
  if(!legacy){ led.skillImported=Date.now(); return; }
  try{ const sv=parseSaveOf(u)||{}; const sl=sv.skillLevel||{};
    for(const k in sl){ const a=sl[k]; if(!Array.isArray(a)) continue;
      led.skill[k]=[0,1,2,3].map(i=>Math.max(1,Math.min(SKILL_MAX_SRV,(a[i]|0)||1))); }
    led.prayer=Math.max(0,Math.min(200,(sv.prayer|0)||0));
  }catch(e){}
  led.skillImported=Date.now(); }
/* The transcript is player-supplied data, so it is normalised before it is allowed anywhere near the
   sim: bounded length, integer ticks in range, known action kinds, integer uids, aim clamped to the
   field. Legality (alive caster, energy, stun/silence, one gear skill) is enforced by the battle code
   itself when the action is applied — a forged entry is ignored, never honoured. */
const INPUT_LOG_MAX=400, SIM_TICK_MAX=14400, FIELD_W=1000, FIELD_D=1400;
function sanitizeInputLog(raw){
  if(!Array.isArray(raw)) return [];
  const out=[];
  for(const e of raw.slice(0,INPUT_LOG_MAX)){
    if(!Array.isArray(e)||e.length<3) continue;
    const t=e[0]|0, k=String(e[1]||''), uid=e[2]|0, tid=(e[3]==null?-1:(e[3]|0));
    if(!(t>=0&&t<=SIM_TICK_MAX)) continue;
    if(k!=='ult'&&k!=='gear'&&k!=='auto') continue;
    if(k==='auto'){ out.push([t,'auto',-1,(tid?1:0),null,null]); continue; }
    if(!(uid>=0&&uid<64)) continue;
    const clamp=(v,hi)=>(v==null||!isFinite(v))?null:Math.max(0,Math.min(hi,+(+v).toFixed(2)));
    out.push([t,k,uid,(tid>=0&&tid<64)?tid:-1, clamp(e[4],FIELD_W), clamp(e[5],FIELD_D)]);
  }
  out.sort((a,b)=>a[0]-b[0]);
  return out;
}
function campaignHeroSpec(u,key){
  const led=ensureLedger(u); ledSkillImport(u);
  const base=SIM.HERO_BASE[key]; if(!base) return null;
  const h=led.hero[key]||{xp:0,stars:base.stars,pips:0,ref:0};
  const fl=glyphFlatStats(u,key);
  const gf=(typeof gearHeroFlats==='function'&&u.gear)?gearHeroFlats(u,key):null;
  const n=(a,b)=>((a|0)+((b&&b|0)||0));
  const pick=(k)=>((fl[k]|0)+((gf&&gf[k]|0)||0));
  /* socket totals in the CLIENT's own field names — this bundle is what mulsFromTotals/makeUnit read */
  const tt={ hp:pick('hp'), atk:pick('atk'), apow:pick('apow'), pen:pick('pen'),
    armor:pick('armor'), mr:pick('mr'), armorPen:pick('armorPen'), magicPen:pick('magicPen'),
    crit:pick('crit'), critDmg:pick('critDmg'), critRes:pick('critRes'),
    energy:pick('energy'), regen:((fl.regenRating|0)+((gf&&gf.regenRating|0)||0)),
    startEnergy:pick('startEnergy'), ctrlRes:pick('ctrlRes'), ctrlHit:pick('ctrlHit'),
    healPow:pick('healPow'), lifesteal:pick('lifesteal'), atkSpd:pick('atkSpd'), haste:pick('haste'),
    eva:pick('eva'), acc:pick('acc'), block:pick('block'),
    dmgBonus:pick('dmgBonus'), dmgRed:pick('dmgRed'), shieldStr:pick('shieldStr') };
  const AC=acadCombat(u);
  const board=(u.glyphs&&u.glyphs.boards&&u.glyphs.boards[key])||null;
  return {
    key, level:ledHeroLevel(led,key),
    stars:Math.max(base.stars,Math.min(5,h.stars|0)), pips:Math.max(0,Math.min(5,h.pips|0)), ref:Math.max(0,Math.min(15,h.ref|0)),
    glyphRank:Math.max(0,Math.min(16,(board&&board.ascensionIndex)|0)),
    tt,
    /* Academy research is server-owned and reaches combat here. Temple prayer and the legacy client
       equip bundle are NOT server-owned, so they contribute nothing — a browser cannot grant power. */
    ex:{ techDef:AC?AC.dmgRedFrac*100:0, techCrit:AC?AC.critFrac*100:0, techCritRes:AC?AC.critResFrac*100:0,
         prayerPct:0, equip:{} },
    fAtk:tt.atk+(AC?AC.atkFlat:0), fHp:tt.hp+(AC?AC.hpFlat:0), fApow:tt.apow,
    techArmor:AC?AC.armorRating:0, techMr:AC?AC.mrRating:0,
    apMul:AC?AC.apMul:1,
    skillLv:ledSkillArr(led,key).slice()
  };
}
/* v273 (audit response P0) — EVERY VALUE MOVEMENT IS DURABLE.
   ledTx is the one choke point every grant and every spend passes through, so it is where the write
   becomes real. Before this, a crash inside the 200 ms debounce could drop a reward, a spend, or the
   idempotency receipt that stops a retry being paid twice. The cost is one synchronous write per
   transaction; correctness of the ledger is worth more than that. */
function ledTx(u,src,delta){ const led=u.led; const id=uid();
  led.txs.push({id,t:Date.now(),src,d:delta}); if(led.txs.length>LEDGER_TX_KEEP) led.txs=led.txs.slice(-LEDGER_TX_KEEP);
  led.rev++; writeDBNow(); return id; }
function ledPlayerLevel(led){ return d_levelForXP(led.px||0, D_TROOP_CUM); }
function ledHeroLevel(led,k){ const h=led.hero[k]; if(!h) return 1;
  return Math.max(1,Math.min(ledPlayerLevel(led), d_levelForXP(h.xp||0, D_HERO_CUM))); }
const STAM_MAX_BASE=59, STAM_REGEN_MS=360000, STAM_COST_NORMAL=6, STAM_COST_BOSS=12;
function ledStamMax(led){ return STAM_MAX_BASE+ledPlayerLevel(led); }
/* 30 Aug — A REFUND MUST NOT TAKE STAMINA AWAY.
   These clamped to ledStamMax (59 + player level), but stamina can legitimately sit ABOVE that: the
   sign-in calendar, the guild shop's Stamina Refill and the diamond packs all push past it, and
   ledStamRegen deliberately never touches a balance already over the cap. So refunding 6 stamina to
   a player holding 200 clamped them to ~100 and destroyed the rest — stamina they had paid for. The
   cap governs REGENERATION, not how much you may hold. */
function ledStamRegen(led){ const now=Date.now(); const mx=ledStamMax(led);
  if(led.stam.v<mx){ const g=Math.floor((now-led.stam.ts)/STAM_REGEN_MS);
    if(g>0){ led.stam.v=Math.min(mx,led.stam.v+g); led.stam.ts+=g*STAM_REGEN_MS; } }
  else led.stam.ts=now; }
function ledgerView(u){ const led=ensureLedger(u); ledStamRegen(led);
  return { rev:led.rev, gold:led.gold, gems:led.gems, guildCoins:led.guildCoins|0, px:led.px, playerLevel:ledPlayerLevel(led),
    hero:led.hero, unlocked:led.unlocked, frags:led.frags, eqMats:led.eqMats||{},   // v273: materials are ledger-owned
    skill:led.skill||{},
    camp:{cleared:led.camp.cleared, stars:led.camp.stars},
    portals:(function(){ const o={}; for(const m of PORTAL_MODES){ const pr=portalProg(led,m);
      o[m]={ cleared:pr.cleared|0, stars:pr.stars||{}, locked:portalLocked(led,m) }; } return o; })(),
    stamina:{v:led.stam.v, max:ledStamMax(led), regenMs:STAM_REGEN_MS},
    dust:u.dust||0,
    // day-boundary: HUD shop counters are server-owned (ET-midnight day via shopState); the client
    // used to keep its own 09:00-ET copy, so the quoted price drifted from the charged price.
    shop:(function(){ try{ const sh=shopState(u); return { food:sh.food|0, gold:sh.gold|0,
      foodCost:((sh.food|0)<SHOP_FOOD_COSTS.length?SHOP_FOOD_COSTS[sh.food|0]:null),
      goldCost:((sh.gold|0)<SHOP_GOLD_COSTS.length?SHOP_GOLD_COSTS[sh.gold|0]:null) }; }catch(e){ return null; } })() }; }
// capped earn table for legacy client-resolved loops (each reason: per-grant max + per-day cap)
/* v250 (audit P1): GENERIC tx/earn IS RETIRED for normal gameplay. Every loop now has its own
   server-verified route (elite/trial/quest/market/arena-daily/city-pvp/guild). Only a tiny 'misc'
   allowance (and the arena-coin fragment shop, pending its own route) remains for legacy edges. */
/* v267 (80/20 §9): the generic client-selected earning endpoint is RETIRED. The only reason left is
   the arena fragment shop, which has its own capped rule; every other loop grants through its own
   verified route. `misc` is gone — a client can no longer name its own reason and be paid for it. */
/* 30 Aug (Phil) — DIAMONDS CAN ACTUALLY BE EARNED AGAIN.
   txEarn() refused every reason but frag/arena and called ledgerSync() on the way out, which
   overwrote the client's wallet with the server's number and DELETED the grant on the spot. So
   sign-in, the tower, the gauntlet, star milestones, the guild shop and the city landing all showed
   a reward and then took it back within 45 seconds.
   These numbers are SANITY bounds, not balance caps. Phil's ruling is that we do not block or roll
   back a player mid-play on a detector's guess: a grant is paid, and anything implausible is
   reported to the dev panel (see gemGain) for a human to judge. `day` is a high backstop against a
   runaway loop, not a design limit. */
const EARN_RULES={
  frag:{ arena:{max:10,day:60}, signin:{max:20,day:40}, stars:{max:200,day:600} },
  stamina:{ signin:{max:120,day:240}, guildshop:{max:200,day:1000}, arenashop:{max:200,day:2000}, stars:{max:1500,day:6000}, pack:{max:200,day:600} },
  gems:{ signin:{max:200,day:2000}, tower:{max:500,day:5000}, gauntlet:{max:500,day:5000},
         stars:{max:2000,day:12000}, guildshop:{max:500,day:5000}, city:{max:300,day:3000},
         wish:{max:500,day:8000}, quest:{max:500,day:4000}, convert:{max:1000,day:6000},
         pack:{max:20000,day:60000}, misc:{max:200,day:2000}, arenashop:{max:40,day:800} },
  gold:{ guildshop:{max:50000,day:300000}, signin:{max:20000,day:200000}, tower:{max:200000,day:2000000}, gauntlet:{max:200000,day:2000000},
         stars:{max:200000,day:2000000}, city:{max:100000,day:1000000}, wish:{max:100000,day:1000000},
         quest:{max:100000,day:1000000}, convert:{max:200000,day:2000000}, misc:{max:50000,day:500000},
         march:{max:1200,day:20000}, arenashop:{max:5000,day:100000} },
  heroXp:{ province:{max:20000,day:120000} },
  guildCoins:{ march:{max:40,day:400} } };
/* Getting Started rewards are AUTHORED HERE and granted once per step by the server — the client
   used to add them to its own wallet. */
const TUTORIAL_REWARDS=Object.freeze({
  win11:{gold:500}, rune:{gems:30}, win12:{frag:3}, skill:{gold:800},
  name:{gems:20}, signin:{stam:60}, wish:{gems:40} });

/* ==================== WISHING POOL (server-owned, audit Phase C) ====================
   Banner table, published odds, pity, transaction history, currency debit, duplicate conversion,
   idempotency — the client only animates the reveal. Odds mirror the owner's 2026-08-21 economy
   spec exactly; the pity rule (a full hero guaranteed within 40 diamond wishes) is server-added per
   the audit's pity requirement and shown to players. Legacy material prizes are returned for the
   client's local (non-competitive) material bag. */
const POOL_P2=["fritz","rhukk","tallow","astra","magistrant","vharn","fathom","lumi","vesper","sablewick"];
const POOL_P3=["bloatus","umbris","oakmir","meridian","sprocket","arrears"];
const POOL_GOLD_HEROES=["tick","meryln","carn"];
const POOL_START_STARS={konwu:3,grosk:3,vulmar:3,tick:1,sylthaine:1,aureth:3,bloatus:3,vireo:1,fritz:2,umbris:3,vael:1,oakmir:3,rhukk:2,hurne:3,meridian:3,tallow:2,astra:2,magistrant:2,vharn:2,fathom:2,lumi:2,hollow:3,sprocket:3,carn:1,vesper:2,sablewick:2,vex:1,arrears:3,meryln:1};
const POOL_DUPE_FRAG={1:7,2:14,3:30};
const WISH_GOLD_COST=1000, WISH_GEM_COST=300, WISH10_MULT=9;
const WISH_GOLD_FREE_MAX=3, WISH_GOLD_FREE_MS=3600000, WISH_FIRST_GEM_DELAY_MS=20*60000;
const WISH_GEM_PITY=40;   // a full hero is guaranteed within this many paid diamond wishes
function poolState(u){ const led=ensureLedger(u);
  if(!led.pool) led.pool={ goldUsedDay:'', goldFree:0, goldLast:0, gemFreeDay:'', gemFirstDone:false, pity:0, history:[] };
  return led.pool; }
function poolPick(a){ return a[Math.floor(Math.random()*a.length)]; }
function poolPickUnowned(led,a){ const un=(a||[]).filter(function(k){ return !(led.unlocked&&led.unlocked[k]); });
  return un.length?un[Math.floor(Math.random()*un.length)]:null; }
function poolGrantHero(u,hk){ const led=u.led; const st=POOL_START_STARS[hk]||1;
  if(led.unlocked[hk]){ const f=POOL_DUPE_FRAG[st]||7; led.frags[hk]=(led.frags[hk]|0)+f;
    return {type:'dupe', hero:hk, frags:f}; }
  led.unlocked[hk]=true; if(!led.hero[hk]) led.hero[hk]={xp:0,stars:(SIM.HERO_BASE[hk]||{}).stars||st,pips:0};
  return {type:'hero', hero:hk, stars:st}; }
function poolGlyphFrag(u,q,n){ const fams=glyphTierFams(q); const key=q+' '+fams[Math.floor(Math.random()*fams.length)];
  const rec=glyphGrantNamedList(u,[{key,quantity:n}]);
  return {type:'glyphFrag', key, displayName:key+' Fragment', n};
}
function poolRollGold(u){ const led=u.led; const h=Math.random();
  if(h<0.05) return poolGrantHero(u, poolPick(POOL_GOLD_HEROES));
  if(h<0.20){ const hk=poolPick(POOL_GOLD_HEROES), n=2+Math.floor(Math.random()*2); led.frags[hk]=(led.frags[hk]|0)+n; return {type:'frags',hero:hk,frags:n}; }
  const r=Math.random();
  if(r<0.46) return poolGlyphFrag(u,'Grey', 4+Math.floor(Math.random()*5));
  if(r<0.72) return poolGlyphFrag(u,'Green', 2+Math.floor(Math.random()*3));
  if(r<0.94){ const g=300+Math.floor(Math.random()*500); led.gold=Math.min(100000000,led.gold+g); return {type:'gold', n:g}; }
  const gm=5+Math.floor(Math.random()*11); gemGain(u,gm,'wish'); led.gems=Math.min(2000000,led.gems+gm); return {type:'gems', n:gm}; }
function poolRollGem(u, rigged){ const led=u.led, pool=poolState(u);
  if(rigged) return poolGrantHero(u, poolPick(POOL_P2));
  if(pool.pity+1>=WISH_GEM_PITY){ pool.pity=0;
    const phk=(Math.random()<0.12?poolPickUnowned(led,POOL_P3):null)||poolPickUnowned(led,POOL_P2)||poolPickUnowned(led,POOL_P3);
    if(phk) return Object.assign(poolGrantHero(u,phk),{pity:true});
    return Object.assign(poolGrantHero(u, poolPick(POOL_P2)),{pity:true,exhausted:true}); }
  const h=Math.random(); let acc=0.001;
  const hit=(fn)=>{ const r=fn(); if(r&&r.type==='hero') pool.pity=0; else pool.pity++; return r; };
  if(h<acc) return hit(()=>poolGrantHero(u,'konwu'));
  acc+=0.01;  if(h<acc) return hit(()=>poolGrantHero(u, poolPick(POOL_P3)));
  acc+=0.08;  if(h<acc) return hit(()=>poolGrantHero(u, poolPick(POOL_P2)));
  pool.pity++;
  acc+=0.15;  if(h<acc){ const hk=poolPick(POOL_P2), n=2+Math.floor(Math.random()*2); led.frags[hk]=(led.frags[hk]|0)+n; return {type:'frags',hero:hk,frags:n}; }
  acc+=0.10;  if(h<acc){ const hk=poolPick(POOL_P3), n=2+Math.floor(Math.random()*2); led.frags[hk]=(led.frags[hk]|0)+n; return {type:'frags',hero:hk,frags:n}; }
  const r=Math.random();
  if(r<0.36) return poolGlyphFrag(u,'Blue', 2+Math.floor(Math.random()*3));
  if(r<0.60) return poolGlyphFrag(u,'Green', 4+Math.floor(Math.random()*4));
  if(r<0.80) return poolGlyphFrag(u,'Blue +1', 1+Math.floor(Math.random()*2));
  const gm=20+Math.floor(Math.random()*40); gemGain(u,gm,'wish'); led.gems=Math.min(2000000,led.gems+gm); return {type:'gems', n:gm}; }
/* ---- HUD shop (stamina meals + gold purchases, server-owned counts + prices) ---- */
const SHOP_FOOD_COSTS=[50,100,100,200,200,400,400], SHOP_GOLD_COSTS=[20,20,40,40,60,60,100,100], SHOP_FOOD_STAMINA=120;
function shopState(u){ const led=ensureLedger(u); if(!led.shop) led.shop={day:'',food:0,gold:0};
  const dk=nyDayKey(); if(led.shop.day!==dk){ led.shop={day:dk,food:0,gold:0}; } return led.shop; }
/* ==================== CAMPAIGN (authored encounters, audit C2 — server-resolved) ==================== */
const CAMPAIGN_NODES=100;   // Blueprint v1: 10 chapters × 10 fixed stages. Chapters 11+ are explicitly OUT.
/* v266 — Exact Glyph Fragment Farm Map v1. THREE fixed portals, one visible source per fragment:
   Normal (100 families) · Elite (the other 100, stronger fixed version of the same stage) ·
   Veteran (all 18 Orange). No random rolls, no stage showing unrelated families. */
const PORTAL_MODES=Object.freeze(['normal','elite','veteran']);
const PORTAL_LABEL=Object.freeze({normal:'Normal Portal', elite:'Elite Portal', veteran:'Veteran Portal'});
const PORTAL_FILE=Object.freeze({normal:'campaign-encounters.json', elite:'elite-campaign-encounters.json', veteran:'veteran-campaign-encounters.json'});
const PORTAL_SIZE=Object.freeze({normal:100, elite:100, veteran:18});
/* unlock gates (spec §"Campaign mode" table) */
const PORTAL_GATE=Object.freeze({ normal:null,
  elite:{ afterNode:20, level:20, text:'Elite Portal opens after Normal 2-10 at player level 20.' },
  veteran:{ afterNode:100, level:100, text:'Veteran Portal opens after Normal 10-10 at player level 100.' } });
let PORTALS={};          // mode -> { byNode, list }
let FRAG_SOURCES={};     // fragmentId -> [{ mode, stageId }]
let CAMP_ENC=null;
function portalCompile(){
  PORTALS={}; FRAG_SOURCES={};
  for(const mode of PORTAL_MODES){
    const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'server',PORTAL_FILE[mode]),'utf8'));
    if(!Array.isArray(raw)||raw.length!==PORTAL_SIZE[mode])
      throw new Error(mode+' portal: expected '+PORTAL_SIZE[mode]+' stages, got '+(raw&&raw.length));
    const byNode={}; const seen=new Set();
    for(const e of raw){
      if(!e.id||!(e.node>=1)) throw new Error(mode+' portal: stage record missing id/node');
      if(!Array.isArray(e.waves)||!e.waves.length) throw new Error(mode+' '+e.id+': no waves');
      const gf=e.rewards&&e.rewards.glyphFragments;
      // THE farm-map rule: exactly ONE primary fragment family per stage, never a random replacement
      if(!Array.isArray(gf)||gf.length!==1) throw new Error(mode+' '+e.id+': must name exactly one glyph fragment');
      const f=gf[0];
      if(!f.key||!f.fragmentId||!(f.quantity>=1)) throw new Error(mode+' '+e.id+': fragment record malformed');
      const q=f.key.slice(0,f.key.lastIndexOf(' '));
      if(GLYPH_LADDER.indexOf(q)<0) throw new Error(mode+' '+e.id+': illegal fragment quality "'+q+'"');
      if(seen.has(f.fragmentId)) throw new Error(mode+' portal: '+f.fragmentId+' is farmed by two stages');
      seen.add(f.fragmentId);
      (FRAG_SOURCES[f.fragmentId]=FRAG_SOURCES[f.fragmentId]||[]).push({mode, stageId:e.id, key:f.key});
      byNode[e.node]=e;
    }
    PORTALS[mode]={ byNode, list:raw };
  }
  // no family may be farmed in two different portals — one fixed, visible source each
  const dup=Object.keys(FRAG_SOURCES).filter(k=>FRAG_SOURCES[k].length>1);
  if(dup.length) throw new Error('fragments with more than one source: '+dup.slice(0,5).join(', '));
  console.log('🗺  Portals compiled: Normal '+PORTAL_SIZE.normal+' · Elite '+PORTAL_SIZE.elite+' · Veteran '+PORTAL_SIZE.veteran
    +' — '+Object.keys(FRAG_SOURCES).length+' glyph fragment families, one fixed source each.');
}
/* the one visible source of a fragment, as the ancestry tree and inventory show it:
   "Farm: Normal Portal 1-9" — and enough data to deep-link straight to that stage. */
function portalSourcesFor(key){ const id=glyphFragSlug(key);
  return (FRAG_SOURCES[id]||[]).map(x=>({ mode:x.mode, stageId:x.stageId,
    label:'Farm: '+PORTAL_LABEL[x.mode]+' '+x.stageId,
    node:(function(){ const [c,st2]=x.stageId.split('-').map(Number); return (c-1)*10+st2; })() })); }
function portalStageOf(mode,node){ const P=PORTALS[mode]; return (P&&P.byNode[node|0])||null; }
function portalModeOf(v){ const m=String(v||'normal'); return PORTAL_MODES.includes(m)?m:'normal'; }
/* per-mode progress. Normal keeps led.camp (every existing account already has it); the two new
   portals live under led.portals so nothing about saved progress moves. */
function portalProg(led,mode){
  if(mode==='normal') return led.camp;
  led.portals=led.portals||{};
  return led.portals[mode]||(led.portals[mode]={cleared:0, stars:{}, att:null, runs:{}});
}
function portalLocked(led,mode){
  const g=PORTAL_GATE[mode]; if(!g) return null;
  if((led.camp.cleared|0) < g.afterNode) return g.text;
  if(ledPlayerLevel(led) < g.level) return g.text;
  return null;
}
function campCompile(){
  try{ const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'server','campaign-encounters.json'),'utf8'));
    if(!Array.isArray(raw)||raw.length!==CAMPAIGN_NODES) throw new Error('expected '+CAMPAIGN_NODES+' encounters, got '+(raw&&raw.length));
    CAMP_ENC={byNode:{}, fragSources:{}}; for(const e of raw) CAMP_ENC.byNode[e.node]=e;
    // v232 (audit): the named Glyph Fragment target is AUTHORED PER-STAGE DATA in
    // campaign-encounters.json — validated here, never derived from a runtime formula. The
    // reverse source index is built from those records.
    for(const e of raw){
      const gf=e.rewards&&e.rewards.glyphFragments;
      if(!Array.isArray(gf)||!gf.length) throw new Error('stage '+e.node+' has no authored glyphFragments');
      for(const f of gf){ if(!f.key||!f.fragmentId||!(f.quantity>=1)) throw new Error('stage '+e.node+' glyph target malformed');
        const q=f.key.slice(0,f.key.lastIndexOf(' '));
        if(GLYPH_LADDER.indexOf(q)<0) throw new Error('stage '+e.node+' glyph target has illegal quality "'+q+'"');
        (CAMP_ENC.fragSources[f.key]=CAMP_ENC.fragSources[f.key]||[]).push(e.id||('campaign-'+e.node)); } }
    console.log('🗺  Campaign encounters compiled: '+CAMPAIGN_NODES+' authored stages (fixed waves, no per-attempt RNG) + per-stage authored Glyph fragment targets.');
  }catch(e){ CAMP_ENC=null; console.error('⚠ CAMPAIGN ENCOUNTERS DISABLED — '+e.message+' (client keeps its local mode)'); }
}
const CAMPAIGN_SKILL_BAND=parseFloat(process.env.CAMPAIGN_SKILL_BAND||'1.5');   // deterministic manual-play allowance inside the authoritative resolve
function campStageOf(node){ return CAMP_ENC&&CAMP_ENC.byNode[node|0]||null; }
/* Blueprint v1 §"Chapter graduation bosses": normal stages may be attempted early, but each
   Stage 10 boss is a HARD graduation gate on Player Level (1-10 → 10 … 10-10 → 100). Never a
   star or evolution threshold. */
function campBossLevelGate(node){ return (node%10===0) ? Math.min(100, Math.round(node/10)*10) : 0; }
function campIsBoss(node){ return node%10===0; }

/* ==================== THE FORGE (Gear/Temper v2) — server-authoritative ====================
   From Emberweave_Gear_Compendium_Rebuilt15.xlsx (26 Aug 2026): 9 passive slots (one slot per
   quality tier by design — Grey=Weapon … Orange=Relic), 84 gear types with matching fragments,
   sub-components (Green+), deterministic Tempering to 30 (no failure, 20% dust growth per
   completed bar), 80% extraction refund, Forge Resonance ranks 1–10, one Gear Active selected
   per hero. All drops, crafting, temper progress, refunds and resonance are server-owned.
   v258: gear stats are typed and proven to reach the shared combat core, and every fragment has a
   named Vault source, so the Forge ships ON BY DEFAULT — no Railway variable required. Set
   GEAR_V2_ENABLED=false to force it off. */
const GEAR_V2_ENABLED = String(process.env.GEAR_V2_ENABLED||'true')!=='false';
let GEARCAT=null;
(function(){ try{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'server','gear-catalog.json'),'utf8'));
  if(!raw.items||raw.items.length!==84) throw new Error('expected 84 gear defs, got '+(raw.items&&raw.items.length));
  raw.byId={}; raw.byName={}; raw.byQuality={};
  // AUDIT C4: ITEM-SPECIFIC actives — each gear id carries its own {activeId,type,params}. Temper
  // touches passives only; these definitions never scale with Temper or rarity.
  let acts={}; try{ for(const a of JSON.parse(fs.readFileSync(path.join(__dirname,'server','gear-actives.json'),'utf8'))) acts[a.id]=a; }
  catch(e){ console.error('⚠ gear-actives.json missing — item actives disabled: '+e.message); }
  for(const d of raw.items){ raw.byId[d.id]=d; raw.byName[d.name]=d; (raw.byQuality[d.quality]=raw.byQuality[d.quality]||[]).push(d);
    if(acts[d.id]){ d.activeId=acts[d.id].activeId; d.activeType=acts[d.id].type; d.activeParams=acts[d.id].params; } }
  GEARCAT=raw; console.log('⚒️  Gear catalog compiled: 84 items / 9 slots / 9 qualities / '+Object.keys(acts).length+' item actives. Forge '+(GEAR_V2_ENABLED?'ENABLED':'off (dev-only)'));
}catch(e){ console.error('⚠ FORGE DISABLED — server/gear-catalog.json problem: '+e.message); } })();
function gearEnabledFor(u){ return !!GEARCAT && (GEAR_V2_ENABLED || isDev(u)); }
function ensureGear(u){ if(!u.gear) u.gear={ revision:1, fragments:{}, subs:{}, items:{}, equipped:{}, active:{}, seq:1 }; return u.gear; }
function gearTemperBar(t){ return GEARCAT.meta.temper.startBar + t*GEARCAT.meta.temper.barGrowth; }
function gearTemperCost(def,t){ return Math.round(GEARCAT.meta.temper.baseDust[def.quality]*Math.pow(1+GEARCAT.meta.temper.dustGrowth,t)); }
function gearResonanceRank(g){ let total=0;
  for(const hero in g.equipped){ for(const slot in g.equipped[hero]){ const it=g.items[g.equipped[hero][slot]]; if(it) total+=it.temper||0; } }
  const th=GEARCAT.meta.resonance.thresholds; let r=0; for(let i=0;i<th.length;i++){ if(total>=th[i]) r=i+1; }
  return { rank:r, total, next: r<th.length?th[r]:null }; }
function gearItemEquippedBy(g,itemId){ for(const hero in g.equipped){ for(const slot in g.equipped[hero]){ if(g.equipped[hero][slot]===itemId) return {hero,slot}; } } return null; }
// stat contribution of a hero's equipped gear, reduced to sim-friendly flats + a power scalar
function gearHeroFlats(u,heroKey){
  // v226: ALL 8 gear stat families carried. Flats: hp/atk. Rates returned RAW (armor/mr/crit/critRes/
  // energy/regenRating); snapshotHeroFromServer converts them with the client's conversion constants
  // into the sim's combat fields. The sim itself remains a qualification ESTIMATE (see sim.js header).
  // v255 (80/20 contract §5): gear stats are TYPED like glyphs — a caster item's damage stat is
  // Ability Power (its own line), Haste is not Energy Regen, and every key reaches the combat core.
  const out={hp:0,atk:0,apow:0,heal:0,armor:0,mr:0,armorPen:0,magicPen:0,crit:0,critDmg:0,critRes:0,
    energy:0,regenRating:0,haste:0,atkSpd:0,lifesteal:0,eva:0,acc:0,block:0,dmgBonus:0,dmgRed:0,
    shieldStr:0,ctrlHit:0,ctrlRes:0,healPow:0,startEnergy:0,power:0}; const g=u&&u.gear; if(!g||!GEARCAT) return out;
  const eq=g.equipped[heroKey]; if(!eq) return out;
  const res=gearResonanceRank(g); const rmul=1+GEARCAT.meta.resonance.perRank*res.rank;
  for(const slot in eq){ const it=g.items[eq[slot]]; const def=it&&GEARCAT.byId[it.d]; if(!def) continue;
    const tmul=(1+GEARCAT.meta.temper.passivePerTemper*(it.temper||0))*rmul;
    for(const st in def.stats){ const v=def.stats[st]*tmul;
      if(st==='hp') out.hp+=v; else if(st==='atk') out.atk+=v; else if(st==='regen') out.regenRating+=v;   // client: gear regen is a REGEN RATE for every unit, not healer output
      else if(out[st]!=null) out[st]+=v;
      out.power += (st==='hp'? v/8 : v); } }
  for(const k in out) out[k]=Math.round(out[k]);
  return out;
}
const GEAR_POWER_WEIGHT=+(process.env.GEAR_POWER_WEIGHT||0.25);
function gearHeroPower(u,heroKey){ return gearHeroFlats(u,heroKey).power*GEAR_POWER_WEIGHT; }
// faucet: random gear fragment of a quality (vault band qualities == gear qualities by design)
function gearRollFragment(quality, rnd){
  const defs=GEARCAT?GEARCAT.byQuality[quality]:null; if(!defs||!defs.length) return null;
  return defs[Math.floor((rnd?rnd():Math.random())*defs.length)].frag;
}
function gearGrantFragments(u, quality, n, rnd){
  if(!GEARCAT) return null; const g=ensureGear(u); const got={};
  for(let i=0;i<n;i++){ const f=gearRollFragment(quality,rnd); if(!f) break; g.fragments[f]=(g.fragments[f]||0)+1; got[f]=(got[f]||0)+1; }
  g.revision++; return got;
}
/* ====================== end Forge module (routes in api()) ====================== */




function pickOpponent(me){
  const pool=Object.values(DB.users).filter(u=>u.id!==me.id);
  // prefer someone slightly ABOVE the player (lower rank number)
  const above=pool.filter(u=>u.rank<me.rank).sort((a,b)=>b.rank-a.rank); // closest above
  const cand = above.length? above.slice(0, Math.min(8,above.length)) : pool;
  return cand[Math.floor(Math.random()*cand.length)] || pool[0];
}
function applyResult(me, opp, won){
  const before=me.rank;
  if(won && opp && opp.rank < me.rank){
    const taken=opp.rank; me.rank=taken;
    // A BOT that would be bumped BEYOND rank 5000 disappears entirely — the slot it would have taken
    // (your old rank, in the 5001-10000 zone) opens up as the next new player's starting rank.
    if(opp.isNpc && before>BOT_COUNT){ delete DB.users[opp.id]; }
    else { opp.rank=before; }   // otherwise a normal position swap: bot stays in the top 5000, or a real player trades places with you
  }
  // win vs someone at/below you, or any loss: no rank change.
  me.rank=Math.max(1,me.rank);
  return { rank:me.rank, delta:before-me.rank };
}
function dailyAmount(rank){ if(rank<=1)return 1000; if(rank<=10)return 600; if(rank<=100)return 350; if(rank<=1000)return 180; return 60; }

/* --------------------------------- routes --------------------------------- */
/* v274 (hardening directive §4) — A BLANKET LIMIT ON MUTATIONS.
   Individual routes were limited historically; the rest relied on economic bounds alone, which stops
   value being minted but not a client hammering write paths (and every ledger write is now a durable
   fsync, so unbounded writes are a real cost). This is per ACCOUNT as well as per IP, so one token
   cannot spread its load across addresses. */
const MUT_PER_MIN=+(process.env.MUT_PER_MIN||240);
function mutationLimited(req){
  const who=(req.headers['x-token']?tokHash(String(req.headers['x-token'])).slice(0,16):('ip:'+clientIP(req)));
  return rateLimited(req,'mut|'+who, MUT_PER_MIN, 60000);
}
async function api(req,res,url){
  const p=url.pathname;
  if(req.method==='POST' && !/^\/api\/(register|login|guest|reset)/.test(p) && mutationLimited(req))
    return send(res,429,{error:'Slow down — too many requests.'});
  if(req.method==='OPTIONS'){ const h={}; if(_corsReqOrigin&&CORS_ORIGINS.has(_corsReqOrigin)){ h['Access-Control-Allow-Origin']=_corsReqOrigin; h['Vary']='Origin'; h['Access-Control-Allow-Headers']='content-type,x-token'; h['Access-Control-Allow-Methods']='GET,POST,OPTIONS'; } res.writeHead(204,h); res.end(); return; }

  /* v255 (80/20 contract §9 + release gate 5): the PRODUCTION FEATURE-FLAG MANIFEST and the
     currency sources/sinks/caps, served from the running server so nobody has to infer live state
     from source. Reset times are published in BOTH server time and the caller's local offset. */
  if(p==='/api/manifest'){
    const nyNow=new Date(new Date().toLocaleString('en-US',{timeZone:'America/New_York'}));
    const nextReset=new Date(nyNow); nextReset.setHours(9,0,0,0); if(nyNow>=nextReset) nextReset.setDate(nextReset.getDate()+1);
    return send(res,200,{
      build:(function(){ try{ return JSON.parse(fs.readFileSync(path.join(__dirname,'version.json'),'utf8')).build; }catch(e){ return null; } })(),
      flags:{ DUNGEON_V2_ENABLED, GEAR_V2_ENABLED:(typeof GEAR_V2_ENABLED!=='undefined'?GEAR_V2_ENABLED:null),
        GUILD_WAR_V2_ENABLED:(typeof GUILD_WAR_V2_ENABLED!=='undefined'?GUILD_WAR_V2_ENABLED:null),
        GLYPH_V2:!!GLYPHS, POSTGRES:!!PG, SMTP:!!process.env.SMTP_HOST },
      /* v274 (§4): tuning numbers and limits are OPERATIONAL detail — an attacker reading them learns
         exactly how hard to push. Public callers get the labels they need to verify a release; the
         numbers require an admin token. */
      tuning:(function(){ try{ const who=authUser(req); if(who&&isDev(who))
          return { VAULT_SKILL_BAND, CAMPAIGN_SKILL_BAND, GLYPH_RL_PER_MIN, MUT_PER_MIN,
                   REG_PER_MIN:(typeof REG_PER_MIN!=='undefined'?REG_PER_MIN:null) };
        }catch(e){} return { restricted:true }; })(),
      /* v273 — WHAT IS ACTUALLY RUNNING. A report claiming a fix is live means nothing on its own; a
         black-box test reads this from the deployed server and checks it against the claim. `engine`
         is the client build the server replays, so client and server versions are both visible. */
      serverBuild: SERVER_BUILD,
      engine: (function(){ try{ const h=simHost(); return h?h.buildVersion:null; }catch(e){ return null; } })(),
      authority: {
        campaign:'player-transcript-replay',      // the player's own fight, replayed
        campaignActions:'server-assigned-ticks',  // the server's own session clock decides where an action lands
        rollSecret:secretSource(),
        campaignMismatch:'unverified-refund',     // a divergence records nothing and returns stamina
        campaignSession:'frozen-single-use-resumable',
        raidPower:'ledger',                       // never the client's stored line-up
        rosterStorage:'keys-only',
        legacySaveFields:'stripped-after-migration',
        idempotency:'durable-write-before-response',
        vault:(VAULT_SKILL_BAND>0?'estimate+skill-band':'estimate'),   // NOT yet converted — stated plainly
        elite:'estimate', trials:'estimate'
      },
      dailyResetET:'09:00 America/New_York', nextResetUTC:new Date(Date.now()+(nextReset-nyNow)).toISOString(),
      currencies:[
        {id:'gold', sources:['Campaign clears & sweeps','City Skirmish loot (capped)','Arena daily','Quests','Guild raid'], sinks:['Gear crafting & Temper','Academy research','Shop','Guild contribution','Wishing Pool (gold pool)'], caps:{cityPvpPerDay:8000, cityPvpPerAttack:400}},
        {id:'gems', sources:['Quests','Arena daily','Rank milestones','Guild raid'], sinks:['Wishing Pool (diamond pool)','Shop','Market fragments'], caps:{}},
        {id:'stamina', sources:['Regeneration (6 min/point)','Level-ups'], sinks:['Campaign battles & sweeps'], caps:{max:'59 + player level'}},
        {id:'dust', sources:['Vault floors','Fragment salvage'], sinks:['Gear Temper'], caps:{}},
        {id:'glyphFragments', sources:['Normal Portal — 100 families, one fixed stage each','Elite Portal — the other 100 families','Veteran Portal — all 18 Orange families','Vault boss floors','Arena wins','Daily','Wishing Pool'], sinks:['Glyph builds (permanent, per slot)'], caps:{}},
        {id:'gearFragments', sources:['Authored Vault floors (2 targeted per floor)'], sinks:['Gear crafting'], caps:{}},
        {id:'cityResources', sources:['World-map mining (capped)'], sinks:['Academy research'], caps:{perResourcePerDay:60}},
        {id:'guildCoins', sources:['Guild raid'], sinks:['Guild shop'], caps:{}},
        {id:'heroFragments', sources:['Guardian stages, every 5th (3/day)','Market (12/day)','Quests','Wishing Pool'], sinks:['Hero summon','Star-up','Refine'], caps:{guardianPerStagePerDay:3, marketPerDay:12}}
      ],
      dailyCaps:{ cityAttacks:20, vaultSweeps:2, eliteBossStageRuns:3, mining:60, marketFragments:12, guildContributions:20 }
    }); }
  if(p==='/api/register' && req.method==='POST'){ const b=await body(req); const name=(b.name||'').replace(/[<>]/g,'').trim().slice(0,16);
    if(rateLimited(req,'reg',REG_PER_MIN,60000)) return send(res,429,{error:'Too many attempts — wait a minute and try again.'});
    if(name.length<2||!b.pass) return send(res,400,{error:'Name (2+) and password required'});
    if(String(b.pass).length<8) return send(res,400,{error:'Password must be at least 8 characters.'});
    // v328 — caps run BEFORE the guest-upgrade branch. The live client always registers as a signed-in guest,
    // so the device/network caps below were dead code and guest→upgrade→logout→new guest looped forever.
    const deviceId=(b.deviceId||'').slice(0,64), ip=clientIP(req); DB.devices=DB.devices||{}; DB.ipAccounts=DB.ipAccounts||{};
    if(deviceId && (DB.devices[deviceId]||0)>=3) return send(res,429,{error:'This device has reached the 3-account limit.'});
    /* v274 — THE NETWORK CAP IS A WINDOW, NOT A LIFE SENTENCE.
       It used to be a counter that only ever went up, so a household, an office, a school or anyone
       behind carrier-grade NAT was permanently locked out once six accounts had ever been made from
       that address — including a family sharing a router. It is now a rolling 24-hour window, which
       stops bulk creation just as well without banning a whole network forever. */
    { const now=Date.now(), WINDOW=24*3600000;
      const rec=DB.ipAccounts[ip];
      const times=Array.isArray(rec)?rec.filter(t=>now-t<WINDOW):[];
      if(times.length>=REG_ACCOUNTS_PER_IP) return send(res,429,{error:'Too many new accounts from this network today — try again tomorrow.'});
      DB.ipAccounts[ip]=times; }
    // GUEST UPGRADE: if a guest is signed in, convert THAT account in place — keep its id, roster and
    // all progress — instead of spawning a new account. This is what "Create account" does for a guest.
    const gu=authUser(req);
    if(gu && gu.guest){
      if(DB.byName[name.toLowerCase()] && DB.byName[name.toLowerCase()]!==gu.id) return send(res,409,{error:'That Profile name is already taken'});
      const oldName=(gu.name||'').toLowerCase(), c=makeCred(b.pass);
      delete DB.byName[oldName]; gu.name=name; gu.hash=c.hash; gu.salt=c.salt; gu.iters=c.iters; delete gu.guest;
      if(b.roster) gu.roster=sanitizeSave(gu, b.roster);
      // AUDIT (critical): registering a name NEVER grants a role. Admin comes only from the stored
      // role stamped by migrateAdminRoles() (env-driven) or ADMIN_IDS.
      DB.byName[name.toLowerCase()]=gu.id;
      if(DB.guestByDevice){ for(const dk of Object.keys(DB.guestByDevice)){ if(DB.guestByDevice[dk]===gu.id) delete DB.guestByDevice[dk]; } }  // this device now needs a fresh guest next time, not this real account
      if(deviceId) DB.devices[deviceId]=(DB.devices[deviceId]||0)+1;   // v328 — an upgrade IS an account creation for cap purposes
      DB.ipAccounts[ip]=(Array.isArray(DB.ipAccounts[ip])?DB.ipAccounts[ip]:[]).concat([Date.now()]).slice(-50);
      dropTokens(gu.id); const tok=issueToken(gu.id); writeDB();
      return send(res,200,{ token:tok, profile:profileFor(gu) });
    }
    if(DB.byName[name.toLowerCase()]) return send(res,409,{error:'That Profile name is already taken'});
    // (v328: device / network caps now run above, before the guest-upgrade branch)
    const id=uid(), c=makeCred(b.pass);
    const u={ id, name, hash:c.hash, salt:c.salt, iters:c.iters, rank:nextJoinRank(), coins:0, team:defaultTeam(), wall:defaultTeam(),
      roster:{}, lastDaily:0, cityX:Math.round(Math.random()*1000), cityY:Math.round(Math.random()*1000), created:Date.now() };
    if(b.roster && typeof b.roster==='object') u.roster=sanitizeSave(u, b.roster);   // RE-AUDIT: imports go through the same clamps as /api/save
    // AUDIT (critical): registering a name NEVER grants a role — admin only via stored role/env.
    DB.users[id]=u; DB.byName[name.toLowerCase()]=id; if(deviceId) DB.devices[deviceId]=(DB.devices[deviceId]||0)+1;
    DB.ipAccounts[ip]=(Array.isArray(DB.ipAccounts[ip])?DB.ipAccounts[ip]:[]).concat([Date.now()]).slice(-50);
    const tok=issueToken(id); writeDB();
    return send(res,200,{ token:tok, profile:profileFor(u) }); }

  // GUEST SESSION: a player who isn't signed in still gets a real server-backed account so their
  // progress is saved and they appear online — a "level 1 guest". One PERSISTENT guest per device:
  // relaunching resumes the same guest (never resets progress). The client seeds it with the current
  // local save so an existing offline player isn't wiped to level 1. Guests upgrade in place via
  // /api/register (keeps progress) or are replaced by signing into a real account.
  if(p==='/api/guest' && req.method==='POST'){ const b=await body(req);
    if(rateLimited(req,'guest',20,60000)) return send(res,429,{error:'Slow down.'});
    const deviceId=(b.deviceId||'').slice(0,64);
    DB.guestByDevice = DB.guestByDevice || {};
    let u = deviceId && DB.guestByDevice[deviceId] && DB.users[DB.guestByDevice[deviceId]];
    if(u && !u.guest){ u=null; if(deviceId) delete DB.guestByDevice[deviceId]; }   // was upgraded to a real account → make a fresh guest
    if(!u){
      const id=uid(); let name; do{ name='Guest-'+crypto.randomBytes(2).toString('hex').toUpperCase(); }while(DB.byName[name.toLowerCase()]);
      u={ id, name, guest:true, rank:nextJoinRank(), coins:0, team:defaultTeam(), wall:defaultTeam(),
          roster:{}, lastDaily:0,
          cityX:Math.round(Math.random()*1000), cityY:Math.round(Math.random()*1000), created:Date.now() };
      DB.users[id]=u; DB.byName[name.toLowerCase()]=id; if(deviceId) DB.guestByDevice[deviceId]=id;
      if(b.roster && typeof b.roster==='object') u.roster=sanitizeSave(u, b.roster);   // RE-AUDIT: guest seed goes through the clamps too
    } else if(b.roster && typeof b.roster==='object' && Object.keys(b.roster).length && (!u.roster || !u.roster.__save)){
      u.roster=sanitizeSave(u, b.roster);   // first-time adoption of an existing local save — clamped like every other save write (RE-AUDIT)
    }
    dropTokens(u.id); const tok=issueToken(u.id); writeDB();
    return send(res,200,{ token:tok, profile:profileFor(u) }); }

  if(p==='/api/login' && req.method==='POST'){ const b=await body(req);
    if(rateLimited(req,'login',15,60000)) return send(res,429,{error:'Too many attempts — wait a minute and try again.'});
    const id=DB.byName[(b.name||'').trim().toLowerCase()];
    const u=id&&DB.users[id]; if(!u) return send(res,401,{error:'Wrong name or password'});
    // SECURITY (audit crit #1): the old `if(u.mustReset)` branch returned BEFORE the password check,
    // so knowing an account name was enough to set a new password and get a live token — account
    // takeover. It is deleted. Password recovery goes through the verified email flow only
    // (/api/reset-request → /api/reset-verify), which requires a one-time code sent to the account's email.
    if(!checkPass(u,b.pass)) return send(res,401,{error:'Wrong name or password'});
    if(!u.iters){ const c=makeCred(b.pass||''); u.hash=c.hash; u.salt=c.salt; u.iters=c.iters; }   // transparent 60k→210k upgrade
    dropTokens(id);   // single session: signing in here kicks any other device
    const tok=issueToken(id); writeDB(); return send(res,200,{ token:tok, profile:profileFor(u) }); }

  // email password reset — step 1: request a one-time 6-digit code sent to the account's linked email.
  // Always responds ok (never reveals whether an account or its email exists); only sends if a valid email is on file.
  if(p==='/api/reset-request' && req.method==='POST'){ const b=await body(req);
    if(rateLimited(req,'resetreq',5,10*60000)) return send(res,429,{error:'Too many requests — wait a few minutes and try again.'});
    const id=DB.byName[(b.name||'').trim().toLowerCase()]; const u=id&&DB.users[id];
    if(u && !u.isNpc && u.email){ const code=gen6(), salt=crypto.randomBytes(8).toString('hex');
      u.reset={ hash:hashPass(code,salt), salt, exp:Date.now()+15*60000, tries:0 }; writeDB();
      sendResetEmail(u.email, u.name, code); }
    return send(res,200,{ ok:true }); }   // RE-AUDIT: identical response whether or not the account/email exists — no enumeration

  // email password reset — step 2: verify the code and set a new password. Signs the user in on success.
  if(p==='/api/reset-verify' && req.method==='POST'){ const b=await body(req);
    if(rateLimited(req,'resetver',12,10*60000)) return send(res,429,{error:'Too many attempts — wait a few minutes.'});
    const id=DB.byName[(b.name||'').trim().toLowerCase()]; const u=id&&DB.users[id];
    if(!u||u.isNpc||!u.reset) return send(res,400,{error:'No active reset — request a new code.'});
    if(Date.now()>u.reset.exp){ delete u.reset; writeDB(); return send(res,400,{error:'That code expired — request a new one.'}); }
    if((u.reset.tries||0)>=5){ delete u.reset; writeDB(); return send(res,400,{error:'Too many wrong codes — request a new one.'}); }
    const code=(b.code||'').toString().replace(/\D/g,'');
    if(hashPass(code,u.reset.salt)!==u.reset.hash){ u.reset.tries=(u.reset.tries||0)+1; writeDB(); return send(res,400,{error:'Incorrect code — check your email and try again.'}); }
    const np=(b.newPass||'').toString(); if(np.length<8) return send(res,400,{error:'New password must be at least 8 characters.'});
    const c=makeCred(np); u.salt=c.salt; u.hash=c.hash; u.iters=c.iters; u.mustReset=false; delete u.reset;
    dropTokens(id); const tok=issueToken(id); writeDB();   // invalidate other sessions, sign this one in
    return send(res,200,{ ok:true, token:tok, profile:profileFor(u) }); }

  const me=authUser(req);
  if(me) me.lastSeen=Date.now();   // presence, for the dev "players online" view

  /* 30 Aug (Phil) — A BAN LOCKS THE ACCOUNT OUT, IT DOES NOT TAKE ANYTHING FROM IT.
     Nothing is rolled back and nothing is deleted: the account simply cannot act until the ban
     expires, and it expires on its own. Reading who you are is still allowed so the client can show
     the player why they are locked out and until when. */
  if(me && isBanned(me) && !/^\/api\/(me|logout|login|ledger)$/.test(p)){
    const b=banInfo(me);
    return send(res,403,{ error:'This account is suspended for '+b.daysLeft+' more day'+(b.daysLeft===1?'':'s')+'.',
                          banned:true, until:b.until, reason:b.reason });
  }

  /* ---- INTEGRITY DESK (dev only): reports in, a week of a player's diamonds to read, ban out.
     There is deliberately no "reverse this" action anywhere here — see the note on devReport. ---- */
  if(p==='/api/dev/reports'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const all=Array.isArray(DB.reports)?DB.reports:[];
    const show=(url.searchParams.get('all')==='1')?all:all.filter(r=>!r.resolved);
    return send(res,200,{ reports: show.slice(-200).reverse().map(r=>Object.assign({},r,{
      banned: DB.users[r.userId] ? banInfo(DB.users[r.userId]) : null })) }); }

  if(p==='/api/dev/gem-audit'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const id=String(url.searchParams.get('id')||''); const u=DB.users[id];
    if(!u) return send(res,404,{error:'no such account'});
    const days=Math.max(1,Math.min(30,parseInt(url.searchParams.get('days')||'7',10)));
    return send(res,200, gemAudit(u,days)); }

  if(p==='/api/dev/ban' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const u=DB.users[String(b.id||'')];
    if(!u) return send(res,404,{error:'no such account'});
    if(isDev(u)) return send(res,400,{error:'That account is an admin.'});
    const days=parseInt(b.days,10);
    if(b.lift){ u.bannedUntil=0; u.banReason=''; writeDB();
      return send(res,200,{ok:true, banned:null, name:u.name}); }
    if(BAN_DAYS_ALLOWED.indexOf(days)<0) return send(res,400,{error:'Ban length must be 1, 7 or 30 days.'});
    u.bannedUntil=Date.now()+days*86400000;
    u.banReason=String(b.reason||'').slice(0,200);
    u.banLog=Array.isArray(u.banLog)?u.banLog:[];
    u.banLog.push({t:Date.now(),days,by:me.name||me.id,reason:u.banReason});
    dropTokens(u.id);                       // sign them out of every device immediately
    if(b.reportId){ const r=(DB.reports||[]).find(x=>x.id===b.reportId); if(r){ r.resolved=true; r.action='ban:'+days+'d'; } }
    writeDB();
    console.log('⛔ '+(me.name||me.id)+' banned '+(u.name||u.id)+' for '+days+' day(s)');
    return send(res,200,{ok:true, banned:banInfo(u), name:u.name}); }

  if(p==='/api/dev/report-clear' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const r=(DB.reports||[]).find(x=>x.id===String(b.id||''));
    if(!r) return send(res,404,{error:'no such report'});
    r.resolved=true; r.action='cleared'; writeDB();
    return send(res,200,{ok:true}); }

  // ---- developer/admin endpoints (only usable while signed into a dev account) ----
  if(p==='/api/admin/snapshot'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    // parity-harness support: the server-resolved combat snapshot for one of MY heroes, so a client
    // harness can compare its own resolved unit stats field-by-field against the server's.
    const hk=String(url.searchParams.get('hero')||''); const snap=snapshotHeroFromServer(me,hk);
    if(!snap) return send(res,400,{error:'unknown hero'});
    return send(res,200,{snapshot:snap}); }
  if(p==='/api/admin/online'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const cutoff=Date.now()-5*60000;
    const online=Object.values(DB.users).filter(u=>!u.isNpc && (u.lastSeen||0)>=cutoff)
      .sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0)).map(u=>({id:u.id,name:u.name,rank:u.rank,lastSeen:u.lastSeen||0,created:u.created||0,mustReset:!!u.mustReset,email:u.email||'',flag:u.flag||null}));
    return send(res,200,{online, count:online.length}); }
  if(p==='/api/admin/accounts'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const accounts=Object.values(DB.users).filter(u=>!u.isNpc)
      .sort((a,b)=>(b.created||0)-(a.created||0)).map(u=>({id:u.id,name:u.name,rank:u.rank,created:u.created||0,lastSeen:u.lastSeen||0,mustReset:!!u.mustReset,email:u.email||'',flag:u.flag||null}));
    return send(res,200,{accounts, count:accounts.length}); }
  // admin: arm-recovery is RETIRED (audit crit #1). It used to set u.mustReset, which let the next
  // login bypass the password check — an account-takeover primitive. Recovery is now the verified
  // email flow only. This endpoint stays wired so old admin UIs don't 404, but it no longer arms
  // anything: it force-signs-out the account (safe) and tells the operator to use email reset.
  if(p==='/api/admin/reset' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req); const tid=b.id||DB.byName[(b.name||'').trim().toLowerCase()]; const u=tid&&DB.users[tid];
    if(!u||u.isNpc) return send(res,404,{error:'account not found'});
    if(u.mustReset){ u.mustReset=false; }   // clear any legacy flag left on the account
    dropTokens(tid);  // sign out active sessions (safe)
    writeDB(); return send(res,410,{error:'Arm-recovery is retired. Ask the player to use “Forgot password” (email code), or clear their email with /api/admin/email so they can bind a new one.', name:u.name}); }
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
    if(name.length<2||!b.pass||String(b.pass).length<8) return send(res,400,{error:'Name (2+) and a password of 8+ characters required'});
    if(DB.byName[name.toLowerCase()]) return send(res,409,{error:'That Profile name is already taken'});
    const id=uid(), c=makeCred(b.pass);
    DB.users[id]={ id, name, hash:c.hash, salt:c.salt, iters:c.iters, rank:5000, coins:0, team:defaultTeam(), wall:defaultTeam(),
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
    if(!(u.led&&u.led.migratedAt)) dropTokens(tid);   // ledger accounts pick it up on the next ledgerSync (<=45s); kicking a live player mid-battle is worse than waiting
    writeDB(); return send(res,200,{ok:true, name:u.name, gems:ng, live:!!(u.led&&u.led.migratedAt)}); }
  // admin: download the whole DB as a backup
    if(p==='/api/admin/backup'){
    const bt = req.headers['x-backup-token'] || url.searchParams.get('token') || '';
    if(!backupTokenValid(bt) && (!me||!isDev(me))) return send(res,403,{error:'forbidden'});
    backupDB(); return send(res,200, DB); }
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

  /* FULL self-reset (Phil 26 Aug: "Reset all progress" must really reset everything).
     Wipes THIS account's server-owned progression: glyph boards/fragments/inventory (re-migrates
     fresh with the starter pack on next /state), Forge gear, Forge Dust, and the Vault climb.
     Only ever touches the calling account. The client wipes its local save alongside this. */
  /* 28 Aug (Phil: "I reset all progress but the game kept my campaign history").
     This wiped glyphs, gear, dust and the dungeon — and left the LEDGER completely untouched. Since
     v273 the ledger owns campaign clears, stars, player XP, hero XP, unlocks, gold, gems and stamina,
     so "Reset all progress" cleared the browser's copy and the server handed every bit of it straight
     back: 32 stars and a cleared Chapter 1 on a fresh save. A reset now resets what the server owns
     too, and returns the fresh ledger so the client adopts it instead of guessing. */
  if(p==='/api/account/reset-progress' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    delete me.glyphs; delete me.gear; me.dust=0;
    if(DB.dungeonProgress) delete DB.dungeonProgress[me.id];
    // rebuild the ledger at its starter state — the same shape a brand-new account is given
    const led={ v:1, migratedAt:Date.now(), rev:1, gold:0, gems:0, px:0,
      hero:{}, unlocked:{}, frags:{},
      camp:{ cleared:0, stars:{}, att:null },
      stam:{ v:60, ts:Date.now() },
      txs:[] };
    for(const k of Object.keys(SIM.HERO_BASE)){
      if(STARTER_HEROES.includes(k)) led.unlocked[k]=true;
      led.hero[k]={ xp:0, stars:SIM.HERO_BASE[k].stars, pips:0, ref:0 };
    }
    if(led.portals!==undefined) delete led.portals;
    me.led=led; me.econ=null; delete me.flag;
    try{ if(me.roster && typeof me.roster.__save==='string'){ const g=JSON.parse(me.roster.__save);
      for(const k of SERVER_OWNED_SAVE_FIELDS) delete g[k];
      me.roster.__save=JSON.stringify(g); } }catch(e){}
    ledTx(me,'account:reset',{});
    writeDB(); return send(res,200,{ok:true, ledger:ledgerView(me)}); }

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

  /* ------------------------- THE FORGE (Gear v2) routes -------------------------
     The client sends only ids + expectedRevision. Costs, outputs, temper progress,
     refunds and resonance are computed here; client-sent stats/amounts are ignored. */
  if(p.startsWith('/api/gear')){
    if(!me) return send(res,401,{error:'auth'});
    if(!gearEnabledFor(me)) return send(res,200,{enabled:false});
    if(rateLimited(req,'gear',80,60000)) return send(res,429,{error:'Slow down.'});
    if(p==='/api/gear/catalog'){ return send(res,200,{ version:1, meta:GEARCAT.meta, items:GEARCAT.items }); }
    /* v256 (80/20 §5): every gear fragment's EXACT farm source, computed from the authored
       vault table — never "random drops". Memoised: the table is frozen at boot. */
    if(p==='/api/gear/sources'){
      if(!GEAR_SOURCES){
        const m={};
        if(VAULT_ENC){ VAULT_ENC.forEach(rec=>{ (rec.gearFragments||[]).forEach(fr=>{
          (m[fr]||(m[fr]={frag:fr,quality:rec.quality,floors:[],items:[]})).floors.push(rec.floor); }); }); }
        GEARCAT.items.forEach(it=>{ if(m[it.frag] && m[it.frag].items.indexOf(it.name)<0) m[it.frag].items.push(it.name); });
        GEAR_SOURCES=m;
      }
      return send(res,200,{ version:1, sources:GEAR_SOURCES,
        note:'Gear fragments come only from the authored Aether Vault floors listed here. Sweeping a floor grants the same two fragments it lists.' });
    }
    const g=ensureGear(me);
    if(p==='/api/gear/state'){ return send(res,200,{ enabled:true, revision:g.revision, dust:me.dust||0,
      fragments:g.fragments, subs:g.subs, items:g.items, equipped:g.equipped, active:g.active,
      resonance:gearResonanceRank(g) }); }
    if(req.method!=='POST') return send(res,404,{error:'gear'});
    const b=await body(req);
    const er=parseInt(b.expectedRevision,10);
    if(er!==g.revision) return send(res,409,{error:'STALE', revision:g.revision});
    const ok=(extra)=>{ g.revision++; writeDB(); return send(res,200,Object.assign({ok:true, revision:g.revision, dust:me.dust||0},extra||{})); };
    const bad=(msg)=>send(res,400,{error:msg, revision:g.revision});

    if(p==='/api/gear/craft-sub'){
      const def=GEARCAT.byId[String(b.gearId||'')]; if(!def) return bad('Unknown gear.');
      if(!def.sub) return bad('Grey gear needs no sub-component.');
      if((g.fragments[def.frag]||0)<def.subFragCost) return bad('Need '+def.subFragCost+' × '+def.frag+'.');
      g.fragments[def.frag]-=def.subFragCost; if(g.fragments[def.frag]<=0) delete g.fragments[def.frag];
      g.subs[def.sub]=(g.subs[def.sub]||0)+1;
      return ok({ sub:def.sub, count:g.subs[def.sub] });
    }
    if(p==='/api/gear/craft'){
      const def=GEARCAT.byId[String(b.gearId||'')]; if(!def) return bad('Unknown gear.');
      if(def.qi===0){ // Grey: direct from its own fragments
        const cost=GEARCAT.meta.greyFragCost;
        if((g.fragments[def.frag]||0)<cost) return bad('Need '+cost+' × '+def.frag+'.');
        g.fragments[def.frag]-=cost; if(g.fragments[def.frag]<=0) delete g.fragments[def.frag];
      } else {
        if((g.subs[def.sub]||0)<1) return bad('Need the '+def.sub+' (craft it from '+def.subFragCost+' × '+def.frag+').');
        // 2 FRESH UNBOUND previous-tier items (the previous tier is a single slot by design)
        const prevQ=GEARCAT.meta.qualities[def.qi-1];
        const feed=Object.entries(g.items).filter(([id,it])=>{ const d=GEARCAT.byId[it.d];
          return d && d.quality===prevQ && !it.bound && !gearItemEquippedBy(g,id); })
          .sort((a,bb)=>((a[1].temper||0)-(bb[1].temper||0))||((a[1].dustSpent||0)-(bb[1].dustSpent||0))||((a[1].createdAt||0)-(bb[1].createdAt||0)));   // auto-fill fallback consumes the LEAST-invested items (was oldest-first, which ate heavily tempered gear)
        const pick=Array.isArray(b.ingredients)?b.ingredients.map(String):[];
        const chosen=[];
        for(const iid of pick){ const e=feed.find(([id])=>id===iid); if(e&&!chosen.includes(iid)) chosen.push(iid); if(chosen.length===2) break; }
        for(const [id] of feed){ if(chosen.length>=2) break; if(!chosen.includes(id)) chosen.push(id); }
        if(chosen.length<2) return bad('Need 2 fresh unbound '+prevQ+' items (bound gear can never be an ingredient).');
        g.subs[def.sub]-=1; if(g.subs[def.sub]<=0) delete g.subs[def.sub];
        for(const iid of chosen) delete g.items[iid];   // consumed
      }
      const nid='q'+(g.seq++); g.items[nid]={ d:def.id, temper:0, prog:0, dustSpent:0, bound:false, createdAt:Date.now() };
      return ok({ crafted:nid, gearId:def.id, name:def.name });
    }
    if(p==='/api/gear/equip'){
      const hero=String(b.heroKey||'').slice(0,24); if(!validHero(hero)) return bad('Unknown hero.'); const iid=String(b.itemId||'');
      const it=g.items[iid]; const def=it&&GEARCAT.byId[it.d];
      if(!validHero(hero)) return bad('Unknown hero.');
      if(!hero||!it||!def) return bad('Unknown item.');
      const where=gearItemEquippedBy(g,iid);
      if(where) return bad('Already equipped on '+where.hero+'.');
      g.equipped[hero]=g.equipped[hero]||{};
      g.equipped[hero][def.slot]=iid;   // replaces the slot's occupant (which stays bound, unequipped)
      it.bound=true;                    // bound-item rule: once equipped, never a crafting ingredient
      return ok({ hero, slot:def.slot, itemId:iid });
    }
    if(p==='/api/gear/unequip'){
      const hero=String(b.heroKey||'').slice(0,24); if(!validHero(hero)) return bad('Unknown hero.'); const slot=String(b.slot||'');
      if(!g.equipped[hero]||!g.equipped[hero][slot]) return bad('Nothing equipped there.');
      const iid=g.equipped[hero][slot]; delete g.equipped[hero][slot];
      if(g.active[hero]===iid) delete g.active[hero];
      return ok({ hero, slot });
    }
    if(p==='/api/gear/temper'){
      const iid=String(b.itemId||''); const it=g.items[iid]; const def=it&&GEARCAT.byId[it.d];
      if(!it||!def) return bad('Unknown item.');
      let uses=Math.max(1,Math.min(60,parseInt(b.uses,10)||1));
      const T=GEARCAT.meta.temper; let spent=0, gained=0, levels=0;
      while(uses>0){
        if((it.temper||0)>=T.max) break;
        const cost=gearTemperCost(def, it.temper||0);
        if((me.dust||0)<cost) break;
        me.dust-=cost; spent+=cost; it.dustSpent=(it.dustSpent||0)+cost;
        it.prog=(it.prog||0)+1; gained++; uses--;
        if(it.prog>=gearTemperBar(it.temper||0)){ it.temper=(it.temper||0)+1; it.prog=0; levels++; }
      }
      if(!gained) return bad((it.temper>=T.max)?'Already at Temper 30.':'Not enough Forge Dust (next use: ✨'+gearTemperCost(def,it.temper||0)+').');
      return ok({ itemId:iid, temper:it.temper, prog:it.prog, bar:gearTemperBar(it.temper), dustSpent:spent, levelsGained:levels,
        nextCost: it.temper<T.max?gearTemperCost(def,it.temper):null });
    }
    if(p==='/api/gear/extract'){
      const iid=String(b.itemId||''); const it=g.items[iid]; const def=it&&GEARCAT.byId[it.d];
      if(!it||!def) return bad('Unknown item.');
      if(gearItemEquippedBy(g,iid)) return bad('Unequip it first.');
      const refund=Math.floor((it.dustSpent||0)*GEARCAT.meta.temper.extractRefund);
      delete g.items[iid]; me.dust=(me.dust||0)+refund;
      return ok({ extracted:iid, name:def.name, refund });
    }
    if(p==='/api/gear/select-active'){
      const hero=String(b.heroKey||'').slice(0,24); if(!validHero(hero)) return bad('Unknown hero.'); const iid=String(b.itemId||'');
      const eq=g.equipped[hero]||{};
      if(!Object.values(eq).includes(iid)) return bad('That item is not equipped on this hero.');
      g.active[hero]=iid;
      const def=GEARCAT.byId[g.items[iid].d];
      return ok({ hero, itemId:iid, active:def.active });
    }
    if(p==='/api/gear/grant'){ // dev-only test faucet
      if(!isDev(me)) return send(res,403,{error:'forbidden'});
      if(b.dust){ me.dust=(me.dust||0)+Math.max(0,Math.min(10000000,parseInt(b.dust,10)||0)); }
      if(b.frag){ const def=GEARCAT.byName[String(b.frag)]||GEARCAT.byId[String(b.frag)];
        const key=def?def.frag:String(b.frag); const n=Math.max(1,Math.min(999,parseInt(b.n,10)||10));
        g.fragments[key]=(g.fragments[key]||0)+n; }
      return ok({ fragments:g.fragments });
    }
    return send(res,404,{error:'gear'});
  }

  /* ------------------------- SKYFALL TOURNAMENT (Guild Wars v2) routes -------------------------
     Never accepts client power, hero stats, rosters, outcomes, tower state or reward amounts. */
  if(p.startsWith('/api/guild-war')){
    if(!me) return send(res,401,{error:'auth'});
    if(!warEnabledFor(me)) return send(res,200,{enabled:false});
    if(rateLimited(req,'gwar',30,30000)) return send(res,429,{error:'Slow down.'});
    const t=warAdvance(getTournament());
    const myGid=me.guildId||null; const myGuildObj=myGid?(DB.guilds||{})[myGid]:null;
    const isLeaderOrOfficer=!!(myGuildObj && (myGuildObj.leader===me.id || (myGuildObj.officers||[]).includes(me.id)));

    if(p==='/api/guild-war/status'){
      const ent=myGid?warEntrant(t,myGid):null; const m=myGid?warMatchOfGuild(t,myGid):null;
      return send(res,200,{ enabled:true, tournament:{ id:t.id, weekKey:t.weekKey, state:t.state,
          registrationOpensAt:t.registrationOpensAt, registrationLocksAt:t.registrationLocksAt,
          entrants:t.entrants.map(e=>({guildId:e.guildId,name:e.name,seed:e.seed,powerPool:e.powerPool,lines:e.lines.length})),
          roundIndex:t.roundIndex||0, championGuildId:t.championGuildId||null, now:warNow() },
        registered:!!ent, yourPowerPool:ent?ent.powerPool:null, canRegister:isLeaderOrOfficer,
        pendingWarReward:(me.pendingWarRewards||[]).reduce((s,x)=>s+((x&&x.amt|0)||0),0),
        match:m?warMatchView(t,m,myGid):null });
    }
    if(p==='/api/guild-war/match'){ const m=myGid?warMatchOfGuild(t,myGid):null;
      if(!m) return send(res,200,{match:null});
      return send(res,200,{match:warMatchView(t,m,myGid)}); }
    if(req.method!=='POST') return send(res,404,{error:'guild-war'});
    const b=await body(req);

    if(p==='/api/guild-war/register'){
      if(!myGuildObj) return send(res,400,{error:'You are not in a guild.'});
      if(!isLeaderOrOfficer) return send(res,403,{error:'Only the guild leader can register.'});
      if(t.state!=='registration') return send(res,400,{error:'Registration is closed for this week.'});
      if(warEntrant(t,myGid)) return send(res,400,{error:'Already registered.'});
      const probe=warQualifyGuild(myGuildObj);   // display-only preview; AUTHORITY is the Monday-lock recompute (audit C8)
      if(!probe.lines.length) return send(res,400,{error:'No eligible members.'});
      t.entrants.push({ guildId:myGid, name:myGuildObj.name, registeredAt:warNow(),
        lines:probe.lines, powerPool:probe.powerPool, indicative:true });
      t.version++; writeDB();
      return send(res,200,{ok:true, powerPool:probe.powerPool, lines:probe.lines.length, note:'Qualification is recalculated for every registered guild at the Monday lock.'});
    }
    if(p==='/api/guild-war/unregister'){
      if(!isLeaderOrOfficer) return send(res,403,{error:'Only the guild leader can do that.'});
      if(t.state!=='registration') return send(res,400,{error:'Locked — the bracket is set.'});
      const i=t.entrants.findIndex(e=>e.guildId===myGid); if(i<0) return send(res,400,{error:'Not registered.'});
      t.entrants.splice(i,1); t.version++; writeDB(); return send(res,200,{ok:true});
    }
    if(p==='/api/guild-war/assign'){
      const m=myGid?warMatchOfGuild(t,myGid):null;
      if(!m||m.state!=='planning') return send(res,400,{error:'No match in planning.'});
      if(warNow()<(m.revealAt||0)) return send(res,400,{error:'Planning opens at the round reveal — come back then.'});
      if(!isLeaderOrOfficer) return send(res,403,{error:'Only the guild leader can arrange citadels.'});
      const side=m.sides[myGid]; const memberId=String(b.memberId||''); const lane=parseInt(b.lane,10);
      if(!(lane>=0&&lane<5)) return send(res,400,{error:'Bad lane.'});
      const ent=warEntrant(t,myGid);
      if(!ent||!ent.lines.some(l=>l.memberId===memberId)) return send(res,400,{error:'That member has no registered line.'});
      for(const c of side.citadels){ c.defenders=c.defenders.filter(d=>d.memberId!==memberId); }
      side.unplaced=(side.unplaced||[]).filter(x=>x!==memberId);
      side.citadels[lane].defenders.push({memberId});
      m.version++; writeDB();
      return send(res,200,{ok:true, match:warMatchView(t,m,myGid)});
    }
    if(p==='/api/guild-war/assault'){
      const m=myGid?warMatchOfGuild(t,myGid):null;
      if(!m||m.state!=='live') return send(res,400,{error:'No live match.'});
      const now=warNow(); if(!(now>=m.startsAt&&now<m.endsAt)) return send(res,400,{error:'Outside the battle window.'});
      const lane=parseInt(b.fromLane,10); if(!(lane>=0&&lane<5)) return send(res,400,{error:'Bad lane.'});
      const expectedV=parseInt(b.expectedVersion,10);
      if(Number.isFinite(expectedV) && expectedV!==m.version) return send(res,409,{error:'STALE', version:m.version});
      const oppGid=Object.keys(m.sides).find(g=>g!==myGid);
      const mine=m.sides[myGid].citadels[lane], foe=m.sides[oppGid].citadels[lane];
      if(mine.destroyed) return send(res,400,{error:'Your '+WAR_LANES[lane].name+' has fallen — no marches from it.'});
      if(foe.destroyed) return send(res,400,{error:'That citadel is already destroyed.'});
      const attacker=mine.defenders.find(d=>d.memberId===me.id&&d.alive!==false);
      if(!attacker) return send(res,400,{error:'Your line is not deployed (alive) in this citadel.'});
      m.assaults=m.assaults||{};
      if((m.assaults[me.id]||0)>=WAR_ASSAULTS_PER_LINE) return send(res,400,{error:'No assault orders left for your line.'});
      const defender=foe.defenders.find(d=>d.alive!==false);
      m.assaults[me.id]=(m.assaults[me.id]||0)+1;   // every attack spends an order, win or lose
      if(!defender){ // undefended citadel: the march captures it without a fight (still costs an order)
        foe.destroyed=true; m.eventLog.push({t:warNow(),e:'CITADEL_CAPTURED',lane,by:me.id});
        let finished=false; if(warDestroyedCount(m,myGid)>=3){ warFinishMatch(t,m,myGid,'citadels'); finished=true; }
        m.version++; writeDB();
        return send(res,200,{ ok:true, won:true, captured:true, citadelFell:true, finished, match:warMatchView(t,m,myGid) }); }
      const seed=SIM.seedFrom(m.id+':'+me.id+':'+lane+':'+m.version);
      const aLine=SIM.makeLine(attacker.lineSnapshot, attacker.hpState);
      const bLine=SIM.makeLine(defender.lineSnapshot, defender.hpState);
      const r=SIM.resolveLineBattle(aLine,bLine,seed);
      // persist survivor HP/energy on BOTH lines (keyed back to snapshot order)
      const mapBack=(snap, state)=>snap.map(h=>{ const st=state.find(x=>x.key===h.key); return st?{hp:st.hp,energy:st.energy}:{hp:0,energy:0}; });
      attacker.hpState=mapBack(attacker.lineSnapshot, r.aState);
      defender.hpState=mapBack(defender.lineSnapshot, r.bState);
      if(!r.aState.some(x=>x.alive)) attacker.alive=false;
      if(!r.bState.some(x=>x.alive)) defender.alive=false;
      let citadelFell=false;
      if(!foe.defenders.some(d=>d.alive!==false)){ foe.destroyed=true; citadelFell=true; m.eventLog.push({t:warNow(),e:'CITADEL_FELL',lane,by:me.id}); }
      m.eventLog.push({t:warNow(),e:'ASSAULT',lane,a:me.id,d:defender.memberId,won:r.won});
      let finished=false;
      if(warDestroyedCount(m,myGid)>=3){ warFinishMatch(t,m,myGid,'citadels'); finished=true; }
      m.version++; writeDB();
      return send(res,200,{ ok:true, won:r.won, citadelFell, finished,
        replay:{ seed, lane, attacker:attacker.lineSnapshot, defender:defender.lineSnapshot, log:r.log.slice(0,200) },
        result:{ aState:r.aState, bState:r.bState, rounds:r.rounds },
        match:warMatchView(t,m,myGid) });
    }
    if(p==='/api/guild-war/claim-reward'){
      if(t.state==='finished') warEscrowRewards(t);   // idempotent; also settles a bracket that finished before this build
      const pend=(me.pendingWarRewards||[]).filter(x=>x&&(x.amt|0)>0);
      if(!pend.length) return send(res,400,{error:t.state==='finished'?'You did not take part in this tournament.':'Nothing to claim.'});
      const total=pend.reduce((s,x)=>s+(x.amt|0),0), last=pend[pend.length-1];
      me.coins=(me.coins||0)+total; me.pendingWarRewards=[];
      const tt=(last.tid===t.id)?t:(((DB.tournaments||{}).archive)||{})[last.weekKey];
      if(tt&&tt.id===last.tid){ tt.rewards=tt.rewards||{}; tt.rewards[(last.gid||'-')+':'+me.id]={t:warNow(),amt:total,tid:last.tid}; if(tt===t) t.version++; }
      writeDB();
      return send(res,200,{ok:true, coins:me.coins, amount:total, tier:last.tier});
    }
    if(p==='/api/guild-war/debug-warp'){   // dev-only lifecycle testing: shift server war-time
      if(!isDev(me)) return send(res,403,{error:'forbidden'});
      DB.warTimeOffset=(parseInt(b.offsetMs,10)|0)||0; writeDB();
      const t2=warAdvance(getTournament());
      return send(res,200,{ok:true, offset:DB.warTimeOffset, state:t2.state, now:warNow()});
    }
    return send(res,404,{error:'guild-war'});
  }

  /* ------------------------- AETHER VAULT (Dungeon v2) routes -------------------------
     Never accepts: floor number, win/loss, stats, enemy power, Dust, quality, fragment or roll. */
  if(p.startsWith('/api/dungeon')||p==='/api/fragments/salvage'){
    if(!me) return send(res,401,{error:'auth'});
    if(!dungeonEnabledFor(me)) return send(res,200,{enabled:false});
    /* v364 (Phil): "the dungeon should not even be available until level 10". Player level, from the
       ledger. Dev accounts pass (God Mode opens every building). */
    { const _pl=ledPlayerLevel(ensureLedger(me)); if(!isDev(me)&&_pl<VAULT_UNLOCK_LEVEL) return send(res,200,{enabled:false, locked:true, unlockLevel:VAULT_UNLOCK_LEVEL, playerLevel:_pl}); }
    if(rateLimited(req,'dungeon',40,60000)) return send(res,429,{error:'Slow down.'});
    const prog=getDungeonProgress(me.id);
    resetDungeonSweepIfNewDay(prog.sweep);
    if(p==='/api/dungeon/status'){ return send(res,200,Object.assign({enabled:true},dungeonView(prog))); }
    if(req.method!=='POST') return send(res,404,{error:'dungeon'});
    const b=await body(req);
    const reqId=String(b.requestId||'').slice(0,64);
    if(!reqId) return send(res,400,{error:'requestId required'});

    if(p==='/api/dungeon/dev-floor'){   // v362 (Phil): God Mode only — jump the Vault to any floor 1..100, cleared or not, for testing bosses
      if(!isDev(me)) return send(res,403,{error:'dev only'});
      const f=Math.max(1,Math.min(DUNGEON_MAX_FLOOR,parseInt(b.floor,10)||0));
      if(!f) return send(res,400,{error:'floor 1..'+DUNGEON_MAX_FLOOR});
      prog.activeAttempt=null; prog.currentFloor=f; if(prog.vaultStatus==='complete') prog.vaultStatus='active';
      prog.version++; writeDB();
      return send(res,200,Object.assign({ok:true, enabled:true},dungeonView(prog)));
    }
    if(p==='/api/dungeon/start-battle'){
      if(prog.activeAttempt) prog.activeAttempt=null;   // an unresolved attempt (closed the app mid-fight) is abandoned = a loss; floors only advance through a resolved win
      if(prog.vaultStatus==='complete'||prog.currentFloor>DUNGEON_MAX_FLOOR) return send(res,400,{error:'You have cleared the Aether Vault. Its extension is coming soon.'});
      // Vault teams: 5 fighters + up to 5 backups (a backup steps in when a fighter falls)
      const ids=Array.isArray(b.heroIds)?b.heroIds.map(String):[];
      if(ids.length<5||ids.length>10||new Set(ids).size!==ids.length) return send(res,400,{error:'Pick 5 fighters (plus up to 5 backups), no duplicates.'});
      const vled=ensureLedger(me);   // AUDIT v229 (P0): ownership is enforced — locked heroes never enter the Vault
      for(const k of ids){ if(!SIM.HERO_BASE[k]||!vled.unlocked[k]) return send(res,400,{error:'You have not unlocked '+k+'.'}); }
      const save=parseSaveOf(me);
      const snaps=ids.map(k=>snapshotHeroFromServer(me,k,save));
      if(snaps.some(s=>!s)) return send(res,400,{error:'Unknown hero in the team.'});
      const floor=prog.currentFloor;
      const attempt={ id:uid(), floor, heroIds:ids, teamSnapshot:snaps, enemyWaves:buildDungeonWaves(floor), startedAt:Date.now() };
      prog.lastTeamHeroIds=ids; prog.activeAttempt=attempt; prog.version++; writeDB();
      return send(res,200,{ ok:true, attemptId:attempt.id, floor, bossRule:bossRuleForFloor(floor),
        waves:attempt.enemyWaves });   // fixed monster lineup for this floor — the fight happens in the client
    }
    if(p==='/api/dungeon/resolve-battle'){
      const out=idem(me.id+':dresolve:'+reqId,()=>{
        const a=prog.activeAttempt;
        if(!a||a.id!==String(b.attemptId||'')) return { ok:false, error:'No matching Vault battle.' };
        prog.activeAttempt=null;
        // AUDIT C7 (owner-approved): the result is SERVER-AUTHORITATIVE. The client's `won` is not
        // read; the deterministic estimate — with the documented, deterministic skill band standing
        // in for manual play/backups (vaultWinPlausible) — decides the floor.
        if(isDev(me)&&prog.claimedFloors[a.floor]){ prog.version++; writeDB();   // v362: dev replaying an already-cleared floor — no reward, progress untouched
          return { ok:true, result:{won:true, replay:true}, reward:null, dust:me.dust||0, progress:dungeonView(prog) }; }
        const won=vaultWinPlausible(a);
        if(!won){ prog.version++; writeDB();
          return { ok:true, result:{won:false, authoritative:true}, progress:dungeonView(prog) }; }
        if(Date.now()-a.startedAt<VAULT_MIN_BATTLE_MS){ prog.version++; writeDB(); return { ok:false, error:'That was too fast to be a real battle.' }; }
        if(a.floor!==prog.currentFloor||prog.claimedFloors[a.floor]){ prog.version++; writeDB();
          return { ok:false, error:'Stale Vault floor.' }; }
        const reward=makeFirstClearDungeonReward(a.floor);   // rolls with server RNG; persisted below + in the idempotency record
        grantDungeonReward(me, reward);
        { const led=ensureLedger(me); reward.heroXp=VAULT_HERO_XP_PER_FLOOR;   // v370: 30 hero XP per floor to everyone who fought (fighters + backups)
          for(const k of a.heroIds){ const h=led.hero[k]||(led.hero[k]={xp:0,stars:SIM.HERO_BASE[k]?SIM.HERO_BASE[k].stars:1,pips:0}); h.xp=Math.min(99000000,h.xp+reward.heroXp); }
          ledTx(me,'vault:clear:'+a.floor,{heroXp:reward.heroXp}); }
        prog.claimedFloors[a.floor]={ claimedAt:Date.now(), dust:reward.dust, fragments:reward.fragments||[] };
        prog.highestClearedFloor=a.floor; prog.currentFloor=a.floor+1;
        if(a.floor===DUNGEON_MAX_FLOOR) prog.vaultStatus='complete';
        prog.version++; writeDB();
        return { ok:true, result:{won:true}, reward, dust:me.dust||0, progress:dungeonView(prog) };
      });
      return send(res, out.ok===false?400:200, out);
    }
    if(p==='/api/dungeon/sweep'){
      const out=idem(me.id+':dsweep:'+reqId,()=>{
        resetDungeonSweepIfNewDay(prog.sweep);
        const sweepCost=vaultSweepNextCost(prog.sweep);
        if(sweepCost===null) return { ok:false, error:'No Sweeps left today (2 free + 3 paid).', nextResetAt:dungeonNextReset() };
        if(sweepCost>0){ const led=ensureLedger(me); if(led.gems<sweepCost) return { ok:false, error:'Not enough diamonds — this Sweep costs '+sweepCost+'.' }; led.gems-=sweepCost; ledTx(me,'vault:sweep:paid',{gems:-sweepCost}); }
        if(prog.activeAttempt) prog.activeAttempt=null;   // v371 (Phil: "sweep button isn't working"): an unresolved attempt (closed the app mid-fight / God-Mode floor jump) is abandoned = a loss, same rule as start-battle — it must not block sweeping
        if(prog.highestClearedFloor<1) return { ok:false, error:'Clear a floor first.' };
        const rnd=Math.random;   // AUDIT C7: rolled per sweep transaction, persisted via the idempotency record
        const rewards=[]; let dust=0; const frags={}; const gfrags={};
        for(let f=1;f<=prog.highestClearedFloor;f++){ const r=makeStandardDungeonFloorReward(f,rnd);
          dust+=r.dust; (r.fragments||[]).forEach(k=>frags[k]=(frags[k]||0)+1); (r.gearFragments||[]).forEach(k=>gfrags[k]=(gfrags[k]||0)+1); rewards.push(Object.assign({floor:f},r)); }
        grantDungeonReward(me,{dust, fragments:Object.entries(frags).flatMap(([k,n])=>Array(n).fill(k)),
          gearFragments:Object.entries(gfrags).flatMap(([k,n])=>Array(n).fill(k))});
        // v370 (Phil): a sweep pays the hero XP of every floor swept to the last line that fought in the Vault
        const sweepTeam=(prog.lastTeamHeroIds||[]).filter(k=>SIM.HERO_BASE[k]); const heroXp=VAULT_HERO_XP_PER_FLOOR*prog.highestClearedFloor;
        if(sweepTeam.length){ const led=ensureLedger(me); for(const k of sweepTeam){ const h=led.hero[k]||(led.hero[k]={xp:0,stars:SIM.HERO_BASE[k]?SIM.HERO_BASE[k].stars:1,pips:0}); h.xp=Math.min(99000000,h.xp+heroXp); } ledTx(me,'vault:sweep:x'+prog.highestClearedFloor,{heroXp}); }
        if(sweepCost===0) prog.sweep.freeUsesRemaining--; prog.sweep.totalSweepsToday++; prog.version++; writeDB();
        return { ok:true, totalDust:dust, fragments:frags, gearFragments:gfrags, floors:prog.highestClearedFloor, heroXp:sweepTeam.length?heroXp:0, heroXpTeam:sweepTeam, perFloor:rewards, heroXpPerFloor:sweepTeam.length?VAULT_HERO_XP_PER_FLOOR:0, /* v372: the sweep pop-up lists every floor's drops */ sweep:{freeUsesRemaining:prog.sweep.freeUsesRemaining, nextResetAt:dungeonNextReset(), nextCost:vaultSweepNextCost(prog.sweep)}, dust:me.dust||0, gemsSpent:sweepCost, ledger:ledgerView(me) };
      });
      return send(res, out.ok===false?400:200, out);
    }
    if(p==='/api/fragments/salvage'){
      const out=idem(me.id+':salv:'+reqId,()=>{
        const stacks=Array.isArray(b.stacks)?b.stacks.slice(0,64):[];
        if(!stacks.length) return { ok:false, error:'Nothing selected.' };
        const g=ensureGlyphs(me); const seen=new Set(); let dust=0; const spend={};
        for(const st of stacks){ const key=String(st.key||''); const qty=Math.floor(+st.quantity);
          if(seen.has(key)) return { ok:false, error:'Duplicate fragment stack.' }; seen.add(key);
          if(!(qty>=1)) return { ok:false, error:'Bad quantity.' };
          /* 30 Aug — EVERY GRADED FRAGMENT PAID THE BASE RATE.
             find() returns the FIRST match in insertion order, and 'Blue' is listed before 'Blue +2',
             so "Blue +2 Worldheart" resolved to 'Blue' — 12 dust instead of 25. The whole graded half
             of FRAG_SALVAGE_DUST was dead: Purple +3 paid 50 instead of 100, Gold +1 paid 150 instead
             of 200. Longest match wins, so the grade is respected. */
          const qual=Object.keys(FRAG_SALVAGE_DUST).filter(q=>key.startsWith(q+' ')).sort((a,b)=>b.length-a.length)[0];
          if(!qual) return { ok:false, error:'Unknown fragment: '+key };
          if((g.fragments[key]||0)<qty) return { ok:false, error:'You do not own '+qty+' × '+key+'.' };
          dust+=FRAG_SALVAGE_DUST[qual]*qty; spend[key]=qty; }
        for(const k in spend){ g.fragments[k]-=spend[k]; if(g.fragments[k]<=0) delete g.fragments[k]; }
        g.revision++; me.dust=(me.dust||0)+dust; writeDB();
        return { ok:true, dustGained:dust, dust:me.dust, fragments:g.fragments };
      });
      return send(res, out.ok===false?400:200, out);
    }
    return send(res,404,{error:'dungeon'});
  }

  /* ------------------------- GLYPH ASCENSION v2 routes -------------------------
     Server-authoritative. The client sends ONLY: definitionId / subKey / heroKey /
     slot / instance ids / expectedRevision. Any client-submitted stat, quantity,
     output id, power or quality is ignored by construction — nothing here reads one. */
  if(p.startsWith('/api/glyphs')){
    if(!me) return send(res,401,{error:'auth'});
    if(!GLYPHS) return send(res,200,{enabled:false});
    if(p==='/api/glyphs/catalog'){ if(!glyphsEnabledFor(me)) return send(res,404,{error:'disabled'});
      return send(res,200,{ version:GLYPHS.version, ladder:GLYPH_LADDER, ladderMinLevel:GLYPH_MIN_LEVEL, slots:GLYPH_SLOTS, slotFamilies:GLYPH_SLOT_FAMILIES,
        defs:GLYPHS.raw.map(d=>({id:d.id,quality:d.quality,qi:d.qi,strength:d.strength,name:d.name,family:d.family,statFocus:d.statFocus,stats:d.stats,ing:d.ing,recipeText:d.recipeText})),
        subs:Object.values(GLYPHS.subs) }); }
    if(p==='/api/glyphs/state'){
      if(!glyphsEnabledFor(me)) return send(res,200,{enabled:false});
      glyphMigrate(me); glyphFlowMigrate(me); const g=ensureGlyphs(me); writeDB();
      // Correction Spec v1: materials + locked boards + permanent bonuses ONLY — no loose
      // finished-Glyph or Sub-Glyph inventory exists in the player model any more.
      return send(res,200,{ enabled:true, revision:g.revision, fragments:g.fragments,
        ladder:GLYPH_LADDER, catalogVersion:GLYPHS.version,
        boards:glyphBoardsView(g), migratedAt:g.migratedAt||0, flowMigratedAt:g.flow2At||0 }); }
    if(!glyphsEnabledFor(me)) return send(res,403,{error:'disabled'});
    // AUDIT (glyph-tree-cost): the two GET read models below (slot-options, build-tree) return BEFORE
    // the POST-only limiter further down, so they were completely unthrottled. Own bucket, own budget:
    // g2CanBuild() legitimately fires one build-tree GET per empty slot per glyph revision.
    if(rateLimited(req,'glyphsRead',GLYPH_RL_PER_MIN*4,60000)) return send(res,429,{error:'Slow down.'});
    if(p==='/api/glyphs/slot-options'){ // GET: server-derived legal blueprints for one empty slot
      glyphMigrate(me); glyphFlowMigrate(me); const g=ensureGlyphs(me);
      const hero=String(url.searchParams.get('heroKey')||'').slice(0,24); const slot=parseInt(url.searchParams.get('slot'),10);
      if(!SIM.HERO_BASE[hero]) return send(res,400,{error:'Unknown hero.'});
      if(!ensureLedger(me).unlocked[hero]) return send(res,400,{error:'You have not unlocked '+hero+'.'});
      if(!(slot>=0&&slot<6)) return send(res,400,{error:'Bad slot.'});
      const board=glyphBoard(g,hero);
      if(board.ascensionIndex>=GLYPH_MAX_ASC) return send(res,400,{error:'Fully ascended.'});
      if(board.slots[slot]){ const inst=g.finished[board.slots[slot]]; const d=inst&&GLYPHS.byId[inst.definitionId];
        return send(res,200,{ filled:true, blueprintId:d?d.id:null, name:d?d.name:null, locked:true }); }
      // v232 (Phil): ONE pre-chosen glyph per slot — the server returns exactly one blueprint.
      const pre=glyphPreChoice(hero, slot, board.ascensionIndex);
      const opts=(pre?[pre]:[]).map(d=>{
        const cost=g2BuildCost(g,d)||{need:{},useSubs:{}};
        const materials=Object.keys(cost.need).map(k=>({ fragmentId:glyphFragSlug(k), key:k, displayName:k+' Fragment',
          need:cost.need[k], have:(g.fragments[k]|0), sources:portalSourcesFor(k) }));
        return { blueprintId:d.id, name:d.name, family:d.family, quality:d.quality, stats:d.stats,
          materials, buildable:materials.every(m=>m.have>=m.need) }; });
      return send(res,200,{ hero, slot, quality:GLYPH_LADDER[board.ascensionIndex], ascensionIndex:board.ascensionIndex,
        revision:g.revision, options:opts }); }
    if(p==='/api/glyphs/build-tree'){ // GET: the slot's one glyph as a full canonical ancestry tree
      glyphMigrate(me); glyphFlowMigrate(me); const g=ensureGlyphs(me);
      const hero=String(url.searchParams.get('heroKey')||'').slice(0,24); const slot=parseInt(url.searchParams.get('slot'),10);
      if(!SIM.HERO_BASE[hero]) return send(res,400,{error:'Unknown hero.'});
      if(!ensureLedger(me).unlocked[hero]) return send(res,400,{error:'You have not unlocked '+hero+'.'});
      if(!(slot>=0&&slot<6)) return send(res,400,{error:'Bad slot.'});
      const board=glyphBoard(g,hero);
      if(board.slots[slot]){ // locked slot: read-only ancestry, no actions ever
        const inst=g.finished[board.slots[slot]]; const d=inst&&GLYPHS.byId[inst.definitionId];
        if(!d) return send(res,400,{error:'Corrupt slot.'});
        return send(res,200,{ heroKey:hero, slot, blueprintId:d.id, revision:g.revision, locked:true,
          root:glyphTreeFinished(g,d), totals:[], canQuickAllocate:false, canBuild:false }); }
      if(board.ascensionIndex>=GLYPH_MAX_ASC) return send(res,400,{error:'Fully ascended.'});
      const pre=glyphPreChoice(hero, slot, board.ascensionIndex);
      if(!pre) return send(res,400,{error:'No blueprint for this slot.'});
      const cost=g2BuildCost(g,pre)||{need:{}};
      const totals=Object.keys(cost.need).map(k=>({ fragmentId:glyphFragSlug(k), key:k, displayName:k+' Fragment',
        need:cost.need[k], have:(g.fragments[k]|0), sources:portalSourcesFor(k) }));
      const canBuild=totals.every(t=>t.have>=t.need);
      const lvNeed=glyphLevelGate(board.ascensionIndex), lvHave=ledHeroLevel(ensureLedger(me),hero);
      const lvOk=lvHave>=lvNeed;
      return send(res,200,{ heroKey:hero, slot, blueprintId:pre.id, revision:g.revision, locked:false,
        quality:GLYPH_LADDER[board.ascensionIndex], ascensionIndex:board.ascensionIndex,
        levelRequired:lvNeed, heroLevel:lvHave, levelOk:lvOk,
        root:glyphTreeFinished(g,pre), totals, canQuickAllocate:canBuild&&lvOk, canBuild:canBuild&&lvOk,
        canBuildAll:lvOk&&glyphBuildAllPlan(g,hero,board).canAll }); }
    if(req.method!=='POST') return send(res,404,{error:'glyphs'});
    if(rateLimited(req,'glyphs',GLYPH_RL_PER_MIN,60000)) return send(res,429,{error:'Slow down.'});
    // Correction Spec v1: the Craft / Inventory / Socket / Unsocket loop is RETIRED.
    if(p==='/api/glyphs/craft'||p==='/api/glyphs/craft-sub'||p==='/api/glyphs/socket'||p==='/api/glyphs/salvage')
      return send(res,410,{error:'GLYPH_FLOW_REPLACED'});
    if(p==='/api/glyphs/unsocket') return send(res,410,{error:'GLYPH_LOCKED'});
    const b=await body(req); glyphMigrate(me); glyphFlowMigrate(me); const g=ensureGlyphs(me);
    if(p==='/api/glyphs/build-in-slot'){ const rid0=String(b.requestId||'').slice(0,48);
      if(rid0 && g.applied && g.applied[rid0]) return send(res,200,g.applied[rid0]); }   // idempotent retry beats the STALE check
    if(p==='/api/glyphs/build-all'){ const rid0=String(b.requestId||'').slice(0,48);
      if(rid0 && g.applied && g.applied[rid0]) return send(res,200,g.applied[rid0]); }   // v242: same idempotency rule
    const er=parseInt(b.expectedRevision,10);
    if(er!==g.revision) return send(res,409,{error:'STALE', revision:g.revision});
    const ok=(extra)=>{ glyphPruneConsumed(g); g.revision++; writeDB(); return send(res,200,Object.assign({ok:true, revision:g.revision},extra||{})); };
    const bad=(msg)=>send(res,400,{error:msg, revision:g.revision});

    if(p==='/api/glyphs/build-in-slot'){
      // Correction Spec v1: the ONLY way a Glyph comes to exist — verified and consumed atomically,
      // written permanently into one chosen slot. No loose instance, no removal, no replacement.
      const rid=String(b.requestId||'').slice(0,48); if(!rid) return bad('requestId required');
      const hero=String(b.heroKey||'').slice(0,24); if(!validHero(hero)) return bad('Unknown hero.'); const slot=parseInt(b.slot,10);
      if(!SIM.HERO_BASE[hero]) return bad('Unknown hero.');
      if(!ensureLedger(me).unlocked[hero]) return bad('You have not unlocked '+hero+'.');
      if(!(slot>=0&&slot<6)) return bad('Bad slot.');
      const def=GLYPHS.byId[String(b.blueprintId||'')]; if(!def) return bad('Unknown blueprint.');
      const board=glyphBoard(g,hero);
      if(board.ascensionIndex>=GLYPH_MAX_ASC) return bad('This hero is fully ascended.');
      if(board.slots[slot]) return bad('That slot is already locked.');
      if(def.qi!==board.ascensionIndex) return bad('This board builds '+GLYPH_LADDER[board.ascensionIndex]+' glyphs.');
      { const need=glyphLevelGate(board.ascensionIndex), have=ledHeroLevel(ensureLedger(me),hero);
        if(have<need) return bad(GLYPH_LADDER[board.ascensionIndex]+' glyphs need hero level '+need+' — '+hero+' is level '+have+'.'); }
      const heroRole=(SIM.HERO_BASE[hero]||{}).role;
      if(!glyphAllowed(slot,def,heroRole)) return bad('A '+def.family+' glyph does not fit the '+GLYPH_SLOTS[slot]+' slot.');
      // v232 (Phil): the slot builds exactly its ONE pre-chosen glyph — nothing else.
      const preDef=glyphPreChoice(hero, slot, board.ascensionIndex);
      if(!preDef || preDef.id!==def.id) return bad('This slot forges '+(preDef?preDef.name:'nothing')+' — that is its set glyph.');
      const cost=g2BuildCost(g,def); if(!cost) return bad('Corrupt recipe.');
      for(const k in cost.need) if((g.fragments[k]|0)<cost.need[k]) return bad('Need '+cost.need[k]+' × '+k+' Fragments.');
      for(const k in cost.need){ g.fragments[k]-=cost.need[k]; if(g.fragments[k]<=0) delete g.fragments[k]; }
      for(const sk in cost.useSubs){ g.subGlyphs[sk]-=cost.useSubs[sk]; if(g.subGlyphs[sk]<=0) delete g.subGlyphs[sk]; }
      const nid='g'+(g.seq++); g.finished[nid]={ definitionId:def.id, status:'locked', builtAt:Date.now(), requestId:rid };
      board.slots[slot]=nid;
      glyphAudit(g,'build',{hero,slot,def:def.id,rid});
      glyphPruneConsumed(g); g.revision++;
      const receipt={ ok:true, revision:g.revision, hero, slot, blueprintId:def.id, name:def.name, locked:true,
        consumed:Object.keys(cost.need).map(k=>({ fragmentId:glyphFragSlug(k), key:k, quantity:cost.need[k] })),
        board:glyphBoardsView(g)[hero] };
      g.applied=g.applied||{}; g.applied[rid]=receipt;
      const rids=Object.keys(g.applied); if(rids.length>60) for(const old of rids.slice(0,rids.length-60)) delete g.applied[old];
      writeDB(); return send(res,200,receipt);
    }
    if(p==='/api/glyphs/build-all'){
      // v242 (Phil): "Quick Allocate All" INSTANTLY BUILDS every empty slot's pre-chosen glyph —
      // ALL OR NOTHING. If the account cannot afford every empty slot CUMULATIVELY (combined
      // fragment cost), the whole call is refused and nothing is consumed.
      const rid=String(b.requestId||'').slice(0,48); if(!rid) return bad('requestId required');
      if(g.applied && g.applied[rid]) return send(res,200,g.applied[rid]);
      const hero=String(b.heroKey||'').slice(0,24); if(!validHero(hero)) return bad('Unknown hero.');
      if(!SIM.HERO_BASE[hero]) return bad('Unknown hero.');
      if(!ensureLedger(me).unlocked[hero]) return bad('You have not unlocked '+hero+'.');
      const board=glyphBoard(g,hero);
      if(board.ascensionIndex>=GLYPH_MAX_ASC) return bad('This hero is fully ascended.');
      { const need=glyphLevelGate(board.ascensionIndex), have=ledHeroLevel(ensureLedger(me),hero);
        if(have<need) return bad(GLYPH_LADDER[board.ascensionIndex]+' glyphs need hero level '+need+' — '+hero+' is level '+have+'.'); }
      const plan=glyphBuildAllPlan(g,hero,board);
      if(!plan.slots.length) return bad('Every slot is already built.');
      if(!plan.canAll) return bad('Not enough materials for all '+plan.slots.length+' remaining slots.');
      const built=[];
      for(const st of plan.slots){ const def=st.def, cost=st.cost;
        for(const k in cost.need){ g.fragments[k]-=cost.need[k]; if(g.fragments[k]<=0) delete g.fragments[k]; }
        for(const sk in cost.useSubs){ g.subGlyphs[sk]-=cost.useSubs[sk]; if(g.subGlyphs[sk]<=0) delete g.subGlyphs[sk]; }
        const nid='g'+(g.seq++); g.finished[nid]={ definitionId:def.id, status:'locked', builtAt:Date.now(), requestId:rid+':'+st.slot };
        board.slots[st.slot]=nid;
        glyphAudit(g,'build',{hero,slot:st.slot,def:def.id,rid});
        built.push({slot:st.slot, blueprintId:def.id, name:def.name});
      }
      glyphPruneConsumed(g); g.revision++;
      const receipt={ ok:true, revision:g.revision, hero, built, board:glyphBoardsView(g)[hero] };
      g.applied=g.applied||{}; g.applied[rid]=receipt;
      const rids=Object.keys(g.applied); if(rids.length>60) for(const old of rids.slice(0,rids.length-60)) delete g.applied[old];
      writeDB(); return send(res,200,receipt);
    }
    if(p==='/api/glyphs/ascend'){
      const hero=String(b.heroKey||'').slice(0,24); if(!validHero(hero)) return bad('Unknown hero.'); const board=g.boards[hero];
      if(!board) return bad('Nothing socketed on this hero.');
      if(board.ascensionIndex>=GLYPH_MAX_ASC) return bad('Already fully ascended.');
      if(board.slots.some(s=>!s)) return bad('All six slots must be filled to ascend.');
      // validate every socketed instance is legal BEFORE consuming anything (atomic: reject → nothing consumed)
      // RE-AUDIT FIX (26 Aug): ascend must revalidate with the SAME role the socket check used —
      // without it, a legally socketed role-override family (e.g. Tank's Stoneheart in Bulwark)
      // made the board un-ascendable.
      const ascRole=(SIM&&SIM.HERO_BASE[hero]||{}).role;
      const insts=[];
      for(let i=0;i<6;i++){ const inst=g.finished[board.slots[i]]; const def=inst&&GLYPHS.byId[inst.definitionId];
        if(!inst || !/^(locked|socketed)$/.test(inst.status) || !def || def.qi!==board.ascensionIndex || !glyphAllowed(i,def,ascRole)) return bad('Illegal board — slot '+(i+1)+' is not a valid locked build.');
        insts.push([inst,def]); }
      const now=Date.now();
      for(const [inst,def] of insts){ inst.status='consumed'; inst.consumedAt=now;
        for(const s of def.stats){ const cur=board.ascended[s.stat]||{val:0,pct:s.pct}; cur.val=+(cur.val+s.val).toFixed(2); cur.pct=s.pct; board.ascended[s.stat]=cur; } }
      const fed=board.slots.slice(); board.slots=[null,null,null,null,null,null]; board.ascensionIndex++;
      glyphAudit(g,'ascend',{hero, to:board.ascensionIndex, fed});
      return ok({ hero, ascensionIndex:board.ascensionIndex, ascended:board.ascended });
    }
    if(p==='/api/glyphs/grant'){ // dev-only test faucet (optionally targets a named account)
      if(!isDev(me)) return send(res,403,{error:'forbidden'});
      const q=String(b.quality||'Grey'); const fam=String(b.family||'Stoneheart'); const n=Math.max(-9999,Math.min(500,parseInt(b.n,10)||10));   // negative allowed: dev-only fixture for insufficiency tests
      if(GLYPH_LADDER.indexOf(q)<0) return bad('Bad quality.');
      const tgt=(b.userId&&DB.users[String(b.userId)])||me;
      const gt=tgt===me?g:(glyphMigrate(tgt),glyphFlowMigrate(tgt),ensureGlyphs(tgt));
      gt.fragments[q+' '+fam]=Math.max(0,(gt.fragments[q+' '+fam]||0)+n);
      glyphAudit(gt,'grant',{k:q+' '+fam,n,by:me.id});
      if(tgt!==me){ gt.revision++; writeDB(); return send(res,200,{ok:true, revision:g.revision, target:tgt.id, fragments:gt.fragments}); }
      return ok({ fragments:g.fragments });
    }
    return send(res,404,{error:'glyphs'});
  }

  if(p==='/api/save' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'}); const b=await body(req, BODY_MAX_SAVE);
    /* v272 (full-game audit): `team`/`wall` are the player's chosen line-up — UI state, not power.
       They used to be stored verbatim, unbounded, and a forged `level`/`rank` inside them reached a
       reward formula. Store the keys only, capped, and let the ledger supply every stat. */
    if(Array.isArray(b.team)) me.team=sanitizeRoster(b.team);
    if(Array.isArray(b.wall)) me.wall=sanitizeRoster(b.wall);
    if(b.roster) me.roster=sanitizeSave(me, b.roster);   // clamp impossible values + flag implausible jumps
    if(b.world && typeof b.world==='object'){   // world-map presence: region + castle position + display stats
      const w=b.world;
      me.world={ region:String(w.region||'').slice(0,16), x:Math.max(0,Math.min(100,+w.x||0)), y:Math.max(0,Math.min(100,+w.y||0)),
                 level:Math.max(1,Math.min(100,parseInt(w.level,10)||1)), power:Math.max(0,Math.min(99999999,parseInt(w.power,10)||0)), t:Date.now() }; }
    writeDB(); return send(res,200,{ok:true}); }

  // ---- PVP ATTACK REPORTS: when a player raids a REAL castle, the defender gets mail. ----

  /* ---------------- LEDGER + CAMPAIGN routes (audit C1/C2) ---------------- */
  if(p==='/api/pool/state'){ if(!me)return send(res,401,{error:'auth'});
    const led=ensureLedger(me), pool=poolState(me); const now=Date.now(), dk=nyDayKey();
    if(pool.goldUsedDay!==dk){ pool.goldUsedDay=dk; pool.goldFree=0; }
    const goldFreeReady=pool.goldFree<WISH_GOLD_FREE_MAX && (now-pool.goldLast)>=WISH_GOLD_FREE_MS;
    const gemFreeReady=pool.gemFreeDay!==dk && (now-(me.created||0))>=WISH_FIRST_GEM_DELAY_MS;
    writeDB();
    return send(res,200,{ odds:{konwu:0.001,full3:0.01,full2:0.08,frag2:0.15,frag3:0.10,goldHero:0.05,goldFrag:0.15},
      pity:{at:WISH_GEM_PITY,count:pool.pity}, costs:{gold:WISH_GOLD_COST,gem:WISH_GEM_COST,mult10:WISH10_MULT},
      goldFree:{ready:goldFreeReady,usedToday:pool.goldFree,max:WISH_GOLD_FREE_MAX,nextMs:Math.max(0,WISH_GOLD_FREE_MS-(now-pool.goldLast))},
      gemFree:{ready:gemFreeReady}, firstDone:pool.gemFirstDone, ledger:ledgerView(me) }); }
  if(p==='/api/pool/history'){ if(!me)return send(res,401,{error:'auth'});
    // v251 (audit): the AUDITABLE roll history — every wish this account made, server-recorded
    const pool=poolState(me);
    return send(res,200,{ history:(pool.history||[]).slice(-60).reverse(), pity:{at:WISH_GEM_PITY,count:pool.pity} }); }
  if(p==='/api/pool/wish' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    /* 28 Aug: the wish quest counter used to be incremented HERE — before the pool was validated,
       before the cost was checked, and OUTSIDE the idempotency wrapper. So a refused wish ("Not
       enough gold", "Unknown pool", the Diamond Pool cooldown) still counted toward "wish N times",
       and a retried request counted twice. It now increments only on a roll that actually happened. */
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':wish:'+reqId,()=>{
      const led=ensureLedger(me), pool=poolState(me); const which=String(b.pool||''); const n=(b.n|0)===10?10:1;
      const now=Date.now(), dk=nyDayKey();
      if(pool.goldUsedDay!==dk){ pool.goldUsedDay=dk; pool.goldFree=0; }
      let cost=0, cur=null, free=false, rigged=false;
      if(which==='gold'){ cur='gold';
        free=(n===1)&&pool.goldFree<WISH_GOLD_FREE_MAX&&(now-pool.goldLast)>=WISH_GOLD_FREE_MS;
        cost=free?0:(n===10?WISH_GOLD_COST*WISH10_MULT:WISH_GOLD_COST);
        if(led.gold<cost) return {ok:false,error:'Not enough gold.'};
        led.gold-=cost; if(free){ pool.goldFree++; pool.goldLast=now; } }
      else if(which==='gem'){ cur='gems';
        if((now-(me.created||0))<WISH_FIRST_GEM_DELAY_MS && !pool.gemFirstDone) return {ok:false,error:'The Diamond Pool opens 20 minutes after your account is created.'};
        free=(n===1)&&pool.gemFreeDay!==dk;
        rigged=!pool.gemFirstDone;
        cost=free?0:(n===10?WISH_GEM_COST*WISH10_MULT:WISH_GEM_COST);
        if(led.gems<cost) return {ok:false,error:'Not enough diamonds.'};
        led.gems-=cost; if(free) pool.gemFreeDay=dk; }
      else return {ok:false,error:'Unknown pool.'};
      const results=[];
      for(let i=0;i<n;i++){ const r=which==='gold'?poolRollGold(me):poolRollGem(me, rigged&&i===0); results.push(r); }
      if(which==='gem') pool.gemFirstDone=true;
      pool.history=pool.history||[]; pool.history.push({t:now,pool:which,n,cost,results:results.map(r=>r.type+(r.hero?':'+r.hero:''))});
      if(pool.history.length>60) pool.history=pool.history.slice(-60);
      ledTx(me,'pool:'+which+':x'+n,{[cur]:-cost});
      me.qc=me.qc||{}; me.qc.wish=(me.qc.wish|0)+n;   // counted once per roll that actually resolved
      writeDB(); return {ok:true, results, cost, free, ledger:ledgerView(me), pity:{at:WISH_GEM_PITY,count:pool.pity}};
    });
    return send(res, out.ok===false?400:200, out); }
  if(p==='/api/shop/buy' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':shop:'+reqId,()=>{
      const led=ensureLedger(me), sh=shopState(me); const what=String(b.what||'');
      if(what==='food'){ if(sh.food>=SHOP_FOOD_COSTS.length) return {ok:false,error:'No more meals today.'};
        const c=SHOP_FOOD_COSTS[sh.food]; if(led.gems<c) return {ok:false,error:'Not enough diamonds.'};
        led.gems-=c; sh.food++; ledStamRegen(led); led.stam.v=Math.min(999,led.stam.v+SHOP_FOOD_STAMINA);
        ledTx(me,'shop:food',{gems:-c,stamina:SHOP_FOOD_STAMINA});
        writeDB(); return {ok:true, stamina:led.stam.v, cost:c, ledger:ledgerView(me)}; }
      if(what==='gold'){ if(sh.gold>=SHOP_GOLD_COSTS.length) return {ok:false,error:'No more gold today.'};
        const c=SHOP_GOLD_COSTS[sh.gold]; if(led.gems<c) return {ok:false,error:'Not enough diamonds.'};
        const amt=1000+(ledPlayerLevel(led)-1)*100;
        led.gems-=c; sh.gold++; led.gold=Math.min(100000000,led.gold+amt);
        ledTx(me,'shop:gold',{gems:-c,gold:amt});
        writeDB(); return {ok:true, gold:amt, cost:c, ledger:ledgerView(me)}; }
      /* v274: equipment materials became ledger-owned, so the diamond bundle that used to be granted
         in the browser is granted here — one price, one write, one receipt. */
      if(what==='pieces'){ const c=450; if(led.gems<c) return {ok:false,error:'Not enough diamonds.'};
        led.gems-=c; led.eqMats=led.eqMats||{};
        const got={}; for(const k of EQ_MAT_KEYS){ led.eqMats[k]=Math.min(999999,(led.eqMats[k]|0)+100); got[k]=100; }
        ledTx(me,'shop:pieces',{gems:-c, mats:got});
        writeDB(); return {ok:true, mats:got, cost:c, ledger:ledgerView(me)}; }
      /* 31 Aug — the GUILD shop's copy of the same bundle. It is priced in guild coins, not
         diamonds, and the debit happens HERE so the coins and the materials move in one write:
         the client used to spend the coins via /api/tx/spend and then land on the branch above,
         paying 450 diamonds as well (or losing the coins outright when it had none). */
      if(what==='pieces_guild'){ const c=450; if((led.guildCoins|0)<c) return {ok:false,error:'Not enough guild coins.'};
        led.guildCoins=(led.guildCoins|0)-c; led.eqMats=led.eqMats||{};
        const got={}; for(const k of EQ_MAT_KEYS){ led.eqMats[k]=Math.min(999999,(led.eqMats[k]|0)+100); got[k]=100; }
        ledTx(me,'guildshop:pieces',{guildCoins:-c, mats:got});
        writeDB(); return {ok:true, mats:got, cost:c, ledger:ledgerView(me)}; }
      return {ok:false,error:'Unknown item.'};
    });
    return send(res, out.ok===false?400:200, out); }
  /* v267: Getting Started rewards are server-granted, once each, from the authored table above. */
  if(p==='/api/tutorial/claim' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const step=String(b.step||'').slice(0,16);
    const rw=TUTORIAL_REWARDS[step]; if(!rw) return send(res,400,{error:'Unknown step.'});
    const led=ensureLedger(me); led.tut=led.tut||{};
    if(led.tut[step]) return send(res,200,{ok:true, already:true, ledger:ledgerView(me)});
    led.tut[step]=Date.now();
    const out={gold:0,gems:0,stam:0,frag:null};
    if(rw.gold){ led.gold=Math.min(100000000,led.gold+rw.gold); out.gold=rw.gold; }
    if(rw.gems){ led.gems=Math.min(9999999,led.gems+rw.gems); out.gems=rw.gems; }
    if(rw.stam){ ledStamRegen(led); led.stam.v=Math.min(999,led.stam.v+rw.stam); out.stam=rw.stam; }
    if(rw.frag){ // a fixed, named starter hero — never a random pick made by the browser
      const hk='vex'; led.frags[hk]=Math.min(9999,(led.frags[hk]|0)+rw.frag); out.frag={heroKey:hk, qty:rw.frag}; }
    ledTx(me,'tutorial:'+step,{gold:out.gold,gems:out.gems,stamina:out.stam});
    writeDB(); return send(res,200,{ok:true, step, reward:out, ledger:ledgerView(me)}); }
  if(p==='/api/campaign/sweep' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':csweep:'+reqId,()=>{
      const led=ensureLedger(me); const mode=portalModeOf(b.mode); const prog=portalProg(led,mode);
      const lockMsg=portalLocked(led,mode); if(lockMsg) return {ok:false,error:lockMsg};
      const node=b.node|0; const st=portalStageOf(mode,node); if(!st) return {ok:false,error:'Unknown stage.'};
      if(node>prog.cleared) return {ok:false,error:'Clear the stage first.'};
      // 27 Aug (Phil): SWEEP IS EARNED — only a three-star clear unlocks instant sweeping.
      if((prog.stars[node]|0)<3) return {ok:false,error:'Three-star this stage first — sweep needs ★★★.', stars:(prog.stars[node]|0)};
      let times=Math.max(1,Math.min(10,b.times|0||1));
      const elite=(mode==='normal' && isEliteStageSrv(node)) || campIsBoss(node);   // guardian (3/6/9, normal portal — the stages that pay a hero fragment) & boss (10) stages: 3 rewarded runs/day, sweeps included. Was node%5===0, which capped 5/15/25 and never a guardian.
      prog.runs=prog.runs||{}; const dk=nyDayKey();
      if(prog.runs.k!==dk) prog.runs={k:dk};
      if(elite){ const used=prog.runs['n'+node]|0; const left=Math.max(0,3-used);
        if(left<1) return {ok:false,error:'Daily limit reached (3/day for guardian & boss stages).'};
        times=Math.min(times,left); }
      const cost=(campIsBoss(node)?STAM_COST_BOSS:STAM_COST_NORMAL)*times;
      ledStamRegen(led); if(led.stam.v<cost) return {ok:false,error:'Not enough stamina.'};
      led.stam.v-=cost;
      if(elite) prog.runs['n'+node]=(prog.runs['n'+node]|0)+times;
      const rw=st.rewards;
      const gold=rw.repeatGold*times, px=rw.playerXpRepeat*times, hxp=rw.heroXpRepeat*times;
      led.gold=Math.min(100000000,led.gold+gold);
      const beforeLvl=ledPlayerLevel(led); led.px=Math.min(99000000,led.px+px);
      if(ledPlayerLevel(led)>beforeLvl) led.stam.v=Math.max(led.stam.v,ledStamMax(led));   // level-up refill
      const team=(Array.isArray(b.heroIds)?b.heroIds.map(String).slice(0,5):[]).filter(k=>led.unlocked[k]);
      for(const k of team){ const h=led.hero[k]||(led.hero[k]={xp:0,stars:(SIM.HERO_BASE[k]||{}).stars||1,pips:0}); h.xp=Math.min(99000000,h.xp+hxp); }
      ledTx(me,mode+':sweep:'+st.id+':x'+times,{gold,px,heroXp:hxp,stamina:-cost});
      // Farm Map v1: a sweep grants the SAME named fragment the stage always drops, ×times.
      const glyphFragments=glyphGrantNamedList(me,(st.rewards.glyphFragments||[]).map(f=>({key:f.key,quantity:f.quantity*times})));
      // v250: guardian stages grant their hero's summon fragment ON THE SERVER (1/run)
      let eliteFrag=null;
      if(mode==='normal' && isEliteStageSrv(node)){ const hk=eliteHeroForSrv(node);
        led.frags[hk]=Math.min(9999,(led.frags[hk]|0)+times); eliteFrag={heroKey:hk, qty:times}; }
      writeDB(); return {ok:true, mode, times, gold, px, heroXp:hxp, glyphFragments, eliteFrag, ledger:ledgerView(me)};
    });
    return send(res, out.ok===false?400:200, out); }
  if(p==='/api/admin/led-grant' && req.method==='POST'){ if(!me||!isDev(me)) return send(res,403,{error:'forbidden'});
    const b=await body(req);
    const tgt=(b.userId&&DB.users[String(b.userId)])||me;   // v229: admin may grant to a named account (test fixtures, support)
    const led=ensureLedger(tgt);
    if(Array.isArray(b.unlock)) for(const k of b.unlock.map(String)){ if(SIM.HERO_BASE[k]){ led.unlocked[k]=true;
      if(!led.hero[k]) led.hero[k]={xp:0,stars:SIM.HERO_BASE[k].stars,pips:0}; } }
    if(b.stars&&Array.isArray(b.heroKeys)) for(const k of b.heroKeys.map(String)){ if(!SIM.HERO_BASE[k]) continue;
      const h=led.hero[k]||(led.hero[k]={xp:0,stars:SIM.HERO_BASE[k].stars,pips:0});
      h.stars=Math.max(SIM.HERO_BASE[k].stars,Math.min(5,b.stars|0)); }
    if(b.gold) led.gold=Math.min(100000000,led.gold+(b.gold|0));
    if(b.gems) led.gems=Math.min(2000000,led.gems+(b.gems|0));
    if(b.px) led.px=Math.min(99000000,led.px+(b.px|0));
    if(b.heroXp&&Array.isArray(b.heroKeys)) for(const k of b.heroKeys){ const h=led.hero[k]||(led.hero[k]={xp:0,stars:1,pips:0}); h.xp=Math.min(99000000,h.xp+(b.heroXp|0)); }
    if(b.stamina){ ledStamRegen(led); led.stam.v=Math.min(999,led.stam.v+(b.stamina|0)); }
    if(b.campCleared!=null) led.camp.cleared=Math.max(0,Math.min(CAMPAIGN_NODES,b.campCleared|0));   // dev-only fixture
    if(b.campStars&&typeof b.campStars==='object') for(const k in b.campStars){ const v=b.campStars[k]|0; if(v>=1&&v<=3) led.camp.stars[k]=v; }   // dev-only fixture
    /* v339 (Phil): the dev "Max glyph+star" button never touched glyphs — there was no endpoint for it.
       maxGlyphs:true walks every named hero's board from its current ascension to Orange, feeding each
       tier's six pre-chosen glyphs exactly as /api/glyphs/ascend would (stats accumulate into
       board.ascended), skipping the fragment cost and the hero-level gate. Dev-only. */
    let glyphsMaxed=0;
    if(b.maxGlyphs&&Array.isArray(b.heroKeys)){ const gg=(glyphMigrate(tgt),glyphFlowMigrate(tgt),ensureGlyphs(tgt));
      for(const k of b.heroKeys.map(String)){ if(!SIM.HERO_BASE[k]) continue; led.unlocked[k]=led.unlocked[k]||true;
        const board=glyphBoard(gg,k); if(board.ascensionIndex>=GLYPH_MAX_ASC) continue;
        for(const sid of board.slots){ const inst=sid&&gg.finished[sid]; if(inst){ inst.status='consumed'; inst.consumedAt=Date.now(); } }
        while(board.ascensionIndex<GLYPH_MAX_ASC){ const qi=board.ascensionIndex;
          for(let i=0;i<6;i++){ const def=glyphPreChoice(k,i,qi); if(!def) continue;
            for(const st of def.stats){ const cur=board.ascended[st.stat]||{val:0,pct:st.pct}; cur.val=+(cur.val+st.val).toFixed(2); cur.pct=st.pct; board.ascended[st.stat]=cur; } }
          board.slots=[null,null,null,null,null,null]; board.ascensionIndex++; }
        glyphAudit(gg,'ascend',{hero:k,to:board.ascensionIndex,fed:'dev-max'}); glyphsMaxed++; }
      glyphPruneConsumed(gg); gg.revision++; }
    ledTx(tgt,'admin:grant',{});
    writeDB(); return send(res,200,{ok:true, ledger:ledgerView(tgt), glyphsMaxed}); }

  /* 28 Aug — skill upgrades are server-owned. They used to be a local write that the next ledger
     sync overwrote, so the gold was spent and the level came back. The server now holds led.skill,
     charges the same curve the client shows, and returns the ledger. */
  if(p==='/api/skill/upgrade' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':skillup:'+reqId,()=>{
      const led=ensureLedger(me);
      const key=String(b.key||''); const idx=b.idx|0;
      if(!SIM.HERO_BASE[key]) return {ok:false,error:'Unknown hero.'};
      if(idx<0||idx>3) return {ok:false,error:'Unknown skill.'};
      if(!led.unlocked[key]) return {ok:false,error:'You have not unlocked that hero.'};
      const arr=ledSkillArr(led,key); const lv=Math.max(1,arr[idx]|0);
      if(lv>=SKILL_MAX_SRV) return {ok:false,error:'That skill is already at max.'};
      const cost=Math.round((SKILL_UP_BASE_SRV[idx]||300)*Math.pow(1.55,lv-1));
      if((led.gold|0)<cost) return {ok:false,error:'Not enough gold.'};
      led.gold-=cost; arr[idx]=lv+1; led.rev++;
      ledTx(me,'skillup:'+key+':'+idx,{gold:-cost});
      writeDB();
      return {ok:true, level:arr[idx], cost, ledger:ledgerView(me)};
    });
    return send(res, out&&out.ok?200:400, out); }
  /* 30 Aug — EQUIPMENT CRAFTING SPENT NOTHING. A Grey craft decremented G.eqMats in the BROWSER only,
     but eqMats is ledger-owned: adoptLedger (boot + the 45s ledgerSync) handed the materials straight
     back while the crafted piece stayed in the local inventory, so anyone could mint unlimited Tier-0
     pieces and combine them upward into top-tier gear. The material spend is a server transaction now.
     Higher tiers consume already-crafted pieces, so bounding Tier-0 bounds the whole tree. */
  if(p==='/api/eq/craft' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':eqcraft:'+reqId,()=>{
      const led=ensureLedger(me);
      const grp=String(b.group||''); const slot=b.slot|0;
      const base=EQ_SLOT_BASE_SRV[grp];
      if(!base) return {ok:false,error:'Unknown equipment group.'};
      if(slot<0||slot>=base.length) return {ok:false,error:'Unknown slot.'};
      const mk=EQ_MAT_KEYS[base[slot]];
      if(!mk) return {ok:false,error:'Unknown material.'};
      led.eqMats=led.eqMats||{};
      if((led.eqMats[mk]|0)<EQ_CRAFT_MAT_COST) return {ok:false,error:'Not enough materials.'};
      led.eqMats[mk]=(led.eqMats[mk]|0)-EQ_CRAFT_MAT_COST; led.rev++;
      ledTx(me,'eqcraft:'+grp+':'+slot,{});
      writeDB();
      return {ok:true, spent:{key:mk, n:EQ_CRAFT_MAT_COST}, ledger:ledgerView(me)};
    });
    return send(res, out&&out.ok?200:400, out); }
  if(p==='/api/ledger'){ if(!me)return send(res,401,{error:'auth'});
    const v=ledgerView(me); writeDB(); return send(res,200,v); }
  if(p==='/api/tx/spend' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':spend:'+reqId,()=>{
      const led=ensureLedger(me); const what=String(b.what||''); const amt=Math.floor(+b.amount||0);
      if(!(amt>0&&amt<=10000000)) return {ok:false,error:'Bad amount.'};
      if(what==='gold'){ if(led.gold<amt) return {ok:false,error:'Not enough gold.'}; led.gold-=amt; }
      else if(what==='gems'){ if(led.gems<amt) return {ok:false,error:'Not enough diamonds.'}; led.gems-=amt; }
      else if(what==='stamina'){ ledStamRegen(led); if(led.stam.v<amt) return {ok:false,error:'Not enough stamina.'}; led.stam.v-=amt; }
      /* 30 Aug — guildCoins live on the ledger (and are stripped from the save) but spend never
         accepted them, so every guild-shop purchase was refunded by the next sync: unlimited
         shields, unlimited gold caches. The v274 note at the guild-raid reward even said the shop
         still had to be moved onto the ledger; this is that. */
      else if(what==='guildCoins'){ if((led.guildCoins|0)<amt) return {ok:false,error:'Not enough guild coins.'}; led.guildCoins=(led.guildCoins|0)-amt; }
      else return {ok:false,error:'Unknown currency.'};
      const tx=ledTx(me,'spend:'+String(b.reason||'unspecified').slice(0,40),{[what]:-amt});
      writeDB(); return {ok:true, tx, ledger:ledgerView(me)};
    });
    return send(res, out.ok===false?400:200, out); }
  if(p==='/api/tx/earn' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    // capped earn table for LEGACY client-resolved loops only. Every grant is logged with a source tx.
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':earn:'+reqId,()=>{
      const led=ensureLedger(me); const what=String(b.what||''); const reason=String(b.reason||'misc').slice(0,24);
      const amt=Math.floor(+b.amount||0);
      const rules=(EARN_RULES[what]||{})[reason]; if(!rules) return {ok:false,error:'No earn rule for '+what+'/'+reason+'.'};
      if(!(amt>0&&amt<=rules.max)) return {ok:false,error:'Amount exceeds the '+reason+' rule.'};
      led.earnDay=led.earnDay||{}; const dk=nyDayKey();
      if(led.earnDay.k!==dk){ led.earnDay={k:dk}; }
      const used=(led.earnDay[what+':'+reason]|0);
      if(used+amt>rules.day) return {ok:false,error:'Daily '+reason+' cap reached.'};
      led.earnDay[what+':'+reason]=used+amt;
      if(what==='gold') led.gold=Math.min(100000000,led.gold+amt);
      else if(what==='guildCoins') led.guildCoins=Math.min(ECON_CAP.guildCoins,(led.guildCoins|0)+amt);
      else if(what==='gems'){ gemGain(me,amt,reason); led.gems=Math.min(2000000,led.gems+amt); }
      else if(what==='stamina'){ ledStamRegen(led); led.stam.v=Math.min(999,led.stam.v+amt); }
      else if(what==='px'){ const before=ledPlayerLevel(led); led.px=Math.min(99000000,led.px+amt);
        if(ledPlayerLevel(led)>before){ ledStamRegen(led); led.stam.v=Math.max(led.stam.v,ledStamMax(led)); } }
      else if(what==='heroXp'){ const keys=(Array.isArray(b.heroKeys)?b.heroKeys.map(String).slice(0,10):[]);
        for(const k of keys){ if(!led.unlocked[k]) continue; const h=led.hero[k]||(led.hero[k]={xp:0,stars:(SIM.HERO_BASE[k]||{}).stars||1,pips:0}); h.xp=Math.min(99000000,h.xp+amt); } }
      else if(what==='frag'){ const k=String(b.heroKey||''); if(!validHero(k)) return {ok:false,error:'Unknown hero.'};
        led.frags[k]=Math.min(9999,(led.frags[k]|0)+amt); }
      else return {ok:false,error:'Unknown earn currency.'};
      const tx=ledTx(me,'earn:'+reason,{[what]:amt});
      writeDB(); return {ok:true, tx, ledger:ledgerView(me)};
    });
    return send(res, out.ok===false?400:200, out); }
  if(p==='/api/campaign/stage'){ if(!me)return send(res,401,{error:'auth'});
    const mode=portalModeOf(url.searchParams.get('mode'));
    const node=parseInt(url.searchParams.get('node')||'0',10); const st=portalStageOf(mode,node);
    if(!st) return send(res,400,{error:'Unknown stage.'});
    /* v257: "your power" is computed HERE, from the server's own resolved snapshots, on exactly the
       same scale as the authored recommendedPower — so the two numbers the player compares can never
       disagree with each other or with the fight. */
    let yourPower=0, squad=[];
    try{
      const led=ensureLedger(me);
      const picked=rosterKeys(me.team).filter(k=>led.unlocked[k]).slice(0,5);
      squad=picked.length?picked:Object.keys(led.unlocked).filter(k=>led.unlocked[k]).slice(0,5);
      const snaps=squad.map(k=>snapshotHeroFromServer(me,k)).filter(Boolean);
      yourPower=Math.round(snaps.reduce((a,u)=>a+(u.maxHp||0)/8+Math.max(u.atkP||0,u.atkM||0)*3+(u.heal||0)*2,0));
    }catch(e){}
    const _led=ensureLedger(me), _pr=portalProg(_led,mode);
    return send(res,200,{stage:st, mode, portal:PORTAL_LABEL[mode], yourPower, squad, ladderMinLevel:GLYPH_MIN_LEVEL,
      bossLevelGate:campBossLevelGate(node), playerLevel:ledPlayerLevel(_led),
      locked:portalLocked(_led,mode), cleared:_pr.cleared|0,
      stars:(_pr.stars[node]|0), sweepUnlocked:(_pr.stars[node]|0)>=3,
      farm:(st.rewards.glyphFragments[0]||null) }); }
  /* v266: the whole farm map in one call — every portal's stage list with its ONE named fragment,
     plus the reverse index the Glyph tree deep-links from. */
  if(p==='/api/portals'){ if(!me)return send(res,401,{error:'auth'});
    const led=ensureLedger(me);
    return send(res,200,{ modes:PORTAL_MODES.map(m=>{ const pr=portalProg(led,m);
        return { mode:m, label:PORTAL_LABEL[m], stages:PORTAL_SIZE[m], locked:portalLocked(led,m),
          cleared:pr.cleared|0, stars:pr.stars,
          map:PORTALS[m].list.map(e=>({ node:e.node, id:e.id, fragment:e.rewards.glyphFragments[0] })) }; }),
      fragmentSources:FRAG_SOURCES }); }
  if(p==='/api/campaign/start' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    if(!CAMP_ENC) return send(res,400,{error:'Campaign encounters unavailable.'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48);
    const led=ensureLedger(me);
    const mode=portalModeOf(b.mode); const prog=portalProg(led,mode);
    const lockMsg=portalLocked(led,mode); if(lockMsg) return send(res,400,{error:lockMsg});
    const node=b.node|0; const st=portalStageOf(mode,node);
    if(!st) return send(res,400,{error:'Unknown stage.'});
    if(node>prog.cleared+1) return send(res,400,{error:'Stage locked — clear the previous stage first.'});
    /* Daily run cap (elite 3/6/9 & boss 10): refuse up front so stamina is not spent on a run the
       resolve route will not pay. An open, still-valid session for this node is left alone so a
       reconnect can resume the fight it already paid for. */
    if((isEliteStageSrv(node)||campIsBoss(node)) && node<=prog.cleared && !(prog.att && prog.att.node===node && (Date.now()-(prog.att.startedAt||0) <= CAMP_SESSION_MS))){
      const _r=prog.runs; if(_r && _r.k===nyDayKey() && (_r['n'+node]|0)>=3 && !isDev(me)) return send(res,400,{error:'Daily limit reached (3/day for guardian & boss stages).'}); }   // v343: dev accounts exempt (Phil testing 1-5)
    { const gate=campBossLevelGate(node), pl=ledPlayerLevel(led);
      if(gate && pl<gate) return send(res,400,{error:'Chapter boss — reach player level '+gate+' first (you are '+pl+').', bossLevelGate:gate, playerLevel:pl}); }
    const ids=Array.isArray(b.heroIds)?b.heroIds.map(String).slice(0,5):[];
    if(!ids.length||new Set(ids).size!==ids.length) return send(res,400,{error:'Pick your squad (no duplicates).'});
    for(const k of ids){ if(!led.unlocked[k]) return send(res,400,{error:'You have not unlocked '+k+'.'}); }
    ledStamRegen(led); const cost=campIsBoss(node)?STAM_COST_BOSS:STAM_COST_NORMAL;
    /* v273 (audit response §4.5) — RECONNECT RESUMES, IT DOES NOT RE-CHARGE.
       Closing the app mid-battle used to abandon the frozen session and take the stamina again on the
       next attempt. Now: the same stage returns the SAME session (same seed, same snapshots — no
       reroll); a different stage refunds the abandoned one first. */
    { const open=prog.att;
      /* 28 Aug — RESUMING MUST NOT OVERRIDE A DELIBERATE SQUAD CHANGE.
         The resume path returned the open session's ORIGINAL frozen snapshot whenever the stage
         matched, without looking at who the player had just picked. So changing your squad and
         pressing BATTLE on the same stage silently gave you the previous line-up — the client sent
         the right heroes and the server handed back the old ones. That is the other half of "it just
         chooses an old line up pick", and it survived the client-side fix. A reconnect (same stage,
         same squad) still resumes free; a genuinely different squad refunds the abandoned attempt
         and starts a fresh one. */
      const sameSquad = open && Array.isArray(open.heroIds) && open.heroIds.length===ids.length
        && open.heroIds.every((k,i)=>k===ids[i]);
      if(open && !sameSquad && (Date.now()-(open.startedAt||0) <= CAMP_SESSION_MS) && open.node===node){
        led.stam.v=Math.min(999, led.stam.v+(open.stamPaid|0));   // refund: never below what they already hold
        ledTx(me,mode+':resquad:'+(open.node|0),{stamina:(open.stamPaid|0)});
        prog.att=null;
      }
      if(prog.att && (Date.now()-(prog.att.startedAt||0) <= CAMP_SESSION_MS)){
        const open=prog.att;
        if(open.node===node){
          const st0=portalStageOf(mode,node);
          /* A resumed session plays a NEW fight on the same attempt — the interrupted fight's action
             transcript and clock must not survive to be replayed as this result. */
          open.stream=null; open.clock=null;
          writeDB();
          return send(res,200,{ ok:true, resumed:true, attemptId:open.id, mode, stage:st0, seed:open.seed,
            snaps:open.snaps, engine:open.engine, stamina:{v:led.stam.v,max:ledStamMax(led)} });
        }
        led.stam.v=Math.min(999, led.stam.v+(open.stamPaid|0));   // refund: never below what they already hold
        ledTx(me,mode+':abandoned:'+(open.node|0),{stamina:(open.stamPaid|0)});
        prog.att=null;
      } else if(prog.att){ const open=prog.att;
        led.stam.v=Math.min(999, led.stam.v+(open.stamPaid|0));   // refund: never below what they already hold
        ledTx(me,mode+':expired:'+(open.node|0),{stamina:(open.stamPaid|0)});
        prog.att=null;
      } }
    if(led.stam.v<cost) return send(res,400,{error:'Not enough stamina.'});
    led.stam.v-=cost;
    const snaps=ids.map(k=>snapshotHeroFromServer(me,k)); if(snaps.some(x=>!x)) return send(res,400,{error:'Unknown hero.'});
    /* v270 (PLAYER-TRUTH) — FREEZE THE SESSION. The server resolves every hero into a full combat
       snapshot with the client's own unit builder, and issues the seed. The browser is handed those
       numbers to fight with; it cannot pick its own stats, its own enemies or its own dice. */
    const specs=ids.map(k=>campaignHeroSpec(me,k)); if(specs.some(x=>!x)) return send(res,400,{error:'Unknown hero.'});
    const host=simHost();
    let fightSnaps=null;
    if(host){ try{ fightSnaps=host.snapFromSpecs(specs); }catch(e){ console.error('sim-host snapFromSpecs failed:',e.message); } }
    const seed=(crypto.randomBytes(4).readUInt32BE(0))>>>0;
    prog.att={ id:uid(), node, mode, heroIds:ids, teamSnapshot:snaps, specs, snaps:fightSnaps, seed,
      engine:(host&&host.buildVersion)||null, startedAt:Date.now(), reqId, stamPaid:cost };
    ledTx(me,mode+':start:'+st.id,{stamina:-cost});
    writeDB();
    return send(res,200,{ ok:true, attemptId:prog.att.id, mode, stage:st, seed, snaps:fightSnaps,
      engine:prog.att.engine, stamina:{v:led.stam.v,max:ledStamMax(led)} }); }
  if(p==='/api/campaign/resolve' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':cresolve:'+reqId,()=>{
      const led=ensureLedger(me);
      const aid=String(b.attemptId||'');
      let mode=null, prog=null, a=null;
      for(const m of PORTAL_MODES){ const pr=portalProg(led,m); if(pr.att && pr.att.id===aid){ mode=m; prog=pr; a=pr.att; break; } }
      if(!a) return {ok:false,error:'No matching campaign battle.'};
      /* v273 (audit response §4.5): a session has a life. A battle left open longer than this was not
         played to the end — the stamina goes back and the attempt is closed, rather than being
         resolvable hours later or silently consumed. */
      if(Date.now()-(a.startedAt||0) > CAMP_SESSION_MS){
        prog.att=null;
        led.stam.v=Math.min(999, led.stam.v+(a.stamPaid|0));   // refund: never below what they already hold
        ledTx(me,mode+':expired:'+(a.node|0),{stamina:(a.stamPaid|0)});
        writeDB();
        return {ok:false, expired:true, error:'That battle expired — your stamina was returned. Start the stage again.', ledger:ledgerView(me)};
      }
      prog.att=null;
      const st=portalStageOf(mode,a.node); if(!st) return {ok:false,error:'Stage data missing.'};
      /* v270 (PLAYER-TRUTH) — THE RESULT IS THE PLAYER'S OWN FIGHT.
         The server replays the frozen session (its snapshots, its seed, the authored waves) driven by
         the transcript of what the player actually did — every ultimate and gear skill, on the tick it
         was cast. No estimate, no auto-battle, no skill allowance: CAMPAIGN_SKILL_BAND is gone from
         this path. An illegal action in the transcript simply does not happen (see applyInput). */
      /* v274 (§3) — THE SERVER'S OWN RECEIPTS ARE THE TRANSCRIPT.
         If the session streamed its actions live, the body's transcript is not read at all: the fight
         is replayed from what the server accepted, action by action, as it arrived. A client that
         streamed nothing still resolves from its submitted log (offline-ish path), and the response
         says which of the two happened so it is never ambiguous in a report. */
      let streamed=(a.stream && Array.isArray(a.stream.acts) && a.stream.acts.length>0);
      if(a.stream) a.stream.closed=true;
      let inputLog = streamed ? a.stream.acts.slice(0, INPUT_LOG_MAX) : sanitizeInputLog(b.inputLog);
      let transcriptSource = streamed ? 'streamed-receipts'
        : ((a.stream&&a.stream.broken) ? 'submitted-log-after-stream-loss' : 'submitted-log');
      /* v334 (Phil: "I just won 1-1 and it said defeat — it happened when I tabbed out then back in").
         A phone in the background drops the socket. The client's give-up frame ('abandon') dies with
         it, so the server keeps a PARTIAL list of receipts — everything the player did before the
         drop and nothing after — and that half-transcript out-ranked the player's complete log at
         resolve: the replay was a different fight, the digest missed, and a won stage came back
         "unverified". The complete log is trusted ONLY when it extends the server's own receipts
         exactly — every accepted action, in order, on the tick the server stamped it — so a client
         cannot rewrite what the server already saw; it can only append what the server never got.
         (A client that never streamed at all was always resolved from its log; this is no wider.) */
      if(streamed){ const sub=sanitizeInputLog(b.inputLog); const acts=a.stream.acts;
        const same=(x,y)=>x&&y&&(x[0]|0)===(y[0]|0)&&String(x[1])===String(y[1])&&(x[2]|0)===(y[2]|0)&&(x[3]|0)===(y[3]|0);
        if(process.env.DEBUG_RESOLVE) console.log('RESOLVE acts',JSON.stringify(acts),'sub',JSON.stringify(sub));
        if(sub.length>acts.length && acts.every((x,i)=>same(x,sub[i]))){
          inputLog=sub.slice(0, INPUT_LOG_MAX); transcriptSource='submitted-log-extends-receipts'; a.stream.extended=sub.length-acts.length; } }
      const host=simHost();
      if(!host || !Array.isArray(a.snaps) || !a.snaps.length){
        /* We could not verify the fight — so we record NOTHING. Not a win, not a loss. The stamina
           goes back and the incident is kept. A defect is never dressed up as a result. */
        led.stam.v=Math.min(999, led.stam.v+(a.stamPaid|0));   // refund: never below what they already hold
        ledTx(me,mode+':unverified:'+st.id,{stamina:(a.stamPaid|0)});
        writeDB();
        return {ok:false, unverified:true, error:'This battle could not be verified — your stamina was returned.'};
      }
      let rep=null;
      try{ rep=host.campaign(a.snaps, st.waves, a.seed>>>0, inputLog); }
      catch(e){ console.error('sim-host replay failed:',e.message);
        led.stam.v=Math.min(999, led.stam.v+(a.stamPaid|0));   // refund: never below what they already hold
        ledTx(me,mode+':unverified:'+st.id,{stamina:(a.stamPaid|0)});
        writeDB();
        return {ok:false, unverified:true, error:'This battle could not be verified — your stamina was returned.'}; }
      /* v273 (audit response §4.4) — A MISMATCH IS AN INCIDENT, NOT A RESULT.
         The end state the player watched must equal the end state the replay reached. If it does not
         — or if the client submitted no end state at all — nothing is recorded: no win, no loss, no
         reward. The stamina goes back and the transcript is kept so the divergence can be fixed.
         This check runs BEFORE anything is granted; it used to only print a warning afterwards. */
      const serverEndDigest=String(rep.digest||'');
      const clientEnd=(typeof b.digest==='string')?b.digest:'';
      const digestMatch = clientEnd ? (sha256hex(clientEnd)===sha256hex(serverEndDigest)) : null;
      if(digestMatch!==true){
        led.stam.v=Math.min(999, led.stam.v+(a.stamPaid|0));   // refund: never below what they already hold
        const why=(digestMatch===null)?'no-client-digest':'digest-mismatch';
        led.battleIncidents=(led.battleIncidents||[]).concat([{ t:Date.now(), stage:st.id, mode, why,
          source:transcriptSource,
          engine:a.engine||null, seed:a.seed>>>0, inputs:inputLog.length,
          server:sha256hex(serverEndDigest), client:clientEnd?sha256hex(clientEnd):null,
          transcript:inputLog }]).slice(-20);
        ledTx(me,mode+':unverified:'+st.id,{stamina:(a.stamPaid|0)});
        writeDB();
        console.warn('⚠️  battle unverified ('+why+') — stage '+st.id+', engine '+(a.engine||'?'));
        return {ok:false, unverified:true, reason:why,
          error:'This battle could not be verified against the server — nothing was recorded and your stamina was returned.',
          ledger:ledgerView(me)};
      }
      const won=!!rep.won;
      let stars=0, reward=null;
      if(won){
        stars=Math.max(1,Math.min(3,rep.stars|0));
        const first=a.node>prog.cleared;
        /* DAILY RUN CAP — the SAME 3-rewarded-runs/day budget /api/campaign/sweep enforces for guardian
           & boss stages (node%5===0), on the SAME prog.runs counter, so manual runs and sweeps share
           one budget. A first clear always pays and never spends the budget. A capped repeat win still
           records stars / cleared / the receipt, but pays nothing and says so (reward.dailyCapped). */
        const capStage=(isEliteStageSrv(a.node)||campIsBoss(a.node));   // v343 (Phil): the capped stages are 3/6/9/10 — node%5 was wrongly capping x-5 and missing 3/6/9
        let rewarded=true;
        if(capStage && !first){
          prog.runs=prog.runs||{}; const _rdk=nyDayKey(); if(prog.runs.k!==_rdk) prog.runs={k:_rdk};
          const _rused=prog.runs['n'+a.node]|0;
          if(_rused>=3) rewarded=false; else prog.runs['n'+a.node]=_rused+1;
        }
        const rw=st.rewards;
        reward={ gold:rewarded?(first?rw.firstGold:rw.repeatGold):0, playerXp:rewarded?(first?rw.playerXpFirst:rw.playerXpRepeat):0,
                 heroXp:rewarded?(first?rw.heroXpFirst:rw.heroXpRepeat):0, first, dailyCapped:!rewarded, runCounted:(capStage&&!first&&rewarded) };
        led.gold=Math.min(100000000,led.gold+reward.gold);
        led.px=Math.min(99000000,led.px+reward.playerXp);
        for(const k of a.heroIds){ const h=led.hero[k]||(led.hero[k]={xp:0,stars:SIM.HERO_BASE[k]?SIM.HERO_BASE[k].stars:1,pips:0}); h.xp=Math.min(99000000,h.xp+reward.heroXp); }
        if(first) prog.cleared=a.node;
        if(stars>(prog.stars[a.node]|0)) prog.stars[a.node]=stars;
        ledTx(me,mode+':clear:'+st.id+(first?':first':''),{gold:reward.gold,px:reward.playerXp,heroXp:reward.heroXp});
        // Correction Spec v1: the stage's EXACT named Glyph Fragment target, granted server-side
        reward.glyphFragments=rewarded?glyphGrantNamedList(me,(st.rewards.glyphFragments||[]).map(f=>({key:f.key,quantity:f.quantity}))):[];
        /* GUARDIAN STAGES PAY THEIR FRAGMENT ON THIS ROUTE TOO. The DROPS panel promises x2-4 hero
           fragments on a normal-portal elite stage, and the sweep route + /api/elite/resolve both
           grant them — but manual play resolved HERE granted none, so a signed-in player got nothing,
           first clear included (and a first clear can never be swept: sweep needs three stars).
           Capped on the SAME 3-rewarded-runs-per-day budget the sweep route enforces, so this is not
           a new uncapped farm; the amount is what every other path already pays. */
        if(mode==='normal' && isEliteStageSrv(a.node)){
          prog.runs=prog.runs||{}; const _dk=nyDayKey(); if(prog.runs.k!==_dk) prog.runs={k:_dk};
          const _used=prog.runs['n'+a.node]|0;
          if(_used<3){
            const _hk=eliteHeroForSrv(a.node);
            const _amt=first?(2+(srvSeed('efrag', me.id, a.node, reqId)%3)):1;   // first clear: the advertised 2-4 roll; farm runs: +1, same as a sweep run
            prog.runs['n'+a.node]=_used+1;
            led.frags=led.frags||{};
            led.frags[_hk]=Math.min(9999,(led.frags[_hk]|0)+_amt);
            reward.eliteFrag={heroKey:_hk, qty:_amt};
            ledTx(me,mode+':elitefrag:'+a.node,{frag:_amt,hero:_hk});
          }
        }
      } else ledTx(me,mode+':loss:'+st.id,{});
      /* The receipt: what was frozen, what the player did, and what the replay produced. Enough to
         re-run this exact battle later and prove the result — kept small and capped. */
      const receipt={ t:Date.now(), stage:st.id, mode, node:a.node, seed:a.seed>>>0, engine:a.engine||null,
        source:transcriptSource, chain:(a.stream&&a.stream.chain)||null,
        heroes:a.heroIds.slice(), inputs:inputLog.length, won, stars,
        digest:sha256hex(String(rep.digest||'')), transcript:inputLog,
        clientDigest:(typeof b.digest==='string'?sha256hex(b.digest):null) };
      led.battleReceipts=(led.battleReceipts||[]).concat([receipt]).slice(-40);
      writeDB();
      receipt.match=true;   // a result only exists here because the two end states matched exactly
      return { ok:true, mode, won, stars, reward, verified:true, engine:a.engine||null,
        serverDigest:receipt.digest, digestMatch:true, transcript:transcriptSource,
        actions:inputLog.length, chain:(a.stream&&a.stream.chain)?a.stream.chain.slice(0,16):null,
        replaySeed:a.seed>>>0, ledger:ledgerView(me) };
    });
    return send(res, out.ok===false?400:200, out); }
  /* ---- hero progression endpoints: EXACT mirrors of the game's published rules ---- */
  if(p==='/api/hero/star-step' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':starstep:'+reqId,()=>{
      const led=ensureLedger(me); const k=String(b.heroKey||''); if(!validHero(k)) return {ok:false,error:'Unknown hero.'}; const base=SIM.HERO_BASE[k];
      if(!led.unlocked[k]) return {ok:false,error:'Hero not unlocked.'};
      const h=led.hero[k]||(led.hero[k]={xp:0,stars:base.stars,pips:0});
      const STAR_COST={1:{pip:3,confirm:5},2:{pip:6,confirm:20},3:{pip:14,confirm:30},4:{pip:20,confirm:50}};
      if(h.stars>=5) return {ok:false,error:'Already 5★ — use Refine.'};
      const c=STAR_COST[h.stars]; const cost=(h.pips>=5)?c.confirm:c.pip;
      if((led.frags[k]|0)<cost) return {ok:false,error:'Need '+cost+' fragments.'};
      led.frags[k]-=cost;
      if(h.pips>=5){ h.pips=0; h.stars++; } else h.pips++;
      ledTx(me,'hero:starstep:'+k,{frags:-cost});
      writeDB(); return {ok:true, hero:h, frags:led.frags[k]|0, ledger:ledgerView(me)};
    });
    return send(res, out.ok===false?400:200, out); }
  if(p==='/api/hero/refine' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':refine:'+reqId,()=>{
      const led=ensureLedger(me); const k=String(b.heroKey||''); if(!validHero(k)) return {ok:false,error:'Unknown hero.'}; const base=SIM.HERO_BASE[k];
      const h=led.hero[k]; if(!h||h.stars<5) return {ok:false,error:'Refine opens at 5★.'};
      const lvl=Math.max(0,Math.min(15,h.ref|0));
      if(lvl>=15) return {ok:false,error:'Fully refined.'};
      const tier=lvl>=10?{cost:100,chance:0.10}:lvl>=5?{cost:70,chance:0.20}:{cost:50,chance:0.30};
      if((led.frags[k]|0)<tier.cost) return {ok:false,error:'Need '+tier.cost+' fragments.'};
      led.frags[k]-=tier.cost;
      const success=Math.random()<tier.chance;   // SERVER roll — persisted with the idempotency record
      if(success) h.ref=lvl+1;
      ledTx(me,'hero:refine:'+k+(success?':up':':miss'),{frags:-tier.cost});
      writeDB(); return {ok:true, success, level:h.ref|0, frags:led.frags[k]|0, ledger:ledgerView(me)};
    });
    return send(res, out.ok===false?400:200, out); }
  if(p==='/api/hero/summon' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    const out=idem(me.id+':summon:'+reqId,()=>{
      const led=ensureLedger(me); const k=String(b.heroKey||''); if(!validHero(k)) return {ok:false,error:'Unknown hero.'}; const base=SIM.HERO_BASE[k];
      if(led.unlocked[k]) return {ok:false,error:'Already summoned.'};
      const ss=POOL_START_STARS[k]||base.stars||1;
      const SUMMON_COST_T={1:10,2:30,3:80};
      const need=SUMMON_COST_T[ss]||10;
      if((led.frags[k]|0)<need) return {ok:false,error:'Need '+need+' fragments to summon.'};
      led.frags[k]-=need; led.unlocked[k]=true;
      if(!led.hero[k]) led.hero[k]={xp:0,stars:base.stars,pips:0};
      ledTx(me,'hero:summon:'+k,{frags:-need});
      writeDB(); return {ok:true, ledger:ledgerView(me)};
    });
    return send(res, out.ok===false?400:200, out); }
  /* =================== v250 (audit P1): PER-LOOP SERVER AUTHORITIES ===================
     Elite stages, Tower/Gauntlet/legacy-dungeon trials, quests, market fragment offers, and the
     arena daily are each their own server-verified transaction. Generic /api/tx/earn no longer
     accepts these reasons. */
  if(p==='/api/elite/resolve'||p==='/api/trial/resolve'||p==='/api/quest/state'||p==='/api/quest/claim'||p==='/api/quest/chain-claim'||p==='/api/market/frag'||p==='/api/arena/daily-claim'){
    if(!me) return send(res,401,{error:'auth'});
    const led=ensureLedger(me);
    if(p==='/api/quest/state'){ led.quests=led.quests||{claimed:{},chainStep:0};
      const state={ chainStep:led.quests.chainStep|0, claimed:led.quests.claimed,
        ready:Object.fromEntries(Object.entries(QUEST_DEFS_SRV).map(([id,q])=>[id,!!q.cond(me,led)])) };
      return send(res,200,state); }
    if(req.method!=='POST') return send(res,404,{error:'loop'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    if(p==='/api/elite/resolve'){ const out=idem(me.id+':elite:'+reqId,()=>{
        const node=b.node|0; if(!isEliteStageSrv(node)) return {ok:false,error:'Not an elite stage.'};
        if(node>led.camp.cleared) return {ok:false,error:'Clear the stage first.'};
        const dk=nyDayKey(); led.eliteDay=led.eliteDay&&led.eliteDay.k===dk?led.eliteDay:{k:dk};
        if((led.eliteDay[node]|0)>=3) return {ok:false,error:'Elite rewards are limited to 3 per day.'};
        const ids=Array.isArray(b.heroIds)?b.heroIds.map(String).slice(0,5):[];
        for(const k of ids){ if(!led.unlocked[k]) return {ok:false,error:'not unlocked: '+k}; }
        const st=campStageOf(node); if(!st) return {ok:false,error:'Stage data missing.'};
        const snaps=ids.map(k=>snapshotHeroFromServer(me,k)).filter(Boolean);
        if(!snaps.length) return {ok:false,error:'Pick your squad.'};
        const band=x=>Object.assign({},x,{maxHp:Math.round(x.maxHp*CAMPAIGN_SKILL_BAND),atk:Math.round(x.atk*CAMPAIGN_SKILL_BAND),heal:Math.round((x.heal||0)*CAMPAIGN_SKILL_BAND),atkP:Math.round((x.atkP||0)*CAMPAIGN_SKILL_BAND),atkM:Math.round((x.atkM||0)*CAMPAIGN_SKILL_BAND)});
        const waves=st.waves.map(w=>w.map(m=>{ const u=vaultSpecToCombatUnit(m); u.maxHp=Math.round(u.maxHp*1.2); u.atkP=Math.round(u.atkP*1.15); u.atk=u.atkP; return u; }));
        const r=SIM.qualificationEstimate(snaps.map(band), waves, srvSeed('elite', me.id, node, reqId));
        if(!r.result.won) return {ok:true, won:false};
        led.eliteDay[node]=(led.eliteDay[node]|0)+1;
        const hk=eliteHeroForSrv(node);
        const frags=2+(srvSeed('efrag', me.id, node, reqId)%3);
        led.frags[hk]=Math.min(9999,(led.frags[hk]|0)+frags);
        for(const k of ids){ const h=led.hero[k]||(led.hero[k]={xp:0,stars:(SIM.HERO_BASE[k]||{}).stars||1,pips:0}); h.xp=Math.min(99000000,h.xp+70); }
        ledTx(me,'elite:'+node,{frag:frags,hero:hk});
        writeDB(); return {ok:true, won:true, heroKey:hk, frags, heroXp:70, ledger:ledgerView(me)};
      }); return send(res, out.ok===false?400:200, out); }
    if(p==='/api/trial/resolve'){ const out=idem(me.id+':trial:'+reqId,()=>{
        const kind=String(b.kind||''); const K=TRIAL_KINDS[kind]; if(!K) return {ok:false,error:'Unknown trial.'};
        const floor=Math.max(1,Math.min(500,b.floor|0));
        led.trial=led.trial||{}; const T=led.trial[kind]=led.trial[kind]||{best:0};
        if(floor>T.best+1) return {ok:false,error:'Clear the previous floor first.'};
        const ids=Array.isArray(b.heroIds)?b.heroIds.map(String).slice(0,5):[];
        for(const k of ids){ if(!led.unlocked[k]) return {ok:false,error:'not unlocked: '+k}; }
        const snaps=ids.map(k=>snapshotHeroFromServer(me,k)).filter(Boolean);
        if(!snaps.length) return {ok:false,error:'Pick your squad.'};
        const rec=vaultFloorRecord(Math.min(100,floor));
        const waves=rec.waves.map(w=>w.map(m=>{ const u=vaultSpecToCombatUnit(m); u.maxHp=Math.round(u.maxHp*K.mul); u.atkP=Math.round(u.atkP*K.mul); u.atk=u.atkP; return u; }));
        const band=x=>Object.assign({},x,{maxHp:Math.round(x.maxHp*1.6),atk:Math.round(x.atk*1.6),heal:Math.round((x.heal||0)*1.6),atkP:Math.round((x.atkP||0)*1.6),atkM:Math.round((x.atkM||0)*1.6)});
        const r=SIM.qualificationEstimate(snaps.map(band), waves, srvSeed('trial', kind, me.id, floor, reqId));
        if(!r.result.won) return {ok:true, won:false, best:T.best};
        const first=floor>T.best; if(first) T.best=floor;
        let reward=null;
        if(first){ reward=K.reward(floor);
          if(reward.gold) led.gold=Math.min(ECON_CAP.gold,led.gold+reward.gold);
          if(reward.px){ led.px=Math.min(99000000,led.px+reward.px); }
          if(reward.heroXp) for(const k of ids){ const h=led.hero[k]||(led.hero[k]={xp:0,stars:(SIM.HERO_BASE[k]||{}).stars||1,pips:0}); h.xp=Math.min(99000000,h.xp+reward.heroXp); }
          ledTx(me,'trial:'+kind+':'+floor,reward); }
        /* v273 (audit response P0) — EQUIPMENT MATERIALS ARE SERVER-OWNED.
           The dungeon used to roll them in the browser with Math.random() and write them straight into
           the local save, signed in or not — permanent value minted by the client. The roll happens
           here now, on the ledger, and the browser only animates what it is told. */
        let mats=null, matsCapped=false, matsLeft=null;
        if(kind==='dungeon'){
          /* v328 (audit 88/106) — the material roll paid EVERY winning resolve with no cap, and a fresh
             requestId on an already-cleared floor re-minted it forever. Day-keyed counter, same shape as
             led.eliteDay; a capped win still records the floor and pays the first-clear reward. */
          const dk=nyDayKey(); led.dungeonDay=led.dungeonDay&&led.dungeonDay.k===dk?led.dungeonDay:{k:dk,mats:0};
          if((led.dungeonDay.mats|0)>=DUNGEON_MATS_PER_DAY){ matsCapped=true; matsLeft=0; }
          else { led.dungeonDay.mats=(led.dungeonDay.mats|0)+1; matsLeft=Math.max(0,DUNGEON_MATS_PER_DAY-(led.dungeonDay.mats|0));
          led.eqMats=led.eqMats||{};
          const rng=SIM.mulberry32(srvSeed('mats', me.id, floor, reqId));
          const n=3+Math.floor(ledPlayerLevel(led)/5);
          mats={};
          for(let i=0;i<n;i++){ const k=EQ_MAT_KEYS[Math.floor(rng()*EQ_MAT_KEYS.length)];
            led.eqMats[k]=Math.min(999999,(led.eqMats[k]|0)+1); mats[k]=(mats[k]||0)+1; }
          ledTx(me,'dungeon:mats:'+floor,mats);
        } }
        writeDB(); return {ok:true, won:true, first, best:T.best, reward, mats, matsCapped, matsLeft, matsCap:DUNGEON_MATS_PER_DAY, eqMats:(led.eqMats||null), ledger:ledgerView(me)};
      }); return send(res, out.ok===false?400:200, out); }
    if(p==='/api/quest/claim'){ const out=idem(me.id+':quest:'+reqId,()=>{
        led.quests=led.quests||{claimed:{},chainStep:0};
        const id=String(b.id||''); const q=QUEST_DEFS_SRV[id]; if(!q) return {ok:false,error:'Unknown quest.'};
        if(led.quests.claimed[id]) return {ok:false,error:'Already claimed.'};
        if(!q.cond(me,led)) return {ok:false,error:'Quest not complete.'};
        led.quests.claimed[id]=Date.now();
        const rw=q.reward, got={};
        if(rw.gold){ led.gold=Math.min(ECON_CAP.gold,led.gold+rw.gold); got.gold=rw.gold; }
        if(rw.gems){ led.gems=Math.min(ECON_CAP.gems,led.gems+rw.gems); got.gems=rw.gems; }
        if(rw.hero){ led.unlocked[rw.hero]=true; led.hero[rw.hero]=led.hero[rw.hero]||{xp:0,stars:(SIM.HERO_BASE[rw.hero]||{}).stars||1,pips:0}; got.hero=rw.hero; }
        if(rw.randFrags){ const pool=Object.keys(SIM.HERO_BASE).filter(k=>!led.unlocked[k]); const n=rw.randFrags;
          for(let i=0;i<n;i++){ const hk=pool.length?pool[SIM.seedFrom('qf:'+me.id+':'+i)%pool.length]:'vex'; led.frags[hk]=Math.min(9999,(led.frags[hk]|0)+1); } got.frags=n; }
        ledTx(me,'quest:'+id,got);
        writeDB(); return {ok:true, id, got, ledger:ledgerView(me)};
      }); return send(res, out.ok===false?400:200, out); }
    if(p==='/api/quest/chain-claim'){ const out=idem(me.id+':qchain:'+reqId,()=>{
        led.quests=led.quests||{claimed:{},chainStep:0};
        const steps=questChainStepsSrv(); const st=steps[led.quests.chainStep|0];
        if(!st) return {ok:false,error:'Chain complete.'};
        if((led.camp.cleared|0)<st.node) return {ok:false,error:'Clear stage '+st.node+' first.'};
        led.quests.chainStep=(led.quests.chainStep|0)+1;
        const got={};
        if(st.frags){ led.frags.vex=Math.min(9999,(led.frags.vex|0)+st.frags); got.vexFrags=st.frags; }
        if(st.gems){ led.gems=Math.min(ECON_CAP.gems,led.gems+st.gems); got.gems=st.gems; }
        ledTx(me,'quest-chain:'+st.node,got);
        writeDB(); return {ok:true, step:led.quests.chainStep, got, ledger:ledgerView(me)};
      }); return send(res, out.ok===false?400:200, out); }
    if(p==='/api/market/frag'){ const out=idem(me.id+':mfrag:'+reqId,()=>{
        const hk=String(b.heroKey||''); if(!validHero(hk)) return {ok:false,error:'Unknown hero.'};
        const qty=Math.max(1,Math.min(4,b.qty|0));
        const pay=b.pay==='gems'?'gems':'gold';
        const price=pay==='gems'? 30*qty : 550*qty;                       // SERVER prices — the client displays these
        const dk=nyDayKey(); led.marketDay=led.marketDay&&led.marketDay.k===dk?led.marketDay:{k:dk,frags:0};
        if(led.marketDay.frags+qty>12) return {ok:false,error:'Daily market fragment limit reached.'};
        if(pay==='gold'){ if(led.gold<price) return {ok:false,error:'Not enough gold.'}; led.gold-=price; }
        else { if(led.gems<price) return {ok:false,error:'Not enough gems.'}; led.gems-=price; }
        led.marketDay.frags+=qty; led.frags[hk]=Math.min(9999,(led.frags[hk]|0)+qty);
        ledTx(me,'market-frag:'+hk,{[pay]:-price,frag:qty});
        writeDB(); return {ok:true, heroKey:hk, qty, paid:{[pay]:price}, ledger:ledgerView(me)};
      }); return send(res, out.ok===false?400:200, out); }
    if(p==='/api/arena/daily-claim'){ const out=idem(me.id+':adaily:'+reqId,()=>{
        const dk=nyDayKey(); me.arenaDaily=me.arenaDaily||{};
        if(me.arenaDaily.k===dk) return {ok:false,error:'Already claimed today.'};
        me.arenaDaily={k:dk};
        const rw=arenaDailyRewardSrv(Math.max(1,me.rank|0||15000));
        led.gold=Math.min(ECON_CAP.gold,led.gold+rw.gold);
        led.gems=Math.min(ECON_CAP.gems,led.gems+rw.gems);
        ledTx(me,'arena-daily',rw);
        writeDB(); return {ok:true, reward:rw, ledger:ledgerView(me)};
      }); return send(res, out.ok===false?400:200, out); }
  }
  /* =================== v249 (full-game audit P0): THE CITY LOOP IS SERVER-SIDE ===================
     Academy research lives on the LEDGER (levels, timers, resource wallet, costs mirrored from the
     client tables); world-map mining is a capped server grant; City PvP is resolved BY THE SERVER
     through the shared combat core, and the verified result is what both mailboxes receive. */
  if(p==='/api/academy' || p==='/api/academy/research' || p==='/api/academy/collect' || p==='/api/world/mine' || p==='/api/pvp/attack'){
    if(!me) return send(res,401,{error:'auth'});
    const led=ensureLedger(me); const A=ensureAcad(me);
    acadCollect(A);   // finished research applies on every touch
    if(p==='/api/academy') return send(res,200,{ lv:A.lv, learn:A.learn, res:A.res, max:TECH_MAX_SRV });
    if(req.method!=='POST') return send(res,404,{error:'academy'});
    const b=await body(req); const reqId=String(b.requestId||'').slice(0,48); if(!reqId) return send(res,400,{error:'requestId required'});
    if(p==='/api/academy/research'){ const out=idem(me.id+':acad:'+reqId,()=>{
        const track=String(b.track||''); if(!(track in A.lv)) return {ok:false,error:'Unknown research track.'};
        const lvl=A.lv[track]|0;
        if(lvl>=TECH_MAX_SRV) return {ok:false,error:'Fully researched.'};
        if(track!=='academy' && lvl>=(A.lv.academy|0)) return {ok:false,error:'The Academy must be upgraded first.'};
        for(const k in A.learn){ if(A.learn[k]>Date.now()) return {ok:false,error:'Research already in progress.'}; }
        const goldCost=60+lvl*70, rc=learnResCostSrv(track,lvl);
        if((led.gold|0)<goldCost) return {ok:false,error:'Not enough gold.'};
        for(const k in rc){ if((A.res[k]|0)<rc[k]) return {ok:false,error:'Not enough '+k+'.'}; }
        led.gold-=goldCost; for(const k in rc) A.res[k]-=rc[k];
        A.learn[track]=Date.now()+learnDurSrv(lvl,A.lv.academy|0);
        ledTx(me,'academy:'+track,{gold:-goldCost});
        writeDB(); return {ok:true, track, completesAt:A.learn[track], lv:A.lv, res:A.res, ledger:{gold:led.gold}};
      }); return send(res, out.ok===false?400:200, out); }
    if(p==='/api/academy/collect'){ const changed=acadCollect(A,true); writeDB();
      return send(res,200,{ ok:true, changed, lv:A.lv, learn:A.learn }); }
    if(p==='/api/world/mine'){ const out=idem(me.id+':mine:'+reqId,()=>{
        const rk=String(b.res||''); if(!['iron','crystal','silver','coal'].includes(rk)) return {ok:false,error:'Unknown resource.'};
        const amt=Math.max(1,Math.min(15,Math.floor(+b.amount||0)));
        const dk=nyDayKey(); if(!A.mineDay||A.mineDay.k!==dk) A.mineDay={k:dk};
        const used=(A.mineDay[rk]|0); const CAP=60;
        if(used>=CAP) return {ok:false,error:'Daily mining cap reached for '+rk+'.'};
        const grant=Math.min(amt,CAP-used);
        A.mineDay[rk]=used+grant; A.res[rk]=(A.res[rk]|0)+grant;
        writeDB(); return {ok:true, res:A.res, granted:grant, capLeft:CAP-A.mineDay[rk]};
      }); return send(res, out.ok===false?400:200, out); }
    if(p==='/api/pvp/attack'){ const out=idem(me.id+':pvpatk:'+reqId,()=>{
        const d=DB.users[String(b.defId||'')];
        if(!d||d.id===me.id) return {ok:false,error:'No such city.'};
        const dk=nyDayKey(); me.pvpDay=me.pvpDay&&me.pvpDay.k===dk?me.pvpDay:{k:dk,n:0,gold:0,coins:0};
        if(me.pvpDay.n>=20) return {ok:false,error:'No city attacks left today.'};
        const ids=Array.isArray(b.heroIds)?b.heroIds.map(String).slice(0,5):[];
        if(!ids.length) return {ok:false,error:'Pick your squad.'};
        for(const k of ids){ if(!led.unlocked[k]) return {ok:false,error:'You have not unlocked '+k+'.'}; }
        const mySnaps=ids.map(k=>snapshotHeroFromServer(me,k)).filter(Boolean);
        const defRoster=(Array.isArray(d.wall)&&d.wall.length?d.wall:(Array.isArray(d.team)?d.team:[])).filter(Boolean).slice(0,5);
        if(!mySnaps.length) return {ok:false,error:'Bad squad.'};
        const defSnaps=(d.isNpc?defRoster.map(function(e){ return snapshotNpcHero(e); }):rosterKeys(defRoster).map(function(k){ return snapshotHeroFromServer(d,k); })).filter(Boolean);
        // v328: an unresolvable defence must FAIL CLOSED. This used to leave won=true when the
        // wall produced no snapshots (empty roster via sanitizeRoster, or any future shape change),
        // handing the attacker capped gold + guild coins + hero XP with no battle ever simulated.
        // Returned before me.pvpDay.n++ so a phantom fight costs the attacker no daily attack.
        if(!defSnaps.length) return {ok:false,error:'That city has no defenders.'};
        let won=false, rounds=0, log=[];
        if(defSnaps.length){ const r=SIM.resolveLineBattle(SIM.makeLine(mySnaps),SIM.makeLine(defSnaps),SIM.seedFrom('citypvp:'+me.id+':'+reqId));
          won=r.won; rounds=r.rounds; log=r.log.slice(0,200); }
        me.pvpDay.n++;
        let loot=null;
        if(won){ const g=Math.min(400, Math.max(0,8000-me.pvpDay.gold));
          if(g>0){ led.gold=Math.min(ECON_CAP.gold,led.gold+g); me.pvpDay.gold+=g; ledTx(me,'city-pvp',{gold:g}); loot={gold:g}; } else loot={gold:0};
          const c=Math.min(40, Math.max(0,400-(me.pvpDay.coins|0)));
          if(c>0){ led.guildCoins=Math.min(ECON_CAP.guildCoins,(led.guildCoins|0)+c); me.pvpDay.coins=(me.pvpDay.coins|0)+c; ledTx(me,'city-pvp',{guildCoins:c}); }
          loot.guildCoins=c;
          for(const k of ids){ const h=led.hero[k]||(led.hero[k]={xp:0,stars:(SIM.HERO_BASE[k]||{}).stars||1,pips:0}); h.xp=Math.min(99000000,h.xp+50); } }
        d.pvpMail=d.pvpMail||[];
        d.pvpMail.push({id:uid(), from:me.name, won, t:Date.now(), verified:true, rounds});
        if(d.pvpMail.length>20) d.pvpMail=d.pvpMail.slice(-20);
        DB.watch=DB.watch||{}; const w=DB.watch[me.id]||{id:me.id,name:me.name,guildId:me.guildId||null,attacks:[],defends:[],scouts:[]};
        w.attacks=(w.attacks||[]).slice(-19); w.attacks.push({t:Date.now(),target:d.name,won,verified:true}); w.t=Date.now(); w.guildId=me.guildId||null; DB.watch[me.id]=w;
        writeDB(); return {ok:true, won, rounds, loot, log, attacksLeft:20-me.pvpDay.n};
      }); return send(res, out.ok===false?400:200, out); }
  }
  if(p==='/api/pvp/attack-report' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    if(rateLimited(req,'pvprep',20,60000)) return send(res,429,{error:'Slow down.'});
    const b=await body(req); const d=DB.users[String(b.defId||'')];
    if(!d||d.isNpc||d.id===me.id) return send(res,200,{ok:false});
    d.pvpMail=d.pvpMail||[]; const rec={from:me.name,won:!!b.won,t:Date.now(),social:true,unverified:true};   // DEPRECATED (v249): /api/pvp/attack is the verified route; this remains a social note only
    try{ if(b.battle&&typeof b.battle==='object'){ const s=JSON.stringify(b.battle); if(s.length<=8000) rec.battle=JSON.parse(s); } }catch(e){}
    d.pvpMail.push(rec); if(d.pvpMail.length>20)d.pvpMail=d.pvpMail.slice(-20);
    writeDB(); return send(res,200,{ok:true}); }
  if(p==='/api/pvp/reports'){ if(!me)return send(res,401,{error:'auth'});
    // RE-AUDIT: reads are non-destructive — a dropped response no longer loses mail. Reports carry ids
    // and are cleared only by the explicit ack below (legacy id-less entries get ids on read).
    me.pvpMail=(me.pvpMail||[]).map(r=>r.id?r:Object.assign({id:uid()},r));
    writeDB(); return send(res,200,{reports:me.pvpMail}); }
  if(p==='/api/pvp/reports-ack' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    const b2=await body(req); const ids=new Set(Array.isArray(b2.ids)?b2.ids.map(String):[]);
    me.pvpMail=(me.pvpMail||[]).filter(r=>!ids.has(String(r.id)));
    writeDB(); return send(res,200,{ok:true, remaining:(me.pvpMail||[]).length}); }

  // ---- WORLD MAP: every registered player's castle (real positions from their save).
  //      The client shows these as REAL cities and fills the rest of each region with NPC bots. ----
  if(p==='/api/world/cities'){ if(!me)return send(res,401,{error:'auth'});
    const cities=Object.values(DB.users)
      .filter(u=>u.id!==me.id && u.world && u.world.region)
      .slice(0,500)
      .map(u=>({ id:u.id, name:u.name, rank:u.rank||null, level:u.world.level||1,
                 power:serverTeamPower((Array.isArray(u.wall)&&u.wall.length?u.wall:(u.team||[])), u)|0,   // v249: SERVER-computed power, never client-uploaded
                 region:u.world.region, x:u.world.x, y:u.world.y, guildId:u.guildId||null,
                 team:hydrateRoster(u,(Array.isArray(u.wall)&&u.wall.length?u.wall:(u.team||[]))) }));
    return send(res,200,{ cities, myGuildId: me.guildId||null }); }

  if(p==='/api/arena/opponent'){ if(!me)return send(res,401,{error:'auth'}); const o=pickOpponent(me);
    return send(res,200,{ opponent:{ id:o.id, name:o.name, rank:o.rank, team:hydrateRoster(o,o.team), isNpc:!!o.isNpc } }); }

  if(p==='/api/arena/opponents'){ if(!me)return send(res,401,{error:'auth'});
    // SPREAD opponents across %-better rank bands (mirrors client arenaTargetRanks) so you can see JUMP targets,
    // not just the 5 consecutive ranks directly above you. The spread widens as you climb.
    const pool=Object.values(DB.users).filter(u=>u.id!==me.id && u.rank<me.rank).sort((a,b)=>a.rank-b.rank);
    function bandBonus(m){ let b=Math.min(4,Math.floor((5000-m)/1000));
      if(m<=1000)b+=Math.min(18,Math.floor((1000-m)/100)*2); if(m<=100)b+=Math.min(15,Math.floor((100-m)/10)*3); if(m<=50)b+=Math.min(12,Math.floor((50-m)/10)*3); return b; }
    function targetRanks(m){ if(m<=1)return []; if(m<=10){ const o=[]; for(let r=1;r<m&&o.length<4;r++)o.push(r); return o; }
      const T=3.5+bandBonus(m), oneRank=100/m;
      const bands=[[Math.min(T,oneRank),T],[Math.max(oneRank,T*0.26),T+4],[Math.max(oneRank,T*0.5),T+8],[Math.max(oneRank,T*0.75),T+12]];
      const used=new Set(), out=[];
      bands.forEach(bd=>{ const lo=bd[0], hi=Math.min(97,Math.max(bd[1],lo+0.5)), pct=lo+Math.random()*(hi-lo);
        let r=Math.max(1,Math.round(m*(1-pct/100))); while((used.has(r)||r>=m)&&r>1)r--; while(used.has(r)&&r<m-1)r++;
        if(!used.has(r)&&r>=1&&r<m){ used.add(r); out.push(r); } });
      out.sort((a,b)=>a-b); return out; }
    const targets=targetRanks(me.rank), chosen=new Set(), opps=[];
    for(const tr of targets){ let best=null,bd=1e9; for(const u of pool){ if(chosen.has(u.id))continue; const d=Math.abs(u.rank-tr); if(d<bd){bd=d;best=u;} } if(best){ chosen.add(best.id); opps.push(best); } }
    for(let k=pool.length-1; k>=0 && opps.length<5; k--){ const u=pool[k]; if(!chosen.has(u.id)){ chosen.add(u.id); opps.push(u); } }   // fill remaining with the NEAREST ranks above you (pool is ascending → never the very top)
    opps.sort((a,b)=>a.rank-b.rank);   // best rank (biggest jump) first, like the client
    // v327: preview the rank-milestone diamonds THIS player would ACTUALLY be paid for each opponent —
    // same step table, same loop and same fractional settle as /api/arena/result — so the client's
    // "💎 +N" row can never promise more than the server pays.
    const mBest=(me.bestRank!=null)?me.bestRank:5000, mFrac=(me._gemFrac||0);
    function prevGems(rk){ if(rk>=mBest) return 0; let d=0; for(let rr=rk; rr<mBest; rr++) d+= rr<=10?12:(rr<=50?8:(rr<=100?5:(rr<=500?2:1))); return Math.floor(mFrac+d); }
    const out=opps.slice(0,5).map(u=>({ id:u.id, name:u.name, rank:u.rank, isNpc:!!u.isNpc, team:hydrateRoster(u,u.team||[]), gems:prevGems(u.rank) }));
    return send(res,200,{ rank:me.rank, opponents:out }); }

  if(p==='/api/arena/result' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'});
    if(rateLimited(req,'arena',30,60000)) return send(res,429,{error:'Slow down — too many arena results.'});
    const b=await body(req);
    // AUDIT A5 (v228): every battle claim is idempotent. A replayed request returns the ORIGINAL
    // verdict/reward — it never re-applies rank, coins, gold, or fragments.
    const areqId=String(b.requestId||'').slice(0,48); if(!areqId) return send(res,400,{error:'requestId required'});
    const akey=me.id+':arena:'+areqId;
    DB.idem=DB.idem||{}; if(DB.idem[akey]) return send(res,200,DB.idem[akey].resp);
    const opp=DB.users[b.oppId];
    // SECURITY (audit crit #3): rank + coins used to trust the client-declared b.won. They are now
    // decided SERVER-SIDE from each side's serverTeamPower — the same interim authority the Guild War
    // already uses. This is a power comparison, NOT the real battle sim; the faithful fix is the shared
    // deterministic simulator (Phase 2). Tune ARENA_RNG if even matchups feel too swingy. -PR review
    // AUDIT C3: the arena is resolved by the SHARED deterministic simulator over server-built
    // snapshots of both teams — never by a raw power comparison, never by a client-declared result.
    // The seed is returned so the fight is replayable.
    const seed=SIM.seedFrom('arena:'+me.id+':'+String(b.oppId||'')+':'+uid());
    let won=false, simRes=null;
    if(opp){ // AUDIT v229 (P0): only OWNED heroes fight — a client-synced team can never smuggle a locked hero in
      const myLed=ensureLedger(me);
      let myKeys=rosterKeys(me.team).filter(k=>myLed.unlocked[k]).slice(0,5);
      if(!myKeys.length) myKeys=Object.keys(myLed.unlocked||{}).filter(k=>myLed.unlocked[k]&&SIM.HERO_BASE[k]).slice(0,5);   // v327: a player who never pressed save still fields a squad (ledgerTeamPower:312 does the same)
      const mySnaps=myKeys.map(k=>snapshotHeroFromServer(me,k)).filter(Boolean);
      const opLed=opp.isNpc?null:ensureLedger(opp);
      let opSnaps;
      if(opp.isNpc){ opSnaps=(Array.isArray(opp.team)?opp.team:[]).filter(Boolean).slice(0,5).map(function(e){ return snapshotNpcHero(e); }).filter(Boolean); }
      else { opSnaps=rosterKeys(opp.team).filter(k=>opLed&&opLed.unlocked[k]).slice(0,5).map(k=>snapshotHeroFromServer(opp,k)).filter(Boolean);
        if(!opSnaps.length&&opLed) opSnaps=Object.keys(opLed.unlocked||{}).filter(k=>opLed.unlocked[k]&&SIM.HERO_BASE[k]).slice(0,5).map(k=>snapshotHeroFromServer(opp,k)).filter(Boolean); }
      if(mySnaps.length&&opSnaps.length){ const r0=SIM.resolveLineBattle(SIM.makeLine(mySnaps),SIM.makeLine(opSnaps),seed); won=r0.won;
        simRes={rounds:r0.rounds, log:(r0.log||[]).slice(0,200)}; }   // v255 (§7): the arena returns its combat-core event log for the result recap
    }
    const r=applyResult(me,opp,won); const reward=won?(20+Math.floor((5000-me.rank)/50)):5; me.coins+=reward;
    let goldReward=0; if(won){ const led=ensureLedger(me);
      // per-NY-day cap on arena gold (EARN_RULES pattern): rank still moves after the cap, gold stops.
      led.earnDay=led.earnDay||{}; const adk=nyDayKey(); if(led.earnDay.k!==adk){ led.earnDay={k:adk}; }
      const aused=(led.earnDay['gold:arena']|0), ACAP=8000;
      goldReward=Math.min(Math.max(0,200+Math.floor((5000-me.rank)/20)), Math.max(0,ACAP-aused));
      if(goldReward>0){ led.earnDay['gold:arena']=aused+goldReward; led.gold=Math.min(100000000,led.gold+goldReward); ledTx(me,'arena:win',{gold:goldReward}); } }
    if(opp && b.def && Array.isArray(b.def.mineSnap) && Array.isArray(b.def.foe) && b.def.mineSnap.length && b.def.foe.length){   // record a watchable DEFENSE report on the opponent (they were attacked). mineSnap=attacker squad, foe=defender squad, won=attacker won (server result).
      opp.arenaDefenses = Array.isArray(opp.arenaDefenses)?opp.arenaDefenses:[];
      opp.arenaDefenses.unshift({ v:2, seed:(b.def.seed>>>0), mineSnap:b.def.mineSnap.slice(0,6), foe:b.def.foe.slice(0,6), won:won, atkName:String(b.def.atkName||me.name||'A challenger').slice(0,24), t:Date.now() });
      if(opp.arenaDefenses.length>10) opp.arenaDefenses.length=10; }
    me.qc=me.qc||{}; me.qc.arena=(me.qc.arena|0)+1;   // v250: server-tracked quest counter
    /* v267 (80/20 §9): rank-milestone diamonds are paid HERE, from the server's own rank record —
       the client used to award them itself through the generic earn endpoint. */
    let milestoneGems=0;
    { const led=ensureLedger(me); const best=(me.bestRank!=null)?me.bestRank:5000;
      if(me.rank<best){ let d=0; for(let rr=me.rank; rr<best; rr++) d+= rr<=10?12:(rr<=50?8:(rr<=100?5:(rr<=500?2:1)));
        me.bestRank=me.rank; me._gemFrac=(me._gemFrac||0)+d; milestoneGems=Math.floor(me._gemFrac); me._gemFrac-=milestoneGems;
        if(milestoneGems>0){ gemGain(me,milestoneGems,'arena'); led.gems=Math.min(9999999,led.gems+milestoneGems); ledTx(me,'arena:rank-milestone',{gems:milestoneGems}); } } }
    let glyphFrags=null; if(won && glyphsEnabledFor(me) && me.glyphs && me.glyphs.migratedAt){ glyphFrags=glyphGrantNamedList(me, arenaGlyphFragsFor(me.rank)); }   // Correction Spec v1: named, rank-deterministic — no random family roll
    const aresp={ rank:me.rank, delta:r.delta, reward, coins:me.coins, glyphFrags, won, seed, sim:simRes, goldReward, milestoneGems, bestRank:me.bestRank, authoritative:true, ledger:ledgerView(me) };
    DB.idem[akey]={t:Date.now(),resp:aresp}; writeDB();
    return send(res,200,aresp); }

  if(p==='/api/arena/reports'){ if(!me)return send(res,401,{error:'auth'});   // the defender fetches watchable reports of arena attacks made against them
    return send(res,200,{ defenses: Array.isArray(me.arenaDefenses)?me.arenaDefenses:[] }); }

  if(p==='/api/arena/ladder'){ if(!me)return send(res,401,{error:'auth'});
    const all=allUsersByRank(); const total=all.length; const youIndex=all.findIndex(u=>u.id===me.id);
    const q=(url.searchParams.get('q')||'').toLowerCase().trim();
    let offset=parseInt(url.searchParams.get('offset')||'0',10); if(!(offset>=0))offset=0;
    let limit=parseInt(url.searchParams.get('limit')||'100',10); if(!(limit>=1))limit=100; limit=Math.min(200,limit);
    if(q){ // name search across the WHOLE server
      const hits=[]; for(let i=0;i<all.length && hits.length<60;i++){ const u=all[i]; if((u.name||'').toLowerCase().includes(q)) hits.push({ pos:i+1, rank:u.rank, name:u.name, isNpc:!!u.isNpc, power:serverTeamPower(u.team, u), you:u.id===me.id }); }
      return send(res,200,{ entries:hits, total, youIndex, youRank:me.rank, search:true }); }
    const entries=all.slice(offset,offset+limit).map((u,i)=>({ pos:offset+i+1, rank:u.rank, name:u.name, isNpc:!!u.isNpc, power:serverTeamPower(u.team, u), you:u.id===me.id }));
    return send(res,200,{ entries, total, youIndex, youRank:me.rank, offset, limit }); }

  if(p==='/api/daily' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'}); const now=Date.now();
    if(now-(me.lastDaily||0) < 20*60*60*1000) return send(res,200,{granted:0, coins:me.coins, next:(me.lastDaily+20*60*60*1000)});
    const amt=dailyAmount(me.rank); me.coins+=amt; me.lastDaily=now;
    let glyphFrags=null; if(glyphsEnabledFor(me)&&me.glyphs&&me.glyphs.migratedAt){ glyphFrags=glyphGrantNamedList(me, dailyGlyphFragsFor(nyDayKey())); }   // Correction Spec v1: named, NY-day-deterministic rotation up to Blue
    let gearFrags=null; if(gearEnabledFor(me)){ const q=['Grey','Green','Blue'][Math.floor(Math.random()*3)]; gearFrags=gearGrantFragments(me,q,3); }   // daily: 3 gear fragments
    writeDB(); return send(res,200,{granted:amt, coins:me.coins, glyphFrags, gearFrags}); }

  if(p==='/api/world'){ if(!me)return send(res,401,{error:'auth'});
    const cities=Object.values(DB.users).filter(u=>u.id!==me.id).sort((a,b)=>a.rank-b.rank).slice(0,24)
      .map(u=>({id:u.id,name:u.name,rank:u.rank,isNpc:!!u.isNpc}));
    return send(res,200,{ cities, me:{name:me.name,rank:me.rank} }); }

  if(p==='/api/raid' && req.method==='POST'){ if(!me)return send(res,401,{error:'auth'}); const b=await body(req); const c=DB.users[b.id];
    if(!c) return send(res,404,{error:'no city'}); return send(res,200,{ defense:c.wall||c.team, name:c.name, rank:c.rank }); }


  /* ------------------------------- WATCH TOWER ------------------------------
     Guild members publish their live world-map activity (attacks/defends/scouts)
     to DB.watch keyed by user id. GET /api/watch aggregates fresh (<10min) entries
     for everyone in the caller's guild, plus who is scouting the caller. */
  if(p.startsWith('/api/watch')){
    if(!me) return send(res,401,{error:'auth'});
    DB.watch = DB.watch || {};
    const WFRESH = 10*60*1000;
    if(p==='/api/watch/report' && req.method==='POST'){
      const b=await body(req)||{};
      DB.watch[me.id] = {
        id:me.id, name:me.name, guildId:me.guildId||null,
        attacks:Array.isArray(b.attacks)?b.attacks.slice(0,20):[],
        defends:Array.isArray(b.defends)?b.defends.slice(0,20):[],
        scouts: Array.isArray(b.scouts) ?b.scouts.slice(0,20):[],
        t:Date.now()
      };
      writeDB();
      return send(res,200,{ok:true});
    }
    if(p==='/api/watch'){
      const now=Date.now();
      // prune stale entries
      for(const k of Object.keys(DB.watch)){ if(now-(DB.watch[k].t||0) > WFRESH) delete DB.watch[k]; }
      const fresh=Object.values(DB.watch).filter(w=>now-(w.t||0)<=WFRESH);
      const mates = me.guildId
        ? fresh.filter(w=>w.guildId===me.guildId)
              .map(w=>({ id:w.id, name:w.name, you:w.id===me.id, attacks:w.attacks||[], defends:w.defends||[], scouts:w.scouts||[], t:w.t }))
        : fresh.filter(w=>w.id===me.id)
              .map(w=>({ id:w.id, name:w.name, you:true, attacks:w.attacks||[], defends:w.defends||[], scouts:w.scouts||[], t:w.t }));
      const myName=(me.name||'').toLowerCase();
      const scoutedBy=[];
      for(const w of fresh){
        if(w.id===me.id) continue;
        for(const s of (w.scouts||[])){
          if((s.name||'').toLowerCase()===myName){ scoutedBy.push({ by:w.name, eta:s.eta||null, t:w.t }); }
        }
      }
      return send(res,200,{ mates, scoutedBy, guilded:!!me.guildId });
    }
    return send(res,404,{error:'watch'});
  }

  /* ------------------------------- GUILDS (real, cross-device) --------------
     A guild is a shared server object in DB.guilds; each user carries a guildId
     pointer. Membership, join-requests, roster, shared level/exp and chat are all
     server-authoritative. Clients poll /api/guild/mine while the guild screen is open. */
  if(p.startsWith('/api/guild')){
    if(!me) return send(res,401,{error:'auth'});
    DB.guilds = DB.guilds || {};
    DB.wars = DB.wars || {};
    const GBASE=30,GPER=5,GMAXCAP=60,GMAXLVL=7;
    const gCap = g => Math.min(GMAXCAP, GBASE+((g.level||1)-1)*GPER);
    const gExpNeed = lvl => 1000*lvl;
    const findGuild = id => (typeof id==='string' && Object.prototype.hasOwnProperty.call(DB.guilds, id)) ? DB.guilds[id] : null;
    const myGuild = () => me.guildId ? findGuild(me.guildId) : null;
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
        log:(g.log||[]).filter(e=>e.sys||!e.t||(Date.now()-e.t)<6*3600000).slice(-60) };   // guild CHAT messages disappear after 6h (system notices kept)
    }
    // ---- reads ----
    // ---- shared Guild Raid boss helpers ----
    const RAID_ATT=5;
    const BOSS_NAMES=['Gorehollow the Ravager','Sablewing the Black Wyrm','The Ashen Colossus','Molgra, Fist of Ruin','Vaelthrun the Deathless','Irongale Behemoth','Nyxaroth the Devourer'];
    const bossMax=lvl=>Math.round(80000*Math.pow(1.6,(lvl||1)-1));
    function ensureRaid(gg){ if(!gg.raid){ gg.raid={level:1,max:bossMax(1),hp:bossMax(1),kills:0,contrib:{},used:{},day:''}; }
      const dk=new Date().toISOString().slice(0,10); if(gg.raid.day!==dk){ gg.raid.day=dk; gg.raid.used={}; } return gg.raid; }
    function raidView(gg){ const r=ensureRaid(gg); const gd=Object.values(r.contrib).reduce((a,b)=>a+b,0);
      const top=Object.entries(r.contrib).map(([id,dmg])=>({name:nameOf(id),dmg})).sort((a,b)=>b.dmg-a.dmg).slice(0,5);
      return { level:r.level, max:r.max, hp:r.hp, kills:r.kills, yourDmg:r.contrib[me.id]||0, guildDmg:gd,
        attemptsLeft:Math.max(0,RAID_ATT-((r.used[me.id])||0)), top, name:BOSS_NAMES[((r.level||1)-1)%BOSS_NAMES.length] }; }
    // ---- shared Guild War helpers (REAL guild-vs-guild, weekly matchmaking) ----
    // A war is a shared DB.wars object referenced by BOTH guilds (g.war={week,id}). Each guild's
    // members duel the opposing guild's real member squads; wins score war points for their side.
    // Server-authoritative: duel outcome computed here from each side's serverTeamPower (client can't fake a win).
    const WAR_ATT=5, WAR_WEEK_MS=7*24*3600000;
    const warWeek=()=>Math.floor(Date.now()/WAR_WEEK_MS);
    const warDay=()=>new Date().toISOString().slice(0,10);
    function guildStrength(gg){ let s=0; for(const id of (gg.members||[])){ const u=DB.users[id]; if(u) s+=serverTeamPower(u.team, u); } return s+((gg.level||1)-1)*400; }
    function npcWarChamps(strength,seed){ const avg=Math.max(200,Math.round(strength/3)); const n=5,champs=[];
      for(let i=0;i<n;i++){ const x=Math.sin(seed*7.13+i*3.71)*43758.5, f=x-Math.floor(x);
        champs.push({ id:'npc_'+i, name:NPC_NAMES[Math.floor(f*NPC_NAMES.length)]+' Sworn', power:Math.max(150,Math.round(avg*(0.72+i*0.11+f*0.24))) }); }
      return champs; }
    function ensureWar(g){ const wk=warWeek();
      if(g.war && g.war.week===wk && DB.wars[g.war.id]) return DB.wars[g.war.id];
      // prune stale wars (nobody references a war older than last week)
      for(const wid in DB.wars){ if((DB.wars[wid].week||0) < wk-1) delete DB.wars[wid]; }
      const myStr=guildStrength(g);
      const cands=Object.values(DB.guilds).filter(x=> x.id!==g.id && (x.members||[]).length>0 && !(x.war && x.war.week===wk && DB.wars[x.war.id]));
      cands.sort((a,b)=>Math.abs(guildStrength(a)-myStr)-Math.abs(guildStrength(b)-myStr));
      const id=uid(); let war;
      if(cands.length){ const foe=cands[0];
        war={ id, week:wk, a:g.id, b:foe.id, aName:g.name, bName:foe.name, aPts:0, bPts:0, beaten:{}, used:{}, log:[{sys:1,tx:'War declared: <'+g.name+'> vs <'+foe.name+'>',t:Date.now()}], npc:false, createdAt:Date.now(), endsAt:(wk+1)*WAR_WEEK_MS };
        DB.wars[id]=war; g.war={week:wk,id}; foe.war={week:wk,id}; }
      else { const champs=npcWarChamps(myStr, wk*131+((g.id&&g.id.charCodeAt(0))||7));
        war={ id, week:wk, a:g.id, b:null, aName:g.name, bName:'The Wilds Coalition', aPts:0, bPts:0, beaten:{}, used:{}, log:[{sys:1,tx:'No rival guild available — you face The Wilds Coalition this week.',t:Date.now()}], npc:true, npcChamps:champs, createdAt:Date.now(), endsAt:(wk+1)*WAR_WEEK_MS };
        DB.wars[id]=war; g.war={week:wk,id}; }
      writeDB(); return war; }
    function warView(g){ const war=ensureWar(g); const iAmA=war.a===g.id;
      const youPts=iAmA?war.aPts:war.bPts, foePts=iAmA?war.bPts:war.aPts;
      let champs;
      if(war.npc){ champs=(war.npcChamps||[]).map(c=>({ id:c.id, name:c.name, power:c.power, online:false, npc:true })); }
      else { const foeId=iAmA?war.b:war.a, foe=DB.guilds[foeId];
        champs=((foe&&foe.members)||[]).map(id=>{ const u=DB.users[id]; return { id, name:nameOf(id), power:serverTeamPower(u&&u.team, u), online:isOnline(id), npc:false }; })
          .sort((a,b)=>b.power-a.power); }
      const bm=war.beaten[me.id]||{}; champs=champs.map(c=>({ ...c, beaten:!!bm[c.id] }));
      const ud=war.used[me.id], usedToday=(ud&&ud.day===warDay())?ud.n:0;
      return { week:war.week, endsAt:war.endsAt, npc:war.npc,
        you:{ name:iAmA?war.aName:war.bName, pts:youPts },
        foe:{ name:iAmA?war.bName:war.aName, pts:foePts, npc:war.npc },
        champs, attemptsLeft:Math.max(0,WAR_ATT-usedToday), yourPower:serverTeamPower(me.team, me),
        winning: youPts>=foePts, log:(war.log||[]).slice(-30) }; }
    if(p==='/api/guild/mine'){ const g=myGuild(); return send(res,200,{ guild: g?guildView(g):null }); }
    if(p==='/api/guild/browse'){ const q=(url.searchParams.get('q')||'').toLowerCase().trim();
      const list=Object.values(DB.guilds)
        .filter(g=> !q || (g.name||'').toLowerCase().includes(q))
        .map(g=>({id:g.id,name:g.name,level:g.level||1,count:(g.members||[]).length,cap:gCap(g),
                  leaderName:nameOf(g.leader),requested:(g.reqs||[]).some(r=>r.id===me.id)}))
        .sort((a,b)=> b.count-a.count).slice(0,40);
      return send(res,200,{ guilds:list, mine: me.guildId||null }); }

    if(p==='/api/guild/raid'){ const g=myGuild(); if(!g) return send(res,400,{error:'You are not in a guild.'}); return send(res,200,{ raid:raidView(g) }); }
    if(p==='/api/guild/war'){ // AUDIT C9: the legacy power-comparison Guild War is RETIRED — Skyfall
      // (five floating citadels, /api/guild-war/*) is the only competitive Guild War. Raid stays co-op.
      return send(res,200,{ retired:true, note:'Guild War has moved to the Skyfall Tournament.' }); }
    if(req.method!=='POST') return send(res,404,{error:'not found'});
    const b=await body(req);

    if(p==='/api/guild/create'){
      if(rateLimited(req,'gcreate',10,60000)) return send(res,429,{error:'Slow down and try again in a moment.'});
      if(myGuild()) return send(res,400,{error:'You are already in a guild.'});
      let name=capWords((b.name||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim()).slice(0,24);
      if(name.length<2) return send(res,400,{error:'Guild name must be at least 2 characters.'});
      if(Object.values(DB.guilds).some(g=>(g.name||'').toLowerCase()===name.toLowerCase())) return send(res,409,{error:'That guild name is already taken'});
      const id=uid(); const g={ id, name, leader:me.id, members:[me.id], reqs:[], level:1, exp:0, motd:'Welcome to '+name+'!', log:[], createdAt:Date.now() };
      DB.guilds[id]=g; me.guildId=id; writeDB();
      return send(res,200,{ guild:guildView(g) }); }

    if(p==='/api/guild/request'){
      if(myGuild()) return send(res,400,{error:'Leave your current guild first.'});
      const g=findGuild(b.guildId); if(!g) return send(res,404,{error:'Guild not found.'});
      if((g.members||[]).length>=gCap(g)) return send(res,400,{error:'That guild is full.'});
      g.reqs=g.reqs||[]; if(g.reqs.some(r=>r.id===me.id)) return send(res,200,{ ok:true, already:true });
      if(g.reqs.length>=80) return send(res,400,{error:'That guild has too many pending requests right now.'});
      g.reqs.push({id:me.id,t:Date.now()}); writeDB(); return send(res,200,{ ok:true }); }

    if(p==='/api/guild/cancelRequest'){ const g=findGuild(b.guildId); if(g){ g.reqs=(g.reqs||[]).filter(r=>r.id!==me.id); writeDB(); } return send(res,200,{ok:true}); }

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
      g.log=g.log||[]; const gm={id:me.id,name:me.name,tx,t:Date.now()};
      try{ if(b.battle && typeof b.battle==='object'){ const s=JSON.stringify(b.battle); if(s.length<=8000) gm.battle=JSON.parse(s); } }catch(e){}   // optional shared-replay chip
      g.log.push(gm); if(g.log.length>100)g.log=g.log.slice(-100);
      writeDB(); return send(res,200,{ ok:true, log:g.log.slice(-60) }); }

    if(p==='/api/guild/contribute'){ if(!g) return send(res,400,{error:'You are not in a guild.'});
      if(rateLimited(req,'gcontrib',80,60000)) return send(res,429,{error:'Slow down.'});
      // SECURITY (audit crit #4): exp used to be an arbitrary client number (up to 100,000/call with
      // NO resource deducted, 80 calls/min → ~8,000,000 exp/min from nothing). The server now awards a
      // FIXED amount and caps contributions per player per day; the client no longer sets the amount.
      // NOTE: GUILD_CONTRIB_EXP / GUILD_CONTRIB_DAILY are a balance placeholder — tune in the economy
      // pass (real fix = deduct an owned server-side resource, Phase 2). -PR review
      const GUILD_CONTRIB_EXP=100, GUILD_CONTRIB_DAILY=20;
      const _dk=new Date().toISOString().slice(0,10);
      if(!me.guildContrib || me.guildContrib.day!==_dk) me.guildContrib={day:_dk,n:0};
      if(me.guildContrib.n>=GUILD_CONTRIB_DAILY) return send(res,200,{ capped:true, guild:guildView(g) });
      // v241 (full-game audit): a contribution SPENDS a server resource — 200 ledger gold per click.
      // No free XP from nothing; the daily cap stays as the outer bound.
      const GUILD_CONTRIB_GOLD=200;
      { const led=ensureLedger(me);
        if((led.gold|0)<GUILD_CONTRIB_GOLD) return send(res,400,{error:'Contributing costs '+GUILD_CONTRIB_GOLD+' gold.'});
        led.gold-=GUILD_CONTRIB_GOLD; ledTx(me,'guild-contribute',{gold:-GUILD_CONTRIB_GOLD}); }
      me.guildContrib.n++;
      const amt=GUILD_CONTRIB_EXP;
      g.exp=(g.exp||0)+amt;
      while((g.level||1)<GMAXLVL && g.exp>=gExpNeed(g.level||1)){ g.exp-=gExpNeed(g.level||1); g.level=(g.level||1)+1;
        g.log=g.log||[]; g.log.push({sys:1,tx:'The guild reached Level '+g.level+'!',t:Date.now()}); }
      if((g.level||1)>=GMAXLVL) g.exp=0;
      writeDB(); return send(res,200,{ guild:guildView(g) }); }

    if(p==='/api/guild/raid/assault'){ if(!g) return send(res,400,{error:'You are not in a guild.'});
      if(rateLimited(req,'graid',30,60000)) return send(res,429,{error:'Slow down.'});
      const r=ensureRaid(g); if(((r.used[me.id])||0)>=RAID_ATT) return send(res,200,{ none:true, raid:raidView(g) });
      /* SECURITY (audit crit #5, re-closed v272): damage was driven by client b.power, then by
         serverTeamPower(me.team) — but me.team is CLIENT-AUTHORED (see /api/save), so a forged
         {level:9999,rank:999} still inflated raid damage ~560×. Power now comes from the ledger. */
      let power=Math.max(1,Math.min(5000000, ledgerTeamPower(me)||1));
      const dmg=Math.max(1, Math.round(power*(1.4+Math.random()*0.8)));
      r.hp=Math.max(0,r.hp-dmg); r.contrib[me.id]=(r.contrib[me.id]||0)+dmg; r.used[me.id]=((r.used[me.id])||0)+1;
      let killed=false, reward=null;
      if(r.hp<=0){ killed=true; const lv=r.level;
        g.exp=(g.exp||0)+250; while((g.level||1)<GMAXLVL && g.exp>=gExpNeed(g.level||1)){ g.exp-=gExpNeed(g.level||1); g.level=(g.level||1)+1; g.log=g.log||[]; g.log.push({sys:1,tx:'The guild reached Level '+g.level+'!',t:Date.now()}); }
        if((g.level||1)>=GMAXLVL) g.exp=0;
        r.level=lv+1; r.max=bossMax(r.level); r.hp=r.max; r.kills=(r.kills||0)+1; r.contrib={};
        g.log=g.log||[]; g.log.push({sys:1,tx:me.name+' landed the killing blow on '+BOSS_NAMES[(lv-1)%BOSS_NAMES.length]+' (Tier '+lv+')!',t:Date.now()}); if(g.log.length>100)g.log=g.log.slice(-100);
        reward={ guildCoins:300*lv, gold:800*lv, gems:15+lv*3, tier:lv }; }
      else { reward={ guildCoins:Math.round(dmg/50) }; }
      // v241 (full-game audit): the raid reward is CREDITED to the server wallet in the same
      // transaction that reports it — never a client-side receipt. Guild Coins live on the ledger
      // (led.guildCoins) so the guild shop can be moved onto them.
      { const led=ensureLedger(me);
        if(reward.gold) led.gold=Math.min(ECON_CAP.gold,(led.gold|0)+reward.gold);
        if(reward.gems) led.gems=Math.min(ECON_CAP.gems,(led.gems|0)+reward.gems);
        if(reward.guildCoins) led.guildCoins=Math.min(ECON_CAP.guildCoins,(led.guildCoins|0)+(reward.guildCoins|0));
        ledTx(me,'guild-raid',reward); }
      writeDB(); return send(res,200,{ dmg, killed, reward, raid:raidView(g) }); }

    if(p==='/api/guild/war/attack'){ return send(res,400,{error:'Legacy Guild War is retired — fight in the Skyfall Tournament (Guild → Skyfall).'}); }
    if(false){ /* legacy war attack retired (audit C9) */ if(!g) return send(res,400,{error:'You are not in a guild.'});
      if(rateLimited(req,'gwar',30,60000)) return send(res,429,{error:'Slow down.'});
      const war=ensureWar(g); const iAmA=war.a===g.id;
      const tid=(b.targetId||'').toString();
      let target=null;
      if(war.npc){ const c=(war.npcChamps||[]).find(c=>c.id===tid); if(c) target={ id:c.id, name:c.name, power:c.power }; }
      else { const foeId=iAmA?war.b:war.a, foe=DB.guilds[foeId];
        if(foe && (foe.members||[]).includes(tid)){ const u=DB.users[tid]; target={ id:tid, name:nameOf(tid), power:serverTeamPower(u&&u.team, u) }; } }
      if(!target) return send(res,400,{error:'That champion is no longer in the war.'});
      war.beaten[me.id]=war.beaten[me.id]||{};
      if(war.beaten[me.id][tid]) return send(res,200,{ already:true, war:warView(g) });
      const ud=war.used[me.id], usedToday=(ud&&ud.day===warDay())?ud.n:0;
      if(usedToday>=WAR_ATT) return send(res,200,{ none:true, war:warView(g) });
      war.used[me.id]={ day:warDay(), n:usedToday+1 };
      const mine=serverTeamPower(me.team, me)*(0.9+Math.random()*0.3), win= mine>=target.power;
      let pts=0, coins=0;
      if(win){ war.beaten[me.id][tid]=1; pts=Math.max(1,Math.round(target.power/10)); coins=Math.max(1,Math.round(target.power/8));
        if(iAmA) war.aPts+=pts; else war.bPts+=pts;
        war.log=war.log||[]; war.log.push({ id:me.id, tx:me.name+' defeated '+target.name+' (+'+pts+' war points)', t:Date.now() }); if(war.log.length>60)war.log=war.log.slice(-60);
        if(war.npc){ war.bPts+=Math.max(1,Math.round(pts*(0.7+Math.random()*0.5))); } }
      writeDB(); return send(res,200,{ win, pts, coins, target:target.name, war:warView(g) }); }

    return send(res,404,{error:'not found'});
  }

  return send(res,404,{error:'not found'});
}

/* --------------------------- static PWA files ----------------------------- */
// serve a static asset: local file if present, otherwise proxy it from GAME_URL (so the repo can be tiny)
/* ---- v252 (audit P2, mobile perf): TEXT COMPRESSION ----
   The single-file client is ~1.7MB of HTML/JS. Brotli takes it to roughly a tenth of that, gzip to
   about a fifth — the single biggest first-load win on a phone, with no change to how the game is
   built or deployed. Compressed buffers are memoised per (file, size) so we compress once, not
   once per request. Binary art (png/webp/mp4) is already compressed and is served as-is. */
const COMPRESSIBLE=/^(text\/|application\/(json|javascript|manifest)|image\/svg)/;
const _zcache=new Map();   // key -> {enc, buf}
function pickEnc(req){ const a=String((req.headers&&req.headers['accept-encoding'])||'');
  if(/\bbr\b/.test(a)) return 'br';
  if(/\bgzip\b/.test(a)) return 'gzip';
  return null; }
function zbuf(key, enc, buf){
  const ck=enc+':'+key+':'+buf.length;
  const hit=_zcache.get(ck); if(hit) return hit;
  let out;
  try{ out = enc==='br'
    ? zlib.brotliCompressSync(buf,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]:buf.length}})
    : zlib.gzipSync(buf,{level:6}); }catch(e){ return null; }
  if(_zcache.size>40) _zcache.clear();
  _zcache.set(ck,out); return out; }
function sendBody(req,res,buf,type,cacheCtl,key){
  const head={'Content-Type':type,'Cache-Control':cacheCtl};
  const enc=(type&&COMPRESSIBLE.test(type)&&buf.length>1024)?pickEnc(req):null;
  if(enc){ const z=zbuf(key||type, enc, buf);
    if(z){ head['Content-Encoding']=enc; head['Vary']='Accept-Encoding'; res.writeHead(200,head); res.end(z); return; } }
  res.writeHead(200,head); res.end(buf); }
function serveFile(res, file, type, urlPath, req){ fs.readFile(path.join(__dirname,file),(e,buf)=>{
  if(!e){ if(req) return sendBody(req,res,buf,type,'no-cache',file);
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'}); res.end(buf); return; }
  remoteAsset(urlPath||('/'+file)).then(r=>{ if(!r){res.writeHead(404);res.end();return;}
    if(req) return sendBody(req,res,r.buf,type||r.ct,'no-cache',file);
    res.writeHead(200,{'Content-Type':type||r.ct,'Cache-Control':'no-cache'}); res.end(r.buf); }); }); }

const server=http.createServer((req,res)=>{
  // AUDIT (26 Aug, medium): baseline security headers on every response. CSP is limited to
  // frame-ancestors — the single-file game needs inline scripts, so a script-src policy would
  // require a full nonce refactor (deferred with the Phase-1 items).
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy',"frame-ancestors 'none'");
  _corsReqOrigin=String(req.headers.origin||'');
  const url=new URL(req.url,'http://x');
  const p=url.pathname;
  if(p.startsWith('/api/')) return api(req,res,url).catch(err=>{
    if(res.headersSent) return;
    if(err && err.code==='BODY_TOO_LARGE'){ send(res,413,{error:'Request too large.'}); try{req.destroy();}catch(_){} return; }
    console.error('⚠ api error:', err && err.message); return send(res,500,{error:'server error'}); });
  if(p==='/health'){ res.writeHead(200);res.end('ok');return; }
  if(p==='/sw.js') return serveFile(res,'sw.js','application/javascript');
  if(p==='/version.json'){ res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return fs.readFile(path.join(__dirname,'version.json'),(e,b)=>{ if(!e){res.end(b);return;} remoteAsset('/version.json').then(r=>res.end(r?r.buf:'{}')); }); }
  if(p==='/manifest.webmanifest') return serveFile(res,'manifest.webmanifest','application/manifest+json');
  // PWA icons live in assets/icons/ now (kept off the repo root); the public URLs stay the same.
  if(p==='/icon-192.png') return serveFile(res,'assets/icons/icon-192.png','image/png');
  if(p==='/icon-512.png') return serveFile(res,'assets/icons/icon-512.png','image/png');
  if(p==='/icon-512-maskable.png') return serveFile(res,'assets/icons/icon-512-maskable.png','image/png');
  if(p==='/apple-touch-icon.png') return serveFile(res,'assets/icons/apple-touch-icon.png','image/png');
  if(p==='/patchnotes.json') return serveFile(res,'patchnotes.json','application/json',null,req);
  // static asset folder: images, icons, animation sheets. Served straight from the repo (local file first,
  // GAME_URL proxy as a fallback) so the game HTML can stay tiny — the images live here, not baked into the page.
  if(p.startsWith('/assets/')){
    const rel=path.normalize(p.replace(/^\/+/,''));                 // strip leading slash, collapse the path
    if(rel.indexOf('..')!==-1 || p.indexOf('\0')!==-1){ res.writeHead(400); res.end(); return; }
    const ext=path.extname(rel).toLowerCase();
    const MIME={'.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.json':'application/json','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.ttf':'font/ttf'};
    const type=MIME[ext]||'application/octet-stream';
    // v252: art is immutable per deploy (?v= cache-busters + the service worker own invalidation),
    // so it gets a 30-day cache instead of a daily revalidation round-trip on every phone launch.
    const CC=COMPRESSIBLE.test(type)?'public, max-age=86400':'public, max-age=2592000, immutable';
    return fs.readFile(path.join(__dirname,rel),(e,buf)=>{
      if(!e) return sendBody(req,res,buf,type,CC,rel);
      remoteAsset('/'+rel).then(r=>{ if(!r){res.writeHead(404);res.end();return;} sendBody(req,res,r.buf,type||r.ct,CC,rel); });
    });
  }
  // marketing site at the bare root; the game lives at /play and on deep links (/?room=..., etc.)
  if(p==='/' && !url.search) return serveFile(res,'emberweave-site.html','text/html; charset=utf-8',null,req);
  // everything else (/play, /?room deep links, other paths) -> the game (local file if bundled, else GAME_URL).
  fs.readFile(GAME_FILE,(e,buf)=>{ if(!e){ return sendBody(req,res,buf,'text/html; charset=utf-8','no-cache, must-revalidate','game'); }
    remoteAsset('/').then(r=>{ if(!r){res.writeHead(502);res.end('Game source unavailable. Set GAME_URL to your game link.');return;}
      sendBody(req,res,r.buf,'text/html; charset=utf-8','no-cache, must-revalidate','game'); }); });
});

/* ---------------------- live PvP: 2-player room relay ---------------------- */
let WSS=null;
try{
  const WebSocketServer = require('ws').Server;
  WSS = new WebSocketServer({ server, maxPayload: +(process.env.WS_MSG_MAX||16384) });   // RE-AUDIT: cap enforced at the protocol layer, not just after parse
  const rooms = {};   // code -> { host, guest }
  const roomCode = ()=>{ let c; do{ c=crypto.randomBytes(3).toString('hex').toUpperCase().slice(0,5); }while(rooms[c]); return c; };
  const wsend = (ws,o)=>{ try{ if(ws && ws.readyState===1) ws.send(JSON.stringify(o)); }catch(e){} };
  // ---- WebSocket security (audit crit #8): sockets used to be fully unauthenticated — any socket
  //      could claim any name, create rooms, and whisper as anyone. We now (a) size-cap and rate-limit
  //      every frame, (b) bind the socket to an account when it presents a valid token and DERIVE the
  //      chat name from that account (so it can't be spoofed), and (c) optionally REQUIRE that token.
  //      The hard requirement is behind WS_AUTH_REQUIRED and defaults OFF so the current live client
  //      (which doesn't send a token yet) keeps working; flip it to 'true' once the game HTML is
  //      updated to send {token} on connect. The size/rate caps and name-from-token apply always. ----
  const WS_AUTH_REQUIRED = String(process.env.WS_AUTH_REQUIRED||'true')==='true';   // ON by default since 26 Aug — the client now sends its token on every WS frame; set env false only as an emergency rollback
  const WS_MSG_MAX = +(process.env.WS_MSG_MAX || 16384);   // per-frame byte cap (replay chips already capped at 8000)
  function wsAccount(m){ const id=lookupToken(m&&m.token); return id?DB.users[id]:null; }
  function wsRateOk(ws, isAct){ if(isAct===2) return true; const now=Date.now(); ws._hits=(ws._hits||[]).filter(t=>now-t<10000); ws._hits.push(now); return ws._hits.length<=(isAct?160:40); }   // act frames: 16/s (> ACT_PER_SEC=8 + speed/stall); abandon is never dropped
  function wsNeedAuth(ws){ if(WS_AUTH_REQUIRED && !ws._uid){ wsend(ws,{t:'autherr',reason:'Sign in required.'}); return true; } return false; }
  // ---- live chat: world/region broadcast + name-addressed whispers ----
  // history is stored in the DB (persists across restarts) and kept for ~3h or the last 100 messages per channel
  const CHAT_KEEP=100, CHAT_AGE_MS=6*3600000;   // world/region chat messages disappear 6h after being typed
  const clip = (s,n)=> String(s==null?'':s).slice(0,n);
  function chatStore(){ if(!DB.chat)DB.chat={world:[],region:[]}; if(!Array.isArray(DB.chat.world))DB.chat.world=[]; if(!Array.isArray(DB.chat.region))DB.chat.region=[]; return DB.chat; }
  function pruneChat(ch){ const now=Date.now(), st=chatStore(); let a=st[ch].filter(m=>!m.t||(now-m.t)<CHAT_AGE_MS); if(a.length>CHAT_KEEP)a=a.slice(a.length-CHAT_KEEP); st[ch]=a; return a; }
  const chatBroadcast = (o,except)=>{ const j=JSON.stringify(o); WSS.clients.forEach(c=>{ try{ if(c!==except && c.readyState===1) c.send(j); }catch(e){} }); };
  WSS.on('connection', ws=>{
    ws.on('message', raw=>{ if(raw && raw.length>WS_MSG_MAX) return; let m; try{ m=JSON.parse(raw.toString()); }catch(e){ return; }
      const _isAct=(m && m.t==='act') ? (String(m.kind||'')==='abandon' ? 2 : 1) : 0;
      if(!wsRateOk(ws, _isAct)){ if(_isAct) wsend(ws,{t:'actack', seq:(m.seq|0), ok:false, reason:'rate'}); return; }
      // RE-AUDIT (26 Aug): the token is REVALIDATED on every frame (the client sends it on every
      // frame since v215). A revoked/expired token — or a frame that stops presenting one — unbinds
      // the socket immediately instead of riding a stale ws._uid.
      const _acct=wsAccount(m);
      if(_acct){ ws._uid=_acct.id; ws._acctName=_acct.name; }
      else { ws._uid=null; ws._acctName=null;
        // RE-AUDIT round 3: a socket whose token just failed must not keep its PvP room either —
        // tell the peer and dissolve the room so relaying stops immediately, not at disconnect.
        if(WS_AUTH_REQUIRED && ws._room){ const r=rooms[ws._room];
          if(r){ const peer=(r.host===ws)?r.guest:r.host; if(peer) wsend(peer,{t:'peerleft'}); delete rooms[ws._room]; }
          ws._room=null; ws._role=null; } }
      /* ================= v274 — LIVE ACTION RECEIPTS (hardening directive §3) =================
         A transcript posted after the battle proves nothing: a modified client can watch the fight,
         then compose the perfect legal log. So each action is sent AS IT HAPPENS and the server
         receipts it. The server owns the sequence, stamps its own arrival time, checks the claimed
         sim tick is physically possible for the time elapsed, and extends a hash chain. At resolve,
         a session that streamed is replayed from the SERVER'S accepted list — the body's transcript
         is ignored. A late action, a repeat, a gap in the sequence or an impossible tick is refused
         with a reason, and the player's client is told.
         What this does NOT prove: that a human pressed the button rather than a real-time bot. That
         is honest and stated — the transcripts are kept for review, not scored by a skill ceiling. */
      if(m.t==='act'){
        if(wsNeedAuth(ws)) return;
        if(raw && raw.length>ACT_BYTES_MAX){ wsend(ws,{t:'actack', seq:(m.seq|0), ok:false, reason:'too-large'}); return; }
        const u=DB.users[ws._uid]; if(!u) return;
        const r=streamAction(u, m, ws);
        wsend(ws, Object.assign({t:'actack', seq:(m.seq|0)}, r));
        return;
      }
      if(m.t==='host'){ if(wsNeedAuth(ws)) return; const c=roomCode(); rooms[c]={host:ws,guest:null,t:Date.now()}; ws._room=c; ws._role='host'; wsend(ws,{t:'hosted',code:c}); }
      else if(m.t==='join'){ if(wsNeedAuth(ws)) return; const c=(m.code||'').toUpperCase(); const r=rooms[c];
        if(!r){ wsend(ws,{t:'joinfail',reason:'no such room'}); return; }
        if(r.guest){ wsend(ws,{t:'joinfail',reason:'room full'}); return; }
        r.guest=ws; ws._room=c; ws._role='guest'; r.t=Date.now(); wsend(ws,{t:'joined',code:c}); wsend(r.host,{t:'peerjoined'}); }
      else if(m.t==='msg'){ if(wsNeedAuth(ws)) return;   // RE-AUDIT round 3: the room relay was the one branch that skipped auth — a revoked token could keep relaying
        const r=rooms[ws._room]; if(!r)return; r.t=Date.now(); wsend(ws._role==='host'?r.guest:r.host,{t:'peer',data:m.data}); }
      else if(m.t==='chatjoin'){ if(wsNeedAuth(ws)) return; ws._chatName=ws._acctName || clip(m.name,16)||'Player'; wsend(ws,{t:'chathist',world:pruneChat('world'),region:pruneChat('region')}); }
      else if(m.t==='chat'){ if(wsNeedAuth(ws)) return; const ch=(m.channel==='region')?'region':'world'; const txt=clip(m.text,200); if(!txt)return; const msg={who:ws._acctName||ws._chatName||'Player',txt,t:Date.now()};
        let bt=null; try{ if(m.battle && typeof m.battle==='object'){ const s=JSON.stringify(m.battle); if(s.length<=8000) bt=JSON.parse(s); } }catch(e){}   // optional shared-replay chip (size-capped)
        if(bt) msg.battle=bt;
        chatStore()[ch].push(msg); pruneChat(ch); writeDB();
        chatBroadcast({t:'chatmsg',channel:ch,who:msg.who,txt:msg.txt,battle:bt||undefined}, ws); }   // broadcast to everyone EXCEPT the sender (sender shows it instantly locally)
      else if(m.t==='whisper'){ if(wsNeedAuth(ws)) return; const to=clip(m.to,16), txt=clip(m.text,200); if(!to||!txt)return;
        const fromName=ws._acctName||ws._chatName||'Player';
        WSS.clients.forEach(c=>{ if(c!==ws && c._chatName===to && c.readyState===1){ try{ c.send(JSON.stringify({t:'whispermsg',from:fromName,txt})); }catch(e){} } }); }
    });
    ws.on('close', ()=>{ const r=rooms[ws._room]; if(!r)return; wsend(ws._role==='host'?r.guest:r.host,{t:'peerleft'}); delete rooms[ws._room]; });
    ws.on('error', ()=>{});
  });
  // expire idle PvP rooms (audit: rooms were only cleaned on socket close, so a half-open room could linger)
  const _roomPrune=setInterval(()=>{ const now=Date.now();
    for(const c of Object.keys(rooms)){ if(now-(rooms[c].t||0) > 30*60000){ wsend(rooms[c].host,{t:'peerleft'}); wsend(rooms[c].guest,{t:'peerleft'}); delete rooms[c]; } } }, 5*60000);
  if(_roomPrune.unref) _roomPrune.unref();
}catch(e){ console.log('⚠ live PvP (ws) unavailable — run `npm install` to enable it. Async online still works.'); }

campCompile(); portalCompile(); vaultCompile(); readDB(); pgInit();
const BOOT_FILE_M=(function(){ try{ return fs.statSync(DB_FILE).mtimeMs; }catch(e){ return 0; } })();   // v327: sampled BEFORE seed()/migrations can refresh the file's mtime
/* v327 (critical): boot used to seed + writeDB() synchronously while the PG restore was still awaiting
   two network round-trips, so `fileM` was re-sampled AFTER the debounced boot write had already touched
   DB_FILE — got.mtime>fileM was never true, and that same write UPSERTed the empty seed over the saved
   world. Everything that persists is now suppressed until the restore decision lands, the mtime is
   sampled once up front, and seed()/backupDB()/listen happen exactly once, afterwards. */
function bootFinish(){ if(_booted) return; _booted=true; PG_BOOT_PENDING=false;
  seed(); migrateAdminRoles(); migrateTokenHashes();   // stamp role:admin from ADMIN_IDS; hash any plaintext tokens (v241: the Vault, like the Campaign, refuses to boot without its authored table)
  if(_bootDirty){ _bootDirty=false; writeDB(); }       // flush whatever the restore window suppressed
  backupDB(); setInterval(backupDB, 60*60*1000);   // snapshot on boot, then hourly (keeps ~48)
    setTimeout(pushBackupToGitHub, 30000); setInterval(pushBackupToGitHub, 6*60*60*1000);   // off-site GitHub backup: ~30s after boot, then every 6h (no-op unless GITHUB_BACKUP_TOKEN + GITHUB_BACKUP_REPO are set)
  const realAccts=Object.values(DB.users).filter(u=>!u.isNpc).length;
  console.log('📁 DB file: '+DB_FILE+'  '+(DB_PERSISTENT?'(persistent ✅)':'(⚠ EPHEMERAL — accounts WILL be wiped on redeploy! Add a Railway Volume mounted at /data, or set DB_FILE to a volume path.)'));
  console.log('👤 Player accounts loaded: '+realAccts);
  server.listen(PORT,()=>{ console.log('🔥 Emberweave cloud server on http://localhost:'+PORT); console.log('   Seeded '+Object.keys(DB.users).filter(id=>DB.users[id].isNpc).length+' NPC cities · live PvP '+(WSS?'ON':'off')+'. Open the URL to play / install the app.'); });
}
if(PG){ PG_BOOT_PENDING=true;   // nothing writes to disk or PG, and the port stays closed, until this resolves
  (async()=>{ try{ await pgSetup(); const got=await pgLoad();
    if(got && got.mtime>BOOT_FILE_M){ DB=got.db; console.log('🐘 World state loaded from PostgreSQL (newer than the file mirror).'); }
    else { _bootDirty=true; console.log(got===null?'🐘 PostgreSQL seeded from the current world state.':'🐘 File mirror is newer than PostgreSQL — keeping the file and re-publishing it.'); }
  }catch(e){ console.error('⚠ PG boot failed ('+e.message+') — continuing on the JSON file.'); }
    bootFinish(); })();
  setTimeout(function(){ if(!_booted) console.error('⚠ PG boot timed out after 15s — continuing on the JSON file.'); bootFinish(); }, 15000);
} else bootFinish();
// prune the in-memory rate-limiter map so old per-IP hit arrays don't accumulate forever (audit: high)
setInterval(()=>{ const now=Date.now(); for(const k of Object.keys(_hits)){ const arr=_hits[k].filter(t=>now-t<600000); if(arr.length) _hits[k]=arr; else delete _hits[k]; } }, 10*60000);
