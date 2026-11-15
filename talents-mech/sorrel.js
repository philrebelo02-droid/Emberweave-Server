/* SORREL - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Sorrel")
   His real kit (the code, not the tooltip wording; a mid-row Assassin whose damage profile is Attack: every hit of his is physical; 13.6 m reach, a swing every 1.9 s):
   - Marked Deal ('volley', single, green, cd 6): three cards into the NEAREST enemy (anywhere: no reach), thrown 0.15 s apart, each landing 0.30 s after it
     leaves (0.30 / 0.45 / 0.60 s), each 75% of his attack x skill level; right after the third lands the enemy carries the game's mark (_markT 6 s, _markMul
     1.22: it takes 22% more damage from everyone). Its cards land through the shared 'volley' landing pair (landPre / land), so his rows see each card.
   - House Edge ('haste', self, blue, cd 9): his attack speed x(1.32 + 0.002 a level) for 6 s (x1.518 at level 100), whether a marked enemy stands or not.
   - Grand Reveal (ultimate 'volley', ULT_DEF mul 1.4, n 6): one card into each of the nearest 6 enemies (anywhere), each landing 0.30 s after the cast.
   - Loaded Hand (passive 'loadedhand'): every fourth SWING (counted at the wind-up, before the blow lands) draws a seeded suit: 0 a heavy hit (90% of the
     swing's damage x the passive's multiplier, a second hit), 1 a stun (0.5 s x0.7 = 0.35 s x (1 - control resist), written straight on), 2 an armour break
     (25% x the multiplier for 4 s: 54.7% at level 100), 3 a heal (50% of the swing's damage x the multiplier on him). With any talent of his learned his rows
     run the draw (one guarded page line: the num hook 'lhSwing'), with the same seeded draw and the same four suits, so his talents can count, palm,
     repeat and strengthen them.
   Palm, Count, the Wild Card, the Streak, Double or Nothing, Signed and Markers exist only through his talents. "Marked" = carrying the game's mark.
   Readings, caps and corrected tooltips: WIRING/54 - SORREL - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const V='volley', HE='haste';
const DR_FLOOR=0.75, CRIT_CAP=0.05, REGEN=0.012, CC_TOP=4.0, SHRED_TOP=0.75, SIG_CD=20, ACE_AT=0.25, ACE_BOSS=0.12, TS_TOP=15;
const HEAVY=0, STUN=1, ARMOR=2, HEAL=3;
/* the families several talents share: their bookkeeping runs when any of these is learned */
const PALM=['sd_1_1','sd_2_1','sd_3_1','sd_6_1','sd_7_1','sd_8_1','sd_9_1','sd_11_1','sd_13_2'];
const COUNT=['sd_1_4','sd_3_4','sd_5_4','sd_7_4','sd_9_4','sd_12_1','sc_n1'];
const STREAK=['hc_1_4','hc_3_4','hc_5_4','hc_7_1','hc_7_4','hc_9_4','hc_13_2'];
const SIGNED=['sc_1_1','sc_2_1','sc_3_1','sc_n1','sc_4_1','sc_6_1','sc_7_1','sc_9_2','sc_8_1','sc_9_1','sc_10_1','sc_n3','sc_11_1','sc_11_2','sc_12_2','sc_12_4','sc_13_2','sc_1_4','sc_3_4','sc_5_4','sc_7_4','sc_9_4','sc_12_1'];
const MARKER=['sc_1_4','sc_3_4','sc_5_4','sc_7_4','sc_9_4','sc_12_1','sc_13_2'];
const DRME=['sd_6_4','hc_7_1','hc_11_3','sc_6_3','sc_12_4'];                     // hits on him: ONE capped group (25%)
const CRT=['sd_11_3','hc_1_2','sc_11_3','sd_3_4','sc_2_1'];                     // critical chance: ONE group, at most 5%
const MARKSEEN=['sd_6_4','sc_6_3','sc_5_3','sc_5_2'];                           // rows that ask whether a marked enemy stands
const S=T=>T.s.so||(T.s.so={});                     // his own per-fight state (one object, so no name of the runtime's own is ever used)
const rk=(T,id)=>T.r[id]||0;
const has=(T,L)=>L.some(id=>T.r[id]);
const foe=(u,x)=>!!x&&x.team!==u.team;
const marked=x=>!!x&&x.alive&&(x._markT||0)>0;
const gainE=(x,n)=>{ if(x&&x.alive&&n>0) x.energy=Math.min(100,(x.energy||0)+n); };
const enemies=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget&&!(x._riseT>0));   // the engine's enemiesOf
const signed=(A,u,x)=>!!x&&!!A.markOf(u,x,'sg');
const atkNow=(A,u)=>(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*A.eng().rage();   // a swing's damage now (Loaded Hand's base)
const bits=m=>{ let n=0; for(let i=0;i<5;i++) if(m&(1<<i)) n++; return n; };
/* one real hit of his (the bound strike: dealDamage with no pre-rolled crit and not a basic attack), with the runtime's action depth put back to 0 so his own
   out / hit / crit rows see it as his (WIRING/03, Nox: cast0) */
function strike0(A,T,u,t,amt,color){ const E=A.eng(), s=T.s, d=s.d; if(!E.strike||!t||!t.alive||!(amt>0)) return; s.d=0; try{ E.strike(u,t,amt,color); } finally{ s.d=d; } }
module.exports={
  hero:'sorrel',
  times:['so.st.*','so.rgAt'],                        // his own absolute fight times (when each enemy's stun of his ends, the heal budget's clock): moved back with the wave clock (WIRING/41c)
  states:{
    soStr:{max:4},                                      // the Streak
    soCnt:{max:5},                                      // Count (for the wave; Long Count keeps some: wv)
    soBd:{max:6,wave:'reset'},                          // Bottom Deal: palmed suits played this wave
    soDc:{max:10,wave:'reset'},                         // Dealer's Choice: suits played this wave
    soMk:{max:3},                                       // Markers (kept until spent)
    soStl:{max:10}                                      // Saving the Last: Signed enemies dead this fight
  },
  /* run for him whenever he has any mechanic talent: Loaded Hand's draw, his cards, House Edge, and the bookkeeping of the states his talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]}, {on:'wave',do:[{fn:'wv'}]},
    {on:'num',skill:'lhSwing',do:[{fn:'lhSwing'}]},                                                            // Loaded Hand: his rows run the draw (the page's base block is skipped)
    {on:'kit',skill:V,do:[{fn:'kitV'}]},                                                                       // Marked Deal / Grand Reveal: which cards will land where
    {on:'landPre',skill:V,do:[{fn:'cardPre'}]}, {on:'land',skill:V,do:[{fn:'cardPost'}]},                       // each card as it lands
    {on:'cast',skill:HE,do:[{fn:'heCast'}]},                                                                   // House Edge's window (and its speed made stronger)
    {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'myHit'}]},                                                      // energy from his basic attacks, Bust's next hit
    {on:'kill',do:[{fn:'myKill'}]},                                                                            // Table Stakes, Settling Up
    {on:'death',reqAny:SIGNED,do:[{fn:'dth'}]},                                                                // a Signed enemy died: Markers, Good Coat, Saving the Last
    {on:'teamIn',reqAny:['sc_7_1','hc_6_2','sc_n3'],do:[{fn:'tIn'}]},                                         // his team's hits on Signed / Bust enemies
    {on:'teamHeal',reqAny:['sc_6_1'],do:[{fn:'ink'}]},                                                         // Signed in Ink
    {on:'out',reqAny:['sc_12_3','sc_n3'],if:{targetTeam:'enemy',fn:'anyCard'},do:[{fn:'cardOut'}]},           // First Impression, Everyone Signs
    {on:'in',reqAny:DRME,do:[{fn:'myIn'}]}, {on:'dotIn',reqAny:DRME,do:[{fn:'myDot'}]},                       // his damage reduction: ONE capped group (25%)
    {on:'crit',reqAny:CRT,chance:{flat:1,x:{fn:'critP'}},force:true}                                           // his critical-chance talents: ONE group, at most 5%
  ],
  talents:{
    /* ============================== THE STACKED DECK ============================== */
    sd_1_1:[ {param:'palm.k',add:R(0.04)} ],                                                                    // Up the Sleeve (Palm: draw)
    sd_2_3:[ {stat:{move:R(0.03)}} ],                                                                           // Light Paws
    sd_1_4:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.01),per:{fn:'cntN'}} ],                                // Counting Cards (no repeats: draw; Count: round)
    sd_2_1:[ {stat:{aspd:R(0.04)},if:{fn:'palmHeld'}} ],                                                        // Quick Palm
    sd_2_2:[ {on:'out',if:{targetTeam:'enemy',fn:'mdCard'},more:R(0.03)} ],                                     // Edged Cards
    sd_11_3:[],                                                                                                 // Measured Throw (critP)
    sd_3_1:[ {param:'palm2',add:1} ],                                                                           // Second Sleeve
    sd_4_2:[ {on:'out',if:{targetTeam:'enemy',fn:'tMarked'},more:R(0.01)} ],                                    // Deeper Mark
    sd_3_3:[ {param:'mark.add',add:R(0.4)} ],                                                                   // Long Mark (kitV)
    sd_3_4:[],                                                                                                  // Card Sharp (critP)
    sd_5_4:[ {param:'co',add:R(0.2)} ],                                                                         // Counted Out (round)
    sd_5_2:[ {param:'mc',add:1} ],                                                                              // Marked Cards (PICK ONE: lhSwing)
    sd_5_3:[ {param:'cd.st',add:0.5}, {param:'cd.hl',add:0.30} ],                                               // Clean Deck (PICK ONE: play)
    sd_4_3:[ {param:'nrg.auto',add:R(0.03)} ],                                                                  // Dealer's Patience (myHit)
    sd_n1:[  {param:'rng',add:R(0.03)} ],                                                                       // Long Deal (tk)
    sd_6_2:[ {on:'out',req:'sd_5_2',if:{auto:true,targetTeam:'enemy',fn:'tMarked'},more:R(0.02)} ],             // Fast Shuffle (while Marked Cards is chosen)
    sd_6_3:[ {param:'ab.k',add:R(0.05)} ],                                                                      // House Rules (needs Clean Deck)
    sd_6_1:[ {on:'out',if:{targetTeam:'enemy',fn:'palmHeld'},ignoreArmor:R(0.02)} ],                            // Cold Read
    sd_6_4:[ {param:'dr.lf',add:R(0.02)} ],                                                                     // Lamp Flame (his group)
    sd_7_1:[ {param:'slh',add:R(0.04)} ],                                                                       // Sleight of Hand (a palmed heavy hit)
    sd_7_3:[ {on:'out',if:{targetTeam:'enemy',fn:'ultCard'},more:R(0.03)} ],                                    // Fanned Deck
    sd_7_4:[ {param:'fh',add:R(0.05)} ],                                                                        // Full House (play)
    sd_8_1:[ {param:'cuff',add:R(0.05)} ],                                                                      // Card Up Each Cuff (wv)
    sd_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                             // Quick Deal
    sd_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'tMarked'},critMore:R(0.02)} ],                                // Read the Table (at most 10%)
    sd_9_1:[ {param:'cool',add:1} ],                                                                            // The Cooler (kitV)
    sd_9_2:[ {on:'out',if:{targetTeam:'enemy',fn:'card2'},more:R(0.05)} ],                                      // Second Card
    sd_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.40},more:R(0.02)} ],                              // Point First
    sd_9_4:[ {param:'stk',add:1} ],                                                                             // Stacked Deck (round)
    sd_n2:[  {param:'ts',add:R(0.1)} ],                                                                         // Table Stakes (myKill)
    sd_10_2:[ {param:'he.k',add:R(0.03)} ],                                                                     // House Advantage (heCast)
    sd_11_1:[ {stat:{atk:R(0.005)},per:'soBd'} ],                                                               // Bottom Deal (play)
    sd_11_2:[ {param:'haw',add:1} ],                                                                            // House Always Wins (lhSwing)
    sd_10_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ],                                      // Steady Edge
    sd_12_1:[ {param:'lc',add:R(1)} ],                                                                          // Long Count (wv)
    sd_12_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.004),per:'soDc'} ],                                    // Dealer's Choice (play)
    sd_12_3:[ {param:'sh',add:R(1)} ],                                                                          // Shown Hand (cardPost)
    sd_12_4:[ {on:'out',once:'wave',if:{targetTeam:'enemy'},critMore:R(0.05)} ],                                 // Ace in the Cuff (at most 10%)
    sd_13_2:[ {param:'sigA',add:1} ],                                                                           // Every Card He Ever Palmed (SIGNATURE: kitV / cardPost)

    /* ============================== HONEST CARDS ============================== */
    hc_1_1:[ {param:'wild.k',add:R(0.04)} ],                                                                    // The Joker (the Wild Card: draw)
    hc_2_3:[ {stat:{move:R(0.03)}} ],                                                                           // Lucky Paws
    hc_1_4:[ {param:'str.k',add:R(0.03)} ],                                                                     // Hot Hand (the Streak: draw; its strength: play)
    hc_2_1:[ {param:'wild.p',add:R(0.03)} ],                                                                    // Wild Odds
    hc_2_2:[ {param:'don',add:R(0.04)} ],                                                                       // All or Nothing (Double or Nothing: draw)
    hc_1_2:[],                                                                                                  // Lucky Coat (critP)
    hc_3_1:[ {param:'jw',add:1} ],                                                                              // Wild Pair (was Jokers Wild; draw)
    hc_3_3:[ {param:'hv.k',add:R(0.04)} ],                                                                      // Hard Cards
    hc_3_4:[ {stat:{aspd:R(0.01)},per:'soStr'} ],                                                               // Running Hot
    hc_6_1:[ {param:'wild.g',add:R(0.05)} ],                                                                    // Joker's Grin
    hc_4_2:[ {param:'lir',add:R(0.10)} ],                                                                       // Ride the Next One (was Let It Ride)
    hc_4_3:[ {param:'nrg.draw',add:R(0.03)} ],                                                                  // Gambler's Nerve (draw)
    hc_6_4:[ {param:'st.add',add:R(0.1)} ],                                                                     // Shaking Paw (play)
    hc_5_1:[ {on:'ccIn',less:R(0.04),upTo:0.20} ],                                                              // Poker Face (at most 20%)
    hc_5_2:[ {param:'allin',add:1} ],                                                                           // All In (PICK ONE)
    hc_5_3:[ {param:'hedge',add:1} ],                                                                           // Hedge the Bet (PICK ONE)
    hc_5_4:[ {stat:{lifesteal:R(0.004)},per:'soStr'} ],                                                         // Winning Streak
    hc_6_2:[ {param:'bust',add:R(0.03),req:'hc_5_2'} ],                                                         // Bust (while All In is chosen)
    hc_6_3:[ {param:'safe',add:R(0.01)} ],                                                                      // Safe Money (needs Hedge the Bet; the heal budget)
    hc_7_1:[ {param:'dr.cc',add:R(0.015)} ],                                                                    // Charmed Coat (his group)
    hc_7_3:[ {param:'ab.k',add:R(0.04)} ],                                                                      // Broken Armour
    hc_7_4:[ {param:'ngc',add:R(1)} ],                                                                          // Never Goes Cold
    hc_8_1:[ {param:'fd',add:R(0.10)} ],                                                                        // Fast Draw (lhSwing)
    hc_8_2:[ {on:'out',if:{targetTeam:'enemy',fn:'mdCard'},more:R(0.03)} ],                                     // Spin the Deck
    hc_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'suitHit'},critMore:R(0.04)} ],                                // Lucky Strike (his suits only: at most 20%)
    hc_9_1:[ {param:'b2b',add:1} ],                                                                             // Back-to-Back (lhSwing)
    hc_9_2:[ {on:'out',if:{targetTeam:'enemy',fn:'suitMarked'},more:R(0.01)} ],                                 // Gambler's Mark
    hc_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.40},more:R(0.02)} ],                              // Close Game
    hc_9_4:[ {param:'ur',add:1} ],                                                                              // Unbroken Run (draw)
    hc_10_1:[ {param:'hl.k',add:R(0.04)} ],                                                                     // Green Lamp
    hc_10_2:[ {stat:{atk:R(0.01)},if:{window:'soFf'}} ],                                                        // Fortune's Favourite (draw: the window)
    hc_11_1:[ {stat:{aspd:R(0.03)},if:{window:'soWh'}} ],                                                       // Wild Chase (was Wild Hunt; draw: the window)
    hc_11_2:[ {param:'dmi',add:1} ],                                                                            // Deal Me In (draw)
    hc_11_3:[ {param:'dr.bl',add:R(0.02)} ],                                                                    // Bluff (his group)
    hc_12_1:[ {param:'l7',add:R(0.10)} ],                                                                       // Lucky Seven (draw)
    hc_12_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.01),per:{fn:'hhN'}} ],                                 // Honest Hands
    hc_12_3:[ {stat:{armor:R(0.03)},if:{selfHpBelow:0.5}} ],                                                    // Grin and Bear It
    hc_12_4:[ {param:'lchip',add:R(0.06)} ],                                                                    // Last Chip (play)
    hc_13_2:[ {param:'sigH',add:1} ],                                                                           // The Last Honest Hand (SIGNATURE: kitV / cardPost)

    /* ============================== SIGNED AND COLLECTED ============================== */
    sc_1_1:[ {on:'out',if:{targetTeam:'enemy',fn:'tSigned'},more:R(0.015)} ],                                   // First Card Says Hello (Signed: cardPost)
    sc_3_3:[ {on:'out',if:{targetTeam:'enemy',fn:'mdCard'},more:R(0.03)} ],                                     // Clean Throw
    sc_1_4:[ {param:'mk.k',add:R(0.25)} ],                                                                      // What's Owed (Markers: dth; the fourth card: kitV / card4)
    sc_2_1:[],                                                                                                  // Second Takes Measure (critP)
    sc_2_2:[ {param:'he.k',add:R(0.03)} ],                                                                      // Smell the End (heCast)
    sc_3_1:[ {param:'tst',add:1} ],                                                                             // Third Signs Them (kitV)
    sc_n1:[  {on:'out',if:{targetTeam:'enemy',fn:'anySigned'},more:0.02}, {param:'wit',add:1,req:'sd_1_4'} ],   // Witnessed (LINK: with Counting Cards, each Signed enemy counts as 1 Count)
    sc_4_3:[ {param:'nrg.mk',add:R(0.03)} ],                                                                    // Steady Breath (myHit)
    sc_3_4:[ {stat:{atk:R(0.01)},per:'soMk'} ],                                                                 // Collector
    sc_4_1:[ {param:'gc',add:R(0.01)} ],                                                                        // Good Coat (dth; the heal budget)
    sc_6_1:[ {param:'ink',add:R(0.04)} ],                                                                       // Signed in Ink (ink)
    sc_5_4:[ {param:'int',add:R(0.03)} ],                                                                       // Interest (kitV)
    sc_n2:[  {param:'cn',add:R(1)} ],                                                                           // Collector's Nerve (cardPost)
    sc_7_1:[ {param:'sft',add:R(0.01)} ],                                                                       // Signed for the Team (tIn)
    sc_6_4:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.03)} ],                                          // Fine Gloves
    sc_11_3:[],                                                                                                 // Taking Measure (critP)
    sc_7_3:[ {on:'out',if:{targetTeam:'enemy',fn:'ultCard'},more:R(0.03)} ],                                    // Giant Cards
    sc_7_4:[ {param:'mp',add:R(0.02)} ],                                                                        // Marker Paid (kitV; the heal budget)
    sc_8_3:[ {param:'ll',add:R(0.02)} ],                                                                        // Lowmere Luck (play)
    sc_4_2:[ {on:'out',if:{targetTeam:'enemy',window:'soHe',fn:'tMarked',targetHpBelow:0.50},more:R(0.04)} ],   // Scent of Endings
    sc_9_2:[ {on:'out',if:{targetTeam:'enemy',fn:'ultSigned'},more:R(0.05)} ],                                  // Card Edges
    sc_9_4:[ {param:'ci',add:1} ],                                                                              // Called In (card4)
    sc_8_1:[ {on:'out',if:{targetTeam:'enemy',fn:'tSigned'},critMore:R(0.03)} ],                                // Old Signatures (at most 9%)
    sc_5_2:[ {param:'rtd',add:1} ],                                                                             // Run Them Down (PICK ONE: tk)
    sc_5_3:[ {on:'kit',skill:HE,opt:{dur:{add:3}}}, {param:'wto',add:1} ],                                      // Wait Them Out (PICK ONE: tk)
    sc_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                             // Quick Hands
    sc_9_1:[ {param:'cs',add:1} ],                                                                              // Countersign (kitV)
    sc_6_2:[ {stat:{move:R(0.02)},req:'sc_5_2',if:{window:'soHe'}} ],                                          // Long Chase (while Run Them Down is chosen)
    sc_6_3:[ {param:'dr.pf',add:R(0.03)} ],                                                                     // Patient Fox (his group)
    sc_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.30},more:R(0.03)} ],                              // Final Hand
    sc_10_1:[ {stat:{aspd:R(0.005)},per:{fn:'sgN4'}} ],                                                         // Deadline
    sc_n3:[  {param:'es',add:R(0.01)} ],                                                                        // Everyone Signs (tIn / cardOut)
    sc_11_1:[ {stat:{lifesteal:R(0.01)},if:{window:'soSu'}} ],                                                  // Settling Up (myKill: the window)
    sc_11_2:[ {param:'gs',add:1} ],                                                                             // Grand Signature (cardPost)
    sc_10_2:[ {stat:{move:R(0.02)}} ],                                                                          // Fleet
    sc_12_1:[ {param:'mk.4',add:R(0.10)} ],                                                                     // Fourth Card (kitV)
    sc_12_2:[ {stat:{atk:R(0.005)},per:'soStl'} ],                                                              // Saving the Last (dth)
    sc_12_3:[ {param:'fi',add:R(0.06)} ],                                                                       // First Impression (cardOut)
    sc_12_4:[ {param:'dr.fc',add:R(0.02)} ],                                                                    // Folded Cuff (his group)
    sc_13_2:[ {param:'ace',add:1} ]                                                                             // The Stranger's Ace (SIGNATURE: tk)
  },
  fn:{
    /* ---- EACH TICK ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), Pp=T.P, dt=c.dt||0; o.api=A;   // the runtime API kept for the tests' and the 95% probe's pure reads (drK, critP)
      if(o.f==null) o.f={sg:has(T,SIGNED), mk:has(T,MARKSEEN), ace:!!Pp.ace, rng:Pp.rng>0};
      const f=o.f;
      if(o.sigA>0) o.sigA-=dt; if(o.sigH>0) o.sigH-=dt; if(o.aceCd>0) o.aceCd-=dt;                               // the signatures' 20 s, as countdowns (the battle clock restarts each wave)
      if(f.rng){ if(o.rg0==null) o.rg0=u.range; u.range=o.rg0*(1+Pp.rng); }                                    // Long Deal: his reach (his basic attacks, and so when his cards are thrown)
      if(f.sg||f.mk){ let n=0, m=false; for(const x of E.units()){ if(!x.alive||x.team===u.team) continue; if(f.sg&&signed(A,u,x)) n++; if((x._markT||0)>0) m=true; } o.sgN=n; o.mkAlive=m; }
      const heOn=A.winOn(T,'soHe');
      if(Pp.wto&&heOn&&!o.mkAlive){ const w=T.s.w.soHe; if(w.t<=3+1e-9){ w.t=0; if((u.hasteT||0)>0&&o.heMul!=null&&Math.abs((u.hasteMul||1)-o.heMul)<1e-9) u.hasteT=Math.min(u.hasteT,1e-6); } }   // Wait Them Out: its last 3 s only while a marked enemy lives
      if(Pp.rtd) T.fn.rtd(A,T,u,heOn&&A.winOn(T,'soHe'));
      if(f.ace&&!(o.aceCd>0)) T.fn.ace(A,T,u);
      const q=o.cq; if(q&&q.length){ const now=E.now(); for(let i=q.length-1;i>=0;i--){ const r=q[i]; if(now-r.t0>2||now<r.t0-1e-9){ q.splice(i,1); T.fn.recEnd(A,T,u,r); } } } },
    wv(A,T,u,c){ const o=S(T), Pp=T.P, E=A.eng();
      A.stSet(T,u,'soCnt',Math.min(A.stGet(T,'soCnt'),Pp.lc||0));                                              // Count is for the wave (Long Count keeps 1 a rank)
      o.rd=0; o.dw=0; o.d7=0; o.fi=null; o.es=null; o.cq=[]; o.bust=false; o.force=false; o.b2bNext=false;
      if(o.ftE&&u.forcedTarget===o.ftE){ u.forcedTarget=null; u.forcedTargetT=0; } o.ftE=null;
      if(Pp.cuff){ const room=Pp.palm2?2:1, L=o.palm||(o.palm=[]); if(L.length<room) L.push({s:Math.floor(E.rnd()*4)%4,k:Pp.cuff}); } },   // Card Up Each Cuff: a seeded suit, 5% a rank stronger
    /* ---- LOADED HAND: each swing of his. Returns 1 in ctx.amt (his rows ran the passive; the page skips its own block) ---- */
    lhSwing(A,T,u,c){ const o=S(T), E=A.eng(), Pp=T.P, t=c.unit||null; if(!(u.pass&&u.pass.loadedhand)) return;
      o.n=(o.n||0)+1;
      let thr=4; if(Pp.haw&&A.winOn(T,'soHe')) thr=2; else if(Pp.mc&&marked(t)) thr=3;                         // House Always Wins: every 2nd during House Edge; Marked Cards: every 3rd on a marked target
      let draw=o.n>=thr||!!o.b2bNext;
      if(!draw&&thr===4&&o.n===3&&Pp.fd>0&&E.rnd()<Pp.fd) draw=true;                                           // Fast Draw: a seeded chance on the third swing
      if(draw){ const third=o.n===3&&!o.b2bNext; o.b2bNext=!!(third&&Pp.b2b); o.n=0;                            // Back-to-Back: a draw on a third swing draws again on the fourth
        if(t) T.fn.draw(A,T,u,t,{}); }
      c.amt=1; },
    /* one draw of Loaded Hand (opt.sig: a card of The Last Honest Hand, at opt.mul strength) */
    draw(A,T,u,t,opt){ const o=S(T), E=A.eng(), Pp=T.P, r=T.r, sig=!!opt.sig; let suit=null, wild=false, k0=0, n=1, forced=false;
      if(!sig&&Pp.ur&&o.last!=null&&A.stGet(T,'soStr')>=4){ suit=o.last; n=3; forced=true; }                     // Unbroken Run: at 4 Streak the next draw plays that suit three times
      else if(!sig&&o.force){ suit=(u.hp<0.5*u.maxHp)?HEAL:HEAVY; o.force=false; forced=true; }                  // Stacked Deck: the suit he needs most (as he draws it)
      if(suit==null&&o.last!=null){ const wp=(Pp.dmi&&A.winOn(T,'soHe'))?1:(r.hc_1_1?0.2*(1+(Pp['wild.p']||0)):0);   // the Wild Card: 1 in 5 (Wild Odds: that share 3% a rank more); Deal Me In: every draw in House Edge
        if(wp>=1||(wp>0&&E.rnd()<wp)){ wild=true; suit=o.last; } }
      if(suit==null){ if(r.sd_1_4){ const L=[0,1,2,3].filter(x=>!((o.rd||0)&(1<<x))); suit=L[Math.floor(E.rnd()*L.length)%L.length]; }   // Counting Cards: never a suit twice until all four have come up
        else suit=Math.floor(E.rnd()*4)%4; }                                                                     // (the passive's own seeded draw)
      /* the Streak: the same suit as the last draw grows it (max 4), another ends it (Never Goes Cold keeps 1 a rank) */
      if(has(T,STREAK)){ const s0=A.stGet(T,'soStr'); let s1=(o.last!=null&&suit===o.last)?Math.min(4,s0+1):Math.min(s0,Pp.ngc||0);
        if(n===3) s1=Math.min(s0,Pp.ngc||0);                                                                     // Unbroken Run's triple spends the Streak
        A.stSet(T,u,'soStr',s1); }
      o.last=suit;
      /* a round of four suits (the Wild Card is not one of the four) */
      if(!wild&&has(T,COUNT)){ o.rd=(o.rd||0)|(1<<suit); if(o.rd===15){ o.rd=0; T.fn.round(A,T,u); } }
      o.dw=(o.dw||0)|(wild?16:(1<<suit));                                                                        // Honest Hands: the different suits drawn this wave
      o.d7=(o.d7||0)+1; if(Pp.l7&&o.d7%7===0) k0+=Pp.l7;                                                         // Lucky Seven
      if(o.lir>0){ k0+=o.lir; o.lir=0; }                                                                         // Ride the Next One
      if(wild){ k0+=(Pp['wild.k']||0)+(Pp['wild.g']||0); if(r.hc_11_1) A.acts(T,u,[{window:'soWh',dur:3}],{u}); }   // The Joker, Joker's Grin; Wild Chase
      if(Pp['nrg.draw']) gainE(u,11*Pp['nrg.draw']);                                                             // Gambler's Nerve: the drawing swing gives 3% a rank more
      if(sig){ T.fn.play(A,T,u,t,suit,k0,{talent:true,mul:opt.mul||1,rec:opt.rec}); if(wild&&Pp.jw) T.fn.pair(A,T,u,t,suit,k0,{talent:true,mul:opt.mul||1,rec:opt.rec}); return; }
      /* Palm: every other suit he draws goes up his sleeve while he has room */
      if(r.sd_1_1&&!forced){ o.pc=(o.pc||0)+1; const room=Pp.palm2?2:1, L=o.palm||(o.palm=[]); if(o.pc%2===0&&L.length<room){ L.push({s:suit,k:k0}); return; } }
      /* Double or Nothing: one seeded roll */
      if(Pp.don>0&&n===1){ const two=Pp.don*(Pp.allin?2:1)*(Pp.hedge?0.5:1), none=Pp.hedge?0:Pp.don*(Pp.allin?2:1), x=E.rnd();
        if(x<two){ n=2; if(Pp.safe) T.fn.heal(A,T,u,Pp.safe*u.maxHp); if(r.hc_10_2) A.acts(T,u,[{window:'soFf',dur:5}],{u}); }   // Safe Money, Fortune's Favourite
        else if(x<two+none){ if(Pp.lir) o.lir=Pp.lir; if(Pp.bust) o.bust=true; return; } }                       // nothing: Ride the Next One, Bust
      for(let i=0;i<n;i++) T.fn.play(A,T,u,t,suit,k0,{talent:i>0});
      if(wild&&Pp.jw) T.fn.pair(A,T,u,t,suit,k0,{talent:true}); },
    pair(A,T,u,t,suit,k0,f){ const L=[0,1,2,3].filter(x=>x!==suit); T.fn.play(A,T,u,t,L[Math.floor(A.eng().rnd()*3)%3],k0,f); },   // Wild Pair: a seeded other suit as well
    round(A,T,u){ const o=S(T), Pp=T.P;
      if(has(T,COUNT)) A.acts(T,u,[{stack:'soCnt',add:1}],{u});
      if(Pp.co) u.greenCd=Math.max(0,(u.greenCd||0)-Pp.co);                                                     // Counted Out
      if(Pp.stk) o.force=true; },                                                                                // Stacked Deck: the next draw
    /* one suit played on t at strength k (1 + the shares): f.talent = played by a talent (its stun follows the stun-lock rule), f.palm, f.mul, f.rec (a cast) */
    play(A,T,u,t,suit,k0,f){ const o=S(T), E=A.eng(), Pp=T.P, r=T.r; if(!t||!u.alive) return; f=f||{};
      let k=1+(k0||0)+(Pp['str.k']||0)*A.stGet(T,'soStr');                                                      // Hot Hand: each Streak
      if(Pp.fh&&T.fn.cntN(A,T,u)>=5) k+=Pp.fh;                                                                    // Full House
      if(Pp.lchip&&u.hp<0.30*u.maxHp) k+=Pp.lchip;                                                               // Last Chip
      if(Pp.ll&&marked(t)) k+=Pp.ll;                                                                             // Lowmere Luck
      if(f.palm) k+=(Pp['palm.k']||0)+(suit===HEAVY?(Pp.slh||0):0);                                              // Up the Sleeve; Sleight of Hand
      if(suit===HEAVY) k+=Pp['hv.k']||0; if(suit===HEAL) k+=(Pp['hl.k']||0)+(Pp['cd.hl']||0); if(suit===ARMOR) k+=Pp['ab.k']||0;
      k*=(f.mul||1); const pm=u.passMul||1, a=atkNow(A,u);
      if(E.suitFx) E.suitFx(u,t,suit);
      if(suit===HEAVY){ o.suitHit=true; try{ strike0(A,T,u,t,a*0.9*pm*k,'#c0392b'); } finally{ o.suitHit=false; } }
      else if(suit===STUN){ const cr=t.ctrlRes||0, d=Math.min(CC_TOP,(E.ccDur(0.5)*k+(Pp['cd.st']||0)+(Pp['st.add']||0))*(1-cr)), now=E.now(), st=o.st||(o.st={});
        if(f.talent){ if((t.stunned||0)>0) return; const e=st[t.uid]; if(e!=null&&now>=e-1e-9&&now<e+0.5) return;    // the stun-lock rule: never on a stunned enemy, nor within 0.5 s after his stun on it ended
          if(f.rec){ const m=f.rec.sn||(f.rec.sn={}); if((m[t.uid]||0)>=2) return; m[t.uid]=(m[t.uid]||0)+1; }       // at most twice per cast
          A.control(T,u,t,'stunned',d); }
        else t.stunned=Math.max(t.stunned||0,d);
        if((t.stunned||0)>0) st[t.uid]=Math.max(st[t.uid]||0,now+Math.min(d,t.stunned)); }
      else if(suit===ARMOR){ const b=0.25*pm, p=Math.min(Math.max(SHRED_TOP,b),b*k); t._shredPct=Math.max(t._shredPct||0,p); t._shredT=Math.max(t._shredT||0,4); }
      else E.healUnit(u,a*0.5*pm*k);
      if(r.sd_12_2) A.acts(T,u,[{stack:'soDc',add:1}],{u});                                                      // Dealer's Choice
      if(f.palm&&r.sd_11_1) A.acts(T,u,[{stack:'soBd',add:1}],{u}); },                                           // Bottom Deal
    /* ---- HIS CARDS. At the skill's kit: who its cards will reach (as the case picks them: the nearest), what each carries ---- */
    kitV(A,T,u,c){ const o=S(T), E=A.eng(), Pp=T.P, op=c.o||{}, ult=u._castSlot==='ult';
      const L=enemies(A,u).sort((a,b)=>E.dist(u,a)-E.dist(u,b)).slice(0,op.n||3), list=op.single?(L.length?[L[0]]:[]):L;
      const rec={ult,list,got:new Map(),need:op.single?(op.n||3):1,t0:E.now(),raw:(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*(u._castSM||1)*(op.mul||0.9)*E.rage(),landed:0};
      (o.cq||(o.cq=[])).push(rec); const t=list[0]; if(!t) return;
      if(!ult){ rec.sb=signed(A,u,t);
        if(op.mark){ if(Pp.cs&&rec.sb) op.mark=1+(op.mark-1)*1.1;                                                 // Countersign: the mark on a Signed enemy 10% stronger
          op.markDur=((Pp.tst&&rec.sb)?9:(op.markDur||6))+(Pp['mark.add']||0); }                                   // Third Signs Them (9 s on a Signed enemy), Long Mark
        if(o.palm&&o.palm.length) rec.palms=o.palm.splice(0);                                                     // his palmed suits go out on this cast
        if(has(T,MARKER)&&A.stGet(T,'soMk')>0){ const M=o.mks||(o.mks=[]), w=M.length?M.shift():T.s.wave; A.stSet(T,u,'soMk',M.length);   // spend a Marker (the oldest)
          if(Pp.mp) T.fn.heal(A,T,u,Pp.mp*u.maxHp);                                                               // Marker Paid
          const sh=0.25*rk(T,'sc_1_4')*(1+(Pp['mk.4']||0))*(1+(Pp.int||0)*Math.max(0,T.s.wave-w));                 // What's Owed, Fourth Card, Interest
          if(sh>0) A.acts(T,u,[{after:(op.n||3)*0.15+0.30,do:[{fn:'card4'}]}],{u,tgt:t,k:sh*rec.raw}); } }
      else { if(Pp.sigA&&!(o.sigA>0)){ o.sigA=SIG_CD; rec.sigA=true; if(o.palm&&o.palm.length) rec.palms=o.palm.splice(0); }   // Every Card He Ever Palmed
        if(Pp.sigH&&!(o.sigH>0)){ o.sigH=SIG_CD; rec.sigH=true; } } },                                              // The Last Honest Hand
    cardPre(A,T,u,c){ const o=S(T), e=c.tgt, q=o.cq||[]; o.card=null;
      for(const r of q){ if(r.list.indexOf(e)<0) continue; const g=r.got.get(e)||0; if(g>=r.need) continue; r.got.set(e,g+1); o.card={rec:r,i:g,e}; return; } },
    cardPost(A,T,u,c){ const o=S(T), cd=o.card, Pp=T.P; o.card=null; if(!cd) return; const r=cd.rec, e=cd.e, i=cd.i; r.landed++;
      if(!r.ult){
        if(r.palms&&r.palms.length&&e.alive){ let mine=[];
          if(Pp.cool) mine=r.palms.slice();                                                                        // The Cooler: every card carries every palmed suit
          else if(r.palms.length>=2&&Pp.palm2){ if(i===1) mine=[r.palms[0]]; else if(i===2) mine=r.palms.slice(1); }   // Second Sleeve: one on the second card, one on the third
          else if(i===2) mine=r.palms.slice();
          for(const p of mine) T.fn.play(A,T,u,e,p.s,p.k,{talent:true,palm:true,rec:r});
          if(i===r.need-1) r.palms=null; }
        if(i===r.need-1&&e.alive){ if(has(T,SIGNED)) T.fn.sign(A,T,u,e); if(Pp.cn) gainE(u,Pp.cn); } }              // the marking card: Signed, Collector's Nerve
      else {
        if(e.alive&&Pp.sh){ e._markT=Math.max(e._markT||0,Pp.sh); e._markMul=Math.max(e._markMul||1,(u.greenAb&&u.greenAb.mark)||1.22); }   // Shown Hand: the game's own mark
        if(e.alive&&Pp.gs) T.fn.sign(A,T,u,e);                                                                     // Grand Signature
        if(r.sigA&&e.alive){ for(const s of [HEAVY,STUN,ARMOR,HEAL]) T.fn.play(A,T,u,e,s,0,{talent:true,rec:r});
          if(e===r.list[0]&&r.palms){ for(const p of r.palms) T.fn.play(A,T,u,e,p.s,p.k,{talent:true,palm:true,rec:r}); r.palms=null; } }
        if(r.sigH&&e.alive) T.fn.draw(A,T,u,e,{sig:true,mul:2,rec:r});
        if(r.sigH&&r.landed>=r.list.length){ r.sigH=false; if(has(T,STREAK)) A.stSet(T,u,'soStr',4); } } },        // and his Streak goes to 4
    recEnd(A,T,u,r){ const o=S(T), Pp=T.P;                                                                       // a cast whose cards are all down (or that ran out of time)
      if(r.palms&&r.palms.length){ const room=Pp.palm2?2:1, L=o.palm||(o.palm=[]); for(const p of r.palms) if(L.length<room) L.push(p); r.palms=null; }   // a palmed suit whose card never landed goes back up his sleeve
      if(r.sigH){ r.sigH=false; if(has(T,STREAK)) A.stSet(T,u,'soStr',4); } },
    /* What's Owed's fourth card: a real card of Marked Deal (a share of a card's damage); Called In signs and marks the nearest other enemy */
    card4(A,T,u,c){ const o=S(T), E=A.eng(), t=c.tgt; if(!t||!t.alive||!u.alive) return; o.c4=true; try{ strike0(A,T,u,t,c.k,'#5ee89b'); } finally{ o.c4=false; }
      if(T.P.ci){ let b=null,bd=Infinity; for(const x of enemies(A,u)){ if(x===t) continue; const d=E.dist(t,x); if(d<bd){ bd=d; b=x; } }
        if(b){ T.fn.sign(A,T,u,b); b._markT=Math.max(b._markT||0,((u.greenAb&&u.greenAb.markDur)||6)+(T.P['mark.add']||0)); b._markMul=Math.max(b._markMul||1,(u.greenAb&&u.greenAb.mark)||1.22); } } },
    sign(A,T,u,x){ if(!x||!x.alive||signed(A,u,x)) return; A.setMark(T,u,x,'sg',{}); S(T).sgN=(S(T).sgN||0)+1; },
    /* ---- HOUSE EDGE ---- */
    heCast(A,T,u,c){ const o=S(T), op=c.o||{}, k=T.P['he.k']||0, d=op.dur||6;
      A.acts(T,u,[{window:'soHe',dur:d}],{u});
      const hm=u._ocMul||u.hasteMul||1; o.heMul=hm; if(k>0&&hm>1){ const nm=1+(hm-1)*(1+k); u.hasteMul=Math.max(u.hasteMul||1,nm); u._ocMul=nm; o.heMul=nm; } },   // House Advantage, Smell the End: the speed 3% a rank stronger
    /* Run Them Down: during House Edge his basic attacks go to the lowest-HP marked enemy within his reach (as a taunt would point them; never over a real taunt) */
    rtd(A,T,u,on){ const o=S(T), E=A.eng(); let b=null;
      if(on){ for(const x of enemies(A,u)){ if(!marked(x)||E.dist(u,x)>u.range) continue; if(!b||x.hp<b.hp) b=x; } }
      if(b){ if((u.forcedTargetT||0)>0&&u.forcedTarget&&u.forcedTarget!==o.ftE) return; u.forcedTarget=b; u.forcedTargetT=0.2; o.ftE=b; }
      else if(o.ftE){ if(u.forcedTarget===o.ftE){ u.forcedTarget=null; u.forcedTargetT=0; } o.ftE=null; } },
    /* The Stranger's Ace: once every 20 s, a Signed enemy below 25% HP: finished (a boss takes 12% of its max HP), and 3 Markers */
    ace(A,T,u){ const o=S(T); for(const x of enemies(A,u)){ if(!signed(A,u,x)||!(x.hp<ACE_AT*x.maxHp)) continue; o.aceCd=SIG_CD;
        o.c4=true; try{ if((x.t&&x.t.isboss)||x._raidBoss) A.hurt(T,u,x,ACE_BOSS*x.maxHp,'#ffd45e'); else A.acts(T,u,[{kill:'target',color:'#ffd45e'}],{u,src:u,tgt:x}); } finally{ o.c4=false; }
        const M=o.mks||(o.mks=[]); for(let i=0;i<3;i++) if(M.length<3) M.push(T.s.wave); A.stSet(T,u,'soMk',M.length); return; } },
    /* ---- HIS HITS ---- */
    myHit(A,T,u,c){ const o=S(T), Pp=T.P, t=c.tgt;
      if(c.auto){ if(Pp['nrg.auto']) gainE(u,11*Pp['nrg.auto']); if(Pp['nrg.mk']&&marked(t)) gainE(u,11*Pp['nrg.mk']); }   // Dealer's Patience, Steady Breath: 3% a rank of a swing's 11
      if(o.bust&&t&&t.alive){ o.bust=false; A.setMark(T,u,t,'bust',{dur:3}); } },                                 // Bust: the next enemy he hits
    myKill(A,T,u,c){ const o=S(T), Pp=T.P, t=c.tgt; if(!t||t.team===u.team) return;
      if(Pp.ts&&(o.card||o.c4)){ const x=Math.min(TS_TOP,Pp.ts*100*Math.max(0,c.overkill||0)/Math.max(1,t.maxHp||1)); gainE(u,x); }   // Table Stakes
      if(rk(T,'sc_11_1')&&signed(A,u,t)) A.acts(T,u,[{window:'soSu',dur:5}],{u}); },                              // Settling Up
    dth(A,T,u,c){ const o=S(T), Pp=T.P, x=c.unit; if(!x||x.team===u.team||!signed(A,u,x)) return; o.sgN=Math.max(0,(o.sgN||0)-1);
      if(has(T,MARKER)){ const M=o.mks||(o.mks=[]); if(M.length<3) M.push(T.s.wave); A.stSet(T,u,'soMk',M.length); }   // a Marker
      if(Pp.gc) T.fn.heal(A,T,u,Pp.gc*u.maxHp);                                                                   // Good Coat
      if(rk(T,'sc_12_2')) A.acts(T,u,[{stack:'soStl',add:1}],{u}); },                                            // Saving the Last
    tIn(A,T,u,c){ const o=S(T), Pp=T.P, t=c.tgt, s=c.src; if(!foe(u,t)||!s||s.team!==u.team) return;
      if(Pp.sft&&signed(A,u,t)) c.amt*=1+Pp.sft;                                                                  // Signed for the Team
      if(Pp.bust&&A.markOf(u,t,'bust')) c.amt*=1+Pp.bust;                                                         // Bust
      if(Pp.es&&s!==u&&!s._summon&&signed(A,u,t)){ const m=o.es||(o.es={}), L=m[t.uid]||(m[t.uid]=[]); if(L.length<4&&L.indexOf(s.uid)<0) L.push(s.uid); } },   // Everyone Signs
    ink(A,T,u,c){ const x=c.unit; if(x&&x.team!==u.team&&signed(A,u,x)) c.amt*=1-T.P.ink; },
    cardOut(A,T,u,c){ const o=S(T), Pp=T.P, t=c.tgt;
      if(Pp.fi){ const F=o.fi||(o.fi={}); if(!F[t.uid]){ F[t.uid]=1; c.amt*=1+Pp.fi; } }                         // First Impression: his first card on each enemy
      if(Pp.es&&o.es&&o.es[t.uid]&&o.es[t.uid].length){ c.amt*=1+Pp.es*o.es[t.uid].length; o.es[t.uid]=[]; } },     // Everyone Signs: his next card on it
    /* ---- CONDITIONS AND COUNTS ---- */
    anyCard(A,T){ const o=S(T); return !!(o.card||o.c4); },
    mdCard(A,T){ const o=S(T); return !!((o.card&&!o.card.rec.ult)||o.c4); },
    ultCard(A,T){ const o=S(T); return !!(o.card&&o.card.rec.ult); },
    card2(A,T){ const o=S(T); return !!(o.card&&!o.card.rec.ult&&o.card.i===1); },
    suitHit(A,T){ return !!S(T).suitHit; },
    suitMarked(A,T,u,c){ return !!S(T).suitHit&&marked(c.tgt); },
    tMarked(A,T,u,c){ return marked(c.tgt); },
    tSigned(A,T,u,c){ return signed(A,u,c.tgt); },
    ultSigned(A,T,u,c){ const o=S(T); return !!(o.card&&o.card.rec.ult)&&signed(A,u,c.tgt); },
    anySigned(A,T){ return (S(T).sgN||0)>0; },
    palmHeld(A,T){ const L=S(T).palm; return !!L&&L.length>0; },
    sgN4(A,T){ return Math.min(4,S(T).sgN||0); },
    hhN(A,T){ return Math.min(5,bits(S(T).dw||0)); },
    cntN(A,T,u){ let n=A.stGet(T,'soCnt'); if(T.P.wit) n+=S(T).sgN||0; return Math.min(5,n); },                  // Count (Witnessed: each Signed enemy alive counts as 1), at most 5
    /* his critical-chance talents, ONE group, at most 5%: Measured Throw, Lucky Coat, Taking Measure (plain until now), Card Sharp (each Count), Second Takes
       Measure (Marked Deal's cards on a Signed enemy). One seeded roll when the hit is struck */
    critP(A,T,u,c){ const r=T.r, o=S(T); let x=0.01*((r.sd_11_3||0)+(r.hc_1_2||0)+(r.sc_11_3||0));
      if(r.sd_3_4) x+=0.005*r.sd_3_4*T.fn.cntN(A,T,u);
      if(r.sc_2_1&&((o.card&&!o.card.rec.ult)||o.c4)&&signed(A,u,c.tgt)) x+=0.03*r.sc_2_1;
      return Math.min(CRIT_CAP,x); },
    /* ---- HIS DAMAGE REDUCTION: ONE capped group, at most 25% (the shares multiply) ---- */
    drK(A,T,u,c){ const o=S(T), Pp=T.P, s=c.src; let k=1; const f=x=>{ if(x>0) k*=1-x; };
      const mk=c.probe?T.fn.mkNow(A,T,u):!!o.mkAlive;
      if(Pp['dr.lf']&&mk) f(Pp['dr.lf']);                                                                         // Lamp Flame: while a marked enemy lives
      if(Pp['dr.bl']&&marked(s)) f(Pp['dr.bl']);                                                                  // Bluff: from a marked enemy
      if(Pp['dr.cc']&&A.stGet(T,'soStr')>0) f(Pp['dr.cc']);                                                       // Charmed Coat: while he holds a Streak
      if(Pp['dr.pf']&&Pp.wto&&A.winOn(T,'soHe')&&mk) f(Pp['dr.pf']);                                              // Patient Fox: while Wait Them Out holds
      if(Pp['dr.fc']&&signed(A,u,s)) f(Pp['dr.fc']);                                                              // Folded Cuff: from a Signed enemy
      return Math.max(DR_FLOOR,k); },
    mkNow(A,T,u){ for(const x of A.eng().units()) if(x.alive&&x.team!==u.team&&(x._markT||0)>0) return true; return false; },
    myIn(A,T,u,c){ if(!foe(u,c.src)) return; c.amt*=T.fn.drK(A,T,u,c); },
    myDot(A,T,u,c){ if(!c.src||!foe(u,c.src)) return; c.amt*=T.fn.drK(A,T,u,{src:c.src}); },
    /* his own talent heals (Safe Money, Good Coat, Marker Paid) share ONE budget that fills at 1.2% of his max HP a second (at most 10 s kept): the regeneration cap.
       Loaded Hand's heal suit is his passive's, not a talent heal: it is not in the budget */
    heal(A,T,u,x){ const o=S(T), E=A.eng(), now=E.now(), cap=REGEN*(u.maxHp||0); if(o.rgAt==null){ o.rgAt=now; o.rgV=cap; }
      o.rgV=Math.min(10*cap,(o.rgV||0)+cap*Math.max(0,now-o.rgAt)); o.rgAt=now; const g=Math.min(x,o.rgV); if(g>0){ o.rgV-=g; E.healUnit(u,g); } return g; }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/54 - SORREL - talent decisions.md) */
  ruling:{}
};
