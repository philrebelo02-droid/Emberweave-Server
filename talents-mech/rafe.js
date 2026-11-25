/* RAFE MARROW - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Rafe Marrow": what he added)
   His real kit (the code, not the tooltip wording; a Marksman, mid row, 13.6 m reach, one swing every 2.0 s at level 100; everything he deals is physical
   but Pirate's Instinct):
   - Basic attack: his cutlass when his target's CENTRE is within 2.5 m of his (x1.15 damage), else his pistol. Bodies are 1.56 m (his) and 1.6 to 2 m
     (heroes) in radius, so the cutlass needs an enemy standing INSIDE him: 1 of 260 landed swings in 20 seeded fights (rafe-kit-facts.js). Reported, not
     changed. A guarded num line ('rfClose') on the 2.5 m (Stand and Fight); partPre / part ('rfCut' | 'rfShot') around the blow when it lands.
   - Pirate's Instinct (passive 'instinct'): every 4th swing, AT THE PRESS (before the blow lands), a separate hit of the swing's damage x 50% .. 200% (skill
     level) as TRUE damage on his target (u._piN counts the swings). partPre / part ('rfInst') around it; a pass hook ('rfPre') right before the count.
   - Pistol Barrage ('volley', green, cd 6): ONE bullet at each of the 4 nearest living enemies (no reach limit), 85% of attack, each landing 0.14 s later
     (groundHazards). partPre / part ('rfBullet') around each landing (guarded on his key: the volley case is shared).
   - Grappling Hook ('grapple', blue, cd 9, delivered as a shot): 125% of attack on his target (the deliverLaunch skillTgt hook may change it), a pull of at
     most 75% of the gap or 5 m, and a stun through ccApply: 3.5 x 0.7 = 2.45 s (resisted by the level roll in 69 of 127 seeded casts).
   - Dead Man's Fortune (ultimate 'multiShot', energy; HERO_ULT_ART.rafe merged at the cast: evadeEva 0.5, evadeDur 3): one shot at each of the 5 nearest
     enemies (180% of attack, 0.30 s flight), and +50% Evasion (evaStat, at most 75% in all) for 3 s (u._miragT / u._miragEva). partPre / part ('rfDmf')
     around each shot's landing. The game's Evasion misses reach his rows through the 'evaded' hook (Nox's line).
   Honest Cards, Holes, At the Table, Coins, Crossdraws and Smoke exist only through his talents. Every state, mark and window of his starts with 'rf';
   his per-fight object is T.s.rf. Every lock he keeps is a countdown (the fight clock restarts each wave): no `times` list.
   Readings, caps and corrected tooltips: WIRING/49 - RAFE MARROW - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const INST='rfInst', CUT='rfCut', SHOT='rfShot', BUL='rfBullet', DMF='rfDmf', HOOK='grapple', VOL='volley', ULT='multiShot', COL='#ffe08a';
/* the families: each one's bookkeeping runs when any talent that reads it is learned (the tier-1 talent still owns its number) */
const CARD=['fs_1_1','fs_4_1','fs_6_1','fs_7_1','fs_8_1','fs_9_1','fs_11_1','fs_12_2','fs_13_4'];
const HOLE=['fs_1_4','fs_2_4','fs_4_4','fs_5_4','fs_6_4','fs_7_3','fs_8_4','fs_9_4','fs_10_3','fs_11_4','fs_13_4'];
const TABLE=['co_1_1','co_2_1','co_3_1','co_3_3','co_4_1','co_5_1','co_5_4','co_8_1','co_5_2','co_5_3','co_9_1','co_6_2','co_6_3','co_10_1','co_11_1','co_11_2','co_12_1','co_12_4','co_13_1'];
const COIN=['co_1_3','co_2_3','co_3_3','co_8_3','co_6_4','co_7_3','co_10_3','co_11_3','co_12_3','co_13_1'];
const SMOKE=['ss_1_2','ss_1_4','ss_2_2','ss_n1','ss_3_2','ss_5_4','ss_6_4','ss_7_2','ss_8_2','ss_10_2','ss_12_2','ss_13_3'];
const XD=['ss_1_1','ss_2_1','ss_3_1','ss_6_1','ss_7_1','ss_8_1','ss_9_1','ss_9_4','ss_11_4','ss_12_1','ss_13_3'];
const CRT=['fs_1_2','fs_4_1','co_2_3','ss_6_1','ss_8_1'];                                // critical chance: ONE group, at most 5%
const SELFDR=['fs_12_2','co_3_4','co_9_4','ss_6_2','ss_10_4','ss_10_2','co_5_1'];       // damage reduction on him: ONE group, at most 35%
const ALLYDR=['co_5_1','ss_10_2'];                                                     // on his allies: ONE group, at most 15%
const EVA=['ss_1_4','ss_7_3','ss_13_3'];                                               // his evades (the game's Evasion, Ghost Ship)
const DEATHK=COIN.concat(['co_5_3','co_11_1','fs_8_4','co_13_1']);
const HOOKK=TABLE.concat(['co_3_1','co_11_4','co_13_1','co_7_1','co_6_3','ss_9_4']);
const DR_FLOOR=0.65, ALLY_FLOOR=0.85, CRIT_CAP=0.05, REGEN=0.012, EVA_TOP=0.75, STUN_TOP=4.0;
const S=T=>T.s.rf||(T.s.rf={lw:null,w:null,xd:false,cp:false,sw:false,duel:0,vol:{sp:false},sb:false,kyd:false,kydShot:false,bite:false,ndl:false,
  cd:{fih:0,lc:0,room:0,part:0},bh:0,bud:null,tl:{},lh:{},pr:{},fw:{},pin:null,lcN:0,kl:{},gr:null});
const any=(T,L)=>{ const c=T.s.rfAny||(T.s.rfAny=new Map()); let v=c.get(L); if(v===undefined){ v=L.some(id=>T.r[id]); c.set(L,v); } return v; };
const foe=(u,x)=>!!x&&x.team!==u.team;
const M=A=>A.eng().METER();
/* Pirate's Instinct's share at his passive's level (the page's instinctPct: 50% at level 1 to 200% at level 100) */
const instPct=u=>{ const lv=Math.max(1,Math.min(100,((u.skillLv||[])[3]|0)||1)); return 0.5+1.5*(lv-1)/99; };
const atkNow=u=>(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1);
/* the cutlass reach as the page measures it (centre to centre): 2.5 m, Stand and Fight 4 m */
const thr=(A,T)=>(2.5+(T.r.ss_5_2?1.5:0))*M(A);
const holes=(A,T,u,t)=>A.ustGet(T,u,t,'rfHole');
function addHole(A,T,u,t,n){ if(!t||!t.alive||!(n>0)) return; A.ustPut(T,u,t,'rfHole',Math.min(3,holes(A,T,u,t)+n)); }
/* the enemies on the line from him through t, behind t (their body within 0.5 m of the line), nearest first */
function behind(A,T,u,t){ const E=A.eng(), dx=t.x-u.x, dy=t.y-u.y, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, out=[];
  for(const e of A.pick(T,u,{team:'enemy'},{u})){ if(e===t) continue; const rx=e.x-u.x, ry=e.y-u.y, p=rx*ux+ry*uy; if(!(p>L)) continue;
    if(Math.abs(rx*uy-ry*ux)<E.bodyR(e)+0.5*M(A)) out.push([e,p]); }
  return out.sort((a,b)=>a[1]-b[1]).map(x=>x[0]); }
/* a real hit of his fired by a talent (the page's dealDamage through the bound strike), as `cur` to his rows; never counted as one of his talent actions */
function strike(A,T,u,t,amt,cur,kind){ const E=A.eng(), s=T.s; if(!t||!t.alive||!u.alive||!(amt>0)) return; (s.ps||(s.ps=[])).push(s.cur); s.cur=cur; const d=s.d; s.d=0;
  try{ if(E.strike) E.strike(u,t,amt,COL,kind); else A.hurt(T,u,t,amt,COL,cur); } finally{ s.d=d; s.cur=s.ps.pop(); } }
const lastHit=(A,T,t)=>{ if(t) S(T).lh[t.uid]=A.eng().now(); };
/* healing that comes a little at a time (Sea Dog, Ambidextrous): ONE budget that refills at 1.2% of his max HP a second (at most one second banked) */
function regen(A,T,u,amt){ const o=S(T), cap=u.maxHp*REGEN; if(o.bud==null) o.bud=cap; const g=Math.min(amt,o.bud); if(!(g>0)) return 0; o.bud-=g; A.eng().healUnit(u,g); return g; }
/* his count toward the next Pirate's Instinct shot moves on by n (never past the swing that fires it) */
function advance(T,u,n){ if(!(u.pass&&u.pass.instinct)||!(n>0)) return; const need=T.r.fs_5_3?2:3; u._piN=Math.min(need,Math.max(u._piN||0,0)+n); }
const eva=u=>(u._miragT||0)>0&&(u._miragEva||0)>0;                                     // Dead Man's Fortune's evasion is running (his ultimate, Ghost Ship, the signature)
/* the share of a hit on him his damage-reduction talents leave (each multiplies: the combining rule), floored at 65% */
function drK(A,T,u,s,auto){ const r=T.r, E=A.eng(); let k=1;
  if(r.fs_12_2) k*=1-0.006*r.fs_12_2*A.stGet(T,'rfCard');                              // Saltwater Luck (per Card held)
  if(r.co_3_4&&s&&A.gap(u,s)<2.5*M(A)) k*=1-0.02*r.co_3_4;                             // Close Quarters
  if(r.co_9_4&&auto) k*=1-0.015*r.co_9_4;                                              // Thick Coat (basic attacks)
  if(r.ss_6_2&&A.pick(T,u,{team:'enemy',within:4},{u}).length) k*=1-0.02*r.ss_6_2;     // Toe to Toe
  if(r.ss_10_4&&u.hp<0.40*u.maxHp) k*=1-0.02*r.ss_10_4;                                // Hardened
  if(r.ss_10_2&&s&&A.markOf(u,s,'rfSmk')) k*=1-0.015*r.ss_10_2;                        // Smoke Lungs
  if(r.co_5_1&&s&&A.markOf(u,s,'rfTab')) k*=1-0.02*r.co_5_1;                           // Arguing Back
  void E; return Math.max(DR_FLOOR,k); }
function allyK(A,T,u,s){ const r=T.r; let k=1; if(!s) return 1;
  if(r.co_5_1&&A.markOf(u,s,'rfTab')) k*=1-0.02*r.co_5_1;
  if(r.ss_10_2&&A.markOf(u,s,'rfSmk')) k*=1-0.015*r.ss_10_2;
  return Math.max(ALLY_FLOOR,k); }

module.exports={
  hero:'rafe', casting:true,
  states:{
    rfCard:{max:4},                                    // Honest Cards (Four Honest Cards): kept for the fight
    rfCoin:{max:7},                                    // Coins (Collecting): kept for the fight
    rfKill:{max:7},                                    // Seven Chairs: enemies he has killed this fight
    rfRhy:{max:5,dur:4},                               // Rhythm of Steel: Crossdraws in the last 4 s
    rfHole:{unit:true,max:3,dur:P('rf.hole',5)},       // Holes (Through the Coat), on enemies: all lapse 5 s (Breastplate Next longer) after the last one
    rfChk:{unit:true,max:9,dur:10}                     // Choking: stuns on an enemy in the last 10 s (at most 2)
  },
  always:[
    /* his swings: cutlass or pistol, and a Crossdraw (the weapon switched; Duel Ready and Room Full of Smoke force one) */
    {on:'partPre',skill:CUT,reqAny:XD,do:[{fn:'swPre'}]}, {on:'partPre',skill:SHOT,reqAny:XD,do:[{fn:'swPre'}]},
    {on:'part',skill:CUT,reqAny:XD,do:[{fn:'swPost'}]}, {on:'part',skill:SHOT,reqAny:XD,do:[{fn:'swPost'}]},
    /* a Pirate's Instinct shot landed: the signature's line, a Card, a Hole */
    {on:'hit',if:{casting:INST,targetTeam:'enemy'},reqAny:CARD.concat(HOLE),do:[{fn:'instHit'}]},
    /* Pistol Barrage: the spend of four Cards; each bullet that hits leaves Smoke */
    {on:'kit',skill:VOL,reqAny:CARD,do:[{fn:'volKit'}]},
    {on:'hit',if:{casting:BUL,targetTeam:'enemy'},reqAny:SMOKE,do:[{mark:'rfSmk',on:'target',dur:P('rf.smk',3),longest:true}]},
    /* Smoke: a Smoked enemy's basic attack misses (on him, on an ally); without Full of Smoke at its rank-1 rate */
    {on:'in',reqAny:SMOKE,unless:'ss_1_2',if:{auto:true,srcHas:'rfSmk'},chance:0.03,do:[{miss:true},{fn:'smkMe'}]},
    {on:'teamIn',reqAny:SMOKE,unless:'ss_1_2',if:{auto:true,srcHas:'rfSmk',targetTeam:'ally'},chance:0.03,do:[{miss:true},{fn:'smkAl'}]},
    /* his damage reduction (ONE group, 35%), his allies' (ONE group, 15%) */
    {on:'in',reqAny:SELFDR,do:[{fn:'drIn'}]}, {on:'dotIn',reqAny:SELFDR,do:[{fn:'drDot'}]},
    {on:'teamIn',reqAny:ALLYDR,if:{targetTeam:'ally',srcTeam:'enemy'},do:[{fn:'drAl'}]}, {on:'teamDotIn',reqAny:ALLYDR,if:{targetTeam:'ally'},do:[{fn:'drAl'}]},
    /* the enemies he has hit (Coins: a death within 4 s), and the deaths he watches */
    {on:'hit',if:{targetTeam:'enemy'},reqAny:COIN.concat(['fs_12_1']),do:[{fn:'lastHit'}]},
    {on:'death',if:{who:'enemy'},reqAny:DEATHK,do:[{fn:'died'}]},
    /* Grappling Hook: before (its options: the stun extensions) and after (At the Table, Duel Ready, the pull, the signature's hold) */
    {on:'kit',skill:HOOK,reqAny:HOOKK,do:[{fn:'grKit'}]}, {on:'cast',skill:HOOK,reqAny:HOOKK,do:[{fn:'grCast'}]},
    /* the stun-lock rule: every stun of his on an enemy (his hook's, Choking's) locks it 0.5 s past its end */
    {on:'ccHit',if:{cc:['stunned']},reqAny:['ss_3_2','co_3_1','co_11_4','co_13_1'],do:[{fn:'stunLock'}]},
    {on:'ccHit',if:{cc:['stunned']},reqAny:['co_3_1','co_11_4','co_13_1'],do:[{fn:'grStun'}]},
    /* his critical-chance talents: ONE seeded roll on each hit, at most 5% in all */
    {on:'crit',reqAny:CRT,chance:{flat:1,x:{fn:'critP'}},force:true},
    /* the game's Evasion made a hit miss him */
    {on:'evaded',reqAny:EVA,do:[{fn:'evMe'}]},
    {on:'tick',do:[{fn:'tk'}]}
  ],
  talents:{
    /* ======================= THE FOURTH SHOT ======================= */
    fs_1_1:[ {on:'hit',if:{casting:BUL,targetTeam:'enemy',fn:'volSp'},do:[{fn:'cardDmg'}]} ],                              // Four Honest Cards (instHit gains; volKit spends; 5% x 5 true per bullet)
    fs_n1:[],                                                                                                                 // Every Man Has a Tell (tk: 20% x 5 at 75 / 50 / 25%)
    fs_1_4:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.03),per:{ust:'rfHole'}} ],                                    // Through the Coat (3% x 3 armor per Hole)
    fs_2_1:[ {on:'cast',skill:VOL,do:[{fn:'countLoud'}]} ],                                                                  // Counting Out Loud (1 x 3 swings per Barrage)
    fs_2_4:[ {param:'rf.hole',add:R(1)} ],                                                                                   // Breastplate Next (Holes 1 s x 3 longer)
    fs_3_1:[ {on:'hit',if:{casting:INST,targetTeam:'enemy'},do:[{fn:'dealt'}]} ],                                            // Dealt Clean (half to the enemy behind)
    fs_2_3:[ {on:'out',if:{casting:BUL,targetTeam:'enemy'},more:R(0.03)} ],                                                  // Hot Barrels
    fs_3_3:[ {on:'cd',skill:'green',add:R(-0.15)} ],                                                                         // Quick Reload
    fs_4_1:[],                                                                                                               // Card Sharp (critP: 0.5% x 5 per Card)
    fs_4_3:[ {on:'cast',skill:VOL,chance:R(0.2),do:[{fn:'spare'}]} ],                                                        // Spare Pistol (a fifth bullet)
    fs_4_4:[ {on:'out',if:{casting:INST,targetTeam:'enemy',targetUst:{rfHole:1}},more:R(0.04)} ],                            // Closed Door
    fs_5_1:[ {on:'out',if:{casting:INST,targetTeam:'enemy'},more:R(0.03)} ],                                                 // Long Count
    fs_5_2:[ {on:'crit',if:{casting:INST},force:true} ],                                                                     // Fourth Is Mine (PICK ONE: always critical)
    fs_5_3:[ {on:'pass',skill:'rfPre',do:[{fn:'third'}]}, {on:'out',if:{casting:INST,targetTeam:'enemy'},mul:P('rf.third',0.75)} ],   // Third Is Yours (PICK ONE: every third, 75%)
    fs_5_4:[ {on:'out',if:{targetTeam:'enemy',targetUst:{rfHole:3}},more:R(0.03)} ],                                         // Riddled
    fs_6_1:[ {on:'rfSpend',do:[{window:'rfStk',dur:6}]}, {stat:{atk:R(0.03)},if:{window:'rfStk'}} ],                         // Stacked Deck
    fs_6_2:[ {on:'out',if:{casting:INST,targetTeam:'enemy',crit:true},critMore:R(0.05)} ],                                   // Marked Card (an ability's crit: at most 20%)
    fs_6_3:[ {param:'rf.third',add:R(0.0375)} ],                                                                             // Quick Hand (75% x 1.05 per rank)
    fs_6_4:[ {on:'teamIn',if:{targetTeam:'enemy',srcIs:'ally',targetUst:{rfHole:1}},more:R(0.02)} ],                        // Splinters (his allies' hits)
    fs_7_1:[ {on:'out',if:{auto:true,targetTeam:'enemy',stackMin:{rfCard:4}},more:0.15} ],                                   // Full House
    fs_7_3:[ {on:'hit',if:{casting:BUL,targetTeam:'enemy'},do:[{fn:'boh'}]} ],                                               // Barrage of Holes
    fs_7_4:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.02)} ],                                                       // Bored Through
    fs_8_1:[ {on:'rfSpend',do:[{heal:{pct:R(0.01),of:'maxHp',x:'spent'},on:'self'}]} ],                                      // Cut the Deck (1% x 5 of max HP per Card)
    fs_8_3:[ {on:'out',if:{casting:BUL,targetTeam:'enemy',crit:true},critMore:R(0.04)} ],                                    // Lead Rain (an ability's crit: 20%)
    fs_8_4:[],                                                                                                               // Hole Passed On (died)
    fs_9_1:[ {on:'out',if:{casting:BUL,targetTeam:'enemy',fn:'volSp'},more:R(0.03)} ],                                       // Dealer's Choice
    fs_9_2:[ {on:'hit',if:{casting:DMF,targetTeam:'enemy'},do:[{fn:'fcount'}]} ],                                            // Fortune's Count (each shot is a Pirate's Instinct shot)
    fs_9_4:[ {stat:{atk:R(-0.005)},to:{team:'enemy',ust:{rfHole:1}},per:{ust:'rfHole'}} ],                                   // Rust
    fs_10_2:[ {on:'out',if:{casting:DMF,targetTeam:'enemy'},more:R(0.03)} ],                                                 // Last Shot Owed
    fs_10_3:[ {on:'out',if:{targetTeam:'enemy',crit:true,targetUst:{rfHole:1}},critMore:R(0.02)} ],                          // Powder Burn (at most 10%)
    fs_11_1:[ {on:'hurt',once:'wave',if:{selfHpBelow:0.30},do:[{stack:'rfCard',set:4}]} ],                                   // Ace Up the Sleeve
    fs_11_3:[ {on:'cast',skill:VOL,do:[{fn:'sbOn'}]}, {on:'out',if:{auto:true,targetTeam:'enemy',fn:'sbReady'},more:R(0.05),do:[{fn:'sbOff'}]} ],   // Smoking Barrel
    fs_11_4:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.01),per:{ust:'rfHole'}} ],                                          // Wrecked Plate
    fs_1_2:[],                                                                                                               // Steady Aim (critP: was a plain stat, 1% x 5; now inside the 5% group)
    fs_12_1:[ {on:'kill',do:[{fn:'kl'}]}, {stat:{atk:R(0.01)},per:'rfKill'} ],                                               // Seven Chairs
    fs_12_2:[],                                                                                                              // Saltwater Luck (drK: 0.6% x 5 per Card)
    fs_12_3:[ {on:'wave',once:'fight',do:[{fn:'reach',m:R(1)}]} ],                                                           // Long Barrel
    fs_12_4:[ {on:'out',if:{casting:INST,targetTeam:'enemy'},do:[{fn:'pierceOut'}]}, {on:'hit',if:{casting:INST,targetTeam:'enemy'},do:[{fn:'pierceHit'}]} ],   // Nothing in the Way
    fs_13_4:[],                                                                                                              // Four Is Honest (SIGNATURE; instHit)
    /* ======================= THE COLLECTOR ======================= */
    co_1_1:[ {on:'out',if:{targetTeam:'enemy',targetHas:'rfTab'},more:R(0.02)} ],                                            // Back to the Table
    co_2_2:[ {on:'out',if:{casting:CUT,targetTeam:'enemy'},more:R(0.03)} ],                                                  // Saber for Arguers
    co_1_3:[ {stat:{atk:R(0.004)},per:'rfCoin'} ],                                                                           // Collecting (died gains)
    co_2_1:[ {on:'kit',skill:HOOK,opt:{pull:{addM:R(1)}}} ],                                                                 // Long Rope (pulls 1 m x 3 farther)
    co_2_3:[],                                                                                                               // Heavy Purse (critP: 0.3% x 3 per Coin)
    co_3_1:[],                                                                                                               // Hear What You Owe (grKit: +0.8 s)
    co_3_2:[ {on:'ccIn',less:R(0.04),upTo:0.20} ],                                                                           // Salt Lantern (capped at 20%)
    co_3_3:[],                                                                                                               // Count It Twice (died)
    co_3_4:[],                                                                                                               // Close Quarters (drK)
    co_4_1:[ {param:'rf.tab',add:R(0.3)} ],                                                                                  // Stay Seated
    co_4_2:[ {on:'out',if:{casting:CUT,targetTeam:'enemy',crit:true},critMore:R(0.03)} ],                                    // Edge of the Blade (at most 9%)
    co_4_4:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                                           // Hook Speed
    co_5_1:[],                                                                                                               // Arguing Back (drK, allyK)
    co_8_3:[ {stat:{lifesteal:R(0.002)},per:'rfCoin'} ],                                                                     // Interest
    co_5_4:[ {on:'out',if:{targetTeam:'enemy',targetHas:'rfTab',crit:true},critMore:R(0.02)} ],                              // Sharp Practice (at most 10%)
    co_6_1:[ {on:'out',if:{casting:HOOK,targetTeam:'enemy'},more:R(0.03)} ],                                                 // Dragged Back
    co_9_4:[],                                                                                                               // Thick Coat (drK)
    co_6_4:[ {stat:{hp:R(0.005)},per:'rfCoin'} ],                                                                            // Pocket Change
    co_7_1:[ {on:'skillTgt',skill:HOOK,do:[{fn:'farthest'}]} ],                                                              // Last Chair Pulled (grCast: all the way back)
    co_7_2:[ {stat:{aspd:R(0.02)},if:{fn:'cutNow'}} ],                                                                       // Duelist's Habit
    co_7_3:[ {on:'out',if:{casting:DMF,targetTeam:'enemy'},more:R(0.01),per:'rfCoin'} ],                                     // Thrown After
    co_8_1:[ {on:'teamHeal',if:{unitHas:'rfTab',who:'enemy'},less:R(0.03)} ],                                                // Bound at the Table
    co_5_2:[ {on:'hit',if:{casting:CUT,targetTeam:'enemy',targetHas:'rfTab'},do:[{heal:{pct:P('rf.settle',0.10),of:'hpLost'},on:'self'}]} ],   // Settle Up (PICK ONE)
    co_5_3:[],                                                                                                               // Run Them Down (PICK ONE; died)
    co_8_2:[ {on:'hurt',if:{srcWithin:2.5},do:[{fn:'biteOn'}]}, {on:'out',if:{casting:CUT,targetTeam:'enemy',fn:'biteReady'},more:R(0.04),do:[{fn:'biteOff'}]} ],   // Biting Reply
    co_9_1:[],                                                                                                               // Whole Table (grCast)
    co_6_2:[ {param:'rf.settle',add:R(0.03)} ],                                                                              // Paid in Blood
    co_6_3:[ {on:'out',if:{casting:HOOK,targetTeam:'enemy',fn:'ndlReady'},more:R(0.08)} ],                                   // No Door Left (died sets it, grCast spends it)
    co_10_1:[ {on:'out',if:{targetTeam:'enemy',targetHas:'rfTab',targetHpBelow:0.5},more:R(0.03)} ],                         // Still Hungry
    co_10_2:[ {on:'hit',if:{casting:CUT,targetTeam:'enemy'},do:[{slow:R(0.03),dur:1,on:'target'}]} ],                        // Point Made
    co_10_3:[ {on:'out',if:{targetTeam:'enemy',stackMin:{rfCoin:7}},more:R(0.03)} ],                                         // Full Purse
    co_11_1:[],                                                                                                              // Collector's Patience (died)
    co_11_2:[ {on:'hit',if:{casting:CUT,targetTeam:'enemy',targetHas:'rfTab'},do:[{fn:'swordArg'}]} ],                       // Sword Argument
    co_11_3:[ {on:'hit',if:{casting:DMF,targetTeam:'enemy'},do:[{mark:'rfThr',on:'target',dur:4}]},
              {on:'out',if:{targetTeam:'enemy',targetHas:'rfThr'},more:0.04,per:'rfCoin',upTo:0.28} ],                        // Coins Thrown
    co_11_4:[],                                                                                                              // Tight Knots (grKit: +0.06 s x 5)
    co_12_1:[ {on:'crit',if:{fn:'fwOn'},force:true}, {on:'out',if:{targetTeam:'enemy',fn:'fwOn'},more:R(0.03)}, {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'fwOff'}]} ],   // Fair Warning
    co_9_3:[ {on:'out',if:{casting:DMF,targetTeam:'enemy'},more:R(0.03)} ],                                                  // Coin Spin
    co_12_3:[ {on:'wave',once:'fight',do:[{stack:'rfCoin',add:R(1)}]} ],                                                     // Ship's Purse
    co_12_4:[ {stat:{mr:R(0.03)},if:{fn:'anyTab'}} ],                                                                        // Sea Legs
    co_13_1:[ {on:'crit',if:{targetHas:'rfHeld'},force:true}, {on:'hit',if:{targetTeam:'enemy',targetHas:'rfHeld',crit:true},do:[{fn:'heldCoin'}]} ],   // The Last Chair (SIGNATURE; grKit / grCast / died)
    /* ======================= SABER AND SMOKE ======================= */
    ss_1_1:[ {on:'out',if:{targetTeam:'enemy',fn:'xd'},more:R(0.04)} ],                                                      // Crossdraw
    ss_1_2:[ {on:'in',if:{auto:true,srcHas:'rfSmk'},chance:R(0.03),do:[{miss:true},{fn:'smkMe'}]},
             {on:'teamIn',if:{auto:true,srcHas:'rfSmk',targetTeam:'ally'},chance:R(0.03),do:[{miss:true},{fn:'smkAl'}]} ],     // Full of Smoke (3% x 3)
    ss_1_4:[],                                                                                                               // Sea Dog (evMe, smkMe; the regeneration budget)
    ss_2_1:[ {on:'rfXd',do:[{window:'rfQd',dur:2}]}, {stat:{aspd:R(0.03)},if:{window:'rfQd'}} ],                             // Quick Draw
    ss_2_2:[ {param:'rf.smk',add:R(0.3)} ],                                                                                  // Thick Smoke
    ss_n1:[ {on:'out',if:{casting:HOOK,targetTeam:'enemy',targetHas:'rfSmk'},more:0.10} ],                                   // Hook Through the Haze (LINK; grCast: +1 s At the Table)
    ss_3_1:[],                                                                                                               // Both Hands (swPost)
    ss_3_2:[],                                                                                                               // Choking (smkMe; stun-lock rule)
    ss_3_3:[ {on:'kit',skill:ULT,opt:{evadeDur:{add:R(0.3)}}} ],                                                             // Fortune's Favour
    ss_3_4:[ {on:'out',if:{casting:CUT,targetTeam:'enemy'},more:R(0.03)} ],                                                  // Cutlass Edge
    ss_5_2:[ {on:'num',skill:'rfClose',addM:1.5} ],                                                                          // Stand and Fight (PICK ONE: 4 m)
    ss_5_3:[ {on:'hit',if:{casting:CUT,targetTeam:'enemy'},do:[{fn:'kydOn'}]}, {on:'out',if:{casting:SHOT,targetTeam:'enemy',fn:'kydReady'},more:0.25,do:[{fn:'kydOff'}]} ],   // Keep Your Distance (PICK ONE)
    ss_4_3:[ {on:'kit',skill:ULT,opt:{evadeEva:{add:R(0.02)}}} ],                                                            // Lucky Coat (2 points x 5)
    ss_4_4:[ {on:'out',if:{casting:[SHOT,BUL],targetTeam:'enemy'},more:R(0.03)} ],                                           // Gun Hand
    ss_6_2:[],                                                                                                               // Toe to Toe (drK)
    ss_6_3:[ {on:'hit',if:{casting:SHOT,targetTeam:'enemy',fn:'kydShot'},do:[{slow:R(0.08),dur:1.5,on:'target'}]} ],         // Cover Fire
    ss_n2:[ {on:'out',if:{casting:SHOT,targetTeam:'enemy',targetHas:'rfPart'},more:R(0.08),do:[{mark:'rfPart',on:'target',clear:true}]} ],   // Parting Shot (tk marks it)
    ss_5_4:[ {on:'out',if:{targetTeam:'enemy',targetHas:'rfSmk'},more:R(0.02)} ],                                            // Dirty Fighting
    ss_6_1:[ {on:'rfXd',do:[{stack:'rfRhy',add:1}]} ],                                                                       // Rhythm of Steel (critP)
    ss_5_1:[ {stat:{move:R(0.03)}} ],                                                                                        // Footwork
    ss_6_4:[ {on:'hit',if:{casting:SHOT,targetTeam:'enemy'},do:[{mark:'rfSmk',on:'target',dur:R(1),longest:true}]} ],         // Gun Smoke
    ss_7_1:[ {on:'out',if:{targetTeam:'enemy',fn:'xd'},ignoreArmor:R(0.03)} ],                                               // Crossed Blades
    ss_7_2:[],                                                                                                               // Vanishing Act (tk)
    ss_7_3:[ {stat:{atk:R(0.02)},if:{window:'rfSc'}} ],                                                                      // Slippery Corsair (evMe)
    ss_8_1:[],                                                                                                               // Never Same Twice (critP)
    ss_8_2:[],                                                                                                               // Lingering Smoke (smkMe, smkAl)
    ss_9_1:[ {on:'rfXd',do:[{cd:'blue',add:R(-0.1)}]} ],                                                                     // Feint and Fire
    ss_9_3:[ {on:'out',if:{casting:DMF,targetTeam:'enemy'},more:R(0.03)} ],                                                  // Blaze of Fortune
    ss_10_1:[ {on:'partPre',skill:SHOT,do:[{roll:'rfPs',add:1,span:4}]}, {on:'partPre',skill:BUL,do:[{roll:'rfPs',add:1,span:4}]},
              {on:'out',if:{casting:CUT,targetTeam:'enemy'},more:R(0.01),per:{roll:'rfPs',step:1,max:3}} ],                   // Pistol Whip
    ss_10_2:[],                                                                                                              // Smoke Lungs (drK, allyK)
    ss_10_4:[],                                                                                                              // Hardened (drK)
    ss_9_4:[],                                                                                                               // Duel Ready (grCast)
    ss_11_2:[ {on:'cd',skill:'green',add:R(-0.15)} ],                                                                        // Cannon Smoke
    ss_11_3:[ {on:'in',once:'wave',if:{dropBelow:0.25},do:[{miss:true},{fn:'ghost'}]} ],                                     // Ghost Ship
    ss_11_4:[ {on:'out',if:{targetTeam:'enemy',crit:true,fn:'xd'},critMore:R(0.02)} ],                                       // Salt in the Wound (at most 10%)
    ss_12_1:[ {on:'rfXd',do:[{fn:'ambi'}]} ],                                                                                // Ambidextrous (the regeneration budget)
    ss_12_2:[],                                                                                                              // Smoke Thief (smkMe, smkAl)
    ss_12_4:[ {stat:{mr:R(0.05)},if:{fn:'evaOn'}} ],                                                                         // Weathered Coat
    ss_13_3:[]                                                                                                               // Room Full of Smoke (SIGNATURE; evMe)
  },
  ruling:{},
  partial:{},
  fn:{
    /* ---------------- each tick: his countdowns, the regeneration budget, Tell, Vanishing Act, Parting Shot ---------------- */
    tk(A,T,u,c){ const E=A.eng(), r=T.r, o=S(T), dt=c.dt||0;
      for(const k in o.cd) if(o.cd[k]>0) o.cd[k]=Math.max(0,o.cd[k]-dt); if(o.bh>0) o.bh=Math.max(0,o.bh-dt);
      if(r.ss_1_4||r.ss_12_1){ const cap=u.maxHp*REGEN; o.bud=Math.min(cap,(o.bud==null?cap:o.bud)+cap*dt); }
      /* Every Man Has a Tell: the enemy he is attacking drops past 75%, 50% or 25% HP: 20% per rank, his count moves on by 1 */
      if(r.fs_n1){ const t=u.target; if(t&&t.alive&&foe(u,t)&&t.maxHp>0){ const f=t.hp/t.maxHp, n=(f<0.75?1:0)+(f<0.50?1:0)+(f<0.25?1:0), p=o.tl[t.uid];
          if(p==null) o.tl[t.uid]=n; else if(n>p){ o.tl[t.uid]=n; for(let i=p;i<n;i++) if(E.rnd()<0.2*r.fs_n1) advance(T,u,1); } } }
      /* Vanishing Act: while Dead Man's Fortune's evasion lasts, every enemy within 3 m of him is Smoked */
      if(r.ss_7_2&&eva(u)) for(const e of A.pick(T,u,{team:'enemy',within:3},{u})) A.setMark(T,u,e,'rfSmk',{dur:0.25,longest:true});
      /* Parting Shot: an enemy that leaves his cutlass reach is marked for his next pistol shot (at most once every 3 s) */
      if(r.ss_n2){ const R2=thr(A,T); for(const e of A.pick(T,u,{team:'enemy'},{u})){ const inR=E.dist(u,e)<=R2, was=o.pr[e.uid];
          if(was&&!inR&&!(o.cd.part>0)){ A.setMark(T,u,e,'rfPart',{dur:6}); o.cd.part=3; } o.pr[e.uid]=inR; } } },
    /* ---------------- his swings ---------------- */
    swPre(A,T,u,c){ const o=S(T), w=c.skill===CUT?'c':'p', forced=o.duel>0||A.winOn(T,'rfRoom');
      o.cp=o.lw==='c'&&w==='p'; o.xd=forced||(o.lw!=null&&o.lw!==w); o.w=w; o.sw=true; },
    swPost(A,T,u,c){ const o=S(T), r=T.r;
      if(o.xd) A.run(T,u,'rfXd',{u,src:u,tgt:c.tgt});
      if(o.cp&&r.ss_3_1&&!(o.bh>0)&&u.pass&&u.pass.instinct&&c.tgt&&c.tgt.alive&&foe(u,c.tgt)){ o.bh=4; strike(A,T,u,c.tgt,atkNow(u)*A.eng().rage()*instPct(u),INST,'true'); }   // Both Hands
      o.lw=o.w; if(o.duel>0) o.duel--; o.xd=false; o.cp=false; o.sw=false; },
    xd(A,T,u){ const o=S(T); return !!(o.sw&&o.xd&&(T.s.cur===CUT||T.s.cur===SHOT)); },
    cutNow(A,T,u){ const t=u.target; return !!(t&&t.alive&&foe(u,t)&&A.eng().dist(u,t)<=thr(A,T)); },
    ambi(A,T,u){ if(T.r.ss_12_1) regen(A,T,u,u.maxHp*0.005*T.r.ss_12_1); },
    kydOn(A,T){ S(T).kyd=true; }, kydReady(A,T){ return S(T).kyd; }, kydOff(A,T){ const o=S(T); o.kyd=false; o.kydShot=true; },
    kydShot(A,T){ const o=S(T), k=o.kydShot; o.kydShot=false; return k; },
    sbOn(A,T){ S(T).sb=true; }, sbReady(A,T){ return S(T).sb; }, sbOff(A,T){ S(T).sb=false; },
    biteOn(A,T){ S(T).bite=true; }, biteReady(A,T){ return S(T).bite; }, biteOff(A,T){ S(T).bite=false; },
    /* ---------------- Pirate's Instinct ---------------- */
    third(A,T,u){ if((u._piN||0)>=2) u._piN=3; },                                                    // Third Is Yours: the third swing fires it
    countLoud(A,T,u){ advance(T,u,T.r.fs_2_1||0); },
    instHit(A,T,u,c){ const r=T.r, o=S(T), t=c.tgt; if(!t) return;
      /* Four Is Honest (SIGNATURE): once every 18 s, the shot on an enemy already Holed goes through the line behind it, then he draws 4 Cards */
      if(r.fs_13_4&&!(o.cd.fih>0)){ const h=holes(A,T,u,t); if(h>=1){ o.cd.fih=18; const x=(c.amt||0)*(h>=3?1:0.5), cap=2*(u.dmg||0);
          for(const e of behind(A,T,u,t)){ lastHit(A,T,e); A.hurt(T,u,e,Math.min(x,cap),COL,'fih'); if(e.alive) addHole(A,T,u,e,h); }
          A.stSet(T,u,'rfCard',4); } }
      if(any(T,CARD)) A.stSet(T,u,'rfCard',A.stGet(T,'rfCard')+1);
      if(any(T,HOLE)&&t.alive) addHole(A,T,u,t,1); },
    dealt(A,T,u,c){ const t=c.tgt; if(!t) return; const e=behind(A,T,u,t).find(x=>A.gap(t,x)<6*M(A)); if(e){ lastHit(A,T,e); A.hurt(T,u,e,(c.amt||0)*0.5,COL,'dealt'); } },
    fcount(A,T,u,c){ const t=c.tgt; if(u.pass&&u.pass.instinct&&t&&t.alive) strike(A,T,u,t,atkNow(u)*A.eng().rage()*instPct(u),INST,'true'); },
    /* Nothing in the Way: 15% x 3 of the shot goes past the target's shield (taken off now, dealt to its HP after the hit) */
    pierceOut(A,T,u,c){ const o=S(T), t=c.tgt; o.pin=null; if(!t||!((t.shield||0)>0)||!(c.amt>0)) return; const x=c.amt*Math.min(1,0.15*T.r.fs_12_4); c.amt-=x; o.pin=[t,x]; },
    pierceHit(A,T,u,c){ const o=S(T), p=o.pin; o.pin=null; if(!p||p[0]!==c.tgt||!p[0].alive) return; const t=p[0], sh=t.shield||0; t.shield=0; try{ A.eng().damage(t,p[1],COL,true); } finally{ if(t.alive) t.shield=sh; }
      if(!t.alive&&T.on.kill) A.run(T,u,'kill',{u,src:u,tgt:t,amt:p[1],proc:true}); },
    /* ---------------- Pistol Barrage ---------------- */
    volKit(A,T,u){ const o=S(T); o.vol={sp:false}; if(A.stGet(T,'rfCard')>=4){ A.stSet(T,u,'rfCard',0); o.vol.sp=true; if(T.on.rfSpend) A.run(T,u,'rfSpend',{u,tgt:u,spent:4}); } },
    volSp(A,T){ return !!S(T).vol.sp; },
    cardDmg(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; lastHit(A,T,t); A.hurt(T,u,t,(c.amt||0)*0.05*(T.r.fs_1_1||0),COL,'card'); },
    boh(A,T,u,c){ const t=c.tgt; if(t&&t.alive&&holes(A,T,u,t)>=1) addHole(A,T,u,t,1); },
    /* Spare Pistol: a fifth bullet, at the fifth-nearest enemy (the nearest when fewer stand), a real bullet of the Barrage */
    spare(A,T,u,c){ const E=A.eng(), es=A.pick(T,u,{team:'enemy',n:5,centre:true},{u}).filter(e=>e.alive); if(!es.length) return; const t=es.length>=5?es[4]:es[0];
      const amt=(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*(u._castSM||1)*((c.o&&c.o.mul)||0.85)*E.rage(); strike(A,T,u,t,amt,BUL); },
    /* ---------------- Grappling Hook and At the Table ---------------- */
    farthest(A,T,u,c){ const E=A.eng(), R0=Math.max(u.range||0,28*M(A)); let best=null, bd=-1;
      for(const e of A.pick(T,u,{team:'enemy'},{u})){ const d=E.dist(u,e); if(d<=R0+E.bodyR(u)+E.bodyR(e)&&d>bd){ bd=d; best=e; } } if(best) c.tgt=best; },
    /* before the hook resolves: who it is thrown at (and where it stands: Whole Table measures from there, before the pull), whether it already sits At the
       Table, and the seconds his talents add to its stun (Hear What You Owe, Tight Knots, The Last Chair's hold). They are added once the stun has landed
       (grStun / grCast), in full, past the game's 2.8 s ceiling on a stun, never past 4.0 s in all (WIRING/00, "Control durations from talents") */
    grKit(A,T,u,c){ const r=T.r, o=S(T), t=c.tgt; o.gr={t,x:t?t.x:0,y:t?t.y:0,tab:!!(t&&A.markOf(u,t,'rfTab')),lc:false,add:0,hit:0};
      if(r.co_3_1&&o.gr.tab) o.gr.add+=0.8;                                                                  // Hear What You Owe
      if(r.co_11_4) o.gr.add+=0.06*r.co_11_4;                                                                // Tight Knots
      if(r.co_13_1&&!(o.cd.lc>0)){ o.gr.add+=2; o.gr.lc=true; } },                                           // The Last Chair: the hold
    grStun(A,T,u,c){ const g=S(T).gr; if(g&&T.s.cur===HOOK&&c.tgt===g.t) g.hit=c.amt||0; },                 // the hook's own stun landed (after the level roll)
    grCast(A,T,u,c){ const r=T.r, o=S(T), E=A.eng(), g=o.gr||{}, t=g.t||c.tgt; o.gr=null; o.ndl=false; if(!t) return;
      if(g.hit>0&&g.add>0&&t.alive){ const d=Math.min(STUN_TOP,Math.max(g.hit,A.stunRoom(t)),g.hit+g.add*(1-(t.ctrlRes||0)));   /* v1452: inside the 4.0 s run */ if(d>(t.stunned||0)) t.stunned=d;
        if(T.on.ccHit&&(r.ss_3_2||r.co_3_1||r.co_11_4||r.co_13_1)) A.setMark(T,u,t,'rfLk',{dur:t.stunned+0.5,longest:true}); }
      if(r.ss_9_4) o.duel=2;                                                                                 // Duel Ready
      if(r.co_7_1&&t.alive&&!t.immovable&&!(t.pass&&(t.pass.unstepped||t.pass.unstoppable))&&!((t._gearImmovableT||0)>0)){   // Last Chair Pulled: all the way back to him
        const dx=t.x-u.x, dy=t.y-u.y, L=Math.hypot(dx,dy)||1, gp=E.bodyR(u)+E.bodyR(t)+0.2*M(A); if(L>gp){ t.x=u.x+dx/L*gp; t.y=u.y+dy/L*gp; t._ax=t.x; t._ay=t.y; } }
      if(any(T,TABLE)&&t.alive){ const d=(4+(T.P['rf.tab']||0))+((r.ss_n1&&r.co_1_1&&A.markOf(u,t,'rfSmk'))?1:0), L=[t];
        if(r.co_9_1) for(const e of A.pick(T,u,{team:'enemy'},{u})) if(e!==t&&Math.hypot(e.x-g.x,e.y-g.y)-E.bodyR(t)-E.bodyR(e)<2*M(A)) L.push(e);   // Whole Table: within 2 m of where it was caught
        for(const x of L){ A.setMark(T,u,x,'rfTab',{dur:d}); o.fw[x.uid]=true; } }
      if(g.lc&&g.hit>0&&t.alive&&(t.stunned||0)>0){ A.setMark(T,u,t,'rfHeld',{dur:t.stunned}); o.cd.lc=25; o.lcN=0; } },
    swordArg(A,T,u,c){ const t=c.tgt; if(t&&t.alive) A.setMark(T,u,t,'rfTab',{dur:4+(T.P['rf.tab']||0)}); },
    anyTab(A,T,u){ return A.pick(T,u,{team:'enemy',has:'rfTab'},{u}).length>0; },
    fwOn(A,T,u,c){ return !!(c.tgt&&S(T).fw[c.tgt.uid]&&A.markOf(u,c.tgt,'rfTab')); },
    fwOff(A,T,u,c){ if(c.tgt) delete S(T).fw[c.tgt.uid]; },
    ndlReady(A,T){ return S(T).ndl; },
    heldCoin(A,T,u){ const o=S(T); if(o.lcN<2){ o.lcN++; A.stSet(T,u,'rfCoin',A.stGet(T,'rfCoin')+1); } },
    /* ---------------- deaths: Coins, Run Them Down, Collector's Patience, The Last Chair, Hole Passed On ---------------- */
    lastHit(A,T,u,c){ lastHit(A,T,c.tgt); },
    died(A,T,u,c){ const r=T.r, o=S(T), E=A.eng(), x=c.unit; if(!x) return; const tab=!!A.markOf(u,x,'rfTab'), lh=o.lh[x.uid];
      if(any(T,COIN)&&(tab||(lh!=null&&E.now()-lh<=4+1e-9))) A.stSet(T,u,'rfCoin',A.stGet(T,'rfCoin')+((tab&&r.co_3_3)?2:1));   // Collecting, Count It Twice
      if(tab&&r.co_5_3){ u.blueCd=0; o.ndl=!!r.co_6_3; }                                                     // Run Them Down (No Door Left)
      if(tab&&r.co_11_1&&u.alive) E.healUnit(u,u.maxHp*0.02*r.co_11_1);                                       // Collector's Patience
      if(r.co_13_1&&A.markOf(u,x,'rfHeld')) A.stSet(T,u,'rfCoin',7);                                         // The Last Chair: dead before the stun ended
      if(r.fs_8_4){ const h=holes(A,T,u,x); if(h>0){ const n=A.pick(T,u,{team:'enemy',of:'unit',n:1,skip:'unit'},{u,unit:x})[0]; if(n) addHole(A,T,u,n,Math.min(h,r.fs_8_4)); } } },   // Hole Passed On
    kl(A,T,u,c){ const o=S(T), t=c.tgt; if(!t||o.kl[t.uid]) return; o.kl[t.uid]=1; A.stSet(T,u,'rfKill',A.stGet(T,'rfKill')+1); },
    /* ---------------- Smoke and his evades ---------------- */
    smkMe(A,T,u,c){ const r=T.r, s=c.src; if(r.ss_1_4) regen(A,T,u,u.maxHp*0.004*r.ss_1_4); T.fn.smkAl(A,T,u,c);
      if(r.ss_3_2&&s&&s.alive&&!((s.stunned||0)>0)&&!A.markOf(u,s,'rfLk')&&A.ustGet(T,u,s,'rfChk')<2){                // Choking (the stun-lock rule)
        A.ustPut(T,u,s,'rfChk',A.ustGet(T,u,s,'rfChk')+1); A.control(T,u,s,'stunned',0.3); } },
    smkAl(A,T,u,c){ const r=T.r, s=c.src;
      if(r.ss_8_2&&s){ const m=A.markOf(u,s,'rfSmk'); if(m&&m.until!=null) m.until+=0.2*r.ss_8_2; }                    // Lingering Smoke
      if(r.ss_12_2) u.energy=Math.min(100,(u.energy||0)+r.ss_12_2); },                                       // Smoke Thief
    stunLock(A,T,u,c){ if(c.tgt&&foe(u,c.tgt)) A.setMark(T,u,c.tgt,'rfLk',{dur:(c.amt||0)+0.5,longest:true}); },
    evaOn(A,T,u){ return eva(u); },
    evMe(A,T,u,c){ const r=T.r, o=S(T);
      if(r.ss_1_4) regen(A,T,u,u.maxHp*0.004*r.ss_1_4);                                                       // Sea Dog
      if(!eva(u)) return;
      if(r.ss_7_3) A.acts(T,u,[{window:'rfSc',dur:4}],c);                                                     // Slippery Corsair
      if(r.ss_13_3&&!(o.cd.room>0)){ o.cd.room=25;                                                            // Room Full of Smoke (SIGNATURE)
        for(const e of A.pick(T,u,{team:'enemy'},{u})) A.setMark(T,u,e,'rfSmk',{dur:5,longest:true});
        u._miragT=Math.max(u._miragT||0,5); A.acts(T,u,[{window:'rfRoom',dur:5}],c); } },
    /* Ghost Ship: the hit is evaded, and Dead Man's Fortune's evasion (50%, Lucky Coat more) for 2 s */
    ghost(A,T,u,c){ if(!eva(u)){ const e=0.5+0.02*(T.r.ss_4_3||0), add=Math.max(0,Math.min(e,EVA_TOP-(u.evaStat||0))); u.evaStat=(u.evaStat||0)+add; u._miragEva=(u._miragEva||0)+add; }
      u._miragT=Math.max(u._miragT||0,2); T.fn.evMe(A,T,u,c); },
    /* ---------------- the caps ---------------- */
    critP(A,T,u,c){ const r=T.r; let x=0.01*(r.fs_1_2||0)+0.005*(r.fs_4_1||0)*A.stGet(T,'rfCard')+0.003*(r.co_2_3||0)*A.stGet(T,'rfCoin')+0.004*(r.ss_6_1||0)*A.stGet(T,'rfRhy');
      if(r.ss_8_1&&T.fn.xd(A,T,u,c)) x+=0.04*r.ss_8_1; return Math.min(CRIT_CAP,x); },
    drIn(A,T,u,c){ if(!foe(u,c.src)) return; c.amt*=drK(A,T,u,c.src,c.auto); },
    drDot(A,T,u,c){ const s=c.src||(c.dot&&c.dot.src); if(s&&!foe(u,s)) return; c.amt*=drK(A,T,u,s,false); },
    drAl(A,T,u,c){ c.amt*=allyK(A,T,u,c.src||(c.dot&&c.dot.src)); },
    drMe(A,T,u,s,auto){ return drK(A,T,u,s,auto); },                                                         // (the 95% checks read the group without a hit)
    reach(A,T,u,c,a){ u.range=(u.range||0)+(a.m||0)*M(A); }
  }
};
