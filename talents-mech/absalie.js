/* ABSALIE - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (section 15: what Absalie added)
   Her real kit (the code, not the tooltip wording):
   - Abyssal Needle ('mrshred', green, cd 6, delivered as a shot): 150% of ability power x skill level, magic, to her target; then that enemy's magic resist is cut
     by o.shred (32%, a third of the skill curve on top, at most 45%) for o.dur (5 s): _mrShredPct / _mrShredT. Single target.
   - Gravity Knot ('gravknot', blue, cd 10, formed where she stands): every enemy whose CENTRE is within 4 m (o.radius) of HER is moved at once 60% of the way
     toward her, at most o.pull (2.2 m) (not an immovable one), slowed through ccApply (the control table's area slow: 3 s x the 30% cut = 2.1 s) and struck
     for 60% of ability power x level (magic). She stands in the back row, so the plain Knot catches only enemies that came to her.
   - Event Horizon ('eventhorizon', ultimate, player-aimed or the densest group): every enemy whose centre is within 7 m of its centre is caught and dragged
     toward it with the engine's own drag, which HAS a stopping distance (pullStop 6): it really moves them (unlike Astra's Collapsing Star). After the drag
     (1.2 s x BATTLE_PACE) it collapses: 190% x level to each caught enemy still alive, and their silence is WRITTEN STRAIGHT ON (1.05 s, no ccApply).
     Veyr's Abyssal Undertow runs the same code with a slow instead; every hook passes its own skill name.
   - Dark Convergence (passive): at the PRESS of an area ability (castKit: only Gravity Knot) she gets 4 x 3 energy x her passive's level, however many it
     will hit. Never for the Needle (one target), never for Event Horizon (the ultimate does not go through castKit).
   - A silence cancels a cast under way (castTick): that is how her talents "interrupt" and make a cast "fail"; the cooldown spent at the press stays spent.
   Page hooks used for her (doc 03 section 15): 'at' in the Knot and Event Horizon cases (where they form; marks 'gkC' / 'ehC' = what they catch, as the skill
   measures, centre to centre); 'skillTgt' in the Knot (its centre: Wide Knot); 'landPre' / 'land' around the collapse (its hits are 'eventhorizon' to the
   rows) and a direct 'ccHit' for each silence it writes; new: 'teamCc' (a control on a watched unit through ccApply) and 'nrgPre' / 'nrgIn' (energy a
   watched unit gains from a hit).
   Readings and capped or reworded tooltips: WIRING/11 - ABSALIE - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const NE='mrshred', GK='gravknot', EH='eventhorizon';
const IN_PT={team:'enemy',of:'pt',withinOpt:'radius'};                            // every enemy the skill catches where it forms, centre to centre as the skill measures
const GKC={team:'enemy',has:'gkC'}, EHC={team:'enemy',has:'ehC'};                 // what this Knot / this Event Horizon caught
const TNG={team:'enemy',has:'tng'}, TNG_O={team:'enemy',has:'tng',skip:'target'}; // Tangled enemies (the others)
const NEAR_O={team:'enemy',of:'target',n:1,skip:'target'};                        // the nearest other enemy to the target
const SIL={silencedT:1e-9};                                                       // silenced now
const VS_ALLY={srcTeam:'enemy',targetTeam:'ally'};                                // an enemy's hit on one of her allies (teamIn)
const MUFFLE=(on,k)=>({emit:'muffle',on,k});                                      // Muffled for k seconds (the always row writes it)
module.exports={
  hero:'absalie',
  casting:true,                         // rows ask which of her skills a hit comes from
  points:true,                          // rows read where the Knot and Event Horizon form (the 'at' hook)
  states:{
    thr:{unit:true,max:4,dur:P('thr.dur',8),gain:'thrGain'},                     // Threads on each enemy: all of them lapse 8 s after the last one
    tension:{max:{b:12,$:'tension.max'},dur:P('tension.dur',10)},                 // Tension: all of it lapses 10 s after the last gain
    word:{max:6,fade:{after:{b:8,$:'word.dur'},every:0.01,lose:99,unless:{selfHpAbove:{b:9,$:'word.hold'}}},gain:'wordGain'},   // Words: all fade 8 s after the last one (Hoarded Words: not above half HP)
    ehN:{}                                                                         // enemies this Event Horizon caught (Collapse, at most 5)
  },
  /* run for her whenever she has any mechanic talent: what her area skills catch, her silences as one event, Muffled as one state, the Knot's slow strength */
  always:[
    {on:'at',skill:GK,do:[{mark:'gkC',on:{team:'enemy'},clear:true},{mark:'gkC',on:IN_PT,dur:1}]},
    {on:'at',skill:EH,do:[{mark:'ehC',on:{team:'enemy'},clear:true},{mark:'ehC',on:IN_PT,dur:4}]},
    {on:'ccHit',if:{cc:['silencedT'],targetAlive:true},do:[{emit:'quiet'}]},                                   // every silence of hers that lands (ctx.amt = its seconds)
    {on:'muffle',do:[{mark:'muf',on:'target',dur:{flat:1,k:1},longest:true,ends:'mufEnd'},{window:'mufW',dur:{flat:1,k:1},longest:true}]},
    {on:'ccHit',if:{casting:GK,cc:['slow'],talent:false,p:'gk.slow'},do:[{slowMore:P('gk.slow',0),on:'target'}]},   // Leaning In / Close Knot: the Knot's own slow, stronger
    {on:'cast',skill:NE,do:[{window:'unw',end:true},{window:'eye',end:true},{window:'cn',end:true}]}           // the Needle's one-cast windows close with the cast
  ],
  talents:{
    /* ============================== THE EMPTY CHAIR ============================== */
    ec_1_1:[ {on:'hit',if:{casting:NE,targetAlive:true},do:[{ustack:'thr',on:'target',add:1}]},                // Fray: each Needle pulls a Thread (max 4, 8 s)
             {on:'out',ignoreMr:R(0.01),per:{ust:'thr'}} ],                                                     //   her hits ignore 1% of its magic resist per Thread
    ec_1_3:[ {on:'hit',if:{auto:true,targetHas:'hol',targetAlive:true},chance:R(0.06),do:[{ustack:'thr',on:'target',add:1}]} ],   // Fine Work
    ec_1_4:[ {on:'kit',skill:NE,opt:{mul:{more:R(0.04)}}} ],                                                    // Point of Nothing
    ec_2_1:[ {param:'thr.dur',add:R(1)} ],                                                                      // Loose Ends
    ec_2_2:[ {on:'hit',if:{casting:NE,targetAlive:true},do:[{mark:'hol',on:'target',dur:P('hol.dur',5),longest:true}]},   // Hollow: 5 s
             {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'hol',targetMin:{shield:1e-9}},more:R(0.04)},   //   its shield wears through 4% faster (hits on it deal 4% more while it has one)
             {on:'teamHeal',if:{unitHas:'hol'},less:R(0.02)} ],                                                 //   healing on it 2% weaker
    ec_n1:[  {on:'out',if:{casting:NE,targetMin:SIL},more:0.08},                                                // Pulled Word (LINK)
             {on:'quiet',req:'us_1_1',do:[{ustack:'thr',on:'target',add:1}]} ],                                 //   with Swallowed Word: each Word taken also pulls a Thread
    ec_3_1:[ {on:'kit',skill:NE,if:{targetUst:{thr:4}},opt:{mul:{more:0.6}},do:[{window:'unw',dur:99}]},       // Unwoven: at 4 Threads the next Needle 60% more
             {on:'hit',if:{casting:NE,window:'unw'},do:[{window:'unw',end:true},{ustack:'thr',on:'target',set:0},{emit:'unwoven'}]} ],   //   and the Threads clear
    ec_n2:[  {on:'in',if:{srcUst:{thr:1}},less:R(0.015)} ],                                                     // Coming Apart
    ec_3_4:[ {on:'kit',skill:NE,opt:{dur:{add:R(0.3)}}} ],                                                      // Long Shred
    ec_4_1:[ {stat:{move:R(-0.01)},per:{ust:'thr'},to:{team:'enemy',ust:{thr:1}},if:{window:'thrW'}},          // Pulled Thread: 1% slower per Thread
             {on:'thrGain',do:[{window:'thrW',dur:P('thr.dur',8),longest:true}]} ],                             //   (looked at only while a Thread can be down)
    ec_4_2:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'hol',targetMin:{shield:1e-9},hitMin:{pct:1,of:'tgtShield'}},   // Gutted Ward: a hit that breaks it
               do:[{after:0,do:[{dmg:{pct:R(0.10),of:'apow'},on:'target',tag:'gw'}]}]} ],
    ec_5_2:[ {on:'hit',if:{casting:NE},do:[{dmg:{pct:0.4,of:'hit'},on:NEAR_O,tag:'n2'}]} ],                      // Second Needle (PICK ONE)
    ec_5_3:[ {on:'kit',skill:NE,if:{none:{team:'enemy',of:'target',within:3,skip:'target'}},opt:{shred:{add:0.08}}} ],   // Long Needle (PICK ONE)
    ec_5_1:[ {on:'death',if:{who:'enemy',unitHas:'hol'},do:[{zone:'ep',at:'unit',radius:P('ep.r',2),dur:P('ep.dur',6),catch:'epCatch',uses:P('ep.n',1)}]},   // Empty Place
             {on:'epCatch',do:[{pull:'target',to:'pt',secs:0.3},{dmg:{pct:R(0.08),of:'apow'},on:'target',tag:'ep'}]} ],   //   the next enemy within 2 m: into the middle, 8% of her ability power
    ec_2_4:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                             // Quick Needle
    ec_5_4:[ {on:'cd',less:R(0.01)} ],                                                                          // Patient Hands
    ec_6_1:[ {param:'ep.r',add:R(0.3)} ],                                                                       // Wider Gap
    ec_6_2:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'hol'},more:R(0.015)} ],              // Nothing Left
    ec_7_1:[ {param:'ep.n',add:1} ],                                                                            // Hungry Gap
    ec_7_2:[ {on:'kit',skill:NE,if:{targetHas:'hol'},do:[{window:'eye',dur:99}]},                              // Needle's Eye: against an enemy already Hollow
             {on:'hit',if:{casting:NE,window:'eye'},do:[{window:'eye',end:true},{mark:'hol',on:NEAR_O,dur:P('hol.dur',5),longest:true},{dmg:{pct:0.5,of:'hit'},on:NEAR_O,tag:'eye'}]} ],
    ec_9_3:[ {on:'out',if:{auto:false,targetHpBelow:0.4},more:R(0.02)} ],                                       // No One Home
    ec_7_4:[ {on:'kit',skill:NE,opt:{shred:{add:R(0.01)}}} ],                                                   // Empty Hands
    ec_8_2:[ {param:'hol.dur',add:R(0.5)} ],                                                                    // Set Place
    ec_8_3:[ {on:'out',if:{casting:NE},ignoreMr:R(0.01)} ],                                                     // Fine Point
    ec_8_4:[ {on:'in',if:{srcHas:'hol'},less:R(0.03)} ],                                                        // Cold Plate
    ec_9_1:[ {on:'out',if:{auto:true},more:R(0.02),per:{ust:'thr'}} ],                                          // Frayed Edge
    ec_9_4:[ {on:'in',once:'wave',if:{hitMin:{pct:0.30,of:'maxHp'}},mul:0.5} ],                                 // Kept Chair
    ec_10_1:[ {on:'epCatch',do:[{mark:'hol',on:'target',dur:R(1.5),longest:true}]} ],                           // Unmade Bed
    ec_10_2:[ {on:'out',if:{casting:GK,targetHas:'hol'},more:R(0.04)} ],                                        // Narrow Gap
    ec_10_3:[ {stat:{nrg:R(0.02)}} ],                                                                           // Distant Stare
    ec_11_2:[ {on:'out',if:{casting:NE,targetUst:{thr:4}},more:R(0.08)} ],                                      // Last Stitch
    ec_11_3:[ {on:'out',if:{casting:EH,targetHas:'hol'},more:R(0.03)} ],                                        // Pale Loom
    ec_11_4:[ {on:'in',if:{auto:true},less:R(0.03)} ],                                                          // Void Cloak
    ec_12_1:[ {on:'unwoven',do:[{energy:R(4)}]} ],                                                              // Unravelling: 4 Threads cut, 1 energy each per rank
    ec_12_2:[ {param:'ep.dur',add:R(1)} ],                                                                      // Long Absence
    ec_12_3:[ {on:'out',if:{casting:NE,targetIs:{team:'enemy',order:'high:maxHp',n:1}},more:R(0.03)} ],         // Hollow Crown
    ec_13_3:[ {on:'land',skill:EH,do:[{emit:'chair',on:{team:'enemy',has:'ehC',order:'most:thr',n:1}}]},        // The Empty Chair (SIGNATURE): the caught enemy with the most Threads
              {on:'chair',do:[{stun:2,on:'target',if:{targetIs:{team:'enemy',boss:false}}},{stun:1,on:'target',if:{targetIs:{team:'enemy',boss:true}}},
                {mark:'chair',on:'target',dur:2.1,while:'stunned',ends:'chairEnd'}]},                           //   set aside: stunned 2 s (1 s on a boss)
              {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'chair'},more:0.15},                 //   her team deals 15% more to it
              {on:'teamHeal',if:{unitHas:'chair'},mul:0},                                                       //   it cannot be healed
              {on:'chairEnd',do:[{mark:'hol',on:'target',dur:P('hol.dur',5),longest:true},{ustack:'thr',on:'target',set:4},{emit:'thrGain'},{mark:'chairN',on:'target',dur:30}]},   //   back Hollow with 4 Threads
              {on:'kit',skill:NE,unless:'ec_3_1',if:{targetHas:'chairN'},opt:{mul:{more:0.6}},do:[{window:'cn',dur:99}]},   //   her next Needle on it (Unwoven does this itself)
              {on:'hit',unless:'ec_3_1',if:{casting:NE,window:'cn'},do:[{window:'cn',end:true},{mark:'chairN',on:'target',clear:true},{later:[{ustack:'thr',on:'target',set:0}]}]} ],   //   (after this Needle's own Thread: all cut)

    /* ============================== THE GREAT KNOT ============================== */
    gk_1_1:[ {on:'at',skill:GK,do:[{mark:'tng',on:IN_PT,dur:P('tng.dur',3),longest:true},{window:'tngW',dur:P('tng.dur',3),longest:true}]},   // Tangle: 3 s
             {on:'hit',if:{targetHas:'tng'},do:[{dmg:{pct:R(0.04),of:'hit'},on:TNG_O,tag:'tng'}]} ],            //   4% of her hit on one to each of the others
    gk_2_4:[ {on:'kit',skill:GK,opt:{pull:{addM:R(0.2)}}}, {param:'gk.half',add:R(0.1)} ],                      // Deeper Pull (Slipknot pulls half of it)
    gk_1_4:[ {on:'kit',skill:GK,opt:{mul:{more:R(0.05)}}} ],                                                    // Tight Knot
    gk_2_1:[ {param:'tng.dur',add:R(0.5)} ],                                                                    // Snarl
    gk_2_3:[ {on:'at',do:[{stack:'tension',add:{units:IN_PT}}]},                                               // Tension: each enemy the Knot or Event Horizon catches
             {stat:{apow:R(0.003)},per:'tension'} ],
    gk_3_1:[ {on:'at',skill:EH,if:{some:{team:'enemy',has:'tng',of:'pt',withinOpt:'radius'}},do:[{pull:{team:'enemy',has:'tng',lacks:'ehC'},to:'pt',secs:{opt:'pull',d:1.2}}]},   // Knotwork
             {on:'epCatch',if:{targetHas:'tng'},do:[{pull:TNG_O,to:'pt',secs:0.3}]} ],
    gk_3_2:[ {param:'gk.slow',add:R(0.03)} ],                                                                   // Leaning In (the always row)
    gk_3_3:[ {param:'tension.dur',add:R(1)} ],                                                                  // Taut
    gk_3_4:[ {on:'ccIn',less:R(0.04)} ],                                                                        // Steady Mind
    gk_4_2:[ {on:'cd',skill:'blue',add:R(-0.2)} ],                                                              // Hard Pull
    gk_4_3:[ {on:'kit',skill:GK,if:{stackMin:{tension:12}},do:[{stack:'tension',spend:'all'},{window:'snap',dur:99}]},   // Snap: at 12 Tension
             {on:'at',skill:GK,if:{window:'snap'},do:[{window:'snap',end:true},{stun:0.8,on:IN_PT}]} ],
    gk_4_4:[ {on:'kit',skill:GK,opt:{radius:{addM:R(0.2)}}} ],                                                  // Long Reach
    gk_5_1:[ {stat:{aspd:R(-0.015)},to:TNG,if:{window:'tngW'}} ],                                               // Choke Point
    gk_11_4:[ {on:'tick',if:{selfMin:{pullT:1e-9}},do:[{damp:'pullSpeed',by:R(0.15),on:'self'}]} ],             // Weighted Robe: a drag on her moves her 15% less far
    gk_8_4:[ {on:'kit',skill:EH,opt:{silence:{add:R(0.1),ccRaw:true}}} ],                                       // Event Line
    gk_6_1:[ {on:'hit',if:{targetHas:'tng',atLeast:{n:4,of:TNG}},do:[{dmg:{pct:R(0.02),of:'hit'},on:TNG_O,tag:'tng2'}]} ],   // Shared Weight
    gk_6_2:[ {on:'at',skill:GK,if:{selfPass:'convergence'},do:[{emit:'clE',on:Object.assign({skipN:2},IN_PT)}]}, {on:'clE',do:[{energy:R(1)}]} ],   // Converging Lines
    gk_6_4:[ {on:'at',skill:EH,do:[{stack:'ehN',set:{units:IN_PT,max:5}}]}, {on:'out',if:{casting:EH},more:R(0.03),per:'ehN'} ],   // Collapse (up to 5)
    gk_7_1:[ {on:'out',if:{auto:false},more:R(0.01),per:{units:{team:'enemy',of:'target',within:3,skip:'target'},max:5}} ],   // Crowded Room (up to 5)
    gk_7_2:[ {on:'ccHit',if:{casting:GK,cc:['slow'],talent:false},do:[{mark:'gks',on:'target',dur:{flat:0.1,pct:1,of:'hit'},while:'slow',ends:'gkSlowEnd'}]},   // Slipknot
             {on:'gkSlowEnd',do:[{pull:'target',to:'pt:gravknot',m:{b:1.1,$:'gk.half'},secs:0.3}]} ],
    gk_7_4:[ {on:'kit',skill:EH,opt:{pull:{add:0.4},radius:{addM:1}}} ],                                        // Deep Gravity
    gk_5_2:[ {on:'skillTgt',skill:GK,do:[{retarget:'densest'}]} ],                                              // Wide Knot (PICK ONE): on the densest group
    gk_8_2:[ {stat:{aspd:R(0.002)},per:'tension'} ],                                                            // Coiled
    gk_8_3:[ {on:'out',if:{auto:false,targetMin:{slow:1e-9}},more:R(0.02)} ],                                   // Dense Weave
    gk_5_3:[ {param:'gk.slow',add:0.20}, {on:'cast',skill:GK,do:[{pull:GKC,to:'self',secs:0.3}]} ],             // Close Knot (PICK ONE): all the way in, slowed 20% harder
    gk_9_1:[ {on:'teamIn',if:{targetHas:'tng',srcIs:'ally'},more:R(0.01)} ],                                    // Pulled Tight
    gk_9_2:[ {param:'tension.max',add:6}, {on:'kit',skill:EH,opt:{mul:{more:0.005,per:{stack:'tension',over:12}}}} ],   // Overwound
    gk_9_3:[ {on:'cd',less:R(0.01)} ],                                                                          // Dark Pull
    gk_10_1:[ {on:'death',if:{who:'enemy',unitHas:'tng'},do:[{pull:TNG,to:'unit',m:1.5,secs:0.3}]} ],           // Knot Breaker
    gk_10_3:[ {on:'kit',skill:EH,opt:{mul:{more:R(0.02)}}} ],                                                   // Centre of Mass
    gk_10_4:[ {on:'in',if:{srcMin:{slow:1e-9}},less:R(0.015)} ],                                                // Gravity Well
    gk_11_1:[ {on:'in',if:{srcHas:'tng'},less:R(0.01)}, {on:'teamIn',if:Object.assign({srcHas:'tng'},VS_ALLY),less:R(0.01)} ],   // Bound Together
    gk_11_2:[ {stat:{nrg:R(0.02)}} ],                                                                           // Massing Dark
    gk_12_1:[ {on:'teamCc',if:{cc:['stunned'],unitHas:'tng',srcTeam:'ally'},chance:R(0.10),do:[{emit:'sfall'}]},   // Shared Fall: a stun from her team (through the engine)
              {on:'ccHit',if:{cc:['stunned'],targetHas:'tng',targetLacks:'sfX'},chance:R(0.10),do:[{emit:'sfall'}]},   //   or a stun of her own talents
              {on:'sfall',do:[{mark:'sfX',on:TNG,dur:0.1},{stun:{pct:1,of:'hit'},on:TNG_O,asIs:true}]} ],
    gk_12_2:[ {on:'kit',skill:GK,opt:{mul:{more:R(0.03)}}} ],                                                   // Pull of Home
    gk_12_4:[ {on:'in',less:R(0.01),per:{units:TNG,max:5}} ],                                                   // Thread Cloak (up to 5)
    gk_13_2:[ {on:'land',skill:EH,do:[{mark:'tng',on:EHC,dur:6,longest:true},{window:'tngW',dur:6,longest:true},   // The Great Knot (SIGNATURE): as it collapses
                {mark:'gkm',on:EHC,dur:6,spot:'pt:eventhorizon'},{window:'gk',dur:6},{stack:'tension',set:'max'}]},
              {on:'tick',if:{window:'gk'},do:[{pull:{team:'enemy',has:'gkm',away:{mark:'gkm',m:3}},to:{spot:'gkm'},m:1,secs:0.2}]},   //   one that strays more than 3 m is dragged back
              {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'gkm'},do:[{emit:'gkShare',amt:{pct:0.25,of:'hit',split:{units:{team:'enemy',has:'gkm',skip:'target'}}}}]},
              {on:'gkShare',do:[{dmg:{pct:1,of:'hit'},on:{team:'enemy',has:'gkm',skip:'target'},tag:'gk'}]} ],   //   25% of a hit on one, split between the others

    /* ============================== THE UNSAID ============================== */
    us_1_1:[ {on:'quiet',do:[{stack:'word',add:1}]}, {stat:{apow:R(0.005)},per:'word'} ],                      // Swallowed Word
    us_11_4:[ {on:'in',if:{auto:false},less:R(0.02)} ],                                                         // Mute Cloak
    us_1_4:[ {on:'kit',skill:EH,opt:{silence:{add:R(0.1),ccRaw:true}}} ],                                       // Thread of Quiet
    us_2_1:[ {param:'word.dur',add:R(1)} ],                                                                     // Long Silence
    us_2_2:[ {on:'quiet',do:[{mark:'sil',on:'target',dur:{flat:0.1,pct:1,of:'hit'},while:'silencedT',ends:'silEnd'}]},   // Afterquiet: when her silence ends
             {on:'silEnd',do:[MUFFLE('target',P('muf.dur',3))]},                                               //   Muffled 3 s
             {on:'in',if:{auto:false,srcHas:'muf'},less:R(0.03)}, {on:'teamIn',if:Object.assign({auto:false,srcHas:'muf'},VS_ALLY),less:R(0.03)} ],
    us_3_1:[ {on:'kit',if:{casting:[NE,GK],stackMin:{word:6}},do:[{stack:'word',spend:'all'},{energy:15}]} ],   // Full Mouth
    us_3_2:[ {on:'in',if:{auto:true,srcHas:'muf'},less:R(0.02)}, {on:'teamIn',if:Object.assign({auto:true,srcHas:'muf'},VS_ALLY),less:R(0.02)} ],   // Dull Edge
    us_n1:[  {on:'wave',do:[MUFFLE({team:'enemy',order:'high:apow',n:1},R(1))]} ],                              // First to Speak
    us_4_1:[ {on:'in',less:R(0.003),per:'word'} ],                                                              // Stolen Breath
    us_4_2:[ {on:'hit',if:{casting:NE,targetCast:true,targetAlive:true},do:[{silence:0.8,on:'target'}]} ],      // Cut Short
    us_4_4:[ {on:'out',if:{casting:NE,targetHas:'muf'},more:R(0.03)} ],                                         // Needle Hush
    us_5_1:[ {on:'hit',if:{auto:false,targetMin:SIL,selfPass:'convergence'},icd:0.5,do:[{energy:R(2)}]} ],      // Echo Gap (once per spell)
    us_5_2:[ {on:'at',skill:GK,do:[{silence:0.5,on:IN_PT}]} ],                                                  // Mute Knot (PICK ONE)
    us_5_3:[ {on:'at',skill:GK,do:[MUFFLE(IN_PT,3)]} ],                                                         // Deaf Knot (PICK ONE)
    us_5_4:[ {on:'cd',less:R(0.01)} ],                                                                          // Still Loom
    us_6_1:[ {on:'quiet',req:'us_1_1',if:{targetMore:'apow'},do:[{stack:'word',add:1}]}, {param:'word.dur',add:R(1)} ],   // Swallowed Shout
    us_6_3:[ {stat:{move:R(-0.04)},to:{team:'enemy',has:'muf'},if:{window:'mufW'}} ],                          // Muffled Steps
    us_6_4:[ {stat:{nrg:R(0.015)}} ],                                                                           // Unspent
    us_7_1:[ {on:'wordGain',do:[{heal:{pct:R(0.01),of:'maxHp',k:1},on:'self'}]} ],                              // Gap Feeding
    us_7_2:[ {param:'muf.dur',add:R(0.4)} ],                                                                    // Lingering Hush
    us_7_3:[ {on:'teamNrg',if:{unitHas:'muf'},mul:0} ],                                                         // Closed Door
    us_8_2:[ {stat:{cdRate:R(-0.03)},to:{team:'enemy',has:'muf'},if:{window:'mufW'}} ],                        // Tongue-Tied
    us_8_3:[ {on:'in',if:{srcHas:'muf'},less:R(0.02)} ],                                                        // Quiet Ward
    us_9_1:[ {on:'out',if:{targetMin:SIL},more:R(0.02)} ],                                                      // Wordless
    us_9_2:[ {on:'mufEnd',if:{targetLacks:'ss12'},do:[{mark:'ss12',on:'target',dur:12},{silence:0.5,on:'target'}]} ],   // Second Silence
    us_9_4:[ {on:'kit',skill:EH,opt:{mul:{more:R(0.02)}}} ],                                                    // Mouth of the Void
    us_10_1:[ {param:'word.hold',add:-8.5} ],                                                                   // Hoarded Words: they do not fade above 50% HP
    us_10_3:[ {on:'ccHit',if:{casting:EH,cc:['silencedT'],talent:false},do:[{energy:R(1)}]} ],                  // Breath Held
    us_10_4:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                            // Starved Gap
    us_11_1:[ {on:'in',if:{srcWithin:4},less:R(0.003),per:'word'}, {on:'teamIn',if:Object.assign({srcWithin:4},VS_ALLY),less:R(0.003),per:'word'} ],   // Speechless
    us_11_3:[ {on:'ccOut',if:{casting:EH,cc:['silencedT'],targetCast:true},add:R(0.3)} ],                       // The Long Pause
    us_12_1:[ {on:'tick',edge:true,if:{selfHpBelow:0.30},do:[{stack:'word',spend:'all',then:[{heal:{pct:R(0.02),of:'maxHp',x:'spent'},on:'self'}]}]} ],   // Spent Words
    us_12_3:[ {on:'in',if:{srcMin:SIL},less:R(0.015)}, {on:'teamIn',if:Object.assign({srcMin:SIL},VS_ALLY),less:R(0.015)} ],   // Nothing to Say
    us_12_4:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                             // Quiet Hands
    us_13_3:[ {on:'land',skill:EH,do:[{mark:'nw',on:{team:'enemy'},dur:6},{window:'nw',dur:6}]},                // The Next Word (SIGNATURE): 6 s after it collapses
              {on:'tick',if:{window:'nw'},do:[{emit:'nwFail',on:{team:'enemy',has:'nw',cast:'spell'}}]},        //   the first ability each enemy starts
              {on:'nwFail',do:[{mark:'nw',on:'target',clear:true},{timer:'silencedT',min:0.1,on:'target'},     //   fails (a silence cancels it; its cooldown stays spent)
                {stack:'word',add:1},{energy:5},MUFFLE('target',P('muf.dur',3))]} ]
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/11 - ABSALIE - talent decisions.md) */
  ruling:{}
};
