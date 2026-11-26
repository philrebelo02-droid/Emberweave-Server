process.env.RAID_MIN_WATCH_MUL = process.env.RAID_MIN_WATCH_MUL || '0';   // v1457: this test resolves guild raid fights at machine speed; the skipped-raid refusal is proven in tests/test_phil_answers_1457.js
// v1446 (independent review of v1445, 24 Nov 2026): a guild raid fight that ended AFTER another member felled its boss booked
// its damage against the NEXT boss's fresh pool and his contribution board. Now it leaves the current boss alone: the player is
// paid guild coins for the damage dealt to their own boss (capped at what he had when the fight began), with no kill package.
// Fixture (throwaway server + DB, the real /api/guild/raid/start + /resolve, the server's own sim-host replay):
//   fight 1 opens against tier 1; the DB is then moved on to tier 2 at full health (another member's kill); fight 1 resolves.
//   A control fight against the current tier still books against him as before.
// CONTROL: EW_ROOT=<a checkout of 295296dec> must FAIL (the tier 2 boss loses health and his board shows the stale damage).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-raidstale-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,fails=0,checks=0,port,base,env;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
const up=async()=>{for(let i=0;i<400;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
const stop=async()=>{ if(!child) return; const c=child; child=null; await new Promise(r=>{ if(c.exitCode!==null) return r(); c.once('exit',r); c.kill(); }); };
const start=async()=>{ child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up(); };
const J=async(p,b,tok)=>(await fetch(base+p,{method:b?'POST':'GET',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:b?JSON.stringify(b):undefined})).json();
const AUTO=[[1,'auto',-1,1,null,null]];
const SQUAD=['vael','sylthaine','vireo','vex','tick','konwu','grosk','vulmar','aureth','bloatus'];
const editRaid=async fn=>{ await delay(700); await stop(); const db=JSON.parse(fs.readFileSync(env.DB_FILE,'utf8')); fn(Object.values(db.guilds).find(x=>x&&x.raid).raid); fs.writeFileSync(env.DB_FILE,JSON.stringify(db)); await start(); };
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port;
  env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),DATABASE_URL:'',ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  await start();
  const reg=await J('/api/register',{name:'rs'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); await stop(); env.ADMIN_IDS=L.id; await start();
  await J('/api/admin/led-grant',{unlock:SQUAD},L.token);
  for(const [roster,n] of [['cmdlevel',40],['herolevel',40],['gear',0]]) await J('/api/admin/led-grant',{roster,n},L.token);
  const g=await J('/api/guild/create',{name:'Stale Tier Guild'},L.token); ok(!!(g&&!g.error),'fixture: guild created '+JSON.stringify(g&&g.error||'ok'));
  const s1=await J('/api/guild/raid/start',{heroIds:SQUAD,requestId:'rs-s1'},L.token);
  ok(!!(s1&&s1.ok)&&s1.boss&&s1.boss.tier===1,'fight 1 opens against tier 1 (boss hp '+(s1&&s1.boss&&s1.boss.hp)+')');
  const H1=(s1&&s1.boss&&s1.boss.hp)|0;
  // another member fells tier 1 while fight 1 is open: tier 2 at full health, clean board, 1 kill (ensureRaid sizes max on boot)
  await editRaid(r=>{ r.level=2; r.kills=1; r.contrib={}; });
  await editRaid(r=>{ r.hp=r.max; });
  const v2=(await J('/api/guild/raid',null,L.token)).raid||{};
  ok(v2.level===2&&v2.hp===v2.max&&v2.max>0&&(v2.kills|0)===1,'fixture: tier 2 is up at full health ('+v2.hp+' / '+v2.max+'), 1 kill');
  const r1=s1&&s1.attemptId?await J('/api/guild/raid/resolve',{attemptId:s1.attemptId,inputLog:AUTO,requestId:'rs-r1'},L.token):{};
  console.log('  info stale booking: '+JSON.stringify({ok:r1.ok,dmg:r1.dmg,killed:r1.killed,earlierTier:r1.earlierTier,reward:r1.reward,raid:r1.raid&&{level:r1.raid.level,hp:r1.raid.hp,max:r1.raid.max,kills:r1.raid.kills,yourDmg:r1.raid.yourDmg,guildDmg:r1.raid.guildDmg}}));
  const rv=r1.raid||{};
  ok(r1.ok===true&&r1.earlierTier===1,'the stale fight resolves and says its boss was tier 1 (earlierTier '+r1.earlierTier+')');
  ok(rv.level===2&&rv.hp===v2.hp&&(rv.kills|0)===1,'THE TIER 2 BOSS IS UNTOUCHED: '+rv.hp+' / '+rv.max+' (was '+v2.hp+'), still 1 kill');
  ok((rv.yourDmg|0)===0&&(rv.guildDmg|0)===0,'the tier 2 contribution board stays clean (yours '+rv.yourDmg+', guild '+rv.guildDmg+')');
  ok(r1.killed===false&&!(r1.reward&&(r1.reward.gold||r1.reward.gems)),'no kill package for a boss someone else felled: '+JSON.stringify(r1.reward));
  ok((r1.dmg|0)>0&&(r1.dmg|0)<=H1,'the damage reported is what fight 1 dealt to its own boss, at most the '+H1+' he had: '+r1.dmg);
  ok(((r1.reward&&r1.reward.guildCoins)|0)===Math.round((r1.dmg|0)/50),'paid guild coins for that damage: '+(r1.reward&&r1.reward.guildCoins)+' = '+Math.round((r1.dmg|0)/50));
  const r1b=await J('/api/guild/raid/resolve',{attemptId:s1.attemptId,inputLog:AUTO,requestId:'rs-r1'},L.token);
  ok(r1b&&r1b.ok===true&&r1b.dmg===r1.dmg&&((r1b.ledger&&r1b.ledger.guildCoins)|0)===((r1.ledger&&r1.ledger.guildCoins)|0),'a re-sent resolve returns the same receipt and pays nothing twice');
  // control: a fight against the CURRENT tier still books against him
  const s2=await J('/api/guild/raid/start',{heroIds:SQUAD,requestId:'rs-s2'},L.token);
  const r2=s2&&s2.attemptId?await J('/api/guild/raid/resolve',{attemptId:s2.attemptId,inputLog:AUTO,requestId:'rs-r2'},L.token):{};
  ok(r2.ok===true&&r2.earlierTier===undefined&&(r2.dmg|0)>0&&r2.raid&&r2.raid.hp===v2.hp-(r2.dmg|0)&&(r2.raid.yourDmg|0)===(r2.dmg|0),'control: a fight against tier 2 books '+r2.dmg+' off him as before (hp '+(r2.raid&&r2.raid.hp)+')');
}catch(e){ fails++; console.log('  FAIL threw: '+(e&&e.stack||e)); }
  await stop(); try{ fs.rmSync(temp,{recursive:true,force:true}); }catch(_){}
  console.log((checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); process.exit(fails?1:0);
})();
