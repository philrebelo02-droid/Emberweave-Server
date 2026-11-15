/* KORVUX - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Korvux")
   His real kit (the code, not the tooltip wording; a melee Bruiser, every skill reads Attack, his damage is physical; tests/korvux-kit-facts.js):
   - Emberskin (passive 'immolate', in the per-unit passive pass after the talent tick, also while he is stunned): every 1 s (_immT) every enemy whose CENTRE is
     within 2.4 m of his centre takes 25% (+0.15 points a level: 39.85% at 100) of his attack through its armor (damage(), not a hit: no hit hooks).
     MEASURED: it burned an enemy on 1 of 850 ticks in 20 seeded fights (the nearest enemy stood 3.41 m centre to centre, 1.77 m body edge). Release v1391 on
     another branch measures to the enemy's body edge (609 of those 850 ticks). His Emberskin talents are built on its burns (a page site: 'immRate', 'immR',
     'immAmt'), so they work as soon as it reaches someone; nothing here changes how it measures.
   - Comet Dash ('charge', green, cd 9): dashes to the FARTHEST enemy (0.15-0.8 s), then slams every enemy whose centre is within 2.4 m of the landing spot for
     150% x skill level of his attack and a stun (the table: 2.0 s area x 0.7 = 1.4 s; the level roll can resist it). MEASURED: 55 of 79 landings slammed nobody
     (its target moves during the dash); v1391 measures to the body edge. The slam is inside landPre / land ('charge'): Afterglow starts at the landing whether
     or not it struck, Cratered on every stun it lands.
   - Ember Cleave ('cleave', blue, cd 7, delivered 0.35 s): a 45 degree sweep toward his target, every enemy whose BODY is within 3.2 m (v1389), 160% x skill
     level. MEASURED: 0.78 enemies a cast. Works.
   - Falling Star (ultimate 'ashfall', delivered 0.55 s at its aim): NO impact hit (ULT_DEF's mul 1.4 is never read). It leaves a burning crater (a ground hazard,
     6 m radius centre to centre, 5 s): every 0.5 s each enemy inside takes 80% x skill level of his attack (175% at 100: 350% a second; the card says 175% a
     second). Its ticks are damage() calls: a page site lets his rows see each tick of HIS crater ('hzTick').
   Cooking, Steam, Afterglow, Cratered, Pieces and Witnessed exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/34 - KORVUX - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const DASH='charge', CLV='cleave', STAR='ashfall', DASHES=['charge','chargePath'];
/* the states several talents read: their bookkeeping runs when any of these is learned */
const COOK=['rh_1_1','rh_2_1','rh_3_1','rh_1_4','rh_6_4','rh_7_1','rh_7_3','rh_10_1','rh_11_1','rh_11_2','rh_12_2','rh_13_2'];          // Cooking
const IE=['rh_5_3','rh_7_4','rh_9_2','rh_10_1','rh_13_2'];                                                                                // "in Emberskin": burned by its last tick
const EMB=COOK.concat(IE,['rh_2_2','rh_3_4','rh_4_2','rh_n1','rh_6_1','rh_9_4','rh_5_2','pp_7_4','pp_5_2','bs_6_2','pp_8_3','pp_12_3']);   // rows on Emberskin's burns
const STEAM=['rh_1_2','rh_2_2','rh_5_1','rh_8_2','rh_9_2','rh_10_2','rh_n1','rh_13_2'];                                                 // Steam
const AG=['bs_1_1','bs_3_1','bs_5_1','bs_5_4','bs_7_1','bs_9_1','bs_10_1','bs_12_1','bs_13_3'];                                          // Afterglow
const CR=['bs_1_4','bs_2_4','bs_3_4','bs_6_4','bs_9_4','bs_10_4','bs_9_2','bs_12_3','bs_13_3'];                                          // Cratered
const EXT=['bs_7_4','bs_5_3'];                                                                                                           // Comet Dash's stun made longer
const PC=['pp_1_4','pp_2_4','pp_3_4','pp_5_4','pp_6_4','pp_7_4','pp_10_4','pp_11_3','pp_11_4','pp_12_3','pp_13_3'];                     // Pieces
const WIT=['pp_1_3','pp_2_3','pp_4_3','pp_5_3','pp_5_2','pp_6_2','pp_9_1','pp_12_1','pp_13_3'];                                         // Witnessed
const FS=['pp_8_3','pp_9_3','pp_9_2'];                                                                                                   // "in Falling Star's crater"
const HZ=FS.concat(['pp_3_1','pp_5_2','bs_6_2','pp_12_3']);                                                                              // rows on each tick of his crater
const STK=['rh_12_3','bs_12_2','pp_1_4','pp_6_3','pp_7_1','pp_10_3','pp_3_4','pp_13_3'];                                                 // Falling Star's crater changed at the cast
const DK=['pp_5_2','bs_6_2','pp_8_3','pp_12_3'];                                                                                          // "damage from Korvux" on one enemy
const CRIT=['pp_1_1','rh_7_3','bs_6_1','bs_9_2','pp_3_1','pp_9_1'];                                                                       // his crit-chance talents: ONE capped group (5%)
const DRG=['rh_1_2','rh_1_4','rh_9_3','rh_12_4','bs_9_4','bs_10_1','bs_12_4','pp_8_4','pp_1_3'];                                         // his damage reduction: ONE capped group (30%)
const SLW=['rh_12_1','bs_11_4','pp_11_1'];                                                                                                // slows on him weaker: together at most 40%
const HEAL=['rh_8_2','bs_7_1'];                                                                                                           // his healing a second: together at most 1.2% of max HP a second
const STUN=['bs_3_4','bs_13_3'];                                                                                                          // his talent stuns (the stun-lock rule)
const DR_FLOOR=0.70, CRIT_CAP=0.05, SLOW_CAP=0.40, REGEN=0.012;
const S=T=>T.s.kvx||(T.s.kvx={kb:{},hb:0});                         // his own per-fight state (one object: no name of the runtime's own is ever used)
const rk=(T,id)=>T.r[id]||0;
const atk=(A,T,u,c)=>A.amtOf(T,u,{pct:1,of:'atk'},c);
const isBoss=x=>!!(x&&((x.t&&x.t.isboss)||x._raidBoss));
const back=x=>!!(x&&x.t&&x.t.row==='Back');                         // the game's own combat row (heroes; a monster has none)
const ck=(A,T,u,x)=>A.ustGet(T,u,x,'kxCk');
const foes=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
const inE=(A,u,x)=>!!A.markOf(u,x,'kxIe');
/* Falling Star's crater: the game's own hazard (kept when it is made), its own centre-to-centre test */
function inCrater(T,x){ const L=S(T).fs; if(!L||!x) return false; for(let i=L.length-1;i>=0;i--){ const h=L[i]; if(!(h.life>0)){ L.splice(i,1); continue; } if(Math.hypot(x.x-h.x,x.y-h.y)<=h.r) return true; } return false; }
/* his talent stuns, at their full written length on the fixed path (no resist roll): never on an enemy that is stunned now, nor within 0.5 s after a stun of his on
   it ended (mark 'kxLk', set for every stun of his by the always ccHit row), and at most twice per enemy per cast (key) */
function tstun(A,T,u,L,secs,key){ const o=S(T), cnt=o.sc||(o.sc={});
  for(const t of L){ if(!t||!t.alive||t.team===u.team) continue; if((t.stunned||0)>0||A.markOf(u,t,'kxLk')) continue;
    const k=key+'|'+t.uid; if((cnt[k]||0)>=2) continue; cnt[k]=(cnt[k]||0)+1; A.control(T,u,t,'stunned',secs); if(o.log) o.log.push([A.eng().now(),t.uid,secs]); } }
module.exports={
  hero:'korvux',
  casting:true,                         // rows ask which of his skills a hit comes from
  points:true,                          // the at hook: where Falling Star's crater is made (and the crater itself)
  times:['kvx.whT','kvx.cdT','kvx.kT'],   // his own absolute fight times (the signatures' locks): moved back with the wave clock
  watch:['rh_11_2','rh_12_2','rh_13_2'].concat(PC),   // the deaths of his enemies (Running Hotter, the signature's burst, Pieces)
  states:{
    kxSt:{max:5,dur:4},                                             // Steam (each hit on him; all lapse 4 s after the last)
    kxPc:{max:7},                                                   // Pieces (the fight)
    kxRh:{max:5,wave:'reset'},                                      // Running Hotter (this wave)
    kxCk:{unit:true,max:8,dur:1.5,step:P('ck.step',1)}              // Cooking on an enemy: 1.5 s after its last gain it starts to fade, 1 every second (Slow Roast slower)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                   // the heal budget, the second landing / star put off, the signature's trigger
    {on:'num',skill:'immRate',reqAny:EMB,do:[{fn:'immRate'}]},                                                    // Emberskin's clock (Cook Faster)
    {on:'num',skill:'immR',reqAny:EMB,do:[{fn:'immR'}]},                                                          // its reach, once a burn tick (and the signature's trigger)
    {on:'num',skill:'immAmt',reqAny:EMB,do:[{fn:'immAmt'}]},                                                      // each burn: how hard, then Cooking, in Emberskin, Keep Them Back
    {on:'hurt',reqAny:STEAM,do:[{fn:'steamHit'}]},                                                                // Steam: each hit on him
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]}, {on:'dotIn',reqAny:DRG,do:[{fn:'myDr'}]},                              // his damage reduction: one capped group
    {on:'crit',reqAny:CRIT,if:{targetTeam:'enemy'},do:[{fn:'crit'}]}, {stat:{crit:1},reqAny:CRIT,per:{fn:'critS'}},   // his crit chance: one capped group
    {on:'out',reqAny:DK,if:{targetTeam:'enemy'},do:[{fn:'dkOut'}]},                                               // "takes more damage from Korvux" on one enemy
    {on:'tick',reqAny:SLW,do:[{weaken:'slowMul',by:{flat:1,x:{fn:'slowW'}}}]},                                    // slows on him weaker (one cap)
    {on:'kit',skill:DASH,reqAny:['bs_4_3','bs_11_3','bs_13_3'],do:[{fn:'dashKit'}]},
    {on:'skillTgt',skill:DASH,reqAny:['bs_5_2','bs_5_3','bs_6_2','bs_13_3'],do:[{fn:'dashTgt'}]},                 // whom Comet Dash goes to
    {on:'land',skill:DASH,reqAny:AG.concat(['pp_11_4','rh_n1']),do:[{fn:'dashLand'}]},                            // Comet Dash has landed: Afterglow, Paid Ahead, the second landing
    {on:'ccHit',reqAny:CR.concat(EXT,STUN),do:[{fn:'ccHit'}]},                                                    // a stun of his landed: Cratered, longer, the lock
    {on:'hit',reqAny:['bs_13_3'],if:{casting:DASH,targetTeam:'enemy'},do:[{fn:'sigHit'}]},                        // the signature's landings Crater everyone they hit
    {on:'kit',skill:STAR,reqAny:STK.concat(['pp_13_3']),do:[{fn:'starKit'}]},                                     // Falling Star's crater changed at the cast
    {on:'at',skill:STAR,reqAny:WIT.concat(HZ,STK,PC),do:[{fn:'starAt'}]},                                         // where it lands: the crater made his, Witnessed, the signature
    {on:'num',skill:'hzTick',reqAny:HZ,do:[{fn:'hzTick'}]},                                                       // each tick of his crater on an enemy
    {on:'death',reqAny:['rh_11_2','rh_12_2','rh_13_2'].concat(PC),do:[{fn:'death'}]}                              // Running Hotter, the white burst, Pieces
  ],
  talents:{
    /* ============================== RUNS HOT ============================== */
    rh_1_1:[ {param:'cook.k',add:R(0.01)} ],                                                                        // Too Close (Cooking: immAmt)
    rh_1_2:[ {param:'dr.st',add:R(0.004)} ],                                                                        // Rain to Steam (Steam: steamHit; in myDr)
    rh_1_4:[ {param:'dr.hb',add:R(0.012)} ],                                                                        // Hot Blood (in myDr)
    rh_2_1:[ {param:'ck.step',add:R(0.5)} ],                                                                        // Slow Roast (Cooking fades slower)
    rh_2_2:[ {param:'imm.mist',add:R(0.1)} ],                                                                       // Scalding Mist (in immR)
    rh_3_1:[ {param:'imm.thru',add:1} ],                                                                            // Cooked Through (in immAmt)
    rh_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                      // Crater Steel
    rh_3_4:[ {param:'imm.core',add:R(0.02)} ],                                                                      // Furnace Core (in immAmt)
    rh_4_1:[ {on:'ccIn',less:R(0.04)} ],                                                                            // Unbothered (up to 20%)
    rh_4_2:[ {param:'imm.wide',add:R(0.2)} ],                                                                       // Wide Heat (in immR)
    rh_4_3:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                              // Hot Edge
    rh_n1:[  {on:'steam5',do:[{window:'kxGl',dur:3},{fn:'glowAg'}]} ],                                              // Glow Under the Steam (LINK: Afterglow too, with Afterglow learned)
    rh_5_1:[ {stat:{mr:R(0.02)},if:{stackMin:{kxSt:3}}} ],                                                          // Old Scales
    rh_5_2:[ {on:'teamIn',if:{fn:'sunAlly'},more:0.06} ],                                                           // Sunburnt Friends (PICK ONE)
    rh_5_3:[ {param:'kb.on',add:1} ],                                                                               // Keep Them Back (PICK ONE; in immAmt)
    rh_5_4:[ {stat:{move:R(0.03)}} ],                                                                               // Hot Stride
    rh_6_1:[ {param:'imm.seeth',add:R(0.04)} ],                                                                     // Seething (in immAmt)
    rh_6_2:[ {on:'out',if:{casting:CLV},more:R(0.03)} ],                                                            // Ember Edge
    rh_6_3:[ {param:'kb.slow',add:R(0.05)} ],                                                                       // Cooked Out (in immAmt: percentage points)
    rh_6_4:[ {on:'out',if:{casting:CLV,targetUst:{kxCk:4}},more:R(0.03)} ],                                         // Blistered
    rh_7_1:[ {on:'hit',if:{casting:CLV,targetTeam:'enemy'},do:[{fn:'cleaveCook'}]} ],                               // Cleave the Heat
    rh_7_3:[ {param:'crit.fw',add:R(0.01)} ],                                                                       // Forty Words (in the crit group)
    rh_7_4:[ {stat:{armor:R(-0.005)},to:{team:'enemy',has:'kxIe'}} ],                                               // Coals
    rh_8_2:[ {param:'heal.boil',add:R(0.0024)} ],                                                                   // Boiling Off (in tk, under the heal budget)
    rh_9_2:[ {param:'st.burst',add:1} ],                                                                            // Steam Burst (in steamHit)
    rh_9_3:[ {param:'dr.hs',add:R(0.01)} ],                                                                         // Hard Scales (in myDr)
    rh_9_4:[ {param:'imm.fast',add:R(0.04)} ],                                                                      // Cook Faster (in immRate)
    rh_10_1:[ {stat:{atk:R(0.005)},per:{fn:'cookIn',max:5}} ],                                                      // Overheat (up to 5 enemies)
    rh_10_2:[ {stat:{aspd:R(0.03)},if:{stackMin:{kxSt:5}}} ],                                                       // Ash Tongue
    rh_10_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                                 // Cleave Rhythm
    rh_11_1:[ {param:'imm.ks',add:1} ],                                                                             // Kellsmarch Summer (in immR)
    rh_11_2:[ {param:'rh.k',add:R(0.01)} ],                                                                         // Running Hotter (the count: death; in immAmt)
    rh_12_1:[ {param:'slow.w',add:R(0.08)} ],                                                                       // Dry Heat (in slowW)
    rh_12_2:[ {param:'wd.k',add:R(0.003)} ],                                                                        // Well Done (in immAmt)
    rh_12_3:[ {param:'star.k1',add:R(0.04)} ],                                                                       // Glowing Axe (in starAt)
    rh_12_4:[ {param:'dr.hh',add:R(0.03)} ],                                                                        // Heat Haze (in myDr)
    rh_13_2:[ {param:'sig.white',add:1} ],                                                                          // Rain Never Lands (SIGNATURE: immR, immAmt, steamHit, death)

    /* ============================== ONE BURNING STRIDE ============================== */
    bs_1_1:[ {on:'out',if:{auto:true,window:'kxAg'},more:R(0.04)} ],                                                // Afterglow (the window: dashLand)
    bs_2_2:[ {stat:{move:R(0.03)}} ],                                                                               // Steady Gait
    bs_1_4:[ {on:'out',if:{casting:CLV,targetHas:'kxCr'},more:R(0.03)} ],                                           // Distance Is No Armour (Cratered: ccHit)
    bs_2_3:[ {on:'out',if:{casting:DASHES},more:R(0.03)} ],                                                         // Long Stride
    bs_2_4:[ {param:'cr.dur',add:R(0.5)} ],                                                                         // Deep Crater
    bs_3_1:[ {param:'ag.dur',add:R(0.4)} ],                                                                         // Lasting Glow
    bs_3_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                      // Meteor Iron
    bs_4_3:[ {param:'dash.r',add:R(0.2)} ],                                                                         // Wider Landing (in dashKit)
    bs_3_4:[ {on:'hit',if:{casting:CLV,targetTeam:'enemy',targetHas:'kxCr'},do:[{fn:'stroke'}]} ],                  // Second Stroke (0.4 s, the stun-lock rule)
    bs_4_2:[ {on:'kit',skill:CLV,opt:{radius:{addM:R(0.2)}}} ],                                                     // Wide Stroke
    bs_5_2:[ {param:'tis',add:1} ],                                                                                 // Thought It Safe (PICK ONE; in dashTgt)
    bs_5_3:[ {param:'ext.aim',add:0.4} ],                                                                           // Farthest Always (PICK ONE; in ccHit)
    bs_5_1:[ {stat:{aspd:R(0.01)},if:{window:'kxAg'}} ],                                                            // Glow Hands
    bs_6_2:[ {param:'ns.k',add:R(0.04)} ],                                                                          // Nowhere Safe (in dashTgt; dk)
    bs_6_1:[ {param:'crit.bl',add:R(0.025)} ],                                                                      // Bright Landing (in the crit group)
    bs_5_4:[ {stat:{mr:R(0.03)},if:{window:'kxAg'}} ],                                                              // Thick Scales
    bs_7_1:[ {on:'hit',if:{auto:true,window:'kxAg',targetTeam:'enemy'},do:[{fn:'landHeal'}]} ],                     // Landing Heat (under the heal budget)
    bs_6_3:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                                 // Dash Again
    bs_6_4:[ {stat:{move:R(-0.05)},to:{team:'enemy',has:'kxCr'}} ],                                                 // Shaken Ground
    bs_7_2:[ {on:'out',if:{casting:CLV},more:R(0.03)} ],                                                            // Burning Crescent
    bs_7_4:[ {param:'ext.st',add:R(0.04)} ],                                                                        // Staggering (in ccHit)
    bs_9_4:[ {param:'dr.cs',add:R(0.015)} ],                                                                        // Craterside (in myDr)
    bs_9_1:[ {on:'kill',if:{window:'kxAg'},do:[{cd:'green',set:0}]} ],                                              // Never Stops Burning
    bs_9_2:[ {param:'crit.ec',add:R(0.01)} ],                                                                       // Edge of the Crater (in the crit group)
    bs_10_3:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                             // Long Arms
    bs_10_1:[ {param:'dr.gh',add:R(0.01)} ],                                                                        // Glowing Hide (in myDr)
    bs_10_4:[ {stat:{atk:R(0.01)},per:{units:{team:'enemy',has:'kxCr'},max:3}} ],                                   // Stunned Crowd (up to 3)
    bs_11_2:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                                // Ember Rhythm
    bs_11_3:[ {param:'dash.path',add:0.4} ],                                                                        // Through the Field (in dashKit: the game's own path hits)
    bs_11_4:[ {param:'slow.w',add:R(0.04)} ],                                                                       // Forty Words a Week (in slowW)
    bs_12_1:[ {on:'end:kxAg',do:[{heal:{pct:R(0.02),of:'maxHp'},on:'self'}]} ],                                     // Bask
    bs_12_2:[ {param:'star.k2',add:R(0.04)} ],                                                                       // Old Glow (in starAt)
    bs_12_3:[ {on:'hit',if:{casting:'chargePath',targetTeam:'enemy'},do:[{fn:'scorch'}]},                           // Scorched Path: Cratered ...
              {on:'out',if:{casting:DASHES,targetHas:'kxCp'},more:R(0.01)} ],                                       //   ... and 1% a rank more from Comet Dash
    bs_12_4:[ {param:'dr.ip',add:R(0.01)} ],                                                                        // Iron Patience (in myDr)
    bs_13_3:[ {param:'sig.cd',add:1} ],                                                                             // Called Down (SIGNATURE: dashLand, dashTgt, sigHit)

    /* ============================== PAID IN PIECES ============================== */
    pp_5_1:[ {stat:{move:R(0.03)}} ],                                                                               // Sky Step
    pp_1_3:[ {param:'dr.wi',add:R(0.01)}, {on:'teamIn',if:{srcHas:'kxWi',srcTeam:'enemy'},less:R(0.01)} ],          // Stop Arguing (Witnessed: starAt; him in myDr, his team)
    pp_1_4:[ {param:'pc.k',add:R(0.02)} ],                                                                          // A Piece Comes Loose (Pieces: death; in starAt)
    pp_2_3:[ {param:'wit.dur',add:R(1)} ],                                                                          // Never Forgotten
    pp_2_4:[ {stat:{atk:R(0.004)},per:'kxPc'} ],                                                                    // Wartime
    pp_3_1:[ {param:'crit.sv',add:R(0.01)} ],                                                                       // Small Violet Star (the crater's ticks: hzTick, in the crit group)
    pp_3_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                      // Starbone
    pp_3_4:[ {param:'star.inst',add:1} ],                                                                           // Installment (in starKit)
    pp_4_2:[ {on:'out',if:{casting:CLV},more:R(0.05)} ],                                                            // Cleave Through
    pp_4_3:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'kxWi'}} ],                                                 // Lasting Awe
    pp_5_4:[ {stat:{mr:R(0.02)},if:{stackMin:{kxPc:3}}} ],                                                          // Steaming Hide
    pp_6_3:[ {param:'star.burn',add:R(0.03)} ],                                                                     // Long Burn (in starAt)
    pp_6_4:[ {stat:{hp:R(0.003)},per:'kxPc'} ],                                                                     // Loose Change
    pp_7_1:[ {param:'star.r',add:R(0.2)} ],                                                                         // Crater Edge (in starKit)
    pp_7_2:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                              // Due Now
    pp_1_1:[ {param:'crit.vb',add:R(0.01)} ],                                                                       // Violet Blood (in the crit group: a stat)
    pp_8_4:[ {param:'dr.ht',add:R(0.01)} ],                                                                         // Hot Scales (in myDr)
    pp_7_4:[ {param:'imm.owe',add:0.5} ],                                                                           // Something Owes Him (in immAmt)
    pp_5_3:[ {param:'wit.fear',add:0.5} ],                                                                          // Prefers the Second (PICK ONE; in starAt)
    pp_5_2:[ {param:'nc.k',add:0.10} ],                                                                             // Never Confirmed (PICK ONE; dk)
    pp_8_3:[ {param:'lu.k',add:R(0.02)} ],                                                                          // Look Up (dk)
    pp_10_2:[ {on:'out',if:{casting:DASHES},more:R(0.05)} ],                                                        // Brief Words
    pp_9_1:[ {param:'crit.wm',add:R(0.01)} ],                                                                       // Witness Marks (in the crit group)
    pp_6_2:[ {param:'nc.k',add:R(0.02)} ],                                                                          // Nobody Argues (percentage points on Never Confirmed)
    pp_9_3:[ {param:'fs.slow',add:0.30} ],                                                                          // Stay in the Crater (in hzTick)
    pp_9_2:[ {stat:{armor:R(0.03)},if:{fn:'meInCrater'}} ],                                                         // Scaled Back
    pp_10_3:[ {param:'star.dur',add:R(0.3)} ],                                                                      // Lingering Fire (in starKit)
    pp_10_4:[ {on:'wave',once:'fight',do:[{stack:'kxPc',add:R(1)}]} ],                                              // Pieces of Sky
    pp_11_1:[ {param:'slow.w',add:R(0.04)} ],                                                                       // Unhurried Lizard (in slowW)
    pp_11_3:[ {stat:{lifesteal:R(0.002)},per:'kxPc'} ],                                                             // Heavens Owe
    pp_11_4:[ {param:'pc.ahead',add:1} ],                                                                           // Paid Ahead (in dashLand, death)
    pp_12_1:[ {on:'teamHeal',if:{unitHas:'kxWi'},less:R(0.05)} ],                                                   // Sunburn
    pp_12_2:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                                 // Ember Patience
    pp_12_3:[ {param:'po.k',add:R(0.02)} ],                                                                         // Paying Out (dk)
    pp_13_3:[ {param:'sig.star',add:1} ]                                                                            // What Came Down at Kellsmarch (SIGNATURE: starAt, tk, starKit)
  },
  needs:{ rh_6_3:'rh_5_3', pp_6_2:'pp_5_2', bs_6_2:'bs_5_2' },
  fn:{
    /* each tick: the heal budget (1.2% of his max HP a second, at most 2 s of it kept) and Boiling Off; the second Comet Dash and the second Falling Star the
       signatures put off until he is free to act */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), P=T.P, dt=c.dt||0, now=E.now();
      if(o.f==null) o.f={heal:HEAL.some(id=>T.r[id])};
      if(o.f.heal){ o.hb=Math.min(2*REGEN*u.maxHp,(o.hb||0)+REGEN*u.maxHp*dt);
        if(P['heal.boil']&&A.stGet(T,'kxSt')>=5){ const h=Math.min(o.hb,P['heal.boil']*u.maxHp*dt); if(h>0){ o.hb-=h; A.acts(T,u,[{heal:{flat:h},on:'self'}],c); } } }
      if(o.cd2){ const t=o.cd2.t; o.cd2.left-=dt; if(!t||!t.alive||o.cd2.left<0) o.cd2=null;
        else if(!((u.stunned||0)>0||(u.fearT||0)>0||u._pend||u._dash)&&E.castSlot){ o.cd2=null; o.cd2On=t; E.castSlot(u,'green',t); o.cd2On=null; } }
      if(o.k2){ o.k2.left-=dt; if(o.k2.left<0) o.k2=null;
        else if(!((u.stunned||0)>0||(u.fearT||0)>0||u._pend||u._dash)&&E.castUlt){ const L=foes(A,u); if(!L.length){ o.k2=null; return; }
          const p=E.densest?E.densest(u,o.k2.r):null, k0=[u._aimWX,u._aimWY]; o.k2=null; o.k2On=1;
          try{ if(p){ u._aimWX=p.x; u._aimWY=p.y; } let n=null,nd=1e18; for(const x of L){ const d=p?Math.hypot(x.x-p.x,x.y-p.y):0; if(d<nd){ nd=d; n=x; } } E.castUlt(u,n); }
          finally{ u._aimWX=k0[0]; u._aimWY=k0[1]; } } } },
    /* ---- EMBERSKIN: its clock, its reach and each burn, at the page's own line (the engine's measure: centre to centre today, the body edge from v1391) ---- */
    immRate(A,T,u,c){ const f=T.P['imm.fast']||0; if(f) c.amt*=1+f; },
    immR(A,T,u,c){ const o=S(T), E=A.eng(), P=T.P, M=E.METER(), now=E.now();
      if(T.r.rh_13_2&&!A.winOn(T,'kxWh')&&!(now<(o.whT||0))){ let n=0; for(const x of foes(A,u)) if(ck(A,T,u,x)>=8) n++;   // Rain Never Lands: 3 enemies at 8 Cooking at once
        if(n>=3){ o.whT=now+25; A.acts(T,u,[{window:'kxWh',dur:6}],c); } }
      let add=(P['imm.wide']||0)+(P['imm.mist']||0)*A.stGet(T,'kxSt');
      if(P['imm.ks']){ let n=0; for(const x of foes(A,u)) if(ck(A,T,u,x)>0) n++; if(n>=3) add+=1; }
      c.amt+=add*M; if(A.winOn(T,'kxWh')) c.amt*=2; o.R=c.amt/M; o.rate=1+(P['imm.fast']||0); },
    immAmt(A,T,u,c){ const o=S(T), P=T.P, e=c.unit; if(!e) return; const n=ck(A,T,u,e); let k=1;
      if(P['cook.k']) k*=1+P['cook.k']*n;
      if(P['imm.thru']&&n>=8) k*=2;
      if(P['imm.core']) k*=1+P['imm.core'];
      if(P['imm.seeth']&&u.hp<0.5*u.maxHp) k*=1+P['imm.seeth'];
      if(T.r.rh_n1&&A.winOn(T,'kxGl')) k*=1.15;
      if(P['rh.k']) k*=1+P['rh.k']*A.stGet(T,'kxRh');
      if(P['imm.owe']&&A.stGet(T,'kxPc')>=7) k*=1+P['imm.owe'];
      if(A.winOn(T,'kxWh')) k*=2;
      k*=T.fn.dk(A,T,u,e);
      let amt=c.amt*k;
      if(P['wd.k']&&A.stGet(T,'kxRh')>=5){ let x=P['wd.k']*(e.maxHp||0); if(isBoss(e)) x=Math.min(x,atk(A,T,u,c)); amt+=x; }   // Well Done: a boss at most 100% of his attack a burn
      c.amt=amt;
      if(COOK.some(id=>T.r[id])) A.ustPut(T,u,e,'kxCk',Math.min(8,n+1),1.5);
      if(IE.some(id=>T.r[id])||T.r.rh_5_2){ const d=1.2/(o.rate||1); A.setMark(T,u,e,'kxIe',{dur:d}); }
      if(P['kb.on']){ const w=T.s.wave, kb=o.kb||(o.kb={}); if(kb[e.uid]!==w){ kb[e.uid]=w; A.acts(T,u,[{push:'unit',from:'self',m:1,secs:0.3},{slow:0.20+(P['kb.slow']||0),dur:2,on:'unit'}],c); } } },
    cleaveCook(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; A.ustPut(T,u,t,'kxCk',Math.min(8,ck(A,T,u,t)+3),1.5); },
    cookIn(A,T,u){ let n=0; for(const x of foes(A,u)) if(ck(A,T,u,x)>0&&inE(A,u,x)) n++; return n; },
    /* Sunburnt Friends: an ally (not Korvux) whose body is within Emberskin's reach of his body (talent distances are body to body) */
    sunAlly(A,T,u,c){ const s=c.src, t=c.tgt; if(!s||s===u||s.team!==u.team||!t||t.team===u.team||!s.alive) return false; const E=A.eng(); return A.gap(u,s)<(S(T).R||2.4)*E.METER(); },
    /* ---- STEAM: each hit on him adds 1 (max 5, all lapse 4 s after the last). At 5: steam5 (Glow Under the Steam). Steam Burst: at 5, the next hit releases it all
       on every enemy in Emberskin (100% of his attack, through armor) and Steam empties. Rain Never Lands: every hit fills it ---- */
    steamHit(A,T,u,c){ const o=S(T), P=T.P, s=c.src; if(!s||s.team===u.team) return; const n=A.stGet(T,'kxSt');
      if(P['st.burst']&&n>=5){ A.stSet(T,u,'kxSt',0); const E=A.eng(), d=atk(A,T,u,c); for(const x of foes(A,u)) if(inE(A,u,x)) A.hurt(T,u,x,d*E.defMul(u,x,'phys')*T.fn.dk(A,T,u,x),'#ff8a3a','steamburst'); return; }
      const to=A.winOn(T,'kxWh')?5:n+1; A.stSet(T,u,'kxSt',to); if(n<5&&A.stGet(T,'kxSt')>=5&&T.on.steam5) A.run(T,u,'steam5',c); },
    glowAg(A,T,u,c){ if(T.r.bs_1_1) A.acts(T,u,[{window:'kxAg',dur:3,longest:true}],c); },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP: each multiplies, together at most 30% off a hit (hits and damage over time) ---- */
    drK(A,T,u,s){ const P=T.P; if(!s||s.team===u.team) return 1; let k=1;
      if(P['dr.st']) k*=1-P['dr.st']*A.stGet(T,'kxSt');
      if(P['dr.hb']&&ck(A,T,u,s)>0) k*=1-P['dr.hb'];
      if(P['dr.hs']) k*=1-P['dr.hs'];
      if(P['dr.hh']&&back(s)) k*=1-P['dr.hh'];
      if(P['dr.cs']&&A.markOf(u,s,'kxCr')) k*=1-P['dr.cs'];
      if(P['dr.gh']&&A.winOn(T,'kxAg')) k*=1-P['dr.gh'];
      if(P['dr.ip']) k*=1-P['dr.ip'];
      if(P['dr.ht']) k*=1-P['dr.ht'];
      if(P['dr.wi']&&A.markOf(u,s,'kxWi')) k*=1-P['dr.wi'];
      return Math.max(DR_FLOOR,k); },
    myDr(A,T,u,c){ if(!T.s.api) T.s.api=A; c.amt*=T.fn.drK(A,T,u,c.src); },
    /* ---- THE CRIT GROUP: at most 5% from all of them on any hit. Violet Blood is a stat (critS); the rest is this hit's own seeded roll, in the room left ---- */
    critS(A,T){ return Math.min(CRIT_CAP,T.P['crit.vb']||0); },
    crit(A,T,u,c){ const P=T.P, t=c.tgt; if(c.force) return; let p=0;
      if(P['crit.fw']&&ck(A,T,u,t)>=4) p+=P['crit.fw'];
      if(P['crit.bl']&&T.s.cur===DASH) p+=P['crit.bl'];
      if(P['crit.ec']&&A.markOf(u,t,'kxCr')) p+=P['crit.ec'];
      if(P['crit.wm']&&A.markOf(u,t,'kxWi')) p+=P['crit.wm'];
      p=Math.min(p,Math.max(0,CRIT_CAP-T.fn.critS(A,T))); if(!(p>0)) return;
      const base=Math.min(0.95,(u.glyphCrit||0)+((u._critBuffT||0)>0?(u._critBuffPct||0):0)); if(A.eng().rnd()<p/Math.max(0.05,1-base)) c.force=true; },
    /* ---- "takes more damage from Korvux" on one enemy: Never Confirmed (+ Nobody Argues), Nowhere Safe, Look Up, Paying Out; his hits, Emberskin, his crater ---- */
    dk(A,T,u,t){ const P=T.P; let k=1; if(!t) return k;
      if(P['nc.k']&&A.markOf(u,t,'kxWi')) k*=1+P['nc.k'];
      if(P['ns.k']&&A.markOf(u,t,'kxNs')) k*=1+P['ns.k'];
      if(P['lu.k']&&inCrater(T,t)) k*=1+P['lu.k'];
      if(P['po.k']&&A.stGet(T,'kxPc')>=7) k*=1+P['po.k'];
      return k; },
    dkOut(A,T,u,c){ c.amt*=T.fn.dk(A,T,u,c.tgt); },
    slowW(A,T){ return Math.min(SLOW_CAP,T.P['slow.w']||0); },
    /* ---- COMET DASH ---- */
    dashKit(A,T,u,c){ const P=T.P, o=c.o, M=A.eng().METER(); if(P['dash.r']) o.radius=(o.radius||2.4*M)+P['dash.r']*M; if(P['dash.path']&&!(o.pathHit>0)) o.pathHit=P['dash.path']; },
    /* whom it goes to: the signature's second landing (the next farthest enemy), else Thought It Safe (the back-row enemy with the lowest HP; none: the farthest, as the
       game picks). Kept: the enemy it aimed at (Farthest Always) and where he set off from (the signature's line) */
    dashTgt(A,T,u,c){ const o=S(T), P=T.P;
      if(o.cd2On&&o.cd2On.alive){ c.tgt=o.cd2On; o.second=1; }
      else { o.second=0; if(P.tis){ let b=null; for(const x of foes(A,u)) if(back(x)&&(!b||x.hp<b.hp)) b=x; if(b){ c.tgt=b; if(P['ns.k']) A.setMark(T,u,b,'kxNs',{dur:4}); } } }
      o.aim=c.tgt; o.from={x:u.x,y:u.y}; o.sc={}; o.sh=[]; },
    /* Comet Dash has landed (whether or not the slam struck): Afterglow (4 s + Lasting Glow; the signature 8 s), Paid Ahead's 3 s. Called Down: once every 25 s
       the second landing on the next farthest enemy from where he set off (the game's own dash and slam again, cast at once); every enemy on the line between the
       two landings is Cratered and stunned 0.5 s */
    dashLand(A,T,u,c){ const o=S(T), P=T.P, E=A.eng(), now=E.now(), sig=!!P['sig.cd'];
      const L1=o.lastL, here={x:u.x,y:u.y}; o.lastL=here; let eight=false;
      if(sig&&o.second){ o.second=0; eight=true; for(const x of (o.sh||[])) T.fn.crater(A,T,u,x);
        if(L1){ const line=foes(A,u).filter(x=>x!==o.aim1&&x!==o.aim&&T.fn.onSeg(A,x,L1,here)); for(const x of line) T.fn.crater(A,T,u,x); tstun(A,T,u,line,0.5,'cd'+now); } }
      else if(sig&&!(now<(o.cdT||0))){ const from=o.from||here, first=o.aim; let b=null,bd=-1;
        for(const x of foes(A,u)){ if(x===first) continue; const d=Math.hypot(x.x-from.x,x.y-from.y); if(d>bd){ bd=d; b=x; } }
        if(b){ o.cdT=now+25; o.cd2={t:b,left:2}; o.aim1=first; eight=true; for(const x of (o.sh||[])) T.fn.crater(A,T,u,x); } }
      if(AG.some(id=>T.r[id])) A.acts(T,u,[{window:'kxAg',dur:eight?8:4+(P['ag.dur']||0),longest:true}],c);
      if(P['pc.ahead']) A.acts(T,u,[{window:'kxPa',dur:3}],c); },
    onSeg(A,x,a,b){ const dx=b.x-a.x, dy=b.y-a.y, L2=dx*dx+dy*dy; if(!(L2>0)) return false; let t=((x.x-a.x)*dx+(x.y-a.y)*dy)/L2; t=Math.max(0,Math.min(1,t));
      return Math.hypot(x.x-(a.x+dx*t),x.y-(a.y+dy*t))<A.eng().bodyR(x); },
    sigHit(A,T,u,c){ const o=S(T), t=c.tgt; if(t&&o.sh&&o.sh.indexOf(t)<0) o.sh.push(t); },   // the enemies this slam struck (the signature Craters them all)
    crater(A,T,u,t){ if(!CR.some(id=>T.r[id])||!t||!t.alive) return; A.setMark(T,u,t,'kxCr',{dur:4+(T.P['cr.dur']||0)}); },
    scorch(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; T.fn.crater(A,T,u,t); A.setMark(T,u,t,'kxCp',{dur:4+(T.P['cr.dur']||0)}); },
    /* a stun of his landed: Comet Dash's own stun is made longer (Staggering; Farthest Always on the enemy it aimed at) in full, never past 4.0 s; it Craters the enemy;
       every stun of his (skill or talent) leaves the lock for 0.5 s after it ends */
    ccHit(A,T,u,c){ const t=c.tgt, P=T.P; if(c.field!=='stunned'||!t||!t.alive) return;
      if(!c.talent&&T.s.cur===DASH){ let ext=P['ext.st']||0; if(P['ext.aim']&&t===S(T).aim) ext+=P['ext.aim']; if(ext>0) t.stunned=Math.min(4.0,Math.max(t.stunned||0,(c.amt||0)+ext)); if(T.r.bs_1_4) T.fn.crater(A,T,u,t); }   // Cratered by the stun: Distance Is No Armour's own sentence
      if(STUN.some(id=>T.r[id])) A.setMark(T,u,t,'kxLk',{dur:(t.stunned||0)+0.5,longest:true}); },
    stroke(A,T,u,c){ tstun(A,T,u,[c.tgt],0.4,'ss'+A.eng().now()); },
    /* ---- AFTERGLOW: Landing Heat under the heal budget ---- */
    landHeal(A,T,u,c){ const o=S(T), h=Math.min(o.hb||0,0.005*rk(T,'bs_7_1')*u.maxHp); if(h>0){ o.hb-=h; A.acts(T,u,[{heal:{flat:h},on:'self'}],c); } },
    /* ---- FALLING STAR ---- */
    /* its crater as it is made: wider (Crater Edge; Installment at 7 Pieces 2 m), longer (Lingering Fire; Installment 3 s); the signature's second star twice as wide */
    starKit(A,T,u,c){ const o=S(T), P=T.P, op=c.o, M=A.eng().METER(); let r=op.radius||6*M, d=op.dur||5;
      r+=(P['star.r']||0)*M; d+=P['star.dur']||0; if(P['star.inst']&&A.stGet(T,'kxPc')>=7){ r+=2*M; d+=3; }
      if(o.k2On) r*=2; op.radius=r; op.dur=d; },
    /* it has landed: the crater (the game's hazard, passed to the at hook) made his: its burn stronger (Glowing Axe, Old Glow, Long Burn, each Piece), each tick seen by
       hzTick; every enemy within 10 m of where it landed is Witnessed (6 s, Never Forgotten longer), Prefers the Second fears them 0.5 s; Kellsmarch */
    starAt(A,T,u,c){ const o=S(T), P=T.P, h=c.c, E=A.eng(), now=E.now(), sec=!!o.k2On; o.k2On=null;
      if(h&&h.interval){ h._talH=u; let k=(1+(P['star.k1']||0))*(1+(P['star.k2']||0))*(1+(P['star.burn']||0)); if(P['pc.k']) k*=1+P['pc.k']*A.stGet(T,'kxPc'); h.dmg*=k; (o.fs||(o.fs=[])).push(h); }
      if(WIT.some(id=>T.r[id])){ const L=A.pick(T,u,{team:'enemy',of:'pt',within:10},c), seen=sec&&h?L.concat(foes(A,u).filter(x=>L.indexOf(x)<0&&Math.hypot(x.x-h.x,x.y-h.y)<=h.r)):L;
        for(const x of seen) A.setMark(T,u,x,'kxWi',{dur:6+(P['wit.dur']||0),longest:true});
        const f=sec?1:(P['wit.fear']||0); if(f>0) for(const x of seen){ if(!x.alive) continue; A.control(T,u,x,'fearT',f); if((x.fearT||0)>0) x._fearFrom=u; } }
      if(sec){ A.stSet(T,u,'kxPc',0); return; }
      if(P['sig.star']&&A.stGet(T,'kxPc')>=7&&!(now<(o.kT||0))){ o.kT=now+30; o.k2={left:2,r:(c.o&&c.o.radius)||6*E.METER()}; } },
    /* each tick of his crater on an enemy: "more damage from Korvux" (dk), Small Violet Star's critical (in the crit group's room, a seeded roll), Stay in the Crater's slow */
    hzTick(A,T,u,c){ const P=T.P, e=c.unit; if(!e) return; c.amt*=T.fn.dk(A,T,u,e);
      if(P['crit.sv']){ const p=Math.min(P['crit.sv'],Math.max(0,CRIT_CAP-T.fn.critS(A,T))); if(p>0&&A.eng().rnd()<p) c.amt*=1+Math.max(0,(u.critDmg||0.6)-(e.critRes||0)); }
      if(P['fs.slow']) A.acts(T,u,[{slow:P['fs.slow'],dur:0.6,on:'unit'}],c); },
    meInCrater(A,T,u){ return inCrater(T,u); },
    /* ---- DEATHS of his enemies: Running Hotter (died while Cooking: +1 for the wave, up to 5), the white burst (died in Emberskin while Rain Never Lands burns: 50% of
       his attack to the enemies within 3 m of it), Pieces (died within 6 m of him, body to body: 1, Paid Ahead 2 within 3 s of a landing; at most 7) ---- */
    death(A,T,u,c){ const x=c.unit, P=T.P, E=A.eng(); if(!x||x.team===u.team) return;
      if((T.r.rh_11_2||T.r.rh_12_2)&&ck(A,T,u,x)>0) A.stSet(T,u,'kxRh',A.stGet(T,'kxRh')+1);
      if(T.r.rh_13_2&&A.winOn(T,'kxWh')&&inE(A,u,x)){ const d=0.5*atk(A,T,u,c); for(const y of foes(A,u)) if(y!==x&&A.gap(x,y)<3*E.METER()) A.hurt(T,u,y,d*E.defMul(u,y,'phys')*T.fn.dk(A,T,u,y),'#fff0a0','whiteburst'); }
      if(PC.some(id=>T.r[id])&&A.gap(u,x)<6*E.METER()){ const n=(P['pc.ahead']&&A.winOn(T,'kxPa'))?2:1; A.stSet(T,u,'kxPc',A.stGet(T,'kxPc')+n); } }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/34 - KORVUX - talent decisions.md) */
  ruling:{}
};
