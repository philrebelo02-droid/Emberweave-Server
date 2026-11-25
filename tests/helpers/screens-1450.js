'use strict';
/* Lockdown audit 25 Nov 2026 (v1450 on-screen lines): shared rig for the test_screens_*_1450.js browser tests.
   This checkout's server on a temp DB and a free port, one seeded signed-in player (the page reads its session from localStorage
   'ew_acc'), and headless Chromium on software rendering (SwiftShader), so it runs on the suite CTs. Never touches a live database. */
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),cp=require('child_process'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..','..');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const STEP=JSON.parse(/const D_HERO_STEP=(\[[^\]]+\])/.exec(fs.readFileSync(path.join(ROOT,'server.js'),'utf8'))[1]);
const xpFor=level=>{ let x=0; for(let L=2;L<=level;L++) x+=STEP[L-2]; return x; };
const TEMPLE=require(path.join(ROOT,'server/temple-of-ash.js'));
const TOKEN='screens-1450-token', UID='screens-1450-user', NAME='Screen Check';
const FLAGS={ALLOW_NEW_GUESTS:'1',VAULT_MIN_BATTLE_MS:'0',DUNGEON_V2_ENABLED:'true',GEAR_V2_ENABLED:'true',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',GLYPH_RL_PER_MIN:'1000',RL_MUL:'1000',SIM_WORKERS:'0',TALENTS_ENABLED:'true'};

/* heroes: {key: level}. extra(user) may change the seeded user before it is written. */
function seedDB(heroes,extra){ const start=Date.now();
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-screens-1450-')), file=path.join(dir,'db.json');
  const hero={}, unlocked={}; for(const [k,lv] of Object.entries(heroes)){ hero[k]={xp:xpFor(lv),stars:1,pips:0,ref:0}; unlocked[k]=true; }
  const keys=Object.keys(heroes).slice(0,5);
  const user={id:UID,name:NAME,created:start-1000,rank:1,coins:0,team:keys,wall:keys,roster:{},qc:{wish:0},
    led:{v:1,migratedAt:start-1000,rev:1,gold:100000,gems:1000,px:2000000000,hero,unlocked,frags:{},camp:{cleared:20,stars:{},att:null},stam:{v:60,ts:start},
      temple:TEMPLE.newState(),txs:[],quests:{claimed:{},chainStep:0},tutDone:true,tutSkipped:true}};
  if(extra) extra(user);
  fs.writeFileSync(file,JSON.stringify({users:{[UID]:user},byName:{[NAME.toLowerCase()]:UID},tokens:{[crypto.createHash('sha256').update(TOKEN).digest('hex')]:{id:UID,iat:start,exp:start+90*86400000}},
    seeded:true,seedVersion:3,heroIdV:3,guilds:{},idem:{},feedback:[],reports:[],meta:{rollSecret:'screens-1450'}}));
  return {dir,file}; }

async function freePort(){ const s=net.createServer(); await new Promise(r=>s.listen(0,'127.0.0.1',r)); const p=s.address().port; await new Promise(r=>s.close(r)); return p; }

async function server(file,env){ const port=await freePort(); let log='';
  const e={...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:file,NODE_ENV:'test',GAME_URL:'http://127.0.0.1:1',...FLAGS,...(env||{})}; delete e.CLOCK_FILE;
  const child=cp.spawn(process.execPath,[path.join(ROOT,'server.js')],{cwd:ROOT,windowsHide:true,stdio:['ignore','pipe','pipe'],env:e});
  child.stdout.on('data',x=>{ log+=x; if(log.length>200000) log=log.slice(-100000); }); child.stderr.on('data',x=>{ log+=x; if(log.length>200000) log=log.slice(-100000); });
  const base='http://127.0.0.1:'+port;
  for(let i=0;;i++){ if(child.exitCode!==null) throw new Error('server exited: '+log.slice(-2000)); try{ if((await fetch(base+'/api/health')).ok) break; }catch(_){} if(i>1200) throw new Error('server not ready: '+log.slice(-1000)); await wait(100); }
  const stop=async()=>{ if(child.exitCode===null) await new Promise(r=>{ child.once('exit',r); child.kill(); }); };
  const api=async(p,method,body)=>{ const r=await fetch(base+p,{method:method||'GET',headers:{'content-type':'application/json','x-token':TOKEN},body:body?JSON.stringify(body):undefined}); let j=null; try{ j=await r.json(); }catch(_){} return {status:r.status,body:j}; };
  return {port,base,stop,api,log:()=>log,disk:()=>JSON.parse(fs.readFileSync(file,'utf8')).users[UID]}; }

let _browser=null;
async function browser(){ if(_browser) return _browser; const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
  _browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']}); return _browser; }
async function closeBrowser(){ if(_browser){ try{ await _browser.close(); }catch(_){} _browser=null; } }

/* the game, signed in as the seeded player, at w x h (touch = a phone), in language lang */
async function game(port,o){ o=o||{}; const b=await browser(); const w=o.w||1280, h=o.h||720, touch=!!o.touch, lang=o.lang||'en';
  const ctx=await b.newContext(Object.assign({viewport:{width:w,height:h},locale:lang==='en'?'en-US':lang},touch?{hasTouch:true,isMobile:true,deviceScaleFactor:2}:{}));
  await ctx.addInitScript(([tok,uid,name,lang])=>{ try{ localStorage.setItem('ew_acc',JSON.stringify({token:tok,name,rank:1,coins:0,id:uid,created:Date.now()-1000})); localStorage.setItem('ew_lang',lang); localStorage.setItem('ew_guest_step_'+uid,'1'); }catch(e){}
    const Px=new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:(k===Symbol.toPrimitive?()=>0:(['value','currentTime','sampleRate'].includes(k)?0:Px)),apply:()=>Px,construct:()=>Px,set:()=>true});
    window.AudioContext=function(){ return Px; }; window.webkitAudioContext=window.AudioContext; },[TOKEN,UID,NAME,lang]);
  const pg=await ctx.newPage(); pg._errs=[]; pg.on('pageerror',e=>pg._errs.push(String(e.message)));
  pg.on('dialog',d=>d.dismiss().catch(()=>{}));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await pg.goto('http://127.0.0.1:'+port+'/play',{waitUntil:'domcontentloaded',timeout:180000});
  await pg.waitForFunction(()=>typeof renderHeroDetail==='function'&&typeof api==='function'&&typeof adoptLedger==='function'&&typeof LANG==='object',null,{timeout:180000});
  await wait(1500); await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await wait(1000);
  const ok=await pg.evaluate(async()=>{ G.tutSkipped=true; G.tutDone=true; G.ftutOff=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); const d=await ledgerSync(); return !!(d&&ACC.token); });
  if(!ok) throw new Error('could not sign in as the seeded player');
  /* the account's language travels in the cloud save (an earlier context saved 'en'): pick the language the way Settings does */
  await pg.evaluate(l=>langSet(l,{save:true}),lang);
  if(lang!=='en') await pg.waitForFunction(l=>LANG.cur===l&&LANG.dict&&Object.keys(LANG.dict).length>100,lang,{timeout:60000});
  pg._ctx=ctx; return pg; }
const clean=pg=>pg.evaluate(()=>{ document.querySelectorAll('#tutOffer,.ftutOv,#ftutOv').forEach(n=>n.remove()); [...document.querySelectorAll('button')].filter(b=>/Got it/.test(b.textContent)&&b.offsetParent).forEach(b=>b.click()); });

/* checks: every check prints its measured values; a failed check sets the exit code. KNOWN-BUG lines report an open bug that is being
   fixed on another branch: printed, counted, never a silent pass. */
function checker(name){ let pass=0, fail=0, known=0; const lines=[];
  const ok=(c,msg,vals)=>{ const t=(c?'  ok   ':'  ✗ ')+msg+(vals!==undefined?'  ['+(typeof vals==='string'?vals:JSON.stringify(vals))+']':''); console.log(t); c?pass++:fail++; return c; };
  const bug=(hit,msg,vals)=>{ const t=(hit?'  KNOWN-BUG  ':'  ok   (known bug not seen) ')+msg+(vals!==undefined?'  ['+(typeof vals==='string'?vals:JSON.stringify(vals))+']':''); console.log(t); if(hit) known++; else pass++; };
  /* WATCH: seen only under the suite's emulated touch (not a confirmed bug): printed with the evidence for a real-phone look, never a pass */
  let watch=0; const look=(msg,vals)=>{ console.log('  WATCH  '+msg+(vals!==undefined?'  ['+(typeof vals==='string'?vals:JSON.stringify(vals))+']':'')); watch++; };
  const done=()=>{ console.log(name+': PASS: '+pass+'  FAIL: '+fail+'  KNOWN-BUGS: '+known+'  WATCH: '+watch); process.exitCode=fail?1:0; };
  return {ok,bug,look,done,get fail(){ return fail; }}; }

module.exports={ROOT,wait,xpFor,seedDB,server,game,browser,closeBrowser,clean,checker,TOKEN,UID};
