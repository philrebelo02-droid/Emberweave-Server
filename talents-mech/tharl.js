/* THARL IRONCOIL - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Tharl Ironcoil": what he added)
   His real kit (the code, not the card wording; damage profile Attack: every hit of his - basic attacks, Scale Ram, Avalanche Coil's path and landing - is
   PHYSICAL, none names a kind; tests/tharl-kit-facts.js measures it):
   - Scale Ram ('knockstun', green, cd 8): ONE hit on his target, 145% of his attack x skill level, then a stun through ccApply (it lands 2.45 s) and a push
     of 1.8 m straight back along x. Inside the skill: casting:'knockstun'. The hit comes BEFORE the stun (a "stunned" test at the hit sees the old state).
   - Fortress Curl ('defensive', blue, cd 9): his damage-taken multiplier is 0.35 (65% off, the skill slot where the strongest counts) for 3.5 s. Nothing in
     the game ends it early (a stun does not); the wave change does (beginWaveEnter zeroes drT).
   - Layered Hide (passive 'layered'): every damage() of a hit on him (not a DoT tick, not a talent's damage) adds a layer while he is not PLATED; at 5 the
     passive pass makes him PLATED (u._layT = 2.0 s + 0.01 s a level, 3.0 s at 100): each tick while it runs his stun, fear, knock-up and pull are cleared.
     No layer is gained while PLATED. In 20 seeded fights: 4.4 platings a fight, PLATED 20% of his time.
   - Avalanche Coil ('charge' ultimate on energy - no cooldown; ULT_DEF.charge + HERO_ULT_ART.tharl {pathHit:0.5}): he dashes to the FARTHEST enemy (a
     median 19 m), every enemy on the path is struck for 50% (a groundHazards arrival: casting:'chargePath'), and on arrival every enemy whose centre is within
     5 m of the landing is struck for 180% x skill level and stunned (1.4 s as landed; casting:'charge'). 0.33 path hits and 1.36 landing hits a cast.
   Scar Plates, Shed, Curled Around, Split, Seam, Rubble, Coilspring, Downhill and Buried exist only through his talents. All of his own state is in one
   per-fight object T.s.th; every lock and window of his is a COUNTDOWN (seconds left), so nothing of his is an absolute fight time (no `times` list).
   Readings, caps and corrected tooltips: WIRING/56 - THARL IRONCOIL - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const RAM='knockstun', CURL='defensive', ULT='charge', PATH='chargePath', ULTS=[ULT,PATH];
const DR_CAP=0.20, ALLY_CAP=0.50, CC_CAP=0.40, STUN_LOCK=0.5, RUN_MAX=4.0, PLATE_MAX=10, SIG_AT=6, IWL_AT=6;
/* the families: the state's bookkeeping runs when any talent of it is learned */
const PLATE=['se_1_1','se_2_1','se_3_1','se_4_1','se_6_4','se_9_4','se_11_1','se_13_2'];
const SHEL=['se_2_2','se_4_2','se_5_2','se_5_3','se_6_3','se_6_2','se_8_2','se_10_2','se_12_2'];
const SPLIT=['sb_1_4','sb_6_1','sb_2_4','sb_3_2','sb_3_4','sb_4_4','sb_5_3','sb_6_4','sb_7_4','sb_10_4','sb_11_3','sb_11_4','sb_12_3','sb_13_3'];
const SEAM=['sb_2_3','sb_4_3','sb_5_3','sb_10_3','sb_6_3','sb_7_3','sb_2_2','sb_9_3','sb_11_3','sb_12_3','sb_13_3'];
const RUB=['sb_1_1','sb_3_1','sb_5_1','sb_5_2','sb_6_2','sb_7_1','sb_9_1','sb_10_1','sb_12_1','sb_13_3'];
const COIL=['rc_1_1','rc_2_1','rc_3_1','rc_4_1','rc_8_1','rc_10_1','rc_11_1','rc_12_1','rc_12_3','rc_7_1','rc_13_2','rc_n2'];
const DOWN=['rc_1_2','rc_2_2','rc_6_4','rc_8_2','rc_9_2','rc_10_2','rc_13_2'];
const BUR=['rc_1_4','rc_3_4','rc_5_4','rc_7_4','rc_9_4','rc_11_4','rc_12_4','rc_5_2'];   // (the signature buries with its own 3 s)
const DRG=['se_9_1','rc_10_3','se_8_2','se_12_1','rc_4_1','rc_6_2','rc_n1','sb_5_1','rc_5_4'];          // his damage-reduction group (and Rock Dust Lungs on DoT ticks)
const TEAM=['se_2_2','se_13_2','se_5_3','sb_5_1','rc_5_4','sb_9_3','rc_7_4'];                          // his rows on hits that are not on him
const TEN=['se_5_1','se_8_3','sb_12_2','rc_7_1'];
/* ---- small readers (the 95% instrument calls drK from a test with the API kept on T.s.api) ---- */
const has=(T,L)=>L.some(id=>T.r[id]);
const P0=(T,k)=>T.P[k]||0;
const on=(m,t)=>!!t&&(m[t.uid]||0)>0;
const gapM=(E,a,b)=>(E.dist(a,b)-E.bodyR(a)-E.bodyR(b))/E.METER();
const foes=(E,u)=>E.units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
const atkOf=(E,u)=>(u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*E.rage();
/* a physical hit of his talent damage: the target's armour applies (ign: the share of it ignored), and the element, as his skills' hits */
const physK=(E,u,t,ign)=>{ const sv=u._wpnArmIgn; if(ign>0) u._wpnArmIgn=1-(1-(sv||0))*(1-Math.min(1,ign)); try{ return E.defMul(u,t,'phys')*(E.elemMul?E.elemMul(u,t):1); } finally{ u._wpnArmIgn=sv; } };
const fresh=()=>({init:false,pl:0,rg:null,lt:0,iwl:false,iron:0,ironA:null,ironUsed:false,wth:0,
  curl:0,acc:0,cs:0,sh:[],shT:0,saK:{},ums:0,ramSp:0,ramT:null,ramLand:0,ramLS:false,snap:0,chs:false,
  dh:0,dhL:0,mom:0,gs:0,rw:0,firstUlt:true,again:false,againHit:false,landHit:[],ultHit:{},shelf:0,shelfN:{},sigOn:false,sigCd:0,stoneCd:0,stoneHit:false,
  rub:{},seam:{},bur:{},sp:{},brk:{},lk:{},hs:{},run:{},pre:{},brkT:null,first:true,mlt:false,hl:0,rum:0,n:{}});
const O=T=>T.s.th||(T.s.th=fresh());
const cnt=(o,k)=>{ o.n[k]=(o.n[k]||0)+1; };   // what happened, for the tests and the live-fight print
module.exports={
  hero:'tharl',
  casting:true,                         // rows ask which of his skills a hit comes from (Scale Ram, Avalanche Coil's path and landing)
  needs:{ se_5_4:'se_1_4', se_7_4:'se_1_4', se_10_4:'se_1_4',          // the Shed talents need Shed Scales (it gives the Shed its damage; Sharp Rain is on every scale of his)
          se_6_2:'se_2_2', se_8_2:'se_2_2', se_10_2:'se_2_2', se_5_3:'se_2_2', se_12_2:'se_2_2',   // the shelter talents need Curled Around
          sb_10_3:'sb_2_3' },                                                              // Open Seam raises Find the Seam's bonus
  /* run for him whenever he has any mechanic talent: his skills seen, his countdowns and the bookkeeping of the states his talents share, his capped groups */
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                            // countdowns, PLATED seen, the curl and its shelter, winding Coilspring
    {on:'wave',do:[{fn:'wv'}]},
    {on:'kit',skill:RAM,do:[{fn:'ramKit'}]},                                               // Scale Ram: Coilspring spent, its Seam opened, its push
    {on:'cast',skill:RAM,do:[{fn:'ramCast'}]},                                             //   Both Blocks' second strike, Loose Stone's Rubble
    {on:'cast',skill:CURL,do:[{fn:'curlCast'}]},                                           // Fortress Curl: the curl and the allies it shelters
    {on:'kit',skill:ULT,do:[{fn:'ultKit'}]},
    {on:'skillTgt',skill:ULT,do:[{fn:'ultTgt'}]},                                          // Avalanche Coil: how far he will roll (Downhill)
    {on:'landPre',skill:ULT,do:[{fn:'ultPre'}]},
    {on:'land',skill:ULT,do:[{fn:'ultLand'}]},                                             //   its landing: Buried, Rubble, Rumble, the slope gives way
    {on:'ccOut',do:[{fn:'ccPre'}]},                                                        // the stun a target had before one of his lands
    {on:'ccHit',do:[{fn:'ccHit'}]},                                                        // every stun of his that lands: extensions, Rubble, the stun-lock, 4 s in a row
    {on:'out',do:[{fn:'outPre'}]},                                                         // a basic attack that breaks the Split (and The Stone Gives' triple)
    {on:'hit',do:[{fn:'hit'}]},                                                            // Split, the break, the hits of his skills
    {on:'hurt',do:[{fn:'hurt'}]},                                                          // hits on him: Ball of Iron, Curl of Iron, the iron of his signature
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                 // his damage-reduction talents: ONE capped group (drK)
    {on:'dotIn',reqAny:DRG.concat(['sb_12_4']),do:[{fn:'myDot'}]},
    {on:'teamIn',reqAny:TEAM,do:[{fn:'teamK'}]},                                           // the allies he shelters (ONE capped group), his team on Seamed / Buried enemies, Spiked Tail
    {on:'teamHeal',reqAny:['rc_1_4','rc_12_4'],do:[{fn:'healCut'}]},                       // Buried: healing received lower
    {on:'death',reqAny:RUB.concat(['rc_9_4','rc_n2']),do:[{fn:'died'}]},                   // Rubble falls, Cave-In
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                // his control-shortening talents: ONE capped group (40%)
    {stat:{armor:-0.10},to:{team:'enemy',fn:'isBrk'},reqAny:SPLIT}                          // a broken Split: 10% less armour for 4 s
  ],
  talents:{
    /* ============================== EVERY SCALE EARNED ============================== */
    se_1_1:[ {stat:{armor:R(0.004)},per:{fn:'plN'}} ],                                    // Struck Iron (Scar Plates: tk sees each PLATED)
    se_9_1:[ {param:'dr.crit1',add:R(0.02)} ],                                            // Quarry Endurance (drK)
    se_1_4:[ {param:'shed',add:R(0.15)} ],                                                // Shed Scales (tk: PLATED ends)
    se_2_1:[ {stat:{mr:R(0.003)},per:{fn:'plN'}} ],                                       // Heavier Each Time
    se_2_2:[ {param:'sh.dr',add:R(0.03)} ],                                               // Curled Around (curlCast, teamK)
    se_3_1:[ {param:'iwl',add:1} ],                                                       // Iron Where It Landed (tk)
    se_4_2:[ {param:'sh.r',add:R(0.5)} ],                                                 // Wider Coil
    se_2_3:[ {on:'kit',skill:CURL,opt:{dur:{add:R(0.2)}}} ],                              // Hard Curl
    se_3_4:[ {param:'shed.slow',add:R(0.05)} ],                                           // Flying Scale (shed)
    se_4_1:[ {stat:{hp:R(0.002)},per:{fn:'plN'}} ],                                       // Iron Growth
    se_5_2:[ {param:'sh.n',add:1} ],                                                      // Two Under the Tail (PICK ONE)
    se_5_3:[ {param:'spike',add:0.20} ],                                                  // Spiked Tail (PICK ONE; teamK)
    se_6_1:[ {param:'wth',add:R(0.004)} ],                                                // Weathered Plates (tk)
    se_5_1:[ {param:'ten',add:R(0.04)} ],                                                 // Layered Will (ten)
    se_6_3:[ {param:'spike.more',add:R(0.10)} ],                                          // Barbed Tail
    se_5_4:[ {param:'shed.more',add:R(0.03)} ],                                           // Sharp Edges
    se_4_3:[ {on:'out',if:{casting:RAM},more:R(0.04)} ],                                  // Ram Weight
    se_6_2:[ {param:'ums',add:R(0.0024)} ],                                               // Under My Scales (tk)
    se_6_4:[ {param:'old',add:R(1)} ],                                                    // Old Scar Plates (wv)
    se_7_1:[ {stat:{atk:R(0.003)},per:{fn:'layN'}} ],                                     // Kicked and Grew
    se_7_3:[ {on:'out',if:{casting:ULTS},more:R(0.03)} ],                                 // Avalanche Weight
    se_7_4:[ {param:'season',add:R(0.30)} ],                                              // Shed Season (curlEnd)
    se_8_1:[ {param:'plate.add',add:R(0.1)} ],                                            // Plate Over Plate (tk)
    se_8_2:[ {param:'dr.bond',add:R(0.01)} ],                                             // Shelter Bond (drK)
    se_8_3:[ {param:'sil1',add:R(0.10)} ],                                                // Stony Look (ten)
    se_9_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                            // Striking Weight
    se_9_4:[ {param:'moult',add:1} ],                                                     // Ironcoil Moult (tk)
    se_10_1:[ {on:'kit',skill:CURL,opt:{mul:{add:R(-0.0065)}}} ],                         // Thickened: the curl's 65% x (1 + 1% a rank)
    se_10_2:[ {param:'wrap',add:R(0.3)} ],                                                // Long Wrap (curlEnd)
    se_10_4:[ {param:'rain',add:1}, {on:'thShed2',chance:R(0.10),do:[{fn:'shedAgain'}]} ],   // Scale Rain
    se_11_1:[ {stat:{atk:R(0.002)},per:{fn:'plN'}} ],                                     // Iron Memory
    se_11_2:[ {param:'coi',add:1} ],                                                      // Curl of Iron (hurt, tk)
    se_11_3:[ {param:'shove',add:R(0.2)} ],                                               // Ram Shove (ramKit)
    se_12_1:[ {param:'dr.low',add:R(0.02)} ],                                             // Tough Old Lizard (drK)
    se_12_2:[ {param:'sa',add:R(0.02)}, {stat:{armor:1},to:{team:'ally',fn:'isSh'},per:{fn:'saK'}} ],   // Shared Armor
    se_12_4:[ {param:'shed.ign',add:R(0.10)} ],                                           // Sharp Rain (every scale of his)
    se_13_2:[ {param:'iron',add:1} ],                                                     // Every Scale He Was Hit For (SIGNATURE: tk, hurt, teamK)
    /* ============================== STRIKING BLOCKS ============================== */
    sb_1_1:[ {param:'rub.slow',add:R(0.04)} ],                                            // Cover in Rubble (ccHit, died)
    sb_6_1:[ {param:'first',add:R(2)} ],                                                  // First Swing (addSplit)
    sb_1_4:[ {param:'brk',add:R(0.06)} ],                                                 // Split the Stone (outPre, hit)
    sb_2_3:[ {param:'seam',add:R(0.02)}, {on:'out',if:{fn:'tgtSeam'},more:1,per:{fn:'seamK'}} ],   // Find the Seam
    sb_2_4:[ {param:'sp.dur',add:R(1)} ],                                                 // Quarry Rhythm
    sb_3_1:[ {param:'slide',add:R(0.05)} ],                                               // Slate Slide (fall)
    sb_3_2:[ {on:'crit',if:{fn:'split2'},chance:R(0.01),force:true} ],                    // Rock Breaker (1% a rank: his crit-chance talents 5% at most)
    sb_3_4:[ {param:'hammer',add:1} ],                                                    // Hammered Open (doBreak)
    sb_4_2:[ {on:'out',if:{casting:RAM},more:R(0.04)} ],                                  // Ram Force
    sb_4_3:[ {param:'seam.dur',add:R(0.5)} ],                                             // Deep Seam
    sb_4_4:[ {stat:{armor:R(-0.005)},to:{team:'enemy',fn:'hasSp'},per:{fn:'spOf'}} ],     // Chisel
    sb_5_1:[ {param:'dr.gravel',add:R(0.015)} ],                                          // Gravel (drK, teamK)
    sb_5_2:[ {param:'bury',add:0.5} ],                                                    // Bury Them (PICK ONE; ccHit)
    sb_5_3:[ {param:'bts',add:1} ],                                                       // Break the Seam (PICK ONE; outPre)
    sb_n2:[ {on:'out',if:{targetTeam:'enemy',targetHpAbove:0.7},more:R(0.02)} ],          // Fresh Quarry Face
    sb_10_3:[ {param:'seam.low',add:R(0.01)} ],                                           // Open Seam (seamK)
    sb_6_2:[ {param:'burial',add:R(0.2)} ],                                               // Deep Burial (ccHit)
    sb_6_3:[ {on:'out',if:{fn:'tgtSeam'},critMore:R(0.02)} ],                             // Seam Strike (2% a rank: a crit-damage talent 10% at most)
    sb_6_4:[ {param:'cutter',add:R(0.01)} ],                                              // Stonecutter (doBreak)
    sb_7_1:[ {param:'rub.dur',add:R(0.5)} ],                                              // Spoil Heap
    sb_7_3:[ {param:'both',add:1} ],                                                      // Both Blocks (ramCast)
    sb_7_4:[ {param:'rockfall',add:R(0.15)} ],                                            // Falling Chips (doBreak)
    sb_2_2:[ {stat:{aspd:[1/0.97-1,1/0.94-1,1/0.91-1]},if:{fn:'tgtSeamU'}} ],             // Heavy Blocks: the attack interval 3% shorter a rank
    sb_8_4:[ {on:'out',ignoreArmor:R(0.02)} ],                                            // Grain of the Rock
    sb_9_1:[ {param:'shelf',add:1} ],                                                     // Shelf Comes Down (ultLand, fall)
    sb_9_2:[ {on:'out',if:{casting:ULTS},more:R(0.03)} ],                                 // Quarry Muscle
    sb_9_3:[ {param:'wide',add:R(0.015)} ],                                               // Wide Seam (teamK)
    sb_10_1:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',fn:'isRub'}} ],                      // Quarry Dust
    sb_10_4:[ {param:'thru',add:R(0.3)} ],                                                // Breakthrough (doBreak)
    sb_11_2:[ {on:'out',if:{fn:'tgtStun'},more:R(0.02)} ],                                // Flint
    sb_11_3:[ {param:'chs',add:1} ],                                                      // Coldharrow Strike (curlEnd, outPre)
    sb_11_4:[ {stat:{atk:R(0.003)},per:{fn:'hlN'}} ],                                     // Hard Labour
    sb_12_1:[ {param:'loose',add:R(0.05)} ],                                              // Loose Ground (fall)
    sb_12_2:[ {param:'sil2',add:R(0.10)} ],                                               // Blunt Head (ten)
    sb_12_3:[ {param:'core',add:R(0.03)} ],                                               // Split to the Core (outPre)
    sb_12_4:[ {param:'dr.dust',add:R(0.02)} ],                                            // Rock Dust Lungs (myDot)
    sb_13_3:[ {param:'stone',add:1} ],                                                    // The Stone Gives (SIGNATURE: outPre, doBreak)
    /* ============================== THE ROLLING COIL ============================== */
    rc_1_1:[ {on:'out',if:{casting:RAM},more:R(0.03),per:{fn:'ramSp'}} ],                 // Wind Tight (the always tick winds; ramKit spends)
    rc_1_2:[ {on:'out',if:{casting:ULTS},more:R(0.006),per:{fn:'dhN'}} ],                 // Downhill (ultTgt)
    rc_1_4:[ {param:'bur',add:R(0.03)}, {stat:{aspd:R(-0.03)},to:{team:'enemy',fn:'isBur'}} ],   // Buried (ultLand; healCut)
    rc_2_1:[ {param:'coil.rate',add:R(0.15)} ],                                           // Tight Coil
    rc_2_2:[ {param:'dh.max',add:R(1)} ],                                                 // Steep Slope
    rc_3_1:[ {param:'loaded',add:1} ],                                                    // Spring Loaded (ramKit, ccHit)
    rc_6_2:[ {param:'dr.mom',add:R(0.015)} ],                                             // Momentum of Iron (drK)
    rc_3_4:[ {param:'bur.dur',add:R(0.4)} ],                                              // Under the Scree
    rc_4_1:[ {param:'dr.tuck',add:R(0.003)} ],                                            // Tucked Tight (drK)
    rc_4_2:[ {on:'out',if:{casting:PATH},more:R(0.05)} ],                                 // Rolling Start
    rc_4_3:[ {on:'kit',skill:CURL,opt:{dur:{add:R(0.2)}}} ],                              // Long Curl
    rc_n2:[ {on:'out',if:{casting:RAM,fn:'tgtStunBur'},more:0.05}, {param:'ls',add:1,req:'sb_1_1'} ],   // Loose Stone (LINK; with Cover in Rubble: ramCast)
    rc_n1:[ {param:'dr.far',add:R(0.015)} ],                                              // Low to the Ground (drK)
    rc_8_3:[ {on:'tick',do:[{weaken:'slowMul',by:R(0.08)}]} ],                            // Pebble Shrug
    rc_5_4:[ {param:'dr.weight',add:R(0.02)} ],                                           // Weight on Them (drK, teamK)
    rc_6_1:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                        // Curled Patience
    rc_6_4:[ {param:'head',add:R(3)} ],                                                   // Head Start (ultTgt)
    rc_7_1:[ {param:'ball',add:1} ],                                                      // Ball of Iron (hurt, ten)
    rc_7_3:[ {on:'out',if:{casting:ULTS},more:R(0.03)} ],                                 // Avalanche Force
    rc_7_4:[ {param:'heavy',add:R(0.015)} ],                                              // Heavy Earth (teamK)
    rc_8_1:[ {param:'snap',add:1}, {stat:{aspd:R(0.03)},if:{fn:'snapOn'}} ],              // Uncoil Snap (curlEnd)
    rc_8_2:[ {stat:{armor:R(0.003)},per:{fn:'gsN'}} ],                                    // Gathered Speed
    rc_5_3:[ {on:'out',if:{casting:PATH},mul:0}, {param:'stop',add:0.6} ],                // Stop Dead (PICK ONE; ccHit)
    rc_5_2:[ {param:'line',add:1} ],                                                      // Bury the Line (PICK ONE; hit)
    rc_9_2:[ {param:'again',add:1}, {on:'kill',if:{casting:ULT},do:[{fn:'againHit'}]} ],   // Roll Again (ultLand)
    rc_6_3:[ {on:'out',if:{casting:ULT},more:R(0.05)} ],                                  // Crushing Halt
    rc_9_4:[ {param:'cave',add:R(0.4)} ],                                                 // Cave-In (died)
    rc_10_1:[ {param:'coiled',add:R(0.003)} ],                                            // Coiled Strength (ramKit)
    rc_10_2:[ {on:'out',if:{casting:RAM,fn:'rwOn'},more:R(0.003),per:{fn:'dhL'}} ],       // Downhill Weight
    rc_10_3:[ {param:'dr.crit2',add:R(0.02)} ],                                           // Stone Hide (drK)
    rc_11_1:[ {param:'full',add:1} ],                                                     // Full Uncoil (curlEnd)
    rc_11_2:[ {stat:{atk:R(0.005)},per:{fn:'rumN'}} ],                                    // Slope Rumble (ultLand)
    rc_11_4:[ {param:'packed',add:R(0.03)} ],                                             // Packed Earth (tk)
    rc_12_1:[ {param:'wound',add:R(2)} ],                                                 // Coiled Overnight (wv)
    rc_12_2:[ {on:'kit',skill:ULT,opt:{radius:{addM:R(0.2)}}} ],                          // Mountainside
    rc_12_3:[ {stat:{atk:R(0.003)},per:{fn:'csN'}} ],                                     // Coilspring Steel
    rc_12_4:[ {param:'dust',add:R(0.05)} ],                                               // Choking Scree (healCut)
    rc_13_2:[ {param:'shelfSig',add:1} ]                                                  // The Shelf Came Down (SIGNATURE: ultPre, ccHit, ultLand)
  },
  fn:{
    /* ---- counts the stat rows and conditions read ---- */
    plN(A,T){ return Math.floor(O(T).pl+1e-9); },
    layN(A,T,u){ return ((u._layT||0)>0)?0:Math.min(5,u._layStk||0); },
    csN(A,T){ return O(T).cs; },
    rumN(A,T){ return O(T).rum; },
    hlN(A,T){ return Math.min(10,O(T).hl); },
    gsN(A,T){ const o=O(T); return o.gs>0?o.dhL:0; },
    dhN(A,T){ return O(T).dh; },
    dhL(A,T){ return O(T).dhL; },
    rwOn(A,T){ return O(T).rw>0; },
    ramSp(A,T){ return O(T).ramSp; },
    snapOn(A,T){ return O(T).snap>0; },
    tgtSeam(A,T,u,c){ return on(O(T).seam,c.tgt); },
    tgtSeamU(A,T,u){ const t=u.target; return !!t&&t.alive&&on(O(T).seam,t); },
    tgtStun(A,T,u,c){ const t=c.tgt; return !!t&&t.team!==u.team&&(t.stunned||0)>0; },
    tgtStunBur(A,T,u,c){ const t=c.tgt; return !!t&&((t.stunned||0)>0||on(O(T).bur,t)); },
    seamK(A,T,u,c){ const t=c.tgt; return P0(T,'seam')+((t&&t.hp<0.5*t.maxHp)?P0(T,'seam.low'):0); },
    split2(A,T,u,c){ const t=c.tgt, e=t&&O(T).sp[t.uid]; return !!e&&e.n>=2; },
    hasSp(A,T,u,c){ const t=c.tgt, e=t&&O(T).sp[t.uid]; return !!e&&e.n>0; },
    spOf(A,T,u,c){ const t=c.tgt, e=t&&O(T).sp[t.uid]; return e?e.n:0; },
    isRub(A,T,u,c){ return on(O(T).rub,c.tgt); },
    isBrk(A,T,u,c){ return on(O(T).brk,c.tgt); },
    isBur(A,T,u,c){ return on(O(T).bur,c.tgt); },
    isSh(A,T,u,c){ const x=c.tgt; return !!x&&x!==u&&O(T).sh.indexOf(x)>=0; },
    saK(A,T,u,c){ const x=c.tgt; return (x&&O(T).saK[x.uid])||0; },
    /* ---- HIS COUNTDOWNS, once a tick. battleTime starts again at 0 at every wave (beginWaveEnter), so none of his locks is an absolute fight time: each is
       seconds left, counted down here. Also: PLATED seen starting and ending (Scar Plates, Shed), the curl and its shelter, Coilspring winding. ---- */
    tk(A,T,u,c){ const o=O(T), P=T.P, E=A.eng(), dt=c.dt||0; T.s.api=A;
      if(!o.init) T.fn.wv(A,T,u);
      for(const m of [o.rub,o.seam,o.brk,o.lk]) for(const k in m){ m[k]-=dt; if(m[k]<=0) delete m[k]; }
      for(const k in o.bur){ o.bur[k]-=dt; if(o.bur[k]<=0){ delete o.bur[k]; if(P.packed){ const x=E.units().find(y=>y.uid==k); if(x&&x.alive) A.acts(T,u,[{slow:P.packed,dur:2,on:'target'}],{u,tgt:x}); } } }
      for(const k in o.sp){ const e=o.sp[k]; e.t-=dt; if(e.t<=0) delete o.sp[k]; }
      for(const k in o.run){ const x=E.units().find(y=>y.uid==k); if(!x||!x.alive||!((x.stunned||0)>0)){ delete o.run[k]; delete o.hs[k]; continue; } o.run[k]+=dt; if(o.hs[k]>0){ o.hs[k]-=dt; if(o.hs[k]<=0) delete o.hs[k]; } }   // run: how long it has been stunned in a row (anyone's stun) since one of his landed; hs: his stun's time left
      for(const k of ['mom','gs','rw','snap','shelf','sigCd','stoneCd','iron']) if(o[k]>0){ o[k]=Math.max(0,o[k]-dt); if(k==='iron'&&o[k]<=0) o.ironA=null; }
      if(o.rg){ o.rg.acc+=dt; while(o.rg&&o.rg.acc>=o.rg.every-1e-9){ o.rg.acc-=o.rg.every; o.pl=Math.min(PLATE_MAX,o.pl+1); if(--o.rg.left<=0) o.rg=null; } }
      /* PLATED: Layered Hide's own (u._layT rising from 0) gives a Scar Plate; its end sheds */
      const lt=u._layT||0;
      if(lt>0&&!(o.lt>0)) T.fn.plated(A,T,u);
      else if(!(lt>0)&&o.lt>0) T.fn.shed(A,T,u,1,'pl');
      o.lt=u._layT||0;
      if(o.lt>0&&P.wth){ o.wth+=dt; if(o.wth>=1-1e-9){ o.wth-=1; A.acts(T,u,[{heal:{pct:P.wth,of:'maxHp'}}],{u}); cnt(o,'wth'); } } else o.wth=0;
      /* Ironcoil Moult: once a wave, below 40% HP */
      if(P.moult&&!o.mlt&&u.hp<0.4*u.maxHp&&o.pl>=1){ o.mlt=true; T.fn.moult(A,T,u); }
      /* the curl: Coilspring winds each 0.5 s (Tight Coil faster), it ends with its time or when the game ends it */
      if(o.curl>0){ if(has(T,COIL)){ o.acc+=dt*(1+P0(T,'coil.rate')); while(o.acc>=0.5-1e-9){ o.acc-=0.5; o.cs=Math.min(7,o.cs+1); } }
        o.curl-=dt; if(o.curl<=1e-9||!((u.drT||0)>0)) T.fn.curlEnd(A,T,u); }
      else if(o.sh.length){ o.shT-=dt; if(o.shT<=1e-9) T.fn.unshelter(A,T,u); }
      if(o.sh.length){ for(let i=o.sh.length-1;i>=0;i--) if(!o.sh[i].alive) o.sh.splice(i,1);
        if(P.coi&&T.r.se_2_2&&(u._layT||0)>0) for(const a of o.sh){ a.stunned=0; a.fearT=0; a._airT=0; a.pullT=0; }   // Curl of Iron: PLATED with him
        if(P.ums){ o.ums+=dt; if(o.ums>=1-1e-9){ o.ums-=1; for(const a of o.sh) A.acts(T,u,[{heal:{pct:P.ums,of:'tgtMaxHp'},on:'target'}],{u,tgt:a}); cnt(o,'ums'); } } } },
    wv(A,T,u){ const o=O(T), P=T.P; T.s.api=A;
      if(!o.init){ o.init=true; if(has(T,PLATE)&&P.old) o.pl=Math.min(PLATE_MAX,P.old); }   // Old Scar Plates: at the fight's first wave only
      o.rub={}; o.seam={}; o.bur={}; o.sp={}; o.brk={}; o.lk={}; o.hs={}; o.run={}; o.pre={}; o.shelfN={}; o.shelf=0; o.brkT=null;
      o.first=true; o.mlt=false; o.iwl=false; o.hl=0; o.rum=0;
      if(o.curl>0||o.sh.length){ o.curl=0; T.fn.unshelter(A,T,u); }   // the game ends the curl at the wave change (drT zeroed): no Shed, no snap
      if(P.wound&&has(T,COIL)) o.cs=Math.max(o.cs,Math.min(7,P.wound)); },
    /* ---- SCAR PLATES: each PLATED Layered Hide makes leaves one (max 10, for the fight); Plate Over Plate, Iron Where It Landed (at 6 plates, the first PLATED
       of each wave twice as long); the signature at 6 ---- */
    plated(A,T,u){ const o=O(T), P=T.P; cnt(o,'plated');
      if(has(T,PLATE)) o.pl=Math.min(PLATE_MAX,Math.floor(o.pl+1e-9)+1);
      const base=u._layT||0; let add=P0(T,'plate.add');
      if(P.iwl&&!o.iwl&&o.pl>=IWL_AT-1e-9){ o.iwl=true; add+=base; cnt(o,'iwl'); }
      if(add>0) u._layT=base+add;
      if(P.iron&&!o.ironUsed&&o.pl>=SIG_AT-1e-9) T.fn.iron(A,T,u); },
    iron(A,T,u){ const o=O(T), E=A.eng(); o.ironUsed=true; o.iron=6; u._layT=Math.max(u._layT||0,6); o.lt=u._layT; cnt(o,'iron');
      let b=null, bd=Infinity; for(const x of E.units()) if(x.alive&&x.team===u.team&&x!==u&&!x._summon){ const g=E.dist(u,x); if(g<bd){ bd=g; b=x; } } o.ironA=b; },
    moult(A,T,u){ const o=O(T), E=A.eng(), n=Math.floor(o.pl+1e-9); if(n<1) return; const L=A.pick(T,u,{team:'enemy',n:3,order:'near'},{u}); cnt(o,'moult');
      for(let i=0;i<n&&L.length;i++){ const t=L[i%L.length]; if(t.alive) A.hurt(T,u,t,0.20*atkOf(E,u)*physK(E,u,t,P0(T,'shed.ign')),'#c9a36a','thMoult'); }
      A.acts(T,u,[{heal:{pct:0.02*n,of:'maxHp'}}],{u}); o.pl=0; o.rg={left:n,every:10/n,acc:0}; },
    /* ---- SHED: the 2 nearest enemies take 15% x rank of his attack (Sharp Edges more; physical, Sharp Rain ignores armour), Flying Scale slows them; Scale Rain
       may strike again. k: the strength (Shed Season: 30% a rank) ---- */
    shed(A,T,u,k,why){ const P=T.P, o=O(T); if(!P.shed||!(k>0)) return; const E=A.eng(), L=A.pick(T,u,{team:'enemy',n:2,order:'near'},{u}); if(!L.length) return; cnt(o,'shed.'+why);
      o.shedK=k; T.fn.shed1(A,T,u,L); if(P.rain&&T.on.thShed2) A.run(T,u,'thShed2',{u,tgt:L[0]}); },
    shed1(A,T,u,L){ const P=T.P, E=A.eng(), o=O(T), x=P.shed*(1+P0(T,'shed.more'))*(o.shedK||1);
      for(const t of L){ if(!t.alive) continue; A.hurt(T,u,t,x*atkOf(E,u)*physK(E,u,t,P0(T,'shed.ign')),'#c9a36a','thShed'); if(t.alive&&P['shed.slow']) A.acts(T,u,[{slow:P['shed.slow'],dur:2,on:'target'}],{u,tgt:t}); } },
    shedAgain(A,T,u){ const L=A.pick(T,u,{team:'enemy',n:2,order:'near'},{u}); if(L.length){ cnt(O(T),'rain'); T.fn.shed1(A,T,u,L); } },
    /* ---- FORTRESS CURL: the curl lasts as the skill does (Hard Curl, Long Curl); it shelters the nearest ally within 3 m (Wider Coil farther; Two Under the Tail:
       two); its end: Shed Season, Coldharrow Strike, Long Wrap, Uncoil Snap, Full Uncoil; Coilspring armed for the next Scale Ram ---- */
    curlCast(A,T,u,c){ const o=O(T), P=T.P; o.curl=(c.o&&c.o.dur)||3.5; o.acc=0; cnt(o,'curl'); T.fn.unshelter(A,T,u);
      if(has(T,SHEL)){ const L=A.pick(T,u,{team:'ally',others:true,within:3+P0(T,'sh.r'),n:1+P0(T,'sh.n'),order:'near'},{u}); o.sh=L; o.shT=0; o.saK={};
        if(P.sa) for(const a of L) o.saK[a.uid]=P.sa*(u.armorRating||0)/Math.max(1,a.armorRating||1);
        if(L.length) cnt(o,'shelter'); } },
    curlEnd(A,T,u){ const o=O(T), P=T.P; o.curl=0; cnt(o,'curlEnd');
      if(P.season) T.fn.shed(A,T,u,P.season,'curl');
      if(P.chs) o.chs=true;
      if(P.snap&&o.cs>=4) o.snap=4;
      if(P.full&&o.cs>=7){ u.greenCd=0; cnt(o,'full'); }
      if(o.sh.length){ o.shT=T.r.se_2_2?P0(T,'wrap'):0; if(!(o.shT>0)) T.fn.unshelter(A,T,u); } },
    unshelter(A,T){ const o=O(T); o.sh=[]; o.shT=0; o.saK={}; },
    /* ---- SCALE RAM. kit: Coilspring spent if he is not curled (Wind Tight per spring, Coiled Strength's heal, Spring Loaded at 7, Loose Stone at 4), its target
       Seamed BEFORE the strike, the push (Ram Shove farther; Spring Loaded twice as far). cast: Both Blocks, Loose Stone's Rubble ---- */
    ramKit(A,T,u,c){ const o=O(T), P=T.P, E=A.eng(), t=c.tgt; o.ramSp=0; o.ramT=t||null; o.ramLand=0; o.ramLS=false; cnt(o,'ram');
      if(has(T,COIL)&&!(o.curl>0)&&o.cs>0){ const n=o.cs; o.ramSp=n; o.cs=0; cnt(o,'spent');
        if(P.coiled) A.acts(T,u,[{heal:{pct:P.coiled*n,of:'maxHp'}}],{u});
        if(P.ls&&n>=4) o.ramLS=true; }
      if(t&&t.alive&&t.team!==u.team&&has(T,SEAM)) T.fn.seamOn(A,T,u,t);
      if(c.o){ let p=(c.o.push||1.6*E.METER())+P0(T,'shove')*E.METER(); if(P.loaded&&o.ramSp>=7) p*=2; c.o.push=p; } },
    ramCast(A,T,u){ const o=O(T), P=T.P, E=A.eng(), t=o.ramT;
      if(t&&t.alive&&P.both&&on(o.seam,t)&&o.ramLand>0){ A.hurt(T,u,t,0.5*o.ramLand,'#ffd08a','thBoth'); cnt(o,'both'); }
      if(t&&o.ramLS&&has(T,RUB)){ for(const x of A.pick(T,u,{team:'enemy',of:'unit',within:2,skip:'unit'},{u,unit:t})) T.fn.rubOn(A,T,u,x); cnt(o,'looseStone'); }
      o.ramT=null; o.ramSp=0; o.ramLS=false; },
    seamOn(A,T,u,t){ const o=O(T); o.seam[t.uid]=Math.max(o.seam[t.uid]||0,5+P0(T,'seam.dur')); },
    rubOn(A,T,u,t,secs){ const o=O(T), P=T.P; if(!t||!t.alive) return; const d=secs||(4+P0(T,'rub.dur')); o.rub[t.uid]=Math.max(o.rub[t.uid]||0,d); cnt(o,'rubble');
      if(P['rub.slow']) A.acts(T,u,[{slow:P['rub.slow'],dur:d,on:'target'}],{u,tgt:t}); },
    /* ---- HIS STUNS. ccPre (ccOut): the stun the target had before. ccHit: a stun of his that landed - Scale Ram's (Bury Them +0.5 s on Rubble, Deep Burial's silence,
       Spring Loaded +0.3 s; then Rubble), the landing's (Stop Dead +0.6 s, the slope's +1 s), a talent stun; then the stun-lock (0.5 s after his stun ends) and
       never more than 4.0 s in a row of his stuns on one enemy. Added seconds land in full x (1 - its control resist), on the fixed-duration path ---- */
    ccPre(A,T,u,c){ const t=c.tgt; if(t&&c.field==='stunned') O(T).pre[t.uid]=t.stunned||0; },
    ccHit(A,T,u,c){ if(c.field!=='stunned') return; const o=O(T), P=T.P, t=c.tgt; if(!t||!t.alive||t.team===u.team) return; const cur=T.s.cur; let ext=0;
      if(!c.talent&&cur===RAM){ const rubbed=on(o.rub,t);
        if(P.bury&&rubbed){ ext+=P.bury; cnt(o,'bury'); if(P.burial) A.control(T,u,t,'silencedT',P.burial); }
        if(P.loaded&&o.ramSp>=7){ ext+=0.3; cnt(o,'loaded'); }
        if(has(T,RUB)) T.fn.rubOn(A,T,u,t); }
      if(!c.talent&&cur===ULT){ if(P.stop){ ext+=P.stop; cnt(o,'stop'); } if(o.sigOn) ext+=1; }
      const run=o.run[t.uid]||0, pre=o.pre[t.uid]||0; delete o.pre[t.uid];
      if(ext>0) t.stunned=(t.stunned||0)+ext*(1-Math.min(1,t.ctrlRes||0));
      if(run+(t.stunned||0)>RUN_MAX){ t.stunned=Math.max(pre,RUN_MAX-run); cnt(o,'runCap'); }
      if((t.stunned||0)>0){ o.hs[t.uid]=Math.max(o.hs[t.uid]||0,t.stunned); o.lk[t.uid]=Math.max(o.lk[t.uid]||0,t.stunned+STUN_LOCK); if(o.run[t.uid]==null) o.run[t.uid]=0; } },
    /* a talent stun: never on a stunned enemy, nor within 0.5 s after one of his stuns on it ended; the full written length */
    tstun(A,T,u,t,secs){ const o=O(T); if(!t||!t.alive||(t.stunned||0)>0||(o.lk[t.uid]||0)>0){ cnt(o,'tstunNo'); return false; } A.control(T,u,t,'stunned',secs); if((t.stunned||0)>0){ cnt(o,'tstun'); return true; } return false; },
    /* ---- SPLIT STONE. Each basic attack of his on an enemy adds 1 Split for 5 s (Quarry Rhythm longer; 2 on a Seamed enemy; First Swing more), at most 4. With 4,
       his next basic attack on it breaks it (Break the Seam: on a Seamed enemy the attack that brings it to 3 breaks it at once; Coldharrow Strike: the first
       after a curl). outPre makes that attack the break (its bonus, The Stone Gives' triple), hit pays out ---- */
    outPre(A,T,u,c){ const o=O(T), P=T.P, t=c.tgt; if(!c.auto||!t||t.team===u.team||!has(T,SPLIT)){ return; } o.brkT=null; o.stoneHit=false;
      const e=o.sp[t.uid], n=e?e.n:0, seamed=on(o.seam,t), gain=(seamed?2:1)+(o.first?P0(T,'first'):0);
      const brk=(P.chs&&o.chs)||n>=4-1e-9||(P.bts&&seamed&&n+gain>=3-1e-9);
      if(!brk) return; o.brkT=t; c.amt*=1+P0(T,'brk')+(seamed?P0(T,'core'):0);
      if(P.stone&&seamed&&!(o.stoneCd>0)){ c.amt*=3; o.stoneHit=true; } },
    hit(A,T,u,c){ const o=O(T), P=T.P, t=c.tgt; if(!t||t.team===u.team) return; const cur=T.s.cur;
      if(cur===RAM&&!c.proc) o.ramLand=c.amt||0;
      if((cur===ULT||cur===PATH)&&(c.amt||0)>0){ o.ultHit[t.uid]=1; if(cur===ULT) o.landHit.push(t); else if(P.line&&has(T,BUR)&&t.alive) T.fn.burOn(A,T,u,t,4+P0(T,'bur.dur')); }
      if(!c.auto||!has(T,SPLIT)) return;
      if(o.brkT===t){ T.fn.doBreak(A,T,u,c); return; }
      if(!t.alive) return; const e=o.sp[t.uid]||(o.sp[t.uid]={n:0,t:0}), gain=(on(o.seam,t)?2:1)+(o.first?P0(T,'first'):0); o.first=false;
      e.n=Math.min(4,e.n+gain); e.t=5+P0(T,'sp.dur'); cnt(o,'split'); },
    doBreak(A,T,u,c){ const o=O(T), P=T.P, E=A.eng(), t=c.tgt; o.brkT=null; o.first=false; cnt(o,'break'); delete o.sp[t.uid]; o.brk[t.uid]=4; o.hl++;
      if(o.chs){ o.chs=false; if(t.alive&&has(T,SEAM)) T.fn.seamOn(A,T,u,t); cnt(o,'coldharrow'); }
      if(P.cutter) A.acts(T,u,[{heal:{pct:P.cutter,of:'maxHp'}}],{u});
      if(P.thru) u.greenCd=Math.max(0,(u.greenCd||0)-P.thru);
      if(P.rockfall&&(c.amt||0)>0){ let b=null, bd=Infinity; for(const x of foes(E,u)){ if(x===t) continue; const g=gapM(E,t,x); if(g<3&&g<bd){ bd=g; b=x; } } if(b){ A.hurt(T,u,b,P.rockfall*c.amt,'#c9a36a','thFall'); cnt(o,'rockfall'); } }
      if(P.hammer&&t.alive&&t.hp<0.5*t.maxHp) T.fn.tstun(A,T,u,t,0.6);
      if(o.stoneHit){ o.stoneHit=false; o.stoneCd=15; cnt(o,'stone');
        for(const x of A.pick(T,u,{team:'enemy',of:'unit',within:3},{u,unit:t})){ if(has(T,RUB)) T.fn.rubOn(A,T,u,x); T.fn.seamOn(A,T,u,x); }
        u.greenCd=0; } },
    /* ---- AVALANCHE COIL. ultKit / ultTgt: Downhill = the whole metres he will roll (Head Start, Roll Again first), at most 10 (Steep Slope 13). ultPre: does
       the slope give way (signature, 10 Downhill, once every 30 s)? ultLand: Buried on the enemies the landing struck (Bury the Line: the path's too, at hit),
       Shelf Comes Down, Slope Rumble, the signature, the windows after landing (Momentum of Iron 3 s, Gathered Speed 5 s, Downhill Weight 4 s), Roll Again ---- */
    ultKit(A,T){ const o=O(T); o.landHit=[]; o.ultHit={}; o.againHit=false; o.sigOn=false; cnt(o,'ult'); },
    ultTgt(A,T,u,c){ const o=O(T), P=T.P, E=A.eng(), t=c.tgt; if(!has(T,DOWN)){ o.dh=0; return; }
      const m=t?Math.floor(E.dist(u,t)/E.METER()+1e-9):0, st=(o.again?10:0)+(o.firstUlt?P0(T,'head'):0);
      o.dh=Math.min(10+P0(T,'dh.max'),st+m); o.firstUlt=false; o.again=false; },
    ultPre(A,T){ const o=O(T); o.sigOn=!!T.P.shelfSig&&o.dh>=10-1e-9&&!(o.sigCd>0); },
    ultLand(A,T,u){ const o=O(T), P=T.P, E=A.eng();
      if(has(T,BUR)) for(const x of o.landHit) if(x.alive) T.fn.burOn(A,T,u,x,4+P0(T,'bur.dur'));
      if(P.shelf){ for(const x of o.landHit) if(x.alive) T.fn.rubOn(A,T,u,x); o.shelf=3; o.shelfN={}; }
      if(o.sigOn){ o.sigOn=false; o.sigCd=30; cnt(o,'slope');
        for(const x of foes(E,u)) if(gapM(E,u,x)<5) T.fn.burOn(A,T,u,x,3);
        if(has(T,COIL)) o.cs=7; if(E.castSlot&&u.blueAb) E.castSlot(u,'blue',u); }
      if(T.r.rc_11_2){ let n=0; for(const k in o.ultHit) n++; o.rum=Math.min(8,o.rum+n); }
      o.mom=3; o.gs=5; o.rw=4; o.dhL=o.dh;
      if(o.againHit&&P.again){ u.energy=Math.min(100,(u.energy||0)+20); o.again=true; cnt(o,'again'); }
      o.landHit=[]; o.ultHit={}; o.againHit=false; },
    againHit(A,T){ O(T).againHit=true; },
    burOn(A,T,u,t,secs){ const o=O(T); if(!t||!t.alive) return; o.bur[t.uid]=Math.max(o.bur[t.uid]||0,secs); cnt(o,'buried'); },
    /* ---- A DEATH ON THE FIELD: Rubble falls on the enemies within 2 m (20% of his attack, Slate Slide and Loose Ground more; physical; Slate Slide slows them as
       Rubble does; in the 3 s after a Shelf Comes Down landing it stuns 0.5 s, each enemy at most twice a cast); Cave-In buries the enemies within 2 m ---- */
    died(A,T,u,c){ const o=O(T), P=T.P, E=A.eng(), x=c.unit; if(!x||x.team===u.team) return;
      if(on(o.rub,x)&&has(T,RUB)){ delete o.rub[x.uid]; cnt(o,'fall');
        for(const v of A.pick(T,u,{team:'enemy',of:'unit',within:2,skip:'unit'},{u,unit:x})){ let k=0.20*(1+P0(T,'slide'))*((v.hp<0.5*v.maxHp)?1+P0(T,'loose'):1);
          A.hurt(T,u,v,k*atkOf(E,u)*physK(E,u,v,0),'#a08060','thRubble'); if(!v.alive) continue;
          if(P.slide&&P['rub.slow']) A.acts(T,u,[{slow:P['rub.slow'],dur:2,on:'target'}],{u,tgt:v});
          if(P.shelf&&o.shelf>0&&(o.shelfN[v.uid]||0)<2&&T.fn.tstun(A,T,u,v,0.5)) o.shelfN[v.uid]=(o.shelfN[v.uid]||0)+1; } }
      if(on(o.bur,x)&&P.cave){ delete o.bur[x.uid]; for(const v of A.pick(T,u,{team:'enemy',of:'unit',within:2,skip:'unit'},{u,unit:x})) T.fn.burOn(A,T,u,v,P.cave); cnt(o,'cave'); } },
    /* ---- HITS ON HIM: Ball of Iron (a Coilspring while curled), Curl of Iron (a hit while curled counts twice for Layered Hide), the signature's iron (a scale at the
       attacker for 30% of his attack) ---- */
    hurt(A,T,u,c){ const o=O(T), P=T.P, E=A.eng(), s=c.src;
      if(o.curl>0){ if(P.ball&&has(T,COIL)) o.cs=Math.min(7,o.cs+1); if(P.coi&&!((u._layT||0)>0)) u._layStk=(u._layStk||0)+1; }
      if(o.iron>0&&s&&s.alive){ A.hurt(T,u,s,0.30*atkOf(E,u)*physK(E,u,s,P0(T,'shed.ign')),'#c9a36a','thIron'); cnt(o,'ironScale'); } },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP. Every talent of his that makes a hit on him smaller multiplies here, and together they never take more than 20% off
       (DR_CAP). Fortress Curl alone takes 65% off for 3.5 s of every 9 s, so his talents' group is capped lower than other heroes' ---- */
    drK(A,T,u,src,kind,crit,dot){ const P=T.P, o=O(T), E=A&&A.eng&&A.eng(); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(crit){ cut(P['dr.crit1']); cut(P['dr.crit2']); }
      if(P['dr.bond']&&o.sh.length) cut(P['dr.bond']);
      if(P['dr.low']&&u.hp<0.3*u.maxHp) cut(P['dr.low']);
      if(P['dr.tuck']&&o.curl>0) cut(P['dr.tuck']*o.cs);
      if(P['dr.mom']&&o.mom>0) cut(P['dr.mom']);
      if(dot) cut(P['dr.dust']);
      if(src){ if(E&&P['dr.far']&&src.alive&&gapM(E,u,src)>4) cut(P['dr.far']); if(P['dr.gravel']&&on(o.rub,src)) cut(P['dr.gravel']); if(P['dr.weight']&&on(o.bur,src)) cut(P['dr.weight']); }
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ T.s.api=A; c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.crit,false); },
    myDot(A,T,u,c){ T.s.api=A; const s=c.src; if(s&&s.team===u.team) return; c.amt*=T.fn.drK(A,T,u,s,'dot',false,true); },
    /* ---- HIS TALENTS ON HITS THAT ARE NOT ON HIM (one teamIn row). His team on an enemy: Wide Seam (Seamed), Heavy Earth (Buried). An enemy on an ally of his:
       ONE capped group of 50% (Curled Around, the signature's 50%, Gravel, Weight on Them); Spiked Tail strikes back ---- */
    teamK(A,T,u,c){ const t=c.tgt, s=c.src, P=T.P, o=O(T), E=A.eng(); if(!t||!s) return;
      if(t.team!==u.team&&s.team===u.team){ let m=1; if(P.wide&&on(o.seam,t)) m*=1+P.wide; if(P.heavy&&on(o.bur,t)) m*=1+P.heavy; c.amt*=m; return; }
      if(t.team!==u.team||t===u||s.team===u.team) return;
      const k=T.fn.allyK(A,T,u,t,s); if(k<1) c.amt*=k;
      if(P.spike&&o.sh.indexOf(t)>=0&&s.alive){ A.hurt(T,u,s,P.spike*(1+P0(T,'spike.more'))*atkOf(E,u)*physK(E,u,s,0),'#c9a36a','thSpike'); cnt(o,'spike'); } },
    allyK(A,T,u,t,s){ const P=T.P, o=O(T); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P['sh.dr']&&o.sh.indexOf(t)>=0) cut(P['sh.dr']);
      if(P.iron&&o.iron>0&&o.ironA===t) cut(0.5);
      if(s){ if(P['dr.gravel']&&on(o.rub,s)) cut(P['dr.gravel']); if(P['dr.weight']&&on(o.bur,s)) cut(P['dr.weight']); }
      return Math.max(1-ALLY_CAP,k); },
    healCut(A,T,u,c){ const x=c.unit, o=O(T), P=T.P; if(!x||x.team===u.team||!on(o.bur,x)) return; c.amt*=(1-P0(T,'bur'))*(1-P0(T,'dust')); },
    /* ---- HIS CONTROL-SHORTENING TALENTS, ONE GROUP of at most 40%: Layered Will (every control), Stony Look and Blunt Head (silences), Ball of Iron (stuns while
       curled) ---- */
    ten(A,T,u,c){ const P=T.P, o=O(T); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      cut(P.ten); if(c.field==='silencedT'){ cut(P.sil1); cut(P.sil2); } if(c.field==='stunned'&&P.ball&&o.curl>0) cut(0.30);
      c.amt*=Math.max(1-CC_CAP,k); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/56 - THARL IRONCOIL - talent decisions.md) */
  ruling:{}
};
