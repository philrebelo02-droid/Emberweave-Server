/* QUORREL - what his learned talents do in a fight (the mechanics; his 11 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Quorrel": what he added)
   His real kit (the code, not the card wording; damage profile Attack, every hit of his is physical; a melee Bruiser of the front row; tests/quorrel-kit-facts.js):
   - Gag Order ('aoeStun', green, cd 10, delivered as a form): every enemy whose CENTRE is within 2.6 m of his target's centre takes 100% of his attack x skill
     level, is STUNNED (the kit's 1.2 is replaced by the area table 2.0 s x 0.7 = 1.4 s) and SILENCED (2.5 -> 1.5 x 0.7 = 1.05 s, and its cast is cut). It reached
     1 or 2 enemies a cast in 20 seeded fights (gap between enemies: 1.5 m median); when its target is gone before the form lands it is centred on Quorrel and
     reaches nobody (8 of 85). Inside the skill: casting 'aoeStun'.
   - Contempt ('stun', blue, cd 8): his target takes 150% of his attack x skill level and is stunned (1.3 -> the single table 3.5 s x 0.7 = 2.45 s). Inside
     the skill: casting 'stun'. A stun (any) cancels a cast under way (the game's castTick): 13 of 100 Contempts struck an enemy in a Green / Blue cast.
   - Contempt Storm (the ultimate 'volley', energy, no cooldown): the nearest 6 enemies each get one writ (140% of his attack x skill level) that lands 0.30 s
     after the cast, all together; with fewer enemies the other writs go nowhere. Its writs land through the page's own line in the volley case, where a guarded
     landPre / land pair (his page site) makes them 'volley' hits.
   - Tireless (passive 'fury'): his swing timer is divided by 1 + 0.25 x his passive's strength (54.7% at level 100). It is written once when he is built;
     u.passMul is set only when he has it (rank 3+).
   Precedent, Cut Short, Gavels, Sentenced, Days and Testimony exist only through his talents. His own per-fight object is T.s.q; his state names start with q.
   NO absolute fight time is kept anywhere here (the battle clock restarts at 0 each wave): every timer counts down by the tick's dt.
   Readings, caps and corrected tooltips: WIRING/48 - QUORREL - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const GO='aoeStun', CT='stun', CS='volley';
const DR_CAP=0.25, CRIT_CAP=0.05, SLOW_CAP=0.40, TEN_CAP=0.50, REGEN=0.012, BANK=5, STUN_TOP=4.0, RUN_TOP=4.0, LOCK=0.5, SIG_CD=25, CT_FLOOR=4, GO_FLOOR=5, DAY_EVERY=10, GV_MAX=6, SIG1_MIN=2;
/* which talents read each family: its bookkeeping rows are attached only when one of them is learned */
const DRG=['oc_3_1','oc_10_2','sg_8_3','ed_6_1','ed_5_1','ed_11_4'];                      // his damage reduction: ONE capped group
const CRIT=['sg_5_4','ed_7_3','oc_6_4','sg_9_1','ed_4_2'];                                  // his critical-chance talents: ONE capped group (5%)
const SLOW=['oc_11_1','sg_12_1','ed_1_4'];                                                  // slows on him weaker: ONE capped group (40%)
const TEN=['ed_4_1','ed_9_2','ed_13_2'];                                                    // controls on him shorter (and the signature's immunity)
const TIR=['oc_9_2','sg_7_3','ed_3_4','ed_3_1','ed_13_2'];                                  // Tireless made stronger
const CDS=['oc_6_3','sg_11_3','ed_8_3','oc_7_1','sg_4_3','ed_11_1'];                        // cooldowns (with their floors)
const HEAL=['sg_10_1','ed_8_1'];                                                            // healing each second: one budget (the regeneration cap)
const TS=['ed_1_2','ed_2_2','ed_n1','ed_4_2','ed_5_1','ed_5_2','ed_5_3','ed_6_2','ed_6_3','ed_7_1','ed_10_2','ed_11_2','ed_12_2','ed_12_4','ed_13_2'];   // Testimony
const DAYS=['ed_1_1','ed_2_1','ed_3_1','ed_7_3','ed_7_4','ed_10_1','ed_11_1'];             // Days
/* ---- small readers that need no API (the 95% instrument calls drK from a test with the API kept on T.s) ---- */
const rk=(T,id)=>T.r[id]||0;
const Q=T=>T.s.q||(T.s.q={e:{},bud:0,s1:0,s2:0,s3:0,cw:0,wh:0,wt:0,dc:0,dk:0,otr:0,wwN:0,wwT:0,bcE:99,gcE:99,cid:0,goN:0,ctT:null,ctHit:0,ctSt:0,csX:0,csXd:1,csA:0,tsrc:null,s2due:0,ua:0,lkN:0,runMax:0,ts:{n:0,lkOk:0,onStun:0}});
const rec=(T,t)=>{ const e=Q(T).e; let r=e[t.uid]; if(!r||r.u!==t){ r=e[t.uid]={u:t,st:0,re:0,lk:0,cap:0,bp:0,gv:0,sn:0,ts:0,tt:0,ow:0,hc:0,arm:0}; } return r; };
const recOf=(T,t)=>{ const r=t&&Q(T).e[t.uid]; return (r&&r.u===t)?r:null; };
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const tsMax=T=>5+(T.P['ts.max']||0);
const tsOf=(T,t)=>{ const r=recOf(T,t); return (r&&r.tt>0)?r.ts:0; };
const gvOn=(T,t)=>{ const r=recOf(T,t); return !!(r&&r.gv>0&&t.alive); };
const snOn=(T,t)=>{ const r=recOf(T,t); return !!(r&&r.sn>0&&t.alive); };
const gvCount=T=>{ const e=Q(T).e; let n=0; for(const k in e){ const r=e[k]; if(r.gv>0&&r.u.alive) n++; } return n; };
module.exports={
  hero:'quorrel',
  casting:true,                         // rows ask which of his skills a hit or a stun comes from (Gag Order, Contempt, Contempt Storm's writs)
  states:{
    qPre:{max:P('pre.max',5)},                                                 // Precedent (for the fight; Long Record: up to 10)
    qDay:{max:11}                                                              // Days (for the fight)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share, and his capped groups */
  always:[
    {on:'wave',do:[{fn:'waveStart'}]},                                                                                          // a new wave: his records of the last wave's enemies dropped; Days; the line-up read
    {on:'tick',do:[{fn:'tk'}]},                                                                                                  // every timer of his counts down here (never an absolute fight time)
    {on:'ccOut',if:{cc:['stunned']},do:[{fn:'stPrev'}]},                                                                         // (what the enemy's stun was just before one of his lands)
    {on:'ccHit',if:{cc:['stunned']},do:[{fn:'stunHit'}]},                                                                        // every stun of his that lands (his skills' and his talents'): one function
    {on:'kit',skill:GO,do:[{fn:'goKit'}]}, {on:'cast',skill:GO,do:[{fn:'goCast'}]},                                             // Gag Order: count its stuns; then the signature
    {on:'kit',skill:CT,do:[{fn:'ctKit'}]}, {on:'hit',if:{casting:CT,targetTeam:'enemy'},do:[{fn:'ctHitRec'}]}, {on:'cast',skill:CT,do:[{fn:'ctCast'}]},   // Contempt: its target, hit and stun
    {on:'cast',skill:CS,do:[{fn:'csCast'}]},                                                                                     // Contempt Storm: how many writs found no target
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                                       // his damage-reduction talents: ONE capped group (myDr)
    {on:'crit',reqAny:CRIT,if:{targetTeam:'enemy'},do:[{fn:'crit'}]},                                                           // his critical-chance talents: ONE capped group (5%)
    {stat:{crit:1},reqAny:CRIT,per:{fn:'critS'}},                                                                               //   (the part that holds on every hit is a stat)
    {on:'tick',reqAny:SLOW,do:[{fn:'slowW'}]},                                                                                   // slows on him weaker (40% at most)
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                                      // controls on him shorter (50% at most); the signature's immunity
    {stat:{aspd:1},reqAny:TIR,per:{fn:'tirX'}},                                                                                  // Tireless made stronger (one stat)
    {on:'cd',reqAny:CDS.concat(['oc_11_4','oc_13_3']),do:[{fn:'cdSet'}]},                                                                                     // his cooldown talents, with their floors
    {on:'hurt',reqAny:TS,if:{srcTeam:'enemy'},do:[{fn:'tsHurt'}]},                                                               // Testimony: each enemy that hits him
    {on:'hit',reqAny:['ed_n1','ed_13_2'],if:{targetTeam:'enemy'},do:[{fn:'tsHit'}]}                                              // Struck Into the Record's hit; Waiting to Hear It fills Testimony
  ],
  talents:{
    /* ============================== ORDER IN THE COURT ============================== */
    oc_5_1:[ {stat:{move:R(0.03)}} ],                                                                             // Brisk Step
    oc_1_3:[ {param:'ext.pre',add:R(0.02)} ],                                                                     // Precedent (gained in stunHit; its time in ext)
    oc_1_4:[ {param:'cs.cd',add:R(0.3)} ],                                                                        // Let Me Stop You: Cut Short (cutShort)
    oc_2_3:[ {stat:{atk:R(0.005)},per:'qPre'} ],                                                                  // Case Law
    oc_2_4:[ {param:'cs.atk',add:R(0.15)} ],                                                                      // Mid-Sentence (cutShort)
    oc_3_1:[ {param:'dr.bench',add:R(0.02)} ],                                                                    // Bench Posture (in drK)
    oc_3_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                    // Court Seal
    oc_4_3:[ {on:'kit',skill:GO,opt:{radius:{addM:R(0.2)}}} ],                                                    // Wider Seal
    oc_3_4:[ {param:'nf',add:1} ],                                                                                // Not Finished (stunHit)
    oc_4_2:[ {on:'out',if:{casting:GO},more:R(0.05)} ],                                                           // Firm Hand
    oc_5_2:[ {on:'hit',if:{casting:GO,targetTeam:'enemy'},do:[{push:'target',m:2,secs:0.3}]} ],                   // Clear the Gallery (PICK ONE)
    oc_5_3:[ {param:'ext.go',add:0.4} ],                                                                          // Silence in Court (PICK ONE; ext)
    oc_5_4:[ {stat:{mr:R(0.02)},if:{fn:'anyHeld'}} ],                                                             // Chitin Robes
    oc_6_2:[ {on:'hit',if:{casting:GO,targetTeam:'enemy',fn:'movable'},do:[{slow:R(0.06),dur:2,on:'target'}]} ], // Removed
    oc_6_3:[ {param:'cd.go',add:R(0.2)} ],                                                                        // Quick Seal (cdSet)
    oc_7_1:[ {param:'cd.ct',add:R(0.15)} ],                                                                       // Swift Ruling (cdSet)
    oc_7_2:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                            // Writs
    oc_8_4:[ {on:'out',if:{fn:'tgtStunned'},critMore:R(0.02)} ],                                                  // Procedure
    oc_8_3:[ {param:'ext.all',add:R(0.04)} ],                                                                     // Standing Order (ext)
    oc_7_4:[ {param:'ct2',add:1} ],                                                                               // Contempt Twice (ctCast)
    oc_9_1:[ {on:'out',if:{fn:'tgtStunned'},more:R(0.02)} ],                                                      // Strike From the Record
    oc_9_2:[ {param:'tir.pts',add:R(0.01)} ],                                                                     // Six Hands (tirX)
    oc_10_3:[ {on:'out',if:{casting:CT},more:R(0.05)} ],                                                          // Gavel Down
    oc_10_2:[ {param:'dr.calm',add:R(0.01)} ],                                                                    // Chamber Calm (in drK)
    oc_9_3:[ {param:'hic',add:1} ],                                                                               // Held in Contempt (stunHit, tk)
    oc_10_4:[ {param:'cs.ovr',add:R(0.01)}, {stat:{atk:R(-0.01)},to:{team:'enemy',fn:'ovrOn'}} ],                // Overruled (4 s from cutShort)
    oc_11_1:[ {param:'sw.uv',add:R(0.04)} ],                                                                      // Unhurried Voice (slowW)
    oc_12_1:[ {on:'hit',if:{casting:CS,targetTeam:'enemy'},do:[{slow:R(0.10),dur:2,on:'target'}]} ],             // Final Word
    oc_6_4:[ {param:'cr.lh',add:R(0.03)} ],                                                                       // Long Hearing (crit group)
    oc_11_3:[ {param:'pre.max',add:R(1)} ],                                                                       // Long Record
    oc_11_4:[ {param:'sus',add:1} ],                                                                              // Sustained (stunHit)
    oc_12_2:[ {on:'cast',skill:GO,do:[{window:'qSA',dur:4}]}, {stat:{aspd:R(0.03)},if:{window:'qSA'}} ],         // Steady Arms
    oc_12_3:[ {on:'out',if:{casting:GO,stackFull:'qPre'},more:R(0.04)} ],                                         // Bound by Precedent
    oc_n1:[ {param:'ext.dk',add:R(0.05)} ],                                                                       // Know the Docket (ext; the line-up read at each wave)
    oc_13_3:[ {param:'sig1',add:1} ],                                                                             // The Court Is in Session (SIGNATURE: goCast)
    /* ============================== SIX GAVELS ============================== */
    sg_1_1:[ {param:'gv',add:1}, {on:'out',if:{auto:true,fn:'tgtGv'},more:R(0.03)} ],                             // All Six: the Gavel (addGavel from every stun of his)
    sg_2_3:[ {stat:{move:R(0.03)}} ],                                                                             // Bustling
    sg_1_4:[ {on:'hit',if:{casting:CS,targetTeam:'enemy'},do:[{fn:'sentence'}]}, {on:'out',if:{auto:true,fn:'tgtSn'},more:R(0.03)} ],   // Sentence Passed
    sg_2_1:[ {param:'gv.dur',add:R(1)} ],                                                                         // Laid Down
    sg_2_2:[ {on:'out',if:{casting:CS},more:R(0.03)} ],                                                           // Storm of Paper
    sg_3_1:[ {on:'out',if:{casting:CT,fn:'tgtGv'},more:0.40}, {on:'hit',if:{casting:CT,targetTeam:'enemy'},do:[{fn:'gvSpendT'}]} ],   // Down Comes the Gavel
    sg_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                    // Through the Shell
    sg_3_4:[ {param:'sn.dur',add:R(0.6)} ],                                                                       // Full Sentence
    sg_5_1:[ {stat:{armor:R(0.02)},if:{fn:'gv3'}} ],                                                              // Court Chitin
    sg_4_2:[ {on:'kit',skill:CS,opt:{n:{add:R(1)}}} ],                                                            // More Paper
    sg_4_3:[ {param:'cd.ct',add:R(0.3)} ],                                                                        // Ruling Hand (cdSet)
    sg_6_1:[ {stat:{move:R(-0.04)},to:{team:'enemy',fn:'gvHolder'}} ],                                            // Weighty Gavel
    sg_6_4:[ {on:'out',if:{casting:GO},more:R(0.05)} ],                                                           // Minor Offence
    sg_7_1:[ {stat:{atk:R(0.004)},per:{fn:'gvN'}} ],                                                              // Gavel to the Head
    sg_7_3:[ {param:'tir.pts',add:R(0.01)} ],                                                                     // Tireless Arms (tirX)
    sg_8_3:[ {param:'dr.ink',add:R(0.01)} ],                                                                      // Ink-Stained (in drK)
    sg_5_4:[ {param:'cr.ham',add:R(0.01)} ],                                                                      // Hammered (crit group)
    sg_9_3:[ {on:'out',if:{fn:'tgtStunned'},more:R(0.02)} ],                                                      // Verdict
    sg_8_2:[ {on:'hit',if:{casting:CS,targetTeam:'enemy'},do:[{fn:'ww'}]}, {stat:{aspd:R(0.01)},per:{fn:'wwN'}} ],   // Writ Weight
    sg_5_2:[ {on:'hit',if:{casting:CS,targetTeam:'enemy'},do:[{fn:'aao'}]} ],                                     // All at Once (PICK ONE)
    sg_5_3:[ {param:'obo',add:1}, {on:'hit',if:{casting:CS,targetTeam:'enemy'},do:[{fn:'oboRec'}]}, {on:'land',skill:CS,do:[{fn:'obo'}]} ],   // One by One (PICK ONE)
    sg_7_4:[ {on:'out',if:{fn:'snLow'},more:R(0.05)} ],                                                           // Sentence Carried Out
    sg_9_1:[ {param:'cr.hd',add:R(0.02)} ],                                                                       // Heavy Docket (crit group)
    sg_12_1:[ {param:'sw.rc',add:R(0.08)} ],                                                                      // Rules of Court (slowW)
    sg_6_3:[ {param:'obo.more',add:R(0.05)} ],                                                                    // No Exceptions (obo)
    sg_9_4:[ {on:'kill',if:{casting:CS,fn:'tgtSnAny'},do:[{fn:'executed'}]} ],                                    // Executed
    sg_10_1:[ {param:'ug',add:R(0.01)} ],                                                                         // Unused Gavel (tk: heal budget)
    sg_10_4:[ {stat:{atk:R(-0.01),apow:R(-0.01)},to:{team:'enemy',fn:'snHolder'}} ],                              // Thorough
    sg_11_1:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                           // Rap of the Gavel
    sg_11_2:[ {on:'hit',if:{casting:GO,targetTeam:'enemy'},do:[{fn:'gvAddT'}]} ],                                 // Order Restored
    sg_11_3:[ {param:'cd.go',add:R(0.2)} ],                                                                       // Quick Rulings (cdSet)
    sg_10_2:[ {on:'out',if:{fn:'late'},more:R(0.015)} ],                                                          // Long Session
    sg_12_2:[ {on:'out',if:{casting:GO},more:R(0.01),per:{fn:'gvN'}} ],                                           // Gavel Rain
    sg_12_4:[ {param:'rkept',add:R(0.02)} ],                                                                      // Record Kept (tk: a Sentenced enemy's death)
    sg_13_2:[ {param:'sig2',add:1} ],                                                                             // Sentence Is Passed (SIGNATURE: addGavel arms it, tk passes it)
    /* ============================== SINCE THE ELEVENTH DAY ============================== */
    ed_1_1:[ {stat:{aspd:R(0.004)},per:'qDay'} ],                                                                 // Eleven Days (Days: waveStart, tk)
    ed_1_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.006),per:{fn:'tsN'}} ],                                   // At Extraordinary Length (Testimony: tsHurt)
    ed_1_4:[ {param:'sw.ns',add:R(0.04)} ],                                                                       // Never Slows (slowW)
    ed_2_1:[ {stat:{hp:R(0.003)},per:'qDay'} ],                                                                   // The Twelfth Day
    ed_2_2:[ {param:'ts.dur',add:R(1)} ],                                                                         // Hear Them Out
    ed_3_1:[ {param:'sis',add:1} ],                                                                               // Still in Session (tirX)
    ed_n1:[ {param:'sir',add:1}, {on:'out',if:{fn:'armed'},more:0.10} ],                                          // Struck Into the Record (LINK; tsHit)
    ed_3_3:[ {stat:{armor:R(0.02)},if:{selfHpAbove:0.5}} ],                                                       // Chitin Plates
    ed_3_4:[ {param:'tir.pts',add:R(0.01)} ],                                                                     // Not Slept (tirX)
    ed_4_1:[ {param:'ten.all',add:R(0.04)} ],                                                                     // Steady Bench (ten)
    ed_4_2:[ {param:'cr.cx',add:R(0.04)} ],                                                                       // Cross-Examine (crit group)
    ed_4_3:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                            // Rapid Rulings
    ed_5_1:[ {param:'dr.robes',add:R(0.015)} ],                                                                   // Old Robes (in drK)
    ed_5_2:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{fn:'interrupt'}]} ],                                // Interrupt (PICK ONE)
    ed_5_3:[ {param:'ts.max',add:5} ],                                                                            // Let Them Speak (PICK ONE)
    ed_5_4:[ {stat:{move:R(0.03)}} ],                                                                             // Quick March
    ed_6_1:[ {param:'dr.nosleep',add:R(0.015)} ],                                                                 // No Sleep (in drK)
    ed_6_2:[ {stat:{aspd:R(0.004)},per:{fn:'tsMine'}} ],                                                          // Restless Hands
    ed_6_3:[ {stat:{move:R(-0.01)},to:{team:'enemy',fn:'tsOver'},per:{fn:'tsOverN'}} ],                           // Long Testimony
    ed_7_1:[ {on:'kit',skill:CT,do:[{fn:'cocKit'}]}, {on:'out',if:{casting:CT},more:0.08,per:{fn:'tsN'}} ],      // Contempt of Court (the target put back in ctCast)
    ed_7_3:[ {param:'cr.day',add:R(0.002)} ],                                                                     // Restless (crit group)
    ed_7_4:[ {param:'unadj',add:R(1)} ],                                                                          // Unadjourned (waveStart)
    ed_8_2:[ {stat:{lifesteal:R(0.01)}} ],                                                                        // Tireless Hands
    ed_8_3:[ {param:'cd.go',add:R(0.4)} ],                                                                        // Recess Denied (cdSet)
    ed_8_1:[ {on:'tick',period:3,if:{fn:'inCombat'},do:[{fn:'wftw'}]} ],                                          // Waiting for the Word (heal budget)
    ed_9_2:[ {param:'ten.nsi',add:1} ],                                                                           // Nobody Said It (ten)
    ed_9_3:[ {on:'out',if:{casting:CS},more:R(0.03)} ],                                                           // Ruling Pace
    ed_10_1:[ {stat:{atk:R(0.003)},per:'qDay'} ],                                                                 // Day Follows Day
    ed_10_2:[ {param:'ts.crit',add:R(1)} ],                                                                       // Hear Every Word (tsHurt)
    ed_11_1:[ {param:'eie',add:1} ],                                                                              // Eleven Is Enough (cdSet)
    ed_11_2:[ {stat:{aspd:R(0.01)},per:{fn:'otrN'}} ],                                                            // On the Record (tk counts the deaths)
    ed_11_4:[ {param:'dr.back',add:R(0.015)} ],                                                                   // Legal Tradition (in drK)
    ed_12_1:[ {stat:{aspd:R(0.04)},if:{selfHpBelow:0.4}} ],                                                       // Insomnia
    ed_12_2:[ {on:'out',if:{fn:'tsFull'},more:R(0.03)} ],                                                         // Closing Arguments
    ed_12_4:[ {on:'out',if:{casting:CS,fn:'tsAny'},more:R(0.08)} ],                                               // Final Session
    ed_13_2:[ {param:'sig3',add:1} ]                                                                              // Waiting to Hear It (SIGNATURE: tsSet arms it)
  },
  fn:{
    /* ---- A NEW WAVE: the records of the last wave's enemies are dropped (they are gone); 1 Day (and Unadjourned's at the fight's first wave); the line-up
       read for Know the Docket; On the Record and Long Session start again. The API kept on T.s for the 95% instrument ---- */
    waveStart(A,T,u){ const q=Q(T); T.s.api=A; q.e={}; q.otr=0; q.wt=0; q.csXd=1;
      if(DAYS.some(id=>T.r[id])){ let d=stN(T,'qDay')+1; if(!q.ua){ q.ua=1; d+=T.P.unadj||0; } A.stSet(T,u,'qDay',d); }
      if(T.P['ext.dk']){ let n=0; for(const x of A.eng().units()) if(x.alive&&x.team!==u.team&&x.t&&!x._summon&&(x.t.role==='Mage'||x.t.role==='Support')) n++; q.dk=Math.min(3,n); } },
    inCombat(A,T,u){ for(const x of A.eng().units()) if(x.alive&&x.team!==u.team) return true; return false; },
    /* ---- EVERY TIMER, ONCE A TICK (countdowns only). His stun on each enemy (st, cut to what the enemy really still has), its run in a row (re), the 0.5 s
       lock after it ends (lk), Held in Contempt's slow at that moment, Bench Posture's 3 s (bp), Overruled (ow), Gavels (gv: one that runs out unspent heals
       through the budget), Sentenced (sn), Testimony (tt); deaths of Sentenced enemies (Record Kept) and of enemies with Testimony (On the Record); the
       signatures' cooldowns and windows; the Day clock; the healing budget; Sentence Is Passed when due ---- */
    tk(A,T,u,c){ const q=Q(T), dt=c.dt||0, E=A.eng(), e=q.e, P=T.P;
      q.bud=Math.min(BANK*REGEN*u.maxHp,(q.bud||0)+REGEN*u.maxHp*dt); q.wt+=dt; q.bcE+=dt; q.gcE+=dt;
      for(const k of ['s1','s2','s3','cw','wh','wwT']) if(q[k]>0) q[k]=Math.max(0,q[k]-dt);
      if(DAYS.some(id=>T.r[id])&&A.eng().units().some(x=>x.alive&&x.team!==u.team)){ q.dc+=dt; if(q.dc>=DAY_EVERY-1e-9){ q.dc-=DAY_EVERY; A.stSet(T,u,'qDay',stN(T,'qDay')+1); } }
      for(const k in e){ const r=e[k], t=r.u;
        if(!t.alive){ if(r.sn>0&&P.rkept) T.fn.heal(A,T,u,P.rkept*u.maxHp,true); if(r.ts>0&&r.tt>0&&T.r.ed_11_2) q.otr=Math.min(5,q.otr+1); delete e[k]; continue; }
        if(r.cap>0) r.cap=Math.max(0,r.cap-dt);
        if(r.st>0){ r.re+=dt; r.st=((t.stunned||0)>0)?Math.min(r.st-dt,t.stunned):0; if(r.st<=1e-9){ if(r.re>=RUN_TOP-0.05) r.cap=LOCK; r.st=0; r.re=0; r.lk=LOCK; if(r.hc){ r.hc=0; A.acts(T,u,[{slow:0.30,dur:2,on:'target'}],{u,tgt:t}); } } }
        else if(r.lk>0) r.lk=Math.max(0,r.lk-dt);
        if(r.bp>0) r.bp-=dt; if(r.ow>0) r.ow-=dt; if(r.sn>0) r.sn-=dt;
        if(r.tt>0){ r.tt-=dt; if(r.tt<=0){ r.tt=0; r.ts=0; } }
        if(r.gv>0){ r.gv-=dt; if(r.gv<=1e-9){ r.gv=0; if(P.ug) T.fn.heal(A,T,u,P.ug*u.maxHp); } } }
      if(q.s2due){ q.s2due=0; T.fn.sentencePassed(A,T,u); } },
    /* healing from his talents each second (Waiting for the Word, Unused Gavel): ONE budget that fills at 1.2% of his max HP a second (the regeneration cap),
       kept at most 5 s; a death heal (Record Kept) is not from the budget */
    heal(A,T,u,x,burst){ const q=Q(T); if(!(x>0)||!u.alive) return; if(!burst){ x=Math.min(x,q.bud); q.bud-=x; } if(x>0) A.eng().healUnit(u,x); },
    wftw(A,T,u){ T.fn.heal(A,T,u,0.003*rk(T,'ed_8_1')*u.maxHp); },
    /* ---- EVERY STUN OF HIS THAT LANDS (ccHit: his skills' through the game's ccApply, his talents' through tstun). Which one: T.s.cur (Gag Order 'aoeStun',
       Contempt 'stun') or the talent that stunned (q.tsrc). Its extensions (ext, 4.0 s at most, and never past 4.0 s of his stuns in a row on that enemy),
       then what each stun does: Cut Short, a Gavel, Precedent, Bench Posture's 3 s, Held in Contempt, Not Finished, Sustained, Gag Order's count ---- */
    ext(A,T,src){ const P=T.P; let x=(P['ext.pre']||0)*stN(T,'qPre')+(P['ext.all']||0)+(P['ext.dk']||0)*(Q(T).dk||0); if(src===GO&&P['ext.go']) x+=P['ext.go']; return x; },
    stPrev(A,T,u,c){ Q(T).prev=(c.tgt&&c.tgt.stunned)||0; },
    stunHit(A,T,u,c){ const t=c.tgt, q=Q(T), P=T.P; if(!t||!t.alive||t.team===u.team||!(c.amt>0)) return; const r=rec(T,t), src=c.talent?q.tsrc:T.s.cur;
      if(!c.talent&&src!==GO&&src!==CT) return;                                                       // only his own skills' and talents' stuns
      const run=r.st>0, x=T.fn.ext(A,T,src), prev=q.prev||0, amt=c.amt||0; q.prev=0;
      /* how long HIS stun is: its own length and its extensions (4.0 s at most), and never more than 4.0 s of his stuns in a row on one enemy; after a run that
         long, 0.5 s free of them. A stun of his that would go past is cut to end at 4.0 s, one inside that break is taken back; a stun on it from someone
         else stays as it is (prev). Only his talents (extensions, faster cooldowns) can reach these limits: his kit alone holds one enemy at most 3.85 s */
      const room=run?Math.max(0,RUN_TOP-r.re):RUN_TOP, L=(r.cap>0)?0:Math.min(STUN_TOP,amt+x,room);
      if(L<amt-1e-9) q.ts.trim=(q.ts.trim||0)+1;
      t.stunned=Math.max(prev,L); if(!(L>1e-9)){ q.ts.cut=(q.ts.cut||0)+1; return; }
      if(!run) r.re=0; r.st=Math.max(r.st,L); if(r.re+r.st>q.runMax) q.runMax=r.re+r.st;
      if(P['dr.bench']) r.bp=Math.max(r.bp,L+3);
      T.fn.cutShort(A,T,u,t); if(P.gv) T.fn.addGavel(A,T,u,t);
      if((!c.talent&&src===GO)||q.cw>0) A.stSet(T,u,'qPre',stN(T,'qPre')+1);
      if(!c.talent&&src===GO){ q.goN++; if(P.sus&&u.blueCd>0) u.blueCd=Math.min(u.blueCd,Math.max(0,u.blueCd-1,CT_FLOOR-q.bcE)); }
      if(!c.talent&&src===CT){ if(P.hic) r.hc=1; if(t===q.ctT) q.ctSt=c.amt||0;
        if(P.nf&&t._pend&&t._pend.spell){ let best=null, bd=1e9; for(const [ab,f] of [[t.greenAb,'greenCd'],[t.blueAb,'blueCd']]) if(ab&&ab.cd>0&&(t[f]||0)>0){ const d=ab.cd-(t[f]||0); if(d>=-1e-9&&d<bd){ bd=d; best=[ab,f]; } } if(best) t[best[1]]=best[0].cd; } } },
    /* Cut Short (Let Me Stop You): the enemy's Green and Blue cooldowns pushed back; Mid-Sentence: its next basic attack later; Overruled: its attack lower for 4 s */
    cutShort(A,T,u,t){ const P=T.P; if(!P['cs.cd']||!t.alive) return; const r=rec(T,t);
      if(t.greenAb) t.greenCd=(t.greenCd||0)+P['cs.cd']; if(t.blueAb) t.blueCd=(t.blueCd||0)+P['cs.cd'];
      if(P['cs.atk']) t.atkCd=(t.atkCd||0)+P['cs.atk']; if(P['cs.ovr']) r.ow=4; },
    /* a talent stun (the stun-lock rule): never on an enemy already stunned, nor within 0.5 s after one of his stuns on it ended. The stated seconds go
       through the engine's control (the enemy's own control resist, no resist roll, no draw), then stunHit lengthens it as for every stun of his */
    tstun(A,T,u,t,secs,src){ const q=Q(T); if(!t||!t.alive||t.team===u.team) return false; q.ts.n++;
      if((t.stunned||0)>0){ q.ts.onStun++; return false; } const r=recOf(T,t); if(r&&(r.lk>0||r.cap>0)){ q.ts.lkOk++; return false; }
      const pv=q.tsrc; q.tsrc=src; try{ A.control(T,u,t,'stunned',secs); } finally{ q.tsrc=pv; } return (t.stunned||0)>0; },
    /* ---- GAVELS: one on each enemy his stun lands on (refreshed), 8 s (Laid Down: longer); 6 on the field at most - a new one pushes out the one with the least
       time left (pushed out is not "run out"). At 6 on the field Sentence Is Passed is armed for the next tick (outside the hit that made it) ---- */
    addGavel(A,T,u,t){ const P=T.P; if(!P.gv||!t||!t.alive||t.team===u.team) return; const q=Q(T), r=rec(T,t), d=8+(P['gv.dur']||0);
      if(!(r.gv>0)){ let n=0, lo=null; for(const k in q.e){ const x=q.e[k]; if(x.gv>0&&x.u.alive){ n++; if(!lo||x.gv<lo.gv) lo=x; } } if(n>=GV_MAX&&lo) lo.gv=0; }
      r.gv=d; if(P.sig2&&q.s2<=0&&gvCount(T)>=GV_MAX) q.s2due=1; },
    gvAddT(A,T,u,c){ T.fn.addGavel(A,T,u,c.tgt); },
    gvSpendT(A,T,u,c){ const r=recOf(T,c.tgt); if(r) r.gv=0; },
    gvN(A,T){ return gvCount(T); }, gv3(A,T){ return gvCount(T)>=3; },
    tgtGv(A,T,u,c){ return gvOn(T,c.tgt); }, gvHolder(A,T,u,c){ return gvOn(T,c.tgt); },
    /* ---- SENTENCED (Sentence Passed): each enemy a writ of Contempt Storm hits, 6 s (Full Sentence: longer) ---- */
    sentence(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; const r=rec(T,t); r.sn=Math.max(r.sn,6+(T.P['sn.dur']||0)); },
    tgtSn(A,T,u,c){ return snOn(T,c.tgt); }, snHolder(A,T,u,c){ return snOn(T,c.tgt); },
    tgtSnAny(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.sn>0); },
    snLow(A,T,u,c){ const t=c.tgt; return !!t&&snOn(T,t)&&t.hp<0.30*t.maxHp; },
    executed(A,T,u,c){ for(const x of A.pick(T,u,{team:'enemy',of:'target',within:3,skip:'target'},c)) T.fn.addGavel(A,T,u,x); },
    /* SENTENCE IS PASSED (SIGNATURE, once every 25 s, at 6 Gavels on the field): every enemy with a Gavel takes a full Contempt hit (his attack x 150% x
       Contempt's skill level, a real hit: its armour, a critical roll) and a 0.5 s stun under the stun-lock rule; then every Gavel is spent (none heals) and
       each of those enemies is Sentenced */
    sentencePassed(A,T,u){ const q=Q(T), E=A.eng(); if(!T.P.sig2||q.s2>0||!u.alive||gvCount(T)<GV_MAX) return; q.s2=SIG_CD;
      const hold=[]; for(const k in q.e){ const r=q.e[k]; if(r.gv>0&&r.u.alive) hold.push(r.u); }
      const lv=(u.skillLv&&u.skillLv[2])||1, amt=(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*E.rage()*1.5*(E.skillMul?E.skillMul(lv):1);
      const pv=T.s.cur; T.s.cur='qSentence'; try{ for(const t of hold) if(t.alive&&E.strike) E.strike(u,t,amt,'#6ea8ff'); } finally{ T.s.cur=pv; }
      for(const t of hold) if(t.alive) T.fn.tstun(A,T,u,t,0.5,'sig2');
      for(const k in q.e) q.e[k].gv=0;
      for(const t of hold) if(t.alive){ const r=rec(T,t); r.sn=Math.max(r.sn,6+(T.P['sn.dur']||0)); } },
    /* ---- GAG ORDER: its stuns counted (kit .. cast); THE COURT IS IN SESSION (SIGNATURE, once every 25 s, when this Gag Order stunned 2 or more enemies): every
       enemy within 6 m is stunned 1 s (the stun-lock rule: not those Gag Order has just stunned) and Cut Short, Contempt is ready at once, and for 5 s every stun
       of his sets a Precedent ---- */
    goKit(A,T){ const q=Q(T); q.goN=0; q.cid++; },
    goCast(A,T,u){ const q=Q(T); if(!T.P.sig1||q.s1>0||q.goN<SIG1_MIN||!u.alive) return; q.s1=SIG_CD; q.cw=5;
      for(const x of A.pick(T,u,{team:'enemy',within:6},{u})){ if(!T.fn.tstun(A,T,u,x,1,'sig1')) T.fn.cutShort(A,T,u,x); }   // Cut Short: by the court's stun, or by the court itself where the stun did not land
      u.blueCd=0; },
    movable(A,T,u,c){ const t=c.tgt; return !!t&&!t.immovable&&!((t._gearImmovableT||0)>0); },
    /* ---- CONTEMPT: Contempt of Court sends it to the enemy with the most Testimony (his own target on a tie) and puts his target back after; its hit and
       stun kept for Contempt Twice: half of that hit to the nearest other enemy within 3 m of it, and the same stun (a talent stun: the stun-lock rule) ---- */
    ctKit(A,T,u,c){ const q=Q(T); q.ctT=null; q.ctHit=0; q.ctSt=0; q.cid++; q.ctPrev=undefined; },
    cocKit(A,T,u,c){ const q=Q(T); let best=null, bn=0; const cur=u.target&&u.target.alive?u.target:null, cn=cur?tsOf(T,cur):0;
      for(const x of A.eng().units()){ if(!x.alive||x.team===u.team||x._dropHidden||x._noTarget) continue; const n=tsOf(T,x); if(n>bn){ bn=n; best=x; } }
      if(best&&bn>cn&&best!==cur){ q.ctPrev=u.target; u.target=best; c.tgt=best; } },
    ctHitRec(A,T,u,c){ const q=Q(T); if(!q.ctT){ q.ctT=c.tgt; q.ctHit=c.amt||0; } },
    ctCast(A,T,u,c){ const q=Q(T), t=q.ctT;
      if(q.ctPrev!==undefined){ if(q.ctPrev&&q.ctPrev.alive) u.target=q.ctPrev; q.ctPrev=undefined; }
      if(!T.P.ct2||!t||!(q.ctHit>0)) return; const o=A.pick(T,u,{team:'enemy',of:'target',within:3,skip:'target',n:1},{u,tgt:t})[0]; if(!o) return;
      A.acts(T,u,[{dmg:0.5*q.ctHit,on:'target'}],{u,tgt:o}); if(o.alive) T.fn.tstun(A,T,u,o,q.ctSt>0?q.ctSt:3.5*(A.eng().ccDur?A.eng().ccDur(1):0.7),'ct2'); },
    /* ---- CONTEMPT STORM: how many writs find no target (One by One); Writ Weight's count; All at Once's stun ---- */
    csCast(A,T,u,c){ const q=Q(T), n=Math.max(1,((c.o&&c.o.n)|0)||3), k=A.eng().units().filter(x=>x.alive&&x.team!==u.team).length; q.csX=Math.max(0,n-Math.min(n,k)); q.csXd=0; q.csA=0; q.cid++; },
    oboRec(A,T,u,c){ const q=Q(T); if(!(q.csA>0)) q.csA=c.amt||0; },
    obo(A,T,u){ const q=Q(T); if(q.csXd||!(q.csX>0)||!(q.csA>0)) return; q.csXd=1; const t=A.pick(T,u,{team:'enemy',order:'lowHp',n:1},{u})[0]; if(!t) return;
      A.acts(T,u,[{dmg:q.csA*q.csX*(1+(T.P['obo.more']||0)),on:'target'}],{u,tgt:t}); },
    aao(A,T,u,c){ T.fn.tstun(A,T,u,c.tgt,0.4,'aao'); },
    ww(A,T,u){ const q=Q(T); if(!(q.wwT>0)) q.wwN=0; q.wwN++; q.wwT=5; },
    wwN(A,T){ const q=Q(T); return q.wwT>0?q.wwN:0; },
    /* ---- TESTIMONY: each enemy hit that lands on him adds 1 to that enemy (Hear Every Word: a critical hit more); max 5 (Let Them Speak: 10), 6 s after the
       last (Hear Them Out: longer). Reaching 5 arms Struck Into the Record; reaching full can open Waiting to Hear It ---- */
    tsSet(A,T,u,t,n){ const q=Q(T), r=rec(T,t), was=r.tt>0?r.ts:0, mx=tsMax(T); r.ts=Math.max(0,Math.min(mx,n)); r.tt=6+(T.P['ts.dur']||0);
      if(T.P.sir&&was<5&&r.ts>=5) r.arm=1;
      if(T.P.sig3&&was<mx&&r.ts>=mx&&q.s3<=0&&u.alive){ q.s3=SIG_CD; q.wh=6; u.stunned=0; u.slow=0; } },
    tsHurt(A,T,u,c){ const s=c.src; if(!s||!s.alive) return; T.fn.tsSet(A,T,u,s,tsOf(T,s)+1+(c.crit?(T.P['ts.crit']||0):0)); },
    tsHit(A,T,u,c){ const t=c.tgt, q=Q(T); if(!t) return; const r=recOf(T,t);
      if(r&&r.arm&&!c.proc){ r.arm=0; if(T.r.sg_1_1&&t.alive) T.fn.addGavel(A,T,u,t); }
      if(T.P.sig3&&q.wh>0&&t.alive&&!c.proc) T.fn.tsSet(A,T,u,t,tsMax(T)); },
    tsN(A,T,u,c){ return tsOf(T,c.tgt); }, tsAny(A,T,u,c){ return tsOf(T,c.tgt)>0; }, tsFull(A,T,u,c){ return tsOf(T,c.tgt)>=tsMax(T); },
    tsMine(A,T,u){ const t=u.target; return (t&&t.alive)?tsOf(T,t):0; },
    tsOver(A,T,u,c){ return tsOf(T,c.tgt)>5; }, tsOverN(A,T,u,c){ return Math.max(0,tsOf(T,c.tgt)-5); },
    armed(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.arm&&!c.proc); },
    /* Interrupt: at 5 Testimony his next basic attack on that enemy stuns it 0.6 s (a talent stun: the stun-lock rule) and empties it; a stun the rule refuses
       leaves the Testimony for the next swing */
    interrupt(A,T,u,c){ const t=c.tgt; if(!t||!t.alive||tsOf(T,t)<5) return; if(T.fn.tstun(A,T,u,t,0.6,'int')){ const r=rec(T,t); r.ts=0; r.tt=0; r.arm=0; } },
    /* ---- DAYS and the wave: Long Session (this wave has lasted 15 s), On the Record (this wave's count) ---- */
    late(A,T){ return Q(T).wt>=15-1e-9; },
    otrN(A,T){ return Q(T).otr||0; },
    /* ---- CONDITIONS ---- */
    tgtStunned(A,T,u,c){ return !!c.tgt&&(c.tgt.stunned||0)>0; },
    anyHeld(A,T){ const e=Q(T).e; for(const k in e){ const r=e[k]; if(r.st>0&&r.u.alive&&(r.u.stunned||0)>0) return true; } return false; },
    ovrOn(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.ow>0); },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP. Every talent of his that makes a hit on him smaller multiplies here (each takes its share of what is left), and
       together they never take more than 25% off a hit (DR_CAP). His base kit has no reduction of its own (armour 892 / magic resist 664 at level 100) ---- */
    drK(A,T,u,src,kind){ const P=T.P; let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      cut(P['dr.calm']); cut(P['dr.ink']); cut(P['dr.nosleep']);
      if(src){ const r=recOf(T,src); if(P['dr.bench']&&r&&r.bp>0) cut(P['dr.bench']); if(P['dr.robes']&&kind==='magic'&&tsOf(T,src)>0) cut(P['dr.robes']); if(P['dr.back']&&src.t&&src.t.row==='Back') cut(P['dr.back']); }
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c.src,c.kind); },
    /* ---- THE CRIT GROUP: at most 5% from all of them on any hit. The part that holds on every hit is a stat (critS: Hammered, Restless); this hit's own part
       (Long Hearing on a stunned enemy, Heavy Docket and Cross-Examine on basic attacks) is one more seeded roll, drawn only when one of them applies ---- */
    critS(A,T){ const P=T.P; return Math.min(CRIT_CAP,(P['cr.ham']||0)+(P['cr.day']||0)*stN(T,'qDay')); },
    crit(A,T,u,c){ const t=c.tgt, P=T.P; if(!t||c.force) return; let p=0;
      if(P['cr.lh']&&(t.stunned||0)>0) p+=P['cr.lh']; if(c.auto&&P['cr.hd']&&gvOn(T,t)) p+=P['cr.hd']; if(c.auto&&P['cr.cx']&&tsOf(T,t)>=5) p+=P['cr.cx'];
      p=Math.min(p,Math.max(0,CRIT_CAP-T.fn.critS(A,T))); if(!(p>0)) return;
      const base=Math.min(0.95,(u.glyphCrit||0)+((u._critBuffT||0)>0?(u._critBuffPct||0):0)); if(A.eng().rnd()<p/Math.max(0.05,1-base)) c.force=true; },
    /* slows on him weaker: Unhurried Voice, Rules of Court and Never Slows multiply, together at most 40% weaker (once per new slow) */
    slowW(A,T,u){ const P=T.P, q=Q(T); let k=(1-(P['sw.uv']||0))*(1-(P['sw.rc']||0))*(1-(P['sw.ns']||0)); k=Math.max(1-SLOW_CAP,k);
      const m=u.slowMul; if(!((u.slow||0)>0)||m==null||!(m<1)){ q.swL=null; return; } if(q.swL===m) return; u.slowMul=1-(1-m)*k; q.swL=u.slowMul; },
    /* controls on him: Steady Bench (every control) and Nobody Said It (stuns, above 50% HP: half) multiply, together at most 50% shorter; Waiting to Hear It:
       no stun and no slow at all while it runs (immunity, not shortening) */
    ten(A,T,u,c){ const P=T.P, f=c.field; let k=1-(P['ten.all']||0); if(f==='stunned'&&P['ten.nsi']&&u.hp>0.5*u.maxHp) k*=0.5; k=Math.max(1-TEN_CAP,k);
      if(T.P.sig3&&Q(T).wh>0&&(f==='stunned'||f==='slow')) k=0; c.amt*=k; },
    /* ---- TIRELESS (his passive: the swing timer / (1 + F), F = 25% x his passive's strength). Six Hands, Tireless Arms, Not Slept: 1 point more each per rank;
       Still in Session: at 11 Days F is 40% x the strength instead of 25%; Waiting to Hear It: all of it doubled for its 6 s. Returned as the attack speed
       on top of what the game already gives. Nothing without the passive ---- */
    tirX(A,T,u){ const pm=u.passMul; if(!(pm>0)) return 0; const F=0.25*pm; let f=(T.P.sis&&stN(T,'qDay')>=11)?0.40*pm:F; f+=T.P['tir.pts']||0;
      if(T.P.sig3&&Q(T).wh>0) f*=2; return (1+f)/(1+F)-1; },
    /* ---- COOLDOWNS: Quick Seal, Quick Rulings, Recess Denied (Gag Order); Swift Ruling, Ruling Hand, Eleven Is Enough (Contempt: halved at 11 Days). Gag Order
       never under 5 s, Contempt never under 4 s (Sustained's refunds keep that floor too, counted from the cast) ---- */
    cdSet(A,T,u,c){ const P=T.P, q=Q(T);
      if(c.slot==='green'){ q.gcE=0; c.amt=Math.max(GO_FLOOR,c.amt-(P['cd.go']||0)); }
      else if(c.slot==='blue'){ q.bcE=0; let v=c.amt-(P['cd.ct']||0); if(P.eie&&stN(T,'qDay')>=11) v*=0.5; c.amt=Math.max(CT_FLOOR,v); } }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/48 - QUORREL - talent decisions.md) */
  ruling:{}
};
