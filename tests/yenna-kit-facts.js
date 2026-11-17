'use strict';
/* Yenna Cacklefang's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on: how often
   each of her skills fires and what it reaches in seeded fights with NO talents learned - Rending Return (casts, how many enemies the outward pass struck, how far
   they stood, whether they were the nearest, the return's hits and kills), Laughing Mark (casts, whom it marks, the mark's strength, and what an ally's critical
   hit on the marked enemy gives in energy - the card says it restores energy), Crescent Stampede (casts, marked enemies at the cast, its hops), Pack Opportunist
   (which of its three lines hold on her hits), the enemies close to her (her Nerves read who comes within 3 m), the hits she takes, and her allies' places in the
   formation (Litter Mates). Run: node tests/yenna-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __yk={fights:0,ticks:0,rr:0,rrN:[],rrD:[],rrNear:0,rrNotNear:0,rrInR:0,rrOutR:0,back:0,backHit:0,backKill:0,outKill:0,lm:0,lmLow:0,lmMul:[],lmDur:[],critMk:0,critMkE:[],critUn:0,critUnE:[],ult:0,ultMk:[],ultHops:[],po:{n:0,alone:0,held:0,dying:0,any:0},near3:[],hitsOnMe:0,meleeOnMe:0,autos:0,crits:0,myKill:{auto:0,green:0,blue:0,ult:0,back:0},markAnyT:0,markHolder:{}};'+
  'var __yD=_doEffectCore, __yU=_updateBattleCore, __yDD=_dealDamageCore, __yIn=0, __yBack=0;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="yenna"&&(!o||!o.deliver||o._arrived);'+
  '  let pre=null; if(me&&type==="markreveal"){ let lo=null,bv=2; for(const e of enemiesOf(u)) if(e.alive){ const f=e.hp/e.maxHp; if(f<bv){bv=f;lo=e;} } pre=lo; }'+
  '  if(me&&type==="multiShot"){ __yk.ult++; __yk.ultMk.push(enemiesOf(u).filter(e=>e.alive&&(e._markT||0)>0).length); const g0=groundHazards.length; __yIn++; let r; try{ r=__yD.apply(this,arguments); } finally{ __yIn--; } __yk.ultHops.push(groundHazards.length-g0); return r; }'+
  '  __yIn++; let r; try{ r=__yD.apply(this,arguments); } finally{ __yIn--; }'+
  '  if(me&&type==="boomerang"){ __yk.rr++; const f=u._boomFoes||[]; __yk.rrN.push(f.length); const al=enemiesOf(u).filter(e=>e.alive).sort((a,b)=>dist(u,a)-dist(u,b)).slice(0,f.length);'+
  '    let near=true; for(const e of f) if(al.indexOf(e)<0) near=false; if(near) __yk.rrNear++; else __yk.rrNotNear++;'+
  '    for(const e of f){ const d=dist(u,e)/METER; __yk.rrD.push(+d.toFixed(1)); if(d<=7.6+bodyR(e)/METER) __yk.rrInR++; else __yk.rrOutR++; } }'+
  '  if(me&&type==="markreveal"){ __yk.lm++; const m=enemiesOf(u).find(e=>e._markBy===u&&(e._markT||0)>0&&Math.abs(e._markT-(o.dur||8))<1e-9); if(m){ if(m===pre) __yk.lmLow++; __yk.lmMul.push(+(m._markMul||0).toFixed(3)); __yk.lmDur.push(m._markT); } }'+
  '  return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const auto=_autoAtk; let e0=null, crit=null; const mine=src&&src.key==="yenna"&&tgt&&tgt.team!==src.team;'+
  '  if(src&&tgt&&src.team!==tgt.team&&src.team===((units.find(x=>x&&x.key==="yenna")||{team:"?"}).team)) e0=src.energy||0;'+
  '  if(mine){ __yk.po.n++; let alone=true; for(const o of units) if(o!==tgt&&o.alive&&o.team===tgt.team&&dist(o,tgt)<3.5*METER) alone=false; const held=(tgt.stunned>0||(tgt.fearT||0)>0||(tgt.slow||0)>0||(tgt._airT||0)>0), dying=(tgt.hp/tgt.maxHp)<0.35;'+
  '    if(alone) __yk.po.alone++; if(held) __yk.po.held++; if(dying) __yk.po.dying++; if(alone||held||dying) __yk.po.any++; if(auto) __yk.autos++; }'+
  '  if(tgt&&tgt.key==="yenna"&&src&&src.team!==tgt.team){ __yk.hitsOnMe++; if(src.melee) __yk.meleeOnMe++; }'+
  '  const hp0=tgt?tgt.hp:0, mk=tgt&&(tgt._markT||0)>0&&tgt._markBy&&tgt._markBy.key==="yenna"; const p=_preCrit;'+
  '  const r=__yDD.apply(this,arguments);'+
  '  if(e0!=null&&tgt&&src.alive){ const was=tgt._lastCritBy===src; void was; }'+
  '  if(mine&&hp0>0&&!tgt.alive){ const k=__yBack?"back":(auto?"auto":(__yIn?(src._castSlot||"?"):"other")); __yk.myKill[k]=(__yk.myKill[k]||0)+1; }'+
  '  return r; };'+
  /* the energy an ally gains from a critical hit: the page writes the crit into floatTexts / _lastCrit; read it as the energy jump of a hit that crit, marked or not */
  'var __yCr=typeof critRoll==="function"?critRoll:null;'+
  '_updateBattleCore=function(dt){ const Y=units.filter(u=>u&&u.key==="yenna"&&u.alive);'+
  '  for(const u of Y){ __yk.ticks++; let n=0; for(const e of enemiesOf(u)) if(e.alive&&dist(u,e)-bodyR(u)-bodyR(e)<3*METER) n++; __yk.near3.push(n); if((u._boomT||0)>0&&(u._boomT||0)<=dt&&u._boomFoes){ __yk.back++; } }'+
  '  for(const e of units) if(e&&e.alive&&(e._markT||0)>0&&e._markBy&&e._markBy.key==="yenna") __yk.markAnyT++;'+
  '  return __yU.apply(this,arguments); };');
/* the return pass: the status pass deals it outside any skill; count its hits and kills by wrapping the unit status update around the moment _boomT runs out */
VMX('var __yST=typeof statusTick==="function"?statusTick:null;');
const team=['yenna','vael','sylthaine','vireo','vex'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
/* the return's hits: dealDamage calls whose colour is the boomerang's and that come from her outside a cast */
VMX('var __yDl=dealDamage; dealDamage=function(src,tgt,amt,color,kind){ const back=src&&src.key==="yenna"&&!__yIn&&!_autoAtk&&color==="#e8dcc0"; if(back){ __yBack++; __yk.backHit++; } try{ return __yDl.apply(this,arguments); } finally{ if(back) __yBack--; } };');
/* an ally's crit on the marked enemy: the energy it held before and after the hit (a crit is known from the page's _lastHitCrit, or by the hit's float text) */
VMX('var __yFT=null;');
for(const node of [12,34,60,90,120]) for(const seed of [7,1000007,987654]){ VMX('__yk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337]){ VMX('__yk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__yk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__yk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', med=a=>{ if(!a.length) return '-'; const s=a.slice().sort((x,y)=>x-y); return (+s[s.length>>1]).toFixed(2); }, hist=a=>{ const h={}; for(const x of a){ const k=String(x); h[k]=(h[k]||0)+1; } return JSON.stringify(h); }, mx=a=>a.length?Math.max.apply(null,a).toFixed(1):'-';
const step=VMX('SIM_STEP');
console.log('fights '+c.fights+'; Yenna alive '+(c.ticks*step).toFixed(0)+' s in all; her hits '+c.po.n+' (basic attacks '+c.autos+'); hits on her '+c.hitsOnMe+' (melee '+c.meleeOnMe+'); her kills by source '+JSON.stringify(c.myKill));
console.log('Rending Return: '+c.rr+' casts; enemies struck on the way out '+hist(c.rrN)+'; they were the nearest ones '+c.rrNear+' casts, not the nearest '+c.rrNotNear+'; their distance from her (m, centre to centre) median '+med(c.rrD)+', max '+mx(c.rrD)+'; within 7.6 m + body '+c.rrInR+', beyond '+c.rrOutR);
console.log('  the return: '+c.back+' returns due, '+c.backHit+' return hits');
console.log('Laughing Mark: '+c.lm+' casts; on the lowest-health enemy '+c.lmLow+'; strength (damage taken x) '+hist(c.lmMul)+'; lasts '+hist(c.lmDur)+' s; her mark on some enemy '+(c.markAnyT*step).toFixed(0)+' enemy-seconds');
console.log('Crescent Stampede: '+c.ult+' casts; marked enemies at the cast '+hist(c.ultMk)+'; hops queued '+hist(c.ultHops));
console.log('Pack Opportunist on her hits: alone '+c.po.alone+', held '+c.po.held+', below 35% '+c.po.dying+', any '+c.po.any+' of '+c.po.n+' ('+(100*c.po.any/Math.max(1,c.po.n)).toFixed(1)+'%)');
console.log('enemies within 3 m of her (body to body), a tick each: '+hist(c.near3)+' (mean '+avg(c.near3)+')');
/* allied critical hits on the enemy she marked: the attacker's energy before and after (the card: "making allied critical hits restore energy") */
{ const L=V.arena(snaps([spec('yenna',100),spec('vael',100)]),snaps([spec('vael',100),spec('vael',100)]),7), y=L[0], a=L[1], F=L.filter(u=>u.team==='enemy');
  for(const u of L){ u.stunned=1e6; u.maxHp=u.hp=1e9; u.energyReg=0; }
  F[0].hp=0.2*F[0].maxHp; V.cast(y,'blue'); const mk=F.find(f=>(f._markT||0)>0);
  const en=(tgt,crit)=>{ a.energy=0; V.hit(a,tgt,1000,{crit,kind:'phys'}); return a.energy; };
  console.log('marked: '+(mk===F[0])+' x'+(mk&&mk._markMul)+' for '+(mk&&mk._markT)+' s; an ally\'s energy from one hit - crit on the marked '+en(F[0],true)+', plain hit on the marked '+en(F[0],false)+', crit on another '+en(F[1],true)+' (the same means the mark gives no energy)');
  const h=F[1].hp; V.hit(a,F[1],1000,{kind:'true'}); const h2=F[0].hp; V.hit(a,F[0],1000,{kind:'true'}); console.log('damage of a 1000 true hit: unmarked '+(h-F[1].hp).toFixed(1)+', marked '+(h2-F[0].hp).toFixed(1)); }
/* the outward pass on the still field: which enemies, in what order, and the return's delay */
{ const L=V.arena(snaps([spec('yenna',100)]),snaps([0,1,2,3,4].map(()=>spec('vael',100))),7), y=L[0], F=L.filter(u=>u.team==='enemy');
  for(const u of L){ u.stunned=1e6; u.maxHp=u.hp=1e9; } y.x=300; y.y=700; [[30,0],[4.5,0],[10,0],[15,0],[20,0]].forEach((p,i)=>{ F[i].x=y.x+p[0]*V.METER; F[i].y=y.y+p[1]*V.METER; });
  const h=F.map(f=>f.hp); V.cast(y,'green'); const out=F.map((f,i)=>+(h[i]-f.hp).toFixed(1));
  let t=0; const hb=F.map(f=>f.hp); while(t<2&&y._boomFoes){ V.step(1); t+=V.STEP; } const back=F.map((f,i)=>+(hb[i]-f.hp).toFixed(1));
  console.log('still field, enemies at 30, 4.5, 10, 15, 20 m (array order): outward damage '+JSON.stringify(out)+'; return after '+t.toFixed(3)+' s: '+JSON.stringify(back)+'; her attack '+(y.dmg).toFixed(1)); }
const L=V.arena(snaps([spec('yenna',100),spec('vael',100),spec('vex',100),spec('vireo',100),spec('sylthaine',100)]),snaps([spec('vael',100)]),7), k=L[0];
console.log('body radius '+V.bodyR(k).toFixed(2)+' m; attack interval '+k.atkInterval.toFixed(3)+' s; crit '+(k.glyphCrit||0)+' / critRate '+(k.critRate||k.crit||'?')+'; max HP '+Math.round(k.maxHp)+', atk '+Math.round(k.dmg)+', range '+(k.range/V.METER).toFixed(2)+' m; row '+(k.t&&k.t.row)+'; melee '+k.melee+'; passive '+JSON.stringify(k.pass)+' x'+k.passMul+', green '+JSON.stringify(k.greenAb)+', blue '+JSON.stringify(k.blueAb)+', ult '+JSON.stringify(VMX('Object.assign({},ULT_DEF.multiShot,(typeof HERO_ULT_ART!=="undefined"&&HERO_ULT_ART.yenna)||{})')));
console.log('formation fields on her: '+JSON.stringify(Object.keys(k).filter(x=>/slot|form|pos|idx|lane|row|col/i.test(x)).reduce((o,x)=>{ o[x]=k[x]; return o; },{}))+'; her allies: '+L.filter(u=>u.team==='ally').map(u=>u.key+'@'+(u.x/V.METER).toFixed(1)+','+(u.y/V.METER).toFixed(1)+' '+JSON.stringify(Object.keys(u).filter(x=>/slot|form|idx|lane/i.test(x)).reduce((o,x)=>{ o[x]=u[x]; return o; },{}))).join(' | '));
console.log('skill options as cast (level 100): green '+JSON.stringify(VMX('skillScaleOpts(KITS.yenna.green,skillMul(100),100)'))+'; blue '+JSON.stringify(VMX('skillScaleOpts(KITS.yenna.blue,skillMul(100),100)'))+'; markreveal x at lv100 '+VMX('skLvNum("markreveal",KITS.yenna.blue,100)')+'; ccDur(1) '+VMX('ccDur(1)')+', caps '+JSON.stringify(VMX('CC_DUR_MAX'))+'; METER '+V.METER+'; passMul at 100 '+k.passMul);
