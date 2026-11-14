/* FRITZ - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Fritz")
   His real kit (the code, not the tooltip wording; every skill of his scales off Ability Power and lands as MAGIC damage, his profile is Magic):
   - Storm Surge ('stormsurge', green, cd 8): up to 5 bolts of 85% of his ability power, each on a DIFFERENT enemy picked at random (fewer enemies: fewer
     bolts). Each bolt lands 0.3 + 0.12 x its place s after the cast (a groundHazard), and does nothing if its enemy died meanwhile. Hooks: skillTgt (which
     enemy each bolt goes to; the seeded draw is made as before), num 'boltDelay' (when it lands), landPre / land 'stormsurge' around each landing.
   - Chain Lightning ('chainlight', blue, cd 7): 110% of his ability power on his target, then 3 jumps (4 hits: kit option jumps 4), each to the nearest
     enemy not yet struck within 15 m of the last one, centre to centre, each jump 20% weaker (decay 0.8). Hook chainEnd after the jumps; bound chainRun
     (the same jump code again: Forked Chain).
   - Static Veil (passive 'stormdodge'): while he casts or channels (_castT or _stormT), a 30% + 0.15 pt a level chance (44.9% at 100) to dodge ANY hit
     (basic attacks and abilities, even true damage). Hooks veil (its chance, and whether it is up) and veiled (it dodged).
   - Thunder Shower (ultimate 'thundershower': ULT_DEF dur 3, radius 6 m, tick 0.5, mul 0.6, channel; HERO_ULT_ART.fritz only the art and a preview):
     a 3 s channel (he is rooted, casts and swings nothing) at the aimed point; every 0.5 s a pulse strikes every enemy whose centre is within 6 m of the
     centre for 60% of his ability power. Each pulse is a landPre / land pair 'thundershower' (Calypsa's storm code).
   Charge, Conductors, Seconds, Late Blows, Miles and Parcels exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/23 - FRITZ - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const SS='stormsurge', CL='chainlight', TS='thundershower', SPELLS=[SS,CL], SKILLS=[SS,CL,TS];
/* the states several talents read: their bookkeeping runs when any of these is learned */
const CHG=['lw_1_1','lw_3_1','lw_5_1','lw_6_1','lw_8_1','lw_9_1','sc_n1'];
const COND=['lw_1_4','lw_2_4','lw_n1','lw_3_4','lw_4_4','lw_6_4','lw_7_3','lw_7_4','lw_8_4','lw_10_4','lw_11_3','lw_11_4','lw_12_3','lw_13_3'];
const SEC=['hh_1_1','hh_4_1','hh_2_1','hh_6_1','hh_8_1','hh_10_1','hh_10_3','hh_11_1','hh_12_3','hh_13_3'];
const LATE=['hh_1_4','hh_2_4','hh_3_4','hh_6_4','hh_8_4','hh_9_4','hh_13_3'];
const DODGE=['hh_1_1','hh_4_1','hh_6_1','hh_10_3','hh_11_1','hh_12_3','hh_13_3','hh_2_2','hh_4_2','hh_4_3','hh_5_2','hh_5_3','hh_5_4','hh_7_2','hh_9_2','hh_8_1','hh_12_2','hh_3_3'];
const MILES=['sc_1_1','sc_3_1','sc_2_1','sc_8_1','sc_12_1','sc_5_4','sc_6_1','sc_9_1'];
const PARCEL=['sc_1_3','sc_2_3','sc_3_3','sc_n1','sc_5_3','sc_6_3','sc_8_3','sc_10_3','sc_n3','sc_11_3','sc_12_4','sc_13_2'];
const STORM=['lw_9_1','lw_13_3','sc_12_2','sc_13_2'];
const BOLT=['lw_7_3','sc_9_2','lw_12_1','lw_10_4','hh_6_2'];
const ALLY_HIT={srcTeam:'enemy',targetTeam:'ally'};        // an enemy's hit on one of his allies (teamIn: never himself)
const TEAM_HIT={srcTeam:'ally',targetTeam:'enemy'};        // a hit of his team (himself included) on an enemy
const ALLIES={team:'ally',others:true};                     // "his allies": his living team-mates, not himself, not summons
/* ---- helpers ---- */
const now=A=>A.eng().now();
const busy=u=>(u._castT||0)>0||(u._stormT||0)>0;           // the game's own "casting or channelling" (Static Veil up)
const storm=u=>(u._stormT||0)>0&&u._stormX!=null;
function inStorm(A,u,x){ const E=A.eng(); return !!x&&storm(u)&&E.dist({x:u._stormX,y:u._stormY},x)<(u._stormR||6*E.METER()); }   // centre to centre, as the storm measures
const allies=(A,T,u)=>A.pick(T,u,ALLIES,{u});
const byEnergy=L=>L.slice().sort((a,b)=>(a.energy||0)-(b.energy||0));   // the least energy first (stable: ties keep the field's order)
/* the hits of his own skill run from a talent row (Forked Chain's second chain, Discharge's Chain Lightning) are that skill's hits, not a talent's: his
   hit / out rows see them (the runtime treats what happens inside a row's actions as the talent's own, T.s.d > 0; the row itself stays guarded against re-entry) */
function skillHits(T,f){ const d=T.s.d; T.s.d=0; try{ f(); } finally{ T.s.d=d; } }
function giveEnergy(t,n){ const e=t.energy||0, got=Math.max(0,Math.min(100-e,n)); t.energy=e+got; return n-got; }   // returns what did not fit
module.exports={
  hero:'fritz',
  casting:true,                         // rows ask which of his skills a hit comes from (a bolt, a jump, a storm pulse)
  states:{
    charge:{max:20,wave:'reset'},                                                   // Charge (Bottled Storm)
    sec:{max:60},                                                                   // Seconds on the stopped watch (a new wave: 0, Pocketed keeps some)
    miles:{max:P('miles.max',20)}                                                   // Miles (a new wave: 0, Familiar Roads keeps some)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    /* ---- Charge: every enemy Storm Surge or Chain Lightning hits (Thunder Shower's strikes only with Storm Battery) ---- */
    {on:'hit',reqAny:CHG,if:{casting:SPELLS,targetTeam:'enemy'},do:[{stack:'charge',add:1}]},
    {on:'kit',skill:CL,reqAny:['lw_1_1'],do:[{fn:'bottle'}]},                                        // at 20 Charge this Chain Lightning spends it (Bottled Storm)
    {on:'kit',skill:CL,reqAny:['lw_4_3','lw_5_2','lw_5_3','lw_13_3'],do:[{fn:'jumps'}]},              // how many times it jumps (Extra Link, Single Spark, the signature)
    {on:'kit',skill:CL,reqAny:['lw_9_3','lw_10_2'],do:[{fn:'clReset'}]},                              // this chain's first target, its enemies counted
    {on:'out',if:{casting:CL},reqAny:['lw_9_3'],do:[{fn:'c1'}]},
    /* ---- Conductors: an enemy struck by both Storm Surge and Chain Lightning within 4 s ---- */
    {on:'hit',reqAny:COND,if:{casting:SPELLS,targetTeam:'enemy'},do:[{fn:'condHit'}]},
    /* ---- Storm Surge's bolts: which enemy each goes to, its size, the first to land ---- */
    {on:'skillTgt',skill:SS,reqAny:BOLT,do:[{fn:'bolt'}]},
    {on:'kit',skill:SS,reqAny:['hh_6_2'],do:[{fn:'ssReset'}]}, {on:'landPre',skill:SS,reqAny:['hh_6_2'],do:[{fn:'boltN'}]},
    {on:'cast',skill:SS,reqAny:['sc_9_2'],do:[{fn:'rushDone'}]},
    /* ---- Thunder Shower: when it starts and ends, who stood in it ---- */
    {on:'tick',reqAny:STORM,do:[{fn:'stormWatch'}]}, {on:'wave',reqAny:STORM,do:[{fn:'stormSync'}]},
    {on:'landPre',skill:TS,reqAny:['lw_8_1'],do:[{fn:'pulse'}]},
    {on:'land',skill:TS,reqAny:['sc_12_2'],do:[{fn:'stood'}]},
    /* ---- Static Veil: put up by talents; every dodge of his (Static Veil's or a talent's) ---- */
    {on:'veil',reqAny:DODGE,do:[{fn:'veilUp'}]},
    {on:'tick',reqAny:['hh_4_2'],do:[{fn:'veilTrack'}]},
    /* ---- Seconds: each dodge 3, each Late Blow 5 (max 60); a new wave starts at 0 (Pocketed, Wound Spring) ---- */
    {on:['veiled','dodged'],reqAny:SEC,do:[{fn:'secAdd',n:3}]},
    {on:'lateLand',reqAny:SEC,do:[{fn:'secAdd',n:5}]},
    {on:'waveEnd',reqAny:SEC,do:[{fn:'secKeep'}]}, {on:'wave',reqAny:SEC,do:[{fn:'secWave'}]},
    {on:'kit',reqAny:['hh_10_3'],do:[{fn:'minute'}]},
    /* ---- Late Blows: the hit is taken off now and lands 1 s later (the engine's `late`) ---- */
    {on:'in',reqAny:LATE,do:[{fn:'lateChk'}]},
    /* ---- Miles: every 3 m he moves; a new wave starts at 0 (Familiar Roads, Well Travelled) ---- */
    {on:'tick',reqAny:MILES,do:[{fn:'miles'}]},
    {on:'waveEnd',reqAny:MILES,do:[{fn:'milesKeep'}]}, {on:'wave',reqAny:MILES,do:[{fn:'milesWave'}]},
    /* ---- Parcels: one each wave (more with Second Round), each Chain Lightning delivers one ---- */
    {on:'wave',reqAny:PARCEL,do:[{fn:'parcelWave'}]},
    {on:'cast',skill:CL,reqAny:PARCEL,do:[{fn:'deliver'}]}
  ],
  talents:{
    /* ============================== LIVEWIRE ============================== */
    lw_1_1:[ {on:'out',if:{casting:CL,fn:'bsNow'},more:R(0.10)} ],                                       // Bottled Storm (spent in the always kit row)
    lw_2_2:[ {on:'cd',skill:'green',add:R(-0.4)} ],                                                      // Ready Surge
    lw_1_4:[ {on:'out',if:{casting:SPELLS,targetHas:'cond'},more:R(0.02)} ],                             // Conductor
    lw_2_3:[ {on:'kit',skill:CL,opt:{decay:{add:R(0.02)}}} ],                                            // Long Arc (0.8 -> 0.9)
    lw_2_4:[ {param:'cond.dur',add:R(1)} ],                                                              // Live Metal
    lw_3_1:[ {on:'wave',do:[{stack:'charge',add:R(2)}]} ],                                               // Quick Charge
    lw_n1:[ {on:'in',if:{srcHas:'cond'},less:R(0.02)} ],                                                 // Rubber Soles
    lw_3_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{fn:'mkCond'}]} ],                         // Grounding Rod
    lw_4_2:[ {on:'kit',skill:CL,opt:{jumpRange:{addM:R(1)}}} ],                                          // Far Reach: its jumps reach 1 m farther a rank (15 -> 18 m)
    lw_4_3:[ {param:'link',add:R(0.15)} ],                                                               // Extra Link (the jumps fn)
    lw_4_4:[ {stat:{mr:R(-0.02)},to:{team:'enemy',has:'cond'}} ],                                        // Exposed Wiring
    lw_5_1:[ {param:'residue',add:R(1)} ],                                                               // Residue (the bottle fn)
    lw_5_2:[ {on:'kit',skill:CL,opt:{mul:{mul:2.6}}}, {on:'hit',if:{casting:CL,targetTeam:'enemy'},do:[{stun:0.5,on:'target'}]} ],   // Single Spark (PICK ONE; jumps 1: the jumps fn)
    lw_5_3:[ {on:'chainEnd',if:{casting:CL},do:[{fn:'fork'}]} ],                                         // Forked Chain (PICK ONE)
    lw_5_4:[ {on:'out',if:{casting:SKILLS},ignoreMr:R(0.02)} ],                                          // High Voltage
    lw_6_1:[ {stat:{move:R(0.02)},if:{stackMin:{charge:10}}} ],                                          // Charged Step
    lw_6_3:[ {on:'out',if:{casting:SS},more:R(0.04)}, {param:'bolt.more',add:R(0.04)} ],                 // Brighter Bolts (and Lightning Rod's bolt)
    lw_6_4:[ {on:'death',if:{who:'enemy',unitHas:'cond'},do:[{dmg:{pct:R(0.15),of:'apow'},on:{team:'enemy',of:'unit',within:3},def:'magic',color:'#f2e07a'}]} ],   // Arc Flash
    lw_7_2:[ {on:'out',if:{casting:TS},more:R(0.03)} ],                                                  // Heavier Rain
    lw_7_3:[ {param:'called',add:1} ],                                                                   // Called Bolts (the bolt fn)
    lw_7_4:[ {on:'teamIn',if:Object.assign({targetHas:'cond'},TEAM_HIT),more:R(0.01)} ],                 // Ground Fault
    lw_8_1:[ {on:'hit',if:{casting:TS,targetTeam:'enemy'},do:[{fn:'battery'}]} ],                        // Storm Battery
    lw_8_2:[ {on:'kit',skill:TS,opt:{radius:{addM:R(0.2)}}} ],                                           // Wider Storm
    lw_8_4:[ {stat:{move:R(-0.04)},to:{team:'enemy',has:'cond'}} ],                                      // Spark Gap
    lw_9_1:[ {on:'stormEnd',do:[{fn:'discharge'}]} ],                                                   // Discharge: a free Chain Lightning from the enemy nearest the storm's centre
    lw_9_2:[ {on:'cd',less:R(0.01)} ],                                                                   // Watch Hand
    lw_9_3:[ {on:'out',if:{casting:CL,fn:'isJump'},more:R(0.03)} ],                                      // Jump Spark
    lw_10_2:[ {on:'hit',if:{casting:CL,targetTeam:'enemy'},do:[{fn:'liveCur'}]} ],                       // Live Current (up to 5 enemies a cast)
    lw_10_4:[ {on:'tick',period:6,do:[{fn:'rod'}]} ],                                                    // Lightning Rod
    lw_11_2:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                      // Quick Hands
    lw_11_3:[ {on:'hit',if:{casting:TS,targetTeam:'enemy'},chance:R(0.2),do:[{fn:'mkCond'}]} ],          // Gathering Clouds
    lw_11_4:[ {on:'out',if:{auto:true,targetHas:'cond'},more:R(0.03)} ],                                 // Burnt Wires
    lw_12_1:[ {on:'landPre',skill:SS,if:{targetAlive:false},do:[{fn:'spare'}]} ],                         // Spare Bolt
    lw_12_3:[ {on:'out',if:{casting:TS,targetHas:'cond'},more:R(0.02)} ],                                // Dense Storm
    lw_12_4:[ {on:'in',if:{kind:'magic'},less:R(0.03)} ],                                                // Insulated Coat
    lw_13_3:[ {on:'land',skill:TS,do:[{fn:'square'}]}, {on:'stormEnd',do:[{window:'osq',dur:6}]} ],     // The Open Square (SIGNATURE; the doubled jumps: the jumps fn)
    /* ============================== HALF A HEARTBEAT ============================== */
    hh_1_1:[ {stat:{apow:R(0.005)},per:{stack:'sec',div:10}} ],                                          // Seconds
    hh_1_3:[ {stat:{move:R(0.03)}} ],                                                                    // Quickstep
    hh_1_4:[ {param:'late.less',add:R(0.06)} ],                                                          // Late Blows (the lateChk fn)
    hh_2_2:[ {on:'veil',add:R(0.01)} ],                                                                  // Wider Veil
    hh_2_4:[ {param:'late.cd',add:R(-1)} ],                                                              // Further Ahead
    hh_3_1:[ {on:'cd',less:R(0.01)} ],                                                                   // Clockwork
    hh_3_3:[ {on:'dodge',if:{fn:'veilDown'},chance:R(0.01),do:[{dodge:true}]} ],                        // Courier's Reflex
    hh_3_4:[ {on:'latePre',if:{fn:'busyNow'},do:[{fn:'neverThere'}]} ],                                  // Never There
    hh_4_1:[ {stat:{aspd:R(0.002)},per:{stack:'sec',div:10}} ],                                          // Ticking
    hh_4_2:[ {param:'vim',add:R(0.5)} ],                                                                 // Veil in Motion (veilTrack)
    hh_4_3:[ {on:['veiled','dodged'],do:[{dmg:{pct:R(0.15),of:'apow'},on:'source',def:'magic',color:'#f2d84a'}]} ],   // Counter Spark
    hh_5_1:[ {on:'ccIn',less:R(0.06)} ],                                                                 // Shaken Off (18% at most: his only control-shortening talent)
    hh_5_2:[ {on:['veiled','dodged'],do:[{window:'slip',dur:2}]}, {on:'in',if:{window:'slip'},less:R(0.03)} ],   // Slipstream
    hh_2_1:[ {param:'sec.start',add:R(5)} ],                                                             // Wound Spring (secWave)
    hh_6_1:[ {param:'stolen',add:R(2)} ],                                                                // Stolen Time (secAdd)
    hh_6_2:[ {on:'out',if:{casting:SS,fn:'firstBolt'},more:R(0.06)} ],                                   // Surge on Cue
    hh_6_4:[ {on:'lateQ',do:[{mark:'bsch',on:'source',dur:3}]},                                          // Behind Schedule
             {on:'in',if:{srcHas:'bsch'},less:R(0.02)}, {on:'teamIn',if:Object.assign({srcHas:'bsch'},ALLY_HIT),less:R(0.02)} ],
    hh_7_1:[ {on:'out',if:{casting:SKILLS},more:R(0.02)}, {on:'in',if:{auto:false},more:R(0.015)} ],     // Running Late (RISK)
    hh_7_2:[ {on:'num',skill:'boltDelay',mul:0}, {on:'cast',skill:SS,do:[{window:'btv',dur:1}]} ],       // Between Ticks
    hh_11_4:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                  // Unhurried
    hh_5_3:[ {on:['veiled','dodged'],if:{srcMelee:true},by:'source',icd:6,do:[{stun:0.6,on:'source'}]} ],   // Shocking Reply (PICK ONE)
    hh_5_4:[ {on:['veiled','dodged'],icd:1,do:[{push:'self',from:'source',m:2,secs:0.2},{cd:'green',add:-1},{cd:'blue',add:-1}]} ],   // Slip Away (PICK ONE; at most once a second)
    hh_8_3:[ {on:'in',if:{fn:'storming'},less:R(0.02)} ],                                                // Rooted Storm
    hh_8_4:[ {on:'lateLand',icd:2.5,do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                             // Caught Up (at most once every 2.5 s: the regeneration cap)
    hh_9_2:[ {on:'veil',if:{auto:false},add:R(0.04)} ],                                                  // Hard to Pin
    hh_9_3:[ {on:'out',if:{casting:TS},more:R(0.03)} ],                                                  // Thunder Count
    hh_9_4:[ {param:'second',add:1} ],                                                                   // Second Look (lateChk)
    hh_10_1:[ {param:'sec.keep',add:R(10)} ],                                                            // Pocketed (secKeep)
    hh_10_2:[ {stat:{move:R(0.02)},if:{fn:'notBusy'}} ],                                                 // Light Feet
    hh_10_3:[ {on:'out',if:{fn:'mhNow'},more:R(0.10)} ],                                                 // Minute Hand (the minute fn spends)
    hh_11_1:[ {param:'stopped',add:1} ],                                                                 // Stopped Clock (secAdd)
    hh_11_2:[ {on:'in',if:{auto:true},less:R(0.015)} ],                                                  // Glancing
    hh_8_1:[ {on:'veil',if:{stackMin:{sec:30}},add:R(0.01)} ],                                           // Spring Wound
    hh_12_2:[ {on:['veiled','dodged'],chance:R(0.15),do:[{fn:'unslow'}]} ],                              // Turned Collar
    hh_12_3:[ {on:'out',if:{casting:SKILLS,stackMin:{sec:40}},more:R(0.02)} ],                           // Overwound
    hh_13_3:[ {param:'watch',add:1}, {on:'veil',if:{window:'wtv'},do:[{fn:'veil60'}]} ],                 // The Watch Ticks (SIGNATURE; secAdd, lateChk)
    /* ============================== THE STORM COURIER ============================== */
    sc_1_1:[ {stat:{aspd:R(0.002)},per:'miles',to:{team:'ally',within:5,others:true}} ],                 // Miles
    sc_1_3:[ {param:'parcel',add:R(4)} ],                                                                // Parcel (deliver)
    sc_1_4:[ {stat:{move:R(0.03)}} ],                                                                    // Courier's Pace
    sc_3_2:[ {on:'hit',if:{casting:SS,targetTeam:'enemy'},do:[{energy:R(1),on:{team:'ally',of:'target',n:1,others:true}}]} ],   // Errand Bolts
    sc_2_3:[ {param:'parcels',add:R(1)} ],                                                               // Second Round
    sc_3_1:[ {stat:{move:R(0.01)},per:{stack:'miles',div:5}} ],                                          // Quick Turn
    sc_4_2:[ {on:'kill',if:{casting:SS},do:[{fn:'least',n:R(3)}]} ],                                     // Return Address
    sc_3_3:[ {param:'signed',add:1} ],                                                                   // Signed For
    sc_n1:[ {param:'charged',add:1} ],                                                                   // Charged Parcel (LINK; its Charge only with Bottled Storm: deliver)
    sc_4_1:[ {stat:{move:R(0.02)},to:{team:'ally',within:5,others:true}} ],                              // Wayfinder
    sc_5_2:[ {on:'kit',skill:SS,do:[{fn:'fair'}]}, {on:'cast',skill:SS,do:[{fn:'fairHeal'}]} ],         // Fair Weather (PICK ONE)
    sc_5_1:[ {on:'hit',if:{casting:SS,targetTeam:'enemy'},do:[{slow:0.25,dur:2,on:'target'}]} ],         // Bad Weather (PICK ONE)
    sc_4_4:[ {on:'cd',skill:'blue',add:R(-0.4)} ],                                                       // Clear Line
    sc_2_1:[ {param:'miles.max',add:R(5)} ],                                                             // Long Route
    sc_5_3:[ {param:'prompt',add:R(0.2)} ],                                                              // Prompt Delivery
    sc_5_4:[ {on:'in',if:{stackMin:{miles:10}},less:R(0.015)} ],                                         // Rain Cloak
    sc_6_1:[ {on:'teamIn',if:Object.assign({targetWithin:5},ALLY_HIT),less:R(0.005),per:{stack:'miles',div:5},upTo:0.10} ],   // Road Worn (10% at most)
    sc_6_3:[ {param:'express',add:1}, {stat:{move:R(0.05)},to:{team:'ally',has:'expr'}} ],               // Express
    sc_6_4:[ {on:'out',if:{casting:CL},more:R(0.05)} ],                                                  // Bright Chain
    sc_n2:[ {on:'in',if:{moved:true},less:R(0.02)} ],                                                    // Moving Target
    sc_7_3:[ {on:'land',skill:TS,do:[{fn:'shared'}]} ],                                                  // Shared Storm
    sc_7_4:[ {on:'chainEnd',if:{casting:CL},do:[{fn:'relay'}]} ],                                        // Relay
    sc_8_1:[ {param:'miles.start',add:R(2)} ],                                                           // Well Travelled (milesWave)
    sc_8_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                      // Errand Run
    sc_8_3:[ {param:'satchel',add:1}, {on:'teamIn',if:Object.assign({srcHas:'sat'},TEAM_HIT),more:R(0.02)} ],   // Full Satchel
    sc_9_1:[ {on:'tick',if:{stackMin:{miles:20}},period:1,do:[{heal:{pct:R(0.002),of:'tgtMaxHp'},on:{team:'ally',within:5,others:true}}]} ],   // Tailwind (0.2% a rank: the regeneration cap)
    sc_9_2:[ {on:'tick',do:[{fn:'rush'}]} ],                                                             // Rush Order
    sc_10_1:[ {on:'teamIn',if:Object.assign({fn:'tgtInStorm'},ALLY_HIT),less:R(0.02)} ],                 // Shower Shelter
    sc_10_3:[ {param:'priority',add:R(1)} ],                                                             // Priority Mail
    sc_n3:[ {param:'forward',add:R(0.3)} ],                                                              // Forwarding Address
    sc_11_1:[ {on:'cd',less:R(0.01)} ],                                                                  // Ready Hands
    sc_11_2:[ {on:'out',if:{casting:TS},more:R(0.02),per:{fn:'alliesIn',max:3}} ],                       // Rain on Them
    sc_11_3:[ {param:'postage',add:1}, {stat:{apow:R(0.02)},to:{team:'ally',has:'post'}} ],              // Extra Postage
    sc_12_1:[ {param:'miles.keep',add:R(5)} ],                                                           // Familiar Roads (milesKeep)
    sc_12_2:[ {on:'stormEnd',do:[{fn:'handed',n:R(3)}]} ],                                               // Handed Over
    sc_12_4:[ {param:'pockets',add:R(0.005)} ],                                                          // Coat Pockets (deliver)
    sc_13_2:[ {on:'stormEnd',once:'fight',do:[{fn:'lastDelivery'}]}, {stat:{move:0.20},to:{team:'ally',has:'ldm'}} ]   // The Last Delivery (SIGNATURE)
  },
  fn:{
    storming(A,T,u){ return (u._stormT||0)>0; },
    notBusy(A,T,u){ return !busy(u); },
    busyNow(A,T,u){ return busy(u); },
    /* ---- Charge ---- */
    bottle(A,T,u){ T.s.bs=false; if(A.stGet(T,'charge')<20-1e-9) return; T.s.bs=true; A.stSet(T,u,'charge',Math.min(20,T.P.residue||0)); },
    bsNow(A,T){ return !!T.s.bs; },
    battery(A,T,u){ if((T.s.pn||0)>=(T.r.lw_8_1||0)) return; T.s.pn=(T.s.pn||0)+1; A.stSet(T,u,'charge',A.stGet(T,'charge')+1); },
    pulse(A,T){ T.s.pn=0; },
    /* ---- Chain Lightning ---- */
    /* the jumps: Single Spark 1; else Extra Link one more (a seeded roll, only with Extra Link learned), and after Thunder Shower with the signature twice
       as many jumps (1 + 2 x the jumps: 4 hits become 7). Forked Chain's second chain jumps 3 times (6 in the signature's window) */
    jumps(A,T,u,c){ const o=c.o; let j=o.jumps||4, osq=A.winOn(T,'osq');
      if(T.r.lw_5_2) j=1; else { const p=T.P.link||0; if(p>0&&A.eng().rnd()<p) j+=1; if(osq) j=1+2*(j-1); }
      o.jumps=j; T.s.fj=osq?6:3; },
    clReset(A,T){ T.s.c1=null; T.s.lcN=0; },
    c1(A,T,u,c){ if(!T.s.c1) T.s.c1=c.tgt; },
    isJump(A,T,u,c){ return !!T.s.c1&&c.tgt!==T.s.c1; },
    liveCur(A,T,u){ if((T.s.lcN||0)>=5) return; T.s.lcN=(T.s.lcN||0)+1; giveEnergy(u,T.r.lw_10_2||0); },
    /* Forked Chain: from its first target a second chain runs on, the same skill's jumps (the page's chainRun), from the nearest enemy not yet struck */
    fork(A,T,u,c){ const E=A.eng(); if(!E.chainRun||!c.hit.length||T.r.lw_5_2) return; const f=c.hit[0], R=(c.o&&c.o.jumpRange)||15*E.METER();
      let nx=null, nd=1e9; for(const e of A.pick(T,u,{team:'enemy'},c)){ if(c.set.has(e)) continue; const d=E.dist(f,e); if(d<nd&&d<R){ nd=d; nx=e; } }
      if(nx) skillHits(T,()=>E.chainRun(u,nx,c.d0*c.dec,T.s.fj||3,c.dec,c.set,c.o,f)); },
    discharge(A,T,u,c){ const E=A.eng(), t=A.pick(T,u,{team:'enemy',of:'pt',n:1},c)[0]; if(t&&E.castSlot&&u.alive) skillHits(T,()=>E.castSlot(u,'blue',t)); },
    /* Relay: one more jump, to his lowest-HP ally, healing it for that jump's damage (what the chain's next jump would deal, before resist) */
    relay(A,T,u,c){ const t=A.pick(T,u,{team:'ally',others:true,order:'lowHp',n:1},c)[0]; if(t&&c.amt>0) A.eng().healUnit(t,c.amt); },
    /* ---- Conductors ---- */
    mkCond(A,T,u,c){ const t=c.tgt; if(t&&t.alive&&t.team!==u.team) A.setMark(T,u,t,'cond',{dur:4+(T.P['cond.dur']||0)}); },
    condHit(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; const ss=T.s.cur===SS, mine=ss?'ssH':'clH', other=ss?'clH':'ssH';
      A.setMark(T,u,t,mine,{dur:4}); if(A.markOf(u,t,other)) T.fn.mkCond(A,T,u,c); },
    /* ---- Storm Surge ---- */
    /* which enemy this bolt goes to (ctx.o.list = the enemies no bolt has picked yet): Rush Order's attackers first, then Called Bolts (Conductors, then the
       lowest HP), else the game's random pick (ctx.tgt). Its size (before resist) is kept for Spare Bolt and Lightning Rod. */
    bolt(A,T,u,c){ const L=(c.o&&c.o.list)||[]; if(c.o&&c.o.sb>0) T.s.sb=c.o.sb; if(!L.length) return;
      const r=T.s.rush; if(r&&r.alive){ const at=L.filter(e=>e.alive&&e.target===r); if(at.length){ c.tgt=at[0]; return; } }
      if(T.P.called){ const cd=L.filter(e=>e.alive&&A.markOf(u,e,'cond')), pool=cd.length?cd:L.filter(e=>e.alive); if(pool.length) c.tgt=pool.slice().sort((a,b)=>a.hp-b.hp)[0]; } },
    ssReset(A,T){ T.s.bn=0; },
    boltN(A,T){ T.s.bn=(T.s.bn||0)+1; },
    firstBolt(A,T){ return T.s.bn===1; },
    boltSize(A,T,u){ const E=A.eng(); if(T.s.sb>0) return T.s.sb; const lv=(u.skillLv&&u.skillLv[1])||1; return (u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*(E.skillMul?E.skillMul(lv):1)*E.rage()*0.85; },
    /* Spare Bolt: the bolt's enemy is already dead - the nearest enemy to where it stood takes 30% a rank of the bolt (talent damage, magic resist applies) */
    spare(A,T,u,c){ const x=T.fn.boltSize(A,T,u)*0.30*(T.r.lw_12_1||0); A.acts(T,u,[{dmg:x,on:{team:'enemy',of:'target',n:1},def:'magic',color:'#f2e07a'}],c); },
    /* Lightning Rod: every 6 s the Conductor with the most HP takes one Storm Surge bolt (its size, Brighter Bolts included; talent damage, magic) */
    rod(A,T,u,c){ const L=A.pick(T,u,{team:'enemy',has:'cond'},c); if(!L.length) return; const t=L.slice().sort((a,b)=>b.hp-a.hp)[0];
      A.acts(T,u,[{dmg:T.fn.boltSize(A,T,u)*(1+(T.P['bolt.more']||0)),on:'target',def:'magic',color:'#f2e07a'}],Object.assign({},c,{tgt:t})); },
    /* Fair Weather: with an ally standing, one bolt fewer goes out; at the cast that bolt heals his lowest-HP ally for 60% of his ability power */
    fair(A,T,u,c){ T.s.fw=null; const t=A.pick(T,u,{team:'ally',others:true,order:'lowHp',n:1},c)[0]; if(!t) return; T.s.fw=t; c.o.n=Math.max(0,(c.o.n||5)-1); },
    fairHeal(A,T,u,c){ const t=T.s.fw; T.s.fw=null; if(t&&t.alive) A.eng().healUnit(t,(u.apow||0)*0.60); },
    /* Rush Order: once a wave, the first ally to drop below 35% HP: Storm Surge's cooldown is over, and its next cast's bolts go to that ally's attackers first */
    rush(A,T,u){ const s=T.s, p=s.rp||(s.rp={}); for(const x of allies(A,T,u)){ const lo=x.hp<0.35*x.maxHp, was=p[x.uid]; p[x.uid]=lo;
        if(lo&&was===false&&s.rw!==s.wave){ s.rw=s.wave; s.rush=x; u.greenCd=0; } } },
    rushDone(A,T){ T.s.rush=null; },
    /* ---- Thunder Shower ---- */
    stormWatch(A,T,u){ const s=T.s, on=storm(u);
      if(on&&!s.so){ s.so=true; s.sc={x:u._stormX,y:u._stormY,pt:true}; s.sin={}; }
      else if(!on&&s.so){ s.so=false; A.run(T,u,'stormEnd',{u,tgt:u.target,pt:s.sc}); } },
    stormSync(A,T){ T.s.so=false; },
    stood(A,T,u){ const s=T.s, m=s.sin||(s.sin={}); for(const x of allies(A,T,u)) if(inStorm(A,u,x)) m[x.uid]=x; },
    handed(A,T,u,c,a){ const m=T.s.sin||{}; for(const k in m){ const x=m[k]; if(x.alive) giveEnergy(x,a.n||0); } },
    shared(A,T,u){ const n=T.r.sc_7_3||0; for(const x of allies(A,T,u)) if(inStorm(A,u,x)) giveEnergy(x,n); },
    alliesIn(A,T,u){ let n=0; for(const x of allies(A,T,u)) if(inStorm(A,u,x)) n++; return n; },
    tgtInStorm(A,T,u,c){ return inStorm(A,u,c.tgt); },
    /* The Open Square: each pulse, every Conductor takes a bolt of 30% of his ability power that jumps on to the nearest other enemy within 5 m (talent damage, magic) */
    square(A,T,u,c){ const x=0.30*(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1); for(const t of A.pick(T,u,{team:'enemy',has:'cond'},c)){ if(!t.alive) continue;
        const c2=Object.assign({},c,{tgt:t}); A.acts(T,u,[{dmg:x,on:'target',def:'magic',color:'#f2e07a'},{dmg:x,on:{team:'enemy',of:'target',within:5,n:1,skip:'target'},def:'magic',color:'#f2e07a'}],c2); } },
    /* ---- Static Veil ---- */
    veilUp(A,T,u,c){ if(A.winOn(T,'btv')||A.winOn(T,'vim')||A.winOn(T,'wtv')) c.up=true; },
    veil60(A,T,u,c){ c.up=true; c.floor=Math.max(c.floor||0,0.60); },
    veilDown(A,T,u){ return !busy(u)&&!A.winOn(T,'btv')&&!A.winOn(T,'vim')&&!A.winOn(T,'wtv'); },
    /* Veil in Motion: when a cast or a channel of his ends, Static Veil stays up 0.5 s a rank */
    veilTrack(A,T,u,c){ const b=busy(u); if(T.s.vb&&!b) A.acts(T,u,[{window:'vim',dur:T.P.vim||0}],c); T.s.vb=b; },
    unslow(A,T,u){ u.slow=0; u.slowMul=1; },
    /* ---- Seconds ---- */
    /* n Seconds onto the watch (max 60). Stolen Time: every 20 gained, 2 energy a rank. At 60 the watch ticks (the signature, at most every 20 s), else Stopped
       Clock (once a wave): each spends them all. */
    secAdd(A,T,u,c,a){ const s=T.s, got=A.stSet(T,u,'sec',A.stGet(T,'sec')+(+a.n||0));
      if(got>0&&T.P.stolen){ s.sg=(s.sg||0)+got; while(s.sg>=20-1e-9){ s.sg-=20; giveEnergy(u,T.P.stolen); } }
      if(A.stGet(T,'sec')<60-1e-9) return; const t=now(A);   // at 60 (reached now, or held there while the watch waited), each new dodge or Late Blow asks again
      if(T.P.watch&&t>=(s.wtCd||0)){ s.wtCd=t+20; A.stSet(T,u,'sec',0); A.acts(T,u,[{window:'wtl',dur:1.5},{window:'wtv',dur:4},{stun:1.5,on:{team:'enemy',within:8}}],c); return; }
      if(T.P.stopped&&s.scW!==s.wave){ s.scW=s.wave; A.stSet(T,u,'sec',0); u.greenCd=0; u.blueCd=0; } },
    secKeep(A,T){ T.s.secK=Math.min(A.stGet(T,'sec'),T.P['sec.keep']||0); },
    secWave(A,T,u){ A.stSet(T,u,'sec',(T.s.secK||0)+(T.P['sec.start']||0)); T.s.secK=0; },
    /* Minute Hand: at 60 Seconds, the ability being cast spends 30 and deals 10% more a rank (all its hits: its bolts, its jumps, its pulses) */
    minute(A,T,u,c){ T.s.mh=null; if(SKILLS.indexOf(c.skill)<0||A.stGet(T,'sec')<60-1e-9) return; A.stSet(T,u,'sec',A.stGet(T,'sec')-30); T.s.mh=c.skill; },
    mhNow(A,T){ return !!T.s.mh&&T.s.cur===T.s.mh; },
    /* ---- Late Blows ---- */
    /* the first enemy hit on him every 8 s (Further Ahead: 1 s sooner a rank) arrives late: 1 s later, 6% a rank smaller. Inside the signature's 1.5 s every hit
       is late; Second Look (once a wave) makes a hit that would kill him late, whatever the timer. */
    lateChk(A,T,u,c){ const s=T.s; if(!c.src||c.src.team===u.team) return; const t=now(A); let ok=A.winOn(T,'wtl');
      if(!ok&&T.r.hh_1_4&&t>=(s.lateAt||0)){ ok=true; s.lateAt=t+Math.max(1,8+(T.P['late.cd']||0)); }
      if(!ok&&T.P.second&&s.slW!==s.wave&&c.amt>=u.hp+(u.shield||0)){ ok=true; s.slW=s.wave; }
      if(!ok) return; c.amt*=Math.max(0,1-(T.P['late.less']||0)); A.acts(T,u,[{late:1,pre:'latePre',ends:'lateLand',emit:'lateQ'}],c); },
    neverThere(A,T,u,c){ c.amt=0; c.missed=true; },
    /* ---- Miles ---- */
    miles(A,T,u){ const s=T.s; if(u.px==null) return; const d=Math.hypot(u.x-u.px,u.y-u.py)/A.eng().METER(); if(!(d>0)||d>5) return;   // a jump of more than 5 m in one tick is a placement, not a walk
      s.md=(s.md||0)+d; if(s.md>=3){ const k=Math.floor(s.md/3+1e-9); s.md-=3*k; A.stSet(T,u,'miles',A.stGet(T,'miles')+k); } },
    milesKeep(A,T){ T.s.miK=Math.min(A.stGet(T,'miles'),T.P['miles.keep']||0); },
    milesWave(A,T,u){ A.stSet(T,u,'miles',(T.s.miK||0)+(T.P['miles.start']||0)); T.s.miK=0; T.s.md=0; },
    /* ---- Parcels ---- */
    parcelWave(A,T){ T.s.par=T.r.sc_1_3?1+(T.r.sc_2_3||0):0; },
    /* a Chain Lightning delivers one Parcel: to the ally with the least energy (Priority Mail: an ally at 70 to 99 energy first, the closest to full); its energy
       (4 a rank, Priority Mail 1 more a rank), and what does not fit goes on at 30% a rank (Forwarding Address) to the ally with the next least; then its riders */
    deliver(A,T,u,c){ const s=T.s; if(!(s.par>0)) return; const L=byEnergy(allies(A,T,u)); if(!L.length) return; let t=L[0];
      if(T.P.priority){ const nr=L.filter(x=>(x.energy||0)>=70&&(x.energy||0)<100); if(nr.length) t=nr.sort((a,b)=>(b.energy||0)-(a.energy||0))[0]; }
      s.par--; const over=giveEnergy(t,(T.P.parcel||0)+(T.P.priority||0));
      if(over>0&&T.P.forward){ const nx=L.find(x=>x!==t); if(nx) giveEnergy(nx,over*Math.min(1,T.P.forward)); }
      const c2=Object.assign({},c,{tgt:t}), act=[];
      if(T.P.signed) act.push({shield:{pct:0.20,of:'apow'},dur:4,on:'target'});
      if(T.P.charged){ act.push({heal:{pct:0.03,of:'tgtMaxHp'},on:'target'}); if(T.r.lw_1_1) A.stSet(T,u,'charge',A.stGet(T,'charge')+1); }
      if(T.P.prompt){ t.greenCd=Math.max(0,(t.greenCd||0)-T.P.prompt); t.blueCd=Math.max(0,(t.blueCd||0)-T.P.prompt); }
      if(T.P.express) act.push({mark:'expr',on:'target',dur:3});
      if(T.P.satchel) act.push({mark:'sat',on:'target',dur:4});
      if(T.P.postage) act.push({mark:'post',on:'target',dur:5});
      if(T.P.pockets) act.push({heal:{pct:T.P.pockets,of:'maxHp'},on:'self'});
      A.acts(T,u,act,c2); },
    /* energy to the ally with the least of it */
    least(A,T,u,c,a){ const t=byEnergy(allies(A,T,u))[0]; if(t) giveEnergy(t,+a.n||0); },
    /* The Last Delivery: the ally with the least energy +50 (half an ultimate), every ally within 8 m +20 and 20% faster for 4 s, and 3 fresh Parcels */
    lastDelivery(A,T,u,c){ const L=byEnergy(allies(A,T,u)); if(L[0]) giveEnergy(L[0],50);
      for(const x of A.pick(T,u,{team:'ally',within:8,others:true},c)){ giveEnergy(x,20); A.setMark(T,u,x,'ldm',{dur:4}); } T.s.par=(T.s.par||0)+3; }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/23 - FRITZ - talent decisions.md) */
  ruling:{}
};
