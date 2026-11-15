'use strict';
/* Tolley's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on, in 20 seeded fights
   with NO talents learned (12 campaign: 4 stages x 3 seeds; 8 two-sided: 2 line-ups x 2 seeds x each side once), everyone at skill level 100:
   - Forge Strike (green 'cleave', delivered 'land'): casts as they land, enemies struck per cast, his own target among them, the damage kind;
   - Chain Quench (blue 'chainquench', delivered 'form'): casts, enemies struck / pulled / burned per cast, the burn's ticks and their kind;
   - Living Forge (the ultimate 'ashfall'): casts, where the burning patch lies (on his target or under him), whether it follows him, the enemies its ticks reach,
     an impact hit at the cast (the card says one);
   - Tempered Steel (passive 'warden'): when it reaches 5 stacks in a wave, the share it takes off;
   - his basic attacks (kind, interval), the hits he takes (basic attack or ability, physical or magic, from an enemy his burn is on), his kills and his allies' kills,
     how far enemies stand from him and from each other, and the ally with the most attack at each wave start.
   Run: node tests/tolley-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX(`var __tk={fights:0,waves:0,ticks:0,fs:0,fsHit:[],fsTgt:0,fsKind:{},cq:0,cqHit:[],cqPull:0,cqDot:0,cqKind:{},cqTick:0,cqTickKind:{},lf:0,lfOnTgt:0,lfOnSelf:0,lfImpact:0,lfTicks:0,lfReach:[],lfFollow:0,lfDrift:[],
  wd5:[],wdCut:[],auto:0,autoKind:{},interval:[],hitsOn:0,hitAuto:0,hitAbil:0,hitPhys:0,hitMag:0,hitBurning:0,kills:0,allyKills:0,within3:0,within4:0,foeSamples:0,gap2:0,gapN:0,dmg:{fs:0,cq:0,cqb:0,lf:0,auto:0},topAtk:[],mode:null};
var __tkD=_doEffectCore, __tkDD=_dealDamageCore, __tkU=_updateBattleCore, __tkPD=pushDot, __tkRW=resetPerWave, __tkCur=null, __tkN=0, __tkSeen=new Set(), __tkHz=new Map(), __tkW0=0, __tkWave=null;
_doEffectCore=function(u,type,o){ const me=u&&u.key==='tolley'&&!(o&&o.deliver&&!o._arrived); const was=__tkCur;
  if(me){ __tkCur=type; __tkN=0; if(type==='cleave') __tk.fs++; if(type==='chainquench') __tk.cq++;
    if(type==='ashfall'){ __tk.lf++; const t=(u.target&&u.target.alive)?u.target:null; const n0=groundHazards.length; const r=__tkD.apply(this,arguments); const h=groundHazards[groundHazards.length-1];
      if(h&&groundHazards.length>n0&&h.src===u){ if(t&&Math.hypot(h.x-t.x,h.y-t.y)<1) __tk.lfOnTgt++; if(Math.hypot(h.x-u.x,h.y-u.y)<1) __tk.lfOnSelf++; __tkHz.set(h,{u,x:h.x,y:h.y,acc:h.acc}); }
      __tk.lfImpact+=__tkN; __tkCur=was; return r; }
    __tkSeen=new Set(); }
  try{ return __tkD.apply(this,arguments); } finally{ if(me){ if(type==='cleave'){ __tk.fsHit.push(__tkN); const t=o&&o._tgtU; if(t&&__tkSeen.has(t)) __tk.fsTgt++; } if(type==='chainquench') __tk.cqHit.push(__tkN); __tkCur=was; } } };
pushDot=function(t,dps,dur,iv,color,src,kind){ const r=__tkPD.apply(this,arguments); if(src&&src.key==='tolley'&&__tkCur==='chainquench'){ __tk.cqDot++; const d=t.dots[t.dots.length-1]; d.__tq=1; __tk.cqKind[d.kind]=(__tk.cqKind[d.kind]||0)+1; } return r; };
_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const h0=tgt?tgt.hp+(tgt.shield||0):0, au=_autoAtk, al0=tgt&&tgt.alive, px=tgt&&tgt.x, py=tgt&&tgt.y;
  const r=__tkDD.apply(this,arguments); const got=tgt?h0-tgt.hp-(tgt.shield||0):0;
  if(src&&src.key==='tolley'&&got>0){ const k=tgt._lastHitKind||kind||'?';
    if(__tkCur==='cleave'){ __tkN++; __tkSeen.add(tgt); __tk.dmg.fs+=got; __tk.fsKind[k]=(__tk.fsKind[k]||0)+1; }
    else if(__tkCur==='chainquench'){ __tkN++; __tk.dmg.cq+=got; if(tgt.x!==px||tgt.y!==py) __tk.cqPull++; }
    else if(__tkCur==='ashfall'){ __tkN++; }
    else if(au){ __tk.auto++; __tk.dmg.auto+=got; __tk.autoKind[k]=(__tk.autoKind[k]||0)+1; } }
  if(src&&src.key==='tolley'&&al0&&tgt&&!tgt.alive&&tgt.team!==src.team) __tk.kills++;
  else if(src&&src.team!==(tgt&&tgt.team)&&al0&&tgt&&!tgt.alive&&units.some(x=>x.key==='tolley'&&x.team===src.team)) __tk.allyKills++;
  if(tgt&&tgt.key==='tolley'&&src&&src.team!==tgt.team&&got>0){ __tk.hitsOn++; if(au) __tk.hitAuto++; else __tk.hitAbil++; if(tgt._lastHitKind==='magic') __tk.hitMag++; else __tk.hitPhys++;
    if((src.dots||[]).some(d=>d.src===tgt&&d.remaining>0)) __tk.hitBurning++; }
  return r; };
resetPerWave=function(){ __tk.waves++; __tkWave=null; return __tkRW.apply(this,arguments); };
_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==='tolley'&&u.alive)) continue; __tk.ticks++; if(!__tk.mode) __tk.mode=heroScaleMode(u)+'/'+(u.t.damageProfile||'');
    if(__tkWave!==u){ __tkWave=u; __tkW0=battleTime; const A=units.filter(a=>a.alive&&a.team===u.team&&a!==u&&!a._summon).sort((a,b)=>(b.dmg||0)-(a.dmg||0)); __tk.topAtk.push(A.length?A[0].key:'-'); }
    if((u.wardenStk||0)>=5&&!u.__wd5){ u.__wd5=1; __tk.wd5.push(+(battleTime-__tkW0).toFixed(1)); __tk.wdCut.push(+wardenCut(u).toFixed(4)); } if((u.wardenStk||0)<5) u.__wd5=0;
    if(__tk.ticks%30===1){ __tk.interval.push(+u.atkInterval.toFixed(3)); const F=units.filter(e=>e.alive&&e.team!==u.team);
      for(const e of F){ __tk.foeSamples++; const g=(dist(u,e)-bodyR(u)-bodyR(e))/METER; if(g<3) __tk.within3++; if(g<4) __tk.within4++;
        let b=1e9; for(const f of F) if(f!==e) b=Math.min(b,(dist(e,f)-bodyR(e)-bodyR(f))/METER); if(F.length>1){ __tk.gapN++; if(b<2) __tk.gap2++; } } } }
  for(const [h,q] of __tkHz){ if(groundHazards.indexOf(h)<0||h.life<=0){ __tkHz.delete(h); continue; } const d=Math.hypot(h.x-q.u.x,h.y-q.u.y)/METER; __tk.lfDrift.push(+d.toFixed(1)); if(h.x!==q.x||h.y!==q.y) __tk.lfFollow++;
    if(h.acc+dt>=h.interval){ __tk.lfTicks++; __tk.lfReach.push(units.filter(e=>e.alive&&e.team!==h.team&&Math.hypot(e.x-h.x,e.y-h.y)<=h.r).length); } }
  for(const x of units) for(const d of (x.dots||[])) if(d.__tq&&d.acc+dt>=d.interval&&d.remaining>0){ __tk.cqTick++; }
  return __tkU.apply(this,arguments); };`);
const team=['tolley','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__tk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
const foes=[['ambrel','carn','dandra','konwu','ceraline'],['absalie','astra','vireo','sylthaine','vex']];
for(const fk of foes){ const foe=snaps(fk.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
  for(const seed of [5,77]){ VMX('__tk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); VMX('__tk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); } }
const c=VMX('__tk'), hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); }, pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%', sorted=a=>a.slice().sort((x,y)=>x-y), med=a=>a.length?sorted(a)[Math.floor(a.length/2)]:0, mx=a=>a.length?Math.max(...a):0;
console.log('fights '+c.fights+', waves (resetPerWave calls) '+c.waves+'; Tolley alive '+(c.ticks/30).toFixed(0)+' s; scale mode / damage profile '+c.mode);
console.log('Forge Strike: '+c.fs+' casts (as they land), enemies struck per cast '+hist(c.fsHit)+', his own target struck in '+c.fsTgt+'; kinds '+JSON.stringify(c.fsKind)+'; damage '+Math.round(c.dmg.fs));
console.log('Chain Quench: '+c.cq+' casts, enemies struck per cast '+hist(c.cqHit)+', struck and moved '+c.cqPull+', burns pushed '+c.cqDot+' (kinds '+JSON.stringify(c.cqKind)+'), burn ticks '+c.cqTick+'; hit damage '+Math.round(c.dmg.cq));
console.log('Living Forge: '+c.lf+' casts, patch on his target '+c.lfOnTgt+', under him '+c.lfOnSelf+', hits at the cast (impact) '+c.lfImpact+'; ticks '+c.lfTicks+', enemies per tick '+hist(c.lfReach)+'; ticks where the patch moved '+c.lfFollow+'; his distance from the patch (m) median '+med(c.lfDrift)+', max '+mx(c.lfDrift));
console.log('Tempered Steel: 5 stacks reached '+c.wd5.length+' times, seconds into the wave '+hist(c.wd5)+', the share it takes off then '+hist(c.wdCut));
console.log('basic attacks that took HP '+c.auto+' (kinds '+JSON.stringify(c.autoKind)+'), damage '+Math.round(c.dmg.auto)+'; attack interval (sampled) '+hist(c.interval));
console.log('hits on him that took HP: '+c.hitsOn+' (basic attacks '+c.hitAuto+', abilities and other '+c.hitAbil+'; physical '+c.hitPhys+', magic '+c.hitMag+'; from an enemy carrying his burn '+c.hitBurning+')');
console.log('kills: his '+c.kills+', his allies\' '+c.allyKills+'; enemies within 3 m of him (body to body) '+pc(c.within3,c.foeSamples)+', within 4 m '+pc(c.within4,c.foeSamples)+'; an enemy within 2 m of another '+pc(c.gap2,c.gapN));
console.log('the ally with the most attack at each wave start: '+hist(c.topAtk));
const L=V.arena(snaps([Object.assign(spec('tolley',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7), h=L[0];
console.log('body radius: Tolley '+V.bodyR(h).toFixed(2)+' m; attack interval '+h.atkInterval.toFixed(3)+' s; passMul '+h.passMul+'; max HP '+Math.round(h.maxHp)+', attack '+Math.round(h.dmg)+', melee '+!!h.melee+', range '+(h.range/V.METER).toFixed(2)+' m; pass '+JSON.stringify(h.pass)+'; armour '+Math.round(h.armorRating||0)+', mr '+Math.round(h.mrRating||0)+'; row '+h.t.row+', role '+h.t.role+'; warden cap at his passive level '+VMX('SKLV.wardenCap(passLv(units[0]))'));
console.log('kits: green '+JSON.stringify(VMX('KITS.tolley.green'))+' / blue '+JSON.stringify(VMX('KITS.tolley.blue'))+' / ult '+JSON.stringify(VMX('ULT_DEF.ashfall'))+' + '+JSON.stringify(VMX('HERO_ULT_ART.tolley'))+'; cast times green '+VMX('castTimeFor(units[0],"green")')+', blue '+VMX('castTimeFor(units[0],"blue")')+', ult '+VMX('castTimeFor(units[0],"ult")'));
