// v1142 (Phil 15 Oct 2026) - the Diamond wish table and the Ember Roast stamina item.
// Phil's table, one roll per Diamond wish: 3 % full 3-star hero · 10 % full 2-star hero · 17 % 2-3 fragments of a 3-star · 23 % 2-3 fragments of a 2-star ·
// 20 % a full glyph of the player's level · 10 % a full glyph of the NEXT level · 17 % an Ember Roast (120 stamina, kept on the ledger).
// Kept: the 40-wish pity, the guaranteed 2-star first wish, costs and the x10 price.
// Asserts (non-zero exit). CONTROL: AUD_SERVER=<the v1141 server copied into the repo root> must FAIL (old odds, no item, no route).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-wish1142-'));
const dbFile=path.join(dir,'db.json'), src=fs.readFileSync(path.join(root,srvFile),'utf8');
let port,base,child,token,id,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); console.log('  x '+m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<60&&child.exitCode===null;i++)await delay(50); child=null; }
let ip=0;   // the per-account wish limiter is 60 a minute; each call comes from its own (fixture) proxy address so 600 x10 wishes fit in one run
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token,'x-forwarded-for':'10.9.'+((ip>>8)&255)+'.'+(ip++&255)},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
async function editDB(fn){ await delay(400); await stop(); const db=disk(); fn(db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
const listOf=name=>{ const m=src.match(new RegExp('const '+name+'=(\\[[^\\]]*\\])')); return new Set(m?JSON.parse(m[1]):[]); };
const P2=listOf('POOL_P2'), P3=listOf('POOL_P3');
const LADDER=(()=>{ const m=src.match(/const GLYPH_LADDER=Object\.freeze\((\[[^\]]*\])\)/); return m?eval(m[1]):[]; })();
let rq=0; const R=()=>'w'+(rq++)+'-'+Date.now();
const TABLE={full3:0.03,full2:0.10,frag3:0.17,frag2:0.23,glyphFull:0.20,glyphNext:0.10,stamItem:0.17};
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'wish1142-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger');

  // ---- 1. the first Diamond wish is a 2-star hero ----
  await editDB(u=>{ u.led.camp.cleared=5; u.led.gems=5000000; });
  const first=await call('/api/pool/wish',{pool:'gem',n:1,requestId:R()});
  const f0=first.data.results&&first.data.results[0];
  ok(first.data.ok===true&&f0&&f0.type==='hero'&&P2.has(f0.hero),'the first Diamond wish is a full 2-star hero ('+JSON.stringify(f0)+')');

  // ---- 1b. pity at 40 still fires, on a hero the player does not own (the fixture still lacks most of the pool) ----
  await editDB(u=>{ u.led.pool.pity=38; });
  const pre=await call('/api/pool/wish',{pool:'gem',n:1,requestId:R()}), pr0=pre.data.results&&pre.data.results[0];
  ok(pre.data.ok===true&&(pr0.pity!==true),'the 39th wish is an ordinary roll ('+JSON.stringify(pr0)+')');
  if(pre.data.pity&&pre.data.pity.count!==39) await editDB(u=>{ u.led.pool.pity=39; });   // the 39th happened to be a new hero: set the count back to 39
  const owned=Object.assign({},(await led()).unlocked||{});
  const pw=await call('/api/pool/wish',{pool:'gem',n:1,requestId:R()}), p0=pw.data.results&&pw.data.results[0];
  ok(pw.data.ok===true&&p0&&p0.pity===true&&p0.type==='hero'&&(P2.has(p0.hero)||P3.has(p0.hero))&&!owned[p0.hero],'the 40th wish is the pity hero, one the player did not own ('+JSON.stringify(p0)+')');
  ok(pw.data.pity&&pw.data.pity.count===0,'pity resets after the guaranteed hero ('+JSON.stringify(pw.data.pity)+')');

  // ---- 2. the published odds are Phil's table ----
  const st=(await call('/api/pool/state')).data, o=st.odds||{};
  const sum=Object.keys(TABLE).reduce((a,k)=>a+(+o[k]||0),0);
  ok(Object.keys(TABLE).every(k=>o[k]===TABLE[k]),'/api/pool/state publishes Phil\'s Diamond table ('+JSON.stringify(o)+')');
  ok(Math.abs(sum-1)<1e-9,'the Diamond table sums to 100 % ('+sum+')');
  ok(st.pity&&st.pity.at===40&&st.costs&&st.costs.gem===300&&st.costs.mult10===9,'pity 40, 300 diamonds a wish, x10 for 9 ('+JSON.stringify({pity:st.pity,costs:st.costs})+')');

  // ---- 3. roll the Diamond Pool 6,000 times (600 x10) and measure ----
  const N10=600, cnt={full3:0,full2:0,frag3:0,frag2:0,glyphFull:0,glyphNext:0,stamItem:0,other:0}, other={}; let pity=0, rolls=0, items=0, badFrag=0, badTier=0;
  const L0=await led(), gems0=L0.gems, top=0;   // the fixture's heroes are all at the first glyph tier (Grey)
  for(let i=0;i<N10;i++){ const r=await call('/api/pool/wish',{pool:'gem',n:10,requestId:R()});
    if(!r.data.ok){ console.log('wish refused',r.status,r.data); break; }
    for(const x of r.data.results){ rolls++;
      if(x.pity){ pity++; continue; }   // a pity hero is the guarantee, not the table
      if(x.type==='hero'||x.type==='dupe') cnt[P3.has(x.hero)?'full3':'full2']++;
      else if(x.type==='frags'){ cnt[P3.has(x.hero)?'frag3':'frag2']++; if(!(x.frags>=2&&x.frags<=3)) badFrag++; }
      else if(x.type==='glyphFull'||x.type==='glyphFrag'){ cnt[x.next?'glyphNext':'glyphFull']++; if(x.q!==LADDER[Math.min(top+(x.next?1:0),LADDER.length-1)]) badTier++; }
      else if(x.type==='stamItem'){ cnt.stamItem++; items++; }
      else { cnt.other++; other[x.type]=(other[x.type]||0)+1; } } }
  const L1=await led(), table=rolls-pity;
  ok(rolls===N10*10&&gems0-L1.gems===N10*300*9,rolls+' Diamond wishes in tens cost 300 x 9 each ten ('+(gems0-L1.gems)+' diamonds)');
  ok(cnt.other===0,'every Diamond result is on Phil\'s table - no diamonds, no Blue/Green glyph fragments ('+JSON.stringify(other)+')');
  console.log('  measured over '+table+' table rolls ('+pity+' pity heroes left out):');
  for(const k of Object.keys(TABLE)){ const f=cnt[k]/table, sd=Math.sqrt(TABLE[k]*(1-TABLE[k])/table), tol=Math.max(4*sd,0.01);
    console.log('    '+k.padEnd(10)+' target '+(TABLE[k]*100).toFixed(1).padStart(5)+' %  measured '+(f*100).toFixed(2).padStart(6)+' %  (tolerance +-'+(tol*100).toFixed(2)+')');
    ok(Math.abs(f-TABLE[k])<=tol,k+' lands on '+(TABLE[k]*100)+' % ('+(f*100).toFixed(2)+' %)'); }
  ok(badFrag===0,'every hero-fragment prize is 2-3 fragments ('+badFrag+' outside)');
  ok(badTier===0,'a level glyph is the top tier ('+LADDER[top]+'), a next-level glyph is the tier above ('+LADDER[top+1]+') ('+badTier+' wrong)');
  // the ledger gain over the batch, not the raw total: the 39th wish in 1b is an ordinary roll and is itself an Ember Roast 17 % of the time,
  // which sat on the ledger before L0 and made this read 1 over (16 Oct 2026, 1 run in 4 - never a double credit)
  const gained=(L1.stamItems|0)-(L0.stamItems|0);
  ok(gained===items&&items>0,'every Ember Roast that dropped in the batch is held on the ledger (+'+gained+' of '+items+', '+(L0.stamItems|0)+' held before)');

  // ---- 5. the Ember Roast: +120, spends one, refuses at 0, a replayed requestId pays once ----
  await editDB(u=>{ u.led.stamItems=2; u.led.stam={v:500,ts:Date.now()}; });
  let L=await led(); ok((L.stamItems|0)===2&&L.stamina.v===500,'fixture: 2 Ember Roasts, 500 stamina ('+L.stamItems+', '+L.stamina.v+')');
  const rid=R(), u1=await call('/api/stamina/use-item',{requestId:rid}); L=await led();
  ok(u1.status===200&&u1.data.ok===true&&L.stamina.v===620&&L.stamItems===1,'one Ember Roast adds exactly 120 stamina and spends one (500 -> '+L.stamina.v+', items '+L.stamItems+')');
  const u1b=await call('/api/stamina/use-item',{requestId:rid}); L=await led();
  ok(JSON.stringify(u1b.data)===JSON.stringify(u1.data)&&L.stamina.v===620&&L.stamItems===1,'a replayed requestId returns the same receipt and pays once ('+L.stamina.v+', items '+L.stamItems+')');
  const nr=await call('/api/stamina/use-item',{}); ok(nr.status===400,'no requestId is refused ('+nr.status+')');
  const u2=await call('/api/stamina/use-item',{requestId:R()}); L=await led();
  ok(u2.data.ok===true&&L.stamina.v===740&&L.stamItems===0,'the second roast adds 120 more (740: '+L.stamina.v+', items '+L.stamItems+')');
  const u3=await call('/api/stamina/use-item',{requestId:R()}); L=await led();
  ok(u3.status===400&&u3.data.ok===false&&L.stamina.v===740&&L.stamItems===0,'at 0 roasts the use is refused and nothing changes ('+u3.status+' '+(u3.data.error||'')+')');
  await editDB(u=>{ u.led.stamItems=1; u.led.stam={v:999,ts:Date.now()}; });
  const u4=await call('/api/stamina/use-item',{requestId:R()}); L=await led();
  ok(u4.data.ok===false&&L.stamItems===1,'at full stamina (999) the roast is kept, as a meal refuses ('+(u4.data.error||'')+')');

  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_wish_odds_1142.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
