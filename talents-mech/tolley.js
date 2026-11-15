/* TOLLEY - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Tolley": what he added)
   His real kit (the code, not the card wording; damage profile Attack: every hit of his and every tick of his skills is PHYSICAL; a melee Bruiser of the
   mid row, body 1.74 m, one swing every 2.4 s; tests/tolley-kit-facts.js, 20 seeded fights at skill level 100):
   - Forge Strike ('cleave', green, cd 7, delivered 'land': it resolves 0.55 s after the press): a 45 degree wedge from HIM toward his target, 3 m to the
     enemy's body edge; 180% of his attack x skill level to each enemy in it. In real fights it struck 1 enemy (his target) on 90 of 126 casts and nobody on
     36 (never two). Inside the skill (kit .. cast, at the landing): casting 'cleave'.
   - Chain Quench ('chainquench', blue, cd 10, delivered as a form 0.3 s later): every enemy whose CENTRE is within 4.5 m of his centre is pulled toward him
     (60% of the gap, at most 2.4 m; not one that cannot be moved), struck for 85% of his attack x skill level and BURNED: a DoT of 35% of his attack x
     skill level a second for 4 s (physical: armour reduces each tick). 1 enemy on 64 of 90 casts, 2 on 5, nobody on 21. Casting 'chainquench'.
   - Living Forge (the ultimate 'ashfall', energy; ULT_DEF.ashfall + HERO_ULT_ART.tolley, which adds only its art): ONE burning patch, 6 m centre to centre,
     put down at the aim point (the cluster the auto-aim picks; his target 7 of 55 casts) - never under him and it never moves (his median distance from it
     8.2 m). It ticks every 0.5 s for 5 s: 80% of his attack x skill level to each enemy inside (physical). No hit at the cast: the kit's mul 1.4 is read by
     nothing. Its ticks are damage() calls, not hits: Korvux's guarded num 'hzTick' line lets his rows see each tick of HIS patch (h._talH).
   - Tempered Steel (passive 'warden', Hobb's Fired Clay code): every 3 s in battle a stack (max 5, wardenStk / wardenT), each 4% x his passive's strength
     LESS DAMAGE TAKEN (inside damage(), wardenCut), up to SKLV.wardenCap (20% at level 1, 29.9% at 100: full 15 s into each wave). It is damage
     reduction, not armour and defence (the card). A new wave starts it at 0 again.
   Molten, the Crucible, the Workpiece, Examples, Hardened and Housing exist only through his talents. His own per-fight object is T.s.tl; his state names
   start with t. NO absolute fight time is kept anywhere here (the battle clock restarts at 0 each wave): every timer counts down by the tick's dt.
   Readings, caps and corrected tooltips: WIRING/58 - TOLLEY - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const FS='cleave', CQ='chainquench', LF='ashfall';
const DR_CAP=0.30, ALLY_CAP=0.35, CRIT_CAP=0.05, WP_CRIT=0.05, WO_CAP=0.15, BOLT_CAP=0.50, QT_CUT=0.30, REGEN=0.012, BANK=5, SIG_CD=25, LOCK=0.5, EX_MAX=8, MOLT_T=2, MOLT_HOLD=2, HD_EVERY=3, HD_MAX=10, OG_CAP=0.15;
/* which talents read each family: its bookkeeping rows are attached only when one of them is learned */
const MOLT=['mp_1_1','mp_2_1','mp_3_1','mp_4_1','mp_5_3','mp_5_4','mp_6_1','mp_7_2','mp_9_3','mp_10_1','mp_11_2','mp_12_1','mp_12_2','mp_13_2'];
const CRU=['mp_1_4','mp_2_4','mp_5_2','mp_5_3','mp_5_4','mp_6_2','mp_6_3','mp_6_4','mp_7_2','mp_7_4','mp_9_4','mp_10_4','mp_11_1','mp_12_4','mp_13_2'];
const BURN=MOLT.concat(CRU,['mp_4_3','mp_n1','mp_3_4','mp_2_2','mp_4_2','wm_7_4']);                       // his burns are tagged (Chain Quench's own and his talents')
const WP=['wm_1_1','wm_2_1','wm_3_1','wm_4_1','wm_5_1','wm_5_2','wm_5_3','wm_6_1','wm_6_2','wm_6_3','wm_7_2','wm_9_2','wm_10_1','wm_10_3','wm_11_1','wm_11_2','wm_12_1','wm_12_2','wm_13_2'];
const EX=['wm_9_3','wm_1_4','wm_2_4','wm_n2','wm_4_4','wm_5_4','wm_6_4','wm_7_4','wm_9_4','wm_10_4','wm_12_4','wm_13_2'];
const HD=['lf_1_1','lf_2_1','lf_3_1','lf_4_1','lf_4_2','lf_5_3','lf_6_1','lf_6_3','lf_7_2','lf_11_1','lf_12_1','lf_12_2','lf_13_2'];
const HS=['lf_1_4'];                                                                                       // Housing is there only with Outer Housing (the others `need` it)
const DRG=['mp_11_4','mp_4_3','wm_4_1','wm_n2','wm_5_1','wm_8_3','wm_11_4','lf_1_1','lf_11_4','lf_3_3','lf_10_4','lf_9_3','lf_5_3','lf_7_2'];   // his damage reduction: ONE capped group
const ALLY=['wm_5_1','wm_6_3','lf_12_4','wm_13_2'];                                                       // damage reduction on his allies: ONE capped group
const OUTK=['mp_12_2','wm_n1','wm_10_1','lf_3_4','lf_12_2','mp_6_3'];                                     // his hits' conditional bonuses (one function)
const ATK=['mp_10_1','mp_11_2','wm_10_4','wm_11_2','lf_4_1','lf_11_2','lf_6_3'];                         // his conditional attack (one stat)
const CRIT=['mp_9_3','wm_9_3'];
const H_MOVE=['mp_4_1','wm_2_4'], H_DMG=['mp_12_1','wm_1_4'];
/* ---- small readers that need no API (the 95% instrument calls drK from a test with the API kept on T.s) ---- */
const rk=(T,id)=>T.r[id]||0;
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const O=T=>T.s.tl||(T.s.tl={e:{},fs:null,wp:null,ws:0,mh:{},fin:false,ex:[],exN:0,ht:0,vst:0,vt:0,hs:0,hsMax:0,hsT:0,hsBr:false,rf:0,hsAdd:0,sT:0,lfT:0,s1:0,s2:0,s3:0,s3T:0,fpT:0,fpN:0,
  bud:0,wb:0,wbT:0,lb:0,lbT:0,mp:0,keep:null,cool:0,nat:0,natT:0,mN:0,mNear:0,pend:[],hzE:null,fe:null,ccs:null,refused:0,ts:{n:0,on:0,lk:0},runMax:0});
const rec=(T,t)=>{ const e=O(T).e; let r=e[t.uid]; if(!r||r.u!==t){ r=e[t.uid]={u:t,bt:0,bn:0,mf:0,fr:0,lk:0,si:0,rv:0,mh:{},kd:0,run:0}; } return r; };
const recOf=(T,t)=>{ const r=t&&O(T).e[t.uid]; return (r&&r.u===t)?r:null; };
const burning=(u,x)=>{ const D=x&&x.dots; if(!D) return false; for(let i=0;i<D.length;i++) if(D[i]._talO===u.uid&&D[i].remaining>0) return true; return false; };
const moltT=T=>Math.max(0.5,MOLT_T-(T.P['mo.fast']||0));
const moltR=(T,r)=>!!(r&&(r.mf>0||(r.bn&&r.bt>=moltT(T)-1e-9)));                     // as it stood at its last tick (also for one that has just died)
const molten=(T,t)=>!!(t&&t.alive&&moltR(T,recOf(T,t)));
const gapM=(A,a,b)=>A.gap(a,b)/A.eng().METER();
const wpMax=T=>T.r.wm_5_2?10:(T.r.wm_5_3?3:5);
const wpOn=T=>{ const o=O(T); return !!(o.wp&&o.wp.alive); };
const wpFull=T=>{ const o=O(T); return wpOn(T)&&o.ws>=wpMax(T); };
const hdN=T=>stN(T,'tHd');
const hdEff=T=>hdN(T)*(O(T).lfT>0&&T.P.wf?2:1);                      // Walking Foundry: while Living Forge burns, Hardened counts double
module.exports={
  hero:'tolley',
  casting:true,                         // rows ask which of his skills a hit comes from (Forge Strike, Chain Quench)
  points:true,                          // the at hook: Living Forge's burning patch, as it is made (River of Iron, Waves of Metal, Molten Walk, Walking Foundry)
  needs:{lf_2_4:'lf_1_4',lf_3_4:'lf_1_4',lf_5_4:'lf_1_4',lf_6_4:'lf_1_4',lf_7_4:'lf_1_4',lf_5_2:'lf_1_4',lf_6_2:'lf_1_4',lf_9_4:'lf_1_4',lf_10_4:'lf_1_4'},   // Housing exists only with Outer Housing
  states:{
    tCru:{max:P('cru.max',100)},                                                 // the Crucible (Overpour: up to 150)
    tHd:{max:HD_MAX}                                                             // Hardened stacks (this wave; Never Cooled keeps half)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share, and his capped groups */
  always:[
    {on:'wave',do:[{fn:'waveStart'}]}, {on:'waveEnd',do:[{fn:'waveEnd'}]},
    {on:'tick',do:[{fn:'tk'}]},                                                                                                     // every timer of his counts down here (never an absolute fight time)
    /* his burns: Chain Quench's own DoTs are tagged his, so their ticks run his rows (and every talent burn of his is his) */
    {on:'kit',skill:CQ,reqAny:BURN,do:[{tagDots:'kit'}]}, {on:'cast',skill:CQ,reqAny:BURN,do:[{tagDots:'cq',exact:true}]},
    {on:'dotTick',reqAny:CRU.concat(['mp_n1']),do:[{fn:'burnTick'}]},                                                              // each tick of his burns: the Crucible, Kiln Warmth
    {on:'dotOut',reqAny:['mp_6_1','wm_7_4'],do:[{fn:'burnOut'}]},                                                                  // Seared Through, Hung in Chains on the burn's ticks
    /* Forge Strike: the pour, its hits, then what the cast does */
    {on:'kit',skill:FS,do:[{fn:'fsKit'}]}, {on:'hit',if:{casting:FS,targetTeam:'enemy'},do:[{fn:'fsHit'}]}, {on:'cast',skill:FS,do:[{fn:'fsCast'}]},
    {on:'out',if:{casting:FS},reqAny:CRU.concat(['mp_1_1','wm_13_2']),do:[{fn:'fsOut'}]},
    /* Chain Quench: the enemies it pulls (Chains of Making) */
    {on:'kit',skill:CQ,reqAny:['wm_7_2'],do:[{fn:'cqKit'}]}, {on:'hit',if:{casting:CQ,targetTeam:'enemy'},reqAny:['wm_7_2'],do:[{fn:'cqHit'}]}, {on:'cast',skill:CQ,reqAny:['wm_7_2'],do:[{fn:'cqCast'}]},
    /* Living Forge: its patch made his; each of its ticks on an enemy */
    {on:'at',skill:LF,reqAny:['mp_7_2','mp_9_2','lf_9_2','lf_7_2'].concat(EX),do:[{fn:'lfAt'}]}, {on:'num',skill:'hzTick',reqAny:['mp_7_2','mp_9_2','lf_9_2'].concat(EX),do:[{fn:'hzTick'}]},
    /* his basic attacks */
    {on:'out',if:{auto:true,targetTeam:'enemy'},reqAny:['mp_1_1'],do:[{fn:'autoOut'}]}, {on:'hit',if:{auto:true,targetTeam:'enemy'},reqAny:['mp_12_3','mp_5_4'],do:[{fn:'autoHit'}]},
    {on:'out',if:{targetTeam:'enemy'},reqAny:OUTK,do:[{fn:'myOut'}]},                                                             // his hits' conditional bonuses (one function)
    {on:'crit',reqAny:CRIT,if:{targetTeam:'enemy'},do:[{fn:'crit'}]},                                                             // his critical-chance talents: ONE capped group (5%)
    {on:'in',reqAny:DRG.concat(['lf_6_4']),do:[{fn:'myIn'}]},                                                                     // his damage-reduction talents: ONE capped group (and the hit's kind for Housing)
    {on:'teamIn',reqAny:ALLY.concat(['wm_n1','wm_12_1']),do:[{fn:'tIn'}]},                                                        // his allies' group; what his allies' hits are (Many Hammers, Fire in the Work)
    {on:'kill',dots:true,reqAny:EX,do:[{fn:'killed'}]}, {on:'death',reqAny:EX.concat(WP,['mp_11_2']),do:[{fn:'died'}]},           // Examples, the Workpiece, Melt Point
    {on:'teamCc',reqAny:['wm_3_1'],do:[{fn:'qtCc'}]},                                                                             // Quenched True: controls on the finished Workpiece shorter
    {on:'lethal',reqAny:['lf_11_1','lf_13_2'],do:[{fn:'lethal'}]},
    {on:'hurt',reqAny:HS.concat(['lf_13_2']),do:[{fn:'hurt'}]}, {on:'dotIn',reqAny:HS,do:[{fn:'dotIn'}]}, {on:'absorb',reqAny:HS,do:[{fn:'absorb'}]},
    {stat:{atk:1},reqAny:ATK,per:{fn:'atkK'}},                                                                                    // his conditional attack, one stat
    {stat:{atk:1},to:{team:'ally',fn:'tempered'},reqAny:['wm_1_1','wm_6_2','wm_13_2'],per:{fn:'wAtk'}},                           // the Workpiece (and tempered allies): attack
    {stat:{apow:1},to:{team:'ally',fn:'tempered'},reqAny:['wm_6_2','wm_13_2'],per:{fn:'wApow'}},                                  //   ability power (Master's Mark, The Finished Piece: "more damage")
    {stat:{armor:1},to:{team:'ally',fn:'tempered'},reqAny:['wm_2_1'],per:{fn:'wArm'}},                                            //   armour
    {stat:{crit:1},to:{team:'ally',fn:'tempered'},reqAny:['wm_6_1'],per:{fn:'wCrit'}},                                            //   critical chance (5% at most)
    {stat:{move:1},to:{team:'enemy',fn:'eSlowed'},reqAny:H_MOVE,per:{fn:'eMove'}},                                                // Molten enemies / enemies near an Example slower
    {stat:{atk:1,apow:1},to:{team:'enemy',fn:'eWeak'},reqAny:H_DMG,per:{fn:'eDmg'}},                                              // ... dealing less damage
    {stat:{aspd:1},to:{team:'enemy',fn:'nearEx'},reqAny:['wm_6_4'],per:{fn:'eAspd'}}                                              // ... attacking slower
  ],
  talents:{
    /* ============================== MELT AND POUR ============================== */
    mp_1_1:[ {param:'mo.rh',add:R(0.02)} ],                                                                       // Runs Hot (Molten: tk; fsOut, autoOut)
    mp_11_4:[ {param:'dr.fl',add:R(0.015)} ],                                                                     // Furnace Lining (drK: abilities)
    mp_1_4:[ {param:'pour.k',add:R(0.15)} ],                                                                      // Crucible (burnTick fills it; fsKit / fsOut / fsCast pour it)
    mp_2_1:[ {param:'mo.fast',add:R(0.3)} ],                                                                      // Quick Melt (moltT)
    mp_2_2:[ {on:'kit',skill:CQ,opt:{dps:{more:R(0.03)}}} ],                                                      // Hotter Chains
    mp_2_4:[ {param:'cru.bel',add:R(0.15)} ],                                                                     // Bellows (burnTick)
    mp_3_1:[ {param:'slag',add:1} ],                                                                              // Slag Off (fsCast)
    mp_4_2:[ {on:'kit',skill:CQ,opt:{dur:{add:R(0.5)}}} ],                                                        // Longer Burn
    mp_4_3:[ {param:'dr.hs',add:R(0.02)} ],                                                                       // Heat Shield (drK: a source carrying his burn)
    mp_3_4:[ {on:'kit',skill:CQ,opt:{dur:{add:R(0.2)}}}, {param:'burn.dur',add:R(0.2)} ],                         // Glowing Seams (Chain Quench's burn; his talent burns: burn())
    mp_4_1:[ {param:'e.li',add:R(0.02)} ],                                                                        // Liquid Iron (eMove)
    mp_5_2:[ {param:'pw',add:1}, {on:'kit',skill:FS,if:{fn:'pouring'},opt:{radius:{mul:1.5}}} ],                  // Pour Wide (PICK ONE; fsCast burns)
    mp_5_3:[ {param:'pd',add:1} ],                                                                                // Pour Deep (PICK ONE; fsOut, fsCast)
    mp_5_4:[ {param:'cru.hh',add:R(2)} ],                                                                         // Hot Grip (autoHit)
    mp_n1:[ {param:'kw',add:R(0.001)} ],                                                                          // Kiln Warmth (burnTick: heal budget)
    mp_6_2:[ {param:'pw.k',add:R(0.03)} ],                                                                        // Spill (fsCast: under Pour Wide)
    mp_6_3:[ {param:'si',add:R(0.04)} ],                                                                          // Single Ingot (fsCast marks; myOut)
    mp_6_1:[ {param:'sear',add:R(0.03)} ],                                                                        // Seared Through (burnOut)
    mp_10_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                               // Quench Again
    mp_12_3:[ {param:'eh',add:R(0.05)} ],                                                                         // Ember Hands (autoHit)
    mp_6_4:[ {param:'am',add:R(0.02)} ],                                                                          // Ash Mouth (fsCast: each pour)
    mp_7_1:[ {on:'out',if:{casting:FS},more:R(0.03)} ],                                                           // Drop Weight
    mp_7_2:[ {param:'ri',add:1} ],                                                                                // River of Iron (hzTick)
    mp_7_4:[ {stat:{aspd:R(0.015)},if:{fn:'cru50'}} ],                                                            // Forge Glow
    mp_9_2:[ {param:'lf.k1',add:R(0.03)} ],                                                                        // Waves of Metal (hzTick)
    mp_9_3:[ {param:'cr.mo',add:R(0.015)} ],                                                                      // Spark Shower (crit group)
    mp_9_4:[ {param:'cru.max',add:50}, {param:'op',add:0.003} ],                                                  // Overpour
    mp_10_1:[ {param:'a.fh',add:R(0.005)} ],                                                                      // Furnace Heart (atkK)
    mp_10_4:[ {param:'cru.keep',add:R(4)} ],                                                                      // Residual Heat (fsCast)
    mp_11_1:[ {param:'cru.nc',add:1} ],                                                                           // Never Cold (waveEnd)
    mp_11_2:[ {param:'a.mp',add:R(0.005)} ],                                                                      // Melt Point (died; atkK)
    mp_12_1:[ {param:'e.gi',add:R(0.02)} ],                                                                       // Glowing Iron (eDmg)
    mp_12_2:[ {param:'o.fp',add:R(0.02)} ],                                                                       // Foundry Pace (myOut)
    mp_12_4:[ {param:'cru.hs',add:R(15)} ],                                                                       // Hot Start (waveStart)
    mp_13_2:[ {param:'sig1',add:1} ],                                                                             // Pour the Mold (SIGNATURE: fsCast)
    /* ============================== SOMETHING WORTH MAKING ============================== */
    wm_1_1:[ {param:'w.atk',add:R(0.01)} ],                                                                       // Find the Work (waveStart picks; fsCast tempers; wAtk)
    wm_9_3:[ {param:'cr.ex',add:R(0.015)} ],                                                                      // Spark Eye (crit group)
    wm_1_4:[ {param:'ex.k',add:R(0.03)} ],                                                                        // Make an Example (killed / died make them; eDmg)
    wm_2_1:[ {param:'w.arm',add:R(0.01)} ],                                                                       // Second Heat (wArm)
    wm_2_4:[ {param:'ex.mv',add:R(0.03)} ],                                                                       // Warning Shown (eMove)
    wm_3_1:[ {param:'qt',add:1} ],                                                                                // Quenched True (qtCc)
    wm_3_2:[ {on:'out',if:{casting:FS},more:R(0.03)} ],                                                           // Heavy Hammer
    wm_n1:[ {param:'o.mh',add:R(0.02)} ],                                                                         // Many Hammers (tIn records; myOut)
    wm_4_1:[ {param:'dr.sa',add:R(0.01)} ],                                                                       // Steady Anvil (drK)
    wm_n2:[ {param:'li',add:1} ],                                                                                 // Lesson in Iron (LINK; newEx, drK)
    wm_12_3:[ {param:'sh',add:R(0.01)} ],                                                                         // Struck Hot (fsCast)
    wm_4_4:[ {param:'ex.dur',add:R(0.5)} ],                                                                       // Lesson Learned (newEx)
    wm_5_1:[ {param:'dr.he',add:R(0.015)} ],                                                                      // Shop Hearth (drK; allyK)
    wm_5_2:[ {param:'ofth',add:1} ],                                                                              // One Fine Thing (PICK ONE; wpMax)
    wm_5_3:[ {param:'mhd',add:1} ],                                                                               // Every Hand Tempered (PICK ONE; temper)
    wm_5_4:[ {param:'mic',add:R(0.3)} ],                                                                          // Make It Count (died)
    wm_6_1:[ {param:'w.cr',add:R(0.003)} ],                                                                       // Keen Temper (wCrit)
    wm_6_2:[ {param:'w.mw',add:R(0.01)} ],                                                                        // Master's Mark (wAtk / wApow)
    wm_6_3:[ {param:'al.wf',add:R(0.01)} ],                                                                       // Workshop Floor (allyK)
    wm_6_4:[ {param:'ex.as',add:R(0.03)} ],                                                                       // Cautionary (eAspd)
    wm_7_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ],                                         // Anvil Rhythm
    wm_7_2:[ {param:'cm',add:1} ],                                                                                // Chains of Making (cqCast)
    wm_7_4:[ {on:'out',if:{casting:CQ,fn:'tgtNearEx'},more:R(0.03)}, {param:'hic',add:R(0.03)} ],                // Hung in Chains (the hit; its burn: burnOut)
    wm_8_1:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                               // Smith's Patience
    wm_8_3:[ {param:'dr.tm',add:R(0.015)} ],                                                                      // Temper of Mind (drK)
    wm_9_2:[ {param:'pa',add:R(0.01)} ],                                                                          // Pulled to the Anvil (cqCast)
    wm_9_4:[ {param:'ff',add:1} ],                                                                                // Fear of the Forge (newEx: tfear)
    wm_10_1:[ {param:'o.pm',add:R(0.02)} ],                                                                       // Proof Mark (myOut)
    wm_10_3:[ {param:'w.fe',add:R(0.03)} ],                                                                       // Finished Edge (tk: the Workpiece's critical damage)
    wm_10_4:[ {param:'a.gd',add:R(0.005)} ],                                                                      // Grim Display (atkK)
    wm_11_1:[ {param:'rm',add:1} ],                                                                               // Remade (died)
    wm_11_2:[ {param:'a.wm',add:R(0.02)} ],                                                                       // Worth Making (atkK)
    wm_11_4:[ {param:'dr.fw',add:R(0.02)} ],                                                                      // Foundry Walls (drK)
    wm_12_1:[ {param:'fw',add:R(0.05)} ],                                                                         // Fire in the Work (tIn)
    wm_12_2:[ {param:'mpr',add:R(0.003)} ],                                                                       // Maker's Pride (tk: the Workpiece's budget)
    wm_12_4:[ {param:'ex.r',add:R(1)} ],                                                                          // Example to All (exR)
    wm_13_2:[ {param:'sig2',add:1} ],                                                                             // The Finished Piece (SIGNATURE: temper arms it)
    /* ============================== THE FURNACE THAT REFUSED ============================== */
    lf_1_1:[ {param:'hd.dr',add:R(0.003)} ],                                                                      // Past the Temper (tk adds Hardened; drK)
    lf_11_4:[ {param:'dr.tg',add:R(0.015)} ],                                                                     // Thick Grate (drK: basic attacks)
    lf_1_4:[ {param:'hs.k',add:R(0.03)} ],                                                                        // Outer Housing (waveStart, tk, absorb)
    lf_2_1:[ {param:'ts.fast',add:R(0.3)} ],                                                                      // Quick Temper (tk)
    lf_2_4:[ {param:'hs.fast',add:R(0.5)} ],                                                                      // Riveted Plates (hurt / dotIn: the wait)
    lf_3_1:[ {param:'nc',add:1} ],                                                                                // Never Cooled (waveStart)
    lf_3_3:[ {param:'dr.rf',add:R(0.015)} ],                                                                      // Refractory (drK: abilities)
    lf_3_4:[ {param:'o.hi',add:R(0.02)} ],                                                                        // Heat Inside (myOut)
    lf_4_1:[ {param:'a.ch',add:R(0.003)} ],                                                                       // Case Hardened (atkK)
    lf_4_2:[ {param:'stc',add:R(2)} ],                                                                            // Slow to Cool (waveStart, tk)
    lf_4_3:[ {stat:{move:R(0.03)}} ],                                                                             // Walking Out
    lf_5_1:[ {on:'ccIn',less:R(0.04)} ],                                                                          // Ore-Bound (5 ranks: 20%, its own cap)
    lf_7_2:[ {param:'wf',add:1} ],                                                                                // Walking Foundry (lfAt opens it; drK, atkK: hdEff)
    lf_12_3:[ {on:'moved',if:{who:'self'},do:[{fn:'bolted'}]}, {param:'bolt',add:R(0.25)} ],                      // Bolted Shut
    lf_5_4:[ {param:'hs.k',add:R(0.01)} ],                                                                        // Sealed Seams
    lf_6_1:[ {param:'ks',add:R(0.003)} ],                                                                         // Kiln Skin (hdAdd)
    lf_9_2:[ {param:'lf.k2',add:R(0.03)} ],                                                                        // Molten Walk (hzTick)
    lf_6_4:[ {param:'hs.tr',add:R(0.10)} ],                                                                       // Tough Rivets (absorb)
    lf_8_3:[ {on:'out',if:{casting:FS},more:R(0.03)} ],                                                           // Hammer Weighted
    lf_8_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ],                                         // Cinder Fists
    lf_5_2:[ {param:'bf',add:1} ],                                                                                // Banked Fire (PICK ONE; hsBreak)
    lf_5_3:[ {param:'og',add:OG_CAP} ],                                                                           // Open Grate (PICK ONE; no Housing; tsCut)
    lf_7_4:[ {param:'rb',add:R(0.01)} ],                                                                          // Rebuilt (tk: each rebuild)
    lf_9_3:[ {param:'dr.is',add:R(0.02)} ],                                                                       // Ironside (drK)
    lf_6_2:[ {param:'bf.k',add:R(0.03)} ],                                                                        // Ember Flare (hsBreak)
    lf_6_3:[ {param:'a.wo',add:R(0.01)} ],                                                                        // Grate Thrown Wide (atkK)
    lf_9_4:[ {param:'sh2',add:1} ],                                                                               // Second Housing (hsBreak)
    lf_10_1:[ {on:'tick',period:1,do:[{fn:'breath'}]}, {param:'kb',add:R(0.01)} ],                                // Kiln Breath
    lf_10_3:[ {on:'kit',skill:CQ,opt:{pull:{more:R(0.10)}}} ],                                                    // Chain Anchor
    lf_10_4:[ {param:'dr.pp',add:R(0.01)} ],                                                                      // Layered Housing (drK)
    lf_11_1:[ {param:'rf',add:1} ],                                                                               // Refused (lethal)
    lf_11_2:[ {param:'a.lb',add:R(0.005)} ],                                                                      // Long Burning (tk counts; atkK)
    lf_12_1:[ {param:'bc',add:R(2)} ],                                                                            // Banked Coals (waveStart)
    lf_12_2:[ {param:'o.sb',add:R(0.02)} ],                                                                       // Still Burning (myOut)
    lf_12_4:[ {param:'al.hg',add:R(0.015)} ],                                                                     // Hearth Guard (allyK)
    lf_13_2:[ {param:'sig3',add:1} ]                                                                              // Fire Still In It (SIGNATURE: tk)
  },
  fn:{
    /* ---- A NEW WAVE: his records of the last wave's enemies are dropped (new units), Examples gone; the Workpiece picked; Housing whole; Tempered Steel, Hardened
       and the Crucible as his talents keep them; the wave's counters start again. The API kept on T.s for the 95% instrument ---- */
    waveStart(A,T,u){ const o=O(T), P=T.P, E=A.eng(), k=o.keep; T.s.api=A; o.keep=null;
      o.e={}; o.ex=[]; o.exN=0; o.mp=0; o.lb=0; o.lbT=0; o.ht=0; o.vt=0; o.vst=0; o.fpT=0; o.fpN=0; o.s3T=0; o.pend=[]; o.fs=null; o.mN=0; o.mNear=0; o.cool=0; o.ccs=null;
      if(WP.some(id=>T.r[id])) T.fn.pickWp(A,T,u,null,true);
      /* Tempered Steel: Never Cooled half, Banked Coals 2 a rank (the higher); Slow to Cool keeps all of it for 2 s a rank first */
      const ws0=k?k.ws:0, tsKeep=Math.max(P.nc?Math.floor(ws0/2+1e-9):0,Math.round(P.bc||0));
      if(u.pass&&u.pass.warden&&(P.nc||P.bc||P.stc)){ const start=P.stc?Math.max(ws0,tsKeep):tsKeep; T.fn.tsSet(A,T,u,start); o.cool=P.stc&&ws0>tsKeep?P.stc:0; o.nat=tsKeep; o.natT=0; }
      if(HD.some(id=>T.r[id])||T.r.wm_n2) A.stSet(T,u,'tHd',(P.nc&&k)?Math.floor(k.hd/2+1e-9):0);
      if(CRU.some(id=>T.r[id])){ const c0=(k&&P['cru.nc'])?k.cru:0; A.stSet(T,u,'tCru',Math.max(c0,P['cru.hs']||0)); }
      o.hsMax=(T.r.lf_1_4&&!T.r.lf_5_3)?(P['hs.k']||0)*u.maxHp:0; o.hsBr=false; o.hsT=0; o.rf=0; o.hsAdd=0;
      if(o.hsMax>0){ const add=Math.max(0,o.hsMax-(o.hs>0&&(u.shield||0)>=o.hs?o.hs:0)); o.hs=o.hsMax; u.shield=(u.shield||0)+add; o.sT=u.shieldT||0; } else o.hs=0; },
    /* the wave ends (resetPerWave, before the game zeroes his stacks): what Never Cooled, Slow to Cool and Never Cold keep */
    waveEnd(A,T,u){ const o=O(T); o.keep={ws:(u.wardenStk||0)+o.vst,hd:hdN(T),cru:stN(T,'tCru')}; if(CRU.some(id=>T.r[id])&&!T.P['cru.nc']) A.stSet(T,u,'tCru',0); },
    /* ---- EVERY TIMER, ONCE A TICK (countdowns only) ---- */
    tk(A,T,u,c){ const o=O(T), P=T.P, dt=c.dt||0, E=A.eng(); T.s.api=A;
      o.bud=Math.min(BANK*REGEN*u.maxHp,o.bud+REGEN*u.maxHp*dt);
      for(const k of ['s1','lfT','fpT','liT']) if(o[k]>0) o[k]=Math.max(0,o[k]-dt);
      if(o.fpT<=0) o.fpN=0;
      let foe=false; const U=E.units();
      /* Molten: how long each enemy has burned from him without a break; a forced Molten (Pour Deep, River of Iron, Pour the Mold) holds while it burns, and 2 s
         when it does not; fear locks; Single Ingot; the allies who hit it (Many Hammers) */
      const mo=MOLT.some(id=>T.r[id]); let mN=0, mNear=0;
      for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive||x.team===u.team) continue; foe=true;
        let r=recOf(T,x); const b=mo&&burning(u,x); if(!r&&(b)) r=rec(T,x); if(!r) continue;
        if(b){ r.bt+=dt; r.bn=1; } else { r.bt=0; r.bn=0; }
        if(r.mf>0) r.mf=Math.max(0,r.mf-dt); if(r.si>0) r.si=Math.max(0,r.si-dt);
        if(r.fr>0){ r.run+=dt; r.fr=((x.fearT||0)>0)?Math.min(r.fr-dt,x.fearT):0; if(r.fr<=1e-9){ r.fr=0; r.lk=LOCK; if(r.run>o.runMax) o.runMax=r.run; r.run=0; } } else if(r.lk>0) r.lk=Math.max(0,r.lk-dt);
        for(const k in r.mh){ r.mh[k]-=dt; if(r.mh[k]<=0) delete r.mh[k]; }
        if(mo&&molten(T,x)){ mN++; if(gapM(A,u,x)<4) mNear++; } }
      o.mN=mN; o.mNear=Math.min(5,mNear);
      for(const k in o.e){ if(!o.e[k].u.alive) delete o.e[k]; }
      /* Examples count down */
      for(let i=0;i<o.ex.length;i++){ o.ex[i].t-=dt; if(o.ex[i].t<=0) o.ex.splice(i--,1); }
      /* deaths seen this tick decided now (his kill rows run after the death hook) */
      if(o.pend.length){ const L=o.pend; o.pend=[]; for(const d of L) T.fn.decide(A,T,u,d); }
      o.hzE=null;
      /* Tempered Steel, Hardened (Past the Temper, Quick Temper, Open Grate, Slow to Cool, Kiln Skin), Long Burning */
      if(u.pass&&u.pass.warden){
        const per=Math.max(1.5,3-(P['ts.fast']||0));
        if((u.wardenStk||0)<5&&P['ts.fast']) u.wardenT=(u.wardenT||0)+dt*(3/per-1);
        if(P.og&&(u.wardenStk||0)>=5){ const c1=T.fn.tsCut(A,T,u); if(c1.c1<c1.cap1-1e-9){ o.vt+=dt; if(o.vt>=per-1e-9){ o.vt-=per; o.vst++; } } else o.vt=0; }
        if(o.cool>0){ o.natT+=dt; if(o.natT>=per-1e-9){ o.natT-=per; o.nat=Math.min(5,o.nat+1); } o.cool=Math.max(0,o.cool-dt); if(o.cool<=0){ T.fn.tsSet(A,T,u,Math.min((u.wardenStk||0)+o.vst,o.nat)); u.wardenT=o.natT; } }
        if((HD.some(id=>T.r[id]))&&foe&&T.fn.tsFull(A,T,u)){ o.ht+=dt; if(o.ht>=HD_EVERY-1e-9){ o.ht-=HD_EVERY; T.fn.hdAdd(A,T,u,1); } } else o.ht=0; }
      if(P['a.lb']&&foe){ o.lbT+=dt; if(o.lbT>=10-1e-9){ o.lbT-=10; o.lb=Math.min(10,o.lb+1); } }
      /* Housing: what the game dropped (another shield's timer ran out: the pool went with it) comes back; the ability refund (Tough Rivets); Second Housing's
         half; rebuilds after its wait without damage (Rebuilt heals) */
      if(o.hsMax>0){
        if(o.rf>0){ if(o.hs>0) u.shield=(u.shield||0)+o.rf; o.rf=0; }
        if(o.hsAdd>0){ o.hs+=o.hsAdd; u.shield=(u.shield||0)+o.hsAdd; o.hsAdd=0; }
        const sh=u.shield||0; if(o.hs>0&&sh<o.hs-1e-6){ if(o.sT>0&&!((u.shieldT||0)>0)) u.shield=o.hs; else o.hs=sh; }
        if(o.hsT>0) o.hsT=Math.max(0,o.hsT-dt); else if(o.hs<o.hsMax-1e-6&&u.alive){ const add=o.hsMax-o.hs; o.hs=o.hsMax; u.shield=(u.shield||0)+add; if(P.rb) A.eng().healUnit(u,P.rb*u.maxHp); }
        o.sT=u.shieldT||0; }
      /* the Workpiece: Maker's Pride (its own 1.2% a second at most), Finished Edge (its critical damage), Quenched True (its controls seen) */
      const w=wpOn(T)?o.wp:null;
      if(P.mpr&&w&&wpFull(T)){ o.wbT+=dt; if(o.wbT>=1-1e-9){ o.wbT-=1; E.healUnit(w,Math.min(P.mpr,REGEN)*w.maxHp); } } else o.wbT=0;
      T.fn.fEdge(A,T,u,w);
      if(P.qt&&w){ o.ccs={x:w,s:w.stunned||0,f:w.fearT||0,si:w.silencedT||0,sl:w.slow||0,z:w._sleepT||0}; }
      /* Fire Still In It: below 30% HP, once per fight */
      if(P.sig3){ if(o.s3T>0){ o.s3T=Math.max(0,o.s3T-dt); if(o.s3T<=0&&u.alive){ const n=hdN(T); if(n>0) E.healUnit(u,0.03*n*u.maxHp); } }
        else if(!o.s3&&u.alive&&u.hp<0.30*u.maxHp) T.fn.fireStill(A,T,u); } },
    /* ---- TEMPERED STEEL as his talents change it: c0 = what the game's passive takes off now; cap1 = Open Grate's raised cap (15 points); c1 = with Open
       Grate's stacks past 5; c2 = with Walking Foundry (while Living Forge burns: doubled). Only the part above c0 is his talents' (in drK's group) ---- */
    tsCut(A,T,u){ const E=A.eng(), on=!!(u.pass&&u.pass.warden), st=on?(u.wardenStk||0):0; if(!on) return {c0:0,c1:0,c2:0,cap1:0};
      const c0=st>0?E.wardenCut(u):0, cap1=E.wardenCap(u)+(T.P.og||0), c1=T.P.og?Math.min(cap1,0.04*(u.passMul||1)*(st+O(T).vst)):c0, c2=(T.P.wf&&O(T).lfT>0)?Math.min(0.95,2*c1):c1;
      return {c0,c1,c2,cap1}; },
    tsFull(A,T,u){ if(!(u.pass&&u.pass.warden)||(u.wardenStk||0)<5) return false; if(!T.P.og) return true; const c=T.fn.tsCut(A,T,u); return c.c1>=c.cap1-1e-9; },
    tsSet(A,T,u,n){ const o=O(T); n=Math.max(0,Math.round(n)); u.wardenStk=Math.min(5,n); o.vst=T.P.og?Math.max(0,n-5):0; },
    hdAdd(A,T,u,n){ const was=hdN(T); A.stSet(T,u,'tHd',was+n); const got=hdN(T)-was; if(got>0&&T.P.ks&&u.alive) A.eng().healUnit(u,T.P.ks*got*u.maxHp); },
    /* ---- HIS BURNS. Chain Quench's (tagged 'cq' at its cast) and every talent burn of his: a true-damage DoT of his (he owns it), refreshed per tag on an
       enemy. Glowing Seams lengthens the talent burns (the same strength each second, longer). cqBurn = Chain Quench's own burn a second at its level ---- */
    burn(A,T,u,t,per,dur,tag){ if(!t||!t.alive||!(per>0)) return; const E=A.eng(); dur+=T.P['burn.dur']||0; const ticks=Math.max(1,Math.ceil(dur-1e-9)), frac=dur-(ticks-1);
      for(const d of (t.dots||[])) if(d._talO===u.uid&&d._talK===tag&&d.remaining>0){ d.dps=Math.max(d.dps,per); d.remaining=ticks; d._talF=(frac<1-1e-9)?frac:null; return; }
      E.pushDot(t,per,ticks,1,'#ff6a2a',u,'true'); const d=t.dots[t.dots.length-1]; d._talO=u.uid; d._talK=tag; if(frac<1-1e-9) d._talF=frac; },
    cqBurn(A,T,u){ const E=A.eng(), lv=(u.skillLv&&u.skillLv[2])||1; return (u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*0.35*(E.skillMul?E.skillMul(lv):1); },
    burnTick(A,T,u,c){ const o=O(T), P=T.P, t=c.tgt; if(!t) return;
      if(CRU.some(id=>T.r[id])) A.stSet(T,u,'tCru',stN(T,'tCru')+1+(P['cru.bel']||0));
      if(P.kw&&u.alive&&gapM(A,u,t)<3) T.fn.heal(A,T,u,P.kw*u.maxHp); },
    burnOut(A,T,u,c){ const P=T.P, t=c.tgt; if(!t) return; if(P.sear&&molten(T,t)) c.amt*=1+P.sear; if(P.hic&&c.tag==='cq'&&T.fn.exK(A,T,t)>0) c.amt*=1+P.hic; },
    /* healing from his talents each second (Kiln Warmth): ONE budget that fills at 1.2% of his max HP a second (the regeneration cap), kept at most 5 s */
    heal(A,T,u,x){ const o=O(T); if(!(x>0)||!u.alive) return; x=Math.min(x,o.bud); o.bud-=x; if(x>0) A.eng().healUnit(u,x); },
    /* Kiln Breath: each second every enemy within 2 m of him (body to body) burns for 1% a rank of his attack (a burn of his, refreshed each second) */
    breath(A,T,u){ const E=A.eng(), x=(T.P.kb||0)*(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1); if(!(x>0)||!u.alive) return;
      for(const t of A.pick(T,u,{team:'enemy',within:2},{u})) T.fn.burn(A,T,u,t,x,1.5,'kb'); },
    /* ---- MOLTEN and the CRUCIBLE ---- */
    cru50(A,T){ return stN(T,'tCru')>50; },
    pouring(A,T){ const f=O(T).fs; return !!(f&&f.pour); },
    /* ---- FORGE STRIKE. At its landing (kit): its main target, and whether it pours (the Crucible at 100 or more); its hits (each enemy, what it dealt, Molten
       then); the cast: The Finished Piece's strike on the Workpiece's target, Pour the Mold, Pour Wide's burns, Pour Deep, Slag Off, tempering, Struck Hot, the
       Crucible emptied (Residual Heat), Ash Mouth ---- */
    fsKit(A,T,u,c){ const o=O(T); o.fs={t:c.tgt||null,hits:[],pour:null};
      if(CRU.some(id=>T.r[id])&&stN(T,'tCru')>=100-1e-9) o.fs.pour={over:Math.max(0,stN(T,'tCru')-100)}; },
    fsHit(A,T,u,c){ const f=O(T).fs; if(!f||!c.tgt) return; if(f.hits.some(h=>h.t===c.tgt)) return; f.hits.push({t:c.tgt,amt:c.amt||0,mol:molten(T,c.tgt)}); },
    fsOut(A,T,u,c){ const o=O(T), f=o.fs, P=T.P, t=c.tgt; if(!t||t.team===u.team) return;
      if(P['mo.rh']&&molten(T,t)) c.amt*=1+P['mo.rh'];
      if(f&&f.pour){ c.amt*=1+(P['pour.k']||0); if(P.op) c.amt*=1+P.op*f.pour.over; if(P.pd&&t===f.t) c.amt*=1.40; } },
    fsAmt(A,T,u){ const E=A.eng(), lv=(u.skillLv&&u.skillLv[1])||1; return (u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*E.rage()*1.8*(E.skillMul?E.skillMul(lv):1); },
    fsStrike(A,T,u,t){ const E=A.eng(); if(!t||!t.alive||!E.strike) return; const pv=T.s.cur, pd=T.s.d; T.s.cur=FS; T.s.d=0;
      try{ E.strike(u,t,T.fn.fsAmt(A,T,u),'#ffa657'); } finally{ T.s.cur=pv; T.s.d=pd; } },
    fsCast(A,T,u){ const o=O(T), f=o.fs, P=T.P, E=A.eng(); o.fs=null; if(!f||!u.alive) return;
      const hit=t=>f.hits.some(h=>h.t===t);
      if(o.fpT>0&&o.fpN>0){ o.fpN--; o.fs=f; try{ const w=wpOn(T)?o.wp:null, t=w&&w.target&&w.target.alive&&w.target.team!==u.team?w.target:null; if(t&&!hit(t)) T.fn.fsStrike(A,T,u,t); } finally{ o.fs=null; } }
      if(f.pour&&P.sig1&&o.s1<=0){ const mol=[]; for(const x of E.units()) if(x.alive&&x.team!==u.team&&molten(T,x)) mol.push(x);
        if(mol.length>=3){ o.s1=SIG_CD; o.fs=f; try{ for(const x of mol) if(!hit(x)) T.fn.fsStrike(A,T,u,x); } finally{ o.fs=null; }
          const b=T.fn.cqBurn(A,T,u); for(const x of A.pick(T,u,{team:'enemy',within:6},{u})){ T.fn.force(A,T,x); T.fn.burn(A,T,u,x,b,6,'pm'); } } }
      for(const h of f.hits){ const t=h.t;
        if(f.pour&&P.pw&&t.alive) T.fn.burn(A,T,u,t,0.25*h.amt*(1+(P['pw.k']||0))/4,4,'pw');
        if(P.slag&&h.mol){ for(const x of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},{u,tgt:t})) T.fn.burn(A,T,u,x,0.30*h.amt/3,3,'so'); } }
      if(f.pour&&P.pd&&f.t&&f.t.alive&&hit(f.t)){ T.fn.force(A,T,f.t); if(P.si) rec(T,f.t).si=4; }
      if(f.hits.length) T.fn.temper(A,T,u,1,true);
      if(P.sh) E.healUnit(u,P.sh*u.maxHp);
      if(f.pour){ A.stSet(T,u,'tCru',Math.min(stN(T,'tCru'),P['cru.keep']||0)); if(P.am) E.healUnit(u,P.am*u.maxHp); } },
    force(A,T,t){ if(!t||!t.alive) return; const r=rec(T,t); r.mf=MOLT_HOLD; if(r.bn) r.bt=Math.max(r.bt,moltT(T)); },
    /* ---- CHAIN QUENCH: the enemies it pulls (struck, and not one that cannot be moved); Chains of Making tempers the Workpiece a step for each, Pulled to the
       Anvil heals it for each of those steps ---- */
    cqKit(A,T){ O(T).cq=0; },
    cqHit(A,T,u,c){ const t=c.tgt; if(!t||t.immovable||(t._gearImmovableT||0)>0||(t.pass&&(t.pass.unstepped||t.pass.unstoppable))) return; O(T).cq=(O(T).cq||0)+1; },
    cqCast(A,T,u){ const o=O(T), n=o.cq||0; o.cq=0; if(!T.P.cm||!(n>0)||!wpOn(T)) return; const got=T.fn.temper(A,T,u,n,false); if(T.P.pa&&got>0&&o.wp.alive) A.eng().healUnit(o.wp,T.P.pa*got*o.wp.maxHp); },
    /* ---- LIVING FORGE: its patch made his (h._talH), its 5 s (Walking Foundry); each tick on an enemy: Waves of Metal, Molten Walk; River of Iron: the enemy
       turns Molten at once and adds 5 to the Crucible (once a second per enemy) ---- */
    lfAt(A,T,u,c){ const h=c.c, o=O(T); if(h&&h.interval&&(T.P.ri||T.P['lf.k1']||T.P['lf.k2']||EX.some(id=>T.r[id]))) h._talH=u; o.lfT=Math.max(o.lfT,(c.o&&c.o.dur)||5); },
    hzTick(A,T,u,c){ const e=c.unit, P=T.P, o=O(T); if(!e) return; o.hzE=e; if(P['lf.k1']) c.amt*=1+P['lf.k1']; if(P['lf.k2']) c.amt*=1+P['lf.k2'];
      if(P.ri&&e.alive&&e.team!==u.team){ const r=rec(T,e); T.fn.force(A,T,e); if(r.rv>0) r.rv-=1; else { r.rv=1; if(CRU.some(id=>T.r[id])) A.stSet(T,u,'tCru',stN(T,'tCru')+5); } } },
    /* ---- HIS BASIC ATTACKS: Runs Hot (Molten), Ember Hands (a 2 s burn of 5% a rank of the hit), Hot Grip (Molten: the Crucible) ---- */
    autoOut(A,T,u,c){ if(T.P['mo.rh']&&molten(T,c.tgt)) c.amt*=1+T.P['mo.rh']; },
    autoHit(A,T,u,c){ const P=T.P, t=c.tgt; if(!t) return; if(P['cru.hh']&&molten(T,t)) A.stSet(T,u,'tCru',stN(T,'tCru')+P['cru.hh']);
      if(P.eh&&t.alive&&c.amt>0) T.fn.burn(A,T,u,t,P.eh*c.amt/2,2,'eh'); },
    /* ---- HIS HITS (one function): Foundry Pace (3 Molten), Many Hammers (two allies hit it in the last 2 s), Proof Mark (it last hit the Workpiece), Heat Inside
       (Housing holds), Still Burning (10 Hardened), Single Ingot (4 s after a Pour Deep) ---- */
    myOut(A,T,u,c){ const P=T.P, o=O(T), t=c.tgt; if(!t) return;
      if(P['o.fp']&&o.mN>=3) c.amt*=1+P['o.fp'];
      if(P['o.mh']){ const r=recOf(T,t); if(r&&Object.keys(r.mh).length>=2) c.amt*=1+P['o.mh']; }
      if(P['o.pm']&&wpOn(T)&&o.wp._talBy===t) c.amt*=1+P['o.pm'];
      if(P['o.hi']&&o.hs>0) c.amt*=1+P['o.hi'];
      if(P['o.sb']&&hdN(T)>=HD_MAX) c.amt*=1+P['o.sb'];
      if(P.si){ const r=recOf(T,t); if(r&&r.si>0) c.amt*=1+P.si; } },
    /* ---- THE CRIT GROUP: Spark Shower (a Molten enemy) and Spark Eye (an enemy near an Example), together at most 5% on any hit: one seeded roll on that hit,
       drawn only when one of them applies ---- */
    crit(A,T,u,c){ const t=c.tgt, P=T.P; if(!t||c.force) return; let p=0; if(P['cr.mo']&&molten(T,t)) p+=P['cr.mo']; if(P['cr.ex']&&T.fn.exK(A,T,t)>0) p+=P['cr.ex'];
      p=Math.min(CRIT_CAP,p); if(!(p>0)) return; const base=Math.min(0.95,(u.glyphCrit||0)+((u._critBuffT||0)>0?(u._critBuffPct||0):0)); if(A.eng().rnd()<p/Math.max(0.05,1-base)) c.force=true; },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP. Every talent of his that makes a hit on him smaller multiplies here, and so does what his talents add to Tempered
       Steel (Open Grate's raised cap, Walking Foundry's doubling) and Hardened; together never more than 30% off a hit (DR_CAP). His passive's own 20% to
       29.9% is the game's and stays outside (so 1 - 0.701 x 0.70 = 51% at most with both, before armour) ---- */
    drK(A,T,u,src,kind,auto){ const P=T.P, o=O(T); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(!auto){ cut(P['dr.fl']); cut(P['dr.he']); cut(P['dr.tm']); cut(P['dr.rf']); } else cut(P['dr.tg']);
      if(P['dr.hs']&&src&&burning(u,src)) cut(P['dr.hs']);
      if(P['dr.sa']&&wpOn(T)) cut(P['dr.sa']);
      if(P.li&&o.liT>0) cut(0.02);
      if(u.hp<0.5*u.maxHp){ cut(P['dr.fw']); cut(P['dr.is']); }
      if(P['dr.pp']&&o.hs>0) cut(P['dr.pp']);
      if(P['hd.dr']) cut(P['hd.dr']*hdEff(T));
      if(P.og||P.wf){ const c=T.fn.tsCut(A,T,u); if(c.c2>c.c0) k*=(1-c.c2)/(1-c.c0); }
      return Math.max(1-DR_CAP,k); },
    myIn(A,T,u,c){ T.s.api=A; const o=O(T); o.hk=c.auto?'auto':'abil'; if(DRG.some(id=>T.r[id])) c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.auto); },
    /* ---- HIS ALLIES' GROUP: Shop Hearth (the Workpiece, from abilities), Workshop Floor (allies tempered under Every Hand Tempered), Hearth Guard (within 3 m of
       him), The Finished Piece (the Workpiece, 8 s): multiplied, never more than 35% off a hit on one ally. Also what his allies' hits are: Many Hammers keeps
       which allies hit an enemy (2 s), Fire in the Work burns the Workpiece's targets ---- */
    allyK(A,T,u,x,auto){ const P=T.P, o=O(T); let k=1; const cut=v=>{ if(v>0) k*=1-Math.min(1,v); }; const w=wpOn(T)?o.wp:null;
      if(x===w&&!auto) cut(P['dr.he']); if(P['al.wf']&&T.fn.steps(A,T,x)>0) cut(P['al.wf']); if(P['al.hg']&&u.alive&&gapM(A,u,x)<3) cut(P['al.hg']); if(x===w&&o.fpT>0) cut(0.30);
      return Math.max(1-ALLY_CAP,k); },
    tIn(A,T,u,c){ const t=c.tgt, s=c.src, P=T.P, o=O(T); if(!t||!s) return;
      if(t.team===u.team){ if(t!==u&&s.team!==u.team&&!t._summon&&(P['al.wf']||P['al.hg']||P['dr.he']||P.sig2)) c.amt*=T.fn.allyK(A,T,u,t,c.auto); return; }
      if(s.team!==u.team||s===u) return;
      if(P['o.mh']&&!s._summon) rec(T,t).mh[s.uid]=2;
      if(P.fw&&wpOn(T)&&s===o.wp&&t.alive&&c.amt>0) T.fn.burn(A,T,u,t,P.fw*c.amt/2,2,'fw'); },
    /* ---- THE WORKPIECE: at each wave start the ally with the most attack (not him, not a summon). Each Forge Strike that strikes an enemy tempers it a step (Every
       Hand Tempered: and every ally within 4 m of him, 3 steps each at most); One Fine Thing: 10 steps. Fully tempered (its max) arms The Finished Piece ---- */
    pickWp(A,T,u,keep,fresh){ const o=O(T); let b=null; for(const x of A.eng().units()) if(x.alive&&x.team===u.team&&x!==u&&!x._summon&&(!b||(x.dmg||0)>(b.dmg||0))) b=x;
      o.wp=b; if(fresh){ o.ws=0; o.mh={}; } else o.ws=keep||0; },
    steps(A,T,x){ const o=O(T); if(!x||!x.alive) return 0; if(x===o.wp) return o.ws; return (o.mh&&o.mh[x.uid])||0; },
    temper(A,T,u,n,fs){ const o=O(T), mx=wpMax(T); let got=0;
      if(wpOn(T)){ const was=o.ws; o.ws=Math.min(mx,o.ws+n); got=o.ws-was; if(was<mx&&o.ws>=mx) T.fn.finished(A,T,u); }
      if(fs&&T.P.mhd) for(const x of A.pick(T,u,{team:'ally',within:4,others:true},{u})){ if(x===o.wp) continue; o.mh[x.uid]=Math.min(3,(o.mh[x.uid]||0)+1); }
      return got; },
    finished(A,T,u){ const o=O(T); if(!T.P.sig2||o.s2||!wpOn(T)) return; o.s2=1; o.fpT=8; o.fpN=3; },
    tempered(A,T,u,c){ const x=c.tgt; return !!x&&x!==u&&x.alive&&T.fn.steps(A,T,x)>0||(!!x&&x===O(T).wp&&O(T).fpT>0&&x.alive); },
    wAtk(A,T,u,c){ const P=T.P, x=c.tgt, n=T.fn.steps(A,T,x), o=O(T); let v=(P['w.atk']||0)*n; if(x===o.wp){ if(P['w.mw']) v+=P['w.mw']*Math.max(0,n-5); if(o.fpT>0) v+=0.30; } return v; },
    wApow(A,T,u,c){ const P=T.P, x=c.tgt, o=O(T); let v=0; if(x===o.wp){ if(P['w.mw']) v+=P['w.mw']*Math.max(0,o.ws-5); if(o.fpT>0) v+=0.30; } return v; },
    wArm(A,T,u,c){ return (T.P['w.arm']||0)*T.fn.steps(A,T,c.tgt); },
    wCrit(A,T,u,c){ return Math.min(WP_CRIT,(T.P['w.cr']||0)*T.fn.steps(A,T,c.tgt)); },
    /* Finished Edge: the Workpiece's critical hits 3% a rank more (its critical damage, given back when it is no longer his Workpiece) */
    fEdge(A,T,u,w){ const o=O(T), x=T.P['w.fe']||0, cur=o.fe; if(cur&&(cur.x!==w||!x)){ cur.x.critDmg=(1+(cur.x.critDmg==null?0.6:cur.x.critDmg))/(1+cur.k)-1; o.fe=null; }
      if(x&&w&&!o.fe){ w.critDmg=(1+(w.critDmg==null?0.6:w.critDmg))*(1+x)-1; o.fe={x:w,k:x}; } },
    /* Quenched True: a control that lands on the fully tempered Workpiece lasts 30% shorter (one it already had that runs longer is not cut) */
    qtCc(A,T,u,c){ const o=O(T), x=c.unit, f=c.field; if(!x||x!==o.wp||!wpFull(T)||!(c.amt>0)) return; const p=o.ccs&&o.ccs.x===x?o.ccs:null, M={stunned:'s',fearT:'f',silencedT:'si',slow:'sl',_sleepT:'z'};
      if(!M[f]) return; const old=p?p[M[f]]:0; x[f]=Math.max(old,c.amt*(1-QT_CUT)); },
    /* ---- EXAMPLES: an enemy Tolley kills is made an Example where it fell (4 s, Lesson Learned longer; reach 4 m, Example to All farther, body edge to that
       spot); his allies' kills within 4 m of him (Make It Count: 30% a rank of the strength); the Workpiece's kills during The Finished Piece. Fear of the
       Forge and Lesson in Iron: his own Examples only ---- */
    killed(A,T,u,c){ const t=c.tgt; if(!t) return; t._tlK=u.uid; },
    died(A,T,u,c){ const x=c.unit, o=O(T), P=T.P; if(!x) return;
      if(x.team!==u.team){ if(P['a.mp']&&moltR(T,recOf(T,x))) o.mp=Math.min(10,o.mp+1); if(EX.some(id=>T.r[id])) o.pend.push({x,at:{x:x.x,y:x.y},by:x._talBy||null,hz:o.hzE===x}); return; }
      if(x===o.wp){ const keep=o.ws; o.wp=null; o.fpT=0; o.fpN=0; if(P.rm){ T.fn.pickWp(A,T,u,keep,false); } } },
    decide(A,T,u,d){ const o=O(T), P=T.P, x=d.x; let k=0, own=false;
      if(x._tlK===u.uid||d.hz||(d.by===u)){ k=1; own=true; }
      else if(d.by&&d.by.team===u.team&&!d.by._summon){ if(o.fpT>0&&d.by===o.wp) k=1; if(P.mic&&d.by.alive&&gapM(A,u,d.by)<4) k=Math.max(k,P.mic); }
      if(k>0) T.fn.newEx(A,T,u,d.at,k,own); },
    exR(A,T){ return 4+(T.P['ex.r']||0); },
    newEx(A,T,u,at,k,own){ const o=O(T), P=T.P; o.ex.push({x:at.x,y:at.y,t:4+(P['ex.dur']||0),k}); if(o.ex.length>EX_MAX) o.ex.shift(); o.exN++;
      if(!own) return;
      if(P.li){ o.liT=4; if(T.r.lf_1_1) T.fn.hdAdd(A,T,u,1); }
      if(P.ff){ let b=null, bd=1e9; const E=A.eng(); for(const x of E.units()){ if(!x.alive||x.team===u.team) continue; const dd=Math.hypot(x.x-at.x,x.y-at.y); if(dd<bd){ bd=dd; b=x; } } if(b) T.fn.tfear(A,T,u,b,1); } },
    /* the strongest Example the unit stands near (0: none) */
    exK(A,T,x){ const o=O(T); if(!x||!o.ex.length) return 0; const E=A.eng(), R=T.fn.exR(A,T)*E.METER(), br=E.bodyR(x); let k=0;
      for(const z of o.ex){ if(Math.hypot(x.x-z.x,x.y-z.y)-br<R&&z.k>k) k=z.k; } return k; },
    nearEx(A,T,u,c){ return T.fn.exK(A,T,c.tgt)>0; }, tgtNearEx(A,T,u,c){ return T.fn.exK(A,T,c.tgt)>0; },
    /* a talent fear (the stun-lock rule, applied to his one control): never on an enemy already feared or stunned, nor within 0.5 s after his fear on it ended.
       The stated seconds through the engine's control (the enemy's own control resist, no resist roll, no draw) */
    tfear(A,T,u,t,secs){ const o=O(T); if(!t||!t.alive||t.team===u.team) return false; o.ts.n++;
      if((t.fearT||0)>0||(t.stunned||0)>0){ o.ts.on++; return false; } const r=rec(T,t); if(r.lk>0){ o.ts.lk++; return false; }
      A.control(T,u,t,'fearT',secs); if((t.fearT||0)>0){ t._fearFrom=u; r.fr=t.fearT; r.run=0; return true; } return false; },
    /* ---- ENEMY AURAS: Liquid Iron (Molten: slower), Warning Shown (near an Example: slower), Glowing Iron (Molten) and Make an Example (near one) less damage
       (their attack and ability power), Cautionary (near one: slower attacks). An Example's strength scales its own effects ---- */
    isMolten(A,T,u,c){ return molten(T,c.tgt); },
    eSlowed(A,T,u,c){ return (T.P['e.li']&&T.fn.isMolten(A,T,u,c))||(T.P['ex.mv']&&T.fn.exK(A,T,c.tgt)>0); },
    eMove(A,T,u,c){ const t=c.tgt, P=T.P; let v=0; if(P['e.li']&&molten(T,t)) v-=P['e.li']; if(P['ex.mv']) v-=P['ex.mv']*T.fn.exK(A,T,t); return v; },
    eWeak(A,T,u,c){ return (T.P['e.gi']&&molten(T,c.tgt))||(T.P['ex.k']&&T.fn.exK(A,T,c.tgt)>0); },
    eDmg(A,T,u,c){ const t=c.tgt, P=T.P; let k=1; if(P['e.gi']&&molten(T,t)) k*=1-P['e.gi']; if(P['ex.k']) k*=1-P['ex.k']*T.fn.exK(A,T,t); return k-1; },
    eAspd(A,T,u,c){ return -(T.P['ex.as']||0)*T.fn.exK(A,T,c.tgt); },
    /* ---- HIS CONDITIONAL ATTACK (one stat): Furnace Heart (each Molten enemy within 4 m, 5 at most), Melt Point (enemies that died Molten this wave, 10 at most),
       Grim Display (Examples this wave, 10 at most), Worth Making (the Workpiece fully tempered), Case Hardened (each Hardened stack), Long Burning (each 10 s
       alive in the wave, 10 at most), Grate Thrown Wide (each 4% of Tempered Steel under Open Grate, 15% at most) ---- */
    atkK(A,T,u){ const P=T.P, o=O(T); let v=0;
      if(P['a.fh']) v+=P['a.fh']*o.mNear; if(P['a.mp']) v+=P['a.mp']*o.mp; if(P['a.gd']) v+=P['a.gd']*Math.min(10,o.exN);
      if(P['a.wm']&&wpFull(T)) v+=P['a.wm']; if(P['a.ch']) v+=P['a.ch']*hdEff(T); if(P['a.lb']) v+=P['a.lb']*o.lb;
      if(P['a.wo']&&P.og){ const c=T.fn.tsCut(A,T,u); v+=Math.min(WO_CAP,P['a.wo']*Math.floor(c.c1/0.04+1e-9)); }
      return v; },
    /* ---- HOUSING (Outer Housing, Sealed Seams): a shield on him of that share of his max HP, whole at each wave start, rebuilt after 6 s without taking damage
       (Riveted Plates: sooner). It is on his shield and takes a hit first; Tough Rivets: against an ability hit it absorbs that much more (what it would have
       lost is given back on his next tick). When it breaks: Banked Fire's flare (Ember Flare), Second Housing (the first break each wave: half of it at once) ---- */
    hsWait(A,T){ return Math.max(1,6-(T.P['hs.fast']||0)); },
    hurt(A,T,u,c){ const o=O(T); if(o.hsMax>0) o.hsT=T.fn.hsWait(A,T); if(T.P.sig3&&o.s3T>0&&c.src&&c.src.team!==u.team) T.fn.hdAdd(A,T,u,1); },
    dotIn(A,T,u){ const o=O(T); o.hk='dot'; if(o.hsMax>0) o.hsT=T.fn.hsWait(A,T); },
    absorb(A,T,u,c){ const o=O(T), P=T.P; if(!(o.hs>0)) { o.hk=null; return; } const take=Math.min(o.hs,c.amt||0); if(!(take>0)) return;
      const loss=(o.hk==='abil'&&P['hs.tr'])?take/(1+P['hs.tr']):take; o.hk=null; o.rf+=take-loss; o.hs-=loss; o.hsT=T.fn.hsWait(A,T);
      if(o.hs<=1e-6){ o.hs=0; o.rf=0; T.fn.hsBreak(A,T,u); } },
    hsBreak(A,T,u){ const o=O(T), P=T.P;
      if(P.bf){ const b=T.fn.cqBurn(A,T,u)*(1+(P['bf.k']||0)); for(const x of A.pick(T,u,{team:'enemy',within:3},{u})) T.fn.burn(A,T,u,x,b,4,'bf'); }
      if(P.sh2&&!o.hsBr){ o.hsBr=true; o.hsAdd=o.hsMax/2; } },
    /* Bolted Shut: a pull on him (the game's drag) moves him 25% a rank slower, a knock moves him back that share toward where he stood (50% at most) */
    bolted(A,T,u,c){ const k=Math.min(BOLT_CAP,T.P.bolt||0); if(!(k>0)) return; if(c.kind==='pull'){ if(u.pullSpeed>0) u.pullSpeed*=1-k; }
      else if(c.kind==='knock'&&c.from){ u.x-=(u.x-c.from.x)*k; u.y-=(u.y-c.from.y)*k; u._ax=u.x; u._ay=u.y; } },
    /* ---- REFUSED and FIRE STILL IN IT. Refused: once per fight, a hit that would kill him while he holds 10 Hardened: all spent, held at 1 HP for 2 s. Fire
       Still In It (SIGNATURE): once per fight below 30% HP: his Living Forge at once, its patch where he stands (no energy spent); for its 5 s he cannot drop
       below 1 HP and every enemy hit he takes adds a Hardened stack; when it ends he heals 3% of his max HP for each Hardened stack ---- */
    lethal(A,T,u,c){ const o=O(T); if(T.P.rf&&!o.refused&&hdN(T)>=HD_MAX){ o.refused=1; A.stSet(T,u,'tHd',0); A.acts(T,u,[{undying:2}],c); } },
    fireStill(A,T,u){ const o=O(T), E=A.eng(); o.s3=1; o.s3T=5; A.acts(T,u,[{undying:5}],{u,tgt:u});
      if(E.castUltFree){ const ax=u._aimWX, ay=u._aimWY; u._aimWX=u.x; u._aimWY=u.y; try{ E.castUltFree(u); } finally{ u._aimWX=ax; u._aimWY=ay; } } }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/58 - TOLLEY - talent decisions.md) */
  ruling:{}
};
