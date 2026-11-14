'use strict';
/* Load a server.js source IN THIS PROCESS (the wrapper tests/talents-line.test.js uses), keep its request handler, and call routes
   on it with fake request / response objects. No port, no interval timers; a short setTimeout (a group save's gap) still runs.
   Randomness is pinned per call: crypto.randomBytes and Math.random draw from one seeded stream that is reset before every call, so
   two server sources given the same requests in the same order draw the same seeds (the Arena seed is uid() = randomBytes(8)).
   env: extra process.env for the load (flags, SIM_WORKERS...). The world is a throwaway DB file in a temp folder.
   Usage: const S=load(src,{REAL_ENGINE_ARENA:'true'}); S.seedDB(fn); const r=await S.call('/api/arena/result',body,token,detSeed); */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),Module=require('node:module'),crypto=require('node:crypto'),EventEmitter=require('node:events');
const root=path.resolve(__dirname,'..','..');
const dirs=[]; process.on('exit',()=>{ for(const d of dirs) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
function mulberry(a){ return ()=>{ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
const realRB=crypto.randomBytes, realRandom=Math.random;
function pin(seed){ const r=mulberry(seed>>>0);
  crypto.randomBytes=function(n,cb){ const b=Buffer.alloc(n); for(let i=0;i<n;i++) b[i]=Math.floor(r()*256); if(typeof cb==='function'){ process.nextTick(cb,null,b); return; } return b; };
  Math.random=r; }
function unpin(){ crypto.randomBytes=realRB; Math.random=realRandom; }
const EXPORTS=['api','_reqCtx','getDB:()=>DB','campaignHeroSpec','ensureLedger','D_HERO_CUM','D_TROOP_CUM','simHost','arenaRealFight','tokHash','SIM_STATS','simPool',
  'getTournament','warAdvance','warNewMatch','warQualifyGuild','warLockMatch','warMatchOfGuild','LIVE_STATS','snapshotHeroFromServer','npcRealSpec','npcRealFoe','NPC_REAL_K','srvSeed','siegeRealFoe'];
function load(src,env){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-inproc-')); dirs.push(tmp);
  const saved={}; const set=(k,v)=>{ if(!(k in saved)) saved[k]=process.env[k]; if(v==null) delete process.env[k]; else process.env[k]=String(v); };
  set('DB_FILE',path.join(tmp,'db.json')); set('PORT','0'); set('DATABASE_URL',''); set('NODE_ENV','test'); process.env.SIM_WORKERS=(env&&env.SIM_WORKERS!=null)?String(env.SIM_WORKERS):'0';
  for(const k of ['TALENTS_ENABLED','REAL_ENGINE_ARENA','REAL_ENGINE_SKYFALL','REAL_ENGINE_NPC_CASTLE','REAL_ENGINE_HIT_TIMING','REAL_ENGINE_SIEGE','REAL_ENGINE_TRIAL','REAL_ENGINE_VAULT','REAL_ENGINE_BONUS']) set(k,null);
  for(const k in (env||{})) set(k,env[k]);
  const http=require('http'), fakeHttp=Object.assign({},http,{createServer:()=>({listen(){},on(){},prependListener(){},close(){},address(){ return {port:0}; },setTimeout(){},keepAliveTimeout:0,headersTimeout:0})});
  const req=Module.createRequire(path.join(root,'server.js')), myReq=n=>n==='http'?fakeHttp:req(n);
  const noop=()=>({unref(){},ref(){}});
  const shortTimeout=(fn,ms,...a)=>{ if((+ms||0)<=10000){ return setTimeout(fn,ms,...a); } return noop(); };
  const log=console.log, warn=console.warn; console.log=()=>{}; console.warn=()=>{};
  let S;
  try{
    const ex=EXPORTS.map(e=>e.includes(':')?e:(e+':(typeof '+e+'!=="undefined"?'+e+':null)')).join(',');
    const wrap=vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){'+src+'\n;return {'+ex+'};})',{filename:'server.js'});
    const m={exports:{}};
    S=wrap(m.exports,myReq,m,path.join(root,'server.js'),root,noop,shortTimeout);
  } finally{ console.log=log; console.warn=warn; for(const k in saved){ if(saved[k]===undefined) delete process.env[k]; else process.env[k]=saved[k]; } }
  S.dir=tmp;
  /* a token for an account: written into the DB's token table exactly as a sign-in stores it */
  S.token=(id)=>{ const DB=S.getDB(); const t='tok-'+id; DB.tokens=DB.tokens||{}; DB.tokens[crypto.createHash('sha256').update(t).digest('hex')]={id,iat:Date.now(),exp:Date.now()+86400000}; return t; };
  S.call=(route,packet,token,seed,ip)=>new Promise((resolve,reject)=>{
    const rq=new EventEmitter(); rq.method=packet?'POST':'GET'; rq.url=route; rq.headers={'content-type':'application/json','x-token':token||''}; rq.socket={remoteAddress:ip||'127.0.0.1'};
    rq.pause=()=>{}; rq.destroy=()=>{};
    const rs={statusCode:200,headersSent:false,_h:{},setHeader(k,v){ this._h[k]=v; },getHeader(k){ return this._h[k]; },removeHeader(){},
      writeHead(c,h){ this.statusCode=c; if(h) Object.assign(this._h,h); this.headersSent=true; },write(){},
      end(d){ unpin(); this.headersSent=true; let j=null; try{ j=JSON.parse(Buffer.isBuffer(d)?d.toString('utf8'):String(d||'')); }catch(e){ j={raw:String(d||'')}; } resolve({status:this.statusCode,data:j}); }};
    pin(seed==null?1:seed);
    let url; try{ url=new URL(route,'http://x'); }catch(e){ unpin(); return reject(e); }
    Promise.resolve(S._reqCtx.run({},()=>S.api(rq,rs,url))).catch(e=>{ unpin(); reject(e); });
    setImmediate(()=>{ if(packet) rq.emit('data',Buffer.from(JSON.stringify(packet))); rq.emit('end'); });
  });
  return S;
}
module.exports={ load, root, pin, unpin };
