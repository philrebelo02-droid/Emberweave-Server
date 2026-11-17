/* NOX QUILLFINGER - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Nox Quillfinger")
   His real kit (the code, not the tooltip wording; a mid-row Assassin whose damage profile is Magic: every hit of his, basic attacks included, is magic):
   - Lockpick Soul ('energysteal', green, cd 7, delivered as a shot): flies to the enemy with the most Energy (anywhere), strikes it for 125% of his ability
     power and steals up to 30 Energy (the target first gains the 7 Energy any hit gives); he gains what it took; a Skeleton Key. Master-Unlocked: it also
     strikes the next two enemies with the most Energy, steals from each and silences all three (the table's single silence, 3 s x 0.7 = 2.1 s); no key.
   - Forbidden Key ('energygift', blue, cd 9): the ally (not himself) with the most Energy gains 25 + 0.1 a level + 6 a key he holds (counted before a
     Master-Unlock spends them), and a damage buff of x1.25 for 6 s (the larger one stays); a key. Master-Unlocked: its Energy is filled to 100, the buff is
     x1.5, its controls end and it gets 60% control resist for 6 s; no key. Nothing is taken from Nox: the Energy is not "his".
   - Open Every Door (ultimate 'openeverydoor', delivered 'form'): every enemy is stunned and silenced 1.6 s x (1 - its control resist) through ccApply
     (x0.7: 1.12 s), loses up to 35 Energy, then every enemy takes his ability power x 0.9 x (1 + the Energy taken in all / 100), magic; every ally gains
     25% of the Energy taken; he gains 3 keys. Master-Unlocked: the locks ignore control resist and every ally gets a x1.35 damage buff for 8 s.
   - Skeleton-Key Savant (passive 'skeletonkey', 3 stars): a key at every Green / Blue PRESS (castKit) and one more from the skill itself unless it was
     Master-Unlocked, at most 5; the ultimate gives 3. At 5 keys the next ability is Master-Unlocked (noxSpendKeys: all 5 spent). Each time he reaches 5
     keys the passive ADDS permanent Fortune: crit damage +5% x the passive's multiplier and dodge (the game's Evasion, evaStat) +3% x it, at most 50%.
   Accomplice, Hot Goods, Tumblers, Whiskers and the Spare Key exist only through his talents. Ripe = an enemy at 70 Energy or more (read straight off it).
   Readings, caps and corrected tooltips: WIRING/43 - NOX QUILLFINGER - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const LP='energysteal', FK='energygift', OED='openeverydoor', SKILLS=[LP,FK,OED];
const RIPE=70, DR_FLOOR=0.60, TEAM_FLOOR=0.75, CRIT_CAP=0.05, EVA_CAP=0.10, EVA_TOP=0.5, REGEN=0.012, CC_TOP=4.0, SIG_CD=20, ULT_WEAK=0.30;
/* the states several talents read: their bookkeeping runs when any of these is learned */
const ACC=['fe_1_1','fe_2_1','fe_3_1','fe_6_1','fe_7_1','fe_8_1','fe_9_1','fe_11_2','fe_12_1','fe_12_3','fe_13_2'];        // the Accomplice
const HOT=['fe_1_4','fe_3_4','fe_5_4','fe_6_4','fe_8_3','fe_9_4'];                                                        // Hot Goods
const AULT=['fe_3_1','fe_7_1','fe_12_2','fe_13_2'];                                                                       // his allies' Ultimate presses
const TB=['jb_1_4','jb_3_4','jb_5_4','jb_7_4','jb_8_3','jb_9_4','jb_11_3','jb_12_3','jb_10_4','jb_n2'];                   // Tumblers
const WK=['lf_1_1','lf_2_1','lf_3_1','lf_4_1','lf_7_1','lf_8_1','lf_9_1','lf_11_1','lf_11_2','lf_n1','lf_13_2'];         // Whiskers
const FD=WK.concat(['lf_6_4','lf_12_3']);                                                                                  // a Fortune dodge
const KEYS=['lf_1_4','lf_3_4','lf_7_4','lf_9_4','lf_5_2','lf_6_2','lf_12_2','lf_13_2','jb_n2','jb_9_4'];                   // his own key bookkeeping
const NRG=['fe_8_1','jb_5_3','jb_11_2','jb_9_1'];                                                                          // Energy a unit gains, slowed or stopped
const DRME=['fe_n1','fe_6_4','fe_8_2','fe_11_1','jb_4_1','jb_7_1','jb_6_2','lf_4_1','lf_6_1','lf_12_4','jb_13_2'];        // hits on him: ONE capped group (40%) + the signature's weakened Ultimate
const DRT=['fe_2_1','fe_6_3','jb_7_1','jb_6_2','jb_13_2'];                                                                 // hits on his allies: ONE capped group (25%) + the weakened Ultimate
const TOUT=['fe_6_1','fe_9_2'];                                                                                            // his team's hits on enemies
const CRT=['jb_1_3','lf_11_3','jb_11_3','fe_11_3','lf_6_4','lf_9_2'];                                                      // critical chance: ONE group, at most 5%
const HEALS=['fe_7_1','jb_10_2','lf_7_1','lf_12_3'];                                                                       // his own heals (one budget: the regeneration cap)
const S=T=>T.s.nx||(T.s.nx={});                     // his own per-fight state (one object, so no name of the runtime's own is ever used)
const rk=(T,id)=>T.r[id]||0;
const mate=(u,x)=>!!x&&x.alive&&x.team===u.team&&!x._summon;
const foe=(u,x)=>!!x&&x.team!==u.team;
const ripe=x=>!!x&&(x.energy||0)>=RIPE;
const wkN=T=>{ const k=T.s.k.wk; return k?k.n:0; };
const accOf=(T,u)=>{ const a=S(T).acc; return (a&&a.alive)?a:null; };
const allies=(A,u)=>A.eng().units().filter(x=>mate(u,x)&&x!==u&&!x._dropHidden&&!((x._riseT||0)>0));
const enemies=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget&&!((x._riseT||0)>0));
const gainE=(x,n)=>{ if(x&&x.alive&&n>0) x.energy=Math.min(100,(x.energy||0)+n); };
/* one of his own skills cast at a unit from inside one of his rows (bound castSlot: his skill at its level, no press, no cooldown): the runtime's action
   depth is put back to 0 for it, so his own out / hit rows see its hits as his skill's (WIRING/03, Fritz: skillHits) */
function cast0(A,T,u,slot,t){ const E=A.eng(), s=T.s, d=s.d; if(!E.castSlot||!t||!t.alive||!u.alive) return; s.d=0; try{ E.castSlot(u,slot,t); } finally{ s.d=d; } }
module.exports={
  hero:'nox',
  casting:true,                         // rows ask which of his skills a hit comes from
  times:['nx.stoleAt','nx.rgAt','nx.tl.*.0'],          // his own absolute fight times (the last steal, the heal budget's clock, Twice Lucky's ends): moved back with the wave clock (WIRING/41c)
  states:{
    wk:{max:3,dur:P('wk.dur',6)},                                   // Whiskers (all lapse 6 s after the last, Long Whiskers longer)
    cs:{max:3,dur:2},                                               // Close Shave: a Whisker's 2 s of speed
    cou:{max:5,wave:'reset'},                                       // Courier: Forbidden Keys cast this wave
    ts:{max:10,wave:'reset'},                                       // Tumbler Song: locks clicked this wave
    sl:{max:10,wave:'reset'},                                       // Sooner and Larger: allied Ultimates this wave
    nl:{max:10,wave:'reset'},                                       // Nothing Left: Ripe enemies dropped below 70 this wave
    ffl:{max:10}                                                    // Fortune's Fool: Master-Unlocks this fight
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]}, {on:'wave',do:[{fn:'wv'}]},
    {on:'kit',skill:LP,do:[{fn:'kitAll'},{fn:'kitLP'}]}, {on:'kit',skill:FK,do:[{fn:'kitAll'},{fn:'kitFK'}]}, {on:'kit',skill:OED,do:[{fn:'kitAll'},{fn:'kitOED'}]},
    {on:'cast',skill:LP,do:[{fn:'castLP'},{fn:'castAll'}]}, {on:'cast',skill:FK,do:[{fn:'castFK'},{fn:'castAll'}]}, {on:'cast',skill:OED,do:[{fn:'castOED'},{fn:'castAll'}]},
    {on:'skillTgt',skill:FK,do:[{fn:'fkTgt'}]},                                                                     // Forbidden Key's receiver (the Accomplice)
    {on:'skillTgt',skill:LP,reqAny:['jb_3_1'],do:[{fn:'jitHold'}]},                                                 // Just in Time: the hooked enemy holds its Ultimate until the hook lands
    {on:'hit',if:{casting:LP,targetTeam:'enemy'},do:[{fn:'lpHit'}]},                                                 // Lockpick Soul's hits (the Energy each target held when it was struck)
    {on:'out',if:{targetTeam:'enemy'},do:[{fn:'myOut'}]},                                                            // his hits: Whiskers spent, the Ripe flag for this hit
    {on:'hit',reqAny:TB.concat(['jb_8_1','fe_4_3','jb_4_3','lf_4_3']),if:{targetTeam:'enemy'},do:[{fn:'myHit'}]},     // Tumblers, Second Breath, Energy from his basic attacks
    {on:'evaded',reqAny:FD,do:[{fn:'fd'}]},                                                                          // the game's Evasion made an enemy's hit miss him: a Fortune dodge
    {on:'in',reqAny:DRME,do:[{fn:'myIn'}]}, {on:'dotIn',reqAny:DRME,do:[{fn:'myDot'}]},                             // his damage reduction: ONE capped group (40%)
    {on:'teamIn',reqAny:DRT.concat(TOUT),do:[{fn:'tIn'}]},                                                           // hits on his allies (their group, 25%) and his team's hits
    {on:'crit',reqAny:CRT,chance:{flat:1,x:{fn:'critP'}},force:true},                                                // his critical-chance talents: ONE group, at most 5%
    {on:'teamHeal',reqAny:['fe_10_1','jb_12_4'],do:[{fn:'tHeal'}]},
    {on:'ccHit',reqAny:['jb_4_2','jb_3_3','jb_9_2'],do:[{fn:'ccExt'}]},                                             // his skills' controls made longer, in full (at most 4.0 s)
    {stat:{atk:1},reqAny:['jb_10_1'],per:{fn:'ripeAtk'}}                                                             // Ripe Fruit
  ],
  talents:{
    /* ============================== THE FENCE ============================== */
    fe_1_1:[ {param:'acc.ult',add:R(0.02)} ],                                                                       // A Friend on the Inside (the Accomplice: wv; Forbidden Key to it: fkTgt; its buff: castFK)
    fe_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Tallow Row Feet
    fe_1_4:[ {param:'hot.k',add:R(0.05)} ],                                                                         // Still Warm (Hot Goods: castLP / castOED; their worth: kitFK)
    fe_2_1:[ {param:'dr.th',add:R(0.02)} ],                                                                         // Trusted Hand (the allies' group)
    fe_2_2:[ {on:'kit',skill:FK,opt:{give:{add:R(1)}}} ],                                                            // Fast Fence
    fe_3_1:[ {param:'pt.key',add:1} ],                                                                              // Partners (accUlt)
    fe_3_3:[ {on:'out',if:{casting:LP,targetTeam:'enemy'},more:R(0.03)} ],                                           // Sharper Pick
    fe_4_2:[ {on:'kit',skill:FK,opt:{ultMul:{add:R(0.02)},muUltMul:{add:R(0.02)}}}, {param:'gen',add:R(0.02)} ],     // Generous (points; the signature's buff too)
    fe_3_4:[ {param:'hot.dur',add:R(0.2)} ],                                                                        // Quick Turnaround
    fe_n1:[  {param:'dr.le',add:R(0.03)} ],                                                                         // Lookout's Eye (his group)
    fe_5_3:[ {param:'spread',add:1} ],                                                                              // Spread It Around (PICK ONE: castFK)
    fe_5_2:[ {on:'kit',skill:FK,opt:{give:{mul:1.4},perLv:{mul:1.4},perKey:{mul:1.4}}} ],                            // One Buyer (PICK ONE)
    fe_4_3:[ {param:'nrg.hit',add:R(0.03)} ],                                                                       // Pocket Change (myHit)
    fe_6_3:[ {param:'dr.fs',add:R(0.03)} ],                                                                         // Fair Shares (needs Spread It Around; castFK, the allies' group)
    fe_6_2:[ {param:'sb4',add:1}, {stat:{aspd:R(0.02)},to:{team:'ally',has:'sb4'}} ],                                // Sole Buyer (needs One Buyer)
    fe_5_4:[ {param:'ho',add:R(0.01)} ],                                                                            // Hand-Off (castFK)
    fe_6_1:[ {param:'ij',add:R(0.02)} ],                                                                            // Inside Job (tIn)
    fe_6_4:[ {param:'dr.ll',add:R(0.02)} ],                                                                         // Light Load (his group)
    fe_7_1:[ {param:'lko',add:R(0.01)} ],                                                                           // Lookout (accUlt; the heal budget)
    fe_7_3:[ {on:'cd',skill:'blue',add:R(-0.1)} ],                                                                  // Forbidden Edge
    fe_7_4:[ {on:'kit',skill:LP,opt:{steal:{add:R(1)}}} ],                                                           // Fresh Haul (before the pick-one's share: talent-id order)
    fe_8_1:[ {param:'op',add:R(0.03)} ],                                                                            // Old Partners (tk: the Energy watch)
    fe_8_2:[ {param:'dr.cou',add:R(0.01)} ],                                                                        // Courier (castFK; his group)
    fe_8_3:[ {on:'out',if:{targetTeam:'enemy',window:'hot'},critMore:R(0.02)} ],                                     // Fair Price (at most 10%)
    fe_9_1:[ {param:'pic',add:1} ],                                                                                 // Covering Hand (was Partners in Crime; tk)
    fe_9_2:[ {param:'em',add:R(0.03)} ],                                                                            // Easy Mark (castLP; myOut, tIn)
    fe_9_3:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},ignoreMr:R(0.02)} ],                                     // Silver Tongue
    fe_9_4:[ {param:'stt',add:1} ],                                                                                 // Straight to Them (kitFK)
    fe_10_1:[ {param:'wl',add:R(0.01)} ],                                                                           // Well Liked (tHeal)
    fe_10_2:[ {param:'fc',add:R(1)} ],                                                                              // Fence's Cut (castFK)
    fe_11_1:[ {param:'dr.nt',add:R(0.02)} ],                                                                        // Never Trusted (his group: enemies marked 'rb')
    fe_11_2:[ {param:'mog',add:1} ],                                                                                // Moment of Glory (castOED)
    fe_11_3:[],                                                                                                     // Clever Hands (critP: enemies he has stolen from)
    fe_12_1:[ {param:'od',add:R(5)} ],                                                                              // Old Debts (wv)
    fe_12_2:[ {stat:{atk:R(0.005)},per:'sl'} ],                                                                     // Sooner and Larger (accUlt: every allied Ultimate)
    fe_12_3:[ {stat:{aspd:R(0.03)},if:{fn:'accAlive'}} ],                                                           // Deft
    fe_12_4:[ {param:'pp',add:R(0.05)} ],                                                                           // Prime Pickings (castLP / castOED)
    fe_13_2:[ {param:'egm',add:1} ],                                                                                // Everyone's Great Moment (SIGNATURE: accUlt)

    /* ============================== JUST BEFORE THEY USE IT ============================== */
    jb_1_1:[ {on:'out',if:{targetTeam:'enemy',targetMin:{energy:RIPE}},more:R(0.02)} ],                              // Saving It Up
    jb_n1:[  {param:'case',add:R(2)} ],                                                                             // Casing the Job (tk)
    jb_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Quiet Steps
    jb_1_4:[ {param:'tb.k',add:R(4)} ],                                                                             // Feeling the Pins (Tumblers: myHit / click)
    jb_2_1:[ {param:'bbs',add:R(2)} ],                                                                              // Breath Before the Swing (castLP)
    jb_2_2:[ {on:'out',if:{casting:LP,targetTeam:'enemy'},more:R(0.03)} ],                                           // Hooked Soul
    jb_1_3:[],                                                                                                      // Steel Pick (critP)
    jb_3_1:[ {param:'jit',add:1} ],                                                                                 // Just in Time (jitHold / kitLP)
    jb_3_3:[ {param:'lock.add',add:R(0.05)} ],                                                                      // Long Lock (ccExt)
    jb_3_4:[ {param:'tb.grace',add:R(0.4)} ],                                                                       // Light Touch (myHit)
    jb_4_1:[ {param:'dr.cc',add:R(0.015)} ],                                                                        // Cheap Coat (his group)
    jb_4_2:[ {param:'sil.add',add:R(0.2)} ],                                                                        // Deep Pocket (ccExt)
    jb_4_3:[ {param:'nrg.hit',add:R(0.03)} ],                                                                       // Spare Breath (myHit)
    jb_n2:[  {param:'stl',add:1} ],                                                                                 // Spring the Lock (LINK: click; with Odd Key Out a Spare Key)
    jb_n3:[  {param:'rng',add:R(0.03)} ],                                                                           // Long Quill (tk)
    jb_5_2:[ {on:'kit',skill:LP,opt:{steal:{mul:1.4}}}, {param:'et',add:1} ],                                       // Empty Them (PICK ONE: castLP)
    jb_5_3:[ {on:'kit',skill:LP,opt:{steal:{mul:0.8}}}, {param:'ll.dur',add:4} ],                                   // Leave a Little (PICK ONE: castLP, tk)
    jb_5_4:[ {param:'clk',add:R(0.10)} ],                                                                           // Clicked (click)
    jb_6_1:[ {on:'out',if:{targetTeam:'enemy',targetMin:{energy:RIPE}},critMore:R(0.03)} ],                          // Just Before (at most 9%)
    jb_6_2:[ {param:'dr.bs',add:R(0.02)} ],                                                                         // Bare Shelves (needs Empty Them; castLP; both groups)
    jb_6_3:[ {param:'ll.dur',add:R(1)} ],                                                                           // Slow Refill (needs Leave a Little)
    jb_7_1:[ {param:'dr.ng',add:R(0.01)} ],                                                                         // Nerve Gone (both groups)
    jb_7_3:[ {on:'out',if:{casting:OED,targetTeam:'enemy'},more:R(0.03)} ],                                          // Every Door
    jb_7_4:[ {stat:{aspd:R(0.01)},per:{fn:'tbNow'}} ],                                                                // Practised Ear
    jb_8_1:[ {param:'sbr',add:R(1)} ],                                                                              // Second Breath (myHit)
    jb_8_2:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                                 // Quick Pick
    jb_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'tb3'},critMore:R(0.02)} ],                                         // Gap in the Guard (at most 10%)
    jb_9_4:[ {param:'cc2',add:1} ],                                                                                 // Click and Click (click / castLP)
    jb_9_1:[ {param:'smo',add:2} ],                                                                                 // Stolen Moment (drop: no Energy for 2 s)
    jb_9_2:[ {param:'lock.ripe',add:R(0.2)} ],                                                                      // Double Lock (ccExt)
    jb_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.40},more:R(0.02)} ],                                   // Turning the Key
    jb_11_2:[ {param:'lo',add:3} ],                                                                                 // Locked Out (castOED, tk)
    jb_10_1:[],                                                                                                     // Ripe Fruit (the always stat row: ripeAtk)
    jb_10_2:[ {param:'pnp',add:R(0.01)} ],                                                                          // Pick and Pocket (castLP; the heal budget)
    jb_10_4:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.005),per:'ts'} ],                                          // Tumbler Song
    jb_11_1:[ {on:'out',if:{targetTeam:'enemy',targetMin:{energy:100}},more:R(0.02)} ],                              // Waited Long Enough
    jb_11_3:[],                                                                                                     // Sharp Ears (critP)
    jb_12_1:[ {param:'btu',add:R(10)} ],                                                                            // Before They Use It (wv)
    jb_12_2:[ {stat:{atk:R(0.005)},per:'nl'} ],                                                                     // Nothing Left (drop)
    jb_12_3:[ {stat:{mr:R(-0.005)},to:{team:'enemy',fn:'tbSel'},per:{fn:'tbN'}} ],                                   // Patient Ear
    jb_12_4:[ {param:'spl',add:R(0.04)} ],                                                                          // Spoiled (tHeal)
    jb_13_2:[ {param:'tjb',add:1} ],                                                                                // Taken Just Before (SIGNATURE: enemyUlt)

    /* ============================== LUCK FOLLOWS HIM ============================== */
    lf_1_1:[ {param:'wk.k',add:R(0.03)} ],                                                                          // By a Whisker (fd; spent: myOut)
    lf_3_3:[ {on:'out',if:{casting:LP,targetTeam:'enemy'},more:R(0.03)} ],                                           // Bright Hook
    lf_1_4:[ {param:'spare',add:1}, {on:'out',if:{targetTeam:'enemy',fn:'spareOn'},critMore:R(0.03)} ],             // Odd Key Out (castAll: the Spare Key; while he holds it, 3% x 3 crit damage)
    lf_2_1:[ {param:'csh',add:R(0.02)}, {stat:{move:R(0.02)},per:'cs'} ],                                            // Close Shave (fd)
    lf_2_2:[ {param:'fav',add:R(0.04)} ],                                                                           // Fortune's Favour (tk: each Fortune gain)
    lf_11_3:[],                                                                                                     // Foxwise (was Sly; critP)
    lf_3_1:[ {on:'crit',if:{fn:'wk3'},force:true} ],                                                                // Missed Again (needs Close Shave's chain; a forced critical, not a chance)
    lf_4_2:[ {param:'ev.ch',add:R(0.01)} ],                                                                         // Charmed (points: tk, the talent dodge)
    lf_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Quick Feet
    lf_3_4:[ {param:'ev.wk',add:R(0.01)} ],                                                                         // Worn Key (tk)
    lf_4_1:[ {param:'dr.fc',add:R(0.015)} ],                                                                        // Fox Coat (his group)
    lf_4_3:[ {param:'nrg.crit',add:R(0.03)} ],                                                                      // Lucky Break (myHit)
    lf_6_4:[],                                                                                                      // Glint (fd; critP)
    lf_5_1:[ {on:'ccIn',less:R(0.04),upTo:0.20} ],                                                                  // Not Today (at most 20%)
    lf_6_1:[ {param:'dr.hb',add:R(0.03)} ],                                                                         // Hair's Breadth (his group)
    lf_5_4:[ {stat:{atk:R(0.004)},per:{fn:'keysN'}} ],                                                              // Ring Jingle
    lf_7_1:[ {param:'fl',add:R(0.005)} ],                                                                           // Fox's Luck (myOut; the heal budget)
    lf_7_3:[ {on:'out',if:{casting:OED,targetTeam:'enemy'},more:R(0.03)} ],                                          // Wide Open
    lf_7_4:[ {param:'sc',add:R(5)} ],                                                                               // Spare Change (castAll)
    lf_8_2:[ {on:'cd',skill:'blue',add:R(-0.1)} ],                                                                  // Quick Key
    lf_9_2:[],                                                                                                      // Lucky Shot (critP: basic attacks)
    lf_9_4:[ {param:'mk',add:1} ],                                                                                  // Doubled Spare (was Master Key; castAll)
    lf_8_1:[ {param:'wk.dur',add:R(1)} ],                                                                           // Long Whiskers (was Nine Lives)
    lf_5_2:[ {param:'bl',add:1} ],                                                                                  // Beginner's Luck (PICK ONE: wv)
    lf_5_3:[ {on:'out',if:{targetTeam:'enemy',fn:'muNow'},more:P('lr',0.20)} ],                                       // Loaded Ring (PICK ONE)
    lf_8_3:[ {on:'out',if:{targetTeam:'enemy',fn:'muNow'},critMore:R(0.04)} ],                                       // Finds the Gap (abilities only: at most 20%)
    lf_9_1:[ {on:'in',once:'wave',if:{srcTeam:'enemy',dropBelow:0.20},do:[{miss:true},{fn:'charmedLife'}]} ],        // Charmed Life (needs Long Whiskers' chain)
    lf_6_2:[ {stat:{aspd:R(0.02)},if:{fn:'blOn'}} ],                                                                // Fast Start (needs Beginner's Luck)
    lf_6_3:[ {param:'lr',add:R(0.04)} ],                                                                            // Heavy Ring (points; needs Loaded Ring)
    lf_9_3:[ {on:'out',if:{targetTeam:'enemy',targetHpBelow:0.40},more:R(0.02)} ],                                   // Last Lock
    lf_10_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ],                                           // Good Fortune
    lf_11_1:[ {param:'ev.tl',add:R(0.005)} ],                                                                       // Twice Lucky (myOut, tk)
    lf_11_2:[ {param:'elo',add:1} ],                                                                                // Every Lock Opens (castLP)
    lf_n1:[  {on:'out',if:{targetTeam:'enemy',fn:'late20'},more:R(0.02)}, {param:'lh',add:1} ],                       // Luck Holds (fd: 2 Whiskers)
    lf_12_1:[ {on:'out',once:'wave',if:{targetTeam:'enemy'},critMore:R(0.03)} ],                                     // Opening Toss (was Lucky Coin; at most 9%)
    lf_12_2:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.005),per:'ffl'} ],                                         // Fortune's Fool (castAll)
    lf_12_3:[ {param:'ne',add:R(0.01)} ],                                                                           // Narrow Escape (fd; the heal budget)
    lf_12_4:[ {param:'dr.r5',add:R(0.03)} ],                                                                        // Ring of Five (his group)
    lf_13_2:[ {param:'svn',add:1} ]                                                                                 // The Seventh Lock (SIGNATURE: kitAll / castAll)
  },
  needs:{ fe_6_3:'fe_5_3', fe_6_2:'fe_5_2', jb_6_2:'jb_5_2', jb_6_3:'jb_5_3', lf_6_2:'lf_5_2', lf_6_3:'lf_5_3' },
  fn:{
    /* ---- EACH TICK ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), r=T.r, Pp=T.P, now=E.now(), dt=c.dt||0; o.api=A;   // the runtime API kept for the tests' and the 95% probe's pure reads (drK, critP)
      if(o.f==null) o.f={ult:AULT.some(id=>r[id])||!!Pp.tjb, nrg:NRG.some(id=>r[id]), cas:!!Pp['case'], pic:!!Pp.pic, ev:!!(Pp['ev.ch']||Pp['ev.wk']||Pp['ev.tl']), rng:Pp.rng>0, fort:!!(Pp.fav||Pp['ev.ch'])};
      const f=o.f;
      if(f.rng){ if(o.rg0==null) o.rg0=u.range; u.range=o.rg0*(1+Pp.rng); }                                    // Long Quill: his reach
      if(o.sigCd>0) o.sigCd-=dt; if(o.tjCd>0) o.tjCd-=dt;                                                         // the two signatures' 20 s, as countdowns (the battle clock restarts each wave)
      if(f.fort){ const m=u._masterT||0; if(m===1&&o.mt!==1) T.fn.fortune(A,T,u); o.mt=m; }                        // the passive has just added Fortune
      if(f.ult) T.fn.ultScan(A,T,u);
      if(f.nrg) T.fn.nrgWatch(A,T,u);
      if(f.cas){ const cs=o.cas||(o.cas={}); for(const x of enemies(A,u)){ if(ripe(x)&&cs[x.uid]!==T.s.wave){ cs[x.uid]=T.s.wave; gainE(u,Pp['case']); } } }   // Casing the Job: the first time each enemy is Ripe in a wave
      if(f.pic){ const a=accOf(T,u), low=!!a&&a.hp<0.30*a.maxHp; if(low&&!o.picWas&&o.picW!==T.s.wave){ o.picW=T.s.wave; o.fkTo=a; try{ cast0(A,T,u,'blue',a); } finally{ o.fkTo=null; } } o.picWas=low; }   // Covering Hand: Forbidden Key at once on it, once a wave
      if(f.ev) T.fn.eva(A,T,u,now); },
    wv(A,T,u,c){ const o=S(T), E=A.eng(), Pp=T.P, r=T.r;
      o.w0=E.now(); o.tb=null; o.tbH=[]; o.lc=null; o.stlW=null;
      for(const x of E.units()) if(x._talUltBy===u){ x._talUltT=0; x._talUltBy=null; }
      if(ACC.some(id=>r[id])){ const L=allies(A,u); let b=null,bv=-1; for(const x of L){ const v=Math.max(+x.dmg||0,+x.apow||0); if(v>bv){ bv=v; b=x; } } o.acc=b;   // the Accomplice: the ally with the highest attack or ability power
        if(b&&Pp.od) gainE(b,Pp.od); }
      if(Pp.btu) gainE(u,Pp.btu);
      if(Pp.bl&&u.pass&&u.pass.skeletonkey){ u._keys=Math.max(u._keys||0,2); o.bl=true; } },
    /* ---- THE PASSIVE'S FORTUNE: Fortune's Favour adds its share each time the passive adds Fortune; Charmed reads that he has Fortune ---- */
    fortune(A,T,u){ const o=S(T), k=T.P.fav||0, pm=u.passMul||1; o.fortN=(o.fortN||0)+1; if(!(k>0)) return;
      u.critDmg=(u.critDmg||0.6)+0.05*pm*k; u.evaStat=Math.min(EVA_TOP,(u.evaStat||0)+0.03*pm*k); },
    /* his talent dodge (Charmed, Worn Key, Twice Lucky), added to the game's own Evasion (his Fortune): at most 10% in all, and his dodge never above 50% */
    eva(A,T,u,now){ const o=S(T), Pp=T.P; let w=0;
      if(Pp['ev.ch']&&(o.fortN||0)>0) w+=Pp['ev.ch'];
      if(Pp['ev.wk']&&o.spare) w+=Pp['ev.wk'];
      if(Pp['ev.tl']&&o.tl){ for(let i=0;i<o.tl.length;i++){ if(now>=o.tl[i][0]){ o.tl.splice(i--,1); continue; } w+=o.tl[i][1]; } }
      w=Math.min(EVA_CAP,w); const had=o.evA||0, base=(u.evaStat||0)-had, got=Math.max(0,Math.min(w,EVA_TOP-base)); if(Math.abs(got-had)>1e-12){ u.evaStat=base+got; o.evA=got; } },
    /* ---- ULTIMATE PRESSES: a new pending cast that is not a Green / Blue (castAbility at the press: its Energy is already spent) ---- */
    ultScan(A,T,u){ const o=S(T), E=A.eng(), pd=o.pd||(o.pd={});
      for(const x of E.units()){ const p=x.alive?(x._pend||null):null, was=pd[x.uid]||null; pd[x.uid]=p; if(!p||p===was||p.spell) continue;
        if(x===u) continue; if(x.team===u.team){ if(!x._summon) T.fn.allyUlt(A,T,u,x); } else T.fn.enemyUlt(A,T,u,x,p); }
      if(o.tjX){ const x=o.tjX; if(!x.alive||x._pend!==o.tjP){ A.setMark(T,u,x,'tjb',{dur:1.5}); o.tjX=null; o.tjP=null; } } },   // the held Ultimate came out (or was stopped): 1.5 s more of its hits are weaker
    allyUlt(A,T,u,x){ const o=S(T), Pp=T.P, E=A.eng();
      if(rk(T,'fe_12_2')) A.acts(T,u,[{stack:'sl',add:1}],{u});                                                  // Sooner and Larger: every allied Ultimate
      if(x!==accOf(T,u)) return;
      if(Pp['pt.key']&&u.pass&&u.pass.skeletonkey) u._keys=Math.min(5,(u._keys||0)+1);                           // Partners
      if(Pp.lko) T.fn.heal(A,T,u,Pp.lko*u.maxHp);                                                                 // Lookout
      if(Pp.egm&&!(o.sigCd>0)){ o.sigCd=SIG_CD;                                                                    // Everyone's Great Moment: Master-Unlocked as by Forbidden Key
        const mul=((u.blueAb&&u.blueAb.muUltMul)||1.5)+(Pp['acc.ult']||0)+(Pp.gen||0), d=(u.blueAb&&u.blueAb.dur)||6;
        x.dmgBuffMul=Math.max(x.dmgBuffMul||1,mul); x.dmgBuffT=Math.max(x.dmgBuffT||0,d); x._buffedT=0.5;
        if(E.ctrlBonus) E.ctrlBonus(x,0.6,d,0.95); x.stunned=0; x.fearT=0; x.silencedT=0;
        for(const y of allies(A,u)) if(y!==x) gainE(y,20);
        A.acts(T,u,[{window:'hot',end:true}],{u}); } },                                                           // he puts everything he carries into it
    /* Taken Just Before: once every 20 s, an enemy's Ultimate press. Lockpick Soul at once at it (never Master-Unlocked: no silence), the Ultimate held 2 s,
       its hits 30% weaker until 1.5 s after it comes out; his team shares 30 Energy (split evenly, Nox included) */
    enemyUlt(A,T,u,x,p){ const o=S(T), E=A.eng(); if(!T.P.tjb||o.tjCd>0||!u.alive) return; o.tjCd=SIG_CD;
      p.t+=2; A.setMark(T,u,x,'tjb',{}); o.tjX=x; o.tjP=p;
      if(x.alive){ o.noMu=true; try{ cast0(A,T,u,'green',x); } finally{ o.noMu=false; } }
      const L=allies(A,u).concat([u]); for(const y of L) gainE(y,30/L.length); },
    /* ---- ENERGY A UNIT GAINS (each tick: what it gained since the last tick): Old Partners (the Accomplice, 3% x 3 more from every source),
       Leave a Little (25% slower), Locked Out and Stolen Moment (none) ---- */
    nrgWatch(A,T,u){ const o=S(T), E=A.eng(), Pp=T.P, ev=o.ev||(o.ev={}), a=accOf(T,u);
      for(const x of E.units()){ if(!x.alive){ delete ev[x.uid]; continue; } let k=null;
        if(x.team!==u.team){ if(A.markOf(u,x,'lo')||A.markOf(u,x,'smo')) k=0; else if(A.markOf(u,x,'ll')) k=0.75; }
        else if(x===a&&Pp.op) k=1+Pp.op;
        if(k==null){ delete ev[x.uid]; continue; }
        const e=x.energy||0, l=ev[x.uid]; if(l!=null&&e>l+1e-9) x.energy=Math.min(100,l+(e-l)*k); ev[x.uid]=x.energy||0; } },
    nrgMark(A,T,u,x){ const ev=S(T).ev||(S(T).ev={}); ev[x.uid]=x.energy||0; },                                 // a unit starts being watched: from the Energy it holds now
    /* ---- THE THREE SKILLS: at the kit (before the skill's own code) and at the cast (after it) ---- */
    kitAll(A,T,u,c){ const o=S(T), E=A.eng(), e0=o.e0=new Map(); for(const x of E.units()) if(x.alive) e0.set(x,x.energy||0);
      const pass=!!(u.pass&&u.pass.skeletonkey); o.mu=false; o.forced=false; o.hold=null; o.spareUse=false;
      if(o.noMu&&pass&&(u._keys||0)>=5){ o.hold=u._keys; u._keys=4; }                                             // the signature's hook is never Master-Unlocked (its keys wait)
      else if(T.P.svn&&pass&&((o.nCast||0)+1)%7===0){ o.k0=u._keys||0; o.m0=u._masterT||0; u._keys=5; o.forced=true; }   // The Seventh Lock: Master-Unlocked without spending his keys
      o.mu=pass&&(u._keys||0)>=5; o.spareUse=o.mu&&!!o.spare&&!o.forced; o.keyAt=u._keys||0; },
    castAll(A,T,u,c){ const o=S(T), Pp=T.P, sk=c.skill; o.nCast=(o.nCast||0)+1;
      if(o.hold!=null){ u._keys=Math.min(5,o.hold+(sk===OED?3:0)); o.hold=null; }
      if(o.mu){ if(rk(T,'lf_12_2')) A.acts(T,u,[{stack:'ffl',add:1}],{u});
        if(o.spareUse&&Pp.sc) gainE(u,Pp.sc);                                                                       // Spare Change: a Master-Unlock that used the Spare Key
        if(o.forced){ u._keys=Math.min(5,(o.k0||0)+(sk===OED?3:0)+1); u._masterT=o.m0; o.spare=true;               // The Seventh Lock: his keys kept, a Spare Key left, 3 Whiskers
          if(WK.some(id=>T.r[id])) A.acts(T,u,[{stack:'wk',add:3}],{u}); }
        else { o.bl=false; o.spare=false;
          if(Pp.spare){ u._keys=Math.min(5,(u._keys||0)+(Pp.mk?2:1)); o.spare=true; } } }                           // Odd Key Out: one key stays (Doubled Spare: counts twice)
      o.mu=false; o.forced=false; o.e0=null; },
    muNow(A,T){ const o=S(T); return !!o.mu&&(T.s.cur===LP||T.s.cur===OED); },
    /* ---- LOCKPICK SOUL ---- */
    jitHold(A,T,u,c){ const x=c.tgt; if(!x||x.team===u.team) return; x._talUltT=A.eng().now()+1.0; x._talUltBy=u; },   // Just in Time: no Ultimate until the hook lands (the shot flies at most 0.8 s)
    kitLP(A,T,u,c){ const o=S(T), E=A.eng(), op=c.o||{}, F=enemies(A,u).sort((a,b)=>(b.energy||0)-(a.energy||0)); o.lpH=new Map();
      const h=(op._tgtU&&op._tgtU.alive&&F.indexOf(op._tgtU)>=0)?op._tgtU:F[0]; o.lpHook=h||null; o.lpPicks=[]; if(h){ o.lpPicks.push(h); if(o.mu) for(let i=0;i<F.length&&o.lpPicks.length<3;i++) if(F[i]!==h) o.lpPicks.push(F[i]); }
      for(const x of E.units()) if(x._talUltBy===u&&(x===h||!x.alive)){ x._talUltT=0; x._talUltBy=null; } },
    lpHit(A,T,u,c){ const o=S(T); if(o.lpH) o.lpH.set(c.tgt,c.tgt.energy||0); },
    castLP(A,T,u,c){ const o=S(T), Pp=T.P, E=A.eng(), op=c.o||{}, steal=op.steal||30, e0=o.e0||new Map(); let tot=0; const now=E.now();
      for(const x of (o.lpPicks||[])){ const pre=o.lpH&&o.lpH.has(x)?o.lpH.get(x):(e0.get(x)||0), take=Math.min(steal,pre);   // the skill takes min(steal, what it held after the hit)
        if(!(take>0)) continue; tot+=take; T.fn.robbed(A,T,u,x);
        if(pre>=RIPE){ if(Pp.bbs) T.fn.drain(A,T,u,x,Pp.bbs,true,true); if(Pp.pp) gainE(u,take*Pp.pp); }             // Breath Before the Swing, Prime Pickings
        T.fn.dropChk(A,T,u,x,pre);
        if(Pp['ll.dur']){ A.setMark(T,u,x,'ll',{dur:Pp['ll.dur']}); T.fn.nrgMark(A,T,u,x); }                         // Leave a Little (Slow Refill longer)
        if(Pp.et&&Pp['dr.bs']&&(x.energy||0)<20) A.setMark(T,u,x,'bs',{dur:3}); }                                   // Bare Shelves
      if(tot>0) T.fn.stole(A,T,u,c);
      const h=o.lpHook;
      if(!o.mu&&u.pass&&u.pass.skeletonkey){
        if(Pp.et&&h&&(e0.get(h)||0)<RIPE) u._keys=Math.max(0,(u._keys||0)-1);                                        // Empty Them: no Skeleton Key off a target that was not Ripe
        if(o.cc2){ u._keys=Math.min(5,(u._keys||0)+1); o.cc2=false; } }                                            // Click and Click: this one gives 2
      if(Pp.em&&h&&h.alive) A.setMark(T,u,h,'em',{dur:3});                                                         // Easy Mark
      if(Pp.pnp) T.fn.heal(A,T,u,Pp.pnp*u.maxHp);                                                                  // Pick and Pocket
      if(o.mu&&Pp.elo&&WK.some(id=>T.r[id])) A.acts(T,u,[{stack:'wk',add:3}],{u});                                  // Every Lock Opens
      o.lpPicks=null; o.lpH=null; o.lpHook=null; },
    stole(A,T,u,c){ const o=S(T), E=A.eng(); if(HOT.some(id=>T.r[id])){ A.acts(T,u,[{window:'hot',dur:3+(T.P['hot.dur']||0)}],c); o.stoleAt=E.now(); } },   // Hot Goods
    robbed(A,T,u,x){ if(T.P['dr.nt']||rk(T,'fe_11_3')) A.setMark(T,u,x,'rb',{}); },                               // an enemy he has stolen from (Never Trusted, Clever Hands)
    /* Energy a talent of his takes from an enemy (toNox: he gets it); a Ripe enemy he drops below 70 */
    drain(A,T,u,x,n,toNox,noDrop){ if(!x||!x.alive||!(n>0)) return 0; const pre=x.energy||0, t=Math.min(pre,n); x.energy=pre-t; if(toNox) gainE(u,t); if(t>0) T.fn.robbed(A,T,u,x); if(!noDrop) T.fn.dropChk(A,T,u,x,pre); return t; },
    dropChk(A,T,u,x,pre,after){ const Pp=T.P; if(!(pre>=RIPE)||(after!=null?after:(x.energy||0))>=RIPE) return;
      if(Pp.smo&&x.alive){ A.setMark(T,u,x,'smo',{dur:Pp.smo}); T.fn.nrgMark(A,T,u,x); }                            // Stolen Moment: no Energy for 2 s
      if(rk(T,'jb_12_2')) A.acts(T,u,[{stack:'nl',add:1}],{u}); },                                                // Nothing Left
    /* ---- FORBIDDEN KEY ---- */
    kitFK(A,T,u,c){ const o=S(T), Pp=T.P, op=c.o, E=A.eng(); o.fkHeld=o.keyAt; o.fkT=null;
      if(Pp['hot.k']&&A.winOn(T,'hot')&&op){ let k=Pp['hot.k']; if(Pp.stt&&o.stoleAt!=null&&E.now()-o.stoleAt<=1+1e-9) k*=2;   // Still Warm (Straight to Them: double within 1 s of the steal)
        const m=1+k; for(const f of ['give','perLv','perKey']) if(typeof op[f]==='number') op[f]*=m; o.fkHot=true; } else o.fkHot=false;
    },
    fkTgt(A,T,u,c){ const o=S(T), a=accOf(T,u); if(o.fkTo&&o.fkTo.alive) c.tgt=o.fkTo; else if(a&&rk(T,'fe_1_1')) c.tgt=a; o.fkT=c.tgt; },   // A Friend on the Inside: always the Accomplice
    castFK(A,T,u,c){ const o=S(T), Pp=T.P, E=A.eng(), op=c.o||{}, e0=o.e0||new Map(), Rv=o.fkT; if(!Rv) return;
      const lv=(u._castLv|0)||1, give=Math.max(0,(E.skLvNum?E.skLvNum('energygift',op,lv):(op.give||25))+(op.perKey||6)*(o.fkHeld||0)), L=[Rv];
      if(Pp.spread){ let b=null,bv=-1; for(const x of allies(A,u)) if(x!==Rv&&(e0.get(x)||0)>bv){ bv=e0.get(x)||0; b=x; }   // Spread It Around: and the other ally nearest its Ultimate
        const sh=give*1.2/(b?2:1); if(!o.mu) Rv.energy=Math.min(100,(e0.get(Rv)||0)+sh); if(b){ gainE(b,sh); L.push(b); }
        if(Pp['dr.fs']) for(const x of L) A.setMark(T,u,x,'fs',{dur:3}); }
      if(Rv===accOf(T,u)&&Pp['acc.ult']){ const m=(o.mu?(op.muUltMul||1.5):(op.ultMul||1.25))+Pp['acc.ult']; Rv.dmgBuffMul=Math.max(Rv.dmgBuffMul||1,m); }   // its Ultimate: 2 points x 5 more from it
      if(Pp.sb4) A.setMark(T,u,Rv,'sb4',{dur:4});                                                                   // Sole Buyer
      if(Pp.fc) gainE(u,Pp.fc);                                                                                     // Fence's Cut
      if(Pp.ho&&o.fkHot) for(const x of L) if(x.alive) E.healUnit(x,Pp.ho*x.maxHp);                                // Hand-Off
      if(rk(T,'fe_8_2')) A.acts(T,u,[{stack:'cou',add:1}],{u});                                                   // Courier
      o.fkT=null; },
    /* ---- OPEN EVERY DOOR ---- */
    kitOED(A,T,u,c){ const o=S(T); o.oRipe=new Set(); for(const [x,e] of (o.e0||[])) if(x.team!==u.team&&e>=RIPE) o.oRipe.add(x); },
    castOED(A,T,u,c){ const o=S(T), Pp=T.P, op=c.o||{}, steal=op.steal||35, e0=o.e0||new Map(); let tot=0;
      for(const [x,pre] of e0){ if(x.team===u.team) continue; const take=Math.min(steal,pre); if(take>0){ tot+=take; T.fn.robbed(A,T,u,x); if(pre>RIPE&&Pp.pp) gainE(u,take*Pp.pp); }
        if(x.alive){ T.fn.dropChk(A,T,u,x,pre,pre-take);                                                            // (it took the Energy before its hits gave the 7 back)
          if(Pp.lo){ A.setMark(T,u,x,'lo',{dur:Pp.lo}); T.fn.nrgMark(A,T,u,x); } } }                                // Locked Out
      if(tot>0) T.fn.stole(A,T,u,c);
      if(Pp.mog){ const a=accOf(T,u); if(a){ let pool=0; for(const x of allies(A,u)){ if(x===a) continue; const g=Math.max(0,(x.energy||0)-(e0.get(x)||0)); if(g>0){ x.energy-=g; pool+=g; } } gainE(a,pool); } }   // Moment of Glory
      o.oRipe=null; },
    /* his controls, made longer after they land, in full (WIRING/00), at most 4.0 s: Deep Pocket (Lockpick Soul's Master-Unlocked silence), Long Lock and
       Double Lock (Open Every Door's locks: its stun and its silence; Double Lock on enemies that were Ripe when it was cast) */
    ccExt(A,T,u,c){ const o=S(T), Pp=T.P, t=c.tgt, f=c.field, a=c.amt||0; if(!t||!t.alive||!(a>0)||c.talent) return; let add=0;
      if(T.s.cur===LP&&f==='silencedT'&&o.mu) add=Pp['sil.add']||0;
      else if(T.s.cur===OED&&(f==='stunned'||f==='silencedT')){ add=Pp['lock.add']||0; if(o.oRipe&&o.oRipe.has(t)) add+=Pp['lock.ripe']||0; }
      if(add>0) t[f]=Math.max(t[f]||0,Math.min(CC_TOP,a+add)); },
    /* ---- HIS HITS ---- */
    myOut(A,T,u,c){ const o=S(T), Pp=T.P, t=c.tgt; o.outRipe=ripe(t);
      if(Pp.em&&A.markOf(u,t,'em')) c.amt*=1+Pp.em;                                                                 // Easy Mark (his own hits)
      const n=wkN(T); if(n>0&&c.kind==='magic'){ if(Pp['wk.k']) c.amt*=1+Pp['wk.k']*n;                               // By a Whisker: his next magic hit spends them all
        A.stSet(T,u,'wk',0); if(Pp.fl) T.fn.heal(A,T,u,Pp.fl*n*u.maxHp);                                            // Fox's Luck
        if(Pp['ev.tl']){ (o.tl||(o.tl=[])).push([A.eng().now()+3,Pp['ev.tl']*n]); } } },                             // Twice Lucky
    myHit(A,T,u,c){ const o=S(T), Pp=T.P, t=c.tgt; if(!t) return;
      if(c.auto){ if(Pp['nrg.hit']) gainE(u,11*Pp['nrg.hit']); if(c.crit&&Pp['nrg.crit']) gainE(u,11*Pp['nrg.crit']);   // Pocket Change, Spare Breath, Lucky Break
        if(Pp.sbr&&o.outRipe&&t.alive) T.fn.drain(A,T,u,t,Pp.sbr,true); }                                           // Second Breath
      if(TB.some(id=>T.r[id])&&t.alive&&(c.auto||(T.s.cur===LP&&t===o.lpHook))) T.fn.tumbler(A,T,u,t); },
    /* TUMBLERS: each basic attack (and Lockpick Soul's hooked target) on the same enemy sets one, max 5; another enemy struck: they fall (Light Touch: they
       stay on the old one 0.4 s x rank, and come back if he strikes it again in that time). At 5 the lock clicks */
    tumbler(A,T,u,t){ const o=S(T), now=A.eng().now(), g=T.P['tb.grace']||0; let tb=o.tb;
      if(!tb||tb.t!==t){ const H=o.tbH||(o.tbH=[]); for(let i=H.length-1;i>=0;i--) if(now>=H[i].until||!H[i].t.alive) H.splice(i,1);
        if(tb&&tb.t&&tb.t.alive&&tb.n>0&&g>0) H.push({t:tb.t,n:tb.n,until:now+g});
        let n=0; for(let i=0;i<H.length;i++) if(H[i].t===t){ n=H[i].n; H.splice(i,1); break; } tb=o.tb={t,n}; }
      tb.n=Math.min(5,tb.n+1); if(tb.n>=5){ tb.n=0; T.fn.click(A,T,u,t); } },
    click(A,T,u,t){ const o=S(T), Pp=T.P, pre=t.energy||0; let loss=Pp['tb.k']||0;
      if(Pp.stl&&pre>=RIPE&&o.stlW!==T.s.wave){ o.stlW=T.s.wave; loss+=2;                                          // Spring the Lock: the first Ripe click of the wave
        if(rk(T,'lf_1_4')&&!o.spare&&u.pass&&u.pass.skeletonkey){ o.spare=true; u._keys=Math.min(5,(u._keys||0)+1); } }   // with Odd Key Out: a Spare Key (he still holds only one)
      if(loss>0) T.fn.drain(A,T,u,t,loss,false);
      if(Pp.clk&&t.alive) A.acts(T,u,[{dmg:{pct:Pp.clk,of:'atk'},on:'target',def:'magic'}],{u,src:u,tgt:t});       // Clicked
      if(rk(T,'jb_10_4')) A.acts(T,u,[{stack:'ts',add:1}],{u});                                                    // Tumbler Song
      if(Pp.cc2) o.cc2=true; },                                                                                     // Click and Click
    tbNow(A,T){ const tb=S(T).tb; return (tb&&tb.t&&tb.t.alive)?tb.n:0; },                                           // the Tumblers set now (on whichever enemy)
    tbN(A,T,u,c){ const tb=S(T).tb; return (tb&&tb.t&&tb.t.alive&&c&&c.tgt===tb.t)?tb.n:0; },                         // on that enemy
    tbSel(A,T,u,c){ const tb=S(T).tb; return !!tb&&tb.t===c.tgt&&tb.n>0; },
    tb3(A,T,u,c){ const tb=S(T).tb; return !!tb&&tb.t===c.tgt&&tb.n>=3; },
    /* ---- A FORTUNE DODGE (the game's Evasion made an enemy's hit miss him; Charmed Life's miss counts as one) ---- */
    fd(A,T,u,c,a){ const o=S(T), Pp=T.P, E=A.eng(); let n=(Pp.lh&&o.w0!=null&&E.now()-o.w0>=20-1e-9)?2:1;        // Luck Holds: from 20 s into the wave, 2
      if(WK.some(id=>T.r[id])){ const h=wkN(T); if(a&&a.set3) A.acts(T,u,[{stack:'wk',set:3}],{u}); else A.acts(T,u,[{stack:'wk',add:n}],{u}); n=Math.max(0,wkN(T)-h);
        if(Pp.csh&&n>0) A.acts(T,u,[{stack:'cs',add:n}],{u}); }                                                     // Close Shave: each Whisker 2 s of speed
      if(rk(T,'lf_6_4')) A.acts(T,u,[{window:'gl',dur:3}],{u});                                                   // Glint
      if(Pp.ne) T.fn.heal(A,T,u,Pp.ne*u.maxHp); },                                                                 // Narrow Escape
    charmedLife(A,T,u,c){ T.fn.fd(A,T,u,c,{set3:true}); },
    wk3(A,T,u,c){ return wkN(T)>=3&&c.kind==='magic'; },
    late20(A,T){ const o=S(T); return o.w0!=null&&A.eng().now()-o.w0>=20-1e-9; },
    blOn(A,T){ return !!S(T).bl; },
    spareOn(A,T){ return !!S(T).spare; },
    accAlive(A,T,u){ return !!accOf(T,u); },
    keysN(A,T,u){ return Math.max(0,Math.min(5,u._keys||0)); },
    ripeAtk(A,T,u){ let n=0; for(const x of enemies(A,u)) if(ripe(x)) n++; return 0.01*rk(T,'jb_10_1')*Math.min(4,n); },
    /* his critical-chance talents, ONE group, at most 5%: Steel Pick, Foxwise (plain until now), Sharp Ears (the enemy his Tumblers are on), Clever Hands
       (an enemy he has stolen from), Glint (3 s after a Fortune dodge), Lucky Shot (basic attacks). One seeded roll when the hit is struck */
    critP(A,T,u,c){ const r=T.r, t=c.tgt, tb=S(T).tb; let x=0.01*(r.jb_1_3||0)+0.01*(r.lf_11_3||0);
      if(r.jb_11_3&&tb&&tb.t===t&&tb.n>0) x+=0.015*r.jb_11_3;
      if(r.fe_11_3&&A.markOf(u,t,'rb')) x+=0.02*r.fe_11_3;
      if(r.lf_6_4&&A.winOn(T,'gl')) x+=0.02*r.lf_6_4;
      if(r.lf_9_2&&c.auto) x+=0.02*r.lf_9_2;
      return Math.min(CRIT_CAP,x); },
    /* ---- HIS DAMAGE REDUCTION: ONE capped group, at most 40% (the shares multiply). The signature's weakened Ultimate is the attacker's own 30%, on top ---- */
    drK(A,T,u,c,dot){ const o=S(T), Pp=T.P, s=c.src; let k=1; const f=x=>{ if(x>0) k*=1-x; };
      if(!dot&&Pp['dr.le']&&s){ const le=o.le||(o.le={}); if(le[s.uid]!==T.s.wave){ if(!c.probe) le[s.uid]=T.s.wave; f(Pp['dr.le']); } }   // Lookout's Eye: the first hit each enemy lands on him in a wave
      if(Pp['dr.ll']&&A.winOn(T,'hot')) f(Pp['dr.ll']);
      if(Pp['dr.cou']) f(Pp['dr.cou']*A.stGet(T,'cou'));
      if(Pp['dr.nt']&&s&&A.markOf(u,s,'rb')) f(Pp['dr.nt']);
      if(Pp['dr.cc']&&ripe(s)) f(Pp['dr.cc']);
      if(Pp['dr.ng']&&ripe(s)) f(Pp['dr.ng']);
      if(Pp['dr.bs']&&s&&A.markOf(u,s,'bs')) f(Pp['dr.bs']);
      if(Pp['dr.fc']&&wkN(T)>0) f(Pp['dr.fc']);
      if(!dot&&Pp['dr.hb']&&c.crit) f(Pp['dr.hb']);
      if(Pp['dr.r5']&&(u._keys||0)>=5) f(Pp['dr.r5']);
      k=Math.max(DR_FLOOR,k);
      if(Pp.tjb&&s&&!c.auto&&A.markOf(u,s,'tjb')) k*=1-ULT_WEAK;
      return k; },
    myIn(A,T,u,c){ if(!foe(u,c.src)) return; c.amt*=T.fn.drK(A,T,u,c,false); },
    myDot(A,T,u,c){ if(!c.src||!foe(u,c.src)) return; c.amt*=T.fn.drK(A,T,u,{src:c.src,kind:'dot',auto:true,crit:false},true); },
    /* hits on his allies (their group, at most 25%: Trusted Hand on the Accomplice, Fair Shares, Nerve Gone, Bare Shelves; and the signature's weakened
       Ultimate on top), and his team's hits on enemies (Inside Job: the Accomplice's, Easy Mark: anyone's on the marked enemy) */
    tIn(A,T,u,c){ const Pp=T.P, t=c.tgt, s=c.src; if(!t||!s) return;
      if(mate(u,t)&&foe(u,s)){ let k=1; const f=x=>{ if(x>0) k*=1-x; };
        if(Pp['dr.th']&&t===accOf(T,u)) f(Pp['dr.th']);
        if(Pp['dr.fs']&&A.markOf(u,t,'fs')) f(Pp['dr.fs']);
        if(Pp['dr.ng']&&ripe(s)) f(Pp['dr.ng']);
        if(Pp['dr.bs']&&A.markOf(u,s,'bs')) f(Pp['dr.bs']);
        k=Math.max(TEAM_FLOOR,k); if(Pp.tjb&&!c.auto&&A.markOf(u,s,'tjb')) k*=1-ULT_WEAK; c.amt*=k; return; }
      if(foe(u,t)&&mate(u,s)&&s!==u){ if(Pp.ij&&s===accOf(T,u)) c.amt*=1+Pp.ij; if(Pp.em&&A.markOf(u,t,'em')) c.amt*=1+Pp.em; } },
    /* healing: Well Liked (allies within 4 m of him, 1% x 5 more from every source), Spoiled (Ripe enemies, 4% x 3 less) */
    tHeal(A,T,u,c){ const Pp=T.P, x=c.unit; if(!x) return;
      if(x.team===u.team){ if(Pp.wl&&x!==u&&A.gap(u,x)<4*A.eng().METER()) c.amt*=1+Pp.wl; }
      else if(Pp.spl&&ripe(x)) c.amt*=1-Pp.spl; },
    /* his own burst heals (Lookout, Pick and Pocket, Fox's Luck, Narrow Escape) share ONE budget that fills at 1.2% of his max HP a second (at most 10 s kept):
       the regeneration cap */
    heal(A,T,u,x){ const o=S(T), E=A.eng(), now=E.now(), cap=REGEN*(u.maxHp||0); if(o.rgAt==null){ o.rgAt=now; o.rgV=cap; }
      o.rgV=Math.min(10*cap,(o.rgV||0)+cap*Math.max(0,now-o.rgAt)); o.rgAt=now; const g=Math.min(x,o.rgV); if(g>0){ o.rgV-=g; E.healUnit(u,g); } return g; }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/43 - NOX QUILLFINGER - talent decisions.md) */
  ruling:{}
};
