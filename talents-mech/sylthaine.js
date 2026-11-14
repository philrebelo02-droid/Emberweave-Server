/* SYLTHAINE - what her learned talents do in a fight (the mechanics; her 8 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   Her real kit (the code, not the tooltip wording):
   - every skill is a FROST ability (dealFrostDamage: the engine flag `_frostHit` is on during the hit); her basic attacks are not.
   - Frozen Orb ('frozenorb', green, cd 8): flies at the farthest enemy within 28 m and hits every enemy in its line: 110% AP, a 2.5 s slow
     through the control table (ccApply: the strength comes from the skill level), and 1 Chill.
   - Glacial Prison ('freeze', blue, cd 9): one target, 120% AP, a stun (the FREEZE) through ccApply, 1 Chill.
   - Blizzard ('blizzard', the ultimate): a 4 s channel on a circle 8 m from its centre; a tick every 0.5 s: 50% AP to every enemy whose centre
     is inside, 1 Chill, and a 10% seeded roll to freeze for 1.2 s x the control cut (written straight on, not through ccApply). She cannot act.
   - Cold Snap (passive, unlocked at rank 3): Chill = the engine's own counter on the enemy (`_chillStacks`, max 5, `_chillT` 10 s from the
     last one). WITHOUT the passive her skills apply no Chill, and neither do her talents.
   - A "freeze" here is a stun SHE lands on an enemy (her only stuns). The always rows below follow each one with a timed mark 'frz'
     that ends when its time is up or the unit is no longer stunned: that end is the event 'freezeEnd' (Thaw, Permafrost, Prison Break).
   Talents whose text cannot run against that kit are NOT guessed at: they are listed in `ruling` and written up for the owner in
   WIRING/05 - SYLTHAINE - talents that need a ruling.md. `partial` lists talents where one sentence runs and another waits. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const ICE='#bfefff';
const ORB_GP=['frozenorb','freeze'];
const FB=()=>({_chillStacks:P('fb.min',5)});                                   // Frostbitten: at 5 Chill (4 with Deep Bite)
const CHILL=(on,n)=>({call:'chill',on,n:n==null?1:n,emit:'chill'});           // a Chill that counts as hers (Snow, Lingering Chill, Glass Winter...)
const GP_FREEZE={casting:'freeze',talent:false,cc:['stunned']};                // the freeze of Glacial Prison itself
const SNOW_SHIELD=rk=>({shield:{pct:{r:0.003,$m:'snow.sh',rk},of:'tgtMaxHp',x:'spent'},dur:P('snow.dur',4),pow:true,emit:'snowShield'});
module.exports={
  hero:'sylthaine',
  casting:true,                         // rows ask "which of her skills is this hit from" (frost abilities vs Blizzard ticks)
  watch:['sw_3_1'],                     // Drift reads the enemy that last hit an ally: every unit of the fight must remember it
  states:{
    snow:{max:P('snow.max',30)},        // Snowpack
    focus:{max:10},                     // Cold Focus
    hailc:{},                           // basic attacks since the last Hailstone
    ht:{}                               // 1 while she was struck since the last tick (Cold Focus)
  },
  /* needs: a talent that improves a mechanic does nothing without the talent that introduces it */
  needs:{ ws_2_1:'ws_1_1', ws_3_1:'ws_1_1', ws_4_1:'ws_1_1', ws_6_1:'ws_1_1', ws_7_1:'ws_1_1', ws_8_1:'ws_1_1', ws_10_1:'ws_1_1', ws_10_4:'ws_1_1', ws_11_1:'ws_1_1',
          ws_5_4:'ws_3_4', ws_8_4:'ws_3_4', ws_9_4:'ws_3_4', ws_6_4:'ws_3_4',
          sp_7_2:'sp_2_2', sp_3_4:'sp_1_4', sp_5_4:'sp_1_4', sp_6_4:'sp_1_4', sp_8_4:'sp_1_4', sp_11_4:'sp_1_4', sp_12_4:'sp_1_4', sp_9_4:'sp_1_4', sp_11_2:'sp_1_4',
          sw_4_2:'sw_3_2', sw_8_3:'sw_3_2', sw_9_3:'sw_3_2', sw_12_2:'sw_3_2', sw_9_4:'sw_1_4', sw_10_1:'sw_1_1' },
  /* run for her whenever she has any mechanic talent: bookkeeping of her freezes, Blizzard's circle and tick, the Icebreaker itself */
  always:[
    {on:'ccHit',if:{cc:['stunned'],targetTeam:'enemy'},do:[{mark:'frz',on:'target',dur:{pct:1,of:'hit'},while:'stunned',ends:'freezeEnd'}]},
    {on:'ccHit',if:{cc:['stunned'],targetTeam:'enemy',casting:'freeze',talent:false},do:[{mark:'gpz',on:'target',dur:{pct:1,of:'hit'},while:'stunned',ends:'gpEnd'}]},
    {on:'cast',skill:'blizzard',do:[{zone:'blizz',at:{x:'_blizzX',y:'_blizzY'},radius:P('blizz.r',8),dur:{opt:'dur',d:4},centre:true},{window:'bliz',dur:{opt:'dur',d:4}}]},
    {on:'num',skill:'blizzR',do:[{emit:'blizzTick'}]},                        // once per Blizzard tick, just before it lands
    {on:'ccHit',if:{casting:'frozenorb',cc:['slow']},do:[{slowMore:P('orb.slow',0),on:'target'}]},   // Frozen Orb's slow, made stronger by the slow talents
    /* the Icebreaker (Shatter): the freeze ends, the enemy takes the shatter's damage (Icebreaker's own rank) */
    {on:'shatter',do:[{endCc:'stunned',on:'target'},{mark:'frz',on:'target',clear:true,fire:true},{dmg:{pct:{rk:'sp_2_2',r:0.08},of:'apow'},on:'target',tag:'ib',color:ICE,emit:'ibHit'},{emit:'shattered'}]}
  ],
  talents:{
    /* ============================== THE WINTER SEAL ============================== */
    ws_1_1:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',min:FB()}} ],                                   // Deep Chill: Frostbitten enemies attack slower
    ws_2_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                  // Glacial Patience
    ws_1_4:[ {param:'chill.dur',add:R(1)}, {on:'chill',do:[{timer:'_chillT',min:P('chill.dur',10),on:'target'}]} ],   // Lingering Chill
    ws_2_1:[ {on:'teamHeal',if:{who:'enemy',unitMin:FB()},less:R(0.06)} ],                          // Bitter Bite
    ws_2_2:[ {on:'ccHit',if:GP_FREEZE,once:'wave',do:[{mark:'seal',on:'target',unique:true}]},      // Winter Seal: the first enemy Glacial Prison freezes each wave
             {stat:{cdRate:R(-0.03)},to:'holder:seal'} ],                                           //   its cooldowns recover slower
    ws_3_1:[ {param:'fb.min',add:-1} ],                                                             // Deep Bite: Frostbite at 4 Chill
    ws_3_3:[ {on:'ccIn',less:R(0.04)} ],                                                            // Cold Blood
    ws_3_4:[ {on:'freezeEnd',do:[{zone:'perma',at:'target',radius:P('perma.r',1),dur:P('perma.dur',2)}]},   // Ground Freeze: Permafrost (reading: "2 m wide" = 1 m from its centre to a body)
             {on:'tick',if:{zone:'perma'},do:[{slow:R(0.04),dur:P('perma.grip',0.2),on:{team:'enemy',inZone:'perma'}}]} ],
    ws_4_1:[ {on:'in',if:{srcMin:FB()},less:R(0.015)}, {on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally',srcMin:FB()},less:R(0.015)} ],   // Brittle Will
    ws_4_2:[ {on:'death',if:{unitHas:'seal'},do:[{mark:'seal',on:{team:'enemy',of:'unit',n:1},unique:true},{stun:R(0.3),on:'holder:seal'}]} ],   // Seal Passes
    ws_4_3:[ {param:'orb.slow',add:R(0.05)} ],                                                      // Frost Lattice (reading: the slow's strength x (1 + 5% per rank))
    ws_5_1:[ {on:'ccOut',if:{cc:['stunned']},more:R(0.02)} ],                                       // Hard Frost: every freeze she causes
    ws_5_4:[ {param:'perma.dur',add:R(0.3)} ],                                                      // Black Ice
    ws_6_1:[ {stat:{move:R(-0.04)},to:{team:'enemy',min:FB()}} ],                                   // Numb Limbs
    ws_6_2:[ {on:'ccHit',if:{cc:['stunned'],targetHas:'seal'},do:[CHILL('target',R(1))]} ],         // Sealed in Frost
    ws_6_4:[ {on:'teamIn',if:{targetTeam:'enemy',targetIn:'perma'},more:R(0.02)} ],                 // Rime Footing (team-wide)
    ws_7_1:[ {stat:{armor:R(-0.02),mr:R(-0.02)},to:{team:'enemy',min:FB()}} ],                      // Hoarfrost Grip
    ws_7_2:[ {on:'gpEnd',if:{targetHas:'seal'},do:[{silence:1,on:'target'}]} ],                     // Iron Seal: silenced 1 s after the prison's freeze ends
    ws_7_3:[ {on:'num',skill:'blizzFreeze',add:R(0.01)} ],                                          // Snowblind: 10% -> 15% a tick
    ws_8_3:[ {param:'blizz.r',add:R(0.2)}, {on:'num',skill:'blizzR',addM:R(0.2)} ],                 // Storm Gathering: 8 m -> 9 m
    ws_5_2:[ {on:'ccHit',if:GP_FREEZE,do:[{stun:{pct:0.5,of:'hit'},asIs:true,on:{team:'enemy',of:'target',within:4,n:1,skip:'target'}}]} ],   // Twin Prison: half of the freeze as it landed
    ws_5_3:[ {on:'ccOut',if:GP_FREEZE,add:0.6}, {on:'ccOut',if:Object.assign({targetHas:'seal'},GP_FREEZE),add:0.6} ],   // Deep Prison
    ws_8_4:[ {param:'perma.r',add:R(0.15)} ],                                                       // Frozen Fields: 0.3 m more ground = 0.15 m more from its centre
    ws_8_1:[ {on:'out',if:{srcFlag:'_frostHit',targetMin:FB()},more:R(0.03)} ],                     // Ice in the Veins
    ws_9_2:[ {on:'teamIn',if:{targetTeam:'enemy',targetHas:'seal'},more:R(0.02)} ],                 // Unbroken Seal (team-wide, her own hits too)
    ws_9_3:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                 // Patient Frost
    ws_9_4:[ {param:'perma.grip',add:0.8} ],                                                        // Winter Grip: the slow holds 1 s after stepping off
    ws_10_1:[ {on:'death',if:{who:'enemy',unitMin:FB()},do:[CHILL({team:'enemy',of:'unit',n:1},{field:'_chillStacks',of:'unit'})]} ],   // Spreading Bite
    ws_10_3:[ {on:'ccHit',if:{cc:['stunned'],targetTeam:'enemy'},do:[{energy:R(1)}]} ],             // Cold Patience
    ws_10_4:[ {on:'in',if:{srcMin:FB()},less:R(0.02)} ],                                            // Hushed Ground
    ws_11_1:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',min:FB()}} ],                                  // Marrow Frost
    ws_11_2:[ {on:'ccOut',if:Object.assign({targetHas:'seal'},GP_FREEZE),add:R(0.2)} ],             // Seal of Ages
    ws_12_2:[ {on:'kit',skill:'blizzard',opt:{dur:{add:R(0.1)}}} ],                                 // Endless Winter
    ws_11_3:[ {on:'cd',less:R(0.015)} ],                                                            // Still Mind
    ws_12_4:[ {on:'teamIn',if:{targetTeam:'enemy',targetHas:'frz',srcIs:'ally'},more:R(0.04)} ],    // Thin Ice: her allies' hits (not her own)
    ws_13_2:[ {on:'end:bliz',do:[{zone:'lw',at:{x:'_blizzX',y:'_blizzY'},radius:P('blizz.r',8),dur:8,centre:true},{window:'lw',dur:8},{mark:'lwf',on:{team:'enemy'},clear:true}]},   // The Long Winter (SIGNATURE)
              {on:'tick',each:{team:'enemy'},if:{window:'lw',targetIn:'lw'},period:1,do:[CHILL('target')]},   //   1 Chill every second inside
              {on:'tick',if:{window:'lw'},do:[{slow:0.30,dur:0.2,on:{team:'enemy',inZone:'lw'}},{silence:0.2,on:{team:'enemy',inZone:'lw',has:'seal'}}]},   //   slowed 30%; the Sealed enemy cannot use abilities
              {on:'chill',if:{window:'lw',targetIn:'lw',targetMin:{_chillStacks:5},targetLacks:'lwf'},do:[{mark:'lwf',on:'target'},{stun:1.5,on:'target'}]} ],   //   at 5 Chill: frozen 1.5 s, once per enemy

    /* ============================== SHATTERPOINT ============================== */
    sp_1_1:[ {on:'hit',if:{auto:true},do:[{stack:'hailc',add:1}]},                                  // Hailstones: every 4th basic attack
             {on:'hit',if:{auto:true,stackMin:{hailc:P('hail.n',4)}},do:[{stack:'hailc',set:0},{dmg:{pct:R(0.06),of:'apow'},on:'target',tag:'hail',color:ICE},CHILL('target'),{emit:'hail'}]} ],
    sp_1_3:[ {on:'out',if:{srcFlag:'_frostHit',targetMin:{_chillStacks:1}},ignoreMr:R(0.02)} ],     // Biting Cold
    sp_1_4:[ {on:'tick',if:{stackEmpty:'ht'},period:1,rate:P('focus.rate',1),do:[{stack:'focus',add:1}]},   // Cold Focus: a full second without damage
             {on:'tick',do:[{stack:'ht',set:0}]},
             {on:['hurt','dotIn'],do:[{stack:'ht',set:1},{stack:'focus',keep:P('focus.keep',0.5),whole:true}]},   //   damage removes half (rounded down to whole Focus)
             {stat:{apow:R(0.003)},per:'focus'} ],
    sp_2_1:[ {on:'dmg:hail',more:R(0.10)} ],                                                        // Heavy Hail
    sp_2_2:[ {on:'hit',if:{casting:ORB_GP,targetHas:'frz',targetLacks:'gw'},do:[{emit:'shatter'}]} ],   // Icebreaker (reading: her two cast abilities; Blizzard ticks do not shatter)
    sp_3_1:[ {param:'hail.n',add:-1} ],                                                             // Hail Rhythm: every 3rd
    sp_4_2:[ {on:'ibHit',do:[{dmg:{pct:R(0.10),of:'spent'},on:{team:'enemy',of:'target',within:P('shrap.r',3),skip:'target'}}]} ],   // Shrapnel
    sp_n1:[  {on:'dmg:ib',if:{targetMin:{_chillStacks:5}},more:0.05},                               // Marked in Ice (LINK)
             {on:'dmg:ib',req:'ws_2_2',if:{targetHas:'seal'},more:0.10},                            //   ...with Winter Seal: +10% on the Sealed
             {on:'shatter',req:'ws_2_2',once:'wave',if:{noHolder:'seal'},do:[{mark:'seal',on:'target',unique:true}]} ],   //   and the first Icebreaker of the wave Seals when nobody is Sealed
    sp_3_4:[ {on:'kit',if:{stackMin:{focus:10}},do:[{window:'clear',dur:99}]},                      // Clear Air: at 10 Focus the next ability...
             {on:'cast',if:{window:'clear'},do:[{stack:'focus',spend:'all',then:[{emit:'clearSpent'}]},{window:'clear',end:true},{window:'clearB',dur:{opt:'dur',d:4},if:{skill:'blizzard'}}]},
             {on:'out',if:{srcFlag:'_frostHit',window:'clear'},more:R(0.04)}, {on:'out',if:{srcFlag:'_frostHit',window:'clearB'},more:R(0.04)} ],   //   ...deals more (Blizzard: for its whole channel)
    sp_5_1:[ {on:'hail',do:[{slow:R(0.03),dur:1.5,on:'target'}]} ],                                 // Sleet
    sp_5_2:[ {on:'kit',skill:'frozenorb',do:[{fn:'orbLine'}]},                                      // Crushing Orb: the first enemy along the orb's line
             {on:'out',if:{casting:'frozenorb',targetHas:'orb1'},more:0.25},
             {on:'hit',if:{casting:'frozenorb',targetHas:'orb1'},do:[{mark:'orb1',on:'target',clear:true},{stun:0.6,on:'target'}]} ],
    sp_5_3:[ {on:'kit',skill:'frozenorb',do:[{fn:'orbLine'}]},                                      // Splitting Orb: a burst at the end of the line (the farthest enemy)
             {on:'hit',if:{casting:'frozenorb',targetHas:'orbEnd'},do:[{mark:'orbEnd',on:'target',clear:true},{dmg:{pct:0.5,of:'hit'},on:{team:'enemy',of:'target',within:3}}]} ],
    sp_5_4:[ {param:'focus.rate',add:R(0.10)} ],                                                    // Stillness
    sp_4_1:[ {on:'hail',req:'sp_2_2',if:{targetHas:'frz',targetLacks:'gw'},do:[{emit:'shatter'}]},  // Hailbreaker
             {on:'hail',req:'sp_13_2',if:{targetHas:'gw'},do:[{emit:'shatter'}]} ],
    sp_6_3:[ {param:'orb.slow',add:R(0.04)}, {on:'ccOut',if:{casting:'frozenorb',cc:['slow']},add:R(0.2)} ],   // Trailing Frost
    sp_2_3:[ {on:'out',if:{casting:'frozenorb'},more:R(0.04)} ],                                    // Sharp Frost
    sp_6_4:[ {on:'out',if:{srcFlag:'_frostHit',stackMin:{focus:5}},more:R(0.02)} ],                 // Calm Before
    sp_7_1:[ {on:'hail',do:[{cd:'blue',add:R(-0.1)}]} ],                                            // Hail Clock
    sp_6_2:[ {on:'dmg:ib',more:R(0.05),per:{field:'_chillStacks',of:'target'}} ],                   // Fault Lines
    sp_7_2:[ {on:'gpEnd',if:{broke:false},do:[{emit:'shatter'}]} ],                                 // Prison Break: when the prison's freeze runs its time
    sp_8_3:[ {on:'out',if:{casting:ORB_GP},more:R(0.02)} ],                                         // Cold Precision
    sp_7_4:[ {on:'in',more:R(0.01)}, {on:'out',if:{srcFlag:'_frostHit'},more:R(0.02)} ],            // Reckless Cold (RISK)
    sp_8_1:[ {on:'dmg:hail',if:{targetMin:{_chillStacks:1}},more:R(0.10)} ],                        // Shattering Hail
    sp_8_4:[ {param:'focus.keep',add:R(0.10)} ],                                                    // Deep Calm
    sp_4_3:[ {stat:{hp:R(-0.02),apow:R(0.02)}} ],                                                   // Glass Heart (RISK)
    sp_9_3:[ {on:'out',if:{targetMin:{_chillStacks:1}},more:R(0.01)} ],                             // Brittle Bones
    sp_9_4:[ {on:'kit',skill:'freeze',if:{stackMin:{focus:10}},do:[{window:'fm',dur:99}]},          // Frozen Moment (reading: as long as the prison's own freeze)
             {on:'ccHit',if:Object.assign({window:'fm'},GP_FREEZE),do:[{stun:{pct:1,of:'hit'},asIs:true,on:{team:'enemy',of:'target',within:3,skip:'target'}}]},
             {on:'cast',do:[{window:'fm',end:true}]} ],
    sp_10_1:[ {on:'kill',if:{tag:'hail'},do:[{stack:'hailc',set:P('hail.n',3)}]} ],                 // Hailfall: the next basic attack is a Hailstone
    sp_10_3:[ {on:'out',if:{srcFlag:'_frostHit',selfPass:'coldsnap'},more:R(0.005),per:{field:'_chillStacks',of:'target',max:5}} ],   // Deeper Snap
    sp_10_4:[ {on:'out',if:{srcFlag:'_frostHit',targetHpAbove:0.70},more:R(0.02)} ],                // Opening Frost
    sp_11_2:[ {on:'shattered',do:[{stack:'focus',add:R(1)}]} ],                                     // Thousand Shards
    sp_11_3:[ {on:'dmg:ib',more:R(0.03)} ],                                                         // Winter Edge
    sp_11_4:[ {on:'in',if:{stackMin:{focus:5}},less:R(0.04)} ],                                     // Glass Nerves
    sp_12_2:[ {param:'shrap.r',add:R(0.3)} ],                                                       // Cracked Mirror
    sp_12_4:[ {on:'clearSpent',do:[{energy:R(1)}]} ],                                               // Spent Focus
    sp_13_2:[ {on:'chill',by:'target',icd:12,if:{targetMin:{_chillStacks:5}},do:[{stun:0.8,on:'target'},{mark:'gw',on:'target'}]},   // Glass Winter (SIGNATURE): flash-frozen at 5 Chill
              {on:'hit',if:{casting:ORB_GP,targetHas:'gw'},do:[{emit:'shatter'}]},                  //   her next frost hit on it is an Icebreaker
              {on:'dmg:ib',if:{targetHas:'gw'},mul:2},                                              //   that deals double
              {on:'shattered',if:{targetHas:'gw'},do:[{mark:'gw',on:'target',clear:true},CHILL({team:'enemy',of:'target',within:4},3)]} ],   //   and gives 3 Chill within 4 m

    /* ============================== SNOWWARDEN ============================== */
    sw_1_1:[ {on:'chill',do:[{stack:'snow',add:1}]},                                                // Snowpack: every Chill she applies
             {on:'tick',each:{team:'ally',others:true},edge:true,if:{targetHpBelow:0.40},icd:8,do:[{stack:'snow',spend:10,then:[Object.assign({on:'target'},SNOW_SHIELD())]}]},
             {on:'snowShield',do:[{mark:'snowsh',on:'target',dur:P('snow.dur',4),while:'shield',ends:'snowGone'}]} ],
    sw_1_4:[ {on:'freezeEnd',do:[{emit:'thaw',on:{team:'ally',others:true,of:'target',n:1}}]},     // Thaw: the ally nearest the melting ice
             {on:'thaw',unless:'sw_2_4',do:[{heal:{pct:{r:0.06,$m:'thaw.more'},of:'apow',k:1},pow:true,on:'target',tag:'thaw',emit:'thawed'}]},
             {on:'thaw',req:'sw_2_4',do:[{hot:{pct:{r:0.06,$m:'thaw.more'},of:'apow',k:1},dur:3,every:1,pow:true,on:'target',tag:'thaw',emit:'thawed'}]} ],   //   with Meltwater: over 3 s
    sw_2_1:[ {param:'snow.max',add:R(5)} ],                                                         // Deep Snow
    sw_2_4:[ {param:'thaw.more',add:R(0.15)} ],                                                     // Meltwater (the change to a heal over time is Thaw's second row)
    sw_3_1:[ {on:'snowShield',do:[{slow:0.30,dur:2,on:'lastHit'}]} ],                               // Drift
    sw_3_2:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',of:'self',within:P('cold.r',5)}} ],             // Still Cold: a ring around her
    sw_n1:[  {on:'in',if:{srcBeyond:6},less:R(0.02)} ],                                             // Thick Furs
    sw_4_1:[ {param:'snow.dur',add:R(0.4)} ],                                                       // Packed Ice
    sw_4_2:[ {on:'tick',each:{team:'enemy'},if:{targetWithin:P('cold.r',5)},period:[3,2,1],do:[CHILL('target')]} ],   // Biting Air
    sw_4_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                  // Winter's Reach
    sw_5_1:[ {on:'teamIn',if:{targetHas:'snowsh',srcTeam:'enemy'},less:R(0.02)} ],                  // Snowbound
    sw_5_4:[ {on:'thawed',do:[{heal:{pct:R(0.10),of:'hit'},on:{team:'ally',others:true,of:'target',skip:'target',n:1},emit:'gave'}]} ],   // Running Water (reading: the ally nearest the one healed)
    sw_6_1:[ {on:'snowGone',if:{broke:true},do:[{dmg:{pct:R(0.20),of:'apow'},on:{team:'enemy',of:'unit',within:2},color:ICE}]} ],   // Avalanche: the shield was used up
    sw_6_2:[ {on:'ccOut',if:GP_FREEZE,add:R(0.2)} ],                                                // Cold Sleep. PARTIAL: the Ice Tomb half waits with Ice Tomb
    sw_6_3:[ {stat:{apow:R(0.015)},if:{stackMin:{snow:10}}} ],                                      // Wintermind
    sw_7_2:[ {on:'teamIn',if:{window:'bliz',targetTeam:'ally',targetIn:'blizz',srcTeam:'enemy'},less:0.20} ],   // Quiet Ward
    sw_7_3:[ {param:'orb.slow',add:R(0.04)} ],                                                      // Frost Veil
    sw_7_4:[ {on:'thawed',do:[{stack:'snow',add:R(1)}]} ],                                          // Snowmelt
    sw_8_1:[ {param:'snow.sh',add:R(0.03)} ],                                                       // Glacier Wall
    sw_8_3:[ {param:'cold.r',add:R(0.5)} ],                                                         // Hard Winter
    sw_8_4:[ {on:'heal:thaw',if:{targetHpBelow:0.50},more:R(0.05)} ],                               // Clear Water
    sw_9_2:[ {on:'blizzTick',do:[{heal:{pct:R(0.003),of:'tgtMaxHp'},pow:true,on:{team:'ally',others:true,inZone:'blizz'},emit:'gave'}]} ],   // Shelter of Snow
    sw_9_3:[ {on:'in',if:{srcWithin:P('cold.r',5)},less:R(0.01)}, {on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally',srcWithin:P('cold.r',5)},less:R(0.01)} ],   // Snow Blind
    sw_9_4:[ {on:'tick',once:'wave',if:{some:{team:'ally',others:true,hpBelow:0.20}},do:[{emit:'thaw',on:{team:'ally',others:true,hpBelow:0.20,order:'lowHp',n:1},k:3}]} ],   // Wellspring
    sw_10_1:[ {on:'cast',skill:'freeze',if:{stackFull:'snow'},do:[{stack:'snow',spend:10,then:[Object.assign({on:{team:'ally',others:true,of:'target',n:1}},SNOW_SHIELD('sw_1_1'))]}]} ],   // Overflowing Snow (reading: a Snowpack shield)
    sw_10_3:[ {on:'cd',less:R(0.01)} ],                                                             // Steady Hand
    sw_11_1:[ {on:'wave',do:[{stack:'snow',atLeast:R(5)}]} ],                                       // Snowkeeper
    sw_11_2:[ {on:['snowShield','thawed','gave'],do:[{mark:'mercy',on:'target',dur:3}]},            // Winter Mercy
              {on:'teamIn',if:{targetHas:'mercy',srcTeam:'enemy'},less:R(0.03)} ],
    sw_11_4:[ {param:'thaw.more',add:R(0.03)} ],                                                    // Kind Frost
    sw_12_2:[ {stat:{move:R(-0.02)},to:{team:'enemy',of:'self',within:P('cold.r',5)}} ],            // White Silence
    sw_12_3:[ {on:'blizzTick',do:[{stack:'snow',add:{units:{team:'enemy',inZone:'blizz'},max:R(1)}}]} ],   // Snowfall
    sw_12_4:[ {on:'hurt',by:'source',icd:[3,2,1],do:[CHILL('source')]} ],                           // Cold Shoulder
    sw_13_2:[ {on:'teamLethal',by:'unit',once:'fight',if:{who:'ally',unitWithin:8},do:[            // The Quiet Snow (SIGNATURE)
                {mark:'tomb',on:'unit',dur:2,ends:'tombEnd'},{timer:'stunned',min:2,on:'unit'},{stun:2,on:'lastHit'},{atOne:'unit'}]},
              {on:'teamLethal',if:{unitHas:'tomb'},do:[{atOne:'unit'}]},                            //   held at 1 HP in the ice
              {on:'teamIn',if:{targetHas:'tomb'},mul:0},                                            //   and cannot be hurt
              {on:'tombEnd',do:[{stack:'snow',spend:'all',then:[{heal:{pct:0.01,of:'tgtMaxHp',x:'spent'},pow:true,on:'target',emit:'gave'}]}]} ]
  },
  /* one sentence runs, another waits for a ruling */
  partial:{
    sw_6_2:'"an ally encased by Ice Tomb heals 3% more": Ice Tomb itself waits for a ruling; the longer Glacial Prison freeze runs'
  },
  /* nothing implemented: the text cannot run against her real kit. Each one is written up for the owner. */
  ruling:{
    sp_9_2:'Blizzard ticks and the Icebreaker: does a tick end the freeze?',
    sp_12_1:'no "behind the target" on an open field',
    sw_5_2:'Glacial Prison is an enemy skill: turning it onto an ally is new engine behaviour',
    sw_5_3:'Glacial Prison takes the target the engine gives it: choosing another is new engine behaviour'
  },
  fn:{
    /* Crushing Orb / Splitting Orb: which enemies the orb meets first and last. The same line as the skill's own code (the farthest enemy within
       its range, and every enemy within its width of that line); 'orb1' = the nearest along it, 'orbEnd' = the farthest (where it ends). */
    orbLine(A,T,u,ctx){ const E=A.eng(), o=ctx.o||{}, reach=o.range||28*E.METER(), W=o.width||0;
      const inR=E.units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget&&!(x._riseT>0)&&E.dist(u,x)<=reach); if(!inR.length) return;
      const far=inR.slice().sort((a,b)=>E.dist(u,b)-E.dist(u,a))[0], dx=far.x-u.x, dy=far.y-u.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
      let first=null, best=Infinity; for(const x of inR){ const rx=x.x-u.x, ry=x.y-u.y, al=rx*ux+ry*uy; if(al<-12||al>len+24||Math.abs(rx*uy-ry*ux)>W) continue; if(al<best){ best=al; first=x; } }
      if(T.r.sp_5_2&&first) A.setMark(T,u,first,'orb1',{}); if(T.r.sp_5_3) A.setMark(T,u,far,'orbEnd',{}); }
  }
};
