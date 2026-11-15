/* GRIMSBY - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Grimsby")
   His real kit (the code, not the tooltip wording; his skills read Attack, his hits are physical, a ranged Bruiser who stands about 11 m from his target):
   - Overdue ('debtmark', green, cd 6): one hit of 50% of his attack on his target; the target's Overdue stacks (the engine's _debtStk) rise by 1 (max 6),
     and a NEW notice is pushed each cast: a DoT of 35% of his attack a second x the stacks it now has, for 6 s (colour #8a7a3a: a curse, so its ticks are
     MAGIC, through magic resist). The stacks NEVER fall in the game (only a new wave's new enemies start at 0); a notice is never refreshed (each cast is a
     new DoT). In 18 seeded fights only 2 enemies ever reached 6 stacks (most die at 1): tests/grimsby-kit-facts.js.
     Its burst when a debtor dies (in damage(): 160% of the debt on every enemy within 3 m of the debtor, centre to centre) reached nobody in 69 debtor deaths.
   - Ledger Slam ('pullsilence', blue, cd 10, delivered 'form'): every enemy within 4 m of HIM (centre to centre; v1391 moves the centre to his target, same
     radius) is silenced (the table's 2 s x 0.7 = 1.4 s), taunted onto him for 2 s and dragged toward him for 2 s at the engine's drag speed (about 0.8 m/s).
     It caught somebody in 6 of 70 casts. His talents read the enemies it really taunted (a snapshot at kit, compared at cast), so they work whatever its centre.
   - Compound Interest (passive 'debtaura'): every DoT pushed on an enemy whose centre is within 5 m of his makes it last 20% (+0.1 point a level) longer
     (inside pushDot). 26 of 351 DoTs in those fights were pushed that near. Interest Only changes its share through the 'num' hook 'debtaura'.
   - Foreclosure ('aoedot', ultimate, on energy - no cooldown): ULT_DEF.aoedot (mul 1.2, dps 0.7, dur 5, radius 99999: every enemy) with HERO_ULT_ART.grimsby
     (art only): 120% of his attack to every enemy, and a DoT of 70% of his attack a second for 5 s (colour #ffa657: physical, through armor). The game calls
     it a bleed ("bleeds for it"); his talents call it Foreclosure's bleed.
   Arrears, Late Fee, Served, Deposit, Entries and Lien exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/24 - GRIMSBY - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const OD='debtmark', LS='pullsilence', FC='aoedot', ODC='#8a7a3a', FCC='#ffa657';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const AR=['ci_1_1','ci_2_1','ci_3_1','ci_4_1','ci_n2','ci_6_1','ci_10_1','ci_11_1','ci_11_2','ci_12_2','ci_13_2'];
const SRVN=['ev_4_3','ev_6_1','ev_11_2','ev_12_2','ev_12_3'];
const LIEN=['ne_1_4','ne_2_4','ne_3_4','ne_4_4','ne_n1','ne_5_4','ne_6_4','ne_7_4','ne_10_4','ne_11_1','ne_12_4','ne_9_4'];
const DEP=['ev_1_4','ev_2_4','ev_5_4','ev_6_4','ev_8_4','ev_9_4','ev_10_4','ev_12_4','ev_13_2'];
const ENTRY=['ne_1_1','ne_2_1','ne_3_1','ne_4_1','ne_6_1','ne_10_1','ne_11_2','ne_12_1','ne_12_2','ne_7_2','ne_9_2','ne_13_2','ne_11_1'];
const SCAN=AR.concat(SRVN,['ne_1_4','ne_5_4','ci_n1','ev_3_1']);
/* "Overdue deals more": its hit (while it resolves) and each tick of his notices */
const ODM=(more,cond,per)=>[Object.assign({on:'out',if:Object.assign({casting:OD},cond||{}),more},per?{per}:{}),Object.assign({on:'dotOut',if:Object.assign({tag:'od'},cond||{}),more},per?{per}:{})];
/* "Foreclosure deals more": its hit and both of its bleeds (the second one is The Ledger Corrected's) */
const FCM=(more,cond)=>[{on:'out',if:Object.assign({casting:FC},cond||{}),more},{on:'dotOut',if:Object.assign({tag:'fc'},cond||{}),more},{on:'dotOut',if:Object.assign({tag:'fc2'},cond||{}),more}];
/* "Grimsby deals more to it": his hits and every DoT of his */
const ALLM=(more,cond)=>[{on:'out',if:cond,more},{on:'dotOut',if:cond,more}];
/* ---- helpers ---- */
const now=A=>A.eng().now();
const foes=(A,T,u)=>A.pick(T,u,{team:'enemy'},{});
const rec=(T,x)=>{ const m=T.s.gr||(T.s.gr={}); return m[x.uid]||(m[x.uid]={in:false,sec:0,rise:0,tot:0,fcD:0,hpF:null,dbl:0,dash:false,lsh:null}); };
const thr=T=>T.P.thr9?9:6;                                     // Arrears: 6 Overdue (Compounding: 9)
const notices=(u,x)=>(x.dots||[]).filter(d=>d._talO===u.uid&&d._talK==='od'&&d.remaining>0);
const left=d=>d.remaining-1+(d._talF!=null?d._talF:1);
/* a notice made his: tag, its stacks, what it has dealt; Fine Print makes it that much longer (a part tick at the end) */
function own(T,u,x,d,tag){ d._talO=u.uid; d._talK=tag; if(tag!=='od') return; d._odN=x._debtStk||1; d._odD=0; d._odX=0;
  const add=(T.P['od.dur']||0)+(d._fdX||0); if(add>0){ const n=left(d)+add/(d.interval||1); d.remaining=Math.ceil(n-1e-9); const f=n-(d.remaining-1); d._talF=(f<1-1e-9)?f:null; } }
/* Overdue added by a talent: the stacks rise (to the cap); with notice:true a notice is served for them as well, as a cast of Overdue would (its own time + Fine Print + Served in Full) */
function addOd(A,T,u,x,k,notice,extra){ if(!x||!x.alive||!(k>0||notice)) return; const E=A.eng(), r=rec(T,x);
  if(k>0) x._debtStk=Math.min(thr(T),(x._debtStk||0)+k); x._debtOwner=u; if(!(x._debtDps>0)) x._debtDps=perStk(A,T,u); x._debtDur=6;
  if(notice){ const n0=(x.dots||[]).length; E.pushDot(x,x._debtDps*x._debtStk,6,1,ODC,u); const d=x.dots[x.dots.length-1]; if(x.dots.length>n0&&d&&d.src===u){ d._fdX=extra||0; own(T,u,x,d,'od'); A.run(T,u,'notice',{u,tgt:x,dot:d}); } } }
/* the strength of one Overdue stack a second: what his last cast wrote, else his attack x 35% at his Overdue's level */
function perStk(A,T,u){ if(T.s.odDps>0) return T.s.odDps; const E=A.eng(), lv=(u.skillLv&&u.skillLv[1])||1; return (u.dmg||0)*0.35*(E.skillMul?E.skillMul(lv):1); }
/* the Deposit (T.s.dep, HP): up to 20% of his max HP (Fees Withheld: more); the signature's window adds to it with no limit */
const depCap=(T,u)=>(u.maxHp||0)*(0.20+(T.P['dep.cap']||0));
/* a snapshot of the enemies' DoTs (which ones a skill pushes) */
const snapDots=(A,T,u)=>foes(A,T,u).map(x=>[x,(x.dots||[]).length]);
module.exports={
  hero:'grimsby',
  times:['doorsCd','rhsCd'],   // this file's own absolute fight times (paths in T.s): the engine moves them back with the clock at each wave (WIRING/41c)
  casting:true,                         // rows ask which of his skills a hit comes from (Overdue, Foreclosure)
  watch:true,                           // deaths (Entries, Rolled Over, Rent Strike, Foreclosed, Debt Transfer), team rows, the enemy that last hit an ally
  states:{
    entry:{max:91},                                                                // Entries: the whole fight
    entryW:{max:20,wave:'reset'},                                                  // Entries written this wave (Rent Rolls)
    ioi:{max:10,wave:'reset'},                                                     // Interest on Interest: enemies fallen into Arrears this wave
    srv:{}, arN:{}, lienN:{}                                                       // the scan: enemies Served, in Arrears, under a Lien now
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share */
  always:[
    {on:'kit',skill:OD,do:[{fn:'odKit'}]}, {on:'cast',skill:OD,do:[{fn:'odCast'}]},             // each Overdue: its notice made his (stacks, Settle Now, Standing Debt, Ledger of the Dead)
    {on:'dotTick',if:{tag:'od'},do:[{fn:'odTick'}]},                                            //   each tick of a notice: what it dealt; a notice that runs out charges its Late Fee
    {on:'hit',reqAny:['ci_13_2'],if:{casting:OD,targetTeam:'enemy'},do:[{fn:'odHit'}]},         //   the Overdue damage an enemy has taken (The Rate He Set)
    {on:'hit',reqAny:['ci_7_1'],if:{casting:OD,targetTeam:'enemy'},do:[{mark:'od1',on:'target'}]},   // Pinned Notices: its first hit on each enemy
    {on:'kit',skill:FC,do:[{fn:'fcKit'}]}, {on:'cast',skill:FC,do:[{fn:'fcCast'}]},             // Foreclosure: its bleeds made his, Lien, the time it runs
    {on:'dotTick',if:{tag:'fc'},do:[{fn:'fcTick'}]}, {on:'dotTick',if:{tag:'fc2'},do:[{fn:'fcTick'}]},
    {on:'end:fc',reqAny:['ne_9_4'],do:[{fn:'fcEnd'}]},
    {on:'kit',skill:LS,do:[{fn:'lsKit'}]}, {on:'cast',skill:LS,do:[{fn:'lsCast'}]},             // Ledger Slam: who it really taunted (Served, its silence, its pull)
    {on:'tick',reqAny:SCAN,do:[{fn:'scan'}]},                                                   // one walk over the enemies a tick: Arrears, Served / Lien counts, Quarter Days, dashes
    {on:'death',reqAny:ENTRY,do:[{fn:'entryDeath'}]},                                           // Entries
    {on:'tick',reqAny:DEP,each:{team:'ally',others:true},edge:true,if:{targetHpBelow:0.30},do:[{fn:'refund'}]},   // the Deposit refunded to an ally dropping below 30% HP
    {on:'teamIn',reqAny:['ne_12_4'],do:[{fn:'lsRec'}]}, {on:'in',reqAny:['ne_12_4'],do:[{fn:'lsRec'}]},         // No Relief: whose hit is resolving (its lifesteal comes next)
    {stat:{crit:0.01},reqAny:['ci_8_3','ne_8_3'],per:{fn:'critN'}}                               // Clerk's Eye and Ink and Ash: 1% a rank, 5% in all
  ],
  talents:{
    /* ============================== COMPOUND INTEREST ============================== */
    ci_1_1:[ {param:'ar.rate',add:R(0.01)} ].concat(ODM(1,{},{fn:'rise'})),                                          // Past Due: Arrears (the scan), each second +1% per rank, up to 10 s
    ci_11_3:[ {on:'in',if:{auto:false},less:R(0.015)} ],                                                             // Old Paper
    ci_1_4:[ {param:'lf',add:R(0.10)} ],                                                                             // Late Fee (odTick)
    ci_2_1:[ {param:'ar.rate',add:R(0.003)} ],                                                                       // Usurer's Rate
    ci_2_4:[ {on:'lateFee',do:[{fn:'agent',k:R(1)}]} ],                                                              // Collection Agent
    ci_3_1:[ {param:'nta',add:1} ],                                                                                  // Never Thrown Away (the scan)
    ci_2_2:[ ...ODM(R(0.03)) ],                                                                                             // Heavier Notice
    ci_3_4:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},chance:R(0.05),do:[{fn:'addStk',k:1}]} ],                   // Paper Cuts
    ci_4_1:[ {on:'out',if:{auto:true,targetHas:'arr'},more:R(0.02)} ],                                               // Penalty Rate
    ci_4_2:[ {param:'od.dur',add:R(0.5)} ],                                                                          // Fine Print (own)
    ci_4_3:[ {param:'ls.sil',add:R(0.2)} ],                                                                          // Ledger Weight (lsCast)
    ci_n2:[ {on:'arrears',do:[{mark:'eib',on:'target',dur:4}]} ].concat(ALLM(0.03,{targetHas:'eib'}),                // Entered in the Book (LINK)
           [{on:'arrears',req:'ne_1_1',do:[{fn:'booked'}]}]),
    ci_n1:[ {on:'quarter',chance:R(0.2),do:[{fn:'addStk',k:1}]} ],                                                   // Quarter Days (the scan sees the crossing)
    ci_5_2:[ {on:'kit',skill:OD,opt:{maxStk:{set:9}}}, {param:'thr9',add:1} ],                                        // Compounding (PICK ONE)
    ci_5_3:[ {param:'settle',add:1} ],                                                                               // Settle Now (PICK ONE; odCast)
    ci_5_4:[ {on:'num',skill:'debtaura',add:R(0.05)} ],                                                              // Interest Only
    ci_6_1:[ {on:'in',if:{srcHas:'arr'},less:R(0.02)}, {on:'teamIn',if:{srcHas:'arr'},less:R(0.02)} ],               // Debtor's Weakness
    ci_6_2:[ {on:'dotOut',if:{tag:'od'},more:R(0.03),per:{fn:'above6'}} ],                                            // Deeper Debt
    ci_6_3:[ {param:'pif',add:R(0.03)} ],                                                                            // Paid in Full (odCast)
    ci_6_4:[ {param:'lf.more',add:R(0.10)} ],                                                                        // Ink Stains
    ci_7_1:[ ...ODM(R(0.04),{targetLacks:'od1'}).slice(0,1) ],                                                              // Pinned Notices (the hit only)
    ci_7_2:[ {on:'cast',skill:FC,do:[{fn:'finalDemand'}]} ],                                                         // Final Demand
    ci_7_4:[ ...ALLM(R(0.02),{targetDot:'od'}) ],                                                                           // Hounding
    ci_8_1:[ {on:'dotOut',more:R(0.02)} ],                                                                           // Two Centuries
    ci_8_3:[ ],                                                                                                      // Clerk's Eye (the always crit row)
    ci_9_2:[ {param:'fd.dur',add:R(0.5)} ],                                                                          // Served in Full (finalDemand)
    ci_9_4:[ {on:'lateFee',do:[{heal:{pct:0.10,of:'spent'}}]} ],                                                     // Garnished
    ci_10_1:[ {stat:{aspd:R(0.01)},per:{stack:'arN',max:5}} ],                                                       // Arrears Ledger
    ci_10_3:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                                 // Quick Quill
    ci_10_4:[ {on:'lateFee',do:[{mark:'ngp',on:'target',dur:4}]}, {stat:{armor:R(-0.02)},to:{team:'enemy',has:'ngp'}} ],   // No Grace Period
    ci_11_1:[ {on:'death',if:{unitHas:'arr'},do:[{fn:'rollOver'}]} ],                                                // Rolled Over
    ci_11_2:[ {on:'arrears',by:'target',once:'wave',do:[{stack:'ioi',add:1}]}, {stat:{atk:R(0.005)},per:'ioi'} ],     // Interest on Interest
    ci_12_1:[ {param:'sd',add:R(1)} ],                                                                               // Standing Debt (odCast)
    ci_12_2:[ {on:'teamHeal',if:{unitHas:'arr'},less:R(0.02)} ],                                                     // Usury
    ci_12_3:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',within:5,centre:true,dot:true}} ],                              // Dry Ink (near him = Compound Interest's 5 m)
    ci_12_4:[ {param:'lf.low',add:R(0.10)} ],                                                                        // Final Notice
    ci_13_2:[ {param:'rhs',add:1} ],                                                                                 // The Rate He Set (SIGNATURE; the scan)
    /* ============================== EVICTION ============================== */
    ev_1_1:[ {on:'teamIn',if:{srcHas:'served'},less:R(0.02)} ],                                                      // Notice to Quit (Served: lsCast)
    ev_11_4:[ {on:'in',if:{auto:true},less:R(0.015)} ],                                                              // Paper Armor
    ev_1_4:[ {param:'dep.k',add:R(0.03)}, {on:'in',if:{srcHas:'served'},do:[{fn:'withhold'}]} ],                       // Security Deposit
    ev_2_1:[ {param:'srv.dur',add:R(0.5)} ],                                                                         // Long Lease
    ev_2_4:[ {param:'dep.cap',add:R(0.05)} ],                                                                        // Fees Withheld
    ev_3_1:[ {param:'nofwd',add:1} ],                                                                                // No Forwarding Address (the scan)
    ev_4_2:[ {on:'kit',skill:LS,opt:{radius:{addM:R(0.3)}}} ],                                                       // Wider Reach
    ev_3_3:[ {on:'ccIn',less:R(0.04)} ],                                                                             // Locked Doors (20% at 5/5)
    ev_3_4:[ {on:'in',if:{srcHas:'served'},less:R(0.015)} ],                                                         // Inspection
    ev_2_3:[ {param:'hl',add:R(0.10)} ],                                                                             // Heavy Ledger (lsCast)
    ev_5_2:[ {param:'drawn',add:1} ],                                                                                // Drawn In (PICK ONE; lsCast)
    ev_5_3:[ {param:'kept',add:1} ],                                                                                 // Kept Out (PICK ONE; lsCast)
    ev_5_4:[ {param:'dep.heal',add:R(0.05)} ],                                                                       // Refund Policy
    ev_4_3:[ {on:'in',if:{stackMin:{srv:2}},less:R(0.02)} ],                                                         // Paper Wall
    ev_6_2:[ {on:'out',req:'ev_5_2',if:{auto:true,targetHas:'served'},more:R(0.03)} ],                                            // Desk Crowders
    ev_7_3:[ {param:'barred',add:R(0.04)} ],                                                                         // Barred Door (lsCast)
    ev_6_1:[ {on:'teamIn',if:{stackMin:{srv:1},targetTeam:'ally',targetWithin:4},less:R(0.015)} ],                    // Tenants' Rights
    ev_6_4:[ {on:'refund',chance:R(0.5),do:[{cleanse:1,on:'unit'}]} ],                                               // Itemized
    ev_7_1:[ ...ODM(R(0.03),{targetHas:'served'}) ],                                                                        // Overdue Rent
    ev_7_2:[ {on:'cast',skill:FC,do:[{fn:'evict'}]} ],                                                               // Eviction Notice
    ev_8_1:[ {on:'in',if:{selfHpBelow:0.50},less:R(0.02)} ],                                                         // Thick Walls
    ev_8_4:[ {stat:{atk:R(0.02)},if:{fn:'depFull'}} ],                                                               // Escrow
    ev_9_2:[ {param:'evict.t',add:R(0.1)} ],                                                                         // Mass Eviction
    ev_10_1:[ {stat:{move:R(-0.02)},to:{team:'enemy',has:'served'}} ],                                               // Witness
    ev_9_4:[ {on:'refund',do:[{dmg:{pct:1,of:'spent'},on:'lastHit'}]} ],                                             // Deposit Returned
    ev_12_1:[ {param:'st2',add:R(0.3)} ],                                                                            // Served Twice (lsCast)
    ev_10_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                                  // Slam Shut
    ev_10_4:[ {on:'tick',period:1,if:{fn:'depAny'},do:[{heal:{pct:R(0.002),of:'maxHp'}}]} ],                         // Escrow Account (1% a second at 5/5: under the 1.2% cap)
    ev_11_1:[ {on:'death',if:{unitHas:'served'},do:[{cd:'blue',mul:0.5}]} ],                                         // Rent Strike
    ev_11_2:[ {on:'in',less:R(0.01),per:{stack:'srv',max:5}} ],                                                      // Tenant's Burden
    ev_12_2:[ {on:'out',if:{stackMin:{srv:3}},more:R(0.02)} ],                                                       // Nobody Leaves the Building
    ev_12_3:[ {stat:{aspd:R(0.04)},if:{stackMin:{srv:1}}} ],                                                         // Quill Hand
    ev_12_4:[ {on:'wave',do:[{fn:'depSeed',k:R(0.03)}]} ],                                                           // Cash Reserve
    ev_13_2:[ {param:'doors',add:1}, {on:'in',if:{window:'doors'},less:0.30},                                        // Doors Locked Behind Him (SIGNATURE; lsCast)
              {on:'in',if:{window:'doors'},do:[{fn:'doorsRec'}]} ],
    /* ============================== NINETY-ONE ENTRIES ============================== */
    ne_1_1:[ {stat:{atk:R(0.0005)},per:'entry'} ],                                                                   // In Grimsby (entryDeath)
    ne_11_4:[ {on:'in',if:{auto:false},less:R(0.015)} ],                                                             // Unpaid
    ne_1_4:[ {param:'lien.k',add:R(0.04)}, {on:'teamHeal',if:{unitHas:'lien'},less:R(0.04)} ],                       // Lien (the shield half: the scan)
    ne_2_1:[ {stat:{hp:R(0.0005)},per:'entry'} ],                                                                    // Column for People
    ne_2_4:[ ...ALLM(R(0.02),{targetHas:'lien'}) ],                                                                         // Claim on Property
    ne_3_1:[ {on:'cast',skill:OD,if:{stackMin:{entry:10}},do:[{fn:'twoServe'}]} ],                                   // Every Name Kept
    ne_2_2:[ ...FCM(R(0.03)) ],                                                                                             // Wider Service
    ne_3_4:[ {param:'lien.dur',add:R(1)} ],                                                                          // Debt Attached
    ne_4_1:[ {on:'dotOut',more:R(0.0002),per:'entry'} ],                                                             // Compounded Names
    ne_4_3:[ {on:'in',if:{selfHpBelow:0.30},less:R(0.03)} ],                                                         // Cannot Die
    ne_4_4:[ {on:'death',if:{unitHas:'lien'},do:[{heal:{pct:R(0.02),of:'maxHp'}}]} ],                                // Foreclosed
    ne_n1:[ {on:'teamIn',if:{srcHas:'lien'},less:R(0.015)} ],                                                        // Encumbered
    ne_12_3:[ {on:'in',if:{srcDot:'fc'},less:R(0.03)} ],                                                             // Notice Paper
    ne_5_4:[ {stat:{armor:R(0.01)},per:{stack:'lienN',max:5}} ],                                                     // Seized Assets
    ne_6_1:[ {stat:{lifesteal:R(0.0002)},per:'entry'} ],                                                             // The Fever Year
    ne_10_1:[ {on:'in',less:R(0.003),per:{stack:'entry',div:10}} ],                                                  // Ninety-One
    ne_10_3:[ ...ODM(R(0.03)) ],                                                                                            // Dead Letter
    ne_6_4:[ {stat:{move:R(-0.03)},to:{team:'enemy',has:'lien'}} ],                                                  // Bailiff
    ne_7_1:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                               // Bound Ledger
    ne_7_2:[ {param:'lotd',add:1} ],                                                                                 // Ledger of the Dead (odCast)
    ne_7_4:[ {on:'death',if:{unitHas:'lien'},do:[{mark:'lien',on:{team:'enemy',of:'unit',n:1},dur:R(1),longest:true}]} ],   // Debt Transfer
    ne_8_1:[ {on:'in',if:{srcDot:'od'},less:R(0.015)} ],                                                             // Cannot Pay
    ne_8_3:[ ],                                                                                                      // Ink and Ash (the always crit row)
    ne_9_4:[ {param:'tfc',add:1} ],                                                                                  // Total Foreclosure (fcEnd)
    ne_5_2:[ {on:'kit',skill:FC,opt:{dur:{add:3}}} ],                                                                // Served Everywhere (PICK ONE)
    ne_9_2:[ {on:'dotOut',if:{tag:'od'},more:R(0.03),per:{fn:'lotdShare'}} ],                                         // Tenants Remembered
    ne_5_3:[ {param:'hand',add:1} ],                                                                                 // Served by Hand (PICK ONE; fcKit)
    ne_6_2:[ {on:'dotOut',if:{tag:'fc'},more:R(0.02)}, {on:'dotOut',if:{tag:'fc2'},more:R(0.02)} ],                  // Long Fever
    ne_6_3:[ {on:'out',if:{targetHas:'hand'},more:R(0.03)} ],                                                        // Hand Delivered
    ne_10_4:[ {stat:{armor:R(-0.015)},to:{team:'enemy',has:'lien'}} ],                                               // Lien Holder
    ne_11_1:[ {param:'rk',add:1} ],                                                                                  // Record Kept (entryDeath)
    ne_11_2:[ {stat:{aspd:R(0.001)},per:'entryW'} ],                                                                 // Rent Rolls
    ne_12_1:[ {on:'wave',once:'fight',do:[{stack:'entry',add:R(3)}]} ],                                              // Columns Filled
    ne_12_2:[ ...FCM(R(0.03),{stackMin:{entry:10}}) ],                                                                      // Debt Never Ends
    ne_12_4:[ {on:'teamHeal',if:{fn:'lsHeal'},less:R(0.03)} ],                                                       // No Relief
    ne_13_2:[ {param:'corr',add:1} ].concat(FCM(0.005,{},null).slice(1).map(r=>Object.assign(r,{per:{stack:'entry',max:60}})))   // The Ledger Corrected (SIGNATURE; fcCast)
  },
  fn:{
    critN(A,T){ return Math.min(5,(T.r.ci_8_3||0)+(T.r.ne_8_3||0)); },
    depFull(A,T,u){ return (T.s.dep||0)>=depCap(T,u)-1e-9; },
    depAny(A,T){ return (T.s.dep||0)>0; },
    /* the Arrears rise on the target (its share as a number: 0.59 = 59% more) */
    rise(A,T,u,c){ const x=c.tgt; if(!x) return 0; const r=T.s.gr&&T.s.gr[x.uid]; return (r&&r.in)?r.rise:0; },
    above6(A,T,u,c){ const n=(c.dot&&c.dot._odN)||0; return n>6?(n-6)/n:0; },               // Deeper Debt: the share of the notice that is stacks above 6
    lotdShare(A,T,u,c){ const d=c.dot; return (d&&d._odN>0)?(d._odX||0)/d._odN:0; },         // Tenants Remembered: the share of the notice that Ledger of the Dead added
    /* ---- OVERDUE: which DoTs the cast pushed (the notice on its target; a burst DoT if the hit killed a debtor) ---- */
    odKit(A,T,u){ T.s.odSnap=foes(A,T,u).map(x=>[x,(x.dots||[]).length,x._debtOwner===u?(x._debtStk||0):0]); },   // the stacks it had before this cast
    odCast(A,T,u,c){ const s=T.s, L=s.odSnap||[]; s.odSnap=null; s.odT=null; const mx=(c.o&&c.o.maxStk)||6;
      for(const [x,n0,k0] of L){ const D=x.dots||[]; for(let i=n0;i<D.length;i++){ const d=D[i]; if(d.src!==u||d.color!==ODC||d._talO!=null) continue;
          if(!s.odT&&x._debtOwner===u&&Math.abs(d.dps-(x._debtDps||0)*(x._debtStk||0))<=1e-9*Math.max(1,d.dps)){ s.odT=x; T.fn.notice(A,T,u,x,d,mx,c,k0); }
          else own(T,u,x,d,'odb'); } } },
    notice(A,T,u,x,d,mx,c,before){ const s=T.s, r=rec(T,x); s.odDps=x._debtDps;
      if(T.P.settle&&before>=thr(T)){ own(T,u,x,d,'od'); T.fn.settle(A,T,u,x,c); return; }                      // Settle Now: at 6, this Overdue settles the whole debt
      let ex=0, lx=0; if(T.P.sd&&before===0&&!r.seen) ex+=Math.floor(T.P.sd+1e-9);              // Standing Debt: his first Overdue on this enemy
      if(T.P.lotd){ lx=Math.min(3,Math.floor(A.stGet(T,'entry')/10+1e-9)); ex+=lx; }            // Ledger of the Dead: 1 more for every 10 Entries (up to 3)
      if(ex>0){ const k0=x._debtStk; x._debtStk=Math.min(mx,k0+ex); lx=Math.max(0,Math.min(lx,x._debtStk-k0)); d.dps=x._debtDps*x._debtStk; }
      r.seen=true; own(T,u,x,d,'od'); d._odX=lx; A.run(T,u,'notice',{u,tgt:x,dot:d}); },
    /* Settle Now: every notice of his on it pays what it still had to deal at once (through its magic resist and his rows on its ticks); its stacks clear */
    settle(A,T,u,x,c){ const E=A.eng(), r=rec(T,x); let tot=0;
      for(const d of notices(u,x)){ const c2={u,src:u,tgt:x,dot:d,tag:'od',amt:d.dps*left(d)*E.defMul(u,x,d.kind||'magic')}; A.run(T,u,'dotOut',c2); tot+=Math.max(0,c2.amt); const i=x.dots.indexOf(d); if(i>=0) x.dots.splice(i,1); }
      x._debtStk=0; r.in=false; r.sec=0; r.rise=0; A.clearMark(u,x,'arr');
      const lost=A.hurt(T,u,x,tot,ODC,'settle'); if(T.P.pif&&tot>0) A.acts(T,u,[{heal:tot*T.P.pif}],c); A.run(T,u,'settled',{u,tgt:x,spent:lost}); },
    /* each tick of a notice: what it dealt (its own Late Fee; the Overdue damage the enemy has taken). Its last tick, the enemy alive: the Late Fee */
    odTick(A,T,u,c){ const d=c.dot, x=c.tgt; if(!d||!x) return; d._odD=(d._odD||0)+(c.amt||0); rec(T,x).tot+=(c.amt||0);
      if(d.remaining<=1&&x.alive&&T.P.lf){ const k=T.P.lf*(1+(T.P['lf.more']||0)+((x.hp<0.5*x.maxHp)?(T.P['lf.low']||0):0)), fee=d._odD*k;
        if(fee>0){ const lost=A.hurt(T,u,x,fee,ODC,'lateFee'); A.run(T,u,'lateFee',{u,src:u,tgt:x,unit:x,spent:lost,amt:fee}); } } },
    odHit(A,T,u,c){ if(c.tgt) rec(T,c.tgt).tot+=(c.hpLost||0); },
    /* Overdue stacks added by a talent (no notice): Paper Cuts, Quarter Days */
    addStk(A,T,u,c,a){ addOd(A,T,u,c.tgt,a.k||1,false); },
    /* Collection Agent: the nearest other enemy (body to body) gains 1 Overdue per rank */
    agent(A,T,u,c,a){ const t=A.pick(T,u,{team:'enemy',of:'target',n:1,skip:'target'},c)[0]; if(t) addOd(A,T,u,t,a.k||1,false); },
    /* Rolled Over: an enemy in Arrears died: the nearest enemy to it takes on its stacks (up to the cap) */
    rollOver(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team) return; const t=A.pick(T,u,{team:'enemy',of:'unit',n:1},c)[0]; if(t) addOd(A,T,u,t,x._debtStk||0,false); },
    /* Final Demand: Foreclosure adds 3 Overdue to every enemy it served, and serves a notice for them (6 s + Fine Print + Served in Full) */
    finalDemand(A,T,u){ for(const x of (T.s.fcL||[])) addOd(A,T,u,x,3,true,T.P['fd.dur']||0); },
    /* Every Name Kept: at 10 Entries, Overdue is also served on the enemy nearest its target (his own skill at his level: no cooldown, no press) */
    twoServe(A,T,u,c){ const x=T.s.odT, E=A.eng(); if(!x||!E.castSlot) return; const t=A.pick(T,u,{team:'enemy',of:'target',n:1,skip:'target'},{tgt:x})[0]; if(t) E.castSlot(u,'green',t); },
    booked(A,T,u,c){ const x=c.tgt; if(!x||A.markOf(u,x,'booked')) return; A.setMark(T,u,x,'booked',{}); T.fn.write(A,T,u,1); },
    /* ---- THE SCAN (once a tick): Arrears on each enemy, the Served / Lien / Arrears counts, Lien's weaker shields, Quarter Days, Served dashes ---- */
    scan(A,T,u,c){ const s=T.s, E=A.eng(), t6=thr(T), rate=T.P['ar.rate']||0, dt=c.dt||0, tn=now(A), M=E.METER(); let nS=0, nA=0, nL=0;
      for(const x of foes(A,T,u)){ const r=rec(T,x), srv=!!A.markOf(u,x,'served'), lien=!!A.markOf(u,x,'lien'); if(srv) nS++; if(lien) nL++;
        if(T.P['lien.k']){ const k=T.P['lien.k'], sh=x.shield||0; if(lien){ if(r.lsh==null) r.lsh=0; if(sh>r.lsh+1e-9) x.shield=r.lsh+(sh-r.lsh)*(1-k); r.lsh=x.shield||0; } else r.lsh=null; }   // a shield put on it (or there when the Lien came) is weaker
        const has=notices(u,x).length>0, inA=has&&(x._debtStk||0)>=t6&&x._debtOwner===u;
        if(inA&&!r.in){ r.in=true; A.setMark(T,u,x,'arr',{}); A.run(T,u,'arrears',{u,src:u,tgt:x,unit:x}); }
        else if(!inA&&r.in){ r.in=false; A.clearMark(u,x,'arr'); if(!T.P.nta){ r.sec=0; r.rise=0; } }
        if(r.in){ nA++; r.sec+=dt; r.rise=Math.min(rate*10,r.rise+rate*dt*(r.dbl>tn?2:1));
          if(T.P.rhs&&r.sec>=10-1e-9&&!(tn<(s.rhsCd||-1))&&x.alive){ s.rhsCd=tn+25; T.fn.rhs(A,T,u,x); } }
        if(T.r.ci_n1){ const f=x.hp/Math.max(1,x.maxHp); if(has&&r.hpF!=null) for(const th of [0.75,0.50,0.25]) if(r.hpF>=th&&f<th) A.run(T,u,'quarter',{u,src:u,tgt:x,unit:x}); r.hpF=f; }
        if(T.P.nofwd&&srv){ if(x._dash){ if(!r.dash){ r.dash=true; x._dash.x1=x._dash.x0; x._dash.y1=x._dash.y0; } }   // a dash begun while Served goes nowhere
          else { r.dash=false; if(!(x.pullT>0)&&x.px!=null&&Math.hypot(x.x-x.px,x.y-x.py)>3*M){ x.x=x.px; x.y=x.py; x._ax=x.x; x._ay=x.y; } } } }   // a teleport is undone
      A.stSet(T,u,'srv',nS); A.stSet(T,u,'arN',nA); A.stSet(T,u,'lienN',nL); },
    /* The Rate He Set: the debt comes due - the Overdue damage it has taken so far, again at once; every enemy within 4 m of it (body to body) falls into
       Arrears (its stacks raised to the Arrears mark, a notice served), and Arrears rises twice as fast on them for 6 s */
    rhs(A,T,u,x){ const r=rec(T,x); if(r.tot>0) A.hurt(T,u,x,r.tot,ODC,'due'); const tn=now(A);
      for(const y of A.pick(T,u,{team:'enemy',of:'target',within:4,skip:'target'},{tgt:x})){ const k=thr(T)-(y._debtStk||0); addOd(A,T,u,y,Math.max(0,k),true); rec(T,y).dbl=tn+6; } },
    /* ---- LEDGER SLAM: who it really taunted (the enemies whose forced target became him in this cast), whatever its centre ---- */
    lsKit(A,T,u){ T.s.lsSnap=foes(A,T,u).map(x=>[x,x.forcedTarget,x.forcedTargetT||0,x.silencedT||0,x.pullT||0]); },
    lsCast(A,T,u,c){ const s=T.s, E=A.eng(), L=s.lsSnap||[]; s.lsSnap=null; const top=(E.ccCap('silencedT')||3.85)/(E.ccDur(1)||1), on=Object.keys(T.r).some(id=>id.slice(0,3)==='ev_');
      let nS=0; s.lsL=[];
      for(const e of L){ const x=e[0]; if(!x.alive||x.forcedTarget!==u||!((x.forcedTargetT||0)>e[2]+1e-9||e[1]!==u||(x.silencedT||0)>e[3]+1e-9||(x.pulledBy===u&&(x.pullT||0)>e[4]+1e-9))) continue; s.lsL.push(x);   // taunted (or its silence / drag renewed) by this cast
       
        const was=!!A.markOf(u,x,'served'), c2=Object.assign({},c,{tgt:x,unit:x});
        const ex=(T.P['ls.sil']||0)+(T.P.kept?1:0)+(was?(T.P.st2||0):0); if(ex>0&&(x.silencedT||0)>e[3]+1e-9) x.silencedT=Math.max(x.silencedT,Math.min(top,x.silencedT+ex));   // the silence lengthened in full (cut only at the uncut ceiling)
        if(T.P.drawn){ x.forcedTargetT+=1; if(x.pulledBy===u&&x.pullT>0){ const need=(E.dist(u,x)-(x.r||18)-(u.r||18))/x.pullT; if(need>(x.pullSpeed||22*1.15)) x.pullSpeed=need; } }   // Drawn In: all the way, and 1 s more taunt
        if(T.P.kept){ const b=A.pick(T,u,{team:'ally',of:'target',n:1},c2)[0]||u;   // Kept Out: no pull (the push replaces the drag); 2 m back from his nearest ally
          A.acts(T,u,[{push:'target',from:'source',m:2,secs:0.4}],Object.assign({},c2,{src:b})); if(T.P.barred) A.acts(T,u,[{slow:T.P.barred,dur:2,on:'target'}],c2); }
        if(T.P.hl) A.acts(T,u,[{dmg:{pct:T.P.hl,of:'atk'},on:'target',def:'phys'}],c2);
        if(on){ A.setMark(T,u,x,'served',{dur:(x.forcedTargetT||0)+2+(T.P['srv.dur']||0),longest:true}); nS++; } }
      if(T.P.doors&&nS>=3&&!(now(A)<(s.doorsCd||-1))){ s.doorsCd=now(A)+25;                 // Doors Locked Behind Him: every enemy Served and silenced 2 s; 30% less for 4 s
        for(const x of foes(A,T,u)){ A.setMark(T,u,x,'served',{dur:4,longest:true}); A.control(T,u,x,'silencedT',2); }
        A.acts(T,u,[{window:'doors',dur:4}],c); } },
    /* Eviction Notice: every enemy Foreclosure served is Served and taunted onto him for 1.5 s (Mass Eviction: longer) */
    evict(A,T,u,c){ const d=1.5+(T.P['evict.t']||0); for(const x of (T.s.fcL||[])){ if(!x.alive) continue; x.forcedTarget=u; x.forcedTargetT=Math.max(x.forcedTargetT||0,d); A.setMark(T,u,x,'served',{dur:d+2+(T.P['srv.dur']||0),longest:true}); } },
    /* ---- THE DEPOSIT ---- */
    withhold(A,T,u,c){ const k=T.P['dep.k']||0, room=depCap(T,u)-(T.s.dep||0); if(!(k>0)||!(room>0)||!(c.amt>0)) return; const w=Math.min(room,c.amt*k); c.amt-=w; T.s.dep=(T.s.dep||0)+w; },
    doorsRec(A,T,u,c){ if(c.amt>0) T.s.dep=(T.s.dep||0)+c.amt; },                               // the signature: what they deal him is added to the Deposit, with no limit (he still takes it)
    depSeed(A,T,u,c,a){ T.s.dep=Math.max(T.s.dep||0,(u.maxHp||0)*(a.k||0)); },
    refund(A,T,u,c){ const x=c.tgt, d=T.s.dep||0; if(!x||!x.alive||!(d>0)) return; const amt=d*(1+(T.P['dep.heal']||0)); T.s.dep=0;
      A.acts(T,u,[{heal:amt,on:'target'}],c); A.run(T,u,'refund',{u,src:u,tgt:x,unit:x,spent:amt}); },
    /* ---- FORECLOSURE ---- */
    fcKit(A,T,u,c){ T.s.fcSnap=snapDots(A,T,u); T.s.handL=null;
      if(T.P.hand&&c.o){ const L=foes(A,T,u).slice().sort((a,b)=>(b.hp||0)-(a.hp||0)).slice(0,3); c.o._only=L; c.o.dps=(c.o.dps||0.4)*3; T.s.handL=L; } },   // Served by Hand: only the 3 with the most HP, three times as strong
    fcCast(A,T,u,c){ const s=T.s, E=A.eng(), L=s.fcSnap||[]; s.fcSnap=null; s.fcL=[]; s.corrE=0; let dur=0; const lienOn=LIEN.some(id=>T.r[id]);
      s.fcN=0; s.fcDone=false; for(const [x,n0] of L){ const D=x.dots||[]; for(let i=n0;i<D.length;i++){ const d=D[i]; if(d.src!==u||d.color!==FCC||d._talO!=null) continue; own(T,u,x,d,'fc'); s.fcN++; if(s.fcL.indexOf(x)<0) s.fcL.push(x); rec(T,x).fcD=0;
          dur=Math.max(dur,left(d)*(d.interval||1));
          if(T.P.corr){ const n1=D.length; E.pushDot(x,d.dps,d.remaining*(d.interval||1),d.interval||1,d.color,u,d.kind); const d2=D[D.length-1]; if(D.length>n1&&d2&&d2.src===u){ own(T,u,x,d2,'fc2'); s.fcN++; } } } }
      if(dur>0) A.acts(T,u,[{window:'fc',dur:dur+1}],c);   // the bleeds are over at the last one's last tick; the window (1 s more) ends it if a bleed was cut short
      if(lienOn) for(const x of s.fcL) A.setMark(T,u,x,'lien',{dur:10+(T.P['lien.dur']||0),longest:true});
      if(s.handL) for(const x of s.handL) if(s.fcL.indexOf(x)>=0) A.setMark(T,u,x,'hand',{dur:Math.max(dur,0.1)}); },
    fcTick(A,T,u,c){ if(c.tgt) rec(T,c.tgt).fcD+=(c.amt||0); if(c.dot&&c.dot.remaining<=1&&--T.s.fcN<=0&&T.r.ne_9_4) T.fn.fcEnd(A,T,u); },
    /* Total Foreclosure: when Foreclosure's bleed is over, every enemy still under a Lien takes 20% of what that bleed dealt it, again at once */
    fcEnd(A,T,u){ if(T.s.fcDone) return; T.s.fcDone=true; for(const x of (T.s.fcL||[])){ if(!x.alive||!A.markOf(u,x,'lien')) continue; const r=rec(T,x); if(r.fcD>0) A.hurt(T,u,x,0.2*r.fcD,FCC,'tfc'); } },
    /* ---- ENTRIES: an enemy (not a summon) that dies carrying a notice of his or Foreclosure's bleed; The Ledger Corrected: both bleeds = 2 Entries and 5 energy
       (its 1 s off the ultimate's cooldown; at most 25 a cast); Record Kept: one that dies under a Lien ---- */
    entryDeath(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team||x._summon) return; const od=A.hasDot(u,x,'od'), f1=A.hasDot(u,x,'fc'), f2=A.hasDot(u,x,'fc2'); let n=0;
      if(od||f1||f2){ n=1; if(T.P.corr&&f1&&f2){ n=2; if((T.s.corrE||0)<25){ T.s.corrE=(T.s.corrE||0)+5; u.energy=Math.min(100,(u.energy||0)+5); } } }
      else if(T.P.rk&&A.markOf(u,x,'lien')) n=1;
      if(n) T.fn.write(A,T,u,n); },
    write(A,T,u,n){ A.stSet(T,u,'entry',A.stGet(T,'entry')+n); A.stSet(T,u,'entryW',A.stGet(T,'entryW')+n); },
    /* No Relief: the enemy whose hit is resolving now (its lifesteal heal comes right after, inside the same hit) */
    lsRec(A,T,u,c){ T.s.lsS=c.src; T.s.lsT=now(A); },
    lsHeal(A,T,u,c){ const x=c.unit; return !!x&&x===T.s.lsS&&T.s.lsT===now(A)&&!!A.markOf(u,x,'lien'); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/24 - GRIMSBY - talent decisions.md) */
  ruling:{}
};
