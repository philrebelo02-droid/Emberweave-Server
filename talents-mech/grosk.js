/* GROSK - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Grosk": what he added)
   His real kit (the code, not the tooltip wording; he is a Tank: no ability power, his hits are physical):
   - Gravemaw Pull ('pullsilence', green, cd 10, deliver 'form': it forms around HIM 0.35 s after the release, it has no aim): every enemy within 5 m of his
     centre is silenced (ccApply, 2 s x 0.7 = 1.4 s; 'dur' is not in the control table), taunted onto him for 2 s (forcedTargetT, not cut) and dragged in.
     'caught' in his trees = those enemies (the cast row sees them: the drag moves them later, in the status pass).
   - Hammer Fists ('punchflurry', blue, cd 6): three punches at his target (u.target, else the nearest; the 'skillTgt' hook may choose another), landing
     0.128 / 0.745 / 1.305 s after the release on the fight clock (groundHazards), each 20% (+0.1/99 a level) of his armor. Each punch draws the seeded
     taunt roll (tauntChance 1: always) and taunts the target for tauntDur and silences it through ccApply. tauntDur is in the control table: a single
     target's taunt is 5.0 s, so each punch taunts it 5 s and silences it 5 x 0.7 = 3.5 s (Kimi had 2 s). Each punch is the part 'punch' (partPre / part).
   - The Mirewall (passive 'mirewall'): each tick (after the talent tick hook) his ward is re-picked: the living ally with the LOWEST HP (absolute, summons
     too). An enemy's hit on the ward (in _dealDamageCore, before any dodge or miss) is cut by 20% + 0.15/99 a level (35% at 100); 35% of the cut is
     written straight onto Grosk (never below 1 HP, no reduction of his) and he heals back half of that. The 'num' hook names the three numbers:
     'mwCut', 'mwTake' (each call is one move onto him), 'mwHeal' (ctx unit = the ward, src = the attacker).
   - Croc Drop (ultimate 'hipposlam', energy; ULT_DEF only, HERO_ULT_ART.grosk is art): a leap of 1.345 s (an air dash) onto the aimed point, or unaimed onto
     the densest 3 m group within 6 m ('skillTgt' hook: Down Beside Them). On landing ('landPre' / 'land', skill 'hipposlam') every enemy within 3 m of the
     landing (centre) takes 10% -> 20% of his max HP and is stunned: 'stun' is in the control table, an area stun 2.0 s x 0.7 = 1.4 s (ULT_DEF says 0.6;
     Kimi had 0.6). Then every ally (himself too) gets the Wall: 20% + 0.15/99 a level (35% at 100) less damage from hits for 3 s while he stands.
   Depth, Refusal, Mired, Gulp, Bite Marks, Death Roll, Wardbound, Called Out and Undertow exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/25 - GROSK - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const HF='punchflurry', GP='pullsilence', CD='hipposlam';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const DEPTH=['sh_1_1','sh_2_1','sh_3_1','sh_4_1','sh_6_1','sh_7_1','sh_8_1','sh_9_1','sh_10_1','sh_11_1','sh_12_1','sh_11_2','sh_12_2','sh_13_2'];
const TOWARD=['mw_8_3','mw_n2'];
const REF=['sh_1_4','sh_5_4','sh_3_4','sh_10_4','sh_7_4','sh_12_4','sh_9_4','sh_13_2'];
const MIRE=['sh_2_2','sh_4_2','sh_6_2','sh_8_2','sh_10_2','sh_5_2','sh_5_3','sh_6_3'];
const GULP=['oj_1_1','oj_3_1','oj_7_1','oj_6_1','oj_9_1','oj_10_1','oj_12_1'];
const BITE=['oj_1_4','oj_2_4','oj_3_4','oj_4_4','oj_10_4','oj_11_2','oj_11_4','oj_7_4','oj_6_4','oj_10_3','oj_11_3','oj_13_3'];
const ROLL=['oj_2_3','oj_4_3','oj_6_3','oj_12_3','oj_12_4','oj_10_3','oj_5_3','oj_5_2','oj_6_2','oj_7_3','oj_11_3','oj_13_3'];
const PUNCH=GULP.concat(ROLL,['oj_9_3','mw_4_2']);
const CO=['mw_1_2','mw_2_2','mw_4_2','mw_5_2','mw_6_2','mw_8_2','mw_11_2','mw_12_2','mw_9_2'];
const UT=['mw_1_4','mw_3_4','mw_5_4','mw_6_4','mw_7_4','mw_9_4','mw_12_4','mw_13_2'];
const WB=['mw_1_1','mw_2_1','mw_3_1','mw_8_1','mw_10_1'];
const WARDS=WB.concat(['mw_5_3','mw_6_3','mw_12_1','mw_13_2']);
const TEN=['sh_5_1','sh_12_3','oj_12_2','sh_3_1'];
const UTC={roll:'ut',step:1,max:P('ut.max',10)};                                      // Undertow: each one lasts its own 6 s (Rising Water longer), at most 10 (Brimming 14)
const VS_WARD={srcTeam:'enemy',fn:'tWard'};                                             // an enemy's hit on his Mirewall ward
/* ---- helpers ---- */
const isWard=(u,x)=>!!x&&x.alive&&x._mwBy===u&&x!==u;
const roof=(A,f)=>Math.min(4.0,(A.eng().ccCap(f)||2.8)/(A.eng().ccDur(1)||1));        // a control lengthened by a talent: in full, never past 4.0 s (the uncut ceiling, at most 4 s)
function ext(A,t,f,by){ if(!t||!t.alive||!((t[f]||0)>0)||!(by>0)) return; t[f]=Math.max(t[f],Math.min(roof(A,f),t[f]+by)); }
function mire(A,T,u,x,dur){ if(!x||!x.alive||x.team===u.team) return; A.setMark(T,u,x,'mired',{dur:dur!=null?dur:3+(T.P['mire.dur']||0),longest:true}); }
function caught(A,u,o){ const E=A.eng(), R0=(o&&o.radius)||5*E.METER(), L=[]; for(const x of E.units()) if(x.alive&&x.team!==u.team&&E.dist(u,x)<=R0) L.push(x); return L; }
function wards(T,u){ const L=[]; if(isWard(u,u._mwWard)) L.push(u._mwWard); const w2=T.s.w2; if(isWard(u,w2)&&L.indexOf(w2)<0) L.push(w2); const cw=T.s.cw; if(isWard(u,cw)&&L.indexOf(cw)<0) L.push(cw); return L; }
function roll(A,T,u,x){ if(!x||!x.alive||x.team===u.team) return; const d=3+(T.P['roll.dur']||0);
  A.acts(T,u,[{mark:'roll',on:'target',dur:d,ends:'rollEnd'}],{u,src:u,tgt:x}); A.run(T,u,'rolled',{u,src:u,tgt:x,amt:d}); }
function utCount(A,T,u){ return A.cnt(T,u,{roll:'ut',step:1,max:10+(T.P['ut.max']||0)},{}); }
function utAdd(A,T,u,n){ if(!(n>0)) return; const was=utCount(A,T,u); A.acts(T,u,[{roll:'ut',add:n,span:6+(T.P['ut.dur']||0)}],{u});
  if(was<10&&utCount(A,T,u)>=10) A.run(T,u,'ut10',{u,tgt:u}); }
function callOut(A,T,u,x,taunt){ if(!x||!x.alive||x.team===u.team) return; const d=4+(T.P['co.dur']||0), E=A.eng(); A.setMark(T,u,x,'co',{dur:d});
  const s=T.s; if(!s.coS||s.coS.w!==s.wave) s.coS={w:s.wave,ids:{}}; s.coS.ids[x.uid]=1;
  if(T.P.faceme||taunt){ const t=taunt?Math.max(taunt,0):d; x.forcedTarget=u; x.forcedTargetT=Math.max(x.forcedTargetT||0,t); } }
module.exports={
  hero:'grosk',
  times:['dugT','cwT'],   // this file's own absolute fight times (paths in T.s): the engine moves them back with the clock at each wave (WIRING/41c)
  casting:true,                         // rows ask which skill (or which punch) a hit, a stun or a silence comes from
  states:{
    depth:{max:10},                                                                // Depth (the 'depth' always row: standing still / moving)
    ref:{max:5,gain:'refGain'},                                                    // Refusal (for the wave; Still Here keeps some)
    gulp:{max:5},                                                                  // Gulp
    fury:{max:3,dur:4},                                                            // Fen Fury
    tw:{max:1},                                                                    // walking toward his ward this tick (Stand Guard, Dug In Beside Them)
    bite:{unit:true,max:6,dur:P('bite.dur',8),full:'biteFull'},                    // Bite Marks, on enemies
    wb:{unit:true,max:5}                                                           // Wardbound, on his wards (kept by the 'wards' always row)
  },
  needs:{ sh_6_3:'sh_5_3' },                                                       // Far Spit improves Spit Out
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',reqAny:TOWARD,do:[{fn:'toward'}]},                                                                // walking toward his ward
    {on:'tick',reqAny:DEPTH,do:[{fn:'depth'}]},                                                                  // Depth: +1 a second standing, -2 a second moving
    {on:'kit',skill:CD,reqAny:DEPTH,do:[{fn:'leap'}]},                                                           //   a Croc Drop leap empties it (Plant Again keeps some)
    {on:'kit',skill:CD,reqAny:['sh_6_4'],do:[{fn:'cdCount'}]},                                                   // which Croc Drop of the fight this is (Bad Morning)
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                      // shorter controls on him, with their cap
    {on:'hurt',reqAny:REF,if:{lostMin:{pct:P('ref.th',0.08),of:'maxHp'}},do:[{stack:'ref',add:1}]},              // Refusal: a single hit that took more than 8% of his max HP, survived
    {on:'wave',reqAny:REF,do:[{fn:'refWave'}]},                                                                  //   for the wave (Still Here keeps some)
    {on:'cast',skill:GP,reqAny:MIRE,do:[{fn:'gpMire'}]},                                                         // Mired: every enemy Gravemaw Pull caught (and taunted)
    {on:'part',skill:'punch',reqAny:MIRE,if:{fn:'tauntMe'},do:[{fn:'mireT'}]},                                   //   and each enemy a punch taunted
    {on:'cast',skill:GP,reqAny:GULP,do:[{fn:'gpGulp'}]},                                                         // Gulp: 1 for each enemy Gravemaw Pull caught
    {on:'kit',skill:HF,reqAny:PUNCH,do:[{fn:'flurry'}]},                                                         // Hammer Fists released: Gulp spent, the punch count, the signature's crits
    {on:'partPre',skill:'punch',reqAny:PUNCH,do:[{fn:'pIdx'}]},                                                  //   each punch
    {on:'part',skill:'punch',reqAny:['oj_9_3','mw_4_2'],do:[{fn:'tauntLong'}]},                                  //   its taunt, longer (Ground and Pound, Big Voice)
    {on:'hit',reqAny:ROLL,if:{casting:'punch',targetTeam:'enemy'},do:[{fn:'pLand'}]},                            // Death Roll: all three punches landed on one enemy
    {on:'hit',reqAny:BITE,if:{casting:'punch',targetTeam:'enemy'},do:[{ustack:'bite',on:'target',add:1}]},       // Bite Marks: each punch
    {on:'hit',reqAny:BITE,if:{crit:true,targetTeam:'enemy'},do:[{ustack:'bite',on:'target',add:1}]},             //   and each critical hit
    {on:'teamIn',reqAny:CO,if:VS_WARD,do:[{fn:'coSrc'}]},                                                        // Called Out: an enemy that hits his ward
    {on:'num',skill:'mwCut',reqAny:['mw_6_1','mw_5_3','mw_13_2'],do:[{fn:'mwCut'}]},                             // The Mirewall's cut on the ward
    {on:'num',skill:'mwTake',reqAny:UT.concat(['mw_n2']),do:[{fn:'mwTake'}]},                                    //   each move onto him (Undertow, Dug In Beside Them)
    {on:'num',skill:'mwHeal',reqAny:['mw_4_3','mw_13_2'],do:[{fn:'mwHeal'}]},                                    //   what he heals back
    {on:'tick',reqAny:WARDS,do:[{fn:'wards'}]}                                                                   // his wards: Two Wards, Wardbound, Ancient Patience, the closed wall
  ],
  talents:{
    /* ============================== THE SUNKFEN HOLD ============================== */
    sh_1_1:[ {on:'in',less:R(0.003),per:'depth'} ],                                                             // Set Feet
    sh_2_3:[ {on:'out',if:{casting:'punch'},more:R(0.04)} ],                                                    // Heavy Hands
    sh_1_4:[ {stat:{atk:R(0.01)},per:'ref'} ],                                                                  // Will Not Go Down
    sh_2_1:[ {param:'depth.rate',add:R(0.25)} ],                                                                // Deep Mud
    sh_2_2:[ {stat:{move:R(-0.03)},to:{team:'enemy',has:'mired'}}, {on:'in',if:{srcHas:'mired'},less:R(0.01)} ],   // Mire Them
    sh_3_1:[ {param:'rooted',add:1}, {on:'tick',if:{stackMin:{depth:10}},do:[{timer:'_gearImmovableT',min:0.1,on:'self'}]} ],   // Rooted Like a Cypress
    sh_5_4:[ {param:'ref.th',add:R(-0.01)} ],                                                                   // Last One Standing
    sh_3_4:[ {on:'in',less:R(0.004),per:'ref'} ],                                                               // Stubborn Count
    sh_4_1:[ {stat:{mr:R(0.002)},per:'depth'} ],                                                                // Bedrock
    sh_4_2:[ {param:'mire.dur',add:R(0.5)} ],                                                                   // Sucking Mud
    sh_4_3:[ {on:'ccHit',if:{casting:GP,cc:['silencedT']},do:[{fn:'ext',f:'silencedT',by:R(0.2)}]} ],           // Long Silence: in full, after it landed
    sh_5_1:[ {param:'ten.all',add:R(0.04)} ],                                                                   // Unmired (the 'ten' always row; up to 20%)
    sh_8_2:[ {on:'out',if:{casting:'punch',targetHas:'mired'},more:R(0.03)} ],                                  // Grip of the Fen
    sh_9_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                  // Iron in the Mud
    sh_6_1:[ {on:'out',if:{auto:true,stackMin:{depth:5}},more:R(0.04)} ],                                       // Sunk to the Knees
    sh_6_2:[ {on:'teamIn',if:{srcHas:'mired',targetTeam:'ally'},less:R(0.015)} ],                               // Clinging Mud
    sh_6_4:[ {on:'out',if:{casting:CD,fn:'firstCd'},more:R(0.10)} ],                                            // Bad Morning
    sh_7_1:[ {on:'tick',if:{stackMin:{depth:10}},period:1,do:[{heal:{pct:R(0.0024),of:'maxHp'}}]} ],            // Moss Grown (the regeneration cap: 1.2% a second at 5/5)
    sh_7_3:[ {on:'out',if:{casting:CD},more:R(0.03)} ],                                                         // Hard Landing
    sh_8_3:[ {on:'in',if:{srcRow:'Back'},less:R(0.02)} ],                                                       // Grim Stance
    sh_8_1:[ {param:'depth.keep',add:R(0.1)} ],                                                                 // Settled
    sh_5_2:[ {on:'tick',period:0.1,do:[{fn:'dashWatch'}]} ],                                                    // Swallowed Whole (PICK ONE)
    sh_5_3:[ {on:'death',if:{who:'enemy',unitHas:'mired'},do:[{fn:'spit'}]} ],                                  // Spit Out (PICK ONE)
    sh_7_4:[ {param:'ref.keep',add:R(1)} ],                                                                     // Still Here
    sh_9_1:[ {param:'plant',add:R(0.1)} ],                                                                      // Plant Again
    sh_6_3:[ {param:'spit.dur',add:R(1)} ],                                                                     // Far Spit
    sh_9_4:[ {on:'in',once:'wave',if:{dropBelow:0.20},mul:0.5,do:[{stack:'ref',add:3}]} ],                     // Not This Morning
    sh_10_1:[ {on:'tick',if:{stackMin:{depth:10}},period:1,do:[{cd:'green',add:R(-0.1)}]} ],                    // Patient Stone
    sh_10_2:[ {on:'teamIn',if:{targetHas:'mired',srcTeam:'ally'},more:R(0.01)} ],                               // Dragged Under (his whole team: him too)
    sh_10_4:[ {on:'refGain',do:[{heal:{pct:R(0.01),of:'maxHp',k:1}}]} ],                                        // Spite of the Small: for each Refusal gained
    sh_11_1:[ {stat:{atk:R(0.002)},per:'depth'} ],                                                              // Grounded Blows
    sh_11_2:[ {on:'land',skill:CD,do:[{stack:'depth',set:'max'}]},                                              // The Fen Holds: 10 Depth on landing
              {on:'ccHit',if:{casting:CD,cc:['stunned']},do:[{fn:'mireT'}]} ],                                  //   every enemy the landing stunned is Mired
    sh_11_3:[ {on:'in',if:{crit:true},less:R(0.02)} ],                                                          // Knotted Hide
    sh_12_1:[ {on:'wave',do:[{stack:'depth',atLeast:R(2)}]} ],                                                  // Waterline
    sh_12_2:[ {on:'teamIn',if:{stackMin:{depth:10},srcTeam:'enemy',targetTeam:'ally',targetWithin:4},less:R(0.01)} ],   // Bog Body
    sh_12_3:[ {param:'ten.sil',add:R(0.1)} ],                                                                   // Thick Neck
    sh_12_4:[ {on:'refGain',if:{stackMin:{ref:5}},do:[{fn:'swallow'}]} ],                                       // Hard to Swallow (once per wave per rank)
    sh_13_2:[ {on:'lethal',once:'fight',do:[{undying:3},{stack:'depth',set:'max'},{stack:'ref',set:'max'},{window:'morn',dur:3},   // The Morning He Would Not Go Down (SIGNATURE)
                {taunt:3,on:{team:'enemy',within:5}},{fn:'mireOn',on:{team:'enemy',within:5}}]},
              {on:'in',if:{window:'morn'},do:[{fn:'mornHit'}]},                                                 //   every hit in those 3 s heals him for half of it instead
              {on:'end:morn',do:[{fn:'mornEnd'}]} ],                                                            //   then healed to 30%
    /* ============================== THE OLD JAWS ============================== */
    oj_1_1:[ {on:'out',if:{casting:'punch'},more:R(0.03),per:{window:'gs'}} ],                                  // Gulp: each Gulp the Hammer Fists spent
    oj_9_3:[ {param:'taunt.add',add:R(0.2)} ],                                                                  // Ground and Pound (tauntLong)
    oj_1_4:[ {on:'out',more:R(0.005),per:{ust:'bite'}} ],                                                       // Bite Marks
    oj_2_3:[ {stat:{armor:R(-0.03)},to:{team:'enemy',has:'roll'}},                                              // Death Roll: its armor
             {on:'crit',if:{targetHas:'roll'},chance:R(0.004),force:true} ],                                    //   and his crit chance against it (5% in all with Bruiser's Edge)
    oj_2_4:[ {param:'bite.dur',add:R(2)} ],                                                                     // Teeth Sink In
    oj_3_1:[ {on:'gulpSpent',do:[{heal:{pct:R(0.003),of:'maxHp',x:'spent'}}]} ],                                // Big Swallow
    oj_3_4:[ {on:'biteFull',do:[{mark:'lj',on:'target',dur:1},{ustack:'bite',on:'target',set:3}]},              // Locked Jaw: rooted 1 s, its marks drop to 3
             {stat:{move:-1},to:{team:'enemy',has:'lj'}} ],
    oj_4_2:[ {on:'out',if:{casting:'punch'},more:R(0.05)} ],                                                    // Hammer Weight
    oj_4_3:[ {param:'roll.dur',add:R(0.5)} ],                                                                   // Long Roll
    oj_4_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},chance:R(0.06),do:[{ustack:'bite',on:'target',add:1}]} ],   // Fresh Wounds
    oj_5_1:[ {on:'kit',skill:GP,opt:{radius:{addM:R(0.2)}}} ],                                                  // Gravemaw Hunger
    oj_5_2:[ {on:'rollEnd',do:[{push:'target',m:2,secs:0.3},{stun:P('spin.stun',0.5),on:'target'}]} ],         // Spin Them Loose (PICK ONE)
    oj_5_3:[ {on:'rolled',do:[{fn:'deep'}]} ],                                                                  // Drag to the Deep (PICK ONE)
    oj_n1:[  {on:'out',if:{auto:true,fn:'held'},more:R(0.03)} ],                                                // Easy Meat
    oj_6_2:[ {param:'spin.stun',add:R(0.15)} ],                                                                 // Thrown Clear
    oj_6_3:[ {on:'out',if:{targetHas:'roll'},more:R(0.02)} ],                                                   // Twist the Body
    oj_6_4:[ {on:'teamHeal',if:{who:'enemy',unitUst:{bite:3}},less:R(0.04)} ],                                  // Old Scars
    oj_7_1:[ {on:'in',if:{stackMin:{gulp:3}},less:R(0.01)} ],                                                   // Full Belly
    oj_6_1:[ {on:'wave',do:[{stack:'gulp',atLeast:R(1)}]} ],                                                    // Open Mouth
    oj_7_3:[ {param:'bites3',add:1},                                                                            // Three Bites: the third punch always starts a Death Roll (pLand)
             {on:'skillTgt',skill:'punch',do:[{retarget:{team:'enemy',of:'target',within:2,n:1}}]} ],           //   a punch whose target fell goes to the nearest enemy within 2 m of it
    oj_7_4:[ {on:'hit',if:{auto:true,targetUst:{bite:1}},icd:1,do:[{heal:{pct:R(0.004),of:'maxHp'}}]} ],       // Gnaw (at most once a second: the regeneration cap)
    oj_8_2:[ {on:'hit',if:{casting:'punch',targetTeam:'enemy'},do:[{stack:'fury',add:1}]}, {stat:{aspd:R(0.01)},per:'fury'} ],   // Fen Fury
    oj_8_4:[ {on:'out',if:{targetHpBelow:0.5},more:R(0.03)} ],                                                  // Blood in the Water
    oj_9_1:[ {on:'ccHit',if:{casting:GP,cc:['silencedT']},do:[{stack:'gulp',add:1}]},                           // Swallow the Voice: a Gulp for each enemy Gravemaw Pull silences
             {on:'ccHit',if:{casting:'punch',cc:['silencedT'],fn:'gulp5'},do:[{fn:'ext',f:'silencedT',by:1}]} ],//   a Hammer Fists spent with 5 Gulp silences 1 s longer
    oj_9_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                  // Knuckle Through
    oj_10_1:[ {param:'digest',add:R(0.1)} ],                                                                    // Digestion (flurry)
    oj_10_3:[ {on:'out',if:{casting:CD,any:[{targetHas:'roll'},{targetUst:{bite:3}}]},more:R(0.04)} ],         // Rolling Weight
    oj_10_4:[ {stat:{aspd:R(-0.003)},per:{ust:'bite'},to:{team:'enemy',ust:{bite:1}}} ],                        // Many Teeth
    oj_11_2:[ {on:'hit',if:{crit:true,targetTeam:'enemy',targetUst:{bite:1}},do:[{mark:'bb',on:'target',dur:3}]},   // Bone Breaker
              {stat:{armor:R(-0.01)},to:{team:'enemy',has:'bb'}} ],
    oj_11_3:[ {on:'hit',if:{casting:CD,targetTeam:'enemy'},do:[{ustack:'bite',on:'target',add:3}]},            // The Jaws Close: 3 Bite Marks on every enemy it hits
              {on:'land',skill:CD,do:[{fn:'rollOn',on:{team:'enemy',n:1}}]} ],                                  //   and the enemy nearest the landing is caught in a Death Roll
    oj_11_4:[ {on:'death',if:{who:'enemy',unitUst:{bite:1}},do:[{fn:'frenzy'}]} ],                              // Feeding Frenzy
    oj_12_1:[ {on:'gulpSpent',if:{fn:'spent5'},do:[{stack:'gulp',add:R(1)}]} ],                                 // Second Helping
    oj_12_2:[ {param:'ten.sil2',add:R(0.1)} ],                                                                  // Thick Skull
    oj_12_3:[ {on:'teamIn',if:{targetHas:'roll',srcTeam:'ally'},more:R(0.015)} ],                               // Down to the Mud (his whole team: him too)
    oj_12_4:[ {on:'death',if:{who:'enemy',unitHas:'roll'},do:[{heal:{pct:R(0.02),of:'maxHp'}}]} ],              // Fed Well
    oj_13_3:[ {on:'kill',if:{targetHas:'roll'},icd:15,do:[{cd:'blue',set:0},{fn:'crocs'},{ustack:'bite',on:{team:'enemy',within:3},set:6}]},   // Where the Old Crocs Sleep (SIGNATURE)
              {on:'crit',if:{casting:'punch',window:'crocs'},force:true} ],                                     //   all three punches of that Hammer Fists are critical hits
    /* ============================== THE MIREWALL ============================== */
    mw_1_1:[ {on:'teamIn',if:VS_WARD,less:R(0.01),per:{ust:'wb'}} ],                                            // Ward Bond
    mw_1_2:[ {on:'out',if:{targetHas:'co'},more:R(0.02)},                                                       // Who Hit Them
             {on:'skillTgt',skill:HF,do:[{retarget:{team:'enemy',has:'co',order:'near',n:1}}]} ],               //   Hammer Fists goes to the nearest Called Out enemy
    mw_1_4:[ {stat:{atk:R(0.004)},per:UTC} ],                                                                   // Undertow
    mw_2_1:[ {param:'wb.rate',add:R(0.2)} ],                                                                    // Close Company
    mw_2_2:[ {param:'co.dur',add:R(1)} ],                                                                       // Answer for It
    mw_3_1:[ {param:'nomw',add:1} ],                                                                            // Not on My Watch (wards)
    mw_4_2:[ {param:'taunt.co',add:R(0.2)} ],                                                                   // Big Voice (tauntLong)
    mw_n2:[  {param:'dug',add:0.04}, {param:'dug.depth',add:1,req:'sh_1_1'} ],                                  // Dug In Beside Them (LINK: with Set Feet)
    mw_3_4:[ {param:'ut.dur',add:R(0.4)} ],                                                                     // Rising Water
    mw_4_1:[ {on:'tick',period:1,do:[{heal:{pct:R(0.002),of:'tgtMaxHp'},on:{team:'ally',fn:'isWardX'}}]} ],     // Keeper
    mw_5_2:[ {param:'faceme',add:1} ],                                                                          // Face Me (PICK ONE)
    mw_5_3:[ {param:'two',add:1} ],                                                                             // Two Wards (PICK ONE)
    mw_5_4:[ {on:'out',if:{auto:true,fn:'ut10'},more:R(0.05)} ],                                                // Swell
    mw_n1:[  {on:'in',by:'source',once:'wave',less:R(0.06)} ],                                                  // Seen It Coming
    mw_6_3:[ {on:'teamIn',if:VS_WARD,less:R(0.02)} ],                                                           // Wide Shelter (needs Two Wards)
    mw_6_4:[ {on:'wave',do:[{fn:'utOn',by:R(3)}]} ],                                                            // Old Habit
    mw_6_1:[ {param:'mw.cut',add:R(0.01)} ],                                                                    // Steady Arm (mwCut)
    mw_6_2:[ {on:'teamIn',if:{targetHas:'co',srcTeam:'ally'},more:R(0.01)} ],                                   // Fen Justice (his whole team: him too)
    mw_4_3:[ {param:'mw.heal',add:R(0.05)} ],                                                                   // Heavier Share (mwHeal)
    mw_7_1:[ {on:'skillTgt',skill:CD,if:{fn:'wardLow'},do:[{retarget:{team:'ally',fn:'isWardX',n:1}},{fn:'dbtArm'}]},   // Down Beside Them: unaimed, beside a ward below 50%
             {on:'land',skill:CD,do:[{fn:'dbtMark'}]},
             {on:'teamIn',if:{targetHas:'dbt',srcTeam:'enemy'},less:0.10} ],                                    //   and the Wall cuts 10% more on that ward
    mw_7_3:[ {on:'kit',skill:CD,opt:{allyDrDur:{add:R(0.2)}}} ],                                                // Wall of Teeth
    mw_7_4:[ {on:'in',less:R(0.001),per:UTC} ],                                                                 // Deep Current
    mw_8_1:[ {param:'poultice',add:R(0.002)} ],                                                                 // Mud Poultice (wards)
    mw_8_2:[ {on:'in',if:{srcHas:'co'},less:R(0.015)} ],                                                        // No One Else
    mw_8_3:[ {stat:{move:R(0.03)},per:'tw'} ],                                                                  // Stand Guard
    mw_9_2:[ {param:'verdict',add:1},                                                                           // Gravemaw Verdict: it Calls Out every enemy it catches
             {on:'ccHit',if:{casting:GP,cc:['silencedT'],targetHas:'co'},do:[{fn:'ext',f:'silencedT',by:0.5}]},  //   and silences those already Called Out 0.5 s longer
             {on:'cast',skill:GP,do:[{fn:'verdict'}]} ],
    mw_9_3:[ {on:'out',if:{auto:true},more:R(0.03)} ],                                                          // Shield Hand
    mw_9_4:[ {on:'ut10',do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                                                // Flood Tide
    mw_10_1:[ {stat:{atk:R(0.004)},per:{ust:'wb'},to:{team:'ally',fn:'isWardX'}} ],                             // Deep Bond
    mw_10_2:[ {on:'teamHeal',if:{fn:'uWard'},more:R(0.03)} ],                                                   // Spare a Hand
    mw_11_1:[ {on:'teamLethal',if:{fn:'uWard',unitWithin:6},once:'wave',do:[{atOne:'unit'},{fn:'takeHit'}]} ],  // Never Left Behind
    mw_11_2:[ {stat:{atk:R(0.005)},per:{fn:'coSeen'}} ],                                                        // Long Memory (up to 6 enemies)
    mw_11_4:[ {on:'kit',skill:CD,opt:{allyDr:{more:R(0.01)},perLv:{more:R(0.01)}}} ],                           // Wet Season
    mw_12_1:[ {param:'patience',add:R(0.02)} ],                                                                 // Ancient Patience (wards)
    mw_12_2:[ {on:'hit',if:{targetHas:'co',targetTeam:'enemy'},do:[{heal:{pct:R(0.02),of:'hpLost'},on:{team:'ally',fn:'isWardX'}}]} ],   // Score to Settle
    mw_10_3:[ {on:'in',if:{crit:true},less:R(0.02)} ],                                                          // Heavy Hide
    mw_12_4:[ {param:'ut.max',add:R(2)} ],                                                                      // Brimming
    mw_13_2:[ {on:'teamIn',if:{srcTeam:'enemy',fn:'closeTrig'},do:[{fn:'close'}]},                              // Nothing Takes Them Down (SIGNATURE)
              {on:'teamIn',if:{srcTeam:'enemy',window:'close',fn:'tCw'},do:[{fn:'coTaunt'}]} ]
  },
  fn:{
    /* ---- conditions and selectors ---- */
    tWard(A,T,u,c){ return isWard(u,c.tgt); }, uWard(A,T,u,c){ return isWard(u,c.unit); }, isWardX(A,T,u,c){ return isWard(u,c.tgt); },
    tCw(A,T,u,c){ return !!c.tgt&&c.tgt===T.s.cw; },
    wardLow(A,T,u){ const w=u._mwWard; return isWard(u,w)&&w.hp<0.5*w.maxHp; },
    tauntMe(A,T,u,c){ return !!c.tgt&&c.tgt.alive&&c.tgt.forcedTarget===u; },
    held(A,T,u,c){ const x=c.tgt; return !!x&&((x.stunned||0)>0||(x.silencedT||0)>0||!!A.markOf(u,x,'lj')); },
    firstCd(A,T){ return T.s.cdN===1; },
    gulp5(A,T){ return T.s.gs5===true; },
    spent5(A,T,u,c){ return (c.spent||0)>=5; },
    ut10(A,T,u){ return utCount(A,T,u)>=10; },
    coSeen(A,T){ const s=T.s, o=s.coS; return (o&&o.w===s.wave)?Math.min(6,Object.keys(o.ids).length):0; },
    ext(A,T,u,c,a){ ext(A,c.tgt,a.f,a.by); },
    mireT(A,T,u,c){ mire(A,T,u,c.tgt); },
    mireOn(A,T,u,c,a){ for(const x of A.pick(T,u,a.on,c)) mire(A,T,u,x); },
    /* ---- Depth ---- */
    toward(A,T,u){ const s=T.s, E=A.eng(), w=isWard(u,u._mwWard)?u._mwWard:null; let tw=0;
      if(w){ const d=E.dist(u,w); if(s.moved&&s.wP===w&&s.wd!=null&&d<s.wd-1e-6) tw=1; s.wd=d; s.wP=w; } else { s.wd=null; s.wP=null; }
      if(A.stGet(T,'tw')!==tw) A.stSet(T,u,'tw',tw); },
    /* +1 Depth for each second he stands still (Deep Mud: faster), -2 a second while he moves (walks, dashes, is dragged or knocked up; Settled: slower; walking
       toward his ward costs nothing with Dug In Beside Them and Set Feet). Held during his own Croc Drop leap. A stun Rooted halved costs 5 Depth once it has landed */
    depth(A,T,u,c){ const s=T.s, dt=c.dt||0;
      if(s.rp){ if((u.stunned||0)>0&&A.stGet(T,'depth')>=10) A.stSet(T,u,'depth',A.stGet(T,'depth')-5); s.rp=null; }
      if(u._dash&&u._dash.air) return;
      const mv=s.moved||((u.pullT||0)>0&&!!u.pulledBy)||((u._airT||0)>0);
      if(!mv){ s.dl=0; s.da=(s.da||0)+dt*(1+(T.P['depth.rate']||0)); if(s.da>=1){ const n=Math.floor(s.da+1e-9); s.da-=n; A.stSet(T,u,'depth',A.stGet(T,'depth')+n); } return; }
      s.da=0; if(T.P['dug.depth']&&A.stGet(T,'tw')>0) return;
      s.dl=(s.dl||0)+dt*2*Math.max(0,1-(T.P['depth.keep']||0)); if(s.dl>=1){ const n=Math.floor(s.dl+1e-9); s.dl-=n; A.stSet(T,u,'depth',A.stGet(T,'depth')-n); } },
    /* a Croc Drop leap lifts him off his feet: Depth is gone (Plant Again keeps 10% per rank of it, up to half) */
    leap(A,T,u){ const k=Math.min(0.5,T.P.plant||0); A.stSet(T,u,'depth',Math.floor(A.stGet(T,'depth')*k+1e-9)); T.s.da=0; T.s.dl=0; },
    cdCount(A,T){ T.s.cdN=(T.s.cdN||0)+1; },
    /* ---- shorter controls: Unmired (all, up to 20%), Thick Neck and Thick Skull (silences), Rooted Like a Cypress (a stun at 10 Depth: half); all together at most 50% shorter ---- */
    ten(A,T,u,c){ let k=1-Math.min(0.20,T.P['ten.all']||0);
      if(c.field==='silencedT') k*=(1-(T.P['ten.sil']||0))*(1-(T.P['ten.sil2']||0));
      if(c.field==='stunned'&&T.P.rooted&&A.stGet(T,'depth')>=10){ k*=0.5; T.s.rp=1; }
      c.amt*=Math.max(0.5,k); },
    /* ---- Refusal ---- */
    refWave(A,T,u){ A.stSet(T,u,'ref',Math.min(A.stGet(T,'ref'),T.P['ref.keep']||0)); T.s.hts=0; },
    swallow(A,T,u){ const s=T.s; if((s.hts||0)>=(T.r.sh_12_4||0)) return; s.hts=(s.hts||0)+1; for(const f of ['stunned','fearT','silencedT','_sleepT','slow']) if((u[f]||0)>0) u[f]=0; },
    /* c.mv=0 (here and in close): the hit is turned into a heal / moved onto Grosk, not reduced - the 95% ceiling (doc 03 section 15) leaves it at 0 */
    mornHit(A,T,u,c){ const a=Math.max(0,c.amt||0); c.amt=0; c.mv=0; if(a>0) A.eng().healUnit(u,a*0.5); },
    mornEnd(A,T,u){ if(u.alive&&u.hp<0.3*u.maxHp) A.eng().healUnit(u,0.3*u.maxHp-u.hp); },
    /* ---- Mired ---- */
    gpMire(A,T,u,c){ for(const x of caught(A,u,c.o)) mire(A,T,u,x); },
    /* Swallowed Whole: a Mired enemy's own dash or leap is undone - when it ends, the enemy is dragged straight back to where it began */
    dashWatch(A,T,u){ const s=T.s.dw||(T.s.dw={}), E=A.eng();
      for(const x of E.units()){ if(x.team===u.team) continue; const r=s[x.uid];
        if(x.alive&&x._dash&&(!r||r.d!==x._dash)){ s[x.uid]={d:x._dash,x0:x._dash.x0,y0:x._dash.y0,m:!!A.markOf(u,x,'mired')}; continue; }
        if(!r||x._dash===r.d) continue; delete s[x.uid]; if(!x.alive||!r.m) continue;
        const L=Math.hypot(x.x-r.x0,x.y-r.y0)/E.METER(); if(!(L>0.05)) continue;
        A.acts(T,u,[{pull:'target',to:'pt',secs:0.3}],{u,tgt:x,pt:{x:r.x0,y:r.y0,pt:true}}); } },
    /* Spit Out: the Mire of a Mired enemy that dies passes to the living enemy nearest Grosk, for 3 s (Far Spit: longer) */
    spit(A,T,u,c){ const x=A.pick(T,u,{team:'enemy',n:1,skip:'unit'},c)[0]; if(x) mire(A,T,u,x,3+(T.P['spit.dur']||0)); },
    /* ---- Gulp and Hammer Fists ---- */
    gpGulp(A,T,u,c){ const n=caught(A,u,c.o).length; if(n>0) A.stSet(T,u,'gulp',A.stGet(T,'gulp')+n); },
    /* Hammer Fists released: its punches are counted from here; with a Gulp talent every Gulp is spent (its punches read the window 'gs'; Big Swallow, Second
       Helping and Digestion act on it); the Old Crocs' crits are armed for this flurry */
    flurry(A,T,u,c){ const s=T.s; s.pi=0; s.pf=null; s.ptd=(c.o&&c.o.tauntDur)||2; s.gs5=false;
      if(GULP.some(id=>T.r[id])){ const n=A.stGet(T,'gulp'); A.acts(T,u,[{window:'gs',dur:2,n}],c);
        if(n>0){ A.stSet(T,u,'gulp',0); s.gs5=n>=5; if(T.P.digest) A.acts(T,u,[{cd:'blue',add:-T.P.digest*n}],c); A.run(T,u,'gulpSpent',Object.assign({},c,{spent:n})); } }
      if(s.oc){ s.oc=0; A.acts(T,u,[{window:'crocs',dur:1.5}],c); } },
    pIdx(A,T,u,c){ T.s.pi=(T.s.pi||0)+1; T.s.ftb=(c.tgt&&c.tgt.forcedTargetT)||0; },
    /* Death Roll: all three punches of one Hammer Fists landed on the same enemy (Three Bites: the third punch always) */
    pLand(A,T,u,c){ const s=T.s, x=c.tgt; if(!x) return; if(s.pf&&s.pf.t===x) s.pf.n++; else s.pf={t:x,n:1};
      if(s.pf.n===3||(T.P.bites3&&s.pi===3)){ s.pf.n=4; roll(A,T,u,x); } },
    /* Ground and Pound / Big Voice: a punch's fresh taunt lasts longer (once per write: a taunt the punch did not write again is not lengthened again) */
    tauntLong(A,T,u,c){ const x=c.tgt, s=T.s; if(!x||x.forcedTarget!==u) return; const add=(T.P['taunt.add']||0)+(A.markOf(u,x,'co')?(T.P['taunt.co']||0):0); if(!(add>0)) return;
      const t=x.forcedTargetT||0; x.forcedTargetT=(t>(s.ftb||0)+1e-9)?t+add:Math.max(t,(s.ptd||2)+add); },
    rollOn(A,T,u,c,a){ for(const x of A.pick(T,u,a.on,c)) roll(A,T,u,x); },
    /* Drag to the Deep: silenced for the whole Death Roll (a control a talent creates, at most 4 s) */
    deep(A,T,u,c){ const x=c.tgt; if(!x||!x.alive) return; x.silencedT=Math.max(x.silencedT||0,Math.min(4,c.amt||0)); },
    frenzy(A,T,u,c){ const d=c.unit, n=Math.min(T.r.oj_11_4||0,A.ustGet(T,u,d,'bite')); if(!(n>0)) return; const x=A.pick(T,u,{team:'enemy',of:'unit',n:1,skip:'unit'},c)[0];
      if(x) A.acts(T,u,[{ustack:'bite',on:'target',add:n}],Object.assign({},c,{tgt:x})); },
    crocs(A,T){ T.s.oc=1; },
    /* ---- Called Out ---- */
    coSrc(A,T,u,c){ callOut(A,T,u,c.src); },
    coTaunt(A,T,u,c){ const w=T.s.w.close; callOut(A,T,u,c.src,w&&w.t>0?w.t:0.01); },
    verdict(A,T,u,c){ for(const x of caught(A,u,c.o)) callOut(A,T,u,x); },
    /* ---- The Mirewall ---- */
    mwCut(A,T,u,c){ const s=T.s; if(A.winOn(T,'close')&&c.unit&&c.unit===s.cw){ c.amt=1; return; } let v=c.amt+(T.P['mw.cut']||0); if(T.P.two) v*=2/3; c.amt=Math.max(0,Math.min(0.95,v)); },
    mwTake(A,T,u,c){ const s=T.s, E=A.eng();
      if(A.winOn(T,'close')&&c.unit&&c.unit===s.cw) c.amt=0.5; else c.amt*=1-(T.P.dug||0);
      if(UT.some(id=>T.r[id])) utAdd(A,T,u,1);
      if(T.P['dug.depth']&&E.now()>=(s.dugT||0)){ s.dugT=E.now()+1; A.stSet(T,u,'depth',A.stGet(T,'depth')+1); } },
    mwHeal(A,T,u,c){ if(A.winOn(T,'close')&&c.unit&&c.unit===T.s.cw){ c.amt=0; return; } c.amt+=T.P['mw.heal']||0; },
    utOn(A,T,u,c,a){ utAdd(A,T,u,a.by); },
    /* each tick: the closed ward stays his (the signature), his second ward (Two Wards: the next lowest-HP ally), Wardbound on each ward (+1 a second, Close
       Company faster; at 5 Not on My Watch cleanses one control, once per ward each wave; a ward that stops being his loses them, Mud Poultice heals it for
       them), Ancient Patience (the enemy DoTs on his wards tick 2% per rank weaker) */
    wards(A,T,u,c){ const s=T.s, E=A.eng(), dt=c.dt||0;
      if(s.cw&&!(A.winOn(T,'close')&&s.cw.alive)){ if(s.cw!==u._mwWard&&s.cw!==s.w2&&s.cw._mwBy===u) s.cw._mwBy=null; s.cw=null; } if(s.cw) s.cw._mwBy=u;
      if(T.P.two){ const o=s.w2; if(o&&o!==u._mwWard&&o!==s.cw&&o._mwBy===u) o._mwBy=null; let w=null;
        for(const x of E.units()) if(x.alive&&x.team===u.team&&x!==u&&x!==u._mwWard&&(!w||x.hp<w.hp)) w=x; s.w2=w; if(w) w._mwBy=u; }
      const W=wards(T,u);
      if(WB.some(id=>T.r[id])){ const t=s.wbt||(s.wbt={}), rate=1+(T.P['wb.rate']||0), nm=s.nomw||(s.nomw={});
        for(const x of W){ t[x.uid]=(t[x.uid]||0)+dt*rate; while(t[x.uid]>=1){ t[x.uid]-=1; const n=A.ustGet(T,u,x,'wb'); if(n>=5){ t[x.uid]=0; break; } A.ustPut(T,u,x,'wb',n+1);
            if(n+1>=5&&T.P.nomw&&nm[x.uid]!==s.wave){ nm[x.uid]=s.wave; for(const f of ['stunned','fearT','silencedT','_sleepT','slow']) if((x[f]||0)>0){ x[f]=0; break; } } } }
        for(const x of (s.wbL||[])){ if(W.indexOf(x)>=0) continue; const n=A.ustGet(T,u,x,'wb'); if(n>0&&x.alive&&T.P.poultice) E.healUnit(x,x.maxHp*T.P.poultice*n); A.ustPut(T,u,x,'wb',0); delete t[x.uid]; }
        s.wbL=W.slice(); }
      if(T.P.patience){ const k=Math.max(0,1-T.P.patience), L=s.apL||(s.apL=[]);
        for(let i=L.length-1;i>=0;i--){ const e=L[i], d=e[0], x=e[1]; const on=!!(x.dots&&x.dots.indexOf(d)>=0); if(on&&x.alive&&W.indexOf(x)>=0) continue; if(on&&d._talAP){ d.dps/=d._talAP; d._talAP=0; } L.splice(i,1); }
        for(const x of W) if(x.dots) for(const d of x.dots) if(!d._talAP&&d.src&&d.src.team!==x.team&&d.remaining>0){ d._talAP=k; d.dps*=k; L.push([d,x]); } } },
    dbtArm(A,T,u,c){ T.s.dbw=c.tgt||null; },
    dbtMark(A,T,u){ const w=T.s.dbw; T.s.dbw=null; if(w&&w.alive&&(w._mwDrT||0)>0&&w._mwDrSrc===u) A.setMark(T,u,w,'dbt',{dur:w._mwDrT}); },
    /* Never Left Behind: the ward is kept at 1 HP and Grosk takes the killing hit (as it took the ward's HP; his own reductions apply) */
    takeHit(A,T,u,c){ const a=c.amt||0; if(a>0&&u.alive) A.eng().damage(u,a,'#ffb37a',true); },
    /* Nothing Takes Them Down: a hit that would take his ward from 20% or more to below it closes the wall (once every 25 s) */
    closeTrig(A,T,u,c){ const x=c.tgt, s=T.s, E=A.eng(); if(!isWard(u,x)||E.now()<(s.cwT||0)||A.winOn(T,'close')) return false; return x.hp>=0.2*x.maxHp&&(x.hp+(x.shield||0)-(c.amt||0))<0.2*x.maxHp; },
    close(A,T,u,c){ const s=T.s, E=A.eng(), x=c.tgt, a=Math.max(0,c.amt||0); s.cwT=E.now()+25; s.cw=x; x._mwBy=u; A.acts(T,u,[{window:'close',dur:4}],c);
      c.amt=0; c.mv=0; if(a>0) E.damage(u,a*0.5,'#ffb37a',true); utAdd(A,T,u,10); callOut(A,T,u,c.src,4); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/25 - GROSK - talent decisions.md) */
  ruling:{}
};
