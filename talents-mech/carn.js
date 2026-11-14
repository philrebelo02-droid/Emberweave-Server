/* CARN - what his learned talents do in a fight (the mechanics; his 11 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Carn")
   His real kit (the code, not the tooltip wording; his skills read Attack, his hits are physical):
   - Reckless Blow ('reckless', green, cd 7): one hit of 240% of his attack on his target, THEN it costs him 6% of his max HP, written straight onto his
     HP and never below 1 (no damage(), no hook saw it). The cost goes through the 'num' hook 'reckCost' (one guarded expression, the old one untalented).
   - Vein Burst ('bloodnova', blue, cd 9, delivered: it forms 0.35 s after the cast): 70% of his attack x (1 + 2.2 x the share of HP he is missing) on
     every enemy within 2.8 m of HIS CENTRE, measured to the enemy's CENTRE, and a bleed of 15% of his attack a second for 3 s. Two bodies that touch stand
     about 3.7 m apart, so untalented it reaches nobody (0 enemies in 92 casts of 18 seeded fights: tests/carn-kit-facts.js). With any talent that names
     Vein Burst it reaches to the enemy's body edge, as Crimson Reap does (the 'num' hook 'veinBody'; decisions file).
   - Unrelenting (purple passive 'fury'): his attack interval / (1 + 0.25 x the passive's level multiplier), set when he is built (u.passMul).
   - Crimson Reap (ultimate 'cleave': ULT_DEF.cleave mul 3.4, radius 6.5 m, arc 90, bleed; HERO_ULT_ART.carn only adds the art and a 'form' delivery):
     a 90 degree wedge toward his aim, 6.5 m from his centre to the enemy's BODY EDGE, 340% of his attack, and a bleed of 30% of his attack a second for 4 s.
   - His bleeds are the DoTs his two skills push (colour #c0392b, physical). His always rows make them his (tagDots 'reap' / 'vein'), so his bleed talents
     read them. His basic attack swings about every 1.9 s at level 100 (with Unrelenting), and the blow lands on the contact frame.
   Paid Out, Hours, Holding, the Red Current, Pace and Dose exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/19 - CARN - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const RB='reckless', VB='bloodnova', CR='cleave', BLEED='#c0392b';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const PAID=['pr_1_1','pr_2_1','pr_4_1','pr_6_1','pr_9_2','pr_10_1','pr_11_1','pr_12_1','pr_12_2','pr_13_2'];
const COST=['pr_3_1','pr_4_2','pr_5_2','pr_5_3'];
const HOUR=['pr_1_4','pr_3_4','pr_5_4','pr_6_4','pr_7_4','pr_9_4','pr_10_4','pr_12_4'];
const HOLD=['fc_1_1','fc_2_1','fc_3_1','fc_3_3','fc_4_1','fc_6_1','fc_8_1','fc_9_3','fc_11_1','fc_12_1','fc_13_2'];
const RC=['fc_1_4','fc_2_4','fc_4_4','fc_5_4','fc_6_4','fc_7_2','fc_9_4','fc_10_4','fc_12_4','fc_13_2'];
const BLN=['fc_11_2','fc_12_2','fc_13_2'];
const VEIN=['pr_10_3','fc_4_4','fc_5_2','fc_5_3','fc_6_2','fc_7_3','fc_10_3','bt_10_2'];
const PACE=['bt_1_3','bt_1_4','bt_2_4','bt_3_4','bt_4_4','bt_5_4','bt_7_4','bt_9_4','bt_10_4','bt_11_2','bt_12_2','bt_12_4','bt_13_2','bt_n1'];
const DOSE=['bt_1_1','bt_2_1','bt_3_1','bt_4_1','bt_n1','bt_5_2','bt_5_3','bt_6_1','bt_7_3','bt_9_2','bt_10_1','bt_10_2','bt_11_1','bt_11_3','bt_12_1','bt_12_2','bt_12_3','bt_13_2'];
const TEN=['bt_2_4','bt_5_1'];
const ALLY_HIT={srcTeam:'enemy',targetTeam:'ally'};        // an enemy's hit on one of his allies (teamIn: never himself)
const P10={full:[{emit:'pace10'}]};                        // a Pace gain that reaches 10 is the 'pace10' event
/* ---- helpers ---- */
const now=A=>A.eng().now();
/* Paid Out: the HP he has paid (T.s.paid, at most his max HP = 10 steps) and its steps (each 10% of his max HP, up to 10). Reaching 10 is 'paid10', run once
   the skill being cast has finished (so a heal lands after the cost). */
function syncSteps(A,T,u){ const st=Math.min(10,Math.floor((T.s.paid||0)/(0.1*Math.max(1,u.maxHp))+1e-9)); A.stSet(T,u,'steps',st); return st; }
function addPaid(A,T,u,c,hp){ if(!(hp>0)) return; const was=A.stGet(T,'steps'); T.s.paid=Math.min(u.maxHp,(T.s.paid||0)+hp); if(was<10&&syncSteps(A,T,u)>=10) A.acts(T,u,[{later:[{emit:'paid10'}]}],c||{u}); }
/* his Doses: each its own clock (T.s.ds = the times they run out); the 'dose' stack mirrors how many he holds */
const doseDur=T=>6+(T.P['dose.dur']||0);
function doseSync(A,T,u){ A.stSet(T,u,'dose',(T.s.ds||[]).length); }
module.exports={
  hero:'carn',
  casting:true,                         // rows ask which of his skills a hit comes from (Reckless Blow, Vein Burst, Crimson Reap)
  states:{
    steps:{max:10},                                                               // Paid Out, in steps of 10% of his max HP (the HP itself is T.s.paid)
    hour:{max:P('hour.max',6),wave:'reset'},                                      // Hours (this wave)
    hx:{}, bl4:{max:5}, bln:{}, bnr:{},                                      // the scan: enemies beyond the second while Holding; bleeding enemies (within 4 m, all, near)
    corpse:{max:10,wave:'reset'},                                                 // Corpse Count (this wave)
    pace:{max:10,wave:'reset'},                                                   // Pace
    cob:{max:5,wave:'reset'},                                                     // Chain of Blows (this wave)
    dose:{max:P('dose.max',3)}                                                    // Doses (each its own clock: T.s.ds)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'kit',do:[{tagDots:'kit'}]},                                                                       // his skills' bleeds are his:
    {on:'cast',skill:CR,do:[{tagDots:'reap',emit:'reapDot'}]},                                              //   Crimson Reap's
    {on:'cast',skill:VB,do:[{tagDots:'vein',emit:'veinDot'}]},                                              //   Vein Burst's
    {on:'num',skill:'veinBody',reqAny:VEIN,add:1},                                                         // a Vein Burst talent: it reaches to the enemy's body edge
    {on:'num',skill:'reckCost',reqAny:PAID.concat(COST),do:[{fn:'cost'}]},                                 // Reckless Blow's cost: changed, written down as Paid Out
    {on:'wave',reqAny:PAID,unless:'pr_11_1',do:[{fn:'paidReset'}]},                                        // Paid Out is this wave's (Never Called Victory keeps it)
    {on:'tick',reqAny:HOUR,period:P('hour.p',5),if:{fn:'foes'},do:[{stack:'hour',add:1}]},                 // an Hour every 5 s of a wave (Long Watch: sooner)
    {on:'tick',reqAny:HOLD.concat(RC,BLN),do:[{fn:'scan'}]},                                               // Holding, the Red Current, bleeding enemies: one walk a tick
    {on:'hit',reqAny:PACE,if:{auto:true,targetTeam:'enemy'},do:[{fn:'swung'},Object.assign({stack:'pace',add:1},P10)]},   // Pace: each basic attack he lands
    {on:'tick',reqAny:PACE,do:[{fn:'paceTick'}]},                                                          //   it drops when he stops; a stun or a fear clears it
    {on:'cast',reqAny:DOSE,do:[{fn:'doseGain'}]},                                                          // a Dose for each ability he casts
    {on:'tick',reqAny:DOSE,do:[{fn:'doseTick'}]},                                                          //   each runs out on its own clock; they cost HP
    {on:'waveEnd',reqAny:['bt_11_1'],do:[{fn:'doseKeep'}]},                                                //   Bottle Kept: what they had left
    {on:'wave',reqAny:DOSE,do:[{fn:'doseWave'}]},                                                          //   a new wave: gone (or back, with Bottle Kept)
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]}                                                                 // shorter controls on him, with their cap
  ],
  talents:{
    /* ============================== THE PRICE ============================== */
    pr_1_1:[ {on:'out',more:R(0.004),per:'steps'}, {on:'dotOut',more:R(0.004),per:'steps'} ],               // Ledger of Blood: each step of Paid Out
    pr_1_3:[ {on:'out',if:{fn:'grown'},more:R(0.02)}, {on:'dotOut',if:{fn:'grown'},more:R(0.02)} ],         // Grown Blade
    pr_1_4:[ {stat:{lifesteal:R(0.005)},per:'hour'} ],                                                     // Sixth Hour
    pr_2_1:[ {on:'out',if:{casting:RB},more:R(0.01),per:'steps'} ],                                        // Keeps the Count
    pr_2_2:[ {on:'out',if:{casting:RB},more:R(0.03)} ],                                                    // Means It
    pr_3_1:[ {on:'hit',if:{casting:RB,targetTeam:'enemy'},do:[{fn:'rbT'}]} ],                              // Throw It Anyway (the cost is dealt to it: cost)
    pr_4_2:[ {on:'out',if:{casting:RB},more:R(0.06)}, {param:'cost.add',add:R(0.01)} ],                    // Bigger Price (RISK)
    pr_n1:[ {on:'hurt',do:[{mark:'mtm',on:'source',unique:true}]},                                         // Marked the Man: the last enemy to hit him
            {on:'out',if:{targetHas:'mtm'},more:R(0.02)}, {on:'dotOut',if:{targetHas:'mtm'},more:R(0.02)} ],
    pr_3_4:[ {stat:{atk:R(0.003)},per:'hour'} ],                                                           // Watch on the Bridge
    pr_4_1:[ {on:'in',less:R(0.003),per:'steps'} ],                                                        // Price Paid
    pr_5_2:[ {param:'cost.mul',add:1}, {on:'out',if:{casting:RB},more:0.40} ],                             // All In (PICK ONE)
    pr_5_3:[ {param:'cost.inst',add:1}, {on:'tick',if:{fn:'draining'},do:[{fn:'drain'}]} ],                // Pay in Installments (PICK ONE)
    pr_5_4:[ {param:'hour.p',add:R(-0.4)} ],                                                               // Long Watch
    pr_5_1:[ {on:'in',if:{auto:false},less:R(0.015)} ],                                                    // Deep Pockets: hits that are not basic attacks
    pr_4_3:[ {on:'healMe',if:{selfHpBelow:0.50},more:R(0.03)} ],                                           // Trench Grit
    pr_10_3:[ {on:'out',if:{casting:VB},more:R(0.04)}, {on:'dotOut',if:{tag:'vein'},more:R(0.04)} ],       // Blood Price
    pr_6_1:[ {on:'paid10',once:'fight',do:[{heal:{pct:R(0.03),of:'maxHp'}}]} ],                            // Interest Due
    pr_6_2:[ {on:'crit',req:'pr_5_2',if:{casting:RB},chance:R(0.01),force:true} ],                         // Nothing Held Back (1% per rank: the crit-chance cap)
    pr_6_4:[ {stat:{aspd:R(0.005)},per:'hour'} ],                                                          // Noon Bells
    pr_7_3:[ {on:'in',if:{window:'drain'},less:R(0.01)} ],                                                 // Small Payments
    pr_7_4:[ {on:'hit',if:{casting:CR,targetTeam:'enemy'},do:[{stack:'hour',add:1}]} ],                    // Crimson Hour
    pr_8_3:[ {on:'out',do:[{fn:'wounds',x:R(0.004)}]}, {on:'dotOut',do:[{fn:'wounds',x:R(0.004)}]} ],      // Old Wounds Open
    pr_9_2:[ {on:'kill',dots:true,do:[{fn:'paidAdd',pct:R(0.01)}]} ],                                      // Arithmetic
    pr_9_3:[ {on:'hit',if:{casting:RB,targetTeam:'enemy'},do:[{heal:{pct:R(0.04),of:'hit'}}]} ],           // Hard Bargain
    pr_9_4:[ {on:'out',if:{auto:true,stackMin:{hour:6}},more:R(0.02)} ],                                   // Past Noon
    pr_10_1:[ {stat:{crit:R(0.001)},per:'steps'} ],                                                        // The Count (0.1% per rank: the crit-chance cap)
    pr_10_4:[ {on:'in',if:{stackMin:{hour:6}},less:R(0.015)} ],                                            // Six Hours Held
    pr_11_1:[ {param:'paid.keep',add:1} ],                                                                 // Never Called Victory (the always row's `unless`)
    pr_11_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                       // Pay It Out
    pr_12_1:[ {on:'wave',do:[{fn:'paidAtLeast',steps:R(2)}]} ],                                            // Spent Freely
    pr_12_2:[ {on:'out',if:{casting:RB,stackMin:{steps:10}},more:R(0.03)} ],                               // Debt Called
    pr_12_3:[ {on:'kill',dots:true,do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                                // Bridge Ends
    pr_12_4:[ {param:'hour.max',add:R(1)} ],                                                               // Seventh Hour
    pr_13_2:[ {on:'cast',skill:RB,if:{stackMin:{steps:10}},do:[{window:'wic',dur:0.01,cd:25},{fn:'payBack'}]} ],   // What It Cost (SIGNATURE)
    /* ============================== FERROW CROSSING ============================== */
    fc_1_1:[ {on:'in',less:R(0.01),per:'hx'} ],                                                            // Hold the Crossing: each enemy beyond the second (up to 5)
    fc_11_4:[ {on:'dotOut',if:{selfHpBelow:0.50},more:R(0.02)} ],                                          // Shallows
    fc_1_4:[ {stat:{move:R(-0.04)},to:{team:'enemy',has:'rcA'}} ],                                         // Red Water: in the Red Current and moving away from him
    fc_2_1:[ {stat:{aspd:R(0.02)},if:{fn:'hold'}} ],                                                       // Narrow Bridge
    fc_2_4:[ {on:'teamIn',if:Object.assign({srcHas:'rc'},ALLY_HIT),less:R(0.02)} ],                        // Drag of the Current
    fc_3_1:[ {param:'np',add:1} ],                                                                         // Nobody Passes (the scan slows them)
    fc_3_2:[ {on:'out',if:{casting:CR},more:R(0.03)}, {on:'dotOut',if:{tag:'reap'},more:R(0.03)} ],        // Wide Reap
    fc_3_3:[ {stat:{armor:R(0.03)},if:{fn:'hold'}} ],                                                      // Mud and Iron
    fc_4_1:[ {on:'tick',if:{fn:'hold'},period:1,do:[{heal:{pct:R(0.002),of:'maxHp'}}]} ],                  // Six Hours Standing (0.2% per rank: the regeneration cap)
    fc_4_3:[ {on:'reapDot',do:[{extendDot:R(0.5)}]} ],                                                     // Long Bleed
    fc_4_4:[ {on:'out',if:{casting:VB,targetHas:'rc'},more:R(0.03)}, {on:'dotOut',if:{tag:'vein',targetHas:'rc'},more:R(0.03)} ],   // Pulled Under
    fc_n1:[ {on:'in',if:{srcDot:true},less:R(0.015)} ],                                                    // Bled Weak
    fc_7_2:[ {on:'hit',if:{casting:CR,targetTeam:'enemy'},do:[{pull:'target',to:'self',m:1.5,secs:0.3},{mark:'rcx',on:'target',dur:4,longest:true}]} ],   // The Long Pull
    fc_12_3:[ {on:'tick',if:{selfHpBelow:0.30},period:2,do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],           // Tourniquet
    fc_5_4:[ {on:'dotOut',if:{targetHas:'rc'},more:R(0.03)} ],                                             // Riverbank
    fc_6_1:[ {on:'teamIn',if:Object.assign({fn:'hold',targetWithin:4},ALLY_HIT),less:R(0.02)} ],           // Shoulder to Shoulder
    fc_9_2:[ {on:'hit',if:{casting:CR,targetTeam:'enemy'},do:[{fn:'gather'}]}, {on:'cast',skill:CR,do:[{fn:'gathered',x:R(0.006)}]} ],   // Gathered In
    fc_6_4:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'rc'}} ],                                          // Current Runs Red
    fc_7_1:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                     // Blooded Steel
    fc_9_4:[ {on:'death',if:{who:'enemy',unitHas:'rc'},do:[                                                // Drowned
              {dot:'drown',on:{team:'enemy',of:'unit',within:2},amt:{pct:0.15,of:'dmg'},dur:3,color:BLEED},
              {mark:'rcx',on:{team:'enemy',of:'unit',within:2},dur:3,longest:true}]} ],
    fc_8_1:[ {on:'death',if:{who:'enemy',fn:'hold'},do:[{stack:'corpse',add:1}]}, {stat:{atk:R(0.005)},per:'corpse'} ],   // Corpse Count
    fc_5_2:[ {on:'kit',skill:VB,opt:{radius:{mul:1.4}}} ],                                                 // Burst Wide (PICK ONE)
    fc_5_3:[ {on:'veinDot',do:[{extendDot:3}]}, {on:'dotOut',if:{tag:'vein'},more:1.0} ],                  // Burst Deep (PICK ONE)
    fc_10_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                        // Seep
    fc_6_2:[ {on:'out',if:{casting:VB},more:R(0.03)}, {on:'dotOut',if:{tag:'vein'},more:R(0.03)} ],        // Spray
    fc_7_3:[ {on:'dotTick',if:{tag:'vein'},do:[{heal:{pct:R(0.03),of:'hit'}}]} ],                          // Deep Veins
    fc_9_3:[ {on:'dotOut',if:{fn:'hold'},more:R(0.03)} ],                                                  // Hold Fast the Line
    fc_10_1:[ {on:'teamHeal',if:{who:'enemy',unitWithin:3},less:R(0.02)} ],                                // Scarred Ground
    fc_10_4:[ {param:'rc.dw',add:R(0.4)} ],                                                                // Dark Water (the scan)
    fc_11_1:[ {stat:{immovable:1},if:{fn:'hold'}} ],                                                       // Ferrow Stone
    fc_11_2:[ {stat:{aspd:R(0.006)},per:'bl4'} ],                                                          // Bleeding Line
    fc_12_1:[ {stat:{hp:R(0.02)},if:{fn:'hold'}} ],                                                        // Held for Six Hours
    fc_12_2:[ {on:'out',if:{stackMin:{bln:5}},more:R(0.02)} ],                                             // Reaping Line
    fc_12_4:[ {on:'teamIn',if:{targetHas:'rc',srcIs:'ally'},more:R(0.02)} ],                               // Flood Bank
    fc_13_2:[ {on:'tick',if:{stackMin:{bnr:5}},do:[{window:'xh',dur:5,cd:25},{fn:'crossing'}]},           // The Crossing Holds (SIGNATURE)
              {on:'dotOut',if:{targetHas:'xbl'},more:1.0} ],
    /* ============================== THE BOTTLE ============================== */
    bt_1_1:[ {stat:{aspd:R(0.02)},per:'dose'} ],                                                           // Trench Bottle
    bt_1_3:[ {stat:{crit:R(0.01)},if:{stackMin:{pace:1}}} ],                                               // Quick Hands
    bt_1_4:[ {stat:{move:R(0.005),aspd:R(0.003)},per:'pace'} ],                                            // Can't Stop
    bt_2_1:[ {stat:{atk:R(0.01)},per:'dose'} ],                                                            // Strong Brew
    bt_2_4:[ {param:'ten.km',add:R(0.05)} ],                                                               // Keep Moving (the 'ten' always row, at 10 Pace)
    bt_3_1:[ {param:'dose.max',add:1}, {param:'dose.free4',add:1} ],                                       // Second Bottle
    bt_2_2:[ {stat:{aspd:R(0.01)}} ],                                                                      // Unrelenting Edge
    bt_3_4:[ {on:'in',less:R(0.002),per:'pace'} ],                                                         // Trench Run
    bt_4_1:[ {param:'dose.cost',add:R(-0.0004)} ],                                                         // Iron Stomach
    bt_n1:[ {param:'pace.slow',add:1}, {param:'dose.hold',add:1,req:'fc_1_1'} ],                           // One for the Crossing (LINK)
    bt_4_3:[ {on:'out',if:{casting:CR},more:R(0.04)}, {on:'dotOut',if:{tag:'reap'},more:R(0.04)} ],        // Fast Reap
    bt_4_4:[ {stat:{atk:R(0.002)},per:'pace'} ],                                                           // Blood Up
    bt_5_1:[ {param:'ten.all',add:R(0.04)} ],                                                              // Shakes It Off (up to 20%)
    bt_5_2:[ {stat:{aspd:{rk:'bt_1_1',r:0.02}},per:'dose'}, {param:'dose.x2',add:1} ],                    // Drink Deep (PICK ONE): twice the speed, twice the cost
    bt_5_3:[ {param:'dose.dur',add:6}, {param:'dose.sip',add:1} ],                                         // Sip Slowly (PICK ONE)
    bt_5_4:[ {param:'pace.wait',add:R(1)} ],                                                               // Never Pause
    bt_6_1:[ {stat:{lifesteal:R(0.01)},per:'dose'} ],                                                      // Shaking Hands
    bt_6_2:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                     // Bottle Rage (under Drink Deep: its prerequisite)
    bt_6_4:[ {stat:{move:R(0.03)}} ],                                                                      // Ground Eater
    bt_7_1:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},every:3,do:[{dmg:{pct:R(0.1),of:'hit'},on:{team:'enemy',of:'target',within:2,n:1,skip:'target'}}]} ],   // Swing Through
    bt_7_3:[ {on:'in',less:R(0.01),per:'dose'} ],                                                          // Slow Burn (under Sip Slowly: its prerequisite)
    bt_7_4:[ {on:'cast',skill:RB,do:[Object.assign({stack:'pace',add:3},P10),{fn:'swingNow'}]},          // Follow Through
             {on:'hit',if:{auto:true},do:[{fn:'ftDone'}]} ],
    bt_9_2:[ {on:'out',if:{stackMin:{dose:3}},more:R(0.02)} ],                                             // Running Hot
    bt_9_4:[ {on:'out',if:{auto:true,fn:'ftNext'},more:R(0.05)} ],                                         // No Breath Between
    bt_10_1:[ {on:'doseOut',do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                                       // Last Swallow
    bt_10_2:[ {on:'out',if:{casting:VB},more:R(0.03),per:'dose'}, {on:'dotOut',if:{tag:'vein'},more:R(0.03),per:'dose'} ],   // Dosed Blade
    bt_10_4:[ {stat:{crit:R(0.01)},if:{stackMin:{pace:10}}} ],                                             // Gone Before Noon (1% per rank: the crit-chance cap)
    bt_11_1:[ {param:'dose.keep',add:1} ],                                                                 // Bottle Kept (the always rows)
    bt_11_2:[ {on:'pace10',do:[{stack:'cob',add:1}]}, {stat:{atk:R(0.01)},per:'cob'} ],                   // Chain of Blows
    bt_11_3:[ {stat:{cdRate:R(0.01)},to:'self',if:{stackMin:{dose:1}}} ],                                  // Stimulant
    bt_12_1:[ {on:'wave',do:[{fn:'doseGain',n:R(1)}]} ],                                                   // Red Morning
    bt_12_2:[ {on:'out',if:{stackMin:{pace:10,dose:1}},more:R(0.02)}, {on:'dotOut',if:{stackMin:{pace:10,dose:1}},more:R(0.02)} ],   // Unwilling to Stop
    bt_12_3:[ {on:'in',less:R(0.005),per:'dose'} ],                                                        // Bad Bottle
    bt_12_4:[ {on:'hit',if:{auto:true,crit:true,targetTeam:'enemy'},do:[Object.assign({stack:'pace',add:R(1)},P10)]} ],   // Quick Feet
    bt_13_2:[ {on:'pace10',if:{stackMin:{dose:3}},do:[{window:'fu',dur:6,cd:25},{fn:'fuOn'}]},            // Fast and Unwilling (SIGNATURE)
              {on:'end:fu',do:[{fn:'fuOff'}]}, {on:'waveEnd',do:[{window:'fu',end:true},{fn:'fuOff'}]},
              {stat:{aspd:1},per:'fu'},                                                                    //   Unrelenting's attack speed again (the window's n)
              {on:'hit',if:{auto:true,window:'fu'},do:[{fn:'doseRefresh'}]} ]
  },
  fn:{
    foes(A,T,u){ const U=A.eng().units(); for(let i=0;i<U.length;i++){ const x=U[i]; if(x.alive&&x.team!==u.team&&!x._dropHidden) return true; } return false; },
    hold(A,T){ return !!T.s.hold; },
    /* Grown Blade: the target has a larger share of its HP left than he has */
    grown(A,T,u,c){ const t=c.tgt; return !!t&&t.maxHp>0&&u.maxHp>0&&t.hp/t.maxHp>u.hp/u.maxHp; },
    /* Old Wounds Open: each whole 10% of his HP missing, up to 5 */
    wounds(A,T,u,c,a){ const k=Math.min(5,Math.floor((1-u.hp/Math.max(1,u.maxHp))*10+1e-9)); if(k>0) c.amt*=1+a.x*k; },
    /* ---- Paid Out ---- */
    rbT(A,T,u,c){ T.s.rbT=c.tgt; },
    /* Reckless Blow's cost (the 'num' hook 'reckCost', called right before the game takes it off his HP; c.amt = 6% of his max HP): Bigger Price adds 1% of
       his max HP per rank, All In doubles it; Throw It Anyway deals it to the Blow's target; Pay in Installments takes nothing now and drains it over 4 s;
       otherwise what it really takes (it never takes him below 1 HP) is written down as Paid Out */
    cost(A,T,u,c){ const P=T.P; let x=c.amt+(P['cost.add']||0)*u.maxHp; x*=1+(P['cost.mul']||0);
      if(T.r.pr_3_1){ const t=T.s.rbT; T.s.rbT=null; if(t&&t.alive) A.hurt(T,u,t,x,'#b03a3a'); }
      if(P['cost.inst']){ const d=T.s.dr||(T.s.dr={left:0,rate:0}); d.left+=x; d.rate=d.left/4; A.acts(T,u,[{window:'drain',dur:4}],c); c.amt=0; return; }
      c.amt=x; addPaid(A,T,u,c,Math.max(0,Math.min(x,u.hp-1))); },
    draining(A,T){ return !!(T.s.dr&&T.s.dr.left>0); },
    drain(A,T,u,c){ const d=T.s.dr, x=Math.min(d.left,d.rate*(c.dt||0)); d.left-=x; if(d.left<1e-9) d.left=0; const p=Math.max(0,Math.min(x,u.hp-1)); if(p>0){ u.hp-=p; addPaid(A,T,u,c,p); } },
    paidAdd(A,T,u,c,a){ addPaid(A,T,u,c,(a.pct||0)*u.maxHp); },
    paidReset(A,T,u){ T.s.paid=0; A.stSet(T,u,'steps',0); },
    paidAtLeast(A,T,u,c,a){ const want=Math.min(10,a.steps||0)*0.1*u.maxHp; if((T.s.paid||0)<want) addPaid(A,T,u,c,want-(T.s.paid||0)); },
    /* What It Cost: every enemy within 3 m takes 50% of the HP his Paid Out holds, he heals half of that, and Paid Out empties */
    payBack(A,T,u,c){ const p=T.s.paid||0; if(!(p>0)) return; A.acts(T,u,[{dmg:p*0.5,on:{team:'enemy',within:3},color:'#b03a3a'},{heal:p*0.25}],c); T.fn.paidReset(A,T,u); },
    /* ---- one walk over the enemies a tick: Holding (enemies within 3 m body to body; One for the Crossing: each Dose counts as one, with at least 2 real),
       the Red Current (his bleed on it, or a talent caught it; Dark Water: it stays that long after the bleed), Red Water's "moving away", Nobody Passes, and
       how many enemies carry his bleed (within 4 m; on the field; within Crimson Reap's 6.5 m, centre to body edge) ---- */
    scan(A,T,u){ const E=A.eng(), U=E.units(), M=E.METER(), s=T.s, ub=E.bodyR(u), dw=T.P['rc.dw']||0, rw=!!T.r.fc_1_4, np=!!T.P.np&&s.hold;
      let near=0, b4=0, bn=0, br=0;
      for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive||x.team===u.team||x._dropHidden) continue;
        const d=E.dist(u,x), xb=E.bodyR(x), g=(d-ub-xb)/M, bl=A.hasDot(u,x,true);
        if(g<3) near++;
        if(bl){ bn++; if(g<4) b4++; if((d-xb)/M<=6.5) br++; if(dw>0) A.setMark(T,u,x,'rcx',{dur:dw,longest:true}); }
        const inRC=bl||!!A.markOf(u,x,'rcx'), has=!!A.markOf(u,x,'rc'); if(inRC&&!has) A.setMark(T,u,x,'rc',{}); else if(!inRC&&has) A.clearMark(u,x,'rc');
        if(rw){ const aw=inRC&&x.px!=null&&((x.x-x.px)*(x.x-u.x)+(x.y-x.py)*(x.y-u.y))>1e-9, ha=!!A.markOf(u,x,'rcA'); if(aw&&!ha) A.setMark(T,u,x,'rcA',{}); else if(!aw&&ha) A.clearMark(u,x,'rcA'); }
        if(np&&g<3&&x.target!==u&&x.px!=null&&(x.x!==x.px||x.y!==x.py)) A.acts(T,u,[{slow:0.30,dur:1,on:'target'}],{u,tgt:x}); }
      const dh=(T.P['dose.hold']&&near>=2)?A.stGet(T,'dose'):0, eff=near+dh;
      s.hold=eff>=3||A.winOn(T,'xh'); A.stSet(T,u,'hx',s.hold?Math.max(0,Math.min(5,eff)-2):0);
      A.stSet(T,u,'bl4',b4); A.stSet(T,u,'bln',bn); A.stSet(T,u,'bnr',br); },
    /* Gathered In: the enemies this Crimson Reap struck; after it, each takes 0.6% per rank of its hit for each enemy struck (up to 5) */
    gather(A,T,u,c){ (T.s.gat||(T.s.gat=[])).push([c.tgt,c.amt||0]); },
    gathered(A,T,u,c,a){ const L=T.s.gat||[]; T.s.gat=null; const n=Math.min(5,L.length); for(const [t,h] of L) if(t&&t.alive) A.hurt(T,u,t,h*a.x*n,'#ffa657'); },
    /* The Crossing Holds: Crimson Reap again at once in a full circle (6.5 m from his centre to the body edge, 340% of his attack at his ultimate's level,
       Wide Reap and Fast Reap included, through armor; and its own bleed, 30% of his attack a second for 4 s, his); every enemy struck is pulled to him,
       caught in the Red Current and bleeds twice as hard for 5 s */
    crossing(A,T,u,c){ const E=A.eng(), M=E.METER(), lv=(u.skillLv&&u.skillLv[0])||1, sm=E.skillMul?E.skillMul(lv):1;
      const hit=(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*sm*E.rage()*3.4*(1+0.03*(T.r.fc_3_2||0))*(1+0.04*(T.r.bt_4_3||0));
      for(const x of E.units().slice()){ if(!x.alive||x.team===u.team||x._dropHidden||E.dist(u,x)-E.bodyR(x)>6.5*M) continue;
        A.hurt(T,u,x,hit*E.defMul(u,x,'phys'),'#ffa657'); if(!x.alive) continue;
        E.pushDot(x,(u.dmg||0)*0.3,4,1,BLEED,u); const d=x.dots[x.dots.length-1]; if(d){ d._talO=u.uid; d._talK='reap'; A.run(T,u,'reapDot',Object.assign({},c,{tgt:x,dot:d})); }
        A.acts(T,u,[{pull:'target',to:'self',secs:0.3},{mark:'rcx',on:'target',dur:5,longest:true},{mark:'xbl',on:'target',dur:5,longest:true}],Object.assign({},c,{tgt:x})); } },
    /* ---- Pace ---- */
    swung(A,T){ T.s.lastAtk=now(A); },
    /* Pace drops 2 a second (One for the Crossing, with 3 or more Doses: 1) once he has not landed a basic attack for 2.5 s (Never Pause: longer);
       a stun (the game's root is its stun field) or a fear on him clears it, except while Fast and Unwilling holds him */
    paceTick(A,T,u,c){ const s=T.s, n=A.stGet(T,'pace'); if(!(n>0)){ s.pAcc=0; return; }
      if(((u.stunned||0)>0||(u.fearT||0)>0)&&!A.winOn(T,'fu')){ A.stSet(T,u,'pace',0); s.pAcc=0; return; }
      if(now(A)-(s.lastAtk||0)<2.5+(T.P['pace.wait']||0)){ s.pAcc=0; return; }
      s.pAcc=(s.pAcc||0)+((T.P['pace.slow']&&A.stGet(T,'dose')>=3)?1:2)*(c.dt||0); if(s.pAcc>=1){ const k=Math.floor(s.pAcc+1e-9); s.pAcc-=k; A.stSet(T,u,'pace',n-k); } },
    /* Follow Through: the Blow counts as a swing for Pace's clock, and his next basic attack comes at once (No Breath Between reads it) */
    swingNow(A,T,u){ T.s.lastAtk=now(A); u.atkCd=0; T.s.ft=true; },
    ftNext(A,T){ return !!T.s.ft; },
    ftDone(A,T){ T.s.ft=false; },
    /* ---- Doses ---- */
    doseGain(A,T,u,c,a){ const ds=T.s.ds||(T.s.ds=[]), mx=A.stMax(T,u,'dose'), end=now(A)+doseDur(T); let n=(a&&a.n!=null)?Math.round(a.n):1;
      for(;n>0;n--){ if(ds.length<mx) ds.push(end); else if(ds.length){ let j=0; for(let i=1;i<ds.length;i++) if(ds[i]<ds[j]) j=i; ds[j]=end; } } doseSync(A,T,u); },
    doseRefresh(A,T,u){ const ds=T.s.ds||[], end=now(A)+doseDur(T); for(let i=0;i<ds.length;i++) ds[i]=end; },
    /* each Dose runs out on its own clock ('doseOut' for each); while he holds any they cost 0.3% of his max HP a second each (Iron Stomach: less;
       Drink Deep: twice; Second Bottle: the fourth is free; Sip Slowly: nothing above 50% HP; Fast and Unwilling: nothing), never below 1 HP */
    doseTick(A,T,u,c){ const ds=T.s.ds; if(!ds||!ds.length) return; const t=now(A); let out=0;
      for(let i=0;i<ds.length;i++) if(t>=ds[i]-1e-9){ ds.splice(i--,1); out++; }
      if(out){ doseSync(A,T,u); for(let k=0;k<out;k++) A.run(T,u,'doseOut',{u,tgt:u}); }
      if(!ds.length||A.winOn(T,'fu')||(T.P['dose.sip']&&u.hp>0.5*u.maxHp)||!(u.hp>1)) return;
      const n=T.P['dose.free4']?Math.min(3,ds.length):ds.length, per=Math.max(0,0.003+(T.P['dose.cost']||0))*(T.P['dose.x2']?2:1);
      u.hp=Math.max(1,u.hp-u.maxHp*per*n*(c.dt||0)); },
    doseKeep(A,T){ const t=now(A); T.s.dsK=(T.s.ds||[]).map(e=>e-t).filter(r=>r>0); },
    doseWave(A,T,u){ const t=now(A); T.s.ds=(T.P['dose.keep']&&T.s.dsK)?T.s.dsK.map(r=>t+r):[]; T.s.dsK=null; doseSync(A,T,u); },
    /* ---- shorter controls on him: Shakes It Off every control (up to 20%), Keep Moving at 10 Pace; together never more than 30% shorter ---- */
    ten(A,T,u,c){ const a=Math.min(0.20,T.P['ten.all']||0), b=A.stGet(T,'pace')>=10?(T.P['ten.km']||0):0; c.amt*=1-Math.min(0.30,1-(1-a)*(1-b)); },
    /* ---- Fast and Unwilling: 6 s of the game's own Unstoppable (u.stunImmune: no stun, root or fear), Unrelenting's attack speed doubled (the window's n is
       the extra speed: (1 + 0.5 pm) / (1 + 0.25 pm) - 1, pm = his passive's level multiplier), his Doses refreshed now and by every basic attack ---- */
    fuOn(A,T,u){ const w=T.s.w.fu, pm=u.passMul||0; if(w) w.n=pm>0?(0.25*pm)/(1+0.25*pm):0; if(T.s.suW==null) T.s.suW=!!u.stunImmune; u.stunImmune=true; u.stunned=0; u.fearT=0; T.fn.doseRefresh(A,T,u); },
    fuOff(A,T,u){ if(T.s.suW!=null){ u.stunImmune=T.s.suW; T.s.suW=null; } }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/19 - CARN - talent decisions.md) */
  ruling:{}
};
