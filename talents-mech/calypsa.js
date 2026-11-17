/* CALYPSA PRISMFIN - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Calypsa": what she added)
   Her real kit (the code, not the tooltip wording). Her damage profile is Hybrid: her basic attacks, Tidal Ribbon, the counter and the storm are PHYSICAL
   (the storm scales off Ability Power but lands as physical damage); only the Prismatic Scales blade is magic.
   - Tidal Ribbon ('piercethrow', green, cd 6, deliver 'line'): a line from her toward the FARTHEST enemy, 36 px each side of it, ending 24 px past that
     enemy; each enemy on it is hit (155% of her attack) when the sabers reach it (20 m/s; hooks 'skillTgt', 'line', and landPre / land around each hit).
   - Fighting Current ('evadecounter', blue, cd 9): a 2.6 s stance. The skill slot's damage-taken multiplier 0.6 - 0.001 a level (drMul / drT, the one
     slot where the strongest counts) for its whole time, and an EVADE window (_evadeT): the FIRST enemy hit inside it misses and is countered (160% of her
     attack x the skill curve); the window then closes (its damage reduction stays to the end of the 2.6 s). Hook 'evade'; the counter is a landPre / land
     pair 'counter'.
   - Prismatic Scales (passive): every Fighting Current evade also fires a magic water blade back at the attacker ((ability power or attack) x 0.55 x the
     passive's level). It is the ONLY dodge in her kit (the game's Evasion misses fire nothing). The blade is a landPre / land pair 'blade'.
   - Thousand-Fin Tempest (ultimate 'thundershower', Fritz's storm; HERO_ULT_ART.calypsa: forms 0.4 s after the press): a 3 s channel (she is rooted) at the
     aimed point, radius 6 m centre to centre; every 0.5 s a pulse strikes every enemy in it for 60% of her ability power (physical). Each pulse is a
     landPre / land pair 'thundershower'.
   Answers, Weariness, Soaked, Drenched, Through-Cut, Carried Water, Brimming and Dazzled exist only through her talents.
   Readings, caps and corrected tooltips: WIRING/18 - CALYPSA - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const RIB='piercethrow', FC='evadecounter', TEM='thundershower', WATER=[RIB,'blade',TEM];
/* the states several talents read: their bookkeeping runs when any of these is learned */
const ANS=['nb_1_1','nb_2_1','nb_3_1','nb_6_1','nb_8_1','nb_9_1','nb_11_2','nb_12_1'];
const WEAR=['nb_1_4','nb_2_4','nb_4_4','nb_5_4','nb_6_4','nb_7_3','nb_7_4','nb_8_4','nb_9_4','nb_10_4','nb_11_1','nb_12_3','nb_12_4','nb_13_2'];
const SOAK=['sl_1_1','sl_2_1','sl_3_1','sl_4_1','sl_5_1','sl_6_1','sl_7_1','sl_8_1','sl_9_1','sl_10_1','sl_11_1','sl_12_1','sl_13_3'];
const WAT=['pp_1_1','pp_2_1','pp_3_1','pp_4_1','pp_5_1','pp_6_1','pp_5_4','pp_7_1','pp_8_1','pp_9_3','pp_10_1','pp_11_1','pp_12_1','pp_13_2','pp_n1'];
const DAZ=['pp_1_3','pp_3_3','pp_4_3','pp_7_3','pp_9_3','pp_10_3','pp_11_3','pp_12_3'];             // Dazzled (the signature also Dazzles, during its own storm)
const TZ=DAZ.concat(['pp_12_2','pp_13_2']);                                                       // the strikes of one storm on each enemy are counted
const ALLY_HIT={srcTeam:'enemy',targetTeam:'ally'};                                                // an enemy's hit on one of her allies (teamIn: never herself)
const TEAM_HIT={srcTeam:'ally',targetTeam:'enemy'};                                                // a hit of her team (herself included) on an enemy
/* ---- helpers ---- */
const M_=A=>A.eng().METER();
/* the enemies on a line from u toward t, measured as Tidal Ribbon measures them (projection -12 .. end, at most W off the line) */
function onLine(u,foes,t,W,extra){ const dx=t.x-u.x, dy=t.y-u.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len, end=len+24+(extra||0), L=[];
  for(const e of foes){ const rx=e.x-u.x, ry=e.y-u.y, p=rx*ux+ry*uy; if(p<-12||p>end||Math.abs(rx*uy-ry*ux)>W) continue; L.push([e,p]); } return L.sort((a,b)=>a[1]-b[1]); }
/* a Prismatic Scales blade's size, as the passive makes it */
const bladeAmt=u=>((u.apow||u.dmg)||0)*0.55*(u.passMul||1);
module.exports={
  hero:'calypsa',
  times:['seaCd'],   // this file's own absolute fight times (paths in T.s): the engine moves them back with the clock at each wave (WIRING/41c)
  casting:true,                         // rows ask which of her skills a hit comes from (Ribbon, counter, blade, storm pulse)
  lines:true,                           // the line hook: the enemies on Tidal Ribbon's line, in order (Through-Cut, first / last, Flow, the echoes)
  states:{
    ans:{max:P('ans.max',5)},                                                      // Answers (start each wave at 0; Kept Score keeps some)
    flare:{max:10,wave:'reset'},                                                   // Hold the Flare: counters this wave
    water:{max:100},                                                               // Carried Water
    liked:{max:3,dur:6},                                                           // Liked It
    ripple:{max:5,dur:4},                                                          // Rippling (up to 5 enemies)
    edges:{max:5,dur:5},                                                           // Both Edges (up to 5 enemies)
    wear:{unit:true,max:5,dur:P('wear.dur',5),full:'wearFull'}                     // Weariness on each enemy: all lapse 5 s after the last
  },
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share */
  always:[
    {on:'cast',skill:FC,do:[{window:'fc',dur:{opt:'dur',d:2.6}}]},                                            // Fighting Current's stance (its whole time)
    {on:'cast',skill:FC,reqAny:['nb_2_2','nb_11_3'],do:[{fn:'fcSlot'}]},                                      //   its damage reduction raised by points (Hand's Width, Unbitten)
    {on:'land',skill:'counter',do:[{emit:'countered'}]},                                                      // a counter of hers (Still Water's counters run the same event)
    {on:'countered',reqAny:ANS,do:[{stack:'ans',add:1}]},                                                     // Answers: each counter
    {on:'land',skill:'blade',reqAny:ANS,do:[{stack:'ans',add:1}]},                                            //   and each blade
    {on:'kit',skill:RIB,reqAny:ANS,do:[{fn:'spendAns'}]},                                                     //   Tidal Ribbon spends them all
    {on:'wave',reqAny:ANS,do:[{fn:'ansWave'}]},                                                               //   a new wave: 0 (Kept Score keeps some)
    {on:['evade','dodged'],reqAny:WEAR,do:[{ustack:'wear',on:'source',add:1}]},                               // Weariness: each enemy she dodges
    {on:'countered',reqAny:WEAR,if:{fn:'swc'},do:[{ustack:'wear',on:'target',add:1}]},                        //   or counters without a dodge (Still Water)
    {on:'landPre',skill:RIB,do:[{fn:'cutPre'}]}, {on:'land',skill:RIB,do:[{fn:'cutPost'}]},                    // Through-Cut: how many the sabers have cut before this one
    {on:'hit',req:'sl_3_1',if:{targetTeam:'enemy',targetHas:'soak'},do:[{mark:'drench',on:'target',dur:3}]},  // Drenched: an enemy she hits while it is already Soaked
    {on:'hit',reqAny:SOAK.concat(['pp_n1']),if:{targetTeam:'enemy',casting:WATER},do:[{mark:'soak',on:'target',dur:P('soak.dur',4)}]},   // Soaked: every enemy her water hits
    {on:'hit',reqAny:WAT,if:{auto:true,targetTeam:'enemy'},do:[{fn:'water',n:P('w.auto',10)}]},              // Carried Water: each basic attack
    {on:['evade','dodged'],reqAny:WAT,do:[{fn:'water',n:P('w.dodge',10)}]},                                   //   and each dodge
    {on:'kit',skill:RIB,reqAny:WAT,do:[{fn:'brim'}]}, {on:'kit',skill:TEM,reqAny:WAT,do:[{fn:'brim'}]},       //   at 100 her next Ribbon or Tempest is Brimming
    {on:'kit',skill:TEM,reqAny:TZ,do:[{fn:'tzReset'}]},                                                       // the strikes of this storm on each enemy
    {on:'hit',reqAny:TZ,if:{casting:TEM,targetTeam:'enemy'},do:[{fn:'tzHit'}]}                                //   (3 from one storm: Dazzled)
  ],
  talents:{
    /* ============================== NEVER BIT FIRST ============================== */
    nb_1_1:[ {on:'out',if:{casting:RIB},more:R(0.03),per:{fn:'spentN'}} ],                                    // Answer Every Miss: per Answer the Ribbon spent
    nb_2_2:[ {param:'fc.pts',add:R(0.01)} ],                                                                    // Hand's Width (the fcSlot always row)
    nb_1_4:[ {stat:{aspd:R(-0.02)},per:{ust:'wear'},to:{team:'enemy',ust:{wear:1}}} ],                          // Wear Them Out
    nb_2_1:[ {param:'ans.max',add:R(1)} ],                                                                      // Open Reply
    nb_2_4:[ {param:'wear.dur',add:R(1)} ],                                                                     // Tired Fins
    nb_3_1:[ {on:'lined',if:{fn:'spent5'},do:[{fn:'sweep',share:0.40}]} ],                                      // Answered in Full: the sabers sweep back for 40%
    nb_3_2:[ {on:'kit',skill:FC,opt:{dur:{add:R(0.1)}}} ],                                                      // Dancer's Skirt
    nb_4_2:[ {on:'out',if:{casting:'counter'},more:R(0.04)}, {param:'ctr.more',add:R(0.04)} ],                  // Sharp Reply (and Still Water's counters)
    nb_5_1:[ {on:'out',if:{casting:'blade'},more:R(0.04)} ],                                                    // Prism Edge
    nb_4_3:[ {on:'ccIn',less:R(0.05)} ],                                                                        // Never Cornered (15% at most: 3 ranks)
    nb_4_4:[ {on:'in',if:{srcUst:{wear:5}},less:R(0.03)}, {on:'teamIn',if:Object.assign({srcUst:{wear:5}},ALLY_HIT),less:R(0.03)} ],   // Spent Rival
    nb_6_1:[ {on:'in',less:R(0.003),per:'ans'} ],                                                               // Patient Answer
    nb_5_2:[ {on:'out',if:{casting:'counter'},mul:0.5}, {on:'hurt',if:{window:'fc'},do:[{fn:'swCounter'}]} ],    // Still Water (PICK ONE): every attack in its time countered at 50%
    nb_5_3:[ {on:'countered',if:{fn:'brightOk'},do:[{cd:'blue',add:-3},{emit:'bright'}]} ],                     // Bright Water (PICK ONE)
    nb_5_4:[ {on:'out',more:R(0.01),per:{ust:'wear'}} ],                                                        // Worn Thin
    nb_7_1:[ {on:'out',if:{casting:RIB},more:R(0.03)} ],                                                        // Ribbon Reply
    nb_6_2:[ {on:'out',if:{casting:'counter'},more:R(0.08)}, {param:'sw.more',add:R(0.08)} ],                   // Deep Stillness
    nb_6_3:[ {on:'bright',do:[{window:'qw',dur:3}]}, {stat:{aspd:R(0.04)},if:{window:'qw'}} ],                  // Quick Water
    nb_6_4:[ {stat:{move:R(-0.05)},to:{team:'enemy',ust:{wear:1}}} ],                                           // Gasping
    nb_8_2:[ {on:'end:fc',do:[{window:'ready',dur:2}]}, {on:'in',if:{window:'ready'},less:R(0.015)} ],          // Ready Stance
    nb_7_3:[ {on:'out',if:{targetUst:{wear:1}},critMore:R(0.03)} ],                                             // Party Trick
    nb_7_4:[ {on:'wearFull',by:'target',once:'wave',do:[{stun:0.8,on:'target'}]} ],                             // Exhausted
    nb_8_1:[ {param:'ans.keep',add:R(1)} ],                                                                     // Kept Score
    nb_8_4:[ {on:'land',skill:'blade',chance:R(0.2),do:[{ustack:'wear',on:'target',add:1}]} ],                  // Wearing Down
    nb_9_1:[ {param:'ans.cd',add:R(0.2)} ],                                                                     // Swift Answer (spendAns; up to 3 s a Ribbon)
    nb_9_4:[ {on:'death',if:{unitUst:{wear:1}},do:[{fn:'outlast'}]} ],                                          // Outlasted
    nb_10_2:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                            // Spinning Fins
    nb_10_3:[ {on:'hit',if:{casting:'blade'},do:[{heal:{pct:R(0.03),of:'hit'}}]} ],                             // Rainbow Spray
    nb_10_4:[ {on:'teamIn',if:Object.assign({targetUst:{wear:1}},TEAM_HIT),more:R(0.01)} ],                     // Slow Ruin
    nb_11_1:[ {on:'out',if:{casting:'blade'},more:R(0.01),per:{ust:'wear'}} ],                                  // Answer in Kind
    nb_11_2:[ {on:'wave',do:[{cd:'blue',set:0},{stack:'ans',atLeast:3}]} ],                                     // The Fish Who Waited
    nb_11_3:[ {param:'fc.low',add:R(0.01)}, {on:'tick',if:{window:'fc',selfHpBelow:0.5},do:[{fn:'fcLow'}]} ],   // Unbitten
    nb_12_1:[ {on:'out',if:{auto:true,stackMin:{ans:5}},more:R(0.03)} ],                                        // Full Reply
    nb_12_2:[ {on:'countered',do:[{stack:'flare',add:1}]}, {stat:{atk:R(0.005)},per:'flare'} ],                 // Hold the Flare
    nb_12_3:[ {stat:{armor:R(0.03),mr:R(0.03)},per:{units:{team:'enemy',ust:{wear:5}},max:3}} ],                // Ring Wise
    nb_12_4:[ {on:'death',if:{unitUst:{wear:1}},do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                        // Last Fish Standing
    nb_13_2:[ {on:'dodge',if:{fn:'fcDown'},icd:20,do:[{dodge:true},{fn:'nbf'}]},                                // Never Bit First (SIGNATURE)
              {on:'countered',if:{window:'nbf'},do:[{fn:'nbfCounter'}]} ],
    /* ============================== STRAIGHT LINES ============================== */
    sl_1_1:[ {on:'out',if:{targetHas:'soak',casting:WATER},more:R(0.015)} ],                                    // Wet Through: her water deals more to Soaked enemies
    sl_4_2:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                          // Two Sabers
    sl_1_3:[ {on:'out',if:{casting:RIB},more:{r:0.03,$:'thru.per'},per:{fn:'cutN'}} ],                          // Into the Next (Long Blades adds to each step)
    sl_2_1:[ {stat:{move:R(-0.04)},to:{team:'enemy',has:'soak'}} ],                                             // Waterlogged
    sl_2_3:[ {on:'kit',skill:RIB,opt:{width:{more:R(0.04)}}} ],                                                 // Long Cut: the line 4% wider a rank (decisions: "past its farthest enemy" never holds anybody)
    sl_3_1:[ {on:'out',if:{targetHas:'drench'},ignoreArmor:0.15} ],                                             // Drenched (marked in the always rows)
    sl_9_4:[ {on:'hit',if:{casting:RIB,targetTeam:'enemy'},do:[{slow:R(0.04),dur:2,on:'target'}]} ],            // Undertow
    sl_3_3:[ {on:'kit',skill:RIB,opt:{width:{more:0.3}}}, {on:'skillTgt',skill:RIB,do:[{fn:'mostLine'}]} ],     // Straight Line
    sl_3_4:[ {on:'out',if:{casting:RIB},ignoreArmor:R(0.03)} ],                                                 // Clean Edges
    sl_4_1:[ {on:'in',if:{srcHas:'soak'},less:R(0.015)}, {on:'teamIn',if:Object.assign({srcHas:'soak'},ALLY_HIT),less:R(0.015)} ],   // Cold Water
    sl_5_2:[ {on:'out',if:{casting:RIB,fn:'first'},more:0.30} ],                                                // Through the Glass (PICK ONE)
    sl_5_3:[ {on:'out',if:{casting:RIB,fn:'last'},more:P('table',0.30)} ],                                      // Through the Table (PICK ONE)
    sl_4_4:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                             // Fast Current
    sl_5_1:[ {on:'out',if:{auto:true,targetHas:'soak'},more:R(0.02)} ],                                         // Heavy Water
    sl_6_2:[ {on:'hit',if:{casting:RIB,targetTeam:'enemy',fn:'first'},do:[{stun:R(0.2),on:'target'}]} ],        // First Crack
    sl_6_3:[ {param:'table',add:R(0.06)} ],                                                                     // Dinner Table
    sl_6_1:[ {param:'soak.dur',add:R(0.4)} ],                                                                   // Soak Deep
    sl_5_4:[ {on:'out',if:{casting:RIB},more:R(0.03)} ],                                                        // Rainbow Edge
    sl_6_4:[ {on:'land',skill:RIB,do:[{stack:'ripple',add:1}]}, {stat:{aspd:R(0.015)},per:'ripple'} ],          // Rippling
    sl_7_1:[ {on:'out',if:{casting:TEM,targetHas:'soak'},more:0.25} ],                                          // Tempest Soak (each strike Soaks again: the always row)
    sl_7_3:[ {param:'thru.cap',add:R(1)} ],                                                                     // Line Breaker
    sl_7_4:[ {on:'out',if:{casting:'blade'},more:R(0.04)} ],                                                    // Straight Answer
    sl_8_1:[ {on:'teamHeal',if:{unitHas:'soak'},less:R(0.02)} ],                                                // Sodden
    sl_8_3:[ {on:'out',if:{casting:RIB},critMore:R(0.04)} ],                                                    // Clear Through
    sl_9_1:[ {on:'out',if:{targetHas:'soak',targetHpBelow:0.5},more:R(0.03)} ],                                 // Riptide
    sl_9_2:[ {on:'land',skill:RIB,if:{fn:'cut4'},do:[{cd:'blue',set:0}]} ],                                     // Flow
    sl_10_1:[ {on:'teamIn',if:Object.assign({targetHas:'soak'},TEAM_HIT),more:R(0.01)} ],                       // Pooling Water
    sl_10_3:[ {param:'thru.per',add:R(0.01)} ],                                                                 // Long Blades
    sl_10_4:[ {on:'kit',skill:RIB,opt:{speed:{more:R(0.06)}}} ],                                                // Ribbon Speed
    sl_11_1:[ {stat:{apow:R(0.006)},per:{units:{team:'enemy',has:'soak',within:6},max:5}} ],                    // Flood Line
    sl_11_3:[ {on:'lined',do:[{fn:'echo',share:0.35,lag:0.3}]} ],                                               // Twin Ribbon
    sl_11_4:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                 // Wet Stone
    sl_12_1:[ {on:'out',if:{targetHas:'soak'},ignoreArmor:R(0.03),ignoreMr:R(0.03)} ],                          // Saturated
    sl_12_2:[ {on:'land',skill:RIB,do:[{stack:'edges',add:1}]}, {stat:{atk:R(0.005),apow:R(0.005)},per:'edges'} ],   // Both Edges
    sl_12_3:[ {on:'kill',if:{casting:RIB},do:[{cd:'green',add:R(-1)}]} ],                                       // Clean Exit
    sl_12_4:[ {on:'out',if:{casting:RIB,fn:'far6'},more:R(0.03)} ],                                             // Curved No More
    sl_13_3:[ {on:'line',if:{fn:'soaked3'},icd:15,do:[{fn:'escape'}]},                                          // The First Escape (SIGNATURE)
              {on:'lined',if:{fn:'escaped'},do:[{fn:'drenchAll'},{fn:'sweep',share:1}]} ],
    /* ============================== THE PARTY PIECE ============================== */
    pp_1_1:[ {on:'out',if:{fn:'brimNow'},more:R(0.04)} ],                                                       // Both Hands Full: Brimming
    pp_1_2:[ {on:'out',if:{casting:TEM},more:R(0.03)} ],                                                        // Gathering Storm
    pp_1_3:[ {on:'in',if:{srcHas:'dazz'},less:R(0.03)}, {on:'teamIn',if:Object.assign({srcHas:'dazz'},ALLY_HIT),less:R(0.03)} ],   // Trailing Rainbows
    pp_2_1:[ {param:'w.auto',add:R(2)} ],                                                                       // Deep Bowl
    pp_2_2:[ {on:'kit',skill:TEM,opt:{radius:{more:R(0.04)}}} ],                                                // Wider Storm
    pp_3_1:[ {param:'spill',add:1} ],                                                                           // Spilled Over (the water fn)
    pp_3_2:[ {stat:{crit:R(0.02)},if:{fn:'storming'}} ],                                                        // Stinging Spray
    pp_3_3:[ {param:'dazz.dur',add:R(0.3)} ],                                                                   // Dazzling
    pp_n1:[ {on:'out',if:{casting:RIB,fn:'brimFirst'},more:0.08},                                               // Spill Down the Line (LINK)
            {on:'hit',req:'sl_1_1',if:{casting:RIB,targetTeam:'enemy',fn:'brimFirst'},do:[{mark:'soak',on:'target',dur:P('soak.dur',5)}]} ],   //   with Wet Through: Soaked 1 s longer
    pp_4_1:[ {stat:{apow:R(0.02)},if:{stackMin:{water:50}}} ],                                                  // Carried Weight
    pp_5_1:[ {on:'brimmed',do:[{heal:{pct:R(0.02),of:'maxHp'}}]} ],                                             // Pour
    pp_4_3:[ {on:'out',if:{targetHas:'dazz'},more:R(0.03)} ],                                                   // Showstopper
    pp_6_1:[ {on:'out',if:{fn:'brimNow'},ignoreArmor:R(0.02),ignoreMr:R(0.02)} ],                               // Brimful
    pp_5_4:[ {on:'out',if:{fn:'brimNow'},critMore:R(0.04)} ],                                                   // Crowd Pleaser
    pp_7_4:[ {on:'out',if:{casting:'blade'},more:R(0.04)} ],                                                    // Answering Spray
    pp_7_3:[ {stat:{apow:R(0.01)},per:{units:{team:'enemy',has:'dazz'},max:5}} ],                               // Gasp
    pp_7_1:[ {on:'lined',if:{fn:'rb'},do:[{fn:'line2'}]} ],                                                     // Ribbon of Water
    pp_8_1:[ {param:'w.dodge',add:R(4)} ],                                                                      // Bucket Brigade
    pp_8_2:[ {on:'in',if:{fn:'inStorm'},less:R(0.02)} ],                                                        // Storm Eye
    pp_9_3:[ {on:'death',if:{unitHas:'dazz'},do:[{fn:'water',n:R(10)}]} ],                                      // Applause
    pp_8_4:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                          // Water Blade
    pp_5_2:[ {on:'kit',skill:TEM,opt:{dur:{add:1.5},mul:{mul:0.8}}} ],                                          // Hold the Wave (PICK ONE)
    pp_5_3:[ {on:'kit',skill:TEM,opt:{mul:{mul:2.5},dur:{set:0.05}}}, {on:'cast',skill:TEM,do:[{field:'_stormAcc',set:0.5}]} ],   // Break the Wave (PICK ONE): one pulse, at once
    pp_9_4:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                             // Swift Swim
    pp_9_2:[ {on:'land',skill:TEM,do:[{fn:'rain'}]} ],                                                          // Rainbow Rain
    pp_6_2:[ {on:'out',if:{casting:TEM},more:R(0.05)} ],                                                        // Long Storm
    pp_6_3:[ {on:'out',if:{casting:TEM},more:R(0.06)} ],                                                        // Crashing Wave
    pp_10_1:[ {param:'w.keep',add:R(4)} ],                                                                      // Never Empty
    pp_10_2:[ {on:'tick',if:{fn:'storming'},do:[{fn:'fins'}]} ],                                                // Thousand Fins
    pp_10_3:[ {on:'out',if:{targetHas:'dazz'},critMore:R(0.02)} ],                                              // Prism Burst
    pp_11_1:[ {on:'out',if:{casting:RIB,fn:'rb'},more:R(0.03)} ],                                               // Two-Handed
    pp_11_3:[ {on:'in',if:{auto:true,srcHas:'dazz'},chance:0.25,do:[{miss:true}]},                              // Bright Show: a Dazzled enemy's basic attack misses
              {on:'teamIn',if:Object.assign({auto:true,srcHas:'dazz'},ALLY_HIT),chance:0.25,do:[{miss:true}]} ],
    pp_12_1:[ {on:'brimmed',do:[{window:'nowalls',dur:4,count:{fn:'w20'}}]}, {stat:{aspd:R(0.01)},per:{window:'nowalls'}} ],   // No Walls
    pp_12_2:[ {on:'out',if:{casting:TEM,fn:'firstStrike'},more:R(0.04)} ],                                      // Five Clear Blades
    pp_12_3:[ {on:'dazzled',do:[{stack:'liked',add:1}]}, {stat:{apow:R(0.02)},per:'liked'} ],                   // Liked It
    pp_12_4:[ {on:'kit',skill:FC,opt:{dur:{add:R(0.15)}}} ],                                                    // Hand's Breadth
    pp_13_2:[ {on:'kit',skill:TEM,do:[{fn:'sea'}]}, {on:'cast',skill:TEM,do:[{fn:'seaOn'}]},                   // Never Seen the Sea (SIGNATURE)
              {on:'land',skill:TEM,if:{window:'nsts'},do:[{fn:'water',n:5}]} ]
  },
  fn:{
    /* ---- Fighting Current ---- */
    /* its damage reduction raised by points: the slot written lower, as the skill writes it (min: the strongest stays). v = the skill's own value at its level */
    fcSlot(A,T,u,c){ const o=c.o||{}, lv=(u._castLv|0)||1, v=(o.dr||0.6)-(o.perLv||0)*Math.max(0,lv-1); T.s.fcv=v;
      let p=T.P['fc.pts']||0; if(u.hp<0.5*u.maxHp) p+=T.P['fc.low']||0; if(p>0&&(u.drT||0)>0) u.drMul=Math.min(u.drMul==null?1:u.drMul,Math.max(0.05,v-p)); },
    /* Unbitten: she drops below 50% during the stance - its points from then on */
    fcLow(A,T,u){ const v=T.s.fcv; if(v==null||!((u.drT||0)>0)) return; const p=(T.P['fc.pts']||0)+(T.P['fc.low']||0); u.drMul=Math.min(u.drMul==null?1:u.drMul,Math.max(0.05,v-p)); },
    fcDown(A,T,u){ return !A.winOn(T,'fc')&&!((u._evadeT||0)>0); },
    swc(A,T,u,c){ return !!c.sw; },
    /* Still Water: an attack that hits her during the stance is countered at 50% (the counter's own size: her attack x the counter's multiplier; Sharp Reply and
       Deep Stillness larger), physical as the counter is; the same 'countered' event as the counter */
    swCounter(A,T,u,c){ const s=c.src; if(!s||!s.alive||s.team===u.team) return;
      const amt=(u.dmg||0)*(u._evadeMul||1.6)*0.5*(1+(T.P['ctr.more']||0))*(1+(T.P['sw.more']||0));
      A.acts(T,u,[{dmg:amt,on:'source',def:'phys',tag:'swc'}],c); A.run(T,u,'countered',Object.assign({},c,{tgt:s,unit:s,sw:true})); },
    /* Bright Water: once per stance */
    brightOk(A,T){ const w=T.s.w.fc; if(!w||!(w.t>0)||T.s.bw===w.at) return false; T.s.bw=w.at; return true; },
    /* Never Bit First: the attack misses and Fighting Current starts at once (her own skill at its level, no cooldown spent) */
    nbf(A,T,u,c){ const E=A.eng(), s=c.src; if(E.castSlot&&s&&s.alive) E.castSlot(u,'blue',s); A.acts(T,u,[{window:'nbf',dur:Math.max(0.1,u._evadeT||2.6)}],c); },
    /* ... and every counter in it gives full Weariness and fires a blade (talent damage, magic) at each enemy within 4 m of her */
    nbfCounter(A,T,u,c){ A.acts(T,u,[{ustack:'wear',on:'target',set:'max',burst:true},{dmg:bladeAmt(u),on:{team:'enemy',within:4},def:'magic',tag:'nbf'}],c); },
    /* ---- Answers ---- */
    spendAns(A,T,u){ const n=A.stGet(T,'ans'); T.s.rs=n; if(!(n>0)) return; A.stSet(T,u,'ans',0);
      const x=Math.min(3,n*(T.P['ans.cd']||0)); if(x>0) u.blueCd=Math.max(0,(u.blueCd||0)-x); },       // Swift Answer: up to 3 s a Ribbon
    ansWave(A,T,u){ A.stSet(T,u,'ans',Math.min(A.stGet(T,'ans'),T.P['ans.keep']||0)); },
    spentN(A,T){ return T.s.rs||0; },
    spent5(A,T){ return (T.s.rs||0)>=5; },
    /* ---- Weariness ---- */
    outlast(A,T,u,c){ const n=A.ustGet(T,u,c.unit,'wear'); if(n>0) A.acts(T,u,[{ustack:'wear',on:{team:'enemy',of:'unit',n:1},add:n}],c); },
    /* ---- the line ---- */
    cutPre(A,T,u,c){ const ln=T.s.ln; if(ln) ln.i=ln.n; },
    cutPost(A,T){ const ln=T.s.ln; if(ln){ ln.n++; ln.i=-1; } },
    cutN(A,T){ const ln=T.s.ln; return ln&&ln.i>0?Math.min(ln.i,5+(T.P['thru.cap']||0)):0; },
    first(A,T){ const ln=T.s.ln; return !!ln&&ln.i===0; },
    last(A,T,u,c){ const ln=T.s.ln; if(!ln||ln.i<0||!c.tgt) return false; const j=ln.L.indexOf(c.tgt); if(j<0) return false; for(let k=j+1;k<ln.L.length;k++) if(ln.L[k].alive) return false; return true; },
    cut4(A,T){ const ln=T.s.ln; return !!ln&&ln.n===4; },
    far6(A,T,u,c){ return !!c.tgt&&A.gap(u,c.tgt)>6*M_(A); },
    /* Straight Line: the line runs toward the enemy whose line holds the most enemies (a tie: the farther) */
    mostLine(A,T,u,c){ const E=A.eng(), foes=A.pick(T,u,{team:'enemy'},c); if(!foes.length) return; const W=(c.o&&c.o.width)||36;
      const order=foes.slice().sort((a,b)=>E.dist(u,b)-E.dist(u,a)); let best=null, bn=-1; for(const t of order){ const n=onLine(u,foes,t,W,0).length; if(n>bn){ bn=n; best=t; } } if(best) c.tgt=best; },
    /* the sabers sweep back along the line for that share of the Ribbon's hit (talent damage, physical: her armor rule), reaching each enemy on the way back */
    sweep(A,T,u,c,a){ const ln=T.s.ln; if(!ln||!ln.L.length) return; const far=Math.max(...ln.P);
      ln.L.forEach((e,i)=>A.acts(T,u,[{after:Math.max(0.05,(2*far-ln.P[i])/ln.spd),do:[{dmg:ln.raw*a.share,on:'target',def:'phys',tag:'sweep'}]}],Object.assign({},c,{tgt:e}))); },
    /* Twin Ribbon: a second line of sabers, lag s behind, for that share */
    echo(A,T,u,c,a){ const ln=T.s.ln; if(!ln) return; ln.L.forEach((e,i)=>A.acts(T,u,[{after:Math.max(0.05,ln.P[i]/ln.spd)+a.lag,do:[{dmg:ln.raw*a.share,on:'target',def:'phys',tag:'twin'}]}],Object.assign({},c,{tgt:e}))); },
    /* The First Escape: 3 or more Soaked enemies on the line - it runs on to the edge of the field */
    soaked3(A,T,u,c){ let n=0; for(const e of c.list||[]) if(A.markOf(u,e,'soak')&&++n>=3) return true; return false; },
    escape(A,T,u,c){ c.amt=1e9; if(T.s.ln) T.s.ln.esc=true; },
    escaped(A,T){ return !!(T.s.ln&&T.s.ln.esc); },
    drenchAll(A,T,u,c){ for(const e of (T.s.ln?T.s.ln.L:[])) if(e.alive) A.setMark(T,u,e,'drench',{dur:3}); },
    /* Ribbon of Water: a Brimming Ribbon also cuts a line toward the farthest enemy the first line did not cut (the Ribbon's hit, talent damage, physical) */
    line2(A,T,u,c){ const ln=T.s.ln, E=A.eng(); if(!ln) return; const foes=A.pick(T,u,{team:'enemy'},c), t=foes.slice().sort((a,b)=>E.dist(u,b)-E.dist(u,a)).find(x=>ln.L.indexOf(x)<0); if(!t) return;
      for(const [e,p] of onLine(u,foes,t,ln.W,0)) A.acts(T,u,[{after:Math.max(0.05,p/ln.spd),do:[{dmg:ln.raw,on:'target',def:'phys',tag:'line2'}]}],Object.assign({},c,{tgt:e})); },
    /* ---- Carried Water and Brimming ---- */
    /* add n Water (max 100). Spilled Over: what goes past 100 is kept, each 10 a shield of 1% of her max HP for 4 s */
    water(A,T,u,c,a){ const have=A.stGet(T,'water'), n=+a.n||0; if(!(n>0)) return; const nw=have+n;
      if(nw>100&&T.P.spill){ const s=T.s; s.spill=(s.spill||0)+(nw-Math.max(100,have)); while(s.spill>=10-1e-9){ s.spill-=10; A.acts(T,u,[{shield:{pct:0.01,of:'maxHp'},dur:4,on:'self'}],c); } }
      A.stSet(T,u,'water',Math.min(100,nw)); },
    /* at 100 Water the Ribbon / the Tempest being cast is Brimming: it spends all (Never Empty leaves 4 a rank, at most 20); 'brimmed' (ctx.spent) */
    brim(A,T,u,c){ const k=c.skill===RIB?'rb':'sb'; T.s[k]=false; const have=A.stGet(T,'water'); if(have<100-1e-9) return; T.s[k]=true;
      const keep=Math.min(20,T.P['w.keep']||0); A.stSet(T,u,'water',keep); A.run(T,u,'brimmed',Object.assign({},c,{spent:have-keep})); },
    brimNow(A,T){ const s=T.s; return (s.cur===RIB&&!!s.rb)||(s.cur===TEM&&!!s.sb); },
    rb(A,T){ return !!T.s.rb; },
    brimFirst(A,T){ const ln=T.s.ln; return !!T.s.rb&&!!ln&&ln.i===0; },
    w20(A,T,u,c){ return Math.floor(((c&&c.spent)||0)/20+1e-9); },
    /* ---- the storm ---- */
    tzReset(A,T){ T.s.tz={}; },
    /* a strike of this storm on an enemy (Break the Wave's one strike counts as 3); the 3rd Dazzles it (Trailing Rainbows' family, or the signature's storm) */
    tzHit(A,T,u,c){ const t=c.tgt; if(!t) return; const z=T.s.tz||(T.s.tz={}), n=z[t.uid]||0, k=T.r.pp_5_3?3:1; z[t.uid]=n+k;
      if(n<3&&n+k>=3&&(DAZ.some(id=>T.r[id])||A.winOn(T,'nsts'))&&t.alive){ A.setMark(T,u,t,'dazz',{dur:3+(T.P['dazz.dur']||0)}); A.run(T,u,'dazzled',Object.assign({},c,{tgt:t})); } },
    firstStrike(A,T,u,c){ return !!c.tgt&&!((T.s.tz||{})[c.tgt.uid]>0); },
    storming(A,T,u){ return (u._stormT||0)>0; },
    inStorm(A,T,u){ if(!((u._stormT||0)>0)||u._stormX==null) return false; return A.eng().dist(u,{x:u._stormX,y:u._stormY})<(u._stormR||6*M_(A)); },
    /* Rainbow Rain: each pulse heals every ally inside it (centre to centre, as the storm measures) 0.5% of its max HP */
    rain(A,T,u){ const E=A.eng(); if(u._stormX==null) return; const c={x:u._stormX,y:u._stormY}, R=u._stormR||6*E.METER();
      for(const x of E.units()) if(x.alive&&x.team===u.team&&!x._summon&&E.dist(c,x)<R) E.healUnit(x,(x.maxHp||0)*0.005); },
    /* Thousand Fins: the pulses come 3% a rank sooner */
    fins(A,T,u,c){ u._stormAcc=(u._stormAcc||0)+(c.dt||0)*0.03*(T.r.pp_10_2||0); },
    /* Never Seen the Sea: once every 30 s a Brimming storm covers the whole field for its full time */
    sea(A,T,u,c){ const now=A.eng().now(); if(!T.s.sb||now<(T.s.seaCd||-1)||!c.o) return; T.s.seaCd=now+30; T.s.sea=true; c.o.radius=1e6; },
    seaOn(A,T,u,c){ if(!T.s.sea) return; T.s.sea=false; A.acts(T,u,[{window:'nsts',dur:(u._stormT||0.05)+0.1}],c); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/18 - CALYPSA - talent decisions.md) */
  ruling:{}
};
