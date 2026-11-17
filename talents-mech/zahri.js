/* ZAHRI SUNHORN - what her learned talents do in a fight (the mechanics; her plain stat talents are read by tools/build_talent_fx.py from their sentences,
   like every other hero's). Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   Her real kit (the code, not the card wording; a Front-row Bruiser, melee with a 6 m lance reach, physical; tests/zahri-kit-facts.js, 21 seeded fights):
   - Solar Impalement ('shred', green, cd 6): her current target (the nearest enemy 84 of 98 casts) takes 160% of her attack x skill level and loses 44.9%
     of its armour for 5 s at skill level 100 (shredAt: 32% grown by a third of the curve, at most 45%). No reach test in the case: the cast waits in kitReady
     until the nearest enemy is inside her reach.
   - Mirage Herd ('summonmirage', blue, cd 9): ONE mirage (SUMMON_CAPS 1; the blue waits while it stands) with 30% + 0.1 point a level of her max HP and attack
     (39.9% at 100) - armour 0, magic resist 0, no passive, 30% of her crit chance as a double swing; it has no timer (lives until killed: median 7.1 s,
     up to 67 s; alive 59% of fight time). It fights with basic attacks only.
   - Desert Momentum (passive 'desertmom'): +4% attack speed and +6 penetration a basic attack, +1% / +2 every 5 m travelled (her real displacement; a jump
     of 8 m or more in one tick is not counted), all x passMul (2.188 at level 100), up to 50% / 120 x passMul. It NEVER drops: not in a fight, not between
     waves (measured: 0 drops; full after about 100 s of fighting, and still full at later waves). The card does not say otherwise.
   - Noonday Stampede (ult 'stampede', player-aimed; auto: at the farthest enemy): a 20 m line, she runs to the LAST enemy on it (the full 20 m in 5 of 62
     casts), 18 m/s; each enemy her body reaches is struck once for 180% of her attack, then stunned straight on (no ccApply: no resist roll) for
     ccDur(2.0, the control table's area stun) = 1.4 s, and shoved 2 m to its side. A median 2 enemies a cast.
   Her families (WIRING/66 - ZAHRI - talent decisions.md): Hoofbeats (5 m of travel each, spent by her next basic attack that lands), Sun Height (a step every
   4 s of fighting, noon at 12, a new day each wave), Remembered (her fallen mirages, fight-long), Shimmer (her mirage's hits), Sunlit (Solar Impalement's
   target), Glare (her critical hits). Caps: DR40 - her damage-reduction talents are ONE product, kept share floored at 0.60; MIR25 - a mirage's at 0.75;
   CC30 - her control-shortening talents at most 30%; CRIT5 - her critical-chance talents at most 5% in all; REGEN - her heal-a-second talents at most 1.2%
   of her max HP a second. NO absolute fight time anywhere: every timer is a countdown lowered by the tick's dt; marks are the engine's (moved by its clock). */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const GR='shred', BL='summonmirage', ULT='stampede', MKEY='zahri mirage';
const DR_FLOOR=0.60, MIR_FLOOR=0.75, CC_FLOOR=0.70, CRIT_POOL=500, REGEN=0.012, NOON=12, HOOF_MAX=8, SUN_PERIOD=4, NWE_CD=25, NWE_DUR=5, SL_CD=20;
/* the families: their bookkeeping runs when one of their talents is learned */
const HOOF=['rn_1_1','rn_2_1','rn_3_1','rn_n1','rn_4_1','rn_n2','rn_7_2','rn_9_4','rn_10_1','rn_12_1','rn_13_2','rn_5_2'];
const SUN=['rn_1_4','rn_2_4','rn_4_4','rn_6_4','rn_5_4','rn_8_4','rn_9_4','rn_12_3','rn_12_4','rn_13_2'];
const SHIM=['hr_1_4','hr_3_4','hr_5_4','hr_6_4','hr_7_4','hr_9_4'];
const REM=['hr_1_1','hr_4_1','hr_8_1','hr_10_1','hr_12_1','hr_13_2'];
const LIT=['sn_1_1','sn_3_1','sn_4_1','sn_5_2','sn_5_3','sn_6_2','sn_7_3','sn_7_4','sn_8_2','sn_9_1','sn_11_2','sn_12_2','sn_13_2'];
const GLARE=['sn_1_4','sn_2_4','sn_4_4','sn_5_4','sn_6_4','sn_7_4','sn_9_4','sn_10_4','sn_12_4','sn_13_2'];
const DRG=['rn_4_1','rn_8_4','hr_6_2','hr_n1','sn_3_3','sn_4_3','sn_10_4','sn_1_4'];        // DR40: her own group (Glare's weakening of a Glared attacker joins it)
const MIRG=['hr_4_2','hr_7_4','sn_1_4'];                                                     // MIR25: a mirage's
const CCG=['rn_n1','sn_5_1'];                                                                // CC30
const CRITL=['rn_2_3','sn_2_3','hr_6_4','sn_9_3'];                                           // CRIT5
const MIRAGE=['hr_1_1','hr_2_1','hr_5_2','hr_5_3','hr_6_3','hr_8_1','hr_11_2','hr_12_3'];   // her mirage as it is called
const SOUT=['hr_3_3','hr_4_4','hr_10_1','hr_12_3','hr_9_2'];
const SHIT=SHIM.concat(['hr_4_4','hr_12_2']);
const DEATHF=REM.concat(['hr_3_1','hr_11_1','hr_6_1','sn_9_1']);
const TEAMF=SHIM.concat(MIRG,['hr_n1','sn_1_1','sn_12_2','sn_4_1','sn_8_2','sn_6_4','sn_13_2','hr_9_4']);
const INF=DRG.concat(SHIM,['hr_10_4','hr_12_4','hr_13_2']);
const HITF=HOOF.concat(GLARE,LIT,['hr_4_4','rn_9_3','sn_4_3','sn_12_1','sn_12_3','sn_3_2','rn_10_3','rn_10_4','rn_7_3','hr_7_2','sn_7_4']);
const TICKF=HOOF.concat(SUN,['sn_6_4','rn_3_2','rn_7_1','rn_11_2','rn_6_1','rn_4_3','rn_5_3','rn_7_3','rn_9_3','sn_11_3','rn_7_2','hr_5_2','hr_13_2','rn_11_1','hr_12_1']);
const CDR=['hr_2_2','sn_6_1'];
/* ---- small readers that need no API ---- */
const rk=(T,id)=>T.r[id]||0;
const has=(T,L)=>L.some(id=>T.r[id]);
const V=T=>T.s.zh||(T.s.zh={e:{}, hoof:0, d5:0, d10:0, dtw:0, px:null, py:null, sun:0, sacc:0, held:0, aft:0, aacc:0, rem:0, first:1, rg:0, rch:0,
  sp:0, rdT:0, rdK:0, nweT:0, nweCd:0, slCd:0, lastT:null, lastIn:0, lastInAge:9, tfh:0, riseQ:0, risen:[], rising:0, gT:null, gSG:0, spear:0, stDmg:0,
  stSeen:null, stats:{hoof:0, spent:0, sun:0, noon:0, rem:0, shim:0, miss:0, glare:0, lit:0, nwe:0, sig2:0, sig3:0, noonHits:0, follow:0, haze:0, lc:0, ntb:0, cth:0, ride:0}});
const rec=(T,t)=>{ const v=V(T); let r=v.e[t.uid]; if(!r) r=v.e[t.uid]={u:t, sh:0, zt:0, mt:0, dw:0, stS:0, tr:0, ft:0, h3:0, pb:0, still:0, x:t.x, y:t.y}; return r; };
const recOf=(T,t)=>t?V(T).e[t.uid]:null;
const dmFull=u=>!!(u.pass&&u.pass.desertmom)&&(u._dmAS||0)>=0.5*(u.passMul||1)-1e-9;
const dmHalf=u=>!!(u.pass&&u.pass.desertmom)&&(u._dmAS||0)>0.25*(u.passMul||1)+1e-9;
module.exports={
  hero:'zahri',
  casting:true,                         // rows ask which of her skills a hit comes from (Solar Impalement, the stampede's run, her talents' own strikes)
  summons:true,                         // her mirages carry her rows (the summon hook must run for each one)
  states:{
    zhTw:{max:10, dur:4}                // Toward the Water
  },
  always:[
    {on:'wave',do:[{fn:'waveStart'}]},                                                                  // a new wave: her records of enemies drop; a new day; Hooves Like Drums, Ninth Week, Water on the Horizon
    {on:'tick',do:[{fn:'tk'}]},                                                                         // her travel, the sun, every countdown of hers
    {on:'tick',reqAny:['hr_13_2','rn_7_1'],do:[{fn:'regen'}]},                                         // REGEN: her heal-a-second talents
    {on:'kit',skill:GR,do:[{fn:'grKit'}]}, {on:'cast',skill:GR,do:[{fn:'grCast'}]},                    // Solar Impalement
    {on:'cast',skill:ULT,do:[{fn:'ultCast'}]},                                                          // Noonday Stampede
    {on:'out',if:{auto:true},reqAny:HOOF,do:[{fn:'spend'}]},                                            // a basic attack that lands spends her Hoofbeats (always rows run first)
    {on:'out',do:[{fn:'outF'}]},                                                                        // penetration, Two of Her, the zero armour, Shadowless, Open to All
    {on:'hit',if:{targetTeam:'enemy'},reqAny:HITF,do:[{fn:'hitF'}]},                                    // her hits landed
    {on:'kill',reqAny:['rn_12_3'],do:[{fn:'killF'}]},                                                   // Second Sun
    {on:'in',reqAny:INF,do:[{fn:'myIn'}]},                                                              // hits on her: Shimmer misses, Hide in the Heat, DR40, Not There
    {on:'lethal',reqAny:['hr_13_2'],do:[{fn:'lethalF'}]},                                               // They Followed Her
    {on:'teamIn',reqAny:TEAMF,do:[{fn:'tIn'}]},                                                         // hits on her side and on enemies (Sunlit, Glare, Shimmer, MIR25)
    {on:'death',reqAny:DEATHF,do:[{fn:'deathF'}]},                                                      // a mirage of hers falls; a Sunlit enemy dies
    {on:'summon',reqAny:MIRAGE,do:[{fn:'summonF'}]},                                                    // a mirage arrives
    {on:'sOut',reqAny:SOUT,do:[{fn:'sOutF'}]},                             // a mirage strikes
    {on:'sHit',if:{targetTeam:'enemy'},reqAny:SHIT,do:[{fn:'sHitF'}]},                                  // a mirage's hit landed
    {on:'ccIn',reqAny:CCG,do:[{fn:'ccK'}]},                                                             // CC30
    {on:'cd',reqAny:CDR,do:[{fn:'cdSet'}]},                                                             // her cooldown talents
    {stat:{crit:0.0001},per:{fn:'critPool'},reqAny:CRITL}                                               // CRIT5: one 5% pool
  ],
  talents:{
    /* ============================== NEVER STAND STILL ============================== */
    rn_1_1:[ {on:'out',if:{auto:true},more:R(0.015),per:{fn:'spentN'}} ],                              // Long Legs (Hoofbeats)
    rn_1_2:[ {stat:{move:R(0.02)}} ],                                                                    // Hot Sand
    rn_1_4:[ {stat:{atk:R(0.003)},per:{fn:'sunN'}} ],                                                    // Climbing Sun (Sun Height)
    rn_2_1:[ {param:'hoof.max',add:R(1)} ],                                                              // Long Gallop (8 + 1/rank)
    rn_2_3:[ {param:'cp.sh',add:R(1)} ],                                                                 // Sharp Horns (CRIT5 pool)
    rn_2_4:[ {stat:{aspd:0.0001},per:{fn:'mmK'}} ],                                                      // Midmorning (renamed Forenoon): the cap 3% higher per rank at 6+ steps
    rn_3_1:[ {on:'crit',if:{auto:true,fn:'rsOk'},force:true} ],                                         // Running Start: 6+ Hoofbeats spent
    rn_3_2:[ {param:'wind',add:R(0.10)} ],                                                               // Wind at Her Back (tk: per 5 m)
    rn_n1:[ {param:'rfree',add:R(0.006)} ],                                                              // Running Free (CC30)
    rn_4_1:[ {param:'ride',add:R(0.003)} ],                                                              // Ride Through (DR40)
    rn_n2:[ {on:'out',if:{auto:true,fn:'sp3'},ignoreArmor:0.04} ],                                       // Gap in the Dust (LINK: Sunlit with Find the Gap, hitF)
    rn_4_3:[ {on:'out',if:{fn:'still2'},more:R(0.02)} ],                                                 // No Shade
    rn_4_4:[ {on:'out',if:{auto:true,fn:'noon'},more:R(0.02)} ],                                         // Heat Shimmer (renamed Glaring Heat)
    rn_10_4:[ {on:'out',if:{fn:'dryW'},more:R(0.02)} ],                                                  // Dry Wind
    rn_7_2:[ {param:'lc',add:4} ],                                                                       // Lance Charge (grKit; the page's kitReady reach)
    rn_6_4:[ {param:'sunPen',add:R(1)} ],                                                                // Sunstruck (outF)
    rn_5_4:[ {param:'sun.fast',add:R(0.3)} ],                                                            // Long Day (renamed Slow Sunset)
    rn_6_1:[ {param:'dust',add:R(0.04)} ],                                                               // Dust Trail (tk)
    rn_9_2:[ {on:'out',if:{casting:GR,fn:'spearOk'},more:R(0.03)} ],                                     // Spear Point
                                                                                                         // Hard Hooves (renamed Iron Hooves): a plain stat - no row
    rn_7_1:[ {param:'thirst',add:R(0.005)} ],                                                            // Fast Thirst (REGEN)
    rn_9_3:[ {stat:{move:R(0.005)},per:{fn:'hazeN'}} ],                                                  // Haze (renamed Dust Devil)
                                                                                                         // Sun in Her Eyes: a plain stat (2%/rank crit damage) - no row
    rn_5_2:[ {param:'ntb',add:1} ],                                                                      // Never Turn Back (ultCast)
    rn_5_3:[ {param:'cth',add:1} ],                                                                      // Circle the Herd (ultCast, tk)
    rn_8_4:[ {param:'late',add:R(0.015)} ],                                                              // Late Morning (DR40)
    rn_6_2:[ {on:'out',if:{fn:'stamp'},more:R(0.03)} ],                                                  // Far Horizon (renamed To the Horizon): Never Turn Back's run
    rn_7_3:[ {on:'out',if:{fn:'tramp'},more:R(0.02)} ],                                                  // Trampled (renamed Underfoot)
    rn_9_4:[ {param:'hnoon',add:1} ],                                                                    // High Noon (hitF)
    rn_10_1:[ {stat:{aspd:R(0.002)},per:{fn:'hoofN'}} ],                                                 // Wide Country
    rn_10_3:[ {param:'rhythm',add:R(0.005)} ],                                                           // Hoof Rhythm (hitF)
    rn_11_1:[ {param:'ninth',add:1} ],                                                                   // Ninth Week (waveStart: the first wave)
    rn_11_2:[ {stat:{atk:R(0.004)},per:'zhTw'} ],                                                        // Toward the Water (tk stacks it)
                                                                                                         // Bright Waste: a plain stat - no row
    rn_12_1:[ {param:'drums',add:R(2)} ],                                                                // Hooves Like Drums (waveStart)
    rn_12_2:[ {on:'out',if:{fn:'dmF'},more:R(0.02)} ],                                                   // Run Them Down (renamed Ride Them Down)
    rn_12_3:[ {param:'sun2',add:R(1)} ],                                                                 // Second Sun (killF)
    rn_12_4:[ {param:'aft',add:R(0.005)}, {stat:{aspd:0.0001},per:{fn:'aftN'}} ],                       // Afternoon
    rn_13_2:[ {param:'nwe',add:1}, {stat:{move:0.30},if:{fn:'nweOn'}} ],                                 // Noon Without End (SIGNATURE: hitF, tk)
    /* ============================== THE HERD REMEMBERED ============================== */
    hr_1_1:[ {param:'horn',add:R(0.01)} ],                                                               // One Horned Shape (Remembered; summonF)
    hr_2_3:[ {stat:{atk:R(0.02)},if:{mine:MKEY}} ],                                                      // Herd Instinct (renamed Herd Sense)
    hr_1_4:[ {param:'shim',add:R(0.02)} ],                                                               // Shimmering Lance (Shimmer)
    hr_2_1:[ {stat:{move:R(0.03),aspd:R(0.03)},to:{team:'ally',mine:MKEY}} ],                           // Pace Keeper
    hr_2_2:[ {param:'cd.b',add:R(0.3)} ],                                                                // Called Closer
                                                                                                         // Sun-Hardened: a plain stat - no row
    hr_3_1:[ {param:'still',add:1} ],                                                                    // Still Running (deathF)
    hr_4_2:[ {param:'blur',add:R(0.04)} ],                                                               // Blurred Edges (MIR25)
    hr_3_3:[ {on:'sOut',more:R(0.03)} ],                                                                 // Lance Twin
    hr_3_4:[ {param:'shim.dur',add:R(0.3)} ],                                                            // Haze of Noon
    hr_4_1:[ {stat:{atk:R(0.005)},per:{fn:'remN'}} ],                                                    // Old Faces
    hr_5_2:[ {param:'aha',add:1} ],                                                                      // A Herd Again (two mirages, 20%)
    hr_5_3:[ {param:'ots',add:1} ],                                                                      // One True Shape (one at 45%, Desert Momentum)
    hr_4_4:[ {param:'two',add:R(0.03)} ],                                                                // Two of Her (outF, sOutF)
    hr_6_2:[ {param:'rtog',add:R(0.01)} ],                                                               // Running Together (DR40)
    hr_6_3:[ {param:'truer',add:R(0.03)} ],                                                              // Truer Than Most (summonF)
    hr_5_4:[ {param:'mdust',add:R(0.03)} ],                                                              // Mirage Dust (putShim)
    hr_6_1:[ {stat:{move:R(0.05)},if:{window:'zhGr'}} ],                                                 // Grief Speed (deathF opens it)
    hr_n1:[ {param:'ft',add:R(0.015)} ],                                                                 // False Target (tIn records, DR40)
    hr_6_4:[ {param:'cp.sg',add:R(1)} ],                                                                 // Sun Glint (CRIT5 pool)
    hr_7_2:[ {param:'follow',add:0.40} ],                                                                // Follow Me (hitF)
    hr_7_3:[ {on:'out',if:{casting:GR},more:R(0.03)} ],                                                  // Lance Line
    hr_7_4:[ {param:'unreal',add:R(0.02)} ],                                                             // Unreal Footing (MIR25)
    hr_8_1:[ {param:'hmem',add:R(0.01)} ],                                                               // Herd Memory (summonF)
                                                                                                         // Thirst: a plain stat - no row
    hr_9_2:[ {param:'ghost',add:R(0.04)} ],                                                              // Stampede of Ghosts (hitF)
                                                                                                         // Hot Blood (renamed Desert Blood): a plain stat (2%/rank crit damage) - no row
    hr_9_4:[ {param:'lost',add:0.5} ],                                                                   // Lost in the Haze (a Shimmer miss)
    hr_10_1:[ {on:'sOut',if:{fn:'rem5'},more:R(0.03)} ],                                                 // Five Names
    hr_10_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                          // Lance Tip
    hr_10_4:[ {param:'hide',add:R(0.02)} ],                                                              // Hide in the Heat (myIn)
    hr_11_1:[ {param:'who',add:1} ],                                                                     // Who Followed (deathF)
    hr_11_2:[ {stat:{atk:0.0001,hp:0.0001},to:{team:'ally',mine:MKEY},per:{fn:'kpN'},if:{selfHpAbove:0.5}} ],   // Kept Pace (points of her stats)
                                                                                                         // Desert Born: a plain stat - no row
    hr_12_1:[ {param:'water',add:R(1)} ],                                                                // Water on the Horizon (waveStart: the first wave)
    hr_12_2:[ {param:'touch',add:R(0.01)} ],                                                             // Close Enough to Touch (sHitF)
    hr_12_3:[ {param:'mate',add:R(0.10)}, {stat:{aspd:0.0001},to:{team:'ally',mine:MKEY},per:{fn:'mateN'}} ],   // Herdmate
    hr_12_4:[ {param:'nt',add:R(0.10)} ],                                                                // Not There (myIn)
    hr_13_2:[ {param:'tfh',add:1} ],                                                                     // They Followed Her (SIGNATURE: lethalF, tk)
    /* ============================== THE SUN LANCE ============================== */
    sn_1_1:[ {param:'lit',add:R(0.015)} ],                                                               // Find the Gap (Sunlit; tIn)
    sn_11_3:[ {param:'lunge',add:R(0.2)} ],                                                              // Lance Lunge (tk: her reach)
    sn_1_4:[ {param:'gl',add:R(0.03)} ],                                                                 // Noon Glare (Glare; DR40, MIR25, tIn)
    sn_2_1:[ {param:'wider',add:R(0.02)} ],                                                              // Wider Gap (renamed Wider Opening; grCast)
    sn_2_3:[ {param:'cp.ke',add:R(1)} ],                                                                 // Keen Eye (renamed Sharp Sight; CRIT5 pool)
    sn_2_4:[ {param:'gl.dur',add:R(0.3)} ],                                                              // White Light
    sn_3_1:[ {param:'tnt',add:1} ],                                                                      // Through and Through (grCast)
    sn_3_2:[ {param:'pheat',add:R(1)} ],                                                                 // Penetrating Heat (hitF)
    sn_3_3:[ {param:'sand',add:R(0.015)} ],                                                              // Sand-Scoured Hide (DR40)
    sn_4_1:[ {param:'way',add:R(0.01)} ],                                                                // Show the Way (tIn)
    sn_4_3:[ {param:'duel',add:R(0.02)} ],                                                               // Duelist's Stance (DR40)
    sn_4_4:[ {on:'out',if:{fn:'glared'},critMore:R(0.03)} ],                                             // Blinding Point
    sn_5_1:[ {param:'steady',add:R(0.04)} ],                                                             // Steady in the Heat (CC30)
    sn_5_2:[ {param:'hio',add:1} ],                                                                      // Hold It Open
    sn_5_3:[ {param:'dih',add:0.25}, {on:'out',if:{auto:true,fn:'sunlit'},more:P('dih',0),do:[{fn:'closeGap'}]} ],   // Drive It Home
    sn_5_4:[ {stat:{crit:R(-0.03)},to:{team:'enemy',has:'zhGl'}} ],                                      // Sunspots
    sn_6_1:[ {param:'cd.g',add:R(0.3)} ],                                                                // Spitting Sun
    sn_6_2:[ {on:'out',if:{fn:'sunlit'},more:R(0.02)} ],                                                 // One Gap at a Time (Hold It Open)
    sn_6_4:[ {param:'shadow',add:R(0.10)} ],                                                             // Shadowless (outF, tIn, sOutF)
    sn_7_1:[ {on:'out',if:{casting:GR},more:R(0.03)} ],                                                  // Sun-Forged Tip
                                                                                                         // Heat Haze Guard: a plain stat - no row
    sn_7_3:[ {param:'dih',add:R(0.03)} ],                                                                // Hilt-Deep (points on Drive It Home's 25%)
    sn_7_4:[ {param:'sos',add:1} ],                                                                      // Sun Over Shoulder (hitF)
                                                                                                         // Bitter Light: a plain stat (2%/rank crit damage) - no row
    sn_8_2:[ {param:'ota',add:R(0.01)} ],                                                                // Open to All (outF, tIn)
    sn_9_1:[ {param:'finder',add:1} ],                                                                   // Gap Finder (deathF)
    sn_9_3:[ {param:'cp.gh',add:R(2)} ],                                                                 // Golden Hour (CRIT5 pool)
    sn_9_4:[ {param:'spot',add:R(0.4)} ],                                                                // Blind Spot (hitF)
    sn_10_1:[ {on:'out',ignoreArmor:R(0.015)} ],                                                         // Through the Ribs
    sn_10_4:[ {param:'gnoon',add:R(0.01)} ],                                                             // Glare of Noon (DR40)
    sn_11_1:[ {on:'out',if:{fn:'bigger'},more:R(0.02)} ],                                                // Seen Through
    sn_11_2:[ {stat:{aspd:0.10},to:{team:'ally',others:true},if:{fn:'lit3'}} ],                          // Open Season (renamed Open Day)
                                                                                                         // Bright Steel: a plain stat - no row
    sn_12_1:[ {on:'out',if:{fn:'first'},critMore:R(0.03)} ],                                             // Point Blank
    sn_12_2:[ {param:'lit2',add:R(0.01)} ],                                                              // A Gap for All (tIn)
    sn_12_3:[ {param:'iron',add:R(0.01)} ],                                                              // Hot Iron (hitF)
    sn_12_4:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'zhGl'}} ],                                     // Blind Noon
    sn_13_2:[ {param:'lance',add:1} ]                                                                    // The Sun Lance (SIGNATURE: grKit / grCast)
  },
  fn:{
    /* ---- A NEW WAVE: her records of enemies drop (enemies are new); a new day (Afternoon holds noon once reached); Hooves Like Drums; the first wave of a
       fight: Ninth Week's Desert Momentum, Water on the Horizon's Remembered ---- */
    waveStart(A,T,u){ const v=V(T), P=T.P; T.s.api=A;
      v.e={}; v.px=null; v.py=null; v.stSeen=null; v.gT=null; v.lastT=null; v.sp=0;
      if(!v.held){ v.sun=0; v.sacc=0; }
      if(has(T,HOOF)&&P.drums) v.hoof=Math.max(v.hoof,Math.min(T.fn.hoofCap(A,T),P.drums));
      if(v.first){ v.first=0;
        if(P.ninth&&u.pass&&u.pass.desertmom){ const pm=u.passMul||1; u._dmAS=Math.max(u._dmAS||0,0.25*pm); u._dmPen=Math.max(u._dmPen||0,60*pm); }
        if(P.water) v.rem=Math.min(5,Math.max(v.rem,P.water)); }
      if(P.lc) u._zhLc=P.lc*A.eng().METER();                                                         // Lance Charge: the page's kitReady lets the green start 4 m farther out
      if(P.aha) u._zhCap=1; },                                                                        // A Herd Again: one more mirage (the page's summon cap and kitReady read it)
    /* ---- EVERY TICK: her travel (Hoofbeats, Wind at Her Back, Fast Thirst, Toward the Water, Dust Trail), the sun, the countdowns, the stampede's struck,
       her reach (Lance Lunge, Noon Without End), the signature's rising ---- */
    tk(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), dt=c.dt||0, M=E.METER(); T.s.api=A;
      for(const f of ['rdT','nweT','nweCd','slCd']) if(v[f]>0) v[f]=Math.max(0,v[f]-dt);
      v.lastInAge+=dt;
      for(const k in v.e){ const r=v.e[k], t=r.u; if(!t.alive){ delete v.e[k]; continue; }
        for(const f of ['zt','mt','dw','tr','ft','h3']) if(r[f]>0) r[f]=Math.max(0,r[f]-dt);
        if(r.stS&&!((t.stunned||0)>0)){ r.stS=0; if(T.r.rn_7_3) r.tr=3; }                              // Trampled: 3 s after the stampede's stun ends
        if(P.shadow){ const sh=t.shield||0; if(sh>r.sh+1e-9&&T.fn.glOn(A,u,t)){ t.shield=r.sh+(sh-r.sh)*(1-Math.min(1,P.shadow)); } r.sh=t.shield||0; } }   // Shadowless: a shield (or what it grew by) on a Glared enemy holds 10%/rank less
      if(T.r.rn_4_3) for(const x of E.units()){ if(!x.alive||x.team===u.team) continue; const r=rec(T,x); if(Math.abs(x.x-r.x)<1e-9&&Math.abs(x.y-r.y)<1e-9) r.still+=dt; else r.still=0; r.x=x.x; r.y=x.y; }   // No Shade: who has stood still
      /* her travel, as Desert Momentum meters it (her real displacement; 8 m or more in one tick is not travel) */
      if(v.px!=null&&u.alive){ const mv=Math.hypot(u.x-v.px,u.y-v.py);
        if(mv>0&&mv<8*M){
          if(has(T,HOOF)||P.wind){ v.d5+=mv; while(v.d5>=5*M){ v.d5-=5*M; T.fn.per5(A,T,u); } }
          if(P.thirst){ v.d10+=mv; while(v.d10>=10*M){ v.d10-=10*M; v.rg+=P.thirst*(u.maxHp||0); } }
          if(T.r.rn_11_2){ const g=u.target&&u.target.alive&&u.target.team!==u.team?u.target:T.fn.nearest(A,T,u); if(g){ const d0=Math.hypot(g.x-v.px,g.y-v.py), d1=Math.hypot(g.x-u.x,g.y-u.y);
              if(d1<d0-1e-9){ v.dtw+=mv; while(v.dtw>=5*M){ v.dtw-=5*M; A.stSet(T,u,'zhTw',A.stGet(T,'zhTw')+1); } } } }
          if(P.dust) for(const x of A.pick(T,u,{team:'enemy',within:1},{u})) A.acts(T,u,[{slow:P.dust,dur:2,on:'target'}],{u,tgt:x}); } }
      v.px=u.x; v.py=u.y;
      /* the sun: a step every 4 s of fighting (0.3 s faster a rank Long Day), noon at 12; after noon with Afternoon, every further 4 s a step of attack speed */
      if(has(T,SUN)&&u.alive){ const per=Math.max(1,SUN_PERIOD-(P['sun.fast']||0)); v.sacc+=dt;
        while(v.sacc>=per){ v.sacc-=per; if(v.sun<NOON){ v.sun++; v.stats.sun++; if(v.sun>=NOON){ v.stats.noon++; if(P.aft) v.held=1; } } else if(P.aft&&v.aft<10) v.aft++; } }
      /* the stampede's struck enemies: Circle the Herd throws each back onto her line, behind her */
      if(u._stampHit&&u._stampHit.size&&v.stSeen){ for(const e of u._stampHit){ if(v.stSeen.has(e)) continue; v.stSeen.add(e);
          if(P.cth&&e.alive&&!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0)) T.fn.onLine(A,T,u,e); } }
      /* her reach: Lance Lunge 0.2 m a rank, Noon Without End 2 m (the difference is put on her own number, so what else the engine does to it is kept) */
      { const want=((P.lunge||0)+(v.nweT>0?2:0))*M; if(want!==v.rch){ u.reach=(u.reach||0)+want-v.rch; v.rch=want; } }
      if(v.riseQ){ v.riseQ=0; T.fn.rise(A,T,u); } },
    /* every 5 m of her travel: a Hoofbeat; Wind at Her Back's extra Desert Momentum */
    per5(A,T,u){ const v=V(T), P=T.P;
      if(has(T,HOOF)&&v.hoof<T.fn.hoofCap(A,T)){ v.hoof++; v.stats.hoof++; }
      if(P.wind&&u.pass&&u.pass.desertmom){ const pm=u.passMul||1; u._dmAS=Math.min(0.5*pm,(u._dmAS||0)+0.01*pm*P.wind); u._dmPen=Math.min(120*pm,(u._dmPen||0)+2*pm*P.wind); } },
    hoofCap(A,T){ return HOOF_MAX+(T.P['hoof.max']||0); },
    nearest(A,T,u){ const E=A.eng(); let b=null,bd=1e18; for(const x of E.units()){ if(!x.alive||x.team===u.team||x._dropHidden||x._noTarget) continue; const d=E.dist(u,x); if(d<bd){ bd=d; b=x; } } return b; },
    /* Circle the Herd: an enemy the stampede struck lands back on her line, just behind her (not shoved aside) */
    onLine(A,T,u,e){ const E=A.eng(), ux=u._stampUX||0, uy=u._stampUY||0, x0=u._stampX0, y0=u._stampY0; if(x0==null) return;
      const tt=Math.max(0,(u.x-x0)*ux+(u.y-y0)*uy-(E.bodyR(u)+E.bodyR(e))); e.x=x0+ux*tt; e.y=y0+uy*tt; e._ax=e.x; e._ay=e.y; V(T).stats.cth++; },
    /* REGEN: Fast Thirst's heals (banked) and the signature's risen herd, together at most 1.2% of her max HP a second */
    regen(A,T,u,c){ const v=V(T), E=A.eng(), dt=c.dt||0; if(!u.alive) return; let room=REGEN*(u.maxHp||0)*dt;
      v.risen=v.risen.filter(x=>x.alive); if(v.risen.length){ E.healUnit(u,room); return; }
      if(v.rg>0){ const h=Math.min(v.rg,room); v.rg-=h; E.healUnit(u,h); } },
    /* ---- HOOFBEATS: her next basic attack that lands spends them all (Noon Without End: counts 8, spends none) ---- */
    spend(A,T,u,c){ const v=V(T); if(v.nweT>0){ v.sp=8; return; } v.sp=v.hoof; if(v.hoof>0){ v.stats.spent+=v.hoof; v.hoof=0; } },
    spentN(A,T,u,c){ return c.auto?V(T).sp:0; },
    sp3(A,T,u,c){ return !!c.auto&&V(T).sp>=3; },
    rsOk(A,T,u){ const v=V(T); return v.nweT>0||v.hoof>=6; },                                              // Running Start reads what this basic will spend
    hoofN(A,T){ return V(T).hoof; },
    /* ---- THE SUN ---- */
    sunN(A,T){ return V(T).sun; },
    noon(A,T){ return V(T).sun>=NOON; },
    mmK(A,T,u){ if(V(T).sun<6||!dmFull(u)) return 0; const cap=0.5*(u.passMul||1), k=0.03*rk(T,'rn_2_4'); return 10000*((1+cap*(1+k))/(1+cap)-1); },
    aftN(A,T){ return 10000*(T.P.aft||0)*V(T).aft; },
    nweOn(A,T){ return V(T).nweT>0; },
    dmF(A,T,u){ return dmFull(u); },
    hazeN(A,T){ const v=V(T); let n=0; for(const k in v.e) if(v.e[k].h3>0) n++; return Math.min(5,n); },
    still2(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.still>=2); },
    dryW(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.dw>0); },
    tramp(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.tr>0); },
    stamp(A,T,u,c){ return !!u._stampFoes&&T.s.cur==null&&!c.auto; },                                    // a hit of the stampede's run (its strikes land in her status pass)
    spearOk(A,T){ return V(T).spear>0; },
    bigger(A,T,u,c){ return !!c.tgt&&(c.tgt.maxHp||0)>(u.maxHp||0); },
    first(A,T,u,c){ const r=recOf(T,c.tgt); return !r||!r.pb; },
    killF(A,T,u){ const v=V(T), P=T.P; if(!has(T,SUN)||!P.sun2) return; const was=v.sun; v.sun=Math.min(NOON,v.sun+P.sun2); if(was<NOON&&v.sun>=NOON){ v.stats.noon++; if(P.aft) v.held=1; } },
    /* ---- HER HITS, before they land: penetration (Sunstruck, Herdmate on a mirage), Two of Her, the signature's zero armour, Shadowless, Open to All ---- */
    penK(A,s,t,pen){ const E=A.eng(); if(!(pen>0)) return 1; const a=E.defMul(s,t,'phys'); if(!(a>0)) return 1; const sv=s.armorPen||0; s.armorPen=sv+pen; const b=E.defMul(s,t,'phys'); s.armorPen=sv; return b/a; },
    zeroK(A,s,t){ const E=A.eng(), a=E.defMul(s,t,'phys'); if(!(a>0)) return 1; const sv=t.armorRating; t.armorRating=0; const b=E.defMul(s,t,'phys'); t.armorRating=sv; return Math.max(1,b/a); },
    outF(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt; if(!t||t.team===u.team) return; const r=rec(T,t);
      if(c.kind==='phys'){ if(P.sunPen&&v.sun>0) c.amt*=T.fn.penK(A,u,t,P.sunPen*v.sun); if(T.fn.zeroOn(A,u,t)) c.amt*=T.fn.zeroK(A,u,t); }
      if(P.two&&r.mt>0) c.amt*=1+P.two;
      if(P.ota&&!c.auto&&T.fn.litOn(A,u,t)) c.amt*=1+P.ota; },
    /* ---- HER HITS, landed: her records, Glare on a crit, Hoof Rhythm / Penetrating Heat on a basic, the spend's riders (Ride Through, Gap in the Dust's
       Sunlit, High Noon, Noon Without End), Hot Iron, the stampede's riders (Dry Wind, Trampled, Sun Over Shoulder, Follow Me) ---- */
    hitF(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), t=c.tgt; if(!t) return; const r=rec(T,t);
      r.zt=2; r.h3=3; r.pb=1; v.lastT=t;
      if(c.crit&&has(T,GLARE)&&T.r.sn_1_4&&t.alive) T.fn.putGlare(A,T,u,t,2+(P['gl.dur']||0));
      if(c.crit&&P.iron&&u.alive) E.healUnit(u,P.iron*(u.maxHp||0));
      if(c.auto&&u.pass&&u.pass.desertmom){ const pm=u.passMul||1;
        if(P.rhythm) u._dmAS=Math.min(0.5*pm,(u._dmAS||0)+P.rhythm*pm);
        if(P.pheat) u._dmPen=Math.min(120*pm,(u._dmPen||0)+P.pheat*pm); }
      if(c.auto&&has(T,HOOF)){ const n=v.sp; v.sp=0;
        if(n>0){ if(P.ride){ v.rdK=P.ride*n; v.rdT=3; v.stats.ride++; }
          if(n>=3&&T.r.rn_n2&&T.r.sn_1_1&&t.alive) T.fn.putSun(A,T,u,t,5);
          if(P.hnoon&&v.sun>=NOON){ const amt=(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*E.rage(); for(const x of A.pick(T,u,{team:'enemy',within:2},{u})) if(x!==t){ v.stats.noonHits++; T.fn.skillHit(A,T,u,x,amt,'zhNoon'); } }
          if(P.nwe&&n>=8&&v.sun>=NOON&&v.nweT<=0&&v.nweCd<=0){ v.nweT=NWE_DUR; v.nweCd=NWE_CD; v.stats.nwe++;
            if(u.pass&&u.pass.desertmom){ const pm=u.passMul||1; u._dmAS=0.5*pm; u._dmPen=120*pm; } } } }
      if(T.fn.stamp(A,T,u,c)){
        if(T.r.rn_10_4) r.dw=5; if(T.r.rn_7_3) r.stS=1;
        if(P.sos&&t.alive){ T.fn.putSun(A,T,u,t,5); T.fn.putGlare(A,T,u,t,2+(P['gl.dur']||0)+(P.spot||0)); }
        if(P.follow&&t.alive){ const amt=v.stDmg*P.follow*(1+(P.ghost||0)); for(const m of A.mineOf(T,u).slice()) if(m.alive&&m.key===MKEY&&t.alive){ v.stats.follow++; T.fn.skillHit(A,T,m,t,amt,null); } } } },
    /* a hit of hers (or of her mirage: s) a talent adds: a real hit through the page's damage, read as `sk` by her rows */
    skillHit(A,T,s,t,amt,sk){ const E=A.eng(); if(!t||!t.alive||!s.alive||!E.strike||!(amt>0)) return; const pv=T.s.cur, d0=T.s.d; T.s.cur=sk; T.s.d=0; try{ E.strike(s,t,amt,'#ffcf40'); } finally{ T.s.cur=pv; T.s.d=d0; } },
    /* ---- SOLAR IMPALEMENT: its target and whether it is already Sunlit and Glared (The Sun Lance); Lance Charge's run and Spear Point ---- */
    grKit(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), M=E.METER(), t=u.target; v.gT=t; v.spear=0;
      v.gSG=(P.lance&&t&&T.fn.litOn(A,u,t)&&T.fn.glOn(A,u,t))?1:0;
      if(P.lc&&t&&t.alive&&!u._dash){ const gap=E.dist(u,t)-E.bodyR(u)-E.bodyR(t), reach=Math.max(u.range||0,u.reach||0), run=Math.min(P.lc*M,Math.max(0,gap-reach));   // her kit reach, as kitReady measures it
        if(run>0.05*M){ const d=E.dist(u,t)||1, ux=(t.x-u.x)/d, uy=(t.y-u.y)/d; u._dash={x0:u.x,y0:u.y,x1:u.x+ux*run,y1:u.y+uy*run,t:0,dur:Math.max(0.15,run/(18*M)),run:function(){}}; v.stats.lc++;
          if(T.r.rn_9_2&&run>=3*M-1e-6) v.spear=1; } } },
    grCast(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), M=E.METER(), o=c.o||{}, t=v.gT; if(!t) return;
      const amt=(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*(u._castSM||1)*(o.mul||1.4)*E.rage(), cut=(o.shred||0.3)*(1+(P.wider||0));
      const lance=v.gSG&&P.lance&&v.slCd<=0;
      if(t.alive){ if(P.wider){ t._shredPct=Math.max(t._shredPct||0,cut); t._shredT=Math.max(t._shredT||0,o.dur||5); } if(has(T,LIT)) T.fn.putSun(A,T,u,t,5); }
      if(P.tnt){ const b=T.fn.behind(A,T,u,t,3*M,null); if(b.length){ const x=b[0]; T.fn.skillHit(A,T,u,x,amt,GR); if(x.alive){ x._shredPct=Math.max(x._shredPct||0,cut); x._shredT=Math.max(x._shredT||0,o.dur||5); T.fn.putSun(A,T,u,x,5); } } }   // Through and Through
      if(lance){ v.slCd=SL_CD; v.stats.sig3++; for(const x of T.fn.behind(A,T,u,t,10*M,'line')){ T.fn.skillHit(A,T,u,x,amt,GR); if(!x.alive) continue;   // The Sun Lance
          T.fn.putSun(A,T,u,x,5); T.fn.putGlare(A,T,u,x,2+(P['gl.dur']||0)); A.setMark(T,u,x,'zhZero',{dur:4,longest:true}); } }
      v.gT=null; },
    /* the enemies behind t, seen from her: 'line' = every one within L metres beyond it whose body the line crosses (1.6 m of slack); else the nearest one
       directly behind it (its body on the line, within L metres body to body) */
    behind(A,T,u,t,L,mode){ const E=A.eng(), M=E.METER(), d=E.dist(u,t)||1, ux=(t.x-u.x)/d, uy=(t.y-u.y)/d, tp=(t.x-u.x)*ux+(t.y-u.y)*uy, out=[];
      for(const x of E.units()){ if(!x.alive||x===t||x.team===u.team||x._dropHidden||x._noTarget) continue; const rx=x.x-u.x, ry=x.y-u.y, p=rx*ux+ry*uy, side=Math.abs(rx*uy-ry*ux);
        if(p<=tp) continue; const br=E.bodyR(x);
        if(mode==='line'){ if(p-tp-br<=L&&side<=1.6*M+br) out.push([x,p]); }
        else { if(side<=br+0.5*M&&E.dist(t,x)-E.bodyR(t)-br<=L) out.push([x,p]); } }
      out.sort((a,b)=>a[1]-b[1]); return mode==='line'?out.map(z=>z[0]):(out.length?[out[0][0]]:[]); },
    /* ---- NOONDAY STAMPEDE: Never Turn Back runs the full 20 m; Circle the Herd's stun 0.5 s longer (the page writes ccDur(stun): +0.5 / 0.7) ---- */
    ultCast(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), M=E.METER(), o=c.o||{}; v.stSeen=new Set(); v.stDmg=u._stampDmg||0;
      if(P.cth){ u._stampStun=(u._stampStun||1)+0.5/(E.ccDur(1)||0.7); }
      if(P.ntb&&u._stampX0!=null&&E.fieldWH){ const R=(o.radius||20*M), ux=u._stampUX||0, uy=u._stampUY||0, sp=(u._stampT>0)?(u._stampLen||0)/u._stampT:(o.speed||18*M), WH=E.fieldWH();
        let ex=u._stampX0+ux*R, ey=u._stampY0+uy*R; ex=Math.max(60,Math.min(WH[0]-60,ex)); ey=Math.max(110,Math.min(WH[1]-60,ey)); const len=Math.hypot(ex-u._stampX0,ey-u._stampY0)||1;
        if(len>(u._stampLen||0)+1e-6&&sp>0){ u._stampX1=ex; u._stampY1=ey; u._stampLen=len; u._stampT=len/sp; u._stampDur=u._stampT; u._abilHold=Math.max(u._abilHold||0,u._stampT+0.3); v.stats.ntb++; } } },
    /* ---- SUNLIT / GLARE / SHIMMER (the engine's own marks; Hold It Open: one Sunlit enemy at a time, until it dies) ---- */
    putSun(A,T,u,t,dur){ if(!t||!t.alive||t.team===u.team) return; V(T).stats.lit++; if(T.P.hio) A.setMark(T,u,t,'zhSun',{unique:true}); else A.setMark(T,u,t,'zhSun',{dur,longest:true}); },
    putGlare(A,T,u,t,dur){ if(!t||!t.alive||t.team===u.team) return; V(T).stats.glare++; A.setMark(T,u,t,'zhGl',{dur,longest:true}); rec(T,t); },
    putShim(A,T,u,t,dur){ if(!t||!t.alive||t.team===u.team) return; V(T).stats.shim++; A.setMark(T,u,t,'zhSh',{dur,longest:true}); if(T.P.mdust) A.acts(T,u,[{slow:T.P.mdust,dur,on:'target'}],{u,tgt:t}); },
    litOn(A,u,t){ return !!t&&!!A.markOf(u,t,'zhSun'); },
    glOn(A,u,t){ return !!t&&!!A.markOf(u,t,'zhGl'); },
    shOn(A,u,t){ return !!t&&!!A.markOf(u,t,'zhSh'); },
    zeroOn(A,u,t){ return !!t&&!!A.markOf(u,t,'zhZero'); },
    sunlit(A,T,u,c){ return !!c.tgt&&!!A.markOf(u,c.tgt,'zhSun'); },
    glared(A,T,u,c){ return !!c.tgt&&!!A.markOf(u,c.tgt,'zhGl'); },
    closeGap(A,T,u,c){ if(c.tgt) A.clearMark(u,c.tgt,'zhSun'); },                                          // Drive It Home: the gap closes
    lit3(A,T,u){ const E=A.eng(); let n=0; for(const x of E.units()) if(x.alive&&x.team!==u.team&&A.markOf(u,x,'zhSun')) n++; return n>=3; },
    /* ---- HER SIDE'S HITS: on one of hers (Shimmer misses, Lost in the Haze, Glare's weakening, MIR25 on a mirage, False Target's record), and on an enemy
       (Sunlit's bonus and Show the Way for her allies, the zero armour, Open to All, Shadowless) ---- */
    tIn(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt, s=c.src; if(!t||!s) return;
      if(t.team===u.team){ if(s.team===t.team) return;
        if(T.fn.missRoll(A,T,u,c)) return;
        if(t._talS===u&&t.key===MKEY){ if(T.r.hr_n1) rec(T,s).ft=3; c.amt*=T.fn.mirK(A,T,u,s); return; }
        if(t!==u&&!t._summon&&P.gl&&T.fn.glOn(A,u,s)) c.amt*=1-Math.min(0.5,P.gl);
        return; }
      if(s.team!==u.team||s===u) return; const hero=!s._summon;
      if(c.kind==='phys'){ if(T.fn.zeroOn(A,u,t)) c.amt*=T.fn.zeroK(A,s,t); else if(hero&&P.way&&T.fn.litOn(A,u,t)){ const a=A.eng().defMul(s,t,'phys'); if(a>0){ const sv=s._wpnArmIgn; s._wpnArmIgn=1-(1-(sv||0))*(1-P.way); const b=A.eng().defMul(s,t,'phys'); s._wpnArmIgn=sv; c.amt*=b/a; } } }
      if(T.fn.litOn(A,u,t)){ if(hero) c.amt*=1+(P.lit||0)+(P.lit2||0); if(P.ota&&!c.auto) c.amt*=1+P.ota; } },
    /* Shimmer: a Shimmering enemy's basic attack on her side misses 2% a rank (the fight's seeded stream, drawn only for such an attack); Lost in the Haze */
    missRoll(A,T,u,c){ const P=T.P, s=c.src, t=c.tgt; if(!P.shim||!c.auto||!T.fn.shOn(A,u,s)) return false;
      if(!(A.eng().rnd()<P.shim)) return false; c.amt=0; t._talMiss=1; V(T).stats.miss++;
      if(P.lost&&s.alive){ const m=T.fn.nearMirage(A,T,u,s); if(m) T.fn.skillHit(A,T,m,s,P.lost*(m.dmg||0)*A.eng().rage(),null); }
      return true; },
    nearMirage(A,T,u,x){ const E=A.eng(); let b=null,bd=1e18; for(const m of A.mineOf(T,u)) if(m.alive&&m.key===MKEY){ const d=E.dist(m,x); if(d<bd){ bd=d; b=m; } } return b; },
    mirN(A,T,u){ let n=0; for(const m of A.mineOf(T,u)) if(m.alive&&m.key===MKEY) n++; return n; },
    /* MIR25: what her talents take off a hit on a mirage of hers, one product floored at 0.75 */
    mirK(A,T,u,s){ const P=T.P; let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P.blur) cut(P.blur); if(P.unreal&&s&&T.fn.shOn(A,u,s)) cut(P.unreal); if(P.gl&&s&&T.fn.glOn(A,u,s)) cut(P.gl); return Math.max(MIR_FLOOR,k); },
    /* ---- DR40: her damage-reduction talents, ONE product on her, kept share floored at 0.60 (the 95% probe reads drK) ---- */
    drK(A,T,u,s){ const v=V(T), P=T.P, E=A.eng(); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P.ride&&v.rdT>0) cut(v.rdK);                                                                    // Ride Through
      if(P.late&&v.sun>=6) cut(P.late);                                                                  // Late Morning
      if(P.rtog) cut(P.rtog*Math.min(5,T.fn.mirN(A,T,u)));                                               // Running Together
      if(P.sand&&dmHalf(u)) cut(P.sand);                                                                 // Sand-Scoured Hide
      if(P.gnoon){ let n=0; for(const x of A.pick(T,u,{team:'enemy',within:5},{u})) if(T.fn.glOn(A,u,x)) n++; cut(P.gnoon*Math.min(5,n)); }   // Glare of Noon
      if(s){ const r=recOf(T,s); if(P.ft&&r&&r.ft>0) cut(P.ft);                                          // False Target
        if(P.duel&&s===v.lastT) cut(P.duel);                                                             // Duelist's Stance
        if(P.gl&&T.fn.glOn(A,u,s)) cut(P.gl); }                                                          // a Glared attacker
      return Math.max(DR_FLOOR,k); },
    /* ---- A HIT ON HER: a Shimmer miss, Hide in the Heat (an ability), DR40, Not There (a big hit), what the hit was (the signature) ---- */
    myIn(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), s=c.src;
      if(s&&T.fn.missRoll(A,T,u,c)) return;
      if(P.hide&&!c.auto&&s){ const m=T.fn.nearMirage(A,T,u,u); if(m&&E.rnd()<P.hide){ E.damage(m,c.amt,'#ffd08a',true); c.amt=0; c.mv=0; return; } }
      c.amt*=T.fn.drK(A,T,u,s);
      if(P.nt&&c.amt>0.15*(u.maxHp||0)){ const m=T.fn.nearMirage(A,T,u,u); if(m){ const sh=Math.min(1,P.nt), x=c.amt*sh; c.amt-=x; c.mv=(c.mv==null?1:c.mv)*(1-sh); E.damage(m,x,'#ffd08a',true); } }
      v.lastIn=c.amt; v.lastInAge=0; },
    /* THEY FOLLOWED HER: once a fight, a hit that would kill her strikes her nearest mirage instead; she is held at 1 HP for 1 s; every Remembered rises */
    lethalF(A,T,u,c){ const v=V(T), E=A.eng(); if(v.tfh||!T.P.tfh) return; const m=T.fn.nearMirage(A,T,u,u); if(!m) return;
      v.tfh=1; v.stats.sig2++; E.damage(m,v.lastInAge<0.5?v.lastIn:0.1*(u.maxHp||0),'#ffd08a',true);
      T.s.undy=Math.max(T.s.undy||0,1); if(u.hp<1) u.hp=1; c.stop=true; v.riseQ=1; },
    rise(A,T,u){ const v=V(T), E=A.eng(), M=E.METER(); if(!u.alive||!E.summon) return; const n=v.rem, keep=u._zhCap; u._zhCap=99; v.rising=1;
      try{ for(let i=0;i<n;i++){ const a=(u.team==='ally'?-1:1)*(1.2+0.5*i), m=E.summon(u,MKEY,8,{a,r:1.6*M,share:0.5/0.30}); if(m){ m._zhRisen=1; v.risen.push(m); } } }
      finally{ v.rising=0; if(keep==null) delete u._zhCap; else u._zhCap=keep; } },
    /* ---- A MIRAGE OF HERS ARRIVES: its share of her stats (A Herd Again 20%, One True Shape 45%, One Horned Shape a point a rank per Remembered, Truer Than
       Most), Herd Memory's shield, One True Shape's Desert Momentum, Herdmate's share of hers ---- */
    summonF(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), m=c.unit; if(!m||m.key!==MKEY) return;
      if(!v.rising){ const s0=(E.skLvNum?E.skLvNum(BL,u.blueAb||{},(u.skillLv&&u.skillLv[2])||1):0.30)||0.30, fork=P.aha?2/3:(P.ots?1.5:1), want=s0*fork+(P.horn||0)*v.rem, f=want/s0;
        if(f!==1){ m.maxHp*=f; m.hp*=f; m.dmg*=f; }
        if(P.truer&&P.ots){ m.maxHp*=1+P.truer; m.hp*=1+P.truer; }
        if(P.ots){ m.pass=Object.assign({},m.pass||{},{desertmom:true}); m.passMul=u.passMul||1; } }
      if(P.hmem&&v.rem>0){ m.shield=(m.shield||0)+P.hmem*v.rem*(u.maxHp||0); m.shieldT=Math.max(m.shieldT||0,10); }
      if(P.mate&&u.pass&&u.pass.desertmom){ const as=(u._dmAS||0)*P.mate, pen=(u._dmPen||0)*P.mate; m._zhHmAS=as; m._zhHmPen=pen; if(m.pass&&m.pass.desertmom){ m._dmAS=Math.max(m._dmAS||0,as); m._dmPen=Math.max(m._dmPen||0,pen); m._zhHmAS=0; m._zhHmPen=0; } } },
    kpN(A,T,u,c){ const m=c&&c.tgt; if(!m||m._zhRisen) return 0; return 10000*0.01*rk(T,'hr_11_2')/T.fn.share(A,T,u); },   // a point a rank of her stats, on the share it was called with
    share(A,T,u){ const E=A.eng(), s0=(E.skLvNum?E.skLvNum(BL,u.blueAb||{},(u.skillLv&&u.skillLv[2])||1):0.30)||0.30; return s0*(T.P.aha?2/3:(T.P.ots?1.5:1)); },
    mateN(A,T,u,c){ const m=c&&c.tgt; return m?10000*(m._zhHmAS||0):0; },
    remN(A,T){ return V(T).rem; },
    rem5(A,T){ return V(T).rem>=5; },
    /* ---- A MIRAGE STRIKES: Two of Her, Herdmate's penetration, the zero armour, Shadowless ---- */
    sOutF(A,T,u,c){ const P=T.P, t=c.tgt, m=c.src; if(!t||t.team===u.team||!m||m.key!==MKEY) return; const r=rec(T,t);
      if(c.kind==='phys'){ if(m._zhHmPen>0) c.amt*=T.fn.penK(A,m,t,m._zhHmPen); }
      if(P.two&&r.zt>0) c.amt*=1+P.two; },
    sHitF(A,T,u,c){ const P=T.P, E=A.eng(), t=c.tgt, m=c.src; if(!t||!m||m.key!==MKEY) return; const r=rec(T,t); r.mt=2;
      if(has(T,SHIM)&&T.r.hr_1_4&&t.alive) T.fn.putShim(A,T,u,t,3+(P['shim.dur']||0));
      if(P.touch&&u.alive&&c.hpLost>0) E.healUnit(u,P.touch*c.hpLost); },
    /* ---- A UNIT FALLS: a mirage of hers (Remembered, Still Running, Who Followed, Grief Speed), a Sunlit enemy (Gap Finder) ---- */
    deathF(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), x=c.unit; if(!x) return;
      if(x._talS===u&&x.key===MKEY){ if(has(T,REM)&&v.rem<5){ v.rem++; v.stats.rem++; }
        if(P.still&&!x._zhRisen) u.blueCd=0;
        if(P.who) for(const e of A.pick(T,u,{team:'enemy',of:'unit',within:2},{u,unit:x})) T.fn.putShim(A,T,u,e,3);
        if(T.r.hr_6_1) A.acts(T,u,[{window:'zhGr',dur:4}],{u}); return; }
      if(x.team===u.team) return;
      const mk=A.markOf(u,x,'zhSun'); if(P.finder&&mk){ let b=null,bd=1e18; for(const y of E.units()){ if(!y.alive||y.team===u.team||y===x||y._dropHidden) continue; const d=E.dist(x,y); if(d<bd){ bd=d; b=y; } }
        if(b){ if(P.hio) T.fn.putSun(A,T,u,b,0); else if(mk.until!=null) T.fn.putSun(A,T,u,b,Math.max(0,mk.until-E.now())); } } },
    /* ---- CC30: Running Free (each banked Hoofbeat, stuns and fears) and Steady in the Heat (every control), one product floored at 0.70 ---- */
    ccK(A,T,u,c){ const v=V(T), P=T.P; let k=1; const f=c.field;
      if(P.rfree&&(f==='stunned'||f==='fearT')) k*=1-Math.min(1,P.rfree*v.hoof);
      if(P.steady&&['stunned','fearT','silencedT','_sleepT','slow'].indexOf(f)>=0) k*=1-Math.min(0.2,P.steady);
      c.amt*=Math.max(CC_FLOOR,k); },
    /* ---- her cooldowns: Mirage Herd (Called Closer), Solar Impalement (Spitting Sun) ---- */
    cdSet(A,T,u,c){ const P=T.P; let x=c.amt; if(c.slot==='green') x-=(P['cd.g']||0); else if(c.slot==='blue') x-=(P['cd.b']||0); c.amt=Math.max(0,x); },
    /* CRIT5: Sharp Horns, Sharp Sight, Sun Glint (Shimmering enemies within 5 m, 5 at most), Golden Hour (Desert Momentum full) - hundredths of a percent, 5% at most */
    critPool(A,T,u){ const P=T.P; let x=100*((P['cp.sh']||0)+(P['cp.ke']||0));
      if(P['cp.sg']){ let n=0; for(const e of A.pick(T,u,{team:'enemy',within:5},{u})) if(T.fn.shOn(A,u,e)) n++; x+=100*P['cp.sg']*Math.min(5,n); }
      if(P['cp.gh']&&dmFull(u)) x+=100*P['cp.gh'];
      return Math.min(CRIT_POOL,x); }
  },
  partial:{},
  ruling:{}
};
