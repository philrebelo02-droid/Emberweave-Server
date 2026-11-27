/* AURETH - what his learned talents do in a fight (the mechanics; his 11 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the Aureth section at its end: what he added)
   His real kit (the code, not the tooltip wording; damage profile Hybrid, so his skills read Ability Power with Duality's Dark buff, apB):
   - Basic attacks: 60% Attack (with the damage buff) + 60% Ability Power, one hit landing 70% physical / 30% magic (dealDamage kind 'split',
     tgt._splitLast keeps the two parts). His arms alternate LIGHT, DARK, LIGHT, DARK (u._atkArm 'attackLight' / 'attackDark', a counter, no RNG);
     a critical swing spends its arm's turn (it is the both-swords slice).
   - Sunburst ('sunburst', green, cd 8, delivered): every enemy within 2.8 m of him (centre to centre) takes 140% of apB (magic); every ally within
     2.8 m, himself included, is healed (healFrom) for 28% of ITS max HP.
   - Duality ('duality', blue, cd 6): flips u._darkStance. Into Dark: dmgBuffMul = o.mul || 1.4 for good (dmgBuffT 999). Into Light: every ally on
     the field (alliesOf: himself and summons too) gets shield = max(its shield, his max HP x (12% + a level step) + 2 x his ability power) for 6 s,
     and the Dark buff ends. Every wave starts in Light stance (beginWaveEnter clears _darkStance, the buff and every shield).
   - Eclipse (ultimate 'eclipse', delivered): every enemy within 6 m takes 220% of apB (magic) and a 0.6 s stun through ccApply (0.42 s after the
     cut); every ally on the field gets shield = max(its shield, ITS max HP x 40% + 4 x his ability power) for 6 s.
   - Twin Fonts (passive 'twinfonts'), every tick: in Dark stance the nearest enemy is drained (dealDamage, physical: his profile is not Magic,
     silent) for (40% AP + 2) a second x the passive's level, and he heals 80% of it; in Light stance he regenerates (1.2% max HP + 25% AP) a
     second x the passive's level, written straight onto his HP up to the cap (no healUnit). Both pass the 'num' hook ('tfDark' / 'tfLight').
   Hunger, Quiet, Overgrowth, Unending, the Scales and Weighed exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/15 - AURETH - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const SUN='sunburst', DUAL='duality', ECL='eclipse';
const SUN_HIT={team:'enemy',withinOpt:'radius',edge:true};   // the enemies Sunburst hits: since v1391 a Green Sunburst burns every enemy whose BODY is within its radius (its heal on allies keeps the centre)
/* the states several talents read: their bookkeeping runs when any of these is learned */
const HUN=['hb_1_1','hb_2_1','hb_3_1','hb_5_1','hb_7_1','hb_9_1','hb_10_1','hb_11_2','hb_12_3','hb_13_2'];
const QUI=['hb_1_4','hb_3_4','hb_5_2','hb_5_3','hb_6_3','hb_6_4','hb_7_4','hb_9_4','hb_10_4','hb_11_2','hb_12_4','hb_13_2'];
const WEI=['tb_1_4','tb_n1','tb_2_4','tb_3_4','tb_5_1','tb_6_1','tb_7_4','tb_9_4','tb_10_1','tb_11_4','tb_12_1','tb_13_3'];
const SCA=['tb_1_1','tb_3_1','tb_5_2','tb_5_3','tb_6_2','tb_8_3','tb_9_1','tb_10_3','tb_11_3','tb_12_1','tb_12_2','tb_12_3','tb_13_3'];
const OGR=['mb_1_4','mb_2_4','mb_3_4','mb_9_1','mb_10_4','mb_13_3'];
const UNE=['mb_1_3','mb_2_3','mb_7_1','mb_8_3','mb_9_3','mb_7_4','mb_13_3'];
const LSH=OGR.concat(UNE,['mb_5_2','mb_5_3','mb_6_1','mb_10_3','mb_11_3','mb_12_3','tb_11_3']);   // talents that read or change Duality's Light shield
const ESH=['mb_6_1','mb_8_2','tb_7_1','mb_10_3','mb_12_1','mb_7_4'];                              // ... Eclipse's team shield
const MINE=['out','dmg:fw','dmg:flash','dmg:drain'];       // damage FROM Aureth: his hits and the damage his talents deal
const RATE={b:1,r:-0.1,rk:'tb_12_2'};                      // the Scales' clock: Quiet Hours makes it 10% slower per rank
const ALLY_HIT={srcTeam:'enemy',targetTeam:'ally'};        // an enemy's hit on one of his allies (teamIn: never himself)
const dk=u=>!!u._darkStance;
const tot=(A,T)=>A.winOn(T,'tot');                          // Third of Three: both stances at once
const dkV=T=>1.4+(T.P['dk.add']||0);                        // Duality's Dark damage buff (Hungry Stance)
const allies=(E,u)=>E.units().filter(o=>o.alive&&o.team===u.team&&!o._dropHidden&&!(o._riseT>0));   // the units the game's own team shields reach (alliesOf)
module.exports={
  hero:'aureth',
  casting:true,                         // rows ask which of his skills a hit comes from
  states:{
    hun:{max:P('hun.max',10)},                                                    // Hunger (Never Full: up to 16)
    quiet:{unit:true,max:5,dur:P('q.dur',4),gain:'qg'},                           // Quiet on each enemy: all lapse 4 s after the last
    og:{max:{pct:P('og.cap',0),of:'maxHp'}},                                      // Overgrowth, in HP (its cap: Green and Unwilling, Rootbound, First Light)
    ogp:{max:100},                                                                // whole 1% steps of his max HP stored as Overgrowth (Overgrown Fists)
    sc:{max:10}                                                                   // the Scales: 0 = 5 Dark, 5 = level, 10 = 5 Light
  },
  needs:{ tb_12_1:'tb_10_1' },
  /* run for him whenever he has any mechanic talent: his stance, and the bookkeeping of the states his talents share */
  always:[
    {on:'wave',do:[{fn:'stanceSync'}]},                                                                          // the wave starts in Light stance: not a switch
    {on:'tick',do:[{fn:'stance'}]},                                                                              // 'switch', 'toDark', 'toLight' (Duality, a talent's turn, the passive's own)
    {on:'out',if:{any:[{p:'pen.arm'},{p:'pen.mr'},{p:'split.sh'},{p:'split.mag'}]},do:[{fn:'pen'}]},             // armor / magic resist ignored; the parts of his basic attack
    {on:'num',skill:'tfLight',do:[{fn:'regen'}]},                                                                // Light stance regeneration: rows 'rgMod', Overgrowth, Brother of Light
    {on:'kit',skill:DUAL,if:{p:'dk.add'},opt:{mul:{set:P('dk.add',1.4)}}},                                       // Duality's Dark buff (Hungry Stance)
    {on:'kit',skill:DUAL,req:'mb_5_2',do:[{fn:'wardSnap'}]},                                                     // Ward the One: his own shield before the cast
    {on:'cast',skill:DUAL,reqAny:LSH,do:[{fn:'lsCast'}]},                                                        // Duality's Light shield, as his talents change it
    {on:'cast',skill:ECL,reqAny:ESH,do:[{fn:'eclCast'}]},                                                        // Eclipse's team shield, as his talents change it
    /* Hunger: each basic attack or skill hit he lands in Dark stance; empties when he leaves Dark stance and at a wave's start */
    {on:'hit',reqAny:HUN,if:{fn:'hitDark'},do:[{stack:'hun',add:1}]},
    {on:'toLight',reqAny:HUN,unless:'hb_3_1',if:{noWindow:'wa'},do:[{stack:'hun',set:0}]},
    {on:'wave',reqAny:HUN,unless:'hb_3_1',do:[{stack:'hun',set:0}]},
    /* Quiet: each basic attack or skill hit he lands in Dark stance, on that enemy (max 5); 'q5' when one reaches 5 */
    {on:'hit',reqAny:QUI,if:{fn:'hitDark'},do:[{ustack:'quiet',on:'target',add:1}]},
    {on:'qg',reqAny:QUI,do:[{fn:'reach5'}]},
    /* Weighed: struck by his light-arm and his dark-arm basic attacks within 4 s */
    {on:'hit',reqAny:WEI,if:{auto:true,targetTeam:'enemy'},do:[{fn:'arm'}]},
    /* Overgrowth: start of a wave (the 1% steps for Overgrown Fists) */
    {on:'wave',reqAny:OGR,do:[{fn:'ogSync'}]},
    /* the Scales: start each wave level, tip 1 a second toward the stance he is in (not during Third of Three) */
    {on:'wave',reqAny:SCA,do:[{stack:'sc',set:5}]},
    {on:'tick',reqAny:SCA,if:{fn:'tipDark'},period:1,rate:RATE,do:[{fn:'tip',d:-1}]},
    {on:'tick',reqAny:SCA,if:{fn:'tipLight'},period:1,rate:RATE,do:[{fn:'tip',d:1}]}
  ],
  talents:{
    /* ============================== THE HUNGRY BROTHER ============================== */
    hb_1_1:[ {on:'num',skill:'tfDark',more:R(0.01),per:'hun'} ],                                               // Patient Hunger (Hunger: always rows)
    hb_2_3:[ {stat:{move:R(0.03)}} ],                                                                          // Wide Stance
    hb_1_4:[ {on:'teamHeal',if:{who:'enemy',unitUst:{quiet:1}},less:R(0.02),per:{ust:'quiet',of:'unit'}} ],    // Gone Quiet (Quiet: always rows)
    hb_2_1:[ {param:'hun.max',add:R(2)} ],                                                                     // Never Full (up to 16)
    hb_2_2:[ {on:'out',if:{fn:'darkArm'},more:R(0.03)} ],                                                      // Dark Arm
    hb_3_1:[ {on:'tick',if:{fn:'notDark',stackMin:{hun:1}},period:2,do:[{stack:'hun',add:-1}]} ],             // Hunger Outlasts: runs down 1 every 2 s out of Dark stance
    hb_3_3:[ {param:'pen.arm',add:R(0.02)} ],                                                                  // Through Plate (the always 'pen' row)
    hb_3_4:[ {param:'q.dur',add:R(0.4)} ],                                                                     // Long Silence
    hb_4_2:[ {on:'crit',if:{fn:'darkArm'},chance:R(0.015),force:true} ],                                       // Dark Swing (4.5% at 3/3: the 5% crit-chance cap)
    hb_4_3:[ {param:'dk.add',add:R(0.02)} ],                                                                   // Hungry Stance: 1.40 -> 1.46
    hb_5_4:[ {on:'num',skill:'tfDark',more:R(0.02)} ],                                                         // Deep Drain
    hb_5_1:[ {stat:{mr:R(0.02)},if:{stackMin:{hun:5}}} ],                                                      // Hollow Room
    hb_6_1:[ {on:MINE,if:{fn:'isDark'},more:R(0.02)}, {on:'rgMod',less:R(0.05)} ],                             // Starve the Light (RISK)
    hb_7_3:[ {on:'out',if:{casting:SUN},more:R(0.03)} ],                                                       // Dark Flash
    hb_6_4:[ {on:'teamIn',if:Object.assign({srcUst:{quiet:5}},ALLY_HIT),less:R(0.04)}, {on:'in',if:{srcUst:{quiet:5}},less:R(0.04)} ],   // Hush
    hb_7_1:[ {stat:{lifesteal:R(0.003)},per:'hun'} ],                                                          // Eat Well
    hb_8_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                             // Quick Turn
    hb_8_2:[ {on:'out',if:{casting:ECL},more:R(0.03)} ],                                                       // Noon Goes Dark
    hb_5_2:[ {on:'q5',do:[{mark:'nohl',on:'target',dur:2}]}, {on:'teamHeal',if:{unitHas:'nohl'},mul:0} ],      // Then Dark (PICK ONE): reaching 5 Quiet, no healing for 2 s
    hb_5_3:[ {on:'q5',do:[{fn:'still'}]},                                                                      // Then Still (PICK ONE): cannot move for 1 s, its Quiet empties
             {stat:{move:-1},to:{team:'enemy',has:'root'},if:{window:'rootW'}} ],
    hb_7_4:[ {on:'out',if:{auto:true,fn:'isDark',targetUst:{quiet:1}},more:R(0.01),per:{ust:'quiet'}} ],       // Gnawing
    hb_9_1:[ {on:'in',if:{stackFull:'hun'},less:R(0.015)} ],                                                   // Gorged
    hb_9_3:[ {param:'pen.mr',add:R(0.015)} ],                                                                  // Edge of Night
    hb_6_3:[ {on:'rooted',do:[{after:0,do:[{ustack:'quiet',on:{team:'enemy',of:'target',skip:'target',n:1},add:R(1)}]}]} ],   // Stillness Spreads
    hb_9_4:[ {on:'cast',skill:SUN,if:{fn:'isDark'},do:[{ustack:'quiet',on:SUN_HIT,add:2},{fn:'drainEach'}]} ],   // Last Word Taken
    hb_10_1:[ {on:'wave',do:[{stack:'hun',atLeast:R(1)}]} ],                                                   // Hunger Wakes
    hb_10_4:[ {on:'death',if:{who:'enemy',unitUst:{quiet:1}},do:[{heal:{pct:R(0.005),of:'maxHp'},on:'self'}]} ],   // Lean Fang
    hb_11_1:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                        // Bitter Root
    hb_11_2:[ {on:'cast',skill:ECL,if:{fn:'isDark'},do:[{mark:'hc',on:{team:'enemy',withinOpt:'radius'},dur:6},{ustack:'quiet',on:{team:'enemy',withinOpt:'radius'},add:5},{stack:'hun',set:'max'}]} ],   // The Hand Closes
    hb_11_3:[ {on:'in',less:R(0.01)} ],                                                                        // Shadow Skin
    hb_10_2:[ {param:'split.mag',add:R(0.03)} ],                                                               // Weight of Night (the always 'pen' row)
    hb_12_2:[ {on:MINE,if:{targetHas:'hc'},more:R(0.02)} ],                                                    // Long Eclipse
    hb_12_3:[ {stat:{atk:R(0.002)},per:'hun'} ],                                                               // Old Darkness
    hb_12_4:[ {on:'death',if:{who:'enemy',unitUst:{quiet:1}},do:[{ustack:'quiet',on:{team:'enemy',of:'unit',n:1},add:R(1)}]} ],   // Nothing Left
    hb_13_2:[ {on:'tick',if:{fn:'darkFull'},icd:25,do:[{window:'sp',dur:5}]},                                 // The Second Brother Speaks (SIGNATURE)
              {on:'num',skill:'tfDark',if:{window:'sp'},mul:3},
              {on:'hit',if:{window:'sp',fn:'hitDark'},do:[{ustack:'quiet',on:'target',add:1}]},                //   every hit adds 2 Quiet (1 more than the always row)
              {on:'q5',if:{window:'sp'},do:[{stun:1,on:'target'}]},                                            //   stunned 1 s, in full
              {on:'end:sp',do:[{fn:'turn',to:'light'}]} ],                                                     //   then Duality turns him to Light stance

    /* ============================== THE MENDING BROTHER ============================== */
    mb_1_1:[ {on:'in',if:{fn:'isLight'},less:R(0.012)} ],                                                      // Steady Light
    mb_1_3:[ {on:'tick',if:{window:'unW'},period:1,do:[{heal:{pct:R(0.002),of:'tgtMaxHp'},on:{team:'ally',has:'un'},tag:'ah'}]} ],   // Refuses to End (Unending: lsCast / eclCast)
    mb_1_4:[ {param:'og.cap',add:R(0.05)} ],                                                                   // Green and Unwilling (storing: regen; spending: lsCast)
    mb_2_3:[ {param:'un.dur',add:R(0.5)} ],                                                                    // Long Green
    mb_2_4:[ {param:'og.cap',add:R(0.02)} ],                                                                   // Rootbound
    mb_3_1:[ {on:'toLight',do:[{window:'mp',dur:4}]}, {stat:{armor:R(0.015)},if:{window:'mp'}} ],              // Mended Plate
    mb_3_2:[ {stat:{mr:R(0.02)},if:{fn:'isLight'}} ],                                                          // Patient Light
    mb_3_4:[ {param:'ovf',add:1} ],                                                                            // Overflowing (in lsCast)
    mb_4_2:[ {on:'cast',skill:SUN,do:[{heal:{pct:R(0.01),of:'tgtMaxHp'},on:{team:'ally',withinOpt:'radius'},tag:'ah'}]} ],   // Kind Flash
    mb_4_3:[ {on:'hit',if:{fn:'lightArm'},do:[{heal:{pct:R(0.04),of:'hit'},on:{team:'ally',within:5,others:true,order:'lowHp',n:1},tag:'ah'}]} ],   // Bright Hand
    mb_4_4:[ {on:'ccIn',less:R(0.04)} ],                                                                       // Still Room (up to 20%)
    mb_5_1:[ {stat:{move:R(0.03)}} ],                                                                          // Light Feet
    mb_5_2:[ {param:'ward1',add:1} ],                                                                          // Ward the One (PICK ONE: in lsCast)
    mb_5_3:[ {param:'wardN',add:1} ],                                                                          // Ward the Many (PICK ONE: in lsCast)
    mb_6_3:[ {on:'cd',skill:'green',add:R(-0.15)} ],                                                           // Golden Flash
    mb_6_1:[ {param:'sh.str',add:R(0.04)} ],                                                                   // Bright Shell (every shield of his)
    mb_6_2:[ {on:'teamIn',if:Object.assign({targetHas:'ward'},ALLY_HIT),less:R(0.02)} ],                       // Chosen Ally
    mb_8_2:[ {param:'ecl.sh',add:R(0.04)} ],                                                                   // Ring of Fire, Ring of Shade
    mb_6_4:[ {on:'rgMod',more:R(0.05)} ],                                                                      // Closing Wounds
    mb_7_1:[ {on:'teamIn',if:{targetTeam:'enemy',srcHas:'un'},more:R(0.01)} ],                                 // Gentle Pressure (his own hits too: teamIn sees them on the enemy)
    mb_7_4:[ {on:'cast',skill:ECL,do:[{fn:'unend',on:'all'}]} ],                                               // Zenith
    mb_8_3:[ {on:'teamHeal',if:{unitHas:'un'},more:R(0.02)}, {on:'healMe',if:{targetHas:'un'},more:R(0.02)} ], // Grown Green
    mb_8_4:[ {on:'in',less:R(0.01)} ],                                                                         // Root Deep
    mb_9_1:[ {stat:{atk:R(0.004)},per:'ogp'} ],                                                                // Overgrown Fists
    mb_9_3:[ {on:'teamLethal',if:{unitHas:'wnH'},do:[{atOne:'unit'}]},                                         // Will Not End: held through the rest of that first 1 s
             {on:'teamLethal',by:'unit',once:'wave',if:{who:'ally',unitHas:'un1'},do:[{atOne:'unit'},{fn:'wnHold'}]},
             {on:'lethal',once:'wave',if:{fn:'selfUn1'},do:[{fn:'wnSelf'}]} ],
    mb_10_2:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                            // Sun at Rest
    mb_10_3:[ {on:'heal:ah',if:{fn:'ce'},more:R(0.03)}, {on:'healOut',if:{fn:'ce'},more:R(0.03)} ],            // Clear Eyes (shields: in lsCast / eclCast / shieldMul)
    mb_10_4:[ {param:'og.cap',add:R(0.01)}, {on:'wave',do:[{stack:'og',atLeast:{pct:R(0.01),of:'maxHp'}},{fn:'ogSync'}]} ],   // First Light
    mb_11_1:[ {on:'in',if:{kind:'magic'},less:R(0.015)} ],                                                     // Even Light
    mb_11_3:[ {param:'ls.dur',add:R(0.5)} ],                                                                   // Light Holds
    mb_11_4:[ {param:'bol',add:1} ],                                                                           // Brother of Light (in regen)
    mb_12_1:[ {param:'ecl.dur',add:R(0.5)} ],                                                                  // Sun-Warmed
    mb_12_2:[ {on:'teamIn',if:Object.assign({targetWithin:3},ALLY_HIT),less:R(0.01)} ],                        // Lamp Bearer
    mb_12_3:[ {on:'tick',if:{fn:'dshOn'},period:1,do:[{heal:{pct:R(0.003),of:'maxHp'},on:'self'}]} ],          // Longer Than Light
    mb_12_4:[ {on:'healMe',if:{fn:'isLight'},more:R(0.03)}, {on:'rgMod',more:R(0.03)} ],                       // Mending Light (his Light stance regeneration too)
    mb_13_3:[ {on:'teamLethal',icd:30,if:{who:'ally',unitWithin:6},do:[{atOne:'unit'},{fn:'grows'}]} ],        // Everything Grows Back (SIGNATURE)

    /* ============================== THE THIRD BROTHER ============================== */
    tb_1_1:[ {on:MINE,unless:'tb_5_2',if:{fn:'lvl1'},more:R(0.02)}, {on:'in',unless:'tb_5_2',if:{fn:'lvl1'},less:R(0.02)} ],   // The Scales (Scales: always rows)
    tb_2_2:[ {stat:{move:R(0.03)}} ],                                                                          // Both Feet
    tb_1_4:[ {on:MINE,if:{targetHas:'wd'},more:R(0.02)} ],                                                     // Weighed (Weighing: always row)
    tb_n1:[  {on:'weighed',do:[{mark:'wa1',on:'target'}]}, {on:'out',if:{targetHas:'wa1',fn:'myHit'},more:0.08,do:[{mark:'wa1',on:'target',clear:true}]},   // Weight of Appetite (LINK)
             {on:'weighed',req:'hb_1_1',do:[{stack:'hun',add:1},{window:'wa',dur:4}]} ],                       //   with Patient Hunger
    tb_2_3:[ {param:'split.sh',add:R(0.04)} ],                                                                 // Even Split: 70/30 -> 50/50 (the always 'pen' row)
    tb_2_4:[ {param:'w.dur',add:R(0.5)} ],                                                                     // Heavy Verdict
    tb_3_1:[ {on:'cd',skill:'blue',if:{fn:'lvl1'},add:R(-0.2)} ],                                              // Fine Balance
    tb_3_2:[ {param:'pen.arm',add:R(0.015)}, {param:'pen.mr',add:R(0.015)} ],                                  // Two Points
    tb_4_3:[ {on:'out',if:{auto:true,crit:true},more:R(0.04)} ],                                               // Both Hands: his critical basic attack (the both-swords slice)
    tb_3_4:[ {on:'switch',do:[{dmg:{pct:0.25,of:'atk'},on:{team:'enemy',within:5,has:'wd'},def:'phys',tag:'fw'},{dmg:{pct:0.25,of:'atk'},on:{team:'enemy',within:5,has:'wd'},def:'magic',tag:'fw'}]} ],   // Found Wanting
    tb_4_2:[ {on:'out',if:{casting:SUN},more:R(0.05)} ],                                                       // Brighter Burst
    tb_5_2:[ {on:'num',skill:'tfDark',if:{fn:'endDark'},more:0.25}, {on:'rgMod',if:{fn:'endLight'},more:0.25}, {on:'tick',do:[{fn:'low'}]} ],   // Let One Win (PICK ONE)
    tb_5_3:[ {param:'nw',add:1} ],                                                                             // Neither Wins (PICK ONE: in tip)
    tb_5_1:[ {stat:{aspd:R(0.01)},per:{units:{team:'enemy',within:5,has:'wd'}}} ],                             // Measured Blows
    tb_6_1:[ {on:'out',if:{targetHas:'wd'},critMore:R(0.04)} ],                                                // Steady Weight
    tb_6_2:[ {on:'out',if:{casting:SUN,fn:'atEnd'},more:R(0.04)} ],                                            // Tipped
    tb_5_4:[ {on:'switch',do:[{heal:{pct:R(0.006),of:'maxHp'},on:'self'}]} ],                                  // Middle Path
    tb_7_1:[ {param:'ecl.sh',add:R(0.04)} ],                                                                   // Two Rings
    tb_7_2:[ {on:'out',if:{casting:ECL},more:R(0.03)} ],                                                       // Measured Dark
    tb_6_4:[ {on:'cast',skill:SUN,do:[{heal:{pct:R(0.01),of:'maxHp',x:{units:SUN_HIT}},on:'self'}]} ],   // Same Flash
    tb_8_3:[ {on:'tick',regen:true,if:{fn:'lvl0'},do:[{fn:'hps',p:R(0.003)}]} ],                                         // Long Pause: 0.3% of his max HP a second, each tick it sits level (v1464: regeneration - inside the engine's 1.2%/s allowance, with Both Fonts)
    tb_7_4:[ {on:'in',if:{srcHas:'wd'},less:R(0.01)} ],                                                        // Counterweight
    tb_8_4:[ {stat:{armor:R(0.02)},if:{fn:'isLight'}} ],                                                       // Keeper's Hide
    tb_9_1:[ {on:'cast',skill:ECL,do:[{fn:'weighAll'},{stack:'sc',set:5}]} ],                                  // Noon and Midnight
    tb_10_3:[ {on:'tick',regen:true,if:{fn:'lvl1'},do:[{fn:'fonts',k:R(0.06)}]} ],                                        // Both Fonts: the other font at 6% per rank, each tick (v1464: regeneration - inside the 1.2%/s allowance; Twin Fonts' own Light regeneration is the kit's, untouched)
    tb_9_4:[ {on:'out',if:{casting:SUN,targetHas:'wd'},more:R(0.03)} ],                                        // Judged Twice
    tb_10_1:[ {on:'death',if:{unitHas:'wd'},do:[{fn:'passOn',dur:R(1)}]} ],                                    // Weigh Them All
    tb_10_4:[ {stat:{mr:R(0.02)},if:{fn:'isDark'}} ],                                                          // Calm Centre
    tb_11_2:[ {on:'in',less:R(0.01)} ],                                                                        // Grey Hour
    tb_11_3:[ {on:'kit',skill:DUAL,do:[{fn:'hbSnap'}]}, {on:'cast',skill:DUAL,do:[{fn:'holdBoth'}]} ],          // Hold Both
    tb_11_4:[ {stat:{move:R(-0.02)},to:{team:'enemy',has:'wd'},if:{window:'wdW'}} ],                           // Weighed Down
    tb_12_1:[ {on:'wta',do:[{fn:'settle',n:R(1)}]} ],                                                          // Scales Settle
    tb_12_2:[ {param:'qh',add:1} ],                                                                            // Quiet Hours (the always rows' clock)
    tb_12_3:[ {on:MINE,if:{window:'hb'},more:R(0.02)} ],                                                       // Every Weight
    tb_12_4:[ {on:'tick',do:[{weaken:'slowMul',by:R(0.08)}]} ],                                                // Even Temper (up to 24%)
    tb_13_3:[ {on:'hit',if:{targetHas:'wd',fn:'myHitLevel'},icd:25,do:[{window:'tot',dur:5},{fn:'totStart'}]},   // Third of Three (SIGNATURE)
              {on:'hit',if:{window:'tot',fn:'myHit',targetTeam:'enemy'},do:[{fn:'weigh'}]},                    //   every hit Weighs
              {on:'tick',if:{window:'tot'},do:[{fn:'totKeep'}]},                                               //   Duality's Dark buff held for the 5 s
              {on:'tick',if:{window:'tot'},do:[{fn:'fonts',k:1}]},                                             //   the other font in full, each tick
              {on:'tick',if:{window:'tot'},period:1,do:[{fn:'flash'}]},                                        //   each second: Sunburst's damage at half strength around him
              {on:'end:tot',do:[{fn:'totEnd'}]} ]
  },
  fn:{
    /* ---- his stance ---- */
    isDark(A,T,u){ return dk(u)||tot(A,T); }, isLight(A,T,u){ return !dk(u)||tot(A,T); }, notDark(A,T,u){ return !dk(u); },
    stanceSync(A,T,u){ T.s.dk=dk(u); },
    stance(A,T,u,c){ const d=dk(u); if(T.s.dk==null){ T.s.dk=d; return; } if(d===T.s.dk) return; T.s.dk=d;
      A.run(T,u,'switch',c); A.run(T,u,d?'toDark':'toLight',c); },
    /* a turn by Duality that his talent makes (no cooldown spent): to 'light' / 'dark', only if he is not in it already */
    turn(A,T,u,c,a){ if(!u.alive||(a.to==='light')===!dk(u)) return; A.acts(T,u,[{castSkill:'blue',on:'self'}],c); },
    hps(A,T,u,c,a){ const x=(u.maxHp||0)*(a.p||0)*(c.dt||0); if(x>0) A.eng().healUnit(u,x); },
    darkFull(A,T,u){ return dk(u)&&A.stGet(T,'hun')>0&&A.stGet(T,'hun')>=A.stMax(T,u,'hun')-1e-9; },
    /* ---- his hits: a basic attack, or a hit of Sunburst / Eclipse (never Twin Fonts' drain, never a talent's own damage) ---- */
    myHit(A,T,u,c){ return !!c.auto||T.s.cur===SUN||T.s.cur===ECL; },
    hitDark(A,T,u,c){ return !!c.tgt&&c.tgt.team!==u.team&&(dk(u)||tot(A,T))&&(!!c.auto||T.s.cur===SUN||T.s.cur===ECL); },
    darkArm(A,T,u,c){ return !!c.auto&&u._atkArm==='attackDark'; }, lightArm(A,T,u,c){ return !!c.auto&&u._atkArm==='attackLight'&&!!c.tgt&&c.tgt.team!==u.team; },
    /* armor and magic resist ignored (Through Plate, Edge of Night, Two Points) and the two parts of his basic attack (Even Split, Weight of Night).
       A split hit: ctx.amt is (physical part + magic part) after their defences, times the crit; tgt._splitLast holds the two parts of THIS hit */
    pen(A,T,u,c){ const E=A.eng(), t=c.tgt; if(!t||!(c.amt>0)) return; const pa=T.P['pen.arm']||0, pm=T.P['pen.mr']||0;
      const ign=(k,x)=>{ if(!(x>0)) return 1; const a=E.defMul(u,t,k); if(!(a>0)) return 1; let b;
        if(k==='phys'){ const sv=u._wpnArmIgn; u._wpnArmIgn=1-(1-(sv||0))*(1-Math.min(1,x)); b=E.defMul(u,t,k); u._wpnArmIgn=sv; }
        else { const sv=t.mrRating; t.mrRating=(sv||0)*Math.max(0,1-x); b=E.defMul(u,t,k); t.mrRating=sv; } return b/a; };
      if(c.kind==='split'){ const L=t._splitLast, sp=u.t&&u.t.autoSplit; if(!L||!sp) return; const ph=L.phys||0, mg=L.mag||0; if(!(ph+mg>0)) return;
        const s=Math.min(sp.phys,T.P['split.sh']||0), ph2=sp.phys>0?ph*(sp.phys-s)/sp.phys*ign('phys',pa):0, mg2=(sp.mag>0?mg*(sp.mag+s)/sp.mag:0)*ign('magic',pm)*(1+(T.P['split.mag']||0));
        c.amt*=(ph2+mg2)/(ph+mg); return; }
      if(c.kind==='phys') c.amt*=ign('phys',pa); else if(c.kind==='magic') c.amt*=ign('magic',pm); },
    /* ---- Twin Fonts ---- */
    /* Light stance regeneration this tick (ctx.amt): 'rgMod' rows change it; what would pass his cap is stored as Overgrowth; Brother of Light heals the allies within 3 m for half */
    regen(A,T,u,c){ if(T.on.rgMod) A.run(T,u,'rgMod',c); const E=A.eng(), x=Math.max(0,c.amt);
      if((T.P['og.cap']||0)>0){ const over=u.hp+x-E.healCap(u); if(over>0){ A.stSet(T,u,'og',A.stGet(T,'og')+over); syncP(A,T,u); } }
      if(T.P.bol&&x>0){ const L=A.pick(T,u,{team:'ally',within:3,others:true},c); if(L.length){ const lo=ceOf(A,T,u,c); for(const a of L) if(a.alive) E.healUnit(a,x*0.5*(a===lo?1+0.03*(T.r.mb_10_3||0):1)); } } },
    ogSync(A,T,u){ syncP(A,T,u); },
    /* the font he is not in, for this tick at strength a.k (Both Fonts; Third of Three in full): in Dark, Light's regeneration; in Light, Dark's drain on the nearest enemy */
    fonts(A,T,u,c,a){ const E=A.eng(), k=(a.k||0)*(c.dt||0); if(!(k>0)||!E.twinMul) return; const m=E.twinMul(u);
      if(dk(u)){ const c2={u,tgt:u,amt:(u.maxHp*0.012+(u.apow||0)*0.25)*m*k}; if(T.on.rgMod) A.run(T,u,'rgMod',c2); if(c2.amt>0) E.healUnit(u,c2.amt); }
      else { const e=A.pick(T,u,{team:'enemy',n:1},c)[0]; if(e) drainOne(A,T,u,e,m*k,c); } },
    /* Last Word Taken: every enemy Sunburst hit in Dark stance is drained once, 1 s of Twin Fonts' drain */
    drainEach(A,T,u,c){ const E=A.eng(); if(!E.twinMul) return; const m=E.twinMul(u); for(const e of A.pick(T,u,SUN_HIT,c)) drainOne(A,T,u,e,m,c); },
    /* ---- Quiet ---- */
    reach5(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; const n=A.ustGet(T,u,t,'quiet'); if(n>=5-1e-9&&n-(c.k||0)<5-1e-9) A.run(T,u,'q5',Object.assign({},c,{tgt:t,unit:t})); },
    still(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; A.setMark(T,u,t,'root',{dur:1}); A.acts(T,u,[{window:'rootW',dur:1,longest:true}],c); A.ustPut(T,u,t,'quiet',0); A.run(T,u,'rooted',c); },
    /* ---- Weighed ---- */
    arm(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; const me=u._atkArm==='attackDark'?'da':'la', other=me==='da'?'la':'da';
      A.setMark(T,u,t,me,{dur:4}); if(A.markOf(u,t,other)) weigh(A,T,u,t,4+(T.P['w.dur']||0),c); },
    weigh(A,T,u,c){ if(c.tgt&&c.tgt.alive) weigh(A,T,u,c.tgt,4+(T.P['w.dur']||0),c); },
    weighAll(A,T,u,c){ for(const e of A.pick(T,u,{team:'enemy',withinOpt:'radius'},c)) weigh(A,T,u,e,4+(T.P['w.dur']||0),c); },
    /* Weigh Them All: the nearest enemy to the one that fell, Weighed 1 s per rank; then 'wta' (Scales Settle) */
    passOn(A,T,u,c,a){ const n=A.pick(T,u,{team:'enemy',of:'unit',n:1},c)[0]; if(!n) return; weigh(A,T,u,n,a.dur||1,c); A.run(T,u,'wta',Object.assign({},c,{tgt:n})); },
    /* ---- the Scales ---- */
    tipDark(A,T,u){ return dk(u)&&!tot(A,T); }, tipLight(A,T,u){ return !dk(u)&&!tot(A,T); },
    tip(A,T,u,c,a){ const lo=T.P.nw?3:0, hi=T.P.nw?7:10, v=A.stGet(T,'sc'); A.stSet(T,u,'sc',Math.max(lo,Math.min(hi,v+(a.d||0)))); },
    settle(A,T,u,c,a){ const v=A.stGet(T,'sc'), n=Math.round(a.n||1); A.stSet(T,u,'sc',v>5?Math.max(5,v-n):Math.min(5,v+n)); },
    lvl1(A,T){ return T.s.k.sc!=null&&Math.abs(A.stGet(T,'sc')-5)<=1; }, lvl0(A,T){ return T.s.k.sc!=null&&A.stGet(T,'sc')===5; },
    atEnd(A,T){ const v=A.stGet(T,'sc'); return T.s.k.sc!=null&&(v===0||v===10); },
    endDark(A,T,u){ return dk(u)&&T.s.k.sc!=null&&A.stGet(T,'sc')===0; }, endLight(A,T,u){ return !dk(u)&&A.stGet(T,'sc')===10; },
    myHitLevel(A,T,u,c){ return (!!c.auto||T.s.cur===SUN||T.s.cur===ECL)&&T.s.k.sc!=null&&A.stGet(T,'sc')===5; },
    /* Let One Win: at 5 Dark, Duality's Dark damage bonus 25% stronger (written into the game's buff while it is his Dark buff, put back after) */
    low(A,T,u){ const v=dkV(T), b=1+(v-1)*1.25, want=dk(u)&&(u.dmgBuffT||0)>0&&A.stGet(T,'sc')===0;
      if(want&&u.dmgBuffMul===v) u.dmgBuffMul=b; else if(!want&&u.dmgBuffMul===b&&(u.dmgBuffT||0)>0) u.dmgBuffMul=v; },
    /* ---- the shields ---- */
    wardSnap(A,T,u){ T.s.ws=dk(u)?[u.shield||0,u.shieldT||0]:null; },                                           // about to turn Light: what his own shield was
    hbSnap(A,T,u){ T.s.hb0=lvl(A,T,1); },                                                                       // Hold Both: the Scales as Duality is cast
    /* Duality cast. Into Light: the game has given every ally max(its shield, sh) for 6 s; his talents make it stronger (Bright Shell; Clear Eyes on the
       lowest-health ally within 6 m; Ward the Many within 4 m; Ward the One: the lowest-health other ally gets 130% and Aureth gives his up), longer
       (Light Holds), add the stored Overgrowth (Overflowing: half of it again to the lowest-health ally within 6 m), and make them Unending */
    lsCast(A,T,u,c){ if(dk(u)) return; lightShield(A,T,u,c,false); },
    holdBoth(A,T,u,c){ const was=T.s.hb0; T.s.hb0=false; if(!was) return; A.acts(T,u,[{window:'hb',dur:3}],c);
      if(dk(u)) lightShield(A,T,u,c,true); else dkOn(T,u,3); },
    eclCast(A,T,u,c){ const E=A.eng(), o=c.o||{}, k0=(1+(T.P['sh.str']||0))*(1+(T.P['ecl.sh']||0)), d=6+(T.P['ecl.dur']||0), lo=ceOf(A,T,u,c), ce=1+0.03*(T.r.mb_10_3||0);
      for(const a of allies(E,u)){ const k=k0*(a===lo?ce:1), sh=(a.maxHp*(o.shield||0.4)+(u.apow||0)*4)*k; if(k>1+1e-12&&sh>(a.shield||0)) a.shield=sh; if(d>6) a.shieldT=Math.max(a.shieldT||0,d); } },
    unend(A,T,u,c,a){ unend(A,T,u,a.on==='all'?A.pick(T,u,{team:'ally'},c):A.pick(T,u,a.on,c),a.dur!=null?a.dur:3+(T.P['un.dur']||0),c); },
    dshOn(A,T,u){ return !!A.markOf(u,u,'dsh'); },
    /* ---- Will Not End: the first 1 s of being Unending, once per ally per wave ---- */
    wnHold(A,T,u,c){ const x=c.unit, m=A.markOf(u,x,'un1'); if(x&&m&&m.until!=null) A.setMark(T,u,x,'wnH',{dur:Math.max(0.05,m.until-A.eng().now())}); },
    selfUn1(A,T,u){ return !!A.markOf(u,u,'un1'); },
    wnSelf(A,T,u,c){ const m=A.markOf(u,u,'un1'); T.s.undy=Math.max(T.s.undy||0,m&&m.until!=null?Math.max(0.05,m.until-A.eng().now()):0.05); if(u.hp<1) u.hp=1; c.stop=true; },
    /* Everything Grows Back: the ally is healed to 40% of its max HP; every ally within 6 m of Aureth (himself included) is Unending for 5 s and shares the
       Overgrowth as shields; then, from Light stance, Duality turns him to Dark (on his next tick: never inside the blow) */
    grows(A,T,u,c){ const x=c.unit; if(x&&x.alive) x.hp=Math.max(x.hp,0.4*x.maxHp); const L=A.pick(T,u,{team:'ally',within:6},c); unend(A,T,u,L,5,c);
      const og=A.stGet(T,'og'); if(og>0&&L.length){ const k=1+(T.P['sh.str']||0); for(const a of L){ a.shield=(a.shield||0)+og/L.length*k; a.shieldT=Math.max(a.shieldT||0,6); } A.stSet(T,u,'og',0); syncP(A,T,u); }
      A.acts(T,u,[{after:0,do:[{fn:'turn',to:'dark'}]}],c); },
    /* Clear Eyes: the lowest-health other ally within 6 m (the unit a heal goes to) */
    ce(A,T,u,c){ return !!c.tgt&&c.tgt===ceOf(A,T,u,c); },
    /* ---- Third of Three ---- */
    totStart(A,T,u){ dkOn(T,u,5); },
    totKeep(A,T,u){ const w=T.s.w.tot; if(w&&w.t>0) dkOn(T,u,w.t); },
    totEnd(A,T,u){ const v=A.stGet(T,'sc'); A.stSet(T,u,'sc',Math.max(T.P.nw?3:0,Math.min(T.P.nw?7:10,v+(dk(u)?-5:5)))); if(!dk(u)&&u.dmgBuffMul===dkV(T)) u.dmgBuffT=0; },
    /* Sunburst's damage at half strength around him (its own circle, centre to centre; magic; at his Sunburst level, with the Dark buff as the skill reads it) */
    flash(A,T,u,c){ const E=A.eng(), g=u.greenAb; if(!g) return; const lv=(u.skillLv&&u.skillLv[1])||1, sm=E.skillMul?E.skillMul(lv):1, R=g.radius||2.8*E.METER();
      const ap=(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*sm*(g.mul||1.4)*0.5*E.rage();
      A.acts(T,u,[{dmg:ap,on:{team:'enemy',withinOpt:'radius'},def:'magic',tag:'flash'}],Object.assign({},c,{o:{radius:R}})); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/15 - AURETH - talent decisions.md) */
  ruling:{}
};
/* ---- helpers (not rows) ---- */
function lvl(A,T,w){ return T.s.k.sc!=null&&Math.abs(A.stGet(T,'sc')-5)<=w; }
function syncP(A,T,u){ if(!(u.maxHp>0)) return; A.stSet(T,u,'ogp',Math.floor(A.stGet(T,'og')/u.maxHp*100+1e-9)); }
function ceOf(A,T,u,c){ if(!T.r.mb_10_3) return null; return A.pick(T,u,{team:'ally',within:6,others:true,order:'lowHp',n:1},c)[0]||null; }
/* Duality's Dark damage buff on him for d seconds (Hold Both, Third of Three): never weakens a stronger damage buff he already has */
function dkOn(T,u,d){ const v=dkV(T), on=(u.dmgBuffT||0)>0; if(on&&(u.dmgBuffMul||1)>v) return; u.dmgBuffMul=v; u.dmgBuffT=Math.max(on?u.dmgBuffT:0,d); }
/* Unending on those units for d s (refreshed, never shortened); a unit that was not Unending also gets its first 1 s (Will Not End) */
function unend(A,T,u,L,d,c){ if(!T.r.mb_1_3&&!T.r.mb_13_3) return; let any=false;
  for(const x of L){ if(!x||!x.alive) continue; const had=!!A.markOf(u,x,'un'); A.setMark(T,u,x,'un',{dur:d,longest:true}); if(!had) A.setMark(T,u,x,'un1',{dur:1}); any=true; }
  if(any) A.acts(T,u,[{window:'unW',dur:d,longest:true}],c); }
/* Weighed on t for d s (a shorter one never cuts a longer one); 'weighed' when it was not Weighed before */
function weigh(A,T,u,t,d,c){ const had=!!A.markOf(u,t,'wd'); A.setMark(T,u,t,'wd',{dur:d,longest:true}); A.acts(T,u,[{window:'wdW',dur:d,longest:true}],c);
  if(!had&&T.on.weighed) A.run(T,u,'weighed',Object.assign({},c,{tgt:t,unit:t})); }
/* one drain of Twin Fonts at strength m (the passive's level, x a share) on e: its 'num' rows (Hunger, Deep Drain, the signature...), the target's armor (the
   drain is physical), his heal of 80% of it as the passive heals */
function drainOne(A,T,u,e,m,c){ const E=A.eng(); if(!e||!e.alive) return; const c2={u,skill:'tfDark',amt:((u.apow||0)*0.4+2)*m,tgt:e};
  const rows=T.on.num; if(rows) A.run(T,u,'num',c2); const x=Math.max(0,c2.amt); if(!(x>0)) return;
  A.acts(T,u,[{dmg:x,on:'target',def:'phys',tag:'drain'}],Object.assign({},c,{tgt:e})); if(u.alive) E.healUnit(u,x*0.8); }
/* Duality's Light shield as his talents change it. made: the game did not write it (Hold Both into Dark): give it now at its own size */
function lightShield(A,T,u,c,made){ const E=A.eng(); if(!E.lightShield) return; const sh=E.lightShield(u,c.o), P=T.P, k0=1+(P['sh.str']||0), d=6+(P['ls.dur']||0);
  const lo=ceOf(A,T,u,c), ce=1+0.03*(T.r.mb_10_3||0), L=allies(E,u), M=E.METER();
  const w1=P.ward1?A.pick(T,u,{team:'ally',others:true,order:'lowHp',n:1},c)[0]||null:null;
  for(const a of L){ if(made&&w1&&a===u) continue; let k=k0*(a===lo?ce:1); if(P.wardN&&a!==u&&(E.dist(u,a)-E.bodyR(u)-E.bodyR(a))<4*M) k*=1.2; if(w1&&a===w1) k*=1.3;
    const v=sh*k; if((made||k>1+1e-12)&&v>(a.shield||0)) a.shield=v; if(made||d>6) a.shieldT=Math.max(a.shieldT||0,d); }
  if(w1&&!made&&T.s.ws){ u.shield=T.s.ws[0]; u.shieldT=T.s.ws[1]; } T.s.ws=null;          // Ward the One: Aureth gives his own up
  if(w1) A.acts(T,u,[{mark:'ward',on:'target',dur:d,while:'shield'}],Object.assign({},c,{tgt:w1}));
  const og=A.stGet(T,'og'), to=w1||u;
  if(og>0){ to.shield=(to.shield||0)+og*k0; to.shieldT=Math.max(to.shieldT||0,d);
    if(P.ovf){ const o2=A.pick(T,u,{team:'ally',within:6,others:true,order:'lowHp',n:1},c)[0]; if(o2){ o2.shield=(o2.shield||0)+og*0.5*k0; o2.shieldT=Math.max(o2.shieldT||0,d); unend(A,T,u,[o2],3+(P['un.dur']||0),c); } }
    A.stSet(T,u,'og',0); syncP(A,T,u); }
  if(!w1) A.acts(T,u,[{mark:'dsh',on:'self',dur:d,while:'shield'}],c);
  unend(A,T,u,L.filter(a=>!a._summon&&!(w1&&a===u)),3+(P['un.dur']||0),c); }
