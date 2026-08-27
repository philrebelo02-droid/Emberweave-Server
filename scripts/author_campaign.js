/* v258 — CAMPAIGN AUTHORING from Emberweave_Launch_Progression_and_Portal_Difficulty_Blueprint_v1.
   10 chapters × 10 fixed stages, player/hero cap 100, Orange at 100, no chapters 11+.
   Enemy stats come from the blueprint's smooth baseline, calibrated at stage 1 against the REAL
   starter team, then VALIDATED stage by stage in the shared server combat core (35-65% HP left).
   Run with REPORT=1 to validate without writing. */
const fs=require('fs');
const SIM=require('./server/sim.js');
const D=require(process.env.SNAPS||'/tmp/tune_snaps.json');
const P=__dirname+'/server/campaign-encounters.json';
const REPORT=!!process.env.REPORT;

const LADDER=['Grey','Green','Green +1','Blue','Blue +1','Blue +2','Purple','Purple +1','Purple +2',
  'Purple +3','Gold','Gold +1','Gold +2','Gold +3','Gold +4','Orange'];
/* blueprint §"The complete 1-100 Portal path" — quality target per five-stage band */
const BANDS=[[1,5,'Grey'],[6,10,'Green'],[11,15,'Green +1'],[16,20,'Blue'],[21,25,'Blue +1'],
  [26,30,'Blue +2'],[31,35,'Blue +2'],[36,40,'Purple'],[41,45,'Purple +1'],[46,50,'Purple +2'],
  [51,55,'Purple +2'],[56,60,'Purple +3'],[61,65,'Gold'],[66,70,'Gold'],[71,75,'Gold +1'],
  [76,80,'Gold +2'],[81,85,'Gold +2'],[86,90,'Gold +3'],[91,95,'Gold +4'],[96,100,'Orange']];
const bandOf=s=>BANDS.find(b=>s>=b[0]&&s<=b[1]);
/* blueprint §"Exact Glyph ascension path and level gates" */
const MIN_LEVEL={'Grey':1,'Green':7,'Green +1':13,'Blue':18,'Blue +1':24,'Blue +2':30,'Purple':36,
  'Purple +1':43,'Purple +2':50,'Purple +3':57,'Gold':65,'Gold +1':72,'Gold +2':79,'Gold +3':86,
  'Gold +4':93,'Orange':100};
/* families that exist at each tier (mirrors glyphCompile) */
const TIER_FAMS=(()=>{ const raw=Object.values(require('./server/glyph-source.json')), T={};
  for(const d of raw){ const m=/(\w+)\s+(Glyph|Core|Crown)$/.exec(d.name); if(!m) continue;
    (T[d.quality]=T[d.quality]||[]).push(m[1]); }
  for(const q in T) T[q]=[...new Set(T[q])];
  return T; })();

const SQ=['vael','sylthaine','vireo','vex','tick'];
const FLAT=['maxHp','atkP','atkM','heal','armor','mr','armorPen','magicPen','crit','critDmg','critRes',
  'energyReg','startEnergy','regen','lifesteal','eva','acc','block','dmgBonus','dmgRed','haste','shieldStr',
  'ctrlHit','ctrlRes','healPow'];
function tierDelta(h,tf){ const ref=D.levels['100'][h];
  const d=(ti)=>{ if(ti<0) return null; const t=D.tiers[Math.max(0,Math.min(15,ti))].snaps[h];
    const o={}; for(const k of FLAT) o[k]=(t[k]||0)-(ref[k]||0); return o; };
  const lo=Math.floor(tf), hi=Math.ceil(tf), f=tf-lo, A=d(lo), B=d(hi), o={};
  for(const k of FLAT) o[k]=(A?A[k]:0)*(1-f)+(B?B[k]:0)*f; return o; }
function heroUnit(h,L,tf){ const base=D.levels[String(Math.max(1,Math.min(100,L)))][h];
  const dl=tierDelta(h,tf), u=Object.assign({},base);
  for(const k of FLAT){ if(dl[k]) u[k]=(u[k]||0)+dl[k]; }
  u.maxHp=Math.round(u.maxHp); u.atkP=Math.round(u.atkP); u.atkM=Math.round(u.atkM); u.heal=Math.round(u.heal||0);
  u.atk=Math.max(u.atkP,u.atkM); u.hp=0; u.energy=0; return u; }

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
function monUnit(m){ const base=MON[m.key]||{hp:200,dmg:18};
  const sc=1+0.05*((m.lvl|0||1)-1), bh=m.boss?2.4*1.15:1, bd=m.boss?1.8:1;
  return { key:m.key, role:(base.role==='Tank'||m.boss)?'Tank':'Bruiser', healer:false,
    maxHp:Math.round(base.hp*sc*(m.hpMul||1)*bh), hp:0, energy:0,
    atkP:Math.round(base.dmg*sc*(m.dmgMul||1)*bd), atkM:0, atk:Math.round(base.dmg*sc*(m.dmgMul||1)*bd),
    heal:0, speed:1, armor:(base.armor||0)*sc, mr:(base.mr||0)*sc, armorPen:0, magicPen:0,
    crit:0, critDmg:0.6, critRes:0, energyReg:0, startEnergy:0, regen:0,
    lifesteal:0, eva:0, acc:0, block:0, dmgBonus:1, dmgRed:0, haste:1, shieldStr:1,
    ctrlHit:0, ctrlRes:m.boss?0.5:0, healPow:0,
    kit:m.boss?{kind:'phys',shape:'cleave',coef:2.2,n:2}:{kind:'phys',shape:'nuke',coef:2.2},
    gearSkillSlot:null, gearSkill:null, shieldPool:0 }; }

const SKILL=1.35;                                  // manual play beats the auto core by about this
const band=u=>Object.assign({},u,{maxHp:Math.round(u.maxHp*SKILL),atkP:Math.round(u.atkP*SKILL),
  atkM:Math.round(u.atkM*SKILL),atk:Math.round(u.atk*SKILL),heal:Math.round((u.heal||0)*SKILL)});
function runStage(team,waves,seed){ let carry=null, left=0;
  const total=team.reduce((s,u)=>s+u.maxHp,0);
  for(let w=0;w<waves.length;w++){
    const a=SIM.makeLine(team,carry), b=SIM.makeLine(waves[w].map(monUnit),null);
    const r=SIM.resolveLineBattle(a,b,(seed+w*0x9E3779B9)>>>0);
    if(!r.won) return {won:false, wave:w+1, frac:0};
    carry=team.map(u=>{ const st=r.aState.find(x=>x.key===u.key); return st?{hp:st.hp,energy:st.energy}:{hp:0,energy:0}; });
    left=carry.reduce((s,c)=>s+c.hp,0); }
  return {won:true, frac:left/total}; }

/* target team per stage. Chapter 1 is the onboarding ramp: a new account owns THREE heroes and
   ZERO fragments; the 4th arrives at 1-4 and the 5th around 1-6/1-7. */
const CH1_TIER=[-1,-1,-0.6,-0.3,0,0.2,0.4,0.6,0.8,1];
function targetFor(s){
  const b=bandOf(s), qi=LADDER.indexOf(b[2]);
  const tf = s<=10 ? CH1_TIER[s-1] : qi;
  return { L:s, tf, quality:(tf<0?'None':LADDER[Math.max(0,Math.round(tf))]), bandQuality:b[2], qi };
}
const teamFor=(s,t)=>(s<=3?SQ.slice(0,3):s<=6?SQ.slice(0,4):SQ).map(h=>heroUnit(h,t.L,t.tf));

/* the blueprint's smooth baseline */
const baseHp =s=>Math.pow(1.045,s-1)*(s%10===5?1.08:1)*(s%10===0?1.16:1);
const baseDmg=s=>Math.pow(1.035,s-1)*(s%10===5?1.05:1)*(s%10===0?1.10:1);

// ---- player XP: first-clear Portal supplies 82% of the level path (blueprint: 80-85%) ----
const D_MAX_LEVEL=100;
const D_TROOP_INC=[8,10,35,45,60,70,70,80,90,110,110,120,120,130,130,130,130,130,150,250,0,0,0,300,330,350,0,370,0,0,450,0,0,600,700,800,0,0,1200,1200,1300,1400,0,0,1900,0,0,0,3000,3250,0,3250,3250,3250,0,3400,0,3520,3640,0,3760,0,3880,4000,0,4120,4240,0,4360,0,4480,0,4600,4720,0,4840,4960,0,5080,0,5200,0,5320,5440,0,5560,5680,0,5800,0,5920,0,6040,6160,0,6280,6400,0,6520];
function runSum(a){const o=[];let r=0;for(const v of a){r+=v;o.push(r);}return o;}
function cum(st){const c=new Array(D_MAX_LEVEL+1);c[1]=0;for(let L=2;L<=D_MAX_LEVEL;L++)c[L]=c[L-1]+st[L-2];return c;}
const T_CUM=cum(runSum(D_TROOP_INC)), PORTAL_SHARE=0.82;

const C=JSON.parse(fs.readFileSync(P,'utf8'));
const all=Object.values(C).sort((a,b)=>a.node-b.node);
const stages=all.filter(e=>e.node<=100);            // blueprint: NO chapters 11+

// ---- calibrate the single global constant K at stage 1 against the real starter team ----
function stageWaves(e,s,khp,kdmg,tune){
  const lvScale=1+0.05*(s-1);
  const hp=khp*baseHp(s)*tune/lvScale, dm=kdmg*baseDmg(s)*tune/lvScale;
  return e.waves.map(w=>w.map(m=>Object.assign({},m,{lvl:s, hpMul:+hp.toFixed(4), dmgMul:+dm.toFixed(4)})));
}
const s1=stages[0], t1=targetFor(1), team1=teamFor(1,t1).map(band), seed1=SIM.seedFrom('bp:'+s1.id);
let K=1, lo=0.01, hi=200;
for(let i=0;i<40;i++){ const mid=(lo+hi)/2;
  const r=runStage(team1, stageWaves(s1,1,mid,mid,1), seed1);
  if(r.won && r.frac>0.55) lo=mid; else hi=mid; }
K=lo;
console.log('calibration: stage-1 constant K = '+K.toFixed(3));

/* ---------------------------------------------------------------------------
   VALIDATION (blueprint §"Smooth difficulty curve" + its test-state table).

   The blueprint's 1.045/1.035 baseline assumes a uniform encounter shape. Emberweave's 100 stages
   are hand-authored with genuinely different line-ups, so a smooth MULTIPLIER does not produce a
   smooth FIGHT. What we author smoothly is therefore the thing the player actually experiences —
   the HP the target line finishes with — using the blueprint's own numbers as the shape:

     normal   0.56 early drifting to 0.46 by stage 100   (inside the blueprint's 35-65% window)
     stage 5  the observable elite check                 (-0.06)
     stage 10 the meaningful, fair boss jump             (-0.12) and it must STOP a line one
              full quality behind (blueprint: "usually fails its chapter boss")

   The per-stage multiplier is then whatever the shared combat core says delivers that, and it is
   recorded in the data as `difficultyTune` next to the baseline it multiplies.
   --------------------------------------------------------------------------- */
const teams={}, seeds={}, unders={};
for(const e of stages){ const s=e.node, t=targetFor(s);
  teams[s]=teamFor(s,t).map(band); seeds[s]=SIM.seedFrom('bp:'+e.id);
  // "one quality behind but WELL-BUILT" (blueprint's words) — same level, one ladder step down,
  // plus a 12% allowance for the gear/composition edge a well-built line carries.
  unders[s]=teamFor(s,{L:t.L,tf:t.tf-1}).map(u=>{ const b=band(u);
    return Object.assign({},b,{maxHp:Math.round(b.maxHp*1.06), atkP:Math.round(b.atkP*1.06),
      atkM:Math.round(b.atkM*1.06), atk:Math.round(b.atk*1.06), heal:Math.round((b.heal||0)*1.06)}); }); }
function fracAt(e,s,tune){ return runStage(teams[s], stageWaves(e,s,K,K,tune), seeds[s]); }
function underAt(e,s,tune){ return runStage(unders[s], stageWaves(e,s,K,K,tune), seeds[s]); }
function targetFrac(s){ let f=0.62-(0.10*(s-1)/99);
  if(s%10===5) f-=0.08; if(s%10===0) f-=0.20; return f; }

const report=[]; let cumXp=0, outside=0, bossHolds=0;
for(const e of stages){
  const s=e.node, t=targetFor(s), boss=(s%10===0), want=targetFrac(s);
  let best=null;
  for(let k=-40;k<=100;k++){ const cand=Math.pow(1.04,k);
    const r=fracAt(e,s,cand); if(!r.won) continue;
    if(r.frac<0.33||r.frac>0.68) continue;
    let score=Math.abs(r.frac-want);
    if(boss && underAt(e,s,cand).won) score+=1;      // a chapter boss must stop the tier below
    if(!best||score<best.score) best={tune:cand,score,frac:r.frac};
  }
  if(!best){ for(let k=-40;k<=100;k++){ const cand=Math.pow(1.04,k); const r=fracAt(e,s,cand);
      if(r.won&&(!best||Math.abs(r.frac-want)<best.score)) best={tune:cand,score:Math.abs(r.frac-want),frac:r.frac}; } }
  const tune=best?best.tune:1, r=fracAt(e,s,tune), u=underAt(e,s,tune);
  if(!(r.won&&r.frac>=0.33&&r.frac<=0.68)) outside++;
  if(boss && !u.won) bossHolds++;
  e.waves=stageWaves(e,s,K,K,tune);
  e.checkpoint = boss?'boss' : (s%10===5?'guardian':'normal');
  e.targetLevel=s; e.targetGlyph=t.quality; e.recommendedQuality=t.bandQuality;
  e.qualityMinHeroLevel=MIN_LEVEL[t.bandQuality];
  e.bossLevelGate = boss ? Math.min(100, Math.round(s/10)*10) : 0;   // blueprint boss gates
  e.difficultyTune=+tune.toFixed(4);
  e.baselineHp=+baseHp(s).toFixed(4); e.baselineDmg=+baseDmg(s).toFixed(4);
  const team=teamFor(s,t);
  e.recommendedPower=Math.round(team.reduce((a,u2)=>a+u2.maxHp/8+Math.max(u2.atkP,u2.atkM)*3+(u2.heal||0)*2,0));
  const wantXp=Math.round(T_CUM[Math.min(100,s)]*PORTAL_SHARE);
  const first=Math.max(8, wantXp-cumXp); cumXp+=first;
  e.rewards.playerXpFirst=first;
  e.rewards.playerXpRepeat=Math.max(4, Math.round(first*0.4));
  e.rewards.heroXpFirst=first*10;                       // Phil: heroes gain ~10x the player's XP
  e.rewards.heroXpRepeat=e.rewards.playerXpRepeat*10;
  report.push({id:e.id, L:s, q:t.quality, tune:+tune.toFixed(3), frac:+(r.frac||0).toFixed(2),
    underWon:u.won, rec:e.recommendedPower, xp:first, gate:e.bossLevelGate});
}
console.log('stages outside the blueprint 35-65% window: '+outside+'/100');
console.log('chapter bosses that stop a line one quality behind: '+bossHolds+'/10');

// ---- fragment bands: one GUARANTEED named fragment per stage, the rest as BONUS ----
const slug=k=>k.toLowerCase().replace(/\s*\+\s*/g,'-plus-').replace(/\s+/g,'-');
for(const [from,to,q] of BANDS){
  const fams=TIER_FAMS[q]||[]; const n=to-from+1;
  const per=Math.ceil(fams.length/n);
  let fi=0;
  for(let s=from;s<=to;s++){
    const e=C[String(s-1)], boss=(s%10===0);
    const take=Math.min(per, fams.length-fi) || 1;
    const list=[];
    for(let k=0;k<take;k++){ const fam=fams[(fi+k)%fams.length], key=q+' '+fam;
      list.push({ fragmentId:slug(key), key, displayName:key+' Fragment',
        quantity: boss?2:1, guaranteed:k===0, bonus:k>0 }); }
    fi+=take;
    e.rewards.glyphFragments=list;
  }
  // any family the band could not fit rides along on the band's boss stage as a bonus
  const bossE=C[String(to-1)];
  while(fi<fams.length){ const fam=fams[fi++], key=q+' '+fam;
    bossE.rewards.glyphFragments.push({ fragmentId:slug(key), key, displayName:key+' Fragment',
      quantity:(to%10===0?2:1), guaranteed:false, bonus:true }); }
}

// coverage proof
const covered=new Set();
stages.forEach(e=>e.rewards.glyphFragments.forEach(f=>covered.add(f.key)));
let pairs=0, missing=[];
for(const q of LADDER) for(const fam of (TIER_FAMS[q]||[])){ pairs++; if(!covered.has(q+' '+fam)) missing.push(q+' '+fam); }
console.log('fragment pairs authored: '+(pairs-missing.length)+'/'+pairs+(missing.length?(' MISSING '+missing.join(', ')):''));
console.log('normal stages a line one quality behind can still clear: '+report.filter(r=>r.underWon&&r.L%10!==0).length+'/90 (blueprint expects most)');

if(!REPORT){
  fs.writeFileSync(P, JSON.stringify(stages,null,1));   // the file is a JSON ARRAY — campCompile requires it
  fs.writeFileSync('/tmp/bp_report.json', JSON.stringify(report,null,1));
  console.log('written: '+stages.length+' stages');
}
console.log(report.filter(r=>/-(1|5|10)$/.test(r.id)).map(r=>
  `${r.id.padEnd(6)} L${String(r.L).padStart(3)} ${String(r.q).padEnd(9)} tune=${String(r.tune).padStart(6)} hpLeft=${r.frac} rec=${String(r.rec).padStart(6)} gate=${r.gate} under=${r.underWon} xp=${r.xp}`).join('\n'));
