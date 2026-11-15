/* GRUEL - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Gruel": what he added)
   His real kit (the code, not the tooltip wording; his skills read Attack, his hits are physical):
   - Coinflail ('cleavecone', green, cd 7, deliver 'form'): on arrival every enemy within 3 m of his CENTRE and inside a 70 degree cone toward the skill's target
     takes 130% of his attack. Bodies keep enemies 3.6 m+ from his centre, so today it hits nobody (325 of 325 casts, SKILL REACH AUDIT 14NOV2026); release v1391
     measures to the enemy's body edge. His Coinflail talents are built for the Coinflail that lands (rows on its hits; its kit row counts body to body).
   - Weigh the Debt ('weighdebt', blue, cd 10): strikes the enemy with the highest MAX HP for 100% of his attack and puts it In Debt for 6 s (_debtTo / _debtT /
     _debtPct 0.35). While In Debt, each hit it lands on one of Gruel's ALLIES (never on Gruel himself) loses 35% (the cut); Gruel loses half the cut from his HP
     (written straight on, no reduction) and heals half the cut (healUnit): "COLLECTED". So for him it is a wash; for the ally it is 35% less.
   - The Reckoning ('taunt', ultimate, on energy - no cooldown): ULT_DEF.taunt (4 s, 6 m centre to centre) + HERO_ULT_ART.gruel (art only): every enemy within 6 m
     is taunted onto him and his skill slot takes 40% + 0.2 point a level off every hit (59.8% at 100), for 4 s. The card says "half damage": not the code.
   - Gluttony (passive 'juggernaut'): 4% of his max HP x his passive's strength every second (8.8% at 100), written straight onto his HP (no healUnit, so no
     healing cut touches it). Nothing in the game saw it: the 'num' hook 'glut' is the only door his talents have to it.
   Owed, Fee, Interest, Pans, Tipped Scales, Short Weight, Appetite, Girth and Feast exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/26 - GRUEL - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const CF='cleavecone', WD='weighdebt', RK='taunt';
const DR_FLOOR=0.70;                      // his damage-reduction talents together never take more than 30% off a hit (one capped group: see drK)
const TEN_FLOOR=0.65;                     // his control-shortening talents together never make a control more than 35% shorter
const CRIT_CAP=0.05;                      // his critical-chance talents together never give more than 5% (Forty Towns included)
const REGEN=0.012;                        // his per-second talent healing on one unit never passes 1.2% of its max HP a second (the game's regeneration cap)
const EIE_CAP=0.06;                       // Everything Is Eaten's extra Gluttony healing: at most 6% of his max HP a second (a once-per-fight burst)
/* the states several talents read: their bookkeeping runs when any of these is learned */
const OWED=['le_1_1','le_2_1','le_3_1','le_11_1','le_4_1','le_8_1','le_6_1','le_7_1','le_10_1','le_11_2','le_12_2','le_13_2'];
const COLL=OWED.concat(['le_9_4']);
const INT=['le_2_2','le_4_2','le_9_2','le_13_2','le_5_3','le_11_2'];
const DEBT=INT.concat(['le_7_2','bs_7_4']);
const FEE=['le_1_4','le_3_4','le_5_4','le_6_4','le_12_4','le_7_4','le_9_4','le_11_2'];
const PANS=['bs_1_3','bs_2_3','bs_4_3','bs_11_3','bs_12_3','bs_5_2','bs_5_3','bs_6_2','bs_6_3','bs_8_3','bs_10_3','bs_9_3','bs_13_3'];
const APP=['ap_1_1','ap_2_1','ap_3_1','ap_4_1','ap_6_1','ap_6_4','ap_7_1','ap_8_1','ap_10_1','ap_11_1','ap_13_2'];
const GIRTH=['ap_1_4','ap_3_4','ap_5_4','ap_7_4','ap_7_3','ap_9_4','ap_10_4','ap_12_2','ap_12_4','ap_11_2','ap_13_2','le_n2'];
const FEAST=['ap_2_2','ap_4_2','ap_6_2','ap_8_2','ap_5_2','ap_5_3','ap_6_3','ap_10_2','ap_11_2','ap_13_2'];
const RECK=['le_11_2','bs_n1','bs_9_3','ap_11_2','ap_10_4'];
const CFK=APP.concat(['le_4_3','bs_4_2','bs_1_1','le_12_1','le_9_4']);       // Coinflail's own changes at its arrival (kit) and their end (cast)
const GLUT=APP.concat(GIRTH,FEAST,['bs_10_3']);                                // the Gluttony 'num' row
const DRG=['le_3_4','le_6_1','le_11_3','bs_1_3','bs_2_4','bs_8_3','bs_12_2','bs_11_3','bs_5_1','bs_n1','ap_2_3','ap_1_4','ap_8_2','ap_11_3'];
const TEN=['bs_8_2','le_12_3','ap_5_1'];
const SCAN=INT.concat(PANS,['bs_7_1','ap_9_4']);
const WAVE=FEE.concat(GIRTH,['ap_6_4','ap_10_2']);
const DEATHS=FEAST;
/* ---- helpers ---- */
const hpf=x=>x&&x.maxHp>0?x.hp/x.maxHp:0;
const inDebt=(u,x)=>!!x&&x.alive&&x._debtTo===u&&(x._debtT||0)>0;          // In Debt to HIM (the engine's own fields, written by Weigh the Debt)
const foes=(A,T,u)=>A.pick(T,u,{team:'enemy'},{});
const swThr=T=>0.30+Math.min(0.05,T.P['sw.thr']||0);                       // Short Weight: below 30% HP (Light Purse: up to 35%)
const isSW=(T,u,x)=>!!x&&x.alive&&x.team!==u.team&&x.hp<swThr(T)*x.maxHp;
const preHp=(c)=>{ const t=c.tgt; return t&&t.maxHp>0?(t.hp+(c.hpLost||0))/t.maxHp:0; };   // on 'hit': the target's HP share before this blow
const pan=T=>T.s.pan||(T.s.pan={L:0,R:0,t:0,side:null});
const isBoss=x=>!!((x.t&&x.t.isboss)||x._raidBoss);
const learned=(T,L)=>L.some(id=>T.r[id]);
module.exports={
  hero:'gruel',
  casting:true,                         // rows ask which of his skills a hit comes from (Coinflail, Weigh the Debt, The Reckoning)
  states:{
    owed:{unit:true,max:P('owed.max',5),dur:P('owed.dur',8)},                 // Owed on each enemy: all of it lapses 8 s after its last gain (Arrears: longer)
    int:{unit:true,max:6},                                                     // Interest on each debtor (kept while it stays In Debt; scan clears it)
    fee:{max:20},                                                              // Fee: the rest of the wave (Rainy Day keeps some, Opening Balance starts some)
    app:{max:10},                                                              // Appetite
    girth:{max:P('girth.max',10)},                                             // Girth: this wave (Second Belt keeps some)
    tip:{max:10,wave:'reset'},                                                 // Steady Hand's tips this wave
    aye:{max:99}                                                               // All You Can Eat: the deaths that fed this Feast
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'hurt',reqAny:OWED,if:{srcTeam:'enemy'},do:[{ustack:'owed',on:'source',add:1}]},                      // Owed: each hit an enemy lands on him
    {on:'kit',reqAny:CFK,skill:CF,do:[{fn:'cfKit'}]},                                                           // Coinflail at its arrival: its arc, reach, aim, count, Appetite, Call It In
    {on:'cast',reqAny:CFK,skill:CF,do:[{fn:'cfEnd'}]},
    {on:'hit',reqAny:COLL,if:{casting:CF,targetTeam:'enemy'},do:[{fn:'collect'}]},                             // Coinflail collects the Owed of each enemy it hits
    {on:'skillTgt',reqAny:DEBT,skill:WD,do:[{fn:'wdTgt'}]},                                                     // Weigh the Debt's mark (The Heaviest Pays, Two Ledgers)
    {on:'cast',reqAny:DEBT,skill:WD,do:[{fn:'wdCast'}]},                                                        //   the debt as it was written (its cut kept for Interest)
    {on:'tick',reqAny:SCAN,do:[{fn:'scan'}]},                                                                   // one walk a tick: Interest, the pans' clock, Short Weight, Full Balance, the settle
    {on:'num',skill:'collect',reqAny:FEE,do:[{stack:'fee',add:1}]},                                             // Fee: each COLLECTED
    {on:'num',skill:'collect',reqAny:['ap_8_3'],do:[{fn:'ownH'}]},                                              //   (the heal that follows is his own: Slow Digest)
    {on:'num',skill:'glut',reqAny:GLUT,do:[{fn:'glut'}]},                                                       // Gluttony each tick: Appetite, Girth, the Gluttony talents, Pass the Dish
    {on:'hurt',reqAny:PANS,if:{srcTeam:'enemy'},do:[{fn:'panL'}]},                                              // the left pan: damage he takes (hits)
    {on:'hit',reqAny:PANS,if:{targetTeam:'enemy'},do:[{fn:'panR'}]},                                            // the right pan: damage he deals (hits)
    {on:'tip',reqAny:['bs_11_3'],do:[{stack:'tip',add:1}]},                                                     // Steady Hand counts the tips
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                      // his damage-reduction talents: ONE capped group (30%)
    {on:'dotIn',reqAny:DRG,do:[{fn:'myDrDot'}]},
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                     // his control-shortening talents: ONE capped group (35%)
    {stat:{crit:1},reqAny:['bs_6_3','ap_7_1'],per:{fn:'critT'}},                                                // his critical-chance talents: at most 5% with Forty Towns
    {on:'hit',reqAny:FEAST,if:{targetTeam:'enemy'},do:[{mark:'fed',on:'target',dur:3}]},                       // Feast: an enemy he hit in the last 3 s ...
    {on:'death',reqAny:DEATHS,do:[{fn:'death'}]},                                                               //   ... dies
    {on:'end:feast',reqAny:['ap_10_2'],do:[{stack:'aye',set:0}]},
    {on:'cast',reqAny:RECK,skill:RK,do:[{fn:'reck'}]},                                                          // The Reckoning: whom it taunted, its window
    {on:'end:reck',reqAny:['le_11_2'],do:[{fn:'reckEnd'}]},
    {on:'wave',reqAny:WAVE,do:[{fn:'waveStart'}]}, {on:'waveEnd',reqAny:WAVE,do:[{fn:'waveEnd'}]},
    {on:'out',reqAny:['ap_8_3'],do:[{fn:'inHit1'}]}, {on:'hit',reqAny:['ap_8_3'],do:[{fn:'inHit0'}]}           // Slow Digest: his own lifesteal is not "from others"
  ],
  talents:{
    /* ============================== THE LEDGER ============================== */
    le_1_1:[ {on:'out',if:{casting:CF,targetTeam:'enemy'},more:R(0.02),per:{ust:'owed'}} ],                    // Ledger Entry (Owed: the always rows)
    le_2_3:[ {on:'out',if:{casting:CF},more:R(0.04)} ],                                                         // Heavy Flail
    le_1_4:[ {stat:{atk:R(0.002)},per:'fee'} ],                                                                 // Collector's Fee
    le_2_1:[ {param:'owed.max',add:R(1)} ],                                                                     // Running Tab
    le_2_2:[ {param:'int.cut',add:R(0.01)} ],                                                                   // Interest (scan)
    le_3_1:[ {param:'sq',add:1} ],                                                                              // Square Accounts (collect)
    le_4_2:[ {param:'int.rate',add:R(0.15)} ],                                                                  // Compound (scan)
    le_n2:[ {on:'death',if:{fn:'deadDebtor'},do:[{heal:{pct:0.03,of:'maxHp'}}]},                                // Eats What He Is Owed (LINK)
            {on:'num',skill:'collect',req:'ap_1_4',do:[{fn:'girthOf'}]} ],                                      //   with Girth: what Weigh the Debt heals him counts toward Girth
    le_3_4:[ {param:'dr.fee',add:R(0.002)} ],                                                                   // Keep the Change (drK)
    le_4_1:[ {param:'item',add:R(0.005)} ],                                                                     // Itemised (collect)
    le_5_2:[ {on:'teamHeal',if:{fn:'unitDebtor'},do:[{fn:'noForgive'}]} ],                                      // No Forgiveness (PICK ONE)
    le_5_3:[ {on:'death',if:{fn:'deadDebtor'},do:[{fn:'soldOn'}]} ],                                            // Debt Sold On (PICK ONE)
    le_4_3:[ {param:'cf.ang',add:R(5)} ],                                                                       // Wide Swing (cfKit)
    le_n1:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                               // Prompt Notice
    le_6_3:[ {param:'sold.dur',add:R(1)} ],                                                                     // New Owner (soldOn)
    le_5_4:[ {on:'num',skill:'collect',chance:R(0.10),do:[{stack:'fee',add:1}]} ],                              // Fee Schedule (the fight's seeded stream)
    le_6_1:[ {param:'dr.late',add:R(0.02)} ],                                                                   // Late Payment (drK)
    le_6_2:[ {on:'out',if:{fn:'tgtDebt'},more:R(0.015)} ],                                                      // Bad Creditor
    le_6_4:[ {param:'fee.open',add:R(3)} ],                                                                     // Opening Balance (waveStart)
    le_7_1:[ {stat:{move:R(0.04)},if:{fn:'walk'}} ],                                                            // The Collector's Walk
    le_7_2:[ {param:'two',add:1} ],                                                                             // Two Ledgers (wdTgt, wdCast)
    le_7_4:[ {on:'out',if:{auto:true,stackMin:{fee:20}},more:R(0.03)} ],                                        // Ledger Weight
    le_8_1:[ {param:'coll',add:R(0.1)} ],                                                                       // Collections (collect)
    le_9_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                  // Never a Copper Forgiven
    le_8_3:[ {stat:{armor:R(0.02)},if:{fn:'anyDebt'}} ],                                                        // Brass Hide
    le_9_2:[ {stat:{atk:R(-0.003)},to:{team:'enemy',fn:'debtor'},per:{ust:'int'}} ],                            // Usury
    le_9_4:[ {param:'cii',add:1} ],                                                                             // Call It In (cfKit, collect)
    le_10_1:[ {stat:{armor:R(-0.003)},to:{team:'enemy',ust:{owed:1}},per:{ust:'owed'}} ],                       // Tally
    le_10_2:[ {on:'kit',skill:WD,opt:{dur:{add:R(0.5)}}} ],                                                     // Long Debt
    le_10_4:[ {on:'num',skill:'collect',more:R(0.05)} ],                                                        // Profit
    le_11_1:[ {param:'owed.dur',add:R(1)} ],                                                                    // Arrears
    le_11_2:[ {param:'dor',add:1} ],                                                                            // Day of Reckoning (reck, reckEnd)
    le_11_3:[ {param:'dr.hard',add:R(0.02)} ],                                                                  // Hard Bargain (drK)
    le_12_1:[ {on:'out',if:{casting:CF},more:R(0.02),per:{fn:'cfN'}} ],                                         // Bookkeeper (up to 4: cfN)
    le_12_2:[ {on:'teamIn',if:{targetTeam:'enemy',targetUst:{owed:1}},more:R(0.01)} ],                          // Settling Up (his whole team, Gruel too)
    le_12_3:[ {param:'ten.sil',add:R(0.1)} ],                                                                   // Fixed Price (ten)
    le_12_4:[ {param:'fee.keep',add:R(2)} ],                                                                    // Rainy Day (waveEnd)
    le_13_2:[ {param:'wio',add:1} ],                                                                            // What Is Owed (SIGNATURE: scan, wio)
    /* ============================== THE BRASS SCALES ============================== */
    bs_1_1:[ {on:'hit',if:{fn:'tgtSWpre'},do:[{heal:{pct:R(0.01),of:'hpLost'}}]},                              // Short Weight: his hits on them heal him
             {param:'sw.turn',add:1} ],                                                                         //   and Coinflail turns toward the nearest one (cfKit)
    bs_1_3:[ {param:'dr.pan',add:R(0.01)}, {stat:{atk:R(0.01)},per:{fn:'rightK'}} ],                           // Two Pans (left: drK; right: attack)
    bs_1_4:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.01),per:{fn:'tilt'}} ],                                 // Mother's Scales (Tipped Scales)
    bs_2_3:[ {param:'pan.hold',add:R(0.5)} ],                                                                   // Fine Weights (scan)
    bs_2_4:[ {param:'dr.steep',add:R(0.01)} ],                                                                  // Steep Tilt (drK)
    bs_3_1:[ {param:'sw.thr',add:R(0.01)} ],                                                                    // Light Purse
    bs_9_1:[ {on:'teamHeal',if:{fn:'unitSW'},less:R(0.03)} ],                                                   // Bare Cupboard
    bs_3_4:[ {on:'hit',if:{fn:'heavy50'},do:[{slow:0.30,dur:1.5,on:'target'}]} ],                              // Weigh Them Down
    bs_4_2:[ {param:'cf.r',add:R(0.2)} ],                                                                       // Heavy Coins (cfKit)
    bs_4_3:[ {on:'tip',icd:2.5,do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                                         // Counterpoise (at most once every 2.5 s: 1.2% a second)
    bs_4_4:[ {on:'out',if:{casting:CF},more:R(0.03)} ],                                                         // Even-Handed
    bs_5_1:[ {param:'dr.bread',add:R(0.03)}, {on:'teamIn',if:{targetTeam:'ally',fn:'srcSW'},less:R(0.03)} ],   // Price of Bread (on him: drK; on his allies)
    bs_5_2:[ {param:'honest',add:1} ],                                                                          // Honest Measure (PICK ONE: leftK, rightK)
    bs_5_3:[ {param:'thumb',add:1} ],                                                                           // Thumb on the Scale (PICK ONE)
    bs_n1:[ {param:'dr.warn',add:R(0.02)}, {on:'teamIn',if:{targetTeam:'ally',srcHas:'tnt'},less:R(0.02)} ],   // Fair Warning (on him: drK; on his allies)
    bs_6_1:[ {on:'out',if:{targetTeam:'enemy',targetLacks:'wf'},more:R(0.10),do:[{mark:'wf',on:'target'}]} ],   // Weighed and Found
    bs_6_2:[ {param:'level',add:R(0.03)} ],                                                                     // Level Hand
    bs_6_3:[ {param:'crit.mb',add:R(0.01)} ],                                                                   // Measured Blows (critT)
    bs_6_4:[ {on:'out',if:{casting:WD},more:R(0.05)} ],                                                         // True Weight
    bs_7_1:[ {on:'death',if:{fn:'deadSW'},do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                              // Scrap Value
    bs_7_4:[ {param:'heavy',add:1} ],                                                                           // The Heaviest Pays (wdTgt, tilt)
    bs_8_2:[ {param:'ten.stun',add:R(0.05)} ],                                                                  // Sure Footing (ten)
    bs_8_3:[ {param:'dr.bal',add:R(0.01)} ],                                                                    // Balanced Stance (drK)
    bs_9_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                  // Weighing Eye
    bs_9_3:[ {param:'fairx',add:1} ],                                                                           // Fair Exchange (panL, leftK, rightK)
    bs_10_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                            // Coin Rain
    bs_10_3:[ {param:'glut.lm',add:R(0.03)} ],                                                                  // Gluttonous Measure (glut)
    bs_10_4:[ {on:'out',if:{fn:'tgtDebtHigher'},more:R(0.02)} ],                                                // Exact Change
    bs_11_1:[ {on:'out',if:{selfHpBelow:0.30},more:R(0.03)} ],                                                  // Last Coin
    bs_11_3:[ {param:'dr.steady',add:R(0.005)}, {stat:{atk:R(0.005)},per:'tip'} ],                             // Steady Hand
    bs_11_4:[ {on:'hit',if:{casting:CF,fn:'higherPre'},do:[{dmg:{pct:0.30,of:'hit'},on:'target'}]} ],          // Scales of the Mother
    bs_12_1:[ {on:'teamIn',if:{targetTeam:'enemy',fn:'tgtSW'},more:R(0.02)} ],                                  // Last Weighing (his whole team, Gruel too)
    bs_12_2:[ {param:'dr.gut',add:R(0.02)} ],                                                                   // Iron Gut (drK, DoT ticks)
    bs_12_3:[ {param:'fb',add:R(0.002)} ],                                                                      // Full Balance (scan)
    bs_12_4:[ {on:'kit',skill:RK,opt:{dur:{add:R(0.2)}}} ],                                                     // Brass Polish
    bs_13_3:[ {param:'stl',add:1}, {on:'in',if:{window:'settle'},do:[{fn:'settleIn'}]} ],                      // The Scales Settle (SIGNATURE: scan, settleIn)
    /* ============================== THE APPETITE ============================== */
    ap_1_1:[ {stat:{atk:R(0.004)},per:'app'} ],                                                                 // Never Full (Appetite: glut, cfKit)
    ap_2_3:[ {param:'dr.stom',add:R(0.03)} ],                                                                   // Iron Stomach (drK, DoT ticks)
    ap_1_4:[ {param:'dr.girth',add:R(0.003)} ],                                                                 // Girth (drK; Girth itself: glut)
    ap_2_1:[ {on:'out',if:{casting:CF},more:R(0.01),per:{fn:'eaten'}} ],                                        // Rumbling
    ap_2_2:[ {param:'glut.feast',add:R(0.06)} ],                                                                // Feast (the window: death; its heal: glut)
    ap_3_1:[ {param:'plate',add:1} ],                                                                           // Clean Plate (cfKit)
    ap_5_4:[ {param:'girth.keep',add:R(1)} ],                                                                   // Second Belt (waveEnd)
    ap_3_4:[ {stat:{hp:R(0.002)},per:'girth'} ],                                                                // Broad Belt
    ap_4_1:[ {param:'app.rate',add:R(0.2)} ],                                                                   // Snacking (glut)
    ap_4_2:[ {param:'feast.dur',add:R(0.5)} ],                                                                  // Long Supper
    ap_4_3:[ {on:'out',if:{casting:CF},more:R(0.04)} ],                                                         // Flail Grease
    ap_5_1:[ {param:'ten.all',add:R(0.04)} ],                                                                   // Heavy to Shift (ten)
    ap_8_2:[ {param:'dr.gorge',add:R(0.015)} ],                                                                 // Gorge (drK)
    ap_8_3:[ {on:'healMe',if:{fn:'fromOthers'},more:R(0.03)} ],                                                 // Slow Digest
    ap_6_1:[ {param:'app.low',add:R(0.2)} ],                                                                    // Hungry Eyes (glut)
    ap_6_2:[ {on:'feast',do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                                               // Rich Sauce
    ap_6_4:[ {param:'app.open',add:R(3)} ],                                                                     // Midnight Snack (waveStart)
    ap_7_1:[ {param:'crit.gh',add:R(0.001)} ],                                                                  // Gnawing Hunger (critT)
    ap_7_3:[ {on:'out',if:{auto:true},more:R(0.003),per:'girth'} ],                                             // Weight Behind It
    ap_8_1:[ {on:'out',if:{stackMin:{app:5}},critMore:R(0.03)} ],                                               // Starving Swing
    ap_5_2:[ {stat:{aspd:0.15},if:{window:'feast'}} ],                                                          // Greedy Gut (PICK ONE)
    ap_5_3:[ {param:'dish',add:0.5} ],                                                                          // Pass the Dish (PICK ONE: glut)
    ap_7_4:[ {param:'girth.max',add:R(1)} ],                                                                    // Waistline
    ap_9_1:[ {on:'out',if:{casting:CF,fn:'tgtBig'},more:R(0.02)} ],                                             // Picky Eater
    ap_6_3:[ {param:'dish.more',add:R(0.05)} ],                                                                 // Generous Helping (glut)
    ap_9_4:[ {param:'tbtf',add:1} ],                                                                            // Too Big to Fall (scan)
    ap_10_1:[ {param:'rav',add:R(0.003)} ],                                                                     // Ravenous (cfKit)
    ap_10_2:[ {param:'aye',add:1}, {stat:{atk:R(0.01)},per:'aye'} ],                                            // All You Can Eat (death)
    ap_10_4:[ {param:'hw',add:R(0.01)} ],                                                                       // Heavyweight (reck)
    ap_11_1:[ {stat:{aspd:R(0.002)},per:'app'} ],                                                               // Empty Belly
    ap_11_2:[ {param:'dinner',add:1} ],                                                                         // Sit Down to Dinner (reck)
    ap_11_3:[ {param:'dr.belly',add:R(0.02)} ],                                                                 // Belly Armor (drK)
    ap_12_1:[ {on:'num',skill:'collect',more:R(0.05)} ],                                                        // Licked Clean
    ap_12_2:[ {param:'glut.table',add:R(0.002)} ],                                                              // The Table Is Laid (glut)
    ap_12_3:[ {on:'kit',skill:RK,opt:{dur:{add:R(0.2)}}} ],                                                     // Long Lunch
    ap_12_4:[ {on:'hit',if:{targetTeam:'enemy',stackFull:'girth'},do:[{slow:R(0.05),dur:1,on:'target'}]} ],     // Immovable Feast
    ap_13_2:[ {on:'tick',edge:true,once:'fight',if:{selfHpBelow:0.25},do:[{fn:'eie'}]} ]                        // Everything Is Eaten (SIGNATURE)
  },
  fn:{
    /* ---- small conditions ---- */
    tgtDebt(A,T,u,c){ return inDebt(u,c.tgt); },
    tgtDebtHigher(A,T,u,c){ return inDebt(u,c.tgt)&&hpf(c.tgt)>hpf(u); },
    debtor(A,T,u,c){ return inDebt(u,c.tgt); },
    unitDebtor(A,T,u,c){ return !!c.unit&&c.unit.team!==u.team&&inDebt(u,c.unit); },
    deadDebtor(A,T,u,c){ const x=c.unit; return !!x&&x.team!==u.team&&x._debtTo===u&&(x._debtT||0)>0; },
    anyDebt(A,T,u){ for(const x of foes(A,T,u)) if(inDebt(u,x)) return true; return false; },
    walk(A,T,u){ const t=u.target; return !!t&&t.alive&&t.team!==u.team&&A.ustGet(T,u,t,'owed')>=3; },
    tgtSW(A,T,u,c){ return isSW(T,u,c.tgt); },
    srcSW(A,T,u,c){ return isSW(T,u,c.src); },
    unitSW(A,T,u,c){ return isSW(T,u,c.unit); },
    tgtSWpre(A,T,u,c){ const t=c.tgt; return !!t&&t.team!==u.team&&preHp(c)<swThr(T); },
    deadSW(A,T,u,c){ const x=c.unit; return !!x&&x.team!==u.team&&!!A.markOf(u,x,'sw'); },
    heavy50(A,T,u,c){ const t=c.tgt; return !!t&&t.alive&&t.team!==u.team&&preHp(c)>=hpf(u)+0.5-1e-9; },
    higherPre(A,T,u,c){ const t=c.tgt; return !!t&&t.alive&&t.team!==u.team&&preHp(c)>hpf(u); },
    tgtBig(A,T,u,c){ const t=c.tgt; if(!t||t.team===u.team) return false; for(const x of foes(A,T,u)) if((x.maxHp||0)>(t.maxHp||0)) return false; return true; },
    eaten(A,T){ return T.s.cfEat||0; },
    cfN(A,T){ return Math.min(4,T.s.cfN||0); },
    /* Tipped Scales: each whole 10% by which the enemy's HP share is above his (The Heaviest Pays: twice against the enemy In Debt) */
    tilt(A,T,u,c){ const t=c.tgt; if(!t||t.team===u.team) return 0; const g=hpf(t)-hpf(u); if(!(g>0)) return 0; let n=Math.floor(g*10+1e-9); if(T.P.heavy&&inDebt(u,t)) n*=2; return n; },
    /* ---- THE PANS. Left: damage he takes (hits), right: damage he deals (hits); both empty every 4 s (Fine Weights: longer). A tip = the heavier pan is now the
       other one than the last heavier pan. leftK / rightK: the strength of Two Pans' own bonus on that side (Thumb on the Scale: 0.6 each, always; Honest
       Measure: 2 each while level; the settle: at least 1 each; Fair Exchange: doubled inside The Reckoning). The "while the left / right pan is heavier"
       talents hold while that strength is above 0 ---- */
    level(A,T,u,x){ const p=pan(T), m=Math.max(p.L,p.R); return m>0&&Math.abs(p.L-p.R)<=(0.10+(x||0))*m+1e-9; },
    leftK(A,T,u){ const p=pan(T), Pp=T.P; let k=Pp.thumb?0.6:(p.L>p.R?1:0); if(Pp.honest&&T.fn.level(A,T,u,Pp.level||0)) k=2; if(A.winOn(T,'settle')) k=Math.max(k,1); if(Pp.fairx&&A.winOn(T,'reck')) k*=2; return k; },
    rightK(A,T,u){ const p=pan(T), Pp=T.P; let k=Pp.thumb?0.6:(p.R>p.L?1:0); if(Pp.honest&&T.fn.level(A,T,u,Pp.level||0)) k=2; if(A.winOn(T,'settle')) k=Math.max(k,1); if(Pp.fairx&&A.winOn(T,'reck')) k*=2; return k; },
    panL(A,T,u,c){ const p=pan(T), a=Math.max(0,c.amt||0); p.L+=a; if(T.P.fairx&&A.winOn(T,'reck')) p.R+=a; T.fn.tipChk(A,T,u,c); },
    panR(A,T,u,c){ const p=pan(T); p.R+=Math.max(0,c.amt||0); T.fn.tipChk(A,T,u,c); },
    tipChk(A,T,u){ const p=pan(T), cur=p.L>p.R?'L':(p.R>p.L?'R':null); if(cur&&p.side&&cur!==p.side) A.run(T,u,'tip',{u,tgt:u}); if(cur) p.side=cur; },
    /* ---- his damage-reduction talents: ONE group. Each multiplies (Phil's combining rule); together they never take more than 30% off a hit ---- */
    drK(A,T,u,c,dot){ const Pp=T.P, s=c.src; let k=1; const f=x=>{ if(x>0) k*=1-Math.min(0.95,x); };
      if(Pp['dr.fee']) f(Pp['dr.fee']*A.stGet(T,'fee'));                                   // Keep the Change: per Fee
      if(s&&s.team!==u.team){
        if(Pp['dr.late']&&A.ustGet(T,u,s,'owed')>=3) f(Pp['dr.late']);                      // Late Payment: from an enemy that owes 3 or more
        if(Pp['dr.hard']&&inDebt(u,s)) f(Pp['dr.hard']);                                   // Hard Bargain: from the enemy In Debt
        if(Pp['dr.steep']&&hpf(s)>hpf(u)) f(Pp['dr.steep']);                               // Steep Tilt: from a healthier enemy
        if(Pp['dr.bread']&&isSW(T,u,s)) f(Pp['dr.bread']);                                 // Price of Bread: from a Short Weight enemy
        if(Pp['dr.warn']&&A.markOf(u,s,'tnt')) f(Pp['dr.warn']); }                         // Fair Warning: from an enemy The Reckoning taunted
      if(Pp['dr.pan']) f(Pp['dr.pan']*T.fn.leftK(A,T,u));                                    // Two Pans: the left pan heavier
      if(Pp['dr.bal']&&c.crit&&T.fn.leftK(A,T,u)>0) f(Pp['dr.bal']);                         // Balanced Stance: a critical hit while the left pan is heavier
      if(Pp['dr.belly']&&c.crit) f(Pp['dr.belly']);                                          // Belly Armor: a critical hit
      if(Pp['dr.steady']) f(Pp['dr.steady']*A.stGet(T,'tip'));                               // Steady Hand: per tip this wave
      if(Pp['dr.girth']) f(Pp['dr.girth']*A.stGet(T,'girth'));                               // Girth
      if(Pp['dr.gorge']&&A.winOn(T,'feast')) f(Pp['dr.gorge']);                              // Gorge: while Feasting
      if(dot){ if(Pp['dr.gut']) f(Pp['dr.gut']); if(Pp['dr.stom']) f(Pp['dr.stom']); }      // Iron Gut, Iron Stomach: damage over time
      return Math.max(DR_FLOOR,k); },
    myDr(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c,false); },
    myDrDot(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c,true); },
    /* his control-shortening talents: Heavy to Shift (every control), Sure Footing (stuns), Fixed Price (silences). Each multiplies; at most 35% shorter */
    ten(A,T,u,c){ const Pp=T.P; let k=1-(Pp['ten.all']||0); if(c.field==='stunned') k*=1-(Pp['ten.stun']||0); if(c.field==='silencedT') k*=1-(Pp['ten.sil']||0); c.amt*=Math.max(TEN_FLOOR,k); },
    /* his critical-chance talents (Measured Blows while the right pan is heavier, Gnawing Hunger per Appetite): with Forty Towns' plain 1% per rank, at most 5% */
    critT(A,T,u){ const Pp=T.P; let x=0; if(Pp['crit.mb']&&T.fn.rightK(A,T,u)>0) x+=Pp['crit.mb']; if(Pp['crit.gh']) x+=Pp['crit.gh']*A.stGet(T,'app');
      return Math.max(0,Math.min(x,CRIT_CAP-0.01*(T.r.le_7_3||0))); },
    /* ---- the regeneration cap: his per-second talent healing (the Gluttony talents' extra, Full Balance) on him together at most 1.2% of his max HP a second ---- */
    room(A,T,u,dt){ const s=T.s, now=A.eng().now(); if(s.rgAt!==now){ s.rgAt=now; s.rgU=0; } return Math.max(0,REGEN*(u.maxHp||0)*dt-s.rgU); },
    /* ---- COINFLAIL at its arrival (kit; the options it then uses): Wide Swing's arc, Heavy Coins' reach, Short Weight's aim (the nearest Short Weight enemy),
       how many enemies it will hit (Bookkeeper; counted body to body, as the skill measures after release v1391), the Appetite it eats (Rumbling, Clean Plate,
       Ravenous), Call It In's 10 Fee ---- */
    cfKit(A,T,u,c){ const o=c.o, s=T.s, Pp=T.P, E=A.eng(), M=E.METER(); if(!o) return;
      if(Pp['cf.ang']) o.angle=(o.angle||45)+Pp['cf.ang'];
      if(Pp['cf.r']) o.radius=(o.radius||3*M)+Pp['cf.r']*M;
      const F=foes(A,T,u);
      if(Pp['sw.turn']&&o._arrived){ let b=null, bd=Infinity; for(const x of F){ if(!isSW(T,u,x)) continue; const d=E.dist(u,x); if(d<bd){ bd=d; b=x; } } if(b) o._tgtU=b; }
      if(T.r.le_12_1){ let t=(o._arrived&&o._tgtU)?o._tgtU:((u.target&&u.target.alive)?u.target:null);
        if(!t){ let bd=Infinity; for(const x of F){ const d=E.dist(u,x); if(d<bd){ bd=d; t=x; } } }
        const dir=t?Math.atan2(t.y-u.y,t.x-u.x):(u.team==='ally'?0:Math.PI), R=o.radius||3*M, half=((o.angle||45)*Math.PI/180)/2; let n=0;
        for(const x of F){ if(!(E.dist(u,x)-E.bodyR(x)<=R)) continue; let a=Math.atan2(x.y-u.y,x.x-u.x)-dir; while(a>Math.PI)a-=2*Math.PI; while(a<-Math.PI)a+=2*Math.PI; if(Math.abs(a)<=half) n++; }
        s.cfN=n; }
      if(learned(T,APP)){ const n=A.stGet(T,'app'); s.cfEat=n; A.stSet(T,u,'app',0);
        if(n>0){ let h=(Pp.rav||0)*n; if(Pp.plate&&n>=10) h+=0.08; if(h>0) E.healUnit(u,h*u.maxHp); } }
      if(Pp.cii&&A.stGet(T,'fee')>=20){ A.stSet(T,u,'fee',A.stGet(T,'fee')-10); s.cii=1; } },
    cfEnd(A,T){ const s=T.s; s.cii=0; s.cfEat=0; s.cfN=0; },
    /* each enemy Coinflail hits: its Owed collected (Itemised heals, Square Accounts stuns at 5, Collections at 3), then cleared; Call It In puts it In Debt 3 s */
    collect(A,T,u,c){ const t=c.tgt, s=T.s, Pp=T.P, E=A.eng(); if(!t) return;
      if(learned(T,OWED)){ const n=A.ustGet(T,u,t,'owed'); if(n>0){ if(Pp.item) E.healUnit(u,Pp.item*n*u.maxHp); if(Pp.sq&&n>=5&&t.alive) A.control(T,u,t,'stunned',0.8);
          if(Pp.coll&&n>=3) u.greenCd=Math.max(0,(u.greenCd||0)-Pp.coll); A.ustPut(T,u,t,'owed',0); } }
      if(s.cii&&t.alive){ const was=inDebt(u,t), pct=((u.blueAb&&u.blueAb.pct)||0.35)*(Pp.two?0.75:1); t._debtTo=u; t._debtT=Math.max(was?(t._debtT||0):0,3);
        if(!was){ t._debtPct=pct; t._talDb=pct; } } },
    /* ---- WEIGH THE DEBT. Its mark (skillTgt): The Heaviest Pays picks the highest HP share instead of the highest max HP; Two Ledgers keeps the next one. Then
       (cast) the debt as written: Two Ledgers puts the second one In Debt too (not struck), each at three quarters of the cut; the cut is kept for Interest ---- */
    wdTgt(A,T,u,c){ const s=T.s, Pp=T.P, key=Pp.heavy?hpf:(x=>x.maxHp||0); const L=foes(A,T,u).map(x=>[x,key(x)]); L.sort((a,b)=>b[1]-a[1]);
      if(Pp.heavy&&L.length) c.tgt=L[0][0]; s.wd1=c.tgt||null; const n=Pp.two?L.find(e=>e[0]!==c.tgt):null; s.wd2=n?n[0]:null; },
    wdCast(A,T,u){ const s=T.s, a=s.wd1, b=s.wd2; s.wd1=null; s.wd2=null; if(!a||a._debtTo!==u) return; const k=T.P.two?0.75:1;
      a._debtPct=(a._debtPct||0.35)*k; a._talDb=a._debtPct;
      if(b&&b.alive){ b._debtTo=u; b._debtT=a._debtT; b._debtPct=a._talDb; b._talDb=a._talDb; } },
    /* Debt Sold On: the debt (with the time it had left; New Owner: longer) and its Interest pass to the living enemy with the highest max HP that is not In Debt */
    soldOn(A,T,u,c){ const x=c.unit; if(!x||x._talSold) return; x._talSold=1; let n=null; for(const y of foes(A,T,u)) if(y!==x&&!inDebt(u,y)&&(!n||(y.maxHp||0)>(n.maxHp||0))) n=y; if(!n) return;
      n._debtTo=u; n._debtT=Math.max(0,x._debtT||0)+(T.P['sold.dur']||0); n._debtPct=x._talDb!=null?x._talDb:(x._debtPct||0.35); n._talDb=n._debtPct; n._talSold=0;
      const k=A.ustGet(T,u,x,'int'); if(k>0) A.ustPut(T,u,n,'int',k); const ia=T.s.ia; if(ia) ia[n.uid]=ia[x.uid]||0; },
    /* No Forgiveness: an enemy In Debt is never healed above 70% of its max HP */
    noForgive(A,T,u,c){ const x=c.unit; c.amt=Math.max(0,Math.min(c.amt,0.70*x.maxHp-x.hp)); },
    /* ---- ONE WALK A TICK: the pans' clock; Interest on each debtor (1 a second, Compound faster, max 6; the cut 1% per rank per Interest larger; cleared when the
       debt ends; at 6 the signature); Short Weight marks for Scrap Value; Full Balance; Too Big to Fall; The Scales Settle ---- */
    scan(A,T,u,c){ const s=T.s, Pp=T.P, r=T.r, E=A.eng(), dt=c.dt||0;
      if(learned(T,PANS)){ const p=pan(T); p.t+=dt; if(p.t>=4+(Pp['pan.hold']||0)-1e-9){ p.L=0; p.R=0; p.t=0; } }
      const useI=learned(T,INT), F=(useI||r.bs_7_1||Pp.stl)?foes(A,T,u):null;
      if(F) for(const x of F){
        if(useI){ const ia=s.ia||(s.ia={});
          if(inDebt(u,x)){ let a=(ia[x.uid]||0)+dt*(1+(Pp['int.rate']||0)), n=A.ustGet(T,u,x,'int'); const n0=n; while(a>=1-1e-9){ a-=1; if(n<6) n++; } ia[x.uid]=a;
            if(n!==n0) A.ustPut(T,u,x,'int',n); if(x._talDb!=null) x._debtPct=x._talDb*(1+(Pp['int.cut']||0)*n);
            if(n>=6&&n0<6&&Pp.wio) T.fn.wio(A,T,u,x); }
          else if(ia[x.uid]!=null||A.ustGet(T,u,x,'int')>0){ ia[x.uid]=null; A.ustPut(T,u,x,'int',0); } }
        if(r.bs_7_1&&isSW(T,u,x)) A.setMark(T,u,x,'sw',{dur:0.5}); }
      if(Pp.fb&&T.fn.level(A,T,u,0)){ const g=Math.min(Pp.fb*u.maxHp*dt,T.fn.room(A,T,u,dt)); if(g>0){ s.rgU+=g; E.healUnit(u,g); } }
      if(Pp.tbtf&&A.stGet(T,'girth')>=A.stMax(T,u,'girth')-1e-9) u._gearImmovableT=Math.max(u._gearImmovableT||0,0.1);
      if(Pp.stl&&!A.winOn(T,'settle')&&!(E.now()<(s.stlCd||0))){ const p=pan(T), hv=Math.max(p.L,p.R), lt=Math.min(p.L,p.R);
        if(hv>0&&hv>=2*lt){ let b=null; for(const x of F) if(A.gap(u,x)<6*E.METER()&&(!b||hpf(x)>hpf(b))) b=x;
          if(b){ s.stlCd=E.now()+25; s.stl={x:b,left:(isBoss(b)?0.05:0.20)*b.maxHp}; A.acts(T,u,[{window:'settle',dur:5}],c); } } } },
    /* What Is Owed: the debt is called in - each Owed and Interest worth 30% of his attack, through the enemy's armor; stunned 1.5 s; he heals half of what it
       took; its debt, Owed and Interest are gone. Once every 20 s */
    wio(A,T,u,x){ const s=T.s, E=A.eng(); if(E.now()<(s.wioCd||0)) return; s.wioCd=E.now()+20;
      const n=A.ustGet(T,u,x,'owed')+A.ustGet(T,u,x,'int'), a=0.30*n*A.amtOf(T,u,{pct:1,of:'atk'},{})*E.defMul(u,x,'phys');
      const lost=A.hurt(T,u,x,a,'#e0b040','owed'); if(x.alive) A.control(T,u,x,'stunned',1.5); if(lost>0) E.healUnit(u,lost*0.5);
      A.ustPut(T,u,x,'owed',0); A.ustPut(T,u,x,'int',0); if(s.ia) s.ia[x.uid]=null; x._debtT=0; x._debtTo=null; },
    /* The Scales Settle: while his HP share is below his weighed enemy's, half of each hit on him (after his own reductions) is dealt to it instead, up to 20% of
       its max HP each settle (a boss: 5%) */
    settleIn(A,T,u,c){ const st=T.s.stl, x=st&&st.x; if(!x||!x.alive||!(st.left>0)||!(hpf(u)<hpf(x))) return; const mv=Math.min(c.amt*0.5,st.left); if(!(mv>0)) return;
      c.amt-=mv; st.left-=mv; A.hurt(T,u,x,mv,'#e0b040','settle'); },
    /* ---- GLUTTONY, each tick (ctx.amt = what it heals this tick, before it is written onto his HP). Appetite: each second it has nothing to heal (Snacking: faster;
       Hungry Eyes: below 50% HP at 20% per rank of that speed). The Gluttony talents (Feast, Gluttonous Measure, The Table Is Laid) add to it, together at most
       1.2% of his max HP a second; Everything Is Eaten triples it (its extra at most 6% a second). What it really heals counts toward Girth. Pass the Dish:
       while Feasting the most wounded ally within 5 m heals half as much (Generous Helping: more), at most 1.2% of that ally's max HP a second ---- */
    glut(A,T,u,c){ const s=T.s, Pp=T.P, E=A.eng(), base=c.amt||0, rate=(u.maxHp||0)*0.04*(u.passMul||1), dt=rate>0?base/rate:0, room0=E.healCap(u)-u.hp;
      if(learned(T,APP)){ let a=s.apA||0; const sp=1+(Pp['app.rate']||0); if(room0<=1e-9) a+=dt*sp; else if(Pp['app.low']&&u.hp<0.5*u.maxHp) a+=dt*Pp['app.low']*sp;
        while(a>=1-1e-9){ a-=1; A.stSet(T,u,'app',A.stGet(T,'app')+1); } s.apA=a; }
      let k=0; if(A.winOn(T,'feast')) k+=Pp['glut.feast']||0; if(Pp['glut.lm']&&T.fn.leftK(A,T,u)>0) k+=Pp['glut.lm']; if(Pp['glut.table']) k+=Pp['glut.table']*A.stGet(T,'girth');
      let ex=0; if(k>0){ ex=Math.min(base*k,T.fn.room(A,T,u,dt)); s.rgU+=ex; }
      const ex2=A.winOn(T,'eie')?Math.min(base*2,EIE_CAP*u.maxHp*dt):0;
      c.amt=base+ex+ex2;
      if(learned(T,GIRTH)) T.fn.girthAdd(A,T,u,Math.max(0,Math.min(c.amt,room0)));
      if(Pp.dish&&A.winOn(T,'feast')){ let b=null; for(const x of A.pick(T,u,{team:'ally',within:5,others:true},{})) if(!b||hpf(x)<hpf(b)) b=x;
        if(b&&b.hp<E.healCap(b)) E.healUnit(b,Math.min(c.amt*Pp.dish*(1+(Pp['dish.more']||0)),REGEN*b.maxHp*dt)); } },
    /* Girth: every 10% of his max HP Gluttony heals this wave adds 1 */
    girthAdd(A,T,u,amt){ const s=T.s; if(!(amt>0)) return; s.ga=(s.ga||0)+amt; const step=0.10*(u.maxHp||1); if(s.ga>=step){ const n=Math.floor(s.ga/step+1e-9); s.ga-=n*step; A.stSet(T,u,'girth',A.stGet(T,'girth')+n); } },
    girthOf(A,T,u,c){ T.fn.girthAdd(A,T,u,c.amt||0); },
    /* Slow Digest: heals from anything but himself (his skills, passive, talents, lifesteal) */
    ownH(A,T){ T.s.ownH=true; },
    inHit1(A,T){ T.s.inHit=1; }, inHit0(A,T){ T.s.inHit=0; },
    fromOthers(A,T){ const s=T.s; if(s.ownH){ s.ownH=false; return false; } return !(s.d>0)&&!s.inHit; },
    /* ---- FEAST. An enemy he hit in the last 3 s dies: he Feasts for 3 s (Long Supper: longer); All You Can Eat: a Feast already running gets 1 s more and a stack
       of attack; Everything Is Eaten: during its 5 s every enemy death is a Feast that adds 1 s. Each Feast is the 'feast' event (Rich Sauce) ---- */
    death(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team) return; const eie=A.winOn(T,'eie'); if(!eie&&!A.markOf(u,x,'fed')) return; T.fn.feastOn(A,T,u,c,eie?1:0,true); },
    feastOn(A,T,u,c,plus,kill){ const s=T.s, Pp=T.P, d=3+(Pp['feast.dur']||0), w=s.w.feast, on=!!w&&w.t>0;
      if(on&&kill&&Pp.aye){ w.t+=1; A.stSet(T,u,'aye',A.stGet(T,'aye')+1); }
      A.acts(T,u,[{window:'feast',dur:d,longest:true}],c); if(plus) s.w.feast.t+=plus; A.run(T,u,'feast',c); },
    eie(A,T,u,c){ A.acts(T,u,[{window:'eie',dur:5}],c); A.stSet(T,u,'girth',A.stGet(T,'girth')+10); A.stSet(T,u,'app',A.stGet(T,'app')+10); },
    /* ---- THE RECKONING, after the cast: the enemies whose forced target is now him; its window; Fair Warning marks them; Day of Reckoning: each owes 3 at once;
       Sit Down to Dinner: he Feasts while it lasts and gets 1 Girth for each; Heavyweight: at 5 Girth its cut is 1 point per rank stronger (the skill slot) ---- */
    reck(A,T,u,c){ const Pp=T.P, d=(c.o&&c.o.dur)||4, L=foes(A,T,u).filter(x=>x.forcedTarget===u&&(x.forcedTargetT||0)>0);
      A.acts(T,u,[{window:'reck',dur:d}],c);
      for(const x of L){ if(Pp['dr.warn']) A.setMark(T,u,x,'tnt',{dur:x.forcedTargetT}); if(Pp.dor) A.ustPut(T,u,x,'owed',Math.min(T.st.owed.max,A.ustGet(T,u,x,'owed')+3)); }
      if(Pp.dinner){ A.acts(T,u,[{window:'feast',dur:d,longest:true}],c); A.run(T,u,'feast',c); if(L.length) A.stSet(T,u,'girth',A.stGet(T,'girth')+L.length); }
      if(Pp.hw&&A.stGet(T,'girth')>=5&&(u.drT||0)>0) u.drMul=Math.max(0.05,(u.drMul==null?1:u.drMul)-Pp.hw); },
    reckEnd(A,T,u){ let n=0; for(const x of foes(A,T,u)) if(inDebt(u,x)) n+=A.ustGet(T,u,x,'int'); if(n>0) A.stSet(T,u,'fee',A.stGet(T,'fee')+n); },
    /* ---- waves: Fee for the rest of the wave (Rainy Day keeps 2 per rank, Opening Balance starts 3 per rank); Girth this wave (Second Belt keeps 1 per rank);
       Midnight Snack: 3 Appetite per rank; the pans empty ---- */
    waveEnd(A,T){ const s=T.s, Pp=T.P; s.feeK=Math.min(A.stGet(T,'fee'),Pp['fee.keep']||0); s.girK=Math.min(A.stGet(T,'girth'),Pp['girth.keep']||0); },
    waveStart(A,T,u){ const s=T.s, Pp=T.P;
      if(learned(T,FEE)) A.stSet(T,u,'fee',(s.feeK||0)+(Pp['fee.open']||0));
      if(learned(T,GIRTH)){ A.stSet(T,u,'girth',s.girK||0); s.ga=0; }
      if(Pp['app.open']) A.stSet(T,u,'app',A.stGet(T,'app')+Pp['app.open']);
      s.pan=null; A.stSet(T,u,'aye',0); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/26 - GRUEL - talent decisions.md) */
  ruling:{}
};
