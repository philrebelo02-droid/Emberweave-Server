/* JOSS GATLEY - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Joss Gatley": what he added)
   His real kit (the code, not the card wording; his damage profile is Magic: his skills read his ability power, every hit of his is magic, his basic
   attacks read his Attack and land as magic):
   - Radiant Hammer ('atkcrush', green, cd 8): ONE hit on the living enemy with the highest attack (not his own target: 13 of 117 casts in 20 seeded fights),
     145% of his ability power x skill level, then that enemy's attack is crushed 35% for 5 s (_atkDnPct / _atkDnT: everything it deals is 35% smaller), and
     it is STUNNED: the kit's 0.5 is replaced by the control table (a single target, 3.5 s) x 0.7 = 2.45 s. The card ("A crushing strike reduces the
     target's attack power") names no stun. Its hit, its crush and its stun land inside the skill: casting:'atkcrush'. The 'skillTgt' hook (his own page
     line) sees the enemy it picked.
   - Sanctuary Guard ('lastbreath', blue, cd 10): the living ally with the LOWEST HP SHARE, Joss himself included (58 of 90 casts were on himself), gets a
     shield of his ability power x 1.9 x skill level for 5 s (the larger shield stays) and the game's Dawnward hold (_wardT, 5 s: it cannot fall below 1 HP).
     It intercepts nothing (the card: "intercepts damage"). The 'skillTgt' hook (his own page line) sees the ally it picked; a save by its hold is the
     'held' hook (damage(), his own page lines).
   - Unbroken Dawn (passive 'unbroken'): once per battle (u._ubUsed, never reset), the first tick he is alive below 30% HP: a shield of 30% of his max HP
     x his passive's strength (65.6% at 100; no timer) and 40% control resist for 8 s (the game's timed bonus, cap 85%). His rows see it from the tick.
   - Daybreak Judgment ('sunburst', ultimate on energy - no cooldown; ULT_DEF.sunburst + HERO_ULT_ART.joss, delivered as a form): every enemy whose CENTRE is
     within 6 m of his takes 180% of his ability power x skill level and is stunned (HERO_ULT_ART's 1.2 is replaced by the area table 2.0 s x 0.7 = 1.4 s);
     every ally within 6 m (centre to centre, himself too) is healed 35% of ITS max HP x skill level (healFrom). Inside the skill: casting:'sunburst'.
   Dawnlight, Grit, Gratitude, Kept Word, the Promise, Hammerlight, Humbled and Judged exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/31 - JOSS GATLEY - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const RH='atkcrush', SG='lastbreath', DJ='sunburst', SK=[RH,SG,DJ];
const DR_CAP=0.40, ALLY_CAP=0.25, TEN_CAP=0.35, REGEN_CAP=0.012, STUN_TOP=4.0, LOCK=0.5;
/* the states several talents read: their bookkeeping runs when any of these is learned */
const DAWN=['hm_1_1','hm_2_1','hm_3_1','hm_4_1','hm_6_4','hm_8_1','hm_10_1','hm_11_2','hm_12_2','hm_n1'];
const UDEV=['hm_3_1','hm_5_3','hm_6_1','hm_11_1','hm_13_2','pr_11_1','hm_n1'];
const GRIT=['hm_1_4','hm_3_4','hm_5_4','hm_7_4','hm_9_4','hm_10_4','hm_12_1'];
const GRA=['pr_1_1','pr_3_1','pr_5_1','pr_7_1','pr_9_1','pr_11_3','pr_12_1','pr_12_3'];
const KW=['pr_1_3','pr_2_3','pr_6_1','pr_6_3','pr_10_3','pr_13_3'];
const PRO=['pr_1_4','pr_2_4','pr_3_4','pr_4_4','pr_5_2','pr_6_2','pr_6_4','pr_7_4','pr_8_4','pr_10_4','pr_11_1','pr_11_4','pr_12_4','pr_13_3'];
const SGM=KW.concat(['pr_n1','pr_9_3','hm_5_2','hm_7_2','pr_5_2','pr_5_3']).concat(PRO).concat(GRA);
const HL=['ra_1_1','ra_2_1','ra_3_1','ra_4_1','ra_6_1','ra_8_1','ra_11_1','ra_12_1','ra_13_2'];
const HUM=['ra_1_4','ra_3_4','ra_5_4','ra_7_4','ra_9_4','ra_10_4','ra_12_4','ra_11_2','ra_13_2'];
const JUD=['ra_2_2','ra_4_2','ra_6_2','ra_8_2','ra_10_2','ra_12_2','ra_5_2','ra_5_3','ra_6_3','ra_9_3','ra_11_2','ra_13_2'];
const RHAT=HUM.concat(['pr_7_4','ra_13_2']);
const EXT=['hm_9_2','ra_n1','pr_7_4','ra_9_4','ra_13_2'];
const DRG=['hm_1_1','hm_2_2','hm_4_2','hm_3_4','hm_6_2','pr_1_1','pr_6_2','pr_10_2','ra_10_2','ra_10_4','pr_n1','hm_13_2','ra_1_4','ra_8_2'];
const TEAM=['pr_1_4','pr_n1','pr_11_3','hm_12_2','hm_13_2','ra_1_4','ra_8_2','ra_2_2','pr_9_1','pr_6_4'];
const TEN=['hm_5_1','hm_12_3','ra_8_3','pr_12_2'], REGEN=['hm_5_4','pr_5_1','pr_10_4'];
const GSEL={team:'ally',others:true,has:'jGra'};                                      // his Grateful allies (living, not himself)
/* ---- small readers that need no API (the 95% instrument calls drK from a test with the API kept on T.s) ---- */
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const winN=(T,n)=>{ const w=T.s.w[n]; return !!w&&w.t>0; };
const mk=(u,t,name,now)=>{ const o=t&&t._talM&&t._talM[u.uid], m=o&&o[name]; return !!m&&(m.until==null||now<m.until); };
const holder=(T,u,now)=>{ const h=T.s.m.jPro; return (h&&h.alive&&mk(u,h,'jPro',now))?h:null; };
module.exports={
  hero:'joss',
  casting:true,                         // rows ask which of his skills a hit, a stun or a heal comes from (Radiant Hammer, Sanctuary Guard, Daybreak Judgment)
  watch:['pr_7_4'],                     // Hammer Between Them reads the enemy that last hit the Promised ally (_talBy, kept for watched units)
  states:{
    jDawn:{max:20,gain:'jDawnG'},                                              // Dawnlight (each fight)
    jGrit:{max:10,wave:'reset'},                                               // Grit (this wave)
    jKW:{max:P('kw.max',5)},                                                   // Kept Word (each fight; Promise Weight: up to 8)
    jHL:{max:5}                                                                // Hammerlight (lost between waves; Long Light keeps some)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share, and his capped groups */
  always:[
    {on:'ccHit',reqAny:EXT,if:{cc:['stunned'],talent:false,casting:[RH,DJ]},do:[{fn:'ext'}]},                                   // his skills' stuns lengthened (one function, 4.0 s at most)
    {on:'ccHit',reqAny:['hm_13_2'],if:{cc:['stunned']},do:[{fn:'seRec'}]},                                                      //   when his stun on that enemy ends (the stun-lock rule)
    {on:'ccHit',reqAny:DAWN,if:{cc:['stunned']},do:[{stack:'jDawn',add:P('dawn.stun',1)}]},                                     // Dawnlight: each enemy he stuns
    {on:'hurt',reqAny:DAWN,if:{selfHpBelow:0.5},do:[{stack:'jDawn',add:1}]},                                                   //   and each hit he survives below 50% HP
    {on:'tick',reqAny:UDEV,do:[{fn:'ubWatch'}]},                                                                                // Unbroken Dawn: the tick it triggers (event jDawn); Second Morning
    {on:'hurt',reqAny:GRIT,if:{selfHpBelow:0.3},do:[{stack:'jGrit',add:1}]},                                                   // Grit: each hit he takes below 30% HP
    {on:'skillAt',reqAny:SGM,skill:SG,do:[{fn:'sgAt'}]},                                                                        // Sanctuary Guard: whom it holds, and its shield
    {on:'cast',reqAny:SGM,skill:SG,do:[{fn:'sgCast'}]},                                                                         //   the hold marked (jSg), the Promise moved, Gratitude
    {on:'teamHeld',reqAny:KW,if:{unitHas:'jSg'},do:[{fn:'kept'}]},                                                              // Kept Word: Sanctuary Guard kept an ally from falling
    {on:'jGrat',reqAny:GRA,if:{fn:'isAlly'},do:[{mark:'jGra',on:'target',dur:P('gra.dur',8),cap:4}]},                           // Gratitude: an ally he healed or shielded (4 at most)
    {on:'healed',reqAny:GRA,skill:DJ,do:[{emit:'jGrat'}]},                                                                      //   Daybreak Judgment's heals
    {on:'teamLethal',reqAny:['pr_13_3'],if:{unitHas:'jCar'},do:[{atOne:'unit'}]},                                              // Carried Like a Promise: held at 1 HP for its 3 s
    {on:'kit',reqAny:HL,skill:RH,do:[{fn:'hlKit'}]},                                                                            // Hammerlight: Radiant Hammer spends it all
    {on:'hit',reqAny:HL,if:{auto:true,targetTeam:'enemy'},do:[{stack:'jHL',add:1}]},                                           //   each basic attack charges 1
    {on:'waveEnd',reqAny:HL,do:[{fn:'hlKeep'}]},                                                                                //   lost between waves (Long Light keeps some)
    {on:'skillAt',reqAny:RHAT,skill:RH,do:[{fn:'rhAt'}]},                                                                       // Radiant Hammer's victim (was it Humbled already? the sentence armed?)
    {on:'hit',reqAny:HUM,if:{casting:RH,targetTeam:'enemy'},do:[{mark:'jHum',on:'target',dur:P('hum.dur',6),longest:true}]},   // Humbled: the enemy Radiant Hammer crushes
    {on:'ccHit',reqAny:JUD,if:{cc:['stunned'],talent:false,casting:[RH,DJ]},do:[{mark:'jJud',on:'target',dur:P('jud.dur',5),longest:true}]},   // Judged: stunned by Radiant Hammer or Daybreak Judgment
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                                      // his damage-reduction talents: ONE capped group (myDr)
    {on:'teamIn',reqAny:TEAM,do:[{fn:'teamK'}]},                                                                                // his talents on his allies' hits and on hits on them (one function)
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                                     // his control-shortening talents: ONE capped group
    {on:'tick',reqAny:REGEN,period:1,do:[{fn:'regen'}]},                                                                        // his healing each second, at the regeneration cap
    {on:'wave',do:[{fn:'keep'}]}                                                                                                // (the API kept for drK read from outside a row: the 95% instrument)
  ],
  talents:{
    /* ============================== HOLD UNTIL MORNING ============================== */
    hm_1_1:[ {param:'dr.dawn',add:R(0.001)} ],                                                                   // Light Before Dawn (Dawnlight: the always rows; in myDr)
    hm_2_3:[ {on:'out',if:{casting:RH},more:R(0.04)} ],                                                         // Promise Hammer
    hm_1_4:[ {stat:{apow:R(0.005)},per:'jGrit'} ],                                                               // Grit (the always row)
    hm_2_1:[ {param:'dawn.stun',add:R(1)} ],                                                                     // Brightening
    hm_2_2:[ {param:'dr.front',add:R(0.01)} ],                                                                   // Gate Bar (in myDr)
    hm_3_1:[ {param:'sm',add:1} ],                                                                               // Second Morning (ubWatch)
    hm_4_2:[ {param:'dr.crit1',add:R(0.02)} ],                                                                   // Thick Timber (in myDr)
    hm_n1:[ {on:'out',if:{casting:RH,selfHpBelow:0.5},more:0.05},                                                // Hammer at the Gate (LINK)
            {on:'jDawnG',req:'ra_1_1',chance:0.25,do:[{stack:'jHL',add:1}]},                                     //   with Hammerlight: each gain of Dawnlight, a 25% chance of 1 Hammerlight
            {on:'jDawn',req:'ra_1_1',do:[{stack:'jHL',set:'max'}]} ],                                            //   and Unbroken Dawn charges him to 5
    hm_3_4:[ {param:'dr.grit',add:R(0.003)} ],                                                                   // Set Jaw (in myDr)
    hm_4_1:[ {stat:{apow:R(0.001)},per:'jDawn'} ],                                                               // Grey Light
    hm_5_2:[ {on:'tick',if:{window:'jSgW'},do:[{timer:'_gearImmovableT',min:0.1,on:'self'}]} ],                  // Unmoved Guard (PICK ONE): the game's own cannot-be-displaced timer
    hm_5_3:[ {on:'jDawn',do:[{cd:'green',set:0},{cd:'blue',set:0},{window:'jSally',dur:4}]} ],                   // Sally Forth (PICK ONE)
    hm_7_1:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                              // Gatekeeper's Patience
    hm_5_1:[ {param:'ten.all',add:R(0.04)} ],                                                                    // Unbroken Will (in ten)
    hm_6_3:[ {on:'out',if:{casting:SK,window:'jSally'},more:R(0.05)} ],                                          // Sally's Wake
    hm_5_4:[ {param:'rg.bnb',add:R(0.0024)} ],                                                                   // Bloodied Not Bowed (regen)
    hm_6_1:[ {param:'ud.more',add:R(0.03)}, {on:'jDawn',do:[{fn:'udMore'}]} ],                                   // Morning Comes
    hm_6_2:[ {param:'dr.low',add:R(0.015)} ],                                                                    // Stand Fast at Night (in myDr)
    hm_4_3:[ {on:'kit',skill:SG,opt:{dur:{add:R(0.2)}}} ],                                                       // Long Guard
    hm_6_4:[ {on:'wave',once:'fight',do:[{stack:'jDawn',add:R(4)}]} ],                                           // Early Light
    hm_7_2:[ {param:'notYet',add:1} ],                                                                           // Not Yet (sgCast)
    hm_7_3:[ {stat:{apow:R(0.03)},if:{selfHpBelow:0.5}} ],                                                       // Dawn Strength
    hm_7_4:[ {stat:{ctrl:R(0.002)},per:'jGrit'} ],                                                               // Hard Night (10 points at most: 10 Grit x 0.2% x 5)
    hm_8_1:[ {on:'jDawnG',do:[{heal:{pct:R(0.002),of:'maxHp'}}]} ],                                              // Pale Sky
    hm_9_2:[ {param:'ext.dj',add:R(0.1)} ],                                                                      // Gate Held (ext)
    hm_9_3:[ {on:'out',if:{casting:DJ},more:R(0.03)} ],                                                         // Judgment Weight
    hm_9_4:[ {on:'hurt',if:{stackFull:'jGrit'},once:'wave',do:[{window:'jUM',dur:2},{fn:'umOn'}]},               // Until Morning: at 10 Grit, once a wave
             {on:'lethal',if:{window:'jUM'},do:[{undying:0.05}]},                                                //   (keeps the page's lethal hook on for him)
             {on:'hit',if:{casting:RH,fn:'umRh'},do:[{heal:{pct:1,of:'hit'}}]},                                  //   his next Radiant Hammer heals him for its damage
             {on:'cast',skill:RH,do:[{fn:'umClr'}]} ],
    hm_10_1:[ {on:'out',if:{casting:RH},more:R(0.002),per:'jDawn'} ],                                            // Dawn Hammer
    hm_10_2:[ {on:'kit',skill:SG,opt:{mul:{more:R(0.03)}}} ],                                                    // Bulwark
    hm_10_4:[ {stat:{hp:R(0.002)},per:'jGrit'} ],                                                                // Scarred Gate
    hm_11_1:[ {on:'jDawn',do:[{heal:{pct:R(0.02),of:'tgtMaxHp'},on:{team:'ally',within:6,others:true},emit:'jGrat'}]} ],   // First Light
    hm_11_2:[ {on:'kit',skill:DJ,do:[{fn:'dgKit'}]},                                                             // Daybreak at the Gate: spends all Dawnlight
              {on:'out',if:{casting:DJ},more:0.01,per:{fn:'dgN'}}, {on:'healOut',skill:DJ,more:0.01,per:{fn:'dgN'}},
              {on:'cast',skill:DJ,do:[{shield:{pct:0.005,of:'maxHp',x:{fn:'dgN'}},dur:6}]} ],
    hm_11_3:[ {on:'out',if:{casting:SK},ignoreMr:R(0.02)} ],                                                     // Holy Iron
    hm_12_1:[ {on:'wave',do:[{stack:'jGrit',add:R(2)}]} ],                                                       // Long Siege
    hm_12_2:[ {param:'al.dawn',add:R(0.0005)} ],                                                                 // Brighter Each Morning (teamK)
    hm_12_3:[ {param:'ten.sil',add:R(0.10)} ],                                                                   // Clear Head (in ten)
    hm_12_4:[ {on:'hurt',if:{selfHpBelow:0.3},do:[{dmg:{pct:R(0.10),of:'apow'},on:'source'}]} ],                // Gate Splinters
    hm_13_2:[ {on:'jDawn',do:[{fn:'gate'}]} ],                                                                   // The Gate Still Stands (SIGNATURE; the dazzle: myDr / teamK)
    /* ============================== THE PROMISE ============================== */
    pr_1_1:[ {param:'dr.gra',add:R(0.005)} ],                                                                    // Thanks of the Town (Gratitude: the always rows; in myDr)
    pr_1_3:[ {stat:{apow:R(0.01)},per:'jKW'} ],                                                                  // Kept Word (the always row)
    pr_1_4:[ {param:'al.pro',add:R(0.01)}, {stat:{move:R(0.03)},if:{fn:'toward'}} ],                             // Given Word (the Promise: sgCast)
    pr_2_3:[ {stat:{hp:R(0.005)},per:'jKW'} ],                                                                   // Word of Honour
    pr_2_4:[ {on:'tick',period:1,do:[{heal:{pct:R(0.002),of:'tgtMaxHp'},on:'holder:jPro'}]} ],                   // Close Promise
    pr_3_1:[ {param:'gra.dur',add:R(1)} ],                                                                       // Thankful
    pr_9_2:[ {on:'healOut',skill:DJ,more:R(0.02)} ],                                                             // Morning Prayer
    pr_3_4:[ {on:'tick',if:{fn:'proLow'},edge:true,icd:10,do:[{cd:'blue',add:-3}]} ],                            // Always Return
    pr_4_2:[ {on:'kit',skill:SG,opt:{dur:{add:R(0.2)}}} ],                                                       // Long Sanctuary
    pr_4_3:[ {on:'kit',skill:SG,opt:{mul:{more:R(0.04)}}} ],                                                     // Iron Oath
    pr_4_4:[ {param:'sh.arm',add:R(0.01)}, {on:'tick',do:[{fn:'shoulder'}]}, {on:'die',do:[{fn:'shoulderOff'}]} ],   // Shoulder Guard
    pr_5_1:[ {param:'rg.wt',add:R(0.001)} ],                                                                     // Warm Thanks (regen)
    pr_5_2:[ {on:'skillTgt',skill:SG,do:[{retarget:'holder:jPro'}]}, {on:'kit',skill:SG,opt:{mul:{more:0.25}}} ],   // Only You (PICK ONE)
    pr_5_3:[ {param:'twoPro',add:1} ],                                                                           // Two Promises (PICK ONE; sgCast)
    pr_n1:[ {param:'bs',add:R(0.03)} ],                                                                          // Broad Shield (myDr / teamK)
    pr_6_1:[ {on:'wave',once:'fight',do:[{stack:'jKW',add:R(1)}]} ],                                             // Town's Gift
    pr_6_2:[ {param:'dr.dev',add:R(0.02)} ],                                                                     // Devotion (in myDr)
    pr_6_3:[ {param:'kw.heal',add:R(0.03)} ],                                                                    // Promise Fulfilled (kept)
    pr_6_4:[ {param:'mind',add:R(0.01)}, {on:'out',if:{targetHas:'jMind'},more:R(0.01)} ],                       // Mind the Gate (the mark: teamK)
    pr_7_1:[ {stat:{apow:R(0.004)},per:{units:GSEL}} ],                                                          // Many Thanks
    pr_7_2:[ {on:'out',if:{casting:RH},more:R(0.03)} ],                                                         // Radiant Weight
    pr_7_4:[ {on:'skillTgt',skill:RH,do:[{fn:'hbt'}]} ],                                                         // Hammer Between Them (its 0.3 s: ext)
    pr_8_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ],                                                               // Word Given Twice
    pr_8_4:[ {on:'teamCc',if:{fn:'unitPro'},do:[{fn:'steady'}]} ],                                               // Steady Promise
    pr_9_1:[ {param:'tf',add:R(0.01)} ],                                                                         // Townsfolk (teamK)
    pr_9_3:[ {on:'tick',do:[{fn:'nbWatch'}]} ],                                                                  // Never Broken
    pr_10_2:[ {param:'dr.crit2',add:R(0.02)} ],                                                                  // Firm Grip (in myDr)
    pr_10_3:[ {param:'kw.max',add:R(1)} ],                                                                       // Promise Weight
    pr_10_4:[ {param:'rg.ktc',add:R(0.0024)} ],                                                                  // Keep Them Close (regen)
    pr_11_1:[ {on:'jDawn',do:[{shield:{pct:R(0.02),of:'tgtMaxHp'},dur:6,on:'holder:jPro',emit:'jGrat'}]} ],      // Dawn Mercy
    pr_11_3:[ {param:'al.gra',add:R(0.01)} ],                                                                    // Grateful Town (teamK)
    pr_11_4:[ {on:'teamLethal',if:{fn:'unitPro'},once:'wave',do:[{fn:'iwh'}]} ],                                 // I Will Hold
    pr_12_1:[ {on:'death',if:{unitHas:'jGra',who:'ally'},do:[{heal:{pct:R(0.03),of:'maxHp'}}]} ],                // Last Thanks
    pr_12_2:[ {param:'ten.fear',add:R(0.10)} ],                                                                  // Wakeful (in ten)
    pr_12_3:[ {on:'healOut',skill:DJ,if:{targetHas:'jGra'},more:R(0.02)} ],                                      // Shared Morning
    pr_12_4:[ {stat:{aspd:R(0.01)},if:{fn:'b2b'}}, {stat:{aspd:R(0.01)},to:'holder:jPro',if:{fn:'b2b'}} ],        // Back to Back
    pr_13_3:[ {on:'teamLethal',if:{fn:'unitPro'},do:[{window:'jCarW',dur:3,cd:25},{fn:'carry'}]},                // Carried Like a Promise (SIGNATURE)
              {on:'jCarEnd',do:[{heal:{pct:0.25,of:'tgtMaxHp'},on:'target',emit:'jGrat'}]} ],
    /* ============================== RADIANT HAMMER ============================== */
    ra_1_1:[ {on:'out',if:{casting:RH},more:R(0.04),per:{fn:'hlN'}} ],                                           // Hammerlight (the always rows)
    ra_6_4:[ {on:'out',if:{casting:RH},once:'wave',more:R(0.10)} ],                                              // First Strike of Day
    ra_1_4:[ {param:'hum.less',add:R(0.02)}, {on:'out',if:{auto:true,targetHas:'jHum'},more:R(0.04)} ],         // Humbled (the always row; its cut: myDr / teamK)
    ra_2_1:[ {on:'hit',if:{auto:true,crit:true,targetTeam:'enemy'},chance:R(0.33),do:[{stack:'jHL',add:1}]} ],  // Bright Swing
    ra_2_2:[ {param:'jud.team',add:R(0.02)} ],                                                                   // Judged (the always row; teamK)
    ra_3_1:[ {on:'hit',if:{casting:RH,fn:'hl5'},do:[{dmg:{pct:0.5,of:'hit'},on:{team:'enemy',of:'target',within:2,skip:'target'}}]} ],   // Full Charge
    ra_10_1:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                             // Early Swing (was Hammer of Dawn)
    ra_3_4:[ {param:'hum.dur',add:R(0.5)} ],                                                                     // Brought Low
    ra_4_1:[ {stat:{atk:R(0.004)},per:'jHL'} ],                                                                  // Gathering Light
    ra_4_2:[ {param:'jud.dur',add:R(0.5)} ],                                                                     // Weight of Judgment
    ra_4_3:[ {on:'out',if:{casting:RH},more:R(0.04)} ],                                                         // Crushing Head
    ra_n1:[ {param:'ext.all',add:R(0.1)} ],                                                                      // Ringing Blow (ext)
    ra_10_2:[ {param:'dr.court',add:R(0.005)} ],                                                                 // Court of Morning (in myDr)
    ra_5_4:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'jHum'}} ],                                              // Lowly
    ra_6_1:[ {on:'wave',do:[{stack:'jHL',add:R(2)}]} ],                                                          // Morning Glint
    ra_6_2:[ {on:'out',if:{targetHas:'jJud'},critMore:R(0.03)} ],                                                // Sentence Read
    ra_7_1:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                           // Hammer Rhythm
    ra_7_3:[ {on:'out',if:{casting:DJ},more:R(0.03)} ],                                                         // Daybreak Force
    ra_7_4:[ {on:'teamHeal',if:{unitHas:'jHum'},less:R(0.04)} ],                                                 // Pride Brought Down
    ra_8_1:[ {on:'cast',skill:RH,do:[{heal:{pct:R(0.003),of:'maxHp',x:{fn:'hlN'}}}]} ],                          // Overflowing Light
    ra_8_2:[ {param:'wit',add:R(0.01)} ],                                                                        // Witness Stand (myDr / teamK)
    ra_8_3:[ {param:'ten.sil2',add:R(0.10)} ],                                                                   // Hard Head (in ten)
    ra_9_4:[ {param:'knee',add:1}, {on:'cast',skill:RH,do:[{fn:'knee'}]},                                        // On Your Knees (rhAt, ext; the crush: knee)
             {on:'tick',do:[{fn:'kneeOff'}]}, {on:'die',do:[{fn:'kneeAll'}]} ],
    ra_9_1:[ {on:'out',if:{casting:SK},ignoreMr:R(0.02)} ],                                                      // Holy Weight
    ra_5_2:[ {on:'out',if:{targetHas:'jJud',targetHpBelow:0.25},more:0.30} ],                                    // The Last Ruling (was Final Verdict; PICK ONE)
    ra_5_3:[ {on:'hit',if:{targetTeam:'enemy',targetHas:'jJud'},do:[{heal:{pct:P('mercy',0.15),of:'hit'},on:{team:'ally',within:6,others:true,order:'lowHp',n:1},emit:'jGrat'}]} ],   // Mercy (PICK ONE)
    ra_9_3:[ {stat:{armor:R(0.02)},if:{some:{team:'enemy',has:'jJud'}}} ],                                      // Gate Plate
    ra_6_3:[ {param:'mercy',add:R(0.03)} ],                                                                      // Healing Mercy (points)
    ra_10_4:[ {param:'dr.shame',add:R(0.015)} ],                                                                 // Shamed (in myDr)
    ra_11_1:[ {stat:{crit:R(0.001)},per:'jHL'} ],                                                                // Light in the Hand (with Holy Edge at most 5%)
    ra_11_2:[ {on:'hit',if:{casting:DJ,targetTeam:'enemy'},do:[{mark:'jJud',on:'target',dur:P('jud.dur',5),longest:true},{mark:'jHum',on:'target',dur:4,longest:true}]} ],   // Morning of Judgment (was Judgment Day)
    ra_12_1:[ {param:'hl.keep',add:R(1)} ],                                                                      // Long Light (hlKeep)
    ra_12_2:[ {on:'out',if:{casting:DJ,targetHas:'jJud'},more:R(0.02)} ],                                        // Verdict
    ra_12_3:[ {on:'kit',skill:SG,opt:{mul:{more:R(0.03)}}} ],                                                    // Morning Ward
    ra_12_4:[ {on:'death',if:{unitHas:'jHum'},do:[{heal:{pct:R(0.03),of:'maxHp'}}]} ],                           // Fallen Pride
    ra_13_2:[ {on:'crit',if:{casting:RH,fn:'senOn'},force:true},                                                 // Sentence at Sunrise (SIGNATURE): armed in rhAt (5 Hammerlight on a Judged enemy, once every 15 s)
              {on:'hit',if:{casting:RH,fn:'senOn'},do:[{mark:'jHum',on:'target',dur:P('hum.dur',6),longest:true},{dmg:{pct:0.5,of:'hit'},on:{team:'enemy',of:'target',within:6,has:'jJud',skip:'target'}}]},
              {on:'cast',skill:RH,do:[{fn:'senOff'}]} ]
  },
  fn:{
    keep(A,T){ T.s.api=A; },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP. Every talent of his that makes a hit on him smaller multiplies here (each takes its share of what is left), and
       together they never take more than 40% off a hit (DR_CAP). The enemies' own cuts from his talents (the signature's dazzle, Humbled, Witness Stand) are in
       it too when they hit him. His base kit has no reduction of its own (armour / magic resist: 31% / 23% at level 100), so his worst hit stays far below 90%. ---- */
    drK(A,T,u,src,kind,crit){ const P=T.P, E=A&&A.eng&&A.eng(), now=E?E.now():0;
      let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P['dr.dawn']) cut(P['dr.dawn']*stN(T,'jDawn'));
      if(P['dr.front']&&src&&src.t&&src.t.row==='Front') cut(P['dr.front']);
      if(crit){ cut(P['dr.crit1']); cut(P['dr.crit2']); }
      if(P['dr.grit']) cut(P['dr.grit']*stN(T,'jGrit'));
      if(P['dr.low']&&u.hp<0.3*u.maxHp) cut(P['dr.low']);
      if(P.bs&&mk(u,u,'jSg',now)) cut(P.bs);                                                         // Broad Shield: his own Sanctuary Guard holds on him
      if(E&&(P['dr.gra']||P['dr.court']||P['dr.shame'])){ let g=0, j=0, h=false; const U=E.units();
        for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive) continue; if(x.team===u.team){ if(x!==u&&mk(u,x,'jGra',now)) g++; } else { if(mk(u,x,'jJud',now)) j++; if(mk(u,x,'jHum',now)) h=true; } }
        if(P['dr.gra']) cut(P['dr.gra']*Math.min(4,g)); if(P['dr.court']) cut(P['dr.court']*Math.min(4,j)); if(P['dr.shame']&&h) cut(P['dr.shame']); }
      if(P['dr.dev']&&E){ const h=holder(T,u,now); if(h&&h!==u&&E.dist(u,h)-E.bodyR(u)-E.bodyR(h)<4*E.METER()) cut(P['dr.dev']); }
      if(src){ if(T.r.hm_13_2&&mk(u,src,'jDaz',now)) cut(0.25); if(P['hum.less']&&mk(u,src,'jHum',now)) cut(P['hum.less']); if(P.wit&&mk(u,src,'jJud',now)) cut(P.wit); }
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ T.s.api=A; c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.crit); },
    /* ---- HIS TALENTS ON HIS ALLIES' FIGHT (one teamIn row). A hit on an ally (not Joss) from an enemy: Given Word, Broad Shield, Grateful Town, Brighter Each
       Morning and the enemy's own cuts (dazzle, Humbled, Witness Stand) multiply, together at most 25% off (ALLY_CAP); an enemy that hits the Promised ally is
       marked for Mind the Gate (5 s). A hit by his side on an enemy: Judged (his whole team, Joss too) and Townsfolk (a Grateful ally's hits) ---- */
    teamK(A,T,u,c){ const t=c.tgt, s=c.src, P=T.P; if(!t||!s) return; const E=A.eng(), now=E.now();
      if(t.team===u.team&&s.team!==u.team&&t!==u){ let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
        const isPro=holder(T,u,now)===t;
        if(isPro){ cut(P['al.pro']); if(P.mind) A.setMark(T,u,s,'jMind',{dur:5}); }
        if(P.bs&&mk(u,t,'jSg',now)) cut(P.bs);
        if(P['al.gra']&&mk(u,t,'jGra',now)) cut(P['al.gra']);
        if(P['al.dawn']&&E.dist(u,t)-E.bodyR(u)-E.bodyR(t)<6*E.METER()) cut(P['al.dawn']*stN(T,'jDawn'));
        if(T.r.hm_13_2&&mk(u,s,'jDaz',now)) cut(0.25); if(P['hum.less']&&mk(u,s,'jHum',now)) cut(P['hum.less']); if(P.wit&&mk(u,s,'jJud',now)) cut(P.wit);
        c.amt*=Math.max(1-ALLY_CAP,k); return; }
      if(t.team!==u.team&&s.team===u.team){ if(P['jud.team']&&mk(u,t,'jJud',now)) c.amt*=1+P['jud.team']; if(P.tf&&s!==u&&mk(u,s,'jGra',now)) c.amt*=1+P.tf; } },
    /* control on him: Unbroken Will (every control), Clear Head and Hard Head (silences), Wakeful (fears) multiply; at most 35% shorter (TEN_CAP) */
    ten(A,T,u,c){ const P=T.P, f=c.field; let k=1-(P['ten.all']||0); if(f==='silencedT') k*=(1-(P['ten.sil']||0))*(1-(P['ten.sil2']||0)); if(f==='fearT') k*=1-(P['ten.fear']||0);
      c.amt*=Math.max(1-TEN_CAP,k); },
    /* ---- each second: Bloodied Not Bowed (5+ Grit), Warm Thanks (per Grateful ally) and Keep Them Close (the Promised ally within 3 m) heal him, together at most
       1.2% of his max HP a second (the game's regeneration cap) ---- */
    regen(A,T,u){ const P=T.P, E=A.eng(), now=E.now(); let a=0;
      if(P['rg.bnb']&&stN(T,'jGrit')>=5) a+=P['rg.bnb'];
      if(P['rg.wt']){ let g=0; for(const x of E.units()) if(x.alive&&x.team===u.team&&x!==u&&mk(u,x,'jGra',now)) g++; a+=P['rg.wt']*Math.min(4,g); }
      if(P['rg.ktc']){ const h=holder(T,u,now); if(h&&h!==u&&E.dist(u,h)-E.bodyR(u)-E.bodyR(h)<3*E.METER()) a+=P['rg.ktc']; }
      if(a>0) E.healUnit(u,Math.min(REGEN_CAP,a)*u.maxHp); },
    /* ---- STUNS. His skills' stuns made longer after they land (Ringing Blow, Gate Held, Hammer Between Them, On Your Knees, Sentence at Sunrise), never past
       4.0 s in all (the ceiling without the 30% cut). The stun-lock rule for his one talent stun (the signature's): never on a stunned enemy, nor within 0.5 s
       after one of his stuns on it ends ---- */
    ext(A,T,u,c){ const t=c.tgt, s=T.s, P=T.P; if(!t||!t.alive) return; let x=P['ext.all']||0;
      if(s.cur===DJ) x+=P['ext.dj']||0;
      else if(s.cur===RH&&t===s.joRhV){ if(s.joHbt===t) x+=0.3; if(P.knee&&s.joKnee) x+=0.5; if(s.joSen===t) x+=1.5; }
      if(x>0) t.stunned=Math.max(t.stunned||0,Math.min(STUN_TOP,(c.amt||0)+x)); },
    seRec(A,T,u,c){ const t=c.tgt; if(!t) return; const m=T.s.joSE||(T.s.joSE={}); m[t.uid]=A.eng().now()+(t.stunned||0); },
    stunOk(A,T,u,t){ const m=T.s.joSE||{}; return !((t.stunned||0)>0)&&!(A.eng().now()<(m[t.uid]||-1)+LOCK); },
    /* ---- UNBROKEN DAWN: the tick the game's passive triggers (it sets _ubUsed), event jDawn. Second Morning: at 20 Dawnlight, after the first dawn, the
       passive is armed again once (it triggers the next time he is below 30% HP) and that second dawn spends all his Dawnlight ---- */
    ubWatch(A,T,u){ const s=T.s;
      if(u._ubUsed&&!s.joUbSeen){ s.joUbSeen=1; s.joUbN=(s.joUbN||0)+1; if(s.joUbN===2&&T.P.sm) A.stSet(T,u,'jDawn',0); A.run(T,u,'jDawn',{u,tgt:u}); }
      if(T.P.sm&&s.joUbN===1&&!s.joSM&&stN(T,'jDawn')>=20&&u.pass&&u.pass.unbroken){ s.joSM=1; u._ubUsed=0; s.joUbSeen=0; } },
    udShield(A,T,u){ return u.maxHp*0.30*(u.passMul||1)*(1+(T.P['ud.more']||0)); },                   // Unbroken Dawn's shield as the passive writes it (Morning Comes: larger)
    udMore(A,T,u){ u.shield=(u.shield||0)+u.maxHp*0.30*(u.passMul||1)*(T.P['ud.more']||0); },
    gate(A,T,u){ const E=A.eng(), half=T.fn.udShield(A,T,u)*0.5;
      for(const a of A.pick(T,u,{team:'ally',within:6,others:true},{u})){ A.acts(T,u,[{cleanse:'all',on:'target'}],{u,tgt:a}); a.shield=(a.shield||0)+half; a.shieldT=Math.max(a.shieldT||0,8); A.run(T,u,'jGrat',{u,tgt:a}); }
      for(const e of A.pick(T,u,{team:'enemy',within:6},{u})){ if(T.fn.stunOk(A,T,u,e)) A.control(T,u,e,'stunned',1); A.setMark(T,u,e,'jDaz',{dur:4}); } },
    /* ---- GRIT: Until Morning ---- */
    umOn(A,T,u){ T.s.undy=Math.max(T.s.undy||0,2); T.s.joUm=true; },
    umRh(A,T){ return !!T.s.joUm; }, umClr(A,T){ T.s.joUm=false; },
    /* ---- DAYBREAK AT THE GATE: the Dawnlight spent at the cast ---- */
    dgKit(A,T,u){ T.s.joDg=stN(T,'jDawn'); A.stSet(T,u,'jDawn',0); },
    dgN(A,T){ return T.s.cur===DJ||T.s.cur==null?(T.s.joDg||0):0; },
    /* ---- SANCTUARY GUARD. sgAt: the ally it holds and its shield (his ability power x its strength x skill level, as the skill writes it) and time. sgCast:
       the hold marked (jSg, its time), the Promise moved to that ally (never to himself), Gratitude, Not Yet, Two Promises ---- */
    sgAt(A,T,u,c){ const o=c.o||{}; T.s.joSg={x:c.tgt,v:(u.apow||0)*(o.mul||1.8)*(u._castSM||1),d:o.dur||5}; T.s.joSgSh=-1; T.s.joNb=false; },
    sgCast(A,T,u){ const g=T.s.joSg; if(!g||!g.x) return; const x=g.x, E=A.eng();
      A.setMark(T,u,x,'jSg',{dur:g.d}); A.acts(T,u,[{window:'jSgW',dur:g.d}],{u});
      if(x!==u){ if(PRO.some(id=>T.r[id])) A.setMark(T,u,x,'jPro',{unique:true}); A.run(T,u,'jGrat',{u,tgt:x}); }
      if(T.P.notYet&&x!==u&&u.hp<0.3*u.maxHp){ u.shield=Math.max(u.shield||0,g.v); u.shieldT=Math.max(u.shieldT||0,g.d); u._wardT=Math.max(u._wardT||0,g.d); A.setMark(T,u,u,'jSg',{dur:g.d}); }
      if(T.P.twoPro){ let b=null; for(const a of E.units()) if(a.alive&&a.team===u.team&&a!==x&&!a._dropHidden&&!(a._riseT>0)&&(!b||a.hp/a.maxHp<b.hp/b.maxHp)) b=a;
        if(b){ b.shield=Math.max(b.shield||0,g.v*0.5); b.shieldT=Math.max(b.shieldT||0,g.d); if(b!==u) A.run(T,u,'jGrat',{u,tgt:b}); } } },
    kept(A,T,u,c){ const x=c.unit; if(!x||x===u) return; A.stSet(T,u,'jKW',stN(T,'jKW')+1);
      if(T.P['kw.heal']) A.acts(T,u,[{heal:{pct:T.P['kw.heal'],of:'tgtMaxHp'},on:'target',emit:'jGrat'}],{u,tgt:x}); },
    /* Never Broken: the tick his Sanctuary Guard's shield on its ally is gone while its hold still runs (a hit broke it), the hold lasts 1 s more and the ally
       is cleansed (the game's full cleanse); once per cast */
    nbWatch(A,T,u){ const s=T.s, g=s.joSg, x=g&&g.x; if(!x||!x.alive||s.joNb) return; const now=A.eng().now(), sh=x.shield||0;
      if(s.joSgSh>0&&!(sh>0)&&(x._wardT||0)>0&&mk(u,x,'jSg',now)){ s.joNb=true; x._wardT+=1; A.setMark(T,u,x,'jSg',{dur:(x._wardT||0)}); A.acts(T,u,[{cleanse:'all',on:'target'}],{u,tgt:x}); }
      s.joSgSh=sh; },
    isAlly(A,T,u,c){ const x=c.tgt; return !!x&&x!==u&&x.team===u.team&&!x._summon; },
    /* ---- THE PROMISE ---- */
    unitPro(A,T,u,c){ return !!c.unit&&holder(T,u,A.eng().now())===c.unit&&c.unit!==u; },
    proLow(A,T,u){ const h=holder(T,u,A.eng().now()); return !!h&&h!==u&&h.hp<0.3*h.maxHp; },
    toward(A,T,u){ const h=holder(T,u,A.eng().now()); if(!h||h===u||u.px==null) return false; const mx=u.x-u.px, my=u.y-u.py; return (mx||my)?(mx*(h.x-u.x)+my*(h.y-u.y))>0:false; },
    b2b(A,T,u){ const h=holder(T,u,A.eng().now()); return !!h&&h!==u&&u.hp>0.5*u.maxHp&&h.hp>0.5*h.maxHp; },
    shoulder(A,T,u){ const s=T.s, h=holder(T,u,A.eng().now()), want=(h&&h!==u)?(T.P['sh.arm']||0)*(u.armorRating||0):0;
      if(s.joShX&&s.joShX!==h){ s.joShX.armorRating=(s.joShX.armorRating||0)-(s.joShV||0); s.joShX=null; s.joShV=0; }
      if(h&&h!==u){ h.armorRating=(h.armorRating||0)-(s.joShX===h?(s.joShV||0):0)+want; s.joShX=h; s.joShV=want; } },
    shoulderOff(A,T){ const s=T.s; if(s.joShX){ s.joShX.armorRating=(s.joShX.armorRating||0)-(s.joShV||0); s.joShX=null; s.joShV=0; } },
    steady(A,T,u,c){ const t=c.unit, f=c.field; if(!t||!(c.amt>0)) return; if(Math.abs((t[f]||0)-c.amt)<1e-9) t[f]=c.amt*(1-0.03*(T.r.pr_8_4||0)); },
    hbt(A,T,u,c){ const h=holder(T,u,A.eng().now()), x=h&&h._talBy; T.s.joHbt=null; if(x&&x.alive&&x.team!==u.team){ c.tgt=x; T.s.joHbt=x; } },
    /* I Will Hold: the Promised ally keeps the HP the killing hit took; Joss gains his shield, then takes that hit (as it took the ally's HP: his damage-reduction
       group and the game's own reductions inside damage() apply to it, his armour and magic resist do not) */
    iwh(A,T,u,c){ const x=c.unit, a=c.amt||0; if(!x||!(a>0)||!u.alive) return; x.hp=Math.max(1,x.hp+a); c.stop=true;
      u.shield=(u.shield||0)+0.15*u.maxHp; u.shieldT=Math.max(u.shieldT||0,6); A.eng().damage(u,a*T.fn.drK(A,T,u,null,null,false),'#f0c86a',true); },
    carry(A,T,u,c){ const x=c.unit; if(!x) return; if(x.hp<1) x.hp=1; c.stop=true; A.acts(T,u,[{mark:'jCar',on:'target',dur:3,ends:'jCarEnd'}],{u,tgt:x});
      A.stSet(T,u,'jKW',stN(T,'jKW')+1); u.energy=Math.min(100,(u.energy||0)+25); },
    /* ---- HAMMERLIGHT: spent at the cast (hlN = how many this Radiant Hammer spent) ---- */
    hlKit(A,T,u){ T.s.joHl=stN(T,'jHL'); A.stSet(T,u,'jHL',0); },
    hlN(A,T){ return T.s.joHl||0; }, hl5(A,T){ return (T.s.joHl||0)>=5; },
    hlKeep(A,T,u){ A.stSet(T,u,'jHL',Math.min(stN(T,'jHL'),T.P['hl.keep']||0)); },
    /* ---- RADIANT HAMMER's victim: On Your Knees (it was Humbled already), Sentence at Sunrise (5 Hammerlight spent on a Judged enemy, once every 15 s) ---- */
    rhAt(A,T,u,c){ const s=T.s, t=c.tgt, now=A.eng().now(); s.joRhV=t; s.joKnee=!!(t&&mk(u,t,'jHum',now)); s.joSen=null;
      if(t&&T.r.ra_13_2&&(s.joHl||0)>=5&&mk(u,t,'jJud',now)){ const w=s.w.jSen||(s.w.jSen={t:0,n:0,cdT:0,at:-1,wave:false}); if(!(now<w.cdT)){ w.cdT=now+15; s.joSen=t; } }
      if(T.P.knee&&s.joKnee&&t){ s.joKn=t; } else s.joKn=null; },
    senOn(A,T,u,c){ return !!c.tgt&&T.s.joSen===c.tgt; }, senOff(A,T){ T.s.joSen=null; },
    /* On Your Knees: the victim (Humbled already) has its attack crushed 50% instead of the skill's 35% while this crush holds; given back when it ends */
    knee(A,T){ const s=T.s, t=s.joKn; s.joKn=null; if(t&&t.alive&&(t._atkDnT||0)>0){ const L=s.joCr||(s.joCr=[]); if(L.indexOf(t)<0){ L.push(t); t._joCr0=t._atkDnPct; } t._atkDnPct=Math.max(t._atkDnPct||0,0.50); } },
    kneeOff(A,T,u,c,a,all){ const L=T.s.joCr; if(!L) return; for(let i=L.length-1;i>=0;i--){ const t=L[i]; if(all||!((t._atkDnT||0)>0)||!t.alive){ if(t._atkDnPct===0.50) t._atkDnPct=t._joCr0; t._joCr0=undefined; L.splice(i,1); } } },
    kneeAll(A,T,u,c){ T.fn.kneeOff(A,T,u,c,null,true); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/31 - JOSS GATLEY - talent decisions.md) */
  ruling:{}
};
