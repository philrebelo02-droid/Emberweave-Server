/* v257 CAMPAIGN DIFFICULTY + XP TUNER (Phil, 27 Aug).
   Authors the 100-stage curve so that hero level and glyph tier rise together and each chapter
   genuinely needs the tier Phil named. Uses the REAL stat model captured in /tmp/tune_snaps.json
   and the REAL shared combat core to search each stage's enemy scalar. */
const fs=require('fs');
const SIM=require('./server/sim.js');
const D=require(process.env.SNAPS||'/tmp/tune_snaps.json');
const P='./server/campaign-encounters.json';
const C=JSON.parse(fs.readFileSync(P,'utf8'));

const SQ=['vael','sylthaine','vireo','vex','tick'];   // the real early roster order
const FLAT=['maxHp','atkP','atkM','heal','armor','mr','armorPen','magicPen','crit','critDmg','critRes',
  'energyReg','startEnergy','regen','lifesteal','eva','acc','block','dmgBonus','dmgRed','haste','shieldStr',
  'ctrlHit','ctrlRes','healPow'];

/* unit(level, tierF) = the level-curve unit + the glyph delta at a FRACTIONAL ladder position.
   tierF = -1 means an empty board (a brand-new account owns zero fragments), 0 = a full Grey board,
   1 = a full Green board, and the values between are a partially built board. */
function tierDelta(h,tf){
  const ref=D.levels['70'][h];
  const d=(ti)=>{ if(ti<0) return null; const t=D.tiers[Math.max(0,Math.min(15,ti))].snaps[h];
    const o={}; for(const k of FLAT) o[k]=(t[k]||0)-(ref[k]||0); return o; };
  const lo=Math.floor(tf), hi=Math.ceil(tf), f=tf-lo;
  const A=d(lo), B=d(hi), o={};
  for(const k of FLAT) o[k]=(A?A[k]:0)*(1-f)+(B?B[k]:0)*f;
  return o;
}
function heroUnit(h,L,tf){
  const base=D.levels[String(Math.max(1,Math.min(70,L)))][h];
  const dl=tierDelta(h,tf), u=Object.assign({},base);
  for(const k of FLAT){ if(dl[k]) u[k]=(u[k]||0)+dl[k]; }
  u.maxHp=Math.round(u.maxHp); u.atkP=Math.round(u.atkP); u.atkM=Math.round(u.atkM); u.heal=Math.round(u.heal||0);
  u.atk=Math.max(u.atkP,u.atkM); u.hp=0; u.energy=0;
  return u;
}
const MON={
  'bug':{hp:110,dmg:18,role:'Mage'},'creep':{hp:155,dmg:16,role:'Warrior'},'dyrmen':{hp:155,dmg:16,role:'Warrior'},
  'fire boar':{hp:155,dmg:16,role:'Warrior'},'fire skeleton':{hp:155,dmg:16,role:'Warrior'},'garbage mob':{hp:250,dmg:13,role:'Tank'},
  'ghoul fiend':{hp:155,dmg:16,role:'Warrior'},'glitch phantom':{hp:110,dmg:18,role:'Mage'},'golem':{hp:250,dmg:13,role:'Tank'},
  'knat':{hp:110,dmg:18,role:'Mage'},'lost soulss':{hp:110,dmg:18,role:'Mage'},'mimic chest':{hp:250,dmg:13,role:'Tank'},
  'orc':{hp:155,dmg:16,role:'Warrior'},'raven':{hp:110,dmg:18,role:'Mage'},'rock golem':{hp:250,dmg:13,role:'Tank'},
  'shadow ghoul':{hp:155,dmg:16,role:'Warrior'},'skeletal warrior':{hp:155,dmg:16,role:'Warrior'},'slime':{hp:155,dmg:16,role:'Warrior'},
  'slug beast':{hp:220,dmg:18,role:'Warrior'},'tin beast':{hp:250,dmg:13,role:'Tank'},'turtle':{hp:250,dmg:13,role:'Tank'},
  'whisp candle':{hp:110,dmg:18,role:'Mage'},
  'ice beast':{hp:300,dmg:26},'monster with fireball':{hp:450,dmg:26},'nashor beast':{hp:300,dmg:26},
  'ogre beast':{hp:300,dmg:26},'water monster':{hp:300,dmg:26},'water serpent':{hp:300,dmg:26} };
function monUnit(m){
  const base=MON[m.key]||{hp:200,dmg:18};
  const sc=1+0.05*((m.lvl|0||1)-1);
  const bh=m.boss?2.4*1.15:1, bd=m.boss?1.8:1;
  return { key:m.key, role:(base.role==='Tank'||m.boss)?'Tank':'Bruiser', healer:false,
    maxHp:Math.round(base.hp*sc*(m.hpMul||1)*bh), hp:0, energy:0,
    atkP:Math.round(base.dmg*sc*(m.dmgMul||1)*bd), atkM:0, atk:Math.round(base.dmg*sc*(m.dmgMul||1)*bd),
    heal:0, speed:1, armor:(base.armor||0)*sc, mr:(base.mr||0)*sc, armorPen:0, magicPen:0,
    crit:0, critDmg:0.6, critRes:0, energyReg:0, startEnergy:0, regen:0,
    lifesteal:0, eva:0, acc:0, block:0, dmgBonus:1, dmgRed:0, haste:1, shieldStr:1,
    ctrlHit:0, ctrlRes:m.boss?0.5:0, healPow:0,
    kit:m.boss?{kind:'phys',shape:'cleave',coef:2.2,n:2}:{kind:'phys',shape:'nuke',coef:2.2},
    gearSkillSlot:null, gearSkill:null, shieldPool:0 };
}
/* the player fights manually (aimed ultimates, focus fire, retreats) — the auto core does not.
   SKILL is the honest allowance for that; the stage is authored so the AUTO team at target power
   finishes the floor with HP_TARGET of its pool left. */
const SKILL=1.35, HP_TARGET=0.30;
function band(u){ return Object.assign({},u,{maxHp:Math.round(u.maxHp*SKILL),
  atkP:Math.round(u.atkP*SKILL), atkM:Math.round(u.atkM*SKILL), atk:Math.round(u.atk*SKILL),
  heal:Math.round((u.heal||0)*SKILL)}); }

/* run the authored stage: waves in order, survivors carry HP+energy → fraction of team HP left */
function runStage(teamUnits, waves, seed){
  let carry=null, hpLeft=0;
  const total=teamUnits.reduce((s,u)=>s+u.maxHp,0);
  for(let w=0;w<waves.length;w++){
    const a=SIM.makeLine(teamUnits, carry), b=SIM.makeLine(waves[w].map(monUnit), null);
    const r=SIM.resolveLineBattle(a,b,(seed+w*0x9E3779B9)>>>0);
    if(!r.won) return {won:false, wave:w+1, frac:0};
    carry=teamUnits.map(u=>{ const st=r.aState.find(x=>x.key===u.key); return st?{hp:st.hp,energy:st.energy}:{hp:0,energy:0}; });
    hpLeft=carry.reduce((s,c)=>s+c.hp,0);
  }
  return {won:true, frac:hpLeft/total};
}

// ---------- the authored target curve ----------
const CH_END_LEVEL=[6,10,14,22,26,30,38,44,47,55,66];
const CH_END_TIER =[1, 2, 3, 5, 6, 7, 9, 10,11,13,15];   // ch11 = Orange, the true endgame
/* Chapter 1 is the onboarding chapter and is authored by hand: a brand-new account owns THREE
   heroes and ZERO glyph fragments, gains a 4th at 1-4 and a 5th around 1-6/1-7, and must reach a
   full Green board to clear 1-10. */
const CH1_LEVEL=[1,1,2,2,3,3,4,5,5,6];
const CH1_TIER =[-1,-1,-1,-1,-0.6,-0.2,0.2,0.5,0.75,1];
function targetFor(n){
  const c=Math.ceil(n/10), i=n-(c-1)*10;
  if(c===1){ const Lf=CH1_LEVEL[i-1], tf=CH1_TIER[i-1];
    return {Lf, L:Lf, tf, T:Math.max(0,Math.min(15,Math.round(tf))), c, i}; }
  const pL=c===1?1:CH_END_LEVEL[c-2], pT=c===1?-1:CH_END_TIER[c-2];   // chapter 1 starts on an EMPTY board
  const Lf=pL+(CH_END_LEVEL[c-1]-pL)*(i/10);
  const tf=pT+(CH_END_TIER[c-1]-pT)*(i/10);
  return {Lf, L:Math.max(1,Math.min(70,Math.round(Lf))), tf, T:Math.max(0,Math.min(15,Math.round(tf))), c, i};
}
function teamFor(n,L,tf){
  const size = n<=3?3 : n<=6?4 : 5;                 // 4th hero at 1-4, 5th by 1-7 (Phil)
  return SQ.slice(0,size).map(h=>heroUnit(h,L,tf));
}

// ---------- level curve → player XP ----------
const D_MAX_LEVEL=70;
const D_TROOP_INC=[8,10,35,45,60,70,70,80,90,110,110,120,120,130,130,130,130,130,150,250,0,0,0,300,330,350,0,370,0,0,450,0,0,600,700,800,0,0,1200,1200,1300,1400,0,0,1900,0,0,0,3000,3250,0,3250,3250,3250,0,3400,0,3520,3640,0,3760,0,3880,4000,0,4120,4240,0,4360];
function runSum(inc){const o=[];let r=0;for(const v of inc){r+=v;o.push(r);}return o;}
function cum(st){const c=new Array(D_MAX_LEVEL+1);c[1]=0;for(let L=2;L<=D_MAX_LEVEL;L++)c[L]=c[L-1]+st[L-2];return c;}
const T_CUM=cum(runSum(D_TROOP_INC));

const report=[];
let cumXp=0;
for(let n=1;n<=110;n++){
  const e=C[String(n-1)], tg=targetFor(n);
  const e0waves=e.waves.map(w=>w.map(m=>Object.assign({},m)));
  const team=teamFor(n,tg.L,tg.tf);
  const banded=team.map(band);
  const seed=SIM.seedFrom('tune:'+e.id);
  // binary-search the enemy scalar so the banded team clears with ~HP_TARGET left
  const HPT = n<=3 ? 0.50 : HP_TARGET;
  let lo=0.02, hi=60, best=null;
  for(let it=0; it<26; it++){
    const s=(lo+hi)/2;
    const waves=e0waves.map(w=>w.map(m=>Object.assign({},m,{lvl:tg.L, hpMul:+s.toFixed(3), dmgMul:+(s*0.94).toFixed(3)})));
    const r=runStage(banded, waves, seed);
    if(r.won && r.frac>HPT){ lo=s; best={s,frac:r.frac}; } else { hi=s; }
  }
  let s=best?best.s:lo;
  const mk=(v)=>e0waves.map(w=>w.map(m=>Object.assign({},m,{lvl:tg.L, hpMul:+v.toFixed(3), dmgMul:+(v*0.94).toFixed(3)})));
  // fine scan on the ACTUAL rounded scalar: the largest value the target team still clears at
  // roughly HP_TARGET of its pool. Discrete deaths make this non-monotonic, so scan, don't bisect.
  { let bestS=s*0.5, bestGap=1e9;
    for(let k=-30;k<=40;k++){ const cand=s*Math.pow(1.03,k); if(cand<=0.02) continue;
      const r=runStage(banded, mk(cand), seed);
      if(!r.won) continue;
      const gap=Math.abs(r.frac-HPT);
      if(r.frac>=HPT-0.06 && (cand>bestS || gap<bestGap-0.02)){ bestS=cand; bestGap=gap; } }
    s=bestS; }
  e.waves=mk(s);
  // recommended power: the target team's combat score (the same scale the server reports as "your power")
  const rec=Math.round(team.reduce((a,u)=>a+u.maxHp/8+Math.max(u.atkP,u.atkM)*3+(u.heal||0)*2,0));
  e.recommendedPower=rec;
  e.targetLevel=tg.L; e.targetGlyph=tg.tf<0?'None':D.ladder[tg.T];
  // XP: the campaign alone carries the player along the target level curve; heroes gain 10×
  const lo2=Math.max(1,Math.min(69,Math.floor(tg.Lf))), fr=tg.Lf-lo2;
  const want=Math.round(T_CUM[lo2]+(T_CUM[Math.min(70,lo2+1)]-T_CUM[lo2])*fr);
  const first=Math.max(8, Math.round(want-cumXp)); cumXp+=first;
  e.rewards.playerXpFirst=first;
  e.rewards.playerXpRepeat=Math.max(4, Math.round(first*0.4));
  e.rewards.heroXpFirst=first*10;
  e.rewards.heroXpRepeat=e.rewards.playerXpRepeat*10;
  // verification: the tier BELOW should not clear it
  const under=teamFor(n,Math.max(1,tg.L-4),tg.tf-1).map(band);
  const rUnder=runStage(under, e.waves, seed);
  const rAt=runStage(banded, e.waves, seed);
  report.push({id:e.id, L:tg.L, tier:(tg.tf<0?'(none)':D.ladder[tg.T]), s:+s.toFixed(3), rec,
    atFrac:+(rAt.frac||0).toFixed(2), underWon:rUnder.won, xp:first});
}
fs.writeFileSync(P, JSON.stringify(C,null,1));
fs.writeFileSync('/tmp/tune_report.json', JSON.stringify(report,null,1));
const show=report.filter(r=>/-(1|5|10)$/.test(r.id));
console.log(show.map(r=>`${r.id.padEnd(6)} L${String(r.L).padStart(2)} ${r.tier.padEnd(9)} scal=${String(r.s).padStart(7)} rec=${String(r.rec).padStart(6)} hpLeft=${r.atFrac} underTierClears=${r.underWon} xp=${r.xp}`).join('\n'));
console.log('stages where the tier below still clears:', report.filter(r=>r.underWon).map(r=>r.id).join(',')||'none', '('+report.filter(r=>r.underWon).length+'/'+report.length+')');
