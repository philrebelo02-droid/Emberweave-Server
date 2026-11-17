/* HURNE - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Hurne": what he added)
   His real kit (the code, not the tooltip wording; a melee Bruiser, every skill reads Attack, his damage is physical):
   - Unchain the Dead ('summonwarriors', green, cd 12): o.n (3) Boar Warriors ('boar warrior') rise beside him on his clip's ground frame (a fuse ~0.5 s
     after the release), each for o.dur (15 s), 55% of his max HP and 50% of his attack x the skill level's share, +120 armor / +60 MR. They only
     basic-attack (melee). At most 6 warriors stand at once (SUMMON_CAPS); a call over the cap fails.
   - Call the Bone-Chanter ('summonshaman', blue, cd 14): one Boar Shaman ('boar shaman', the old sow, at most 2) rises in his back row for o.dur (18 s),
     42% HP / 30% attack / ability power 55% of his attack x share. Her own kit: Bone Chant (a 5 m ground circle that heals her side and burns enemies
     each second for 4 s, after a 1.5 s lead; healUnit with no caster) and Pyre Grunt (an aoedot). The page's partPre / part pair named 'chant' sits around
     the circle's heal pass when the circle is a talented Hurne's summon's, so his rows know a heal is hers.
   - Feed Them (ultimate 'devourpack', energy; ULT_DEF.devourpack mul 1.2, healPct 1, shieldPct 0.6, dmgPct 0.9, dur 8, radius 3 m; HERO_ULT_ART.hurne is
     art): +10% damage, attack speed and the one damage-reduction slot for 10 s, +3% each per summon taken; then every summon of his is killed and taken
     in (killSummon: no death hook), he heals their HP left, shields 60% of it for 8 s, and for 8 s every hit of his carries +90% of their attack
     (_devourT / _devourBonus: "the strength it carries"); the rupture hits every enemy within 3 m of his CENTRE (centre to centre: it reached nobody in
     93 of 93 measured casts; release v1391 measures to the enemy's body edge). The kit hook runs before the case picks the pack.
   - Packmaster (passive 'packstats'): each tick u._packN = his living summons; his hits x(1 + 0.05 x passMul x N), hits on him / (1 + 0.05 x passMul x N).
   Driven, Kept Close, Cost, Carried, Chained and Smoulder exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/29 - HURNE - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const UD='summonwarriors', BC='summonshaman', FT='devourpack', WK='boar warrior', SK='boar shaman';
const MINE={team:'ally',mine:true};
/* the states several talents read: their bookkeeping runs when any of these is learned */
const DRV=['sw_1_1','sw_3_1','sw_5_1','sw_7_1','sw_9_1','sw_10_1','sw_12_1','sw_13_3'];                 // Driven
const COST=['ft_1_1','ft_2_1','ft_3_1','ft_n1','ft_10_1','ft_11_1','ft_13_2'];                          // Cost
const CAR=['ft_1_2','ft_2_2','ft_5_1','ft_11_2','ft_12_2','ft_5_3','ft_6_3','ft_13_2'];                 // Carried
const FEED=CAR.concat(COST,['ft_5_2','ft_3_3']);                                                       // what Feed Them takes and stores (and its shield's window: Grave Dirt)
const CH=['br_1_1','br_2_1','br_3_1','br_6_1','br_7_1','br_9_1','br_5_2','br_5_3','br_6_3','br_10_1','br_11_1','br_3_3'];   // Chained (on his basic attacks)
const SMO=['br_1_4','br_3_4','br_5_4','br_7_3','br_7_4','br_9_4','br_10_4','br_12_4','br_13_2'];        // Smoulder (gained near his warriors)
const DRH=['sw_8_4','ft_8_1','br_8_1','ft_8_2','ft_12_3','br_12_2','sw_10_4','br_2_2','sw_3_4','ft_11_1','ft_1_2'];   // his own damage reduction: ONE capped group (40%)
const PKO=['sw_10_4','sw_3_4','ft_11_1','ft_1_2'];                                                     // Packmaster's damage dealt changed / Carried's damage dealt
const DRS=['br_1_1','br_4_2','sw_6_2','sw_12_3','br_8_2','br_11_2','br_13_2'];                          // his summons' damage reduction: ONE capped group (50%)
const SLW=['sw_11_4','ft_8_3','br_8_3'];                                                               // slows on him weaker: ONE capped group (40%)
const CRT=['sw_10_3','ft_7_3','br_7_3'];                                                               // his crit chance talents: 5% in all
const HEAL=['sw_4_2','br_6_4','ft_5_2','sw_11_3'];                                                     // the Bone-Chanter's heals (the 'chant' part)
const DR_CAP=0.40, SDR_CAP=0.50, SLOW_CAP=0.40, CRIT_CAP=5;
/* ---- helpers ---- */
const gapM=(E,a,b)=>(E.dist(a,b)-E.bodyR(a)-E.bodyR(b))/E.METER();                      // metres body to body
const mineL=(A,T,u)=>A.mineOf(T,u).filter(x=>x.alive&&x._summonOwner===u);               // his summons standing now (a Leave the Old Sow shaman is counted once it is given back)
const kcR=T=>4+(T.P['kc.m']||0);                                                          // Kept Close: within 4 m of him, body to body (Short Tether: farther)
const isKc=(A,T,u,x)=>!!x&&x.alive&&x._talS===u&&gapM(A.eng(),u,x)<kcR(T);
const kcN=(A,T,u)=>{ let n=0; for(const x of mineL(A,T,u)) if(isKc(A,T,u,x)) n++; return n; };
const drvOf=(A,T,u)=>{ const h=T.s.m.hDrv; return (h&&h.alive&&A.markOf(u,h,'hDrv'))?h:null; };
const shamanUp=(A,T,u)=>mineL(A,T,u).some(x=>x.key===SK);
const chainedL=(A,T,u)=>A.pick(T,u,{team:'enemy',has:'hCh'},{u});
/* Packmaster with his talents: N = what the engine counts this tick (u._packN); N2 = Kept Close summons counted twice (Stay Together) and himself as 3 at
   5 Cost (Nothing Left to Lose); per summon 0.05 x passMul, +0.5% per rank dealt (Packmaster's Weight) and shrugged off (and Stand Before Them) */
function pack(A,T,u){ if(!(u.pass&&u.pass.packstats)) return null; const N=+u._packN||0, b=0.05*(u.passMul||1); let N2=N;
  if(T.r.sw_3_4) N2+=kcN(A,T,u); if(T.r.ft_11_1&&A.stGet(T,'hCost')>=5) N2+=3;
  return {N,N2,b,xd:0.005*(T.r.sw_10_4||0),xs:0.005*((T.r.sw_10_4||0)+(T.r.br_2_2||0))}; }
/* "behind him": one of his summons within 3 m of him (body to body) and farther than he is from the enemies' middle (Between Them) */
function behindOne(A,T,u){ const E=A.eng(), F=E.units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden); if(!F.length) return false;
  let cx=0, cy=0; for(const f of F){ cx+=f.x; cy+=f.y; } cx/=F.length; cy/=F.length; const du=Math.hypot(u.x-cx,u.y-cy);
  return mineL(A,T,u).some(x=>gapM(E,u,x)<3&&Math.hypot(x.x-cx,x.y-cy)>du); }
/* a talent stun of his (or of his herd): never on an enemy that is stunned, nor within 0.5 s after one of his stuns on it ended (the lock mark 'hLk').
   Each landed stun is logged on T.s.hStL ([uid, start, seconds]) for the tests' stun-chain measure */
function tstun(A,T,u,t,secs){ if(!t||!t.alive||t.team===u.team||!(secs>0)) return false; if((t.stunned||0)>0||A.markOf(u,t,'hLk')) return false;
  A.control(T,u,t,'stunned',secs); const d=t.stunned||0; if(!(d>0)) return false;
  A.setMark(T,u,t,'hLk',{dur:d+0.5}); const L=T.s.hStL||(T.s.hStL=[]); if(L.length<400) L.push([t.uid,A.eng().now(),d]); return true; }
function addSmo(A,T,u,t,n){ if(!t||!t.alive||t.team===u.team||!(n>0)) return; A.acts(T,u,[{ustack:'hSmo',on:'target',add:n}],{u,src:u,tgt:t}); }
module.exports={
  hero:'hurne',
  times:['hAnyT'],   // this file's own absolute fight times (paths in T.s): the engine moves them back with the clock at each wave (WIRING/41c)
  casting:true,                         // rows ask which of his skills a hit comes from (the rupture), and when a heal is the Bone-Chanter's ('chant')
  summons:true,                         // his summons carry his rows (the summon hook)
  states:{
    hCost:{max:5},                                                                 // Cost (for the fight)
    hCar:{max:P('car.max',6),wave:'reset'},                                         // Carried (Stored Herd: more), until the wave ends
    hSmo:{unit:true,max:P('smo.max',5),dur:P('smo.f',1.5),step:P('smo.f',1.5)}     // Smoulder on enemies: one fades every 1.5 s after the last gain (Slow Embers: slower)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'hit',reqAny:DRV,if:{targetTeam:'enemy',targetAlive:true},do:[{mark:'hDrv',on:'target',unique:true}]},   // Driven: the enemy he hit last
    {on:'tick',reqAny:DRV,do:[{fn:'drvTurn'}]},                                                                     //   his summons turn on it
    {on:'death',reqAny:['sw_12_1'],if:{who:'enemy',unitHas:'hDrv'},do:[{fn:'valley'}]},                              //   Whole Valley: the next one
    {on:'hit',reqAny:CH,if:{auto:true,targetTeam:'enemy',targetAlive:true},do:[{fn:'chain'}]},                       // Chained: each basic attack
    {on:'tick',reqAny:CH.concat(['br_13_2']),period:0.1,do:[{fn:'leash'}]},                                         //   it cannot get farther from him than its chain
    {on:'tick',reqAny:SMO,period:1,do:[{fn:'smoScan'}]},                                                            // Smoulder: each second near his warriors, and its burn
    {on:'death',reqAny:['br_10_4'],if:{who:'enemy',unitUst:{hSmo:1}},do:[{fn:'embers'}]},                            //   Embers Spread
    {on:'in',reqAny:DRH,do:[{fn:'myDr'}]},                                                                          // his damage reduction (one capped group)
    {on:'out',reqAny:PKO,do:[{fn:'myOut'}]},                                                                        // Packmaster's and Carried's damage dealt
    {on:'teamIn',reqAny:DRS,if:{targetMine:true,srcTeam:'enemy'},do:[{fn:'sumDr'}]},                                // his summons' damage reduction (one capped group)
    {on:'tick',reqAny:SLW,do:[{fn:'slowW'}]},                                                                       // slows on him weaker (one capped group)
    {stat:{crit:0.01},reqAny:['sw_10_3','ft_7_3'],per:{fn:'critN'}},                                                // Smell of Home + Crushing Grip (5% in all, with Grave Grip)
    {on:'kit',skill:UD,if:{p:'w.dur'},opt:{dur:{add:P('w.dur',0)}}},                                                // Called Back / Fed Herd: his warriors stay longer
    {on:'kit',skill:FT,reqAny:FEED,do:[{fn:'feedKit'}]},                                               // Feed Them: what it takes (Leave the Old Sow keeps her back)
    {on:'cast',skill:FT,reqAny:FEED,do:[{fn:'feedCast'}]},                                             //   and what it stores and costs
    {on:'teamHeal',reqAny:HEAL,if:{casting:'chant'},do:[{fn:'chantHeal'}]},                                         // the Bone-Chanter's heals
    {on:'healMe',reqAny:HEAL,if:{casting:'chant'},do:[{fn:'chantHeal'}]},
    {on:'wave',reqAny:['ft_12_3'],do:[{fn:'waveT'}]},                                                               // when the wave started (Grim Patience)
    {on:'wave',do:[{fn:'keep'}]},                                                                                   // the runtime API kept for the tests' probes (a pure read; once a wave)
    {on:'tick',reqAny:['ft_5_2'],do:[{fn:'sowBack'}]}                                                               // a Bone-Chanter kept back is his again (if a Feed Them never finished)
  ],
  talents:{
    /* ============================== THE SWINEHERD ============================== */
    sw_1_1:[ {on:'sOut',if:{targetHas:'hDrv'},more:R(0.03)} ],                                                   // Point the Way: Driven (the always rows), his summons 3% more to it
    sw_2_2:[ {stat:{move:R(0.03)}} ],                                                                            // Herder's Walk
    sw_1_4:[ {on:'sOut',if:{fn:'kcSrc'},more:R(0.02)} ],                                                          // Bring Them In: Kept Close
    sw_2_3:[ {on:'summon',if:{unitKey:WK},do:[{unitStat:{hp:R(0.02)},on:'unit'}]} ],                              // Armoured Herd
    sw_2_4:[ {param:'kc.m',add:R(0.5)} ],                                                                        // Short Tether
    sw_3_1:[ {on:'out',if:{targetHas:'hDrv'},more:R(0.02)} ],                                                     // Drive Them
    sw_3_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                    // Chain Weight
    sw_4_3:[ {on:'sOut',if:{srcKey:WK},more:R(0.04)} ],                                                           // Iron Tusks
    sw_3_4:[],                                                                                                   // Stay Together (pack: Kept Close summons count twice)
    sw_4_2:[ {param:'ch.heal',add:R(0.04)} ],                                                                    // Old Sow's Care (chantHeal)
    sw_5_2:[ {on:'summon',if:{unitKey:WK,unitExtra:false},do:[{unitStat:{hp:0.2,atk:0.2},on:'unit'}]} ],          // Three Strong (PICK ONE)
    sw_5_3:[ {on:'kit',skill:UD,opt:{n:{set:4}}},                                                                 // Four of Them (PICK ONE): 4 warriors
             {on:'summon',if:{unitKey:WK,unitExtra:false},do:[{unitStat:{hp:-0.15,atk:-0.15},on:'unit'}]} ],      //   each 15% weaker
    sw_5_1:[ {stat:{move:R(-0.03)},to:{team:'enemy',has:'hDrv'}} ],                                               // Whistle
    sw_6_1:[ {on:'death',if:{unitMine:true},do:[{window:'hHi',dur:4}]}, {stat:{aspd:R(0.05)},to:MINE,if:{window:'hHi'}} ],   // Herd Instinct (a summon KILLED)
    sw_6_2:[ {param:'dr.boar',add:R(0.03)} ],                                                                    // Old Boars (sumDr)
    sw_5_4:[ {stat:{mr:R(0.02)},if:{fn:'kc2'}} ],                                                                 // Patient Man
    sw_7_1:[ {stat:{armor:R(-0.02)},to:{team:'enemy',has:'hDrv'}} ],                                              // Mark for the Herd
    sw_6_3:[ {on:'kit',skill:BC,opt:{dur:{add:R(0.4)}}} ],                                                        // Bone Song
    sw_6_4:[ {on:'tick',period:1,do:[{heal:{pct:R(0.004),of:'tgtMaxHp'},on:{team:'ally',mine:true,fn:'kcX'}}]} ],  // Fed Well (0.4%: the regeneration cap at 3/3)
    sw_7_2:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                               // Quick Unchaining
    sw_10_3:[],                                                                                                  // Smell of Home (the crit row in always)
    sw_8_2:[ {on:'cd',skill:'blue',add:R(-0.4)} ],                                                                // Sow's Patience
    sw_8_3:[ {param:'w.dur',add:R(0.5)} ],                                                                       // Called Back
    sw_8_4:[ {param:'dr.hard',add:R(0.01)} ],                                                                    // Hard to Stop (myDr)
    sw_9_1:[ {on:'summon',if:{unitKey:WK,unitExtra:false,holderAlive:'hDrv'},do:[{place:'unit',near:'holder:hDrv'}]} ],   // Run It Down
    sw_9_4:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                            // Root and Snout
    sw_10_1:[ {stat:{aspd:R(0.005)},per:{fn:'drvAtk'}} ],                                                         // Driven Hard
    sw_10_4:[],                                                                                                  // Packmaster's Weight (pack)
    sw_11_2:[ {stat:{armor:R(0.005)},per:{fn:'mineN'}} ],                                                         // Never Asked
    sw_11_3:[ {on:'summon',if:{unitKey:SK},do:[{fn:'herdUp'}]},                                                   // The Whole Herd: a warrior with her
              {on:'part',skill:'chant',do:[{fn:'herdHeal'}]} ],                                                   //   and her healing reaches every summon of his
    sw_11_4:[ {param:'slw',add:R(0.04)} ],                                                                       // Steady Man (slowW)
    sw_12_1:[ {stat:{aspd:R(0.05)},to:MINE,if:{window:'hWv'}} ],                                                  // Whole Valley (the always death row)
    sw_12_2:[ {on:'sKill',do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                                                // Good at It
    sw_12_3:[ {param:'dr.tend',add:R(0.01)} ],                                                                   // She Tends Them (sumDr)
    sw_13_3:[ {on:'tick',if:{fn:'chargeReady'},icd:25,do:[{fn:'charge'}]},                                        // Nobody Walks Around (SIGNATURE)
              {on:'teamLethal',if:{unitMine:true,window:'hNwa'},do:[{atOne:'unit'}]} ],                           //   for 6 s the herd cannot drop below 1 HP

    /* ============================== FEED THEM ============================== */
    ft_1_1:[ {stat:{atk:R(0.02)},per:'hCost'} ],                                                                  // What It Costs (feedCast pays the Cost)
    ft_1_2:[ {param:'car.k',add:R(0.006)} ],                                                                     // Carry Their Strength (myOut / myDr)
    ft_5_4:[ {stat:{move:R(0.03)}} ],                                                                            // Heavy Tread
    ft_2_1:[ {stat:{lifesteal:R(0.005)},per:'hCost'} ],                                                           // Pay Gladly
    ft_2_2:[ {stat:{aspd:R(0.005)},per:'hCar'} ],                                                                 // Heavy With Them
    ft_3_1:[ {on:'kit',skill:FT,if:{stackMin:{hCost:5}},opt:{radius:{addM:2}}} ],                                 // Overfed: 5 m at 5 Cost
    ft_n1:[  {on:'out',if:{casting:FT},more:0.04,per:'hCost'},                                                   // Smoke of the Feast (LINK)
             {on:'hit',req:'br_1_4',if:{casting:FT,targetTeam:'enemy',targetAlive:true},do:[{ustack:'hSmo',on:'target',add:2}]} ],
    ft_3_3:[ {stat:{armor:R(0.03)},if:{fn:'fedShield'}} ],                                                        // Grave Dirt
    ft_3_4:[ {on:'kit',skill:FT,opt:{shieldPct:{more:R(0.03)}}} ],                                                // Thick Neck
    ft_5_1:[ {stat:{mr:R(0.02)},if:{stackMin:{hCar:1}}} ],                                                        // Old Oath
    ft_4_2:[ {on:'out',if:{casting:FT},more:R(0.05)} ],                                                           // Torn Open
    ft_2_3:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                            // Chained Arms
    ft_6_2:[ {on:'kit',skill:FT,opt:{healPct:{more:R(0.03)}}} ],                                                  // Supper Table
    ft_5_2:[ {param:'keepSow',add:1},                                                                            // Leave the Old Sow (PICK ONE; feedKit keeps her back)
             {on:'healMe',if:{casting:'chant',selfMin:{_devourT:0.001}},more:0.30} ],                             //   she heals him 30% more while he carries the others
    ft_5_3:[ {param:'sow2',add:1} ],                                                                             // Take Them All (PICK ONE): 2 Carried for her (feedCast)
    ft_7_4:[ {on:'cast',skill:FT,do:[{field:'_devourT',add:R(0.4),if:{selfMin:{_devourT:0.001}}}]} ],             // Strength in Every Blow
    ft_6_3:[ {param:'sowSh',add:R(0.02)} ],                                                                      // Nothing Wasted (feedCast)
    ft_6_4:[ {on:'hit',if:{casting:FT,targetTeam:'enemy',targetAlive:true},do:[{slow:R(0.10),dur:2,on:'target'}]} ],   // Bitter Meat
    ft_7_1:[ {on:'cast',skill:FT,do:[{cd:'green',set:0},{cd:'blue',set:0}]} ],                                    // Call Them Again
    ft_7_3:[],                                                                                                   // Crushing Grip (the crit row in always)
    ft_8_1:[ {param:'dr.skin',add:R(0.01)} ],                                                                    // Thick Skin (myDr)
    ft_10_3:[ {stat:{aspd:R(0.02)},if:{selfMin:{_devourT:0.001}}} ],                                              // Raw Hands
    ft_8_2:[ {param:'dr.pain',add:R(0.02)} ],                                                                    // Swallowed Pain (myDr)
    ft_8_3:[ {param:'slw',add:R(0.08)} ],                                                                        // Gristle (slowW)
    ft_9_2:[ {on:'ccIn',if:{cc:['stunned','slow'],selfMin:{_devourT:0.001}},mul:0} ],                             // Unbreakable Oath
    ft_9_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                    // Grave Chains
    ft_9_4:[ {on:'out',if:{casting:FT,targetHpBelow:0.5},more:R(0.03)} ],                                         // Last Meal
    ft_10_1:[ {stat:{hp:R(0.003)},per:'hCost'} ],                                                                 // Cost Taken
    ft_10_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                              // Shallow Grave
    ft_11_1:[],                                                                                                  // Nothing Left to Lose (pack)
    ft_11_2:[ {param:'car.max',add:R(1)} ],                                                                      // Stored Herd
    ft_11_4:[ {on:'out',if:{selfHpBelow:0.4},more:R(0.02)} ],                                                     // No Name for It
    ft_12_2:[ {on:'hit',if:{auto:true,stackMin:{hCar:6},targetTeam:'enemy'},do:[{dmg:{pct:R(0.06),of:'hit'},on:{team:'enemy',of:'target',within:1.5,skip:'target'},tag:'belly'}]} ],   // Full Belly
    ft_12_3:[ {param:'dr.grim',add:R(0.02)} ],                                                                   // Grim Patience (myDr)
    ft_12_4:[ {on:'hit',if:{casting:FT,targetTeam:'enemy'},do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],               // Shared Grave
    ft_13_2:[ {on:'tick',edge:true,if:{selfHpBelow:0.30},do:[{fn:'anyway'}]} ],                                   // He Does It Anyway (SIGNATURE: once every 30 s)

    /* ============================== BETWEEN THEM AND THE ROAD ============================== */
    br_1_1:[ {param:'dr.chain',add:R(0.015)} ],                                                                  // The Chains (Chained: the always rows; sumDr)
    br_2_3:[ {stat:{move:R(0.03)}} ],                                                                            // Road Feet
    br_1_4:[ {param:'smo.burn',add:R(0.02)} ],                                                                   // Her Young (Smoulder's burn: smoScan)
    br_2_1:[ {param:'ch.short',add:R(1)} ],                                                                      // Shorter Chain
    br_2_2:[],                                                                                                   // Stand Before Them (pack)
    br_3_1:[ {param:'drag',add:1} ],                                                                             // Dragged Back (leash)
    br_3_3:[ {stat:{atk:R(0.02)},if:{fn:'anyCh'}} ],                                                              // Weighted Fists
    br_3_4:[ {param:'smo.f',add:R(0.4)} ],                                                                       // Slow Embers
    br_4_1:[ {on:'ccIn',less:R(0.04)} ],                                                                          // Unmoved Man (up to 20%)
    br_4_2:[ {param:'dr.wall',add:R(0.03)} ],                                                                    // Wall of Herd (sumDr)
    br_4_3:[ {on:'cd',skill:'blue',add:R(-0.4)} ],                                                                // Bone Fire
    br_6_2:[ {param:'w.dur',add:R(0.5)} ],                                                                       // Fed Herd
    br_5_4:[ {stat:{aspd:R(-0.005)},per:{ust:'hSmo'},to:{team:'enemy',ust:{hSmo:1}}} ],                           // Ash in the Air
    br_6_1:[ {param:'ch.dur',add:R(0.5)} ],                                                                      // Iron Links
    br_7_1:[ {on:'out',if:{auto:true,targetHas:'hCh'},more:R(0.02)} ],                                            // Pulling Weight
    br_6_4:[ {param:'ch.heal',add:R(0.05)} ],                                                                    // Old Sow's Heat (chantHeal)
    br_8_3:[ {param:'slw',add:R(0.08)} ],                                                                        // Heavy Stride (slowW)
    br_8_2:[ {param:'dr.shoul',add:R(0.02)} ],                                                                   // Shoulder to Shoulder (sumDr)
    br_7_3:[ {on:'crit',if:{targetUst:{hSmo:3}},chance:{flat:1,x:{fn:'ggP'}},force:true} ],                       // Grave Grip (the room left of the 5%)
    br_8_1:[ {param:'dr.mail',add:R(0.01)} ],                                                                    // Chain Mail (myDr)
    br_5_2:[ {on:'chNew',do:[{taunt:1,on:'target'}]} ],                                                           // Hold the Road (PICK ONE)
    br_5_3:[ {on:'teamIn',if:{srcHas:'hCh',srcTeam:'enemy'},by:'source',icd:0.5,do:[{dmg:{pct:P('ltt',0.20),of:'atk'},on:'source',tag:'ltt'}]} ],   // Let Them Through (PICK ONE)
    br_7_4:[ {on:'sOut',if:{targetUst:{hSmo:5}},more:R(0.04)} ],                                                  // Hot Bristles
    br_9_1:[ {stat:{move:R(-0.03)},to:{team:'enemy',has:'hCh'}} ],                                                // Rattle
    br_6_3:[ {param:'ltt',add:R(0.05)} ],                                                                        // Price of Passing
    br_9_4:[ {param:'sowSmo',add:1} ],                                                                           // Ash Underfoot (smoScan)
    br_10_1:[ {on:'in',if:{srcHas:'hCh'},icd:1,do:[{heal:{pct:R(0.0024),of:'maxHp'}}]} ],                         // Short Leash (at most once a second: the regeneration cap)
    br_10_2:[ {on:'out',if:{casting:FT},more:R(0.03)} ],                                                          // Swallow the Pack
    br_10_4:[ {param:'embers',add:R(1)} ],                                                                       // Embers Spread
    br_11_1:[ {stat:{armor:R(0.01)},per:{fn:'chN3'}} ],                                                           // Swineherd's Grip
    br_11_2:[ {param:'cover',add:1} ],                                                                           // Between Them (sumDr)
    br_12_2:[ {param:'dr.road',add:R(0.01)} ],                                                                   // The Road Is Closed (myDr)
    br_12_3:[ {stat:{aspd:R(0.03)},if:{fn:'hurtHerd'}} ],                                                         // Hard Choices
    br_12_4:[ {param:'smo.max',add:R(1)} ],                                                                      // Whole Hillside
    br_13_2:[ {on:'teamIn',if:{targetMine:true,srcTeam:'enemy',srcMelee:true},icd:25,do:[{fn:'army'}]} ]          // The Army That Did Not Stop (SIGNATURE)
  },
  fn:{
    /* ---- conditions, counts and selectors ---- */
    kcSrc(A,T,u,c){ return isKc(A,T,u,c.src); }, kcX(A,T,u,c){ return isKc(A,T,u,c.tgt); },
    kc2(A,T,u){ return kcN(A,T,u)>=2; },
    mineN(A,T,u){ return mineL(A,T,u).length; },
    drvAtk(A,T,u){ const d=drvOf(A,T,u); if(!d) return 0; let n=0; for(const x of mineL(A,T,u)) if(x.target===d||(x.forcedTarget===d&&(x.forcedTargetT||0)>0)) n++; return n; },   // set on it (its target follows on its next think)
    anyCh(A,T,u){ return chainedL(A,T,u).length>0; }, chN3(A,T,u){ return Math.min(3,chainedL(A,T,u).length); },
    hurtHerd(A,T,u){ return mineL(A,T,u).some(x=>x.hp<0.5*x.maxHp); },
    fedShield(A,T,u){ return A.winOn(T,'hFsh')&&(u.shield||0)>0; },
    critN(A,T){ return Math.min(CRIT_CAP,(T.r.sw_10_3||0)+(T.r.ft_7_3||0)); },
    ggP(A,T){ const used=Math.min(CRIT_CAP,(T.r.sw_10_3||0)+(T.r.ft_7_3||0)); return 0.01*Math.max(0,Math.min(T.r.br_7_3||0,CRIT_CAP-used)); },
    chargeReady(A,T,u){ return kcN(A,T,u)>=4&&!!drvOf(A,T,u); },
    waveT(A,T){ T.s.hWt=A.eng().now(); }, keep(A,T){ T.s.hApi=A; },
    sowBack(A,T,u){ const f=T.s.hFk; if(!f||A.eng().now()<=f.t) return; T.s.hFk=null; for(const x of f.keep) if(x.alive&&!x._summonOwner) x._summonOwner=u; },
    /* ---- Driven: his summons turn on it (the engine's own forced target, written fresh each tick so an enemy's taunt on a summon still wins while it runs) ---- */
    drvTurn(A,T,u){ const d=drvOf(A,T,u), W=T.s.hFt||(T.s.hFt={});
      for(const x of mineL(A,T,u)){ const mineFt=W[x.uid]&&x.forcedTarget===W[x.uid];
        if(!d){ if(mineFt){ x.forcedTargetT=0; W[x.uid]=null; } continue; }
        if((x.forcedTargetT||0)>0&&x.forcedTarget&&x.forcedTarget.alive&&!mineFt) continue;   // taunted by someone else: that first
        x.forcedTarget=d; x.forcedTargetT=0.2; W[x.uid]=d; } },
    /* Whole Valley: the Driven enemy died - the enemy nearest it is Driven, and his summons attack faster for 3 s */
    valley(A,T,u,c){ const x=A.pick(T,u,{team:'enemy',of:'unit',n:1,skip:'unit'},c)[0]; if(x) A.setMark(T,u,x,'hDrv',{unique:true}); A.acts(T,u,[{window:'hWv',dur:3}],c); },
    /* ---- Chained ---- */
    chain(A,T,u,c){ const x=c.tgt; if(!x||!x.alive) return; const had=!!A.markOf(u,x,'hCh'); A.setMark(T,u,x,'hCh',{dur:3+(T.P['ch.dur']||0)});
      if(!had) A.run(T,u,'chNew',Object.assign({},c,{tgt:x})); },
    /* each 0.1 s: a Chained enemy farther from him than its chain (4 m body to body, Shorter Chain closer) is dragged back to the end of it. With Dragged
       Back it is dragged all the way to him and stunned 0.5 s (each enemy at most once every 5 s, and never while stunned or within 0.5 s of his last stun on it) */
    leash(A,T,u){ const E=A.eng(), Lm=Math.max(1,4-(T.P['ch.short']||0)), now=E.now(), Q=T.s.hDb||(T.s.hDb={});
      for(const x of chainedL(A,T,u)){ if(x.immovable||(x._gearImmovableT||0)>0) continue; const g=gapM(E,u,x); if(!(g>Lm+0.05)) continue;
        if(T.P.drag&&now>=(Q[x.uid]||0)&&!((x.stunned||0)>0)&&!A.markOf(u,x,'hLk')){ Q[x.uid]=now+5; A.acts(T,u,[{pull:'target',to:'self',m:Math.max(0.1,g-0.2),secs:0.2}],{u,tgt:x}); tstun(A,T,u,x,0.5); continue; }
        A.acts(T,u,[{pull:'target',to:'self',m:g-Lm,secs:0.1}],{u,tgt:x}); } },
    /* ---- Smoulder: each second, while a Bone-Chanter of his stands, every enemy within 1.5 m (body to body) of one of his warriors gains 1 (Ash Underfoot:
       or of the old sow herself); then every Smouldering enemy burns for 2% of his attack per rank per Smoulder (Her Young) ---- */
    smoScan(A,T,u){ const E=A.eng(), M=mineL(A,T,u), W=M.filter(x=>x.key===WK), S=M.filter(x=>x.key===SK), src=T.P.sowSmo?W.concat(S):W;
      const F=E.units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
      if(S.length&&src.length) for(const x of F) if(src.some(w=>!(w._riseT>0)&&gapM(E,w,x)<1.5)) addSmo(A,T,u,x,1);
      const k=T.P['smo.burn']||0; if(!(k>0)) return; const atk=(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*E.rage();
      for(const x of F){ const n=A.ustGet(T,u,x,'hSmo'); if(n>0) A.hurt(T,u,x,atk*k*n,'#ff7a3a','smo'); } },
    embers(A,T,u,c){ const x=A.pick(T,u,{team:'enemy',of:'unit',n:1,skip:'unit'},c)[0]; if(x) addSmo(A,T,u,x,T.P.embers||0); },
    /* ---- Packmaster ---- */
    myOut(A,T,u,c){ const p=pack(A,T,u); if(p&&p.N2>0) c.amt*=(1+p.N2*(p.b+p.xd))/(1+p.N*p.b); const k=T.P['car.k']||0; if(k>0) c.amt*=1+k*A.stGet(T,'hCar'); },
    /* his damage reduction, ONE capped group: Hard to Stop, Thick Skin, Chain Mail, Swallowed Pain (while the carried strength lasts), Grim Patience (after 20 s of
       the wave), The Road Is Closed (while Between Them covers his summons), Packmaster made stronger, Carried. They multiply; together at most 40% */
    drK(A,T,u){ let f=1; const E=A.eng(), Pm=T.P;
      f*=1-(Pm['dr.hard']||0); f*=1-(Pm['dr.skin']||0); f*=1-(Pm['dr.mail']||0);
      if(Pm['dr.pain']&&(u._devourT||0)>0) f*=1-Pm['dr.pain'];
      if(Pm['dr.grim']&&T.s.hWt!=null&&E.now()-T.s.hWt>=20) f*=1-Pm['dr.grim'];
      if(Pm['dr.road']&&T.P.cover&&behindOne(A,T,u)) f*=1-Pm['dr.road'];
      const p=pack(A,T,u); if(p&&p.N2>0) f*=(1+p.N*p.b)/(1+p.N2*(p.b+p.xs));
      const k=Pm['car.k']||0; if(k>0) f/=1+k*A.stGet(T,'hCar');
      return Math.max(1-DR_CAP,f); },
    myDr(A,T,u,c){ c.amt*=T.fn.drK(A,T,u); },
    /* his summons' damage reduction, ONE capped group: The Chains (from a Chained attacker), Wall of Herd and Old Boars (warriors; Old Boars: Three Strong's),
       She Tends Them (warriors, while a Bone-Chanter stands), Shoulder to Shoulder (within 3 m of him), Between Them (Packmaster's shrug, while one stands within 3 m
       behind him). They multiply; together at most 50%. The Army That Did Not Stop's 5 s: exactly half (in place of the group) */
    sumK(A,T,u,x,src){ if(A.winOn(T,'hArmy')) return 0.5; let f=1; const Pm=T.P, E=A.eng();
      if(Pm['dr.chain']&&src&&A.markOf(u,src,'hCh')) f*=1-Pm['dr.chain'];
      if(x.key===WK){ f*=1-(Pm['dr.wall']||0); if(Pm['dr.boar']&&T.r.sw_5_2&&!x._talEx) f*=1-Pm['dr.boar']; if(Pm['dr.tend']&&shamanUp(A,T,u)) f*=1-Pm['dr.tend']; }
      if(Pm['dr.shoul']&&gapM(E,u,x)<3) f*=1-Pm['dr.shoul'];
      if(Pm.cover&&behindOne(A,T,u)){ const p=pack(A,T,u); if(p) f/=1+p.N2*(p.b+p.xs); }
      return Math.max(1-SDR_CAP,f); },
    sumDr(A,T,u,c){ c.amt*=T.fn.sumK(A,T,u,c.tgt,c.src); },
    /* slows on him weaker: Steady Man, Gristle, Heavy Stride together at most 40% (the slow's strength, once per new slow) */
    slowW(A,T,u,c){ const by=Math.min(SLOW_CAP,T.P.slw||0); if(by>0) A.acts(T,u,[{weaken:'slowMul',by}],c); },
    /* ---- the Bone-Chanter ---- */
    chantHeal(A,T,u,c){ const k=T.P['ch.heal']||0; if(k>0) c.amt*=1+k; },
    /* The Whole Herd: as the old sow comes up, one more boar warrior comes up beside her (a summon of his talents: the warrior cap holds) */
    herdUp(A,T,u,c){ const E=A.eng(), sh=c.unit; if(!E.summon||!sh||!u.greenAb) return; const ab=u.greenAb, lv=(u.skillLv&&u.skillLv[1])||1;
      const share=E.skLvNum?E.skLvNum(UD,ab,lv):1; let w=null; T.s.ex=1; try{ w=E.summon(u,WK,(ab.dur||15)+(T.P['w.dur']||0),{a:(u.team==='ally'?-1.9:1.9),r:1.7*E.METER(),share}); } finally{ T.s.ex=0; }
      if(w) A.acts(T,u,[{place:'unit',near:{team:'ally',mine:SK,n:1}}],{u,unit:w,tgt:w}); },
    /* her healing reaches every summon of his: each one outside her circle gets the heal it would get inside (ctx.tgt = the circle) */
    herdHeal(A,T,u,c){ const h=c.tgt, E=A.eng(); if(!h||!(h.heal>0)) return; for(const x of mineL(A,T,u)){ if(x._riseT>0) continue; if(Math.hypot(x.x-h.x,x.y-h.y)<=h.r) continue; E.healUnit(x,h.heal*(1+(T.P['ch.heal']||0))); } },
    /* ---- Feed Them: what it takes (read at the kit, before the case picks the pack) and what it stores ---- */
    feedKit(A,T,u){ const s=T.s, keep=[]; let n=0, sow=0;
      for(const x of mineL(A,T,u)){ if(x.key===SK&&T.P.keepSow){ keep.push(x); x._summonOwner=null; continue; } n++; if(x.key===SK) sow++; }
      s.hFk={n,sow,keep,t:A.eng().now()}; },
    feedCast(A,T,u,c){ const s=T.s, f=s.hFk; s.hFk=null; if(f) for(const x of f.keep) if(x.alive&&!x._summonOwner) x._summonOwner=u;
      if(COST.some(id=>T.r[id])) A.stSet(T,u,'hCost',A.stGet(T,'hCost')+1);
      if(!f) return;
      if(CAR.some(id=>T.r[id])){ const k=f.n+(T.P.sow2?f.sow:0); if(k>0) A.stSet(T,u,'hCar',A.stGet(T,'hCar')+k); }
      if(f.n>0) A.acts(T,u,[{window:'hFsh',dur:(c&&c.o&&c.o.dur)||8}],{u});
      if(T.P.sowSh&&T.P.sow2&&f.sow>0) A.acts(T,u,[{shield:{pct:T.P.sowSh,of:'maxHp'},on:'self',dur:8}],{u});
      if(s.hAny){ s.hAny=0; if(f.n>0) A.acts(T,u,[{shield:{pct:0.05*f.n,of:'maxHp'},on:'self',dur:8}],{u}); } },
    /* He Does It Anyway: below 30% HP (once every 30 s) - Feed Them at once, at no energy cost (a shield of 5% of his max HP for each summon taken); with no summon
       left he heals to 40% HP and fills Carried. Either way Unchain the Dead is ready and he pays 1 Cost (the Feed Them cast pays it) */
    anyway(A,T,u){ const E=A.eng(), s=T.s, now=E.now(); if(now<(s.hAnyT||0)||!u.alive) return; s.hAnyT=now+30;
      if(mineL(A,T,u).length&&E.castUltFree){ s.hAny=1; E.castUltFree(u); s.hAny=0; }
      else { if(u.hp<0.4*u.maxHp) E.healUnit(u,0.4*u.maxHp-u.hp); A.stSet(T,u,'hCar',A.stMax(T,u,'hCar')); A.stSet(T,u,'hCost',A.stGet(T,'hCost')+1); }
      u.greenCd=0; },
    /* ---- the signatures ---- */
    /* Nobody Walks Around: every summon of his rushes the Driven enemy (set down beside it) and lands a hit for 100% of its attack; each would stun it 0.3 s, but a
       stunned enemy is not stunned again (so one stun lands); for 6 s the herd cannot drop below 1 HP */
    charge(A,T,u,c){ const d=drvOf(A,T,u); if(!d) return; A.acts(T,u,[{window:'hNwa',dur:6}],c);
      for(const x of mineL(A,T,u)){ if(!d.alive) break; A.acts(T,u,[{place:'unit',near:'target'}],{u,tgt:d,unit:x}); A.hurt(T,u,d,(x.dmg||0),'#c9a227','nwa'); if(d.alive) tstun(A,T,u,d,0.3); } },
    /* The Army That Did Not Stop: every enemy within 6 m of him (body to body) is Chained and dragged 2 m toward him, gains 5 Smoulder; his summons take half damage 5 s */
    army(A,T,u,c){ A.acts(T,u,[{window:'hArmy',dur:5}],c);
      for(const x of A.pick(T,u,{team:'enemy',within:6},c)){ T.fn.chain(A,T,u,{u,src:u,tgt:x}); A.acts(T,u,[{pull:'target',to:'self',m:2,secs:0.3}],{u,tgt:x}); addSmo(A,T,u,x,5); } }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (readings and corrected tooltips in WIRING/29 - HURNE - talent decisions.md) */
  ruling:{}
};
