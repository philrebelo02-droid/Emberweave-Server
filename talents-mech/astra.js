/* ASTRA - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (section 14: what Astra added)
   Her real kit (the code, not the tooltip wording):
   - Starfire ('nova', green, cd 7): cast on the most crowded enemy group at any distance (it forms there 0.35 s later): 110% of ability power x skill level
     to every enemy whose CENTRE is within 2.8 m of its centre (o.radius). No control.
   - Nebula ('aoedot', blue, cd 9): the same placement; 50% of ability power up front to every enemy within 3 m (centre), and a burn on each of them
     (#ffa657, magic: magic resist reduces each tick) of 50% ability power x skill level a second for 4 s (o.dur, whole seconds). The burn is put on AT THE
     CAST: nothing in the game stays on the ground (its picture lasts about the same 4 s of fight time). Talents that speak of "inside Nebula" read its
     circle as a talent zone that stays for its duration (zone 'neb', centre-measured as the skill measures).
   - Collapsing Star ('gravcrush', ultimate, player-aimed or the densest group): every enemy whose centre is within 8 m of its centre takes 200% x level
     and is stunned (the control table's area stun: 2.0 x the 30% cut = 1.4 s). It SETS a drag on every enemy that is not immovable (pulledBy / pullT 0.3 s),
     but the engine's drag has no stopping distance for a point, so today NOBODY MOVES (a game fact, see the rulings file D1). "Enemies it drags in" = the
     enemies in its circle that are not immovable (the ones the skill tries to drag).
   - Stardust (passive): after EVERY hit of hers that lands (basic attacks AND skill hits, not DoT ticks) the enemy gets a new burn of 10% (+0.1 pt a level)
     of her Attack stat each 0.5 s for 2 s (#6fe3d4). Each hit pushes its own burn: they already stack, with no limit, and never refresh.
   - Her damage is magic. The page hook 'at' (this work) tells her rows where each of her three area skills strikes (its centre, its options, its
     damage to each enemy before the target's resist); rows read that place as 'pt:nova' / 'pt:aoedot' / 'pt:gravcrush'.
   "Her burns" = Stardust's, Nebula's and Burning Starfire's, made hers (tags 'sd', 'neb', 'bs'). "Burning" = carrying one of them.
   Talents whose text cannot run against that kit are NOT guessed at: they are written up for the owner in WIRING/08 - ASTRA - talents that need a ruling.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const SF='nova', NEB='aoedot', CS='gravcrush';
const FIRE='#ff8a3a', STAR='#cfe8ff';
const HAZE_HOLD=0.04;                                                             // the Haze is renewed each tick on an enemy inside (a tick is 0.0273 s of fight)
const OOP={mark:['rec','recX','sky'],m:P('oop.m',4)};                             // Out of Place: more than 4 m from the place she recorded for it
const DRAG={team:'enemy',of:'pt:gravcrush',withinOpt:'radius',below:{immovable:1,_gearImmovableT:1e-9}};   // the enemies Collapsing Star drags in
const IN_PT={team:'enemy',of:'pt',withinOpt:'radius'};                            // every enemy the skill (or the zone) holds, centre to centre as the skill measures
const HC={team:'enemy',of:'target',within:2,skip:'target'};                       // Hot Core: enemies within 2 m of the one that Flares
const LG={team:'enemy',of:'pt:gravcrush',within:4};                               // Letting Go: every enemy within 4 m of the centre
const LIGHT=(b,$)=>({b,$,$m:'light.fast'});                                       // Light gained (Coin Turn: 10% more per rank)
const SPEND_U={stack:'light',spend:'all',then:[{stack:'lspU',set:{pct:1,of:'spent'}},{emit:'lightSpent'}]};   // Collapsing Star spends the Held Star
const HAZE=zone=>({on:'tick',req:'sb_1_1',if:{zone},do:[{mark:'haze',on:{team:'enemy',inZone:zone},dur:{b:HAZE_HOLD,$:'haze.linger'},ends:'hazeOff'}]});
const REC=[{mark:'rec',on:{team:'enemy'},clear:true},{mark:'rec',on:{team:'enemy',of:'self',n:P('rec.n',3)},spot:'here'},{window:'rc',dur:P('rec.every',6)}];
module.exports={
  hero:'astra',
  casting:true,                         // rows ask which of her skills a hit comes from
  points:true,                          // rows read where her area skills strike (the 'at' hook)
  states:{
    heat:{unit:true,max:10,dur:P('heat.dur',4),full:'flare',chain:99,longest:true},   // Heat on each enemy: all of it fades 4 s after the last gain; at 10 it Flares
    skyN:{unit:true,max:2,dur:8},                                                  // The Second Sky: drags back so far, on each enemy
    light:{max:{b:100,$:'light.max'}},                                             // the Held Star
    lsp:{}, lspU:{}, nHit:{}, bm:{}                                                // Light spent by this Starfire / this Collapsing Star; enemies this Starfire holds; burning enemies the star holds
  },
  /* needs: a talent that improves a mechanic does nothing without the talent that introduces it */
  needs:{ sb_3_1:'sb_1_1', sb_5_1:'sb_1_1',
          sb_2_4:'sb_1_4', sb_3_4:'sb_1_4', sb_n1:'sb_1_4', sb_4_4:'sb_1_4', sb_6_3:'sb_1_4', sb_6_4:'sb_1_4', sb_5_4:'sb_1_4', sb_8_4:'sb_1_4', sb_n2:'sb_1_4', sb_10_4:'sb_1_4',
          sb_11_3:'sb_1_4', sb_11_4:'sb_1_4', sb_n3:'sb_1_4', sb_13_3:'sb_1_4',
          hs_n1:'hs_1_1', hs_2_1:'hs_1_1', hs_4_1:'hs_1_1', hs_6_1:'hs_1_1', hs_8_1:'hs_1_1', hs_10_1:'hs_1_1', hs_11_1:'hs_1_1',
          hs_2_4:'hs_1_4', hs_3_4:'hs_1_4', hs_n2:'hs_1_4', hs_5_3:'hs_1_4', hs_6_4:'hs_1_4', hs_8_4:'hs_1_4', hs_9_4:'hs_1_4', hs_10_3:'hs_1_4', hs_11_4:'hs_1_4',
          hs_n3:'hs_1_4', hs_12_2:'hs_1_4', hs_12_3:'hs_1_4', hs_12_4:'hs_1_4', hs_13_3:'hs_1_4',
          ss_2_1:'ss_1_1', ss_3_1:'ss_1_1', ss_4_1:'ss_1_1', ss_9_1:'ss_1_1', ss_11_2:'ss_1_1',
          ss_2_3:'ss_1_3', ss_3_3:'ss_1_3', ss_5_3:'ss_1_3', ss_6_3:'ss_1_3', ss_7_4:'ss_1_3', ss_8_3:'ss_1_3', ss_10_3:'ss_1_3', ss_10_4:'ss_1_3', ss_11_3:'ss_1_3', ss_11_1:'ss_1_3', ss_12_4:'ss_1_3' },
  /* run for her whenever she has any mechanic talent: her burns made hers, Nebula's circle on the ground, the Haze, the Held Star's spending */
  always:[
    {on:'hit',if:{selfPass:'stardust',targetAlive:true},do:[{tagDots:'sd',last:true,on:'target',emit:'sdOn'}]},   // the Stardust burn this hit just left
    {on:'kit',skill:NEB,do:[{tagDots:'kit'}]}, {on:'cast',skill:NEB,do:[{tagDots:'neb',exact:true,emit:'nebOn'}]},  // Nebula's burns (Lingering Nebula / Thickening: a part second at the end)
    {on:'at',skill:NEB,unless:'ss_5_1',do:[{zone:'neb',at:'pt',radiusPx:{opt:'radius'},dur:{opt:'dur',d:4},centre:true,ends:'nebEnd'}]},
    HAZE('neb'), HAZE('star'),                                                     // with Haze learned: an enemy in a Nebula (or on the burning star) is in the Haze, and a while after
    {on:'kit',req:'hs_12_3',if:{stackFull:'light'},do:[{window:'wol',dur:99}]}, {on:'cast',req:'hs_12_3',do:[{window:'wol',end:true}]},   // Weight of Light: full as the ability is cast
    {on:'kit',skill:SF,req:'hs_1_4',do:[{stack:'lsp',set:0},{stack:'light',spend:'all',then:[{stack:'lsp',set:{pct:1,of:'spent'}},{emit:'lightSpent'}]}]},   // Starfire spends all the Light
    {on:'kit',skill:CS,do:[{stack:'lspU',set:0},{window:'lg',end:true}]},
    {on:'kit',skill:CS,req:'hs_5_3',do:[SPEND_U]},                                 // Imploding Star: Collapsing Star spends it all
    {on:'kit',skill:CS,req:'hs_13_3',unless:'hs_5_3',if:{stackMin:{light:100}},do:[SPEND_U]}   // Letting Go: so does a Collapsing Star cast with 100 or more
  ],
  talents:{
    /* ============================== SLOW BURN ============================== */
    sb_1_1:[ {on:'tick',do:[{dotRate:R(0.10),on:{team:'enemy',has:'haze'}}]} ],                     // Haze: her burns on enemies in the Haze tick 10% faster (each tick comes sooner)
    sb_1_2:[ {stat:{apow:R(0.01)},if:{any:[{some:{team:'enemy',has:'haze'}},{some:{team:'enemy',ust:{heat:5}}}]}} ],   // Starlight
    sb_1_4:[ {on:'dotTick',do:[{ustack:'heat',on:'target',add:1}]},                                 // Heat: each tick of her burns
             {on:'flare',if:{targetLacks:'flk'},do:[{mark:'flk',on:'target',dur:0.001},              //   a Flare (each enemy once in one chain of Flares)
               {ustack:'heat',on:'target',set:0},{ustack:'heat',on:'target',set:P('cinders',0),if:{p:'cinders',targetHpBelow:0.5}},
               {dmg:{pct:R(0.10),of:'apow'},on:'target',tag:'flare',color:FIRE,emitAmt:'flared'}]} ],
    sb_2_3:[ {on:'dotOut',if:{tag:'sd'},more:R(0.04)} ],                                            // Bright Dust
    sb_2_4:[ {param:'hc',add:1}, {on:'flared',do:[{dmg:{pct:R(0.30),of:'hit'},on:HC,tag:'hc',color:FIRE}]} ],   // Hot Core
    sb_3_1:[ {param:'haze.linger',add:R(0.3)} ],                                                    // Thick Haze
    sb_2_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                 // Quick Spark
    sb_4_3:[ {on:'sdOn',do:[{extendDot:R(0.3)}]} ],                                                 // Dust Storm
    sb_3_4:[ {on:'flared',req:'sb_2_4',do:[{ustack:'heat',on:HC,add:4}]} ],                         // Chain Flare: caught by another enemy's Flare
    sb_n1:[  {on:'flared',do:[{heal:{pct:R(0.002),of:'maxHp'},on:'self'}]} ],                       // Starwarmed
    sb_4_2:[ {param:'neb.r',add:R(0.2)}, {on:'kit',skill:NEB,opt:{radius:{addM:R(0.2)}}} ],         // Wide Nebula
    sb_4_4:[ {on:'dmg:flare',more:R(0.03)} ],                                                       // Ignition Point
    sb_5_1:[ {on:'dotOut',if:{targetHas:'haze'},more:R(0.02)} ],                                    // Haze Bite
    sb_8_2:[ {on:'kit',skill:CS,opt:{radius:{addM:R(0.2)}}} ],                                      // Wider Horizon
    sb_6_1:[ {param:'neb.dur',add:R(0.2)}, {on:'kit',skill:NEB,opt:{dur:{add:R(0.2)}}} ],           // Lingering Nebula
    sb_6_3:[ {on:'hit',if:{casting:SF},do:[{ustack:'heat',on:'target',add:R(1)}]} ],               // Kindling Starfire
    sb_6_4:[ {on:'flared',do:[{energy:R(2)}]} ],                                                    // Flare Feed
    sb_7_2:[ {on:'kit',skill:CS,opt:{mul:{more:R(0.03)}}} ],                                        // Heavy Star
    sb_7_3:[ {on:'hit',if:{casting:SF,targetAlive:true},do:[{dot:'bs',on:'target',amt:{pct:0.15,of:'apow'},dur:P('burn.long',2),every:0.5,color:FIRE}]} ],   // Burning Starfire
    sb_7_4:[ {on:'teamHeal',if:{unitDot:true},less:R(0.03)} ],                                      // Searing
    sb_8_1:[ {on:'kit',skill:NEB,opt:{dps:{more:R(0.05)}}} ],                                       // Settling Haze
    sb_5_2:[ {on:'sdOn',if:{auto:true},do:[{copyDot:'sd',on:{team:'enemy',of:'target',n:1,skip:'target'}}]} ],   // Catching Fire
    sb_5_4:[ {param:'heat.dur',add:R(0.4)} ],                                                       // Warmth Kept
    sb_9_1:[ {on:'cast',skill:CS,do:[{zone:'neb',at:'pt:gravcrush',radius:{b:3,$:'neb.r'},dur:{b:4,$:'neb.dur'},centre:true,ends:'nebEnd'}]} ],   // Haze Collapse (reading: the circle, not a second cast)
    sb_9_2:[ {on:'cd',less:R(0.01)} ],                                                              // Clear Night
    sb_9_3:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetDot:true},more:R(0.015)} ],  // Bright Ledger
    sb_8_4:[ {on:'flared',do:[{slow:R(0.06),dur:2,on:'target'},{slow:R(0.06),dur:2,on:HC,if:{p:'hc'}}]} ],   // Long Flare
    sb_10_2:[ {on:'in',if:{srcDot:true},less:R(0.015)} ],                                           // Heat Mirage
    sb_n2:[  {param:'cinders',add:R(1)} ],                                                          // Cinders Kept (the Flare row reads it)
    sb_10_4:[ {on:'kill',if:{any:[{tag:'flare'},{tag:'hc'}]},do:[{dmg:{pct:1,of:'hit'},on:{team:'enemy',of:'target',within:4,skip:'target'},tag:'nova2',color:FIRE},   // Supernova (reading: 4 m)
               {slow:{rk:'sb_8_4',r:0.06},dur:2,on:{team:'enemy',of:'target',within:4,skip:'target'}}]} ],
    sb_11_3:[ {on:'ccHit',if:{casting:CS,cc:['stunned'],talent:false},do:[{ustack:'heat',on:'target',add:R(3)}]} ],   // Crushed Sparks
    sb_11_4:[ {stat:{aspd:R(-0.003)},per:{ust:'heat',of:'target'},to:{team:'enemy',ust:{heat:1}}} ],   // Fever
    sb_12_1:[ {param:'burn.long',add:R(0.2)}, {on:['sdOn','nebOn'],do:[{extendDot:R(0.2)}]} ],      // Long Glow
    sb_n3:[  {on:'hazeOff',do:[{ustack:'heat',on:'target',touch:true,dur:R(1)}]} ],                 // Carried Heat
    sb_12_3:[ {on:'at',skill:CS,do:[{stack:'bm',set:{units:Object.assign({dot:true},IN_PT),max:5}}]}, {on:'out',if:{casting:CS},more:R(0.01),per:'bm'} ],   // Burning Mass
    sb_13_3:[ {on:'cast',skill:CS,do:[{emit:'flare',on:DRAG},{zone:'star',at:'pt:gravcrush',radius:3,dur:5}]},   // Every Star Burns (SIGNATURE): the dragged Flare at once
              {on:'tick',each:{team:'enemy'},if:{targetIn:'star'},period:0.5,do:[{ustack:'heat',on:'target',add:2}]} ],   //   the burning star: 2 Heat every 0.5 s within 3 m (and the Haze: always row)

    /* ============================== THE HELD STAR ============================== */
    hs_1_1:[ {param:'pt.on',add:1},                                                                 // Points: each enemy Starfire hits, 6 s, at most 3 on the field
             {on:'hit',if:{casting:SF,targetAlive:true},do:[{mark:'pt',on:'target',dur:P('pt.dur',6),cap:3,added:'ptNew'}]},
             {on:'out',if:{targetHas:'pt'},more:R(0.02)} ],
    hs_1_3:[ {on:'out',if:{auto:false},ignoreMr:R(0.03)} ],                                         // Sharp Light
    hs_1_4:[ {on:'hit',if:{auto:true},do:[{stack:'light',add:LIGHT(4,'light.auto')}]},              // Held Star: 4 Light a basic attack
             {on:'cast',do:[{stack:'light',add:LIGHT(10)}]},                                        //   10 an ability (after it: Starfire spends what was there)
             {on:'kit',skill:SF,opt:{mul:{more:R(0.001),per:'lsp'}}} ],                            //   0.1% more per Light spent
    hs_2_2:[ {on:'kit',skill:SF,opt:{mul:{more:R(0.03)}}} ],                                        // Focused Starfire
    hs_n1:[  {on:'out',if:{casting:SF,targetHas:'pt'},more:0.04},                                   // Fixed Stars (LINK)
             {on:'kit',skill:SF,req:'ss_1_3',do:[{window:'fs',dur:99}]}, {on:'cast',skill:SF,req:'ss_1_3',do:[{window:'fs',end:true}]},
             {on:'ptNew',req:'ss_1_3',if:{window:'fs',casting:SF},do:[{window:'fs',end:true},{mark:'recX',on:'target',spot:'here',dur:2}]} ],   //   with Recorded: the first new Point, 2 s
    hs_2_4:[ {param:'light.max',add:R(15)} ],                                                       // Brighter Coin
    hs_2_1:[ {param:'pt.dur',add:R(1)} ],                                                           // Long Points
    hs_4_2:[ {on:'at',skill:SF,do:[{mark:'ctr',on:{team:'enemy'},clear:true},{mark:'ctr',on:Object.assign({n:1},IN_PT)}]},   // Tight Nova: the enemy nearest its centre
             {on:'out',if:{casting:SF,targetHas:'ctr'},more:R(0.06)} ],
    hs_4_3:[ {on:'kit',skill:CS,opt:{stun:{add:R(0.15),ccRaw:true}}} ],                            // Heavier Collapse
    hs_3_4:[ {on:'kit',skill:SF,if:{stackMin:{lsp:100}},do:[{window:'ss',dur:99}]}, {on:'cast',skill:SF,do:[{window:'ss',end:true}]},   // Spent Star
             {on:'hit',if:{casting:SF,window:'ss',targetAlive:true},do:[{stun:0.8,on:'target'}]} ],
    hs_4_1:[ {on:'death',if:{who:'enemy',unitHas:'pt'},do:[{stack:'light',add:{r:8,$m:'light.fast'}}]} ],   // Point by Point
    hs_n2:[  {on:'kit',skill:SF,if:{stackMin:{lsp:50}},do:[{energy:R(1)}]} ],                      // Bright Return
    hs_5_3:[ {on:'kit',skill:CS,opt:{mul:{more:0.003,per:'lspU'}}} ],                               // Imploding Star (the spend: always row)
    hs_5_4:[ {on:'kit',skill:CS,opt:{radius:{addM:2},mul:{more:-0.15}}} ],                          // Wide Collapse
    hs_5_2:[ {on:'kit',skill:SF,opt:{radius:{addM:R(0.1)}}} ],                                      // Open Hand
    hs_3_3:[ {on:'kit',skill:CS,opt:{mul:{more:R(0.03)}}} ],                                        // Collapsing Light
    hs_6_1:[ {on:'out',if:{auto:true,targetHas:'pt'},more:R(0.08)} ],                               // Star Chart
    hs_6_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                 // Quick Starfire
    hs_6_4:[ {on:'wave',do:[{stack:'light',atLeast:R(6)}]} ],                                       // Hoard
    hs_7_1:[ {on:'out',if:{auto:false},more:R(0.025)}, {on:'in',if:{srcMelee:false},more:R(0.02)} ],   // Glass Sky (RISK)
    hs_7_2:[ {on:'at',skill:SF,do:[{after:0.5,do:[{dmg:{pct:0.5,of:'raw'},def:'magic',on:IN_PT,tag:'twin',color:STAR}]}]} ],   // Twin Starfire: the same spot 0.5 s later, half
    hs_8_1:[ {on:'out',if:{casting:SF,targetHas:'pt'},more:R(0.04)} ],                              // Marked Points
    hs_8_3:[ {on:'ccHit',if:{casting:CS,cc:['stunned'],talent:false},do:[{mark:'dc',on:'target',dur:3}]}, {on:'out',if:{targetHas:'dc'},more:R(0.02)} ],   // Deep Collapse
    hs_8_4:[ {param:'light.fast',add:R(0.10)} ],                                                    // Coin Turn
    hs_9_2:[ {on:'at',skill:SF,do:[{stack:'nHit',set:{units:IN_PT}}]}, {on:'out',if:{casting:SF},more:R(0.02),per:{stack:'nHit',over:1,max:4}} ],   // Crowded Sky
    hs_9_3:[ {on:'out',if:{casting:CS,targetHpAbove:0.5},more:R(0.02)} ],                           // Great Mass
    hs_9_4:[ {on:'tick',edge:true,once:'wave',if:{selfHpBelow:0.40},do:[{stack:'light',set:'max'}]} ],   // Flip
    hs_10_1:[ {stat:{move:R(-0.04)},to:{team:'enemy',has:'pt'}} ],                                  // Pinned Points
    hs_10_2:[ {on:'cd',less:R(0.01)} ],                                                             // Night Patience
    hs_10_3:[ {on:'cast',skill:CS,do:[{stack:'light',add:{r:20,$m:'light.fast'}}]} ],               // Let It Go
    hs_11_1:[ {on:'kit',skill:SF,if:{atLeast:{n:3,of:{team:'enemy',has:'pt'}}},do:[{window:'tl',dur:99}]},   // Three Lights: 3 Points as she casts
              {on:'at',skill:SF,if:{window:'tl'},do:[{window:'tl',end:true},{emit:'tlBurst',on:{team:'enemy',has:'pt'}}]},
              {on:'tlBurst',do:[{dmg:{pct:1,of:'raw'},def:'magic',on:{team:'enemy',of:'target',withinOpt:'radius'},tag:'tl',color:STAR}]} ],   //   a burst like Starfire's on each Point
    hs_11_4:[ {on:'in',less:R(0.002),per:{stack:'light',div:10}} ],                                 // Patient Coin
    hs_n3:[  {on:'lightSpent',do:[{stack:'light',add:{pct:R(0.10),of:'spent'}}]} ],                 // Kept Change
    hs_12_2:[ {stat:{armor:R(0.03)},if:{stackMin:{light:50}}} ],                                    // Midnight Coat
    hs_12_3:[ {on:'out',if:{auto:false,window:'wol'},more:R(0.02)} ],                               // Weight of Light (the window: always row)
    hs_12_4:[ {param:'light.auto',add:R(1)} ],                                                      // Steady Coin
    hs_13_3:[ {on:'kit',skill:CS,if:{stackMin:{lspU:100}},do:[{window:'lg',dur:99}]},               // Letting Go (SIGNATURE): cast with 100 or more Light
              {on:'cast',skill:CS,if:{window:'lg'},do:[{window:'lg',end:true},{after:0.3,do:[       //   after the drag (its 0.3 s), on the centre
                {dmg:{pct:2.5,of:'apow'},on:LG,tag:'lg',color:STAR},{extend:'stunned',by:1,on:LG},{mark:'pt',on:LG,dur:P('pt.dur',6),cap:3,if:{p:'pt.on'}}]}]} ],

    /* ============================== THE SECOND SKY ============================== */
    ss_1_1:[ {on:'hit',if:{casting:SF,targetAlive:true},do:[{mark:'orbit',on:'target',dur:P('orbit.dur',3),longest:true},   // Orbit
               {pull:'target',to:'pt:nova',speed:R(0.2),secs:P('orbit.dur',3)}]} ],                 //   drifting 0.2 m a second toward where it burst
    ss_1_3:[ {on:'wave',do:REC}, {on:'end:rc',do:REC},                                              // Recorded: every 6 s, the 3 enemies nearest her
             {on:'out',if:{targetAway:OOP},more:R(0.03)} ],                                         //   Out of Place
    ss_2_1:[ {param:'orbit.dur',add:R(0.5)} ],                                                      // Tight Orbit
    ss_2_3:[ {param:'oop.m',add:R(-0.5)} ],                                                         // Four Degrees
    ss_3_1:[ {on:'in',if:{srcHas:'orbit'},less:R(0.015)}, {on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally',srcHas:'orbit'},less:R(0.015)} ],   // Orbit Weight
    ss_3_2:[ {stat:{move:R(-0.02)},if:{zone:'neb'},to:{team:'enemy',inZone:'neb'}} ],               // Clinging Nebula
    ss_3_3:[ {on:'tick',do:[{slow:0.20,dur:0.2,on:{team:'enemy',away:OOP}}]} ],                     // Moved Star
    ss_4_1:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'orbit'},more:R(0.02)} ], // Bound to Orbit
    ss_4_2:[ {stat:{aspd:R(-0.03)},if:{zone:'neb'},to:{team:'enemy',inZone:'neb'}} ],               // Dense Nebula
    ss_4_4:[ {on:'cd',skill:'blue',add:R(-0.5)} ],                                                  // Patient Ledger
    ss_5_1:[ {on:'at',skill:NEB,do:[{zone:'neb',at:'pt',radiusPx:{opt:'radius'},dur:{opt:'dur',d:4},centre:true,ends:'nebEnd',follow:Object.assign({n:1},IN_PT)}]} ],   // Bright Nebula
    ss_5_2:[ {on:'at',skill:NEB,do:[{window:'dn',dur:1.5}]}, {stat:{move:-1},if:{window:'dn'},to:{team:'enemy',inZone:'neb'}} ],   // Dark Nebula (reading: held in place)
    ss_5_3:[ {param:'rec.n',add:R(1)} ],                                                            // Second Entry
    ss_5_4:[ {on:'ccIn',less:R(0.04)} ],                                                            // Star Calm
    ss_6_1:[ {on:'kit',skill:SF,opt:{radius:{addM:R(0.1)}}} ],                                      // Wide Orbit
    ss_6_3:[ {on:'teamIn',if:{srcIs:'ally',targetAway:OOP},more:R(0.03)} ],                         // Out of Turn
    ss_6_4:[ {on:'kit',skill:CS,opt:{stun:{add:R(0.15),ccRaw:true}}} ],                            // Firm Hand
    ss_7_2:[ {on:'kit',skill:NEB,opt:{dps:{more:R(0.03)}}} ],                                       // Nebula Weight
    ss_7_3:[ {on:'kit',skill:CS,opt:{mul:{more:R(0.03)}}} ],                                        // Heavy Sky
    ss_7_4:[ {on:'cast',skill:CS,do:[{mark:'recX',on:DRAG,spot:'pt:gravcrush',dur:P('rec.every',6)}]} ],   // Rewritten Sky
    ss_8_2:[ {param:'neb.dur',add:R(0.3)}, {on:'kit',skill:NEB,opt:{dur:{add:R(0.3)}}} ],           // Thickening
    ss_8_3:[ {param:'rec.every',add:R(1)} ],                                                        // Mark Kept
    ss_9_1:[ {on:'tick',do:[{slow:R(0.03),dur:0.2,on:{team:'enemy',has:'orbit'}}]} ],               // Captured
    ss_9_2:[ {on:'nebEnd',do:[{pull:IN_PT,to:'pt',secs:0.3},{stun:0.5,on:IN_PT}]} ],                // Star Nursery
    ss_9_4:[ {on:'cd',less:R(0.01)} ],                                                              // Steady Count
    ss_10_1:[ {on:'in',if:{srcBeyond:8},less:R(0.03)} ],                                            // Distant Observer
    ss_10_3:[ {on:'in',if:{srcAway:OOP},less:R(0.015)}, {on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally',srcAway:OOP},less:R(0.015)} ],   // Old Sky
    ss_10_4:[ {on:'death',if:{who:'enemy',unitAway:OOP},do:[{heal:{pct:R(0.01),of:'maxHp'},on:'self'}]} ],   // Ink and Starlight
    ss_11_2:[ {on:'cast',skill:CS,do:[{mark:'orbit',on:DRAG,dur:R(0.4),longest:true},{pull:DRAG,to:'pt:gravcrush',speed:{rk:'ss_1_1',r:0.2},secs:R(0.4)}]} ],   // Star Gravity
    ss_11_3:[ {on:'tick',each:{team:'enemy'},edge:true,if:{targetAway:OOP},do:[{pull:'target',to:{spot:OOP.mark},m:R(0.5),secs:0.3}]} ],   // Back Where It Was
    ss_12_1:[ {stat:{move:R(0.03)}} ],                                                              // Night Breeze
    ss_12_2:[ {on:'cast',skill:CS,do:[{silence:R(0.3),on:DRAG}]} ],                                 // Hushed Sky
    ss_11_1:[ {on:'at',skill:CS,each:IN_PT,icd:12,if:{any:[{targetMin:{immovable:1}},{targetMin:{_gearImmovableT:1e-9}},{targetMin:{stunImmune:1}}]},   // Watcher's Calm
               do:[{mark:'recX',on:'target',spot:'here',dur:R(2),awayFor:R(2)}]} ],
    ss_12_4:[ {on:'in',less:R(0.01),per:{units:{team:'enemy',away:OOP},max:3}} ],                   // Many Wrong
    ss_13_2:[ {on:'cast',skill:CS,do:[{mark:'sky',on:{team:'enemy'},spot:'here',dur:8},{ustack:'skyN',on:{team:'enemy'},set:0}]},   // The Second Sky (SIGNATURE)
              {on:'tick',each:{team:'enemy',has:'sky'},if:{targetAway:{mark:'sky',m:2},targetLacks:'skyL',targetUstBelow:{skyN:2}},   //   more than 2 m from its mark: dragged back, stunned
               do:[{mark:'skyL',on:'target',dur:0.35},{ustack:'skyN',on:'target',add:1},{pull:'target',to:{spot:'sky'},secs:0.3},{stun:0.6,on:'target'}]} ]
  },
  /* one sentence runs, another waits for a ruling */
  partial:{},
  /* nothing implemented: the text cannot run against her real kit. Each one is written up for the owner. */
  ruling:{
    sb_5_3:'"stack on the same enemy, up to 3 at once, instead of refreshing": Stardust burns already stack with no limit and never refresh, so the sentence describes a game that is not there'
  }
};
