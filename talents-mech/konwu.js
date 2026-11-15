/* KONWU - what his learned talents do in a fight (the mechanics; his plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for KonWu")
   His real kit (the code, not the card wording; a melee Bruiser, every skill reads Attack, his damage is physical):
   - Cleaving Arc ('cleavecone', green, cd 6, delivered as a form 0.35 s after the press): every enemy whose CENTRE is within 5 m of his centre and inside a
     45 degree cone toward his target takes 150% of his attack x skill level. MEASURED (tests/konwu-kit-facts.js, 20 seeded fights): it lands on 67% of casts
     and never struck two enemies in one cast (0 of 124). A fix for v1391 on another branch measures to the enemy's body edge (90% of the same casts land).
     Its hits resolve inside the skill: rows ask casting:'cleavecone'.
   - Phantom Step ('blink', blue, cd 10): a 1 s channel (_blinkT), then konwuBlinkExec puts him behind the lowest-HP enemy within 15 m (centre); 0.667 s later
     konwuKickExec lands the dropkick (200% x skill level x 1.2), knocks the mark 8 m straight away from him (an instant move with 0.35 s in the air; an
     immovable mark stays), stuns it (the table's single stun 3.5 s x 0.7 = 2.45 s) and starts the chase: 3 s at 1.5x speed, his target held on the mark.
     The chase's own "reached it" test (centre distance <= his range + the mark's hit radius) is shorter than two bodies, so it always runs its full 3 s
     unless the mark dies; its clock stands still while he is stunned. The kick lands outside the skill: guarded page sites (skillTgt in konwuBlinkExec;
     landPre / land around the kick's hit, skill 'blink'; pass 'kick' at the end of konwuKickExec, after the knock, the stun and the chase).
   - Heaven-Splitting Slam (ultimate 'monkSlam', on energy - no cooldown; ULT_DEF.monkSlam {mul 1.0, stun 2, radius 15 m} merged with HERO_ULT_ART.konwu, which
     only adds the art): 100% of his attack x skill level to every enemy within 15 m of his centre and a stun through ccApply (the table's area stun 2.0 s x 0.7
     = 1.4 s). Its hits and stuns resolve inside the skill: casting:'monkSlam'.
   - Adamant Discipline (passive 'warden', Hobb's Fired Clay code): every 3 s in battle a stack (max 5, wardenStk / wardenT), each 4% x his passive's strength
     LESS DAMAGE TAKEN (inside damage(), wardenCut), up to SKLV.wardenCap (20% at level 1, 29.9% at 100). It is damage reduction, not armour and magic resist
     (the card), it climbs on a clock (hits or not) and a new wave starts it at 0. "Adamant Discipline is full" = 5 stacks.
   Insult, Hard Landing, Head Start, Greystone, Skid, Fault, Swept, Length and Laughter exist only through his talents.
   NOTE: the game's battleTime starts again at 0 each wave, so his "once every N s" locks are countdowns of fight time (tk), never absolute times.
   Readings, caps and corrected tooltips: WIRING/33 - KONWU - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const ARC='cleavecone', PS='blink', SL='monkSlam';
const DR_CAP=0.70, CRIT_CAP=0.05, STUN_TOP=4.0, REGEN_CAP=0.012;
/* the families: each state's bookkeeping runs when any of the talents that read it is learned */
const INS=['nf_1_4','nf_3_4','nf_5_4','nf_6_4','nf_11_1','nf_12_1','nf_10_1','nf_11_2','nf_13_2'];                     // Insult (every enemy he stuns)
const HL=['nf_1_1','nf_3_1','nf_8_1','nf_10_1','nf_11_2','nf_13_2','gp_n1'];                                          // Hard Landing (the kick's flight)
const HS=['nf_2_2','nf_9_1','nf_12_3'];                                                                                // Head Start
const CHASE=['nf_5_2','nf_5_3','nf_6_3','nf_6_1'].concat(HS);                                                          // the chase watched each tick
const GREY=['gp_1_4','gp_n1','gp_3_4','gp_6_4','gp_7_4','gp_8_4','gp_11_1','gp_11_3','gp_12_3','gp_13_3'];             // Greystone
const FLT=['gp_1_1','gp_3_1','gp_6_1','gp_7_1','gp_9_1','gp_11_4','gp_10_2','gp_12_4','gp_13_3'];                     // Fault
const SKID=['gp_1_3','gp_2_3','gp_4_3','gp_5_3','gp_12_1'];                                                            // Skid
const SW=['ru_1_1','ru_3_1','ru_6_1','ru_5_1','ru_12_2','ru_13_3'];                                                    // Swept
const LEN=['ru_1_4','ru_2_4','ru_3_4','ru_7_4','ru_8_4','ru_10_4','ru_12_3','ru_11_3','ru_6_4','ru_13_3'];             // Length
const LG=['ru_2_3','ru_4_3','ru_8_3','ru_13_3'];                                                                       // Laughter
const KICK=HL.concat(HS,['gp_7_4','nf_4_2','nf_9_4','nf_13_2']);                                                    // the kick's own pair (kickPre .. kickEnd)
const ARCK=['ru_1_4','ru_3_4','ru_13_3','gp_5_3','ru_11_4','ru_5_3','ru_8_4'].concat(LEN);                             // his own pass over Cleaving Arc (kit, cast)
const STUN=INS.concat(['nf_8_2','gp_10_3','nf_11_2','nf_12_2','nf_13_2','nf_3_1','gp_13_3'],FLT);                      // rows on every stun he lands
const DRG=['gp_1_4','gp_n1','nf_5_4','gp_10_4','ru_10_1','gp_12_4','gp_1_3','gp_4_3','gp_5_2','gp_6_2','gp_13_3'];    // his damage reduction on hits: ONE capped group (70%)
const CRIT=['nf_9_3','nf_7_4','ru_7_1'];                                                                               // his crit-chance talents: ONE capped group (5%)
const S=T=>T.s.kw||(T.s.kw={});                                    // his own per-fight state (one object: no name of the runtime's own is ever used)
const rk=(T,id)=>T.r[id]||0;
const stN=(T,n)=>{ const k=T.s.k[n]; return k?k.n:0; };
const winN=(T,n)=>{ const w=T.s.w[n]; return !!w&&w.t>0; };
const mk=(u,t,name,now)=>{ const o=t&&t._talM&&t._talM[u.uid], m=o&&o[name]; return !!m&&(m.until==null||now<m.until); };
const adFull=u=>!!(u.pass&&u.pass.warden)&&(u.wardenStk||0)>=5;
const atk=(A,T,u)=>A.amtOf(T,u,{pct:1,of:'atk'},null);
/* enemies whose body is within m metres of his body */
function nearN(A,u,m){ const E=A.eng(), U=E.units(), lim=m*E.METER(); let n=0; for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive||x.team===u.team||x._dropHidden||x._noTarget) continue; if(E.dist(u,x)-E.bodyR(u)-E.bodyR(x)<lim) n++; } return n; }
function segD(p,ax,ay,bx,by){ const dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy; let k=L>0?((p.x-ax)*dx+(p.y-ay)*dy)/L:0; k=Math.max(0,Math.min(1,k)); return Math.hypot(p.x-(ax+dx*k),p.y-(ay+dy*k)); }
/* his talent stuns, at their full written length (+ Ringing Ears) on the fixed path (no resist roll): never on an enemy that is stunned now, nor within 0.5 s
   after a stun of his on it ended (mark 'kwLk', written for every stun he lands, skill or talent). Each caller stuns each enemy once */
function tstun(A,T,u,L,secs){ const E=A.eng(), now=E.now(), d=secs+(T.P.re||0); for(const t of L){ if(!t||!t.alive||t.team===u.team) continue;
    if((t.stunned||0)>0||mk(u,t,'kwLk',now)) continue; A.control(T,u,t,'stunned',d); } }
module.exports={
  hero:'konwu',
  casting:true,                         // rows ask which of his skills a hit, a stun or a cast comes from (Cleaving Arc, Phantom Step's kick, Heaven-Splitting Slam)
  states:{
    kwGrey:{max:P('grey.max',5),wave:'reset'},                      // Greystone (each wave; Mountain Patience keeps half: mpWave)
    kwHs:{max:P('hs.max',6)},                                       // Head Start (until his next basic attack spends it)
    kwLen:{max:P('len.max',5),wave:'reset'},                        // Length (this wave)
    kwLg:{max:P('lg.max',3),wave:'reset'},                          // Laughter (this wave)
    kwSr:{max:5},                                                   // times he reached full Greystone this fight (Stone Remembers)
    kwShd:{max:5,wave:'reset'}                                      // Shale's shards (until his next Cleaving Arc)
  },
  /* run for him whenever he has any mechanic talent: the bookkeeping of the states his talents share, and his capped groups */
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                   // the chase, Head Start, Greystone, Discipline's clock, the countdowns
    {on:'wave',do:[{fn:'wv'}]},
    {on:'ccHit',reqAny:STUN,if:{cc:['stunned']},do:[{fn:'stunHit'}]},                                             // every stun he lands: the break rule's mark, Insult, Fault, Ringing Ears
    {on:'kit',skill:SL,reqAny:['nf_11_2','nf_12_2'],do:[{fn:'slamKit'}]},
    {on:'cast',skill:SL,reqAny:['nf_11_2','nf_12_2'],do:[{fn:'slamCast'}]},                                       // Shake the Heavens' knock, Heaven's Mistake
    {on:'skillAt',skill:PS,reqAny:['nf_7_4','nf_13_2'],do:[{fn:'psAt'}]},                                         // he lands behind the mark (Behind You; the signature keeps the skill's options)
    {on:'skillTgt',skill:PS,reqAny:['nf_13_2'],do:[{fn:'sigTgt'}]},                                               // Thrown Down Again: the second Phantom Step goes to the same mark
    {on:'landPre',skill:PS,reqAny:KICK,do:[{fn:'kickPre'}]},                  // the kick: where the mark stood, Insulted before it, Landslide's spend
    {on:'pass',skill:'kick',reqAny:KICK,do:[{fn:'kickEnd'}]},              // after the kick, the knock, the stun and the chase
    {on:'ccOut',reqAny:['nf_13_2'],if:{cc:['stunned']},do:[{fn:'sigStun'}]},                                      //   the second kick does not stun a mark that is stunned (the break rule)
    {on:'out',reqAny:HS,if:{auto:true,targetTeam:'enemy'},do:[{fn:'hsSpend'}]},                                   // Head Start: his first basic attack after the kick spends it
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                        // his damage-reduction talents: ONE capped group (myDr)
    {on:'crit',reqAny:CRIT,if:{targetTeam:'enemy'},do:[{fn:'crit'}]},                                             // his crit-chance talents: ONE capped group (critS + crit)
    {stat:{crit:1},reqAny:CRIT,per:{fn:'critS'}},
    {on:'kit',skill:ARC,reqAny:ARCK.concat(SW,LG),do:[{fn:'arcKit'}]},                                            // Cleaving Arc: Length's reach, At His Word, the signature, Shale
    {on:'hit',reqAny:SW.concat(ARCK,['gp_11_4','ru_5_2']),if:{casting:ARC,targetTeam:'enemy'},do:[{fn:'arcHit'}]},
    {on:'cast',skill:ARC,reqAny:ARCK.concat(SW,LG),do:[{fn:'arcCast'}]},                                          // Grow, Grown Strong
    {on:'kill',reqAny:LG,if:{casting:ARC},do:[{stack:'kwLg',add:1}]},                                             // Laughter: each enemy Cleaving Arc kills
    {stat:{atk:1},reqAny:['gp_8_4','gp_7_2','gp_11_3'],per:{fn:'atkG'}}                                           // (Cold Grey, Stone Hands, Stone Remembers: one attack stat)
  ],
  talents:{
    /* ============================== NINE DAYS FALLING ============================== */
    nf_1_1:[ {param:'hl.k',add:R(0.01)} ],                                                                          // Long Way Down (Hard Landing: kickEnd, hlLand)
    nf_2_2:[ {param:'hs.k',add:R(0.01)} ],                                                                          // Close Behind (was Hot Pursuit; Head Start: tk, hsSpend)
    nf_1_4:[ {on:'out',if:{targetHas:'kwIns'},more:R(0.03)} ],                                                      // Insolence (Insult: stunHit)
    nf_2_1:[ {on:'kit',skill:PS,opt:{knock:{addM:R(0.5)}}} ],                                                       // Further Down
    nf_4_2:[ {param:'ch.add',add:R(0.3)} ],                                                                         // Long Pursuit (kickEnd)
    nf_3_1:[ {param:'itc',add:1} ],                                                                                 // Into the Crowd (kickEnd, hlLand)
    nf_3_3:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                      // Heaven-Forged Gold
    nf_3_4:[ {param:'ins.dur',add:R(0.6)} ],                                                                        // Lingering Slight
    nf_4_1:[ {on:'kit',skill:PS,opt:{range:{addM:R(1)}}} ],                                                         // Monkey's Reach
    nf_5_2:[ {param:'nlg',add:1}, {on:'ccIn',if:{fn:'chasing',cc:['slow','fearT']},mul:0} ],                        // Never Let Go (PICK ONE; the slows written straight on: tk)
    nf_5_3:[ {param:'phb',add:1} ],                                                                                 // Pass Him By (PICK ONE; tk)
    nf_4_3:[ {on:'out',if:{casting:ARC},more:R(0.05)} ],                                                            // Staff Weight
    nf_2_3:[ {stat:{move:R(0.03)}} ],                                                                               // Quick Feet
    nf_6_3:[ {stat:{aspd:R(0.05)},if:{window:'kwHe'}} ],                                                            // Hungry Eyes (the window: tk, on each jump)
    nf_5_4:[ {param:'dr.sp',add:R(0.015)} ],                                                                        // Spite of Heaven (in myDr)
    nf_6_1:[ {stat:{move:R(0.04)},if:{fn:'chasing'}} ],                                                             // Cloud Stride
    nf_6_2:[ {on:'out',if:{casting:PS},more:R(0.03)} ],                                                             // Dropkick Form
    nf_6_4:[ {on:'out',if:{targetHas:'kwWg',targetTeam:'enemy'},critMore:R(0.05),do:[{mark:'kwWg',on:'target',clear:true}]} ],         // Wide Grin (the first hit on each new Insult)
    nf_7_1:[ {on:'out',if:{targetHpBelow:0.50},more:R(0.02)} ],                                                     // Weakest First
    nf_7_3:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                              // Ruyi Swing
    nf_7_4:[ {param:'cr.by',add:R(0.015)} ],                                                                        // Behind You (the 2 s: psAt; in the crit group)
    nf_8_1:[ {param:'hl.slow',add:R(0.04)} ],                                                                       // Broken Ground (hlLand)
    nf_8_2:[ {param:'re',add:R(0.06)} ],                                                                            // Ringing Ears (stunHit, tstun)
    nf_9_3:[ {param:'cr.un',add:R(0.01)} ],                                                                         // Unimpressed (in the crit group)
    nf_9_1:[ {stat:{lifesteal:R(0.004)},per:'kwHs'} ],                                                              // Overtake
    nf_10_1:[ {param:'hl.ins',add:R(0.04)} ],                                                                       // Down Hard (hlLand)
    nf_9_4:[ {param:'ss',add:1}, {on:'land',skill:PS,do:[{fn:'ssLand'}]},                                           // Second Step
             {on:'death',if:{unitHas:'kwSs'},do:[{cd:'blue',add:-3},{mark:'kwSs',on:'unit',clear:true}]} ],
    nf_10_2:[ {on:'out',if:{casting:SL},more:R(0.03)} ],                                                            // Falling Weight (was Terminal Velocity)
    nf_10_4:[ {on:'land',skill:PS,do:[{heal:{pct:R(0.01),of:'maxHp'},on:'self'}]} ],                                // Back on His Feet
    nf_11_1:[ {stat:{atk:R(0.01)},per:{units:{team:'enemy',has:'kwIns'},max:3}} ],                                  // Earned Disdain (up to 3)
    nf_11_2:[ {param:'sh',add:1} ],                                                                                 // Shake the Heavens (stunHit, slamCast)
    nf_11_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ],                                                                 // Deep Breath
    nf_12_1:[ {on:'out',if:{targetHas:'kwIns'},critMore:R(0.02)} ],                                                 // Old Slight
    nf_12_2:[ {param:'hm',add:R(0.2)} ],                                                                            // Heaven's Mistake (slamCast)
    nf_12_3:[ {param:'hs.max',add:R(1)} ],                                                                          // Full Stride
    nf_12_4:[ {on:'land',skill:PS,do:[{shield:{pct:R(0.02),of:'maxHp'},dur:3}]} ],                                  // Nothing Hurt
    nf_13_2:[ {param:'tda',add:1} ],                                                                                // Thrown Down Again (SIGNATURE: kickPre, kickEnd, sigTgt, sigStun, hlLand)
    /* ============================== GREY OF THE PEAK ============================== */
    gp_1_1:[ {on:'out',if:{targetHas:'kwFlt'},more:R(0.02)},                                                        // The Fault Beneath (Fault: stunHit): him ...
             {on:'teamIn',if:{targetHas:'kwFlt',targetTeam:'enemy',srcIs:'ally'},more:R(0.02)} ],                   //   ... and his team
    gp_1_3:[ {param:'skid',add:R(0.01)} ],                                                                          // Blades Skid (myDr)
    gp_1_4:[ {param:'dr.gs',add:R(0.004)} ],                                                                        // Grey Skin (Greystone: tk; in myDr)
    gp_2_3:[ {param:'grit',add:R(0.06)}, {on:'out',if:{auto:true,targetTeam:'enemy'},do:[{fn:'gritOut'}]} ],        // Grit in the Edge
    gp_2_4:[ {param:'ad.fast',add:R(0.3)} ],                                                                        // Old Rock (tk)
    gp_3_1:[ {param:'flt.dur',add:R(0.6)} ],                                                                        // Wide Fault
    gp_4_2:[ {on:'out',if:{casting:ARC},more:R(0.05)} ],                                                            // Weight of Ruyi
    gp_n1:[  {param:'dr.sf',add:0.03}, {param:'sf.hl',req:'nf_1_1',add:0.06} ],                                     // Stone in Flight (LINK; in myDr; with Long Way Down: hlLand)
    gp_3_4:[ {param:'mp',add:1} ],                                                                                  // Mountain Patience (tk, wv)
    gp_5_1:[ {on:'tick',do:[{weaken:'slowMul',by:R(0.08)}]} ],                                                      // Rooted Feet (up to 24%)
    gp_4_3:[ {param:'skid',add:R(0.005)} ],                                                                         // Sliding Off (points; myDr)
    gp_4_4:[ {on:'ccIn',less:R(0.04)} ],                                                                            // Stubborn Stone (up to 20%)
    gp_6_4:[ {param:'grey.max',add:R(1)} ],                                                                         // Layered Stone
    gp_5_2:[ {param:'gr',add:1} ],                                                                                  // Granite (PICK ONE; myDr)
    gp_5_3:[ {param:'sh.k',add:0.04}, {on:'out',if:{casting:ARC},do:[{fn:'shOut'}]} ],                              // Shale (PICK ONE; the shards: myDr, arcKit)
    gp_6_3:[ {on:'out',if:{casting:PS},more:R(0.03)} ],                                                             // Kick Off the Rock
    gp_6_1:[ {stat:{move:R(-0.05)},to:{team:'enemy',has:'kwFlt'}} ],                                                // Crack Spreads
    gp_6_2:[ {param:'gr.hc',add:R(0.01)} ],                                                                         // Harder Cap (myDr)
    gp_7_1:[ {on:'out',if:{targetHas:'kwFlt'},more:R(0.02)} ],                                                      // Fault Seeker
    gp_7_2:[ {param:'atk.sh',add:R(0.02)} ],                                                                        // Stone Hands (atkG)
    gp_7_4:[ {param:'ls',add:1}, {on:'out',if:{casting:PS},do:[{fn:'lsOut'}]} ],                                    // Landslide (kickPre, kickEnd)
    gp_8_2:[ {on:'out',if:{casting:SL},more:R(0.04)} ],                                                             // Grey Patience
    gp_8_3:[ {on:'tick',if:{fn:'full'},period:3,do:[{fn:'drill'}]} ],                                               // Sky-Warden Drill (at the regeneration cap)
    gp_8_4:[ {param:'atk.cg',add:R(0.004)} ],                                                                       // Cold Grey (was Cold Stone; atkG)
    gp_9_1:[ {on:'out',if:{casting:ARC,targetHas:'kwFlt'},more:R(0.03)} ],                                          // Along the Fault
    gp_9_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                      // Crack in Everything
    gp_9_3:[ {param:'nm',add:1}, {on:'ccIn',if:{fn:'full',cc:['stunned']},do:[{fn:'nmClamp'}]} ],                   // Never Moved (the rest: tk)
    gp_10_3:[ {param:'echo',add:R(0.1)} ],                                                                          // Echo of the Fall (stunHit)
    gp_10_4:[ {param:'dr.we',add:R(0.015)} ],                                                                       // Weathered (in myDr)
    gp_11_1:[ {on:'out',if:{stackFull:'kwGrey'},more:R(0.02)} ],                                                    // Settled
    gp_11_3:[ {param:'atk.sr',add:R(0.01)} ],                                                                       // Stone Remembers (tk; atkG)
    gp_11_4:[ {param:'fht',add:1} ],                                                                                // Four Hundred Times (arcHit)
    gp_12_1:[ {param:'gu',add:R(0.01)} ],                                                                           // Gold Underneath (myDr)
    gp_10_2:[ {on:'death',if:{unitHas:'kwFlt'},do:[{mark:'kwFlt',on:{team:'enemy',of:'unit',n:1},dur:R(1),longest:true}]} ],   // Shifting Ground
    gp_12_3:[ {stat:{lifesteal:R(0.003)},per:'kwGrey'} ],                                                           // Mountain Rising
    gp_12_4:[ {param:'dr.uc',add:R(0.02)}, {on:'teamIn',if:{srcHas:'kwFlt',srcTeam:'enemy',targetTeam:'ally'},less:R(0.02)} ],   // Under the City (him: in myDr; his team)
    gp_13_3:[ {param:'mtn',add:1}, {on:'end:kwMtn',do:[{fn:'mtnEnd'}]} ],                                           // The Mountain Comes Up (SIGNATURE: the trigger in tk, the cap in myDr)
    /* ============================== RUYI AT HIS WORD ============================== */
    ru_1_1:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'kwSw'}} ],                                                 // Clear the Path (Swept: arcHit)
    ru_2_3:[ {on:'cd',skill:'green',add:R(-0.1),per:'kwLg'} ],                                                      // Belly Laugh (Laughter: the always kill row)
    ru_1_4:[ {param:'len.r',add:0.2}, {on:'out',if:{casting:ARC},more:R(0.01),per:'kwLen'} ],                       // Grow (Length: arcCast; the reach: arcKit)
    ru_3_1:[ {param:'sw.dur',add:R(0.4)} ],                                                                         // Swept Aside
    ru_2_4:[ {param:'len.max',add:R(1)} ],                                                                          // Long Ruyi
    ru_2_2:[ {stat:{move:R(0.03)}} ],                                                                               // Light Gold
    ru_3_2:[ {on:'out',ignoreArmor:R(0.02)} ],                                                                      // Iron Core
    ru_4_3:[ {param:'lg.max',add:R(1)} ],                                                                           // Can't Stop Laughing
    ru_3_4:[ {param:'ahw',add:1} ],                                                                                 // At His Word (arcKit)
    ru_6_1:[ {stat:{crit:R(-0.04)},to:{team:'enemy',has:'kwSw'}} ],                                                 // Dust in the Eyes
    ru_4_2:[ {on:'out',if:{casting:ARC,fn:'far3'},more:R(0.04)} ],                                                  // Sweep Low
    ru_4_4:[ {on:'out',if:{casting:ARC},more:R(0.03)} ],                                                            // Arc Heavy
    ru_5_1:[ {on:'out',if:{targetHas:'kwSw'},more:R(0.015)} ],                                                      // Swept Away
    ru_6_3:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                              // Spinning Staff
    ru_10_3:[ {on:'out',if:{casting:SL},more:R(0.03)} ],                                                            // Grand Slam
    ru_7_1:[ {param:'cr.cs',add:R(0.015)} ],                                                                        // Clean Sweep (in the crit group)
    ru_7_2:[ {on:'out',if:{casting:PS},more:R(0.03)} ],                                                             // Behind the Weak
    ru_6_4:[ {stat:{aspd:R(0.03)},if:{fn:'lenLow'}} ],                                                              // Ruyi Shrinks
    ru_9_1:[ {on:'hit',if:{casting:ARC,crit:true,targetTeam:'enemy',targetAlive:true},do:[{push:'target',m:2,secs:0.25}]} ],   // Clean Through
    ru_7_4:[ {stat:{atk:R(0.004)},per:'kwLen'} ],                                                                   // Wide World
    ru_8_3:[ {stat:{aspd:R(0.01)},per:'kwLg'} ],                                                                    // Heaven Laughs Back
    ru_5_2:[ {on:'hit',if:{casting:ARC,targetTeam:'enemy',targetAlive:true},do:[{taunt:P('peb.t',1),on:'target'}]} ],   // Pebble in the Eye (PICK ONE)
    ru_5_3:[ {on:'out',if:{casting:ARC,fn:'mostHp'},more:0.25} ],                                                   // Shrine Breaker (PICK ONE)
    ru_8_4:[ {param:'gs.h',add:R(0.004)} ],                                                                         // Grown Strong (arcCast)
    ru_6_2:[ {param:'peb.t',add:R(0.2)} ],                                                                          // Look at Me
    ru_9_4:[ {on:'cd',skill:'green',add:R(-0.15)} ],                                                                // Quick Arc
    ru_10_1:[ {param:'dr.ts',add:R(0.01)} ],                                                                        // Thick-Skinned (in myDr)
    ru_10_4:[ {on:'wave',do:[{stack:'kwLen',atLeast:R(1)}]} ],                                                      // Ruyi Remembers
    ru_11_2:[ {stat:{atk:R(0.003)},per:{field:'wardenStk',of:'self'}} ],                                            // Discipline in Motion
    ru_11_3:[ {on:'cast',skill:SL,do:[{stack:'kwLen',set:'max'},{cd:'green',set:0}]} ],                             // Full Length
    ru_11_4:[ {on:'out',if:{casting:ARC},more:R(0.01),per:{fn:'arcN',max:5}} ],                                     // Crowded Arc (up to 5)
    ru_12_1:[ {stat:{aspd:R(0.04)},if:{fn:'crowd5'}} ],                                                             // Stand in the Middle
    ru_12_2:[ {on:'death',if:{unitHas:'kwSw'},do:[{heal:{pct:R(0.01),of:'maxHp'},on:'self'}]} ],                    // Swept Clean
    ru_12_3:[ {on:'out',if:{casting:ARC,stackFull:'kwLen'},more:R(0.02)} ],                                         // Ruyi Swells
    ru_13_3:[ {param:'sky',add:1}, {on:'out',if:{casting:ARC,fn:'skyOn'},mul:2} ]                                   // Ruyi Touches the Sky (SIGNATURE: arcKit, arcHit)
  },
  fn:{
    /* ---- EACH TICK: the chase (Head Start, Pass Him By, Never Let Go), Adamant Discipline's clock (Old Rock) and what it held (Mountain Patience), Greystone
       (1 each 3 s while Discipline is full; Stone Remembers counts each time it fills), Never Moved, the signature's trigger and his countdowns ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), P=T.P, dt=c.dt||0, now=E.now(); T.s.api=A;
      if(o.f==null) o.f={grey:GREY.some(id=>T.r[id]), hs:HS.some(id=>T.r[id]), ch:CHASE.some(id=>T.r[id])};
      const f=o.f;
      for(const k of ['tdaCd','skyCd','mtnCd']) if(o[k]>0) o[k]=Math.max(0,o[k]-dt);
      if(P['ad.fast']&&u.pass&&u.pass.warden&&(u.wardenStk||0)<5){ const p=Math.max(1.5,3-P['ad.fast']); u.wardenT=(u.wardenT||0)+dt*(3/p-1); }
      if(P.mp&&u.pass&&u.pass.warden){ o.ws=u.wardenStk||0; o.gs=stN(T,'kwGrey'); }
      const full=adFull(u);
      if(f.grey){ if(full){ o.ga=(o.ga||0)+dt; while(o.ga>=3-1e-9){ o.ga-=3; const mx=A.stMax(T,u,'kwGrey'); if(stN(T,'kwGrey')<mx&&A.stSet(T,u,'kwGrey',stN(T,'kwGrey')+1)>0&&stN(T,'kwGrey')>=mx-1e-9&&P['atk.sr']) A.stSet(T,u,'kwSr',stN(T,'kwSr')+1); } } else o.ga=0; }
      if(P.nm&&full){ if(!((u._gearImmovableT||0)>=0.1)) u._gearImmovableT=0.1; if((u.stunned||0)>1) u.stunned=1; }
      if(f.ch){ const ch=(u._chaseT||0)>0&&u._chaseTg&&u._chaseTg.alive;
        if(!ch&&P.phb&&o.chT>dt&&o.chTg&&!o.chTg.alive){ const x=A.pick(T,u,{team:'enemy',within:8,order:'lowHp',n:1},c)[0];   // Pass Him By: the chase jumps on
          if(x){ u._chaseTg=x; u._chaseT=o.chT-dt; u.target=x; if(T.r.nf_6_3) A.acts(T,u,[{window:'kwHe',dur:4}],c); } }
        const on=(u._chaseT||0)>0&&u._chaseTg&&u._chaseTg.alive;
        if(on&&P.nlg){ if((u.slow||0)>0){ u.slow=0; u.slowMul=null; } if((u.fearT||0)>0) u.fearT=0; }
        if(f.hs&&on&&!o.hsDone&&!((u.stunned||0)>0)&&!((u.fearT||0)>0)){ o.hsA=(o.hsA||0)+dt; while(o.hsA>=0.5-1e-9){ o.hsA-=0.5; A.stSet(T,u,'kwHs',stN(T,'kwHs')+1); } }
        o.chT=on?u._chaseT:0; o.chTg=on?u._chaseTg:null; }
      if(P.mtn){ const below=u.hp<0.40*u.maxHp, was=o.hpLo; o.hpLo=below;
        if(below&&was===false&&!(o.mtnCd>0)&&stN(T,'kwGrey')>0&&!winN(T,'kwMtn')){ A.acts(T,u,[{window:'kwMtn',dur:4}],c); o.mtnCd=34; } } },
    wv(A,T,u,c){ const o=S(T); T.s.api=A; o.chT=0; o.chTg=null; o.hsDone=true; o.ga=0; o.hpLo=undefined;
      if(T.P.mp&&o.ws!=null){ if(u.pass&&u.pass.warden) u.wardenStk=Math.max(u.wardenStk||0,o.ws); if(o.gs>0) A.stSet(T,u,'kwGrey',Math.floor(o.gs/2+1e-9)); } },
    full(A,T,u){ return adFull(u); },
    chasing(A,T,u){ return (u._chaseT||0)>0&&!!u._chaseTg&&u._chaseTg.alive; },
    lenLow(A,T){ return stN(T,'kwLen')<3; },
    crowd5(A,T,u){ return nearN(A,u,5)>=3; },
    far3(A,T,u,c){ const E=A.eng(); return !!c.tgt&&E.dist(u,c.tgt)>3*E.METER(); },   // Sweep Low: measured as Cleaving Arc measures its reach (centre to centre)
    atkG(A,T,u){ const P=T.P; return (P['atk.cg']||0)*stN(T,'kwGrey')+(P['atk.sh']&&adFull(u)?P['atk.sh']:0)+(P['atk.sr']||0)*stN(T,'kwSr'); },
    /* Sky-Warden Drill: every 3 s while Discipline is full, 0.3% of his max HP a rank (his only healing each second: under the game's 1.2% a second) */
    drill(A,T,u){ const r=rk(T,'gp_8_3'); if(r>0&&u.alive) A.eng().healUnit(u,Math.min(3*REGEN_CAP,0.003*r)*u.maxHp); },
    nmClamp(A,T,u,c){ if(c.amt>1) c.amt=1; },
    /* ---- EVERY STUN HE LANDS (skill or talent): the break rule's mark (until 0.5 s after it ends), Insult (and Wide Grin's first hit), the slam's Fault,
       Ringing Ears (his skills' stuns 0.06 s a rank longer; his talent stuns get it in tstun), Echo of the Fall (the slam), all cut at 4.0 s in all ---- */
    stunHit(A,T,u,c){ const t=c.tgt, P=T.P, o=S(T), E=A.eng(), now=E.now(); if(!t||!t.alive||t.team===u.team||!(c.amt>0)) return;
      const slam=T.s.cur===SL&&!c.talent;
      if(!c.talent){ let x=(P.re||0)+(slam?(P.echo||0):0); if(x>0&&(t.stunned||0)>0) t.stunned=Math.max(t.stunned,Math.min(STUN_TOP,t.stunned+x)); }
      A.setMark(T,u,t,'kwLk',{dur:(t.stunned||0)+0.5,longest:true});
      if(INS.some(id=>T.r[id])) T.fn.insult(A,T,u,t);
      if(slam&&FLT.some(id=>T.r[id])) A.setMark(T,u,t,'kwFlt',{dur:8+(P['flt.dur']||0),longest:true});
      if(slam&&o.sl) o.sl.push(t); },
    insult(A,T,u,t){ const now=A.eng().now(), had=mk(u,t,'kwIns',now); A.setMark(T,u,t,'kwIns',{dur:6+(T.P['ins.dur']||0),longest:true}); if(!had&&T.r.nf_6_4) A.setMark(T,u,t,'kwWg',{}); },
    /* ---- HEAVEN-SPLITTING SLAM: the enemies it stuns; Shake the Heavens knocks the lowest-health one 4 m away from him (the engine's own drag; an immovable
       one stays) and Hard Landing follows when it lands; Heaven's Mistake takes 0.2 s a rank off Phantom Step for each one stunned ---- */
    slamKit(A,T){ S(T).sl=[]; },
    slamCast(A,T,u,c){ const o=S(T), L=(o.sl||[]).filter((x,i,a)=>a.indexOf(x)===i); o.sl=null; if(!L.length) return;
      if(T.P.hm) u.blueCd=Math.max(0,(u.blueCd||0)-T.P.hm*L.length);
      if(T.P.sh){ let lo=null; for(const x of L) if(x.alive&&(!lo||x.hp<lo.hp)) lo=x; if(!lo) return;
        const kk={t:lo,x:lo.x,y:lo.y,sig:0,g:0,psk:false}; A.acts(T,u,[{push:'target',m:4,secs:0.35},{after:0.4,do:[{fn:'hlLand'}]}],Object.assign({},c,{tgt:lo,kk})); } },
    /* ---- PHANTOM STEP. psAt: he lands behind the mark (Behind You: 2 s; the skill's options kept for the signature). sigTgt: the signature's second blink goes to
       the same mark. kickPre: the kick is about to strike (where the mark stands, whether it is already Insulted, Landslide spends every Greystone). kickEnd:
       after the knock, the stun and the chase (Long Pursuit, Head Start starts, Landslide's longer stun, Hard Landing on the landing, the signature) ---- */
    psAt(A,T,u,c){ const o=S(T); o.psO=c.o; if(T.r.nf_7_4&&c.tgt) A.setMark(T,u,c.tgt,'kwBy',{dur:2}); },
    sigTgt(A,T,u,c){ const o=S(T); if(o.sigM){ if(o.sigM.alive){ c.tgt=o.sigM; o.k2=true; } o.sigM=null; } },
    kickPre(A,T,u,c){ const o=S(T), t=c.tgt, E=A.eng(); if(!t) return; const g=stN(T,'kwGrey');
      o.kk={t,x:t.x,y:t.y,ins:mk(u,t,'kwIns',E.now()),sig:o.k2?1:0,g,n:0,psk:true}; o.k2=false;
      if(T.P.ls&&g>0){ o.kk.n=g; A.stSet(T,u,'kwGrey',0); } },
    lsOut(A,T,u,c){ const o=S(T); if(o.kk&&o.kk.t===c.tgt&&o.kk.n>0) c.amt*=1+0.04*o.kk.n; },
    ssLand(A,T,u,c){ const t=c.tgt; if(!t) return; if(!t.alive){ u.blueCd=Math.max(0,(u.blueCd||0)-3); return; } A.setMark(T,u,t,'kwSs',{dur:3}); },
    sigStun(A,T,u,c){ const o=S(T), t=c.tgt; if(o.kk&&o.kk.sig&&t===o.kk.t&&((t.stunned||0)>0||mk(u,t,'kwLk',A.eng().now()))) c.amt=0; },
    kickEnd(A,T,u,c){ const o=S(T), t=c.tgt, P=T.P, E=A.eng(), kk=o.kk; o.kk=null; if(!kk||kk.t!==t||!t.alive) return;
      if(kk.n>0&&(t.stunned||0)>0) t.stunned=Math.max(t.stunned,Math.min(STUN_TOP,t.stunned+0.1*kk.n));          // Landslide: 0.1 s a Greystone spent
      if(P['ch.add']&&(u._chaseT||0)>0) u._chaseT+=P['ch.add'];                                                   // Long Pursuit
      o.hsDone=false; o.hsA=0;                                                                                     // Head Start: this chase gathers it
      if(HL.some(id=>T.r[id])) A.acts(T,u,[{after:0.35,do:[{fn:'hlLand'}]}],Object.assign({},c,{kk}));            // Hard Landing: the mark comes down 0.35 s later
      if(P.tda&&!kk.sig&&kk.ins&&!(o.tdaCd>0)&&o.psO&&u.alive){ o.tdaCd=20; o.sigM=t; u._blinkO=o.psO; u._blinkT=1e-4; } },   // Thrown Down Again: at once, again
    /* Hard Landing: the mark has come down (the kick's 0.35 s in the air): 1% of his attack a rank for each metre it flew (Down Hard: 4% a rank more on an Insulted
       one; Stone in Flight with Long Way Down: 6% more a Greystone he held at the kick; the signature's second kick: triple). Talent damage: the stated amount.
       Broken Ground slows it; Into the Crowd: each other enemy the flying mark passed within 1 m of (body to body) is stunned 0.5 s and takes the same; the
       signature's second kick: every enemy within 3 m of where it came down is stunned 1 s and Insulted */
    hlLand(A,T,u,c){ const kk=c.kk, P=T.P, E=A.eng(), M=E.METER(); if(!kk) return; const t=kk.t; if(!t||!t.alive||!u.alive) return;
      const m=Math.hypot(t.x-kk.x,t.y-kk.y)/M, now=E.now();
      const amt=x=>{ let d=(P['hl.k']||0)*atk(A,T,u)*m; if(d>0&&P['hl.ins']&&mk(u,x,'kwIns',now)) d*=1+P['hl.ins']; if(d>0&&kk.psk&&P['sf.hl']) d*=1+P['sf.hl']*(kk.g||0); if(kk.sig) d*=3; return d; };
      if(m>0.05){ const d=amt(t); if(d>0) A.hurt(T,u,t,d,'#c9b6ff','hardLanding');
        if(P['hl.slow']&&t.alive) A.acts(T,u,[{slow:P['hl.slow'],dur:2,on:'target'}],Object.assign({},c,{tgt:t}));
        if(P.itc&&kk.psk){ const hit=[]; for(const x of E.units()){ if(!x.alive||x===t||x.team===u.team) continue; if(segD(x,kk.x,kk.y,t.x,t.y)-E.bodyR(x)-E.bodyR(t)<M) hit.push(x); }
          tstun(A,T,u,hit,0.5); for(const x of hit){ const d=amt(x); if(d>0&&x.alive) A.hurt(T,u,x,d,'#c9b6ff','hardLanding'); } } }
      if(kk.sig){ const L=A.pick(T,u,{team:'enemy',of:'target',within:3},Object.assign({},c,{tgt:t})); tstun(A,T,u,L,1); if(INS.some(id=>T.r[id])) for(const x of L) if(x.alive) T.fn.insult(A,T,u,x); } },
    /* ---- HEAD START: gathered each 0.5 s of the chase (not while he is stunned or feared), spent whole by his first basic attack after the kick (1% more a
       rank per Head Start); after that this chase gathers no more ---- */
    hsSpend(A,T,u,c){ const o=S(T), n=stN(T,'kwHs'); if(c.proc) return; if(n>0||(u._chaseT||0)>0) o.hsDone=true; if(!(n>0)) return; A.stSet(T,u,'kwHs',0); if(T.P['hs.k']) c.amt*=1+T.P['hs.k']*n; },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP. Every talent of his that makes a hit on him smaller multiplies here (each takes its share of what is left), and
       together they never take more than 70% off a hit (DR_CAP). A Skid deals a third of the hit; Granite and the signature hold a hit at that share of his
       max HP; both inside the same cap. Adamant Discipline, his armour and magic resist come on top (the game's own) ---- */
    drK(A,T,u,src,amt,skid){ const P=T.P, E=A.eng(), now=E.now(), g=stN(T,'kwGrey'); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(P['dr.gs']) cut(P['dr.gs']*g);
      if(P['dr.sf']&&g>=3) cut(P['dr.sf']);
      if(P['dr.sp']&&src&&mk(u,src,'kwIns',now)) cut(P['dr.sp']);
      if(P['dr.uc']&&src&&mk(u,src,'kwFlt',now)) cut(P['dr.uc']);
      if(P['dr.we']&&nearN(A,u,3)>=2) cut(P['dr.we']);
      if(P['dr.ts']&&nearN(A,u,5)>=3) cut(P['dr.ts']);
      if(skid) k*=1/3;
      let cap=null; if(P.gr) cap=Math.max(0.03,0.12-(P['gr.hc']||0)); if(winN(T,'kwMtn')) cap=cap==null?0.06:Math.min(cap,0.06);
      if(cap!=null&&amt>0){ const lim=cap*(u.maxHp||0); if(amt*k>lim) k=lim/amt; }
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ const P=T.P, o=S(T), E=A.eng(), s=c.src; T.s.api=A; if(!s||s.team===u.team) return; let skid=false;
      if(P.skid>0&&!P.gr&&E.rnd()<P.skid) skid=true;
      c.amt*=T.fn.drK(A,T,u,s,c.amt,skid);
      if(skid){ if(P.grit) o.grit=1; if(P['sh.k']) A.stSet(T,u,'kwShd',stN(T,'kwShd')+1); if(P.gu&&u.alive) A.acts(T,u,[{heal:{pct:P.gu,of:'maxHp'},on:'self'}],c); } },
    gritOut(A,T,u,c){ const o=S(T); if(c.proc||!o.grit) return; o.grit=0; c.amt*=1+(T.P.grit||0); },
    /* ---- HIS CRITICAL CHANCE, ONE GROUP: Unimpressed (always: a stat), Behind You (the mark, 2 s after he lands behind it) and Clean Sweep (Cleaving Arc) as
       this hit's own seeded roll inside the room the stat left; together at most 5% (Phil: crit rate talents at most 5% per hero) ---- */
    critS(A,T){ return Math.min(CRIT_CAP,T.P['cr.un']||0); },
    crit(A,T,u,c){ const P=T.P, t=c.tgt, now=A.eng().now(); if(c.force) return; let p=0;
      if(P['cr.by']&&mk(u,t,'kwBy',now)) p+=P['cr.by']; if(P['cr.cs']&&T.s.cur===ARC) p+=P['cr.cs'];
      p=Math.min(p,Math.max(0,CRIT_CAP-T.fn.critS(A,T))); if(!(p>0)) return;
      const base=Math.min(0.95,(u.glyphCrit||0)+((u._critBuffT||0)>0?(u._critBuffPct||0):0)); if(A.eng().rnd()<p/Math.max(0.05,1-base)) c.force=true; },
    /* ---- CLEAVING ARC. arcKit (his one pass over its options, in this order): Grow's reach (0.2 m a Length), At His Word (70 degrees at 5 Length or more), Ruyi
       Touches the Sky (once every 20 s at full Length: 10 m, 90 degrees), Shale's shards spent. arcList: the enemies it will strike, measured as the skill
       measures them (centre to centre, the cone toward its target). arcHit: Swept, Four Hundred Times, the signature's Sweep and Laughter. arcCast: Grow
       (2 or more struck: 1 Length), Grown Strong ---- */
    arcKit(A,T,u,c){ const o=S(T), P=T.P, M=A.eng().METER(), n=stN(T,'kwLen'), x=c.o; o.ao=x; o.aL=null; o.ah=0; o.sky=false; o.shN=0;
      if(P['len.r']&&n>0) x.radius=(x.radius||3*M)+P['len.r']*n*M;
      if(P.ahw&&n>=5) x.angle=Math.max(x.angle||45,70);
      if(P.sky&&n>0&&n>=A.stMax(T,u,'kwLen')-1e-9&&!(o.skyCd>0)){ o.sky=true; o.skyCd=20; x.radius=10*M; x.angle=90; }
      if(P['sh.k']){ o.shN=stN(T,'kwShd'); if(o.shN>0) A.stSet(T,u,'kwShd',0); } },
    arcList(A,T,u){ const o=S(T); if(o.aL) return o.aL; const E=A.eng(), x=o.ao||{}, M=E.METER(), tg=(x._arrived&&x._tgtU)||u.target;
      const dir=tg?Math.atan2(tg.y-u.y,tg.x-u.x):(u.team==='ally'?0:Math.PI), R=x.radius||3*M, half=((x.angle||45)*Math.PI/180)/2, L=[];
      for(const e of E.units()){ if(!e.alive||e.team===u.team) continue; if(!(E.dist(u,e)<=R)) continue; let a=Math.atan2(e.y-u.y,e.x-u.x)-dir; while(a>Math.PI)a-=2*Math.PI; while(a<-Math.PI)a+=2*Math.PI; if(Math.abs(a)<=half) L.push(e); }
      o.aL=L; return L; },
    arcN(A,T,u){ return T.fn.arcList(A,T,u).length; },
    mostHp(A,T,u,c){ let b=null; for(const e of T.fn.arcList(A,T,u)) if(!b||e.hp>b.hp) b=e; return !!b&&b===c.tgt; },
    skyOn(A,T){ return !!S(T).sky; },
    arcHit(A,T,u,c){ const o=S(T), P=T.P, t=c.tgt; if(c.proc||!t) return; o.ah=(o.ah||0)+1; if(!t.alive) return;
      if(SW.some(id=>T.r[id])) A.setMark(T,u,t,'kwSw',{dur:o.sky?Math.max(6,3+(P['sw.dur']||0)):3+(P['sw.dur']||0),longest:true});
      if(P.fht) A.setMark(T,u,t,'kwFlt',{dur:2,longest:true});
      if(o.sky) A.stSet(T,u,'kwLg',stN(T,'kwLg')+1); },
    arcCast(A,T,u,c){ const o=S(T), P=T.P, n=o.ah||0;
      if(P['gs.h']&&n>0&&stN(T,'kwLen')>=A.stMax(T,u,'kwLen')-1e-9&&u.alive) A.acts(T,u,[{heal:{pct:P['gs.h']*n,of:'maxHp'},on:'self'}],c);
      if(n>=2&&LEN.some(id=>T.r[id])) A.stSet(T,u,'kwLen',stN(T,'kwLen')+1);
      o.ao=null; o.aL=null; o.ah=0; o.sky=false; o.shN=0; },
    shOut(A,T,u,c){ const o=S(T); if(o.shN>0) c.amt*=1+(T.P['sh.k']||0)*o.shN; },
    /* ---- THE MOUNTAIN COMES UP: its 4 s are over: every Greystone is spent, every enemy within 5 m is Faulted (its usual time) and stunned 0.2 s for each one
       (a talent stun: the break rule). The trigger (below 40% while he holds Greystone, not again until 30 s after it ends) is in tk ---- */
    mtnEnd(A,T,u,c){ const n=stN(T,'kwGrey'); A.stSet(T,u,'kwGrey',0); if(!(n>0)||!u.alive) return; const L=A.pick(T,u,{team:'enemy',within:5},c);
      for(const x of L) A.setMark(T,u,x,'kwFlt',{dur:8+(T.P['flt.dur']||0),longest:true}); tstun(A,T,u,L,0.2*n); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/33 - KONWU - talent decisions.md) */
  ruling:{}
};
