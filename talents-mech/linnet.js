/* LINNET - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Linnet")
   Her real kit (the code, not the tooltip wording; a ranged Support, damage profile Healer: her hits are magic):
   - Mending Stitch ('mendburst', green, cd 7): the engine's lowestAlly(u) (lowest HP SHARE, herself included: 26 of 143 casts in 20 seeded fights) is
     healed through healFrom (her caster heal: healing power applies; the healOut hook sees it) by 50% of ITS max HP x the skill multiplier (109% at skill
     level 100), then a heal over time of 6.5% of its max HP x the skill multiplier each second for o.dur = 6 s (pushHot, no caster: her rows make it hers,
     tag 'mend'). Measured: only 27% of the burst fits (the ally stood at 77% HP, median).
   - Reinforced Seam ('lastbreath', blue, cd 10; the case is shared with Joss's Sanctuary Guard): the ally with the lowest HP share (herself included) gets a
     shield of 1.8 x her ability power x the skill multiplier (the larger stays) for o.dur = 5 s and the game's Dawnward hold (_wardT, cannot fall below 1 HP)
     for the same 5 s - the hold lasts its 5 s even when the shield breaks first (17 of 97 shields did).
   - Rewrite the Pattern (ultimate 'rewind', on energy; ULT_DEF.rewind back 5, revive 0.4, perLv 0.0015; no HERO_ULT_ART entry): every unit of her side (not
     summons, not a hidden one) with a health history (_hpHist, one sample every 0.5 s, ten deep: [0] is 4.5 to 5 s ago) is raised to that old HP if it was
     higher (healFrom: her heal), and the fallen come back at (40% + 0.15 points a level) of it. 88 casts in 20 fights.
   - Golden Thread (passive 'goldthread'): each tick the thread goes to the ally (not herself) with the lowest HP share (u._gtTo); healUnit passes
     40% x passMul of what a heal on HER restored to that ally. At full health she passes nothing (107 of 170 heals she received).
   Stitches, Loose, Knots, Spindle, Tautline, Gilt, Frayed, Unpicked and the Bobbin exist only through her talents.
   Readings, caps and corrected tooltips: WIRING/35 - LINNET - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const MEND='mendburst', SEAM='lastbreath', REW='rewind', COL='#f0c86a';
/* the families whose bookkeeping runs when any of their talents is learned */
const STITCH=['ml_1_1','ml_2_1','ml_3_1','ml_3_3','ml_6_3','ml_7_1','ml_8_1','ml_9_1','ml_10_1','ml_11_1','ml_11_2','ml_12_1','ml_12_3','ml_13_2','ml_n1'];
const LOOSE=['ml_2_2','ml_4_2','ml_6_4','ml_6_2','ml_7_2','ml_9_2','ml_11_2','ml_13_2'];
const KNOT=['ml_4_4','ml_5_4','ml_7_4','ml_8_4','ml_10_4','ml_12_4'];
const SEAMK=KNOT.concat(['ml_7_2','ml_9_2','gl_7_3','gl_9_3','sh_7_3','sh_9_3','ml_13_2','gl_13_3']);   // where Reinforced Seam lands, and when it ends
const GILT=['gl_4_4','gl_5_4','gl_7_4','gl_8_4','gl_10_2','gl_10_4','gl_11_3','gl_11_4','gl_13_3'];
const THREAD=['gl_1_2','gl_2_2','gl_2_3','gl_3_1','gl_3_2','gl_5_1','gl_5_3','gl_4_3','gl_6_1','gl_6_3','gl_6_4','gl_8_2','gl_7_3','gl_8_1','gl_9_1','gl_9_4','gl_11_3','gl_12_1','gl_12_2','gl_12_4','gl_13_3'].concat(GILT);
const PASS=['gl_2_3','gl_3_1','gl_3_2','gl_5_1','gl_5_3','gl_4_3','gl_6_4','gl_7_3','gl_11_3','gl_12_2'];   // the thread's share changed
const FRAY=['sh_1_1','sh_1_4','sh_2_4','sh_3_1','sh_4_4','sh_6_4','sh_8_4','sh_9_4','sh_10_4','sh_12_2','sh_3_4','sh_13_3','ml_n1'];
const UNPICK=['sh_2_3','sh_4_3','sh_5_4','sh_7_3','sh_9_3'];
const BOBBIN=['sh_4_1','sh_5_1','sh_7_1','sh_8_1','sh_10_1','sh_12_1'];
const RWK=['ml_11_2','ml_12_2','ml_13_2','gl_11_3','gl_12_3','sh_4_1','sh_5_2','sh_5_3','sh_6_2','sh_6_3','sh_11_3','sh_12_3','sh_13_3'];   // Rewrite the Pattern changed
const LOG=['sh_11_3','sh_12_3'];          // the damage each enemy dealt her side (The Last Rows)
const HEALK=['ml_1_3','gl_4_1','ml_9_3','ml_7_1','sh_5_4','gl_8_1','gl_6_2','sh_10_1','sh_9_2','sh_6_1','ml_5_2','ml_5_3','ml_9_1','gl_13_3','ml_2_2','ml_6_4','ml_6_2','ml_13_2'];   // her heals changed
const SELF=['gl_1_1','gl_5_2','gl_11_1','sh_1_1','sh_8_2','sh_11_4','ml_11_1','ml_n1','ml_6_4'].concat(STITCH,KNOT,['sh_6_2']);   // hits on her
const ALLY=STITCH.concat(['ml_5_4','gl_7_4','gl_6_1','gl_6_3','sh_6_2','ml_n1']);                                                // hits on her allies (their reductions)
const TEAM_OUT=['ml_7_4','gl_8_4','sh_10_4'];                                                                                     // her side's hits on enemies
const DMGK=['sh_1_2','gl_7_1','sh_7_4','sh_12_2','sh_2_2','sh_4_4','sh_6_1'];                                                    // her own damage
const HEALIN=['sh_1_4','sh_2_2','gl_4_4','gl_6_4'];                                                                              // healing others receive
const REC=LOOSE.concat(UNPICK,LOG);
const SPIN=['gl_1_2','gl_8_2','gl_12_4','gl_3_2'];   // Spindle       // hits recorded (Loose, Unpicked, The Last Rows)
const any=(T,L)=>{ const c=T.s.anyC||(T.s.anyC=new Map()); let v=c.get(L); if(v===undefined){ v=L.some(id=>T.r[id]); c.set(L,v); } return v; };
const rk=(T,id)=>T.r[id]||0;
const S=T=>T.s.ln||(T.s.ln={});           // her own per-fight state (one object: no name of the runtime's own is ever used)
const REGEN=0.012;                         // the game's regeneration cap (Phil 4 Oct): Spindle and Spinner's Calm together
const DR_SELF=0.60, DR_ALLY=0.75, TEN=0.80; // her damage-reduction group (at most 40%), the one she gives her allies (at most 25%), her control shortening (at most 20%)
const frac=x=>x.maxHp>0?x.hp/x.maxHp:1;
const isBoss=x=>!!((x.t&&x.t.isboss)||x._raidBoss);
const team=(A,T,u)=>A.pick(T,u,{team:'ally'},{u});                         // her side's heroes, herself too
const allies=(A,T,u)=>A.pick(T,u,{team:'ally',others:true},{u});           // her allies (heroes, not herself)
const stN=(A,T,u,x)=>x?A.ustGet(T,u,x,'lnSt'):0;                           // Stitches on x
const frN=(A,T,u,x)=>x?A.ustGet(T,u,x,'lnFr'):0;                           // Frayed on x
const knN=(T,x)=>{ const k=S(T).kn; return (k&&x&&k[x.uid])||0; };        // Knots in x
const thr=u=>(u._gtTo&&u._gtTo.alive&&u._gtTo!==u)?u._gtTo:null;          // the ally on Golden Thread
const giltOn=(T,x,now)=>{ const g=S(T).gilt, e=g&&x&&g[x.uid]; return !!e&&(e.until>now); };
const look=T=>T.r.sh_5_2?7:(T.r.sh_5_3?3:5);                               // Rewrite the Pattern's look-back (Cut Long / Cut Short)
const looseWin=T=>3+(T.P['loose.dur']||0);
/* the damage a hit does to x's HP, as near as the talent rows can tell before damage() (its skill slot and glyph reduction, then its shield) */
function est(x,a){ let v=a||0; if((x.drT||0)>0) v*=(x.drMul||1); if(x.glyphDR) v*=1-x.glyphDR; return Math.max(0,v-(x.shield||0)); }
/* Loose: what x lost to hits in the last 3 s (Wider Window longer), never more than the HP it is missing */
function looseOf(A,T,u,x){ const o=S(T), L=o.lg&&o.lg[x.uid]; if(!L||!L.length) return 0; const E=A.eng(), t0=E.now()-looseWin(T); let s=0;
  for(let i=L.length-1;i>=0;i--){ if(L[i][0]<t0){ L.splice(0,i+1); break; } s+=L[i][1]; } return Math.max(0,Math.min(s,E.healCap(x)-x.hp)); }
function looseUse(T,x,amt){ const L=S(T).lg&&S(T).lg[x.uid]; if(!L) return; let a=amt; while(a>1e-9&&L.length){ const e=L[0]; if(e[1]<=a){ a-=e[1]; L.shift(); } else { e[1]-=a; a=0; } } }
/* a heal of hers on x made stronger: the skill ('burst' | 'mend' | 'rw'), then her Loose share on top */
function healK(A,T,u,x,kind){ const r=T.r, Pp=T.P, o=S(T), E=A.eng(), now=E.now(); let k=1;
  if(kind!=='rw'){ k+=0.02*rk(T,'ml_1_3')+0.03*rk(T,'gl_4_1'); if(r.ml_9_3&&frac(x)<0.40) k+=0.02*r.ml_9_3; if(r.sh_10_1&&o.bob>=bobMax(T)-1e-9) k+=0.10*r.sh_10_1; }   // Fine Needle, Steady Stitch, Patient Weaver, Bobbin Burst
  else k+=0.02*rk(T,'sh_9_2');                                                                                                                                  // Five Seconds
  if(r.ml_7_1) k+=0.004*r.ml_7_1*stN(A,T,u,x);                                                     // Gentle Pull: per Stitch on it
  if(r.sh_5_4&&o.upd&&(o.upd[x.uid]||-1e9)>=now-4) k+=0.02*r.sh_5_4;                               // Hard Pattern: Unpicked in the last 4 s
  if(r.gl_8_1&&x===thr(u)&&taut(T,u)) k+=0.03*r.gl_8_1;                                            // Drawn Tight: the threaded ally at full Tautline
  if(r.gl_6_2&&x===u) k+=0.02*r.gl_6_2;                                                            // Kind to Herself
  if(r.sh_6_1) k-=0.04*r.sh_6_1;                                                                   // Shears Bite Back (RISK)
  if(kind==='burst'){ if(r.ml_5_2) k*=1.40; else if(r.ml_5_3) k*=0.70; }                         // Quick Stitch / Slow Stitch: the first heal
  if(o.hem&&o.hem[x.uid]){ o.hem[x.uid]=0; k*=2; }                                                 // Hold the Hem: her next heal on them doubled
  if(o.tss&&o.tss.x===x&&now<o.tss.until) k*=2;                                                    // The Thread She Can See: 3 s at double strength
  return Math.max(0,k); }
function looseShare(T,kind){ const r=T.r, o=S(T); if(o.notl&&o.notlT>0) return 1;   // Not One Thread Loose: all of it
  let s=0.03*rk(T,'ml_2_2')+0.06*rk(T,'ml_6_4'); if(kind==='burst'&&r.ml_5_2) s+=0.05*rk(T,'ml_6_2'); return s; }
const bobMax=T=>4+(T.P['bob.max']||0);
/* Tautline: the threaded ally below 50% HP (Breaking Strain higher) */
const tautAt=T=>0.50+(T.P['taut.at']||0);
function taut(T,u){ const x=thr(u); return !!x&&frac(x)<tautAt(T); }
/* the thread's share of a heal on her, made larger by her talents: base = 40% x her passive's strength of what landed */
function threadMul(A,T,u,full){ const r=T.r, Pp=T.P, o=S(T), E=A.eng(), now=E.now(); let k=1;
  if(taut(T,u)) k*=1+0.02*rk(T,'gl_2_3')+0.005*rk(T,'gl_12_2');                                   // Tautline (Draw the Line, Taut Gold)
  if(r.gl_5_3) k*=1.15;                                                                            // One Strong Thread
  if(r.gl_6_4) k*=(1+0.06*r.gl_6_4)/Math.max(0.05,1-0.05*r.gl_6_4);                               // Nothing for Herself: what she did not keep goes on, and 6% more a rank
  if(r.gl_3_1&&full) k*=1+0.02*r.gl_3_1;                                                          // Woven Strength: she herself at full health
  if(o.spin&&r.gl_3_2) k*=2;                                                                       // Golden Spin: from Spindle
  return k; }
function threadFloor(T,u,now){ const o=S(T), x=thr(u); if(o.gpT>now) return 1;                   // Golden Pattern: at least 100% for 5 s
  if(T.r.gl_7_3&&x&&(o.seams||[]).some(s=>s.x===x&&now<s.until)) return 1; return 0; }          // Seam on the Line: while the Seam holds on the threaded ally
/* the second thread of Two Threads: the next ally nearest death (HP share), not herself */
function second(A,T,u){ const x=thr(u); let b=null; for(const a of allies(A,T,u)){ if(a===x) continue; if(!b||frac(a)<frac(b)) b=a; } return b; }
/* the thread passes `a` (what landed on her, or what of a talent heal did not fit) to its ally (allies): returns what the main ally gets; heals the second itself */
function threadShare(A,T,u,a,full){ const E=A.eng(), now=E.now(), pm=u.passMul||1, x=thr(u); if(!x||!(a>0)) return 0;
  let v=a*0.4*pm*threadMul(A,T,u,full); const fl=threadFloor(T,u,now); if(fl>0) v=Math.max(v,a*fl);
  if(T.r.gl_5_1){ v*=0.6; const y=second(A,T,u); if(y&&v>0){ const keep=u._healing; u._healing=1; try{ E.healUnit(y,v); } finally{ u._healing=keep; } } }   // Two Threads: 60% each
  return v; }
/* a talent heal on herself (Spindle, Spinner's Calm, Snap Back): Kind to Herself; what does not fit still goes down the thread */
function selfHeal(A,T,u,x){ const E=A.eng(), o=S(T); if(!(x>0)) return; x*=1+0.02*rk(T,'gl_6_2'); const room=Math.max(0,E.healCap(u)-u.hp), keep=(T.r.gl_6_4?Math.max(0.05,1-0.05*T.r.gl_6_4):1);
  E.healUnit(u,x); const over=x*keep-room; if(over>1e-9&&u.pass&&u.pass.goldthread){ const y=thr(u), v=threadShare(A,T,u,over,true); if(y&&v>0){ const k2=u._healing; u._healing=1; try{ E.healUnit(y,v); } finally{ u._healing=k2; } } } }
/* the budget of her per-second self-healing (Spindle and Spinner's Calm): 1.2% of her max HP a second, kept at most 5 s */
function budget(A,T,u,x){ const o=S(T); const b=Math.min(x,o.bud||0); o.bud=Math.max(0,(o.bud||0)-b); return b; }
/* the Stitches on x: one more (or n), up to the max, each gain refreshes their time */
function stAdd(A,T,u,x,n){ if(!x||!x.alive) return; const m=T.st.lnSt.max, v=Math.min(m,stN(A,T,u,x)+n); if(v>0) A.ustPut(T,u,x,'lnSt',v); }
/* Frayed on an enemy: n more (or set to at least n), for its time (or dur); reaching 5 from below: Cut Free */
function frAdd(A,T,u,t,n,set,dur){ if(!t||!t.alive||t.team===u.team) return; const o=S(T), was=frN(A,T,u,t), v=Math.min(5,set?Math.max(was,n):was+n); if(!(v>0)) return;
  let d=dur; if(d!=null){ const m=t._talM&&t._talM[u.uid]&&t._talM[u.uid]['#lnFr']; if(m&&m.until-A.eng().now()>d) d=undefined; }
  A.ustPut(T,u,t,'lnFr',v,d); const L=o.frL||(o.frL=[]); if(L.indexOf(t)<0) L.push(t);
  if(was<5&&v>=5&&T.r.sh_9_4){ t.shield=0; (o.nosh||(o.nosh={}))[t.uid]=A.eng().now()+2; } }
/* her side's max HP raised (Knots, Thread Count): the factor she gave x is kept, so a new total replaces the old one (the HP it has keeps its share) */
function hpTo(o,x,key,f){ const M=o[key]||(o[key]={}), old=M[x.uid]||1; if(Math.abs(f-old)<1e-12) return; x.maxHp*=f/old; x.hp*=f/old; M[x.uid]=f; }
function knotsHp(T,x){ hpTo(S(T),x,'knF',1+0.01*rk(T,'ml_4_4')*knN(T,x)); }
module.exports={
  hero:'linnet',
  casting:true,                         // rows ask which of her skills a heal comes from
  times:['ln.gilt.*.until','ln.nosh.*','ln.tss.until','ln.seams.*.until','ln.hl.*','ln.lg.*.*.0','ln.un.*.s','ln.up.*.at','ln.lr.*.*.0','ln.hemL.*','ln.mt.*.t','ln.mt.*.l','ln.sureL.*','ln.snL.*','ln.sbT','ln.sbL','ln.gpT','ln.upd.*','ln.lm.*','ln.bs.*'],   // this file's own absolute fight times (paths in T.s): the engine moves them back with the clock at each wave (WIRING/41c)
  states:{
    lnSt:{unit:true,max:P('st.max',6),dur:P('st.dur',8)},     // Stitches on her side
    lnFr:{unit:true,max:5,dur:P('fr.dur',5)}                   // Frayed on enemies
  },
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},
    {on:'wave',do:[{fn:'wave'}]},
    {on:'kit',skill:MEND,do:[{fn:'msKit'}]}, {on:'cast',skill:MEND,do:[{fn:'msCast'}]},                         // Mending Stitch: its mending made hers
    {on:'healOut',reqAny:HEALK.concat(STITCH),do:[{fn:'hOut'}]},                                                // her heals (the burst, each tick of its mending, Rewrite's)
    {on:'healed',reqAny:HEALK.concat(STITCH,['ml_10_3','sh_3_4','ml_3_1']),do:[{fn:'hLand'}]},                  //   as they land
    {on:['teamHeal','healMe'],reqAny:HEALIN,do:[{fn:'hIn'}]},                                                   // healing others (and she) receive
    {on:'skillTgt',skill:SEAM,reqAny:SEAMK,do:[{fn:'seamTgt'}]}, {on:'cast',skill:SEAM,reqAny:SEAMK,do:[{fn:'seamCast'}]},   // Reinforced Seam: where it lands
    {on:'skillTgt',skill:MEND,reqAny:['gl_13_3'],do:[{fn:'msTgt'}]},                                            // Mending Stitch's ally (The Thread She Can See)
    {on:'kit',skill:REW,reqAny:RWK,do:[{fn:'rwKit'}]}, {on:'cast',skill:REW,reqAny:RWK,do:[{fn:'rwCast'}]},     // Rewrite the Pattern
    {on:'num',skill:'gtPass',reqAny:PASS,do:[{fn:'gtPass'}]},                                                   // Golden Thread's share
    {on:'teamIn',reqAny:ALLY.concat(REC,TEAM_OUT),do:[{fn:'tin'}]},                                             // hits on her allies and on enemies
    {on:'in',reqAny:SELF.concat(REC),do:[{fn:'myIn'}]},                                                         // hits on her
    {on:'out',reqAny:DMGK,do:[{fn:'myOut'}]},                                                                   // her own hits
    {on:'hit',reqAny:SPIN.concat(FRAY),if:{auto:true,targetTeam:'enemy'},do:[{fn:'autoHit'}]},   // her basic attacks (Spindle, Frayed)
    {on:'death',reqAny:BOBBIN.concat(['ml_11_2']),do:[{fn:'dth'}]},                                              // an ally falls (the Bobbin, the Loose it carried)
    {on:'ccIn',reqAny:['ml_1_4','ml_8_4'],do:[{fn:'ten'}]},                                                      // controls on her
    {on:'teamCc',reqAny:['ml_8_4'],do:[{fn:'tcc'}]},                                                             // controls on her allies
    {on:'teamLethal',reqAny:['ml_13_2'],do:[{fn:'notlSave'}]}, {on:'lethal',reqAny:['ml_13_2'],do:[{fn:'notlSelf'}]}   // Not One Thread Loose: a free Seam
  ],
  talents:{
    /* ============================== THE MENDING LINE ============================== */
    ml_1_1:[ {param:'st.pull',add:R(0.03)} ],                               // Running Stitch (Stitches: hOut; a big hit pulls one: pull)
    ml_1_3:[ {param:'k.fine',add:R(0.02)} ],                                // Fine Needle (healK)
    ml_1_4:[ {param:'ten.self',add:R(0.05)} ],                              // Steady Hands (ten; up to 15%)
    ml_2_1:[ {param:'st.dur',add:R(1.5)} ],                                 // Tight Weave
    ml_2_2:[ {param:'loose.k',add:R(0.03)} ],                               // Newest Rows (Loose: looseShare)
    ml_3_1:[ {param:'backstitch',add:0.15} ],                               // Backstitch (hLand: 6 Stitches, then 15% for 3 s)
    ml_4_2:[ {param:'loose.dur',add:R(0.5)} ],                              // Wider Window
    ml_3_3:[ {param:'linen',add:R(0.01)} ],                                 // Linen Cloak (pull group)
    ml_2_3:[ {param:'ms.part',add:R(0.3)} ],                                // Double Thread (msCast: a part tick)
    ml_4_1:[ {on:'cd',skill:'green',add:R(-0.1)} ],                         // Close Work
    ml_6_4:[ {param:'risk.in',add:R(0.03)} ],                               // Thin Wool (RISK; its Loose share: looseShare)
    ml_n1:[  {param:'snag',add:0.03} ],                                     // Snagged Thread (LINK; with Sharp Edge 1 Frayed: pull)
    ml_4_4:[ {param:'knot.hp',add:R(0.01)} ],                               // Tie It Off (Knots: seam end)
    ml_5_1:[ {on:'kit',skill:SEAM,opt:{mul:{more:R(0.03)}}} ],              // Stronger Seam
    ml_5_2:[ {on:'kit',skill:MEND,opt:{dur:{add:-2}}} ],                    // Quick Stitch (PICK ONE; the first heal: healK)
    ml_5_3:[ {on:'kit',skill:MEND,opt:{dur:{add:3}}} ],                     // Slow Stitch (PICK ONE)
    ml_5_4:[ {param:'knot.dr',add:R(0.004)} ],                              // Double Knot
    ml_6_2:[ {param:'snap.mend',add:R(0.05)} ],                             // Snap Mend (looseShare)
    ml_6_3:[ {param:'st.fast',add:R(0.25)} ],                               // Long Thread (hOut)
    ml_7_1:[ {param:'k.pull',add:R(0.004)} ],                               // Gentle Pull (healK)
    ml_7_2:[ {param:'fresh',add:1} ],                                       // Fresh Seam (seamLand)
    ml_7_4:[ {param:'knot.dmg',add:R(0.01)} ],                              // Knotted Strength (tin)
    ml_8_1:[ {param:'st.max',add:R(1)} ],                                   // Spare Thread
    ml_8_3:[ {on:'kit',skill:SEAM,opt:{dur:{add:R(0.1)}}} ],                // Clean Edges
    ml_8_4:[ {param:'ten.knot',add:R(0.03)} ],                              // Tight Knots (ten / tcc)
    ml_9_1:[ {param:'hem',add:1} ],                                         // Hold the Hem (pull; healK)
    ml_9_2:[ {param:'fresh.k',add:R(0.02)} ],                               // Seam Sense
    ml_9_3:[ {param:'k.low',add:R(0.02)} ],                                 // Patient Weaver (healK)
    ml_10_1:[ {param:'st.nrg',add:R(1)} ],                                  // Pattern Book (pull)
    ml_10_3:[ {param:'twice',add:R(0.01)} ],                                // Mended Twice (hLand)
    ml_10_4:[ {param:'knot.heal',add:R(0.03)} ],                            // Knot Spell (knot)
    ml_11_1:[ {param:'dr.fingers',add:R(0.015)} ],                          // Patient Fingers (myDr)
    ml_11_2:[ {param:'rw.st',add:1} ],                                      // Rewrite in Stitches (rwCast)
    ml_12_1:[ {param:'st.pull',add:R(0.01)} ],                              // Close Weave
    ml_12_2:[ {param:'rw.rev',add:R(0.02)} ],                               // Second Pattern (rwKit: multiplies the share it returns)
    ml_12_3:[ {param:'st.back',add:R(0.10)} ],                              // Master Weaver (pull)
    ml_12_4:[ {param:'knot.max',add:R(1)} ],                                // Knot Lore
    ml_13_2:[ {param:'notl',add:1} ],                                       // Not One Thread Loose (SIGNATURE: rwCast, tk, notlSave)
    /* ============================== THE GOLD LINE ============================== */
    gl_1_1:[ {param:'dr.calm',add:R(0.02)} ],                               // Calm Weaver (myDr)
    gl_1_2:[ {param:'spin',add:R(0.004)} ],                                 // Spinning Wheel (Spindle: autoHit)
    gl_4_1:[ {param:'k.steady',add:R(0.03)} ],                              // Steady Stitch (healK)
    gl_2_2:[ {stat:{aspd:R(0.04)},if:{fn:'fw'}} ],                          // Fast Wheel
    gl_2_3:[ {param:'taut.k',add:R(0.02)} ],                                // Draw the Line (Tautline: threadMul)
    gl_3_1:[ {param:'woven',add:R(0.02)} ],                                 // Woven Strength (threadMul)
    gl_3_2:[ {param:'gspin',add:1} ],                                       // Golden Spin (threadMul)
    gl_6_2:[ {param:'kind',add:R(0.02)} ],                                  // Kind to Herself (healK, selfHeal)
    gl_5_1:[ {param:'two',add:1} ],                                         // Two Threads (PICK ONE: threadShare)
    gl_5_3:[ {param:'strong',add:0.15} ],                                   // One Strong Thread (PICK ONE: threadMul)
    gl_4_3:[ {param:'taut.at',add:R(0.03)} ],                               // Breaking Strain
    gl_4_4:[ {param:'gilt.heal',add:R(0.015)} ],                            // Gilded (Gilt: tk; hIn)
    gl_6_1:[ {param:'dr.two',add:R(0.02)} ],                                // Shared Weight (allyK)
    gl_6_3:[ {param:'dr.heavy',add:R(0.03)} ],                              // Heavy Gold (allyK)
    gl_5_2:[ {param:'dr.linen',add:R(0.01)} ],                              // Tough Linen (myDr)
    gl_5_4:[ {param:'gilt.dur',add:R(2)} ],                                 // Bright Gilt
    gl_7_1:[ {param:'out.auto',add:R(0.03)} ],                              // Needle Point (myOut)
    gl_6_4:[ {on:'healMe',less:R(0.05)} ],                                  // Nothing for Herself (RISK; the thread's half: threadMul)
    gl_8_2:[ {param:'spin',add:R(0.001)} ],                                 // Spun Fine
    gl_7_3:[ {param:'seam.line',add:1} ],                                   // Seam on the Line (seamTgt, threadFloor)
    gl_7_4:[ {param:'dr.gilt',add:R(0.01)} ],                               // Gold Lining (allyK)
    gl_8_1:[ {param:'k.taut',add:R(0.03)} ],                                // Drawn Tight (healK)
    gl_9_3:[ {on:'kit',skill:SEAM,opt:{mul:{more:R(0.03)}}} ],              // Seam Gold
    gl_8_4:[ {param:'gilt.dmg',add:R(0.02)} ],                              // Gilt Edge (tin)
    gl_9_1:[ {param:'snap',add:0.08} ],                                     // Snap Back (tk)
    gl_9_4:[ {param:'calm',add:R(0.002)} ],                                 // Spinner's Calm (tk; with Spindle under the regeneration cap)
    gl_10_2:[ {stat:{heal:R(0.005)},per:{fn:'giltW'}} ],                    // Gold Leaf
    gl_10_3:[ {on:'cd',skill:'green',add:R(-0.2)} ],                        // Weaver's Wit
    gl_10_4:[ {param:'gilt.fade',add:R(0.02)} ],                            // Lasting Shine (tk)
    gl_11_1:[ {param:'dr.mend',add:R(0.015)} ],                             // Self-Mending (myDr)
    gl_11_3:[ {param:'gpat',add:1} ],                                       // Golden Pattern (rwCast)
    gl_11_4:[ {stat:{armor:R(0.01),mr:R(0.01)},per:{fn:'giltN'}} ],         // Hidden Lining (up to 3)
    gl_12_1:[ {param:'sure',add:R(0.03)} ],                                 // Sure Hands (tk)
    gl_12_2:[ {param:'taut.k',add:R(0.005)} ],                              // Taut Gold
    gl_12_3:[ {param:'rw.rev',add:R(0.02)} ],                               // Gold Rewoven
    gl_12_4:[ {param:'spin.k',add:R(0.10)} ],                               // Spun Gold
    gl_13_3:[ {param:'tss',add:1} ],                                        // The Thread She Can See (SIGNATURE: tk)
    /* ============================== THE SHEARS ============================== */
    sh_1_1:[ {param:'dr.still',add:R(0.02)} ],                              // Stillness (myDr)
    sh_1_2:[ {param:'out.magic',add:R(0.02)} ],                             // Steel Needle (myOut)
    sh_1_4:[ {param:'fr.cut',add:R(0.01)} ],                                // Sharp Edge (Frayed: autoHit; hIn, tk)
    sh_2_3:[ {param:'up.k',add:R(0.04)} ],                                  // Pick It Out (Unpicked: rec, tk)
    sh_2_4:[ {param:'fr.dur',add:R(1)} ],                                   // Pulled Threads
    sh_3_1:[ {stat:{aspd:R(0.03)},if:{fn:'qs'}} ],                          // Quick Shears
    sh_2_2:[ {param:'out.gilt',add:R(0.05)} ],                              // Gilt Shears (myOut)
    sh_4_3:[ {param:'up.wait',add:R(-0.4)} ],                               // Deeper Unpick
    sh_3_4:[ {param:'unravel',add:0.40} ],                                  // Unravel (hLand)
    sh_4_1:[ {param:'bob.rev',add:R(0.03)} ],                               // Winding (the Bobbin: dth; rwKit)
    sh_6_1:[ {param:'out.risk',add:R(0.05)} ],                              // Shears Bite Back (RISK; its heals: healK)
    sh_4_4:[ {param:'out.fr',add:R(0.01)} ],                                // Loose Ends (myOut)
    sh_5_1:[ {stat:{heal:R(0.01)},per:{fn:'bobN'}} ],                       // Full Bobbin
    sh_8_2:[ {param:'dr.magic',add:R(0.01)} ],                              // Dark Water (myDr)
    sh_5_4:[ {param:'k.hard',add:R(0.02)} ],                                // Hard Pattern (healK)
    sh_8_1:[ {param:'bob.start',add:R(1)} ],                                // Wound Tight
    sh_6_4:[ {stat:{aspd:R(-0.004)},to:{team:'enemy',ust:{lnFr:1}},per:{ust:'lnFr'}} ],   // Catch: per Frayed stack
    sh_7_1:[ {param:'bob.hp',add:R(0.005)} ],                               // Thread Count (wind)
    sh_7_3:[ {param:'up.seam',add:1} ],                                     // Unpicked Seam (rec)
    sh_7_4:[ {param:'out.auto',add:R(0.03)} ],                              // Ripper (myOut)
    sh_5_2:[ {param:'cut.long',add:1} ],                                    // Cut Long (PICK ONE: rwKit)
    sh_5_3:[ {stat:{nrg:0.25}} ],                                           // Cut Short (PICK ONE: energy 25% faster = 20% sooner; the look-back: rwKit)
    sh_9_3:[ {param:'up.seamk',add:R(0.02)} ],                              // Seam Unpicked
    sh_8_4:[ {param:'fr.third',add:R(1)} ],                                 // Fraying Pattern (autoHit)
    sh_6_2:[ {param:'dr.memory',add:R(0.03)} ],                             // Long Memory (rwCast; myDr / allyK)
    sh_6_3:[ {param:'rw.nrg',add:R(10)} ],                                  // Quick Hands (rwCast)
    sh_9_2:[ {param:'k.rw',add:R(0.02)} ],                                  // Five Seconds (healK)
    sh_9_4:[ {param:'cutfree',add:1} ],                                     // Cut Free (frAdd, tk)
    sh_10_1:[ {param:'k.bob',add:R(0.10)} ],                                // Bobbin Burst (healK)
    sh_10_2:[ {on:'cd',less:R(0.01)} ],                                     // Blade Sense (both skills)
    sh_10_4:[ {param:'ragged',add:R(0.02)} ],                               // Ragged (tin)
    sh_11_3:[ {param:'rows',add:0.20} ],                                    // The Last Rows (rwCast)
    sh_11_4:[ {param:'dr.bank',add:R(0.015)} ],                             // The Bank at Carrowell (myDr)
    sh_12_1:[ {param:'bob.max',add:R(1)} ],                                 // Spare Bobbin
    sh_12_2:[ {param:'out.shear',add:R(0.03)} ],                            // Shearer (myOut)
    sh_12_3:[ {param:'rows',add:R(0.02)} ],                                 // Every Row Counted (2 points a rank)
    sh_13_3:[ {param:'cutpat',add:1} ]                                      // Cut the Pattern (SIGNATURE: rwCast)
  },
  fn:{
    /* ---------------- each tick (cheap: each part only for the talents that need it) ---------------- */
    tk(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, o=S(T), now=E.now(), dt=c.dt||0;
      o.bud=Math.min(0.05*u.maxHp,(o.bud||0)+REGEN*u.maxHp*dt);                                     // the self-healing budget (1.2% of her max HP a second)
      if(any(T,THREAD)) T.fn.thTick(A,T,u,c);
      if(o.seams&&o.seams.length) T.fn.seamTick(A,T,u,c);
      if(o.up&&o.up.length){ for(let i=0;i<o.up.length;i++){ const p=o.up[i]; if(now<p.at-1e-9) continue; o.up.splice(i--,1); const x=p.x; if(p.w){ p.w.p=null; p.w.done=true; }
          if(!x.alive) continue; const k=(Pp['up.k']||0.04)*(p.seam?1+(Pp['up.seamk']||0):1); if(k>0) E.healUnit(x,p.amt*k); (o.upd||(o.upd={}))[x.uid]=now; } }   // Unpicked
      if(o.frL&&o.frL.length){ const fs=o.frS||(o.frS={}), ns=o.nosh||{}, cut=Pp['fr.cut']||0;                 // Frayed enemies: the shields they gain, and Cut Free's 2 s
        for(let i=0;i<o.frL.length;i++){ const x=o.frL[i], n=frN(A,T,u,x); const lock=(ns[x.uid]||0)>now;
          if(!x.alive||(!(n>0)&&!lock)){ o.frL.splice(i--,1); delete fs[x.uid]; continue; }
          if(lock){ x.shield=0; fs[x.uid]=0; continue; }
          const sh=x.shield||0, last=fs[x.uid]; if(last!=null&&sh>last+1e-9&&cut>0) x.shield=last+(sh-last)*Math.max(0,1-cut*n); fs[x.uid]=x.shield||0; } }
      if(o.notlT>0){ o.notlT-=dt; o.notlA=(o.notlA||0)+dt; if(o.notlA>=1-1e-9){ o.notlA-=1; for(const x of team(A,T,u)) stAdd(A,T,u,x,1); } }   // Not One Thread Loose: 1 Stitch a second
      if(Pp['cut.long']){ o.hT=(o.hT||0)-dt; if(o.hT<=0){ o.hT=0.5; const H=o.h7||(o.h7={}); for(const x of E.units()){ if(!x.alive||x._summon) continue; const q=H[x.uid]||(H[x.uid]=[]); q.push(x.hp); if(q.length>15) q.shift(); } } } },
    wave(A,T,u){ const o=S(T), E=A.eng(); o.lg={}; o.un={}; o.up=[]; o.seams=[]; o.lr={}; o.giltW={}; o.hem={}; o.hemL={}; o.mt={}; o.gt=null; o.gt2=null; o.sbX=null; o.tss=null; o.notlT=0; o.gpT=0; o.frL=[]; o.frS={}; o.nosh={}; o.hl={}; o.upd={}; o.h7={}; o.n3=0; o.api=A;
      const g=o.gilt||{}; o.gilt={}; for(const k in g) if(g[k].ever) o.gilt[k]=g[k];                   // Gilt for the rest of the fight (The Thread She Can See) stays
      if(o.bob==null){ o.bob=Math.min(bobMax(T),T.P['bob.start']||0); if(o.bob>0) T.fn.windHp(A,T,u); }   // Wound Tight: the Bobbin starts wound
      o.kn=o.kn||{}; void E; },
    /* ---------------- Golden Thread: where it runs, Gilt, Tautline's edges, Sure Hands, Snap Back, Spinner's Calm, the signature ---------------- */
    thTick(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, o=S(T), now=E.now(), dt=c.dt||0, x=thr(u);
      const gd=10+(Pp['gilt.dur']||0), g=o.gilt||(o.gilt={});
      if(x!==o.gt){ if(x){ if(Pp.sure){ const L=o.sureL||(o.sureL={}); if(!(now<(L[x.uid]||0))){ L[x.uid]=now+8; E.healUnit(x,u.maxHp*Pp.sure); } } } o.gt=x; }   // Sure Hands: once every 8 s per ally
      const on=[x]; if(r.gl_5_1){ o.gt2=second(A,T,u); on.push(o.gt2); } else o.gt2=null;
      if(any(T,GILT)) for(const y of on){ if(!y) continue; const e=g[y.uid]||(g[y.uid]={x:y,until:0}); e.until=Math.max(e.until,now+gd); e.on=1; (o.giltW||(o.giltW={}))[y.uid]=1; }   // on the thread: Gilt, kept 10 s after it moves on
      for(const k in g){ const e=g[k]; if(e.ever) continue; if(!e.x.alive){ delete g[k]; continue; } if(now>=e.until){ delete g[k]; if(Pp['gilt.fade']) E.healUnit(e.x,e.x.maxHp*Pp['gilt.fade']); } }   // Lasting Shine
      if(Pp.snap&&x){ if(frac(x)<0.50){ o.sbX=x; o.sbT=now; } }                                                 // Snap Back: the threaded ally under 50%...
      if(Pp.snap&&o.sbX){ const y=o.sbX; if(!y.alive||now-o.sbT>3) o.sbX=null; else if(frac(y)>0.50&&!(now<(o.sbL||0))){ o.sbX=null; o.sbL=now+5; selfHeal(A,T,u,u.maxHp*Pp.snap); } }   // ...climbs back above it (once every 5 s)
      if(Pp.calm&&frac(u)>0.70){ o.cA=(o.cA||0)+dt; if(o.cA>=1-1e-9){ o.cA-=1; const v=budget(A,T,u,u.maxHp*Pp.calm); if(v>0) selfHeal(A,T,u,v); } } else o.cA=0;   // Spinner's Calm
      if(r.gl_13_3&&x&&x.hp<0.20*x.maxHp&&!(o.tssU&&o.tssU[x.uid])&&u.alive){ (o.tssU||(o.tssU={}))[x.uid]=1; T.fn.tssGo(A,T,u,x); } },
    /* The Thread She Can See: the threaded ally under 20%, once per ally a fight: pulled to her side, 25% of its max HP, 3 s of her heals at double strength on it,
       Gilt for the rest of the fight */
    tssGo(A,T,u,x){ const E=A.eng(), o=S(T), now=E.now(), M=E.METER();
      if(!x.immovable&&!((x._gearImmovableT||0)>0)){ const dx=x.x-u.x, dy=x.y-u.y, d=Math.hypot(dx,dy)||1, stop=E.bodyR(u)+E.bodyR(x)+0.5*M, L=Math.max(0,d-stop);
        if(L>0){ x.pulledBy={x:u.x,y:u.y,alive:true}; x.pullStop=stop; x.pullSpeed=Math.max(1,L/0.4); x.pullT=0.4; x._pullGhost=false; } }
      E.healUnit(x,x.maxHp*0.25); o.tss={x,until:now+3}; const g=o.gilt||(o.gilt={}); g[x.uid]={x,until:1e12,ever:1}; (o.giltW||(o.giltW={}))[x.uid]=1; },
    /* Golden Thread's share of a heal on her (the page's own line): ctx.amt = 40% x her passive's strength of what landed */
    gtPass(A,T,u,c){ const E=A.eng(), pm=u.passMul||1; if(!(c.amt>0)) return; const a=c.amt/(0.4*pm), full=u.hp>=E.healCap(u)-1e-6; c.amt=threadShare(A,T,u,a,full); },
    /* ---------------- her heals ---------------- */
    msKit(A,T,u,c){ A.acts(T,u,[{tagHots:'kit'}],c); },
    msCast(A,T,u,c){ const Pp=T.P, o=S(T); A.acts(T,u,[{tagHots:'mend'}],c);
      const add=Pp['ms.part']||0; if(add>0) for(const x of A.eng().units()){ if(!x.alive||x.team!==u.team||!x.hots) continue; for(const h of x.hots) if(h._talU===u&&h._talK==='mend'&&!h._lnMk){ h._lnMk=1;
          const n=h.remaining+add/(h.interval||1); h.remaining=Math.ceil(n-1e-9); const fr=n-(h.remaining-1); h._talF=(fr<1-1e-9)?fr:null; } }
      void o; },
    msTgt(A,T,u,c){ const o=S(T), now=A.eng().now(); if(o.tss&&now<o.tss.until&&o.tss.x.alive) c.tgt=o.tss.x; },
    /* a heal of her skill (before her healing power): the burst, each tick of its mending (hot), Rewrite's; a tick of the mending leaves Stitches */
    hOut(A,T,u,c){ const x=c.unit||c.tgt, sk=c.skill, o=S(T); if(!x) return; let kind=null;
      if(c.hot){ if(sk!=='mend') return; kind='mend';
        if(any(T,STITCH)){ const k=(T.r.ml_5_3&&T.P['st.fast'])?1/Math.max(0.25,1-T.P['st.fast']):1, F=o.stA||(o.stA={}); F[x.uid]=(F[x.uid]||0)+k*((c.h&&c.h._talF!=null&&c.h.remaining<=1)?c.h._talF:1);
          const n=Math.floor(F[x.uid]+1e-9); if(n>0){ F[x.uid]-=n; stAdd(A,T,u,x,n); } } }
      else if(sk===MEND) kind='burst'; else if(sk===REW) kind='rw'; else return;
      if(!any(T,HEALK)) return; let a=c.amt*healK(A,T,u,x,kind); const sh=looseShare(T,kind); if(sh>0&&any(T,LOOSE)) a+=sh*looseOf(A,T,u,x); c.amt=a; },
    /* her heal landed (c.amt = HP restored): its Loose is mended; Mended Twice; the burst: Backstitch, Unravel */
    hLand(A,T,u,c){ const E=A.eng(), x=c.unit||c.tgt, o=S(T), Pp=T.P, now=E.now(); if(!x) return; const got=c.amt||0;
      if(got>0&&o.lg) looseUse(T,x,got);
      if(Pp.twice&&got>0){ const m=o.mt||(o.mt={}), e=m[x.uid]||(m[x.uid]={t:-1e9,l:0}); if(now-e.t<=4+1e-9&&!(now<e.l)){ e.l=now+8; E.healUnit(x,x.maxHp*Pp.twice); } e.t=now; }   // Mended Twice (once every 8 s per ally)
      if(c.hot||c.skill!==MEND) return;
      if(Pp.backstitch&&stN(A,T,u,x)>=6) (o.bs||(o.bs={}))[x.uid]=now+3;                                    // Backstitch: 15% for 3 s
      if(Pp.unravel){ const e=x._talBy; if(e&&e.alive&&e.team!==u.team){ const d=Math.min(Pp.unravel*got,0.15*(e.maxHp||0))*E.defMul(u,e,'magic')*outK(A,T,u,e,null);
          if(d>0) A.hurt(T,u,e,d,COL,'unravel'); frAdd(A,T,u,e,5,true); } } },
    /* healing a unit receives (any healer's): Frayed enemies less, Gilt allies more; enemies healed are remembered for 2 s (Gilt Shears) */
    hIn(A,T,u,c){ const x=c.unit, Pp=T.P, o=S(T); if(!x) return; const E=A.eng();
      if(x.team!==u.team){ (o.hl||(o.hl={}))[x.uid]=E.now(); const n=frN(A,T,u,x); if(n>0&&Pp['fr.cut']) c.amt*=Math.max(0,1-Pp['fr.cut']*n); return; }
      if(Pp['gilt.heal']&&x!==u&&giltOn(T,x,E.now())) c.amt*=1+Pp['gilt.heal']; },
    /* ---------------- Reinforced Seam ---------------- */
    seamTgt(A,T,u,c){ const o=S(T), now=A.eng().now();
      if(o.tss&&now<o.tss.until&&o.tss.x.alive) c.tgt=o.tss.x; else if(T.P['seam.line']){ const x=thr(u); if(x) c.tgt=x; }   // Seam on the Line
      o.seamT=c.tgt||null; },
    seamCast(A,T,u,c){ const o=S(T), x=o.seamT; o.seamT=null; if(!x||!x.alive) return; T.fn.seamLand(A,T,u,x,(c.o&&c.o.dur)||5); },
    /* a Seam on x (her skill, or the signature's free one): Fresh Seam, its time kept (Unpicked Seam, Seam on the Line; its end ties a Knot) */
    seamLand(A,T,u,x,d){ const E=A.eng(), o=S(T), now=E.now(), Pp=T.P;
      if(Pp.fresh){ const L=looseOf(A,T,u,x); if(L>0){ E.healUnit(x,L*(1+(Pp['fresh.k']||0))); const g=o.lg&&o.lg[x.uid]; if(g) g.length=0; } }   // Fresh Seam: all its Loose at once
      const S0=o.seams||(o.seams=[]); for(let i=0;i<S0.length;i++) if(S0[i].x===x){ S0[i].until=Math.max(S0[i].until,now+d); return; } S0.push({x,until:now+d}); },
    seamTick(A,T,u){ const o=S(T), now=A.eng().now(); for(let i=0;i<o.seams.length;i++){ const s=o.seams[i]; if(now<s.until-1e-9&&s.x.alive) continue; o.seams.splice(i--,1); if(s.x.alive&&any(T,KNOT)) T.fn.knot(A,T,u,s.x); } },
    /* a Knot tied in x (kept for the fight): max HP (Tie It Off), Knot Spell's heal */
    knot(A,T,u,x){ const E=A.eng(), o=S(T), Pp=T.P, k=o.kn||(o.kn={}), mx=3+(Pp['knot.max']||0); if(!((k[x.uid]||0)<mx)) return; k[x.uid]=(k[x.uid]||0)+1; knotsHp(T,x);
      if(Pp['knot.heal']) E.healUnit(x,x.maxHp*Pp['knot.heal']); },
    /* ---------------- Rewrite the Pattern ---------------- */
    rwKit(A,T,u,c){ const E=A.eng(), o=S(T), Pp=T.P, L=look(T), now=E.now(), rw=o.rw={dead:[],raised:[],hist:[]};
      const k=1+(Pp['rw.rev']||0)+(Pp['bob.rev']||0)*(o.bob||0); if(k!==1&&c.o){ c.o.revive=((c.o.revive==null?0.4:c.o.revive))*k; c.o.perLv=(c.o.perLv||0)*k; }   // Second Pattern, Gold Rewoven, Winding: the share it returns
      for(const a of E.units()){ if(a.team!==u.team||a._dropHidden||a._summon) continue; let H=a._hpHist;
        if(L!==5&&H&&H.length){ let v=null; if(L===3) v=H[Math.max(0,H.length-7)]; else { const q=o.h7&&o.h7[a.uid]; if(q&&q.length) v=q[0]; } if(v!=null){ rw.hist.push([a,H]); a._hpHist=[v]; H=a._hpHist; } }   // Cut Long / Cut Short
        const h=H&&H.length?H[0]:null; if(h==null) continue; if(!a.alive) rw.dead.push(a); else if(h>a.hp) rw.raised.push(a); } void now; },
    rwCast(A,T,u,c){ const E=A.eng(), o=S(T), Pp=T.P, r=T.r, now=E.now(), rw=o.rw; o.rw=null; if(!rw) return;
      for(const e of rw.hist) e[0]._hpHist=e[1];                                                                 // the game's own history back
      const back=rw.dead.filter(a=>a.alive), touched=rw.raised.concat(back);
      for(const a of E.units()) if(a.alive&&a.team===u.team&&!a._dropHidden&&!a._summon&&touched.indexOf(a)<0&&a._hpHist&&a._hpHist.length) touched.push(a);
      if(Pp['rw.st']){ for(const a of touched) stAdd(A,T,u,a,6); const D=o.lsD||{}; for(const a of back){ const v=D[a.uid]||0; if(v>0) E.healUnit(a,v); D[a.uid]=0; } }   // Rewrite in Stitches
      if(Pp['rw.nrg']) for(const a of back) a.energy=Math.min(100,(a.energy||0)+Pp['rw.nrg']);                    // Quick Hands
      if(Pp['dr.memory']){ const m=o.lm||(o.lm={}); for(const a of rw.raised) if(a.alive) m[a.uid]=now+4; }      // Long Memory
      if(Pp.gpat){ const g=o.gilt||(o.gilt={}), gd=10+(Pp['gilt.dur']||0); for(const a of touched) if(a!==u){ const e=g[a.uid]||(g[a.uid]={x:a,until:0}); e.until=Math.max(e.until,now+gd); (o.giltW||(o.giltW={}))[a.uid]=1; } o.gpT=now+5; }   // Golden Pattern
      if(Pp.notl){ o.notlT=6; o.notlA=0; o.notl=1; }                                                             // Not One Thread Loose
      if(Pp.rows||Pp.cutpat){ const L=look(T), t0=now-L; for(const e of E.units()){ if(!e.alive||e.team===u.team) continue;
          if(Pp.rows){ const q=o.lr&&o.lr[e.uid]; let s=0; if(q) for(const x of q) if(x[0]>=t0) s+=x[1]; const d=Pp.rows*s*E.defMul(u,e,'magic')*outK(A,T,u,e,null); if(d>0) A.hurt(T,u,e,d,COL,'rows'); }   // The Last Rows
          if(Pp.cutpat&&e.alive){ let h=null; const H=e._hpHist; if(L===7){ const q=o.h7&&o.h7[e.uid]; if(q&&q.length) h=q[0]; } else if(H&&H.length) h=L===3?H[Math.max(0,H.length-7)]:H[0];   // Cut the Pattern
            if(h!=null&&h<e.hp){ let v=Math.max(1,h); if(isBoss(e)) v=Math.max(v,e.hp-0.10*e.maxHp); e.hp=Math.min(e.hp,v); }
            e.shield=0; frAdd(A,T,u,e,5,true,6); } } } },
    /* ---------------- hits ---------------- */
    /* hits on her allies (their reductions: ONE group, at most 25%), her side's hits on enemies (Knotted Strength, Gilt Edge, Ragged), and what is recorded */
    tin(A,T,u,c){ const t=c.tgt, s=c.src, Pp=T.P; if(!t||!s) return;
      if(t.team!==u.team){ if(s.team!==u.team) return; let k=1; if(Pp['knot.dmg']&&s!==u&&knN(T,s)>=3) k+=Pp['knot.dmg'];
        if(Pp['gilt.dmg']&&s!==u&&giltOn(T,s,A.eng().now())) k+=Pp['gilt.dmg']; if(Pp.ragged&&frN(A,T,u,t)>=5) k+=Pp.ragged; c.amt*=k; return; }
      if(s.team===u.team||t===u) return;
      c.amt*=T.fn.guard(A,T,u,t,s,c,false); T.fn.rec(A,T,u,t,s,c.amt); },
    myIn(A,T,u,c){ const s=c.src; c.amt*=T.fn.guard(A,T,u,u,s,c,true); if(T.P['risk.in']) c.amt*=1+T.P['risk.in']; T.fn.rec(A,T,u,u,s,c.amt); },
    /* the reduction on a hit on x (x = her: her own group, at most 40%; an ally: at most 25%). A big hit pulls a Stitch (its side effects happen here) */
    guard(A,T,u,x,s,c,me){ const E=A.eng(), o=S(T), Pp=T.P, now=E.now(); let k=T.fn.drK(A,T,u,x,s,c,me);
      const n=stN(A,T,u,x); if(n>0&&c.amt>0.10*x.maxHp&&any(T,STITCH)){ const sh=Pp['st.pull']||0; A.ustPut(T,u,x,'lnSt',n-1); const saved=c.amt*sh; k*=1-sh;   // a Stitch pulled
        if(Pp.snag&&s){ A.setMark(T,u,s,'lnSn',{dur:3}); if(T.r.sh_1_4){ const L=o.snL||(o.snL={}); if(!(now<(L[s.uid]||0))){ L[s.uid]=now+1; frAdd(A,T,u,s,1); } } }   // Snagged Thread (LINK: 1 Frayed, once a second)
        if(Pp['st.nrg']) x.energy=Math.min(100,(x.energy||0)+Pp['st.nrg']);                              // Pattern Book
        if(Pp['st.back']&&saved>0) E.pushHot(x,saved*Pp['st.back']/3,3,1);                               // Master Weaver
        if(Pp.hem&&n-1<=0){ const L=o.hemL||(o.hemL={}); if(!(now<(L[x.uid]||0))){ L[x.uid]=now+8; (o.hem||(o.hem={}))[x.uid]=1; } } }   // Hold the Hem
      return Math.max(me?DR_SELF:DR_ALLY,k); },
    /* the reduction a hit on x gets from her talents now, with no side effect (the Stitch pull counted, not spent): the 95% instrument reads this */
    drK(A,T,u,x,s,c,me){ const E=A.eng(), o=S(T), Pp=T.P, now=E.now(); let k=1; const st=stN(A,T,u,x), auto=!!(c&&c.auto);
      if(o.bs&&(o.bs[x.uid]||0)>now) k*=1-(Pp.backstitch||0);                                                  // Backstitch
      if(Pp.linen&&auto&&st>=3) k*=1-Pp.linen;                                                                 // Linen Cloak
      if(Pp['knot.dr']){ const n=knN(T,x); if(n>0) k*=1-Pp['knot.dr']*n; }                                     // Double Knot
      if(Pp['dr.memory']&&o.lm&&(o.lm[x.uid]||0)>now) k*=1-Pp['dr.memory'];                                   // Long Memory
      if(Pp.snag&&s&&A.markOf(u,s,'lnSn')) k*=1-Pp.snag;                                                       // Snagged Thread
      if(me){ if(Pp['dr.calm']&&frac(u)>0.70) k*=1-Pp['dr.calm'];                                             // Calm Weaver
        if(Pp['dr.linen']) k*=1-Pp['dr.linen'];                                                                // Tough Linen
        if(Pp['dr.mend']&&auto) k*=1-Pp['dr.mend'];                                                            // Self-Mending
        if(Pp['dr.still']&&s&&frN(A,T,u,s)>0) k*=1-Pp['dr.still'];                                            // Stillness
        if(Pp['dr.magic']&&c&&c.kind==='magic') k*=1-Pp['dr.magic'];                                          // Dark Water
        if(Pp['dr.bank']&&allies(A,T,u).some(a=>a.hp<0.30*a.maxHp)) k*=1-Pp['dr.bank'];                      // The Bank at Carrowell
        if(Pp['dr.fingers']){ const L=allies(A,T,u); if(L.length&&L.every(a=>stN(A,T,u,a)>0)) k*=1-Pp['dr.fingers']; } }   // Patient Fingers
      else { const g=giltOn(T,x,now); if(Pp['dr.gilt']&&g) k*=1-Pp['dr.gilt'];                                // Gold Lining
        if(Pp['dr.two']&&(x===thr(u)||x===o.gt2)) k*=1-Pp['dr.two'];                                         // Shared Weight (Two Threads)
        if(Pp['dr.heavy']&&x===thr(u)) k*=1-Pp['dr.heavy']; }                                                  // Heavy Gold (One Strong Thread)
      if(c&&c.probe&&st>0&&c.amt>0.10*x.maxHp) k*=1-(Pp['st.pull']||0);                                        // (the probe: a Stitch would be pulled)
      return Math.max(me?DR_SELF:DR_ALLY,k); },
    /* a hit on her side, recorded: Loose (what it took), Unpicked (the biggest each 6 s; every hit under Unpicked Seam), the enemy's damage (The Last Rows) */
    rec(A,T,u,x,s,amt){ if(!any(T,REC)) return; const E=A.eng(), o=S(T), now=E.now(), v=est(x,amt); if(!(v>0)) return;
      if(any(T,LOOSE)){ const lg=o.lg||(o.lg={}), q=lg[x.uid]||(lg[x.uid]=[]); q.push([now,v]); if(q.length>40) q.shift(); }
      if(any(T,UNPICK)){ const d=Math.max(0.2,2+(T.P['up.wait']||0)), up=o.up||(o.up=[]);
        if(T.P['up.seam']&&(o.seams||[]).some(z=>z.x===x&&now<z.until)) up.push({x,amt:v,at:now+d,seam:true});
        else { const un=o.un||(o.un={}); let w=un[x.uid]; if(!w||now>=w.s+6-1e-9) w=un[x.uid]={s:now,best:0,p:null,done:false};
          if(!w.done&&v>w.best){ w.best=v; if(w.p){ w.p.amt=v; w.p.at=now+d; } else { w.p={x,amt:v,at:now+d,w}; up.push(w.p); } } } }
      if(T.P.rows&&s&&s.team!==u.team){ const lr=o.lr||(o.lr={}), q=lr[s.uid]||(lr[s.uid]=[]); q.push([now,v]); while(q.length&&q[0][0]<now-7) q.shift(); } },
    /* an ally fell: the Bobbin winds; the Loose it carried is kept (Rewrite in Stitches mends it when it returns) */
    dth(A,T,u,c){ const x=c.unit, o=S(T); if(!x||x===u||x.team!==u.team||x._summon) return;
      if(T.r.ml_11_2&&o.lg){ const q=o.lg[x.uid]; let s=0; if(q){ const t0=A.eng().now()-looseWin(T); for(const e of q) if(e[0]>=t0) s+=e[1]; } (o.lsD||(o.lsD={}))[x.uid]=s; }
      if(any(T,BOBBIN)&&(o.bob||0)<bobMax(T)){ o.bob=(o.bob||0)+1; T.fn.windHp(A,T,u); } },
    windHp(A,T,u){ const o=S(T), k=T.P['bob.hp']||0; if(!(k>0)) return; for(const x of team(A,T,u)) hpTo(o,x,'bobF',1+k*(o.bob||0)); },   // Thread Count: every ally, per wind
    /* her own hits: Steel Needle (magic), Needle Point and Ripper (basic attacks), Gilt Shears, Loose Ends, Shearer, Shears Bite Back */
    myOut(A,T,u,c){ c.amt*=outK(A,T,u,c.tgt,c); },
    /* her basic attack landed: Spindle (budgeted with Spinner's Calm; at least Spinning Wheel's first rank once any Spindle talent is learned), Frayed (Fraying Pattern every 3rd) */
    autoHit(A,T,u,c){ const Pp=T.P, o=S(T), t=c.tgt;
      if(any(T,SPIN)){ const x=budget(A,T,u,u.maxHp*(Math.max(0.004,0.004*rk(T,'gl_1_2'))+0.001*rk(T,'gl_8_2'))*(1+(Pp['spin.k']||0))); if(x>0){ o.spin=1; try{ selfHeal(A,T,u,x); } finally{ o.spin=0; } } }
      if(any(T,FRAY)&&t&&t.alive){ o.n3=(o.n3||0)+1; let n=1; if(Pp['fr.third']&&o.n3%3===0) n+=Pp['fr.third']; frAdd(A,T,u,t,n); } },
    ten(A,T,u,c){ const Pp=T.P; let k=1-(Pp['ten.self']||0); if(Pp['ten.knot']&&knN(T,u)>=3) k*=1-Pp['ten.knot']; c.amt*=Math.max(TEN,k); },
    tcc(A,T,u,c){ const x=c.unit, f=c.field, Pp=T.P; if(!x||!f||f==='slow'||!(c.amt>0)||x===u) return;
      if(Pp['ten.knot']&&knN(T,x)>=3&&Math.abs((x[f]||0)-c.amt)<1e-9) x[f]=c.amt*(1-Pp['ten.knot']); },
    /* Not One Thread Loose: an ally (or she) who would die in its 6 s is held at 1 HP by a free Seam, once per ally a fight */
    notlSave(A,T,u,c){ const o=S(T), x=c.unit; if(!(o.notlT>0)||!x||x.team!==u.team||x._summon) return; const U=o.notlU||(o.notlU={}); if(U[x.uid]) return; U[x.uid]=1;
      x.hp=1; c.stop=true; T.fn.freeSeam(A,T,u,x); },
    notlSelf(A,T,u,c){ const o=S(T); if(!(o.notlT>0)) return; const U=o.notlU||(o.notlU={}); if(U[u.uid]) return; U[u.uid]=1; T.fn.freeSeam(A,T,u,u); if(u.hp<1) u.hp=1; },
    freeSeam(A,T,u,x){ const E=A.eng(), o=S(T), lv=(u.skillLv&&u.skillLv[2])||1, d=5+0.1*rk(T,'ml_8_3'), k=(1+0.03*rk(T,'ml_5_1'))*(1+0.03*rk(T,'gl_9_3'));
      x.shield=Math.max(x.shield||0,(u.apow||0)*1.8*k*(E.skillMul?E.skillMul(lv):1)); x.shieldT=Math.max(x.shieldT||0,d); x._wardT=Math.max(x._wardT||0,d); T.fn.seamLand(A,T,u,x,d); void o; },
    /* conditions and counts */
    fw(A,T,u){ const x=thr(u); return !!x&&frac(x)>0.50; },                                                  // Fast Wheel
    qs(A,T,u){ return frN(A,T,u,u.target)>=3; },                                                             // Quick Shears
    giltN(A,T,u){ const g=S(T).gilt, now=A.eng().now(); let n=0; for(const k in (g||{})) if(g[k].x.alive&&g[k].x!==u&&g[k].until>now) n++; return Math.min(3,n); },   // Hidden Lining
    giltW(A,T,u){ let n=0; for(const k in (S(T).giltW||{})) n++; return n; },                                // Gold Leaf
    bobN(A,T){ return S(T).bob||0; }                                                                         // Full Bobbin
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None (readings and reworded tooltips: WIRING/35 - LINNET - talent decisions.md) */
  ruling:{}
};
/* her outgoing damage factor on t (c: the hit, or null for her talents' own damage) */
function outK(A,T,u,t,c){ const Pp=T.P, o=S(T), E=A.eng(); let k=1; const auto=!!(c&&c.auto), mag=!c||c.kind==='magic';
  if(Pp['out.magic']&&mag) k+=Pp['out.magic'];
  if(auto&&Pp['out.auto']) k+=Pp['out.auto'];
  const n=frN(A,T,u,t); if(n>0){ if(Pp['out.fr']) k+=Pp['out.fr']; if(auto&&Pp['out.shear']) k+=Pp['out.shear']; }
  if(auto&&Pp['out.gilt']&&t&&((t.shield||0)>0||((o.hl&&o.hl[t.uid])||-1e9)>=E.now()-2)) k+=Pp['out.gilt'];
  if(Pp['out.risk']) k+=Pp['out.risk'];
  return k; }
