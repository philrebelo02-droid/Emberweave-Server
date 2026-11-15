/* ORRYN - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE (most talents are one named number, a `param` row), then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Orryn": what he added)
   His real kit (the code, not the tooltip wording; a back-row Mage, every skill reads Ability Power, his damage is magic):
   - Pressure Sphere ('strike', green, cd 6, deliver 'form' 0.4 s): one hit of 175% of his ability power x the skill level on his target, 0.4 s after the
     release. It is his only 'strike', so while it resolves `casting` is 'strike'.
   - Spiral Current ('ashfall', blue, cd 9, deliver 'travel'): a ground hazard that starts 1 m in front of him and travels at 6 m/s toward the densest enemy
     group (the press aims it), 3 m past that point; every 0.5 s it strikes every enemy whose CENTRE is within 3.4 m of its centre for 50% of his ability
     power x the skill level (magic, through magic resist), slows them (the timer only: the strength is the game's base 45%) and slows their energy gain
     by 40% for 4 s (_nrgSlowT / _nrgSlowPct, read wherever a unit gains energy). Measured: 1.46 enemies a cast, 0.86 s under it.
   - Abyssal Reserve (passive 'abyssres', paid in castKit at the PRESS of a Green or Blue): each press adds 1 (u._prS); at 3 the passive pass sets
     u._prReady; the next press multiplies that spell's level multiplier by 1 + 45% + 0.2 point a level (64.8% at 100). It never touches the ultimate.
   - Ocean Without Shore (ultimate 'ashfall', energy; ULT_DEF.ashfall + HERO_ULT_ART.orryn: deliver 'form' 0.5 s): a 6 m ground hazard (centre measure) at
     the aim, 5 s, striking every enemy inside every 0.5 s for 80% of his ability power x the skill level. It has NO root and no slow (its card's
     "rooted 2.5 s" is an overridden duplicate line), and ULT_DEF's mul 1.4 is read by nothing (no first impact): its ticks are its impacts.
   Hazard ticks are not hits: no out / in / hit rows see them. The page's partPre / part pair named 'hz' and the num 'hzTick' site sit in the hazard pass
   for a hazard his rows have tagged (h._talZ = him): hzTick changes each tick on each enemy, part runs after the tick. `hazards` (bound) lets his cast
   rows find the hazard his skill has just made.
   Chambers, Crushed, Whorls, Drawn Strength, Sea Weight / Drowning and the Flood exist only through his talents.
   "His water" = every hazard of his (Spiral Current, Ocean Without Shore, the floods his talents leave) and Drowning Sphere's circles.
   "His spells" = Pressure Sphere and Spiral Current (the two casts Abyssal Reserve counts).
   Every lock is a countdown or is cleared at the wave's start (the fight clock restarts at 0 every wave).
   Readings, caps and corrected tooltips: WIRING/45 - ORRYN - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const SPH='strike';
/* the states several talents read: their bookkeeping runs when any of these is learned */
const CR=['fc_1_1','fc_3_1','fc_5_1','fc_6_1','fc_8_1','fc_9_1','fc_9_3','fc_10_1','fc_12_4','fc_13_3'];                       // Crushed
const CH=['fc_1_4','fc_2_4','fc_3_4','fc_n2','fc_4_4','fc_5_4','fc_6_4','fc_8_4','fc_10_4','fc_11_3','fc_11_4','fc_12_3','fc_13_3'];   // Chambers
const AR=['fc_2_3','fc_4_3','fc_5_2','fc_5_3','fc_3_4','fc_8_4','fc_9_3','fc_10_2'];                                            // Abyssal Reserve's empowered spells
const WH=['sp_1_4','sp_2_4','sp_3_4','sp_6_4','sp_8_4','sp_9_4','sp_10_3','sp_11_2','sp_11_4','sp_n1','sp_12_2','sp_13_3'];      // Whorls
const NRG=['sp_1_1','sp_2_1','sp_8_1','sp_10_1','sp_11_1','sp_n1','sp_12_3','sp_13_3'];                                         // energy watched (Drawn Strength, the energy cuts)
const SW=['os_1_1','os_2_1','os_n1','os_3_1','os_4_1','os_6_1','os_6_4','os_9_1','os_10_1','os_10_4','os_11_2','os_12_1','os_13_2'];   // Sea Weight / Drowning
const FL=['os_1_3','os_2_3','os_3_3','os_5_3','os_6_3','os_8_3','os_10_3','os_11_3','os_12_2','os_13_2'];                       // the Flood
const WATER=SW.concat(['os_n2','os_n3']);                                                                                       // enemies watched in his water each tick
const DRL=['fc_n1','fc_5_4','fc_12_4','sp_4_1','sp_12_2','os_1_1','os_5_3','os_10_1'];                                          // his damage reduction: ONE capped group (40%)
const DR_CAP=0.40, SC_SLOW=0.45;          // SC_SLOW: the strength of the game's own hazard slow (SLOW_MUL_BASE 0.55 = 45% slower)
/* ---- helpers ---- */
const live=(A,h)=>{ const E=A.eng(); return h.life>0&&!!E.hazards&&E.hazards().indexOf(h)>=0; };
const inHz=(h,x)=>Math.hypot(x.x-h.x,x.y-h.y)<=h.r;                                              // the game's own measure for a ground hazard: the centre inside
const myHz=(A,T,k)=>(T.s.oHz||[]).filter(h=>(!k||h._oK===k)&&live(A,h));
const ust=(A,T,u,x,n)=>x?A.ustGet(T,u,x,n):0;
const foes=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
function underSc(A,T,u,x){ if(!x) return false; for(const h of myHz(A,T,'sc')) if(inHz(h,x)) return true; return false; }
function inUlt(A,T,u,x,spiral){ if(!x) return false; for(const h of myHz(A,T,'ul')) if(inHz(h,x)&&(!spiral||h._oSp)) return true; return false; }
/* his water: a hazard of his (the first one it stands in), else a Drowning Sphere circle (body measure) */
function waterOf(A,T,u,x){ for(const h of myHz(A,T)) if(inHz(h,x)) return h; return A.inZone(T,x,'oDs')?'zone':null; }
/* the share a magic hit keeps when the target's magic resist is cut by x (as the runtime's ignoreMr) */
function mrK(E,u,t,x){ if(!(x>0)||!t) return 1; const a=E.defMul(u,t,'magic'); if(!(a>0)) return 1; const sv=t.mrRating; t.mrRating=(sv||0)*Math.max(0,1-x); const b=E.defMul(u,t,'magic'); t.mrRating=sv; return b/a; }
/* a slow of his talents, as strong as written, never weakening a slow that is already stronger (the game's hazard slow has no number of its own: 45%) */
function slowOn(t,x,d){ if(!t||!t.alive||!(x>0)||!(d>0)) return; const cur=t.slowMul!=null?t.slowMul:((t.slow||0)>0?1-SC_SLOW:1); t.slow=Math.max(t.slow||0,d); t.slowMul=Math.min(cur,Math.max(0.05,1-x)); }
/* damage from Orryn (his hits and his water): Crushed, Drained, Turned Inside */
function orrK(A,T,u,t){ const Pm=T.P; let k=1; if(Pm['cr.k']) k*=1+Pm['cr.k']*ust(A,T,u,t,'oCr'); if(Pm['dr.ain']&&A.markOf(u,t,'oDr')) k*=1+Pm['dr.ain']; if(Pm['wh.in']) k*=1+Pm['wh.in']*ust(A,T,u,t,'oWh'); return k; }
/* his spells (Pressure Sphere, Spiral Current): Snowfall Weight, Finished Work, Still Mind */
function spellK(A,T,u,t){ const Pm=T.P; let k=1; if(Pm['sp.snow']) k*=1+Pm['sp.snow']*Math.floor(A.stGet(T,'oCh')/10); if(Pm['sp.fin']&&t.hp<0.30*t.maxHp) k*=1+Pm['sp.fin']; if(Pm['sp.still']&&T.s.oStill) k*=1+Pm['sp.still']; return k; }
/* the magic resist his spells ignore: Sealed Rooms (per 10 Chambers), Sea Level (at Flood 3 or more) */
function mrIgn(A,T){ const Pm=T.P; let f=1; if(Pm['mr.seal']) f*=1-Pm['mr.seal']*Math.floor(A.stGet(T,'oCh')/10); if(Pm['mr.sea']&&A.stGet(T,'oFl')>=3) f*=1-Pm['mr.sea']; return 1-f; }
/* an Abyssal Reserve spell (e = what the press kept: F = the passive's own share, dv = the plain spells before it, sv = Saved Breath's): Stored Pressure,
   Diver's Breath, Saved Breath, Breath Held Long */
function empK(A,T,u,t,e){ const Pm=T.P; let k=1; if(Pm['ar.pts']) k*=(1+e.F+Pm['ar.pts'])/(1+e.F); if(Pm['ar.dive']) k*=1+Pm['ar.dive']*e.dv; if(e.sv) k*=1.20;
  if(Pm['ar.held']&&ust(A,T,u,t,'oCr')>0) k*=1+Pm['ar.held']; return k; }
/* one tick of his water on enemy e */
function hzK(A,T,u,h,e,full){ const Pm=T.P; let k=orrK(A,T,u,e)*(full?1:(h._oStr||1))*((!full&&h._oHalf&&h.life<=h._oHalf)?0.5:1);
  const sw=ust(A,T,u,e,'oSw'); if(sw>=5) k*=(1+(Pm['sw.drown']||0))*(1+(Pm['sw.press']||0));
  const fl=Pm['fl.k']?A.stGet(T,'oFl'):0;
  if(h._oK==='sc'){ k*=(1+(Pm['sc.bite']||0))*(1+(Pm['sc.under']||0))*(1+(Pm['fl.k']||0)*fl); if(Pm.wcm&&sw>=3) k*=1.05; k*=spellK(A,T,u,e); if(h._oE) k*=empK(A,T,u,e,h._oE); k*=mrK(A.eng(),u,e,mrIgn(A,T)); }
  else k*=(1+(Pm['ul.shore']||0))*(1+(Pm['ul.tidal']||0))*(1+(Pm['ul.ham']||0))*(1+(Pm['ul.long']||0))*(1+(Pm['ul.rooms']||0)*A.stGet(T,'oCh'))*(1+(Pm['fl.k']||0)*fl);
  return k; }
/* a talent stun of his: never on an enemy that is stunned, nor within 0.5 s after one of his stuns on it ended (the lock mark 'oLk'); each cast (key) stuns
   one enemy at most twice. Each landed stun is logged on T.s.oStL ([uid, start, seconds]) for the tests' stun-chain measure */
function stunOk(A,T,u,t){ return !!t&&t.alive&&!t.stunImmune&&!((t.stunned||0)>0)&&!A.markOf(u,t,'oLk'); }
function tstun(A,T,u,t,secs,key){ if(!stunOk(A,T,u,t)||!(secs>0)) return false; const K=T.s.oSk||(T.s.oSk={}), kk=key+':'+t.uid; if((K[kk]||0)>=2) return false;
  A.control(T,u,t,'stunned',secs); const d=t.stunned||0; if(!(d>0)) return false; K[kk]=(K[kk]||0)+1;
  A.setMark(T,u,t,'oLk',{dur:d+0.5}); const L=T.s.oStL||(T.s.oStL=[]); if(L.length<400) L.push([t.uid,A.eng().now(),d]); return true; }
/* Chambers: seal n (the count goes on past 40 for No Far Wall); every 10th seal opens the fortieth chamber */
function seal(A,T,u,n){ if(!(n>0)) return; const s=T.s; A.stSet(T,u,'oCh',A.stGet(T,'oCh')+n); const was=s.oSeal||0; s.oSeal=was+n;
  if(T.P.nfw&&Math.floor(s.oSeal/10)>Math.floor(was/10)){ s.oNfwArm=1; s.oNfwAny=1; } }
const addU=(A,T,u,t,name,n,c)=>{ if(!t||!t.alive||!(n>0)) return; A.acts(T,u,[{ustack:name,on:'target',add:n}],Object.assign({},c||{},{u,src:u,tgt:t})); };
module.exports={
  hero:'orryn',
  casting:true,                         // rows ask which of his skills is resolving (Pressure Sphere's hits: 'strike'; his water: the part 'hz')
  states:{
    oCh:{max:40},                                                                  // Chambers (kept for the fight)
    oFl:{max:5,wave:'reset'},                                                      // the Flood (kept for the wave)
    oAm:{max:3,dur:6},                                                             // Abyss Mind
    oCr:{unit:true,max:3,dur:P('cr.dur',5),full:'oCrFull'},                         // Crushed on enemies (Lasting Crush longer)
    oWh:{unit:true,max:6,dur:P('wh.dur',4),full:'oWhFull'},                         // Whorls on enemies (Tighter Spiral longer)
    oSw:{unit:true,max:5,dur:P('sw.lin',1)}                                        // Sea Weight on enemies: held while in his water, lapses 1 s after it leaves (Heavy Sea longer)
  },
  always:[
    {on:'kit',do:[{fn:'kit'}]},                                                    // a skill of his resolves: Chambers, the empowered spell, the skill's options
    {on:'cast',do:[{fn:'cast'}]},                                                  // and after it: the hazard it made
    {on:'cd',reqAny:AR,do:[{fn:'press'}]},                                         // a Green / Blue press: what Abyssal Reserve did with it
    {on:'out',do:[{fn:'out'}]},                                                    // his hits
    {on:'num',skill:'hzTick',do:[{fn:'hz'}]},                                      // his water's tick on each enemy
    {on:'part',skill:'hz',do:[{fn:'hzAfter'}]},                                    // after his water has ticked
    {on:'hit',do:[{fn:'hit'}]},                                                    // Pressure Sphere has landed
    {on:'tick',do:[{fn:'tk'}]},                                                    // the Flood's clock, his water, energy, the shell, the floods that end
    {on:'in',reqAny:DRL,do:[{fn:'myDr'}]},                                         // his damage reduction (one capped group)
    {on:'teamIn',reqAny:['os_1_1','sp_4_1'],if:{srcTeam:'enemy'},do:[{fn:'teamDr'}]},   // Sea Weight and Weakened Draw on the enemy's hits on his allies
    {on:'oWhFull',reqAny:['sp_3_4','sp_n1','sp_13_3'],do:[{fn:'whFull'}]},         // 6 Whorls
    {on:'wave',do:[{fn:'wave'}]}                                                   // a wave starts: the clocks and the waters cleared
  ],
  talents:{
    /* ============================== THE FORTIETH CHAMBER ============================== */
    fc_1_1:[ {param:'cr.k',add:R(0.02)} ],                                                         // Crushed (the Sphere's hit gives it; orrK)
    fc_2_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                // Quick Sphere
    fc_1_4:[ {stat:{apow:R(0.0005)},per:'oCh'} ],                                                  // Chambers (seal: kit)
    fc_2_3:[ {param:'ar.pts',add:R(0.03)} ],                                                       // Stored Pressure (empK: 45% up to 60%, points)
    fc_2_4:[ {param:'ch.start',add:R(2)} ],                                                        // Old Rooms (wave 1)
    fc_3_1:[ {param:'cr.dur',add:R(0.4)} ],                                                        // Lasting Crush
    fc_n1:[  {param:'dr.brace',add:R(0.02)} ],                                                     // Braced for Depth (myDr: 3 s after the Sphere lands)
    fc_4_3:[ {param:'ar.dive',add:R(0.02)} ],                                                      // Diver's Breath (empK)
    fc_3_4:[ {param:'ar.deep',add:1} ],                                                            // Deeper Rooms (press)
    fc_n2:[  {param:'ch.first',add:R(1)} ],                                                        // First Door (kit)
    fc_5_2:[ {param:'ar.stun',add:1} ],                                                            // Spent Breath (PICK ONE; hit / hzAfter)
    fc_5_3:[ {param:'ar.saved',add:1} ],                                                           // Saved Breath (PICK ONE; press)
    fc_4_4:[ {param:'mr.seal',add:R(0.01)} ],                                                      // Sealed Rooms (mrIgn)
    fc_5_1:[ {stat:{move:R(-0.02)},per:{ust:'oCr'},to:{team:'enemy',ust:{oCr:1}}} ],               // Deep Crush
    fc_4_2:[ {param:'sph.tight',add:R(0.05)} ],                                                    // Tight Sphere (out)
    fc_5_4:[ {param:'dr.shell',add:R(0.006)} ],                                                    // Shell Wall (myDr)
    fc_6_1:[ {param:'sph.third',add:R(0.03)} ],                                                    // Third Crush (out)
    fc_6_3:[ {param:'sph.heavy',add:R(0.08)} ],                                                    // Heavy Hand (out)
    fc_6_4:[ {stat:{hp:R(0.01)},per:{stack:'oCh',div:10}} ],                                       // Nacre
    fc_7_2:[ {param:'ul.shore',add:R(0.03)} ],                                                     // Shoreless (hzK)
    fc_7_3:[ {param:'sph.imp',add:0.4} ],                                                          // Imploding Sphere (hit)
    fc_8_1:[ {on:'oUlTick',chance:R(0.15),do:[{ustack:'oCr',on:'target',add:1}]} ],                 // Grinding Weight
    fc_8_2:[ {param:'ul.rad',add:R(0.2)} ],                                                        // Far Water (kit)
    fc_8_4:[ {param:'ch.ledger',add:R(1)} ],                                                       // Keeper's Ledger (kit)
    fc_9_1:[ {on:'oCrFull',do:[{fn:'crushStun'}]} ],                                               // Crushing Depth
    fc_9_2:[ {on:'cd',less:R(0.01)} ],                                                             // Slow Current
    fc_9_3:[ {param:'ar.held',add:R(0.02)} ],                                                      // Breath Held Long (empK)
    fc_10_1:[ {param:'auto.pale',add:R(0.02)} ],                                                   // Pale Eyes (out)
    fc_10_2:[ {param:'ar.nrg',add:R(1)} ],                                                         // Deep Energy (kit)
    fc_10_4:[ {stat:{nrg:1/3},if:{stackMin:{oCh:40}}} ],                                           // Fortieth Door (gains x 4/3: 25% less energy needed)
    fc_11_3:[ {param:'ch.ult',add:R(2)} ],                                                         // Gathered Weight (kit)
    fc_11_4:[ {param:'sp.snow',add:R(0.005)} ],                                                    // Snowfall Weight (spellK)
    fc_12_1:[ {param:'sp.fin',add:R(0.04)} ],                                                      // Finished Work (spellK)
    fc_12_3:[ {param:'ul.rooms',add:R(0.001)} ],                                                   // Rooms Full of Sea (hzK)
    fc_12_4:[ {param:'dr.pearl',add:R(0.03)} ],                                                    // Pearl Skin (myDr)
    fc_13_3:[ {param:'nfw',add:1} ],                                                               // No Far Wall (SIGNATURE: seal, out, hit, tk)

    /* ============================== THE SPIRAL ============================== */
    sp_1_1:[ {param:'ds.k',add:R(0.10)} ],                                                         // Drawn Strength (tk)
    sp_2_1:[ {param:'ds.self',add:R(0.03)} ],                                                      // Spare Strength
    sp_1_4:[ {param:'wh.k',add:R(0.006)}, {stat:{aspd:R(-0.006)},per:{ust:'oWh'},to:{team:'enemy',ust:{oWh:1}}} ],   // Whorls
    sp_2_2:[ {param:'sc.nrg',add:R(0.02)} ],                                                       // Strong Current (kit: 40% up to 50%, points)
    sp_2_4:[ {param:'wh.dur',add:R(1)} ],                                                          // Tighter Spiral
    sp_3_1:[ {on:'ccIn',less:R(0.04),upTo:0.20} ],                                                 // Keeper's Calm (up to 20%)
    sp_3_3:[ {param:'sc.slowM',add:R(0.03)} ],                                                     // Slow Water (hzAfter)
    sp_3_4:[ {param:'wh.spin',add:1} ],                                                            // Spun Round (whFull)
    sp_4_1:[ {param:'sc.weak',add:R(0.015)} ],                                                     // Weakened Draw (myDr / teamDr)
    sp_4_2:[ {param:'sc.long',add:R(1)} ],                                                         // Long Spiral (cast)
    sp_4_3:[ {param:'sc.drag',add:R(0.3)} ],                                                       // Drag Along (hzAfter)
    sp_5_1:[ {on:'cd',skill:'blue',add:R(-0.5)} ],                                                 // Patient Current
    sp_5_2:[ {param:'sc.bite',add:R(0.04)} ],                                                      // Current Bite (hzK)
    sp_5_3:[ {param:'sc.sweep',add:1} ],                                                           // Sweeping Current (PICK ONE; hzAfter)
    sp_5_4:[ {param:'sc.stand',add:1} ],                                                           // Standing Whirl (PICK ONE; kit, cast)
    sp_6_1:[ {param:'dr.ain',add:R(0.02)} ],                                                       // Drained (orrK)
    sp_6_2:[ {param:'sph.slow',add:R(0.06)} ],                                                     // Second Current (hit)
    sp_6_4:[ {stat:{move:R(-0.02)},to:{team:'enemy',ust:{oWh:3}}} ],                               // Dizzied
    sp_7_1:[ {on:'teamHeal',if:{fn:'underScU'},less:R(0.03)} ],                                    // Dry Well
    sp_7_2:[ {param:'sph.ride',add:0.4} ],                                                         // Sphere in the Current (hit)
    sp_11_2:[ {stat:{apow:R(0.01)},per:'oAm'} ],                                                   // Abyss Mind (whFull)
    sp_8_1:[ {param:'ds.more',add:R(0.03)} ],                                                      // Strength Kept
    sp_8_3:[ {param:'ul.pound',add:R(0.03)} ],                                                     // Pounding Ocean (hzAfter)
    sp_8_4:[ {on:'oScTick',chance:R(0.2),do:[{ustack:'oWh',on:'target',add:1}]} ],                  // Quick Whorls
    sp_9_2:[ {param:'sc.rad',add:R(0.1)} ],                                                        // Wide Whorl (kit)
    sp_9_3:[ {param:'ul.tidal',add:R(0.03)} ],                                                     // Tidal Weight (hzK)
    sp_9_4:[ {param:'wh.eye',add:1} ],                                                             // Eye of the Spiral (whFull)
    sp_10_1:[ {param:'ds.as',add:R(0.02)}, {stat:{aspd:R(0.02)},to:{team:'ally',others:true,has:'oSs'}} ],   // Shared Strength
    sp_10_2:[ {on:'cd',less:R(0.01)} ],                                                            // Quiet Keeper
    sp_10_3:[ {param:'ul.whorl',add:R(1)} ],                                                       // Spinning Deep (hzAfter)
    sp_11_1:[ {param:'ds.all',add:1} ],                                                            // Given Strength
    sp_11_4:[ {param:'wh.in',add:R(0.004)} ],                                                      // Turned Inside (orrK)
    sp_n1:[  {param:'wh.deep',add:R(0.10)} ],                                                      // Too Deep to Turn (whFull, tk)
    sp_12_2:[ {param:'dr.calm',add:R(0.03)} ],                                                     // Calm Eye (myDr)
    sp_12_3:[ {param:'ul.still',add:R(0.05)} ],                                                    // Still Ocean (tk)
    sp_13_3:[ {param:'ul.spiral',add:1} ],                                                         // The Spiral Deep (SIGNATURE: cast, hzAfter, whFull, tk)

    /* ============================== OCEAN WITHOUT SHORE ============================== */
    os_1_1:[ {param:'sw.less',add:R(0.004)}, {param:'sw.drown',add:R(0.02)} ],                       // Drowning (tk; hzK; myDr / teamDr)
    os_2_4:[ {on:'tick',period:1,do:[{heal:{pct:R(0.002),of:'maxHp'}}]} ],                          // Deep Lungs (1% a second at 5/5: under the 1.2% cap)
    os_1_3:[ {param:'fl.k',add:R(0.006)} ],                                                        // Flood (tk; hzK)
    os_2_1:[ {param:'sw.lin',add:R(1)} ],                                                          // Heavy Sea
    os_n1:[  {param:'wcm',add:1} ],                                                                // Where the Currents Meet (LINK: hzK; the Whorl with Whorls, tk)
    os_2_3:[ {param:'fl.fast',add:R(1)} ],                                                         // High Water Mark
    os_3_1:[ {stat:{move:R(-0.03)},to:{team:'enemy',ust:{oSw:5}}} ],                               // Silt
    os_3_2:[ {param:'ul.dur',add:R(0.1)} ],                                                        // Endless Tide (kit)
    os_3_3:[ {param:'ul.rise',add:2} ],                                                            // Rising Sea (kit)
    os_4_1:[ {on:'teamIn',if:{srcTeam:'ally',targetTeam:'enemy',targetUst:{oSw:5}},more:R(0.02)}, {param:'sw.press',add:R(0.02)} ],   // Pressed Lungs (hits; his water: hzK)
    os_4_2:[ {param:'ul.ham',add:R(0.05)} ],                                                       // Tidal Hammer (hzK)
    os_n2:[  {param:'cs.slow',add:R(0.05)} ],                                                      // Cold Shock (tk)
    os_5_3:[ {param:'dr.flood',add:R(0.006)} ],                                                    // Flood Wall (myDr)
    os_5_4:[ {param:'sp.still',add:R(0.015)} ],                                                    // Still Mind (spellK)
    os_6_1:[ {on:'teamHeal',if:{unitUst:{oSw:5}},less:R(0.03)} ],                                  // Last Air
    os_6_3:[ {param:'fl.gate',add:R(1)} ],                                                         // Flood Gate (wave)
    os_6_4:[ {param:'sph.sw',add:R(1)} ],                                                          // Deep Sphere (hit)
    os_8_3:[ {on:'death',if:{who:'enemy',fn:'inWaterU'},chance:R(0.2),do:[{fn:'floodUp'}]} ],       // Rising Fast
    os_7_2:[ {param:'sc.under',add:R(0.03)} ],                                                     // Under Pressure (hzK)
    os_7_3:[ {param:'ul.wide',add:R(0.2)} ],                                                       // Wide Flood (kit)
    os_7_4:[ {param:'sph.water',add:1} ],                                                          // Drowning Sphere (hit)
    os_5_1:[ {param:'ul.ground',add:1} ],                                                          // Drowned Ground (PICK ONE; cast)
    os_8_2:[ {param:'ul.long',add:R(0.04)} ],                                                      // Long Flood (hzK)
    os_n3:[  {param:'wr.k',add:R(0.2)} ],                                                          // The Water Remembers (tk)
    os_5_2:[ {param:'ul.pt',add:1} ],                                                              // Pounding Tide (PICK ONE; cast)
    os_9_1:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',ust:{oSw:5}}} ],                               // Undersea Quiet
    os_9_2:[ {param:'ul.second',add:1} ],                                                          // Second Ocean (hzEnd)
    os_9_4:[ {on:'cd',less:R(0.01)} ],                                                             // Keeper's Patience
    os_10_1:[ {param:'dr.pale',add:R(0.03)} ],                                                     // Pale Calm (myDr)
    os_10_3:[ {param:'mr.sea',add:R(0.02)} ],                                                      // Sea Level (mrIgn)
    os_10_4:[ {on:'death',if:{who:'enemy',unitUst:{oSw:5}},do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ], // Saltwater Blood
    os_11_2:[ {on:'oUlTick',chance:R(0.2),do:[{ustack:'oSw',on:'target',add:1}]} ],                 // The Weight Comes Up
    os_11_3:[ {on:'hit',if:{auto:true,targetTeam:'enemy',stackMin:{oFl:5}},do:[{dmg:{pct:R(0.10),of:'hit'},on:{team:'enemy',of:'target',within:1.5,skip:'target'},tag:'oSplash'}]} ],   // Above the Line
    os_12_1:[ {param:'sw.fast',add:R(0.10)} ],                                                     // Gathering Deep (tk)
    os_12_2:[ {param:'fl.tide',add:R(1)} ],                                                        // Tide Rising (cast)
    os_12_4:[ {param:'ps.k',add:R(0.015)} ],                                                       // Patient Shell (tk)
    os_13_2:[ {param:'ul.noshore',add:1} ]                                                         // No Shore At All (SIGNATURE: cast, hzEnd)
  },
  fn:{
    /* ---- conditions ---- */
    underScU(A,T,u,c){ const x=c.unit; return !!x&&x.team!==u.team&&underSc(A,T,u,x); },
    inWaterU(A,T,u,c){ const x=c.unit; return !!x&&x.team!==u.team&&!!waterOf(A,T,u,x); },
    floodUp(A,T,u){ A.stSet(T,u,'oFl',A.stGet(T,'oFl')+1); },
    /* ---- a skill of his resolves (kit: before its case, ctx.o is the copy it reads) ---- */
    kit(A,T,u,c){ const s=T.s, Pm=T.P, o=c.o||{}, E=A.eng(), M=E.METER(), slot=u._castSlot;
      s.oCurE=null; if(c.skill!==SPH&&c.skill!=='ashfall') return; s.oSlot=slot;
      if(slot==='green'||slot==='blue'){ const e=s.oPr&&s.oPr[slot]; if(e&&Math.abs((u._castSM||1)-e.sm)<=1e-9*Math.max(1,e.sm)){ s.oCurE=e; } if(s.oPr) s.oPr[slot]=null;
        if(c.skill===SPH&&Pm.nfw&&s.oNfwArm){ s.oNfwArm=0; s.oNfwOn=1; }                     // No Far Wall: this Sphere was opened by the seals before it
        if(CH.some(id=>T.r[id])){ let n=1; if(c.skill===SPH&&Pm['ch.first']&&s.oFd!==s.wave){ s.oFd=s.wave; n+=Pm['ch.first']; } if(s.oCurE&&Pm['ch.ledger']) n+=Pm['ch.ledger']; seal(A,T,u,n); }
        if(s.oCurE&&Pm['ar.nrg']) u.energy=Math.min(100,(u.energy||0)+Pm['ar.nrg']); }
      if(c.skill===SPH){ s.oCast=(s.oCast||0)+1; if(Pm['dr.brace']) A.acts(T,u,[{window:'oBr',dur:3}],c); return; }
      if(slot==='blue'){ if(Pm['sc.rad']) o.radius=(o.radius||0)+Pm['sc.rad']*M; if(Pm['sc.stand']) o.radius=(o.radius||0)*1.3; if(Pm['sc.nrg']) o.nrgSlow=(o.nrgSlow||0)+Pm['sc.nrg']; }
      else if(slot==='ult'){ let add=(Pm['ul.rad']||0)+(Pm['ul.wide']||0); if(Pm['ul.rise']&&A.stGet(T,'oFl')>=5) add+=Pm['ul.rise']; if(add) o.radius=(o.radius||0)+add*M; if(Pm['ul.dur']) o.dur=(o.dur||5)+Pm['ul.dur'];
        if(Pm['ch.ult']) seal(A,T,u,Pm['ch.ult']); } },
    /* after the skill: Pressure Sphere's window ends; the hazard Spiral Current or Ocean Without Shore has just made is tagged his and changed */
    cast(A,T,u,c){ const s=T.s, Pm=T.P, E=A.eng(), slot=s.oSlot; s.oSlot=null; const e=s.oCurE; s.oCurE=null;
      if(c.skill===SPH){ s.oNfwOn=0; return; } if(c.skill!=='ashfall'||!E.hazards) return;
      const H=E.hazards(), M=E.METER(); let h=null; for(let i=H.length-1;i>=0;i--){ const x=H[i]; if(x&&x.src===u&&!x.arrival&&!x._talZ&&!x.orb){ h=x; break; } } if(!h) return;
      s.oHid=(s.oHid||0)+1; h._talZ=u; h._oId=s.oHid; h._oK=slot==='ult'?'ul':'sc'; h._oE=(slot==='blue')?e:null; h._oSeen={}; h._oIn={}; h._oStr=1; (s.oHz||(s.oHz=[])).push(h);
      if(h._oK==='sc'){ const spd=Math.hypot(h.vx||0,h.vy||0)||1;
        if(Pm['sc.stand']){ const t=Math.max(0,(h.travelLeft||0)-4*M/spd); h.travelLeft=t; h.life=t+4; }   // stops at its target (it starts 1 m out and would run 3 m past) and spins 4 s
        else if(Pm['sc.long']){ const x=Pm['sc.long']*M/spd; h.travelLeft=(h.travelLeft||0)+x; h.life+=x; } return; }
      if(Pm['ul.pt']){ h.interval=0.5/1.3; h._oStr*=0.8; }                                     // Pounding Tide: 30% more often, each 20% weaker
      if(Pm['ul.ground']){ h.life+=3; h._oHalf=3; }                                            // Drowned Ground: 3 s more at half strength
      if(Pm['ul.spiral']) h._oSp=1;
      if(Pm['ul.noshore']&&A.stGet(T,'oFl')>=5){ h.r=999*M; h._oStr*=0.6; h._oNs=1; }          // No Shore At All: the whole field at 60%
      if(Pm['fl.tide']) A.stSet(T,u,'oFl',A.stGet(T,'oFl')+Pm['fl.tide']); },
    /* a Green / Blue press (the cd hook, right after castKit): did Abyssal Reserve empower it? (its pending cast's multiplier against the level's own) */
    press(A,T,u,c){ const s=T.s, Pm=T.P, E=A.eng(), p=u._pend, slot=c.slot; if(!p||!p.spell||!E.skillMul) return; const base=E.skillMul(p.lv||1); if(!(base>0)) return;
      const F=p.sm/base; let emp=F>1+1e-6;
      if(emp&&slot==='blue'&&Pm['ar.saved']){ p.sm=base; u._prReady=1; emp=false; }           // Saved Breath: the pressure waits for Pressure Sphere
      const P0=s.oPr||(s.oPr={}); if(emp){ P0[slot]={sm:p.sm,F:F-1,dv:s.oDv||0,sv:(slot==='green'&&Pm['ar.saved'])?1:0}; s.oDv=0; } else { P0[slot]=null; s.oDv=Math.min(3,(s.oDv||0)+1); }
      if(Pm['ar.deep']&&A.stGet(T,'oCh')>=20&&!u._prReady&&(u._prS||0)>=2){ u._prReady=1; u._prS=0; } },   // Deeper Rooms: every second cast
    /* his hits: damage from Orryn; Pressure Sphere's own; basic attacks on Crushed enemies */
    out(A,T,u,c){ const t=c.tgt, E=A.eng(), Pm=T.P, s=T.s; if(!t||t.team===u.team||!(c.amt>0)) return; let k=orrK(A,T,u,t);
      if(s.cur===SPH){ if(Pm['sph.tight']) k*=1+Pm['sph.tight']; if(Pm['sph.heavy']&&t.hp>0.70*t.maxHp) k*=1+Pm['sph.heavy']; if(Pm['sph.third']&&ust(A,T,u,t,'oCr')>=2) k*=1+Pm['sph.third'];
        k*=spellK(A,T,u,t); if(s.oCurE) k*=empK(A,T,u,t,s.oCurE); if(c.kind==='magic') k*=mrK(E,u,t,mrIgn(A,T));
        const dm=c.kind==='magic'?E.defMul(u,t,'magic'):1; s.oRaw=(c.amt*k)/(dm>0?dm:1); if(s.oNfwOn) k*=3; }
      if(c.auto&&Pm['auto.pale']&&ust(A,T,u,t,'oCr')>0) k*=1+Pm['auto.pale'];
      c.amt*=k; },
    /* Pressure Sphere has landed on its target */
    hit(A,T,u,c){ const t=c.tgt, s=T.s, Pm=T.P, E=A.eng(); if(s.cur!==SPH||!t||t.team===u.team) return; const key='s'+(s.oCast||0), cx={h:{_oId:key}}, raw=s.oRaw||0;
      if(CR.some(id=>T.r[id])) addU(A,T,u,t,'oCr',1,cx);
      if(Pm['sph.sw']) addU(A,T,u,t,'oSw',Pm['sph.sw']);
      if(Pm['sph.slow']) slowOn(t,Pm['sph.slow'],2);
      if(s.oCurE&&Pm['ar.stun']) tstun(A,T,u,t,0.5,key);
      const dmgTo=(x,a)=>{ if(x&&x.alive&&a>0) A.hurt(T,u,x,a*E.defMul(u,x,'magic'),'#2f8fa8','oSph'); };
      if(Pm['sph.ride']){ const hs=myHz(A,T,'sc').filter(h=>inHz(h,t)); if(hs.length) for(const x of foes(A,u)) if(x!==t&&hs.some(h=>inHz(h,x))) dmgTo(x,raw*Pm['sph.ride']); }
      if(Pm['sph.imp']) for(const x of A.pick(T,u,{team:'enemy',of:'target',within:2.5,skip:'target'},{u,tgt:t})) dmgTo(x,raw*Pm['sph.imp']);
      if(s.oNfwOn){ const dx=t.x-u.x, dy=t.y-u.y, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, M=E.METER();   // No Far Wall: every enemy on the line behind it
        for(const x of foes(A,u)){ if(x===t) continue; const rx=x.x-u.x, ry=x.y-u.y, pr=rx*ux+ry*uy; if(pr<=L) continue; if(Math.abs(rx*uy-ry*ux)-E.bodyR(x)>0.5*M) continue; dmgTo(x,raw); if(x.alive) addU(A,T,u,x,'oCr',3,cx); } }
      if(Pm['sph.water']&&t.alive) A.acts(T,u,[{zone:'oDs',at:'target',radius:1.5,dur:3}],{u,tgt:t}); },
    /* his water's tick on one enemy (num 'hzTick': ctx.unit = the enemy, ctx.src = the hazard, ctx.amt = its tick before the enemy's resist) */
    hz(A,T,u,c){ const e=c.unit, h=c.src; if(!e||!h||h._talZ!==u) return; c.amt*=hzK(A,T,u,h,e); },
    /* after his water has ticked (ctx.tgt = the hazard): Whorls, energy-slow marks, Drained, Spent Breath, drags, Slow Water; the flood's riders */
    hzAfter(A,T,u,c){ const h=c.tgt, Pm=T.P, s=T.s, E=A.eng(), M=E.METER(); if(!h||h._talZ!==u) return; const IN=foes(A,u).filter(x=>inHz(h,x)), cx={h};
      const whOn=WH.some(id=>T.r[id]);
      if(h._oK==='sc'){ const spd=Math.hypot(h.vx||0,h.vy||0), slowOwn=(T.r.sp_6_2||T.r.os_n2||T.r.sp_8_3||Pm['sc.slowM']);
        for(const x of IN){ const first=!h._oSeen[x.uid]; h._oSeen[x.uid]=1;
          if(whOn){ addU(A,T,u,x,'oWh',1,cx); if(T.on.oScTick) A.run(T,u,'oScTick',{u,src:u,tgt:x,h}); }
          if(NRG.some(id=>T.r[id])&&(h.nrgSlow||0)>0) A.setMark(T,u,x,'oNs',{dur:h.nrgDur||4});
          if(Pm['dr.ain']&&(h.nrgSlow||0)>0) A.setMark(T,u,x,'oDr',{dur:3});
          if(first&&h._oE&&Pm['ar.stun']) tstun(A,T,u,x,0.5,'h'+h._oId);
          if(first&&!(x.immovable||(x._gearImmovableT||0)>0)&&spd>0&&(h.travelLeft||0)>0){ const ux=h.vx/spd, uy=h.vy/spd;
            if(Pm['sc.sweep']){ let d=spd*h.travelLeft; if((x.t&&x.t.isboss)||x._raidBoss||E.bodyR(x)>2.5*M) d*=0.5; if(d>0){ x.pulledBy={x:x.x+ux*d,y:x.y+uy*d,alive:true}; x.pullStop=0; x.pullSpeed=Math.max(1,spd); x.pullT=d/Math.max(1,spd); x._pullGhost=false; } }
            else if(Pm['sc.drag']){ const d=Pm['sc.drag']*M; x.pulledBy={x:x.x+ux*d,y:x.y+uy*d,alive:true}; x.pullStop=0; x.pullSpeed=Math.max(1,d/0.3); x.pullT=0.3; x._pullGhost=false; } }
          if(slowOwn&&(x.slow||0)>0){ const m=1-SC_SLOW*(1+(Pm['sc.slowM']||0)); x.slowMul=Math.min(x.slowMul!=null?x.slowMul:1-SC_SLOW,Math.max(0.05,m)); } }   // the whirlpool's own slow keeps its strength (Slow Water: stronger)
        return; }
      for(const x of IN){ h._oIn[x.uid]=x;
        if(whOn){ const n=(Pm['ul.whorl']||0)+(h._oSp?2:0); if(n>0) addU(A,T,u,x,'oWh',n,cx); }
        if(T.on.oUlTick) A.run(T,u,'oUlTick',{u,src:u,tgt:x,h});
        if(Pm['ul.pound']) slowOn(x,Pm['ul.pound'],1);
        if(h._oSp&&x.alive&&!(x.immovable||(x._gearImmovableT||0)>0)){ const dd=Math.hypot(h.x-x.x,h.y-x.y), m=Math.min(dd,0.5*(h.interval||0.5)*M); if(m>1){ x.pulledBy={x:h.x,y:h.y,alive:true}; x.pullStop=Math.max(0,dd-m); x.pullSpeed=Math.max(1,m/(h.interval||0.5)); x.pullT=h.interval||0.5; x._pullGhost=false; } } } },
    /* 6 Whorls: spun round (Spun Round 1 s; inside The Spiral Deep's flood 1.5 s), or, when it cannot be stunned, Too Deep to Turn */
    whFull(A,T,u,c){ const x=c.tgt, Pm=T.P, s=T.s; if(!x||!x.alive) return; const sp=Pm['ul.spiral']&&inUlt(A,T,u,x,true), key=c.h?('h'+c.h._oId):'w';
      if((Pm['wh.spin']||sp)&&stunOk(A,T,u,x)&&tstun(A,T,u,x,sp?1.5:1,key)){ A.ustPut(T,u,x,'oWh',0);
        if(T.r.sp_11_2) A.acts(T,u,[{stack:'oAm',add:1},{stack:'oAm',touch:true}],{u});
        if(Pm['wh.eye']) A.acts(T,u,[{pull:{team:'enemy',of:'target',within:2,skip:'target'},to:'target',m:1,secs:0.3}],{u,tgt:x}); return; }
      if(Pm['wh.deep']&&!stunOk(A,T,u,x)){ A.setMark(T,u,x,'oTd',{dur:4}); A.ustPut(T,u,x,'oWh',0); } },
    /* 3 Crushed: Crushing Depth stuns it 1 s and its stacks clear (refused by the stun-lock rule: they stay, and the next gain tries again) */
    crushStun(A,T,u,c){ const x=c.tgt; if(!x||!x.alive) return; if(tstun(A,T,u,x,1,c.h?('c'+c.h._oId):'c')) A.ustPut(T,u,x,'oCr',0); },
    /* ---- each tick ---- */
    tk(A,T,u,c){ const s=T.s, Pm=T.P, E=A.eng(), dt=c.dt||0, M=E.METER(); s.oFt=(s.oFt||0)+dt;
      if(Pm['sp.still']) s.oStill=A.pick(T,u,{team:'enemy',within:4},{u}).length===0;
      if(FL.some(id=>T.r[id])){ s.oFlT=(s.oFlT||0)+dt; const per=Math.max(1,8-(Pm['fl.fast']||0)); while(s.oFlT>=per){ s.oFlT-=per; A.stSet(T,u,'oFl',A.stGet(T,'oFl')+1); } }
      if(Pm.nfw&&!s.oNfwAny&&s.oFt>=20){ s.oNfwAny=1; s.oNfwArm=1; }                         // No Far Wall: 20 s of the fight before his 10th Chamber
      const L=s.oHz||[]; for(let i=0;i<L.length;i++){ const h=L[i]; if(live(A,h)) continue; L.splice(i--,1); T.fn.hzEnd(A,T,u,h); }
      const F=(WATER.some(id=>T.r[id])||NRG.some(id=>T.r[id]))?foes(A,u):null;
      if(F&&WATER.some(id=>T.r[id])) T.fn.water(A,T,u,F,dt);
      if(F&&NRG.some(id=>T.r[id])) T.fn.energy(A,T,u,F);
      if(Pm['ps.k']) T.fn.shell(A,T,u,dt); },
    /* his water, each tick: Sea Weight (1 a second inside, Gathering Deep faster; held while inside, lapsing after it leaves), Drowning's first Whorl
       (Where the Currents Meet), Cold Shock as it enters, The Water Remembers as it comes back */
    water(A,T,u,F,dt){ const s=T.s, Pm=T.P, W=s.oW||(s.oW={}), swOn=SW.some(id=>T.r[id]), lin=(T.st.oSw&&T.st.oSw.dur)||1;
      for(const x of F){ const w=waterOf(A,T,u,x), st=W[x.uid]||(W[x.uid]={in:null,acc:0,rem:null,used:{}});
        if(st.rem){ st.rem.left-=dt; if(st.rem.left<=0) st.rem=null; }
        if(w){ if(!st.in){ if(Pm['cs.slow']) slowOn(x,Pm['cs.slow'],1);
            if(Pm['wr.k']&&st.rem&&w!=='zone'&&st.rem.h===w&&!st.used[w._oId]){ st.used[w._oId]=1; const a=w.dmg*hzK(A,T,u,w,x)*Pm['wr.k']*A.eng().defMul(u,x,'magic'); A.hurt(T,u,x,a,'#2f8fa8','oRem'); } }
          st.in=w; if(!x.alive) continue;
          if(swOn){ st.acc+=dt*(1+(Pm['sw.fast']||0)); let v=ust(A,T,u,x,'oSw'); const v0=v; while(st.acc>=1){ st.acc-=1; v=Math.min(5,v+1); }
            if(v!==v0||v>0){ const o=x._talM&&x._talM[u.uid], m=o&&o['#oSw']; if(m&&v===v0) m.until=A.eng().now()+lin; else A.ustPut(T,u,x,'oSw',v,lin); }
            if(v>=5&&Pm.wcm&&T.r.sp_1_4){ const D=s.oWcm||(s.oWcm={}); if(!D[x.uid]){ D[x.uid]=1; addU(A,T,u,x,'oWh',1); } } } }
        else { if(st.in&&st.in!=='zone'&&x.alive) st.rem={h:st.in,left:4}; st.in=null; st.acc=0; } } },
    /* energy, each tick: what the enemies gained since his last tick. Drawn Strength: what his Spiral Current's energy slow kept from them (gain x p / (1 - p))
       goes to his ally with the least energy (Given Strength: to each ally within 6 m of him); the energy cuts of Too Deep to Turn, Still Ocean and The
       Spiral Deep take their share of the gain back */
    energy(A,T,u,F){ const s=T.s, Pm=T.P, E0=s.oE||(s.oE={}); let pool=0;
      for(const x of F){ const e1=x.energy||0, e0=E0[x.uid]; E0[x.uid]=e1; if(e0==null) continue; const g=e1-e0; if(!(g>0)) continue;
        if((Pm['ds.k']||Pm['ds.self'])&&(x._nrgSlowT||0)>0&&A.markOf(u,x,'oNs')){ const p=x._nrgSlowPct||0; if(p>0&&p<1) pool+=g*p/(1-p); }
        let keep=1; if(Pm['ul.spiral']&&inUlt(A,T,u,x,true)) keep=0; else { if(Pm['ul.still']&&inUlt(A,T,u,x)) keep*=1-Pm['ul.still']; if(Pm['wh.deep']&&A.markOf(u,x,'oTd')) keep*=1-Pm['wh.deep']; }
        if(keep<1){ x.energy=e0+g*keep; E0[x.uid]=x.energy; } }
      if(!(pool>0)) return; s.oDrawn=(s.oDrawn||0)+pool;
      const amt=pool*(Pm['ds.k']||0)*(1+(Pm['ds.more']||0));
      if(Pm['ds.self']) u.energy=Math.min(100,(u.energy||0)+pool*Pm['ds.self']*(1+(Pm['ds.more']||0)));
      if(!(amt>0)) return; let to=Pm['ds.all']?A.pick(T,u,{team:'ally',others:true,within:6},{u}):[];
      if(!to.length){ let b=null; for(const a of A.pick(T,u,{team:'ally',others:true},{u})) if(!b||(a.energy||0)<(b.energy||0)) b=a; if(b) to=[b]; }
      for(const a of to){ a.energy=Math.min(100,(a.energy||0)+amt); s.oGiven=(s.oGiven||0)+amt; if(Pm['ds.as']) A.setMark(T,u,a,'oSs',{dur:3}); } },
    /* Patient Shell: after 4 s without losing HP or shield, a shield; once it breaks, it comes back 4 s later (both clocks count down) */
    shell(A,T,u,dt){ const s=T.s, hp=(u.hp||0)+(u.shield||0);
      if(s.oPsH!=null&&hp<s.oPsH-1e-9) s.oPsQ=0; else s.oPsQ=(s.oPsQ||0)+dt;
      if(s.oPsOn&&!((u.shield||0)>1e-9)){ s.oPsOn=0; s.oPsB=1; s.oPsW=4; }
      if(s.oPsW>0) s.oPsW-=dt;
      if(!s.oPsOn&&(s.oPsB?s.oPsW<=0:s.oPsQ>=4)){ u.shield=(u.shield||0)+T.P['ps.k']*u.maxHp; u.shieldT=Math.max(u.shieldT||0,999); s.oPsOn=1; s.oPsB=0; }
      s.oPsH=(u.hp||0)+(u.shield||0); },
    /* a hazard of his has ended: No Shore At All's last impact and the Flood held at 5; Second Ocean's smaller flood */
    hzEnd(A,T,u,h){ const Pm=T.P, E=A.eng(), M=E.METER(); if(h._oK!=='ul'||h._oSub||!u.alive) return;
      if(h._oNs){ for(const x of foes(A,u)){ const n=ust(A,T,u,x,'oSw'); if(n>0) A.hurt(T,u,x,h.dmg*hzK(A,T,u,h,x,true)*0.4*n*E.defMul(u,x,'magic'),'#2f8fa8','oNoShore'); } A.stSet(T,u,'oFl',5); }
      if(Pm['ul.second']&&E.hazards){ let b=null; for(const k in h._oIn){ const x=h._oIn[k]; if(x.alive&&(!b||x.hp>b.hp)) b=x; }
        if(b){ const s=T.s; s.oHid=(s.oHid||0)+1; const z={x:b.x,y:b.y,r:3*M,dmg:h.dmg,team:u.team,src:u,interval:0.5,acc:0,life:2,color:h.color||'#2f8fa8',_talZ:u,_oId:s.oHid,_oK:'ul',_oSub:1,_oSeen:{},_oIn:{},_oStr:1,_oSp:h._oSp};
          E.hazards().push(z); (s.oHz||(s.oHz=[])).push(z); } } },
    /* ---- his damage reduction: ONE capped group (Shell Wall, Braced for Depth, Flood Wall, Pearl Skin, Calm Eye, Pale Calm, Sea Weight, Weakened Draw).
       They multiply; together at most 40% off a hit. Pure: the 95% probe calls it tick by tick ---- */
    drK(A,T,u,src){ const Pm=T.P; let f=1;
      if(Pm['dr.shell']) f*=1-Pm['dr.shell']*Math.floor(A.stGet(T,'oCh')/10);
      if(Pm['dr.brace']&&A.winOn(T,'oBr')) f*=1-Pm['dr.brace'];
      if(Pm['dr.flood']) f*=1-Pm['dr.flood']*A.stGet(T,'oFl');
      if(src&&src.team!==u.team){ const sw=ust(A,T,u,src,'oSw');
        if(Pm['dr.pearl']&&ust(A,T,u,src,'oCr')>0) f*=1-Pm['dr.pearl']; if(Pm['dr.calm']&&ust(A,T,u,src,'oWh')>=3) f*=1-Pm['dr.calm'];
        if(Pm['dr.pale']&&sw>=5) f*=1-Pm['dr.pale']; if(Pm['sw.less']&&sw>0) f*=1-Pm['sw.less']*sw; if(Pm['sc.weak']&&underSc(A,T,u,src)) f*=1-Pm['sc.weak']; }
      return Math.max(1-DR_CAP,f); },
    myDr(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c.src); },
    /* the same debuffs on an enemy's hits on his allies (their own number: a debuff on the enemy, not his group) */
    teamDr(A,T,u,c){ const x=c.src, Pm=T.P; if(!x||!c.tgt||c.tgt.team!==u.team) return; let f=1; const sw=ust(A,T,u,x,'oSw');
      if(Pm['sw.less']&&sw>0) f*=1-Pm['sw.less']*sw; if(Pm['sc.weak']&&underSc(A,T,u,x)) f*=1-Pm['sc.weak']; c.amt*=f; },
    /* ---- a wave starts (the fight clock restarts at 0): the waters and their bookkeeping cleared, the Flood at Flood Gate's level, Old Rooms in the first ---- */
    wave(A,T,u){ const s=T.s, Pm=T.P; s.oHz=[]; s.oW={}; s.oE={}; s.oWcm={}; s.oSk={}; s.oFlT=0; s.oPsQ=0; s.oPsH=null; s.oPsOn=0; s.oPsB=0; s.oPsW=0; s.oPr=null; s.oCurE=null; s.oNfwOn=0;
      if(T.s.zn.oDs) T.s.zn.oDs.length=0;
      for(const a of A.eng().units()) if(a.team===u.team&&a!==u) A.clearMark(u,a,'oSs');
      if(Pm['fl.gate']) A.stSet(T,u,'oFl',Pm['fl.gate']);
      if(s.wave===1&&Pm['ch.start']) seal(A,T,u,Pm['ch.start']);
      s.oApi=A; }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (readings and corrected tooltips in WIRING/45 - ORRYN - talent decisions.md) */
  ruling:{}
};
