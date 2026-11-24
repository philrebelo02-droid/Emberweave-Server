// v1445 PART B (Phil 24 Nov 2026: "when you do damage to a boss, the next time you face it, it should have the same hp bar
// it had the fight before"). The raid boss walks into the fight with the health his guild has LEFT him as his whole fight pool,
// so his bar opened FULL on every assault whatever the Guild Hall showed (the recording: stored 50,901 / 400,000, bar at 100%).
// The bars must open at his stored health out of his real maximum; the fight pool itself (what one assault can deal:
// everything he has left) does not change, and the server's replay of the fight is untouched.
//
// No browser: the page's own script runs in the server's headless host (server/sim-host.js), the raid fight is set up the way
// raidLaunch + the fight start do it, and the page's own bossBarTick() paints into a stand-in for the #bossTopBar element.
//   1. server.js: both /api/guild/raid/start answers (fresh and resumed) carry boss.max
//   2. a boss stored at 32,000 / 400,000: the unit's pool is 32,000, hpBarMax() is 400,000, the HUD bar's fill is 8.0% and it
//      reads the Guild Hall's own line "32,000 / 400,000 HP · 8%"; the pale catch-up bar opens there too (no 100% -> 8% slide)
//   3. after damage the bar follows his health out of the real maximum
//   4. a full boss opens at 100%, and a non-raid boss bar still reads "NN%"
//   5. the replay's damage for the same fight is the same with and without the bar maximum (display only)
// CONTROL: EW_ROOT=<a checkout of 44d6f6c1b> must FAIL (no boss.max, fill 100.0%, "100%").
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
let fails=0,checks=0; const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
const HARD=setTimeout(()=>{ console.log('  FAIL hard timeout (120 s)'); process.exit(1); },120000); HARD.unref();
try{
  // 1. the server's start answers
  const srv=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
  const starts=srv.match(/boss:\{key:[^}]*hp:(open\.bossHp|rr\.hp)[^}]*\}/g)||[];
  ok(starts.length===2&&starts.every(s=>/\bmax:(bossMax\(open\.tier\)|rr\.max)/.test(s)),'server: the fresh and the resumed raid start both send boss.max ('+starts.map(s=>(s.match(/max:[^,}]+/)||['no max'])[0]).join(' | ')+')');
  // 2. the page's own code, headless
  const HOST=require(path.join(ROOT,'server','sim-host.js')).load(path.join(ROOT,'emberweave-heroes.html'));
  const SIM=require(path.join(ROOT,'server','sim.js'));
  const keys=['vael','sylthaine','vireo','vex','tick'].filter(k=>SIM.HERO_BASE[k]);
  const run=code=>JSON.parse(vm.runInContext(code,HOST.ctx,{timeout:60000}));
  vm.runInContext(`window.__barEl=function(){ const mk=()=>({style:{},textContent:'',offsetWidth:0}); const parts={'.btFill':mk(),'.btLag':mk(),'.btPct':mk(),'.btN':mk(),'.btPort':mk()};
      const lagLog=[]; let lagW=''; Object.defineProperty(parts['.btLag'].style,'width',{get(){return lagW;},set(v){ lagW=v; lagLog.push([v,parts['.btLag'].style.transition||'']); }});
      return {parts,lagLog,_on:0,classList:{add(){},remove(){}},style:{},querySelector(s){ return parts[s]; },getBoundingClientRect(){ return {left:0,top:0,bottom:0,width:0}; },offsetParent:null,parentElement:null}; };
    window.__raidOpen=function(keys,left,full,mode){
      ended=false; state='battle'; battleTime=0; gameSpeed=1; waveXfer=null; chapterWaves=1; waveIdx=0;
      const B={key:'wintercrag',name:'Wintercrag',tier:1,hp:left,lvl:15,def:30000,dmgMul:1};
      CUR={mode:mode||'graid', seed:4242, raid:Object.assign({key:B.key,name:B.name,tier:1,hp:left,lvl:15},full?{max:full}:{}),
           cwaves:[[{key:B.key,lvl:15,boss:true,hp:left,def:B.def,dmgMul:1}]], backups:[], headless:true};
      seedBattle(4242); units=[]; spawnTeam(keys,'ally'); units.forEach(u=>{ if(u.team==='ally') u._vaultFighter=true; });
      buildEnemyWave();
      if((mode||'graid')==='graid'){ if(typeof raidBossMark==='function') raidBossMark(); else units.forEach(u=>{ if(u.team==='enemy'){ u._raidBoss=true; u._raidStartHp=u.maxHp; } }); }
      return units.find(u=>u.team==='enemy'&&u.boss); };
    window.__barPaint=function(el){ const d0=globalThis.document;   /* the host's document is a fixed stub: stand a forwarding one in front of it for this one paint */
      globalThis.document=new Proxy(d0,{get(t,k){ if(k==='getElementById') return id=>id==='bossTopBar'?el:t.getElementById(id); if(k==='querySelectorAll') return ()=>[]; const v=t[k]; return typeof v==='function'?v.bind(t):v; }});
      try{ bossBarTick(); } finally { globalThis.document=d0; }
      return {fill:el.parts['.btFill'].style.width, lag:el.parts['.btLag'].style.width, lagLog:el.lagLog.slice(), txt:el.parts['.btPct'].textContent, name:el.parts['.btN'].textContent}; };`,HOST.ctx);
  const K=JSON.stringify(keys);
  const a=run(`(function(){ const b=__raidOpen(${K},32000,400000); const el=__barEl(); const p=__barPaint(el);
      const open={maxHp:b.maxHp,hp:b.hp,barMax:(typeof hpBarMax==='function')?hpBarMax(b):null,p};
      b.hp=12000; const p2=__barPaint(el);
      return JSON.stringify({open,p2}); })()`);
  ok(a.open.maxHp===32000&&a.open.hp===32000,'the fight pool is unchanged: he walks in with the 32,000 he has left and one assault can deal no more (unit maxHp '+a.open.maxHp+')');
  ok(a.open.barMax===400000,'his bars measure against his real maximum (hpBarMax '+a.open.barMax+')');
  ok(a.open.p.fill==='8.0%','THE HUD BAR OPENS WHERE THE LAST FIGHT LEFT HIM: fill '+a.open.p.fill+' for 32,000 / 400,000 (the Guild Hall shows 8%)');
  ok(/32,000/.test(a.open.p.txt)&&/400,000/.test(a.open.p.txt)&&/8%/.test(a.open.p.txt),'the bar reads the Guild Hall line: "'+a.open.p.name+'  '+a.open.p.txt+'"');
  ok(a.open.p.lagLog.length>=1&&a.open.p.lagLog[0][0]==='8.0%'&&a.open.p.lagLog[0][1]==='none','the pale catch-up bar opens at 8% with no slide down from 100% ('+JSON.stringify(a.open.p.lagLog[0]||null)+')');
  ok(a.p2.fill==='3.0%'&&/12,000/.test(a.p2.txt)&&/400,000/.test(a.p2.txt),'after damage the bar follows his health out of the real maximum: '+a.p2.fill+' "'+a.p2.txt+'"');
  const f=run(`(function(){ const b=__raidOpen(${K},400000,400000); const p=__barPaint(__barEl()); return JSON.stringify({p,barMax:(typeof hpBarMax==='function')?hpBarMax(b):b.maxHp}); })()`);
  ok(f.p.fill==='100.0%'&&f.barMax===400000,'a boss nobody has hurt opens full: '+f.p.fill+' "'+f.p.txt+'"');
  const c=run(`(function(){ const b=__raidOpen(${K},32000,0,'campaign'); b.hp=16000; const p=__barPaint(__barEl()); return JSON.stringify({p}); })()`);
  ok(c.p.fill==='50.0%'&&c.p.txt==='50%','every other boss bar is as it was: '+c.p.fill+' "'+c.p.txt+'"');
  // 5. display only: the replay of the fight does not know the bar maximum and books the same damage
  const snaps=JSON.stringify(HOST.snapSquad(keys)); const boss={key:'wintercrag',lvl:15,hp:32000,boss:true,def:30000,dmgMul:1};
  const d1=HOST.raid(JSON.parse(snaps),boss,777,[[1,'auto',-1,1,null,null]]).dmg, d2=HOST.raid(JSON.parse(snaps),Object.assign({max:400000},boss),777,[[1,'auto',-1,1,null,null]]).dmg;
  ok(d1===d2&&d1>=0,'the server replay books the same damage whatever the bar shows ('+d1+' = '+d2+')');
}catch(e){ console.error(e); fails++; }
console.log('guild raid bar opens at the stored health: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed (root '+ROOT+')'); if(fails) process.exitCode=1;
