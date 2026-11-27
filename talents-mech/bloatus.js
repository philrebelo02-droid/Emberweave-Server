/* BLOATUS - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section named for Bloatus: what he added)
   His real kit (the code, not the tooltip wording; his skills read Ability Power, his hits are magic):
   - Toxic Breath ('toxbreath', green, cd 7): a straight plume from him to the FARTHEST enemy within 15 m (centre to centre), 1.4 m wide each side of
     the line (the 'num' hook 'breathW'; its aim goes through the 'skillTgt' hook). Each enemy on it takes 90% of his ability power and a poison of
     50% of his ability power a second for 4 s (magic).
   - Swampcall ('swamproot', blue, cd 10, delivered: it forms 0.35 s after the cast): a swamp opens under each of the TWO farthest enemies (o._farTgts,
     picked at the launch; 2.4 m, centre to centre). Each enemy in one takes 70% of his ability power and is ROOTED - the game's root is its stun
     field (ccApply 'stunned', 2 s x 0.7 = 1.4 s) - and silenced (2 s). Rooted in his trees = that field.
   - Contagion (passive 'contagion'): when an enemy dies carrying his poison, the poison (its last strength a second) lands on every enemy within
     2.6 m of it, centre to centre, for 4 s + 0.02 s a passive level; those can spread it again. (Hooks 'spreadR' / 'spreadIn' / 'spread'.) Two heroes
     standing side by side are about 5 m apart centre to centre, so untalented it almost never spreads (0 spreads in 18 seeded fights). With any Plague King
     talent his talents read that 2.6 m body to body, the convention of every talent distance (decisions file).
   - Plague Sovereign (ultimate 'plaguesov'; ULT_DEF radius 5 m, HERO_ULT_ART.bloatus only adds the art and a 0.35 s delivery): every enemy within
     5 m of HIM (centre to centre; the 'skillTgt' hook may move the centre) takes 160% of his ability power and a poison of 60% a second for 5 s.
   - Every poison of his skills and of Contagion is QUEUED and lands 0.5 s later (plagueDot); the 'poisQ' / 'pois' hooks make each one his.
   Rot, the Carrier, Outbreak, the Court, Command, Waterlogged, Bloat, Reign and Marshwater exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/16 - BLOATUS - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const BR='toxbreath', SW='swamproot', SOV='plaguesov', SK=[BR,SW,SOV], GREEN='#8fbf3f';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const ROT=['pk_1_2','pk_2_2','pk_3_1','pk_4_2','pk_5_2','pk_5_3','pk_7_1','pk_8_2','pk_9_2','pk_11_1','pk_13_2'];
const CAR=['pk_1_1','pk_2_1','pk_3_1','pk_n2','pk_7_1','pk_10_1','pk_11_1'];
const OB=['pk_1_4','pk_5_4','pk_6_4','pk_7_4','pk_12_2','pk_12_4','pk_13_2','pk_n2'];
const COURT=['dc_1_4','dc_2_4','dc_3_4','dc_4_4','dc_6_4','dc_8_4','dc_10_4','dc_11_3','dc_11_4','dc_12_3','dc_12_4','dc_13_3','pk_n2'];
const WL=['dc_2_3','dc_4_3','dc_5_2','dc_5_3','dc_6_2','dc_6_3','dc_8_3'];
/* v1464 regeneration cap: Swell, The Old King and Mud Throne are regeneration ({regen:true}: together at most 1.2% of his max HP a second, the
   engine's allowance). Sip Slowly is NOT: it drinks Marshwater, and Marshwater is a burst by the design ruling (WIRING/16: "Marshwater, Belly Laugh,
   Court Physician, Endemic and Sickly Sweet are bursts or small and stay as written"; "Sip Slowly: each sip of 5 is a drink") - {burst:true} says so. */
const BLOAT=['km_1_1','km_2_1','km_3_1','km_4_1','km_6_1','km_7_1','km_8_1','km_10_1','km_11_1','km_12_1','km_13_2'];
const REIGN=['km_1_4','km_3_4','km_5_4','km_6_4','km_7_4','km_9_4','km_10_4'];
const MARSH=['km_2_2','km_4_2','km_5_2','km_5_3','km_6_2','km_6_3','km_7_2','km_9_2','km_11_2','km_12_2','km_13_2'];
const TEN=['dc_8_2','km_12_3','km_5_1'];
const ROOT_HIT={casting:SW,cc:['stunned'],talent:false};                          // Swampcall's own root landed
const ALLY_HIT={srcTeam:'enemy',targetTeam:'ally'};                                // an enemy's hit on one of his allies (teamIn: never himself)
const TEAM_HIT={srcTeam:'ally',targetTeam:'enemy'};                                // a hit of his team (himself included) on an enemy
const SOUR=[{fn:'tpois',on:'source',amt:{pct:R(0.01),of:'apow'},dur:2,tag:'sour',refresh:true}];
/* ---- helpers ---- */
const held=x=>!!x&&x.alive&&((x.stunned||0)>0||(x.silencedT||0)>0);              // rooted (the game's root is its stun field), stunned or silenced
const foes=(A,T,u)=>A.pick(T,u,{team:'enemy'},{});
/* Toxic Breath's own poison a second, as the skill makes it now: 50% of his ability power (with a running damage buff) at its skill level */
function breathPd(A,u){ const E=A.eng(), lv=(u.skillLv&&u.skillLv[1])||1, sm=E.skillMul?E.skillMul(lv):1, ab=u.greenAb||{};
  return (u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*sm*(ab.dps||0.5); }
/* a poison his talent puts on t (straight on: no 0.5 s wait), his from the start (tag), with the game's Contagion flags so it can spread; then his 'pois' rows */
function tp(A,T,u,c,t,amt,dur,tag,kind,refresh){ const E=A.eng(); if(!t||!t.alive||!(amt>0)||!(dur>0)) return;
  if(refresh&&t.dots) for(const d of t.dots) if(d._talO===u.uid&&d._talK===tag&&d.remaining>0){ d.dps=amt; d.remaining=Math.max(d.remaining,Math.max(1,Math.round(dur))); d._talF=null;
    A.run(T,u,'pois',Object.assign({},c,{tgt:t,dot:d,skill:tag,was:true})); return; }
  const was=A.hasDot(u,t,true); E.pushDot(t,amt,dur,1,GREEN,u,kind||'true'); const d=t.dots[t.dots.length-1]; if(!d) return; d._talO=u.uid; d._talK=tag;
  if(!t._plagueColor||t._plagueColor===GREEN){ t._plagueColor=GREEN; t._plagueHex=0x8fbf3f; if(u.pass&&u.pass.contagion) t._contagion=true; if(!(t._plagueDps>0)) t._plagueDps=amt; }
  A.run(T,u,'pois',Object.assign({},c,{tgt:t,dot:d,skill:tag,was})); }
/* how much of his poison an enemy carries: what his DoTs on it still have to deal */
function load(u,x){ let v=0; const D=x.dots; if(D) for(let i=0;i<D.length;i++){ const d=D[i]; if(d._talO===u.uid&&d.remaining>0) v+=d.dps*(d.remaining-1+(d._talF!=null?d._talF:1)); } return v; }
function members(A,T,u){ return A.pick(T,u,{team:'enemy',has:'crt'},{}); }
function rotAtLeast(A,T,u,t,n){ if(t&&A.ustGet(T,u,t,'rot')<n) A.ustPut(T,u,t,'rot',Math.min(5,n)); }
module.exports={
  hero:'bloatus',
  casting:true,                         // rows ask which of his skills a hit, a poison or a root comes from
  poison:true,                          // the poison hooks: each poison of his is his (where it came from), and Contagion's reach and spread
  states:{
    rot:{unit:true,max:5,dur:P('rot.dur',6)},                                      // Rot on each enemy: all lapse 6 s after the last
    ob:{max:P('ob.max',10),wave:'reset',gain:'obGain'},                            // Outbreak (this wave)
    bloat:{max:10,dur:P('bloat.dur',5)},                                           // Bloat: all lapse 5 s after the last
    reign:{max:8,wave:'reset'},                                                    // Reign (this wave)
    marsh:{max:P('marsh.max',30)}                                                  // Marshwater
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'pois',reqAny:ROT,if:{fn:'was'},do:[{ustack:'rot',on:'target',add:1}]},                                  // Rot: he poisons an enemy that already carries his poison
    {on:'tick',reqAny:CAR.concat(COURT),do:[{fn:'scan'}]},                                                       // the Carrier (the most of his poison) and who counts as the Court
    {on:'death',reqAny:['pk_1_1','pk_3_1'],if:{unitHas:'car'},do:[{fn:'carDied'}]},                             // the Carrier died (Patient Zero's reach, Plague Bearer)
    {on:'spreadR',pts:['plague_king',1],do:[{fn:'gapReach'}]},                                                  // with any Plague King talent: Contagion's reach is measured body to body
    {on:'spread',reqAny:OB,do:[{stack:'ob',add:{flat:1,k:1}}]},                                                  // Outbreak: each enemy Contagion spreads to
    {on:'ccHit',reqAny:COURT,if:{cc:['stunned','silencedT']},do:[{mark:'court',on:'target',cap:P('court.max',6),added:'courtJoin'}]},   // the Court: every enemy he roots or silences
    {on:'wave',reqAny:COURT,do:[{fn:'courtWave'}]},                                                             //   this wave only
    {on:'ccHit',reqAny:WL,if:ROOT_HIT,do:[{mark:'swr',on:'target',dur:30,while:'stunned',ends:'rootEnd'}]},   // Swampcall's root: its end (the stun field running out) is an event
    {on:'hurt',reqAny:BLOAT,do:[{stack:'bloat',add:1}]},                                                        // Bloat: each hit he takes
    {on:'tick',reqAny:REIGN,period:5,rate:{rk:'km_5_4',r:0.1,b:1},do:[{stack:'reign',add:1}]},                  // Reign: every 5 s alive (Rule by Waiting: faster)
    {on:'dotTick',reqAny:MARSH,do:[{stack:'marsh',add:1}]},                                                     // Marshwater: each tick of his poison
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]}                                                                       // shorter controls on him, with their caps
  ],
  talents:{
    /* ============================== THE PLAGUE KING ============================== */
    pk_1_1:[ {on:'dotOut',if:{targetHas:'car'},more:R(0.05)},                                                   // Patient Zero: his poison on the Carrier ticks harder
             {on:'spreadR',if:{fn:'deadCar'},addM:R(0.3)} ],                                                    //   and Contagion reaches farther when the Carrier dies
    pk_1_2:[ {on:'dotOut',more:R(0.006),per:{ust:'rot'}} ],                                                     // Rot: each Rot on it
    pk_1_4:[ {stat:{apow:R(0.003)},per:'ob'} ],                                                                 // Outbreak
    pk_2_1:[ {stat:{move:R(-0.04)},to:'holder:car'} ],                                                          // Fever: the Carrier moves slower
    pk_2_2:[ {param:'rot.dur',add:R(1)} ],                                                                      // Deep Rot
    pk_3_1:[ {on:'death',if:{unitHas:'car'},do:[{fn:'bearer'}]} ],                                              // Plague Bearer: the next most poisoned is the Carrier at once, with 2 Rot
    pk_4_2:[ {on:'teamHeal',if:{unitUst:{rot:5}},less:R(0.05)} ],                                               // Black Rot
    pk_n2:[ {on:'in',if:{srcHas:'car'},less:0.03},                                                              // Sick at Court (LINK): the Carrier deals less to him
            {param:'crt.car',add:1,req:'dc_1_4'},                                                               //   with Hold Court: the Carrier counts as a member of the Court
            {on:'death',req:'dc_1_4',if:{unitHas:'crt',unitDot:true},do:[{stack:'ob',add:1}]} ],               //   and a member that dies poisoned gives 1 Outbreak
    pk_3_4:[ {on:'spreadR',addM:R(0.2)} ],                                                                      // Epidemic
    pk_4_1:[ {on:'pois',do:[{extendDot:R(0.3)}]} ],                                                             // Long Sickness: every poison of his
    pk_5_2:[ {stat:{armor:-0.15,mr:-0.15},to:{team:'enemy',ust:{rot:5}}} ],                                     // Rot to the Core (PICK ONE)
    pk_5_3:[ {on:'spread',do:[{fn:'rotCarry'}]} ],                                                              // Clean Spread (PICK ONE)
    pk_4_3:[ {on:'num',skill:'breathW',addM:R(0.2)} ],                                                          // Thick Fumes
    pk_n1:[ {on:'dotOut',if:{fn:'heldT'},more:R(0.04)} ],                                                       // Bedridden
    pk_6_3:[ {on:'poisQ',skill:'spread',more:R(0.04)} ],                                                        // Carried on the Wind
    pk_5_4:[ {on:'in',less:R(0.002),per:'ob'} ],                                                                // Sick Room
    pk_6_1:[ {on:'in',if:{srcDot:true},less:R(0.01)}, {on:'teamIn',if:Object.assign({srcDot:true},ALLY_HIT),less:R(0.01)} ],   // Marsh Gas
    pk_6_2:[ {on:'hit',if:{casting:SW,targetTeam:'enemy'},do:[{fn:'seepHit'}]},                                // Seeping: Swampcall's hit, then its root
             {on:'ccHit',if:ROOT_HIT,do:[{fn:'seep'}]} ],
    pk_6_4:[ {on:'wave',do:[{stack:'ob',add:R(2)}]} ],                                                          // Old Pestilence
    pk_7_1:[ {on:'pois',skill:BR,do:[{ustack:'rot',on:'target',add:2}]},                                        // Breath of the Drowned: 2 Rot
             {on:'skillTgt',skill:BR,do:[{retarget:'holder:car',if:{fn:'carIn15'}}]} ],                        //   and the plume turns toward the Carrier
    pk_7_3:[ {on:'dotOut',more:R(0.02)} ],                                                                      // Crown of Flies
    pk_7_4:[ {on:'pois',skill:'spread',if:{stackMin:{ob:10}},do:[{extendDot:R(0.4)}]} ],                       // Plague Wind
    pk_8_1:[ {on:'dotOut',if:{targetHpBelow:0.40},more:R(0.03)} ],                                              // Wasting
    pk_8_2:[ {stat:{aspd:R(-0.003)},per:{ust:'rot'},to:{team:'enemy',ust:{rot:1}}} ],                          // Weeping Sores
    pk_8_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                              // Royal Patience
    pk_9_2:[ {on:'spreadR',if:{fn:'deadRot5'},mul:2}, {on:'spread',do:[{fn:'spore'}]} ],                        // Spore Burst
    pk_9_3:[ {on:'out',if:{casting:SK},ignoreMr:R(0.02)} ],                                                     // Bitter Air
    pk_9_4:[ {stat:{mr:R(0.004)},per:{units:{team:'enemy',dot:true},max:6}} ],                                  // Sick Kingdom
    pk_10_1:[ {on:'teamIn',if:Object.assign({targetHas:'car'},TEAM_HIT),more:R(0.02)}, {on:'dotOut',if:{targetHas:'car'},more:R(0.02)} ],   // Infection
    pk_10_2:[ {on:'dotTick',do:[{heal:{pct:R(0.01),of:'hit'}}]} ],                                              // Sickly Sweet
    pk_11_1:[ {on:'skillTgt',skill:SOV,do:[{retarget:'holder:car',if:{fn:'carIn6'}}]},                         // The Sick King's Mark
              {on:'hit',if:{casting:SOV,targetTeam:'enemy'},do:[{ustack:'rot',on:'target',add:3}]} ],
    pk_11_2:[ {on:'spread',do:[{heal:{pct:R(0.005),of:'maxHp'}}]} ],                                            // Endemic
    pk_11_4:[ {on:'out',if:{casting:SOV},more:R(0.03)}, {on:'dotOut',if:{tag:SOV},more:R(0.03)} ],             // Rotting Ground
    pk_12_1:[ {on:'pois',skill:BR,do:[{extendDot:R(0.5)}]} ],                                                   // Lingering Cough
    pk_12_2:[ {on:'dotOut',more:R(0.002),per:'ob'} ],                                                           // Pandemic
    pk_2_3:[ {on:'out',if:{casting:BR},more:R(0.03)}, {on:'dotOut',if:{tag:BR},more:R(0.03)} ],                // Swamp Lungs
    pk_12_4:[ {param:'ob.max',add:R(2)} ],                                                                      // Spreading Season
    pk_13_2:[ {on:'obGain',if:{stackMin:{ob:10}},once:'wave',do:[{fn:'kingdom'}]},                             // The Kingdom Falls Sick (SIGNATURE)
              {on:'spreadR',if:{window:'ksick'},add:1e9},
              {on:'death',if:{window:'ksick',unitDot:true},do:[{energy:10}]} ],
    /* ============================== THE DROWNED COURT ============================== */
    dc_1_1:[ {param:'cmd.cd',add:R(-1,12)},                                                                     // By Royal Command: every 12 - 1 s
             {on:'wave',do:[{fn:'cmdWave'}]}, {on:'hurt',do:[{fn:'command'}]} ],
    dc_2_2:[ {on:'kit',skill:SW,opt:{radius:{addM:R(0.2)}}} ],                                                  // Deep Swamp
    dc_1_4:[ {on:'in',less:R(0.005),per:{units:{team:'enemy',has:'crt'}}} ],                                    // Hold Court
    dc_2_3:[ {on:'rootEnd',do:[{mark:'wl',on:'target',dur:P('wl.dur',4),longest:true}]},                       // Waterlogged
             {stat:{cdRate:R(-0.02)},to:{team:'enemy',has:'wl'}} ],
    dc_2_4:[ {param:'court.max',add:R(1)} ],                                                                    // Courtiers
    dc_3_1:[ {param:'cmd.dur',add:R(0.2)} ],                                                                    // Raised Voice
    dc_7_2:[ {on:'in',if:{fn:'held2'},less:R(0.015)} ],                                                         // Old Throne
    dc_3_4:[ {on:'death',if:{unitHas:'crt'},do:[{silence:0.5,on:{team:'enemy',has:'crt'}}]} ],                  // Dismissed
    dc_4_2:[ {on:'ccHit',if:ROOT_HIT,do:[{fn:'longRoot'}]} ],                                                   // Long Root: added to the root that landed (it sits at the 2.8 s ceiling)
    dc_4_3:[ {param:'wl.dur',add:R(0.5)} ],                                                                     // Sodden
    dc_4_4:[ {on:'in',if:{srcHas:'crt'},less:R(0.01)} ],                                                        // Loyal Subjects
    dc_5_1:[ {on:'in',if:{srcHas:'cmd'},less:R(0.03)}, {on:'teamIn',if:Object.assign({srcHas:'cmd'},ALLY_HIT),less:R(0.03)} ],   // Iron Etiquette
    dc_8_3:[ {on:'teamIn',if:Object.assign({targetHas:'wl'},TEAM_HIT),more:R(0.015)} ],                         // Bog Fever
    dc_n1:[ {on:'teamIn',if:Object.assign({fn:'heldS'},ALLY_HIT),less:R(0.02)} ],                               // Kept in Their Place
    dc_6_1:[ {param:'cmd.fp',add:R(0.5)} ],                                                                     // First Petition (ready at the wave's start: cmdWave)
    dc_9_2:[ {on:'out',if:{casting:SK},ignoreMr:R(0.02)} ],                                                     // Mire Magic
    dc_6_3:[ {stat:{move:R(-0.02)},to:{team:'enemy',has:'wl'}} ],                                               // Silt in the Gears
    dc_6_4:[ {stat:{apow:R(0.003)},per:{units:{team:'enemy',has:'crt'}}} ],                                     // Weight of the Crown
    dc_8_2:[ {param:'ten.sil',add:R(0.1)} ],                                                                    // Throne Room Air (the 'ten' always row)
    dc_7_4:[ {on:'out',if:{casting:SW},more:R(0.03)} ],                                                         // Royal Marsh
    dc_7_1:[ {on:'dotOut',if:{targetHas:'cmd'},more:R(0.02)} ],                                                 // No Leave Given
    dc_5_2:[ {on:'rootEnd',do:[{pull:'target',to:'self',m:1.5,secs:0.3},{emit:'lifted'}]} ],                   // Lifted Out (PICK ONE)
    dc_5_3:[ {on:'tick',do:[{fn:'sunk'}]} ],                                                                    // Sunk to the Neck (PICK ONE)
    dc_8_4:[ {on:'courtJoin',do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                                           // Court Physician
    dc_9_1:[ {on:'kit',skill:SW,do:[{fn:'sovRight'}]},                                                          // Sovereign Right
             {on:'ccHit',if:Object.assign({targetHas:'cmd'},ROOT_HIT),do:[{fn:'recmd'}]} ],
    dc_6_2:[ {on:'lifted',do:[{fn:'reeds'}]} ],                                                                 // Into the Reeds
    dc_9_4:[ {on:'tick',regen:true,if:{fn:'anyRooted'},period:1,do:[{heal:{pct:R(0.001),of:'maxHp'}}]} ],                 // Mud Throne
    dc_10_1:[ {on:'command',do:[{cd:'blue',add:R(-0.3)}]} ],                                                    // Heralds
    dc_10_3:[ {on:'kit',skill:SW,opt:{silence:{add:R(0.1),ccRaw:true}}} ],                                      // Drowned Ear
    dc_10_4:[ {on:'teamHeal',if:{unitHas:'crt'},less:R(0.02)} ],                                                // Large Court
    dc_11_2:[ {on:'in',if:{crit:true},less:R(0.02)} ],                                                          // Throne Weight
    dc_11_3:[ {on:'hit',if:{casting:SOV,targetTeam:'enemy'},do:[{stun:0.8,on:'target'}]} ],                     // The Tide Answers (the root joins the Court)
    dc_11_4:[ {on:'out',if:{casting:BR,targetHas:'crt'},more:R(0.03)}, {on:'dotOut',if:{tag:BR,targetHas:'crt'},more:R(0.03)} ],   // Gilded Chains
    dc_12_1:[ {param:'cmd.n',add:R(1)} ],                                                                       // Standing Order
    dc_12_2:[ {on:'in',if:{selfHpBelow:0.40},less:R(0.02)} ],                                                   // Stubborn Ruler
    dc_12_3:[ {on:'out',if:{casting:SK,fn:'full'},more:R(0.02)} ],                                              // Kingdom Under Water
    dc_12_4:[ {stat:{atk:R(-0.01)},to:{team:'enemy',has:'crt'}} ],                                              // Bowed Heads
    dc_13_3:[ {on:'tick',if:{fn:'full'},do:[{window:'llk',dur:3,cd:25},{fn:'holdCourt'}]},                     // Long Live the King (SIGNATURE)
              {on:'in',if:{window:'llk'},less:0.40} ],
    /* ============================== KEPT BY THE MARSH ============================== */
    km_1_1:[ {on:'tick',regen:true,if:{stackMin:{bloat:1}},period:1,do:[{heal:{pct:R(0.0002),of:'maxHp',x:'bloat'}}]} ],   // Swell
    km_2_3:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                             // Wet Lungs
    km_1_4:[ {stat:{mr:R(0.005),apow:R(0.005)},per:'reign'} ],                                                  // Long Reign
    km_2_1:[ {param:'bloat.dur',add:R(1)} ],                                                                    // Gassy
    km_2_2:[ {on:'tick',edge:true,if:{selfHpBelow:0.50},do:[{fn:'drink',all:true}]} ],                         // Marshwater: drunk when he drops below 50%
    km_3_1:[ {on:'kit',skill:BR,do:[{fn:'belch'}]} ],                                                           // Belch
    km_5_4:[ {param:'reign.rate',add:R(0.1)} ],                                                                 // Rule by Waiting (read by the Reign row: rate)
    km_3_4:[ {on:'tick',regen:true,if:{stackMin:{reign:1}},period:1,do:[{heal:{pct:R(0.0002),of:'maxHp',x:'reign'}}]} ],   // The Old King
    km_4_1:[ {on:'in',less:R(0.002),per:'bloat'} ],                                                             // Thick Gut
    km_4_2:[ {param:'marsh.max',add:R(5)} ],                                                                    // Deep Well
    km_4_3:[ {on:'in',if:{fn:'front'},less:R(0.02)} ],                                                          // Royal Girth
    km_5_1:[ {param:'ten.all',add:R(0.04)} ],                                                                   // Stubborn as Groll (the 'ten' always row; up to 20%)
    km_5_2:[ {on:'tick',burst:true,if:{selfHpBelow:0.50,stackMin:{marsh:1}},period:1,do:[{fn:'drink',n:5,mul:1.3}]} ],     // Sip Slowly (PICK ONE)
    km_5_3:[ {on:'kit',skill:BR,do:[{fn:'brine'}]}, {on:'out',if:{casting:BR,fn:'brineOn'},more:0.2},          // Spit the Brine (PICK ONE)
             {on:'poisQ',skill:BR,if:{fn:'brineOn'},more:0.2}, {on:'cast',skill:BR,do:[{fn:'brineOff'}]} ],
    km_6_1:[ {on:'hit',if:{auto:true,targetTeam:'enemy',stackMin:{bloat:5}},do:[{fn:'tpois',on:'target',amt:{pct:R(0.05),of:'hit'},dur:2,tag:'wallow',refresh:true}]} ],   // Wallow
    km_6_2:[ {on:'hurt',if:{auto:false},do:[{stack:'marsh',add:R(1)}]} ],                                       // Brackish
    km_6_3:[ {on:'hit',if:{casting:BR,targetTeam:'enemy',fn:'brineFirst'},do:[{silence:R(0.2),on:'target'}]} ],  // Bitter Brine
    km_6_4:[ {on:'wave',do:[{stack:'reign',add:R(2)}]} ],                                                       // Old Grievance
    km_7_1:[ {on:'belched',do:[{heal:{pct:R(0.003),of:'maxHp',x:'spent'}}]} ],                                  // Belly Laugh
    km_7_2:[ {on:'kit',skill:SW,do:[{fn:'mySwamp'}]},                                                           // The Marsh Keeps Him: a third swamp under him
             {on:'cast',skill:SW,do:[{zone:'msw',at:'self',radiusPx:{opt:'radius'},dur:3.02,centre:true}]},
             {on:'tick',if:{fn:'onSwamp'},period:1,do:[{stack:'marsh',add:2}]},
             {stat:{immovable:1},if:{fn:'onSwamp'}} ],
    km_7_3:[ {on:'out',if:{casting:BR},more:R(0.03)}, {on:'dotOut',if:{tag:BR},more:R(0.03)} ],                // Plague Lungs
    km_7_4:[ {on:'in',if:{stackMin:{reign:8}},less:R(0.015)} ],                                                 // Ancient Reign
    km_8_1:[ {on:'hurt',chance:R(0.1),do:[{stack:'bloat',add:1}]} ],                                            // Overfull: 2 Bloat (the 1 of the always row, and 1 more)
    km_9_3:[ {on:'hurt',if:{srcMelee:true},do:SOUR} ],                                                          // Sour Belly
    km_8_3:[ {on:'dotOut',more:R(0.02)} ],                                                                      // Swamp Rot
    km_9_2:[ {on:'drank',do:[{window:'sf',dur:6}]}, {stat:{apow:R(0.01)},if:{window:'sf'}} ],                   // Spring Flood
    km_9_4:[ {on:'tick',edge:true,if:{selfHpBelow:0.30,stackMin:{reign:8}},do:[{fn:'tna'}]},                   // Throne Not Abandoned
             {on:'lethal',if:{stackMin:{reign:8}},do:[{fn:'tna'}]} ],                                            //   (a blow that takes him from above 30% to 0)
    km_10_1:[ {param:'belch.more',add:R(0.04)} ],                                                               // Burst Seams (read by belch)
    km_10_2:[ {on:'healMe',more:R(0.02)} ],                                                                     // Peat Bog
    km_10_4:[ {stat:{hp:R(0.002)},per:'reign'} ],                                                               // Patience of Kings
    km_11_1:[ {on:'death',if:{unitDot:true},chance:R(0.2),do:[{stack:'bloat',add:1}]} ],                       // Gorge
    km_11_2:[ {on:'cast',skill:SOV,do:[{fn:'drink',all:true,force:true}]},                                      // Sovereign Body
              {on:'pois',skill:SOV,do:[{stack:'marsh',add:3}]} ],
    km_11_3:[ {on:'dotIn',less:R(0.02)} ],                                                                      // Drowned Patience
    km_12_1:[ {on:'out',if:{stackMin:{bloat:10}},more:R(0.03)}, {on:'dotOut',if:{stackMin:{bloat:10}},more:R(0.03)} ],   // Ballast
    km_12_2:[ {on:'in',less:R(0.0005),per:'marsh'} ],                                                           // The Rising Water
    km_12_3:[ {param:'ten.sil2',add:R(0.1)} ],                                                                  // Toad Throat (the 'ten' always row)
    km_12_4:[ {on:'healMe',if:{selfHpBelow:0.50},more:R(0.03)} ],                                               // Long-Lived
    km_13_2:[ {on:'lethal',once:'fight',do:[{undying:5},{fn:'throne'}]},                                       // He Would Not Leave the Throne (SIGNATURE)
              {on:'tick',if:{window:'kthr'},period:1,do:[{fn:'tpois',on:{team:'enemy',within:4},amt:'breath',dur:1,tag:'throne',kind:'magic'}]} ]
  },
  fn:{
    was(A,T,u,c){ return !!c.was; },
    gapReach(A,T,u,c){ c.body=true; },
    heldT(A,T,u,c){ return held(c.tgt); },
    heldS(A,T,u,c){ return held(c.src); },
    held2(A,T,u){ let n=0; for(const x of foes(A,T,u)) if(held(x)&&++n>=2) return true; return false; },
    anyRooted(A,T,u){ for(const x of foes(A,T,u)) if((x.stunned||0)>0) return true; return false; },
    /* Royal Girth: an enemy hero whose combat row is the front row (a monster has none: a melee monster counts) */
    front(A,T,u,c){ const s=c.src; if(!s) return false; const row=s.t&&s.t.row; return row?row==='Front':!!s.melee; },
    /* every tick: the Carrier (the living enemy carrying the most of his poison; on a tie the Carrier stays), and who counts as a member of the Court
       ('crt': the Court, and with Sick at Court + Hold Court the Carrier too) */
    scan(A,T,u){ const E=A.eng(), U=E.units(), cur=T.s.m.car; let best=null, bv=0, cv=-1;
      for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive||x.team===u.team) continue; const v=load(u,x); if(x===cur) cv=v; if(v>bv+1e-9){ best=x; bv=v; } }
      if(best&&cur&&cur!==best&&cur.alive&&cv>=bv-1e-9) best=cur;
      if(best){ if(cur!==best||!A.markOf(u,best,'car')) A.setMark(T,u,best,'car',{unique:true}); }
      else if(cur){ A.clearMark(u,cur,'car'); T.s.m.car=null; }
      const lc=!!T.P['crt.car'];
      for(let i=0;i<U.length;i++){ const x=U[i]; if(x.team===u.team) continue; const want=!!A.markOf(u,x,'court')||(lc&&x===best&&x.alive), has=!!A.markOf(u,x,'crt');
        if(want&&!has) A.setMark(T,u,x,'crt',{}); else if(!want&&has) A.clearMark(u,x,'crt'); } },
    carDied(A,T,u,c){ T.s.carDead=c.unit; },
    deadCar(A,T,u,c){ return !!c.unit&&(T.s.carDead===c.unit||!!A.markOf(u,c.unit,'car')); },
    /* Plague Bearer: the enemy with the next most poison becomes the Carrier at once, with at least 2 Rot */
    bearer(A,T,u,c){ const dead=c.unit; let best=null, bv=0; for(const x of foes(A,T,u)){ if(x===dead) continue; const v=load(u,x); if(v>bv+1e-9){ best=x; bv=v; } }
      if(!best) return; A.setMark(T,u,best,'car',{unique:true}); rotAtLeast(A,T,u,best,2); },
    deadRot5(A,T,u,c){ return A.ustGet(T,u,c.unit,'rot')>=5; },
    /* Clean Spread: each enemy Contagion spread to gets the dead enemy's Rot (if it had less) */
    rotCarry(A,T,u,c){ const n=A.ustGet(T,u,c.unit,'rot'); if(!(n>0)) return; for(const x of c.vic||[]) if(x.alive) rotAtLeast(A,T,u,x,n); },
    /* Spore Burst: a dead enemy with 5 Rot: the enemies it spread to start with 3 Rot */
    spore(A,T,u,c){ if(A.ustGet(T,u,c.unit,'rot')<5) return; for(const x of c.vic||[]) if(x.alive) rotAtLeast(A,T,u,x,3); },
    carIn15(A,T,u){ const h=T.s.m.car, E=A.eng(); return !!(h&&h.alive&&A.markOf(u,h,'car')&&E.dist(u,h)<=15*E.METER()); },
    carIn6(A,T,u){ const h=T.s.m.car; return !!(h&&h.alive&&A.markOf(u,h,'car')&&A.gap(u,h)<6*A.eng().METER()); },
    /* Seeping: Swampcall's hit on an enemy is kept until its root lands; then a poison of 5% per rank of that hit a second for 3 s */
    seepHit(A,T,u,c){ const s=T.s.swh||(T.s.swh={}); if(c.tgt) s[c.tgt.uid]=c.amt||0; },
    seep(A,T,u,c){ const t=c.tgt, s=T.s.swh||{}, h=t?(s[t.uid]||0):0; if(t) delete s[t.uid]; tp(A,T,u,c,t,h*0.05*(T.r.pk_6_2||0),3,'seep','true'); },
    /* The Kingdom Falls Sick: every enemy poisoned (Toxic Breath's own poison, 4 s) with 5 Rot; 6 s of Contagion with no range limit */
    kingdom(A,T,u,c){ const pd=breathPd(A,u); A.acts(T,u,[{window:'ksick',dur:6}],c); for(const x of foes(A,T,u)){ tp(A,T,u,c,x,pd,4,'king','magic'); A.ustPut(T,u,x,'rot',5); } },
    /* a talent poison: {fn:'tpois', on, amt (an amount, or 'breath': Toxic Breath's poison a second), dur, tag, kind, refresh, mul} */
    tpois(A,T,u,c,a){ for(const t of A.pick(T,u,a.on,c)){ const amt=(a.amt==='breath'?breathPd(A,u):A.amtOf(T,u,a.amt,Object.assign({},c,{tgt:t})))*(a.mul||1); tp(A,T,u,c,t,amt,a.dur,a.tag,a.kind,a.refresh); } },
    /* ---- Command (By Royal Command): ready every 12 - 1 s per rank; the next enemy that hits him must attack him (the game's taunt) for 1.5 s (+ Raised Voice;
       the first of the wave + First Petition). Standing Order: while that Command lasts, the next enemies that hit him are Commanded too, 1 + its rank in all ---- */
    cmdWave(A,T,u,c){ T.s.cmdF=true; A.acts(T,u,[{window:'cmdO',end:true}],c); if(T.r.dc_6_1) A.acts(T,u,[{window:'cmdCd',end:true}],c); else A.acts(T,u,[{window:'cmdCd',dur:T.P['cmd.cd']||12}],c); },
    command(A,T,u,c){ const x=c.src, s=T.s; if(!x||!x.alive||x.team===u.team||A.markOf(u,x,'cmd')) return;
      if(!A.winOn(T,'cmdO')){ if(A.winOn(T,'cmdCd')) return; let d=1.5+(T.P['cmd.dur']||0); if(s.cmdF) d+=T.P['cmd.fp']||0; s.cmdF=false; s.cmdD=d; s.cmdN=0;
        A.acts(T,u,[{window:'cmdO',dur:d},{window:'cmdCd',dur:T.P['cmd.cd']||12}],c); }
      if((s.cmdN||0)>=1+(T.P['cmd.n']||0)) return; s.cmdN=(s.cmdN||0)+1;
      A.acts(T,u,[{mark:'cmd',on:'source',dur:s.cmdD},{taunt:s.cmdD,on:'source'}],c); A.run(T,u,'command',c); },
    /* Long Root: the root that landed lasts 0.15 s per rank longer, in full: Swampcall's own root already sits at today's 2.8 s ceiling, so the extra time is
       written straight on, cut only at the ceiling without the 30% cut (4.0 s) */
    longRoot(A,T,u,c){ const t=c.tgt, E=A.eng(), x=0.15*(T.r.dc_4_2||0); if(!t||!t.alive||!((t.stunned||0)>0)||!(x>0)) return; const top=(E.ccCap('stunned')||2.8)/(E.ccDur(1)||1);
      t.stunned=Math.max(t.stunned,Math.min(top,t.stunned+x)); },
    /* Sovereign Right: a Commanded enemy it roots is Commanded again for 1.5 s */
    recmd(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; A.acts(T,u,[{mark:'cmd',on:'target',dur:1.5,longest:true},{taunt:1.5,on:'target'}],c); A.run(T,u,'command',Object.assign({},c,{src:t})); },
    /* Sovereign Right: Swampcall opens under a Commanded enemy first (the other swamp under the farthest enemy that is not it) */
    sovRight(A,T,u,c){ const o=c.o; if(!o) return; const cm=A.pick(T,u,{team:'enemy',has:'cmd'},c)[0]; if(!cm) return; const n=Math.max(1,o.farthest||2), E=A.eng();
      const base=(o._farTgts||foes(A,T,u).slice().sort((a,b)=>E.dist(u,b)-E.dist(u,a)).slice(0,n)).filter(x=>x!==cm);
      o._farTgts=[cm].concat(base).slice(0,n); },
    /* The Marsh Keeps Him: Swampcall opens a third swamp under him (it works as the other two) */
    mySwamp(A,T,u,c){ const o=c.o; if(!o) return; const n=Math.max(1,o.farthest||2), E=A.eng();
      const base=o._farTgts||foes(A,T,u).slice().sort((a,b)=>E.dist(u,b)-E.dist(u,a)).slice(0,n); o._farTgts=base.concat([u]); },
    onSwamp(A,T,u){ return A.inZone(T,u,'msw'); },
    /* Into the Reeds: a pulled enemy is silenced 0.2 s per rank (added to a silence it still carries) */
    reeds(A,T,u,c){ const t=c.tgt, x=0.2*(T.r.dc_6_2||0), E=A.eng(); if(!t||!t.alive||!(x>0)) return;
      if((t.silencedT||0)>0){ const cap=E.ccCap('silencedT'); t.silencedT=Math.min(cap||Infinity,t.silencedT+x); } else A.control(T,u,t,'silencedT',x); },
    /* Sunk to the Neck: a Waterlogged enemy cannot be shielded (its shield breaks at once) and cannot be cleansed (what a cleanse took since the last
       tick is put back: its controls, its Mortal Wound and the DoTs it carried) */
    sunk(A,T,u,c){ const s=T.s.sk||(T.s.sk={}), dt=c.dt||0, F=['stunned','fearT','silencedT','slow','mortalT','_sleepT'];
      for(const x of A.eng().units()){ if(x.team===u.team) continue; const k=s[x.uid];
        if(!x.alive||!A.markOf(u,x,'wl')){ if(k) delete s[x.uid]; continue; }
        if((x.shield||0)>0) x.shield=0;
        if(k){ for(const f of F) if(k[f]>dt*1.5+1e-9&&!((x[f]||0)>0)){ x[f]=k[f]-dt; if(f==='slow'&&k.sm!=null) x.slowMul=Math.min(x.slowMul==null?1:x.slowMul,k.sm); }
          if(x.dots) for(const d of k.dots) if(d.remaining>=2&&x.dots.indexOf(d)<0) x.dots.push(d); }
        const o={dots:x.dots?x.dots.slice():[],sm:x.slowMul}; for(const f of F) o[f]=x[f]||0; s[x.uid]=o; } },
    /* the Court: wave by wave */
    courtWave(A,T,u){ for(const x of A.eng().units()) if(x.team!==u.team){ A.clearMark(u,x,'court'); A.clearMark(u,x,'crt'); } T.s.ml.court=[]; },
    /* the Court is full: at least 2 members alive, and its size (6 + Courtiers) reached or every enemy on the field a member */
    full(A,T,u){ const n=members(A,T,u).length; if(n<2) return false; return n>=6+(T.P['court.max']||0)||n>=foes(A,T,u).length; },
    /* Long Live the King: every member rooted 1.5 s, silenced 2 s, Commanded onto him 3 s and Waterlogged 6 s (the window 'llk': 40% less for 3 s) */
    holdCourt(A,T,u,c){ for(const x of members(A,T,u)){ A.control(T,u,x,'stunned',1.5); A.control(T,u,x,'silencedT',2);
        A.setMark(T,u,x,'cmd',{dur:3,longest:true}); x.forcedTarget=u; x.forcedTargetT=Math.max(x.forcedTargetT||0,3); A.setMark(T,u,x,'wl',{dur:6,longest:true}); } },
    /* shorter controls on him: Stubborn as Groll every control (up to 20%); Throne Room Air and Toad Throat silences; all his talents together never make a
       silence more than 50% shorter */
    ten(A,T,u,c){ let k=1-Math.min(0.20,T.P['ten.all']||0); if(c.field==='silencedT') k=Math.max(0.50,k*(1-(T.P['ten.sil']||0))*(1-(T.P['ten.sil2']||0))); c.amt*=k; },
    /* ---- Marshwater: drunk (every drop, or a.n of it) for 0.1% of his max HP per drop per rank of Marshwater (at least rank 1), x a.mul. Spit the Brine:
       never drunk (only Sovereign Body and the signature, a.force); Sip Slowly: not all at once (its own row). 'drank' (ctx.spent = drops) ---- */
    drink(A,T,u,c,a){ if(!a.force&&(T.r.km_5_3||(a.all&&T.r.km_5_2))) return; const have=A.stGet(T,'marsh'), n=a.n?Math.min(a.n,have):have; if(!(n>0)) return;
      A.stSet(T,u,'marsh',have-n); A.acts(T,u,[{heal:{pct:0.001*Math.max(1,T.r.km_2_2||0)*(a.mul||1)*n,of:'maxHp'}}],c); A.run(T,u,'drank',Object.assign({},c,{spent:n})); },
    /* Belch: at 10 Bloat, this Toxic Breath spends all Bloat and also poisons every enemy within 3 m of him (Toxic Breath's own poison, 4 s; Burst Seams stronger) */
    belch(A,T,u,c){ if(A.stGet(T,'bloat')<10) return; const n=A.stGet(T,'bloat'); A.stSet(T,u,'bloat',0); const pd=breathPd(A,u)*(1+(T.P['belch.more']||0));
      for(const x of A.pick(T,u,{team:'enemy',within:3},c)) tp(A,T,u,c,x,pd,4,'belch','magic'); A.run(T,u,'belched',Object.assign({},c,{spent:n})); },
    /* Spit the Brine: a Toxic Breath that can spend 10 Marshwater does (20% more damage, its poison too); Bitter Brine: its first enemy hit */
    brine(A,T,u){ T.s.brine=0; T.s.brineHit=0; if(A.stGet(T,'marsh')>=10){ A.stSet(T,u,'marsh',A.stGet(T,'marsh')-10); T.s.brine=1; } },
    brineOn(A,T){ return !!T.s.brine; },
    brineOff(A,T){ T.s.brine=0; },
    brineFirst(A,T){ if(!T.s.brine||T.s.brineHit) return false; T.s.brineHit=1; return true; },
    /* Throne Not Abandoned: once per wave, as he drops below 30% HP with 8 Reign, he cannot drop below 1 HP for 2 s */
    tna(A,T,u){ const s=T.s; if(s.tnaW===s.wave||s.undy>0) return; s.tnaW=s.wave; s.undy=Math.max(s.undy,2); if(u.hp<1) u.hp=1; },
    /* He Would Not Leave the Throne: every drop of Marshwater at double healing, 10 Bloat, and 5 s of poison around him (the window 'kthr') */
    throne(A,T,u,c){ T.fn.drink(A,T,u,c,{all:true,force:true,mul:2}); A.stSet(T,u,'bloat',10); A.acts(T,u,[{window:'kthr',dur:5}],c);
      T.fn.tpois(A,T,u,c,{on:{team:'enemy',within:4},amt:'breath',dur:1,tag:'throne',kind:'magic'}); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/16 - BLOATUS - talent decisions.md) */
  ruling:{}
};
