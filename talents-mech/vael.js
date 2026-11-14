/* VAEL - what his learned talents do in a fight (the mechanics; his 8 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   His real kit (the code, not the tooltip wording): every point of damage Vael deals is a BASIC ATTACK. Warcry ('warcry') is a self damage
   buff + a fear around him; Bloodthirst ('lifestealbuff') is a self buff (lifesteal, attack speed, crit) with no target and no damage;
   Last Stand ('laststand') is damage reduction + 100% lifesteal + a heal; Blood Rage is a continuous percent, not stacks.
   Talents whose text cannot run against that kit are NOT guessed at: they are listed in `ruling` (id -> short reason) and written up for
   the owner in WIRING/04 - VAEL - talents that need a ruling.md. `partial` lists talents where one sentence runs and another waits. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const BLEED='#8f8fa8', BURN='#ff6a3a';
const AROUND=m=>({team:'enemy',of:'self',within:m});
module.exports={
  hero:'vael',
  /* tracked things. max / dur may be changed by other talents through named numbers. */
  states:{
    temper:{max:20},                                             // Forge Heat. The tooltips name no fade rate: none until ruled (see ruling ib_4_1)
    bank:{max:{pct:P('bank.max',0.15),of:'maxHp'}},              // Blood Bank: a pool of HP
    scars:{max:P('scars.max',10)},                               // whole fight
    footing:{max:5},
    momentum:{max:3,dur:P('momentum.dur',4)},                    // Blood Momentum: all stacks drop `dur` s after the last kill
    trophy:{max:5},
    cb:{max:3},                                                  // Counterblow's count of hits taken
    ledger:{}                                                    // Oath Ledger: damage taken through the Oath
  },
  /* run for Vael whenever he has any mechanic talent: the buff windows of his three skills, so rows can say "during Bloodthirst" */
  always:[
    {on:'cast',skill:'lifestealbuff',do:[{window:'bloodthirst',dur:{opt:'dur',d:6}}]},
    {on:'cast',skill:'laststand',do:[{window:'laststand',dur:{opt:'dur',d:5}},{window:'bloodthirst',end:true}]},   // Last Stand's cast replaces the running lifesteal buff
    {on:'cast',skill:'warcry',do:[{window:'warcry',dur:{opt:'dur',d:6}}]}
  ],
  talents:{
    /* ============================== RED HARVEST ============================== */
    rh_1_1:[ {on:'hit',once:'wave',do:[{mark:'quarry',unique:true}]},                       // Mark the Quarry: the first enemy he hits each wave
             {on:'out',if:{targetHas:'quarry'},more:R(0.02)} ],
    rh_1_4:[ {on:'kill',do:[{dmg:{pct:{r:0.20,$:'spill'},of:'overkill'},on:{team:'enemy',of:'target',n:1}}]} ],   // Spill Over: overkill carries to the enemy nearest the one that died
    rh_2_1:[ {stat:{move:R(0.04)},if:{targetHas:'quarry'}} ],                               // Close the Distance (reading: while the Quarry is his current target)
    rh_2_2:[ {on:'hit',if:{crit:true},do:[{dot:'bleed',amt:{pct:R(0.04),of:'hit'},dur:P('bleed.dur',3),every:1,color:BLEED}]} ],   // Open Wounds
    rh_n2:[  {on:'in',if:{anyDot:'bleed'},less:0.04},                                        // Blood Temper (LINK)
             {on:'dotTick',req:'ib_1_1',if:{tag:'bleed'},every:3,do:[{stack:'temper',add:1}]} ],   // ...with Forge Heat: every 3rd bleed tick gives 1 Temper
    rh_3_1:[ {on:'death',if:{unitHas:'quarry'},do:[{mark:'quarry',on:{team:'enemy',of:'self',n:1},unique:true},{mark:'pick',on:'holder:quarry'}]},   // Pick the Next
             {on:'crit',if:{targetHas:'pick'},force:true,do:[{mark:'pick',clear:true}]} ],
    rh_3_3:[ {on:'out',if:{targetDot:'bleed'},ignoreArmor:R(0.03)} ],                       // Sunder
    rh_3_4:[ {on:'kill',do:[{stack:'momentum',add:1,if:{window:'bmk'}},{stack:'momentum',touch:true},{window:'bmk',dur:4}]},   // Blood Momentum
             {stat:{aspd:R(0.03)},per:'momentum'} ],
    rh_4_1:[ {stat:{crit:R(0.02)},if:{targetHas:'quarry'}} ],                               // Hunter's Read
    rh_4_2:[ {on:'hit',if:{window:'bloodthirst',targetDot:'bleed'},do:[{heal:{pct:R(0.10),of:'lifesteal'}}]} ],   // Salt the Wound
    rh_5_1:[ {on:'kit',skill:'warcry',opt:{mul:{bonus:R(0.03)},mulPerLv:{mul:R(0.03,1)}}} ],   // Warpath
    rh_5_4:[ {param:'momentum.dur',add:R(1)} ],                                             // Long Hunger
    rh_6_1:[ {on:'kill',if:{targetHas:'quarry'},do:[{stack:'trophy',add:1}]},               // Trophy
             {stat:{atk:R(0.015)},per:'trophy'} ],
    rh_6_2:[ {param:'bleed.dur',add:R(0.3)} ],                                              // Deep Cuts
    rh_7_1:[ {on:'hit',if:{auto:true},do:[{dmg:{pct:R(0.08),of:'hit'},on:{team:'enemy',of:'target',within:2,n:1,skip:'target'}}]} ],   // Cleaving Blows (reading: "beside" = within 2 m of the target)
    rh_10_1:[ {on:'tick',do:[{slow:R(0.05),dur:0.2,on:{team:'enemy',has:'quarry',hpBelow:0.5}}]} ],   // No Escape
    rh_7_4:[ {on:'in',more:R(0.01)}, {on:'out',more:R(0.02)} ],                              // Reckless
    rh_8_1:[ {on:'out',if:{targetHas:'quarry'},more:R(0.01),per:{markAge:'quarry',every:3,max:5}} ],   // Long Hunt
    rh_5_3:[ {on:'cast',skill:'warcry',do:[{mark:'exec',on:{team:'enemy',of:'self',withinOpt:'radius',hpBelow:0.30}}]},   // Execution Hour (reading: enemies inside Warcry's range)
             {on:'out',if:{targetHas:'exec'},more:0.40,do:[{mark:'exec',clear:true}]} ],
    rh_8_3:[ {stat:{aspd:R(0.03)},if:{selfHpBelow:0.40}} ],                                 // Adrenaline
    rh_9_3:[ {on:'out',if:{targetDot:'bleed'},critMore:R(0.03)} ],                          // Grim Focus
    rh_9_2:[ {on:'teamIn',if:{targetTeam:'enemy',targetDot:'bleed'},more:R(0.015)} ],       // Everything Bleeds (team-wide)
    rh_6_3:[ {on:'tick',do:[{slow:R(0.10),dur:0.2,on:{team:'enemy',has:'exec'}}]} ],        // Hobble
    rh_9_4:[ {on:'kill',if:{stackMin:{momentum:3}},do:[{cd:'blue',set:0}]} ],               // The Work Never Ends
    rh_10_3:[ {on:'hit',if:{crit:true},do:[{cd:'green',add:R(-0.1)}]} ],                    // Butcher's Rhythm
    rh_10_4:[ {param:'spill',add:R(0.06)} ],                                                // Overflow
    rh_11_1:[ {on:'kill',do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                           // Taste for It
    rh_11_2:[ {on:'death',if:{who:'enemy'},do:[{jumpDots:'bleed',from:'unit',to:{team:'enemy',of:'unit',n:1}}]} ],   // Bloodletter
    rh_11_4:[ {on:'out',if:{selfHpAbove:0.80},critMore:R(0.04)} ],                          // Glass Edge
    rh_12_1:[ {stat:{lifesteal:R(0.01)},per:'trophy'} ],                                    // Head on the Wall
    rh_12_2:[ {stat:{atk:R(0.01)},per:{dots:'bleed',max:5}} ],                              // Blood in the Air (reading: his own bleeds)
    rh_12_3:[ {on:'out',once:'wave',critMore:R(0.10)} ],                                    // Killer's Calm: his first hit each wave, if it is a critical
    rh_12_4:[ {on:'lethal',once:'fight',do:[{undying:R(0.5)}]} ],                           // Last Breath
    rh_13_2:[ {on:'kill',if:{window:'harvest'},do:[{window:'harvest',add:1}]},              // The Last Harvest (SIGNATURE): each kill during it adds 1 s
              {on:'kill',if:{targetHas:'quarry'},do:[{window:'harvest',dur:6,cd:25}]},      //   killing the Quarry starts it (6 s, cooldown 25 s)
              {on:'death',pts:['red_harvest',91],if:{unitHas:'quarry'},do:[{window:'harvest',dur:6,cd:25}]},   //   AT 91 POINTS: the Quarry dying to anything starts it
              {on:'crit',if:{window:'harvest'},force:true},                                 //   every hit is a guaranteed critical
              {on:'hit',if:{window:'harvest',crit:true},do:[{dot:'bleed',on:{team:'enemy',of:'target',within:3,skip:'target'},amt:{pct:{rk:'rh_2_2',r:0.04},of:'hit'},dur:P('bleed.dur',3),every:1,color:BLEED}]} ],   //   ...that spreads Open Wounds (at Open Wounds' own rank) within 3 m

    /* ============================== IRONBLOOD ============================== */
    ib_1_1:[ {on:'hit',do:[{stack:'temper',add:1}]},                                        // Forge Heat
             {on:'in',less:R(0.001),per:'temper'} ],
    ib_n1:[  {on:'dotIn',less:R(0.05)} ],                                                   // Seared Shut
    ib_1_4:[ {on:'hurt',if:{srcMelee:true},do:[{dmg:{pct:R(0.02),of:'armor'},on:'source',emit:'retal'}]} ],   // Spiked Mail: Retaliation
    ib_2_1:[ {on:'in',if:{hitMin:{pct:0.10,of:'maxHp'},stackMin:{temper:[7,6,5]}},mul:0.5,do:[{stack:'temper',spend:[7,6,5]}]} ],   // Quench
    ib_2_2:[ {on:'heal',if:{overMin:0},do:[{stack:'bank',add:{pct:R(0.08),of:'over'}}]} ],  // Blood Bank
    ib_4_2:[ {on:'tick',unless:'ib_5_3',edge:true,if:{selfHpBelow:0.40},do:[{stack:'bank',spend:'all',then:[{heal:{pct:{r:0.10,b:1,$:'payout'},of:'spent'}},{emit:'payout'}]}]},   // Withdrawal
             {on:'tick',req:'ib_5_3',edge:true,if:{selfHpBelow:0.40},do:[{stack:'bank',spend:'all',then:[{heal:{pct:{r:0.10,b:1,$:'payout'},of:'spent'},on:{team:'ally',others:true,order:'lowHp',n:1}},{emit:'payout'}]}]} ],   // ...paid to the lowest-HP ally with Share the Wealth
    ib_3_4:[ {on:'hurt',do:[{fn:'grudge'}]},                                                // Grudge
             {on:'out',if:{targetHas:'grudge'},more:R(0.02)} ],
    ib_5_2:[ {on:'hit',if:{window:'bloodthirst',stackEmpty:'bank'},do:[{heal:{pct:1,of:'lifesteal'}}]} ],   // Investment
    ib_5_3:[ {param:'share',add:1} ],                                                       // Share the Wealth (its effect is the second Withdrawal row)
    ib_5_4:[ {on:'hurt',do:[{stack:'cb',add:1,full:[{stack:'cb',set:0},{window:'counter',dur:600}]}]},   // Counterblow
             {on:'out',if:{auto:true,window:'counter'},more:R(0.10),do:[{window:'counter',end:true}]} ],
    ib_6_1:[ {stat:{atk:R(0.001)},per:'temper'} ],                                          // Hammered Steel
    ib_6_2:[ {param:'bank.max',add:R(0.02)} ],                                              // Blood Reserve
    ib_6_4:[ {on:'hit',if:{targetHas:'grudge'},do:[{heal:{pct:R(0.01),of:'hpLost'}}]} ],    // Bad Blood
    ib_7_2:[ {on:'kit',skill:'laststand',opt:{mul:{set:1},mulPerLv:{set:0}}},               // Sanguine Hide: no damage reduction...
             {on:'cast',skill:'laststand',do:[{stack:'bank',spend:'all',then:[{shield:{pct:2,of:'spent'},dur:{opt:'dur',d:5}}]}]} ],   // ...the bank becomes a shield of twice its size (reading: for Last Stand's duration)
    ib_7_3:[ {on:'hit',do:[{slow:R(0.02),dur:1}]} ],                                        // Weight of Iron
    ib_7_4:[ {on:'hurt',do:[{roll:'pain',add:{pct:1,of:'hpLost'},span:3},{window:'pain',dur:4,count:{roll:'pain',step:{pct:0.10,of:'maxHp'}},min:1,most:true}]},   // Pain into Power
             {stat:{atk:R(0.01)},per:{window:'pain'}} ],
    ib_8_1:[ {on:'hurt',if:{stackMin:{temper:15}},do:[{dot:'burn',on:'source',amt:{pct:R(0.005),of:'maxHp'},total:true,dur:2,every:0.5,color:BURN,refresh:true}]} ],   // Slag
    ib_9_2:[ {stat:{atk:R(0.02)},if:{stackFull:'bank'}} ],                                  // Blood Money
    ib_9_4:[ {on:'kill',if:{targetHas:'grudge'},do:[{heal:{pct:0.10,of:'maxHp'}},{window:'settled',dur:2}]},   // Settle the Score
             {on:'in',if:{window:'settled'},less:0.30} ],
    ib_10_1:[ {on:'cast',skill:'laststand',do:[{stack:'temper',spend:'all',then:[{heal:{pct:R(0.005),of:'maxHp',x:'spent'}}]}]} ],   // Cooling Hiss
    ib_10_3:[ {on:'in',if:{selfHpBelow:0.30},less:R(0.02)} ],                               // Unyielding
    ib_10_4:[ {on:'hurt',if:{srcMelee:false},do:[{dmg:{pct:{rk:'ib_1_4',r:0.02},of:'armor'},scale:R(0.10),on:'source',emit:'retal'}]} ],   // Iron Thorns
    ib_11_1:[ {stat:{crit:R(0.0005)},per:'temper'} ],                                       // Tempered Edge
    ib_11_4:[ {on:'out',if:{targetHas:'oldgrudge'},more:{rk:'ib_3_4',r:0.02},scale:R(0.20)} ],   // Old Grudges (reading: he keeps part of the bonus against the enemy that WAS his Grudge)
    ib_12_1:[ {on:'wave',do:[{stack:'temper',atLeast:R(5)}]} ],                             // Forgeborn
    ib_12_2:[ {param:'payout',add:R(0.04)}, {on:'payout',do:[{cleanse:1}]} ],               // Golden Vein (reading: the control effect is removed from Vael)
    ib_12_4:[ {on:'retal',do:[{heal:{pct:R(0.05),of:'spent'}}]} ],                          // Debt Paid
    ib_13_2:[ {on:'tick',edge:true,once:'fight',if:{selfHpBelow:0.30},do:[{window:'heart',dur:8},{stack:'bank',spend:'all',then:[{shield:{pct:1,of:'spent'},dur:8}]}]},   // Heart of Iron (SIGNATURE). PARTIAL: what a Temper is worth as shield is not written
              {on:'hit',if:{auto:true,window:'heart'},do:[{dmg:{pct:1,of:'hit'},on:{team:'enemy',of:'self',within:3,skip:'target'}}]},   //   his attacks hit every enemy within 3 m
              {on:'hurt',if:{window:'heart'},do:[{stack:'temper',add:1}]},                  //   every hit he takes gives Temper
              {on:'end:heart',pts:['ironblood',91],do:[{stack:'bank',add:{pct:1,of:'shield'}},{unshield:1}]} ],   //   AT 91 POINTS: what is left of the shield flows back into the bank

    /* ============================== THE ASHFORD WALL ============================== */
    aw_1_1:[ {on:'hurt',if:{lostMin:{pct:R(-0.01,0.14),of:'maxHp'}},do:[{stack:'scars',add:1}]} ],   // First Scar
    aw_1_3:[ {on:'in',if:{auto:true},chance:R(0.03),less:0.35,do:[{emit:'block'}]} ],       // Shield Arm: Block (the one seeded roll among his talents)
    aw_2_1:[ {stat:{armor:R(0.003),mr:R(0.003)},per:'scars'} ],                             // Hard Lessons
    aw_2_2:[ {on:'tick',if:{moved:true,noWindow:'planted'},do:[{stack:'footing',set:0}]},   // Footing: moving clears it...
             {on:'tick',if:{moved:false},period:1,rate:P('footing.rate',1),do:[{stack:'footing',add:1}]},   // ...each full second standing still adds one
             {on:'in',less:R(0.004),per:'footing'} ],
    aw_3_1:[ {on:'cast',skill:'laststand',do:[{stack:'scars',spend:'all',then:[{heal:{pct:0.02,of:'maxHp',x:'spent'}},{emit:'scarsSpent'}]}]} ],   // Reopened Wounds
    aw_4_2:[ {on:'hurt',if:{stackMin:{footing:5}},do:[{slow:R(0.03),dur:2,on:'source'}]} ], // Rooted Stance
    aw_2_3:[ {on:'block',do:[{heal:{pct:R(0.004),of:'maxHp'}}]} ],                          // Turned Aside
    aw_3_4:[ {on:'ccIn',less:R(0.04)} ],                                                    // Tenacity
    aw_4_1:[ {on:'scarsSpent',do:[{shield:{pct:R(0.006),of:'maxHp',x:'spent'},dur:4}]} ],   // Scar Tissue
    aw_3_3:[ {param:'scars.max',add:R(2)} ],                                                // Deep Scars
    aw_4_3:[ {on:'hurt',do:[{mark:'hitme',on:'source',dur:2}]},                             // Bitter Ash
             {on:'hit',if:{window:'bloodthirst',targetHas:'hitme'},do:[{heal:{pct:R(0.07),of:'lifesteal'}}]} ],
    aw_4_4:[ {on:'wave',do:[{mark:'oath',on:{team:'ally',others:true,order:'lowHp',n:1},unique:true}]},   // Bound by Oath
             {on:'teamIn',if:{targetHas:'oath',srcTeam:'enemy'},divert:R(0.04)} ],
    aw_5_1:[ {on:'death',if:{who:'ally'},do:[{stack:'scars',add:R(2)}]} ],                  // Grim Memory
    aw_5_2:[ {on:'cast',skill:'warcry',do:[{window:'planted',dur:2},{stack:'footing',set:'max'}]},   // Plant Your Feet: rooted = cannot walk, can still attack
             {stat:{move:-1},if:{window:'planted'}} ],
    aw_5_4:[ {on:'diverted',do:[{stack:'ledger',add:{pct:1,of:'spent'}}]},                  // Oath Ledger
             {on:'cast',skill:'laststand',do:[{stack:'ledger',spend:'all',then:[{dmg:{pct:R(0.06),of:'spent'},on:AROUND(5)},{emit:'ledgerBurst'}]}]} ],
    aw_6_1:[ {stat:{atk:R(0.002)},per:'scars'} ],                                           // Callused
    aw_6_2:[ {on:'end:planted',do:[{dmg:{pct:R(0.03),of:'maxHp'},on:AROUND(3)}]} ],         // Footfall
    aw_6_4:[ {on:'death',if:{unitHas:'oath'},do:[{window:'unpaid',dur:'wave'}]},            // Unpaid Debt
             {on:'in',if:{window:'unpaid'},less:R(0.06)} ],
    aw_7_2:[ {on:'cast',skill:'laststand',do:[{stack:'footing',set:'max'}]},                // Hold the Gate. PARTIAL: "enemies that walk into him are stopped" needs a ruling
             {stat:{immovable:1},if:{window:'laststand'}} ],
    aw_8_1:[ {on:'kit',skill:'warcry',opt:{fear:{add:R(0.03),per:'scars',ccRaw:true}}} ],   // War Ledger
    aw_8_3:[ {param:'footing.rate',add:R(0.10)} ],                                          // Stubborn Ground
    aw_8_4:[ {on:'hit',if:{window:'bloodthirst'},do:[{heal:{pct:R(0.04),of:'lifesteal'},on:'holder:oath'}]} ],   // Sworn Shield
    aw_9_1:[ {on:'cast',skill:'warcry',if:{stackMin:{scars:10}},do:[{taunt:1.5,on:{team:'enemy',of:'self',withinOpt:'radius',fearedBy:true}}]} ],   // Every Scar a Name
    aw_9_2:[ {on:'hurt',if:{stackFull:'footing'},do:[{dmg:{pct:R(0.02),of:'hit'},on:'source'}]} ],   // Anvil
    aw_9_4:[ {on:'wave',do:[{mark:'oath2',on:{team:'ally',others:true,order:'lowHp',n:1,skipN:1},unique:true}]},   // Shared Burden
             {on:'teamIn',if:{targetHas:'oath2',srcTeam:'enemy'},divert:R(0.01)} ],
    aw_10_1:[ {stat:{lifesteal:R(0.003)},per:'scars',if:{selfHpBelow:0.50}} ],              // Old Wounds Ache
    aw_11_2:[ {on:'lethal',once:'fight',if:{stackMin:{scars:5}},do:[{stack:'scars',spend:'all',then:[{undying:2},{heal:{pct:0.03,of:'maxHp',x:'spent'}}]}]} ],   // Unbroken
    aw_10_3:[ {on:'ccOut',if:{stackFull:'footing',cc:['fearT','slow']},more:R(0.04)} ],     // Mountain Stance
    aw_11_1:[ {on:'scarsSpent',do:[{window:'ash',dur:4,count:'spent'}]},                    // Ash and Iron
              {stat:{armor:R(0.01)},per:{window:'ash'}} ],
    aw_11_4:[ {on:'ledgerBurst',do:[{taunt:R(0.2),on:AROUND(5)}]} ],                        // Debt Collector
    aw_12_1:[ {on:'hurt',if:{lostBelow:{pct:{rk:'aw_1_1',r:-0.01,b:0.14},of:'maxHp'}},every:R(-2,30),do:[{stack:'scars',add:1}]} ],   // Ten Thousand Cuts
    aw_12_4:[ {on:'waveEnd',if:{holderAlive:'oath'},do:[{energy:R(1)}]} ]                   // Promise Kept
  },
  /* one sentence runs, another waits for a ruling */
  partial:{
    rh_n2:'"his Temper does not fade while any enemy carries one of his bleeds": no tooltip says how Temper fades, so there is nothing to stop',
    ib_13_2:'"all his banked blood and Temper become a shield": what one Temper is worth as shield is not written; the bank part, the 3 m attacks, Temper per hit taken and the 91-point line run',
    aw_7_2:'"enemies that walk into him during Last Stand are stopped for 0.5 s": the engine has no walking-into rule; full Footing and cannot-be-moved run'
  },
  /* nothing implemented: the text cannot run against his real kit, or leaves out a number. Each one is written up for the owner. */
  ruling:{
    rh_2_3:'Blood Rage has no stacks', ib_5_1:'Blood Rage has no stacks', ib_8_3:'Blood Rage has no stacks', aw_12_3:'Blood Rage has no stacks',
    rh_4_3:'Bloodthirst deals no damage', ib_3_3:'Bloodthirst deals no damage', ib_12_3:'Bloodthirst deals no damage',
    ib_3_1:'Bloodthirst is not a strike', ib_9_3:'Bloodthirst has no target',
    rh_7_2:'Last Stand already gives 100% lifesteal: "25% lifesteal" would be a loss',
    rh_5_2:'the bleed has no size: Warcry is not a hit',
    ib_4_1:'no tooltip says how Temper fades', ib_11_2:'no tooltip says how the Blood Bank fades or that it empties between waves',
    aw_1_4:'Vael never walks toward an ally', aw_5_3:'a leap: new movement', aw_6_3:'depends on Charge the Breach',
    aw_7_1:'no lanes, no "behind"', aw_7_4:'a position swap', aw_10_4:'depends on Change of Guard',
    aw_12_2:'depends on the stop of Hold the Gate', aw_13_2:'lanes, "cannot walk past", "behind him"'
  },
  /* the few things that are not one of the generic primitives */
  fn:{
    /* Grudge: the enemy that has dealt Vael the most damage this wave holds the 'grudge' mark. With Old Grudges learned, the enemy that
       was the Grudge keeps an 'oldgrudge' mark. Called on every hit he takes. */
    grudge(A,T,u,ctx){ const src=ctx.src; if(!src||!(ctx.hpLost>0)) return; const s=T.s, g=s.g||(s.g={w:-1,by:{},top:null});
      if(g.w!==s.wave){ g.w=s.wave; g.by={}; g.top=null; }
      g.by[src.uid]=(g.by[src.uid]||0)+ctx.hpLost;
      const cur=g.top; if(cur===src) return;
      if(!cur||!cur.alive||g.by[src.uid]>(g.by[cur.uid]||0)){ if(cur&&cur.alive&&T.r.ib_11_4) A.setMark(T,u,cur,'oldgrudge',{}); A.clearMark(u,src,'oldgrudge'); A.setMark(T,u,src,'grudge',{unique:true}); g.top=src; } }
  }
};
