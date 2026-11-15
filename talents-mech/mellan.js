/* MELLAN - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Mellan": what he added)
   His real kit (the code, not the tooltip wording; a Support, back row, a healer; everything he deals is magic and scales on ability power):
   - Hornet Cloud ('hornetswarm', green, cd 7): a cloud at the densest enemy group (densestEnemyCluster, 2.8 m) for 4 s. A controller in _bees stings every
     enemy whose CENTRE is within 2.8 m of the cloud's centre every 0.5 s for dps x 0.5 (dps = 42% of ability power x the skill curve), magic, through
     dealDamage. No DoT is pushed: the "poison" of the card is these stings. A guarded `at` line keeps its centre; partPre / part ('hornet') around each sting
     tick (ctx.tgt = the cloud's controller: cx, cy, R, life, tt, dps, tick).
   - Royal Nectar ('honeyglob', blue, cd 8): the most wounded ally by HP share, HIMSELF INCLUDED (on himself in 74 of 129 seeded casts), gets a glob that
     lands 0.45 s later: healFrom 15% of its max HP + 2x his ability power, and a heal over time of 4.5% + 0.4x his ability power a second for 5 s (pushHot,
     no caster). NO attack speed (the card says it raises attack speed; the code gives none). partPre / part ('nectar') around the landing: the heal goes
     through his healOut rows, the heal over time is made his (tag 'nectar') so its ticks run them too.
   - Hive Mind (ultimate 'hivemind', energy; HERO_ULT_ART.mellan is art only): 30 shares split evenly between every living unit on the field (allies and
     enemies), shuffled with the seeded stream; each lands 0.7 s+ later (beeLand): an ally gets healUnit(50% of his ability power x curve + 2% of its max HP)
     (no caster: his healMe / teamHeal rows see it with casting 'hive'), an enemy a sting of 14% of ability power, magic. partPre / part ('hive') around it.
   - Worker Swarm (passive 'beeward', from 3 stars): a worker bee on every living hero of his side (himself too; not summons); every 0.5 s it writes
     (0.4% of the ally's max HP + 8% of his ability power x passMul) x 0.5 straight onto its HP (no healUnit). A guarded num line ('bee', ctx.unit = the ally)
     before the write: a pulse at full HP heals nothing (76% of pulses in seeded fights). A worker is gone once its hero falls.
   Comb, the Hive store, Brood, Pointed, Welts, Fed, the Colony, Swarmed and Barbed exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/39 - MELLAN - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const CLOUD='hornetswarm', NECTAR='honeyglob', HIVE='hivemind', COL='#f4c531';
/* the families: each one's bookkeeping runs when any talent that reads it is learned */
const COMB=['gr_1_2','gr_n1','gr_2_2','gr_3_1','gr_3_2','gr_5_2','gr_8_1','gr_6_2','gr_9_1','gr_7_1','gr_11_3','gr_12_2','gr_12_3','gr_13_3'];
const STORE=['gr_2_3','gr_4_3','gr_10_2','gr_10_4','gr_11_3'];
const BROOD=['gr_4_4','gr_5_4','gr_8_4','gr_9_4','gr_12_4','gr_13_3'];
const PT=['ls_1_1','ls_1_4','ls_2_1','ls_3_1','ls_4_1','ls_8_1','ls_9_1','ls_10_1','ls_11_2','ls_13_2'];
const WELT=['ls_2_2','ls_4_2','ls_7_1','ls_7_2','ls_9_2','ls_6_2','ls_11_1','ls_11_2'];
const FED=['ls_4_4','ls_5_4','ls_7_4','ls_8_4','ls_10_4','ls_12_4','ls_13_2'];
const COLONY=['rm_1_1','rm_1_3','rm_2_3','rm_3_1','rm_3_3','rm_6_1','rm_7_2','rm_8_3','rm_9_4','rm_10_3','rm_11_2','rm_11_4','rm_13_2'];
const SWARM=['rm_2_2','rm_4_2','rm_7_4','rm_8_4','rm_9_4','rm_11_2','rm_12_2','rm_13_2'];
const BARB=['rm_4_1','rm_5_1','rm_7_1','rm_8_1','rm_10_1','rm_12_1','rm_13_2'];
/* the rows that change his worker bees' pulses, his clouds, his Nectar, his Hive Mind, hits on his allies and on him */
const WORKER=COMB.concat(STORE,BROOD,COLONY,SWARM,['gr_3_4','gr_7_3','gr_9_3','gr_10_3','ls_6_4','gr_7_1','rm_7_4']);
const CLOUDK=PT.concat(WELT,FED,BARB,['ls_1_3','ls_2_3','ls_3_4','ls_5_1','ls_6_4','ls_10_1','ls_5_2','ls_5_3','ls_6_2','ls_9_3','ls_6_3','ls_10_3','ls_12_1','rm_7_2','rm_9_2','rm_10_1']);
const NECK=COMB.concat(STORE,WELT,['gr_1_4','gr_5_1','gr_5_3','gr_6_1','gr_6_3','gr_7_1','ls_11_4','rm_1_1','rm_7_4','rm_12_3','rm_4_4']);
const HIVEK=COMB.concat(PT,WELT,COLONY,SWARM,STORE,['ls_12_2','rm_5_2','rm_5_4','rm_6_2','rm_6_3','rm_6_4','rm_10_2','gr_7_1','rm_7_4','gr_13_3']);
const TEAMDR=['gr_n1','gr_6_2','gr_8_2','ls_4_1','gr_6_4','rm_2_2'];
const SELFDR=TEAMDR.concat(['gr_5_4','gr_11_1','gr_11_4','ls_1_4','ls_11_1','rm_9_1','rm_11_4']);
const TEAMIN=COMB.concat(TEAMDR,WELT,BARB,['rm_10_3']);
const DEATH=BROOD.concat(BARB,PT,['gr_6_4','rm_10_2','rm_13_2','ls_12_1']);
const GW=0.40;                                       // Guarding Workers: an ally below 40% HP calls a worker
const REGEN=0.012;                                   // the game's regeneration cap (Phil 4 Oct): his per-second talent healing on one unit, together
const ALLY_CAP=0.25, SELF_CAP=0.35;                  // his damage-reduction groups: at most 25% off a hit on an ally, 35% off a hit on him
const any=(T,L)=>{ const c=T.s.mAny||(T.s.mAny=new Map()); let v=c.get(L); if(v===undefined){ v=L.some(id=>T.r[id]); c.set(L,v); } return v; };
const frac=x=>x.maxHp>0?x.hp/x.maxHp:1;
const me=T=>T.s.me||(T.s.me={cb:{},rb:{},sw:{},f:{},hcL:[],hq:[],tb:{},gw:null,gwAt:-1,ch:[],lost:0,qg:0,ns:0,cs:0,bg:0,save:-1,olx:false,rsA:null,rsE:null,colW:0});
const team=(A,T,u)=>A.pick(T,u,{team:'ally'},{u});                                    // his side's heroes, himself too (summons have no worker)
const hasWorker=(u,x)=>!!(u.alive&&u.pass&&u.pass.beeward&&x&&x.alive&&x.team===u.team&&!x._summon&&!x.summoned&&!x._dropHidden);
const isPt=(A,T,u,x)=>!!x&&(!!A.markOf(u,x,'pt')||A.winOn(T,'otl'));                 // Pointed (Off the Leash: every enemy)
const cells=(T,x)=>{ const c=me(T).cb[x.uid]; return c?c.n:0; };
const colony=(A,T)=>A.stGet(T,'col');
/* how much a talent may still add to the per-second healing of x now: a budget that refills at 1.2% of its max HP a second (at most one second of it) */
function budget(A,T,x){ const E=A.eng(), now=E.now(), b=me(T).rb, cap=x.maxHp*REGEN; let e=b[x.uid]; if(!e) e=b[x.uid]={v:cap,t:now};
  e.v=Math.min(cap,e.v+(now-e.t)*cap); e.t=now; return e; }
function regen(A,T,x,amt){ if(!(amt>0)||!x.alive) return 0; const e=budget(A,T,x); const g=Math.min(amt,e.v); e.v-=g; return g; }
/* the heal of a Comb cell on x: Wax Cells' 1% of max HP per rank (at least 1%), Honeyed Wax, Golden Comb for a cell Hive Mind Honey set */
const cellHeal=(T,x,hive)=>x.maxHp*(0.01*Math.max(1,T.r.gr_1_2||0)+0.003*(T.r.gr_8_1||0)+(hive?0.002*(T.r.gr_12_3||0):0));
/* "Mellan's heals" made stronger on x (Royal Nectar, its heal over time, Hive Mind's honey, his workers): Royal Jelly (a Comb cell left), Honey Hands (Swarmed and 3 s after) */
function myHealK(A,T,u,x){ const r=T.r; let k=0; if(r.gr_7_1&&cells(T,x)>0) k+=0.02*r.gr_7_1; if(r.rm_7_4&&A.markOf(u,x,'swh')) k+=0.02*r.rm_7_4; return k; }
/* Hornet Cloud's damage to t (b: the cloud; first: its first sting on t): every bonus adds, No Mercy doubles */
function cloudK(A,T,u,t,b,first){ const r=T.r, Pp=T.P; let k=1+0.02*(r.ls_1_3||0)+0.05*(r.ls_6_4||0)+(r.ls_5_2?0.40:0)+0.02*(r.ls_4_4||0)*A.stGet(T,'fed');
  const pt=isPt(A,T,u,t); if(pt) k+=0.02*(r.ls_1_1||0)+0.03*(r.ls_10_1||0);
  if(first&&r.ls_3_4) k+=0.04*r.ls_3_4;
  if(r.ls_6_2&&r.ls_5_2&&A.ustGet(T,u,t,'welt')>=5) k+=0.03*r.ls_6_2;
  if(r.ls_9_3&&frac(t)<0.50) k+=0.03*r.ls_9_3;
  if(r.rm_10_1&&A.markOf(u,t,'barb')) k+=0.04*r.rm_10_1;
  if(r.ls_9_1&&pt&&frac(t)<0.30) k*=2;                                               // No Mercy
  return Math.max(0,k); }
/* the group of reductions on a hit on x from s (each multiplies: the combining rule); broke = this hit broke a Comb cell */
function teamF(A,T,u,x,s,broke){ const r=T.r, M=me(T), now=A.eng().now(); let k=1;
  if(broke&&r.gr_6_2) k*=1-0.015*r.gr_6_2;                                           // Well Kept Hives
  if(r.gr_n1&&s&&M.tb[s.uid+':'+x.uid]>now) k*=0.97;                                 // Tell the Bees
  if(r.gr_8_2&&hasWorker(u,x)) k*=1-0.005*r.gr_8_2;                                  // Low Gold Weather
  if(r.ls_4_1&&s&&s.target===x&&isPt(A,T,u,s)) k*=1-0.01*r.ls_4_1;                   // Grudge Kept
  if(r.gr_6_4&&s&&A.markOf(u,s,'stH')) k*=1-0.08*r.gr_6_4;                           // Stung Hands
  if(r.rm_2_2&&A.markOf(u,x,'sw')) k*=1-0.02*r.rm_2_2;                               // Settle on Him (Swarmed)
  return k; }
function selfF(A,T,u,s,kind){ const r=T.r; let k=1;
  if(r.gr_5_4) k*=1-0.01*r.gr_5_4*A.stGet(T,'brood');                               // Raised Again
  if(r.gr_11_1&&team(A,T,u).every(x=>hasWorker(u,x))) k*=1-0.015*r.gr_11_1;          // Calm King
  if(r.gr_11_4&&kind==='magic') k*=1-0.01*r.gr_11_4;                                 // River Country
  if(r.ls_1_4&&s&&isPt(A,T,u,s)) k*=1-0.03*r.ls_1_4;                                 // Unflinching
  if(r.ls_11_1&&s&&A.ustGet(T,u,s,'welt')>0) k*=1-0.015*r.ls_11_1;                   // A Man with a Grudge
  if(r.rm_9_1) k*=1-0.01*r.rm_9_1;                                                  // Steady Hive
  if(r.rm_11_4&&colony(A,T)>50) k*=1-0.015*r.rm_11_4;                                // The New Ones
  return k; }
/* a Comb cell on x breaks on this hit (at most one every 0.5 s on one ally; inside A Crown of Small Subjects every hit breaks one that is at once rebuilt, at most
   once a second). Returns true if one broke. Its heal lands right after the hit (the owner's next tick) */
function combBreak(A,T,u,x,s,c){ const E=A.eng(), now=E.now(), M=me(T), r=T.r; const cb=M.cb[x.uid]||(M.cb[x.uid]={n:0,h:0,br:-9,bd:-9});
  const crown=A.winOn(T,'crown');
  if(crown){ if(now-cb.br<1-1e-9) return false; cb.br=now; M.hq.push([x,cellHeal(T,x,cb.h>0)]); if(r.gr_n1&&s) M.tb[s.uid+':'+x.uid]=now+2; return true; }
  if(!(cb.n>0)||now-cb.br<0.5-1e-9) return false;
  cb.br=now; const hive=cb.h>0; cb.n--; if(hive) cb.h--; M.hq.push([x,cellHeal(T,x,hive)]);
  if(r.gr_n1&&s) M.tb[s.uid+':'+x.uid]=now+2;                                        // Tell the Bees: that enemy deals 3% less to that ally for 2 s
  if(cb.n<=0){ cb.n=0; cb.h=0;
    if(r.gr_3_2) M.hq.push([x,x.maxHp*0.06,true]);                                   // Sealed Comb: a shield of 6% of its max HP for 3 s, after the hit
    if(r.gr_n1&&r.ls_1_1&&s&&s.alive&&now>=(M.tbP||-9)){ M.tbP=now+8; A.setMark(T,u,s,'pt',{dur:4}); } }   // Tell the Bees with He Points: once every 8 s
  return true; }
module.exports={
  hero:'mellan',
  casting:true,                         // rows ask which of his skills a heal or a sting comes from
  points:true,                          // Hornet Cloud's centre (the at hook): the enemy at it is Pointed
  states:{
    col:{max:P('col.max',100)},                                                      // the Colony
    store:{max:{pct:P('store.max',0.25),of:'maxHp'}},                                // the Hive store (HP)
    brood:{max:P('brood.max',4)},                                                    // Brood (kept for the fight)
    fed:{max:P('fed.max',5)},                                                        // Fed (kept for the fight)
    welt:{unit:true,max:5,dur:P('welt.dur',5)}                                       // Welts on each enemy (all lapse that long after the last gain)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},
    {on:'wave',do:[{fn:'wv'}]},
    {on:'num',skill:'bee',reqAny:WORKER,do:[{fn:'bee'}]},                                                   // a worker bee's pulse
    {on:'at',skill:CLOUD,reqAny:PT,do:[{fn:'cloudAt'}]},                                                     // Hornet Cloud forms: the enemy at its centre is Pointed
    {on:'kit',skill:CLOUD,reqAny:CLOUDK,do:[{fn:'hcKit'}]},
    {on:'partPre',skill:'hornet',reqAny:CLOUDK,do:[{fn:'hcPre'}]}, {on:'part',skill:'hornet',reqAny:CLOUDK,do:[{fn:'hcPost'}]},
    {on:'out',reqAny:CLOUDK.concat(HIVEK),if:{targetTeam:'enemy'},do:[{fn:'myOut'}]},                        // his cloud's and his Hive Mind's stings
    {on:'hit',reqAny:CLOUDK.concat(HIVEK),if:{targetTeam:'enemy'},do:[{fn:'stung'}]},
    {on:'kill',reqAny:FED.concat(['ls_12_1']),do:[{fn:'kl'}]},
    {on:'cast',skill:NECTAR,reqAny:['rm_1_1'],do:[{fn:'ncCast'}]},
    {on:'partPre',skill:'nectar',reqAny:NECK,do:[{fn:'ncPre'}]}, {on:'part',skill:'nectar',reqAny:NECK,do:[{fn:'ncPost'}]},
    {on:'healOut',skill:'nectar',reqAny:NECK,do:[{fn:'ncHeal'}]},                                            // Royal Nectar's heal and each tick of its heal over time
    {on:'kit',skill:HIVE,reqAny:HIVEK,do:[{fn:'hvKit'}]}, {on:'cast',skill:HIVE,reqAny:HIVEK,do:[{fn:'hvCast'}]},
    {on:['teamHeal','healMe'],reqAny:HIVEK,if:{casting:'hive'},do:[{fn:'hvHeal'}]},                          // a share of Hive Mind's honey
    {on:'part',skill:'hive',reqAny:HIVEK,do:[{fn:'hvPart'}]},
    {on:'teamIn',reqAny:TEAMIN,do:[{fn:'tin'}]},                                                            // hits on his allies and on enemies
    {on:'in',reqAny:COMB.concat(SELFDR,['ls_7_2']),do:[{fn:'myIn'}]},                                                   // hits on him
    {on:'dotIn',reqAny:SELFDR,do:[{fn:'myDot'}]},
    {on:'death',reqAny:DEATH,do:[{fn:'dth'}]},
    {on:'teamHeal',reqAny:['rm_5_1'],do:[{fn:'barbHeal'}]},                                                   // Deep Barb: healing on a Barbed enemy
    {on:'teamLethal',reqAny:['rm_9_4'],do:[{fn:'save'}]}, {on:'lethal',reqAny:['rm_9_4'],do:[{fn:'saveMe'}]}
  ],
  talents:{
    /* ============================== THE GENTLE RULE ============================== */
    gr_1_1:[ {on:'ccIn',less:R(0.05),upTo:0.20} ],                                                             // Soft Hands (15% at 3/3; capped at 20%)
    gr_1_2:[ {param:'comb',add:R(1)} ],                                                                        // Wax Cells (Comb: ncPost / tin; 1% per rank: cellHeal)
    gr_1_4:[ {param:'nc.more',add:R(0.02)} ],                                                                  // Clover Honey
    gr_n1:[  {param:'tb',add:1} ],                                                                             // Tell the Bees (LINK; teamF; with He Points: combBreak)
    gr_2_2:[ {param:'comb.n',add:R(1)} ],                                                                      // Deep Comb
    gr_2_3:[ {param:'forage',add:R(0.005)} ],                                                                  // Foraging (bee; the store: ncPre)
    gr_3_1:[ {param:'pk',add:R(0.03)} ],                                                                       // Patient Keeper (bee)
    gr_3_2:[ {param:'sealed',add:1} ],                                                                         // Sealed Comb (combBreak)
    gr_4_3:[ {param:'store.max',add:R(0.05)} ],                                                                // Full Baskets
    gr_3_4:[ {param:'kind',add:R(0.03)} ],                                                                     // Kind Rule (bee)
    gr_5_1:[ {param:'thick',add:3} ],                                                                          // Thick Honey (PICK ONE; ncPost; halves Thick Nectar)
    gr_4_1:[ {on:'cd',skill:'blue',add:R(-0.2)} ],                                                             // Quick Honey
    gr_5_3:[ {param:'runny',add:0.40} ],                                                                       // Runny Honey (PICK ONE; ncPost)
    gr_4_4:[ {param:'brood.k',add:R(0.01)} ],                                                                  // The Brood (dth; bee)
    gr_6_1:[ {param:'drip',add:R(0.04)} ],                                                                     // Slow Drip (ncHeal, with Thick Honey)
    gr_5_2:[ {param:'summer',add:R(0.004)} ],                                                                  // Summer Flowers (ncPost)
    gr_6_3:[ {param:'runny',add:R(0.02)} ],                                                                    // Shared Jar: the drips 5% stronger per rank (40% x 1.05 per rank)
    gr_5_4:[ {param:'raised',add:R(0.01)} ],                                                                   // Raised Again (selfF)
    gr_8_1:[ {param:'wax',add:R(0.003)} ],                                                                     // Honeyed Wax (cellHeal)
    gr_6_2:[ {param:'wkh',add:R(0.015)} ],                                                                     // Well Kept Hives (teamF)
    gr_6_4:[ {param:'stung',add:R(0.08)} ],                                                                    // Stung Hands (dth; teamF)
    gr_9_1:[ {param:'builder',add:1} ],                                                                        // Comb Builder (tin / myIn)
    gr_7_1:[ {param:'jelly',add:R(0.02)} ],                                                                    // Royal Jelly (myHealK)
    gr_7_3:[ {param:'guard',add:1} ],                                                                          // Guarding Workers (bee)
    gr_8_2:[ {param:'lgw',add:R(0.005)} ],                                                                     // Low Gold Weather (teamF)
    gr_9_3:[ {param:'many',add:R(0.03)} ],                                                                     // Many Workers (bee)
    gr_8_4:[ {param:'nursery',add:R(0.005)} ],                                                                 // Nursery (tk; the regeneration cap)
    gr_9_4:[ {on:'cd',skill:'blue',add:R(-0.1),per:'brood'} ],                                                 // Busy Season
    gr_10_2:[ {param:'gstore',add:R(0.01)} ],                                                                  // Golden Store (ncHeal)
    gr_10_3:[ {param:'steady',add:R(0.04)} ],                                                                  // Steady Colony (bee)
    gr_10_4:[ {param:'qgift',add:R(1)} ],                                                                      // Queen's Gift (tk)
    gr_11_1:[ {param:'calm',add:R(0.015)} ],                                                                   // Calm King (selfF)
    gr_11_3:[ {param:'hmh',add:1} ],                                                                           // Hive Mind Honey (hvCast / hvPart)
    gr_11_4:[ {param:'river',add:R(0.01)} ],                                                                   // River Country (selfF)
    gr_12_2:[ {param:'fair',add:R(0.03)} ],                                                                    // Fair Rule (hvHeal)
    gr_12_3:[ {param:'gcomb',add:R(0.002)} ],                                                                  // Golden Comb (cellHeal)
    gr_12_4:[ {param:'brood.max',add:R(1)} ],                                                                  // Second Brood
    gr_13_3:[ {on:'cast',skill:HIVE,do:[{window:'crown',dur:8}]} ],                                            // A Crown of Small Subjects (SIGNATURE; bee / combBreak / tk)

    /* ============================== THE LEASH ============================== */
    ls_1_1:[ {param:'pt.dur',add:6} ],                                                                         // He Points (cloudAt; 2% per rank: cloudK, hvOut)
    ls_1_3:[ {param:'angry',add:R(0.02)} ],                                                                    // Angry Hornets (cloudK)
    ls_1_4:[ {param:'unfl',add:R(0.03)} ],                                                                     // Unflinching (selfF)
    ls_2_1:[ {param:'pt.dur',add:R(1)} ],                                                                      // Long Leash
    ls_2_2:[ {stat:{aspd:R(-0.005)},to:{team:'enemy',ust:{welt:1}},per:{ust:'welt'}} ],                        // Rising Welts (the Welts: stung)
    ls_3_1:[ {param:'chase',add:2} ],                                                                          // Let Them Go (tk)
    ls_4_2:[ {param:'welt.dur',add:R(1)} ],                                                                    // Swelling
    ls_2_3:[ {param:'wide',add:R(0.03)} ],                                                                     // Wide Cloud (hcKit: its radius)
    ls_3_4:[ {param:'sharp',add:R(0.04)} ],                                                                    // Sharp Sting (cloudK)
    ls_4_1:[ {param:'grudge',add:R(0.01)} ],                                                                   // Grudge Kept (teamF)
    ls_5_1:[ {param:'long',add:R(0.2)} ],                                                                      // Long Poison (hcKit)
    ls_4_4:[ {param:'eat',add:R(0.02)} ],                                                                      // Eat Well (kl; cloudK)
    ls_6_1:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.02)} ],                                   // Bad War
    ls_5_4:[ {on:'cd',skill:'green',if:{stackMin:{fed:3}},add:R(-0.1)} ],                                      // Bold Hornets
    ls_7_1:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},chance:R(0.06),do:[{ustack:'welt',on:'target'}]} ],   // Hard Bargain
    ls_8_1:[ {param:'again',add:R(1)} ],                                                                       // Marked Again (dth)
    ls_6_4:[ {param:'loose',add:R(0.05)} ],                                                                    // Loose Grip (RISK; bee, cloudK)
    ls_10_1:[ {param:'fury',add:R(0.03)} ],                                                                    // Leashed Fury (cloudK)
    ls_7_2:[ {param:'smell',add:1} ],                                                                          // Hornet Nectar (ncPost / tin)
    ls_9_1:[ {param:'mercy',add:1} ],                                                                          // No Mercy (cloudK)
    ls_7_4:[ {param:'refused',add:R(0.005)} ],                                                                 // Never Refused (kl)
    ls_5_2:[ {param:'one',add:1} ],                                                                            // One Target (PICK ONE; hcKit, cloudK)
    ls_9_2:[ {param:'sticky',add:R(0.3)} ],                                                                    // Sticky Smell (tin)
    ls_5_3:[ {param:'rein',add:1} ],                                                                           // Free Rein (PICK ONE; hcKit, hcPre)
    ls_6_2:[ {param:'knot',add:R(0.03)} ],                                                                     // Tight Knot (cloudK)
    ls_9_3:[ {param:'season',add:R(0.03)} ],                                                                   // Hornet Season (cloudK)
    ls_6_3:[ {param:'wild',add:R(0.04)} ],                                                                     // Running Wild (stung)
    ls_8_4:[ {param:'fed.max',add:R(1)} ],                                                                     // Full Bellies
    ls_10_3:[ {param:'stings',add:R(1)} ],                                                                     // Stinger Swarm (hcKit)
    ls_10_4:[ {param:'hunt',add:R(2)} ],                                                                       // Hunting Hornets (kl)
    ls_11_1:[ {param:'grudgeM',add:R(0.015)} ],                                                                // A Man with a Grudge (selfF)
    ls_11_2:[ {param:'hith',add:1} ],                                                                          // Hornets in the Hive (hvPart)
    ls_11_4:[ {param:'nc.more',add:R(0.02)} ],                                                                 // Rough Honey
    ls_12_1:[ {param:'asked',add:R(1)} ],                                                                      // Never Asked (kl / dth)
    ls_12_2:[ {param:'every',add:R(0.02)} ],                                                                   // Every Sting (myOut)
    ls_12_4:[ {stat:{aspd:R(0.003)},per:'fed'} ],                                                              // Glutton
    ls_13_2:[ {on:'cast',skill:HIVE,do:[{window:'otl',dur:8},{fn:'otlArm'}]} ],                                // Off the Leash (SIGNATURE; isPt, stung)

    /* ============================== REPLACED BY MORNING ============================== */
    rm_1_1:[ {param:'gold',add:R(2)} ],                                                                        // Gold Weather (ncCast)
    rm_1_4:[ {on:'wave',once:'fight',do:[{fn:'reach',by:R(0.03)}]} ],                                          // Low Hum
    rm_1_3:[ {param:'forty',add:R(0.01)} ],                                                                    // Forty Thousand (the Colony: wv / bee)
    rm_2_2:[ {param:'settle',add:R(0.02)} ],                                                                   // Settle on Him (Swarmed: tk; teamF)
    rm_2_3:[ {param:'hatch',add:R(2)} ],                                                                       // New Hatch (tk)
    rm_3_1:[ {param:'patient',add:R(0.04)} ],                                                                  // Patient Swarm (a seeded roll in bee)
    rm_3_3:[ {param:'two',add:1} ],                                                                            // Every Hive Within a Day (bee)
    rm_7_4:[ {param:'hands',add:R(0.02)} ],                                                                    // Honey Hands (myHealK)
    rm_4_1:[ {param:'barb',add:R(0.02)} ],                                                                     // Last Sting (dth; tin)
    rm_4_2:[ {param:'sw.dur',add:R(0.5)} ],                                                                    // Heavy Swarm
    rm_4_4:[ {param:'tnec',add:R(0.02)}, {stat:{aspd:R(0.02)},to:{team:'ally',has:'tn'},unless:'gr_5_1'},      // Thick Nectar: its ally attacks faster while the heal over time runs (ncPost's mark)
             {stat:{aspd:R(0.01)},to:{team:'ally',has:'tn'},req:'gr_5_1'} ],                                    //   (halved by Thick Honey)
    rm_5_1:[ {param:'deep',add:R(0.03)} ],                                                                     // Deep Barb (tin: teamHeal)
    rm_5_2:[ {param:'royal',add:1} ],                                                                          // Royal Share (PICK ONE; hvCast / myOut / hvHeal)
    rm_5_3:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                            // Busy Morning
    rm_5_4:[ {param:'fairS',add:0.15} ],                                                                       // Fair Shares (PICK ONE)
    rm_6_1:[ {param:'spent',add:R(0.04)} ],                                                                    // Spent Colony (RISK; tk, bee)
    rm_6_2:[ {param:'due',add:R(0.05)} ],                                                                      // Crown's Due (myOut)
    rm_6_3:[ {param:'rain',add:R(0.02)} ],                                                                     // Gold Rain (hvHeal)
    rm_6_4:[ {param:'even',add:R(0.03)} ],                                                                     // Even Hand (hvHeal)
    rm_7_1:[ {param:'broken',add:R(0.02)} ],                                                                   // Broken Stinger (dth)
    rm_7_2:[ {param:'scloud',add:1} ],                                                                         // Swarm Cloud (hcKit / stung)
    rm_8_1:[ {param:'spread',add:R(1)} ],                                                                      // Barb Spread (dth)
    rm_8_3:[ {param:'col.max',add:R(2)} ],                                                                     // Kept by Morning (wv)
    rm_8_4:[ {param:'close',add:R(0.01)} ],                                                                    // Close Swarm (tk; the regeneration cap)
    rm_9_1:[ {param:'steadyH',add:R(0.01)} ],                                                                  // Steady Hive (selfF)
    rm_9_2:[ {param:'thickC',add:R(0.2)} ],                                                                    // Thick Cloud (stung)
    rm_9_4:[ {param:'die',add:1} ],                                                                            // They Die for Him (save)
    rm_10_1:[ {param:'wildB',add:R(0.04)} ],                                                                   // Wild Barbs (cloudK)
    rm_10_3:[ {param:'song',add:R(0.01)} ],                                                                    // Hive Song (tin)
    rm_11_1:[ {on:'cd',less:R(0.01)} ],                                                                        // King's Patience (both skills)
    rm_11_2:[ {param:'hom',add:1} ],                                                                           // Hive of Morning (hvCast / hvPart)
    rm_11_4:[ {param:'newones',add:R(0.015)} ],                                                                // The New Ones (selfF)
    rm_12_1:[ {param:'barb',add:R(0.01)} ],                                                                    // Sting and Die
    rm_12_2:[ {param:'dawn',add:R(0.3)} ],                                                                     // Dawn Hatch (hvPart)
    rm_12_3:[ {param:'nc.more',add:R(0.02)} ],                                                                 // Shared Nectar
    rm_10_2:[ {param:'fallen',add:R(0.02)} ],                                                                  // Count the Fallen (myOut / hvHeal)
    rm_13_2:[ {param:'wtk',add:1} ]                                                                            // Whether They Know (SIGNATURE; hvCast / dth / bee)
  },
  fn:{
    /* ---------------- each tick ---------------- */
    tk(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, M=me(T), now=E.now(), dt=c.dt||0;
      /* Comb cells that broke: their heal, right after the hit */
      if(M.hq.length){ const q=M.hq; M.hq=[]; for(const [x,a,sh] of q) if(x.alive){ if(sh){ x.shield=(x.shield||0)+a; x.shieldT=Math.max(x.shieldT||0,3); } else E.healUnit(x,a); } }   // (Sealed Comb's shield: after the hit too)
      /* the Colony refills: New Hatch, 2 a second per rank (Spent Colony: 30% slower) */
      if(Pp.hatch&&any(T,COLONY)) A.stSet(T,u,'col',colony(A,T)+Pp.hatch*dt*(r.rm_6_1?0.7:1));
      /* Swarmed: an ally (Mellan too) that drops below 35% HP, once every 12 s per ally */
      if(any(T,SWARM)){ for(const x of team(A,T,u)){ const f=frac(x), p=M.f[x.uid]; M.f[x.uid]=f; if(p==null) continue;
          if(p>=0.35&&f<0.35&&r.rm_2_2&&!(M.sw[x.uid]>now)){ M.sw[x.uid]=now+12; T.fn.swarm(A,T,u,x,3+(Pp['sw.dur']||0)); } } }
      /* his per-second talent heals on one unit (Nursery, Close Swarm), inside the regeneration cap */
      if(Pp.nursery||Pp.close){ M.ns+=dt; if(M.ns>=1-1e-9){ M.ns-=1;
          if(Pp.nursery&&frac(u)<0.50){ const a=regen(A,T,u,u.maxHp*Pp.nursery*A.stGet(T,'brood')); if(a>0) E.healUnit(u,a); }
          if(Pp.close) for(const x of team(A,T,u)) if(A.markOf(u,x,'sw')){ const a=regen(A,T,x,x.maxHp*Pp.close); if(a>0) E.healUnit(x,a); } } }
      /* Queen's Gift: while the Hive store is full, every ally (Mellan too) gains 1 energy per rank every 3 s */
      if(Pp.qgift){ const mx=A.stMax(T,u,'store'); if(mx>0&&A.stGet(T,'store')>=mx-1e-6){ M.qg+=dt; if(M.qg>=3-1e-9){ M.qg-=3; for(const x of team(A,T,u)) x.energy=Math.min(100,(x.energy||0)+Pp.qgift); } } else M.qg=0; }
      /* A Crown of Small Subjects: each Brood guards the most wounded living ally as a worker does (every 0.5 s) */
      if(A.winOn(T,'crown')&&A.stGet(T,'brood')>0){ M.bg+=dt; if(M.bg>=0.5-1e-9){ M.bg-=0.5; const L=team(A,T,u).filter(x=>x.hp<E.healCap(x)).sort((a,b)=>frac(a)-frac(b)); const x=L[0];
          if(x){ const h=(x.maxHp*0.004+(u.apow||0)*0.08*(u.passMul||1))*0.5*A.stGet(T,'brood'); E.healUnit(x,h); } } } else M.bg=0;
      /* his clouds: one that has ended (Let Them Go: the hornets chase its Pointed enemy 2 s more) */
      for(let i=0;i<M.hcL.length;i++){ const b=M.hcL[i]; if(b.tt<b.life-1e-9) continue; M.hcL.splice(i--,1);
        if(Pp.chase){ const t=b._talR&&b._talR.pt; if(t&&t.alive&&isPt(A,T,u,t)) M.ch.push({t,b,until:now+Pp.chase,acc:0}); } }
      for(let i=0;i<M.ch.length;i++){ const h=M.ch[i]; if(!h.t.alive||now>h.until+1e-9){ M.ch.splice(i--,1); continue; } h.acc+=dt; if(h.acc<0.5-1e-9) continue; h.acc-=0.5;
        const a=h.b.dps*0.5*cloudK(A,T,u,h.t,h.b,false)*(1+0.02*(r.ls_6_1||0))*E.defMul(u,h.t,'magic'); A.hurt(T,u,h.t,a,COL,'chase'); if(h.t.alive) T.fn.execute(A,T,u,h.t); } },
    wv(A,T,u){ const M=me(T), s=T.s; M.f={}; M.gw=null; M.save=-1; M.hcL=[]; M.ch=[]; M.hq=[];
      if(any(T,COLONY)){ const was=colony(A,T); A.stSet(T,u,'col',(s.wave>1&&T.r.rm_8_3)?100+Math.max(0,was-100):100); } },   // a full Colony of 100 each wave; Kept by Morning carries what is above 100
    /* Low Hum: his attack reach 3% longer per rank (once, at the fight's first wave) */
    reach(A,T,u,c,a){ u.range=(u.range||0)*(1+(a.by||0)); },
    /* Swarmed for d s (a mark), and Honey Hands' 3 s after it */
    swarm(A,T,u,x,d){ if(!x||!x.alive||!(d>0)) return; A.setMark(T,u,x,'sw',{dur:d,longest:true}); A.setMark(T,u,x,'swh',{dur:d+3,longest:true}); },
    /* ---------------- his worker bees ---------------- */
    bee(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, M=me(T), x=c.unit, h=c.amt; if(!x||!u.alive||!(h>0)) return; const now=E.now(), full=x.hp>=E.healCap(x)-1e-9;
      /* Foraging: a worker on an ally at full HP brings 0.5% of its max HP per rank a second into the Hive store */
      if(full){ if(any(T,STORE)) A.stSet(T,u,'store',A.stGet(T,'store')+x.maxHp*0.005*Math.max(1,r.gr_2_3||0)*0.5); return; }
      /* Guarding Workers: this worker was called to an ally below 40% HP (it heals that ally instead) */
      if(r.gr_7_3){ const y=T.fn.called(A,T,u,x); if(y){ const hy=(y.maxHp*0.004+(u.apow||0)*0.08*(u.passMul||1))*0.5, a=regen(A,T,y,hy*(1+0.03*(r.gr_9_3||0)+T.fn.k(A,T,u,y)));
          if(a>0) E.healUnit(y,a); c.amt=0; return; } }
      /* the Colony: each heal spends 1 (2 with two workers); Patient Swarm: a seeded chance that it costs nothing; Whether They Know's window: free */
      let w=1;
      if(any(T,COLONY)){ const n=colony(A,T); if(r.rm_3_3&&n>75) w=2;
        const free=A.winOn(T,'wtk')||(Pp.patient>0&&E.rnd()<Pp.patient); if(!free) A.stSet(T,u,'col',n-w); }
      let k=T.fn.k(A,T,u,x);
      if(any(T,COLONY)&&colony(A,T)+w>50&&Pp.forty) k+=Pp.forty;                           // Forty Thousand (the Colony before this heal)
      const add=h*((1+k)*w-1), room=Math.max(0,E.healCap(x)-x.hp-h);
      let got=add<0?add:regen(A,T,x,Math.min(add,room));                                   // what talents add to his workers: inside the regeneration cap (Loose Grip's cut: as written)
      if(A.winOn(T,'crown')) got+=2*h;                                                     // A Crown of Small Subjects: tripled (the signature's window, on top of the cap)
      c.amt=Math.max(0,h+got); },
    /* how much stronger a worker's heal is on x (every bonus adds; Loose Grip takes away) */
    k(A,T,u,x){ const r=T.r, Pp=T.P; let k=myHealK(A,T,u,x)+(Pp.kind||0)+(Pp.spent||0)-(Pp.loose||0);
      if(Pp.pk&&cells(T,x)>0) k+=Pp.pk; if(Pp.steady&&frac(x)<0.50) k+=Pp.steady;
      if(Pp['brood.k']) k+=Pp['brood.k']*A.stGet(T,'brood'); void r; return k; },
    /* Guarding Workers: each ally below 40% HP calls the worker of the nearest other ally that is not below 40% itself (one helper each, worked out once a tick) */
    called(A,T,u,x){ const E=A.eng(), M=me(T), now=E.now();
      if(M.gwAt!==now){ M.gwAt=now; M.gw={}; const L=team(A,T,u).filter(y=>hasWorker(u,y)), low=L.filter(y=>frac(y)<GW).sort((a,b)=>frac(a)-frac(b)), used={};
        for(const y of low){ let best=null, bd=Infinity; for(const z of L){ if(z===y||frac(z)<GW||used[z.uid]) continue; const d=E.dist(z,y); if(d<bd){ bd=d; best=z; } } if(best){ used[best.uid]=1; M.gw[best.uid]=y; } } }
      const y=M.gw[x.uid]; return (y&&y.alive&&frac(y)<GW)?y:null; },
    /* ---------------- Hornet Cloud ---------------- */
    cloudAt(A,T,u,c){ const M=me(T), t=A.pick(T,u,{team:'enemy',of:'pt',order:'near',n:1},c)[0]||null; M.ptPend=t;
      if(t) A.setMark(T,u,t,'pt',{dur:T.P['pt.dur']||6,longest:true}); },
    hcKit(A,T,u,c){ const Pp=T.P, o=c.o; if(!o) return; let R=o.radius||2.8*A.eng().METER();
      R*=1+(Pp.wide||0); if(Pp.one) R*=Math.SQRT1_2; if(Pp.rein) R*=1.30; o.radius=R;           // Wide Cloud; One Target: half the area; Free Rein: 30% wider
      o.dur=(o.dur||4)+(Pp.long||0);                                                         // Long Poison
      if(Pp.stings) o.dps=(o.dps||0.4)*(1+Pp.stings/8);                                       // Stinger Swarm: one more sting of the 8 per rank
      const M=me(T); M.scNext=false; if(Pp.scloud&&colony(A,T)>=20){ A.stSet(T,u,'col',colony(A,T)-20); M.scNext=true; } },   // Swarm Cloud: 20 Colony
    hcPre(A,T,u,c){ const E=A.eng(), M=me(T), b=c.tgt; if(!b) return; M.hc=b;
      if(!b._talR){ b._talR={f:{},sc:!!M.scNext,pt:M.ptPend||null,na:false}; M.scNext=false; M.ptPend=null; M.hcL.push(b); }   // a new cloud (its first sting tick): what its cast set up
      if(T.P.rein){ const L=A.pick(T,u,{team:'enemy',of:'pt',order:'near',n:1},{u,pt:{x:b.cx,y:b.cy,pt:true}}); const e=L[0];   // Free Rein: the cloud drifts 1 m a second toward the nearest enemy
        if(e){ const dx=e.x-b.cx, dy=e.y-b.cy, d=Math.hypot(dx,dy), st=Math.min(d,1*E.METER()*(b.tick||0.5)); if(d>1){ b.cx+=dx/d*st; b.cy+=dy/d*st; } } } },
    hcPost(A,T,u,c){ me(T).hc=null; },
    /* his cloud's and his Hive Mind's stings */
    myOut(A,T,u,c){ const r=T.r, Pp=T.P, M=me(T), t=c.tgt, cur=T.s.cur; if(!t) return;
      if(cur==='hornet'&&M.hc){ const R0=M.hc._talR, first=!!R0&&!R0.f[t.uid]; if(R0) R0.f[t.uid]=1; c.amt*=cloudK(A,T,u,t,M.hc,first); return; }
      if(cur==='hive'){ let k=1+(Pp.every||0)+(Pp.fairS||0)+(Pp.fallen||0)*Math.min(5,M.lost)+(isPt(A,T,u,t)?0.02*(r.ls_1_1||0):0);
        if(Pp.royal&&M.rsE===t) k=2*k*(1+(Pp.due||0));                                       // Royal Share (Crown's Due: those double stings)
        c.amt*=k; } },
    stung(A,T,u,c){ const r=T.r, Pp=T.P, M=me(T), t=c.tgt, cur=T.s.cur; if(!t||(cur!=='hornet'&&cur!=='hive')) return;
      if(cur==='hornet'&&t.alive){
        if(any(T,WELT)) A.acts(T,u,[{ustack:'welt',on:'target',lock:'weltL',lockDur:0.95}],c);   // Rising Welts: 1 a second in the cloud
        const b=M.hc, d=0.6+(Pp.thickC||0);
        if(b&&b._talR&&b._talR.sc) A.acts(T,u,[{slow:0.20,dur:d,on:'target'}],c);            // Swarm Cloud (Thick Cloud: longer)
        if(Pp.wild&&Pp.rein) A.acts(T,u,[{slow:Pp.wild,dur:0.6,on:'target'}],c); }           // Running Wild
      if(t.alive) T.fn.execute(A,T,u,t); },
    /* Off the Leash: an enemy under 10% of its max HP that a hornet stings is finished (Feeding the hornets); a boss instead takes 8% of its max HP, once per Hive Mind */
    execute(A,T,u,t){ if(!A.winOn(T,'otl')||!t.alive||!(t.hp<0.10*t.maxHp)) return; const M=me(T), boss=!!((t.t&&t.t.isboss)||t._raidBoss);
      if(boss){ if(M.olx) return; M.olx=true; A.hurt(T,u,t,t.maxHp*0.08,COL,'olxB'); return; }
      A.hurt(T,u,t,((t.hp||0)+(t.shield||0))*20+1,COL,'olx'); },
    otlArm(A,T,u){ me(T).olx=false; },
    /* an enemy his hornets killed: Fed (Eat Well's family), Never Refused, Hunting Hornets, Never Asked */
    kl(A,T,u,c){ const Pp=T.P, M=me(T), cur=T.s.cur, tag=c.tag, t=c.tgt; if(!(cur==='hornet'||tag==='chase'||tag==='olx')) return;
      if(t){ const fs=M.fs||(M.fs={}); if(fs[t.uid]) return; fs[t.uid]=1; }                // each enemy once (a finishing sting inside a sting's own hit is one kill)
      if(any(T,FED)){ A.stSet(T,u,'fed',A.stGet(T,'fed')+1);
        if(Pp.refused) A.eng().healUnit(u,u.maxHp*Pp.refused); if(Pp.hunt) u.energy=Math.min(100,(u.energy||0)+Pp.hunt); }
      if(Pp.asked&&cur==='hornet'&&M.hc&&M.hc._talR&&!M.hc._talR.na){ M.hc._talR.na=true; M.hc.life+=Pp.asked; } },
    /* ---------------- Royal Nectar ---------------- */
    ncCast(A,T,u){ if(T.P.gold&&any(T,COLONY)) A.stSet(T,u,'col',colony(A,T)+T.P.gold*(T.r.rm_6_1?0.7:1)); },   // Gold Weather (Spent Colony: 30% less)
    ncPre(A,T,u,c){ const M=me(T), t=c.tgt; M.ncT=t; M.ncSt=0; M.ncGs=0; if(any(T,STORE)){ const st=A.stGet(T,'store'); if(st>0){ M.ncSt=st; M.ncGs=Math.floor(st/(0.05*u.maxHp)+1e-9); A.stSet(T,u,'store',0); } } },
    ncHeal(A,T,u,c){ const Pp=T.P, M=me(T), x=c.unit; if(!x) return;
      let k=1+(Pp['nc.more']||0)+myHealK(A,T,u,x);
      if(c.hot){ if(T.r.gr_5_1&&Pp.drip) k+=Pp.drip; c.amt*=k; return; }                      // a tick of its heal over time (Slow Drip, with Thick Honey)
      if(Pp.gstore&&M.ncGs>0) k+=Pp.gstore*M.ncGs;                                            // Golden Store
      c.amt=c.amt*k+(M.ncSt||0); M.ncSt=0; M.ncOff=c.amt*(u.healPowMul||1); },                 // the Hive store spent as extra healing
    ncPost(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, M=me(T), x=c.tgt; if(!x||!x.alive) return;
      /* its heal over time: his (his rows see each tick); Thick Honey 3 s longer */
      const H=x.hots||[], h=H[H.length-1]; let hd=5;
      if(h&&!h._talU){ h._talU=u; h._talK='nectar'; if(Pp.thick){ h.remaining+=Pp.thick; } hd=h.remaining*(h.interval||1); }
      /* Comb: Summer Flowers (each cell left heals before the new Comb sets), then the new Comb (3 cells, Deep Comb more) */
      if(any(T,COMB)){ const cb=M.cb[x.uid]||(M.cb[x.uid]={n:0,h:0,br:-9}); if(Pp.summer&&cb.n>0) E.healUnit(x,x.maxHp*Pp.summer*cb.n); cb.n=3+(Pp['comb.n']||0); cb.h=0; }
      /* Runny Honey: the 2 allies nearest it (Mellan may be one) get its heal and its heal over time at 40% (Shared Jar more) */
      if(Pp.runny&&r.gr_5_3){ const L=A.pick(T,u,{team:'ally',of:'target',order:'near',n:2,skip:'target'},{u,tgt:x}), off=M.ncOff||0;
        for(const y of L){ if(off>0) E.healUnit(y,off*Pp.runny); if(h) E.pushHot(y,h.hps*Pp.runny,5,h.interval||1); } }
      if(Pp.smell) A.setMark(T,u,x,'smell',{dur:hd});                                          // Hornet Nectar: its smell while the heal over time runs
      if(Pp.tnec) A.setMark(T,u,x,'tn',{dur:hd});                                              // Thick Nectar: attack speed while the heal over time runs
      M.ncOff=0; },
    /* ---------------- Hive Mind ---------------- */
    hvKit(A,T,u,c){ const E=A.eng(), M=me(T), Pp=T.P;
      if(Pp.royal){ const al=team(A,T,u).slice().sort((a,b)=>frac(a)-frac(b)); M.rsA=al[0]||null; M.rsE=A.pick(T,u,{team:'enemy',order:'strong',n:1},c)[0]||null; } void E; },
    hvCast(A,T,u,c){ const E=A.eng(), Pp=T.P, M=me(T), tm=team(A,T,u);
      if((Pp.hom||Pp.wtk)&&any(T,COLONY)) A.stSet(T,u,'col',A.stMax(T,u,'col'));                // Hive of Morning, Whether They Know: the whole Colony
      if(Pp.wtk) for(const x of tm) T.fn.swarm(A,T,u,x,3);                                      // Whether They Know: every ally Swarmed 3 s
      if(Pp.hmh&&any(T,STORE)){ const st=A.stGet(T,'store'); if(st>0&&tm.length){ A.stSet(T,u,'store',0); for(const x of tm) E.healUnit(x,st/tm.length); } } },   // Hive Mind Honey: the store into the team
    hvHeal(A,T,u,c){ const Pp=T.P, M=me(T), x=c.unit; if(!x) return;
      let k=1+(Pp.rain||0)+(Pp.fairS||0)+(Pp.fairS?(Pp.even||0):0)+(Pp.fallen||0)*Math.min(5,M.lost)+myHealK(A,T,u,x);
      if(Pp.fair&&cells(T,x)<=0) k+=Pp.fair;                                                   // Fair Rule
      if(Pp.royal&&M.rsA===x) k*=2;                                                            // Royal Share
      c.amt*=k; },
    hvPart(A,T,u,c){ const M=me(T), Pp=T.P, x=c.tgt; if(!x||!x.alive) return;
      if(x.team===u.team){
        if(Pp.hmh){ const cb=M.cb[x.uid]||(M.cb[x.uid]={n:0,h:0,br:-9}); cb.n=Math.min(10,cb.n+2); cb.h=Math.min(cb.n,cb.h+2); }   // Hive Mind Honey: 2 cells (at most 10 on one ally)
        if(Pp.hom) T.fn.swarm(A,T,u,x,2+(Pp.dawn||0)); return; }                              // Hive of Morning (Dawn Hatch)
      if(Pp.hith){ A.setMark(T,u,x,'pt',{dur:Pp['pt.dur']||6,longest:true}); A.ustPut(T,u,x,'welt',5); } },   // Hornets in the Hive: Pointed and 5 Welts
    /* ---------------- hits ---------------- */
    tin(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, M=me(T), t=c.tgt, s=c.src; if(!t||!s) return;
      if(t.team!==u.team){ if(s.team!==u.team) return; let k=1;
        if(Pp.barb&&A.markOf(u,t,'barb')) k+=Pp.barb;                                          // Barbed (Sting and Die)
        if(Pp.song&&any(T,COLONY)&&colony(A,T)>=A.stMax(T,u,'col')-1e-6) k+=Pp.song;           // Hive Song
        c.amt*=k; return; }
      if(s.team===u.team||t===u) return;
      T.fn.onHit(A,T,u,t,s,c,ALLY_CAP,null); },
    myIn(A,T,u,c){ const s=c.src; if(!s||s.team===u.team) return; T.fn.onHit(A,T,u,u,s,c,SELF_CAP,c.kind); },
    myDot(A,T,u,c){ const s=c.src; if(s&&s.team===u.team) return; c.amt*=Math.max(1-SELF_CAP,teamF(A,T,u,u,s,false)*selfF(A,T,u,s,(c.dot&&c.dot.kind)||null)); },
    /* a hit from enemy s on x (an ally, or Mellan): a Comb cell breaks, the reduction group (capped), Hornet Nectar's Welts, Comb Builder */
    onHit(A,T,u,x,s,c,cap,kind){ const r=T.r, Pp=T.P, M=me(T), E=A.eng(), now=E.now();
      if(M.probe){ const br=any(T,COMB)&&(cells(T,x)>0||A.winOn(T,'crown')); let k=teamF(A,T,u,x,s,br); if(x===u) k*=selfF(A,T,u,s,kind); c.amt*=Math.max(1-cap,k); return; }   // a dry run (the 95% instrument): what this hit would lose, nothing spent
      const broke=any(T,COMB)?combBreak(A,T,u,x,s,c):false;
      let k=teamF(A,T,u,x,s,broke); if(x===u) k*=selfF(A,T,u,s,kind); c.amt*=Math.max(1-cap,k);
      if(Pp.smell&&s.alive&&A.markOf(u,x,'smell')) A.acts(T,u,[{ustack:'welt',on:'target',add:2,dur:(T.st.welt.dur||5)+(Pp.sticky||0)}],{u,tgt:s});   // Hornet Nectar (Sticky Smell)
      if(r.gr_9_1&&cells(T,x)<=0&&c.amt>0.15*x.maxHp){ const cb=M.cb[x.uid]||(M.cb[x.uid]={n:0,h:0,br:-9}); if(!(now<(cb.bd||-9))){ cb.bd=now+6; cb.n=1; cb.h=0; } } },   // Comb Builder: a fresh cell after the hit
    /* ---------------- deaths ---------------- */
    dth(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, M=me(T), x=c.unit, now=E.now(); if(!x||!u.alive) return;
      if(x.team===u.team){ if(x===u||x._summon||x.summoned||!(u.pass&&u.pass.beeward)) return;
        M.lost++;                                                                                // a worker lost (Count the Fallen)
        if(any(T,BROOD)) A.stSet(T,u,'brood',A.stGet(T,'brood')+1);                              // its worker comes home as Brood
        const k=x._talBy&&x._talBy.alive&&x._talBy.team!==u.team?x._talBy:null;                  // the enemy that struck it down (the last enemy that hit it)
        if(k&&Pp.stung) A.setMark(T,u,k,'stH',{dur:6});                                          // Stung Hands
        if(k&&any(T,BARB)) A.setMark(T,u,k,'barb',{});                                           // Last Sting: Barbed for the rest of the wave
        if(Pp.wtk){ A.acts(T,u,[{window:'wtk',dur:10}],{u});                                     // Whether They Know: 10 s of free worker heals, every enemy it was fighting Barbed
          for(const e of E.units()) if(e.alive&&e.team!==u.team&&(e.target===x||x.target===e)) A.setMark(T,u,e,'barb',{}); }
        return; }
      if(A.markOf(u,x,'pt')&&Pp.again){ const n=A.pick(T,u,{team:'enemy',of:'unit',order:'near',n:1,skip:'unit'},{u,unit:x})[0]; if(n) A.setMark(T,u,n,'pt',{dur:Pp.again,longest:true}); }   // Marked Again
      if(A.markOf(u,x,'barb')){
        if(Pp.broken) E.healUnit(u,u.maxHp*Pp.broken);                                            // Broken Stinger
        if(Pp.spread){ const n=A.pick(T,u,{team:'enemy',of:'unit',order:'near',n:1,skip:'unit'},{u,unit:x})[0]; if(n&&!A.markOf(u,n,'barb')) A.setMark(T,u,n,'barb',Pp.spread>=2?{}:{dur:5}); } }   // Barb Spread
      if(Pp.asked) for(const b of M.hcL){ const R0=b._talR; if(!R0||R0.na||b.tt>=b.life) continue; if(Math.hypot(x.x-b.cx,x.y-b.cy)<=b.R){ R0.na=true; b.life+=Pp.asked; } } },   // Never Asked: an enemy died inside it
    barbHeal(A,T,u,c){ const x=c.unit; if(x&&x.team!==u.team&&A.markOf(u,x,'barb')) c.amt*=Math.max(0,1-(T.P.deep||0)); },
    /* They Die for Him: a Swarmed ally (or Mellan) that would die: the Colony loses 30 and it stays at 1 HP (once a wave) */
    save(A,T,u,c){ const M=me(T), x=c.unit; if(!x||!A.markOf(u,x,'sw')||M.save===T.s.wave||colony(A,T)<30) return; M.save=T.s.wave; A.stSet(T,u,'col',colony(A,T)-30); if(x.hp<1) x.hp=1; c.stop=true; },
    saveMe(A,T,u,c){ const M=me(T); if(!A.markOf(u,u,'sw')||M.save===T.s.wave||colony(A,T)<30) return; M.save=T.s.wave; A.stSet(T,u,'col',colony(A,T)-30); A.acts(T,u,[{undying:0.05}],c); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/39 - MELLAN - talent decisions.md) */
  ruling:{}
};
