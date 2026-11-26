/* DANDRA - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Dandra": what she added)
   Her real kit (the code, not the tooltip wording; a Support, ranged, healer; her heals scale on the ally's max HP, her stings on ability power):
   - Seedlight ('mendburst', green, cd 8): the engine's lowestAlly(u) (herself included) is healed through healUnit (no caster: the healIn hook is how her
     rows see it) by dandraHealAmt = its max HP x (10% at level 1 .. 30% at 100) + 30% of her ability power + 50% of her healing-power RATING
     ((healPowMul - 1) / 0.0005: +10% healing power is +100 HP on each heal). Then a heal over time of half that over 6 s (pushHot, 1 s ticks, no caster:
     her rows make it hers with tagHots 'seed').
   - Drowsy Sting ('drowsy', blue, cd 6, delivered as a shot at her current target): 50% of her ability power as a magic hit. If the enemy is already
     stung (_stungT > 0) it is put to SLEEP: ccApply(stunned, o.sleep) where skillScaleOpts has set o.sleep to the sleep table's 5.0 s, cut by 0.7 to
     3.5 s and capped at the stun ceiling 2.8 s; _sleepT = 5.0 (uncut: casts are cancelled while it runs). Any hit through _dealDamageCore wakes it
     (DoT ticks and talent damage do not). Otherwise the enemy is stung for 6 s: attack and cast speed slowed (20% .. 35%), a magic poison of 25% of
     her ability power a second for 4 s (pushDot, src = her), and the Contagion flags of her passive.
   - The Swarm Moves On (passive 'contagion'): when a stung enemy dies, the game's Contagion block spreads her poison (plagueDot, queued 0.5 s) to the
     enemies within 2.6 m of it CENTRE TO CENTRE, with a 30% + 0.2% a level healing cut for 5 s. Measured: in 20 seeded fights 14 stung enemies died
     and the bees moved on to NOBODY (the nearest other enemy stood 4.1 m or more away, centre to centre). Not changed here (rulings file, fact 1).
   - Queen's Call (ultimate 'rally'; ULT_DEF.rally's heal/perLv are not read by the case, HERO_ULT_ART.dandra is art only): every ally (herself too) is
     healed dandraHealAmt(5% .. 15%) through healUnit, gains 20 .. 35 energy, and attack and cast speed x1.05 .. x1.20 for 5 s.
   Petals, Cold Morning, Warmth, Bees, Swollen, Pollen, Lamplight, Seeds and Late Bloom exist only through her talents.
   Readings, caps and corrected tooltips: WIRING/21 - DANDRA - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const SEED='mendburst', STING='drowsy', CALL='rally', COL='#f2d84a';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const PETAL=['pb_1_1','pb_2_1','pb_3_1','pb_4_1','pb_6_1','pb_7_1','pb_8_1','pb_9_1','pb_n1','pb_10_1','pb_11_1','pb_11_2','pb_12_2','pb_12_3','pb_13_2'];
const COLD=['pb_2_2','pb_4_2','pb_7_2','pb_9_2','pb_12_1','pb_13_2'];
const WARM=['pb_4_4','pb_5_4','pb_7_4','pb_8_4','pb_10_4','pb_12_4','pb_13_2'];
const BEES=['tb_1_1','tb_1_2','tb_2_2','tb_3_1','tb_3_2','tb_4_4','tb_5_1','tb_5_3','tb_5_4','tb_6_1','tb_6_3','tb_7_1','tb_8_2','tb_8_4','tb_10_2','tb_10_3','tb_10_4','tb_11_1','tb_11_3','tb_12_3','tb_12_4','tb_13_3'];
const SWOL=['tb_2_3','tb_4_3','tb_8_1','tb_9_1','tb_12_2','tb_13_3'];
const LAMP=['pb_n1','gl_1_1','gl_1_4','gl_2_4','gl_3_1','gl_6_1','gl_3_4','gl_4_4','gl_5_2','gl_5_3','gl_6_2','gl_6_3','gl_8_4','gl_9_4','gl_10_4','gl_11_3','gl_11_4','gl_12_2','gl_12_3','gl_13_3'];
const SEEDS=['gl_2_3','gl_4_3','gl_7_4','gl_9_2','gl_10_2','gl_12_4','gl_13_3'];
const BLOOM=['gl_4_1','gl_5_1','gl_7_1','gl_8_1','gl_10_1','gl_12_1','gl_12_2','gl_13_3'];
/* her heals made stronger or weaker, healing received by her allies, and the heal over time of Seedlight */
const HEALK=['pb_1_3','gl_2_2','tb_9_4','pb_5_2','pb_6_2','pb_9_3','gl_8_1','tb_4_4','tb_12_4','gl_3_1','pb_2_2','pb_6_4','tb_6_4','pb_12_3','pb_7_4','gl_6_1','gl_4_1','gl_12_2'];
const HOTS=HEALK.concat(['pb_2_3','pb_5_3','pb_6_3','gl_3_4']);
const STINGK=['tb_1_4','tb_6_2','tb_6_4','gl_7_3'];                       // Drowsy Sting's poison made hers (its ticks run her rows)
const SLEEP=['tb_4_1','tb_10_3','gl_5_3','gl_6_3','gl_7_3','gl_9_3'];       // Drowsy Sting's sleep made longer / kept
const SELF_IN=['pb_12_1','pb_11_1','tb_1_1','tb_11_1','tb_11_4','gl_8_2','gl_11_4','pb_6_4','gl_6_1','pb_n1'];
const TEAM_IN=['tb_2_3','tb_12_2','pb_4_4','pb_n1','gl_1_4','gl_4_4','tb_6_1'];
const POL=['tb_4_4','tb_5_4','tb_8_4','tb_12_4','tb_10_4'];                       // Pollen
const any=(T,L)=>{ const c=T.s.anyC||(T.s.anyC=new Map()); let v=c.get(L); if(v===undefined){ v=L.some(id=>T.r[id]); c.set(L,v); } return v; };   // is any talent of that family learned (asked every tick: kept for the fight)
const REGEN=0.012;                                                         // the game's regeneration cap (Phil 4 Oct): her per-second talent heals on one unit, together
const allies=(A,T,u,c)=>A.pick(T,u,{team:'ally',others:true},c||{u});     // her allies (heroes, not herself)
const team=(A,T,u,c)=>A.pick(T,u,{team:'ally'},c||{u});                    // her side's heroes, herself too
const frac=x=>x.maxHp>0?x.hp/x.maxHp:1;
/* Cold Morning as it counts now: the signature holds it at 5 for 8 s */
const cmN=(A,T)=>Math.max(A.stGet(T,'cm'),A.winOn(T,'tba')?5:0);
const bloomFull=(A,T,u)=>{ const m=A.stMax(T,u,'bloom'); return m>0&&m<Infinity&&A.stGet(T,'bloom')>=m-1e-6; };
const hasBee=(T,t)=>!!t&&(T.s.bz||[]).some(b=>b.t===t);
const mostHurt=(A,T,u)=>{ let b=null; for(const x of team(A,T,u)) if(!b||frac(x)<frac(b)) b=x; return b; };
/* how much stronger a heal of hers is. sl: a Seedlight heal (its burst or a tick of its heal over time); main: on its own ally (not the shared heal of
   Everyone a Little); pol: the Pollen this Seedlight spent. Every bonus adds; the total is never below 0 */
function healK(A,T,u,x,sl,main,pol){ const r=T.r, Pp=T.P; let k=1+(Pp['heal.more']||0);
  if(Pp['cold.heal']) k+=Pp['cold.heal']*cmN(A,T);                                                     // Remember the Frost: 1% per rank per Cold Morning
  if(r.pb_12_3&&A.winOn(T,'loo')) k+=0.05*r.pb_12_3;                                           // Last One Open: 5 s after her last Petal
  if(r.gl_3_1&&A.markOf(u,x,'lamp')) k+=0.025*r.gl_3_1;                                         // Dew: on the ally in Lamplight
  if(sl){ const f=frac(x); k+=Pp['sl.more']||0;                                                // Bright Bell, Bell Glow, Kept Alive
    if(main&&r.pb_5_2) k+=0.25; if(main&&r.pb_5_2&&r.pb_6_2&&f<0.30) k+=0.04*r.pb_6_2;         // One at a Time (its one ally), Goes to the Worst
    if(r.pb_9_3&&f<0.50) k+=0.03*r.pb_9_3;                                                     // Seedlight Bloom
    if(r.gl_8_1&&bloomFull(A,T,u)) k+=0.04*r.gl_8_1;                                           // Overflowing
    if(pol>0) k+=pol*(0.03*(r.tb_4_4||0)+(Pp['pol.more']||0)); }                          // Gold Dust, Bee Bread: per Pollen spent
  return Math.max(0,k); }
function bloomAdd(A,T,u,x){ if(x>0&&T.st.bloom) A.stSet(T,u,'bloom',A.stGet(T,'bloom')+x); }
/* a Petal folded over x as a shield (the larger stays: one Petal shield per ally at a time; a new one tops it up), for its time; k: a size factor */
function fold(A,T,u,x,k,c){ const E=A.eng(), r=T.r; if(!x||!x.alive) return 0; const lamp=r.pb_n1&&r.gl_1_4&&A.markOf(u,x,'lamp');
  const size=x.maxHp*0.015*Math.max(1,r.pb_1_1||0)*(1+0.01*(r.pb_6_1||0))*(k||1)*(lamp?1.3:1), d=6+(T.P['petal.dur']||0);
  x.shield=Math.max(x.shield||0,size); x.shieldT=Math.max(x.shieldT||0,d); (T.s.ps||(T.s.ps={}))[x.uid]={x,size,until:E.now()+d};
  A.acts(T,u,[{mark:'petal',on:'target',dur:d,while:'shield',ends:'petalEnd'}],Object.assign({},c||{},{u,tgt:x})); return size; }
/* her Bees: T.s.bz = [{t: the enemy it stays on, kind: 'bee' (one of her 3) | 'royal' (Queen's Stingers) | 'extra' (The Hive Remembers), n: stings left, nx: next}];
   T.s.bh = the times her Bees on the way home arrive */
function sendBee(A,T,u,t,kind,c){ const E=A.eng(); if(!t||!t.alive) return false; const n=6+(T.r.tb_5_3?0.5:0);
  (T.s.bz||(T.s.bz=[])).push({t,kind,n,nx:E.now()+1}); A.setMark(T,u,t,'bee',{dur:n+0.05}); A.acts(T,u,[{window:'beeW',dur:n+0.05,longest:true}],c||{u}); return true; }
function beeOut(A,T,u){ let n=0; for(const b of (T.s.bz||[])) if(b.kind!=='extra') n++; A.stSet(T,u,'out',n); }
/* the enemy a Bee goes to: the sting's own enemy; Stay Close: the enemy nearest the most hurt ally; Spread Out: never one that already has a Bee
   (then the enemy nearest that one without a Bee; none: it stays home). skip: enemies already chosen in this sting */
function beeTarget(A,T,u,t,skip){ const r=T.r; let x=t;
  if(r.tb_5_1){ const h=mostHurt(A,T,u); if(h){ const L=A.pick(T,u,{team:'enemy',of:'unit',order:'near'},{u,unit:h}); if(L.length) x=L[0]; } }
  if(r.tb_5_3&&x&&(hasBee(T,x)||skip.indexOf(x)>=0)){ const L=A.pick(T,u,{team:'enemy',of:'target',order:'near'},{u,tgt:x}); x=null; for(const e of L) if(!hasBee(T,e)&&skip.indexOf(e)<0){ x=e; break; } }
  return x; }
module.exports={
  hero:'dandra',
  casting:true,                         // rows ask which of her skills a heal, a hit or a sleep comes from
  poison:true,                          // The Swarm Moves On queues her poison (plagueDot): with Moving On Faster its spread is hers (spreadR / spread / pois)
  states:{
    petal:{max:6,start:'max',refill:P('petal.re',10),refilled:'petalBack'},       // Petals: 6, each regrows 10 s after it is used
    cm:{max:P('cm.max',5),wave:'reset'},                                         // Cold Morning (this wave)
    bee:{max:3,start:'max'},                                                     // her Bees at home
    out:{max:3},                                                                 // her Bees out on an enemy now (set by her rows)
    pol:{max:P('pol.max',3)},                                                    // Pollen
    bloom:{max:{pct:P('bloom.max',0.30),of:'maxHp'}},                            // Late Bloom (a pool of HP)
    warm:{unit:true,max:5,dur:3},                                                // Warmth on each ally (lost 3 s after leaving)
    sw:{unit:true,max:5,dur:P('sw.dur',5),full:'swFull'}                         // Swollen on each enemy
  },
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share */
  always:[
    {on:'tick',do:[{fn:'scan'}]},                                                                              // allies' thresholds, Warmth, Lamplight, per-second heals, her Bees
    {on:'wave',do:[{fn:'wave'}]},
    {on:'kit',skill:SEED,do:[{fn:'slKit'}]}, {on:'cast',skill:SEED,do:[{fn:'slCast'}]},                       // Seedlight: its ally, Pollen, Petals, its heal over time
    {on:'kit',skill:CALL,do:[{fn:'qcKit'}]}, {on:'cast',skill:CALL,do:[{fn:'qcCast'}]},                       // Queen's Call
    {on:'kit',skill:STING,reqAny:STINGK,do:[{tagDots:'kit'}]}, {on:'cast',skill:STING,reqAny:STINGK,do:[{tagDots:'sting'}]},   // Drowsy Sting's poison is hers
    {on:'cast',skill:STING,reqAny:BEES,do:[{fn:'stCast'}]},                                                    // each Drowsy Sting sends a Bee
    {on:['teamHeal','healMe'],reqAny:HEALK,do:[{fn:'heal'}]},                                                  // her heals, healing her allies receive, Late Bloom
    {on:'healOut',reqAny:HOTS,if:{hot:true,skill:'seed'},do:[{fn:'hot'}]},                                     // a tick of Seedlight's heal over time
    {on:'healed',reqAny:['gl_4_1'],if:{hot:true,skill:'seed'},do:[{fn:'bloomHot'}]},                           //   (what it restored: Late Bloom)
    {on:'teamIn',reqAny:TEAM_IN,do:[{fn:'tin'}]},                                                              // hits on her allies and on enemies (Swollen)
    {on:'in',reqAny:SELF_IN,do:[{fn:'myIn'}]},                                                                 // hits on her
    {on:'ccIn',reqAny:['pb_1_4','pb_10_1'],do:[{fn:'ten'}]},                                                   // controls on her
    {on:'teamCc',reqAny:['pb_10_1','gl_9_4'],do:[{fn:'tcc'}]},                                                 // controls on her allies
    {on:'ccHit',reqAny:SLEEP,if:{casting:STING,cc:['stunned'],talent:false},do:[{fn:'sleep'}]},                // Drowsy Sting's sleep landed
    {on:'hit',reqAny:SWOL,if:{casting:STING,targetTeam:'enemy'},do:[{fn:'stungHit'}]},                         // Drowsy Sting's hit is a sting (Swollen)
    {on:'swFull',reqAny:['tb_8_1','tb_9_1'],do:[{fn:'swFull'}]},                                               // an enemy reached 5 Swollen
    {on:'cold',reqAny:COLD,do:[{stack:'cm',add:1}]}                                                            // Cold Morning: each ally that drops below 30% (scan)
  ],
  talents:{
    /* ============================== PETAL BY PETAL ============================== */
    pb_1_1:[ {stat:{hp:-0.01},per:{stack:'petal',missing:true}} ],                                              // Fold a Petal (the fold: slCast; 1.5% per rank)
    pb_1_3:[ {param:'sl.more',add:R(0.02)} ],                                                                   // Bright Bell
    pb_1_4:[ {param:'ten.self',add:R(0.05)} ],                                                                  // Small but Here (in ten; up to 15%)
    pb_2_1:[ {param:'petal.dur',add:R(1)} ],                                                                    // Thick Petals
    pb_2_2:[ {param:'cold.heal',add:R(0.01)} ],                                                                 // Remember the Frost (Cold Morning: the always row; the heal: healK)
    pb_n1:[  {param:'petal.light',add:0.03} ],                                                                  // Petal in the Light (LINK; 30% larger and kept with Lift the Lantern: fold / scan)
    pb_3_1:[ {param:'dress',add:1} ],                                                                           // Her Own Dress (slCast)
    pb_4_2:[ {param:'cm.max',add:R(1)} ],                                                                       // Long Memory of Cold
    pb_5_1:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                             // Gentle Light
    pb_2_3:[ {param:'hot.dur',add:R(0.4)} ],                                                                    // Gold Light (a part tick at the end)
    pb_4_1:[ {param:'petal.re',add:R(-0.6)} ],                                                                  // Quick Regrowth
    pb_5_2:[ {param:'one',add:1} ],                                                                             // One at a Time (PICK ONE; healK)
    pb_5_3:[ {param:'share',add:0.30} ],                                                                        // Everyone a Little (PICK ONE; slCast)
    pb_4_4:[ {param:'warm.dr',add:R(0.004)} ],                                                                  // Kept Warm (Warmth: scan; the reduction: tin)
    pb_6_2:[ {param:'worst',add:R(0.04)} ],                                                                     // Goes to the Worst (healK)
    pb_6_3:[ {param:'share',add:R(0.015)} ],                                                                    // Share the Light: the shared heal 5% stronger per rank (30% x 1.05)
    pb_5_4:[ {param:'warm.rate',add:R(0.2)} ],                                                                  // Close Together: Warmth comes 20% faster per rank
    pb_6_1:[ {param:'petal.re',add:R(-0.2)} ],                                                                  // Petal Store (and 1% larger per rank: fold)
    pb_6_4:[ {param:'heal.more',add:R(0.04)}, {param:'risk',add:R(0.03)} ],                                     // Brave Anyway (RISK)
    pb_7_1:[ {on:'petalBack',do:[{heal:{pct:R(0.01),of:'maxHp'},on:'self'}]} ],                                 // Dandelion Down
    pb_7_2:[ {param:'call.cold',add:0.02} ],                                                                    // Call of the Cold (qcCast)
    pb_7_4:[ {param:'snug',add:R(0.01)} ],                                                                      // Snug (heal)
    pb_8_1:[ {stat:{heal:R(0.01)},per:{stack:'petal',missing:true}} ],                                          // Little Sacrifice
    pb_8_3:[ {on:'cd',skill:'blue',add:R(-0.1)} ],                                                              // Small Sting
    pb_8_4:[ {param:'warm.hands',add:R(0.003)} ],                                                               // Warm Hands (scan; with the regeneration cap)
    pb_9_1:[ {on:'petalEnd',if:{broke:true,targetHpBelow:0.30},do:[{heal:{pct:0.10,of:'tgtMaxHp'},on:'target'}]} ],   // Not a Close Call
    pb_9_2:[ {param:'call.cold',add:R(0.003)} ],                                                                // Frost Remembered
    pb_9_3:[ {param:'bloom50',add:R(0.03)} ],                                                                   // Seedlight Bloom (healK)
    pb_10_1:[ {param:'ten.petal',add:R(0.04)} ],                                                                // Petal Ward (ten / tcc; up to 12%)
    pb_10_3:[ {on:'cd',less:R(0.01)} ],                                                                         // Lighter Load (both skills)
    pb_10_4:[ {param:'hearth',add:R(1)} ],                                                                      // Hearth (scan)
    pb_11_1:[ {param:'dr.still',add:R(0.015)} ],                                                                // Still Standing (myIn)
    pb_11_2:[ {param:'qpetal',add:1} ],                                                                         // Queen's Petals (qcCast)
    pb_12_1:[ {param:'dr.cold',add:R(0.01)} ],                                                                  // Never Close Again (myIn; up to 16%)
    pb_12_2:[ {param:'qpetal.big',add:R(0.03)} ],                                                               // Full Bloom
    pb_12_3:[ {on:'lastPetal',do:[{fn:'lastOpen'},{window:'loo',dur:5}]} ],                                     // Last One Open
    pb_12_4:[ {param:'warm.m',add:R(0.5)} ],                                                                    // Warm Field
    pb_13_2:[ {on:'tba',once:'wave',do:[{fn:'threeBees'},{window:'tba',dur:8}]} ],                              // Three Bees Alive (SIGNATURE; set off by scan)

    /* ============================== THE THREE BEES ============================== */
    tb_1_1:[ {param:'dr.wings',add:R(0.02)} ],                                                                  // Little Wings (myIn)
    tb_1_2:[ {param:'bee.ap',add:R(0.06)} ],                                                                    // Three Bees (the Bees: stCast / scan)
    tb_1_4:[ {on:'out',if:{casting:STING,targetTeam:'enemy'},more:R(0.03)}, {on:'dotOut',if:{tag:'sting'},more:R(0.03)} ],   // Sharp Stinger (its hit and its poison)
    tb_2_2:[ {param:'bee.home',add:R(-1)} ],                                                                    // Quick Wings: the 3 s flight home 1 s shorter per rank
    tb_2_3:[ {param:'sw.dmg',add:R(0.006)} ],                                                                   // Stung Again (Swollen: stungHit / sting; the damage: tin, myOut)
    tb_3_1:[ {param:'bee.meadow',add:R(0.02)} ],                                                                // Meadow Strength
    tb_3_2:[ {param:'all3',add:1} ],                                                                            // All Three (stCast)
    tb_4_3:[ {param:'sw.dur',add:R(1)} ],                                                                       // Puffed Up
    tb_2_4:[ {on:'wave',once:'fight',do:[{fn:'reach',by:R(0.03)}]} ],                                           // Bright Eye
    tb_4_1:[ {param:'sleep.add',add:R(0.1)} ],                                                                  // Heavy Sleep (sleep)
    tb_8_4:[ {param:'pol.shield',add:R(0.02)} ],                                                                // Golden Dust (slCast)
    tb_4_4:[ {param:'pol.on',add:1} ],                                                                          // Gold Dust (Pollen: scan / slKit; the heal: healK)
    tb_5_1:[ {param:'bee.close',add:0.15} ],                                                                    // Stay Close (PICK ONE)
    tb_5_2:[ {on:'cd',skill:'blue',add:R(-0.1)} ],                                                              // Busy Bees
    tb_5_3:[ {param:'bee.spread',add:0.5} ],                                                                    // Spread Out (PICK ONE)
    tb_5_4:[ {param:'pol.max',add:R(1)} ],                                                                      // Rich Pollen
    tb_6_1:[ {param:'dr.guard',add:R(0.02)} ],                                                                  // Guard Bees (tin)
    tb_6_2:[ {on:'dotOut',if:{tag:'sting'},more:R(0.03)} ],                                                     // Venom
    tb_6_3:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',has:'bee'},if:{window:'beeW'}} ],                           // Wide Meadow: enemies with a Bee attack 3% slower per rank
    tb_6_4:[ {param:'heal.more',add:R(-0.04)}, {on:'out',if:{casting:STING,targetTeam:'enemy'},more:R(0.06)},
             {on:'dotOut',if:{tag:'sting'},more:R(0.06)}, {param:'bee.angry',add:R(0.06)} ],                    // Angry Hive (RISK): her heals weaker, every sting stronger
    tb_7_1:[ {stat:{aspd:R(0.01)},per:'out'} ],                                                                 // Bee Dance
    tb_7_3:[ {on:'spreadR',do:[{fn:'body'}]}, {on:'spread',do:[{fn:'onward'}]},                                 // Moving On Faster: the passive measured body to body, one more enemy,
             {on:'dotTick',if:{tag:'spread'},do:[{fn:'movedSting'}]} ],                                          //   and its bees count as Bees for Swollen and Pollen
    tb_8_1:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',ust:{sw:5}},if:{window:'sw5'}} ],                           // Swollen Shut
    tb_8_2:[ {on:'beeHome',do:[{energy:R(1),on:'self'}]} ],                                                     // Honest Work
    tb_12_4:[ {param:'pol.more',add:R(0.01)} ],                                                                 // Bee Bread (healK)
    tb_9_1:[ {param:'burst',add:1} ],                                                                           // Burst (swFull)
    tb_9_3:[ {on:'dotOut',if:{tag:'spread'},more:R(0.03)} ],                                                    // Swarm Hunger
    tb_10_2:[ {on:'sting',do:[{fn:'honey',by:R(0.01)}]} ],                                                      // Honey Sting
    tb_10_3:[ {param:'sleep.bee',add:R(0.03)} ],                                                                // Buzzing Ears (sleep)
    tb_10_4:[ {param:'pol.cloud',add:R(0.02)} ],                                                                // Pollen Cloud (slCast)
    tb_11_1:[ {param:'dr.fierce',add:R(0.015)} ],                                                               // Small and Fierce (myIn)
    tb_11_3:[ {param:'qbees',add:1} ],                                                                          // Queen's Stingers (qcCast)
    tb_11_4:[ {param:'dr.grass',add:R(0.01)} ],                                                                 // Hidden in the Grass (myIn)
    tb_9_4:[ {param:'sl.more',add:R(0.02)} ],                                                                   // Kept Alive
    tb_12_2:[ {param:'sw.dmg',add:R(0.001)} ],                                                                  // Swelling
    tb_12_3:[ {param:'bee.royal',add:R(0.03)} ],                                                                // Royal Swarm
    tb_13_3:[ {on:'cast',skill:CALL,do:[{window:'hive',dur:8}]} ],                                              // The Hive Remembers (SIGNATURE; stCast / stungHit / swFull)

    /* ============================== THE GOLD LANTERN ============================== */
    gl_1_1:[ {param:'tucked',add:R(0.003)} ],                                                                   // Tucked In (scan; with the regeneration cap)
    gl_2_2:[ {param:'sl.more',add:R(0.03)} ],                                                                   // Bell Glow
    gl_1_4:[ {on:'teamDotIn',if:{unitHas:'lamp',srcTeam:'enemy'},less:{r:0.03,$:'lamp.dot'}},                   // Lift the Lantern (Lamplight: scan): damage over time on them weaker,
             {param:'lamp.big',add:R(0.02)} ],                                                                  //   and every hit over 10% of their max HP cut (tin)
    gl_2_3:[ {param:'seed.heal',add:R(0.02)} ],                                                                 // One Opening (Seeds: scan / seed)
    gl_2_4:[ {param:'lamp.at',add:R(0.05)} ],                                                                   // Wide Glow: 45%, 50%, 55%
    gl_3_1:[ {param:'dew',add:R(0.025)} ],                                                                      // Dew (healK)
    gl_6_1:[ {param:'risk',add:R(0.03)}, {param:'lamp.heal',add:R(0.05)} ],                                     // Light Burns Low (RISK)
    gl_4_3:[ {param:'seed.n',add:R(1)} ],                                                                       // Seed Pouch
    gl_3_4:[ {param:'slow.dying',add:1} ],                                                                      // Slower Dying (scan)
    gl_4_1:[ {param:'bloom.save',add:R(0.05)} ],                                                                // Saved for Later (Late Bloom: heal / bloomHot; spent: qcCast)
    gl_5_4:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                             // Patient Light
    gl_4_4:[ {param:'lamp.dr',add:R(0.01)} ],                                                                   // Held Light (tin)
    gl_5_1:[ {param:'bloom.more',add:R(0.02)} ],                                                                // Rich Bloom
    gl_7_1:[ {param:'bloom.max',add:R(0.02)} ],                                                                 // Warm Store
    gl_8_2:[ {param:'dr.calm',add:R(0.01)} ],                                                                  // Bellflower Calm (myIn)
    gl_9_2:[ {param:'seed.more',add:R(0.03)} ],                                                                 // Seed Wind
    gl_7_3:[ {on:'cast',skill:STING,do:[{fn:'mercyDot'}]} ],                                                    // Sting of Mercy (her poison 6 s; her hits do not wake: sleep)
    gl_7_4:[ {param:'seed.shield',add:R(0.01)} ],                                                               // Night Petal
    gl_5_2:[ {param:'lamp.n',add:1} ],                                                                          // Bright Lantern (PICK ONE)
    gl_5_3:[ {on:'skillTgt',skill:STING,do:[{fn:'lanternTgt'}]}, {param:'sleep.add',add:0.6} ],                 // Drowsy Lantern (PICK ONE)
    gl_9_3:[ {param:'sleep.mercy',add:R(0.06)} ],                                                               // Deep Sleep (sleep, with Sting of Mercy)
    gl_8_4:[ {param:'hope',add:R(0.02)} ],                                                                      // Little Hope (scan)
    gl_6_2:[ {param:'two.lights',add:R(0.003)} ],                                                               // Two Lights (scan; with the regeneration cap)
    gl_6_3:[ {param:'sleep.nrg',add:R(3)} ],                                                                    // Sleep Now (sleep)
    gl_9_4:[ {param:'no.close',add:1} ],                                                                        // Do Not Close (tcc / scan)
    gl_10_1:[ {param:'bloom.nrg',add:R(1)} ],                                                                   // Spring Store
    gl_10_2:[ {param:'seed.luck',add:R(0.04)} ],                                                                // Lucky Seed (a seeded roll, in the Seed's own row)
    gl_8_1:[ {param:'overflow',add:R(0.04)} ],                                                                  // Overflowing (healK)
    gl_10_4:[ {param:'lamp.dot',add:R(0.01)} ],                                                                 // Lamp Oil
    gl_11_1:[ {on:'cd',less:R(0.01)} ],                                                                         // Hollow Stem (both skills)
    gl_11_3:[ {param:'qlamp',add:6} ],                                                                          // Queen's Lantern (qcCast)
    gl_11_4:[ {param:'dr.afraid',add:R(0.015)} ],                                                               // Afraid but Here (myIn)
    gl_12_1:[ {param:'bloom.more',add:R(0.03)} ],                                                               // Late Summer
    gl_12_2:[ {param:'bloom.lamp',add:R(0.10)} ],                                                               // Gold Lantern (scan / heal)
    gl_12_3:[ {param:'qlamp',add:R(0.4)} ],                                                                     // Long Night Light
    gl_12_4:[ {param:'seed.last',add:R(0.5)} ],                                                                 // Last Seed
    gl_13_3:[ {on:'teamLethal',if:{window:'dl1'},do:[{atOne:'unit'}]}, {on:'lethal',if:{window:'dl1'},do:[{undying:0.05}]} ]   // The Dandelion Opens (SIGNATURE; qcCast)
  },
  fn:{
    /* ---------------- each tick ---------------- */
    scan(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, s=T.s, now=E.now(), dt=c.dt||0, M=E.METER(), L=allies(A,T,u,c), f0=s.f||(s.f={});
      /* thresholds: Cold Morning (30%), Seeds (20%), Three Bees Alive (25%); each when the ally crosses it going down */
      for(const x of L){ const f=frac(x), p=f0[x.uid]; f0[x.uid]=f; if(p==null) continue;
        if(any(T,COLD)&&p>=0.30&&f<0.30) A.run(T,u,'cold',{u,tgt:x,unit:x});
        if(r.pb_13_2&&p>=0.25&&f<0.25) A.run(T,u,'tba',{u,tgt:x,unit:x});
        if(any(T,SEEDS)&&p>=0.20&&f<0.20) T.fn.seed(A,T,u,{u,tgt:x,unit:x},{}); }
      /* Warmth: each second an ally stands within 3 m of her (body to body; Warm Field farther) it gains 1 (max 5); lost 3 s after it leaves */
      if(any(T,WARM)){ const R=3+(Pp['warm.m']||0), wc=s.wc||(s.wc={}), rate=1+(Pp['warm.rate']||0);
        for(const x of L){ const w=wc[x.uid]||(wc[x.uid]={a:0,h:0}), n=A.ustGet(T,u,x,'warm');
          if(A.gap(u,x)<R*M){ w.a+=dt*rate; if(w.a>=1-1e-9){ w.a-=1; A.ustPut(T,u,x,'warm',Math.min(5,n+1),3); } else if(n>0) x._talM[u.uid]['#warm'].until=now+3; }   // standing near her: it keeps them (lost 3 s after it leaves)
          else w.a=0;
          if(Pp.hearth&&A.ustGet(T,u,x,'warm')>=5){ w.h+=dt; if(w.h>=3-1e-9){ w.h-=3; x.energy=Math.min(100,(x.energy||0)+Pp.hearth); } } else w.h=0; } }
      /* Lamplight: the most wounded ally (HP share, as the game's own lowestAlly) below 40% (Wide Glow 45 / 50 / 55%); Bright Lantern: the two lowest. Queen's Lantern and The Dandelion Opens
         put allies in it for a time whatever their HP. 'lampR' = the ones the lantern picked by their HP (Do Not Close) */
      if(T.s.lampOn){ const th=0.40+(Pp['lamp.at']||0), n=1+(Pp['lamp.n']||0), cand=L.filter(x=>frac(x)<th).sort((a,b)=>frac(a)-frac(b)).slice(0,n), old=s.lamp||[], nw=[];
        for(const x of L){ const rule=cand.indexOf(x)>=0, timed=A.winOn(T,'dlamp')||!!A.markOf(u,x,'qlamp'); if(rule||timed) nw.push(x);
          const had=!!A.markOf(u,x,'lampR'); if(rule&&!had) A.setMark(T,u,x,'lampR',{}); else if(!rule&&had) A.clearMark(u,x,'lampR'); }
        for(const x of old) if(nw.indexOf(x)<0){ A.clearMark(u,x,'lamp'); if(x.alive) T.fn.leave(A,T,u,{u,tgt:x,unit:x}); }
        for(const x of nw) if(old.indexOf(x)<0){ A.setMark(T,u,x,'lamp',{}); (s.lr||(s.lr={}))[x.uid]=0; }
        s.lamp=nw;
        if(Pp['no.close']) for(const x of nw) if(A.markOf(u,x,'lampR')){ if((x.stunned||0)>0) x.stunned=0; if((x._sleepT||0)>0) x._sleepT=0; }   // Do Not Close
        if(r.pb_n1&&r.gl_1_4) for(const x of nw){ const q=s.ps&&s.ps[x.uid]; if(q&&A.markOf(u,x,'petal')&&(x.shield||0)>0){ const m=A.markOf(u,x,'petal'); if(m.until<now+0.2){ m.until=now+0.2; for(const e of s.tm) if(e.t===x&&e.name==='petal') e.until=now+0.2; } x.shieldT=Math.max(x.shieldT||0,0.2); } }   // Petal in the Light: kept while Lamplight holds
        if(Pp['slow.dying']) for(const x of nw) for(const h of (x.hots||[])) if(h._talU===u&&h._talK==='seed') h.acc+=dt; }   // Slower Dying: twice as fast
      /* her per-second talent heals (Tucked In, Warm Hands, Two Lights): once a second, together never above the game's 1.2% of max HP a second on one unit */
      if(Pp.tucked||Pp['warm.hands']||Pp['two.lights']){ s.h1=(s.h1||0)+dt; if(s.h1>=1-1e-9){ s.h1-=1; const lit=(s.lamp||[]).length>0;
          for(const x of team(A,T,u,c)){ let k=0; if(x===u){ if(Pp.tucked&&!lit) k+=Pp.tucked; } else { if(Pp['warm.hands']&&A.ustGet(T,u,x,'warm')>=5) k+=Pp['warm.hands']; if(Pp['two.lights']&&r.gl_5_2&&A.markOf(u,x,'lampR')) k+=Pp['two.lights']; }
            if(k>0) E.healUnit(x,x.maxHp*Math.min(REGEN,k)); } } }
      /* her Bees */
      if(s.bz&&s.bz.length) T.fn.beeTick(A,T,u,c);
      if(s.bh&&s.bh.length){ for(let i=0;i<s.bh.length;i++){ if(now<s.bh[i]-1e-9) continue; s.bh.splice(i--,1); T.fn.home(A,T,u,c); } }
      if(s.zz){ for(const k in s.zz){ const z=s.zz[k]; if(now>=z.until||!z.t.alive||!((z.t.stunned||0)>0)){ if(z.t._talZz===u) z.t._talZz=null; delete s.zz[k]; } } } },   // Sting of Mercy's sleeps still held
    wave(A,T,u){ const s=T.s, E=A.eng(); s.bz=[]; s.bh=[]; A.stSet(T,u,'bee',3); A.stSet(T,u,'out',0); s.f={};
      s.lampOn=LAMP.some(id=>T.r[id]); if(s.seeds==null) s.seeds=any(T,SEEDS)?5+(T.P['seed.n']||0):0; s.dlOnce=s.dlOnce||false; void E; },
    /* Bright Eye: her attack reach 3% longer per rank (once, at the fight's first wave) */
    reach(A,T,u,c,a){ u.range=(u.range||0)*(1+(a.by||0)); },
    /* ---------------- Seedlight ---------------- */
    slKit(A,T,u,c){ const s=T.s; s.slT=A.pick(T,u,'lowestAlly',c)[0]||null; s.sp=0;
      if(any(T,POL)){ s.sp=A.stGet(T,'pol'); A.stSet(T,u,'pol',0); }                                          // Gold Dust: Seedlight spends all Pollen
      if(any(T,HOTS)) A.acts(T,u,[{tagHots:'kit'}],c); },
    slCast(A,T,u,c){ const E=A.eng(), s=T.s, r=T.r, Pp=T.P, x=s.slT; s.slT=null; if(!x) return;
      /* its heal over time: hers (her rows see each tick), how much Pollen it carries, Gold Light, Everyone a Little */
      if(any(T,HOTS)){ A.acts(T,u,[{tagHots:'seed'}],c); const H=x.hots||[]; let h=null; for(let i=H.length-1;i>=0;i--) if(H[i]._talU===u&&H[i]._talK==='seed'&&!H[i]._talMk){ h=H[i]; break; }
        if(h){ h._talMk=1; h._talP=s.sp||0; const add=Pp['hot.dur']||0; if(add>0){ const n=h.remaining+add/(h.interval||1); h.remaining=Math.ceil(n-1e-9); const fr=n-(h.remaining-1); h._talF=(fr<1-1e-9)?fr:null; }
          if(Pp.share){ for(const y of A.pick(T,u,{team:'ally',of:'target',within:3,skip:'target'},{u,tgt:x})){ E.pushHot(y,h.hps*Pp.share,h.remaining*(h.interval||1),h.interval||1); const g=y.hots[y.hots.length-1];
              if(g){ g._talU=u; g._talK='seed'; g._talMk=1; g._talSh=1; g._talP=h._talP; if(h._talF!=null) g._talF=h._talF; } } } } }
      const pol=s.sp||0; s.sp=0;
      if(Pp['pol.shield']&&pol>0) A.acts(T,u,[{shield:{pct:Pp['pol.shield']*pol,of:'tgtMaxHp'},on:'target',dur:6,mode:'max'}],{u,tgt:x});   // Golden Dust
      if(Pp['pol.cloud']&&pol>=3) A.acts(T,u,[{heal:{pct:Pp['pol.cloud'],of:'tgtMaxHp'},on:{team:'ally',of:'target',within:3,skip:'target'}}],{u,tgt:x});   // Pollen Cloud
      /* a Petal folded over its ally */
      if(any(T,PETAL)){ const n=A.stGet(T,'petal');
        if(n>=1){ A.stSet(T,u,'petal',n-1); fold(A,T,u,x,1,c); if(n-1<1e-9&&T.on.lastPetal) A.run(T,u,'lastPetal',{u,tgt:x}); }
        else if(Pp.dress){ u.hp=Math.max(1,u.hp-0.05*u.maxHp); fold(A,T,u,x,2,c); } } },                    // Her Own Dress: from her own HP, twice as large
    /* Last One Open: every Petal shield still holding is full again */
    lastOpen(A,T,u){ const E=A.eng(), now=E.now(); for(const k in (T.s.ps||{})){ const q=T.s.ps[k], x=q.x; if(!x.alive||now>=q.until||!A.markOf(u,x,'petal')) continue; x.shield=Math.max(x.shield||0,q.size); x.shieldT=Math.max(x.shieldT||0,q.until-now); } },
    /* her heals as they reach an ally (teamHeal) or herself (healMe) */
    heal(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, x=c.unit, cur=T.s.cur; if(!x) return; let a=c.amt;
      if(cur===SEED&&x===T.s.slT) a*=healK(A,T,u,x,true,true,T.s.sp||0);                                    // Seedlight's burst on its ally
      else if(cur===CALL) a*=healK(A,T,u,x,false,false,0);                                                  // Queen's Call
      if(x!==u){ if(Pp.snug&&A.ustGet(T,u,x,'warm')>=5) a*=1+Pp.snug; if(Pp['lamp.heal']&&A.markOf(u,x,'lamp')) a*=1+Pp['lamp.heal']; }   // any heal on her ally: Snug, Light Burns Low
      c.amt=a; const got=Math.max(0,Math.min(a,E.healCap(x)-x.hp));
      if(Pp['bloom.save']&&(cur===SEED||cur===CALL)) bloomAdd(A,T,u,got*Pp['bloom.save']);                 // Saved for Later: her skills' healing (HP restored)
      if(Pp['bloom.lamp']&&x!==u&&A.markOf(u,x,'lamp')){ const L=T.s.lr||(T.s.lr={}); L[x.uid]=(L[x.uid]||0)+got; } },   // Gold Lantern: healing received in Lamplight
    hot(A,T,u,c){ const h=c.h; if(!h||!c.unit) return; c.amt*=healK(A,T,u,c.unit,true,!h._talSh,h._talP||0); },
    bloomHot(A,T,u,c){ if(T.P['bloom.save']) bloomAdd(A,T,u,(c.amt||0)*T.P['bloom.save']); },
    /* an ally leaves Lamplight alive: Little Hope (above 40%), Gold Lantern (Late Bloom from what it received in it) */
    leave(A,T,u,c){ const E=A.eng(), x=c.unit, Pp=T.P; if(Pp.hope&&frac(x)>0.40) E.healUnit(x,x.maxHp*Pp.hope);
      if(Pp['bloom.lamp']){ const L=T.s.lr||{}; bloomAdd(A,T,u,(L[x.uid]||0)*Pp['bloom.lamp']); L[x.uid]=0; } },
    /* a Seed lands on an ally that just dropped below 20%: 2% of its max HP a second per rank for 3 s (Seed Wind, Last Seed), Night Petal's shield. Lucky Seed:
       a seeded roll (the fight's own stream, drawn last) that it is not spent. Spent Seeds do not come back (this fight) */
    seed(A,T,u,c){ const E=A.eng(), Pp=T.P, s=T.s, x=c.unit; if(!x||!x.alive||!((s.seeds||0)>0)) return false;
      const last=s.seeds<=1, k=(1+(Pp['seed.more']||0))*(last?1+(Pp['seed.last']||0):1), per=x.maxHp*(Pp['seed.heal']||0.02)*k;
      if(per>0) E.pushHot(x,per,3,1); if(Pp['seed.shield']){ x.shield=Math.max(x.shield||0,x.maxHp*Pp['seed.shield']); x.shieldT=Math.max(x.shieldT||0,3); }
      if(!(Pp['seed.luck']>0&&E.rnd()<Pp['seed.luck'])) s.seeds--; return true; },
    /* ---------------- Queen's Call ---------------- */
    qcKit(A,T,u){ T.s.qcFull=bloomFull(A,T,u); },
    qcCast(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, s=T.s, now=E.now(), tm=team(A,T,u,c), al=allies(A,T,u,c);
      if(Pp['call.cold']){ const n=cmN(A,T); A.stSet(T,u,'cm',0); if(s.w.tba) s.w.tba.t=0; if(n>0) for(const x of tm) E.healUnit(x,x.maxHp*Pp['call.cold']*n); }   // Call of the Cold
      if(r.gl_13_3&&s.qcFull&&!s.dlOnce){ s.dlOnce=true;                                                    // The Dandelion Opens: once a fight, with Late Bloom full
        for(const x of al){ if(!((s.seeds||0)>0)) break; T.fn.seed(A,T,u,{u,tgt:x,unit:x},{}); }
        A.acts(T,u,[{window:'dlamp',dur:8},{window:'dl1',dur:3}],c); s.lampOn=true; }
      if(any(T,BLOOM)){ const b=A.stGet(T,'bloom'); if(b>0&&tm.length){ const k=1+(Pp['bloom.more']||0); A.stSet(T,u,'bloom',0);   // Late Bloom: shared among the team
          for(const x of tm) E.healUnit(x,b*k/tm.length); if(Pp['bloom.nrg']) for(const x of tm) x.energy=Math.min(100,(x.energy||0)+Pp['bloom.nrg']); } }
      if(Pp.qpetal){ for(const x of tm) fold(A,T,u,x,1+(Pp['qpetal.big']||0),c); A.acts(T,u,[{stack:'petal',set:'max'}],c); const k=s.k.petal; if(k) k.rf=[]; }   // Queen's Petals
      if(Pp.qlamp) for(const x of al) A.setMark(T,u,x,'qlamp',{dur:Pp.qlamp});                                // Queen's Lantern
      if(Pp.qbees){ const t=A.pick(T,u,{team:'enemy',order:'most:sw'},c)[0]||null;                          // Queen's Stingers: every Bee to the enemy with the most Swollen
        if(t){ s.bz=(s.bz||[]).filter(b=>b.kind==='extra'); s.bh=[]; A.stSet(T,u,'bee',0); for(let i=0;i<3;i++) sendBee(A,T,u,t,'royal',c); beeOut(A,T,u); } } },
    /* ---------------- Drowsy Sting and her Bees ---------------- */
    stCast(A,T,u,c){ const r=T.r, t=c.tgt; if(!t||t.team===u.team) return; const home=A.stGet(T,'bee'), sent=[];
      const k=(r.tb_3_2&&home>=3)?3:(home>=1?1:0);                                                           // All Three: all of them when all are home
      for(let i=0;i<k;i++){ const x=beeTarget(A,T,u,t,sent); if(!x) break; if(sendBee(A,T,u,x,'bee',c)){ sent.push(x); A.stSet(T,u,'bee',A.stGet(T,'bee')-1); } }
      if(A.winOn(T,'hive')) for(let i=0;i<3;i++) sendBee(A,T,u,t,'extra',c);                                // The Hive Remembers: 3 extra bees
      beeOut(A,T,u); },
    beeTick(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, s=T.s, now=E.now(), rk=Math.max(1,r.tb_1_2||0);
      for(let i=0;i<s.bz.length;i++){ const b=s.bz[i], t=b.t;
        if(t.alive&&now>=b.nx-1e-9){ b.nx+=1; const part=Math.min(1,b.n); b.n-=part;
          let k=1+(Pp['bee.angry']||0)+(Pp['bee.close']||0)+(b.kind==='royal'?(Pp['bee.royal']||0):0);
          if(Pp['bee.meadow']&&((t.slow||0)>0||((t.hasteT||0)>0&&(t.hasteMul||1)<1)||((t._sleepT||0)>0&&(t.stunned||0)>0))) k+=Pp['bee.meadow'];   // Meadow Strength: slowed or asleep
          const amt=(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*0.06*rk*k*part*E.defMul(u,t,'magic'), done=A.hurt(T,u,t,amt,COL,'bee');
          if(T.on.sting) A.run(T,u,'sting',{u,src:u,tgt:t,amt:done});
          if(t.alive&&any(T,SWOL)) A.acts(T,u,[{ustack:'sw',on:'target'}],{u,tgt:t}); }       // each sting adds 1 Swollen
        if(!t.alive||b.n<=1e-9){ s.bz.splice(i--,1); if(b.kind!=='extra') s.bh.push(now+Math.max(0,3+(Pp['bee.home']||0))); } }
      beeOut(A,T,u); },
    /* a Bee is home: ready again, 1 Pollen (Gold Dust), Honest Work */
    home(A,T,u,c){ A.stSet(T,u,'bee',Math.min(3,A.stGet(T,'bee')+1)); if(any(T,POL)) A.stSet(T,u,'pol',A.stGet(T,'pol')+1); if(T.on.beeHome) A.run(T,u,'beeHome',{u,tgt:u}); },
    honey(A,T,u,c,a){ const E=A.eng(), t=c.tgt; if(!t||!(c.amt>0)) return; const x=A.pick(T,u,{team:'ally',of:'target',order:'near',n:1},c)[0]; if(x) E.healUnit(x,c.amt*(a.by||0)); },
    stungHit(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return;
      if(A.winOn(T,'hive')) A.acts(T,u,[{ustack:'sw',on:'target',set:'max',burst:true}],c);               // The Hive Remembers: every enemy it hits fills to 5
      else A.acts(T,u,[{ustack:'sw',on:'target'}],c); },
    /* an enemy reached 5 Swollen: Swollen Shut's window; Burst (it and every enemy within 2 m: 40% of her ability power, magic; the stacks clear; during
       The Hive Remembers each enemy it hits sleeps 1 s) */
    swFull(A,T,u,c){ const E=A.eng(), t=c.tgt; if(!t) return; if(T.r.tb_8_1) A.acts(T,u,[{window:'sw5',dur:T.st.sw.dur||5,longest:true}],c);
      if(!T.P.burst||!t.alive) return; A.ustPut(T,u,t,'sw',0);
      const hit=[t].concat(A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},c)), ap=(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1);
      for(const x of hit) A.hurt(T,u,x,ap*0.40*E.defMul(u,x,'magic'),COL,'burst');
      if(A.winOn(T,'hive')) for(const x of hit) if(x.alive) T.fn.tSleep(A,T,u,{u,tgt:x},{secs:1}); },
    /* a sleep a talent puts on (The Hive Remembers' 1 s): its full length on the fixed path, the game's sleep (it breaks on a hit); Buzzing Ears */
    tSleep(A,T,u,c,a){ const t=c.tgt; if(!t||!t.alive) return; let d=a.secs||1; if(T.P['sleep.bee']&&hasBee(T,t)) d*=1+T.P['sleep.bee'];
      A.control(T,u,t,'stunned',d); if((t.stunned||0)>0) t._sleepT=Math.max(t._sleepT||0,t.stunned); },
    /* Drowsy Sting's sleep landed (the real base: 2.8 s today). Buzzing Ears adds its share of that, Heavy Sleep, Drowsy Lantern and Deep Sleep their seconds,
       all in full (not cut at the stun ceiling). Sleep Now: the attacker of the Lamplight ally loses energy. Sting of Mercy: her own hits will not wake it */
    sleep(A,T,u,c){ const E=A.eng(), Pp=T.P, r=T.r, t=c.tgt; if(!t||!(c.amt>0)) return; const base=c.amt;
      let d=base*(1+((Pp['sleep.bee']&&hasBee(T,t))?Pp['sleep.bee']:0))+(Pp['sleep.add']||0)+(r.gl_7_3?(Pp['sleep.mercy']||0):0);
      d=Math.max(base,Math.min(d,A.stunRoom(t)));   /* v1452 (lockdown audit T30): her sleep's extensions keep a stun run on one enemy inside 4.0 s (the sleep is 3.5 s since v1452) */
      t.stunned=Math.max(t.stunned||0,d); t._sleepT=Math.max(t._sleepT||0,d);
      if(Pp['sleep.nrg']&&T.s.dlT===t) t.energy=Math.max(0,(t.energy||0)-Pp['sleep.nrg']);
      if(r.gl_7_3){ const z=T.s.zz||(T.s.zz={}); z[t.uid]={t,until:E.now()+d}; t._talZz=u; t._talZzT=E.now()+d; } },
    /* Sting of Mercy: the poison this sting put on lasts the whole 6 s the enemy is stung (not 4 s) */
    mercyDot(A,T,u,c){ const d=c.dot; if(!d||d._talK!=='sting'||d._talMercy) return; d._talMercy=1; const st=((c.o&&c.o.stung)||6)-4; if(st>0) A.acts(T,u,[{extendDot:st}],c); },
    /* Drowsy Lantern: Drowsy Sting goes to the enemy attacking the ally in Lamplight (else the one that last hit it) */
    lanternTgt(A,T,u,c){ const L=(T.s.lamp||[]).filter(x=>x.alive); T.s.dlT=null; if(!L.length) return; const E=A.eng();
      for(const a of L){ let best=null, bd=Infinity; for(const e of E.units()){ if(!e.alive||e.team===u.team||e.target!==a) continue; const d=E.dist(e,a); if(d<bd){ bd=d; best=e; } }
        if(!best&&a._talBy&&a._talBy.alive&&a._talBy.team!==u.team) best=a._talBy; if(best){ c.tgt=best; T.s.dlT=best; return; } } },
    /* The Swarm Moves On, with Moving On Faster: its reach measured body to body, and one more enemy (the nearest the dead one that it did not reach) */
    body(A,T,u,c){ c.body=true; },
    onward(A,T,u,c){ const E=A.eng(), dead=c.unit, vic=c.vic||[]; if(!dead) return; let best=null, bd=Infinity;
      for(const e of E.units()){ if(!e.alive||e===dead||e.team===u.team||vic.indexOf(e)>=0||e._dropHidden) continue; const d=E.dist(e,dead); if(d<bd){ bd=d; best=e; } }
      if(!best) return; const dps=dead._plagueDps||0; if(!(dps>0)) return; E.pushDot(best,dps,5,1,COL,u,'magic'); const nd=best.dots[best.dots.length-1]; if(nd){ nd._talO=u.uid; nd._talK='spread'; }
      best._contagion=true; best._plagueDps=dps; best._plagueColor=COL; best._plagueHex=dead._plagueHex||0xf2d84a; best._beeCutUntil=E.now()+5; best._beeCut=Math.min(0.9,0.30+0.002*(((u.skillLv&&u.skillLv[3])|0)||1)); },
    /* a moved bee's sting (a tick of the passive's poison she owns): 1 Swollen; its last sting: it flies home with 1 Pollen */
    movedSting(A,T,u,c){ const t=c.tgt, d=c.dot; if(t&&t.alive&&any(T,SWOL)) A.acts(T,u,[{ustack:'sw',on:'target'}],c); if(d&&d.remaining<=1&&any(T,POL)) A.stSet(T,u,'pol',A.stGet(T,'pol')+1); },
    /* ---------------- damage and controls ---------------- */
    /* hits on her allies (her rows multiply, each its own share: the combining rule) and on enemies (Swollen: more from her whole team) */
    tin(A,T,u,c){ const t=c.tgt, s=c.src, Pp=T.P; if(!t||!s) return;
      if(t.team!==u.team){ if(Pp['sw.dmg']&&s.team===u.team){ const n=A.ustGet(T,u,t,'sw'); if(n>0) c.amt*=1+n*Pp['sw.dmg']; } return; }
      if(s.team===u.team||t===u) return; let k=1;
      if(Pp['warm.dr']){ const w=A.ustGet(T,u,t,'warm'); if(w>0) k*=1-Pp['warm.dr']*w; }                       // Kept Warm
      if(Pp['petal.light']&&A.markOf(u,t,'petal')) k*=1-Pp['petal.light'];                                  // Petal in the Light
      if(A.markOf(u,t,'lamp')){ if(Pp['lamp.dr']) k*=1-Pp['lamp.dr']; if(Pp['lamp.big']&&c.amt>=0.10*t.maxHp) k*=1-Pp['lamp.big']; }   // Held Light; Lift the Lantern
      if(Pp['dr.guard']&&A.markOf(u,s,'bee')&&t===mostHurt(A,T,u)) k*=1-Pp['dr.guard'];                     // Guard Bees
      c.amt*=k; },
    /* hits on her */
    myIn(A,T,u,c){ const s=c.src, Pp=T.P; let k=1;
      if(Pp['dr.cold']) k*=1-Pp['dr.cold']*cmN(A,T);                                                        // Never Close Again (up to 16%)
      if(Pp['dr.still']&&A.stGet(T,'petal')<=3) k*=1-Pp['dr.still'];                                        // Still Standing
      if(Pp['dr.wings']&&A.stGet(T,'bee')<3) k*=1-Pp['dr.wings'];                                            // Little Wings
      if(Pp['dr.fierce']&&s&&A.markOf(u,s,'bee')) k*=1-Pp['dr.fierce'];                                     // Small and Fierce
      if(c.kind==='magic'){ if(Pp['dr.grass']) k*=1-Pp['dr.grass']; if(Pp['dr.calm']) k*=1-Pp['dr.calm']; }   // Hidden in the Grass, Bellflower Calm (each its own share)
      if(Pp['dr.afraid']&&(T.s.lamp||[]).length) k*=1-Pp['dr.afraid'];                                      // Afraid but Here
      if(Pp['petal.light']&&A.markOf(u,u,'petal')) k*=1-Pp['petal.light'];                                  // Petal in the Light (a Petal over her)
      if(Pp.risk) k*=1+Pp.risk;                                                                              // Brave Anyway, Light Burns Low (RISK)
      c.amt*=k; },
    /* controls on her: Small but Here (up to 15%), Petal Ward while a Petal shield holds over her (up to 12%); together at most 25% shorter */
    ten(A,T,u,c){ const Pp=T.P; let k=1-(Pp['ten.self']||0); if(Pp['ten.petal']&&A.markOf(u,u,'petal')) k*=1-Pp['ten.petal']; c.amt*=Math.max(0.75,k); },
    /* controls that landed on her allies: Petal Ward (up to 12% shorter, only when this control set the time); Do Not Close (the lantern's own pick: no stun, no sleep) */
    tcc(A,T,u,c){ const x=c.unit, f=c.field, Pp=T.P; if(!x||!f||!(c.amt>0)) return;
      if(Pp['no.close']&&f==='stunned'&&A.markOf(u,x,'lampR')){ x.stunned=0; x._sleepT=0; return; }
      if(Pp['ten.petal']&&A.markOf(u,x,'petal')&&f!=='slow'&&Math.abs((x[f]||0)-c.amt)<1e-9) x[f]=c.amt*(1-Pp['ten.petal']); },
    /* ---------------- the signature of Petal by Petal ---------------- */
    /* Three Bees Alive: every Petal she has over that ally at once, double size; every ally to 5 Warmth; 5 Cold Morning held for 8 s (the window) */
    threeBees(A,T,u,c){ const E=A.eng(), x=c.unit, n=A.stGet(T,'petal'); if(x&&x.alive&&n>0){ A.stSet(T,u,'petal',0); fold(A,T,u,x,2*n,c); if(T.on.lastPetal) A.run(T,u,'lastPetal',{u,tgt:x}); }
      for(const y of allies(A,T,u,c)) A.ustPut(T,u,y,'warm',5,3); T.s.ww=E.now()+3; }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/21 - DANDRA - talent decisions.md) */
  ruling:{}
};
