/* VEX - what her learned talents do in a fight (the mechanics; her 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (section 13: what Vex added)
   Her real kit (the code, not the tooltip wording):
   - Hookline ('hookline', green, cd 8): picks its mark - the lowest-max-HP back-row Mage within 28 m (o.range, centre to centre), else the lowest-max-HP
     enemy in reach - throws the rope and reels her in (an air dash of about 0.73 s, rooted). When she lands BEHIND the mark: one strike of
     attack x o.mul (160%) x o.crit (1.5, a flat multiplier: the strike still rolls its own crit like any hit), then she cannot be targeted for o.evade (0.5 s).
     Page hooks: skillTgt (the mark, the options), landPre (the strike is Hookline's: casting 'hookline'), land (she has landed behind it).
   - Bleed Them Dry ('dot', blue, cd 9): 120% attack up front, then a bleed (#c0392b, physical: armor applies to each tick) of 30% attack a second for 6 s.
   - Razor Tempest ('triplecleave', ult): three cuts of 80% attack on every enemy in a 45-degree wedge 10 m deep, all at once (only the rings are
     staggered), and a 3 s bleed of 12% attack a second on each enemy struck.
   - Killer Instinct (passive): at each basic attack's SWING (before the blow lands, hit or miss) the target's wound timer (mortalT, the game's one
     "half healing" timer that other effects also use) is raised to 3 s x her passive's level multiplier. Page hooks passPre / pass.
   - Her basic attacks and skills are physical. She has no dodge of her own: the game's Evasion stat (glyphs) is a separate MISS roll.
   "Her bleeds" = the DoTs of her skills (tagged hers at the cast) and of her talents. "Killer Instinct on an enemy" = her mark 'ki', set with the wound.
   Talents whose text cannot run against that kit are NOT guessed at: they are written up for the owner in WIRING/07 - VEX - talents that need a ruling.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const RED='#c0392b';
const KIDUR={pct:P('ki.dur',3),of:'passMul'};                                    // Killer Instinct's wound: 3 s x her passive's level (Ragged Edges: 5 s)
const KI_TAL=[{timer:'mortalT',on:'target',min:KIDUR,if:{np:'cc'}},{mark:'ki',on:'target',dur:KIDUR},{ustack:'dw',on:'target',touch:true}];   // a talent that "applies Killer Instinct"
const KIC={unitHas:'ki',unitMin:{mortalT:1e-9},np:'cc'};                         // a heal on an enemy whose healing her Killer Instinct is cutting now
const ME='self', HK={skill:'hookline'};
const BURST={team:'enemy',of:'target',within:3};                                  // the target and every enemy within 3 m of it (body to body)
module.exports={
  hero:'vex',
  casting:true,                         // rows ask which of her skills a hit comes from (Hookline's strike, Razor Tempest's cuts)
  states:{
    coil:{max:6,wave:'reset'}, ck:{}, hkSp:{}, ff:{}, hang:{max:5}, chn:{max:3}, ag3:{max:3},
    dw:{unit:true,max:{b:5,$:'dw.max'},dur:KIDUR,longest:true},                  // Deep Wounds, on each enemy: lapse with the wound
    drip:{max:20,fade:{after:P('drip.wait',0),every:1,lose:1,unless:{anyDot:true}}},
    den:{max:{pct:{b:3,$m:'den.more'},of:'dmg'}}, denF:{},                        // Denied: full at 3 x her Attack stat
    lp:{max:1,start:'max'},                                                        // Lockpick: ready, or recharging
    patter:{max:10,wave:'reset'}, so:{max:3,wave:'reset'}
  },
  /* needs: a talent that improves a mechanic does nothing without the talent that introduces it */
  needs:{ rw_3_1:'rw_1_1', rw_4_1:'rw_1_1', rw_6_1:'rw_1_1', rw_8_1:'rw_1_1', rw_9_1:'rw_1_1', rw_12_1:'rw_1_1',
          rw_3_4:'rw_1_4', rw_5_4:'rw_1_4', rw_9_4:'rw_1_4', rw_10_4:'rw_1_4', rw_12_4:'rw_1_4',
          rw_4_2:'rw_2_2', rw_8_3:'rw_2_2', rw_8_2:'rw_2_2', rw_6_2:'rw_2_2', rw_5_2:'rw_2_2', rw_5_3:'rw_2_2', rw_10_2:'rw_2_2', rw_11_2:'rw_2_2', rw_12_2:'rw_2_2', rw_6_3:'rw_5_3',
          sc_2_1:'sc_1_1', sc_4_1:'sc_1_1', sc_6_1:'sc_1_1', sc_8_1:'sc_1_1', sc_12_1:'sc_1_1',
          sc_3_4:'sc_1_4', sc_5_4:'sc_1_4', sc_6_4:'sc_1_4', sc_7_4:'sc_1_4', sc_9_4:'sc_1_4', sc_10_1:'sc_1_4', sc_12_4:'sc_1_4', sc_10_4:'sc_9_4',
          sc_4_2:'sc_2_2', sc_6_2:'sc_2_2', sc_9_2:'sc_2_2', sc_10_2:'sc_2_2', sc_11_2:'sc_2_2', sc_12_2:'sc_2_2', sc_13_2:'sc_2_2', sc_6_3:'sc_5_3',
          sl_2_1:'sl_1_1', sl_3_1:'sl_1_1', sl_4_1:'sl_1_1', sl_7_1:'sl_1_1', sl_8_1:'sl_1_1', sl_10_1:'sl_1_1', sl_11_1:'sl_1_1',
          sl_4_2:'sl_1_2', sl_7_3:'sl_1_2', sl_8_2:'sl_1_2', sl_12_2:'sl_1_2',
          sl_3_4:'sl_1_4', sl_5_4:'sl_1_4', sl_6_4:'sl_1_4', sl_7_4:'sl_1_4', sl_9_3:'sl_1_4', sl_9_4:'sl_1_4', sl_11_4:'sl_1_4', sl_12_4:'sl_1_4', sl_n3:'sl_1_4',
          sl_6_2:'sl_5_2', sl_6_3:'sl_5_3' },
  /* run for her whenever she has any mechanic talent: her skills' bleeds made hers, Killer Instinct's wound as her mark; Denied's bookkeeping when learned */
  always:[
    {on:'kit',skill:'dot',do:[{tagDots:'kit'}]}, {on:'cast',skill:'dot',do:[{tagDots:'btd',exact:true,emit:'bleedOn'}]},
    {on:'kit',skill:'triplecleave',do:[{tagDots:'kit'}]}, {on:'cast',skill:'triplecleave',do:[{tagDots:'rt',emit:'bleedOn'}]},
    {on:'pass',do:[{emit:'swing'},{mark:'ki',on:'target',dur:KIDUR},{timer:'mortalT',on:'target',min:KIDUR,if:{np:'cc'}},{restore:'mortalT',on:'target',if:{p:'cc'}},{ustack:'dw',on:'target',touch:true}]},
    {on:'teamHeal',req:'sc_2_1',if:Object.assign({unitUst:{dw:5},p:'fest'},KIC),less:P('fest',0)},          // Festering: at 5 Deep Wounds the wound cuts more
    {on:'teamHeal',req:'sc_2_2',if:KIC,do:[{stack:'den',add:{pct:P('den',0),of:'a0'}},{stack:'den',add:{pct:P('den',0),of:'cut'}}]}   // Denied: a share of what the wound stopped
  ],
  talents:{
    /* ============================== THE ROPEWALKER ============================== */
    rw_1_1:[ {on:'hit',if:{auto:true},do:[{stack:'coil',add:1}]},                                    // Coiled Rope: a Coil per basic attack that lands
             {on:'skillAt',skill:'hookline',opt:{mul:{more:R(0.01),per:'coil'}},do:[{stack:'hkSp',set:{stack:'coil'}},{stack:'coil',spend:'all'}]} ],   //   Hookline spends them all
    rw_2_3:[ {stat:{move:R(0.03)}} ],                                                                 // Light Feet
    rw_1_4:[ {on:'land',skill:'hookline',do:[{mark:'blind',on:'target',dur:P('blind.dur',3)}]},       // Blindside: 3 s after she lands behind it
             {on:'out',if:{targetHas:'blind'},more:R(0.04)} ],
    rw_2_1:[ {on:'kit',skill:'hookline',opt:{range:{addM:R(1)}}} ],                                  // Long Throw
    rw_2_2:[ {on:'land',skill:'hookline',if:{targetAlive:true},do:[{emit:'snagLand',amt:P('snag.dur',2)}]},   // Snag: Hookline's mark, 2 s
             {on:'snagLand',do:[{mark:'snag',on:'target',dur:{pct:1,of:'hit'},longest:true},{emit:'snagOn'}]},
             {stat:{move:-1},to:{team:'enemy',has:'snag'}},                      //   it cannot move
             {on:'out',if:{targetHas:'snag'},more:R(0.02)} ],                                         //   and takes more from her
    rw_3_1:[ {on:'kit',skill:'hookline',do:[{stack:'hkSp',set:0}]}, {on:'cd',skill:'green',if:{stackMin:{hkSp:6}},add:-2} ],   // Hand over Hand
    rw_3_3:[ {on:'out',if:{any:[{casting:'hookline'},{targetHas:'blind'}]},ignoreArmor:R(0.03)} ],    // Through the Gap
    rw_3_4:[ {stat:{crit:R(0.03)},if:{targetHas:'blind'}} ],                                          // Knife in the Dark (her attacks on a Blindsided target)
    rw_4_1:[ {on:'hit',if:{auto:true},chance:R(0.10),do:[{stack:'coil',add:1}]} ],                    // Rope-Works Hands
    rw_4_2:[ {param:'snag.dur',add:R(0.3)} ],                                                         // Tight Line
    rw_4_3:[ {on:'kit',skill:'hookline',opt:{mul:{more:R(0.05)}}} ],                                  // Hook Edge
    rw_8_3:[ {on:'out',if:{targetHas:'snag'},critMore:R(0.04)} ],                                     // Ruthless
    rw_5_1:[ {on:'ccIn',less:R(0.04)} ],                                                              // Rolls With It
    rw_8_2:[ {on:'teamIn',if:{srcHas:'snag',srcTeam:'enemy'},less:R(0.02)}, {on:'in',if:{srcHas:'snag'},less:R(0.02)} ],   // Strangle Knot
    rw_5_4:[ {param:'blind.dur',add:R(0.3)} ],                                                        // Shadow Step
    rw_6_1:[ {on:'wave',do:[{stack:'coil',atLeast:R(1)}]} ],                                          // Slack Line
    rw_6_2:[ {on:'teamIn',if:{targetHas:'snag',srcTeam:'ally'},more:R(0.015)} ],                      // Gallows Knot (her whole team, her own hits too)
    rw_6_4:[ {on:'land',skill:'hookline',do:[{window:'ots',dur:99}]}, {on:'out',if:{window:'ots'},critMore:R(0.08),do:[{window:'ots',end:true}]} ],   // Over the Shoulder
    rw_7_1:[ {on:'out',if:{targetRow:'Back'},more:R(0.02)} ],                                         // Fragile Things
    rw_11_3:[ {on:'land',skill:'hookline',do:[{window:'qe',dur:2}]}, {on:'in',if:{window:'qe'},less:R(0.02)} ],   // Quick Exit
    rw_7_3:[ {on:'kit',skill:'triplecleave',opt:{mul:{more:R(0.03)}}} ],                              // Wide Arc
    rw_8_1:[ {stat:{aspd:R(0.003)},per:'coil'} ],                                                     // Dead Weight
    rw_5_2:[ {on:'snagOn',do:[{silence:{left:'snag',of:'target'},on:'target'}]} ],                    // Held Snag: silenced until the Snag ends
    rw_5_3:[ {on:'death',if:{unitHas:'snag'},do:[{cd:'green',mul:0.5},{emit:'cutLoose'}]} ],          // Cut Loose
    rw_7_4:[ {on:'kit',skill:'hookline',opt:{evade:{add:R(0.1)}}} ],                                  // Ghost Line
    rw_9_1:[ {on:'out',if:{auto:true,stackFull:'coil'},more:R(0.03)} ],                               // Coil Snap
    rw_9_3:[ {on:'out',if:{targetHpBelow:0.30},more:R(0.03)} ],                                       // Open Throat
    rw_6_3:[ {on:'cutLoose',do:[{window:'fr',dur:4}]}, {stat:{aspd:R(0.05)},if:{window:'fr'}} ],      // Free Run
    rw_9_4:[ {on:'kill',do:[{mark:'blind',on:{team:'enemy',n:1},dur:P('blind.dur',3)}]} ],           // Second Shadow (reading: no movement)
    rw_10_1:[ {on:'skillAt',skill:'hookline',do:[{dmg:{pct:R(0.05),of:'atk'},on:{team:'enemy',seg:true,within:0,skip:'target'},tag:'rope'}]} ],   // Rope Burn (reading: the straight rope)
    rw_10_2:[ {on:'snagLand',if:{targetHpBelow:0.50},add:R(0.2)} ],                                   // Noose
    rw_10_4:[ {on:'hit',if:{targetHas:'blind'},do:[{heal:{pct:R(0.02),of:'hpLost'},on:ME}]} ],        // Unseen
    rw_11_1:[ {on:'skillAt',skill:'hookline',do:[{stack:'ff',set:{pct:1,of:'gap'}}]},                 // Fifteen Feet: metres to the mark as it fires
              {on:'out',if:{casting:'hookline'},more:R(0.01),per:{stack:'ff',div:3,max:3}} ],
    rw_11_2:[ {on:'death',if:{unitHas:'snag'},do:[{mark:'snag',on:{team:'enemy',of:'unit',n:1},dur:{left:'snag',of:'unit'},longest:true},{emit:'snagOn',on:{team:'enemy',of:'unit',n:1}}]} ],   // Hanging Weight
    rw_12_1:[ {on:'waveEnd',do:[{stack:'ck',set:{stack:'coil',max:R(2)}}]}, {on:'wave',do:[{stack:'coil',atLeast:{stack:'ck'}}]} ],   // Rope Memory
    rw_12_2:[ {on:'snagLand',do:[{stack:'hang',add:1}]}, {stat:{atk:R(0.01)},per:'hang'} ],           // Hangman's Count
    rw_12_3:[ {on:'out',if:{any:[{targetHas:'snag'},{targetHas:'blind'}]},critMore:R(0.02)} ],        // Last Look
    rw_12_4:[ {on:'hit',if:{targetHas:'blind'},do:[{cd:'green',add:R(-0.2)}]} ],                      // Closing the Distance
    rw_13_2:[ {on:'landPre',skill:'hookline',do:[{mark:'hooked',on:'target',dur:4,ends:'hookEnd'}]},  // Nobody Picks the Distance (SIGNATURE)
              {on:'death',if:{unitHas:'hooked',noWindow:'chainLock'},do:[{mark:'hooked',on:'unit',clear:true},{cd:'green',set:0},{window:'chainNext',dur:99}]},   //   the mark dies within 4 s: ready at once
              {on:'hookEnd',if:{noWindow:'chainNext'},do:[{stack:'chn',set:0}]},                     //   it lived: the chain is broken
              {on:'kit',skill:'hookline',do:[{window:'chainHit',end:true}]},
              {on:'kit',skill:'hookline',if:{window:'chainNext'},do:[{window:'chainNext',end:true},{window:'chainHit',dur:99},{stack:'chn',add:1,full:[{window:'chainLock',dur:20},{stack:'chn',set:0}]}]},
              {on:'out',if:{window:'chainHit',casting:'hookline'},more:0.20},                         //   each chained hook 20% more; 3, then 20 s
              {on:'land',skill:'hookline',do:[{window:'chainHit',end:true}]} ],

    /* ============================== THE SLOW CUT ============================== */
    sc_1_1:[ {on:'swing',if:{targetHas:'ki'},do:[{ustack:'dw',on:'target',add:1}]},                  // Worrying the Cut: a swing on an enemy already wounded
             {on:'out',if:{targetUst:{dw:1}},more:R(0.004),per:{ust:'dw',of:'target'}} ],
    sc_2_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                    // Steady Hands
    sc_1_4:[ {on:'dotTick',icd:0.9,do:[{stack:'drip',add:1}]}, {stat:{aspd:R(0.001)},per:'drip'} ],  // Drip: each second one of her bleeds ticks
    sc_2_1:[ {param:'fest',add:R(0.10)} ],                                                            // Festering (the always row: 5% of the heal = 10% of what is left)
    sc_2_2:[ {param:'den',add:R(0.10)},                                                               // Denied (stored by the always row)
             {on:'cast',skill:'dot',do:[{stack:'denF',set:1,if:{stackFull:'den'}},{stack:'den',spend:'all',then:[{dotAdd:true,total:{pct:1,of:'spent'}},{emit:'denSpent'}]},{stack:'denF',set:0}]},
             {on:'waveEnd',if:{np:'den.keep'},do:[{stack:'den',set:0}]} ],
    sc_3_1:[ {param:'ki.dur',add:2} ],                                                                // Ragged Edges
    sc_3_3:[ {on:'kit',skill:'dot',opt:{mul:{more:R(0.03)},dps:{more:R(0.03)}}} ],                    // Serrated
    sc_3_4:[ {param:'drip.wait',add:R(0.4)} ],                                                        // Slow Pour
    sc_4_1:[ {stat:{crit:R(0.002)},per:{ust:'dw',of:'target'}} ],                                     // Open Again (her attacks on the enemy she is attacking)
    sc_4_2:[ {param:'den.more',add:R(0.2)} ],                                                         // Spite
    sc_4_3:[ {stat:{move:R(-0.03)},if:{anyDot:true},to:{team:'enemy',dot:true}} ],                                     // Thin Blood
    sc_5_1:[ {on:'kit',skill:'dot',opt:{dur:{add:R(0.4)}}} ],                                         // Long Bleed
    sc_5_3:[ {param:'cc',add:1}, {param:'cc.more',add:0.12}, {on:'out',if:{targetHas:'ki'},more:P('cc.more',0)} ],   // Clean Cut
    sc_5_4:[ {on:'dotOut',if:{stackMin:{drip:10}},more:R(0.03)} ],                                    // Pooling
    sc_6_1:[ {stat:{atk:R(-0.003)},per:{ust:'dw',of:'target'},to:{team:'enemy',ust:{dw:1}}} ],        // Weeping        // Weeping
    sc_6_2:[ {on:'denSpent',do:[{heal:{pct:R(0.04),of:'spent'},on:ME}]} ],                            // Bitter Draught
    sc_6_3:[ {param:'cc.more',add:R(0.03)} ],                                                         // Bare Bone
    sc_6_4:[ {stat:{atk:R(0.0015)},per:'drip'} ],                                                     // Red Hands
    sc_7_1:[ {on:'hit',if:{casting:'hookline'},do:KI_TAL.concat([{ustack:'dw',on:'target',add:R(1)}])} ],   // Hooked Wound
    sc_7_2:[ {on:'hit',if:{casting:'triplecleave'},do:KI_TAL.concat([{ustack:'dw',on:'target',add:1}])} ],  // Tempest of Wounds: each cut
    sc_7_3:[ {on:'kit',skill:'triplecleave',opt:{mul:{more:R(0.03)}}} ],                              // Wide Cuts
    sc_7_4:[ {on:'kit',skill:'dot',if:{stackFull:'drip'},opt:{mul:{more:R(0.05)},dps:{more:R(0.05)}},do:[{stack:'drip',spend:10}]} ],   // Patient Knife
    sc_8_1:[ {on:'teamHeal',if:{unitUst:{dw:1}},less:R(0.01),per:{ust:'dw',of:'unit'}} ],             // Nowhere to Mend
    sc_8_3:[ {on:'dotOut',if:{targetHpBelow:0.50},more:R(0.03)} ],                                    // Exsanguinate
    sc_9_2:[ {on:'dotTick',do:[{stack:'den',add:{pct:R(0.03),of:'hit'}}]} ],                          // Hoarded Spite
    sc_9_4:[ {on:'bleedOn',if:{stackFull:'drip'},do:[{copyDot:'flood',on:{team:'enemy',of:'target',n:1,skip:'target'},scale:{b:0.5,$m:'flood.more'}}]} ],   // Flood
    sc_10_1:[ {on:'death',if:{unitDot:true},do:[{stack:'drip',add:R(1)}]} ],                          // Bled Out
    sc_10_2:[ {on:'denSpent',do:[{mark:'nohl',on:'target',dur:R(0.5),longest:true}]}, {on:'teamHeal',if:{unitHas:'nohl'},mul:0} ],   // Spiteful
    sc_10_4:[ {param:'flood.more',add:R(0.06)} ],                                                     // Overflowing
    sc_11_1:[ {on:'dotTick',do:[{heal:{pct:R(0.01),of:'hit'},on:ME}]} ],                              // Leech the Cut
    sc_11_2:[ {param:'den.keep',add:1} ],                                                             // Bad Debt
    sc_11_3:[ {on:'dotTick',do:[{cd:'green',add:R(-0.05)}]} ],                                        // Quick Cuts
    sc_12_1:[ {param:'dw.max',add:R(1)} ],                                                            // Bone Deep
    sc_12_2:[ {stat:{atk:R(0.002)},per:{stack:'den',frac:10}} ],                                      // Dry to the Bone
    sc_12_3:[ {on:'dotOut',more:R(0.03)} ],                                                           // Steady Drain
    sc_12_4:[ {on:'hit',if:{casting:'triplecleave',stackFull:'drip'},do:[{dot:'rain',on:'target',amt:{pct:R(0.10),of:'hit'},total:true,dur:3,every:1,color:RED,emitDot:'bleedOn'}]} ],   // Red Rain
    sc_13_2:[ {on:'denSpent',icd:20,if:{stackMin:{denF:1}},do:[{burstDot:true,on:BURST,color:RED,tag:'burst'},{ustack:'dw',on:BURST,set:'max'},{mark:'nohl',on:BURST,dur:4,longest:true}]},   // Every Last Drop (SIGNATURE)
              {on:'teamHeal',if:{unitHas:'nohl'},mul:0} ],

    /* ============================== THE SHORT LIST ============================== */
    sl_1_1:[ {on:'tick',if:{stackEmpty:'lp'},period:R(-1,20),rateUp:[{add:P('lp.fast',0),if:{selfHpBelow:0.50}}],do:[{stack:'lp',add:1}]},   // Picked Lock: 20 - 1 s a rank
             {on:'ccIn',if:{cc:['stunned','fearT'],stackMin:{lp:1}},mul:0,do:[{stack:'lp',spend:1,then:[{emit:'lockpick'}]}]} ],
    sl_1_2:[ {on:'dodge',unless:'sl_5_3',chance:{field:'_talDodge',of:'self'},do:[{dodge:true}]}, {stat:{dodge:R(0.02)}} ],   // Slip Aside (Feint)
    sl_1_4:[ {on:'aimed',do:[{mark:'sl',on:'source',dur:P('sl.dur',6),cap:{b:2,$:'sl.n'},added:'slAdd',longest:true}]},   // Short List
             {on:'out',if:{targetHas:'sl'},more:R(0.02)} ],
    sl_2_1:[ {on:'lockpick',do:[{window:'lf',dur:3}]}, {stat:{move:R(0.05)},if:{window:'lf'}} ],     // Light Fingers
    sl_2_2:[ {on:'dodged',do:[{window:'qs',dur:3}]}, {stat:{aspd:R(0.03)},if:{window:'qs'}} ],       // Quick Study
    sl_3_1:[ {on:'lockpick',do:[{window:'rc',dur:99}]}, {on:'crit',if:{window:'rc'},force:true,do:[{window:'rc',end:true}]} ],   // Rain Check
    sl_4_2:[ {stat:{dodge:R(0.01)}} ],                                                                // Sidestep
    sl_n3:[  {on:'slAdd',do:[{mark:'stn',on:'target'}]}, {on:'out',if:{targetHas:'stn'},more:0.10,do:[{mark:'stn',on:'target',clear:true}]},   // Struck Through (LINK)
             {on:'hit',req:'sc_1_1',if:{targetHas:'sl'},do:[{ustack:'dw',on:'target',add:1,cap:5,dur:6}]} ],   //   with Worrying the Cut: a Deep Wound a hit
    sl_3_4:[ {on:'skillTgt',skill:'hookline',if:{noHolder:'agT'},do:[{retarget:{team:'enemy',has:'sl',withinOpt:'range',withinAdd:P('reach.sl',0),order:'lowMax',n:1}}]},   // Watching Brief
             {on:'out',if:{casting:'hookline',targetHas:'sl'},more:R(0.03)} ],
    sl_4_1:[ {on:'lockpick',do:[{untarget:R(0.1)}]} ],                                                // Spring the Trap
    sl_5_2:[ {on:'dodged',do:[{window:'ctr',dur:99}]}, {on:'out',if:{window:'ctr',auto:true},more:0.30,do:[{window:'ctr',end:true}]} ],   // Counter-Cut
    sl_5_3:[ {on:'in',less:2,per:{field:'_talDodge',of:'self'}} ],                                    // Rolling with It
    sl_5_4:[ {stat:{move:R(0.05)},if:{targetHas:'sl'}} ],                                             // Keep Up
    sl_6_2:[ {stat:{crit:R(0.04)},if:{window:'ctr'}} ],                                               // Make Them Miss
    sl_6_3:[ {on:'in',less:R(0.01)} ],                                                                // Loose Shoulders
    sl_6_1:[ {on:'tick',if:{selfMin:{slow:1e-9}},do:[{weaken:'slowMul',by:R(0.08)}]} ],               // Slippery
    sl_4_3:[ {on:'hit',if:{crit:true},do:[{heal:{pct:R(0.005),of:'maxHp'},on:ME}]} ],                 // Gallows Humour
    sl_6_4:[ {param:'sl.n',add:R(1)} ],                                                               // Four Names
    sl_7_1:[ {on:'lockpick',do:[{mark:'sl',on:'source',dur:12,cap:{b:2,$:'sl.n'},added:'slAdd',longest:true},{slow:0.30,dur:2,on:'source'}]} ],   // Jailbreak
    sl_7_3:[ {stat:{dodge:R(0.01)},if:{selfHpBelow:0.40}} ],                                          // Last Reflex
    sl_7_4:[ {param:'reach.sl',add:R(1)},                                                             // No Distance Too Far
             {on:'skillTgt',skill:'hookline',unless:'sl_3_4',if:{tgtNone:true,noHolder:'agT'},do:[{retarget:{team:'enemy',has:'sl',withinOpt:'range',withinAdd:R(1),order:'lowMax',n:1}}]} ],
    sl_8_1:[ {on:'lockpick',do:[{heal:{pct:R(0.02),of:'maxHp'},on:ME}]} ],                           // Nobody's Hand
    sl_8_2:[ {on:'dodged',do:[{window:'rtc',dur:2}]}, {stat:{dodge:R(0.02)},if:{window:'rtc'}} ],     // Read Them Coming
    sl_8_3:[ {on:'hurt',if:{hitMin:{pct:0.10,of:'maxHp'}},do:[{window:'bj',dur:99}]}, {on:'out',if:{window:'bj',auto:true},more:R(0.08),do:[{window:'bj',end:true}]} ],   // Bad Joke
    sl_9_2:[ {on:'dodged',if:{selfHpBelow:0.30},do:[{cd:'green',add:-2}]} ],                          // Bolt Hole
    sl_9_3:[ {on:'out',if:{targetHas:'sl'},critMore:R(0.03)} ],                                       // Steel Nerve
    sl_9_4:[ {on:'hit',if:{targetHas:'sl'},do:[{heal:{pct:R(0.03),of:'hpLost'},on:ME}]} ],            // Long Way Round
    sl_10_1:[ {on:'lockpick',do:[{window:'esc',dur:3}]}, {stat:{dodge:R(0.03)},if:{window:'esc'}} ],  // Escape Artist
    sl_10_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                   // Fast Hands
    sl_11_1:[ {param:'lp.fast',add:1} ],                                                              // Keys to the Gaol: the clock runs twice as fast
    sl_11_2:[ {on:'dodged',do:[{stack:'patter',add:1}]}, {on:'out',more:R(0.005),per:'patter'} ],     // Patter
    sl_11_4:[ {on:'death',if:{unitHas:'sl'},do:[{stack:'so',add:1}]}, {stat:{atk:R(0.01)},per:'so'} ],   // Struck Off
    sl_12_1:[ {on:'wave',do:[{stack:'lp',set:'max'},{window:'sr',dur:5}]}, {stat:{aspd:R(0.02)},if:{window:'sr'}} ],   // Staying for the Rain
    sl_12_2:[ {stat:{dodge:R(0.002)},per:'patter'} ],                                                 // Always Laughing
    sl_12_3:[ {on:'dodged',do:[{window:'ll',dur:99}]}, {on:'out',if:{window:'ll'},critMore:R(0.05),do:[{window:'ll',end:true}]} ],   // Last Laugh
    sl_12_4:[ {on:'kill',if:{targetHas:'sl'},do:[{heal:{pct:R(0.03),of:'maxHp'},on:ME}]} ],           // Crossed Off
    sl_13_2:[ {on:'in',icd:20,if:{dropBelow:0.30},do:[{miss:true},{untarget:1.5},{mark:'agT',on:'source',unique:true},{cd:'green',set:0},{stack:'ag3',set:3}]},   // Already Gone (SIGNATURE)
              {on:'skillTgt',skill:'hookline',if:{holderAlive:'agT'},do:[{retarget:'holder:agT'},{mark:'agT',on:'holder:agT',clear:true}]},   //   Hookline at the attacker
              {on:'crit',if:{stackMin:{ag3:1}},force:true,do:[{stack:'ag3',add:-1}]} ]                //   her next 3 hits crit
  },
  /* one sentence runs, another waits for a ruling */
  partial:{},
  /* nothing implemented: the text cannot run against her real kit. Each one is written up for the owner. */
  ruling:{
    sc_5_2:'"shields on a wounded enemy absorb 30% less": a shield in the game is one number that soaks a hit whole; "absorb less" has two readings (a smaller shield, or part of each hit passing through)',
    sl_n1:'"attacks that hit more than one target": the game does not know, when a hit lands on her, whether the same attack hits anyone else',
    sl_10_2:'"during its three cuts" / "the next cut": Razor Tempest\'s three cuts land in the same instant, so no attack can come between them'
  }
};
