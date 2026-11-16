/* VULMAR - what his learned talents do in a fight (the mechanics; his plain stat talents are read by tools/build_talent_fx.py
   from their sentences, like every other hero's).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   His real kit (the code, not the card wording; damage profile Magic: EVERY hit of his is magic, basic included; a Back-row
   Mage, 25.6 m reach; tests/vulmar-kit-facts.js, 20 seeded fights):
   - Gravity Sling ('gravsling', green, cd 7): the NEAREST enemy (proj) takes 100% AP x skill level and a 0.6 s stun through
     ccApply (0.42 s as it lands); if a second enemy exists, the nearest one to proj (anvil) is where proj is TELEPORTED
     (anvil.x +-24 px, an immovable proj stays) and the anvil takes the 50% splash and a 0.5 s stun (0.35 s). 20 of 110 casts
     had no anvil. The hurled enemy flew a median 4.5 m (max 29 m).
   - Grasping Vow ('tendrilpull', blue, cd 10): the FARTHEST enemy is dragged to 2 m from his centre over the hand clip
     (1.21 s), silenced AND rooted ('stunned') for it through ccApply (0.85 s each as they land). NO damage. Median drag 24.5 m.
   - Unstepped (passive): u.immovable for good; the page's 18 displacement tests run the 'unmoved' hook for him.
   - Weight of the World ('worldweight', ult, energy): every enemy within 8 m of the aim rolls the control resist; a resisted
     one takes 200% AP x skill level at once (RESIST), the others are LIFTED 2 s (_liftT, a hold, not a stun) and on landing
     take the 200% (deferred _liftDmg) and a RAW 1 s stun (u.stunned written straight: Phil's table exemption). The page's
     case had no hook: two guarded sites now give it the at hook (its centre) and a partPre/part pair 'slam' around each slam.
   His families (WIRING/64 - VULMAR - talent decisions.md):
   - Heft (The Gathering Weight): enemy ustack 'vuHeft', max 6, 8 s (+1 s/rank Heavier Still). At 6 the enemy is Pressed Flat
     as soon as the stun-lock rule lets it (not while stunned, not within 0.5 s after one of his stuns on it ended).
   - Tether: his own per-enemy record (anchor, seconds left, reach), a clamp every tick, a countdown (never a fight time).
   - Impact / Debris / Mass (Falling Bodies): the metres his kit moves an enemy, known at the cast (the sling's teleport, the
     Vow's drag), counted up to 6 m; Debris zones where the sling's enemy lands; Mass a self stack (10, 6 s lapse).
   - Rise / Penance / the auras (The Raised Lotus): a 6 s clock; the Penance pool spent by every Grasping Vow as a shield.
   Caps: DR40 - his damage-reduction talents are ONE product on him, kept share floored at 0.60; ALLY30 - the reductions his
   talents give an ally are one product, floored at 0.70; REGEN - Quiet Breath + Height of Calm at most 1.2% of max HP a
   second; STUN_TOP - an extended stun of his never past 4.0 s; the stun-lock rule for his talent stuns (Pressed Flat, The
   Pressed District, Fall Away), District at most twice per enemy per cast. NO absolute fight time anywhere: every timer is a
   countdown lowered by the tick's dt (the battle clock restarts at 0 each wave); his ground zones end with the wave. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const GS='gravsling', TP='tendrilpull', WW='worldweight', SLAM='slam';
const AB=[GS,TP,WW,SLAM];                 // his abilities: their hits (the slam is the ultimate's, on its own clock)
const DR_FLOOR=0.60, ALLY_FLOOR=0.70, REGEN=0.012, STUN_TOP=4.0, LOCK=0.5, IMPACT_M=6, PD_MAX=2;
/* the families: their bookkeeping rows are attached only when one of their talents is learned */
const HEFT=['gw_1_1','gw_2_1','gw_3_1','gw_4_1','gw_4_2','gw_6_1','gw_6_4','gw_7_1','gw_10_1','gw_11_1','gw_11_2','gw_12_1','gw_12_4','gw_13_2'];
const HEFTG=['gw_1_1','gw_4_2','gw_12_1'];                                                   // an ability hit lays Heft
const TETH=['gw_1_4','gw_3_4','gw_5_4','gw_6_4','gw_8_4','gw_9_4'];
const RISE=['rl_1_2','rl_2_2','rl_3_2','rl_5_2','rl_6_2','rl_8_2','rl_10_2','rl_11_2','rl_13_3'];
const PEN=['rl_1_4','rl_2_4','rl_3_4','rl_4_4','rl_6_4','rl_9_4','rl_10_4','rl_12_4'];
const MASS=['fb_2_3','fb_4_3','fb_5_3','fb_9_3','fb_10_2','fb_10_4','fb_11_3','fb_12_2','fb_12_3','fb_13_2'];
const DEB=['fb_1_4','fb_2_4','fb_4_4','fb_6_4','fb_8_4','fb_10_4','fb_11_4'];
const IMP=['fb_1_1','fb_2_1','fb_n1','fb_6_1','fb_8_1','fb_9_1','fb_9_2','fb_11_1','fb_n3','fb_13_2','gw_9_4'];
const DRG=['rl_1_2','rl_3_2','rl_4_4','rl_7_2','rl_11_2','rl_11_3','rl_12_1','rl_13_3','gw_3_4','gw_12_4','gw_n2','fb_n2'];   // DR40: his own group
const ALLYDR=['rl_7_2','rl_8_3','rl_11_3','rl_13_3','gw_3_4','gw_n2'];                      // ALLY30: what his talents give an ally
const SLK=['gw_2_2','gw_4_2','gw_5_2','gw_5_3','gw_6_2','gw_9_2','fb_1_1','fb_1_4','fb_2_3','fb_3_1','fb_4_2','fb_5_1','fb_5_2','fb_8_4','fb_n2','fb_n1','rl_6_1','rl_7_1','gw_1_1','gw_12_1','fb_10_3'];   // the sling's kit/cast rows
const VWK=['gw_1_1','gw_1_4','gw_7_2','gw_9_4','gw_12_1','fb_1_1','fb_2_3','fb_6_3','fb_7_3','fb_n2','fb_10_3','rl_1_4','rl_5_4'].concat(TETH);
const WWK=['gw_8_3','gw_11_2','gw_12_2','gw_13_2','gw_n2','gw_12_1','gw_5_1','fb_9_2','fb_10_2','fb_11_4','fb_13_2','fb_10_3','rl_7_2','rl_11_3','rl_12_3','rl_13_3','gw_10_3'];
const CCO=['gw_2_2','gw_4_3','gw_5_1','fb_5_1','rl_6_1','rl_10_1'];                           // his control lengths (ccOut)
const STN=['gw_3_1','gw_13_2','rl_9_3','gw_10_3','gw_n2','fb_8_4'].concat(HEFT);                // his stun bookkeeping (the stun-lock rule)
const CDR=['gw_2_3','rl_4_1','gw_9_3','rl_9_1','fb_9_3'];
const ENF=['gw_6_1','gw_9_2','gw_5_3'];                                                       // on hits taken by enemies (his team's amps, the bond)
const ALW=ALLYDR.concat(PEN,['rl_9_3']);                                                      // on hits taken by his allies
/* ---- small readers that need no API ---- */
const rk=(T,id)=>T.r[id]||0;
const has=(T,L)=>L.some(id=>T.r[id]);
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const V=T=>T.s.vu||(T.s.vu={e:{}, q:[], pen:0, riseT:6, qbT:2, hcT:1, rgT:1, rgUsed:0, debT:0.5, cdw:0, cdUsed:0, mh:0, unr:0, si:0, faW:0,
  sm:1, pos:null, proj:null, anvil:null, vow:null, cast:null, cch:{}, first:0, openSk:null, openOn:0, ww:null, wwId:0, wwSlam:-1, wwArm:null,
  sh:null, ds:0, stats:{press:0,pd:0,locked:0,impact:0,imp:0,deb:0,teth:0,clamp:0,shield:0,fa:0,runMax:0}});
const rec=(T,t)=>{ const v=V(T); let r=v.e[t.uid]; if(!r) r=v.e[t.uid]={u:t,st:0,lk:0,teth:0,tx:0,ty:0,tr:3,pend:0,pdAcc:0,pdN:0,pdId:-1,sb:0,lr:0,gm:0,wc:0,wcl:0,fel:0,shb:0,bond:0,bp:null,sls:0,lc:-1,ef:0,open:0,run:0}; return r; };
const recOf=(T,t)=>t?V(T).e[t.uid]:null;
module.exports={
  hero:'vulmar',
  casting:true,                         // rows ask which of his skills a hit comes from (the sling, the Vow's landing, the ultimate, the slam)
  points:true,                          // the at hook runs for his ultimate: its centre and radius (The Pressed District, Avalanche Field, the resisted)
  needs:{ gw_2_1:'gw_1_1', gw_11_1:'gw_1_1', gw_3_4:'gw_1_4', gw_5_4:'gw_1_4', gw_6_4:'gw_1_4', gw_8_4:'gw_1_4', gw_9_4:'gw_1_4',
    fb_2_1:'fb_1_1', fb_n1:'fb_1_1', fb_6_1:'fb_1_1', fb_8_1:'fb_1_1', fb_9_1:'fb_1_1', fb_9_2:'fb_1_1', fb_11_1:'fb_1_1', fb_n3:'fb_1_1',
    fb_2_4:'fb_1_4', fb_4_4:'fb_1_4', fb_6_4:'fb_1_4', fb_8_4:'fb_1_4', fb_10_4:'fb_1_4', fb_11_4:'fb_1_4',
    rl_2_4:'rl_1_4', rl_3_4:'rl_1_4', rl_4_4:'rl_1_4', rl_6_4:'rl_1_4', rl_9_4:'rl_1_4', rl_10_4:'rl_1_4', rl_12_4:'rl_1_4' },
  states:{
    vuHeft:{unit:true, max:6, dur:P('heft.dur',8), full:'heftFull'},       // Heft on enemies (8 s + 1/rank Heavier Still); at 6 a press is due
    vuMass:{max:10, dur:P('mass.dur',6)},                                   // Mass (lost 6 s after the last gain, +1 s/rank Gathering Mass)
    vuRise:{max:P('rise.max',5), wave:'reset'}                              // Rise (5, +1/rank High Lotus), kept for the wave
  },
  always:[
    {on:'wave',do:[{fn:'waveStart'}]},                                                                       // a new wave: his records drop; Penance carries (Kept Count) or empties
    {on:'tick',do:[{fn:'tk'}]},                                                                               // every timer of his counts down here
    {on:'kit',skill:GS,do:[{fn:'gsKit'}]}, {on:'cast',skill:GS,reqAny:SLK,do:[{fn:'gsCast'}]},               // the sling: positions before, everything after
    {on:'skillTgt',skill:GS,do:[{fn:'gsProj'}]}, {on:'skillTgt',skill:'vuAnvil',do:[{fn:'gsAnvil'}]},          // whom it seizes (Sling Aside), whom it is hurled into (Cast Far)
    {on:'kit',skill:TP,do:[{fn:'tpKit'}]}, {on:'skillTgt',skill:TP,do:[{fn:'tpTgt'}]}, {on:'cast',skill:TP,reqAny:VWK,do:[{fn:'tpCast'}]},   // the Vow
    {on:'kit',skill:WW,do:[{fn:'wwKit'}]}, {on:'at',skill:WW,do:[{fn:'wwAt'}]}, {on:'cast',skill:WW,reqAny:WWK,do:[{fn:'wwCast'}]},          // the ultimate: Coming Down, the centre, the lifted
    {on:'part',skill:SLAM,reqAny:WWK.concat(STN),do:[{fn:'slam'}]},                                          // each slam (the page's partPre/part 'slam')
    {on:'kit',do:[{fn:'firstKit'}]},                                                                          // the first ability of the wave (Opening Weight, Deep Memory)
    {on:'hit',if:{targetTeam:'enemy',casting:AB},reqAny:HEFTG.concat(['gw_9_2','gw_4_2']),do:[{fn:'abHit'}]}, // an ability hit: Heft, Felled Together
    {on:'heftFull',reqAny:HEFT,do:[{fn:'heftFull'}]},                                                         // 6 Heft: a press is due
    {on:'ccOut',reqAny:CCO,do:[{fn:'ccOutF'}]},                                                               // his control lengths: (real base x Leaden) + the flat adds, 4.0 s at most
    {on:'ccHit',reqAny:STN.concat(['gw_10_3']),do:[{fn:'ccHitF'}]},                                           // a control of his landed: the stun record, Heavy Patience, Sharp Stones
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                    // DR40: ONE capped product on him
    {on:'teamIn',if:{targetTeam:'ally'},reqAny:ALW,do:[{fn:'allyIn'}]},                                       // ALLY30, Penance, Fall Away
    {on:'teamIn',if:{targetTeam:'enemy'},reqAny:ENF,do:[{fn:'foeIn'}]},                                       // Shared Burden, Felled Together, the bond
    {on:'death',reqAny:['rl_6_4','fb_10_4'],do:[{fn:'deathF'}]},                                              // Old Debt, Packed Debris
    {on:'cd',reqAny:CDR,do:[{fn:'cdSet'}]}                                                                    // his cooldown talents
  ],
  talents:{
    /* ============================== THE GATHERING WEIGHT ============================== */
    gw_1_1:[ {param:'heft.slow',add:R(0.01)} ],                                                              // Heft (tk slows a Heft; abHit lays it)
    gw_2_3:[ {param:'cd.vow',add:R(0.5)} ],                                                                   // Patient Vow
    gw_1_4:[ {on:'out',if:{fn:'tethered'},more:R(0.03)} ],                                                    // Tether (tpLand anchors it; tk clamps it)
    gw_2_1:[ {param:'heft.dur',add:R(1)} ],                                                                   // Heavier Still
    gw_2_2:[ {param:'sg',add:R(0.1)} ],                                                                       // Sure Grip (ccOutF)
                                                                                                              // Gravity's Ear: a plain stat (fx: +2%/rank apow) - no row
    gw_3_1:[ {param:'pf',add:1} ],                                                                            // Pressed Flat (heftFull / tryPress)
    gw_n1:[ {on:'wave',do:[{energy:R(2)}]} ],                                                                 // Settled Mind
    gw_3_4:[ {param:'dt',add:R(0.02)} ],                                                                      // Drawn Tight (myDr / allyIn)
    gw_4_1:[ {param:'lw',add:R(0.02)} ],                                                                      // Leaden Weight (tk: attack slower at 3+ Heft)
    gw_4_2:[ {param:'knot',add:R(1)} ],                                                                       // Second Knot (abHit)
    gw_4_3:[ {param:'vsil',add:R(0.3)} ],                                                                     // Deeper Silence (ccOutF)
    gw_5_1:[ {param:'leaden',add:R(0.02)} ],                                                                  // Leaden (ccOutF; the slam's stun at the lift)
    gw_5_2:[ {param:'dsl',add:1} ],                                                                           // Double Sling (gsCast)
    gw_5_3:[ {param:'bond',add:1} ],                                                                          // Bound Pair (gsCast marks; foeIn shares)
    gw_5_4:[ {param:'teth.dur',add:R(0.4)} ],                                                                 // Taut Line
    gw_6_1:[ {param:'shb',add:R(0.05)} ],                                                                     // Shared Burden (tryPress marks; foeIn)
    gw_6_2:[ {on:'out',if:{casting:GS},more:R(0.05)} ],                                                       // Added Weight
                                                                                                              // Steady Lotus: a plain stat (fx: +2%/rank armor and mr) - no row
    gw_6_4:[ {param:'hline',add:R(1)} ],                                                                      // Heavy Line (tk: a Tether ends)
    gw_7_1:[ {on:'out',more:R(0.004),per:{ust:'vuHeft'}} ],                                                   // Millstone
    gw_7_2:[ {param:'vor',add:1} ],                                                                           // Vow of Return (tpCast)
    gw_7_3:[ {on:'out',if:{casting:[WW,SLAM]},more:R(0.03)} ],                                                // Grave Weight (the cast's hits and the slam)
    gw_8_1:[ {param:'gr',add:R(0.1)} ],                                                                       // Ground Remembers
    gw_8_3:[ {on:'kit',skill:WW,opt:{radius:{addM:R(0.2)}}} ],                                                // Wide Circle
    gw_8_4:[ {param:'teth.reach',add:R(-0.5)} ],                                                              // Anchor Point (3 m, floor 1.5 m)
    gw_9_2:[ {param:'fel',add:R(0.02)} ],                                                                     // Felled Together (abHit marks; foeIn)
    gw_9_3:[ {param:'cd.pct',add:R(0.01)} ],                                                                  // Calm Weight
    gw_9_4:[ {param:'teth2',add:1} ],                                                                         // Two Tethers (tpLand)
    gw_10_1:[ {param:'settle',add:1} ],                                                                       // Settling (tryPress)
    gw_10_3:[ {param:'hpat',add:R(1)} ],                                                                      // Heavy Patience (ccHitF / slam)
                                                                                                              // Lotus Hide: a plain stat (fx: +2%/rank hp) - no row
    gw_11_1:[ {param:'heft.slow2',add:R(0.002)} ],                                                            // Measured Step
    gw_11_2:[ {param:'sdesc',add:R(2)} ],                                                                     // Slow Descent (slam)
    gw_n2:[ {param:'wcbl',add:R(0.05)} ],                                                                     // What Cannot Be Lifted (blocked)
    gw_12_1:[ {param:'dmem',add:R(1)} ],                                                                      // Deep Memory (abHit / tpCast)
    gw_12_2:[ {param:'lpress',add:R(0.04)} ],                                                                 // Lingering Press (slam)
    gw_12_4:[ {param:'dk',add:R(0.03)} ],                                                                     // Distance Kept (myDr)
    gw_13_2:[ {param:'pd',add:1} ],                                                                           // The Pressed District (SIGNATURE: slam, tk, tryPress)
    /* ============================== FALLING BODIES ============================== */
    fb_1_1:[ {param:'imp',add:R(0.04)} ],                                                                     // Impact (impact)
    fb_1_2:[ {on:'out',if:{casting:AB},ignoreMr:R(0.03)} ],                                                   // Gravity's Edge
    fb_1_4:[ {param:'deb',add:R(0.03)} ],                                                                     // Debris (tk: the zones' ticks)
    fb_2_1:[ {param:'bmb',add:R(0.20)} ],                                                                     // Bone Meets Bone
    fb_n1:[ {param:'btf',add:1} ],                                                                            // Bound to Fall (LINK: the Tether half needs Tether learned)
    fb_2_3:[ {stat:{apow:R(0.004)},per:'vuMass'} ],                                                           // Mass
                                                                                                              // Weight of Will: a plain stat (fx: +2%/rank apow) - no row
    fb_3_1:[ {param:'far',add:1} ],                                                                           // Cast Far (gsAnvil)
    fb_4_2:[ {on:'kit',skill:GS,opt:{splashMul:{add:R(0.1)}}} ],                                              // Splash Weight (half up to 80%)
    fb_4_3:[ {param:'mass.dur',add:R(1)} ],                                                                   // Gathering Mass
    fb_n2:[ {param:'lr',add:R(0.02)} ],                                                                       // Left Reeling (myDr)
    fb_5_1:[ {param:'gfall',add:1}, {on:'out',if:{casting:GS,fn:'isProj'},more:0.40} ],                       // Great Fall (the page skips the anvil: u._vuNoAnvil)
    fb_5_2:[ {param:'spin',add:1} ],                                                                          // Spin and Release (gsCast)
    fb_2_4:[ {param:'deb.dur',add:R(0.5)} ],                                                                  // Settled Dust
    fb_4_4:[ {param:'deb.slow',add:R(0.03)} ],                                                                // Grinding Debris
    fb_3_2:[ {on:'out',if:{casting:GS},more:R(0.03)} ],                                                       // Sling Strength
    fb_5_3:[ {on:'out',if:{casting:AB,stackMin:{vuMass:10}},more:R(0.03)} ],                                  // Full Mass
    fb_6_1:[ {param:'drv',add:R(0.02)} ],                                                                     // Driven In
                                                                                                              // Lotus Frame: a plain stat (fx: +2%/rank hp) - no row
    fb_6_3:[ {param:'arm',add:R(0.30)} ],                                                                     // Long Arm (tpLand)
    fb_6_4:[ {param:'deb.w',add:R(0.3)} ],                                                                    // Rubble Field (2 m wide + 0.3 m a rank)
    fb_7_1:[ {on:'out',if:{casting:AB,targetHpBelow:0.5},more:R(0.02)} ],                                     // Giving Way
    fb_7_3:[ {param:'cdown',add:1} ],                                                                         // Cast Down (tpCast)
    fb_10_3:[ {on:'out',if:{fn:'openOn'},more:R(0.06)} ],                                                     // Opening Weight
    fb_8_1:[ {param:'hb',add:R(0.05)} ],                                                                      // Heavy Bodies
    fb_8_2:[ {on:'out',if:{casting:SLAM},more:R(0.03)} ],                                                     // Crushing Slam
    fb_8_4:[ {param:'sharp',add:R(0.06)} ],                                                                   // Sharp Stones (tk's Debris tick)
    fb_9_1:[ {param:'si',add:1} ],                                                                            // Second Impact (impact)
    fb_9_2:[ {param:'fsky',add:R(1)} ],                                                                       // Falling Sky (slam)
    fb_9_3:[ {param:'cd.mass',add:R(0.002)} ],                                                                // Mass Retained
    fb_10_2:[ {param:'gkeep',add:R(1)} ],                                                                     // Gravity Keeps (wwCast)
                                                                                                              // Unguarded Lotus: a plain stat (fx: +2%/rank apow, -1%/rank armor and mr) - no row
    fb_10_4:[ {param:'pack',add:R(1)} ],                                                                      // Packed Debris (deathF)
    fb_11_1:[ {param:'th',add:R(0.02)} ],                                                                     // Thrown Hard
    fb_11_3:[ {on:'unmoved',if:{srcTeam:'enemy'},do:[{stack:'vuMass',add:R(1)}]} ],                           // Unstepped Power
    fb_11_4:[ {param:'aval',add:1} ],                                                                         // Avalanche Field (slam)
    fb_n3:[ {param:'sbnc',add:R(1)} ],                                                                        // Second Bounce (impact)
    fb_12_2:[ {on:'out',if:{casting:[WW,SLAM]},more:R(0.005),per:'vuMass'} ],                                 // World's Weight
    fb_12_3:[ {on:'tick',edge:true,once:'wave',if:{selfHpBelow:0.30},do:[{cd:'green',set:0},{stack:'vuMass',add:R(2)}]} ],   // Last Knot
    fb_13_2:[ {param:'efall',add:1} ],                                                                        // Everything Falls (SIGNATURE: wwCast pairs, slam)
    /* ============================== THE RAISED LOTUS ============================== */
    rl_1_1:[ {param:'qb',add:R(0.002)} ],                                                                     // Quiet Breath (tk: every 2 s, REGEN cap)
    rl_1_2:[ {param:'rise.dr',add:R(0.006)} ],                                                                // Rise (tk: the clock; myDr)
    rl_1_4:[ {param:'pen',add:R(0.08)} ],                                                                     // Sacrament (allyIn counts; tpCast spends)
                                                                                                              // Monk's Patience: a plain stat (fx: +2%/rank hp) - no row
    rl_2_2:[ {param:'rise.per',add:R(-1)} ],                                                                  // Higher Still (6 s, floor 3 s)
    rl_2_4:[ {param:'pen.cap',add:R(0.10)} ],                                                                 // Counted Names
    rl_3_2:[ {param:'abv',add:1} ],                                                                           // Above Reach (myDr)
    rl_3_3:[ {on:'moved',do:[{fn:'quietAir'}]} ],                                                             // Quiet Air
    rl_3_4:[ {param:'pen.str',add:R(0.03)} ],                                                                 // Weighed Deeds
    rl_4_1:[ {param:'cd.vow',add:R(0.5)} ],                                                                   // Quiet Hands
    rl_4_3:[ {stat:{ctrl:R(0.03)},to:{team:'ally',within:4,others:true}} ],                                   // Held in Place (up to 9%)
    rl_4_4:[ {param:'bear',add:R(0.02)} ],                                                                    // Bearing It (myDr)
    rl_5_1:[ {on:'ccIn',less:R(0.04)} ],                                                                      // Settled Calm (up to 20%)
    rl_5_2:[ {stat:{apow:R(0.003)},per:'vuRise'} ],                                                           // Soft Air
    rl_6_1:[ {param:'msl',add:R(0.2)} ],                                                                      // Measured Sling (ccOutF)
    rl_6_2:[ {stat:{move:R(0.04)},if:{stackMin:{vuRise:3}}} ],                                                // Lightened
    rl_8_2:[ {param:'rise.max',add:R(1)} ],                                                                   // High Lotus
    rl_6_4:[ {param:'debt',add:R(0.04)} ],                                                                    // Old Debt (deathF)
    rl_7_1:[ {param:'aside',add:1} ],                                                                         // Sling Aside (gsProj)
    rl_7_2:[ {param:'load',add:R(0.03)} ],                                                                    // Lifted Load (myDr / allyIn)
    rl_7_3:[ {stat:{armor:R(0.015),mr:R(0.015)},to:{team:'ally',within:4,others:true}} ],                     // Steady Ground
    rl_5_3:[ {stat:{immovable:true},to:{team:'ally',within:3,others:true}} ],                                 // Unstepped Circle
                                                                                                              // Lotus Skin: a plain stat (fx: +1%/rank armor) - no row
    rl_8_3:[ {param:'ward',add:R(0.02)} ],                                                                    // Ward of Weight (allyIn)
    rl_5_4:[ {param:'shelter',add:1} ],                                                                       // Gravity Shelter (tpTgt)
    rl_9_1:[ {param:'cd.pct',add:R(0.01)} ],                                                                  // Clear Thought
    rl_9_3:[ {param:'fa',add:1} ],                                                                            // Fall Away (allyIn)
    rl_9_4:[ {param:'pen.dur',add:R(0.5)} ],                                                                  // Recompense
    rl_10_1:[ {param:'vsil',add:R(0.3)} ],                                                                    // Vow Kept (ccOutF)
    rl_10_2:[ {param:'hc',add:R(0.002)} ],                                                                    // Height of Calm (tk: every 1 s at full Rise, REGEN cap)
    rl_10_4:[ {param:'pg',add:R(3)} ],                                                                        // Patient Gravity (tpCast)
    rl_11_2:[ {param:'unr',add:R(0.15)} ],                                                                    // Unreached (myDr)
    rl_11_3:[ {param:'gm',add:R(0.02)} ],                                                                     // Grave Mercy (slam marks; myDr / allyIn)
                                                                                                              // Still Strength: a plain stat (fx: +2%/rank apow) - no row
    rl_12_1:[ {param:'fg',add:R(0.01)} ],                                                                     // Floating Guard (myDr)
    rl_12_3:[ {param:'hsil',add:R(0.2)} ],                                                                    // Held Silence (slam)
    rl_12_4:[ {param:'kept',add:R(0.10)} ],                                                                   // Kept Count (waveStart)
    rl_13_3:[ {param:'cdn',add:1}, {stat:{immovable:true},to:{team:'ally',within:8,others:true},if:{fn:'cdOn'}} ]   // Coming Down (SIGNATURE: wwKit, wwCast, myDr / allyIn)
  },
  fn:{
    /* ---- A NEW WAVE: the records drop (enemies are new), Penance carries what Kept Count keeps, the Rise clock starts again ---- */
    waveStart(A,T,u){ const v=V(T), P=T.P; T.s.api=A;
      v.e={}; v.q=[]; v.sh=null; v.cdw=0; v.mh=0; v.faW=0; v.first=0; v.openOn=0; v.openSk=null; v.ww=null; v.wwArm=null;
      v.pen=(P.kept&&v.pen>0)?v.pen*Math.min(1,P.kept):0;
      v.riseT=T.fn.risePer(A,T); v.qbT=2; v.hcT=1; v.rgT=1; v.rgUsed=0; v.debT=0.5; },
    risePer(A,T){ return Math.max(3,6+(T.P['rise.per']||0)); },
    /* ---- EVERY TIMER, ONCE A TICK (countdowns only) ---- */
    tk(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), dt=c.dt||0, M=E.METER(); T.s.api=A;
      /* Rise: +1 every 6 s in battle (Higher Still 1 s sooner a rank, floor 3 s) */
      if(has(T,RISE)){ v.riseT-=dt; if(v.riseT<=1e-9){ v.riseT+=T.fn.risePer(A,T); const n=stN(T,'vuRise'); if(n<A.stMax(T,u,'vuRise')) A.stSet(T,u,'vuRise',n+1); } }
      /* REGEN: Quiet Breath (0.2%/rank every 2 s) + Height of Calm (0.2%/rank every 1 s at full Rise) together at most 1.2% of max HP a second */
      if(P.qb||P.hc){ v.rgT-=dt; if(v.rgT<=1e-9){ v.rgT+=1; v.rgUsed=0; } const room=()=>Math.max(0,REGEN*(u.maxHp||0)-v.rgUsed);
        const heal=x=>{ const h=Math.min(x,room()); if(h>0&&u.alive){ E.healUnit(u,h); v.rgUsed+=h; } };
        if(P.qb){ v.qbT-=dt; if(v.qbT<=1e-9){ v.qbT+=2; heal(P.qb*(u.maxHp||0)); } }
        if(P.hc){ v.hcT-=dt; if(v.hcT<=1e-9){ v.hcT+=1; if(T.fn.riseFull(A,T,u)) heal(P.hc*(u.maxHp||0)); } } }
      if(v.unr>0) v.unr=Math.max(0,v.unr-dt); if(v.si>0) v.si=Math.max(0,v.si-dt); if(v.cdw>0) v.cdw=Math.max(0,v.cdw-dt);
      if(v.mh>0){ v.mh=Math.max(0,v.mh-dt); A.stSet(T,u,'vuMass',10); const k=T.s.k.vuMass; if(k) k.t=Math.max(k.t,amtMass(A,T,u)); }   // Everything Falls: 10 Mass held for 8 s
      if(v.sh){ v.sh.left-=dt; if(v.sh.left<=0||!v.sh.t.alive||!((v.sh.t.shield||0)>0)) v.sh=null; }
      /* the Vow's landings and the other things due later (countdowns) */
      if(v.q.length) for(let i=0;i<v.q.length;i++){ const q=v.q[i]; q.t-=dt; if(q.t>1e-9) continue; v.q.splice(i--,1); T.fn[q.f](A,T,u,q); }
      /* his records of enemies */
      const pdOn=!!(P.pd&&A.zoneOn(T,'vuPD'));
      for(const k in v.e){ const r=v.e[k], t=r.u; if(!t.alive){ delete v.e[k]; continue; }
        if((t.stunned||0)>0&&(r.st>0||r.run>0)){ r.run+=dt; if(r.run>v.stats.runMax) v.stats.runMax=r.run; } else r.run=0;   // a run of stuns on it that one of his began (the test reports the longest)
        if(r.st>0){ r.st=((t.stunned||0)>0)?Math.min(r.st-dt,t.stunned):0; if(r.st<=1e-9){ r.st=0; r.lk=LOCK; } }
        else if(r.lk>0) r.lk=Math.max(0,r.lk-dt);
        for(const f of ['lr','gm','wc','wcl','fel','shb','bond','sls']) if(r[f]>0) r[f]=Math.max(0,r[f]-dt);
        if(r.teth>0){ r.teth-=dt; if(r.teth<=1e-9){ r.teth=0; if(P.hline) T.fn.addHeft(A,T,u,t,P.hline); }
          else { const dx=t.x-r.tx, dy=t.y-r.ty, d=Math.hypot(dx,dy), L=r.tr*M; if(d>L){ t.x=r.tx+dx/d*L; t.y=r.ty+dy/d*L; t._ax=t.x; t._ay=t.y; v.stats.clamp++; } } }
        if(pdOn&&A.inZone(T,t,'vuPD')){ A.acts(T,u,[{slow:0.35,dur:0.6,on:'target'}],{u,tgt:t}); r.pdAcc+=dt; if(r.pdAcc>=1-1e-9){ r.pdAcc-=1; T.fn.addHeft(A,T,u,t,1); } }
        if(r.pend) T.fn.tryPress(A,T,u,t,r); }
      /* Heft's slow (1%/rank a Heft, Measured Step 0.2%/rank more a Heft) and Leaden Weight (3+ Heft: attack 2%/rank slower) */
      if(P['heft.slow']||P.lw) for(const x of E.units()){ if(!x.alive||x.team===u.team) continue; const n=A.ustGet(T,u,x,'vuHeft'); if(!(n>0)) continue;
        if(P['heft.slow']) A.acts(T,u,[{slow:Math.min(0.9,n*(P['heft.slow']+(P['heft.slow2']||0))),dur:0.6,on:'target'}],{u,tgt:x});
        if(P.lw&&n>=3){ x.hasteMul=Math.min(x.hasteMul==null?1:x.hasteMul,Math.max(0.05,1-P.lw)); x.hasteT=Math.max(x.hasteT||0,0.4); } }
      /* Debris: every 0.5 s each enemy on it takes 3%/rank of his ability power (Sharp Stones: more on a sling-stunned one); Grinding Debris slows */
      if(has(T,DEB)&&A.zoneOn(T,'vuDeb')){ v.debT-=dt; const tickNow=v.debT<=1e-9; if(tickNow) v.debT+=0.5;
        for(const x of E.units()){ if(!x.alive||x.team===u.team||!A.inZone(T,x,'vuDeb')) continue;
          if(P['deb.slow']) A.acts(T,u,[{slow:P['deb.slow'],dur:0.6,on:'target'}],{u,tgt:x});
          if(tickNow&&P.deb){ const r=recOf(T,x); let d=P.deb*apOf(u)*(1+((P.sharp&&r&&r.sls>0&&(x.stunned||0)>0)?P.sharp:0));
            d*=E.defMul(u,x,'magic'); if(d>0){ A.hurt(T,u,x,d,'#9a7cff','debris'); v.stats.deb++; } } } }
      else v.debT=0.5; },
    /* ---- THE FIRST ABILITY OF THE WAVE (Opening Weight +6%/rank, Deep Memory +1 Heft/rank on its hits) ---- */
    firstKit(A,T,u,c){ const v=V(T); if(v.first) { v.openOn=0; return; } if(c.skill!==GS&&c.skill!==TP&&c.skill!==WW) return; v.first=1; v.openSk=c.skill; v.openOn=1; },
    openOn(A,T,u,c){ const v=V(T), cur=T.s.cur; if(v.openOn&&cur===v.openSk) return true; if(cur===SLAM){ const r=recOf(T,c.tgt); return !!(r&&r.open); } return !!(cur===TP&&v.landOpen); },
    /* ---- GRAVITY SLING. kit: where every enemy stands before, the variants' flags. skillTgt: whom it seizes and whom it is hurled into.
       cast: Impact, Mass, Debris, Left Reeling, Bound Pair, Great Fall's drop, Double Sling's second pair, Spin and Release's line. */
    gsKit(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(); v.sm=u._castSM||1; v.proj=null; v.anvil=null; v.cch={}; v.pos=new Map();
      for(const x of E.units()) if(x.alive&&x.team!==u.team) v.pos.set(x,{x:x.x,y:x.y});
      u._vuNoAnvil=P.gfall?1:0; v.so=c.o?Object.assign({},c.o):{}; },
    gsProj(A,T,u,c){ const v=V(T), P=T.P, E=A.eng();
      if(P.aside){ const lo=E.lowestAlly(u); if(lo){ let b=null,bd=1e18; for(const x of E.units()){ if(!x.alive||x.team===u.team||x._dropHidden||x._noTarget) continue; const d=E.dist(lo,x); if(d<bd){ bd=d; b=x; } } if(b) c.tgt=b; } }
      v.proj=c.tgt||null; },
    gsAnvil(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), p=v.proj;
      if(P.far&&p){ let b=null,bd=-1; for(const x of E.units()){ if(!x.alive||x.team===u.team||x===p||x._dropHidden||x._noTarget) continue; if(A.gap(p,x)<6*E.METER()){ const d=E.dist(p,x); if(d>bd){ bd=d; b=x; } } } if(b) c.tgt=b; }
      v.anvil=c.tgt||null; },
    gsCast(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), M=E.METER(), p=v.proj, a=v.anvil; if(!p) return; const o=Object.assign({},v.so,c.o||{});
      const moved=t=>{ const q=v.pos&&v.pos.get(t); return q?Math.hypot(t.x-q.x,t.y-q.y)/M:0; };
      if(P.gfall){ if(p.alive){ T.fn.flung(A,T,u,p); T.fn.impact(A,T,u,p,3,{land:p}); T.fn.debris(A,T,u,p); } }
      else if(a){ const m=moved(p); if(p.alive&&m>0.1){ T.fn.flung(A,T,u,p); T.fn.impact(A,T,u,p,m,{land:a}); }
        T.fn.debris(A,T,u,p.alive?p:a);
        if(P.bond&&p.alive&&a.alive){ const rp=rec(T,p), ra=rec(T,a); rp.bond=3; rp.bp=a; ra.bond=3; ra.bp=p; }
        if(P.spin) T.fn.spin(A,T,u,p,a,o,v.pos.get(p)||p); }
      if(P.dsl) T.fn.secondPair(A,T,u,p,o);
      T.fn.blocked(A,T,u,p); if(a&&!P.gfall) T.fn.blocked(A,T,u,a); },
    /* Double Sling: the second-nearest enemy is hurled into the enemy next to IT, at the skill's own numbers (its hits are the sling's, its stuns the sling's 0.6 / 0.5 s
       as they land, 0.42 / 0.35 s, with his stun talents) */
    secondPair(A,T,u,p,o){ const v=V(T), E=A.eng(), M=E.METER(); let s=null,sd=1e18;
      for(const x of E.units()){ if(!x.alive||x.team===u.team||x===p||x._dropHidden||x._noTarget) continue; const d=E.dist(u,x); if(d<sd){ sd=d; s=x; } } if(!s) return;
      let n=null,nd=1e18; for(const x of E.units()){ if(!x.alive||x.team===u.team||x===s||x._dropHidden||x._noTarget) continue; const d=E.dist(s,x); if(d<nd){ nd=d; n=x; } }
      const s0={x:s.x,y:s.y}, base=apOf(u)*v.sm*E.rage();
      v.ds2=1; try{ T.fn.skillHit(A,T,u,s,base*(o.mul||1.0),GS); } finally{ v.ds2=0; } v.ds=1; try{ if(s.alive) A.control(T,u,s,'stunned',E.ccDur(0.6)); } finally{ v.ds=0; }
      if(!n) return;
      if(s.alive&&!s.immovable&&!((s._gearImmovableT||0)>0)){ s.x=n.x+(s.x>=n.x?24:-24); s.y=n.y; s._ax=s.x; s._ay=s.y; }
      v.ds2=1; try{ T.fn.skillHit(A,T,u,n,base*(o.splashMul||0.5),GS); } finally{ v.ds2=0; } v.ds=1; try{ if(n.alive) A.control(T,u,n,'stunned',E.ccDur(0.5)); } finally{ v.ds=0; }
      const m=Math.hypot(s.x-s0.x,s.y-s0.y)/M; if(s.alive&&m>0.1){ T.fn.flung(A,T,u,s); T.fn.impact(A,T,u,s,m,{land:n}); } T.fn.debris(A,T,u,s.alive?s:n); },
    /* Spin and Release: the hurled enemy goes on through the enemy it was hurled into, 6 m further: every OTHER enemy whose body that line (from where it stood, through
       the anvil, 6 m past it) crosses takes the splash */
    spin(A,T,u,p,a,o,from){ const v=V(T), E=A.eng(), M=E.METER(); const dx=a.x-from.x, dy=a.y-from.y, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, end={x:a.x+ux*6*M,y:a.y+uy*6*M};
      const amt=apOf(u)*v.sm*E.rage()*(o.splashMul||0.5);
      for(const x of E.units()){ if(!x.alive||x.team===u.team||x===p||x===a||x._dropHidden||x._noTarget) continue; if(segD(x,from,end)-E.bodyR(x)<0.5*M) T.fn.skillHit(A,T,u,x,amt,GS); } },
    /* a hit of his skill a talent adds (Double Sling's second pair, Spin's line, Long Arm): a real hit through the page's damage, as that skill's (its own rows see it) */
    skillHit(A,T,u,t,amt,sk){ const E=A.eng(); if(!t||!t.alive||!u.alive||!E.strike||!(amt>0)) return; const pv=T.s.cur, d0=T.s.d; T.s.cur=sk; T.s.d=0; try{ E.strike(u,t,amt,'#b06bff','magic'); } finally{ T.s.cur=pv; T.s.d=d0; } },
    /* an enemy he hurled or dragged: Mass, Left Reeling */
    flung(A,T,u,t){ const P=T.P; if(has(T,MASS)) A.stSet(T,u,'vuMass',Math.min(10,stN(T,'vuMass')+1)); if(P.lr&&t&&t.alive) rec(T,t).lr=4; },
    /* Debris where the hurled enemy came down (2 m wide + 0.3 m a rank Rubble Field, 4 s + 0.5 s a rank Settled Dust) */
    debris(A,T,u,at){ const P=T.P, E=A.eng(); if(!has(T,DEB)||!at) return; T.fn.zone(A,T,'vuDeb',at.x,at.y,(2+(P['deb.w']||0))/2*E.METER(),4+(P['deb.dur']||0)); },
    zone(A,T,name,x,y,r,dur){ const E=A.eng(), L=T.s.zn[name]||(T.s.zn[name]=[]), now=E.now(); for(let i=L.length-1;i>=0;i--) if(now>=L[i].until) L.splice(i,1); if(L.length>=24) L.shift(); L.push({x,y,r,until:now+dur,centre:false}); },
    /* ---- IMPACT: 4%/rank of his ability power a metre moved (counted up to 6 m), dealt when it lands; magic resist applies. The riders and the repeats. ---- */
    impact(A,T,u,t,m,o){ const v=V(T), P=T.P, E=A.eng(); o=o||{}; if(!t||!t.alive) return 0; const per=o.full?0.20:(P.imp||0); if(!(per>0)||!(m>0)) return 0;
      const r=rec(T,t); let mm=Math.min(IMPACT_M,m), k=1;
      if(P.btf){ if(m>=5) k*=1.05; if(T.r.gw_1_4&&r.teth>0&&!o.bounce){ mm+=2; r.teth+=1; } }
      if(P.drv&&(t.stunned||0)>0) k*=1+P.drv; if(P.hb&&(t.maxHp||0)>(u.maxHp||0)) k*=1+P.hb; if(P.th) k*=1+P.th;
      const raw=apOf(u)*per*mm*k, hp0=t.hp; const got=A.hurt(T,u,t,raw*E.defMul(u,t,'magic'),'#c08cff','impact'); v.stats.impact+=got; v.stats.imp++;
      if(P.bmb&&!o.bounce){ const L=o.land&&o.land!==t&&o.land.alive?o.land:A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target',order:'near',n:1},{u,tgt:t})[0];
        if(L&&L.alive&&A.gap(t,L)<2.5*E.METER()) A.hurt(T,u,L,raw*P.bmb*E.defMul(u,L,'magic'),'#c08cff','impact'); }
      if(!t.alive){ if(P.si&&v.si<=0){ v.si=6; u.greenCd=0; } return got; }
      if(P.sbnc&&!o.bounce&&!r.sb&&hp0>=0.5*t.maxHp&&t.hp<0.5*t.maxHp){ r.sb=1; T.fn.impact(A,T,u,t,P.sbnc,{bounce:true}); }
      return got; },
    /* a stun of his resisted or blocked by immunity (What Cannot Be Lifted: that enemy deals 5%/rank less 4 s, once per enemy every 12 s) */
    blocked(A,T,u,t){ const v=V(T), P=T.P; if(!P.wcbl||!t||!t.alive) return; if(v.cch[t.uid]&&!t.stunImmune) return; const r=rec(T,t); if(r.wcl>0) return; r.wc=4; r.wcl=12; },
    isProj(A,T,u,c){ return !!c.tgt&&c.tgt===V(T).proj; },
    /* ---- GRASPING VOW. kit: its numbers. skillTgt: whom it seizes (Gravity Shelter). cast: the seized enemy's Heft, Penance's shield, Cast Down's hurl, Vow of
       Return's second drag; its landing (a countdown of the drag): Tether, Impact, Long Arm, Two Tethers, Cast Down's silence. */
    tpKit(A,T,u,c){ const v=V(T); v.sm=u._castSM||1; v.vow=null; v.cch={}; },
    tpTgt(A,T,u,c){ const v=V(T), P=T.P, E=A.eng();
      if(P.shelter){ const lo=E.lowestAlly(u); if(lo){ let b=null,bd=1e18; for(const x of E.units()){ if(!x.alive||x.team===u.team||x.target!==lo||x._dropHidden||x._noTarget) continue; const d=E.dist(u,x); if(d<bd){ bd=d; b=x; } } if(b) c.tgt=b; } }
      v.vow=c.tgt||null; },
    tpCast(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), M=E.METER(), t=v.vow, o=c.o||{}; if(!t) return;
      const stopD=(o.stop||10)*M, dur=Math.max(0.05,(t.pullT||0)>0?t.pullT:1.21);
      if(t.alive){ T.fn.heftOn(A,T,u,t,1,v.openOn&&v.openSk===TP); T.fn.blocked(A,T,u,t); }
      T.fn.sacrament(A,T,u);
      if(P.cdown&&t.alive){ const p=E.densest(u,3*M); let m=0;
        if(p&&!t.immovable&&!((t._gearImmovableT||0)>0)){ const d=Math.hypot(p.x-t.x,p.y-t.y); m=d/M; t.pulledBy={x:p.x,y:p.y,alive:true}; t.pullStop=0; t.pullSpeed=Math.max(1,d/(dur*0.97)); t.pullT=dur; t._pullGhost=true; }
        if(m>0.1) T.fn.flung(A,T,u,t); v.q.push({t:dur,f:'tpLand',tgt:t,m,down:1,open:v.openOn&&v.openSk===TP}); }
      else if(t.alive){ const dragged=t.pulledBy===u&&(t.pullT||0)>0, m=dragged?Math.max(0,E.dist(u,t)-stopD)/M:0; if(dragged&&m>0.1) T.fn.flung(A,T,u,t);
        v.q.push({t:dur,f:'tpLand',tgt:t,m,teth:1,open:v.openOn&&v.openSk===TP}); }
      if(P.vor&&t.alive){ const sil=Math.max(0,(t.silencedT||0))/2;
        for(const x of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},{u,tgt:t})){ let m=0;
          if(!x.immovable&&!((x._gearImmovableT||0)>0)){ const d=Math.max(0,E.dist(u,x)-stopD); m=d/M; if(d>0){ x.pulledBy=u; x.pullT=Math.max(x.pullT||0,dur); x.pullStop=stopD; x.pullSpeed=Math.max(1,d)/(dur*0.97); x._pullGhost=true; } }
          if(sil>0) A.control(T,u,x,'silencedT',sil,true); if(m>0.1) T.fn.flung(A,T,u,x); v.q.push({t:dur,f:'tpLand',tgt:x,m,teth:1,second:1}); } } },
    tpLand(A,T,u,q){ const v=V(T), P=T.P, E=A.eng(), t=q.tgt; if(!t||!t.alive) return;
      if(q.teth&&T.r.gw_1_4) T.fn.tether(A,T,u,t);
      if(q.m>0.1) T.fn.impact(A,T,u,t,q.m,{});
      if(!q.second&&P.arm&&u.alive){ v.landOpen=!!q.open; try{ T.fn.skillHit(A,T,u,t,apOf(u)*P.arm,TP); } finally{ v.landOpen=false; } }
      if(q.down) for(const x of A.pick(T,u,{team:'enemy',of:'target',within:3},{u,tgt:t})) A.control(T,u,x,'silencedT',1);
      if(!q.second&&q.teth&&P.teth2&&T.r.gw_1_4){ const n=A.pick(T,u,{team:'enemy',of:'target',skip:'target',order:'near',n:1},{u,tgt:t})[0]; if(n) T.fn.tether(A,T,u,n); } },
    /* Tether: anchored where it stands now, 4 s (+0.4 s/rank Taut Line), 3 m (-0.5 m/rank Anchor Point, 1.5 m at least) - a clamp every tick (tk) */
    tether(A,T,u,t){ const P=T.P, r=rec(T,t); r.tx=t.x; r.ty=t.y; r.teth=4+(P['teth.dur']||0); r.tr=Math.max(1.5,3+(P['teth.reach']||0)); V(T).stats.teth++; },
    tethered(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.teth>0); },
    /* Penance (Sacrament): each Grasping Vow spends ALL of it - a shield on his lowest-HP ally for 4 s (+0.5 s/rank Recompense), 8%/rank of it (Weighed Deeds: 3%/rank
       stronger), and Patient Gravity's energy */
    sacrament(A,T,u){ const v=V(T), P=T.P, E=A.eng(); if(!P.pen||!(v.pen>0)) { v.pen=0; return; } const t=E.lowestAlly(u); const amt=v.pen*P.pen*(1+(P['pen.str']||0))*(u.shieldStrMul||1); v.pen=0; if(!t||!(amt>0)) return;
      const d=4+(P['pen.dur']||0); t.shield=(t.shield||0)+amt; t.shieldT=Math.max(t.shieldT||0,d); v.sh={t,left:d}; v.stats.shield++;
      if(P.pg) u.energy=Math.max(0,Math.min(100,(u.energy||0)+P.pg)); },
    penCap(A,T,u){ return (0.30+(T.P['pen.cap']||0))*(u.maxHp||0); },
    /* ---- WEIGHT OF THE WORLD. kit: Coming Down at full Rise (once a fight: 3 m wider). at: its centre and radius. cast: the lifted enemies - the slam's stun
       lengthened (Leaden, Coming Down, Everything Falls; 4.0 s at most), Gravity Keeps, Everything Falls' pairs, the resisted (What Cannot Be Lifted). */
    wwKit(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(); v.sm=u._castSM||1; v.cch={}; v.cdNow=0;
      if(P.cdn&&!v.cdUsed&&T.fn.riseFull(A,T,u)){ v.cdNow=1; v.cdUsed=1; if(c.o) c.o.radius=(c.o.radius||8*E.METER())+3*E.METER(); } },
    wwAt(A,T,u,c){ const v=V(T), E=A.eng(); v.ww={x:c.pt.x,y:c.pt.y,R:(c.o&&c.o.radius)||8*E.METER()}; },
    wwCast(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(); v.wwId++; const id=v.wwId, W=v.ww; const lifted=[];
      for(const x of E.units()) if(x.alive&&x.team!==u.team&&x._liftBy===u&&(x._liftT||0)>0&&Math.abs((x._liftT||0)-(x._liftL||0))<1e-9) lifted.push(x);
      for(const x of lifted){ const r=rec(T,x); r.lc=id; r.open=(v.openOn&&v.openSk===WW)?1:0; r.ef=(P.efall&&lifted.length>1)?1:0; r.pdN=0; r.pdId=id;
        let s=(x._liftStun||1.0)*(1+(P.leaden||0))+(v.cdNow?1:0)+(r.ef?0.5:0); x._liftStun=Math.min(STUN_TOP,s); }
      if(P.gkeep&&lifted.length) A.stSet(T,u,'vuMass',Math.min(10,stN(T,'vuMass')+P.gkeep*lifted.length));
      if(P.wcbl&&W) for(const x of E.units()){ if(!x.alive||x.team===u.team||lifted.indexOf(x)>=0) continue; if(Math.hypot(x.x-W.x,x.y-W.y)<W.R) T.fn.blocked(A,T,u,x); }
      v.wwArm={id,W:W?Object.assign({},W):null,done:0};
      if(v.cdNow){ v.cdw=8; A.stSet(T,u,'vuRise',0); v.riseT=T.fn.risePer(A,T); } },
    /* ---- A SLAM (the page's partPre/part 'slam', right after its damage and its raw stun): his stun record, Heavy Patience, Slow Descent, Lingering Press, Grave
       Mercy, Held Silence, Falling Sky, Everything Falls; the cast's first slam lays The Pressed District and Avalanche Field */
    slam(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), t=c.tgt; if(!t) return; const r=rec(T,t);
      if(t.alive&&(t.stunned||0)>0){ r.st=Math.max(r.st,t.stunned); if(P.hpat) u.energy=Math.max(0,Math.min(100,(u.energy||0)+P.hpat)); }
      const arm=v.wwArm; if(arm&&!arm.done&&r.lc===arm.id&&arm.W){ arm.done=1; const W=arm.W;
        if(P.pd) T.fn.zone(A,T,'vuPD',W.x,W.y,W.R,6);
        if(P.aval&&has(T,DEB)) T.fn.zone(A,T,'vuDeb',W.x,W.y,W.R,4+(P['deb.dur']||0));
        if(P.efall&&r.ef) v.mh=8; }
      if(!t.alive) return;
      if(P.sdesc) T.fn.addHeft(A,T,u,t,P.sdesc);
      if(P.lpress) A.acts(T,u,[{slow:P.lpress,dur:3,on:'target'}],{u,tgt:t});
      if(P.gm) r.gm=4;
      if(P.hsil) A.control(T,u,t,'silencedT',P.hsil);
      if(P.fsky) T.fn.impact(A,T,u,t,P.fsky,{});
      if(P.efall&&r.ef){ T.fn.impact(A,T,u,t,4,{full:true}); }
      r.open=0; },
    /* ---- HEFT ---- */
    abHit(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt; if(!t||t.team===u.team) return;
      if(T.r.gw_1_1||P.knot||P.dmem){ let n=T.r.gw_1_1?1:0; const cur=T.s.cur;
        if(P.knot&&cur===GS&&(t===v.proj||t===v.anvil||v.ds2)) n+=P.knot;
        if(P.dmem&&(T.fn.openOn(A,T,u,c))) n+=P.dmem;
        if(n>0) T.fn.addHeft(A,T,u,t,n); }
      if(P.fel&&T.s.cur===GS) rec(T,t).fel=3; },
    heftOn(A,T,u,t,base,first){ const P=T.P; let n=T.r.gw_1_1?base:0; if(P.dmem&&first) n+=P.dmem; if(n>0) T.fn.addHeft(A,T,u,t,n); },   // the Vow's seizure (its cast hook: no skill resolving)
    addHeft(A,T,u,t,n){ if(!t||!t.alive||t.team===u.team||!(n>0)||!has(T,HEFT)) return; A.acts(T,u,[{ustack:'vuHeft',on:'target',add:n}],{u,tgt:t}); },
    heftFull(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; const P=T.P; if(!P.pf&&!P.pd) return; const r=rec(T,t); r.pend=1; T.fn.tryPress(A,T,u,t,r); },
    /* a press: Pressed Flat 1 s (+0.1 s/rank Ground Remembers), or 1.5 s inside The Pressed District (at most twice per enemy per cast). The stun-lock rule: not on
       an enemy already stunned, nor within 0.5 s after one of his stuns on it ended - it waits, while the enemy still carries 6 Heft */
    tryPress(A,T,u,t,r){ const v=V(T), P=T.P; if(A.ustGet(T,u,t,'vuHeft')<6-1e-9){ r.pend=0; return; }
      const inPd=P.pd&&A.inZone(T,t,'vuPD')&&r.pdId===v.wwId&&r.pdN<PD_MAX;
      const secs=inPd?1.5:(P.pf?1+(P.gr||0):0); if(!(secs>0)){ r.pend=0; return; }
      if((t.stunned||0)>0||r.lk>0){ v.stats.locked++; return; }
      if(t.stunImmune){ r.pend=0; A.ustPut(T,u,t,'vuHeft',0); T.fn.blocked(A,T,u,t); return; }
      r.pend=0; A.ustPut(T,u,t,'vuHeft',0); A.control(T,u,t,'stunned',secs); v.stats.press++; if(inPd){ r.pdN++; v.stats.pd++; }
      if(P.shb) r.shb=3;
      if(P.settle) for(const x of A.pick(T,u,{team:'enemy',of:'target',within:2.5,skip:'target'},{u,tgt:t})) T.fn.addHeft(A,T,u,x,2); },
    /* ---- HIS CONTROLS. ccOut: (real base x Leaden) + the flat adds (Sure Grip, Measured Sling, Great Fall on the sling's stuns; Deeper Silence and Vow Kept on the
       Vow's silence); an extended stun never past 4.0 s. ccHit: his stun record (the stun-lock rule), Heavy Patience, Sharp Stones. */
    ccOutF(A,T,u,c){ const v=V(T), P=T.P; const sling=(T.s.cur===GS&&!c.talent)||v.ds;
      if(c.field==='stunned'){ let x=c.amt*(1+(P.leaden||0));
        if(sling){ x+=(P.sg||0)+(P.msl||0); if(P.gfall&&c.tgt&&c.tgt===v.proj&&!v.ds) x+=0.5; }
        c.amt=Math.min(STUN_TOP,x); }
      else if(c.field==='silencedT'&&T.s.cur===TP&&!c.talent) c.amt+=(P.vsil||0); },
    ccHitF(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt; if(!t||t.team===u.team||c.field!=='stunned'||!(c.amt>0)) return;
      v.cch[t.uid]=1; const r=rec(T,t); r.st=Math.max(r.st,Math.min(c.amt,t.stunned||c.amt));
      if(P.hpat) u.energy=Math.max(0,Math.min(100,(u.energy||0)+P.hpat));
      if(T.s.cur===GS||v.ds) r.sls=Math.max(r.sls,c.amt);
      if(t.stunImmune) T.fn.blocked(A,T,u,t); },
    /* ---- DR40: his damage-reduction talents, ONE product on him, kept share floored at 0.60 (the 95% probe reads drK) ---- */
    drK(A,T,u,s,c){ const v=V(T), P=T.P, E=A.eng(); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P['rise.dr']) cut(P['rise.dr']*stN(T,'vuRise'));                                                  // Rise
      if(P.abv&&c&&c.auto&&s&&s.melee&&stN(T,'vuRise')>=5) cut(0.25);                                       // Above Reach
      if(P.bear&&v.sh&&v.sh.left>0&&v.sh.t.alive&&(v.sh.t.shield||0)>0) cut(P.bear);                        // Bearing It
      if(P.fg) cut(P.fg*Math.min(3,A.pick(T,u,{team:'ally',within:4,others:true},{u}).length));             // Floating Guard
      if(P.load&&T.fn.anyLifted(A,T,u)) cut(P.load);                                                        // Lifted Load
      if(P.cdn&&v.cdw>0) cut(0.25);                                                                         // Coming Down
      if(s){ const r=recOf(T,s);
        if(P.dk&&A.ustGet(T,u,s,'vuHeft')>0) cut(P.dk);                                                     // Distance Kept
        if(r){ if(P.dt&&r.teth>0) cut(P.dt); if(P.lr&&r.lr>0) cut(P.lr); if(P.gm&&r.gm>0) cut(P.gm); if(P.wcbl&&r.wc>0) cut(P.wcbl); } }   // Drawn Tight, Left Reeling, Grave Mercy, What Cannot Be Lifted
      return Math.max(DR_FLOOR,k); },
    myDr(A,T,u,c){ const v=V(T), P=T.P; let k=T.fn.drK(A,T,u,c.src,c);
      if(P.unr&&v.unr<=0&&T.fn.riseFull(A,T,u)){ v.unr=8; k=Math.max(DR_FLOOR,k*(1-Math.min(1,P.unr))); }    // Unreached: the first hit every 8 s at full Rise
      c.amt*=k; },
    /* ---- ALLY30 (what his talents give an ally: one product, kept share floored at 0.70), Penance, Fall Away ---- */
    allyK(A,T,u,a,s){ const v=V(T), P=T.P, E=A.eng(); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P.ward&&s&&A.gap(u,a)<4*E.METER()&&A.gap(a,s)>6*E.METER()) cut(P.ward);                           // Ward of Weight
      if(P.load&&T.fn.anyLifted(A,T,u)) cut(P.load);                                                        // Lifted Load
      if(P.cdn&&v.cdw>0&&A.gap(u,a)<8*E.METER()) cut(0.25);                                                 // Coming Down
      if(s){ const r=recOf(T,s); if(r){ if(P.dt&&r.teth>0) cut(P.dt); if(P.gm&&r.gm>0) cut(P.gm); if(P.wcbl&&r.wc>0) cut(P.wcbl); } }
      return Math.max(ALLY_FLOOR,k); },
    allyIn(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), a=c.tgt; if(!a||a===u||a._summon||!c.src||c.src.team===a.team) return;
      c.amt*=T.fn.allyK(A,T,u,a,c.src);
      if(P.pen&&u.alive&&A.gap(u,a)<6*E.METER()&&c.amt>0) v.pen=Math.min(T.fn.penCap(A,T,u),v.pen+Math.min(c.amt,Math.max(0,a.hp)+(a.shield||0)));   // what the hit can take from it (not past its HP and shield)
      if(P.fa&&!v.faW&&u.alive&&A.gap(u,a)<6*E.METER()&&a.hp>=0.30*a.maxHp&&(a.hp+(a.shield||0)-(c.amt||0))<0.30*a.maxHp){ v.faW=1; v.stats.fa++;
        const us=A.pick(T,u,{team:'enemy',of:'target',within:3},{u,tgt:a});
        if(us.length) A.acts(T,u,[{push:{team:'enemy',of:'target',within:3},from:'target',m:3,secs:0.3}],{u,tgt:a});
        for(const x of us) T.fn.tstun(A,T,u,x,0.5); } },
    /* ---- hits on enemies, by anyone of his team: Shared Burden, Felled Together; the bond (Bound Pair: 25% of the hit also to the other, raw, once per hit) ---- */
    foeIn(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt, s=c.src; if(!t||!s) return; const r=recOf(T,t); if(!r) return;
      if(s.team===u.team){ if(P.shb&&r.shb>0) c.amt*=1+P.shb; if(P.fel&&r.fel>0) c.amt*=1+P.fel; }
      if(P.bond&&r.bond>0&&r.bp&&r.bp.alive&&!v.inBond&&c.amt>0){ v.inBond=1; try{ A.hurt(T,u,r.bp,0.25*c.amt,'#9a7cff','bond'); } finally{ v.inBond=0; } } },
    deathF(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), x=c.unit; if(!x) return;
      if(x.team===u.team){ if(P.debt&&P.pen&&x!==u&&!x._summon&&u.alive&&A.gap(u,x)<6*E.METER()) v.pen=Math.min(T.fn.penCap(A,T,u),v.pen+P.debt*(u.maxHp||0)); }
      else if(P.pack&&A.inZone(T,x,'vuDeb')&&u.alive) A.stSet(T,u,'vuMass',Math.min(10,stN(T,'vuMass')+P.pack)); },
    /* a talent stun (the stun-lock rule): never on an enemy already stunned, nor within 0.5 s after one of his stuns on it ended; through the engine's control (full
       written length, no resist roll), then ccHitF records it */
    tstun(A,T,u,t,secs){ const v=V(T); if(!t||!t.alive||t.team===u.team) return false; const r=recOf(T,t);
      if((t.stunned||0)>0||(r&&r.lk>0)){ v.stats.locked++; return false; } if(t.stunImmune){ T.fn.blocked(A,T,u,t); return false; }
      A.control(T,u,t,'stunned',secs); return (t.stunned||0)>0; },
    /* ---- QUIET AIR: an enemy's push, pull or knock on an ally within 4 m of him moves it 10%/rank less (a pull's speed, a knock's distance; up to 50%) ---- */
    quietAir(A,T,u,c){ const P=T.P, E=A.eng(), x=c.unit; if(!x||x===u||!x.alive||A.gap(u,x)>=4*E.METER()) return; const sh=Math.min(0.5,0.10*rk(T,'rl_3_3')); if(!(sh>0)) return;
      if(c.kind==='pull'&&(x.pullSpeed||0)>0) x.pullSpeed*=1-sh;
      else if(c.kind==='knock'&&c.from){ x.x=c.from.x+(x.x-c.from.x)*(1-sh); x.y=c.from.y+(x.y-c.from.y)*(1-sh); x._ax=x.x; x._ay=x.y; } },
    /* ---- his cooldowns: the Vow 0.5 s shorter a rank (Patient Vow, Quiet Hands), then both skills that share shorter (Calm Weight, Clear Thought, Mass Retained) ---- */
    cdSet(A,T,u,c){ const P=T.P; let x=c.amt; if(c.slot==='blue') x=Math.max(0,x-(P['cd.vow']||0));
      const pct=(P['cd.pct']||0)+(P['cd.mass']||0)*stN(T,'vuMass'); c.amt=Math.max(0,x*(1-Math.min(0.5,pct))); },
    /* ---- CONDITIONS ---- */
    riseFull(A,T,u){ const n=stN(T,'vuRise'); return n>0&&n>=A.stMax(T,u,'vuRise')-1e-9; },
    anyLifted(A,T,u){ const E=A.eng(); for(const x of E.units()) if(x.alive&&x.team!==u.team&&x._liftBy===u&&(x._liftT||0)>0) return true; return false; },
    cdOn(A,T){ return V(T).cdw>0; }
  },
  partial:{},
  ruling:{}
};
/* ---- helpers outside the rows ---- */
function apOf(u){ return (u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1); }                 // ability power now, with a running damage buff (as his skills read it)
function amtMass(A,T,u){ const d=T.st.vuMass; return d&&d.dur?A.amtOf(T,u,d.dur,null):6; }
function segD(p,a,b){ const dx=b.x-a.x, dy=b.y-a.y, L=dx*dx+dy*dy; let k=L>0?((p.x-a.x)*dx+(p.y-a.y)*dy)/L:0; k=Math.max(0,Math.min(1,k)); return Math.hypot(p.x-(a.x+dx*k),p.y-(a.y+dy*k)); }
