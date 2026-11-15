/* RIVET - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Rivet")
   His real kit (the code, not the tooltip wording; a ranged Bruiser (13.6 m reach, attack, physical); tests/rivet-kit-facts.js):
   - Whatever's Loaded (passive 'arsenal'): every basic attack fires the NEXT weapon of the group the target's distance picks (rivetPick: 3 m of ground or less
     between the bodies = melee). Ranged five in order: roof gatling (9 rounds of 15%), revolver (120%, +15% crit chance on that hit), flying saw (70% and a bleed
     of 50% over 4 s), bolt launcher (100%, ignores 50% of armor), chest cannon (75% to every enemy in a 45 degree, 20 m cone). Melee four: curved blade (160%),
     hammer (100%, stun 2.0 s), upper spike arm (80%, silence 3.0 s), lower spike arm (130%, armor cut 20% for 5 s). Each group keeps its own counter. The CHAIN
     HOOK is in neither cycle: it fires by itself when an enemy inside his 3 m dashes or jumps away (rivetHookTick): 50%, pulled back to 0.5 m of ground, stun 3.0 s.
     Weapon controls are held at their exact length (rivetCC). MEASURED in 20 seeded fights: 44% of his attacks melee, his target within 3 m 34% of the time,
     five ranged weapons in a row 1.5 times a fight, 29 hooks; no control of his was resisted at equal levels.
   - Scattergun ('spread', green, cd 7): a 60 degree cone of 3.2 m from HIM (centre to centre), 160%. MEASURED: it struck somebody on 4 of 130 casts (he stands
     9.4 m from his target). Release v1391 on another branch centres it on his target (same radius): his Scattergun talents are rows on its hits and its cast, so
     they work once it reaches someone; nothing here changes how it measures.
   - Smoke Bomb ('slow', blue, cd 9, delivered as a shot): 80% and a slow of 1.4 s on its target (the card's 2 s x 0.7), 70% slower at skill level 100.
   - Full Arsenal (ultimate 'multiShot'): 180% to each of the 5 nearest enemies (one shot each), then on its primary target a 0.61 s stun, a slow, a bleed, a
     1.6 m splash and 40% more.
   Page sites (all guarded, TALENT HOOK): 'rvPick' (the weapon of a swing), 'rvFire' (a record per attack; partPre / part 'rv:<record>' around each blow, so his
   rows know the attack and its weapon), 'rvHook' (the automatic hook's record), 'rvCC' (the length a weapon control is held at), 'rvCone', 'rvHookR', and the
   bound rvFire (one ranged weapon fired by a talent). The Rack, Sighted, Torque, Pinned, Cracks / Cracked and Spare Parts exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/51 - RIVET - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const RNG=['gatling','revolver','saw','bolt','cannon'], MEL=['blade','hammer','uspike','lspike'], ARM=MEL.concat(['hook']);
const CYC_HOOK=['blade','hammer','uspike','lspike','hook'], CYC_HAM=['blade','hammer','uspike','lspike','hammer'];
const SG='spread', SB='slow', FA='multiShot';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const RACK=['lw_1_1','lw_2_1','lw_3_1','lw_4_1','lw_5_3','lw_10_1','lw_11_1','lw_11_2','lw_12_2','lw_13_2','nc_n2'];                     // the Rack
const SIGHT=['lw_1_4','lw_2_4','lw_4_4','lw_5_4','lw_n1','lw_9_2','lw_9_4','lw_10_4','lw_11_1','lw_12_1','lw_12_4','lw_13_2'];           // Sighted
const TORQ=['cw_1_1','cw_2_1','cw_3_1','cw_4_1','cw_6_1','cw_8_1','cw_11_1','cw_12_1','cw_13_2'];                                       // Torque
const PIN=['cw_1_4','cw_5_4','cw_7_4','cw_9_4','cw_10_4','cw_12_4','cw_13_2'];                                                           // Pinned (and "brought back")
const CRACK=['nc_1_1','nc_2_1','nc_3_1','nc_1_4','nc_4_1','nc_n2','nc_5_2','nc_5_3','nc_5_4','nc_6_1','nc_7_4','nc_8_1','nc_9_2','nc_10_1','nc_10_2','nc_11_2','nc_12_1','nc_12_2','nc_13_2'];   // Cracks
const PARTS=['nc_1_4','nc_2_4','nc_3_4','nc_5_4','nc_6_4','nc_7_4','nc_9_4','nc_10_4','nc_11_1','nc_12_4','nc_13_2'];                   // Spare Parts
const MP=['cw_11_2','cw_12_2'];                                                                                                          // Machine Patience
const PICK=RACK.concat(MP,['lw_5_2','lw_12_3','cw_5_2','cw_5_3','cw_13_2']);                                                            // rows on each weapon pick
const WOUT=['lw_1_1','lw_12_2','lw_5_2','lw_6_2','lw_2_2','lw_8_4','lw_7_1','lw_7_3','lw_12_3','cw_1_4','cw_3_2','cw_4_4','cw_6_2','cw_7_1','cw_7_3','cw_8_1','nc_8_1','nc_n2'];   // his weapons' blows changed
const FAQ=['lw_7_2','lw_9_2','nc_7_4'];                                                                                                  // Full Arsenal's five shots
const CRIT=['lw_3_2','lw_4_4','cw_5_1','cw_12_2','nc_8_3','lw_9_4','lw_7_2'];                                                            // his crit chance (one capped group; Five of Five; Long Arsenal's revolver)
const DRG=['lw_11_3','lw_n1','cw_11_4','cw_4_1','cw_4_3','cw_10_4','nc_11_3','nc_n1','nc_3_4','nc_9_3','nc_6_2'];                       // his damage reduction: ONE capped group (35%)
const ALLY=['cw_10_4','nc_6_2'];                                                                                                         // what his talents take off a hit on an ally: one group (20%)
const HEAL=['cw_6_1','nc_10_4'];                                                                                                         // his healing a second: one budget (1.2% of max HP a second)
const DR_FLOOR=0.65, ALLY_FLOOR=0.80, CRIT_CAP=0.05, REGEN=0.012, BANK=5, STUN_RUN=4.0, LOCK=0.5;
const S=T=>T.s.rv||(T.s.rv={rack:0,full:false,frU:false,sn:0,rec:{},rk:[],pk:null,mi:0,mr:0,agN:0,agi:0,agT:0,tqA:0,tqU:0,hb:0,smT:5,wsW:-1,sigW:0,sigA:0,sigT:0,coT:0,st:{},lw:{},pmv:{},carry:0,ccF:null,fa:null,vol:null,tsrc:null,f:null});   // his own per-fight state (one object; every timer a countdown)
const rk=(T,id)=>T.r[id]||0;
const any=(T,L)=>L.some(id=>T.r[id]);
const atk=(A,T,u,c)=>A.amtOf(T,u,{pct:1,of:'atk'},c);
const foes=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
const M_=A=>A.eng().METER();
const recOf=T=>{ const c=T.s.cur; if(typeof c!=='string'||c.slice(0,3)!=='rv:') return null; return S(T).rec[+c.slice(3)]||null; };
const si=(A,T,u,x)=>A.ustGet(T,u,x,'rvSi');
const tq=(A,T)=>A.stGet(T,'rvTq');
const tqFull=(A,T,u)=>{ const n=tq(A,T); return n>0&&n>=A.stMax(T,u,'rvTq')-1e-9; };
const canMove=e=>!!e&&!e.immovable&&!(e.pass&&(e.pass.unstepped||e.pass.unstoppable))&&!((e._gearImmovableT||0)>0);   // the hook's own test (rivetHook)
const strec=(o,t)=>o.st[t.uid]||(o.st[t.uid]={mine:0,after:0,run:0,free:0,n:0});
const isBoss=x=>!!(x&&((x.t&&x.t.isboss)||x._raidBoss));
module.exports={
  hero:'rivet',
  casting:true,                         // rows ask which of his skills (or which weapon record) a hit comes from
  states:{
    rvTq:{max:P('tq.max',10),wave:'reset'},                         // Torque (Pre-Tensioned fills it at the wave's start)
    rvPt:{max:P('pt.max',8)},                                       // Spare Parts (emptied at a wave's start unless Hold the Walnut)
    rvSa:{max:5,wave:'reset'},                                      // Spare Ammunition (Full Racks this wave)
    rvEy:{max:10},                                                  // Eighty Years (Full Racks this fight)
    rvMp:{max:10,wave:'reset'},                                     // Machine Patience (full melee cycles this wave)
    rvNc:{max:10},                                                  // Nothing Cancelled (enemies Cracked this fight)
    rvSi:{unit:true,max:5,dur:P('si.dur',5)},                       // Sighted on an enemy: all of it goes 5 s after his last hit on it (Steady Eye longer)
    rvCr:{unit:true,max:3}                                          // Cracks on an enemy (at 3: Cracked, and they clear)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                    // Torque, the heal budget, Spare Parts fitted, the stun records, Pinned, the signatures' clocks
    {on:'wave',do:[{fn:'wv'}]}, {on:'waveEnd',reqAny:['lw_11_1'],do:[{fn:'wEnd'}]},                               // a wave's start (Rack, Parts, Torque); Never Cancelled's Sighted
    {on:'num',skill:'rvPick',reqAny:PICK,do:[{fn:'pick'}]},                                                       // the weapon of this swing; the Rack and the melee cycle counted
    {on:'num',skill:'rvFire',do:[{fn:'fire'}]},                                                                   // this attack's record
    {on:'num',skill:'rvHook',do:[{fn:'hookRec'}]},                                                                // the automatic hook's record
    {on:'num',skill:'rvCC',do:[{fn:'rvCC'}]},                                                                     // the length a weapon control is held at
    {on:'num',skill:'rvCone',reqAny:['lw_3_1'],do:[{fn:'cone'}]},                                                 // Next Barrel Up's wider cone
    {on:'num',skill:'rvHookR',reqAny:['cw_2_4'],do:[{fn:'hookR'}]},                                               // Long Chain
    {on:'part',do:[{fn:'part'}]},                                                                                  // after a weapon's blow: the saw's bleed, the lower spike's cut, the hook's Pin
    {on:'out',reqAny:WOUT,if:{targetTeam:'enemy'},do:[{fn:'wOut'}]},                                              // his weapons' blows changed
    {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'wHit'}]},                                                           // Sighted, Dragged Back, Fits the Rack
    {on:'kit',skill:FA,reqAny:FAQ,do:[{fn:'faKit'}]},                                                              // Full Arsenal: its five shots
    {on:'out',reqAny:FAQ,if:{casting:FA,targetTeam:'enemy'},do:[{fn:'faOut'}]},
    {on:'hit',reqAny:FAQ,if:{casting:FA,targetTeam:'enemy'},do:[{fn:'faHit'}]},
    {on:'crit',reqAny:CRIT,if:{targetTeam:'enemy'},do:[{fn:'crit'}]},                                             // his crit chance: one capped group; Five of Five
    {on:'ccOut',do:[{fn:'ccO'}]}, {on:'ccHit',do:[{fn:'ccH'}]},                                                    // every control of his: its length (extensions, Hammer Hand, the stun-lock rule), Cracks
    {on:'cast',skill:SB,reqAny:['lw_12_1','nc_5_2','nc_5_3'],do:[{fn:'sbCast'}]},                                  // Smoke Bomb: Smoke and Sight, Spreading Smoke, Oil in the Eyes
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]}, {on:'dotIn',reqAny:DRG,do:[{fn:'myDr'}]},                              // his damage reduction: one capped group
    {on:'teamIn',reqAny:ALLY,if:{targetTeam:'ally',srcTeam:'enemy'},do:[{fn:'allyDr'}]},                           // his allies': one capped group
    {on:'death',reqAny:['nc_5_4'],do:[{fn:'death'}]},                                                              // Salvage
    {on:'lethal',reqAny:['nc_12_4'],once:'fight',if:{fn:'hasParts'},do:[{fn:'lastSpare'}]}                         // Last Spare
  ],
  talents:{
    /* ============================== THE LONG WORKSHOP ============================== */
    lw_1_1:[ {param:'rack.k',add:R(0.04)} ],                                                                       // Load the Rack (the Full Rack's next attack: pick / wOut)
    lw_11_3:[ {param:'dr.far',add:R(0.015)} ],                                                                     // Reinforced Plating (in myDr)
    lw_1_4:[ {on:'out',if:{targetTeam:'enemy',targetUst:{rvSi:1}},more:R(0.01),per:{ust:'rvSi'}} ],                 // Glass Eye (Sighted: wHit): every hit of his, 1% x 3 a step
    lw_2_1:[ {stat:{aspd:R(0.02)},if:{fn:'filling'}} ],                                                           // Quick Change
    lw_2_4:[ {param:'si.dur',add:R(1)} ],                                                                          // Steady Eye
    lw_3_1:[ {param:'nbu',add:1} ],                                                                                // Next Barrel Up (pick, cone)
    lw_3_2:[ {param:'crit.rv',add:R(0.01)} ],                                                                      // Revolver Rounds (in the crit group)
    lw_2_2:[ {param:'gat.pt',add:R(0.01)} ],                                                                       // Oiled Gatling (points of his attack a round: wOut)
    lw_4_1:[ {stat:{aspd:R(0.005)},per:'rvSa'} ],                                                                  // Spare Ammunition
    lw_5_2:[ {param:'kto',add:1} ],                                                                                // Keep Them Out (PICK ONE: pick, wOut)
    lw_5_3:[ {param:'anyd',add:1} ],                                                                               // Any Distance (PICK ONE: pick)
    lw_4_4:[ {param:'crit.ro',add:R(0.015)} ],                                                                     // Read the Order (in the crit group)
    lw_4_3:[ {on:'out',if:{targetTeam:'enemy',fn:'far6'},more:R(0.02)} ],                                          // Range Finder
    lw_6_2:[ {param:'pb.k',add:R(0.03)} ],                                                                         // Muzzle Close (was Point Blank Shot: wOut)
    lw_5_4:[ {stat:{move:R(-0.02)},to:{team:'enemy',ust:{rvSi:1}}} ],                                              // Watchful
    lw_6_1:[ {param:'saw.k',add:R(0.08)} ],                                                                        // Saw Teeth (part; Long Arsenal's saw)
    lw_n1:[  {param:'dr.seen',add:R(0.02)} ],                                                                      // Seen Coming (in myDr)
    lw_6_4:[ {on:'out',if:{targetTeam:'enemy',fn:'isBolt'},ignoreArmor:R(0.05)} ],                                 // Bolt Pressure (50% -> 52.5% / 55% of armor ignored)
    lw_7_1:[ {param:'basic.k',add:R(0.02)} ],                                                                      // Ninepin Count (wOut)
    lw_7_2:[ {param:'la',add:1} ],                                                                                 // Long Arsenal (faKit / faOut / faHit / crit)
    lw_7_3:[ {param:'hyb.k',add:R(0.03)} ],                                                                        // Hybrid Belt (wOut)
    lw_8_4:[ {param:'can.k',add:R(0.03)} ],                                                                        // Shells in the Chest (wOut; Long Arsenal's cannon)
    lw_9_2:[ {param:'ebc.k',add:R(0.02)} ],                                                                        // Every Barrel Counts (faOut / faHit)
    lw_9_4:[ {param:'ff',add:1} ],                                                                                 // Five of Five (wHit / crit)
    lw_10_1:[ {param:'rerack',add:R(0.3)} ],                                                                       // Re-Rack (fullRack)
    lw_10_2:[ {on:'out',if:{casting:SG,targetTeam:'enemy'},more:R(0.04)} ],                                        // Scrap Load
    lw_10_4:[ {on:'teamIn',if:{srcIs:'ally',targetTeam:'enemy'},more:R(0.005),per:{ust:'rvSi'}} ],                 // Marked Glass
    lw_11_1:[ {param:'nc',add:1} ],                                                                                // Never Cancelled (wv / wEnd)
    lw_11_2:[ {stat:{atk:R(0.004)},per:'rvEy'} ],                                                                  // Eighty Years
    lw_12_1:[ {param:'sas',add:R(1)} ],                                                                            // Smoke and Sight (sbCast)
    lw_12_2:[ {param:'rm.k',add:R(0.02)} ],                                                                        // Rack Master (pick)
    lw_12_3:[ {param:'ws.k',add:R(0.10)} ],                                                                        // Walnut Steady (pick / wOut)
    lw_12_4:[ {on:'out',if:{casting:[SB,SG],targetTeam:'enemy',targetUst:{rvSi:1}},more:R(0.02)} ],                // Second Look
    lw_13_2:[ {param:'sig.ww',add:1} ],                                                                            // The Whole Workshop (SIGNATURE: fullRack)

    /* ============================== CLOSE WORK ============================== */
    cw_1_1:[ {stat:{aspd:R(0.004)},per:'rvTq'} ],                                                                  // Wound Spring (Torque: tk)
    cw_11_4:[ {param:'dr.ab1',add:R(0.015)} ],                                                                     // Bolted Seams (in myDr)
    cw_1_4:[ {param:'pin.k',add:R(0.02)} ],                                                                        // Clamp Hand (Pinned: part; in wOut)
    cw_2_1:[ {param:'tq.max',add:R(2)} ],                                                                          // Tight Spring
    cw_2_4:[ {param:'chain',add:R(1)} ],                                                                           // Long Chain (hookR)
    cw_3_1:[ {param:'ow',add:0.5} ],                                                                               // Overwound (ccO)
    cw_3_2:[ {param:'blade.k',add:R(0.04)} ],                                                                      // Curved Edge (wOut)
    cw_3_3:[ {on:'ccIn',less:R(0.04)} ],                                                                           // Grounded Frame (up to 20%)
    cw_4_1:[ {param:'dr.tq',add:R(0.002)} ],                                                                       // Spring Steel (in myDr)
    cw_4_3:[ {param:'dr.near',add:R(0.02)} ],                                                                      // Iron Apron (in myDr)
    cw_4_4:[ {param:'hook.k',add:R(0.20)} ],                                                                       // Short Leash (wOut)
    cw_5_1:[ {param:'crit.wb',add:R(0.01)} ],                                                                      // Workbench Habit (in the crit group)
    cw_12_3:[ {param:'pj',add:R(0.01)} ],                                                                          // Patched Joints (ccH)
    cw_5_4:[ {param:'pin.dur',add:R(0.5)} ],                                                                       // Pin Down
    cw_6_1:[ {param:'spin',add:R(0.002)} ],                                                                        // Spin Down (tk, under the heal budget)
    cw_9_2:[ {on:'out',if:{casting:SB,targetTeam:'enemy',targetWithin:3},more:R(0.04)} ],                          // Smoke in Their Face
    cw_6_4:[ {param:'ls.k',add:R(0.05)} ],                                                                         // Lower Spike Bite (part)
    cw_7_1:[ {param:'mel.k',add:R(0.02)} ],                                                                        // Gear Grind (wOut)
    cw_7_4:[ {param:'gate',add:1} ],                                                                               // Gate Kept (pin)
    cw_8_1:[ {param:'tr.k',add:R(0.02)} ],                                                                         // Torque Release (wOut)
    cw_5_2:[ {param:'hic',add:1} ],                                                                                // Hook in the Cycle (PICK ONE: pick)
    cw_5_3:[ {param:'hh',add:1} ],                                                                                 // Hammer Hand (PICK ONE: pick, ccO)
    cw_9_4:[ {param:'nl',add:R(0.01)} ],                                                                           // Nobody Leaves (part)
    cw_6_2:[ {param:'reel.k',add:R(0.04)} ],                                                                       // Reel In (wOut)
    cw_7_3:[ {param:'ring.k',add:R(0.03)} ],                                                                       // Ringing Blow (wOut)
    cw_10_1:[ {on:'out',if:{casting:SG,targetTeam:'enemy',targetWithin:3},more:R(0.03)} ],                         // Close Enough
    cw_10_3:[ {param:'spike',add:R(0.3)} ],                                                                        // Spike Rhythm (ccO)
    cw_10_4:[ {param:'held',add:R(0.02)} ],                                                                        // Held Fast (myDr, allyDr)
    cw_11_1:[ {on:'wave',do:[{stack:'rvTq',set:'max'}]} ],                                                         // Pre-Tensioned
    cw_11_2:[ {stat:{atk:R(0.005)},per:'rvMp'} ],                                                                  // Machine Patience (the cycles: pick)
    cw_12_1:[ {param:'tq.fast',add:R(0.15)} ],                                                                     // Torque Wrench (tk)
    cw_12_2:[ {param:'crit.cf',add:R(0.01)} ],                                                                     // Clockwork Fury (in the crit group)
    cw_12_4:[ {param:'drag',add:R(0.3)} ],                                                                         // Dragged Back (wHit)
    cw_13_2:[ {param:'sig.ag',add:1},{stat:{aspd:1},if:{fn:'agOn'}} ],                                             // Arms for the Gap (SIGNATURE: tk, pick)

    /* ============================== THE NUTCRACKER ============================== */
    nc_1_1:[ {stat:{armor:R(-0.06)},to:{team:'enemy',has:'rvCk'}} ],                                               // Crack the Shell (Cracks: ccH; Cracked: crack)
    nc_11_3:[ {param:'dr.brace',add:R(0.02)} ],                                                                    // Brace Plates (in myDr)
    nc_1_4:[ {param:'pt.fit',add:R(0.01)} ],                                                                       // Parts Bin (was Spare Parts: crack, tk)
    nc_2_1:[ {param:'ck.dur',add:R(0.5)} ],                                                                        // Fine Fracture
    nc_2_2:[ {param:'smoke.k',add:R(0.03)} ],                                                                      // Thick Smoke (ccH)
    nc_2_4:[ {param:'pt.max',add:R(2)} ],                                                                          // Spare Bolts
    nc_3_1:[ {param:'wg',add:1} ],                                                                                 // Walnut Grip (ccH)
    nc_n1:[  {param:'dr.sz',add:R(0.02)} ],                                                                        // Seized Gears (in myDr; the mark: ccH)
    nc_3_4:[ {param:'dr.qf',add:R(0.005)} ],                                                                       // Quick Fit (fit; in myDr)
    nc_4_1:[ {on:'out',if:{targetTeam:'enemy',targetHas:'rvCk'},more:R(0.02)} ],                                   // Shell Splinters
    nc_4_2:[ {param:'smoke.dur',add:R(0.3)} ],                                                                     // Lingering Smoke (ccO)
    nc_n2:[  {param:'fr',add:1} ],                                                                                 // Fits the Rack (LINK: crack, wOut)
    nc_12_3:[ {on:'cd',skill:'blue',add:R(-0.5)} ],                                                                // Hinge Oil
    nc_9_3:[ {param:'dr.ab2',add:R(0.015)} ],                                                                      // Rust-Proof (in myDr)
    nc_5_2:[ {param:'spread',add:1} ],                                                                             // Spreading Smoke (was Smoke and Mirrors; PICK ONE: sbCast)
    nc_5_3:[ {param:'oil',add:1} ],                                                                                // Oil in the Eyes (PICK ONE: sbCast)
    nc_5_4:[ {param:'salv',add:R(1)} ],                                                                            // Salvage (death)
    nc_6_1:[ {on:'teamIn',if:{srcIs:'ally',targetHas:'rvCk'},more:R(0.02)} ],                                      // Fracture Lines
    nc_6_2:[ {param:'screen',add:R(0.02)} ],                                                                       // Smoke Screen (myDr, allyDr)
    nc_6_4:[ {param:'pt.kit',add:R(0.005)} ],                                                                      // Patch Kit (fit)
    nc_7_1:[ {param:'hq',add:R(0.03)} ],                                                                           // Hard Questions (ccO)
    nc_7_3:[ {on:'out',if:{casting:SB,targetTeam:'enemy'},more:R(0.04)} ],                                         // Black Oil
    nc_7_4:[ {param:'wr',add:1} ],                                                                                 // Workshop Repair (faHit)
    nc_8_1:[ {param:'jaw.k',add:R(0.03)} ],                                                                        // Nutcracker's Jaw (wOut)
    nc_8_3:[ {param:'crit.wg',add:R(0.01)} ],                                                                      // Watchful Glass (in the crit group)
    nc_9_2:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',ust:{rvCr:1}},per:{ust:'rvCr'}} ],                             // Stress Point (was Breakpoint)
    nc_9_4:[ {stat:{aspd:R(0.02)},if:{stackMin:{rvPt:8}}} ],                                                       // Spare Arm
    nc_10_1:[ {stat:{move:R(-0.03)},to:{team:'enemy',has:'rvCk'}} ],                                               // Split Grain (was Shatter Point)
    nc_10_2:[ {param:'co',add:1} ],                                                                                // Cracked Open (crack)
    nc_10_4:[ {param:'self',add:R(0.001)} ],                                                                       // Self-Made (tk, under the heal budget)
    nc_11_1:[ {param:'walnut',add:1} ],                                                                            // Hold the Walnut (wv)
    nc_11_2:[ {stat:{atk:R(0.004)},per:'rvNc'} ],                                                                  // Nothing Cancelled (crack)
    nc_12_1:[ {on:'teamHeal',if:{unitHas:'rvCk'},less:R(0.05)} ],                                                  // Deep Fracture
    nc_12_2:[ {on:'out',if:{targetTeam:'enemy',targetHas:'rvCk'},critMore:R(0.02)} ],                              // One Function
    nc_12_4:[ {param:'ls.hold',add:R(0.5)} ],                                                                      // Last Spare (lastSpare)
    nc_13_2:[ {param:'sig.tw',add:1} ]                                                                             // The Third Winter (SIGNATURE: crack)
  },
  needs:{ lw_6_2:'lw_5_2', lw_7_3:'lw_5_3', lw_9_2:'lw_7_2', cw_6_2:'cw_5_2', cw_7_3:'cw_5_3', nc_6_2:'nc_5_2', nc_7_3:'nc_5_3' },
  fn:{
    /* ---- each tick ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), P=T.P, dt=c.dt||0, M=M_(A);
      if(!o.f) o.f={tq:any(T,TORQ),pin:any(T,PIN),heal:any(T,HEAL),fit:!!T.r.nc_1_4,self:!!T.r.nc_10_4};
      const f=o.f;
      if(f.heal) o.hb=Math.min(BANK*REGEN*u.maxHp,(o.hb||0)+REGEN*u.maxHp*dt);
      if(f.tq){ const t=u.target; if(t&&t.alive&&t.team!==u.team){ const g=A.gap(u,t);
          if(g<=3*M){ o.tqU=0; o.tqA+=dt*(1+(P['tq.fast']||0)); while(o.tqA>=1){ o.tqA-=1; A.stSet(T,u,'rvTq',tq(A,T)+1); } }
          else { o.tqA=0; if(tq(A,T)>0){ o.tqU+=2*dt; while(o.tqU>=1&&tq(A,T)>0){ o.tqU-=1; A.stSet(T,u,'rvTq',tq(A,T)-1); if(P.spin) T.fn.healB(A,T,u,c,P.spin*u.maxHp); } } else o.tqU=0; } } }
      if(f.self){ o.smT-=dt; if(o.smT<=1e-9){ o.smT+=5; const n=A.stGet(T,'rvPt'); if(n>0) T.fn.healB(A,T,u,c,P.self*n*u.maxHp); } }
      if(f.fit&&u.hp<0.5*u.maxHp&&A.stGet(T,'rvPt')>0) T.fn.fit(A,T,u,c);
      for(const k in o.st){ const r=o.st[k]; if(r.after>0) r.after-=dt; if(r.free>0) r.free-=dt; const t=r.t;
        if(!t||!t.alive){ delete o.st[k]; continue; }
        if(r.mine>0){ if((t.stunned||0)>0){ r.mine-=dt; r.run+=dt; if(r.run>=STUN_RUN-1e-6) r.cap=1; if(r.mine<=1e-9){ r.mine=0; r.after=LOCK; } }
          else { r.mine=0; r.after=LOCK; } }
        if(!((t.stunned||0)>0)){ if(r.cap){ r.free=LOCK; r.cap=0; } r.run=0; } }
      if(f.pin){ const pm=o.pmv; o.pmv={};
        for(const x of foes(A,u)){ if(!A.markOf(u,x,'rvPin')||pm[x.uid]) continue; if((x._airT||0)>0||(x.pullT||0)>0) continue;   // knocked or pulled by someone: not his own dash
          if(x._dash){ const D=x._dash; D.x0=D.x1=x.px; D.y0=D.y1=x.py; x.x=x.px; x.y=x.py; x._ax=x.x; x._ay=x.y; continue; }      // a dash: it goes nowhere (it lands where it stood)
          if(x.px!=null&&Math.hypot(x.x-x.px,x.y-x.py)>1.5*M){ x.x=x.px; x.y=x.py; x._ax=x.x; x._ay=x.y; } } }                        // a jump / teleport: put back
      if(T.r.cw_13_2){ if(o.sigA>0) o.sigA-=dt; if(o.agN>0){ o.agT-=dt; if(o.agT<=0) o.agN=0; }
        if(!(o.sigA>0)&&tqFull(A,T,u)&&foes(A,u).some(x=>A.markOf(u,x,'rvPin'))) T.fn.arms(A,T,u,c); }
      if(o.sigW>0) o.sigW-=dt; if(o.sigT>0) o.sigT-=dt; if(o.coT>0) o.coT-=dt; },
    /* heals that are paid out of the 1.2% a second budget (at most 5 s of it kept: Self-Made heals once every 5 s) */
    healB(A,T,u,c,x){ const o=S(T), h=Math.min(o.hb||0,x); if(h>0){ o.hb-=h; A.acts(T,u,[{heal:{flat:h},on:'self'}],c); } },
    /* a wave's start: the Rack starts again (Never Cancelled keeps it), Spare Parts emptied (Hold the Walnut keeps them), his records of the last wave's enemies dropped */
    wv(A,T,u,c){ const o=S(T), P=T.P; if(!P.nc){ o.rack=0; o.full=false; o.frU=false; } if(!P.walnut) A.stSet(T,u,'rvPt',0);
      o.st={}; o.lw={}; o.siHi=0; o.mr=0; o.mi=0; o.agN=0; o.fa=null; o.pmv={}; },
    wEnd(A,T,u){ const o=S(T); if((o.siHi||0)>o.carry) o.carry=o.siHi; },   // Never Cancelled: the most Sighted steps he reached this wave go onto the first enemy he hits in the next
    filling(A,T){ const n=S(T).rack; return n>0&&n<5; },
    far6(A,T,u,c){ return !!c.tgt&&A.gap(u,c.tgt)>6*M_(A); },
    isBolt(A,T){ const r=recOf(T); return !!r&&r.w==='bolt'; },
    agOn(A,T){ return S(T).agN>0; },
    hasParts(A,T){ return A.stGet(T,'rvPt')>0; },
    /* ---- THE WEAPON OF A SWING (the page has picked it and moved its own counter): Keep Them Out, Arms for the Gap, Hook in the Cycle / Hammer Hand,
       Next Barrel Up; then the Rack (5 ranged in a row: a Full Rack; Any Distance: melee counts) and the melee cycle (Machine Patience) ---- */
    pick(A,T,u,c){ const o=S(T), P=T.P, t=c.unit, w0=c.amt; if(!t||typeof w0!=='string') return; let w=w0; const pk={w:w0,basic:true};
      if(MEL.indexOf(w0)>=0){
        if(P.kto){ u._rvMi=((u._rvMi|0)+3)%4; w=RNG[(u._rvRi|0)%5]; u._rvRi=((u._rvRi|0)+1)%5; pk.pb=true; }                            // never his melee group: the next ranged weapon, point-blank
        else if(o.agN>0){ w=MEL[o.agi%4]; o.agi++; o.agN--; pk.ag=true; }                                                                // Arms for the Gap: the whole cycle, in order
        else if(P.hic||P.hh){ const L=P.hic?CYC_HOOK:CYC_HAM, i=o.mi%5; w=L[i]; o.mi++; if(P.hic&&w==='hook') pk.cyc=true; if(P.hh&&i===4) pk.h2=true; } }
      if(RNG.indexOf(w)>=0&&P.nbu&&o.full){ if(w!=='cannon'){ u._rvRi=((u._rvRi|0)+4)%5; w='cannon'; } pk.nbu=true; }                     // Next Barrel Up: the chest cannon, whatever the order
      const ranged=RNG.indexOf(w)>=0;
      if(o.full&&(ranged||P.anyd)){ o.full=false; pk.boost=(1+(P['rack.k']||0))*(1+(P['rm.k']||0))-1; }                                   // the attack after a Full Rack
      if(ranged&&P['ws.k']&&o.wsW!==T.s.wave){ o.wsW=T.s.wave; pk.ws=true; }                                                              // Walnut Steady: his first ranged attack this wave
      if(ranged||P.anyd){ o.rack++; if(o.rack>=5) T.fn.fullRack(A,T,u,c); } else { o.rack=0; o.frU=false; }
      if(ranged) o.mr=0; else { o.mr++; if(MP.some(id=>T.r[id])&&o.mr%((P.hic||P.hh)?5:4)===0) A.stSet(T,u,'rvMp',A.stGet(T,'rvMp')+1); }
      pk.w=w; o.pk=pk; c.amt=w; },
    /* a Full Rack: the rack starts again; Spare Ammunition, Eighty Years, Re-Rack; The Whole Workshop (once every 20 s: the five ranged weapons fire together at the
       most Sighted enemy, carrying the Full Rack's bonus, and every enemy they hit is Sighted to 5) */
    fullRack(A,T,u,c){ const o=S(T), P=T.P; o.rack=0; o.frU=false; o.full=true;
      if(T.r.lw_4_1) A.stSet(T,u,'rvSa',A.stGet(T,'rvSa')+1);
      if(T.r.lw_11_2) A.stSet(T,u,'rvEy',A.stGet(T,'rvEy')+1);
      if(P.rerack) u.greenCd=Math.max(0,(u.greenCd||0)-P.rerack);
      if(P['sig.ww']&&!(o.sigW>0)){ const E=A.eng(); if(!E.rvFire) return; let b=null,bn=-1; const L=foes(A,u).filter(x=>!x._noTarget), tg=u.target;
        if(tg&&tg.alive&&L.indexOf(tg)>=0){ b=tg; bn=si(A,T,u,tg); }
        for(const x of L){ const n=si(A,T,u,x); if(n>bn){ bn=n; b=x; } } if(!b) return;
        o.sigW=20; o.full=false; o.vol={boost:(1+(P['rack.k']||0))*(1+(P['rm.k']||0))-1};
        try{ for(const w of RNG) E.rvFire(u,b,w); } finally{ o.vol=null; } } },
    /* this attack's record (rivetFire, right after the pick; or a weapon a talent fires) */
    fire(A,T,u,c){ const o=S(T); o.sn++; let r;
      if(o.vol) r={w:u._rvWpn,vol:true,boost:o.vol.boost}; else if(o.pk){ r=o.pk; o.pk=null; } else r={w:u._rvWpn,basic:true};
      o.rec[o.sn]=r; o.rk.push(o.sn); if(o.rk.length>48) delete o.rec[o.rk.shift()]; o.last=r; c.amt=o.sn; },
    hookRec(A,T,u,c){ const o=S(T); o.sn++; const r={w:'hook',auto:true}; o.rec[o.sn]=r; o.rk.push(o.sn); if(o.rk.length>48) delete o.rec[o.rk.shift()]; c.amt=o.sn; },
    cone(A,T,u,c){ const r=S(T).last; if(r&&r.nbu) c.amt+=15; },
    hookR(A,T,u,c){ c.amt+=(T.P.chain||0)*M_(A); },
    /* ---- a weapon's blow, as it is about to land (out) ---- */
    wOut(A,T,u,c){ const r=recOf(T), t=c.tgt, P=T.P; if(!r||!t) return; const o=S(T); let k=1; const w=r.w, mel=ARM.indexOf(w)>=0;
      if(r.boost) k*=1+r.boost;                                                                          // Load the Rack, Rack Master
      if(r.pb) k*=1.15*(1+(P['pb.k']||0));                                                              // Keep Them Out, Muzzle Close
      if(r.basic&&P['basic.k']) k*=1+P['basic.k'];                                                      // Ninepin Count (his weapon attacks, the cycle's hook too)
      if(r.ws) k*=1+P['ws.k'];                                                                          // Walnut Steady
      if(w==='gatling'&&P['gat.pt']) k*=(0.15+P['gat.pt'])/0.15;                                        // Oiled Gatling: points of his attack a round
      if(w==='cannon'&&P['can.k']) k*=1+P['can.k'];                                                     // Shells in the Chest
      if(w==='blade'&&P['blade.k']) k*=1+P['blade.k'];                                                  // Curved Edge
      if(w==='hook'&&P['hook.k']) k*=1+P['hook.k'];                                                     // Short Leash
      if(w==='hook'&&r.cyc&&P['reel.k']) k*=1+P['reel.k'];                                              // Reel In
      if(w==='hammer'&&P.hh&&P['ring.k']) k*=1+P['ring.k'];                                             // Ringing Blow
      if(w==='hammer'&&P['jaw.k']&&A.markOf(u,t,'rvCk')) k*=1+P['jaw.k'];                              // Nutcracker's Jaw
      if(mel&&P['pin.k']&&A.markOf(u,t,'rvPin')) k*=1+P['pin.k'];                                       // Clamp Hand
      if(mel&&P['mel.k']) k*=1+P['mel.k'];                                                              // Gear Grind
      if(mel&&P.anyd&&P['hyb.k']) k*=1+P['hyb.k'];                                                      // Hybrid Belt
      if(w==='blade'&&P['tr.k']&&!r.trd){ r.trd=1; if(tqFull(A,T,u)){ const n=tq(A,T); r.tr=n; A.stSet(T,u,'rvTq',0); } }   // Torque Release: at full Torque the blade spends it all
      if(r.tr) k*=1+P['tr.k']*r.tr;
      if(P.fr){ const fs=r.frs||(r.frs={}); if(!fs[t.uid]&&A.markOf(u,t,'rvFr')){ fs[t.uid]=1; A.clearMark(u,t,'rvFr');      // Fits the Rack: his next attack on a newly Cracked enemy
          if(T.r.lw_1_1&&!o.frU&&!o.vol){ o.frU=true; o.rack++; if(o.rack>=5) T.fn.fullRack(A,T,u,c); } }
        if(fs[t.uid]) k*=1.06; }
      c.amt*=k; },
    /* ---- after one of his hits landed: Sighted (each different weapon in a row a step; any hit of his keeps it), Five of Five, Dragged Back ---- */
    wHit(A,T,u,c){ const t=c.tgt, o=S(T), P=T.P; if(!t||!t.alive) return; const r=recOf(T);
      if(any(T,SIGHT)){ let n=si(A,T,u,t);
        if(r){ if(o.carry>0&&n<o.carry){ n=o.carry; o.carry=0; } if(r.vol) n=5; else if(o.lw[t.uid]!==r.w){ n=Math.min(5,n+1); o.lw[t.uid]=r.w; } }
        if(n>0) T.fn.sight(A,T,u,t,n); }
      if(r&&ARM.indexOf(r.w)>=0&&P.drag&&A.markOf(u,t,'rvPin')) T.fn.drag(A,T,u,t,P.drag*M_(A)); },
    sight(A,T,u,t,n){ const was=si(A,T,u,t), o=S(T); n=Math.min(5,n); A.ustPut(T,u,t,'rvSi',n); if(n>(o.siHi||0)) o.siHi=n; if(T.P.ff&&n>=5&&was<5) A.setMark(T,u,t,'rvFf',{dur:A.amtOf(T,u,T.st.rvSi.dur,null)}); },
    /* a Pinned enemy drawn toward him by m (engine units), never closer than 0.5 m of ground (the hook's own 0.5 m); his own move (Pinned does not put it back) */
    drag(A,T,u,t,m){ if(!canMove(t)) return; const E=A.eng(), M=M_(A), dx=t.x-u.x, dy=t.y-u.y, L=Math.hypot(dx,dy)||1, g=A.gap(u,t), mv=Math.min(m,Math.max(0,g-0.5*M)); if(!(mv>0)) return;
      t.x-=dx/L*mv; t.y-=dy/L*mv; t._ax=t.x; t._ay=t.y; S(T).pmv[t.uid]=1; },
    /* after a weapon's blow (part): the saw's bleed stronger (Saw Teeth), the lower spike's cut stronger, an enemy the hook brought back Pinned */
    part(A,T,u,c){ const r=(typeof c.skill==='string'&&c.skill.slice(0,3)==='rv:')?S(T).rec[+c.skill.slice(3)]:null, t=c.tgt, P=T.P; if(!r||!t) return;
      if(r.w==='saw'&&P['saw.k']&&!r.sawd){ r.sawd=1; const D=t.dots, d=D&&D[D.length-1]; if(d&&d.src===u&&d._talO==null) d.dps*=1+P['saw.k']; }
      if(r.w==='lspike'&&P['ls.k']&&(t._shredT||0)>0) t._shredPct=Math.max(t._shredPct||0,0.2*(1+P['ls.k']));
      if(r.w==='hook'&&!r.hkd&&t.alive&&canMove(t)&&(any(T,PIN)||P.nl)){ r.hkd=1; T.fn.pin(A,T,u,c,t); } },
    /* the chain hook brought an enemy back: Pinned (4 s, Pin Down longer), Gate Kept's 1 s silence, Nobody Leaves' heal */
    pin(A,T,u,c,t){ const P=T.P, o=S(T);
      if(any(T,PIN)){ A.setMark(T,u,t,'rvPin',{dur:4+(P['pin.dur']||0)}); o.pmv[t.uid]=1; if(P.gate){ o.tsrc='gate'; try{ A.control(T,u,t,'silencedT',1); } finally{ o.tsrc=null; } } }
      if(P.nl) A.acts(T,u,[{heal:{pct:P.nl,of:'maxHp'},on:'self'}],c); },
    /* Arms for the Gap (once every 20 s, an enemy Pinned while he is at full Torque): his next four melee attacks run the whole cycle at double speed (6 s at most),
       and every enemy within 3 m is hooked in (to 0.5 m) and Pinned */
    arms(A,T,u,c){ const o=S(T), M=M_(A); o.sigA=20; o.agN=4; o.agi=0; o.agT=6;
      for(const x of foes(A,u)){ if(A.gap(u,x)>3*M) continue; if(canMove(x)){ const dx=x.x-u.x, dy=x.y-u.y, L=Math.hypot(dx,dy)||1, to=Math.min(L,A.eng().bodyR(u)+A.eng().bodyR(x)+0.5*M); x._dash=null; x.x=u.x+dx/L*to; x.y=u.y+dy/L*to; x._ax=x.x; x._ay=x.y; }
        A.setMark(T,u,x,'rvPin',{dur:4+(T.P['pin.dur']||0)}); o.pmv[x.uid]=1; } },
    /* ---- FULL ARSENAL: its five shots are the hits before its first control (the shots, then the primary's stun); each new enemy struck is the next shot ---- */
    faKit(A,T,u,c){ S(T).fa={ix:new Map(),done:new Set(),over:false}; },
    shotOf(A,T,t){ const fa=S(T).fa; if(!fa||fa.over||!t||fa.done.has(t)) return -1; if(!fa.ix.has(t)){ if(fa.ix.size>=5) return -1; fa.ix.set(t,fa.ix.size); } return fa.ix.get(t); },
    faOut(A,T,u,c){ const i=T.fn.shotOf(A,T,c.tgt), P=T.P; if(i<0) return; let k=1;
      if(P['ebc.k']) k*=1+P['ebc.k'];                                                                   // Every Barrel Counts
      if(P.la&&RNG[i]==='bolt'){ const E=A.eng(), t=c.tgt, a=E.defMul(u,t,'phys'); if(c.kind==='phys'&&a>0){ const sv=u._wpnArmIgn; u._wpnArmIgn=0.5*(1+0.05*rk(T,'lw_6_4')); const b=E.defMul(u,t,'phys'); u._wpnArmIgn=sv; k*=b/a; } }   // Long Arsenal's bolt: 50% of armor ignored (Bolt Pressure more)
      c.amt*=k; },
    faHit(A,T,u,c){ const t=c.tgt, i=T.fn.shotOf(A,T,t), P=T.P, o=S(T); if(i<0) return; o.fa.done.add(t); const E=A.eng(), a=atk(A,T,u,c);
      if(P['ebc.k']&&t.alive) T.fn.sight(A,T,u,t,Math.min(5,si(A,T,u,t)+1));
      if(P.wr&&A.markOf(u,t,'rvCk')) A.stSet(T,u,'rvPt',A.stGet(T,'rvPt')+1);                           // Workshop Repair
      if(!P.la) return; const w=RNG[i];
      if(w==='gatling'&&t.alive) A.hurt(T,u,t,9*(0.15+(P['gat.pt']||0))*a*E.defMul(u,t,'phys'),'#ffe08a','la');   // the roof gatling's nine rounds
      if(w==='saw'&&t.alive){ E.pushDot(t,a*0.5/4*(1+(P['saw.k']||0)),4,1,'#c0392b',u); }               // the saw's bleed (a game bleed: armor applies)
      if(w==='cannon'){ const ax=t.x-u.x, ay=t.y-u.y, aL=Math.hypot(ax,ay)||1, cMin=Math.cos(22.5*Math.PI/180), M=M_(A);   // the chest cannon's cone, toward this shot's enemy
        for(const x of foes(A,u)){ if(x===t) continue; const dx=x.x-u.x, dy=x.y-u.y, L=Math.hypot(dx,dy); if(L>20*M) continue; if(L>1&&(dx*ax+dy*ay)/(L*aL)<cMin) continue;
          A.hurt(T,u,x,0.75*a*(1+(P['can.k']||0))*E.defMul(u,x,'phys'),'#ffa657','la'); } } },
    /* ---- HIS CRIT CHANCE, ONE GROUP: at most 5% from all of them on one hit, this hit's own seeded roll in the room left. Five of Five forces one; Long Arsenal's revolver shot
       carries the revolver's own 15% (the weapon's, as its shot always has it) ---- */
    crit(A,T,u,c){ const t=c.tgt, P=T.P, o=S(T); if(c.force||!t) return; const r=recOf(T), E=A.eng();
      if(P.ff&&A.markOf(u,t,'rvFf')){ A.clearMark(u,t,'rvFf'); c.force=true; return; }
      const sh=(T.s.cur===FA&&P.la)?T.fn.shotOf(A,T,t):-1, rev=(r&&r.w==='revolver')||(sh>=0&&RNG[sh]==='revolver');
      if(sh>=0&&RNG[sh]==='revolver'&&E.rnd()<0.15){ c.force=true; return; }
      let p=0; const mel=r&&ARM.indexOf(r.w)>=0;
      if(P['crit.rv']&&rev) p+=P['crit.rv'];
      if(P['crit.ro']&&si(A,T,u,t)>=5) p+=P['crit.ro'];
      if(P['crit.wb']&&mel) p+=P['crit.wb'];
      if(P['crit.cf']&&mel&&A.stGet(T,'rvMp')>=10) p+=P['crit.cf'];
      if(P['crit.wg']&&(t.slow||0)>0) p+=P['crit.wg'];
      p=Math.min(p,CRIT_CAP); if(!(p>0)) return;
      const base=Math.min(0.95,(u.glyphCrit||0)+((u._critBuffT||0)>0?(u._critBuffPct||0):0)+(u._wpnCrit||0)); if(E.rnd()<p/Math.max(0.05,1-base)) c.force=true; },
    /* ---- HIS CONTROLS. ccO: the length, before it is written (ctx.amt: the game's seconds, 0.7 cut; a talent's: as written). Stuns: x Hard Questions + Overwound, Hammer Hand's
       1 s, at most 4.0 s; a stun a talent makes or repeats (Hook in the Cycle's hook, Hammer Hand's second hammer, The Third Winter) never on a stunned enemy nor within 0.5 s
       after a stun of his on it ended; and no enemy stays stunned by him more than 4.0 s in a row (then 0.5 s free). Silences: the upper spike + Spike Rhythm; slows:
       Smoke Bomb + Lingering Smoke; in full, at most 4.0 s. Kept for ccH and rvCC (the game's weapon line holds his number) ---- */
    ccO(A,T,u,c){ const o=S(T), t=c.tgt, f=c.field, P=T.P; if(!t||t.team===u.team) return; o.ccF=null;
      if(T.s.cur===FA&&o.fa) o.fa.over=true;                                                             // Full Arsenal's shots are over: its control follows them
      const r=c.talent?null:recOf(T), kind=c.talent?(o.tsrc||'talent'):(r?r.w:T.s.cur); let F=c.amt||0;
      if(f==='stunned'){ let lock=!!c.talent;
        if(kind==='hammer'){ if(P.hh) F=1.0; if(r&&r.h2) lock=true; }
        if(kind==='hook'&&r&&r.cyc) lock=true;
        F=F*(1+(P.hq||0)); if(kind==='hammer'&&P.ow&&tqFull(A,T,u)) F+=P.ow; F=Math.min(4.0,F);
        const st=strec(o,t); st.t=t;
        if(lock&&((t.stunned||0)>0||st.after>0)) F=0;
        if(st.free>0) F=0;
        const run=(t.stunned||0)>0?st.run:0; F=Math.min(F,Math.max(0,STUN_RUN-run)); if(F<0.05) F=0; }   // his stun time in this stretch (an ally's stun in between does not end it)
      else if(f==='silencedT'){ if(kind==='uspike'&&P.spike) F=Math.min(4.0,F+P.spike); }
      else if(f==='slow'){ if((kind===SB||kind==='smoke')&&P['smoke.dur']) F=Math.min(4.0,F+P['smoke.dur']); }
      c.amt=F; o.ccF={t,f,F,kind}; },
    rvCC(A,T,u,c){ const o=S(T), C=o.ccF; if(C&&C.t===c.unit) c.amt=C.F; o.ccF=null; },
    /* a control of his landed: past the game's cap in full; the stun recorded (the lock, the run); Patched Joints; Thick Smoke, Smoke Screen's mark; Seized Gears; Cracks */
    ccH(A,T,u,c){ const o=S(T), t=c.tgt, f=c.field, P=T.P; if(!t||t.team===u.team||!(c.amt>0)) return;
      const C=(o.ccF&&o.ccF.t===t&&o.ccF.f===f)?o.ccF:null, F=C?C.F:c.amt, kind=C?C.kind:null;
      if(F>c.amt+1e-9) t[f]=Math.max(t[f]||0,F);
      if(f==='stunned'){ const st=strec(o,t); st.t=t; st.mine=Math.max(st.mine,F); st.after=0; st.n++; if(P.pj) A.acts(T,u,[{heal:{pct:P.pj,of:'maxHp'},on:'self'}],c); }
      if(f==='slow'&&kind===SB&&P['smoke.k']){ const m=A.eng().slowMul(u); t.slowMul=Math.min(t.slowMul==null?1:t.slowMul,Math.max(0.05,1-(1-m)*(1+P['smoke.k']))); }
      if(f==='slow'&&(kind===SB||kind==='smoke')&&T.r.nc_6_2&&T.r.nc_5_2) A.setMark(T,u,t,'rvSm',{dur:F,longest:true});
      if(T.r.nc_n1) A.setMark(T,u,t,'rvSz',{dur:3});
      if(any(T,CRACK)) T.fn.addCrack(A,T,u,c,t,(kind==='hammer'&&P.wg&&f==='stunned')?2:(kind==='oil'?2:1)); },
    /* ---- CRACKS: at 3 the enemy is Cracked (3 s, Fine Fracture longer) and they clear ---- */
    addCrack(A,T,u,c,t,n){ if(!t.alive) return; const v=A.ustGet(T,u,t,'rvCr')+n; if(v>=3){ A.ustPut(T,u,t,'rvCr',0); T.fn.crack(A,T,u,c,t,false); } else A.ustPut(T,u,t,'rvCr',v); },
    crack(A,T,u,c,t,sig){ const o=S(T), P=T.P; A.setMark(T,u,t,'rvCk',{dur:3+(P['ck.dur']||0)});
      if(sig||T.r.nc_1_4) A.stSet(T,u,'rvPt',A.stGet(T,'rvPt')+1);                                      // a Spare Part (Parts Bin; The Third Winter's own)
      if(T.r.nc_11_2) A.stSet(T,u,'rvNc',A.stGet(T,'rvNc')+1);                                          // Nothing Cancelled
      if(P.fr) A.setMark(T,u,t,'rvFr',{dur:10});                                                         // Fits the Rack: his next attack on it
      if(P.co&&!(o.coT>0)){ o.coT=10; u.greenCd=0; }                                                     // Cracked Open (once every 10 s)
      if(!sig&&P['sig.tw']&&!(o.sigT>0)){ o.sigT=25; const E=A.eng(), M=M_(A), L=foes(A,u).filter(x=>x!==t&&A.gap(t,x)<4*M);   // The Third Winter (once every 25 s)
        for(const x of L){ A.ustPut(T,u,x,'rvCr',0); T.fn.crack(A,T,u,c,x,true); }
        o.tsrc='tw'; try{ for(const x of L) if(x.alive) A.control(T,u,x,'stunned',1); } finally{ o.tsrc=null; } } },
    /* ---- SMOKE BOMB's cast (its slow already landed): Smoke and Sight, Oil in the Eyes (1 s silence, 2 Cracks), Spreading Smoke (enemies within 2 m of its target
       slowed as the target is, gaining a Crack) ---- */
    sbCast(A,T,u,c){ const t=c.tgt, P=T.P, o=S(T); if(!t||!t.alive||t.team===u.team) return;
      if(P.sas) T.fn.sight(A,T,u,t,Math.min(5,si(A,T,u,t)+P.sas));
      if(P.oil){ o.tsrc='oil'; try{ A.control(T,u,t,'silencedT',1); } finally{ o.tsrc=null; } }
      if(P.spread){ const E=A.eng(), M=M_(A), m=(t.slowMul!=null&&(t.slow||0)>0)?t.slowMul:E.slowMul(u), d=2*E.ccDur(1);
        for(const x of foes(A,u)){ if(x===t||A.gap(t,x)>=2*M) continue; o.tsrc='smoke'; try{ A.control(T,u,x,'slow',d); } finally{ o.tsrc=null; } if((x.slow||0)>0) x.slowMul=Math.min(x.slowMul==null?1:x.slowMul,m); } } },
    /* ---- SPARE PARTS: fitted all at once below 50% HP (Parts Bin), 1% x 3 a Part (Patch Kit 0.5% x 2 more); Quick Fit 0.5% x 5 a Part for 3 s (in the group) ---- */
    fit(A,T,u,c){ const P=T.P, n=A.stGet(T,'rvPt'); if(!(n>0)) return; A.stSet(T,u,'rvPt',0);
      const h=n*((P['pt.fit']||0)+(P['pt.kit']||0)); if(h>0) A.acts(T,u,[{heal:{pct:h,of:'maxHp'},on:'self'}],c);
      if(P['dr.qf']) A.acts(T,u,[{window:'rvQf',dur:3,n}],c); },
    lastSpare(A,T,u,c){ A.acts(T,u,[{undying:T.P['ls.hold']||0.5}],c); T.fn.fit(A,T,u,c); },
    death(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team) return; if(T.P.salv&&A.markOf(u,x,'rvCk')) A.stSet(T,u,'rvPt',A.stGet(T,'rvPt')+T.P.salv); },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP: each multiplies, together at most 35% off a hit (hits and damage over time; a damage over time counts as an ability) ---- */
    drK(A,T,u,s,c){ const P=T.P; if(!s||s.team===u.team) return 1; let k=1; const M=M_(A), g=A.gap(u,s), ab=!(c&&c.auto);
      if(P['dr.far']&&g>6*M) k*=1-P['dr.far'];
      if(P['dr.seen']&&si(A,T,u,s)>=3) k*=1-P['dr.seen'];
      if(P['dr.ab1']&&ab) k*=1-P['dr.ab1'];
      if(P['dr.ab2']&&ab) k*=1-P['dr.ab2'];
      if(P['dr.tq']) k*=1-P['dr.tq']*tq(A,T);
      if(P['dr.near']&&g<=3*M) k*=1-P['dr.near'];
      if(P.held&&A.markOf(u,s,'rvPin')) k*=1-P.held;
      if(P['dr.brace']&&u.hp<0.5*u.maxHp) k*=1-P['dr.brace'];
      if(P['dr.sz']&&A.markOf(u,s,'rvSz')) k*=1-P['dr.sz'];
      if(P['dr.qf']){ const w=T.s.w.rvQf; if(w&&w.t>0) k*=Math.max(0,1-P['dr.qf']*w.n); }
      if(P.screen&&T.r.nc_5_2&&A.markOf(u,s,'rvSm')) k*=1-P.screen;
      return Math.max(DR_FLOOR,k); },
    myDr(A,T,u,c){ if(!T.s.api) T.s.api=A; c.amt*=T.fn.drK(A,T,u,c.src,c); },
    allyK(A,T,u,s){ const P=T.P; if(!s) return 1; let k=1;
      if(P.held&&A.markOf(u,s,'rvPin')) k*=1-P.held;
      if(P.screen&&T.r.nc_5_2&&A.markOf(u,s,'rvSm')) k*=1-P.screen;
      return Math.max(ALLY_FLOOR,k); },
    allyDr(A,T,u,c){ if(!T.s.api) T.s.api=A; c.amt*=T.fn.allyK(A,T,u,c.src); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/51 - RIVET - talent decisions.md) */
  ruling:{}
};
