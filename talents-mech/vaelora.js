/* VAELORA VELVETCLAW - what her learned talents do in a fight (the mechanics; her 11 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Vaelora Velvetclaw": what she added)
   Her real kit (the code, not the card wording; damage profile Magic: EVERY hit of hers is magic, her basic attack included; a Mage of the middle row; tests/vaelora-kit-facts.js):
   - Featherfang ('piercethrow', green, cd 6, frost): a line from her toward the FARTHEST enemy on the field (no range limit), 1.2 m to each side of it
     (o.width, centre to centre), from 12 px behind her to 24 px past that enemy; every enemy on it takes 150% of her ability power x skill level, all at
     the cast (casting 'piercethrow'). 1.36 enemies a cast in 20 seeded fights (the card's "through two enemies" is the line, not a count).
   - Whiteout Pounce ('evadecounter', blue, cd 9, frost): a 2.2 s stance - her skill damage-reduction slot (45% + 0.1 pt a level) and an evade window. The
     FIRST enemy hit inside the window misses her (the page's evade block, before any hit hook; the 'evade' event) and the counter strikes THAT attacker at
     once for 200% of her ability power x skill level (casting 'counter', a landPre / land pair). The card says "the lowest-health enemy": the code strikes
     the attacker. In seeded fights 13 of 69 windows were spent; 55 ran out with nothing to evade.
   - Silent Altitude (passive 'silentalt', 3 stars): after 3 s untouched (u._untouched: any enemy hit that reaches her resets it, an evaded one too; it does
     not count up while she is stunned or feared) her critical damage is +50% x the passive's strength until something lands (u._saOn, u._saAdd). Up 76% of
     her time in seeded fights; spoiled about once in 30 s.
   - Winter Plumage (ultimate 'blizzard', energy): a 4 s channel on a circle 8 m (centre to centre) around its target's spot; a tick every 0.5 s: 50% of her
     ability power x skill level to every enemy inside (magic, frost, casting null), and a 10% roll per enemy per tick to FREEZE it: the page writes
     stunned = max(stunned, 0.84 s) straight on (no ccApply, no resist; the 'ccHit' direct hook). She cannot attack or cast while it channels.
   Stalk, Sulk, Plumage (feathers), Quills, Starving and Crouch exist only through her talents. Her own per-fight object is T.s.vl (a record per enemy); her
   state names start with vl. NO absolute fight time is kept anywhere here (the battle clock restarts at 0 each wave): every timer counts down by the tick's dt.
   Readings, caps and corrected tooltips: WIRING/60 - VAELORA VELVETCLAW - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const FF='piercethrow', WP='evadecounter', WS='blizzard';
const DR_CAP=0.25, TEN_CAP=0.20, STUN_TOP=4.0, RUN_TOP=4.0, LOCK=0.5, FF_FLOOR=3, WP_FLOOR=5, FEA_MAX=20, Q_MAX=3, Q_DUR=8, QF_LOCK=8, STORM_EXT=4, KH_CD=10, HC_CD=1, FORK=15*Math.PI/180;
/* which talents read each family: its bookkeeping rows are attached only when one of them is learned */
const STALK=['pc_1_1','pc_5_1','pc_6_1','pc_n2','pc_11_1'];                                   // Stalk
const SULK=['pc_1_4','pc_3_4','pc_5_4','pc_8_4','pc_9_4','pc_12_4'];                          // Sulk
const SA=STALK.concat(SULK,['pc_3_1','pc_6_4','pc_7_2','pc_13_2','pc_2_1','pc_8_1','pc_n1','pc_4_1','pc_11_2','pc_10_1']);   // Silent Altitude watched (spoils, holds)
const FEA=['wc_1_1','wc_2_1','wc_3_1','wc_4_1','wc_6_1','wc_8_1','wc_10_1','wc_11_1'];        // Plumage (feathers)
const QUI=['wc_1_4','wc_2_4','wc_3_4','wc_6_4','wc_8_4','wc_9_4','wc_10_3','wc_11_1','wc_n1','wc_11_4','wc_12_3','wc_12_4','wc_13_3'];   // Quills
const STV=['tw_1_2','tw_2_2','tw_3_2','tw_5_2','tw_6_2','tw_10_2','tw_11_2','tw_13_3'];      // Starving
const CRO=['tw_1_4','tw_2_4','tw_3_4','tw_9_4'];                                              // Crouch
const DRG=['pc_1_4','pc_6_1','pc_12_1','wc_4_1','tw_3_4','tw_6_2','tw_10_1'];                 // her damage reduction: ONE capped group (25%)
const STUNS=['wc_9_3','wc_9_4','wc_13_3','tw_13_3','tw_11_3','pc_12_2','pc_13_2'];            // her freezes watched (her stuns: the 4.0 s in a row limit, the stun-lock rule, "frozen by Winter Plumage")
const STORM=['pc_7_3','pc_8_3','pc_11_2','pc_12_2','pc_13_2','wc_7_1','wc_8_1','wc_8_3','wc_10_3','wc_12_2','wc_12_3','wc_13_3','tw_7_2','tw_11_3','tw_12_3','tw_13_3','wc_1_1','wc_2_1','wc_3_1','wc_4_1','wc_6_1','wc_10_1','wc_11_1'];   // her storm watched (its ticks, its circle, its end)
const CTR=['pc_6_2','pc_7_2','wc_3_4','wc_6_2','tw_1_4','tw_4_3','tw_4_4','tw_5_3','tw_5_4','tw_6_4','tw_11_4'].concat(FEA);   // the counter watched
const WPW=['wc_7_2','tw_8_3','tw_1_4','tw_2_4','tw_3_4','tw_9_4'];                            // the stance watched (its 2.2 s)
const FFW=['pc_1_4','pc_5_2','pc_5_3','pc_n2','pc_13_2','wc_5_3','wc_5_4','wc_11_1','tw_7_1','wc_3_3','pc_n1','wc_8_4'].concat(QUI,FEA);   // Featherfang's line watched
const CDS=['pc_2_3','wc_5_2','tw_4_1','pc_9_3','wc_9_2','tw_10_4'];                           // her cooldowns (with their floors)
const KILL=STV.concat(['pc_10_1','tw_8_2','tw_12_3','tw_7_1','tw_13_3']);                     // her kills watched
/* ---- small readers that need no API (the 95% instrument calls drK from a test with the API kept on T.s) ---- */
const rk=(T,id)=>T.r[id]||0;
const has=(T,L)=>L.some(id=>T.r[id]);
const V=T=>T.s.vl||(T.s.vl={e:{},spl:0,kh:0,skT:0,lwT:0,lws:0,sulk:0,sk:0,ss:0,ff:null,owlFF:0,wpw:0,evd:0,evT:0,wsA:0,crA:0,st:null,inTick:0,pv:0,pvE:null,tpv:0,tsrc:null,
  gE:99,bE:99,g0:null,hc:0,sp2:0,hgA:0,svT:0,bf:0,spr:0,lastCtr:null,ctrCr:0,ctrRaw:0,weak:0,rq:null,re:0,waves:0,runMax:0,ts:{n:0,onStun:0,lkOk:0,cut:0,trim:0}});
const rec=(T,t)=>{ const e=V(T).e; let r=e[t.uid]; if(!r||r.u!==t){ r=e[t.uid]={u:t,q:0,qt:0,qfl:0,st:0,re:0,lk:0,cap:0,fz:0,gr:0,lw:0,nl:null,sh:0}; } return r; };
const recOf=(T,t)=>{ const r=t&&V(T).e[t.uid]; return (r&&r.u===t)?r:null; };
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const qOf=(T,t)=>{ const r=recOf(T,t); return (r&&r.qt>0)?r.q:0; };
const inSt=(T,t)=>{ const s=V(T).st; return !!(s&&t&&t.alive&&Math.hypot(t.x-s.cx,t.y-s.cy)<s.R); };   // inside her storm: its own measure (the centre within its radius)
const isTick=(T,c)=>!!(V(T).inTick&&T.s.cur==null&&!c.auto);                                    // a tick of her storm (the only hit of hers with nothing resolving that is not a basic attack, inside the channel's tick)
const frost=(T,c)=>T.s.cur===FF||T.s.cur==='counter'||T.s.cur==='claw'||isTick(T,c);           // her frost hits: Featherfang (and its second ring, its re-throw), the counter, the storm's ticks, the hunt's claw
module.exports={
  hero:'vaelora',
  casting:true,                         // rows ask which of her skills a hit comes from (Featherfang, the counter, the storm's ticks, the claw)
  watch:['wc_11_4'],                    // Ice Barbs: her allies' hits on quilled enemies (a teamIn row: she watches every unit)
  states:{
    vlStalk:{max:5},                                                            // Stalk (while Silent Altitude holds)
    vlFea:{max:FEA_MAX},                                                        // Plumage: white feathers (for the wave, Preening keeps some)
    vlStv:{max:10},                                                             // Starving (for the fight; a kill eats it)
    vlCr:{max:P('cr.max',5)}                                                    // Crouch (for the wave; Deep Crouch: up to 8)
  },
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share, and her capped groups */
  always:[
    {on:'wave',do:[{fn:'waveStart'}]},                                                                                    // a new wave: her records of the last wave's enemies dropped; feathers, Crouch
    {on:'tick',do:[{fn:'tk'}]},                                                                                            // every timer of hers counts down here (never an absolute fight time)
    {on:'aimed',reqAny:SA,do:[{fn:'aimed'}]},                                                                              // an enemy's hit coming at her: does it spoil Silent Altitude?
    {on:'evade',do:[{fn:'evd'}]},                                                                                          // Whiteout Pounce's evade was spent on an enemy's hit
    {on:'skillTgt',skill:FF,reqAny:FFW,do:[{fn:'ffAim'}]},                                                                 // Featherfang: its aim (Finishing Ring's re-throw), the enemies on its line in path order
    {on:'kit',skill:FF,reqAny:FFW,do:[{fn:'ffKit'}]}, {on:'cast',skill:FF,reqAny:FFW,do:[{fn:'ffCast'}]},                // Featherfang: what this throw carries; the second ring, the return, the re-throw
    {on:'cast',skill:WP,do:[{fn:'wpCast'}]},                                                                               // Whiteout Pounce: the stance's time
    {on:'cast',skill:WS,reqAny:STORM.concat(STUNS),do:[{fn:'stCast'}]},                                                    // Winter Plumage: the storm's circle and what it carries
    {on:'num',skill:'blizzR',reqAny:STORM.concat(STUNS),do:[{fn:'stTick'}]},                                               // once per storm tick, just before it strikes
    {on:'num',skill:'blizzFreeze',reqAny:STUNS,do:[{fn:'stFrz'}]},                                                         // each enemy's freeze roll (the unit is passed): its stun before; Winter Hunt
    {on:'ccOut',if:{cc:['stunned']},reqAny:STUNS,do:[{fn:'ccOutF'}]},                                                     // (the stun before one of hers lands; Frozen Through on a storm freeze)
    {on:'ccHit',if:{cc:['stunned']},reqAny:STUNS,do:[{fn:'stunHit'}]},                                                    // every stun of hers that lands (the storm's freezes and her talents'): one function
    {on:'landPre',reqAny:CTR,do:[{fn:'lp'}]}, {on:'land',reqAny:CTR,do:[{fn:'ld'}]},                                     // the counter
    {on:'out',do:[{fn:'out'}]},                                                                                            // her hits: the multipliers her states give
    {on:'crit',do:[{fn:'crit'}]},                                                                                          // her forced critical hits
    {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'hit'}]},                                                                    // her hits that landed: feathers, Quills, slows, energy
    {on:'kill',procs:true,reqAny:KILL,if:{targetTeam:'enemy'},do:[{fn:'kill'}]},                                           // her kills (by her talents' damage too)
    {on:'cd',reqAny:CDS.concat(['pc_12_4','tw_11_2']),do:[{fn:'cdSet'}]},                                                  // her cooldown talents, with their floors
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]}                                                                                 // her damage-reduction talents: ONE capped group (drK)
  ],
  talents:{
    /* ============================== THE PATIENT CAT ============================== */
    pc_1_1:[ {stat:{crit:R(0.002)},per:'vlStalk'} ],                                                              // Stalk (5 Stalk x 0.2% x 5 = 5%: the crit cap)
    pc_2_3:[ {param:'cd.g',add:R(0.3)} ],                                                                         // Quick Feather (cdSet)
    pc_1_4:[ {param:'sulk.dr',add:R(0.03)}, {param:'sulk.ff',add:R(0.03)} ],                                      // Sulk (spoil; drK; ffKit)
    pc_2_1:[ {param:'sa.soon',add:R(0.3)} ],                                                                      // Low and Still (tk)
    pc_2_2:[ {on:'out',if:{casting:FF},critMore:R(0.04)} ],                                                       // Featherfang Edge
    pc_3_1:[ {param:'kh',add:1} ],                                                                                // Kept Height (protect)
    pc_4_2:[ {on:'out',if:{casting:FF,fn:'far6'},more:R(0.03)} ],                                                // Far Throw (reading: enemies more than 6 m away)
    pc_n1:[ {param:'bp',add:1}, {param:'bpq',add:1,req:'wc_1_4'} ],                                               // Barbed Patience (LINK: tk; hit)
    pc_3_4:[ {param:'sulk.len',add:R(0.4)} ],                                                                     // Long Sulk
    pc_4_1:[ {on:'out',if:{fn:'saOn'},critMore:R(0.02)} ],                                                       // Perfect Moment (2% a rank: crit damage 10% at most)
    pc_5_2:[ {param:'ff1',add:1} ],                                                                               // First Feather (PICK ONE: crit)
    pc_4_3:[ {stat:{move:R(0.03)}} ],                                                                             // Moor Wind
    pc_5_3:[ {param:'ffL',add:1} ],                                                                               // Last Feather (PICK ONE: out)
    pc_5_1:[ {stat:{apow:R(0.005)},per:'vlStalk'} ],                                                              // Waiting Game
    pc_5_4:[ {stat:{aspd:R(0.02)},if:{fn:'sulking'}} ],                                                           // Spoiled Mood
    pc_6_1:[ {param:'dr.fence',add:R(0.04)} ],                                                                    // Fence Post (drK)
    pc_6_2:[ {on:'out',if:{casting:'counter'},more:R(0.05)} ],                                                    // Counter Fang
    pc_6_4:[ {param:'grudge',add:R(0.02)} ],                                                                      // Cat's Grudge (spoil; out)
    pc_7_2:[ {param:'spo',add:1} ],                                                                               // Silent Pounce (evd; crit)
    pc_7_3:[ {on:'out',if:{fn:'tick'},more:R(0.03)} ],                                                            // Feather Storm
    pc_8_1:[ {param:'hg',add:R(0.04)} ],                                                                          // Hunting Ground (tk)
    pc_8_3:[ {on:'num',skill:'blizzR',addM:R(0.2)}, {param:'st.r',add:R(0.2)} ],                                 // Wide Storm
    pc_8_4:[ {param:'pout',add:R(0.01)} ],                                                                        // Pout (spoil)
    pc_9_2:[ {on:'out',if:{casting:FF,targetHpBelow:0.40},more:R(0.03)} ],                                        // Clean Kill
    pc_9_3:[ {param:'cd.pct',add:R(0.01)} ],                                                                      // Cat Patience (cdSet)
    pc_9_4:[ {param:'ss',add:1} ],                                                                                // Sulking Strike (tk; crit)
    pc_10_1:[ {param:'ss2',add:1} ],                                                                              // Second Strike (kill)
    pc_10_3:[ {param:'hc',add:R(1)} ],                                                                            // Hoarded Cold (hit)
    pc_n2:[ {param:'lw',add:R(0.02)} ],                                                                           // The Long Wait (tk; ffKit)
    pc_11_1:[ {on:'out',if:{fn:'abil5'},ignoreMr:R(0.02)} ],                                                      // Stalker's Eye
    pc_11_2:[ {on:'out',if:{fn:'tickSA'},more:R(0.04)} ],                                                         // Frozen Patience
    pc_12_1:[ {param:'dr.soft',add:R(0.03)} ],                                                                    // Soft Paws (drK)
    pc_12_2:[ {on:'out',if:{fn:'frozen'},critMore:R(0.02)} ],                                                     // Brittle Prey (2% a rank: crit damage 10% at most)
    pc_12_4:[ {param:'lg',add:R(0.5)} ],                                                                          // Long Grudge (spoil)
    pc_13_2:[ {param:'owl',add:1} ],                                                                              // The Owl Came Down (SIGNATURE: stCast, protect, crit, stEnd)
    /* ============================== WINTER COMES DOWN ============================== */
    wc_1_1:[ {stat:{apow:R(0.001)},per:'vlFea'} ],                                                                // Plumage (feathers: hit, stTick)
    wc_2_1:[ {param:'moult0',add:R(2)} ],                                                                         // Moulting (waveStart)
    wc_1_4:[ {param:'q.dmg',add:R(0.02)} ],                                                                       // Quills (out)
    wc_2_2:[ {on:'out',if:{casting:FF},more:R(0.03)} ],                                                           // Heavy Ring
    wc_2_4:[ {param:'q.dur',add:R(1)} ],                                                                          // Barbed Quills (addQ)
    wc_3_1:[ {stat:{mr:R(0.01)},per:{fn:'fea5'}} ],                                                               // White Mantle
    wc_3_3:[ {param:'cring',add:R(0.04)} ],                                                                       // Cold Ring (hit)
    wc_3_4:[ {param:'torn',add:1} ],                                                                              // Torn Out (hit)
    wc_4_1:[ {param:'dr.fluff',add:R(0.005)} ],                                                                   // Fluffed Up (drK)
    wc_4_2:[ {on:'kit',skill:FF,opt:{width:{more:R(0.08)}}} ],                                                    // Wide Ring
    wc_4_3:[ {on:'out',if:{casting:FF,fn:'ringSlow'},more:R(0.06)} ],                                             // Biting Ring
    wc_1_3:[ {on:'out',if:{fn:'abil'},ignoreMr:R(0.03)} ],                                                        // Frost Breath
    wc_5_2:[ {param:'cd.g',add:R(0.2)} ],                                                                         // Light Ring (cdSet)
    wc_5_3:[ {param:'ret',add:1} ],                                                                               // Owl's Return (PICK ONE: ffCast)
    wc_5_4:[ {param:'twin',add:1}, {on:'kit',skill:FF,opt:{mul:{mul:0.6}}} ],                                     // Twin Rings (PICK ONE: ffCast)
    wc_6_1:[ {on:'out',if:{fn:'fullFea'},more:R(0.03)} ],                                                         // Full Plumage
    wc_6_2:[ {on:'out',if:{casting:'counter'},more:R(0.05)} ],                                                    // Deep Winter Pounce
    wc_6_4:[ {stat:{move:R(-0.03)},to:{team:'enemy',fn:'q3'}} ],                                                  // Quilled Through
    wc_7_1:[ {param:'lwin',add:R(0.02)} ],                                                                        // Late Winters (hit; tk)
    wc_7_2:[ {param:'wst',add:1} ],                                                                               // Whiteout Storm (tk)
    wc_8_1:[ {param:'shed',add:R(1)} ],                                                                           // Shed Feathers (hit)
    wc_8_3:[ {on:'out',if:{fn:'tick'},more:R(0.03)} ],                                                            // Rime Wings
    wc_8_4:[ {param:'barb',add:R(0.2)} ],                                                                         // Ice in the Barbs (hit)
    wc_9_2:[ {param:'cd.pct',add:R(0.01)} ],                                                                      // Gathering Snow (cdSet)
    wc_9_3:[ {param:'ft',add:R(0.1)} ],                                                                           // Frozen Through (ccOutF)
    wc_9_4:[ {param:'qf',add:1} ],                                                                                // Quill Freeze (addQ)
    wc_10_1:[ {param:'preen',add:R(3)} ],                                                                         // Preening (waveStart)
    wc_10_3:[ {param:'gift',add:R(1)} ],                                                                          // Owl's Gift (hit)
    wc_11_1:[ {param:'moult',add:1} ],                                                                            // Moult (ffKit)
    wc_n1:[ {param:'ctk',add:R(0.02)} ],                                                                          // Cold That Keeps (out)
    wc_11_4:[ {on:'teamIn',if:{targetTeam:'enemy',fn:'ibOk'},more:R(0.005),per:{fn:'qN'}} ],                      // Ice Barbs (her allies' hits)
    wc_12_2:[ {stat:{atk:R(-0.03),apow:R(-0.03)},to:{team:'enemy',fn:'inStorm'}} ],                               // Snowfall Hush
    wc_12_3:[ {on:'out',if:{fn:'tick'},more:R(0.01),per:{fn:'qN'}} ],                                             // Feather Weight
    wc_12_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},chance:R(0.15),do:[{fn:'q1'}]} ],                       // Frost Paws
    wc_13_3:[ {param:'moor',add:1} ],                                                                             // The Moor's Long Winter (SIGNATURE: stTick, stunHit, stEnd)
    /* ============================== THREE WEEKS HUNGRY ============================== */
    tw_1_1:[ {stat:{move:R(0.03)}} ],                                                                             // Lean Frame
    tw_1_2:[ {stat:{apow:R(0.004)},per:'vlStv'}, {param:'stv.h',add:R(0.003)} ],                                  // Starving (tk; eat)
    tw_1_4:[ {param:'cr.dmg',add:R(0.03)} ],                                                                      // Crouch (evd; tk; lp)
    tw_2_2:[ {param:'stv.fast',add:R(0.3)} ],                                                                     // Thin Belly
    tw_2_4:[ {param:'cr.max',add:R(1)} ],                                                                         // Deep Crouch
    tw_3_2:[ {param:'oe',add:1} ],                                                                                // Owl-Eater (eat)
    tw_3_3:[ {on:'kit',skill:WP,opt:{dur:{add:R(0.1)}}} ],                                                        // Longer Whiteout
    tw_3_4:[ {param:'dr.coil',add:R(0.01)} ],                                                                     // Coiled Legs (drK)
    tw_4_1:[ {param:'cd.b',add:R(0.4)} ],                                                                         // Ready Pounce (cdSet)
    tw_4_3:[ {param:'bw',add:R(0.05)} ],                                                                          // Blood Warm (hit)
    tw_4_4:[ {on:'out',if:{casting:'counter'},more:R(0.03)} ],                                                    // Pounce Weight
    tw_5_1:[ {on:'ccIn',less:R(0.04),upTo:TEN_CAP} ],                                                             // Wild Will (20% at most)
    tw_5_2:[ {on:'out',if:{auto:true,stackMin:{vlStv:6}},more:R(0.03)} ],                                         // Ravenous
    tw_8_2:[ {param:'gorge',add:R(3)} ],                                                                          // Gorged (kill)
    tw_6_1:[ {on:'out',if:{casting:FF,targetHpBelow:0.5},more:R(0.06)} ],                                         // Ice Claw
    tw_6_2:[ {param:'dr.belly',add:R(0.03)} ],                                                                    // Belly Full (eat; drK)
    tw_6_4:[ {param:'spring',add:1}, {stat:{move:R(0.03)},if:{fn:'sprung'}} ],                                    // Snow Spring (ld)
    tw_7_1:[ {param:'fin',add:1} ],                                                                               // Finishing Ring (kill; ffCast; tk)
    tw_7_2:[ {on:'out',if:{fn:'tick',targetHpBelow:0.5},more:R(0.03)} ],                                          // Hunting Storm
    tw_7_3:[ {on:'kit',skill:WP,opt:{dr:{add:R(-0.01)}}} ],                                                       // Evader (5 points more at 5/5)
    tw_5_3:[ {param:'weak',add:1} ],                                                                              // On the Weakest (PICK ONE: ld)
    tw_5_4:[ {param:'tb',add:1} ],                                                                                // Throat Bite (PICK ONE: hit)
    tw_8_3:[ {param:'cref',add:R(0.002)} ],                                                                       // Cat Reflex (tk; 1.2% a second at 3/3: the regeneration cap)
    tw_9_3:[ {param:'sp2',add:1} ],                                                                               // Second Pounce (tk)
    tw_9_4:[ {param:'wt',add:R(1)} ],                                                                             // Wound Tight (waveStart)
    tw_10_1:[ {param:'dr.nimble',add:R(0.03)} ],                                                                  // Nimble (drK)
    tw_10_2:[ {param:'stv.h2',add:R(0.001)} ],                                                                    // Feast (eat)
    tw_10_4:[ {param:'cd.pct',add:R(0.01)} ],                                                                     // Patient Hunter (cdSet)
    tw_11_2:[ {param:'ns',add:R(0.5)} ],                                                                          // Never Sorry (eat)
    tw_11_3:[ {param:'wh',add:R(0.02)} ],                                                                         // Winter Hunt (stFrz)
    tw_11_4:[ {on:'out',if:{casting:FF,fn:'lastCtr'},more:R(0.04)} ],                                             // Frost Fang
    tw_12_3:[ {param:'mf',add:R(0.02)} ],                                                                         // Moor Feast (kill)
    tw_12_4:[ {on:'cast',skill:WP,if:{fn:'slowed'},chance:R(0.33),do:[{fn:'clrSlow'}]} ],                         // Sharp Hearing
    tw_13_3:[ {param:'doty',add:1} ]                                                                              // Dead of the Year (SIGNATURE: tk claw, kill, stEnd)
  },
  fn:{
    /* ---- A NEW WAVE: the records of the last wave's enemies are dropped (they are gone); her storm and her throw are over; feathers: Preening keeps 3 a rank
       of last wave's, Moulting adds 2 a rank (20 at most); Crouch: Wound Tight's 1 a rank; Second Pounce again. The API kept on T.s for the 95% instrument ---- */
    waveStart(A,T,u){ const v=V(T), P=T.P; T.s.api=A; v.e={}; v.st=null; v.ff=null; v.inTick=0; v.rq=null; v.sp2=0; v.lastCtr=null; v.waves++;
      if(has(T,FEA)){ const kept=v.waves>1?Math.min(stN(T,'vlFea'),P.preen||0):0; A.stSet(T,u,'vlFea',Math.min(FEA_MAX,kept+(P.moult0||0))); }
      if(has(T,CRO)) A.stSet(T,u,'vlCr',P.wt||0); },
    /* ---- EVERY TIMER, ONCE A TICK (countdowns only) ---- */
    tk(A,T,u,c){ const v=V(T), dt=c.dt||0, P=T.P, E=A.eng(); v.inTick=0; T.s.api=A;
      v.gE+=dt; v.bE+=dt; if(v.kh>0) v.kh=Math.max(0,v.kh-dt); if(v.hc>0) v.hc=Math.max(0,v.hc-dt); if(v.bf>0) v.bf=Math.max(0,v.bf-dt); if(v.spr>0) v.spr=Math.max(0,v.spr-dt);
      const sa=!!u._saOn&&!!(u.pass&&u.pass.silentalt);
      if(!u._saOn) v.spl=0;
      /* Low and Still: Silent Altitude comes up 0.3 s a rank sooner (the passive's own 3 s reached early; the passive pass runs after this tick) */
      if(P['sa.soon']&&u.pass&&u.pass.silentalt&&!u._saOn){ const th=3-P['sa.soon']; if((u._untouched||0)>=th-1e-9&&(u._untouched||0)<3) u._untouched=3; }
      v.ut=u._untouched||0;
      /* Hunting Ground: the passive's critical damage 4% a rank larger while it holds (written with the passive's own number, so its own turn-off takes it back) */
      if(P.hg){ if(sa&&!(v.hgA>0)){ const d=0.5*(u.passMul||1)*P.hg; u.critDmg=(u.critDmg||0.6)+d; u._saAdd=(u._saAdd||0)+d; v.hgA=d; } else if(!sa) v.hgA=0; }
      /* Stalk: 1 a second while Silent Altitude holds (max 5), gone when it ends; The Long Wait: each further second at 5, up to 5 s (spent on the throw) */
      if(has(T,STALK)){ if(sa){ v.skT+=dt; if(v.skT>=1-1e-9){ v.skT-=1; if(stN(T,'vlStalk')<5) A.stSet(T,u,'vlStalk',stN(T,'vlStalk')+1); else if(P.lw){ v.lws=Math.min(5,v.lws+1); } } }
        else { if(stN(T,'vlStalk')>0) A.stSet(T,u,'vlStalk',0); v.skT=0; } }
      /* Barbed Patience: Featherfang's cooldown runs 5% faster while Silent Altitude holds (5% of what it recovered this tick) */
      if(P.bp){ const cur=u.greenCd||0, was=v.g0; if(sa&&was!=null&&cur>0&&was>cur&&was-cur<=dt*4) u.greenCd=Math.max(0,cur-(was-cur)*0.05); v.g0=u.greenCd||0; }
      /* Sulk: its time; when it ends, Sulking Strike arms her next basic attack */
      if(v.sulk>0){ v.sulk-=dt; if(v.sulk<=1e-9){ v.sulk=0; if(P.ss) v.ss=1; } }
      /* Starving: 1 every 2 s without a kill (Thin Belly: 0.3 s a rank faster), max 10, while an enemy stands */
      if(has(T,STV)&&E.units().some(x=>x.alive&&x.team!==u.team)){ const per=Math.max(0.5,2-(P['stv.fast']||0)); v.svT+=dt; if(v.svT>=per-1e-9){ v.svT-=per; if(stN(T,'vlStv')<10) A.stSet(T,u,'vlStv',stN(T,'vlStv')+1); } }
      /* Whiteout Pounce's stance: its time; Whiteout Storm and Cat Reflex each 0.5 s of it; a window that ran out with nothing to evade winds Crouch */
      if(v.wpw>0){ const was=v.wpw; v.wpw=Math.max(0,v.wpw-dt);
        if(P.wst){ v.wsA+=Math.min(dt,was); while(v.wsA>=0.5-1e-9){ v.wsA-=0.5; for(const x of A.pick(T,u,{team:'enemy',within:3},{u})) T.fn.mdmg(A,T,u,x,0.2*(u.apow||0)); } }
        if(P.cref){ v.crA+=Math.min(dt,was); while(v.crA>=0.5-1e-9){ v.crA-=0.5; if(u.alive) E.healUnit(u,P.cref*u.maxHp); } } }
      if(has(T,CRO)){ const ev=u._evadeT||0; if(v.evT>0&&!(ev>0)&&!v.evd) A.stSet(T,u,'vlCr',stN(T,'vlCr')+1); v.evT=ev; }
      /* Second Pounce: once a wave, below 30% HP, Whiteout Pounce is ready at once */
      if(P.sp2&&!v.sp2&&u.alive&&u.hp<0.30*u.maxHp){ v.sp2=1; u.blueCd=0; }
      /* her records of enemies: Quills, Quill Freeze's lock, her stun on it (to what it really still has), its run in a row and the 0.5 s after, Cat's Grudge,
         Late Winters (its energy gain slowed) */
      for(const k in v.e){ const r=v.e[k], t=r.u; if(!t.alive){ delete v.e[k]; continue; }
        if(r.qt>0){ r.qt-=dt; if(r.qt<=1e-9){ r.qt=0; r.q=0; } }
        if(r.qfl>0) r.qfl=Math.max(0,r.qfl-dt); if(r.gr>0) r.gr=Math.max(0,r.gr-dt); if(r.cap>0) r.cap=Math.max(0,r.cap-dt);
        if(r.fz>0) r.fz=((t.stunned||0)>0)?Math.min(r.fz-dt,t.stunned):0;
        if(r.st>0){ r.re+=dt; r.st=((t.stunned||0)>0)?Math.min(r.st-dt,t.stunned):0; if(r.st<=1e-9){ if(r.re>=RUN_TOP-0.05) r.cap=LOCK; r.st=0; r.re=0; r.lk=LOCK; } }
        else if(r.lk>0) r.lk=Math.max(0,r.lk-dt);
        if(r.lw>0){ r.lw-=dt; const e=t.energy||0; if(r.nl!=null&&e>r.nl) t.energy=r.nl+(e-r.nl)*(1-(P.lwin||0)); r.nl=t.energy||0; if(r.lw<=0){ r.lw=0; r.nl=null; } } }
      /* her storm: Dead of the Year's claw each 1 s of it; its end */
      const s=v.st; if(s){ if((u._blizzT||0)>0&&u.alive){ if(P.doty){ s.cl+=dt; while(s.cl>=1-1e-9){ s.cl-=1; T.fn.claw(A,T,u); } } } else T.fn.stEnd(A,T,u); }
      /* Finishing Ring: the re-throw, one tick after the kill (outside the throw's own rows) */
      if(v.rq){ const t=v.rq; v.rq=null; if(t.alive&&u.alive&&E.castSlot){ v.re=1; const d0=T.s.d; T.s.d=0; try{ E.castSlot(u,'green',t); } finally{ T.s.d=d0; v.re=0; } } } },
    /* ---- SILENT ALTITUDE SPOILED. The page resets u._untouched for any enemy hit that reaches her (an evaded one in its evade block, the others right before
       the dodge rolls, where 'aimed' runs). While the passive holds that hit spoils it - unless Kept Height (the first each 10 s), the Owl's storm, or for an
       evaded hit Silent Pounce keeps it: then the time her tick kept is put back. A spoil: Stalk gone, Sulk, Cat's Grudge on the spoiler ---- */
    keep(A,T,u,c,evaded){ const v=V(T), P=T.P; if(!u._saOn||v.spl||!(u.pass&&u.pass.silentalt)) return;
      if((evaded&&P.spo)||(P.owl&&v.st&&v.st.owl&&(u._blizzT||0)>0)){ u._untouched=Math.max(3,v.ut||0); return; }
      if(P.kh&&!(v.kh>0)){ v.kh=KH_CD; u._untouched=Math.max(3,v.ut||0); return; }
      v.spl=1; T.fn.spoil(A,T,u,c.src); },
    aimed(A,T,u,c){ if((u._untouched||0)<=1e-9) T.fn.keep(A,T,u,c,false); },
    spoil(A,T,u,src){ const v=V(T), P=T.P;
      if(has(T,STALK)&&stN(T,'vlStalk')>0) A.stSet(T,u,'vlStalk',0); v.skT=0;
      if(has(T,SULK)){ v.sulk=3+(P['sulk.len']||0); v.ss=0; v.sulkFF=1; if(P.pout&&u.alive) A.eng().healUnit(u,P.pout*u.maxHp); if(P.lg) T.fn.cut(A,T,u,'green',P.lg); }
      if(P.grudge&&src&&src.alive&&src.team!==u.team) rec(T,src).gr=4; },
    /* ---- WHITEOUT POUNCE. The stance (its 2.2 s, Longer Whiteout); the evade (Crouch winds: Crouch; the evaded hit may spoil Silent Altitude); the counter
       (landPre: its Crouch spent, its target, its own size; land: On the Weakest's second strike, Snow Spring) ---- */
    wpCast(A,T,u,c){ const v=V(T); v.wpw=(c.o&&c.o.dur)||2.2; v.evd=0; v.wsA=0; v.crA=0; },
    evd(A,T,u,c){ const v=V(T); v.evd=1; if(has(T,CRO)) A.stSet(T,u,'vlCr',stN(T,'vlCr')+1); if(has(T,SA)&&(u._untouched||0)<=1e-9) T.fn.keep(A,T,u,c,true); },
    lp(A,T,u,c){ if(c.skill!=='counter') return; const v=V(T); v.ctrCr=stN(T,'vlCr'); if(v.ctrCr>0) A.stSet(T,u,'vlCr',0); v.ctrRaw=(u.apow||0)*(u._evadeMul||0); },
    ld(A,T,u,c){ if(c.skill!=='counter') return; const v=V(T), P=T.P, E=A.eng();
      if(P.spring) v.spr=3;
      if(P.weak&&!v.weak&&u.alive&&v.ctrRaw>0&&E.strike){ const t=A.pick(T,u,{team:'enemy',order:'lowHp',n:1},{u})[0];
        if(t){ v.weak=1; const pv=T.s.cur, d0=T.s.d; T.s.cur='counter'; T.s.d=0; u._frostHit=true; try{ E.strike(u,t,0.5*v.ctrRaw,'#bfe8ff','magic'); } finally{ u._frostHit=false; T.s.cur=pv; T.s.d=d0; v.weak=0; } } }
      v.ctrCr=0; },
    sprung(A,T){ return V(T).spr>0; },
    slowed(A,T,u){ return (u.slow||0)>0; },
    clrSlow(A,T,u){ u.slow=0; u.slowMul=null; },
    /* ---- FEATHERFANG. Its line, as the skill measures it (from 12 px behind her to 24 px past its aim, o.width to each side, centre to centre), the enemies on
       it in the order the ring passes them; the kit's carried bonuses (Sulk, The Long Wait, Moult, the Owl's next throw); at the cast: Twin Rings' second ring,
       Owl's Return, Finishing Ring's re-throw (queued) ---- */
    line(A,T,u,tg,ux,uy,len,W){ const L=[]; for(const e of A.eng().units()){ if(!e.alive||e.team===u.team||e._dropHidden||e._noTarget||(e._riseT>0)) continue;
        const rx=e.x-u.x, ry=e.y-u.y, pr=rx*ux+ry*uy; if(pr<-12||pr>len+24||Math.abs(rx*uy-ry*ux)>W) continue; L.push([e,pr]); }
      L.sort((a,b)=>a[1]-b[1]); return L.map(x=>x[0]); },
    ffAim(A,T,u,c){ const v=V(T); if(v.re&&v.reT&&v.reT.alive){ c.tgt=v.reT; } const tg=c.tgt; if(!tg) return; const o=c.o||{}, W=o.width||39.1;
      const dx=tg.x-u.x, dy=tg.y-u.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len, f=v.ff||(v.ff={});
      f.ux=ux; f.uy=uy; f.len=len; f.W=W; f.list=T.fn.line(A,T,u,tg,ux,uy,len,W); f.idx={}; f.list.forEach((e,i)=>{ f.idx[e.uid]=i; });
      f.raw=(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*(u._castSM||1)*(o.mul||1.6)*A.eng().rage(); },   // the skill's own damage to each enemy before resists (its options after every kit row)
    ffKit(A,T,u,c){ const v=V(T), P=T.P, o=c.o||{};
      const f=v.ff={hits:[],kill:0,re:!!v.re,sk:0,lw:0,mo:0,owl:0,list:[],idx:{},raw:0};
      if(v.sulkFF&&P['sulk.ff']){ f.sk=1; } v.sulkFF=0;
      if(P.lw&&v.lws>0){ f.lw=v.lws; v.lws=0; }
      if(P.moult&&stN(T,'vlFea')>=FEA_MAX){ f.mo=1; A.stSet(T,u,'vlFea',0); }
      if(v.owlFF){ f.owl=1; v.owlFF=0; } },
    ffCast(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), f=v.ff; if(!f) return;
      if(P.twin&&!f.twinDone&&E.strike&&u.alive){ f.twinDone=1; const W=f.W||39.1, a0=Math.atan2(f.uy,f.ux), best=[];
        for(const s of [1,-1]){ const a=a0+s*FORK, ux=Math.cos(a), uy=Math.sin(a); best.push(T.fn.line(A,T,u,null,ux,uy,f.len,W)); }
        const L2=best[1].length>best[0].length?best[1]:best[0];
        L2.forEach((e,i)=>{ f.idx[e.uid]=i; });
        const pv=T.s.cur, d0=T.s.d; T.s.cur=FF; T.s.d=0; u._frostHit=true; try{ for(const e of L2) if(e.alive) E.strike(u,e,f.raw,'#bfefff','magic'); } finally{ u._frostHit=false; T.s.cur=pv; T.s.d=d0; } }
      if(P.ret&&f.hits.length) for(const [e,a] of f.hits) if(e.alive&&a>0) A.hurt(T,u,e,0.5*a,'#bfefff');
      if(P.fin&&f.kill&&!f.re&&u.alive){ const t=A.pick(T,u,{team:'enemy',order:'lowHp',n:1},{u})[0]; if(t){ v.rq=t; v.reT=t; } }
      v.ff=null; },
    far6(A,T,u,c){ const t=c.tgt; return !!t&&(A.gap(u,t)>6*A.eng().METER()); },
    ringSlow(A,T){ return !!T.r.wc_3_3; },
    /* ---- WINTER PLUMAGE. The cast: its circle (Wide Storm), whether Silent Altitude held (the Owl). Each tick (the radius number, once a tick): the Moor's full
       Quills on every enemy inside, the tick's feathers counted from 0. Each enemy's freeze roll: its stun before (the stun limits), Winter Hunt. The end: the
       Owl's next throw, the Moor's 1.5 s freeze on every enemy with 3 Quills, Dead of the Year's Starving eaten at last ---- */
    stCast(A,T,u,c){ const v=V(T), P=T.P, M=A.eng().METER();
      v.st={cx:u._blizzX, cy:u._blizzY, R:(8+(P['st.r']||0))*M, n:0, owl:!!(P.owl&&u._saOn&&u.pass&&u.pass.silentalt), kill:0, ext:0, cl:0, tf:0}; for(const k in v.e) v.e[k].sh=0; },
    stTick(A,T,u,c){ const v=V(T), s=v.st; v.inTick=1; if(!s) return; s.n++; s.tf=0;
      if(T.P.moor) for(const x of A.eng().units()) if(x.alive&&x.team!==u.team&&inSt(T,x)) T.fn.addQ(A,T,u,x,Q_MAX,true); },
    stFrz(A,T,u,c){ const v=V(T), e=c.unit; v.pv=e?(e.stunned||0):0; v.pvE=e||null;
      if(T.P.wh&&e&&v.st){ let lo=null; for(const x of A.eng().units()) if(x.alive&&x.team!==u.team&&inSt(T,x)&&(!lo||x.hp<lo.hp)) lo=x; if(lo===e) c.amt*=1+T.P.wh; } },
    stEnd(A,T,u){ const v=V(T), s=v.st, P=T.P; v.st=null; if(!s) return;
      if(s.owl) v.owlFF=1;
      if(P.moor) for(const k in v.e){ const r=v.e[k]; if(r.u.alive&&r.qt>0&&r.q>=Q_MAX) T.fn.tstun(A,T,u,r.u,1.5,'moor'); }
      if(P.doty&&s.kill>0) T.fn.eat(A,T,u); },
    claw(A,T,u){ const v=V(T), E=A.eng(); let lo=null; for(const x of E.units()) if(x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget&&inSt(T,x)&&(!lo||x.hp<lo.hp)) lo=x;
      if(!lo||!E.strike) return; const pv=T.s.cur, d0=T.s.d; T.s.cur='claw'; T.s.d=0; u._frostHit=true; try{ E.strike(u,lo,0.8*(u.apow||0),'#bfefff','magic'); } finally{ u._frostHit=false; T.s.cur=pv; T.s.d=d0; } },
    inStorm(A,T,u,c){ return inSt(T,c.tgt); },
    tick(A,T,u,c){ return isTick(T,c); },
    tickSA(A,T,u,c){ return isTick(T,c)&&!!u._saOn; },
    /* ---- HER STUNS. Every stun of hers that lands (the storm's freezes through the page's direct write, her talents' through control): how long HER part is
       (its own length and Frozen Through, 4.0 s at most), never more than 4.0 s of her stuns in a row on one enemy, then 0.5 s free of them. A stun of hers that
       would go past is cut to end at 4.0 s, one inside that break is taken back; a stun on it from someone else stays (prev). Her kit alone cannot reach it
       (a freeze is 0.84 s, a 10% roll a tick): only Frozen Through, Winter Hunt and Dead of the Year's longer storms can ---- */
    ccOutF(A,T,u,c){ const v=V(T), t=c.tgt; if(!t) return;
      if(c.talent){ v.tpv=t.stunned||0; return; }
      if(v.inTick&&T.s.cur==null&&t===v.pvE&&T.P.ft) c.amt+=T.P.ft; },
    stunHit(A,T,u,c){ const v=V(T), t=c.tgt; if(!t||!t.alive||t.team===u.team||!(c.amt>0)) return;
      const storm=!c.talent&&v.inTick&&T.s.cur==null&&t===v.pvE; if(!c.talent&&!storm) return;
      const r=rec(T,t), run=r.st>0, prev=c.talent?(v.tpv||0):(v.pv||0), amt=c.amt; v.pv=0; v.pvE=null; v.tpv=0;
      const room=run?Math.max(0,RUN_TOP-r.re):RUN_TOP, L=(r.cap>0)?0:Math.min(STUN_TOP,amt,room);
      if(L<amt-1e-9) v.ts.trim++;
      t.stunned=Math.max(prev,L); if(!(L>1e-9)){ v.ts.cut++; return; }
      if(!run) r.re=0; r.st=Math.max(r.st,L); if(r.re+r.st>v.runMax) v.runMax=r.re+r.st;
      if(storm){ r.fz=Math.max(r.fz,L); if(T.P.moor) for(const x of A.pick(T,u,{team:'enemy',of:'target',within:3,skip:'target'},{u,tgt:t})) T.fn.addQ(A,T,u,x,1); } },
    /* a talent stun (the stun-lock rule): never on an enemy already stunned, nor within 0.5 s after one of her stuns on it ended (nor in the 0.5 s after a run of
       4.0 s). The stated seconds through the engine's control (no resist roll, no draw), then stunHit holds it to the limits. Returns true when it landed */
    tstun(A,T,u,t,secs,src){ const v=V(T); if(!t||!t.alive||t.team===u.team) return false; v.ts.n++;
      if((t.stunned||0)>0){ v.ts.onStun++; return false; } const r=recOf(T,t); if(r&&(r.lk>0||r.cap>0)){ v.ts.lkOk++; return false; }
      const pv=v.tsrc; v.tsrc=src; try{ A.control(T,u,t,'stunned',secs); } finally{ v.tsrc=pv; } return (t.stunned||0)>0; },
    frozen(A,T,u,c){ const r=recOf(T,c.tgt); return !!(r&&r.fz>0&&(c.tgt.stunned||0)>0); },
    /* ---- QUILLS: on enemies, 3 at most, 8 s after the last (Barbed Quills: longer). Gaining the 3rd: Quill Freeze (0.8 s, once per enemy every 8 s, the
       stun-lock rule) ---- */
    addQ(A,T,u,t,n,set){ if(!t||!t.alive||t.team===u.team||!has(T,QUI)) return; const r=rec(T,t), was=r.qt>0?r.q:0;
      r.q=Math.min(Q_MAX,set?Math.max(was,n):was+n); r.qt=Q_DUR+(T.P['q.dur']||0);
      if(was<Q_MAX&&r.q>=Q_MAX&&T.P.qf&&!(r.qfl>0)){ if(T.fn.tstun(A,T,u,t,0.8,'qf')) r.qfl=QF_LOCK; } },
    q1(A,T,u,c){ T.fn.addQ(A,T,u,c.tgt,1); },
    qN(A,T,u,c){ return qOf(T,c.tgt); },
    q3(A,T,u,c){ return qOf(T,c.tgt)>=Q_MAX; },
    ibOk(A,T,u,c){ const s=c.src; return !!s&&s!==u&&s.team===u.team&&qOf(T,c.tgt)>0; },
    /* ---- FEATHERS ---- */
    addFea(A,T,u,n){ if(!has(T,FEA)||!(n>0)) return; A.stSet(T,u,'vlFea',Math.min(FEA_MAX,stN(T,'vlFea')+n)); },
    fea5(A,T){ return Math.floor(stN(T,'vlFea')/5+1e-9); },
    fullFea(A,T,u,c){ return stN(T,'vlFea')>=FEA_MAX&&frost(T,c); },
    /* ---- HER HITS. out: what her states make a hit larger by (multiplied); crit: her forced critical hits; hit: what a landed hit leaves ---- */
    out(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt; if(!t||t.team===u.team) return; let k=1;
      if(T.s.cur===FF&&v.ff){ const f=v.ff; if(f.sk) k*=1+(P['sulk.ff']||0); if(P.ffL){ const i=f.idx[t.uid]; if(i>0) k*=1+0.10*i; } if(f.mo) k*=1.40; if(f.lw) k*=1+(P.lw||0)*f.lw; }
      if(T.s.cur==='counter'&&v.ctrCr>0&&P['cr.dmg']) k*=1+P['cr.dmg']*v.ctrCr;
      if(frost(T,c)){ const q=qOf(T,t); if(q>0&&P['q.dmg']) k*=1+P['q.dmg']*q; if(P.ctk&&q>=Q_MAX&&t.stunImmune) k*=1+P.ctk; }
      if(P.grudge){ const r=recOf(T,t); if(r&&r.gr>0) k*=1+P.grudge; }
      if(k!==1) c.amt*=k; },
    crit(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt; if(!t||t.team===u.team||c.force) return;
      if(c.auto&&v.ss){ v.ss=0; c.force=true; return; }
      if(T.s.cur===FF&&v.ff){ if(v.ff.owl){ c.force=true; return; } if(P.ff1&&v.ff.idx[t.uid]===0){ c.force=true; return; } }
      if(T.s.cur==='counter'&&P.spo){ c.force=true; return; }
      if(isTick(T,c)&&v.st&&v.st.owl&&T.fn.frozen(A,T,u,c)){ c.force=true; return; }
      if(T.s.cur==='claw'&&stN(T,'vlStv')>=10){ c.force=true; return; } },
    hit(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt, cur=T.s.cur, tk=isTick(T,c);
      if(c.crit&&P.hc&&!(v.hc>0)){ v.hc=HC_CD; u.energy=Math.min(100,(u.energy||0)+P.hc); }
      if(cur===FF&&v.ff){ const f=v.ff; f.hits.push([t,c.amt||0]); T.fn.addFea(A,T,u,1);
        if(has(T,QUI)){ let n=1; if(f.mo) n=Q_MAX; else { if(P.bpq&&c.crit) n=2; else if(P.barb&&A.eng().rnd()<P.barb) n=2; } T.fn.addQ(A,T,u,t,n,f.mo); }
        if(P.cring&&t.alive) A.acts(T,u,[{slow:P.cring,dur:2,on:'target'}],{u,tgt:t}); return; }
      if(cur==='counter'){ T.fn.addFea(A,T,u,1); v.lastCtr=t;
        if(P.bw&&u.alive&&c.amt>0) A.eng().healUnit(u,P.bw*c.amt);
        if(P.tb&&t.alive&&!v.weak) A.control(T,u,t,'silencedT',1.5);
        if(P.torn&&t.alive){ const q=qOf(T,t); if(q>0){ const r=rec(T,t); r.q=0; r.qt=0; T.fn.mdmg(A,T,u,t,0.3*(u.apow||0)*q); } } return; }
      if(cur==='claw'){ T.fn.addFea(A,T,u,1); return; }
      if(tk){ const s=v.st; if(s){ const lim=1+(P.shed||0); if(s.tf<lim){ s.tf++; T.fn.addFea(A,T,u,1); } }
        const r=has(T,QUI)||P.lwin?rec(T,t):null;
        if(r&&s){ r.sh=(r.sh||0)+1; if(P.gift&&(r.sh===1||r.sh===4||r.sh===7)&&Math.ceil(r.sh/3)<=P.gift) T.fn.addQ(A,T,u,t,1); }
        if(r&&P.lwin){ if(!(r.lw>0)) r.nl=t.energy||0; r.lw=4; } } },
    /* talent damage that her target's magic resist reduces (a magic hit of hers repeated by a talent): Whiteout Storm, Torn Out */
    mdmg(A,T,u,t,a){ if(!t||!t.alive||!(a>0)) return 0; const E=A.eng(); return A.hurt(T,u,t,a*(E.defMul?E.defMul(u,t,'magic'):1),'#bfe8ff'); },
    /* ---- HER KILLS: Starving eaten (Dead of the Year: kept until the storm ends, each kill 1 s more storm, 4 s at most), Second Strike, Gorged, Moor Feast,
       Finishing Ring ---- */
    kill(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt;
      if(v.ff&&T.s.cur===FF) v.ff.kill=1;
      if(P.ss2&&c.crit){ u._untouched=Math.max(3,u._untouched||0); v.spl=0; }
      if(P.gorge) u.energy=Math.min(100,(u.energy||0)+P.gorge);
      if(P.mf&&v.st&&(u._blizzT||0)>0&&t&&Math.hypot(t.x-v.st.cx,t.y-v.st.cy)<v.st.R&&u.alive) A.eng().healUnit(u,P.mf*u.maxHp);
      if(has(T,STV)){ v.svT=0; if(P.doty&&v.st&&(u._blizzT||0)>0){ v.st.kill++; if(v.st.ext<STORM_EXT){ v.st.ext++; u._blizzT+=1; u._castT=Math.max(u._castT||0,u._blizzT); } } else T.fn.eat(A,T,u); } },
    eat(A,T,u){ const v=V(T), P=T.P, n=stN(T,'vlStv'); if(!(n>0)) return; A.stSet(T,u,'vlStv',0);
      const h=n*((P['stv.h']||0)+(P['stv.h2']||0)); if(h>0&&u.alive) A.eng().healUnit(u,h*u.maxHp);
      if(P.oe&&n>=10&&u.alive) A.acts(T,u,[{shield:{pct:0.10,of:'maxHp'},dur:4}],{u,tgt:u});
      if(P['dr.belly']) v.bf=4;
      if(P.ns&&n>=10){ T.fn.cut(A,T,u,'green',P.ns); T.fn.cut(A,T,u,'blue',P.ns); } },
    /* ---- COOLDOWNS: Quick Feather, Light Ring (Featherfang, 3 s at least); Ready Pounce (Whiteout Pounce, 5 s at least); Cat Patience, Gathering Snow, Patient
       Hunter (both, 1% a rank each); Long Grudge and Never Sorry cut what is left, never under the floor counted from the cast ---- */
    cdSet(A,T,u,c){ const v=V(T), P=T.P, pc=Math.min(0.5,P['cd.pct']||0);
      if(c.slot==='green'){ v.gE=0; v.g0=null; c.amt=Math.max(Math.min(c.amt,FF_FLOOR),(c.amt-(P['cd.g']||0))*(1-pc)); }
      else if(c.slot==='blue'){ v.bE=0; c.amt=Math.max(Math.min(c.amt,WP_FLOOR),(c.amt-(P['cd.b']||0))*(1-pc)); } },
    cut(A,T,u,slot,x){ const v=V(T), f=slot==='blue'?'blueCd':'greenCd', fl=(slot==='blue'?WP_FLOOR:FF_FLOOR)-(slot==='blue'?v.bE:v.gE), cur=u[f]||0; if(!(cur>0)) return;
      u[f]=Math.max(0,Math.min(cur,Math.max(cur-x,fl))); },
    /* ---- HER DAMAGE REDUCTION, ONE GROUP. Every talent of hers that makes a hit on her smaller multiplies here (each takes its share of what is left), and
       together they never take more than 25% off a hit (DR_CAP; her base kit already has Whiteout Pounce's 45% to 55% stance) ---- */
    drK(A,T,u,src,kind,auto){ const P=T.P, v=V(T); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(v.sulk>0) cut(P['sulk.dr']);
      if(P['dr.fence']&&src&&stN(T,'vlStalk')>=5&&A.gap(u,src)>6*A.eng().METER()) cut(P['dr.fence']);
      if(auto){ cut(P['dr.soft']); cut(P['dr.nimble']); }
      if(P['dr.fluff']) cut(P['dr.fluff']*Math.floor(stN(T,'vlFea')/5+1e-9));
      if(P['dr.coil']) cut(P['dr.coil']*stN(T,'vlCr'));
      if(v.bf>0) cut(P['dr.belly']);
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.auto); },
    /* ---- CONDITIONS ---- */
    saOn(A,T,u){ return !!u._saOn&&!!(u.pass&&u.pass.silentalt); },
    sulking(A,T){ return V(T).sulk>0; },
    abil(A,T,u,c){ return !c.auto; },
    abil5(A,T,u,c){ return !c.auto&&stN(T,'vlStalk')>=5; },
    lastCtr(A,T,u,c){ const x=V(T).lastCtr; return !!x&&x===c.tgt; }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/60 - VAELORA VELVETCLAW - talent decisions.md) */
  ruling:{}
};
