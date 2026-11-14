/* BRANNUS - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Brannus": what he added)
   His real kit (the code, not the tooltip wording; his skills read Attack, his hits are physical):
   - Rim Breaker ('knockstun', green, cd 8, delivered as a shot): thrown at the FARTHEST enemy within 10 m (the 'num' hook 'rimR'); every other enemy whose body
     the straight line crosses (the 'num' hook 'rimW' widens that) is struck first, as the wheel reaches it. EACH enemy is a whole cast of the skill
     (doEffect with o._pierced; the far one without it): 150% of his attack, a stun (the control table: 3.5 s x 0.7 = 2.45 s, under the 2.8 s ceiling) and a
     1.6 m push away from him. So kit / cast / hit / ccHit rows run once per enemy struck; the press (the 'cd' hook, skill 'green') starts a throw.
   - Arena Lock ('taunt', blue, cd 10): the kit row has NO radius, so it taunts EVERY enemy on the field for 3.5 s (the game's forcedTarget; taunts are not cut)
     and puts the taunt's damage reduction in his one skill slot for 3.5 s (drMul: 40% + 0.2 point a level, 59.8% at 100). The 3 m on the card is only the art.
   - Pride's Momentum (passive 'pridemomentum'): each time he is hit while he holds a shield, his damage (every hit and skill) is 22% x his passive's
     strength higher for 4 s (dmgBuffMul / dmgBuffT, inside damage()). Nothing is "loaded" and nothing is stored: the card's "loads into his next swing" is that buff.
     He has no shield of his own: without a shield from an ally or his talents the passive never acts.
   - Lionwheel Rampage ('charge', ultimate, on energy - no cooldown): ULT_DEF.charge (180%, 5 m, stun 1.0 -> the area table 2.0 s x 0.7 = 1.4 s) with
     HERO_ULT_ART.brannus (pathHit 0.5): he dashes to the farthest enemy; every enemy within 1.4 m of his line (and not inside the landing circle) is struck for
     half the slam as he reaches it ('chargePath', the landPre / land hooks), then every enemy within 5 m of the landing (centre to centre) takes the slam and is
     stunned ('charge'). Both hit sets lie outside kit / cast, so the two page sites name them.
   Cheers, Wins, Bated Breath, Whirl, Rimmed, Load, Wounded Pride and Bronze Guard exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/17 - BRANNUS - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const RB='knockstun', AL='taunt', LW=['charge','chargePath'];
/* the states several talents read: their bookkeeping runs when any of these is learned */
const CHEER=['cc_1_1','cc_1_4','cc_2_1','cc_3_1','cc_4_1','cc_5_2','cc_6_4','cc_7_1','cc_8_1','cc_10_1','cc_11_1','cc_11_4','cc_12_1'];
const WIN=['cc_1_2','cc_2_2','cc_4_2','cc_5_2','cc_7_1','cc_8_2','cc_11_2','cc_12_2'];
const BB=['cc_1_4','cc_3_4','cc_5_4','cc_7_4','cc_9_4','cc_12_3','cc_12_4'];
const WHIRL=['bw_1_4','bw_2_4','bw_3_4','bw_4_4','bw_6_1','bw_6_4','bw_8_4','bw_10_4','bw_11_3','bw_12_1','bw_12_3','bw_13_3'];
const RIM=['bw_1_1','bw_3_1','bw_5_1','bw_7_1','bw_9_1','bw_9_4','bw_10_1','bw_11_3','bw_12_1','bw_12_4','bw_13_3'];
const LOCK=['cc_5_3','cc_6_1','cc_6_3','lp_1_1','lp_2_1','lp_3_1','lp_n1','lp_10_2','lp_11_2','lp_12_1','bw_9_1'];
const LOAD=['lp_2_2','lp_4_2','lp_6_2','lp_5_2','lp_5_3','lp_6_3','lp_9_2','lp_10_1','lp_11_2','lp_12_2','lp_13_2','lp_7_2','lp_n2'];
const WP=['lp_1_4','lp_3_4','lp_6_4','lp_7_4','lp_10_4','lp_9_4'];
const SCAN=['lp_4_1','lp_12_4','lp_7_4','lp_11_1'];
const TEN=['cc_5_1','cc_8_3','bw_8_2','lp_12_3'];
const THROW=WHIRL.concat(RIM,['cc_11_1','cc_9_2','bw_6_3','bw_10_3','lp_5_2','bw_4_3','bw_5_2','bw_11_4']);   // the talents that need to know which throw, and which strike of it
const FOE={targetTeam:'enemy'};
/* ---- helpers ---- */
const foes=(A,T,u)=>A.pick(T,u,{team:'enemy'},{});
const own=s=>{ s.ownW=true; };
/* the far-target test inside his own skill: a Rim Breaker cast on the enemy it was thrown at (no o._pierced) */
const isFar=o=>!!o&&!o._pierced;
module.exports={
  hero:'brannus',
  casting:true,                         // rows ask which of his skills a hit, a stun or a kill comes from (Rim Breaker, Arena Lock, the Rampage's slam and path)
  states:{
    cheer:{max:10,dur:P('cheer.dur',8)},                                         // Cheers: all lapse 8 s after the last (Showman: longer); cleared between waves (cheerWave)
    win:{max:41,gain:'winGain'},                                                 // Wins: the rest of the fight
    whirl:{max:6,dur:P('whirl.dur',10),gain:'whirlGain'},                        // Whirl: all lapse 10 s after the last
    load:{max:{pct:P('load.cap',1),of:'dmg'}},                                   // Load: up to his attack (Heavier Load: up to 160%)
    wp:{max:5,wave:'reset'}                                                      // Wounded Pride: this wave
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'hit',reqAny:CHEER,if:{crit:true,targetTeam:'enemy'},do:[{stack:'cheer',add:1}]},                              // Cheers: each critical hit,
    {on:'kill',reqAny:CHEER,do:[{stack:'cheer',add:1}]},                                                              //   each kill,
    {on:'ccHit',reqAny:CHEER,if:{casting:RB,cc:['stunned'],talent:false},do:[{stack:'cheer',add:1}]},                  //   each enemy Rim Breaker stuns
    {on:'waveEnd',reqAny:CHEER,do:[{fn:'cheerEnd'}]}, {on:'wave',reqAny:CHEER,do:[{stack:'cheer',touch:true}]},       //   Cheers do not carry into the next wave (Crowd Belongs to Him keeps some)
    {on:'death',reqAny:WIN,do:[{fn:'winDeath'}]},                                                                     // Wins: an enemy that dies near him
    {on:'tick',reqAny:BB,edge:true,if:{selfHpBelow:0.40},do:[{fn:'bb'}]},                                             // Bated Breath: he drops below 40% HP
    {on:'cd',reqAny:THROW,skill:'green',do:[{fn:'newThrow'}]},   // a Rim Breaker press starts a throw
    {on:'kit',reqAny:THROW,skill:RB,do:[{fn:'rbKit'}]}, //   each enemy it strikes is one cast of the skill
    {on:'hit',reqAny:THROW,if:{casting:RB,targetTeam:'enemy'},do:[{fn:'rbHit'}]},    //   what each strike does
    {on:'ccHit',reqAny:['cc_11_1','bw_4_3','bw_13_3','bw_5_2','bw_11_4'],if:{casting:RB,cc:['stunned'],talent:false},do:[{fn:'rbStun'}]},   // its stun landed
    {on:'hit',reqAny:WHIRL,if:{casting:RB,targetTeam:'enemy'},do:[{stack:'whirl',add:1}]},                           // Whirl: each enemy Rim Breaker passes through
    {on:'hit',reqAny:RIM,if:{casting:RB,targetTeam:'enemy'},do:[{mark:'rim',on:'target',dur:P('rim.dur',4)}]},        // Rimmed: each enemy Rim Breaker strikes
    {on:'cast',reqAny:LOCK,skill:AL,do:[{fn:'lockCast'}]},                                                           // Arena Lock: who it taunted (and Bronze Guard, Ring of Bronze)
    {on:'end:lock',reqAny:LOCK,do:[{fn:'lockEnd'}]},                                                                 //   its taunt ends
    {on:'absorb',reqAny:LOAD,do:[{stack:'load',add:{pct:1,of:'hit'}}]},                                               // Load: what a shield takes off a hit
    {on:'out',reqAny:LOAD,do:[{fn:'loadHit'}]},                                                                      //   the Load attack
    {on:'shieldBreak',reqAny:WP,do:[{stack:'wp',add:1}]},                                                            // Wounded Pride: a shield on him breaks
    {on:'absorb',reqAny:['lp_5_4','lp_7_2'],do:[{fn:'pm'}]},                                                         // Pride's Momentum, as his talents change it
    {on:'ownSh',do:[{fn:'own'}]},                                                                                     // a shield his own talents wrote
    {on:'tick',reqAny:SCAN,do:[{fn:'shScan'}]},                                                                       // shields others give him (and their strength)
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                           // shorter controls on him, with their caps
    {on:'tick',reqAny:['bw_12_2'],do:[{weaken:'slowMul',by:{rk:'bw_12_2',r:0.08}}]}                                   // Iron Lungs: slows on him weaker
  ],
  talents:{
    /* ============================== CHAMPION OF CASSADANE ============================== */
    cc_1_1:[ {stat:{atk:R(0.004)},per:'cheer'} ],                                                                     // Play to the Crowd
    cc_1_2:[ {stat:{hp:R(0.001),atk:R(0.001)},per:'win'} ],                                                           // Forty-One
    cc_1_4:[ {on:'tick',if:{window:'bb'},do:[{stack:'cheer',touch:true}]},                                            // Bated Breath: Cheers stop fading
             {on:'in',if:{window:'bb'},less:R(0.004),per:'cheer'} ],                                                  //   and each Cheer is damage reduction
    cc_2_1:[ {param:'cheer.dur',add:R(1)} ],                                                                          // Showman
    cc_2_2:[ {param:'win.r',add:R(0.5)} ],                                                                            // Long Record
    cc_3_1:[ {on:'out',if:{stackMin:{cheer:10}},critMore:0.20} ],                                                     // Crowd Favourite
    cc_4_2:[ {on:'in',less:R(0.0005),per:'win'} ],                                                                    // Pit Veteran
    cc_4_3:[ {on:'out',if:{casting:RB},more:R(0.04)} ],                                                               // Bronze Throw
    cc_3_4:[ {param:'bb.dur',add:R(0.4)} ],                                                                           // Quiet Terrace
    cc_4_1:[ {stat:{crit:R(0.001)},per:'cheer'} ],                                                                    // Showmanship (5% at 10 Cheers: the crit cap)
    cc_5_2:[ {on:'winGain',do:[{stack:'cheer',touch:true},{stack:'cheer',add:2}]} ],                                  // Kill for the Crowd (PICK ONE)
    cc_5_3:[ {param:'spare.h',add:0.02} ],                                                                            // Spare Them (PICK ONE): lockEnd
    cc_5_4:[ {on:'hit',if:{window:'bb',targetTeam:'enemy'},do:[{heal:{pct:R(0.01),of:'hpLost'}}]} ],                  // Their Silence
    cc_5_1:[ {param:'ten.all',add:R(0.04)} ],                                                                         // Unchained (the 'ten' always row; up to 20%)
    cc_6_4:[ {on:'wave',do:[{stack:'cheer',add:R(2)}]} ],                                                             // Opening Bout
    cc_6_3:[ {param:'spare.h',add:R(0.01)} ],                                                                         // Thumbs Up
    cc_6_1:[ {param:'lock.taunt',add:R(0.2)} ],                                                                       // Thunderous (lockCast)
    cc_6_2:[ {on:'out',if:{targetHpBelow:0.50},more:R(0.02)} ],                                                       // Bloodied Sand
    cc_10_3:[ {on:'in',if:{crit:true},less:R(0.02)} ],                                                                // Old Scars
    cc_7_1:[ {on:'hit',if:{casting:'charge',targetTeam:'enemy'},do:[{stack:'cheer',add:2}]},                          // Victory Lap: the landing's hits
             {on:'kill',if:{casting:LW},do:[{fn:'vlKill'}]} ],                                                        //   its kills are Wins and give energy
    cc_7_4:[ {on:'out',if:{window:'bb'},more:R(0.03)} ],                                                              // Last Man Standing
    cc_8_1:[ {stat:{aspd:R(0.02)},if:{stackMin:{cheer:5}}} ],                                                         // Roar of the Terrace
    cc_8_2:[ {on:'out',more:R(0.01),per:{stack:'win',div:10}} ],                                                      // Hall of Wins
    cc_8_3:[ {param:'ten.sil',add:R(0.1)} ],                                                                          // Hard Sand
    cc_9_2:[ {on:'kill',if:{casting:RB},do:[{fn:'f42'}]} ],                                                           // The Forty-Second
    cc_9_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                        // Pit Fighter
    cc_9_4:[ {on:'bbStart',do:[{heal:{pct:R(0.02),of:'maxHp'}}]} ],                                                   // Steeled
    cc_10_1:[ {stat:{lifesteal:R(0.002)},per:'cheer'} ],                                                              // Crowd Hunger
    cc_10_2:[ {on:'out',if:{casting:LW},more:R(0.04)} ],                                                              // Arena Champion
    cc_11_1:[ {param:'ov',add:1} ],                                                                                   // Standing Ovation (newThrow, rbHit, rbStun)
    cc_11_2:[ {on:'winGain',do:[{energy:R(0.25)}]} ],                                                                 // Undefeated (0.05 s of the ultimate a Win = 0.25 energy)
    cc_11_4:[ {stat:{armor:R(0.02)},if:{stackMin:{cheer:5}}} ],                                                       // Proud Stance
    cc_12_1:[ {param:'cheer.keep',add:R(1)} ],                                                                        // Crowd Belongs to Him (cheerEnd)
    cc_12_2:[ {on:'in',if:{stackMin:{win:20}},less:R(0.01)} ],                                                        // Record Book
    cc_12_3:[ {stat:{mr:R(0.04)},if:{window:'bb'}} ],                                                                 // Lion's Mane
    cc_12_4:[ {param:'bb.n',add:R(1)} ],                                                                              // Second Quiet
    cc_13_2:[ {on:'lethal',once:'fight',do:[{undying:4},{fn:'stood'}]},                                               // He Stood Up Inside the Wheel (SIGNATURE)
              {on:'hit',if:{window:'stood',targetTeam:'enemy'},do:[{heal:{pct:0.30,of:'hpLost'}}]} ],
    /* ============================== THE BRONZE WHEEL ============================== */
    bw_1_1:[ {on:'out',if:{auto:true,targetHas:'rim'},more:R(0.04)} ],                                                // Rimmed (the mark: an always row)
    bw_2_2:[ {on:'out',if:{casting:RB},more:R(0.04)} ],                                                               // Throwing Arm
    bw_1_4:[ {stat:{aspd:R(0.01)},per:'whirl'} ],                                                                     // Whirl the Rim
    bw_2_3:[ {on:'num',skill:'rimR',addM:R(0.5)} ],                                                                   // Long Throw
    bw_2_4:[ {param:'whirl.dur',add:R(1)} ],                                                                          // Faster Spokes
    bw_3_1:[ {param:'rim.dur',add:R(0.5)} ],                                                                          // Rim Mark
    bw_6_3:[ {on:'out',if:{casting:RB,fn:'notFirst'},more:R(0.03)} ],                                                 // Line of Spikes
    bw_3_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy',stackMin:{whirl:6}},do:[{dmg:{pct:0.40,of:'hit'},on:{team:'enemy',of:'target',within:3,n:1,skip:'target'}}]} ],   // Full Whirl
    bw_4_2:[ {on:'kit',skill:RB,opt:{push:{addM:R(0.2)}}} ],                                                          // Heavier Rim
    bw_4_3:[ {param:'rb.far',add:R(0.1)} ],                                                                           // Bronze Reach (rbStun)
    bw_4_4:[ {stat:{atk:R(0.003)},per:'whirl'} ],                                                                     // Momentum Wheel
    bw_5_1:[ {on:'out',if:{targetHas:'rim'},critMore:R(0.03)} ],                                                      // Bronze Bite
    bw_5_2:[ {on:'kit',skill:RB,if:{fn:'farO'},opt:{push:{set:1e-9}}},                                                // Pin the Last (PICK ONE): the far target is not pushed
             {on:'pinGo',do:[{mark:'pinned',on:'target',dur:P('pin.dur',1)}]},                                        //   rooted when its stun ends
             {stat:{move:-1},to:{team:'enemy',has:'pinned'}} ],
    bw_5_3:[ {on:'num',skill:'rimW',addM:1} ],                                                                        // Through Them All (PICK ONE)
    bw_n1:[ {on:'in',if:{srcBeyond:4},less:R(0.015)} ],                                                               // Behind the Rim
    bw_6_1:[ {on:'cd',skill:'green',once:'wave',do:[{stack:'whirl',add:R(2)}]} ],                                     // Warm-Up Throw
    bw_6_2:[ {param:'pin.dur',add:R(0.2)} ],                                                                          // Nailed
    bw_6_4:[ {on:'in',less:R(0.003),per:'whirl'} ],                                                                   // Spinning Guard
    bw_7_1:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'rim'}} ],                                                    // Ringing Bronze
    bw_7_2:[ {on:'out',if:{casting:LW},more:R(0.03)} ],                                                               // Spiked Wheel
    bw_7_4:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                        // Spoke Breaker
    bw_8_2:[ {param:'ten.sil2',add:R(0.1)} ],                                                                         // Arena Grit
    bw_8_3:[ {on:'out',if:{casting:'chargePath'},more:R(0.04)} ],                                                     // Path of the Wheel
    bw_8_4:[ {on:'cd',skill:'green',if:{stackMin:{whirl:6}},add:R(-0.2)} ],                                           // Wheel Rhythm
    bw_9_1:[ {param:'ring',add:1} ],                                                                                  // Ring of Bronze (lockCast)
    bw_9_4:[ {on:'crit',if:{targetHas:'rim',targetTeam:'enemy'},chance:R(0.01),force:true} ],                         // Wheelhand
    bw_10_1:[ {on:'teamCc',if:{cc:['stunned'],srcIs:'ally',unitHas:'rim'},icd:5,do:[{heal:{pct:R(0.01),of:'maxHp'}},{emit:'shock'}]} ],   // Rim Shock
    bw_10_3:[ {on:'out',if:{casting:RB,fn:'far'},more:R(0.03)} ],                                                     // Far Target
    bw_10_4:[ {on:'whirlGain',do:[{heal:{pct:R(0.003),of:'maxHp',k:1}}]} ],                                           // Ever Turning
    bw_11_2:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                                  // Bronze Patience
    bw_11_3:[ {on:'hit',if:{casting:LW,targetTeam:'enemy'},by:'target',icd:1.5,do:[{mark:'rim',on:'target',dur:P('rim.dur',4)},{stun:0.5,on:'target'},{stack:'whirl',add:1}]} ],   // Lionwheel Throw (once per enemy each Rampage: his dash can shove one on into its slam)
    bw_11_4:[ {on:'rbEnd',do:[{slow:R(0.04),dur:2,on:'target'}]} ],                                                   // Dizzy Whirl
    bw_12_1:[ {on:'shock',do:[{stack:'whirl',add:R(1)}]} ],                                                           // Shock Whirl
    bw_12_2:[ {param:'ten.slow',add:R(0.08)} ],                                                                       // Iron Lungs (the weaken always row)
    bw_12_3:[ {on:'out',if:{casting:RB},more:R(0.01),per:'whirl'} ],                                                  // Turning Wheel
    bw_12_4:[ {on:'in',if:{srcHas:'rim'},less:R(0.02)} ],                                                             // Old Wheel Scars
    bw_13_3:[ {on:'whirlGain',if:{stackMin:{whirl:6}},do:[{window:'wdsCd',dur:0.01,cd:20},{cd:'green',set:0},{fn:'wdsArm'}]} ],   // The Wheel Did Not Stop (SIGNATURE)
    /* ============================== LION'S PRIDE ============================== */
    lp_1_1:[ {param:'bg',add:R(0.015)} ],                                                                             // Bronze Guard (lockCast)
    lp_2_3:[ {stat:{aspd:R(0.03)},if:{fn:'shielded'}} ],                                                              // Heavy Paw
    lp_1_4:[ {stat:{atk:R(0.01)},per:'wp'} ],                                                                         // Wounded Pride
    lp_2_1:[ {param:'bg.dur',add:R(1)} ],                                                                             // Raised Rim
    lp_2_2:[ {param:'load.k',add:R(0.1)} ],                                                                           // Loaded Swing (loadHit)
    lp_3_1:[ {on:'shieldBreak',if:{window:'bg'},do:[{stun:0.5,on:{team:'enemy',has:'locked'}}]} ],                     // Shield of the Pit
    lp_3_3:[ {on:'shieldBreak',do:[{window:'gla',dur:4}]}, {stat:{armor:R(0.04)},if:{window:'gla'}} ],                // Gladiator Armor
    lp_3_4:[ {stat:{crit:R(0.002)},per:'wp'} ],                                                                       // Proud Anger (5% at 5 Wounded Pride: the crit cap)
    lp_4_1:[ {param:'sh.str',add:R(0.02)} ],                                                                          // Bronze Plate (shScan)
    lp_4_2:[ {param:'load.cap',add:R(0.2)} ],                                                                         // Heavier Load
    lp_4_3:[ {on:'kit',skill:AL,opt:{dur:{add:R(0.2)}}} ],                                                            // Long Lock
    lp_n2:[ {on:'shieldBreak',do:[{window:'roar',dur:2}]}, {on:'in',if:{window:'roar'},less:0.05},                    // Roar for the Shield (LINK)
            {on:'shieldBreak',req:'cc_1_1',do:[{stack:'cheer',add:2}]}, {on:'loadAtk',req:'cc_1_1',do:[{stack:'cheer',add:1}]} ],
    lp_n1:[ {on:'in',if:{srcHas:'locked'},less:R(0.02)} ],                                                            // Eyes on Me
    lp_5_4:[ {param:'pm.more',add:R(0.01)} ],                                                                         // Pride Goes First (pm)
    lp_6_1:[ {on:'in',if:{fn:'shielded'},less:R(0.01)} ],                                                             // Mane of Bronze
    lp_6_2:[ {on:'out',if:{any:[{stackFull:'load'},{fn:'lfull'}]},more:R(0.02)} ],                       // Full Load (the Load attack that spends a full Load counts)
    lp_6_4:[ {on:'wave',do:[{stack:'wp',add:R(1)}]} ],                                                                // Prideful Start
    lp_7_1:[ {on:'hurt',if:{fn:'brokeNow'},do:[{dmg:{pct:R(0.20),of:'atk'},on:'source'}]} ],                          // Spiked Shield
    lp_7_2:[ {param:'pm.dur',add:3} ],                                                                                // Proud Lion (pm, loadHit)
    lp_9_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                        // Spiked Rim
    lp_8_1:[ {on:'out',if:{auto:true,fn:'shielded'},more:R(0.03)} ],                                                  // Guarded Blows
    lp_5_2:[ {param:'load.rb',add:1} ],                                                                               // Store It All (PICK ONE; loadHit)
    lp_5_3:[ {param:'spread.r',add:2} ],                                                                              // Spread the Weight (PICK ONE; loadHit)
    lp_7_4:[ {on:'shielded',if:{stackMin:{wp:5}},icd:5,do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                        // Stubborn Pride
    lp_9_2:[ {on:'hurt',if:{fn:'bare'},do:[{stack:'load',add:{pct:R(0.10),of:'hpLost'}}]} ],                          // Weight of the Rim
    lp_6_3:[ {param:'spread.r',add:R(0.3)} ],                                                                         // Broad Swing
    lp_9_4:[ {on:'tick',edge:true,once:'wave',if:{selfHpBelow:0.30,stackMin:{wp:5}},do:[{shield:{pct:0.20,of:'maxHp'},dur:6,emit:'ownSh'}]} ],   // Never Humbled
    lp_10_1:[ {param:'load.heal',add:R(0.05)} ],                                                                      // Guarded Strike (loadHit)
    lp_10_2:[ {param:'bg.n',add:R(1)} ],                                                                              // Bronze Wall
    lp_10_4:[ {on:'in',less:R(0.005),per:'wp'} ],                                                                     // Hurt Pride
    lp_11_1:[ {on:'given',do:[{window:'gs',dur:4}]}, {stat:{aspd:R(0.01)},if:{window:'gs'}} ],                        // Given Strength
    lp_11_2:[ {on:'in',do:[{fn:'atkBy'}]}, {on:'absorb',if:{fn:'lockedSrc'},do:[{stack:'load',add:{pct:1,of:'hit'}}]}, // Lock and Load: taunted enemies fill Load at double
              {param:'lnl',add:1} ],                                                                                  //   and the end of the taunt arms the next Load attack (lockEnd, loadHit)
    lp_11_3:[ {on:'in',if:{crit:true},less:R(0.02)} ],                                                                // Pit Courage
    lp_12_1:[ {param:'bg.str',add:R(0.03)} ],                                                                         // Burnished
    lp_12_2:[ {param:'load.ign',add:R(0.02)} ],                                                                       // Heavy Load (loadHit)
    lp_12_3:[ {param:'ten.sil3',add:R(0.1)} ],                                                                        // Stiff Neck
    lp_12_4:[ {param:'king',add:R(0.03)} ],                                                                           // King of the Sand (shScan)
    lp_13_2:[ {param:'crowd',add:1} ]                                                                                 // The Crowd Was His (SIGNATURE; loadHit)
  },
  fn:{
    own(A,T){ own(T.s); },
    shielded(A,T,u){ return (u.shield||0)>0; },
    bare(A,T,u){ return !((u.shield||0)>0); },
    brokeNow(A,T){ return T.s.brk!=null&&T.s.brk===A.eng().now(); },
    farO(A,T,u,c){ return isFar(c.o); },
    far(A,T){ return !!T.s.rbFar; },
    notFirst(A,T){ return (T.s.thN||0)>1; },
    lfull(A,T,u,c){ return !!c.lfull; },
    /* shorter controls on him: Unchained every control 4% per rank shorter (up to 20%); Hard Sand, Arena Grit and Stiff Neck silences 10% per rank shorter;
       all his talents together never make a silence more than 50% shorter. Iron Lungs works on a slow's strength (the weaken row), not its length. */
    ten(A,T,u,c){ let k=1-Math.min(0.20,T.P['ten.all']||0);
      if(c.field==='silencedT') k=Math.max(0.50,k*(1-(T.P['ten.sil']||0))*(1-(T.P['ten.sil2']||0))*(1-(T.P['ten.sil3']||0)));
      c.amt*=k; },
    /* ---- Cheers between waves: all but the ones Crowd Belongs to Him keeps are gone ---- */
    cheerEnd(A,T,u){ const n=A.stGet(T,'cheer'), keep=Math.min(n,Math.floor((T.P['cheer.keep']||0)+1e-9)); A.stSet(T,u,'cheer',keep); },
    /* ---- Wins: an enemy (a hero or a monster, not a summon) that dies within 4 m of him, body to body (Long Record: farther). Each enemy is a Win once ---- */
    win(A,T,u,x){ if(!x||x.team===u.team||x._summon||A.markOf(u,x,'won')) return false; A.setMark(T,u,x,'won',{}); A.acts(T,u,[{stack:'win',add:1}],{u,tgt:x,unit:x}); return true; },
    winDeath(A,T,u,c){ const x=c.unit, E=A.eng(); if(!x||x.team===u.team||!u.alive) return; if(!(A.gap(u,x)<((T.P['win.r']||0)+4)*E.METER())) return; T.fn.win(A,T,u,x); },
    /* Victory Lap: each kill of the Rampage is a Win (wherever it falls) and gives 15 ultimate energy (the ultimate has no cooldown: 3 s of it = 15 energy) */
    vlKill(A,T,u,c){ T.fn.win(A,T,u,c.tgt); u.energy=Math.min(100,(u.energy||0)+15); },
    /* ---- Bated Breath: when he drops below 40% HP, once per wave (Second Quiet: more times) ---- */
    bb(A,T,u,c){ const s=T.s; if(s.bbW!==s.wave){ s.bbW=s.wave; s.bbN=0; } if(s.bbN>=1+Math.floor((T.P['bb.n']||0)+1e-9)) return; s.bbN++;
      A.acts(T,u,[{window:'bb',dur:5+(T.P['bb.dur']||0)}],c); A.run(T,u,'bbStart',c); },
    /* He Stood Up Inside the Wheel: every enemy within 5 m taunted onto him for the 4 s, his Cheers full, and the 4 s window of his healing hits */
    stood(A,T,u,c){ A.acts(T,u,[{taunt:4,on:{team:'enemy',within:5}},{stack:'cheer',set:'max'},{window:'stood',dur:4}],c); },
    /* ---- A THROW (Rim Breaker). The press starts it: what this throw carries (Standing Ovation spent at the press, The Wheel Did Not Stop armed) ---- */
    newThrow(A,T,u,c){ const s=T.s; s.th=(s.th||0)+1; s.thN=0; s.thU=[]; s.ov=false; s.wds=!!s.wdsNext; s.wdsNext=false;
      if(T.P.ov&&A.stGet(T,'cheer')>=10){ A.stSet(T,u,'cheer',A.stGet(T,'cheer')-5); s.ov=true; } },
    wdsArm(A,T){ T.s.wdsNext=true; },
    /* each enemy it strikes: the count of this throw, and whether this one is the far target */
    rbKit(A,T,u,c){ const s=T.s; s.thN=(s.thN||0)+1; s.rbFar=isFar(c.o); },
    /* each strike that landed: who was struck this throw; a throw that strikes its path twice (Standing Ovation, the signature) strikes each one again
       for the same damage (a talent hit: the target's own reductions apply); the signature Rims every one */
    rbHit(A,T,u,c){ const s=T.s, t=c.tgt; if(!t) return; (s.thU||(s.thU=[])).push(t.uid);
      if(s.wds) A.setMark(T,u,t,'rim',{dur:4+(T.P['rim.dur']||0)});
      if((s.ov||s.wds)&&t.alive&&(c.amt||0)>0) A.hurt(T,u,t,c.amt,'#ffd08a','twice'); },
    /* its stun landed: lengthened in full after it lands (Bronze Reach on the far target, Standing Ovation 0.5 s, the signature 1.5 s), cut only at the
       ceiling without the 30% cut (4.0 s); then its end is an event (Dizzy Whirl) and, for the far target, Pin the Last's root */
    rbStun(A,T,u,c){ const s=T.s, t=c.tgt, E=A.eng(); if(!t||!t.alive) return;
      const x=(s.rbFar?(T.P['rb.far']||0):0)+(s.ov?0.5:0)+(s.wds?1.5:0), top=(E.ccCap('stunned')||2.8)/(E.ccDur(1)||1);
      if(x>0&&(t.stunned||0)>0) t.stunned=Math.max(t.stunned,Math.min(top,t.stunned+x));
      if(T.r.bw_11_4) A.acts(T,u,[{mark:'rbs',on:'target',dur:30,while:'stunned',ends:'rbEnd'}],c);
      if(T.r.bw_5_2&&s.rbFar) A.acts(T,u,[{mark:'rbf',on:'target',dur:30,while:'stunned',ends:'pinGo'}],c); },
    /* The Forty-Second: Rim Breaker killed: the wheel flies on to the enemy farthest from him within 6 m of the fallen one (body to body) that this throw has
       not struck, and strikes it for the killing strike's damage. Once per throw */
    f42(A,T,u,c){ const s=T.s, d=c.tgt, E=A.eng(); if(!d||s.f42===s.th) return; s.f42=s.th; const U=s.thU||[];
      let best=null, bd=-1; for(const x of foes(A,T,u)){ if(x===d||U.indexOf(x.uid)>=0||!(A.gap(d,x)<6*E.METER())) continue; const k=E.dist(u,x); if(k>bd){ bd=k; best=x; } }
      if(best){ U.push(best.uid); A.hurt(T,u,best,c.amt||0,'#ffd08a','f42'); } },
    /* ---- ARENA LOCK. Who it taunted (every enemy whose forced target is now him); Thunderous lengthens their taunt; the window 'lock' is the taunt's time.
       Ring of Bronze: an enemy already Rimmed is silenced 1 s, then every one is Rimmed. Bronze Guard: a shield of 1.5% of his max HP per rank for each
       one taunted, up to 4 (Bronze Wall: 7), for 4 s (Raised Rim: longer), Burnished stronger ---- */
    lockCast(A,T,u,c){ const s=T.s, L=[], th=T.P['lock.taunt']||0; for(const x of foes(A,T,u)) if(x.forcedTarget===u&&(x.forcedTargetT||0)>0) L.push(x);
      for(const x of L){ if(th>0) x.forcedTargetT+=th; A.setMark(T,u,x,'locked',{dur:x.forcedTargetT}); }
      s.lockL=L; A.acts(T,u,[{window:'lock',dur:((c.o&&c.o.dur)||3.5)+th}],c);
      if(T.P.ring) for(const x of L){ if(A.markOf(u,x,'rim')) A.control(T,u,x,'silencedT',1); A.setMark(T,u,x,'rim',{dur:4+(T.P['rim.dur']||0)}); }
      if(T.P.bg){ const n=Math.min(4+Math.floor((T.P['bg.n']||0)+1e-9),L.length), d=4+(T.P['bg.dur']||0); if(n>0){
        A.acts(T,u,[{shield:{pct:T.P.bg*(1+(T.P['bg.str']||0))*n,of:'maxHp'},dur:d,emit:'ownSh'},{window:'bg',dur:d}],c); } } },
    /* its taunt ended: Spare Them (each enemy it taunted, alive, stunned 0.5 s; he heals 2% + Thumbs Up for each); Lock and Load arms his next Load attack */
    lockEnd(A,T,u,c){ const s=T.s, L=(s.lockL||[]).filter(x=>x.alive); s.lockL=[];
      if(T.r.cc_5_3&&L.length){ for(const x of L) A.control(T,u,x,'stunned',0.5); A.acts(T,u,[{heal:{pct:(T.P['spare.h']||0)*L.length,of:'maxHp'}}],c); }
      if(T.P.lnl){ s.lnl=L; } },
    /* Lock and Load: the enemy hitting him now (the 'in' row runs right before damage() and its shield) */
    atkBy(A,T,u,c){ T.s.hitBy=c.src; T.s.hitAt=A.eng().now(); },
    lockedSrc(A,T,u){ const s=T.s, x=s.hitBy; return !!x&&s.hitAt===A.eng().now()&&!!A.markOf(u,x,'locked'); },
    /* ---- THE LOAD ATTACK: his next basic attack on an enemy while he holds Load (Store It All: Rim Breaker's first strike of a throw instead, at double).
       It adds 10% of the Load per rank (Loaded Swing) as extra damage, through the target's armor, and empties it. Heavy Load: the whole hit ignores 2% per rank
       of the armor. Spread the Weight: the extra also lands on every enemy within 2 m of the target. Lock and Load (armed by the end of the taunt): on every
       enemy it taunted. Guarded Strike heals 5% of the extra per rank; Proud Lion refreshes Pride's Momentum. The Crowd Was His: a FULL Load (once every 15 s)
       also strikes every enemy within 3 m of him for the whole Load, stuns them 1 s and gives him a shield of twice the Load ---- */
    loadHit(A,T,u,c){ const s=T.s, E=A.eng(), t=c.tgt; if(!t||t.team===u.team) return;
      const rb=!!T.P['load.rb'], viaRb=rb&&s.cur==='knockstun'&&s.thL!==(s.th||0); if(rb?!viaRb:!c.auto) return;
      const n=A.stGet(T,'load'); if(!(n>0)) return; if(rb) s.thL=s.th||0; const full=n>=A.stMax(T,u,'load')-1e-9; c.lfull=full;
      const k=(T.P['load.k']||0)*(rb?2:1), ign=Math.min(1,T.P['load.ign']||0), ph=c.kind==='phys';
      let dm=1; if(ph||c.kind==='magic'){ const a0=E.defMul(u,t,c.kind); let a1=a0; if(ph&&ign>0){ const sv=u._wpnArmIgn; u._wpnArmIgn=1-(1-(sv||0))*(1-ign); a1=E.defMul(u,t,'phys'); u._wpnArmIgn=sv; if(a0>0) c.amt*=a1/a0; } dm=a1; }
      const ex=n*k; c.amt+=ex*dm; A.stSet(T,u,'load',0);
      const hitAll=xs=>{ for(const x of xs) if(x&&x.alive&&x!==t&&ex>0) A.hurt(T,u,x,ex*((ph||c.kind==='magic')?E.defMul(u,x,c.kind):1),'#e0b050','load'); };
      if(T.P['spread.r']) hitAll(A.pick(T,u,{team:'enemy',of:'target',within:T.P['spread.r'],skip:'target'},c));
      if(s.lnl){ const L=s.lnl; s.lnl=null; hitAll(L); }
      if(T.P['load.heal']&&ex>0) A.acts(T,u,[{heal:ex*dm*T.P['load.heal']}],c);
      if(T.P['pm.dur']&&u.pass&&u.pass.pridemomentum&&u.dmgBuffT>0) T.fn.pmOn(A,T,u);
      if(full&&T.P.crowd) A.acts(T,u,[{window:'crowdCd',dur:0.01,cd:15},{fn:'crowd',n}],c);
      A.run(T,u,'loadAtk',Object.assign({},c,{spent:ex})); },
    crowd(A,T,u,c,a){ const E=A.eng(), n=a.n||0; for(const x of A.pick(T,u,{team:'enemy',within:3},c)){ A.hurt(T,u,x,n*E.defMul(u,x,'phys'),'#e0b050','crowd'); if(x.alive) A.control(T,u,x,'stunned',1); }
      A.acts(T,u,[{shield:2*n,dur:4,emit:'ownSh'}],c); },
    /* ---- Pride's Momentum as his talents change it: Pride Goes First makes its bonus 1 point per rank larger (22% -> 27%); Proud Lion makes it last 3 s
       longer (4 -> 7 s) and each Load attack refreshes it. Runs where the passive itself runs: a hit on him while he holds a shield ---- */
    pmOn(A,T,u){ const v=1+0.22*(u.passMul||1)+(T.P['pm.more']||0); u.dmgBuffMul=Math.max((u.dmgBuffT>0)?(u.dmgBuffMul||1):1,v); u.dmgBuffT=Math.max(u.dmgBuffT||0,4+(T.P['pm.dur']||0)); },
    pm(A,T,u){ if(u.pass&&u.pass.pridemomentum) T.fn.pmOn(A,T,u); },
    /* ---- his shield, each tick: a shield he gained since the last tick (what it holds now, against what it held minus what hits took off it). Bronze Plate and
       King of the Sand make the new part stronger; then 'shielded' (any) and 'given' (not one of his own talents' shields: an ally's, gear, anything else) ---- */
    shScan(A,T,u){ const s=T.s, now=u.shield||0, prev=s.shP==null?now:s.shP, g=now-(prev-(s.shA||0)), ownW=!!s.ownW; s.shA=0; s.ownW=false;
      if(g>1e-9*Math.max(1,u.maxHp||1)&&now>0){ const b=(T.P['sh.str']||0)+((u.hp<0.5*u.maxHp)?(T.P.king||0):0); if(b>0) u.shield+=g*b;
        const c={u,tgt:u,unit:u,amt:g*(1+b)}; A.run(T,u,'shielded',c); if(!ownW) A.run(T,u,'given',c); }
      s.shP=u.shield||0; }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/17 - BRANNUS - talent decisions.md) */
  ruling:{}
};
