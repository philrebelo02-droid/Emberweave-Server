/* TICK - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Tick": what he added)
   His real kit (the code, not the card wording; damage profile Attack: his basic attacks, Mainspring's punches and Flywheel are all PHYSICAL - none of them
   names a kind, so they take the profile's default; a melee Bruiser of the middle row; tests/tick-kit-facts.js measures it):
   - Overclock ('haste', green, cd 8, self): HIS attack speed x 1.35 + 0.002 a level (x1.548 at 100) for 5 s (the haste fields and the _ocT marker the
     Momentum line reads). The game takes the LARGER of it and Momentum Gears, so once Momentum passes +54.8% (about 22 s into a fight, and Momentum is never
     reset between waves) Overclock adds no attack speed at all. Inside the skill: casting 'haste'.
   - Mainspring ('punchflurry', blue, cd 7): five punches at once on his target (the instant path: Tick's kit has no hitTimes), each 36% of his attack x skill
     level; each punch also draws the taunt roll (tauntChance 0: it never taunts). Inside the skill: casting 'punchflurry'.
   - Flywheel (the ultimate 'flywheel', energy, no cooldown): every enemy whose CENTRE is within 3 m of his centre takes 160% of his attack x skill level. His
     body is 1.74 m, an enemy's 1.6 to 2 m: an enemy touching him stands about 3.4 m away, so it struck nobody in 64 of 64 casts (the 14 Nov reach audit;
     release v1391 on another branch measures it to the body edge). Not changed here: his talents build on its hits, the tests put enemies inside 3 m of his
     centre (reached before and after the fix). Inside the skill: casting 'flywheel'.
   - Momentum Gears (passive 'momentum'): u._momStk grows 0.025 a second from the fight's start to +50% + 0.25 points a passive level (+74.75% at 100), never
     reset between waves; his attack speed is 1 + it (or Overclock's, the larger). The cap at his level is bound as momCap (Meridian's line).
   Chimes, Static, Wind, Strain, Strokes and Hours, and Spin exist only through his talents. All his per-fight state is in T.s.tk; every state name starts with tk.
   NO absolute fight time is kept anywhere here (the battle clock restarts at 0 each wave): every timer counts down (or up) by the tick's dt.
   Readings, caps and corrected tooltips: WIRING/57 - TICK - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const OC='haste', MS='punchflurry', FW='flywheel';
const DR_CAP=0.30, CRIT_CAP=0.05, SLOW_CAP=0.30, TEN_CAP=0.20, REGEN=0.012, BANK=5, OC_FLOOR=5, MS_FLOOR=4, SIG_CD=25, SIG2_SR=6, STROKES=10, HOURS=12, STUN_TOP=4.0, LOCK=0.5;
/* which talents read each family: its bookkeeping rows are attached only when one of them is learned */
const CH=['sq_1_1','sq_2_1','sq_3_1','sq_6_1','sq_7_1','sq_6_4','sq_10_1','sq_11_1','sq_12_1','sq_13_2'];                         // Chimes
const ST=['sq_1_2','sq_2_2','sq_4_2','sq_5_2','sq_5_3','sq_6_2','sq_6_3','sq_9_4','sq_10_2','sq_9_2','sq_11_2','sq_12_2','sq_13_2'];   // Static
const WD=['kb_1_4','kb_2_4','kb_3_4','kb_5_2','kb_5_3','kb_6_2','kb_7_4','kb_10_4','kb_11_4','kb_13_3','bw_n1'];                  // Wind
const SR=['kb_1_1','kb_3_1','kb_5_1','kb_5_2','kb_6_1','kb_11_3','kb_12_3','kb_13_3','bw_n1'];                                    // Strain
const HR=['bw_1_4','bw_2_4','bw_3_4','bw_n1','bw_6_4','bw_7_4','bw_10_4','bw_11_3','bw_11_4','bw_12_3','bw_12_4','bw_13_3'];       // Strokes and Hours
const SP=['bw_1_3','bw_2_3','bw_7_1','bw_5_2','bw_5_3','bw_6_2','bw_9_1','bw_10_3','bw_11_1'];                                    // Spin
const OCW=['sq_10_3','sq_11_4','kb_1_1','kb_2_3','kb_4_3','kb_5_3','kb_7_1','kb_9_2','kb_9_4','kb_10_1','kb_12_1','bw_6_1','kb_13_3'];   // talents that read "during Overclock" / its end
const MOM=['sq_3_4','bw_3_1','bw_3_2','bw_3_4','kb_8_2','bw_8_4','bw_9_3','kb_13_3'];                                             // Momentum Gears
const DRG=['sq_9_3','sq_5_1','bw_1_1','bw_1_4','bw_5_1','bw_6_3','kb_9_2','bw_12_2'];                                             // his damage reduction: ONE capped group
const CRIT=['sq_2_1','sq_8_2','kb_6_3','kb_5_1','bw_12_4','kb_12_2'];                                                             // his critical-chance talents: ONE capped group (5%)
const TEN=['bw_4_4','kb_12_1','bw_9_3','bw_13_3'];                                                                                // controls on him (shorter, weaker, none)
const HEAL=['sq_6_1','bw_8_3','bw_11_3','kb_11_4'];                                                                               // healing each second: one budget (the regeneration cap)
const CDS=['sq_8_3','kb_11_2','kb_4_2','sq_3_1','kb_11_3'];                                                                       // cooldowns (with their floors)
const FWK=['kb_10_3','bw_4_3','bw_11_4','kb_11_3','kb_12_3'];                                                                     // Flywheel's options at the cast
const ME=['kb_9_1','bw_10_3'];                                                                                                    // a stun / slow on him seen on his tick
/* ---- small readers (the 95% instrument calls drK from a test with the API kept on T.s) ---- */
const rk=(T,id)=>T.r[id]||0;
const any=(T,L)=>{ for(let i=0;i<L.length;i++) if(T.r[L[i]]) return true; return false; };
const K=T=>T.s.tk||(T.s.tk={e:{},bud:0,wt:0,ic:false,auto:0,chP:false,chN:0,chA:0,wind:0,wT:1.5,strain:0,sT:2,oc:0,kick:0,snap:0,snapQ:0,gs:0,spin:0,strokes:0,hours:0,tb:0,es:0,
  cs:0,rb:0,bE:99,gE:99,fwN:0,fwS:0,mx:0,sig2:0,s2:0,s2m:null,crash:0,sig3:0,s3h:0,pst:0,psl:0,swL:null,api:null,ts:{n:0,onStun:0,lk:0,cut:0},runMax:0,dis:0,head:0});
const rec=(T,t)=>{ const e=K(T).e; let r=e[t.uid]; if(!r||r.u!==t){ r=e[t.uid]={u:t,st:0,ra:0,sn:0,re:0,lk:0,cap:0}; } return r; };
const recOf=(T,t)=>{ const r=t&&K(T).e[t.uid]; return (r&&r.u===t)?r:null; };
const stOf=(T,t)=>{ const r=recOf(T,t); return (r&&t.alive)?r.st:0; };
const stMax=T=>T.r.sq_5_3?10:5;                                        // Static holds 5 (Long Fuse: 10)
const stAt=T=>T.r.sq_5_2?3:stMax(T);                                    // it discharges at 5 (Short Circuit: 3; Long Fuse: 10)
const atk=(A,u)=>(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*A.eng().rage();
const capOf=(A,u)=>{ const E=A.eng(); return E.momCap?E.momCap(u):0.5; };
const full=(A,u)=>!!(u.pass&&u.pass.momentum)&&(u._momStk||0)>=capOf(A,u)-1e-9;
const half=(A,u)=>!!(u.pass&&u.pass.momentum)&&(u._momStk||0)>=0.5*capOf(A,u)-1e-9;
const foes=(A,u)=>{ for(const x of A.eng().units()) if(x.alive&&x.team!==u.team) return true; return false; };
module.exports={
  hero:'tick',
  casting:true,                         // rows ask which of his skills a hit comes from (Mainspring's punches, Flywheel)
  states:{},
  /* run for him whenever he has any mechanic talent (each row only when a talent of its family is learned): the bookkeeping of his families and his capped groups */
  always:[
    {on:'wave',do:[{fn:'waveStart'}]},                                                                                          // a new wave: the last wave's enemies dropped; Spin; Wind Reserve; the head start
    {on:'tick',do:[{fn:'step'}]},                                                                                                // every timer of his counts down here (never an absolute fight time)
    {on:'crit',reqAny:CH.concat(CRIT),if:{targetTeam:'enemy'},do:[{fn:'crit'}]},                                                // is this basic attack a Chime; the crit group's own roll
    {stat:{crit:1},reqAny:CRIT,per:{fn:'critS'}},                                                                               //   (the crit group's part that holds on every hit is a stat)
    {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'myHit'}]},                                                                        // every hit of his that lands: Chimes, Static, Strain, Strokes, Spin, Flywheel's count
    {on:'hurt',reqAny:HR,if:{srcTeam:'enemy'},do:[{fn:'struck'}]},                                                               // Strokes: every enemy hit that lands on him
    {on:'kit',skill:OC,do:[{fn:'ocKit'}]}, {on:'cast',skill:OC,do:[{fn:'ocCast'}]},                                             // Overclock: longer; its window, Wind, Kick of the Spring
    {on:'kit',skill:MS,do:[{fn:'msKit'}]}, {on:'cast',skill:MS,do:[{fn:'msCast'}]},                                             // Mainspring: Past the Stop's punches; Snap the Spring spent
    {on:'kit',skill:FW,do:[{fn:'fwKit'}]}, {on:'cast',skill:FW,do:[{fn:'fwCast'}]},                                             // Flywheel: its reach, Wheel Overwound; Last Turn, Spun Down, Rhythm of Blows
    {on:'cd',reqAny:CDS,do:[{fn:'cdSet'}]},                                                                                     // his cooldown talents, with their floors
    {on:'in',reqAny:DRG.concat(['kb_1_1']),do:[{fn:'myIn'}]},                                                                   // his damage-reduction talents: ONE capped group (drK); Strain's cost
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                                      // controls on him shorter (20% at most); none while the signatures say so
    {on:'lethal',reqAny:['bw_13_3'],once:'fight',do:[{undying:4},{fn:'idnm'}]}                                                   // It Does Not Mind (SIGNATURE): once per fight
  ],
  talents:{
    /* ============================== STRIKE THE QUARTERS ============================== */
    sq_1_1:[ {param:'ch.more',add:R(0.08)}, {on:'out',if:{fn:'chimeNow'},more:P('ch.more')} ],                                   // Quarter Bell: Chimes (crit / myHit)
    sq_1_2:[ {param:'st.dmg',add:R(0.06)} ],                                                                                      // Static in the Gears (myHit -> discharge)
    sq_5_4:[ {stat:{move:R(0.03)}} ],                                                                                             // Quick Escapement
    sq_2_1:[ {param:'cr.chime',add:R(0.015)} ],                                                                                   // Ring True (crit group)
    sq_2_2:[ {param:'st.jump',add:R(0.20)} ],                                                                                     // Charged Brass (discharge)
    sq_3_1:[ {param:'dd',add:1} ],                                                                                                // Dawn and Dusk (chime)
    sq_4_2:[ {on:'out',if:{targetTeam:'enemy',fn:'hasSt'},more:R(0.005),per:{fn:'stN'}} ],                                      // Charged Casing (Live Wire)
    sq_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                                    // Bell-Metal Fists
    sq_3_4:[ {on:'out',if:{targetTeam:'enemy',fn:'momHalf'},more:R(0.02)} ],                                                     // True Running
    sq_5_1:[ {param:'dr.mag',add:R(0.015)} ],                                                                                     // Verdigris Coat (in drK)
    sq_5_2:[ {param:'sc',add:1} ],                                                                                                // Short Circuit (PICK ONE: stAt)
    sq_5_3:[ {param:'lf',add:1} ],                                                                                                // Long Fuse (PICK ONE: stMax, discharge)
    sq_4_3:[ {on:'out',if:{casting:MS},more:R(0.05)} ],                                                                          // Rapid Quarters
    sq_6_1:[ {param:'ch.heal',add:R(0.01)} ],                                                                                     // Every Quarter (chime: heal budget)
    sq_6_2:[ {param:'st.more',add:R(0.03)} ],                                                                                     // Lightning Gears (discharge)
    sq_6_3:[ {stat:{move:R(-0.01)},to:{team:'enemy',fn:'hasSt'},per:{fn:'stN'}} ],                                               // Heavy Static (Slow Burn)
    sq_7_1:[ {param:'hour',add:1} ],                                                                                              // The Hour (chime)
    sq_8_3:[ {param:'cd.ms',add:R(0.3)} ],                                                                                        // Oiled Joints (cdSet)
    sq_7_4:[ {on:'out',if:{casting:FW},more:R(0.03)} ],                                                                          // Flywheel Teeth
    sq_6_4:[ {param:'rh',add:R(0.04)}, {stat:{aspd:R(-0.04)},to:{team:'enemy',fn:'rhOn'}} ],                                     // Ringing Head (2 s from chime)
    sq_8_2:[ {param:'cr.punch',add:R(0.01)} ],                                                                                    // Storm Coil (crit group)
    sq_9_4:[ {on:'hit',if:{casting:FW,targetTeam:'enemy'},chance:R(0.2),do:[{fn:'spinStatic'}]} ],                               // Charged Spin
    sq_10_2:[ {param:'st.sh',add:R(0.015)} ],                                                                                     // Grounding Rod (Earthed: discharge)
    sq_9_2:[ {param:'tf',add:1} ],                                                                                                // Thunder Flurry (myHit)
    sq_9_3:[ {param:'dr.all',add:R(0.01)} ],                                                                                      // Riveted Shell (in drK)
    sq_10_3:[ {param:'oc.dur',add:R(0.3)} ],                                                                                      // Overwound Coil (ocKit)
    sq_10_1:[ {stat:{aspd:R(0.01)},if:{fn:'csOn'}} ],                                                                            // Count the Strokes (4 s from chime)
    sq_11_1:[ {param:'tb',add:1} ],                                                                                               // Three Bells (crit: every 3rd)
    sq_11_2:[ {stat:{atk:R(0.005)},per:{fn:'gsN'}} ],                                                                            // Storm in the Tower (Gathering Storm: discharge counts)
    sq_11_4:[ {stat:{aspd:R(0.02)},if:{fn:'ocOn'}} ],                                                                            // Bright Runs
    sq_12_1:[ {on:'out',if:{fn:'chimeNow'},critMore:R(0.03)} ],                                                                  // Echo in the Tower
    sq_12_2:[ {param:'st.air',add:R(0.04)} ],                                                                                     // Tower Lightning (Charged Air: discharge)
    sq_12_4:[ {on:'out',if:{casting:FW,targetHpBelow:0.30},more:R(0.08)} ],                                                      // Final Quarter
    sq_13_2:[ {param:'sth',add:1} ],                                                                                              // Strike the Hour (SIGNATURE: chime)
    /* ============================== THE KEY IN THE BACK ============================== */
    kb_1_1:[ {stat:{aspd:R(0.01)},per:{fn:'srN'}} ],                                                                             // Something Wrong: Strain (myHit, step; its cost in myIn)
    kb_2_2:[ {stat:{move:R(0.03)}} ],                                                                                             // Quick Step
    kb_1_4:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.004),per:{fn:'wdN'}} ],                                                  // Turn the Key: Wind (ocCast, step)
    kb_2_3:[ {stat:{aspd:R(0.03)},if:{fn:'ocOn'}} ],                                                                             // Racing Heart
    kb_2_4:[ {param:'wd.oc',add:R(1)} ],                                                                                          // Extra Turns (Tight Spring: ocCast)
    kb_3_1:[ {param:'sr.hold',add:R(0.0008)} ],                                                                                   // Hold Together (myIn)
    kb_3_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                                    // Filed Cogs
    kb_3_4:[ {param:'pts',add:1} ],                                                                                               // Past the Stop (msKit)
    kb_4_2:[ {param:'cd.oc',add:R(0.3)} ],                                                                                        // Short Rest (cdSet)
    kb_4_3:[ {param:'oc.dur',add:R(0.3)} ],                                                                                       // Hot Gears (Running Hot: ocKit)
    kb_4_4:[ {on:'out',if:{casting:MS},more:R(0.03)} ],                                                                          // Rapid Gears
    kb_5_1:[ {param:'cr.strain',add:R(0.001)} ],                                                                                  // Overrun (crit group)
    kb_5_2:[ {param:'lird',add:1} ],                                                                                              // Let It Run Down (PICK ONE: step, myIn)
    kb_5_3:[ {param:'snap',add:1}, {on:'out',if:{casting:MS,fn:'snapOn'},more:0.02,per:{fn:'snapN'}} ],                          // Snap the Spring (PICK ONE: ocEnd, msCast)
    kb_6_4:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                                           // Fast Fists
    kb_6_1:[ {on:'out',if:{auto:true,fn:'srFull'},more:R(0.06)} ],                                                               // Hot Bearings
    kb_6_2:[ {stat:{move:R(0.03)},if:{fn:'wd5'}} ],                                                                              // Wound Up
    kb_6_3:[ {param:'cr.punch',add:R(0.01)} ],                                                                                    // Punch Clock (crit group)
    kb_7_1:[ {stat:{lifesteal:R(0.02)},if:{fn:'ocOn'}} ],                                                                        // Runaway
    kb_8_2:[ {param:'ramp',add:R(0.10)} ],                                                                                        // Second Hand (step)
    kb_7_4:[ {param:'wd.res',add:R(2)} ],                                                                                         // Wind Reserve (waveStart)
    kb_8_4:[ {on:'out',if:{casting:FW},more:R(0.03)} ],                                                                          // Gear Teeth
    kb_9_1:[ {param:'fw',add:1} ],                                                                                                // Feels Wrong (step)
    kb_9_2:[ {param:'dr.oc',add:R(0.01)} ],                                                                                       // Shock Absorber (in drK)
    kb_9_4:[ {on:'out',if:{auto:true,fn:'kickOn'},more:R(0.05)} ],                                                               // Kick of the Spring (ocCast arms it, myHit spends it)
    kb_10_1:[ {stat:{move:R(0.02)},if:{fn:'ocOn'}} ],                                                                            // Thrum
    kb_10_4:[ {stat:{aspd:R(0.003)},per:{fn:'wdN'}} ],                                                                           // Overcharged
    kb_11_2:[ {param:'cd.ms',add:R(0.15)} ],                                                                                      // Ticking Over (cdSet)
    kb_11_3:[ {param:'wo',add:1}, {on:'out',if:{casting:FW,fn:'woOn'},more:0.03,per:{fn:'woN'}} ],                               // Wheel Overwound (fwKit spends the Strain)
    kb_11_4:[ {param:'ss',add:R(0.01)} ],                                                                                         // Spent Spring (setWind: heal budget)
    kb_12_1:[ {param:'gb',add:R(0.15)} ],                                                                                         // Gone in a Blur (step: slowW)
    kb_10_3:[ {param:'fw.r',add:R(0.1)} ],                                                                                        // Whirring (fwKit)
    kb_12_3:[ {param:'sd',add:R(0.003)} ],                                                                                        // Spun Down (fwKit)
    kb_12_4:[ {stat:{aspd:R(0.04)},if:{selfHpBelow:0.30}} ],                                                                     // Near the Snap (Breaking Point)
    kb_13_3:[ {param:'sig2',add:1} ],                                                                                             // Only the Clockmaker (SIGNATURE: step)
    /* ============================== BUILT TO WAIT ============================== */
    bw_1_1:[ {param:'dr.ff',add:R(0.012)} ],                                                                                      // Faithful Frame (in drK)
    bw_1_3:[ {stat:{armor:R(0.003)},per:{fn:'spN'}} ],                                                                           // Great Wheel: Spin (myHit, waveStart)
    bw_1_4:[ {param:'dr.hr',add:R(0.003)} ],                                                                                      // Count Them: Strokes and Hours (in drK)
    bw_2_3:[ {stat:{mr:R(0.003)},per:{fn:'spN'}} ],                                                                              // Balance Wheel
    bw_2_4:[ {stat:{atk:R(0.003)},per:{fn:'hrN'}} ],                                                                             // Patient Strokes (Patient Hands)
    bw_3_1:[ {param:'head',add:R(0.10)} ],                                                                                        // Never Told to Stop (waveStart: the head start)
    bw_3_2:[ {stat:{atk:R(0.02)},if:{fn:'momFull'}} ],                                                                           // Heavy Gears
    bw_3_4:[ {param:'ttc',add:0.02}, {stat:{aspd:1},per:{fn:'ttcX'}} ],                                                          // Through Three Cities (step ramps the extra)
    bw_n1:[ {param:'wbh',add:1} ],                                                                                                // Wound by the Hour (LINK: hour)
    bw_4_2:[ {on:'out',if:{casting:FW},more:R(0.05)} ],                                                                          // Steady Swing
    bw_4_3:[ {param:'fw.r',add:R(0.15)} ],                                                                                        // Wider Wheel (fwKit)
    bw_4_4:[ {param:'ten',add:R(0.04)} ],                                                                                         // Measured Pace (Unhurried: ten)
    bw_5_1:[ {param:'dr.sts',add:R(0.03)} ],                                                                                      // Slow to Start (in drK)
    bw_6_3:[ {param:'dr.crit',add:R(0.03)} ],                                                                                     // Brass Ribs (Iron Ribs: in drK)
    bw_6_4:[ {param:'sh',add:R(1)} ],                                                                                             // Struck Hours (myHit)
    bw_6_1:[ {param:'oc.dur',add:R(0.5)} ],                                                                                       // Wound Once (ocKit)
    bw_7_2:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                                           // Deep Movement
    bw_7_1:[ {stat:{lifesteal:R(0.002)},per:{fn:'spN'}} ],                                                                       // Turning Guard (Spinning Guard)
    bw_8_4:[ {param:'ramp',add:R(0.08)} ],                                                                                        // Keeping Time (step)
    bw_7_4:[ {param:'thm',add:1} ],                                                                                               // The Hour Mark (hour)
    bw_5_2:[ {param:'war',add:0.005} ],                                                                                           // Wheel at Rest (PICK ONE: addSpin)
    bw_5_3:[ {param:'kt',add:1} ],                                                                                                // Keep Turning (PICK ONE: waveStart)
    bw_8_3:[ {param:'wc',add:R(0.003)} ],                                                                                         // Weights and Chains (step: heal budget)
    bw_8_2:[ {on:'out',if:{casting:MS},more:R(0.03)} ],                                                                          // Grinding Gears
    bw_6_2:[ {param:'war',add:R(0.002)} ],                                                                                        // Oil and Rest (addSpin)
    bw_9_3:[ {param:'nots',add:1} ],                                                                                              // No One to Stop It (step, ten)
    bw_9_1:[ {on:'out',if:{targetTeam:'enemy',fn:'sp10'},more:R(0.02)} ],                                                        // Spun Steel
    bw_10_2:[ {stat:{aspd:R(0.03)},if:{fn:'rbOn'}} ],                                                                            // Rhythm of Blows (fwCast)
    bw_10_3:[ {param:'rat',add:R(1)} ],                                                                                           // Ratchet (step)
    bw_10_4:[ {stat:{hp:R(0.002)},per:{fn:'hrN'}} ],                                                                             // Count of Hours (Long Count)
    bw_11_1:[ {on:'out',if:{casting:FW,fn:'spAny'},more:R(0.004),per:{fn:'spN'}} ],                                              // Ringing Wheel
    bw_11_3:[ {param:'tbh',add:R(0.004)} ],                                                                                       // Turned by Hand (addStrokes: heal budget)
    bw_11_4:[ {param:'twb',add:1} ],                                                                                              // Twelve Bells (fwKit, myHit)
    bw_12_1:[ {param:'lt',add:R(0.01)} ],                                                                                         // Last Turn (fwCast)
    bw_12_2:[ {param:'dr.wf',add:R(0.01)} ],                                                                                      // Weathered Face (in drK)
    bw_12_3:[ {param:'es',add:R(1)} ],                                                                                            // Every Second (step)
    bw_12_4:[ {param:'cr.dusk',add:R(0.015)} ],                                                                                   // Dusk Bell (crit group)
    bw_13_3:[ {param:'sig3',add:1} ],                                                                                             // It Does Not Mind (SIGNATURE: the lethal row, idnm)
    /* ---- the crit-chance talent that was a plain stat: inside the 5% group now ---- */
    kb_12_2:[ {param:'cr.all',add:R(0.01)} ]                                                                                      // Ticking Heart (Clockwork Heart: crit group)
  },
  fn:{
    /* ---- A NEW WAVE: the last wave's enemies are gone (their records dropped); the wave's own clock; Spin back to 0 (Keep Turning: kept); Wind Reserve; at the
       fight's first wave Never Told to Stop's head start. The API kept on T.s for the 95% instrument ---- */
    waveStart(A,T,u){ const k=K(T), P=T.P; k.api=A; T.s.api=A; k.e={}; k.wt=0; k.chP=false;
      if(any(T,SP)&&!P.kt) k.spin=0;
      if(P['wd.res']) T.fn.setWind(A,T,u,Math.max(k.wind,Math.min(10,P['wd.res'])));
      if(P.head&&!k.head&&u.pass&&u.pass.momentum){ k.head=1; const c=capOf(A,u); u._momStk=Math.max(u._momStk||0,Math.min(c,c*P.head)); } },
    /* ---- EVERY TIMER, ONCE A TICK (countdowns only): the wave's clock, the healing budget, Overclock's window (its end), Wind and Strain running down, the
       short windows, the cooldowns' clocks for the floors, Momentum's extra ramp (Second Hand, Keeping Time) and Through Three Cities' extra, a stun or slow
       newly on him (Feels Wrong, Ratchet), slows weaker (Gone in a Blur) or none (No One to Stop It), the signatures; his per-enemy records ---- */
    step(A,T,u,c){ const k=K(T), dt=c.dt||0, P=T.P, E=A.eng();
      k.wt+=dt; k.ic=foes(A,u); k.bE+=dt; k.gE+=dt;
      if(any(T,HEAL)) k.bud=Math.min(BANK*REGEN*u.maxHp,(k.bud||0)+REGEN*u.maxHp*dt);
      if(k.sig3>0){ u.stunned=0; k.s3h+=dt; if(k.s3h>=1-1e-9){ k.s3h-=1; T.fn.addHour(A,T,u); } }   // It Does Not Mind's 4 s: an Hour each second (the 4th on its last tick)
      for(const f of ['cs','rb','kick','sig2','s2','crash','sig3']) if(k[f]>0) k[f]=Math.max(0,k[f]-dt);
      if(k.oc>0){ k.oc-=dt; if(k.oc<=1e-9){ k.oc=0; T.fn.ocEnd(A,T,u); } }
      if(k.wind>0){ k.wT-=dt*(P.lird?0.5:1); if(k.wT<=1e-9){ k.wT=1.5; T.fn.setWind(A,T,u,k.wind-1); } }
      if(k.strain>0&&!(k.oc>0)){ k.sT-=dt; if(k.sT<=1e-9){ k.sT=2; k.strain=Math.max(0,k.strain-1); } }
      /* Momentum Gears: ramps faster; the signature holds it full; Through Three Cities' extra above the cap */
      if(u.pass&&u.pass.momentum){ const cap=capOf(A,u), m=u._momStk||0, rate=0.025*dt*(1+(P.ramp||0));
        if(P.ramp&&m<cap) u._momStk=Math.min(cap,m+0.025*dt*P.ramp);
        if(k.sig2>0) u._momStk=cap;
        if(P.ttc&&(u._momStk||0)>=cap-1e-9) k.mx=Math.min(P.ttc*k.hours,k.mx+rate); }
      if(k.s2m!=null&&!(k.sig2>0)) T.fn.sig2End(A,T,u);
      if(P.es&&k.ic){ k.es+=dt; if(k.es>=3-1e-9){ k.es-=3; T.fn.addStrokes(A,T,u,P.es); } }
      if(P.wc&&k.ic){ k.wcT=(k.wcT||0)+dt; if(k.wcT>=3-1e-9){ k.wcT-=3; T.fn.heal(A,T,u,P.wc*u.maxHp*((P.nots&&full(A,u))?2:1)); } }
      /* a stun or a slow newly on him (whoever wrote it) */
      const st=u.stunned||0, sl=u.slow||0;
      if(st>k.pst+1e-9){ if(P.rat) for(let i=0;i<P.rat;i++) T.fn.addSpin(A,T,u); if(P.fw) T.fn.feelsWrong(A,T,u); }
      else if(sl>k.psl+1e-9&&P.fw) T.fn.feelsWrong(A,T,u);
      if(P.nots&&full(A,u)&&!(k.crash>0)&&(u.slow||0)>0) u.slow=0;
      if(P.gb) T.fn.slowW(A,T,u);
      k.pst=u.stunned||0; k.psl=u.slow||0;
      if(P.sig2&&!(k.s2>0)&&!(k.sig2>0)&&k.wind>=10-1e-9&&k.strain>=SIG2_SR-1e-9&&u.alive) T.fn.clockmaker(A,T,u);
      /* his per-enemy records: Ringing Head's 2 s, Twelve Bells' stuns (his run on one enemy, the 0.5 s lock after it) */
      const e=k.e; for(const id in e){ const r=e[id], t=r.u; if(!t.alive){ delete e[id]; continue; }
        if(r.ra>0) r.ra=Math.max(0,r.ra-dt); if(r.cap>0) r.cap=Math.max(0,r.cap-dt);
        if(r.sn>0){ r.re+=dt; r.sn=((t.stunned||0)>0)?Math.min(r.sn-dt,t.stunned):0; if(r.sn<=1e-9){ if(r.re>=STUN_TOP-0.05) r.cap=LOCK; r.sn=0; r.re=0; r.lk=LOCK; } }
        else if(r.lk>0) r.lk=Math.max(0,r.lk-dt); } },
    /* healing from his talents each second (Every Quarter, Weights and Chains, Turned by Hand, Spent Spring): ONE budget that fills at 1.2% of his max HP a second
       (the regeneration cap), kept at most 5 s. The bursts tied to a skill or an Hour (Last Turn, Spun Down, Wheel at Rest, Wound by the Hour, the signature's 30%)
       are not from the budget */
    heal(A,T,u,x,burst){ const k=K(T); if(!(x>0)||!u.alive) return; if(!burst){ x=Math.min(x,k.bud); k.bud-=x; } if(x>0) A.eng().healUnit(u,x); },
    /* ---- EVERY HIT OF HIS THAT LANDS ON AN ENEMY ---- */
    myHit(A,T,u,c){ const k=K(T), P=T.P, t=c.tgt; if(!t||c.proc) return;
      if(c.auto){
        if(any(T,CH)){ k.auto++; const ch=k.chP; k.chP=false; if(ch) T.fn.chime(A,T,u,c); }
        if(k.kick>0) k.kick=0;
        if(any(T,SR)&&k.oc>0){ if(k.sig2>0) T.fn.setWind(A,T,u,k.wind+1); else k.strain=Math.min(10,k.strain+1); }
        if(k.sig3>0&&c.hpLost>0) T.fn.heal(A,T,u,0.30*c.hpLost,true); }
      else if(k.sig3>0&&c.hpLost>0) T.fn.heal(A,T,u,0.30*c.hpLost,true);
      if(T.s.cur===MS&&any(T,ST)&&t.alive) T.fn.addStatic(A,T,u,t,(c.crit&&P.tf)?2:1);
      if(T.s.cur===FW){ k.fwN++; if(any(T,SP)) T.fn.addSpin(A,T,u); if(P.twb&&k.hours>=HOURS&&t.alive) T.fn.tstun(A,T,u,t,0.8); }
      if(any(T,HR)) T.fn.addStrokes(A,T,u,1+((c.crit&&P.sh)?P.sh:0)); },
    struck(A,T,u){ T.fn.addStrokes(A,T,u,1); },
    /* ---- CHIMES: every 4th basic attack that lands (Three Bells: every 3rd). Known at the crit hook (after every miss, dodge and block), counted at the hit.
       Every 4th Chime is the Hour (The Hour); Strike the Hour every 2nd ---- */
    chimeNow(A,T,u,c){ return !!c.auto&&K(T).chP; },
    chime(A,T,u,c){ const k=K(T), P=T.P, t=c.tgt; k.chN++; const hour=k.chN%4===0, h2=k.chN%2===0;
      if(P['ch.heal']) T.fn.heal(A,T,u,P['ch.heal']*u.maxHp);
      if(P.rh&&t.alive) rec(T,t).ra=2;
      if(T.r.sq_10_1) k.cs=4;
      if(P.dd&&u.blueCd>0) u.blueCd=Math.min(u.blueCd,Math.max(0,u.blueCd-1,MS_FLOOR-k.bE));
      if(hour&&P.hour){ const E=A.eng(), m=E.defMul(u,t,'phys'), raw=(c.amt||0)/Math.max(0.05,m);
        for(const x of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},c)) A.hurt(T,u,x,raw*E.defMul(u,x,'phys'),'#ffe08a','tkHour'); }
      if(h2&&P.sth){ for(const x of A.pick(T,u,{team:'enemy',within:4},{u})){ const r=rec(T,x); r.st=0; T.fn.discharge(A,T,u,x,!!T.P.lf,true); if(x.alive) T.fn.addStatic(A,T,u,x,2,true); }
        u.blueCd=0; } },
    csOn(A,T){ return K(T).cs>0; },
    rhOn(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.ra>0); },
    /* ---- STATIC: each Mainspring punch that lands adds 1 to its target (Thunder Flurry: 2 on a critical punch; Charged Spin: 2 from Flywheel); at 5 (Short Circuit
       3, Long Fuse 10) the target discharges and its Static empties ---- */
    addStatic(A,T,u,t,n,noDis){ const r=rec(T,t); r.st=Math.min(stMax(T),r.st+n); if(!noDis&&r.st>=stAt(T)-1e-9){ const at10=!!T.P.lf&&r.st>=10-1e-9; r.st=0; T.fn.discharge(A,T,u,t,at10,false); } },
    spinStatic(A,T,u,c){ if(c.tgt&&c.tgt.alive) T.fn.addStatic(A,T,u,c.tgt,2); },
    /* a discharge: 6% of his attack per rank of Static in the Gears (at least 6%) as lightning - MAGIC damage (the target's magic resist applies), x3 for Long Fuse's
       at 10 (the signature's full discharge too), Lightning Gears and Tower Lightning (once Storm in the Tower is full) more. Charged Brass: the nearest other enemy
       within 4 m takes 20% a rank of it (not from the signature's discharges). Each one he sets off: Grounding Rod's shield, Storm in the Tower's count */
    discharge(A,T,u,t,triple,sig){ const k=K(T), P=T.P, E=A.eng(); if(!t||!t.alive) return; k.dis++;
      let x=atk(A,u)*Math.max(0.06,P['st.dmg']||0)*(triple?3:1)*(1+(P['st.more']||0)); if(P['st.air']&&k.gs>=10) x*=1+P['st.air'];
      A.hurt(T,u,t,x*E.defMul(u,t,'magic'),'#9fd8ff','tkStatic');
      if(P['st.jump']&&!sig){ const o=A.pick(T,u,{team:'enemy',of:'target',within:4,skip:'target',n:1},{u,tgt:t})[0]; if(o) A.hurt(T,u,o,x*P['st.jump']*E.defMul(u,o,'magic'),'#9fd8ff','tkStatic'); }
      if(P['st.sh']) A.acts(T,u,[{shield:{pct:P['st.sh'],of:'maxHp'},dur:3,mode:'max'}],{u});
      if(T.r.sq_11_2) k.gs=Math.min(10,k.gs+1); },
    hasSt(A,T,u,c){ return stOf(T,c.tgt)>0; },
    stN(A,T,u,c){ return stOf(T,c.tgt); },
    gsN(A,T){ return K(T).gs; },
    /* ---- OVERCLOCK: longer (Overwound Coil, Hot Gears, Wound Once); its window ("during Overclock") is the length it was cast with; each cast winds Wind and arms
       Kick of the Spring; when it ends, Snap the Spring; Strain runs down only after it ---- */
    ocKit(A,T,u,c){ const x=T.P['oc.dur']||0; if(x>0&&c.o) c.o.dur=(c.o.dur||5)+x; },
    ocCast(A,T,u,c){ const k=K(T), P=T.P; k.oc=Math.max(k.oc,(c.o&&c.o.dur)||5); k.sT=2; if(T.r.kb_9_4) k.kick=k.oc;
      if(any(T,WD)) T.fn.setWind(A,T,u,k.wind+5+(P['wd.oc']||0)); },
    ocOn(A,T){ return K(T).oc>0; },
    ocEnd(A,T,u){ const k=K(T); k.sT=2; if(T.P.snap&&k.wind>0){ k.snap=k.wind; T.fn.setWind(A,T,u,0); } },
    kickOn(A,T){ return K(T).kick>0; },
    /* ---- WIND: max 10; 1 runs down every 1.5 s (Let It Run Down: every 3 s); Spent Spring heals when it runs out (from any cause) ---- */
    setWind(A,T,u,n){ const k=K(T), was=k.wind; k.wind=Math.max(0,Math.min(10,n)); if(k.wind>was&&!(was>0)) k.wT=1.5;
      if(was>0&&!(k.wind>0)&&T.P.ss) T.fn.heal(A,T,u,T.P.ss*u.maxHp); },
    wdN(A,T){ return K(T).wind; }, wd5(A,T){ return K(T).wind>=5-1e-9; },
    snapOn(A,T){ return K(T).snapQ>0; }, snapN(A,T){ return K(T).snapQ; },
    srN(A,T){ return K(T).strain; }, srFull(A,T){ return K(T).strain>=10-1e-9; },
    /* ---- MAINSPRING: Past the Stop spends all Wind for 1 more punch per 2 spent; Snap the Spring's bonus is for this cast and is spent with it ---- */
    msKit(A,T,u,c){ const k=K(T); k.snapQ=k.snap; k.snap=0;
      if(T.P.pts&&k.wind>0&&c.o){ const n=Math.floor(k.wind/2+1e-9); T.fn.setWind(A,T,u,0); if(n>0) c.o.hits=(c.o.hits||4)+n; } },
    msCast(A,T){ K(T).snapQ=0; },
    /* ---- FLYWHEEL: wider (Whirring, Wider Wheel; Twelve Bells at 12 Hours: every enemy within 5 m, centre to centre as the skill measures); Wheel Overwound spends
       all Strain (3% more damage each, 0.2 s off Overclock's cooldown each: never under 5 s from its cast; Spun Down heals 0.3% a rank each); then Last Turn heals
       1% a rank for each enemy it hit, Rhythm of Blows' 4 s ---- */
    fwKit(A,T,u,c){ const k=K(T), P=T.P, M=A.eng().METER(); k.fwN=0; k.fwS=0;
      if(c.o){ const r0=c.o.radius||3*M; let r=r0+(P['fw.r']||0)*M; if(P.twb&&k.hours>=HOURS) r=Math.max(r,5*M); c.o.radius=r; }
      if(P.wo&&k.strain>0){ const n=k.strain; k.strain=0; k.fwS=n; if(u.greenCd>0) u.greenCd=Math.max(0,Math.min(u.greenCd,Math.max(u.greenCd-0.2*n,OC_FLOOR-k.gE))); if(P.sd) T.fn.heal(A,T,u,P.sd*n*u.maxHp,true); } },
    woOn(A,T){ return K(T).fwS>0; }, woN(A,T){ return K(T).fwS; },
    fwCast(A,T,u){ const k=K(T), P=T.P; if(P.lt&&k.fwN>0) T.fn.heal(A,T,u,P.lt*k.fwN*u.maxHp,true); if(T.r.bw_10_2) k.rb=4; k.fwS=0; },
    rbOn(A,T){ return K(T).rb>0; },
    /* ---- COOLDOWNS: Oiled Joints, Ticking Over (Mainspring), Short Rest (Overclock); the clocks the floors count from (a refund never takes Mainspring under 4 s
       from its cast, nor Overclock under 5 s; "ready at once" is not a refund) ---- */
    cdSet(A,T,u,c){ const k=K(T), P=T.P;
      if(c.slot==='green'){ k.gE=0; c.amt=Math.max(OC_FLOOR,c.amt-(P['cd.oc']||0)); }
      else if(c.slot==='blue'){ k.bE=0; c.amt=Math.max(MS_FLOOR,c.amt-(P['cd.ms']||0)); } },
    /* ---- SPIN: each enemy Flywheel hits adds 1 (Ratchet: each stun on him 1 a rank); max 10; back to 0 each wave (Keep Turning: kept); Wheel at Rest heals as it comes ---- */
    addSpin(A,T,u){ const k=K(T); if(!any(T,SP)) return; if(k.spin>=10-1e-9) return; k.spin++; if(T.P.war) T.fn.heal(A,T,u,T.P.war*u.maxHp,true); },
    spN(A,T){ return K(T).spin; }, spAny(A,T){ return K(T).spin>0; }, sp10(A,T){ return K(T).spin>=10-1e-9; },
    /* ---- STROKES and HOURS: every hit he lands and every hit he takes is a Stroke (Struck Hours: a critical hit of his more; Every Second: a rank every 3 s while an
       enemy stands); every 10 Strokes an Hour, at most 12 for the fight; Turned by Hand heals every 10 Strokes ---- */
    addStrokes(A,T,u,n){ const k=K(T), P=T.P; for(let i=0;i<n;i++){ k.strokes++; if(P.tbh&&k.strokes%10===0) T.fn.heal(A,T,u,P.tbh*u.maxHp); if(k.strokes%STROKES===0) T.fn.addHour(A,T,u); } },
    addHour(A,T,u){ const k=K(T), P=T.P; if(k.hours>=HOURS) return; k.hours++;
      if(P.wbh){ T.fn.heal(A,T,u,0.01*u.maxHp,true); if(T.r.kb_1_4){ T.fn.setWind(A,T,u,k.wind+1); if(k.strain>0) k.strain--; } }
      if(P.thm) u.blueCd=0; },
    hrN(A,T){ return K(T).hours; },
    /* ---- MOMENTUM GEARS (his passive; nothing without it): half full, full; Through Three Cities: 2 points more cap per Hour, ramped at Momentum's own rate once it is
       full, given as the attack speed the game's multiplier does not reach ---- */
    momHalf(A,T,u){ return half(A,u); }, momFull(A,T,u){ return full(A,u); },
    ttcX(A,T,u){ const k=K(T); if(!(k.mx>0)||!full(A,u)) return 0; const c=capOf(A,u); return k.mx/(1+c); },
    /* ---- ONLY THE CLOCKMAKER (SIGNATURE, once every 25 s, at 10 Wind and 6 Strain): for 6 s Momentum Gears is full, Overclock is cast again at once (no cooldown
       spent), Mainspring is ready, and every Strain he would gain becomes Wind; when it ends Momentum is back where it was (with its ramp of those 6 s) and he is
       slowed 30% for 2 s (his own talents never weaken or end that slow) ---- */
    clockmaker(A,T,u){ const k=K(T), E=A.eng(); k.s2=SIG_CD; k.sig2=6; k.s2m=(u.pass&&u.pass.momentum)?(u._momStk||0):null; if(k.s2m==null) k.s2m=-1;
      if(u.pass&&u.pass.momentum) u._momStk=capOf(A,u);
      if(E.castSlot&&u.greenAb) E.castSlot(u,'green',u); u.blueCd=0; },
    sig2End(A,T,u){ const k=K(T); const m=k.s2m; k.s2m=null;
      if(m>=0&&u.pass&&u.pass.momentum) u._momStk=Math.min(capOf(A,u),m+0.025*6*(1+(T.P.ramp||0)));
      if(u.alive){ k.crash=2; u.slow=Math.max(u.slow||0,2); u.slowMul=Math.min(u.slowMul==null?1:u.slowMul,0.70); k.swL=u.slowMul; } },
    /* ---- FEELS WRONG: a stun or a slow newly on him while Overclock is ready (not silenced): Overclock is cast at once (its cooldown starts) and the stun and the
       slow end ---- */
    feelsWrong(A,T,u){ const E=A.eng(); if(!u.alive||!u.greenAb||(u.greenCd||0)>0||(u.silencedT||0)>0||K(T).crash>0||!E.castSlot) return;
      u.stunned=0; u.slow=0; E.castSlot(u,'green',u); u.greenCd=Math.max(OC_FLOOR,(u.greenAb.cd||8)-(T.P['cd.oc']||0)); K(T).gE=0; },
    /* ---- IT DOES NOT MIND (SIGNATURE, once per fight, when he would die): 1 HP at least for 4 s, no stun on him, 1 Hour every second, Flywheel ready (full Energy),
       every hit he lands in those 4 s heals him 30% of the HP it took ---- */
    idnm(A,T,u){ const k=K(T); k.sig3=4; k.s3h=0; u.stunned=0; u.energy=100; },
    /* ---- the stun-lock rule for his one talent stun (Twelve Bells): never on an enemy already stunned, nor within 0.5 s after his stun on it ended; never more
       than 4.0 s of his stuns in a row on one enemy, then 0.5 s free. Through the engine's control (the enemy's own control resist, no resist roll, no draw) ---- */
    tstun(A,T,u,t,secs){ const k=K(T); if(!t||!t.alive||t.team===u.team) return false; k.ts.n++;
      if((t.stunned||0)>0){ k.ts.onStun++; return false; } const r=rec(T,t); if(r.lk>0||r.cap>0){ k.ts.lk++; return false; }
      const room=r.sn>0?Math.max(0,STUN_TOP-r.re):STUN_TOP, s=Math.min(secs,room); if(!(s>1e-9)){ k.ts.cut++; return false; }
      A.control(T,u,t,'stunned',s); if((t.stunned||0)>0){ if(!(r.sn>0)) r.re=0; r.sn=Math.max(r.sn,t.stunned); if(r.re+r.sn>k.runMax) k.runMax=r.re+r.sn; return true; } return false; },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP. Every talent of his that makes a hit on him smaller multiplies here (each takes its share of what is left), and together
       they never take more than 30% off a hit (DR_CAP). His base kit has no reduction of its own (armour 892 / magic resist 664 at level 100). Strain's cost (Something
       Wrong) is applied after it ---- */
    drK(A,T,u,src,kind,crit){ const P=T.P, k=K(T); let f=1; const cut=x=>{ if(x>0) f*=1-Math.min(1,x); };
      cut(P['dr.all']); cut(P['dr.wf']); if(kind==='magic') cut(P['dr.mag']); if(crit) cut(P['dr.crit']);
      if(P['dr.ff']&&k.wt>=15-1e-9) cut(P['dr.ff']); if(P['dr.sts']&&k.wt<5-1e-9) cut(P['dr.sts']); if(P['dr.oc']&&k.oc>0) cut(P['dr.oc']); if(P['dr.hr']) cut(P['dr.hr']*k.hours);
      return Math.max(1-DR_CAP,f); },
    srCost(A,T){ if(!T.r.kb_1_1||T.P.lird) return 0; return Math.max(0,0.005-(T.P['sr.hold']||0)); },
    myIn(A,T,u,c){ const k=K(T); c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.crit); const p=T.fn.srCost(A,T); if(p>0&&k.strain>0) c.amt*=1+p*k.strain; },
    /* ---- THE CRIT GROUP: at most 5% from all of them on any hit. The part that holds on every hit is a stat (critS: Ticking Heart, Overrun per Strain, Dusk Bell at
       12 Hours); this hit's own part (Ring True on a Chime, Storm Coil and Punch Clock on Mainspring's punches) is one more seeded roll, drawn only when one of them
       applies. The same hook knows whether this basic attack is a Chime ---- */
    critS(A,T){ const P=T.P, k=K(T); return Math.min(CRIT_CAP,(P['cr.all']||0)+(P['cr.strain']||0)*k.strain+((P['cr.dusk']&&k.hours>=HOURS)?P['cr.dusk']:0)); },
    crit(A,T,u,c){ const t=c.tgt, P=T.P, k=K(T); if(!t||c.proc) return;
      if(c.auto&&any(T,CH)){ const every=T.P.tb?3:4; k.chP=((k.auto+1)%every===0); }
      if(c.force) return; let p=0;
      if(c.auto&&k.chP&&P['cr.chime']) p+=P['cr.chime']; if(T.s.cur===MS&&P['cr.punch']) p+=P['cr.punch'];
      p=Math.min(p,Math.max(0,CRIT_CAP-T.fn.critS(A,T))); if(!(p>0)) return;
      const base=Math.min(0.95,(u.glyphCrit||0)+((u._critBuffT||0)>0?(u._critBuffPct||0):0)); if(A.eng().rnd()<p/Math.max(0.05,1-base)) c.force=true; },
    /* slows on him weaker during Overclock (Gone in a Blur): at most 30% weaker, once per new slow; never the signature's own crash */
    slowW(A,T,u){ const k=K(T); if(k.crash>0) return; const m=u.slowMul; if(!(k.oc>0)||!((u.slow||0)>0)||m==null||!(m<1)){ k.swL=null; return; } if(k.swL===m) return;
      u.slowMul=1-(1-m)*Math.max(1-SLOW_CAP,1-(T.P.gb||0)); k.swL=u.slowMul; },
    /* controls on him: Measured Pace makes every one shorter (20% at most); No One to Stop It: no slow while Momentum Gears is full; It Does Not Mind: no stun in its 4 s */
    ten(A,T,u,c){ const P=T.P, k=K(T), f=c.field; let x=1-Math.min(TEN_CAP,P.ten||0);
      if(f==='slow'&&P.nots&&full(A,u)) x=0; if(f==='stunned'&&k.sig3>0) x=0; c.amt*=x; }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/57 - TICK - talent decisions.md) */
  ruling:{}
};
