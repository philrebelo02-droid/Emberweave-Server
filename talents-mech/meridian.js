/* MERIDIAN - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Meridian")
   His real kit (the code, not the tooltip wording; a back-row Marksman, every skill reads Attack, his damage is physical):
   - Golden Quill ('piercethrow', green, cd 7): at once, a line from him to the FARTHEST enemy; every enemy whose centre lies within the line's half-width
     (34 x UNIT_SIZE) of it, from just behind him to 24 px past that enemy, takes 150% of his attack x skill level. The skillTgt hook sees the farthest enemy.
   - Plumb Line ('plumbline', blue, cd 6, deliver 'shot'): flies at his current target (else the nearest enemy) and resolves when it lands; one hit of
     120% x (1 + farBonus 0.9 x min(1, distance / 8 m)) of his attack x skill level, the distance centre to centre at the landing. Its target is chosen at
     the launch (deliverLaunch's skillTgt hook); kit / cast / out rows run at the landing.
   - Final Expedition (ultimate 'finalsurvey', energy; ULT_DEF mul 1.4, mortalDur 3, bleedPct 0.10, bleedDur 3, steal 0.35, regen 0.03, buffDur 3, range 30 m;
     HERO_ULT_ART.meridian only the art): every enemy within 30 m of him takes 140% of his attack x skill level, Mortal Wound for 3 s (its heals halved) and a
     game bleed (10% of his attack x skill level a second for 3 s; armor applies to its ticks); he gets a 35% lifesteal buff for 3 s and a heal over time of
     3% of his max HP a second for 3 s.
   - Well-Read (passive 'momentum'): u._momStk grows 0.025 a second from the fight's start, to +50% + 0.25 points a passive level (+74.75% at 100, +52.5% at
     the lab's 10) and is never reset between waves; his attack speed is 1 + it. "Full ramp" = u._momStk at that cap (bound: momCap).
   Sightings, Triangulation, Windage, Charted, Discovery / Field Notes, Stride, Provisions and the Ink exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/40 - MERIDIAN - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const GQ='piercethrow', PL='plumbline', FE='finalsurvey';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const SIGHT=['ls_1_1'];                                                                                         // Sightline (the other Sighting talents need it)
const TRI=['ls_1_4','ls_2_4','ls_4_4','ls_5_4','ls_6_4','ls_7_4','ls_8_4','ls_9_3','ls_9_4','ls_11_4','ls_12_4','ls_13_1','gi_n1'];   // Triangulation
const CH=['gi_1_1','gi_3_1'];                                                                                   // what Charts an enemy
const NOTE=['gi_1_4','gi_2_4','gi_3_4','gi_6_4','gi_7_4','gi_8_4','gi_10_4','gi_11_4','gi_12_4','gi_5_4','gi_13_2'];   // Discovery and Field Notes
const DISC=['gi_1_4','gi_7_4','gi_5_4'];                                                                        // Discovery (the first hit on each enemy)
const STRIDE=['ty_1_1','ty_9_4','ty_5_3','ty_4_1','ty_10_1','ty_13_1'];                                         // what gives or keeps Stride
const PROV=['ty_1_3'];                                                                                          // Provisions (the other Provision talents need it)
const FEDOT=['gi_4_2','gi_5_2','gi_6_2','gi_10_2','gi_13_2'];                                                   // Final Expedition's bleeds made his ('fs')
const CDG=['ls_8_3','ty_2_4','ls_10_2','ty_6_4','ls_8_1','ls_5_3','ty_7_4','ty_13_1'];                          // his cooldown talents (their floors)
const CRIT=['ls_1_2','gi_8_3','gi_2_4','ls_6_1','ty_5_1','gi_5_4'];                                             // his crit-chance talents: ONE capped group (5%)
const DRG=['ls_6_3','gi_6_2','gi_9_3','ty_9_2','ty_5_2','ty_12_3'];                                             // his damage reduction: ONE capped group (40%)
const TEN=['ty_4_2','ty_12_2'];                                                                                 // his control shortening: ONE capped group (20%)
const RGN=['ty_10_2','gi_12_2'];                                                                                // his healing a second: the regeneration cap (1.2%)
const SHW=['gi_12_1','gi_13_2'];                                                                                // weaker shields on Charted / Inked enemies
const ENM={team:'enemy'};
const S=T=>T.s.md||(T.s.md={});                                     // his own per-fight state (one object: no name of the runtime's own is ever used)
const rk=(T,id)=>T.r[id]||0;
const isBoss=x=>!!((x.t&&x.t.isboss)||x._raidBoss);
const cap=(A,u)=>{ const E=A.eng(); return E.momCap?E.momCap(u):0.5; };
const full=(A,u)=>(u._momStk||0)>=cap(A,u)-1e-9;                   // Well-Read at its full ramp
const gapM=(A,u,x)=>x?A.gap(u,x)/A.eng().METER():0;                 // metres between his body and x's
const charted=(A,u,x)=>!!(x&&A.markOf(u,x,'mdCh'));
const FLOOR={green:3.5,blue:3};                                      // his talents never bring Golden Quill below 3.5 s or Plumb Line below 3 s
module.exports={
  hero:'meridian',
  times:['md.fpT','md.inkT','md.hurtAt','md.greenAt','md.blueAt'],   // this file's own absolute fight times (paths in T.s): the engine moves them back with the clock at each wave (WIRING/41c)
  casting:true,                         // rows ask which of his skills a hit comes from
  needs:{ ls_6_1:'ls_1_1', ls_8_1:'ls_1_1', ls_12_2:'ls_1_1', ls_13_1:'ls_1_1',                                 // Sightings exist only with Clear Sightline
          ty_4_3:'ty_1_3', ty_8_3:'ty_1_3', ty_9_3:'ty_1_3', ty_5_2:'ty_1_3', ty_5_3:'ty_1_3', ty_11_3:'ty_1_3', ty_12_2:'ty_1_3' },   // Provisions exist only with Packed Provisions
  states:{
    mdSight:{max:5},                                                 // Sightings
    mdNote:{max:P('note.max',10)},                                   // Field Notes (kept between waves only as Bound Notebook says)
    mdStride:{max:P('stride.max',10)},                               // Stride (kept between waves only as Long March says)
    mdProv:{max:P('prov.max',2)},                                    // Provisions (set full at each wave's start)
    mdGrid:{max:5,wave:'reset'}                                      // Triangulations landed this wave (Grid Reference)
  },
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                    // Sightline, the regeneration budget, the ramp, weaker shields, eating
    {on:'wave',do:[{fn:'waveStart'}]},
    {on:'kit',skill:PL,do:[{fn:'plKit'}]},                                                                         // Plumb Line lands: the Sightings it spends
    {on:'kit',skill:GQ,do:[{fn:'gqKit'}]},
    {on:'skillTgt',skill:GQ,reqAny:['ls_7_3','ls_9_3'],do:[{fn:'gqLine'}]},                                        // the enemies on Golden Quill's line, its farthest target
    {on:'hit',reqAny:TRI.concat(CH,DISC,['gi_n1','ty_1_1','ty_9_4','ty_7_4','ls_5_3']),if:{targetTeam:'enemy'},do:[{fn:'myHit'}]},   // Triangulation, Charted, Discovery, Stride, the cooldown refunds
    {on:'cast',skill:GQ,do:[{fn:'gqCast'}]},
    {on:'kit',skill:FE,reqAny:FEDOT,do:[{tagDots:'kit'}]}, {on:'cast',skill:FE,do:[{tagDots:'fs'},{fn:'feCast'}]},  // Final Expedition: its bleeds made his
    {on:'cd',reqAny:CDG,do:[{fn:'cdSet'}]},                                                                        // his cooldown talents, with their floors
    {on:'crit',reqAny:CRIT.concat(['ls_7_1']),if:{targetTeam:'enemy'},do:[{fn:'crit'}]},                           // his crit-chance talents (one capped group) and Breathless Shot
    {stat:{crit:1},reqAny:CRIT,per:{fn:'critS'}},
    {on:['in','dotIn'],reqAny:DRG,do:[{fn:'myDr'}]},                                                               // his damage reduction: one capped group
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                        // his control shortening: one capped group
    {on:'hurt',reqAny:['ls_3_1'],do:[{fn:'hurtMe'}]},                                                              // Held Breath: "while he is being hit"
    {on:'foiled',reqAny:['ls_n1'],do:[{fn:'wind'}]}                                                                // Windage: one of his hits was blocked or missed
  ],
  talents:{
    /* ======================= THE LONG SHOT ======================= */
    ls_1_1:[ {on:'out',if:{casting:PL,targetTeam:'enemy'},more:R(0.03),per:{fn:'spent'}} ],                       // Clear Sightline: Sightings in 'tk', spent at Plumb Line's landing
    ls_2_3:[ {on:'out',if:{casting:GQ,targetTeam:'enemy'},more:R(0.03)} ],                                         // Gold Nib
    ls_1_4:[ {param:'tri.on',add:1}, {on:'out',if:{targetHas:'mdTri'},more:R(0.04)} ],                             // Triangulate (the two-skill test in myHit)
    ls_2_1:[ {param:'sight.rate',add:R(0.15)} ],                                                                    // Patient Sighting
    ls_1_2:[ {param:'crit.se',add:R(0.01)} ],                                                                       // Steady Eye (in the crit group)
    ls_2_4:[ {stat:{move:R(-0.05)},to:{team:'enemy',has:'mdTri'}} ],                                               // Fixed Position
    ls_3_1:[ {param:'sight.held',add:1} ],                                                                          // Held Breath
    ls_3_2:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.02)} ],                                             // Sharp Angles
    ls_3_3:[ {on:'kit',skill:GQ,opt:{width:{more:R(0.06)}}} ],                                                     // Wide Margin
    ls_4_1:[ {param:'pl.reach',add:R(0.3)}, {on:'out',if:{casting:PL,targetTeam:'enemy'},do:[{fn:'reach'}]} ],    // Surveyor's Reach (8 m down to 6.5 m)
    ls_n1:[  {on:'out',if:{auto:true,targetTeam:'enemy'},do:[{fn:'windOut'}]} ],                                  // Corrected Shot (Windage read in the always 'foiled' row)
    ls_4_4:[ {param:'tri.dur',add:R(0.5)} ],                                                                        // Three Points
    ls_5_1:[ {on:'kit',skill:PL,opt:{farBonus:{add:R(0.04)}}} ],                                                   // Long Shot Habit (90% up to 102%)
    ls_5_2:[ {on:'skillTgt',skill:PL,do:[{fn:'plFar'}]} ],                                                          // Farthest First (PICK ONE)
    ls_5_3:[ {on:'skillTgt',skill:PL,do:[{fn:'plNear'}]} ],                                                         // Nearest Threat (PICK ONE): its Quill refund in myHit
    ls_5_4:[ {on:'out',if:{targetHas:'mdTri'},critMore:R(0.02)} ],                                                 // Fixed Star (2% x 5: crit damage at most 10%)
    ls_6_1:[ {param:'crit.ss',add:R(0.004)} ],                                                                      // Steady Sighting (in the crit group)
    ls_6_2:[ {on:'out',if:{auto:true,targetTeam:'enemy',fn:'far6'},more:R(0.015)} ],                              // Far Horizon
    ls_6_3:[ {param:'dr.cc',add:0.15} ],                                                                            // Close Call (in myDr; its window from myHit)
    ls_6_4:[ {on:'death',if:{unitHas:'mdTri'},do:[{mark:'mdTri',on:{team:'enemy',of:'unit',n:1},dur:R(1),longest:true}]} ],   // Bearing Kept
    ls_7_1:[ {param:'pl.sure',add:1} ],                                                                             // Breathless Shot (in crit)
    ls_7_3:[ {on:'out',if:{casting:GQ,targetTeam:'enemy'},more:R(0.02),per:{fn:'gl'}} ],                           // Gold Leaf
    ls_7_4:[ {on:'hit',if:{casting:FE,targetTeam:'enemy'},do:[{fn:'triOn',dur:3}]} ],                              // Final Bearing
    ls_8_1:[ {param:'pl.ref',add:R(0.15)} ],                                                                        // Long Sightline (refund in plKit)
    ls_8_3:[ {param:'cd.q',add:R(0.3)} ],                                                                           // Quiet Hands
    ls_8_4:[ {on:'teamIn',if:{targetHas:'mdTri',srcTeam:'ally'},more:R(0.01)} ],                                   // Plotted Course (his own hits too: they are hits on a watched enemy)
    ls_9_3:[ {on:'hit',if:{casting:GQ,targetTeam:'enemy',fn:'isFar'},do:[{fn:'triOn'}]} ],                        // Gilded Line
    ls_9_4:[ {stat:{atk:R(0.008)},per:'mdGrid'} ],                                                                  // Grid Reference (up to 5)
    ls_10_1:[ {on:'kit',skill:FE,opt:{mul:{more:R(0.03)}}} ],                                                      // Deep Survey
    ls_10_2:[ {param:'cd.p',add:R(0.12)} ],                                                                         // Sure Line
    ls_10_3:[ {on:'out',if:{targetTeam:'enemy',fn:'far8'},critMore:R(0.02)} ],                                     // Thin Air
    ls_11_1:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.40},more:R(0.03)} ],                               // Last Mile
    ls_11_2:[ {param:'ramp.q',add:1} ],                                                                             // Early Start (in waveStart)
    ls_11_4:[ {on:'out',if:{casting:GQ,targetHas:'mdTri'},more:R(0.03)} ],                                         // True Bearing
    ls_12_1:[ {on:'out',if:{casting:PL,targetTeam:'enemy'},more:R(0.03)} ],                                        // Charted Distance
    ls_12_2:[ {on:'kill',if:{casting:PL},do:[{stack:'mdSight',add:R(1)}]} ],                                       // Survey Complete
    ls_12_3:[ {stat:{aspd:R(0.015)},per:'mdUl'} ],                                                                  // Unbroken Line (the window in gqCast)
    ls_12_4:[ {on:'out',if:{targetHas:'mdTri',targetHpBelow:0.30},more:R(0.04)} ],                                 // Last Point
    ls_13_1:[ {on:'cast',skill:PL,do:[{fn:'farPoint'}]} ],                                                          // The Far Point (SIGNATURE)
    /* ======================= THE GOLD INK ======================= */
    gi_1_1:[ {on:'out',if:{targetHas:'mdCh'},more:R(0.015)} ],                                                     // Gold Ink (Charting in myHit)
    gi_2_2:[ {on:'kit',skill:FE,opt:{bleedPct:{more:R(0.04)}}} ],                                                  // Long Expedition
    gi_1_4:[ {param:'disc',add:R(0.10)}, {on:'out',if:{targetTeam:'enemy'},do:[{fn:'discOut'}]}, {stat:{atk:0.005},per:'mdNote'} ],   // First Sighting
    gi_2_1:[ {on:'teamHeal',if:{unitHas:'mdCh'},less:R(0.04)} ],                                                   // Indelible
    gi_8_3:[ {param:'crit.sp',add:R(0.01)} ],                                                                       // Sharpened Pencils (in the crit group)
    gi_2_4:[ {param:'crit.mn',add:R(0.003)} ],                                                                      // Margin Notes (in the crit group)
    gi_3_1:[ {param:'ch.pl',add:1} ],                                                                               // Coastline on the Arm (in myHit)
    gi_n1:[  {on:'out',if:{casting:PL,targetHas:'mdCh',targetLacks:'mdPl1'},more:0.08}, {param:'tfp',add:1,req:'ls_1_4'} ],   // Two Fixed Points (LINK: 6 s with Triangulate)
    gi_3_3:[ {param:'ramp',add:R(0.04)} ],                                                                          // Well-Thumbed
    gi_3_4:[ {stat:{lifesteal:R(0.002)},per:'mdNote'} ],                                                            // Fieldwork
    gi_4_1:[ {stat:{aspd:R(0.006)},per:{fn:'chAlive'}} ],                                                           // Map Legend (up to 5)
    gi_5_2:[ {param:'fe.set',add:3} ],                                                                              // Set Ink (PICK ONE; in feCast)
    gi_5_3:[ {on:'hit',if:{targetTeam:'enemy',fn:'ls'},do:[{fn:'runInk'}]} ],                                     // Running Ink (PICK ONE)
    gi_n2:[  {on:'teamHeal',if:{unitHas:'mdCh'},icd:4,do:[{energy:R(2)}]} ],                                       // Noted Recovery
    gi_5_1:[ {on:'teamIn',if:{targetHas:'mdCh',srcIs:'ally'},more:R(0.01)} ],                                      // Chart Room
    gi_6_2:[ {param:'dr.si',add:R(0.02)}, {on:'teamIn',if:{srcHas:'mdSet',targetTeam:'ally'},less:R(0.02)} ],      // Settled Ink (on him in myDr)
    gi_6_3:[ {param:'ri.more',add:R(0.10)} ],                                                                       // Shared Ration
    gi_4_2:[ {param:'fe.dur',add:R(0.4)} ],                                                                         // Long Bleed (in feCast)
    gi_6_1:[ {on:'out',if:{casting:GQ,targetTeam:'enemy'},more:R(0.03)} ],                                         // Gilt Edge
    gi_5_4:[ {param:'crit.xr',add:R(0.04)} ],                                                                       // Cross-Reference (this hit's own part of the crit group)
    gi_6_4:[ {param:'note.keep',add:R(2)} ],                                                                        // Bound Notebook
    gi_7_1:[ {on:'hit',if:{casting:GQ,targetHas:'mdCh'},do:[{dmg:{pct:0.30,of:'hit'},on:'target'}]} ],            // Every Mark an X
    gi_7_2:[ {on:'kit',skill:FE,opt:{steal:{more:R(0.03)}}} ],                                                     // Drawn Life
    gi_7_4:[ {param:'disc.late',add:R(0.08)} ],                                                                     // Nothing Unknown
    gi_8_1:[ {on:'out',if:{targetHas:'mdCh',targetHpBelow:0.50},more:R(0.03)} ],                                   // Ink Runs Deep
    gi_9_3:[ {param:'dr.qs',add:R(0.015)} ],                                                                        // Quiet Study (in myDr)
    gi_8_4:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.002),per:'mdNote'} ],                               // Scholar's Eye
    gi_9_1:[ {on:'out',if:{casting:FE,targetHas:'mdCh'},more:R(0.03)} ],                                           // Full Survey
    gi_9_2:[ {on:'death',if:{unitHas:'mdCh',fn:'ls'},do:[{fn:'thirst'}]} ],                                        // Thirst of the Ink
    gi_10_2:[ {on:'dotTick',if:{tag:'fs'},do:[{heal:{pct:R(0.01),of:'hit'}}]} ],                                   // Red Margins
    gi_10_3:[ {stat:{aspd:1},per:{fn:'lh'}} ],                                                                      // Long Hours (+2 points a rank at the full ramp)
    gi_10_4:[ {on:'kill',dots:true,chance:R(0.2),do:[{stack:'mdNote',add:1}]} ],                                   // Annotated
    gi_11_1:[ {on:'death',if:{unitHas:'mdCh'},do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                             // Indexed
    gi_11_2:[ {on:'end:mdFe',do:[{fn:'night'}]} ],                                                                  // Night Copy
    gi_11_4:[ {param:'note.max',add:R(1)} ],                                                                        // Field Journal (up to 15)
    gi_12_1:[ {param:'sh.ig',add:R(0.04)} ],                                                                        // Indelible Gold (in tk)
    gi_12_2:[ {param:'rg.dh',add:R(0.0024)} ],                                                                      // Draining Hand (in tk, the regeneration budget)
    gi_12_4:[ {on:'out',if:{stackMin:{mdNote:10}},critMore:R(0.03)} ],                                             // Margins Full
    gi_13_2:[ {param:'ink',add:1},                                                                                  // Stays Charted (SIGNATURE; the Ink written in feCast)
              {on:'teamHeal',if:{unitHas:'mdInk'},mul:0},
              {on:'tick',do:[{dotRate:1,on:{team:'enemy',has:'mdInk'}}]},
              {on:'dotTick',if:{tag:'fs',targetHas:'mdInk'},do:[{heal:{pct:0.5,of:'hit'}}]},
              {on:'death',if:{unitHas:'mdInk'},do:[{stack:'mdNote',add:2}]} ],
    /* ======================= THE THIRTY-TWO YEARS ======================= */
    ty_1_1:[ {param:'stride.on',add:1}, {stat:{atk:R(0.003)},per:'mdStride'} ],                                   // Into Stride (the gain in myHit)
    ty_1_3:[ {param:'prov.heal',add:R(0.02)} ],                                                                     // Packed Provisions (eating in tk)
    ty_2_4:[ {param:'cd.q',add:R(0.3)} ],                                                                           // Quill Rhythm
    ty_2_1:[ {param:'ramp',add:R(0.04)} ],                                                                          // Warm Up
    ty_2_3:[ {param:'prov.more',add:R(0.10)} ],                                                                     // Hard Tack
    ty_3_1:[ {on:'hit',if:{auto:true,targetTeam:'enemy',stackMin:{mdStride:10}},every:3,do:[{dmg:{pct:0.40,of:'hit'},on:{team:'enemy',of:'self',n:1,skip:'target'}}]} ],   // Blur of the Hand
    ty_4_2:[ {param:'ten.gt',add:R(0.04)} ],                                                                        // Gritted Teeth (in ten)
    ty_3_4:[ {on:'out',if:{casting:PL,targetTeam:'enemy'},more:R(0.03)} ],                                         // Dead Reckoning
    ty_4_1:[ {param:'stride.keep',add:R(2)} ],                                                                      // Long March
    ty_5_1:[ {param:'crit.pc',add:R(0.002)} ],                                                                      // Pacing (in the crit group)
    ty_4_3:[ {param:'prov.max',add:R(1)} ],                                                                         // Spare Rations
    ty_6_1:[ {on:'out',if:{auto:true,targetTeam:'enemy',stackMin:{mdStride:10}},more:R(0.03)} ],                  // Hand a Blur
    ty_6_4:[ {param:'cd.p',add:R(0.4)} ],                                                                           // Measured Line
    ty_5_4:[ {on:'out',if:{casting:GQ,targetTeam:'enemy'},more:R(0.03)} ],                                         // Second Throw
    ty_7_1:[ {stat:{aspd:1},per:{fn:'ef'}} ],                                                                       // Ever Faster (+15 points at the full ramp)
    ty_8_1:[ {stat:{lifesteal:R(0.002)},per:'mdStride'} ],                                                          // Old Habit
    ty_7_4:[ {param:'ql.ref',add:R(0.2)} ],                                                                         // Quill and Line (in myHit)
    ty_10_2:[ {param:'rg.gy',add:R(0.0015)} ],                                                                      // Grit of Years (in tk, the regeneration budget)
    ty_8_3:[ {on:'kill',dots:true,chance:R(0.1),do:[{stack:'mdProv',add:1}]} ],                                    // Foraging
    ty_8_4:[ {stat:{nrg:R(0.03)}} ],                                                                                // Swift Survey
    ty_9_2:[ {param:'dr.ir',add:R(0.015)} ],                                                                        // Iron Rations (in myDr)
    ty_9_3:[ {on:'lethal',once:'fight',if:{stackMin:{mdProv:1}},do:[{fn:'biscuit'}]} ],                           // Last Biscuit
    ty_9_4:[ {on:'hit',if:{casting:GQ,targetTeam:'enemy'},chance:R(0.2),do:[{fn:'strideAdd',n:1}]} ],              // Steady Trade
    ty_10_1:[ {param:'stride.max',add:R(1)} ],                                                                      // Endless Road (up to 15)
    ty_5_2:[ {param:'sit',add:1}, {param:'dr.sit',add:0.30} ],                                                     // Sit It Out (PICK ONE; in eat and myDr)
    ty_5_3:[ {param:'push',add:1}, {stat:{aspd:P('po.as',0.15)},if:{window:'mdPo'}} ],                             // Push On (PICK ONE; in eat)
    ty_6_2:[ {param:'sit.dur',add:R(0.5)} ],                                                                        // Camp Discipline
    ty_6_3:[ {param:'po.as',add:R(0.03)} ],                                                                         // Forced March
    ty_10_4:[ {on:'kit',skill:FE,opt:{mul:{more:R(0.01),per:{stack:'mdStride',div:2}}}} ],                        // Expedition Pace
    ty_11_1:[ {on:'out',if:{fn:'isFull'},critMore:R(0.02)} ],                                                      // Hand Never Tires (2% x 5: crit damage at most 10%)
    ty_11_3:[ {param:'prov.ally',add:R(0.01)} ],                                                                    // Well Provisioned (in eat)
    ty_11_4:[ {param:'rest',add:1} ],                                                                               // Charted Rest (in feCast)
    ty_12_1:[ {stat:{atk:R(0.015)},per:{fn:'cleared'}} ],                                                           // Steady Old Hand (up to 4)
    ty_12_2:[ {param:'ten.uc',add:R(0.03)} ],                                                                       // Unhurried Calm (in ten)
    ty_12_3:[ {param:'dr.sea',add:R(0.04)}, {on:'out',if:{targetTeam:'enemy',fn:'late'},more:R(0.04)} ],           // Seasoned
    ty_12_4:[ {on:'out',if:{casting:PL,targetTeam:'enemy'},more:R(0.005),per:{stack:'mdStride',max:10}} ],         // Plumb True
    ty_13_1:[ {param:'blur',add:1},                                                                                 // The Unhurried Hand (SIGNATURE)
              {on:'hit',if:{auto:true,targetTeam:'enemy',window:'mdBlur'},do:[{fn:'fan'}]},
              {on:'end:mdBlur',req:'ty_5_3',do:[{fn:'blurOn'}]} ]
  },
  fn:{
    /* ---- the counts rows read ---- */
    spent(A,T){ return S(T).spent||0; },
    gl(A,T){ return S(T).gl||0; },
    chAlive(A,T,u){ let n=0; for(const x of A.eng().units()) if(x.alive&&x.team!==u.team&&A.markOf(u,x,'mdCh')) n++; return Math.min(5,n); },
    cleared(A,T){ return Math.max(0,Math.min(4,(T.s.wave||1)-1)); },
    lh(A,T,u){ return full(A,u)?0.02*rk(T,'gi_10_3')/(1+cap(A,u)):0; },
    ef(A,T,u){ return full(A,u)?0.15/(1+cap(A,u)):0; },
    /* ---- conditions ---- */
    far6(A,T,u,c){ return gapM(A,u,c.tgt)>=6; },
    far8(A,T,u,c){ return gapM(A,u,c.tgt)>=8; },
    isFull(A,T,u){ return full(A,u); },
    late(A,T){ return A.eng().now()>=30; },
    isFar(A,T,u,c){ return !!c.tgt&&c.tgt===S(T).far; },
    ls(A,T,u){ return (u._lifestealT||0)>0; },
    discK(A,T,u,t){ if(!t||t.team===u.team||A.markOf(u,t,'mdDisc')) return 0; const P=T.P; return (T.s.wave<=1)?(P.disc||0):(P['disc.late']?(P.disc||0)*P['disc.late']:0); },   // a Discovery: the first wave, or Nothing Unknown's share of it later
    disc(A,T,u,c){ return T.fn.discK(A,T,u,c.tgt)>0; },
    discOut(A,T,u,c){ const k=T.fn.discK(A,T,u,c.tgt); if(k>0) c.amt*=1+k; },
    /* ---- each tick: Sightline, the ramp, the regeneration budget, eating, weaker shields, the blur's Quill ---- */
    tk(A,T,u,c){ const o=S(T), P=T.P, E=A.eng(), now=E.now(), dt=c.dt||0;
      if(rk(T,'ls_1_1')){ let near=false; if(!P['sight.held']){ for(const x of E.units()) if(x.alive&&x.team!==u.team&&!x._dropHidden&&A.gap(u,x)<4*E.METER()){ near=true; break; } }
        if(near){ A.stSet(T,u,'mdSight',0); o.sAcc=0; }
        else if(!(P['sight.held']&&now-(o.hurtAt==null?-9:o.hurtAt)<1)){ o.sAcc=(o.sAcc||0)+dt*(1+(P['sight.rate']||0)); while(o.sAcc>=1-1e-9){ o.sAcc-=1; A.stSet(T,u,'mdSight',A.stGet(T,'mdSight')+1); } if(A.stGet(T,'mdSight')>=A.stMax(T,u,'mdSight')) o.sAcc=0; } }
      if(P.ramp&&u.pass&&u.pass.momentum){ const m=cap(A,u); if((u._momStk||0)<m) u._momStk=Math.min(m,(u._momStk||0)+0.025*dt*P.ramp); }   // Warm Up, Well-Thumbed: the ramp that much faster
      if(P['rg.gy']||P['rg.dh']){ o.rgAcc=(o.rgAcc||0)+dt; if(o.rgAcc>=1-1e-9){ o.rgAcc-=1;                                   // Grit of Years + Draining Hand: once a second, together at most 1.2% of his max HP
          const r=(P['rg.gy']&&full(A,u)?P['rg.gy']:0)+(P['rg.dh']&&A.winOn(T,'mdFe')?P['rg.dh']:0); if(r>0) E.healUnit(u,Math.min(0.012,r)*u.maxHp); } }
      if(rk(T,'ty_1_3')){ if(u.hp>=0.5*u.maxHp) o.ate=false; else if(!o.ate&&!A.winOn(T,'mdBlur')&&A.stGet(T,'mdProv')>0){ o.ate=true; T.fn.eat(A,T,u,'low'); } }
      if(P['sh.ig']||P.ink){ const L=o.sh||(o.sh={});                                                                       // Indelible Gold, the Ink: a shield written on such an enemy is that much weaker
        for(const x of E.units()){ if(!x.alive||x.team===u.team) continue; const ch=P['sh.ig']&&A.markOf(u,x,'mdCh'), ik=P.ink&&A.markOf(u,x,'mdInk'), s=x.shield||0, was=L[x.uid];
          if((ch||ik)&&was!=null&&s>was+1e-9){ const k=(ch?1-P['sh.ig']:1)*(ik?0.5:1); x.shield=was+(s-was)*k; } L[x.uid]=x.shield||0; } }
      if(rk(T,'ty_13_1')&&A.winOn(T,'mdBlur')&&!(u.stunned>0)&&(u.greenCd||0)>0) T.fn.cdOff(A,T,u,'green',dt); },
    hurtMe(A,T,u){ S(T).hurtAt=A.eng().now(); },
    waveStart(A,T,u){ const o=S(T), P=T.P; o.api=A;   // the runtime's API kept for the 95% probe (tests read drK tick by tick; nothing in a fight reads it)
      if(T.s.wave>1){ A.stSet(T,u,'mdNote',Math.min(A.stGet(T,'mdNote'),P['note.keep']||0)); A.stSet(T,u,'mdStride',Math.min(A.stGet(T,'mdStride'),P['stride.keep']||0)); }
      if(rk(T,'ty_1_3')) A.stSet(T,u,'mdProv',A.stMax(T,u,'mdProv')); o.ate=false; o.blurW=-1;
      if(P['ramp.q']&&u.pass&&u.pass.momentum){ const m=cap(A,u)/4; if((u._momStk||0)<m) u._momStk=m; } },
    /* ---- Plumb Line ---- */
    plKit(A,T,u,c){ const o=S(T), P=T.P; o.fb=(c.o&&c.o.farBonus)||0.9; o.plRaw=0; o.spent=0;
      if(rk(T,'ls_1_1')){ const n=A.stGet(T,'mdSight'); o.spent=n; A.stSet(T,u,'mdSight',0); if(n>0&&P['pl.ref']) T.fn.cdOff(A,T,u,'blue',P['pl.ref']*n); } },
    plFar(A,T,u,c){ let b=null,bd=-1; for(const x of A.eng().units()) if(x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget){ const d=A.eng().dist(u,x); if(d>bd){ bd=d; b=x; } } if(b) c.tgt=b; },
    plNear(A,T,u,c){ const L=A.pick(T,u,{team:'enemy',n:1},c); if(L[0]) c.tgt=L[0]; },
    reach(A,T,u,c){ const o=S(T), M=A.eng().METER(), d=A.eng().dist(u,c.tgt), f0=Math.min(1,d/(8*M)), f1=Math.min(1,d/((8-(T.P['pl.reach']||0))*M)), fb=o.fb||0.9;
      c.amt*=(1+fb*f1)/(1+fb*f0); },
    farPoint(A,T,u,c){ const o=S(T), E=A.eng(), t=c.tgt, now=E.now(); if(!(o.spent>=5)||!t||now<(o.fpT||0)) return; o.fpT=now+15;
      if(t.alive) T.fn.triOn(A,T,u,{tgt:t}); const raw=o.plRaw||0;
      const L=E.units().filter(x=>x.alive&&x.team!==u.team&&x!==t&&!x._dropHidden&&!x._noTarget).sort((a,b)=>E.dist(u,b)-E.dist(u,a)).slice(0,2);
      L.forEach((x,i)=>{ const k=i===0?0.8:0.6; if(raw>0) A.acts(T,u,[{dmg:raw*k,def:'phys',on:'target'}],{u,src:u,tgt:x}); if(x.alive) T.fn.triOn(A,T,u,{tgt:x}); }); },
    /* ---- Golden Quill ---- */
    gqKit(A,T){ const o=S(T); o.qN=0; o.qNew=null; o.qHit=false; o.gl=0; o.far=null; },
    gqLine(A,T,u,c){ const o=S(T), t=c.tgt; if(!t) return; o.far=t; const W=(c.o&&c.o.width)||34, ux0=t.x-u.x, uy0=t.y-u.y, len=Math.hypot(ux0,uy0)||1, ux=ux0/len, uy=uy0/len; let n=0;
      for(const e of A.eng().units()){ if(!e.alive||e.team===u.team||e===t) continue; const rx=e.x-u.x, ry=e.y-u.y, p=rx*ux+ry*uy; if(p<-12||p>len+24||Math.abs(rx*uy-ry*ux)>W) continue; if(p<len) n++; }
      o.gl=n; },
    gqCast(A,T,u){ const o=S(T); if(rk(T,'ls_12_3')&&o.qN>0) A.acts(T,u,[{window:'mdUl',dur:4,n:o.qN}],{u}); },
    /* ---- his hits: Triangulation, Charted, Discovery, Stride, refunds ---- */
    myHit(A,T,u,c){ const o=S(T), P=T.P, t=c.tgt, cur=T.s.cur, now=A.eng().now();
      if(cur===GQ){ o.qN=(o.qN||0)+1;
        if(rk(T,'gi_1_1')&&!A.markOf(u,t,'mdCh')){ A.setMark(T,u,t,'mdCh',{}); if(!o.qNew) o.qNew=t; }
        if(P['tri.on']){ if(A.markOf(u,t,'mdPl')) T.fn.triOn(A,T,u,{tgt:t}); else A.setMark(T,u,t,'mdGq',{dur:(P.tfp&&o.qNew===t)?6:4}); }
        if(!o.qHit){ o.qHit=true; if(P['ql.ref']) T.fn.cdOff(A,T,u,'blue',P['ql.ref']); } }
      else if(cur===PL){ o.plRaw=Math.max(o.plRaw||0,(c.amt||0)/Math.max(0.05,A.eng().defMul(u,t,'phys')));
        if(P['ch.pl']&&!A.markOf(u,t,'mdCh')) A.setMark(T,u,t,'mdCh',{});
        if(rk(T,'gi_n1')&&A.markOf(u,t,'mdCh')) A.setMark(T,u,t,'mdPl1',{});
        if(P['tri.on']){ if(A.markOf(u,t,'mdGq')) T.fn.triOn(A,T,u,{tgt:t}); else A.setMark(T,u,t,'mdPl',{dur:4}); }
        if(rk(T,'ls_5_3')){ T.fn.cdOff(A,T,u,'green',1.5); if(P['dr.cc']) A.acts(T,u,[{window:'mdCc',dur:3}],{u}); } }
      if(P.disc&&t&&!A.markOf(u,t,'mdDisc')&&(T.s.wave<=1||P['disc.late'])){ A.setMark(T,u,t,'mdDisc',{}); A.stSet(T,u,'mdNote',A.stGet(T,'mdNote')+1); }
      else if(t&&!A.markOf(u,t,'mdDisc')) A.setMark(T,u,t,'mdDisc',{});
      if(P['stride.on']&&c.auto&&full(A,u)) T.fn.strideAdd(A,T,u,c,{n:1}); },
    triOn(A,T,u,c,a){ const t=c.tgt; if(!t||!t.alive||t.team===u.team) return; const d=((a&&a.dur)||4)+(T.P['tri.dur']||0);
      A.setMark(T,u,t,'mdTri',{dur:d,longest:true}); A.clearMark(u,t,'mdGq'); A.clearMark(u,t,'mdPl'); A.stSet(T,u,'mdGrid',A.stGet(T,'mdGrid')+1); },
    /* ---- Stride and the blur ---- */
    strideAdd(A,T,u,c,a){ const n0=A.stGet(T,'mdStride'); A.stSet(T,u,'mdStride',n0+((a&&a.n)||1)); T.fn.blurChk(A,T,u); },
    blurChk(A,T,u){ const o=S(T); if(!T.P.blur||o.blurW===T.s.wave) return; if(A.stGet(T,'mdStride')<A.stMax(T,u,'mdStride')-1e-9) return;
      o.blurW=T.s.wave; o.blurX=0; A.acts(T,u,[{window:'mdBlur',dur:8}],{u}); },
    blurOn(A,T,u){ const o=S(T); if((o.blurX||0)>=2||!(A.stGet(T,'mdProv')>0)||!u.alive) return; o.blurX=(o.blurX||0)+1; T.fn.eat(A,T,u,'blur'); A.acts(T,u,[{window:'mdBlur',dur:1.5}],{u}); },
    fan(A,T,u,c){ const amt=c.amt||0; if(!(amt>0)) return; for(const x of A.pick(T,u,{team:'enemy',n:3},c)) if(x!==c.tgt) A.acts(T,u,[{dmg:amt,on:'target'}],Object.assign({},c,{tgt:x})); },   // the three enemies nearest him: the attack's own target takes no second quill
    /* ---- Provisions ---- */
    eat(A,T,u,why){ const P=T.P, E=A.eng(); if(!(A.stGet(T,'mdProv')>0)) return false; A.stSet(T,u,'mdProv',A.stGet(T,'mdProv')-1);
      if(!P.push){ const h=(P['prov.heal']||0)*(1+(P['prov.more']||0))*u.maxHp; if(h>0) E.healUnit(u,h); }
      else { A.stSet(T,u,'mdStride',A.stMax(T,u,'mdStride')); A.acts(T,u,[{window:'mdPo',dur:5}],{u}); T.fn.blurChk(A,T,u); }
      if(P.sit) A.acts(T,u,[{window:'mdSit',dur:3+(P['sit.dur']||0)}],{u});
      if(P['prov.ally']){ const a=A.pick(T,u,{team:'ally',others:true,n:1},{u}); if(a[0]) E.healUnit(a[0],P['prov.ally']*u.maxHp); }
      return true; },
    biscuit(A,T,u,c){ if(u.hp<1) u.hp=1; c.stop=true; T.fn.eat(A,T,u,'biscuit'); },
    /* ---- Final Expedition ---- */
    feCast(A,T,u,c){ const o=S(T), P=T.P, E=A.eng(), now=E.now(), md=(c.o&&c.o.mortalDur)||3, ink=P.ink&&now>=(o.inkT||0);
      A.acts(T,u,[{window:'mdFe',dur:(c.o&&c.o.buffDur)||3}],{u}); if(ink) o.inkT=now+25;
      for(const x of E.units()){ if(!x.alive||x.team===u.team) continue; let fresh=false;
        for(const d of (x.dots||[])) if(d._talO===u.uid&&d._talK==='fs'&&!d._mdX){ d._mdX=1; fresh=true; const add=(P['fe.dur']||0)+((P['fe.set']&&charted(A,u,x))?P['fe.set']:0); if(add>0) A.acts(T,u,[{extendDot:add}],{u,dot:d}); }
        if(!fresh&&!(E.dist(u,x)<=30*E.METER())) continue;
        const add=(P['fe.dur']||0)+((P['fe.set']&&charted(A,u,x))?P['fe.set']:0); if(add>0) x.mortalT=Math.max(x.mortalT||0,md+add);
        if(P['fe.set']&&charted(A,u,x)) A.setMark(T,u,x,'mdSet',{dur:md+add,longest:true});
        if(ink&&charted(A,u,x)){ A.setMark(T,u,x,'mdInk',{dur:6}); if((x.shield||0)>0) x.shield*=0.5; } }
      if(P.rest){ if(rk(T,'ty_1_3')) A.stSet(T,u,'mdProv',A.stGet(T,'mdProv')+1); if(u.pass&&u.pass.momentum) u._momStk=Math.max(u._momStk||0,cap(A,u)); } },
    night(A,T,u){ let n=0; for(const x of A.eng().units()) if(x.alive&&x.team!==u.team&&A.markOf(u,x,'mdCh')) n++; if(n>0) u.energy=Math.min(100,(u.energy||0)+5*Math.min(5,n)); },
    thirst(A,T,u){ if((u._lifestealT||0)>0) u._lifestealT+=1; },
    runInk(A,T,u,c){ const pct=(u._lifestealT>0)?(u._lifestealPct||0):0, h=(c.hpLost||0)*pct*0.5*(1+(T.P['ri.more']||0)); if(!(h>0)) return;
      const a=A.pick(T,u,{team:'ally',others:true,order:'lowHp',n:99},c).sort((p,q)=>p.hp/p.maxHp-q.hp/q.maxHp)[0]; if(a) A.eng().healUnit(a,h); },
    /* ---- Windage ---- */
    wind(A,T,u,c){ const o=S(T); o.wind={t:c.tgt,until:A.eng().now()+5}; o.windSkip={t:c.tgt,at:A.eng().now()}; },   // the blocked hit itself (it lands on, halved) does not spend it
    windOut(A,T,u,c){ const o=S(T), w=o.wind, sk=o.windSkip; o.windSkip=null; if(sk&&sk.t===c.tgt&&sk.at===A.eng().now()) return;
      if(!w||w.t!==c.tgt||A.eng().now()>=w.until) return; o.wind=null; c.amt*=1+0.12*rk(T,'ls_n1'); },
    /* ---- cooldowns: Quiet Hands, Quill Rhythm, Sure Line, Measured Line; the refunds; never below the floors ---- */
    cdSet(A,T,u,c){ const o=S(T), P=T.P, now=A.eng().now(), sl=c.slot, off=sl==='green'?(P['cd.q']||0):(P['cd.p']||0), F=FLOOR[sl];
      if(off>0&&c.amt>F) c.amt=Math.max(F,c.amt-off); o[sl+'At']=now; },
    cdOff(A,T,u,slot,secs){ const o=S(T), f=slot==='blue'?'blueCd':'greenCd', cur=u[f]||0; if(!(cur>0)||!(secs>0)) return;
      const at=o[slot+'At'], lo=at==null?0:Math.max(0,FLOOR[slot]-(A.eng().now()-at)); u[f]=Math.max(Math.min(cur,lo),cur-secs); },
    /* ---- THE CRIT GROUP: at most 5% from all of them on any hit. The always part is a stat (critS); this hit's own part (Cross-Reference) is one more seeded roll ---- */
    critS(A,T){ const P=T.P; return Math.min(0.05,(P['crit.se']||0)+(P['crit.sp']||0)+(P['crit.mn']||0)*A.stGet(T,'mdNote')+(P['crit.ss']||0)*A.stGet(T,'mdSight')+(P['crit.pc']||0)*A.stGet(T,'mdStride')); },
    crit(A,T,u,c){ const o=S(T), P=T.P, t=c.tgt;
      if(P['pl.sure']&&T.s.cur===PL&&(o.spent||0)>=5){ c.force=true; return; }
      let p=0; if(P['crit.xr']&&T.fn.disc(A,T,u,c)) p+=P['crit.xr'];
      p=Math.min(p,Math.max(0,0.05-T.fn.critS(A,T))); if(!(p>0)||c.force) return;
      const base=Math.min(0.95,(u.glyphCrit||0)+((u._critBuffT||0)>0?(u._critBuffPct||0):0)); if(A.eng().rnd()<p/Math.max(0.05,1-base)) c.force=true; },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP: each multiplies, together at most 40% off a hit or a DoT tick ---- */
    drK(A,T,u,s){ const P=T.P; let k=1;
      if(P['dr.cc']&&A.winOn(T,'mdCc')) k*=1-P['dr.cc'];
      if(P['dr.si']&&s&&A.markOf(u,s,'mdSet')) k*=1-P['dr.si'];
      if(P['dr.qs']&&full(A,u)) k*=1-P['dr.qs'];
      if(P['dr.ir']&&u.hp<0.5*u.maxHp) k*=1-P['dr.ir'];
      if(P['dr.sit']&&A.winOn(T,'mdSit')) k*=1-P['dr.sit'];
      if(P['dr.sea']&&A.eng().now()>=30) k*=1-P['dr.sea'];
      return Math.max(0.60,k); },
    myDr(A,T,u,c){ const s=c.src; if(s&&s.team===u.team) return; c.amt*=T.fn.drK(A,T,u,s); },
    /* ---- HIS CONTROL SHORTENING, ONE GROUP: Gritted Teeth and Unhurried Calm together at most 20% ---- */
    ten(A,T,u,c){ const P=T.P; const x=Math.min(0.20,(P['ten.gt']||0)+((P['ten.uc']&&A.stGet(T,'mdProv')>0)?P['ten.uc']:0)); if(x>0) c.amt*=1-x; }
  },
  ruling:{},
  partial:{}
};
