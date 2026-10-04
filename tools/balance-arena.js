// BALANCE ARENA (v1020, Phil 4 Oct 2026: "I need actual balance, there needs to be an actual reason to have a support ... or marksman,
// or mage ... not just 5 tank fighters"). Fights team COMPOSITIONS against each other in the REAL battle engine and prints win rates.
//  - a local server (this checkout) with a dev account; every hero maxed (level 100, 5 stars, Orange glyphs - no gear, no Temple)
//  - each hero's real battle spec from /api/admin/snapshot?spec=1, resolved to a snapshot by the game's own unit builder (sim-host)
//  - each matchup: N fights, sides swapped every other fight, heroes drawn from each class pool per fight, seeded (repeatable)
// Usage: node tools/balance-arena.js [fightsPerMatchup=40] [--comps=A,B,...] [--json=out.json]
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..');
const args=process.argv.slice(2), N=+(args.find(a=>/^\d+$/.test(a))||40);
const opt=k=>{ const a=args.find(x=>x.startsWith('--'+k+'=')); return a?a.slice(k.length+3):null; };
const H=require(path.join(root,'hero-profiles.js'));
const SKILL_MAX=+((fs.readFileSync(path.join(root,'server.js'),'utf8').match(/SKILL_MAX_SRV=(\d+)/)||[])[1]||100);
const host=require(path.join(root,'server','sim-host.js')).load(path.join(root,'emberweave-heroes.html'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// TELEMETRY: wrap the engine's damage and heal entry points (top-level functions = properties of the sandbox global) and total what
// each CLASS dealt / healed, per fight. Healing counts what landed (healUnit caps at max HP), so overheal is not counted.
// Both sides cast their ultimates: simFightResult only auto-casts for the ALLY when the player's Auto switch is on (autoUlt, default off) -
// left off, the attacking side never ults and loses ~95% of fights whatever its stats. autoUlt is a script-scope let: set it in-context.
require('vm').runInContext('autoUlt=true;',host.ctx);
const SB=host.sandbox, TEL={}, TELK={}, _burst=new Map(), FT={}; let telOn=true;
const clsOf=u=>{ const k=u&&u.key, p=k&&H[k]; return p?(p.class==='Tank'?(p.damageProfile==='Magic'?'TankM':'TankA'):p.class):null; };
const telAdd=(c,f,v)=>{ if(!c||!telOn||!(v>0)) return; const t=TEL[c]||(TEL[c]={dmg:0,heal:0,stunned:0,fights:0}); t[f]=(t[f]||0)+v; };
{ const dd=SB.dealDamage; SB.dealDamage=function(src,tgt,amt,color,kind){ const before=tgt&&tgt.hp; const r=dd.apply(this,arguments); if(tgt&&before!=null){ const v=Math.max(0,before-Math.max(0,tgt.hp)); telAdd(clsOf(src),'dmg',v); telAdd(clsOf(src),'k_'+(kind||'auto'),v); telAdd(clsOf(src),'hits',1); if(telOn&&src&&src.key&&v>0){ const K=TELK[src.key]||(TELK[src.key]={dmg:0,hits:0,multi:0,fights:0}); K.dmg+=v; K.hits++; const tk=Math.round((SB.__bt?SB.__bt():0)*20), B=_burst.get(src); if(B&&B.t===tk){ if(!B.s.has(tgt)){ B.s.add(tgt); K.multi++; } } else _burst.set(src,{t:tk,s:new Set([tgt])}); } } return r; }; }
{ const hu=SB.healUnit; SB.healUnit=function(u,a){ const before=u&&u.hp; const r=hu.apply(this,arguments); if(u&&before!=null&&!u._healing) telAdd(SB._telHealer?clsOf(SB._telHealer):'regen>'+clsOf(u),'heal',Math.max(0,u.hp-before)); return r; }; }
require('vm').runInContext('globalThis.__telUnits=function(){ return units; }; globalThis.__bt=function(){ return battleTime; };',host.ctx);
{ const ub=SB.updateBattle; SB.updateBattle=function(dt){ const r=ub.apply(this,arguments); try{ for(const u of SB.__telUnits()||[]){ if(u&&u.alive&&((u.stunned||0)>0||(u.fearT||0)>0||(u._sleepT||0)>0||(u._frozenT||0)>0)){ const c=clsOf(u); if(c) telAdd(c,'stunned',dt); } } }catch(e){} return r; }; }
{ const hf=SB.healFrom; SB.healFrom=function(src){ const prev=SB._telHealer; SB._telHealer=src; try{ return hf.apply(this,arguments); } finally{ SB._telHealer=prev; } }; }
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
// Team compositions by role slot. 'TankA' = melee tank, 'TankM' = magic tank; other entries are classes.
const COMPS={
  '5 Tanks':          ['TankA','TankA','TankA','TankA','TankA'],
  '5 Bruisers':       ['Bruiser','Bruiser','Bruiser','Bruiser','Bruiser'],
  '5 Assassins':      ['Assassin','Assassin','Assassin','Assassin','Assassin'],
  '5 Marksmen':       ['Marksman','Marksman','Marksman','Marksman','Marksman'],
  '5 Mages':          ['Mage','Mage','Mage','Mage','Mage'],
  '5 Supports':       ['Support','Support','Support','Support','Support'],
  'Classic (T B Mk Mg S)':   ['TankA','Bruiser','Marksman','Mage','Support'],
  'Two tanks (T T Mk Mg S)': ['TankA','TankM','Marksman','Mage','Support'],
  'Carry (T Mk Mk Mg S)':    ['TankA','Marksman','Marksman','Mage','Support'],
  'Dive (B As As Mg S)':     ['Bruiser','Assassin','Assassin','Mage','Support'],
  'No support (T B Mk Mg Mg)':['TankA','Bruiser','Marksman','Mage','Mage'],
  '4 Tanks + Support':       ['TankA','TankA','TankA','TankA','Support'],
  // Phil 4 Oct: does each role make a difference? Swap it out of a balanced team for a second melee tank.
  'Mk->T (T T B Mg S)':      ['TankA','TankA','Bruiser','Mage','Support'],
  'S->T (T T B Mk Mg)':       ['TankA','TankA','Bruiser','Marksman','Mage'],
  'Assassin (T B As Mg S)':   ['TankA','Bruiser','Assassin','Mage','Support'],
};
let child,port,base;
async function start(admin,dbFile){ child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,ADMIN_IDS:admin||''},stdio:'ignore',windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(child){ child.kill(); await delay(600); child=null; } }
const call=async(p,b,tok)=>{ const r=await fetch(base+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{'x-token':tok}:{})},body:b?JSON.stringify(b):undefined}); return r.json(); };
function rng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
(async()=>{ const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-arena-')), dbFile=path.join(dir,'db.json');
  port=await freePort(); base='http://127.0.0.1:'+port;
  try{ await start('',dbFile);
    const d=await call('/api/register',{name:'arenadev',pass:'password1'}); await delay(400); await stop(); await start(d.profile.id,dbFile);
    let tok=(await call('/api/login',{name:'arenadev',pass:'password1'})).token; const keys=Object.keys(H);
    await call('/api/admin/led-grant',{heroKeys:keys,unlock:keys,stars:5,maxGlyphs:true,px:99000000,heroXp:99000000},tok);
    // Phil 4 Oct: "also max their skills" - every hero's four skills at the server's maximum (SKILL_MAX_SRV), written into this test DB
    await delay(500); await stop(); { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')), led=db.users[d.profile.id].led; led.skill=led.skill||{};
      for(const k of keys) led.skill[k]=[SKILL_MAX,SKILL_MAX,SKILL_MAX,SKILL_MAX];
      const usr=db.users[d.profile.id];
      // --gear=1 (Phil 4 Oct balance layer 2): every hero wears its canonical loadout (hero-paths.js equipment: 9 items, one per
      // slot) at max temper; the Orange item's active is the equipped active. Resonance follows from the total temper.
      if(opt('gear')){ const CAT=JSON.parse(fs.readFileSync(path.join(root,'server','gear-catalog.json'),'utf8')), byId={}; for(const it of CAT.items) byId[it.id]=it;
        const PATHS=require(path.join(root,'hero-paths.js')), TMAX=opt('temper')?+opt('temper'):CAT.meta.temper.max;   /* --temper=N: every item at temper N (Phil 4 Oct: 'temper 1 and maxed') */
        const g=usr.gear||(usr.gear={revision:1,fragments:{},subs:{},items:{},equipped:{},active:{},seq:1});
        for(const k of keys){ const ids=(opt('gearskip')&&opt('gearskip').split('+').includes(H[k].class==='Tank'?(H[k].damageProfile==='Magic'?'TankM':'TankA'):H[k].class))?[]:((PATHS[H[k].equipmentPath]||{}).equipment||[]); g.equipped[k]={};   /* --gearskip=Class[+Class]: that class fights ungeared (diagnostic) */
          for(const id of ids){ const def=byId[id]; if(!def) continue; const nid='q'+(g.seq++);
            g.items[nid]={d:id,temper:TMAX,prog:0,dustSpent:0,bound:true,createdAt:Date.now()}; g.equipped[k][def.slot]=nid;
            if(def.quality==='Orange'&&def.active&&!opt('noactive')) g.active[k]=nid; } }
        console.log('[layer] gear: canonical loadouts, temper '+TMAX); }
      // --temple=1 (layer 3, prayer): every hero's four Temple bars full and all five boons unlocked.
      if(opt('temple')){ const T=require(path.join(root,'server','temple-of-ash.js')), M=T.effectMax(T.CONFIG.BAR_FULL_AT_TEMPLE);
        led.temple=led.temple||T.newState(); led.temple.heroes=led.temple.heroes||{};
        for(const k of keys) led.temple.heroes[k]={cinders:{bar1:M,bar2:M,bar3:M,bar4:M},boonsUnlocked:[true,true,true,true,true],meditationTicks:0};
        console.log('[layer] temple: bars '+M+' x4, five boons'); }
      fs.writeFileSync(dbFile,JSON.stringify(db)); }
    await start(d.profile.id,dbFile); tok=(await call('/api/login',{name:'arenadev',pass:'password1'})).token;
    const SNAP={};
    for(const k of keys){ const r=await call('/api/admin/snapshot?spec=1&hero='+k,null,tok); if(r.spec){ const s=host.snapFromSpecs([r.spec]); if(s&&s[0]) SNAP[k]=s[0]; } }
    await stop();
    if(opt('stats')){   // --stats=1: each class's battle stats (the snapshot the fight uses), averaged, then exit
      const F=['glyphRegen','blockStat','maxHp','dmg','apow','atkInterval','range','glyphCrit','critDmg','armorRating','mrRating','glyphDR','armorPen','magicPen','dmgBonusMul2','hasteEnergyMul','energyReg'];
      const by={}; for(const k in SNAP){ const p=H[k], c=p.class==='Tank'?(p.damageProfile==='Magic'?'TankM':'TankA'):p.class; (by[c]=by[c]||[]).push(SNAP[k]); }
      const have=F.filter(f=>Object.values(SNAP).some(s=>typeof s[f]==='number'));
      console.log('class      n  '+have.map(f=>f.padStart(9)).join(''));
      for(const c of Object.keys(by).sort()){ const L=by[c]; console.log(c.padEnd(9)+String(L.length).padStart(3)+'  '+have.map(f=>{ const v=L.reduce((a,s)=>a+(+s[f]||0),0)/L.length; return (Math.abs(v)<10?v.toFixed(3):Math.round(v)+'').padStart(9); }).join('')); }
      if(by[opt('stats')]) for(const k in SNAP){ const p=H[k], c=p.class==='Tank'?(p.damageProfile==='Magic'?'TankM':'TankA'):p.class; if(c!==opt('stats')) continue; const s=SNAP[k]; console.log('  '+k.padEnd(9)+p.equipmentPath.padEnd(22)+have.map(f=>{ const v=+s[f]||0; return (Math.abs(v)<10?v.toFixed(3):Math.round(v)+'').padStart(9); }).join('')); }   /* --stats=<Class>: per hero too */
      if(opt('stats')==='keys') console.log(Object.keys(Object.values(SNAP)[0]).join(' '));
      return; }
    // --scale=Mage.apow=0.5,Mage.hasteEnergyMul=0.9 - DIAGNOSTIC ONLY: scales a class's snapshot field for this run, to measure
    // which stat drives a result before the real change is made in the game's stats. Never a balance setting by itself.
    if(opt('scale')) for(const part of opt('scale').split(',')){ const m=part.match(/^(\w+)\.(\w+)=([\d.]+)$/); if(!m) continue;
      for(const k in SNAP){ const p=H[k], c=p.class==='Tank'?(p.damageProfile==='Magic'?'TankM':'TankA'):p.class;
        if(c===m[1] && typeof SNAP[k][m[2]]==='number') SNAP[k][m[2]]*=+m[3]; } console.log('[diagnostic] '+part); }
    const pools={TankA:[],TankM:[]}; for(const k of keys){ if(!SNAP[k]) continue; const p=H[k];
      if(p.class==='Tank') pools[p.damageProfile==='Magic'?'TankM':'TankA'].push(k); else (pools[p.class]=pools[p.class]||[]).push(k); }
    const names=(opt('comps')?opt('comps').split(','):Object.keys(COMPS)).filter(n=>COMPS[n]);
    const team=(comp,R)=>{ const used=new Set(), out=[]; for(const slot of COMPS[comp]){ const pool=pools[slot].filter(k=>!used.has(k)); const k=pool[Math.floor(R()*pool.length)]; used.add(k); out.push(JSON.parse(JSON.stringify(SNAP[k]))); } return out; };
    const res={}, SIDE={n:0,ally:0,enemy:0}; let fights=0; const t0=Date.now();
    for(let i=0;i<(opt('only1')?1:names.length);i++) for(let j=i+1;j<names.length;j++){   /* --only1=1: the first team against each of the others only */ const a=names[i], b=names[j]; let wa=0, wb=0, draw=0;
      for(let n=0;n<N;n++){ const R=rng(1000*i+37*j+n), ta=team(a,R), tb=team(b,R), seed=(9001+n*7919+i*131+j*17)>>>0;
        const aFirst=n%2===0, r=aFirst?host.auto(ta,tb,seed):host.auto(tb,ta,seed); fights++;
        const dg=r.digest?JSON.parse(r.digest):null, allyAlive=dg?dg.u.filter(u=>u[1]==='ally'&&u[2]).length:0, foeAlive=dg?dg.u.filter(u=>u[1]==='enemy'&&u[2]).length:0;
        for(const t of [...ta,...tb]){ const c=clsOf(t); if(c){ (TEL[c]||(TEL[c]={dmg:0,heal:0,fights:0})).fights++; } } for(const t of [...ta,...tb]){ const K=TELK[t.key]||(TELK[t.key]={dmg:0,hits:0,multi:0,fights:0}); K.fights++; } try{ const _d=JSON.parse(r.digest||'{}'); const fk=a+' v '+b; (FT[fk]||(FT[fk]=[])).push(_d.t||0); }catch(_e){}
        SIDE.n++; if(r.won) SIDE.ally++; else if(foeAlive>0&&allyAlive===0) SIDE.enemy++;
        if(r.won){ aFirst?wa++:wb++; } else if(foeAlive>0&&allyAlive===0){ aFirst?wb++:wa++; } else draw++; }
      res[a+' | '+b]={a,b,wa,wb,draw}; }
    if(opt('only1')){ for(const r of Object.values(res)) console.log('VS|'+r.b+'|'+r.wa+'|'+r.wb+'|'+r.draw); return; }
    // per-composition overall win rate (draws = timeouts count as neither)
    const tot={}; for(const n of names) tot[n]={w:0,l:0,d:0};
    for(const r of Object.values(res)){ tot[r.a].w+=r.wa; tot[r.a].l+=r.wb; tot[r.a].d+=r.draw; tot[r.b].w+=r.wb; tot[r.b].l+=r.wa; tot[r.b].d+=r.draw; }
    console.log('BALANCE ARENA - '+fights+' fights, '+N+' per matchup, '+((Date.now()-t0)/1000).toFixed(0)+' s (level 100, 5 stars, Orange glyphs, skills '+SKILL_MAX+'; no gear, no Temple)\n');
    console.log('Composition'.padEnd(28)+'  Win%   W    L   Timeouts');
    for(const n of names.slice().sort((x,y)=>tot[y].w/(tot[y].w+tot[y].l+tot[y].d)-tot[x].w/(tot[x].w+tot[x].l+tot[x].d))){ const t=tot[n], g=t.w+t.l+t.d;
      console.log(n.padEnd(28)+'  '+String(Math.round(100*t.w/g)).padStart(3)+'%  '+String(t.w).padStart(4)+' '+String(t.l).padStart(4)+'   '+t.d); }
    console.log('Side check: the ALLY (attacking) side won '+Math.round(100*SIDE.ally/SIDE.n)+'%, the enemy side '+Math.round(100*SIDE.enemy/SIDE.n)+'%, timeouts '+(SIDE.n-SIDE.ally-SIDE.enemy));
    console.log('\nHead to head (row win% vs column):'); console.log(''.padEnd(28)+names.map((n,i)=>String(i+1).padStart(5)).join(''));
    names.forEach((a,i)=>{ let line=(String(i+1)+' '+a).slice(0,28).padEnd(28); names.forEach(b=>{ if(a===b){ line+='    -'; return; } const r=res[a+' | '+b], s=res[b+' | '+a]; const w=r?r.wa:s.wb, g=r?(r.wa+r.wb+r.draw):(s.wa+s.wb+s.draw); line+=String(Math.round(100*w/g)).padStart(5); }); console.log(line); });
    console.log(String.fromCharCode(10)+'Per hero per fight (what each class actually dealt / healed in these fights):');
    for(const c of Object.keys(TEL).sort()){ const t=TEL[c]; if(!t.fights) continue; console.log('  '+c.padEnd(10)+' damage '+String(Math.round(t.dmg/t.fights)).padStart(7)+'   healing '+String(Math.round(t.heal/t.fights)).padStart(7)+'   stunned '+((t.stunned||0)/t.fights).toFixed(1)+' s   hits '+Math.round((t.hits||0)/t.fights)+'   by kind '+Object.keys(t).filter(x=>x.startsWith('k_')).map(x=>x.slice(2)+':'+Math.round(t[x]/t.fights)).join(' ')+'   ('+t.fights+' hero-fights)'); }
    if(opt('detail')){ console.log(''); console.log('Per hero (damage per fight / hits / extra targets hit in the same instant = area damage):');
      for(const k of Object.keys(TELK).sort((x,y)=>TELK[y].dmg/(TELK[y].fights||1)-TELK[x].dmg/(TELK[x].fights||1))){ const K=TELK[k]; if(!K.fights) continue; console.log('  '+(H[k].class+' '+k).padEnd(28)+String(Math.round(K.dmg/K.fights)).padStart(7)+String(Math.round(K.hits/K.fights)).padStart(6)+String(Math.round(K.multi/K.fights)).padStart(6)); }
      console.log('Fight length (sim seconds, avg):'); for(const fk in FT){ const L=FT[fk]; console.log('  '+fk.padEnd(50)+(L.reduce((a,b)=>a+b,0)/L.length).toFixed(1)); } }
    for(const c of Object.keys(TEL).filter(c=>c.startsWith('regen>')).sort()){ const cls=c.slice(6), f=(TEL[cls]||{}).fights||1; console.log('  self/passive healing on '+cls.padEnd(9)+String(Math.round(TEL[c].heal/f)).padStart(8)+' per hero per fight'); }
    if(opt('json')) fs.writeFileSync(opt('json'),JSON.stringify({N,res,tot},null,1));
  } finally { await stop(); } })().catch(e=>{ console.error(e); process.exitCode=1; });
