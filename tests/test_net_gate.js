// 4 Oct 2026 v1018 - Phil: "players should not be able to play offline, server needs to be connected to play".
// (1) Client: the net gate blocks the game when the server is unreachable (two failed checks), while no session exists, and for a
//     signed-out player anywhere but the sign-in screen; a connected session sees no gate. Runs the page's own netGateUpdate.
// (2) Server: a NEW account starts from the starter ledger - a forged save sent with /api/guest or /api/register is never progress
//     (M13); /api/health answers (the gate's check; /api/ paths bypass the service worker cache).
// Asserts (non-zero exit). Control: AUD_SERVER=<pre-fix server> and AUD_PAGE=<pre-fix page> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),vm=require('vm'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', page=process.env.AUD_PAGE||path.join(root,'emberweave-heroes.html');
const control=!!(process.env.AUD_SERVER||process.env.AUD_PAGE);
let pass=0, missed=[]; const ok=(c,m)=>{ if(control&&!c){ missed.push(m); return; } assert(c,m); pass++; };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
(async()=>{ let child=null; try{
  /* ---- client ---- */
  const src=fs.readFileSync(page,'utf8'), a=src.indexOf('const NETGATE='), b=src.indexOf('async function netGateCheck',a);
  if(a<0||b<0){ ok(false,'the page has a net gate'); }
  else {
    const el={style:{display:'none'},dataset:{},innerHTML:'',innerText:'',querySelector:()=>({})};
    const ctx={window:{}, location:{protocol:'https:'}, document:{getElementById:()=>el, createElement:()=>el, body:{appendChild(){}}}, Date, setTimeout:()=>0, clearTimeout(){},
      ACC:{token:'t'}, state:'home', show(){}};
    vm.createContext(ctx); vm.runInContext('function online(){ return true; }'+src.slice(a,b)+';this.NG=NETGATE;this.up=netGateUpdate;',ctx);
    ctx.NG.bootAt=Date.now()-10000;
    ctx.up(); ok(el.style.display==='none','a connected session sees no gate');
    ctx.NG.down=2; ctx.up(); ok(el.style.display==='flex'&&/Connection lost/.test(el.innerHTML),'two failed checks block the game');
    ctx.NG.down=1; ctx.up(); ok(el.style.display==='none','one failed check (a blip) does not');
    ctx.NG.down=0; ctx.ACC={token:null}; ctx.up(); ok(el.style.display==='flex'&&/Connecting/.test(el.innerHTML),'no session blocks the game while one is provisioned');
    ctx.ACC={token:null,signedOut:true}; ctx.state='home'; ctx.up(); ok(el.style.display==='flex'&&/Sign in to play/.test(el.innerHTML),'a signed-out player cannot reach the town');
    ctx.state='account'; ctx.up(); ok(el.style.display==='none','the sign-in screen stays usable');
  }
  /* ---- server ---- */
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-netgate-')), port=await freePort(), base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:path.join(dir,'db.json')},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok) break; }catch(_){} await delay(100); }
  const h=await fetch(base+'/api/health'); let hj={}; try{ hj=await h.json(); }catch(_){}
  ok(h.status===200&&hj.ok===true,'/api/health answers ('+h.status+')');
  const forged=JSON.stringify({gold:5000,gems:250,playerXP:40000,heroXP:{vael:30000,sylthaine:30000,vireo:30000},campaignCleared:40,unlocked:{korvux:true}});
  const post=(p,b,tok)=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:JSON.stringify(b)}).then(r=>r.json());
  for(const [label,resp] of [['guest',await post('/api/guest',{deviceId:'ng-'+Date.now(),roster:{__save:forged}})],['register',await post('/api/register',{name:'ngForged',pass:'password1',roster:{__save:forged}})]]){
    const L=await fetch(base+'/api/ledger',{headers:{'x-token':resp.token}}).then(r=>r.json()), led=L.ledger||L;
    ok(led.gold===1000&&led.gems===300&&(led.px|0)===0&&!(led.unlocked||{}).korvux,'a new '+label+' starts from the starter ledger, not its uploaded save ('+JSON.stringify({gold:led.gold,gems:led.gems,px:led.px,korvux:!!(led.unlocked||{}).korvux})+')');
  }
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_net_gate.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+', page '+path.basename(page)+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { if(child){ child.kill(); await delay(300); } } })();
