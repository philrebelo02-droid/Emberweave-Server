/* SEYLA SILKCOIL - what her learned talents do in a fight (the mechanics; her plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Seyla Silkcoil")
   Her real kit (the code, not the tooltip wording; a melee mid-row Assassin, damage profile Attack: every hit of hers is physical; tests/seyla-kit-facts.js):
   - Venom Rhythm (passive 'venomrhythm'): counted at the SWING (before the blow lands): u._vrN = (u._vrN + 1) % 3; when it comes to 0 the swing's target gets
     the venom: Mortal Wound (mortalT, its healing halved) for 4 s and an Energy slow of 40% x the passive's multiplier for 4 s (_nrgSlowPct keeps the
     highest value ever written: the game never lowers it). Her count is never reset: it carries over between targets and waves.
   - Ribbon Fang ('bleedstack', green, cd 6): 135% of her attack on her target, then a stacking wound (addBleedStack: a game bleed of 16% of her attack a
     second for 6 s, physical; at 3 stacks within 6 s of each other it ruptures for 190%). MEASURED: it never stacks in real fights (the stack lapses at
     6 s, the cooldown is 6 s: 119 casts, 0 ruptures). Fang Rhythm (cooldown -0.5 s) is what lets it stack and rupture.
   - Hooded Feint ('evadecounter', blue, cd 9): a 2.4 s window in the game's one damage-reduction slot (x0.6 down to x0.501 by level); the first enemy hit
     inside it is evaded and she counters it for 190% x the skill multiplier (the page's landPre / land pair 'counter').
   - Serpent's Last Dance ('serpentdance', ultimate): she is rooted 2.4 s while a star circles her 4 times (radius 3 m from her centre plus the enemy's
     radius); each pass strikes each enemy in the circle for 60% x the skill multiplier, and an enemy left below 10% HP is executed (bosses too).
     Struck nobody on 22 of 49 casts in 20 seeded fights; 0 executions. Its passes are a page part 'sdPass' (partPre / part around each pass's hit).
   Beat, Read, Toxin, Shed Skin, Crowd and Tied exist only through her talents. Every state and mark name of hers starts with 'sy'; her per-fight object is T.s.sy.
   Every timer of hers is a countdown or an engine mark (no stamp of her own on the fight clock: no `times` list is needed).
   Readings, caps and corrected tooltips: WIRING/52 - SEYLA SILKCOIL - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const RF=['bleedstack','rupture'], SD='serpentdance', SDP='sdPass', RD='syRead';
const DR_FLOOR=0.60, CRIT_CAP=0.05, DODGE_CAP=0.10, SLOW_CAP=0.40, CD_SIG=20, REGEN=0.012, CR_M=5, VEN=4, CUT=0.5;
/* the states several talents read: their bookkeeping runs when any of these is learned */
const READ=['ct_1_4','ct_3_4','ct_n1','ct_5_4','ct_7_4','ct_9_4','ct_12_3','ct_13_2'];                                      // Read (an enemy that swings at her twice)
const TOX=['bl_1_1','bl_2_1','bl_3_1','bl_7_1','bl_4_2','bl_5_2','bl_6_2','bl_6_1','bl_7_3','bl_9_1','bl_9_3','bl_11_1','bl_11_2','bl_11_3','bl_12_1','bl_12_2','bl_12_4','bl_13_2'];   // Toxin
const CROWD=['tc_1_1','tc_2_1','tc_3_1','tc_4_3','tc_6_1','tc_7_1','tc_8_1','tc_8_3','tc_9_1','tc_11_1','tc_11_3','tc_12_1','tc_13_2'];   // Crowd
const DRME=['ct_4_1','ct_n2','ct_6_4','ct_12_3','ct_7_4','bl_3_4','bl_6_4','tc_2_1','tc_6_1','tc_12_4','tc_6_4'];             // hits on her: ONE capped group (40%)
const DRT=['ct_7_4','tc_6_4','tc_12_3'];                                                                                    // hits on her allies (He Always Leaned In x Ribbon Bind: at most 12.6%) and her team's hits on Tied enemies
const CRT=['ct_11_3','bl_1_2','ct_3_4','bl_11_3','tc_11_3'];                                                               // critical chance: ONE group, at most 5%
const DODGE=['ct_9_2','tc_7_1'];                                                                                           // talent dodge: at most 10%
const HEALS=['ct_11_1','bl_9_2','tc_6_3'];                                                                                 // her own heals from talents (one budget: the regeneration cap)
const CUTS=['bl_8_1','ct_5_2','ct_5_3','bl_13_2'];                                                                         // the healing her venom (and the signature) takes off enemies
const BLEED=['ct_4_2','bl_3_3','tc_9_4'];                                                                                  // Ribbon Fang's wound made hers (its ticks run her rows)
const S=T=>T.s.sy||(T.s.sy={vs:{},sdc:{},ev:{}});      // her own per-fight state (one object, so no name of the runtime's own is ever used)
const rk=(T,id)=>T.r[id]||0;
const toxOn=(T,o)=>o.tox!=null?o.tox:(o.tox=TOX.some(id=>T.r[id]));   // Toxin is kept when any Toxin talent is learned
const foe=(u,x)=>!!x&&x.team!==u.team;
const mate=(u,x)=>!!x&&x.alive&&x.team===u.team&&!x._summon;
const boss=x=>!!x&&!!((x.t&&x.t.isboss)||x._raidBoss);
const enemies=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget&&!((x._riseT||0)>0));
const gainE=(x,n)=>{ if(x&&x.alive&&n>0) x.energy=Math.min(100,(x.energy||0)+n); };
const tox=(A,T,u,x)=>x?A.ustGet(T,u,x,'syTx'):0;
const venomed=(A,T,u,x)=>!!x&&x.team!==u.team&&(!!A.markOf(u,x,'syV')||tox(A,T,u,x)>0);   // her venom (from a bite) or her Toxin is on it
const tied=(A,u,x)=>!!x&&!!A.markOf(u,x,'syTd');
const wasRead=(A,u,x)=>!!x&&!!(A.markOf(u,x,'syRd')||A.markOf(u,x,'syRdA'));             // Read now, or within 3 s after its third swing missed
const atkNow=(A,u)=>(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*A.eng().rage();
module.exports={
  hero:'seyla',
  casting:true,                         // rows ask which of her skills a hit comes from
  states:{
    syTx:{unit:true,max:P('tx.max',5),dur:P('tx.dur',6)},          // Toxin on enemies (all of it lapses 6 s after the last gain; Slow Poison longer; Lingering Bite more)
    syCr:{max:8},                                                   // Crowd now (set each tick by tk)
    sySc:{max:12,wave:'reset'},                                     // She Still Counts: Three beats this wave
    syAr:{max:15},                                                  // All the Way Round: enemies Serpent's Last Dance has struck this fight
    syPp:{max:5,wave:'reset'}                                       // Patient Poison: enemies that died with Toxin this wave
  },
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]}, {on:'wave',do:[{fn:'wv'}]},
    {on:'num',skill:'vrN',do:[{fn:'vrN'}]},                                                                         // her count: which beat this swing is, and whether it bites
    {on:'pass',skill:'venomrhythm',do:[{fn:'vrPass'}]},                                                             // the swing has been counted (and the game's venom written)
    {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'myHit'}]},                                                           // after each hit of hers: Tied, Touch Each of Them, Antivenom, Venom Hunger
    {on:'aimed',reqAny:READ,if:{auto:true},do:[{fn:'aim'}]},                                                        // Read: an enemy's basic attack coming at her
    {on:'dodge',reqAny:READ,if:{auto:true,fn:'readMiss'},do:[{dodge:true},{fn:'readGo'}]},                         // a Read enemy's third swing misses, and she counters from its flank
    {on:'dodge',reqAny:DODGE,if:{fn:'canRoll'},chance:{field:'_talDodge',of:'self'},do:[{dodge:true}]},             // her talent dodge (Sway Away, Never Where It Lands)
    {stat:{dodge:1},reqAny:DODGE,per:{fn:'dodgeP'}},                                                                // its chance: at most 10%
    {on:'crit',reqAny:CRT,chance:{flat:1,x:{fn:'critP'}},force:true},                                               // her critical-chance talents: ONE group, at most 5%
    {on:'in',reqAny:DRME,do:[{fn:'myIn'}]}, {on:'dotIn',reqAny:DRME,do:[{fn:'myDot'}]},                            // her damage reduction: ONE capped group (40%)
    {on:'teamIn',reqAny:DRT,do:[{fn:'tIn'}]},                                                                       // hits on her allies (at most 12.6%) and her team's hits on Tied enemies
    {on:'teamHeal',reqAny:CUTS,do:[{fn:'tHeal'}]},                                                                  // healing on enemies under her venom (its strength) or the signature's 4 s
    {on:'death',reqAny:['bl_9_1','bl_12_2'],do:[{fn:'died'}]},
    {on:'kit',skill:'bleedstack',do:[{fn:'rfKit'}]}, {on:'cast',skill:'bleedstack',do:[{fn:'rfCast'}]},
    {on:'pass',skill:'bleedstack',reqAny:BLEED,do:[{fn:'rfPass'}]},                                                 // a Ribbon Fang wound was just pushed
    {on:'part',skill:'rupture',reqAny:['bl_11_2'],do:[{fn:'rupt'}]},
    {on:'landPre',skill:'counter',reqAny:['ct_11_2'],do:[{fn:'ctrPre'}]}, {on:'land',skill:'counter',reqAny:['ct_11_2'],do:[{fn:'ctrLand'}]},   // Hood Up: Hooded Feint's counter is a Three beat
    {on:'kit',skill:SD,do:[{fn:'sdKit'}]}, {on:'partPre',skill:SDP,do:[{fn:'sdPre'}]}, {on:'part',skill:SDP,do:[{fn:'sdPass'}]},   // Serpent's Last Dance and each pass of its star
    {on:'tick',reqAny:['ct_12_4','tc_n1'],do:[{weaken:'slowMul',by:{flat:1,x:{fn:'slowK'}}}]}                     // slows on her weaker (Quiet Feet, Loose Coils: at most 40%)
  ],
  talents:{
    /* ============================== COUNTING TO THREE ============================== */
    ct_1_1:[ {on:'out',if:{targetTeam:'enemy',fn:'isOne'},ignoreArmor:R(0.02)} ],                                   // One (Beat: vrN / vrPass)
    ct_n3:[  {param:'pc',add:R(0.04)} ],                                                                            // Partner's Count (vrPass)
    ct_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Swaying
    ct_1_4:[ {param:'rd',add:R(0.40)} ],                                                                            // Where the Weight Is (Read: aim / readGo)
    ct_2_1:[ {param:'two',add:R(0.06)} ],                                                                           // Two (vrPass)
    ct_2_2:[ {on:'out',if:{casting:RF,targetTeam:'enemy'},more:R(0.03)} ],                                          // Ribbon Edge
    ct_11_3:[],                                                                                                     // Steel Ribbon (critP: in the 5% group)
    ct_3_1:[ {on:'crit',if:{fn:'isThree'},force:true} ],                                                            // Three (a guaranteed critical: an event, not a chance)
    ct_4_2:[ {on:'dotOut',if:{fn:'rfBleed'},more:R(0.04)} ],                                                        // Wider Wound
    ct_n1:[  {on:'out',if:{casting:RD,targetTeam:'enemy'},more:0.08} ],                                             // Venomed Answer (LINK: with Venom Sac a Toxin, readGo)
    ct_3_4:[],                                                                                                      // Body Language (critP: Read's counter)
    ct_4_1:[ {param:'dr.sc',add:R(0.015)} ],                                                                        // Scales (her group)
    ct_5_2:[ {param:'f2',add:1} ],                                                                                  // Fang on Two (PICK ONE: vrN)
    ct_5_3:[ {param:'lc',add:1} ],                                                                                  // Long Count (PICK ONE: vrN)
    ct_4_3:[ {param:'nm',add:R(0.03)} ],                                                                            // Night Market (vrPass)
    ct_n2:[  {param:'dr.nh',add:R(0.02)} ],                                                                         // Nimble Hood (her group)
    ct_6_2:[ {on:'out',if:{targetTeam:'enemy',fn:'isBite'},more:R(0.03)} ],                                          // Double Fang (needs Fang on Two)
    ct_6_3:[ {on:'out',if:{targetTeam:'enemy',fn:'isFour'},more:R(0.05)} ],                                          // Fourth Beat (needs Long Count)
    ct_6_1:[ {on:'out',if:{targetTeam:'enemy',fn:'isOne'},more:R(0.03)} ],                                           // Steady Count
    ct_6_4:[ {param:'dr.he',add:R(0.02)} ],                                                                         // Hooded Eyes (her group)
    ct_3_3:[ {on:'out',if:{casting:'counter',targetTeam:'enemy'},more:R(0.03)} ],                                    // Hood Flare
    ct_5_4:[ {param:'rd.win',add:R(0.4)} ],                                                                         // Learned Body (aim)
    ct_7_1:[ {on:'out',if:{casting:RF,targetTeam:'enemy',fn:'rf3'},more:R(0.05)} ],                                  // In Threes
    ct_7_4:[ {param:'dr.ln',add:R(0.03)} ],                                                                         // He Always Leaned In (both groups)
    ct_8_1:[ {param:'rp',add:1}, {stat:{aspd:R(0.02)},if:{window:'syRp'}} ],                                        // Rhythm of the Pipe (full)
    ct_8_2:[ {on:'out',if:{crit:true,targetTeam:'enemy',fn:'isThree'},critMore:R(0.02)} ],                           // Coil Tight (at most 10%)
    ct_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'flank'},more:R(0.02)} ],                                           // Sidewinder
    ct_9_1:[ {param:'lb',add:1} ],                                                                                  // Last Beat (sdPass)
    ct_9_2:[ {param:'swa',add:R(0.02)} ],                                                                           // Sway Away (full; dodgeP)
    ct_9_3:[ {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:R(0.03)} ],                                          // Weakest for the Last
    ct_9_4:[ {param:'mm',add:2} ],                                                                                  // Mistake Made (readGo)
    ct_10_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ],                                           // Steady Feet
    ct_10_2:[ {param:'vn.dur',add:R(0.2)} ],                                                                        // Sure Bite (bite)
    ct_11_1:[ {param:'tit',add:R(0.005)} ],                                                                         // Tune in Threes (three; the heal budget)
    ct_11_2:[ {param:'hu',add:1} ],                                                                                 // Hood Up (ctrPre / ctrLand)
    ct_7_3:[ {on:'cd',skill:'blue',add:R(-0.1)} ],                                                                  // Flank Step
    ct_12_1:[ {param:'rk',add:R(0.10)} ],                                                                           // Rocking on His Heels (vrPass)
    ct_12_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.004),per:'sySc'} ],                                         // She Still Counts (three)
    ct_12_3:[ {param:'dr.ll',add:R(0.03)} ],                                                                        // Learned Language (her group)
    ct_12_4:[ {param:'qf',add:R(0.08)} ],                                                                           // Quiet Feet (slowK)
    ct_13_2:[ {param:'nn',add:1} ],                                                                                 // Never Heard a Note (SIGNATURE: three, vrN, aim)

    /* ============================== THE BITE THAT LINGERS ============================== */
    bl_1_1:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.006),per:{ust:'syTx',of:'target'}} ],                        // Venom Sac (Toxin: bite / toxAdd)
    bl_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Low and Quick
    bl_1_4:[ {param:'shed',add:R(0.04)} ],                                                                          // Old Skin (Shed Skin: tk / shed)
    bl_2_1:[ {param:'tv',add:R(0.02)} ],                                                                            // Thick Venom (nrgWatch)
    bl_2_2:[ {on:'out',if:{casting:RF,targetTeam:'enemy',fn:'venT'},more:R(0.03)} ],                                 // Bitter Ribbon
    bl_1_2:[],                                                                                                      // Fang Edge (critP: in the 5% group)
    bl_3_1:[ {param:'gn',add:1} ],                                                                                  // Gathered Nothing (nrgWatch)
    bl_3_3:[ {on:'dotOut',if:{fn:'myBleed'},more:R(0.03)} ],                                                        // Rot in the Wound
    bl_3_4:[ {param:'dr.ns',add:R(0.02)} ],                                                                         // New Scales (shed; her group)
    bl_7_1:[ {param:'tx.dur',add:R(0.4)} ],                                                                         // Slow Poison
    bl_4_2:[ {on:'part',skill:'rupture',if:{targetTeam:'enemy'},chance:R(0.3),do:[{fn:'tox1'}]} ],                   // Seeping Cut
    bl_4_3:[ {param:'vh',add:R(0.03)} ],                                                                            // Venom Hunger (myHit)
    bl_5_1:[ {on:'ccIn',less:R(0.04),upTo:0.20} ],                                                                  // Supple (at most 20%)
    bl_5_2:[ {param:'par',add:0.8} ],                                                                               // Paralytic (PICK ONE: toxAdd / para)
    bl_5_3:[ {param:'hm',add:1} ],                                                                                  // Haemotoxin (PICK ONE: bite)
    bl_5_4:[ {param:'slo',add:1}, {stat:{aspd:R(0.02)},if:{window:'sySl'}} ],                                       // Sloughing (shed)
    bl_6_2:[ {param:'par',add:R(0.1)} ],                                                                            // Long Paralysis (needs Paralytic)
    bl_6_3:[ {param:'hmK',add:R(0.05)} ],                                                                           // Bleeding Venom (needs Haemotoxin)
    bl_6_4:[ {param:'dr.cb',add:R(0.02)} ],                                                                         // Cool Blood (her group)
    bl_6_1:[ {stat:{move:R(-0.01)},to:{team:'enemy',ust:{syTx:1}},per:{ust:'syTx',of:'target'}} ],                  // Numb Limbs (an aura on enemies with Toxin)
    bl_7_3:[ {on:'out',if:{casting:'counter',targetTeam:'enemy'},more:R(0.015),per:{ust:'syTx',of:'target'}} ],      // Coiled Strike
    bl_7_4:[ {param:'co',add:R(0.02)} ],                                                                            // Cast Off (shed)
    bl_8_1:[ {param:'pot',add:R(0.03)} ],                                                                           // Potent (bite; tHeal)
    bl_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                                 // Fang Rhythm
    bl_8_3:[ {on:'out',if:{crit:true,targetTeam:'enemy',fn:'venT'},critMore:R(0.02)} ],                              // Deadly Grace (at most 10%)
    bl_9_1:[ {param:'spv',add:1} ],                                                                                 // Spreading Venom (died)
    bl_9_2:[ {param:'av',add:R(0.01)} ],                                                                            // Antivenom (myHit; the heal budget)
    bl_9_3:[ {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:R(0.01),per:{ust:'syTx',of:'target'}} ],             // Venom Dance
    bl_9_4:[ {param:'shA',add:1} ],                                                                                 // Shed Again (tk)
    bl_10_1:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.5},more:R(0.02)} ],                                   // Bitter Blood
    bl_10_2:[ {stat:{aspd:R(0.015)},if:{fn:'tgtVen'}} ],                                                            // Viper's Speed
    bl_11_1:[ {stat:{lifesteal:R(0.002)},per:{fn:'fgN'}} ],                                                         // Full Glands (tk counts the Toxin within 3 m)
    bl_11_2:[ {param:'vr',add:1} ],                                                                                 // Venom Ribbon (rupt)
    bl_11_3:[],                                                                                                     // Precise Fangs (critP)
    bl_n2:[  {param:'ld',add:1} ],                                                                                  // Last Dancer (vrN)
    bl_12_1:[ {param:'tx.max',add:R(1)} ],                                                                          // Lingering Bite
    bl_12_2:[ {stat:{atk:R(0.01)},per:'syPp'} ],                                                                    // Patient Poison (died)
    bl_12_3:[ {param:'dry',add:R(0.05)} ],                                                                          // Dry Fangs (bite)
    bl_12_4:[ {stat:{mr:R(0.03)},if:{fn:'tox5'}} ],                                                                 // Skin of the Dancer
    bl_13_2:[ {param:'cgt',add:1} ],                                                                                // Cannot Gather Themselves (SIGNATURE: toxAdd / cgt)

    /* ============================== THE THICK OF THE CROWD ============================== */
    tc_1_1:[ {stat:{aspd:R(0.004)},per:'syCr'} ],                                                                   // Thick Crowd (Crowd: tk)
    tc_3_3:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.02)} ],                                               // Through the Gaps
    tc_1_4:[ {param:'tied',add:R(0.10)} ],                                                                          // Tied with Ribbon (rfCast; myHit)
    tc_2_1:[ {param:'dr.pb',add:R(0.01)} ],                                                                         // Press of Bodies (her group)
    tc_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Sway
    tc_3_1:[ {param:'tet',add:0.5} ],                                                                               // Touch Each of Them (myHit)
    tc_2_2:[ {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:R(0.03)} ],                                          // Wide Swing
    tc_3_4:[ {param:'td.dur',add:R(0.4)} ],                                                                         // Knotted
    tc_n1:[  {param:'lco',add:R(0.06)} ],                                                                           // Loose Coils (slowK)
    tc_4_3:[ {stat:{nrg:R(0.01)},per:'syCr'} ],                                                                     // Crowd Energy
    tc_4_2:[ {on:'kit',skill:SD,opt:{radius:{addM:R(0.2)}}} ],                                                       // Wider Orbit
    tc_6_1:[ {param:'dr.er',add:R(0.03)} ],                                                                         // Elbow Room (her group)
    tc_7_3:[ {on:'out',if:{casting:RF,targetTeam:'enemy'},more:R(0.03)} ],                                          // Ribbon Lash
    tc_5_4:[ {stat:{move:R(-0.02)},to:{team:'enemy',has:'syTd'}} ],                                                 // Tangled (an aura on Tied enemies)
    tc_7_4:[ {param:'kp',add:R(0.5)} ],                                                                             // Knot Pull (myHit)
    tc_6_4:[ {param:'dr.rb',add:R(0.02)} ],                                                                         // Ribbon Bind (both groups)
    tc_7_1:[ {param:'nwl',add:R(0.01)} ],                                                                           // Never Where It Lands (dodgeP)
    tc_8_2:[ {on:'cd',skill:'blue',add:R(-0.1)} ],                                                                  // Quick Hood
    tc_9_4:[ {param:'bt',add:1} ],                                                                                  // Bound Together (rfPass)
    tc_9_2:[ {stat:{aspd:R(0.03)},if:{fn:'tgtTied'}} ],                                                             // Thread Through
    tc_8_1:[ {param:'cr.max',add:R(1)} ],                                                                           // Packed Tight
    tc_5_2:[ {on:'kit',skill:SD,opt:{spins:{set:5}}} ],                                                             // Fifth Turn (PICK ONE)
    tc_5_3:[ {param:'sfl',add:1} ],                                                                                 // Saved for Last (PICK ONE: sdPass)
    tc_8_3:[ {on:'out',if:{crit:true,targetTeam:'enemy'},critMore:R(0.008),per:{fn:'botcN'}} ],                      // Bite of the Crowd (at most 10%)
    tc_9_1:[ {param:'ot',add:1}, {on:'out',if:{casting:SDP,targetTeam:'enemy'},more:0.06,per:{fn:'otN'}} ],          // The Old Tune (sdKit)
    tc_6_2:[ {on:'out',if:{casting:SDP,targetTeam:'enemy',fn:'pass5'},more:R(0.04)} ],                               // Long Dance (needs Fifth Turn)
    tc_6_3:[ {param:'wl',add:R(0.02)} ],                                                                            // Weakest Last (needs Saved for Last: sdPass; the heal budget)
    tc_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.4},more:R(0.02)} ],                                    // Dance Floor
    tc_10_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ],                                           // Swirl
    tc_11_1:[ {stat:{lifesteal:R(0.003)},per:'syCr'} ],                                                             // Crowd Pleaser
    tc_11_2:[ {param:'rdn',add:1} ],                                                                                // Ribbon Dance (sdPass)
    tc_11_3:[],                                                                                                     // Steel Edged (critP)
    tc_12_1:[ {param:'cr.extra',add:R(1)} ],                                                                        // Thick Enough (tk)
    tc_12_2:[ {param:'awr',add:1}, {on:'out',if:{targetTeam:'enemy'},more:R(0.003),per:'syAr'} ],                    // All the Way Round (sdPass)
    tc_12_3:[ {param:'tw',add:R(0.02)} ],                                                                           // Tight Weave (tIn)
    tc_12_4:[ {param:'dr.ht',add:R(0.02)} ],                                                                        // Hidden in the Throng (her group)
    tc_13_2:[ {param:'wtr',add:1} ]                                                                                 // The Whole Tune Round (SIGNATURE: tk / sdKit / sdPass)
  },
  needs:{ ct_6_2:'ct_5_2', ct_6_3:'ct_5_3', bl_6_2:'bl_5_2', bl_6_3:'bl_5_3', tc_6_2:'tc_5_2', tc_6_3:'tc_5_3' },
  fn:{
    /* ---- EACH TICK: her countdowns, the heal budget, Crowd (one walk over the enemies), the Energy watch, Shed Skin ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), r=T.r, Pp=T.P, dt=c.dt||0, M=E.METER(); o.api=A;   // the runtime API kept for the tests' and the 95% probe's pure reads (drK, critP)
      if(o.f==null) o.f={cr:CROWD.some(id=>r[id]), fg:!!r.bl_11_1, nw:!!(r.bl_2_1||r.bl_3_1), sh:!!r.bl_1_4, hb:HEALS.some(id=>r[id])};
      const f=o.f;
      for(const k of ['nnCd','cgCd','wtCd','te']) if(o[k]>0) o[k]-=dt;                                            // the signatures' 20 s and Thick Enough's 5 s, as countdowns (the fight clock restarts each wave)
      if(f.hb){ const cap=REGEN*(u.maxHp||0); o.rg=Math.min(10*cap,(o.rg==null?cap:o.rg)+cap*dt); }              // the heal budget fills at 1.2% of her max HP a second (at most 10 s kept)
      if(f.cr||f.fg){ let n=0, g=0; for(const x of enemies(A,u)){ const gp=A.gap(u,x); if(f.cr&&gp<CR_M*M) n++; if(f.fg&&gp<3*M) g+=tox(A,T,u,x); }
        if(f.fg) o.fg=Math.min(10,g);
        if(f.cr){ const mx=5+(Pp['cr.max']||0); o.crMax=mx; o.cr=Math.min(mx,n+((o.te>0)?(Pp['cr.extra']||0):0)); A.stSet(T,u,'syCr',o.cr);
          if(Pp.wtr&&o.cr>=3&&!(o.wtCd>0)&&u.alive){ o.wtCd=CD_SIG; u.energy=100; o.wtrArm=true; } } }               // The Whole Tune Round: at 3 or more Crowd, Serpent's Last Dance comes ready at once
      if(f.nw) T.fn.nrgWatch(A,T,u);
      if(f.sh){ const low=u.hp<0.4*u.maxHp; if(low&&!o.shWas&&(o.shN||0)<(Pp.shA?2:1)){ o.shN=(o.shN||0)+1; T.fn.shed(A,T,u); } o.shWas=low; } },   // Shed Skin: once a wave (twice with Shed Again), when she drops below 40% HP
    wv(A,T,u,c){ const o=S(T); o.shN=0; o.shWas=false; o.first=true; o.te=5; o.blow=null; o.sw=null; o.sdc={}; o.ev={}; o.wtrArm=false; },
    /* ---- HER COUNT (the game's own Venom Rhythm counter u._vrN, at the swing). vrN: the num hook asks for the count's length before the counter moves:
       3 (Long Count: 4). During Never Heard a Note (and for Last Dancer) every swing is a Three that bites: 1. Fang on Two: the Two also bites (her own venom) ---- */
    vrN(A,T,u,c){ const o=S(T), Pp=T.P, M=Pp.lc?4:3;
      if(A.winOn(T,'syNn')||(Pp.ld&&T.fn.alone(A,T,u))){ o.sw={beat:3,bite:true,tal:false,s:Pp.f2?0.6:1,all:true}; c.amt=1; return; }
      const nx=((u._vrN||0)+1)%M, beat=nx===0?M:nx, two=!!Pp.f2&&beat===2;
      o.sw={beat,bite:nx===0||two,tal:two,s:Pp.f2?0.6:(Pp.lc?1.4:1),all:false}; c.amt=M; },
    vrPass(A,T,u,c){ const o=S(T), Pp=T.P, sw=o.sw, t=c.tgt, M=Pp.lc?4:3; o.sw=null; if(!sw) return;
      o.blow={beat:sw.beat,bite:sw.bite,t:t||null,all:sw.all};                                                      // this swing's blow (it lands later): One, Two, Three, Four, a bite
      if(t&&t.alive&&sw.bite){ if(sw.tal) T.fn.venom(A,T,u,t,sw.s); T.fn.bite(A,T,u,t,sw.s); }
      if(Pp.nm) gainE(u,11*Pp.nm);                                                                                  // Night Market: 3% x 3 more of the 11 Energy a basic attack gives
      if(sw.beat===3) T.fn.three(A,T,u,t);
      if(sw.beat===M||sw.all) T.fn.full(A,T,u);
      let k=1; if(!A.winOn(T,'syNn')){ const nx=((u._vrN||0)+1)%M, nb=nx===0?M:nx;                                 // the NEXT swing comes sooner: the wait before it is shorter
        if(nb===1&&Pp.pc&&T.fn.partner(A,T,u)) k*=1-Pp.pc;                                                          // Partner's Count (its One)
        if(nb===2&&Pp.two) k*=1-Pp.two; }                                                                           // Two
      if(Pp.rk&&o.first) k*=1-Pp.rk;                                                                                // Rocking on His Heels: the swings of the first count of the wave
      if(k<1) u.atkCd=(u.atkCd||0)*k; },
    /* a Three beat (a swing, or Hood Up's counter): Tune in Threes, She Still Counts, Never Heard a Note */
    three(A,T,u,t){ const o=S(T), Pp=T.P;
      if(Pp.tit) T.fn.heal(A,T,u,Pp.tit*u.maxHp);
      if(rk(T,'ct_12_2')) A.acts(T,u,[{stack:'sySc',add:1}],{u});
      if(Pp.nn&&!(o.nnCd>0)&&!A.winOn(T,'syNn')){ o.nnCd=CD_SIG; A.acts(T,u,[{window:'syNn',dur:6}],{u}); o.nnRead=true; } },   // Never Heard a Note: every swing a Three for 6 s, the first enemy that attacks her Read at once
    /* a full count (her Three, Long Count's Four, every swing of the signature's 6 s): Rhythm of the Pipe, Sway Away; the wave's first count is over */
    full(A,T,u){ const o=S(T), Pp=T.P; o.first=false;
      if(Pp.rp) A.acts(T,u,[{window:'syRp',dur:3}],{u});
      if(Pp.swa) A.acts(T,u,[{window:'sySw',dur:2}],{u}); },
    partner(A,T,u){ const t=u.target; if(!t||!t.alive) return false; const L=A.eng().units().filter(x=>x.team===u.team&&!x._summon), i=L.indexOf(u);   // the ally beside her in the line-up (either side)
      for(const x of [L[i-1],L[i+1]]) if(x&&x.alive&&x.target===t) return true; return false; },
    alone(A,T,u){ return !A.eng().units().some(x=>x!==u&&x.alive&&x.team===u.team&&!x._summon); },               // Last Dancer: the last hero of her side standing
    /* ---- A BITE (Venom Rhythm's venom on t, strength s: 1, Fang on Two 0.6, Long Count's Four 1.4) ---- */
    venom(A,T,u,t,s){ const pm=u.passMul||1;                                                                         // a bite of her own (Fang on Two's Two, Last Beat, the crowd signature, Hood Up): the game's venom, written as the passive writes it
      t.mortalT=Math.max(t.mortalT||0,VEN); t._nrgSlowT=Math.max(t._nrgSlowT||0,VEN); t._nrgSlowPct=Math.max(t._nrgSlowPct||0,0.4*pm*Math.min(1,s)); },
    bite(A,T,u,t,s){ const o=S(T), Pp=T.P, D=VEN+(Pp['vn.dur']||0), pm=u.passMul||1;
      if(Pp['vn.dur']){ t.mortalT=Math.max(t.mortalT||0,D); t._nrgSlowT=Math.max(t._nrgSlowT||0,D); }               // Sure Bite: the venom lasts 0.2 s x 5 longer
      const es=s*(1+(Pp.dry||0)); if(es>1+1e-9) t._nrgSlowPct=Math.max(t._nrgSlowPct||0,Math.min(0.95,0.4*pm*es));   // Long Count's Four, Dry Fangs: its Energy slow stronger
      o.vs[t.uid]=Math.min(0.95,CUT*s*(1+(Pp.pot||0))); A.setMark(T,u,t,'syV',{dur:D});                             // its healing cut (tHeal reads it), and "venomed"
      if(Pp.hm) A.acts(T,u,[{dot:'syHm',on:'target',amt:{pct:0.10*(1+(Pp.hmK||0)),of:'atk'},dur:D,every:1,refresh:true,color:'#8f3f5c'}],{u,src:u,tgt:t});   // Haemotoxin: a talent bleed (its stated amount, no armor)
      if(toxOn(T,o)) T.fn.toxAdd(A,T,u,t,1,'bite'); },
    tox1(A,T,u,c){ if(c.tgt&&c.tgt.alive) T.fn.toxAdd(A,T,u,c.tgt,1,null); },                                       // Seeping Cut
    /* Toxin gained: by a bite ('bite'), by a basic attack on an enemy under her venom ('hit'), or by anything else (null: a spread, Seeping Cut, a counter) */
    toxAdd(A,T,u,t,n,why){ const o=S(T), Pp=T.P, mx=T.st.syTx.max; if(!t||!t.alive||!(n>0)) return;
      const nw=Math.min(mx,tox(A,T,u,t)+n); A.ustPut(T,u,t,'syTx',nw);
      if(!why) return;
      if(why==='bite'&&Pp.cgt&&!(o.cgCd>0)&&nw>=mx) T.fn.cgt(A,T,u,t);                                                // Cannot Gather Themselves: a bite leaves it at full Toxin
      if(Pp.par&&t.alive&&tox(A,T,u,t)>=5) T.fn.para(A,T,u,t); },                                                     // Paralytic: one of her bites or basic attacks brings it to 5
    /* the stun-lock rule: her talent stun never lands on a stunned enemy, nor within 0.5 s after one of her stuns on it ended (mark syLk) */
    para(A,T,u,t){ const o=S(T); if((t.stunned||0)>0||A.markOf(u,t,'syLk')) return; const d=T.P.par, s0=t.stunned||0;
      A.control(T,u,t,'stunned',d); const got=(t.stunned||0)>s0+1e-9; if(!got) return;
      A.setMark(T,u,t,'syLk',{dur:t.stunned+0.5}); (o.stL||(o.stL=[])).push([t.uid,t.stunned]); A.ustPut(T,u,t,'syTx',0); },
    cgt(A,T,u,t){ const o=S(T), E=A.eng(), M=E.METER(), mx=T.st.syTx.max; o.cgCd=CD_SIG; o.cgN=(o.cgN||0)+1;
      const L=[t].concat(enemies(A,u).filter(x=>x!==t&&A.gap(t,x)<3*M));
      for(const x of L){ x.energy=0; A.setMark(T,u,x,'syNh',{dur:4}); A.ustPut(T,u,x,'syTx',mx); if(o.ev) delete o.ev[x.uid]; } },
    /* Energy an enemy gains (each tick, what it gained since its last tick): Thick Venom (2% x 3 less per Toxin), Gathered Nothing (none at 5 Toxin) */
    nrgWatch(A,T,u){ const o=S(T), Pp=T.P, ev=o.ev||(o.ev={});
      for(const x of A.eng().units()){ if(!x.alive||x.team===u.team){ delete ev[x.uid]; continue; } const n=tox(A,T,u,x); if(!(n>0)){ delete ev[x.uid]; continue; }
        const k=(Pp.gn&&n>=5)?0:Math.max(0,1-(Pp.tv||0)*n), e=x.energy||0, l=ev[x.uid]; if(l!=null&&e>l+1e-9) x.energy=l+(e-l)*k; ev[x.uid]=x.energy||0; } },
    /* healing on an enemy: the signature's 4 s receive nothing; under her venom the game's half becomes her venom's own cut (Potent, Long Count stronger;
       Fang on Two weaker, only while her venom is the wound that lasts longest on it) */
    tHeal(A,T,u,c){ const o=S(T), x=c.unit; if(!foe(u,x)) return;
      if(A.markOf(u,x,'syNh')){ c.amt=0; return; }
      const m=A.markOf(u,x,'syV'); if(!m||!((x.mortalT||0)>0)) return; const cut=o.vs[x.uid]; if(cut==null) return;
      if(cut>CUT+1e-9||(cut<CUT-1e-9&&(x.mortalT||0)<=(m.until-A.eng().now())+0.05)) c.amt*=(1-cut)/(1-CUT); },
    died(A,T,u,c){ const x=c.unit; if(!foe(u,x)) return; const n=tox(A,T,u,x); if(!(n>0)) return;
      if(rk(T,'bl_12_2')) A.acts(T,u,[{stack:'syPp',add:1}],{u});                                                   // Patient Poison
      if(T.P.spv&&n>=5){ let b=null, bd=Infinity; for(const y of enemies(A,u)){ if(y===x) continue; const d=A.gap(x,y); if(d<bd){ bd=d; b=y; } } if(b) T.fn.toxAdd(A,T,u,b,n,null); } },   // Spreading Venom
    /* ---- SHED SKIN: every effect on her ends (the game's full cleanse, and the Energy slow, armour and magic-resist cuts, the hex, the heal cut, a taunt);
       she heals 4% x 3 of her max HP; New Scales, Sloughing; Cast Off on her nearest ally ---- */
    clean(A,T,u,x){ A.acts(T,u,[{cleanse:'all',on:'unit'}],{u,unit:x}); x._nrgSlowT=0; x._shredT=0; x._mrShredT=0; x._gearArmorCutT=0; x._hexUntil=0; x._healCutUntil=0; x._atkDnT=0; x.forcedTargetT=0; },
    shed(A,T,u){ const o=S(T), Pp=T.P, E=A.eng(); o.shedN=(o.shedN||0)+1; T.fn.clean(A,T,u,u); E.healUnit(u,(Pp.shed||0)*u.maxHp);
      if(Pp['dr.ns']) A.acts(T,u,[{window:'syNs',dur:5}],{u});
      if(Pp.slo) A.acts(T,u,[{window:'sySl',dur:5}],{u});
      if(Pp.co){ let b=null, bd=Infinity; for(const x of E.units()){ if(x===u||!mate(u,x)) continue; const d=A.gap(u,x); if(d<bd){ bd=d; b=x; } } if(b){ T.fn.clean(A,T,u,b); E.healUnit(b,Pp.co*b.maxHp); } } },
    /* ---- READ: an enemy that swings at her twice within 4 s (Learned Body longer) is Read; its third swing at her misses and she counters from its flank ---- */
    aim(A,T,u,c){ const o=S(T), s=c.src; o.rdHit=null; if(!foe(u,s)||A.markOf(u,s,'syRd')) return;
      if(o.nnRead&&A.winOn(T,'syNn')){ o.nnRead=false; T.fn.read(A,T,u,s); return; }                                 // Never Heard a Note: the first enemy that attacks her is Read at once
      if(!rk(T,'ct_1_4')) return;
      if(A.markOf(u,s,'syA1')){ A.clearMark(u,s,'syA1'); T.fn.read(A,T,u,s); } else A.setMark(T,u,s,'syA1',{dur:4+(T.P['rd.win']||0)}); },
    read(A,T,u,s){ const o=S(T); A.setMark(T,u,s,'syRd',{}); o.rdHit=s; o.readN=(o.readN||0)+1;   // rdHit: the swing that made the Read lands (its THIRD swing misses)
      if(T.P['dr.ln']) A.setMark(T,u,s,'syLn',{dur:3}); },   // He Always Leaned In: 3 s weaker from the Read
    readMiss(A,T,u,c){ const o=S(T); if(o.rdHit&&o.rdHit===c.src) return false; return foe(u,c.src)&&!!A.markOf(u,c.src,'syRd'); },
    canRoll(A,T,u,c){ return !c.dodged; },
    readGo(A,T,u,c){ const o=S(T), s=c.src, E=A.eng(); A.clearMark(u,s,'syRd'); A.setMark(T,u,s,'syRdA',{dur:3}); o.missN=(o.missN||0)+1;
      if(T.P.mm) u.blueCd=Math.max(0,(u.blueCd||0)-T.P.mm);                                                           // Mistake Made: Hooded Feint's cooldown 2 s shorter
      const a=(T.P.rd||0)*atkNow(A,u); if(!(a>0)||!s.alive||!u.alive||!E.strike) return;
      const st=T.s, d=st.d, cur=st.cur, ct=u._ctring; st.d=0; st.cur=RD; u._ctring=1;                               // the counter is a real hit of hers (it can crit; her out / hit rows see it as Read's counter)
      try{ E.strike(u,s,a,'#5ee89b'); } finally{ st.d=d; st.cur=cur; u._ctring=ct; }
      if(rk(T,'ct_n1')&&rk(T,'bl_1_1')&&s.alive) T.fn.toxAdd(A,T,u,s,1,null); },                                     // Venomed Answer, with Venom Sac: a Toxin
    /* ---- HOOD UP: Hooded Feint's counter counts as her Three beat (a guaranteed critical with Three, Coil Tight, a bite, the Three beat's talents) ---- */
    ctrPre(A,T,u,c){ S(T).hu=true; },
    ctrLand(A,T,u,c){ const o=S(T), t=c.tgt; o.hu=false; if(t&&t.alive){ T.fn.venom(A,T,u,t,1); T.fn.bite(A,T,u,t,1); } T.fn.three(A,T,u,t); },
    /* ---- RIBBON FANG ---- */
    rfKit(A,T,u,c){ const o=S(T); o.rfN=(o.rfN||0)+1; },
    rfCast(A,T,u,c){ const t=c.tgt; if(t&&t.alive&&rk(T,'tc_1_4')) T.fn.tie(A,T,u,t); },                            // Tied with Ribbon: its target is Tied
    rfPass(A,T,u,c){ const t=c.tgt; if(!t) return; A.acts(T,u,[{tagDots:'syRf',last:true,on:'target'}],c);           // the wound just pushed is hers (Wider Wound, Rot in the Wound)
      if(!T.P.bt||!t.alive) return; const D=t.dots, d=D&&D[D.length-1]; if(!d||d._talO!==u.uid) return;               // Bound Together: the same wound on every Tied enemy within 2 m of its target
      A.acts(T,u,[{copyDot:'syBt',on:{team:'enemy',of:'target',within:2,has:'syTd',skip:'target'}}],Object.assign({},c,{dot:d})); },
    rupt(A,T,u,c){ const t=c.tgt, n=tox(A,T,u,t); if(!(n>0)) return;                                                // Venom Ribbon: its rupture spreads all its Toxin to every enemy within 2 m
      for(const x of enemies(A,u)) if(x!==t&&A.gap(t,x)<2*A.eng().METER()) T.fn.toxAdd(A,T,u,x,n,null); },
    tie(A,T,u,t){ A.setMark(T,u,t,'syTd',{dur:6+(T.P['td.dur']||0)}); },
    /* ---- SERPENT'S LAST DANCE: at the cast (kit), then each pass of the star on each enemy (partPre / part 'sdPass') ---- */
    sdKit(A,T,u,c){ const o=S(T); o.sdc={}; o.otN=T.P.ot?(o.cr||0):0;
      if(o.wtrArm){ o.wtrArm=false; o.wtr=true; c.o.dur=(c.o.dur||2.4)*0.5; } else o.wtr=false; },                  // The Whole Tune Round: this cast's star circles twice as fast
    sdPre(A,T,u,c){ const o=S(T), e=c.tgt; if(!e) return; o.sdN=(o.sdc[e.uid]=(o.sdc[e.uid]||0)+1); },
    sdPass(A,T,u,c){ const o=S(T), Pp=T.P, e=c.tgt; if(!e) return; const n=o.sdc[e.uid]||1; o.sdN=0;
      if(n===1&&Pp.awr) A.acts(T,u,[{stack:'syAr',add:1}],{u});                                                     // All the Way Round: each enemy it strikes
      if(!e.alive) return;
      if(Pp.rdn||o.wtr) T.fn.tie(A,T,u,e);                                                                            // Ribbon Dance, The Whole Tune Round: Tied
      if((o.wtr&&n===1)||(Pp.lb&&n%3===0)){ T.fn.venom(A,T,u,e,1); T.fn.bite(A,T,u,e,1); }                          // The Whole Tune Round: bitten; Last Beat: its third pass bites it
      let ex=false; if(e.hp<0.10*e.maxHp) ex=true;                                                                    // the game executes it on the next line
      else if(Pp.sfl&&!boss(e)&&e.hp<0.15*e.maxHp){ A.acts(T,u,[{kill:true,on:'target'}],{u,src:u,tgt:e}); ex=true; }   // Saved for Last: under 15% (a boss only under 10%, as the skill)
      if(ex){ o.exN=(o.exN||0)+1; if(Pp.wl&&Pp.sfl) T.fn.heal(A,T,u,Pp.wl*u.maxHp); } },                             // Weakest Last
    /* ---- AFTER EACH HIT OF HERS ---- */
    myHit(A,T,u,c){ const o=S(T), Pp=T.P, t=c.tgt; if(!t) return;
      if(c.auto){ if(Pp.vh&&venomed(A,T,u,t)) gainE(u,11*Pp.vh);                                                    // Venom Hunger
        if(toxOn(T,o)&&t.alive&&A.markOf(u,t,'syV')) T.fn.toxAdd(A,T,u,t,1,'hit'); }                                     // Toxin: each of her basic attacks on an enemy under her venom adds 1 more
      if(Pp.av&&venomed(A,T,u,t)&&c.hpLost>0) T.fn.heal(A,T,u,Pp.av*c.hpLost);                                     // Antivenom
      if(Pp.tied&&(c.amt||0)>0&&tied(A,u,t)) A.acts(T,u,[{dmg:{pct:Pp.tied,of:'hit'},on:{team:'enemy',of:'target',within:2+(Pp.kp||0),n:1,skip:'target'}}],c);   // Tied: the nearest other enemy takes 10% x 3 of the hit
      if(c.auto&&Pp.tet&&(o.cr||0)>=3&&t.alive) A.acts(T,u,[{dmg:{pct:Pp.tet,of:'atk'},def:'phys',on:{team:'enemy',of:'target',within:2,n:1,skip:'target'}}],c); },   // Touch Each of Them
    /* ---- small reads for rows ---- */
    isOne(A,T,u,c){ const b=S(T).blow; return !!c.auto&&!!b&&b.t===c.tgt&&b.beat===1; },
    isFour(A,T,u,c){ const b=S(T).blow; return !!c.auto&&!!b&&b.t===c.tgt&&b.beat===4; },
    isBite(A,T,u,c){ const b=S(T).blow; return !!c.auto&&!!b&&b.t===c.tgt&&!!b.bite; },
    isThree(A,T,u,c){ const o=S(T), b=o.blow; return (!!c.auto&&!!b&&b.t===c.tgt&&b.beat===3)||(T.s.cur==='counter'&&!!T.P.hu); },
    flank(A,T,u,c){ const t=c.tgt; return T.s.cur===RD||T.s.cur==='counter'||(!!t&&t.target!==u); },                // from its flank or back: it is facing someone else (her counters always)
    rf3(A,T){ return ((S(T).rfN||0)%3)===0; },
    venT(A,T,u,c){ return venomed(A,T,u,c.tgt); },
    tgtVen(A,T,u,c){ return venomed(A,T,u,c.tgt); },
    tgtTied(A,T,u,c){ return tied(A,u,c.tgt); },
    tox5(A,T,u){ for(const x of enemies(A,u)) if(tox(A,T,u,x)>=5) return true; return false; },
    rfBleed(A,T,u,c){ return c.tag==='syRf'||c.tag==='syBt'; },
    myBleed(A,T,u,c){ return c.tag==='syRf'||c.tag==='syBt'||c.tag==='syHm'; },
    fgN(A,T){ return S(T).fg||0; },
    otN(A,T){ return S(T).otN||0; },
    pass5(A,T){ return S(T).sdN===5; },
    botcN(A,T,u){ const r=rk(T,'tc_8_3'); return r?Math.min(S(T).cr||0,0.10/(0.008*r)):0; },                         // Bite of the Crowd: at most 10% in all
    slowK(A,T){ const Pp=T.P; return Math.min(SLOW_CAP,1-(1-(Pp.qf||0))*(1-(Pp.lco||0))); },
    dodgeP(A,T){ const o=S(T), Pp=T.P; let x=0; if(Pp.swa&&A.winOn(T,'sySw')) x+=Pp.swa; if(Pp.nwl&&(o.cr||0)>=2) x+=Pp.nwl; return Math.min(DODGE_CAP,x); },
    /* her critical-chance talents, ONE group, at most 5%: Steel Ribbon, Fang Edge (plain until now), Body Language (Read's counter), Precise Fangs (per Toxin on the
       target), Steel Edged (per Crowd). One seeded roll when the hit is struck (Three's guaranteed critical is an event, outside it) */
    critP(A,T,u,c){ const r=T.r, o=S(T); let x=0.01*(r.ct_11_3||0)+0.01*(r.bl_1_2||0);
      if(r.ct_3_4&&T.s.cur===RD) x+=0.03*r.ct_3_4;
      if(r.bl_11_3) x+=0.004*r.bl_11_3*tox(A,T,u,c.tgt);
      if(r.tc_11_3) x+=0.003*r.tc_11_3*(o.cr||0);
      return Math.min(CRIT_CAP,x); },
    /* ---- HER DAMAGE REDUCTION: ONE capped group, at most 40% (the shares multiply). Hooded Feint's own cut is the game's skill slot, apart ---- */
    drK(A,T,u,c,dot){ const o=S(T), Pp=T.P, s=c.src, tg=u.target; let k=1; const f=x=>{ if(x>0) k*=1-x; };
      if(Pp['dr.sc']&&s&&s===tg) f(Pp['dr.sc']);                                                                    // Scales: the enemy she is attacking
      if(Pp['dr.nh']&&s&&s!==tg) f(Pp['dr.nh']);                                                                    // Nimble Hood: the others
      if(!dot&&Pp['dr.he']&&c.auto) f(Pp['dr.he']);                                                                 // Hooded Eyes: basic attacks
      if(Pp['dr.ll']&&wasRead(A,u,s)) f(Pp['dr.ll']);                                                               // Learned Language
      if(Pp['dr.ln']&&s&&A.markOf(u,s,'syLn')) f(Pp['dr.ln']);                                                      // He Always Leaned In
      if(Pp['dr.ns']&&A.winOn(T,'syNs')) f(Pp['dr.ns']);                                                            // New Scales
      if(Pp['dr.cb']&&venomed(A,T,u,s)) f(Pp['dr.cb']);                                                             // Cool Blood
      if(Pp['dr.pb']) f(Pp['dr.pb']*(o.cr||0));                                                                     // Press of Bodies: per Crowd (one source)
      if(!dot&&Pp['dr.er']&&!c.auto&&(o.cr||0)>=2) f(Pp['dr.er']);                                                  // Elbow Room: skills, at 2 or more Crowd
      if(!dot&&Pp['dr.ht']&&s&&!s.melee) f(Pp['dr.ht']);                                                            // Hidden in the Throng: ranged enemies
      if(Pp['dr.rb']&&tied(A,u,s)) f(Pp['dr.rb']);                                                                  // Ribbon Bind
      return Math.max(DR_FLOOR,k); },
    myIn(A,T,u,c){ if(!foe(u,c.src)) return; c.amt*=T.fn.drK(A,T,u,c,false); },
    myDot(A,T,u,c){ if(!c.src||!foe(u,c.src)) return; c.amt*=T.fn.drK(A,T,u,{src:c.src,kind:'dot',auto:false,crit:false},true); },
    /* hits on her allies (He Always Leaned In and Ribbon Bind: together at most 1 - 0.91 x 0.96 = 12.6%, under any ally cap), and her team's hits on Tied enemies (Tight Weave) */
    tIn(A,T,u,c){ const Pp=T.P, t=c.tgt, s=c.src; if(!t||!s) return;
      if(mate(u,t)&&t!==u&&foe(u,s)){ let k=1; if(Pp['dr.ln']&&A.markOf(u,s,'syLn')) k*=1-Pp['dr.ln']; if(Pp['dr.rb']&&tied(A,u,s)) k*=1-Pp['dr.rb']; c.amt*=k; return; }
      if(foe(u,t)&&s.team===u.team&&Pp.tw&&tied(A,u,t)) c.amt*=1+Pp.tw; },
    /* her own heals from talents (Tune in Threes, Antivenom, Weakest Last) share ONE budget that fills at 1.2% of her max HP a second (at most 10 s kept):
       the regeneration cap. Shed Skin and Cast Off (once or twice a wave) are not in it */
    heal(A,T,u,x){ const o=S(T); if(o.rg==null) o.rg=REGEN*(u.maxHp||0); const g=Math.min(x,o.rg); if(g>0){ o.rg-=g; A.eng().healUnit(u,g); } return g; }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/52 - SEYLA SILKCOIL - talent decisions.md) */
  ruling:{}
};
