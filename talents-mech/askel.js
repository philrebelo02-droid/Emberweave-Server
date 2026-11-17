/* ASKEL GREATBROW - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section named for Askel: what he added)
   His real kit (the code, not the tooltip wording; a Tank, melee, his skills read Attack):
   - Standard Crash ('interruptslam', green, cd 8, delivered as a form around HIM): every enemy within 3.2 m of him, centre to centre, takes 130% of his
     attack and a silence through ccApply (the area table's 1.5 s x 0.7 = 1.05 s). A silence cancels a cast under way (castTick): that is the interrupt.
   - Rallying Ground ('banner', blue, cd 10): ONE pulse at the cast. Every ally within 6 m of him (centre; himself too) gets the game's one skill
     damage-reduction slot drMul = min(drMul, 0.82 - 0.001 x (level - 1)) (27.9% at level 100), attack speed x1.22 and the timed control-resist bonus
     25%, all for 6 s. No zone exists in the game: "inside Rallying Ground" is a talent circle (zone 'rg') where it was planted, for its 6 s.
   - Unshaken Herd (passive 'unshaken'): once a second, every OTHER ally under a stun, fear, silence or knock-up gives him 4 x passive-level energy and
     gets the skill slot drMul = min(drMul, 0.75) for 1.5 s. The 'pass' hook runs right after it has written that cover (ctx.tgt = the ally). That
     ally is "held" (mark 'held', 1.5 s).
   - March of the Greatbrow (ultimate 'charge'; ULT_DEF.charge mul 1.8, radius 5 m, stun 1.0 -> the area table's 2 s x 0.7 = 1.4 s; HERO_ULT_ART.askel
     adds allyShield 0.12 and knockAside 2 m): at the cast every ally (himself too) gets a shield of 12% of ITS max HP for 5 s (the larger stays);
     he dashes to the farthest enemy; every enemy on the path (1.4 m each side, outside the landing circle) is knocked 2 m aside as he reaches it
     (no damage: no pathHit); on arrival every enemy within 5 m of the landing point takes 180% of his attack x skill level and is stunned.
     The slam is on the dash clock: landPre / land around it ('casting' is 'charge'), the 'pass' hook ('knockaside') at each knock.
   Herd, Steadfast, Breakwater, Remembrance, Muster, the Colours, Rut, Gored and Flattened exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/14 - ASKEL GREATBROW - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const SLAM='interruptslam', BAN='banner', CHG='charge', UH='unshaken', KNOCK='knockaside';
const ALLY_HIT={srcTeam:'enemy',targetTeam:'ally'};                         // an enemy's hit on one of his allies (teamIn: never himself)
const ALLIES={team:'ally',others:true};                                     // his allies (heroes, not himself)
const HOLDS=['stunned','fearT','silencedT','_sleepT'];
/* the states several talents read: their bookkeeping runs when any of these is learned */
const HERD=['fd_1_1','fd_2_1','fd_3_1','fd_4_1','fd_5_2','fd_8_1','fd_10_1','fd_11_2','fd_12_1','fd_12_2','fd_13_2'];
const SF=['fd_1_4','fd_3_4','fd_6_4','fd_7_4','fd_9_4','fd_10_4','fd_13_2'];
const HELD=['fd_5_3','fd_6_3','fd_7_1','ch_12_3'];
const DRG=['fd_1_1','fd_10_1','st_1_3','st_3_1'];                           // his stacking damage reduction: one capped group (see myDr)
const TEN=['fd_5_1','fd_12_3','st_8_2','st_12_2','ch_8_3'];                // his control-shortening talents: one capped group (see ten)
const REM=['st_1_1','st_3_1','st_6_1','st_7_1','st_9_1','st_9_2','st_11_1','st_12_1'];
const MUS=['st_1_3','st_2_3','st_6_3','st_8_3','st_11_3','st_12_3','st_13_3','st_7_4'];
const RGZ=['st_n1','st_5_2','st_5_3','st_6_2','st_9_3','fd_7_2','st_1_4'];   // the talent circle of Rallying Ground
const RL=['st_1_4','st_5_2'];                                               // the allies a Rallying Ground rallied
const RUT=['ch_1_1','ch_2_1','ch_3_1','ch_4_1','ch_6_1','ch_8_1','ch_10_1','ch_13_2'];
const FLAT=['ch_1_4','ch_3_4','ch_5_4','ch_7_4','ch_10_4','ch_12_4','ch_9_4','ch_13_2'];
const colDur=a=>4+(a||0);                                                   // the Colours: 4 s + Bright Colours
/* Rallying Ground's own three buffs on one ally, as the skill writes them (the one damage-reduction slot, attack speed, the timed control-resist bonus), at
   strength k for d seconds. The numbers are the last cast's options (its level, Drummer's Beat, Mustered Strength), else his kit's */
function rally(A,T,u,x,k,d){ const E=A.eng(); if(!x||!x.alive||!(d>0)) return; const o=T.s.rgo||u.blueAb; if(!o) return;
  const lv=(u.skillLv&&u.skillLv[2])||1, dr=E.skLvNum?E.skLvNum('banner',o,lv):(o.dr||0.82), cut=(1-dr)*k, hs=1+((o.haste||1.2)-1)*k;
  x.drMul=Math.min(x.drMul||1,Math.max(0.05,1-cut)); x.drT=Math.max(x.drT||0,d); x.hasteMul=Math.max(x.hasteMul||1,hs); x.hasteT=Math.max(x.hasteT||0,d);
  if(E.ctrlBonus) E.ctrlBonus(x,(o.ctrl||0.25)*k,d,0.85); }
function colours(A,T,u,c,x,d){ if(!x||!x.alive) return; A.acts(T,u,[{mark:'col',on:'target',dur:d,longest:true},{window:'colW',dur:d,longest:true}],Object.assign({},c,{tgt:x})); }
module.exports={
  hero:'askel',
  casting:true,                         // rows ask which of his skills a hit, a stun or a silence comes from
  states:{
    herd:{max:4},                                                                  // his Herd now (set each tick)
    sf:{max:5,dur:P('sf.dur',8),gain:'sfGain'},                                    // Steadfast: all lapse 8 s after the last
    rem:{max:P('rem.max',4)},                                                      // Remembrance (this fight)
    mus:{max:P('mus.max',10),wave:'reset',gain:'musGain'},                         // Muster (this wave)
    rut:{max:6,dur:P('rut.dur',10)},                                               // Rut: all lapse 10 s after the last
    gore:{unit:true,max:2,dur:P('gore.dur',5)}                                     // Gored on each enemy (stacks twice)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',reqAny:HERD,do:[{fn:'herd'}]},                                                                   // Herd: allies within 4 m (Close the Ranks: farther), max 4
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                      // Stand in the Deep, Old Bull, Muster, Never Forgotten: one capped group
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                     // Current-Proof, Deaf to Fear, Bearer's Calm, Steady Grip, Thick Neck: one capped group
    {on:'pass',skill:UH,reqAny:HELD,do:[{mark:'held',on:'target',dur:1.5}]},                                    // held: an ally Unshaken Herd is covering (its 1.5 s)
    {on:'pass',skill:UH,reqAny:SF,do:[{stack:'sf',add:1},{stack:'sf',touch:true}]},                             // Steadfast: each time Unshaken Herd covers an ally
    {on:'death',reqAny:REM,if:{who:'ally'},do:[{stack:'rem',add:1}]},                                           // Remembrance: each ally hero that falls this fight
    {on:'cast',skill:BAN,do:[{fn:'rgO'}]},                                                                      // the cast's options (for the rallies his talents give)
    {on:'cast',skill:BAN,reqAny:MUS,do:[{stack:'mus',add:{units:{team:'ally',others:true,withinOpt:'radius'}}}]},   // Muster: each ally it rallies
    {on:'cast',skill:BAN,reqAny:RL,do:[{fn:'rgDone'},{mark:'rl',on:{team:'ally',others:true,withinOpt:'radius'}}]},   // the allies it rallied (the last ground's list is dropped)
    {on:'cast',skill:BAN,reqAny:RGZ,unless:'st_5_2',do:[{zone:'rg',at:'self',radiusPx:{opt:'radius'},dur:{opt:'dur',d:6},centre:true,ends:'rgEnd'}]},   // where it was planted, for its time
    {on:'cast',skill:BAN,req:'st_5_2',do:[{zone:'rg',at:'self',radiusPx:{opt:'radius'},dur:{opt:'dur',d:6},centre:true,ends:'rgEnd',follow:'self'}]},     //   Carry It Forward: it moves with him
    {on:'hit',reqAny:RUT,if:{casting:SLAM,targetTeam:'enemy'},do:[{stack:'rut',add:1},{stack:'rut',touch:true}]},   // Rut: each enemy Standard Crash hits
    {on:'kit',skill:CHG,reqAny:RUT,do:[{fn:'rutSpend'}]},                                                       //   his next March spends them all
    {on:'land',skill:CHG,do:[{window:'rutW',end:true},{window:'fc',end:true}]},
    {on:'pass',skill:KNOCK,reqAny:FLAT,do:[{fn:'flatten'}]},                                                    // Flattened: each enemy March knocks aside
    {on:'kit',skill:SLAM,reqAny:['ch_2_2'],do:[{fn:'crashTgt'}]}                                                // the target Standard Crash is cast at (Gore)
  ],
  talents:{
    /* ============================== THE FORD ============================== */
    fd_1_1:[ {param:'dr.herd',add:R(0.01)},                                                                    // Stand in the Deep: him (in myDr) ...
             {on:'teamIn',if:Object.assign({targetHas:'hd'},ALLY_HIT),less:R(0.005),per:'herd'} ],             //   ... and the Herd
    fd_2_3:[ {on:'out',if:{casting:SLAM},more:R(0.04)} ],                                                      // Banner Pole
    fd_1_4:[ {stat:{atk:R(0.01)},per:'sf'} ],                                                                   // Hold Steady (Steadfast: the always row)
    fd_2_1:[ {param:'herd.m',add:R(0.5)} ],                                                                     // Close the Ranks
    fd_2_2:[ {on:'moved',if:{who:'ally',noWindow:'bwcd',fn:'bwNear'},do:[{unmove:'unit'},{window:'bwcd',dur:P('bw.cd',10)},   // Breakwater
               {shield:{pct:R(0.01),of:'maxHp'},on:'self',dur:6,mode:'max'},{emit:'bw'}]} ],
    fd_3_1:[ {stat:{ctrl:0.15},to:{team:'ally',has:'hd'},if:{stackMin:{herd:4}}} ],                            // Calves Behind
    fd_4_1:[ {stat:{atk:R(0.003)},per:'herd'} ],                                                                // Shoulder to Shoulder
    fd_3_4:[ {param:'sf.dur',add:R(1)} ],                                                                       // Unshaken Resolve
    fd_n1:[  {on:'pass',skill:UH,do:[{mark:'cf',on:'target',dur:3}]}, {on:'teamIn',if:Object.assign({targetHas:'cf'},ALLY_HIT),less:0.05},   // Colours at the Ford (LINK)
             {on:'pass',skill:UH,req:'st_1_4',do:[{fn:'col',of:'target'}]}, {on:'bw',req:'st_1_4',do:[{fn:'col',of:'unit'}]} ],   //   with Carry the Colours
    fd_4_2:[ {param:'bw.cd',add:R(-1)} ],                                                                       // Riverbed
    fd_4_3:[ {on:'kit',skill:SLAM,opt:{radius:{addM:R(0.2)}}} ],                                                // Wide Crash
    fd_8_3:[ {on:'in',if:{crit:true},less:R(0.02)} ],                                                           // Hard Hooves
    fd_5_1:[ {param:'ten.all',add:R(0.04)} ],                                                                   // Current-Proof (in ten)
    fd_5_2:[ {on:'tick',if:{stackMin:{herd:2}},do:[{timer:'_gearImmovableT',min:0.1,on:'self'}]} ],             // Stand in the Water (PICK ONE)
    fd_5_3:[ {stat:{move:0.15},if:{some:{team:'ally',others:true,has:'held'}}} ],                              // Wade Across (PICK ONE)
    fd_5_4:[ {on:'pass',skill:UH,do:[{fn:'cover',by:R(0.01)}]} ],                                               // Bellow
    fd_6_2:[ {on:'bw',do:[{dmg:{pct:R(0.10),of:'atk'},on:{team:'enemy',of:'unit',within:3},def:'phys',tag:'wave'}]} ],   // Breaking Wave
    fd_6_3:[ {on:'in',if:{some:{team:'ally',others:true,has:'held'}},less:R(0.02)} ],                          // Swift Ford
    fd_6_4:[ {on:'wave',do:[{stack:'sf',atLeast:R(2)}]} ],                                                      // Herd Instinct
    fd_7_1:[ {on:'in',less:R(0.01),per:{units:{team:'ally',others:true,has:'held',within:6},max:3}} ],         // Leaning Weight (up to 3 allies)
    fd_7_2:[ {on:'cast',skill:BAN,do:[{window:'bwcd',end:true}]},                                               // The Deepest Water: Breakwater ready again
             {on:'tick',if:{zone:'rg'},do:[{timer:'_gearImmovableT',min:0.1,on:{team:'ally',others:true,inZone:'rg'}}]} ],   //   and nobody inside can be moved
    fd_7_3:[ {on:'out',if:{casting:CHG},more:R(0.03)} ],                                                       // Moose Charge
    fd_7_4:[ {on:'in',if:{stackMin:{sf:5}},less:R(0.015)} ],                                                    // Unbowed
    fd_8_1:[ {on:'tick',period:1,if:{stackMin:{herd:1}},do:[{heal:{pct:R(0.002),of:'tgtMaxHp'},on:{team:'ally',has:'hd'}}]} ],   // Herd Warmth
    fd_9_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                  // Antler Tip
    fd_9_2:[ {on:'teamCc',if:{who:'ally',unitWithin:4},do:[{fn:'calm',by:R(0.02)}]} ],                          // Calm the Herd
    fd_9_4:[ {on:'pass',skill:UH,icd:8,if:{stackMin:{sf:5}},do:[{fn:'free'}]} ],                                // The Nineteen
    fd_10_1:[ {param:'dr.old',add:R(0.01)} ],                                                                   // Old Bull (in myDr)
    fd_10_2:[ {on:'kit',skill:BAN,opt:{dur:{add:R(0.3)}}} ],                                                    // Lean on the Banner
    fd_10_4:[ {on:'sfGain',do:[{heal:{pct:R(0.005),of:'maxHp',k:1},on:'self'}]} ],                              // Stand Your Ground
    fd_11_1:[ {on:'kit',skill:SLAM,opt:{silence:{add:R(0.1),ccRaw:true}}} ],                                   // Big Brow (its full 0.1 s)
    fd_11_2:[ {on:'cast',skill:CHG,do:[{mark:'mtf',on:{team:'ally',others:true,within:4},dur:6},{fn:'mtfShield'}]} ],   // March Through the Ford
    fd_11_3:[ {on:'ccHit',if:{cc:['silencedT'],targetTeam:'enemy'},do:[{mark:'shs',on:'target',dur:3}]}, {on:'in',if:{srcHas:'shs'},less:R(0.02)} ],   // Stubborn Head
    fd_12_1:[ {stat:{hp:R(0.01)},per:'herd'} ],                                                                 // Elder Bull
    fd_12_2:[ {on:'teamIn',if:Object.assign({targetHas:'hd',selfHpAbove:0.5},ALLY_HIT),less:R(0.01)} ],         // Something to Lean On
    fd_12_3:[ {param:'ten.fear1',add:R(0.10)} ],                                                                // Deaf to Fear (in ten)
    fd_12_4:[ {on:'tick',do:[{weaken:'slowMul',by:R(0.08)}]} ],                                                 // Wet Fur
    fd_13_2:[ {on:'teamIn',icd:25,if:Object.assign({targetHas:'hd',fn:'drop25'},ALLY_HIT),do:[{window:'hask',dur:4},{stack:'sf',add:5},{stack:'sf',touch:true}]},   // The Ford at Hask (SIGNATURE)
              {on:'teamIn',if:Object.assign({window:'hask',targetHas:'hd'},ALLY_HIT),less:0.5},
              {on:'teamCc',if:{window:'hask',unitHas:'hd',cc:HOLDS},do:[{fn:'redirect'}]},
              {on:'tick',if:{window:'hask'},do:[{timer:'_gearImmovableT',min:0.1,on:{team:'ally',has:'hd'}},{fn:'freeHerd'}]} ],

    /* ============================== THE STANDARD ============================== */
    st_1_1:[ {stat:{atk:R(0.01)},per:'rem'}, {stat:{atk:R(0.01)},to:ALLIES,per:'rem',if:{stackMin:{rem:1}}} ], // Remember Them (him and his allies)
    st_1_3:[ {param:'dr.mus',add:R(0.004)} ],                                                                   // Muster (in myDr; Muster itself: the always rows)
    st_1_4:[ {on:'rgEnd',do:[{fn:'colRl'}]}, {stat:{atk:R(0.02)},to:{team:'ally',has:'col'},if:{window:'colW'}} ],   // Carry the Colours
    st_2_3:[ {param:'mus.max',add:R(2)} ],                                                                      // Call the Company (up to 16)
    st_2_4:[ {param:'col.dur',add:R(0.5)} ],                                                                    // Bright Colours
    st_3_1:[ {param:'dr.rem',add:R(0.01)} ],                                                                    // Never Forgotten (in myDr)
    st_4_2:[ {on:'kit',skill:BAN,opt:{radius:{addM:R(0.3)}}} ],                                                 // Rally Spread
    st_4_3:[ {on:'kit',skill:BAN,opt:{haste:{add:R(0.02)}}} ],                                                  // Drummer's Beat
    st_3_4:[ {on:'pass',skill:UH,by:'target',icd:4,if:{targetHas:'col'},do:[{shield:{pct:0.05,of:'maxHp'},on:'target',dur:6,mode:'max'}]} ],   // Pass the Pole
    st_5_1:[ {on:'death',if:{who:'ally'},do:[{heal:{pct:R(0.03),of:'maxHp'},on:'self'}]} ],                    // The Last Post
    st_5_2:[ {on:'tick',if:{zone:'rg'},do:[{fn:'cif'}]} ],                                                      // Carry It Forward (PICK ONE; the moving circle: the always row)
    st_5_3:[ {on:'kit',skill:BAN,opt:{dur:{add:2}}}, {on:'teamIn',if:Object.assign({targetIn:'rg'},ALLY_HIT),less:0.05} ],   // Plant the Standard (PICK ONE)
    st_4_4:[ {on:'teamIn',if:Object.assign({targetHas:'col'},ALLY_HIT),less:R(0.01)} ],                        // Colour Guard
    st_6_1:[ {on:'wave',once:'fight',do:[{stack:'rem',add:R(1)}]} ],                                            // Old Company
    st_6_2:[ {stat:{move:R(0.03)},if:{zone:'rg'}} ],                                                            // Forward March
    st_n1:[  {on:'in',if:{zone:'rg'},less:R(0.02)} ],                                                           // Shade of the Standard
    st_6_3:[ {stat:{atk:R(0.002)},per:'mus'} ],                                                                 // Drill
    st_6_4:[ {on:'teamHeal',if:{unitHas:'col'},more:R(0.03)} ],                                                 // Wet Blue Cloth
    st_7_1:[ {on:'out',if:{casting:[SLAM,CHG]},more:R(0.01),per:'rem'} ],                                       // For the Fallen
    st_7_2:[ {on:'out',if:{casting:SLAM},more:R(0.03)} ],                                                      // Crash Down
    st_7_4:[ {on:'cast',skill:SLAM,do:[{fn:'rallyNear'}]},                                                      // Raise the Standard
             {on:'ccHit',if:{casting:SLAM,cc:['silencedT'],talent:false,targetCast:true},do:[{stack:'mus',add:1}]} ],
    st_8_2:[ {param:'ten.sil1',add:R(0.10)} ],                                                                  // Steady Grip (in ten)
    st_8_3:[ {on:'kit',skill:BAN,if:{stackMin:{mus:10}},opt:{dr:{add:R(-0.01)}}} ],                             // Mustered Strength (the skill's own slot)
    st_8_4:[ {stat:{aspd:R(0.02)},to:{team:'ally',has:'col'},if:{window:'colW'}} ],                            // Colours Flying
    st_9_1:[ {on:'teamIn',if:Object.assign({stackMin:{rem:1}},ALLY_HIT),less:R(0.005),per:'rem'} ],             // Nineteen Men
    st_9_2:[ {stat:{crit:R(0.005)},per:{stack:'rem',max:[10,5,10/3,2.5,2]}} ],                                  // Pole Strike (up to 5%)
    st_9_3:[ {on:'cast',skill:BAN,do:[{cleanse:1,on:{team:'ally',others:true,withinOpt:'radius'}}]},           // Fall In
             {on:'tick',if:{zone:'rg'},period:2,do:[{cleanse:1,on:{team:'ally',others:true,inZone:'rg'}}]} ],
    st_10_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                             // Parade Rest
    st_10_4:[ {on:'tick',period:1,if:{window:'colW'},do:[{heal:{pct:R(0.003),of:'tgtMaxHp'},on:{team:'ally',has:'col'}}]} ],   // Hold the Colours
    st_11_1:[ {stat:{lifesteal:R(0.005)},per:'rem',if:{selfHpBelow:0.4}} ],                                     // Bitter Memory
    st_11_3:[ {stat:{atk:R(0.002)},to:{team:'ally',others:true,within:6},per:'mus',if:{stackMin:{mus:1}}} ],    // Company Voice
    st_11_4:[ {on:'teamLethal',if:{unitHas:'cnf'},do:[{atOne:'unit'}]},                                         // Colours Never Fall: held at 1 HP for 2 s
              {on:'teamLethal',once:'wave',if:{unitHas:'col'},do:[{atOne:'unit'},{mark:'cnf',on:'unit',dur:2}]} ],
    st_12_1:[ {param:'rem.max',add:R(1)} ],                                                                     // The Fourth Company (up to 6)
    st_12_2:[ {param:'ten.fear2',add:R(0.10)} ],                                                                // Bearer's Calm (in ten)
    st_12_3:[ {on:'teamIn',if:Object.assign({stackMin:{mus:10},targetWithin:6},ALLY_HIT),less:R(0.01)} ],       // Full Company
    st_12_4:[ {on:'cast',skill:CHG,do:[{fn:'longCol'}]} ],                                                      // Long Colours
    st_13_3:[ {on:'musGain',once:'wave',if:{stackMin:{mus:10}},do:[{fn:'plant'},{ghost:true}]},               // The Banner Had His Face (SIGNATURE)
              {on:'tick',do:[{fn:'stdTick'}]}, {on:'fallenTick',do:[{fn:'stdTick',dead:true}]}, {on:'wave',do:[{fn:'stdEnd'}]} ],

    /* ============================== THE CHARGE ============================== */
    ch_1_1:[ {on:'out',if:{casting:CHG},more:R(0.03),per:'rutW',upTo:0.9} ],                                   // Rut: 3% per Rut spent (the bookkeeping: always rows; up to 90%)
    ch_9_3:[ {on:'land',skill:CHG,do:[{window:'chd',dur:3}]}, {on:'in',if:{window:'chd'},less:R(0.015)} ],     // Charge Hide
    ch_1_4:[ {stat:{move:R(-0.05)},to:{team:'enemy',has:'flat'},if:{window:'flatW'}},                          // Flatten
             {on:'teamIn',if:{targetTeam:'enemy',targetHas:'flat',srcIs:'ally'},more:R(0.02)} ],
    ch_2_1:[ {param:'rut.dur',add:R(3)} ],                                                                      // Season of Rut
    ch_2_2:[ {on:'hit',if:{crit:true,targetTeam:'enemy'},do:[{fn:'gore'}]},                                    // Gore: his critical hits
             {on:'hit',unless:'ch_11_2',if:{casting:SLAM,crit:false,fn:'isCt'},do:[{fn:'gore'}]},              //   and Standard Crash on its target
             {stat:{armor:R(-0.02)},to:{team:'enemy',ust:{gore:1}},per:{ust:'gore'},if:{window:'goreW'}} ],
    ch_3_1:[ {on:'cd',skill:'green',if:{stackMin:{rut:6}},add:-2} ],                                            // Bull's Patience
    ch_8_2:[ {on:'out',if:{crit:true,targetUst:{gore:1}},more:R(0.03)} ],                                       // Gorer
    ch_3_4:[ {param:'flat.dur',add:R(0.5)} ],                                                                   // Trampled
    ch_4_1:[ {stat:{atk:R(0.003)},per:'rut'} ],                                                                 // Snort
    ch_4_2:[ {param:'gore.dur',add:R(0.5)} ],                                                                   // Deep Gore
    ch_4_3:[ {on:'out',if:{casting:SLAM},more:R(0.04)} ],                                                      // Crash Weight
    ch_n1:[  {on:'out',if:{targetHpAbove:0.75},more:R(0.02)} ],                                                 // Lowered Antlers
    ch_8_3:[ {param:'ten.sil2',add:R(0.10)} ],                                                                  // Thick Neck (in ten)
    ch_5_4:[ {on:'teamIn',if:Object.assign({srcHas:'flat'},ALLY_HIT),less:R(0.015)}, {on:'in',if:{srcHas:'flat'},less:R(0.015)} ],   // Broad Path
    ch_6_1:[ {on:'wave',do:[{stack:'rut',atLeast:R(2)}]} ],                                                     // Restless
    ch_6_2:[ {on:'out',if:{targetUst:{gore:1}},more:R(0.015)} ],                                                // Antler Wounds
    ch_6_4:[ {on:'kit',skill:CHG,once:'fight',do:[{window:'fc',dur:3}]}, {on:'out',if:{casting:CHG,window:'fc'},more:R(0.10)} ],   // First Charge
    ch_7_1:[ {on:'kit',skill:SLAM,opt:{silence:{add:R(0.1),ccRaw:true}}} ],                                    // Bellowing Crash (its full 0.1 s)
    ch_7_3:[ {on:'out',if:{casting:CHG},more:R(0.03)} ],                                                       // Charge Weight
    ch_8_1:[ {on:'out',if:{auto:true,stackMin:{rut:3}},more:R(0.03)} ],                                         // Rutting Strength
    ch_5_3:[ {stat:{move:-1},to:{team:'enemy',has:'pin'},if:{window:'pinW'}} ],                                 // Pin to the Ground (PICK ONE; the root itself: in gore)
    ch_5_2:[ {on:'kit',skill:SLAM,do:[{mark:'lt',on:{team:'enemy',ust:{gore:2}},dur:1}]},                      // Lift and Toss (PICK ONE): knocked up = stunned 0.6 s in full
             {on:'hit',if:{casting:SLAM,targetHas:'lt'},do:[{mark:'lt',on:'target',clear:true},{stun:0.6,on:'target'}]} ],
    ch_7_4:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'flat'},if:{window:'flatW'}} ],                        // Dust of the Charge
    ch_9_1:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                  // Bull Strength
    ch_6_3:[ {param:'pin.dur',add:R(0.2)} ],                                                                    // Hold Them Down
    ch_9_4:[ {on:'hit',if:{casting:CHG,targetTeam:'enemy'},do:[{fn:'flatten'},{fn:'gore',set:2}]} ],            // Stampede: the enemies it lands on too
    ch_10_1:[ {on:'rutSpent',do:[{heal:{pct:R(0.005),of:'maxHp',x:'spent'},on:'self'}]} ],                      // Spent Rut
    ch_10_2:[ {stat:{mr:R(-0.01)},to:{team:'enemy',ust:{gore:1}},per:{ust:'gore'},if:{window:'goreW'}} ],       // Splintered Armor
    ch_10_4:[ {on:'out',if:{targetHas:'flat'},more:R(0.02)} ],                                                  // Hunt the Fallen
    ch_11_1:[ {on:'kit',skill:CHG,do:[{fn:'scReset'}]}, {on:'hit',if:{casting:CHG,targetTeam:'enemy'},do:[{fn:'sc',by:R(1)}]} ],   // Second Charge: energy toward the next one
    ch_11_2:[ {on:'hit',if:{casting:SLAM,targetTeam:'enemy'},do:[{fn:'gore'}]},                                 // Crash of Antlers: every enemy it hits
              {on:'ccHit',if:{casting:SLAM,cc:['silencedT'],talent:false,targetCast:true},do:[{fn:'gore',set:2}]} ],   //   an enemy it interrupts twice
    ch_11_3:[ {on:'out',if:{selfHpBelow:0.5},more:R(0.03)} ],                                                   // Bull's Fury
    ch_12_1:[ {on:'kit',skill:CHG,opt:{stun:{add:R(0.1),ccRaw:true}}} ],                                        // Rut Season (its full 0.1 s)
    ch_12_2:[ {on:'kit',skill:SLAM,opt:{radius:{addM:R(0.2)}}} ],                                               // Wide Antlers
    ch_12_3:[ {on:'out',if:{some:{team:'ally',others:true,has:'held'}},more:R(0.03)} ],                         // Herd Anger
    ch_12_4:[ {on:'flatEnd',if:{targetHpBelow:0.3},do:[{stun:R(0.3),on:'target'}]} ],                           // Crushed Underfoot (in full)
    ch_13_2:[ {on:'ccHit',icd:25,if:{casting:SLAM,cc:['silencedT'],talent:false,targetCast:true,stackMin:{rut:6}},do:[{field:'energy',set:100,on:'self'},{window:'gbr',dur:30}]},   // Greatbrow Comes Down the River (SIGNATURE)
              {on:'hit',if:{casting:CHG,targetTeam:'enemy',window:'gbr'},do:[{fn:'flatten'},{fn:'gore',set:2}]},
              {on:'pass',skill:KNOCK,if:{window:'gbr'},do:[{fn:'gore',set:2}]},
              {on:'land',skill:CHG,do:[{window:'gbr',end:true}]} ]
  },
  fn:{
    /* the Herd: his allies (heroes) within 4 m body to body (+ Close the Ranks), the ones March Through the Ford marked first, at most 4, nearest first.
       Each one carries his mark 'hd' while it is Herd; the count is the state 'herd' */
    herd(A,T,u){ const R=4+(T.P['herd.m']||0), near=A.pick(T,u,{team:'ally',others:true,within:R,order:'near'},{u}), L=[];
      if(T.r.fd_11_2) for(const x of A.pick(T,u,{team:'ally',others:true,has:'mtf',order:'near'},{u})) if(L.length<4) L.push(x);
      for(const x of near) if(L.length<4&&L.indexOf(x)<0) L.push(x);
      const old=T.s.hd||[]; for(const x of old) if(L.indexOf(x)<0) A.clearMark(u,x,'hd'); for(const x of L) if(old.indexOf(x)<0) A.setMark(T,u,x,'hd',{});
      T.s.hd=L; A.stSet(T,u,'herd',L.length); },
    /* his stacking damage reduction, ONE group: Stand in the Deep (per Herd), Old Bull (per Herd, below 50% HP), Muster (up to 20%), Never Forgotten
       (up to 20%). Each multiplies; together they take at most 40% off a hit */
    myDr(A,T,u,c){ const P=T.P, h=A.stGet(T,'herd'); let k=1;
      if(P['dr.herd']) k*=1-P['dr.herd']*h;
      if(P['dr.old']&&u.hp<0.5*u.maxHp) k*=1-P['dr.old']*h;
      if(P['dr.mus']) k*=1-Math.min(0.20,P['dr.mus']*A.stGet(T,'mus'));
      if(P['dr.rem']) k*=1-Math.min(0.20,P['dr.rem']*A.stGet(T,'rem'));
      c.amt*=Math.max(0.60,k); },
    /* his control-shortening talents, ONE group: Current-Proof (every control), Deaf to Fear and Bearer's Calm (fears), Steady Grip and Thick Neck
       (silences). Each multiplies; together they shorten one control by at most 40% */
    ten(A,T,u,c){ const P=T.P, f=c.field; let k=1-(P['ten.all']||0);
      if(f==='fearT') k*=(1-(P['ten.fear1']||0))*(1-(P['ten.fear2']||0));
      if(f==='silencedT') k*=(1-(P['ten.sil1']||0))*(1-(P['ten.sil2']||0));
      c.amt*=Math.max(0.60,k); },
    /* Breakwater: the ally stood within 4 m of him (body to body) where it was before the push / pull / knock-up */
    bwNear(A,T,u,c){ const E=A.eng(), p=c.from, x=c.unit; if(!p||!x) return false; return Math.hypot(u.x-p.x,u.y-p.y)-E.bodyR(u)-E.bodyR(x)<4*E.METER(); },
    /* Bellow: Unshaken Herd's cut written stronger, as the passive writes it (the one damage-reduction slot, the stronger value stays) */
    cover(A,T,u,c,a){ const x=c.tgt; if(!x||!x.alive) return; x.drMul=Math.min(x.drMul||1,Math.max(0.05,0.75-(a.by||0))); x.drT=Math.max(x.drT||0,1.5); },
    /* The Nineteen: the held ally is freed of every hold at once (stun, fear, silence, sleep, knock-up) */
    free(A,T,u,c){ const x=c.tgt; if(!x||!x.alive) return; for(const f of HOLDS) x[f]=0; x._airT=0; A.clearMark(u,x,'held'); },
    /* Calm the Herd: a control that just landed on an ally within 4 m is that much shorter (only when this control set the time) */
    calm(A,T,u,c,a){ const x=c.unit, f=c.field; if(!x||!f||!(c.amt>0)) return; if(Math.abs((x[f]||0)-c.amt)<1e-9) x[f]=c.amt*Math.max(0,1-(a.by||0)); },
    /* The Ford at Hask: a hit that takes a Herd ally from 25% or more to below 25% (through its shield) */
    drop25(A,T,u,c){ const t=c.tgt; if(!t||t===u||!t.alive) return false; const th=0.25*t.maxHp; return t.hp>=th&&(t.hp+(t.shield||0)-(c.amt||0))<th; },
    /*   a hold meant for a Herd ally lands on Askel instead, at half its length (his own control talents shorten it as any control on him) */
    redirect(A,T,u,c){ const x=c.unit, f=c.field, d=c.amt||0; if(!x||!f) return; x[f]=0; if(f==='stunned') x._sleepT=0; if(d>0&&u.alive) A.control(T,u,u,f,d*0.5); },
    /*   and no Herd ally can be held: every hold on them ends each tick */
    freeHerd(A,T,u){ for(const x of (T.s.hd||[])) if(x.alive){ for(const f of HOLDS) x[f]=0; x._airT=0; } },
    /* March Through the Ford: its shield 50% larger on the allies it marked (the larger shield stays) */
    mtfShield(A,T,u,c){ const o=c.o||{}, k=(o.allyShield||0.12)*1.5, d=o.shieldDur||5;
      for(const x of A.pick(T,u,{team:'ally',others:true,has:'mtf'},c)){ x.shield=Math.max(x.shield||0,x.maxHp*k); x.shieldT=Math.max(x.shieldT||0,d); } },
    /* the Colours (Colours at the Ford; a.of: 'target' | 'unit') */
    col(A,T,u,c,a){ colours(A,T,u,c,a.of==='unit'?c.unit:c.tgt,colDur(T.P['col.dur'])); },
    /* Rallying Ground ended: Carry the Colours on every ally it rallied */
    colRl(A,T,u,c){ for(const x of A.pick(T,u,{team:'ally',others:true,has:'rl'},c)) colours(A,T,u,c,x,colDur(T.P['col.dur'])); },
    rgDone(A,T,u,c){ for(const x of A.pick(T,u,{team:'ally',has:'rl'},c)) A.clearMark(u,x,'rl'); },
    rgO(A,T,u,c){ T.s.rgo=Object.assign({},c.o||{}); },
    /* Long Colours: March's shield (every ally) also gives the Colours, 1 s per rank (+ Bright Colours) */
    longCol(A,T,u,c){ const d=T.r.st_12_4+(T.P['col.dur']||0); for(const x of A.pick(T,u,ALLIES,c)) colours(A,T,u,c,x,d); },
    /* Carry It Forward: an ally the moving ground reaches is rallied for the time it has left (and gives Muster), once per ground */
    cif(A,T,u,c){ const E=A.eng(), L=T.s.zn.rg||[]; let left=0; for(const z of L) left=Math.max(left,z.until-E.now()); if(!(left>0)) return;
      for(const x of A.pick(T,u,{team:'ally',others:true,inZone:'rg',lacks:'rl'},c)){ A.setMark(T,u,x,'rl',{}); rally(A,T,u,x,1,left); if(T.st.mus) A.acts(T,u,[{stack:'mus',add:1}],c); } },
    /* Raise the Standard: every ally within 6 m of the slam (him, body to body) is rallied for 2 s */
    rallyNear(A,T,u,c){ for(const x of A.pick(T,u,{team:'ally',others:true,within:6},c)) rally(A,T,u,x,1,2); },
    /* Rut: his March spends them all; the signature's charge counts them double (Rut's bonus still at most 90%) */
    rutSpend(A,T,u,c){ const E=A.eng(), n=A.stGet(T,'rut'); A.stSet(T,u,'rut',0); T.s.w.rutW={t:3,n:n*(A.winOn(T,'gbr')?2:1),cdT:0,at:E.now(),wave:false};
      if(n>0&&T.on.rutSpent) A.run(T,u,'rutSpent',Object.assign({},c,{spent:n})); },
    /* Flattened: 4 s (+ Trampled), ends with 'flatEnd' (Crushed Underfoot) */
    flatten(A,T,u,c){ const t=c.tgt; if(!t||!t.alive||t.team===u.team) return; const d=4+(T.P['flat.dur']||0);
      A.acts(T,u,[{mark:'flat',on:'target',dur:d,ends:'flatEnd'},{window:'flatW',dur:d,longest:true}],c); },
    /* Gored (stacks twice; a.set: at least that many). Pin to the Ground: an enemy already Gored twice that is Gored again is rooted 1 s (+ Hold Them Down) */
    gore(A,T,u,c,a){ const t=c.tgt; if(!t||!t.alive||t.team===u.team) return; const was=A.ustGet(T,u,t,'gore');
      if(was>=2&&T.r.ch_5_3){ const d=1+(T.P['pin.dur']||0); A.setMark(T,u,t,'pin',{dur:d}); A.acts(T,u,[{window:'pinW',dur:d,longest:true}],c); }
      A.ustPut(T,u,t,'gore',a.set!=null?Math.max(was,a.set):Math.min(2,was+1)); A.acts(T,u,[{window:'goreW',dur:T.st.gore.dur,longest:true}],c); },
    crashTgt(A,T,u,c){ T.s.ct=c.tgt||null; },
    isCt(A,T,u,c){ return !!c.tgt&&c.tgt===T.s.ct; },
    /* Second Charge: each enemy March hits (up to 4) gives 1 energy per rank */
    scReset(A,T){ T.s.scN=0; },
    sc(A,T,u,c,a){ if((T.s.scN||0)>=4) return; T.s.scN=(T.s.scN||0)+1; u.energy=Math.min(100,(u.energy||0)+(a.by||0)); },
    /* The Banner Had His Face: the standard goes up where he stands (for the rest of the wave); every ally on the field is shielded once for 10% of his max HP */
    plant(A,T,u,c){ T.s.std={x:u.x,y:u.y,pt:true}; for(const x of A.pick(T,u,ALLIES,c)){ x.shield=Math.max(x.shield||0,u.maxHp*0.10); x.shieldT=Math.max(x.shieldT||0,6); } },
    /*   each tick: the allies within 6 m of it (body edge) are rallied at half strength and carry the Colours (while they stay and 4 s after). After he falls
         (ghost) the standard keeps rallying; the Colours, his talents, end with him */
    stdTick(A,T,u,c,a){ const E=A.eng(), p=T.s.std; if(!p) return; const R=6*E.METER();
      for(const x of E.units()){ if(!x.alive||x.team!==u.team||x===u||x._summon||x._dropHidden) continue; if(Math.hypot(x.x-p.x,x.y-p.y)-E.bodyR(x)>=R) continue;
        rally(A,T,u,x,0.5,0.25); if(!a.dead&&u.alive) colours(A,T,u,c,x,colDur(T.P['col.dur'])); } },
    stdEnd(A,T){ T.s.std=null; T.s.ghost=false; }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/14 - ASKEL GREATBROW - talent decisions.md) */
  ruling:{}
};
