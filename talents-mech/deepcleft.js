/* DEEPCLEFT - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Deepcleft")
   His real kit (the code, not the tooltip wording; a melee Bruiser, every skill reads Attack, his damage is physical):
   - Fault Claws ('shred', green, cd 6): ONE hit on his target (150% attack x skill level), then the target's armor counts lower: _shredPct = the larger of
     what it had and the skill's shred (30%, a third of the skill curve, at most 45%), _shredT = 5 s. The break's clock is the target's own: it runs in
     the target's think, so it stands still while the target is stunned.
   - Burrow Guard ('burrowguard', blue, cd 10): the one skill damage-reduction slot drMul 0.25 for 1.4 s, and he is UNTARGETABLE for 1.4 s (_noTarget,
     _bgT): no hit (dealDamage) reaches him while he is under, only DoTs and direct damage, at 75% less. The emerge is in his think (so it waits while he
     is stunned): he comes up beside the NEAREST enemy and strikes it once for 170% of his attack x skill level. The page's landPre / land pair sits around
     that strike ('casting' is 'burrowguard'), and a skillTgt line lets a talent choose who he comes up beneath.
   - Relentless Digger (passive 'digger'): every damage() on him (hits, DoTs, talent damage) adds 1 stack (2 while stunned or feared), max 10; the stacks
     NEVER lapse (all fight). Attack speed x(1 + 0.035 x passive level x stacks) for 4 s after the last one. The 'pass' hook ('digger') runs right after.
   - Quarry Collapse (ultimate 'aoeStun', delivered as a form; ULT_DEF.aoeStun mul 1.4, stun 2 -> the game's 30% cut: 1.4 s, radius 138 px = 4.26 m
     centre to centre around its target; HERO_ULT_ART.deepcleft adds only art): every enemy within the radius takes 140% of his attack and a stun
     through ccApply (the resist roll).
   Seams, Splits, the Lying Wall, Weight, Tallies, Tremor, Shoring and Undermined exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/22 - DEEPCLEFT - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const FC='shred', BG='burrowguard', QC='aoeStun';
const HF=['stunned','fearT','silencedT','_sleepT','pullT','_airT'];          // the controls he counts as "controlled"
/* the states several talents read: their bookkeeping runs when any of these is learned */
const SEAM=['sr_1_1','sr_2_1','sr_3_1','sr_4_1','sr_5_3','sr_5_4','sr_6_1','sr_6_3','sr_7_1','sr_7_2','sr_8_1','sr_9_2','sr_9_3','sr_9_4','sr_10_1','sr_10_2','sr_11_2','sr_12_1','sr_12_2','sr_13_2'];
const FCM=SEAM.concat(['sr_1_3','sr_4_3','sr_5_2','sr_6_2']);              // "under Fault Claws' armor break" (mark 'fc')
const LW=['sr_1_4','sr_3_4','sr_9_4','sr_10_4','sr_12_4'];
const WT=['nd_1_1','nd_2_1','nd_n1','nd_3_1','nd_4_1','nd_5_1','nd_6_1','nd_7_2','nd_11_1','nd_11_2','nd_12_2','nd_13_2'];
const TL=['nd_1_4','nd_2_4','nd_4_3','nd_6_4','nd_8_3','nd_9_4','nd_11_1','nd_12_1','nd_13_2'];
const CTL=['nd_1_2','nd_10_3','nd_11_1','nd_5_2','nd_8_1','nd_9_3','nd_2_1'].concat(WT);   // controls on him: who, when they land, when they end
const TREM=['um_1_1','um_2_1','um_3_1','um_4_1','um_10_1','um_6_1','um_7_4','um_5_2','um_11_2','um_13_2'];
const SH=['um_1_4','um_2_4','um_4_3','um_5_4','um_6_4','um_7_4','um_8_3','um_9_4','um_12_4','um_10_4','um_12_3','um_13_2'];
const UM=['um_2_2','um_4_2','um_11_1','um_7_2','um_9_2','um_10_2','um_11_2','um_12_2','um_13_2'];
const DRG=['nd_1_1','nd_n1','nd_1_2','nd_3_3','nd_4_4','nd_7_3','nd_9_3','um_1_3','sr_4_3','um_6_1','um_8_3'];   // his own damage reduction: ONE capped group (myDr)
const TEN=['um_3_3','um_12_4','nd_9_4'];                                    // his control shortening: ONE capped group (ten)
const DIG=['nd_1_4','nd_3_1','nd_7_4','nd_10_4','nd_12_4'];                 // Relentless Digger made faster / stronger / longer
const STN=['um_3_1','nd_6_1','um_5_2','nd_13_2','um_13_2'];                 // his talent stuns (the break rule: lock)
const EMA=['nd_9_2','um_11_2','nd_13_2'];                                   // the emerge strike's size is read
const TK=CTL.concat(TL,SH);
const ENM={team:'enemy'};
const atk=(A,T,u,c)=>A.amtOf(T,u,{pct:1,of:'atk'},c);
/* his talent stuns, at their full written length on the fixed path (no resist roll): never on an enemy that is stunned now, nor on one whose last stun
   from him ended less than 0.5 s ago (mark 'lk'): no enemy is kept stunned by him without a break. Returns the enemies it landed on */
function tstun(A,T,u,c,L,secs){ const out=[]; if(!(secs>0)) return out;
  for(const t of L){ if(!t||!t.alive||t.team===u.team) continue; if((t.stunned||0)>0||A.markOf(u,t,'lk')) continue;
    A.control(T,u,t,'stunned',secs); if((t.stunned||0)>0) out.push(t); }
  return out; }
function seamsHeld(A,T,u,t){ return !!(T.r.sr_11_2&&A.markOf(u,t,'fc')); }
function umark(A,T,u,c,t,d){ A.acts(T,u,[{mark:'um',on:'target',dur:d,longest:true},{window:'umW',dur:d,longest:true}],Object.assign({},c,{tgt:t})); }
const umDur=T=>4+(T.P['um.dur']||0);
module.exports={
  hero:'deepcleft',
  times:['ccl.t'],   // this file's own absolute fight times (paths in T.s): the engine moves them back with the clock at each wave (WIRING/41c)
  casting:true,                         // rows ask which of his skills a hit or a stun comes from
  points:true,                          // Second Shake reads Quarry Collapse's damage where it strikes (the at hook)
  states:{
    seam:{unit:true,max:5,dur:P('seam.dur',4)},                                    // Seams on an enemy: all close 4 s after the last
    grind:{unit:true,max:10,dur:5},                                                // Grind on an enemy
    fgn:{unit:true,max:2,dur:8},                                                   // The Floor Gives Way: re-stuns given to that enemy (at most 2)
    wt:{max:P('wt.max',12)},                                                       // Weight (stays until spent)
    ews:{}, qcs:{},                                                                // the Weight the last emerge spent, the Tremor the last Quarry Collapse spent
    tally:{max:9},                                                                 // Tallies (this fight)
    trem:{max:P('trem.max',30),wave:'reset'},                                      // Tremor (empties at the end of each wave)
    shored:{}, ref:{max:10}, brd:{max:3}
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',reqAny:TK,do:[{fn:'tk'}]},                                                                        // controls on him, Weight, Tallies, Shoring
    {on:'ccIn',reqAny:CTL,do:[{fn:'ccSrc'}]},                                                                    // who is controlling him
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                      // Hard Ground, Load-Bearing, River Not Held: one capped group
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                       // his damage reduction talents: one capped group
    {on:'pass',skill:'digger',reqAny:DIG,do:[{fn:'dig'}]},                                                       // Relentless Digger, faster / stronger / longer
    {on:'hit',reqAny:TREM,if:{targetTeam:'enemy'},do:[{stack:'trem',add:1}]},                                    // Tremor: each hit he deals ...
    {on:'hurt',reqAny:TREM,do:[{stack:'trem',add:1}]},                                                           //   ... or takes
    {on:'kit',skill:QC,reqAny:TREM,do:[{stack:'qcs',set:0},{stack:'trem',spend:'all',then:[{stack:'qcs',set:{pct:1,of:'spent'}}]}]},   // Quarry Collapse spends all Tremor
    {on:'wave',reqAny:LW,do:[{fn:'lw'}]},                                                                        // the Lying Wall: the enemy with the most armor
    {on:'kit',skill:FC,reqAny:FCM,do:[{fn:'fcO'}]},                                                              // Fault Claws' own break (its strength and time, Long Seam)
    {on:'hit',reqAny:FCM,unless:'sr_5_3',if:{casting:FC,targetTeam:'enemy'},do:[{fn:'brk'}]},                    // under Fault Claws' armor break (mark 'fc')
    {on:'hit',reqAny:SEAM,unless:'sr_5_3',if:{auto:true,targetHas:'fc'},do:[{fn:'sAdd',by:1}]},                  // Seams: his basic attacks on an enemy under the break
    {on:'split',reqAny:SEAM,do:[{fn:'split'}]},                                                                  // the fifth Seam Splits
    {on:'landPre',skill:BG,reqAny:WT,do:[{stack:'ews',set:0},{stack:'wt',spend:'all',then:[{stack:'ews',set:{pct:1,of:'spent'}}]}]},   // the emerge spends all Weight
    {on:'hit',reqAny:EMA,if:{casting:BG,targetTeam:'enemy'},do:[{fn:'emA'}]},                                    // the emerge strike's size
    {on:'land',skill:BG,reqAny:UM,do:[{fn:'um'}]},                                                               // Undermined: the enemy the emerge strikes
    {on:'skillTgt',skill:BG,reqAny:['um_5_3','um_9_4','nd_13_2'],do:[{fn:'emTgt'}]},                             // whom he comes up beneath
    {on:'ccHit',reqAny:STN,if:{cc:['stunned'],targetTeam:'enemy'},do:[{fn:'lock'}]}                              // the break rule for his talent stuns
  ],
  talents:{
    /* ============================== THE SEAM READER ============================== */
    sr_1_1:[ {param:'split.r',add:R(1)} ],                                                                      // Read the Face (Seams and the Split: the always rows)
    sr_1_3:[ {on:'out',if:{auto:true,targetHas:'fc'},more:R(0.02)} ],                                           // Iron-Shod Claws
    sr_1_4:[ {on:'kit',skill:FC,if:{targetHas:'lw'},opt:{shred:{add:R(0.03)}}} ],                               // Lying Wall (the mark: the always row)
    sr_2_1:[ {param:'seam.dur',add:R(1)} ],                                                                     // Fine Cracks
    sr_2_2:[ {on:'out',if:{casting:FC},more:R(0.03)} ],                                                         // Deep Rake
    sr_3_1:[ {on:'hit',unless:'sr_5_3',if:{casting:FC,targetTeam:'enemy'},do:[{fn:'sAdd',by:1}]} ],             // One Good Pull
    sr_4_2:[ {param:'fc.dur',add:R(0.5)} ],                                                                     // Long Seam
    sr_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                  // Split Rock
    sr_3_4:[ {on:'out',if:{targetHas:'lw'},more:R(0.02)} ],                                                     // Know the Liar
    sr_4_1:[ {on:'split',do:[{dmg:{pct:R(0.15),of:'spent'},on:{team:'enemy',of:'target',within:2,skip:'target'},tag:'spall'}]} ],   // Spalling
    sr_5_2:[ {on:'hit',if:{targetHas:'fc'},do:[{timer:'_shredT',min:2,on:'target'}]} ],                         // Wall Comes Down (PICK ONE)
    sr_5_3:[ {on:'kit',skill:FC,opt:{shred:{set:1e-9}}},                                                        // Clean Face (PICK ONE): no armor lowered
             {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'sAdd',by:1,fc:2}]} ],                                   //   2 Seams from Fault Claws, 1 from any other hit
    sr_5_4:[ {on:'split',do:[{mark:'moss',on:'target',dur:3}]}, {on:'out',if:{targetHas:'moss'},more:R(0.03)},  // Moss Off (him ...
             {on:'teamIn',if:{targetTeam:'enemy',targetHas:'moss',srcIs:'ally'},more:R(0.03)} ],                //   ... and his team)
    sr_n1:[  {on:'out',if:{targetHpAbove:0.75},more:R(0.02)} ],                                                 // Untouched Stone
    sr_4_3:[ {param:'dr.grit',add:R(0.02)} ],                                                                   // Grit in the Teeth (in myDr)
    sr_6_1:[ {on:'split',do:[{cd:'green',add:R(-0.5)}]} ],                                                      // Tremor Hands
    sr_6_2:[ {stat:{crit:R(0.01)},if:{targetHas:'fc'}} ],                                                       // Bare Rock (up to 5%)
    sr_6_3:[ {on:'split',do:[{heal:{pct:R(0.01),of:'maxHp'},on:'self'}]} ],                                     // Fresh Face (needs Clean Face)
    sr_7_1:[ {on:'out',if:{auto:true},more:R(0.01),per:{ust:'seam'}} ],                                         // Seam Sense
    sr_7_2:[ {on:'hit',if:{casting:QC,targetTeam:'enemy'},do:[{fn:'brk',of:'fc'},{fn:'sAdd',by:3}]} ],          // Fault Line
    sr_7_4:[ {on:'out',if:{targetMore:'armorRating'},more:R(0.02)} ],                                           // Overburden
    sr_8_1:[ {param:'split.more',add:R(0.03)} ],                                                                // Rockfall
    sr_9_2:[ {param:'split.brk',add:R(0.04)} ],                                                                 // Brittle Seam
    sr_9_3:[ {stat:{aspd:R(0.003)},per:{ust:'seam'}} ],                                                         // Ten Years Digging (the Seams on his target)
    sr_9_4:[ {on:'death',if:{unitHas:'lw'},do:[{fn:'liar'}]} ],                                                 // Liar Unmasked
    sr_10_1:[ {on:'split',do:[{mark:'ac',on:'target',dur:2}]}, {on:'out',if:{targetHas:'ac'},more:R(0.02)} ],  // Aftercrack
    sr_10_2:[ {on:'split',do:[{shield:{pct:R(0.01),of:'maxHp'},on:'self',dur:3}]} ],                            // Rubble Skin
    sr_10_4:[ {on:'out',if:{casting:FC,targetHas:'lw'},more:R(0.03)} ],                                         // Truth Told
    sr_11_2:[ {on:'fcEnd',do:[{fn:'seamFree'}]} ],                                                              // Cut the Seam (held: in sAdd / brk)
    sr_11_3:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{ustack:'grind',on:'target',add:1},{window:'grW',dur:5,longest:true}]},   // Grind
              {stat:{armor:R(-0.004)},to:{team:'enemy',ust:{grind:1}},per:{ust:'grind'},if:{window:'grW'}} ],
    sr_12_1:[ {on:'hit',if:{targetTeam:'enemy',targetLacks:'fl'},do:[{mark:'fl',on:'target'},{fn:'sAdd',by:R(1)}]} ],   // First Look
    sr_12_2:[ {on:'split',do:[{stack:'ref',add:1}]}, {stat:{atk:R(0.005)},per:'ref'} ],                         // Read Every Face (up to 10)
    sr_12_3:[ {on:'cd',skill:'green',add:R(-0.5)} ],                                                            // Iron in the Claw
    sr_12_4:[ {on:'death',if:{unitHas:'lw'},do:[{heal:{pct:R(0.04),of:'maxHp'},on:'self'}]} ],                  // Liar's Due
    sr_13_2:[ {on:'split',icd:20,if:{fn:'notCliff'},do:[{fn:'cliff'}]} ],                                       // The Whole Cliff (SIGNATURE)

    /* ============================== NINE DAYS UNDER ============================== */
    nd_1_1:[ {param:'dr.wt',add:R(0.004)}, {on:'out',if:{casting:BG},more:0.03,per:'ews'} ],                    // Slab Across the Back (Weight: the always rows; DR in myDr)
    nd_1_2:[ {param:'dr.bh',add:R(0.015)} ],                                                                    // Badger Hide (in myDr)
    nd_1_4:[ {param:'dig.tally',add:R(0.02)} ],                                                                 // Count the Days (Tallies: tk)
    nd_2_1:[ {on:'ccOn',do:[{stack:'wt',add:R(1)}]} ],
    nd_2_4:[ {stat:{lifesteal:R(0.003)},per:'tally'} ],                                                        // Scratch Marks                                                          // Held Harder
    nd_n1:[  {param:'dr.wiw',add:0.02},                                                                         // Weight in the Walls (LINK; in myDr)
             {on:['hit','hurt'],req:'um_1_1',chance:{flat:0.05,x:'wt'},do:[{stack:'trem',add:1}]} ],            //   with Groundswell
    nd_3_1:[ {param:'dig.fast',add:1} ],                                                                        // Faster in the Dark (in dig)
    nd_3_2:[ {on:'out',if:{casting:BG},more:R(0.03)} ],                                                         // Burrow Deeper
    nd_3_3:[ {param:'dr.rd',add:R(0.015)} ],                                                                    // Rock Dust (in myDr)
    nd_4_1:[ {stat:{atk:R(0.003)},per:'wt'} ],                                                                  // Stone Patience
    nd_4_3:[ {on:'tick',period:3,if:{stackMin:{tally:9}},do:[{heal:{pct:R(0.01),of:'maxHp'},on:'self'}]} ],     // Nine Days
    nd_4_4:[ {param:'dr.hh',add:R(0.002)} ],                                                                    // Hurt Him (in myDr)
    nd_5_1:[ {param:'wt.max',add:R(2)} ],                                                                       // Bear the Slab
    nd_5_2:[ {on:'hardEnd',icd:10,do:[{window:'cus',dur:3},{castSkill:'blue',on:'self'}]},                      // Come Up Swinging (PICK ONE)
             {on:'land',skill:BG,do:[{window:'cus',end:true}]} ],
    nd_5_3:[ {on:'cast',skill:BG,do:[{fn:'stay'}]},                                                             // Stay Down (PICK ONE): 1 s longer under ...
             {on:'tick',period:0.5,if:{fn:'under'},do:[{heal:{pct:0.005,of:'maxHp'},on:'self'}]} ],             //   ... healing 1% of his max HP a second while under
    nd_5_4:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                          // Tooth and Claw
    nd_6_1:[ {on:'land',skill:BG,if:{stackMin:{ews:8}},do:[{fn:'tst',by:R(0.3)}]} ],                            // Pressure Cracks
    nd_6_2:[ {on:'out',if:{casting:BG,window:'cus'},more:R(0.04)} ],                                            // Up Under Them
    nd_6_4:[ {stat:{atk:R(0.005)},per:'tally'} ],                                                               // Raw Claws
    nd_7_2:[ {on:'ccHit',if:{casting:QC,cc:['stunned'],talent:false,targetTeam:'enemy'},do:[{stack:'wt',add:2},{fn:'digAdd',by:1}]} ],   // Ninth Level
    nd_7_3:[ {param:'dr.hb',add:R(0.02)} ],                                                                     // Heavy Back (in myDr)
    nd_7_4:[ {param:'dig.dur',add:R(0.4)} ],                                                                    // Relentless Pace (in dig)
    nd_8_1:[ {on:'ccEnd',do:[{heal:{pct:R(0.01),of:'maxHp'},on:'self'}]} ],                                     // Heaviest Hold
    nd_8_3:[ {stat:{armor:R(0.003)},per:'tally'} ],                                                             // Under Pressure
    nd_9_2:[ {on:'land',skill:BG,do:[{fn:'ttf',by:R(0.06)}]} ],                                                 // Through the Floor
    nd_9_3:[ {param:'dr.ba',add:R(0.02)} ],                                                                     // Buried Alive (in myDr)
    nd_9_4:[ {param:'ten.river',add:0.5} ],                                                                     // River Not Held (in ten)
    nd_12_3:[ {on:'cd',skill:'blue',add:R(-0.5)} ],                                                             // Nine Feet Down
    nd_10_3:[ {on:'out',if:{casting:BG,targetHas:'lc'},more:R(0.05)} ],                                         // Collect the Debt
    nd_10_4:[ {param:'dig.k',add:R(0.03)} ],                                                                    // Never Still (in dig)
    nd_11_1:[ {on:'death',if:{unitHas:'ctl'},do:[{stack:'wt',add:4},{stack:'tally',add:1}]} ],                   // Nobody Left
    nd_11_2:[ {on:'land',skill:BG,do:[{heal:{pct:R(0.002),of:'maxHp',x:{stack:'ews',max:[50,25,50/3,12.5,10]}},on:'self'}]} ],   // Loose Gravel (up to 10%)
    nd_12_1:[ {on:'wave',do:[{stack:'tally',atLeast:R(1)}]} ],                                                  // The Seam's Name
    nd_12_2:[ {on:'out',if:{stackMin:{wt:12}},more:R(0.02)} ],                                                  // Heavy Hands
    nd_12_4:[ {param:'dig.low',add:R(0.1)} ],                                                                   // River in the Rock (in dig)
    nd_13_2:[ {on:'in',once:'fight',if:{dropBelow:0.25},do:[{after:0,do:[{fn:'utf'}]}]},                        // Up Through the Floor (SIGNATURE)
              {on:'hurt',do:[{fn:'dby'}]}, {on:'land',skill:BG,if:{window:'utf'},do:[{fn:'utfLand'}]} ],

    /* ============================== THE UNDERMINE ============================== */
    um_1_1:[ {on:'out',if:{casting:QC},more:R(0.002),per:'qcs'} ],                                              // Groundswell (Tremor: the always rows)
    um_1_3:[ {param:'dr.db',add:R(0.03)} ],                                                                     // Dense Bones (in myDr)
    um_1_4:[ {on:'teamIn',if:{targetHas:'sh',srcTeam:'enemy'},less:R(0.015)} ],                                  // Pit Props (Shoring: tk)
    um_2_1:[ {on:'kit',skill:QC,opt:{stun:{add:R(0.1),per:{stack:'qcs',div:10},ccRaw:true}}} ],                 // Rumble (its full 0.1 s)
    um_2_2:[ {stat:{move:R(-0.02),aspd:R(-0.02)},to:{team:'enemy',has:'um'},if:{window:'umW'}} ],               // Undercut (Undermined: the always row)
    um_2_4:[ {on:'teamCc',if:{unitHas:'sh'},do:[{fn:'brace',by:R(0.03)}]} ],                                    // Brace the Roof
    um_3_1:[ {on:'hit',if:{casting:FC,targetTeam:'enemy',stackMin:{trem:30}},do:[{fn:'tst',by:0.5}]} ],         // Faultfinder
    um_3_3:[ {param:'ten.all',add:R(0.04)} ],                                                                   // Hard Ground (in ten)
    um_3_4:[ {on:'out',ignoreArmor:R(0.015)} ],                                                                 // Cliff Sense
    um_4_1:[ {on:'waveEnd',do:[{fn:'keepT',by:R(2)}]}, {on:'wave',do:[{fn:'keptT'}]} ],                         // Restless Earth
    um_4_2:[ {on:'out',if:{targetHas:'um'},more:R(0.03)}, {on:'teamIn',if:{targetTeam:'enemy',targetHas:'um',srcIs:'ally'},more:R(0.03)} ],   // Sinking Ground
    um_4_3:[ {on:'out',if:{some:{team:'ally',of:'target',within:2,has:'sh'}},more:R(0.02)} ],                   // Close Quarters
    um_10_1:[ {param:'trem.max',add:R(2)} ],                                                                    // Long Rumble
    um_9_3:[ {on:'land',skill:BG,do:[{window:'gh',dur:3}]}, {stat:{armor:R(0.04)},if:{window:'gh'}} ],          // Granite Hide (the 3 s after the emerge)
    um_5_4:[ {param:'sh.m',add:R(1)} ],                                                                         // Brace Beams
    um_6_1:[ {param:'dr.dc',add:R(0.01)} ],                                                                     // Dust Choke (in myDr)
    um_11_1:[ {on:'out',if:{casting:FC,targetHas:'um'},more:R(0.03)} ],                                         // Fault Echo
    um_6_4:[ {on:'moved',if:{unitHas:'sh'},do:[{fn:'hold',by:R(0.25)}]} ],                                      // Hold Fast
    um_7_2:[ {on:'kit',skill:QC,do:[{fn:'qh0'}]}, {on:'hit',if:{casting:QC,targetTeam:'enemy'},do:[{fn:'qh'}]}, // Bring Down the Wall: every enemy it hits is Undermined (after the cast) ...
             {on:'cast',skill:QC,do:[{fn:'umQ'}]},
             {on:'ccHit',if:{casting:QC,cc:['stunned'],talent:false,targetHas:'um'},do:[{fn:'ext',by:0.5}]} ],   //   ... and stunned 0.5 s longer if it already was
    um_7_4:[ {on:'teamIn',if:{targetHas:'sh',srcTeam:'enemy',fn:'big10'},do:[{stack:'trem',add:2},{after:0,do:[{shield:{pct:R(0.005),of:'maxHp'},on:'target',dur:3}]}]} ],   // Timbering (the shield after the hit)
    um_8_1:[ {on:'at',skill:QC,do:[{fn:'qcRaw'}]},                                                              // Second Shake
             {on:'ccHit',if:{casting:QC,cc:['stunned'],talent:false,targetTeam:'enemy'},do:[{mark:'ss',on:'target',dur:9,while:'stunned',ends:'ssEnd'}]},
             {on:'ssEnd',do:[{fn:'shake',by:R(0.05)}]} ],
    um_8_3:[ {param:'dr.hf',add:R(0.015)} ],                                                                    // Heavy Footing (in myDr)
    um_9_4:[ {on:'teamIn',once:'wave',if:{targetHas:'sh',srcTeam:'enemy',fn:'drop20'},do:[{fn:'crh'}]} ],       // Cave Roof Holds
    um_5_2:[ {on:'land',skill:BG,do:[{fn:'knock'},{stack:'trem',add:10}]} ],                                    // Collapse Beneath (PICK ONE): knocked up = stunned 0.6 s
    um_9_2:[ {param:'um.dur',add:R(0.3)} ],                                                                     // Loose Footing
    um_5_3:[ {param:'pub',add:1} ],                                                                             // Pop Up Behind (PICK ONE; in emTgt)
    um_12_4:[ {param:'ten.lb',add:R(0.05)} ],                                                                   // Load-Bearing (in ten)
    um_6_2:[ {on:'knEnd',do:[{dmg:{pct:R(0.08),of:'atk'},on:{team:'enemy',of:'target',within:2},tag:'pit'}]} ], // Open Pit
    um_10_2:[ {on:'teamHeal',if:{unitHas:'um'},less:R(0.05)} ],                                                 // Swallowed
    um_6_3:[ {on:'land',skill:BG,if:{fn:'wasPub'},do:[{stack:'brd',set:3}]},                                    // Back Row Digger
             {on:'out',if:{stackMin:{brd:1}},more:R(0.04),do:[{stack:'brd',spend:1}]} ],
    um_10_4:[ {stat:{atk:R(0.005)},per:'shored'} ],                                                             // Pillar
    um_11_2:[ {on:'land',skill:BG,do:[{stack:'trem',spend:10,then:[{fn:'deep',by:0.3}]}]} ],                    // Deep Charges
    um_12_1:[ {on:'kit',skill:QC,opt:{radius:{more:R(0.04)}}} ],                                                // Deep Gutters
    um_12_2:[ {stat:{aspd:R(0.01)},per:{units:{team:'enemy',has:'um'},max:5},if:{window:'umW'}} ],              // Undermine Them All
    um_12_3:[ {on:'tick',period:3,if:{stackMin:{shored:1}},do:[{heal:{pct:R(0.005),of:'tgtMaxHp'},on:{team:'ally',has:'sh'}}]} ],   // Sett Mother
    um_13_2:[ {on:'kit',skill:QC,icd:25,if:{stackMin:{qcs:30}},do:[{window:'fgw',dur:6},{fn:'fgw'}]},          // The Floor Gives Way (SIGNATURE)
              {on:'tick',period:2,if:{window:'fgw'},do:[{fn:'restun'}]},
              {on:'teamIn',if:{window:'fgw',targetHas:'sh',srcTeam:'enemy'},less:0.2} ]
  },
  fn:{
    /* each tick: the controls on him (one landed: 'ccOn'; one ended: 'ccEnd'; a stun or fear ended: 'hardEnd'; who did it: marks 'ctl' (this fight) and 'lc'
       (the last one)), Weight (1 for each 0.5 s stunned, feared or pulled), Tallies (each 10% of his max HP lost this fight) and Shoring (allies within 3 m) */
    tk(A,T,u,c){ const E=A.eng(), s=T.s, r=T.r, f=s.f||(s.f={ctl:CTL.some(id=>r[id]),wt:WT.some(id=>r[id]),tl:TL.some(id=>r[id]),sh:SH.some(id=>r[id])});
      if(f.ctl){ const pv=s.cv||(s.cv={}); let rose=false, rsf=false, end=false, hard=false, on=false;
        for(const k of HF){ const v=+u[k]||0, p=pv[k]||0; if(v>p+1e-9){ rose=true; if(k==='stunned'||k==='fearT') rsf=true; } if(p>0&&!(v>0)){ end=true; if(k==='stunned'||k==='fearT') hard=true; } if(v>0) on=true; pv[k]=v; }
        s.ctld=on;
        if(rsf){ const lc=s.ccl, src=(lc&&E.now()-lc.t<0.05&&lc.src)||(((u.fearT||0)>0&&u._fearFrom)||null);
          if(src&&src.alive!==undefined&&src.team!==u.team){ A.setMark(T,u,src,'ctl',{}); A.setMark(T,u,src,'lc',{unique:true}); } }
        if(rose&&T.on.ccOn) A.run(T,u,'ccOn',{u,tgt:u,unit:u});
        if(end&&T.on.ccEnd) A.run(T,u,'ccEnd',{u,tgt:u,unit:u});
        if(hard&&T.on.hardEnd) A.run(T,u,'hardEnd',{u,tgt:u,unit:u}); }
      if(f.wt){ if((u.stunned||0)>0||(u.fearT||0)>0||(u.pullT||0)>0) s.wacc=(s.wacc||0)+(c.dt||0);
        if((s.wacc||0)>=0.5-1e-9){ const n=Math.floor(s.wacc/0.5+1e-9); s.wacc-=n*0.5; A.acts(T,u,[{stack:'wt',add:n}],c); } }
      if(f.tl){ const h=u.hp; if(s.hp0!=null&&h<s.hp0) s.tl=(s.tl||0)+(s.hp0-h); s.hp0=h;
        const n=Math.floor((s.tl||0)/(0.1*u.maxHp)+1e-9); if(n>(s.tn||0)){ A.acts(T,u,[{stack:'tally',add:n-(s.tn||0)}],c); s.tn=n; } }
      if(f.sh){ const L=A.pick(T,u,{team:'ally',others:true,within:3+(T.P['sh.m']||0)},{u}), old=s.sh||[];
        for(const x of old) if(L.indexOf(x)<0) A.clearMark(u,x,'sh'); for(const x of L) if(old.indexOf(x)<0) A.setMark(T,u,x,'sh',{});
        s.sh=L; A.stSet(T,u,'shored',L.length); } },
    ccSrc(A,T,u,c){ T.s.ccl={src:c.src,t:A.eng().now()}; },
    /* his damage reduction talents, ONE group: each multiplies, together they take at most 40% off a hit; Weight's own share at most 25%.
       None of them applies while he is underground (Burrow Guard's 75% is enough there) */
    myDr(A,T,u,c){ if((u._bgT||0)>0) return; const P=T.P, s=T.s; let k=1; const w=A.stGet(T,'wt');
      if(P['dr.wt']) k*=1-Math.min(0.25,P['dr.wt']*w);
      if(P['dr.wiw']&&w>=6) k*=1-P['dr.wiw'];
      if(P['dr.bh']&&A.markOf(u,c.src,'ctl')) k*=1-P['dr.bh'];
      if(P['dr.rd']&&!c.auto) k*=1-P['dr.rd'];
      if(P['dr.hh']) k*=1-P['dr.hh']*Math.min(10,u._digStk||0);
      if(P['dr.hb']&&u.hp<0.5*u.maxHp) k*=1-P['dr.hb'];
      if(P['dr.ba']&&s.ctld) k*=1-P['dr.ba'];
      if(P['dr.db']&&(c.amt||0)>0.1*u.maxHp) k*=1-P['dr.db'];
      if(P['dr.grit']&&A.markOf(u,c.src,'fc')) k*=1-P['dr.grit'];
      if(P['dr.dc']) k*=1-P['dr.dc']*Math.floor(A.stGet(T,'trem')/10+1e-9);
      if(P['dr.hf']&&A.stGet(T,'shored')>0) k*=1-P['dr.hf'];
      c.amt*=Math.max(0.60,k); },
    /* his control shortening, ONE group: Hard Ground (every control), Load-Bearing (3+ Shored), River Not Held (stuns, roots, fears at 9 Tallies: half).
       Each multiplies; together at most 50%. What River Not Held cuts still counts as Weight */
    ten(A,T,u,c){ const P=T.P; let k=1-(P['ten.all']||0); if(P['ten.lb']&&A.stGet(T,'shored')>=3) k*=1-P['ten.lb'];
      const rv=P['ten.river']&&A.stGet(T,'tally')>=9&&(c.field==='stunned'||c.field==='fearT'); if(rv) k*=1-P['ten.river'];
      k=Math.max(0.5,k); const b=c.amt; c.amt*=k; if(rv&&T.s.f&&T.s.f.wt) T.s.wacc=(T.s.wacc||0)+(b-c.amt); },
    /* Relentless Digger: Faster in the Dark (twice as fast at 6+ Weight), River in the Rock (below 30% HP), Count the Days (per Tally), Never Still, Relentless Pace */
    dig(A,T,u){ const P=T.P, pm=u.passMul||1, base=((u.stunned||0)>0||(u.fearT||0)>0)?2:1; let add=0;
      if(P['dig.fast']&&A.stGet(T,'wt')>=6) add+=base;
      if(P['dig.low']&&u.hp<0.3*u.maxHp) add+=base*P['dig.low'];
      if(add>0) u._digStk=Math.min(10,(u._digStk||0)+add);
      const k=1+(P['dig.tally']||0)*A.stGet(T,'tally')+(P['dig.k']||0);
      u.hasteMul=Math.max(u.hasteMul||1,1+0.035*pm*(u._digStk||0)*k); u.hasteT=Math.max(u.hasteT||0,4+(P['dig.dur']||0)); },
    digAdd(A,T,u,c,a){ u._digStk=Math.min(10,(u._digStk||0)+(a.by||0)); },
    /* the Lying Wall: at each wave's start, the enemy with the most armor */
    lw(A,T,u,c){ let b=null; for(const x of A.pick(T,u,ENM,c)) if(!b||(+x.armorRating||0)>(+b.armorRating||0)) b=x; if(b) A.setMark(T,u,b,'lw',{unique:true}); },
    liar(A,T,u,c){ let b=null; for(const x of A.pick(T,u,ENM,c)) if(x!==c.unit&&(!b||(+x.armorRating||0)>(+b.armorRating||0))) b=x; if(!b) return;
      A.setMark(T,u,b,'lw',{unique:true}); A.ustPut(T,u,b,'seam',Math.max(4,A.ustGet(T,u,b,'seam')),seamsHeld(A,T,u,b)?1e9:undefined); },
    /* Fault Claws' own break: its strength and its time (+ Long Seam), kept for the talents that break armor "as Fault Claws does" */
    fcO(A,T,u,c){ const o=c.o; if(!o) return; T.s.fcS=o.shred||0.3; o.dur=(o.dur||5)+(T.P['fc.dur']||0); T.s.fcD=o.dur; },
    /* under Fault Claws' armor break: mark 'fc' while the target's break runs (its _shredT). a.of: a talent's own break ('fc': Fault Claws' time; a number: seconds) */
    brk(A,T,u,c,a){ const t=c.tgt; if(!t||!t.alive||t.team===u.team) return;
      if(a&&a.of!=null){ const d=a.of==='fc'?(T.s.fcD||((u.greenAb&&u.greenAb.dur)||5)+(T.P['fc.dur']||0)):a.of, v=T.s.fcS||((u.greenAb&&u.greenAb.shred)||0.3);
        t._shredPct=Math.max(t._shredPct||0,v); t._shredT=Math.max(t._shredT||0,d); }
      A.acts(T,u,[{mark:'fc',on:'target',dur:1e6,while:'_shredT',ends:'fcEnd'}],c);
      if(T.r.sr_11_2){ const v=A.ustGet(T,u,t,'seam'); if(v>0) A.ustPut(T,u,t,'seam',v,1e9); } },
    /* Cut the Seam: the break is over, the Seams close on their own again from now */
    seamFree(A,T,u,c){ const t=c.tgt, v=A.ustGet(T,u,t,'seam'); if(v>0) A.ustPut(T,u,t,'seam',v); },
    /* a Seam opened (a.by; a.fc: from Fault Claws instead, Clean Face); the fifth Splits */
    sAdd(A,T,u,c,a){ const t=c.tgt; if(!t||!t.alive||t.team===u.team) return; const n=(a.fc!=null&&T.s.cur===FC)?a.fc:(a.by||0); if(!(n>0)) return;
      const nw=Math.min(5,A.ustGet(T,u,t,'seam')+n); A.ustPut(T,u,t,'seam',nw,seamsHeld(A,T,u,t)?1e9:undefined);
      if(nw>=5) A.run(T,u,'split',Object.assign({},c,{tgt:t,unit:t})); },
    /* the Split: 2% of its max HP per rank of Read the Face (rank 1 without it), never more than 80% of his attack per rank; Rockfall, Brittle Seam. Its Seams clear.
       c.spent = the HP it took (Spalling) */
    split(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; A.ustPut(T,u,t,'seam',0); const P=T.P, r=Math.max(1,P['split.r']||0);
      let d=Math.min(0.02*r*(t.maxHp||0),0.8*r*atk(A,T,u,c))*(1+(P['split.more']||0)); if((t._shredT||0)>0&&(t._shredPct||0)>1e-6) d*=1+(P['split.brk']||0);
      c.spent=A.hurt(T,u,t,d,'#c9a227','split'); },
    notCliff(A,T){ return !T.s.cl; },
    /* The Whole Cliff: every enemy within 4 m of the split one Splits at once (its armor broken first, 6 s), and Fault Claws is ready again */
    cliff(A,T,u,c){ const t=c.tgt; if(!t) return; T.s.cl=1;
      try{ for(const x of A.pick(T,u,{team:'enemy',of:'target',within:4,skip:'target'},c)){ if(!x.alive) continue; const c2=Object.assign({},c,{tgt:x,unit:x});
          T.fn.brk(A,T,u,c2,{of:6}); A.run(T,u,'split',c2); } } finally{ T.s.cl=0; }
      u.greenCd=0; },
    /* Burrow Guard's emerge */
    emA(A,T,u,c){ T.s.emA=c.amt||0; },
    um(A,T,u,c){ if(c.tgt&&c.tgt.alive) umark(A,T,u,c,c.tgt,umDur(T)); },
    emTgt(A,T,u,c){ const E=A.eng(), f=T.s.emF; T.s.emF=null; T.s.pubHit=false;
      if(f&&f.alive&&f.team!==u.team&&!f._noTarget&&!f._dropHidden){ c.tgt=f; return; }
      if(T.P.pub&&E.weakestBack){ const b=E.weakestBack(u); if(b){ c.tgt=b; T.s.pubHit=true; } } },
    wasPub(A,T){ return !!T.s.pubHit; },
    tst(A,T,u,c,a){ tstun(A,T,u,c,[c.tgt],a.by); },
    /* Collapse Beneath: the target is knocked up (stunned) 0.6 s; Open Pit when it lands (the stun ends) */
    knock(A,T,u,c){ for(const t of tstun(A,T,u,c,[c.tgt],0.6)) A.acts(T,u,[{mark:'kn',on:'target',dur:9,while:'stunned',ends:'knEnd'}],Object.assign({},c,{tgt:t})); },
    ttf(A,T,u,c,a){ const x=(T.s.emA||0)*(a.by||0); if(!(x>0)) return; for(const e of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},c)) A.hurt(T,u,e,x,'#c9a227','floor'); },
    deep(A,T,u,c,a){ const x=(T.s.emA||0)*(a.by||0); if(!(x>0)) return; for(const e of A.pick(T,u,{team:'enemy',has:'um'},c)) A.hurt(T,u,e,x,'#c9a227','charge'); },
    stay(A,T,u){ if((u._bgT||0)>0) u._bgT+=1; },
    under(A,T,u){ return (u._bgT||0)>0; },
    /* Up Through the Floor: under at once (Burrow Guard, off its cooldown) with 12 Weight and 9 Tallies, 16% of his max HP back, 2 s under, then up beneath
       the enemy that hurt him most this fight */
    utf(A,T,u,c){ if(!u.alive) return; const E=A.eng(), s=T.s; A.acts(T,u,[{window:'utf',dur:30},{stack:'wt',atLeast:12},{stack:'tally',atLeast:9},{heal:{pct:0.16,of:'maxHp'},on:'self'}],c);
      let b=null, bd=0; for(const x of A.pick(T,u,ENM,c)){ const d=(s.dby&&s.dby[x.uid])||0; if(d>bd){ bd=d; b=x; } } s.emF=b;
      if(E.castSlot) E.castSlot(u,'blue',u); u._bgT=Math.max(u._bgT||0,2); },
    dby(A,T,u,c){ const x=c.src; if(!x) return; const m=T.s.dby||(T.s.dby={}); m[x.uid]=(m[x.uid]||0)+(c.hpLost||0); },
    utfLand(A,T,u,c){ const t=c.tgt; A.acts(T,u,[{window:'utf',end:true}],c); if(!t) return; const L=A.pick(T,u,{team:'enemy',of:'target',within:3},c), x=T.s.emA||0;
      if(x>0) for(const e of L) if(e!==t) A.hurt(T,u,e,x,'#c9a227','utf');
      tstun(A,T,u,c,L,1); },
    crh(A,T,u,c){ if(!c.src||c.src.team===u.team) return; T.s.emF=c.src; A.acts(T,u,[{after:0,do:[{castSkill:'blue',on:'self'}]}],c); },
    drop20(A,T,u,c){ const t=c.tgt; if(!t||t===u||!t.alive) return false; const th=0.2*t.maxHp; return t.hp>=th&&(t.hp+(t.shield||0)-(c.amt||0))<th; },
    big10(A,T,u,c){ const t=c.tgt; return !!t&&(c.amt||0)>0.1*(t.maxHp||0); },
    /* Brace the Roof: a control that just landed on a Shored ally is that much shorter (only when this control set the time) */
    brace(A,T,u,c,a){ const x=c.unit, f=c.field; if(!x||!f||!(c.amt>0)) return; if(Math.abs((x[f]||0)-c.amt)<1e-9) x[f]=c.amt*Math.max(0,1-(a.by||0)); },
    /* Hold Fast: a push or pull on a Shored ally moves it that share less (put back part of the way, and the drag that share slower) */
    hold(A,T,u,c,a){ const x=c.unit, p=c.from, k=Math.max(0,Math.min(1,a.by||0)); if(!x||!p||!x.alive) return;
      x.x=p.x+(x.x-p.x)*(1-k); x.y=p.y+(x.y-p.y)*(1-k); x._ax=x.x; x._ay=x.y; if((x.pullT||0)>0&&x.pullSpeed>0) x.pullSpeed*=(1-k); },
    /* Bring Down the Wall */
    qh0(A,T){ T.s.qh=[]; },
    qh(A,T,u,c){ const L=T.s.qh||(T.s.qh=[]); if(c.tgt&&L.indexOf(c.tgt)<0) L.push(c.tgt); },
    umQ(A,T,u,c){ for(const t of (T.s.qh||[])) if(t.alive) umark(A,T,u,c,t,umDur(T)); T.s.qh=[]; },
    ext(A,T,u,c,a){ const t=c.tgt; if(!t||!t.alive||!((t.stunned||0)>0)) return; t.stunned+=a.by||0; T.fn.lock(A,T,u,c); },
    /* the break rule: after any stun of his on an enemy, his talent stuns wait until 0.5 s after it ends */
    lock(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; A.setMark(T,u,t,'lk',{dur:(t.stunned||0)+0.5,longest:true}); },
    /* Second Shake */
    qcRaw(A,T,u,c){ T.s.qcRaw=c.raw||0; },
    shake(A,T,u,c,a){ const E=A.eng(), t=c.tgt; if(!t||!t.alive) return; const x=(T.s.qcRaw||0)*(a.by||0)*E.defMul(u,t,'phys'); if(x>0) A.hurt(T,u,t,x,'#c9a227','shake'); },
    /* Restless Earth: what the ground keeps between waves */
    keepT(A,T,u,c,a){ T.s.kt=Math.min(A.stGet(T,'trem'),a.by||0); },
    keptT(A,T,u){ if(T.s.kt>0) A.stSet(T,u,'trem',Math.max(A.stGet(T,'trem'),T.s.kt)); T.s.kt=0; },
    /* The Floor Gives Way: the whole enemy formation Undermined 6 s; each enemy stunned again for 0.5 s every 2 s while it is (at most twice, never while stunned) */
    fgw(A,T,u,c){ for(const x of A.pick(T,u,ENM,c)){ A.ustPut(T,u,x,'fgn',0); umark(A,T,u,c,x,6); } },
    restun(A,T,u,c){ const L=A.pick(T,u,{team:'enemy',has:'um'},c).filter(x=>A.ustGet(T,u,x,'fgn')<2);
      for(const x of tstun(A,T,u,c,L,0.5)) A.ustPut(T,u,x,'fgn',A.ustGet(T,u,x,'fgn')+1); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/22 - DEEPCLEFT - talent decisions.md) */
  ruling:{}
};
