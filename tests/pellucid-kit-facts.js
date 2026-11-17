'use strict';
/* Pellucid's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on: how often each of
   his skills fires and what it reaches in seeded fights with NO talents learned - Meteor Knuckle (launches, landings, enemies struck, the stun each one got),
   Infernal Clinch (casts, whom it grabs, how far that enemy stood, the stun), Worldbreaker Fists (casts, slams, enemies each shockwave reached, the stuns),
   Unmovable Mass (its molten layers over time, cleared each wave; the pulls, pushes, knock-ups and charges that his immovability refused, by page line), the hits
   on him (their size against his max HP: Craze; melee / ranged; critical; damage over time), his basic attacks, the time an ally stood behind him (the file), the
   time below 30% / 40% HP, and his deaths.
   Run: node tests/pellucid-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX(`var __pk={fights:0,ticks:0,deaths:0,mkLaunch:0,mkLand:0,mkPer:[],mkTgtHit:0,mkStun:[],clinch:0,clGap:[],clStun:[],clIsTgt:0,wb:0,wbSlam:0,wbPer:[],wbStun:{},
  autos:0,atkI:[],hitsOn:0,big5:0,big2:0,melee:0,ranged:0,crit:0,dotTicks:0,dotKinds:{},stk:[0,0,0,0,0,0],low30:0,low40:0,behind:0,refused:{},refusedN:0,front:0,notFront:0,near2:0,near3:0,waveStk:[]};
var __pkD=_doEffectCore, __pkDD=_dealDamageCore, __pkU=_updateBattleCore, __pkC=ccApply, __pkDT=null, __pkCur=null, __pkN=0, __pkSlam=-1;
function __pkMe(u){ return !!(u&&u.key==='pellucid'); }
_doEffectCore=function(u,type,o){ const me=__pkMe(u), arr=!o||!o.deliver||o._arrived;
  if(me&&type==='aoeStun'&&!arr) __pk.mkLaunch++;
  if(me&&type==='aoeStun'&&arr){ __pk.mkLand++; __pkCur='mk'; __pkN=0; __pkDT=o&&o._tgtU; }
  if(me&&type==='atkcrush'){ __pk.clinch++; __pkCur='cl'; let best=null,bv=-1; enemiesOf(u).forEach(e=>{ if(!e.alive)return; const v=e.dmg||0; if(v>bv){bv=v;best=e;} });
    if(best){ __pk.clGap.push((dist(u,best)-bodyR(u)-bodyR(best))/METER); if(best===u.target) __pk.clIsTgt++; } }
  if(me&&type==='worldbreaker'){ __pk.wb++; }
  try{ return __pkD.apply(this,arguments); } finally{ if(me&&type==='aoeStun'&&arr){ __pk.mkPer.push(__pkN); } if(me&&(type==='aoeStun'||type==='atkcrush')) __pkCur=null; } };
_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=__pkMe(src)&&tgt&&tgt.team!==src.team, au=_autoAtk;
  if(me){ if(__pkCur==='mk'){ __pkN++; if(tgt===__pkDT) __pk.mkTgtHit++; } if(au){ __pk.autos++; const d=heroFormationDepth(tgt.key); if(d<=1) __pk.front++; else __pk.notFront++; } }
  const on=__pkMe(tgt)&&src&&src.team!==tgt.team; let h0=0; if(on){ h0=tgt.hp+(tgt.shield||0); __pk.hitsOn++; if(src.melee) __pk.melee++; else __pk.ranged++; }
  const r=__pkDD.apply(this,arguments);
  if(on){ const l=h0-tgt.hp-(tgt.shield||0); if(l>0.05*tgt.maxHp) __pk.big5++; if(l>0.02*tgt.maxHp) __pk.big2++; if(tgt._lastCritOn) __pk.crit++; }
  return r; };
ccApply=function(u,t,field,dur){ const before=t?(t[field]||0):0, r=__pkC.apply(this,arguments); if(r&&__pkMe(u)&&field==='stunned'){ const got=t.stunned;
    if(__pkCur==='mk') __pk.mkStun.push(+got.toFixed(3)); else if(__pkCur==='cl') __pk.clStun.push(+got.toFixed(3)); else if(__pkSlam>=0){ const k='slam'+__pkSlam; (__pk.wbStun[k]=__pk.wbStun[k]||[]).push(+got.toFixed(3)); } } return r; };
_updateBattleCore=function(dt){ for(const u of units){ if(!__pkMe(u)) continue; if(!u.alive){ if(!u.__pkDead){ u.__pkDead=1; __pk.deaths++; } continue; } __pk.ticks++;
    __pk.stk[Math.min(5,u.wardenStk||0)]++; if(u.hp<0.3*u.maxHp) __pk.low30++; if(u.hp<0.4*u.maxHp) __pk.low40++;
    if(!u.__pkI){ u.__pkI=1; __pk.atkI.push(u.atkInterval); }
    const foes=units.filter(e=>e.alive&&e.team!==u.team); if(foes.length){ let cx=0,cy=0; foes.forEach(e=>{cx+=e.x;cy+=e.y;}); cx/=foes.length; cy/=foes.length; const du=Math.hypot(u.x-cx,u.y-cy);
      if(units.some(a=>a.alive&&a!==u&&a.team===u.team&&!a._summon&&Math.hypot(a.x-cx,a.y-cy)>du&&(dist(a,u)-bodyR(a)-bodyR(u))<8*METER)) __pk.behind++;
      if(foes.some(e=>dist(e,u)-bodyR(e)-bodyR(u)<2*METER)) __pk.near2++; if(foes.some(e=>dist(e,u)-bodyR(e)-bodyR(u)<3*METER)) __pk.near3++; } }
  return __pkU.apply(this,arguments); };
var __pkDot=dotTickAmt; dotTickAmt=function(src,tgt,amt,kind){ if(__pkMe(tgt)&&src&&src.team!==tgt.team){ __pk.dotTicks++; const k=kind||'?'; __pk.dotKinds[k]=(__pk.dotKinds[k]||0)+1; } return __pkDot.apply(this,arguments); };
var __pkCrit=damage; damage=function(u,a,c,noE,crit){ if(__pkMe(u)) u._lastCritOn=!!crit; return __pkCrit.apply(this,arguments); };
var __pkWB=null;`);
/* each refused displacement: a getter on his immovable flag records which page line asked (only reads that come from a displacement test count) */
VMX(`function __pkWrap(f){ return function(){ const u=f.apply(this,arguments); if(u&&u.key==='pellucid'&&!u.__pkG){ u.__pkG=1; let v=u.immovable; Object.defineProperty(u,'immovable',{configurable:true,enumerable:true,
  get(){ if(v){ const st=String(new Error().stack||'').split('\\n')[2]||''; const m=st.match(/:(\\d+):\\d+\\)?$/); const ln=m?m[1]:'?'; __pk.refused[ln]=(__pk.refused[ln]||0)+1; } return v; }, set(x){ v=x; }}); } return u; }; } makeUnit=__pkWrap(makeUnit); buildUnitFromSnapshot=__pkWrap(buildUnitFromSnapshot);`);
const team=['pellucid','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__pk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
/* two-sided fights against line-ups that push, pull, knock up and charge (Askel's charge, Grimsby's Ledger Slam pull, Absalie's Gravity Knot, KonWu's kick, Maren's Tsunami) */
const foeA=snaps(['askel','grimsby','absalie','konwu','maren'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
const foeB=snaps(['ambrel','grosk','dandra','brannus','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ const foe=seed%2?foeA:foeB; VMX('__pk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__pk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); }
const c=VMX('__pk'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); };
const step=VMX('SIM_STEP'), pc=x=>(100*x/Math.max(1,c.ticks)).toFixed(1)+'%';
console.log('fights '+c.fights+'; Pellucid alive '+(c.ticks*step).toFixed(0)+' s in all, deaths '+c.deaths);
console.log('Meteor Knuckle: '+c.mkLaunch+' launches, '+c.mkLand+' landings, enemies struck per landing '+hist(c.mkPer)+' (avg '+avg(c.mkPer)+'), the aimed enemy struck '+c.mkTgtHit+', stuns landed '+hist(c.mkStun));
console.log('Infernal Clinch: '+c.clinch+' casts, the grabbed enemy was his current target '+c.clIsTgt+', its gap from his body avg '+avg(c.clGap)+' m (max '+(c.clGap.length?Math.max(...c.clGap).toFixed(1):'-')+'), stuns landed '+hist(c.clStun));
console.log('Worldbreaker Fists: '+c.wb+' casts; stuns landed by slam '+JSON.stringify(Object.fromEntries(Object.entries(c.wbStun).map(([k,v])=>[k,hist(v)]))));
console.log('molten layers (share of his time alive at 0..5): '+c.stk.map(pc).join(' / '));
console.log('hits on him '+c.hitsOn+': above 5% of his max HP '+c.big5+', above 2% '+c.big2+', from melee '+c.melee+', ranged '+c.ranged+', critical '+c.crit+'; enemy DoT ticks on him '+c.dotTicks+' '+JSON.stringify(c.dotKinds));
console.log('his basic attacks '+c.autos+' landed (on a front-row enemy '+c.front+', other '+c.notFront+'); attack interval '+c.atkI.map(x=>x.toFixed(3)).slice(0,3).join(', '));
console.log('an ally behind him (farther from the enemies, within 8 m) '+pc(c.behind)+'; an enemy within 2 m '+pc(c.near2)+', within 3 m '+pc(c.near3)+'; below 30% HP '+pc(c.low30)+', below 40% '+pc(c.low40));
console.log('displacements his immovability refused, by page line: '+JSON.stringify(c.refused));
const L=V.arena(snaps([spec('pellucid',100)]),snaps([spec('vael',100)]),7); console.log('body radius: Pellucid '+V.bodyR(L[0]).toFixed(2)+' m, Vael '+V.bodyR(L[1]).toFixed(2)+' m; max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', melee '+!!L[0].melee+', passive '+JSON.stringify(L[0].pass)+', passMul '+L[0].passMul+'; green '+JSON.stringify(L[0].greenAb)+'; blue '+JSON.stringify(L[0].blueAb)+'; molten cap at lv100 '+VMX('SKLV.wardenCap(100)')+', per layer '+(0.04*L[0].passMul).toFixed(4)+'; depth of a vael '+VMX('heroFormationDepth("vael")')+', of pellucid '+VMX('heroFormationDepth("pellucid")'));
