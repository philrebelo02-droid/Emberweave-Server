/* VIREO - what her learned talents do in a fight (the mechanics; her 8 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   Her real kit (the code, not the tooltip wording):
   - Crescendo ('crescendo', green, cd 7): heals EVERY ally, herself included, for 200% of her ability power x the ring (healFrom: her healing power
     applies), then pushes a heal over time of 40% AP x the ring each second for 5 s (o.dur; healing power does NOT apply to it). The ring count is the
     engine's `_crescStk`: +1 a cast, at most 4, +25% a ring. NOTHING ever resets it in a fight: from the 4th Crescendo on, every one rings at 4.
   - Harmony ('harmonyshield', blue, cd 9): every ally whose centre is within 10 m (o.radius) of the MOST WOUNDED ally (lowestAlly: lowest HP share)
     gets shield = max(its shield, 240% AP x o.mul) for 12 s (o.dur). No damage, no heal.
   - Grand Symphony ('symphony', ult): every ally on the field healed 30% AP (healFrom), every enemy hit for 30% AP magic (dealDamage).
   - Perfect Pitch (passive): each Crescendo / Symphony heal also writes shield = max(shield, heal x 50%+ (40%+ on Symphony)), shieldT 5 s (6 s).
   - Her basic attacks are magic (damageProfile Healer). One shield number per unit: every shield in the game is the same pool.
   "Her heals" below = the heals of her skills: Crescendo's heal and each tick of its mending, Grand Symphony's heal. Heals her talents make (Encore,
   Choir Dome, Held Note...) are not "her heals" for her other talents (no cascades, 03 section 6.2). "An ally" = another hero on her side.
   Talents whose text cannot run against that kit are NOT guessed at: they are written up for the owner in WIRING/06 - VIREO - talents that need a ruling.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const AL={team:'ally',others:true};       // her allies: the other heroes on her side (never a summon)
const SONG='#e0b6ff';
const CHORD_SEL={team:'enemy',of:'target',within:P('chord.r',2)};              // the shattering enemy and every enemy within 2 m of it (body to body)
const ENCORE=[{atOne:'unit'},{heal:{pct:{rk:'lh_4_4',r:0.08,$m:'enc.more'},of:'tgtMaxHp'},pow:true,on:'unit'},{emit:'encore',on:'unit'}];   // kept at 1 HP, healed 8% x Encore's rank
const PPW=(sk,d)=>({on:'pitch',if:{p:'pp.on',casting:sk},do:[{later:[{shield:{pct:P('pp.more',1),of:'hit'},mode:'max',dur:P('pp.dur',d),on:'target'}]}]});   // Perfect Pitch rewritten once the skill is done
const DB={r:0.05,$:'db.more'};                                                  // Keep Time's Downbeat bonus (Accent adds to it)
module.exports={
  hero:'vireo',
  casting:true,                         // rows ask which of her skills a heal or a hit comes from
  states:{
    ring:{max:P('ring.cap',4)},         // her Crescendo ring, as her talents count it (4; 6 with Swelling Chorus; 2 with Steady Choir)
    dis:{unit:true,max:5,dur:P('dis.dur',4),step:P('dis.step',0),gain:'disGain',full:'chord',chain:P('chain',0)},   // Dissonance, on each enemy
    bravo:{}, accel:{max:10}, bars:{max:6},
    str:{max:P('str.n',6),start:'max',refill:P('str.rt',10),refilled:'retune'}   // Strings: whole ones; a snapped one retunes on its own clock
  },
  /* needs: a talent that improves a mechanic does nothing without the talent that introduces it */
  needs:{ lh_2_1:'lh_1_1', lh_4_2:'lh_2_2', lh_9_2:'lh_7_2', lh_6_2:'lh_5_2', lh_6_3:'lh_5_3',
          lh_5_4:'lh_4_4', lh_8_4:'lh_4_4', lh_7_4:'lh_4_4', lh_10_4:'lh_4_4', lh_11_4:'lh_4_4', lh_12_4:'lh_4_4',
          ds_1_3:'ds_1_1', ds_1_4:'ds_1_1', ds_2_1:'ds_1_1', ds_3_1:'ds_1_1', ds_4_2:'ds_1_1', ds_5_1:'ds_1_1', ds_7_2:'ds_1_1', ds_8_3:'ds_1_1', ds_9_2:'ds_1_1', ds_11_1:'ds_1_1', ds_11_2:'ds_1_1',
          ds_4_1:'ds_3_1', ds_n1:'ds_3_1', ds_6_1:'ds_3_1', ds_8_1:'ds_3_1', ds_9_1:'ds_3_1', ds_12_1:'ds_3_1', ds_10_1:'ds_3_1',
          ds_5_2:'ds_4_2', ds_10_3:'ds_4_2', ds_6_2:'ds_5_2', ds_6_3:'ds_5_3',
          ds_4_4:'ds_3_4', ds_5_4:'ds_3_4', ds_7_4:'ds_3_4', ds_8_4:'ds_3_4', ds_10_4:'ds_3_4', ds_11_4:'ds_3_4', ds_12_4:'ds_3_4',
          li_2_1:'li_1_1', li_3_1:'li_1_1', li_4_1:'li_1_1', li_5_1:'li_1_1', li_5_3:'li_1_1', li_7_1:'li_1_1', li_7_2:'li_1_1', li_8_1:'li_1_1', li_9_1:'li_1_1', li_11_1:'li_1_1', li_12_1:'li_1_1',
          li_6_1:'li_5_1', li_6_3:'li_5_3', li_10_1:'li_3_1',
          li_4_2:'li_2_2', li_5_2:'li_2_2', li_6_2:'li_2_2', li_9_2:'li_2_2', li_11_2:'li_2_2', li_12_2:'li_2_2', li_13_2:'li_2_2',
          li_3_4:'li_1_4', li_4_4:'li_1_4', li_5_4:'li_1_4', li_6_4:'li_1_4', li_7_4:'li_1_4', li_8_4:'li_1_4', li_10_4:'li_1_4', li_11_4:'li_1_4', li_12_4:'li_1_4' },
  /* run for her whenever she has any mechanic talent: her ring count, her Crescendo mending made hers, Harmony's dome, Perfect Pitch's shield as an event */
  always:[
    {on:'kit',skill:'crescendo',do:[{stack:'ring',add:1},{tagHots:'kit'}]},
    {on:'cast',skill:'crescendo',do:[{tagHots:'crescendo'}]},
    {on:'kit',skill:'harmonyshield',if:{window:'harm'},do:[{emit:'domeEnd'}]},                       // a new Harmony replaces the one still up
    {on:'end:harm',do:[{emit:'domeEnd'}]},
    {on:'kit',skill:'harmonyshield',do:[{zone:'harm',at:'lowestAlly',radiusPx:{opt:'radius',d:0},dur:{opt:'dur',d:12},centre:true,only:true},{window:'harm',dur:{opt:'dur',d:12}}]},   // the dome: 10 m around the most wounded ally, where it was cast
    {on:'healed',if:{casting:['crescendo','symphony'],selfPass:'perfectpitch'},do:[{emit:'pitch',amt:{pct:1,of:'pitch'}}]},
    PPW('crescendo',5), PPW('symphony',6)
  ],
  talents:{
    /* ============================== THE LISTENING HALL ============================== */
    lh_1_1:[ {on:'healed',if:{who:'ally'},do:[{mark:'listen',on:'target',dur:P('listen.dur',4),longest:true},{emit:'listened'}]},   // Rapt Attention: every ally she heals is Listening
             {on:'teamIn',if:{targetHas:'listen',srcTeam:'enemy'},less:R(0.01)} ],                  //   and takes less damage
    lh_2_3:[ {param:'pp.on',add:1}, {param:'pp.more',add:R(0.04)} ],                                // Warm Tone: Perfect Pitch shields larger
    lh_n1:[  {on:'cd',skill:'green',add:R(-0.2)} ],                                                 // Breath Control
    lh_2_1:[ {param:'listen.dur',add:R(0.5)} ],                                                     // Hushed Hall
    lh_2_2:[ {on:'hotEnd',if:{tag:'crescendo',who:'ally'},do:[{hot:{pct:{r:0.10,$m:'song.more'},of:'hit'},perTick:true,dur:P('held.dur',5),every:1,on:'target',htag:'held'},{window:'held',dur:P('held.dur',5)}]},   // Held Note
             {on:'hurt',if:{window:'held'},do:[{unhot:'held'},{window:'held',end:true}]} ],         //   for as long as she is not hit
    lh_3_1:[ {on:'teamIn',if:{targetHas:'listen',srcTeam:'enemy',targetIs:Object.assign({has:'listen',order:'lowHp',n:1},AL)},less:0.08} ],   // Front Row
    lh_4_2:[ {param:'held.dur',add:R(1)} ],                                                         // Sustain
    lh_3_3:[ {on:'kit',skill:'harmonyshield',opt:{mul:{more:R(0.03)}}} ],                           // Wide Dome
    lh_n2:[  {on:'teamIn',if:{srcHas:'listen',auto:true,targetTeam:'enemy'},more:0.02},             // Sing Along (LINK)
             {on:'teamIn',req:'ds_1_1',if:{srcHas:'listen',auto:true,targetTeam:'enemy'},do:[{ustack:'dis',on:'target',add:1,lock:'singL',lockDur:1}]} ],   //   with Off Key: 1 Dissonance (each enemy once a second)
    lh_4_1:[ {on:'teamIn',if:{srcHas:'listen',targetTeam:'enemy'},more:R(0.01)} ],                  // Rapt Crowd
    lh_8_3:[ {param:'pp.on',add:1}, {param:'pp.dur',add:R(0.4)} ],                                  // Bright Timbre
    lh_4_4:[ {on:'teamLethal',by:'unit',once:'fight',if:{who:'ally',unitHas:'listen'},do:ENCORE} ], // Encore
    lh_5_1:[ {on:'teamIn',if:{srcHas:'spb',srcTeam:'enemy'},less:R(0.01)}, {on:'in',if:{srcHas:'spb'},less:R(0.01)},   // Spellbound: enemies that hit a Listening ally deal less
             {on:'teamIn',if:{targetHas:'listen',srcTeam:'enemy'},do:[{mark:'spb',on:'source',dur:2}]} ],
    lh_5_4:[ {on:'encore',do:[{mark:'curt',on:'target',dur:3}]}, {on:'teamIn',if:{targetHas:'curt',srcTeam:'enemy'},less:R(0.04)} ],   // Curtain Call
    lh_6_1:[ {on:'healOut',if:{who:'ally',targetHpBelow:0.40},more:R(0.02)} ],                      // Second Verse
    lh_9_3:[ {on:'healOut',skill:'crescendo',if:{targetIn:'harm'},more:R(0.03)} ],                  // Harmonic Swell (its heal and its mending)
    lh_8_4:[ {on:'encore',do:[{shield:{pct:R(0.05),of:'tgtMaxHp'},dur:5,pow:true,on:'target'}]} ],  // Bis (reading: lasts 5 s, as her Perfect Pitch shields)
    lh_7_2:[ {on:'cast',skill:'harmonyshield',do:[{mark:'listen',on:Object.assign({inZone:'harm'},AL),dur:{opt:'dur',d:12},longest:true},{emit:'listened'}]},   // Choir Dome: Listening for the dome's 12 s
             {on:'tick',period:1,if:{zone:'harm'},do:[{heal:{pct:{b:0.01,$:'dome.mend',$m:'song.more'},of:'tgtMaxHp'},pow:true,on:Object.assign({inZone:'harm'},AL)}]} ],   //   and it mends 1% of their max HP each second
    lh_7_4:[ {on:'encore',do:[{stack:'bravo',add:1}]}, {stat:{heal:R(0.02)},per:'bravo'} ],         // Bravo
    lh_8_1:[ {on:'healOut',if:{targetHas:'listen'},more:R(0.02)} ],                                 // Listen Closely
    lh_9_2:[ {param:'dome.mend',add:R(0.002)} ],                                                    // Resounding Dome
    lh_5_2:[ {param:'ring.cap',add:2}, {param:'pp.on',add:1},                                       // Swelling Chorus: up to 6 rings, +25% a ring as the engine's own
             {on:'healOut',skill:'crescendo',more:1/7,per:{stack:'ring',over:4}}, {on:'pitch',if:{casting:'crescendo'},more:1/7,per:{stack:'ring',over:4}} ],
    lh_5_3:[ {param:'ring.cap',add:-2}, {param:'ring.ecap',add:-2},                                 // Steady Choir: never louder than the 2nd ring...
             {on:'kit',skill:'crescendo',opt:{dur:{add:3}},do:[{field:'_crescStk',on:'self',max:P('ring.ecap',3)}]} ],   //   ...and its mending lasts 3 s longer
    lh_9_1:[ {on:'teamIn',by:'target',icd:6,if:{targetHas:'listen',srcTeam:'enemy',hitMin:{pct:0.15,of:'tgtMaxHp'}},do:[{mark:'rsil',on:'target'}]},   // Rapt Silence
             {on:'healOut',if:{targetHas:'rsil',casting:['crescendo','symphony']},mul:2,do:[{mark:'rsil',on:'target',clear:true}]} ],
    lh_6_2:[ {on:'healOut',skill:'crescendo',if:{stackMin:{ring:5}},more:R(0.05)} ],                // Long Swell: the 5th and 6th rings
    lh_6_3:[ {on:'healOut',skill:'crescendo',if:{hot:true,targetHpBelow:0.50},more:R(0.04)} ],      // Even Breath: Steady Choir's mending
    lh_10_1:[ {stat:{heal:R(0.03)},if:{atLeast:{n:4,of:Object.assign({has:'listen'},AL)}}} ],      // Full House
    lh_10_3:[ {on:'cast',skill:'crescendo',do:[{cleanse:1,on:Object.assign({ctrl:true,order:'lowHp',n:R(1)},AL)}]} ],   // Clean Tone
    lh_10_4:[ {on:'encore',do:[{heal:{pct:R(0.02),of:'tgtMaxHp'},pow:true,on:Object.assign({skip:'target'},AL)}]} ],   // Last Bow
    lh_11_1:[ {on:'in',if:{atLeast:{n:3,of:Object.assign({has:'listen'},AL)}},less:R(0.015)} ],    // Stage Presence
    lh_11_2:[ {on:'cast',skill:'harmonyshield',do:[{mark:'hsh',on:Object.assign({inZone:'harm'},AL)}]},   // Dome Song: the allies inside it
             {on:'domeEnd',do:[{heal:{pct:0.5,of:'tgtShield'},pow:true,on:Object.assign({has:'hsh'},AL)},{mark:'hsh',on:{team:'ally'},clear:true}]} ],
    lh_11_4:[ {on:'encore',do:[{mark:'saved',on:'target'}]}, {on:'healOut',if:{targetHas:'saved'},more:R(0.03)} ],   // Unbroken Tone
    lh_12_1:[ {on:'healed',by:'target',icd:3,if:{who:'ally',targetHas:'listen'},do:[{energy:R(1),on:'target'}]} ],   // Rising Applause
    lh_12_2:[ {param:'song.more',add:R(0.03)} ],                                                    // The Long Note: Held Note and Choir Dome
    lh_12_3:[ {on:'healed',if:{who:'ally',overMin:0,selfPass:'perfectpitch'},do:[{later:[{shield:{pct:R(0.10),of:'over'},dur:P('pp.dur',5),on:'target'}]}]} ],   // Mastery of Song
    lh_12_4:[ {param:'enc.more',add:R(0.05)} ],                                                     // Encore Bell
    lh_13_2:[ {on:'listened',if:{some:AL,none:Object.assign({lacks:'listen'},AL)},do:[{window:'ovat',dur:6,cd:30}]},   // Standing Ovation (SIGNATURE): every ally Listening
              {on:'healOut',if:{window:'ovat'},more:0.40},                                          //   heals 40% stronger
              {on:'healed',if:{window:'ovat'},do:[{later:[{shield:{pct:1,of:'heal'},dur:5,on:'target'}]}]},   //   every heal also shields for its full amount
              {on:'teamLethal',if:{window:'ovat',who:'ally'},do:ENCORE} ],                          //   any ally who would die is caught by Encore

    /* ============================== DISSONANCE ============================== */
    ds_1_1:[ {on:'healed',if:{who:'ally'},do:[{ustack:'dis',on:{team:'enemy',of:'target',n:1},add:1,lock:'disL',lockDur:1,emit:'disHeal'}]},   // Off Key: the enemy nearest the ally she heals
             {on:'hit',unless:'ds_13_2',if:{casting:'symphony'},do:[{ustack:'dis',on:'target',add:P('sym.dis',1)}]},   //   Grand Symphony: every enemy it hits
             {on:'teamIn',if:{targetTeam:'enemy',kind:'magic',targetUst:{dis:1}},more:R(0.01),per:{ust:'dis',of:'target'}} ],   //   each stack: more magic damage taken (from anyone)
    ds_1_3:[ {on:'out',if:{kind:'magic',targetUst:{dis:1}},more:R(0.02)} ],                         // Sharp Voice
    ds_1_4:[ {on:'hit',if:{auto:true},icd:[4,3,2],do:[{ustack:'dis',on:'target',add:1}]} ],         // Quick Bow
    ds_2_1:[ {param:'dis.dur',add:R(1)} ],                                                          // Grating
    ds_2_2:[ {on:'out',if:{casting:'symphony'},more:R(0.04)} ],                                     // Loud Finale
    ds_3_1:[ {on:'chord',do:[{ustack:'dis',on:'target',set:0},{dmg:{pct:R(0.20),of:'apow'},on:CHORD_SEL,tag:'chord',color:SONG},{emit:'chordDone'}]} ],   // Broken Chord
    ds_4_2:[ {on:'cast',skill:'crescendo',unless:'ds_5_2',do:[{dmg:{pct:R(0.10),of:'lastHeal'},on:{team:'enemy',ust:{dis:1},order:'most:dis',n:1},tag:'refrain',color:SONG}]} ],   // Biting Refrain
    ds_n1:[  {on:'chordDone',do:[{heal:{pct:R(0.06),of:'apow'},pow:true,on:Object.assign({order:'lowHp',n:1},AL)}]} ],   // Resolution
    ds_3_4:[ {on:'tick',period:6,do:[{mark:'sour',on:{team:'enemy',order:'high:dmg',n:1},dur:P('sour.dur',3),unique:true},{emit:'sour',on:'holder:sour'}]},   // Sour Note
             {on:'teamIn',if:{srcHas:'sour'},less:R(0.03)}, {on:'in',if:{srcHas:'sour'},less:R(0.03)} ],
    ds_4_1:[ {param:'chord.r',add:R(0.3)} ],                                                        // Shrapnel Chord
    ds_5_2:[ {on:'cast',skill:'crescendo',do:[{dmg:{pct:{rk:'ds_4_2',r:0.10},of:'lastHeal'},on:{team:'enemy',ust:{dis:3}},tag:'wound',color:SONG}]} ],   // Wound Song
    ds_5_3:[ {on:'tick',period:1,req:'ds_1_1',if:{zone:'harm'},do:[{ustack:'dis',on:{team:'enemy',inZone:'harm'},add:1}]},   // Silent Dome: 1 Dissonance a second inside
             {on:'tick',period:0.5,if:{zone:'harm'},do:[{slow:P('sdome.slow',0.20),dur:0.6,on:{team:'enemy',inZone:'harm'}}]} ],   //   and 20% slower
    ds_4_4:[ {param:'sour.dur',add:R(0.5)} ],                                                       // Flat Ear
    ds_5_1:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',ust:{dis:3}}} ],                                // Ringing Ears
    ds_6_3:[ {param:'sdome.slow',add:R(0.05)} ],                                                    // Hum of the Dome
    ds_5_4:[ {on:'teamIn',if:{targetHas:'sour',srcTeam:'ally'},more:R(0.02)} ],                     // Tin Ear (her whole team, her own hits too)
    ds_6_1:[ {on:'chordDone',do:[{energy:R(1)}]} ],                                                 // Feedback
    ds_6_2:[ {on:'dmg:wound',more:R(0.05)} ],                                                       // Cutting Voice
    ds_2_3:[ {on:'out',if:{casting:'symphony'},ignoreMr:R(0.03)} ],                                 // Clarity. PARTIAL: the Broken Chord half waits
    ds_6_4:[ {on:'healOut',less:R(0.04)}, {on:'out',more:R(0.04)} ],                                // Harsh Voice (RISK)
    ds_7_2:[ {on:'pitch',if:{who:'ally'},do:[{ustack:'dis',on:{team:'enemy',of:'target',n:1},add:1}]} ],   // Shrill Pitch
    ds_7_4:[ {on:'disGain',if:{targetHas:'sour'},do:[{dmg:{pct:R(0.03),of:'apow',k:1},on:'target',tag:'sting',color:SONG}]} ],   // Off-Beat Sting: per stack that lands
    ds_8_1:[ {param:'chain',add:R(1)} ],                                                            // Chain Reaction
    ds_8_3:[ {on:'disHeal',chance:R(0.10),do:[{ustack:'dis',on:{team:'enemy',of:'unit',n:1,skipN:1},add:1}]} ],   // Projection: the next-nearest enemy to that ally
    ds_8_4:[ {on:'sour',do:[{silence:R(0.3),on:'target'}]} ],                                       // Long Silence
    ds_9_1:[ {on:'chordDone',do:[{ustack:'dis',on:CHORD_SEL,add:2}]} ],                             // Splitting Chord
    ds_9_2:[ {stat:{apow:R(0.002)},per:{ust:'dis',of:'field',max:25}} ],                            // Cacophony
    ds_9_3:[ {on:'out',if:{casting:'symphony',targetHpBelow:0.50},more:R(0.03)} ],                  // Cold Stage
    ds_12_3:[ {stat:{hp:R(-0.01),apow:R(0.02)}} ],                                                  // Thin Voice (RISK)
    ds_10_3:[ {on:'dmg:refrain',more:R(0.03)}, {on:'dmg:wound',more:R(0.03)} ],                     // Harsh Timbre
    ds_10_4:[ {on:'teamHeal',if:{unitHas:'sour'},less:R(0.05)} ],                                   // Tone Deaf
    ds_11_1:[ {param:'dis.step',add:R(0.6)} ],                                                      // Afterring
    ds_11_2:[ {param:'sym.dis',add:1} ],                                                            // Fortissimo: 2 a hit (each one at 5 sets off Broken Chord, as every Dissonance does)
    ds_11_4:[ {on:'in',if:{srcHas:'sour'},less:R(0.015)} ],                                         // Discord Ward
    ds_12_1:[ {on:'dmg:chord',more:R(0.05)} ],                                                      // Composer's Spite
    ds_12_2:[ {on:'out',if:{casting:'symphony'},more:R(0.03),per:'ring'} ],                         // Ruinous Swell
    ds_10_1:[ {on:'dmg:chord',if:{targetMin:{shield:1e-6}},more:R(0.05)}, {on:'chordDone',do:[{strip:R(0.10),on:CHORD_SEL}]} ],   // Crack the Glass
    ds_12_4:[ {on:'death',if:{unitHas:'sour'},do:[{mark:'sour',on:{team:'enemy',order:'high:dmg',n:1},dur:{r:1,b:3,$:'sour.dur'},unique:true},{emit:'sour',on:'holder:sour'}]} ],   // Sour Finale
    ds_13_2:[ {on:'cast',skill:'symphony',do:[{mark:'wmB',on:{team:'enemy'},clear:true},{ustack:'dis',on:{team:'enemy'},set:'max',burst:true},{window:'wm',dur:5}]},   // The Whole Music (SIGNATURE)
              {on:'tick',if:{window:'wm'},do:[{kill:true,on:{team:'enemy',hpBelow:0.12,boss:false},tag:'wm',color:SONG},   //   below 12% while it plays: falls silent and dies
                {dmg:{pct:0.06,of:'tgtMaxHp'},on:{team:'enemy',hpBelow:0.12,boss:true,lacks:'wmB'},tag:'wm',color:SONG},{mark:'wmB',on:{team:'enemy',hpBelow:0.12,boss:true}}]} ],   //   a boss: 6% of its max HP, once per Symphony

    /* ============================== THE LIVING INSTRUMENT ============================== */
    li_1_1:[ {on:'tick',period:2,rate:P('beat.rate',1),rateUp:[{add:P('beat.low',0),if:{selfHpBelow:0.40}},{add:P('beat.acc',0),per:'accel'}],do:[{emit:'beat'}]},   // Keep Time: a Beat every 2 s
             {on:'beat',if:{noWindow:'final'},every:P('db.n',4),do:[{emit:'downbeat'}]}, {on:'beat',if:{window:'final'},do:[{emit:'downbeat'}]},   //   every 4th a Downbeat
             {on:'downbeat',do:[{window:'db',dur:99}]},                                              //   it waits for her next heal or attack
             {on:'out',if:{window:'db',auto:true},more:DB,do:[{window:'db',end:true}]},
             {on:'kit',if:{window:'db',casting:['crescendo','symphony']},do:[{window:'dbc',dur:99},{window:'db',end:true}]},
             {on:'healOut',if:{window:'dbc'},more:DB}, {on:'out',if:{window:'dbc'},more:DB}, {on:'cast',do:[{window:'dbc',end:true}]} ],
    li_1_3:[ {on:'cd',mul:[1/1.01,1/1.02,1/1.03,1/1.04,1/1.05]} ],                                  // Practised Hands: her skills come back 1% faster
    li_1_4:[ {on:'in',if:{hitMin:{pct:0.10,of:'maxHp'},stackMin:{str:1}},less:R(0.06),do:[{stack:'str',spend:1,then:[{emit:'snap'}]}]} ],   // Rib Strings
    li_2_1:[ {on:'downbeat',do:[{energy:R(1)}]} ],                                                  // Metronome
    li_2_2:[ {on:'tick',period:P('bar.t',8),do:[{stack:'bars',add:1}]}, {stat:{apow:R(0.005)},per:'bars'} ],   // The Unfinished Score
    li_3_1:[ {on:'downbeat',do:[{energy:{b:3,$:'cue.more'},on:Object.assign({below:{energy:100},order:'high:energy',n:1},AL)}]} ],   // Cue
    li_3_3:[ {on:'ccIn',less:R(0.04)} ],                                                            // Poise
    li_3_4:[ {param:'str.rt',add:R(-0.6)} ],                                                        // Retune
    li_4_1:[ {param:'db.more',add:R(0.01)} ],                                                       // Accent
    li_4_2:[ {on:'wave',once:'fight',do:[{stack:'bars',atLeast:R(1)}]} ],                           // Rehearsed
    li_4_4:[ {on:'snap',do:[{dmg:{pct:R(0.15),of:'apow'},on:'source',tag:'twang',color:SONG}]} ],   // Twang: the attacker
    li_5_1:[ {param:'db.n',add:-1} ],                                                               // Waltz Time
    li_5_2:[ {stat:{heal:R(0.003)},per:'bars'} ],                                                   // Memorised
    li_5_3:[ {on:'downbeat',do:[{dmg:{pct:0.30,of:'apow'},on:{team:'enemy',n:P('march.n',1)},tag:'march',color:SONG}]} ],   // March Time
    li_5_4:[ {on:'in',less:R(0.003),per:'str'} ],                                                   // Strung Tight
    li_6_1:[ {on:'downbeat',do:[{cd:'blue',add:R(-0.2)}]} ],                                        // Three-Step
    li_6_2:[ {param:'bar.t',add:R(-0.5)} ],                                                         // Sight Reading
    li_6_3:[ {param:'march.n',add:R(1)} ],                                                          // Drumline
    li_6_4:[ {stat:{apow:R(0.02)},per:{stack:'str',missing:true}} ],                                // Frayed Edge (RISK)
    li_7_1:[ {param:'beat.rate',add:R(0.01)} ],                                                     // Quick Tempo
    li_7_2:[ {on:'kit',skill:'crescendo',if:{window:'dbc'},do:[{stack:'ring',add:1},{field:'_crescStk',on:'self',add:1,max:P('ring.ecap',3)},{window:'sm2',dur:99}]},   // Second Movement: 2 rings
             {on:'cd',skill:'green',if:{window:'sm2'},add:-1,do:[{window:'sm2',end:true}]} ],       //   and back 1 s sooner
    li_7_4:[ {stat:{armor:R(0.002),mr:R(0.002)},per:'str'} ],                                       // Taut Frame
    li_8_1:[ {param:'beat.low',add:R(0.06)} ],                                                      // Rallentando
    li_8_4:[ {param:'str.n',add:R(1)} ],                                                            // Spare Strings
    li_9_1:[ {param:'beat.acc',add:0.03}, {on:'downbeat',do:[{stack:'accel',add:1}]} ],             // Accelerando
    li_9_2:[ {on:'kit',skill:'harmonyshield',opt:{mul:{more:R(0.01),per:'bars'}}} ],                // Long Rehearsal
    li_9_3:[ {on:'kit',once:'wave',do:[{window:'ov',dur:99}]},                                      // Overture: her first skill each wave
             {on:'kit',skill:'harmonyshield',if:{window:'ov'},opt:{mul:{more:R(0.04)}}},
             {on:'healOut',if:{window:'ov'},more:R(0.04)}, {on:'out',if:{window:'ov'},more:R(0.04)}, {on:'cast',do:[{window:'ov',end:true}]} ],
    li_10_1:[ {param:'cue.more',add:R(1)} ],                                                        // Conductor's Eye
    li_10_4:[ {on:'snap',if:{stackEmpty:'str'},do:[{heal:{pct:R(0.06),of:'maxHp'},pow:true,on:'self'},{stack:'str',refillIn:3}]} ],   // Snap Back
    li_11_1:[ {on:'downbeat',do:[{window:'pocket',dur:1}]}, {on:'in',if:{window:'pocket'},less:R(0.03)} ],   // In the Pocket
    li_11_2:[ {stat:{nrg:0.25},if:{stackMin:{bars:6}}} ],                                           // Memory of the Whole
    li_11_4:[ {on:'retune',do:[{heal:{pct:R(0.01),of:'maxHp'},pow:true,on:'self'}]} ],              // Fine Tuning
    li_12_1:[ {on:'downbeat',icd:8,do:[{energy:R(1),on:AL}]} ],                                     // Tempo Giusto
    li_12_2:[ {on:'out',if:{window:'db',auto:true,stackMin:{bars:6}},more:R(0.03)},                 // Last Rehearsal: the Downbeat bonus at 6 Bars
              {on:'healOut',if:{window:'dbc',stackMin:{bars:6}},more:R(0.03)}, {on:'out',if:{window:'dbc',stackMin:{bars:6}},more:R(0.03)} ],
    li_10_3:[ {on:'out',if:{casting:'symphony'},more:R(0.02)}, {on:'healOut',if:{casting:'symphony'},more:R(0.02)} ],   // Bowing Arm
    li_12_4:[ {on:'teamIn',icd:4,if:{targetTeam:'ally',hero:true,srcTeam:'enemy',targetHpBelow:0.25,stackMin:{str:1}},mul:0.5,   // Heartstrings
               do:[{stack:'str',spend:1,then:[{emit:'snap'}]},{heal:{pct:R(0.02),of:'tgtMaxHp'},pow:true,on:'target'}]} ],
    li_13_2:[ {on:'kit',skill:'symphony',if:{stackMin:{bars:6}},do:[{window:'fnote',dur:99}]},      // The Final Note (SIGNATURE). PARTIAL: the Strings' strike waits
              {on:'healOut',if:{window:'fnote',casting:'symphony'},more:1.5}, {on:'out',if:{window:'fnote',casting:'symphony'},more:1.5},
              {on:'cast',skill:'symphony',if:{window:'fnote'},do:[{window:'fnote',end:true},{window:'final',dur:6},{stack:'str',set:0},{stack:'bars',add:-3}]} ]
  },
  /* one sentence runs, another waits for a ruling */
  partial:{
    ds_2_3:'"Broken Chord ignores magic resist": talent damage already lands as stated (not reduced by magic resist), so there is nothing to ignore',
    li_13_2:'"all her Strings snap at once to strike every enemy": the strike has no size'
  },
  /* nothing implemented: the text cannot run against her real kit. Each one is written up for the owner. */
  ruling:{}
};
