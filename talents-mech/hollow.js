/* HOLLOW - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Hollow")
   His real kit (the code, not the tooltip wording; a melee Assassin, every skill reads Attack, his damage is physical):
   - He does not march: each wave he waits OFF the field 5.5 s (_dropHidden, parked off-world), then falls 0.5 s (_fallT, untargetable) and lands behind
     the enemy's deepest unit. His basic attacks hunt the back line (nearestEnemy's _backHunter score: formation depth first).
   - Fan of Knives ('bladefan', green, cd 7): every enemy within 3 m of his CENTRE and inside a 75 degree cone toward his target takes 90% of his attack x skill
     level and a bleed stack (addBleedStack). MEASURED: it reaches nobody (0 of 68 casts in 20 seeded fights: enemies stand 3.2 m+ centre to centre). A fix for
     v1391 on another branch measures to the enemy's body edge; his Fan talents are written for a Fan that lands (rows keyed on its hits).
   - Lacerate ('bleedstack', blue, cd 6): one hit on his target (80% x skill level) and a bleed stack. addBleedStack: each stack is its own bleed DoT (16% of
     his attack each second for 6 s, a game bleed: armor applies), the target's stack count _blStk lapses 6 s after the last; at 3 stacks it RUPTURES:
     190% of his attack (no skill multiplier) and the count clears. Fan and Vanishing Point stacks count too.
   - Vanishing Point (ultimate 'vanishpoint'; ULT_DEF mul 1.2, exec 0.2, chain 3, falloff 0.8, gone 0.9, hop 0.35, range 15 m; HERO_ULT_ART.hollow only the
     art): he is off the field 0.9 s (_vpT, untargetable), then hollowStrike lands behind the deepest enemy (or the one the player aimed at): anything the
     strike would leave under 20% HP is finished outright, else it deals flat damage; a kill buys another hop (0.35 s off) up to 3 strikes, each 0.8x the
     last. Each strike adds a bleed stack.
   - The Space He Isn't In (passive 'notthere'): a banked miss, ready every 4 s - 0.01 s a skill level (3.01 s at 100; its clock stands still while he is
     stunned). The next blow aimed at him while it is ready never lands (any blow: basic attack, ability, true damage; not a DoT). He heals 10% of the
     damage his hits deal.
   Contract, Dusk, Clean Work, knives, All the Others, the shadow shield, Misdirect, Forgotten and Intervals exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/28 - HOLLOW - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const FAN='bladefan', LAC='bleedstack', VP='vanishpoint';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const CT=['co_1_1','co_2_1','co_3_1','co_4_1','co_5_2','co_5_3','co_7_2','co_n2','co_n3','co_12_1','co_12_2','co_12_4','co_13_2'];   // the Contract
const DUSK=['co_1_4','co_3_4','co_5_4','co_8_4','co_9_4','co_13_2'];                                                                // Dusk
const LAND=DUSK.concat(['co_11_4']);                                                                                                 // "his first strike after he lands"
const CWK=['co_2_2','co_4_2','co_6_2','co_11_2','co_10_2'];                                                                          // Clean Work
const KN=['ec_1_1','ec_2_1','ec_3_1','ec_6_1','ec_8_1','ec_9_1','ec_n2','ec_7_1','ec_12_3','ec_13_2'];                              // knives (Knife Left In)
const BL=['ec_1_4','ec_3_3','ec_6_2','ec_12_1','ec_9_3','ec_12_2','ec_7_3','ec_8_2','ec_8_3','ec_10_1','ec_3_1','ec_2_2','ec_4_2','ec_5_3','ec_10_2','ec_11_2','ec_13_2'];   // his bleeds made his (tag 'bl')
const ATO=['ec_2_2','ec_4_2','ec_10_2','ec_11_2'];                                                                                   // All the Others
const SHS=['ec_1_4','ec_3_4','ec_6_4','ec_5_4','ec_7_4','ec_11_4','ec_12_4'];                                                        // the shadow shield
const MD=['sb_1_1','sb_2_1','sb_3_1','sb_7_1','sb_n1','sb_9_1','sb_6_1','sb_13_2'];                                                  // Misdirect
const FG=['sb_1_4','sb_3_4','sb_12_3','sb_7_3','sb_8_3','sb_5_4','sb_9_4','sb_7_4','sb_13_2'];                                       // Forgotten
const IV=['sb_2_2','sb_4_2','sb_10_1','sb_8_2','sb_11_3','sb_12_1','sb_11_2','sb_13_2'];                                             // Intervals
const MISS=MD.concat(FG,IV,['sb_11_1','sb_12_2','sb_6_2','sb_6_3','sb_5_2','sb_5_3','sb_10_2']);                                    // rows on his passive's misses
const BANK=IV.concat(['sb_10_2','sb_13_2']);                                                                                         // a blow made to miss as his passive does
const CRIT=['co_1_3','sb_8_1','co_4_2','ec_12_3','sb_7_3','co_11_4','co_12_3','co_3_1'];                                             // his crit-chance talents: ONE capped group (5%)
const DRG=['co_n1','co_6_1','co_11_2','ec_5_4','sb_6_4','sb_9_2','sb_9_4','sb_12_3'];                                               // his damage reduction on hits: ONE capped group (40%)
const ENM={team:'enemy'};
const atk=(A,T,u,c)=>A.amtOf(T,u,{pct:1,of:'atk'},c);
const rk=(T,id)=>T.r[id]||0;
const S=T=>T.s.ho||(T.s.ho={});                                     // his own per-fight state (one object: no name of the runtime's own is ever used)
const isBoss=x=>!!((x.t&&x.t.isboss)||x._raidBoss);
const dep=(A,x)=>{ const E=A.eng(); return (x&&E.depth)?(+E.depth(x.key)||0):1; };
const back=(A,x)=>dep(A,x)>=3;                                       // the enemy back rank: the game's own back row (formation depth 3.4)
const front=(A,x)=>dep(A,x)<=1.4;                                    // the front row: tanks (0) and bruisers (1.35)
const off=u=>!!(u._dropHidden||(u._fallT||0)>0||(u._vpT||0)>0);     // off the field: his hidden entrance (waiting above, the fall) and Vanishing Point
const holder=(A,T,u)=>{ const h=T.s.m.ct; return (h&&h.alive&&A.markOf(u,h,'ct'))?h:null; };
const shHeld=(T,u)=>{ const o=S(T); return (o.sh||0)>0&&(u.shield||0)>0; };
/* his bleeds on a unit: the DoTs his rows made his (tag 'bl') */
function myBleeds(u,x){ const out=[]; if(!x||!x.dots) return out; for(const d of x.dots) if(d._talO===u.uid&&d._talK==='bl'&&d.remaining>0) out.push(d); return out; }
const bleedLeft=(u,x)=>{ let m=0; for(const d of myBleeds(u,x)) m=Math.max(m,(d.remaining-1+(d._talF!=null?d._talF:1))*(d.interval||1)); return m; };
/* his talent stuns, at their full written length on the fixed path (no resist roll): never on an enemy that is stunned now, nor on one whose last stun from
   him ended less than 0.5 s ago (mark 'lk'): Thrown Back repeats on every Misdirect */
function tstun(A,T,u,L,secs){ for(const t of L){ if(!t||!t.alive||t.team===u.team) continue; if((t.stunned||0)>0||A.markOf(u,t,'lk')) continue;
    A.control(T,u,t,'stunned',secs); if((t.stunned||0)>0) A.setMark(T,u,t,'lk',{dur:t.stunned+0.5,longest:true}); } }
module.exports={
  hero:'hollow',
  times:['ho.rdyT','ho.kT','ho.nrT','ho.shT'],   // this file's own absolute fight times (paths in T.s): the engine moves them back with the clock at each wave (WIRING/41c)
  casting:true,                         // rows ask which of his skills a hit comes from
  hide:'fg',                            // an enemy carrying his mark 'fg' (Forgotten) cannot pick him as its target (the page's nearestEnemy: hideFrom)
  watch:['co_n3','co_12_2','co_3_1'],   // the deaths of watched units (Blood Owed: an ally's killer; Reputation, Sealed: the Contract's death)
  states:{
    dusk:{max:P('dusk.max',10)},                                    // Dusk (stays until spent)
    cw:{max:5,wave:'reset'},                                        // Clean Work (this wave)
    rep:{max:3},                                                    // Contracts completed this fight (Reputation)
    iv:{max:P('iv.max',2)},                                         // stored Intervals
    pol:{max:10,wave:'reset'},                                      // blows that missed him this wave (Polite)
    eo:{max:10,wave:'reset'},                                       // ruptures this wave (Every One Opens)
    kn:{unit:true,max:P('kn.max',3),dur:6}                          // knives left in an enemy
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                   // Dusk, Intervals, the shadow shield, the Contract's signature, Clean Work's count
    {on:'wave',reqAny:CT,do:[{fn:'ctPick'}]},                                                                     // the Contract: written in at each wave's start
    {on:'out',reqAny:LAND,if:{targetTeam:'enemy'},do:[{fn:'landOut'}]},                                           // his first strike after he lands (Dusk spent)
    {on:'crit',reqAny:CRIT,if:{targetTeam:'enemy'},do:[{fn:'crit'}]},                                             // his crit-chance talents (one capped group) and Sealed
    {stat:{crit:1},reqAny:CRIT,per:{fn:'critS'}},
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                        // his damage reduction talents: one capped group
    {on:'dotIn',reqAny:['sb_2_2','sb_10_1'],do:[{fn:'ivDr'}]},                                                     // Between Beats, Nothing Lands: damage over time while Intervals are stored (20% at most)
    {on:'hurt',reqAny:CWK,do:[{fn:'hitMe'}]},                                                                     // Clean Work: who has hit him
    {on:'kill',reqAny:CWK,dots:true,if:{targetLacks:'hm'},do:[{fn:'cwGain'}]},
    {on:'waveEnd',reqAny:['co_10_2'],do:[{fn:'urEnd'}]}, {on:'wave',reqAny:CWK,do:[{fn:'urStart'}]},
    {on:'hit',reqAny:['sb_9_2'],if:{targetTeam:'enemy'},do:[{mark:'ht',on:'target'}]},                           // Unwritten: the enemies he has hit
    {on:'pass',skill:'bleedstack',reqAny:BL.concat(KN),do:[{fn:'bleed'}]},                                        // his bleed stacks made his ('bl'), with the knives' fade
    {on:'kit',skill:FAN,reqAny:KN.concat(['ec_7_3','sb_10_2']),do:[{fn:'fanKit'}]},
    {on:'hit',reqAny:KN,if:{casting:FAN,targetTeam:'enemy'},do:[{fn:'fanHit'}]},                       // Knife Left In: each Fan knife that hits
    {on:'cast',skill:FAN,reqAny:KN.concat(['ec_7_3','ec_n2','sb_10_2']),do:[{fn:'fanCast'}]},
    {on:'hit',reqAny:KN,if:{casting:LAC,targetTeam:'enemy'},do:[{fn:'pull'}]},                                    // Lacerate pulls the knives out
    {on:'part',skill:'rupture',reqAny:ATO,do:[{fn:'ato'}]},                                                       // All the Others
    {on:'heal',reqAny:SHS,procs:true,if:{overMin:0},do:[{fn:'shAdd'}]},                                           // the shadow shield: healing past his full HP
    {on:'shieldBreak',reqAny:['ec_12_4'],do:[{fn:'shBreak'}]},
    {on:'bankPre',reqAny:BANK,do:[{fn:'bankPre'}]},                                                               // a blow made to miss as his passive does (an Interval, Knife Screen)
    {on:'bank',reqAny:MISS.concat(['sb_5_2','sb_5_3']),do:[{fn:'bank'}]},                                         // his passive made a blow miss
    {on:'missed',reqAny:MD,do:[{fn:'md'}]},                                                                       // Misdirect
    {on:'missed',reqAny:FG,do:[{fn:'forget'}]},                                                                   // Forgotten
    {on:'kit',skill:VP,reqAny:['co_11_1'],do:[{fn:'vpKit'}]},
    {on:'landPre',skill:VP,reqAny:['co_7_2','co_11_1','co_13_2','co_9_1'],do:[{fn:'vpPre'}]}
  ],
  talents:{
    /* ============================== THE COMMISSION ============================== */
    co_1_1:[ {on:'out',if:{targetHas:'ct'},more:R(0.02)} ],                                                         // Terms of Hire (the Contract: ctPick)
    co_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Sure Feet
    co_1_4:[ {param:'dusk.k',add:R(0.01)} ],                                                                        // Waiting Above (Dusk: tk, landOut)
    co_2_1:[ {on:'out',if:{targetHas:'ct'},ignoreArmor:R(0.03)} ],                                                  // Fine Print
    co_2_2:[ {stat:{atk:R(0.004)},per:'cw'} ],                                                                      // Clean Work (the count: the always rows)
    co_1_3:[ {param:'crit.np',add:R(0.01)} ],                                                                       // Needle Point (in the crit group)
    co_3_1:[ {on:'death',if:{unitHas:'ct'},do:[{fn:'sealed'}]} ],                                                   // Sealed
    co_4_2:[ {param:'crit.nw',add:R(0.003)} ],                                                                      // No Witnesses (in the crit group)
    co_3_3:[ {on:'out',if:{casting:VP},more:R(0.03)} ],                                                             // Long Fall
    co_3_4:[ {param:'dusk.max',add:R(2)} ],                                                                         // Darker Sky
    co_4_1:[ {on:'out',if:{targetHas:'ct'},critMore:R(0.04)} ],                                                     // Nothing Personal
    co_5_2:[ {on:'kill',dots:true,if:{targetHas:'ct'},do:[{heal:{pct:0.15,of:'maxHp'},on:'self'}]} ],               // Contract Closed (PICK ONE)
    co_5_3:[ {on:'out',if:{targetHas:'ct'},more:0.10},                                                              // Open Terms (PICK ONE): him ...
             {on:'teamIn',if:{targetHas:'ct',srcIs:'ally'},more:0.10} ],                                            //   ... and his team
    co_4_3:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{energy:R(0.33)}]} ],                                  // Patient Hands (3% of the 11 a basic attack gives)
    co_n1:[  {param:'dr.tt',add:R(0.03)} ],                                                                         // Thin Target (in myDr)
    co_6_2:[ {stat:{aspd:R(0.005)},per:'cw'} ],                                                                     // Spotless
    co_5_4:[ {stat:{lifesteal:R(0.005)},per:{window:'sd',max:[20,10,20/3,5,4]}} ],                                  // Settling Dark (up to 10%; the window: landOut)
    co_7_1:[ {on:'out',if:{fn:'tBack'},more:R(0.02)} ],                                                             // Deep Rank
    co_7_2:[ {on:'skillTgt',skill:VP,if:{fn:'first'},do:[{retarget:'holder:ct'}]},                                  // Clause of Silence
             {on:'land',skill:VP,do:[{fn:'clause'}]} ],
    co_6_3:[ {on:'kit',skill:FAN,opt:{angle:{add:R(5)}}} ],                                                         // Wide Fan
    co_8_1:[ {on:'kit',skill:VP,opt:{exec:{add:R(0.006)}}} ],                                                       // The Last Line (was Executor)
    co_n2:[  {param:'ct.short',add:1} ],                                                                            // Short Roster (in ctPick)
    co_7_3:[ {on:'out',if:{casting:FAN},more:R(0.03)} ],                                                            // Lacerating Fan
    co_6_1:[ {param:'dr.back',add:R(0.03)} ],                                                                       // Out of Their Reach (in myDr)
    co_9_1:[ {on:'out',if:{casting:VP,fn:'hop'},more:R(0.02)} ],                                                    // Before the Body Lands
    co_8_3:[ {on:'out',if:{casting:LAC},more:R(0.03)} ],                                                            // Sharp Practice
    co_8_4:[ {param:'dusk.fast',add:R(0.1)} ],                                                                      // Moonless (in tk)
    co_n3:[  {on:'death',if:{who:'ally'},do:[{fn:'owed'}]}, {on:'out',if:{fn:'owedHit'},more:0.20} ],               // Blood Owed
    co_9_2:[ {on:'hit',if:{selfPass:'notthere',targetTeam:'enemy'},do:[{heal:{pct:R(0.01),of:'hpLost'},on:'self'}]} ],   // Untraced
    co_10_1:[ {on:'out',if:{targetHpBelow:0.40},more:R(0.02)} ],                                                    // Due Date
    co_9_4:[ {on:'kill',if:{fn:'wasLand'},do:[{fn:'descent'}]} ],                                                   // Second Descent
    co_10_2:[ {param:'ur.k',add:R(1)} ],                                                                            // Untouched Record (urEnd / the wave row)
    co_10_3:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                                // Nimble Wrist
    co_11_1:[ {on:'hit',if:{casting:VP,targetTeam:'enemy'},do:[{fn:'csHit'}]}, {on:'num',skill:'vpFall',do:[{fn:'csFall'}]} ],   // Countersigned
    co_11_2:[ {param:'dr.ns',add:R(0.02)} ],                                                                        // Nobody Saw (in myDr)
    co_11_4:[ {param:'crit.sw',add:R(0.01)} ],                                                                      // Shadow Weight (in the crit group)
    co_12_1:[ {on:'teamHeal',if:{unitHas:'ct'},less:R(0.10)} ],                                                     // Withheld Mercy
    co_12_2:[ {stat:{atk:R(0.01)},per:'rep'}, {on:'death',if:{unitHas:'ct'},do:[{stack:'rep',add:1}]} ],            // Reputation (up to 3)
    co_12_3:[ {param:'crit.pnr',add:R(0.015)} ],                                                                    // Point of No Return (in the crit group)
    co_12_4:[ {stat:{nrg:R(0.05)},if:{holderAlive:'ct'}} ],                                                         // Night Shift
    co_13_2:[ {on:'num',skill:'vpExec',do:[{fn:'keptExec'}]}, {on:'out',if:{casting:VP},do:[{fn:'keptBoss'}]},      // The Contract Is Kept (SIGNATURE; the trigger: tk)
              {on:'land',skill:VP,do:[{fn:'keptEnd'}]} ],

    /* ============================== EVERY CUT STAYS OPEN ============================== */
    ec_1_1:[ {param:'kn.k',add:R(0.06)} ],                                                                          // Left in the Wound (knives: the always rows)
    ec_4_1:[ {on:'out',if:{casting:FAN},more:R(0.03)} ],                                                            // Fanwork
    ec_1_4:[ {on:'dotTick',if:{tag:'bl',selfPass:'notthere'},do:[{heal:{pct:R(0.03),of:'hit'},on:'self'}]} ],       // Takes a Little Back (the shield: shAdd)
    ec_2_1:[ {on:'out',more:R(0.01),per:{ust:'kn'}} ],                                                              // Barbed
    ec_2_2:[ {param:'ato.k',add:R(0.15)} ],                                                                         // The Third Cut (All the Others: ato)
    ec_3_1:[ {param:'kn.fq',add:1} ],                                                                               // Full Quiver (fanCast, bleed)
    ec_3_3:[ {on:'dotOut',if:{tag:'bl'},more:R(0.03)} ],                                                            // Open Seams
    ec_3_4:[ {param:'shs.max',add:R(0.01)} ],                                                                       // Dark Stitching
    ec_6_1:[ {on:'teamHeal',less:R(0.04),per:{ust:'kn',of:'unit',max:3}} ],                                         // Rusted Edge (up to 3 knives)
    ec_4_2:[ {param:'ato.chain',add:R(0.15)} ],                                                                     // Chain of Cuts (in ato)
    ec_n1:[  {on:'dotIn',less:R(0.04)} ],                                                                           // Closed Over
    ec_6_2:[ {param:'bl.dur',add:R(0.2)} ],                                                                         // Lingering (in bleed)
    ec_5_2:[ {on:'num',skill:'rupN',add:-1}, {on:'out',if:{casting:'rupture'},less:0.30} ],                         // Open Season (PICK ONE)
    ec_5_3:[ {on:'out',if:{casting:'rupture'},more:0.25}, {param:'ato.narrow',add:1} ],                             // Narrow Cut (PICK ONE)
    ec_5_4:[ {param:'dr.pm',add:R(0.01)} ],                                                                         // Patient Mending (in myDr)
    ec_7_1:[ {param:'kn.heal',add:R(0.004)} ],                                                                      // Every Knife Home (in pull, up to 4% a pull)
    ec_6_3:[ {on:'out',if:{casting:'rupture'},more:R(0.04)} ],                                                      // Flat Blade (needs Narrow Cut)
    ec_6_4:[ {param:'shs.dur',add:R(1)} ],                                                                          // Mender's Hand
    ec_8_1:[ {param:'kn.max',add:R(1)} ],                                                                           // Barb Tips
    ec_7_3:[ {param:'cw.fan',add:R(0.01)} ],                                                                        // Crowd Work (in fanCast)
    ec_7_4:[ {on:'in',if:{fn:'shHeld',srcTeam:'enemy'},do:[{slow:R(0.04),dur:2,on:'source'}]} ],                    // Thin Shadow
    ec_9_1:[ {param:'kn.pin',add:1} ],                                                                              // Pincushion (in pull)
    ec_8_2:[ {stat:{aspd:R(0.005)},per:{units:{team:'enemy',dot:'bl'},max:5}} ],                                    // Sympathy
    ec_8_3:[ {on:'out',if:{targetDot:'bl'},critMore:R(0.04)} ],                                                     // Wet Steel
    ec_n2:[  {param:'kn.ft',add:R(0.10)} ],                                                                         // Fan Then Tear (in pull)
    ec_9_3:[ {on:'dotOut',if:{tag:'bl',targetHpBelow:0.50},more:R(0.03)} ],                                         // Old Wounds
    ec_10_1:[ {on:'teamHeal',if:{unitDot:'bl'},less:R(0.02)} ],                                                     // Nothing Closes
    ec_10_2:[ {param:'ato.more',add:R(0.02)} ],                                                                     // Opened Together (in ato)
    ec_10_3:[ {on:'out',if:{casting:LAC},more:R(0.03)} ],                                                           // Lacerate Edge
    ec_11_1:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                                // Field of Knives
    ec_11_2:[ {on:'part',skill:'rupture',do:[{after:1,do:[{fn:'ato',by:0.5}]}]} ],                                  // Red Thread
    ec_11_4:[ {on:'out',if:{fn:'shHeld',targetTeam:'enemy'},more:R(0.015)} ],                                       // Shadow Feeds
    ec_12_1:[ {param:'bl.fast',add:R(0.04)} ],                                                                      // Quiet Bleeding (in bleed)
    ec_12_2:[ {on:'part',skill:'rupture',do:[{stack:'eo',add:1}]}, {on:'dotOut',if:{tag:'bl'},more:R(0.005),per:'eo'} ],   // Every One Opens
    ec_12_3:[ {param:'crit.ch',add:R(0.02)} ],                                                                      // Cold Hands (in the crit group)
    ec_12_4:[ {on:'out',if:{fn:'bdHit'},more:R(0.06)} ],                                                            // Borrowed Dark (the break: shBreak)
    ec_13_2:[ {on:'part',skill:'rupture',icd:20,do:[{fn:'ecAll'}]} ],                                               // Every Cut at Once (SIGNATURE)

    /* ============================== THE SPACE BETWEEN ============================== */
    sb_1_1:[ {param:'md.k',add:R(0.08)} ],                                                                          // Wrong Place (Misdirect: md)
    sb_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Light Step
    sb_1_4:[ {on:'out',if:{targetHas:'fg'},more:R(0.03)} ],                                                         // Nothing to Remember (Forgotten: forget)
    sb_2_1:[ {param:'md.crit',add:R(0.015)} ],                                                                      // Return to Sender (in md; in the crit group)
    sb_2_2:[ {param:'dr.bb',add:R(0.01)} ],                                                                         // Between Beats (Intervals: tk, bankPre; DR in myDr)
    sb_3_1:[ {param:'md.stun',add:0.5} ],                                                                           // Thrown Back (in md)
    sb_3_3:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                              // Silent Edge
    sb_3_4:[ {param:'fg.dur',add:R(0.2)} ],                                                                         // Long Forgetting
    sb_7_1:[ {param:'md.heal',add:R(0.01)} ],                                                                       // No Reflection (in md: at most once every 5 s)
    sb_4_2:[ {param:'iv.max',add:R(1)} ],                                                                           // Held Breath
    sb_4_3:[ {on:'out',if:{fn:'tFront'},more:R(0.03)} ],                                                            // Close Quarters
    sb_n1:[  {param:'md.k',add:0.04}, {param:'md.knife',req:'ec_1_1',add:1} ],                                      // Sent Back Sharp (LINK)
    sb_5_1:[ {on:'ccIn',less:R(0.04)} ],                                                                            // Unmoved (up to 20%)
    sb_11_2:[ {on:'out',if:{casting:VP},more:R(0.02),per:'iv'} ],                                                   // Gone Again
    sb_5_4:[ {stat:{aspd:R(0.01)},per:{units:{team:'enemy',has:'fg'}}} ],                                           // Faceless Crowd
    sb_8_2:[ {on:'ivSpent',do:[{window:'ms',dur:3}]}, {stat:{atk:R(0.02)},if:{window:'ms'}} ],                      // Measured
    sb_7_3:[ {param:'crit.om',add:R(0.01)} ],                                                                       // Out of Mind (in the crit group)
    sb_6_4:[ {param:'dr.dw',add:R(0.02)} ],                                                                         // Dark Wraps (in myDr)
    sb_8_1:[ {param:'crit.ts',add:R(0.01)} ],                                                                       // Turned Steel (in the crit group)
    sb_8_3:[ {on:'out',if:{casting:LAC,targetHas:'fg'},more:R(0.05)} ],                                             // Cut Unremembered (was Riposte Cut)
    sb_10_4:[ {on:'tick',do:[{weaken:'slowMul',by:R(0.10)}]} ],                                                     // Calm Head (up to 30%)
    sb_9_2:[ {param:'dr.uw',add:R(0.02)} ],                                                                         // Unwritten (in myDr)
    sb_7_4:[ {param:'fg.fan',add:R(0.3)} ],                                                                         // Lost in the Press (in forget)
    sb_5_2:[ {param:'tp',add:1} ],                                                                                  // Two Places (PICK ONE; in bank)
    sb_5_3:[ {param:'soon',add:1} ],                                                                                // Sooner (PICK ONE; in bank)
    sb_9_3:[ {on:'hit',if:{selfPass:'notthere',targetTeam:'enemy'},do:[{heal:{pct:R(0.01),of:'hpLost'},on:'self'}]} ],   // Patience of a Tool
    sb_9_4:[ {param:'dr.nr',add:0.25} ],                                                                            // Never Recognised (in myDr)
    sb_6_2:[ {on:'missed',if:{fn:'natural'},do:[{window:'dbl',dur:30}]}, {on:'out',if:{window:'dbl',targetTeam:'enemy'},more:R(0.03),do:[{window:'dbl',end:true}]} ],   // Doubled (needs Two Places)
    sb_6_3:[ {on:'missed',if:{fn:'natural'},do:[{fn:'quick',by:R(0.10)}]} ],                                                          // Quick Return (needs Sooner)
    sb_9_1:[ {param:'md.two',add:1} ],                                                                              // Sent Back Twice (in md)
    sb_10_1:[ {param:'dr.nl',add:R(0.01)} ],                                                                        // Nothing Lands (in myDr)
    sb_10_2:[ {param:'ks',add:1} ],                                                                                 // Knife Screen (fanCast, bankPre)
    sb_10_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                     // Rough Grain
    sb_6_1:[ {param:'md.k',add:R(0.04)} ],                                                                          // Glass Turned Back (was Mirror Edge)
    sb_11_1:[ {on:'missed',do:[{stack:'pol',add:1}]}, {on:'out',if:{targetTeam:'enemy'},more:R(0.003),per:'pol'} ],   // Polite (up to 10)
    sb_11_3:[ {on:'out',if:{stackMin:{iv:1}},critMore:R(0.03)} ],                                                   // Never Turning
    sb_12_1:[ {on:'wave',do:[{stack:'iv',atLeast:R(1)}]} ],                                                         // Waited Until It Was Over
    sb_12_2:[ {on:'missed',do:[{cd:'blue',add:R(-0.2)}]} ],                                                         // Room to Spare
    sb_12_3:[ {param:'dr.do',add:R(0.03)}, {on:'teamIn',if:{srcHas:'fg',srcTeam:'enemy'},less:R(0.03)} ],           // Dim Outline (him: in myDr; his team)
    sb_12_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{heal:{pct:R(0.005),of:'maxHp'},on:'self'}]} ],       // Pale Blade (was Silver Edge)
    sb_13_2:[ {on:'in',icd:20,if:{srcTeam:'enemy',dropBelow:0.30},do:[{miss:true},{fn:'never'}]} ]                  // He Was Never There (SIGNATURE)
  },
  needs:{ ec_6_3:'ec_5_3', sb_6_2:'sb_5_2', sb_6_3:'sb_5_3' },
  fn:{
    /* each tick: Dusk (1 for each 0.5 s off the field, Moonless faster; the landing strike is armed while he is off), Intervals (his passive's miss ready and
       unused for 4 s is stored), the shadow shield (what is left of it, its end), the Contract signature's trigger, the Clean Work count the crit group reads */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), r=T.r, P=T.P, dt=c.dt||0, now=E.now();
      if(o.f==null) o.f={dusk:DUSK.some(id=>r[id]), land:LAND.some(id=>r[id]), iv:IV.some(id=>r[id]), sh:SHS.some(id=>r[id]), cw:CWK.some(id=>r[id])};
      const f=o.f;
      if(f.land&&off(u)){ o.arm=1;
        if(f.dusk){ o.dAcc=(o.dAcc||0)+dt*(1+(P['dusk.fast']||0)); if(o.dAcc>=0.5-1e-9){ const n=Math.floor(o.dAcc/0.5+1e-9); o.dAcc-=n*0.5; A.acts(T,u,[{stack:'dusk',add:n}],c); } } }
      if(f.cw) o.cw=A.stGet(T,'cw');
      if(f.iv&&u.pass&&u.pass.notthere){ if(u._ntReady){ if(!o.rdy){ o.rdy=1; o.rdyT=now; }
          else if(now-o.rdyT>=4-1e-9&&A.stGet(T,'iv')<A.stMax(T,u,'iv')){ A.acts(T,u,[{stack:'iv',add:1}],c); u._ntReady=false; o.tp2=0; T.fn.ntSet(A,T,u); o.rdy=0; } }
        else o.rdy=0; }
      if(f.sh&&(o.sh||0)>0){ o.sh=Math.min(o.sh,u.shield||0); if(!(now<(o.shT||0))){ u.shield=Math.max(0,(u.shield||0)-o.sh); o.sh=0; } }
      if(r.co_13_2) T.fn.keptTk(A,T,u,c); },
    /* his passive's cooldown as the page writes it (4 s - 0.01 s a level), Sooner 25% shorter, Two Places 50% longer */
    ntSet(A,T,u){ const E=A.eng(); let d=E.ntCd?E.ntCd(u):4; if(T.P.soon) d*=0.75; if(T.P.tp) d*=1.5; u._ntCd=d; },
    /* ---- THE CONTRACT ---- */
    ctPick(A,T,u,c,a){ const L=A.pick(T,u,ENM,c).filter(x=>!(a&&a.skip&&x===c.unit)); if(!L.length) return; let b=null;
      if(T.P['ct.short']&&L.filter(x=>back(A,x)).length<=2){ for(const x of L) if(!b||(x.maxHp||0)<(b.maxHp||0)) b=x; }
      else { for(const x of L) if(!b||dep(A,x)>dep(A,b)) b=x; }
      if(b) A.setMark(T,u,b,'ct',{unique:true}); return b; },
    sealed(A,T,u,c){ const b=T.fn.ctPick(A,T,u,c,{skip:1}); if(b) S(T).seal=b; },
    owed(A,T,u,c){ if(!holder(A,T,u)) return; const k=A.pick(T,u,'lastHit',c)[0]; if(!k||!k.alive) return; A.setMark(T,u,k,'ct',{unique:true}); S(T).bo=k; },
    owedHit(A,T,u,c){ const o=S(T); if(o.bo&&c.tgt===o.bo){ o.bo=null; return true; } return false; },
    tBack(A,T,u,c){ return back(A,c.tgt); }, tFront(A,T,u,c){ return front(A,c.tgt); },
    /* The Contract Is Kept: once every 20 s, the Contract under 20% HP: he is gone at once and comes down behind it with Vanishing Point (his own skill at its
       level, no energy spent); the strike finishes it outright (a boss takes 15% of its max HP), he gathers full Dusk, and the chain may hop on */
    keptTk(A,T,u,c){ const o=S(T), E=A.eng(), h=holder(A,T,u); if(!h||!(h.hp<0.2*h.maxHp)) return; if(E.now()<(o.kT||0)||off(u)||(u.stunned||0)>0||(u.fearT||0)>0||!E.castUlt) return;
      o.kT=E.now()+20; o.kept=h; E.castUlt(u,h); if(!((u._vpT||0)>0)){ o.kept=null; return; } u._vpForced=h; A.stSet(T,u,'dusk',A.stMax(T,u,'dusk')); },
    keptExec(A,T,u,c){ const o=S(T), t=u.target; if(!o.kept||t!==o.kept||(u._vpStep||0)!==0) return; c.amt=isBoss(t)?0:1e9; },
    keptBoss(A,T,u,c){ const o=S(T), t=c.tgt; if(o.kept&&t===o.kept&&isBoss(t)&&(u._vpStep||0)===0&&c.amt<9999) c.amt=0.15*(t.maxHp||0); },
    keptEnd(A,T){ S(T).kept=null; },
    /* ---- VANISHING POINT ---- */
    first(A,T,u){ return (u._vpStep||0)===0; },
    hop(A,T,u){ return (u._vpStep||0)>0; },
    vpPre(A,T,u){ S(T).vpS=u._vpStep||0; },
    clause(A,T,u,c){ const o=S(T), t=c.tgt; if(o.vpS!==0||!t||!t.alive||!A.markOf(u,t,'ct')) return; A.control(T,u,t,'silencedT',1); },
    vpKit(A,T){ S(T).cs=0; },
    csHit(A,T,u,c){ if(c.tgt&&!c.tgt.alive) S(T).cs=1; },                    // a strike that kills is always its execute (the page finishes anything it would take below the line)
    csFall(A,T,u,c){ const o=S(T); if(o.cs){ c.amt=1; o.cs=0; } },
    /* ---- DUSK: his first strike after he lands spends it all (Waiting Above: 1% a rank per Dusk); Settling Dark's lifesteal; Second Descent ---- */
    landOut(A,T,u,c){ const o=S(T); if(c.proc) return; o.ls=0; const armed=o.arm||(o.aa&&c.auto); if(!armed) return; o.arm=0; o.aa=0; o.ls=1;
      const n=A.stGet(T,'dusk'); if(!(n>0)) return; A.stSet(T,u,'dusk',0);
      if(T.P['dusk.k']) c.amt*=1+T.P['dusk.k']*n;
      if(T.r.co_5_4) A.acts(T,u,[{window:'sd',dur:4,n}],c); },
    wasLand(A,T){ return !!S(T).ls; },
    descent(A,T,u,c){ const o=S(T); A.acts(T,u,[{stack:'dusk',add:5}],c); o.aa=1; },
    /* ---- CLEAN WORK ---- */
    hitMe(A,T,u,c){ if(c.src&&c.src.team!==u.team){ A.setMark(T,u,c.src,'hm',{}); S(T).hitW=1; } },
    cwGain(A,T,u,c){ A.acts(T,u,[{stack:'cw',add:1}],c); },
    urEnd(A,T){ const o=S(T); o.ur=o.hitW?0:(T.P['ur.k']||0); },
    urStart(A,T,u,c){ const o=S(T); o.hitW=0; if(o.ur>0) A.acts(T,u,[{stack:'cw',atLeast:o.ur}],c); o.ur=0; },
    /* ---- THE CRIT GROUP: at most 5% from all of them on any hit. The always part is a stat (critS); this hit's own part is one more seeded roll ---- */
    critS(A,T){ const o=S(T); return Math.min(0.05,(T.P['crit.np']||0)+(T.P['crit.ts']||0)+(T.P['crit.nw']||0)*(o.cw||0)); },
    crit(A,T,u,c){ const o=S(T), t=c.tgt, P=T.P;
      if(o.seal&&t===o.seal){ o.seal=null; c.force=true; return; }
      let p=0; if(P['crit.ch']&&A.ustGet(T,u,t,'kn')>0) p+=P['crit.ch']; if(P['crit.om']&&A.markOf(u,t,'fg')) p+=P['crit.om'];
      if(P['crit.sw']&&(o.arm||(o.aa&&c.auto))) p+=P['crit.sw']; if(P['crit.pnr']&&T.s.cur===VP) p+=P['crit.pnr'];
      p=Math.min(p,Math.max(0,0.05-T.fn.critS(A,T))); if(!(p>0)||c.force) return;
      const base=Math.min(0.95,(u.glyphCrit||0)+((u._critBuffT||0)>0?(u._critBuffPct||0):0)); if(A.eng().rnd()<p/Math.max(0.05,1-base)) c.force=true; },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP: each multiplies, together at most 40% off a hit; the two Interval talents together at most 20% ---- */
    myDr(A,T,u,c){ const P=T.P, s=c.src; if(!s||s.team===u.team) return; let k=1;
      if(P['dr.tt']&&!c.auto&&A.eng().skillArea&&A.eng().skillArea(s)) k*=1-P['dr.tt'];
      if(P['dr.back']&&back(A,s)) k*=1-P['dr.back'];
      if(P['dr.ns']&&A.stGet(T,'cw')>=3) k*=1-P['dr.ns'];
      if(P['dr.pm']&&shHeld(T,u)) k*=1-P['dr.pm'];
      if(P['dr.dw']&&c.auto) k*=1-P['dr.dw'];
      if(P['dr.uw']&&!A.markOf(u,s,'ht')) k*=1-P['dr.uw'];
      if(P['dr.nr']&&!c.auto&&A.pick(T,u,{team:'enemy',has:'fg'},c).length>=2) k*=1-P['dr.nr'];
      if(P['dr.do']&&A.markOf(u,s,'fg')) k*=1-P['dr.do'];
      c.amt*=Math.max(0.60,k); },
    /* Between Beats and Nothing Lands: every blow aimed at him while an Interval is stored misses (it is spent), so their reduction is on what still reaches him:
       damage over time. Each multiplies; together at most 20% */
    ivDr(A,T,u,c){ const P=T.P, iv=A.stGet(T,'iv'); if(!(iv>0)) return; c.amt*=1-Math.min(0.20,1-(1-(P['dr.bb']||0)*iv)*(1-(P['dr.nl']||0)*iv)); },
    /* ---- HIS BLEEDS AND KNIVES ---- */
    /* a bleed stack he has just put on: the DoT becomes his ('bl'); Lingering (longer, a part tick at the end), Quiet Bleeding (its ticks come sooner, the same
       number of them); a Fan's bleeds are kept for Crowd Work; Full Quiver: knives in a bleeding target last at least as long as its bleed */
    bleed(A,T,u,c){ const t=c.tgt; if(!t||!t.dots) return; const D=t.dots, d=D[D.length-1]; if(!d||d.src!==u||d._talO!=null) return; d._talO=u.uid; d._talK='bl';
      const P=T.P; if(P['bl.dur']>0){ const add=P['bl.dur']/(d.interval||1), n=d.remaining-1+(d._talF!=null?d._talF:1)+add; d.remaining=Math.ceil(n-1e-9); const fr=n-(d.remaining-1); d._talF=(fr<1-1e-9)?fr:null; }
      if(P['bl.fast']>0) d.interval=(d.interval||1)/(1+P['bl.fast']);
      const o=S(T); if(T.s.cur===FAN&&o.fanD) o.fanD.push(d);
      if(P['kn.fq']){ const v=A.ustGet(T,u,t,'kn'); if(v>0) A.ustPut(T,u,t,'kn',v,Math.max(6,bleedLeft(u,t))); } },
    knAdd(A,T,u,t,n){ if(!t||!t.alive||!(n>0)) return; const mx=A.stMax(T,u,'kn'), v=Math.min(mx,A.ustGet(T,u,t,'kn')+n); A.ustPut(T,u,t,'kn',v,T.P['kn.fq']?Math.max(6,bleedLeft(u,t)):6); },
    fanKit(A,T){ const o=S(T); o.fanH=[]; o.fanD=[]; },
    fanHit(A,T,u,c){ const o=S(T), t=c.tgt; if(!t) return; if(o.fanH&&o.fanH.indexOf(t)<0) o.fanH.push(t); if(t.alive) T.fn.knAdd(A,T,u,t,1); },
    fanCast(A,T,u,c){ const o=S(T), H=(o.fanH||[]).filter(x=>x.alive), P=T.P;
      if(P['kn.fq']&&H.length){ let b=null, bd=1e18; for(const x of H){ const d=A.eng().dist(u,x); if(d<bd){ bd=d; b=x; } } T.fn.knAdd(A,T,u,b,1); }
      if(P['cw.fan']&&(o.fanH||[]).length>1){ const k=1+P['cw.fan']*Math.min(4,o.fanH.length-1); for(const d of (o.fanD||[])) d.dps*=k; }
      if(T.r.ec_n2) A.acts(T,u,[{window:'fan',dur:1}],c);
      if(P.ks) A.acts(T,u,[{window:'ks',dur:2}],c);
      o.fanH=null; o.fanD=null; },
    /* Lacerate pulls every knife out of its target: each deals 6% of his attack a rank (Left in the Wound; Fan Then Tear 10% more a rank within 1 s of Fan of
       Knives), heals him 0.4% of his max HP a rank (Every Knife Home, at most 4% a pull); 3 or more pulled count as one more Lacerate stack (Pincushion) */
    pull(A,T,u,c){ const t=c.tgt; if(!t) return; const n=A.ustGet(T,u,t,'kn'); if(!(n>0)) return; A.ustPut(T,u,t,'kn',0); T.fn.knDmg(A,T,u,c,t,n,A.winOn(T,'fan'));
      if(T.P['kn.pin']&&n>=3&&t.alive){ t._blStk=(t._blStk||0)+1; t._blT=Math.max(t._blT||0,6); } },
    knDmg(A,T,u,c,t,n,ft){ const P=T.P; let d=n*(P['kn.k']||0)*atk(A,T,u,c)*(1+(ft?(P['kn.ft']||0):0)); let done=0; if(d>0&&t.alive) done=A.hurt(T,u,t,d,'#b8b8cc','knife');
      if(P['kn.heal']) A.acts(T,u,[{heal:{flat:Math.min(0.04,P['kn.heal']*n)*u.maxHp},on:'self'}],c); return done; },
    /* All the Others: every OTHER enemy bleeding from him takes one of its bleed ticks at once (his strongest bleed on it), 15% stronger a rank (Opened Together
       2% more a rank; Narrow Cut: only the 2 nearest to the ruptured one). It is a copy of the game's bleed: its armor applies. Chain of Cuts: each tick has a
       15% chance a rank to add a Lacerate stack (the game's own). a.by: Red Thread's half strength */
    ato(A,T,u,c,a){ const E=A.eng(), t0=c.tgt, P=T.P; let L=A.pick(T,u,{team:'enemy',dot:'bl'},c).filter(x=>x!==t0);
      if(P['ato.narrow']&&t0){ L=L.map(x=>[x,E.dist(t0,x)]).sort((p,q)=>p[1]-q[1]).slice(0,2).map(e=>e[0]); }
      const k=(1+(P['ato.k']||0)+(P['ato.more']||0))*((a&&a.by)||1);
      for(const x of L){ let tk=0; for(const d of myBleeds(u,x)) tk=Math.max(tk,d.dps); if(!(tk>0)) continue;
        A.hurt(T,u,x,tk*k*E.defMul(u,x,'phys'),'#8f8fa8','ato');
        if(P['ato.chain']&&x.alive&&E.bleedStack&&E.rnd()<P['ato.chain']) E.bleedStack(u,x); } },
    /* Every Cut at Once: each enemy bleeding from him takes the rest of its bleeds in one blow (his bleeds there end; their armor applies), every knife in every
       enemy is pulled (as Lacerate pulls them), and he heals 10% of the total */
    ecAll(A,T,u,c){ const E=A.eng(); let tot=0;
      for(const x of A.pick(T,u,ENM,c)){ const B=myBleeds(u,x); let rest=0; for(const d of B){ rest+=d.dps*(d.remaining-1+(d._talF!=null?d._talF:1)); const i=x.dots.indexOf(d); if(i>=0) x.dots.splice(i,1); }
        if(rest>0) tot+=A.hurt(T,u,x,rest*E.defMul(u,x,'phys'),'#ff5b6b','opens');
        const n=A.ustGet(T,u,x,'kn'); if(n>0){ A.ustPut(T,u,x,'kn',0); tot+=T.fn.knDmg(A,T,u,c,x,n,false); } }
      if(tot>0) A.acts(T,u,[{heal:{flat:0.10*tot},on:'self'}],c); },
    /* ---- THE SHADOW SHIELD: healing past his full HP becomes a shield (8% of his max HP, Dark Stitching more; 5 s, Mender's Hand longer) ---- */
    shAdd(A,T,u,c){ const o=S(T), P=T.P, cap=(0.08+(P['shs.max']||0))*u.maxHp, cur=Math.min(o.sh||0,u.shield||0), add=Math.min(c.over||0,cap-cur); if(!(add>0)) return;
      const d=5+(P['shs.dur']||0); u.shield=(u.shield||0)+add; u.shieldT=Math.max(u.shieldT||0,d); o.sh=cur+add; o.shT=A.eng().now()+d; },
    shHeld(A,T,u){ return shHeld(T,u); },
    shBreak(A,T){ const o=S(T); if((o.sh||0)>0){ o.sh=0; o.bd=1; } },
    bdHit(A,T,u,c){ const o=S(T); if(o.bd&&c.tgt&&c.tgt.team!==u.team){ o.bd=0; return true; } return false; },
    /* ---- HIS PASSIVE'S MISSES ---- */
    /* a blow aimed at him while his passive is not ready: Knife Screen (2 s after Fan of Knives, once), else a stored Interval, makes it miss as his passive does.
       The blow as thrown is kept for the signature's Misdirect */
    bankPre(A,T,u,c){ const o=S(T); o.raw=c.amt; o.rawS=c.src; if(u._ntReady) return;
      if(T.P.ks&&A.winOn(T,'ks')){ A.acts(T,u,[{window:'ks',end:true}],c); o.why='ks'; }
      else if(A.stGet(T,'iv')>0){ A.stSet(T,u,'iv',A.stGet(T,'iv')-1); o.why='iv'; if(T.on.ivSpent) A.run(T,u,'ivSpent',c); }
      else return;
      o.cd0=u._ntCd; c.miss=true; },
    /* his passive made this blow miss (the page's own miss): a forced one puts the passive's clock back; Two Places keeps it ready for a second blow (then 50%
       longer), Sooner 25% shorter. Then the 'missed' rows (Misdirect, Forgotten, Polite, ...) */
    bank(A,T,u,c){ const o=S(T), P=T.P, why=o.why||'pass'; o.why=null;
      if(why!=='pass'){ u._ntReady=false; u._ntCd=o.cd0; }
      else if(P.tp&&!o.tp2){ o.tp2=1; u._ntReady=true; o.rdy=1; o.rdyT=A.eng().now(); }
      else { o.tp2=0; T.fn.ntSet(A,T,u); }
      A.run(T,u,'missed',Object.assign({},c,{why})); },
    /* Misdirect: the blow is turned back on whoever threw it, as talent damage (its owner's armor or magic resist against the blow's kind applies; no crit of his,
       except Return to Sender's own roll, inside his 5% crit group). a.whole: the whole blow (the signature) */
    md(A,T,u,c,a){ const E=A.eng(), s=c.src, P=T.P, o=S(T); if(!s||!s.alive||s.team===u.team) return;
      const k=(c.why==='sig')?1:(P['md.k']||0); let d=(c.amt||0)*k;
      if(d>0&&P['md.crit']){ const p=Math.min(P['md.crit'],Math.max(0,0.05-T.fn.critS(A,T))); if(p>0&&E.rnd()<p) d*=1+(u.critDmg||0.6); }
      const L=[s]; if(P['md.two']) for(const x of A.pick(T,u,{team:'enemy',of:'source',within:3,skip:'source',n:1},c)) L.push(x);
      if(d>0) for(const x of L) A.hurt(T,u,x,d*E.defMul(u,x,c.kind||'phys'),'#c9a6ff','misdirect');
      if(P['md.stun']) tstun(A,T,u,[s],P['md.stun']);
      if(P['md.knife']) T.fn.knAdd(A,T,u,s,1);
      if(P['md.heal']&&!(E.now()<(o.nrT||0))){ o.nrT=E.now()+5; A.acts(T,u,[{heal:{pct:P['md.heal'],of:'maxHp'},on:'self'}],c); } },
    /* Forgotten: the enemy whose blow missed cannot pick him as its target for 1.5 s (Long Forgetting longer); Lost in the Press */
    forget(A,T,u,c){ const s=c.src; if(!s||!s.alive||s.team===u.team) return; T.fn.fgOn(A,T,u,s,1.5+(T.P['fg.dur']||0)); },
    fgOn(A,T,u,x,d){ A.setMark(T,u,x,'fg',{dur:d,longest:true}); if(T.P['fg.fan']) u.greenCd=Math.max(0,(u.greenCd||0)-T.P['fg.fan']); },
    natural(A,T,u,c){ return c.why==='pass'; },
    quick(A,T,u,c,a){ if(u.alive) u.atkCd=Math.max(0,(u.atkCd||0)-(a.by||0)*(u.atkInterval||1)); },
    /* He Was Never There: the blow that would take him below 30% misses; every enemy within 4 m Forgets him 2 s, 2 Intervals stored, Misdirect throws the whole
       blow (as thrown) back at its owner */
    never(A,T,u,c){ const o=S(T); for(const x of A.pick(T,u,{team:'enemy',within:4},c)) T.fn.fgOn(A,T,u,x,2);
      if(T.st.iv) A.acts(T,u,[{stack:'iv',add:2}],c);
      const raw=(o.rawS===c.src&&o.raw>0)?o.raw:(c.amt||0); A.run(T,u,'missed',Object.assign({},c,{amt:raw,why:'sig'})); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/28 - HOLLOW - talent decisions.md) */
  ruling:{}
};
