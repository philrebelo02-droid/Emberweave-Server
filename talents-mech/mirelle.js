/* MIRELLE VELVETPLUM - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Mirelle Velvetplum")
   Her real kit (the code, not the card wording; a ranged Support, damage profile Healer: every hit of hers is MAGIC; body 1.56 m, range 13.6 m, swing 1.8 s):
   - Scent of Courage ('healbuff', green, cd 7, cast 0.5 s): the ally with the lowest HP share (herself included; at a tie, herself: in 20 seeded fights 67 of
     140 casts went on herself, nearly all at full health) is healed for 95% of her ability power x skill level (healFrom) and its damage-buff slot is written
     max(slot, 1.28) for 6 s (dmgBuffMul / dmgBuffT: +28% damage, NOT scaled by skill level). _buffedT = 0.5 tells Trail of Splendor.
   - Soporific Bouquet ('sleepbouquet', blue, cd 10, a delivered shot): the enemy with the most energy at the launch. _sleepT = 5 s (the control table's sleep,
     not cut) and 'stunned' through ccApply: 5 s x 0.7 = 3.5 s, cut at the stun ceiling 2.8 s; a 2.1 s slow. ANY hit wakes a sleeper (the page clears _sleepT
     and stunned at the top of _dealDamageCore, before every talent hook): in 20 seeded fights 77 of 89 sleeps were ended by a hit, median 0.66 s asleep.
     A unit is "asleep" while _sleepT > 0 (it cannot cast; it cannot act while 'stunned' runs).
   - Imperial Plumage ('plumage', ultimate on energy - no cooldown; ULT_DEF.plumage + HERO_ULT_ART.mirelle deliver 'form', 0.35 s after the cast; NO radius):
     every ally is cleansed (DoTs, stun, fear, silence, slow, Mortal Wound), healed 80% of her ability power x skill level, and shielded max(shield, 21.9% of
     its max HP) for 6 s (0.10 x skill level); EVERY enemy loses 42.1% armor and magic resist (shred 0.30 by shredAt) and 20% of its attack (not scaled) for
     6 s. Nothing in the game charms: "charming enemies into lowering their defenses" is this lowered guard. Her talents' "charmed" = an enemy whose guard
     this cast lowered, for as long as it lasts.
   - Trail of Splendor (passive 'splendor'): any ally whose _buffedT is set (by ANY hero's buff skill, not only hers) gains a STACKING shield of 4% x passive
     strength of its max HP (8.75% at level 100) for 5 s. One shield number per unit: a Splendor shield "breaks" when the ally's shield is emptied by damage
     while its time still runs (the page sets shield 0 when shieldT runs out).
   Mettle, Sillage, the Patron, Languor, Dream Debt, Lull, Eyes, Preen and Admirers exist only through her talents.
   Readings, caps and corrected tooltips: WIRING/41 - MIRELLE VELVETPLUM - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const SC='healbuff', BQ='sleepbouquet', PL='plumage';
const DR_CAP=0.40, TEAM_CAP=0.15, REGEN=0.012, STUN_TOP=4.0, NAP_MAX=2, NAP_WIN=10, LOCK=0.5, GATE=8, HUND=4;
/* the families several talents read: their bookkeeping runs when any of these is learned */
const METT=['rw_1_1','rw_2_1','rw_n1','rw_3_1','rw_3_3','rw_4_1','rw_7_2','rw_8_1','rw_9_1','rw_10_1','rw_11_1','rw_11_2','rw_12_1','rw_13_2'];
const PAT=['rw_4_4','rw_5_4','rw_7_4','rw_8_4','rw_10_4','rw_12_4','rw_13_2'];
const LANG=['lp_1_2','lp_1_4','lp_1_1','lp_2_2','lp_3_2','lp_8_4','lp_5_1','lp_5_3','lp_6_1','lp_6_3','lp_7_3','lp_9_3','lp_10_4','lp_11_3','lp_12_2','lp_12_3'];
const SLEEPHIT=['lp_2_3','lp_6_2','rw_n1'];                                                 // rows about a hit on a sleeper (the page's stamp, _talSlH)
const SLEEPS=['lp_1_2','lp_3_2','lp_8_4','lp_7_3','lp_11_3','lp_13_3','lp_4_1','lp_6_4','lp_12_2','lp_5_1','lp_5_3','lp_6_1','lp_6_3','he_9_3','he_4_1'];   // her sleeps and their bookkeeping
const LULL=['lp_4_4','lp_5_4','lp_8_2','lp_8_4','lp_11_4','lp_11_3'];
const DEBT=['lp_2_3'];
const EYE=['he_1_1','he_1_4','he_2_4','he_4_4','he_3_4','he_7_3','he_8_4','he_9_4','he_10_4','he_11_3','he_12_2','he_13_3'];
const PRE=['he_4_1','he_5_1','he_7_1','he_6_1','he_8_1','he_10_1','he_12_1','he_13_3'];
const ADM=['he_2_3','he_4_3','he_6_4','he_6_3','he_11_4','he_12_4','he_7_3','he_13_3','he_11_3'];
const CHARM=ADM.concat(['rw_n1','lp_11_3','lp_13_3','he_5_2','he_5_3','he_12_3']);
const ALLYDR=['rw_2_1','rw_12_1','he_10_4','lp_10_4','he_2_3','he_12_4','lp_8_2'];
const TEAMIN=['rw_1_1','rw_7_4','rw_9_1','rw_n1','lp_6_2','lp_2_3'].concat(ALLYDR);
const MYDR=['rw_3_3','rw_2_1','rw_12_1','rw_11_1','lp_1_1','lp_11_4','he_1_4','he_6_4','he_2_3','he_12_4','lp_8_2','lp_10_4','he_11_1','he_12_1','rw_6_4','lp_6_4'];
const SPL=['rw_6_1','he_5_4','lp_12_4','rw_6_4','rw_12_3','rw_4_4','rw_7_2'];
const REGENS=['rw_6_3','he_6_2','lp_11_1'];
/* ---- small readers ---- */
const mi=T=>T.s.mi||(T.s.mi=fresh());
function fresh(){ return {bf:{},lw:{},sw:{},spl:{},sh0:{},mt:{},mtOnce:{},gate:{},slp:{},lock:{},myS:{},nap:{},ch:{},vr:{},lul:{},yw:{},eyeBy:{},first:false,nh:0,pre:false,preWin:0,rwc:0,wfs:null,patDone:false,hf:{},rgA:{},rgU:{},rgClk:0,anyS:false,plPre:null,scT:null,prS:false}; }
const dec=(o,dt)=>{ for(const k in o){ o[k]-=dt; if(o[k]<=1e-9) delete o[k]; } };
const met=(A,T,u,x)=>x?A.ustGet(T,u,x,'mettle'):0;
const eyes=T=>{ const k=T.s.k.eye; return k?k.n:0; };
const isPat=(A,T,u,x)=>!!x&&x!==u&&x.team===u.team&&((T.s.m.patron===x&&!!A.markOf(u,x,'patron'))||(mi(T).rwc>0&&!x._summon));
const isAdm=(A,u,x)=>!!x&&!!A.markOf(u,x,'adm');
const charmed=(T,x)=>!!x&&(mi(T).ch[x.uid]||0)>0;
const lulled=(T,x)=>!!x&&!!mi(T).lul[x.uid];
const lang=(A,T,u,x)=>x?A.ustGet(T,u,x,'lang'):0;
const preOn=m=>m.pre||m.preWin>0;
const side=(u,x)=>x.alive&&x.team===u.team&&!x._dropHidden&&!(x._riseT>0);
const gapM=(E,a,b)=>(E.dist(a,b)-E.bodyR(a)-E.bodyR(b))/E.METER();
module.exports={
  hero:'mirelle',
  casting:true,                         // rows ask which of her skills is resolving (Scent of Courage, Soporific Bouquet, Imperial Plumage)
  states:{
    mettle:{unit:true,max:5},                                                     // Mettle on an ally (kept for the wave: cleared at a wave's start)
    lang:{unit:true,max:P('nap.n',5),dur:P('lang.dur',5),longest:true},           // Languor on an enemy (its max is the nap threshold: 5, Heavy Eyelids 6, Restless Sleep 4)
    eye:{max:P('eye.max',10)}                                                     // Eyes on her tail (kept for the wave; Unblinking keeps some)
  },
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share, and her capped groups */
  always:[
    {on:'wave',do:[{fn:'waveStart'}]},
    {on:'tick',do:[{fn:'scan'}]},                                                                                            // one look a tick: Sillage, Splendor breaks, healing a second, sleepers, Lull, naps, charms
    {on:'kit',skill:SC,do:[{fn:'scKit'}]}, {on:'cast',skill:SC,do:[{fn:'scCast'}]},                                          // Scent of Courage: its ally, its strength, Mettle, the Patron, mists, Sillage
    {on:'kit',skill:BQ,do:[{fn:'bqKit'}]}, {on:'cast',skill:BQ,do:[{fn:'bqCast'}]},                                          // Soporific Bouquet: Preen, Second Bouquet
    {on:'ccHit',reqAny:SLEEPS,if:{cc:['stunned']},do:[{fn:'stunHit'}]},                                                       // every stun / sleep of hers that lands (the stun-lock rule; her sleeps made longer)
    {on:'kit',skill:PL,do:[{fn:'plKit'}]}, {on:'cast',skill:PL,do:[{fn:'plCast'}]},                                          // Imperial Plumage: the charm, Admirers, Full Display, the signatures
    {on:'num',skill:'splendor',reqAny:SPL,do:[{fn:'splNum'}]},                                                                // Trail of Splendor's shield on an ally (the page's num site)
    {on:'teamIn',reqAny:TEAMIN,do:[{fn:'teamIn'}]},                                                                           // her team's hits on enemies (Mettle, Patron, sleepers, Dream Debt); hits on her allies (their capped group)
    {on:'teamDotIn',reqAny:DEBT.concat(['lp_6_2'],ALLYDR),do:[{fn:'teamDot'}]},                                               // the same for DoT ticks
    {on:'in',reqAny:MYDR,do:[{fn:'myDr'}]}, {on:'dotIn',reqAny:MYDR,do:[{fn:'myDrDot'}]},                                     // her damage-reduction talents: ONE capped group (myDr)
    {on:'aimed',reqAny:EYE.concat(['he_7_3']),do:[{fn:'eyeOpen'}]},                                                           // Eyes: each enemy attack coming at her
    {on:'hurt',reqAny:PRE,do:[{fn:'hurtMe'}]},                                                                                // Preen: a hit that lands on her
    {on:'healOut',skill:SC,reqAny:PRE,if:{fn:'prS'},do:[{fn:'preHeal'}]}                                                      // a Preened Scent of Courage heals more
  ],
  talents:{
    /* ============================== ROSEWATER ============================== */
    rw_1_1:[ {param:'met.dmg',add:R(0.005)} ],                                                                      // Behind the Ears (Mettle: scCast; teamIn)
    rw_1_3:[ {on:'healOut',skill:SC,more:R(0.02)} ],                                                                // Fine Atomizer
    rw_1_4:[ {on:'ccIn',less:R(0.05)} ],                                                                            // Poise of Court (15% at 3/3: its own full rank is the cap)
    rw_2_1:[ {param:'dr.steady',add:R(0.01)} ],                                                                     // Steady Mettle (in myDr / allyDr)
    rw_2_2:[ {param:'sil.dur',add:R(1)} ],                                                                          // Lingering Scent (Sillage: the scan)
    rw_n1:[ {param:'cid',add:0.04}, {param:'cid.debt',add:0.25,req:'lp_2_3'} ],                                     // Courage in a Dream (LINK; teamIn)
    rw_3_1:[ {on:'teamCc',if:{fn:'gateAlly'},do:[{fn:'gateFree'}]}, {on:'ccIn',if:{fn:'gateSelf'},mul:0,do:[{fn:'gateUse'}]} ],   // Held the Gate (once every 8 s per ally)
    rw_4_2:[ {param:'sil.k',add:R(0.05)} ],                                                                         // Heavy Base Note
    rw_3_3:[ {param:'dr.vf',add:R(0.01)} ],                                                                         // Velvet Feathers (in myDr)
    rw_2_3:[ {param:'atk.k',add:R(0.02)} ],                                                                         // Sweet Courage (scKit)
    rw_4_1:[ {stat:{aspd:R(0.003)},to:{team:'ally',ust:{mettle:1}},per:{ust:'mettle',of:'target'}} ],              // Rising Mettle
    rw_5_2:[ {param:'spray',add:0.6} ],                                                                             // Second Spray (PICK ONE; scCast)
    rw_5_3:[ {param:'fb',add:3} ],                                                                                  // Full Bottle (PICK ONE; scKit)
    rw_4_4:[ {param:'pat.k',add:R(0.03)} ],                                                                         // The Patron (scKit, splNum)
    rw_6_2:[ {param:'spray.k',add:R(0.05)} ],                                                                       // Shared Courage (needs Second Spray)
    rw_6_3:[ {param:'lw',add:R(0.004)} ],                                                                           // Long Wear (needs Full Bottle; healing a second, in the 1.2% budget)
    rw_5_4:[ {stat:{hp:R(0.01)},to:{team:'ally',fn:'patSel'}} ],                                                    // Loyal Custom
    rw_6_1:[ {param:'spl.k',add:R(0.03)} ],                                                                         // Lined Coat (splNum)
    rw_5_1:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                                 // Quick Mist
    rw_6_4:[ {param:'buf.k',add:R(0.03)}, {param:'vuln',add:R(0.03)} ],                                             // Cheap Bottles (RISK)
    rw_7_2:[ {param:'sewn',add:0.03} ],                                                                             // Sewn Lining (the scan sees the break)
    rw_7_4:[ {param:'pat.dmg',add:R(0.01)} ],                                                                       // House Favourite (teamIn)
    rw_8_1:[ {stat:{ctrl:R(0.03)},to:{team:'ally',ust:{mettle:5}}} ],                                               // Brave Front (9% at 3/3: its own full rank is the cap)
    rw_8_3:[ {stat:{move:R(0.02)}} ],                                                                               // Light Step
    rw_8_4:[ {param:'rep',add:R(1)} ],                                                                              // Repeat Custom (patAssign)
    rw_9_1:[ {param:'mtma',add:1} ],                                                                                // More Than a Minute Ago (metAdd; teamIn)
    rw_9_2:[ {param:'sewn',add:R(0.004)} ],                                                                         // Thick Lining (needs Sewn Lining)
    rw_9_3:[ {param:'sil.dur',add:R(0.3)} ],                                                                        // Perfumed Air
    rw_10_1:[ {param:'rep0',add:R(1)} ],                                                                            // Reputation (waveStart)
    rw_10_3:[ {on:'healOut',skill:SC,if:{targetHpBelow:0.40},more:R(0.03)} ],                                       // Shopkeeper's Eye
    rw_10_4:[ {param:'pat.nrg',add:R(1)} ],                                                                         // Patron's Gift
    rw_11_1:[ {param:'dr.ps',add:R(0.015)} ],                                                                       // Practised Smile (in myDr)
    rw_11_2:[ {param:'poc',add:2} ],                                                                                // Plumage of Courage (plCast)
    rw_12_1:[ {param:'dr.hush',add:R(0.005)} ],                                                                     // Hushed Confession (in myDr / allyDr)
    rw_12_2:[ {on:'kit',skill:PL,opt:{shield:{more:R(0.03)}}} ],                                                    // Full Tail of Courage
    rw_12_3:[ {param:'buf.k',add:R(0.02)} ],                                                                        // Master Perfumer
    rw_12_4:[ {param:'pat.dur',add:R(0.5)} ],                                                                       // Captain's Thanks (scKit)
    rw_13_2:[ {param:'rwc',add:8} ],                                                                                // Rosewater for a Coward (SIGNATURE; plCast, scCast)
    /* ============================== LILY AND POPPY ============================== */
    lp_1_1:[ {param:'dr.calm',add:R(0.02)} ],                                                                       // Calm Hands (in myDr)
    lp_1_2:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{fn:'langHit'}]},   // Sweet Note (Languor; the nap: the scan)
             {stat:{aspd:R(-0.005)},to:{team:'enemy',ust:{lang:1}},per:{ust:'lang',of:'target'}} ],
    lp_1_4:[ {on:'out',if:{auto:true,targetUst:{lang:1}},more:R(0.03)} ],                                          // Heady Perfume
    lp_2_2:[ {param:'lang.dur',add:R(1)} ],                                                                         // Slow Poppy
    lp_2_3:[ {param:'debt',add:R(0.06)} ],                                                                          // Bad Dreams (Dream Debt: teamIn, teamDot, the scan's wake)
    lp_3_1:[ {on:'out',if:{kind:'magic'},more:R(0.02)} ],                                                           // Lily Scent (every hit of hers is magic)
    lp_3_2:[ {param:'ds',add:5} ],                                                                                  // Deep Slumber (stunHit, the wake)
    lp_4_3:[ {param:'debt.cap',add:R(0.10)} ],                                                                      // Long Night's Dream
    lp_2_4:[ {param:'range',add:R(0.03)} ],                                                                         // Gentle Throw (waveStart)
    lp_4_1:[ {param:'bq.add',add:R(0.1)} ],                                                                         // Strong Bouquet (stunHit)
    lp_8_4:[ {param:'yawn',add:R(1)} ],                                                                             // Yawn (the scan)
    lp_4_4:[ {param:'lull',add:R(0.01)}, {stat:{aspd:R(-0.01)},to:{team:'enemy',fn:'lulSel'}} ],                   // Heavy Air (Lull: the scan)
    lp_5_1:[ {param:'nap.n',add:1}, {param:'nap.add',add:0.4} ],                                                    // Heavy Eyelids (PICK ONE)
    lp_5_2:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                                 // Night Blossom
    lp_5_3:[ {param:'nap.n',add:-1}, {param:'nap.add',add:-0.2} ],                                                  // Restless Sleep (PICK ONE)
    lp_5_4:[ {param:'lull.m',add:R(0.4)} ],                                                                         // Thick Air
    lp_6_1:[ {param:'snore',add:R(0.05)} ],                                                                         // Snore (needs Heavy Eyelids; the wake)
    lp_6_2:[ {param:'slp.dmg',add:R(0.01)} ],                                                                       // Sleepwalker's Bruise (teamIn, teamDot)
    lp_6_3:[ {param:'fit',add:R(2)} ],                                                                              // Fitful (needs Restless Sleep; tryNap)
    lp_6_4:[ {param:'slp.k',add:R(0.04)}, {param:'vuln2',add:R(0.02)} ],                                            // Breathing It In (RISK)
    lp_7_3:[ {param:'sb',add:3} ],                                                                                  // Second Bouquet (bqCast)
    lp_7_4:[ {stat:{armor:R(0.02),mr:R(0.02)},if:{fn:'anySleep'}} ],                                                // Dressed for Court
    lp_8_1:[ {param:'debt.hi',add:R(0.02)} ],                                                                       // Dreamer's Debt
    lp_8_2:[ {param:'lull.dmg',add:R(0.006)} ],                                                                     // Lullaby (in myDr / allyDr)
    lp_10_3:[ {param:'debt.nrg',add:R(2)} ],                                                                        // Dream Thief
    lp_9_1:[ {param:'scream',add:0.5} ],                                                                            // Waking Scream (needs Dreamer's Debt)
    lp_9_3:[ {param:'sb.dur',add:R(0.4)} ],                                                                         // Heavier Bouquet (needs Second Bouquet)
    lp_9_4:[ {on:'healOut',skill:SC,more:R(0.02)} ],                                                                // Sweet Courage Too
    lp_10_2:[ {on:'teamHeal',if:{fn:'unitAsleep'},less:R(0.02)} ],                                                  // Sound Sleep
    lp_10_4:[ {param:'dr.dc',add:R(0.02)} ],                                                                        // Drowsy Court (in myDr / allyDr)
    lp_11_1:[ {param:'re',add:R(0.0024)} ],                                                                         // Rest Easy (healing a second, in the 1.2% budget)
    lp_11_3:[ {param:'pop',add:4} ],                                                                                // Plumage of Poppies (plCast; Lull from charmed enemies: the scan)
    lp_11_4:[ {param:'dr.unb',add:R(0.015)} ],                                                                      // Unbothered (in myDr)
    lp_12_2:[ {param:'nap.add',add:R(0.06)} ],                                                                      // Heavy Head
    lp_12_3:[ {param:'pop.dur',add:R(0.6)} ],                                                                       // Poppy Haze (needs Plumage of Poppies)
    lp_12_4:[ {param:'spl.k',add:R(0.04)} ],                                                                        // Sleep It Off (splNum)
    lp_13_3:[ {param:'wfs',add:1.5} ],                                                                              // The Whole Field Sleeps (SIGNATURE; plCast)
    /* ============================== THE HUNDRED EYES ============================== */
    he_1_1:[ {param:'eye.first',add:R(1)} ],                                                                        // Court Manners (eyeOpen)
    he_2_2:[ {on:'kit',skill:PL,opt:{dur:{add:R(0.3)}}} ],                                                          // Bright Plumes
    he_1_4:[ {param:'dr.eye',add:R(0.003)} ],                                                                       // First Eye (Eyes: eyeOpen; in myDr)
    he_2_3:[ {param:'adm',add:R(0.01)} ],                                                                           // Smitten (Admirers: plCast; in myDr / allyDr)
    he_2_4:[ {param:'eye.max',add:R(2)} ],                                                                          // Wide Gaze
    he_4_1:[ {param:'preen',add:R(0.05)} ],                                                                         // A Moment to Primp (Preen: the scan, hurtMe, scKit / bqKit)
    he_4_4:[ {stat:{apow:R(0.002)},per:'eye'} ],                                                                    // Watchful Tail
    he_4_3:[ {stat:{armor:R(-0.02)},to:{team:'enemy',has:'adm'}} ],                                                 // Lovestruck
    he_3_4:[ {param:'fd',add:0.02} ],                                                                               // Full Display (plKit)
    he_5_1:[ {param:'preen.soon',add:R(0.3)} ],                                                                     // Primped
    he_5_4:[ {param:'spl.k',add:R(0.03)} ],                                                                         // Fan of Eyes (splNum)
    he_7_1:[ {param:'fp',add:R(0.005)} ],                                                                           // Fresh Powder
    he_6_1:[ {stat:{move:R(-0.05)}}, {param:'preen.k',add:R(0.04)} ],                                               // Heavy Jewels (RISK)
    he_6_4:[ {param:'dr.admd',add:R(0.01)} ],                                                                       // Admired (in myDr)
    he_7_4:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                                 // Velvet Voice
    he_8_1:[ {param:'preen.nrg',add:R(3)} ],                                                                        // Little Mirror
    he_8_2:[ {on:'healOut',skill:SC,more:R(0.02)} ],                                                                // Practised Pose
    he_7_3:[ {on:'skillTgt',skill:BQ,do:[{fn:'turned'}]} ],                                                         // Turned Heads (and the Admirer: bqCast)
    he_9_2:[ {param:'atk.k',add:R(0.01)} ],                                                                         // Courtly Bloom
    he_5_2:[ {param:'grace',add:1}, {on:'kit',skill:PL,opt:{shield:{more:0.20}}} ],                                 // Grace (PICK ONE)
    he_5_3:[ {param:'vanity',add:1}, {on:'kit',skill:PL,opt:{shield:{more:-0.20}}} ],                               // Vanity (PICK ONE)
    he_9_3:[ {param:'th.add',add:R(0.08)} ],                                                                        // Captivated (needs Turned Heads)
    he_8_4:[ {param:'eye.keep',add:R(1)} ],                                                                         // Unblinking (waveStart)
    he_6_2:[ {param:'swan',add:R(0.004)} ],                                                                         // Swan's Bearing (needs Grace; healing a second, in the 1.2% budget)
    he_6_3:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'adm'}} ],                                                  // Mirror Gaze (needs Vanity)
    he_9_4:[ {on:'aimed',if:{stackFull:'eye'},do:[{fn:'hundred'}]} ],                                               // Hundredfold (once every 4 s per enemy)
    he_10_1:[ {param:'fair',add:R(0.2)} ],                                                                          // Fair Copy (scCast)
    he_10_2:[ {param:'buf.dur',add:R(0.1)} ],                                                                       // Sought After (scKit)
    he_10_4:[ {param:'dr.ee',add:R(0.001)} ],                                                                       // Eyes Everywhere (allyDr)
    he_11_1:[ {param:'dr.unr',add:R(0.015)} ],                                                                      // Unruffled (in myDr)
    he_11_3:[ {stat:{nrg:0.15},if:{stackFull:'eye'}}, {param:'sd',add:2} ],                                         // Season's Display (plCast)
    he_11_4:[ {stat:{hp:R(0.01)},per:{fn:'admSteps'}} ],                                                            // Center of the Room
    he_12_1:[ {param:'dr.eff',add:R(0.03)} ],                                                                       // Effortless (in myDr)
    he_12_2:[ {on:'tick',edge:true,once:'wave',if:{selfHpBelow:0.5},do:[{shield:{pct:R(0.004),of:'maxHp',x:'eye'},dur:4}]} ],   // Court Favourite
    he_12_3:[ {param:'show',add:R(0.1)} ],                                                                          // Showstopper (plCast)
    he_12_4:[ {param:'adm.pts',add:R(0.005)} ],                                                                     // Vain Strength (percentage points on Smitten's cut)
    he_13_3:[ {param:'eis',add:1} ]                                                                                 // Every Eye in Sayle (SIGNATURE; plKit / plCast; her _talHide: waveStart)
  },
  fn:{
    /* ---- a wave starts: everything "for the wave" is cleared; Reputation's Mettle, Unblinking's Eyes, Gentle Throw's reach ---- */
    waveStart(A,T,u){ const s=T.s, P=T.P, E=A.eng(); s.api=A; s.mi=fresh(); const m=s.mi;
      const h=s.m.patron; if(h){ A.clearMark(u,h,'patron'); s.m.patron=null; }
      if(METT.some(id=>T.r[id])) for(const x of E.units()) if(x.team===u.team){ A.ustPut(T,u,x,'mettle',0); if(P.rep0&&side(u,x)) A.ustPut(T,u,x,'mettle',Math.min(5,P.rep0),Infinity); }
      if(T.st.eye){ const keep=Math.min(eyes(T),P['eye.keep']||0); A.stSet(T,u,'eye',keep); }
      if(P.range){ if(s.rg0==null) s.rg0=u.range; u.range=s.rg0*(1+P.range); }
      if(T.r.he_13_3) u._talHide='eis';                                       // the page's nearestEnemy asks hideFrom only for a unit that carries _talHide
      m.f={lang:LANG.some(id=>T.r[id]), slp:SLEEPS.some(id=>T.r[id])||DEBT.some(id=>T.r[id])||!!T.r.lp_6_2||!!T.r.lp_7_4||!!T.r.lp_11_1||!!T.r.lp_10_2||!!T.r.rw_n1,
        stamp:SLEEPHIT.some(id=>T.r[id]), lull:LULL.some(id=>T.r[id]), pre:PRE.some(id=>T.r[id]), rg:REGENS.some(id=>T.r[id]), sewn:!!P.sewn, sil:!!P['sil.dur']}; },
    /* ---- THE SCAN, once a tick (after every unit has thought). Her allies: Sillage when her Scent's bonus ends, a Splendor shield breaking (Sewn Lining),
       the 1.2% healing-a-second budget. Enemies: who sleeps and who wakes (Dream Debt, Deep Slumber, Snore, the stun lock), a Languor nap due, Lull and Yawn,
       a charm ending (Vanity's double cut given back). Preen's clock. Nothing here draws from the seeded stream. ---- */
    scan(A,T,u,c){ const m=mi(T), P=T.P, E=A.eng(), dt=c.dt||0, U=E.units(); if(!m.f) T.fn.waveStart(A,T,u);
      dec(m.lw,dt); dec(m.sw,dt); dec(m.gate,dt); dec(m.lock,dt); dec(m.ch,dt); dec(m.mt,dt); dec(m.hf,dt);
      if(m.rwc>0) m.rwc-=dt; if(m.preWin>0) m.preWin-=dt;
      for(const k in m.nap){ const L=m.nap[k]; for(let i=0;i<L.length;i++) L[i]-=dt; while(L.length&&L[0]<=1e-9) L.shift(); if(!L.length) delete m.nap[k]; }
      for(const k in m.vr){ const v=m.vr[k]; v.l-=dt; if(v.l<=1e-9){ if(v.x.alive&&v.x._atkDnPct===v.v) v.x._atkDnPct=v.p0; delete m.vr[k]; } }
      if(m.f.pre){ m.nh+=dt; if(!m.pre&&m.nh>=4-(P['preen.soon']||0)-1e-9){ m.pre=true; if(P['preen.nrg']) u.energy=Math.min(100,(u.energy||0)+P['preen.nrg']); } }
      let anyS=false; const foes=[];
      for(let i=0;i<U.length;i++){ const x=U[i];
        if(x.team===u.team){ if(!x.alive) continue;
          const b=m.bf[x.uid]; if(b){ b.l-=dt; if(b.l<=1e-9&&!((x.dmgBuffT||0)>0&&Math.abs((x.dmgBuffMul||1)-1-b.b)<1e-9&&b.l>-0.25)){ delete m.bf[x.uid]; if(m.f.sil) A.buffOn(x,'dmg',b.b*0.5*(1+(P['sil.k']||0)),P['sil.dur']); } }   // Sillage: once the engine's slot no longer holds her bonus
          if(m.f.sewn){ const sh=x.shield||0; if(m.spl[x.uid]!=null){ m.spl[x.uid]-=dt; if((m.sh0[x.uid]||0)>0&&!(sh>0)&&(x.shieldT||0)>0){ delete m.spl[x.uid]; T.fn.sewnBreak(A,T,u,x); } else if(m.spl[x.uid]<=1e-9) delete m.spl[x.uid]; } m.sh0[x.uid]=sh; }
          continue; }
        if(!x.alive){ if(m.slp[x.uid]) T.fn.slpGone(A,T,u,x); continue; } if(x._dropHidden) continue;
        foes.push(x); if(m.f.stamp) x._talSlW=1;
        if(m.myS[x.uid]&&!((x.stunned||0)>0)){ delete m.myS[x.uid]; m.lock[x.uid]=LOCK; }                      // a stun or sleep of hers just ended: the 0.5 s lock (before anything can sleep it again)
        const asleep=(x._sleepT||0)>0; let r=m.slp[x.uid];
        if(asleep){ anyS=true; if(!r) r=m.slp[x.uid]={debt:0,kind:null,mine:false}; }
        else if(r){ delete m.slp[x.uid]; T.fn.wake(A,T,u,x,r); }
        if(m.f.lang&&lang(A,T,u,x)>=T.st.lang.max-1e-9) T.fn.tryNap(A,T,u,x); }
      m.anyS=anyS||foes.some(x=>(x._sleepT||0)>0);
      if(m.f.lull) T.fn.lullScan(A,T,u,foes,dt);
      if(m.f.rg) T.fn.regen(A,T,u,dt); },
    /* ---- METTLE and THE PATRON ---- */
    metAdd(A,T,u,x,n){ if(!x||!x.alive||x._summon||!METT.some(id=>T.r[id])) return; const m=mi(T), v=met(A,T,u,x), nv=Math.min(5,v+n); if(!(nv>v)) return;
      A.ustPut(T,u,x,'mettle',nv,Infinity);
      if(nv>=5&&v<5&&T.P.mtma&&!m.mtOnce[x.uid]&&m.bf[x.uid]&&(x.dmgBuffT||0)>0){ m.mtOnce[x.uid]=1; m.mt[x.uid]=4; } },          // More Than a Minute Ago: once per wave per ally, while her Scent's bonus is on it
    /* the Patron: the first ally other than herself that one of her buffs lands on each wave (her Scent of Courage, a mist of it). Repeat Custom: once the
       Patron has died, the next ally she buffs becomes the Patron with 1 Mettle a rank */
    patAssign(A,T,u,x){ if(!PAT.some(id=>T.r[id])||!x||x===u||!x.alive||x._summon) return; const m=mi(T), h=T.s.m.patron;
      if(h&&h.alive&&A.markOf(u,h,'patron')) return;
      if(m.patDone&&!T.P.rep) return;
      const re=m.patDone; m.patDone=true; A.setMark(T,u,x,'patron',{unique:true}); if(re&&T.P.rep) T.fn.metAdd(A,T,u,x,T.P.rep); },
    patSel(A,T,u,c){ return isPat(A,T,u,c.tgt); },
    gift(A,T,u,x){ if(T.P['pat.nrg']&&isPat(A,T,u,x)) x.energy=Math.min(100,(x.energy||0)+T.P['pat.nrg']); },
    /* how much stronger her buff on x is: Cheap Bottles and Master Perfumer, the Patron, a Preened spell (A Moment to Primp x Heavy Jewels) */
    bufK(A,T,u,x,pre){ const P=T.P; let k=1+(P['buf.k']||0); if(P['pat.k']&&isPat(A,T,u,x)) k*=1+P['pat.k']; if(pre&&P.preen) k*=(1+P.preen)*(1+(P['preen.k']||0)); return k; },
    /* ---- SCENT OF COURAGE. scKit: the ally the skill will pick (the same choice: the lowest HP share, the first at a tie), a Preen spent, the Attack bonus
       made larger (Sweet Courage, Courtly Bloom: x (1 + share); her buffs' strength) and longer (Sought After, Full Bottle, Captain's Thanks on the Patron) ---- */
    scKit(A,T,u,c){ const m=mi(T), P=T.P, E=A.eng(); let b=null,bv=2; for(const x of E.units()){ if(!side(u,x)) continue; const f=x.hp/x.maxHp; if(f<bv){ bv=f; b=x; } }
      m.scT=b; m.prS=false; if(!b) return; T.fn.patAssign(A,T,u,b);
      if(m.f&&m.f.pre&&preOn(m)){ m.prS=true; if(!(m.preWin>0)) m.pre=false; m.nh=0; }
      const o=c.o; m.atk0=o.atk||1.25; m.dur0=o.dur||6;
      o.atk=1+(m.atk0-1)*(1+(P['atk.k']||0))*T.fn.bufK(A,T,u,b,m.prS);
      o.dur=m.dur0+(P['buf.dur']||0)+(P.fb||0)+(isPat(A,T,u,b)?(P['pat.dur']||0):0); m.scO={atk:o.atk,dur:o.dur}; },
    scCast(A,T,u,c){ const m=mi(T), P=T.P, E=A.eng(), b=m.scT; m.scT=null; if(!b||!b.alive) return; const o=m.scO||{atk:1.28,dur:6};
      if((b.dmgBuffT||0)>0&&Math.abs((b.dmgBuffMul||1)-o.atk)<1e-9) m.bf[b.uid]={l:o.dur,b:o.atk-1};             // the slot holds HER bonus (a stronger one already there keeps it)
      if(P.fb) m.lw[b.uid]=o.dur;
      T.fn.metAdd(A,T,u,b,1); T.fn.gift(A,T,u,b);
      const L=[]; if(m.rwc>0){ for(const x of E.units()) if(side(u,x)&&x!==b&&!x._summon) L.push([x,1]); }        // Rosewater for a Coward: the whole team, at full strength
      else { const sh=Math.max(P.spray?P.spray*(1+(P['spray.k']||0)):0,(m.prS&&P.fair)?P.fair:0);
        if(sh>0){ let s2=null,sv=2; for(const x of E.units()){ if(!side(u,x)||x===b) continue; const f=x.hp/x.maxHp; if(f<sv){ sv=f; s2=x; } } if(s2) L.push([s2,sh]); } }
      for(const [x,sh] of L) T.fn.mist(A,T,u,x,sh);
      if(m.prS&&P.fp) E.healUnit(u,u.maxHp*P.fp);
      m.prS=false; },
    /* a mist of Scent of Courage on another ally at that share of its strength: the heal (through her own heal, so her heal talents apply), the Attack bonus
       (the engine's damage-buff slot: a weaker one never replaces a stronger), Trail of Splendor (the ally received a buff), Mettle, the Patron */
    mist(A,T,u,x,sh){ const m=mi(T), P=T.P, E=A.eng(); if(!x.alive) return; const sm=u._castSM||1, s=T.s, c0=s.cur; s.cur=SC;
      try{ E.healFrom(u,x,(u.apow||0)*0.95*sm*sh); } finally{ s.cur=c0; }
      T.fn.patAssign(A,T,u,x);
      const bon=((m.atk0||1.28)-1)*(1+(P['atk.k']||0))*T.fn.bufK(A,T,u,x,m.prS)*sh, d=(m.dur0||6)+(P['buf.dur']||0)+(isPat(A,T,u,x)?(P['pat.dur']||0):0);
      if(A.buffOn(x,'dmg',bon,d)) m.bf[x.uid]={l:d,b:bon};
      x._buffedT=0.5; T.fn.metAdd(A,T,u,x,1); T.fn.gift(A,T,u,x); },
    /* ---- TRAIL OF SPLENDOR's shield on an ally (the page's num site, ctx.unit = the ally): Lined Coat / Fan of Eyes / Sleep It Off, her buffs' strength,
       the Patron; Sewn Lining keeps its 5 s to tell a break ---- */
    splNum(A,T,u,c){ const P=T.P, x=c.unit; let k=(1+(P['spl.k']||0))*(1+(P['buf.k']||0)); if(P['pat.k']&&isPat(A,T,u,x)) k*=1+P['pat.k']; c.amt*=k; if(P.sewn&&x){ const m=mi(T); m.spl[x.uid]=5; m.sh0[x.uid]=(x.shield||0)+c.amt; } },   // the shield it now holds: a break before her next tick is still seen
    sewnBreak(A,T,u,x){ const P=T.P; T.fn.metAdd(A,T,u,x,1); A.eng().healUnit(x,x.maxHp*(P.sewn||0)); },
    /* ---- HELD THE GATE: a control landing on an ally with 5 Mettle is removed at once (stun, sleep, fear, silence; once every 8 s per ally) ---- */
    gateAlly(A,T,u,c){ const x=c.unit; return !!x&&x.alive&&!x._summon&&['stunned','fearT','silencedT'].indexOf(c.field)>=0&&met(A,T,u,x)>=5&&!(mi(T).gate[x.uid]>0); },
    gateFree(A,T,u,c){ const x=c.unit; x[c.field]=0; if(c.field==='stunned') x._sleepT=0; mi(T).gate[x.uid]=GATE; },
    gateSelf(A,T,u,c){ return ['stunned','fearT','silencedT'].indexOf(c.field)>=0&&met(A,T,u,u)>=5&&!(mi(T).gate[u.uid]>0); },
    gateUse(A,T,u){ mi(T).gate[u.uid]=GATE; if((u._sleepT||0)>0&&!((u.stunned||0)>0)) u._sleepT=0; },
    /* ---- HEALING A SECOND: Long Wear (her Full Bottle ally), Swan's Bearing (an ally Imperial Plumage shielded, while that shield holds), Rest Easy (herself,
       while an enemy sleeps): together at most 1.2% of a unit's max HP a second (the game's regeneration cap), healed once a second ---- */
    regen(A,T,u,dt){ const m=mi(T), P=T.P, E=A.eng();
      for(const x of E.units()){ if(!side(u,x)) continue; let r=0; if(P.lw&&m.lw[x.uid]>0) r+=P.lw; if(P.swan&&m.sw[x.uid]>0&&(x.shield||0)>0) r+=P.swan; if(P.re&&x===u&&m.anyS) r+=P.re;
        if(r>0){ m.rgA[x.uid]=(m.rgA[x.uid]||0)+Math.min(REGEN,r)*x.maxHp*dt; m.rgU[x.uid]=x; } }
      m.rgClk+=dt; if(m.rgClk>=1-1e-9){ m.rgClk-=1; for(const k in m.rgA){ const x=m.rgU[k]; if(x&&x.alive&&m.rgA[k]>0) E.healUnit(x,m.rgA[k]); } m.rgA={}; m.rgU={}; } },
    /* ---- SLEEP. Her talent sleeps (a Languor nap, The Whole Field Sleeps) are written straight on: 'stunned' (through the target's control rows, cut at the
       ceiling) and _sleepT (so a hit wakes it, as the game's sleeps). The stun-lock rule: never on a stunned enemy, nor within 0.5 s after a stun or sleep of
       hers on it ended; a Languor nap at most twice per enemy in any 10 s ---- */
    canSleep(A,T,u,x){ const m=mi(T); return !!x&&x.alive&&!((x.stunned||0)>0)&&!(m.lock[x.uid]>0)&&!m.myS[x.uid]; },
    tsleep(A,T,u,x,d,kind){ if(!T.fn.canSleep(A,T,u,x)||!(d>0)) return false; const w=x.stunned||0; A.control(T,u,x,'stunned',d); const got=x.stunned||0; if(!(got>w)) return false;
      x._sleepT=Math.max(x._sleepT||0,got); const m=mi(T); m.myS[x.uid]=1; const r=m.slp[x.uid]||(m.slp[x.uid]={debt:0,kind:null,mine:false}); r.kind=kind; r.mine=true; return true; },
    /* every stun / sleep of hers that landed (skill or talent): the lock's record; Soporific Bouquet's sleep made longer: what it really lasts (the ceiling's
       2.8 s) x (1 + Breathing It In) x a Preen, plus Strong Bouquet and Captivated, at most 4.0 s (Phil's rule: talent extensions in full) */
    stunHit(A,T,u,c){ const m=mi(T), P=T.P, x=c.tgt; if(!x) return; m.myS[x.uid]=1; if(c.talent||T.s.cur!==BQ) return;
      const r=m.slp[x.uid]||(m.slp[x.uid]={debt:0,kind:null,mine:false}); r.kind='bq'; r.mine=true;
      const pre=m.bqPre, base=c.amt; let d=base*(1+(P['slp.k']||0))*((pre&&P.preen)?(1+P.preen)*(1+(P['preen.k']||0)):1)+(P['bq.add']||0)+((m.thT===x)?(P['th.add']||0):0);
      d=Math.min(STUN_TOP,d); if(d>base+1e-9&&x.alive){ x.stunned=Math.max(x.stunned||0,d); x._sleepT=Math.max(x._sleepT||0,d); } },
    bqKit(A,T,u,c){ const m=mi(T); m.bqPre=false; if(m.f&&m.f.pre&&preOn(m)){ m.bqPre=true; if(!(m.preWin>0)) m.pre=false; m.nh=0; } },
    bqCast(A,T,u,c){ const m=mi(T), P=T.P, E=A.eng(), x=c.tgt;
      if(P.sb){ let s2=null,sv=-1; for(const y of E.units()){ if(!y.alive||y.team===u.team||y===x||y._dropHidden) continue; if((y.energy||0)>sv){ sv=y.energy||0; s2=y; } }   // Second Bouquet: the second-highest energy
        if(s2) T.fn.langAdd(A,T,u,s2,P.sb,T.st.lang.dur+(P['sb.dur']||0)); }
      if(T.r.he_7_3&&x&&x.alive&&m.thT===x) A.setMark(T,u,x,'adm',{});                                       // Turned Heads: that enemy becomes an Admirer
      if(m.bqPre&&P.fp) E.healUnit(u,u.maxHp*P.fp); m.bqPre=false; m.thT=null; },
    turned(A,T,u,c){ const m=mi(T); let best=null,bn=0; for(const y of A.eng().units()){ if(!y.alive||y.team===u.team||y._dropHidden) continue; const n=m.eyeBy[y.uid]||0; if(n>bn){ bn=n; best=y; } }
      if(best){ c.tgt=best; m.thT=best; } else m.thT=c.tgt; },
    /* ---- A SLEEPER WAKES (its _sleepT ran out, or a hit cleared it): Dream Debt strikes, Deep Slumber, Snore ---- */
    wake(A,T,u,x,r){ const m=mi(T), P=T.P, E=A.eng();
      if(r.kind==='bq'&&P.ds) T.fn.langAdd(A,T,u,x,P.ds);
      if(r.kind==='nap'&&P.snore) A.acts(T,u,[{slow:P.snore,dur:2,on:'target'}],{u,tgt:x});
      if(r.grp&&m.wfs){ m.wfs.d.push([x,r.debt]); m.wfs.left--; if(m.wfs.left<=0){ const L=m.wfs.d; m.wfs=null; for(const [y,dv] of L) if(y.alive) T.fn.strike(A,T,u,y,dv); } return; }
      if(r.debt>0) T.fn.strike(A,T,u,x,r.debt); },
    slpGone(A,T,u,x){ const m=mi(T), r=m.slp[x.uid]; delete m.slp[x.uid]; if(r&&r.grp&&m.wfs){ m.wfs.left--; if(m.wfs.left<=0){ const L=m.wfs.d; m.wfs=null; for(const [y,dv] of L) if(y.alive) T.fn.strike(A,T,u,y,dv); } } },
    /* Dream Debt strikes its sleeper: 6% a rank of it (Dreamer's Debt: more above 50% HP) as magic damage (its magic resist applies), Waking Scream half of
       that to each enemy within 2 m of it, Dream Thief energy. Talent damage: no crit, no second pass through her damage rows */
    strike(A,T,u,x,debt){ const P=T.P, E=A.eng(); if(!P.debt||!(debt>0)||!x.alive) return; let a=debt*P.debt; if(P['debt.hi']&&x.hp>0.5*x.maxHp) a*=1+P['debt.hi'];
      const hit=y=>A.hurt(T,u,y,a*(y===x?1:(P.scream||0))*E.defMul(u,y,'magic'),'#c9b6ff');
      hit(x); if(P.scream) for(const y of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},{u,tgt:x})) hit(y);
      if(P['debt.nrg']) u.energy=Math.min(100,(u.energy||0)+P['debt.nrg']); },
    debtAdd(A,T,u,x,a){ const m=mi(T), P=T.P; if(!P.debt||!(a>0)) return; const r=m.slp[x.uid]||(m.slp[x.uid]={debt:0,kind:null,mine:false});
      const cap=x.maxHp*0.5*(1+(P['debt.cap']||0))*(r.grp?2:1); r.debt=Math.min(cap,r.debt+a); },
    unitAsleep(A,T,u,c){ const x=c.unit; return !!x&&x.team!==u.team&&(x._sleepT||0)>0; },
    anySleep(A,T){ return !!mi(T).anyS; },
    /* ---- LANGUOR. Her basic attacks (Sweet Note) and her other talents add it to an enemy (all of it lapses 5 s after the last gain, Slow Poppy longer; a gain
       that lasts longer is never cut by a shorter one); at its max (5, Heavy Eyelids 6, Restless Sleep 4) the enemy naps for 0.6 s (Heavy Eyelids +0.4,
       Restless Sleep -0.2, Heavy Head, Breathing It In) and its Languor clears. A nap the lock refuses waits for the lock with the Languor kept ---- */
    langHit(A,T,u,c){ T.fn.langAdd(A,T,u,c.tgt,1); },
    langAdd(A,T,u,x,n,d){ if(!x||!x.alive||x.team===u.team) return; const v=lang(A,T,u,x), mx=T.st.lang.max; A.ustPut(T,u,x,'lang',Math.min(mx,v+n),d);
      if(v+n>=mx-1e-9) T.fn.tryNap(A,T,u,x); },
    tryNap(A,T,u,x){ const m=mi(T), P=T.P; const L=m.nap[x.uid]; if(L&&L.length>=NAP_MAX) return; if(!T.fn.canSleep(A,T,u,x)) return;
      const d=(0.6+(P['nap.add']||0))*(1+(P['slp.k']||0)); if(!T.fn.tsleep(A,T,u,x,d,'nap')) return;
      A.ustPut(T,u,x,'lang',0); (m.nap[x.uid]||(m.nap[x.uid]=[])).push(NAP_WIN);
      if(P.fit) x.energy=Math.max(0,(x.energy||0)-P.fit); },
    /* ---- LULL: enemies whose body is within 3 m (Thick Air: farther) of a sleeping enemy's body (Plumage of Poppies: also of a charmed one, while the charm
       lasts) are Lulled; the source itself is not. Yawn: each 2 s Lulled, Languor ---- */
    lullScan(A,T,u,foes,dt){ const m=mi(T), P=T.P, E=A.eng(), R0=3+(P['lull.m']||0), src=foes.filter(x=>(x._sleepT||0)>0||(P.pop&&charmed(T,x))); const was=m.lul; m.lul={};
      if(src.length) for(const y of foes){ for(const s of src) if(s!==y&&gapM(E,s,y)<R0){ m.lul[y.uid]=1; break; } }
      for(const y of foes){ if(!m.lul[y.uid]){ delete m.yw[y.uid]; continue; } if(!P.yawn) continue; m.yw[y.uid]=(m.yw[y.uid]||0)+dt; if(m.yw[y.uid]>=2-1e-9){ m.yw[y.uid]-=2; T.fn.langAdd(A,T,u,y,P.yawn); } } },
    lulSel(A,T,u,c){ return lulled(T,c.tgt); },
    /* ---- IMPERIAL PLUMAGE. plKit: the guard each enemy had before the cast (Grace gives it back to the one it spares; Vanity's double cut is given back
       later), Full Display opens every Eye and makes the shields 2% larger per open Eye, the Eyes signature's test ---- */
    plKit(A,T,u,c){ const m=mi(T), P=T.P, E=A.eng(), o=c.o; m.plPre={};
      for(const x of E.units()) if(x.alive&&x.team!==u.team) m.plPre[x.uid]=[x._shredPct,x._shredT,x._mrShredPct,x._mrShredT,x._atkDnPct,x._atkDnT];
      if(P.fd&&T.st.eye){ A.stSet(T,u,'eye',A.stMax(T,u,'eye')); o.shield=(o.shield||0.10)*(1+P.fd*eyes(T)); }
      m.eisOn=!!P.eis&&eyes(T)>0&&eyes(T)>=A.stMax(T,u,'eye')-1e-9; },
    /* plCast: who is charmed (every living enemy; Grace: not the one farthest from her, with two or more), Vanity's highest-Attack enemy charmed twice over
       (its Attack cut doubled for the charm), Showstopper / Season's Display longer on them, Admirers, Plumage of Poppies, the two signatures; on allies:
       Plumage of Courage, Swan's Bearing's clock, the Patron's Gift, Rosewater for a Coward */
    plCast(A,T,u,c){ const m=mi(T), P=T.P, E=A.eng(), o=c.o||{}, dur=o.dur||6, pre=m.plPre||{}; m.plPre=null;
      const foes=E.units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden); let ch=foes.slice();
      if(P.grace&&ch.length>1){ let far=null,fd=-1; for(const x of ch){ const d=E.dist(u,x); if(d>fd){ fd=d; far=x; } } const p=pre[far.uid];
        if(p){ far._shredPct=p[0]; far._shredT=p[1]; far._mrShredPct=p[2]; far._mrShredT=p[3]; far._atkDnPct=p[4]; far._atkDnT=p[5]; } ch=ch.filter(x=>x!==far); }
      if(P.vanity&&ch.length){ let top=null; for(const x of ch) if(!top||(x.dmg||0)>(top.dmg||0)) top=x; const p0=Math.max((pre[top.uid]&&pre[top.uid][4])||0,o.atkDn||0.2), v=Math.max(top._atkDnPct||0,2*(o.atkDn||0.2));
        top._atkDnPct=v; m.vr[top.uid]={x:top,l:top._atkDnT||dur,v,p0}; }
      const admOn=ADM.some(id=>T.r[id]);
      for(const x of ch){ const add=(P.show||0)+((P.sd&&isAdm(A,u,x))?P.sd:0); if(add>0){ x._shredT=(x._shredT||0)+add; x._mrShredT=(x._mrShredT||0)+add; x._atkDnT=(x._atkDnT||0)+add; if(m.vr[x.uid]) m.vr[x.uid].l+=add; }
        if(CHARM.some(id=>T.r[id])) m.ch[x.uid]=dur+add;
        if(admOn) A.setMark(T,u,x,'adm',{});
        if(P.pop) T.fn.langAdd(A,T,u,x,P.pop,T.st.lang.dur+(P['pop.dur']||0)); }
      if(P.wfs){ const g=[]; for(const x of ch){ const d=P.wfs*(1+(P['slp.k']||0)); if(T.fn.tsleep(A,T,u,x,d,'sig')){ m.slp[x.uid].grp=true; g.push(x); } } if(g.length) m.wfs={left:g.length,d:[]}; }
      if(m.eisOn){ for(const x of foes){ A.setMark(T,u,x,'adm',{}); A.setMark(T,u,x,'eis',{dur:4}); } m.preWin=8; m.pre=true; m.eisOn=false; }
      for(const a of E.units()){ if(!side(u,a)) continue; T.fn.gift(A,T,u,a);
        if(P.poc){ T.fn.metAdd(A,T,u,a,P.poc); if((a.shield||0)>0) a.shieldT=Math.max(a.shieldT||0,dur+2); }
        if(P.swan) m.sw[a.uid]=a.shieldT||dur; }
      if(P.rwc){ m.rwc=P.rwc; for(const a of E.units()) if(side(u,a)&&!a._summon) T.fn.metAdd(A,T,u,a,5); } },
    /* ---- EYES (each enemy attack coming at her, hit or miss: the page's aimed line; Court Manners: the first one each wave opens more), Hundredfold ---- */
    eyeOpen(A,T,u,c){ const m=mi(T), P=T.P, x=c.src; if(!x) return; let n=1; if(!m.first){ m.first=true; n+=P['eye.first']||0; }
      A.stSet(T,u,'eye',eyes(T)+n); m.eyeBy[x.uid]=(m.eyeBy[x.uid]||0)+n; },
    hundred(A,T,u,c){ const m=mi(T), x=c.src; if(!x||m.hf[x.uid]>0) return; m.hf[x.uid]=HUND; A.acts(T,u,[{slow:0.10,dur:2,on:'source'}],c); },
    /* ---- PREEN: no enemy hit has landed on her for 4 s (Primped: sooner); a hit that lands ends it (not during Every Eye in Sayle's 8 s); her next Scent of
       Courage or Soporific Bouquet spends it ---- */
    hurtMe(A,T,u){ const m=mi(T); m.nh=0; if(m.pre&&!(m.preWin>0)) m.pre=false; },
    prS(A,T){ return !!mi(T).prS; },
    preHeal(A,T,u,c){ const P=T.P; c.amt*=(1+(P.preen||0))*(1+(P['preen.k']||0)); },
    admSteps(A,T,u){ let n=0; for(const x of A.eng().units()) if(x.alive&&x.team!==u.team&&isAdm(A,u,x)) n++; return Math.min(5,Math.floor(n/2)); },
    /* ---- HER TEAM'S HITS AND HITS ON HER ALLIES (teamIn: every hit on a unit she watches, her own included). A hit by her side on an enemy: Behind the Ears
       (per Mettle of the striker), House Favourite (the Patron), More Than a Minute Ago (the bonus doubled), Courage in a Dream, Sleepwalker's Bruise; then
       Dream Debt writes the hit as it now stands. "On a sleeper" = the page's stamp, written before the hit wakes it (_talSlH / _talSlT) ---- */
    teamIn(A,T,u,c){ const m=mi(T), P=T.P, src=c.src, t=c.tgt; if(!src||!t) return; const now=A.eng().now();
      if(t.team!==u.team&&src.team===u.team){ let k=1; const mt=met(A,T,u,src);
        if(P['met.dmg']&&mt) k*=1+P['met.dmg']*mt;
        if(P['pat.dmg']&&isPat(A,T,u,src)) k*=1+P['pat.dmg'];
        if(m.mt[src.uid]>0&&m.bf[src.uid]&&(src.dmgBuffT||0)>0){ const b=(src.dmgBuffMul||1)-1; if(b>0) k*=(1+2*b)/(1+b); }
        const sl=t._talSlH===src&&t._talSlT===now; if(sl) t._talSlH=null;
        if(P.cid&&mt>=5&&(sl||charmed(T,t))) k*=1+P.cid;
        if(P['slp.dmg']&&sl) k*=1+P['slp.dmg'];
        c.amt*=k;
        if(P.debt&&sl) T.fn.debtAdd(A,T,u,t,c.amt*((P['cid.debt']&&mt>=5)?1+P['cid.debt']:1));
        return; }
      if(t.team===u.team&&src.team!==u.team&&t!==u) c.amt*=T.fn.allyK(A,T,u,t,src); },
    teamDot(A,T,u,c){ const m=mi(T), P=T.P, x=c.unit, src=c.src; if(!x||!src) return;
      if(x.team!==u.team&&src.team===u.team&&(x._sleepT||0)>0){ if(P['slp.dmg']) c.amt*=1+P['slp.dmg']; if(P.debt) T.fn.debtAdd(A,T,u,x,c.amt); return; }
      if(x.team===u.team&&src.team!==u.team&&x!==u) c.amt*=T.fn.allyK(A,T,u,x,src); },
    /* ---- HER ALLIES' DAMAGE REDUCTION FROM HER TALENTS, ONE GROUP: Steady Mettle, Hushed Confession (per its Mettle), Eyes Everywhere (per Eye), Drowsy Court,
       Smitten (+ Vain Strength's points), Lullaby multiply, and together never take more than 15% off a hit ---- */
    allyK(A,T,u,t,src){ const P=T.P; let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); }, mt=met(A,T,u,t);
      if(P['dr.steady']&&mt>=3) cut(P['dr.steady']); if(P['dr.hush']) cut(P['dr.hush']*mt); if(P['dr.ee']) cut(P['dr.ee']*eyes(T));
      if(P['dr.dc']&&lang(A,T,u,src)>=3) cut(P['dr.dc']); if(P.adm&&isAdm(A,u,src)) cut(P.adm+(P['adm.pts']||0)); if(P['lull.dmg']&&lulled(T,src)) cut(P['lull.dmg']);
      return Math.max(1-TEAM_CAP,k); },
    /* ---- HER DAMAGE REDUCTION, ONE GROUP: every talent of hers that makes a hit on her smaller multiplies here (each takes its share of what is left), and
       together they never take more than 40% off a hit or a DoT tick (DR_CAP). Cheap Bottles' and Breathing It In's extra damage taken come after ---- */
    drK(A,T,u,src,kind){ const P=T.P, m=mi(T), E=A&&A.eng&&A.eng(); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); }, mt=met(A,T,u,u);
      if(P['dr.vf']){ let n=0; if(E) for(const x of E.units()) if(side(u,x)&&x!==u&&!x._summon&&met(A,T,u,x)>=3) n++; cut(P['dr.vf']*Math.min(3,n)); }
      if(P['dr.steady']&&mt>=3) cut(P['dr.steady']); if(P['dr.hush']) cut(P['dr.hush']*mt);
      if(P['dr.ps']&&E&&E.units().some(x=>side(u,x)&&x!==u&&!x._summon&&met(A,T,u,x)>=5)) cut(P['dr.ps']);
      if(P['dr.eye']) cut(P['dr.eye']*eyes(T));
      if(src){ if(P['dr.calm']&&lang(A,T,u,src)>=1) cut(P['dr.calm']); if(P['dr.dc']&&lang(A,T,u,src)>=3) cut(P['dr.dc']);
        if(lulled(T,src)){ if(P['dr.unb']) cut(P['dr.unb']); if(P['lull.dmg']) cut(P['lull.dmg']); }
        if(isAdm(A,u,src)){ if(P['dr.admd']) cut(P['dr.admd']); if(P.adm) cut(P.adm+(P['adm.pts']||0)); } }
      if(P['dr.unr']&&kind==='magic') cut(P['dr.unr']);
      if(P['dr.eff']&&preOn(m)) cut(P['dr.eff']);
      return Math.max(1-DR_CAP,k)*(1+(P.vuln||0))*(1+(P.vuln2||0)); },
    myDr(A,T,u,c){ T.s.api=A; c.amt*=T.fn.drK(A,T,u,c.src,c.kind); },
    myDrDot(A,T,u,c){ const d=c.dot; c.amt*=T.fn.drK(A,T,u,c.src,d&&d.kind); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/41 - MIRELLE VELVETPLUM - talent decisions.md) */
  ruling:{}
};
