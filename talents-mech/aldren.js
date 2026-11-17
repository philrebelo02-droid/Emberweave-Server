/* ALDREN - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (section 16: what Aldren added)
   His real kit (the code, not the tooltip wording):
   - Ink Spirit ('summonwarriors', green, cd 11): calls o.n (1) Lesser Ink Spirit ('ink spirit') for o.dur (16 s) beside him (summonUnit: 55% of his max HP and
     attack x the skill level's share, +80 armor / MR). It only basic-attacks. At most 3 Lesser Ink Spirits stand at once (SUMMON_CAPS); a call over the cap fails.
   - Chapter Rewrite ('chapterrewrite', blue, cd 9): 110% of ability power (magic) to his target, then for o.dur (6 s) its attack is cut by o.pct (30%) and its armor
     and magic resist by o.shred (25%); the "reversal" ENDS every buff on it at once (damage, haste, the damage-reduction slot, a crit buff, its heals over time) and
     burns its shield: a hit of shield x o.shieldBurn (1) true damage, which the shield it burns soaks up, then the shield is gone.
   - Living Pages (passive): every Green or Blue PRESS (castKit) writes a page (he holds at most 3); the next swing spends one for a magic hit of 60% of that
     swing's damage x his passive level, dealt at the swing (not a basic attack: auto is false). Final Volume writes none (the ultimate does not go through castKit).
   - Final Volume (ultimate, 'summonshaman'): calls one Elder Ink Horror ('ink horror', at most 1) for 22 s. The Horror basic-attacks and casts Ink Spin
     (a 'nova' around itself, every 6 s). Its hits are its own (src = the Horror), so his rows see them through the summon hooks.
   Page hooks used for him (doc 03 section 16): new 'summon' (summonUnit), 'sOut' / 'sHit' (_dealDamageCore), 'sGone' (a summon's time running out), 'sCc' (ccApply),
   'pagePre' / 'page' (the swing's page block), 'pageW0' / 'pageW' (the page written at castKit); hits on his summons and their deaths reach him through his watch.
   Readings and capped or reworded tooltips: WIRING/12 - ALDREN - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const IS='summonwarriors', CR='chapterrewrite', FV='summonshaman', SP='ink spirit', HO='ink horror';
const MINE={team:'ally',mine:true}, HORROR={team:'ally',mine:HO};                // his summons (all of them / the Horror)
const NOTES={stack:['fn','fk']};                                                 // Field Notes: the written ones and his Field Kit ones
const RW={team:'enemy',has:'rw'};                                                // rewritten enemies (under the rewrite's stat cut)
const STRONG3={team:'enemy',order:'strong',n:3};                                 // the three strongest enemies (the higher of attack and ability power)
const CE_AREA={team:'enemy',of:'target',within:P('ce.r',2),skip:'target'};       // a Chapter's End: every other enemy within 2 m of the page's target
const BLOT=(on)=>[{mark:'blot',on,dur:P('blot.dur',3),longest:true},{window:'blotW',dur:P('blot.dur',3),longest:true}];
const PAGE_ADD={field:'_pages',add:1,max:P('pg.cap',3)};                         // one more Living Page, never more than he can hold
const role=x=>(x&&x.t&&x.t.role)||'?';
module.exports={
  hero:'aldren',
  casting:true,                         // rows ask which of his skills a hit comes from (and 'page': a Living Page hit)
  summons:true,                         // his summons carry his rows (the summon hook)
  pages:true,                           // rows ask "is this hit a Living Page" (the two page hooks)
  states:{
    fn:{max:10},                                                                   // Field Notes written (max 10, kept for the fight)
    fk:{wave:'reset'},                                                             // Field Kit's notes (each wave; not counted toward the 10)
    bm:{max:1},                                                                    // a Bookmarked page waiting for his next Ink Spirit
    pc:{max:3},                                                                    // pages spent toward the next Chapter
    rev:{unit:true,max:3,dur:P('rev.dur',10),gain:'revGain'},                      // Revisions on each enemy: all lapse 10 s after the last one
    im:{unit:true,max:10,dur:3}                                                    // Ink Mastery's attack cut on each enemy (each Horror attack; all lapse 3 s after the last)
  },
  /* run for him whenever he has any mechanic talent: what a rewrite reverses (read before the skill ends it), who is rewritten, the page windows */
  always:[
    {on:'kit',skill:CR,do:[{fn:'rwSnap'}]},
    {on:'kit',skill:CR,if:{p:'burn'},opt:{shieldBurn:{set:P('burn',1)}}},                                         // Burnt Pages / Burnt Shield: the shield burn, larger
    {on:'kit',skill:CR,req:'rw_n1',if:{targetUst:{rev:1}},do:[{window:'fub',dur:99}]},                            // Filed Under Beasts: it ALREADY carries a Revision
    {on:'cast',skill:CR,do:[{mark:'rw',on:'target',dur:{opt:'dur',d:6},longest:true},{window:'rwW',dur:{opt:'dur',d:6},longest:true},{mark:'rw10',on:'target',dur:10}]},
    {on:'pagePre',do:[{window:'lb2',end:true},{window:'ce',end:true},{window:'ibt',end:true}]},
    {on:'pagePre',req:'lb_5_2',if:{selfMin:{_pages:2},noWindow:'open'},do:[{field:'_pages',add:-1},{window:'lb2',dur:1}]},   // Loose Binding: two pages at once
    {on:'pagePre',req:'lb_1_1',if:{any:[{stackMin:{pc:2}},{stackMin:{pc:1},window:'lb2'}]},do:[{window:'ce',dur:1}]},          // this page hit ends a Chapter
    {on:'pageW',if:{any:[{p:'pg.cap'},{p:'pg.n'}]},do:[{field:'_pages',set:{flat:P('pg.n',1),pct:1,of:'was'},max:P('pg.cap',3)}]}   // Written Twice / Thick Volume / Tight Binding
  ],
  talents:{
    /* ============================== THE BESTIARY ============================== */
    be_1_1:[ {on:'sHit',if:{targetTeam:'enemy'},do:[{mark:'sh',on:'target'}]},                                   // Field Notes: an enemy his summons have hit
             {on:'death',if:{who:'enemy',unitHas:'sh',targetLacks:'noted'},do:[{fn:'note'}]},   //   dies: a Field Note on it (max 10)
             {stat:{atk:R(0.004)},per:NOTES,to:MINE,if:{mine:true}} ],                                           //   each: his summons 0.4% more attack
    be_2_3:[ {on:'sGone',if:{unitKey:SP,unitExtra:false},do:[{mark:'bmT',on:'holder:bmT',clear:true},{stack:'bm',set:1},{mark:'bmT',on:'target',unique:true}]},   // Bookmark
             {on:'summon',if:{unitKey:SP,unitExtra:false,stackMin:{bm:1}},do:[{stack:'bm',set:0},{mark:'bmk',on:'unit',dur:4},{shield:{pct:R(0.05),of:'tgtMaxHp'},on:'unit',dur:99}]} ],
    be_2_1:[ {stat:{aspd:R(0.003)},per:NOTES,to:MINE,if:{mine:true}} ],                                         // Close Study
    be_3_3:[ {on:'summon',if:{unitHas:'bmk'},do:[{buff:'haste',x:R(0.03),dur:4,on:'unit'}]} ],                  // Dog-Eared
    be_3_1:[ {on:'noteW',every:5,do:[{field:'_summonT',add:2,on:MINE}]} ],                                      // Second Edition
    be_4_2:[ {on:'kit',skill:IS,opt:{dur:{add:R(0.6)}}} ],                                                      // Long Chapter
    be_4_3:[ {on:'summon',if:{unitHas:'bmk'},do:[{place:'unit',near:'holder:bmT'}]} ],                         // Marked Page
    be_n1:[  {on:'sCcIn',if:{cc:['stunned','slow']},less:R(0.06)} ],                                            // Sturdy Stitching (the game has no root)
    be_4_1:[ {on:'sOut',if:{targetTeam:'enemy',fn:'noted'},more:R(0.02)} ],                                     // Taxonomy
    be_5_2:[ {on:'kit',skill:IS,opt:{n:{set:2}}},                                                               // Pack Entry (PICK ONE): two Lesser Ink Spirits
             {on:'summon',if:{unitKey:SP,unitExtra:false},do:[{unitStat:{hp:-0.4,atk:-0.4,apow:-0.4},on:'unit'}]} ],   //   each with 60% of the stats
    be_1_2:[ {on:'cast',do:[{window:'pen',dur:3}]}, {on:'sOut',if:{window:'pen'},more:R(0.03)} ],               // Steady Pen
    be_5_3:[ {on:'summon',if:{unitKey:SP,unitExtra:false},do:[{unitStat:{hp:0.3,atk:0.3},on:'unit'}]} ],       // Single Entry (PICK ONE)
    be_5_1:[ {on:'teamIn',if:{targetMine:true,srcTeam:'enemy'},less:R(0.015)} ],                                // Ink Hide
    be_2_4:[ {on:'summon',if:{unitKey:SP},do:[{unitStat:{move:R(0.05)},on:'unit'}]} ],                         // Hunting Ink
    be_1_4:[ {on:'summon',if:{unitKey:SP},do:[{unitStat:{hp:R(0.04)},on:'unit'}]} ],                           // True Likeness
    be_6_1:[ {on:'sOut',if:{srcKey:SP},ignoreArmor:R(0.04)} ],                                                  // Sketched Fangs
    be_6_2:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                             // Read Aloud
    be_7_1:[ {stat:{apow:R(0.002)},per:NOTES} ],                                                                // Index of Beasts
    be_7_2:[ {on:'death',if:{unitMine:SP},do:[{dmg:{pct:0.4,of:'apow'},on:{team:'enemy',of:'unit',within:2},tag:'foot'}]} ],   // Footnoted: a spirit KILLED bursts
    be_7_3:[ {on:'summon',if:{unitKey:HO},do:[{unitStat:{hp:R(0.02)},on:'unit'}]} ],                           // Heavy Tome
    be_8_1:[ {on:'sOut',if:{targetTeam:'enemy',targetHpAbove:0.7},more:R(0.05)} ],                              // Nothing Gentler
    be_8_3:[ {on:'sOut',if:{srcKey:HO,auto:false},more:R(0.03)} ],                                              // Ink Spin Weight (the Horror's only non-basic hit is Ink Spin)
    be_8_4:[ {on:'cd',less:R(0.015)} ],                                                                         // Margin Sketch
    be_9_2:[ {on:'summon',do:[{unitStat:{hp:R(0.015)},on:'unit'}]} ],                                           // Wide Margins
    be_9_3:[ {on:'summon',if:{unitKey:HO},do:[{place:'unit',near:{team:'ally',mine:SP,n:1}}]},                 // Abridged: the Horror at a spirit's side
             {stat:{atk:{rk:'be_1_1',r:0.004}},per:NOTES,to:HORROR,if:{mine:HO}},                               //   and its Field Notes bonus twice
             {stat:{aspd:{rk:'be_2_1',r:0.003}},per:NOTES,to:HORROR,if:{mine:HO}},
             {stat:{atk:{rk:'be_12_1',r:0.001}},per:NOTES,to:HORROR,if:{mine:HO}} ],
    be_10_1:[ {on:'teamLethal',if:{unitMine:true,unitHas:'ccl'},do:[{atOne:'unit'}]},                           // Close Call: held at 1 HP for 1.5 s
              {on:'teamLethal',if:{unitMine:true},once:'wave',do:[{atOne:'unit'},{mark:'ccl',on:'unit',dur:1.5}]} ],
    be_10_2:[ {on:'kit',skill:FV,opt:{dur:{add:R(0.4)}}} ],                                                     // Longest Entry
    be_10_4:[ {on:'in',if:{mine:true},less:R(0.015)} ],                                                         // Back Shelf
    be_11_1:[ {on:'wave',do:[{stack:'fk',set:R(1)}]} ],                                                         // Field Kit
    be_11_2:[ {on:'sKill',do:[{energy:R(2)}]} ],                                                                // Callback
    be_11_3:[ {on:'death',if:{unitMine:true},do:[{shield:{pct:R(0.03),of:'maxHp'},on:'self',dur:4,mode:'max'}]} ],   // Old Bindings (the larger shield stays)
    be_12_1:[ {stat:{atk:R(0.001)},per:NOTES,to:MINE,if:{mine:true}} ],                                         // Addendum
    be_12_2:[ {on:'sOut',more:R(0.02)} ],                                                                       // Full Bestiary
    be_12_4:[ {stat:{nrg:R(0.02)}} ],                                                                           // Reading Light
    be_13_2:[ {on:'summon',if:{unitKey:HO},do:[{fn:'wholeBook'}]},                                              // The Whole Book (SIGNATURE)
              {on:'death',if:{unitMine:HO},do:[{fn:'wbEnd'}]}, {on:'sGone',if:{unitKey:HO},do:[{fn:'wbEnd'}]},
              {on:'teamIn',if:{targetMine:true,srcTeam:'enemy',mine:HO},less:0.2} ],

    /* ============================== THE REWRITE ============================== */
    rw_1_1:[ {on:'kit',skill:CR,if:{targetHas:'rw10'},do:[{ustack:'rev',on:'target',add:1}]},                  // Revision: rewritten again within 10 s
             {on:'kit',skill:CR,opt:{pct:{more:R(0.02),per:{ust:'rev'}},shred:{more:R(0.02),per:{ust:'rev'}}}} ],   //   each Revision: the cuts 2% deeper per rank
    rw_2_4:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                              // Editor's Eye
    rw_1_4:[ {on:'cast',skill:CR,if:{fn:'reversed'},do:[{shield:{pct:R(0.02),of:'maxHp'},on:'self',dur:4}]} ],  // Hard Cover (once a rewrite)
    rw_2_1:[ {param:'rev.dur',add:R(1)} ],                                                                      // Redraft
    rw_2_2:[ {param:'pt.k',add:R(0.1)}, {on:'cast',skill:CR,do:[{fn:'rwGive'}]} ],                              // Plot Twist
    rw_3_1:[ {on:'cast',skill:CR,if:{targetUst:{rev:3},targetAlive:true},do:[{silence:1,on:'target'}]} ],       // Final Cut
    rw_3_2:[ {on:'twist',do:[{heal:{pct:R(0.015),of:'tgtMaxHp'},on:'target'}]} ],                               // Twist Ending
    rw_n2:[  {stat:{mr:R(-0.02)},to:RW,if:{window:'rwW'}} ],                                                    // Thin Paper
    rw_4_1:[ {on:'teamIn',if:{srcHas:'rw',targetTeam:'ally'},less:R(0.01)} ],                                   // Red Lines
    rw_n1:[  {on:'kit',skill:CR,if:{window:'fub'},opt:{mul:{more:0.10}}}, {on:'cast',skill:CR,do:[{window:'fub',end:true}]},   // Filed Under Beasts (LINK)
             {on:'revGain',req:'be_1_1',if:{targetUst:{rev:3},targetLacks:'fub3'},do:[{mark:'fub3',on:'target'},{fn:'note'}]} ],
    rw_4_3:[ {on:'kit',skill:CR,opt:{dur:{add:R(0.5)}}} ],                                                      // Long Rewrite
    rw_4_4:[ {param:'burn',add:R(0.10)} ],                                                                      // Burnt Pages (the always row)
    rw_5_1:[ {on:'cd',less:R(0.015)} ],                                                                         // Strict Editor
    rw_5_2:[ {on:'kit',skill:CR,do:[{strip:1,on:'target'}]}, {on:'cast',skill:CR,do:[{fn:'rwSteal'}]} ],        // Stolen Shield (PICK ONE)
    rw_5_3:[ {param:'burn',add:0.5}, {on:'cast',skill:CR,do:[{fn:'rwSpread'}]} ],                               // Burnt Shield (PICK ONE)
    rw_5_4:[ {on:'kit',skill:CR,opt:{mul:{more:R(0.03)}}} ],                                                    // Pressed Ink
    rw_6_2:[ {on:'twist',do:[{mark:'ss',on:'target',dur:4}]}, {on:'teamIn',if:{srcHas:'ss',targetTeam:'enemy'},more:R(0.015)} ],   // Shared Story
    rw_6_3:[ {on:'teamHeal',if:{unitHas:'rw'},less:R(0.05)} ],                                                  // Unhappy Ending
    rw_7_1:[ {on:'cast',skill:CR,if:{targetHpBelow:0.3,targetAlive:true},do:[{mark:'rwe',on:'target',dur:{opt:'dur',d:6}},{window:'rweW',dur:{opt:'dur',d:6},longest:true}]},   // Rewrite the Ending
             {stat:{hp:-0.10},to:{team:'enemy',has:'rwe'},if:{window:'rweW'}} ],
    rw_7_2:[ {on:'teamIn',if:{targetHas:'rw',srcTeam:'ally'},more:R(0.015)} ],                                  // Footnote
    rw_7_3:[ {stat:{move:R(-0.02)},to:RW,if:{window:'rwW'}} ],                                                  // Cold Ink
    rw_8_1:[ {on:'revGain',do:[{energy:R(1)}]} ],                                                               // Rough Draft
    rw_8_2:[ {param:'pt.n',add:1} ],                                                                            // Two Versions
    rw_8_4:[ {on:'in',if:{srcHas:'rw'},less:R(0.015)} ],                                                        // Slipcase
    rw_9_1:[ {stat:{aspd:R(-0.015)},to:RW,if:{window:'rwW'}} ],                                                 // Red Margin
    rw_9_4:[ {on:'death',if:{who:'enemy',unitHas:'rw',unitUst:{rev:1}},do:[{ustack:'rev',on:{team:'enemy',of:'unit',n:1,skip:'unit'},add:{ust:'rev',of:'unit'}}]} ],   // Unbound
    rw_10_1:[ {on:'teamNrg',if:{unitHas:'rw'},less:R(0.05)} ],                                                  // Censor (energy from being hit)
    rw_10_2:[ {on:'out',if:{casting:'page',targetHas:'rw'},more:R(0.03)} ],                                     // Living Draft
    rw_10_3:[ {on:'out',if:{casting:CR},ignoreMr:R(0.04)} ],                                                    // Torn Out
    rw_11_2:[ {on:'teamIn',if:{targetHas:'ptw',srcTeam:'enemy'},less:R(0.015)} ],                               // Plot Armor
    rw_11_3:[ {stat:{nrg:R(0.02)}} ],                                                                           // Margin Call
    rw_11_4:[ {on:'out',if:{auto:true},more:R(0.04)} ],                                                         // Crisp Pages
    rw_12_1:[ {on:'kit',skill:CR,if:{targetIs:{team:'enemy',boss:true}},opt:{pct:{more:R(0.05)},shred:{more:R(0.05)}}} ],   // Retcon (bosses: the cut deeper)
    rw_12_2:[ {on:'sHit',if:{srcKey:HO,auto:true,targetTeam:'enemy',targetAlive:true},do:[{ustack:'im',on:'target',add:1}]},   // Ink Mastery: up to 10%
              {on:'teamIn',if:{srcTeam:'enemy',srcUst:{im:1}},less:R(0.01),per:{ust:'im',of:'source'},upTo:0.10},
              {on:'in',if:{srcUst:{im:1}},less:R(0.01),per:{ust:'im',of:'source'},upTo:0.10} ],
    rw_12_4:[ {on:'death',if:{who:'enemy',unitHas:'rw'},do:[{cd:'blue',mul:R(-0.2,1)}]} ],                       // Spare Copy
    rw_13_2:[ {on:'cast',skill:FV,do:[{window:'lc',dur:99},{ustack:'rev',on:STRONG3,set:3},{castSkill:'blue',on:STRONG3},{window:'lc',end:true}]},   // The Last Chapter (SIGNATURE)
              {on:'cast',skill:CR,unless:'rw_2_2',if:{window:'lc'},do:[{fn:'rwGive'}]} ],               //   its reversed buffs written into an ally at full strength

    /* ============================== THE LIVING BOOK ============================== */
    lb_1_1:[ {on:'page',do:[{stack:'pc',add:1,full:[{stack:'pc',set:0},{emit:'chapter'}]}]},                    // Chapter's End: every 3rd page spent
             {on:'page',if:{window:'lb2'},do:[{stack:'pc',add:1,full:[{stack:'pc',set:0},{emit:'chapter'}]}]},   //   (a Loose Binding hit spends two)
             {on:'chapter',do:[{emit:'ceHit'}]},
             {on:'ceHit',do:[{dmg:{pct:R(0.08),of:'apow'},on:CE_AREA,tag:'ce'}]} ],
    lb_1_2:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                          // Ink-Stained Hands
    lb_1_4:[ {on:'page',do:BLOT('target')}, {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'blot'},if:{window:'blotW'}} ],   // Wet Ink: Blot
    lb_2_1:[ {stat:{aspd:R(0.02)},if:{selfMin:{_pages:1}}} ],                                                   // Turning Pages
    lb_2_4:[ {param:'blot.dur',add:R(0.5)} ],                                                                   // Spreading Blot
    lb_3_1:[ {on:'chapter',do:[PAGE_ADD]} ],                                                                    // Epilogue
    lb_3_2:[ {on:'pageW',skill:CR,if:{wasBelow:1},do:[{window:'sch',dur:3}]},                                   // Scholar's Mind: no page held at the press
             {on:'out',if:{casting:CR,window:'sch'},more:R(0.03)}, {on:'cast',skill:CR,do:[{window:'sch',end:true}]},
             {on:'sOut',if:{srcKey:SP,selfBelow:{_pages:1}},more:R(0.03)} ],
    lb_2_3:[ {on:'out',if:{casting:'page'},more:R(0.04)}, {param:'pg.cap',add:[0,0,0,0,1],unless:'lb_5_3'} ],   // Thick Volume (4 pages at 5/5)
    lb_3_4:[ {on:'pagePre',if:{targetHas:'blot'},do:[{window:'ibt',dur:1}]},                                    // Ink Bleeds Through
             {on:'page',if:{window:'ibt'},do:BLOT(CE_AREA)} ],
    lb_4_1:[ {on:'chapter',do:[{energy:R(1)}]} ],                                                               // Running Head
    lb_4_2:[ {on:'cd',less:R(0.015)} ],                                                                         // Quick Hand
    lb_4_3:[ {on:'ccIn',less:R(0.04)} ],                                                                        // Clean Margins
    lb_5_1:[ {on:'out',if:{casting:'page'},more:R(0.05)} ],                                                     // Heavy Pages
    lb_9_3:[ {on:'in',if:{selfMin:{_pages:2}},less:R(0.02)} ],                                                  // Desk Work
    lb_8_4:[ {on:'page',do:[{window:'ol',dur:3}]}, {stat:{armor:R(0.02),mr:R(0.02)},if:{window:'ol'}} ],        // Old Leather
    lb_6_1:[ {param:'ce.r',add:R(0.3)} ],                                                                       // Next Chapter
    lb_6_4:[ {on:'out',if:{targetHas:'blot'},more:R(0.03)} ],                                                   // Dark Ink
    lb_7_1:[ {on:'out',if:{casting:'page'},ignoreMr:R(0.02)} ],                                                 // Page Cut
    lb_7_2:[ {param:'pg.n',add:1} ],                                                                            // Written Twice (the always row)
    lb_7_4:[ {on:'in',if:{srcHas:'blot'},less:R(0.015)} ],                                                      // Ink Ward
    lb_5_2:[ {on:'out',if:{casting:'page',window:'lb2'},mul:2} ],                                               // Loose Binding (PICK ONE; the always row spends the second)
    lb_8_2:[ {on:'out',if:{casting:CR},more:R(0.04),per:{field:'_pages',of:'self'}} ],                          // Spine Crack
    lb_5_3:[ {param:'pg.cap',add:-1}, {on:'out',if:{casting:'page'},more:0.25}, {on:'wave',do:[{field:'_pages',max:2}]} ],   // Tight Binding (PICK ONE)
    lb_5_4:[ {on:'in',if:{srcHas:'blot'},less:R(0.01)}, {on:'teamIn',if:{srcHas:'blot',srcTeam:'enemy'},less:R(0.01)} ],   // Blotted Out
    lb_9_1:[ {on:'out',if:{casting:'page',window:'ce'},more:R(0.03)} ],                                         // Cliffhanger
    lb_9_2:[ {on:'page',if:{selfBelow:{_pages:1},noWindow:'open'},do:[{window:'sr',dur:99}]},                   // Speed Reader
             {on:'cd',if:{window:'sr'},mul:1/1.3,do:[{window:'sr',end:true}]} ],
    lb_10_1:[ {on:'chapter',every:2,do:[{emit:'ceHit'}]} ],                                                     // Long Story: every 2nd Chapter hits twice
    lb_10_3:[ {stat:{nrg:R(0.015)}} ],                                                                          // Ink Well
    lb_10_4:[ {on:'death',if:{who:'enemy',unitHas:'blot'},chance:R(0.2),do:[PAGE_ADD]} ],                        // Final Blot
    lb_11_1:[ {on:'out',if:{auto:true},more:R(0.015),per:{field:'_pages',of:'self'}} ],                         // Rapid Notes
    lb_11_2:[ {on:'sHit',if:{srcKey:HO,auto:true},icd:R(-0.5,2.5),do:[PAGE_ADD]} ],                             // Open Book
    lb_11_4:[ {on:'wave',do:[{field:'_pages',min:R(1),max:P('pg.cap',3)}]} ],                                  // Shelf Life
    lb_12_1:[ {on:'dmg:ce',if:{targetHpBelow:0.5},more:R(0.05)}, {on:'out',if:{casting:'page',window:'ce',targetHpBelow:0.5},more:R(0.05)} ],   // Closing Lines
    lb_12_2:[ {on:'out',if:{casting:'page',mine:HO},more:R(0.03)} ],                                            // Page Storm
    lb_12_3:[ {on:'hit',if:{casting:'page'},do:[{heal:{pct:R(0.05),of:'hit'},on:'self'}]} ],                    // Annotated
    lb_13_2:[ {on:'cast',skill:FV,do:[{window:'open',dur:8}]},                                                  // Every Page at Once (SIGNATURE): 8 s
              {on:'pagePre',if:{window:'open'},do:[{field:'_pages',add:1}]},                                    //   every swing lands a page hit, spending none
              {on:'page',if:{window:'open'},do:BLOT('target')}, {on:'ceHit',if:{window:'open'},do:BLOT(CE_AREA)} ]   //   and every enemy those hits touch is Blotted
  },
  fn:{
    /* a Field Note on the enemy ctx.tgt (once per enemy, max 10); its class is noted (Taxonomy, The Whole Book) */
    note(A,T,u,c){ const t=c.tgt; if(!t||A.markOf(u,t,'noted')||A.stGet(T,'fn')>=10) return; A.setMark(T,u,t,'noted',{}); A.stSet(T,u,'fn',A.stGet(T,'fn')+1);
      (T.s.cls||(T.s.cls={}))[role(t)]=1; A.run(T,u,'noteW',Object.assign({},c,{tgt:t})); },
    noted(A,T,u,c){ return !!(T.s.cls&&c.tgt&&T.s.cls[role(c.tgt)]); },
    /* The Whole Book: for each class he has a Note on (in the order he noted them, up to 3) with an enemy of it on the field, one Lesser Ink Spirit that hunts the
       nearest such enemy, for as long as the Horror has left. They are summons like any other (the field cap of 3 spirits holds) */
    wholeBook(A,T,u,c){ const E=A.eng(), h=c.unit; if(!E.summon||!h) return; const cls=Object.keys(T.s.cls||{}); let n=0;
      for(const k of cls){ if(n>=3) break; const prey=A.pick(T,u,{team:'enemy'},c).filter(x=>role(x)===k).sort((a,b)=>E.dist(h,a)-E.dist(h,b))[0]; if(!prey) continue;
        const lv=(u.skillLv&&u.skillLv[1])||1; let s=null; T.s.ex=1;
        try{ s=E.summon(u,SP,Math.max(0.5,h._summonT||22),{a:(u.team==='ally'?0:Math.PI)+(n-1)*0.7,r:1.6*E.METER(),share:1+0.005*Math.max(0,lv-1)}); } finally{ T.s.ex=0; }
        if(!s) break; A.setMark(T,u,s,'wb',{}); s.target=prey; s.forcedTarget=prey; s.forcedTargetT=s._summonT; n++; } },   // it hunts that enemy (the engine's own forced target)
    wbEnd(A,T,u){ const E=A.eng(); if(!E.unsummon) return; for(const x of A.mineOf(T,u).slice()) if(A.markOf(u,x,'wb')) E.unsummon(x); },
    /* what Chapter Rewrite is about to reverse on its target (read at the kit, before the skill ends it) */
    rwSnap(A,T,u,c){ const t=c.tgt; if(!t){ T.s.rb=null; return; } const b=[];
      if((t.dmgBuffT||0)>0&&(t.dmgBuffMul||1)>1) b.push({k:'dmg',s:t.dmgBuffMul-1,t:t.dmgBuffT});
      if((t.hasteT||0)>0&&(t.hasteMul||1)>1) b.push({k:'haste',s:t.hasteMul-1,t:t.hasteT});
      if((t.drT||0)>0&&(t.drMul==null?1:t.drMul)<1) b.push({k:'dr',s:1-t.drMul,t:t.drT});
      if((t._critBuffT||0)>0&&(t._critBuffPct||0)>0) b.push({k:'crit',s:t._critBuffPct,t:t._critBuffT});
      if(t.hots) for(const h of t.hots) if(h.hps>0&&h.remaining>0) b.push({k:'hot',s:h.hps,t:h.remaining*(h.interval||1),iv:h.interval||1});
      if((t._digHealT||0)>0) b.push({k:'other',s:0,t:t._digHealT});
      T.s.rb={t,b,sh:t.shield||0,shT:t.shieldT||0}; },
    reversed(A,T,u,c){ const rb=T.s.rb; return !!(rb&&rb.t===c.tgt&&rb.b.length); },
    /* Plot Twist: each reversed buff into his lowest-HP ally (two with Two Versions) at 10% per rank of its strength (The Last Chapter: in full) for the time it had left */
    rwGive(A,T,u,c){ const rb=T.s.rb; if(!rb||rb.t!==c.tgt||!rb.b.length) return; const E=A.eng(), k=A.winOn(T,'lc')?1:(T.P['pt.k']||0); if(!(k>0)) return;
      const al=A.pick(T,u,{team:'ally',others:true,order:'lowHp',n:1+(T.P['pt.n']||0)},c);
      for(const a of al){ let d=0; for(const x of rb.b){ if(x.k==='other') continue; if(x.k==='hot') E.pushHot(a,x.s*k,x.t,x.iv); else A.buffOn(a,x.k,x.s*k,x.t); d=Math.max(d,x.t); }
        if(d>0){ A.setMark(T,u,a,'ptw',{dur:d,longest:true}); A.run(T,u,'twist',Object.assign({},c,{tgt:a,unit:a})); } } },
    /* Stolen Shield: the shield the kit row took off it, 40% of it to his lowest-HP ally (its time left, 1 to 6 s) */
    rwSteal(A,T,u,c){ const rb=T.s.rb; if(!rb||rb.t!==c.tgt||!(rb.sh>0)) return; const a=A.pick(T,u,{team:'ally',others:true,order:'lowHp',n:1},c)[0]; if(!a) return;
      a.shield=(a.shield||0)+0.4*rb.sh; a.shieldT=Math.max(a.shieldT||0,Math.min(6,Math.max(1,rb.shT||4))); },
    /* Burnt Shield: the fire spreads to every other enemy within 2 m for 30% of the burn */
    rwSpread(A,T,u,c){ const rb=T.s.rb; if(!rb||rb.t!==c.tgt||!(rb.sh>0)) return; const x=0.3*rb.sh*(1+(T.P.burn||0));
      for(const t of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},c)) A.hurt(T,u,t,x,'#c8b9e8','bs'); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/12 - ALDREN - talent decisions.md) */
  ruling:{}
};
