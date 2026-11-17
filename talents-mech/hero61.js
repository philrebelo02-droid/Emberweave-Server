/* MORVAYNE (game key 'hero61', hero61.js) - what his learned talents do in a fight (the mechanics; his plain stat talents are read by tools/build_talent_fx.py
   from their sentences, like every other hero's). Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file
   into talents-fx.js. A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   His real kit (the code, not the card wording; a Back-row Support / Healer; his casts are his own code, hero61Cast / hero61Schedule, never _doEffectCore;
   tests/morvayne-kit-facts.js, 21 seeded fights):
   - King's Mercy (green 'kingsMercy', no cooldown): a 1.5 s cast; at the RELEASE the lowest HP share of his side (himself and summons included: on himself 63
     of 322) is healed for 6% + 0.03 point a level of its max HP (8.97% at 100) + 50% of his ability power, x his healing power. He casts it non-stop.
   - Shelter of the Crown (blue 'crownShelter'): a 2.5 s cast, the same pick at the release, 18% + 0.09 point a level (26.91% at 100) + 200% ability power;
     its 8 s cooldown starts at the release.
   - None Shall Fall (ult): a 1.2 s cast; the ally who lost the most HP in the last 2 s (ties: the lowest share) takes no damage at all for 4 s
     (_openGateImmuneUntil; damage() returns at once). One cast stops a mean 4,983 damage.
   - An Open Gate (passive): every living unit of his side has 20 + 2 a level of flat Armor (218 at 100), the strongest copy only, while he lives.
   - A stun or fear on him PAUSES his cast in hand (his think returns before castTick; 0 of 16 stuns cut a cast; press-to-release up to 4.43 s); only a silence
     or his death cancels it. He swings his mace only when he is the last hero of his side alive and above half HP (3 swings in 21 fights).
   Families (WIRING/67 - MORVAYNE - talent decisions.md): Knocks (an ally hit for more than 10% of its max HP), Violet Fire (a heal a second after his heals),
   Unbroken (his casts finished with no control landing on him while he held them), Iron (hits on him), the Evening Bell (a 15 s clock), Last Watch (the last
   hero of his side alive), Met on the Road (the ally farthest from him), Borne (allies who fell, the fight), Answered (what None Shall Fall stopped).
   Caps, stated in the tooltips: DR40 - his damage-reduction talents are ONE product on him, kept share floored at 0.60; ALLY20 - the ones on an ally at 0.80;
   HEAL100 - his "heals are X% stronger" talents together add at most 100%; CC30 - his control shortening at most 30%; CAST - a cast never shorter than
   0.5 s (an instant one aside); SOON25 - None Shall Fall at most 25% sooner; REGEN - his heal-a-second talents at most 1.2% of a unit's max HP a second.
   NO absolute fight time anywhere: every timer is a countdown lowered by the tick's dt. The immunities his talents give are written into the game's own
   field, exactly as his ultimate writes it. State prefix 'mo' (T.s.mo; page fields _moAr, _moMr, _moSwing). */
const R=(x,b)=>({r:x,b:b||0});
const DR_FLOOR=0.60, ALLY_FLOOR=0.80, HEAL_CAP=1.00, CC_FLOOR=0.70, CT_FLOOR=0.5, SOON_CAP=0.25, REGEN=0.012, KN_MAX=3, KN_DUR=6, VF_DUR=4,
  IRON_MAX=10, IRON_DUR=8, BELL_PERIOD=15, BELL_RING=3, LANTERN=3, CAST={green:1.5,blue:2.5,ult:1.2};
/* the families: their bookkeeping runs when one of their talents is learned */
const KNOCK=['oh_1_1','oh_2_1','oh_3_1','oh_4_1','oh_8_1','oh_9_1','oh_10_1','oh_11_1','oh_11_2','oh_13_2','rb_n1'];
const VFF=['oh_2_2','oh_3_4','oh_4_2','oh_6_2','oh_7_2','oh_9_2','oh_11_2','oh_12_2','oh_12_3','oh_13_2'];
const UNB=['oh_4_4','oh_5_1','oh_5_4','oh_7_1','oh_8_4','oh_11_4','oh_12_4'];
const IRON=['ig_1_1','ig_1_2','ig_2_2','ig_3_1','ig_3_2','ig_7_1','ig_8_1','ig_9_1','ig_12_1','ig_12_2','ig_13_3'];
const BELL=['ig_2_3','ig_4_3','ig_7_3','ig_9_3','ig_10_3','ig_11_3','ig_12_3','ig_13_3'];
const GATE=['ig_1_2','ig_2_4','ig_2_3','ig_5_2','ig_6_4','ig_5_1','ig_5_3','ig_6_3','ig_13_3'];
const LW=['ig_4_4','ig_8_4','ig_5_4','ig_7_1','ig_9_4','ig_10_4','ig_12_4'];
const MET=['rb_1_4','rb_n1','rb_2_4','rb_3_4','rb_5_3','rb_6_3','rb_7_3','rb_7_4','rb_8_4','rb_9_4','rb_10_4','rb_12_2'];
const BORNE=['rb_2_3','rb_4_3','rb_10_1','rb_10_2','rb_11_1','rb_12_4','rb_13_3'];
const ANS=['rb_4_1','rb_5_1','rb_7_1','rb_8_1','rb_10_1','rb_12_1','rb_13_3'];
const ULTR=['oh_11_2','oh_12_2','oh_13_2','ig_11_3','ig_13_3','rb_5_2','rb_6_2','rb_6_3','rb_11_3','rb_12_3'].concat(ANS);   // riders on None Shall Fall's protection
const DRG=['oh_5_4','oh_11_1','oh_6_4','ig_3_4','ig_4_4','ig_8_2','ig_7_4','ig_12_2','ig_12_3','rb_1_1','rb_4_3','rb_5_2','rb_8_2','rb_11_4','rb_6_1'];   // DR40 (and the two RISK costs)
const ADRG=['oh_4_1','ig_3_2','ig_8_1','ig_6_1','ig_10_2','rb_2_4'];                                                                                  // ALLY20
const CCG=['oh_1_4','oh_10_4'];
const CTG=['oh_4_4','oh_5_2','oh_7_4','oh_9_1','oh_11_2','oh_13_2','ig_3_1','ig_6_4','ig_11_4','rb_2_2','rb_3_4','rb_6_2','rb_9_4'];                   // his cast times
const HEALM=['oh_1_1','oh_1_3','oh_2_3','oh_3_1','oh_3_4','oh_5_1','oh_5_3','oh_6_1','oh_6_3','oh_6_4','oh_7_1','oh_9_3','oh_11_4','oh_12_1',
  'ig_4_1','ig_9_4','rb_1_4','rb_n1','rb_4_4','rb_6_4','rb_7_3','rb_9_2','rb_9_3'];                                                                   // a heal of his skills changed
const HEALD=VFF.concat(['oh_10_1','oh_12_1','ig_7_3','ig_9_3','rb_7_4','rb_8_4']);                                                                    // a heal of his skills landed
const TGT=['oh_3_1','rb_7_3','rb_5_2','rb_5_3'];
const NRG=['rb_5_4','rb_6_1','rb_12_4','ig_12_4'];
const TICKF=KNOCK.concat(VFF,UNB,IRON,BELL,GATE,LW,MET,ULTR,['oh_12_1']);
/* ---- small readers that need no API ---- */
const rk=(T,id)=>T.r[id]||0;
const has=(T,L)=>L.some(id=>T.r[id]);
const V=T=>T.s.mo||(T.s.mo={k:{}, vf:{}, os:{}, ak:{}, unb:0, pp:null, cut:0, inst:null, sotr:0, iron:0, ironT:0, ironFull:0, bellCd:BELL_PERIOD, bellT:0,
  met:null, lanT:-1, low:0, swf:null, swfCd:0, borne:0, dead:{}, prot:[], immD:4, wtg:0, mug:null, mugT:0, hio:0, ngs:0, lend:0, tt:0, lw:0, gw:[],
  st:{knock:0, full:0, vf:0, vfHeal:0, unb:0, cut:0, iron:0, ironAns:0, ring:0, lw:0, met:0, borne:0, ans:0, ansHeal:0, prot:0, nlo:0, inst:0, door:0, sotr:0,
    bom:0, carter:0, redirect:0, hio:0, ngs:0, tt:0, swing:0, regen:0}});
const ctl=u=>(u.stunned||0)>0||(u.fearT||0)>0||(u.silencedT||0)>0||(u._sleepT||0)>0;
const immune=(E,x)=>(x._openGateImmuneUntil||0)>E.now();
const hero=x=>!!x&&!x._summon&&!(x.t&&x.t.monster);
module.exports={
  hero:'hero61',
  states:{},
  always:[
    {on:'wave',do:[{fn:'waveStart'}]},                                                                   // a new wave: Unhurried Crown, Shield by the Chair, the bell's clock, Met on the Road
    {on:'tick',reqAny:TICKF,do:[{fn:'tk'}]},                                                             // every countdown of his, Unbroken's cuts, Last Watch, Met on the Road, An Open Gate's extra
    {on:'num',reqAny:CTG.concat(['rb_5_3']),do:[{fn:'numF'}]},                                          // his cast times (page site h61ct:<slot>), None Shall Fall's length (h61imm)
    {on:'skillTgt',reqAny:TGT,do:[{fn:'tgtF'}]},                                                         // whom his heals and his ultimate go to (page site in hero61Cast's release)
    {on:'part',do:[{fn:'relF'}]},                                                                        // a cast of his released (page site partPre/part 'h61green' / 'h61blue' / 'h61ult')
    {on:'cd',reqAny:['oh_5_2','oh_5_3'],do:[{fn:'cdF'}]},                                                // Shelter of the Crown's cooldown (page site)
    {on:'healOut',reqAny:HEALM.concat(UNB),do:[{fn:'healMod'}]},                                         // his heals made stronger (HEAL100)
    {on:'healed',reqAny:HEALD,do:[{fn:'healedF'}]},                                                      // his heals landed: Violet Fire, energy, Carter's Coat, Bell of Mercy
    {on:'in',reqAny:DRG,do:[{fn:'myIn'}]},                                                               // hits on him: DR40 and the RISK costs
    {on:'teamIn',reqAny:ADRG.concat(KNOCK,ANS,['ig_13_3']),do:[{fn:'tIn'}]},                             // hits on his side: Knocks, ALLY20, Answered, the signature's quarter
    {on:'hurt',reqAny:IRON,do:[{fn:'hurtF'}]},                                                           // a hit on him landed: Iron, Iron Answer
    {on:'out',reqAny:['ig_4_4','ig_7_1','rb_10_2'],do:[{fn:'outF'}]},                                    // his own hits (Last Watch, his mace)
    {on:'death',reqAny:BORNE.concat(MET),do:[{fn:'deathF'}]},                                           // an ally of his falls: Borne, Open Road
    {on:'die',reqAny:GATE,do:[{fn:'dieF'}]},                                                             // he falls: An Open Gate's extra goes with him
    {on:'teamLethal',reqAny:['rb_13_3'],do:[{fn:'ttF'}]},                                                // This Time
    {on:'ccIn',reqAny:CCG,do:[{fn:'ccK'}]},                                                              // CC30
    {stat:{heal:0.0001},per:{fn:'healN'},reqAny:['rb_2_3','rb_13_3']},                                   // Borne Inside, This Time's lent healing power
    {stat:{hp:0.0001},per:{fn:'hpN'},reqAny:['rb_11_1']},                                                // Coat Clasp
    {stat:{nrg:0.0001},per:{fn:'nrgN'},reqAny:NRG},                                                      // SOON25 and The Watch Holds
    {stat:{move:0.0001},to:{team:'ally'},per:{fn:'farN'},reqAny:['rb_6_3']}                              // Far Gate: the protected ally moves faster
  ],
  talents:{
    /* ============================== THE OPEN HALL ============================== */
    oh_1_1:[ {param:'knock',add:R(0.02)} ],                     // A Small Knock: Knocks; +2%/rank a Knock on his heals on them (HEAL100)
    oh_1_4:[ {param:'bp',add:R(0.05)} ],                        // Black Plate (CC30)
    oh_2_3:[ {param:'shel',add:R(0.03)} ],                      // Hall Light
    oh_2_1:[ {param:'knDur',add:R(1)} ],                        // Heard Through Iron
    oh_2_2:[ {param:'vf',add:R(0.01)} ],                        // Seams of Fire: Violet Fire 1%/rank of the heal a second, 4 s (REGEN)
    oh_3_1:[ {param:'door',add:1} ],                            // Open Door (tgtF, healMod)
    oh_1_3:[ {param:'merc',add:R(0.02)} ],                      // Merciful Hand
    oh_3_4:[ {param:'stew',add:R(0.02)} ],                      // Steward's Care (HEAL100)
    oh_4_1:[ {param:'pet',add:R(0.01)} ],                       // Petitioner's Due (ALLY20)
    oh_4_2:[ {param:'vfDur',add:R(1)} ],                        // Slow Burning
    oh_4_4:[ {param:'unb',add:R(0.015)} ],                      // Steady Hands (renamed Even Hands): Unbroken, 1.5%/rank faster casts a stack
    oh_5_1:[ {param:'grain',add:R(0.01)} ],                     // Grain and Axles
    oh_5_2:[ {param:'mf',add:1} ],                              // Mercy First (locks Shelter First)
    oh_5_3:[ {param:'sf',add:1} ],                              // Shelter First (locks Mercy First)
    oh_5_4:[ {param:'calm',add:R(0.01)} ],                      // Calm Ruler (DR40)
    oh_6_1:[ {param:'ear',add:R(0.02)} ],                       // Open Ear (HEAL100)
    oh_6_2:[ {param:'qm',add:R(0.5)} ],                         // Quick Mercy
    oh_6_3:[ {param:'great',add:R(0.04)} ],                     // Great Shelter
    oh_6_4:[ {param:'sleep',add:R(0.03)}, {param:'risk',add:R(0.03)} ],   // Sleepless King (RISK)
    oh_7_1:[ {param:'fair',add:R(0.004)} ],                     // Fair Hearing (HEAL100)
    oh_7_2:[ {param:'fits',add:1} ],                            // Fire in the Seams
    oh_7_4:[ {param:'shelCt',add:R(0.05)} ],                    // Measured Breath
    oh_8_1:[ {param:'knMax',add:R(1)} ],                        // Every Voice Reaches
    oh_8_4:[ {param:'unbMax',add:R(1)} ],                       // Not Rushed
    oh_9_1:[ {param:'atk',add:1} ],                             // Answer the Knock
    oh_9_2:[ {param:'spread',add:R(0.03)} ],                    // Spreading Fire
    oh_9_3:[ {param:'patient',add:R(0.03)} ],                   // Patient Mercy
    oh_10_1:[ {param:'hnc',add:R(1)} ],                         // Hall Never Closed
    oh_10_4:[ {param:'hls',add:R(0.10)} ],                      // Hands Like Stone (CC30)
    oh_11_1:[ {param:'listen',add:R(0.015)} ],                  // A King Who Listens (DR40)
    oh_11_2:[ {param:'mug',add:1} ],                            // Mercy Under the Gate
    oh_11_4:[ {param:'reign',add:R(0.003)} ],                   // Reign of Mercy (HEAL100)
    oh_12_1:[ {param:'oldSeal',add:R(0.03)} ],                  // Old Seal Kept (HEAL100)
    oh_12_2:[ {param:'burn',add:R(0.03)} ],                     // Burning Mercy
    oh_12_3:[ {param:'cy',add:R(1)} ],                          // Crowned Young
    oh_12_4:[ {param:'uc',add:R(1)} ],                          // Unhurried Crown
    oh_13_2:[ {param:'hio',add:1} ],                            // The Hall Is Open (signature)
    /* ============================== THE IRON GATE ============================== */
    ig_1_1:[ {param:'chair',add:R(1)} ],                        // Shield by the Chair
    ig_1_2:[ {param:'ironG',add:R(0.01)} ],                     // Iron Shield: Iron; +1%/rank An Open Gate's Armor an Iron
    ig_2_4:[ {param:'pm',add:R(0.04)} ],                        // Plate and Mail
    ig_2_2:[ {param:'cold',add:R(2)} ],                         // Cold Iron
    ig_2_3:[ {param:'bell',add:R(0.04)} ],                      // The Evening Bell
    ig_3_1:[ {param:'unmoved',add:R(0.002)} ],                  // Unmoved (renamed Rooted at the Gate)
    ig_3_2:[ {param:'hammer',add:1} ],                          // Hammered Gate (ALLY20)
    ig_3_4:[ {param:'ward',add:R(0.01)} ],                      // Ward Rule (DR40)
    ig_4_1:[ {param:'shel',add:R(0.03)} ],                      // Shelter Wall
    ig_4_3:[ {param:'btb',add:R(1)} ],                          // Before the Bell
    ig_4_4:[ {param:'lwDr',add:R(0.02)}, {param:'lwDmg',add:R(0.04)} ],   // Last Watch (DR40)
    ig_8_4:[ {param:'lwSwing',add:R(1)} ],                      // Long Watch (renamed The Late Watch): page field _moSwing
    ig_5_2:[ {param:'walls',add:R(0.015)} ],                    // Strong Walls
    ig_5_4:[ {param:'still',add:R(0.005)} ],                    // Still Standing (renamed Still at the Gate; REGEN)
    ig_8_2:[ {param:'raider',add:R(0.01)} ],                    // Raider Hills (DR40)
    ig_6_4:[ {param:'heavyCt',add:R(0.04)}, {param:'heavy',add:R(0.03)} ],   // Heavy Plate (RISK)
    ig_7_1:[ {param:'mir',add:R(0.04)} ],                       // Mace in Reach
    ig_7_3:[ {param:'bom',add:1} ],                             // Bell of Mercy
    ig_7_4:[ {param:'wallsHold',add:R(0.01)} ],                 // Walls Hold (DR40)
    ig_8_1:[ {param:'bulw',add:R(0.02)} ],                      // Iron Bulwark (ALLY20)
    ig_5_1:[ {param:'ctg',add:1} ],                             // Close the Gate (locks Open the Gate)
    ig_9_3:[ {param:'ring',add:R(0.02)} ],                      // Ringing Mercy
    ig_5_3:[ {param:'otg',add:1} ],                             // Open the Gate (locks Close the Gate)
    ig_9_1:[ {param:'ia',add:1} ],                              // Iron Answer
    ig_6_1:[ {param:'shoulder',add:R(0.02)} ],                  // Shoulder Guard (renamed At His Shoulder; ALLY20)
    ig_9_4:[ {param:'alone',add:R(0.03)} ],                     // King Alone (HEAL100)
    ig_6_3:[ {param:'wide',add:R(0.02)} ],                      // Wide Doors: 2 points a rank
    ig_10_2:[ {param:'banner',add:R(0.005)} ],                  // Banner Companies (ALLY20)
    ig_10_3:[ {param:'longBell',add:R(0.3)} ],                  // Long Bell
    ig_10_4:[ {param:'never',add:R(0.05)} ],                    // Never Again
    ig_11_3:[ {param:'bbd',add:1} ],                            // Bell Before Dark
    ig_11_4:[ {param:'shelCt',add:R(0.05)} ],                   // Night Patrol
    ig_12_1:[ {param:'ironMax',add:R(1)} ],                     // Iron Hands
    ig_12_2:[ {param:'rim',add:R(0.002)} ],                     // Shield Rim (DR40)
    ig_12_3:[ {param:'bellIron',add:R(0.01)} ],                 // Bell Iron (DR40)
    ig_12_4:[ {param:'twh',add:R(0.10)} ],                      // The Watch Holds
    ig_13_3:[ {param:'ngs',add:1} ],                            // No Gate Shut Again (signature)
    /* ============================== THE ROAD BEFORE THE BELL ============================== */
    rb_1_1:[ {param:'sealHand',add:R(0.02)} ],                  // Seal in Hand (DR40)
    rb_2_2:[ {param:'mercCt',add:R(0.03)} ],                    // Watched Road
    rb_1_4:[ {param:'met',add:R(0.02)} ],                       // Out Before the Bell: Met on the Road (HEAL100)
    rb_n1:[ {param:'heard',add:0.03} ],                         // Heard From the Road (LINK: +1 Knock with A Small Knock)
    rb_2_3:[ {param:'borneHeal',add:R(0.02)} ],                 // Borne Inside
    rb_2_4:[ {param:'farRoad',add:R(0.01)} ],                   // Long Road (renamed Far Road; ALLY20)
    rb_4_1:[ {param:'ans',add:R(0.04)} ],                       // Fire Answers: Answered
    rb_4_4:[ {param:'shel',add:R(0.02)} ],                      // Cart Upright
    rb_4_3:[ {param:'coat',add:R(0.01)} ],                      // Heavy Coat (DR40)
    rb_3_4:[ {param:'hsa',add:1} ],                             // Hands Sent Ahead
    rb_5_1:[ {param:'loud',add:R(0.02)} ],                      // Loud Answer
    rb_5_2:[ {param:'wtg',add:1} ],                             // Watch the Gate (locks Guard the Cart; DR40)
    rb_5_3:[ {param:'gtc',add:1} ],                             // Guard the Cart (locks Watch the Gate)
    rb_5_4:[ {param:'soon',add:R(0.01)} ],                      // Kept Faith (SOON25)
    rb_6_2:[ {param:'nearGate',add:R(0.04)} ],                  // Near Gate
    rb_6_3:[ {param:'far',add:R(0.05)} ],                       // Far Gate
    rb_6_4:[ {param:'wardens',add:R(0.01)} ],                   // Road Wardens (HEAL100)
    rb_6_1:[ {param:'risk',add:R(0.03)}, {param:'soon',add:R(0.03)} ],   // Grain for Guards (RISK; SOON25)
    rb_7_1:[ {param:'afire',add:R(0.02)} ],                     // Answering Fire
    rb_8_2:[ {param:'patience',add:R(0.01)} ],                  // Iron Patience (renamed Carter's Patience; DR40)
    rb_7_3:[ {param:'sotr',add:1} ],                            // Shelter on the Road
    rb_7_4:[ {param:'carter',add:R(0.03)} ],                    // Carter's Coat
    rb_8_1:[ {param:'told',add:R(1)} ],                         // Told the Watch
    rb_9_3:[ {param:'roadShel',add:R(0.02)} ],                  // Road Shelter
    rb_8_4:[ {param:'petition',add:R(1)} ],                     // Second Petition
    rb_9_2:[ {param:'merc',add:R(0.02)} ],                      // Night Road
    rb_9_4:[ {param:'swf',add:1} ],                             // She Will Find Him
    rb_10_1:[ {param:'fireRem',add:R(0.03)} ],                  // Fire Remembers
    rb_10_2:[ {param:'notForg',add:R(0.03)} ],                  // Not Forgiven
    rb_10_4:[ {param:'lantern',add:R(1)} ],                     // Lantern on the Road
    rb_11_1:[ {param:'clasp',add:R(0.01)} ],                    // Coat Clasp
    rb_11_3:[ {param:'nlo',add:1} ],                            // None Left Outside
    rb_11_4:[ {param:'raids',add:R(0.015)} ],                   // Raids Not Ended (DR40)
    rb_12_1:[ {param:'va',add:R(0.04)} ],                       // Violet Answer
    rb_12_2:[ {param:'openRoad',add:R(0.05)} ],                 // Open Road
    rb_12_3:[ {param:'lastCart',add:R(0.1)} ],                  // Last Cart In
    rb_12_4:[ {param:'fsk',add:R(0.02)} ],                      // First Seal Kept (SOON25)
    rb_13_3:[ {param:'tt',add:1} ]                              // This Time (signature)
  },
  fn:{
    /* ---- who is who ---- */
    side(A,T,u){ const E=A.eng(), out=[]; for(const x of E.units()) if(x.alive&&x.team===u.team&&!x._dropHidden&&!(x._riseT>0)) out.push(x); return out; },   // the units his heals can reach (hero61.js allies)
    mates(A,T,u){ return T.fn.side(A,T,u).filter(x=>x!==u&&hero(x)); },                                                                                      // his allies: heroes of his side, not him
    gap(A,u,x){ const E=A.eng(); return (E.dist(u,x)-E.bodyR(u)-E.bodyR(x))/E.METER(); },                                                                    // body to body, metres
    weakest(A,T,u,skip){ let b=null; for(const x of T.fn.side(A,T,u)){ if(x===skip) continue; if(!b||x.hp/Math.max(1,x.maxHp)<b.hp/Math.max(1,b.maxHp)) b=x; } return b; },   // the game's own pick
    nearestTo(A,T,u,x,L){ let b=null,bd=1e18; for(const y of (L||T.fn.mates(A,T,u).concat(hero(u)?[u]:[]))){ if(y===x) continue; const d=T.fn.gap(A,x,y); if(d<bd){ bd=d; b=y; } } return b; },
    farthest(A,T,u){ let b=null,bd=-1; for(const x of T.fn.mates(A,T,u)){ const d=T.fn.gap(A,u,x); if(d>bd){ bd=d; b=x; } } return b; },
    alone(A,T,u){ const E=A.eng(); for(const x of E.units()) if(x.alive&&x.team===u.team&&x!==u&&hero(x)) return false; return true; },   // the last hero of his side standing (hero61.js canAttack's count)
    knN(A,T,u,x){ const v=V(T); const r=x&&v.k[x.uid]; let n=r&&r.t>0?r.n:0; if(T.P.heard&&T.r.oh_1_1&&x&&x===v.met) n=Math.min(T.fn.knMax(A,T),n+1); return n; },   // Heard From the Road's LINK: 1 more
    knMax(A,T){ return KN_MAX+(T.P.knMax||0); },
    knAdd(A,T,u,x,n){ const v=V(T), P=T.P; if(!x||x===u||!hero(x)) return; const mx=T.fn.knMax(A,T); const r=v.k[x.uid]||(v.k[x.uid]={n:0,t:0});
      if(!(r.t>0)) r.n=0; const was=r.n; r.n=n==='max'?mx:Math.min(mx,r.n+(n||1)); r.t=KN_DUR+(P.knDur||0); if(r.n>was) v.st.knock+=r.n-was;
      if(r.n>=mx&&was<mx){ v.st.full++; if(P.atk) v.ak[x.uid]=1; } },                                                                        // Answer the Knock: full Knocks
    anyKnock(A,T,u){ const v=V(T); for(const k in v.k){ const r=v.k[k]; if(r.t>0&&r.n>0) return true; } return !!(T.P.heard&&T.r.oh_1_1&&v.met&&v.met.alive); },
    vfOn(A,T,x){ const r=V(T).vf[x.uid]; return !!(r&&r.t>0&&r.r>0); },
    vfPut(A,T,u,x,rate,dur){ const v=V(T); if(!x||!x.alive||!(rate>0)||!(dur>0)) return; const r=v.vf[x.uid]||(v.vf[x.uid]={u:x,r:0,t:0,cy:0});
      if(!(r.t>0)){ r.r=0; r.cy=0; } r.r=Math.max(r.r,rate); r.t=Math.max(r.t,dur); r.u=x; v.st.vf++; },
    unbMax(A,T){ return 5+(T.P.unbMax||0); },
    ironMax(A,T){ return IRON_MAX+(T.P.ironMax||0); },
    ironAdd(A,T,u,n){ const v=V(T), P=T.P; if(!has(T,IRON)) return; const mx=T.fn.ironMax(A,T); v.iron=Math.min(mx,v.iron+(n||1)); v.ironT=IRON_DUR+(P.cold||0); v.st.iron++; if(v.iron>=mx) v.ironFull=1; },
    ringing(A,T){ return V(T).bellT>0; },
    protOf(A,T,x){ const v=V(T); for(const p of v.prot) if(p.x===x&&p.left>0) return p; return null; },
    protect(A,T,u,x,d,kind,x2){ const E=A.eng(), v=V(T); if(!x||!x.alive) return null; if(kind!=='nsf') x._openGateImmuneUntil=Math.max(x._openGateImmuneUntil||0,E.now()+d);   // the game's own field, as his ultimate writes it
      const p={x,left:d,bank:0,kind,x2:!!x2}; v.prot.push(p); v.st.prot++; return p; },
    /* ---- A NEW WAVE: Unhurried Crown, Shield by the Chair, the bell's clock again, Met on the Road picked again; his talents' own immunities and windows end
       (the game ends its own buffs and controls at the wave change) ---- */
    waveStart(A,T,u){ const v=V(T), P=T.P; T.s.api=A;
      if(P.uc) v.unb=Math.max(v.unb,Math.min(T.fn.unbMax(A,T),P.uc));
      if(P.chair&&has(T,IRON)){ v.iron=Math.max(v.iron,Math.min(T.fn.ironMax(A,T),P.chair)); v.ironT=IRON_DUR+(P.cold||0); if(v.iron>=T.fn.ironMax(A,T)) v.ironFull=1; }
      v.bellCd=Math.max(1,BELL_PERIOD-(P.btb||0)); v.bellT=0; v.met=null; v.lanT=-1; v.low=0; v.swf=null; v.inst=null;
      for(const p of v.prot) if(p.kind!=='nsf'&&p.x) p.x._openGateImmuneUntil=0; v.prot=[]; v.wtg=0; v.mug=null; v.mugT=0; v.hio=0; v.ngs=0; v.lend=0; },
    /* ---- EVERY TICK ---- */
    tk(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), dt=c.dt||0; T.s.api=A; if(!u.alive) return;
      /* countdowns */
      for(const f of ['ironT','bellT','swfCd','wtg','mugT','hio','ngs','lend']) if(v[f]>0) v[f]=Math.max(0,v[f]-dt);
      if(v.iron>0&&!(v.ironT>0)){ v.iron=0; v.ironFull=0; }
      if(v.mug&&!(v.mugT>0)) v.mug=null;
      for(const k in v.k){ const r=v.k[k]; if(r.t>0){ r.t-=dt; if(r.t<=0){ r.t=0; r.n=0; } } }
      for(const k in v.os) if(v.os[k]>0) v.os[k]=Math.max(0,v.os[k]-dt);
      /* the Evening Bell: every 15 s (Before the Bell sooner), rings 3 s (Long Bell longer) */
      if(has(T,BELL)){ v.bellCd-=dt; if(v.bellCd<=0){ v.bellCd+=Math.max(1,BELL_PERIOD-(P.btb||0)); v.bellT=Math.max(v.bellT,BELL_RING+(P.longBell||0)); v.st.ring++; } }
      /* Unbroken: a cast in hand is cut when a stun, fear, silence or sleep lands on him while he holds it (a stun only pauses it in the game) */
      if(has(T,UNB)){ const p=u._pend;
        if(v.pp&&p!==v.pp){ if(ctl(u)&&!v.cut){ v.unb=0; v.st.cut++; } v.cut=0; }
        if(p&&p!==v.pp) v.cut=0;
        if(p&&ctl(u)&&!v.cut){ v.cut=1; v.unb=0; v.st.cut++; }
        v.pp=p||null; }
      /* the protections of None Shall Fall (his casts, None Left Outside, This Time): their end, Answered, None Left Outside */
      for(let i=0;i<v.prot.length;i++){ const p=v.prot[i]; p.left-=dt; if(p.left>1e-9) continue; v.prot.splice(i--,1); T.fn.protEnd(A,T,u,p); }
      /* Last Watch */
      if(has(T,LW)){ const al=T.fn.alone(A,T,u); if(al&&!v.lw){ v.st.lw++; if(P.never){ u.shield=(u.shield||0)+P.never*(u.maxHp||0); u.shieldT=Math.max(u.shieldT||0,8); } } v.lw=al?1:0;
        if(P.lwSwing){ const th=P.lwSwing>=2?0:0.25; u._moSwing=(al&&u.hp>u.maxHp*th)?1:0; } }
      /* Met on the Road: the ally farthest from him; it stays theirs until they fall or are healed above 70%, then moves 3 s later (Lantern on the Road sooner) */
      if(has(T,MET)){ if(!v.met||!v.met.alive||v.met.team!==u.team){ v.met=T.fn.farthest(A,T,u); v.lanT=-1; v.low=0; if(v.met) v.st.met++; }
        else if(v.met.hp>0.70*v.met.maxHp){ if(v.lanT<0) v.lanT=Math.max(0,LANTERN-(P.lantern||0)); else v.lanT-=dt; if(v.lanT<=1e-9){ const n=T.fn.farthest(A,T,u); if(n!==v.met){ v.met=n; v.low=0; v.st.met++; } v.lanT=-1; } }
        else v.lanT=-1;
        if(P.swf&&v.met){ const lo=v.met.hp<0.25*v.met.maxHp; if(lo&&!v.low&&!(v.swfCd>0)){ v.swf=v.met; v.swfCd=10; } v.low=lo?1:0; } }
      /* REGEN: his heal-a-second talents on a unit together at most 1.2% of its max HP a second (Violet Fire, Still Standing) */
      const room={}, give=(x,a)=>{ if(!x.alive||!(a>0)) return 0; const k=x.uid; if(room[k]==null) room[k]=REGEN*(x.maxHp||0)*dt; const h=Math.min(room[k],a); if(!(h>0)) return 0; room[k]-=h; E.healUnit(x,h); v.st.regen+=h; return h; };
      if(P.still&&v.lw) give(u,P.still*(u.maxHp||0)*dt);
      for(const k in v.vf){ const r=v.vf[k], x=r.u; if(!(r.t>0)) { delete v.vf[k]; continue; } if(!x.alive){ delete v.vf[k]; continue; }
        v.st.vfHeal+=give(x,r.r*dt); r.t-=dt;
        if(r.t<=1e-9){ if(P.cy&&!r.cy&&x.hp<0.5*x.maxHp){ r.cy=1; r.t=P.cy; } else delete v.vf[k]; } }       // Crowned Young: it burns on once, under half health
      /* An Open Gate's extra (page fields _moAr / _moMr, read where the game adds the aura's Armor) */
      if(has(T,GATE)) T.fn.gate(A,T,u); },
    /* An Open Gate's Armor and magic resist from his talents, on each unit of his side that holds it: Iron Shield (an Iron), Strong Walls, Heavy Plate, the
       Evening Bell (and half of it as magic resist), the signature (doubled), Close the Gate (+20% him and his nearest ally, -20% the rest), Plate and Mail
       (him: 4%/rank as magic resist), Open the Gate (5% + 2 points/rank Wide Doors as magic resist) */
    gate(A,T,u){ const v=V(T), P=T.P, lv=Math.max(1,(u.skillLv&&u.skillLv[3])|0), g=(u.pass&&u.pass.openGate)?20+2*(lv-1):0, L=g>0?T.fn.side(A,T,u):[], seen=[];
      const ring=v.bellT>0, m=(1+(P.ironG||0)*v.iron+(P.walls||0)+(P.heavy||0)+(ring?(P.bell||0):0))*(v.ngs>0?2:1), nr=P.ctg?T.fn.nearestTo(A,T,u,u,T.fn.mates(A,T,u)):null;
      for(const x of L){ const cg=P.ctg?((x===u||x===nr)?1.2:0.8):1, a=g*m*cg, ar=a-g;
        const mr=(x===u?(P.pm||0)*a:0)+(ring&&P.bell?0.5*a:0)+(P.otg?(0.05+(P.wide||0))*a:0);
        if(x._moAr!==ar) x._moAr=ar; if(x._moMr!==mr) x._moMr=mr; seen.push(x); }
      for(const x of v.gw) if(seen.indexOf(x)<0){ x._moAr=0; x._moMr=0; } v.gw=seen; },
    dieF(A,T,u){ const v=V(T); for(const x of v.gw){ x._moAr=0; x._moMr=0; } v.gw=[]; },
    /* ---- HIS CAST TIMES (page num 'h61ct:<slot>'), None Shall Fall's length ('h61imm') ---- */
    numF(A,T,u,c){ const v=V(T), P=T.P, sk=c.skill;
      if(sk==='h61imm'){ if(P.gtc) c.amt+=0.5; v.immD=c.amt; return; }
      if(typeof sk!=='string'||sk.slice(0,6)!=='h61ct:') return; const slot=sk.slice(6); let ct=c.amt; if(!(ct>0)) return;
      const x=slot==='ult'?c.unit:T.fn.pick(A,T,u,slot).x; v.inst=null;
      if(slot!=='ult'&&x&&((P.atk&&v.ak[x.uid])||(P.swf&&v.swf===x)||v.hio>0)){ v.inst={slot,x}; v.st.inst++; c.amt=0; return; }   // Answer the Knock, She Will Find Him, The Hall Is Open: no cast
      let flat=0, fast=0, slow=0;
      if(slot==='green'){ if(P.mf) flat+=0.3; flat+=P.mercCt||0; if(P.hsa&&x&&x===v.met) flat+=0.5; }
      if(slot==='blue') flat+=P.shelCt||0;
      if(P.unb) fast+=P.unb*v.unb;
      if(slot!=='ult'&&P.unmoved) fast+=P.unmoved*v.iron;
      if(P.nearGate&&v.wtg>0) fast+=P.nearGate;
      if(P.heavyCt) slow+=P.heavyCt;
      ct=(ct-flat)/(1+fast)*(1+slow);
      if(slot!=='ult'&&P.mug&&v.mug&&x===v.mug) ct/=1.5;                                                       // Mercy Under the Gate: 50% faster on them
      c.amt=Math.max(CT_FLOOR,ct); },
    /* whom a heal of his goes to: the game's pick (the lowest share), Open Door (the most Knocks first), Shelter on the Road (the ally Met on the Road below half) */
    pick(A,T,u,slot){ const v=V(T), P=T.P, w=T.fn.weakest(A,T,u);
      if(slot==='green'&&P.door){ let b=null,bn=0; for(const x of T.fn.side(A,T,u)){ const n=T.fn.knN(A,T,u,x); if(n>bn||(n===bn&&n>0&&b&&x.hp/Math.max(1,x.maxHp)<b.hp/Math.max(1,b.maxHp))){ b=x; bn=n; } } if(b) return {x:b,door:1}; }
      if(slot==='blue'&&P.sotr&&v.met&&v.met.alive&&v.met.hp<0.5*v.met.maxHp) return {x:v.met,sotr:1};
      return {x:w}; },
    tgtF(A,T,u,c){ const v=V(T), P=T.P, sk=c.skill;
      if(sk==='h61green'||sk==='h61blue'){ const q=T.fn.pick(A,T,u,sk.slice(3)); if(q.x){ c.tgt=q.x; if(q.door) v.st.door++; } v.sotr=q.sotr?1:0; if(q.sotr) v.st.sotr++; return; }
      if(sk==='h61ult'){ if(P.wtg){ const w=T.fn.weakest(A,T,u); if(w) c.tgt=w; } else if(P.gtc&&v.met&&v.met.alive) c.tgt=v.met; } },
    cdF(A,T,u,c){ const P=T.P; if(c.slot!=='blue') return; c.amt=Math.max(0,c.amt+(P.mf?2:0)-(P.sf?2:0)); },
    /* ---- A CAST OF HIS RELEASED ---- */
    relF(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), sk=c.skill, x=c.tgt; if(sk!=='h61green'&&sk!=='h61blue'&&sk!=='h61ult') return;
      const slot=sk.slice(3);
      if(has(T,UNB)){ if(!v.cut){ const was=v.unb; v.unb=Math.min(T.fn.unbMax(A,T),v.unb+1); if(v.unb>was) v.st.unb++; } v.cut=0; v.pp=null; }
      if(v.inst&&v.inst.slot===slot){ const y=v.inst.x; v.inst=null; u._h61Rec=Math.max(u._h61Rec||0,0.5*CAST[slot]);   // an instant heal: the next cast follows after half his usual cast time
        if(y){ delete v.ak[y.uid]; if(v.swf===y) v.swf=null; } }
      v.sotr=0;
      if(slot==='green'&&P.hsa&&x&&x===v.met) A.acts(T,u,[{cleanse:1,on:'target'}],{u,tgt:x});                // Hands Sent Ahead
      if(slot!=='ult'||!x||!x.alive||x.team!==u.team) return;
      /* None Shall Fall: its protection and riders */
      const d=v.immD||4; v.immD=4; T.fn.protect(A,T,u,x,d,'nsf');
      if(P.wtg) v.wtg=d;
      if(P.mug){ v.mug=x; v.mugT=d; T.fn.knAdd(A,T,u,x,'max'); T.fn.vfPut(A,T,u,x,0.01*(1+(P.burn||0))*(x.maxHp||0),d); }
      if(P.bbd) v.bellT=Math.max(v.bellT,d);
      if(P.hio){ v.hio=8; v.st.hio++; for(const y of T.fn.mates(A,T,u)) T.fn.knAdd(A,T,u,y,'max'); for(const y of T.fn.side(A,T,u)) if(hero(y)) T.fn.vfPut(A,T,u,y,0.01*(y.maxHp||0),8); }
      if(P.ngs&&v.iron>=T.fn.ironMax(A,T)){ v.ngs=8; v.bellT=Math.max(v.bellT,8); v.st.ngs++; } },
    /* a protection ends: Answered (shared out among the rest of his side), None Left Outside */
    protEnd(A,T,u,p){ const v=V(T), P=T.P, E=A.eng();
      const rate=p.x2?2*Math.max(P.ans||0,0.04):(P.ans||0);
      if(rate>0&&p.bank>0){ const L=T.fn.side(A,T,u).filter(y=>y!==p.x&&hero(y)); if(L.length){ const tot=p.bank*rate*(1+(P.loud||0))*(1+(P.fireRem||0)*v.borne), each=tot/L.length;
          let lo=null; for(const y of L) if(!lo||y.hp/Math.max(1,y.maxHp)<lo.hp/Math.max(1,lo.maxHp)) lo=y; v.st.ans++;
          for(const y of [lo].concat(L.filter(z=>z!==lo))){ const h0=y.hp; E.healUnit(y,each*(y===lo?1+(P.va||0):1)); v.st.ansHeal+=y.hp-h0;
            if(P.afire){ y.shield=(y.shield||0)+P.afire*(y.maxHp||0); y.shieldT=Math.max(y.shieldT||0,3); }
            if(P.told){ if(P.told>=2) A.acts(T,u,[{cleanse:1,on:'target'}],{u,tgt:y}); else if((y.stunned||0)>0) y.stunned=0; } } } }
      if(p.kind==='nsf'&&P.nlo){ const n=T.fn.weakest(A,T,u,p.x); const nh=n&&hero(n)?n:null; if(nh){ T.fn.protect(A,T,u,nh,1.5+(P.lastCart||0),'nlo'); v.st.nlo++; } } },
    /* ---- HIS HEALS: HEAL100 (his "X% stronger" talents together at most +100%), each skill's own "heals X% more", Grain and Axles ---- */
    healMod(A,T,u,c){ const v=V(T), P=T.P, sk=c.skill, x=c.tgt; if((sk!=='h61green'&&sk!=='h61blue')||!x) return;
      const share=x.hp/Math.max(1,x.maxHp); let amt=c.amt+(P.grain||0)*v.unb*(u.apow||0), sb=0, mul=1;
      if(sk==='h61green'){ sb+=P.merc||0; if(P.patient&&share<0.5) sb+=P.patient; if(P.sf) sb-=0.15; if(P.door&&T.fn.knN(A,T,u,x)>=3) sb+=0.20; }
      else { sb+=P.shel||0; if(P.great&&P.sf) sb+=P.great; if(v.sotr&&x===v.met) mul*=1.25*(1+(P.roadShel||0)); }
      let hg=0; const kn=x!==u?T.fn.knN(A,T,u,x):0;
      if(P.knock) hg+=P.knock*kn; if(P.stew&&T.fn.vfOn(A,T,x)) hg+=P.stew; if(P.ear&&share<0.4) hg+=P.ear; if(P.sleep) hg+=P.sleep;
      if(P.fair) hg+=P.fair*v.unb; if(P.reign) hg+=P.reign*v.unb; if(P.oldSeal&&v.os[x.uid]>0) hg+=P.oldSeal;
      if(x===v.met){ if(P.met) hg+=P.met; if(P.heard&&share<0.5) hg+=P.heard; }
      if(P.wardens){ let n=0; for(const y of T.fn.mates(A,T,u)) if(T.fn.gap(A,u,y)>6) n++; hg+=P.wardens*Math.min(3,n); }
      if(P.alone&&x===u&&v.lw) hg+=P.alone;
      c.amt=amt*Math.max(0,1+sb)*(1+Math.min(HEAL_CAP,hg))*mul; },
    healedF(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), sk=c.skill, x=c.tgt; if((sk!=='h61green'&&sk!=='h61blue')||!x) return; const heal=c.heal||0;
      if(P.vf>0){ const rate=P.vf*heal*(sk==='h61blue'&&P.fits?3:1), dur=VF_DUR+(P.vfDur||0)+(sk==='h61green'&&P.mf?(P.qm||0):0); T.fn.vfPut(A,T,u,x,rate,dur);
        if(sk==='h61blue'&&P.fits){ const y=T.fn.nearestTo(A,T,u,x); if(y) T.fn.vfPut(A,T,u,y,rate*(1+(P.spread||0)),dur); } }   // Fire in the Seams: the ally nearest its target
      if(has(T,['oh_12_1'])) v.os[x.uid]=4;                                                                     // Old Seal Kept: healed in the last 4 s
      if(P.hnc&&x!==u&&T.fn.knN(A,T,u,x)>0) x.energy=Math.min(100,(x.energy||0)+P.hnc);                          // Hall Never Closed
      if(x===v.met){ if(P.petition) x.energy=Math.min(100,(x.energy||0)+P.petition);                              // Second Petition
        if(P.carter){ const y=T.fn.nearestTo(A,T,u,x); if(y){ E.healUnit(y,P.carter*heal); v.st.carter++; } } }    // Carter's Coat
      if(sk==='h61green'&&P.bom&&v.bellT>0){ v.st.bom++; for(const y of T.fn.side(A,T,u)) if(y!==x&&hero(y)&&T.fn.gap(A,x,y)<=3) E.healUnit(y,0.40*(1+(P.ring||0))*heal); } },   // Bell of Mercy
    /* ---- A HIT ON HIM: DR40, then the RISK costs (Sleepless King, Grain for Guards) ---- */
    drK(A,T,u,s,kind,auto){ const v=V(T), P=T.P; let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P.calm&&v.unb>=5) cut(P.calm); cut(P.ward); if(v.lw) cut(P.lwDr); if(kind==='magic') cut(P.raider); if(auto) cut(P.wallsHold);
      if(P.rim) cut(P.rim*v.iron); if(v.bellT>0) cut(P.bellIron); if(P.listen&&T.fn.anyKnock(A,T,u)) cut(P.listen); if(u._pend) cut(P.sealHand);
      if(P.coat) cut(P.coat*v.borne); if(P.wtg&&v.wtg>0) cut(0.20); cut(P.patience);
      if(P.raids){ for(const y of T.fn.mates(A,T,u)) if(y.hp<0.30*y.maxHp){ cut(P.raids); break; } }
      return Math.max(DR_FLOOR,k); },
    myIn(A,T,u,c){ const P=T.P; c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.auto); if(P.risk) c.amt*=1+P.risk; },
    /* ---- A HIT ON HIS SIDE (teamIn): Answered banks what the protection stops; ALLY20; the signature's quarter; Knocks ---- */
    tIn(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), t=c.tgt, s=c.src; if(!t||!s||t.team!==u.team||s.team===u.team||!u.alive) return;
      if(immune(E,t)){ const p=T.fn.protOf(A,T,t); if(p&&c.amt>0) p.bank+=c.amt; return; }
      if(t===u||!hero(t)) return;
      { let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); }, g=T.fn.gap(A,u,t), full=v.ironFull&&v.iron>=T.fn.ironMax(A,T);
        if(P.pet&&T.fn.knN(A,T,u,t)>0) cut(P.pet);
        if(g<=4){ if(P.hammer&&full&&c.auto) cut(0.10); if(P.bulw&&full) cut(P.bulw); cut(P.banner); }
        if(P.shoulder&&P.ctg&&t===T.fn.nearestTo(A,T,u,u,T.fn.mates(A,T,u))) cut(P.shoulder);
        if(P.farRoad&&t===v.met) cut(P.farRoad);
        c.amt*=Math.max(ALLY_FLOOR,k); }
      if(P.ngs&&v.ngs>0&&c.amt>0){ const x=0.25*c.amt; c.amt-=x; c.mv=(c.mv==null?1:c.mv)*0.75;          // No Gate Shut Again: a quarter MOVED onto him, then his own Armor / magic resist
        const kd=c.kind==='magic'?'magic':(c.kind==='true'?'true':'phys'), y=x*E.defMul(s,u,kd)/Math.max(1e-6,E.defMul(s,t,kd));
        E.damage(u,y,'#a37bd6',true); v.st.redirect++; T.fn.ironAdd(A,T,u,1); }
      if(has(T,KNOCK)&&c.amt>0.10*(t.maxHp||0)) T.fn.knAdd(A,T,u,t,1); },
    /* ---- A HIT ON HIM LANDED: Iron; Iron Answer at full Iron ---- */
    hurtF(A,T,u,c){ const v=V(T), P=T.P, E=A.eng();
      if(P.ia&&v.ironFull&&v.iron>=T.fn.ironMax(A,T)){ const n=v.iron, w=T.fn.weakest(A,T,u); v.iron=0; v.ironFull=0; v.st.ironAns++; if(w) E.healUnit(w,0.01*n*(w.maxHp||0)); return; }
      T.fn.ironAdd(A,T,u,1); },
    /* ---- HIS OWN HITS: Last Watch, Mace in Reach (an Iron a swing), Not Forgiven ---- */
    outF(A,T,u,c){ const v=V(T), P=T.P, t=c.tgt; if(!t||t.team===u.team) return; let m=1;
      if(v.lw&&P.lwDmg) m*=1+P.lwDmg;
      if(c.auto){ v.st.swing++; if(v.lw&&P.mir){ m*=1+P.mir; T.fn.ironAdd(A,T,u,1); } if(P.notForg) m*=1+P.notForg*v.borne; }
      c.amt*=m; },
    /* ---- AN ALLY FALLS: Borne (the fight, 4 at most), Open Road ---- */
    deathF(A,T,u,c){ const v=V(T), P=T.P, E=A.eng(), x=c.unit; if(!x||x.team!==u.team||x===u||!hero(x)) return;
      if(has(T,BORNE)&&!v.dead[x.uid]){ v.dead[x.uid]=1; if(v.borne<4){ v.borne++; v.st.borne++; } }
      delete v.k[x.uid]; delete v.vf[x.uid];
      if(x===v.met){ v.met=T.fn.farthest(A,T,u); v.lanT=-1; v.low=0; if(v.met&&P.openRoad) E.healUnit(v.met,P.openRoad*(v.met.maxHp||0)); } },
    /* ---- THIS TIME: once a fight, an ally about to die is held at 1 HP and protected 4 s (Answered at double strength), and the Borne lend 10% healing power each for 8 s ---- */
    ttF(A,T,u,c){ const v=V(T), x=c.unit; if(v.tt||!x||x===u||!hero(x)||x.team!==u.team) return;
      v.tt=1; v.st.tt++; if(x.hp<1) x.hp=1; c.stop=true; T.fn.protect(A,T,u,x,4,'tt',true); v.lend=8; },
    /* ---- CC30: Black Plate (every control) and Hands Like Stone (stuns and silences), one product floored at 0.70 ---- */
    ccK(A,T,u,c){ const P=T.P; let k=1; if(P.bp) k*=1-P.bp; if(P.hls&&(c.field==='stunned'||c.field==='silencedT')) k*=1-P.hls; c.amt*=Math.max(CC_FLOOR,k); },
    /* ---- stat counts (hundredths of a percent) ---- */
    healN(A,T,u){ const v=V(T), P=T.P; return 10000*((P.borneHeal||0)*v.borne+(P.tt&&v.lend>0?0.10*v.borne:0)); },
    hpN(A,T){ return 10000*(T.P.clasp||0)*V(T).borne; },
    nrgN(A,T){ const v=V(T), P=T.P, s=Math.min(SOON_CAP,(P.soon||0)+(P.fsk||0)*v.borne); return 10000*(1/(1-s)-1+(v.lw?(P.twh||0):0)); },
    farN(A,T,u,c){ const P=T.P, x=c&&c.tgt; if(!P.far||!x) return 0; for(const p of V(T).prot) if(p.x===x&&p.left>0&&p.kind==='nsf') return 10000*P.far; return 0; }
  },
  partial:{},
  ruling:{}
};
