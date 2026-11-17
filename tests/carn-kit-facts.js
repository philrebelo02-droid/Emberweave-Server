'use strict';
/* Carn's real kit, measured (not a test: run with plain node on PC 2). What his talents build on: how often each of his skills fires and how many
   enemies it reaches in seeded fights (Vein Burst's circle is 2.8 m from his centre, measured to the enemy's centre), how far apart he and the enemies
   he fights stand, and what Reckless Blow costs. Run: node tests/carn-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __ck={reck:0,nova:0,novaHit:0,novaNear:[],reap:0,reapHit:0,gap:[],cost:[],casts:0}; var __ckD=_doEffectCore, __ckDD=_dealDamageCore;'+
  '_doEffectCore=function(u,type,o){ if(u&&u.key==="carn"&&(!o||!o.deliver||o._arrived)){ __ck.casts++; if(type==="reckless"){ __ck.reck++; __ck.cost.push(u.maxHp*0.06/u.maxHp); }'+
  '  if(type==="bloodnova"){ __ck.nova++; let n=0, best=1e9; for(const e of enemiesOf(u)){ const d=dist(u,e)/METER; if(d<best) best=d; if(dist(u,e)<=2.8*METER) n++; } __ck.novaHit+=n; __ck.novaNear.push(+best.toFixed(2)); }'+
  '  if(type==="cleave") __ck.reap++; } return __ckD.apply(this,arguments); };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(src&&src.key==="carn"&&color==="#ffa657") __ck.reapHit++; if(src&&src.key==="carn"&&_autoAtk&&tgt) __ck.gap.push(+((dist(src,tgt)-bodyR(src)-bodyR(tgt))/METER).toFixed(2)); return __ckDD.apply(this,arguments); };');
const team=['carn','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
const foe=snaps(['ambrel','fritz','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337]){ NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__ck'), g=c.gap.slice().sort((a,b)=>a-b), nn=c.novaNear.slice().sort((a,b)=>a-b);
console.log('casts '+c.casts+': Reckless Blow '+c.reck+', Vein Burst '+c.nova+' (enemies inside its 2.8 m: '+c.novaHit+' in all), Crimson Reap '+c.reap+' (hits '+c.reapHit+')');
console.log('Vein Burst: nearest enemy centre at the cast, metres: min '+nn[0]+', median '+nn[nn.length>>1]+', max '+nn[nn.length-1]);
console.log('his basic attacks: '+g.length+'; gap body to body to the target, metres: min '+g[0]+', median '+g[g.length>>1]+', max '+g[g.length-1]);
const L=V.arena(snaps([spec('carn',100)]),snaps([spec('vael',100)]),7); console.log('body radius: Carn '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+L[0].atkInterval.toFixed(3)+' s; passMul '+L[0].passMul+'; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg));
