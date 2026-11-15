/* NERISSE BELLGLASS - what her learned talents do in a fight (the mechanics; her plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Nerisse Bellglass")
   Her real kit (the code, not the tooltip wording; a back-row Support, her skills read ability power, her basic attacks are PHYSICAL):
   - Resonant Star ('silencestrike', green, cd 7, delivered as a shot): 135% of her ability power (magic) on her target and a silence of 2.1 s (the table's
     single 3.0 s x the 30% cut; the kit's 2.4 is not used), through ccApply (a level-gap roll). MEASURED: 148 casts in 20 seeded fights, 148 silences landed, 27 cut
     a cast short.
   - Drifting Constellation ('orbheal', blue, cd 9): an orb visits every living ally once, NEAREST FIRST from where it is - so its first hop is always Nerisse
     herself - healing each on arrival 38% of her ability power x skill level (healFrom) and pushing a heal over time of 2.2% of their max HP a second for 4 s.
     Its hops run in the ground-hazard pass (orbNextHop), 0.18 to 0.6 s each. MEASURED: 124 casts, 4.77 hops a cast, first hop on herself 124 times.
   - Choir of the Deep Sky (ultimate 'deepchoir', ULT_DEF dur 5, radius 8 m, silence 5, tick 1, choirHeal 0.30; HERO_ULT_ART deliver 'form' 0.4 s): a channelled
     circle on her target (centre to centre) that ends at once if she is stunned, feared, silenced or killed. Each second every enemy inside is silenced 1.05 s
     (the table's area 1.5 s x the cut, written straight on) and heals the ally nearest it for 30% x skill level of THAT ENEMY'S ability power (healUnit, no caster):
     an enemy with no ability power heals nothing. MEASURED: 88 casts, 18 broken early, 1305 heals of which 374 were zero.
   - Pelagic Insight (passive 'pelagic', from 3 stars): each Green or Blue press (castKit) puts 8% x the passive's level multiplier (17.5% at level 100) into her
     glyphDR for 5 s. MEASURED: up 78.9% of her time alive.
   Phosphor, Wake, Pressure, Heard, Brace, Echo, Toll, Drowned and the Current exist only through her talents.
   Readings, caps and corrected tooltips: WIRING/42 - NERISSE BELLGLASS - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const RS='silencestrike', ORB='orbheal', CH='deepchoir';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const PH=['ds_1_2','ds_2_2','ds_3_1','ds_3_2','ds_6_3','ds_8_1','ds_9_1','ds_6_4','ds_12_1','ds_10_2','ds_11_1','ds_11_3','ds_12_2','ds_12_3','ds_13_3'];   // Phosphor
const WK=['ds_2_3','ds_4_3','ds_7_1','ds_7_3','ds_9_3','ds_11_4','ds_11_3','ds_13_3'];                                                                     // Wake
const PRS=['ds_4_4','ds_5_4','ds_8_4','ds_10_4','ds_12_4','ds_13_3'];                                                                                      // Pressure
const HD=['wh_1_1','wh_2_1','wh_3_1','wh_4_1','wh_n1','wh_6_4','wh_6_1','wh_7_2','wh_8_1','wh_9_2','wh_9_1','wh_10_1','wh_11_2','wh_12_1','wh_12_3','wh_13_2'];   // Heard
const BR=['wh_2_2','wh_4_2','wh_3_4','wh_5_2','wh_5_3','wh_6_2','wh_6_3','wh_12_4','wh_13_2'];                                                            // Brace
const EC=['wh_4_4','wh_5_4','wh_7_4','wh_8_4','wh_10_4','wh_13_2'];                                                                                       // Echo
const TLR=['sb_1_3','sb_2_3','sb_3_3','sb_6_1','sb_7_2','sb_9_2','sb_10_3','sb_11_2','sb_13_2'];                                                         // Toll (the bell rings when one of these is learned)
const TL=TLR.concat(['wh_n1']);
const DW=['sb_2_2','sb_4_2','sb_8_4','sb_9_4','sb_3_1','sb_12_3','sb_11_2','sb_13_2'];                                                                    // Drowned
const CUR=['sb_4_1','sb_5_1','sb_8_1','sb_10_1','sb_11_1','sb_12_1','sb_13_2'];                                                                           // the Current
const ORBR=['ds_5_1','ds_5_3','wh_7_2','ds_1_1','ds_6_1','ds_6_3'];                                                                                       // rows on where the orb goes next
const HEALS=['ds_2_4','sb_9_1','ds_9_4','ds_7_1','wh_3_4','ds_5_3','ds_6_1','wh_7_2','wh_9_2','ds_3_4'];                                                  // her skill heals (the orb's hop and its heal over time)
const SIL=['wh_2_3','wh_3_1','sb_5_4','sb_8_3','sb_11_4','sb_5_2','sb_3_3','wh_n1','wh_4_4','wh_5_4','wh_7_4','wh_8_4','wh_10_4','wh_13_2'].concat(DW);      // rows on her silences landing
const CHR=['wh_11_2','sb_11_4','wh_12_2','sb_12_2','ds_11_3','ds_7_1','wh_3_4','wh_10_4','sb_11_2','sb_13_2','ds_13_3','wh_13_2'].concat(CUR,EC,DW);     // rows on her Choir
/* her damage reduction (one capped group on HER: 35%, her Pelagic Insight is already 17.5% at level 100) and the reductions her talents give her allies (one
   capped group on each ally: 25%) */
const DRME=['ds_1_1','ds_8_2','sb_7_1','sb_3_1','wh_7_4','wh_6_2','wh_10_3','ds_11_1','wh_2_2','wh_9_3','sb_7_2'];
const DRT=['ds_2_3','ds_12_2','ds_8_4','ds_11_4','wh_1_1','wh_4_1','wh_9_1','wh_n1','wh_12_1','ds_7_3','sb_7_2','sb_9_2','wh_13_2'];
const TOUT=['wh_6_1','sb_6_3','sb_2_2','sb_12_3'];                                                                                                           // bonuses on her team's hits (Forewarned, Ringing Ears, Drowned)
const TIN=DRT.concat(['ds_10_4','ds_11_4','wh_5_3'],HD,TOUT);
const MCAP=0.65, TCAP=0.75, SIG_ME=0.50, SIG_ALLY=0.70, CC_TALENT_CAP=4.0, HEAL_RATE=0.012, PH_MAX=4;
const S=T=>T.s.nr||(T.s.nr={});                                     // her own per-fight state (one object: no name of the runtime's own is ever used)
const rk=(T,id)=>T.r[id]||0;
const mate=(u,x)=>!!x&&x.alive&&x.team===u.team&&!x._summon;       // a hero of her team (Nerisse included), not a summon
const foe=(u,x)=>!!x&&x.team!==u.team;
const team=(A,u)=>A.eng().units().filter(x=>mate(u,x)&&!x._dropHidden);
const foes=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
const piUp=u=>(u._piT||0)>0&&(u._piAdd||0)>0;                       // her Pelagic Insight is up (the game's own timer and share)
const sung=u=>u.alive&&!((u.stunned||0)>0)&&!((u.fearT||0)>0)&&!((u.silencedT||0)>0);   // she can hold a channel (what keeps the Choir up)
module.exports={
  hero:'nerisse',
  casting:true,                         // rows ask which of her skills a hit / a heal comes from
  points:true,                          // rows read where her Choir rises (the at hook)
  states:{
    br:{max:P('br.max',4),dur:P('br.dur',6)},                       // Brace (all of it lapses 6 s after the last gain)
    ec:{max:3,wave:'reset'},                                        // Echo (kept for the wave)
    tl:{max:P('tl.max',5),wave:'reset'},                            // Toll (kept for the wave)
    ph:{unit:true,max:PH_MAX,dur:P('ph.dur',8)},                    // Phosphor on the heroes of her team
    ac:{unit:true,max:3,dur:3}                                      // Abyssal Calm on enemies
  },
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                       // Pressure, the Current, Heard, Drowned, per-second heals, signatures
    {on:'wave',do:[{fn:'wv'}]},
    {on:'cd',reqAny:BR.concat(['wh_13_2']),do:[{fn:'brace'}]},                                                     // each Green / Blue press: a Brace
    {on:'skillTgt',skill:'orbHop',reqAny:ORBR,do:[{fn:'orbTgt'}]},                                                 // where the orb goes next
    {on:'num',skill:'orbDur',reqAny:['ds_4_1'],do:[{fn:'orbDur'}]},
    {on:'cast',skill:ORB,reqAny:ORBR.concat(['ds_1_1']),do:[{fn:'orbCast'}]},
    {on:'partPre',skill:'orbHop',do:[{fn:'hopPre'}]}, {on:'part',skill:'orbHop',do:[{fn:'hop'}]},                     // each hop: Phosphor, Wake, energy, its heal over time
    {on:'healOut',reqAny:HEALS,do:[{fn:'hOut'}]},
    {on:'kit',skill:CH,reqAny:CHR,do:[{fn:'chKit'}]}, {on:'at',skill:CH,do:[{fn:'chAt'}]},
    {on:'num',skill:'choirSil',reqAny:CHR,do:[{fn:'chSil'}]}, {on:'num',skill:'choirHeal',reqAny:CHR.concat(PH,WK,['wh_3_4']),do:[{fn:'chHeal'}]},
    {on:'skillTgt',skill:RS,reqAny:['wh_3_1'],do:[{fn:'rsTgt'}]},
    {on:'ccHit',reqAny:SIL,do:[{fn:'ccH'}]}, {on:'cast',skill:RS,reqAny:TL.concat(['sb_3_3']),do:[{fn:'rsCast'}]},
    {on:'teamIn',reqAny:TIN,do:[{fn:'tIn'}]},                                                                       // hits on her team, and her team's hits on enemies
    {on:'in',reqAny:TIN.concat(DRME,['wh_5_3']),do:[{fn:'myIn'}]},
    {on:'out',reqAny:TOUT,if:{targetTeam:'enemy'},do:[{fn:'myOut'}]},
    {on:'teamHeal',reqAny:['ds_8_1','sb_11_1'],do:[{fn:'tHeal'}]}, {on:'healMe',reqAny:['ds_8_1','sb_11_1'],do:[{fn:'tHeal'}]},
    {on:'ccIn',reqAny:['wh_1_4','wh_5_2'],do:[{fn:'ten'}]},
    {on:'teamNrg',reqAny:['sb_9_4'],do:[{fn:'noAirHit'}]},
    {on:'death',reqAny:['sb_10_3'],do:[{fn:'fallen'}]},
    {stat:{apow:1},reqAny:['wh_4_4','sb_1_3','sb_6_1','sb_10_3'],per:{fn:'apN'}},                                   // Echo, Toll, Toll for the Fallen: her ability power
    {stat:{armor:1},to:{team:'ally'},reqAny:PRS,per:{fn:'prA'}}, {stat:{mr:1},to:{team:'ally'},reqAny:PRS,per:{fn:'prM'}},   // Pressure
    {stat:{aspd:1},to:{team:'ally'},reqAny:['sb_4_1','sb_12_1','sb_13_2'],per:{fn:'curAs'}}, {stat:{move:1},to:{team:'ally'},reqAny:['sb_8_1'],per:{fn:'curMv'}}   // the Current
  ],
  talents:{
    /* ============================== THE DRIFTING STAR ============================== */
    ds_1_1:[ {param:'dr.sw',add:R(0.02)} ],                                                                         // Still Water (her group, while an orb of hers flies)
    ds_1_2:[ {param:'ph.k',add:R(0.001)} ],                                                                         // Blue Glow (Phosphor: hop; its heal each second: sec, within 1.2% a second)
    ds_2_4:[ {param:'orb.h',add:R(0.03)} ],                                                                         // Soft Current (hOut)
    ds_2_2:[ {param:'ph.dur',add:R(1.5)} ],                                                                         // Long Glow
    ds_2_3:[ {param:'wk.k',add:R(0.01)} ],                                                                          // In Its Wake (the Wake: hop; both groups)
    ds_3_1:[ {param:'ph.sh',add:R(0.006)} ],                                                                        // Trench Born (phAdd)
    ds_3_2:[ {param:'bloom',add:1} ],                                                                               // Bright Bloom (phAdd)
    ds_4_3:[ {param:'wk.dur',add:R(0.5)} ],                                                                         // Long Wake
    ds_3_4:[ {param:'orb.hot',add:R(0.2)} ],                                                                        // Patient Glow (hop: its heal over time, a part tick at the end)
    ds_4_1:[ {param:'orb.spd',add:R(0.05)} ],                                                                       // Quick Orb (orbDur)
    ds_5_1:[ {param:'ret',add:1} ],                                                                                 // Returning Star (PICK ONE: orbTgt)
    ds_5_3:[ {param:'wand',add:1} ],                                                                                // Wandering Star (PICK ONE: orbTgt, hOut)
    ds_4_4:[ {param:'pr.k',add:R(0.004)} ],                                                                         // Weight of Water (Pressure: tk, prA / prM)
    ds_6_2:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                                 // Slow Tide
    ds_6_1:[ {param:'ret.h',add:R(0.08)} ],                                                                         // Homeward (needs Returning Star; hOut)
    ds_6_3:[ {param:'wand.ph',add:R(1)} ],                                                                          // Long Drift (needs Wandering Star; hop)
    ds_5_4:[ {param:'pr.max',add:R(1)} ],                                                                           // Crushing Depth
    ds_7_1:[ {param:'hl.wk',add:R(0.02)} ],                                                                         // Gentle Hands (herK: her heals on a Wake ally)
    ds_8_1:[ {param:'ph.hr',add:R(0.02)} ],                                                                         // Glow Rich (tHeal)
    ds_6_4:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.03)}, {param:'ph.ts',add:R(0.06)} ],                            // Thin Shell (RISK)
    ds_8_2:[ {param:'dr.cc',add:R(0.01)} ],                                                                         // Cold Calm (her group)
    ds_9_1:[ {param:'lf',add:1} ],                                                                                  // Lanternfish (tk)
    ds_7_3:[ {param:'woi',add:1} ],                                                                                 // Wake of Insight (teamF)
    ds_10_3:[ {param:'orb.nrg',add:R(1)} ],                                                                         // Drifting Spark (was Starfall; hop)
    ds_9_3:[ {param:'woi.k',add:R(0.004)} ],                                                                        // Insight Shared (needs Wake of Insight; points)
    ds_8_4:[ {param:'ew',add:R(0.04)} ],                                                                            // Equal Weight (teamF)
    ds_9_4:[ {param:'orb.low',add:R(0.02)} ],                                                                       // Tidal Mending (hOut)
    ds_12_1:[ {param:'bd',add:R(1)} ],                                                                              // Bright Deep (phAdd)
    ds_10_2:[ {param:'ph.fl',add:R(0.03)} ],                                                                        // Floodlight (sec)
    ds_10_4:[ {param:'hdn',add:R(0.03)} ],                                                                          // Held Down (tIn / myIn)
    ds_11_1:[ {param:'dr.qt',add:R(0.015)} ],                                                                       // Quiet Trench (her group)
    ds_11_3:[ {param:'sky',add:1} ],                                                                                // Sky Full of Stars (chHeal)
    ds_11_4:[ {param:'ac.k',add:R(0.01)} ],                                                                         // Abyssal Calm (tIn / myIn; teamF)
    ds_12_2:[ {param:'ph.dr',add:R(0.005)} ],                                                                       // Heavy Glow (teamF)
    ds_12_3:[ {param:'sky.dur',add:R(1)} ],                                                                         // Choir Glow (needs Sky Full of Stars)
    ds_12_4:[ {param:'pr.k2',add:R(0.002)} ],                                                                       // Deep Weight (points of armor a Pressure)
    ds_13_3:[ {param:'elt',add:1} ],                                                                                // Every Light in the Trench (SIGNATURE: chEnd)

    /* ============================== WHAT THE DEEP HEARS ============================== */
    wh_1_1:[ {param:'hd.k',add:R(0.015)} ],                                                                         // Listening (Heard: tk / hear; its next skill: teamF)
    wh_1_3:[ {on:'out',if:{casting:RS,targetTeam:'enemy'},more:R(0.03)} ],                                          // Clean Note
    wh_1_4:[ {param:'ten.qm',add:R(0.05)} ],                                                                        // Quiet Mind (ten: at most 15%)
    wh_2_1:[ {param:'hd.p',add:R(-0.4)} ],                                                                          // Sharp Ears
    wh_2_2:[ {param:'br.pi',add:R(0.005)} ],                                                                        // Bracing (Pelagic Insight stronger per Brace: piK)
    wh_3_1:[ {param:'tuned',add:1} ],                                                                               // Tuned to Their Voice (rsTgt, ccH)
    wh_4_2:[ {param:'br.dur',add:R(1)} ],                                                                           // Long Brace
    wh_2_3:[ {param:'rs.sil',add:R(0.1)} ],                                                                         // True Pitch (ccH)
    wh_3_4:[ {param:'br.hl',add:R(0.004)} ],                                                                        // Low Hum (herK)
    wh_4_1:[ {param:'hd.bb',add:R(0.01)} ],                                                                         // Breath Before (teamF)
    wh_n1:[  {param:'drb',add:1} ],                                                                                 // The Deep Rings Back (LINK: with First Toll a second Toll; ccH / rsCast)
    wh_6_4:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.03)}, {param:'hd.p',add:R(-0.5)} ],                             // Open Ears (RISK)
    wh_4_4:[ {param:'ec.ap',add:R(0.02)} ],                                                                         // Cancelled Note (Echo: echo; apN)
    wh_5_1:[ {param:'pi.dur',add:R(0.2)} ],                                                                         // Hunter's Breath (tk)
    wh_5_4:[ {param:'ec.hl',add:R(0.01)} ],                                                                         // Ringing Back (needs Cancelled Note; echo)
    wh_6_1:[ {param:'hd.fw',add:R(0.01)} ],                                                                         // Forewarned (outK)
    wh_7_1:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.02)} ],                                       // Deep Pulse
    wh_7_2:[ {param:'wl',add:1} ],                                                                                  // Warning Light (orbTgt, hOut)
    wh_7_4:[ {param:'dr.ec',add:R(0.005)} ],                                                                        // Echo Chamber (her group)
    wh_8_1:[ {param:'hd.kh',add:R(1)} ],                                                                            // Known Hunter (hdPress)
    wh_9_2:[ {param:'wl.k',add:R(0.02)} ],                                                                          // Forewarned Friends (needs Warning Light)
    wh_5_2:[ {param:'sf',add:1} ],                                                                                  // Stand Fast (PICK ONE: ten, tk)
    wh_5_3:[ {param:'sa',add:1} ],                                                                                  // Slip Away (PICK ONE: myIn)
    wh_9_1:[ {param:'hd.bil',add:0.15} ],                                                                           // Before It Lands (teamF)
    wh_9_3:[ {param:'pi.pt',add:R(0.004)} ],                                                                        // Hollow Shell (points: piK)
    wh_6_2:[ {param:'dr.rf',add:R(0.02)} ],                                                                         // Rooted Feet (needs Stand Fast; her group)
    wh_6_3:[ {param:'sa.nrg',add:R(3)} ],                                                                           // Gone Already (needs Slip Away)
    wh_10_1:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'nr_hd'}} ],                                               // Long Listening
    wh_8_4:[ {param:'ec.cd',add:R(0.5)} ],                                                                          // Answering Note (echo)
    wh_10_3:[ {param:'dr.sf',add:R(0.01)} ],                                                                        // Sound Footing (her group)
    wh_10_4:[ {param:'ec.ch',add:R(0.2)} ],                                                                         // Spent Echo (chKit)
    wh_11_1:[ {on:'cd',skill:'green',less:R(0.01)}, {on:'cd',skill:'blue',less:R(0.01)}, {stat:{nrg:R(0.01)}} ],     // Patience Below (her ultimate: energy that much faster)
    wh_11_2:[ {param:'cow',add:1} ],                                                                                // Choir of Warnings (chSil)
    wh_12_1:[ {param:'hd.near',add:R(0.01)} ],                                                                      // She Lets Them Say It (teamF)
    wh_12_2:[ {param:'ch.h',add:R(0.03)} ],                                                                         // Choir of the Deep (chHeal)
    wh_12_3:[ {on:'out',if:{casting:RS,targetTeam:'enemy',targetHas:'nr_hd'},more:R(0.03)} ],                      // Tuning Fork
    wh_12_4:[ {param:'br.max',add:R(1)} ],                                                                          // Brace Again
    wh_13_2:[ {param:'abb',add:1} ],                                                                                // A Breath Before (SIGNATURE: chEnd, teamF, hdScan)

    /* ============================== THE SHIP'S BELL ============================== */
    sb_1_1:[ {on:'out',if:{casting:RS,targetTeam:'enemy'},more:R(0.03)} ],                                          // Bright Fork
    sb_1_4:[ {param:'rng',add:R(0.03)} ],                                                                           // Long Reach (tk)
    sb_1_3:[ {param:'tl.ap',add:R(0.005)} ],                                                                        // First Toll (rsCast; apN)
    sb_2_2:[ {param:'dw.k',add:R(0.02)} ],                                                                          // Under the Surface (Drowned: tk; outK)
    sb_2_3:[ {param:'tl.max',add:R(1)} ],                                                                           // Heavy Bell
    sb_3_1:[ {param:'dr.hw',add:R(0.015)} ],                                                                        // Hard Water (her group)
    sb_3_3:[ {param:'storm',add:1} ],                                                                               // Storm Bell (rsCast)
    sb_3_4:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.02)} ],                                        // Deep Voice
    sb_4_1:[ {param:'cur.as',add:R(0.015)} ],                                                                       // The Current (tk, curAs)
    sb_4_2:[ {param:'dw.in',add:R(-0.3)} ],                                                                         // Sinking Fast
    sb_4_4:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                                 // Ringing Fork
    sb_5_1:[ {param:'cur.slow',add:R(0.04)} ],                                                                      // Slack Water (was Undertow; tk)
    sb_5_2:[ {param:'fp',add:1} ],                                                                                  // Full Peal (PICK ONE: ccH)
    sb_6_3:[ {param:'sil.re',add:R(0.01)} ],                                                                        // Ringing Ears (outK)
    sb_5_4:[ {param:'ocn',add:1} ],                                                                                 // One Clear Note (PICK ONE: ccH)
    sb_6_1:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.02)}, {param:'tl.ap',add:R(0.003)} ],                           // Cracked Bell (RISK)
    sb_6_2:[ {param:'fp.k',add:R(0.1)} ],                                                                           // Wide Peal (needs Full Peal)
    sb_6_4:[ {on:'out',if:{casting:RS,targetTeam:'enemy'},more:R(0.05)} ],                                          // Pure Tone (needs One Clear Note)
    sb_7_1:[ {param:'dr.ss',add:R(0.01)} ],                                                                         // Salt Skin (her group)
    sb_7_2:[ {param:'iob',add:1} ],                                                                                 // Insight of the Bell (piK, teamF)
    sb_7_4:[ {on:'out',if:{auto:true,targetTeam:'enemy',fn:'silTgt'},more:R(0.03)} ],                               // Trench Hunter
    sb_8_1:[ {param:'cur.mv',add:R(0.05)} ],                                                                        // Swift Current (curMv)
    sb_8_3:[ {param:'rs.sil',add:R(0.08)} ],                                                                        // Echoing Steel (ccH)
    sb_8_4:[ {param:'dw.dur',add:R(0.5)} ],                                                                         // Heavy Water
    sb_9_2:[ {param:'iob.k',add:R(0.005)} ],                                                                        // Ringing Insight (needs Insight of the Bell)
    sb_9_1:[ {param:'orb.h',add:R(0.02)} ],                                                                         // Deep Mending (hOut)
    sb_9_4:[ {param:'noair',add:1} ],                                                                               // No Air (noAirHit, tk)
    sb_10_1:[ {param:'cur.hl',add:R(0.003)} ],                                                                      // Undercurrent (sec, within 1.2% a second)
    sb_10_3:[ {param:'tff',add:R(0.01)} ],                                                                          // Toll for the Fallen (fallen)
    sb_11_1:[ {param:'cur.hr',add:R(0.02)} ],                                                                       // Undertone (tHeal)
    sb_11_2:[ {param:'rtb',add:1} ],                                                                                // Ring the Bell (chKit, chAt)
    sb_11_4:[ {param:'sil.k',add:R(0.02)} ],                                                                        // Long Silence (ccH, chSil)
    sb_12_1:[ {param:'cur.as2',add:R(0.01)} ],                                                                      // Strong Current (points)
    sb_12_2:[ {param:'ch.h',add:R(0.03)} ],                                                                         // Whole Deep at Once (chHeal)
    sb_12_3:[ {param:'dw.all',add:R(0.006)} ],                                                                      // Drowning Weight (outK)
    sb_10_2:[ {on:'kit',skill:CH,opt:{radius:{addM:R(0.3)}}} ],                                                     // Pressure Wave
    sb_13_2:[ {param:'whsb',add:1} ]                                                                                // When Her Side Breaks (SIGNATURE: tk)
  },
  needs:{ ds_6_1:'ds_5_1', ds_6_3:'ds_5_3', ds_9_3:'ds_7_3', ds_12_3:'ds_11_3', wh_9_2:'wh_7_2', wh_6_2:'wh_5_2', wh_6_3:'wh_5_3', sb_6_2:'sb_5_2', sb_6_4:'sb_5_4', sb_9_2:'sb_7_2', wh_5_4:'wh_4_4' },
  fn:{
    /* ---- EACH TICK ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), r=T.r, P=T.P, now=E.now(), dt=c.dt||0;
      if(o.f==null) o.f={pr:PRS.some(id=>r[id]), cur:CUR.some(id=>r[id]), hd:HD.some(id=>r[id]), dw:DW.some(id=>r[id]), ph:PH.some(id=>r[id]), sec:!!(P['ph.k']||P['cur.hl'])};
      const f=o.f;
      if(P.rng){ if(o.rg0==null) o.rg0=u.range; u.range=o.rg0*(1+P.rng); }                                        // Long Reach
      if(P['pi.dur']){ const t=u._piT||0; if(t>(o.piT0||0)+1e-9&&t>=4.9) u._piT=t+P['pi.dur']; o.piT0=u._piT||0; }   // Hunter's Breath: a fresh Pelagic Insight (the passive just wrote 5 s) lasts longer
      if(o.saCd>0) o.saCd-=dt; if(o.whCd>0) o.whCd-=dt;
      if(P.sf) T.fn.sfTick(A,T,u);
      if(f.pr) T.fn.prTick(A,T,u,dt);
      if(o.chL&&o.chL.length) T.fn.chTick(A,T,u,c);
      if(f.hd||P.abb) T.fn.hdTick(A,T,u,dt);
      if(f.dw) T.fn.dwTick(A,T,u,dt);
      if(f.sec){ o.secA=(o.secA||0)+dt; if(o.secA>=1-1e-9){ o.secA-=1; T.fn.sec(A,T,u); } }
      if(P.lf) T.fn.lfTick(A,T,u,dt);
      if(P.whsb) T.fn.whTick(A,T,u); },
    wv(A,T,u){ const o=S(T); o.orbL=[]; o.chL=[]; o.cur={}; o.pr={}; o.prF={}; o.dwA={}; o.hdA=0; o.secA=0; o.lfW={}; o.whW={}; o.hc={}; o.pd={}; o.freeP=false;
      if(HD.some(id=>T.r[id])) T.fn.hear(A,T,u); },
    /* ---- BRACE: each Green or Blue press (the cd hook: her cooldown has just been set) ---- */
    brace(A,T,u,c){ A.acts(T,u,[{stack:'br',add:1}],c); },
    /* ---- HER HEALS: (1 + Gentle Hands on a Wake ally) x (1 + Low Hum per Brace) - for her skills' heals and her talents' own ---- */
    herK(A,T,u,x){ const P=T.P; let k=1; if(P['hl.wk']&&A.markOf(u,x,'nr_wk')) k*=1+P['hl.wk']; if(P['br.hl']) k*=1+P['br.hl']*A.stGet(T,'br'); return k; },
    lheal(A,T,u,x,amt){ if(!x||!x.alive||!(amt>0)) return; A.eng().healUnit(x,amt*T.fn.herK(A,T,u,x)); },
    /* ---- DRIFTING CONSTELLATION: where the orb goes (Warning Light first, then the game's nearest; Wandering Star a second round; Returning Star once more) ---- */
    /* c.tgt: the game's own pick (the nearest ally the orb has not yet visited), null when every ally has had its hop; c.o: the orb itself */
    orbTgt(A,T,u,c){ const o=S(T), P=T.P, h=c.o; if(!h||!h.orb) return; const L=o.orbL||(o.orbL=[]); if(L.indexOf(h)<0) L.push(h);
      const n=h._talN||0; let t=c.tgt||null;
      if(n===0&&P.wl){ const e=o.lastHd, w=(e&&e.alive&&A.markOf(u,e,'nr_hd'))?e.target:null; if(w&&w.alive&&w.team===u.team&&h.left.indexOf(w)>=0){ t=w; h._talWL=w; } }   // Warning Light: first to the ally the Heard enemy is after
      if(!t&&P.wand&&!h._talW2){ h._talW2=1; h.left=team(A,u); }                                                    // Wandering Star: a second round, every ally again
      if(h._talW2&&h.left.length&&(!t||t===h.tgt)){ const prev=h.tgt; let b=null,bd=1e9;                            // (not straight back onto the ally it stands on, unless it is the last one)
        for(const a of h.left){ if(!a.alive||(a===prev&&h.left.some(y=>y!==prev&&y.alive))) continue; const d=Math.hypot(a.x-h.x,a.y-h.y); if(d<bd){ bd=d; b=a; } } if(b) t=b; }
      if(!t&&P.ret&&!h._talRet){ h._talRet=1; const x=A.eng().lowestAlly(u); if(x&&x.alive){ t=x; h._talRH=1; } }   // Returning Star: once more, to the lowest HP share
      c.tgt=t; if(t){ h._talN=n+1; const V=h._talV||(h._talV={}); V[t.uid]=(V[t.uid]||0)+1; } },
    orbDur(A,T,u,c){ c.amt=c.amt/(1+(T.P['orb.spd']||0)); },
    orbCast(A,T,u){ const o=S(T); o.orbL=(o.orbL||[]).filter(h=>!h.done); },
    orbFly(A,T){ const L=S(T).orbL; if(!L) return false; for(let i=0;i<L.length;i++) if(!L[i].done) return true; return false; },
    hopPre(A,T,u,c){ const o=S(T), x=c.tgt, L=o.orbL||[]; let h=null; for(const q of L) if(q.tgt===x&&!q.done) h=q; o.hp={x,h,n:(x&&x.hots)?x.hots.length:0}; },
    hop(A,T,u,c){ const o=S(T), P=T.P, x=c.tgt, k=o.hp||{}; o.hp=null; if(!x||!x.alive) return; const h=k.h;
      if(k.n!=null&&x.hots&&x.hots.length>k.n&&HEALS.some(id=>T.r[id])){ const H=x.hots[k.n]; if(H&&!H._talU){ H._talU=u; H._talK='orbHot';                // its heal over time is hers (her heal rows), Patient Glow longer (a part tick at the end)
          if(P['orb.hot']){ const d=(H.remaining*(H.interval||1))+P['orb.hot']; H.remaining=Math.ceil(d-1e-9); const fr=d-(H.remaining-1); H._talF=fr<1-1e-9?fr:null; } } }
      const second=!!(h&&h._talV&&h._talV[x.uid]>1);
      if(PH.some(id=>T.r[id])) T.fn.phAdd(A,T,u,x,1+(second?(P['wand.ph']||0):0),null);
      if(WK.some(id=>T.r[id])) T.fn.wake(A,T,u,x,3+(P['wk.dur']||0));
      if(P['orb.nrg']) x.energy=Math.min(100,(x.energy||0)+P['orb.nrg']); },
    hOut(A,T,u,c){ const o=S(T), P=T.P, x=c.tgt; if(!x) return; const hop=c.skill==='orbHop', hot=c.skill==='orbHot'; if(!hop&&!hot) return;
      let k=T.fn.herK(A,T,u,x)*(1+(P['orb.h']||0)); if(P['orb.low']&&x.hp<0.5*x.maxHp) k*=1+P['orb.low'];
      if(P.wand) k*=0.65;
      if(hop){ const h=(o.hp||{}).h; if(h){ if(P['ret.h']&&h._talRH&&h.tgt===x) k*=1+P['ret.h']; if(P.wl&&h._talWL===x&&h._talN===1) k*=1.30+(P['wl.k']||0); } }   // Homeward: the return hop; Warning Light: its first hop
      c.amt*=k; },
    /* ---- PHOSPHOR: a unit stack on the heroes of her team (max 4, each gain refreshes all of it; Long Glow longer) ---- */
    phAdd(A,T,u,x,n,dur){ const P=T.P; if(!mate(u,x)||!(n>0)) return; const was=A.ustGet(T,u,x,'ph'), d=dur!=null?dur:8+(P['ph.dur']||0); let spare=0;
      if(was>=PH_MAX&&P.bloom){ A.ustPut(T,u,x,'ph',0); T.fn.lheal(A,T,u,x,0.06*x.maxHp); spare=n; }                  // Bright Bloom: reached at 4, it spends them all for 6% of max HP
      else { const put=Math.min(n,PH_MAX-was); spare=n-put; A.ustPut(T,u,x,'ph',Math.min(PH_MAX,was+put),d); if(was===0&&put>0) T.fn.trench(A,T,u,x); }
      if(spare>0&&P.bd){ let b=null,bn=1e9; for(const y of team(A,u)){ if(y===x) continue; const m=A.ustGet(T,u,y,'ph'); if(m<bn){ bn=m; b=y; } }   // Bright Deep: the spare glow to the ally with the fewest stacks
        if(b&&bn<PH_MAX){ const g=Math.min(spare,P.bd,PH_MAX-bn); A.ustPut(T,u,b,'ph',bn+g,d); if(bn===0) T.fn.trench(A,T,u,b); } } },
    trench(A,T,u,x){ const P=T.P; if(P['ph.sh']) A.acts(T,u,[{shield:{pct:P['ph.sh'],of:'tgtMaxHp'},dur:4,on:'target'}],{u,tgt:x,unit:x}); },
    wake(A,T,u,x,d){ if(mate(u,x)&&d>0) A.setMark(T,u,x,'nr_wk',{dur:d,longest:true}); },
    /* the heals each second: Phosphor (Blue Glow, Floodlight, Thin Shell) and the Current (Undercurrent), together at most 1.2% of max HP a second for each hero */
    sec(A,T,u){ const P=T.P, o=S(T); for(const x of team(A,u)){ let rt=0; const n=A.ustGet(T,u,x,'ph');
        if(n>0&&P['ph.k']) rt+=P['ph.k']*n*(1+(P['ph.fl']||0))*(1+(P['ph.ts']||0));
        if(P['cur.hl']){ const q=(o.cur||{})[x.uid]||0; if(q) rt+=P['cur.hl']*q; }
        if(rt>0) A.eng().healUnit(x,Math.min(HEAL_RATE,rt*T.fn.herK(A,T,u,x))*x.maxHp); } },
    /* Lanternfish: an ally with 4 Phosphor that drops below 30% HP bursts it into 3% of max HP a stack (once every 10 s each) */
    lfTick(A,T,u,dt){ const o=S(T), W=o.lfW||(o.lfW={}); for(const x of team(A,u)){ const e=W[x.uid]||(W[x.uid]={was:false,cd:0}); if(e.cd>0) e.cd-=dt; const low=x.hp<0.3*x.maxHp;
        if(low&&!e.was&&e.cd<=0){ const n=A.ustGet(T,u,x,'ph'); if(n>=PH_MAX){ A.ustPut(T,u,x,'ph',0); T.fn.lheal(A,T,u,x,0.03*n*x.maxHp); e.cd=10; } } e.was=low; } },
    /* ---- PRESSURE: each second within 4 m of her body an ally gains 1 (max 5, Crushing Depth more); it is all lost 2 s after they leave ---- */
    prTick(A,T,u,dt){ const o=S(T), P=T.P, M=o.pr||(o.pr={}), now=A.eng().now(), mx=5+(P['pr.max']||0), lim=4*A.eng().METER();
      for(const x of team(A,u)){ if(x===u) continue; const e=M[x.uid]||(M[x.uid]={n:0,a:0,last:-1e9});
        if(A.gap(u,x)<lim){ e.a+=dt; e.last=now; while(e.a>=1-1e-9){ e.a-=1; if(e.n<mx) e.n++; } }
        else { e.a=0; if(now-e.last>=2-1e-9) e.n=0; } } },
    prN(A,T,u,x){ const o=S(T), P=T.P; if(!x) return 0; const mx=5+(P['pr.max']||0); if(o.prF&&o.prF[x.uid]>A.eng().now()) return mx; const e=o.pr&&o.pr[x.uid]; return e?Math.min(mx,e.n):0; },
    prA(A,T,u,c){ return T.fn.prN(A,T,u,c.tgt)*((T.P['pr.k']||0)+(T.P['pr.k2']||0)); },
    prM(A,T,u,c){ return T.fn.prN(A,T,u,c.tgt)*(T.P['pr.k']||0); },
    /* ---- STAND FAST: at 4 Brace she cannot be stunned (any stun, freeze, root or sleep; a stun written straight on is taken off too) or knocked back ---- */
    sfTick(A,T,u){ const o=S(T), on=A.stGet(T,'br')>=4; if(on){ if(!((u._gearImmovableT||0)>=0.1)) u._gearImmovableT=0.1; if((u.stunned||0)>(o.st0||0)+1e-9) u.stunned=o.st0||0; } o.st0=u.stunned||0; },
    ten(A,T,u,c){ const P=T.P; if(P.sf&&c.field==='stunned'&&A.stGet(T,'br')>=4){ c.amt=0; return; } if(P['ten.qm']) c.amt*=1-Math.min(0.15,P['ten.qm']); },
    /* ---- HEARD: every 4 s (Sharp Ears, Open Ears sooner) the enemy with the most ultimate energy; it stays Heard until it begins its next skill (at most 10 s) ---- */
    hear(A,T,u){ const o=S(T); let b=null,be=-1; for(const x of foes(A,u)){ if(x._noTarget) continue; const e=x.energy||0; if(e>be){ be=e; b=x; } } if(b) T.fn.heard(A,T,u,b,10,true); o.lastHd=b||null; },
    /* Heard for d seconds (a longer Heard already on it stays). Known Hunter counts the times one enemy is heard in a wave: each hearing by the clock, and each new Heard */
    heard(A,T,u,x,d,clock){ const o=S(T), hc=o.hc||(o.hc={}), e=hc[x.uid]; if(clock||!A.markOf(u,x,'nr_hd')){ if(e&&e.w===T.s.wave) e.n++; else hc[x.uid]={w:T.s.wave,n:1}; }
      A.setMark(T,u,x,'nr_hd',{dur:d,longest:true}); },
    hdTick(A,T,u,dt){ const o=S(T), P=T.P; if(HD.some(id=>T.r[id])){ o.hdA=(o.hdA||0)+dt; const p=Math.max(1.5,4+(P['hd.p']||0)); if(o.hdA>=p-1e-9){ o.hdA=0; T.fn.hear(A,T,u); } }
      const pd=o.pd||(o.pd={}), win=A.winOn(T,'nr_abb');
      for(const x of foes(A,u)){ const p=x._pend||null; if(p&&p!==pd[x.uid]){ T.fn.press(A,T,u,x,(p.t||0)+1.5); if(win){ T.fn.echo(A,T,u); A.acts(T,u,[{stack:'br',add:1}],{u}); } } pd[x.uid]=p; } },
    /* an enemy begins a skill: its Heard is spent on that skill (Known Hunter: heard twice this wave, it stays Heard a while longer), The Deep Rings Back's mark too */
    press(A,T,u,x,d){ const o=S(T), P=T.P;
      if(A.markOf(u,x,'nr_hd')){ A.setMark(T,u,x,'nr_hdc',{dur:d}); const e=(o.hc||{})[x.uid]; if(P['hd.kh']&&e&&e.w===T.s.wave&&e.n>=2&&!A.winOn(T,'nr_abb')) A.setMark(T,u,x,'nr_hd',{dur:P['hd.kh']}); else if(!A.winOn(T,'nr_abb')) A.clearMark(u,x,'nr_hd'); }
      if(A.markOf(u,x,'nr_drb')){ A.setMark(T,u,x,'nr_drbc',{dur:d}); A.clearMark(u,x,'nr_drb'); } },
    /* ---- ECHO: an enemy skill her silence cut short (it had a cast under way); max 3, kept for the wave ---- */
    echo(A,T,u){ const P=T.P; if(!(A.stSet(T,u,'ec',A.stGet(T,'ec')+1)>0)) return;                                   // (at most 3: the state's own cap)
      if(P['ec.hl']) A.eng().healUnit(u,P['ec.hl']*u.maxHp*T.fn.herK(A,T,u,u)); if(P['ec.cd']) u.greenCd=Math.max(0,(u.greenCd||0)-P['ec.cd']); },
    apN(A,T){ const P=T.P; return (P['ec.ap']||0)*A.stGet(T,'ec')+(P['tl.ap']||0)*A.stGet(T,'tl')+((P.tff&&A.winOn(T,'nr_tff'))?P.tff:0); },
    /* ---- HER SILENCES THAT LANDED (Resonant Star through ccApply; her talents' own silences) ---- */
    ccH(A,T,u,c){ if(c.field!=='silencedT') return; const o=S(T), P=T.P, t=c.tgt; if(!t||!t.alive) return;
      if(t._pend&&EC.some(id=>T.r[id])) T.fn.echo(A,T,u);                                                          // it was casting: her silence cut that skill short
      if(T.s.cur!==RS||c.talent) return;
      const hd=!!A.markOf(u,t,'nr_hd');
      let d=c.amt*(1+(P['sil.k']||0))+(P['rs.sil']||0)+((P.tuned&&hd)?1:0)+(P.ocn?1:0); d=Math.min(CC_TALENT_CAP,d); if(d>(t.silencedT||0)) t.silencedT=d;   // the real silence (x Long Silence) + the flat adds, at most 4.0 s
      o.rsT=t; o.rsSil=Math.max(t.silencedT||0,d);
      if(P.drb&&hd){ A.setMark(T,u,t,'nr_drb',{dur:20}); if(rk(T,'sb_1_3')) o.drbT=1; }
      if(P.fp){ let b=null,bd=1e9; for(const x of foes(A,u)){ if(x===t||x._noTarget) continue; const g=A.gap(t,x); if(g<bd){ bd=g; b=x; } } if(b) A.control(T,u,b,'silencedT',Math.min(CC_TALENT_CAP,0.5*o.rsSil*(1+(P['fp.k']||0)))); } },   // a talent's own silence: its full length, written straight on (no resist roll); the target's own tenacity still applies
    /* each Resonant Star rings the bell (The Deep Rings Back with First Toll: twice); Storm Bell at 5 Tolls */
    rsCast(A,T,u,c){ const o=S(T), P=T.P; if(TLR.some(id=>T.r[id])) A.stSet(T,u,'tl',A.stGet(T,'tl')+1+(o.drbT?1:0));
      o.drbT=0;
      if(P.storm&&A.stGet(T,'tl')>=5&&o.rsT&&o.rsSil>0){ A.stSet(T,u,'tl',0); const t=o.rsT, lim=2*A.eng().METER();   // Storm Bell: at 5 Tolls it spends them all and silences every enemy within 2 m of its target too, as long
        for(const x of foes(A,u)) if(x!==t&&!x._noTarget&&A.gap(t,x)<lim) A.control(T,u,x,'silencedT',o.rsSil); }
      o.rsT=null; o.rsSil=0; },
    rsTgt(A,T,u,c){ const o=S(T), e=o.lastHd; if(e&&e.alive&&A.markOf(u,e,'nr_hd')){ c.tgt=e; return; } for(const x of foes(A,u)) if(A.markOf(u,x,'nr_hd')&&!x._noTarget){ c.tgt=x; return; } },
    silTgt(A,T,u,c){ return !!c.tgt&&(c.tgt.silencedT||0)>0; },
    /* ---- DROWNED: an enemy silenced 3 s in a row (Sinking Fast sooner; by anyone) goes under for 4 s (Heavy Water longer); No Air: it gains no energy ---- */
    dwTick(A,T,u,dt){ const o=S(T), P=T.P, M=o.dwA||(o.dwA={}), need=Math.max(0.5,3+(P['dw.in']||0)), eg=o.eg||(o.eg={});
      for(const x of foes(A,u)){ if((x.silencedT||0)>0){ M[x.uid]=(M[x.uid]||0)+dt; if(M[x.uid]>=need-1e-9){ M[x.uid]=0; T.fn.drown(A,T,u,x); } } else M[x.uid]=0;
        if(P.noair){ if(A.markOf(u,x,'nr_dw')){ const k=eg[x.uid]; if(k!=null&&(x.energy||0)>k) x.energy=k; eg[x.uid]=x.energy||0; } else eg[x.uid]=null; } } },
    drown(A,T,u,x){ const o=S(T); A.setMark(T,u,x,'nr_dw',{dur:4+(T.P['dw.dur']||0),longest:true}); if(T.P.noair){ const eg=o.eg||(o.eg={}); eg[x.uid]=x.energy||0; } },
    noAirHit(A,T,u,c){ if(T.P.noair&&c.unit&&c.unit.team!==u.team&&A.markOf(u,c.unit,'nr_dw')) c.amt=0; },
    fallen(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team||!((x.silencedT||0)>0)||!T.P.tff) return; A.stSet(T,u,'tl',A.stGet(T,'tl')+1); A.acts(T,u,[{window:'nr_tff',dur:5}],c); },
    /* ---- CHOIR OF THE DEEP SKY ---- */
    chKit(A,T,u,c){ const o=S(T), P=T.P, op=c.o; let add=0;
      if(P['ec.ch']) add+=P['ec.ch']*A.stGet(T,'ec');                                                                // Spent Echo: longer per Echo held
      if(P.rtb){ const n=A.stGet(T,'tl'); if(n>0){ add+=0.4*n; A.stSet(T,u,'tl',0); } o.rtbOn=true; } else o.rtbOn=false;   // Ring the Bell: it spends every Toll, 0.4 s each
      if(add>0) op.dur=(op.dur||5)+add; },
    chAt(A,T,u,c){ const o=S(T), P=T.P, h=c.o, E=A.eng(); if(!h||!h.choir) return; const free=!!o.freeP; o.freeP=false; h._talFree=free?1:0;
      (o.chL||(o.chL=[])).push({h,free,t0:E.now()});
      if(o.rtbOn||(free&&P.whsb)) for(const x of foes(A,u)) if(Math.hypot(x.x-h.x,x.y-h.y)<=h.r) T.fn.drown(A,T,u,x); o.rtbOn=false; },
    /* each tick while a Choir of hers stands: who rides its Current (the heroes of her team whose centre is inside, as the Choir measures enemies), Slack Water,
       and its end (its time is up, or she is stunned, feared, silenced or dead: what ends the game's own channel) */
    chTick(A,T,u,c){ const o=S(T), P=T.P, L=o.chL, cur={};
      for(let i=0;i<L.length;i++){ const e=L[i], h=e.h; if(!(h.life>0)||!sung(u)){ L.splice(i--,1); T.fn.chEnd(A,T,u,e,c); continue; }
        const k=e.free?2:1;
        for(const x of team(A,u)) if(Math.hypot(x.x-h.x,x.y-h.y)<=h.r) cur[x.uid]=Math.max(cur[x.uid]||0,k);
        if(P['cur.slow']) for(const x of foes(A,u)) if(Math.hypot(x.x-h.x,x.y-h.y)<=h.r) A.acts(T,u,[{slow:Math.min(0.9,P['cur.slow']*k),dur:0.3,on:'target'}],{u,tgt:x}); }
      o.cur=cur; },
    chEnd(A,T,u,e,c){ const o=S(T), P=T.P, E=A.eng();
      if(P.elt){ const now=E.now(), pf=o.prF||(o.prF={}); for(const x of team(A,u)){ const was=A.ustGet(T,u,x,'ph'); A.ustPut(T,u,x,'ph',PH_MAX,8+(P['ph.dur']||0)); if(was===0) T.fn.trench(A,T,u,x);   // Every Light in the Trench
          T.fn.wake(A,T,u,x,6); pf[x.uid]=now+6; } }
      if(P.abb){ A.acts(T,u,[{window:'nr_abb',dur:6}],c); for(const x of foes(A,u)) T.fn.heard(A,T,u,x,6); } },     // A Breath Before
    chSil(A,T,u,c){ const P=T.P, e=c.unit; if(!e) return; let hd=!!A.markOf(u,e,'nr_hd');
      if(P.cow){ if(!hd) T.fn.heard(A,T,u,e,10); hd=true; }                                                          // Choir of Warnings: every enemy inside is Heard
      if(e._pend&&!((e.silencedT||0)>0)&&EC.some(id=>T.r[id])) T.fn.echo(A,T,u);
      c.amt=Math.min(CC_TALENT_CAP,c.amt*(1+(P['sil.k']||0))+((P.cow&&hd)?1:0)); },
    chHeal(A,T,u,c){ const P=T.P, x=c.unit; if(!x) return; c.amt*=(1+(P['ch.h']||0))*T.fn.herK(A,T,u,x);
      if(P.sky&&mate(u,x)){ T.fn.phAdd(A,T,u,x,1,8+(P['ph.dur']||0)+(P['sky.dur']||0)); T.fn.wake(A,T,u,x,3+(P['wk.dur']||0)); } },
    curAs(A,T,u,c){ const q=(S(T).cur||{})[c.tgt&&c.tgt.uid]||0; return q*((T.P['cur.as']||0)+(T.P['cur.as2']||0)); },
    curMv(A,T,u,c){ const q=(S(T).cur||{})[c.tgt&&c.tgt.uid]||0; return q*(T.P['cur.mv']||0); },
    /* ---- WHEN HER SIDE BREAKS: an ally (Nerisse too) drops below 25% HP while she holds 5 Tolls and can sing: a free Choir on that ally (once every 30 s) ---- */
    whTick(A,T,u){ const o=S(T), W=o.whW||(o.whW={}), E=A.eng();
      for(const x of team(A,u)){ const low=x.hp<0.25*x.maxHp, was=W[x.uid]; W[x.uid]=low;
        if(low&&!was&&!(o.whCd>0)&&A.stGet(T,'tl')>=5&&sung(u)&&E.castUlt){ o.whCd=30; o.freeP=true; const p=u._pend, ct=u._castT; E.castUlt(u,x); u._pend=p; u._castT=ct; break; } } },
    /* ---- PELAGIC INSIGHT: its share now (the game's own), made stronger by Brace (Bracing) and Tolls (Insight of the Bell), and Hollow Shell's points ---- */
    piK(A,T,u){ const P=T.P; return (1+(P['br.pi']||0)*A.stGet(T,'br'))*(1+(P.iob?0.01*A.stGet(T,'tl'):0)); },
    piStr(A,T,u){ if(!piUp(u)) return 0; return u._piAdd*T.fn.piK(A,T,u)+(T.P['pi.pt']||0); },
    /* ---- HITS ON HER TEAM (teamIn: the struck unit is not her) and HER TEAM'S HITS (teamIn on an enemy, from an ally) ---- */
    tIn(A,T,u,c){ const t=c.tgt, s=c.src; if(!t||!s) return;
      if(mate(u,t)&&foe(u,s)){ T.fn.preHit(A,T,u,s,c); let k=Math.max(TCAP,T.fn.teamF(A,T,u,t,c)); if(A.winOn(T,'nr_abb')&&!c.auto) k=Math.min(k,SIG_ALLY); c.amt*=k; T.fn.postHit(A,T,u,t,s); return; }
      if(foe(u,t)&&s!==u) c.amt*=T.fn.outK(A,T,u,c,s); },                                                       // (her own hits: myOut)
    myIn(A,T,u,c){ const s=c.src, P=T.P, o=S(T); if(!s||!foe(u,s)) return;
      if(P.sa&&A.stGet(T,'br')>=4&&!(o.saCd>0)){ o.saCd=5; c.amt=0; u._talMiss=1; if(P['sa.nrg']) u.energy=Math.min(100,(u.energy||0)+P['sa.nrg']); return; }   // Slip Away: the first enemy hit every 5 s misses
      T.fn.preHit(A,T,u,s,c); let k=Math.max(MCAP,T.fn.teamF(A,T,u,u,c)*T.fn.meF(A,T,u,c)); if(A.winOn(T,'nr_abb')&&!c.auto) k=Math.min(k,SIG_ME); c.amt*=k; T.fn.postHit(A,T,u,u,s); },
    /* a hit on a hero of her team: before it is sized, a Heard enemy's skill hit spends its Heard on this skill (a skill with no cast time); after it, Abyssal Calm and
       Held Down on the attacker (for its later hits) */
    preHit(A,T,u,s,c){ if(!c.auto&&A.markOf(u,s,'nr_hd')&&!A.markOf(u,s,'nr_hdc')) T.fn.press(A,T,u,s,1.5); },
    postHit(A,T,u,t,s){ const P=T.P;
      if(P['ac.k']&&A.markOf(u,t,'nr_wk')) A.acts(T,u,[{ustack:'ac',on:'target',add:1}],{u,tgt:s});
      if(P.hdn&&T.fn.prN(A,T,u,t)>=5) A.acts(T,u,[{slow:P.hdn,dur:2,on:'target'}],{u,tgt:s}); },
    /* the reductions her talents give one hero of her team (Nerisse included) */
    teamF(A,T,u,x,c){ const P=T.P, s=c.src; let k=1;
      if(P['wk.k']&&A.markOf(u,x,'nr_wk')) k*=1-P['wk.k'];
      if(P['ph.dr']&&A.ustGet(T,u,x,'ph')>0) k*=1-P['ph.dr'];
      if(P.ew&&!c.auto&&s._castSlot==='ult'&&T.fn.prN(A,T,u,x)>=5) k*=1-P.ew;
      if(P['ac.k']){ const n=A.ustGet(T,u,s,'ac'); if(n>0) k*=1-P['ac.k']*n; }
      const hd=!!A.markOf(u,s,'nr_hd');
      if(P['hd.bb']&&hd) k*=1-P['hd.bb'];
      if(!c.auto&&A.markOf(u,s,'nr_hdc')){ if(P['hd.k']) k*=1-P['hd.k']; if(P['hd.bil']) k*=1-P['hd.bil']; }
      if(!c.auto&&A.markOf(u,s,'nr_drbc')) k*=1-0.04;
      if(x!==u){ if(P['hd.near']&&hd&&A.gap(u,x)<4*A.eng().METER()) k*=1-P['hd.near'];
        const pi=T.fn.piStr(A,T,u); let cov=0;                                                                       // her Pelagic Insight on an ally: Wake of Insight (Insight Shared), Insight of the Bell (the ally nearest her; Ringing Insight)
        if(pi>0&&P.woi&&A.markOf(u,x,'nr_wk')) cov=Math.max(cov,pi+(P['woi.k']||0));
        if(pi>0&&P.iob&&T.fn.nearest(A,T,u)===x) cov=Math.max(cov,pi+(P['iob.k']||0));
        if(cov>0) k*=1-Math.min(0.9,cov); }
      return k; },
    /* her own: Still Water, Cold Calm, Salt Skin, Hard Water, Echo Chamber, Rooted Feet, Sound Footing, Quiet Trench, and what her talents add to her Pelagic Insight */
    meF(A,T,u,c){ const P=T.P, s=c.src; let k=1;
      if(P['dr.sw']&&T.fn.orbFly(A,T)) k*=1-P['dr.sw'];
      if(c.kind==='magic'){ if(P['dr.cc']) k*=1-P['dr.cc']; if(P['dr.ss']) k*=1-P['dr.ss']; }
      if(P['dr.hw']&&((s.silencedT||0)>0||A.markOf(u,s,'nr_dw'))) k*=1-P['dr.hw'];
      if(P['dr.ec']) k*=1-P['dr.ec']*A.stGet(T,'ec');
      if(P['dr.rf']&&P.sf&&A.stGet(T,'br')>=4) k*=1-P['dr.rf'];
      if(P['dr.sf']&&c.auto) k*=1-P['dr.sf'];
      if(P['dr.qt']&&T.fn.allPh(A,T,u)) k*=1-P['dr.qt'];
      if(piUp(u)&&(P['br.pi']||P.iob||P['pi.pt'])){ const x=u._piAdd*(T.fn.piK(A,T,u)-1)+(P['pi.pt']||0); if(x>0) k*=1-x; }
      return k; },
    allPh(A,T,u){ let n=0; for(const x of team(A,u)){ if(x===u) continue; if(!(A.ustGet(T,u,x,'ph')>0)) return false; n++; } return n>0; },
    nearest(A,T,u){ let b=null,bd=1e9; for(const x of team(A,u)){ if(x===u) continue; const g=A.gap(u,x); if(g<bd){ bd=g; b=x; } } return b; },
    /* her team's hits on enemies: Forewarned (Heard), Ringing Ears (silenced), Drowned (Under the Surface: magic; Drowning Weight: every hit) */
    outK(A,T,u,c,s){ const P=T.P, t=c.tgt; let k=1; const ally=!!s&&s.team===u.team;
      if(ally&&P['hd.fw']&&A.markOf(u,t,'nr_hd')) k*=1+P['hd.fw'];
      if(ally&&P['sil.re']&&(t.silencedT||0)>0) k*=1+P['sil.re'];
      if(A.markOf(u,t,'nr_dw')){ if(P['dw.k']&&c.kind==='magic') k*=1+P['dw.k']; if(P['dw.all']) k*=1+P['dw.all']; }
      return k; },
    myOut(A,T,u,c){ c.amt*=T.fn.outK(A,T,u,c,u); },
    /* ---- HEALING RECEIVED: Glow Rich (4 Phosphor), Undertone (in the Current) ---- */
    tHeal(A,T,u,c){ const P=T.P, x=c.unit; if(!x||x.team!==u.team) return; if(P['ph.hr']&&A.ustGet(T,u,x,'ph')>=PH_MAX) c.amt*=1+P['ph.hr'];
      if(P['cur.hr']){ const q=(S(T).cur||{})[x.uid]||0; if(q) c.amt*=1+P['cur.hr']*q; } }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips in WIRING/42 - NERISSE BELLGLASS - talent decisions.md) */
  ruling:{}
};
