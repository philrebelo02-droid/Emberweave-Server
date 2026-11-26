/* TESSIT - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE (most talents are one named number, a `param` row), then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Tessit": what she added)
   Her real kit (the code, not the tooltip wording; a mid-row Support, damage profile Magic: her basic attacks and Hourglass's hit are magic, her skills read
   Ability Power):
   - Accelerate ('dmgbuff', green, cd 8): every ally, her included, deals x (1.3 + 0.001 a level) damage for 6 s (the engine's one dmgBuffMul slot).
   - Sleight of Hours ('spdsteal', blue, cd 10, deliver 'shot'): the shot flies to the FASTEST enemy (attack speed x haste); it is robbed of 35% + 0.1 point a
     level of attack speed (44.9% at 100) for 5 s (hasteMul, the engine's one haste slot) and the ally the case picks gets the same. The case picks "the fastest
     ally" by a.atkSpeed x hasteMul, and units carry no atkSpeed: it is the ally with the highest haste multiplier, ties to the first in the units order (in
     20 seeded fights 62 of 77 went to the first ally, 15 to Tessit herself). NOT changed here (a base skill); the talents use the game's own pick.
   - Unwind (passive 'unwind', every 5 s - 0.015 s a level: 3.515 s at 100): one random ally (her included) carrying a DoT, a stun, a silence, a slow or a
     Mortal Wound loses ONE of them (in that order: the newest DoT, the stun, the silence, the slow, the wound). Its draw is the game's (brnd). The page lines
     added for her (TALENT HOOK skillTgt 'unwind', pass 'unwind', and the guarded field u._talUwOff on the interval) let her rows pick the ally, see what was
     lifted and make it come sooner.
   - Hourglass (ultimate 'aoeStun', energy; ULT_DEF.aoeStun + HERO_ULT_ART.tessit, deliver 'land' 0.55 s): every enemy whose CENTRE is within 4.26 m of the aim
     takes 140% of her ability power x the skill level (magic) and is stunned through ccApply (2 s written, 1.4 s as it lands). Measured: 1.42 enemies a cast.
   Sand, Debt, Pocketed, Burden, Clear, Poured, Grains, Running Out and Turnover exist only through her talents.
   Every lock is a countdown, a window, a mark or a timed mark (the engine moves those with the wave clock): her file keeps no absolute fight time of its own.
   Readings, caps and corrected tooltips: WIRING/55 - TESSIT - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
/* the states several talents read: their bookkeeping runs when any of these is learned */
const SAND=['lg_1_2','lg_2_2','lg_3_2','lg_n1','lg_9_1','lg_7_3','lg_10_2','lg_11_1','lg_12_4','lg_13_3'];                                  // Sand
const DEBT=['lg_2_3','lg_4_3','lg_8_1','lg_9_1','lg_12_2','lg_13_3'];                                                                       // Debt
const PK=['lg_4_4','lg_5_4','lg_8_4','lg_10_4'];                                                                                            // Pocketed
const BUR=['uw_1_1','uw_2_1','uw_3_1','uw_4_1','uw_4_4','uw_5_1','uw_8_1','uw_9_1','uw_10_1','uw_10_4','uw_11_1','uw_11_2','uw_12_2','uw_12_4','uw_13_2'];   // Burden
const POUR=['uw_4_4','uw_5_4','uw_7_4','uw_8_4','uw_10_4','uw_12_1','uw_11_2','uw_13_2'];                                                   // Poured
const GR=['bg_1_1','bg_1_3','bg_2_3','bg_3_1','bg_3_3','bg_5_2','bg_5_4','bg_6_2','bg_6_4','bg_7_4','bg_8_4','bg_9_4','bg_11_2','bg_12_3'];  // Grains
const RO=['bg_2_2','bg_4_2','bg_6_1','bg_10_2','bg_7_2','bg_9_2','bg_10_3','bg_11_2','bg_11_4','bg_12_2','bg_13_2'];                        // Running Out
const TURN=['bg_4_1','bg_5_1','bg_8_1','bg_10_1','bg_12_1','bg_13_2'];                                                                      // Turnover
const DRL=['lg_1_1','lg_11_1','lg_11_4','lg_6_1','uw_1_1','uw_4_2','uw_4_4','uw_6_1','uw_8_1','bg_3_1','bg_9_1','bg_10_3','lg_6_4','uw_6_4','bg_6_1'];   // her damage reduction (ONE capped group) and the RISK talents
const ALLY=['lg_n1','lg_6_1','uw_4_2','uw_4_4','uw_11_4','bg_10_3','lg_8_1','uw_12_1','bg_6_3','lg_8_2'];                                  // her team's hits and the enemy's hits on her allies
const DR_CAP=0.40, ALLY_CAP=0.25, UW_CAP=1.5, STUN_MAX=4.0, HEAL_PS=0.012, HEAL_HOLD=3;
/* ---- helpers ---- */
const foes=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget&&!(x._riseT>0));          // enemiesOf, as the page
const mates=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team===u.team&&!x._dropHidden&&!(x._riseT>0));                        // alliesOf, as the page (she is one of them)
const speedOf=e=>(1/Math.max(0.05,e.atkInterval||1))*(e.hasteMul||1);                                                          // the shot's measure of the fastest enemy (deliverPick)
const allySpd=a=>(a.atkSpeed||1)*(a.hasteMul||1);                                                                              // the case's measure of "the fastest ally"
function fastest(L,f,not){ let b=null,bs=-1; for(const x of L){ if(x===not) continue; const s=f(x); if(s>bs){ bs=s; b=x; } } return b; }
const effs=a=>((a.dots&&a.dots.length)||0)+((a.stunned||0)>0?1:0)+((a.slow||0)>0?1:0)+((a.silencedT||0)>0?1:0)+((a.mortalT||0)>0?1:0);   // Unwind's own list of negative effects
const ust=(A,T,u,x,n)=>x?A.ustGet(T,u,x,n):0;
const mk=(A,u,x,n)=>!!(x&&A.markOf(u,x,n));
/* one negative effect off a unit, in Unwind's own order (the newest DoT, the stun, the silence, the slow, the Mortal Wound): what was lifted */
function lift(a){ if(a.dots&&a.dots.length) return {k:'dot',d:a.dots.pop()}; if((a.stunned||0)>0){ a.stunned=0; return {k:'stun'}; } if((a.silencedT||0)>0){ a.silencedT=0; return {k:'silence'}; }
  if((a.slow||0)>0){ a.slow=0; return {k:'slow'}; } if((a.mortalT||0)>0){ a.mortalT=0; return {k:'mortal'}; } return null; }
/* a slow of her talents, never weakening a slow that is already stronger */
function slowOn(t,x,d){ if(!t||!t.alive||!(x>0)||!(d>0)) return; const cur=t.slowMul!=null?t.slowMul:1; t.slow=Math.max(t.slow||0,d); t.slowMul=Math.min(cur,Math.max(0.05,1-x)); }
/* magic damage of a talent (through the enemy's magic resist) */
function mhurt(A,T,u,t,a,tag){ if(!t||!t.alive||!(a>0)) return 0; return A.hurt(T,u,t,a*A.eng().defMul(u,t,'magic'),'#4fc4a8',tag); }
/* her heals and shields on a unit: Mending Sand on a Clear ally; her heals on herself share one budget of 1.2% of her max HP a second */
function healOn(A,T,u,t,a){ if(!t||!t.alive||!(a>0)) return; if(T.P.mend&&mk(A,u,t,'tsClr')) a*=1+T.P.mend;
  if(t===u){ const s=T.s; if(s.tsHb==null) s.tsHb=HEAL_PS*u.maxHp; a=Math.min(a,s.tsHb); s.tsHb-=a; if(!(a>0)) return; }
  A.eng().healUnit(t,a); }
function shieldOn(A,T,u,t,a,d){ if(!t||!t.alive||!(a>0)) return; if(T.P.mend&&mk(A,u,t,'tsClr')) a*=1+T.P.mend; t.shield=(t.shield||0)+a; t.shieldT=Math.max(t.shieldT||0,d||5); }
/* a talent stun of hers (a lost moment): never on an enemy that is stunned, nor within 0.5 s after one of her stuns on it ends, and at most twice on one enemy
   in 10 s. Each landed stun is logged on T.s.tsStL ([uid, start, seconds]) for the tests' stun-chain measure */
function stunOk(A,u,t){ return !!t&&t.alive&&!t.stunImmune&&!((t.stunned||0)>0)&&!A.markOf(u,t,'tsLk'); }
function tstun(A,T,u,t,secs){ if(!stunOk(A,u,t)||!(secs>0)) return false; let m=A.markOf(u,t,'tsSc'); if(m&&m.v>=2) return false;
  A.control(T,u,t,'stunned',secs); const d=t.stunned||0; if(!(d>0)) return false;
  if(!m){ A.setMark(T,u,t,'tsSc',{dur:10}); m=A.markOf(u,t,'tsSc'); m.v=0; } m.v++;
  A.setMark(T,u,t,'tsLk',{dur:d+0.5}); const L=T.s.tsStL||(T.s.tsStL=[]); if(L.length<400) L.push([t.uid,A.eng().now(),d]); return true; }
/* ---- Sand (her glass): a gain runs Borrowed Calm ---- */
function addSand(A,T,u,n){ if(!(n>0)||!SAND.some(id=>T.r[id])) return; const got=A.stSet(T,u,'tsSand',A.stGet(T,'tsSand')+n); if(!(got>0)) return; T.s.tsSandG=(T.s.tsSandG||0)+got;
  if(T.P.calm){ let b=null,bn=-1; for(const a of mates(A,u)){ if(a===u||a._summon) continue; const n2=effs(a); if(n2>bn||(n2===bn&&b&&a.hp/a.maxHp<b.hp/b.maxHp)){ bn=n2; b=a; } }
    if(b){ A.setMark(T,u,b,'tsCalm',{dur:3}); if(T.r.uw_2_2) A.setMark(T,u,b,'tsClr',{dur:1,longest:true}); } } }
const sandFull=(A,T,u)=>SAND.some(id=>T.r[id])&&A.stGet(T,'tsSand')>=A.stMax(T,u,'tsSand')-1e-9;
/* ---- Burden (the cleanses in her glass): a gain heals her (Grief Kept) and shields the ally it came from (Put It in the Glass); at full the glass is poured ---- */
function addBur(A,T,u,n,from){ if(!(n>0)||!BUR.some(id=>T.r[id])) return 0; const Pm=T.P, got=A.stSet(T,u,'tsBur',A.stGet(T,'tsBur')+n); if(!(got>0)) return 0;
  if(Pm.grief) healOn(A,T,u,u,Pm.grief*got*u.maxHp);
  if(Pm.pig&&from) for(let i=0;i<got;i++) shieldOn(A,T,u,from,Pm.pig*from.maxHp,6);
  if(Pm.pour&&A.stGet(T,'tsBur')>=A.stMax(T,u,'tsBur')-1e-9&&!A.winOn(T,'tsPourW')){ const e=A.pick(T,u,{team:'enemy',order:'near',n:1},{u})[0];   // Tip the Glass: onto the enemy nearest her
    if(e){ pourOn(A,T,u,e); A.acts(T,u,[{window:'tsPourW',dur:pourDur(T)}],{u}); } }
  return got; }
const pourDur=T=>4+(T.P['pour.dur']||0);
function pourOn(A,T,u,e){ if(e&&e.alive) A.setMark(T,u,e,'tsPour',{dur:pourDur(T),longest:true}); }
const burFull=(A,T,u)=>BUR.some(id=>T.r[id])&&A.stGet(T,'tsBur')>=A.stMax(T,u,'tsBur')-1e-9;
/* Clear: new negative effects on the unit last half as long (watched each tick while it carries it) */
function clearOn(A,T,u,a,d){ if(!a||!a.alive||!(d>0)) return; A.setMark(T,u,a,'tsClr',{dur:d,longest:true}); const L=T.s.tsClrL||(T.s.tsClrL=[]); if(L.indexOf(a)<0) L.push(a); }
/* ---- Grains (on enemies): at the threshold the enemy loses a moment ---- */
const need=T=>Math.max(1,Math.round(6+(T.P['gr.need']||0)));
function addGr(A,T,u,e,n){ if(!e||!e.alive||!(n>0)) return; const N=need(T); let v=Math.min(N,ust(A,T,u,e,'tsGr')+n); A.ustPut(T,u,e,'tsGr',v);
  if(v>=N) moment(A,T,u,e); }
function moment(A,T,u,e){ const Pm=T.P, s=T.s, E=A.eng(); let others=0; for(const x of foes(A,u)) if(x!==e&&ust(A,T,u,x,'tsGr')>0) others++;
  A.ustPut(T,u,e,'tsGr',0); s.tsMoN=(s.tsMoN||0)+1;
  if(Pm['gr.k']) s.tsMoD=mhurt(A,T,u,e,Pm['gr.k']*u.apow*(1+(Pm.sharp||0)*Math.min(3,others)),'tsMoment');
  if(!e.alive) return;
  tstun(A,T,u,e,Math.max(0.05,0.3+(Pm.mom||0)));
  if(Pm['mom.nrg']) e.energy=Math.max(0,(e.energy||0)-Pm['mom.nrg']);
  if(Pm['mom.slow']) slowOn(e,Pm['mom.slow'],2);
  if(Pm.storm&&!s.tsStorm){ s.tsStorm=1; try{ for(const x of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},{u,tgt:e})) addGr(A,T,u,x,2); } finally{ s.tsStorm=0; } } }
/* ---- Running Out (on enemies): a timed mark; when it ends, the strike ---- */
const roDur=T=>Math.max(1,5-(T.P['ro.fast']||0));
function roStart(A,T,u,e,why){ if(!e||!e.alive||mk(A,u,e,'tsRun')) return; A.acts(T,u,[{mark:'tsRun',on:'target',dur:roDur(T),ends:'tsRunEnd'}],{u,tgt:e}); (T.s.tsRoO||(T.s.tsRoO={}))[e.uid]=why||'hp'; }
function roStrike(A,T,u,e){ const Pm=T.P, s=T.s, why=(s.tsRoO&&s.tsRoO[e.uid])||'hp'; if(s.tsRoO) delete s.tsRoO[e.uid]; s.tsRoN=(s.tsRoN||0)+1;
  let k=(Pm['ro.k']||0)*(1+(Pm['ro.risk']||0)); if(Pm.ae&&A.winOn(T,'tsAcc')) k*=1.30; if(why==='acc') k*=1+(Pm['ae.k']||0); if(why==='egf') k*=1+(Pm['egf.k']||0);
  s.tsRoK=k; s.tsRoD=k>0?mhurt(A,T,u,e,k*u.apow,'tsRunOut'):0;
  if(Pm.odp) healOn(A,T,u,u,Pm.odp*u.maxHp); }
/* ---- Turnover: her glass turned (k times in a row) ---- */
const turnPer=T=>Math.max(1,10-(T.P['turn.fast']||0));
function turn(A,T,u,k){ const Pm=T.P, d=(3+(Pm['turn.dur']||0))*k; A.acts(T,u,[{window:'tsTurn',dur:d,longest:true}],{u}); T.s.tsTnN=(T.s.tsTnN||0)+k;
  if(Pm['turn.nrg']) u.energy=Math.min(100,(u.energy||0)+Pm['turn.nrg']*k); }
/* the steal written as Sleight of Hours writes it (the second pair of Full Glass, Borrowed Hourglass, the signature) */
function robOn(v,p,d){ v.hasteMul=Math.min(v.hasteMul||1,1-p); v.hasteT=Math.max(v.hasteT||0,d); }
function giveOn(a,p,d,oc){ a.hasteMul=Math.max(a.hasteMul||1,1+p); a.hasteT=Math.max(a.hasteT||0,d); if(oc){ a._ocMul=1+p; a._ocT=d; } }
/* ---- Unwind on one ally: the Burden, the heal, Carry It, the Clear (lifted = what came off) ---- */
function unwound(A,T,u,a,lifted,clr){ const Pm=T.P, s=T.s, E=A.eng(); if(!a||!lifted.length) return; s.tsUwL=(s.tsUwL||0)+lifted.length;
  if(Pm.carry) for(const l of lifted) if(l.k==='dot'&&l.d&&(l.d.remaining||0)>0&&u.alive){ const d=l.d; E.pushDot(u,d.dps*0.5,d.remaining*d.interval,d.interval,d.color||'#8f8fa8',d.src||null,d.kind||undefined); s.tsCarry=(s.tsCarry||0)+1; }
  addBur(A,T,u,lifted.length,a);
  const c=clr+(Pm.clr?Pm.clr+(Pm['clr.bur']||0)*A.stGet(T,'tsBur'):0); if(c>0) clearOn(A,T,u,a,c);
  if(Pm.kind) healOn(A,T,u,a,Pm.kind*u.apow*(u.healPowMul||1)); }
/* her damage reduction: ONE capped group, at most 40% off a hit. Pure (no side effect): the 95% probe of her test calls it */
function drK(A,T,u,src,kind,auto){ const Pm=T.P; let f=1;
  if(Pm['dr.thief']&&A.winOn(T,'tsThief')) f*=1-Pm['dr.thief'];
  if(Pm['dr.hfy']&&A.stGet(T,'tsSand')>=3) f*=1-Pm['dr.hfy'];
  if(Pm['dr.auto']&&auto) f*=1-Pm['dr.auto'];
  if(Pm['dr.bur']) f*=1-Pm['dr.bur']*A.stGet(T,'tsBur');
  if(Pm['dr.load']&&burFull(A,T,u)) f*=1-Pm['dr.load'];
  if(kind==='magic'){ if(Pm['dr.mag']) f*=1-Pm['dr.mag']; if(Pm['dr.mag2']) f*=1-Pm['dr.mag2']; }
  if(Pm['clr.dr']&&mk(A,u,u,'tsClr')) f*=1-Pm['clr.dr'];
  if(src&&src.team!==u.team){ if(Pm['dr.grain']&&ust(A,T,u,src,'tsGr')>0) f*=1-Pm['dr.grain']; f*=srcK(A,T,u,src); }
  return Math.max(1-DR_CAP,f); }
/* what an enemy carrying her debuffs deals (Bold Hand, Tip the Glass, No Time Left) */
function srcK(A,T,u,x){ const Pm=T.P; let f=1; if(Pm.bold&&mk(A,u,x,'tsRob')) f*=1-Pm.bold; if(Pm.pour&&mk(A,u,x,'tsPour')) f*=1-Pm.pour; if(Pm.ntl&&mk(A,u,x,'tsRun')) f*=1-Pm.ntl; return f; }
const risk=T=>1+(T.P.risk||0);
module.exports={
  hero:'tessit',
  casting:true,                         // rows ask which of her skills is resolving (Hourglass's hits: 'aoeStun')
  points:true,                          // the at hook runs for Hourglass: where it lands (its circle: the signature's "every enemy inside")
  states:{
    tsSand:{max:P('sand.max',6),wave:'reset'},                                        // Sand (kept for the wave; Spare Change starts it again)
    tsBur:{max:P('bur.max',5)},                                                        // Burden (kept for the wave; Long Carry keeps some between waves: wave)
    tsPk:{max:3,dur:P('pk.dur',8)},                                                    // Pocketed (Deep Pockets longer)
    tsGr:{unit:true,max:8,dur:P('gr.dur',6)}                                           // Grains on enemies (the threshold is need(): 6, Slow Sand 8, Quick Sand 4; Heavy Grains longer)
  },
  always:[
    {on:'kit',do:[{fn:'kit'}]},                                                        // a skill of hers resolves: its options (the steal, the buff, the circle)
    {on:'cast',do:[{fn:'cast'}]},                                                      // and after it: what it did
    {on:'at',do:[{fn:'at'}]},                                                          // Hourglass lands: its centre and circle
    {on:'ccHit',do:[{fn:'ccHit'}]},                                                    // a stun of hers landed (Hourglass's: lengthened, the stun-lock)
    {on:'skillTgt',skill:'unwind',do:[{fn:'uwPick'}]},                                 // Unwind picks the ally (Careful Hand)
    {on:'pass',skill:'unwind',do:[{fn:'uwAfter'}]},                                    // and has lifted one effect
    {on:'out',do:[{fn:'out'}]},                                                        // her hits
    {on:'hit',reqAny:GR,if:{auto:true,targetTeam:'enemy'},do:[{fn:'grain'}]},           // her basic attacks leave Grains
    {on:'in',reqAny:DRL,do:[{fn:'myDr'}]},                                             // her damage reduction (one capped group), then the RISK talents
    {on:'dotIn',reqAny:DRL,do:[{fn:'myDrDot'}]},                                       // the same on DoT ticks
    {on:'teamIn',reqAny:ALLY,do:[{fn:'teamIn'}]},                                      // her team's hits on enemies, enemies' hits on her allies
    {on:'death',reqAny:['lg_9_1'],if:{who:'enemy'},do:[{fn:'calledIn'}]},               // Called In
    {on:'tsRobEnd',reqAny:DEBT,do:[{fn:'debt',k:1}]},                                  // Sleight's theft ends: Debt
    {on:'tsRobWEnd',do:[{fn:'debt',k:2}]},                                             // the signature's theft ends: Debt twice as long
    {on:'tsRunEnd',do:[{fn:'roEnd'}]},                                                 // Running Out ends: the strike
    {on:'end:tsPourW',do:[{fn:'pourEnd'}]},                                            // the glass's pour ends: it empties (Pour Again refills)
    {on:'tick',do:[{fn:'tk'}]},                                                        // Turnover's clock, Running Out, Clear, the signature's watch, the heal budget
    {on:'wave',do:[{fn:'wave'}]}                                                       // a wave starts
  ],
  talents:{
    /* ============================== THE LEDGER ============================== */
    lg_1_1:[ {param:'dr.thief',add:R(0.03)} ],                                                     // Calm Thief (drK: while a theft runs, 5 s)
    lg_1_2:[ {stat:{aspd:R(0.004)},per:'tsSand',to:{team:'ally'}} ],                               // Upper Chamber (Sand: cast)
    lg_1_4:[ {param:'qf',add:R(0.06)} ],                                                           // Quick Fingers (cast)
    lg_2_2:[ {param:'sand.max',add:R(1)} ],                                                        // Deep Glass
    lg_2_3:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'tsDebt'}} ],                              // Written Down (Debt: debt)
    lg_3_1:[ {param:'ss.k',add:R(0.01)} ],                                                         // Light Touch (kit: the steal x (1 + it))
    lg_3_2:[ {param:'ss.full',add:1} ],                                                            // Full Glass (kit, cast)
    lg_3_4:[ {on:'cd',less:R(0.01)} ],                                                             // Patient Ledger
    lg_4_1:[ {param:'acc.k',add:R(0.015)} ],                                                       // Sharp Accelerate (kit)
    lg_n1:[  {param:'calm',add:1} ],                                                               // Borrowed Calm (LINK: addSand; Clear with Wiped Clean)
    lg_4_3:[ {param:'debt.dur',add:R(0.5)} ],                                                      // Interest
    lg_4_4:[ {stat:{aspd:R(0.01)},per:'tsPk'} ],                                                   // A Minute Off (Pocketed: cast)
    lg_8_1:[ {param:'debt.more',add:R(0.01)} ],                                                    // Compound (teamIn)
    lg_5_2:[ {stat:{move:R(0.02)},to:{team:'ally',has:'tsGot'}} ],                                 // Swift Ally
    lg_5_4:[ {param:'pk.dur',add:R(1)} ],                                                          // Deep Pockets
    lg_9_1:[ {param:'called',add:1} ],                                                             // Called In (calledIn)
    lg_6_2:[ {param:'acc.dur',add:R(0.2)} ],                                                       // Measured Pace (kit)
    lg_8_2:[ {param:'lent',add:R(0.01)} ],                                                         // Lent Hours (teamIn)
    lg_6_4:[ {param:'risk',add:R(0.03)}, {param:'ss.k',add:R(0.04)} ],                             // Living on Credit (RISK)
    lg_7_1:[ {param:'mag',add:R(0.02)} ],                                                          // Keen Eye (out)
    lg_7_3:[ {param:'att',add:1} ],                                                                // Accelerate the Theft (cast)
    lg_5_1:[ {param:'ss.k',add:0.15}, {on:'cd',skill:'blue',add:2} ],                              // Grand Theft (PICK ONE)
    lg_5_3:[ {param:'ss.k',add:-0.10}, {on:'cd',skill:'blue',add:-3} ],                            // Petty Theft (PICK ONE)
    lg_9_3:[ {param:'att.k',add:R(0.01)} ],                                                        // Stolen Edge (cast)
    lg_9_4:[ {stat:{move:R(-0.02)},to:{team:'enemy',has:'tsRob'}} ],                               // Sand in the Gears
    lg_6_1:[ {param:'bold',add:R(0.02)} ],                                                         // Bold Hand (srcK; Grand Theft is its prerequisite)
    lg_6_3:[ {param:'msh',add:R(2)} ],                                                             // Many Small Hours (cast; Petty Theft is its prerequisite)
    lg_8_4:[ {stat:{cdRate:R(0.03)},to:'self',if:{stackMin:{tsPk:3}}} ],                           // Pocket Watch (her Green and Blue recover faster)
    lg_10_2:[ {stat:{apow:R(0.003)},per:'tsSand'} ],                                               // Running Total
    lg_10_3:[ {param:'uw.off',add:R(0.3)} ],                                                       // Clean Books (wave: u._talUwOff, at most 1.5 s in all)
    lg_10_4:[ {param:'pk.heal',add:R(0.01)} ],                                                     // Pickpocket (cast)
    lg_11_1:[ {param:'dr.hfy',add:R(0.015)} ],                                                     // Hundred and Forty Years (drK)
    lg_11_3:[ {param:'bh',add:0.20} ],                                                             // Borrowed Hourglass (cast)
    lg_11_4:[ {param:'dr.auto',add:R(0.01)} ],                                                     // Steady Grip (drK)
    lg_12_2:[ {stat:{aspd:R(-0.004)},to:{team:'enemy',has:'tsDebt'}} ],                            // Time Owed
    lg_12_3:[ {param:'bh.k',add:R(0.01)} ],                                                        // Glassful
    lg_12_4:[ {param:'sand.start',add:R(1)} ],                                                     // Spare Change (wave)
    lg_13_3:[ {param:'wa',add:1} ],                                                                // Whose Afternoon (SIGNATURE: cast)

    /* ============================== UNWINDING ============================== */
    uw_1_1:[ {param:'dr.bur',add:R(0.006)} ],                                                      // Lift It Off (Burden: uwAfter; drK)
    uw_2_3:[ {param:'uw.off',add:R(0.3)} ],                                                        // Quick Unwind
    uw_1_4:[ {on:'ccIn',less:R(0.05),upTo:0.15} ],                                                 // Grains of Calm (up to 15%)
    uw_2_1:[ {param:'bur.max',add:R(1)} ],                                                         // Heavier Glass
    uw_2_2:[ {param:'clr',add:R(1)} ],                                                             // Wiped Clean (unwound; Clear: tk)
    uw_3_1:[ {param:'carry',add:1} ],                                                              // Carry It (unwound)
    uw_3_3:[ {param:'kind',add:R(0.08)} ],                                                         // Kind Hands (unwound)
    uw_3_4:[ {param:'acc.dur',add:R(0.2)} ],                                                       // Wide Accelerate (kit)
    uw_4_1:[ {stat:{armor:R(0.005)},per:'tsBur'} ],                                                // Shouldered
    uw_4_2:[ {param:'clr.dr',add:R(0.02)} ],                                                       // Clear Air (drK; teamIn)
    uw_4_4:[ {param:'pour',add:R(0.03)} ],                                                         // Tip the Glass (addBur; srcK)
    uw_5_1:[ {param:'grief',add:R(0.005)} ],                                                       // Grief Kept (addBur)
    uw_5_2:[ {param:'careful',add:1} ],                                                            // Careful Hand (PICK ONE: uwPick, uwAfter)
    uw_5_3:[ {param:'wide',add:1} ],                                                               // Wide Hand (PICK ONE: uwAfter)
    uw_5_4:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',has:'tsPour'}} ],                              // Heavy Pour
    uw_6_1:[ {param:'dr.mag',add:R(0.01)} ],                                                       // Settled Sand (drK)
    uw_6_2:[ {param:'dlift',add:R(0.02)} ],                                                        // Double Lift (uwAfter; Careful Hand is its prerequisite)
    uw_6_3:[ {param:'mhands',add:R(0.3)} ],                                                        // Many Hands (uwAfter; Wide Hand is its prerequisite)
    uw_6_4:[ {param:'risk',add:R(0.03)}, {param:'uw.off',add:R(0.4)} ],                            // Glass Heart (RISK)
    uw_7_1:[ {param:'mend',add:R(0.03)} ],                                                         // Mending Sand (healOn, shieldOn)
    uw_7_2:[ {param:'ct',add:1} ],                                                                 // Clean Theft (cast)
    uw_7_4:[ {on:'teamHeal',if:{unitHas:'tsPour'},less:R(0.02)} ],                                 // Spilled
    uw_8_1:[ {param:'dr.load',add:R(0.03)} ],                                                      // Load Bearer (drK)
    uw_8_4:[ {param:'pour.dur',add:R(1)} ],                                                        // Back to Them
    uw_9_1:[ {param:'pig',add:0.04} ],                                                             // Put It in the Glass (addBur)
    uw_9_2:[ {stat:{move:R(0.02)},to:{team:'ally',has:'tsCtR'}} ],                                 // Clear Run (Clean Theft's ally while Clear)
    uw_9_3:[ {param:'acc.k',add:R(0.01)} ],                                                        // Patient Sand (kit)
    uw_10_1:[ {param:'bur.keep',add:R(1)} ],                                                       // Long Carry (wave)
    uw_10_4:[ {param:'pour.again',add:R(1)} ],                                                     // Pour Again (pourEnd)
    uw_11_1:[ {stat:{heal:R(0.003)},per:'tsBur'} ],                                                // Weight of Years
    uw_11_2:[ {param:'hog',add:1} ],                                                               // Hourglass of Grief (cast)
    uw_11_4:[ {param:'quiet',add:R(0.005)} ],                                                      // Quiet Sand (teamIn)
    uw_12_1:[ {param:'pour.more',add:R(0.01)} ],                                                   // Steady Pour (teamIn)
    uw_12_2:[ {param:'hog.st',add:R(0.06)} ],                                                      // Sorrow Glass (ccHit)
    uw_8_3:[ {on:'cd',less:R(0.01)} ],                                                             // Gentle Turn
    uw_12_4:[ {param:'clr.bur',add:R(0.1)} ],                                                      // Ledger of Griefs (unwound)
    uw_13_2:[ {param:'nltl',add:1} ],                                                              // Nothing Left to Lift (SIGNATURE: tk)

    /* ============================== THE BROKEN GLASS ============================== */
    bg_1_1:[ {param:'sharp',add:R(0.03)} ],                                                        // Sharp Mind (moment)
    bg_1_3:[ {param:'gr.k',add:R(0.12)} ],                                                         // Stinging Grains (grain, moment)
    bg_1_4:[ {param:'range',add:R(0.03)} ],                                                        // Fine Sand (wave)
    bg_2_2:[ {param:'ro.k',add:R(0.20)} ],                                                         // Last Grains (Running Out: tk, roStrike)
    bg_2_3:[ {param:'gr.dur',add:R(1)} ],                                                          // Heavy Grains
    bg_3_1:[ {param:'dr.grain',add:R(0.015)} ],                                                    // Unshaken Glass (drK)
    bg_4_2:[ {param:'ro.fast',add:R(0.5)} ],                                                       // Faster Fall
    bg_3_3:[ {param:'lm',add:1} ],                                                                 // Lost Moments (cast)
    bg_3_4:[ {param:'mag',add:R(0.02)} ],                                                          // Shard Edge (out)
    bg_4_1:[ {stat:{cdRate:R(0.04)},to:'self',if:{window:'tsTurn'}} ],                             // Turn It Over (Turnover: tk)
    bg_5_2:[ {param:'gr.need',add:2}, {param:'mom',add:0.3} ],                                     // Slow Sand (PICK ONE)
    bg_4_4:[ {param:'hg.rad',add:R(0.03)} ],                                                       // Bigger Shatter (kit)
    bg_5_4:[ {param:'gr.need',add:-2}, {param:'mom',add:-0.1} ],                                   // Quick Sand (PICK ONE)
    bg_5_1:[ {param:'turn.fast',add:R(0.5)} ],                                                     // Quick Turn
    bg_6_2:[ {param:'mom.nrg',add:R(4)} ],                                                         // Heavy Moment (moment; Slow Sand is its prerequisite)
    bg_5_3:[ {param:'hg.k',add:R(0.03)} ],                                                         // Shatter Point (kit)
    bg_6_4:[ {param:'mom.slow',add:R(0.05)} ],                                                     // Rapid Grains (moment; Quick Sand is its prerequisite)
    bg_6_1:[ {param:'risk',add:R(0.02)}, {param:'ro.risk',add:R(0.06)} ],                          // Cracked Heart (RISK)
    bg_10_2:[ {param:'hg.ro',add:R(0.04)} ],                                                       // Sand's Edge (out)
    bg_6_3:[ {param:'shard',add:R(0.01)} ],                                                        // Shard Spray (cast; teamIn)
    bg_7_2:[ {param:'ae',add:1} ],                                                                 // Accelerated End (cast, roStrike)
    bg_7_4:[ {stat:{aspd:R(0.03)},if:{fn:'tgtGrains'}} ],                                          // Brisk Hands
    bg_8_1:[ {param:'turn.nrg',add:R(2)} ],                                                        // Turned Twice
    bg_8_3:[ {param:'hg.st',add:R(0.05)} ],                                                        // Second Shatter (ccHit)
    bg_8_4:[ {param:'gbg',add:R(0.003)} ],                                                         // Grain by Grain (out)
    bg_9_1:[ {param:'dr.mag2',add:R(0.01)} ],                                                      // Well Kept (drK)
    bg_9_2:[ {param:'ae.k',add:R(0.03)} ],                                                         // Hastened End
    bg_9_4:[ {param:'storm',add:1} ],                                                              // Sand Storm (moment)
    bg_10_1:[ {param:'turn.dmg',add:R(0.02)} ],                                                    // Upturned (out)
    bg_10_3:[ {param:'ntl',add:R(0.01)} ],                                                         // No Time Left (srcK)
    bg_11_1:[ {param:'uw.off',add:R(0.2)} ],                                                       // Clear Sight
    bg_11_2:[ {param:'egf',add:1} ],                                                               // Every Grain Falls (cast)
    bg_11_4:[ {param:'odp',add:R(0.01)} ],                                                         // Old Debt Paid (roStrike)
    bg_12_1:[ {param:'turn.dur',add:R(0.5)} ],                                                     // Spin the Glass
    bg_12_2:[ {param:'egf.k',add:R(0.03)} ],                                                       // Last Grain (roStrike)
    bg_12_3:[ {param:'mom',add:R(0.03)} ],                                                         // Long Fall
    bg_13_2:[ {param:'tsro',add:1} ]                                                               // The Sand Runs Out (SIGNATURE: ccHit, cast)
  },
  fn:{
    /* ---- conditions ---- */
    tgtGrains(A,T,u){ const t=u.target; return !!t&&t.alive&&t.team!==u.team&&ust(A,T,u,t,'tsGr')>0; },
    /* ---- a skill of hers resolves (kit: before its case; ctx.o is the copy it reads) ---- */
    kit(A,T,u,c){ const s=T.s, Pm=T.P, o=c.o||{}, E=A.eng(), lv=(u._castLv|0)||1; s.tsSS=null; s.tsHg=null;
      if(c.skill==='spdsteal'){ const tot=E.skLvNum?E.skLvNum('spdsteal',o,lv):((o.pct||0.35)+(o.perLv||0)*lv), k=Math.max(0,1+(Pm['ss.k']||0)), p=tot*k; o.pct=(o.pct||0.35)+(p-tot);
        const F=foes(A,u), M=mates(A,u), v=(o._tgtU&&o._tgtU.alive)?o._tgtU:fastest(F,allySpd), a=fastest(M,allySpd);   // the case's own choice (its fallback reads a.atkSpeed too)
        const S={v,a,p,d:o.dur||5,full:!!(Pm['ss.full']&&sandFull(A,T,u))}; if(S.full){ S.v2=fastest(F,speedOf,v); S.a2=fastest(M,allySpd,a); } s.tsSS=S; return; }
      if(c.skill==='dmgbuff'){ const tot=E.skLvNum?E.skLvNum('dmgbuff',o,lv):(o.mul||1.25), k=Pm['acc.k']||0; if(k) o.mul=(o.mul||1.25)+(tot-1)*k; if(Pm['acc.dur']) o.dur=(o.dur||6)+Pm['acc.dur']; return; }
      if(c.skill==='aoeStun'&&u._castSlot==='ult'){ if(Pm['hg.rad']) o.radius=(o.radius||110)*(1+Pm['hg.rad']); if(Pm['hg.k']) o.mul=(o.mul||1.2)*(1+Pm['hg.k']); s.tsHg={st:[],c:null,r:o.radius||110}; } },
    /* Hourglass lands: its centre */
    at(A,T,u,c){ const h=T.s.tsHg; if(c.skill==='aoeStun'&&h&&c.c) h.c={x:c.c.x,y:c.c.y}; },
    /* a stun of hers landed: Hourglass's own is lengthened (Second Shatter, Sorrow Glass, The Sand Runs Out: in full, at most 4.0 s in all); every stun of hers
       sets the stun-lock mark (0.5 s after it ends) */
    ccHit(A,T,u,c){ const t=c.tgt, Pm=T.P, s=T.s; if(c.field!=='stunned'||!t||c.talent) return; const h=s.tsHg;
      if(h&&s.cur==='aoeStun'){ let x=(Pm['hg.st']||0)+(Pm.hog?(Pm['hog.st']||0):0)+(Pm.tsro?1:0); if(x>0) t.stunned=Math.max(t.stunned||0,Math.min(STUN_MAX,A.stunRoom(t),(c.amt||0)+x));   /* v1452: never a run past 4.0 s (it reached 5.25 s) */ if(h.st.indexOf(t)<0) h.st.push(t); }
      A.setMark(T,u,t,'tsLk',{dur:(t.stunned||0)+0.5}); },
    /* after the skill */
    cast(A,T,u,c){ const s=T.s, Pm=T.P, E=A.eng();
      if(c.skill==='spdsteal'){ const S=s.tsSS; s.tsSS=null; if(!S||!S.v||!S.a||!(S.a._ocT===S.d&&Math.abs((S.a._ocMul||0)-(1+S.p))<1e-12)) return;   // the case wrote its steal (it stops when it has no victim or no ally)
        const pairs=[[S.v,S.a]]; if(S.full&&S.v2&&S.a2){ robOn(S.v2,S.p,S.d); giveOn(S.a2,S.p,S.d,true); pairs.push([S.v2,S.a2]); }   // Full Glass: the two fastest enemies to the two fastest allies
        s.tsSsN=(s.tsSsN||0)+1;
        for(const [v,a] of pairs){
          A.acts(T,u,[{mark:'tsRob',on:'target',dur:S.d,ends:'tsRobEnd'}],{u,tgt:v}); A.setMark(T,u,a,'tsGot',{dur:S.d,longest:true});
          if(Pm.qf) mhurt(A,T,u,v,Pm.qf*u.apow,'tsQf');
          if(Pm.msh&&v.alive){ const n=Math.min(Pm.msh,v.energy||0); v.energy=(v.energy||0)-n; a.energy=Math.min(100,(a.energy||0)+n); }
          if(Pm.lm&&v.alive){ const N=need(T), cur=ust(A,T,u,v,'tsGr'); if(cur<Math.min(6,N)) addGr(A,T,u,v,Math.min(6,N)-cur); }
          if(Pm.ct&&a.alive){ const l=lift(a); unwound(A,T,u,a,l?[l]:[],0); clearOn(A,T,u,a,2); A.setMark(T,u,a,'tsCtR',{dur:2}); } }
        addSand(A,T,u,pairs.length);
        if(PK.some(id=>T.r[id])){ const n0=A.stGet(T,'tsPk'); A.acts(T,u,[{stack:'tsPk',add:1},{stack:'tsPk',touch:true}],{u}); if(A.stGet(T,'tsPk')>n0&&Pm['pk.heal']) healOn(A,T,u,u,Pm['pk.heal']*u.maxHp); }
        A.acts(T,u,[{window:'tsThief',dur:S.d}],{u}); return; }
      if(c.skill==='dmgbuff'){ const o=c.o||{}, d=o.dur||6; s.tsAccN=(s.tsAccN||0)+1;
        if(Pm.att){ addSand(A,T,u,1); const a=fastest(mates(A,u),allySpd); const bl=u.blueAb||{}, lv=(u.skillLv&&u.skillLv[2])||1;
          const p=(E.skLvNum?E.skLvNum('spdsteal',bl,lv):0.35)*Math.max(0,1+(Pm['ss.k']||0))/3*(1+(Pm['att.k']||0)); if(a&&p>0){ giveOn(a,p,d,false); A.setMark(T,u,a,'tsGot',{dur:d,longest:true}); } }
        if(Pm.ae){ A.acts(T,u,[{window:'tsAcc',dur:d}],{u}); for(const e of foes(A,u)) if(e.hp<0.30*e.maxHp) roStart(A,T,u,e,'acc'); }
        return; }
      if(c.skill==='aoeStun'&&s.tsHg){ const h=s.tsHg; s.tsHg=null; s.tsHgN=(s.tsHgN||0)+1; const L=h.st.filter(e=>e.alive), ctr=h.c||u, I=foes(A,u).filter(e=>Math.hypot(e.x-ctr.x,e.y-ctr.y)<h.r);
        if(Pm.shard) for(const e of L) A.setMark(T,u,e,'tsShard',{dur:4});
        if(Pm.bh){ const p=Pm.bh*(1+(Pm['bh.k']||0)); for(const e of L){ robOn(e,p,5); A.setMark(T,u,e,'tsRob',{dur:5,longest:true}); const a=A.pick(T,u,{team:'ally',of:'target',order:'near',n:1},{u,tgt:e})[0]; if(a){ giveOn(a,p,5,false); A.setMark(T,u,a,'tsGot',{dur:5,longest:true}); } } }
        if(Pm.wa&&sandFull(A,T,u)){ A.stSet(T,u,'tsSand',0); s.tsWaN=(s.tsWaN||0)+1;                       // Whose Afternoon: the glass empties
          for(const e of I){ robOn(e,0.40,6); A.setMark(T,u,e,'tsRob',{dur:6,longest:true}); A.acts(T,u,[{mark:'tsRobW',on:'target',dur:6,ends:'tsRobWEnd'}],{u,tgt:e}); }
          for(const a of mates(A,u)){ if(a._summon) continue; giveOn(a,0.40,6,false); A.setMark(T,u,a,'tsGot',{dur:6,longest:true}); } }
        if(Pm.hog){ const n=A.stGet(T,'tsBur'); if(n>0&&L.length){ for(const e of L) pourOn(A,T,u,e); A.stSet(T,u,'tsBur',0); }   // Hourglass of Grief: every Burden poured into the enemies it stunned
          for(const a of mates(A,u)) if(!a._summon) lift(a); }
        if(Pm.egf){ const N=need(T); for(const e of I){ if(!e.alive) continue; const cur=ust(A,T,u,e,'tsGr'); addGr(A,T,u,e,N-cur); if(e.alive&&e.hp<0.50*e.maxHp) roStart(A,T,u,e,'egf'); } }
        if(Pm.tsro){ for(const e of foes(A,u)) if(mk(A,u,e,'tsRun')){ T.fn.dropTm(A,T,e); A.clearMark(u,e,'tsRun'); roStrike(A,T,u,e); }   // The Sand Runs Out: every Running Out strikes at once
          turn(A,T,u,3); s.tsTnC=turnPer(T); } } },
    dropTm(A,T,e){ const tm=T.s.tm; for(let i=0;i<tm.length;i++) if(tm[i].t===e&&tm[i].name==='tsRun'){ tm.splice(i,1); break; } },
    /* ---- Unwind (the page's passive; ctx.o.hurt = the allies it could cleanse) ---- */
    uwPick(A,T,u,c){ const Pm=T.P, s=T.s; let a=c.tgt;
      if(Pm.careful&&c.o&&c.o.hurt){ let b=null,bn=-1; for(const x of c.o.hurt){ const n=effs(x); if(n>bn){ bn=n; b=x; } } if(b) a=b; c.tgt=a; }
      s.tsUwS=a?{a,d:(a.dots||[]).length,last:(a.dots&&a.dots.length)?a.dots[a.dots.length-1]:null,st:a.stunned||0,si:a.silencedT||0,sl:a.slow||0,mo:a.mortalT||0,hurt:(c.o&&c.o.hurt)||[]}:null; },
    uwAfter(A,T,u,c){ const Pm=T.P, s=T.s, S=s.tsUwS, a=c.tgt; s.tsUwS=null; if(!S||!a||S.a!==a) return; s.tsUwN=(s.tsUwN||0)+1;
      let l=null; if((a.dots||[]).length<S.d) l={k:'dot',d:S.last}; else if(S.st>0&&!(a.stunned>0)) l={k:'stun'}; else if(S.si>0&&!(a.silencedT>0)) l={k:'silence'}; else if(S.sl>0&&!(a.slow>0)) l={k:'slow'}; else if(S.mo>0&&!(a.mortalT>0)) l={k:'mortal'};
      const got=l?[l]:[];
      if(Pm.careful){ const l2=lift(a); if(l2) got.push(l2); }                                  // Careful Hand: a second effect off the same ally
      let wide=0; if(Pm.wide&&(s.tsUwN%2===0)){ let b=null,bn=0; for(const x of S.hurt){ if(x===a||!x.alive) continue; const n=effs(x); if(n>bn){ bn=n; b=x; } }   // Wide Hand: every second Unwind, a second ally
        if(b){ const l3=lift(b); if(l3){ wide=1; unwound(A,T,u,b,[l3],Pm.mhands||0); } } }
      unwound(A,T,u,a,got,wide?(Pm.mhands||0):0);
      if(Pm.careful&&Pm.dlift&&got.length) healOn(A,T,u,a,Pm.dlift*a.maxHp*(u.healPowMul||1)); },
    /* ---- her hits ---- */
    out(A,T,u,c){ const t=c.tgt, Pm=T.P, s=T.s; if(!t||t.team===u.team||!(c.amt>0)) return; let k=1;
      if(Pm.mag&&c.kind==='magic') k*=1+Pm.mag;
      if(Pm.gbg){ const g=ust(A,T,u,t,'tsGr'); if(g>0) k*=1+Pm.gbg*g; }
      if(Pm['turn.dmg']&&A.winOn(T,'tsTurn')) k*=1+Pm['turn.dmg'];
      if(Pm['hg.ro']&&s.cur==='aoeStun'&&mk(A,u,t,'tsRun')) k*=1+Pm['hg.ro'];
      c.amt*=k; },
    /* her basic attack has landed on an enemy: a Grain */
    grain(A,T,u,c){ const t=c.tgt; if(!t||!t.alive||t.team===u.team) return; addGr(A,T,u,t,1); },
    /* ---- her damage reduction (one capped group), then the RISK talents (Living on Credit, Glass Heart, Cracked Heart) ---- */
    drK(A,T,u,src,kind,auto){ return drK(A,T,u,src,kind,auto); },
    myDr(A,T,u,c){ c.amt*=drK(A,T,u,c.src,c.kind,c.auto)*risk(T); },
    myDrDot(A,T,u,c){ const d=c.dot||{}; c.amt*=drK(A,T,u,d.src||c.src,d.kind,false)*risk(T); },
    /* her team's hits on an enemy (Compound, Steady Pour, Shard Spray, Lent Hours); an enemy's hit on an ally of hers (ONE capped group: at most 25% off the hit) */
    teamIn(A,T,u,c){ const t=c.tgt, x=c.src, Pm=T.P; if(!t||!x) return;
      if(t.team!==u.team&&x.team===u.team){ let k=1; if(Pm['debt.more']&&mk(A,u,t,'tsDebt')) k*=1+Pm['debt.more']; if(Pm['pour.more']&&mk(A,u,t,'tsPour')) k*=1+Pm['pour.more'];
        if(Pm.shard&&mk(A,u,t,'tsShard')) k*=1+Pm.shard; if(Pm.lent&&mk(A,u,x,'tsGot')) k*=1+Pm.lent; c.amt*=k; return; }
      if(t.team===u.team&&x.team!==u.team&&t!==u){ let f=srcK(A,T,u,x); if(mk(A,u,t,'tsCalm')) f*=0.96; if(Pm['clr.dr']&&mk(A,u,t,'tsClr')) f*=1-Pm['clr.dr'];
        if(Pm.quiet&&u.alive){ const E=A.eng(); if(E.dist(u,t)/E.METER()-E.bodyR(u)/E.METER()-E.bodyR(t)/E.METER()<5) f*=1-Pm.quiet; }
        c.amt*=Math.max(1-ALLY_CAP,f); } },
    /* an enemy in Debt dies: Called In */
    calledIn(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team||!mk(A,u,x,'tsDebt')) return; for(const a of mates(A,u)) if(!a._summon) a.energy=Math.min(100,(a.energy||0)+5); addSand(A,T,u,1); T.s.tsCalled=(T.s.tsCalled||0)+1; },
    /* a theft ends: Debt (the signature's: twice as long) */
    debt(A,T,u,c,a){ const e=c.tgt; if(!e||!e.alive) return; const d=(3+(T.P['debt.dur']||0))*((a&&a.k)||1); A.setMark(T,u,e,'tsDebt',{dur:d,longest:true}); },
    roEnd(A,T,u,c){ const e=c.tgt; if(!e||!e.alive) return; roStrike(A,T,u,e); },
    /* the glass's pour has ended: the Burden empties, Pour Again refills it */
    pourEnd(A,T,u){ A.stSet(T,u,'tsBur',Math.min(A.stMax(T,u,'tsBur'),T.P['pour.again']||0)); },
    /* ---- each tick ---- */
    tk(A,T,u,c){ const s=T.s, Pm=T.P, dt=c.dt||0, E=A.eng();
      if(s.tsHb!=null&&s.tsHb<HEAL_PS*HEAL_HOLD*u.maxHp) s.tsHb=Math.min(HEAL_PS*HEAL_HOLD*u.maxHp,s.tsHb+HEAL_PS*u.maxHp*dt);   // the budget refills at 1.2% a second, holding at most 3 s of it
      if(TURN.some(id=>T.r[id])){ if(s.tsTnC==null) s.tsTnC=turnPer(T); s.tsTnC-=dt; if(s.tsTnC<=1e-9){ s.tsTnC+=turnPer(T); turn(A,T,u,1); } }
      if(RO.some(id=>T.r[id])){ const U=s.tsRoU||(s.tsRoU={}); for(const e of foes(A,u)){ if(e.hp<0.30*e.maxHp){ if(!U[e.uid]){ U[e.uid]=1; roStart(A,T,u,e,'hp'); } } else U[e.uid]=0; } }
      if(s.tsClrL&&s.tsClrL.length) T.fn.clrTick(A,T,u,dt);
      if(Pm.nltl&&s.tsNl!==s.wave&&burFull(A,T,u)){ const M=mates(A,u).filter(a=>!a._summon); if(M.some(a=>a.hp<0.30*a.maxHp)) T.fn.nltl(A,T,u,M); } },
    /* Clear: each tick, a negative effect that is new on a Clear unit (a timer that rose, a DoT not seen before) is cut to half its length */
    clrTick(A,T,u,dt){ const L=T.s.tsClrL, F=['stunned','fearT','silencedT','_sleepT','slow','mortalT'];
      for(let i=0;i<L.length;i++){ const a=L[i]; if(!a.alive||!mk(A,u,a,'tsClr')){ if(a._tsClrP) a._tsClrP=null; L.splice(i--,1); continue; }
        const p=a._tsClrP||(a._tsClrP={});
        for(const f of F){ const v=a[f]||0, was=p[f]; if(was!=null&&v>was+1e-9){ a[f]=Math.max(was,v/2); T.s.tsClrCut=(T.s.tsClrCut||0)+1; } p[f]=a[f]||0; }
        if(a.dots) for(const d of a.dots){ if(d._tsClr) continue; d._tsClr=1; if(p.seen){ d.remaining=Math.max(1,Math.round(d.remaining/2)); T.s.tsClrCut=(T.s.tsClrCut||0)+1; } }
        p.seen=1; } },
    /* Nothing Left to Lift (once per wave, full Burden, an ally under 30%): every ally cleansed, Clear 5 s, shielded 2% of its max HP per Burden; every enemy Poured */
    nltl(A,T,u,M){ const s=T.s, n=A.stGet(T,'tsBur'); s.tsNl=s.wave; s.tsNlN=(s.tsNlN||0)+1;
      for(const a of M){ A.acts(T,u,[{cleanse:'all',on:'target'}],{u,tgt:a}); clearOn(A,T,u,a,5); shieldOn(A,T,u,a,0.02*n*a.maxHp,5); }
      for(const e of foes(A,u)) pourOn(A,T,u,e); },
    /* ---- a wave starts (the fight clock restarts at 0): Sand at Spare Change's level, Burden kept up to Long Carry, her per-enemy bookkeeping cleared ---- */
    wave(A,T,u){ const s=T.s, Pm=T.P;
      if(Pm['sand.start']) A.stSet(T,u,'tsSand',Pm['sand.start']);
      if(BUR.some(id=>T.r[id])&&s.wave>1) A.stSet(T,u,'tsBur',Math.min(A.stGet(T,'tsBur'),Pm['bur.keep']||0));
      if(s.w.tsPourW) s.w.tsPourW.t=0;
      s.tsRoU={}; s.tsRoO={}; s.tsSS=null; s.tsHg=null; s.tsUwS=null;
      u._talUwOff=Math.min(UW_CAP,Pm['uw.off']||0)||undefined;
      if(Pm.range&&!u._tsRg){ u._tsRg=1; u.range=(u.range||0)*(1+Pm.range); }
      if(s.tsHb==null) s.tsHb=HEAL_PS*u.maxHp;
      s.tsApi=A; }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (readings and corrected tooltips in WIRING/55 - TESSIT - talent decisions.md) */
  ruling:{}
};
