/* PYROCLAST - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Pyroclast": what she added)
   Her real kit (the code, not the card wording; damage profile Magic: her skills read her ability power, every hit of hers is magic, her basic attacks read
   her Attack; tests/pyroclast-kit-facts.js measures it):
   - Ember Lash ('creeprot', green, cd 6, a shot at 16 m/s): ONE hit on her target, 100% of her ability power x skill level, then a Scorch: a magic DoT of
     55% of her ability power x skill level a second for 4 s (4 ticks), pushed at once (not queued) when the shot arrives. Each cast is a NEW DoT; with no
     talent two of them never overlap (the cooldown is longer than the Scorch). Inside the skill: casting:'creeprot'.
   - Blazing Orbit ('nova', blue, cd 8, formed 0.35 s after the release): every enemy whose CENTRE is within 2.8 m of the ring's centre takes 115% x skill
     level, is pushed 1.5 m away from that centre and burns 30% x skill level a second for 3 s (pushed at once). The centre is HER, or a stale aim left over
     from her last aimed cast (91 of 111 casts): she stands about 16 m from the enemies, so 72 of 111 casts struck nobody (the skill reach audit; release v1391
     on another branch centres it on her target and repels from there). Not changed here: her talents build on its hits and pushes (the page's 'pass'
     'novaPush' line) and the tests put the enemy where both centres reach it. Inside the skill: casting:'nova'.
   - Crownfire ('fireball', ultimate on energy - no cooldown; ULT_DEF.fireball + HERO_ULT_ART.pyroclast, delivered as a pillar that lands 0.55 s after the
     cast): every enemy whose CENTRE is within 3.55 m of the aim point takes 220% x skill level. Its own target was struck in only 25 of 75 casts (the aim is
     the densest group), so its "main target" for her talents is the enemy struck nearest the pillar's centre (the page's 'at' line in the case).
   - Rising Heat (passive): at each of her SWINGS (not each tick) her skills' ability power becomes 1 + min(cap, 9% x her passive's strength x the enemies
     carrying ANY DoT, anyone's). The page's two 'num' lines ('rhPer', 'rhCap') let her talents change the share per enemy and the cap. The Scorch's own
     ticks read her plain ability power (Rising Heat does not reach them).
   Ember Debt, Paid in Kind, Magma, Ashfall, Cinders, Unheld and Heat Shimmer exist only through her talents. Her talent Scorches are copies of Ember Lash's
   Scorch at a share of its strength (magic DoTs: her own Scorch's armour / magic resist rule), tagged so her rows can tell them apart.
   Readings, caps and corrected tooltips: WIRING/47 - PYROCLAST - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const LASH='creeprot', ORB='nova', CF='fireball', SK=[LASH,ORB,CF];
const DR_CAP=0.40, STUN_LOCK=0.5;
/* her Scorches (every one counts as "Scorched"): Ember Lash's own (pyL), Ashfall (pyA), Cinders (pyC), Split Lash's fork (pyF), Ring of Cinders (pyR), Fissure (pyE),
   the vent of The Mountain Opens (pyV). Blazing Orbit's burn (pyB) is not a Scorch. */
const SCT={pyL:1,pyA:1,pyC:1,pyF:1,pyR:1,pyE:1,pyV:1};
/* the states several talents read: their bookkeeping runs when any of these is learned */
const DEBT=['db_1_1','db_2_1','db_3_1','db_4_1','db_4_3','db_7_1','db_8_1','db_9_1','db_11_1','db_13_2'];
const PK=['db_2_2','db_4_2','db_5_2','db_5_3','db_n1','db_11_2','db_12_3','db_13_2'];
const TOP=['db_9_4','db_11_4'];
const MAG=['er_1_1','er_2_1','er_3_1','er_5_1','er_6_1','er_8_1','er_9_1','er_10_1','er_11_1','er_11_4','er_12_2','er_13_3'];
const ASH=['er_2_3','er_3_3','er_4_3','er_n1','er_8_3','er_10_2','er_11_1','er_11_3','er_12_4','er_13_3'];
const CIN=['nh_1_1','nh_2_1','nh_3_1','nh_6_1','nh_9_1','nh_10_1','nh_11_1','nh_13_2'];
const SHIM=['nh_1_4','nh_2_4','nh_3_4','nh_6_4','nh_10_4','nh_11_1','nh_12_4','nh_13_2'];
const UH=['nh_2_2','nh_3_2','nh_4_3','nh_9_2','nh_13_2'];
const DRG=['db_4_3','db_9_2','db_11_4','er_8_3','er_11_3','nh_1_4','nh_3_1','nh_7_1','nh_12_1'];
const TEAM=['db_4_1','er_8_3'];
/* ---- small readers that need no API (the 95% instrument calls drK from a test with the API kept on T.s.api) ---- */
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const scOn=(u,t)=>{ const D=t&&t.dots; if(!D) return false; for(let i=0;i<D.length;i++){ const d=D[i]; if(d._talO===u.uid&&SCT[d._talK]&&d.remaining>0) return true; } return false; };
const lashOf=(u,t)=>{ const L=[], D=t&&t.dots; if(D) for(let i=0;i<D.length;i++){ const d=D[i]; if(d._talO===u.uid&&d._talK==='pyL'&&d.remaining>0) L.push(d); } return L; };
const dbOf=(T,t)=>{ const D=T.s.pyDb, e=D&&t&&D[t.uid]; return e?e.n:0; };
const pkOf=(T,u,t)=>{ const o=t&&t._talM&&t._talM[u.uid], m=o&&o['#pyPk']; return m?m.v:0; };
const gapM=(E,a,b)=>(E.dist(a,b)-E.bodyR(a)-E.bodyR(b))/E.METER();
const mkOn=(u,t,name,now)=>{ const o=t&&t._talM&&t._talM[u.uid], m=o&&o[name]; return !!m&&(m.until==null||now<m.until); };
const ashZ=(T,x,E)=>{ const L=T.s.zn&&T.s.zn.pyAsh; if(!L||!x) return null; const now=E.now(); let b=null; for(let i=0;i<L.length;i++){ const z=L[i]; if(now<z.until&&Math.hypot(x.x-z.x,x.y-z.y)-E.bodyR(x)<z.r&&(!b||z.min>b.min)) b=z; } return b; };
const inAsh=(T,x,E)=>!!ashZ(T,x,E);
const lashDps=(E,u)=>{ const lv=(u.skillLv&&u.skillLv[1])||1; return (u.apow||0)*0.55*(E.skillMul?E.skillMul(lv):1); };   // Ember Lash's Scorch a second, as the skill writes it
const extDot=(d,secs)=>{ const add=secs/(d.interval||1); if(!(add>0)||!(d.remaining>0)) return; const n=d.remaining-1+(d._talF!=null?d._talF:1)+add; d.remaining=Math.ceil(n-1e-9); const f=n-(d.remaining-1); d._talF=(f<1-1e-9)?f:null; };
const foes=(E,u)=>E.units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
/* a push away from a point: the engine's own drag toward the point m metres beyond the unit (an immovable unit is not moved), as the runtime's push action */
const pushFrom=(E,t,cx,cy,m)=>{ if(!t.alive||t.immovable||(t._gearImmovableT||0)>0) return false; let dx=t.x-cx, dy=t.y-cy; const L=Math.hypot(dx,dy); if(L<1){ dx=1; dy=0; } else { dx/=L; dy/=L; }
  const px=m*E.METER(); t.pulledBy={x:t.x+dx*px,y:t.y+dy*px,alive:true}; t.pullStop=0; t.pullSpeed=Math.max(1,px/0.25); t.pullT=0.25; t._pullGhost=false; return true; };
module.exports={
  hero:'pyroclast',
  casting:true,                         // rows ask which of her skills a hit comes from (Ember Lash, Blazing Orbit, Crownfire)
  points:true,                          // rows read where Blazing Orbit forms and where Crownfire lands (the 'at' hook)
  states:{
    pyPk:{unit:true,max:P('pk.max',5)},                                       // Paid in Kind: the hits each enemy has landed on her, written down (until an Ember Lash collects them)
    pyMag:{max:{b:40,$:'mag.thr',$m:'mag.ch'}},                               // Magma (40, Bright Vent fewer; Magma Chamber two eruptions)
    pyShim:{max:P('shim.max',4),dur:P('shim.dur',4),gain:'pyShimG'}           // Heat Shimmer (4 s after the last gain; Ember Ward more)
  },
  /* run for her whenever she has any mechanic talent: her skills' DoTs made hers, the bookkeeping of the states her talents share, and her capped group */
  always:[
    {on:'kit',skill:LASH,do:[{tagDots:'kit'},{fn:'lashKit'}]},                                                                  // Ember Lash: Paid in Kind collected, Turn and Burn, Molten Will
    {on:'cast',skill:LASH,do:[{tagDots:'pyL',exact:true,emit:'pyLash'},{fn:'skEnd'}]},                                          //   its Scorch becomes hers (pyL)
    {on:'pyLash',do:[{fn:'lashDot'}]},                                                                                          //   one Lash Scorch per enemy (Lash of Iron: two); Paid Twice
    {on:'kit',skill:ORB,do:[{tagDots:'kit'},{fn:'orbKit'}]},                                                                    // Blazing Orbit: an eruption? (Magma)
    {on:'kit',skill:ORB,reqAny:MAG,if:{fn:'erupt'},opt:{radius:{addM:1}}},                                                     //   an eruption is 1 m wider
    {on:'cast',skill:ORB,do:[{tagDots:'pyB'},{fn:'orbCast'},{fn:'skEnd'}]},                                                     //   its burn becomes hers (pyB); the eruption's riders
    {on:'hit',reqAny:MAG,if:{casting:ORB,targetTeam:'enemy',fn:'erupt'},do:[{fn:'erHit'}]},                         //   each enemy an eruption strikes (Magma's damage, Fissure)
    {on:'kit',skill:CF,do:[{fn:'cfKit'}]}, {on:'at',skill:CF,do:[{fn:'cfAt'}]},
    {on:'out',reqAny:['db_13_2'],if:{casting:CF,fn:'cfHalf'},mul:0.5},                                                          //   the second Crownfire of Settled in Fire: half power                                                 // Crownfire: half power?; its main target (struck nearest the centre)
    {on:'cast',skill:CF,do:[{fn:'cfCast'},{fn:'skEnd'}]},                                                                       //   Ashfall, Rain of Embers, the vent, the crown, Settled in Fire
    {on:'tick',reqAny:DEBT,do:[{fn:'scan'}]},                                                                                   // Ember Debt: each enemy, each tick
    {on:'hurt',reqAny:PK,do:[{ustack:'pyPk',on:'source',add:1}]},                                                              // Paid in Kind: each hit an enemy lands on her
    {on:'hurt',reqAny:TOP,do:[{fn:'topRec'}]},
    {on:'hurt',reqAny:['db_n1'],do:[{mark:'pyH4',on:'source',dur:4}]},                                                         // Fuel for the Mountain: an enemy that hit her in the last 4 s (a mark on the enemy: enemies are new each wave)                                                                                  // who has hit her most this wave
    {on:'dotTick',reqAny:MAG,if:{fn:'scTag'},do:[{stack:'pyMag',add:1}]},                                                       // Magma: each tick of her Scorches
    {on:'tick',reqAny:ASH,do:[{fn:'ashTick'}]},                                                                                 // Ashfall: its Scorch each second, its slow, the walk out
    {on:'hurt',reqAny:CIN,if:{auto:true,srcMelee:true},do:[{fn:'cinHit'}]},                                                     // Cinders: a melee enemy's basic attack on her
    {on:'pass',reqAny:SHIM,skill:'novaPush',do:[{stack:'pyShim',add:1}]},                                                      // Heat Shimmer: each enemy Blazing Orbit pushes
    {on:'pyShimG',reqAny:SHIM,do:[{fn:'shimG'}]},                                                                               //   reaching 4 (Mirage, Cooling Glass)
    {on:'tick',reqAny:UH,do:[{fn:'uhTick'}]},                                                                                   // Unheld: a stun or pull landing on her; Clear Ground and the crown hold her free
    {on:'ccIn',reqAny:['nh_9_2','nh_13_2'],if:{cc:['stunned'],fn:'free'},mul:0},                                               //   (no stun lands while she is held free)
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                                      // her damage-reduction talents: ONE capped group (myDr)
    {on:'teamIn',reqAny:TEAM,do:[{fn:'teamK'}]},                                                                                // Hard Ledger, Ash Cloud on hits that are not hers
    {on:'tick',reqAny:['nh_5_2','nh_13_2','er_13_3'],do:[{fn:'fieldTick'}]},                                                    // Wall of Flame's ring, the crown, the vent
    {on:'tick',do:[{fn:'clock'}]},                                                                                              // her countdowns (the fight clock restarts at 0 each wave: no absolute times)
    {on:'wave',do:[{fn:'waveStart'}]}
  ],
  talents:{
    /* ============================== THE DEBT ============================== */
    db_1_1:[ {on:'out',if:{casting:SK},more:R(0.006),per:{fn:'dbT'}} ],                                      // Ember Debt (the always scan)
    db_2_4:[ {on:'kit',skill:LASH,opt:{dur:{add:R(0.3)}}} ],                                                  // Long Scorch
    db_1_4:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                           // Quick Lash
    db_2_1:[ {param:'db.rate',add:R(0.1)} ],                                                                  // Interest (scan)
    db_2_2:[ {on:'out',if:{casting:LASH},more:R(0.03),per:{fn:'colN'}} ],                                     // Paid in Kind (the always rows; lashKit collects)
    db_n1:[ {on:'out',if:{casting:LASH,fn:'hit4'},more:0.06}, {param:'fuel',add:3,req:'er_1_1'} ],            // Fuel for the Mountain (LINK; with Magma: 3 Magma per hit collected, lashKit)
    db_3_1:[ {param:'db.keep',add:4} ],                                                                       // Collector (scan)
    db_n2:[ {on:'out',if:{auto:true,fn:'tgtSc'},more:R(0.04)} ],                                              // Stoked
    db_3_4:[ {on:'dotOut',if:{fn:'scTag'},more:R(0.03)} ],                                                    // Deep Scorch
    db_4_1:[ {param:'hl',add:R(0.01)} ],                                                                      // Hard Ledger (teamK)
    db_4_2:[ {param:'pk.max',add:R(1)} ],                                                                     // Old Debts
    db_5_2:[ {param:'fullPay',add:1} ],                                                                       // Full Payment (PICK ONE; lashKit)
    db_5_3:[ {param:'plan',add:1} ],                                                                          // Payment Plan (PICK ONE; lashKit)
    db_5_1:[ {on:'out',if:{casting:LASH,targetHpBelow:0.4},more:R(0.05)} ],                                   // Foreclose
    db_4_3:[ {param:'dr.gm',add:R(0.03)} ],                                                                   // Glass Mind (in myDr)
    db_5_4:[ {on:'num',skill:'rhPer',add:R(0.004)} ],                                                         // Kindled
    db_6_1:[ {param:'bg',add:R(0.5)}, {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{fn:'gaze'}]} ],        // Burning Gaze
    db_1_3:[ {on:'out',if:{casting:LASH,fn:'tgtSc'},more:R(0.02)} ],                                          // Hot Blood
    db_6_4:[ {param:'vent',add:R(0.04)}, {on:'dotOut',if:{fn:'scTag'},do:[{fn:'ventHeat'}]} ],                // Vent Heat
    db_7_1:[ {on:'out',if:{casting:CF},more:R(0.02),per:{fn:'mainDb'}} ],                                     // Ember Tithe
    db_7_2:[ {param:'iron',add:1} ],                                                                          // Lash of Iron (lashDot)
    db_7_3:[ {on:'cd',less:R(0.01)} ],                                                                        // Steady Flame
    db_8_1:[ {param:'calledIn',add:R(3)} ],                                                                   // Called In (scan)
    db_8_3:[ {on:'out',if:{casting:LASH},more:R(0.03)} ],                                                     // Searing Lash
    db_9_1:[ {on:'death',if:{fn:'broke10'},do:[{fn:'bkPass'}]} ],                                             // Bankrupt
    db_9_2:[ {param:'dr.gf',add:R(0.015)} ],                                                                  // Grudging Fire (in myDr)
    db_9_4:[ {on:'out',if:{casting:SK,fn:'isTop'},more:R(0.02)} ],                                            // Red Ledger
    db_10_2:[ {on:'dotOut',if:{tag:'pyL',fn:'twoL'},more:R(0.04)} ],                                          // Two Scorches
    db_10_4:[ {stat:{nrg:R(0.02)}} ],                                                                         // Black Glass Eyes
    db_11_1:[ {param:'db.max',add:R(0.4)} ],                                                                  // Compound Heat (scan)
    db_11_2:[ {param:'paidTwice',add:R(0.02)} ],                                                              // Paid Twice (lashDot)
    db_11_4:[ {param:'dr.ar',add:R(0.03)} ],                                                                  // Ash Robe (in myDr)
    db_12_1:[ {on:'out',if:{casting:CF,targetHpBelow:0.5},more:R(0.05)} ],                                    // Last Payment
    db_12_2:[ {on:'out',if:{casting:CF,fn:'tgtSc'},more:R(0.03)} ],                                           // Crown of Debts
    db_12_3:[ {param:'sb',add:R(1)} ],                                                                        // Steady Breath (lashKit)
    db_13_2:[ {on:'out',if:{casting:CF},more:0.06,per:{fn:'mainAll'}},                                        // Settled in Fire (SIGNATURE; the rest: cfCast)
             {on:'kill',if:{casting:CF,fn:'isMain'},do:[{fn:'sfKill'}]} ],
    /* ============================== ERUPTION ============================== */
    er_1_1:[ {param:'mag.dmg',add:R(0.06)} ],                                                                 // Magma (the always rows; erHit)
    er_2_4:[ {on:'out',if:{casting:ORB},more:R(0.04)} ],                                                      // Fierce Ring
    er_1_4:[ {on:'kit',skill:ORB,opt:{radius:{addM:R(0.2)}}} ],                                               // Wide Ring
    er_2_1:[ {on:'dotTick',if:{tag:'pyB'},do:[{stack:'pyMag',add:R(1)}]} ],                                   // Hot Rock
    er_2_3:[ {param:'ash',add:R(0.2)} ],                                                                      // Ashfall (cfCast, ashTick)
    er_3_1:[ {param:'fis',add:1} ],                                                                           // Fissure (erHit)
    er_3_2:[ {on:'num',skill:'rhCap',add:R(0.01)} ],                                                          // Fanned (points)
    er_3_3:[ {param:'ash.dur',add:R(0.3)} ],                                                                  // Thick Ash
    er_4_1:[ {on:'dotOut',if:{fn:'scTag'},more:R(0.02)} ],                                                    // Lava Lines
    er_4_3:[ {param:'ash.slow',add:0.25} ],                                                                   // Smothering Ash (ashTick)
    er_n1:[ {param:'ash.trail',add:R(0.4)} ],                                                                 // Trailing Ash (ashTick)
    er_5_1:[ {param:'hs',add:R(2)} ],                                                                         // Hot Spring (orbCast)
    er_5_2:[ {on:'pyLash',do:[{fn:'fork'}]} ],                                                                // Split Lash (PICK ONE)
    er_5_3:[ {on:'kit',skill:LASH,opt:{dur:{add:2}}} ],                                                       // Long Lash (PICK ONE)
    er_5_4:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                            // Flare Up
    er_6_1:[ {param:'mag.thr',add:R(-3)} ],                                                                   // Bright Vent
    er_6_2:[ {on:'death',if:{fn:'deadSc'},chance:R(0.2),do:[{fn:'catchSc'}]} ],                               // Scorch Catch (was Wildfire)
    er_6_4:[ {on:'kit',skill:ORB,opt:{push:{addM:R(0.2)}}} ],                                                 // Heat Wave
    er_7_2:[ {param:'rain',add:1} ],                                                                          // Rain of Embers (cfCast)
    er_7_4:[ {param:'roc',add:R(1)}, {on:'hit',if:{casting:ORB,targetTeam:'enemy'},do:[{fn:'rocHit'}]} ],     // Ring of Cinders
    er_8_1:[ {param:'vented',add:R(1)} ],                                                                     // Vented (orbCast)
    er_8_2:[ {param:'glow',add:R(0.02)} ],                                                                    // Glowing Embers (cfCast)
    er_8_3:[ {param:'ash.cloud',add:R(0.02)} ],                                                               // Ash Cloud (myDr, teamK)
    er_9_1:[ {param:'mag.ch',add:1} ],                                                                        // Magma Chamber
    er_9_3:[ {on:'out',if:{casting:SK},more:R(0.01),per:{fn:'scN',max:5}} ],                                  // Fire Weather
    er_10_1:[ {param:'lt',add:R(0.03)}, {on:'out',if:{casting:ORB,fn:'erupt',targetHpBelow:0.5},more:R(0.03)} ],   // Lava Tube (its extra damage: erHit)
    er_10_2:[ {param:'ash.str',add:R(0.04)} ],                                                                // Choking Smoke
    er_10_4:[ {on:'cd',less:R(0.015)} ],                                                                      // Brimstone
    er_11_1:[ {param:'crater',add:R(1)} ],                                                                    // Crater (orbCast)
    er_11_3:[ {param:'dr.av',add:R(0.015)} ],                                                                 // Ash Veil (in myDr)
    er_11_4:[ {param:'obs',add:R(0.02)} ],                                                                    // Obsidian Plate (orbCast)
    er_12_2:[ {param:'roll',add:R(3)} ],                                                                      // Rolling Fire (cfCast)
    er_12_3:[ {stat:{nrg:R(0.02)}} ],                                                                         // Old Mountain
    er_12_4:[ {param:'ash.r',add:R(0.3)} ],                                                                   // Firestorm
    er_13_3:[ {param:'vent9',add:1} ],                                                                        // The Mountain Opens (SIGNATURE: cfCast, fieldTick)
    /* ============================== NOBODY HOLDS HER ============================== */
    nh_1_1:[ {param:'cin',add:R(0.2)} ],                                                                      // Cinders (the always row: cinHit)
    nh_2_2:[ {param:'uh',add:R(0.15)} ],                                                                      // Unheld (uhTick)
    nh_1_4:[ {param:'dr.shim',add:R(0.01)} ],                                                                 // Heat Shimmer (the always rows; in myDr)
    nh_2_1:[ {param:'cin.dur',add:R(0.5)} ],                                                                  // Hot Coals
    nh_2_4:[ {param:'shim.dur',add:R(0.5)} ],                                                                 // Shimmering Air
    nh_3_1:[ {param:'dr.sh',add:0.15} ],                                                                      // Scorched Hands (in myDr)
    nh_3_2:[ {param:'uh.cd',add:R(-1)} ],                                                                     // Burning Free
    nh_3_3:[ {on:'ccIn',less:R(0.04)} ],                                                                      // Climber (20% at 5/5)
    nh_3_4:[ {param:'mirage',add:1}, {on:'dodge',if:{auto:true,fn:'mirOn'},do:[{dodge:true},{fn:'mirOff'}]} ],   // Mirage
    nh_1_3:[ {stat:{nrg:R(0.03)},if:{fn:'near3'}} ],                                                          // Sparks in Her Hair
    nh_4_2:[ {on:'num',skill:'rhPer',add:R(0.003)} ],                                                         // Stubborn Heat
    nh_4_3:[ {on:'out',if:{casting:SK,fn:'mwOn'},more:R(0.08)} ],                                             // Molten Will (armed by Unheld's burst: uhTick)
    nh_5_1:[ {on:'out',if:{casting:ORB},more:R(0.03)} ],                                                      // Fire Guard
    nh_5_4:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                           // Quick Orbit
    nh_6_1:[ {param:'cin.slow',add:R(0.05)} ],                                                                // Searing Touch (cinHit)
    nh_6_2:[ {stat:{move:R(0.02)}} ],                                                                         // Out of Reach
    nh_6_4:[ {param:'cg',add:R(0.01)} ],                                                                      // Cooling Glass (shimG)
    nh_7_1:[ {param:'dr.16',add:R(0.015)} ],                                                                  // Sixteen (in myDr)
    nh_7_2:[ {on:'tick',do:[{fn:'bp'}]} ],                                                                    // Breaking Point
    nh_9_4:[ {on:'healMe',more:R(0.02)}, {param:'gs',add:R(0.02)}, {on:'tick',do:[{fn:'gsTick'}]} ],          // Glass Skin
    nh_5_2:[ {on:'at',skill:ORB,do:[{fn:'wallAt'}]} ],                                                        // Wall of Flame (PICK ONE; fieldTick)
    nh_8_2:[ {on:'pass',skill:'novaPush',do:[{slow:R(0.05),dur:2,on:'target'}]} ],                            // Back Draft
    nh_8_3:[ {on:'cd',less:R(0.01)} ],                                                                        // Ash Step
    nh_5_3:[ {on:'cast',skill:ORB,do:[{fn:'tbArm'}]}, {on:'num',skill:'dlv:'+LASH,if:{fn:'tbOn'},mul:1/1.5,do:[{fn:'tbFly'}]},   // Turn and Burn (PICK ONE)
             {on:'out',if:{casting:LASH,fn:'tbHit'},more:0.25} ],
    nh_9_1:[ {on:'out',if:{targetHas:'pyCin'},more:R(0.02)} ],                                                // Coal Bed
    nh_9_2:[ {param:'cg15',add:1} ],                                                                          // Clear Ground (uhTick)
    nh_10_1:[ {param:'cburst',add:1} ],                                                                       // Cinderburst (cinHit)
    nh_10_3:[ {on:'out',if:{casting:SK,fn:'far6'},more:R(0.02)} ],                                            // Distance
    nh_10_4:[ {stat:{apow:R(0.003)},per:'pyShim'} ],                                                          // Lava Blood
    nh_11_1:[ {on:'pyCinG',chance:R(0.3),do:[{stack:'pyShim',add:1}]} ],                                      // Ringed
    nh_11_3:[ {on:'out',if:{casting:LASH},more:R(0.03)} ],                                                    // Far Flame
    nh_11_4:[ {stat:{nrg:R(0.02)}} ],                                                                         // Vent Breath
    nh_12_1:[ {param:'dr.bgw',add:R(0.03)} ],                                                                 // Black Glass Wall (in myDr)
    nh_12_2:[ {on:'out',if:{casting:SK,fn:'clear3'},more:R(0.02)} ],                                          // Untouched
    nh_12_4:[ {param:'shim.max',add:R(1)} ],                                                                  // Ember Ward
    nh_13_2:[ {param:'crown',add:1} ]                                                                         // The Vent at Sixteen (SIGNATURE: cfCast, fieldTick, uhTick)
  },
  fn:{
    keep(A,T){ T.s.api=A; },
    /* ---- HER COUNTDOWNS. battleTime starts again at 0 at every wave (beginWaveEnter), so none of her locks is an absolute fight time: each is seconds left,
       counted down here. Unheld's cooldown, Cinderburst's and the crown's per-enemy locks, the stun-lock after her stuns. ---- */
    clock(A,T,u,c){ const s=T.s, dt=c.dt||0; s.api=A; if(s.pyUhCd>0) s.pyUhCd=Math.max(0,s.pyUhCd-dt);
      for(const m of [s.pyLk,s.pyCbL,s.pyCrL]) if(m) for(const k in m){ m[k]-=dt; if(m[k]<=0) delete m[k]; } },
    waveStart(A,T,u){ const s=T.s; s.api=A; if(s.zn) s.zn.pyAsh=[]; s.dq.length=0; s.pyWall=null; s.pyVent=null; s.pyDb={}; s.pyRl={}; s.pyLk={}; s.pyCbL={}; s.pyCrL={};
      s.pyCF=null; s.pyTop=null; s.pyHalfQ=0; s.pyTB=0; s.pyTBq=0; s.pyTBh=0; s.pyAshIn=null; s.pySt=u.stunned||0; s.pyPl=u.pullT||0; s.pyPb=u.pulledBy||null; },
    skEnd(A,T){ const s=T.s; s.pyCol=0; s.pyTBh=0; s.pyMWc=0; },
    /* ---- SCORCH ---- */
    scTag(A,T,u,c){ return !!SCT[c.tag||(c.dot&&c.dot._talK)]; },
    tgtSc(A,T,u,c){ return scOn(u,c.tgt); },
    scN(A,T,u){ let n=0; for(const x of A.eng().units()) if(x.alive&&x.team!==u.team&&scOn(u,x)) n++; return n; },
    twoL(A,T,u,c){ return lashOf(u,c.tgt).length>=2; },
    /* her talent Scorch on t: share x Ember Lash's Scorch a second, for secs (refreshed: one of that kind on each enemy) */
    scorch(A,T,u,t,tag,share,secs){ if(!t||!t.alive||!(share>0)||!(secs>0)) return; const x=share*lashDps(A.eng(),u); if(!(x>0)) return;
      A.acts(T,u,[{dot:tag,on:'target',amt:x,dur:secs,every:1,refresh:true,kind:'magic',color:'#ff7a2a'}],{u,tgt:t}); },
    /* one Lash Scorch on an enemy: a new one replaces the old (Lash of Iron: the two newest run together). Paid Twice: the Scorch of a collecting Lash is stronger */
    lashDot(A,T,u,c){ const d=c.dot, t=c.tgt, P=T.P; if(!d||!t) return; const keep=P.iron?1:0, L=lashOf(u,t).filter(x=>x!==d);
      while(L.length>keep){ const o=L.shift(), i=t.dots.indexOf(o); if(i>=0) t.dots.splice(i,1); }
      if(P.paidTwice&&T.s.pyCol>0) d.dps*=1+P.paidTwice*T.s.pyCol; },
    fork(A,T,u,c){ const d=c.dot, t=c.tgt, E=A.eng(); if(!d||!t) return; let b=null, bd=Infinity;
      for(const x of foes(E,u)){ if(x===t) continue; const g=E.dist(t,x); if(g<bd){ bd=g; b=x; } } if(!b) return;
      const secs=(d.remaining-1+(d._talF!=null?d._talF:1))*(d.interval||1); A.acts(T,u,[{dot:'pyF',on:'target',amt:d.dps*0.5,dur:secs,every:1,refresh:true,kind:'magic',color:'#ff7a2a'}],{u,tgt:b}); },
    /* Burning Gaze: her basic attack on an enemy with her Lash Scorch lengthens each of them 0.5 s a rank, at most 3 s more for each Scorch */
    gaze(A,T,u,c){ const by=T.P.bg||0; if(!(by>0)) return; for(const d of lashOf(u,c.tgt)){ const room=3-(d._pyBg||0); const x=Math.min(by,room); if(x>1e-9){ extDot(d,x); d._pyBg=(d._pyBg||0)+x; } } },
    ventHeat(A,T,u,c){ const d=c.dot, t=c.tgt, E=A.eng(); if(!d||!t||d.kind!=='magic') return; const a=E.defMul(u,t,'magic'); if(!(a>0)) return; const sv=t.mrRating;
      t.mrRating=(sv||0)*Math.max(0,1-(T.P.vent||0)); const b=E.defMul(u,t,'magic'); t.mrRating=sv; c.amt*=b/a; },
    deadSc(A,T,u,c){ const x=c.unit; return !!x&&x.team!==u.team&&scOn(u,x); },
    catchSc(A,T,u,c){ const x=c.unit, E=A.eng(); let b=null, bd=Infinity; for(const y of foes(E,u)){ if(y===x) continue; const g=E.dist(x,y); if(g<bd){ bd=g; b=y; } } if(!b) return;
      for(const d of (x.dots||[]).slice()){ if(d._talO!==u.uid||!SCT[d._talK]) continue; const left=d.remaining-(d._talNow?1:0); if(left<1) continue;
        E.pushDot(b,d.dps,left*d.interval,d.interval,d.color,u,d.kind||'magic'); const nd=b.dots[b.dots.length-1]; nd._talO=u.uid; nd._talK=d._talK; if(d._talF!=null) nd._talF=d._talF; } },
    /* ---- EMBER DEBT: each enemy, each tick. Scorched: 1 a second (Interest 10% faster a rank), at most 10 (Compound Heat 0.4 more a rank). Not Scorched: cleared
       (Collector: after 4 s). Called In at 10. ---- */
    scan(A,T,u,c){ const s=T.s, P=T.P, E=A.eng(), dt=c.dt||0, D=s.pyDb||(s.pyDb={}), mx=10+(P['db.max']||0), rt=1+(P['db.rate']||0), keep=P['db.keep']||0;
      for(const x of E.units()){ if(x.team===u.team) continue; if(!x.alive){ delete D[x.uid]; continue; } let e=D[x.uid];
        if(scOn(u,x)){ if(!e) e=D[x.uid]={n:0,k:0,top:false}; const was=e.n; e.n=Math.min(mx,e.n+dt*rt); e.k=keep;
          if(was<10-1e-9&&e.n>=10-1e-9&&P.calledIn) u.energy=Math.min(100,(u.energy||0)+P.calledIn); }
        else if(e&&e.n>0){ if(e.k>0) e.k-=dt; else e.n=0; } } },
    dbT(A,T,u,c){ return dbOf(T,c.tgt); },
    broke10(A,T,u,c){ const x=c.unit; return !!x&&x.team!==u.team&&dbOf(T,x)>=10-1e-9; },
    bkPass(A,T,u,c){ const x=c.unit, E=A.eng(), D=T.s.pyDb||(T.s.pyDb={}), n=dbOf(T,x)*0.5; let b=null, bd=Infinity;
      for(const y of foes(E,u)){ if(y===x) continue; const g=E.dist(x,y); if(g<bd){ bd=g; b=y; } } if(!b||!(n>0)) return;
      const e=D[b.uid]||(D[b.uid]={n:0,k:0}); e.n=Math.min(10+(T.P['db.max']||0),e.n+n); e.k=Math.max(e.k,T.P['db.keep']||0); },
    /* ---- PAID IN KIND. Ember Lash collects at its arrival (kit): the hits written on its target (Payment Plan: half of them, and they stay), then they are
       cleared; Full Payment (5 written) stuns 0.8 s; Fuel for the Mountain with Magma; Steady Breath; Turn and Burn's shot; Molten Will. ---- */
    lashKit(A,T,u,c){ const s=T.s, P=T.P, t=c.tgt; s.pyCol=0; if(s.pyTBq){ s.pyTBq=0; s.pyTBh=1; } T.fn.mwArm(A,T,u);
      if(!t||t.team===u.team) return; const n=pkOf(T,u,t); if(!(n>0)) return;
      const col=P.plan?n/2:n; s.pyCol=col; if(!P.plan) A.ustPut(T,u,t,'pyPk',0);
      if(P.fullPay&&n>=5-1e-9) A.acts(T,u,[{later:[{fn:'fpStun'}]}],{u,tgt:t});
      if(P.fuel) A.stSet(T,u,'pyMag',stN(T,'pyMag')+Math.min(15,P.fuel*col));
      if(P.sb) u.energy=Math.min(100,(u.energy||0)+P.sb*col); },
    fpStun(A,T,u,c){ const t=c.tgt; if(t&&t.alive) T.fn.tstun(A,T,u,t,0.8); },
    colN(A,T){ return T.s.pyCol||0; },
    hit4(A,T,u,c){ return !!c.tgt&&mkOn(u,c.tgt,'pyH4',A.eng().now()); },
    /* her talent stuns: never on a stunned enemy, nor within 0.5 s after one of hers on it ended; the full written length, on the fixed-duration path */
    tstun(A,T,u,t,secs){ const s=T.s, L=s.pyLk||(s.pyLk={}); if(!t||!t.alive||(t.stunned||0)>0||L[t.uid]>0) return false; A.control(T,u,t,'stunned',secs);
      if((t.stunned||0)>0){ L[t.uid]=t.stunned+STUN_LOCK; s.pyStN=(s.pyStN||0)+1; return true; } return false; },
    /* ---- WHO HAS HIT HER MOST THIS WAVE (Red Ledger, Ash Robe): the most hits; a tie keeps the one that reached it first ---- */
    topRec(A,T,u,c){ const s=T.s, m=s.pyRl||(s.pyRl={}), x=c.src; if(!x) return; m[x.uid]=(m[x.uid]||0)+1; if(!s.pyTop||!s.pyTop.alive||m[x.uid]>(m[s.pyTop.uid]||0)) s.pyTop=x; },
    isTop(A,T,u,c){ const t=c.tgt, s=T.s; return !!t&&t===s.pyTop&&t.alive; },
    /* ---- MAGMA AND ERUPTIONS (Blazing Orbit at the threshold: 40, Bright Vent 3 fewer a rank). orbKit spends it; erHit: Magma's damage (6% of her ability
       power a rank, Lava Tube more below 50% HP) and Fissure's Scorch on each enemy struck; orbCast: Hot Spring, Vented, Crater, Obsidian Plate. ---- */
    thr(A,T){ return Math.max(1,40+(T.P['mag.thr']||0)); },
    orbKit(A,T,u){ const s=T.s; s.pyEr=0; T.fn.mwArm(A,T,u); if(!MAG.some(id=>T.r[id])) return; const th=T.fn.thr(A,T), n=stN(T,'pyMag');
      if(n>=th-1e-9){ A.stSet(T,u,'pyMag',n-th); s.pyEr=1; s.pyErN=(s.pyErN||0)+1; } },
    erupt(A,T){ return !!T.s.pyEr; },
    erHit(A,T,u,c){ const t=c.tgt, P=T.P, E=A.eng(); if(!t||!t.alive) return;
      if(P['mag.dmg']){ let x=P['mag.dmg']*(u.apow||0); if(P.lt&&t.hp<0.5*t.maxHp) x*=1+P.lt; x*=E.defMul(u,t,'magic')*(E.elemMul?E.elemMul(u,t):1); A.hurt(T,u,t,x,'#ff9a3a','pyEr'); }
      if(P.fis&&t.alive) T.fn.scorch(A,T,u,t,'pyE',1,4); },
    orbCast(A,T,u){ const s=T.s, P=T.P, E=A.eng(); if(!s.pyEr) return; s.pyEr=0;
      if(P.hs) u.energy=Math.min(100,(u.energy||0)+P.hs);
      if(P.vented) u.greenCd=Math.max(0,(u.greenCd||0)-P.vented);
      if(P.crater) T.fn.ashAt(A,T,u,u.x,u.y,2+P.crater,0);
      if(P.obs){ const x=P.obs*u.maxHp; u.shield=(u.shield||0)+x; u.shieldT=Math.max(u.shieldT||0,4); } },
    rocHit(A,T,u,c){ const t=c.tgt; if(t&&t.alive&&T.P.roc) T.fn.scorch(A,T,u,t,'pyR',1,T.P.roc); },
    /* ---- ASHFALL: a ground circle (body to body: an enemy is inside when any part of it is). Its Scorch each second, Smothering Ash's slow, Trailing Ash when an
       enemy walks out. Zones are cleared at each wave's start (their end is a fight time). ---- */
    ashAt(A,T,u,x,y,dur,rM,min){ const s=T.s, E=A.eng(), L=s.zn.pyAsh||(s.zn.pyAsh=[]); const r=Math.max(rM||0,3+(T.P['ash.r']||0));
      L.push({x,y,r:r*E.METER(),until:E.now()+dur,centre:false,min:min||0}); if(L.length>8) L.shift(); s.pyAshT=s.pyAshT||0; },
    ashTick(A,T,u,c){ const s=T.s, P=T.P, E=A.eng(), L=s.zn.pyAsh; if(!L||!L.length){ s.pyAshIn=null; return; } const now=E.now();
      for(let i=L.length-1;i>=0;i--) if(now>=L[i].until) L.splice(i,1); if(!L.length){ s.pyAshIn=null; return; }
      s.pyAshT=(s.pyAshT||0)+(c.dt||0); const sec=s.pyAshT>=1-1e-9; if(sec) s.pyAshT-=1;
      const was=s.pyAshIn||{}, now2={};
      for(const x of foes(E,u)){ const z=ashZ(T,x,E); if(!z){ if(was[x.uid]&&P['ash.trail']) for(const d of x.dots) if(d._talO===u.uid&&d._talK==='pyA'&&d.remaining>0) extDot(d,P['ash.trail']); continue; }
        now2[x.uid]=1; if(P['ash.slow']){ x.slow=Math.max(x.slow||0,0.2); x.slowMul=Math.min(x.slowMul==null?1:x.slowMul,1-P['ash.slow']); }
        const sh=Math.max(P.ash||0,z.min||0)*(1+(P['ash.str']||0)); if(sec&&sh>0) T.fn.scorch(A,T,u,x,'pyA',sh,1); }
      s.pyAshIn=now2; },
    /* ---- CROWNFIRE. cfKit: is this the half-power Crownfire of Settled in Fire? cfAt: where it lands, its damage to each enemy before resists, its main target (the
       living enemy nearest the centre among those it strikes). cfCast: Ashfall, Rain of Embers, the vent, the crown, Settled in Fire ---- */
    cfKit(A,T,u){ const s=T.s; s.pyCFh=s.pyHalfQ>0?1:0; if(s.pyHalfQ>0) s.pyHalfQ--; T.fn.mwArm(A,T,u); },
    cfAt(A,T,u,c){ const s=T.s, E=A.eng(), p=c.pt, R=(c.o&&c.o.radius)||95; let m=null, md=Infinity;
      for(const x of foes(E,u)){ const d=Math.hypot(x.x-p.x,x.y-p.y); if(d<R&&d<md){ md=d; m=x; } }
      s.pyCF={x:p.x,y:p.y,R,raw:c.raw||0,main:m,half:s.pyCFh,kill:false,db:m?dbOf(T,m):0,pk:m?pkOf(T,u,m):0}; s.pyCFh=0; },
    cfHalf(A,T){ return !!(T.s.pyCF&&T.s.pyCF.half); },
    isMain(A,T,u,c){ const f=T.s.pyCF; return !!f&&!!c.tgt&&c.tgt===f.main; },
    mainDb(A,T){ const f=T.s.pyCF; return f?f.db:0; },
    mainAll(A,T){ const f=T.s.pyCF; return f?f.db+f.pk:0; },
    sfKill(A,T){ const f=T.s.pyCF; if(f) f.kill=true; },
    cfCast(A,T,u){ const s=T.s, P=T.P, E=A.eng(), f=s.pyCF; s.pyCF=null; if(!f) return; const hk=f.half?0.5:1;
      if(ASH.some(id=>T.r[id])) T.fn.ashAt(A,T,u,f.x,f.y,4+(P['ash.dur']||0),P.vent9?5:0,P.vent9?0.4:0);
      if(P.rain){ const L=foes(E,u).filter(x=>scOn(u,x)&&Math.hypot(x.x-f.x,x.y-f.y)-E.bodyR(x)<6*E.METER());
        if(L.length){ const U=E.units(); let st=f.main?U.indexOf(f.main):-1; const ord=L.slice().sort((a,b)=>((U.indexOf(a)-st+U.length)%U.length)-((U.indexOf(b)-st+U.length)%U.length));
          for(let i=0;i<3;i++){ const x=ord[i%ord.length]; if(!x.alive) continue; A.hurt(T,u,x,0.30*f.raw*hk*(1+(P.glow||0))*E.defMul(u,x,'magic')*(E.elemMul?E.elemMul(u,x):1),'#ff6a2a','pyRain'); s.pyRainN=(s.pyRainN||0)+1;
            if(P.roll&&MAG.some(id=>T.r[id])) A.stSet(T,u,'pyMag',stN(T,'pyMag')+P.roll); } } }
      if(P.vent9) s.pyVent={x:f.x,y:f.y,R:f.R,raw:f.raw*hk,at:[0.8,2.4,4],t:0};
      if(P.crown){ A.acts(T,u,[{window:'pyCrown',dur:6},{window:'pyFree',dur:6,longest:true}],{u}); s.pyUhCd=0; T.fn.shimFull(A,T,u); }
      if(T.r.db_13_2&&f.main){ const m=f.main, D=s.pyDb||(s.pyDb={});
        if(f.kill&&!f.half){ let b=null; for(const x of foes(E,u)) if(x!==m&&(!b||x.hp>b.hp)) b=x;
          if(b){ const e=D[b.uid]||(D[b.uid]={n:0,k:0}); e.n=Math.min(10+(P['db.max']||0),e.n+f.db); e.k=Math.max(e.k,P['db.keep']||0,1);   // (kept at least until the second Crownfire lands)
            if(f.pk>0) A.ustPut(T,u,b,'pyPk',Math.min(T.st.pyPk.max,pkOf(T,u,b)+f.pk)); s.pyHalfQ=1; u._aimWX=null; u._aimWY=null; s.pySfN=(s.pySfN||0)+1; if(E.castUlt) E.castUlt(u,b); } }
        else if(m.alive){ if(D[m.uid]) D[m.uid].n=0; A.ustPut(T,u,m,'pyPk',0); } } },
    /* ---- WALL OF FLAME, THE CROWN, THE VENT: things on the field for a few seconds ---- */
    wallAt(A,T,u,c){ const E=A.eng(), p=c.pt, R=(c.o&&c.o.radius)||85, m=((c.o&&c.o.push)||1.5*E.METER())/E.METER(), inn={};
      for(const x of foes(E,u)) if(Math.hypot(x.x-p.x,x.y-p.y)<R) inn[x.uid]=1; T.s.pyWall={x:p.x,y:p.y,R,m,t:2,inn}; },
    fieldTick(A,T,u,c){ const s=T.s, P=T.P, E=A.eng(), dt=c.dt||0;
      const w=s.pyWall; if(w){ w.t-=dt; if(w.t<=0) s.pyWall=null; else for(const x of foes(E,u)){ const inside=Math.hypot(x.x-w.x,x.y-w.y)<w.R; if(inside&&!w.inn[x.uid]){ if(pushFrom(E,x,w.x,w.y,w.m)) s.pyWallN=(s.pyWallN||0)+1; } w.inn[x.uid]=inside?1:0; } }
      if(A.winOn(T,'pyCrown')){ T.fn.shimFull(A,T,u); const L=s.pyCrL||(s.pyCrL={});
        for(const x of foes(E,u)){ if(gapM(E,u,x)>=3||L[x.uid]>0) continue; L[x.uid]=2; pushFrom(E,x,u.x,u.y,1.5); T.fn.cinders(A,T,u,x,Math.max(P.cin||0,0.2)); s.pyCrN=(s.pyCrN||0)+1; } }
      const v=s.pyVent; if(v){ v.t+=dt; while(v.at.length&&v.t>=v.at[0]-1e-9){ v.at.shift(); const last=!v.at.length; let fresh=0;
          for(const x of foes(E,u)){ if(Math.hypot(x.x-v.x,x.y-v.y)>=v.R) continue; const was=scOn(u,x); A.hurt(T,u,x,0.5*v.raw*E.defMul(u,x,'magic')*(E.elemMul?E.elemMul(u,x):1),'#ff5a1a','pyVent'); if(x.alive){ T.fn.scorch(A,T,u,x,'pyV',0.5,3); if(!was) fresh++; } }
          s.pyVentN=(s.pyVentN||0)+1; if(MAG.some(id=>T.r[id])){ if(fresh) A.stSet(T,u,'pyMag',stN(T,'pyMag')+5*fresh); if(last){ const th=T.fn.thr(A,T); if(stN(T,'pyMag')<th) A.stSet(T,u,'pyMag',th); } } }
        if(!v.at.length) s.pyVent=null; } },
    /* ---- CINDERS: a melee enemy's basic attack on her. Cinders for 2 s (Hot Coals longer), Scorched at 20% a rank of Ember Lash's Scorch, Searing Touch's
       slow, Ringed's chance of a Shimmer; Cinderburst: an enemy that already had Cinders is pushed back 1 m (each enemy once every 6 s) ---- */
    cinHit(A,T,u,c){ const x=c.src; if(!x||!x.alive) return; const P=T.P, s=T.s, E=A.eng();
      if(P.cburst&&mkOn(u,x,'pyCin',E.now())){ const L=s.pyCbL||(s.pyCbL={}); if(!(L[x.uid]>0)){ L[x.uid]=6; if(pushFrom(E,x,u.x,u.y,1)) s.pyCbN=(s.pyCbN||0)+1; } }
      T.fn.cinders(A,T,u,x,P.cin||0); },
    cinders(A,T,u,x,share){ const P=T.P, d=2+(P['cin.dur']||0); A.setMark(T,u,x,'pyCin',{dur:d});
      if(share>0){ T.fn.scorch(A,T,u,x,'pyC',share,d); if(T.on.pyCinG) A.run(T,u,'pyCinG',{u,tgt:x}); }
      if(P['cin.slow']) A.acts(T,u,[{slow:P['cin.slow'],dur:d,on:'target'}],{u,tgt:x}); },
    /* ---- HEAT SHIMMER reaching 4: Mirage readies a miss, Cooling Glass heals ---- */
    shimG(A,T,u,c){ const n=stN(T,'pyShim'), was=n-(c.k||0); if(was<4-1e-9&&n>=4-1e-9) T.fn.shim4(A,T,u); },
    shim4(A,T,u){ const P=T.P; if(P.mirage) T.s.pyMir=1; if(P.cg) A.acts(T,u,[{heal:{pct:P.cg,of:'maxHp'}}],{u}); T.s.pySh4=(T.s.pySh4||0)+1; },
    shimFull(A,T,u){ const was=stN(T,'pyShim'), mx=A.stMax(T,u,'pyShim'); A.stSet(T,u,'pyShim',mx); const k=T.s.k.pyShim; if(k&&T.st.pyShim.dur) k.t=T.st.pyShim.dur; if(was<4-1e-9&&mx>=4-1e-9) T.fn.shim4(A,T,u); },
    mirOn(A,T){ return !!T.s.pyMir; }, mirOff(A,T){ T.s.pyMir=0; T.s.pyMirN=(T.s.pyMirN||0)+1; },
    /* ---- UNHELD (once every 18 s, Burning Free 1 s less a rank): a stun or a pull landing on her (seen on her tick, whatever wrote it: the game has no root, its
       roots are its stun) ends early by 15% a rank and every enemy within 2 m is pushed back 1 m. Molten Will, Clear Ground. While she is held free (Clear
       Ground 1.5 s, the crown 6 s) no stun or pull stays on her. ---- */
    free(A,T){ return A.winOn(T,'pyFree'); },
    uhTick(A,T,u){ const s=T.s, P=T.P, E=A.eng(); const st=u.stunned||0, pl=u.pullT||0, pb=u.pulledBy||null;
      if(A.winOn(T,'pyFree')){ if(st>0) u.stunned=0; if(pl>0){ u.pullT=0; u.pulledBy=null; } if(!((u._gearImmovableT||0)>=0.05)) u._gearImmovableT=0.05; }
      else { const nS=st>0&&st>Math.max(0,s.pySt||0)+1e-6, nP=pl>0&&(pl>(s.pyPl||0)+1e-6||pb!==s.pyPb);
        if((nS||nP)&&P.uh&&!(s.pyUhCd>0)){ const k=Math.max(0,1-P.uh); if(nS) u.stunned=st*k; if(nP) u.pullT=pl*k;
          for(const x of foes(E,u)) if(gapM(E,u,x)<2) pushFrom(E,x,u.x,u.y,1);
          s.pyUhCd=Math.max(1,18+(P['uh.cd']||0)); s.pyUhN=(s.pyUhN||0)+1; if(T.r.nh_4_3) s.pyMWq=1; if(P.cg15) A.acts(T,u,[{window:'pyFree',dur:1.5,longest:true}],{u}); } }
      s.pySt=u.stunned||0; s.pyPl=u.pullT||0; s.pyPb=u.pulledBy||null; },
    mwArm(A,T){ const s=T.s; s.pyMWc=0; if(s.pyMWq){ s.pyMWq=0; s.pyMWc=1; } },
    mwOn(A,T){ return !!T.s.pyMWc; },
    /* ---- BREAKING POINT: an enemy within 2 m of her and the ring ready (and no cast of hers under way): it fires at once (the game's own Blazing Orbit at that
       enemy, no press), and its cooldown starts as after a cast ---- */
    bp(A,T,u){ const E=A.eng(); if(!(u.blueAb)||(u.blueCd||0)>0||u._pend||(u.stunned||0)>0||(u.fearT||0)>0||(u.silencedT||0)>0||!E.castSlot) return;
      let b=null, bg=2; for(const x of foes(E,u)){ const g=gapM(E,u,x); if(g<bg){ bg=g; b=x; } } if(!b) return;
      E.castSlot(u,'blue',b); const c={u,slot:'blue',skill:'blue',amt:u.blueAb.cd||8}; A.run(T,u,'cd',c); u.blueCd=Math.max(0,c.amt); T.s.pyBpN=(T.s.pyBpN||0)+1; },
    /* ---- GLASS SKIN on shields: a shield on her grew since her last tick (any source): 2% a rank of the growth more ---- */
    gsTick(A,T,u){ const s=T.s, sh=u.shield||0; if(s.pyGs!=null&&sh>s.pyGs+1e-9) u.shield=sh+(sh-s.pyGs)*(T.P.gs||0); s.pyGs=u.shield||0; },
    /* ---- TURN AND BURN: after Blazing Orbit, her next Ember Lash flies 50% faster (the shot's flight time / 1.5) and deals 25% more ---- */
    tbArm(A,T){ T.s.pyTB=1; }, tbOn(A,T){ return !!T.s.pyTB; }, tbFly(A,T){ T.s.pyTB=0; T.s.pyTBq=1; }, tbHit(A,T){ return !!T.s.pyTBh; },
    /* ---- distances (body to body) ---- */
    near3(A,T,u){ const E=A.eng(); for(const x of foes(E,u)) if(gapM(E,u,x)<3) return true; return false; },
    clear3(A,T,u){ return !T.fn.near3(A,T,u); },
    far6(A,T,u,c){ const t=c.tgt; return !!t&&gapM(A.eng(),u,t)>6; },
    /* ---- HER DAMAGE REDUCTION, ONE GROUP. Every talent of hers that makes a hit on her smaller multiplies here (each takes its share of what is left), and together
       they never take more than 40% off a hit (DR_CAP). Her base kit has no reduction of its own (armour / magic resist leave a reference hit 5.6% / 13.5%
       smaller at level 100). ---- */
    drK(A,T,u,src,kind,crit){ const P=T.P, E=A&&A.eng&&A.eng(); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P['dr.shim']) cut(P['dr.shim']*stN(T,'pyShim'));
      if(E&&P['dr.bgw']){ let n=0; for(const x of E.units()) if(x.alive&&x.team!==u.team&&gapM(E,u,x)<3) n++; if(n>=2) cut(P['dr.bgw']); }
      if(src){ const now=E?E.now():0;
        if(P['dr.gm']&&dbOf(T,src)>=5-1e-9) cut(P['dr.gm']);
        if(P['dr.gf']&&scOn(u,src)) cut(P['dr.gf']);
        if(P['dr.ar']&&src===T.s.pyTop) cut(P['dr.ar']);
        if(E&&(P['ash.cloud']||P['dr.av'])&&inAsh(T,src,E)){ cut(P['ash.cloud']); cut(P['dr.av']); }
        if(P['dr.sh']&&mkOn(u,src,'pyCin',now)) cut(P['dr.sh']);
        if(P['dr.16']&&src.melee) cut(P['dr.16']); }
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ T.s.api=A; c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.crit); },
    /* ---- HER TALENTS ON HITS THAT ARE NOT ON HER (one teamIn row): Hard Ledger (a hit by her side on an enemy with 5 or more Ember Debt), Ash Cloud (a hit by an
       enemy inside Ashfall on one of her allies: at most its own 6%) ---- */
    teamK(A,T,u,c){ const t=c.tgt, s=c.src, P=T.P; if(!t||!s) return;
      if(t.team!==u.team&&s.team===u.team){ if(P.hl&&dbOf(T,t)>=5-1e-9) c.amt*=1+P.hl; return; }
      if(t.team===u.team&&t!==u&&s.team!==u.team&&P['ash.cloud']&&inAsh(T,s,A.eng())) c.amt*=1-Math.min(0.06,P['ash.cloud']); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/47 - PYROCLAST - talent decisions.md) */
  ruling:{}
};
