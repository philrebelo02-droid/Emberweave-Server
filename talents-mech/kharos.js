/* KHAROS BLOOMKNIFE - what his learned talents do in a fight (the mechanics; his 7 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Kharos Bloomknife")
   His real kit (the code, not the card wording; a melee Assassin, his hits are physical and read his Attack; body 1.61 m):
   - Petal Sever ('bleedstack', green, cd 6, cast 0.5 s): one hit on his target (160% of his attack x skill level), then a stack on it (the engine's _blStk,
     it lapses 6 s after the last: _blT, counted in the TARGET's think) and a NEW bleed each cast (pushDot: 18% of his attack a second x skill level, 6 s,
     colour #8f8fa8 = a bleed, physical through armor). At 3 stacks the wound ruptures (a hit of 200% of his attack, NOT scaled by skill level) and the
     stacks clear. Its cooldown is as long as its stacks last, so in 20 seeded fights it NEVER ruptured (115 casts, every one found 0 stacks):
     tests/kharos-kit-facts.js. Not repaired here; his rupture talents work when a rupture happens (Sever Rhythm, Lingering Cut and Two Wounds make one
     reachable by what they say).
   - Bloomstep ('evadecounter', blue, cd 9, cast 0.5 s): for 2.2 s the next enemy hit on him is evaded (the evade block in _dealDamageCore, before every
     other hook: no 'aimed', no 'in'); he jumps behind the striker (bloomstepJump) and strikes it (210% of his attack x skill level, '#bfe8ff'); if no
     hit comes, at the window's end he jumps behind his target and strikes it (in his think, after the stun return). While it holds his ONE skill
     damage-reduction slot takes 54.9% off (drMul 0.451 at 100) for 2.2 s. 72 casts: 41 counters, 31 window-end strikes, every one landed.
   - Perfect Camouflage (passive 'camouflage'): after 3 s untouched (u._untouched, reset by ANY enemy hit that reaches the dodge rolls, landed or dodged,
     and by Bloomstep's evade) +18% x passive strength dodge (39.4% at 100) and the damage buff 1.25 until the next hit. The flag is u._camOn, the dodge
     u._camEva. Up 27% of his time; it came up 72 times. Because a dodged hit also ends it, its dodge only ever meets the one hit that ends it.
   - Orchid Execution ('execute', ultimate, on energy - no cooldown; ULT_DEF.execute mul 2.2, HERO_ULT_ART.kharos art only): ONE hit on his target,
     220% x skill level x (1 + 2 x the target's missing health share): x1 at full health, x3 at none. It never kills outright (no health threshold).
   Onlookers, Scentless, Wither, Petals, Overreach and Catalogue exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/32 - KHAROS BLOOMKNIFE - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const PS='bleedstack', BS='evadecounter', OE='execute', STR=['counter','bloomEnd'], PSC='#8f8fa8';
const DR_CAP=0.40, CRIT_CAP=0.05, REACH=6;
/* the states several talents read: their bookkeeping runs when any of these is learned */
const ONL=['lu_1_1','lu_2_1','lu_3_1','lu_6_1','lu_n2','lu_7_1','lu_8_1','lu_8_3','lu_9_1','lu_10_1','lu_11_1','lu_11_2','lu_12_1','lu_13_2'];
const SCENT=['lu_1_4','lu_7_4','lu_9_4'];
const WITH=['wo_1_1','wo_2_1','wo_3_1','wo_6_1','wo_7_1','wo_8_3','wo_8_1','wo_9_1','wo_11_2','wo_12_1','wo_12_2','wo_13_2'];
const PET=['wo_1_4','wo_3_4','wo_5_4','wo_6_4','wo_7_4','wo_9_4','wo_11_3','wo_n3','wo_13_2'];
const OVR=['sh_1_1','sh_2_1','sh_3_1','sh_n1','sh_6_1','sh_6_4','sh_8_1','sh_9_1','sh_13_2'];
const CAT=['sh_1_4','sh_3_4','sh_4_3','sh_5_4','sh_7_4','sh_9_2','sh_9_4','sh_11_2','sh_12_2','sh_12_4','sh_13_2'];
const DRG=['lu_11_1','lu_12_3','lu_6_1','wo_4_1','wo_6_1','wo_5_4','sh_n1','sh_4_2','sh_6_1','sh_6_3','sh_7_1','sh_9_2'];
const CRITC=['wo_7_1','sh_1_4','lu_12_2','lu_n2','wo_12_4'], CRITS=['wo_1_2','sh_11_3'], FORCE=['lu_3_1','lu_9_4'];
/* "Petal Sever deals more": its hit and its rupture (while it resolves) and each tick of its bleeds */
const PSM=more=>[{on:'out',if:{casting:[PS,'rupture']},more},{on:'dotOut',if:{tag:'ps'},more}];   // 'rupture': the page's part around a rupture (where the game marks it), else it resolves inside the cast
/* "Bloomstep's strike deals more": the counter on a hit, the strike at the window's end, and the strikes his talents fire */
const STRM=(more,cond)=>[{on:'out',if:Object.assign({casting:STR},cond||{}),more}];
/* "Orchid Execution deals more": its one hit */
const OEM=(more,cond)=>[{on:'out',if:Object.assign({casting:OE},cond||{}),more}];
/* ---- small readers that need no API (the 95% instrument calls drK from a test with the API kept on T.s) ---- */
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const winN=(T,n)=>{ const w=T.s.w[n]; return !!w&&w.t>0; };
const mk=(u,t,name,now)=>{ const o=t&&t._talM&&t._talM[u.uid], m=o&&o[name]; return !!m&&(m.until==null||now<m.until); };
const ust=(u,t,name,now)=>{ const o=t&&t._talM&&t._talM[u.uid], m=o&&o['#'+name]; return (m&&now<m.until)?m.v:0; };
const isOnl=(T,x)=>!!(x&&T.s.onl&&T.s.onl[x.uid]);
const hasPs=(u,x)=>{ const D=x&&x.dots; if(!D) return false; for(let i=0;i<D.length;i++) if(D[i]._talO===u.uid&&D[i]._talK==='ps'&&D[i].remaining>0) return true; return false; };
const gapM=(E,a,b)=>(E.dist(a,b)-E.bodyR(a)-E.bodyR(b))/E.METER();
module.exports={
  hero:'kharos',
  casting:true,                         // rows ask which of his skills a hit comes from (Petal Sever, Bloomstep's strike, Orchid Execution)
  watch:true,                           // team rows (Lured In, Card in the Catalogue, the enemies' cut damage and healing), deaths (Fallen Bloom)
  states:{
    petal:{max:P('petal.max',10)},                                                // Petals on his back (the whole fight)
    wither:{unit:true,max:5,gain:'witherGain',full:'witherFull'},                 // Withers on an enemy (the whole fight)
    finch:{max:4,wave:'reset'},                                                   // Onlookers he killed this wave (Finches and a Cat)
    thank:{max:8,wave:'reset'},                                                   // enemies he hit out of Perfect Camouflage this wave (Thank Them)
    gw:{max:5,wave:'reset'},                                                      // enemies Withered this wave (Garden of Wounds)
    catN:{max:10},                                                                // enemies Catalogued this fight (Whole Collection)
    tk:{max:3}                                                                    // enemies he killed this fight (Taken Cutting)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share, and his capped groups */
  always:[
    {on:'tick',do:[{fn:'scan'}]},                                                                                            // one look a tick: Onlookers, Perfect Camouflage's edges, Scentless, the jump, Two Wounds
    {on:'wave',do:[{fn:'waveStart'}]},
    {on:'aggro',reqAny:SCENT,do:[{fn:'scent'}]},                                                                              // Scentless: an enemy picking him looks for another hero in its reach
    {on:'kit',skill:PS,do:[{fn:'psKit'}]}, {on:'cast',skill:PS,do:[{fn:'psCast'}]},                                          // Petal Sever: its bleed made his, a rupture seen, Withers
    {on:'cast',skill:BS,do:[{fn:'bsCast'}]}, {on:'evade',do:[{fn:'evaded'}]},                                                 // Bloomstep: its window (Second Step, Stand and Cut)
    {on:'end:sac',reqAny:['sh_5_3'],do:[{fn:'sacEnd'}]},
    {on:'hit',if:{casting:STR,targetTeam:'enemy'},do:[{fn:'strikeHit'}]},                                                     // a Bloomstep strike landed
    {on:'hit',reqAny:CAT,if:{casting:STR,targetTeam:'enemy'},do:[{mark:'cat',on:'target',added:'catNew'}]},                  // Catalogue: each enemy Bloomstep strikes, for the fight
    {on:'catNew',reqAny:['sh_12_2'],do:[{stack:'catN',add:1}]},
    {on:'kit',skill:OE,do:[{fn:'oeKit'}]}, {on:'cast',skill:OE,do:[{fn:'oeCast'}]},                                          // Orchid Execution: whom it strikes, the Petals it spends
    {on:'aimed',reqAny:OVR,if:{auto:true,srcWithin:2},do:[{fn:'overreach'}]},                                                 // Overreach: an enemy basic attack reaching him from within 2 m
    {on:'hit',reqAny:PET,if:{crit:true,targetTeam:'enemy'},do:[{stack:'petal',add:1}]},                                       // Petalfall: each critical hit of his sheds a Petal
    {on:'witherGain',reqAny:['wo_12_2'],do:[{fn:'gwAdd'}]},
    {on:'hit',reqAny:['lu_1_4','lu_12_2','lu_6_2','lu_9_2','lu_3_1','lu_9_4'],if:{targetTeam:'enemy'},do:[{fn:'myHit'}]},     // what his next hit is (ambush used, Second Petal spent, the last attack, forced crits spent)
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                                    // his damage-reduction talents: ONE capped group (myDr)
    {stat:{crit:0.01},reqAny:CRITS,per:{fn:'critS'}},                                                                         // Twin Edges and Counter Edge: 1% a rank, inside the crit group
    {on:'crit',reqAny:FORCE,if:{targetTeam:'enemy',fn:'forced'},force:true},                                                  // a guaranteed critical (Bees Did Not Leave, Never Moved Before)
    {on:'crit',reqAny:CRITC,if:{targetTeam:'enemy',fn:'notForced'},chance:{flat:1,x:{fn:'critP'}},force:true}                 // his critical-chance talents: ONE capped group (critP), with the stat part at most 5% in all
  ],
  talents:{
    /* ============================== THE LURE ============================== */
    lu_1_1:[ {on:'out',if:{fn:'tOnl'},more:R(0.02)} ],                                                             // Finest Thing Grown (Onlookers: the scan)
    lu_2_3:[ {stat:{move:R(0.03)}} ],                                                                                // Light Stem
    lu_1_4:[ {on:'out',if:{fn:'ambush'},more:R(0.05)} ],                                                            // No Scent at All (Scentless: the scan and the aggro row)
    lu_2_1:[ {stat:{move:R(-0.03)},to:{team:'enemy',fn:'selOnl'}} ],                                                 // Soft Things Come Close
    lu_2_2:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                              // Arm-Blades
    lu_3_1:[ {on:'kill',if:{fn:'tOnl'},do:[{fn:'bees'}]} ],                                                         // Bees Did Not Leave
    lu_4_2:[ ...PSM(R(0.04)) ],                                                                                     // Crossed Blades
    lu_3_3:[ {param:'cam.dmg',add:R(0.01)} ],                                                                       // Still Bloom (camUp: 25% x 1.05 at 5/5)
    lu_3_4:[ {param:'cam.soon',add:R(0.1)} ],                                                                       // Unnoticed (the scan)
    lu_n1:[ {on:'tick',do:[{weaken:'slowMul',by:R(0.08)}]} ],                                                       // Hothouse Calm (40% at 5/5: its own full rank is the cap)
    lu_5_2:[ {param:'openP',add:1}, {on:'aimed',do:[{fn:'openPetals'}]} ],                                          // Open Petals (PICK ONE)
    lu_5_3:[ {param:'closed',add:1} ],                                                                              // Closed Bud (PICK ONE; the scan, camUp)
    lu_4_3:[ {stat:{nrg:R(0.03)},if:{fn:'camOn'}} ],                                                                // Drinking Light
    lu_6_2:[ {on:'out',if:{fn:'spReady'},more:R(0.04)} ],                                                           // Second Petal (spent by myHit)
    lu_6_3:[ {stat:{aspd:R(0.03)},if:{fn:'camOn'}} ],                                                               // Tight Bud (needs Closed Bud)
    lu_5_4:[ {on:'tick',period:1,if:{fn:'camOn'},do:[{heal:{pct:R(0.0024),of:'maxHp'}}]} ],                         // Perfectly Still (1.2% a second at 5/5: the regeneration cap)
    lu_6_1:[ {param:'dr.adm',add:R(0.03)}, {on:'teamIn',if:{fn:'srcOnl',targetTeam:'ally'},less:R(0.03)} ],         // Admiring Glance (on him: in myDr)
    lu_n2:[ {param:'crit.bell',add:R(0.01)} ],                                                                      // Opening Bell (in critP)
    lu_10_2:[ {on:'dodge',if:{fn:'camOff'},chance:R(0.015),do:[{dodge:true}]} ],                                    // Glass Patience
    lu_7_1:[ {on:'kill',if:{fn:'tOnl'},do:[{stack:'finch',add:1}]}, {stat:{atk:R(0.01)},per:'finch'} ],             // Finches and a Cat
    lu_7_3:[ ...STRM(R(0.03)) ],                                                                                    // Ambush Bloom
    lu_7_4:[ {param:'sc.after',add:R(0.5)} ],                                                                       // Under Glass (the scan)
    lu_8_1:[ {param:'onl.m',add:R(0.5)} ],                                                                          // Close Enough (the scan)
    lu_8_2:[ {on:'cd',skill:'blue',add:R(-0.1)} ],                                                                  // Bloomstep Blade
    lu_8_3:[ {on:'out',if:{fn:'tOnl'},critMore:R(0.02)} ],                                                          // Sure Cut (2% a rank: crit damage at most 10%)
    lu_9_1:[ {on:'skillTgt',skill:'bloomEnd',do:[{retarget:{team:'enemy',fn:'selOnl',order:'near',n:1}}]} ],        // The Collector's Shears
    lu_9_2:[ {on:'out',if:{fn:'patient'},more:R(0.05)} ],                                                           // Patient Orchid (his last attack: myHit)
    lu_9_3:[ {on:'out',if:{targetHpBelow:0.40},more:R(0.02)} ],                                                     // Wedding Morning
    lu_9_4:[ ],                                                                                                     // Never Moved Before (the always forced-crit row)
    lu_10_1:[ {on:'teamIn',if:{fn:'lured'},more:R(0.01)} ],                                                         // Lured In
    lu_n3:[ {on:'tick',period:1,if:{fn:'unwatched'},do:[{energy:R(1)}]} ],                                          // Wallflower
    lu_11_1:[ {param:'dr.beau',add:R(0.01)} ],                                                                      // Beautiful (in myDr: per Onlooker, up to 4)
    lu_11_2:[ {param:'show',add:1}, ...OEM(0.20,{fn:'tOnl'}) ],                                                     // Orchid Show (oeKit)
    lu_11_3:[ ...OEM(R(0.03)) ],                                                                                    // Petal Edge
    lu_12_1:[ {param:'ll',add:R(1)} ],                                                                              // Long Look (the scan)
    lu_12_2:[ {param:'crit.thank',add:R(0.001)}, {on:'hit',if:{fn:'camOn',targetTeam:'enemy'},by:'target',once:'wave',do:[{stack:'thank',add:1}]} ],   // Thank Them (in critP)
    lu_12_3:[ {param:'dr.md',add:R(0.03)} ],                                                                        // Measured Distance (in myDr)
    lu_12_4:[ {param:'cam.eva',add:R(0.02)} ],                                                                      // Unscented (camUp: 39.4% x 1.04 at 2/2)
    lu_13_2:[ {on:'dodge',if:{fn:'breaksCam'},do:[{window:'wia',dur:0.01,cd:20},{dodge:true},{fn:'admired'}]} ],    // While It Is Admired (SIGNATURE)
    /* ============================== THE WOUND THAT DOES NOT CLOSE ============================== */
    wo_1_1:[ {param:'with.k',add:R(0.01)}, {on:'teamHeal',if:{unitUst:{wither:1}},do:[{fn:'witherCap'}]} ],          // Does Not Close (Withers: psCast)
    wo_3_3:[ {on:'out',if:{targetDot:'ps'},more:R(0.02)} ],                                                         // Pink Sunrise
    wo_1_4:[ {on:'out',if:{casting:OE},more:R(0.015),per:{fn:'petSp'}} ],                                           // Falling Petals (Petalfall: the always row; spent by oeCast)
    wo_2_1:[ {on:'out',more:R(0.01),per:{ust:'wither',of:'target'}}, {on:'dotOut',more:R(0.01),per:{ust:'wither',of:'target'}} ],   // Dry Rot
    wo_2_2:[ {on:'kit',skill:PS,opt:{bleed:{more:R(0.03)}}} ],                                                      // Deep Sever
    wo_1_2:[ ],                                                                                                     // Twin Edges (the always crit stat row)
    wo_3_1:[ {param:'root',add:1} ],                                                                                // Root and Stem (psKit)
    wo_4_2:[ {on:'kit',skill:PS,opt:{stackDur:{add:R(0.4)}}} ],                                                     // Lingering Cut (the stacks and each new bleed)
    wo_4_3:[ {on:'hit',if:{crit:true,auto:true,targetTeam:'enemy'},do:[{energy:R(0.33)}]} ],                        // Sun-Fed (3% a rank of a swing's 11 energy)
    wo_3_4:[ {param:'petal.max',add:R(2)} ],                                                                        // Full Bloom
    wo_4_1:[ {param:'dr.hardy',add:R(0.015)} ],                                                                     // Hardy (in myDr)
    wo_6_1:[ {param:'dr.wg',add:R(0.01)}, {on:'teamIn',if:{srcUst:{wither:1},targetTeam:'ally'},less:R(0.01),per:{ust:'wither',of:'source'}} ],   // Withering Gaze (on him: in myDr)
    wo_5_4:[ {param:'dr.pg',add:R(0.002)} ],                                                                        // Petal Guard (in myDr)
    wo_n1:[ {on:'cast',skill:PS,do:[{energy:R(0.22)}]} ],                                                           // Bitter Sap (2% a rank of a cast's 11 energy)
    wo_7_1:[ {param:'crit.cf',add:R(0.01)} ],                                                                       // Cut Flower (in critP)
    wo_6_4:[ {stat:{move:R(0.03)},if:{stackMin:{petal:5}}} ],                                                       // Petal Wings
    wo_7_3:[ ...STRM(R(0.04),{targetDot:'ps'}) ],                                                                   // Bloomcut
    wo_7_4:[ {on:'hit',if:{casting:STR,targetTeam:'enemy'},do:[{stack:'petal',add:R(1)}]} ],                        // Shedding Season
    wo_8_3:[ {on:'out',if:{targetUst:{wither:1}},critMore:R(0.02)} ],                                               // Cruel Bloom (2% a rank: crit damage at most 10%)
    wo_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                                 // Sever Rhythm
    wo_9_4:[ {param:'storm',add:1} ],                                                                               // Petal Storm (oeCast)
    wo_8_1:[ {stat:{armor:R(-0.01)},to:{team:'enemy',ust:{wither:1}},per:{ust:'wither',of:'target'}} ],             // Brittle Stems
    wo_5_2:[ {param:'two',add:1} ],                                                                                 // Two Wounds (PICK ONE; psCast, the scan)
    wo_5_3:[ {on:'out',if:{fn:'isRup'},more:0.25} ],                                                                // Single Cut (PICK ONE)
    wo_9_3:[ ...OEM(R(0.03),{targetDot:'ps'}) ],                                                                    // Least Kind
    wo_9_1:[ {on:'death',if:{unitUst:{wither:1}},do:[{fn:'fallenBloom'}]} ],                                        // Fallen Bloom
    wo_6_2:[ {on:'dotOut',if:{tag:'ps',fn:'secondWound'},more:R(0.04)} ],                                           // Spreading Rot (needs Two Wounds)
    wo_6_3:[ {on:'out',if:{fn:'isRup'},more:R(0.05)} ],                                                             // Clean Line (needs Single Cut)
    wo_9_2:[ {on:'dotTick',if:{tag:'ps'},do:[{heal:{pct:R(0.02),of:'hit'}}]} ],                                      // Red on Pink
    wo_10_1:[ {on:'out',if:{targetHpBelow:0.30},more:R(0.03)} ],                                                    // Last Bloom
    wo_10_2:[ ...PSM(R(0.03)) ],                                                                                    // Open Wide
    wo_11_1:[ {on:'teamHeal',if:{unitDot:'ps'},less:R(0.02)} ],                                                     // No Mending
    wo_11_2:[ {param:'crossed',add:1} ],                                                                            // Crossed Once (psCast)
    wo_11_3:[ {stat:{atk:R(0.002)},per:'petal'} ],                                                                  // Petal Hoard
    wo_n3:[ {param:'quarter',add:1} ],                                                                              // A Petal Each Quarter (the scan)
    wo_12_1:[ {stat:{move:R(-0.01)},to:{team:'enemy',ust:{wither:1}},per:{ust:'wither',of:'target'}} ],             // Wilting
    wo_12_2:[ {on:'out',more:R(0.01),per:'gw'}, {on:'dotOut',more:R(0.01),per:'gw'} ],                              // Garden of Wounds (gwAdd)
    wo_12_3:[ {on:'out',if:{targetLacks:'sc1'},critMore:R(0.05)}, {on:'hit',if:{targetTeam:'enemy'},do:[{mark:'sc1',on:'target'}]} ],   // Shears Closed (5% a rank: 10% at 2/2)
    wo_12_4:[ {param:'crit.sp',add:R(0.015)} ],                                                                     // Spinning Pinks (in critP)
    wo_13_2:[ {on:'witherFull',do:[{window:'wwnc',dur:0.01,cd:20},{fn:'woundSig'}]}, {on:'teamHeal',if:{unitHas:'nohl'},mul:0},                    // The Wound Will Not Close (SIGNATURE)
              {on:'dotOut',if:{tag:'ps',targetHas:'nohl'},more:1} ],
    /* ============================== DEADHEADING ============================== */
    sh_1_1:[ {on:'out',if:{targetHas:'over'},more:R(0.02)} ],                                                       // How Far Away Their Hands Are (Overreach: the always aimed row)
    sh_2_3:[ {stat:{move:R(0.03)}} ],                                                                                // Quick Stem
    sh_1_4:[ {param:'crit.cat',add:R(0.015)} ],                                                                     // Catalogued (Catalogue: the always hit row; in critP)
    sh_2_1:[ {param:'over.slow',add:R(0.04)} ],                                                                     // Reaching Hand (overreach)
    sh_2_2:[ ...STRM(R(0.03)) ],                                                                                    // Counter Blade
    sh_3_1:[ {on:'dodge',if:{fn:'overNow'},do:[{window:'qth',dur:0.01,cd:10},{dodge:true},{fn:'qth'}]} ],           // Quicker Than Hands
    sh_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                      // Sharp Petals
    sh_3_4:[ {on:'teamIn',if:{targetHas:'cat',fn:'srcMine'},more:R(0.01)} ],                                        // Card in the Catalogue (his own hits and his team's)
    sh_n1:[ {param:'dr.rtf',add:0.04} ],                                                                            // Reached Too Far (LINK; overreach, the scan; in myDr)
    sh_4_2:[ {param:'dr.bt',add:R(0.04)} ],                                                                         // Behind Them (the scan sees the jump; in myDr)
    sh_4_3:[ {on:'hit',if:{auto:true,targetHas:'cat'},do:[{energy:R(0.33)}]} ],                                     // Quick Learner
    sh_6_1:[ {param:'dr.oe',add:R(0.03)}, {on:'teamIn',if:{srcHas:'over',targetTeam:'ally'},less:R(0.03)} ],        // Overextended (on him: in myDr)
    sh_5_1:[ {on:'ccIn',less:R(0.04)} ],                                                                            // Unbent (20% at 5/5: its own full rank is the cap)
    sh_5_2:[ {param:'ss',add:1}, {on:'out',if:{casting:STR,fn:'ssOn'},mul:0.7} ],                                   // Second Step (PICK ONE; evaded)
    sh_5_3:[ {param:'sac',add:1}, ...STRM(0.25) ],                                                                  // Stand and Cut (PICK ONE; bsCast, sacEnd)
    sh_5_4:[ {on:'out',if:{targetHas:'cat'},more:R(0.01)} ],                                                        // Pressed Specimen
    sh_11_3:[ ],                                                                                                    // Counter Edge (the always crit stat row)
    sh_6_2:[ ...STRM(R(0.03),{fn:'secondJump'}) ],                                                                  // Double Back (needs Second Step)
    sh_6_3:[ {param:'dr.pl',add:R(0.05)} ],                                                                         // Planted (in myDr)
    sh_6_4:[ {on:'dodge',if:{srcHas:'over',fn:'notDodged'},chance:R(0.02),do:[{dodge:true}]} ],                                    // Glass Eye
    sh_7_1:[ {param:'dr.ho',add:R(0.01)} ],                                                                         // Hands Off (in myDr)
    sh_7_3:[ ...PSM(R(0.03)) ],                                                                                     // Cross Cut
    sh_7_4:[ {on:'out',if:{targetHas:'cat'},critMore:R(0.03)} ],                                                    // Full Record (3% a rank: crit damage at most 10%)
    sh_8_1:[ {param:'over.dur',add:R(0.5)} ],                                                                       // Too Close
    sh_8_2:[ {on:'cd',skill:'blue',add:R(-0.1)} ],                                                                  // Bloomstep Rhythm
    sh_8_3:[ {on:'out',if:{casting:STR},critMore:R(0.04)} ],                                          // Clean Shears (an ability's crit damage: up to 20%)
    sh_9_1:[ {on:'kill',if:{targetHas:'over'},do:[{cd:'blue',mul:0.5}]} ],                                          // Snip
    sh_9_2:[ {param:'dr.rs',add:R(0.03)} ],                                                                         // Read the Swing (in myDr)
    sh_9_3:[ ...OEM(R(0.03)) ],                                                                                     // Bridal Bloom
    sh_9_4:[ {on:'sure',if:{targetHas:'cat'},force:true} ],                                                         // Known Habits
    sh_10_1:[ {on:'hit',if:{casting:STR,targetTeam:'enemy'},do:[{window:'silver',dur:3}]}, {stat:{aspd:R(0.02)},if:{window:'silver'}} ],   // Silver Reach
    sh_11_1:[ {on:'out',if:{targetWithin:2},more:R(0.02)} ],                                                        // Arm's Length
    sh_11_2:[ {param:'eo',add:1} ],                                                                                 // Execution Order (oeKit)
    sh_10_2:[ {on:'kill',dots:true,if:{targetTeam:'enemy'},do:[{stack:'tk',add:1}]}, {stat:{atk:R(0.01)},per:'tk'} ],   // Taken Cutting
    sh_12_1:[ {on:'out',if:{casting:STR},once:'wave',more:R(0.10)} ],                                               // Shears Out
    sh_12_2:[ {stat:{aspd:R(0.005)},per:'catN'} ],                                                                  // Whole Collection
    sh_12_3:[ {on:'hit',if:{casting:STR,targetTeam:'enemy'},do:[{heal:{pct:R(0.02),of:'maxHp'}}]} ],                // Bow and Thank
    sh_12_4:[ {on:'teamHeal',if:{unitHas:'cat'},less:R(0.04)} ],                                                    // Exhibit
    sh_13_2:[ {on:'dodge',if:{fn:'overNow'},do:[{window:'bmf',dur:0.01,cd:20},{dodge:true},{fn:'bmf'}]} ]           // Before the Man Had Finished Reaching (SIGNATURE)
  },
  fn:{
    waveStart(A,T,u){ const s=T.s; s.api=A; s.wt0=A.eng().now(); s.gwS={}; s.qf={}; },
    /* ---- THE SCAN, once a tick (after every unit has thought). Onlookers: each enemy whose body is within 3 m of his (Close Enough: farther) and whose target
       is not him (Long Look: for that long after it turned on him; Reached Too Far with Finest Thing Grown: while it Overreaches; Bees Did Not Leave: for its
       3 s anywhere). Perfect Camouflage's edges (camUp / camDown), Scentless (u._talAgg, read by the page's target pick), Closed Bud and Unnoticed (the
       camouflage comes up sooner), Bloomstep's jump (Behind Them), Two Wounds' open wounds, A Petal Each Quarter. Nothing here draws from the seeded stream. ---- */
    scan(A,T,u,c){ const s=T.s, E=A.eng(), P=T.P, now=E.now(), R0=(3+(P['onl.m']||0)), ll=P.ll||0, rtf=!!(T.r.lu_1_1&&T.r.sh_n1);
      const onl=s.onl||(s.onl={}); for(const k in onl) delete onl[k]; const ln=s.ln||(s.ln={}), bo=s.bo||(s.bo={}); let n=0, att=0; const U=E.units();
      for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive||x.team===u.team||x._dropHidden) continue; const on=x.target===u; if(on) att++; else ln[x.uid]=now;
        if(x._noTarget) continue; let o=false;
        if((bo[x.uid]||0)>now) o=true;
        else if(gapM(E,u,x)<R0){ if(!on) o=true; else if(ll>0&&ln[x.uid]!=null&&now-ln[x.uid]<ll) o=true; else if(rtf&&mk(u,x,'rtf',now)) o=true; }
        if(o){ onl[x.uid]=1; n++; }
        if(P.quarter&&x===u.target){ const f=x.hp/Math.max(1,x.maxHp), q=s.qf||(s.qf={}), was=q[x.uid]; if(was!=null) for(const th of [0.75,0.50,0.25]) if(was>=th&&f<th){ A.stSet(T,u,'petal',A.stGet(T,'petal')+2); } q[x.uid]=f; } }
      s.onlN=n; s.att=att;
      const cam=!!u._camOn;
      if(cam&&!s.camWas) T.fn.camUp(A,T,u); else if(!cam&&s.camWas){ s.scU=now+(P['sc.after']||0); }
      s.camWas=cam;
      if(SCENT.some(id=>T.r[id])){ const sc=cam||now<(s.scU||-1); if(sc&&!s.scWas) s.nmb={}; s.scWas=sc; s.sc=sc; const f=sc?1:0; if((u._talAgg|0)!==f) u._talAgg=f; }
      if(u.pass&&u.pass.camouflage&&!cam){ const th=(P.closed?2:3)-(P['cam.soon']||0); if(th<3-1e-9&&(u._untouched||0)>=th&&(u._untouched||0)<3) u._untouched=3; }
      s.ut=u._untouched||0; s.evT=u._evadeT||0;
      const js=u._bloomJumpSeq|0; if(js!==(s.js|0)){ s.js=js; if(P['dr.bt']) A.acts(T,u,[{window:'behind',dur:2}],c); }
      if(P.two&&s.pw) for(const x of s.pw) if(x.alive&&(x._blStk||0)>0&&(x._blT||0)<0.5) x._blT=0.5; },
    /* Perfect Camouflage has just come up: Closed Bud halves its dodge, Unscented makes it 2% a rank stronger (multiplied, as the passive writes it: never past
       the game's 50%); Still Bloom makes its damage bonus 1% a rank stronger (25% x 1.05 at 5/5, only while the bonus is the camouflage's own) */
    camUp(A,T,u){ const s=T.s, P=T.P; s.amb=false; s.held=false; s.sp=false;
      const k=(P.closed?0.5:1)*(1+(P['cam.eva']||0)), e0=u._camEva||0;
      if(k!==1&&e0>0){ const v0=u.evaStat||0, v1=Math.max(0,Math.min(0.5,v0+e0*(k-1))); u.evaStat=v1; u._camEva=e0+(v1-v0); }
      if(P['cam.dmg']&&(u.dmgBuffT||0)>50&&Math.abs((u.dmgBuffMul||1)-1.25)<1e-9) u.dmgBuffMul=1+0.25*(1+P['cam.dmg']); },
    camOn(A,T,u){ return !!u._camOn; }, camOff(A,T,u){ return !u._camOn; },
    ambush(A,T,u){ return !!u._camOn&&!T.s.amb; },
    spReady(A,T){ return !!T.s.sp; },
    /* what his next hit is: No Scent at All's first hit out of the camouflage, Second Petal, Patient Orchid's last attack, the forced crits spent */
    myHit(A,T,u,c){ const s=T.s, x=c.tgt, now=A.eng().now(); if(u._camOn) s.amb=true; s.sp=false; s.la=now;
      if(x&&s.bee&&s.bee[x.uid]) delete s.bee[x.uid]; if(x&&s.sc&&s.nmb) s.nmb[x.uid]=1; },
    patient(A,T,u){ const la=T.s.la; return la==null||A.eng().now()-la>=3-1e-9; },
    /* Open Petals: the first enemy hit that would end the camouflage (landed or dodged: the game ends it on any hit that reaches the dodge rolls) does not;
       the second does. The hit itself is not changed */
    openPetals(A,T,u){ const s=T.s; if(!T.P.openP||!u._camOn||s.held||!((s.ut||0)>=3)||(u._untouched||0)>1e-9) return; u._untouched=s.ut; s.held=true; s.sp=!!T.r.lu_6_2; },
    breaksCam(A,T,u,c){ const s=T.s; return !c.dodged&&!!u._camOn&&(s.ut||0)>=3&&(u._untouched||0)<=1e-9&&T.fn.free(A,T,u); },
    free(A,T,u){ return !((u.stunned||0)>0)&&!((u.fearT||0)>0)&&u.alive; },
    /* ---- Scentless: an enemy picking him (its basic attacks' target) picks instead the nearest other hero of his side in its reach (a melee enemy: within
       4 m body to body; a ranged one: within its attack range, centre to centre, as it attacks). None in reach: it keeps him ---- */
    scent(A,T,u,c){ const by=c.src, E=A.eng(); if(!by||!T.s.sc) return; let best=null, bd=1e18; const U=E.units();
      for(let i=0;i<U.length;i++){ const x=U[i]; if(x===u||!x.alive||x.team!==u.team||x._summon||x._noTarget||x._dropHidden||(x._riseT>0)) continue;
        const d=E.dist(by,x), ok=by.melee?(d-E.bodyR(by)-E.bodyR(x)<4*E.METER()):(d<=(by.range||0)); if(ok&&d<bd){ bd=d; best=x; } }
      if(best) c.tgt=best; },
    tOnl(A,T,u,c){ return isOnl(T,c.tgt); }, srcOnl(A,T,u,c){ return isOnl(T,c.src); }, selOnl(A,T,u,c){ return isOnl(T,c.tgt); },
    lured(A,T,u,c){ return isOnl(T,c.tgt)&&!!c.src&&c.src.team===u.team; },
    srcMine(A,T,u,c){ return !!c.src&&c.src.team===u.team; },
    unwatched(A,T){ return !(T.s.att>0); },
    /* Bees Did Not Leave: an Onlooker he killed: the nearest other enemy is an Onlooker for 3 s wherever it stands, and his next hit on it is a critical */
    bees(A,T,u,c){ const s=T.s, x=c.tgt, t=A.pick(T,u,{team:'enemy',of:'target',n:1,skip:'target'},c)[0]; if(!t) return; (s.bo||(s.bo={}))[t.uid]=A.eng().now()+3; (s.bee||(s.bee={}))[t.uid]=1; (s.onl||(s.onl={}))[t.uid]=1; },
    /* ---- HIS CRITICAL CHANCE, ONE GROUP (Phil: crit rate talents at most 5% per hero). Twin Edges and Counter Edge are a stat (1% a rank, together at most
       5%); Cut Flower (Withered), Catalogued, Thank Them, Opening Bell (Onlookers, the first 4 s of a wave) and Spinning Pinks (Orchid Execution) add a seeded
       chance for that hit only, inside the room the stat left. Bees Did Not Leave and Never Moved Before are guaranteed criticals (forced, not a chance) ---- */
    critS(A,T){ return Math.min(5,(T.r.wo_1_2||0)+(T.r.sh_11_3||0)); },
    critP(A,T,u,c){ const P=T.P, s=T.s, t=c.tgt, now=A.eng().now(); let p=0;
      if(P['crit.cf']&&ust(u,t,'wither',now)>0) p+=P['crit.cf'];
      if(P['crit.cat']&&mk(u,t,'cat',now)) p+=P['crit.cat'];
      if(P['crit.thank']) p+=P['crit.thank']*stN(T,'thank');
      if(P['crit.bell']&&isOnl(T,t)&&s.wt0!=null&&now-s.wt0<4) p+=P['crit.bell'];
      if(P['crit.sp']&&s.cur===OE) p+=P['crit.sp'];
      return Math.max(0,Math.min(p,CRIT_CAP-0.01*T.fn.critS(A,T))); },
    forced(A,T,u,c){ const s=T.s, t=c.tgt; if(!t) return false; if(T.r.lu_3_1&&s.bee&&s.bee[t.uid]) return true; if(T.r.lu_9_4&&s.sc&&s.nmb&&!s.nmb[t.uid]) return true; return false; },
    notForced(A,T,u,c){ return !c.force; }, notDodged(A,T,u,c){ return !c.dodged; },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP. Every talent of his that makes a hit on him smaller multiplies here (each takes its share of what is left), and
       together they never take more than 40% off a hit (DR_CAP). Bloomstep's own 54.9% stays in the game's one skill slot, outside the group ---- */
    drK(A,T,u,src,kind,auto){ const P=T.P, s=T.s, E=A&&A.eng&&A.eng(), now=E?E.now():0; let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P['dr.beau']) cut(P['dr.beau']*Math.min(4,s.onlN||0));
      if(P['dr.md']&&src&&src.melee) cut(P['dr.md']);
      if(P['dr.ho']&&src&&src.melee&&auto) cut(P['dr.ho']);
      if(P['dr.adm']&&isOnl(T,src)) cut(P['dr.adm']);
      if(P['dr.hardy']&&hasPs(u,src)) cut(P['dr.hardy']);
      if(P['dr.wg']) cut(P['dr.wg']*ust(u,src,'wither',now));
      if(P['dr.pg']) cut(P['dr.pg']*stN(T,'petal'));
      if(P['dr.rtf']&&mk(u,src,'rtf',now)) cut(P['dr.rtf']);
      if(P['dr.bt']&&winN(T,'behind')) cut(P['dr.bt']);
      if(P['dr.oe']&&mk(u,src,'over',now)) cut(P['dr.oe']);
      if(P['dr.pl']&&winN(T,'sac')) cut(P['dr.pl']);
      if(P['dr.rs']&&mk(u,src,'cat',now)) cut(P['dr.rs']);
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ T.s.api=A; c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.auto); },
    /* ---- PETAL SEVER: its new bleed made his ('ps'), a rupture seen (the stacks before + 1 reached 3 and the engine cleared them), Withers ---- */
    psKit(A,T,u,c){ const s=T.s, E=A.eng(), x=(u.target&&u.target.alive)?u.target:A.pick(T,u,{team:'enemy',n:1},c)[0]; s.psT=x||null; if(!x) return;
      s.psN0=(x.dots||[]).length; const need=(c.o&&c.o.rupture)||3;
      if(T.P.root&&ust(u,x,'wither',E.now())>=3&&(x._blStk||0)<need-1) x._blStk=need-1;               // Root and Stem: on 3+ Withers this cast ruptures at once
      s.psWill=(x._blStk||0)+1>=need; },
    isRup(A,T,u,c){ const s=T.s, x=c.tgt; return (s.cur==='rupture'&&!!x&&x===s.psT)||(s.cur===PS&&!!x&&x===s.psT&&!!s.psWill&&(x._blStk||0)===0&&!((x._blT||0)>0)); },   // the rupture's own hit (marked by the page's 'rupture' part where it has one)
    psCast(A,T,u,c){ const s=T.s, x=s.psT; s.psT=null; if(!x) return; const D=x.dots||[];
      for(let i=s.psN0||0;i<D.length;i++){ const d=D[i]; if(d.src===u&&d.color===PSC&&d._talO==null){ d._talO=u.uid; d._talK='ps'; } }
      if(T.P.two&&x.alive){ const L=s.pw||(s.pw=[]), j=L.indexOf(x); if(j>=0) L.splice(j,1); L.push(x); while(L.length>2) L.shift(); }   // Two Wounds: his last two Petal Sever targets
      const rup=!!s.psWill&&(x._blStk||0)===0&&!((x._blT||0)>0)&&D.some(d=>d._talK==='ps'&&d.src===u); s.psWill=false; if(!rup) return; s.rups=(s.rups||0)+1;
      if(WITH.some(id=>T.r[id])){ const L=[{ustack:'wither',on:'target',add:1}]; if(T.P.crossed) L.push({ustack:'wither',on:{team:'enemy',of:'target',within:2,skip:'target'},add:1});
        A.acts(T,u,L,Object.assign({},c,{tgt:x})); } },
    secondWound(A,T,u,c){ const L=T.s.pw; return !!L&&L.length===2&&c.tgt===L[0]; },
    witherCap(A,T,u,c){ const x=c.unit; if(!x) return; const w=ust(u,x,'wither',A.eng().now()), cap=(x.maxHp||0)*(1-(T.P['with.k']||0)*w); c.amt=Math.max(0,Math.min(c.amt,cap-(x.hp||0))); },
    gwAdd(A,T,u,c){ const s=T.s, x=c.tgt; if(!x) return; const g=s.gwS||(s.gwS={}); if(g[x.uid]) return; g[x.uid]=1; A.stSet(T,u,'gw',A.stGet(T,'gw')+1); },
    fallenBloom(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team) return; const w=ust(u,x,'wither',A.eng().now()); const t=A.pick(T,u,{team:'enemy',of:'unit',n:1},c)[0]; if(t&&w>0) A.acts(T,u,[{ustack:'wither',on:'target',add:w}],Object.assign({},c,{tgt:t})); },
    /* The Wound Will Not Close: once every 20 s, an enemy reaching 5 Withers can no longer be healed (the teamHeal row), his Petal Sever bleeds on it twice as
       hard until it dies (the dotOut row), and his Petals are full */
    woundSig(A,T,u,c){ const x=c.tgt; if(!x||!x.alive) return;
      A.setMark(T,u,x,'nohl',{}); A.stSet(T,u,'petal',A.stMax(T,u,'petal')); },
    /* ---- ORCHID EXECUTION: whom it strikes (Execution Order: the Catalogued enemy with the lowest HP within 6 m; else Orchid Show: the Onlooker with the
       lowest HP), the Petals it spends (Falling Petals: 1.5% a rank each; Petal Storm: each cuts an enemy, in turn, for 10% of his attack) ---- */
    oeKit(A,T,u,c){ const s=T.s, E=A.eng(), P=T.P, now=E.now(); s.petSp=A.stGet(T,'petal'); let x=null;
      const low=L=>L.reduce((a,b)=>(!a||b.hp<a.hp)?b:a,null);
      if(P.eo) x=low(A.pick(T,u,{team:'enemy',within:REACH},c).filter(e=>mk(u,e,'cat',now)));
      if(!x&&P.show) x=low(A.pick(T,u,{team:'enemy'},c).filter(e=>isOnl(T,e)));
      if(x){ u.target=x; c.tgt=x; } },
    petSp(A,T){ return T.s.petSp||0; },
    oeCast(A,T,u,c){ const s=T.s, n=s.petSp||0; s.petSp=0; if(!(T.r.wo_1_4||T.r.wo_9_4)) return; A.stSet(T,u,'petal',0);
      if(T.P.storm&&n>0){ const L=A.pick(T,u,{team:'enemy'},c); if(!L.length) return; let j=Math.max(0,L.indexOf(u.target));
        for(let i=0;i<n;i++){ j=(j+1)%L.length; const t=L[j]; if(t.alive) A.acts(T,u,[{dmg:{pct:0.10,of:'atk'},on:'target',def:'phys',color:'#e8a0c0'}],Object.assign({},c,{tgt:t})); } } },
    /* ---- BLOOMSTEP. bsCast: its window opens (Second Step's count; Stand and Cut: no jump, a window of its own); evaded: the window was spent on a hit ---- */
    bsCast(A,T,u,c){ const s=T.s; s.bw={n:0,re:false}; if(T.P.sac){ u._bloomOn=0; A.acts(T,u,[{window:'sac',dur:(c.o&&c.o.dur)||2.2}],c); } },
    evaded(A,T,u,c){ const s=T.s; if(T.P.sac&&winN(T,'sac')){ A.acts(T,u,[{window:'sac',end:true}],c); return; }
      if(T.P.ss&&!T.P.sac&&s.bw&&!s.bw.re){ s.bw.re=true; A.acts(T,u,[{after:0,do:[{fn:'ssReopen',left:Math.max(0.05,s.evT||0)}]}],c); } },
    ssReopen(A,T,u,c,a){ if(!u.alive) return; u._evadeT=Math.max(u._evadeT||0,a.left); u._bloomOn=1; },
    ssOn(A,T){ return !!T.s.bw; },
    secondJump(A,T){ return !!T.s.bw&&T.s.bw.n>=1; },
    strikeHit(A,T,u){ if(T.s.bw) T.s.bw.n++; },
    /* Stand and Cut: the window ran out with no hit: he strikes his target where it stands, if it is within 2 m (no jump) */
    sacEnd(A,T,u,c){ const E=A.eng(), t=u.target; if(!t||!t.alive||t.team===u.team||!(gapM(E,u,t)<2)) return; T.fn.strike(A,T,u,t,1,false,'bloomEnd'); },
    /* one Bloomstep strike fired by a talent: the game's own strike (Bloomstep's 210% x his skill level, a real hit: it can crit, armor applies) through the
       bound dealDamage, with his rows seeing it as Bloomstep's ('casting'); jump: first he is set down behind it, as Bloomstep sets him */
    strike(A,T,u,t,k,jump,name){ const E=A.eng(); if(!t||!t.alive||!u.alive||!E.strike) return; if(jump&&E.bloomJump) E.bloomJump(u,t);
      const lv=(u.skillLv&&u.skillLv[2])||1, a=((u.blueAb&&u.blueAb.mul)||2.1)*(E.skillMul?E.skillMul(lv):1)*(u.dmg||0)*k; const s=T.s, d0=s.d, c0=s.cur;
      s.d=0; s.cur=name||'counter'; try{ E.strike(u,t,a,'#bfe8ff'); } finally{ s.cur=c0; s.d=d0; } },
    /* ---- OVERREACH: an enemy basic attack reaches him from within 2 m (body to body), hit or miss: it Overreaches for 2 s (Too Close: longer); Reaching Hand
       slows it as long; Reached Too Far marks it for 2 s ---- */
    overreach(A,T,u,c){ const s=T.s, x=c.src, now=A.eng().now(), d=2+(T.P['over.dur']||0); if(!x) return; A.setMark(T,u,x,'over',{dur:d}); s.ovS=x; s.ovT=now;
      if(T.r.sh_n1) A.setMark(T,u,x,'rtf',{dur:2}); if(T.P['over.slow']) A.acts(T,u,[{slow:T.P['over.slow'],dur:d,on:'source'}],c); },
    overNow(A,T,u,c){ const s=T.s; return !c.dodged&&s.ovS===c.src&&s.ovT===A.eng().now()&&!!c.src&&c.src.alive&&T.fn.free(A,T,u); },
    /* Quicker Than Hands: once every 10 s an Overreaching attack sets off Bloomstep's jump and strike at once (the attack does not land) */
    qth(A,T,u,c){ T.fn.strike(A,T,u,c.src,1,true,'counter'); },
    /* Before the Man Had Finished Reaching (SIGNATURE): once every 20 s, when an enemy Overreaches, he is already behind it: the jump and the strike at double
       strength (the attack does not land), it is Catalogued, and he gains 25 energy */
    bmf(A,T,u,c){ const x=c.src; T.fn.strike(A,T,u,x,2,true,'counter'); if(x&&x.alive&&!mk(u,x,'cat',A.eng().now())) A.acts(T,u,[{mark:'cat',on:'target',added:'catNew'}],Object.assign({},c,{tgt:x})); u.energy=Math.min(100,(u.energy||0)+25); },
    /* While It Is Admired (SIGNATURE): once every 20 s, the hit that would end Perfect Camouflage does not land; he jumps behind the strongest Onlooker (none:
       behind the one who struck), Bloomstep's strike lands on it and on every Onlooker within 3 m of where he lands, and the camouflage stays up */
    admired(A,T,u,c){ const E=A.eng(), s=T.s; u._untouched=Math.max(3,s.ut||0); s.held=true;
      const L=A.pick(T,u,{team:'enemy',order:'strong'},c).filter(e=>isOnl(T,e)), x=L[0]||c.src; if(!x||!x.alive) return;
      T.fn.strike(A,T,u,x,1,true,'counter'); for(const y of A.pick(T,u,{team:'enemy'},c)) if(y!==x&&y.alive&&isOnl(T,y)&&gapM(E,u,y)<3) T.fn.strike(A,T,u,y,1,false,'counter'); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/32 - KHAROS BLOOMKNIFE - talent decisions.md) */
  ruling:{}
};
