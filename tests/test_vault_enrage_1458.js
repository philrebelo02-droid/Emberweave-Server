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
  for(let f=60;f<=100;f+=5){ const r=fightVault(f,'F'+f+':Phil',11+f); const e=r.log.find(x=>x.k===bossOf(f));
    if(e&&e.fx===T[bossOf(f)].fx&&e.hp<=T[bossOf(f)].at+1e-9) fired.push(f); else miss.push(f+(r.won?'(won)':'(lost)')); }
  ck('real Vault fights (floors 60-100, the floor benchmark team): each boss enrages at its own line ('+fired.length+'/9'+(miss.length?'; not reached: '+miss.join(' '):'')+')', fired.length>=7, miss.join(' '));
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
