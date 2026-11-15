/* LUMI - what her learned talents do in a fight (the mechanics; her plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Lumi")
   Her real kit (the code, not the tooltip wording; a back-row Support, her skills read ability power, her hits are magic):
   - Dawnward ('dawnward', green, cd 11): the ally with the lowest HP SHARE (the game's lowestAlly: Lumi herself on 37% of casts) cannot drop below 1 HP for
     3 s + 0.01 s a skill level (_wardT; 3.99 s at 100). No shield, no damage reduction. MEASURED: 100 casts in 20 seeded fights, 10 holds (a hit that would have
     killed left the unit at 1 HP).
   - Quickening ('haste', blue, cd 9): every ally (Lumi included) attacks faster: hasteMul 1.3 + 0.001 a level (x1.399 at 100) for 5 s (the larger one stays).
   - Radiant Nova (ultimate 'sunburst'; ULT_DEF mul 1.8, radius 6 m, heal 0.35; HERO_ULT_ART.lumi deliver 'form'): measured from HER CENTRE: every enemy within
     6 m takes 180% of her ability power (magic), every ally within 6 m (herself always) heals 35% of its max HP x skill level (healFrom). MEASURED: she stands
     about 15 m back; the enemy part reached an enemy on 16 of 94 casts (17%), the heal reached another ally on 76 of 94. Not changed here (open for Phil).
   - Hush (passive 'hush'): every 5 s one random living enemy (a seeded draw) is silenced 0.7 s x the passive's level multiplier (1.53 s at 100), written
     straight on (no ccApply); a silence breaks a cast under way (castTick). MEASURED: 244 silences, 46 on an enemy that was casting.
   Willing, the Watch, Long Night, Muffled, Voices, Sunblind, Kindled and Sunrise exist only through her talents.
   Readings, caps and corrected tooltips: WIRING/36 - LUMI - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const DW='dawnward', QK='haste', NOVA='sunburst';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const WL=['fm_1_2','fm_2_2','fm_3_2','fm_7_1','fm_8_1','fm_9_1','fm_7_3','fm_9_3','fm_11_3','fm_12_1','fm_12_3','fm_13_3'];        // Willing
const WT=['fm_2_3','fm_3_1','fm_4_3','fm_8_2','fm_10_2','fm_12_2','fm_11_3','fm_7_3'];                                            // the Watch
const LN=['fm_4_4','fm_8_4','fm_5_4','fm_10_4','fm_12_4'];                                                                       // Long Night
const DWM=['fm_3_2','fm_5_2','fm_5_1','fm_6_1','qh_11_2','fm_1_2'];                                                              // her Dawnward ward (mark 'dw', its end)
const MF=['qh_1_1','qh_2_1','qh_4_1','qh_6_1','qh_12_4','qh_9_3','qh_13_2','fl_n1'];                                             // Muffled
const VO=['qh_2_2','qh_4_2','qh_1_3','qh_11_1','qh_12_1','qh_7_2','qh_9_2','qh_13_2'];                                            // Voices
const HU=['qh_1_1','qh_2_3','qh_2_1','qh_2_2','qh_3_1','qh_5_2','qh_5_3','qh_5_4','qh_6_2','qh_6_3','qh_10_4','qh_4_4','qh_8_1','fm_11_3','fl_3_3','qh_13_2','qh_4_2','qh_12_1','qh_1_3','qh_11_1','qh_7_2','qh_9_2'];   // rows on Hush
const SB=['fl_1_3','fl_2_3','fl_n1','fl_3_3','fl_6_1','fl_6_3','fl_7_2','fl_8_1','fl_8_4','fl_9_2','fl_9_4','fl_10_2','fl_11_4','fl_13_2'];   // Sunblind
const KD=['fl_2_2','fl_4_2','fl_10_3','fl_12_3','fl_9_2','fl_7_2','fl_13_2','fl_11_2'];                                          // Kindled (her Quickening's mark)
const QKM=KD.concat(['fl_6_2','fl_6_4','qh_10_3','fl_11_1','fl_3_1']);                                                           // rows that need her Quickening's mark 'qk'
const SUN=['fl_4_1','fl_5_1','fl_8_1','fl_8_3','fl_10_1','fl_12_1','fl_13_2'];                                                   // Sunrise
/* her damage reduction (one capped group on HER: 40%) and the reductions her talents give her allies (one capped group on each ally: 25%) */
const DRME=['fm_7_4','fm_11_4','qh_8_4','qh_11_1','fl_3_1','fl_11_1','fl_11_4','qh_1_4'];
const DRT=['fm_2_3','fm_12_2','fm_1_2','fm_12_1','fm_5_2','qh_9_1','fl_6_2','qh_1_1','qh_4_1'];
const TOUT=['fm_1_2','fm_12_3','fm_12_1','fm_8_2','qh_6_2','fl_n1','fl_6_3','fl_9_2','fl_10_3','qh_6_1','fl_2_2','fl_4_2','fl_7_2','fl_13_2'];   // her team's hits on enemies
const TIN=DRT.concat(['fm_13_3','qh_11_2','fl_1_3','fl_9_4','fl_3_3','fl_n1']);                                                   // hits on her team
const TEN=['fm_1_1','fm_8_1'];                                                                                                    // controls on her: one cap (25%)
const HEALS=['fm_3_1','fm_7_1','fm_6_2','qh_1_3','fm_7_3'];                                                                     // her heals (Radiant Nova's, and her talents')
const TCAP=0.75, MCAP=0.60, CC_TALENT_CAP=4.0, KD_RATE=0.012;
const S=T=>T.s.lu||(T.s.lu={});                                     // her own per-fight state (one object: no name of the runtime's own is ever used)
const rk=(T,id)=>T.r[id]||0;
const mate=(u,x)=>!!x&&x.alive&&x.team===u.team&&!x._summon;       // a hero of her team (Lumi included), not a summon
const foe=(u,x)=>!!x&&x.team!==u.team;
const kindled=(A,u,x)=>!!(A.markOf(u,x,'qk')||A.markOf(u,x,'kd'));
const willing=(A,u,x)=>A.markOf(u,x,'wl')?1:(A.markOf(u,x,'wh')?0.5:0);   // Morning Gold: half of the bonuses for a while after it runs out
const team=(A,T,u)=>A.eng().units().filter(x=>mate(u,x)&&!x._dropHidden);
module.exports={
  hero:'lumi',
  times:['lu.kb.*.t'],   // this file's own absolute fight times (paths in T.s): the engine moves them back with the clock at each wave (WIRING/41c)
  casting:true,                         // rows ask which of her skills a hit / a heal comes from
  states:{
    vo:{max:P('vo.max',5),wave:'reset'},                            // Voices (kept for the wave; Kept Voices carries some into the next)
    sb:{unit:true,max:P('sb.max',5),dur:4}                          // Sunblind on enemies (its time is set at each gain: sbAdd)
  },
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                   // the Watch, Long Night, Sunrise, Muffled enemies' next skill, her reach, They Decide
    {on:'wave',do:[{fn:'wv'}]}, {on:'waveEnd',reqAny:VO,do:[{fn:'wvEnd'}]},
    {on:'kit',skill:DW,reqAny:DWM,do:[{fn:'dwKit'}]}, {on:'cast',skill:DW,reqAny:DWM,do:[{fn:'dwCast'}]},         // her Dawnward: the warded ally (mark 'dw' while it holds)
    {on:'dwEnd',reqAny:['fm_3_2','fm_6_1'],do:[{fn:'dwEnd'}]},
    {on:'cast',skill:QK,reqAny:QKM,do:[{fn:'qkCast'}]},                                                            // her Quickening: the allies under it (mark 'qk')
    {on:'kit',skill:NOVA,do:[{fn:'nvKit'}]}, {on:'hit',if:{casting:NOVA,targetTeam:'enemy'},do:[{fn:'nvHit'}]}, {on:'cast',skill:NOVA,do:[{fn:'nvCast'}]},
    {on:'healOut',skill:NOVA,reqAny:HEALS.concat(['fm_7_3']),do:[{fn:'nHeal'}]},
    {on:'healed',skill:NOVA,reqAny:['fm_7_3','fl_11_2'],do:[{fn:'nHealed'}]},
    {on:'skillTgt',skill:'hush',reqAny:['qh_5_2','qh_5_3','fl_3_3'],do:[{fn:'hushTgt'}]},
    {on:'num',skill:'hushP',reqAny:['qh_4_4','qh_13_2'],do:[{fn:'hushP'}]},
    {on:'num',skill:'hushD',reqAny:['qh_2_3','qh_5_2','qh_6_3','qh_8_1'],do:[{fn:'hushD'}]},
    {on:'pass',skill:'hush',reqAny:HU,do:[{fn:'hush'}]},
    {on:'huEnd',reqAny:['qh_1_1'],do:[{fn:'huEnd'}]},
    {on:'wlEnd',reqAny:['fm_12_1'],do:[{fn:'wlEnd'}]},
    {on:'teamIn',reqAny:TIN.concat(TOUT),do:[{fn:'tIn'}]},                                                         // hits on her team (misses, reductions, Quiet Ward, the bind), and her team's hits (bonuses, Kindled, Spread Light)
    {on:'in',reqAny:TIN.concat(DRME),do:[{fn:'myIn'}]},                                                            // hits on her: the same, and her own group
    {on:'out',reqAny:TOUT.concat(['qh_7_2']),if:{targetTeam:'enemy'},do:[{fn:'myOut'}]},
    {on:'hit',reqAny:['fl_1_3','fl_7_2','fl_2_2','fl_4_2'],if:{targetTeam:'enemy'},do:[{fn:'myHit'}]},           // her basic attacks: Low Sun; her hits under her Quickening: Spread Light, Kindled
    {on:'teamHeal',reqAny:['fm_4_3','fl_12_3','qh_12_4'],do:[{fn:'tHeal'}]}, {on:'healMe',reqAny:['fm_4_3','fl_12_3'],do:[{fn:'tHeal'}]},
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]}, {on:'teamCc',reqAny:['fm_8_1','qh_8_1'],do:[{fn:'tCc'}]},
    {stat:{apow:1},reqAny:['qh_2_2'],per:{fn:'voAp'}},
    {stat:{aspd:1},to:{team:'ally'},reqAny:SUN,per:{fn:'sunN'}}                                                    // Sunrise: her team attacks faster
  ],
  talents:{
    /* ============================== THE FOURTH MORNING ============================== */
    fm_1_1:[ {param:'ten.gc',add:R(0.05)} ],                                                                        // Grey Composure (in ten: with Siege Nerves at most 25%)
    fm_1_2:[ {param:'wl.k',add:R(0.015)} ],                                                                         // Willing Heart (Willing on the ally her Dawnward wards: dwCast)
    fm_3_4:[ {on:'kit',skill:DW,opt:{dur:{add:R(0.1)}}} ],                                                          // Long Ward
    fm_2_2:[ {param:'wl.dur',add:R(1)} ],                                                                           // Stubborn Hope (every Willing)
    fm_2_3:[ {param:'wt.k',add:R(0.01)} ],                                                                          // Keep Watch (the Watch: tk / watchMove)
    fm_3_1:[ {param:'hl.wt',add:R(0.02)} ],                                                                         // First Gold (her heals on the Watched ally)
    fm_3_2:[ {param:'ny',add:1} ],                                                                                  // Not Yet (dwEnd)
    fm_4_3:[ {param:'wt.hr',add:R(0.03)} ],                                                                         // Close Watch (tHeal)
    fm_4_1:[ {on:'kit',skill:QK,opt:{dur:{add:R(0.3)}}} ],                                                          // Bright Haste
    fm_5_2:[ {param:'dr.dc',add:R(0.02)} ],                                                                         // Dawn Chill (the allies' group)
    fm_4_4:[ {param:'ln.k',add:R(0.005)} ],                                                                         // The Long Night (tk: lnTick)
    fm_8_4:[ {param:'ln.fast',add:R(0.2)} ],                                                                        // Night Long
    fm_6_2:[ {param:'nv.heal',add:R(0.02)} ],                                                                       // Steady Dawn (nHeal)
    fm_5_4:[ {param:'ln.max',add:R(1)} ],                                                                           // Longer Nights
    fm_7_1:[ {param:'hl.cs',add:R(0.02)} ],                                                                         // Clear Sky (her heals while any ally is Willing)
    fm_8_1:[ {param:'ten.sn',add:R(0.05)} ],                                                                        // Siege Nerves (ten, tCc)
    fm_6_4:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.03)}, {on:'cd',skill:'green',add:R(-0.5)} ],                    // Sleepless (RISK)
    fm_9_1:[ {param:'td',add:1} ],                                                                                  // They Decide (tk)
    fm_7_3:[ {param:'fmn',add:1} ],                                                                                 // Fourth Morning Nova (nHeal, nHealed)
    fm_7_4:[ {param:'dr.tf',add:R(0.01)} ],                                                                         // Thin Frost (her group)
    fm_5_1:[ {on:'kit',skill:DW,opt:{dur:{add:-1}}}, {param:'htw',add:1} ],                                          // Hold the Wall (PICK ONE: dwCast)
    fm_5_3:[ {on:'kit',skill:DW,opt:{dur:{add:1.5}}} ],                                                             // Light the Road (PICK ONE)
    fm_9_3:[ {param:'wl.nova',add:R(0.6)} ],                                                                        // Morning Chorus (needs Fourth Morning Nova)
    fm_8_2:[ {param:'wt.dmg',add:R(0.01)} ],                                                                        // Last Watchfire
    fm_6_1:[ {param:'sts',add:R(0.02)} ],                                                                           // Shoulder to Shoulder (needs Hold the Wall; dwEnd)
    fm_6_3:[ {on:'cd',skill:'green',add:R(-0.4)} ],                                                                 // Long Road (needs Light the Road)
    fm_10_2:[ {param:'wt.p',add:R(-0.3)} ],                                                                         // Watchful
    fm_10_3:[ {on:'kit',skill:NOVA,opt:{radius:{addM:R(0.4)}}} ],                                                   // Nova Reach
    fm_10_4:[ {param:'ln.nrg',add:R(2)} ],                                                                          // Sunward
    fm_11_1:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                                // Patient Light
    fm_11_3:[ {param:'qc',add:1} ],                                                                                 // Quiet Courage (hush)
    fm_11_4:[ {param:'dr.mg',add:R(0.01)} ],                                                                        // Morning Guard (her group)
    fm_12_1:[ {param:'wl.gold',add:R(1)} ],                                                                         // Morning Gold (wlEnd)
    fm_12_2:[ {param:'wt.k2',add:R(0.004)} ],                                                                       // Watchtower (points)
    fm_12_3:[ {param:'wl.dmg2',add:R(0.005)} ],                                                                     // Willing Hearts (points)
    fm_12_4:[ {param:'ln.k2',add:R(0.002)} ],                                                                       // Daylong (points of max HP per stack)
    fm_13_3:[ {param:'thw',add:1} ],                                                                                // Three Hundred Willing (SIGNATURE: nvCast, tIn / myIn)

    /* ============================== THE QUIET HOUR ============================== */
    qh_1_1:[ {param:'mf.k',add:R(0.04)} ],                                                                          // Soft Hands (Muffled when Hush ends: huEnd; its next skill: tk / tIn)
    qh_2_3:[ {param:'hu.d',add:R(0.1)} ],                                                                           // Early Quiet (hushD)
    qh_1_4:[ {param:'dr.uh',add:R(0.10)} ],                                                                         // Unhurried (her group: the first skill that hits her each wave)
    qh_2_1:[ {param:'mf.cd',add:R(0.3)} ],                                                                          // Thick Muffle (needs Soft Hands; tk)
    qh_2_2:[ {param:'vo.ap',add:R(0.006)} ],                                                                        // Taken Voices (hush; the stat: voAp)
    qh_3_1:[ {param:'hu.sw',add:1} ],                                                                               // Swallowed Word (hush)
    qh_1_3:[ {param:'nv.voh',add:R(0.005)} ],                                                                       // Soft Light (nHeal: per Voice held at the cast)
    qh_3_4:[ {on:'out',if:{casting:NOVA,targetTeam:'enemy'},more:R(0.02)} ],                                        // Brighter Nova
    qh_4_2:[ {param:'vo.max',add:R(1)} ],                                                                           // Hoard of Voices
    qh_4_1:[ {param:'mf.auto',add:R(0.01)} ],                                                                       // Dull Blows (tIn / myIn)
    qh_4_4:[ {param:'hu.p',add:R(-0.2)} ],                                                                          // Early Hours (hushP)
    qh_5_1:[ {on:'cd',skill:'green',less:R(0.01)}, {on:'cd',skill:'blue',less:R(0.01)}, {stat:{nrg:R(0.01)}} ],     // Quiet Mind (her ultimate: energy that much faster)
    qh_5_2:[ {param:'hu.one',add:1}, {param:'hu.d',add:0.5} ],                                                      // One Voice (PICK ONE: hushTgt, hushD)
    qh_5_3:[ {param:'hu.many',add:1} ],                                                                             // Many Voices (PICK ONE: hushTgt, hush)
    qh_5_4:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'hu'}} ],                                                   // Still Air (needs Early Hours)
    qh_6_1:[ {param:'mf.echo',add:R(0.01)} ],                                                                       // Hollow Echo (tIn / myOut)
    qh_6_2:[ {param:'nv.k',add:R(0.04)} ],                                                                          // Named Voice (needs One Voice; hush)
    qh_6_3:[ {param:'hu.md',add:R(0.15)} ],                                                                         // Hush of Many (needs Many Voices; hushD)
    qh_6_4:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.02)}, {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.04)} ],   // Thin Walls (RISK)
    qh_7_1:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.02)} ],                                        // Pale Edge
    qh_7_2:[ {param:'nov',add:1} ],                                                                                 // Nova of Voices (nvKit / nvOut / nvCast)
    qh_8_1:[ {param:'sil.k',add:R(0.03)}, {on:'ccOut',if:{cc:['silencedT']},more:R(0.03)} ],                        // Lingering Hush (hers: ccOut and hushD; her allies': tCc)
    qh_8_3:[ {on:'kit',skill:NOVA,opt:{radius:{addM:R(0.3)}}} ],                                                    // Lightfall
    qh_8_4:[ {param:'dr.un',add:R(0.03)} ],                                                                         // Unheard (her group)
    qh_9_1:[ {param:'dr.qp',add:0.08} ],                                                                            // The Quietest Part (both groups)
    qh_9_2:[ {param:'nv.ev',add:R(0.01)} ],                                                                         // Every Voice (needs Nova of Voices)
    qh_9_3:[ {on:'out',if:{casting:NOVA,targetTeam:'enemy',fn:'quietTgt'},more:R(0.03)} ],                          // Dawn Edge
    qh_10_3:[ {stat:{cdRate:R(0.01)},to:{team:'ally',has:'qk'}} ],                                                  // Whispered Haste
    qh_10_4:[ {param:'hu.drain',add:R(3)} ],                                                                        // Stolen Breath (hush)
    qh_11_1:[ {param:'dr.vo',add:R(0.015)} ],                                                                       // Daylit Calm (her group)
    qh_11_2:[ {param:'qw',add:0.5} ],                                                                               // Quiet Ward (tIn / myIn)
    qh_7_4:[ {on:'out',if:{auto:true,targetTeam:'enemy',fn:'silTgt'},more:R(0.03)} ],                               // Dim Morning
    qh_12_1:[ {param:'vo.keep',add:R(1)} ],                                                                         // Kept Voices (wvEnd / wv)
    qh_12_2:[ {param:'qw',add:R(0.1)} ],                                                                            // Hush of Dawn (needs Quiet Ward)
    qh_10_1:[ {on:'kit',skill:DW,opt:{dur:{add:R(0.2)}}} ],                                                         // Frostless
    qh_12_4:[ {param:'mf.heal',add:R(0.03)} ],                                                                      // Sealed Lips (tHeal)
    qh_13_2:[ {param:'std',add:1} ],                                                                                // The Street at Dawn (SIGNATURE: nvKit / nvCast, hushP)

    /* ============================== FIRST LIGHT RUNNING ============================== */
    fl_2_1:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{fn:'daybright'}]} ],                                 // Daybright
    fl_1_3:[ {param:'sb.k',add:R(0.006)} ],                                                                         // Low Sun (Sunblind: myHit, nvHit; misses: tIn / myIn)
    fl_1_4:[ {param:'rng',add:R(0.03)} ],                                                                           // Bright Eyes (tk)
    fl_2_2:[ {param:'kd.k',add:R(0.003)} ],                                                                         // Kindling (kheal: within 1.2% of max HP a second)
    fl_2_3:[ {param:'sb.dur',add:R(1)} ],                                                                           // Blinding (needs Low Sun)
    fl_n1:[  {param:'sq',add:0.03} ],                                                                               // Squint (LINK: with Soft Hands also Muffled)
    fl_3_1:[ {param:'dr.lf',add:R(0.02)} ],                                                                         // Lightfoot (her group; the window: qkCast)
    fl_4_2:[ {param:'kd.k',add:R(0.001)} ],                                                                         // Bright Kindling (needs Kindling)
    fl_3_3:[ {param:'hu.sun',add:1} ],                                                                              // Sun in the Eyes (hushTgt; misses: tIn / myIn)
    fl_3_4:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.03)} ],                                           // Early Bird
    fl_4_1:[ {param:'sun.k',add:R(0.01)} ],                                                                         // Count to Sunrise (tk, sunN)
    fl_5_2:[ {on:'kit',skill:QK,opt:{dur:{add:3},mul:{add:-0.1}}} ],                                                 // Slow Dawn (PICK ONE: points)
    fl_4_4:[ {on:'kit',skill:QK,opt:{dur:{add:R(0.3)}}} ],                                                          // Brisk
    fl_5_4:[ {on:'kit',skill:QK,opt:{dur:{add:-1},mul:{add:0.1}}} ],                                                 // Racing Dawn (PICK ONE: points, 1 s shorter)
    fl_5_1:[ {param:'sun.at',add:R(-1.5)} ],                                                                        // Early Sunrise
    fl_6_2:[ {param:'dr.lm',add:R(0.02)} ],                                                                         // Long Morning (needs Slow Dawn; the allies' group)
    fl_5_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ],                                                                  // Morning Rush
    fl_6_4:[ {stat:{move:R(0.04)},to:{team:'ally',has:'qk'}} ],                                                     // Daybreak Dash (needs Racing Dawn)
    fl_6_1:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.03)}, {param:'sb.max',add:R(1)} ],                               // Sunburnt (RISK)
    fl_10_1:[ {param:'sun.nrg',add:R(5)} ],                                                                         // Daybreak Energy
    fl_6_3:[ {param:'whh',add:R(0.01)} ],                                                                           // White Heat (tIn / myOut)
    fl_7_2:[ {param:'spl',add:1} ],                                                                                 // Spread Light (tIn / myHit)
    fl_7_4:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.02)} ],                                        // Gold Edge
    fl_8_1:[ {param:'sb.noon',add:R(1)} ],                                                                          // Hot Noon
    fl_8_3:[ {on:'cd',skill:'green',if:{window:'sun'},less:R(0.01)}, {on:'cd',skill:'blue',if:{window:'sun'},less:R(0.01)}, {stat:{nrg:R(0.01)},if:{window:'sun'}} ],   // Midmorning
    fl_8_4:[ {stat:{aspd:R(-0.005)},to:{team:'enemy',ust:{sb:1}},per:{ust:'sb'}} ],                                 // Dazzle
    fl_9_1:[ {on:'out',if:{casting:NOVA,targetTeam:'enemy'},more:R(0.02)} ],                                        // Bright Morning
    fl_9_2:[ {param:'gb',add:R(0.01)} ],                                                                            // Glinting Blades (needs Spread Light)
    fl_9_4:[ {param:'wo',add:1} ],                                                                                  // Whiteout (needs Dazzle; sbAdd)
    fl_10_2:[ {param:'sb.nova',add:R(1)} ],                                                                         // Blinding Nova (nvHit)
    fl_10_3:[ {param:'kd.dmg',add:R(0.01)} ],                                                                       // Sunlit Ranks
    fl_11_1:[ {param:'dr.bf',add:R(0.01)} ],                                                                        // Bright Footing (her group)
    fl_11_2:[ {param:'db',add:1} ],                                                                                 // Dawn Burst (nHealed)
    fl_11_4:[ {param:'dr.sw',add:R(0.015)} ],                                                                       // Sun-Warmed (her group)
    fl_12_1:[ {param:'sun.k2',add:R(0.01)} ],                                                                       // Long Day (points)
    fl_12_2:[ {param:'db.dur',add:R(0.4)} ],                                                                        // Second Morning (needs Dawn Burst)
    fl_12_3:[ {param:'kd.hr',add:R(0.02)} ],                                                                        // Kindling Heat (tHeal)
    fl_13_2:[ {param:'sun.sig',add:1} ]                                                                             // The Sun Clears the Wall (SIGNATURE: nvHit / nvCast)
  },
  needs:{ fm_3_2:'fm_1_2', fm_6_1:'fm_5_1', fm_6_3:'fm_5_3', fm_9_3:'fm_7_3', qh_2_1:'qh_1_1', qh_6_2:'qh_5_2', qh_6_3:'qh_5_3', qh_9_2:'qh_7_2', qh_12_2:'qh_11_2', fl_2_3:'fl_1_3', fl_4_2:'fl_2_2',
          fl_6_2:'fl_5_2', fl_6_4:'fl_5_4', fl_9_2:'fl_7_2', fl_12_2:'fl_11_2', qh_5_4:'qh_4_4' },
  fn:{
    /* ---- EACH TICK ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), r=T.r, P=T.P, now=E.now(), dt=c.dt||0;
      if(o.f==null) o.f={wt:WT.some(id=>r[id]), ln:LN.some(id=>r[id]), sun:SUN.some(id=>r[id]), td:!!P.td, rng:P.rng>0};
      const f=o.f;
      if(f.rng){ if(o.rg0==null) o.rg0=u.range; u.range=o.rg0*(1+P.rng); }                                        // Bright Eyes: her attack range
      let sil=false; for(const x of E.units()) if(x.alive&&x.team!==u.team&&(x.silencedT||0)>0){ sil=true; break; } o.sil=sil;   // any enemy silenced now (The Quietest Part)
      if(f.wt){ o.wtA=(o.wtA||0)+dt; const p=Math.max(0.5,3+(P['wt.p']||0)); if(o.wtA>=p-1e-9){ o.wtA=0; T.fn.watchMove(A,T,u); } }
      if(f.ln) T.fn.lnTick(A,T,u,dt);
      if(f.sun&&o.sunAt!=null&&!o.sunUp&&now>=o.sunAt-1e-9) T.fn.sunrise(A,T,u,c);
      if(o.mfL&&o.mfL.length) T.fn.mfScan(A,T,u);
      if(f.td){ const td=o.td||(o.td={}); for(const x of team(A,T,u)){ const low=x.hp<0.2*x.maxHp, k=x.uid, e=td[k]||(td[k]={was:false,w:-1});
          if(low&&!e.was&&e.w!==T.s.wave&&A.markOf(u,x,'wl')){ e.w=T.s.wave; T.fn.decide(A,T,u,x); } e.was=low; } } },
    wv(A,T,u,c){ const o=S(T), E=A.eng(), P=T.P;
      if(o.f&&o.f.wt||WT.some(id=>T.r[id])){ o.wtA=0; T.fn.watchMove(A,T,u); }
      if(SUN.some(id=>T.r[id])){ o.sunUp=false; o.sunAt=E.now()+Math.max(0,20+(P['sun.at']||0)); A.acts(T,u,[{window:'sun',end:true},{window:'sd2',end:true}],c); }
      if((o.keepV||0)>0) A.acts(T,u,[{stack:'vo',atLeast:o.keepV}],c); o.keepV=0; },
    wvEnd(A,T){ const o=S(T); o.keepV=Math.min(A.stGet(T,'vo'),T.P['vo.keep']||0); },
    /* ---- THE WATCH: the ally with the lowest HP share (the game's own pick, as Dawnward makes it; Lumi included); every 3 s (Watchful sooner) ---- */
    watchMove(A,T,u){ const x=A.eng().lowestAlly(u); if(x) A.setMark(T,u,x,'wt',{unique:true}); },
    /* ---- LONG NIGHT: each ally below 50% gains a stack each second (Night Long sooner; max 5, Longer Nights more); climbing back above 50% pays them out ---- */
    lnTick(A,T,u,dt){ const o=S(T), P=T.P, ln=o.ln||(o.ln={}), per=Math.max(0.2,1-(P['ln.fast']||0)), mx=5+(P['ln.max']||0);
      for(const x of team(A,T,u)){ const e=ln[x.uid]||(ln[x.uid]={a:0,n:0});
        if(x.hp<0.5*x.maxHp){ e.a+=dt; while(e.a>=per-1e-9&&e.n<mx){ e.a-=per; e.n++; } if(e.n>=mx) e.a=0; }
        else { if(e.n>0){ const k=e.n*((P['ln.k']||0)+(P['ln.k2']||0)); if(k>0) T.fn.lheal(A,T,u,x,k*x.maxHp); if(P['ln.nrg']) x.energy=Math.min(100,(x.energy||0)+P['ln.nrg']); }
          e.n=0; e.a=0; } } },
    /* ---- SUNRISE: each wave 20 s after its start (Early Sunrise sooner) the sun is up for the rest of the wave ---- */
    sunrise(A,T,u,c){ const o=S(T), P=T.P; o.sunUp=true; A.acts(T,u,[{window:'sun',dur:'wave'}],c);
      if(P['sun.nrg']) for(const x of team(A,T,u)) x.energy=Math.min(100,(x.energy||0)+P['sun.nrg']); },
    sunN(A,T,u){ if(!A.winOn(T,'sun')) return 0; const k=(T.P['sun.k']||0)+(T.P['sun.k2']||0); return A.winOn(T,'sd2')?2*k:k; },
    voAp(A,T){ return (T.P['vo.ap']||0)*A.stGet(T,'vo'); },
    /* ---- HER HEALS: Radiant Nova's (healOut) and her talents' own heals (lheal): First Gold on the Watched ally, Clear Sky while any ally is Willing ---- */
    heK(A,T,u,x){ const P=T.P; let k=1; if(P['hl.wt']&&A.markOf(u,x,'wt')) k*=1+P['hl.wt'];
      if(P['hl.cs']&&team(A,T,u).some(y=>A.markOf(u,y,'wl'))) k*=1+P['hl.cs']; return k; },
    lheal(A,T,u,x,amt){ if(!x||!x.alive||!(amt>0)) return; A.eng().healUnit(x,amt*T.fn.heK(A,T,u,x)); },
    nHeal(A,T,u,c){ const o=S(T), P=T.P, x=c.tgt; let k=T.fn.heK(A,T,u,x)*(1+(P['nv.heal']||0))*(1+(P['nv.voh']||0)*(o.nvN||0));
      if(P.fmn&&A.markOf(u,x,'wt')) k*=1.30; c.amt*=k; },
    nHealed(A,T,u,c){ const P=T.P, x=c.tgt; if(!mate(u,x)) return;
      if(P.fmn) T.fn.willing(A,T,u,x,8+(P['wl.dur']||0)+(P['wl.nova']||0));
      if(P.db){ const q=T.fn.qkNow(A,T,u), d=q.dur+(P['db.dur']||0); A.buffOn(x,'haste',(q.mul-1)/2,d); T.fn.qkMark(A,T,u,x,d); } },   // a stronger haste already running stays
    /* ---- WILLING ---- */
    willing(A,T,u,x,d){ if(!mate(u,x)||!(d>0)) return; A.acts(T,u,[{mark:'wl',on:'unit',dur:d,ends:'wlEnd',longest:true}],{u,unit:x,tgt:x}); },
    wlEnd(A,T,u,c){ const x=c.tgt, d=T.P['wl.gold']||0; if(x&&x.alive&&d>0&&!A.markOf(u,x,'wl')) A.setMark(T,u,x,'wh',{dur:d}); },
    decide(A,T,u,x){ for(const f of ['stunned','fearT','silencedT','_sleepT','slow']) if((x[f]||0)>0) x[f]=0;
      T.fn.willing(A,T,u,x,8+(T.P['wl.dur']||0)); },                                                             // starts again (the longer time stays)
    /* ---- DAWNWARD ---- */
    dwKit(A,T,u){ const o=S(T); o.dwT=A.eng().lowestAlly(u); },
    dwCast(A,T,u,c){ const o=S(T), P=T.P, t=o.dwT; o.dwT=null; if(!t||!t.alive||!((t._wardT||0)>0)) return; const L=[t];
      if(P.htw){ let b=null,bp=1e9; for(const x of A.eng().units()){ if(!x.alive||x.team!==u.team||x===t||x._dropHidden||x._noTarget||(x._vpT||0)>0||(x._riseT||0)>0) continue; const p=x.hp/x.maxHp; if(p<bp){ bp=p; b=x; } }
        if(b){ b._wardT=Math.max(b._wardT||0,t._wardT); L.push(b); } }
      const qw=o.qw||(o.qw={});
      for(const x of L){ A.acts(T,u,[{mark:'dw',on:'unit',dur:x._wardT,while:'_wardT',ends:'dwEnd'}],{u,unit:x,tgt:x}); qw[x.uid]=[];
        if(rk(T,'fm_1_2')) T.fn.willing(A,T,u,x,8+(P['wl.dur']||0)); } },
    dwEnd(A,T,u,c){ const P=T.P, x=c.tgt; if(!x||!x.alive) return; if(P.ny&&A.markOf(u,x,'wl')) T.fn.lheal(A,T,u,x,0.15*x.maxHp); if(P.sts) T.fn.lheal(A,T,u,x,P.sts*x.maxHp); },
    /* ---- QUICKENING: the allies it reaches carry her mark 'qk' for its time (Kindled; Spread Light; Whispered Haste; Daybreak Dash; Long Morning) ---- */
    qkCast(A,T,u,c){ const d=(c.o&&c.o.dur)||5; for(const x of team(A,T,u)) if((x.hasteT||0)>0) T.fn.qkMark(A,T,u,x,d);
      if(T.P['dr.lf']) A.acts(T,u,[{window:'lf',dur:3}],c); },
    qkMark(A,T,u,x,d){ A.setMark(T,u,x,'qk',{dur:d,longest:true}); },
    qkNow(A,T,u){ const E=A.eng(), b=u.blueAb||{}, lv=(u.skillLv&&u.skillLv[2])||1; let mul=b.mul||1.3, dur=b.dur||5;
      if(rk(T,'fl_5_2')){ dur+=3; mul-=0.1; } if(rk(T,'fl_5_4')){ dur-=1; mul+=0.1; } dur+=0.3*(rk(T,'fm_4_1')+rk(T,'fl_4_4'));
      return {mul:E.skLvNum?E.skLvNum('haste',Object.assign({},b,{mul}),lv):mul, dur}; },
    /* ---- RADIANT NOVA ---- */
    nvKit(A,T,u){ const o=S(T); o.nvN=A.stGet(T,'vo'); o.nvFull=o.nvN>0&&o.nvN>=A.stMax(T,u,'vo')-1e-9; o.nvHit=0; o.nvHard=null; o.nvHardA=0; },
    nvHit(A,T,u,c){ const o=S(T), P=T.P, t=c.tgt; o.nvHit=(o.nvHit||0)+1; if((c.amt||0)>o.nvHardA&&t.alive){ o.nvHardA=c.amt; o.nvHard=t; }
      if(!t.alive) return;
      if(P['sun.sig']) T.fn.sbAdd(A,T,u,t,0,5);
      else if(SB.some(id=>T.r[id])) T.fn.sbAdd(A,T,u,t,(P['sb.k']>0?1:0)+(P['sb.nova']||0)); },
    nvOut(A,T,u,c){ const o=S(T), P=T.P; if(P.nov&&o.nvN>0) c.amt*=1+(0.10+(P['nv.ev']||0))*o.nvN; },
    nvCast(A,T,u,c){ const o=S(T), P=T.P, E=A.eng();
      if(P.std&&o.nvFull){ for(const x of E.units()) if(x.alive&&x.team!==u.team&&!x._dropHidden){ A.control(T,u,x,'silencedT',2); A.setMark(T,u,x,'mf',{}); T.fn.mfAdd(A,T,u,x); }
        A.acts(T,u,[{window:'std',dur:5}],c); u._hushT=1; A.stSet(T,u,'vo',0); }   // Hush at once, then every second: 5 in the 5 s
      if(P.nov&&o.nvN>0&&o.nvHit>0){ const h=o.nvHard; if(h&&h.alive) A.control(T,u,h,'silencedT',Math.min(CC_TALENT_CAP,0.3*o.nvN)); A.stSet(T,u,'vo',0); }
      if(P.thw){ for(const x of team(A,T,u)) T.fn.willing(A,T,u,x,10+(P['wl.dur']||0)); A.acts(T,u,[{window:'thw',dur:10}],c); }
      if(P['sun.sig']){ if(!o.sunUp) T.fn.sunrise(A,T,u,c); A.acts(T,u,[{window:'sd2',dur:8}],c); for(const x of team(A,T,u)) A.setMark(T,u,x,'kd',{dur:8,longest:true}); }
      o.nvN=0; o.nvHard=null; },
    /* ---- HUSH ---- */
    hushTgt(A,T,u,c){ const o=S(T), P=T.P, L=(c.o&&c.o.list)||[]; o.hc=(o.hc||0)+1; o.dbl=!!P['hu.many']&&o.hc%3===0;
      if(P['hu.one']){ let b=null; for(const x of L) if(x.alive&&(!b||(x.apow||0)>(b.apow||0))) b=x; if(b) c.tgt=b; return; }
      if(P['hu.sun']){ let b=null,bn=0; for(const x of L){ const n=A.ustGet(T,u,x,'sb'); if(x.alive&&n>bn){ bn=n; b=x; } } if(b) c.tgt=b; } },
    hushP(A,T,u,c){ if(A.winOn(T,'std')){ c.amt=1; return; } c.amt=Math.max(1,c.amt+(T.P['hu.p']||0)); },
    hushD(A,T,u,c){ const o=S(T), P=T.P; c.amt=Math.min(CC_TALENT_CAP,c.amt*(1+(P['sil.k']||0))+(P['hu.d']||0)+(o.dbl?(P['hu.md']||0):0)); },
    hush(A,T,u,c){ const o=S(T), P=T.P, e=c.tgt; if(!e) return; const L=[e];
      if(o.dbl){ o.dbl=false; const F=A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget&&!((x._riseT||0)>0)&&x!==e);
        if(F.length){ const x=F[Math.floor(A.eng().rnd()*F.length)%F.length]; x.silencedT=Math.max(x.silencedT||0,e.silencedT||0); L.push(x); } }
      for(const x of L) T.fn.hushOne(A,T,u,x); },
    hushOne(A,T,u,x){ const o=S(T), P=T.P, E=A.eng(); if(!x||!x.alive) return;
      if(P['hu.sw']&&x._pend&&x._pend.spell){ const g=x.greenAb, b=x.blueAb, fg=g&&g.cd?(x.greenCd||0)/g.cd:-1, fb=b&&b.cd?(x.blueCd||0)/b.cd:-1;   // the cast Hush breaks: its cooldown starts over
        if(fg>=fb&&g) x.greenCd=Math.max(x.greenCd||0,g.cd); else if(b) x.blueCd=Math.max(x.blueCd||0,b.cd); }
      A.acts(T,u,[{mark:'hu',on:'unit',dur:x.silencedT||0.1,while:'silencedT',ends:'huEnd'}],{u,unit:x,tgt:x});
      if(VO.some(id=>T.r[id])) A.acts(T,u,[{stack:'vo',add:1}],{u,tgt:x});
      if(P['nv.k']) A.setMark(T,u,x,'nv',{dur:2});
      if(P['hu.drain']) x.energy=Math.max(0,(x.energy||0)-P['hu.drain']);
      if(P.qc){ const w=T.s.m.wt; if(w&&w.alive&&A.markOf(u,w,'wt')) T.fn.willing(A,T,u,w,3+(P['wl.dur']||0)); } },
    /* ---- MUFFLED: when Hush's silence ends; until the enemy begins its next skill (the press: its pending cast), then that cast deals less ---- */
    huEnd(A,T,u,c){ const x=c.tgt; if(x&&x.alive&&T.P['mf.k']!=null){ A.setMark(T,u,x,'mf',{}); T.fn.mfAdd(A,T,u,x); } },
    mfAdd(A,T,u,x){ const o=S(T), L=o.mfL||(o.mfL=[]); if(L.indexOf(x)<0) L.push(x); const m=o.mfS||(o.mfS={}); m[x.uid]=[x.greenCd||0,x.blueCd||0,x._pend||null]; },
    mfScan(A,T,u){ const o=S(T), L=o.mfL, m=o.mfS||(o.mfS={}), P=T.P;
      for(let i=0;i<L.length;i++){ const x=L[i], s=m[x.uid]||[0,0,null]; if(!x.alive||!A.markOf(u,x,'mf')){ L.splice(i--,1); delete m[x.uid]; continue; }
        const p=x._pend||null; if(p&&p!==s[2]){ const g=(x.greenCd||0)>s[0]+0.05, b=(x.blueCd||0)>s[1]+0.05;   // it has just begun a skill: its next skill
          if(P['mf.cd']){ if(g) x.greenCd+=P['mf.cd']; else if(b) x.blueCd+=P['mf.cd']; }
          A.setMark(T,u,x,'mfc',{dur:(p.t||0)+1}); A.clearMark(u,x,'mf'); L.splice(i--,1); delete m[x.uid]; continue; }
        m[x.uid]=[x.greenCd||0,x.blueCd||0,p]; } },
    quietTgt(A,T,u,c){ const t=c.tgt; return !!t&&((t.silencedT||0)>0||!!A.markOf(u,t,'mf')); },
    silTgt(A,T,u,c){ return !!c.tgt&&(c.tgt.silencedT||0)>0; },
    /* ---- SUNBLIND: a unit stack on enemies; each gain lasts 4 s (Blinding, Hot Noon after Sunrise); Whiteout at 5 ---- */
    sbAdd(A,T,u,t,n,atLeast){ if(!t||!t.alive||t.team===u.team) return; const o=S(T), P=T.P, mx=A.stMax(T,u,'sb'), was=A.ustGet(T,u,t,'sb');
      let v=Math.min(mx,was+(n||0)); if(atLeast!=null) v=Math.max(v,Math.min(mx,atLeast)); if(!(v>0)) return;
      const d=4+(P['sb.dur']||0)+((o.sunUp&&P['sb.noon'])?P['sb.noon']:0); A.ustPut(T,u,t,'sb',v,d);
      if(P.wo&&was<5&&v>=5&&!A.markOf(u,t,'wol')){ A.setMark(T,u,t,'wo',{dur:1}); A.setMark(T,u,t,'wol',{dur:6}); } },
    /* a basic attack of an enemy on her team: does it miss? Sun in the Eyes (silenced by Hush), Whiteout, then the Sunblind roll (one seeded draw, only when it can miss) */
    sbMiss(A,T,u,c){ const s=c.src, P=T.P; if(!c.auto||!s||s.team===u.team) return false; let m=false, roll=false;
      if(P['hu.sun']&&A.markOf(u,s,'hu')) m=true; else if(P.wo&&A.markOf(u,s,'wo')) m=true;
      else { const p=A.ustGet(T,u,s,'sb')*(P['sb.k']||0); if(p>0&&A.eng().rnd()<p){ m=true; roll=true; } }
      if(!m) return false; c.amt=0; (c.tgt||u)._talMiss=1;
      if(roll&&P.sq){ A.setMark(T,u,s,'sq',{dur:2}); if(rk(T,'qh_1_1')&&!A.markOf(u,s,'sql')){ A.setMark(T,u,s,'mf',{}); T.fn.mfAdd(A,T,u,s); A.setMark(T,u,s,'sql',{dur:6}); } }
      return true; },
    /* ---- HITS ON HER TEAM (teamIn: the struck unit is not her) and HER TEAM'S HITS (teamIn on an enemy, from an ally) ---- */
    tIn(A,T,u,c){ const t=c.tgt, s=c.src; if(!t||!s) return;
      if(mate(u,t)&&foe(u,s)){ if(T.fn.sbMiss(A,T,u,c)) return; T.fn.qWard(A,T,u,t,s); c.amt*=Math.max(TCAP,T.fn.teamF(A,T,u,t,c)); T.fn.bind(A,T,u,c); return; }
      if(foe(u,t)&&mate(u,s)&&s!==u) T.fn.teamOut(A,T,u,c,s); },
    myIn(A,T,u,c){ const s=c.src; if(!s||!foe(u,s)) return; if(T.fn.sbMiss(A,T,u,c)) return; T.fn.qWard(A,T,u,u,s);
      c.amt*=Math.max(MCAP,T.fn.teamF(A,T,u,u,c)*T.fn.meF(A,T,u,c)); T.fn.bind(A,T,u,c); },
    /* the reductions her talents give one unit of her team (Lumi included): the Watch, Willing, Dawn Chill, The Quietest Part, Long Morning, and the Muffled attacker's cuts */
    teamF(A,T,u,x,c){ const P=T.P, s=c.src; let k=1;
      if((P['wt.k']||P['wt.k2'])&&A.markOf(u,x,'wt')) k*=1-((P['wt.k']||0)+(P['wt.k2']||0));
      if(P['wl.k']){ const w=willing(A,u,x); if(w) k*=1-P['wl.k']*w; }
      if(P['dr.dc']&&A.markOf(u,x,'dw')) k*=1-P['dr.dc'];
      if(P['dr.qp']&&c.kind==='magic'&&S(T).sil) k*=1-P['dr.qp'];
      if(P['dr.lm']&&A.markOf(u,x,'qk')) k*=1-P['dr.lm'];
      if(s&&c.auto&&P['mf.auto']&&A.markOf(u,s,'mf')) k*=1-P['mf.auto'];
      if(s&&!c.auto&&P['mf.k']&&A.markOf(u,s,'mfc')) k*=1-P['mf.k'];
      return k; },
    /* her own: Thin Frost, Morning Guard, Unheard, Daylit Calm, Lightfoot, Bright Footing, Sun-Warmed, Unhurried */
    meF(A,T,u,c){ const P=T.P, s=c.src, o=S(T); let k=1;
      if(P['dr.tf']&&c.kind==='magic') k*=1-P['dr.tf'];
      if(P['dr.mg']&&c.auto) k*=1-P['dr.mg'];
      if(P['dr.un']&&(s.silencedT||0)>0) k*=1-P['dr.un'];
      if(P['dr.vo']&&A.stGet(T,'vo')>=3) k*=1-P['dr.vo'];
      if(P['dr.lf']&&A.winOn(T,'lf')) k*=1-P['dr.lf'];
      if(P['dr.bf']&&team(A,T,u).some(x=>A.markOf(u,x,'qk'))) k*=1-P['dr.bf'];
      if(P['dr.sw']&&A.ustGet(T,u,s,'sb')>0) k*=1-P['dr.sw'];
      if(P['dr.uh']&&!c.auto&&o.uhW!==T.s.wave){ o.uhW=T.s.wave; k*=1-P['dr.uh']; }
      return k; },
    /* Quiet Ward: while her Dawnward holds a unit, an enemy that strikes it is silenced 0.5 s (Hush of Dawn longer), once per enemy per ward */
    qWard(A,T,u,t,s){ const P=T.P; if(!P.qw||!A.markOf(u,t,'dw')||!s.alive) return; const L=(S(T).qw||{})[t.uid]; if(!L||L.indexOf(s.uid)>=0) return; L.push(s.uid); A.control(T,u,s,'silencedT',P.qw); },
    /* Three Hundred Willing: while bound, 40% of a hit on one of her team is shared evenly by the other living heroes of her team (Lumi takes half her share);
       the shares are taken straight off them (damage(): their shields and their own reductions there, never shared again) */
    bind(A,T,u,c){ if(!T.P.thw||!A.winOn(T,'thw')||!(c.amt>0)) return; const t=c.tgt, L=team(A,T,u).filter(x=>x!==t); if(!L.length) return;
      const share=0.4*c.amt, per=share/L.length; c.amt-=share; for(const x of L) A.eng().damage(x,x===u?per*0.5:per,'#ffe89a',true); },
    /* her team's hits on enemies: Willing, the Watch, Named Voice, Squint, White Heat, Glinting Blades, Sunlit Ranks, Hollow Echo; Kindled heals; Spread Light */
    outK(A,T,u,c,s){ const P=T.P, t=c.tgt; let k=1;
      if(P['wl.k']||P['wl.dmg2']){ const w=willing(A,u,s); if(w) k*=1+((P['wl.k']||0)+(P['wl.dmg2']||0))*w; }
      if(P['wt.dmg']&&A.markOf(u,s,'wt')) k*=1+P['wt.dmg'];
      if(P['nv.k']&&A.markOf(u,t,'nv')) k*=1+P['nv.k'];
      if(P.sq&&A.markOf(u,t,'sq')) k*=1+P.sq;
      if(P.whh&&A.ustGet(T,u,t,'sb')>=5) k*=1+P.whh;
      if(P.gb&&A.markOf(u,s,'qk')&&A.ustGet(T,u,t,'sb')>0) k*=1+P.gb;
      if(P['kd.dmg']&&kindled(A,u,s)) k*=1+P['kd.dmg'];
      if(P['mf.echo']&&c.kind==='magic'&&A.markOf(u,t,'mf')) k*=1+P['mf.echo'];
      return k; },
    teamOut(A,T,u,c,s){ const P=T.P; c.amt*=T.fn.outK(A,T,u,c,s);
      if(P.spl&&A.markOf(u,s,'qk')) T.fn.sbAdd(A,T,u,c.tgt,1);
      if(P['kd.k']&&c.auto&&kindled(A,u,s)) T.fn.kheal(A,T,u,s); },
    myOut(A,T,u,c){ c.amt*=T.fn.outK(A,T,u,c,u); T.fn.nvOut(A,T,u,c); },
    myHit(A,T,u,c){ const P=T.P, t=c.tgt; if(T.s.cur===NOVA) return;
      if(c.auto&&P['sb.k']>0&&t.alive) T.fn.sbAdd(A,T,u,t,1);
      if(P.spl&&A.markOf(u,u,'qk')&&t.alive) T.fn.sbAdd(A,T,u,t,1);
      if(P['kd.k']&&c.auto&&kindled(A,u,u)) T.fn.kheal(A,T,u,u); },
    /* Kindled: each basic attack heals the attacker 0.3% (Bright Kindling more) of its max HP, never above 1.2% of its max HP a second (the regeneration cap) */
    kheal(A,T,u,x){ const o=S(T), E=A.eng(), now=E.now(), B=o.kb||(o.kb={}), b=B[x.uid]||(B[x.uid]={v:KD_RATE,t:now}); b.v=Math.min(KD_RATE,b.v+KD_RATE*(now-b.t)); b.t=now;
      const want=(T.P['kd.k']||0), got=Math.min(want,b.v); if(!(got>0)) return; b.v-=got; T.fn.lheal(A,T,u,x,got*x.maxHp); },
    daybright(A,T,u){ const x=A.eng().lowestAlly(u); if(x) T.fn.lheal(A,T,u,x,0.04*rk(T,'fl_2_1')*(u.apow||0)); },
    /* ---- HEALING RECEIVED: Close Watch (the Watched ally), Kindling Heat (Kindled allies), Sealed Lips (Muffled enemies) ---- */
    tHeal(A,T,u,c){ const P=T.P, x=c.unit; if(!x) return;
      if(x.team===u.team){ if(P['wt.hr']&&A.markOf(u,x,'wt')) c.amt*=1+P['wt.hr']; if(P['kd.hr']&&kindled(A,u,x)) c.amt*=1+P['kd.hr']; }
      else if(P['mf.heal']&&A.markOf(u,x,'mf')) c.amt*=1-P['mf.heal']; },
    /* ---- CONTROLS: on her, Grey Composure and (while she is Willing) Siege Nerves, together at most 25% shorter; on a Willing ally, Siege Nerves (at most 15%) ---- */
    ten(A,T,u,c){ const P=T.P; let k=1-(P['ten.gc']||0); if(P['ten.sn']&&A.markOf(u,u,'wl')) k*=1-P['ten.sn']; c.amt*=Math.max(0.75,k); },
    tCc(A,T,u,c){ const P=T.P, x=c.unit, s=c.src, f=c.field, a=c.amt||0; if(!x||!(a>0)||Math.abs((x[f]||0)-a)>1e-6) return;   // only the control just written (a longer one already there is left alone)
      if(x.team===u.team){ if(x!==u&&P['ten.sn']&&A.markOf(u,x,'wl')) x[f]=a*(1-Math.min(0.15,P['ten.sn'])); return; }
      if(f==='silencedT'&&P['sil.k']&&s&&s.team===u.team&&s!==u) x[f]=Math.min(CC_TALENT_CAP,a*(1+P['sil.k'])); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/36 - LUMI - talent decisions.md) */
  ruling:{}
};
