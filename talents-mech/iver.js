/* IVER - what his learned talents do in a fight (the mechanics; his 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Iver": what he added)
   His real kit (the code, not the tooltip wording; his skills read Attack and are physical, his passive's chain is magic):
   - Volt Pike ('piercethrow', green, cd 7): aims at the FARTHEST enemy and strikes every enemy whose centre is within 1.2 m of the line from him to it (and up
     to 24 px past it) for 150% of his attack x skill level. In 20 seeded fights: 1.39 enemies a cast (1: 83, 2: 40, 3: 5), never nobody. Nothing lies past
     the farthest enemy, so a longer line adds nobody (Thrown Far is made wider instead).
   - Thunder Guard ('thornguard', blue, cd 9): a shield of 18% of his max HP x skill level for 5 s, and for 5 s every hit an enemy lands on him is answered
     at once by a hit for his attack x the retaliation share (0.6 x skill level, at most 85%) - "the retaliation" (it runs while u._ctring is set).
   - Skybreak (ultimate 'aoeStun' + HERO_ULT_ART.iver: deliver 'land', on energy - no cooldown): lands 0.55 s after the cast on its centre (the aim, else his
     target); every enemy within 4.26 m of that centre (centre to centre) takes 140% of his attack x skill level and a stun through ccApply: the table's
     area stun 2.0 s x 0.7 = 1.4 s. The card line "stuns every enemy in the area for 2 seconds" is the table number before the cut.
   - Static Charge (passive 'staticcharge'): each SWING builds 1 Charge (max 5); at 5 it is ready, and the next Green or Blue PRESS (castKit, not the
     ultimate) discharges it: 55% of (his ability power, or his attack when he has none) x passive strength, magic, to the first 3 living enemies in the
     field's own order (anywhere). He has a little ability power (60 at level 100), so a chain hit is about 0.30 x his attack. 34 discharges in 20 fights.
   Strikes, Overcharge (renamed Overfull), Ground, the Rod, Lit and the Thunderhead exist only through his talents.
   Readings, caps and corrected tooltips: WIRING/30 - IVER - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const PK='piercethrow', TG='thornguard', SB='aoeStun', CHN=['staticcharge','scFork'];
const DR_FLOOR=0.65;                      // his damage-reduction talents together never take more than 35% off a hit (one capped group: see drK)
const SIG_DR=0.40;                        // Somewhere to Go: 40% less on top of the group, for its 5 s
const CRIT_CAP=0.05;                      // his critical-chance talents together never give more than 5% (Ozone included)
const REGEN=0.012;                        // his talent heals (Overflowing, Earthed) together at most 1.2% of his max HP for each second (the game's regeneration cap)
const STUN_GAP=0.5;                       // the stun-lock rule: no talent stun on an enemy that is stunned, or within 0.5 s after one of his stuns on it ended
const STUN_PER=2;                         //   and a repeating talent stuns each enemy at most twice per cast
const SB_MUL=1.4;                         // Skybreak's own number (ULT_DEF.aoeStun.mul): the Skybreaks his signatures call down
/* the families whose bookkeeping runs when any of their talents is learned */
const CH=['ts_1_4','ts_2_2','ts_3_1','ts_4_2','ts_9_3','ts_11_1','ts_12_3','ts_12_4','lr_3_1','lr_12_3','sf_12_3'];          // his own Charge count (past five, extra Charge, the threshold)
const STR=['ts_1_1','ts_2_1','ts_3_1','ts_4_1','ts_6_1','ts_12_2','ts_9_4','ts_13_2'];                                     // Strikes
const DIS=CH.concat(STR,['ts_11_4','ts_6_4','ts_2_4','ts_3_3','ts_3_4','ts_5_2','ts_5_4','ts_n1','ts_7_2','ts_7_4','ts_9_2','ts_10_1','ts_10_4','ts_11_2']);   // the discharge and its chain
const STN=['ts_7_4','lr_9_3','ts_13_2','sf_7_2','sf_13_2'];                                                                // his talent stuns (the stun-lock rule)
const LIT=['sf_1_1','sf_2_1','sf_3_1','sf_4_1','sf_6_1','sf_10_1','sf_7_1','sf_7_2','sf_9_2','sf_9_4','sf_12_1','sf_11_1'];   // Lit
const TH=['sf_1_4','sf_2_4','sf_5_4','sf_6_4','sf_7_4','sf_9_4','sf_10_4','sf_12_4','sf_13_2'];                            // the Thunderhead
const PKF=LIT.concat(['ts_4_2','ts_7_2','ts_9_2','sf_11_2','sf_12_2','sf_13_2','sf_4_2','sf_5_3']);                        // Volt Pike's cast (who it pierced)
const SBF=TH.concat(['ts_5_2','ts_6_2','sf_7_2','sf_9_2','sf_9_3','sf_9_4']);                                              // Skybreak's cast
const GR=['lr_1_4','lr_2_4','lr_5_4','lr_6_4','lr_7_4','lr_9_4'];                                                          // Ground (Earth the Bolt)
const TGF=GR.concat(['ts_9_3','lr_9_3']);                                                                                   // Thunder Guard's cast and end
const ROD=['lr_1_1','lr_2_1','lr_n1','lr_3_1','lr_5_2','lr_6_1','lr_11_2','lr_12_1','lr_12_2'];                            // the Rod
const DRG=['ts_11_4','ts_4_1','ts_3_3','ts_10_4','lr_10_1','lr_2_1','lr_3_3','lr_7_1','lr_11_4','lr_6_3','sf_11_4','sf_6_4','sf_12_1','lr_13_2'];   // ONE capped group
const CRT=['ts_4_3','ts_6_1','sf_9_3','sf_7_1'];                                                                            // ONE crit group
/* ---- helpers ---- */
const learned=(T,L)=>L.some(id=>T.r[id]);
const hpf=x=>x&&x.maxHp>0?x.hp/x.maxHp:0;
const foes=(A,T,u)=>A.pick(T,u,{team:'enemy'},{});
const tgOn=u=>(u._thornT||0)>0;
const strikes=T=>T.s.ivSt||0;
function skillHits(T,f){ const d=T.s.d; T.s.d=0; try{ return f(); } finally{ T.s.d=d; } }   // a skill's own hits run from inside a row are his hits (out / hit rows see them)
/* his Charge: the game's own count, or his talents' own (past five) when one of them is learned */
const chg=(T,u)=>learned(T,CH)?(T.s.ivC||0):(u._scStk||0);
const chMax=T=>5+(T.P['ch.max']||0);
const thr=T=>(T.P.a7&&strikes(T)>=7)?4:5;
function chSync(T,u){ const c=T.s.ivC||0; u._scStk=c; if(c>=thr(T)) u._scReady=1; }
function chAdd(T,u,n){ if(!(n>0)) return; T.s.ivC=Math.min(chMax(T),(T.s.ivC||0)+n); chSync(T,u); }
/* the Charge above five a chain counts (Twelve Counted: at 12 Strikes as if he held 8) */
const above=(T)=>(T.P.tw&&strikes(T)>=12)?3:Math.max(0,(T.s.ivDc||0)-5);
/* his talent heals share the game's regeneration cap: a budget of 1.2% of his max HP for each second, kept for at most 10 s */
function budHeal(A,T,u,x){ const s=T.s, E=A.eng(), now=E.now(), cap=REGEN*(u.maxHp||0); if(s.rgAt==null) s.rgAt=0;
  s.rgV=Math.min(10*cap,(s.rgV||0)+cap*Math.max(0,now-s.rgAt)); s.rgAt=now; const g=Math.min(x,s.rgV); if(g>0){ s.rgV-=g; E.healUnit(u,g); } return g; }
/* his talent stuns, at their full written length (no resist roll): never on an enemy stunned now, nor within 0.5 s after one of his stuns on it ended
   (mark 'iv_lk', kept by the ccHit row below for every stun of his); a repeating talent (key) stuns each enemy at most twice per cast */
function tstun(A,T,u,L,secs,key){ const out=[]; if(!(secs>0)) return out; const s=T.s, K=key?((s.ivSk||(s.ivSk={}))[key]||(s.ivSk[key]={})):null;
  for(const t of L){ if(!t||!t.alive||t.team===u.team) continue; if((t.stunned||0)>0||A.markOf(u,t,'iv_lk')) continue; if(K&&(K[t.uid]||0)>=STUN_PER) continue;
    A.control(T,u,t,'stunned',secs); const E=A.eng(), cap=E.ccCap('stunned')||2.8, top=cap/(E.ccDur(1)||1);   // the full written time: past the skills' 2.8 s ceiling, at most the uncut 4.0 s
    if(secs>cap&&(t.stunned||0)>=cap-1e-9) t.stunned=Math.max(t.stunned,Math.min(secs,top));
    if((t.stunned||0)>0){ out.push(t); if(K) K[t.uid]=(K[t.uid]||0)+1; } }
  return out; }
/* a chain of Static Charge run by a talent (the page's own chain lines, bound as scChain), as the skill part `name` */
function chainRun(A,T,u,list,name){ const s=T.s, E=A.eng(); if(!E.scChain||!list.length) return 0; (s.lc||(s.lc=[])).push(s.cur); s.cur=name;
  try{ A.run(T,u,'landPre',{u,src:u,tgt:null,skill:name}); return skillHits(T,()=>E.scChain(u,list)); } finally{ s.cur=s.lc.length?s.lc.pop():null; A.run(T,u,'land',{u,src:u,tgt:null,skill:name}); } }
const firstN=(A,T,u,n,skip)=>foes(A,T,u).filter(x=>x!==skip).slice(0,n);
const nearOf=(A,T,u,x,n)=>{ const E=A.eng(); return foes(A,T,u).filter(y=>y!==x).map(y=>[y,E.dist(x,y)]).sort((a,b)=>a[1]-b[1]).slice(0,n).map(e=>e[0]); };
/* Skybreak's damage as his ultimate deals it now (his attack, a running damage buff, the ultimate's level, the fight's rage): his signatures' Skybreaks */
function sbRaw(A,T,u){ const E=A.eng(), lv=(u.skillLv&&u.skillLv[0])||1; return (u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*(E.skillMul?E.skillMul(lv):1)*SB_MUL*E.rage(); }
const litDur=T=>4+(T.P['lit.dur']||0);
const isLit=(A,u,x)=>!!(x&&x.alive&&A.markOf(u,x,'iv_lit'));
module.exports={
  hero:'iver',
  casting:true,                         // rows ask which of his skills a hit comes from (Volt Pike, Skybreak, the chain)
  points:true,                          // Skyward Spear reads where Skybreak lands (the at hook)
  states:{
    iv_str:{max:12},                                                           // Strikes, for the bonuses (the count past 12 is T.s.ivSt)
    iv_gr:{max:P('gr.max',10)},                                                // Ground (Deep Earth: more)
    iv_th:{max:6,wave:'reset'},                                                // the Thunderhead's steps
    iv_lf:{max:3,dur:4},                                                       // Looking Forward
    iv_lw:{max:99,wave:'reset'},                                               // Long Watch for Storms: enemies pierced this wave
    iv_sft:{max:99,wave:'reset'}                                               // Struck for Them: abilities drawn this wave
  },
  always:[
    {on:'pass',skill:'scSwing',reqAny:CH,do:[{fn:'chSwing'}]},                                                    // his own Charge count: each swing 1
    {on:'num',skill:'scGo',reqAny:['ts_5_2'],do:[{fn:'scGo'}]},                                                  // Hold It In: the press does not discharge
    {on:'num',skill:'scN',reqAny:DIS,do:[{fn:'scN'}]},                                                            // the discharge: what it holds, how far the chain reaches
    {on:'landPre',skill:'staticcharge',reqAny:DIS,do:[{fn:'disPre'}]},
    {on:'out',reqAny:['ts_3_4'],if:{casting:CHN},do:[{fn:'chainIdx'}]},                                           // Bright Arc: the enemies after the first
    {on:'land',skill:'staticcharge',reqAny:DIS,do:[{fn:'disPost'}]},                                              // after the chain: Strikes, Echo, the riders
    {on:'landPre',skill:'scFork',reqAny:['ts_3_4'],do:[{fn:'disPre'}]},
    {on:'ccHit',reqAny:STN,if:{cc:['stunned'],targetTeam:'enemy'},do:[{fn:'lock'}]},                              // the stun-lock rule: every stun of his
    {on:'kit',skill:PK,reqAny:PKF,do:[{fn:'pkKit'}]}, {on:'hit',reqAny:PKF,if:{casting:PK,targetTeam:'enemy'},do:[{fn:'pkHit'}]}, {on:'cast',skill:PK,reqAny:PKF,do:[{fn:'pkCast'}]},
    {on:'kit',skill:SB,reqAny:SBF,do:[{fn:'sbKit'}]}, {on:'cast',skill:SB,reqAny:SBF,do:[{fn:'sbCast'}]},
    {on:'cast',skill:TG,reqAny:TGF,do:[{fn:'tgCast'}]}, {on:'tick',reqAny:GR,do:[{fn:'tgTick'}]},
    {on:'hurt',reqAny:GR.concat(['lr_13_2']),do:[{fn:'grHit'}]},                                                  // Ground: hits he takes while Thunder Guard is up
    {on:'hit',reqAny:['sf_1_1','sf_13_2'],if:{targetTeam:'enemy',targetHas:'iv_lit'},do:[{fn:'arc'}]},            // Lit: his hits on a Lit enemy arc to another
    {on:'tick',reqAny:TH,period:P('th.per',4),do:[{stack:'iv_th',add:1}]},                                        // the Thunderhead: a step every 4 s (Storm Front: sooner)
    {on:'teamIn',reqAny:ROD,if:{targetTeam:'ally',fn:'rodCan'},chance:{flat:1,x:{fn:'rodP'}},do:[{fn:'rodDraw'}]},   // the Rod (the fight's seeded stream)
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]}, {on:'dotIn',reqAny:DRG,do:[{fn:'myDrDot'}]},                          // his damage-reduction talents: ONE capped group (35%)
    {on:'crit',reqAny:CRT,chance:{flat:1,x:{fn:'critP'}},force:true}                                              // his critical-chance talents: ONE group, at most 5%
  ],
  talents:{
    /* ============================== THE TWELFTH STRIKE ============================== */
    ts_1_1:[ {stat:{atk:R(0.003)},per:'iv_str'} ],                                                              // Struck Once (Strikes: disPost)
    ts_11_4:[ {param:'dr.cu',add:R(0.004)} ],                                                                   // Copper Skin (drK)
    ts_1_4:[ {param:'ch.max',add:3}, {on:'out',if:{casting:CHN},more:R(0.04),per:{fn:'above'}} ],              // Overfull (renamed from Overcharge)
    ts_2_1:[ {stat:{aspd:R(0.02)},if:{stackMin:{iv_str:4}}} ],                                                  // White at the Fourth
    ts_2_2:[ {on:'pass',skill:'scSwing',chance:R(0.04),do:[{fn:'chPlus',by:1}]} ],                              // Quick Charge
    ts_4_3:[ {param:'crit.oz',add:R(0.015)} ],                                                                  // Ozone (critP)
    ts_2_4:[ {param:'hc',add:R(1)} ],                                                                           // Held Current (scN)
    ts_3_1:[ {param:'a7',add:1} ],                                                                              // After the Seventh (thr)
    ts_4_2:[ {param:'cpk',add:R(1)} ],                                                                          // Charged Pike (pkCast)
    ts_3_3:[ {param:'dr.sw',add:R(0.02)}, {on:'hit',if:{casting:CHN,targetTeam:'enemy'},do:[{mark:'iv_sw',on:'target',dur:3}]} ],   // Storm-Worn
    ts_3_4:[ {on:'out',if:{casting:CHN,fn:'notFirst'},more:R(0.02)} ],                                          // Bright Arc
    ts_4_1:[ {param:'dr.str',add:R(0.002)} ],                                                                   // Eleven Times (drK)
    ts_5_2:[ {param:'hii',add:1} ],                                                                             // Hold It In (PICK ONE: scGo, sbKit)
    ts_5_3:[ {on:'hit',if:{auto:true,targetTeam:'enemy'},do:[{fn:'letGo'}]} ],                                  // Let It Go (PICK ONE)
    ts_5_4:[ {param:'ovf',add:R(0.01)} ],                                                                       // Overflowing (disPost)
    ts_n1:[ {param:'tc',add:R(0.01)} ],                                                                         // Thunder Coat (disPost)
    ts_12_3:[ {on:'pass',skill:'scSwing',once:'wave',do:[{fn:'chPlus',by:R(2,-1)}]} ],                          // Live Wire: the first swing of a wave builds 2 x rank
    ts_10_3:[ {on:'out',if:{casting:PK},more:R(0.04)} ],                                                        // Grounding Spear
    ts_6_1:[ {param:'crit.ow',add:R(0.002)} ],                                                                  // Owed (critP)
    ts_6_2:[ {on:'kit',skill:SB,req:'ts_5_2',opt:{mul:{more:R(0.03)}}} ],                                       // Gathering Sky (under Hold It In)
    ts_6_3:[ {on:'out',if:{casting:'scBasic'},more:R(0.06)} ],                                                  // Crackling Spear (under Let It Go)
    ts_6_4:[ {stat:{move:R(0.03)},if:{fn:'ch5'}} ],                                                             // Static Hair
    ts_7_1:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ],                                       // Rod Taken Down
    ts_7_2:[ {param:'fork',add:1} ],                                                                            // Forked Pike (disPost, pkCast)
    ts_7_4:[ {param:'air',add:R(0.06)}, {on:'hit',if:{casting:CHN,targetTeam:'enemy'},do:[{fn:'airStun'}]} ],   // Charged Air
    ts_9_2:[ {on:'out',if:{casting:'scFork'},more:R(0.03)} ],                                                   // Every Line Lit
    ts_9_3:[ {param:'brc',add:R(1)}, {on:'hit',if:{fn:'retal'},do:[{fn:'brace'}]} ],                            // Bracing Charge
    ts_9_4:[ {param:'tw',add:1} ],                                                                              // Twelve Counted (above)
    ts_10_1:[ {param:'ss',add:R(0.2)} ],                                                                        // Storm Season (disPost)
    ts_10_4:[ {param:'dr.ag',add:R(0.015)} ],                                                                   // Afterglow (disPost, drK)
    ts_11_1:[ {on:'wave',do:[{fn:'quiet'}]} ],                                                                  // Quiet Weeks
    ts_11_2:[ {stat:{aspd:R(0.01)},per:'iv_lf'} ],                                                              // Looking Forward (disPost)
    ts_12_1:[ {on:'out',if:{fn:'tgtMost'},more:R(0.03)} ],                                                      // Signed For
    ts_12_2:[ {on:'out',if:{casting:CHN,stackMin:{iv_str:11}},more:R(0.03)} ],                                  // Eleventh Hour
    ts_12_4:[ {param:'echo',add:R(1)} ],                                                                        // Charge Echo (disPost)
    ts_13_2:[ {param:'owe',add:1} ],                                                                            // The Twelfth Is Owed (SIGNATURE: strike)
    /* ============================== LIGHTNING ROD ============================== */
    lr_1_1:[ {param:'rod',add:R(0.06)} ],                                                                       // Tallest Thing (the Rod: rodP)
    lr_10_1:[ {param:'dr.hgw',add:R(0.02)} ],                                                                   // Hair Gone White (drK)
    lr_1_4:[ {param:'eb',add:R(0.03)} ],                                                                        // Earth the Bolt (Ground: tgTick)
    lr_2_1:[ {param:'dr.steel',add:R(0.04)} ],                                                                  // Steel Rod (drK, drawn hits)
    lr_n1:[ {on:'iv_drawn',do:[{window:'iv_cb',dur:3},{fn:'countedBolt'}]}, {on:'out',if:{window:'iv_cb',targetTeam:'enemy'},more:0.03} ],   // Counted Bolt (LINK)
    lr_2_4:[ {param:'gr.max',add:R(2)} ],                                                                       // Deep Earth
    lr_3_1:[ {on:'iv_drawn',do:[{fn:'chPlus',by:2}]} ],                                                         // Copper Rod
    lr_3_2:[ {on:'ccIn',less:R(0.04)} ],                                                                        // Weatherproof (20% at 5/5)
    lr_3_3:[ {param:'dr.oil',add:R(0.015)} ],                                                                   // Oilskin (drK)
    lr_2_3:[ {on:'kit',skill:TG,opt:{pct:{more:R(0.03)}}} ],                                                    // Brace
    lr_4_2:[ {on:'teamIn',if:{targetTeam:'ally',fn:'ally4'},less:R(0.015)} ],                                   // Old Warden
    lr_4_4:[ {on:'kit',skill:TG,opt:{thorn:{more:R(0.04)}}} ],                                                  // Shocked Hands
    lr_7_1:[ {param:'dr.far',add:R(0.02)} ],                                                                    // Weathered (drK)
    lr_5_2:[ {param:'dts',add:1} ],                                                                             // Draw the Storm (PICK ONE: rodP, rodCan)
    lr_5_3:[ {on:'cast',skill:TG,do:[{fn:'tower'}]} ],                                                          // Hold the Tower (PICK ONE)
    lr_5_4:[ {param:'eh',add:R(0.01)} ],                                                                        // Earthed (tgTick)
    lr_6_1:[ {on:'iv_drawn',do:[{shield:{pct:R(0.02),of:'maxHp'},dur:3,on:'self'}]} ],                          // Bolt Taken
    lr_6_2:[ {on:'teamIn',req:'lr_5_2',if:{targetTeam:'ally',fn:'ally2'},less:R(0.02)} ],                       // Close Cover (under Draw the Storm)
    lr_6_3:[ {param:'dr.ring',add:R(0.03)}, {on:'teamIn',req:'lr_5_3',if:{targetTeam:'ally',srcHas:'iv_tnt'},less:R(0.03)} ],   // Ring of Thunder (under Hold the Tower)
    lr_6_4:[ {param:'sfl',add:R(0.05)} ],                                                                       // Static Floor (tgTick)
    lr_7_2:[ {on:'cast',skill:TG,do:[{fn:'stormwall'}]} ],                                                      // Stormwall
    lr_7_4:[ {param:'gt',add:R(0.03)} ],                                                                        // Ground Thunder (renamed from Thunderclap; tgTick, sigEnd)
    lr_8_1:[ {on:'hurt',if:{srcTeam:'enemy'},do:[{mark:'iv_ll',on:'source',dur:3}]}, {on:'out',if:{targetHas:'iv_ll'},more:R(0.02)} ],   // Lightning Lines
    lr_8_3:[ {on:'out',if:{auto:true,targetTeam:'enemy'},more:R(0.02)} ],                                       // Iron Spear
    lr_9_2:[ {param:'swc',add:R(0.04)} ],                                                                       // Shared Cover (stormwall)
    lr_9_3:[ {on:'hit',if:{fn:'retal'},chance:R(0.04),do:[{fn:'answer'}]} ],                                    // Answering Strike (the fight's seeded stream)
    lr_9_4:[ {param:'olg',add:1} ],                                                                             // Overloaded Ground (tgTick)
    lr_10_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                             // Guard Up
    lr_10_4:[ {on:'kit',skill:TG,opt:{dur:{add:R(0.2)}}} ],                                                     // Grounded
    lr_11_1:[ {on:'teamLethal',once:'wave',if:{fn:'unit4'},do:[{fn:'post'}]} ],                                 // Father's Post
    lr_11_2:[ {on:'iv_drawn',do:[{stack:'iv_sft',add:1}]}, {stat:{atk:0.01},per:{fn:'sftN'}} ],                 // Struck for Them (at most 10%)
    lr_11_4:[ {param:'dr.ss',add:R(0.01)} ],                                                                    // Storm Skin (drK)
    lr_12_1:[ {on:'iv_drawn',do:[{mark:'iv_sold',on:'source'}]}, {on:'out',if:{targetHas:'iv_sold'},more:R(0.03)} ],   // The Rod Sold
    lr_12_2:[ {param:'esc',add:R(0.02)} ],                                                                      // Every Storm Comes Here (rodP)
    lr_12_3:[ {on:'hurt',if:{srcTeam:'enemy'},chance:R(0.10),do:[{fn:'chPlus',by:1}]} ],                        // Charged Skin (the fight's seeded stream)
    lr_12_4:[ {param:'pf',add:R(0.25)}, {on:'moved',if:{fn:'isMe'},do:[{fn:'plant'}]} ],                        // Planted Feet
    lr_13_2:[ {on:'tick',edge:true,if:{selfHpBelow:0.40},do:[{fn:'sigGo'}]},                                    // Somewhere to Go (SIGNATURE)
              {on:'teamIn',if:{window:'iv_sig',targetTeam:'ally',fn:'ally6'},do:[{fn:'sigDraw'}]},
              {on:'end:iv_sig',do:[{fn:'sigEnd'}]} ],
    /* ============================== STORMFRONT ============================== */
    sf_1_1:[ {param:'arc',add:R(0.06)} ],                                                                       // Lit End to End (Lit: pkHit; the arcs: below)
    sf_11_4:[ {param:'dr.rain',add:R(0.015)} ],                                                                 // Rainproof (drK)
    sf_1_4:[ {param:'th.dmg',add:R(0.04)} ],                                                                    // Gathering Cloud (sbKit)
    sf_2_1:[ {param:'lit.dur',add:R(0.5)} ],                                                                    // Long Light
    sf_2_2:[ {on:'out',if:{casting:PK},more:R(0.03)} ],                                                         // Straight Line
    sf_2_4:[ {stat:{aspd:R(0.005)},per:'iv_th'} ],                                                              // Heavy Sky
    sf_3_1:[ {param:'cj',add:1} ],                                                                              // Current Jumps (arc)
    sf_n1:[ {on:'hit',if:{casting:PK,targetTeam:'enemy'},do:[{slow:R(0.04),dur:2,on:'target'}]} ],              // Wet Ground
    sf_3_4:[ {on:'kit',skill:SB,opt:{radius:{more:R(0.03)}}} ],                                                 // Low Cloud
    sf_4_1:[ {on:'out',if:{targetHas:'iv_lit'},more:R(0.02)} ],                                                 // Bright Line
    sf_4_2:[ {param:'pk.w',add:R(0.2)} ],                                                                       // Thrown Far (wider: pkKit)
    sf_4_3:[ {stat:{move:R(0.03)}} ],                                                                           // Charged Step
    sf_10_3:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                            // Weather Eye
    sf_9_3:[ {param:'crit.hr',add:R(0.03)} ],                                                                   // Hard Rain (sbCast, critP)
    sf_5_4:[ {param:'th.per',add:R(-0.4)} ],                                                                    // Storm Front
    sf_6_1:[ {param:'arcM',add:R(0.04)} ],                                                                      // Arc Flash (arc)
    sf_10_1:[ {stat:{atk:R(0.005)},per:{units:{team:'enemy',has:'iv_lit'},max:5}} ],                            // Conductor (at most 5 Lit enemies)
    sf_6_4:[ {param:'dr.rb',add:R(0.005)} ],                                                                    // Rain Before (drK)
    sf_7_1:[ {param:'crit.ls',add:R(0.01)} ],                                                                   // Lit Spear (critP)
    sf_7_2:[ {param:'sky',add:1}, {on:'at',skill:SB,do:[{fn:'skyward'}]} ],                                     // Skyward Spear
    sf_7_4:[ {on:'out',if:{auto:true,targetTeam:'enemy',stackMin:{iv_th:6}},more:R(0.02)} ],                    // Black Cloud
    sf_9_4:[ {param:'cb',add:1}, {on:'ccHit',if:{casting:SB,cc:['stunned'],talent:false,targetTeam:'enemy'},do:[{fn:'cloudLit'}]} ],   // Cloudburst
    sf_5_2:[ {on:'cd',skill:'green',add:-2} ],                                                                  // Pike and Return (PICK ONE)
    sf_9_2:[ {param:'els',add:R(0.03)} ],                                                                       // Every Light Struck (skyward)
    sf_5_3:[ {on:'hit',if:{casting:PK,targetTeam:'enemy'},do:[{mark:'iv_root',on:'target',dur:1}]}, {stat:{move:-1},to:{team:'enemy',has:'iv_root'}} ],   // Pinned by Lightning (PICK ONE)
    sf_12_1:[ {param:'dr.lfw',add:R(0.02)}, {on:'teamIn',if:{targetTeam:'ally',srcHas:'iv_lit'},less:R(0.02)} ],   // Lit From Within (on him: drK; on his allies)
    sf_6_2:[ {on:'cast',skill:PK,req:'sf_5_2',do:[{window:'iv_rt',dur:3}]}, {stat:{aspd:R(0.01)},req:'sf_5_2',if:{window:'iv_rt'}} ],   // Rapid Throws (under Pike and Return)
    sf_6_3:[ {on:'out',req:'sf_5_3',if:{targetHas:'iv_root'},more:R(0.03)} ],                                   // Held in Light (under Pinned by Lightning)
    sf_10_4:[ {param:'th.keep',add:R(1)} ],                                                                     // Thunder Rolls (sbCast)
    sf_11_1:[ {on:'death',if:{fn:'litDead'},do:[{fn:'relit'}]} ],                                               // Appointment Kept
    sf_11_2:[ {stat:{atk:1},per:{fn:'lwK'}} ],                                                                  // Long Watch for Storms (pkHit; at most 10%)
    sf_12_2:[ {on:'out',if:{casting:PK},more:R(0.01),per:{fn:'pkN'}} ],                                         // Line of Storms (up to 5 enemies)
    sf_12_3:[ {on:'cast',skill:PK,do:[{fn:'chPlus',by:R(1)}]} ],                                                // Charged Throw
    sf_12_4:[ {on:'wave',do:[{stack:'iv_th',add:R(1)}]} ],                                                      // Still Days
    sf_13_2:[ {param:'cloud',add:1} ]                                                                           // The Cloud Answers (SIGNATURE: pkKit, pkCast)
  },
  fn:{
    /* ---- small conditions and counts ---- */
    ch5(A,T,u){ return chg(T,u)>=5; },
    above(A,T){ return above(T); },
    notFirst(A,T){ return (T.s.ivCi||0)>1; },
    chainIdx(A,T){ T.s.ivCi=(T.s.ivCi||0)+1; },
    retal(A,T,u,c){ return u._ctring===1&&!!c.tgt&&c.tgt.team!==u.team; },          // a hit of Thunder Guard's retaliation (the page sets _ctring while it answers)
    tgtMost(A,T,u,c){ const t=c.tgt; if(!t||t.team===u.team||!t.alive) return false; for(const x of foes(A,T,u)) if(x!==t&&x.hp>t.hp) return false; return true; },
    ally4(A,T,u,c){ const x=c.tgt; return !!x&&x!==u&&!x._summon&&!!c.src&&c.src.team!==u.team&&u.alive&&A.gap(u,x)<4*A.eng().METER(); },
    ally2(A,T,u,c){ const x=c.tgt; return !!x&&x!==u&&!x._summon&&!!c.src&&c.src.team!==u.team&&u.alive&&A.gap(u,x)<2*A.eng().METER(); },
    ally6(A,T,u,c){ const x=c.tgt; return !!x&&x!==u&&!x._summon&&!!c.src&&c.src.team!==u.team&&u.alive&&(c.amt||0)>0&&A.gap(u,x)<6*A.eng().METER(); },
    unit4(A,T,u,c){ const x=c.unit; return !!x&&x!==u&&!x._summon&&x.team===u.team&&u.alive&&A.gap(u,x)<4*A.eng().METER(); },
    isMe(A,T,u,c){ return c.unit===u; },
    sftN(A,T){ return Math.min(10,A.stGet(T,'iv_sft')*(T.r.lr_11_2||0)); },        // Struck for Them: 1% x rank a draw, at most 10% in all
    lwK(A,T){ return Math.min(0.10,0.004*(T.r.sf_11_2||0)*A.stGet(T,'iv_lw')); },  // Long Watch: 0.4% x rank a pierced enemy, at most 10% in all
    pkN(A,T){ return Math.min(5,T.s.pkN||0); },
    litDead(A,T,u,c){ const x=c.unit; return !!x&&x.team!==u.team&&!!A.markOf(u,x,'iv_lit'); },
    /* ---- HIS CHARGE. With a Charge talent learned he keeps his own count (T.s.ivC): each swing 1 (the game's own +1, past five up to Overfull's 8), the extra
       Charge of his talents; it is written back on the game's own fields, and the chain is ready at 5 (After the Seventh: 4 at 7 Strikes) ---- */
    chSwing(A,T,u){ chAdd(T,u,1); },
    chPlus(A,T,u,c,a){ if(learned(T,CH)) chAdd(T,u,A.amtOf(T,u,a.by,c)); },
    quiet(A,T,u){ if((T.s.ivC||0)<3){ T.s.ivC=3; chSync(T,u); } },
    /* ---- THE DISCHARGE (castKit's chain, at the press of a Green or Blue): scGo (Hold It In keeps it for Skybreak), scN (the Charge it held, the chain's reach),
       landPre / land around the chain (casting 'staticcharge'), then the Strike and the riders ---- */
    scGo(A,T,u,c){ c.amt=0; },
    scN(A,T,u,c){ const s=T.s; s.ivDc=learned(T,CH)?(s.ivC||0):Math.max(5,u._scStk||5); s.ivPress=(c.unit&&u.greenAb&&c.unit===u.greenAb)?'green':'blue'; c.amt=T.fn.reach(A,T,u,c.amt); },
    reach(A,T,u,base){ return base+Math.min(T.P.hc||0,above(T)); },               // Held Current: 1 more enemy for each Charge above five, up to 1 per rank
    disPre(A,T){ const s=T.s; s.ivCi=0; s.ivDid=(s.ivDid||0)+(s.cur==='staticcharge'?1:0); },
    disPost(A,T,u,c){ const s=T.s, Pp=T.P, E=A.eng(), dc=s.ivDc||5, ab=Math.max(0,dc-5), ov=above(T);
      if(learned(T,CH)){ s.ivC=Math.min(Pp.echo||0,dc); u._scStk=s.ivC; }           // Charge Echo keeps 1 per rank
      if(learned(T,STR)) T.fn.strike(A,T,u,'dis');
      if(Pp.ss) A.acts(T,u,[{after:0,do:[{cd:'green',add:-Pp.ss}]}],c);             // Storm Season: after the press has set its own cooldown
      if(Pp['dr.ag']) A.acts(T,u,[{window:'iv_ag',dur:3}],c);
      if(T.r.ts_11_2) A.stSet(T,u,'iv_lf',A.stGet(T,'iv_lf')+1);
      if(Pp.tc) A.acts(T,u,[{shield:{pct:Pp.tc,of:'maxHp'},dur:3,on:'self'}],c);
      if(Pp.ovf&&ov>0) budHeal(A,T,u,Pp.ovf*ov*u.maxHp);
      if(Pp.fork&&s.ivPress==='green'){ s.ivFk=E.now(); s.ivFkN=T.fn.reach(A,T,u,3); }
      s.ivDc=0; void ab; },
    /* Hold It In: Skybreak takes the discharge (its kit, at its landing): the chain reaches 5 enemies (Held Current: more) */
    disHold(A,T,u,c){ const s=T.s; if(!u._scReady) return; u._scReady=0; u._scStk=0; s.ivDc=learned(T,CH)?(s.ivC||0):5; s.ivPress='ult';
      chainRun(A,T,u,firstN(A,T,u,T.fn.reach(A,T,u,5)),'staticcharge'); },
    /* Let It Go: at a full charge his next basic attack also chains to 2 enemies (the 2 nearest to its target), once per charge-up */
    letGo(A,T,u,c){ const s=T.s; if(!u._scReady){ s.ivLG=0; return; } if(s.ivLG) return; s.ivLG=1; chainRun(A,T,u,nearOf(A,T,u,c.tgt,2),'scBasic'); },
    /* ---- STRIKES: each discharge 1, at most 12 a fight (The Twelfth Is Owed: counted on, the bonuses still stop at 12; each 6th calls Skybreak down, each 12th
       at three times its damage with a 3 s stun) ---- */
    strike(A,T,u){ const s=T.s; let n=s.ivSt||0; if(n>=12&&!T.P.owe) return; n++; s.ivSt=n; A.stSet(T,u,'iv_str',Math.min(12,n));
      if(T.P.owe&&n%6===0) T.fn.sbFall(A,T,u,n%12===0?3:1,n%12===0?3:1.5,'owe'+n);
      if(learned(T,CH)) chSync(T,u); },
    /* Counted Bolt (LINK, with Struck Once): an ability the Rod catches counts as a Strike, at most once every 4 s and 3 times a wave, never the 12th nor one that calls Skybreak down */
    countedBolt(A,T,u){ const s=T.s, E=A.eng(); if(!T.r.ts_1_1) return; if(E.now()<(s.cbAt||0)) return; if(s.cbW!==s.wave){ s.cbW=s.wave; s.cbN=0; } if(s.cbN>=3) return;
      const n=(s.ivSt||0)+1; if(n===12||n>12&&!T.P.owe||(T.P.owe&&n%6===0)) return; s.cbAt=E.now()+4; s.cbN++; T.fn.strike(A,T,u); },
    /* a Skybreak at once on the enemy with the most HP (stunned, the stun-lock rule), and half of it on every other enemy; through their armor */
    sbFall(A,T,u,mult,stun,key){ const E=A.eng(), L=foes(A,T,u); if(!L.length) return; let m=L[0]; for(const x of L) if(x.hp>m.hp) m=x; const raw=sbRaw(A,T,u)*mult;
      A.hurt(T,u,m,raw*E.defMul(u,m,'phys'),'#8fd0ff','owed'); tstun(A,T,u,[m],stun,key);
      for(const x of L) if(x!==m&&x.alive) A.hurt(T,u,x,0.5*raw*E.defMul(u,x,'phys'),'#8fd0ff','owed'); },
    /* ---- the stun-lock rule: each stun of his (his skills' and his talents') locks that enemy until 0.5 s after it ends ---- */
    lock(A,T,u,c){ const t=c.tgt; if(!t||!t.alive) return; A.setMark(T,u,t,'iv_lk',{dur:(t.stunned||0)+STUN_GAP,longest:true}); },
    airStun(A,T,u,c){ tstun(A,T,u,[c.tgt],T.P.air||0,'air'+(T.s.ivDid||0)); },
    answer(A,T,u,c){ tstun(A,T,u,[c.tgt],0.5,'ans'+(T.s.tgId||0)); },
    /* ---- VOLT PIKE: kit (Thrown Far's width, how many enemies its line holds, Forked Pike's charge, The Cloud Answers), each enemy it pierces (Lit, Long Watch),
       its end (Charged Pike, Forked Pike's chains, The Cloud Answers) ---- */
    pkKit(A,T,u,c){ const s=T.s, Pp=T.P, E=A.eng(), o=c.o, M=E.METER(); s.pk=[]; if(!o) return;
      if(Pp['pk.w']) o.width=(o.width||34*1.15)+Pp['pk.w']*M;
      const F=foes(A,T,u); let tg=null, td=-1; for(const x of F){ const d=E.dist(u,x); if(d>td){ td=d; tg=x; } } let n=0;
      if(tg){ const dx=tg.x-u.x, dy=tg.y-u.y, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, W=o.width||34*1.15; for(const x of F){ const rx=x.x-u.x, ry=x.y-u.y, pr=rx*ux+ry*uy; if(pr<-12||pr>L+24) continue; if(Math.abs(rx*uy-ry*ux)<=W) n++; } }
      s.pkN=n; s.pkFk=(Pp.fork&&s.ivFk!=null&&E.now()-s.ivFk<1.5)?1:0; s.ivFk=null;
      s.pkCa=(Pp.cloud&&A.stGet(T,'iv_th')>=6&&!(E.now()<(s.caCd||0)))?1:0; },
    pkHit(A,T,u,c){ const s=T.s, t=c.tgt; if(!t) return; if(s.pk&&s.pk.indexOf(t)<0) s.pk.push(t);
      if(learned(T,LIT)) A.setMark(T,u,t,'iv_lit',{dur:litDur(T),longest:true});
      if(T.r.sf_11_2) A.stSet(T,u,'iv_lw',A.stGet(T,'iv_lw')+1); },
    pkCast(A,T,u,c){ const s=T.s, Pp=T.P, E=A.eng(), L=(s.pk||[]).slice(); s.pk=[];
      if(Pp.cpk&&L.length) T.fn.chPlus(A,T,u,c,{by:Math.min(L.length,Pp.cpk)});
      if(s.pkFk){ s.pkFk=0; for(const e of L.slice(1)) if(e.alive) chainRun(A,T,u,nearOf(A,T,u,e,s.ivFkN||3),'scFork'); }
      if(s.pkCa){ s.pkCa=0; s.caCd=E.now()+25; const raw=sbRaw(A,T,u);
        for(const e of L){ if(!e.alive) continue; A.hurt(T,u,e,raw*E.defMul(u,e,'phys'),'#8fd0ff','cloud'); tstun(A,T,u,[e],1.5,'ca'+E.now());
          if(e.alive){ A.setMark(T,u,e,'iv_lit',{dur:Math.max(6,litDur(T)),longest:true}); A.setMark(T,u,e,'iv_litS',{dur:6,longest:true}); } } } },
    /* ---- LIT: his hits on a Lit enemy arc to the nearest other Lit enemy for 6% x rank of the hit (Arc Flash: more); Current Jumps: on to a third; an enemy the
       Cloud Answers lit arcs at 30% even without Lit End to End ---- */
    arc(A,T,u,c){ const t=c.tgt, E=A.eng(); if(!t||!(c.amt>0)) return; let k=T.P.arc||0; if(!k&&A.markOf(u,t,'iv_litS')) k=0.30; if(!(k>0)) return;
      const a=c.amt*k*(1+(T.P.arcM||0)), L=foes(A,T,u).filter(x=>x!==t&&isLit(A,u,x)).sort((p,q)=>E.dist(t,p)-E.dist(t,q)); const b=L[0]; if(!b) return;
      A.hurt(T,u,b,a,'#9fd8ff','arc');
      if(T.P.cj){ const n=L.filter(x=>x!==b&&x.alive).sort((p,q)=>E.dist(b,p)-E.dist(b,q))[0]; if(n) A.hurt(T,u,n,a,'#9fd8ff','arc'); } },
    relit(A,T,u,c){ for(const x of foes(A,T,u)) if(x!==c.unit&&isLit(A,u,x)) A.setMark(T,u,x,'iv_lit',{dur:litDur(T),longest:true}); },
    cloudLit(A,T,u,c){ if(T.s.sbCb&&c.tgt&&c.tgt.alive) A.setMark(T,u,c.tgt,'iv_lit',{dur:litDur(T),longest:true}); },
    /* ---- SKYBREAK at its landing: the Thunderhead's steps (Gathering Cloud), Hold It In's discharge, Skyward Spear, Cloudburst; its end spends the steps ---- */
    sbKit(A,T,u,c){ const s=T.s, Pp=T.P, o=c.o; const st=A.stGet(T,'iv_th'); s.sbSt=st;
      if(o&&Pp['th.dmg']&&st>0) o.mul=(o.mul||1.2)*(1+Pp['th.dmg']*st);
      s.sbCb=(Pp.cb&&st>=6)?1:0;
      if(Pp.hii) T.fn.disHold(A,T,u,c);
      s.sky=0; if(o&&Pp.sky&&foes(A,T,u).some(x=>isLit(A,u,x))){ s.sky=1; o.radius=-1; } },
    skyward(A,T,u,c){ const s=T.s, E=A.eng(); if(!s.sky) return; const raw=(c.raw||0)*0.40*(1+(T.P.els||0)), L=foes(A,T,u).filter(x=>isLit(A,u,x)), key='sky'+E.now();
      for(const x of L){ A.hurt(T,u,x,raw*E.defMul(u,x,'phys'),'#6ea8ff','sky'); if(x.alive) tstun(A,T,u,[x],0.7,key); if(x.alive&&s.sbCb) A.setMark(T,u,x,'iv_lit',{dur:litDur(T),longest:true}); } },
    sbCast(A,T,u,c){ const s=T.s, Pp=T.P; if(learned(T,TH)){ const st=A.stGet(T,'iv_th'); A.stSet(T,u,'iv_th',Math.min(st,Pp['th.keep']||0)); }
      if(Pp['crit.hr']) A.acts(T,u,[{window:'iv_hr',dur:4}],c); s.sky=0; s.sbCb=0; },
    /* ---- THUNDER GUARD: its cast (a new guard: Ground from 0, Bracing Charge's count, Answering Strike's stun count); Ground from each hit he takes while it is up;
       when it ends, the Ground discharges into every enemy within 3 m (Earth the Bolt, Ground Thunder, Static Floor, Earthed, Overloaded Ground) ---- */
    tgCast(A,T,u){ const s=T.s; s.tgOn=1; s.tgId=(s.tgId||0)+1; s.brN=0; if(learned(T,GR)) A.stSet(T,u,'iv_gr',0); },
    grHit(A,T,u){ const s=T.s; if(A.winOn(T,'iv_sig')){ s.ivSg=Math.min(A.stMax(T,u,'iv_gr'),(s.ivSg||0)+1); return; } if(learned(T,GR)&&tgOn(u)) A.stSet(T,u,'iv_gr',A.stGet(T,'iv_gr')+1); },
    tgTick(A,T,u,c){ const s=T.s; if(!s.tgOn||tgOn(u)) return; s.tgOn=0; const g=A.stGet(T,'iv_gr'); A.stSet(T,u,'iv_gr',0); if(!(g>0)) return;
      T.fn.ground(A,T,u,c,g,3,T.P.eb||0); const Pp=T.P;
      if(Pp.eh&&g>=3) budHeal(A,T,u,Pp.eh*Math.floor(g/3+1e-9)*u.maxHp);
      if(Pp.olg&&g>=10) u.blueCd=Math.max(0,(u.blueCd||0)*0.5); },
    ground(A,T,u,c,g,m,per){ const Pp=T.P, E=A.eng(), L=A.pick(T,u,{team:'enemy',within:m},c), a=per*g*A.amtOf(T,u,{pct:1,of:'atk'},c)*(1+(Pp.gt||0));
      for(const x of L){ if(a>0) A.hurt(T,u,x,a,'#8fd0ff','ground'); if(Pp.sfl&&x.alive) A.acts(T,u,[{slow:Pp.sfl,dur:2,on:'target'}],Object.assign({},c,{tgt:x})); } void E; },
    brace(A,T,u,c){ const s=T.s; if((s.brN||0)>=(T.P.brc||0)) return; s.brN=(s.brN||0)+1; T.fn.chPlus(A,T,u,c,{by:1}); },
    /* Hold the Tower: when Thunder Guard starts, every enemy within 3 m is taunted onto him for 1.5 s (Ring of Thunder reads the mark) */
    tower(A,T,u,c){ for(const x of A.pick(T,u,{team:'enemy',within:3},c)){ x.forcedTarget=u; x.forcedTargetT=Math.max(x.forcedTargetT||0,1.5); A.setMark(T,u,x,'iv_tnt',{dur:1.5}); } },
    /* Stormwall: the most wounded ally within 4 m gets half the shield Thunder Guard gives him (Shared Cover: 4% per rank stronger), the larger staying */
    stormwall(A,T,u,c){ const L=A.pick(T,u,{team:'ally',within:4,others:true},c); let b=null; for(const x of L) if(!b||hpf(x)<hpf(b)) b=x; if(!b) return;
      const o=c.o||{}, x=u.maxHp*(o.pct||0.18)*(u._castSM||1)*0.5*(1+(T.P.swc||0)), d=o.dur||5; b.shield=Math.max(b.shield||0,x); b.shieldT=Math.max(b.shieldT||0,d); },
    /* ---- THE ROD: an enemy's single-target ability (not a basic attack, not an area skill: the page's _talAim says whom it was aimed at, at this moment), aimed at an
       ally within 4 m of him (Draw the Storm: 2 m), strikes him instead by a seeded chance: Tallest Thing 6% per rank (Draw the Storm: doubled), Every Storm Comes Here
       2% per rank more above 50% HP; 70% with all of them. The hit is his: his armor or magic resist in place of the ally's, his damage-reduction group (Steel Rod), his shield ---- */
    rodCan(A,T,u,c){ const s=c.src, t=c.tgt, E=A.eng(); if(!u.alive||!s||s.team===u.team||!t||t===u||t._summon||c.auto||!(c.amt>0)) return false;
      const a=s._talAim; if(!a||a.t!==t||a.at!==E.now()||a.area) return false; return A.gap(u,t)<(T.P.dts?2:4)*E.METER(); },
    rodP(A,T,u){ const Pp=T.P; let p=(Pp.rod||0)*(Pp.dts?2:1); if(u.hp>0.5*u.maxHp) p+=Pp.esc||0; return Math.min(1,p); },   // at most 70% with every Rod talent (30% doubled + 10%)
    rodDraw(A,T,u,c){ T.fn.moveHit(A,T,u,c,true); A.run(T,u,'iv_drawn',{u,src:c.src,tgt:c.tgt,unit:c.tgt}); },
    /* a hit on an ally moved onto him: the ally takes nothing; he takes it with his own armor / magic resist (in place of the ally's), his group, his shield and skill slot */
    moveHit(A,T,u,c,drawn){ const E=A.eng(), s=c.src, t=c.tgt, k=c.kind, a=c.amt||0; c.amt=0; c.mv=0; if(!(a>0)||!u.alive) return;   // c.mv=0: moved onto him, not reduced (the 95% ceiling leaves the ally at 0)
      const m0=E.defMul(s,t,k)*(E.elemMul?E.elemMul(s,t):1), m1=E.defMul(s,u,k)*(E.elemMul?E.elemMul(s,u):1); let x=(m0>0?a/m0:a)*m1;   // his armor or magic resist and his element in place of the ally's
      x*=T.fn.drK(A,T,u,{src:s,kind:k,auto:c.auto,crit:c.crit,drawn},false);
      if(x>0){ E.damage(u,x,'#8fd0ff',false); T.fn.grHit(A,T,u); } },
    /* Father's Post: an ally within 4 m would die - the Rod draws the killing blow onto him (the ally gets back what it took; he takes it through his group). Once a wave */
    post(A,T,u,c){ const x=c.unit, a=c.amt||0; if(!x||!(a>0)) return; x.hp=Math.min(x.maxHp,x.hp+a); if(x.hp<1) x.hp=1;
      const k=T.fn.drK(A,T,u,{src:null,kind:'phys',auto:false,crit:false},false); A.eng().damage(u,a*k,'#8fd0ff',false); },
    /* ---- SOMEWHERE TO GO (SIGNATURE): once every 25 s, when he drops below 40% HP, for 5 s every enemy hit on an ally within 6 m strikes him instead, he takes 40% less
       (on top of his group), and every hit he takes is Ground (at most his Ground cap) that discharges into every enemy within 4 m when it ends ---- */
    sigGo(A,T,u,c){ const s=T.s, E=A.eng(); if(E.now()<(s.sigCd||0)) return; s.sigCd=E.now()+25; s.ivSg=0; A.acts(T,u,[{window:'iv_sig',dur:5}],c); },
    sigDraw(A,T,u,c){ T.fn.moveHit(A,T,u,c,false); },
    sigEnd(A,T,u,c){ const s=T.s, g=s.ivSg||0; s.ivSg=0; if(g>0) T.fn.ground(A,T,u,c,g,4,Math.max(T.P.eb||0,0.09)); },
    /* Planted Feet: a push, knock or pull moves him 25% less per rank (75% at 3/3) */
    plant(A,T,u,c){ const k=Math.min(0.75,T.P.pf||0), f=c.from; if(!(k>0)||!f) return;
      if(c.kind==='knock'){ u.x=f.x+(u.x-f.x)*(1-k); u.y=f.y+(u.y-f.y)*(1-k); u._ax=u.x; u._ay=u.y; }
      else if(c.kind==='pull'&&(u.pullSpeed||0)>0) u.pullSpeed*=(1-k); },
    /* ---- his damage-reduction talents: ONE group. Each multiplies (Phil's combining rule); together they never take more than 35% off a hit or a DoT tick.
       Somewhere to Go's 40% is a window on top of it ---- */
    drK(A,T,u,c,dot){ const Pp=T.P, s=c.src, E=A.eng(); let k=1; const f=x=>{ if(x>0) k*=1-Math.min(0.95,x); };
      if(Pp['dr.cu']) f(Pp['dr.cu']*Math.min(5,chg(T,u)));                              // Copper Skin: per Charge, up to 5
      if(Pp['dr.str']) f(Pp['dr.str']*Math.min(12,strikes(T)));                         // Eleven Times: per Strike
      if(Pp['dr.ag']&&A.winOn(T,'iv_ag')) f(Pp['dr.ag']);                                // Afterglow: 3 s after a discharge
      if(Pp['dr.hgw']&&u.hp<0.5*u.maxHp) f(Pp['dr.hgw']);                                // Hair Gone White: below 50% HP
      if(Pp['dr.ss']&&tgOn(u)) f(Pp['dr.ss']);                                           // Storm Skin: while Thunder Guard is up
      if(Pp['dr.rb']) f(Pp['dr.rb']*A.stGet(T,'iv_th'));                                 // Rain Before: per Thunderhead step
      if(Pp['dr.steel']&&c.drawn) f(Pp['dr.steel']);                                     // Steel Rod: an ability the Rod drew
      if(!dot&&!c.auto){ if(Pp['dr.oil']) f(Pp['dr.oil']); if(Pp['dr.rain']) f(Pp['dr.rain']); }   // Oilskin, Rainproof: from abilities
      if(s&&s.team!==u.team){
        if(Pp['dr.sw']&&A.markOf(u,s,'iv_sw')) f(Pp['dr.sw']);                           // Storm-Worn: an enemy his chain struck in the last 3 s
        if(Pp['dr.far']&&A.gap(u,s)>4*E.METER()) f(Pp['dr.far']);                       // Weathered: more than 4 m away
        if(Pp['dr.ring']&&A.markOf(u,s,'iv_tnt')) f(Pp['dr.ring']);                      // Ring of Thunder: taunted by Hold the Tower
        if(Pp['dr.lfw']&&A.markOf(u,s,'iv_lit')) f(Pp['dr.lfw']); }                      // Lit From Within: a Lit enemy
      k=Math.max(DR_FLOOR,k);
      if(A.winOn(T,'iv_sig')) k*=1-SIG_DR;                                               // Somewhere to Go
      return k; },
    myDr(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c,false); },
    myDrDot(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c,true); },
    /* ---- his critical-chance talents: Ozone, Owed (per Strike), Hard Rain (4 s after Skybreak), Lit Spear (a Lit target): together at most 5% (an extra roll) ---- */
    critP(A,T,u,c){ const Pp=T.P; let x=Pp['crit.oz']||0; if(Pp['crit.ow']) x+=Pp['crit.ow']*Math.min(12,strikes(T)); if(Pp['crit.hr']&&A.winOn(T,'iv_hr')) x+=Pp['crit.hr'];
      if(Pp['crit.ls']&&c.tgt&&A.markOf(u,c.tgt,'iv_lit')) x+=Pp['crit.ls']; return Math.max(0,Math.min(CRIT_CAP,x)); }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/30 - IVER - talent decisions.md) */
  ruling:{}
};
