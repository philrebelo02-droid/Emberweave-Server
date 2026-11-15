'use strict';
/* Sloe's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What her talents build on: how often each of
   her skills fires and what it reaches in seeded fights with NO talents learned - Thornshot (casts, its target struck, the armour shred it writes), Vine Snare
   (casts, where it forms, enemies struck and rooted, the root's length, the target caught), Emerald Volley (casts, arrows, enemies struck), Hunter's Patience
   (stacks at each swing, swings that reach 6, target changes, swings on a target that died), the hits on her (how near their attacker stood), the share of her
   time with no damage taken for 3 s, and her distance to the nearest enemy.
   Run: node tests/sloe-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __sk={ts:0,tsHit:0,tsShred:[],vs:0,vsPress:0,vsHit:0,vsNone:0,vsPer:[],vsRoot:0,vsRootT:[],vsTgtIn:0,vsTgt:0,ul:0,ulArrows:0,ulHit:0,ulPer:[],ulInRange:0,sw:0,stk:[],six:0,sw6:0,switches:0,deadPrev:0,ticks:0,quiet:0,hitsOn:0,autoOn:0,near:[],hitGap:[],fights:0,within2:0,within3:0,meleeOn:0,rangedOn:0};'+
  'var __skD=_doEffectCore, __skDD=_dealDamageCore, __skU=_updateBattleCore, __skCC=ccApply, __skCur=null, __skN=0, __skLast={}, __skPrevT=null;'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="sloe"; const arr=me&&(!o||!o.deliver||o._arrived);'+
  '  if(me&&o&&o.deliver&&!o._arrived&&type==="swamproot") __sk.vsPress++;'+
  '  if(arr&&type==="shred"){ __sk.ts++; __skCur="ts"; }'+
  '  if(arr&&type==="swamproot"){ __sk.vs++; __skCur="vs"; __skN=0; const tg=o&&o._tgtU; if(tg){ __sk.vsTgt++; } }'+
  '  if(me&&type==="volley"){ __sk.ul++; __skCur="ul"; const L=enemiesOf(u).filter(e=>e.alive); __sk.ulArrows+=Math.min(L.length,(o&&o.n)||6); __sk.ulInRange+=L.filter(e=>dist(u,e)<=u.range).length; }'+
  '  try{ return __skD.apply(this,arguments); } finally{ if(arr&&type==="shred"){ const t=o&&o._tgtU; if(t) __sk.tsShred.push(t._shredPct||0); }'+
  '    if(arr&&type==="swamproot"){ __sk.vsPer.push(__skN); if(!__skN) __sk.vsNone++; } if(me&&(arr||type==="volley")) __skCur=null; } };'+
  'ccApply=function(u,t,f,d){ const r=__skCC.apply(this,arguments); if(u&&u.key==="sloe"&&__skCur==="vs"&&f==="stunned"&&(t.stunned||0)>0){ __sk.vsRoot++; __sk.vsRootT.push(t.stunned); } return r; };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ if(src&&src.key==="sloe"&&tgt&&tgt.team!==src.team){ if(__skCur==="ts") __sk.tsHit++; else if(__skCur==="vs"){ __sk.vsHit++; __skN++; } else if(!_autoAtk&&color==="#5ee89b") __sk.ulHit++; }'+
  '  if(tgt&&tgt.key==="sloe"&&src&&src.team!==tgt.team){ __sk.hitsOn++; __skLast[tgt.uid]=battleTime; if(_autoAtk) __sk.autoOn++; if(src.melee) __sk.meleeOn++; else __sk.rangedOn++; __sk.hitGap.push((dist(src,tgt)-bodyR(src)-bodyR(tgt))/METER); } return __skDD.apply(this,arguments); };'+
  '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="sloe"&&u.alive){ __sk.ticks++; const l=__skLast[u.uid]; if(l==null||battleTime-l>=3||battleTime<l) __sk.quiet++;'+
  '    let bd=1e9; for(const e of units) if(e.alive&&e.team!==u.team){ const d=dist(u,e)-bodyR(u)-bodyR(e); if(d<bd) bd=d; } if(bd<2*METER) __sk.within2++; if(bd<3*METER) __sk.within3++; if(bd<1e8&&(__sk.ticks%15)===0) __sk.near.push(bd/METER);'+
  '    if(u.atkCd<=0&&u.target&&u.target.alive){ } } } return __skU.apply(this,arguments); };');
/* Hunter's Patience at each swing: read right after the swing (the passive writes _hpStk at the swing) */
VMX('var __skP=_updateBattleCore; _updateBattleCore=function(dt){ const pre=units.filter(u=>u&&u.key==="sloe").map(u=>[u,u._hpTgt,u._hpStk,u.atkCd]); const r=__skP.apply(this,arguments);'+
  '  for(const [u,t0,k0,c0] of pre){ if(u._hpStk!==k0||u._hpTgt!==t0||(u.atkCd>c0+0.05)){ if(u.atkCd>c0+0.05||u._hpTgt!==t0||u._hpStk!==k0){ __sk.sw++; __sk.stk.push(u._hpStk||0); if((u._hpStk||0)>=6) __sk.sw6++; if(k0<6&&(u._hpStk||0)>=6) __sk.six++; if(u._hpTgt!==t0&&t0){ __sk.switches++; if(!t0.alive) __sk.deadPrev++; } } } } return r; };');
const team=['sloe','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__sk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__sk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__sk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__sk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[b.length>>1].toFixed(2):'-'; };
const step=VMX('SIM_STEP');
console.log('fights '+c.fights+'; Sloe alive '+(c.ticks*step).toFixed(0)+' s in all; no damage taken for 3 s or more '+(100*c.quiet/Math.max(1,c.ticks)).toFixed(1)+'% of it; nearest enemy body to body: median '+med(c.near)+' m, mean '+avg(c.near)+' m; an enemy within 2 m '+(100*c.within2/Math.max(1,c.ticks)).toFixed(1)+'%, within 3 m '+(100*c.within3/Math.max(1,c.ticks)).toFixed(1)+'% of her time');
console.log('Thornshot: '+c.ts+' casts, its target struck '+c.tsHit+'; shred written '+hist(c.tsShred.map(x=>x.toFixed(3))));
console.log('Vine Snare: '+c.vsPress+' presses, '+c.vs+' formed (on a target '+c.vsTgt+'), '+c.vsHit+' enemies struck ('+(c.vs?(c.vsHit/c.vs).toFixed(2):'-')+' a cast), formed on nobody '+c.vsNone+', per cast '+hist(c.vsPer)+', roots landed '+c.vsRoot+', root as written '+hist(c.vsRootT.map(x=>x.toFixed(2))));
console.log('Emerald Volley: '+c.ul+' casts, arrows '+c.ulArrows+', arrow hits '+c.ulHit+' ('+(c.ul?(c.ulHit/c.ul).toFixed(2):'-')+' a cast); enemies within her attack range at the cast '+(c.ul?(c.ulInRange/c.ul).toFixed(2):'-')+' a cast');
console.log('Hunter\'s Patience: '+c.sw+' swings, stacks at the swing '+hist(c.stk)+'; swings at 6 '+c.sw6+', reached 6 '+c.six+' times; target changes '+c.switches+' (the old target dead '+c.deadPrev+')');
console.log('hits on her: '+c.hitsOn+' (basic attacks '+c.autoOn+', from melee '+c.meleeOn+', ranged '+c.rangedOn+'), attacker body to body: median '+med(c.hitGap)+' m');
const L=V.arena(snaps([spec('sloe',100)]),snaps([spec('vael',100)]),7); const m=L[0];
console.log('body radius: Sloe '+V.bodyR(m).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; attack interval '+m.atkInterval.toFixed(3)+' s; max HP '+Math.round(m.maxHp)+', attack '+Math.round(m.dmg)+', apow '+Math.round(m.apow)+', crit '+m.glyphCrit+', critDmg '+m.critDmg+', melee '+!!m.melee+', range '+(m.range/V.METER).toFixed(2)+' m; passMul '+m.passMul+'; passive '+JSON.stringify(m.pass)+', green '+JSON.stringify(m.greenAb)+', blue '+JSON.stringify(m.blueAb)+'; damage profile '+(m.t&&m.t.damageProfile)+', row '+(m.t&&m.t.row)+'; anim crit '+!!(m.anim&&m.anim.crit));
