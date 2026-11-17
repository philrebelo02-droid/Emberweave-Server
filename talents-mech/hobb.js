/* HOBB KILNMASK - what his learned talents do in a fight (the mechanics; his 12 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Hobb Kilnmask": what he added)
   His real kit (the code, not the card wording; his hits are physical and read his Attack):
   - Glazebreaker ('shred', green, cd 6): one hit on his target (155% of his attack x skill level) and an armour cut on it for 5 s (the target's _shredPct /
     _shredT: 30% taken through shredAt, 42.1% at skill level 100, never past the game's 45%). The cut's clock runs in the target's think, so it stands
     still while the target is stunned or feared. The hit lands inside the skill (kit .. cast), so rows ask casting:'shred'.
   - Sealed Vessel ('defensive', blue, cd 9): writes his one skill damage-reduction slot (drMul = 0.45 - 0.0005 a level: 59.95% at skill level 100) for 5 s.
     There is ONE glaze: the card's "one of several defensive glazes" is not in the code.
   - Fired Clay (passive 'warden'): every 3 s in battle a stack (max 5), each 4% x his passive's strength less damage taken, up to SKLV.wardenCap (20% at
     level 1, 29.9% at 100), inside damage(). It is damage reduction, not armour and magic resist (the card), and it climbs on a clock, not on hits.
     A new wave starts it at 0 again.
   - Grand Kiln Shape ('aoeStun', ultimate, on energy - no cooldown; ULT_DEF.aoeStun with HERO_ULT_ART.hobb, which only delivers it as a form):
     140% of his attack x skill level to every enemy whose centre is within 4.26 m of his target, and a stun (the area table 2.0 s x 0.7 = 1.4 s).
     Nothing is knocked back and nobody is feared: the card's "knocks the frontline backward" is not in the code. Its hits and stuns land inside the
     skill: casting:'aoeStun'.
   Ring False, Fracture, Coats, Kin Shards, Turns, Kiln-Hot and the Evening Jar exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/27 - HOBB KILNMASK - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const GZ='shred', SV='defensive', KS='aoeStun';
const DR_CAP=0.30, DR_TOWN=0.50, CRIT_CAP=0.05, SLOW_CAP=0.40, REGEN_CAP=0.012, CLAY_FASTEST=1.5;
/* the states several talents read: their bookkeeping runs when any of these is learned */
const FRAC=['rf_1_4','rf_3_4','rf_5_1','rf_9_3','rf_7_4','rf_9_4','rf_10_4','rf_12_4','rf_13_2'];
const RF=['rf_1_1','rf_2_1','rf_3_1','rf_5_4','rf_6_1','rf_6_4','rf_5_2','rf_5_3','rf_6_3','rf_9_1','rf_11_2','rf_12_2','rf_12_3'].concat(FRAC);
const COAT=['ct_1_3','ct_2_3','ct_7_4','ct_9_1','ct_10_2','ct_12_1','ct_13_3'];
const VES=COAT.concat(['ct_3_2','ct_8_3','ct_9_3','ct_5_3']);
const SHARD=['ct_1_4','ct_2_4','ct_n1','ct_3_4','ct_6_4','ct_7_2','ct_10_4','ct_11_4','ct_13_3'];
const TURN=['ow_1_4','ow_2_4','ow_3_4','ow_6_4','ow_7_4','ow_9_4','ow_10_4','ow_11_4','ow_13_3'];
const KH=['ow_1_1','ow_3_1','ow_5_1','ow_5_4','ow_6_1','ow_7_1','ow_9_1','ow_10_1','ow_12_1','ow_13_3'];
const JAR=['ow_2_3','ow_4_3','ow_5_2','ow_5_3','ow_6_2','ow_9_2','ow_12_1'];
const DRG=['rf_5_1','rf_8_3','rf_12_3','ct_1_3','ct_8_4','ct_10_4','ct_11_1','ct_11_3','ct_12_4','ct_n1','ct_5_3','ct_3_1','ct_7_4','ct_13_3','ow_5_4','ow_6_4','ow_12_4','ow_5_3'];
const CRIT=['rf_6_1','rf_9_3','ct_7_2','ow_7_4'], SLW=['rf_11_1','ct_6_1','ow_8_2'], FAST=['rf_11_3','ct_7_1','ow_11_2'], REGEN=['ct_8_3','ow_10_1'];
/* ---- small readers that need no API (the 95% instrument calls drK from a test with the API kept on T.s) ---- */
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const winN=(T,n)=>{ const w=T.s.w[n]; return !!w&&w.t>0; };
const mk=(u,t,name,now)=>{ const o=t&&t._talM&&t._talM[u.uid], m=o&&o[name]; return !!m&&(m.until==null||now<m.until); };
const ust=(u,t,name,now)=>{ const o=t&&t._talM&&t._talM[u.uid], m=o&&o['#'+name]; return (m&&now<m.until)?m.v:0; };
module.exports={
  hero:'hobb',
  casting:true,                         // rows ask which of his skills a hit, a stun or a cast comes from (Glazebreaker, Sealed Vessel, Grand Kiln Shape)
  states:{
    tap:{unit:true,max:P('tap.n',3),full:'tapFull'},                              // basic attacks he has landed on an enemy (the 3rd - 2nd with Found the Place - makes it Ring False)
    frac:{unit:true,max:5,full:'fracFull'},                                       // Fracture on an enemy (until the wave ends: that enemy's wave)
    shard:{max:P('shard.n',3),start:'max'},                                       // Kin Shards still whole (each fight)
    coat:{max:P('coat.max',4),wave:'reset'},                                      // Coats of glaze (this wave)
    turn:{max:8,wave:'reset'}                                                     // Turns of the wheel (this wave)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share, and his capped groups */
  always:[
    {on:'hit',reqAny:RF,if:{auto:true,targetTeam:'enemy'},do:[{ustack:'tap',on:'target',add:1}]},                            // Ring False: his basic attacks on one enemy
    {on:'tapFull',reqAny:RF,do:[{mark:'rf',on:'target',dur:P('rf.dur',5),longest:true},{ustack:'tap',on:'target',set:0}]},  //   the 3rd: it Rings False for 5 s (Quick Ear: longer)
    {on:'hit',reqAny:FRAC,if:{casting:GZ,targetTeam:'enemy',targetHas:'rf'},do:[{ustack:'frac',on:'target',add:1}]},          // Fracture: Glazebreaker on an enemy that Rings False
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                                    // his damage-reduction talents: ONE capped group (myDr)
    {on:'in',reqAny:SHARD,if:{hitMin:{pct:0.15,of:'maxHp'},stackMin:{shard:1}},less:P('shard.k',0),do:[{stack:'shard',spend:1,then:[{emit:'shardBreak'}]}]},   // Kin Shards: a big hit
    {on:'cast',reqAny:VES,skill:SV,do:[{window:'vessel',dur:{opt:'dur',d:5}},{fn:'vesselCast'}]},                            // Sealed Vessel holds (its own time)
    {on:'end:vessel',reqAny:COAT,do:[{stack:'coat',add:1}]},                                                                  //   it ends: a Coat
    {on:'waveEnd',reqAny:VES,do:[{window:'vessel',end:true}]},
    {on:'hit',reqAny:TURN,if:{auto:true,targetTeam:'enemy'},do:[{stack:'turn',add:1}]},                                       // Turns: each basic attack
    {on:'cast',reqAny:TURN,skill:KS,do:[{stack:'turn',set:0}]},                                                               //   Grand Kiln Shape spends them (after its hits)
    {on:'ccHit',reqAny:KH,if:{casting:KS,cc:['stunned'],talent:false},do:[{fn:'khOn'}]},                                      // Kiln-Hot: each enemy Grand Kiln Shape stuns
    {on:'wave',reqAny:JAR,do:[{fn:'jarSet'}]}, {on:'waveEnd',reqAny:JAR,do:[{fn:'jarClear'}]},                                // the Evening Jar: set aside each wave
    {on:'teamIn',reqAny:['ow_2_3','ow_13_3'],if:{srcTeam:'enemy',targetTeam:'ally'},do:[{fn:'jarIn'}]},                       //   an ally holding it takes less
    {on:'crit',reqAny:CRIT,if:{targetTeam:'enemy'},chance:{flat:1,x:{fn:'critP'}},force:true},                                // his critical-chance talents: ONE capped group (critP)
    {on:'tick',reqAny:SLW,do:[{weaken:'slowMul',by:{flat:1,x:{fn:'slw'}}}]},                                                  // slows on him weaker: ONE capped group
    {on:'tick',reqAny:FAST,do:[{fn:'clayFast'}]},                                                                             // Fired Clay's clock, faster
    {on:'tick',reqAny:REGEN,period:1,do:[{fn:'regen'}]},                                                                      // his healing each second, at the regeneration cap
    {on:'wave',do:[{fn:'keep'}]}                                                                                         // (the API kept for drK / critP read from outside a row: the 95% instrument)
  ],
  talents:{
    /* ============================== RINGS FALSE ============================== */
    rf_1_1:[ {on:'out',if:{targetHas:'rf'},more:R(0.02)} ],                                                       // Tap and Listen (Ring False itself: the always rows)
    rf_2_3:[ {stat:{move:R(0.03)}} ],                                                                             // Potter's Gait
    rf_1_4:[ {stat:{armor:R(-0.01)},to:{team:'enemy',ust:{frac:1}},per:{ust:'frac',of:'target'}} ],               // Hairline (Fracture itself: the always row)
    rf_2_1:[ {param:'rf.dur',add:R(1)} ],                                                                         // Quick Ear
    rf_2_2:[ {on:'out',if:{casting:GZ},more:R(0.03)} ],                                                           // Paddle Weight
    rf_3_1:[ {param:'tap.n',add:-1} ],                                                                            // Found the Place
    rf_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                    // Through the Glaze
    rf_3_4:[ {on:'teamIn',if:{targetTeam:'enemy',srcIs:'ally'},more:R(0.004),per:{ust:'frac',of:'target'}} ],      // Deep Fracture
    rf_4_2:[ {on:'kit',skill:GZ,opt:{shred:{more:R(0.02)}}} ],                                                    // Glaze Shatter (multiplies the cut: 42.1% -> 44.6% at 3/3)
    rf_4_3:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                            // Wide Swing
    rf_5_4:[ {stat:{move:R(-0.02)},to:{team:'enemy',has:'rf'}} ],                                                 // Brittle
    rf_5_1:[ {param:'dr.frm',add:R(0.02)} ],                                                                      // Clay Pit Hide (in myDr)
    rf_6_1:[ {param:'crit.rf',add:R(0.015)} ],                                                                    // Ear for It (in critP)
    rf_7_3:[ {on:'out',if:{casting:KS},more:R(0.03)} ],                                                           // Frontline Breaker
    rf_6_4:[ {stat:{atk:R(-0.03),apow:R(-0.03)},to:{team:'enemy',has:'rf'}} ],                                    // Weak Seam
    rf_8_3:[ {param:'dr.sw',add:R(0.01)} ],                                                                       // Steady Wheel (in myDr)
    rf_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                               // Glaze Paddle
    rf_9_3:[ {param:'crit.frac',add:R(0.002)} ],                                                                  // Uneasy Strength (in critP)
    rf_5_2:[ {on:'hit',if:{casting:GZ,targetTeam:'enemy',targetHas:'rf'},do:[{later:[{fn:'beat'}]}]} ],           // Beat Until It Gives (PICK ONE): after the skill wrote its cut
    rf_5_3:[ {on:'out',if:{casting:GZ,targetHas:'rf'},more:0.40,do:[{fn:'cbMark'}]},                              // Clean Break (PICK ONE)
             {on:'hit',if:{casting:GZ,fn:'cbNow'},do:[{mark:'rf',on:'target',clear:true}]}, {on:'cast',skill:GZ,do:[{fn:'cbClear'}]} ],                     //   and the Ring False ends (after this hit's Fracture)
    rf_7_4:[ {on:'hit',if:{casting:KS,targetTeam:'enemy'},do:[{ustack:'frac',on:'target',add:R(1)}]} ],           // Fractured Line
    rf_9_1:[ {on:'death',if:{unitHas:'rf'},do:[{mark:'rf',on:{team:'enemy',of:'unit',n:1},dur:R(1),longest:true}]} ],   // Listen Again
    rf_10_2:[ {stat:{armor:R(0.02)},if:{fn:'clayAtCap'}} ],                                                       // Shaped Hands
    rf_6_3:[ {on:'hit',if:{casting:GZ,fn:'cbNow'},do:[{dmg:{pct:R(0.10),of:'hit'},on:{team:'enemy',of:'target',within:1.5,skip:'target'}}]} ],   // Shard Spray
    rf_9_4:[ {on:'fracFull',if:{targetLacks:'gave'},do:[{mark:'gave',on:'target',dur:2,ends:'gaveEnd'}]},         // It Gives: at 5 Fracture its armour is zero for 2 s,
             {on:'gaveEnd',do:[{ustack:'frac',on:'target',set:0}]},                                               //   then its Fracture empties
             {stat:{armor:-1},to:{team:'enemy',has:'gave'}} ],
    rf_10_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},do:[{fn:'rhythm'}]} ],                                  // Rhythm of the Paddle: every 3rd in a row on one enemy
    rf_10_4:[ {on:'death',if:{unitUst:{frac:1}},do:[{heal:{pct:R(0.004),of:'maxHp',x:{ust:'frac',of:'unit'}}}]} ], // Shard Harvest
    rf_11_1:[ {param:'slw.a',add:R(0.04)} ],                                                                      // Clay Weight (in slw)
    rf_11_2:[ {on:'ccHit',if:{casting:KS,cc:['stunned'],talent:false},do:[{mark:'rf',on:'target',dur:P('rf.dur',5),longest:true}]} ],   // Kiln Shape Rings
    rf_11_3:[ {param:'clay.fast',add:R(0.2)} ],                                                                   // Long Firing (clayFast)
    rf_12_2:[ {on:'hit',if:{targetTeam:'enemy',targetHas:'rf'},do:[{heal:{pct:R(0.01),of:'hpLost'}}]} ],          // All of Them False
    rf_12_3:[ {param:'dr.rf',add:R(0.015)} ],                                                                     // Tessel Blue (in myDr)
    rf_12_4:[ {on:'death',if:{unitUst:{frac:1}},do:[{heal:{pct:R(0.01),of:'maxHp',x:{ust:'frac',of:'unit'}},on:{team:'ally',others:true,order:'lowHp',n:1}}]} ],   // Swept Up: 50% per rank of Shard Harvest's 2% (5/5)
    rf_13_2:[ {on:'out',if:{casting:GZ,targetUst:{frac:5}},do:[{window:'tessel',dur:0.01,cd:25},{fn:'tessel'}]} ],   // Four Hundred Years on the Floor (SIGNATURE)
    /* ============================== CARRYING THE TOWN ============================== */
    ct_5_1:[ {stat:{move:R(0.03)}} ],                                                                             // Heavy Step
    ct_1_3:[ {param:'dr.coat',add:R(0.005)} ],                                                                    // Second Coat (Coats: the always rows; in myDr)
    ct_1_4:[ {param:'shard.k',add:R(0.10)} ],                                                                     // Grandmother's Shard (Kin Shards: the always row)
    ct_2_3:[ {stat:{hp:R(0.003)},per:'coat'} ],                                                                   // Thick Glaze
    ct_2_4:[ {param:'shard.n',add:R(1)} ],                                                                        // More of the Shelf
    ct_3_1:[ {param:'clay.cap',add:R(0.01)} ],                                                                    // White Plates (points; in myDr)
    ct_3_2:[ {stat:{atk:R(0.03)},if:{window:'vessel'}} ],                                                         // Heavy Paddle
    ct_n1:[ {param:'dr.sotw',add:0.05}, {on:'shardBreak',do:[{window:'sotw',dur:3}]},                             // Shards on the Wheel (LINK; in myDr)
            {on:'shardBreak',req:'ow_1_4',do:[{stack:'turn',add:4}]} ],                                           //   with Lump on the Wheel: 4 Turns (never past 8)
    ct_3_4:[ {on:'cast',skill:SV,do:[{stack:'shard',add:1}]} ],                                                   // Swept and Refired
    ct_4_2:[ {on:'out',if:{casting:GZ},more:R(0.05)} ],                                                           // Pottery Paddle
    ct_4_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                                // Jar Ready
    ct_4_4:[ {on:'ccIn',less:R(0.04)} ],                                                                          // Unhurried Hands (up to 20%: its own full rank)
    ct_6_3:[ {on:'kit',skill:SV,opt:{dur:{add:R(0.2)}}} ],                                                        // Vessel Strength
    ct_5_2:[ {on:'cast',skill:SV,do:[{heal:{pct:P('rg.h',0.04),of:'maxHp'}}]} ],                                  // River Glaze (PICK ONE): the jar breaks at the cast
    ct_5_3:[ {param:'bg',add:0.15} ],                                                                             // Blue Glaze (PICK ONE; in myDr)
    ct_6_4:[ {stat:{atk:R(0.01)},per:{stack:'shard',missing:true}} ],                                             // Fragments
    ct_6_1:[ {param:'slw.b',add:R(0.10)} ],                                                                       // Painted River (in slw)
    ct_6_2:[ {param:'rg.h',add:R(0.01)} ],                                                                        // Running Water
    ct_7_1:[ {param:'clay.fast',add:R(0.2)} ],                                                                    // Fired by Blows (clayFast)
    ct_7_2:[ {on:'shardBreak',do:[{window:'sure',dur:4}]}, {param:'crit.sure',add:R(0.01)} ],                     // Eye on the Shelf (was Sure Strike; in critP)
    ct_7_4:[ {param:'clay.hall',add:1} ],                                                                         // The Long Hall (in myDr)
    ct_8_2:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                            // Broad Paddle
    ct_8_3:[ {param:'st.h',add:R(0.0024)} ],                                                                      // Set Tight (regen)
    ct_8_4:[ {param:'dr.bs',add:R(0.01)} ],                                                                       // Big Shoulders (in myDr)
    ct_9_1:[ {stat:{atk:R(0.004)},per:'coat'} ],                                                                  // Glazed Fists
    ct_9_3:[ {on:'ccIn',if:{window:'vessel',cc:['stunned']},mul:0},                                               // Sealed Tight: no stun lands while Sealed Vessel holds,
             {on:'tick',if:{window:'vessel'},do:[{timer:'_gearImmovableT',min:0.1,on:'self'},{fn:'unstun'}]} ],   //   none written straight on stays, and nothing moves him
    ct_10_2:[ {stat:{aspd:R(0.005)},per:'coat'} ],                                                                // Thrown Each Evening
    ct_10_3:[ {on:'out',if:{casting:KS},more:R(0.04)} ],                                                          // Kiln Patience
    ct_10_4:[ {param:'dr.shelf',add:R(0.004)} ],                                                                  // Shelf of Names (in myDr)
    ct_11_1:[ {param:'dr.back',add:R(0.015)} ],                                                                   // River Mask (in myDr)
    ct_11_3:[ {param:'dr.crit',add:R(0.03)} ],                                                                    // Hard Fired (in myDr)
    ct_11_4:[ {on:'shardBreak',once:'fight',if:{stackEmpty:'shard'},do:[{stack:'shard',set:'max'}]} ],            // Nobody Left Behind
    ct_12_1:[ {param:'coat.max',add:R(1)} ],                                                                      // Painted Mask
    ct_12_3:[ {on:'hurt',if:{crit:true},do:[{shield:{pct:R(0.01),of:'maxHp'},dur:3,mode:'max'}]} ],               // Never Cracked (tops his shield up to that size)
    ct_12_4:[ {param:'dr.low',add:R(0.03)} ],                                                                     // Old Clay (in myDr)
    ct_13_3:[ {on:'shardBreak',if:{stackMin:{coat:4}},do:[{window:'town',dur:5,cd:30},{stack:'shard',set:'max'},{after:0,do:[{castSkill:'blue',on:'self'}]}]} ],   // Most of the Town (SIGNATURE; the halving: myDr)
    /* ============================== ON THE WHEEL ============================== */
    ow_1_1:[ {param:'kh.burn',add:R(0.03)} ],                                                                     // Kiln Heat (Kiln-Hot: the always row; khOn)
    ow_2_2:[ {stat:{move:R(0.03)}} ],                                                                             // Wheel Gait
    ow_1_4:[ {on:'out',if:{casting:KS},more:R(0.02),per:'turn'} ],                                                // Lump on the Wheel (Turns: the always rows)
    ow_2_3:[ {param:'jar.r',add:R(0.01)} ],                                                                       // The Evening Jar (jarSet, jarIn)
    ow_2_4:[ {stat:{aspd:R(0.005)},per:'turn'} ],                                                                 // Fast Wheel
    ow_3_1:[ {param:'kh.dur',add:R(0.5)} ],                                                                       // Long in the Kiln
    ow_3_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                    // Glazer's Eye
    ow_4_3:[ {on:'teamHeal',if:{fn:'jarUnit'},more:R(0.03)}, {on:'healMe',if:{fn:'jarSelf'},more:R(0.03)} ],      // Jar Lid
    ow_3_4:[ {on:'kit',skill:KS,if:{stackMin:{turn:8}},opt:{radius:{mul:1.5}}} ],                                 // Thrown Shape
    ow_4_2:[ {param:'ks.stun',add:R(0.1)}, {on:'ccHit',if:{casting:KS,cc:['stunned'],talent:false},do:[{fn:'mold'}]} ],   // Bigger Mold
    ow_5_2:[ {param:'fw.sh',add:0.15}, {on:'tick',do:[{fn:'jarSave'}]} ],                                         // For Whoever Needs It (PICK ONE)
    ow_5_3:[ {param:'jar.self',add:1} ],                                                                          // For Grandmother (PICK ONE; jarSet, in myDr)
    ow_5_1:[ {on:'out',if:{targetHas:'kh'},more:R(0.015)} ],                                                      // Kiln Glow
    ow_6_2:[ {param:'fw.sh',add:R(0.03)} ],                                                                       // One Jar Each Evening
    ow_5_4:[ {param:'dr.khm',add:R(0.02)} ],                                                                      // Clay Skin (in myDr)
    ow_6_1:[ {stat:{move:R(-0.06)},to:{team:'enemy',has:'kh'}} ],                                                 // Hot Glaze
    ow_6_3:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                            // Shaped Blow
    ow_6_4:[ {param:'dr.c8',add:R(0.02)} ],                                                                       // Centred (in myDr)
    ow_7_1:[ {stat:{mr:R(-0.02)},to:{team:'enemy',has:'kh'}} ],                                                   // Open the Kiln
    ow_7_2:[ {on:'cd',skill:'green',add:R(-0.15)} ],                                                              // Breaker's Rhythm
    ow_7_4:[ {param:'crit.t8',add:R(0.01)} ],                                                                     // Throwing Hands (in critP)
    ow_8_2:[ {param:'slw.c',add:R(0.08)} ],                                                                       // Wet Clay (in slw)
    ow_9_2:[ {stat:{armor:R(0.02)},if:{fn:'jarUp'}} ],                                                            // Hall of Jars
    ow_9_1:[ {on:'death',if:{unitHas:'kh'},do:[{fn:'khBurst'}]} ],                                                // Kiln Opens
    ow_10_3:[ {on:'out',if:{casting:KS},more:R(0.03)} ],                                                          // Grand Shape
    ow_9_4:[ {on:'wave',do:[{stack:'turn',add:R(1)}]} ],                                                          // Spin It Up
    ow_10_1:[ {param:'fa.h',add:R(0.001)} ],                                                                      // Fired Again (regen)
    ow_10_4:[ {on:'cast',skill:GZ,chance:R(0.2),do:[{stack:'turn',add:2}]} ],                                     // Wheel Momentum
    ow_11_2:[ {param:'clay.fast',add:R(0.2)} ],                                                                   // Fired Clay Heart (clayFast)
    ow_11_3:[ {on:'cast',skill:KS,do:[{shield:{pct:P('hog',0.10),of:'maxHp'},dur:6,on:{team:'ally',within:4,others:true}}]} ],   // Hands on the Ground
    ow_11_4:[ {stat:{armor:R(0.003)},per:'turn'} ],                                                               // Steady Turning
    ow_12_1:[ {param:'wk',add:R(0.5)} ],                                                                          // Warm Kiln (regen)
    ow_12_3:[ {param:'hog',add:R(0.02)} ],                                                                        // Shaped for Them
    ow_12_4:[ {param:'dr.mr',add:R(0.01)} ],                                                                      // Mask of the River (in myDr)
    ow_13_3:[ {on:'kit',skill:KS,if:{stackMin:{turn:8}},do:[{window:'hnd',dur:0.01,cd:30},{fn:'hndArm'}]},        // He Has Not Decided (SIGNATURE): 8 Turns spent, once every 30 s
              {on:'hit',if:{casting:KS,targetTeam:'enemy',fn:'hndOn'},do:[{fn:'khOn'}]},                          //   every enemy it hits is Kiln-Hot
              {on:'cast',skill:KS,if:{fn:'hndOn'},do:[{mark:'jar6',on:{team:'ally',within:6,others:true},dur:6},{cd:'green',set:0},{cd:'blue',set:0},{fn:'hndOff'}]} ]
  },
  fn:{
    keep(A,T){ T.s.api=A; },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP. Every talent of his that makes a hit on him smaller multiplies here (each takes its share of what is left), and
       together they never take more than 30% off a hit (DR_CAP). Most of the Town: for its 5 s every hit is halved, in place of the others (not on top).
       Blue Glaze (Sealed Vessel's reduction 15% stronger, multiplied) and White Plates / The Long Hall (Fired Clay's cap and stacks) are counted here
       as the share they add to what the game's own Sealed Vessel and Fired Clay already take off. Kin Shards are not in it (a one-time piece of a big hit). ---- */
    drK(A,T,u,src,kind,crit){ const P=T.P, s=T.s, E=A&&A.eng&&A.eng(), now=E?E.now():0;
      if(winN(T,'town')) return 1-DR_TOWN;
      let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      cut(P['dr.sw']); cut(P['dr.bs']); cut(P['dr.mr']);
      if(P['dr.coat']) cut(P['dr.coat']*stN(T,'coat'));
      if(P['dr.shelf']) cut(P['dr.shelf']*stN(T,'shard'));
      if(P['dr.back']&&src&&src.t&&src.t.row==='Back') cut(P['dr.back']);
      if(P['dr.crit']&&crit) cut(P['dr.crit']);
      if(P['dr.low']&&u.hp<0.3*u.maxHp) cut(P['dr.low']);
      if(P['dr.rf']&&mk(u,src,'rf',now)) cut(P['dr.rf']);
      if(P['dr.frm']&&kind==='magic'&&ust(u,src,'frac',now)>0) cut(P['dr.frm']);
      if(P['dr.khm']&&kind==='magic'&&mk(u,src,'kh',now)) cut(P['dr.khm']);
      if(P['dr.c8']&&stN(T,'turn')>=8) cut(P['dr.c8']);
      if(P['dr.sotw']&&winN(T,'sotw')) cut(P['dr.sotw']);
      if(P['jar.self']) cut(2*(P['jar.r']||0));                                                  // For Grandmother: he holds the Evening Jar, at double strength
      if(P.bg&&winN(T,'vessel')&&(u.drT||0)>0&&s.vMul!=null&&Math.abs(u.drMul-s.vMul)<1e-9){ const r0=1-s.vMul; if(r0>0&&r0<1){ const r1=Math.min(0.95,r0*(1+P.bg)); k*=(1-r1)/(1-r0); } }
      if((P['clay.cap']||P['clay.hall'])&&E&&E.wardenCut){ const c=T.fn.clay(A,T,u); if(c.c1>c.c0) k*=(1-c.c1)/(1-c.c0); }
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ T.s.api=A; c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.crit); },
    /* Fired Clay as his talents change it: c0 = what the game's passive takes off now (0 before its first stack), c1 = with White Plates (its cap 1 point per
       rank higher), The Long Hall (each Coat counts as one of its stacks, never past its 5, and its cap 4 points higher); cap1 = the raised cap */
    clay(A,T,u){ const E=A.eng(), P=T.P, on=!!(u.pass&&u.pass.warden), st=on?(u.wardenStk||0):0, c0=(on&&st>0)?E.wardenCut(u):0;
      if(!on) return {c0:0,c1:0,cap1:0}; const hall=!!P['clay.hall'], cap1=E.wardenCap(u)+(P['clay.cap']||0)+(hall?0.04:0), st1=Math.min(5,st+(hall?stN(T,'coat'):0));
      return {c0,c1:Math.min(cap1,0.04*(u.passMul||1)*st1),cap1}; },
    clayAtCap(A,T,u){ const c=T.fn.clay(A,T,u); return c.c1>0&&c.c1>=c.cap1-1e-9; },
    /* Fired Clay's clock: each stack 0.2 s sooner per rank of Long Firing, Fired by Blows and Fired Clay Heart, never sooner than one every 1.5 s */
    clayFast(A,T,u,c){ if(!(u.pass&&u.pass.warden)||(u.wardenStk||0)>=5) return; const p=Math.max(CLAY_FASTEST,3-(T.P['clay.fast']||0)); u.wardenT=(u.wardenT||0)+(c.dt||0)*(3/p-1); },
    /* ---- HIS CRITICAL CHANCE, ONE GROUP: Ear for It (the target Rings False), Uneasy Strength (each Fracture on it), Eye on the Shelf (4 s after a Kin Shard
       breaks) and Throwing Hands (at 8 Turns), together at most 5% (Phil: crit rate talents at most 5% per hero). An extra seeded chance on his hit ---- */
    critP(A,T,u,c){ const P=T.P, t=c.tgt, now=A.eng().now(); let p=0;
      if(P['crit.rf']&&mk(u,t,'rf',now)) p+=P['crit.rf'];
      if(P['crit.frac']) p+=P['crit.frac']*ust(u,t,'frac',now);
      if(P['crit.sure']&&winN(T,'sure')) p+=P['crit.sure'];
      if(P['crit.t8']&&stN(T,'turn')>=8) p+=P['crit.t8'];
      return Math.min(CRIT_CAP,p); },
    /* slows on him: Clay Weight, Painted River and Wet Clay multiply; together a slow is at most 40% weaker */
    slw(A,T){ const P=T.P; return Math.min(SLOW_CAP,1-(1-(P['slw.a']||0))*(1-(P['slw.b']||0))*(1-(P['slw.c']||0))); },
    /* ---- each second: Set Tight (while Sealed Vessel holds) and Fired Again (per Kiln-Hot enemy) heal him, together at most 1.2% of his max HP a second (the
       game's regeneration cap); Warm Kiln heals the Evening Jar's holder half of Fired Again's per rank, at most 1.2% of its own max HP a second ---- */
    regen(A,T,u){ const P=T.P, E=A.eng(), now=E.now(); let n=0;
      if(P['fa.h']){ const U=E.units(); for(let i=0;i<U.length;i++){ const x=U[i]; if(x.alive&&x.team!==u.team&&mk(u,x,'kh',now)) n++; } }
      const fa=(P['fa.h']||0)*n, h=T.s.m.jar, holder=(h&&h.alive&&mk(u,h,'jar',now))?h:null;
      let a=(P['st.h']&&winN(T,'vessel')?P['st.h']:0)+fa; if(P.wk&&holder===u) a+=fa*P.wk;
      if(a>0) E.healUnit(u,Math.min(REGEN_CAP,a)*u.maxHp);
      if(P.wk&&fa>0&&holder&&holder!==u) E.healUnit(holder,Math.min(REGEN_CAP*holder.maxHp,fa*P.wk*u.maxHp)); },
    /* ---- RING FALSE and FRACTURE ---- */
    beat(A,T,u,c){ const t=c.tgt; if(t&&t.alive&&(t._shredT||0)>0) t._shredT+=1; },
    cbMark(A,T,u,c){ T.s.cb=c.tgt?c.tgt.uid:null; T.s.cbAt=A.eng().now(); },
    cbClear(A,T){ T.s.cb=null; },
    cbNow(A,T,u,c){ return !!c.tgt&&T.s.cb===c.tgt.uid&&T.s.cbAt===A.eng().now(); },
    rhythm(A,T,u,c){ const s=T.s, t=c.tgt; if(!t) return; if(s.rhT===t.uid) s.rhN=(s.rhN||0)+1; else { s.rhT=t.uid; s.rhN=1; }
      if(s.rhN%3===0) c.amt*=1+0.06*(T.r.rf_10_1||0); },
    tessel(A,T,u,c){ c.amt*=3; const d=5+(T.P['rf.dur']||0), on={team:'enemy',of:'target',within:4};
      A.acts(T,u,[{mark:'rf',on,dur:d,longest:true},{ustack:'frac',on,add:3}],c); },
    /* ---- SEALED VESSEL ---- */
    vesselCast(A,T,u){ T.s.vMul=u.drMul; },
    unstun(A,T,u){ if((u.stunned||0)>0) u.stunned=0; },
    /* ---- GRAND KILN SHAPE: Kiln-Hot (6 s, Long in the Kiln longer; Kiln Heat's burn of his attack each second, a talent burn: its stated amount), the stun
       lengthened in full after it lands (Bigger Mold; cut only at the ceiling without the 30% cut, 4.0 s), He Has Not Decided armed at the cast ---- */
    khOn(A,T,u,c,a){ const t=c.tgt; if(!t||!t.alive||t.team===u.team) return; const d=(a&&a.dur)||(6+(T.P['kh.dur']||0)), b=T.P['kh.burn']||0;
      const L=[{mark:'kh',on:'target',dur:d,longest:true}]; if(b>0) L.push({dot:'kh',on:'target',amt:{pct:b,of:'atk'},dur:d,every:1,refresh:true,color:'#e07a3a'});
      A.acts(T,u,L,Object.assign({},c,{tgt:t})); },
    khBurst(A,T,u,c){ for(const x of A.pick(T,u,{team:'enemy',of:'unit',within:2},c)) T.fn.khOn(A,T,u,{tgt:x},{dur:3}); },
    mold(A,T,u,c){ const t=c.tgt, E=A.eng(), x=T.P['ks.stun']||0; if(!t||!t.alive||!(x>0)||!((t.stunned||0)>0)) return;
      const top=(E.ccCap('stunned')||2.8)/(E.ccDur(1)||1); t.stunned=Math.max(t.stunned,Math.min(top,t.stunned+x)); },
    hndArm(A,T){ T.s.hnd=true; }, hndOn(A,T){ return !!T.s.hnd; }, hndOff(A,T){ T.s.hnd=false; },
    /* ---- THE EVENING JAR. Each wave's start: the ally with the lowest HP (a team-mate, never a summon; For Grandmother: Hobb himself) holds it until the wave
       ends; it takes 1% less damage per rank (For Grandmother: Hobb, 2% per rank, in his group). He Has Not Decided's jars: every ally within 6 m for 6 s, a full
       jar (5%); one ally never counts two jars ---- */
    jarSet(A,T,u){ const E=A.eng(); let h=null;
      if(T.P['jar.self']) h=u; else { for(const x of E.units()) if(x.alive&&x.team===u.team&&x!==u&&!x._summon&&(!h||x.hp<h.hp)) h=x; }
      if(h) A.setMark(T,u,h,'jar',{unique:true}); T.s.fwW=-1; },
    jarClear(A,T,u){ const h=T.s.m.jar; if(h) A.clearMark(u,h,'jar'); T.s.m.jar=null; },
    jarIn(A,T,u,c){ const t=c.tgt, now=A.eng().now(); let x=0; if(!t||t===u) return;
      if(!T.P['jar.self']&&mk(u,t,'jar',now)) x=T.P['jar.r']||0; if(mk(u,t,'jar6',now)) x=Math.max(x,0.05); if(x>0) c.amt*=1-x; },
    jarUnit(A,T,u,c){ const t=c.unit, now=A.eng().now(); return !!t&&t!==u&&(mk(u,t,'jar',now)||mk(u,t,'jar6',now)); },
    jarSelf(A,T){ return !!T.P['jar.self']; },
    jarUp(A,T,u){ const h=T.s.m.jar; return !!h&&h.alive&&mk(u,h,'jar',A.eng().now())&&h.hp>0.5*h.maxHp; },
    /* For Whoever Needs It: once a wave, when the holder (not Hobb) drops below 30% HP, a shield of 15% of its max HP (One Jar Each Evening: more) for 6 s, and the
       jar passes to the ally with the lowest HP after it */
    jarSave(A,T,u){ const s=T.s, h=s.m.jar, E=A.eng(); if(s.fwW===s.wave||!h||h===u||!h.alive||!mk(u,h,'jar',E.now())||!(h.hp<0.3*h.maxHp)) return;
      s.fwW=s.wave; A.acts(T,u,[{shield:{pct:T.P['fw.sh']||0.15,of:'tgtMaxHp'},dur:6,on:'target'}],{u,tgt:h});
      let nx=null; for(const x of E.units()) if(x.alive&&x.team===u.team&&x!==u&&x!==h&&!x._summon&&(!nx||x.hp<nx.hp)) nx=x;
      A.clearMark(u,h,'jar'); s.m.jar=null; if(nx) A.setMark(T,u,nx,'jar',{unique:true}); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/27 - HOBB KILNMASK - talent decisions.md) */
  ruling:{}
};
