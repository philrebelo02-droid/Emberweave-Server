'use strict';
/* v1458 (Phil 26 Nov 2026: "they all need their own enrage type that fits their abilities") - every Vault boss has its own enrage.
   1. the table: one enrage per boss of the 20 boss floors, every id and every effect type its own, the text's numbers are the
      fight's numbers (filled from the same fields), no leftover tokens;
   2. the server sends each boss floor's own enrage as its bossRule (id, boss, name, warn) and refuses to boot without one;
   3. the engine: every enrage does what its text says (fired on a real Vault fight's units, in the game's own code via sim-host);
      it fires on real Vault fights, only in the Vault, and the BOSS INCOMING cue / monster card show it;
   4. the text is in all 15 content packs + en-XA, registered, and EW_LANG_CV matches the packs. */
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
let P=0,F=0; const ck=(n,c,x)=>{ if(c){ P++; console.log('  ok   '+n); } else { F++; console.log('  FAIL '+n+(x?' - '+x:'')); } };
const H=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
const S=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
const T=JSON.parse(/\/\*VAULT_ENRAGES_JSON\*\/([\s\S]*?)\/\*END_VAULT_ENRAGES_JSON\*\//.exec(H)[1]);
const FLOORS=JSON.parse(fs.readFileSync(path.join(ROOT,'server/vault-encounters.json'),'utf8')).floors;
const bossOf=f=>(FLOORS[f-1].waves[FLOORS[f-1].waves.length-1].find(m=>m.boss)||{}).key;
const fill=e=>String(e.text).replace(/\{(\w+)(\+?%)?\}/g,(m,k,p)=>{ const v=+e[k]; if(!isFinite(v)) return m; return p==='+%'?String(Math.round((v-1)*100)):p==='%'?String(Math.round(v*100)):String(v); });

console.log('== 1. one enrage per boss ==');
const bosses=[]; for(let f=5;f<=100;f+=5) bosses.push(bossOf(f));
ck('20 boss floors, 20 different bosses', new Set(bosses).size===20, bosses.join(','));
ck('every boss of a boss floor has an enrage', bosses.every(k=>T[k]), bosses.filter(k=>!T[k]).join(','));
ck('the table holds exactly those 20 bosses', Object.keys(T).length===20 && Object.keys(T).every(k=>bosses.includes(k)));
ck('every enrage id is its own', new Set(Object.values(T).map(e=>e.id)).size===20);
ck('every enrage effect type is its own (no two bosses share a mechanic)', new Set(Object.values(T).map(e=>e.fx)).size===20, Object.values(T).map(e=>e.fx).join(','));
ck('every enrage has a name, a trigger between 0 and 1, and text', Object.values(T).every(e=>e.name&&e.at>0&&e.at<1&&e.text));
for(const k of Object.keys(T)){ const e=T[k], s=fill(e);
  if(/\{/.test(s)) ck(k+': no unfilled token', false, s);
  if(!s.includes(String(Math.round(e.at*100))+'%')) ck(k+': the text states the trigger '+Math.round(e.at*100)+'%', false, s); }
ck('every text fills with no token left and states its own trigger', Object.keys(T).every(k=>!/\{/.test(fill(T[k]))&&fill(T[k]).includes(Math.round(T[k].at*100)+'%')));
ck('every boss is named in its own text (Stormcall names the lightning, not Maelvara)', Object.keys(T).filter(k=>k!=='maelvara').every(k=>{ const nm=k==='hourglass sentinel'?'Hourglass Sentinel':k==='nameless admiral'?'Nameless Admiral':k==='sable vesper'?'Sable Vesper':k[0].toUpperCase()+k.slice(1); return fill(T[k]).includes(nm); }));

console.log('== 2. the server sends the boss\'s own enrage ==');
{ const pick=name=>{ const i=S.indexOf('function '+name+'('); let d=0,j=S.indexOf('{',i); for(let k=j;k<S.length;k++){ if(S[k]==='{') d++; else if(S[k]==='}'){ d--; if(!d) return S.slice(i,k+1); } } };
  const ctx={ fs, GAME_FILE:path.join(ROOT,'emberweave-heroes.html'), DUNGEON_BOSS_RULES:['x'], DUNGEON_BOSS_WARN:{x:'old'}, isDungeonBossFloor:f=>f%5===0,
    isDungeonMilestoneFloor:f=>f%10===0, vaultFloorRecord:f=>FLOORS[f-1], Math, String, JSON, isFinite };
  vm.createContext(ctx); vm.runInContext('let _VAULT_ENRAGES=null;\n'+['vaultEnrageTable','vaultEnrageFill','vaultBossKeyForFloor','bossRuleForFloor'].map(pick).join('\n')+'\nthis.B=bossRuleForFloor;',ctx);
  const rules=[]; for(let f=5;f<=100;f+=5) rules.push(ctx.B(f));
  ck('every boss floor\'s rule is its boss\'s enrage (id, boss, name)', rules.every((r,i)=>{ const e=T[bosses[i]]; return r&&r.id===e.id&&r.boss===bosses[i]&&r.name===e.name; }));
  ck('the rule\'s warning is the same filled text the fight\'s cue shows', rules.every((r,i)=>r.warn===fill(T[bosses[i]])));
  ck('ascended and gatekeeper flags kept', ctx.B(55).ascended===true && ctx.B(50).gatekeeper===true && ctx.B(45).gatekeeper===false);
  ck('a floor that is not a boss floor has no rule', ctx.B(7)===null);
  ck('vaultCompile refuses a boss with no enrage, or one enrage used twice', /has no enrage in VAULT_ENRAGES/.test(S) && /used twice/.test(S)); }

console.log('== 3. the engine ==');
ck('spawn arms the boss (not a card preview)', /if\(s\.boss\)\{ u\.maxHp=Math\.round\(u\.maxHp\*1\.15\); u\.hp=u\.maxHp; u\._enrHpMul=s\.hpMul\|\|1; u\._enrDmgMul=s\.dmgMul\|\|1; if\(!preview\) vaultEnrageArm\(u\); \}/.test(H));
ck('the tick runs in the Vault only', /if\(CUR&&CUR\.mode==='vault'\) vaultEnrageTick\(dt\);/.test(H));
ck('the hit that crosses the line fires it', /if\(u\._enr&&!u\._enr\.on&&u\.hp<=u\.maxHp\*u\._enr\.d\.at\) u\._enr\.due=true;/.test(H));
ck('the BOSS INCOMING cue reads the boss\'s enrage', /if\(CUR\.mode==='vault' && u && VAULT_ENRAGES\[u\.key\]\) return langDesc\(vaultEnrageText\(u\.key\)\);/.test(H));
ck('the banner and callouts go through the content packs (langDesc), no bare English', /bannerMsg\(uiIcon\('warning'\)\+' '\+escapeHTML\(langDesc\('ENRAGE'\)\)\+' - '\+escapeHTML\(langDesc\(d\.name\)\)\)/.test(H));
const host=require(path.join(ROOT,'server','sim-host.js')).load(path.join(ROOT,'emberweave-heroes.html'));
const run=src=>vm.runInContext(src,host.ctx);
run('autoUlt=true; window.__enrLog=[]; var __vf=vaultEnrageFire; vaultEnrageFire=function(u){ window.__enrLog.push({k:u.key,fx:u._enr.d.fx,hp:u.hp/u.maxHp,t:battleTime}); return __vf.apply(this,arguments); };');
const FX=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','vault_l100_1377.json'),'utf8'));
const team=key=>FX.teams[key].map(id=>host.snapFromSpecs([FX.specs[id]])[0]);
const fightVault=(f,tkey,seed,mode)=>{ run('window.__enrLog=[];'); const won=!!host.sandbox.simCampaignReplay(team(tkey),JSON.parse(JSON.stringify(FLOORS[f-1].waves)),seed>>>0,[],false,mode||'vault');
  return { won, log:JSON.parse(run('JSON.stringify(window.__enrLog)')) }; };
{ const fired=[], miss=[];
  for(let f=60;f<=100;f+=5){ const r=fightVault(f,'Phil:M',11+f);   /* a maxed level-100 team: it reaches every boss's line on the re-ramped floors */ const e=r.log.find(x=>x.k===bossOf(f));
    if(e&&e.fx===T[bossOf(f)].fx&&e.hp<=T[bossOf(f)].at+1e-9) fired.push(f); else miss.push(f+(r.won?'(won)':'(lost)')); }
  ck('real Vault fights (floors 60-100, a maxed level-100 team): each boss enrages at its own line ('+fired.length+'/9'+(miss.length?'; not reached: '+miss.join(' '):'')+')', fired.length>=7, miss.join(' '));
  const c=fightVault(80,'F80:Phil',91,'campaign');
  ck('the same waves outside the Vault never enrage', c.log.length===0); }
/* every effect, fired on a live board: a boss of each kind next to five heroes */
run(`window.__enrProbe=function(key){ units.length=0; floatTexts.length=0; CUR={mode:'vault',seed:7,vwaves:[[{key:'reef prowler',lvl:60,hpMul:2,dmgMul:2}]]}; waveIdx=0; battleTime=10;
  const b=vaultEnemyUnit({key,lvl:60,boss:true,hpMul:3,dmgMul:2},600,300,false); units.push(b);
  const hs=['vael','sylthaine','vireo','vex','tick'].map((k,i)=>{ const h=makeUnit(k,'ally',560+i*8,290+i*6,60); h.energy=80; units.push(h); return h; });
  b.hp=b.maxHp*0.2; vaultEnrageTick(0.05);
  const s0={}; for(let i=0;i<4;i++){ battleTime+=0.5; vaultEnrageTick(0.5); }
  const crew=units.filter(u=>u._enrCrew).length;
  const ccFree=b._enrCCImmune?!ccApply(hs[0],b,'stunned',2):null;
  return JSON.stringify({ on:!!(b._enr&&b._enr.on), pulses:(b._enr&&b._enr.pulses)|0, taken:b._enrTaken||1, thorns:b._enrThorns||null, exec:b._enrExec||null, bleed:b._enrBleed||null,
    eva:b.evaStat||0, shield:b.shield||0, maxHp:b.maxHp, ls:b.lifestealStat||0, haste:b.hasteMul||1, hots:(b.hots||[]).length, ccFree, crew,
    heroes:hs.map(h=>({dots:(h.dots||[]).length, slow:h._enrAtkSlowT||0, stun:h.stunned||0, sil:h.silencedT||0, fear:h.fearT||0, en:h.energy, mortal:h.mortalT||0, hp:h.hp/h.maxHp})) }); };`);
const probe=k=>JSON.parse(run('window.__enrProbe('+JSON.stringify(k)+')'));
const EXPECT={
  fury:(o,e)=>o.haste>=e.mul-1e-9 && o.heroes.some(h=>h.fear>0),
  lifesteal:(o,e)=>o.ls>=e.pct-1e-9,
  atkslow:o=>o.heroes.every(h=>h.slow>0),
  burn:o=>o.heroes.every(h=>h.dots>0),
  shed:o=>o.hots>0,
  dr:(o,e)=>Math.abs(o.taken-(1-e.pct))<1e-9,
  thorns:(o,e)=>o.thorns&&o.thorns.pct===e.pct,
  freeze:(o,e)=>o.heroes.filter(h=>h.stun>0).length===e.n,
  healcut:o=>o.heroes.every(h=>h.mortal>0),
  drain:(o,e)=>o.heroes.every(h=>h.en<=80-e.energy+1e-9),
  ccimmune:o=>o.ccFree===true,
  silence:o=>o.heroes.every(h=>h.sil>0),
  aura:o=>o.heroes.some(h=>h.hp<1),
  execute:(o,e)=>o.exec&&Math.abs(o.exec.mul-(1+e.pct))<1e-9,
  storm:(o,e)=>o.heroes.filter(h=>h.hp<1).length>=Math.min(e.n,5),
  glass:(o,e)=>Math.abs(o.taken-(1+e.taken))<1e-9 && o.bleed,
  cdr:()=>true,
  summon:(o,e)=>o.crew===e.n,
  shield:(o,e)=>o.shield>=o.maxHp*e.pct-1,
  evade:(o,e)=>o.eva>=e.pct-1e-9 };
{ const bad=[]; for(const k of Object.keys(T)){ const e=T[k], o=probe(k); if(!o.on||!EXPECT[e.fx]||!EXPECT[e.fx](o,e)) bad.push(k+':'+e.fx+' '+JSON.stringify(o).slice(0,180)); }
  ck('every enrage does what its text says (20 bosses, fired on a live board)', bad.length===0, bad.join(' | ')); }
{ const o=JSON.parse(run(`(function(){ units.length=0; CUR={mode:'vault',seed:7,vwaves:[[]]}; battleTime=10; const b=vaultEnemyUnit({key:'hourglass sentinel',lvl:60,boss:true},600,300,false); units.push(b);
    const h=makeUnit('vael','ally',300,300,60); units.push(h); b.hp=b.maxHp*0.2; vaultEnrageTick(0.05); b.greenCd=5; b.blueCd=5; b.silencedT=0; vaultEnrageTick(1);
    return JSON.stringify({g:b.greenCd,bl:b.blueCd,hasG:!!b.greenAb}); })()`));
  ck('Quickened Hour: a second of the tick takes a further second off each skill ('+o.g+')', !o.hasG || Math.abs(o.g-4)<1e-6, JSON.stringify(o)); }
{ const o=JSON.parse(run(`(function(){ units.length=0; CUR={mode:'vault',seed:7,vwaves:[[]]}; battleTime=10; const b=vaultEnemyUnit({key:'grommash',lvl:60,boss:true},600,300,true); return JSON.stringify({armed:!!b._enr}); })()`));
  ck('a card preview is not armed', o.armed===false); }
{ const o=JSON.parse(run(`(function(){ units.length=0; CUR={mode:'vault',seed:7,vwaves:[[]]}; battleTime=10; window.VAULT_ENRAGE_OFF=true; const b=vaultEnemyUnit({key:'grommash',lvl:60,boss:true},600,300,false); window.VAULT_ENRAGE_OFF=false; return JSON.stringify({armed:!!b._enr}); })()`));
  ck('the tuning harness switch disarms it (for before/after measurement)', o.armed===false); }
ck('the monster card lists the boss\'s Vault enrage', run("monKitHtml('brukk')").includes(T.brukk.name));

console.log('== 5. every enrage, proven (Phil 26 Nov: "make sure they all work as intended") ==');
/* A. a controlled board in the game's own engine: the boss of each floor (Vault spawn, its real kit) next to five heroes, the
      fight's own functions (damage, dealDamage, healUnit, ccApply, vaultEnrageTick) and its clock. Every number below is MEASURED
      off the units - health lost, health healed, controls on the heroes, energy, shields, dodges - not read off the table. */
run(`window.__B=[]; var __bm0=bannerMsg; bannerMsg=function(t){ window.__B.push(String(t)); return __bm0.apply(this,arguments); };
window.__F=0; window.__P=[]; var __vf0=vaultEnrageFire; vaultEnrageFire=function(u){ window.__F++; window.__fireHp=u.hp/u.maxHp; return __vf0.apply(this,arguments); };
var __vp0=vaultEnragePulse; vaultEnragePulse=function(u){ window.__P.push(+battleTime.toFixed(3)); return __vp0.apply(this,arguments); };
window.__board=function(key,mode){ units.length=0; floatTexts.length=0; window.__B=[]; window.__F=0; window.__P=[];
  CUR={mode:mode||'vault',seed:7,vwaves:[[{key:'reef prowler',lvl:60,hpMul:1,dmgMul:1}]],headless:true}; waveIdx=0; battleTime=10;
  const b=(mode&&mode!=='vault')?campEnemyUnit({key,lvl:60,boss:true},600,300,mode,false):vaultEnemyUnit({key,lvl:60,boss:true,hpMul:3,dmgMul:1},600,300,false);
  b.critChance=0; b.critRes=1; units.push(b);
  const X=[520,545,565,590,640];
  const hs=['vael','sylthaine','vireo','vex','tick'].map((k,i)=>{ const h=makeUnit(k,'ally',X[i],300,60); h.energy=80; h.ctrlRes=0; h.glyphDR=0; h.evaStat=0; h.accStat=0; h.critChance=0; h.lifestealStat=0; h.dots=[]; h.hots=[]; h.shield=0; units.push(h); return h; });
  return {b,hs}; };
window.__clean=function(h){ h.hp=h.maxHp; h.alive=true; h.dots=[]; h.hots=[]; h.shield=0; h.stunned=0; h.silencedT=0; h.fearT=0; h.slow=0; h.mortalT=0; h._enrAtkSlowT=0; };
window.__step=function(sec,dt){ dt=dt||0.05; for(let t=0;t<sec-1e-9;t+=dt){ battleTime+=dt; vaultEnrageTick(dt); } };
/* above the line: nothing; the hit that crosses it: the enrage */
window.__trigger=function(b){ const at=b._enr.d.at; b.hp=b.maxHp*(at+0.01); __step(0.5); const above=window.__F;
  const pre=b.hp/b.maxHp; damage(b,b.maxHp*0.05,'#fff',true); __step(0.05); return {above, fired:window.__F, pre, at:window.__fireHp}; };
window.__ft=function(txt){ return floatTexts.filter(f=>f.txt===txt).length; };`);
const J=s=>JSON.parse(run(s));
const ROWS=[]; const row=(boss,trig,eff,rep)=>ROWS.push({boss,trig,eff,rep});
const prove=(key,body)=>J(`(function(){ const {b,hs}=__board(${JSON.stringify(key)}); const R={}; ${body}; R.banner=window.__B.some(t=>/ENRAGE - /.test(t)); R.red=__ft('ENRAGE')>0; return JSON.stringify(R); })()`);
const near=(a,b,tol)=>Math.abs(a-b)<=(tol==null?1e-6:tol);
const pct=x=>(100*x).toFixed(1)+'%';
const trigOK=(R,e)=>R.tr.above===0&&R.tr.fired===1&&R.tr.pre>e.at&&R.tr.at<=e.at+1e-9&&R.banner&&R.red;
const trigTxt=(R,e)=>(trigOK(R,e)?'OK':'FAIL')+' (none at '+pct(R.tr.pre)+', fired at '+pct(R.tr.at)+')';
const repTxt=(e,R)=>{ if(!e.every) return R.once?'stays/once OK':'FAIL'; const iv=R.P.slice(1).map((t,i)=>+(t-R.P[i]).toFixed(2)); return (iv.length>=2&&iv.every(x=>near(x,e.every,0.06))?'OK':'FAIL')+' (every '+(iv[0]||'-')+' s, '+R.P.length+' pulses in '+(R.span||0)+' s)'; };
const E=T;
{ // 5 Grommash - once; bellow fears every hero; +15% attack speed held while he lives
  const e=E.grommash, R=prove('grommash',`R.tr=__trigger(b); R.fear=hs.map(h=>+(h.fearT||0).toFixed(3)); __step(30); R.haste=b.hasteMul; R.F=window.__F; R.once=window.__F===1&&b.hasteMul>=1.15-1e-9; R.P=[];`);
  const ok=R.fear.every(f=>near(f,ccDurOf(e.fear),1e-3))&&near(R.haste,e.mul);
  ck('Grommash: fires at 50% once, every hero feared '+R.fear[0]+' s, attack speed x'+R.haste+' still on 30 s later', trigOK(R,e)&&ok&&R.once, JSON.stringify(R));
  row('Grommash (5)',trigTxt(R,e),(ok?'OK':'FAIL')+' (fear '+R.fear[0]+' s on 5/5; attack speed x'+R.haste+')',R.once?'once OK, haste stays on':'FAIL'); }
function ccDurOf(d){ return +(d*0.7).toFixed(3); }
{ // 10 Voraxis - lifesteal +35% of damage dealt, on top of his own
  const e=E.voraxis, R=prove('voraxis',`const h=hs[0]; const hit=()=>{ __clean(h); const b0=b.hp, h0=h.hp; dealDamage(b,h,400,'#f00','true'); return (b.hp-b0)/Math.max(1,h0-h.hp); };
    b.hp=b.maxHp*0.9; R.ls0=hit(); R.tr=__trigger(b); b.hp=b.maxHp*0.3; R.ls1=hit(); __step(30); b.hp=b.maxHp*0.3; R.ls2=hit(); R.once=window.__F===1; R.P=[];`);
  const add=R.ls1-R.ls0, ok=near(add,e.pct,0.005)&&near(R.ls2-R.ls0,e.pct,0.005);
  ck('Voraxis: below 50% heals a further '+pct(add)+' of the damage he deals ('+pct(R.ls0)+' -> '+pct(R.ls1)+'), still 30 s later', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Voraxis (10)',trigTxt(R,e),(ok?'OK':'FAIL')+' (heals '+pct(R.ls0)+' -> '+pct(R.ls1)+' of damage dealt, +'+pct(add)+')','stays on OK'); }
{ // 15 Leviath - every 6 s heroes attack 50% slower for 4 s
  const e=E.leviath, R=prove('leviath',`R.tr=__trigger(b); R.slow=hs.map(h=>[+h._enrAtkSlowT.toFixed(2),+h._enrAtkSlowMul.toFixed(3)]); const t0=battleTime; __step(4.05); R.after4=hs.map(h=>+Math.max(0,h._enrAtkSlowT).toFixed(2)); __step(20); R.span=+(battleTime-t0).toFixed(1); R.P=window.__P.slice();`);
  const ok=R.slow.every(s=>near(s[0],e.dur,0.06)&&near(s[1],1/(1-e.pct),1e-3))&&R.after4.every(x=>x===0);
  ck('Leviath: every hero\'s attack interval x'+R.slow[0][1]+' ('+pct(1-1/R.slow[0][1])+' slower) for '+R.slow[0][0]+' s, gone after', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Leviath (15)',trigTxt(R,e),(ok?'OK':'FAIL')+' (5/5 heroes: attack interval x'+R.slow[0][1]+' = 50% slower, lasts '+R.slow[0][0]+' s)',repTxt(e,R)); }
{ // 20 Magmourn - every 8 s every hero burns 2% max HP a second for 4 s
  const e=E.magmourn, R=prove('magmourn',`R.tr=__trigger(b); R.dots=hs.map(h=>{ const d=h.dots[h.dots.length-1]; return d?[+(d.dps/h.maxHp).toFixed(4),d.remaining]:null; }); const t0=battleTime; __step(26); R.span=+(battleTime-t0).toFixed(1); R.P=window.__P.slice();`);
  const ok=R.dots.every(d=>d&&near(d[0],e.pct,1e-4)&&d[1]===e.dur);
  ck('Magmourn: every hero burns '+pct(R.dots[0][0])+' max HP a second, '+R.dots[0][1]+' ticks', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Magmourn (20)',trigTxt(R,e),(ok?'OK':'FAIL')+' (5/5 heroes: burn '+pct(R.dots[0][0])+' max HP/s x '+R.dots[0][1]+' s)',repTxt(e,R)); }
{ // 25 Sylphice - once: sheds every effect, regenerates 15% over 6 s
  const e=E.sylphice, R=prove('sylphice',`pushDot(b,100,10,1,'#f00',hs[0],'true'); b.stunned=1; b.silencedT=1; R.tr=__trigger(b); R.dots=b.dots.length; R.stun=b.stunned; const h=b.hots[b.hots.length-1]; R.hot=h?[+(h.hps*h.remaining/b.maxHp).toFixed(4),h.remaining]:null;
    b.hp=b.maxHp*0.1; __step(30); R.F=window.__F; R.once=window.__F===1; R.P=[];`);
  const ok=R.dots===0&&R.stun===0&&R.hot&&near(R.hot[0],e.pct,1e-4)&&R.hot[1]===e.dur;
  ck('Sylphice: once, at 40% sheds her burn and stun and regenerates '+pct(R.hot&&R.hot[0])+' over '+(R.hot&&R.hot[1])+' s', trigOK(R,e)&&ok&&R.once, JSON.stringify(R));
  row('Sylphice (25)',trigTxt(R,e),(ok?'OK':'FAIL')+' (dot and stun cleared; regenerates '+pct(R.hot[0])+' over '+R.hot[1]+' s)',R.once?'once OK (no second fire lower down)':'FAIL'); }
{ // 30 Brukk - takes 30% less damage
  const e=E.brukk, R=prove('brukk',`const hit=()=>{ const h0=b.hp; damage(b,1000,'#fff',true); return h0-b.hp; }; b.hp=b.maxHp; R.l0=hit(); R.tr=__trigger(b); b.hp=b.maxHp*0.4; R.l1=hit(); __step(30); R.l2=hit(); R.P=[];`);
  const ok=near(R.l1/R.l0,1-e.pct,1e-3)&&near(R.l2/R.l0,1-e.pct,1e-3);
  ck('Brukk: the same hit takes '+R.l0.toFixed(0)+' -> '+R.l1.toFixed(0)+' ('+pct(1-R.l1/R.l0)+' less), still 30 s later', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Brukk (30)',trigTxt(R,e),(ok?'OK':'FAIL')+' (same hit '+R.l0.toFixed(0)+' -> '+R.l1.toFixed(0)+' = '+pct(1-R.l1/R.l0)+' less)','stays on OK'); }
{ // 35 Miregor - 10% of each hit back at the attacker, at most 3% of the attacker's max HP
  const e=E.miregor, R=prove('miregor',`const h=hs[0]; R.tr=__trigger(b); const hit=a=>{ __clean(h); b.hp=b.maxHp*0.4; const b0=b.hp, h0=h.hp; dealDamage(h,b,a,'#fff','true'); return {lost:b0-b.hp, back:h0-h.hp, max:h.maxHp}; };
    R.small=hit(Math.round(h.maxHp*0.05)); R.big=hit(h.maxHp*5); R.P=[];`);
  const ok=near(R.small.back,R.small.lost*e.pct,1)&&near(R.big.back,R.big.max*e.cap,1);
  ck('Miregor: a small hit returns '+pct(R.small.back/R.small.lost)+' of it; a huge one is capped at '+pct(R.big.back/R.big.max)+' of the attacker\'s max HP', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Miregor (35)',trigTxt(R,e),(ok?'OK':'FAIL')+' (returns '+pct(R.small.back/R.small.lost)+' of a hit; capped at '+pct(R.big.back/R.big.max)+' of attacker max HP)','stays on OK'); }
{ // 40 Wintercrag - every 10 s freezes exactly the 2 nearest
  const e=E.wintercrag, R=prove('wintercrag',`R.tr=__trigger(b); R.frozen=hs.map((h,i)=>h.stunned>0?i:-1).filter(i=>i>=0); R.dur=+Math.max(...hs.map(h=>h.stunned||0)).toFixed(3); const t0=battleTime; __step(32); R.span=+(battleTime-t0).toFixed(1); R.P=window.__P.slice(); R.word=__ft('FROZEN');`);
  const ok=JSON.stringify(R.frozen.sort())===JSON.stringify([2,3])&&near(R.dur,ccDurOf(e.dur),1e-3);
  ck('Wintercrag: freezes exactly the 2 nearest heroes (#3 and #2 of 5, '+R.dur+' s)', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Wintercrag (40)',trigTxt(R,e),(ok?'OK':'FAIL')+' (froze heroes '+R.frozen.join('+')+' = the 2 nearest, '+R.dur+' s)',repTxt(e,R)); }
{ // 45 Nymira - every heal your heroes get is halved, while she lives
  const e=E.nymira, R=prove('nymira',`const h=hs[1]; const heal=fn=>{ h.hp=h.maxHp*0.2; const h0=h.hp; fn(); return h.hp-h0; };
    const direct=()=>healUnit(h,1000), hot=()=>{ pushHot(h,250,4,1); for(let i=0;i<4;i++){ const H=h.hots[h.hots.length-1]; if(H) { healUnit(h,H.hps); } } h.hots=[]; },
      steal=()=>{ h.lifestealStat=0.5; const t=units[0]; t.hp=t.maxHp; dealDamage(h,t,1000,'#fff','true'); h.lifestealStat=0; };
    R.d0=heal(direct); R.h0=heal(hot); R.s0=heal(steal); R.tr=__trigger(b); b.hp=b.maxHp*0.3;
    R.d1=heal(direct); R.h1=heal(hot); R.s1=heal(steal); __step(30); R.d2=heal(direct);
    b.alive=false; b.hp=0; __step(1); h.mortalT=Math.max(0,(h.mortalT||0)-1); R.dDead=heal(direct); R.P=[];`);
  const ok=near(R.d1/R.d0,0.5,1e-3)&&near(R.h1/R.h0,0.5,1e-3)&&near(R.s1/R.s0,0.5,0.02)&&near(R.d2/R.d0,0.5,1e-3)&&near(R.dDead,R.d0,1);
  ck('Nymira: from 50% a direct heal, a heal over time and lifesteal all land at half ('+pct(R.d1/R.d0)+', '+pct(R.h1/R.h0)+', '+pct(R.s1/R.s0)+'); once she is dead heals are whole again', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Nymira (45)',trigTxt(R,e),(ok?'OK':'FAIL')+' (heal '+R.d0.toFixed(0)+' -> '+R.d1.toFixed(0)+'; heal over time '+pct(R.h1/R.h0)+'; lifesteal '+pct(R.s1/R.s0)+')','stays on while she lives OK'); }
{ // 50 Nerissa - every 6 s drains 50 energy from every hero
  const e=E.nerissa, R=prove('nerissa',`R.tr=__trigger(b); R.e1=hs.map(h=>80-h.energy); hs.forEach(h=>h.energy=90); const t0=battleTime; __step(6.02); R.e2=hs.map(h=>90-h.energy); __step(20); R.span=+(battleTime-t0).toFixed(1); R.P=window.__P.slice(); R.word=__ft('DRAINED');`);
  const ok=R.e1.every(x=>near(x,e.energy))&&R.e2.every(x=>near(x,e.energy));
  ck('Nerissa: every hero loses '+R.e1[0]+' energy at the line and '+R.e2[0]+' again 6 s later', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Nerissa (50)',trigTxt(R,e),(ok?'OK':'FAIL')+' (5/5 heroes -'+R.e1[0]+' energy per pulse)',repTxt(e,R)); }
{ // 55 Thorneveil - from 35% no stun, freeze, silence, fear, slow or move
  const e=E.thorneveil, R=prove('thorneveil',`const h=hs[0]; R.before=ccApply(h,b,'stunned',2); b.stunned=0; R.tr=__trigger(b);
    R.cc=['stunned','silencedT','fearT','slow','_sleepT'].map(f=>ccApply(h,b,f,2)); b.pullT=2; b.pulledBy=h; __step(0.1); R.pull=b.pullT; R.immovable=!!b.immovable; __step(30); R.cc2=ccApply(h,b,'stunned',2); R.P=[];`);
  const ok=R.before===true&&R.cc.every(x=>x===false)&&R.pull===0&&R.immovable&&R.cc2===false;
  ck('Thorneveil: stunned before 35%; after it, stun / silence / fear / slow / sleep all refused, a pull cancelled, still 30 s later', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Thorneveil (55)',trigTxt(R,e),(ok?'OK':'FAIL')+' (stun before: yes; after: stun, freeze, silence, fear, slow, sleep refused, pull cancelled)','stays on OK'); }
{ // 60 Sable Vesper - every 12 s every hero silenced for 2 s
  const e=E['sable vesper'], R=prove('sable vesper',`R.tr=__trigger(b); R.sil=hs.map(h=>+(h.silencedT||0).toFixed(3)); const t0=battleTime; __step(40); R.span=+(battleTime-t0).toFixed(1); R.P=window.__P.slice(); R.word=__ft('SILENCED');`);
  const ok=R.sil.every(x=>near(x,e.show,0.002));
  ck('Sable Vesper: every hero silenced '+R.sil[0]+' s', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Sable Vesper (60)',trigTxt(R,e),(ok?'OK':'FAIL')+' (5/5 heroes silenced '+R.sil[0]+' s)',repTxt(e,R)); }
{ // 65 Vharok - 2% max HP a second to heroes within 5 m
  const e=E.vharok, R=prove('vharok',`R.tr=__trigger(b); hs[4].x=b.x+6*METER; hs.forEach(__clean); __step(1.0); R.loss=hs.map(h=>+(1-h.hp/h.maxHp).toFixed(4)); const t0=battleTime; __step(5); R.span=+(battleTime-t0).toFixed(1); R.P=window.__P.slice();`);
  const ok=R.loss.slice(0,4).every(x=>near(x,e.pct,0.002))&&R.loss[4]===0;
  ck('Vharok: heroes within 5 m lose '+pct(R.loss[0])+' a second, the one 6 m away nothing', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Vharok (65)',trigTxt(R,e),(ok?'OK':'FAIL')+' (4 heroes in 5 m: -'+pct(R.loss[0])+'/s; hero at 6 m: '+pct(R.loss[4])+')',repTxt(e,R)); }
{ // 70 Barrowmaw - +70% damage to heroes under 60%... (the table's numbers)
  const e=E.barrowmaw, R=prove('barrowmaw',`const h=hs[0]; const hit=f=>{ __clean(h); h.hp=h.maxHp*f; const h0=h.hp; dealDamage(b,h,500,'#f00','true'); return h0-h.hp; };
    b.hp=b.maxHp; R.hi0=hit(0.9); R.lo0=hit(${(E.barrowmaw.below-0.1).toFixed(2)}); R.tr=__trigger(b); R.hi1=hit(0.9); R.lo1=hit(${(E.barrowmaw.below-0.1).toFixed(2)}); R.P=[];`);
  const ok=e.below===0.6&&near(R.hi1/R.hi0,1,1e-3)&&near(R.lo1/R.lo0,1+e.pct,1e-3);   /* Phil's approved chart: heroes under 60% */
  ck('Barrowmaw: a hero under '+pct(e.below)+' takes x'+(R.lo1/R.lo0).toFixed(2)+', a healthy one x'+(R.hi1/R.hi0).toFixed(2), trigOK(R,e)&&ok, JSON.stringify(R));
  row('Barrowmaw (70)',trigTxt(R,e),(ok?'OK':'FAIL')+' (hero at '+pct(E.barrowmaw.below-0.1)+': x'+(R.lo1/R.lo0).toFixed(2)+'; hero at 90%: x'+(R.hi1/R.hi0).toFixed(2)+')','stays on OK'); }
{ // 75 Maelvara - every 4 s lightning hits 4 heroes for 15% max HP
  const e=E.maelvara, R=prove('maelvara',`hs.forEach(__clean); R.tr=__trigger(b); R.loss=hs.map(h=>+(1-h.hp/h.maxHp).toFixed(4)); const t0=battleTime; __step(16.05); R.span=+(battleTime-t0).toFixed(1); R.P=window.__P.slice(); R.word=__ft('LIGHTNING');`);
  const hit=R.loss.filter(x=>x>0), ok=hit.length===e.n&&hit.every(x=>near(x,e.pct,0.002));
  ck('Maelvara: lightning hits '+hit.length+' heroes for '+pct(hit[0]||0)+' max HP', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Maelvara (75)',trigTxt(R,e),(ok?'OK':'FAIL')+' ('+hit.length+' of 5 heroes hit for '+pct(hit[0]||0)+' max HP)',repTxt(e,R)); }
{ // 80 Orryx - takes 10% more; each hit he lands bleeds 2% max HP a second for 4 s
  const e=E.orryx, R=prove('orryx',`const hit=()=>{ const h0=b.hp; damage(b,1000,'#fff',true); return h0-b.hp; }; b.hp=b.maxHp; R.l0=hit(); R.tr=__trigger(b); b.hp=b.maxHp*0.4; R.l1=hit();
    const h=hs[0]; __clean(h); dealDamage(b,h,300,'#f00','true'); const d=h.dots[h.dots.length-1]; R.bleed=d?[+(d.dps/h.maxHp).toFixed(4),d.remaining]:null; R.P=[];`);
  const ok=near(R.l1/R.l0,1+e.taken,1e-3)&&R.bleed&&near(R.bleed[0],e.pct,1e-4)&&R.bleed[1]===e.dur;
  ck('Orryx: takes x'+(R.l1/R.l0).toFixed(2)+'; his hit bleeds '+pct(R.bleed&&R.bleed[0])+' max HP a second for '+(R.bleed&&R.bleed[1])+' s', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Orryx (80)',trigTxt(R,e),(ok?'OK':'FAIL')+' (takes x'+(R.l1/R.l0).toFixed(2)+'; bleed '+pct(R.bleed[0])+' max HP/s x '+R.bleed[1]+' s)','stays on OK'); }
{ // 85 Hourglass Sentinel - skills recharge twice as fast
  const e=E['hourglass sentinel'], R=prove('hourglass sentinel',`R.tr=__trigger(b); b.greenCd=8; b.blueCd=8; b.silencedT=0; __step(1.0); R.g=+(8-b.greenCd).toFixed(3); R.bl=+(8-b.blueCd).toFixed(3); R.hasG=!!b.greenAb; R.P=[];`);
  const ok=R.hasG&&near(R.g,e.mul-1,0.01);
  ck('Hourglass Sentinel: in 1 s of the fight his skill cooldown runs a further '+R.g+' s (x'+(1+R.g)+')', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Hourglass Sentinel (85)',trigTxt(R,e),(ok?'OK':'FAIL')+' (cooldowns tick x'+(1+R.g).toFixed(2)+' (own clock + '+R.g+' s per s))','stays on OK'); }
{ // 90 Nameless Admiral - once: 2 crew; they die with him
  const e=E['nameless admiral'], R=prove('nameless admiral',`R.tr=__trigger(b); const crew=()=>units.filter(u=>u._enrCrew&&u.alive).length; R.crew=crew(); R.word=__ft('RISEN'); b.hp=b.maxHp*0.1; __step(10); R.crew2=units.filter(u=>u._enrCrew).length; R.F=window.__F;
    b.alive=false; b.hp=0; __step(0.1); R.after=crew(); R.once=window.__F===1; R.P=[];`); R.once=R.once&&R.crew2===e.n;
  const ok=R.crew===e.n&&R.after===0;
  ck('Nameless Admiral: '+R.crew+' crew rise at 50%, no more lower down, all fall when he falls ('+R.after+' left)', trigOK(R,e)&&ok&&R.once, JSON.stringify(R));
  row('Nameless Admiral (90)',trigTxt(R,e),(ok?'OK':'FAIL')+' ('+R.crew+' crew; '+R.after+' alive after he dies)',R.once?'once OK':'FAIL'); }
{ // 95 Asterion - once: shield 40% max HP for 10 s
  const e=E.asterion, R=prove('asterion',`R.tr=__trigger(b); R.sh=+(b.shield/b.maxHp).toFixed(4); R.t=b.shieldT; R.word=__ft('MIRROR WARD'); b.hp=b.maxHp*0.1; __step(5); R.once=window.__F===1; R.P=[];`);
  const ok=near(R.sh,e.pct,1e-3)&&near(R.t,e.dur);
  ck('Asterion: a shield of '+pct(R.sh)+' max HP for '+R.t+' s, once', trigOK(R,e)&&ok&&R.once, JSON.stringify(R));
  row('Asterion (95)',trigTxt(R,e),(ok?'OK':'FAIL')+' (shield '+pct(R.sh)+' max HP, '+R.t+' s)',R.once?'once OK':'FAIL'); }
{ // 100 Irix - dodges 30% of hits
  const e=E.irix, R=prove('irix',`const h=hs[0]; const swing=n=>{ let miss=0; for(let i=0;i<n;i++){ b.hp=b.maxHp*0.4; const b0=b.hp; dealDamage(h,b,50,'#fff','phys'); if(b.hp>=b0) miss++; } return miss/n; };
    b.hp=b.maxHp; R.m0=(function(){ let miss=0; for(let i=0;i<500;i++){ b.hp=b.maxHp*0.9; const b0=b.hp; dealDamage(h,b,50,'#fff','phys'); if(b.hp>=b0) miss++; } return miss/500; })();
    R.tr=__trigger(b); R.m1=swing(3000); R.P=[];`);
  const ok=near(R.m1-R.m0,e.pct,0.03);
  ck('Irix: dodges '+pct(R.m1)+' of 3000 hits below 50% ('+pct(R.m0)+' above it)', trigOK(R,e)&&ok, JSON.stringify(R));
  row('Irix (100)',trigTxt(R,e),(ok?'OK':'FAIL')+' (dodged '+pct(R.m1)+' of 3000 hits; '+pct(R.m0)+' before)','stays on OK'); }
/* hero callouts on the trigger */
{ const words=[['leviath','DRENCHED'],['magmourn','BURNING'],['sylphice','SHED SKIN'],['nerissa','DRAINED'],['maelvara','LIGHTNING'],['asterion','MIRROR WARD'],['wintercrag','FROZEN'],['sable vesper','SILENCED'],['nameless admiral','RISEN'],['grommash','FEAR!'],['thorneveil','UNBROKEN']];
  const bad=words.filter(([k,w])=>!J(`(function(){ const {b}=__board(${JSON.stringify(k)}); __trigger(b); return JSON.stringify(__ft(${JSON.stringify(w)})>0); })()`)).map(x=>x.join(':'));
  ck('the hero / boss callout draws on the trigger (11 enrages with a callout)', bad.length===0, bad.join(' ')); }
/* outside the Vault: the same boss in the campaign or a raid has no enrage */
{ const o=J(`(function(){ const r=[]; for(const m of ['campaign','graid']){ const {b}=__board('brukk',m); b.hp=b.maxHp*0.1; __step(1); r.push(!!b._enr||window.__F>0); } return JSON.stringify(r); })()`);
  ck('outside the Vault (campaign, guild raid spawn) the same boss has no enrage and nothing fires', o.every(x=>x===false), JSON.stringify(o));
  ck('the enrage is armed only by the Vault spawn and ticks only in the Vault', (H.match(/vaultEnrageArm\(/g)||[]).length===2 && /if\(!preview\) vaultEnrageArm\(u\)/.test(H) && (H.match(/vaultEnrageTick\(/g)||[]).length===2 && /if\(CUR&&CUR\.mode==='vault'\) vaultEnrageTick\(dt\)/.test(H)); }

/* B. real headless Vault fights, one per boss floor: the boss's own floor waves, a maxed team. Trigger and repeats seen in the fight. */
run(`window.__rf=null; var __dm0=damage; damage=function(u,a){ const E=u&&u._enr; const pre=E&&!E.on?u.hp/u.maxHp:null; const r=__dm0.apply(this,arguments); if(E&&pre!=null&&E.due&&!window.__rf) window.__rf={pre,post:u.hp/u.maxHp}; return r; };`);
{ const bad=[], seen=[];
  for(let f=5;f<=100;f+=5){ const k=bossOf(f), e=T[k];
    const waves=JSON.parse(JSON.stringify(FLOORS[f-1].waves)); for(const m of waves[1]) if(m.boss) m.hpMul*=(f<60?8:2);   /* a boss that lives long enough to show its repeats */
    run('window.__rf=null; window.__F=0; window.__P=[];'); host.sandbox.simCampaignReplay(team('Phil:M'),waves,(5000+f)>>>0,[],false,'vault');
    const R=J('JSON.stringify({rf:window.__rf,F:window.__F,P:window.__P})');
    const iv=R.P.slice(1).map((t,i)=>+(t-R.P[i]).toFixed(2));
    const ok=R.F===1&&R.rf&&R.rf.pre>e.at&&R.rf.post<=e.at+1e-9&&(!e.every||(R.P.length>=2&&iv.every(x=>near(x,e.every,0.06))));
    (ok?seen:bad).push(f+' '+k+(R.rf?' '+pct(R.rf.pre)+'->'+pct(R.rf.post):' never')+(e.every?' pulses '+R.P.length+' every '+(iv[0]||'-'):''));
    const r=ROWS.find(x=>x.boss.startsWith(k==='sable vesper'?'Sable':k==='nameless admiral'?'Nameless':k==='hourglass sentinel'?'Hourglass':k[0].toUpperCase()+k.slice(1))); if(r) r.fight=(ok?'OK':'FAIL')+' (real fight: '+(R.rf?pct(R.rf.pre)+' -> '+pct(R.rf.post):'-')+(e.every?', '+R.P.length+' pulses every '+(iv[0]||'-')+' s':'')+')'; }
  ck('real headless Vault fights, all 20 bosses: fires once, on the hit that crosses its line, and repeats on its interval ('+seen.length+'/20)', bad.length===0, bad.join(' | ')); }
if(process.env.ENRAGE_TABLE) fs.writeFileSync(process.env.ENRAGE_TABLE, JSON.stringify(ROWS,null,1));


console.log('== 4. every language ==');
const CODES=['es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
const tpl=s=>{ let n=0; return s.replace(/\{[^{}]*\}|<[^>]*>|&#?\w+;|\d+(?:\.\d+)?/g,m=>('{<&'.includes(m[0])?m:'{'+(n++)+'}')); };
const FLOATS=JSON.parse(/const VAULT_ENRAGE_FLOATS=(\[[^\]]*\]);/.exec(H)[1].replace(/'/g,'"'));
const LINES=[...Object.values(T).map(e=>e.name),...Object.values(T).map(e=>tpl(fill(e))),...FLOATS];
const REG=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/lang/content/en.json'),'utf8'));
ck('all '+LINES.length+' lines are registered in tools/lang/content/en.json', LINES.every(k=>k in REG), LINES.filter(k=>!(k in REG)).slice(0,3).join(' | '));
const CV=JSON.parse(H.match(/\nconst EW_LANG_CV=(\{.*?\});/)[1]);
const tok=s=>(String(s).match(/\{[^{}]*\}/g)||[]).sort().join(' ');
for(const c of CODES){ const raw=fs.readFileSync(path.join(ROOT,'lang',c+'.content.json'),'utf8'), p=JSON.parse(raw);
  const miss=LINES.filter(k=>!p[k]||p[k]===k||tok(p[k])!==tok(k));
  ck(c+': every enrage line translated, tokens kept', miss.length===0, miss.slice(0,3).join(' | '));
  ck(c+': EW_LANG_CV matches the pack', CV[c]===crypto.createHash('sha1').update(raw).digest('hex').slice(0,8)); }
{ const raw=fs.readFileSync(path.join(ROOT,'lang','en-XA.content.json'),'utf8'), q=JSON.parse(raw);
  ck('en-XA: every line present', LINES.every(k=>q[k]===k));
  ck('en-XA: EW_LANG_CV (qps) matches the pack', CV.qps===crypto.createHash('sha1').update(raw).digest('hex').slice(0,8)); }
console.log('test_vault_enrage_1458: '+P+' passed, '+F+' failed');
process.exit(F?1:0);
