/* RHUKK - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Rhukk")
   His real kit (the code, not the tooltip wording; a melee Tank, every skill reads Attack, his damage is physical; tests/rhukk-kit-facts.js):
   - Impale Rush (ultimate, the shared 'charge' case, energy): dashes to the FARTHEST enemy (0.15-0.8 s), then slams every enemy whose centre is within 5 m of
     the landing spot for 200% (+1 point a level: 300% at 100) of his attack, and stuns them (the table: 1.4 s; the level roll can resist it). The slam and its
     stun are inside the landPre / land pair 'charge'. MEASURED: 118 casts, 155 enemies slammed, 3 landings slammed nobody; he ran 17 m on average. Works.
   - Carapace ('defensive', green, cd 10): the skill slot (drMul) 20% + 0.15 points a level (35% at 100) for 5 s.
   - Dig In ('taunt', blue, cd 10): every enemy on the field (no radius) is taunted for 3 s; the skill slot 10% + 0.1 points a level (20% at 100) for 3 s;
     each enemy basic attack that lands heals him 1% of his max HP for 3 s. Carapace and Dig In share ONE slot: the last cast wins (a Dig In inside a running
     Carapace replaces its 35% with 20%: 88 of 206 casts overwrote a running slot).
   - Thick Chitin (passive 'warden'): 3% less damage (inside damage()) every 3 s, at most 5 stacks = 15% (the card says "up to 25%" at level 100: the 5-stack
     limit stops it at 15%). Emptied at each wave.
   Headlong, Trampled, Anchor, Sheltered, Carvings and Lesson exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/50 - RHUKK - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const RUSH=['charge','chargePath'];
/* the states several talents read: their bookkeeping runs when any of these is learned */
const HL=['st_1_1','st_2_1','st_3_1','st_9_2','st_9_3','st_10_3','st_12_1','st_12_4','st_13_2'];                              // Headlong
const TR=['st_1_2','st_2_2','st_6_4','st_8_2','st_8_3','st_9_2','st_13_2'];                                                    // Trampled
const LAND=['st_6_3','st_10_1','st_11_2','st_12_2','st_13_2','eb_12_2'];                                                       // rows at Impale Rush's landing
const EXT=['st_5_3','st_7_4','st_12_2','eb_11_2'];                                                                             // Impale Rush's stun made longer
const SH=['ot_1_1','ot_3_1','ot_6_1','ot_5_1','ot_7_1','ot_9_1','ot_10_1','ot_11_3','ot_12_1','ot_12_3','ot_13_3'];          // Sheltered
const AN=['ot_1_4','ot_2_4','ot_3_4','ot_6_4','ot_7_4','ot_8_4','ot_9_4','ot_10_4','ot_13_3'];                                 // Anchor
const DIG=['ot_2_3','ot_4_3','eb_4_3','ot_n1','ot_3_4','ot_5_3','ot_11_3','ot_12_3','ot_13_3','eb_9_4','ot_5_2'];              // Dig In's cast changed
const CARA=['ot_7_1','ot_9_1','ot_11_2','eb_3_1','eb_5_1'];                                                                    // Carapace's cast changed / "while Carapace lasts"
const CV=['eb_1_1','eb_1_4','eb_2_1','eb_3_1','eb_3_4','eb_6_1','eb_5_2','eb_5_4','eb_9_1','eb_10_1','eb_11_2','eb_12_2','eb_13_2'];   // Carvings
const LES=['eb_1_4','eb_3_4','eb_5_1','eb_6_4','eb_9_4','eb_10_4','eb_12_4','eb_13_2'];                                        // Lesson
const DRG=['st_5_1','st_6_3','st_9_3','st_10_1','st_11_4','ot_1_4','ot_3_2','ot_9_2','ot_8_3','ot_12_4','ot_9_4','eb_5_3','eb_5_1','eb_7_3','eb_11_1'];   // his damage reduction: ONE capped group (35%)
const ALLY=['ot_1_1','ot_9_1','eb_5_1','eb_13_2','ot_13_3','ot_11_3','ot_6_1','eb_6_4'];                                       // rows on hits on (and by) his allies
const CRIT=['st_7_3','ot_10_3','eb_11_3'];                                                                                     // his crit chance: ONE capped group (5%)
const SLW=['st_6_1','ot_7_4','eb_9_3'];                                                                                        // slows on him weaker: together at most 40%
const DR_FLOOR=0.65, ALLY_FLOOR=0.50, DIG_CAP=0.50, CRIT_CAP=0.05, SLOW_CAP=0.40, CTRL_MAX=4.0;
const S=T=>T.s.rk||(T.s.rk={sh:{},les:{},nt:{},fwL:0,otL:0,ntL:0,fmL:0,st:[],hitN:0});   // his own per-fight state (one object: no name of the runtime's own; every lock a countdown)
const rk=(T,id)=>T.r[id]||0;
const back=x=>!!(x&&x.t&&x.t.row==='Back');                         // the game's own combat row (heroes; a monster has none)
const foes=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
const mates=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team===u.team&&x!==u&&!x._dropHidden);
const taunted=(u,x)=>!!(x&&x.forcedTarget===u&&(x.forcedTargetT||0)>0);
module.exports={
  hero:'rhukk',
  casting:true,                         // rows ask which of his skills a hit comes from
  states:{
    rkHl:{max:5},                                                   // Headlong (basic attacks on the same enemy in a row)
    rkAn:{max:P('an.max',6)},                                       // Anchor (each second standing still; Dug Deep up to 9)
    rkCv:{max:P('cv.max',6)},                                       // Carvings (the whole fight; Carve It 10)
    rkBo:{max:8,dur:6}                                              // Bowled Over (one for each enemy Impale Rush stuns; all lapse 6 s after the last)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                   // Sheltered, Lesson, Anchor, Thick Chitin's clock, Never Stops, the locks, a put-off cast
    {on:'wave',do:[{fn:'wv'}]},
    {on:'cast',skill:'taunt',do:[{fn:'digCast'}]},                                                                // Dig In: its own reduction never past 50% (Phil), and its talents
    {on:'cast',skill:'defensive',reqAny:CARA.concat(['eb_5_1']),do:[{fn:'caraCast'}]},                            // Carapace's cast
    {on:'hit',reqAny:HL,if:{auto:true,targetTeam:'enemy'},do:[{fn:'hlHit'}]},                                     // Headlong: each basic attack that lands
    {on:'out',reqAny:HL,if:{auto:true,targetTeam:'enemy'},do:[{fn:'hlOut'}]},                                     // the basic attack at 5 Headlong
    {on:'kit',skill:'charge',do:[{fn:'rushKit'}]},                                                                // Impale Rush is under way (Never Stops; Rubble)
    {on:'skillTgt',skill:'charge',reqAny:['st_5_2','st_5_3','st_13_2'],do:[{fn:'rushTgt'}]},                     // whom it goes to (Shorter Fuse, the signature's second)
    {on:'out',if:{casting:RUSH,targetTeam:'enemy'},reqAny:['st_5_2','st_13_2'],do:[{fn:'rushOut'}]},              // Longer Run; the signature's second at 60%
    {on:'hit',if:{casting:'charge',targetTeam:'enemy'},reqAny:['st_13_2'],do:[{fn:'rushHit'}]},                   // the enemies the slam struck
    {on:'ccHit',reqAny:TR.concat(EXT,LAND),do:[{fn:'ccHit'}]},                                                    // its stun landed: Trampled, longer, counted
    {on:'ccOut',reqAny:['st_13_2'],do:[{fn:'ccOut'}]},                                                            // the stun-lock rule for the signature's second
    {on:'land',skill:'charge',reqAny:LAND.concat(TR,EXT),do:[{fn:'rushLand'}]},                                   // Impale Rush has landed
    {on:'hurt',reqAny:CV.concat(['eb_13_2']),do:[{fn:'carveHit'}]},                                               // Carvings: each hit on him that is big enough
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]}, {on:'dotIn',reqAny:DRG,do:[{fn:'myDr'}]},                              // his damage reduction: one capped group
    {on:'teamIn',reqAny:ALLY,do:[{fn:'teamIn'}]},                                                                 // his allies: Sheltered, Lesson, the signatures; hits by them
    {on:'crit',reqAny:CRIT,if:{targetTeam:'enemy'},do:[{fn:'crit'}]}, {stat:{crit:1},reqAny:CRIT,per:{fn:'critS'}},   // his crit chance: one capped group
    {on:'tick',reqAny:SLW,do:[{weaken:'slowMul',by:{flat:1,x:{fn:'slowW'}}}]},                                    // slows on him weaker (one cap)
    {on:'lethal',reqAny:['eb_13_2'],do:[{fn:'hold'}]},                                                           // The First Mark: not below 1 HP (the runtime's own hold while it runs)
    {on:'death',reqAny:['ot_10_1'],do:[{fn:'death'}]},                                                            // a Sheltered ally lost (By Morning)
    {on:'waveEnd',reqAny:['ot_10_1'],do:[{fn:'byMorning'}]}
  ],
  talents:{
    /* ============================== STRAIGHT THROUGH ============================== */
    st_1_1:[ {param:'hl.k',add:R(0.10)} ],                                                                          // Lowered Horn (Headlong: hlOut / hlHit)
    st_1_2:[ {stat:{armor:R(-0.02)},to:{team:'enemy',has:'rkTr'}} ],                                                // Hoof and Horn (Trampled: ccHit)
    st_5_4:[ {stat:{move:R(0.03)}} ],                                                                               // Pace
    st_2_1:[ {stat:{aspd:R(0.01)},per:'rkHl'} ],                                                                    // One Idea
    st_2_2:[ {param:'tr.dur',add:R(0.6)} ],                                                                         // Ground Down
    st_3_1:[ {param:'hl.thru',add:1} ],                                                                             // Straight Through It (in hlHit)
    st_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                      // Root-Splitter
    st_3_4:[ {param:'chit.fast',add:R(0.2)} ],                                                                      // Wall of Shell (in tk)
    st_5_1:[ {param:'dr.dl',add:R(0.015)} ],                                                                        // Deep Loam (magic; in myDr)
    st_4_2:[ {on:'out',if:{casting:RUSH},more:R(0.05)} ],                                                           // Farthest First
    st_4_3:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                              // Horn Hook
    st_6_1:[ {param:'slow.nt',add:R(0.08)} ],                                                                       // Never Turns (in slowW)
    st_5_2:[ {param:'run.k',add:0.02} ],                                                                            // Longer Run (PICK ONE; rushTgt / rushOut)
    st_5_3:[ {param:'sf.on',add:1} ],                                                                               // Shorter Fuse (PICK ONE; rushTgt, ccHit 0.5 s)
    st_7_4:[ {param:'ext.hc',add:R(0.06)} ],                                                                        // Hard Charge (in ccHit)
    st_6_3:[ {param:'dr.cq',add:R(0.03)} ],                                                                         // Close Quarters (the window: rushLand; in myDr)
    st_6_4:[ {stat:{move:R(-0.05)},to:{team:'enemy',has:'rkTr'}} ],                                                 // Trodden
    st_7_1:[ {on:'kit',skill:'charge',do:[{fn:'rubble'}]} ],                                                        // Rubble (the game's own path hits and knock-aside)
    st_7_3:[ {param:'crit.lh',add:R(0.01)} ],                                                                       // Long Horn (in the crit group: a stat)
    st_8_1:[ {on:'out',if:{fn:'backT'},more:R(0.02)} ],                                                             // Horn Weight
    st_10_2:[ {on:'cd',skill:'blue',add:R(-0.4)} ],                                                                 // Charge Again
    st_8_2:[ {on:'out',if:{targetHas:'rkTr'},more:R(0.02)} ],                                                       // Walls Became Rubble
    st_8_3:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'rkTr'}} ],                                                 // Trample Ground
    st_9_2:[ {param:'hl.tl',add:1} ],                                                                               // Through the Line (in hlHit)
    st_9_3:[ {param:'dr.bh',add:R(0.01)} ],                                                                         // Beetle Hide (in myDr)
    st_9_4:[ {on:'kit',skill:'defensive',opt:{dur:{add:R(0.2)}}} ],                                                 // Shell First
    st_10_1:[ {param:'dr.mh',add:R(0.02)} ],                                                                        // Momentum Hide (the window: rushLand; in myDr)
    st_10_3:[ {param:'hl.heal',add:R(0.01)} ],                                                                      // Rolling Weight (in hlHit)
    st_11_1:[ {param:'ns.on',add:1} ],                                                                              // Never Stops (in tk)
    st_11_2:[ {stat:{atk:R(0.01)},per:'rkBo'} ],                                                                    // Bowled Over (the count: rushLand)
    st_11_4:[ {param:'dr.hh',add:R(0.01)} ],                                                                        // Hard Head (in myDr)
    st_12_1:[ {param:'hl.old',add:R(1)} ],                                                                          // Old Habit (in wv)
    st_12_2:[ {param:'ext.sc',add:R(0.1)} ],                                                                        // Scattered (in rushLand)
    st_12_4:[ {param:'hl.push',add:R(0.5)} ],                                                                       // Last Push (in hlHit)
    st_13_2:[ {param:'sig.fw',add:1} ],                                                                             // The Fastest Way (SIGNATURE: rushLand, tk, rushTgt, rushOut, ccHit, ccOut)

    /* ============================== THE ONE TUNNEL ============================== */
    ot_1_1:[ {param:'sh.k',add:R(0.02)} ],                                                                          // The Young Behind (Sheltered: tk; in teamIn)
    ot_2_3:[ {param:'dig.ext',add:R(0.1)} ],                                                                        // Long Roar (in digCast; at most 4 s)
    ot_1_4:[ {param:'dr.an',add:R(0.003)} ],                                                                        // Plant the Legs (Anchor: tk; in myDr)
    ot_4_3:[ {param:'dig.k1',add:R(0.03)} ],                                                                        // Roar Louder (in digCast; Dig In at most 50%)
    ot_2_4:[ {param:'an.max',add:R(1)} ],                                                                           // Dug Deep
    ot_3_1:[ {param:'sh.r',add:R(0.3)} ],                                                                           // Fill the Tunnel (in tk)
    ot_3_2:[ {param:'dr.ul',add:R(0.01)} ],                                                                         // Under the Lip (in myDr)
    ot_n1:[  {param:'dig.carv',add:1} ],                                                                            // Carved by the Roar (LINK; in digCast)
    ot_3_4:[ {param:'dig.fill',add:1} ],                                                                            // Did Not Move (in digCast, tk)
    ot_6_1:[ {param:'sh.out',add:R(0.02)} ],                                                                        // Little Ones Watch (in teamIn)
    ot_4_2:[ {on:'kit',skill:'defensive',opt:{dur:{add:R(0.2)}}} ],                                                 // Lock Plates
    ot_4_4:[ {on:'ccIn',less:R(0.04)} ],                                                                            // Unafraid (up to 20%)
    ot_5_1:[ {on:'teamHeal',if:{fn:'shU'},more:R(0.02)} ],                                                          // Sheltering Bulk
    ot_6_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ],                                                                  // Echo Roar
    ot_9_2:[ {param:'dr.th',add:R(0.015)} ],                                                                        // Taunting Horn (in myDr)
    ot_6_4:[ {stat:{atk:R(0.003)},per:'rkAn'} ],                                                                    // Bedded In
    ot_7_2:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                              // Horn Bash
    ot_8_3:[ {param:'dr.cg',add:R(0.02)} ],                                                                         // Chitin Grows (at Thick Chitin's 5 stacks; in myDr)
    ot_7_4:[ {param:'slow.lr',add:R(0.05)}, {on:'tick',if:{stackMin:{rkAn:1}},do:[{timer:'_gearImmovableT',min:0.1,on:'self'}]} ],   // Like the Roots
    ot_7_1:[ {param:'cp.sh',add:R(0.02)} ],                                                                         // Thick Lip (in caraCast)
    ot_5_2:[ {param:'nt.on',add:1} ],                                                                               // Not Them (PICK ONE; in tk)
    ot_5_3:[ {param:'dig.heal',add:0.015} ],                                                                        // Come for Me (PICK ONE; in digCast)
    ot_8_4:[ {on:'tick',period:3,if:{stackMin:{rkAn:1}},do:[{heal:{pct:R(0.003),of:'maxHp'},on:'self'}]} ],         // Tough Night
    ot_9_1:[ {param:'cp.half',add:1} ],                                                                             // Shell Over Them (in teamIn)
    ot_6_2:[ {param:'nt.wait',add:R(2)} ],                                                                          // Always Listening (in tk)
    ot_12_4:[ {param:'dr.bw',add:R(0.03)} ],                                                                        // Bad Winter (in myDr)
    ot_9_4:[ {param:'dr.ss',add:R(0.04)} ],                                                                         // Stone Still (critical hits at full Anchor; in myDr)
    ot_10_1:[ {param:'bm.k',add:R(0.02)} ],                                                                         // By Morning (in byMorning)
    ot_10_3:[ {param:'crit.gb',add:R(0.01)} ],                                                                      // Gore Back (in the crit group)
    ot_10_4:[ {on:'out',if:{auto:true},more:R(0.005),per:'rkAn'} ],                                                 // Weight of Water
    ot_11_2:[ {param:'cp.k',add:R(0.01)} ],                                                                         // Thicker Plates (in caraCast)
    ot_11_3:[ {param:'ft.on',add:1} ],                                                                              // Forgot the Young (in digCast, teamIn)
    ot_12_1:[ {param:'bm.all',add:R(0.01)} ],                                                                       // Nobody Lost (in byMorning)
    ot_12_2:[ {stat:{hp:R(0.003)},per:{fn:'chitN'}} ],                                                              // Wide Shell
    ot_12_3:[ {param:'ft.sh',add:R(0.01)} ],                                                                        // Let It Come (in teamIn)
    ot_13_3:[ {param:'sig.ot',add:1} ],                                                                             // One Tunnel (SIGNATURE: teamIn, tk, digCast)

    /* ============================== THE ELDER'S BACK ============================== */
    eb_1_1:[ {stat:{armor:R(0.004),mr:R(0.004)},per:'rkCv'} ],                                                      // First Lesson (Carvings: carveHit)
    eb_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Steady Pace
    eb_1_4:[ {stat:{armor:R(0.003)},to:{team:'ally',others:true,fn:'lesU'},per:{fn:'lesK'}} ],                      // Read the Back (Lesson: tk)
    eb_2_1:[ {param:'cv.need',add:R(0.01)} ],                                                                       // Hard Lesson (in carveHit; down to 3%)
    eb_2_2:[ {on:'kit',skill:'defensive',opt:{dur:{add:R(0.2)}}} ],                                                 // Shell Closes
    eb_3_1:[ {param:'cp.cut',add:1} ],                                                                              // Cut Deep (in caraCast)
    eb_4_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                                 // Plates Lock
    eb_4_3:[ {param:'dig.k2',add:R(0.04)} ],                                                                        // Dig Deeper (in digCast; Dig In at most 50%)
    eb_3_4:[ {stat:{mr:R(0.003)},to:{team:'ally',others:true,fn:'lesU'},per:{fn:'lesK'}} ],                         // The Young Read
    eb_6_1:[ {stat:{hp:R(0.003)},per:'rkCv'} ],                                                                     // Near-Drowning
    eb_5_2:[ {param:'cv.max',add:4} ],                                                                              // Carve It (PICK ONE)
    eb_5_3:[ {param:'dr.sm',add:0.08}, {param:'smooth',add:1} ],                                                    // Keep It Smooth (PICK ONE; myDr, carve, tk)
    eb_5_4:[ {stat:{atk:R(0.003)},per:'rkCv'} ],                                                                    // Scored Plates
    eb_5_1:[ {param:'dr.tl',add:R(0.02)} ],                                                                         // Thick Loam (magic, while Carapace lasts; myDr, teamIn)
    eb_6_3:[ {on:'out',more:R(0.03)} ],                                                                             // Never Needed One (with Keep It Smooth)
    eb_6_4:[ {param:'les.out',add:R(0.01)} ],                                                                       // Lines in the Chitin (in teamIn)
    eb_7_1:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                      // Split the Root
    eb_7_3:[ {param:'dr.lh',add:R(0.01)} ],                                                                         // Learned the Hard Way (in myDr)
    eb_7_4:[ {param:'les.r',add:R(0.5)} ],                                                                          // Readable (in tk)
    eb_8_1:[ {on:'tick',period:3,do:[{heal:{pct:R(0.003),of:'maxHp'},on:'self'}]} ],                                // Tough Elder
    eb_8_2:[ {param:'chit.fast',add:R(0.2)} ],                                                                      // Chitin Thickens (in tk)
    eb_8_3:[ {on:'out',if:{casting:RUSH},more:R(0.05)} ],                                                           // Horn Rush
    eb_9_1:[ {stat:{lifesteal:R(0.002)},per:'rkCv'} ],                                                              // Old Scars Hold
    eb_9_4:[ {param:'les.teach',add:1} ],                                                                           // Teach Them (in tk)
    eb_10_1:[ {param:'cv.heal',add:R(0.01)} ],                                                                      // Every Hard Thing (in carve)
    eb_10_4:[ {on:'teamHeal',if:{fn:'lesHeal'},more:R(0.01)} ],                                                     // Wide Reading
    eb_11_1:[ {param:'dr.sd',add:R(0.015)} ],                                                                       // Sunk Deep (in myDr)
    eb_11_2:[ {on:'out',if:{casting:RUSH},more:0.05,per:'rkCv'}, {param:'ext.sl',add:0.1} ],                        // A Straight Line (5% and 0.1 s a Carving; ccHit)
    eb_11_3:[ {param:'crit.ph',add:R(0.01)} ],                                                                      // Plated Horn (in the crit group)
    eb_9_3:[ {param:'slow.sf',add:R(0.04)} ],                                                                       // Sure Footing (in slowW)
    eb_12_2:[ {param:'aw.k',add:R(0.01)} ],                                                                         // And a Wall (in rushLand)
    eb_12_4:[ {on:'tick',period:3,do:[{fn:'readAloud'}]} ],                                                         // Read Aloud
    eb_13_2:[ {param:'sig.fm',add:1} ]                                                                              // The First Mark (SIGNATURE: carveHit, tk, teamIn)
  },
  needs:{ eb_6_3:'eb_5_3', ot_6_2:'ot_5_2', st_6_3:'st_5_3', eb_12_2:'eb_11_2', ot_12_3:'ot_11_3', ot_12_1:'ot_10_1' },
  fn:{
    /* ---- each tick: who is Sheltered (allies whose body is within 3 m of his, behind him: farther from the middle of the living enemies than he is), who reads his
       Lesson (allies within 4 m, body to body; Teach Them / The First Mark: double), Anchor, Thick Chitin's clock, Never Stops, Not Them, the countdowns ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), P=T.P, dt=c.dt||0, M=E.METER();
      for(const k of ['fwL','otL','ntL','fmL']) if(o[k]>0) o[k]=Math.max(0,o[k]-dt);
      if(o.f==null) o.f={sh:SH.some(id=>T.r[id]), les:LES.some(id=>T.r[id]), an:AN.some(id=>T.r[id]), nt:!!T.r.ot_5_2};
      const F=foes(A,u), U=mates(A,u);
      if(o.f.sh){ const sh={}; if(F.length){ let sx=0,sy=0; for(const e of F){ sx+=e.x; sy+=e.y; } const cx=sx/F.length, cy=sy/F.length, dm=Math.hypot(u.x-cx,u.y-cy), R=(3+(P['sh.r']||0))*M;
          for(const a of U) if(Math.hypot(a.x-cx,a.y-cy)>dm&&A.gap(u,a)<=R) sh[a.uid]=1; } o.sh=sh; }
      if(o.f.les){ const L={}, R=(4+(P['les.r']||0))*M, dg=A.winOn(T,'rkDg')&&P['les.teach'], fm=A.winOn(T,'rkFm');
        for(const a of U){ const g=A.gap(u,a); let n=g<=R?1:0; if((dg&&g<=4*M)||(fm&&g<=6*M)) n=2; if(n) L[a.uid]=n; } o.les=L; }
      if(o.f.an&&u.alive){ const mv=T.s.moved||!!u._dash||((u._airT||0)>0);
        if(!F.length){ o.ad=0; }
        else if(!mv){ o.ad=(o.ad||0)+dt; if(o.ad>=1){ const n=Math.floor(o.ad+1e-9); o.ad-=n; A.stSet(T,u,'rkAn',A.stGet(T,'rkAn')+n); } }
        else { o.ad=0; if(!(P['dig.fill']&&A.winOn(T,'rkDg'))) A.stSet(T,u,'rkAn',0); } }
      if(u.pass&&u.pass.warden&&(u.wardenStk||0)<5&&(P['chit.fast']||P.smooth)){ const p=Math.max(1,(3-(P['chit.fast']||0))/(P.smooth?2:1)); u.wardenT=(u.wardenT||0)+dt*(3/p-1); }
      if(P['ns.on']&&o.rush&&u._dash&&((u.stunned||0)>0||(u.fearT||0)>0)){ const D=u._dash; D.t+=dt; const k=Math.min(1,D.t/D.dur), f=D.ease?D.ease(k):k;   // Never Stops: the dash goes on (the page's own lines)
        u.x=D.x0+(D.x1-D.x0)*f; u.y=D.y0+(D.y1-D.y0)*f; u._ax=u.x; u._ay=u.y; if(k>=1){ u._dash=null; D.run(); } }
      if(o.f.nt){ for(const a of U){ const f=a.hp/Math.max(1,a.maxHp), p=o.nt[a.uid]; o.nt[a.uid]=f; if(p!=null&&p>=0.3&&f<0.3&&!(o.ntL>0)){ o.ntL=Math.max(0,20-(P['nt.wait']||0)); o.dig=2; } } }
      if(o.dig){ o.dig-=dt; if(o.dig<0) o.dig=0; else if(!((u.stunned||0)>0||(u.fearT||0)>0)&&F.length&&E.castSlot){ o.dig=0; E.castSlot(u,'blue',F[0]); } }
      if(o.fw2){ o.fw2.left-=dt; const L=F.filter(x=>x!==o.aim); if(o.fw2.left<0||!L.length){ o.fw2=null; }
        else if(!u._dash&&E.castUlt){ let b=null,bd=-1; for(const x of L){ const d=E.dist(u,x); if(d>bd){ bd=d; b=x; } } o.fw2=null; o.secOn=b; o.sec=1; E.castUlt(u,b); o.secOn=null; } } },
    wv(A,T,u){ const o=S(T), P=T.P; o.lost=0; o.lastT=null; if(P['hl.old']) A.stSet(T,u,'rkHl',Math.max(A.stGet(T,'rkHl'),P['hl.old'])); },
    /* ---- HEADLONG: each basic attack that lands on the same enemy as the last adds 1 (Through the Line: 2 on a Trampled enemy), max 5; at 5 the next basic
       attack deals 10% x rank more (Lowered Horn), shoves its enemy 1.5 m back (Last Push farther) and empties it; Straight Through It, Rolling Weight ---- */
    hlOut(A,T,u,c){ const o=S(T), P=T.P; if(c.proc) return; if(A.stGet(T,'rkHl')>=5){ o.shv=c.tgt; if(P['hl.k']) c.amt*=1+P['hl.k']; } else o.shv=null; },
    hlHit(A,T,u,c){ const o=S(T), P=T.P, t=c.tgt; if(c.proc||!t) return;
      if(o.shv===t){ o.shv=null; A.stSet(T,u,'rkHl',0); o.lastT=null; const m=1.5+(P['hl.push']||0); let L=[t];
        if(P['hl.thru']){ const E=A.eng(), d0=E.dist(u,t); let b=null,bd=1e18; for(const x of foes(A,u)){ if(x===t) continue; const g=A.gap(t,x); if(E.dist(u,x)>d0&&g<=3*E.METER()&&g<bd){ bd=g; b=x; } }
          if(b){ A.hurt(T,u,b,c.amt||0,'#c9a6ff','thru'); L.push(b); } }
        for(const x of L) if(x.alive) A.acts(T,u,[{push:'target',from:'self',m,secs:0.3}],Object.assign({},c,{tgt:x}));
        if(P['hl.heal']) A.acts(T,u,[{heal:{pct:P['hl.heal'],of:'maxHp'},on:'self'}],c); return; }
      const same=o.lastT==null||o.lastT===t; const add=(P['hl.tl']&&A.markOf(u,t,'rkTr'))?2:1;
      A.stSet(T,u,'rkHl',(same?A.stGet(T,'rkHl'):0)+add); o.lastT=t; },
    /* ---- IMPALE RUSH ---- */
    rushKit(A,T,u){ const o=S(T); o.rush=1; o.st=[]; o.hitN=0; },
    rubble(A,T,u,c){ const op=c.o, M=A.eng().METER(); if(!(op.pathHit>0)) op.pathHit=0.5; if(!(op.knockAside>0)) op.knockAside=1.5*M; },
    /* whom it goes to: the signature's second (the farthest enemy other than the first's), else Shorter Fuse (the nearest enemy); how far he runs (Longer Run) */
    rushTgt(A,T,u,c){ const o=S(T), P=T.P, E=A.eng();
      if(o.secOn&&o.secOn.alive) c.tgt=o.secOn;
      else if(P['sf.on']){ let b=null,bd=1e18; for(const x of foes(A,u)){ const d=E.dist(u,x); if(d<bd){ bd=d; b=x; } } if(b) c.tgt=b; }
      if(!o.sec) o.aim=c.tgt; o.run=c.tgt?E.dist(u,c.tgt)/E.METER():0; },
    rushOut(A,T,u,c){ const o=S(T), P=T.P; let k=1; if(P['run.k']) k*=1+Math.min(0.40,P['run.k']*(o.run||0)); if(o.sec) k*=0.6; c.amt*=k; },
    rushHit(A,T,u,c){ const o=S(T); o.hitN=(o.hitN||0)+1; },
    /* its stun landed (a resisted one does not): Trampled; made longer in full (Shorter Fuse 0.5 s, Hard Charge, A Straight Line 0.1 s a Carving), never past 4 s in all;
       the lock (0.5 s after it ends) for the signature's second */
    ccHit(A,T,u,c){ const o=S(T), P=T.P, t=c.tgt; if(c.talent||c.field!=='stunned'||!t||!t.alive||T.s.cur!=='charge'||!(c.amt>0)) return;
      let ext=(P['sf.on']?0.5:0)+(P['ext.hc']||0)+(P['ext.sl']?P['ext.sl']*A.stGet(T,'rkCv'):0);
      if(ext>0) t.stunned=Math.min(CTRL_MAX,Math.max(t.stunned||0,(c.amt||0)+ext));
      if(o.st.indexOf(t)<0) o.st.push(t);
      if(TR.some(id=>T.r[id])) T.fn.trample(A,T,u,t);
      if(P['sig.fw']) A.setMark(T,u,t,'rkLk',{dur:(t.stunned||0)+0.5,longest:true}); },
    trample(A,T,u,t){ if(t&&t.alive) A.setMark(T,u,t,'rkTr',{dur:5+(T.P['tr.dur']||0),longest:true}); },
    /* the stun-lock rule for the signature's second Impale Rush: its stun never lands on an enemy that is stunned, or within 0.5 s after a stun of his on it ended */
    ccOut(A,T,u,c){ const o=S(T), t=c.tgt; if(!o.sec||c.talent||c.field!=='stunned'||!t) return; if((t.stunned||0)>0||A.markOf(u,t,'rkLk')) c.amt=0; },
    /* it has landed: Scattered (3+ stunned: 0.1 s x rank longer), Bowled Over, Momentum Hide, Close Quarters, And a Wall, The Fastest Way */
    rushLand(A,T,u,c){ const o=S(T), P=T.P, now=A.eng().now(), L=o.st.filter(x=>x.alive), sec=!!o.sec; o.rush=0;
      if(P['ext.sc']&&L.length>=3) for(const t of L) t.stunned=Math.min(CTRL_MAX,(t.stunned||0)+P['ext.sc']);
      if(T.r.st_11_2&&L.length) A.stSet(T,u,'rkBo',A.stGet(T,'rkBo')+L.length);
      if(P['dr.mh']) A.acts(T,u,[{window:'rkMh',dur:3}],c);
      if(P['dr.cq']&&P['sf.on']) A.acts(T,u,[{window:'rkCq',dur:3}],c);
      if(P['aw.k']&&T.r.eb_11_2){ const n=A.stGet(T,'rkCv'); if(n>0) A.acts(T,u,[{shield:{pct:P['aw.k']*n,of:'maxHp'},dur:4,on:'self'}],c); }
      if(P['sig.fw']){ if(sec){ o.sec=0; A.stSet(T,u,'rkHl',5); o.lastT=null; }
        else if((o.hitN||0)>=3&&!(o.fwL>0)){ o.fwL=25; o.fw2={left:2}; } }
      o.st=[]; o.hitN=0; },
    /* ---- DIG IN: its own reduction x Roar Louder x Dig Deeper, NEVER past 50% (Phil: "cap rhukks dig in at 50%"); the taunt made longer (Long Roar, the One Tunnel
       signature's 2 s) never past 4 s; Did Not Move, Carved by the Roar, Come for Me, Forgot the Young ---- */
    digCast(A,T,u,c){ const o=S(T), P=T.P, now=A.eng().now();
      const k=(1+(P['dig.k1']||0))*(1+(P['dig.k2']||0)); if(u.drT>0){ const dr=Math.min(DIG_CAP,(1-u.drMul)*k); u.drMul=1-dr; o.digDr=dr; }
      const ext=(P['dig.ext']||0)+(o.otCast?2:0); o.otCast=0; const L=foes(A,u).filter(x=>taunted(u,x)); let tl=3+ext;
      for(const t of L){ if(ext>0) t.forcedTargetT=Math.max(t.forcedTargetT,Math.min(CTRL_MAX,t.forcedTargetT+ext)); tl=Math.max(tl,t.forcedTargetT); }
      A.acts(T,u,[{window:'rkDg',dur:Math.min(CTRL_MAX,tl)}],c);
      if(P['dig.fill']) A.stSet(T,u,'rkAn',1e9);
      const n=L.length;
      if(P['dig.carv']&&n>0){ A.acts(T,u,[{shield:{pct:0.01*n,of:'maxHp'},dur:3,on:'self'}],c); if(T.r.eb_1_1&&n>=2) T.fn.carve(A,T,u,c); }
      if(P['dig.heal']&&n>0) A.acts(T,u,[{heal:{pct:P['dig.heal']*n,of:'maxHp'},on:'self'}],c);
      if(P['ft.on']) for(const t of L) A.setMark(T,u,t,'rkFt',{dur:Math.min(CTRL_MAX,t.forcedTargetT)+3}); },
    /* ---- CARAPACE: Thicker Plates (1% x rank stronger), "while Carapace lasts" (its own time), Thick Lip's shields on the Sheltered, Cut Deep ---- */
    caraCast(A,T,u,c){ const o=S(T), P=T.P; if(P['cp.k']&&u.drT>0) u.drMul=1-Math.min(0.95,(1-u.drMul)*(1+P['cp.k']));
      const d=u.drT>0?u.drT:5; A.acts(T,u,[{window:'rkCp',dur:d}],c);
      if(P['cp.sh']) for(const a of mates(A,u)) if(o.sh[a.uid]) A.acts(T,u,[{shield:{flat:P['cp.sh']*a.maxHp},dur:d,on:'target'}],Object.assign({},c,{tgt:a}));
      if(P['cp.cut']) T.fn.carve(A,T,u,c); },
    /* ---- CARVINGS: a hit on him that takes 6% (Hard Lesson: down to 3%) of his max HP carves 1, up to 6 (Carve It: 10), the whole fight; Keep It Smooth: never.
       Every Hard Thing heals. The First Mark: such a hit at his most Carvings, once every 30 s ---- */
    carveHit(A,T,u,c){ const s=c.src, P=T.P, o=S(T); if(!s||s.team===u.team) return; const need=Math.max(0.03,0.06-(P['cv.need']||0))*u.maxHp; if(!((c.hpLost||0)>=need)||P.smooth) return;
      if(A.stGet(T,'rkCv')>=A.stMax(T,u,'rkCv')){ if(P['sig.fm']&&!(o.fmL>0)){ o.fmL=30; A.acts(T,u,[{window:'rkFm',dur:6}],c); T.s.undy=Math.max(T.s.undy||0,6); if(u.hp<1) u.hp=1; } return; }
      T.fn.carve(A,T,u,c); },
    carve(A,T,u,c){ const P=T.P; if(P.smooth||!CV.some(id=>T.r[id])) return false; const n=A.stGet(T,'rkCv'); if(n>=A.stMax(T,u,'rkCv')) return false; A.stSet(T,u,'rkCv',n+1);
      if(P['cv.heal']) A.acts(T,u,[{heal:{pct:P['cv.heal'],of:'maxHp'},on:'self'}],c); return true; },
    lesU(A,T,u,c){ const x=c.tgt; return !!(x&&S(T).les[x.uid]); },
    lesK(A,T,u,c){ const x=c.tgt; return x?(S(T).les[x.uid]||0)*A.stGet(T,'rkCv'):0; },
    lesHeal(A,T,u,c){ const x=c.unit; return !!(x&&x!==u&&S(T).les[x.uid]); },
    shU(A,T,u,c){ const x=c.unit; return !!(x&&x!==u&&S(T).sh[x.uid]); },
    readAloud(A,T,u,c){ const o=S(T), k=0.003*rk(T,'eb_12_4'); for(const a of mates(A,u)) if(o.les[a.uid]) A.acts(T,u,[{heal:{flat:k*a.maxHp},on:'target'}],Object.assign({},c,{tgt:a})); },
    chitN(A,T,u){ return Math.min(5,u.wardenStk||0); },
    backT(A,T,u,c){ return back(c.tgt); },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP: each multiplies, together at most 35% off a hit (hits and damage over time). His skill slot (Carapace / Dig In) and Thick
       Chitin are the game's own and multiply on top, as every other reduction does ---- */
    drK(A,T,u,s,kind,crit){ const P=T.P, o=S(T); let k=1; const mg=kind==='magic';
      if(P['dr.dl']&&mg) k*=1-P['dr.dl'];
      if(P['dr.cq']&&A.winOn(T,'rkCq')) k*=1-P['dr.cq'];
      if(P['dr.bh']&&A.stGet(T,'rkHl')>=3) k*=1-P['dr.bh'];
      if(P['dr.mh']&&A.winOn(T,'rkMh')) k*=1-P['dr.mh'];
      if(P['dr.hh']) k*=1-P['dr.hh'];
      if(P['dr.an']) k*=1-P['dr.an']*A.stGet(T,'rkAn');
      if(P['dr.ul']) k*=1-P['dr.ul'];
      if(P['dr.th']&&s&&taunted(u,s)) k*=1-P['dr.th'];
      if(P['dr.cg']&&(u.wardenStk||0)>=5) k*=1-P['dr.cg'];
      if(P['dr.bw']&&u.hp<0.3*u.maxHp) k*=1-P['dr.bw'];
      if(P['dr.ss']&&crit&&A.stGet(T,'rkAn')>=A.stMax(T,u,'rkAn')) k*=1-P['dr.ss'];
      if(P['dr.sm']) k*=1-P['dr.sm'];
      if(P['dr.tl']&&mg&&A.winOn(T,'rkCp')) k*=1-P['dr.tl'];
      if(P['dr.lh']) k*=1-P['dr.lh'];
      if(P['dr.sd']&&back(s)) k*=1-P['dr.sd'];
      return Math.max(DR_FLOOR,k); },
    myDr(A,T,u,c){ if(!T.s.api) T.s.api=A; const s=c.src||(c.dot&&c.dot.src); if(s&&s.team===u.team) return; c.amt*=T.fn.drK(A,T,u,s,c.kind||(c.dot&&c.dot.kind),!!c.crit); },
    /* ---- HIS ALLIES: one capped group on a hit on an ally (Sheltered 2% x 3, Shell Over Them's half, Thick Loam, The First Mark's 25%: together at most 50%), the One
       Tunnel signature (the hit lands on him at half: moved, c.mv = 0), Forgot the Young; and hits BY his allies (Little Ones Watch, Lines in the Chitin) ---- */
    teamIn(A,T,u,c){ const o=S(T), P=T.P, t=c.tgt, s=c.src, E=A.eng(); if(!t||!s) return;
      if(t.team===u.team&&t!==u&&s.team!==u.team){ const sh=!!o.sh[t.uid];
        if(P['sig.ot']&&sh&&!A.winOn(T,'rkOt')&&!(o.otL>0)&&t.hp>=0.25*t.maxHp&&t.hp+(t.shield||0)-(c.amt||0)<0.25*t.maxHp){ o.otL=30; A.acts(T,u,[{window:'rkOt',dur:5}],c); o.otCast=1; o.dig=2; A.stSet(T,u,'rkAn',1e9); }
        if(P['sig.ot']&&sh&&A.winOn(T,'rkOt')&&u.alive){ const h=(c.amt||0)*0.5; c.amt=0; c.mv=0; if(h>0) A.hurt(T,u,u,h,'#c9a6ff','tunnel'); return; }
        if(P['ft.on']&&sh&&A.markOf(u,s,'rkFt')&&!taunted(u,s)){ A.clearMark(u,s,'rkFt'); A.acts(T,u,[{taunt:1,on:'source'}],c); if(P['ft.sh']) A.acts(T,u,[{shield:{pct:P['ft.sh'],of:'maxHp'},dur:4,on:'self'}],c); }
        let k=1; if(P['sh.k']&&sh) k*=1-P['sh.k']; if(P['cp.half']&&sh&&A.winOn(T,'rkCp')) k*=0.5;
        if(P['dr.tl']&&c.kind==='magic'&&A.winOn(T,'rkCp')&&o.les[t.uid]) k*=1-P['dr.tl'];
        if(P['sig.fm']&&A.winOn(T,'rkFm')&&A.gap(u,t)<=6*E.METER()) k*=0.75;
        c.amt*=Math.max(ALLY_FLOOR,k); return; }
      if(t.team!==u.team&&s.team===u.team&&s!==u){ let k=1; if(P['sh.out']&&o.sh[s.uid]) k*=1+P['sh.out']; if(P['les.out']&&o.les[s.uid]) k*=1+P['les.out']; c.amt*=k; } },
    /* ---- THE CRIT GROUP: at most 5% from all of them on any hit. Long Horn is a stat (critS); Gore Back (an enemy he taunted) and Plated Horn (Impale Rush) are this
       hit's own seeded roll, in the room left ---- */
    critS(A,T){ return Math.min(CRIT_CAP,T.P['crit.lh']||0); },
    crit(A,T,u,c){ const P=T.P, t=c.tgt; if(c.force) return; let p=0;
      if(P['crit.gb']&&taunted(u,t)) p+=P['crit.gb'];
      if(P['crit.ph']&&RUSH.indexOf(T.s.cur)>=0) p+=P['crit.ph'];
      p=Math.min(p,Math.max(0,CRIT_CAP-T.fn.critS(A,T))); if(!(p>0)) return;
      const base=Math.min(0.95,(u.glyphCrit||0)+((u._critBuffT||0)>0?(u._critBuffPct||0):0)); if(A.eng().rnd()<p/Math.max(0.05,1-base)) c.force=true; },
    slowW(A,T){ const P=T.P; return Math.min(SLOW_CAP,(P['slow.nt']||0)+(P['slow.sf']||0)+(A.stGet(T,'rkAn')>0?(P['slow.lr']||0):0)); },
    /* ---- BY MORNING: a wave that ends with no Sheltered ally lost (an ally that died while Sheltered) heals him 2% x rank; Nobody Lost heals every ally 1% x rank ---- */
    hold(A,T,u){ if(T.s.undy>0&&u.hp<1) u.hp=1; },
    death(A,T,u,c){ const x=c.unit, o=S(T); if(x&&x.team===u.team&&x!==u&&o.sh[x.uid]) o.lost=1; },
    byMorning(A,T,u,c){ const o=S(T), P=T.P; if(o.lost) return; A.acts(T,u,[{heal:{pct:P['bm.k']||0,of:'maxHp'},on:'self'}],c);
      if(P['bm.all']) for(const a of mates(A,u)) A.acts(T,u,[{heal:{flat:P['bm.all']*a.maxHp},on:'target'}],Object.assign({},c,{tgt:a})); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/50 - RHUKK - talent decisions.md) */
  ruling:{}
};
