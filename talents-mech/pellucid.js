/* PELLUCID - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Pellucid")
   His real kit (the code, not the tooltip wording; a melee Tank, every skill reads Attack, his damage is physical; measured: tests/pellucid-kit-facts.js):
   - Meteor Knuckle ('aoeStun', green, cd 8, deliver 'land', fall 0.45 s): it lands where its target stood at the launch (or, today, at an old ultimate's aim:
     release v1391 fixes that) and strikes every enemy whose CENTRE is within 2.6 m of that spot for 125% of his attack x skill level, then stuns each one 1.4 s
     (the table's area stun x 0.7). Its kit / cast / hit / ccHit rows run at the LANDING ('casting' is 'aoeStun').
   - Infernal Clinch ('atkcrush', blue, cd 10): the enemy with the highest attack ANYWHERE on the field (no range: it was 9.3 m from his body on average) takes
     150% of his attack x skill level, -35% attack for 5 s and a 2.45 s stun (the single stun x 0.7, less the target's control resist).
   - Worldbreaker Fists ('worldbreaker', ultimate, energy; ULT_DEF mul 0.45, radius 6 m, 3 slams 0.7 s apart, wave 12 m/s, stun 0.4 -> table): each slam sends a
     shockwave from where he stands; every enemy whose body is within 6 m of him takes 45% of his attack x skill level when the wave reaches it, and a stun
     (1.4 s; the third slam x3, cut at the 2.8 s ceiling). Page sites added for him: each slam runs 'pass' (skill 'wbSlam0' .. 'wbSlam2'), each shockwave hit is a
     landPre / land pair ('casting' 'wb0' .. 'wb2').
   - Unmovable Mass (passive 'unmovable'): immovable; every 3rd direct hit he takes adds a molten layer (u.wardenStk, max 5, 4.43% each at level 100 = 22.2%;
     the cap 29.9% is never reached), cleared each wave. Every displacement the engine refuses him runs 'unmoved' (18 guarded page lines).
   Craze, the Flow, Reglaze, Check, Unmoved, the File, Knuckle Heat, Held Fast and Tremors exist only through his talents. All his state names start with 'pe';
   his own per-fight object is T.s.pe. Every lock and delay of his counts DOWN by the tick's dt (the fight clock starts again at 0 each wave).
   Readings, caps and corrected tooltips: WIRING/46 - PELLUCID - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const MK='aoeStun', CL='atkcrush', WB=['wb0','wb1','wb2'], SK=[MK,CL,'wb0','wb1','wb2'];
/* the families: each state's bookkeeping runs when any talent that reads it is learned */
const GLZ=['gc_1_4','gc_9_4','gc_3_4','gc_5_4','gc_7_4','gc_12_4'];                                              // Reglaze (it comes when the Flow ends)
const FLOWT=['gc_1_2','gc_2_2','gc_4_2','gc_7_3','gc_8_2','gc_9_2','gc_10_2','gc_11_2','gc_12_1','gc_12_2'].concat(GLZ);   // the Flow (it comes when the crust breaks)
const CRZ=['gc_1_1','gc_2_1','gc_3_1','gc_4_1','gc_5_2','gc_5_3','gc_6_4','gc_6_1','gc_8_1','gc_10_1','gc_11_1','gc_7_1','gc_6_3'].concat(FLOWT);   // Craze and the crust breaking
const HEAT=['fm_1_1','fm_2_1','fm_3_1','fm_4_1','fm_6_1','fm_7_1','fm_10_1','fm_11_2','fm_12_2','fm_13_2'];         // Knuckle Heat
const HF=['fm_2_2','fm_4_2','fm_5_2','fm_5_3','fm_6_3','fm_7_2','fm_2_3','fm_9_2','fm_13_2'];                       // Held Fast
const TREM=['fm_1_4','fm_6_4','fm_3_4','fm_5_4','fm_7_4','fm_9_4','fm_10_4','fm_12_4','fm_13_2'];                   // Tremors
const CHK=['rk_1_1','rk_3_1','rk_n2','rk_5_1','rk_6_1','rk_7_1','rk_9_1','rk_10_1','rk_12_1','rk_11_3','rk_13_3'];  // Check
const UNM=['rk_1_4','rk_2_4','rk_3_4','rk_4_4','rk_6_4','rk_8_4','rk_9_4','rk_10_4','rk_13_3'];                     // Unmoved
const FILE=['rk_2_3','rk_4_3','rk_6_3','rk_8_3','rk_10_3','rk_5_2','rk_5_3','rk_6_2','rk_11_3','rk_12_3','rk_13_3','rk_n2'];   // the Guarded File
const STN=CHK.concat(['rk_11_4','fm_12_1','fm_10_2','fm_11_2','fm_5_3','fm_9_4']);                                 // what reads the stuns he lands (and the stun-lock marks)
const DRG=['gc_3_1','gc_5_3','gc_12_2','rk_4_4','rk_6_3','rk_8_2','rk_11_4','rk_12_4','rk_10_1','rk_n2','rk_2_2','gc_6_1','gc_10_3','gc_n1'];   // his damage reduction: ONE capped group
const ALLY=['rk_2_3','rk_1_1','gc_6_1','rk_13_3','rk_8_3'];                                                         // what his allies get (three cuts that multiply, 15.1% at most) and what marks their attackers
const TEN=['rk_5_4','fm_12_3'];                                                                                    // his control shortening: ONE capped group
const BURN=['peFlowB','peFld','peSear','peFire','peBrit','peGb'];                                                   // the tags of his burns
const DR_FLOOR=0.60, TEN_CAP=0.30, STUN_TOP=4.0;   // his group at most 40%, his control shortening at most 30%; a base stun with its extensions at most 4.0 s (his allies' three cuts reach 15.1% at most: no cap is needed)
const S=T=>T.s.pe||(T.s.pe={q:[],file:[],cbCd:0,cbmCd:0,valCd:0,cbBelow:{},tsN:{},hfHp:{}});
const rk=(T,id)=>T.r[id]||0, rk1=(T,id)=>Math.max(1,T.r[id]||0);
const any=(T,L)=>L.some(id=>T.r[id]);
const atkOf=(A,T,u)=>A.amtOf(T,u,{pct:1,of:'atk'},null);
const gapM=(A,u,x)=>A.gap(u,x)/A.eng().METER();
const foes=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget);
const nearFoes=(A,u,of,m)=>foes(A,u).filter(x=>x!==of&&A.gap(of,x)<m*A.eng().METER());
const later=(T,secs,f,a)=>S(T).q.push({t:secs,f,a});     // a delay of his, counted down by his tick (cleared at each wave's start)
module.exports={
  hero:'pellucid',
  casting:true,                         // rows ask which of his skills a hit, a stun or a cast comes from
  states:{
    peCraze:{max:5,wave:'reset'},                                     // Craze (the crust breaks at 5)
    peHeat:{max:P('heat.max',6),wave:'reset'},                        // Knuckle Heat (White Hot Fists: up to 9)
    peUnm:{max:P('unm.max',5),wave:'reset'},                          // Unmoved (Stone Patience: up to 8)
    peFlows:{max:5}                                                   // the Flows this fight (Patient Fire)
  },
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                    // his delays and locks, the File, the heat leak, Lava Tide, Long File, the signatures
    {on:'wave',do:[{fn:'waveStart'}]},
    {on:'hurt',reqAny:CRZ,if:{srcTeam:'enemy'},do:[{fn:'crazeHit'}]},                                              // Craze from big hits on him; at 5 the crust breaks
    {on:'end:peFlow',reqAny:GLZ.concat(['gc_13_2']),do:[{fn:'flowEnd'}]},                                          // Reglaze when the Flow ends
    {on:'hit',reqAny:FLOWT.concat(['gc_13_2']),if:{targetTeam:'enemy',window:'peFlow'},do:[{fn:'flowBurn'}]},      // the Flow's burn on his hits
    {on:'hit',reqAny:HEAT,if:{auto:true,targetTeam:'enemy'},do:[{stack:'peHeat',add:1}]},                          // Knuckle Heat from his basic attacks
    {on:'kit',skill:MK,do:[{fn:'mkKit'}]}, {on:'kit',skill:CL,do:[{fn:'clKit'}]},                                   // the Heat they spend; Opening Move's first Knuckle
    {on:'cast',skill:MK,do:[{fn:'mkCast'}]}, {on:'cast',skill:CL,do:[{fn:'clCast'}]},
    {on:'hit',reqAny:TREM.concat(['fm_7_2']),if:{targetTeam:'enemy',casting:[MK,'wb0','wb1','wb2']},do:[{fn:'rec'}]},   // the hits a Tremor (and the second fist) repeats
    {on:'hit',reqAny:HF,if:{targetTeam:'enemy',casting:CL},do:[{fn:'hold'}]},                                       // Held Fast: the enemy Infernal Clinch grabs
    {on:'peHFEnd',reqAny:['fm_5_3'],if:{broke:false},do:[{fn:'throwDown'}]},
    {on:'pass',reqAny:TREM.concat(['rk_11_3']),do:[{fn:'slam'}]},                                                   // each slam of Worldbreaker Fists
    {on:'ccHit',reqAny:STN,if:{cc:['stunned']},do:[{fn:'stunHit'}]},                                               // every stun he lands: the stun-lock mark, Check, Stand Fast, the extensions
    {on:['in','dotIn'],reqAny:DRG,do:[{fn:'myDr'}]},                                                               // his damage reduction: one capped group
    {on:'teamIn',reqAny:ALLY,do:[{fn:'tIn'}]},                                                                     // his allies' reduction: one capped group; the File's attackers
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                        // his control shortening: one capped group
    {on:'unmoved',reqAny:UNM,do:[{fn:'unm'}]}                                                                      // a pull, push, knock-up or charge he did not move for
  ],
  talents:{
    /* ======================= THE GLASS CRUST ======================= */
    gc_1_1:[ {param:'leak',add:R(0.01)} ],                                                                          // Hairline (the leak in tk; Craze in crazeHit)
    gc_1_2:[ {param:'flow',add:1} ],                                                                                // Fire Under Glass (the Flow in brk, its burn in flowBurn)
    gc_1_4:[ {param:'glz',add:R(0.01)} ],                                                                           // Reglaze (flowEnd)
    gc_2_1:[ {param:'thr',add:R(0.01)} ],                                                                           // Spider Lines (5% down to 2%)
    gc_2_2:[ {param:'flow.dur',add:R(0.5)} ],                                                                       // Hot Run
    gc_3_1:[ {param:'dr.sg',add:0.20} ],                                                                            // Safety Glass (in myDr)
    gc_4_2:[ {on:'out',if:{casting:MK,window:'peFlow',targetTeam:'enemy'},more:R(0.05)} ],                         // Lava Fist
    gc_9_4:[ {param:'glz',add:R(0.01)} ],                                                                           // Second Skin
    gc_3_4:[ {param:'glz.dur',add:R(1)} ],                                                                          // Thick Glaze
    gc_4_1:[ {stat:{atk:R(0.004)},per:'peCraze'} ],                                                                 // Running Heat
    gc_5_2:[ {param:'flood',add:1} ],                                                                               // Flood the Valley (PICK ONE; in brk)
    gc_5_3:[ {param:'hold',add:1} ],                                                                                // Hold It Back (PICK ONE; in brk and myDr)
    gc_5_4:[ {param:'glz.k',add:R(0.02)}, {param:'glz.cl',add:1} ],                                                 // Clear as Glass
    gc_n1:[  {param:'dr.ft',add:R(0.04)} ],                                                                         // Fired Twice (in myDr, on damage over time)
    gc_6_4:[ {param:'kiln',add:R(2)} ],                                                                             // Kiln-Fired (waveStart)
    gc_6_3:[ {param:'hold.dur',add:R(0.5)} ],                                                                       // Still Standing
    gc_6_1:[ {param:'shim',add:R(0.004)} ],                                                                         // Heat Shimmer (in myDr and tIn)
    gc_6_2:[ {on:'dotOut',if:{fn:'myBurn'},more:R(0.03)}, {on:'dmg:peSig',more:R(0.03)} ],                          // Burning Hands
    gc_4_3:[ {on:'out',if:{casting:MK,targetTeam:'enemy'},more:R(0.04)} ],                                         // Heavy Knuckle
    gc_7_1:[ {on:'hit',if:{casting:CL,targetTeam:'enemy'},do:[{fn:'breath'}]} ],                                   // Glassblower's Breath
    gc_7_3:[ {on:'out',if:{window:'peFlow',targetTeam:'enemy'},critMore:R(0.02)} ],                                // Clear Strike (critical damage: crit chance stays with Magma Fist's 5%)
    gc_7_4:[ {on:'out',if:{targetTeam:'enemy',fn:'glazed'},more:R(0.03)} ],                                        // Cooling Crust
    gc_8_1:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.004),per:'peCraze'} ],                              // Fault Lines
    gc_8_2:[ {param:'tide',add:R(0.0024)} ],                                                                        // Lava Tide (in tk: at most 1.2% a second)
    gc_9_2:[ {param:'rof',add:1} ],                                                                                 // River of Fire (flowBurn)
    gc_9_3:[ {stat:{atk:R(0.005)},per:{field:'wardenStk',of:'self',max:5}} ],                                      // Warm Layers
    gc_10_1:[ {on:'hurt',if:{srcTeam:'enemy',stackMin:{peCraze:3}},do:[{dot:'peBrit',on:'source',amt:{pct:R(0.01),of:'atk'},total:true,dur:2,every:1,refresh:true,color:'#ff8a3a'}]} ],   // Brittle Edge
    gc_10_2:[ {param:'burn.dur',add:R(0.3)} ],                                                                      // Ember Glow
    gc_10_3:[ {param:'dr.sto',add:R(0.02)} ],                                                                       // Stoneglass (in myDr)
    gc_11_1:[ {param:'spl',add:1} ],                                                                                // Glass Splinters (brk)
    gc_11_2:[ {stat:{atk:R(0.01)},per:'peFlows'} ],                                                                 // Patient Fire
    gc_11_4:[ {on:'out',if:{casting:CL,targetTeam:'enemy'},more:R(0.03)} ],                                        // Ironglass Fists
    gc_12_1:[ {stat:{aspd:[1/0.97-1,1/0.94-1,1/0.91-1]},if:{window:'peFlow'}} ],                                   // Old Lava (attack interval 3% a rank shorter)
    gc_12_2:[ {param:'dr.wlb',add:R(0.015)} ],                                                                      // What Lies Beneath (in myDr)
    gc_12_3:[ {on:'out',if:{casting:WB,targetTeam:'enemy'},more:R(0.03)} ],                                        // Blown Glass
    gc_12_4:[ {on:'shieldBreak',do:[{fn:'anneal'}]} ],                                                              // Annealing
    gc_13_2:[ {on:'lethal',once:'fight',do:[{fn:'flowStood'}]} ],                                                  // The Flow That Stopped (SIGNATURE)
    /* ======================= THE ROOK ======================= */
    rk_1_1:[ {param:'chk',add:R(0.02)} ],                                                                           // Check (in tIn; Check itself in stunHit)
    rk_2_2:[ {param:'dr.mp',add:R(0.003)} ],                                                                        // Molten Plates (in myDr, per molten layer)
    rk_1_4:[ {stat:{atk:R(0.01)},per:'peUnm'} ],                                                                    // Hold the Corner (Unmoved in unm)
    rk_2_3:[ {param:'file',add:R(0.01)}, {on:'out',if:{targetHas:'peFoe'},more:R(0.01)} ],                         // The File Behind (the ally's cut in tIn)
    rk_2_4:[ {param:'unm.max',add:R(1)} ],                                                                          // Stone Patience
    rk_3_1:[ {param:'chk.dur',add:R(0.5)} ],                                                                        // Checking Line
    rk_9_2:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.02)} ],                                             // Crushing Grip
    rk_3_4:[ {on:'hurt',if:{srcTeam:'enemy',stackMin:{peUnm:5}},do:[{fn:'castle'}]} ],                             // Castle Wall
    rk_n2:[  {param:'dr.gbs',add:0.03}, {param:'gbs',add:1,req:'gc_1_4'} ],                                         // Glass Behind Stone (LINK; in myDr; with Reglaze: flowEnd)
    rk_4_2:[ {on:'out',if:{casting:CL,targetTeam:'enemy'},more:R(0.04)} ],                                         // Square Fist
    rk_4_3:[ {param:'lfile',add:R(0.002)} ],                                                                        // Long File (in tk)
    rk_4_4:[ {param:'dr.wr',add:R(0.004)} ],                                                                        // Weight of the Rook (in myDr, per Unmoved)
    rk_5_1:[ {on:'teamIn',if:{targetHas:'peChk',srcTeam:'ally'},more:R(0.015)} ],                                  // Check Pressure (his own hits too: hits on a watched enemy)
    rk_8_3:[ {param:'fguard',add:R(0.02)} ],                                                                        // File Guard (in tIn)
    rk_5_4:[ {param:'ten',add:R(0.04)} ],                                                                           // Unmovable (in ten)
    rk_6_1:[ {param:'chk.first',add:R(1)} ],                                                                        // Opening Move
    rk_6_3:[ {param:'dr.rw',add:R(0.01)} ],                                                                         // Rook's Watch (in myDr)
    rk_6_4:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.005),per:'peUnm'} ],                             // Planted Fists
    rk_7_2:[ {on:'out',if:{casting:MK,targetTeam:'enemy'},more:R(0.03)} ],                                         // Grand Fist
    rk_8_2:[ {param:'dr.bl',add:R(0.02)} ],                                                                         // Blocked Lines (in myDr)
    rk_7_4:[ {on:'out',if:{targetTeam:'enemy',fn:'front'},more:R(0.02)} ],                                         // Board Edge
    rk_7_1:[ {on:'death',if:{unitHas:'peChk'},do:[{fn:'discCheck'}]} ],                                            // Discovered Check
    rk_5_2:[ {param:'cb',add:1}, {on:'teamIn',if:{srcTeam:'enemy',fn:'cbOk'},divert:1,do:[{fn:'cbUsed'}]} ],       // Closed Board (PICK ONE): the hit is moved onto him (the runtime's divert)
    rk_5_3:[ {param:'twoFiles',add:1} ],                                                                            // Two Files (PICK ONE)
    rk_8_4:[ {stat:{hp:R(0.002)},per:'peUnm'} ],                                                                    // Corner Stone
    rk_9_1:[ {param:'perp',add:1} ],                                                                                // Perpetual Check (stunHit)
    rk_6_2:[ {param:'cb.less',add:R(1)} ],                                                                          // Interpose
    rk_9_4:[ {stat:{lifesteal:R(0.003)},per:'peUnm',if:{selfHpBelow:0.40}} ],                                      // Glass Endgame
    rk_10_1:[ {param:'dr.cw',add:R(0.005)} ],                                                                       // Check Weight (in myDr)
    rk_10_3:[ {on:'teamIn',if:{targetTeam:'enemy',fn:'srcOnFile'},more:R(0.01)} ],                                 // Rook and King
    rk_10_4:[ {param:'nr',add:R(0.2)} ],                                                                            // No Retreat (unm)
    rk_11_2:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',within:3}} ],                                                 // Slow Board
    rk_11_3:[ {param:'cw',add:1} ],                                                                                 // Castling Wall (slam, stunHit)
    rk_11_4:[ {param:'dr.sf',add:R(0.02)} ],                                                                        // Stand Fast (in myDr; the mark in stunHit)
    rk_12_1:[ {on:'peChkEnd',if:{broke:false},do:[{slow:R(0.15),dur:2,on:'target'}]} ],                            // Forced Move
    rk_12_2:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                                 // Rook's Patience
    rk_12_3:[ {param:'hfile',add:R(0.03)} ],                                                                        // Hold the File
    rk_12_4:[ {param:'dr.lr',add:R(0.02)} ],                                                                        // Last Rank (in myDr)
    rk_13_3:[ {param:'cbm',add:1} ],                                                                                // Cannot Be Moved (SIGNATURE; in tk and tIn)
    /* ======================= THE FALLING MOUNTAIN ======================= */
    fm_1_1:[ {on:'out',if:{casting:[MK,CL],targetTeam:'enemy'},more:R(0.015),per:{fn:'spent'}} ],                 // Hot Knuckles
    fm_6_4:[ {param:'first',add:R(0.20)} ],                                                                         // First Shock
    fm_1_4:[ {param:'trem',add:R(0.10)} ],                                                                          // Tremor (rec, tremor)
    fm_2_1:[ {param:'heat.max',add:R(1)} ],                                                                         // White Hot Fists
    fm_2_2:[ {param:'hf.on',add:1}, {on:'out',if:{auto:true,targetHas:'peHF'},more:R(0.03)},                       // Held Fast
             {on:'teamHeal',if:{unitHas:'peHF'},do:[{fn:'hfCap'}]} ],
    fm_3_1:[ {on:'hit',if:{casting:[MK,CL],targetTeam:'enemy',fn:'spent6'},do:[{fn:'sear'}]} ],                    // Searing Spend
    fm_3_4:[ {param:'roll',add:R(0.04)} ],                                                                          // Rolling Shock (tremor)
    fm_4_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.005),per:'peHeat'} ],                            // Furnace Breath
    fm_4_2:[ {param:'hf.dur',add:R(0.5)} ],                                                                         // Iron Grip
    fm_4_3:[ {on:'kit',skill:MK,opt:{radius:{addM:R(0.2)}}} ],                                                     // Bigger Fist
    fm_n2:[  {on:'out',if:{auto:true,targetTeam:'enemy',targetLacks:'peKn'},more:R(0.08)},                         // First Knock
             {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{mark:'peKn',on:'target'}]} ],
    fm_5_2:[ {param:'crush',add:1} ],                                                                               // Crush the Arms (PICK ONE; in tk)
    fm_5_3:[ {param:'throw',add:1} ],                                                                               // Throw Them Down (PICK ONE; throwDown)
    fm_5_4:[ {param:'deep',add:R(0.3)} ],                                                                           // Deep Quake (tremor)
    fm_6_1:[ {param:'coal',add:R(2)} ],                                                                             // Coal in the Knuckles (waveStart)
    fm_6_2:[ {on:'out',if:{casting:CL,targetTeam:'enemy'},more:R(0.03)} ],                                         // Clinch Strength
    fm_6_3:[ {param:'crater',add:R(0.10)} ],                                                                        // Ground Crater
    fm_10_2:[ {param:'cl.ext',add:R(0.1)} ],                                                                        // Hold Tighter (stunHit)
    fm_7_1:[ {param:'bk',add:R(0.003)} ],                                                                           // Burning Knuckles (spend)
    fm_7_2:[ {param:'twice',add:1} ],                                                                               // The Mountain Falls Twice (mkCast)
    fm_2_3:[ {stat:{aspd:[1/0.97-1,1/0.94-1,1/0.91-1]},if:{fn:'hfOn'}} ],                                          // Fist Speed (attack interval 3% a rank shorter)
    fm_7_4:[ {param:'echo',add:R(0.02)} ],                                                                          // Echoing Ground (tremor)
    fm_8_1:[ {on:'out',if:{targetTeam:'enemy'},ignoreArmor:R(0.02)} ],                                             // Smelted
    fm_8_3:[ {stat:{atk:R(0.005)},per:{field:'wardenStk',of:'self',max:5}} ],                                      // Molten Heart
    fm_9_2:[ {on:'teamIn',if:{targetHas:'peHF',srcTeam:'ally'},more:R(0.01)} ],                                    // Grinding Hold (his own hits too)
    fm_9_3:[ {on:'out',if:{casting:WB,targetTeam:'enemy'},more:R(0.03)} ],                                         // Crater Maker
    fm_9_4:[ {param:'shaker',add:1} ],                                                                              // Worldshaker (slam, tremor)
    fm_10_1:[ {on:'hit',if:{auto:true,targetTeam:'enemy',stackMin:{peHeat:6}},do:[{fn:'fireFist'}]} ],             // Fire Fists
    fm_10_4:[ {param:'settle',add:R(0.1)} ],                                                                        // Settling Ground (tremor)
    fm_11_1:[ {on:'out',if:{targetTeam:'enemy',fn:'stunnedT'},more:R(0.03)} ],                                     // Bonebreaker
    fm_11_2:[ {param:'opens',add:0.1} ],                                                                            // Open Hearth (stunHit)
    fm_11_3:[ {on:'hit',if:{casting:SK,targetTeam:'enemy'},do:[{heal:{pct:R(0.01),of:'hpLost'}}]} ],               // Lava Veins
    fm_12_1:[ {param:'mk.ext',add:R(0.1)} ],                                                                        // Crushing Weight (stunHit)
    fm_12_2:[ {stat:{atk:R(0.003)},per:{roll:'peRise',step:1,max:10}} ],                                           // Rising Fire (the Heat spent in spend)
    fm_12_3:[ {param:'ten.sil',add:R(0.10)} ],                                                                      // Jaw of Glass (in ten)
    fm_12_4:[ {param:'rumble',add:R(0.03)} ],                                                                       // Long Rumble (tremor)
    fm_13_2:[ {on:'crit',if:{targetTeam:'enemy'},do:[{fn:'valCrit'}]}, {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'valHit'}]} ]   // The Valley Remembers (SIGNATURE)
  },
  fn:{
    /* ---- small conditions and counts ---- */
    spent(A,T){ return S(T).sp||0; },
    spent6(A,T){ return (S(T).sp||0)>=6; },
    myBurn(A,T,u,c){ return BURN.indexOf(c.tag)>=0; },
    glazed(A,T,u){ return A.winOn(T,'peGlaze')&&(u.shield||0)>0; },
    hfOn(A,T,u){ const h=S(T).hf; return !!(h&&h.alive&&A.markOf(u,h,'peHF')); },
    stunnedT(A,T,u,c){ return !!c.tgt&&(c.tgt.stunned||0)>0; },
    front(A,T,u,c){ const E=A.eng(), t=c.tgt; if(!t||!E.depth) return false; return (+E.depth(t.key)||0)<=1; },   // the enemy's formation row: the front rank (depth 1 or less; monsters by their role)
    onFile(A,T,u,x){ return S(T).file.indexOf(x)>=0; },
    srcOnFile(A,T,u,c){ return !!c.src&&S(T).file.indexOf(c.src)>=0; },
    cbOk(A,T,u,c){ const o=S(T); return !!T.P.cb&&!(o.cbCd>0)&&!!c.tgt&&o.file.indexOf(c.tgt)>=0&&(c.amt||0)>0; },
    cbUsed(A,T){ S(T).cbCd=Math.max(1,6-(T.P['cb.less']||0)); },
    /* ---- each tick: his delays and locks (count-downs), the File, the heat leak, Lava Tide, Long File, Held Fast's arms, the two signatures ---- */
    tk(A,T,u,c){ const o=S(T), P=T.P, E=A.eng(), dt=c.dt||0, M=E.METER();
      for(const k of ['cbCd','cbmCd','valCd']) if(o[k]>0) o[k]=Math.max(0,o[k]-dt);
      if(o.q.length){ const due=[]; for(let i=0;i<o.q.length;i++){ const q=o.q[i]; q.t-=dt; if(q.t<=1e-9){ due.push(q); o.q.splice(i--,1); } } for(const q of due) T.fn[q.f](A,T,u,q.a); }
      if(any(T,FILE)) T.fn.pickFile(A,T,u);
      if(P.leak&&A.stGet(T,'peCraze')>0){ o.lkA=(o.lkA||0)+dt; if(o.lkA>=1-1e-9){ o.lkA-=1; const n=A.stGet(T,'peCraze'), d=P.leak*n*atkOf(A,T,u);   // Hairline: each second, enemies within 2 m of his body
          for(const x of nearFoes(A,u,u,2)) A.hurt(T,u,x,d,'#ff9a4a','peLeak'); } } else o.lkA=0;
      if(P.tide&&A.winOn(T,'peFlow')){ o.tdA=(o.tdA||0)+dt; if(o.tdA>=1-1e-9){ o.tdA-=1; E.healUnit(u,Math.min(0.012,P.tide)*u.maxHp); } } else o.tdA=0;   // Lava Tide: at most 1.2% a second
      if(P.lfile&&o.file.length){ o.lfA=(o.lfA||0)+dt; if(o.lfA>=1-1e-9){ o.lfA-=1; for(const a of o.file) if(a.alive) E.healUnit(a,Math.min(0.012,P.lfile)*a.maxHp); } } else o.lfA=0;   // Long File
      if(P.crush){ const h=o.hf; if(h&&h.alive&&A.markOf(u,h,'peHF')) h.silencedT=Math.max(h.silencedT||0,0.1); }                  // Crush the Arms: no skill while Held Fast
      if(o.sigT>0){ o.sigT=Math.max(0,o.sigT-dt); o.sgA=(o.sgA||0)+dt; if(o.sgA>=1-1e-9){ o.sgA-=1; const d=0.5*atkOf(A,T,u);      // The Flow That Stopped: each second, enemies within 3 m
          for(const x of nearFoes(A,u,u,3)) A.acts(T,u,[{dmg:d,on:'target',tag:'peSig',color:'#ff7a2a'}],{u,src:u,tgt:x}); } }
      if(P.cbm) T.fn.cbmTick(A,T,u,dt); },
    waveStart(A,T,u){ const o=S(T), P=T.P; o.api=A; o.q.length=0; o.hf=null; o.cbCd=0; o.cbm=null; o.firstT=true; o.mkW=-1; o.sigT=0; o.sigF=false; o.lkA=0; o.tsN={};   // the probe of the 95% test reads o.api
      for(const x of A.eng().units()){ const M=x._talM, m=M&&M[u.uid]; if(m) delete m.peKn; }   // First Knock (fm_n2): each enemy is a fresh knock each wave (the mark has no clock of its own)
      if(P.kiln) A.stSet(T,u,'peCraze',Math.min(4,P.kiln));
      if(P.coal) A.stSet(T,u,'peHeat',P.coal); },
    /* ---- THE GLASS CRUST: Craze from hits on him worth more than 5% of his max HP (Spider Lines: 1% less a rank), none while the Flow runs; at 5 the crust breaks ---- */
    crazeHit(A,T,u,c){ const thr=Math.max(0.02,0.05-(T.P.thr||0)); if((c.amt||0)>thr*u.maxHp) T.fn.craze(A,T,u,1); },
    craze(A,T,u,n){ if(A.winOn(T,'peFlow')||!(n>0)) return; const k=Math.min(5,A.stGet(T,'peCraze')+n); A.stSet(T,u,'peCraze',k); if(k>=5) T.fn.brk(A,T,u); },
    brk(A,T,u){ const o=S(T), P=T.P, E=A.eng(); A.stSet(T,u,'peCraze',0); o.brkN=(o.brkN||0)+1;
      if(any(T,FLOWT)) T.fn.flowOn(A,T,u,4+(P['flow.dur']||0),false);
      if(P.hold) A.acts(T,u,[{window:'peHold',dur:3+(P['hold.dur']||0)}],{u});
      if(P.flood) for(const x of nearFoes(A,u,u,3)) A.acts(T,u,[{dot:'peFld',on:'target',amt:0.30*atkOf(A,T,u),total:true,dur:3,every:1,color:'#ff7a2a'}],{u,src:u,tgt:x});
      if(P.spl){ const L=foes(A,u).sort((a,b)=>E.dist(u,a)-E.dist(u,b)).slice(0,3); for(const x of L) A.acts(T,u,[{dmg:0.6*atkOf(A,T,u),on:'target',color:'#bfe8ff'}],{u,src:u,tgt:x}); } },
    flowOn(A,T,u,d,sig){ const o=S(T); A.acts(T,u,[{window:'peFlow',dur:d}],{u}); o.sigF=!!sig; if(rk(T,'gc_11_2')||any(T,FLOWT)) A.stSet(T,u,'peFlows',A.stGet(T,'peFlows')+1); },
    flowK(A,T){ return 0.04*rk1(T,'gc_1_2'); },                                                                     // the Flow's burn: 4% of the hit a rank of Fire Under Glass (at least one rank's worth)
    burnDur(A,T){ return 2+(T.P['burn.dur']||0); },
    burn(A,T,u,t,total,tag,dur){ if(!t||!t.alive||!(total>0)) return; A.acts(T,u,[{dot:tag,on:'target',amt:total,total:true,dur:dur||T.fn.burnDur(A,T),every:1,color:'#ff8a3a'}],{u,src:u,tgt:t}); },
    flowBurn(A,T,u,c){ const cur=T.s.cur; if(!(c.auto||cur===MK||cur===CL||(T.P.rof&&WB.indexOf(cur)>=0))) return; if(cur===CL&&rk(T,'gc_7_1')) return;   // the Clinch's own burn is Glassblower's Breath's (double)
      T.fn.burn(A,T,u,c.tgt,T.fn.flowK(A,T)*(c.amt||0),'peFlowB'); },
    breath(A,T,u,c){ T.fn.burn(A,T,u,c.tgt,2*T.fn.flowK(A,T)*(c.amt||0),'peGb'); if(any(T,CRZ)) T.fn.craze(A,T,u,2); },   // Glassblower's Breath: the grab burns at double strength, Flow or not, and adds 2 Craze
    flowEnd(A,T,u){ const o=S(T), P=T.P; if(o.sigF){ o.sigF=false; T.fn.glaze(A,T,u,0.30*u.maxHp,4+(P['glz.dur']||0)); return; }
      if(any(T,GLZ)) T.fn.glaze(A,T,u,u.maxHp*(0.01*rk1(T,'gc_1_4')+0.01*rk(T,'gc_9_4'))*(1+(P['glz.k']||0)),4+(P['glz.dur']||0)); },
    glaze(A,T,u,x,d){ const o=S(T), P=T.P; if(!(x>0)) return; A.acts(T,u,[{shield:x,dur:d,on:'self'},{window:'peGlaze',dur:d}],{u}); o.glz=x;
      if(P['glz.cl']) A.acts(T,u,[{cleanse:1,on:'self'}],{u});
      if(P.gbs){ const a=o.file[0]; if(a&&a.alive) A.acts(T,u,[{shield:0.5*x*(1+(P.hfile||0)),dur:d,on:'unit'}],{u,unit:a}); } },   // Glass Behind Stone: the ally on his file, half as much (Hold the File stronger)
    anneal(A,T,u){ if(!A.winOn(T,'peGlaze')) return; A.acts(T,u,[{window:'peGlaze',end:true}],{u}); T.fn.craze(A,T,u,rk(T,'gc_12_4')); },   // Annealing: Reglaze's shield broke
    flowStood(A,T,u,c){ const o=S(T); A.acts(T,u,[{undying:6}],c); A.stSet(T,u,'peCraze',0); T.fn.flowOn(A,T,u,6,true); o.sigT=6; o.sgA=0; },   // The Flow That Stopped
    /* ---- KNUCKLE HEAT: Meteor Knuckle (at its landing) and Infernal Clinch spend it all ---- */
    spend(A,T,u){ const o=S(T), P=T.P; o.sp=0; o.valArm=false; if(!any(T,HEAT)) return; const n=A.stGet(T,'peHeat'); o.sp=n; if(!(n>0)) return; A.stSet(T,u,'peHeat',0);
      if(P.bk) A.eng().healUnit(u,P.bk*n*u.maxHp);                                                                   // Burning Knuckles
      if(rk(T,'fm_12_2')) A.acts(T,u,[{roll:'peRise',add:n,span:5}],{u});                                            // Rising Fire (5 s)
      if(rk(T,'fm_13_2')&&n>=6&&!(o.valCd>0)) o.valArm=true; },                                                      // The Valley Remembers: armed for this cast
    mkKit(A,T,u){ const o=S(T); T.fn.spend(A,T,u); o.mkFirst=(o.mkW!==T.s.wave); o.mkW=T.s.wave; o.rcMk=[]; o.mkHF=false; },
    clKit(A,T,u){ T.fn.spend(A,T,u); },
    mkCast(A,T,u){ const o=S(T), L=o.rcMk||[]; o.rcMk=null; o.sp=0; o.valArm=false; if(!L.length) return;
      if(any(T,TREM)) later(T,1,'tremor',{hits:L.slice(),stun:false});
      if(T.P.twice&&o.mkHF) later(T,0.6,'twice',{hits:L.slice()}); },                                              // The Mountain Falls Twice: half of each hit again, 0.6 s later
    clCast(A,T){ const o=S(T); o.sp=0; o.valArm=false; },
    twice(A,T,u,a){ for(const [e,d] of a.hits) if(e.alive&&d>0) A.acts(T,u,[{dmg:0.5*d,on:'target',color:'#ff9a4a'}],{u,src:u,tgt:e}); },
    rec(A,T,u,c){ const o=S(T), cur=T.s.cur, t=c.tgt, d=c.amt||0;
      if(cur===MK){ if(o.rcMk) o.rcMk.push([t,d]); if(A.markOf(u,t,'peHF')) o.mkHF=true; return; }
      const k=WB.indexOf(cur); if(k<0) return; const w=o.wb&&o.wb[k]; if(!w) return; w.hits.push([t,d]);
      if(!w.q&&any(T,TREM)&&(k===2||T.P.shaker)){ w.q=true; later(T,1,'tremor',{hits:w.hits,stun:k===2&&!!T.P.shaker}); } },   // one Tremor a slam, 1 s after its first hit (without Worldshaker only the third slam)
    slam(A,T,u,c){ const o=S(T), nm=String(c.skill||''); if(nm.slice(0,6)!=='wbSlam') return; const k=+nm.slice(6)||0;
      (o.wb||(o.wb=[]))[k]={hits:[],q:false};
      if(T.P.cw&&o.file.length) for(const a of o.file) if(a.alive) A.acts(T,u,[{shield:0.04*u.maxHp*(1+(T.P.hfile||0)),dur:4,on:'unit'}],{u,unit:a}); },   // Castling Wall: each slam shields the File
    /* a TREMOR: every enemy the slam hit takes 10% of that hit again a rank (Tremor), 1 s after; Deep Quake reaches enemies near them; the third slam's stuns (Worldshaker) */
    tremK(A,T){ const o=S(T), P=T.P; let k=0.10*rk1(T,'fm_1_4')*(1+(P.rumble||0)); if(o.firstT){ o.firstT=false; k*=1+(P.first||0); } return k; },
    tremor(A,T,u,a){ const P=T.P, E=A.eng(), k=T.fn.tremK(A,T), hit=a.hits.filter(h=>h[0].alive), got=new Set(hit.map(h=>h[0]));
      if(P.deep){ for(const x of foes(A,u)){ if(got.has(x)) continue; let best=null,bd=1e9; for(const h of hit){ const g=A.gap(h[0],x); if(g<P.deep*E.METER()&&g<bd){ bd=g; best=h; } } if(best){ hit.push([x,best[1]]); got.add(x); } } }
      const st=[]; for(const [e,d] of hit){ if(!e.alive||!(d>0)) continue; const x=k*d*(((e.stunned||0)>0)?1+(P.echo||0):1);
        A.acts(T,u,[{dmg:x,on:'target',color:'#d8a060',tag:'peTrem'}],{u,src:u,tgt:e});
        if(P.roll&&e.alive) A.acts(T,u,[{slow:P.roll,dur:1,on:'target'}],{u,src:u,tgt:e}); st.push(e); }
      if(a.stun) T.fn.tstun(A,T,u,st,0.4,'shaker');
      o_settle(A,T,u); },
    /* ---- HELD FAST: the enemy Infernal Clinch grabs (4 s, Iron Grip longer): it cannot be healed above the HP it had then (Held Fast) ---- */
    hold(A,T,u,c){ const o=S(T), t=c.tgt; if(!t||!t.alive) return; A.acts(T,u,[{mark:'peHF',on:'target',dur:4+(T.P['hf.dur']||0),while:'alive',ends:'peHFEnd'}],{u,src:u,tgt:t}); o.hf=t; o.hfHp[t.uid]=t.hp; },
    hfCap(A,T,u,c){ const t=c.unit, cap=S(T).hfHp[t&&t.uid]; if(cap==null) return; c.amt=Math.max(0,Math.min(c.amt,cap-t.hp)); },
    throwDown(A,T,u,c){ const t=c.tgt, P=T.P; if(!t||!t.alive) return; const L=[t].concat(nearFoes(A,u,t,2)), d=0.5*atkOf(A,T,u)*(1+(P.crater||0));
      for(const x of L) A.acts(T,u,[{dmg:d,on:'target',color:'#ff9a4a'}],{u,src:u,tgt:x}); T.fn.tstun(A,T,u,L.filter(x=>x.alive),0.5,'throw'); },
    sear(A,T,u,c){ T.fn.burn(A,T,u,c.tgt,0.25*(c.amt||0),'peSear',3); },
    fireFist(A,T,u,c){ T.fn.burn(A,T,u,c.tgt,0.03*rk(T,'fm_10_1')*(c.amt||0),'peFire',2); },
    /* ---- THE VALLEY REMEMBERS: a spend of 6+ Heat whose hit lands on a Held Fast enemy (the Clinch's own grab counts): a critical hit, two Tremors 0.5 s apart on
       every enemy within 4 m of it, the Heat full again; once every 20 s (a count-down) ---- */
    valCrit(A,T,u,c){ const o=S(T), cur=T.s.cur, t=c.tgt; if(!o.valArm||!t) return; if(!(cur===CL||(cur===MK&&A.markOf(u,t,'peHF')))) return;
      c.force=true; o.valArm=false; o.valCd=20; o.valT=t; },
    valHit(A,T,u,c){ const o=S(T); if(!o.valT||o.valT!==c.tgt) return; const t=c.tgt, d=c.amt||0; o.valT=null; A.stSet(T,u,'peHeat',A.stMax(T,u,'peHeat'));
      const L=[t].concat(nearFoes(A,u,t,4)).map(x=>[x,d]); later(T,0.5,'tremor',{hits:L,stun:false}); later(T,1.0,'tremor',{hits:L,stun:false}); },
    /* ---- his talent stuns, at their full written length on the fixed path (no resist roll): never on an enemy stunned now, nor within 0.5 s after a stun of his on it
       ended (mark 'peLk', written for every stun he lands, skill or talent); each enemy at most twice per cast of the talent that stuns ---- */
    tstun(A,T,u,L,secs,key){ const o=S(T), n=o.tsN[key]||(o.tsN[key]={}); for(const t of L){ if(!t||!t.alive||t.team===u.team) continue;
        if((t.stunned||0)>0||A.markOf(u,t,'peLk')||(n[t.uid]||0)>=2) continue; n[t.uid]=(n[t.uid]||0)+1; A.control(T,u,t,'stunned',secs); }
      if(key==='throw'||key==='shaker') o.tsN[key]={}; },     // one cast = one call (a Held Fast ending, a Worldshaker Tremor)
    /* ---- every stun he lands: the base skill's extensions (Crushing Weight, Hold Tighter, Open Hearth, Perpetual Check; at most 4.0 s), Check, Stand Fast,
       the stun-lock mark ---- */
    stunHit(A,T,u,c){ const o=S(T), P=T.P, t=c.tgt, cur=T.s.cur; if(!t||!t.alive||t.team===u.team||!(c.amt>0)) return;
      const chk=any(T,CHK), had=chk&&!!A.markOf(u,t,'peChk');
      if(!c.talent){ let x=0; if(cur===MK) x+=(P['mk.ext']||0)+((P.perp&&had)?0.5:0); if(cur===CL) x+=(P['cl.ext']||0)+(P.opens?P.opens*(o.sp||0):0);
        if(x>0&&(t.stunned||0)>0) t.stunned=Math.max(t.stunned,Math.min(STUN_TOP,A.stunRoom(t),t.stunned+x)); }   /* v1452: his talent extensions never take a run past 4.0 s; his base kit's own re-stuns are left as they are (not a talent) */
      if(chk&&!c.talent&&cur===MK) T.fn.check(A,T,u,t,4+(P['chk.dur']||0)+(o.mkFirst?(P['chk.first']||0):0));
      if(P.cw&&!c.talent&&cur==='wb2') T.fn.check(A,T,u,t,4+(P['chk.dur']||0));                                      // Castling Wall: the third slam's staggers go into Check
      if(P['dr.sf']) A.setMark(T,u,t,'peStn',{dur:(t.stunned||0)+3,longest:true});                                  // Stand Fast: until 3 s after the stun ends
      A.setMark(T,u,t,'peLk',{dur:(t.stunned||0)+0.5,longest:true}); },
    check(A,T,u,t,d){ if(!t||!t.alive||!(d>0)) return; A.acts(T,u,[{mark:'peChk',on:'target',dur:d,while:'alive',ends:'peChkEnd',longest:true}],{u,src:u,tgt:t}); },
    discCheck(A,T,u,c){ const x=c.unit; if(!x) return; const L=foes(A,u).filter(e=>e!==x).sort((a,b)=>A.gap(x,a)-A.gap(x,b)); if(L[0]) T.fn.check(A,T,u,L[0],1*rk(T,'rk_7_1')); },
    /* ---- UNMOVED: each refused pull, push, knock-up or charge (max 5, Stone Patience 8), this wave; No Retreat takes Meteor Knuckle's cooldown down; Castle Wall ---- */
    unm(A,T,u){ const n0=A.stGet(T,'peUnm'), got=A.stSet(T,u,'peUnm',n0+1); if(got>0&&T.P.nr) A.acts(T,u,[{cd:'green',add:-T.P.nr*got}],{u}); },
    castle(A,T,u){ if(!(u.pass&&u.pass.unmovable)||(u.wardenStk||0)>=5||(u._mmHits||0)<2) return; u._mmHits=0; u.wardenStk=(u.wardenStk||0)+1; },   // every 2 direct hits a molten layer instead of 3
    /* ---- THE GUARDED FILE: the ally (Two Files: the two allies) standing most directly behind him - farther from the middle of the living enemies than he is,
       within 8 m of his body, the least off the line from the enemies through him; a hero, not a summon ---- */
    pickFile(A,T,u){ const o=S(T), E=A.eng(), F=foes(A,u); if(!F.length){ o.file=[]; return; } let cx=0,cy=0; for(const x of F){ cx+=x.x; cy+=x.y; } cx/=F.length; cy/=F.length;
      const dx=u.x-cx, dy=u.y-cy, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, n=T.P.twoFiles?2:1, out=[];
      for(const a of E.units()){ if(!a.alive||a===u||a.team!==u.team||a._summon) continue; const rx=a.x-u.x, ry=a.y-u.y, along=rx*ux+ry*uy; if(!(along>0)) continue;
        if(A.gap(u,a)>=8*E.METER()) continue; out.push([a,Math.abs(rx*uy-ry*ux)]); }
      out.sort((p,q)=>p[1]-q[1]); o.file=out.slice(0,n).map(x=>x[0]); },
    /* ---- CANNOT BE MOVED: once every 25 s (a count-down), when an ally on his file drops below 30% HP: 4 s; every enemy targeting that ally is put in Check and taunted
       onto him, he gains 5 Unmoved and full molten armour, and that ally takes 50% less damage (in place of the allies' group) ---- */
    cbmTick(A,T,u,dt){ const o=S(T), P=T.P;
      for(const a of o.file){ const lo=a.alive&&a.hp<0.3*a.maxHp, was=!!o.cbBelow[a.uid]; o.cbBelow[a.uid]=lo;
        if(lo&&!was&&!o.cbm&&!(o.cbmCd>0)){ o.cbm={a,t:4}; o.cbmCd=25; A.stSet(T,u,'peUnm',A.stGet(T,'peUnm')+5); if(u.pass&&u.pass.unmovable) u.wardenStk=5; break; } }
      if(o.cbm){ const a=o.cbm.a; if(o.cbm.t<=1e-9||!a.alive){ o.cbm=null; return; }
        for(const x of foes(A,u)) if(x.target===a){ if(!A.markOf(u,x,'peChk')) T.fn.check(A,T,u,x,4+(P['chk.dur']||0)); x.forcedTarget=u; x.forcedTargetT=Math.max(x.forcedTargetT||0,o.cbm.t); }
        o.cbm.t-=dt; } },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP: each talent multiplies its share; together at most 40% off a hit or a damage-over-time tick ---- */
    drK(A,T,u,s,kind,crit,dot){ const P=T.P, o=S(T); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P['dr.sg']&&A.stGet(T,'peCraze')>=4) cut(P['dr.sg']);                                                     // Safety Glass
      if(P.hold&&A.winOn(T,'peHold')) cut(0.25);                                                                    // Hold It Back
      if(P['dr.wlb']&&A.winOn(T,'peFlow')) cut(P['dr.wlb']);                                                        // What Lies Beneath
      if(P['dr.wr']) cut(P['dr.wr']*A.stGet(T,'peUnm'));                                                            // Weight of the Rook
      if(P['dr.rw']&&o.file.length) cut(P['dr.rw']);                                                                // Rook's Watch
      if(P['dr.bl']&&!dot&&s&&!s.melee) cut(P['dr.bl']);                                                            // Blocked Lines (ranged attacks)
      if(P['dr.sf']&&s&&A.markOf(u,s,'peStn')) cut(P['dr.sf']);                                                     // Stand Fast
      if(P['dr.lr']&&u.hp<0.3*u.maxHp) cut(P['dr.lr']);                                                             // Last Rank
      if(P['dr.cw']){ let n=0; for(const x of foes(A,u)) if(A.markOf(u,x,'peChk')) n++; cut(P['dr.cw']*Math.min(4,n)); }   // Check Weight
      if(P['dr.gbs']&&s&&A.markOf(u,s,'peChk')) cut(P['dr.gbs']);                                                   // Glass Behind Stone
      if(P['dr.mp']) cut(P['dr.mp']*Math.min(5,u.wardenStk||0));                                                    // Molten Plates
      if(P.shim&&s&&gapM(A,u,s)<2) cut(P.shim*A.stGet(T,'peCraze'));                                               // Heat Shimmer
      if(P['dr.sto']&&crit) cut(P['dr.sto']);                                                                       // Stoneglass
      if(P['dr.ft']&&dot) cut(P['dr.ft']);                                                                          // Fired Twice
      return Math.max(DR_FLOOR,k); },
    myDr(A,T,u,c){ const s=c.src; if(!s||s.team===u.team) return; c.amt*=T.fn.drK(A,T,u,s,c.kind,!!c.crit,!!c.dot); },
    /* ---- HIS ALLIES: The File Behind (5%), Check (6%) and Heat Shimmer (6%) multiply - 15.1% at most, so no cap is needed (Cannot Be Moved: exactly 50% for its ally, in place);
       the File's attackers are marked (The File Behind) and slowed (File Guard) ---- */
    allyK(A,T,u,s,t){ const P=T.P, o=S(T); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); }; const onF=o.file.indexOf(t)>=0;
      if(P.file&&onF) cut(P.file); if(P.chk&&s&&A.markOf(u,s,'peChk')) cut(P.chk); if(P.shim&&s&&gapM(A,u,s)<2) cut(P.shim*A.stGet(T,'peCraze'));
      if(o.cbm&&o.cbm.a===t) k=0.5; return k; },
    tIn(A,T,u,c){ const s=c.src, t=c.tgt, P=T.P, o=S(T); if(!s||!t||s.team===u.team||t.team!==u.team||t===u) return;
      c.amt*=T.fn.allyK(A,T,u,s,t);
      if(o.file.indexOf(t)>=0){ if(rk(T,'rk_2_3')) A.setMark(T,u,s,'peFoe',{dur:3}); if(P.fguard) A.acts(T,u,[{slow:P.fguard,dur:1,on:'source'}],c); } },
    /* ---- HIS CONTROL SHORTENING, ONE GROUP: Unmovable (all controls) and Jaw of Glass (silences) multiply, at most 30% shorter ---- */
    ten(A,T,u,c){ const P=T.P; let k=1; if(P.ten) k*=1-P.ten; if(P['ten.sil']&&c.field==='silencedT') k*=1-P['ten.sil']; const x=Math.min(TEN_CAP,1-k); if(x>0) c.amt*=1-x; }
  },
  ruling:{},
  partial:{}
};
/* Settling Ground: each Tremor takes 0.1 s a rank off Meteor Knuckle's cooldown */
function o_settle(A,T,u){ const x=T.P.settle||0; if(x>0) A.acts(T,u,[{cd:'green',add:-x}],{u}); }
