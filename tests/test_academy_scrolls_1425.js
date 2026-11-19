// v1425 (Phil 19 Nov 2026: "Add little scrolls that reduce 1 hour time off academy cooldowns they can be earned by buying 1 every day from
// guild shop or in future events. Otherwise its 30 diamonds per hours reduced academy times if you dont have a scroll"):
// real server on a free port + temp DB.
//  - Guild Shop slot 15 Academy Scroll: 300 guild coins, ONE a game day, open in a level-1 guild; the scroll lands in the Academy store
//  - /api/academy shows the scrolls; /api/academy/speed {use:'scroll'} takes 1 hour off the research in progress and spends one scroll
//  - no scroll: refused, nothing moves; {use:'gems'} = 30 diamonds an hour; never more hours than are left; finishing applies the level
//  - nothing in progress: refused; the same requestId does not spend twice
'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-acscroll-')), dbFile=path.join(dir,'db.json');
let port,base,child,token,id,pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok   '+m); }, delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,ALLOW_NEW_GUESTS:'1',DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(const t0=Date.now();Date.now()-t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); } child=null; }
async function call(route,data){ const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status,data:j}; }
const led=async()=>{ const l=(await call('/api/ledger')).data; return l.ledger||l; };
async function editDB(fn){ await delay(300); await stop(); const db=JSON.parse(fs.readFileSync(dbFile,'utf8')); fn(db,db.users[id]); fs.writeFileSync(dbFile,JSON.stringify(db)); await start(); }
const H=3600000;
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const g=await call('/api/guest',{deviceId:'acscroll-'+Date.now()}); token=g.data.token; id=g.data.profile.id; await call('/api/ledger'); await call('/api/academy');
  // a level-1 guild, coins; the scroll is slot 15 (a level-1 guild unlocks only 4 slots - the scroll is open to every guild)
  await editDB((db,u)=>{ db.guilds=db.guilds||{}; db.guilds.g1={id:'g1',name:'G',members:[id],level:1,exp:0}; u.guildId='g1'; u.led.guildCoins=1000; u.led.gems=100; });
  const c0=await led();
  const b1=await call('/api/shop/buy',{what:'gshop:15',requestId:'sc-1'});
  const c1=await led(), a1=(await call('/api/academy')).data;
  ok(b1.data.ok===true&&c1.guildCoins===c0.guildCoins-300&&a1.scrolls===1,'level-1 guild buys an Academy Scroll: -300 guild coins, 1 scroll in the Academy ('+(b1.data.error||'scrolls '+a1.scrolls)+')');
  ok(a1.speedGemsPerHour===30,'the Academy read says 30 diamonds an hour');
  const b2=await call('/api/shop/buy',{what:'gshop:15',requestId:'sc-2'}); const c2=await led();
  ok(b2.data.ok===false&&/restocks tomorrow/.test(b2.data.error||'')&&c2.guildCoins===c1.guildCoins,'a second one the same day is refused, no coins taken ('+(b2.data.error||'')+')');
  ok(c2.gshopLeft&&c2.gshopLeft[15]===0,'the ledger shows 0 left today for slot 15');
  // nothing in progress
  const n0=await call('/api/academy/speed',{use:'scroll',requestId:'sp-none'});
  ok(n0.data.ok===false&&/No research/.test(n0.data.error||''),'speeding up with nothing in progress is refused ('+(n0.data.error||'')+')');
  // a research with 3 h 20 min left, plus a second scroll (as an event would grant)
  const T=Date.now()+3*H+20*60000;
  await editDB((db,u)=>{ u.led.acad.lv.academy=5; u.led.acad.learn={atk:T}; u.led.acad.scrolls=2; u.led.gems=100; });
  const s1=await call('/api/academy/speed',{use:'scroll',requestId:'sp-1'});
  ok(s1.data.ok===true&&s1.data.scrolls===1&&Math.abs(s1.data.learn.atk-(T-H))<5,'a scroll takes exactly 1 hour off and is spent ('+(s1.data.error||JSON.stringify(s1.data).slice(0,120))+')');
  const s1b=await call('/api/academy/speed',{use:'scroll',requestId:'sp-1'});
  ok(s1b.data.scrolls===1&&s1b.data.learn.atk===s1.data.learn.atk,'the same requestId does not spend a second scroll');
  await call('/api/academy/speed',{use:'scroll',requestId:'sp-2'});
  const s3=await call('/api/academy/speed',{use:'scroll',requestId:'sp-3'});
  ok(s3.data.ok===false&&/enough Academy Scrolls/.test(s3.data.error||''),'out of scrolls: refused ('+(s3.data.error||'')+')');
  // diamonds: 30 per hour
  const g0=await led(); const d1=await call('/api/academy/speed',{use:'gems',hours:1,requestId:'sp-g1'}); const g1=await led();
  ok(d1.data.ok===true&&g1.gems===g0.gems-30&&Math.abs(d1.data.learn.atk-(T-3*H))<5,'1 hour for 30 diamonds ('+(d1.data.error||'gems '+g0.gems+'->'+g1.gems)+')');
  // 20 min left: asking for 5 hours charges ONE (never more than is left), and the level lands
  const lv0=(await call('/api/academy')).data.lv.atk|0;
  const d2=await call('/api/academy/speed',{use:'gems',hours:5,requestId:'sp-g2'}); const g2=await led(); const a2=(await call('/api/academy')).data;
  ok(d2.data.ok===true&&d2.data.hours===1&&g2.gems===g1.gems-30&&d2.data.done===true&&(a2.lv.atk|0)===lv0+1&&!a2.learn.atk,'finishing charges only the hours left (1 x 30) and the level lands now ('+(d2.data.error||'hours '+d2.data.hours+' lv '+a2.lv.atk)+')');
  // not enough diamonds
  await editDB((db,u)=>{ u.led.acad.learn={hp:Date.now()+10*H}; u.led.gems=50; });
  const d3=await call('/api/academy/speed',{use:'gems',hours:2,requestId:'sp-g3'}); const g3=await led();
  ok(d3.data.ok===false&&/Not enough diamonds/.test(d3.data.error||'')&&g3.gems===50,'2 hours (60) with 50 diamonds is refused, nothing spent');
  // the client catalogue matches (slot 15, 300, daily + open)
  const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  ok(/\{name:'Academy Scroll',desc:'Takes 1 hour off Academy research',cost:300,server:'gshop:15',daily:true,open:true,/.test(html),'the client Guild Shop lists the Academy Scroll at slot 15, 300 coins, daily, open to every guild');
  ok(/const ACAD_SPEED_GEMS=30;/.test(html),'the client shows 30 diamonds an hour');
  console.log('test_academy_scrolls_1425.js: '+pass+' checks passed');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
