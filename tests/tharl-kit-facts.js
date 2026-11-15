'use strict';
/* Tharl Ironcoil's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often
   each of his skills fires and what it reaches in seeded fights - Scale Ram ('knockstun': its target, its hit, the stun as it landed, the push), Fortress Curl
   ('defensive': its damage-taken multiplier and time, the allies standing near him when he curls), Layered Hide ('layered': hits to a plating, how long PLATED
   lasts, how much of the fight he is PLATED), Avalanche Coil ('charge' + HERO_ULT_ART.tharl: how far he rolls, its path and landing hits, the landing stun);
   the damage kind of each of his hits; the hits and controls he takes. No talents learned. Run: node tests/tharl-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __tk={fights:0,ticks:0,waves:0,ram:0,ramHit:0,ramStun:[],ramPush:[],ramNoTgt:0,ramTgtStunned:0,curl:0,curlMul:[],curlDur:[],curlAlly3:0,curlAlly45:0,curlAllyGap:[],curlAllies3:[],curlT:0,'+
  'plate:0,plateDur:[],plateT:0,hitsPer:[],hitsNow:0,layMax:0,ult:0,roll:[],path:0,pathPer:[],land:0,landPer:[],landStun:[],landNoHit:0,kinds:{},autos:0,autoKinds:{},hitsOn:0,autoOn:0,meleeAutoOn:0,skillOn:0,'+
  'stunOn:0,stunS:[],silOn:0,silS:[],fearOn:0,slowOn:0,pullOn:0,far4:0,far4n:0,dotOn:0,critOn:0,red:{n:0,p:0,m:0,p85:0,m85:0,c:0,cp:0},below30:0,below40:0,dmg:{ram:0,path:0,land:0,auto:0}};'+
  'var __tkD=_doEffectCore, __tkDD=_dealDamageCore, __tkU=_updateBattleCore, __tkCC=ccApply, __tkDm=damage, __tkCur=null, __tkN=0, __tkTg=null;'+
  'function __tkMe(u){ return u&&u.key==="tharl"; }'+
  '_doEffectCore=function(u,type,o){ const me=__tkMe(u); const was=__tkCur; let st0=0,x0=0,tg=null; if(me){ __tkCur=type; __tkN=0;'+
  '    if(type==="knockstun"){ __tk.ram++; tg=u.target; if(!tg||!tg.alive) __tk.ramNoTgt++; else { st0=tg.stunned||0; x0=tg.x; if(st0>0) __tk.ramTgtStunned++; } __tkTg=tg; }'+
  '    if(type==="defensive"){ __tk.curl++; let n3=0,best=1e9; alliesOf(u).forEach(a=>{ if(!a.alive||a===u) return; const g=(dist(u,a)-bodyR(u)-bodyR(a))/METER; if(g<best) best=g; if(g<3) n3++; });'+
  '      __tk.curlAllyGap.push(+best.toFixed(1)); __tk.curlAllies3.push(n3); if(best<3) __tk.curlAlly3++; if(best<4.5) __tk.curlAlly45++; }'+
  '    if(type==="charge"){ __tk.ult++; u.__tkX=u.x; u.__tkY=u.y; } }'+
  '  try{ return __tkD.apply(this,arguments); } finally{ if(me){ if(type==="knockstun"&&tg&&tg.alive){ __tk.ramStun.push(+((tg.stunned||0)).toFixed(2)); __tk.ramPush.push(+(Math.abs(tg.x-x0)/METER).toFixed(2)); }'+
  '      if(type==="defensive"){ __tk.curlMul.push(+u.drMul.toFixed(3)); __tk.curlDur.push(+u.drT.toFixed(2)); } } __tkCur=was; } };'+
  'var __tkLP=TalentFx.landPre, __tkLd=TalentFx.land;'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const h0=tgt?tgt.hp+(tgt.shield||0):0, au=_autoAtk, me=__tkMe(src);'+
  '  if(me){ const k=kind||((src.t&&(["Magic","Healer"].includes(src.t.damageProfile)))?"magic":"phys"); const tag=au?"auto":(__tkCur||"other"); __tk.kinds[tag+":"+k]=(__tk.kinds[tag+":"+k]||0)+1; if(au){ __tk.autos++; } }'+
  '  const r=__tkDD.apply(this,arguments); const got=tgt?h0-tgt.hp-(tgt.shield||0):0;'+
  '  if(me&&got>0){ if(__tkCur==="knockstun"){ __tk.ramHit++; __tk.dmg.ram+=got; } else if(au) __tk.dmg.auto+=got; }'+
  '  if(__tkMe(tgt)&&src&&src.team!==tgt.team&&got>0){ __tk.hitsOn++; __tk.hitsNow++; if(au){ __tk.autoOn++; if(src.melee) __tk.meleeAutoOn++; } else __tk.skillOn++; if(tgt._critHit) __tk.critOn++;'+
  '    const g=(dist(src,tgt)-bodyR(src)-bodyR(tgt))/METER; __tk.far4n++; if(g>4) __tk.far4++; }'+
  '  return r; };'+
  'ccApply=function(u,t,field,dur){ const r=__tkCC.apply(this,arguments); if(r&&__tkMe(t)){ if(field==="stunned"){ __tk.stunOn++; __tk.stunS.push(+(t.stunned).toFixed(2)); } if(field==="fearT") __tk.fearOn++; if(field==="silencedT"){ __tk.silOn++; __tk.silS.push(+(t.silencedT).toFixed(2)); } if(field==="slow") __tk.slowOn++; }'+
  '  if(r&&__tkMe(u)&&field==="stunned"&&__tkCur==="charge") __tk.landStun.push(+(t.stunned).toFixed(2)); return r; };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(!(__tkMe(u)&&u.alive)) continue; __tk.ticks++; if(u.hp<0.3*u.maxHp) __tk.below30++; if(u.hp<0.4*u.maxHp) __tk.below40++;'+
  '    const lt=u._layT||0; if(lt>0){ __tk.plateT++; if(!(u.__tkLt>0)){ __tk.plate++; __tk.plateDur.push(+lt.toFixed(2)); __tk.hitsPer.push(__tk.hitsNow); __tk.hitsNow=0; } } u.__tkLt=lt; __tk.layMax=Math.max(__tk.layMax,u._layStk||0);'+
  '    if(u.drT>0) __tk.curlT++; if(u.pullT>0&&!u.__tkPl) __tk.pullOn++; u.__tkPl=u.pullT>0; if(u.dots&&u.dots.length) __tk.dotOn++;'+
  '    let src=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ src=e; break; } if(!src) src=nearestEnemy(u); if(!src) continue;'+
  '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1), rp=1-k*defMul(src,u,"phys"), rm=1-k*defMul(src,u,"magic"), R=__tk.red; R.n++; R.p+=rp; R.m+=rm; if(rp>=0.85) R.p85++; if(rm>=0.85) R.m85++; if(u.drT>0){ R.c++; R.cp+=rp; } }'+
  '  return __tkU.apply(this,arguments); };'+
  'var __tkRW=resetPerWave; resetPerWave=function(){ __tk.waves++; return __tkRW.apply(this,arguments); };');
/* the charge's path and landing: the page's landPre / land lines (they run only for a talented hero), so count them from groundHazards and the dash instead */
VMX('var __tkDash=null; (function(){ const D=__tkD; _doEffectCore=(function(prev){ return function(u,type,o){ const me=__tkMe(u)&&type==="charge"; const n0=me?groundHazards.length:0; const r=prev.apply(this,arguments);'+
  '  if(me){ const nP=groundHazards.length-n0; __tk.path+=nP; __tk.pathPer.push(nP); if(u._dash){ const d=u._dash; __tk.roll.push(+(Math.hypot(d.x1-d.x0,d.y1-d.y0)/METER).toFixed(1)); const run=d.run; d.run=function(){ let n=0; const L=enemiesOf(u).filter(e=>e.alive&&dist({x:d.x1,y:d.y1},e)<(o.radius||2.4*METER)); n=L.length; __tk.land++; __tk.landPer.push(n); if(!n) __tk.landNoHit++; const c0=__tkCur; __tkCur="charge"; try{ return run.apply(this,arguments); } finally{ __tkCur=c0; } }; } } return r; }; })(_doEffectCore); })();');
const team=['tharl','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__tk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__tk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__tk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__tk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%', med=a=>a.length?a.slice().sort((x,y)=>x-y)[a.length>>1]:'-';
console.log('fights '+c.fights+' (12 campaign, 8 two-sided), waves '+c.waves+'; Tharl alive '+(c.ticks/37).toFixed(0)+' s in all ('+c.ticks+' ticks)');
console.log('damage kinds of his hits (skill:kind): '+JSON.stringify(c.kinds)+'; basic attacks '+c.autos);
console.log('Scale Ram: '+c.ram+' casts ('+c.ramNoTgt+' with no living target, '+c.ramTgtStunned+' on a target already stunned), '+c.ramHit+' hits that took HP; stun as landed '+hist(c.ramStun)+'; push (m) '+hist(c.ramPush));
console.log('Fortress Curl: '+c.curl+' casts; damage-taken multiplier '+hist(c.curlMul)+', time '+hist(c.curlDur)+'; curled '+pc(c.curlT,c.ticks)+' of his time; nearest ally at the cast (body to body, m) median '+med(c.curlAllyGap)+' '+hist(c.curlAllyGap.map(x=>Math.min(12,Math.round(x)))));
console.log('  an ally within 3 m at the cast: '+c.curlAlly3+' of '+c.curl+', within 4.5 m: '+c.curlAlly45+'; allies within 3 m '+hist(c.curlAllies3));
console.log('Layered Hide: PLATED '+c.plate+' times ('+(c.plate/Math.max(1,c.fights)).toFixed(1)+' a fight), each '+hist(c.plateDur)+' s; PLATED '+pc(c.plateT,c.ticks)+' of his time; hits on him between platings '+hist(c.hitsPer)+'; most layers seen '+c.layMax);
console.log('Avalanche Coil: '+c.ult+' casts; rolled (m) median '+med(c.roll)+' '+hist(c.roll.map(x=>Math.round(x)))+'; path hits '+c.path+' (per cast '+avg(c.pathPer)+' '+hist(c.pathPer)+'); landings '+c.land+' (struck per landing '+avg(c.landPer)+' '+hist(c.landPer)+', '+c.landNoHit+' struck nobody); landing stun as landed '+hist(c.landStun));
console.log('hits on him that took HP: '+c.hitsOn+' (basic attacks '+c.autoOn+', of them melee '+c.meleeAutoOn+', skills '+c.skillOn+', crits '+c.critOn+'); from more than 4 m (body to body) '+pc(c.far4,c.far4n)+'; ticks with a DoT on him '+pc(c.dotOn,c.ticks));
console.log('controls landed on him: stuns '+c.stunOn+' '+hist(c.stunS)+', silences '+c.silOn+' '+hist(c.silS)+', fears '+c.fearOn+', slows '+c.slowOn+', pulls '+c.pullOn);
console.log('below 30% HP '+pc(c.below30,c.ticks)+', below 40% '+pc(c.below40,c.ticks)+'; damage dealt: Scale Ram '+Math.round(c.dmg.ram)+', basic attacks '+Math.round(c.dmg.auto));
const R=c.red; console.log('a reference hit on him each tick (skill slot, glyphs, armour / magic resist): physical mean '+(100*R.p/Math.max(1,R.n)).toFixed(1)+'%, magic mean '+(100*R.m/Math.max(1,R.n)).toFixed(1)+'%; at 85% or more: physical '+pc(R.p85,R.n)+', magic '+pc(R.m85,R.n)+'; physical while curled '+(100*R.cp/Math.max(1,R.c)).toFixed(1)+'%');
const L=V.arena(snaps([Object.assign(spec('tharl',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), h=L[0];
console.log('body radius: Tharl '+V.bodyR(h).toFixed(2)+' m; attack interval '+h.atkInterval.toFixed(3)+' s; max HP '+Math.round(h.maxHp)+', attack '+Math.round(h.dmg)+', melee '+!!h.melee+', range '+(h.range/V.METER).toFixed(2)+' m; passive '+JSON.stringify(h.pass)+', passMul '+(h.passMul||1).toFixed(3)+'; armour '+Math.round(h.armorRating||0)+', mr '+Math.round(h.mrRating||0)+'; layMax '+(h._layMax||5)+', PLATED at level 100 '+VMX('SKLV.layered(100)')+' s, at 10 '+VMX('SKLV.layered(10)')+' s');
console.log('kits: '+JSON.stringify(VMX('KITS.tharl'))+' / ult '+JSON.stringify(VMX('ULT_DEF.charge'))+' + '+JSON.stringify(VMX('HERO_ULT_ART.tharl'))+'; skillMul(100) '+VMX('skillMul(100)')+'; ccDur(1) '+VMX('ccDur(1)')+'; CC_DUR_MAX '+JSON.stringify(VMX('CC_DUR_MAX')));
console.log('reference armour factor on him vs a level-100 Vael (physical): '+VMX('defMul')(L[1],h,'phys').toFixed(4)+', magic '+VMX('defMul')(L[1],h,'magic').toFixed(4));
