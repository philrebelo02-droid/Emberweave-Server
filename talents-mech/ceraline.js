/* CERALINE - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Ceraline": what she added)
   Her real kit (the code, not the tooltip wording; she is a Mage: her skills read Ability Power, her hits are magic):
   - Sealing Wax ('sealwax', green, cd 7): pours on the enemy with the HIGHEST ATTACK (the 'skillTgt' hook may choose another): 110% of her ability power,
     a slow of 2 s (x 0.7 = 1.4 s, its strength by her skill level) and a coat (_waxCoatT 6 s, _waxCoatBy = her). The wax sets 2.0 s later (the
     target's own timer _sealT, not cut): then it is stunned through ccApply. The control table makes that stun 3.5 s (single target), x 0.7 = 2.45 s.
     The setting is the part 'sealset' (partPre / part around its ccApply).
   - Mourning Bell ('nova', blue, cd 9, delivered: it forms on the densest group, 8 m centre to centre): FIRST every coat of hers on the field bursts
     (each: 80% of her ability power to every enemy within 2.6 m of the coated enemy, centre to centre; the coat is gone): each burst is the part
     'bellBurst'. Then the ring: 100% of her ability power to every enemy within 8 m of its centre ('at' hook: 'pt:nova').
   - Living Tallow (passive 'tallow', the page's waxOnCaster): EVERY enemy of hers that casts (a Green, Blue or ultimate, anywhere on the field)
     gains a wax (_wax; all of it lapses _waxT = 4 s after the last); at 3 it is ENCASED: stunned and silenced for 1 s + 0.015 s a passive level,
     x 0.7 (0.7 s at level 1, 1.74 s at 100), written straight on (no ccApply: no resist, no cap). Hooks 'wax' and 'encase' (hero file wax:true).
   - Court of the Final Candle (ultimate 'finalcandle'; ULT_DEF radius 7 m, slow 3, stun 1.5, shatter 1.5, coat 6, 200%; HERO_ULT_ART.ceraline only
     adds a delivery): wax is poured on a point and spreads to 7 m (centre to centre; 'at' hook: 'pt:finalcandle'). As the edge reaches each enemy:
     its coat and a slow (table 3.0 s x 0.7 = 2.1 s): the part 'fcWax'; then its STATUE: a stun through ccApply (table 2.0 s x 0.7 = 1.4 s): the part
     'fcEnc'; 1.5 s later its effigy bursts: 200% of her ability power to it, then it is coated again: the part 'fcBurst'. No root.
   - Every unit carrying her coat or Living Tallow wax receives 30% less healing (WAX_HEAL_CUT): "waxed" in her trees = that, or the signature's
     8 s mark (fn waxed).
   Guest of Honour, Courses, Scald, Candles and Warm Wax exist only through her talents.
   Readings, caps and corrected tooltips: WIRING/20 - CERALINE - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const SW='sealwax', MB='nova', FC='finalcandle', BELL=[MB,'bellBurst'], ABIL=[SW,MB,'bellBurst',FC,'fcBurst'];
const VS_ALLY={srcTeam:'enemy',targetTeam:'ally'};                                  // an enemy's hit on one of her allies (teamIn: never herself)
const IN_CL={srcTeam:'enemy',targetTeam:'ally',targetWithin:P('cl.r',6)};           // ... on an ally within Candlelight (6 m, Lamplit Hall farther)
/* the states several talents read: their bookkeeping runs when any of these is learned */
const GUEST=['gl_1_1','gl_2_1','gl_3_1','gl_7_1','gl_10_1','gl_10_4','gl_11_1'];
const AWAY=['gl_2_2','gl_6_2','gl_9_2','gl_4_2'];
const COURSE=['nc_1_1','nc_2_1','nc_3_1','nc_4_1','nc_8_1','nc_9_1','nc_10_1','nc_12_1','nc_6_1','nc_n1','nc_13_3'];
const SCALD=['nc_1_4','nc_12_3'];
const CAND=['ho_1_1','ho_2_1','ho_3_1','ho_4_1','ho_5_1','ho_6_2','ho_9_1','ho_10_1','ho_12_1','ho_12_4','ho_13_2','nc_n1'];
const WW=['ho_1_4','ho_12_2','ho_13_2'];
const STATUE=['gl_3_1','gl_8_1','gl_10_3','gl_12_2','gl_13_2','nc_12_3'];
const SEAL=['gl_3_4','ho_5_3','ho_9_3'];
const TEN=['gl_3_3','ho_7_1','ho_9_4'];
/* "Mourning Bell deals more": its ring and its coat bursts (the engine's, while 'casting' is the Bell), and the bursts her talents set off ('dmg:burst') */
const BELLMORE=(cond,more)=>[{on:'out',if:Object.assign({casting:BELL},cond),more},{on:'dmg:burst',if:cond,more}];
/* ---- helpers ---- */
const M_=A=>A.eng().METER();
const foes=(A,T,u)=>A.pick(T,u,{team:'enemy'},{});
const coated=(u,x)=>!!x&&(x._waxCoatT||0)>0&&x._waxCoatBy===u;
/* waxed: her coat, Living Tallow wax, or the 8 s of Nobody Leaves Early */
function waxed(A,u,x){ return !!x&&x.alive&&x.team!==u.team&&(coated(u,x)||((x._wax||0)>0&&(x._waxT||0)>0)||!!A.markOf(u,x,'nle')); }
/* Scald: a coat of hers (with Hot Wax), and Runny Wax's time after it; Effigy Fire: a statue of her ultimate */
function scalding(A,T,u,x){ if(!x) return false; const E=A.eng(), sc=T.s.sc||{};
  if((T.P.scald||0)>0&&(coated(u,x)||(sc[x.uid]!=null&&E.now()<sc[x.uid]))) return true; return (T.P.effigy||0)>0&&!!A.markOf(u,x,'fce'); }
/* Scald's damage a second on x: 2% of her ability power per rank of Hot Wax (Effigy Fire on a statue: a third of that per rank, Hot Wax at least at rank 1) */
function scaldPs(A,T,u,x){ const E=A.eng(), ap=(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1), sc=T.s.sc||{}; let k=0;
  if((T.P.scald||0)>0&&(coated(u,x)||(sc[x.uid]!=null&&E.now()<sc[x.uid]))) k+=T.P.scald;
  if((T.P.effigy||0)>0&&A.markOf(u,x,'fce')) k+=Math.max(0.02,T.P.scald||0)*T.P.effigy;
  if(!(k>0)) return 0; if(x.hp<0.5*x.maxHp) k*=1+(T.P['scald.low']||0); return ap*k; }
/* magic damage of her talent on x: the target's magic resist applies, Wax Burns ignores a share of it */
function magicDmg(A,T,u,x,amt,tag){ const E=A.eng(), ig=Math.min(1,T.P['scald.mr']||0), sv=x.mrRating; if(ig>0) x.mrRating=(sv||0)*(1-ig);
  let d; try{ d=amt*E.defMul(u,x,'magic'); } finally{ x.mrRating=sv; } return A.hurt(T,u,x,d,'#ffb070',tag); }
/* Warm Wax on an ally: the mark carries its strength (1 = full; Shared Table's second ally a share); Tallow Shell's shield at that share */
function giveWW(A,T,u,x,dur,share){ if(!x||!x.alive) return; const m0=A.markOf(u,x,'ww'), v0=m0?m0.v:0; A.setMark(T,u,x,'ww',{dur,longest:true}); const m=A.markOf(u,x,'ww'); if(m) m.v=Math.max(v0||0,share);
  if(T.P['ww.sh']){ const sh=(u.apow||0)*T.P['ww.sh']*share*(1+(T.P['ww.shm']||0)); if(sh>0){ x.shield=(x.shield||0)+sh; x.shieldT=Math.max(x.shieldT||0,dur); } } }
/* a stun on t made longer after it landed, in full: cut at the stun ceiling without the 30% cut (4.0 s) */
function ext(A,t,by){ const E=A.eng(); if(!t||!t.alive||!((t.stunned||0)>0)||!(by>0)) return; const top=(E.ccCap('stunned')||2.8)/(E.ccDur(1)||1); t.stunned=Math.max(t.stunned,Math.min(top,t.stunned+by)); }
/* a coat of hers bursts by her talents (Boiling Over, The Last Course), like Mourning Bell's: 80% of her ability power at her Blue skill level to every enemy within
   2.6 m of it (Wide Bell: 3.6 m), centre to centre, magic; the coat is gone. Rows 'dmg:burst' change its damage */
function burstCoat(A,T,u,m,c){ if(!coated(u,m)) return; const E=A.eng(), lv=(u.skillLv&&u.skillLv[2])||1, ap=(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*(E.skillMul?E.skillMul(lv):1)*0.8*(E.rage?E.rage():1);
  const bm=T.s.bm; T.s.bm=m; try{ A.acts(T,u,[{dmg:ap,on:{team:'enemy',of:'unit',within:2.6+(T.P['burst.r']||0),centre:true},tag:'burst',def:'magic',color:'#e8d8b0'}],Object.assign({},c,{unit:m,tgt:m})); }
  finally{ T.s.bm=bm; } m._waxCoatT=0; m._waxCoatBy=null; afterCoat(A,T,u,m); }
/* a coat of hers ended early (burst): its Scald runs on for Runny Wax's time only */
function afterCoat(A,T,u,m){ const s=T.s.sc||(T.s.sc={}), E=A.eng(); if(T.s.fl&&T.s.fl[m.uid]===E.now()){ s[m.uid]=E.now(); return; } s[m.uid]=E.now()+(T.P.runny||0); }
function selfShield(A,T,u,pct,dur){ const x=(u.maxHp||0)*pct*(1+(T.P['sh.me']||0)); if(x>0){ u.shield=(u.shield||0)+x; u.shieldT=Math.max(u.shieldT||0,dur); } }
module.exports={
  hero:'ceraline',
  drCap:0.40, allyDrCap:0.25,           // v1452 (lockdown audit T28): her talent reductions together at most 40% off a hit on her, 25% on an ally (her page names no cap: Joss's sustain tree, Mellan's ally cap)
  casting:true,                         // rows ask which of her skills (or which part of one) a hit, a slow or a stun comes from
  points:true,                          // rows read where Mourning Bell rings and where the Final Candle is poured (the 'at' hook)
  wax:true,                             // the Living Tallow hooks: each wax and each encase of her passive
  states:{
    cand:{max:P('cand.max',3)},                                                    // black candles (kept for the wave: the 'candWave' always row; Black Candles keeps them)
    feast:{max:6,wave:'reset'}                                                     // Feast Day: Courses rung this wave
  },
  needs:{ ho_8_2:'ho_7_2', ho_11_3:'ho_7_2', nc_6_4:'nc_1_4' },                    // Second Bell, Waxen Mercy improve Guests' Bell; Runny Wax improves Scald
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share */
  always:[
    {on:'skillAt',skill:SW,reqAny:GUEST,once:'wave',do:[{mark:'guest',on:'target',unique:true}]},              // Guest of Honour: the first enemy Sealing Wax pours on each wave
    {on:'tick',reqAny:AWAY,period:0.1,do:[{fn:'nlScan'}]},                                                      // waxed enemies moving away from her (mark 'nl')
    {on:'tick',reqAny:['gl_4_2','gl_9_2'],period:0.1,do:[{fn:'dashWatch'}]},                                   // their dashes and leaps
    {on:'kit',skill:MB,reqAny:COURSE,do:[{fn:'course'}]},                                                       // the Course this Mourning Bell rings
    {on:'tick',reqAny:SCALD,period:1,do:[{fn:'scald'}]},                                                        // Scald, each second
    {on:'part',skill:'bellBurst',reqAny:SCALD,do:[{fn:'burstEnd'}]},                                            //   a burst coat ends its Scald (Runny Wax: a little later)
    {on:'partPre',skill:'bellBurst',reqAny:['nc_5_3','nc_7_2'],do:[{fn:'bm'}]},                                // the coat bursting (Deep Bell, Wax Fountain)
    {on:'ccHit',reqAny:STATUE,if:{casting:'fcEnc',cc:['stunned']},do:[{emit:'statue'}]},                        // a statue of her ultimate formed
    {on:'ccHit',reqAny:SEAL,if:{casting:'sealset',cc:['stunned']},do:[{emit:'sealed'}]},                        // Sealing Wax's seal set (its stun landed)
    {on:'encased',reqAny:['gl_8_1'],do:[{mark:'enc',on:'target',dur:{flat:1,pct:1,of:'hit'},while:'stunned'}]},   // encased (Rigid Manners)
    {on:'statue',reqAny:['gl_8_1'],do:[{mark:'enc',on:'target',dur:{flat:1,pct:1,of:'hit'},while:'stunned'}]},
    {on:'wave',reqAny:CAND,do:[{fn:'candWave'}]},                                                               // candles: out at a wave's start (Black Candles: kept), Candle Stub
    {on:'in',reqAny:WW,if:{targetHas:'ww'},less:1,per:{fn:'wwk'}},                                              // Warm Wax: its strength on her
    {on:'teamIn',reqAny:WW,if:Object.assign({targetHas:'ww'},VS_ALLY),less:1,per:{fn:'wwk'}},                   //   and on an ally
    {on:'ccIn',reqAny:TEN,do:[{fn:'ten'}]},                                                                     // shorter controls on her, with their cap
    {on:'teamCc',reqAny:['ho_7_1','ho_9_4'],if:{who:'ally'},do:[{fn:'tenAlly'}]}                                //   and on her allies
  ],
  talents:{
    /* ============================== THE GUEST LIST ============================== */
    gl_1_1:[ {on:'out',if:{targetHas:'guest'},more:R(0.02)} ],                                                   // Guest of Honour: takes more damage from her
    gl_2_4:[ {on:'ccHit',if:{casting:SW,cc:['slow'],talent:false},do:[{slowMore:R(0.05),on:'target'}]} ],       // Slow Pour: the hardening slow, stronger
    gl_1_4:[ {on:'encase',add:R(0.1)} ],                                                                        // Thick Tallow
    gl_2_1:[ {stat:{move:R(-0.04)},to:'holder:guest'} ],                                                        // Head of the Table
    gl_2_2:[ {stat:{move:R(-0.03)},to:{team:'enemy',has:'nl'}} ],                                               // Nobody Leaves
    gl_3_1:[ {on:'encase',if:{targetHas:'guest'},add:0.5}, {on:'statue',if:{targetHas:'guest'},do:[{fn:'ext',by:0.5}]} ],   // Seated Guest
    gl_3_3:[ {param:'ten.me',add:R(0.04)} ],                                                                    // Composure (the 'ten' always row; up to 20%)
    gl_3_4:[ {on:'sealed',do:[{fn:'ext',by:R(0.06)}]} ],                                                        // Hard Set: in full, after the stun landed
    gl_4_1:[ {on:'kit',skill:SW,opt:{coat:{add:R(0.4)}}}, {on:'kit',skill:FC,opt:{coat:{add:R(0.4)}}} ],        // Long Evening: Sealing Wax's coat, the Final Candle's
    gl_4_2:[ {param:'hat',add:R(1/3)} ],                                                                        // Held at Table (dashWatch)
    gl_4_3:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',fn:'tWaxed'}} ],                                            // Tight Coat
    gl_8_1:[ {on:'teamIn',if:{targetTeam:'enemy',srcIs:'ally',targetHas:'enc'},more:R(0.04)} ],                 // Rigid Manners
    gl_9_1:[ {on:'hurt',if:{srcMelee:true,auto:true},by:'source',icd:[8,7,6],do:[{fn:'waxOn',on:'source'}]} ],  // Candle Smoke
    gl_5_4:[ {on:'encased',do:[{fn:'selfShield',pct:R(0.02),dur:4}]} ],                                         // Wax Lace
    gl_6_2:[ {stat:{atk:R(-0.01)},to:{team:'enemy',has:'nl'}} ],                                                // Clinging Wax
    gl_6_3:[ {on:'wax',do:[{field:'_waxT',on:'target',add:R(1)}]} ],                                            // Dripping Candles
    gl_7_1:[ {on:'skillTgt',skill:SW,do:[{retarget:'holder:guest'}]},                                           // The Long Table: on the Guest while it lives
             {on:'skillAt',skill:SW,do:[{fn:'sealTgt'}]}, {on:'cast',skill:SW,do:[{fn:'thinPour'}]} ],          //   and a thinner pour beside it
    gl_9_2:[ {param:'noex',add:1} ],                                                                            // No Excuses (dashWatch)
    gl_7_3:[ {on:'encased',do:[{mark:'enc8',on:'target',dur:8}]},                                               // Encased Again
             {on:'wax',if:{targetHas:'enc8',fn:'wax2'},chance:R(0.2),add:-1} ],
    gl_7_4:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                             // Bell Pull
    gl_5_1:[ {on:'cd',less:R(0.01)} ],                                                                          // Second Helping
    gl_5_2:[ {on:'tick',period:0.1,do:[{fn:'locked'}]} ],                                                       // Locked Doors (PICK ONE)
    gl_5_3:[ {on:'wave',do:[{fn:'seen'}]}, {on:'tick',period:0.25,do:[{fn:'late'}]} ],                          // Late Arrival (PICK ONE)
    gl_8_4:[ {on:'encased',do:[{energy:R(2)}]} ],                                                               // Candle Wick
    gl_9_3:[ {on:'in',if:{fn:'srcWaxed'},less:R(0.01)}, {on:'teamIn',if:Object.assign({fn:'srcWaxed'},VS_ALLY),less:R(0.01)} ],   // Waxen Grip
    gl_9_4:[ {on:'encased',do:[{fn:'waxOn',on:{team:'enemy',of:'target',within:2,skip:'target'}}]} ],           // Statuary
    gl_10_1:[ {stat:{cdRate:R(-0.02)},to:'holder:guest'} ],                                                     // Guest's Burden
    gl_10_3:[ {on:'encased',do:[{fn:'lips'}]}, {on:'statue',do:[{fn:'lips'}]} ],                                // Sealed Lips
    gl_10_4:[ {on:'in',if:{srcHas:'guest'},less:R(0.05)} ],                                                     // Old Silk
    gl_11_1:[ {on:'death',if:{unitHas:'guest'},do:[{fn:'nextGuest'}]} ],                                        // Next Guest
    gl_11_2:[ {on:'ccHit',if:{casting:'fcWax',cc:['slow'],talent:false},do:[{slowMore:R(0.03),on:'target'}]} ], // Stay a While
    gl_11_4:[ {on:'in',if:{fn:'srcWaxed'},less:R(0.015)} ],                                                     // Patient Host
    gl_12_2:[ {on:'statue',do:[{fn:'ext',by:R(0.1)}]} ],                                                        // Long Pour
    gl_12_3:[ {stat:{nrg:R(0.02)}} ],                                                                           // Hostess
    gl_12_4:[ {on:'healMe',more:R(0.04)}, {param:'sh.me',add:R(0.04)} ],                                        // Warm Hands: heals on her, her talents' shields on her
    gl_13_2:[ {on:'statue',do:[{mark:'nle',on:'target',dur:8,spot:'here'},{window:'nle',dur:8}]},               // Nobody Leaves Early (SIGNATURE): 8 s from its statue
              {on:'tick',if:{window:'nle'},period:0.1,do:[{fn:'leash',lm:'nle',lr:3}]},                        //   no farther than 3 m from where it was encased
              {on:'wax',if:{targetHas:'nle'},do:[{field:'_wax',on:'target',add:1}]} ],                          //   2 wax for each ability it casts
    /* ============================== THE NEXT COURSE ============================== */
    nc_1_1:[ {on:'out',if:{casting:BELL,fn:'cM'},more:R(0.04)},                                                 // Courses: the Main
             {on:'hit',if:{casting:MB,targetTeam:'enemy',fn:'cS'},do:[{slow:P('st.slow',0.2),dur:2,on:'target'}]},   //   the Starter
             {on:'hit',if:{casting:MB,targetTeam:'enemy',fn:'cW'},do:[{fn:'sweet'}]} ],                         //   the Sweet
    nc_1_2:BELLMORE({},R(0.02)),                                                                                // Sharp Bell
    nc_1_4:[ {param:'scald',add:R(0.02)} ],                                                                     // Hot Wax (Scald: the 'scald' always row)
    nc_2_1:[ {on:'out',if:{casting:BELL,fn:'cM'},more:R(0.02)} ],                                               // Fine Dining
    nc_n1:[  {on:'cast',skill:MB,do:[{window:'acec',dur:2}]},                                                   // A Candle for Every Course (LINK)
             {on:'in',if:{window:'acec'},less:0.05}, {on:'teamIn',if:Object.assign({window:'acec',targetWithin:6},VS_ALLY),less:0.05},
             {on:'sweetRung',req:'ho_1_1',do:[{stack:'cand',add:1}]} ],                                         //   with Candlelight: each Sweet lights a candle
    nc_2_4:[ {param:'scald.low',add:R(0.1)} ],                                                                  // Boiling Point
    nc_3_1:[ {param:'banq',add:1} ],                                                                            // Grand Banquet (the 'course' fn)
    nc_4_2:[ {on:'out',if:{casting:'bellBurst'},more:R(0.03)}, {on:'dmg:burst',more:R(0.03)} ],                 // Crack the Coat
    nc_3_3:[ {on:'cast',skill:MB,do:[{window:'poised',dur:2}]}, {on:'in',if:{window:'poised'},less:R(0.02)} ],  // Poised
    nc_3_4:[ {on:'partPre',skill:'bellBurst',do:[{fn:'flash'}]} ],                                              // Flash Scald
    nc_4_1:[ {param:'st.slow',add:R(0.02)} ],                                                                   // Bitter Starter
    nc_5_2:[ {param:'burst.r',add:1}, {on:'kit',skill:MB,do:[{fn:'wide'}]} ],                                   // Wide Bell (PICK ONE)
    nc_3_2:[ {on:'cd',skill:'blue',add:R(-0.2)} ],                                                              // Bronze Tongue
    nc_5_3:[ {on:'out',if:{casting:'bellBurst',fn:'isCentre'},more:0.3}, {on:'dmg:burst',if:{fn:'isCentre'},more:0.3} ],   // Deep Bell (PICK ONE)
    nc_5_1:[ {on:'out',if:{casting:SW},more:R(0.05)} ],                                                         // Thin Wax
    nc_n2:BELLMORE({targetHpAbove:0.75},R(0.03)),                                                               // First Sitting
    nc_6_4:[ {param:'runny',add:R(0.5)} ],                                                                      // Runny Wax
    nc_6_1:[ {on:'kill',if:{casting:BELL},do:[{fn:'cleanPlates'}]} ],                                           // Clean Plates (once per Bell)
    nc_6_2:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                             // Second Pour
    nc_7_2:[ {on:'hit',if:{casting:'bellBurst',targetTeam:'enemy'},do:[{fn:'fount'}]}, {on:'cast',skill:MB,do:[{fn:'fountCoat'}]} ],   // Wax Fountain
    nc_7_3:BELLMORE({fn:'tWaxed'},R(0.03)),                                                                     // Gilded Bell
    nc_7_4:[ {on:'out',if:{casting:ABIL,fn:'tScald'},more:R(0.01)}, {on:'dmg:burst',if:{fn:'tScald'},more:R(0.01)} ],   // Candle Glow
    nc_8_1:[ {on:'sweetRung',do:[{heal:{pct:R(0.02),of:'maxHp'}}]} ],                                           // Dessert Spoon
    nc_8_3:[ {on:'out',if:{casting:'fcBurst'},more:R(0.02)} ],                                                  // Hard Shell
    nc_8_4:[ {param:'scald.mr',add:R(0.05)} ],                                                                  // Wax Burns
    nc_9_1:[ {on:'out',if:{casting:BELL,fn:'cM'},ignoreMr:R(0.02)} ],                                           // Hearty Main
    nc_9_2:[ {on:'hit',if:{casting:MB,targetTeam:'enemy'},do:[{mark:'re',on:'target',dur:3}]},                  // Ringing Ears
             {on:'out',if:{targetHas:'re'},more:R(0.01)}, {on:'dmg:burst',if:{targetHas:'re'},more:R(0.01)} ],
    nc_9_4:[ {on:'death',if:{who:'enemy',fn:'uScald'},do:[{fn:'boilOver'}]} ],                                  // Boiling Over
    nc_10_1:[ {param:'seconds',add:1} ],                                                                        // Seconds (the 'course' fn)
    nc_10_3:[ {on:'cd',less:R(0.01)} ],                                                                         // Bright Flame
    nc_10_4:[ {on:'part',skill:'bellBurst',do:[{fn:'selfShield',pct:R(0.01),dur:3}]} ],                         // Lace Mantle
    nc_11_2:BELLMORE({targetHpBelow:0.30},R(0.05)),                                                             // Final Toll
    nc_11_3:[ {stat:{nrg:R(0.015)}} ],                                                                          // Candle Hour
    nc_12_1:[ {on:'courseRung',do:[{stack:'feast',add:{flat:1,k:1}}]}, {stat:{apow:R(0.005)},per:'feast'} ],    // Feast Day (a Banquet is 3 Courses)
    nc_12_3:[ {param:'effigy',add:R(1/3)}, {on:'statue',do:[{mark:'fce',on:'target',dur:{flat:0.05,pct:1,of:'hit'},while:'stunned'}]} ],   // Effigy Fire
    nc_12_4:[ {param:'scald.slow',add:R(0.03)} ],                                                               // Spilled Wax
    nc_13_3:[ {on:'part',skill:'fcBurst',do:[{fn:'banquet'}]},                                                  // The Last Course (SIGNATURE): each effigy burst a Banquet
              {on:'out',if:{casting:'fcBurst'},more:{rk:'nc_1_1',r:0.04}}, {on:'out',if:{casting:'fcBurst'},more:{rk:'nc_2_1',r:0.02}},   //   its Main (Courses, Fine Dining)
              {on:'dmg:burst',if:{fn:'inBanq'},more:{rk:'nc_1_1',r:0.04}}, {on:'dmg:burst',if:{fn:'inBanq'},more:{rk:'nc_2_1',r:0.02}} ],
    /* ============================== THE HOST ============================== */
    ho_1_1:[ {on:'tick',period:P('cl.per',8),do:[{stack:'cand',add:1}]},                                        // Candlelight: a candle every 8 s
             {on:'in',less:R(0.01),per:'cand'}, {on:'teamIn',if:IN_CL,less:R(0.01),per:'cand'} ],               //   each 1% per rank (her too)
    ho_n1:[  {on:'in',if:{auto:true},do:[{slow:R(0.03),dur:1.5,on:'source'}]},                                  // Mind Your Manners
             {on:'teamIn',if:Object.assign({auto:true,targetWithin:6},VS_ALLY),do:[{slow:R(0.03),dur:1.5,on:'source'}]} ],
    ho_1_4:[ {param:'ww.x',add:R(0.03,-0.03)}, {on:'encased',do:[{fn:'warmWax'}]} ],                            // Warm Wax (its cut: the WW always rows)
    ho_2_1:[ {param:'cl.per',add:R(-0.5)} ],                                                                    // Long Wicks
    ho_2_4:[ {param:'ww.dur',add:R(0.5)} ],                                                                     // Soft Coat
    ho_3_1:[ {param:'cand.max',add:1} ],                                                                        // Fourth Candle
    ho_3_2:[ {param:'cl.r',add:R(0.4)} ],                                                                       // Lamplit Hall
    ho_3_3:[ {on:'out',if:{auto:true},more:R(0.04)} ],                                                          // Courtly Hands
    ho_3_4:[ {param:'ww.sh',add:0.5} ],                                                                         // Tallow Shell (giveWW)
    ho_4_1:[ {stat:{apow:R(0.005)},per:'cand'} ],                                                               // Steady Flame
    ho_4_3:[ {on:'teamHeal',if:{who:'ally',unitWithin:6},more:R(0.02)}, {on:'healMe',more:R(0.02)} ],           // Good Company
    ho_4_4:[ {on:'in',if:{some:{team:'ally',others:true,has:'ww'}},less:R(0.02)} ],                             // Wax Plates
    ho_5_1:[ {on:'teamIn',if:Object.assign({fn:'drop30',stackMin:{cand:1}},IN_CL),do:[{after:0,do:[{fn:'blowOut'}]}]},   // Blown Out (after the hit)
             {on:'in',if:{dropBelow:0.30,stackMin:{cand:1}},do:[{after:0,do:[{fn:'blowOut'}]}]} ],
    ho_5_2:[ {on:'skillTgt',skill:SW,if:{fn:'noLT'},do:[{fn:'courtesy'}]} ],                                    // Courtesy (PICK ONE)
    ho_5_3:[ {on:'sealed',if:{fn:'onLow'},do:[{fn:'ext',by:0.4}]} ],                                            // Firm Hand (PICK ONE)
    ho_5_4:[ {param:'ww2',add:R(0.1)} ],                                                                        // Shared Table
    ho_6_1:[ {param:'blow',add:R(0.01)} ],                                                                      // Snuffer
    ho_6_2:[ {stat:{armor:R(0.006),mr:R(0.006)},per:'cand',to:{team:'ally',within:P('cl.r',6)}} ],              // Candle Ward (her too)
    ho_6_3:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                             // Polite Wax
    ho_7_1:[ {param:'ten.cl',add:R(0.02)} ],                                                                    // Wax Seat (the 'ten' / 'tenAlly' always rows)
    ho_7_2:[ {on:'at',skill:MB,do:[{heal:{pct:P('gb',0.03),of:'tgtMaxHp'},on:{team:'ally',of:'pt',withinOpt:'radius'},emit:'gbHeal'}]} ],   // Guests' Bell
    ho_10_3:[ {on:'encase',add:R(0.04)} ],                                                                      // Gracious Wax
    ho_8_2:[ {param:'gb',add:R(0.01)} ],                                                                        // Second Bell
    ho_8_3:[ {on:'cd',less:R(0.01)} ],                                                                          // Candle Watch
    ho_9_1:[ {on:'in',less:R(0.002),per:{stack:'cand',over:2}}, {on:'teamIn',if:IN_CL,less:R(0.002),per:{stack:'cand',over:2}} ],   // Long Night In
    ho_9_3:[ {on:'sealed',do:[{fn:'gentle'}]},                                                                  // Gentle Seal
             {on:'in',if:{srcHas:'gs'},less:R(0.02)}, {on:'teamIn',if:Object.assign({srcHas:'gs'},VS_ALLY),less:R(0.02)} ],
    ho_9_4:[ {param:'hearth',add:0.5} ],                                                                        // Warm Hearth (the 'ten' / 'tenAlly' always rows)
    ho_10_1:[ {param:'black',add:1} ],                                                                          // Black Candles (candWave)
    ho_10_2:[ {on:'cd',skill:'blue',add:R(-0.15)} ],                                                            // Dinner Bell
    ho_11_2:[ {stat:{nrg:R(0.02)}} ],                                                                           // Table Talk
    ho_11_3:[ {on:'gbHeal',do:[{mark:'wm',on:'target',dur:3}]},                                                 // Waxen Mercy
              {on:'in',if:{targetHas:'wm'},less:R(0.015)}, {on:'teamIn',if:Object.assign({targetHas:'wm'},VS_ALLY),less:R(0.015)} ],
    ho_11_4:[ {param:'ww.shm',add:R(0.05)} ],                                                                   // Shield of Lace (giveWW)
    ho_12_1:[ {param:'stub',add:R(1)} ],                                                                        // Candle Stub (candWave)
    ho_12_2:[ {on:'at',skill:FC,each:{team:'ally',of:'pt',withinOpt:'radius'},chance:R(0.2),do:[{fn:'hearth'}]} ],   // Hearth Wax
    ho_12_4:[ {on:'in',if:{stackMin:{cand:3}},less:R(0.03)} ],                                                  // Grace Under Fire
    ho_13_2:[ {on:'at',skill:FC,do:[{stack:'cand',set:'max'},{fn:'courtSits'}]},                               // The Court Sits (SIGNATURE)
              {on:'in',if:{targetHas:'cs'},less:0.25}, {on:'teamIn',if:Object.assign({targetHas:'cs'},VS_ALLY),less:0.25},
              {on:'teamLethal',if:{unitHas:'cs',stackMin:{cand:1}},by:'unit',once:'fight',do:[{fn:'saved'}]},   //   a killing hit snuffs a candle instead
              {on:'lethal',if:{targetHas:'cs',stackMin:{cand:1}},once:'fight',do:[{fn:'saved'}]} ]
  },
  fn:{
    tWaxed(A,T,u,c){ return waxed(A,u,c.tgt); },
    srcWaxed(A,T,u,c){ return waxed(A,u,c.src); },
    tScald(A,T,u,c){ return scalding(A,T,u,c.tgt); },
    uScald(A,T,u,c){ return scalding(A,T,u,c.unit)&&coated(u,c.unit); },
    wax2(A,T,u,c){ return !!c.tgt&&c.tgt._wax===2; },
    waxOn(A,T,u,c,a){ const E=A.eng(); if(!E.wax) return; for(const t of A.pick(T,u,a.on,c)) if(t.alive&&t.team!==u.team) E.wax(t); },
    selfShield(A,T,u,c,a){ selfShield(A,T,u,a.pct,a.dur); },
    ext(A,T,u,c,a){ ext(A,c.tgt,a.by); },
    /* Sealed Lips: silenced 0.15 s per rank longer than the encase (or the statue) lasts */
    lips(A,T,u,c){ const x=c.tgt, E=A.eng(); if(!x||!x.alive) return; const v=Math.max(c.amt||0,x.stunned||0)+0.15*(T.r.gl_10_3||0), cap=E.ccCap('silencedT')||Infinity;
      x.silencedT=Math.max(x.silencedT||0,Math.min(cap,v)); },
    /* Next Guest: the enemy with the highest attack */
    nextGuest(A,T,u,c){ const x=A.pick(T,u,{team:'enemy',order:'high:dmg',n:1,skip:'unit'},c)[0]; if(x) A.setMark(T,u,x,'guest',{unique:true}); },
    /* The Long Table: the enemy Sealing Wax poured on, and a thinner pour (its coat, half as long) on the enemy nearest to it */
    sealTgt(A,T,u,c){ T.s.sl=c.tgt||null; },
    thinPour(A,T,u,c){ const t=T.s.sl, E=A.eng(); T.s.sl=null; if(!t) return; let best=null, bd=Infinity; for(const x of foes(A,T,u)){ if(x===t) continue; const d=E.dist(t,x); if(d<bd){ bd=d; best=x; } }
      if(!best) return; const d=((c.o&&c.o.coat)||6)/2; best._waxCoatT=Math.max(best._waxCoatT||0,d); best._waxCoatBy=u; },
    /* every 0.1 s: a waxed enemy whose distance from her grew since the last look is moving away from her ('nl' for 0.25 s) */
    nlScan(A,T,u){ const s=T.s.np||(T.s.np={}), E=A.eng(), M=E.METER();
      for(const x of foes(A,T,u)){ const p=s[x.uid]; s[x.uid]={x:x.x,y:x.y}; if(!p||!waxed(A,u,x)) continue;
        if(Math.hypot(x.x-u.x,x.y-u.y)>Math.hypot(p.x-u.x,p.y-u.y)+0.02*M) A.setMark(T,u,x,'nl',{dur:0.25}); } },
    /* Held at Table / No Excuses: an enemy's own dash or leap (the engine's _dash) that ends farther from her than it began: dragged back toward where it
       began, a third of the way per rank of Held at Table if it was waxed; all the way with No Excuses if Nobody Leaves was slowing it */
    dashWatch(A,T,u){ const s=T.s.dw||(T.s.dw={}), E=A.eng();
      for(const x of E.units()){ if(x.team===u.team) continue; const r=s[x.uid];
        if(x.alive&&x._dash&&(!r||r.d!==x._dash)){ s[x.uid]={d:x._dash,x0:x._dash.x0,y0:x._dash.y0,wx:waxed(A,u,x),nl:!!A.markOf(u,x,'nl')}; continue; }
        if(!r||x._dash===r.d) continue; delete s[x.uid]; if(!x.alive) continue;
        if(!(Math.hypot(x.x-u.x,x.y-u.y)>Math.hypot(r.x0-u.x,r.y0-u.y)+1e-6)) continue;
        const k=(r.nl&&T.P.noex)?1:(r.wx?Math.min(1,T.P.hat||0):0); if(!(k>0)) continue; const L=Math.hypot(x.x-r.x0,x.y-r.y0)*k/E.METER(); if(!(L>0)) continue;
        A.acts(T,u,[{pull:'target',to:'pt',m:L,secs:0.3}],{u,tgt:x,pt:{x:r.x0,y:r.y0,pt:true}}); } },
    /* Locked Doors: an enemy that comes within 5 m of her (body to body) cannot leave that circle for 1 s (once every 10 s per enemy): dragged back to its edge */
    locked(A,T,u){ const E=A.eng(), M=E.METER();
      for(const x of foes(A,T,u)){ const g=A.gap(u,x);
        if(g<5*M&&!A.markOf(u,x,'ldX')){ A.setMark(T,u,x,'ld',{dur:1}); A.setMark(T,u,x,'ldX',{dur:10}); continue; }
        if(g>5*M&&A.markOf(u,x,'ld')) A.acts(T,u,[{pull:'target',to:'self',m:(g-5*M)/M,secs:0.1}],{u,tgt:x}); } },
    /* Nobody Leaves Early: an enemy farther than 3 m (centre) from where its statue stood is dragged back */
    leash(A,T,u,c,a){ const E=A.eng(), M=E.METER();
      for(const x of foes(A,T,u)){ const m=A.markOf(u,x,a.lm); if(!m||m.sx==null) continue; const d=Math.hypot(x.x-m.sx,x.y-m.sy); if(!(d>a.lr*M)) continue;
        A.acts(T,u,[{pull:'target',to:'pt',m:(d-a.lr*M)/M,secs:0.1}],{u,tgt:x,pt:{x:m.sx,y:m.sy,pt:true}}); } },
    /* Late Arrival: the enemies on the field at a wave's start; one that comes later (a summon) arrives with 1 wax */
    seen(A,T,u){ const S=T.s.seen={}; for(const x of A.eng().units()) if(x.team!==u.team) S[x.uid]=1; },
    late(A,T,u){ const E=A.eng(), S=T.s.seen||(T.s.seen={}); for(const x of foes(A,T,u)){ if(S[x.uid]) continue; S[x.uid]=1; if(E.wax) E.wax(x); } },
    /* ---- Courses: each Mourning Bell rings the next of Starter, Main, Sweet; Grand Banquet: every 4th is a Banquet (all three); Seconds: after it, the Main ---- */
    course(A,T,u,c){ const s=T.s; s.cn=(s.cn||0)+1; s.sw=0; s.cp=0; let k;
      if(T.P.banq&&s.cn%4===0){ k='B'; if(T.P.seconds) s.ci=1; } else { k=['S','M','W'][s.ci||0]; s.ci=((s.ci||0)+1)%3; }
      s.crs=k; A.run(T,u,'courseRung',Object.assign({},c,{k:k==='B'?3:1})); if(k==='W'||k==='B') A.run(T,u,'sweetRung',c); },
    cS(A,T){ return T.s.crs==='S'||T.s.crs==='B'; }, cM(A,T){ return T.s.crs==='M'||T.s.crs==='B'; }, cW(A,T){ return T.s.crs==='W'||T.s.crs==='B'; },
    sweet(A,T,u,c){ if((T.s.sw||0)>=5) return; T.s.sw=(T.s.sw||0)+1; A.acts(T,u,[{energy:3}],c); },              // 3 energy per enemy hit, at most 15
    cleanPlates(A,T,u,c){ if(T.s.cp) return; T.s.cp=1; A.acts(T,u,[{cd:'blue',add:-(T.r.nc_6_1||0)}],c); },
    wide(A,T,u,c){ const o=c.o; if(o) o.detR=(o.detR||2.6*M_(A))+(T.P['burst.r']||0)*M_(A); },
    bm(A,T,u,c){ T.s.bm=c.tgt; T.s.bmThin=!!A.markOf(u,c.tgt,'thin'); },
    isCentre(A,T,u,c){ return !!c.tgt&&c.tgt===T.s.bm; },
    inBanq(A,T){ return !!T.s.inB; },
    /* ---- Scald: each second, every enemy her coat scalds (and Runny Wax's time after a coat) and every statue Effigy Fire scalds; Spilled Wax slows it ---- */
    scald(A,T,u){ const E=A.eng(), sc=T.s.sc||(T.s.sc={}), now=E.now(), sl=T.P['scald.slow']||0;
      for(const x of foes(A,T,u)){ if(coated(u,x)) sc[x.uid]=now+x._waxCoatT+(T.P.runny||0); const d=scaldPs(A,T,u,x); if(!(d>0)) continue;
        magicDmg(A,T,u,x,d,'scald'); if(sl>0&&x.alive){ x.slow=Math.max(x.slow||0,1.05); x.slowMul=Math.min(x.slowMul==null?1:x.slowMul,Math.max(0.05,1-sl)); } } },
    burstEnd(A,T,u,c){ if(c.tgt) afterCoat(A,T,u,c.tgt); },
    /* Flash Scald: a scalding coat Mourning Bell bursts deals its Scald for the time left at once (its Scald is then over) */
    flash(A,T,u,c){ const x=c.tgt, E=A.eng(); if(!x||!coated(u,x)||!scalding(A,T,u,x)) return; const left=(x._waxCoatT||0)+(T.P.runny||0), d=scaldPs(A,T,u,x)*left; if(!(d>0)) return;
      magicDmg(A,T,u,x,d,'scald'); (T.s.fl||(T.s.fl={}))[x.uid]=E.now(); },
    /* Wax Fountain: the enemies a burst hits (not a thin coat's) get a thin coat when the Bell is over (as long as Sealing Wax's coat), so the next Bell bursts them */
    fount(A,T,u,c){ if(T.s.bmThin||!c.tgt) return; const L=T.s.wf||(T.s.wf=[]); if(L.indexOf(c.tgt)<0) L.push(c.tgt); },
    fountCoat(A,T,u){ const L=T.s.wf||[]; T.s.wf=[]; const d=6+0.4*(T.r.gl_4_1||0);
      for(const x of L){ if(!x.alive) continue; x._waxCoatT=Math.max(x._waxCoatT||0,d); x._waxCoatBy=u; A.setMark(T,u,x,'thin',{dur:d}); } },
    /* Boiling Over: a scalding enemy that dies bursts its coat */
    boilOver(A,T,u,c){ burstCoat(A,T,u,c.unit,c); },
    /* The Last Course: an effigy burst is a Banquet centred on that enemy: the Starter slows it, the Main is its burst's (out rows), the Sweet gives 3 energy, and every
       coat within 2.6 m of it (Wide Bell: 3.6 m), centre to centre, bursts */
    banquet(A,T,u,c){ const e=c.tgt, E=A.eng(); if(!e) return; const M=E.METER();
      if(e.alive) A.acts(T,u,[{slow:0.2+(T.P['st.slow']||0),dur:2,on:'target'}],c); A.acts(T,u,[{energy:3}],c);
      const R=(2.6+(T.P['burst.r']||0))*M, L=foes(A,T,u).filter(x=>x===e||Math.hypot(x.x-e.x,x.y-e.y)<R); if(!e.alive&&coated(u,e)) L.push(e);
      T.s.inB=1; try{ for(const x of L) burstCoat(A,T,u,x,c); } finally{ T.s.inB=0; } },
    /* ---- candles ---- */
    candWave(A,T,u){ if(!T.P.black) A.stSet(T,u,'cand',0); const n=T.P.stub||0; if(n>0&&A.stGet(T,'cand')<n) A.stSet(T,u,'cand',n); },
    drop30(A,T,u,c){ const t=c.tgt; if(!t) return false; return t.hp>=0.3*t.maxHp&&(t.hp+(t.shield||0)-(c.amt||0))<0.3*t.maxHp; },
    blowOut(A,T,u,c){ const t=c.tgt, E=A.eng(); if(!t||!t.alive||A.stGet(T,'cand')<1||!(t.hp<0.3*t.maxHp)) return; A.stSet(T,u,'cand',A.stGet(T,'cand')-1);
      E.healUnit(t,t.maxHp*(0.04*(T.r.ho_5_1||0)+(T.P.blow||0))); },
    /* ---- Warm Wax ---- */
    wwk(A,T,u,c){ const m=A.markOf(u,c.tgt,'ww'); return m?(0.03+(T.P['ww.x']||0))*(m.v||0):0; },
    warmWax(A,T,u){ const d=4+(T.P['ww.dur']||0), L=A.pick(T,u,{team:'ally',others:true,order:'near',n:2},{}); if(L[0]) giveWW(A,T,u,L[0],d,1); if(L[1]&&T.P.ww2) giveWW(A,T,u,L[1],d,T.P.ww2); },
    hearth(A,T,u,c){ giveWW(A,T,u,c.tgt,4+(T.P['ww.dur']||0),1); },
    courtSits(A,T,u,c){ for(const x of A.pick(T,u,{team:'ally',of:'pt',withinOpt:'radius'},c)){ A.setMark(T,u,x,'cs',{dur:6}); giveWW(A,T,u,x,6,1); } },
    /* The Court Sits: a hit that would kill an ally in the court snuffs a candle: it is kept at 1 HP and cannot be hit or targeted for 2 s (once per ally a fight) */
    saved(A,T,u,c){ const x=c.unit||c.tgt; if(!x||A.stGet(T,'cand')<1) return; A.stSet(T,u,'cand',A.stGet(T,'cand')-1); if(x.hp<1) x.hp=1; c.stop=true;
      A.setMark(T,u,x,'csI',{dur:2}); x._noTarget=true; x._noTargetT=Math.max(x._noTargetT||0,2); },
    /* ---- Sealing Wax's target and its seal ---- */
    noLT(A,T,u){ if(!T.r.gl_7_1) return true; const h=T.s.m.guest; return !(h&&h.alive&&A.markOf(u,h,'guest')); },
    courtesy(A,T,u,c){ const a=A.pick(T,u,{team:'ally',others:true,order:'lowHp',n:1},c)[0]; if(!a) return; let best=null;
      for(const x of foes(A,T,u)) if(x.target===a&&(!best||(x.dmg||0)>(best.dmg||0))) best=x; if(best) c.tgt=best; },
    onLow(A,T,u,c){ const t=c.tgt, a=t&&t.target; return !!a&&a.alive&&a.team===u.team&&a.hp<0.5*a.maxHp; },
    gentle(A,T,u,c){ const t=c.tgt; if(t) A.setMark(T,u,t,'gs',{dur:(t.stunned||0)+3}); },
    /* ---- shorter controls: Composure on her (up to 20%), Wax Seat on everyone in Candlelight (up to 10%), Warm Hearth halves a stun on one with Warm Wax;
       all of them together never make a control more than 50% shorter ---- */
    ten(A,T,u,c){ let k=1-Math.min(0.20,T.P['ten.me']||0); k*=1-Math.min(0.10,T.P['ten.cl']||0); if(c.field==='stunned'&&T.P.hearth&&A.markOf(u,u,'ww')) k*=1-T.P.hearth; c.amt*=Math.max(0.5,k); },
    tenAlly(A,T,u,c){ const x=c.unit, E=A.eng(); if(!x||!x.alive) return; let k=1;
      if(T.P['ten.cl']&&A.gap(u,x)<(6+(T.P['cl.r']||0))*E.METER()) k*=1-Math.min(0.10,T.P['ten.cl']);
      if(c.field==='stunned'&&T.P.hearth&&A.markOf(u,x,'ww')) k*=1-T.P.hearth; k=Math.max(0.5,k); if(k<1&&Math.abs((x[c.field]||0)-(c.amt||0))<1e-9) x[c.field]=c.amt*k; }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/20 - CERALINE - talent decisions.md) */
  ruling:{}
};
