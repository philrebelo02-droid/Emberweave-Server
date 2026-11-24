// v1445 PART A (Phil 24 Nov 2026, Soul Eater's recording: "When you kill a boss it shouldnt say no damage").
// A guild raid assault that KILLS the boss booked 0 damage: the fight ends 2 s after the boss falls and a fallen enemy has
// left `units` by then, so the damage meter (raidDamageDone - read by the page AND by the server's replay) found no boss.
// The server then paid nothing, left the boss alive at the HP he had and spent the assault.
// Fixture (throwaway server + DB, the real /api/guild/raid/start + /resolve, the server's own sim-host replay):
//   fight 1 against a full boss books D > 0 (no kill);
//   the boss is then left with a sliver (D/4) and fight 2 must book exactly that sliver, kill him, pay the kill package,
//   raise the guild's kill count, put the next tier up at full health and write the killing-blow line.
// CONTROL: EW_ROOT=<a checkout of 44d6f6c1b> must FAIL (fight 2 books 0, killed false, the boss stays alive).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net');
const {spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-raidkill-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,fails=0,checks=0,port,base,env;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
const up=async()=>{for(let i=0;i<400;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
const stop=async()=>{ if(!child) return; const c=child; child=null; await new Promise(r=>{ if(c.exitCode!==null) return r(); c.once('exit',r); c.kill(); }); };
const start=async()=>{ child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up(); };
const J=async(p,b,tok)=>(await fetch(base+p,{method:b?'POST':'GET',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:b?JSON.stringify(b):undefined})).json();
const AUTO=[[1,'auto',-1,1,null,null]];   // the player's AUTO switch, on from the first tick (what the recording shows)
const SQUAD=['vael','sylthaine','vireo','vex','tick','konwu','grosk','vulmar','aureth','bloatus'];
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port;
  env={...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json'),DATABASE_URL:'',ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
  await start();
  const reg=await J('/api/register',{name:'rk'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
  await delay(700); await stop(); env.ADMIN_IDS=L.id; await start();
  await J('/api/admin/led-grant',{unlock:SQUAD},L.token);
  for(const [roster,n] of [['cmdlevel',40],['herolevel',40],['gear',0]]) await J('/api/admin/led-grant',{roster,n},L.token);
  const g=await J('/api/guild/create',{name:'Kill Count Guild'},L.token); ok(!!(g&&!g.error),'fixture: guild created '+JSON.stringify(g&&g.error||'ok'));
  const v0=(await J('/api/guild/raid',null,L.token)).raid||{};
  ok(v0.level===1&&v0.hp===v0.max&&v0.max>0,'fixture: tier 1 boss at full health ('+v0.hp+' / '+v0.max+')');
  // fight 1: a full boss - damage, no kill
  const s1=await J('/api/guild/raid/start',{heroIds:SQUAD,requestId:'rk-s1'},L.token);
  const r1=s1&&s1.attemptId?await J('/api/guild/raid/resolve',{attemptId:s1.attemptId,inputLog:AUTO,requestId:'rk-r1'},L.token):null;
  const D=(r1&&r1.dmg)|0;
  ok(!!(r1&&r1.ok)&&D>0&&r1.killed===false&&r1.raid.hp===v0.max-D,'fight 1 (full boss): books '+D+' damage, no kill, boss at '+(r1&&r1.raid&&r1.raid.hp)+' '+(s1&&s1.error?'('+s1.error+')':''));
  // leave the boss a sliver this squad certainly removes: a quarter of what fight 1 dealt
  const H=Math.max(50,Math.floor(D/4)), coins0=((r1&&r1.ledger&&r1.ledger.guildCoins)|0);
  await delay(700); await stop();
  { const db=JSON.parse(fs.readFileSync(env.DB_FILE,'utf8')); const gg=Object.values(db.guilds).find(x=>x&&x.raid);
    gg.raid.hp=H; gg.raid.contrib={[L.id]:gg.raid.max-H}; fs.writeFileSync(env.DB_FILE,JSON.stringify(db)); }
  await start();
  const v1=(await J('/api/guild/raid',null,L.token)).raid||{};
  ok(v1.hp===H&&v1.level===1&&(v1.kills|0)===0,'fixture: the boss has '+H+' HP left of '+v1.max+' (tier 1, 0 kills)');
  const s2=await J('/api/guild/raid/start',{heroIds:SQUAD,requestId:'rk-s2'},L.token);
  ok(!!(s2&&s2.ok)&&s2.boss&&s2.boss.hp===H,'fight 2 starts against the '+H+' HP he has left (boss.hp '+(s2&&s2.boss&&s2.boss.hp)+')');
  const r2=s2&&s2.attemptId?await J('/api/guild/raid/resolve',{attemptId:s2.attemptId,inputLog:AUTO,requestId:'rk-r2'},L.token):{};
  console.log('  info fight 2 booking: '+JSON.stringify({ok:r2.ok,dmg:r2.dmg,killed:r2.killed,reward:r2.reward,raid:r2.raid&&{level:r2.raid.level,hp:r2.raid.hp,max:r2.raid.max,kills:r2.raid.kills,attemptsLeft:r2.raid.attemptsLeft}}));
  ok(r2.ok===true&&r2.dmg===H,'THE KILLING ASSAULT BOOKS THE DAMAGE IT DEALT: '+r2.dmg+' (the '+H+' he had left)');
  ok(r2.killed===true,'the boss is defeated (killed '+r2.killed+')');
  const rw=r2.reward||{};
  ok(rw.tier===1&&rw.gold>0&&rw.gems>0,'the kill package is paid: '+JSON.stringify(rw));
  ok(rw.guildCoins>Math.round(H/50)&&((r1.reward.guildCoins|0)===Math.round(D/50)),'the killing assault is paid for its damage too: '+rw.guildCoins+' guild coins = '+Math.round(H/50)+' for the '+H+' damage + the kill bonus');
  const rv=r2.raid||{};
  ok(rv.level===2&&rv.hp===rv.max&&rv.max>v0.max&&rv.kills===1&&rv.yourDmg===0&&rv.guildDmg===0,'the next tier is up at full health, 1 boss felled, a clean board: '+JSON.stringify({level:rv.level,hp:rv.hp,max:rv.max,kills:rv.kills}));
  ok(rv.attemptsLeft===1,'the assault is spent like any other (1 left, got '+rv.attemptsLeft+')');
  const coins1=((r2.ledger&&r2.ledger.guildCoins)|0);
  ok(coins1-coins0===(rw.guildCoins|0)&&coins1>coins0,'the guild coins reached the wallet ('+coins0+' -> '+coins1+')');
  // a repeat of the same result answers the same booking (no second kill)
  const r2b=await J('/api/guild/raid/resolve',{attemptId:s2.attemptId,inputLog:AUTO,requestId:'rk-r2'},L.token);
  ok(JSON.stringify(r2b)===JSON.stringify(r2),'a re-sent result answers the same booking');
  await delay(700); await stop();
  { const db=JSON.parse(fs.readFileSync(env.DB_FILE,'utf8')); const gg=Object.values(db.guilds).find(x=>x&&x.raid)||{raid:{}};
    ok(gg.raid.level===2&&gg.raid.hp===gg.raid.max&&gg.raid.kills===1,'on disk: tier 2 at full health, kills 1 ('+JSON.stringify({level:gg.raid.level,hp:gg.raid.hp,kills:gg.raid.kills})+')');
    ok(/landed the killing blow on Wintercrag \(Tier 1\)/.test(JSON.stringify(gg.log||[])),'the guild log has the killing-blow line'); }
}catch(e){ console.error(e); fails++; } finally { console.log('guild raid kill books its damage: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed (root '+ROOT+')'); if(fails) process.exitCode=1; await stop(); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
