/* OAKMIR - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Oakmir")
   His real kit (the code, not the card wording; a back-row Support, ranged 25.6 m, damage profile Healer: his basic attacks are MAGIC; his skills deal no damage):
   - Mending Bloom ('hot', green, cd 7): a heal over time on the engine's lowestAlly (the lowest HP SHARE, himself included): 6% of that ally's max HP x skill
     level each second for 6 s (pushHot, no caster: his rows make it his with tagHots 'mb'). Healing power does not reach it (pushHot is not healFrom).
     MEASURED (tests/oakmir-kit-facts.js, 20 seeded fights): the ally stood at 88% HP (median); 64% of what its ticks offered was overheal.
   - Rally Roots ('heal', blue, cd 10): every ally of his side, any distance, himself and summons included, is healed 22% of its max HP x skill level through
     healFrom (his healing power applies; his rows see it as healOut / healed, skill 'heal'). 93% of it was overheal.
   - Deep Roots (passive 'deeproots'): an ally of his side (himself included) that drops below 30% HP is healed 25% of its max HP x his passive's strength over
     4 s, once per ally per fight (o._drUsed, o._drBy, o._drLeft, o._drRate; written straight onto HP, no healUnit). The "roots" are art: nobody is held.
   - First Spring (ultimate 'firstspring', on energy - no cooldown; delivered as a form 0.35 s after the cast): centred on the ally the player aims at (auto:
     the lowest HP share), every ally within 20 m (centre to centre) is healed 50% of its max HP x skill level through healFrom, then a regrowth: a heal over
     time of 4% of its max HP x skill level a second for 5 s (pushHot: his rows make it his, 'fs').
   NOTE: the game's battleTime starts again at 0 each wave, so every lock and timer of his talents is a COUNTDOWN in T.s.ok (tk), never an absolute time, and
   the marks he keeps on units (Thorns, Acorns, Heartrot, roots, Shade lingering) are cleared at each wave's start (wv). Graft is for the fight.
   ROOTS: the game has no root status (its own roots write the stun field). His talent roots are REAL roots: the enemy cannot move but can still attack and
   cast (an aura move -100%, as Vael's "stopped" enemies), each at its full written length, never longer than 4.0 s, a new root never shortening a longer one.
   Sap, Shade, Graft, Thorns, Acorns, Heartrot, the Seasons, Nests and Second Growth exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/44 - OAKMIR - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const MB='hot', RR='heal', FS='firstspring';
const ME_CAP=0.60, ALLY_CAP=0.75, REGEN=0.012, ROOT_TOP=4.0;       // his damage-reduction group: at most 40% off a hit on him; what he gives an ally: at most 25%; 1.2% of max HP a second
/* the families: each state's bookkeeping runs when any of the talents that read it is learned */
const SAP=['hw_1_1','hw_2_1','hw_n1','hw_3_1','hw_3_3','hw_4_1','hw_7_2','hw_8_1','hw_9_1','hw_10_1','hw_11_1','hw_11_2','hw_12_3','hw_13_2'];
const SHADE=['hw_2_2','hw_4_2','hw_5_2','hw_5_3','hw_6_2','hw_6_3','hw_7_1','hw_7_2','hw_9_2','hw_9_3','hw_10_1','hw_13_2'];
const GRAFT=['hw_4_4','hw_5_4','hw_7_4','hw_10_4','hw_11_2','hw_11_4','hw_12_1','hw_12_3','hw_13_2'];
const THORN=['tw_1_2','tw_2_2','tw_3_1','tw_6_2','tw_7_3','tw_5_1','tw_5_3','tw_9_3','tw_6_3','tw_11_3','tw_11_4','tw_12_3','tw_12_4'];
const ACORN=['tw_2_3','tw_3_1','tw_4_3','tw_8_1','tw_9_1','tw_6_4','tw_5_1','tw_5_3','tw_10_4','tw_6_1','tw_6_3','tw_11_3','tw_12_4','tw_13_3'];
const ROT=['tw_4_4','tw_8_4','tw_5_4','tw_8_2','tw_12_2','tw_13_3'];
const ROOTS=['tw_2_3','tw_3_2','tw_10_3','ty_10_1','tw_13_3','tw_1_1','tw_3_1','tw_10_2','tw_11_1','tw_11_4'].concat(ACORN);
const SEASON=['ty_1_4','ty_2_4','ty_4_4','ty_3_4','ty_5_2','ty_5_3','ty_5_4','ty_6_2','ty_6_3','ty_6_4','ty_7_3','ty_9_3','ty_8_4','ty_9_4','ty_10_4','ty_11_1','ty_11_3','ty_12_2','ty_12_3','ty_12_4','ty_13_3'];
const NEST=['ty_2_3','ty_4_3','ty_8_2','ty_9_2','ty_10_2','ty_13_3'];
const SG_RIDE=['ty_5_1','ty_6_1','ty_7_1','ty_8_1','ty_10_1','ty_12_1'];
const TEAM_IN=SHADE.concat(THORN,ACORN,ROT,['hw_n1','hw_5_1','hw_7_4','hw_10_4','tw_10_2','ty_1_4','ty_5_2','ty_5_3','ty_13_3','tw_13_3']);
const ME_IN=['hw_1_4','hw_3_3','hw_11_1','hw_12_1','tw_1_1','tw_8_2','tw_9_4','ty_5_4','ty_11_4','tw_6_4'].concat(TEAM_IN);
const HEAL_IN=['hw_9_3','hw_4_4','tw_4_4'].concat(SHADE);              // healing received: Canopy Song, Graft's share, Heartrot's cut
const any=(T,L)=>{ const c=T.s.anyC||(T.s.anyC=new Map()); let v=c.get(L); if(v===undefined){ v=L.some(id=>T.r[id]); c.set(L,v); } return v; };
const rk=(T,id)=>T.r[id]||0;
const frac=x=>x.maxHp>0?x.hp/x.maxHp:1;
/* his own per-fight object (made at his first look: a hit or a heal can come before his first tick) */
const O=T=>T.s.ok||(T.s.ok={sap:0,sea:any(T,SEASON)?{i:0,t:seaDur(T,0),turns:0}:null,allS:0,ne:null,gr:{},drSeen:{},dr2:{},dr2On:false,sg:{used:false,re:0,wait:-1,regrown:false},
  th:{},ac:{},hr:{},rt:{},ln:{},sh:{},fgW:{},eg:{},lk:{},wr:{},bbL:{},rtW:0,grove:0,wood:0,h1:0,zz:{},q:[],f:{},eq:-1,tb:-1,fsSet:null,rrSet:null,mbT:null,fsC:null,fsGrove:false,rrSpring:false,gIn:0});
const mate=(u,x)=>!!x&&x.team===u.team, foe=(u,x)=>!!x&&x.team!==u.team;
const team=(A,T,u)=>A.pick(T,u,{team:'ally'},{u});                       // his side's heroes, himself too
const allies=(A,T,u)=>A.pick(T,u,{team:'ally',others:true},{u});         // his allies (heroes, not himself)
const foes=(A,T,u)=>A.pick(T,u,{team:'enemy'},{u});
const gapM=(A,a,b)=>A.gap(a,b)/A.eng().METER();                          // metres body to body
/* ---- Sap ---- */
const sapMax=(T,u)=>(u.maxHp||0)*(0.10+0.01*rk(T,'hw_1_1')+0.02*rk(T,'hw_2_1'));
const sapFull=(T,u)=>{ const m=sapMax(T,u); return m>0&&O(T).sap>=m-1e-6; };
/* ---- the Seasons: 0 Spring, 1 Summer, 2 Autumn, 3 Winter ---- */
const seaOn=(T,i)=>{ const o=O(T); if(!o||!o.sea) return false; return o.allS>0||o.sea.i===i; };
const decid=T=>rk(T,'ty_5_2')>0, everg=T=>rk(T,'ty_5_3')>0;
const springK=T=>seaOn(T,0)?0.01*rk(T,'ty_1_4')*(1+0.01*rk(T,'ty_8_4'))*(everg(T)?1.5:1):0;   // his heals stronger
const summerK=T=>seaOn(T,1)?0.01*rk(T,'ty_1_4')*(everg(T)?1.5:1):0;                          // his team deals more
const autumnK=T=>seaOn(T,2)?0.01*rk(T,'ty_1_4')*(decid(T)?1.5:1):0;                          // enemies take more
const winterK=T=>seaOn(T,3)?0.01*rk(T,'ty_1_4')*(decid(T)?1.5:1):0;                          // his team takes less
function seaDur(T,i){ let d=6+0.5*rk(T,'ty_2_4'); if(decid(T)&&(i===2||i===3)) d*=2; return d; }
/* ---- units he keeps state on (maps by uid, all countdowns) ---- */
const rooted=(T,x)=>!!x&&(O(T).rt[x.uid]||0)>0;
const slowed=x=>!!x&&(x.slow||0)>0;
const acorns=(T,x)=>{ const a=x&&O(T).ac[x.uid]; return a&&a.t>0?a.n:0; };
const rotN=(T,x)=>{ const h=x&&O(T).hr[x.uid]; return h&&h.t>0?h.n:0; };
const grafted=(T,x)=>!!x&&!!O(T).gr[x.uid];
const underMB=(u,x)=>{ const H=x&&x.hots; if(!H) return false; for(let i=0;i<H.length;i++){ const h=H[i]; if(h._talU===u&&h._talK==='mb'&&h.remaining>0) return true; } return false; };
const thorned=(T,u,x)=>{ if(!x||!any(T,THORN)) return false; const t=O(T).th[x.uid]; return underMB(u,x)||!!(t&&(t.mb>0||t.ra>0||t.sp>0)); };
const inShade=(T,x)=>!!x&&!!O(T).sh[x.uid];                                                   // standing in it now
const shaded=(T,x)=>!!x&&(!!O(T).sh[x.uid]||(O(T).ln[x.uid]||0)>0);                          // standing in it, or keeping its protection (Forest Floor)
function shadeR(T){ const d=rk(T,'hw_5_2')>0, w=rk(T,'hw_5_3')>0; return (d?2:3)+0.5*rk(T,'hw_4_2')+(w?2:0); }
const shadeDr=T=>0.01*rk(T,'hw_2_2')*(rk(T,'hw_5_2')?2:1)*(O(T).grove>0?3:1);
module.exports={
  hero:'oakmir',
  casting:true,                         // rows ask which of his skills a heal comes from
  /* his Second Growth's riders do nothing without it */
  needs:{ty_5_1:'ty_4_1',ty_6_1:'ty_4_1',ty_7_1:'ty_4_1',ty_8_1:'ty_4_1',ty_10_1:'ty_4_1',ty_12_1:'ty_4_1'},
  states:{},
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},
    {on:'wave',do:[{fn:'wv'}]},
    {on:'kit',skill:MB,do:[{tagHots:'kit'},{fn:'mbKit'}]}, {on:'cast',skill:MB,do:[{tagHots:'mb'},{fn:'mbCast'}]},     // Mending Bloom: its heal over time is his
    {on:'kit',skill:RR,do:[{fn:'rrKit'}]}, {on:'cast',skill:RR,do:[{fn:'rrCast'}]},                                   // Rally Roots
    {on:'kit',skill:FS,do:[{tagHots:'kit'},{fn:'fsKit'}]}, {on:'cast',skill:FS,do:[{tagHots:'fs'},{fn:'fsCast'}]},   // First Spring: its regrowth is his
    {on:'healOut',do:[{fn:'hOut'}]},                                                                                   // his heals made stronger (skill heals and their ticks)
    {on:'healed',do:[{fn:'hLand'}]},                                                                                   //   and what did not fit: Sap, Ever Green
    {on:['teamHeal','healMe'],reqAny:HEAL_IN,do:[{fn:'hIn'}]},                                                         // healing received
    {on:'teamIn',reqAny:TEAM_IN,do:[{fn:'tIn'}]},                                                                      // hits on his allies and on enemies
    {on:'in',reqAny:ME_IN,do:[{fn:'myIn'}]},                                                                           // hits on him
    {on:'out',reqAny:['tw_1_4','ty_4_4','tw_6_1','tw_11_1','tw_7_1'],do:[{fn:'myOut'}]},                               // his hits
    {on:'hit',reqAny:ACORN,if:{auto:true,targetTeam:'enemy'},do:[{fn:'plant'}]},                                       // his basic attacks plant Acorns
    {on:'teamCc',reqAny:NEST,do:[{fn:'nest'}]},                                                                        // a control landed on an ally: a songbird
    {on:'die',reqAny:['ty_4_1'],do:[{fn:'die'}]}, {on:'fallenTick',reqAny:['ty_4_1'],do:[{fn:'fallen'}]},             // Second Growth
    {stat:{move:-1},reqAny:ROOTS,to:{team:'enemy',fn:'isRooted'}}                                                      // his roots: cannot move (can still attack and cast)
  ],
  talents:{
    /* ============================== HEARTWOOD ============================== */
    hw_1_1:[ {param:'sap',add:1} ],                                                                  // Rising Sap (sapMax: 10% + 1% per rank; the pour: tk / pour)
    hw_2_3:[ {param:'mb.more',add:R(0.03)} ],                                                        // Broad Leaves
    hw_1_4:[ {param:'dr.tb',add:R(0.15)} ],                                                          // Thick Bark (meF; inside the 40% group)
    hw_2_1:[ {param:'sap',add:1} ],                                                                  // Deep Sap (sapMax)
    hw_2_2:[ {param:'shade',add:1} ],                                                                // Under the Boughs (Shade: tk; its cut: teamF)
    hw_n1:[  {param:'fg',add:1} ],                                                                   // First Green (LINK; pour)
    hw_3_1:[ {param:'sapBloom',add:1} ],                                                             // Sap Bloom (mbCast)
    hw_3_3:[ {param:'dr.rt',add:R(0.02)} ],                                                          // Ringed Trunk (meF)
    hw_3_4:[ {param:'rr.more',add:R(0.02)} ],                                                        // Steady Boughs
    hw_4_1:[ {param:'pour.more',add:R(0.03)} ],                                                      // Sweet Sap
    hw_4_2:[ {param:'shade.m',add:R(0.5)} ],                                                         // Spreading Crown (shadeR)
    hw_4_4:[ {param:'graft.share',add:R(0.04)} ],                                                    // Grafted Root (Graft: drScan; the share: hIn)
    hw_5_1:[ {param:'dr.lm',add:R(0.01)} ],                                                          // Leaf Mulch (teamF)
    hw_5_2:[ {param:'dense',add:1} ],                                                                // Dense Canopy (PICK ONE; shadeR / shadeDr)
    hw_5_3:[ {param:'wide',add:1} ],                                                                 // Wide Canopy (PICK ONE; shadeR; its healing: tk)
    hw_5_4:[ {stat:{hp:R(0.01)},to:{team:'ally',fn:'isGrafted'}} ],                                  // Shared Rings: Grafted allies have 1% more max HP per rank
    hw_6_1:[ {param:'mb.dur',add:R(0.3)} ],                                                          // Slow Mending (mbCast: a part tick at the end)
    hw_6_2:[ {param:'dr.ds',add:R(0.03)} ],                                                          // Deep Shadow (teamF)
    hw_6_3:[ {param:'wide.k',add:R(0.0015)} ],                                                       // Dappled Light (tk)
    hw_7_1:[ {param:'shade.ln',add:R(0.4)} ],                                                        // Forest Floor (tk)
    hw_7_2:[ {param:'grove',add:1} ],                                                                // Grove Rally (hLand / hOut)
    hw_7_4:[ {param:'dr.kc',add:R(0.01)} ],                                                          // Kept Close (teamF)
    hw_8_1:[ {param:'sap.res',add:R(0.02)} ],                                                        // Sap Reserve (wv)
    hw_8_3:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                  // Green Patience
    hw_8_4:[ {param:'dr.heal',add:R(0.05)} ],                                                        // Root Memory (drScan)
    hw_9_1:[ {param:'brim',add:0.15} ],                                                              // Brimming (healK)
    hw_9_2:[ {param:'rr.shade',add:R(0.02)} ],                                                       // Roots Run Deep (hOut)
    hw_9_3:[ {param:'shade.heal',add:R(0.01)} ],                                                     // Canopy Song (hIn)
    hw_10_1:[ {param:'sap.spring',add:R(0.01)} ],                                                    // Sap Spring (pour)
    hw_10_4:[ {param:'bb',add:R(0.02)} ],                                                            // Bound Bark (tIn; once every 5 s per ally, a countdown)
    hw_11_1:[ {param:'dr.sw',add:R(0.015)} ],                                                        // Still Wood (meF)
    hw_11_2:[ {param:'fs.sap',add:1} ],                                                              // Spring Sap (fsCast)
    hw_11_4:[ {param:'graft.more',add:R(0.015)} ],                                                   // Shared Heartwood (healK)
    hw_12_1:[ {param:'dr.hl',add:R(0.01)} ],                                                         // Heavy Limbs (meF; up to 4 Grafted allies)
    hw_12_2:[ {param:'fs.more',add:R(0.03)} ],                                                       // Lingering Spring (hOut)
    hw_12_3:[ {param:'eg',add:R(0.02)} ],                                                            // Ever Green (hLand)
    hw_12_4:[ {param:'dr.slow',add:R(0.5)} ],                                                        // Slow Heart (drScan)
    hw_13_2:[ {param:'sig.grove',add:1} ],                                                           // The Grove Stands (SIGNATURE; fsKit)

    /* ============================== THE THORNED WOOD ============================== */
    tw_1_1:[ {param:'dr.hr',add:R(0.02)} ],                                                          // Hard Rind (meF)
    tw_1_2:[ {param:'thorn',add:R(0.08)} ],                                                          // Briar Skin (bite)
    tw_1_4:[ {param:'auto.more',add:R(0.04)} ],                                                      // Heavy Spear (myOut)
    tw_2_2:[ {param:'thorn.ln',add:R(1)} ],                                                          // Long Thorns (tk)
    tw_2_3:[ {param:'acorn',add:R(0.15)} ],                                                          // Acorn Shot (plant / sprout)
    tw_3_1:[ {param:'oak',add:R(0.02)} ],                                                            // Oak Strength (bite / sprout)
    tw_3_2:[ {param:'briar',add:0.8} ],                                                              // Briar Bloom (mbCast)
    tw_4_3:[ {param:'acorn.root',add:R(0.2)} ],                                                      // Deep Planting (sprout)
    tw_2_4:[ {on:'wave',once:'fight',do:[{fn:'reach'}]} ],                                           // Woodsman's Reach: his attack range 3% longer per rank
    tw_4_1:[ {param:'rr.more',add:R(0.03)} ],                                                        // Rough Rally
    tw_8_1:[ {param:'acorn.dur',add:R(1)} ],                                                         // Seed Store (plant)
    tw_4_4:[ {param:'rot.heal',add:R(0.01)} ],                                                       // Rotting Grip (Heartrot: rot; the cut: hIn)
    tw_8_4:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',fn:'rot5'}} ],                                   // Choking Rot: enemies with 5 Heartrot attack 3% slower per rank
    tw_5_2:[ {param:'grasp',add:R(0.04)} ],                                                          // Grasping Ground (drScan)
    tw_9_1:[ {param:'scatter',add:1} ],                                                              // Scattered Seed (sprout)
    tw_5_4:[ {stat:{armor:R(-0.01)},to:{team:'enemy',fn:'hasRot'},per:{fn:'rotCnt'}} ],             // Rot to the Core: 1% less armor per rank per Heartrot
    tw_7_1:[ {param:'magic.more',add:R(0.02)} ],                                                     // Angry Sap (myOut, and his talent damage: tdmg)
    tw_6_2:[ {param:'thorn.more',add:R(0.03)} ],                                                     // Sharp Bark (bite)
    tw_6_4:[ {param:'risk',add:R(0.03)}, {param:'acorn.more',add:R(0.08)} ],                         // Hollow Trunk (RISK)
    tw_8_2:[ {param:'dr.wh',add:R(0.01)} ],                                                          // Wooden Heart (meF)
    tw_7_3:[ {param:'rr.thorn',add:3} ],                                                             // Rally the Briars (rrCast)
    tw_5_1:[ {param:'spear',add:1} ],                                                                // Spearwood (PICK ONE; plant / bite)
    tw_5_3:[ {param:'bramble',add:1} ],                                                              // Bramblewood (PICK ONE; bite)
    tw_9_3:[ {param:'rr.thorn',add:R(0.4)} ],                                                        // Thorned Rally
    tw_10_4:[ {param:'acorn.nrg',add:R(1)} ],                                                        // Sprouting Energy (sprout)
    tw_6_1:[ {param:'split',add:R(0.04)} ],                                                          // Split Shaft (myOut, with Spearwood)
    tw_6_3:[ {param:'hedge',add:R(0.05)} ],                                                          // Barbed Hedge (bite, with Bramblewood)
    tw_9_4:[ {param:'dr.ub',add:R(0.01)} ],                                                          // Unbending (meF)
    tw_10_2:[ {param:'snarl',add:R(0.02)} ],                                                         // Snarl (tIn, tdmg)
    tw_10_3:[ {param:'rgrip',add:R(0.4)} ],                                                          // Root Grip (drScan)
    tw_11_1:[ {param:'fury',add:R(0.03)} ],                                                          // Slow Fury (myOut)
    tw_11_3:[ {param:'fs.thorn',add:5} ],                                                            // Spring of Thorns (fsCast)
    tw_11_4:[ {param:'dr.ww',add:R(0.015)} ],                                                        // Woodland Ward (teamF)
    tw_12_2:[ {param:'rot.dur',add:R(0.4)} ],                                                        // Rotwood (rot)
    tw_12_3:[ {param:'bitter',add:R(0.04)} ],                                                        // Bitter Spring (bite)
    tw_12_4:[ {param:'barkbound',add:R(0.15)} ],                                                     // Barkbound (bite)
    tw_13_3:[ {param:'sig.wood',add:1} ],                                                            // The Wood Remembers (SIGNATURE; fsCast / wood)

    /* ============================== THE TURNING YEAR ============================== */
    ty_1_1:[ {on:'ccIn',less:R(0.05)} ],                                                             // Frost-Hard: controls on him 5% shorter per rank (at most 15%)
    ty_2_2:[ {param:'rr.more',add:R(0.03)} ],                                                        // Spring Rain
    ty_1_4:[ {param:'sea',add:1} ],                                                                  // Turn of Seasons (the Seasons: tk / turn; their numbers: springK ..)
    ty_2_3:[ {param:'nest',add:R(0.10)} ],                                                           // Songbird Nests (nest)
    ty_2_4:[ {param:'sea.dur',add:R(0.5)} ],                                                         // Long Summer (seaDur)
    ty_3_1:[ {param:'mb.more',add:R(0.02)} ],                                                        // Leafing
    ty_4_4:[ {param:'harvest',add:R(0.04)} ],                                                        // Harvest Swing (myOut)
    ty_4_3:[ {param:'nest.n',add:R(1)} ],                                                            // Wider Branches (tk)
    ty_3_4:[ {param:'early',add:1} ],                                                                // Early Turn (mbCast)
    ty_4_1:[ {param:'sg',add:1} ],                                                                   // A Little to the Left (Second Growth: die / fallen)
    ty_5_2:[ {param:'decid',add:1} ],                                                                // Deciduous (PICK ONE; seaDur / autumnK / winterK)
    ty_5_3:[ {param:'everg',add:1} ],                                                                // Evergreen (PICK ONE; turn / springK / summerK)
    ty_5_4:[ {param:'dr.wint',add:R(0.02)} ],                                                        // Winter Hardiness (meF)
    ty_5_1:[ {param:'sg.hp',add:R(0.03)} ],                                                          // Stubborn Growth (regrow)
    ty_6_2:[ {param:'leaves',add:R(0.03)} ],                                                         // Falling Leaves (tk, with Deciduous)
    ty_6_3:[ {param:'mb.green',add:R(0.04)} ],                                                       // Green All Year (hOut, with Evergreen)
    ty_6_1:[ {param:'sg.team',add:R(0.05)} ],                                                        // Rooted Again (regrow)
    ty_7_1:[ {stat:{heal:R(0.02)},if:{fn:'regrown'}} ],                                              // Second Life: 2% more healing power per rank after he regrew
    ty_6_4:[ {param:'hib',add:R(0.004)} ],                                                           // Hibernate (tk; the regeneration cap)
    ty_8_2:[ {param:'bird.heal',add:R(0.01)} ],                                                      // Birdsong (nest)
    ty_7_3:[ {param:'rr.year',add:1} ],                                                              // Rally of the Year (hOut / rrCast)
    ty_8_1:[ {param:'sg.seed',add:R(0.01)} ],                                                        // Fallen Seed (fallen; the regeneration cap)
    ty_9_3:[ {param:'rr.show',add:R(0.03)} ],                                                        // Spring Showers (hOut)
    ty_8_4:[ {param:'sea.spring',add:R(0.01)} ],                                                     // Early Spring (springK)
    ty_9_2:[ {param:'bird.nrg',add:R(1)} ],                                                          // Dawn Chorus (nest)
    ty_9_4:[ {param:'equinox',add:1} ],                                                              // Equinox (tk: once per wave)
    ty_10_1:[ {param:'sg.root',add:R(0.4)} ],                                                        // Waking Roots (regrow)
    ty_10_2:[ {param:'nest.re',add:R(0.8)} ],                                                        // Homing Birds (nest)
    ty_10_4:[ {stat:{heal:R(0.01)},per:{fn:'turns'}} ],                                              // Long Year: 1% healing power per rank for each full turn (up to 5)
    ty_11_1:[ {stat:{armor:R(0.01),mr:R(0.01)},to:{team:'ally'},if:{fn:'winter'}} ],                 // Deep Heartwood: in Winter every ally has 1% more armor and magic resist per rank
    ty_11_3:[ {param:'thaw',add:1} ],                                                                // First Thaw (fsCast)
    ty_11_4:[ {param:'dr.wea',add:R(0.01)} ],                                                        // Weathered (meF)
    ty_12_1:[ {param:'sg.quick',add:R(0.5)} ],                                                       // Quick to Root (die)
    ty_12_2:[ {param:'road',add:R(0.015)} ],                                                         // Old as the Road (turn)
    ty_12_3:[ {param:'fs.spring',add:R(0.03)} ],                                                     // Spring Eternal (hOut)
    ty_12_4:[ {param:'ring',add:R(1)} ],                                                             // Ring Count (turn)
    ty_13_3:[ {param:'sig.year',add:1} ]                                                             // The Spring That Woke (SIGNATURE; fsCast)
  },
  fn:{
    /* ---------------- the wave's start: his per-fight object; everything kept on units is cleared (the wave clock starts again at 0) ---------------- */
    wv(A,T,u){ const r=T.r, P=T.P, o=O(T); T.s.api=A;                                       // the runtime API kept for the 95% probe and the tests (never on a snap)
      o.th={}; o.ac={}; o.hr={}; o.rt={}; o.ln={}; o.sh={}; o.fgW={}; o.eg={}; o.wr={}; o.q=[]; o.f={}; o.zz={};
      if(any(T,NEST)&&!o.ne){ const n=3+rk(T,'ty_4_3'); o.ne=[]; for(let i=0;i<n;i++) o.ne.push(0); }
      if(P['sap.res']) o.sap=Math.max(o.sap,Math.min(sapMax(T,u),P['sap.res']*(u.maxHp||0))); },   // Sap Reserve: at least that much at each wave's start
    /* Woodsman's Reach: his attack range 3% longer per rank (once, at the fight's first wave) */
    reach(A,T,u){ u.range=(u.range||0)*(1+0.03*rk(T,'tw_2_4')); },
    /* ---------------- each tick ---------------- */
    tk(A,T,u,c){ const E=A.eng(), o=O(T), P=T.P, r=T.r, dt=c.dt||0, M=E.METER(); if(!o) return;
      const dec=(m)=>{ for(const k in m){ const v=m[k]-dt; if(v<=1e-9) delete m[k]; else m[k]=v; } };
      dec(o.rt); dec(o.ln); dec(o.fgW); dec(o.lk); dec(o.wr); dec(o.bbL);
      for(const k in o.ac){ const a=o.ac[k]; a.t-=dt; if(a.t<=1e-9) delete o.ac[k]; }
      for(const k in o.hr){ const h=o.hr[k]; h.t-=dt; if(h.t<=1e-9) delete o.hr[k]; }
      for(const k in o.eg){ const g=o.eg[k]; g.t-=dt; if(g.t<=1e-9) delete o.eg[k]; }
      if(o.rtW>0) o.rtW=Math.max(0,o.rtW-dt); if(o.wood>0) o.wood=Math.max(0,o.wood-dt);
      if(o.grove>0) o.grove=Math.max(0,o.grove-dt);
      const tm=team(A,T,u);
      /* Shade: his allies within its reach of him (body to body); during The Grove Stands his whole team, himself too. Forest Floor: kept a while after leaving */
      if(any(T,SHADE)){ const R=shadeR(T), was=o.sh; o.sh={};
        for(const x of tm){ const inn=o.grove>0||(x!==u&&gapM(A,u,x)<R); if(inn) o.sh[x.uid]=1; else if(was[x.uid]&&P['shade.ln']) o.ln[x.uid]=P['shade.ln']; } }
      /* Thorns on each ally: kept 1 s per rank of Long Thorns after its Mending Bloom ends; Rally the Briars' and Spring of Thorns' own times */
      if(any(T,THORN)) for(const x of tm){ const t=o.th[x.uid]||(o.th[x.uid]={mb:0,ra:0,sp:0}); if(underMB(u,x)) t.mb=P['thorn.ln']||0; else t.mb=Math.max(0,t.mb-dt); t.ra=Math.max(0,t.ra-dt); t.sp=Math.max(0,t.sp-dt); }
      /* thresholds: Sap pours when an ally drops below 50%; Equinox below 30% (once per wave) */
      for(const x of tm){ const f=frac(x), p=o.f[x.uid]; o.f[x.uid]=f; if(p==null) continue;
        if(p>=0.50&&f<0.50&&any(T,SAP)&&o.sap>0) T.fn.pour(A,T,u,x);
        if(r.ty_9_4&&p>=0.30&&f<0.30&&o.eq!==T.s.wave&&o.sea){ o.eq=T.s.wave; T.fn.toSpring(A,T,u,3); } }
      /* Bound Bark's heals, queued by the hits (after the hit has landed) */
      if(o.q.length){ const q=o.q; o.q=[]; for(const e of q) if(e.x.alive) E.healUnit(e.x,e.x.maxHp*P.bb); }
      /* Deep Roots' catches */
      T.fn.drScan(A,T,u,c);
      /* the Seasons */
      if(o.sea){ if(o.allS>0) o.allS=Math.max(0,o.allS-dt); else { o.sea.t-=dt; if(o.sea.t<=1e-9) T.fn.turn(A,T,u); } }
      /* Falling Leaves: with Deciduous, every enemy is slowed during Autumn (the engine's own slow, strongest wins) */
      if(P.leaves&&decid(T)&&seaOn(T,2)) for(const e of foes(A,T,u)){ e.slow=Math.max(e.slow||0,0.2); e.slowMul=Math.min(e.slowMul==null?1:e.slowMul,1-P.leaves); }
      /* Nests refilling; a sleep its songbird cut is cut too when the sleep's own clock was written after the stun */
      for(const k in o.zz){ const x=o.zz[k]; if((x._sleepT||0)>(x.stunned||0)) x._sleepT=x.stunned||0; delete o.zz[k]; }
      if(o.ne){ for(let i=0;i<o.ne.length;i++) if(o.ne[i]>0) o.ne[i]=Math.max(0,o.ne[i]-dt); }
      /* his per-second talent heals (Wide Canopy's Shade, Hibernate): once a second, together never above 1.2% of max HP a second on one unit */
      if(r.hw_5_3||P.hib){ o.h1+=dt; if(o.h1>=1-1e-9){ o.h1-=1;
          for(const x of tm){ let k=0; if(r.hw_5_3&&inShade(T,x)) k+=0.005+(P['wide.k']||0); if(x===u&&P.hib&&seaOn(T,3)) k+=P.hib; if(k>0) E.healUnit(x,x.maxHp*Math.min(REGEN,k)); } } } },
    /* ---------------- Sap ---------------- */
    addSap(A,T,u,x){ const o=O(T), m=sapMax(T,u); if(!(x>0)) return 0; const room=Math.max(0,m-o.sap), put=Math.min(room,x); o.sap+=put; return x-put; },   // returns what did not fit
    pour(A,T,u,x){ const E=A.eng(), o=O(T), P=T.P, r=T.r; const amt=o.sap; o.sap=0; if(!(amt>0)||!x||!x.alive) return;
      E.healUnit(x,amt*(1+(P['pour.more']||0)));
      if(r.hw_n1){ o.fgW[x.uid]=3; if(r.ty_1_4&&o.sea&&!(o.lk.fg>0)){ o.lk.fg=12; T.fn.toSpring(A,T,u,2); } }   // First Green: 4% less for 3 s; with Turn of Seasons: Spring at once, 2 s longer (once every 12 s)
      if(r.hw_3_3) o.rtW=4;                                                                                       // Ringed Trunk
      if(P['sap.spring']) for(const y of team(A,T,u)) if(y!==x&&y!==u&&inShade(T,y)) E.healUnit(y,y.maxHp*P['sap.spring']); },   // Sap Spring
    /* ---------------- his heals ---------------- */
    /* how much stronger a heal of his is on x (every bonus adds) */
    healK(A,T,u,x){ const P=T.P; let k=1+springK(T);
      if(P.brim&&sapFull(T,u)&&x===A.eng().lowestAlly(u)) k+=P.brim;                                          // Brimming
      if(P['graft.more']&&grafted(T,x)) k+=P['graft.more'];                                                   // Shared Heartwood
      return k; },
    hOut(A,T,u,c){ const P=T.P, r=T.r, x=c.unit; if(!x) return; let k=T.fn.healK(A,T,u,x);
      if(c.hot){ if(c.skill==='mb'){ k+=(P['mb.more']||0); if(everg(T)) k+=(P['mb.green']||0); }
        else if(c.skill==='fs'){ k+=(P['fs.more']||0); if(seaOn(T,0)) k+=(P['fs.spring']||0); } }
      else if(c.skill===RR){ k+=(P['rr.more']||0); if(inShade(T,x)){ if(r.hw_7_2) k+=0.10; k+=(P['rr.shade']||0); }
        if(r.ty_7_3&&O(T).rrSpring) k+=0.30*(1+(P['rr.show']||0)); }
      c.amt*=Math.max(0,k);
      if(!c.hot&&c.skill===RR&&O(T).rrSet) O(T).rrSet.push(x); if(!c.hot&&c.skill===FS&&O(T).fsSet) O(T).fsSet.push(x); },
    /* what a heal of his did not fit: Sap (Grove Rally: Rally Roots' counts double); with Sap full, Ever Green's shield */
    hLand(A,T,u,c){ const o=O(T), P=T.P; if(!o||!(c.over>0)||!any(T,SAP)) return; let ov=c.over; if(!c.hot&&c.skill===RR&&T.r.hw_7_2) ov*=2;
      const left=T.fn.addSap(A,T,u,ov); if(left>0&&P.eg) T.fn.everGreen(A,T,u,left); },
    everGreen(A,T,u,x){ const o=O(T), cap=T.P.eg*(u.maxHp||0); let best=null; for(const y of team(A,T,u)) if(grafted(T,y)&&(!best||frac(y)<frac(best))) best=y; if(!best) return;
      const g=o.eg[best.uid]||(o.eg[best.uid]={amt:0,t:0}); if(g.t<=0) g.amt=0; const cur=Math.min(g.amt,best.shield||0), add=Math.min(x,Math.max(0,cap-cur)); if(!(add>0)) return;
      best.shield=(best.shield||0)+add; best.shieldT=Math.max(best.shieldT||0,4); g.amt=cur+add; g.t=4; },
    /* healing received: Canopy Song (his allies in Shade); Graft (a share of every heal on him to each Grafted ally); Heartrot (enemies) */
    hIn(A,T,u,c){ const E=A.eng(), P=T.P, x=c.unit, o=O(T); if(!x||!o) return;
      if(foe(u,x)){ if(P['rot.heal']){ const n=rotN(T,x); if(n>0) c.amt*=Math.max(0,1-P['rot.heal']*n); } return; }
      if(P['shade.heal']&&inShade(T,x)) c.amt*=1+P['shade.heal'];
      if(x===u&&P['graft.share']&&!o.gIn&&c.amt>0){ o.gIn=1; try{ for(const k in o.gr){ const g=o.gr[k]; if(g.alive&&g!==u) E.healUnit(g,c.amt*P['graft.share']); } } finally{ o.gIn=0; } } },
    graft(A,T,u,x){ const o=O(T); if(!x||x===u||!mate(u,x)||x._summon) return; o.gr[x.uid]=x; },
    /* ---------------- Mending Bloom ---------------- */
    mbKit(A,T,u){ O(T).mbT=A.eng().lowestAlly(u); },
    mbCast(A,T,u,c){ const E=A.eng(), o=O(T), P=T.P, r=T.r, x=o.mbT; o.mbT=null; if(!x) return;
      if(P['mb.dur']){ const H=x.hots||[]; for(let i=H.length-1;i>=0;i--){ const h=H[i]; if(h._talU===u&&h._talK==='mb'&&!h._okD){ h._okD=1; const n=h.remaining+P['mb.dur']/(h.interval||1); h.remaining=Math.ceil(n-1e-9); const f=n-(h.remaining-1); h._talF=(f<1-1e-9)?f:null; break; } } }   // Slow Mending
      if(P.sapBloom&&o.sap>0) T.fn.pour(A,T,u,x);                                                                     // Sap Bloom: all of it at once (a pour)
      if(P.briar) for(const e of foes(A,T,u)) if(gapM(A,x,e)<2) T.fn.root(A,T,u,e,P.briar);                           // Briar Bloom
      if(r.ty_3_4&&o.sea&&!(o.allS>0)) T.fn.turn(A,T,u); },                                                           // Early Turn
    /* ---------------- Rally Roots ---------------- */
    rrKit(A,T,u){ const o=O(T); o.rrSet=[]; o.rrSpring=seaOn(T,0); },
    rrCast(A,T,u,c){ const o=O(T), P=T.P, r=T.r, L=o.rrSet||[]; o.rrSet=null;
      if(P['rr.thorn']) for(const x of L) if(mate(u,x)){ const t=o.th[x.uid]||(o.th[x.uid]={mb:0,ra:0,sp:0}); t.ra=Math.max(t.ra,P['rr.thorn']); }   // Rally the Briars (+ Thorned Rally)
      if(r.ty_7_3&&seaOn(T,3)) for(const x of L) if(x.alive&&mate(u,x)){ x.shield=Math.max(x.shield||0,0.04*x.maxHp); x.shieldT=Math.max(x.shieldT||0,4); } },   // Rally of the Year, in Winter
    /* ---------------- First Spring ---------------- */
    fsKit(A,T,u,c){ const o=O(T); o.fsSet=[]; o.fsGrove=!!(T.P['sig.grove']&&any(T,SAP)&&sapFull(T,u));
      const oo=c.o||{}; let p=oo._aim?{x:oo._aim.x,y:oo._aim.y}:((u._aimWX!=null)?{x:u._aimWX,y:u._aimWY}:null); if(!p){ let w=null,ws=2; for(const a of A.eng().units()){ if(!a.alive||a.team!==u.team||a._dropHidden||(a._riseT>0)) continue; const f=a.hp/Math.max(1,a.maxHp); if(f<ws){ ws=f; w=a; } } p=w?{x:w.x,y:w.y}:{x:u.x,y:u.y}; }
      o.fsC={x:p.x,y:p.y}; },
    fsCast(A,T,u,c){ const E=A.eng(), o=O(T), P=T.P, r=T.r, L=(o.fsSet||[]).filter(x=>mate(u,x)); o.fsSet=null; const M=E.METER();
      if(P['fs.sap']){ o.sap=Math.max(o.sap,sapMax(T,u)); for(const x of L) T.fn.graft(A,T,u,x); }                    // Spring Sap
      if(o.fsGrove){ o.fsGrove=false; o.grove=8; for(const x of team(A,T,u)) T.fn.graft(A,T,u,x);                        // The Grove Stands
        if(!o.dr2On){ o.dr2On=true; for(const x of team(A,T,u)){ if(x._drUsed&&x._drBy===u&&(o.drSeen[x.uid]||0)%2===0) x._drUsed=false; else o.dr2[x.uid]=1; } } }   // once more each: a catch already over is re-armed now, one under way or still to come when its heal is over
      if(P['fs.thorn']){ for(const x of L){ const t=o.th[x.uid]||(o.th[x.uid]={mb:0,ra:0,sp:0}); t.sp=Math.max(t.sp,5); }       // Spring of Thorns
        const C=o.fsC; if(C) for(const e of foes(A,T,u)){ if(Math.hypot(e.x-C.x,e.y-C.y)-E.bodyR(e)<6*M) T.fn.addAcorn(A,T,u,e,3); } }
      if(r.ty_11_3){ if(o.sea){ T.fn.toSpring(A,T,u,0); o.sea.t=Math.max(o.sea.t,5); }                         // First Thaw: Spring at once, held until the regrowth ends
        for(const x of L) if(x.alive){ for(const f of ['stunned','fearT','silencedT','_sleepT','slow']) if((x[f]||0)>0) x[f]=0; } }
      if(P['sig.wood']) o.wood=8;                                                                                         // The Wood Remembers
      if(P['sig.year']){ o.allS=8; if(o.ne) for(let i=0;i<o.ne.length;i++) o.ne[i]=0;                                    // The Spring That Woke
        if(r.ty_4_1&&o.sg.regrown&&!o.sg.re){ o.sg.re=1; o.sg.used=false; } } },
    /* ---------------- Deep Roots ---------------- */
    drScan(A,T,u,c){ const E=A.eng(), o=O(T), P=T.P; const L=E.units();
      for(let i=0;i<L.length;i++){ const x=L[i]; if(!x.alive||x.team!==u.team) continue; const n=o.drSeen[x.uid]||0;
        if(x._drUsed&&x._drBy===u&&n%2===0&&(x._drLeft||0)>0){ o.drSeen[x.uid]=n+1; T.fn.caught(A,T,u,x); }
        else if(n%2===1&&!((x._drLeft||0)>0)){ o.drSeen[x.uid]=n+1;                                                     // that catch's heal is over
          if(o.dr2[x.uid]){ delete o.dr2[x.uid]; x._drUsed=false; } } }                                                   // The Grove Stands: it can catch that ally once more
    },
    /* Deep Roots has just caught x (the passive ran in the pass after his last tick): its heal made stronger / longer, Graft, Grasping Ground, Root Grip */
    caught(A,T,u,x){ const E=A.eng(), P=T.P; if(any(T,GRAFT)) T.fn.graft(A,T,u,x); const k=T.fn.healK(A,T,u,x)+(P['dr.heal']||0)+0.04*rk(T,'hw_12_4');
      const tot=x.maxHp*0.25*(u.passMul||1), done=Math.max(0,4-(x._drLeft||0))*(x._drRate||0), left=(x._drLeft||0)+(P['dr.slow']||0);
      if(left>0&&(k!==1||P['dr.slow'])){ x._drLeft=left; x._drRate=Math.max(0,tot*k-done)/left; }
      if(P.grasp) for(const e of foes(A,T,u)) if(gapM(A,x,e)<3){ e.slow=Math.max(e.slow||0,3); e.slowMul=Math.min(e.slowMul==null?1:e.slowMul,1-P.grasp); }
      if(P.rgrip) for(const e of foes(A,T,u)) if(gapM(A,x,e)<2) T.fn.root(A,T,u,e,P.rgrip); },
    /* ---------------- roots, Acorns, Heartrot, Thorns ---------------- */
    isRooted(A,T,u,c){ return rooted(T,c.tgt); },
    isGrafted(A,T,u,c){ return grafted(T,c.tgt); },
    rot5(A,T,u,c){ return rotN(T,c.tgt)>=5; }, hasRot(A,T,u,c){ return rotN(T,c.tgt)>0; }, rotCnt(A,T,u,c){ return rotN(T,c.tgt); },
    winter(A,T){ return seaOn(T,3); }, regrown(A,T){ const o=O(T); return !!(o&&o.sg.regrown); }, turns(A,T){ const o=O(T); return o&&o.sea?Math.min(5,o.sea.turns):0; },
    /* a root of his: its full written length, never past 4.0 s, never shortening a longer one; 1 Heartrot */
    root(A,T,u,e,secs){ const o=O(T); if(!e||!e.alive||!(secs>0)) return; o.rt[e.uid]=Math.max(o.rt[e.uid]||0,Math.min(ROOT_TOP,secs)); T.fn.rot(A,T,u,e,1); },
    rot(A,T,u,e,n,fill){ if(!any(T,ROT)||!e||!e.alive) return; const o=O(T), h=o.hr[e.uid]||(o.hr[e.uid]={n:0,t:0}); if(h.t<=0) h.n=0;
      h.n=fill?5:Math.min(5,h.n+n); h.t=6+(T.P['rot.dur']||0); },
    /* his talent damage (Thorns, sprouting Acorns): magic, through the enemy's magic resist; Angry Sap, Snarl, Summer and Autumn as for his hits */
    tdmg(A,T,u,e,amt,tag){ const E=A.eng(), P=T.P; if(!e||!e.alive||!(amt>0)) return 0; let k=1+(P['magic.more']||0);
      if(P.snarl&&rooted(T,e)) k*=1+P.snarl; const su=summerK(T), au=autumnK(T); if(su) k*=1+su; if(au) k*=1+au;
      return A.hurt(T,u,e,amt*k*E.defMul(u,e,'magic'),'#9be38a',tag); },
    ap(A,T,u){ return (u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1); },
    plant(A,T,u,c){ const e=c.tgt; if(!e||!e.alive) return; T.fn.addAcorn(A,T,u,e,T.P.spear?2:1); },
    /* Acorns on an enemy (max 3, 6 s + Seed Store); at 3 they sprout. scattered: Scattered Seed's Acorn never sprouts its enemy by itself */
    addAcorn(A,T,u,e,n,scattered){ if(!any(T,ACORN)||!e||!e.alive) return; const o=O(T), a=o.ac[e.uid]||(o.ac[e.uid]={n:0,t:0}); if(a.t<=0) a.n=0;
      a.n=Math.min(scattered?Math.max(a.n,2):3,a.n+n); a.t=6+(T.P['acorn.dur']||0); if(a.n>=3&&!scattered) T.fn.sprout(A,T,u,e); },
    sprout(A,T,u,e){ const E=A.eng(), o=O(T), P=T.P; const a=o.ac[e.uid]; if(!a||!(a.n>0)) return; delete o.ac[e.uid];
      let k=(1+(P['acorn.more']||0))*(1+((P.oak&&(rooted(T,e)||slowed(e)))?P.oak:0));
      T.fn.tdmg(A,T,u,e,T.fn.ap(A,T,u)*Math.max(0.15,P.acorn||0)*k,'acorn');
      T.fn.root(A,T,u,e,0.5+(P['acorn.root']||0));
      if(P['acorn.nrg']) u.energy=Math.min(100,(u.energy||0)+P['acorn.nrg']);
      if(P.scatter) for(const x of foes(A,T,u)) if(x!==e&&gapM(A,e,x)<2) T.fn.addAcorn(A,T,u,x,1,true); },
    /* an enemy basic attack lands on an ally (or on him) with Thorns: the bite */
    bite(A,T,u,x,s){ const P=T.P, o=O(T); if(!s||!s.alive) return; const t=o.th[x.uid]||{};
      let k=(1+(P['thorn.more']||0))*(P.spear?0.7:1);
      if(P.hedge&&P.bramble&&acorns(T,s)>=2) k*=1+P.hedge;
      if(P.bitter&&t.sp>0) k*=1+P.bitter;
      const low=frac(x)<0.40; if(P.barkbound&&low) k*=1+P.barkbound;
      if(P.oak&&(rooted(T,s)||slowed(s))) k*=1+P.oak;
      T.fn.tdmg(A,T,u,s,T.fn.ap(A,T,u)*Math.max(0.08,P.thorn||0)*k,'thorn');
      T.fn.rot(A,T,u,s,1);
      if(s.alive&&(P.bramble||(P.barkbound&&low))) T.fn.addAcorn(A,T,u,s,(P.bramble&&P.barkbound&&low)?2:1); },
    /* The Wood Remembers: for 8 s after First Spring, an enemy that strikes his side is rooted 0.6 s (once per enemy every 3 s), sprouts all its Acorns, 5 Heartrot */
    wood(A,T,u,s){ const o=O(T); if(!(o.wood>0)||!s||!s.alive||(o.wr[s.uid]||0)>0) return; o.wr[s.uid]=3;
      T.fn.root(A,T,u,s,0.6); T.fn.sprout(A,T,u,s); T.fn.rot(A,T,u,s,0,true); },
    /* ---------------- damage ---------------- */
    /* what his talents take off a hit on x of his side (one share each, multiplied): Shade, Deep Shadow, Leaf Mulch, Kept Close, First Green, Woodland Ward, Winter */
    teamF(A,T,u,x,c){ const P=T.P, s=c.src; let k=1;
      if(shaded(T,x)&&(x!==u||O(T).grove>0)){ const d=shadeDr(T); if(d) k*=1-d;
        if(P['dr.ds']&&T.r.hw_5_2&&s&&s._castSlot==='ult'&&!c.auto) k*=1-P['dr.ds']; }
      if(P['dr.lm']&&underMB(u,x)) k*=1-P['dr.lm'];
      if(P['dr.kc']&&grafted(T,x)) k*=1-P['dr.kc'];
      if(T.r.hw_n1&&(O(T).fgW[x.uid]||0)>0) k*=0.96;
      if(P['dr.ww']&&rooted(T,s)&&thorned(T,u,x)) k*=1-P['dr.ww'];
      const w=winterK(T); if(w) k*=1-w;
      return k; },
    /* his own share (hits on him): Thick Bark (the first hit each wave; probe: not spent), Ringed Trunk, Still Wood, Heavy Limbs, Hard Rind, Wooden Heart, Unbending, Winter Hardiness, Weathered */
    meF(A,T,u,c,probe){ const P=T.P, o=O(T), s=c.src; let k=1;
      if(P['dr.tb']&&o.tb!==T.s.wave){ k*=1-P['dr.tb']; if(!probe) o.tb=T.s.wave; }
      if(P['dr.rt']&&o.rtW>0) k*=1-P['dr.rt'];
      if(P['dr.sw']&&o.sap>0) k*=1-P['dr.sw'];
      if(P['dr.hl']){ let n=0; for(const g in o.gr) if(o.gr[g].alive&&o.gr[g]!==u) n++; k*=1-P['dr.hl']*Math.min(4,n); }
      if(P['dr.hr']&&(rooted(T,s)||slowed(s))) k*=1-P['dr.hr'];
      if(P['dr.wh']&&rotN(T,s)>0) k*=1-P['dr.wh'];
      if(P['dr.ub']&&c.auto) k*=1-P['dr.ub'];
      if(P['dr.wint']&&seaOn(T,3)) k*=1-P['dr.wint'];
      if(P['dr.wea']&&c.kind==='magic') k*=1-P['dr.wea'];
      return k; },
    /* the factor on a hit on him, as the 95% probe reads it (pure: nothing spent) */
    drMe(A,T,u,c){ return Math.max(ME_CAP,T.fn.teamF(A,T,u,u,c)*T.fn.meF(A,T,u,c,true))*(1+(T.P.risk||0)); },
    drAlly(A,T,u,x,c){ return Math.max(ALLY_CAP,T.fn.teamF(A,T,u,x,c)); },
    myIn(A,T,u,c){ const s=c.src; if(!s||!foe(u,s)) return;
      if(c.auto&&thorned(T,u,u)) T.fn.bite(A,T,u,u,s);
      if(O(T).wood>0) T.fn.wood(A,T,u,s);
      c.amt*=Math.max(ME_CAP,T.fn.teamF(A,T,u,u,c)*T.fn.meF(A,T,u,c,false))*(1+(T.P.risk||0)); },
    tIn(A,T,u,c){ const t=c.tgt, s=c.src, P=T.P, o=O(T); if(!t||!s||!o) return;
      if(foe(u,t)){ if(!mate(u,s)) return; let k=1; if(P.snarl&&rooted(T,t)) k*=1+P.snarl; const su=summerK(T), au=autumnK(T); if(su) k*=1+su; if(au) k*=1+au; c.amt*=k; return; }
      if(!foe(u,s)) return;
      if(c.auto&&thorned(T,u,t)) T.fn.bite(A,T,u,t,s);
      if(o.wood>0) T.fn.wood(A,T,u,s);
      c.amt*=Math.max(ALLY_CAP,T.fn.teamF(A,T,u,t,c));
      if(P.bb&&grafted(T,t)&&c.amt>0.15*t.maxHp&&!((o.bbL[t.uid]||0)>0)){ o.bbL[t.uid]=5; o.q.push({x:t}); } },     // Bound Bark: healed after the hit lands (his next tick)
    myOut(A,T,u,c){ const P=T.P, t=c.tgt; if(!t||!foe(u,t)) return; let k=1;
      if(c.auto){ if(P['auto.more']) k*=1+P['auto.more']; if(P.harvest&&seaOn(T,2)) k*=1+P.harvest; if(P.split&&P.spear&&acorns(T,t)>0) k*=1+P.split; if(P.fury&&rooted(T,t)) k*=1+P.fury; }
      if(P['magic.more']&&c.kind==='magic') k*=1+P['magic.more'];
      c.amt*=k; },
    /* ---------------- the Seasons ---------------- */
    turn(A,T,u){ const E=A.eng(), o=O(T), P=T.P; const s=o.sea; let i=s.i+1; if(everg(T)&&i>1) i=4; if(i>=4){ i=0; T.fn.fullTurn(A,T,u); } s.i=i; s.t=seaDur(T,i); },
    toSpring(A,T,u,extra){ const o=O(T); if(!o.sea) return; if(o.sea.i!==0){ o.sea.i=0; o.sea.t=seaDur(T,0); } o.sea.t+=extra||0; },
    fullTurn(A,T,u){ const E=A.eng(), o=O(T), P=T.P; o.sea.turns++;
      if(P.road){ const L=team(A,T,u); let lo=null; for(const x of L) if(x!==u&&(!lo||frac(x)<frac(lo))) lo=x; E.healUnit(u,u.maxHp*P.road); if(lo) E.healUnit(lo,lo.maxHp*P.road); }   // Old as the Road
      if(P.ring) for(const x of team(A,T,u)) x.energy=Math.min(100,(x.energy||0)+P.ring); },                                                       // Ring Count
    /* ---------------- Nests ---------------- */
    /* a stun, fear or sleep landed on an ally (through the game's ccApply): a ready Nest's songbird cuts it short by 10% per rank (at most 50%), when this control set the time */
    nest(A,T,u,c){ const o=O(T), P=T.P, x=c.unit, f=c.field; if(!o||!o.ne||!x||x===u||!mate(u,x)||x._summon||!(c.amt>0)||!foe(u,c.src)) return; if(f!=='stunned'&&f!=='fearT') return;
      if(Math.abs((x[f]||0)-c.amt)>1e-9) return; const i=o.ne.indexOf(0); if(i<0) return; o.ne[i]=Math.max(0.5,12-(P['nest.re']||0));
      const cut=Math.min(0.5,Math.max(0.10,P.nest||0)); x[f]=c.amt*(1-cut); if(f==='stunned'){ o.zz[x.uid]=x; if((x._sleepT||0)>0) x._sleepT=Math.min(x._sleepT,x.stunned); }
      if(P['bird.heal']) A.eng().healUnit(x,x.maxHp*P['bird.heal']); if(P['bird.nrg']) x.energy=Math.min(100,(x.energy||0)+P['bird.nrg']); },
    /* ---------------- Second Growth ---------------- */
    die(A,T,u){ const o=O(T), P=T.P; if(!o||o.sg.used) return; o.sg.used=true; o.sg.wait=Math.max(0,10-rk(T,'ty_4_1')-(P['sg.quick']||0)); o.sg.x=u.x; o.sg.y=u.y; o.sg.h1=0;
      T.s.ghost=true; u._talKeep=1; },                                        // his body stays on the field while he waits (an enemy-side body is otherwise taken off 0.9 s after it falls)
    fallen(A,T,u,c){ const E=A.eng(), o=O(T), P=T.P, dt=c.dt||0; if(!o||!(o.sg.wait>=0)) return;
      if(P['sg.seed']){ o.sg.h1+=dt; if(o.sg.h1>=1-1e-9){ o.sg.h1-=1; let lo=null; for(const x of E.units()) if(x.alive&&x.team===u.team&&!x._summon&&(!lo||frac(x)<frac(lo))) lo=x; if(lo) E.healUnit(lo,lo.maxHp*Math.min(REGEN,P['sg.seed'])); } }   // Fallen Seed
      o.sg.wait-=dt; if(o.sg.wait>1e-9) return; o.sg.wait=-1; T.fn.regrow(A,T,u); },
    regrow(A,T,u){ const E=A.eng(), o=O(T), P=T.P, M=E.METER();
      u.alive=true; u.deathT=0; u._talKeep=0; T.s.ghost=false; u.hp=Math.max(1,Math.min(E.healCap(u),u.maxHp*(0.25+(P['sg.hp']||0))));
      u.stunned=0; u.fearT=0; u.silencedT=0; u._sleepT=0; u.slow=0; u.energy=0; if(u.dots) u.dots.length=0; u.x=(o.sg.x!=null?o.sg.x:u.x)-1*M; u.y=o.sg.y!=null?o.sg.y:u.y; u._ax=u.x; u._ay=u.y;
      o.sg.regrown=true; o.f={};
      if(P['sg.team']) for(const x of allies(A,T,u)) E.healUnit(x,x.maxHp*P['sg.team']);                                                     // Rooted Again
      if(P['sg.root']) for(const e of foes(A,T,u)) if(gapM(A,u,e)<4) T.fn.root(A,T,u,e,P['sg.root']); }                                     // Waking Roots
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/44 - OAKMIR - talent decisions.md) */
  ruling:{}
};
