/* MAREN - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Maren")
   His real kit (the code, not the tooltip wording; a back-row Mage, every skill reads ability power, his skills' damage is magic):
   - Tide Pool ('ashfall', green, cd 8, delivered: it falls 0.55 s, then lands where his target stood at the press): a ground hazard of 3 m, 4 s, that every
     0.5 s deals 50% of his ability power x skill level to each enemy whose CENTRE is inside it and writes a slow on it (the control table's 3.0 s, cut to
     2.1 s; the hazard writes no slow strength, so the slow is the engine's default 45%). Its ticks go straight through damage(): no hit hooks see them.
   - Tsunami ('tidalsurge', blue, cd 10, delivered as a form 0.35 s after the press): every enemy whose centre is within 3.4 m of HIS centre takes 110% of his
     ability power x skill level (magic), a slow (ccApply: 2.1 s) and a shove of 1.6 m away from him (a teleport; an immovable enemy is not moved).
     MEASURED (the reach audit of 14 Nov): he stands about 10 m back, so it hits nobody on 163 of 177 casts. Release v1391 (another branch) centres it on his
     TARGET with the same radius. Nothing here changes that: his Tsunami talents are rows on the wave's hits, its slows and its shoves, whatever its centre
     (the page passes the centre to the `at` hook; v1391's merge passes its new centre there).
   - Maelstrom ('swamproot', ultimate, player-aimed, else his target): every enemy whose centre is within 7 m of the centre takes 160% of his ability power and
     is ROOTED - the game's root is its stun field: ccApply 'stunned' with the area table's 4.0 s, cut to 2.8 s (the authored 2.5 s is not used).
   - Deep Reserves (passive 'tidereserve'): every tick he regains 1% of his max HP x passMul a second, written straight onto his HP (no healUnit), and 1 x passMul
     energy a second.
   Fouled, Tangles, Fathoms, Bracing, Ballast, the water (High / Low), Returns and the deep sea exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/38 - MAREN - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const TP='ashfall', TS='tidalsurge', MS='swamproot';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const FO=['sf_1_1','sf_3_1','sf_5_1','sf_6_1','sf_8_1','sf_9_1','sf_12_1','sf_13_3'];                                         // Fouled (and its tangles)
const FA=['sf_1_4','sf_2_4','sf_3_4','sf_4_4','sf_5_4','sf_6_4','sf_7_3','sf_7_4','sf_10_4','sf_11_2','sf_11_3','sf_n2','sf_13_3'];   // Fathoms
const BR=['oh_1_1','oh_2_1','oh_3_1','oh_6_1','oh_5_2','oh_8_1','oh_9_1','oh_10_2','oh_12_3','oh_13_2'];                      // Bracing
const BAL=['oh_1_4','oh_n1','oh_4_4','oh_6_4','oh_8_4','oh_10_4','oh_11_4'];                                                   // Ballast
const WATER=['gb_1_3','gb_1_4','gb_2_3','gb_3_3','gb_5_3','gb_n1','gb_6_3','gb_7_3','gb_8_3','gb_10_3','gb_11_3','gb_12_2','gb_13_2'];   // the water (High / Low; Tidal Ballast's link reads it only with Ebb and Flow learned)
const RET=['gb_1_1','gb_2_1','gb_4_1','gb_6_1','gb_9_1','gb_12_1','gb_13_2'];                                                 // Returns
const DRG=['oh_1_1','sf_n1','oh_3_2','oh_4_3','oh_4_4','oh_7_4','oh_11_3','oh_12_2','sf_5_4','gb_n1','gb_10_1','gb_11_3','gb_4_2'];   // his damage reduction: ONE capped group (40%)
const ADRG=['gb_4_2','gb_11_3','oh_5_1','sf_5_4','oh_4_3'];                                                                    // his allies' damage reduction from his talents: ONE capped group (30%)
const MROOT=['sf_8_2','oh_8_2','sf_9_1','sf_11_3','sf_12_3','oh_12_2','oh_10_2','sf_13_3','oh_9_2','gb_13_2','sf_11_2'];        // rows on Maelstrom's roots
const LOCK=['sf_1_1','sf_13_3','sf_10_2','sf_11_2','sf_3_4'].concat(MROOT);                                                     // the stun-lock bookkeeping (every stun of his)
const REGEN=['oh_2_4','oh_n1','oh_13_2','oh_6_3','oh_8_1','gb_1_3','gb_3_2','oh_5_4','gb_9_4','gb_6_3'];                        // his per-second heals and energy (one budget)
const WMAX=6, DR_CAP=0.40, ADR_CAP=0.30, REGEN_CAP=0.012, ROOT_TOP=4.0;
const S=T=>T.s.mr||(T.s.mr={pools:[],deep:[],mae:null,inTP:{},inW:{},wasTP:{},wasW:{},left:{},wl:{},fc:{},rip:{},dp:{},tg:{},foC:{},lastE:{},sb:{},se:{},ss:{},bal:0,keep:0,drRate:0,id:0,w:null,mc:null,ns:{}});
const rk=(T,id)=>T.r[id]||0;
const P0=(T,k)=>T.P[k]||0;
const isFoe=(u,x)=>!!x&&x.team!==u.team;
const alliesOf=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team===u.team&&!x._summon);
const foesOf=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team);
const fa=(A,T,u,x)=>A.ustGet(T,u,x,'mrFa');
const ap=u=>(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1);
/* his Tide Pools: the hazards his skill put down (the engine's own objects), alive while they burn and still on the field's list */
function livePools(A,o){ const H=A.eng().hazards?A.eng().hazards():[]; o.pools=o.pools.filter(p=>p.h.life>0&&H.indexOf(p.h)>=0); return o.pools; }
const inPool=(p,x)=>Math.hypot(x.x-p.h.x,x.y-p.h.y)<=p.h.r;                                   // as the hazard itself measures: the centre inside
const inDeep=(A,z,x)=>A.eng().now()<z.until&&Math.hypot(x.x-z.x,x.y-z.y)<z.r;                 // as Maelstrom measures
/* a talent root (Fouled's tangle, the deep sea's second root): his talent stuns land at their full written length on the fixed path (no resist roll), never on an
   enemy that is stunned now, nor within 0.5 s after one of his stuns on it ended (mark 'mrLk'). An enemy immune to it (the game's Unstoppable) is blocked: Salt Mind */
function troot(A,T,u,t,secs){ if(!t||!t.alive||!isFoe(u,t)) return false; if(t.stunImmune){ T.fn.blocked(A,T,u,t); return false; }
  if((t.stunned||0)>0||A.markOf(u,t,'mrLk')) return false; const st=T.s.mrSt||(T.s.mrSt={n:0,gap:1e9,on:0,dis:0}), o=S(T), now=A.eng().now();   // mrSt: a count the stun-lock test reads (no fight reads it)
  if(o.se[t.uid]!=null) st.gap=Math.min(st.gap,now-o.se[t.uid]); if((t.stunned||0)>0) st.on++;
  A.control(T,u,t,'stunned',secs); if((t.stunned||0)>0) st.n++; return (t.stunned||0)>0; }
/* the water: High for 8 s (+ Spring Water), Low for 8 s, over and over from each wave's start. A turn fires 'mrTurn' (ctx.to = 'H' | 'L') */
function wTurn(A,T,u,to,len){ const o=S(T), w=o.w; w.ph=to; w.t=0; w.len=len!=null?len:(to==='H'?8+P0(T,'ef.spring'):8); if(T.on.mrTurn) A.run(T,u,'mrTurn',{u,tgt:u.target,to}); }
const high=T=>{ const w=S(T).w; return !!w&&w.ph==='H'; }, low=T=>{ const w=S(T).w; return !!w&&w.ph==='L'; };
module.exports={
  hero:'maren',
  casting:true,                         // rows ask which of his skills a hit, a slow or a root comes from
  points:true,                          // rows read where his skills land: the at hook runs for Tide Pool, Tsunami and Maelstrom
  watch:true,                           // deaths (Returns, The Bottom), hits and heals on every unit (his allies' group, Leaden Water, Brackish)
  states:{
    mrBr:{max:10,dur:P('br.dur',5)},                                 // Bracing: all of it drops that long after the last hit he took
    mrFa:{unit:true,max:WMAX,dur:1e9}                                // Fathoms on an enemy (his scan sinks and raises them)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'wave',do:[{fn:'wave'}]},                                                                                 // a wave's start: his water and his pools begin again (the fight clock starts again)
    {on:'waveEnd',reqAny:BAL,do:[{fn:'waveEnd'}]},                                                                // Ballast Kept
    {on:'tick',do:[{fn:'tk'}]},                                                                                   // pools, water, Fathoms, Fouled, tangles, the deep sea, the heals of each second, Ballast's shield
    {on:'at',skill:TP,do:[{fn:'atTP'}]},                                                                          // a Tide Pool is down
    {on:'at',skill:TS,do:[{fn:'atTS'}]},                                                                          // the wave breaks
    {on:'at',skill:MS,do:[{fn:'atMS'}]},                                                                          // the water closes (Maelstrom)
    {on:'hit',if:{casting:[TS,MS],targetTeam:'enemy'},do:[{fn:'wet'}]},                                           // struck by Tsunami or Maelstrom: in his water for 2 s (Returns)
    {on:'hit',if:{casting:MS,targetTeam:'enemy'},do:[{fn:'maeHit'}]},                                             // the enemies Maelstrom struck (a root it did not land: Salt Mind)
    {on:'ccHit',reqAny:MROOT,if:{casting:MS,cc:['stunned']},do:[{fn:'maeRoot'}]},                                 // Maelstrom's root on an enemy: lengthened, marked, Fouled, sunk
    {on:'ccHit',reqAny:LOCK,if:{cc:['stunned']},do:[{fn:'lock'}]},                                                // every stun of his: the stun-lock rule's mark
    {on:'cast',skill:MS,do:[{fn:'maeCast'}]},                                                                     // after Maelstrom: what it rooted
    {on:'pass',skill:'tsPush',reqAny:FO,do:[{fn:'foul',key:'ts'}]},                                               // Fouled: the enemies Tsunami shoves
    {on:'hurt',reqAny:BR,if:{srcTeam:'enemy'},do:[{stack:'mrBr',add:1,full:[{fn:'groan'}]}]},                     // Bracing: each hit he takes
    {on:'num',skill:'drsv',do:[{fn:'drsv'}]},                                                                     // Deep Reserves' heal this tick (talent extras, Ballast)
    {on:'absorb',reqAny:BAL,do:[{fn:'balAbs'}]},                                                                  // a hit on his shield: what is left of Ballast
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                        // his damage-reduction talents: ONE capped group
    {on:'teamIn',reqAny:ADRG,if:{targetTeam:'ally',srcTeam:'enemy'},do:[{fn:'allyDr'}]},                          // his talents on his allies: ONE capped group
    {on:'death',reqAny:RET.concat(['sf_10_4']),do:[{fn:'died'}]}                                                  // Returns, The Bottom
  ],
  talents:{
    /* ============================== SIX FATHOMS ============================== */
    sf_1_1:[ {param:'fo.root',add:R(0.4)} ],                                                                      // Fouled: two Fouled enemies within 2 m tangle, both rooted 0.4 s a rank (scan)
    sf_3_1:[ {param:'fo.dur',add:R(0.4)} ],                                                                       // Tangled Line: Fouled 0.4 s longer a rank
    sf_8_1:[ {param:'fo.reach',add:R(0.5)} ],                                                                     // Fouled Again: they tangle 0.5 m farther a rank
    sf_5_1:[ {stat:{move:R(-0.02)},to:{team:'enemy',has:'mrFo'}} ],                                                // Snarled: Fouled enemies 2% slower a rank
    sf_12_1:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'mrFo'}} ],                                               // Weed Wrapped: Fouled enemies attack 3% slower a rank
    sf_6_1:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'mrTg'},more:R(0.03)} ],                // Knotted: tangled and rooted, 3% more from his team a rank (his hits too)
    sf_9_1:[ {param:'fo.anchor',add:1} ],                                                                         // Fouled Anchor: Maelstrom Fouls every enemy it roots (maeRoot)
    sf_1_4:[ {param:'fa.rate',add:1},{stat:{aspd:R(-0.006)},to:{team:'enemy',ust:{mrFa:1}},per:{ust:'mrFa'}} ],   // Fathoms: 1 a second in Tide Pool; each attacks 0.6% slower a rank
    sf_4_4:[ {stat:{move:R(-0.006)},to:{team:'enemy',ust:{mrFa:1}},per:{ust:'mrFa'}} ],                            // Heavy Limbs: each Fathom 0.6% slower movement a rank
    sf_2_4:[ {param:'fa.land',add:R(1)} ],                                                                        // Deeper Pool: 1 more Fathom a rank when Tide Pool lands on it (atTP)
    sf_6_4:[ {param:'fa.silt',add:R(0.3)} ],                                                                      // Bottom Silt: Fathoms lost 0.3 s slower a rank outside the water
    sf_7_3:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{fn:'sinkHit'}]} ],                                   // Sinking Shot: each basic attack sinks its target 1 Fathom
    sf_n2:[ {param:'fa.back',add:R(1)} ],                                                                         // Back in the Water: out of Tide Pool and into his water within 4 s: 1 Fathom a rank (scan)
    sf_11_3:[ {param:'fa.close',add:R(2)} ],                                                                      // Closing Water: enemies Maelstrom roots sink 2 Fathoms a rank (maeRoot)
    sf_11_2:[ {param:'fa.salt',add:R(2)} ],                                                                       // Salt Mind: a root of his blocked: 2 Fathoms a rank instead, once per enemy every 12 s
    sf_10_4:[ {param:'fa.bottom',add:1} ],                                                                        // The Bottom: an enemy that dies at 6 Fathoms passes them on (died)
    sf_3_4:[ {param:'fa.numb',add:1} ],                                                                           // Numb Fingers: at 6 Fathoms it cannot basic attack for 1.2 s, once per enemy every 8 s (fa)
    sf_5_4:[ {param:'dr.ache',add:R(0.015)} ],                                                                    // Cold Ache: enemies at 3 Fathoms or more deal 1.5% less a rank (both groups)
    sf_7_4:[ {on:'out',if:{targetUst:{mrFa:6}},more:R(0.02)} ],                                                    // Six Fathoms Down: 2% more from Maren a rank on enemies at 6 Fathoms
    sf_2_3:[ {on:'kit',skill:TP,opt:{radius:{addM:R(0.1)}}} ],                                                     // Wide Pool: 0.1 m wider a rank
    sf_4_3:[ {on:'kit',skill:TP,opt:{dur:{add:R(0.3)}}} ],                                                         // Standing Water: 0.3 s longer a rank
    sf_9_3:[ {on:'kit',skill:TP,opt:{dps:{more:R(0.04)}}} ],                                                       // Cold Pool: 4% more damage a rank
    sf_5_2:[ {param:'tp.deep',add:1} ],                                                                           // Deep Pool (PICK ONE): its slow twice as strong for its first 1.5 s (scan; at most 80%)
    sf_5_3:[ {param:'tp.twin',add:1} ],                                                                           // Twin Pools (PICK ONE): a second 2 m pool on the enemy farthest from the first (atTP)
    sf_n1:[ {param:'dr.kd',add:R(0.01)} ],                                                                        // Knee Deep: 1% less a rank from enemies in his Tide Pool or Maelstrom's circle
    sf_2_2:[ {on:'cd',skill:'blue',add:R(-0.5)} ],                                                                 // Ready Wave: Tsunami 0.5 s shorter a rank
    sf_4_2:[ {on:'num',skill:'tsPush',addM:R(0.2)} ],                                                              // Long Push: 0.2 m farther a rank
    sf_6_3:[ {on:'out',if:{auto:true,fn:'tgtInTP'},more:R(0.04)} ],                                                // Grey Ball: his basic attacks 4% more a rank on enemies in Tide Pool
    sf_7_2:[ {on:'out',if:{casting:MS},more:R(0.03)} ],                                                            // Whirl: Maelstrom 3% more a rank
    sf_8_2:[ {param:'mae.root',add:R(0.1)} ],                                                                     // Long Root: Maelstrom's root 0.1 s longer a rank (maeRoot, at most 4.0 s)
    sf_8_4:[ {on:'teamHeal',if:{fn:'unitFoeInTP'},less:R(0.04)} ],                                                 // Brackish: enemies in Tide Pool receive 4% less healing a rank
    sf_9_2:[ {on:'cd',skill:'green',less:R(0.01)},{on:'cd',skill:'blue',less:R(0.01)} ],                            // Tide Clock: 1% shorter a rank
    sf_10_2:[ {on:'ccHit',if:{cc:['stunned']},do:[{energy:R(1),on:'self'}]} ],                                     // Ebb Energy: each enemy he roots, 1 energy a rank
    sf_11_4:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',fn:'tgtInTP'},more:R(0.015)} ],                   // Leaden Water: enemies in Tide Pool take 1.5% more a rank from his team
    sf_12_3:[ {param:'mae.hold',add:R(0.05)} ],                                                                   // Holding Water: 5% slower a rank for 2 s after Maelstrom's root (maeRoot / msEnd)
    sf_13_3:[ {param:'sig.deep',add:1} ],                                                                         // Where the Lark Went Down (SIGNATURE): the deep sea (atMS, scan)
    /* ============================== THE OLD HULL ============================== */
    oh_1_1:[ {param:'dr.br',add:R(0.003)} ],                                                                      // Bracing: each 0.3% less a rank (his group)
    oh_2_1:[ {param:'br.dur',add:R(1)} ],                                                                         // Long Brace: 1 s longer a rank
    oh_3_1:[ {param:'br.groan',add:1} ],                                                                          // Groan: at 10 Bracing enemies within 3 m are pushed 1.5 m, Bracing drops to 5
    oh_6_1:[ {stat:{mr:R(0.003)},per:'mrBr'} ],                                                                    // Iron Ribs: each Bracing 0.3% magic resist a rank
    oh_8_1:[ {param:'rg.song',add:R(0.004)} ],                                                                    // Hull Song: at 10 Bracing 0.4% of his max HP a second a rank (regen budget)
    oh_12_3:[ {on:'out',if:{auto:true,stackMin:{mrBr:5}},more:R(0.06)} ],                                           // Swell: 5 Bracing or more, basic attacks 6% more a rank
    oh_5_2:[ {on:'tick',if:{stackMin:{mrBr:5}},do:[{timer:'_gearImmovableT',min:0.1,on:'self'}]} ],                // Anchor Down (PICK ONE): cannot be pushed, pulled or knocked at 5 Bracing or more
    oh_9_1:[ {on:'lethal',once:'fight',do:[{undying:0},{stack:'mrBr',set:'max'}]} ],                               // Last to Sink: once a fight, 1 HP and full Bracing
    oh_10_2:[ {on:'tick',period:1,if:{fn:'maeHolds'},do:[{stack:'mrBr',add:R(2)}]} ],                              // Drawn Down: while Maelstrom's root holds an enemy, 2 Bracing a second a rank
    oh_1_4:[ {param:'bal.max',add:R(0.04)} ],                                                                     // Ballast: Deep Reserves' overflow stored as a shield, up to 4% of his max HP a rank
    oh_8_4:[ {param:'bal.max',add:R(0.02)} ],                                                                     // Full Ballast: 2% more a rank
    oh_n1:[ {param:'bal.tidal',add:0.10} ],                                                                       // Tidal Ballast (LINK): Deep Reserves 10% more while he holds Ballast; with Ebb and Flow: Low Water gives 5 energy
    oh_4_4:[ {param:'dr.cau',add:R(0.015)} ],                                                                     // Caulked: holding Ballast, 1.5% less a rank
    oh_6_4:[ {param:'bal.burst',add:R(0.20)} ],                                                                   // Ballast Burst: Ballast breaks: enemies within 3 m take 20% of his ability power a rank
    oh_10_4:[ {param:'bal.keep',add:R(0.10)} ],                                                                   // Ballast Kept: 10% a rank kept between waves
    oh_11_4:[ {param:'bal.share',add:1} ],                                                                        // Shared Ballast: Ballast full: the overflow shields the lowest-HP ally within 6 m
    oh_2_3:[ {on:'hit',if:{casting:TS,targetTeam:'enemy'},do:[{fn:'shoulder'}]} ],                                 // Shouldered Wave: 1% of his max HP a rank for each enemy it hits (3 at most)
    oh_2_4:[ {param:'rg.bilge',add:R(0.001)} ],                                                                   // Steady Bilge: Deep Reserves 0.1% of his max HP a second more a rank (regen budget)
    oh_3_2:[ {param:'dr.keel',add:R(0.02)} ],                                                                     // Keel: 2% less a rank from enemies he pushed in the last 4 s
    oh_3_4:[ {on:'ccIn',less:R(0.04)} ],                                                                           // Briny Will: controls on him 4% shorter a rank (20% at most: its own full rank)
    oh_4_2:[ {param:'sf.k',add:R(0.15)} ],                                                                        // Stand Fast: pushes, pulls and knocks move him 15% less a rank (tk)
    oh_4_3:[ {param:'dr.hw',add:R(0.04)} ],                                                                       // Hull Wake: enemies Tsunami pushes deal 4% less a rank for 3 s (both groups)
    oh_8_2:[ {param:'mae.root',add:R(0.1)} ],                                                                     // Deep Root: Maelstrom's root 0.1 s longer a rank
    oh_5_3:[ {on:'num',skill:'tsPush',addM:R(0.2)} ],                                                              // Long Shoulder: Tsunami pushes 0.2 m farther a rank
    oh_6_3:[ {param:'rg.take',add:R(0.005)} ],                                                                    // Taking Water: in his own Tide Pool, 0.5% of his max HP a second a rank (regen budget)
    oh_5_4:[ {param:'en.bilge',add:R(0.2)} ],                                                                     // Bilge Pump: Deep Reserves 0.2 more energy a second a rank
    oh_7_3:[ {on:'skillTgt',skill:TP,if:{atLeast:{n:3,of:{team:'enemy',within:4}}},do:[{retarget:'self'}]} ],      // Home Water: 3 enemies within 4 m: Tide Pool lands on his own spot
    oh_7_4:[ {stat:{move:R(-0.02)}},{param:'dr.rl',add:R(0.015)} ],                                                 // Riding Low: 2% slower, 1.5% less damage a rank
    oh_5_1:[ {on:'cast',skill:TS,do:[{window:'mrBw',dur:3}]},{param:'adr.bw',add:0.30} ],                          // Breakwater (PICK ONE): allies behind him 30% less for 3 s after Tsunami
    oh_9_2:[ {param:'mae.sea',add:R(0.01)} ],                                                                     // Taking the Sea: Maelstrom heals him 1% of his max HP a rank per enemy it roots (maeCast)
    oh_9_3:[ {on:'ccHit',if:{casting:TS,cc:['slow']},do:[{slowMore:R(0.03),on:'target'}]} ],                       // Pushback: Tsunami's slow 3% stronger a rank
    oh_11_1:[ {on:'cd',skill:'green',less:R(0.01)},{on:'cd',skill:'blue',less:R(0.01)} ],                           // Unhurried Tide: 1% shorter a rank
    oh_11_3:[ {param:'dr.bh',add:R(0.015)} ],                                                                     // Barnacle Hide: 1.5% less a rank from basic attacks
    oh_12_1:[ {on:'wave',do:[{heal:{pct:R(0.015),of:'maxHp'},on:'self'}]} ],                                       // Old Timber: 1.5% of his max HP a rank when a wave starts
    oh_12_2:[ {param:'dr.wh',add:R(0.02)} ],                                                                      // Weathered Hull: enemies Maelstrom roots deal 2% less a rank to him for 4 s
    oh_13_2:[ {on:'cast',skill:MS,do:[{window:'mrHull',dur:6}]},                                                   // The Hull Holds (SIGNATURE): 6 s of hull
             {on:'hurt',if:{window:'mrHull',srcTeam:'enemy'},do:[{push:'source',m:1.5,secs:0.3},{slow:0.30,dur:1,on:'source'}]} ],
    /* ============================== WHAT THE SEA GIVES BACK ============================== */
    gb_1_1:[ {param:'ret.k',add:R(0.01)} ],                                                                       // Returns: 1% of the dead enemy's max HP a rank to his lowest-HP ally
    gb_2_1:[ {param:'ret.nrg',add:R(2)} ],                                                                        // Unhurried Return: that ally 2 energy a rank
    gb_4_1:[ {param:'ret.gen',add:R(0.15)} ],                                                                     // Generous Sea: the second-lowest 15% of it a rank
    gb_6_1:[ {param:'ret.me',add:R(1)} ],                                                                         // Washed Ashore: Maren 1 energy a rank
    gb_9_1:[ {param:'ret.late',add:R(0.4)} ],                                                                     // Late Return: 0.4 s a rank after leaving his water
    gb_12_1:[ {param:'ret.kelp',add:R(0.03)} ],                                                                   // Kelp Wrap: that ally a 3%-of-its-max-HP shield a rank for 3 s
    gb_1_3:[ {param:'ef.k',add:R(0.001)},{param:'ef.e',add:R(0.02)} ],                                             // Ebb and Flow: High Water 0.1% a second a rank; Low Water energy 2% faster a rank
    gb_2_3:[ {param:'ef.spring',add:R(1)} ],                                                                      // Spring Water: High Water 1 s longer a rank
    gb_1_4:[ {on:'mrTurn',do:[{window:'mrSs',dur:3}]},{stat:{apow:R(0.02)},if:{window:'mrSs'}} ],                  // Salt Sense: 3 s after the water turns, 2% more ability power a rank
    gb_3_3:[ {on:'mrTurn',do:[{heal:{pct:0.06,of:'tgtMaxHp'},on:'lowestAlly'}]} ],                                 // Turn of the Water: the ally with the least HP healed 6% of its max HP
    gb_8_3:[ {on:'mrTurn',do:[{cd:'green',add:R(-0.3)},{cd:'blue',add:R(-0.3)}]} ],                                // Turning Point: his cooldowns 0.3 s shorter a rank
    gb_10_3:[ {param:'ef.moon',add:R(0.03)} ],                                                                    // Full Moon Water: High Water's healing 3% stronger a rank
    gb_6_3:[ {param:'ef.slack',add:R(0.03)} ],                                                                    // Slack Water: Low Water's energy 3% stronger a rank
    gb_7_3:[ {param:'ef.reach',add:R(0.5)} ],                                                                     // Rising Water: High Water's healing reaches 0.5 m farther a rank
    gb_5_3:[ {on:'out',if:{fn:'abilHigh'},more:R(0.02)} ],                                                         // High Water Bite: at High Water his abilities 2% more a rank
    gb_n1:[ {param:'dr.eg',add:R(0.02)} ],                                                                        // Ebb Guard: at Low Water 2% less a rank
    gb_11_3:[ {param:'dr.kw',add:R(0.02)} ],                                                                      // King Water: at High Water allies within 6 m 2% less a rank (both groups)
    gb_12_2:[ {param:'ef.called',add:R(1)} ],                                                                     // Called Water: Maelstrom turns the water to High, 1 s longer a rank (maeCast)
    gb_3_2:[ {param:'tp.heal',add:R(0.003)} ],                                                                    // Healing Pool: allies in Tide Pool 0.3% of their max HP a second a rank (regen budget)
    gb_8_2:[ {param:'tp.still',add:R(0.05)} ],                                                                    // Still Pool: Tide Pool's healing 5% stronger a rank
    gb_4_2:[ {param:'dr.cw',add:R(0.02)} ],                                                                       // Calm Water: allies in Tide Pool 2% less a rank (both groups)
    gb_4_4:[ {on:'cd',skill:'green',add:R(-0.4)} ],                                                                // Ready Pool: Tide Pool 0.4 s shorter a rank
    gb_5_1:[ {param:'tp.rip',add:1} ],                                                                            // Rip Current (PICK ONE): an enemy walking out is pulled 1 m back in, once
    gb_5_2:[ {on:'skillTgt',skill:TP,if:{fn:'loneFoe'},do:[{fn:'shallow'}]} ],                                     // Shallows (PICK ONE): one enemy in reach: Tide Pool lands under the lowest-HP ally and heals twice as fast
    gb_7_2:[ {stat:{ctrl:R(0.03)},to:{team:'ally',fn:'allyInTP'}} ],                                               // Clear Pool: allies in Tide Pool 3% more control resist a rank (15% at most)
    gb_6_4:[ {param:'ts.gentle',add:R(0.10)} ],                                                                   // Gentle Wave: Tsunami heals the allies it passes for 10% of his ability power a rank (atTS)
    gb_7_4:[ {param:'ts.carry',add:1} ],                                                                          // Carrying Wave: allies in its wave carried 1 m toward him and freed of one slow or root (atTS)
    gb_9_2:[ {on:'tick',each:{team:'ally'},edge:true,if:{targetHpBelow:0.30},do:[{fn:'sanct'}]} ],                 // Sanctuary Pool: once a wave, an ally below 30%: a Tide Pool under it and 10% of its max HP
    gb_9_4:[ {param:'en.share',add:R(0.1)} ],                                                                     // Shared Reserves: the ally with the least energy 0.1 energy a second a rank
    gb_10_1:[ {param:'dr.ck',add:R(0.03)} ],                                                                      // Cold Kindness: an ally below 50%, Maren 3% less a rank
    gb_10_4:[ {on:'cd',skill:'green',less:R(0.01)},{on:'cd',skill:'blue',less:R(0.01)} ],                           // Long Breath: 1% shorter a rank
    gb_11_2:[ {param:'mae.gentle',add:R(0.01)} ],                                                                 // Gentle Maelstrom: allies inside its circle 1% of their max HP a rank (atMS)
    gb_12_4:[ {stat:{armor:R(0.01)},to:{team:'ally',within:4}} ],                                                  // Hold Fast: allies within 4 m 1% more armor a rank
    gb_13_2:[ {param:'sig.ret',add:1} ]                                                                           // Twenty-Nine Returned (SIGNATURE) (maeCast)
  },
  ruling:{},
  fn:{
    /* ---- a wave's start: the fight clock starts at 0 again, the field is new; his water and pools begin again; Ballast Kept puts back what was kept ---- */
    wave(A,T,u){ const o=S(T), keep=o.keep; T.s.mr=null; T.s.mrA=A; const n=S(T); n.keep=0; n.bal=0;   // mrA: the runtime API, kept for the 95% instrument's tick-by-tick reading of drK (a test reads it; no fight does)
      if(T.st&&WATER.some(id=>T.r[id])) n.w={ph:'H',t:0,len:8+P0(T,'ef.spring')};
      if(keep>0){ n.bal=keep; u.shield=Math.max(u.shield||0,keep); u.shieldT=Math.max(u.shieldT||0,1); } },
    waveEnd(A,T,u){ const o=S(T); o.keep=(o.bal||0)*Math.min(1,P0(T,'bal.keep')); },
    /* ---- once a tick: everything his talents read about the field ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), now=E.now(), dt=c.dt||0, M=E.METER(); const F=foesOf(A,u), pools=livePools(A,o);
      o.deep=o.deep.filter(z=>now<z.until); if(o.mae&&now>=o.mae.until) o.mae=null;
      const inTP={}, inW={}, inDp={};
      for(const x of F){ let p=false; for(const q of pools) if(inPool(q,x)){ p=true; break; } let d=false; for(const z of o.deep) if(inDeep(A,z,x)){ d=true; inDp[x.uid]=z; break; }
        if(p) inTP[x.uid]=1; if(p||d) inW[x.uid]=1; if(p||d) o.wl[x.uid]=Math.max(o.wl[x.uid]||0,now); }
      /* Fathoms: 1 a second standing in Tide Pool; outside his water 1 lost every second (+ Bottom Silt); the deep sea 1 every 0.5 s */
      const FAon=FA.some(id=>T.r[id]);
      if(FAon) for(const x of F){ const k=o.fc[x.uid]||(o.fc[x.uid]={i:0,o:0,d:0}), n=fa(A,T,u,x);
        if(inTP[x.uid]&&P0(T,'fa.rate')){ k.i+=dt; k.o=0; while(k.i>=1-1e-9){ k.i-=1; T.fn.sink(A,T,u,x,1); } } else k.i=0;
        if(inDp[x.uid]){ k.d+=dt; k.o=0; while(k.d>=0.5-1e-9){ k.d-=0.5; T.fn.sink(A,T,u,x,1); } } else k.d=0;
        if(!inW[x.uid]&&n>0){ k.o+=dt; const per=1+P0(T,'fa.silt'); while(k.o>=per-1e-9&&fa(A,T,u,x)>0){ k.o-=per; A.ustPut(T,u,x,'mrFa',fa(A,T,u,x)-1); } }
        if(!inW[x.uid]&&!(fa(A,T,u,x)>0)) k.o=0; }
      /* Back in the Water: out of a Tide Pool, into any of his water within 4 s; Rip Current: walking out of a pool, pulled 1 m back toward its centre, once a pool */
      if(P0(T,'fa.back')) for(const x of F){ if(o.wasTP[x.uid]&&!inTP[x.uid]) o.left[x.uid]=now;
        if(inW[x.uid]&&!o.wasW[x.uid]&&o.left[x.uid]!=null&&now-o.left[x.uid]<=4+1e-9){ delete o.left[x.uid]; T.fn.sink(A,T,u,x,P0(T,'fa.back')); } }
      if(P0(T,'tp.rip')) for(const q of pools){ const was=q.in||{}, cur={}; for(const x of F){ if(inPool(q,x)) cur[x.uid]=1;
          else if(was[x.uid]&&!(q.rip&&q.rip[x.uid])){ (q.rip||(q.rip={}))[x.uid]=1; A.acts(T,u,[{pull:'target',to:'pt',m:1,secs:0.3}],{u,tgt:x,pt:{x:q.h.x,y:q.h.y,pt:true}}); } }
        q.in=cur; }
      /* Deep Pool: for its first 1.5 s, the pool's slow on an enemy in it is twice as strong (the engine's default 45% -> 80% at most) */
      if(P0(T,'tp.deep')) for(const q of pools){ if(now-q.born>1.5+1e-9) continue; for(const x of F){ if(!inPool(q,x)||!((x.slow||0)>0)) continue; const cur=x.slowMul==null?1:x.slowMul;
          if(cur>0.20){ o.dp[x.uid]={was:x.slowMul,until:q.born+1.5}; x.slowMul=0.20; } } }
      for(const id in o.dp){ const e=o.dp[id]; if(now<e.until) continue; const x=F.find(f=>String(f.uid)===id); if(x&&x.slowMul===0.20) x.slowMul=e.was; delete o.dp[id]; }
      /* the deep sea: Fouled while in it */
      if(T.r.sf_13_3) for(const x of F) if(inDp[x.uid]) T.fn.foulOn(A,T,u,x,'ds'+inDp[x.uid].id);
      o.wasTP=inTP; o.wasW=inW; o.inTP=inTP; o.inW=inW;
      /* allies in Tide Pool (his pools heal and shield them) */
      const AL=alliesOf(A,u), aTP={}; for(const x of AL){ for(const q of pools) if(inPool(q,x)){ aTP[x.uid]=q; break; } } o.aTP=aTP;
      /* Fouled: two Fouled enemies whose bodies come within 2 m (+ Fouled Again) tangle: both rooted, each at most once every 6 s (Fouled lasts 4 s to 6 s, the deep sea
         keeps an enemy Fouled up to 8.8 s: so no cast of his re-roots an enemy more than twice) */
      const fr=P0(T,'fo.root'); if(fr>0){ const L=F.filter(x=>A.markOf(u,x,'mrFo')), reach=(2+P0(T,'fo.reach'))*M;
        for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length;j++){ const a=L[i], b=L[j]; if(!a.alive||!b.alive) continue; if(A.gap(a,b)>=reach) continue;
          if(!T.fn.canTangle(A,T,u,a)||!T.fn.canTangle(A,T,u,b)) continue; for(const x of [a,b]) o.tg[x.uid]=now;
          for(const x of [a,b]) if(troot(A,T,u,x,fr)) A.acts(T,u,[{mark:'mrTg',on:'target',dur:x.stunned,while:'stunned'}],{u,tgt:x}); } }
      /* the water clock */
      if(o.w){ o.w.t+=dt; if(o.w.t>=o.w.len-1e-9) wTurn(A,T,u,o.w.ph==='H'?'L':'H'); }
      /* Ballast: a shield the game's own clock would let run out is kept; a strip or a smaller shield leaves only what is there */
      if(o.bal>0){ if((u.shield||0)<o.bal-1e-9){ if(!((u.shieldT||0)>0)) u.shield=o.bal; else o.bal=Math.max(0,u.shield||0); } if((u.shield||0)<=o.bal+1e-9&&o.bal>0) u.shieldT=Math.max(u.shieldT||0,1); }
      for(const id in o.sb){ const x=AL.find(a=>String(a.uid)===id); if(!x){ delete o.sb[id]; continue; } if((x.shield||0)<o.sb[id]) o.sb[id]=x.shield||0; if(!(o.sb[id]>0)) delete o.sb[id]; }
      /* The Hull Holds: full Bracing while it lasts */
      if(A.winOn(T,'mrHull')) A.stSet(T,u,'mrBr',10);
      /* Stand Fast: a drag on him (a pull or a push through the engine's drag) is slowed, and a sudden shove (a teleport of 0.5 m or more in one tick) is taken back in part */
      const k=Math.min(1,P0(T,'sf.k')); if(k>0){ if((u.pullT||0)>0){ const sp=u.pullSpeed||22*(M/28.2); if(o.dpS!==u.pullSpeed){ u.pullSpeed=sp*(1-k); o.dpS=u.pullSpeed; } } else o.dpS=null;
        if(o.lx!=null&&!(u.pullT>0)&&!u._dash){ const dx=u.x-o.lx, dy=u.y-o.ly; if(Math.hypot(dx,dy)>=0.5*M){ u.x-=dx*k; u.y-=dy*k; u._ax=u.x; u._ay=u.y; } } o.lx=u.x; o.ly=u.y; }
      /* the heals and the energy of each second (one budget per unit: 1.2% of its max HP a second from his talents together) */
      T.fn.regen(A,T,u,dt,AL);
      /* a pool or a Return asked for later in this tick */
      if(o.twinAsk&&u.alive){ o.twinAsk=0; T.fn.twin(A,T,u); } },
    canTangle(A,T,u,x){ const o=S(T), E=A.eng(); if(o.tg[x.uid]!=null&&E.now()-o.tg[x.uid]<6-1e-9) return false;
      if(x.stunImmune){ T.fn.blocked(A,T,u,x); return false; } return !((x.stunned||0)>0)&&!A.markOf(u,x,'mrLk'); },
    /* ---- Fouled ---- */
    foul(A,T,u,c,a){ T.fn.foulOn(A,T,u,c.tgt,a.key+(S(T).id||0)); },
    foulOn(A,T,u,x,key){ if(!x||!x.alive) return; const o=S(T); A.setMark(T,u,x,'mrFo',{dur:4+P0(T,'fo.dur')}); o.foC[x.uid]=key; },
    /* ---- Fathoms ---- */
    sink(A,T,u,x,n){ if(!x||!x.alive||!(n>0)) return; const was=fa(A,T,u,x), nw=Math.min(WMAX,was+n); if(nw===was) return; A.ustPut(T,u,x,'mrFa',nw);
      if(was<WMAX&&nw>=WMAX) T.fn.six(A,T,u,x); },
    six(A,T,u,x){ const o=S(T), E=A.eng(), now=E.now();
      if(P0(T,'fa.numb')&&!((x._talDisarmT||0)>0)&&!A.markOf(u,x,'mrDl')){ A.acts(T,u,[{disarm:1.2,on:'target'}],{u,tgt:x}); if((x._talDisarmT||0)>0) (T.s.mrSt||(T.s.mrSt={n:0,gap:1e9,on:0,dis:0})).dis++; if((x._talDisarmT||0)>0) A.setMark(T,u,x,'mrDl',{dur:Math.max(8,x._talDisarmT+0.5)}); }   // once per enemy every 8 s (which also keeps the 0.5 s after it ends free)
      if(T.r.sf_13_3){ let z=null; for(const d of o.deep) if(inDeep(A,d,x)){ z=d; break; } if(z&&!z.rr[x.uid]&&troot(A,T,u,x,1.5)) z.rr[x.uid]=1; } },
    sinkHit(A,T,u,c){ T.fn.sink(A,T,u,c.tgt,1); },
    /* a root of his that an enemy's immunity (the game's Unstoppable) blocked, or that the game's level roll resisted: Salt Mind sinks it instead, once per enemy every 12 s */
    blocked(A,T,u,x){ const n=P0(T,'fa.salt'); if(!n||!x||!x.alive||A.markOf(u,x,'mrSm')) return; A.setMark(T,u,x,'mrSm',{dur:12}); T.fn.sink(A,T,u,x,n); },
    /* ---- his water ---- */
    wet(A,T,u,c){ const o=S(T), now=A.eng().now(); o.wl[c.tgt.uid]=Math.max(o.wl[c.tgt.uid]||0,now+2); },
    tgtInTP(A,T,u,c){ return !!(c.tgt&&S(T).inTP[c.tgt.uid]); },
    unitFoeInTP(A,T,u,c){ return !!(c.unit&&c.unit.team!==u.team&&S(T).inTP[c.unit.uid]); },
    allyInTP(A,T,u,c){ const x=c.tgt; return !!(x&&S(T).aTP&&S(T).aTP[x.uid]); },
    abilHigh(A,T,u){ return T.s.cur!=null&&high(T); },
    maeHolds(A,T,u){ for(const x of foesOf(A,u)) if(A.markOf(u,x,'mrMs')&&(x.stunned||0)>0) return true; return false; },
    /* ---- Tide Pool: it is down (the hazard the case just pushed), and its own changes ---- */
    atTP(A,T,u,c){ const o=S(T), E=A.eng(), H=E.hazards?E.hazards():[]; let h=null; for(let i=H.length-1;i>=0;i--){ const x=H[i]; if(x&&x.src===u&&!x.arrival&&x.r>0){ h=x; break; } } if(!h) return;
      const kind=o.nk||'main'; o.nk=null; if(kind==='twin') h.r=2*E.METER();
      const p={h,born:E.now(),kind,sh:kind==='main'&&!!o.shNext,in:{}}; if(kind==='main') o.shNext=false; o.pools.push(p);
      const n=P0(T,'fa.land'); if(n>0) for(const x of foesOf(A,u)) if(inPool(p,x)) T.fn.sink(A,T,u,x,n);
      if(kind==='main'&&P0(T,'tp.twin')) o.twinAsk=1; },
    twin(A,T,u){ const o=S(T), E=A.eng(), p=o.pools.filter(q=>q.kind==='main').pop(); if(!p) return; let f=null, fd=-1;
      for(const x of foesOf(A,u)){ const d=Math.hypot(x.x-p.h.x,x.y-p.h.y); if(d>fd){ fd=d; f=x; } } if(!f||!E.castSlot) return; o.nk='twin'; E.castSlot(u,'green',f); o.nk=null; },
    loneFoe(A,T,u,c){ const t=c.tgt; if(!t) return false; const r=(c.o&&c.o.radius)||3*A.eng().METER(); let n=0; for(const x of foesOf(A,u)) if(Math.hypot(x.x-t.x,x.y-t.y)<=r) n++; return n<=1; },
    shallow(A,T,u,c){ const l=A.eng().lowestAlly(u); if(!l) return; c.tgt=l; S(T).shNext=true; },
    sanct(A,T,u,c){ const o=S(T), E=A.eng(), x=c.tgt; if(!x||!x.alive||o.sanW===T.s.wave||!E.castSlot) return; o.sanW=T.s.wave; o.nk='sanct'; E.castSlot(u,'green',x); o.nk=null;
      A.acts(T,u,[{heal:{pct:0.10,of:'tgtMaxHp'},on:'target'}],{u,tgt:x}); },
    /* ---- Tsunami: where the wave breaks (its centre, its radius) ---- */
    atTS(A,T,u,c){ const o=S(T), E=A.eng(); o.id=(o.id||0)+1; o.tsN=0; const pt=c.pt, R=(c.o&&c.o.radius)||3.4*E.METER();
      const L=alliesOf(A,u).filter(x=>x!==u&&Math.hypot(x.x-pt.x,x.y-pt.y)-E.bodyR(x)<R);   // the allies its wave passes (body to body from its centre; not Maren, whose wave it is)
      const g=P0(T,'ts.gentle'); if(g>0) for(const x of L) E.healUnit(x,g*ap(u));
      if(P0(T,'ts.carry')) for(const x of L){ A.acts(T,u,[{pull:'target',to:'self',m:1,secs:0.3}],{u,tgt:x}); if((x.slow||0)>0) x.slow=0; else if((x.stunned||0)>0) x.stunned=0; } },
    shoulder(A,T,u,c){ const o=S(T); if((o.tsN||0)>=3) return; o.tsN=(o.tsN||0)+1; A.acts(T,u,[{heal:{pct:R0(T,'oh_2_3',0.01),of:'maxHp'},on:'self'}],c); },
    /* ---- Maelstrom ---- */
    atMS(A,T,u,c){ const o=S(T), E=A.eng(), now=E.now(), pt=c.pt, r=(c.o&&c.o.radius)||7*E.METER(); o.mid=(o.mid||0)+1; o.mc={hit:[],root:[],id:o.mid};
      const rootLen=2.8+P0(T,'mae.root'); o.mae={x:pt.x,y:pt.y,r,until:now+rootLen};
      if(T.r.sf_13_3) o.deep.push({x:pt.x,y:pt.y,r,until:now+rootLen+6,id:o.mid,rr:{}});
      const g=P0(T,'mae.gentle'); if(g>0) for(const x of alliesOf(A,u)) if(Math.hypot(x.x-pt.x,x.y-pt.y)<r) E.healUnit(x,g*(x.maxHp||0)); },
    maeHit(A,T,u,c){ const o=S(T); if(o.mc&&o.mc.hit.indexOf(c.tgt)<0) o.mc.hit.push(c.tgt); },
    maeRoot(A,T,u,c){ const o=S(T), t=c.tgt, E=A.eng(); if(!t||!t.alive) return; if(t.stunImmune){ T.fn.blocked(A,T,u,t); return; }
      if(o.mc) o.mc.root.push(t);
      const ext=P0(T,'mae.root'), now=E.now(), run0=((o.se[t.uid]||0)>now+1e-9&&o.ss[t.uid]!=null)?o.ss[t.uid]:now;   // a stun of his already running on it (a tangle): the root counts from its start
      if(ext>0) t.stunned=Math.max(t.stunned||0,Math.min(ROOT_TOP-(now-run0),(c.amt||0)+ext));   // Long Root / Deep Root: added in full after it lands; his stuns on one enemy never run past 4.0 s in a row
      A.acts(T,u,[{mark:'mrMs',on:'target',dur:t.stunned+0.1,while:'stunned',ends:'mrMsEnd'}],{u,tgt:t});
      A.setMark(T,u,t,'mrWh',{dur:4});
      if(P0(T,'fo.anchor')) T.fn.foulOn(A,T,u,t,'ms'+o.mid);
      const n=P0(T,'fa.close'); if(n>0) T.fn.sink(A,T,u,t,n); },
    maeCast(A,T,u,c){ const o=S(T), E=A.eng(), mc=o.mc; o.mc=null; if(!mc) return; const roots=mc.root.length;
      for(const x of mc.hit) if(x.alive&&mc.root.indexOf(x)<0&&!x.stunImmune) T.fn.blocked(A,T,u,x);   // struck but not rooted: the game's level roll resisted it
      const s=P0(T,'mae.sea'); if(s>0&&roots>0) A.acts(T,u,[{heal:{flat:s*roots*u.maxHp},on:'self'}],c);
      if(P0(T,'ef.called')&&o.w) wTurn(A,T,u,'H',8+P0(T,'ef.spring')+P0(T,'ef.called'));
      if(P0(T,'sig.ret')){ const k=Math.min(0.20,0.04*roots); if(k>0) for(const x of alliesOf(A,u)) E.healUnit(x,k*(x.maxHp||0));
        A.acts(T,u,[{window:'mrTnr',dur:8}],c); if(o.w&&o.w.ph==='H') o.w.len=Math.max(o.w.len,o.w.t+8); else if(o.w) wTurn(A,T,u,'H',8); } },
    /* every stun of his (Maelstrom's root, his talent roots): the stun-lock rule's mark until 0.5 s after it ends */
    lock(A,T,u,c){ const t=c.tgt; if(t&&t.alive&&(t.stunned||0)>0){ A.setMark(T,u,t,'mrLk',{dur:t.stunned+0.5,longest:true}); const o=S(T), now=A.eng().now(), e=now+t.stunned; if(!((o.se[t.uid]||0)>now+1e-9)) o.ss[t.uid]=now; o.se[t.uid]=Math.max(o.se[t.uid]||0,e); } },
    /* ---- Bracing: Groan at 10 ---- */
    groan(A,T,u,c){ if(!P0(T,'br.groan')||A.winOn(T,'mrHull')) return; const L=A.pick(T,u,{team:'enemy',within:3},c);
      A.acts(T,u,[{push:{team:'enemy',within:3},m:1.5,secs:0.3}],c); for(const x of L) A.setMark(T,u,x,'mrPs',{dur:4}); A.stSet(T,u,'mrBr',5); },
    /* ---- Deep Reserves' heal this tick: his talents' share of the second's budget, then what would pass his max HP becomes Ballast ---- */
    drsv(A,T,u,c){ const o=S(T), E=A.eng(); const add=(o.drRate||0)*(u.maxHp||0)*(o.dtLast||0); c.amt+=add;
      const room=Math.max(0,E.healCap(u)-u.hp), over=Math.max(0,c.amt-room), mx=P0(T,'bal.max')*(u.maxHp||0); if(!(over>0)||!(mx>0)) return;
      const took=Math.min(over,Math.max(0,mx-o.bal)); if(took>0){ o.bal+=took; u.shield=(u.shield||0)+took; u.shieldT=Math.max(u.shieldT||0,1); }
      const rest=over-took; if(rest>0&&P0(T,'bal.share')){ let b=null; for(const x of A.pick(T,u,{team:'ally',others:true,within:6},c)) if(!b||x.hp/x.maxHp<b.hp/b.maxHp) b=x;
        if(b){ const have=o.sb[b.uid]||0, g=Math.min(rest,Math.max(0,mx-have)); if(g>0){ b.shield=(b.shield||0)+g; o.sb[b.uid]=have+g; } if(o.sb[b.uid]>0) b.shieldT=Math.max(b.shieldT||0,4); } } },   // kept up while his overflow keeps coming
    balAbs(A,T,u,c){ const o=S(T); if(!(o.bal>0)) return; const left=Math.max(0,(u.shield||0)-(c.amt||0)); if(left<o.bal) o.bal=left;
      if(!(o.bal>1e-9)){ o.bal=0; const k=P0(T,'bal.burst'); if(k>0) for(const x of A.pick(T,u,{team:'enemy',within:3},c)) A.hurt(T,u,x,k*ap(u),'#9fe0ff','ballast'); } },
    /* ---- his damage reduction: ONE group, the shares multiply, never more than 40% off a hit ---- */
    drK(A,T,u,s,auto){ const P=T.P, o=S(T); let k=1;
      if(P['dr.br']) k*=1-P['dr.br']*A.stGet(T,'mrBr');
      if(s&&P['dr.kd']&&(o.inTP[s.uid]||(o.mae&&A.eng().now()<o.mae.until&&Math.hypot(s.x-o.mae.x,s.y-o.mae.y)<o.mae.r))) k*=1-P['dr.kd'];
      if(s&&P['dr.keel']&&A.markOf(u,s,'mrPs')) k*=1-P['dr.keel'];
      if(s&&P['dr.hw']&&A.markOf(u,s,'mrHw')) k*=1-P['dr.hw'];
      if(P['dr.cau']&&o.bal>0) k*=1-P['dr.cau'];
      if(P['dr.rl']) k*=1-P['dr.rl'];
      if(P['dr.bh']&&auto) k*=1-P['dr.bh'];
      if(s&&P['dr.wh']&&A.markOf(u,s,'mrWh')) k*=1-P['dr.wh'];
      if(s&&P['dr.ache']&&fa(A,T,u,s)>=3) k*=1-P['dr.ache'];
      if(P['dr.eg']&&low(T)) k*=1-P['dr.eg'];
      if(P['dr.ck']&&alliesOf(A,u).some(x=>x.hp<0.5*x.maxHp)) k*=1-P['dr.ck'];
      if(P['dr.kw']&&high(T)) k*=1-P['dr.kw'];
      if(P['dr.cw']&&o.aTP&&o.aTP[u.uid]) k*=1-P['dr.cw'];
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c.src,c.auto); },
    allyDr(A,T,u,c){ const P=T.P, o=S(T), x=c.tgt, s=c.src, E=A.eng(); if(!x||x===u||x._summon) return; let k=1;
      if(P['dr.cw']&&o.aTP&&o.aTP[x.uid]) k*=1-P['dr.cw'];
      if(P['dr.kw']&&high(T)&&A.gap(u,x)<6*E.METER()) k*=1-P['dr.kw'];
      if(P['adr.bw']&&A.winOn(T,'mrBw')&&T.fn.behind(A,T,u,x)) k*=1-P['adr.bw'];
      if(s&&P['dr.ache']&&fa(A,T,u,s)>=3) k*=1-P['dr.ache'];
      if(s&&P['dr.hw']&&A.markOf(u,s,'mrHw')) k*=1-P['dr.hw'];
      c.amt*=Math.max(1-ADR_CAP,k); },
    /* behind him: farther from the middle of the living enemies than he is */
    behind(A,T,u,x){ const F=foesOf(A,u); if(!F.length) return false; let cx=0, cy=0; for(const f of F){ cx+=f.x; cy+=f.y; } cx/=F.length; cy/=F.length;
      return Math.hypot(x.x-cx,x.y-cy)>Math.hypot(u.x-cx,u.y-cy); },
    /* ---- the heals and the energy of each second ---- */
    regen(A,T,u,dt,AL){ const o=S(T), E=A.eng(), P=T.P; o.dtLast=dt; o.drRate=0; if(!(dt>0)) return;
      const hiK=(high(T)&&P['ef.k'])?P['ef.k']*(1+(P['ef.moon']||0)):0, hiR=(6+(P['ef.reach']||0))*E.METER(), tpK=(P['tp.heal']||0)*(1+(P['tp.still']||0));
      const loK=(low(T)&&P['ef.e'])?P['ef.e']*(1+(P['ef.slack']||0)):0;
      for(const x of AL){ let r=0;
        if(hiK>0&&(x===u||A.gap(u,x)<hiR)) r+=hiK;
        const q=o.aTP&&o.aTP[x.uid]; if(tpK>0&&q) r+=tpK*(q.sh?2:1);
        if(x===u){ let d=0; if(u.pass&&u.pass.tidereserve){ d+=P['rg.bilge']||0; if(P['bal.tidal']&&o.bal>0) d+=P['bal.tidal']*0.01*(u.passMul||1); if(T.r.oh_13_2&&A.winOn(T,'mrHull')) d+=0.03; }
          if(P['rg.take']&&q) r+=P['rg.take']; if(P['rg.song']&&A.stGet(T,'mrBr')>=10) r+=P['rg.song'];
          o.drRate=Math.min(REGEN_CAP,d); r=Math.min(REGEN_CAP-o.drRate,r); }
        else r=Math.min(REGEN_CAP,r);
        if(r>0&&x.hp<E.healCap(x)) E.healUnit(x,r*(x.maxHp||0)*dt);
        /* Low Water: energy 2% faster a rank (what it gained since the last tick, that share more) */
        const e=x.energy||0, p=o.lastE[x.uid]; if(loK>0&&(x===u||A.gap(u,x)<6*E.METER())&&p!=null&&e>p) x.energy=Math.min(100,e+(e-p)*loK); o.lastE[x.uid]=x.energy||0; }
      if(u.pass&&u.pass.tidereserve){ if(P['en.bilge']){ u.energy=Math.min(100,(u.energy||0)+P['en.bilge']*dt); o.lastE[u.uid]=u.energy; }
        if(P['en.share']){ let b=null; for(const x of AL) if(x!==u&&(!b||(x.energy||0)<(b.energy||0))) b=x; if(b){ b.energy=Math.min(100,(b.energy||0)+P['en.share']*dt); o.lastE[b.uid]=b.energy; } } } },
    /* ---- deaths: Returns, The Bottom ---- */
    died(A,T,u,c){ const o=S(T), E=A.eng(), x=c.unit, now=E.now(); if(!x||x.team===u.team) return;
      if(P0(T,'fa.bottom')&&fa(A,T,u,x)>=WMAX){ let b=null, bd=1e18; for(const f of foesOf(A,u)){ if(f===x) continue; const d=E.dist(x,f); if(d<bd){ bd=d; b=f; } } if(b) T.fn.sink(A,T,u,b,fa(A,T,u,x)); }
      if(!P0(T,'ret.k')&&!T.r.gb_13_2) return;
      let wet=false; for(const q of livePools(A,o)) if(inPool(q,x)) wet=true; for(const z of o.deep) if(inDeep(A,z,x)) wet=true;
      if(!wet&&o.wl[x.uid]!=null&&now<=o.wl[x.uid]+P0(T,'ret.late')+1e-6) wet=true;
      if(!wet) return; const n=(T.r.gb_13_2&&A.winOn(T,'mrTnr'))?2:1; for(let i=0;i<n;i++) T.fn.ret(A,T,u,x); },
    ret(A,T,u,x){ const P=T.P, E=A.eng(); const a=(P['ret.k']||0)*(x.maxHp||0); const AL=alliesOf(A,u).sort((p,q)=>p.hp/p.maxHp-q.hp/q.maxHp), l=AL[0];
      if(l){ if(a>0) E.healUnit(l,a); if(P['ret.nrg']){ l.energy=Math.min(100,(l.energy||0)+P['ret.nrg']); S(T).lastE[l.uid]=l.energy; } if(P['ret.kelp']) A.acts(T,u,[{shield:{pct:P['ret.kelp'],of:'tgtMaxHp'},dur:3,on:'target'}],{u,tgt:l}); }
      const s=AL[1]; if(s&&P['ret.gen']&&a>0) E.healUnit(s,a*P['ret.gen']);
      if(P['ret.me']) u.energy=Math.min(100,(u.energy||0)+P['ret.me']); }
  }
};
function R0(T,id,per){ return (T.r[id]||0)*per; }
/* Holding Water: when Maelstrom's root ends, 5% slower a rank for 2 s (the mark's end event) */
module.exports.always.push({on:'mrMsEnd',reqAny:['sf_12_3'],do:[{fn:'hold'}]});
module.exports.fn.hold=function(A,T,u,c){ const k=T.P['mae.hold']||0; if(k>0&&c.tgt&&c.tgt.alive) A.acts(T,u,[{slow:k,dur:2,on:'target'}],c); };
/* the water turned to Low: Tidal Ballast's link (with Ebb and Flow) gives the ally within 6 m with the least energy 5 energy while he holds Ballast */
module.exports.talents.oh_n1.push({on:'mrTurn',req:'gb_1_3',if:{fn:'toLowBal'},do:[{fn:'tidalE'}]});
module.exports.fn.toLowBal=function(A,T,u,c){ return c.to==='L'&&(S(T).bal||0)>0; };
module.exports.fn.tidalE=function(A,T,u,c){ let b=null; for(const x of A.pick(T,u,{team:'ally',others:true,within:6},c)) if(!b||(x.energy||0)<(b.energy||0)) b=x; if(b){ b.energy=Math.min(100,(b.energy||0)+5); S(T).lastE[b.uid]=b.energy; } };   // (a talent's own energy is not 'gained' for Low Water's share)
/* Hull Wake and Keel: the enemies Tsunami shoves (marks) */
module.exports.talents.oh_4_3.push({on:'pass',skill:'tsPush',do:[{mark:'mrHw',on:'target',dur:3}]});
module.exports.talents.oh_3_2.push({on:'pass',skill:'tsPush',do:[{mark:'mrPs',on:'target',dur:4}]});
