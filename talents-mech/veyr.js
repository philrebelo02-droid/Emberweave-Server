/* VEYR - what his learned talents do in a fight (the mechanics; his plain stat talents are {stat} rows here,
   read by tools/build_talent_fx.py like every other hero's).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file
   into talents-fx.js. A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   His real kit (the code, not the card wording; damage profile Magic: EVERY hit of his is magic, basic included;
   an Assassin of the middle row; tests/veyr-kit-facts.js):
   - Gravity Crescent ('tendrilpull', green, cd 7, nearest): slashes the nearest enemy for 150% of his ability power
     x skill level and drags it to 1.2 m short of Veyr over the hand-close; the drag itself roots it (ccApply
     stunned for the drag). The page deals the slash and sets the drag; its damage rides OUTSIDE the immovable gate
     (a refused drag still takes the slash).
   - Abyssal Mantle ('evadecounter', blue, cd 9): a 2.4 s stance - 45% (+0.1 pt a level) less damage taken; the FIRST
     enemy hit inside it is evaded ('evade') and countered at once for 200% of his ability power x skill level
     (magic, heroScaleMode: a Magic hero counters off AP). The window is u._evadeT; the counter is a landPre / land
     pair ('counter').
   - Weightless Predator (passive 'weightless'): every attack the mantle EVADES pays +8% attack speed (5 s, capped
     1.6) and +5% crit chance (capped 0.6, the dodge crit counted apart and cleared each wave). Pays on the evade
     block only. The page reads u._vyWlH / u._vyWlC (his talents Predator's Ease / Giddy Height strengthen the two
     payments; one guarded page line, inert without talents).
   - Abyssal Undertow ('abyssalundertow', ult, energy): a whirlpool at the aim (7 m, the catch measured centre to
     centre) drags every enemy in for 1.2 s, then collapses: 190% AP x skill level to everything caught and a 2 s
     slow written straight. The catch pushes u._horizon={cx,cy,R,t,caught,dmg,slow} BEFORE the immovable gate, and
     the collapse runs inside a landPre / land pair ('abyssalundertow') so its hits carry the skill name.
   His families (WIRING/63 - VEYR - talent decisions.md):
   - Deepwater (The Trench): enemy-side ustack 'vyDw', max 5, 8 s (+0.6 s/rank Kept Down). Gains: a Gravity Crescent
     or Abyssal Undertow drag (the attempt - decision 1: a refused move still takes the payload), Heavier Pull's
     30%/rank second stack, Folded Under's LINK +2, Implosion's +2 within 2 m of a crush, The Trench Comes Up's
     fill. At 5 (the state's 'full' event) the enemy is crushed: The Crush's 15%-of-attack burst (Crush Depth
     +10%/rank), stacks reset, Implosion spreads, Deepwater Drunk winds.
   - Hush (The Trench): a timed mark 'vyHush' on the enemies the collapse caught, 4 s (+0.4 s/rank Deep Silence).
     Riders read the mark: No Sound (the next skill that enemy uses deals 6%/rank less - carried on a second mark
     'vyNs' the cast arms), Muffled (attack-speed penalty), Hush Falls (his whole team +3%/rank), Mute Water (no
     energy), Unspoken (his DR), Sealing Water (−5%/rank healing). He WATCHES every unit for these (M.watch).
   - The Fold (Other Half): self-managed charges: one (two with Twice Folded), a charge back every 12 s (−0.4 s/rank).
     A single hit above the line (8% of his max HP −1%/rank Fold Over, floor 5%) folds into the mantle: the hit is
     multiplied by 0.5 (+5%/rank more off, Wrapped Tight) INSIDE the one DR product (DRG70 floor 0.30 kept) - the
     trigger lives in myDr, not in a separate row, so the floor sees the fold. Riders: Quick to Wrap, Folded Strike,
     Folded Under, Mother's Patience (0.5%/rank per fold this wave, up to 6), Swaddled (wave start ready + 3 s of
     3%/rank DR... 4 s).
   - Tide (Other Half): two-phase breath, self-managed countdown (in 4 s / out 4 s, +0.2 s/rank Diving Breath);
     starts OUT each wave. In: 3%/rank DR (Breathing Mantle) +0.5%/rank (Slow Gills), Tidal Pulse's regen-capped
     heal. Out: +3%/rank damage (Breathing Mantle), Ebb (green crit), Rising Breath (next hit +5%/rank), Riptide
     Breath (hits +0.5 Energy/rank), Spring Tide (+1%/rank attack), Turning Tide (counter +2%/rank). Two Hearts:
     casting the blue flips to IN, its counter flips to OUT.
   - Drift (Too Light Up Here): +1 per 0.5 s moving (the engine's T.s.moved), max 10 (+2/rank Long Glide, 20),
     fades 2 a second standing (−0.5/rank Current Memory). Per stack: +0.3%/rank attack speed (Riding the Current),
     +0.5%/rank move speed (Fast Water). Riders at 5+: Light Frame's dodge, Wake's proximity slow; at 10: Carried
     Along (next basic a guaranteed crit, spends 5), Dragged in the Wake (the green spends ALL Drift and drags all
     the way, o.stop=0); Updraft's DR while moving; Surface Run (first hit after 3 m +4%/rank); Too Easy (+1/rank a
     kill); Undersea Swell (3/rank at each wave's start). Full Drift fires the signature (once/20 s).
   - Giddy (Too Light Up Here): +1 a dodge until the wave ends - a dodge: the mantle's evade, a talent dodge roll,
     the game's Evasion miss, a banked/forced miss (decision 3) - max 8 (12 Let Go; Stay Steady caps at 5 and drops
     the armor loss). Per stack: +2%/rank critical damage but −0.5% armor (Drunk on Air, tk writes u.critDmg from
     the fight's base), +0.2%/rank attack (Reckless Joy), +0.5%/rank move (Joyride). Riders: lifesteal (Untethered),
     crit chance while Stay Steady (Clear Skies), Cold Eye (+2%/rank crit damage at 5+), Bored Now (+1%/rank per 2
     Giddy), Head in the Clouds (banked miss at full, once/8 s), Hungry Mantle (the window stays up through its 2.4 s
     and every attack it evades counts - two guarded page lines read u._vyHm / u._vyNlg / u._vyNoCtr), Sky Fall
     (heal a dodge), Unburdened (+0.3%/rank attack a dodge, 10 a wave).
   Caps: DRG70 - ONE product on him, kept-share floored at 0.30 (his mantle stance is the page's own, outside);
   CRIT5 - Weighted Edge + Light Blade share one pool (a named-number pool capped by critPool); crit damage
   Undersea Calm / Cold Eye 2%/rank each (10% max at 5/5); Tidal Pulse counts toward the 1.2%/s regeneration cap
   (a per-clock-second bucket in tk). NO absolute fight time anywhere: every timer counts down by the tick's dt.
   Readings, caps and corrected tooltips: WIRING/63 - VEYR - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const GC='tendrilpull', AM='evadecounter', UT='abyssalundertow';
const DR_FLOOR=0.30, BLUE_FLOOR=5;
/* which talents read each family: its bookkeeping rows are attached only when one of them is learned */
const FOLD=['oh_1_1','oh_2_1','oh_3_1','oh_4_2','oh_6_1','oh_8_1','oh_9_1','oh_11_1','oh_12_1','oh_n1'];     // The Fold
const DRG=['oh_1_1','oh_1_4','oh_4_2','oh_7_1','oh_8_3','oh_11_1','oh_12_1','oh_12_3','tr_n1','tr_10_4','tl_6_4','tl_n1'];     // his damage reduction: ONE capped group (70%)
const DOD=['tl_1_4','tl_5_2','tl_5_3','tl_6_2','tl_6_3','tl_7_4','tl_8_3','tl_9_2','tl_9_4','tl_11_2','tl_11_3','tl_12_2','tl_12_4','tl_13_2'];   // a dodge feeds these
const HUSHW=['tr_1_4','tr_3_4','tr_7_4','tr_9_4','tr_10_4','tr_12_4'];                                       // he watches every unit (Hush riders)
const GCK=['tr_1_1','tr_4_1','tr_4_2','tr_5_2','tr_5_3','tr_9_2','tl_9_1','tl_13_2'];                       // Gravity Crescent's kit hook: everyone gcCast reads the target for
const GCC=['tr_1_1','tr_4_1','tr_4_2','tr_5_2','tr_5_3','tr_9_2','tl_9_1'];                                  // Gravity Crescent's cast hook
const AMK=['oh_5_2','oh_11_2'];                                                                              // Abyssal Mantle's kit hook
const UTA=['tr_1_1','tr_4_1','tr_4_2','tr_9_2','tr_11_1','tr_13_2'];                                         // Abyssal Undertow's at hook
const UTL=['tr_1_4','tr_11_2','tr_13_2'];                                                                    // Abyssal Undertow's land hook
const HITW=['oh_3_1','oh_9_2','oh_12_4'];                                                                    // his landed hits watched
const GID=['tl_1_4','tl_3_4','tl_5_2','tl_5_3','tl_6_2','tl_6_3','tl_7_4','tl_8_3','tl_11_3'];                // Giddy: a dodge winds it
const DRIFT=['tl_1_1','tl_2_1','tl_2_3','tl_3_1','tl_6_1','tl_7_1','tl_8_1','tl_9_1','tl_10_2','tl_11_1','tl_12_1','tl_13_2'];   // Drift: the movement meter
const CDB=['tr_8_3','oh_5_3','oh_8_2','tl_7_3'];                                                             // his blue cooldown rows
/* ---- small readers that need no API ---- */
const rk=(T,id)=>T.r[id]||0;
const has=(T,L)=>L.some(id=>T.r[id]);
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const V=T=>T.s.vy||(T.s.vy={waves:0, tide:'out', tideT:4, rb:0, dc:0, dAcc:0, srD:0, srOk:0,
  foldC:0, foldT:0, folds:0, fs:0, fu:0, cling:0, swad:0, glass:1, dodges:0, flick:0,
  s1:0, s1Lock:0, s3:0, s3Lock:0, nlgWin:0, nlgCount:0, nlgFired:1, nlgFoes:[],
  ilgWin:0, ilgLock:0, ilgFoes:[], hcLock:0, ktTgt:null, ktWas:0,
  gcTgt:null, gcDur:1.2, ltSecond:null, ut:null, cd0:null, tpT:0, tpUsed:0, wkL:{}, lastDodge:null});
module.exports={
  hero:'veyr',
  casting:true,                         // rows ask which of his skills a hit comes from (the crescent, the counter, the undertow)
  hide:'vyG',                           // Nothing Up Here Weighs Anything: while the window holds and he moves, his enemies carry 'vyG' and cannot PICK him (the page's hideFrom lane)
  watch:HUSHW,                          // Hush's riders read every unit's heals / energy / casts / hits
  states:{
    vyDw:{unit:true, max:5, dur:P('dw.dur',8), full:'crush', chain:0.5},   // Deepwater on enemies (8 s + 0.6/rank Kept Down); full = crushed; the chain lets Implosion cascades crush
    vyDrift:{max:P('dr.max',10)},                                            // Drift (10 + 2/rank Long Glide, 20)
    vyGiddy:{max:P('g.cap',8), wave:'reset'},                                // Giddy until the wave ends (8; 12 Let Go +4; Stay Steady 5 = 8-3)
    vyDod:{max:10, wave:'reset'},                                            // Unburdened's dodge count this wave
    vyDrunk:{max:5, wave:'reset'},                                           // Deepwater Drunk's crush count this wave
    vyCtr:{max:10, wave:'reset'}                                             // Other Half's counter count this wave
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share, his capped groups */
  always:[
    {on:'wave',do:[{fn:'waveStart'}]},                                                                                    // a new wave: his per-wave records drop; the tide starts OUT; Swaddled / Undersea Swell
    {on:'tick',do:[{fn:'tk'}]},                                                                                            // every timer of his counts down here (never an absolute fight time)
    {on:'at',skill:UT,reqAny:UTA,do:[{fn:'utAt'}]},                                                                        // the Undertow forms: its centre, Deepwater on everything caught (the attempt - refused moves included)
    {on:'kit',skill:GC,reqAny:GCK,do:[{fn:'gcKit'}]},                                                                      // the crescent: its target, the second enemy (Let Them Drift), the signature's half-strength cast
    {on:'cast',skill:GC,reqAny:GCC,do:[{fn:'gcCast'}]},                                                                    // the crescent resolved: its payloads (Deepwater, Heavier Pull, Counterflow, Trench-Born, the landing root, the Drift spend)
    {on:'kit',skill:AM,reqAny:AMK,do:[{fn:'amKit'}]},                                                                      // the mantle: Never Lets Go's window clock
    {on:'landPre',skill:'counter',do:[{fn:'lp'}]}, {on:'land',skill:'counter',do:[{fn:'ld'}]},                            // the counter (his rows about it: Other Half's stack, Clinging, Sharp Return, the in-block guard)
    {on:'land',skill:UT,reqAny:UTL,do:[{fn:'utLand'}]},                                                                    // the collapse: Hush on the caught, The Trench Comes Up, Second Swallow
    {on:'crush',reqAny:['tr_3_1','tr_9_1','tr_12_1'],do:[{fn:'crush'}]},                                                   // an enemy reached 5 Deepwater: the burst, Implosion, Deepwater Drunk
    {on:'crit',reqAny:['tl_3_1'],do:[{fn:'critFn'}]},                                                                      // Carried Along: a full-Drift basic is a guaranteed crit and spends 5
    {on:'hit',if:{targetTeam:'enemy'},reqAny:HITW,do:[{fn:'hitFn'}]},                                                      // his hits that landed: Mantle Hunger, Dead Calm, Folded Strike
    {on:'in',reqAny:DRG.concat(FOLD),do:[{fn:'myDr'}]},                                                                    // his damage-reduction talents AND The Fold: ONE capped product (DRG70); the Fold's trigger answers any Fold-tree talent
    {on:'dodged',reqAny:DOD,do:[{fn:'dodgeEvt'}]}, {on:'evade',reqAny:DOD,do:[{fn:'dodgeEvt'}]},                          // a dodge (decision 3): talent dodge / the mantle's evade
    {on:'evade',reqAny:['oh_5_2'],do:[{fn:'nlgEvt'}]},                                                              // Never Lets Go: every attack the window covers is counted (the counter falls at its end)
    {on:'evaded',reqAny:DOD,do:[{fn:'dodgeEvt'}]}, {on:'bank',reqAny:DOD,do:[{fn:'dodgeEvt'}]},                           // the game's Evasion / a banked miss (Head in the Clouds, the signatures)
    {on:'dodge',reqAny:['tl_13_2'],if:{fn:'sig3up'},do:[{dodge:true}]},                                                   // the signature: attacks already aimed at him while he moves are forced dodges
    {on:'kill',if:{targetTeam:'enemy'},reqAny:['tl_10_2'],do:[{fn:'killFn'}]},                                             // Too Easy: a kill is Drift
    {on:'cd',reqAny:CDB,do:[{fn:'cdSet'}]},                                                                                // his blue cooldown talents (0.1 s/rank each, Lets Him Hunt 2 s; 5 s floor)
    {stat:{crit:0.01},per:{fn:'critPool'},reqAny:['tr_12_3','tl_1_3']}                                                     // CRIT5: Weighted Edge + Light Blade share one 5% pool
  ],
  talents:{
    /* ============================== THE TRENCH ============================== */
    tr_1_1:[ {on:'out',more:R(0.01),per:{ust:'vyDw'}} ],                                                                   // Down Where It Weighs (Deepwater: +1%/rank a stack from him)
                                                                                                                           // Abyssal Water: a plain stat (fx: +2%/rank apow) - no row
    tr_1_4:[ {on:'teamCast',if:{unitHas:'vyHush'},do:[{mark:'vyNs',dur:3,on:'unit'},{mark:'vyHush',clear:true,on:'unit'}]},   // No Sound: the next skill that enemy uses carries 'vyNs' (6%/rank less)
             {on:'teamIn',if:{srcHas:'vyNs'},less:R(0.06)} ],                                                              //   ... and that skill's hits deal less while the mark lives
    tr_2_1:[ {param:'sq',add:R(0.02)} ],                                                                                   // Squeeze (tk slows per stack)
    tr_2_2:[ {on:'out',if:{casting:GC},more:R(0.03)} ],                                                                    // Long Crescent
    tr_2_3:[ {stat:{move:R(0.03)}} ],                                                                                      // Keen Current
    tr_3_1:[ {param:'crush',add:R(0.15)} ],                                                                                // The Crush (the burst, in crushT)
    tr_3_3:[ {on:'out',if:{casting:'counter'},more:R(0.03)} ],                                                             // Mantle Edge
    tr_3_4:[ {param:'mf',add:R(0.01)} ],                                                                                   // Muffled (tk: hushed enemies' attack speed)
    tr_4_1:[ {param:'tb',add:R(0.005)} ],                                                                                  // Trench-Born (a heal a dragged enemy)
    tr_4_2:[ {param:'hp2',add:R(0.30)} ],                                                                                  // Heavier Pull (gcCast's second-stack roll)
    tr_4_3:[ {stat:{nrg:R(0.03)}} ],                                                                                       // Patient Tide
    tr_5_2:[ {param:'kt',add:1} ],                                                                                         // Keep Them Down (a 1 s root where the dragged enemy lands)
    tr_5_3:[ {param:'lt',add:1}, {on:'out',if:{casting:GC},do:[{fn:'ltOut'}]} ],                                           // Let Them Drift (the second enemy, 30% less on both; Wide Net: +10%/rank back on the second)
    tr_5_4:[ {param:'hush.dur',add:R(0.4)} ],                                                                              // Deep Silence
    tr_6_1:[ {stat:{atk:R(-0.02)},to:{team:'enemy',fn:'dw3'}} ],                                                           // The Bends (enemies at 3+ Deepwater deal less)
    tr_6_2:[ {on:'out',if:{fn:'tgtRooted'},more:R(0.02)} ],                                                                // Anchor Line
    tr_6_3:[ {param:'wn',add:R(0.10)} ],                                                                                   // Wide Net
                                                                                                                           // Brine Skin: a plain stat (fx: +2%/rank mr) - no row
    tr_7_1:[ {on:'out',if:{fn:'tgtSlowed'},more:R(0.02)} ],                                                                // Soundings
    tr_7_3:[ {on:'kit',skill:UT,opt:{radius:{addM:R(0.2)}}} ],                                                             // Wider Mouth
    tr_7_4:[ {on:'teamIn',if:{targetHas:'vyHush'},more:R(0.03)} ],                                                         // Hush Falls (his whole team's hits)
    tr_8_1:[ {param:'crush.more',add:R(0.10)} ],                                                                           // Crush Depth
    tr_8_2:[ {on:'out',if:{casting:UT},more:R(0.03)} ],                                                                    // Drowning Deep
    tr_8_3:[ {param:'cd.g',add:R(0.1)} ],                                                                                  // Quick Fold (the GREEN, 0.1 s/rank; the others are blue)
    tr_9_1:[ {param:'impl',add:R(2)} ],                                                                                    // Implosion (+2 Deepwater within 2 m of a crush)
    tr_9_2:[ {on:'out',if:{targetHas:'vyCf'},more:R(0.03)} ],                                                              // Counterflow (dragged enemies, 2 s)
    tr_9_3:[ {on:'out',ignoreMr:R(0.02)} ],                                                                                // Abyssal Pull
    tr_9_4:[ {on:'teamNrg',if:{unitHas:'vyHush'},mul:0} ],                                                                 // Mute Water
    tr_10_1:[ {stat:{move:R(-0.02)},to:{team:'enemy',within:3}} ],                                                         // Pressing Air
    tr_10_2:[ {on:'out',more:R(0.01),per:{units:{team:'enemy',within:3},max:4}} ],                                         // Nowhere to Swim
    tr_10_4:[ {param:'un',add:R(0.02)} ],                                                                                  // Unspoken (drK)
    tr_11_1:[ {param:'dw.dur',add:R(0.6)} ],                                                                               // Kept Down
    tr_11_2:[ {param:'ssw',add:1} ],                                                                                       // Second Swallow (utLand's after-pull)
    tr_11_3:[ {on:'out',if:{crit:true,targetUst:{vyDw:1}},critMore:R(0.02)} ],                                             // Undersea Calm
    tr_12_1:[ {stat:{atk:R(0.01)},per:'vyDrunk'} ],                                                                        // Deepwater Drunk
    tr_12_2:[ {on:'out',if:{targetUst:{vyDw:3}},more:R(0.02)} ],                                                           // Heavy Enough
    tr_12_3:[ {param:'cp.we',add:R(1)} ],                                                                                  // Weighted Edge (CRIT5 pool)
    tr_12_4:[ {on:'teamHeal',if:{unitHas:'vyHush'},less:R(0.05)} ],                                                        // Sealing Water
    tr_13_2:[ {param:'s1',add:1}, {on:'out',if:{fn:'sig1On'},more:0.15} ],                                                 // The Trench Comes Up (SIGNATURE: utLand)
    tr_n1:[ {param:'pw',add:R(0.02)} ],                                                                                    // Pressure Wise (drK: less from a slowed or rooted attacker)
    /* ============================== OTHER HALF ============================== */
    oh_1_1:[ {param:'fold.per',add:R(-0.4)} ],                                                                             // It Moves First (base 12 s in tk)
                                                                                                                           // Living Cloth: a plain stat (fx: +2%/rank armor) - no row
    oh_1_4:[ {param:'bm.dr',add:R(0.03)}, {on:'out',if:{fn:'tideOut'},more:R(0.03)} ],                                     // Breathing Mantle (in: DR; out: damage)
    oh_2_1:[ {param:'qw',add:R(0.01)} ],                                                                                   // Quick to Wrap
    oh_2_2:[ {on:'kit',skill:AM,opt:{dur:{add:R(0.1)}}} ],                                                                 // Mother's Hold
    oh_2_3:[ {on:'out',if:{casting:'counter'},more:R(0.04)} ],                                                             // Countercut
    oh_3_1:[ {param:'fstrike',add:1} ],                                                                                    // Folded Strike (next basic also strikes as the counter at half strength)
    oh_3_3:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                                     // Fin Blades
    oh_3_4:[ {param:'br.dur',add:R(0.2)} ],                                                                                // Diving Breath
                                                                                                                           // Deep Hide: a plain stat (fx: +2%/rank hp) - no row
    oh_4_2:[ {param:'cling',add:R(0.10)} ],                                                                                // Clinging (drK, 2 s after a counter)
    oh_4_3:[ {stat:{nrg:R(0.03)}} ],                                                                                       // Steady Gills
    oh_5_1:[ {stat:{ctrl:R(0.04)}} ],                                                                                      // Hide of the Deep
    oh_5_2:[ {param:'nlg',add:1} ],                                                                                        // Never Lets Go (u._vyNlg: the window holds, the counter falls at its end)
    oh_5_3:[ {param:'cd.lh',add:R(2)} ],                                                                                   // Lets Him Hunt (the counter on the first evade - the base - and 2 s off the blue)
    oh_5_4:[ {param:'tp',add:R(0.003)} ],                                                                                  // Tidal Pulse (tk: the regen-capped heal while IN)
    oh_6_1:[ {param:'fo.line',add:R(0.01)} ],                                                                              // Fold Over (the HP line, floor 5%)
    oh_6_2:[ {param:'smo',add:R(0.04)} ],                                                                                  // Smothering (the Never Lets Go end-counter's slow)
    oh_6_3:[ {param:'sharp',add:R(0.05)} ],                                                                                // Sharp Return
    oh_6_4:[ {on:'crit',if:{casting:GC,fn:'tideOut'},chance:R(0.03),force:true} ],                                         // Ebb (the crescent's crit chance while breathing OUT)
    oh_7_1:[ {param:'tl',add:R(0.01)} ],                                                                                   // Tough Love (drK)
    oh_7_3:[ {on:'out',if:{casting:UT},more:R(0.03)} ],                                                                    // Drag Them Under
    oh_7_4:[ {on:'out',if:{fn:'rbOk'},more:R(0.05),do:[{fn:'rbSpend'}]} ],                                                 // Rising Breath (the first hit after the turn to OUT)
    oh_8_1:[ {param:'wt2',add:R(0.05)} ],                                                                                  // Wrapped Tight (the fold takes 5%/rank more off)
    oh_8_2:[ {param:'cd.b',add:R(0.1)} ],                                                                                  // Second Nature
    oh_8_3:[ {param:'sg.dr',add:R(0.005)} ],                                                                                // Slow Gills (drK)
    oh_9_1:[ {param:'fold.ch',add:1} ],                                                                                    // Twice Folded (a second charge)
    oh_9_2:[ {param:'mh',add:R(0.03)} ],                                                                                   // Mantle Hunger (hitFn: a counter heals him)
    oh_9_4:[ {param:'rt',add:R(0.5)}, {on:'hit',if:{targetTeam:'enemy',fn:'tideOut'},do:[{fn:'riptide'}]} ],               // Riptide Breath
    oh_10_3:[ {on:'out',if:{casting:'counter'},ignoreArmor:R(0.02),ignoreMr:R(0.02)} ],                                    // Brute Water
    oh_10_4:[ {on:'out',if:{casting:'counter',fn:'tideOut'},more:R(0.02)} ],                                               // Turning Tide
    oh_11_1:[ {param:'mp',add:R(0.005)} ],                                                                                 // Mother's Patience (drK: 0.5%/rank a fold, 6)
    oh_11_2:[ {on:'kit',skill:AM,do:[{fn:'tideIn'}]}, {on:'land',skill:'counter',do:[{fn:'flipOut'}]} ],                   // Two Hearts (the blue turns the tide IN, its counter OUT)
    oh_11_4:[ {stat:{atk:R(0.01)},if:{fn:'tideOut'}} ],                                                                    // Spring Tide
    oh_12_1:[ {param:'sw',add:R(0.03)} ],                                                                                  // Swaddled (wave start: the fold ready, 4 s of DR)
    oh_12_2:[ {on:'out',more:R(0.005),per:'vyCtr'} ],                                                                      // Other Half (0.5%/rank a counter landed, 10)
    oh_12_3:[ {param:'ss',add:R(0.02)} ],                                                                                  // Salt Scar (drK: less from crits)
    oh_12_4:[ {param:'dc',add:R(0.01)} ],                                                                                  // Dead Calm (hitFn: the first hit after a turn heals him)
    oh_13_2:[ {on:'bankPre',do:[{fn:'sig2'}]} ],                                                                           // It Never Let Go (SIGNATURE: bankPreFn)
    oh_n1:[ {param:'fu',add:R(0.06)}, {param:'fuDw',add:1}, {on:'out',if:{casting:GC,fn:'fuOk'},more:{$:'fu'},do:[{fn:'fuSpend'}]} ],   // Folded Under (LINK)
                                                                                                                           // Sharp Fins: a plain stat (fx: +1%/rank apow) - no row
    /* ============================== TOO LIGHT UP HERE ============================== */
    tl_1_1:[ {stat:{aspd:R(0.003)},per:'vyDrift'} ],                                                                       // Riding the Current
    tl_1_3:[ {param:'cp.bl',add:R(1)} ],                                                                                   // Light Blade (CRIT5 pool)
    tl_1_4:[ {param:'drunk',add:R(0.02)}, {stat:{armor:R(-0.005)},per:'vyGiddy',if:{fn:'noSteady'}} ],                     // Drunk on Air (tk writes the crit damage; the armor loss unless Stay Steady)
    tl_2_1:[ {stat:{move:R(0.005)},per:'vyDrift'} ],                                                                       // Fast Water
    tl_2_2:[ {on:'crit',if:{casting:GC},chance:R(0.03),force:true} ],                                                      // Hooked Cut (the crescent's crit chance: a forced crit behind the seeded roll)
    tl_2_3:[ {on:'dodge',if:{fn:'drift5'},chance:{field:'_talDodge',of:'self'},do:[{dodge:true}]},                         // Light Frame (dodge chance at 5+ Drift)
              {stat:{dodge:R(0.015)},if:{fn:'drift5'}} ],
    tl_3_1:[ {param:'ca',add:1} ],                                                                                         // Carried Along (critFn)
    tl_3_3:[ {param:'wl.h',add:R(0.04)} ],                                                                                 // Predator's Ease (the page reads u._vyWlH)
    tl_3_4:[ {stat:{atk:R(0.002)},per:'vyGiddy'} ],                                                                        // Reckless Joy
    tl_4_1:[ {stat:{move:R(0.02)}} ],                                                                                      // Fin Speed
    tl_4_2:[ {on:'out',if:{casting:GC,crit:true},critMore:R(0.05)} ],                                                      // Barbed Crescent
    tl_4_3:[ {stat:{nrg:R(0.03)}} ],                                                                                       // Little Weight
    tl_5_2:[ {param:'g.cap',add:R(-3)} ],                                                                                  // Stay Steady (Giddy caps at 5, no armor loss)
    tl_5_3:[ {param:'g.cap',add:R(4)}, {stat:{aspd:R(0.005)},per:'vyGiddy'} ],                                             // Let Go (Giddy to 12, +attack speed a stack)
    tl_5_4:[ {param:'wl.c',add:R(0.03)} ],                                                                                 // Giddy Height (the page reads u._vyWlC)
    tl_6_1:[ {param:'wk',add:R(0.04)} ],                                                                                   // Wake (tk: the proximity slow at 5+ Drift)
    tl_6_2:[ {stat:{crit:R(0.005)},per:'vyGiddy',if:{fn:'staySteady'}} ],                                                  // Clear Skies
    tl_6_3:[ {stat:{lifesteal:R(0.002)},per:'vyGiddy',if:{fn:'letGo'}} ],                                                  // Untethered
    tl_6_4:[ {param:'ha',add:R(0.02)} ],                                                                                   // High Air (drK: less from ranged)
    tl_7_1:[ {on:'out',if:{auto:true,fn:'surfOk'},more:R(0.04),do:[{fn:'surfSpend'}]} ],                                   // Surface Run (the first hit after 3 m)
    tl_7_3:[ {param:'cd.b',add:R(0.1)} ],                                                                                  // Light as Water
    tl_7_4:[ {stat:{move:R(0.005)},per:'vyGiddy'} ],                                                                       // Joyride
    tl_8_1:[ {param:'dr.fade',add:R(-0.5)} ],                                                                              // Current Memory (the fade 0.5 slower a rank)
    tl_8_2:[ {on:'out',if:{casting:GC},more:R(0.03)} ],                                                                    // Crescent Arc
    tl_8_3:[ {param:'ce',add:R(0.02)} ],                                                                                   // Cold Eye (tk: +crit damage at 5+ Giddy)
    tl_9_1:[ {param:'ditw',add:1}, {on:'kit',skill:GC,if:{fn:'drift10'},opt:{stop:{set:0}}} ],                             // Dragged in the Wake (at 10 Drift the green drags all the way and spends the Drift)
    tl_9_2:[ {on:'out',if:{fn:'flickOk'},more:R(0.04),do:[{fn:'flickSpend'}]} ],                                           // Flick of the Tail (the first hit after a dodge)
    tl_9_3:[ {on:'out',if:{targetHpBelow:0.40},more:R(0.02)} ],                                                            // Deep Hunger
    tl_9_4:[ {on:'bankPre',do:[{fn:'hitClouds'}]} ],                                                                       // Head in the Clouds (a banked miss at full Giddy, once/8 s)
                                                                                                                           // Always Moving: a plain stat (fx: +1%/rank aspd) - no row
    tl_10_2:[ {param:'ez',add:R(1)} ],                                                                                     // Too Easy (killFn)
    tl_10_4:[ {param:'nw',add:R(0.06)} ],                                                                                  // Nothing Weighs (tk weakens a slow on him, 30% at most)
    tl_11_1:[ {param:'dr.max',add:R(2)} ],                                                                                 // Long Glide
    tl_11_2:[ {param:'hm',add:1} ],                                                                                        // Hungry Mantle (u._vyHm: the window holds, every evade counts)
    tl_11_3:[ {on:'out',more:R(0.01),per:{stack:'vyGiddy',div:2}} ],                                                       // Bored Now (+1%/rank per 2 Giddy)
    tl_12_1:[ {param:'dr.start',add:R(3)} ],                                                                               // Undersea Swell (3 Drift a rank at each wave's start)
    tl_12_2:[ {stat:{atk:R(0.003)},per:'vyDod'} ],                                                                         // Unburdened
    tl_12_3:[ {on:'out',if:{crit:true,fn:'glassOk'},critMore:R(0.10),do:[{fn:'glassSpend'}]} ],                            // Glass Calm (his first crit each wave)
    tl_12_4:[ {param:'sky',add:R(0.01)} ],                                                                                 // Sky Fall (dodgeEvt heals him)
    tl_13_2:[ {param:'s3',add:1}, {on:'dodge',if:{fn:'sig3up'},do:[{dodge:true}]} ],                                       // Nothing Up Here Weighs Anything (SIGNATURE: tk + the forced dodges)
    tl_n1:[ {param:'up',add:R(0.02)} ],                                                                                    // Updraft (drK: less while moving)
                                                                                                                           // High Water: a plain stat (fx: +2%/rank apow) - no row
  },
  fn:{
    /* ---- A NEW WAVE ---- */
    waveStart(A,T,u){ const v=V(T), P=T.P; v.waves++; T.s.api=A;
      u._vyHm=P.hm?1:0; u._vyNlg=P.nlg?1:0;                                     // two guarded page lines read these (the window holds / no in-block counter)
      u._vyWlH=1+(P['wl.h']||0); u._vyWlC=1+(P['wl.c']||0);                     // the Weightless payments, strengthened
      if(P.drunk||P.ce){ if(v.cd0==null) v.cd0=(u.critDmg||0.6); }
      if(has(T,DRIFT)&&P['dr.start']) A.stSet(T,u,'vyDrift',Math.min(stN(T,'vyDrift')+P['dr.start'],A.stMax(T,u,'vyDrift')));
      if(has(T,FOLD)){ v.foldC=1+(P['fold.ch']||0); if(P.sw) v.swad=4; }                        // the fold is ready at the wave's start (Twice Folded: two); Swaddled's 4 s ride separately
      v.tide='out'; v.tideT=4+(P['br.dur']||0); v.rb=0; v.dc=0;
      v.glass=1; v.folds=0; v.dodges=0; A.stSet(T,u,'vyDod',0);
      v.ktTgt=null; v.ktWas=0; v.s1=0; if(v.s3>0){ v.s3=0; }
      const E=A.eng(); for(const x of E.units()) if(x.alive&&x.team!==u.team&&A.markOf(u,x,'vyG')) A.clearMark(u,x,'vyG'); },
    /* ---- EVERY TIMER, ONCE A TICK (countdowns only) ---- */
    tk(A,T,u,c){ const v=V(T), dt=c.dt||0, P=T.P, E=A.eng(); T.s.api=A;
      /* Drift: +1 per 0.5 s moving; fades standing. Full Drift fires the signature (once/20 s). */
      if(has(T,DRIFT)){ const dMax=A.stMax(T,u,'vyDrift');
        if(T.s.moved){ v.dAcc+=dt; while(v.dAcc>=0.5-1e-9){ v.dAcc-=0.5; const n=stN(T,'vyDrift'); if(n<dMax){ A.stSet(T,u,'vyDrift',n+1);
          if(P.s3&&stN(T,'vyDrift')>=dMax-1e-9&&v.s3Lock<=0&&!(v.s3>0)){ v.s3=4; v.s3Lock=20; } } } }
        else { const f=Math.max(0, 2+(P['dr.fade']||0)); const n=stN(T,'vyDrift'); if(n>0) A.stSet(T,u,'vyDrift',Math.max(0,n-f*dt)); } }
      /* the signature's window: he weighs nothing - un-targetable while he moves (the hideFrom marks), forced dodges above */
      if(v.s3>0){ v.s3=Math.max(0,v.s3-dt); const prot=v.s3>0&&T.s.moved;
        for(const x of E.units()){ if(!x.alive||x.team===u.team) continue; const m=!!A.markOf(u,x,'vyG');
          if(prot&&!m) A.setMark(T,u,x,'vyG',{}); else if(!prot&&m) A.clearMark(u,x,'vyG'); }
        if(v.s3<=0) for(const x of E.units()) if(x.alive&&x.team!==u.team&&A.markOf(u,x,'vyG')) A.clearMark(u,x,'vyG'); }
      if(v.s3Lock>0) v.s3Lock=Math.max(0,v.s3Lock-dt);
      /* Never Lets Go's window: at its end the counter falls on everyone that swung, 5% stronger an attack evaded */
      if(v.nlgWin>0){ v.nlgWin=Math.max(0,v.nlgWin-dt);
        if(v.nlgWin<=0&&!v.nlgFired){ v.nlgFired=1; const mul=1+0.05*v.nlgCount;
          for(const f of v.nlgFoes){ if(!f||!f.alive) continue; T.fn.ctrStrike(A,T,u,f,mul); if(P.smo) A.acts(T,u,[{slow:P.smo,dur:2,on:'target'}],{u,tgt:f}); } } }
      if(u._vyNoCtr&&!(u._evadeT>0)) u._vyNoCtr=0;                                // the mantle's window over: its counter may fall in-block again
      /* Tide: the breath turns; Rising Breath / Dead Calm arm on the turn */
      if(v.tideT>0){ v.tideT=Math.max(0,v.tideT-dt); if(v.tideT<=0){ v.tide=(v.tide==='in')?'out':'in'; v.tideT=4+(P['br.dur']||0); v.rb=1; v.dc=1; } }
      /* The Fold's charges */
      if(has(T,FOLD)){ const fMax=1+(P['fold.ch']||0); if(v.foldC<fMax){ v.foldT-=dt; if(v.foldT<=0){ v.foldC++; v.foldT=Math.max(2,12+(P['fold.per']||0)); } } }
      if(v.cling>0) v.cling=Math.max(0,v.cling-dt);
      if(v.swad>0) v.swad=Math.max(0,v.swad-dt);
      if(v.s1>0) v.s1=Math.max(0,v.s1-dt); if(v.s1Lock>0) v.s1Lock=Math.max(0,v.s1Lock-dt);
      if(v.hcLock>0) v.hcLock=Math.max(0,v.hcLock-dt);
      /* It Never Let Go's 2 s of forced misses: at the end the counter falls on every collector */
      if(v.ilgWin>0){ v.ilgWin=Math.max(0,v.ilgWin-dt);
        if(v.ilgWin<=0){ for(const f of v.ilgFoes){ if(!f||!f.alive) continue; T.fn.ctrStrike(A,T,u,f,1); } v.ilgFoes=[]; } }
      if(v.ilgLock>0) v.ilgLock=Math.max(0,v.ilgLock-dt);
      /* Tidal Pulse: the regen-capped heal while the tide is IN (a per-clock-second bucket, 1.2% max HP a second at most) */
      if(P.tp&&v.tide==='in'&&u.alive){ v.tpT+=dt; if(v.tpT>=1-1e-9){ v.tpT-=1; v.tpUsed=0; }
        const cap=0.012*(u.maxHp||0), room=Math.max(0,cap-v.tpUsed), h=Math.min(P.tp*(u.maxHp||0)*dt,room);
        if(h>0){ E.healUnit(u,h); v.tpUsed+=h; } }
      /* Squeeze (a slow a stack), Muffled (a haste penalty), Wake (a proximity slow at 5+ Drift) */
      if(P.sq||P.mf||P.wk) for(const x of E.units()){ if(!x.alive||x.team===u.team) continue;
        if(P.sq){ const n=A.ustGet(T,u,x,'vyDw'); if(n>0) A.acts(T,u,[{slow:Math.min(0.9,P.sq*n),dur:0.6,on:'target'}],{u,tgt:x}); }
        if(P.mf&&A.markOf(u,x,'vyHush')){ x.hasteMul=Math.min(x.hasteMul==null?1:x.hasteMul,Math.max(0.05,1-P.mf)); x.hasteT=Math.max(x.hasteT||0,0.4); }
        if(P.wk&&stN(T,'vyDrift')>=5&&A.gap(u,x)<1*E.METER()){ const lk=v.wkL[x.uid]||0; if(E.now()>=lk){ v.wkL[x.uid]=E.now()+2; A.acts(T,u,[{slow:P.wk,dur:2,on:'target'}],{u,tgt:x}); } } }
      /* Nothing Weighs: a slow on him is that much weaker (30% at most) */
      if(P.nw&&(u.slow||0)>0) A.acts(T,u,[{weaken:'slowMul',by:Math.min(0.30,P.nw)}],{u});
      /* Drunk on Air / Cold Eye: his critical damage, written from the fight's base */
      if((P.drunk||P.ce)&&u.alive){ if(v.cd0==null) v.cd0=(u.critDmg||0.6); const g=stN(T,'vyGiddy'); let add=0;
        if(P.drunk) add+=P.drunk*g; if(P.ce&&g>=5) add+=P.ce;
        u.critDmg=v.cd0+add; }
      /* Keep Them Down: the dragged enemy's landing */
      if(P.kt&&v.ktTgt){ const t=v.ktTgt; if(!t.alive){ v.ktTgt=null; v.ktWas=0; }
        else if((t.pullT||0)>0) v.ktWas=1;
        else if(v.ktWas){ v.ktTgt=null; v.ktWas=0; A.control(T,u,t,'stunned',1); } }
      /* Surface Run: the metres walked */
      if(T.r['tl_7_1']&&T.s.moved&&u.px!=null) v.srD+=Math.hypot(u.x-u.px,u.y-u.py)/E.METER();
      if(v.srD>=3) v.srOk=1; },
    /* ---- ABYSSAL UNDERTOW. At the cast: the centre, Deepwater on everything the catch takes (decision 1: the payload
       rides the attempt), Trench-Born's heal. At the collapse: Hush on the caught, The Trench Comes Up, Second Swallow. */
    utAt(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(); const p=c.pt; if(!p) return;
      v.ut={x:p.x,y:p.y,R:(c.o&&c.o.radius)||7*E.METER()};
      const inR=A.pick(T,u,{team:'enemy',of:'pt',withinOpt:'radius'},c);
      if(T.r['tr_1_1']&&inR.length){ A.acts(T,u,[{ustack:'vyDw',on:{team:'enemy',of:'pt',withinOpt:'radius'},add:1}],c);
        if(P.tb&&u.alive) E.healUnit(u,P.tb*(u.maxHp||0)*inR.length); }
      if(T.r['tr_9_2']) for(const e of inR) A.acts(T,u,[{mark:'vyCf',dur:2,on:'target'}],{u,tgt:e}); },
    utLand(A,T,u,c){ const v=V(T), P=T.P; const H=u._horizon, caught=(H&&H.caught)||[];
      if(T.r['tr_1_4']&&caught.length){ const d=4+(P['hush.dur']||0);
        for(const e of caught) if(e.alive) A.acts(T,u,[{mark:'vyHush',dur:d,on:'target'}],{u,tgt:e}); }
      if(P.s1&&v.s1Lock<=0&&caught.length){ v.s1Lock=20; v.s1=4;
        for(const e of caught){ if(!e.alive) continue;
          if(T.r['tr_1_1']){ A.acts(T,u,[{ustack:'vyDw',on:'target',set:'max'}],{u,tgt:e}); T.fn.crushT(A,T,u,e); }
          if(T.r['tr_1_4']) A.acts(T,u,[{mark:'vyHush',dur:4+(P['hush.dur']||0),on:'target'}],{u,tgt:e}); } }
      if(P.ssw) A.acts(T,u,[{after:1,do:[{fn:'secondSwallow'}]}],c); },
    secondSwallow(A,T,u){ const v=V(T), E=A.eng(); const p=T.s.pt[UT]; if(!p) return; const R=v.ut?v.ut.R:7*E.METER();
      for(const x of E.units()){ if(!x.alive||x.team===u.team) continue; if(Math.hypot(x.x-p.x,x.y-p.y)<R)
        A.acts(T,u,[{pull:{on:'target',to:'pt:'+UT,secs:0.4}}],{u,tgt:x}); } },
    /* ---- GRAVITY CRESCENT. The kit: its target (the page drags the nearest foe), Let Them Drift's second, the
       signature's half strength. The cast: the payloads - a Deepwater (Heavier Pull's roll), Trench-Born, Counterflow,
       Keep Them Down's landing watch, the Drift spend. */
    gcKit(A,T,u,c){ const v=V(T), P=T.P, o=c.o||{};
      if(u._vySigCast){ o.mul=(o.mul||1.5)*0.5; u._vySigCast=0; }                          // the signature's crescent: half strength, no cooldown spent
      v.gcDur=o.dur||1.2;
      v.gcTgt=A.pick(T,u,{team:'enemy',order:'near',n:1},{u})[0]||null;
      if(P.lt){ const t=v.gcTgt; v.ltSecond=null;
        if(t&&t.alive) v.ltSecond=A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target',n:1},{u,tgt:t})[0]||null; } },
    gcCast(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(); const t=v.gcTgt; if(!t||!t.alive) return;
      if(T.r['tr_1_1']){ T.fn.addDw(A,T,u,t,1);
        if(P.hp2&&E.rnd()<P.hp2) T.fn.addDw(A,T,u,t,1);
        if(P.tb&&u.alive) E.healUnit(u,P.tb*(u.maxHp||0)); }
      if(T.r['tr_9_2']) A.acts(T,u,[{mark:'vyCf',dur:2,on:'target'}],{u,tgt:t});
      if(P.kt){ v.ktTgt=t; v.ktWas=0; }
      if(P.lt&&v.ltSecond&&v.ltSecond.alive){ const s=v.ltSecond;
        A.acts(T,u,[{pull:{on:'target',to:'self',secs:v.gcDur,m:Math.max(0,A.gap(u,s)-1.2)}}],{u,tgt:s});
        A.control(T,u,s,'stunned',v.gcDur); }
      if(P.ditw&&stN(T,'vyDrift')>=10) A.stSet(T,u,'vyDrift',0); },
    ltOut(A,T,u,c){ const v=V(T), P=T.P; if(!P.lt) return;
      c.amt*=0.7*(1+((c.tgt&&c.tgt===v.ltSecond)?(P.wn||0):0)); },                           // both dragged enemies: 30% less; Wide Net gives the second some back
    /* ---- ABYSSAL MANTLE. Never Lets Go: the window clock (the page holds it; the counter falls here at its end). */
    amKit(A,T,u,c){ const v=V(T), P=T.P, o=c.o||{};
      if(P.nlg){ v.nlgWin=(o.dur||2.4); v.nlgCount=0; v.nlgFired=0; v.nlgFoes=[]; } },
    /* ---- THE COUNTER (the evade's, the signatures'). land: Other Half's stack, Clinging, Sharp Return, the in-block guard. */
    lp(A,T,u,c){ if(c.skill!=='counter') return; V(T).lastDodge=c.src||null; },
    ld(A,T,u,c){ if(c.skill!=='counter') return; const v=V(T), P=T.P;
      u._vyNoCtr=1;                                                                       // with Hungry Mantle / Never Lets Go the in-block counter falls once
      if(P.sharp) A.acts(T,u,[{buff:'haste',x:P.sharp,dur:3,on:'self'}],c);               // Sharp Return
      if(T.r['oh_12_2']) A.stSet(T,u,'vyCtr',Math.min(10,stN(T,'vyCtr')+1));              // Other Half
      if(P.cling) v.cling=2; },                                                           // Clinging
    /* ---- A CRUSH (an enemy reached 5 Deepwater): the burst, Implosion's spread, Deepwater Drunk. */
    crush(A,T,u,c){ T.fn.crushT(A,T,u,c.tgt); },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP (DRG70: at most 70% off a hit on him, kept-share floored at 0.30; the page's
       own mantle stance is outside). The Fold's trigger lives here so its halving multiplies the same product under the floor. */
    myDr(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(v.tide==='in') cut((P['bm.dr']||0)+(P['sg.dr']||0));                               // Breathing Mantle + Slow Gills (breathing in)
      if(P.cling&&v.cling>0) cut(P.cling);                                                  // Clinging (2 s after a counter)
      if(P.tl&&c.src&&A.gap(u,c.src)<3*E.METER()) cut(P.tl);                                // Tough Love (a near enemy)
      if(P.up&&T.s.moved) cut(P.up);                                                        // Updraft (moving)
      if(P.ss&&c.crit) cut(P.ss);                                                           // Salt Scar (a critical hit)
      if(P.pw&&c.src&&((c.src.slow||0)>0||(c.src.stunned||0)>0)) cut(P.pw);                 // Pressure Wise (a slowed or rooted attacker)
      if(P.un&&c.src&&A.markOf(u,c.src,'vyHush')) cut(P.un);                                // Unspoken (a hushed attacker)
      if(P.ha&&c.src&&((c.src.range||0)>2*E.METER())) cut(P.ha);                            // High Air (a ranged attacker: beyond a melee kit's reach)
      if(P.sw&&v.swad>0) cut(P.sw);                                                         // Swaddled (the wave's first 4 s)
      if(P.mp&&v.folds>0) cut(Math.min(0.06,P.mp*Math.min(6,v.folds)));                     // Mother's Patience (0.5%/rank a fold, 6 folds)
      if(has(T,FOLD)&&v.foldC>0){ const line=Math.max(0.05, 0.08-(P['fo.line']||0));        // The Fold: a single hit above the line, folded into the mantle
        if((c.amt||0)>=line*(u.maxHp||0)){ v.foldC--; v.folds++; v.foldT=Math.max(2,12+(P['fold.per']||0));
          if(P.qw&&u.alive) E.healUnit(u,P.qw*(u.maxHp||0));                                // Quick to Wrap
          if(T.r['oh_3_1']) v.fs=1;                                                         // Folded Strike: the next basic also strikes as the counter, half strength
          if(P.fu) v.fu=1;                                                                  // Folded Under: the next crescent deals more
          if(P.fuDw&&c.src&&c.src.team!==u.team&&T.r['tr_1_1']) T.fn.addDw(A,T,u,c.src,2);      //   ... and its attacker sinks (the Trench LINK)
          cut(0.5+(P['wt2']||0)); } }                                                       // the fold takes half (Wrapped Tight: 5%/rank more), inside this product
      c.amt*=Math.max(DR_FLOOR,k); },
    /* ---- HIS CRITS: Carried Along (a full-Drift basic is a guaranteed crit and spends 5). */
    critFn(A,T,u,c){ const v=V(T), P=T.P; if(c.force) return;
      if(c.auto&&P.ca&&stN(T,'vyDrift')>=10){ c.force=true; A.stSet(T,u,'vyDrift',Math.max(0,stN(T,'vyDrift')-5)); } },
    /* ---- HIS HITS THAT LANDED: Mantle Hunger (a counter heals him), Dead Calm (the first hit after a turn of the tide),
       Folded Strike (the next basic also strikes as the counter at half strength). */
    hitFn(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), t=c.tgt;
      if(P.mh&&T.s.cur==='counter'&&(c.hpLost||0)>0&&u.alive) E.healUnit(u,P.mh*c.hpLost);
      if(v.dc&&t&&t.team!==u.team){ v.dc=0; if(P.dc&&u.alive) E.healUnit(u,P.dc*(u.maxHp||0)); }
      if(v.fs&&c.auto&&t&&t.alive&&t.team!==u.team){ v.fs=0; T.fn.ctrStrike(A,T,u,t,0.5); } },
    /* ---- A DODGE (decision 3): Giddy, Sky Fall's heal, Unburdened, Flick of the Tail's arm, the signature's crescent. */
    nlgEvt(A,T,u,c){ const v=V(T); if(v.nlgWin>0&&v.nlgFired!==1){ v.nlgCount++; if(c.src&&c.src.team!==u.team&&v.nlgFoes.indexOf(c.src)<0) v.nlgFoes.push(c.src); } },
    dodgeEvt(A,T,u,c){ const v=V(T), P=T.P, E=A.eng();
      if(has(T,GID)){ const cap=A.stMax(T,u,'vyGiddy'), n=stN(T,'vyGiddy'); if(n<cap) A.stSet(T,u,'vyGiddy',n+1); }
      if(P.sky&&u.alive) E.healUnit(u,P.sky*(u.maxHp||0));
      if(T.r['tl_12_2']&&v.dodges<10){ v.dodges++; A.stSet(T,u,'vyDod',v.dodges); }
      if(T.r['tl_9_2']) v.flick=1;
      if(v.s3>0&&c.src) T.fn.sig3Cast(A,T,u,c.src); },
    /* ---- BANKED MISSES (bankPre lane; the page makes the blow miss when the row sets ctx.miss and reads u._vyBankMiss).
       It Never Let Go: a hit that would drop him below 30% HP folds him away - that blow and every attack for 2 s miss,
       the tide breathes out 4 s, and at the end the counter falls on every enemy that swung. Head in the Clouds: at full
       Giddy the next attack aimed at him misses, once every 8 s. */
    sig2(A,T,u,c){ const v=V(T);
      if(v.ilgWin>0){ c.miss=true; u._vyBankMiss=1; if(c.src&&c.src.team!==u.team&&v.ilgFoes.indexOf(c.src)<0) v.ilgFoes.push(c.src); return; }
      if(v.ilgLock>0) return;
      if(!(u.hp-(c.amt||0)<=0.30*(u.maxHp||0))) return;                                    // the hit as it stands at this lane
      if((u._evadeT||0)>0) return;                                                         // the cloak takes it
      v.ilgLock=20; v.ilgWin=2; v.ilgFoes=c.src?[c.src]:[];
      c.miss=true; u._vyBankMiss=1;
      v.tide='out'; v.tideT=4; v.rb=1; v.dc=1; },                                           // the mantle breathes out 4 s
    hitClouds(A,T,u,c){ const v=V(T);
      if(stN(T,'vyGiddy')>=A.stMax(T,u,'vyGiddy')-1e-9&&v.hcLock<=0){ v.hcLock=8; c.miss=true; u._vyBankMiss=1; } },
    /* ---- TOO EASY / HIS BLUE COOLDOWNS ---- */
    killFn(A,T,u,c){ const P=T.P; if(P.ez) A.stSet(T,u,'vyDrift',Math.min(A.stMax(T,u,'vyDrift'),stN(T,'vyDrift')+P.ez)); },
    cdSet(A,T,u,c){ const P=T.P; if(c.slot==='blue') c.amt=Math.max(BLUE_FLOOR, c.amt-(P['cd.b']||0)-(P['cd.lh']||0));
      else if(c.slot==='green'&&P['cd.g']) c.amt=Math.max(0, c.amt-P['cd.g']); },
    riptide(A,T,u){ const P=T.P; u.energy=Math.max(0,Math.min(100,(u.energy||0)+P.rt)); },
    /* ---- helpers ---- */
    addDw(A,T,u,t,n){ if(!t||!t.alive||t.team===u.team) return; A.acts(T,u,[{ustack:'vyDw',on:'target',add:n}],{u,tgt:t}); },
    crushT(A,T,u,t){ if(!t||!t.alive||t.team===u.team) return; const v=V(T), P=T.P;
      A.ustPut(T,u,t,'vyDw',0);                                                             // the stacks reset
      if(P.crush){ const d=(u.dmg||0)*P.crush*(1+(P['crush.more']||0)); if(d>0) A.hurt(T,u,t,d,'#5fa8ff'); }   // The Crush (Crush Depth: stronger)
      if(P.impl) for(const x of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},{u,tgt:t})) T.fn.addDw(A,T,u,x,P.impl);
      if(T.r['tr_12_1']) A.stSet(T,u,'vyDrunk',Math.min(5,stN(T,'vyDrunk')+1)); },
    ctrStrike(A,T,u,t,mul){ const E=A.eng(); if(!t||!t.alive||!u.alive||!E.strike) return; const pv=T.s.cur, d0=T.s.d;
      T.s.cur='counter'; T.s.d=0; try{ E.strike(u,t,(u.apow||0)*(u._evadeMul||2.0)*mul,'#5fa8ff','magic'); } finally{ T.s.cur=pv; T.s.d=d0; } },
    sig3Cast(A,T,u,src){ const E=A.eng(); if(!src||!src.alive||src.team===u.team||!u.alive||!E.castSlot) return; u._vySigCast=1; E.castSlot(u,'green',src); },
    tideIn(A,T,u){ const v=V(T), P=T.P; v.tide='in'; v.tideT=4+(P['br.dur']||0); v.rb=0; v.dc=0; },
    flipOut(A,T,u){ const v=V(T), P=T.P; v.tide='out'; v.tideT=4+(P['br.dur']||0); v.rb=1; v.dc=1; },
    /* ---- CONDITIONS ---- */
    critPool(A,T){ return Math.min(5, rk(T,'tr_12_3')+rk(T,'tl_1_3')); },
    tideOut(A,T){ return V(T).tide==='out'; },
    sig1On(A,T){ return V(T).s1>0; },
    sig3up(A,T,u){ return V(T).s3>0&&!!T.s.moved; },
    drift5(A,T){ return stN(T,'vyDrift')>=5; },
    drift10(A,T){ return stN(T,'vyDrift')>=10; },
    staySteady(A,T){ return rk(T,'tl_5_2')>0; },
    letGo(A,T){ return rk(T,'tl_5_3')>0; },
    noSteady(A,T){ return !rk(T,'tl_5_2'); },
    tgtSlowed(A,T,u,c){ return !!(c.tgt&&(c.tgt.slow||0)>0); },
    tgtRooted(A,T,u,c){ return !!(c.tgt&&(c.tgt.stunned||0)>0); },
    dw3(A,T,u,c){ return A.ustGet(T,u,c.tgt,'vyDw')>=3; },
    rbOk(A,T){ return V(T).rb>0; }, rbSpend(A,T){ V(T).rb=0; },
    fuOk(A,T){ return V(T).fu>0; }, fuSpend(A,T){ V(T).fu=0; },
    surfOk(A,T){ return V(T).srOk>0; }, surfSpend(A,T){ const v=V(T); v.srOk=0; v.srD=0; },
    flickOk(A,T){ return V(T).flick>0; }, flickSpend(A,T){ V(T).flick=0; },
    glassOk(A,T){ return V(T).glass>0; }, glassSpend(A,T){ V(T).glass=0; }
  },
  /* Folded Strike: the design's "next basic strikes as the counter" is an extra counter strike at half strength riding
     the basic (hitFn), not a replacement of the swing - the ruling records the reading. */
  partial:{},
  ruling:{}
};
