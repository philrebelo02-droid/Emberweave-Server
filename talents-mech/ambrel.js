/* AMBREL - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (section 17: what Ambrel added)
   Her real kit (the code, not the tooltip wording; her skills read Ability Power: heroScaleMode 'ap'):
   - Sacred Bells (passive 'sacredbells'): every 4 s (u._sbT) every ally within 6 m of her, centre to centre (herself and summons too), gets the skill
     damage-reduction slot drMul = min(drMul, 1 - 0.10 x passMul) for 4.2 s (drT). One slot: the strongest skill reduction on a unit wins. It rings so
     often that the cut is on all the time. The 'pass' hook runs right after it has written the cut (the ring).
   - Cathedral Gates ('aoeStun', green, cd 10, delivered): every enemy within 2.8 m of its centre (her target, centre to centre) takes 110% of her ability
     power (a magic hit: her damage profile is Magic) and a stun through ccApply (the area table's 2 s x 0.7 = 1.4 s). The 'at' hook keeps where it landed.
   - Incense of Penance ('incense', blue, cd 9): around HER, 5 m: every enemy gets the game's attack cut (_atkDnPct 25%, 6 s); every ally is cleansed
     (all DoTs, stun, fear, silence, slow, Mortal Wound) and healed for 40% of her ability power (healFrom: her heals as events).
   - Divine Mass (ultimate 'sunburst'; HERO_ULT_ART.ambrel adds only its art and delivery): every enemy within 6 m of her takes 180% of her ability power
     (magic); every ally within 6 m is healed for 35% of ITS max HP. No stun (ULT_DEF.sunburst has none; the Knell stuns below are the talents' own).
   Peals, Clangour, the Knell, Candles, Pilgrims, Atonement, Barred, Masonry and Sin exist only through her talents.
   Readings, caps and corrected tooltips: WIRING/13 - AMBREL - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const SB='sacredbells', GATES='aoeStun', INC='incense', MASS='sunburst', SK=[GATES,INC,MASS];
/* the states several talents read: their bookkeeping runs when any of these is learned */
const PIL=['ip_1_4','ip_2_4','ip_3_4','ip_4_4','ip_6_4','ip_7_3','ip_7_4','ip_8_4','ip_10_4','ip_11_4','ip_12_3','ip_13_3'];
const ATN=['ip_2_3','ip_4_3','ip_5_2','ip_5_3','ip_6_2','ip_6_3','ip_7_3','ip_9_3','ip_10_3','ip_13_3'];
const CDL=['ip_1_1','ip_3_1','ip_5_1','ip_6_1','ip_7_1','ip_9_1','ip_9_3','ip_10_1','ip_12_1','ip_13_3'];
const MAS=['gt_1_2','gt_2_2','gt_4_2','gt_6_2','gt_6_4','gt_8_2','gt_9_2','gt_10_2'];
const SIN=['gt_1_4','gt_3_4','gt_5_4','gt_7_4','gt_9_4','gt_11_2','gt_12_2','gt_13_2'];
const BAR=['gt_1_1','gt_2_1','gt_3_1','gt_n1','gt_5_2','gt_5_3','gt_7_1','gt_8_1','gt_10_1','gt_11_1','gt_12_4','gt_13_2'];
const ATONE=[{mark:'atn',on:{team:'enemy',withinOpt:'radius'},dur:P('atn.dur',6),longest:true},{window:'atnW',dur:P('atn.dur',6),longest:true}];   // the enemies the skill reached make Atonement
const ALLY_HIT={srcTeam:'enemy',targetTeam:'ally'};                                // an enemy's hit on one of her allies (teamIn: never herself)
const MINE=['out','dmg:clang','dmg:slam2','dmg:judg','dmg:sinj'];                  // damage FROM Ambrel: her hits and the damage her talents deal
/* the Knell: below 30% HP (Passing Bell: higher), or made to hear it (the Last Thing Standing) */
const thr=T=>0.30+(T.P['kn.hp']||0);
const hears=(A,T,u,x)=>!!x&&((x.hp<thr(T)*x.maxHp)||!!A.markOf(u,x,'knF'));
/* Peals struck: the next Peal (1 to 12, then round again), one more struck this wave (up to 12), 'peal'; the 12th: 'p12' (a row may start them again at 1) */
function strike(A,T,u,c,n){ for(let i=0;i<n;i++){ const p=A.stGet(T,'pos'), q=p>=12?1:p+1; A.stSet(T,u,'pos',q); A.stSet(T,u,'ps',A.stGet(T,'ps')+1); A.run(T,u,'peal',c);
    if(q===12){ T.s.pr=0; A.run(T,u,'p12',c); if(T.s.pr) break; } } }
module.exports={
  hero:'ambrel',
  casting:true,                         // rows ask which of her skills a hit, a heal or a stun comes from
  points:true,                          // the at hook: where Cathedral Gates lands (Doors Slam Twice)
  states:{
    pos:{max:12},                                                                  // the Peal now (1 to 12)
    ps:{max:12},                                                                   // Peals struck this wave (up to 12)
    cdl:{max:7},                                                                   // Candles lit
    mas:{max:P('mas.max',8),gain:'stone'},                                         // Masonry stones on her (this wave)
    sin:{unit:true,max:5,dur:P('sin.dur',10),full:'sin5'}                          // Sin on each enemy: all lapse 10 s after the last
  },
  needs:{ rh_5_4:'rh_1_4', rh_7_4:'rh_1_4', rh_10_2:'rh_1_4', rh_12_4:'rh_1_4', gt_11_2:'gt_1_4' },   // they improve Clangour / the Sins Divine Mass clears
  /* run for her whenever she has any mechanic talent: the ring, the Peals, and the bookkeeping of the states her talents share */
  always:[
    {on:'pass',skill:SB,do:[{fn:'ring'}]},                                                                       // Sacred Bells rang
    {on:'ring',if:{any:[{p:'bell.add'},{p:'bell.dur'}]},do:[{fn:'bellCut',x:1}]},                               // the bells' cut stronger / longer (Prayer Bells, Bell Shelter, Long Peals)
    {on:'wave',do:[{fn:'pealWave'}]},                                                                            // the Peals start the wave again (Ringing Peals keeps some)
    {on:'teamIn',req:'rh_8_2',if:{targetTeam:'enemy'},do:[{fn:'knSeen'}]},                                       // Dirge: in the Knell before the blow that kills it
    {on:'healed',skill:INC,reqAny:PIL,do:[{emit:'mkPil',on:'unit'}]},                                            // Pilgrims: every ally Incense heals
    {on:'healed',skill:MASS,req:'ip_7_3',do:[{emit:'mkPil',on:'unit'}]},                                         //   High Mass of Penance: every ally Divine Mass heals
    {on:'mkPil',do:[{mark:'pil',on:'target',dur:P('pil.dur',8),longest:true},{window:'pilW',dur:P('pil.dur',8),longest:true},{emit:'pilNew'}]},
    {on:'cast',skill:INC,reqAny:ATN,do:ATONE},                                                                   // Atonement: every enemy Incense reaches
    {on:'cast',skill:MASS,req:'ip_7_3',do:ATONE},                                                                //   High Mass of Penance: every enemy Divine Mass reaches
    {on:'healed',skill:INC,reqAny:CDL,do:[{stack:'cdl',add:1,full:[{emit:'seven'}]}]},                           // Candles: one for each ally Incense cleanses (all it reaches)
    {on:'tick',reqAny:CDL,if:{stackMin:{cdl:1}},period:P('cdl.t',4),do:[{stack:'cdl',add:-1},{emit:'burnout'}]},  //   one burns out every 4 s
    {on:'hit',reqAny:MAS,if:{casting:GATES,targetTeam:'enemy'},do:[{stack:'mas',add:1}]},                       // Masonry: each enemy Cathedral Gates hits
    {on:'hit',req:'gt_9_2',if:{casting:MASS,targetTeam:'enemy'},do:[{stack:'mas',add:1}]},                      //   Built to Last: each enemy Divine Mass hits
    {on:'wave',reqAny:MAS,do:[{fn:'masWave'}]},                                                                  //   for the rest of the wave (Mortar keeps some)
    {on:'teamIn',reqAny:SIN,if:ALLY_HIT,do:[{ustack:'sin',on:'source',add:1}]},                                  // Sin: an enemy that hits one of her allies
    {on:'kit',skill:GATES,reqAny:['gt_3_1','gt_n1','gt_5_3'],do:[{mark:'bp',on:{team:'enemy',has:'bar'},dur:0.5}]},   // already Barred before this slam
    {on:'ccHit',reqAny:BAR,if:{casting:GATES,cc:['stunned'],talent:false},do:[{fn:'barOn'}]},                    // Barred: from the slam's stun until 4 s after it
    {on:'ccHit',req:'rh_7_4',if:{casting:GATES,cc:['stunned'],talent:false},do:[{mark:'gst',on:'target',dur:{pct:1,of:'hit'}}]}   // stunned by Cathedral Gates (Rope Pull)
  ],
  talents:{
    /* ============================== RINGING THE HOURS ============================== */
    rh_1_1:[ {stat:{apow:R(0.003)},per:'ps'} ],                                                                 // The First Peal: each Peal struck this wave (the counting is an always row)
    rh_2_3:[ {on:'out',if:{casting:GATES},more:R(0.04)}, {on:'dmg:slam2',more:R(0.04)} ],                       // Gate Weight
    rh_1_4:[ {on:'ring',do:[{fn:'clangour',k:1,valley:true}]},                                                  // Clangour: every enemy within 4 m at each ring
             {on:'clang',do:[{dmg:{pct:R(0.08),of:'apow',k:1},on:'target',tag:'clang'}]} ],
    rh_2_1:[ {on:'ring',do:[{field:'_sbT',add:R(0.2),on:'self'}]} ],                                            // Quarter Chimes: the next ring 0.2 s sooner
    rh_2_2:[ {on:'teamIn',if:Object.assign({fn:'knS'},ALLY_HIT),less:R(0.02)}, {on:'in',if:{fn:'knS'},less:R(0.02)},   // Death Knell: they deal less
             {on:'out',if:{casting:SK,fn:'knT'},more:R(0.03)} ],                                               //   and her skills deal more to them
    rh_3_1:[ {on:'p12',do:[{fn:'bellCut',x:2},{stun:0.5,on:{team:'enemy',within:4}}]} ],                        // Noon: the great bell
    rh_5_4:[ {param:'clang.r',add:R(0.2)} ],                                                                    // Bell Tower
    rh_3_4:[ {on:'clang',do:[{slow:R(0.04),dur:1,on:'target'}]} ],                                              // Heavy Bronze
    rh_4_1:[ {on:'peal',do:[{heal:{pct:R(0.003),of:'tgtMaxHp'},on:{team:'ally',within:4}}]} ],                  // Matins
    rh_4_2:[ {param:'kn.hp',add:R(0.01)} ],                                                                     // Passing Bell (up to 33%)
    rh_4_3:[ {on:'healOut',skill:INC,more:R(0.04)} ],                                                           // Sweet Incense
    rh_n1:[  {on:'ring',do:[{window:'rs',dur:2}]}, {on:'in',if:{window:'rs'},less:R(0.015)} ],                  // Resonant Stone
    rh_8_2:[ {on:'death',if:{who:'enemy',fn:'knDied'},do:[{heal:{pct:R(0.01),of:'maxHp'},on:'self'}]} ],        // Dirge
    rh_8_3:[ {on:'in',if:{crit:true},less:R(0.02)} ],                                                           // Weathered Stone
    rh_6_1:[ {on:'in',if:{stackMin:{pos:9}},less:R(0.015)} ],                                                   // Vespers
    rh_6_2:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',fn:'knT'},more:R(0.015)} ],                     // Tolling On (her whole team, Ambrel too)
    rh_6_4:[ {on:'ringPre',once:'wave',do:[{fn:'rnAtLeast',n:R(2)}]} ],                                         // Early Bell
    rh_7_1:[ {stat:{mr:R(0.002)},per:'ps'} ],                                                                   // Compline
    rh_7_3:[ {on:'out',if:{casting:MASS},more:R(0.03)}, {on:'dmg:judg',more:R(0.03)} ],                         // Divine Light
    rh_8_1:[ {param:'bell.dur',add:R(0.2)} ],                                                                   // Long Peals (the always row)
    rh_5_2:[ {on:'teamHeal',if:{fn:'knU'},less:0.5} ],                                                          // Toll for Them (PICK ONE): 50% less healing
    rh_5_3:[ {on:'teamIn',if:Object.assign({fn:'allyDrop'},ALLY_HIT),icd:P('urg',8),do:[{field:'_sbT',min:4,on:'self'}]} ],   // Ring for the Living (PICK ONE)
    rh_7_4:[ {on:'dmg:clang',if:{targetHas:'gst',targetMin:{stunned:0.001}},more:R(0.05)} ],                    // Rope Pull
    rh_9_1:[ {on:'out',if:{casting:SK},ignoreMr:R(0.02)} ],                                                     // Bell Metal
    rh_6_3:[ {param:'urg',add:R(-1)} ],                                                                         // Urgent Peal (Ring for the Living's wait)
    rh_9_4:[ {on:'cast',skill:GATES,do:[{field:'_sbT',min:4,on:'self'},{window:'valley',dur:0.5}]},            // Bells Across the Valley: the slam rings the bells at once
             {on:'ccHit',if:{casting:GATES,cc:['stunned'],talent:false},do:[{mark:'gsv',on:'target',dur:0.5}]} ],   //   and that ring's Clangour reaches every enemy it stunned
    rh_10_1:[ {on:'ring',do:[{heal:{pct:R(0.004),of:'maxHp'},on:'self'}]} ],                                    // Evensong
    rh_10_2:[ {on:'dmg:clang',if:{fn:'knT'},more:R(0.04)} ],                                                    // Knell Weight
    rh_10_4:[ {on:'ringPre',chance:R(0.06),do:[{fn:'rnAtLeast',n:2}]} ],                                        // Carillon
    rh_11_1:[ {on:'cd',skill:'blue',add:R(-0.2)} ],                                                             // Patient Stone
    rh_11_2:[ {on:'cast',skill:MASS,do:[{fn:'peals',n:3},{fn:'massStun'}]} ],                                   // Mass at Noon
    rh_11_3:[ {on:'dotIn',less:R(0.02)} ],                                                                      // Cathedral Patience
    rh_12_1:[ {param:'peal.keep',add:R(2)} ],                                                                   // Ringing Peals (the always row)
    rh_12_2:[ {on:'p12',do:[{window:'poj',dur:4}]}, {on:'out',if:{casting:SK,window:'poj'},more:R(0.03)} ],    // Peal of Judgment
    rh_9_3:[ {on:'in',if:{srcRow:'Back'},less:R(0.02)} ],                                                       // Buttress
    rh_12_4:[ {on:'ring',if:{fn:'two'},do:[{fn:'clangour',k:R(0.25)}]} ],                                       // Change Ringing
    rh_13_2:[ {on:'p12',icd:30,do:[{window:'lts',dur:4},{cleanse:'all',on:{team:'ally'}},{fn:'clangour',k:1,n:3,within:6},   // The Last Thing Standing (SIGNATURE)
                {mark:'knF',on:{team:'enemy',within:6},dur:4},{fn:'pealReset'}]},
              {on:'teamIn',if:Object.assign({window:'lts'},ALLY_HIT),less:0.30}, {on:'in',if:{window:'lts'},less:0.30} ],

    /* ============================== INCENSE AND PENANCE ============================== */
    ip_1_1:[ {on:'healOut',more:R(0.01),per:'cdl'} ],                                                           // Light a Candle (lighting and burning out: always rows)
    ip_2_2:[ {on:'kit',skill:INC,opt:{radius:{addM:R(0.2)}}} ],                                                 // Thick Smoke
    ip_1_4:[ {on:'teamIn',if:Object.assign({targetHas:'pil'},ALLY_HIT),less:R(0.01)}, {on:'in',if:{targetHas:'pil'},less:R(0.01)},   // Pilgrims
             {on:'tick',if:{window:'pilW'},period:1,do:[{heal:{pct:R(0.001),of:'tgtMaxHp'},on:{team:'ally',has:'pil'}}]} ],
    ip_2_3:[ {on:'teamIn',if:Object.assign({srcHas:'atn'},ALLY_HIT),do:[{after:0,do:[{heal:{pct:R(0.03),of:'hit'},on:'target',tag:'atn'}]}]},   // Penance: Atonement
             {on:'in',if:{srcHas:'atn'},do:[{after:0,do:[{heal:{pct:R(0.03),of:'hit'},on:'self',tag:'atn'}]}]} ],
    ip_2_4:[ {param:'pil.dur',add:R(1)} ],                                                                      // Long Road
    ip_3_1:[ {param:'cdl.t',add:R(0.4)} ],                                                                      // Votive
    ip_9_2:[ {param:'bell.add',add:R(0.005)} ],                                                                 // Prayer Bells
    ip_3_4:[ {on:'teamIn',if:Object.assign({targetHas:'pil',targetLacks:'shr',fn:'allyDrop'},ALLY_HIT),do:[{mark:'shr',on:'target'},{after:0,do:[{cleanse:'all',on:'target'},{heal:{pct:0.4,of:'apow'},on:'target'}]}]},   // Shrine Road
             {on:'in',if:{targetHas:'pil',targetLacks:'shr',dropBelow:0.3},do:[{mark:'shr',on:'self'},{after:0,do:[{cleanse:'all',on:'self'},{heal:{pct:0.4,of:'apow'},on:'self'}]}]},
             {on:'pilNew',do:[{mark:'shr',on:'target',clear:true}]} ],                                         //   once each time it is made a Pilgrim
    ip_4_2:[ {on:'kit',skill:INC,opt:{pct:{add:R(0.01)}}} ],                                                    // Sweet Smoke
    ip_4_3:[ {param:'atn.dur',add:R(0.5)} ],                                                                    // Hair Shirt
    ip_4_4:[ {stat:{move:R(0.01),aspd:R(0.01)},to:{team:'ally',has:'pil'},if:{window:'pilW'}} ],                // Pilgrim's Pace
    ip_5_1:[ {on:'teamIn',if:Object.assign({targetWithin:5,stackMin:{cdl:1}},ALLY_HIT),less:R(0.003),per:'cdl'}, {on:'in',if:{stackMin:{cdl:1}},less:R(0.003),per:'cdl'} ],   // Candlelight
    ip_5_2:[ {on:'heal:atn',mul:2}, {on:'kit',skill:INC,do:[{fn:'gpSnap'}]}, {on:'cast',skill:INC,do:[{fn:'gpBack'}]} ],   // Gentle Penance (PICK ONE)
    ip_5_3:[ {on:'teamIn',if:Object.assign({srcHas:'atn',crit:true},ALLY_HIT),do:[{fn:'uncrit'}]}, {on:'in',if:{srcHas:'atn',crit:true},do:[{fn:'uncrit'}]} ],   // Hard Penance (PICK ONE)
    ip_n1:[  {on:'healOut',if:{targetHpBelow:0.4},more:R(0.03)} ],                                              // Alms
    ip_6_1:[ {on:'wave',do:[{stack:'cdl',atLeast:R(2)}]} ],                                                     // Morning Candle
    ip_6_2:[ {on:'heal:atn',req:'ip_5_2',more:R(0.05)} ],                                                       // Forgiven
    ip_6_3:[ {on:MINE,if:{targetHas:'atn'},more:R(0.015)} ],                                                    // Confession
    ip_6_4:[ {on:'teamHeal',if:{unitHas:'pil'},more:R(0.03)}, {on:'healMe',if:{targetHas:'pil'},more:R(0.03)} ],   // Way Station
    ip_7_1:[ {on:'out',if:{casting:SK,stackMin:{cdl:5}},more:R(0.02)} ],                                        // Altar Flame
    ip_7_2:[ {on:'healOut',skill:INC,more:R(0.03)} ],                                                           // Radiant Fumes
    ip_7_3:[ {param:'hm',add:1} ],                                                                              // High Mass of Penance (the always rows)
    ip_7_4:[ {on:'teamCc',if:{unitHas:'pil',cc:['slow']},do:[{fn:'feet',by:R(0.05)}]},                          // Blessed Feet (up to 15%)
             {on:'tick',if:{fn:'selfPil'},do:[{weaken:'slowMul',by:R(0.05)}]} ],
    ip_8_4:[ {on:'pilNew',do:[{shield:{pct:R(0.005),of:'maxHp'},on:'target',dur:P('pil.dur',8),mode:'max'}]} ],   // Pilgrim Shield
    ip_9_1:[ {on:'tick',if:{stackFull:'cdl'},do:[{fn:'fastCd'}]} ],                                             // Seven Candles
    ip_9_3:[ {on:'heal:atn',more:R(0.01),per:'cdl'} ],                                                          // Making Amends
    ip_10_1:[ {on:'burnout',do:[{heal:{pct:R(0.005),of:'tgtMaxHp'},on:{team:'ally',order:'lowHp',n:1}}]} ],     // Wax and Wick
    ip_10_3:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'atn'},if:{window:'atnW'}} ],                          // Bitter Smoke
    ip_10_4:[ {on:'waveEnd',do:[{mark:'lpg',on:{team:'ally',has:'pil'}}]},                                      // Long Pilgrimage
              {on:'wave',do:[{shield:{pct:R(0.01),of:'tgtMaxHp'},on:{team:'ally',has:'lpg'},dur:8},{mark:'lpg',on:{team:'ally',has:'lpg'},clear:true}]} ],
    ip_12_1:[ {stat:{mr:R(0.003)},per:'cdl'} ],                                                                 // Lantern
    ip_11_2:[ {on:'in',if:{crit:true},less:R(0.02)} ],                                                          // Pew Patience
    ip_11_3:[ {on:'cast',skill:INC,if:{noWindow:'csw'},do:[{after:3,do:[{window:'csw',dur:1},{castSkill:'blue',on:'self'},{window:'csw',end:true}]}]},   // Censer Swing
              {on:'kit',skill:INC,if:{window:'csw'},opt:{mul:{mul:0.5},pct:{mul:0.5}}} ],                       //   at half strength
    ip_11_4:[ {on:'teamIn',if:Object.assign({targetHas:'pil',targetHpBelow:0.5},ALLY_HIT),less:R(0.015)}, {on:'in',if:{targetHas:'pil',targetHpBelow:0.5},less:R(0.015)} ],   // Rest Stop
    ip_12_2:[ {on:'ccIn',if:{cc:['silencedT']},less:R(0.10)} ],                                                 // Choir Stall (up to 20%)
    ip_12_3:[ {stat:{apow:R(0.005)},per:{units:{team:'ally',has:'pil'},max:5},if:{window:'pilW'}} ],            // Rising Smoke
    ip_12_4:[ {on:'healed',skill:INC,do:[{mark:'hw',on:'unit',dur:R(0.5)}]},                                    // Holy Water: no slow for a moment after the cleanse
              {on:'teamCc',if:{unitHas:'hw',cc:['slow']},do:[{endCc:'slow',on:'unit'}]}, {on:'ccIn',if:{targetHas:'hw',cc:['slow']},mul:0} ],
    ip_13_3:[ {on:'seven',icd:25,do:[{window:'uip',dur:5},{mark:'pil',on:{team:'ally'},dur:5,longest:true},{window:'pilW',dur:5,longest:true},{emit:'pilNew',on:{team:'ally'}},   // Under Its Protection (SIGNATURE)
                {mark:'atn',on:{team:'enemy'},dur:5,longest:true},{window:'atnW',dur:5,longest:true}]},
              {on:'heal:atn',if:{window:'uip'},mul:3},
              {on:'teamLethal',if:{unitHas:'uipH'},do:[{atOne:'unit'}]},                                        //   held at 1 HP for 1 s
              {on:'teamLethal',if:{window:'uip',who:'ally',unitWithin:6,targetLacks:'uipU'},do:[{atOne:'unit'},{mark:'uipH',on:'unit',dur:1},{mark:'uipU',on:'unit'},{stack:'cdl',add:-1},{emit:'burnout'}]} ],

    /* ============================== THE GATES ============================== */
    gt_1_1:[ {stat:{move:R(-0.04)},to:{team:'enemy',has:'bar'},if:{window:'barW'}} ],                           // Bar the Door (Barred: the always row)
    gt_1_2:[ {stat:{armor:R(0.005),mr:R(0.005)},per:'mas'} ],                                                   // Masonry (laying stones: always rows)
    gt_1_4:[ {on:'out',if:{casting:MASS,targetUst:{sin:1}},more:R(0.03),per:{ust:'sin'}},                       // Sins Remembered
             {on:'cast',skill:MASS,do:[{fn:'massJudge'}]} ],                                                    //   and Divine Mass clears them
    gt_2_1:[ {param:'bar.dur',add:R(0.5)} ],                                                                    // Iron Bolts
    gt_2_2:[ {param:'mas.max',add:R(1)} ],                                                                      // Cornerstone (up to 11)
    gt_3_1:[ {on:'ccHit',unless:'gt_5_3',if:{casting:GATES,cc:['stunned'],talent:false,targetHas:'bp'},do:[{extend:'stunned',by:0.5,on:'target'},{fn:'barMore',by:0.5}]} ],   // Locked Out (Barred 4 s after the longer stun)
    gt_4_2:[ {on:'stone',do:[{heal:{pct:R(0.005),of:'maxHp',k:1},on:'self'}]} ],                                // Rebuilt Walls
    gt_n1:[  {on:'out',if:{casting:GATES,targetHas:'bp'},more:0.05},                                            // The Hour of Closing (LINK)
             {on:'kit',skill:GATES,req:'rh_1_1',do:[{fn:'hocReset'}]}, {on:'barred',req:'rh_1_1',do:[{fn:'hocPeal'}]} ],   //   with The First Peal: up to 2 Peals each slam
    gt_3_4:[ {param:'sin.dur',add:R(1)} ],                                                                      // Ledger of Sins
    gt_4_1:[ {on:'out',if:{casting:GATES},more:R(0.03)}, {on:'dmg:slam2',more:R(0.03)} ],                       // Heavy Doors
    gt_5_2:[ {on:'barred',do:[{after:{pct:1,of:'hit'},do:[{silence:1,on:'target'}]}]} ],                        // Sealed (PICK ONE): the first 1 s after the stun
    gt_5_3:[ {param:'od',add:1} ],                                                                              // Open Doors (PICK ONE: in barOn)
    gt_5_4:[ {on:'teamIn',if:Object.assign({srcUst:{sin:3}},ALLY_HIT),less:R(0.02)}, {on:'in',if:{srcUst:{sin:3}},less:R(0.02)} ],   // Weight of Sin
    gt_5_1:[ {on:'ccIn',less:R(0.04)} ],                                                                        // Foundations (up to 20%)
    gt_6_4:[ {on:'wave',do:[{stack:'mas',atLeast:R(2)}]} ],                                                     // Old Stones
    gt_6_3:[ {param:'od.t',add:R(0.3)} ],                                                                       // Threshold
    gt_6_1:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                             // Iron Hinges
    gt_6_2:[ {on:'in',if:{stackMin:{mas:8}},less:R(0.01)} ],                                                    // Rubble Wall
    gt_4_3:[ {on:'kit',skill:GATES,opt:{radius:{addM:R(0.2)}}} ],                                               // Wider Gates
    gt_7_1:[ {on:'at',skill:GATES,do:[{after:1,do:[{dmg:{pct:0.4,of:'raw'},on:{team:'enemy',of:'pt',withinOpt:'radius'},def:'magic',tag:'slam2'},   // Doors Slam Twice
                {stun:0.5,on:{team:'enemy',has:'b1'}}]}]} ],
    gt_7_3:[ {on:'out',if:{casting:MASS},more:R(0.03)}, {on:'dmg:judg',more:R(0.03)} ],                         // Judgment Beams
    gt_7_4:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetUst:{sin:1}},more:R(0.01)} ],             // Confessor
    gt_8_1:[ {on:MINE,if:{targetHas:'bar'},more:R(0.03)} ],                                                     // Gatekeeper
    gt_8_2:[ {stat:{hp:R(0.002)},per:'mas'} ],                                                                  // Bulwark Stones
    gt_8_3:[ {on:'in',if:{srcMelee:false},less:R(0.02)} ],                                                      // Lead Roof
    gt_9_2:[ {on:'cast',skill:MASS,if:{stackMin:{mas:8}},do:[{shield:{pct:0.05,of:'maxHp'},on:{team:'ally',withinOpt:'radius'},dur:6,mode:'max'}]} ],   // Built to Last
    gt_9_3:[ {on:'out',if:{casting:SK},ignoreMr:R(0.02)} ],                                                     // Hallowed
    gt_9_4:[ {on:'hurt',chance:R(0.10),do:[{ustack:'sin',on:'source',add:1}]} ],                                 // Original Sin
    gt_10_1:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'bar'},if:{window:'barW'}} ],                          // Barricade
    gt_10_3:[ {param:'bell.add',add:R(0.01)} ],                                                                 // Bell Shelter
    gt_11_1:[ {on:'teamIn',by:'source',once:'wave',if:Object.assign({srcHas:'bar',targetRow:'Back'},ALLY_HIT),do:[{stun:0.6,on:'source'}]} ],   // No Way Through
    gt_11_2:[ {on:'sinsCleared',do:[{heal:{pct:R(0.01),of:'maxHp',k:1},on:'self'}]} ],                          // Penitent Stone
    gt_11_4:[ {on:'in',if:{crit:true},less:R(0.02)} ],                                                          // Stained Glass
    gt_12_1:[ {on:'kit',skill:GATES,opt:{stun:{add:R(0.1),ccRaw:true}}} ],                                      // Deadbolt (its full 0.1 s)
    gt_12_2:[ {on:'out',if:{casting:MASS,targetUst:{sin:5}},more:R(0.02)} ],                                    // Day of Judgment
    gt_10_2:[ {param:'mas.keep',add:R(1)} ],                                                                    // Mortar
    gt_12_4:[ {on:'teamHeal',if:{unitHas:'bar'},less:R(0.05)} ],                                                // Heavy Lintel
    gt_13_2:[ {on:'sin5',icd:20,if:{targetHas:'bar'},do:[{fn:'judgment'}]} ]                                    // A Building That Would Not Be Left (SIGNATURE)
  },
  fn:{
    /* the Knell: the target / the attacker / the unit hears it */
    knT(A,T,u,c){ return hears(A,T,u,c.tgt); },
    knS(A,T,u,c){ return hears(A,T,u,c.src); },
    knU(A,T,u,c){ return !!c.unit&&!!c.unit.alive&&hears(A,T,u,c.unit); },
    /* Dirge: a hit on an enemy that finds it in the Knell, or leaves it there alive, marks it; one that kills it from above the Knell clears the mark */
    knSeen(A,T,u,c){ const t=c.tgt; if(!t) return; const th=thr(T)*t.maxHp, af=t.hp+(t.shield||0)-(c.amt||0);
      if(t.hp<th||(af>0&&af<th)) A.setMark(T,u,t,'knb',{dur:6}); else A.clearMark(u,t,'knb'); },
    knDied(A,T,u,c){ return !!(A.markOf(u,c.unit,'knb')||A.markOf(u,c.unit,'knF')); },
    /* a ring: how many Peals it strikes (Carillon, Early Bell), strike them, then the ring's rows (ctx.pn = Peals it struck) */
    ring(A,T,u,c){ T.s.rn=1; A.run(T,u,'ringPre',c); const n=T.s.rn; strike(A,T,u,c,n); A.run(T,u,'ring',Object.assign({},c,{pn:n})); },
    rnAtLeast(A,T,u,c,a){ T.s.rn=Math.max(T.s.rn||1,Math.floor((a.n||1)+1e-9)); },
    two(A,T,u,c){ return (c.pn||1)>=2; },
    peals(A,T,u,c,a){ strike(A,T,u,c,a.n|0); },
    pealReset(A,T,u){ A.stSet(T,u,'pos',0); T.s.pr=1; },                                    // the Peals start again at 1 (the rest of this ring's Peals are dropped)
    pealWave(A,T,u){ const k=T.P['peal.keep']||0; A.stSet(T,u,'pos',Math.min(A.stGet(T,'pos'),k)); A.stSet(T,u,'ps',Math.min(A.stGet(T,'ps'),k)); },
    /* the bells' cut, written into the game's one skill damage-reduction slot as the passive writes it (the stronger value stays): 10% x passive level,
       + Prayer Bells / Bell Shelter, x a.x (Noon: 2), for 4.2 s + Long Peals, on every ally within the bells' 6 m */
    bellCut(A,T,u,c,a){ if(!(u.pass&&u.pass.sacredbells)) return; const E=A.eng(), cut=(0.10*(u.passMul||1)+(T.P['bell.add']||0))*(a.x||1), v=Math.max(0.05,1-cut), d=4.2+(T.P['bell.dur']||0), R=6*E.METER();
      for(const x of E.units()){ if(!x.alive||x.team!==u.team||x._dropHidden||(x._riseT>0)||E.dist(u,x)>R) continue; x.drMul=Math.min(x.drMul||1,v); x.drT=Math.max(x.drT||0,d); } },
    /* Clangour (with Clangour learned): every enemy within 4 m (+ Bell Tower; a.within: that), a.n times, at a.k strength. valley: this ring was rung by
       Bells Across the Valley, so it also reaches every enemy that slam stunned */
    clangour(A,T,u,c,a){ if(!(T.r.rh_1_4>0)) return; const R=a.within!=null?a.within:4+(T.P['clang.r']||0), L=A.pick(T,u,{team:'enemy',within:R},c);
      if(a.valley&&A.winOn(T,'valley')){ for(const x of A.pick(T,u,{team:'enemy',has:'gsv'},c)) if(L.indexOf(x)<0) L.push(x); T.s.w.valley.t=0; }
      const k=a.k==null?1:a.k; for(let i=0;i<(a.n||1);i++) for(const x of L) if(x.alive) A.run(T,u,'clang',Object.assign({},c,{tgt:x,k})); },
    /* Mass at Noon: every enemy Divine Mass hit that hears the Knell (after the hit), stunned 1 s (a talent stun: its full second) */
    massStun(A,T,u,c){ const E=A.eng(), R=(c.o&&c.o.radius)||6*E.METER(); for(const e of E.units()) if(e.alive&&e.team!==u.team&&E.dist(u,e)<R&&hears(A,T,u,e)) A.control(T,u,e,'stunned',1); },
    /* Barred (a Gates stun landed): from the stun until 4 s after it. Open Doors: an enemy already Barred is not stunned again, it is pushed 2 m away and slowed */
    barOn(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return;
      if(T.r.gt_5_3&&A.markOf(u,t,'bp')){ if((t.stunned||0)<=(c.amt||0)+1e-6) t.stunned=0;
        A.acts(T,u,[{push:'target',m:2,secs:0.3},{slow:0.3,dur:2+(T.P['od.t']||0),on:'target'}],c); return; }
      const d=(c.amt||0)+4+(T.P['bar.dur']||0); A.setMark(T,u,t,'bar',{dur:d}); A.setMark(T,u,t,'b1',{dur:1.5}); A.acts(T,u,[{window:'barW',dur:d,longest:true}],c);
      A.run(T,u,'barred',c); },
    barMore(A,T,u,c,a){ const m=A.markOf(u,c.tgt,'bar'); if(!m||m.until==null) return; m.until+=a.by||0; const w=T.s.w.barW, left=m.until-A.eng().now(); if(w&&w.t<left) w.t=left; },
    hocReset(A,T){ T.s.hc=0; },
    hocPeal(A,T,u,c){ if((T.s.hc||0)>=2) return; T.s.hc=(T.s.hc||0)+1; strike(A,T,u,c,1); },
    masWave(A,T,u){ A.stSet(T,u,'mas',Math.min(A.stGet(T,'mas'),T.P['mas.keep']||0)); },
    /* Gentle Penance: the enemies Incense reaches keep the attack they had (its cut is put back as it was) */
    gpSnap(A,T,u,c){ const E=A.eng(), R=(c.o&&c.o.radius)||5*E.METER(); T.s.gp=[]; for(const e of E.units()) if(e.alive&&e.team!==u.team&&E.dist(u,e)<=R) T.s.gp.push([e,e._atkDnPct,e._atkDnT]); },
    gpBack(A,T){ const L=T.s.gp||[]; T.s.gp=null; for(const x of L){ x[0]._atkDnPct=x[1]; x[0]._atkDnT=x[2]; } },
    /* Hard Penance: a critical hit of an Atoning enemy deals what the same hit would have dealt without the crit */
    uncrit(A,T,u,c){ const s=c.src, t=c.tgt; if(!s||!t) return; const b=s.critDmg||0.6, m=t.critRes?1+Math.max(0,b-t.critRes):1+b; if(m>1) c.amt/=m; },
    /* an ally's HP drops below 30% with this hit (through its shield) */
    allyDrop(A,T,u,c){ const t=c.tgt; if(!t||t===u||!t.alive) return false; const th=0.3*t.maxHp; return t.hp>=th&&(t.hp+(t.shield||0)-(c.amt||0))<th; },
    selfPil(A,T,u){ return !!A.markOf(u,u,'pil'); },
    /* Blessed Feet: a slow that just landed on a Pilgrim, that much weaker (once per new slow) */
    feet(A,T,u,c,a){ const x=c.unit; if(!x) return; const v=x.slowMul, m=T.s.ft||(T.s.ft={}); if(v==null||!(v<1)||m[x.uid]===v) return; x.slowMul=1-(1-v)*Math.max(0,1-(a.by||0)); m[x.uid]=x.slowMul; },
    /* Seven Candles: Incense's cooldown runs twice as fast while 7 are lit */
    fastCd(A,T,u,c){ if(!((u.stunned||0)>0)&&(u.blueCd||0)>0) u.blueCd=Math.max(0,u.blueCd-(c.dt||0)); },
    /* Sins Remembered: Divine Mass clears the Sins on every enemy it reached (they made its hit stronger first); 'sinsCleared' with ctx.k = how many */
    massJudge(A,T,u,c){ const E=A.eng(), R=(c.o&&c.o.radius)||6*E.METER(); let n=0;
      for(const e of E.units()){ if(!e.alive||e.team===u.team||!(E.dist(u,e)<R)) continue; const k=A.ustGet(T,u,e,'sin'); if(k>0){ n+=k; A.ustPut(T,u,e,'sin',0); } }
      if(n>0) A.run(T,u,'sinsCleared',Object.assign({},c,{k:n})); },
    /* A Building That Would Not Be Left: stunned 2 s (its full time); Divine Mass's own damage at half strength (180% of her ability power at her ultimate's level,
       magic); then every Sin on every enemy within 6 m of it (itself included) is judged for 5% of her ability power each, and cleared */
    judgment(A,T,u,c){ const E=A.eng(), t=c.tgt; if(!t||!t.alive) return; A.control(T,u,t,'stunned',2);
      const lv=(u.skillLv&&u.skillLv[0])||1, sm=E.skillMul?E.skillMul(lv):1, ap=(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1);
      A.acts(T,u,[{dmg:ap*sm*1.8*0.5*E.rage(),on:'target',def:'magic',tag:'judg'}],c);
      for(const e of A.pick(T,u,{team:'enemy',of:'target',within:6},c)){ const k=A.ustGet(T,u,e,'sin'); if(!(k>0)) continue; A.ustPut(T,u,e,'sin',0);
        A.acts(T,u,[{dmg:{pct:0.05*k,of:'apow'},on:'target',tag:'sinj'}],Object.assign({},c,{tgt:e})); } }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/13 - AMBREL - talent decisions.md) */
  ruling:{}
};
