/* VESPER - what her learned talents do in a fight (the mechanics; her plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Vesper")
   Her real kit (the code, not the tooltip wording; a mid-row Mage, damage profile Magic: her basic attacks and every skill hit are MAGIC; tests/vesper-kit-facts.js):
   - Errata (green 'erratafield', delivered as a form 0.35 s after the release, cd 9): a ground hazard centred on her target, 3 m CENTRE to centre, 5 s, a tick every
     0.5 s of 20% of her ability power x skill level on every enemy whose centre is inside (not a hit: damage() straight, magic resist applies), and on each tick a
     silence written STRAIGHT on (no ccApply, no resist roll): the table's 1.5 s area silence x 0.7 = 1.05 s. MEASURED: 114 casts, its target inside 113, one enemy a field.
   - Loose Leaf (blue 'pagestorm', cd 8): every enemy ahead of her within 39 px (1.2 m) of the line to the FARTHEST enemy is struck for 110% of her ability power x skill
     level; 0.45 x 0.82 = 0.37 s later the same enemies are struck again for 70% (u._pageBack, the status pass: no skill is resolving then - the guarded part pair
     'vpBack' names it). MEASURED: 131 casts, 1-2 enemies a cast, the return strikes the same ones.
   - Puncture (the 'riftpuncture' ultimate, delivered as a form): EVERY enemy on the field is frozen (ccApply 'stunned': the table's single 3 s x 0.7 = 2.1 s) and
     silenced (ccApply: 6 s x 0.7, cut at the 3.85 s ceiling, from the cast: 1.75 s left when the freeze ends). It deals no damage. MEASURED: 95 casts, 369 freezes.
   - Scriptorium (passive, from 3 stars): every living unit of her side gains 1 x passMul energy a second.
   Notes, Corrected, Struck Out, Second Verse, Ink, Proof, Crossed, Deadline, Proofread and Fair Copy exist only through her talents. Each family's bookkeeping runs
   when any talent of it is learned, so every talent works on its own (the defining talent's ranks give the family's base number).
   Readings, caps and corrected tooltips: WIRING/62 - VESPER - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
/* the families: their bookkeeping runs when any of these is learned */
const NOTE=['rp_1_2','rp_1_3','rp_2_2','rp_3_2','rp_n1','rp_5_2','rp_5_3','rp_4_3','rp_n2','rp_7_2','rp_8_2','rp_9_2','rp_12_2','rp_13_3'];   // Notes and Corrected
const SO=['rp_2_4','rp_5_4','rp_9_1','rp_9_2','rp_10_1','rp_11_1','rp_13_3'];                                                       // Struck Out
const ECHO=['sv_1_1','sv_2_1','sv_3_1','sv_4_1','sv_7_1','sv_8_1','sv_8_3','sv_10_1','sv_11_3','sv_12_1','sv_13_2','rp_n1'];          // Second Verse
const INK=['sv_1_4','sv_2_4','sv_3_2','sv_3_4','sv_5_4','sv_6_4','sv_8_4','sv_9_2','sv_9_4','sv_n1','sv_n2','sv_13_2'];             // Ink (the Proof: Ink Well)
const CROSS=['sv_4_2','sv_6_2','sv_7_2','sv_12_2','sv_13_2'];                                                                        // Crossed
const DL=['sc_1_1','sc_2_1','sc_3_1','sc_4_1','sc_6_1','sc_7_1','sc_9_1','sc_10_1','sc_12_1','sc_n1'];                              // Deadline
const PR=['sc_1_4','sc_2_4','sc_3_3','sc_3_4','sc_7_3','sc_7_4','sc_13_3'];                                                         // Proofread
const FC=['sc_4_2','sc_5_2','sc_5_3','sc_8_2','sc_9_2','sc_11_2','sc_13_3'];                                                        // Fair Copy (an ally's ultimate)
const PUN=['rp_10_3','rp_11_3','sc_12_3','rp_11_1','rp_n3','sv_11_2','sv_12_2','sv_13_2','sc_10_3','sc_13_3','rp_13_3'];               // Puncture's cast changed / read
const ERR=['rp_2_4','rp_4_4','rp_7_4','rp_12_4','rp_13_3','sc_1_4','sc_2_4','sc_3_3','sc_3_4','sc_7_3','sc_7_4','sv_7_1','rp_1_3','sv_7_3','sv_9_3','rp_6_3','rp_12_2','sv_6_2','sv_4_2','rp_n1','sv_1_4','sv_2_4'].concat(ECHO,INK);   // her Errata fields made hers (their ticks run her rows)
const DRG=['rp_11_4','rp_12_4','sv_3_2','rp_1_2','rp_7_2','rp_9_1','rp_n3'];                                                        // hits on her: ONE capped group (30%)
const ALLY=['rp_1_2','rp_7_2','rp_9_1','rp_n3','sc_2_4','sc_6_1','sc_10_3'];                                                        // hits on her allies: ONE capped group (25%)
const AMP=['rp_12_2','rp_4_4','sv_6_2','sc_4_1','sc_9_2','sc_13_3'];                                                                // hits by her allies on enemies
const DR_FLOOR=0.70, ALLY_FLOOR=0.75, CTRL_MAX=4.0, RUN_TOP=4.0, LOCK=0.5;
const S=T=>T.s.vp||(T.s.vp={e:{},hz:[],ez:[],q:[],rec:null,cn:0,dl:null,fy:null,pr:{},pl:{},ult:0,fcN:0,lk:0,lkCd:0,fyN:0,ap:0,sh0:0,cid:0});   // her own per-fight state: every lock a countdown
const rk=(T,id)=>T.r[id]||0;
const any=(T,L)=>L.some(id=>T.r[id]);
const foes=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
const mates=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team===u.team&&x!==u&&!x._summon&&!x._dropHidden);
const LL=['pagestorm','vpBack'], ABIL=['pagestorm','vpBack','vpRift'];
module.exports={
  hero:'vesper',
  casting:true,                         // rows ask which of her skills a hit comes from
  states:{
    vpN:{unit:true,max:3,dur:P('nt.dur',8)},                        // Notes, on each enemy (all lapse 8 s after the last; Footnotes longer)
    vpInk:{max:P('ink.max',30)}                                      // Ink (Overflowing Ink holds more)
  },
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                      // countdowns, presses, Deadline, Proofread, echoes, fields
    {on:'wave',do:[{fn:'wv'}]},
    {on:'kit',do:[{fn:'kitRec'}]},                                                                                   // a skill of hers starts resolving: its record
    {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'hitRec'}]},                                                           // each hit of hers that lands (Ink, Notes, the Second Verse's record)
    {on:'cast',do:[{fn:'castEnd'}]},                                                                                 // a skill of hers has resolved
    {on:'out',if:{targetTeam:'enemy'},do:[{fn:'myOut'}]},                                                            // her damage: one function
    {on:'num',skill:'hzTick',reqAny:ERR,do:[{fn:'hzTick'}]},                                                         // a tick of an Errata of hers, on one enemy
    {on:'part',skill:'hz',reqAny:ERR,do:[{fn:'hzAfter'}]},                                                           // ...and after it (whom it silenced)
    {on:'partPre',skill:'vpBack',do:[{fn:'backPre'}]}, {on:'part',skill:'vpBack',do:[{fn:'backEnd'}]},             // Loose Leaf's return
    {on:'ccHit',reqAny:PUN.concat(NOTE,SO),do:[{fn:'ccHit'}]},                                                       // a control of hers landed (Puncture's freeze and silence)
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]}, {on:'dotIn',reqAny:DRG,do:[{fn:'myDr'}]},                                 // hits on her: one capped group
    {on:'teamIn',reqAny:ALLY.concat(AMP),do:[{fn:'teamIn'}]}, {on:'teamDotIn',reqAny:ALLY,do:[{fn:'teamDot'}]},    // her allies' hits, and hits on them
    {on:'teamCast',reqAny:FC.concat(['sc_6_2']),do:[{fn:'teamCast'}]},                                               // an ally's ultimate (a Fair Copy)
    {on:'teamCc',reqAny:PR,do:[{fn:'prCc'}]}                                                                         // a control on a Proofread ally
  ],
  talents:{
    /* ============================== THE RED PEN ============================== */
    rp_1_1:[ {param:'ll.k',add:R(0.03)} ],                                                                       // Copyist's Eye (in myOut)
    rp_1_2:[ {param:'nt.k',add:R(0.01)} ],                                                                       // Marginalia (Notes: addNote; in srcK)
    rp_1_3:[ {param:'ab.nt',add:R(0.02)} ],                                                                      // Steady Hand (in abK)
    rp_2_2:[ {stat:{move:R(-0.02)},to:{team:'enemy',ust:{vpN:1}},per:{ust:'vpN'}} ],                              // Heavy Notes
    rp_2_4:[ {param:'so.k',add:R(0.3)} ],                                                                        // Struck Out (hzAfter)
    rp_2_1:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                              // Narrow Margin
    rp_3_2:[ {param:'cr.sil',add:1} ],                                                                           // Errata Slip (in correct)
    rp_n1:[  {param:'cr.mr',add:1} ],                                                                            // Marked for Reprint (LINK: correct, castEnd)
    rp_3_4:[ {on:'kit',skill:'erratafield',opt:{silence:{add:R(0.1),ccRaw:true}}} ],                             // Strike Through
    rp_5_2:[ {param:'ri.on',add:1} ],                                                                            // Red Ink (PICK ONE; hitRec, backEnd)
    rp_5_3:[ {param:'bi.on',add:1} ],                                                                            // Black Ink (PICK ONE; in correct)
    rp_4_3:[ {param:'nt.dur',add:R(1)} ],                                                                        // Footnotes
    rp_5_4:[ {param:'so.nrg',add:R(1)} ],                                                                        // Lost Lines (in struckOut)
    rp_4_1:[ {on:'kit',skill:'erratafield',opt:{radius:{addM:R(0.2)}}} ],                                        // Wide Margin
    rp_n2:[  {on:'hit',if:{auto:true,targetTeam:'enemy'},chance:R(0.04),do:[{fn:'glance'}]} ],                   // Second Glance
    rp_4_4:[ {param:'amp.is',add:R(0.03)} ],                                                                     // Ink Stain (in teamK)
    rp_6_1:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                               // Index
    rp_6_3:[ {param:'qr.k',add:R(0.03)} ],                                                                       // Quiet Room (in myK)
    rp_6_4:[ {on:'kit',skill:'erratafield',opt:{dur:{add:R(0.2)}}} ],                                            // Long Errata
    rp_7_1:[ {on:'kit',skill:'pagestorm',opt:{width:{more:R(0.02)}}} ],                                          // Margin Notes
    rp_7_2:[ {param:'cr.pc',add:R(0.02)} ],                                                                      // Proof Copy (in correct; srcK)
    rp_7_4:[ {param:'red.on',add:1} ],                                                                           // Redaction (tk: a field's end)
    rp_8_2:[ {stat:{aspd:R(-0.03)},to:{team:'enemy',ust:{vpN:2}}} ],                                             // Second Reading
    rp_8_3:[ {on:'cd',less:R(0.01)} ],                                                                           // Fine Print
    rp_8_4:[ {on:'kit',skill:'erratafield',opt:{dps:{more:R(0.05)}}} ],                                          // Dry Ink
    rp_9_1:[ {param:'so.eh',add:R(0.015)} ],                                                                     // Errant Hand (in struckOut; srcK)
    rp_9_2:[ {param:'cr.fd',add:1} ],                                                                            // Final Draft (in press)
    rp_10_1:[ {param:'so.k',add:R(0.05)} ],                                                                      // Long Memory
    rp_10_3:[ {param:'fz.ext',add:R(0.1)} ],                                                                     // Eleven Errors (in ccHit)
    rp_n3:[  {param:'fr.k',add:R(0.05)} ],                                                                       // For the Record (in silence, ccHit, castEnd; srcK)
    rp_11_1:[ {param:'so.pun',add:1} ],                                                                          // Cross Reference (in ccHit)
    rp_11_3:[ {param:'si.ext',add:R(0.1)} ],                                                                     // Margin of Error (in ccHit)
    rp_11_4:[ {param:'dr.bs',add:R(0.015)} ],                                                                    // Bound Spine (in drK)
    rp_12_2:[ {param:'amp.es',add:R(0.005)} ],                                                                   // Errata Sheet (in teamK)
    rp_12_3:[ {stat:{nrg:R(0.02)}} ],                                                                            // Tight Binding
    rp_12_4:[ {param:'dr.ss',add:R(0.04)} ],                                                                     // Safe Shelf (in drK)
    rp_13_3:[ {param:'sig.tv',add:1} ],                                                                          // The True Version (SIGNATURE: ccHit, castEnd, tk)

    /* ============================== THE SECOND VERSE ============================== */
    sv_1_1:[ {param:'ec.k',add:R(0.10)} ],                                                                       // Second Verse (castEnd, echo)
    sv_1_3:[ {param:'ll.k',add:R(0.02)} ],                                                                       // Sharp Pages
    sv_1_4:[ {param:'pf.k',add:R(0.12)} ],                                                                       // Ink Well (the Proof: proof)
    sv_2_1:[ {param:'ec.soon',add:R(0.2)} ],                                                                     // Refrain
    sv_2_4:[ {param:'ink.n',add:R(1)} ],                                                                         // Deep Well
    sv_3_1:[ {param:'ec.ch',add:1} ],                                                                            // Chorus
    sv_3_2:[ {param:'dr.mw',add:R(0.001)} ],                                                                     // Margin Weight (in drK)
    sv_3_3:[ {param:'ll.back',add:R(0.04)} ],                                                                    // Paper Cut (in myOut)
    sv_3_4:[ {param:'pf.sil',add:0.5} ],                                                                         // Blotted (in proof)
    sv_4_1:[ {param:'ec.cad',add:R(0.2)} ],                                                                      // Cadence (in echoLand)
    sv_4_2:[ {param:'cx.mr',add:R(0.03)} ],                                                                      // Crossed Lines (in myOut, hzTick)
    sv_4_3:[ {on:'kit',skill:'erratafield',opt:{dps:{more:R(0.05)}}} ],                                          // Sure Stroke
    sv_5_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.03)} ],                                        // Inkblood
    sv_8_1:[ {param:'ec.mr',add:R(0.04)} ],                                                                      // Cold Reading (in echoLand)
    sv_5_4:[ {param:'pf.sp',add:R(0.03)} ],                                                                      // Spilled Ink (in proof)
    sv_6_2:[ {param:'amp.ch',add:R(0.015)} ],                                                                    // Cross Hatch (in teamK)
    sv_6_3:[ {on:'cd',less:R(0.015)} ],                                                                          // Quick Quill
    sv_6_4:[ {param:'pf.nrg',add:R(2)} ],                                                                        // Inkfall (in proof)
    sv_7_1:[ {param:'ec.ev',add:R(0.3)} ],                                                                       // Echoing Verse (in echoLand)
    sv_7_2:[ {param:'tm.on',add:1} ],                                                                            // Torn Margin (in backPre)
    sv_7_3:[ {param:'ab.ev',add:R(0.02)} ],                                                                      // Early Verse (in abK)
    sv_8_3:[ {param:'ec.bt',add:R(0.04)} ],                                                                      // Bold Type (in echoLand)
    sv_5_2:[ {param:'tt.on',add:1} ],                                                                            // Twice Torn (PICK ONE; backEnd)
    sv_5_3:[ {on:'kit',skill:'pagestorm',opt:{width:{more:0.3},reach:{addM:3}}} ],                              // Long Stanza (PICK ONE): the line reaches 3 m past the farthest enemy (the page reads o.reach, engine length units)
    sv_8_4:[ {param:'ink.max',add:R(5)}, {param:'pf.ov',add:R(0.02)} ],                                          // Overflowing Ink
    sv_9_2:[ {param:'ink.tp',add:R(1)} ],                                                                        // Turned Page (in backEnd)
    sv_9_3:[ {param:'ab.uf',add:R(0.02)} ],                                                                      // Unfinished (in abK)
    sv_9_4:[ {param:'pf.pm',add:1} ],                                                                            // Printer's Mark (in proof)
    sv_10_1:[ {param:'ec.vc',add:1} ],                                                                           // Verse and Chorus (in echoLand)
    sv_n1:[  {param:'pf.keep',add:R(2)} ],                                                                       // Wet Nib (in proof)
    sv_11_2:[ {param:'rs.k',add:R(0.15)} ],                                                                      // Rift Script (in castEnd)
    sv_11_3:[ {param:'ec.nrg',add:R(1)} ],                                                                       // Margin Rush (in echoLand)
    sv_n2:[  {param:'ink.hd',add:R(4)} ],                                                                        // Halfway Down the Page (in tk)
    sv_12_1:[ {param:'ec.rh',add:R(0.05)} ],                                                                     // Rhyme (in echoLand)
    sv_12_2:[ {param:'rs.cx',add:R(0.04)} ],                                                                     // Torn Sky (in myOut)
    sv_12_4:[ {stat:{nrg:R(0.02)}} ],                                                                            // Last Line
    sv_13_2:[ {param:'sig.uv',add:1} ],                                                                          // The Unprinted Verse (SIGNATURE: castEnd, ccHit)

    /* ============================== THE SCRIPTORIUM ============================== */
    sc_1_1:[ {param:'dl.k',add:R(4)} ],                                                                          // Deadline (in deadline)
    sc_2_3:[ {param:'scr.bd',add:R(0.02)} ],                                                                     // Busy Desks (in tk)
    sc_1_4:[ {param:'pr.k',add:R(0.05)} ],                                                                       // Proofread (in prCc)
    sc_2_1:[ {param:'dl.soon',add:R(0.5)} ],                                                                     // Early Deadline
    sc_2_4:[ {param:'pr.dr',add:R(0.02)} ],                                                                      // Second Proof (in allyK)
    sc_3_1:[ {param:'dl.ns',add:3} ],                                                                            // Night Shift
    sc_3_2:[ {on:'ccIn',less:R(0.04)} ],                                                                         // Unrushed (up to 20%)
    sc_3_3:[ {stat:{armor:R(0.02)},to:{team:'ally',others:true,fn:'prU'}} ],                                     // Desk Leather
    sc_3_4:[ {param:'pr.cc',add:1} ],                                                                            // Clear Copy (in tk)
    sc_4_1:[ {param:'dl.ll',add:R(0.01)} ],                                                                      // Late Lamp (in teamK)
    sc_4_2:[ {param:'fc.dur',add:R(0.8)} ],                                                                      // Fair Copy (in teamCast, tk)
    sc_9_4:[ {on:'kit',skill:'erratafield',opt:{dps:{more:R(0.04)}}} ],                                          // Quiet Corner
    sc_5_1:[ {on:'cd',less:R(0.015)} ],                                                                          // Ledger
    sc_5_2:[ {param:'fc.sd',add:1} ],                                                                            // Shared Desk (PICK ONE; teamCast)
    sc_5_3:[ {param:'fc.hc',add:10} ],                                                                           // Head Copyist (PICK ONE; teamCast)
    sc_5_4:[ {on:'kit',skill:'erratafield',opt:{dur:{add:R(0.2)}}} ],                                            // Margin of Safety
    sc_6_1:[ {param:'dl.cw',add:R(0.02)} ],                                                                      // Collected Works (in allyK)
    sc_6_2:[ {stat:{aspd:R(0.002)},to:{team:'ally'},per:{fn:'ultN'},if:{selfPass:'scriptorium'}} ],             // Gilt Edge
    sc_6_4:[ {on:'kit',skill:'erratafield',opt:{radius:{addM:R(0.3)}}} ],                                        // Safe Ground
    sc_7_1:[ {param:'dl.ro',add:R(0.08)} ],                                                                      // Rush Order (in deadline)
    sc_7_3:[ {param:'pr.sh',add:0.01} ],                                                                         // Study Hall (in tk)
    sc_7_4:[ {param:'pr.bg',add:R(0.4)} ],                                                                       // Binding Glue (in tk)
    sc_8_2:[ {param:'fc.dur',add:R(0.2)} ],                                                                      // Copy Desk
    sc_8_3:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                              // Inkpot
    sc_9_1:[ {stat:{apow:R(0.01)},to:{team:'ally',others:true,has:'vpAH'}} ],                                    // All Hands (the mark: deadline)
    sc_9_2:[ {param:'fc.il',add:0.10} ],                                                                         // Illuminated (in teamK)
    sc_10_1:[ {param:'dl.ch',add:1} ],                                                                           // Closing Hour (in wv)
    sc_10_2:[ {param:'mh.k',add:R(1)} ],                                                                         // Margin Help (in castEnd)
    sc_10_3:[ {param:'pp.k',add:R(0.01)} ],                                                                      // Puncture Proof (in castEnd; allyK)
    sc_11_2:[ {stat:{apow:R(0.01)},per:{fn:'lsN'}} ],                                                            // Long Shift (the count: teamCast)
    sc_11_3:[ {stat:{nrg:R(0.02)}} ],                                                                            // Steady Light
    sc_11_4:[ {on:'healMe',more:R(0.02)}, {param:'sq.k',add:R(0.02)} ],                                          // Spare Quill (heals; shields in tk)
    sc_12_1:[ {param:'dl.ot',add:R(1)} ],                                                                        // Overtime (in deadline)
    sc_12_3:[ {param:'si.ext',add:R(0.1)} ],                                                                     // Annotated Rift (in ccHit)
    sc_n1:[  {param:'dl.co',add:R(0.3)} ],                                                                       // Carried Over (in deadline)
    sc_13_3:[ {param:'sig.fy',add:1} ]                                                                           // The Fourth Year (SIGNATURE: castEnd, teamCast, teamIn, tk)
  },
  fn:{
    /* ---- each tick: the countdowns of her records, the enemies' presses (a Correction's failed cast, The True Version's window), the freeze ends (The True
       Version), Halfway Down the Page, her Errata fields (Proofread, Clear Copy, Study Hall, Redaction), her echo fields, the Second Verses due, the Deadline clock,
       Scriptorium's extra speed (Busy Desks, Fair Copy), shields on her (Spare Quill), The Fourth Year's copy ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), P=T.P, dt=c.dt||0, F=foes(A,u);
      if(o.lkCd>0) o.lkCd=Math.max(0,o.lkCd-dt);
      if(o.f==null) o.f={nt:any(T,NOTE), so:any(T,SO), ink:any(T,INK), pr:any(T,PR), fc:any(T,FC), dl:any(T,DL), hd:!!P['ink.hd']&&!!T.r.sv_1_4};
      /* her Errata fields still down; one that has gone (its time ran out) ends: Redaction */
      if(o.hz.length){ const H=E.hazards?E.hazards():[]; for(let i=0;i<o.hz.length;i++){ const h=o.hz[i]; if(H.indexOf(h)>=0&&h.life>0) continue; o.hz.splice(i--,1);
          if(P['red.on']&&!o.wvCut) for(const e of F) if(Math.hypot(e.x-h.x,e.y-h.y)<=h.r){ const cap=E.ccCap('silencedT'), d=0.7*(1-Math.min(1,e.ctrlRes||0)); e.silencedT=Math.min(cap||(e.silencedT||0)+d,(e.silencedT||0)+d); } } }
      o.wvCut=0;
      /* the enemies, one walk: records' countdowns, presses, freeze ends, half health */
      const tvOn=A.winOn(T,'vpTV'), watchP=o.f.nt||tvOn;
      for(const e of F){ let r=o.e[e.uid]; if(!r){ if(!(watchP||o.f.hd)) continue; r=T.fn.rec(T,e); }
        if(r.lock>0) r.lock=Math.max(0,r.lock-dt); if(r.fr>0) r.fr=Math.max(0,r.fr-dt); if(r.cap>0) r.cap=Math.max(0,r.cap-dt);
        if(r.st>0){ r.re+=dt; r.st=((e.stunned||0)>0)?Math.min(r.st-dt,e.stunned):0; if(r.st<=1e-9){ if(r.re>=RUN_TOP-0.05) r.cap=LOCK; r.st=0; r.re=0; } }
        const p=e._pend||null; if(p&&p!==r.pd&&p.spell) T.fn.press(A,T,u,e,r,p,tvOn); r.pd=e._pend||null;
        if(r.tvz&&!((e.stunned||0)>0)){ r.tvz=0; T.fn.addNote(A,T,u,e,3,true); }
        if(o.f.hd){ const f=e.hp/Math.max(1,e.maxHp); if(!r.hd&&f<0.5){ r.hd=1; T.fn.addInk(A,T,u,P['ink.hd']); } } }
      for(const k in o.e){ const r=o.e[k]; if(!r.u.alive) delete o.e[k]; }
      /* Proofread: allies standing in one of her Errata fields (body over it), Binding Glue's linger, The Fourth Year's 6 s; Clear Copy; Study Hall */
      if(o.f.pr){ const pr={}, fy=A.winOn(T,'vpFY'); o.shT=(o.shT||0)+dt; const heal=P['pr.sh']&&o.shT>=1; if(heal) o.shT-=1;
        for(const a of mates(A,u)){ const inn=T.fn.inField(A,T,a,true); let on=inn||fy;
          if(inn) o.pl[a.uid]=P['pr.bg']||0; else if(o.pl[a.uid]>0){ o.pl[a.uid]=Math.max(0,o.pl[a.uid]-dt); on=true; }
          if(on) pr[a.uid]=1;
          if(P['pr.cc']&&inn&&!o.pin[a.uid]&&!(o.ccL[a.uid]>0)){ for(const f of ['stunned','fearT','silencedT','_sleepT','slow']) if((a[f]||0)>0){ a[f]=0; o.ccL[a.uid]=8; break; } }
          if(o.ccL[a.uid]>0) o.ccL[a.uid]=Math.max(0,o.ccL[a.uid]-dt);
          if(heal&&inn&&on) E.healUnit(a,P['pr.sh']*a.maxHp);
          o.pin[a.uid]=inn; }
        o.pr=pr; }
      /* her echo fields (an Errata written twice): a tick every 0.5 s on every enemy whose centre is inside, damage only */
      for(let i=0;i<o.ez.length;i++){ const z=o.ez[i]; z.left-=dt; z.acc+=dt; if(z.acc>=0.5-1e-9){ z.acc-=0.5;
          for(const e of F) if(Math.hypot(e.x-z.x,e.y-z.y)<=z.r) A.hurt(T,u,e,z.dmg*E.defMul(u,e,'magic')*T.fn.tickK(A,T,u,e)*z.k*T.fn.mrK(A,T,u,e,z.mr),'#c9a227','vpEcho'); }
        if(z.left<=1e-9) o.ez.splice(i--,1); }
      /* the Second Verses due */
      for(let i=0;i<o.q.length;i++){ const q=o.q[i]; q.left-=dt; if(q.left>1e-9) continue; o.q.splice(i--,1); T.fn.echoLand(A,T,u,q); }
      /* the Deadline clock (only while enemies stand: the march between waves does not count) */
      if(o.f.dl&&F.length){ if(o.dl==null) o.dl=Math.max(1,10-(P['dl.soon']||0)); o.dl-=dt; if(o.dl<=1e-9){ o.dl+=Math.max(1,10-(P['dl.soon']||0)); T.fn.deadline(A,T,u); } }
      /* Scriptorium: Busy Desks (2% x rank more of its energy), a Fair Copy (three times as fast for the team but the ally who cast) */
      if(u.pass&&u.pass.scriptorium&&(P['scr.bd']||A.winOn(T,'vpFC'))){ const rate=(u.passMul||1)*dt, fc=A.winOn(T,'vpFC');
        for(const x of E.units()){ if(!x.alive||x.team!==u.team) continue; let g=rate*(P['scr.bd']||0); if(fc&&x!==o.fcBy) g+=2*rate*(1+(P['scr.bd']||0)); if(g>0) x.energy=Math.min(100,(x.energy||0)+g); } }
      /* Spare Quill: a shield on her that grew since her last tick grows that share more */
      if(P['sq.k']){ const s=u.shield||0; if(s>o.sh0+1e-9) u.shield=s+(s-o.sh0)*P['sq.k']; o.sh0=u.shield||0; }
      /* The Fourth Year: the copy of the flagged ally's ultimate, 2 s after it was used */
      if(o.fy&&o.fy.on){ o.fy.left-=dt; if(o.fy.left<=1e-9){ const sum=o.fy.sum; o.fy=null; let b=null,bd=1e18; for(const e of F){ const d=E.dist(u,e); if(d<bd){ bd=d; b=e; } } if(b&&sum>0) A.hurt(T,u,b,0.30*sum,'#c9a227','vpCopy'); } } },
    wv(A,T,u){ const o=S(T), P=T.P; o.e={}; o.hz=[]; o.ez=[]; o.q=[]; o.pr={}; o.pl={}; o.pin={}; o.ccL={}; o.fcN=0; o.wvCut=1; o.fcBy=null; o.rec=null;
      if(o.fy&&o.fy.on) o.fy=null;
      if(P['dl.ch']&&any(T,DL)){ o.dl=Math.max(1,10-(P['dl.soon']||0)); T.fn.deadline(A,T,u); } },
    rec(T,e){ const o=S(T); return o.e[e.uid]||(o.e[e.uid]={u:e,lock:0,corr:0,pd:e._pend||null,fr:0,st:0,re:0,cap:0,tvz:0,tvF:0,hd:0}); },
    inField(A,T,x,body){ const o=S(T), E=A.eng(); for(const h of o.hz){ if(!(h.life>0)) continue; const d=Math.hypot(x.x-h.x,x.y-h.y); if(body?(d-E.bodyR(x)<h.r):(d<=h.r)) return true; } return false; },
    prU(A,T,u,c){ const x=c.tgt; return !!(x&&S(T).pr[x.uid]); },
    ultN(A,T){ return Math.min(5,S(T).ult||0); },
    lsN(A,T){ return Math.min(5,S(T).fcN||0); },
    /* ---- A SKILL OF HERS: kit (it starts resolving: a record for the Second Verse and for Ink), each hit of it, its end ---- */
    kitRec(A,T,u,c){ const o=S(T); if(['erratafield','pagestorm','riftpuncture'].indexOf(c.skill)<0){ o.rec=null; return; } o.rec={skill:c.skill,hits:new Map(),back:new Map(),ink:new Set(),out:new Set(),fz:[],sil:new Set(),id:++o.cid}; },
    hitRec(A,T,u,c){ const o=S(T), t=c.tgt, cur=T.s.cur; if(!t) return;
      if((cur==='pagestorm'||cur==='riftpuncture'||cur==='vpRift')&&o.rec&&!c.auto){ const R0=o.rec; R0.hits.set(t,(R0.hits.get(t)||0)+(c.amt||0)); T.fn.inkHit(A,T,u,R0,t);
        if(cur==='pagestorm'){ R0.out.add(t); if(T.P['ri.on']) T.fn.addNote(A,T,u,t,1); } }
      else if(cur==='vpBack'&&o.bk){ const B=o.bk; if(!B.sec){ B.rec.back.set(t,(B.rec.back.get(t)||0)+(c.amt||0)); } T.fn.inkHit(A,T,u,B.rec,t); }
      if(c.auto&&T.r.sv_1_4&&A.stGet(T,'vpInk')>=30&&!o.pfOn) T.fn.proof(A,T,u,t); },
    inkHit(A,T,u,R0,t){ const P=T.P; if(!S(T).f||!S(T).f.ink||R0.ink.has(t)) return; R0.ink.add(t); T.fn.addInk(A,T,u,2+(P['ink.n']||0)); },
    addInk(A,T,u,n){ if(!(n>0)) return; A.stSet(T,u,'vpInk',A.stGet(T,'vpInk')+n); },
    castEnd(A,T,u,c){ const o=S(T), P=T.P, E=A.eng(), R0=o.rec, sk=c.skill; o.rec=null; if(!R0||R0.skill!==sk) return;
      if(sk==='erratafield'&&any(T,ERR)){ const H=E.hazards?E.hazards():[]; for(let i=H.length-1;i>=0;i--){ const h=H[i]; if(h.src===u&&h.silence&&!h._talZ){ h._talZ=u; h._vpF={seen:new Set(),sil:new Set()}; h._vpL0=h.life; o.hz.push(h); R0.hz=h; break; } } }
      if(sk==='pagestorm'){ if(u._pageBack){ u._pageBack._vpR=R0; o.pbT=u._pageBack.t; }
        if(P['mh.k']){ const F=foes(A,u); let far=null,fd=-1; for(const e of F){ const d=E.dist(u,e); if(d>fd){ fd=d; far=e; } }
          if(far){ const L=Math.hypot(far.x-u.x,far.y-u.y)||1, ux=(far.x-u.x)/L, uy=(far.y-u.y)/L, W=(c.o&&c.o.width)||34*1.15, RCH=(c.o&&c.o.reach!=null)?c.o.reach:20;
            for(const a of mates(A,u)){ const rx=a.x-u.x, ry=a.y-u.y, p=rx*ux+ry*uy; if(p>=0&&p<=L+RCH&&Math.abs(rx*uy-ry*ux)<=W) a.energy=Math.min(100,(a.energy||0)+P['mh.k']); } } } }
      if(sk==='riftpuncture') T.fn.puncture(A,T,u,c,R0);
      /* the Second Verse: every 3rd ability (Chorus: every 2nd); Marked for Reprint's link; The Unprinted Verse's 6 s at full damage */
      if(any(T,ECHO)){ o.cn++; const every=P['ec.ch']?2:3, uv=A.winOn(T,'vpUV')&&sk!=='riftpuncture', link=o.lk&&T.r.sv_1_1;
        let k=0; if(uv) k=1; else if((o.cn%every===0)||link) k=P['ec.k']||0; if(link&&!uv) o.lk=0; else if(link&&uv) o.lk=0;
        if(k>0){ const d=Math.max(0.05,1-(P['ec.soon']||0)); o.q.push({left:d,rec:R0,k,part:sk==='pagestorm'?'out':sk==='erratafield'?'zone':'rift',mr:P['ec.mr']||0}); } }
      if(sk==='riftpuncture'&&P['sig.uv']){ A.acts(T,u,[{window:'vpUV',dur:6}],c); A.stSet(T,u,'vpInk',Math.max(A.stGet(T,'vpInk'),30)); } },
    /* ---- PUNCTURE resolved: Rift Script (15% x rank of her ability power to each enemy it froze, a real magic hit of hers: 'vpRift'), For the Record (a silence
       that did not land), The True Version, Puncture Proof, The Fourth Year, Gilt Edge's count ---- */
    puncture(A,T,u,c,R0){ const o=S(T), P=T.P, E=A.eng(), F=foes(A,u);
      o.ult++;
      if(P['rs.k']&&E.strike&&R0.fz.length){ const d0=T.s.d, c0=T.s.cur; T.s.d=0; T.s.cur='vpRift'; o.rec=R0;
        try{ for(const e of R0.fz) if(e.alive&&u.alive) E.strike(u,e,P['rs.k']*(u.apow||0),'#c9a227','magic'); } finally{ T.s.d=d0; T.s.cur=c0; o.rec=null; } }
      if(P['fr.k']) for(const e of F) if(!R0.sil.has(e)&&!((e.silencedT||0)>0)) T.fn.ftr(A,T,u,e);
      if(P['sig.tv']){ A.acts(T,u,[{window:'vpTV',dur:6}],c); for(const e of R0.fz){ if(!e.alive) continue; const r=T.fn.rec(T,e); r.tvz=1; r.tvF=0; } }
      if(P['sig.uv']) for(const e of R0.fz) if(e.alive) A.setMark(T,u,e,'vpX',{dur:6,longest:true});
      if(P['pp.k']) A.acts(T,u,[{window:'vpPP',dur:4}],c);
      if(P['sig.fy']){ for(const a of mates(A,u)) a.energy=Math.min(100,(a.energy||0)+20); A.acts(T,u,[{window:'vpFY',dur:6}],c); o.fyN=1; } },
    /* ---- THE CONTROLS OF HERS THAT LAND (ccHit): Puncture's freeze (Eleven Errors: in full; never more than 4.0 s of her stuns in a row on one enemy, then 0.5 s
       free) and its silence (made longer in full by Margin of Error and Annotated Rift, so it still runs 1.75 s + theirs past the freeze; Cross Reference) ---- */
    ccHit(A,T,u,c){ const o=S(T), P=T.P, t=c.tgt; if(c.talent||!t||t.team===u.team||!(c.amt>0)||T.s.cur!=='riftpuncture') return; const R0=o.rec;
      if(c.field==='stunned'){ const r=T.fn.rec(T,t), run=r.st>0, room=run?Math.max(0,RUN_TOP-r.re):RUN_TOP, x=P['fz.ext']||0;
        const L=(r.cap>0)?0:Math.min(CTRL_MAX,(c.amt||0)+x,room); t.stunned=L>c.amt?L:Math.min(t.stunned||0,Math.max(L,0)); if(r.cap>0&&!(L>0)) t.stunned=Math.max(0,t.stunned);
        if(!run) r.re=0; r.st=Math.max(r.st,t.stunned||0); if(R0&&t.alive&&(t.stunned||0)>0) R0.fz.push(t); }
      if(c.field==='silencedT'){ if(R0) R0.sil.add(t); const r=T.fn.rec(T,t), x=P['si.ext']||0; if(x>0) t.silencedT=Math.max(t.silencedT||0,Math.min((t.stunned||0)+CTRL_MAX,(c.amt||0)+x));
        if(P['so.pun']||(any(T,SO)&&T.r.rp_11_1)) T.fn.struckOut(A,T,u,t); } },
    /* ---- AN ENEMY PRESSED A GREEN OR BLUE (its cooldown is set and its cast is pending): a Correction makes it fail (the game's own cast cancel: the cooldown
       runs from the press, nothing resolves), Last Revision; The True Version's 6 s: one cast inside an Errata of hers fails and is Struck Out ---- */
    press(A,T,u,e,r,p,tvOn){ const E=A.eng(), P=T.P; let fail=false;
      if(r.corr){ r.corr=0; fail=true; if(P['cr.fd']) T.fn.struckOut(A,T,u,e,'other'); }
      else if(tvOn&&!r.tvF&&T.fn.inField(A,T,e,false)){ r.tvF=1; fail=true; T.fn.struckOut(A,T,u,e); }
      if(fail&&E.castCancel){ E.castCancel(e,'CORRECTED'); r.fails=(r.fails||0)+1; S(T).fails=(S(T).fails||0)+1; } },
    /* ---- NOTES: a unit stack on each enemy (max 3; all lapse 8 s after the last, Footnotes longer). At 3 the enemy is CORRECTED (each enemy once every 15 s;
       The True Version's three always): its Notes clear and its next Green or Blue fails ---- */
    addNote(A,T,u,t,n,force){ if(!t||!t.alive||t.team===u.team) return; const o=S(T); if(!o.f||!o.f.nt) return; const was=A.ustGet(T,u,t,'vpN'), v=Math.min(3,was+n); A.ustPut(T,u,t,'vpN',v);
      const r=T.fn.rec(T,t); if(v>=3&&(force||!(r.lock>0))) T.fn.correct(A,T,u,t,r); },
    glance(A,T,u,c){ T.fn.addNote(A,T,u,c.tgt,1); },
    correct(A,T,u,t,r){ const o=S(T), P=T.P; A.ustPut(T,u,t,'vpN',0); r.lock=15; r.corr=1; o.corrN=(o.corrN||0)+1;
      if(P['cr.pc']) A.setMark(T,u,t,'vpPC',{dur:4});
      if(P['cr.mr']){ A.setMark(T,u,t,'vpMR',{dur:3}); if(T.r.sv_1_1&&!(o.lkCd>0)){ o.lk=1; o.lkCd=10; } }
      if(P['cr.sil']) T.fn.silence(A,T,u,t,1);
      if(P['bi.on']){ const E=A.eng(), M=E.METER(); for(const x of foes(A,u)) if(x!==t&&A.gap(t,x)<3*M) T.fn.addNote(A,T,u,x,1); } },
    /* ---- STRUCK OUT: Struck Out's 0.3 s x rank (+ Long Memory) on the cooldown of the enemy's ability closest to ready ('other': on every ability but the one it just
       pressed: Last Revision); Lost Lines, Errant Hand ---- */
    struckOut(A,T,u,e,how){ const P=T.P, add=P['so.k']||0; if(!e||!e.alive) return; const L=[];
      if(e.greenAb&&e.greenAb.cd>0) L.push('greenCd'); if(e.blueAb&&e.blueAb.cd>0) L.push('blueCd'); if(!L.length) return;
      let pick=[]; if(how==='other'){ const p=L.slice().sort((a,b)=>(e[a]||0)-(e[b]||0)); pick=p.slice(1); if(!pick.length) return; }   // the pressed one (closest to ready) is left alone; the others take the penalty
      else { let b=L[0]; for(const f of L) if((e[f]||0)<(e[b]||0)) b=f; pick=[b]; }
      for(const f of pick){ if(add>0) e[f]=(e[f]||0)+add; if(P['so.nrg']) u.energy=Math.min(100,(u.energy||0)+P['so.nrg']); S(T).soN=(S(T).soN||0)+1; }
      if(P['so.eh']) A.setMark(T,u,e,'vpEH',{dur:3}); },
    /* ---- a silence a talent of hers writes (Errata Slip, Redaction, Blotted): the stated seconds through the engine's control
       (the same 0.7 the engine's own controls land at); For the Record when it does not take ---- */
    silence(A,T,u,t,secs){ if(!t||!t.alive) return; A.control(T,u,t,'silencedT',secs*0.7); if(!((t.silencedT||0)>0)) T.fn.ftr(A,T,u,t); },
    ftr(A,T,u,t){ const P=T.P; if(!P['fr.k']||!t||!t.alive) return; const r=T.fn.rec(T,t); if(r.fr>0) return; r.fr=12; A.setMark(T,u,t,'vpFR',{dur:3}); S(T).frN=(S(T).frN||0)+1; },
    /* ---- HER ERRATA: each tick on one enemy (num 'hzTick': her damage talents, Ink the first time it reaches an enemy), then after the tick (part 'hz'): the enemies
       it silenced, Struck Out the first time this field silences each one ---- */
    hzTick(A,T,u,c){ const h=c.src, e=c.unit; if(!h||!h._vpF||h._talZ!==u||!e) return; const o=S(T);
      if(!h._vpF.seen.has(e)){ h._vpF.seen.add(e); if(o.f&&o.f.ink&&!(c.k===0)) T.fn.addInk(A,T,u,2+(T.P['ink.n']||0)); }
      c.amt*=T.fn.tickK(A,T,u,e)*T.fn.mrK(A,T,u,e,T.P['cx.mr']&&A.markOf(u,e,'vpX')?T.P['cx.mr']:0); },
    hzAfter(A,T,u,c){ const h=c.tgt, o=S(T); if(!h||!h._vpF||h._talZ!==u) return; if(!(o.f&&o.f.so)) return;
      for(const e of foes(A,u)) if(Math.hypot(e.x-h.x,e.y-h.y)<=h.r&&(e.silencedT||0)>0&&!h._vpF.sil.has(e)){ h._vpF.sil.add(e); T.fn.struckOut(A,T,u,e); } },
    /* ---- LOOSE LEAF'S RETURN (the guarded part pair 'vpBack' around the page's back pass): Torn Margin adds every Crossed enemy; after it, the enemies cut by both
       passes get a Note (Red Ink: a Note on each pass) and are Crossed for 4 s, Turned Page; Twice Torn sends the pages back once more at half ---- */
    backPre(A,T,u,c){ const o=S(T), pb=c.tgt; if(!pb||!pb.list) return; const R0=pb._vpR||{back:new Map(),out:new Set(),ink:new Set(),hits:new Map()}; pb._vpR=R0; o.bk={rec:R0,sec:!!pb._vp2};
      if(T.P['tm.on']&&!pb._vp2) for(const e of foes(A,u)) if(A.markOf(u,e,'vpX')&&pb.list.indexOf(e)<0) pb.list.push(e); },
    backEnd(A,T,u,c){ const o=S(T), P=T.P, pb=c.tgt, B=o.bk; o.bk=null; if(!pb||!B) return; const R0=B.rec;
      if(!B.sec){ const cx=any(T,CROSS);
        for(const [e] of R0.back){ if(!e.alive) continue; if(P['ri.on']) T.fn.addNote(A,T,u,e,1);
          if(R0.out.has(e)){ if(!P['ri.on']) T.fn.addNote(A,T,u,e,1); if(cx) A.setMark(T,u,e,'vpX',{dur:4,longest:true}); if(P['ink.tp']) T.fn.addInk(A,T,u,P['ink.tp']); } }
        if(P['tt.on']&&!u._pageBack&&o.pbT) u._pageBack={list:pb.list,t:o.pbT,mul:pb.mul*0.5,_vp2:1,_vpR:R0}; } },
    /* ---- THE SECOND VERSE LANDS: the skill's damage again, at the share (damage only: no cast, no Ink, no Note) - Loose Leaf's out-pass hits (Bold Type; Verse and
       Chorus: its return too, as long after as the return comes), Errata's field again at the same spot for its time (+ Echoing Verse), Puncture's Rift Script hits;
       Rhyme, Cold Reading; Cadence, Margin Rush ---- */
    echoLand(A,T,u,q){ const o=S(T), P=T.P, E=A.eng(), R0=q.rec; if(!u.alive) return; let k=q.k*(1+(P['ec.rh']||0));
      if(q.part==='out'||q.part==='back'){ if(P['ec.bt']) k*=1+P['ec.bt']; const M=q.part==='out'?R0.hits:R0.back;
        for(const [e,amt] of M) if(e.alive) A.hurt(T,u,e,amt*k*T.fn.mrK(A,T,u,e,q.mr),'#c9a227','vpEcho');
        if(q.part==='out'&&P['ec.vc']) o.q.push({left:o.pbT||0.37,rec:R0,k:q.k,part:'back',mr:q.mr}); }
      else if(q.part==='zone'){ const h=R0.hz; if(h) o.ez.push({x:h.x,y:h.y,r:h.r,left:(h._vpL0||5)+(P['ec.ev']||0),acc:0,dmg:h.dmg,k,mr:q.mr}); }
      else for(const [e,amt] of R0.hits) if(e.alive) A.hurt(T,u,e,amt*k*T.fn.mrK(A,T,u,e,q.mr),'#c9a227','vpEcho');
      if(q.part==='back') return;
      o.ecN=(o.ecN||0)+1;
      if(P['ec.cad']&&u.blueCd>0) u.blueCd=Math.max(0,u.blueCd-P['ec.cad']);
      if(P['ec.nrg']) u.energy=Math.min(100,(u.energy||0)+P['ec.nrg']); },
    /* ---- THE PROOF: at 30 Ink her next basic attack also pierces every enemy ahead of her on the line through its target (as wide as Loose Leaf's line) for 12% x rank of
       her ability power each (a real magic hit of hers: 'vpProof', not an ability); Spilled Ink, Overflowing Ink, Blotted, Inkfall, Wet Nib, Printer's Mark ---- */
    proof(A,T,u,t){ const o=S(T), P=T.P, E=A.eng(); if(!t||!E.strike) return; const have=A.stGet(T,'vpInk'); if(have<30) return;
      const keep=Math.min(have,P['pf.keep']||0); A.stSet(T,u,'vpInk',keep); const spent=have-keep;
      const L0=Math.hypot(t.x-u.x,t.y-u.y)||1, ux=(t.x-u.x)/L0, uy=(t.y-u.y)/L0, W=((u.blueAb&&u.blueAb.width)||34*1.15);
      const L=[]; for(const e of foes(A,u)){ const rx=e.x-u.x, ry=e.y-u.y, p=rx*ux+ry*uy; if(p>=0&&Math.abs(rx*uy-ry*ux)<=W) L.push([e,p]); } L.sort((a,b)=>a[1]-b[1]);
      const ov=Math.max(0,have-30)*(P['pf.ov']||0); let i=0, killed=false; const d0=T.s.d, c0=T.s.cur; T.s.d=0; T.s.cur='vpProof'; o.pfOn=1; o.pfN=(o.pfN||0)+1;
      try{ for(const [e] of L){ if(!e.alive||!u.alive) continue; const k=(1+(i>0?(P['pf.sp']||0):0))*(1+ov); E.strike(u,e,(P['pf.k']||0)*(u.apow||0)*k,'#2b1d0e','magic'); i++;
          if(!e.alive) killed=true; else if(P['pf.sil']) T.fn.silence(A,T,u,e,P['pf.sil']); } }
      finally{ T.s.d=d0; T.s.cur=c0; o.pfOn=0; }
      if(P['pf.nrg']) u.energy=Math.min(100,(u.energy||0)+P['pf.nrg']);
      if(P['pf.pm']&&killed) T.fn.addInk(A,T,u,Math.floor(spent/2)); },
    /* ---- HER DAMAGE (out, on an enemy): her abilities (Loose Leaf's passes, Rift Script) - Steady Hand, Early Verse, Unfinished, Copyist's Eye and Sharp Pages, Paper Cut,
       Torn Sky; every hit of hers - Quiet Room, Marked for Reprint, the team's (Errata Sheet, Ink Stain, Cross Hatch), Crossed Lines' magic resist ---- */
    myOut(A,T,u,c){ const P=T.P, t=c.tgt, cur=T.s.cur; let k=T.fn.myK(A,T,u,t);
      if(!c.auto&&ABIL.indexOf(cur)>=0){ k*=T.fn.abK(A,T,u,t); if(LL.indexOf(cur)>=0&&P['ll.k']) k*=1+P['ll.k']; if(cur==='vpBack'&&P['ll.back']) k*=1+P['ll.back']; if(cur==='vpRift'&&P['rs.cx']&&A.markOf(u,t,'vpX')) k*=1+P['rs.cx']; }
      c.amt*=k; if(P['cx.mr']&&c.kind==='magic'&&A.markOf(u,t,'vpX')) c.amt*=T.fn.mrK(A,T,u,t,P['cx.mr']); },
    abK(A,T,u,t){ const P=T.P; let k=1; const f=t.hp/Math.max(1,t.maxHp);
      if(P['ab.nt']&&A.ustGet(T,u,t,'vpN')>0) k*=1+P['ab.nt']; if(P['ab.ev']&&f>0.70) k*=1+P['ab.ev']; if(P['ab.uf']&&f<0.40) k*=1+P['ab.uf']; return k; },
    myK(A,T,u,t){ const P=T.P; let k=T.fn.teamK(A,T,u,t,null); if(P['qr.k']&&(t.silencedT||0)>0) k*=1+P['qr.k']; if(T.r.rp_n1&&A.markOf(u,t,'vpMR')) k*=1.06; return k; },
    teamK(A,T,u,t,s){ const P=T.P; let k=1;
      if(P['amp.es']){ const n=A.ustGet(T,u,t,'vpN'); if(n>0) k*=1+P['amp.es']*n; }
      if(P['amp.is']&&T.fn.inField(A,T,t,false)) k*=1+P['amp.is'];
      if(P['amp.ch']&&A.markOf(u,t,'vpX')) k*=1+P['amp.ch'];
      return k; },
    tickK(A,T,u,e){ return T.fn.myK(A,T,u,e)*T.fn.abK(A,T,u,e); },
    /* the share of a magic hit left after ignoring x of the target's magic resist, over the share left with all of it */
    mrK(A,T,u,t,x){ if(!(x>0)||!t) return 1; const E=A.eng(), a=E.defMul(u,t,'magic'); if(!(a>0)) return 1; const sv=t.mrRating; t.mrRating=(sv||0)*Math.max(0,1-x); const b=E.defMul(u,t,'magic'); t.mrRating=sv; return b/a; },
    /* ---- HITS ON HER: ONE GROUP. Bound Spine (from a silenced enemy), Safe Shelf (she stands in her own Errata), Margin Weight (each Ink she holds), and what her talents
       take from the enemy's own damage (Marginalia's Notes, Proof Copy, Errant Hand, For the Record): they multiply, together at most 30% off a hit ---- */
    srcK(A,T,u,s){ const P=T.P; let k=1; if(!s) return k;
      if(P['nt.k']){ const n=A.ustGet(T,u,s,'vpN'); if(n>0) k*=1-P['nt.k']*n; }
      if(P['cr.pc']&&A.markOf(u,s,'vpPC')) k*=1-P['cr.pc'];
      if(P['so.eh']&&A.markOf(u,s,'vpEH')) k*=1-P['so.eh'];
      if(P['fr.k']&&A.markOf(u,s,'vpFR')) k*=1-P['fr.k'];
      return k; },
    drK(A,T,u,s){ const P=T.P; let k=T.fn.srcK(A,T,u,s);
      if(P['dr.bs']&&s&&(s.silencedT||0)>0) k*=1-P['dr.bs'];
      if(P['dr.ss']&&T.fn.inField(A,T,u,true)) k*=1-P['dr.ss'];
      if(P['dr.mw']) k*=1-P['dr.mw']*A.stGet(T,'vpInk');
      return Math.max(DR_FLOOR,k); },
    myDr(A,T,u,c){ if(!T.s.api) T.s.api=A; const s=c.src||(c.dot&&c.dot.src); if(s&&s.team===u.team) return; c.amt*=T.fn.drK(A,T,u,s); },
    /* ---- HER ALLIES: one capped group on a hit on an ally (the enemy's damage her talents take: Notes, Proof Copy, Errant Hand, For the Record; Second Proof while
       Proofread, Collected Works, Puncture Proof): together at most 25%. Hits BY her allies on enemies: Errata Sheet, Ink Stain, Cross Hatch, Late Lamp, Illuminated;
       The Fourth Year's copy counts what the flagged ally's ultimate deals ---- */
    allyK(A,T,u,t,s){ const P=T.P, o=S(T); let k=T.fn.srcK(A,T,u,s);
      if(P['pr.dr']&&o.pr[t.uid]) k*=1-P['pr.dr'];
      if(P['dl.cw']&&A.markOf(u,t,'vpCW')) k*=1-P['dl.cw'];
      if(P['pp.k']&&A.winOn(T,'vpPP')) k*=1-P['pp.k'];
      return Math.max(ALLY_FLOOR,k); },
    teamIn(A,T,u,c){ const P=T.P, o=S(T), t=c.tgt, s=c.src; if(!t||!s) return;
      if(t.team===u.team&&t!==u&&!t._summon&&s.team!==u.team){ if(!T.s.api) T.s.api=A; c.amt*=T.fn.allyK(A,T,u,t,s); return; }
      if(t.team!==u.team&&s.team===u.team&&s!==u){ let k=T.fn.teamK(A,T,u,t,s);
        if(P['dl.ll']&&A.winOn(T,'vpLL')) k*=1+P['dl.ll'];
        if(P['fc.il']&&!c.auto&&A.winOn(T,'vpFC')) k*=1+P['fc.il'];
        c.amt*=k;
        if(o.fy&&o.fy.on&&s===o.fy.by&&!c.auto) o.fy.sum+=c.amt||0; } },
    teamDot(A,T,u,c){ const t=c.tgt, s=c.dot&&c.dot.src; if(!t||t.team!==u.team||t===u||t._summon||!s||s.team===u.team) return; c.amt*=T.fn.allyK(A,T,u,t,s); },
    /* ---- AN ALLY'S ULTIMATE (teamCast, at its release): a Fair Copy - Scriptorium three times as fast for the rest of the team for 0.8 s x rank (Copy Desk longer;
       The Fourth Year's flagged one twice as long, at least 2.4 s), Shared Desk, Head Copyist, Long Shift; Gilt Edge counts every ultimate of her side ---- */
    teamCast(A,T,u,c){ const o=S(T), P=T.P, x=c.src; if(!x||c.slot!=='ult'||x.team!==u.team) return; o.ult++; if(x===u||x._summon) return;
      let d=P['fc.dur']||0; const fy=P['sig.fy']&&o.fyN; if(fy){ o.fyN=0; d=Math.max(2.4,2*d); o.fy={on:true,by:x,sum:0,left:2}; }
      if(d>0){ A.acts(T,u,[{window:'vpFC',dur:d}],c); o.fcBy=x; }
      o.fcN++;
      if(P['fc.sd']) for(const a of mates(A,u)){ if(a.greenCd>0) a.greenCd=Math.max(0,a.greenCd-1); if(a.blueCd>0) a.blueCd=Math.max(0,a.blueCd-1); }
      if(P['fc.hc']) u.energy=Math.min(100,(u.energy||0)+P['fc.hc']); },
    /* ---- PROOFREAD: a control through the game's ccApply on a Proofread ally lasts 5% x rank shorter (the control that has just set it, Askel's calm) ---- */
    prCc(A,T,u,c){ const o=S(T), P=T.P, x=c.unit, f=c.field; if(!x||!f||!(c.amt>0)||x.team!==u.team||x===u||!o.pr[x.uid]||!P['pr.k']) return; if(Math.abs((x[f]||0)-c.amt)<1e-9) x[f]=c.amt*Math.max(0,1-P['pr.k']); },
    /* ---- THE DEADLINE: the ally (not her) with the least ultimate energy (Rush Order: an ally under 8% x rank HP first) gains 4 x rank (Overtime: +1 x rank at half full or
       more); Carried Over, Night Shift, Late Lamp, All Hands, Collected Works ---- */
    deadline(A,T,u){ const o=S(T), P=T.P, L=mates(A,u); o.dlN=(o.dlN||0)+1; if(P['dl.ll']) A.acts(T,u,[{window:'vpLL',dur:4}],{u}); if(!L.length) return;
      let b=null; if(P['dl.ro']){ for(const a of L){ const f=a.hp/Math.max(1,a.maxHp); if(f<P['dl.ro']&&(!b||f<b.hp/Math.max(1,b.maxHp))) b=a; } }
      if(!b) for(const a of L) if(!b||(a.energy||0)<(b.energy||0)) b=a;
      let g=P['dl.k']||0; if(P['dl.ot']&&(b.energy||0)>=50) g+=P['dl.ot'];
      const room=Math.max(0,100-(b.energy||0)), got=Math.min(g,room); b.energy=Math.min(100,(b.energy||0)+g); const over=g-got;
      if(P['dl.co']&&over>0){ let n=null; for(const a of L) if(a!==b&&(!n||(a.energy||0)<(n.energy||0))) n=a; if(n) n.energy=Math.min(100,(n.energy||0)+Math.min(10,over*P['dl.co'])); }
      if(P['dl.ns']) for(const a of L) if(a!==b) a.energy=Math.min(100,(a.energy||0)+P['dl.ns']);
      if(T.r.sc_9_1) A.setMark(T,u,b,'vpAH',{dur:5});
      if(P['dl.cw']) A.setMark(T,u,b,'vpCW',{dur:4}); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/61 - VESPER - talent decisions.md) */
  ruling:{}
};
