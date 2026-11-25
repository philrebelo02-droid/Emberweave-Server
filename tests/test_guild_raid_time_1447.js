// v1447 (Phil 24 Nov 2026: "check magic rush for their standard of time" / "fix it to their standard of time killed").
// The guild raid boss is sized so a guild of 20 at the tier's level (85% build, 3 attempts a day) needs about 3 days, and like Magic Rush's
// Team Raid the next boss arrives at the daily reset (one boss a day at most). Also: no tier's health passes 2^31 (tier 36+ used to end the
// fight at once and book 1 damage).
// Fixture (throwaway server + DB, the real routes, the server's own sim-host replay):
//   tier 1 is 5,510,000; a kill puts tier 2 up and the same day a start is refused with the daily-reset line (coded, nextAtReset on the
//   view); after the day turns the start works; an old-curve guild mid-boss keeps the fraction it had chewed off; tier 36 and tier 60 fights
//   book real damage (not 1) and the boss does not fall in the first second.
// CONTROL: EW_ROOT=<a checkout of 80ee88f6b> must FAIL (tier 1 is 400,000; no daily-reset refusal; tier 36 books 1 damage).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-raidtime-'));
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
const editRaid=async fn=>{ await delay(700); await stop(); const db=JSON.parse(fs.readFileSync(env.DB_FILE,'utf8')); const gg=Object.values(db.guilds).find(x=>x&&x.name==='Raid Time Guild');
  if(!gg.raid) gg.raid={level:1,max:5510000,hp:5510000,kills:0,contrib:{},used:{},day:''}; fn(gg.raid, db); fs.writeFileSync(env.DB_FILE,JSON.stringify(db)); await start(); };
const LINE='The next raid boss arrives at the daily reset.';
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port;
  env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),DATABASE_URL:'',ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  await start();
  const reg=await J('/api/register',{name:'rt'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); await stop(); env.ADMIN_IDS=L.id; await start();
  await J('/api/admin/led-grant',{unlock:SQUAD},L.token);
  for(const [roster,n] of [['cmdlevel',60],['herolevel',60],['gear',0]]) await J('/api/admin/led-grant',{roster,n},L.token);
  const g=await J('/api/guild/create',{name:'Raid Time Guild'},L.token); ok(!!(g&&!g.error),'fixture: guild created '+JSON.stringify(g&&g.error||'ok'));
  const v1=(await J('/api/guild/raid',null,L.token)).raid||{};
  ok(v1.level===1&&v1.max===2690000&&v1.hp===2690000,'tier 1 is sized for an average level-30 guild of 20 in 3 days of 90 s assaults, 2 a day (v1453): '+v1.hp+' / '+v1.max+' (was 400,000)');
  // a kill: leave tier 1 a sliver, fight
  await editRaid(r=>{ r.hp=50; });
  const s1=await J('/api/guild/raid/start',{heroIds:SQUAD,requestId:'rt-s1'},L.token);
  const r1=s1&&s1.attemptId?await J('/api/guild/raid/resolve',{attemptId:s1.attemptId,inputLog:AUTO,requestId:'rt-r1'},L.token):{};
  ok(r1.ok===true&&r1.killed===true&&r1.raid&&r1.raid.level===2&&r1.raid.max===2740000,'the kill puts tier 2 up at '+(r1.raid&&r1.raid.max)+' '+JSON.stringify(r1.error||''));
  ok(r1.raid&&r1.raid.nextAtReset===true,'the view says the next boss arrives at the daily reset (nextAtReset '+(r1.raid&&r1.raid.nextAtReset)+')');
  const s2=await J('/api/guild/raid/start',{heroIds:SQUAD,requestId:'rt-s2'},L.token);
  ok(s2&&s2.error===LINE,'the same day a start is refused: '+JSON.stringify(s2&&s2.error));
  ok(s2&&s2.errCode==='raid_next_boss_at_reset','the refusal has its error code (translated in 15 languages): '+(s2&&s2.errCode));
  const v2=(await J('/api/guild/raid',null,L.token)).raid||{};
  ok(v2.attemptsLeft===1,'the refused start spends no attempt (2 a day, 1 used: '+v2.attemptsLeft+' left)');
  // the day turns
  await editRaid(r=>{ r.killDay='2000-01-01'; });
  const s3=await J('/api/guild/raid/start',{heroIds:SQUAD,requestId:'rt-s3'},L.token);
  ok(s3&&s3.ok===true&&s3.boss&&s3.boss.tier===2,'after the daily reset tier 2 can be fought '+JSON.stringify(s3&&s3.error||''));
  const r3=s3&&s3.attemptId?await J('/api/guild/raid/resolve',{attemptId:s3.attemptId,inputLog:AUTO,requestId:'rt-r3'},L.token):{};
  ok(r3.ok===true&&(r3.dmg|0)>1000,'tier 2 takes real damage: '+r3.dmg);
  // an old-curve guild mid-boss keeps its fraction
  await editRaid(r=>{ r.level=10; r.max=3689349; r.hp=Math.round(3689349*0.4); r.contrib={}; delete r.killDay; });
  const v10=(await J('/api/guild/raid',null,L.token)).raid||{};
  ok(v10.level===10&&v10.max===3470000&&Math.abs(v10.hp/v10.max-0.4)<0.001,'a guild part-way through tier 10 keeps its 40% left on the new size ('+v10.hp+' / '+v10.max+')');
  // the overflow tiers fight for real
  const want={36:139000000, 60:Math.min(2000000000,Math.round(215000000*Math.pow(1.05,20)))};   // the table's tier 36; tiers past 40 grow 5% a tier
  for(const t of [36,60]){
    await editRaid((r,db)=>{ r.level=t; r.max=want[t]; r.hp=want[t]; r.contrib={}; r.used={}; delete r.killDay;
      for(const u of Object.values(db.users||db.accounts||{})) if(u&&u.raidDay) delete u.raidDay; });   // the player's own 2-a-day count too
    const vt=(await J('/api/guild/raid',null,L.token)).raid||{};
    const st=await J('/api/guild/raid/start',{heroIds:SQUAD,requestId:'rt-st'+t},L.token);
    const rt=st&&st.attemptId?await J('/api/guild/raid/resolve',{attemptId:st.attemptId,inputLog:AUTO,requestId:'rt-rt'+t},L.token):{};
    ok(vt.max>0&&vt.max<2147483647&&rt.ok===true&&(rt.dmg|0)>1000&&rt.killed===false&&rt.raid.hp===vt.max-(rt.dmg|0),'tier '+t+': health '+vt.max+' (under 2^31), an assault books '+rt.dmg+' and the boss stands');
  }
}catch(e){ fails++; console.log('  FAIL threw: '+(e&&e.stack||e)); }
  await stop(); try{ fs.rmSync(temp,{recursive:true,force:true}); }catch(_){}
  console.log((checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); process.exit(fails?1:0);
})();
