/* YENNA CACKLEFANG - what her learned talents do in a fight (the mechanics; her plain stat talents are read by tools/build_talent_fx.py from
   their sentences, like every other hero's).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   Her real kit (the code, not the card wording; a Back-row Marksman, 25.6 m reach, physical; tests/yenna-kit-facts.js, 21 seeded fights):
   - Rending Return ('boomerang', green, cd 7): the FIRST THREE living enemies in the line-up's order (not a line, not the nearest: 30 of 71 casts
     were not the nearest three; median 21 m away, 154 of 172 hits beyond the card's 7.6 m) take 95% of her attack x skill level at once; 0.45 s
     later the return (u._boomT, counted in her status pass, so it waits while she is stunned or feared) hits the same ones in reverse order for
     1.6 x that. The return is dealt in the status pass, outside any cast: one guarded page site wraps each return hit in partPre/part 'yeBack'.
   - Laughing Mark ('markreveal', blue, cd 9): the lowest-health enemy is marked 8 s (_markT, _markBy = her): it takes x1.379 damage from every
     hit at level 100 (_markMul). The card's "making allied critical hits restore energy" is not in the code (measured: 0 energy).
   - Pack Opportunist (passive 'packopp'): her hits deal +28% x passMul (1.108 at level 100) to a target with no ally within 3.5 m centre to
     centre ("isolated": true on every one of her 665 hits measured), held (stunned, feared, slowed or airborne) or below 35% HP.
   - Crescent Stampede (ult 'multiShot' + ricochet): 180% x 5 of her attack, split over 4 to 8 hops between every marked enemy (anyone's _markT),
     or the nearest three when none is marked; each hop is a groundHazard 0.22 s apart: one guarded page site wraps each hop in partPre/part
     'yeHop', one lets her talents count an enemy as marked for the ring (e._yeRic = her, set only by her kit row, cleared at the cast).
   Her families (WIRING/65 - YENNA - talent decisions.md): Arc (a throw's charge), Notches (fight-long), Lined Up, Breath (per ally), Call /
   Called (per enemy), her marks (Laughing Mark and the talent marks), Nerves and the Cackle. Caps: DR40 - her damage-reduction talents are ONE
   product on her, kept share floored at 0.60; ALLY20 - what her talents take off a hit on an ally, floored at 0.80; CRIT5 - her critical-chance
   talents together at most 5%; crit damage at most 10% a talent (20% on Rending Return alone); the cackle at most once every 4 s. NO absolute
   fight time anywhere: every timer is a countdown lowered by the tick's dt (the battle clock restarts at 0 each wave). */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const RR='boomerang', BACK='yeBack', HOP='yeHop', LM='markreveal', ULT='multiShot', RRS=[RR,BACK];
const DR_FLOOR=0.60, ALLY_FLOOR=0.80, CRIT_POOL=500, CK_LOCK=4, NERVE_MAX=10, BR_MAX=5, BR_DUR=6, CALLS=4;
/* the families: their bookkeeping runs when one of their talents is learned */
const ARC=['wb_1_1','wb_2_1','wb_3_1','wb_6_1','wb_8_1','wb_10_1','wb_13_1'];
const NOTCH=['wb_1_4','wb_2_4','wb_4_4','wb_9_4','wb_6_4','wb_7_4','wb_10_4','wb_12_4','wb_13_1'];
const BREATH=['pl_1_2','pl_2_2','pl_3_2','pl_4_2','pl_7_2','pl_9_2','pl_10_2','pl_12_1','pl_8_4','pl_13_2'];
const CALL=['pl_1_4','pl_3_4','pl_n1','pl_5_4','pl_6_4','pl_7_4','pl_8_4','pl_10_4','pl_11_4','pl_12_3','pl_12_4','pl_13_2'];
const NERVE=['af_1_1','af_2_1','af_3_1','af_4_1','af_5_1','af_7_1','af_8_1','af_12_1','af_2_2','af_7_2','af_9_2','af_13_2'];
const DRG=['wb_3_2','af_9_4','af_4_1','af_5_4','af_11_4','pl_5_4','af_8_4'];       // DR40: her own group
const ALLYDR=['pl_5_4','af_8_4'];                                                  // ALLY20: what her talents take off a hit on an ally
const CRITL=['wb_1_2','pl_2_3','wb_9_4','af_8_1'];                                 // CRIT5: one pool
const PO=['wb_8_2','af_1_3','af_4_3'];                                             // Pack Opportunist's numbers
const CDR=['wb_3_3','af_10_1','wb_7_4','pl_4_1'];
const TEAMF=BREATH.concat(ALLYDR,['pl_1_1','pl_1_4','pl_n2','pl_9_1','pl_10_1','af_6_3','pl_6_1','pl_11_1']);   // hits by her team on enemies, and on her allies
const HITF=CALL.concat(['wb_7_1','wb_11_4','wb_9_2']);
const DEATHF=['pl_5_1','pl_11_3','pl_3_2','pl_5_3','pl_13_2','pl_12_3','wb_11_4','af_11_3'];
const KILLF=NOTCH.concat(['wb_8_3','wb_11_1']);
const RRK=ARC.concat(NOTCH,['wb_n1','wb_3_2','wb_7_3','wb_5_2','wb_5_3','wb_6_3','wb_12_1','pl_n1','wb_9_2','wb_8_1','wb_10_1','wb_11_1']);   // the throw's kit / cast / landing
const ULTK=['wb_9_2','af_11_1','pl_7_1'];
/* ---- small readers that need no API ---- */
const rk=(T,id)=>T.r[id]||0;
const has=(T,L)=>L.some(id=>T.r[id]);
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const V=T=>T.s.ye||(T.s.ye={e:{}, br:{}, q:[], arc:0, keep:0, air:0, thr:0, thrW:0, throwId:0, backFoes:null, backDmg:0, outDmg:0, outFoes:null,
  tbT:0, wyT:0, wcT:0, afT:0, s3:0, ckT:0, main:null, mkMul:0, scent:null, lane:null, ric:[],
  stats:{throws:0, land:0, back:0, pass:0, two:0, twice:0, hch:0, notch:0, ck:0, fear:0, sig1:0, sig2:0, sig3:0, called:0, br:0, marks:0, move:0, fearRun:0}});
const rec=(T,t)=>{ const v=V(T); let r=v.e[t.uid]; if(!r) r=v.e[t.uid]={u:t, mkOn:0, call:0, called:0, nervPend:0, nervOn:-1, cut:0, lined:0, tally:0, sb:0, ring:0,
  lat:0, sigE:0, fearMine:0, near:0, calledW:0, hb:{}, run:0}; return r; };
const recOf=(T,t)=>t?V(T).e[t.uid]:null;
module.exports={
  hero:'yenna',
  casting:true,                         // rows ask which of her skills a hit comes from (the throw, its return, the ultimate's hops)
  states:{
    yeNotch:{max:5},                                                                              // Notches: the rest of the fight
    yeNerve:{max:NERVE_MAX, fade:{after:P('nerve.after',3),every:1,lose:1,unless:{fn:'nerveHold'}}},   // Nerves: one fades a second after 3 s without a gain (+0.5 s/rank Jittery)
    yeFF:{max:3, dur:6},                                                                          // Fear Feeds
    yeHS:{max:5, wave:'reset'},                                                                   // Hunt Song
    yeKL:{max:5, wave:'reset'}                                                                    // Keep Laughing
  },
  always:[
    {on:'wave',do:[{fn:'waveStart'}]},                                                                       // a new wave: her records of enemies drop; Pack Memory, Brave Face
    {on:'tick',do:[{fn:'tk'}]},                                                                               // every timer of hers counts down here
    {on:'kit',skill:RR,do:[{fn:'rrKit'}]}, {on:'cast',skill:RR,reqAny:RRK,do:[{fn:'rrCast'}]},              // the throw
    {on:'cast',skill:LM,do:[{fn:'lmCast'}]},                                                                  // Laughing Mark: whom it marked
    {on:'kit',skill:ULT,reqAny:ULTK,do:[{fn:'ultKit'}]}, {on:'cast',skill:ULT,reqAny:ULTK,do:[{fn:'ultCast'}]},   // Crescent Stampede: the ring
    {on:'part',skill:HOP,reqAny:['pl_7_1'],do:[{fn:'hopF'}]},                                                // each hop (Laughing Stampede)
    {on:'hit',if:{targetTeam:'enemy'},reqAny:HITF,do:[{fn:'hitF'}]},                                         // her hits: Calls, Return Cut, Tally, Stampede Bone
    {on:'kill',if:{fn:'rrHit'},reqAny:KILLF,do:[{fn:'killF'}]},                                              // a kill by Rending Return: Notches, Sure Catch, Twice Back
    {on:'hurt',reqAny:NERVE.concat(['af_6_4','af_13_2']),do:[{fn:'hurtF'}]},                                // a hit on her: Nerves, Hackles, the signature
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                    // DR40: ONE capped product on her
    {on:'teamIn',reqAny:TEAMF,do:[{fn:'tIn'}]},                                                               // her team's hits on enemies (the mark's riders, Breath, Called), ALLY20
    {on:'death',reqAny:DEATHF,do:[{fn:'deathF'}]},                                                            // an enemy falls (the mark's riders, Fed Clan, Tally, Hunted Hunter)
    {on:'cd',reqAny:CDR,do:[{fn:'cdSet'}]},                                                                   // her cooldown talents
    {on:'out',reqAny:PO,do:[{fn:'poAdj'}]},                                                                   // Pack Opportunist's numbers
    {stat:{crit:0.0001},per:{fn:'critPool'},reqAny:CRITL}                                                     // CRIT5: one 5% pool
  ],
  talents:{
    /* ============================== WHAT COMES BACK ============================== */
    wb_1_1:[ {on:'out',if:{casting:BACK},more:R(0.02),per:{fn:'arcN'}} ],                                   // Whole Arc
    wb_2_3:[ {on:'out',if:{casting:RRS},more:R(0.03)} ],                                                      // Thighbone
    wb_1_4:[ {on:'out',if:{casting:RRS},more:R(0.015),per:'yeNotch'} ],                                      // Carved Notch
    wb_2_1:[ {param:'arc.cap',add:R(1)} ],                                                                    // Long Arc (3 + 1/rank)
    wb_1_2:[ {param:'cp.bs',add:R(1)} ],                                                                      // Bone Sight (CRIT5 pool)
    wb_2_4:[ {stat:{aspd:R(0.004)},per:'yeNotch'} ],                                                          // Deep Notch
    wb_3_1:[ {param:'hch',add:1} ],                                                                           // Harder Coming Home (rrCast)
    wb_3_2:[ {param:'chalk',add:R(0.02)} ],                                                                   // Chalk Flats Hide (myDr)
    wb_3_3:[ {param:'cd.rr',add:R(0.15)} ],                                                                   // Quick Catch
    wb_4_1:[ {on:'out',if:{auto:true,window:'yeCT'},more:R(0.04),do:[{window:'yeCT',end:true}]} ],          // Catch and Throw (land opens it)
    wb_n1:[ {on:'out',if:{auto:true,fn:'lined'},more:R(0.04)} ],                                              // All in a Row (rrCast lines them up)
    wb_4_4:[ {on:'kill',if:{fn:'nonRR'},chance:R(0.15),do:[{fn:'notch1'}]} ],                                 // Notch by Notch
    wb_5_1:[ {on:'out',if:{casting:RRS},ignoreArmor:R(0.02)} ],                                              // Through the Line
    wb_9_4:[ {param:'cp.ng',add:R(1)} ],                                                                      // Notched Grip (CRIT5 pool)
    wb_5_4:[ {on:'out',if:{fn:'poOn'},critMore:R(0.02)} ],                                                    // Sharpened Edge
    wb_6_1:[ {param:'arc.keep',add:R(1)} ],                                                                   // Arc Remembered (land)
                                                                                                              // Wind off the Flats: a plain stat (fx: +1%/rank aspd) - no row
    wb_8_3:[ {param:'sc',add:R(0.5)} ],                                                                       // Sure Catch (killF)
    wb_6_4:[ {stat:{hp:R(0.005)},per:'yeNotch'} ],                                                            // Bone Charm
    wb_7_1:[ {param:'rcut',add:R(0.02)}, {on:'out',if:{fn:'cut'},more:R(0.02)} ],                             // Return Cut (hitF marks)
    wb_7_3:[ {param:'two',add:1} ],                                                                           // Two Bones (rrCast)
    wb_7_4:[ {param:'cd.fifth',add:R(0.2)} ],                                                                 // Fifth Notch
    wb_8_1:[ {on:'crit',if:{casting:BACK},chance:{flat:1,x:{fn:'haCh'}},force:true} ],                       // Heavy Arc (inside the CRIT5 pool)
    wb_8_2:[ {param:'po.eye',add:R(0.01)} ],                                                                  // Opportunist's Eye (poAdj)
    wb_5_2:[ {on:'kit',skill:RR,opt:{back:{add:0.3}}}, {on:'out',if:{casting:BACK},more:P('lwb',0.25)} ],   // Long Way Back
    wb_5_3:[ {on:'kit',skill:RR,opt:{back:{set:1e-6}}}, {param:'swb',add:1} ],                              // Short Way Back (land)
                                                                                                              // Clan Bone: a plain stat (fx: +2%/rank atk) - no row
    wb_9_2:[ {param:'sbone',add:1} ],                                                                         // Stampede Bone (ultKit)
    wb_6_2:[ {param:'lwb',add:R(0.05)} ],                                                                     // Patient Hands
    wb_6_3:[ {param:'snap',add:1}, {stat:{aspd:R(0.04)},if:{window:'yeSnap'}} ],                              // Snapback (land)
    wb_10_1:[ {on:'out',if:{casting:BACK,fn:'arcFull'},critMore:R(0.04)} ],                                   // Full Swing
    wb_10_2:[ {on:'kit',skill:ULT,opt:{mul:{more:R(0.03)}}} ],                                                // Ricochet Count
    wb_10_4:[ {stat:{lifesteal:R(0.003)},per:'yeNotch'} ],                                                    // Old Bone
    wb_11_1:[ {param:'twice',add:1} ],                                                                        // Twice Back (killF)
    wb_11_3:[ {on:'out',if:{casting:RR},more:R(0.04)} ],                                                      // Heavy Hand
    wb_11_4:[ {param:'tally',add:R(0.01)} ],                                                                  // Tally (hitF, deathF)
    wb_12_1:[ {on:'out',if:{casting:BACK},more:R(0.01),per:{fn:'cbh'}} ],                                    // Comes Back Harder
    wb_12_2:[ {on:'out',if:{casting:BACK},more:R(0.02)} ],                                                    // Sharp Turn
    wb_12_4:[ {on:'out',if:{stackMin:{yeNotch:5}},critMore:R(0.03)} ],                                        // Bone Song
    wb_13_1:[ {param:'wyt',add:1} ],                                                                          // Whatever You Throw (SIGNATURE: land)
    /* ============================== POINT AND LAUGH ============================== */
    pl_1_1:[ {param:'pp',add:R(0.01)} ],                                                                      // Pointing Paw (tIn)
    pl_1_2:[ {stat:{aspd:R(0.01)},to:{team:'ally'},per:{fn:'brOf'}} ],                                        // Clean Bite (Breath)
    pl_1_4:[ {param:'cc',add:R(0.02)} ],                                                                      // Call the Clan (tIn; Calls in hitF)
    pl_2_1:[ {on:'kit',skill:LM,opt:{dur:{add:R(0.5)}}} ],                                                    // Long Laugh
    pl_2_2:[ {stat:{lifesteal:R(0.003)},to:{team:'ally'},per:{fn:'brOf'}} ],                                  // Second Breath
    pl_2_3:[ {param:'cp.st',add:R(1)} ],                                                                      // Sharp Teeth (CRIT5 pool)
    pl_4_1:[ {param:'cd.lm',add:R(0.2)} ],                                                                    // Pick the Limping
    pl_3_2:[ {param:'bftn',add:1} ],                                                                          // Breath for the Next (deathF)
    pl_n1:[ {param:'nl',add:0.08}, {on:'out',if:{casting:RRS,fn:'nerv'},more:0.08} ],                                                                          // Nervous Laughter (LINK: the Nerve half needs Raw Nerves)
    pl_3_4:[ {param:'called.dur',add:R(0.4)} ],                                                               // Loud Call
    pl_5_1:[ {param:'echo',add:R(0.4)} ],                                                                     // Echo Laugh (deathF)
    pl_4_2:[ {stat:{move:R(0.04)},to:{team:'ally'},per:{fn:'br3'}} ],                                         // Pack Pace
    pl_n2:[ {param:'litter',add:R(0.02)} ],                                                                   // Litter Mates (tIn)
    pl_6_1:[ {param:'ecb',add:R(2)} ],                                                                        // Every Clean Bite (tIn: energy)
    pl_5_2:[ {param:'hold',add:0.25} ],                                                                       // Hold It Down (tk)
    pl_5_3:[ {param:'rid',add:1} ],                                                                           // Run It Down (deathF)
    pl_5_4:[ {param:'pf',add:R(0.02)} ],                                                                      // Pack Feast (myDr / allyK)
                                                                                                              // Chalk Dust: a plain stat (fx: +1%/rank hp and armor) - no row
    pl_6_2:[ {param:'hold',add:R(0.04)} ],                                                                    // Pinned (points on Hold It Down's 25%)
    pl_6_3:[ {param:'dtl',add:1}, {stat:{aspd:R(0.04)},if:{window:'yeDtl'}} ],                                // Down the Line
    pl_6_4:[ {param:'ac',add:R(0.02)} ],                                                                      // Answering Call (called)
    pl_7_1:[ {param:'ls',add:1} ],                                                                            // Laughing Stampede (hopF)
    pl_7_2:[ {stat:{atk:R(0.004)},to:{team:'ally'},per:{fn:'brOf'}} ],                                        // Deep Breath (renamed Full Chest)
    pl_7_4:[ {on:'out',if:{auto:true,fn:'calledT'},more:R(0.03)} ],                                           // Clan Signal
    pl_8_1:[ {on:'out',if:{fn:'marked'},more:R(0.02)} ],                                                      // Lowest First
    pl_8_3:[ {on:'out',if:{fn:'marked'},critMore:R(0.02)} ],                                                  // Clean Kill (renamed Clean Finish)
    pl_8_4:[ {param:'rh',add:R(1)} ],                                                                         // Rally Howl (called)
    pl_9_1:[ {param:'ly',add:R(0.01)} ],                                                                      // Lean Year (tIn)
    pl_9_2:[ {stat:{crit:0.05},to:{team:'ally'},per:{fn:'br5'}} ],                                            // Full Lungs (5%)
                                                                                                              // Hunting Weight: a plain stat (fx: +2%/rank atk) - no row
    pl_10_1:[ {param:'scent',add:R(0.01)} ],                                                                  // Second Scent (tIn)
    pl_10_2:[ {on:'yeBr5',chance:R(0.20),do:[{fn:'shareBr'}]} ],                                              // Shared Breath
    pl_10_4:[ {on:'yeCtc',chance:R(0.10),do:[{fn:'call2'}]} ],                                                // Close the Circle
    pl_11_1:[ {on:'out',if:{fn:'marked'},more:R(0.01),per:{fn:'thinN'}} ],                                   // Thin Herd
    pl_11_3:[ {stat:{atk:R(0.01)},per:'yeHS'} ],                                                              // Hunt Song (deathF stacks it)
    pl_11_4:[ {param:'twoCalls',add:1} ],                                                                     // Two Calls (hitF)
    pl_12_1:[ {param:'pmem',add:R(1)} ],                                                                      // Pack Memory (waveStart)
    pl_12_2:[ {on:'kit',skill:ULT,opt:{mul:{more:R(0.03)}}} ],                                                // Big Laugh
    pl_12_3:[ {param:'fed',add:R(0.03)} ],                                                                    // Fed Clan (deathF)
    pl_12_4:[ {param:'lc',add:R(0.05)} ],                                                                     // Loud Clan (tk)
    pl_13_2:[ {param:'wcg',add:1} ],                                                                          // Where the Clan Goes (SIGNATURE: deathF)
    /* ============================== AFRAID AT SOMEBODY ELSE ============================== */
    af_1_1:[ {stat:{aspd:R(0.005)},per:'yeNerve'} ],                                                          // Raw Nerves
    af_1_3:[ {param:'po.hold',add:R(0.02)} ],                                                                 // Something Has Hold (poAdj)
    af_9_4:[ {param:'wary',add:R(0.02)} ],                                                                    // Wary (myDr)
    af_2_1:[ {param:'nerve.after',add:R(0.5)} ],                                                              // Jittery
    af_2_2:[ {param:'ck',add:R(0.3)} ],                                                                       // The Laugh That Isn't (addNerve sets off the cackle)
                                                                                                              // Bristle: a plain stat (fx: +2%/rank armor) - no row
    af_3_1:[ {param:'cold',add:1} ],                                                                          // Cold Pups (hurtF)
    af_3_2:[ {param:'shrill',add:R(0.20)} ],                                                                  // Shrill (cackle)
    af_3_3:[ {on:'out',if:{casting:RRS,fn:'alone'},more:R(0.03)} ],                                           // Drifted
    af_4_1:[ {param:'wt',add:R(0.002)} ],                                                                     // Wound Tight (renamed Strung Tight; myDr)
    af_5_2:[ {param:'lio',add:0.08} ],                                                                        // Laugh It Off (cackle)
    af_5_3:[ {param:'lat',add:1} ],                                                                           // Laugh at Them (cackle)
    af_4_4:[ {on:'ccIn',less:R(0.04)} ],                                                                      // Hard to Pin (up to 20%)
    af_5_1:[ {on:'out',if:{auto:true,stackMin:{yeNerve:5}},more:R(0.03)} ],                                  // Fraying
    af_6_2:[ {param:'lio',add:R(0.02)} ],                                                                     // Breathe Out
    af_6_3:[ {param:'ptw',add:R(0.03)} ],                                                                     // Point the Way (tIn)
    af_5_4:[ {param:'ld',add:R(0.02)} ],                                                                      // Last Ditch (myDr)
    af_6_1:[ {stat:{aspd:R(0.02)},per:{fn:'near3'}} ],                                                        // Back to the Wall
                                                                                                              // Survivor: a plain stat (fx: +2%/rank mr) - no row
    af_4_3:[ {param:'po.limp',add:R(0.03)} ],                                                                 // Limping One (poAdj)
    af_6_4:[ {param:'hack',add:R(0.10)} ],                                                                    // Hackles (hurtF)
    af_7_1:[ {stat:{lifesteal:R(0.002)},per:'yeNerve'} ],                                                     // Running Hot
    af_7_2:[ {param:'shake',add:R(1)} ],                                                                      // Shaking Laugh (10 down to 5)
    af_7_3:[ {on:'out',if:{casting:BACK,fn:'gripped'},more:0.40} ],                                           // Taken by the Throat
    af_7_4:[ {on:'ccOut',if:{cc:['fearT']},add:R(0.1)} ],                                                     // Long Fright (every fear of hers)
    af_8_1:[ {param:'cp.ne',add:R(1)} ],                                                                      // Nerve Ends (CRIT5 pool)
    af_8_3:[ {on:'out',if:{fn:'held'},critMore:R(0.02)} ],                                                    // Seize It
    af_8_4:[ {param:'re',add:R(0.04)} ],                                                                      // Ringing Ears (myDr / allyK)
                                                                                                              // Thick Ruff: a plain stat (fx: +2%/rank hp) - no row
    af_9_2:[ {param:'echoC',add:1} ],                                                                         // Echoing Cackle
    af_9_3:[ {stat:{atk:R(0.01)},per:'yeFF'} ],                                                               // Fear Feeds (fear stacks it)
    af_10_1:[ {param:'cd.rr',add:R(0.2)} ],                                                                   // Quick Hands (renamed Quick Paws)
    af_10_3:[ {on:'kit',skill:ULT,opt:{mul:{more:R(0.03)}}} ],                                                // Open Jaws
    af_10_4:[ {on:'out',if:{fn:'feared'},more:R(0.02)} ],                                                     // Scattered
    af_11_1:[ {param:'shriek',add:1} ],                                                                       // Shriek Stampede (ultKit)
    af_11_3:[ {param:'hh',add:R(0.01)} ],                                                                     // Hunted Hunter (deathF)
    af_11_4:[ {param:'brr',add:R(0.02)} ],                                                                    // Breathing Room (myDr)
    af_12_1:[ {param:'brave',add:R(3)} ],                                                                     // Brave Face (waveStart)
    af_12_2:[ {stat:{aspd:R(0.01)},per:'yeKL'} ],                                                             // Keep Laughing (cackle stacks it)
    af_12_4:[ {param:'rat',add:R(0.05)} ],                                                                    // Rattled (tk)
    af_13_2:[ {param:'aase',add:1}, {on:'out',if:{casting:BACK,fn:'s3Feared'},mul:2} ]                        // Afraid at Somebody Else (SIGNATURE: hurtF)
  },
  fn:{
    /* ---- A NEW WAVE: her records of enemies drop (enemies are new); Breath carries what Pack Memory keeps; Brave Face's Nerves ---- */
    waveStart(A,T,u){ const v=V(T), P=T.P; T.s.api=A;
      v.e={}; v.q=[]; v.air=0; v.passEnd=0; v.thrW=0; v.main=null; v.scent=null; v.lane=null; v.backFoes=null; v.ric=[];
      for(const k in v.br){ const b=v.br[k]; if(!b.u.alive){ delete v.br[k]; continue; } b.n=P.pmem?Math.min(b.n,P.pmem):0; b.t=b.n>0?BR_DUR:0; }
      if(P.brave) A.stSet(T,u,'yeNerve',Math.max(stN(T,'yeNerve'),P.brave)); },
    /* ---- EVERY TIMER, ONCE A TICK (countdowns only) ---- */
    tk(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), dt=c.dt||0, M=E.METER(); T.s.api=A;
      for(const f of ['tbT','wyT','wcT','afT','s3','ckT']) if(v[f]>0) v[f]=Math.max(0,v[f]-dt);
      if(v.q.length) for(let i=0;i<v.q.length;i++){ const q=v.q[i]; q.t-=dt; if(q.t>1e-9) continue; v.q.splice(i--,1); T.fn[q.f](A,T,u,q); }
      if(v.air&&!u._boomFoes&&!v.q.some(q=>q.f==='pass')){ if(v.passEnd){ v.passEnd=0; v.air=0; } else T.fn.land(A,T,u); }   // the return has landed (the page cleared its list); after the signature's passes the bone is down
      for(const k in v.br){ const b=v.br[k]; if(!b.u.alive){ delete v.br[k]; continue; } if(b.n>0){ b.t-=dt; if(b.t<=1e-9){ b.n=0; b.t=0; } } }
      const nerves=has(T,NERVE);
      for(const k in v.e){ const r=v.e[k], t=r.u; if(!t.alive){ delete v.e[k]; continue; }
        for(const f of ['called','cut','lined','tally','sb','ring','lat','sigE']) if(r[f]>0) r[f]=Math.max(0,r[f]-dt);
        for(const h in r.hb){ const x=r.hb[h]; x.t-=dt; if(x.t<=1e-9) delete r.hb[h]; }
        if(r.mkOn&&!((t._markT||0)>0)) r.mkOn=0;
        if(P.hold&&r.mkOn) A.acts(T,u,[{slow:P.hold,dur:0.6,on:'target'}],{u,tgt:t});                       // Hold It Down (+ Pinned): the enemy under her mark
        if(P.lc&&r.called>0) A.acts(T,u,[{slow:P.lc,dur:0.6,on:'target'}],{u,tgt:t});                       // Loud Clan: Called enemies
        if((t.fearT||0)>0&&r.fearMine){ r.run+=dt; if(r.run>v.stats.fearRun) v.stats.fearRun=r.run; } else r.run=0;
        if(r.fearMine&&!((t.fearT||0)>0)){ r.fearMine=0; if(P.rat) A.acts(T,u,[{slow:P.rat,dur:2,on:'target'}],{u,tgt:t}); } }   // Rattled: 2 s after her fear ends
      if(nerves) for(const x of E.units()){ if(!x.alive||x.team===u.team) continue; const near=A.gap(u,x)<3*M, r=near||recOf(T,x)?rec(T,x):null; if(!r) continue;
        if(near&&!r.near) T.fn.addNerve(A,T,u,1); r.near=near?1:0; }                                          // Raw Nerves: an enemy comes within 3 m
      if(P.scent){ const m=v.main&&v.main.alive&&T.fn.isMarked(A,T,u,v.main)?v.main:null; let b=null,bd=1e18;
        if(m) for(const x of E.units()){ if(!x.alive||x.team===u.team||x===m) continue; const d=E.dist(m,x); if(d<bd){ bd=d; b=x; } } v.scent=b; }
      if(P.litter){ const L=E.units().filter(x=>x.alive&&x.team===u.team&&!x._summon).sort((a,b)=>(a.laneX||0)-(b.laneX||0)), i=L.indexOf(u); v.lane=i<0?[]:[L[i-1],L[i+1]].filter(Boolean); } },
    /* ---- RENDING RETURN. kit: the throw starts (its id, Comes Back Harder's count, Nervous Laughter). cast: Arc, Lined Up, Harder Coming Home,
       Two Bones; the return's list and damage are kept for the signature. land: when the page's return pass has run. ---- */
    rrKit(A,T,u,c){ const v=V(T); v.throwId++; v.thr++; v.thrW++; v.stats.throws++; v.air=1;
      for(const k in v.e){ const r=v.e[k]; if(r.nervPend){ r.nervPend=0; r.nervOn=v.throwId; } } },
    rrCast(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), o=c.o||{}; const back=(u._boomFoes||[]).slice(), foes=back.slice().reverse();
      v.outDmg=(u._boomDmg||0)/(o.backMul||1.5); v.outFoes=foes;
      if(has(T,ARC)){ v.arc=Math.min(T.fn.arcCap(A,T),v.keep+foes.length); v.keep=0; }
      if(T.r.wb_n1&&foes.length>=3) for(const f of foes) if(f.alive) rec(T,f).lined=4;                          // All in a Row: 3+ on the way out
      if(P.hch&&v.arc>=4&&u._boomFoes&&foes.length){ const last=foes[foes.length-1]; let b=null,bd=1e18;          // Harder Coming Home: the nearest enemy behind them
        for(const x of E.units()){ if(!x.alive||x.team===u.team||foes.indexOf(x)>=0||x._dropHidden||x._noTarget) continue; const d=E.dist(last,x); if(d<bd){ bd=d; b=x; } }
        if(b){ u._boomFoes.unshift(b); v.stats.hch++; } }
      v.backFoes=(u._boomFoes||[]).slice(); v.backDmg=u._boomDmg||0;
      if(P.two&&v.thr%3===0){ v.stats.two++; for(const x of T.fn.nextThree(A,T,u,foes)) T.fn.skillHit(A,T,u,x,v.outDmg*0.5,RR); } },   // Two Bones: every third throw
    /* the three enemies after the ones struck, in the skill's own order (the line-up's), counting round to the start */
    nextThree(A,T,u,after){ const E=A.eng(), L=E.units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget&&!(x._riseT>0)); if(!L.length) return [];
      let i=-1; for(const f of after){ const j=L.indexOf(f); if(j>i) i=j; } if(i<0&&after.length){ i=-1; } const out=[];
      for(let k=1;k<=L.length&&out.length<3;k++){ const x=L[(i+k+L.length*4)%L.length]; if(out.indexOf(x)<0) out.push(x); } return out; },
    land(A,T,u){ const v=V(T), P=T.P; v.air=0; v.stats.land++;
      if(T.r.wb_4_1) A.acts(T,u,[{window:'yeCT',dur:30}],{u});                                                  // Catch and Throw: the next basic
      if(P.swb) u.blueCd=Math.max(0,(u.blueCd||0)-1);                                                            // Short Way Back: 1 s off Laughing Mark
      if(P.snap) A.acts(T,u,[{window:'yeSnap',dur:3}],{u});                                                     // Snapback
      const full=T.fn.arcFull(A,T,u);
      if(P.wyt&&v.wyT<=0&&full&&v.backFoes&&v.backFoes.length){ v.wyT=20; v.stats.sig1++; v.air=1; v.passEnd=1;             // Whatever You Throw: two more passes along the same path
        v.q.push({t:0.45,f:'pass',k:1.25,foes:v.backFoes.slice(),dmg:v.backDmg}); v.q.push({t:0.9,f:'pass',k:1.25*1.25,foes:v.backFoes.slice(),dmg:v.backDmg}); }
      v.keep=P['arc.keep']?Math.min(v.arc,P['arc.keep']):0; },
    pass(A,T,u,q){ const v=V(T); v.stats.pass++; for(const e of q.foes) if(e&&e.alive) T.fn.skillHit(A,T,u,e,q.dmg*q.k,BACK); },
    /* a hit of her skill a talent adds (Two Bones, Twice Back, the signature's passes): a real hit through the page's damage, as that skill's (its rows see it) */
    skillHit(A,T,u,t,amt,sk){ const E=A.eng(); if(!t||!t.alive||!u.alive||!E.strike||!(amt>0)) return; const pv=T.s.cur, d0=T.s.d; T.s.cur=sk; T.s.d=0; try{ E.strike(u,t,amt,'#e8dcc0'); } finally{ T.s.cur=pv; T.s.d=d0; } },
    arcCap(A,T){ return 3+(T.P['arc.cap']||0); },
    arcN(A,T){ return V(T).arc; },
    arcFull(A,T){ const v=V(T); return has(T,ARC)&&v.arc>0&&v.arc>=T.fn.arcCap(A,T)-1e-9; },
    cbh(A,T){ return Math.min(10,V(T).thrW); },
    rrHit(A,T){ return RRS.indexOf(T.s.cur)>=0; },
    nonRR(A,T){ return RRS.indexOf(T.s.cur)<0; },
    /* Heavy Arc: 1%/rank a held Arc on the return's crit chance, inside what the CRIT5 pool has left */
    haCh(A,T,u){ const room=Math.max(0,0.05-T.fn.critPool(A,T,u)/10000); return Math.min(room,0.01*rk(T,'wb_8_1')*V(T).arc); },
    /* ---- NOTCHES ---- */
    notch1(A,T,u){ if(A.stGet(T,'yeNotch')<A.stMax(T,u,'yeNotch')){ A.stSet(T,u,'yeNotch',A.stGet(T,'yeNotch')+1); V(T).stats.notch++; } },
    killF(A,T,u,c){ const v=V(T), P=T.P, cur=T.s.cur;
      if(has(T,NOTCH)) T.fn.notch1(A,T,u);                                                                       // a kill by Rending Return carves a Notch
      if(cur!==BACK) return;
      if(P.sc) u.greenCd=Math.max(0,(u.greenCd||0)-P.sc);                                                        // Sure Catch
      if(P.twice&&v.tbT<=0&&c.tgt){ v.tbT=12; v.stats.twice++; const L=T.fn.nextThree(A,T,u,[c.tgt]);           // Twice Back: once every 12 s, out again through the next three
        v.q.push({t:0,f:'twiceOut',foes:L,dmg:v.outDmg}); } },
    twiceOut(A,T,u,q){ for(const e of q.foes) if(e&&e.alive) T.fn.skillHit(A,T,u,e,q.dmg,RR); },
    /* ---- HER HITS: Calls (her basics on the enemy under her mark), Two Calls on the return, Return Cut, Tally, Stampede Bone ---- */
    hitF(A,T,u,c){ const P=T.P, t=c.tgt, cur=T.s.cur; if(!t||t.team===u.team) return; const r=rec(T,t);
      if(cur===RR||cur===BACK) r.sb=4;
      if(cur===BACK){ if(P.rcut) r.cut=3; if(P.tally) r.tally=2; if(P.twoCalls&&t.alive) T.fn.addCall(A,T,u,t,1); }
      if(c.auto&&t.alive&&has(T,CALL)&&T.fn.isMarked(A,T,u,t)){ T.fn.addCall(A,T,u,t,1); if(T.r.pl_10_4) A.run(T,u,'yeCtc',{u,tgt:t}); } },
    call2(A,T,u,c){ if(c.tgt&&c.tgt.alive) T.fn.addCall(A,T,u,c.tgt,1); },
    addCall(A,T,u,t,n){ if(!has(T,CALL)) return; const r=rec(T,t); if(r.called>0) return; r.call+=n; if(r.call>=CALLS) T.fn.becomeCalled(A,T,u,t); },
    becomeCalled(A,T,u,t){ const v=V(T), P=T.P, E=A.eng(), r=rec(T,t); r.call=0; r.called=4+(P['called.dur']||0); v.stats.called++;
      if(P.nl){ r.nervPend=1; if(T.r.af_1_1&&!r.calledW){ T.fn.addNerve(A,T,u,1); } }                           // Nervous Laughter (and its Raw Nerves half)
      r.calledW=1;
      if(P.ac&&u.alive) E.healUnit(u,P.ac*(u.maxHp||0));                                                         // Answering Call
      if(P.rh) for(const a of A.pick(T,u,{team:'ally',within:6},{u})) T.fn.addBreath(A,T,u,a,P.rh); },            // Rally Howl (Yenna too)
    /* ---- HER MARKS: Laughing Mark (the blue), and the marks her talents put on (Laugh at Them full, Laughing Stampede half, Run It Down's move,
       the signature's) - all on the engine's own mark (_markT, _markMul, _markBy), so every hit reads them as the game does ---- */
    lmCast(A,T,u,c){ const v=V(T), E=A.eng(), d=(c.o&&c.o.dur)||8;
      for(const x of E.units()) if(x.alive&&x.team!==u.team&&x._markBy===u&&Math.abs((x._markT||0)-d)<1e-6){ rec(T,x).mkOn=1; v.main=x; v.mkMul=x._markMul||v.mkMul; v.stats.marks++; break; } },
    fullMul(A,T,u){ const v=V(T), E=A.eng(); if(v.mkMul>0) return v.mkMul; return (E.skLvNum?E.skLvNum('markreveal',u.blueAb||{},(u.skillLv&&u.skillLv[2])||1):1.28)||1.28; },
    putMark(A,T,u,t,dur,half){ if(!t||!t.alive||t.team===u.team) return; const full=T.fn.fullMul(A,T,u), mul=half?1+(full-1)/2:full;
      t._markT=Math.max(t._markT||0,dur); t._markMul=Math.max(t._markMul||1,mul); t._markBy=u; rec(T,t).mkOn=1; V(T).stats.marks++; },
    isMarked(A,T,u,t){ const r=recOf(T,t); return !!(r&&r.mkOn&&(t._markT||0)>0); },
    marked(A,T,u,c){ return T.fn.isMarked(A,T,u,c.tgt); },
    calledT(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.called>0); },
    lined(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.lined>0); },
    cut(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.cut>0); },
    nerv(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.nervOn===V(T).throwId); },                                // Nervous Laughter: the throw after it became Called
    lowest(A,T,u,skip){ const E=A.eng(); let b=null,bv=2; for(const x of E.units()){ if(!x.alive||x.team===u.team||x===skip||x._dropHidden||x._noTarget) continue; const f=x.hp/x.maxHp; if(f<bv){ bv=f; b=x; } } return b; },
    /* ---- CRESCENT STAMPEDE: the enemies her talents count as marked for its ring (Stampede Bone, Shriek Stampede's cackle), cleared at the cast;
       each hop (Laughing Stampede: under her mark 3 s at half strength) ---- */
    ultKit(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(); v.ric=[];
      if(P.shriek){ for(const x of T.fn.cackle(A,T,u,'ult')){ x._yeRic=u; v.ric.push(x); } }
      if(P.sbone) for(const k in v.e){ const r=v.e[k]; if(r.sb>0&&r.u.alive&&v.ric.indexOf(r.u)<0){ r.u._yeRic=u; v.ric.push(r.u); } } },
    ultCast(A,T,u){ const v=V(T); for(const x of v.ric) if(x._yeRic===u) delete x._yeRic; v.ric=[]; },
    hopF(A,T,u,c){ const t=c.tgt; if(t&&t.alive) T.fn.putMark(A,T,u,t,3,true); },
    /* ---- BREATH (her team's heroes, Yenna included): 1 a critical hit on the enemy under her mark, 6 s after the last gain, 5 at most ---- */
    brRec(A,T,a){ const v=V(T); let b=v.br[a.uid]; if(!b) b=v.br[a.uid]={u:a,n:0,t:0}; return b; },
    addBreath(A,T,u,a,n){ if(!a||!a.alive||a._summon||a.team!==u.team||!has(T,BREATH)) return; const b=T.fn.brRec(A,T,a), was=b.n; b.n=Math.min(BR_MAX,b.n+n); b.t=BR_DUR; V(T).stats.br+=b.n-was;
      if(was<BR_MAX&&b.n>=BR_MAX&&T.r.pl_10_2) A.run(T,u,'yeBr5',{u,unit:a,tgt:a}); },
    shareBr(A,T,u,c){ const E=A.eng(), a=c.unit; if(!a) return; let b=null,bd=1e18; for(const x of E.units()){ if(!x.alive||x.team!==u.team||x===a||x._summon) continue; const d=E.dist(a,x); if(d<bd){ bd=d; b=x; } } if(b) T.fn.addBreath(A,T,u,b,1); },
    brOf(A,T,u,c){ const b=c&&c.tgt&&V(T).br[c.tgt.uid]; return b?b.n:0; },
    br3(A,T,u,c){ return T.fn.brOf(A,T,u,c)>=3?1:0; },
    br5(A,T,u,c){ return T.fn.brOf(A,T,u,c)>=BR_MAX?1:0; },
    /* ---- HER TEAM'S HITS: on an enemy (the mark's riders, Called, Litter Mates, Lean Year, Second Scent, Point the Way; Breath and energy from
       crits on the marked; who hit it) or on one of her allies (ALLY20) ---- */
    tIn(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt, s=c.src; if(!t||!s) return;
      if(t.team===u.team){ if(t!==u&&!t._summon&&s.team!==t.team) c.amt*=T.fn.allyK(A,T,u,s); return; }
      if(s.team!==u.team) return; const r=rec(T,t); let k=1;
      if(!s._summon) r.hb[s.uid]={u:s,t:3};
      const mk=T.fn.isMarked(A,T,u,t);
      if(mk){ if(P.pp) k*=1+P.pp; if(P.litter&&v.lane&&v.lane.indexOf(s)>=0) k*=1+P.litter;
        if(c.crit&&!s._summon){ T.fn.addBreath(A,T,u,s,1); const en=(P.ecb||0)+(r.sigE>0?6:0); if(en>0) s.energy=Math.max(0,Math.min(100,(s.energy||0)+en)); } }
      if(P.cc&&c.auto&&r.called>0) k*=1+P.cc;
      if(P.ly&&s!==u&&t.hp<0.35*t.maxHp) k*=1+P.ly;
      if(P.scent&&t===v.scent) k*=1+P.scent;
      if(P.ptw&&r.lat>0) k*=1+P.ptw;
      c.amt*=k; },
    thinN(A,T,u,c){ const r=recOf(T,c.tgt); if(!r) return 0; let n=0; for(const h in r.hb){ const x=r.hb[h]; if(x.u!==u&&x.t>0) n++; } return Math.min(5,n); },
    allyK(A,T,u,s){ const P=T.P; let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); }; const r=recOf(T,s);
      if(r){ if(P.pf&&r.called>0) cut(P.pf); if(P.re&&r.ring>0) cut(P.re); } return Math.max(ALLY_FLOOR,k); },
    /* ---- DR40: her damage-reduction talents, ONE product on her, kept share floored at 0.60 (the 95% probe reads drK) ---- */
    drK(A,T,u,s){ const v=V(T), P=T.P, E=A.eng(); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P.chalk&&v.air) cut(P.chalk);                                                                            // Chalk Flats Hide: the bone in the air
      if(P.wt) cut(P.wt*stN(T,'yeNerve'));                                                                        // Wound Tight (Strung Tight)
      if(P.ld&&u.hp<0.30*u.maxHp) cut(P.ld);                                                                      // Last Ditch
      if(P.brr&&A.winOn(T,'yeBrR')) cut(P.brr);                                                                   // Breathing Room
      if(s){ if(P.wary&&A.gap(u,s)<3*E.METER()) cut(P.wary);                                                     // Wary
        const r=recOf(T,s); if(r){ if(P.pf&&r.called>0) cut(P.pf); if(P.re&&r.ring>0) cut(P.re); } }          // Pack Feast, Ringing Ears
      return Math.max(DR_FLOOR,k); },
    myDr(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c.src); },
    /* ---- A HIT ON HER: Nerves (2 below half with Cold Pups), Hackles, the signature at 40% ---- */
    hurtF(A,T,u,c){ const v=V(T), P=T.P, s=c.src;
      if(has(T,NERVE)) T.fn.addNerve(A,T,u,(P.cold&&u.hp<0.5*u.maxHp)?2:1);
      if(P.hack&&s&&s.alive&&s.melee) A.acts(T,u,[{slow:P.hack,dur:1,on:'source'}],{u,src:s});
      if(P.aase&&v.afT<=0&&u.alive&&u.hp<0.40*u.maxHp&&u.hp+(c.hpLost||0)>=0.40*u.maxHp) T.fn.sig3(A,T,u); },
    /* ---- NERVES AND THE CACKLE ---- */
    addNerve(A,T,u,n){ if(!has(T,NERVE)||!(n>0)) return; const v=V(T), P=T.P; A.stSet(T,u,'yeNerve',stN(T,'yeNerve')+n);
      if(P.ck&&v.ckT<=0&&stN(T,'yeNerve')>=Math.max(5,NERVE_MAX-(P.shake||0))-1e-9) T.fn.cackle(A,T,u,'nerves'); },
    nerveHold(A,T){ return V(T).s3>0; },                                                                          // the signature: her Nerves do not fade for 6 s
    /* a cackle: every Nerve spent (Echoing Cackle keeps 5), each enemy within 3 m feared 0.3 s/rank (Shriek Stampede's at least 0.9 s), then Shrill, Laugh It
       Off / Laugh at Them, Ringing Ears, Keep Laughing, Breathing Room. At most once every 4 s (Shriek Stampede's sets the lock too). Returns those feared. */
    cackle(A,T,u,why){ const v=V(T), P=T.P, E=A.eng(); v.ckT=CK_LOCK; v.stats.ck++;
      A.stSet(T,u,'yeNerve',T.r.af_9_2?Math.min(5,stN(T,'yeNerve')):0);
      const secs=Math.max(why==='ult'?0.9:0,P.ck||0), out=[];
      if(secs>0) for(const x of A.pick(T,u,{team:'enemy',within:3},{u})) if(T.fn.fear(A,T,u,x,secs)) out.push(x);
      for(const x of out){ const r=rec(T,x);
        if(P.shrill&&x.alive) A.hurt(T,u,x,P.shrill*(u.dmg||0)*E.rage()*E.defMul(u,x,'phys'),'#e8d8a0','shrill');
        if(P.lat&&x.alive){ T.fn.putMark(A,T,u,x,3,false); r.lat=3; }
        if(P.re) r.ring=3; }
      if(P.lio&&u.alive) E.healUnit(u,P.lio*(u.maxHp||0));
      if(T.r.af_12_2) A.stSet(T,u,'yeKL',stN(T,'yeKL')+1);
      if(T.r.af_11_4) A.acts(T,u,[{window:'yeBrR',dur:3}],{u});
      return out; },
    /* a fear of hers: the engine's control path (full written length, Long Fright through ccOut, the fear ceiling), the enemy runs from her */
    fear(A,T,u,x,secs){ const v=V(T); if(!x||!x.alive||x.team===u.team||x.stunImmune) return false; A.control(T,u,x,'fearT',secs); if(!((x.fearT||0)>0)) return false;
      x._fearFrom=u; rec(T,x).fearMine=1; v.stats.fear++; if(T.r.af_9_3) A.stSet(T,u,'yeFF',stN(T,'yeFF')+1); return true; },
    /* AFRAID AT SOMEBODY ELSE: once every 25 s, a hit takes her below 40% - enemies within 5 m feared 1.5 s and bleeding (20% of her attack a second, 3 s),
       Rending Return ready, Nerves full and not fading for 6 s, the return double on feared enemies for those 6 s */
    sig3(A,T,u){ const v=V(T), E=A.eng(); v.afT=25; v.s3=6; v.stats.sig3++;
      for(const x of A.pick(T,u,{team:'enemy',within:5},{u})){ T.fn.fear(A,T,u,x,1.5); if(x.alive) A.acts(T,u,[{dot:'yeBleed',on:'target',amt:{pct:0.20,of:'atk'},dur:3,every:1,color:'#c0392b'}],{u,tgt:x}); }
      u.greenCd=0; A.stSet(T,u,'yeNerve',NERVE_MAX); },
    s3Feared(A,T,u,c){ return V(T).s3>0&&!!c.tgt&&(c.tgt.fearT||0)>0; },
    /* ---- AN ENEMY FALLS: the enemy under her mark (Echo Laugh, Hunt Song, Breath for the Next, Run It Down, the signature), Fed Clan, Tally, Hunted Hunter ---- */
    deathF(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), x=c.unit; if(!x||x.team===u.team) return; const r=recOf(T,x);
      if(P.hh&&u.alive&&(x.fearT||0)>0) E.healUnit(u,P.hh*(u.maxHp||0));                                          // Hunted Hunter
      if(!r) return;
      if(P.tally&&u.alive&&r.tally>0) E.healUnit(u,P.tally*(u.maxHp||0));                                          // Tally
      if(P.fed&&r.called>0){ const k=x._talBy; if(k&&k.alive&&k.team===u.team&&!k._summon) E.healUnit(k,P.fed*(k.maxHp||0)); }   // Fed Clan: the ally that killed it
      if(!(r.mkOn&&(x._markT||0)>0)) return;
      if(P.echo) u.blueCd=Math.max(0,(u.blueCd||0)-P.echo);                                                        // Echo Laugh
      if(T.r.pl_11_3) A.stSet(T,u,'yeHS',stN(T,'yeHS')+1);                                                       // Hunt Song
      if(P.bftn) for(const h in r.hb){ const y=r.hb[h]; if(y.t>0&&y.u.alive){ T.fn.addBreath(A,T,u,y.u,1); const b=v.br[y.u.uid]; if(b&&b.n>0) b.t+=6; } }   // Breath for the Next
      if(P.rid){ const n=T.fn.lowest(A,T,u,x); if(n){ const left=x._markT, mul=x._markMul||T.fn.fullMul(A,T,u); n._markT=Math.max(n._markT||0,left); n._markMul=Math.max(n._markMul||1,mul); n._markBy=u; rec(T,n).mkOn=1; if(x===v.main) v.main=n; v.stats.move++;
          if(P.dtl) A.acts(T,u,[{window:'yeDtl',dur:3}],{u}); } }                                                  // Run It Down (Down the Line)
      if(P.wcg&&v.wcT<=0){ v.wcT=20; v.stats.sig2++;                                                              // Where the Clan Goes
        for(const a of E.units()) if(a.alive&&a.team===u.team&&!a._summon){ const b=T.fn.brRec(A,T,a); b.n=BR_MAX; b.t=BR_DUR; }
        const n=T.fn.lowest(A,T,u,x); if(n){ const d=8+0.5*rk(T,'pl_2_1'); T.fn.putMark(A,T,u,n,d,false); v.main=n; const rn=rec(T,n); rn.sigE=6; if(rn.called<=0) T.fn.becomeCalled(A,T,u,n); } } },
    /* ---- her cooldowns: Rending Return (Quick Catch, Quick Paws, Fifth Notch at 5 Notches), Laughing Mark (Pick the Limping) ---- */
    cdSet(A,T,u,c){ const P=T.P; let x=c.amt;
      if(c.slot==='green') x-=(P['cd.rr']||0)+((P['cd.fifth']&&stN(T,'yeNotch')>=5)?P['cd.fifth']:0);
      else if(c.slot==='blue') x-=(P['cd.lm']||0);
      c.amt=Math.max(0,x); },
    /* ---- PACK OPPORTUNIST, as the page reads it (no ally of the target within 3.5 m centre to centre; stunned, feared, slowed or airborne; below 35%):
       Opportunist's Eye +1 point/rank whenever it applies, Something Has Hold +2 points/rank when the target is held, Limping One raises the low-health line ---- */
    poState(A,T,u,t){ const E=A.eng(); if(!t) return null; let alone=true; for(const o of E.units()) if(o!==t&&o.alive&&o.team===t.team&&E.dist(o,t)<3.5*E.METER()){ alone=false; break; }
      const held=(t.stunned>0||(t.fearT||0)>0||(t.slow||0)>0||(t._airT||0)>0), f=t.hp/t.maxHp, dying=f<0.35, limp=f<0.35+(T.P['po.limp']||0);
      return {alone,held,dying,limp,on:alone||held||dying}; },
    poAdj(A,T,u,c){ const P=T.P, t=c.tgt; if(!t||t.team===u.team||!(u.pass&&u.pass.packopp)) return; const s=T.fn.poState(A,T,u,t); if(!s) return;
      const base=0.28*(u.passMul||1), add=(P['po.eye']||0)+(s.held?(P['po.hold']||0):0);
      if(s.on) c.amt*=(1+base+add)/(1+base); else if(s.limp) c.amt*=1+base+add; },
    poOn(A,T,u,c){ const s=T.fn.poState(A,T,u,c.tgt); return !!(s&&(s.on||s.limp)); },
    alone(A,T,u,c){ const s=T.fn.poState(A,T,u,c.tgt); return !!(s&&s.alone); },
    held(A,T,u,c){ const s=T.fn.poState(A,T,u,c.tgt); return !!(s&&s.held); },
    feared(A,T,u,c){ return !!c.tgt&&(c.tgt.fearT||0)>0; },
    gripped(A,T,u,c){ const t=c.tgt; return !!t&&((t.fearT||0)>0||(t.stunned||0)>0||(t.slow||0)>0); },
    near3(A,T,u){ return Math.min(3,A.pick(T,u,{team:'enemy',within:3},{u}).length); },
    /* CRIT5: Bone Sight, Sharp Teeth, Notched Grip (a Notch), Nerve Ends (a Nerve) - hundredths of a percent, 5% at most (Heavy Arc reads what is left) */
    critPool(A,T){ const x=100*rk(T,'wb_1_2')+150*rk(T,'pl_2_3')+30*rk(T,'wb_9_4')*stN(T,'yeNotch')+20*rk(T,'af_8_1')*stN(T,'yeNerve'); return Math.min(CRIT_POOL,x); }
  },
  partial:{},
  ruling:{}
};
