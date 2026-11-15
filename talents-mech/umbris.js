/* UMBRIS - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Umbris": what he added)
   His real kit (the code, not the card wording; damage profile Magic: every hit and DoT of his is magic, his skills read his ability power; measured in
   tests/umbris-kit-facts.js, 20 seeded fights):
   - Basic attack: a bolt that lands on the attack clip's release cell (his think, the _boltT fuse), one every 2.0 s, magic (the profile's default kind).
   - Shadeburst ('shadeburst', green, cd 7, delivered as a form on the densest enemy group): every enemy whose CENTRE is within 7 m of the centre gets a rot
     (a magic curse DoT, 30% of his ability power x skill level a second, 6 s, queued 0.5 s through plagueDot). No hit, and no field stays behind: an enemy
     that walks in later gets nothing (2.66 enemies a cast). For his talents the "field" is that circle for as long as its rot lasts (the page's 'at' line).
   - Creeping Rot ('creeprot', blue, cd 6): one hit on his target (50% x skill level) and a rot (60% a second, 5 s, queued 0.5 s): "the mark".
   - Umbral Cataclysm ('umbralcata', ultimate on energy): the orb lands later in his think (u._voidCast; the page's landPre / land pass that record as ctx.tgt): every enemy whose centre is within 6.8 m takes 160%
     x skill level (2.86 enemies a cast), then a void zone (voidZones) ticks 60% a second for 5 s on every enemy inside (centre measure). Its ticks are hits,
     not DoTs; they set the contagion flag but put no rot on. The page's landPre / land pair ('umbralcata') and partPre / part ('umZone') make them his.
   - Lingering Dark (passive 'contagion'): an enemy that dies carrying his rot spreads it (5.98 s at level 100) to every enemy whose CENTRE is within 2.6 m of
     its centre. Bodies are 1.6 to 2.0 m in radius, so that is an enemy standing inside it: 0 spreads from 101 rotting deaths (nearest other enemy at a median
     5.1 m centre to centre). NOT repaired here (the skill reach audit, open for Phil): every talent built on the spread says in its tooltip what it needs.
   Thinning, Generations, Correction, Dimmed, the Candle and Stare, Two Stars exist only through his talents. All his per-fight state is in T.s.um; every
   state name starts with 'um'. Readings, caps and corrected tooltips: WIRING/59 - UMBRIS - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const SB='shadeburst', CR='creeprot', UC='umbralcata', ZN='umZone', SK=[SB,CR,UC,ZN];
const DR_ME=0.35, DR_AL=0.15, SLOW_CAP=0.40, REGEN=0.012, TH_MAX=10, LT_CD=15, LT_WIN=2;
const CRT={creeprot:1,umTwin:1};          // the rots that are Creeping Rot's mark (its own, Twin Rot's)
/* the talents that read each shared state: its bookkeeping runs when any of them is learned (a 30-point dip never buys a talent that reads a state nothing makes) */
const TH=['sd_1_1','sd_2_1','sd_3_1','sd_4_1','sd_5_1','sd_5_3','sd_6_1','sd_6_2','sd_8_1','sd_8_4','sd_10_1','sd_11_1','sd_11_2','sd_13_2','wl_n1'];
const GEN=['sd_1_4','sd_6_4','sd_9_4','sd_8_4'];
const DIM=['wl_1_4','wl_2_4','wl_3_4','wl_4_2','wl_n1','wl_5_4','wl_6_4','wl_8_3','wl_8_4','wl_9_4','wl_n3','wl_11_4','wl_12_2','wl_13_3'];
const COR=['wl_1_1','wl_4_1','wl_n1','wl_2_1','wl_6_1','wl_7_1','wl_10_1','wl_11_1','wl_8_1','wl_13_3'];
const STARE=['oc_1_2','oc_2_2','oc_3_2','oc_5_2','oc_6_2','oc_8_2','oc_10_2','oc_11_2','oc_11_3','oc_12_1','oc_12_4','oc_13_3'];
const STARS=['oc_1_4','oc_3_4','oc_4_4','oc_2_4','oc_6_4','oc_9_4','oc_12_3'];
const DRME=['sd_7_1','wl_6_4','wl_12_3','wl_11_4','wl_12_4','oc_10_4','oc_12_1','oc_11_4'];
const DRAL=['sd_7_1','wl_6_4','wl_12_3'];
const SLOWS=['wl_3_3','sd_5_1','wl_9_2','oc_4_4','oc_12_4'];
const HEALC=['sd_3_1','sd_n2','wl_2_2','wl_10_3'];
const SHC=['sd_3_1','wl_2_2','wl_10_3','wl_n3'];
const MISS=['wl_1_4','wl_12_2'];
const TEAMK=['wl_4_1','sd_11_1','wl_8_3'];
/* ---- small readers that need no API (the 95% instrument calls drK from a test with the API kept on T.s.api) ---- */
const rk=(T,id)=>T.r[id]||0;
const any=(T,L)=>{ for(let i=0;i<L.length;i++) if(T.r[L[i]]) return true; return false; };
const recOf=(T,x)=>{ const M=T.s.um&&T.s.um.e; return (M&&x)?M[x.uid]||null:null; };
const recMk=(T,x)=>{ const M=T.s.um.e; return M[x.uid]||(M[x.uid]={th:0,keep:0,zT:0,dimL:0,dim:false,rot:false,cr:false,inF:false,inZ:false,sh:x.shield||0,en:x.energy||0,lt:0,lw:0,rg:null,cs:0}); };
const thOf=(T,x)=>{ const r=recOf(T,x); return r?Math.floor(r.th+1e-9):0; };
const myDots=(u,x)=>{ const D=x&&x.dots; if(!D) return false; for(let i=0;i<D.length;i++){ const d=D[i]; if(d._talO===u.uid&&d.remaining>0) return true; } return false; };
const crOn=(u,x)=>{ const D=x&&x.dots; if(!D) return false; for(let i=0;i<D.length;i++){ const d=D[i]; if(d._talO===u.uid&&CRT[d._talK]&&d.remaining>0) return true; } return false; };
const rotting=(T,u,x)=>{ const r=recOf(T,x); return myDots(u,x)||!!(r&&r.zT>0); };
const gapM=(E,a,b)=>(E.dist(a,b)-E.bodyR(a)-E.bodyR(b))/E.METER();
const foes=(E,u)=>E.units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden);
const zonesOf=(E,u)=>{ const Z=E.umZones?E.umZones():null, L=[]; if(Z) for(let i=0;i<Z.length;i++){ const z=Z[i]; if(z.owner===u&&z.life>0) L.push(z); } return L; };
const zoneAt=(E,u,x)=>{ const Z=E.umZones?E.umZones():null; if(!Z||!x) return null; for(let i=0;i<Z.length;i++){ const z=Z[i]; if(z.owner===u&&z.life>0&&Math.hypot(x.x-z.x,x.y-z.y)<=z.r) return z; } return null; };
const fieldAt=(T,x)=>{ const L=T.s.um&&T.s.um.f; if(!L||!x) return null; for(let i=0;i<L.length;i++){ const f=L[i]; if(f.t>0&&Math.hypot(x.x-f.x,x.y-f.y)<f.R) return f; } return null; };
const extDot=(d,secs)=>{ const add=secs/(d.interval||1); if(!(add>0)||!(d.remaining>0)) return; const n=d.remaining-1+(d._talF!=null?d._talF:1)+add; d.remaining=Math.ceil(n-1e-9); const f=n-(d.remaining-1); d._talF=(f<1-1e-9)?f:null; };
const dotLeft=d=>(d.remaining-1+(d._talF!=null?d._talF:1))*(d.interval||1);
const BUFFT=['dmgBuffT','hasteT','drT','_critBuffT','_lifestealT'];   // the engine's timed buffs on a unit (Turned Down, the Lamp's strip)
module.exports={
  hero:'umbris',
  casting:true,                         // rows ask which of his skills a hit comes from (the zone's ticks and the ultimate's first hit are parts / landings)
  points:true,                          // rows read where Shadeburst forms (the page's 'at' line in its case: his field)
  poison:true,                          // his rots are his: every plagueDot of his is queued through poisQ / pois, and Lingering Dark's spread runs spreadR / spread
  states:{
    umStare:{max:P('stare.max',15)}     // Stare (Night Vigil: 1 higher a rank)
  },
  always:[
    {on:'tick',do:[{fn:'tk'}]},                                                                                          // his countdowns and the walk over the enemies (only what his talents need)
    {on:'wave',do:[{fn:'waveStart'}]},
    {on:'die',do:[{fn:'myDeath'}]},                                                                                      // what he wrote on enemies is put back
    {on:'at',skill:SB,do:[{fn:'fieldAt'}]},                                                                              // Shadeburst's field (its circle, for as long as its rot lasts)
    {on:'kit',skill:SB,do:[{fn:'sbKit'}]}, {on:'kit',skill:CR,do:[{fn:'crKit'}]}, {on:'kit',skill:UC,do:[{fn:'ucKit'}]},
    {on:'cast',skill:CR,do:[{fn:'crCast'}]},
    {on:'poisQ',do:[{fn:'pq'}]}, {on:'pois',do:[{fn:'pl'}]},                                                             // his rots queued and landed (Generations, the spread's extras, the mark's copies)
    {on:'spreadR',do:[{fn:'sprR'}]}, {on:'spread',do:[{fn:'sprDone'}]},                                                  // Lingering Dark: its reach, then what it reached
    {on:'death',do:[{fn:'death'}]},                                                                                      // an enemy died (rot, Thinning, Correction, the stars, the zone)
    {on:'landPre',skill:UC,do:[{fn:'ucLand'}]}, {on:'land',skill:UC,do:[{fn:'ucLanded'}]},                              // the ultimate's first hit (the armed collapse), then its zone
    {on:'part',skill:ZN,do:[{fn:'znHit'}]},                                                                              // each tick of his void zone on an enemy
    {on:'out',do:[{fn:'outK'}]}, {on:'dotOut',do:[{fn:'dotK'}]},                                                         // his hits and his DoT ticks
    {on:'hit',do:[{fn:'myHit'}]}, {on:'dotTick',do:[{fn:'myTick'}]},
    {on:'in',reqAny:MISS,if:{auto:true,fn:'srcDim'},chance:{flat:1,x:{fn:'missP'}},do:[{miss:true}]},                   // Dimmed: a basic attack on him misses
    {on:'teamIn',reqAny:MISS,if:{auto:true,fn:'allyDim'},chance:{flat:1,x:{fn:'missP'}},do:[{miss:true}]},              //   on an ally
    {on:'in',reqAny:DRME.concat(COR,['wl_3_4','wl_9_4']),do:[{fn:'inMe'}]},                                             // hits on him: ONE capped group, the tally, Lamps Out, Lightless
    {on:'dotIn',reqAny:DRME,do:[{fn:'dotMe'}]},
    {on:'teamIn',reqAny:DRAL.concat(COR,TEAMK,['wl_3_4','wl_9_4']),do:[{fn:'teamK'}]},                                 // hits on his allies (ONE capped group), and his allies' hits on enemies
    {on:'teamDotIn',reqAny:DRAL,do:[{fn:'teamDot'}]},
    {on:'teamHeal',reqAny:HEALC,do:[{fn:'healK'}]},                                                                      // healing on enemies
    {on:'teamCast',reqAny:['wl_9_4'],do:[{fn:'ltCast'}]},                                                                // Lightless: a Dimmed enemy casts
    {on:'shade',reqAny:['wl_7_2'],do:[{fn:'shade'}]},                                                                    // Shroud of Shade: an enemy picked an ally in the field
    {stat:{move:-1},to:{team:'enemy'},reqAny:SLOWS,per:{fn:'slowK'}},                                                   // his slows: ONE group, at most 40%
    {stat:{atk:-1,apow:-1},to:{team:'enemy'},reqAny:COR,per:{fn:'corK'}},                                               // Correction
    {stat:{aspd:-1},to:{team:'enemy'},reqAny:['wl_10_1'],per:{fn:'scrK'}},                                              // Scrutiny
    {stat:{armor:-1,mr:-1},to:{team:'enemy'},reqAny:['sd_4_1'],per:{fn:'hbK'}}                                          // Hollow Bones
  ],
  talents:{
    /* ============================== THE SPREADING DARK ============================== */
    sd_1_1:[ {param:'th.dmg',add:R(0.003)} ],                                                                 // Thinning (outK / dotK; the walk: tk)
    sd_1_3:[ {param:'bl',add:R(0.02)} ],                                                                      // Borrowed Light (outK)
    sd_1_4:[ {param:'gen',add:R(0.04)} ],                                                                     // Generations (pq)
    sd_2_1:[ {param:'th.keep',add:R(1)} ],                                                                    // Eaten Through
    sd_2_2:[ {on:'kit',skill:CR,opt:{dps:{more:R(0.03)}}} ],                                                  // Rot Worked In (was Deep Rot)
    sd_3_1:[ {param:'nl',add:1} ],                                                                            // Nothing Left to Mend (was Nothing Left; healK, tk)
    sd_n1:[ {on:'out',if:{auto:true,fn:'tgtRot'},more:R(0.04)} ],                                             // Tended Rot
    sd_3_4:[ {param:'fb',add:R(0.3)} ],                                                                       // Fast Breeding (pl)
    sd_4_1:[ {param:'hb',add:R(0.002)} ],                                                                     // Hollow Bones (the always aura)
    sd_4_2:[ {param:'foot',add:R(1)} ],                                                                       // Spreading Foot (pl)
    sd_4_3:[ {on:'kit',skill:SB,opt:{dps:{more:R(0.05)}}} ],                                                  // Thick Shade
    sd_5_1:[ {param:'ash',add:R(0.03)} ],                                                                     // Ash Grey (slowK)
    sd_5_2:[ {param:'twin',add:1} ],                                                                          // Twin Rot (PICK ONE; pl)
    sd_5_3:[ {on:'kit',skill:CR,opt:{dur:{add:3}}}, {param:'pr',add:2} ],                                     // Patient Rot (PICK ONE; crCast)
    sd_5_4:[ {param:'reach',add:R(0.4)} ],                                                                    // Hungry Dark (sprR)
    sd_6_1:[ {param:'gnaw',add:R(0.02)} ],                                                                    // Gnawing Dark (was Gnawing; myTick, znHit)
    sd_6_2:[ {on:'tick',each:{team:'enemy'},period:1,if:{fn:'tgtInField'},chance:R(0.33),do:[{fn:'th1'}]} ],  // Seeping Field
    sd_6_4:[ {param:'ob',add:R(0.02)} ],                                                                      // Old Bloodline (pq)
    sd_7_1:[ {param:'dr.fade',add:R(0.01)} ],                                                                 // Fading (drK, alK)
    sd_7_2:[ {param:'for',add:1} ],                                                                           // Field of Rot (death)
    sd_7_3:[ {on:'kit',skill:UC,opt:{mul:{more:R(0.03)},dps:{more:R(0.03)}}} ],                              // Vast Hole
    sd_8_1:[ {param:'th.rate',add:R(0.1)} ],                                                                  // Marrow Rot
    sd_8_3:[ {on:'kit',skill:UC,opt:{radius:{addM:R(0.2)}}} ],                                                // Wide Gap
    sd_8_4:[ {param:'sl',add:R(1)} ],                                                                         // Strong Line (pl)
    sd_9_2:[ {on:'kit',skill:CR,opt:{dur:{add:R(0.4)}}} ],                                                    // Mark Lingers
    sd_9_3:[ {on:'cd',less:R(0.01)} ],                                                                        // Patient Star
    sd_9_4:[ {param:'gmax',add:3} ],                                                                          // Endless Line
    sd_10_1:[ {param:'hburst',add:1} ],                                                                       // Hollow Burst (death)
    sd_n2:[ {param:'pm',add:R(0.06)} ],                                                                       // Past Mending (healK)
    sd_10_3:[ {param:'we',add:R(1)} ],                                                                        // Withering Energy (death)
    sd_11_1:[ {param:'dt',add:R(0.02)} ],                                                                     // Deep Thinning (outK, dotK, teamK)
    sd_11_2:[ {param:'seep',add:R(1)} ],                                                                      // Seeping Hole (was Seeping; znHit)
    sd_2_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                            // Short Candle
    sd_12_2:[ {param:'swal',add:R(0.5)} ],                                                                    // Swallowed by the Gap (was Swallowed; sprR)
    sd_12_4:[ {param:'qs',add:R(0.04)} ],                                                                     // Quiet Spread (pq)
    sd_13_2:[ {param:'nbs',add:1} ],                                                                          // Nothing Between the Stars (SIGNATURE: tk, death, sprDone)
    /* ============================== WITHHELD LIGHT ============================== */
    wl_1_1:[ {param:'cor',add:R(0.02)} ],                                                                     // Correction (tk, corK)
    wl_1_3:[ {param:'mr.gap',add:R(0.03)} ],                                                                  // Gap Reading (mrK)
    wl_1_4:[ {param:'miss',add:R(0.02)} ],                                                                    // Dimming (missP; the walk: tk)
    wl_2_2:[ {param:'ww',add:R(0.02)} ],                                                                      // Withheld Warmth (healK, tk)
    wl_2_4:[ {param:'ds',add:R(1)} ],                                                                         // Darker Still (tk)
    wl_3_1:[ {on:'cd',less:R(0.01)} ],                                                                        // Long Patience (was Cold Patience)
    wl_3_3:[ {param:'drag',add:R(0.03)} ],                                                                    // Rot Drag (slowK)
    wl_3_4:[ {param:'lamps',add:1} ],                                                                         // Lamps Out (inMe, teamK)
    wl_4_1:[ {param:'bt',add:R(0.02)} ],                                                                      // Brightness Taxed (outK, dotK, teamK)
    wl_4_2:[ {param:'td',add:R(0.1)} ],                                                                       // Turned Down (tk)
    wl_4_3:[ {param:'hush',add:R(0.3)} ],                                                                     // Hushed (crCast)
    wl_n1:[ {param:'md',add:4}, {param:'md.th',add:1,req:'sd_1_1'} ],                                         // Marked Down (LINK; tk)
    wl_n2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                            // Quick Dusk
    wl_5_2:[ {on:'kit',skill:SB,opt:{radius:{addM:R(0.2)}}} ],                                                // Grey Air
    wl_2_1:[ {param:'cor.dur',add:R(1)} ],                                                                    // Strict Reader
    wl_6_1:[ {param:'cor2',add:R(0.25)} ],                                                                    // Second Correction
    wl_6_2:[ {on:'kit',skill:SB,opt:{dur:{add:R(0.3)}}} ],                                                    // Long Field
    wl_6_4:[ {param:'dr.ne',add:R(0.01)} ],                                                                   // Night Eyes (drK, alK)
    wl_7_1:[ {param:'ch',add:R(0.02)} ],                                                                      // Correcting Hand (outK, dotK)
    wl_7_2:[ {param:'shroud',add:1} ],                                                                        // Shroud of Shade (tk, shade)
    wl_5_3:[ {param:'wh',add:1} ],                                                                            // Withholding (PICK ONE; tk)
    wl_5_4:[ {param:'unlit',add:1} ],                                                                         // Unlit (PICK ONE; tk)
    wl_8_3:[ {param:'sless',add:R(0.02)} ],                                                                   // No Stars Overhead (was Starless; tk, outK, dotK, teamK)
    wl_8_4:[ {param:'bs',add:R(0.04)} ],                                                                      // Shortened Sight (was Blind Spot; tk)
    wl_9_2:[ {param:'nw',add:R(0.02)} ],                                                                      // No Warmth (slowK)
    wl_9_3:[ {on:'kit',skill:UC,opt:{mul:{more:R(0.03)},dps:{more:R(0.03)}}} ],                              // Weighed Light
    wl_9_4:[ {param:'lt',add:1} ],                                                                            // Dimmed Hand (was Lightless; ltCast, inMe, teamK)
    wl_10_1:[ {param:'scr',add:R(0.03)} ],                                                                    // Scrutiny (scrK)
    wl_10_3:[ {param:'tid',add:R(0.08)} ],                                                                    // Turning It Down (healK, tk)
    wl_11_1:[ {param:'elc',add:1} ],                                                                          // Every Light Checked (tk, death)
    wl_n3:[ {param:'ncl',add:R(0.04)} ],                                                                      // No Cover Left (tk)
    wl_11_4:[ {param:'dr.wd',add:R(0.015)} ],                                                                 // Withdrawn (drK)
    wl_8_1:[ {param:'bof',add:R(5)} ],                                                                        // Bright Ones Fall (death)
    wl_12_2:[ {param:'miss',add:R(0.01)} ],                                                                   // Faint Glow (missP: points)
    wl_12_3:[ {param:'dr.dh',add:R(0.02)} ],                                                                  // The Dim Hour (drK, alK)
    wl_12_4:[ {param:'dr.ur',add:R(0.03)} ],                                                                  // Unseen Reader (drK)
    wl_13_3:[ {param:'lamp',add:1} ],                                                                         // The Lamp Turned Down (SIGNATURE: ucLanded, tk, corK)
    /* ============================== ONE CANDLE ============================== */
    oc_1_2:[ {stat:{apow:R(0.003)},per:'umStare'} ],                                                          // Candle (the Stare: tk)
    oc_1_4:[ {param:'echo',add:R(0.06)} ],                                                                    // Two Stars (crCast, myHit, myTick)
    oc_2_2:[ {param:'wick',add:R(-2)} ],                                                                      // Short Wick
    oc_3_3:[ {on:'out',if:{casting:CR},more:R(0.06)} ],                                                       // Eyepiece (its hit: the rot lands later)
    oc_1_1:[ {param:'ink',add:R(0.02)} ],                                                                     // Night Ink (outK, dotK)
    oc_3_2:[ {param:'unbl',add:1} ],                                                                          // Lidless (was Unblinking; tk)
    oc_4_3:[ {param:'lw',add:R(0.01)} ],                                                                      // Patient Eyepiece (was Long Watch; dotK)
    oc_3_4:[ {param:'stars.dur',add:R(0.4)} ],                                                                // Distant Light
    oc_4_1:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                            // Cold Lens
    oc_5_4:[ {param:'wand',add:1} ],                                                                          // Wandering Eye (PICK ONE; death)
    oc_5_3:[ {param:'fixed',add:1}, {on:'kit',skill:CR,opt:{dur:{add:2}}} ],                                  // Fixed Gaze (PICK ONE; crKit)
    oc_4_4:[ {param:'orb',add:R(0.02)} ],                                                                     // Bound Orbits (slowK)
    oc_5_1:[ {on:'ccIn',less:R(0.04),upTo:0.2} ],                                                             // Unwavering (at most 20%)
    oc_5_2:[ {param:'mr.st',add:R(0.001)} ],                                                                  // Deep Stare (mrK)
    oc_2_4:[ {param:'drift',add:R(0.03)} ],                                                                   // Drifting Apart (echo)
    oc_6_1:[ {on:'kit',skill:SB,opt:{dps:{more:R(0.05)}}} ],                                                  // Heavy Burst
    oc_6_2:[ {param:'burn',add:R(3)} ],                                                                       // Burned Down (tk)
    oc_6_4:[ {param:'smap',add:R(0.03)} ],                                                                    // Star Map (dotK)
    oc_7_1:[ {param:'focus',add:1} ],                                                                         // Focused Burst (sbKit)
    oc_7_2:[ {on:'kit',skill:UC,opt:{mul:{more:R(0.03)},dps:{more:R(0.03)}}} ],                              // The Gap Opens
    oc_7_3:[ {on:'kit',skill:CR,opt:{dps:{more:R(0.03)}}} ],                                                  // Rot Scholar
    oc_8_2:[ {on:'out',if:{auto:true,fn:'st15'},more:R(0.10)} ],                                              // Small Hours (was Late Hour)
    oc_8_3:[ {param:'meas',add:R(0.04)} ],                                                                    // Measured Rot (was Measured; outK, dotK)
    oc_9_3:[ {param:'lr',add:1} ],                                                                            // Last Reading (myHit, myTick)
    oc_9_4:[ {param:'pa',add:R(0.15)} ],                                                                      // Pulled Apart (death)
    oc_10_1:[ {on:'cd',less:R(0.01)} ],                                                                       // Steady Wax
    oc_10_2:[ {param:'stare.max',add:R(1)} ],                                                                 // Night Vigil
    oc_10_4:[ {param:'dr.ph',add:R(0.03)} ],                                                                  // Pale Hood (drK)
    oc_11_2:[ {param:'mr.be',add:R(0.04)} ],                                                                  // Burned Eyes (mrK)
    oc_11_3:[ {on:'out',if:{casting:UC},more:R(0.01),per:{fn:'st3'}} ],                                       // Hole in the Sky (the first hit only: the zone's ticks are 'umZone')
    oc_11_4:[ {param:'dr.con',add:R(0.10)} ],                                                                 // Cloth Over Nothing (myDr: once every 12 s)
    oc_12_1:[ {param:'dr.rc',add:R(0.01)} ],                                                                  // Reader's Calm (drK)
    oc_12_3:[ {on:'hit',if:{casting:UC,targetTeam:'enemy'},chance:R(0.33),do:[{fn:'pairAgain'}]} ],           // Paired Again
    oc_12_4:[ {param:'smoke',add:R(0.10)} ],                                                                  // Wick Smoke (was Candle Smoke; tk, slowK)
    oc_13_3:[ {param:'sc2',add:1}, {on:'out',if:{casting:UC,fn:'armedHit'},mul:4} ]                           // The Second Candle (SIGNATURE: tk, ucKit, ucLand)
  },
  fn:{
    /* ---- THE WALK, once a tick: countdowns; each enemy's rot, Thinning, field, zone, Dimmed, shields, energy, range; Correction; the Candle and Stare ---- */
    tk(A,T,u,c){ const s=T.s, P=T.P, E=A.eng(), dt=c.dt||0; s.api=A; const um=s.um||T.fn.init(A,T,u);
      for(let i=um.f.length-1;i>=0;i--){ um.f[i].t-=dt; if(um.f[i].t<=0) um.f.splice(i,1); }
      for(let i=um.pr.length-1;i>=0;i--){ const p=um.pr[i]; p.t-=dt; if(p.t<=0||!p.a.alive||!p.b.alive) um.pr.splice(i,1); }
      if(um.con>0) um.con=Math.max(0,um.con-dt);
      if(um.rb<REGEN*u.maxHp) um.rb=Math.min(REGEN*u.maxHp,um.rb+REGEN*u.maxHp*dt);   // Gnawing Dark's budget: 1.2% of max HP a second, one second banked
      if(um.lamp>0) um.lamp=Math.max(0,um.lamp-dt);
      if(um.full>0) um.full=Math.max(0,um.full-dt);
      const zs=um.needZ?zonesOf(E,u):null;
      if(zs&&P.nbs) for(const z of zs){ if(z._umN==null){ z._umN=0; z._umR0=z.r; } }
      const thOn=um.thOn, rate=1+(P['th.rate']||0), keep=P['th.keep']||0;
      for(const x of E.units()){ if(x.team===u.team) continue; if(!x.alive){ T.fn.drop(A,T,u,x); continue; }
        const r=recMk(T,x);
        if(r.zT>0) r.zT=Math.max(0,r.zT-dt); if(r.dimL>0) r.dimL=Math.max(0,r.dimL-dt); if(r.lt>0) r.lt=Math.max(0,r.lt-dt); if(r.lw>0) r.lw=Math.max(0,r.lw-dt); if(r.cs>0) r.cs=Math.max(0,r.cs-dt);
        const mine=myDots(u,x), cr=crOn(u,x); r.rot=mine||r.zT>0;
        const f=um.f.length?fieldAt(T,x):null, inF=!!f; const z=zs&&zs.length?zoneAt(E,u,x):null; r.inZ=!!z;
        if(thOn){ if(r.rot){ r.th=Math.min(TH_MAX,r.th+dt*rate); r.keep=keep; } else if(r.th>0){ if(r.keep>0) r.keep-=dt; else r.th=0; }
          if(z&&P.nbs) r.th=TH_MAX; }
        if(r.inF&&!inF&&P.ds) r.dimL=Math.max(r.dimL,P.ds);                                  // Darker Still: Dimmed a while after it walks out
        r.inF=inF;
        if(r.cr&&!cr&&P.unlit){ r.dimL=Math.max(r.dimL,3); if(x.greenAb) x.greenCd=(x.greenCd||0)+1.5; if(x.blueAb) x.blueCd=(x.blueCd||0)+1.5; um.unlitN++; }   // Unlit: its mark has ended
        r.cr=cr;
        if(um.dimOn) r.dim=inF||cr||r.dimL>0||(!!z&&!!P.sless)||um.lamp>0; else r.dim=false;
        if(P.wh&&cr&&(x.energy||0)>r.en) x.energy=r.en;                                        // Withholding: no energy while it carries the mark
        r.en=x.energy||0;
        if(r.dim&&P.td){ for(const k of BUFFT) if((x[k]||0)>0) x[k]=Math.max(0,x[k]-dt*P.td); } // Turned Down
        if(um.shOn){ let sh=x.shield||0;
          if(r.dim&&P.ncl&&sh>0) sh=Math.max(0,sh-sh*P.ncl*dt);                                  // No Cover Left
          if(sh>r.sh+1e-9){ let k=1; if(P.nl&&Math.floor(r.th+1e-9)>=TH_MAX) k=0; else { if(P.ww&&inF) k*=1-P.ww; if(P.tid&&z) k*=1-P.tid; } if(k<1){ sh=r.sh+(sh-r.sh)*k; um.shCut++; } }
          if(sh!==(x.shield||0)) x.shield=sh; r.sh=sh; }
        if(P.bs){ if(r.dim){ if(r.rg==null){ r.rg=x.range; x.range=x.range*(1-P.bs); r.rs=x.range; } } else if(r.rg!=null){ if(x.range===r.rs) x.range=r.rg; r.rg=null; } } }
      if(P.shroud){ const al=E.units(); for(const a of al){ if(a.team!==u.team||a===u) continue; const inF=a.alive&&um.f.length&&!!fieldAt(T,a); if(inF) a._talShd=u; else if(a._talShd===u) delete a._talShd; } }
      if(um.corOn) T.fn.corTick(A,T,u,dt);
      if(um.stOn) T.fn.stTick(A,T,u,dt); },
    init(A,T,u){ const P=T.P, r=T.r; T.s.um={e:{},f:[],pr:[],gq:{},tally:{},con:0,rb:REGEN*u.maxHp,lamp:0,full:0,armed:false,armedCast:false,ac:null,
        thOn:any(T,TH), dimOn:any(T,DIM), corOn:any(T,COR), stOn:any(T,STARE), shOn:any(T,SHC), needZ:any(T,['sd_11_2','sd_12_2','sd_13_2','wl_8_3','wl_10_3','wl_12_3','sd_6_1']),
        cor:{m:null,t:0,s:null,t2:0,cd:0,tri:false}, cdl:null, sa:0, st0:u.stunned||0, si0:u.silencedT||0, wave:0, unlitN:0, shCut:0, sprN:0, mspN:0, corN:0, ltN:0, echoN:0, lrN:0, healCut:0, shadeN:0, gnaw:0 };
      return T.s.um; },
    /* a dead enemy's record: what he wrote on it is not put back (it is gone); the record is dropped */
    drop(A,T,u,x){ const M=T.s.um.e; if(M[x.uid]) delete M[x.uid]; },
    waveStart(A,T,u){ const s=T.s, P=T.P; s.api=A; const um=s.um||T.fn.init(A,T,u); const E=A.eng();
      for(const k in um.e){ const r=um.e[k]; void r; } um.e={}; um.f.length=0; um.pr.length=0; um.gq={}; um.tally={}; um.lamp=0; um.ac=null;
      um.cor.m=null; um.cor.s=null; um.cor.t=0; um.cor.t2=0; um.cor.cd=(P.elc?5:8);
      for(const a of E.units()) if(a._talShd===u) delete a._talShd;
      um.wave++; um.st0=u.stunned||0; um.si0=u.silencedT||0;
      if(um.stOn){ if(!(P.sc2&&um.wave>1)){ um.cdl=Math.max(0,20+(P.wick||0)); um.sa=0; A.stSet(T,u,'umStare',0); } } },   // the Candle is lit each wave (The Second Candle: never again after the first)
    myDeath(A,T,u){ const E=A.eng(); const um=T.s.um; if(!um) return; for(const x of E.units()){ if(x._talShd===u) delete x._talShd; const r=um.e[x.uid]; if(r&&r.rg!=null&&x.alive){ if(x.range===r.rs) x.range=r.rg; r.rg=null; } } },
    /* ---- SHADEBURST: its field, its options ---- */
    fieldAt(A,T,u,c){ const um=T.s.um||T.fn.init(A,T,u), o=c.o||{}, E=A.eng(); um.f.push({x:c.pt.x,y:c.pt.y,R:o.radius||7*E.METER(),t:o.dur||6,dps:0}); if(um.f.length>4) um.f.shift(); },
    sbKit(A,T,u,c){ const P=T.P; if(!P.focus) return; const um=T.s.um||T.fn.init(A,T,u), t=um.crT;
      if(t&&t.alive&&crOn(u,t)){ c.o.radius=(c.o.radius||7*A.eng().METER())*0.5; c.o.dps=(c.o.dps||0.3)*2; c.o._aim={x:t.x,y:t.y}; um.focusN=(um.focusN||0)+1; } },
    /* ---- CREEPING ROT: Fixed Gaze picks its target; its landing (Two Stars, Hushed, Patient Rot) ---- */
    crKit(A,T,u,c){ if(!T.P.fixed) return; const E=A.eng(); let b=null; for(const x of foes(E,u)) if(!b||x.hp>b.hp) b=x; if(b){ c.o._arrived=true; c.o._tgtU=b; } },
    crCast(A,T,u,c){ const P=T.P, t=c.tgt, um=T.s.um||T.fn.init(A,T,u); if(!t||t.team===u.team) return; um.crT=t;
      if(any(T,STARS)){ const E=A.eng(); let b=null, bd=Infinity; for(const x of foes(E,u)){ if(x===t) continue; const g=E.dist(t,x); if(g<bd){ bd=g; b=x; } }
        for(let i=um.pr.length-1;i>=0;i--) if(um.pr[i].cr) um.pr.splice(i,1); if(b&&t.alive) um.pr.push({a:t,b,t:6+(P['stars.dur']||0),cr:true}); }
      if(!t.alive) return;
      if(P.hush) A.control(T,u,t,'silencedT',P.hush);
      if(P.pr&&um.thOn){ const r=recMk(T,t); r.th=Math.min(TH_MAX,r.th+P.pr); } },
    /* ---- HIS ROTS: queued (poisQ) and landed (pois). Every plagueDot of his comes here; a spread (Lingering Dark's own, or one of his talents') is a
       Generation older than the rot it came from ---- */
    genOf(A,T,u,x){ let g=0; const D=x&&x.dots; if(D) for(let i=0;i<D.length;i++){ const d=D[i]; if(d._talO===u.uid&&d._umG>g) g=d._umG; } return g; },
    gmax(A,T){ return 5+(T.P.gmax||0); },
    genMul(A,T,g){ const P=T.P; let m=1; if(P.gen) m*=Math.pow(1+P.gen,g); if(P.ob&&g>3) m*=1+P.ob; return m; },
    pq(A,T,u,c){ const um=T.s.um||T.fn.init(A,T,u), P=T.P, t=c.tgt; const sp=c.skill==='spread'||!!um.msp; if(!sp||!t) return;
      const dead=um.msp?um.msp.dead:c.unit, g=Math.min(T.fn.gmax(A,T),T.fn.genOf(A,T,u,dead)+1); c.amt*=T.fn.genMul(A,T,g)*(1+(P.qs||0));
      const q=um.gq[t.uid]; um.gq[t.uid]=Math.max(q||0,g); },
    pl(A,T,u,c){ const um=T.s.um||T.fn.init(A,T,u), P=T.P, d=c.dot, t=c.tgt; if(!d||!t) return;
      if(um.gq[t.uid]!=null){ const g=um.gq[t.uid]; delete um.gq[t.uid]; d._talK='spread'; d._umG=g; um.sprN++;
        if(P.fb) extDot(d,P.fb);                                                                                     // Fast Breeding
        if(P.sl&&um.thOn){ const r=recMk(T,t); r.th=Math.min(TH_MAX,r.th+P.sl); }                                    // Strong Line
        return; }
      if(c.skill===SB){ for(const f of um.f) if(!f.dps) f.dps=d.dps; return; }
      if(c.skill!==CR) return; d._umN0=d.remaining;
      const E=A.eng(), cp=(x,share,tag)=>{ E.pushDot(x,d.dps*share,dotLeft(d),d.interval||1,d.color||'#8a5cff',u,d.kind||'magic'); const nd=x.dots[x.dots.length-1]; nd._talO=u.uid; nd._talK=tag; nd._umN0=nd.remaining;
        x._contagion=true; x._plagueDps=d.dps*share; x._plagueColor=d.color||'#8a5cff'; x._plagueHex=0x7a3fb0; x._darkAuraT=Math.max(x._darkAuraT||0,dotLeft(d)); };
      let twin=null; if(P.twin){ let bd=Infinity; for(const x of foes(E,u)){ if(x===t) continue; const g=E.dist(t,x); if(g<bd){ bd=g; twin=x; } } if(twin){ cp(twin,1,'umTwin'); um.twinN=(um.twinN||0)+1; } }   // Twin Rot
      if(P.foot) for(const x of foes(E,u)){ if(x===t||x===twin) continue; if(gapM(E,t,x)<P.foot){ cp(x,0.5,'umFoot'); um.footN=(um.footN||0)+1; } } },            // Spreading Foot
    /* Lingering Dark's reach (centre to centre, the game's own measure): Hungry Dark, Swallowed by the Gap */
    sprR(A,T,u,c){ const P=T.P, E=A.eng(); let add=P.reach||0; if(P.swal&&zoneAt(E,u,c.unit)) add+=P.swal; if(add>0) c.amt+=add*E.METER(); },
    /* a spread from many places at once (his talents'): the dead enemy's rot, as Lingering Dark spreads it (its strength, the passive's length), a Generation older */
    mspread(A,T,u,dead,list,dps){ const um=T.s.um, E=A.eng(); if(!list.length||!E.umPlague||!(dps>0)) return; const dur=E.umCgDur?E.umCgDur(dead.team):4; um.msp={dead};
      try{ for(const e of list){ if(!e.alive) continue; E.umPlague(e,dps,dur,u); e._contagion=true; e._plagueDps=dps; e._plagueColor='#8a5cff'; e._plagueHex=0x7a3fb0; e._darkAuraT=4; um.mspN++; } } finally{ um.msp=null; } },
    sprDone(A,T,u,c){ const P=T.P, E=A.eng(), dead=c.unit; if(!P.nbs||!dead) return; const z=T.s.um.dz; if(!z) return; T.s.um.dz=null;
      const got=c.vic||[], L=foes(E,u).filter(x=>x!==dead&&got.indexOf(x)<0&&Math.hypot(x.x-z.x,x.y-z.y)<=z.r); T.fn.mspread(A,T,u,dead,L,dead._plagueDps||0); },
    /* ---- AN ENEMY DIED (every death of an enemy, whatever killed it) ---- */
    death(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team) return; const P=T.P, E=A.eng(), um=T.s.um||T.fn.init(A,T,u), r=recOf(T,x);
      const rot=myDots(u,x)||!!(r&&r.zT>0), th=r?Math.floor(r.th+1e-9):0;
      if(P.we&&rot) u.energy=Math.min(100,(u.energy||0)+P.we);                                                         // Withering Energy
      if(P.hburst&&th>=TH_MAX&&um.thOn) for(const y of foes(E,u)){ if(y===x||gapM(E,x,y)>=3) continue; const q=recMk(T,y); q.th=Math.min(TH_MAX,q.th+5); }   // Hollow Burst
      if(um.corOn){ const C=um.cor; if(C.m===x&&C.t>0){ if(P.bof) u.energy=Math.min(100,(u.energy||0)+P.bof);       // Bright Ones Fall
          if(P.elc){ const b=T.fn.bright(A,T,u,[x]); if(b){ C.m=b; um.corN++; T.fn.corOn(A,T,u,b); } else C.m=null; } } }   // Every Light Checked: it moves at once, with its time left
      for(const p of um.pr){ if(p.a!==x&&p.b!==x) continue; const o=p.a===x?p.b:p.a; if(P.pa&&o.alive){ T.fn.mag(A,T,u,o,P.pa*(u.apow||0),'umPa'); um.paN=(um.paN||0)+1; } p.t=0; }   // Pulled Apart
      if(P.wand){ const D=x.dots||[]; for(const d of D){ if(d._talO!==u.uid||!CRT[d._talK]||!(d.remaining>0)) continue; let b=null, bd=Infinity; for(const y of foes(E,u)){ if(y===x) continue; const g=E.dist(x,y); if(g<bd){ bd=g; b=y; } }
          if(b){ E.pushDot(b,d.dps,dotLeft(d),d.interval||1,d.color||'#8a5cff',u,d.kind||'magic'); const nd=b.dots[b.dots.length-1]; nd._talO=u.uid; nd._talK=d._talK; nd._umN0=d._umN0; b._contagion=true; b._plagueDps=d.dps; b._plagueColor=d.color||'#8a5cff'; b._plagueHex=0x7a3fb0; um.crT=b; um.wandN=(um.wandN||0)+1; } break; } }   // Wandering Eye
      /* the zone: the signature widens it; Lingering Dark from it (Swallowed by the Gap: sprR). Field of Rot and the signature spread when the page would not */
      const z=zoneAt(E,u,x); if(z&&P.nbs){ if(z._umN==null){ z._umN=0; z._umR0=z.r; } if(z._umN<6){ z._umN++; z.r+=E.METER(); z.life+=1; um.nbsN=(um.nbsN||0)+1; } }
      let page=false; if(x._contagion&&x.dots){ for(const d of x.dots){ if(d.color===x._plagueColor){ page=d.src===u; break; } } }
      um.dz=null;
      if(page){ if(z&&P.nbs) um.dz={x:z.x,y:z.y,r:z.r}; return; }
      if(z&&P.nbs){ const L=foes(E,u).filter(y=>y!==x&&Math.hypot(y.x-z.x,y.y-z.y)<=z.r); T.fn.mspread(A,T,u,x,L,x._plagueDps||z.pd||0); return; }
      if(P.for){ const f=fieldAt(T,x); if(f){ const reach=2.6+(P.reach||0)+((P.swal&&z)?P.swal:0), L=foes(E,u).filter(y=>y!==x&&Math.hypot(y.x-x.x,y.y-x.y)<reach*E.METER()); um.forN=(um.forN||0)+1; T.fn.mspread(A,T,u,x,L,x._plagueDps||f.dps||0); } } },
    mag(A,T,u,t,amt,tag){ const E=A.eng(); if(!t||!t.alive||!(amt>0)) return 0; return A.hurt(T,u,t,amt*E.defMul(u,t,'magic')*(E.elemMul?E.elemMul(u,t):1),'#c9a6ff',tag); },
    /* ---- UMBRAL CATACLYSM: at the cast (The Second Candle armed?), its landing (the armed collapse; the Lamp), its zone's ticks ---- */
    ucKit(A,T,u,c){ const um=T.s.um||T.fn.init(A,T,u); um.armedCast=!!(T.P.sc2&&um.armed); if(um.armedCast) um.armed=false; um.ac={armed:um.armedCast}; },
    ucLand(A,T,u,c){ const um=T.s.um||T.fn.init(A,T,u), vc=c.tgt, E=A.eng(); um.hitTgt=null; if(!vc) return; const ac=um.ac; um.ac=null; um.landArmed=!!(ac&&ac.armed);
      if(um.landArmed){ let b=null; for(const x of foes(E,u)) if(Math.hypot(x.x-vc.cx,x.y-vc.cy)<vc.R&&(!b||x.hp>b.hp)) b=x;
        if(b){ um.hitTgt=b; um.keepR=vc.R; vc.cx=b.x; vc.cy=b.y; vc.R=0.5; um.sc2N=(um.sc2N||0)+1; } else um.landArmed=false; } },   // only the enemy with the most HP in its circle is struck, then the zone opens there
    armedHit(A,T,u,c){ const um=T.s.um; return !!(um&&um.landArmed&&c.tgt===um.hitTgt); },
    ucLanded(A,T,u,c){ const um=T.s.um, P=T.P, vc=c.tgt, E=A.eng(); if(!um) return;
      if(um.landArmed){ if(vc&&um.keepR) vc.R=um.keepR; um.keepR=null; um.landArmed=false; um.hitTgt=null; um.full=6; A.stSet(T,u,'umStare',A.stMax(T,u,'umStare')); }   // his Stare stays full for 6 s
      if(P.lamp){ um.lamp=6; um.lampN=(um.lampN||0)+1; const b=T.fn.bright(A,T,u,[]); if(b&&um.corOn){ const C=um.cor; C.m=b; C.t=8+(P['cor.dur']||0); C.tri=true; T.fn.corOn(A,T,u,b);
          for(const k of BUFFT) if((b[k]||0)>0) b[k]=0; um.stripN=(um.stripN||0)+1; } } },
    znHit(A,T,u,c){ const t=c.tgt, P=T.P, um=T.s.um||T.fn.init(A,T,u); if(!t||t.team===u.team) return; const r=recMk(T,t); r.zT=1.5; r.rot=true;
      if(P.seep&&um.thOn) r.th=Math.min(TH_MAX,r.th+P.seep); },
    /* ---- HIS HITS AND DoT TICKS: one multiplier each ---- */
    tgtRot(A,T,u,c){ return !!c.tgt&&rotting(T,u,c.tgt); },
    tgtInField(A,T,u,c){ return !!c.tgt&&!!fieldAt(T,c.tgt); },
    th1(A,T,u,c){ const um=T.s.um; if(!um||!um.thOn||!c.tgt) return; const r=recMk(T,c.tgt); r.th=Math.min(TH_MAX,r.th+1); um.seepN=(um.seepN||0)+1; },
    st15(A,T){ return stN(T)>=15-1e-9; },
    st3(A,T){ return Math.floor(stN(T)/3+1e-9); },
    mostHp(A,T,u,t){ const E=A.eng(); let b=null; for(const x of foes(E,u)) if(!b||x.hp>b.hp) b=x; return b===t; },
    isCor(A,T,t){ const um=T.s.um, C=um&&um.cor; return !!C&&C.m===t&&C.t>0&&!!t; },
    /* the share of the target's magic resist his abilities ignore: Gap Reading, Deep Stare (per Stare), Burned Eyes (at full Stare) */
    mrK(A,T,u,c,dot){ const P=T.P, t=c.tgt, E=A.eng(); let x=P['mr.gap']||0; const st=stN(T); if(P['mr.st']) x+=P['mr.st']*st; if(P['mr.be']&&st>=A.stMax(T,u,'umStare')-1e-9) x+=P['mr.be'];
      if(!(x>0)||!t||!t.mrRating) return 1; const a=E.defMul(u,t,'magic'); if(!(a>0)) return 1; const sv=t.mrRating; t.mrRating=sv*Math.max(0,1-x); const b=E.defMul(u,t,'magic'); t.mrRating=sv; return b/a; },
    teamMore(A,T,u,t){ const P=T.P, r=recOf(T,t); let k=1; if(P.bt&&T.fn.isCor(A,T,t)) k*=1+P.bt; if(P.dt&&r&&Math.floor(r.th+1e-9)>=TH_MAX) k*=1+P.dt; if(P.sless&&r&&r.inZ) k*=1+P.sless; return k; },
    outK(A,T,u,c){ const t=c.tgt; if(!t||t.team===u.team) return; const P=T.P, s=T.s, ab=SK.indexOf(s.cur)>=0; let k=T.fn.teamMore(A,T,u,t);
      if(P['th.dmg']){ const n=thOf(T,t); if(n) k*=1+P['th.dmg']*n; }
      if(ab){ if(P.bl&&!rotting(T,u,t)) k*=1+P.bl; if(P.ink&&T.fn.mostHp(A,T,u,t)) k*=1+P.ink; if(P.ch&&T.fn.isCor(A,T,t)) k*=1+P.ch;
        if(P.meas&&s.cur===CR&&t.hp<0.5*t.maxHp) k*=1+P.meas; if(c.kind==='magic') k*=T.fn.mrK(A,T,u,c); }
      c.amt*=k; },
    dotK(A,T,u,c){ const t=c.tgt, d=c.dot; if(!t||!d) return; const P=T.P; let k=T.fn.teamMore(A,T,u,t);
      if(P['th.dmg']){ const n=thOf(T,t); if(n) k*=1+P['th.dmg']*n; }
      if(P.ink&&T.fn.mostHp(A,T,u,t)) k*=1+P.ink; if(P.ch&&T.fn.isCor(A,T,t)) k*=1+P.ch;
      if(CRT[d._talK]){ if(P.meas&&t.hp<0.5*t.maxHp) k*=1+P.meas; if(P.lw&&d._umN0!=null) k*=1+P.lw*Math.max(0,(d._umN0-d.remaining))*(d.interval||1); }   // Patient Eyepiece: 1% a rank for every second it has run
      if(P.smap&&d._talK===SB&&T.fn.star(A,T,t)) k*=1+P.smap;
      if(d.kind==='magic') k*=T.fn.mrK(A,T,u,c,true);
      c.amt*=k; },
    /* ---- after his hits and ticks: Two Stars' echo, Last Reading, Gnawing Dark ---- */
    star(A,T,t){ const um=T.s.um; if(!um) return false; for(const p of um.pr) if(p.t>0&&(p.a===t||p.b===t)) return true; return false; },
    echo(A,T,u,t,amt){ const P=T.P, um=T.s.um; if(!um||!P.echo||!(amt>0)||!um.pr.length) return; const E=A.eng();
      for(const p of um.pr){ if(!(p.t>0)) continue; const o=p.a===t?p.b:(p.b===t?p.a:null); if(!o||!o.alive) continue; let sh=P.echo;
        if(P.drift){ const st=Math.min(4,Math.floor(Math.max(0,gapM(E,p.a,p.b))/2+1e-9)); sh*=1+P.drift*st; }
        A.hurt(T,u,o,amt*sh,'#c9a6ff','umEcho'); um.echoN++; } },
    lastR(A,T,u,t){ if(!T.P.lr||!t||!t.alive||!crOn(u,t)||t.hp>=0.2*t.maxHp) return; if(A.markOf(u,t,'umLR')) return; A.setMark(T,u,t,'umLR',{}); u.blueCd=0; T.s.um.lrN++; },
    gnaw(A,T,u,t,amt){ const P=T.P, um=T.s.um; if(!P.gnaw||!um||!(amt>0)||thOf(T,t)<TH_MAX||!u.alive) return; const h=Math.min(um.rb,amt*P.gnaw); if(!(h>0)) return; um.rb-=h; A.eng().healUnit(u,h); um.gnaw+=h; },
    myHit(A,T,u,c){ const t=c.tgt; if(!t||t.team===u.team) return; const a=c.amt||0; T.fn.echo(A,T,u,t,a); T.fn.lastR(A,T,u,t); if(T.s.cur===ZN) T.fn.gnaw(A,T,u,t,c.hpLost||0); },
    myTick(A,T,u,c){ const t=c.tgt; if(!t||t.team===u.team) return; T.fn.echo(A,T,u,t,c.amt||0); T.fn.lastR(A,T,u,t); T.fn.gnaw(A,T,u,t,c.amt||0); },
    pairAgain(A,T,u,c){ const t=c.tgt, um=T.s.um, E=A.eng(); if(!t||!t.alive||!um) return; let b=null, bd=Infinity; for(const x of foes(E,u)){ if(x===t) continue; const g=E.dist(t,x); if(g<bd){ bd=g; b=x; } }
      if(b) um.pr.push({a:t,b,t:6+(T.P['stars.dur']||0),cr:false}); um.paiN=(um.paiN||0)+1; },
    /* ---- DIMMED ---- */
    srcDim(A,T,u,c){ const r=recOf(T,c.src); return !!r&&r.dim; },
    allyDim(A,T,u,c){ const t=c.tgt, s=c.src; if(!t||!s||t.team!==u.team||t===u||s.team===u.team) return false; const r=recOf(T,s); return !!r&&r.dim; },
    missP(A,T){ return Math.min(1,T.P.miss||0); },
    ltCast(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team||!x.alive) return; const r=recOf(T,x); if(!r||!r.dim||r.lt>0) return; r.lt=LT_CD; r.lw=LT_WIN; T.s.um.ltN++; },
    /* what an enemy's hit on his side loses before his reductions: Lamps Out (a critical hit is a plain one), Dimmed Hand (half strength) */
    srcWeak(A,T,u,c){ const s=c.src, t=c.tgt, P=T.P, r=recOf(T,s); if(!r) return;
      if(P.lamps&&r.dim&&c.crit){ const b=s.critDmg||0.6; const m=1+(t.critRes?Math.max(0,b-t.critRes):b); if(m>1) c.amt/=m; T.s.um.lampsN=(T.s.um.lampsN||0)+1; }
      if(P.lt&&!c.auto&&r.lw>0) c.amt*=0.5; },
    tallyAdd(A,T,u,c){ if(!T.s.um||!T.s.um.corOn||!c.src||!(c.amt>0)) return; const m=T.s.um.tally; m[c.src.uid]=(m[c.src.uid]||0)+c.amt; },
    /* ---- HIS DAMAGE REDUCTION, ONE GROUP. Every talent of his that makes a hit on him smaller multiplies here (each takes its share of what is left), and together
       they never take more than 35% off a hit (DR_ME). His base kit has no reduction of its own (armour / magic resist leave a reference hit 5.6% / 13.5% smaller
       at level 100). Cloth Over Nothing counts only on a live hit (live), once every 12 s. ---- */
    drK(A,T,u,src,kind,amt,live){ const P=T.P, E=A&&A.eng&&A.eng(); let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };
      if(src){ const r=recOf(T,src);
        if(P['dr.fade']&&(r?r.rot:false)) cut(P['dr.fade']);
        if(r&&r.dim){ cut(P['dr.ne']); cut(P['dr.wd']); }
        if(P['dr.dh']&&r&&r.inZ) cut(P['dr.dh']);
        if(E&&P['dr.ur']&&gapM(E,u,src)>8) cut(P['dr.ur']);
        if(E&&P['dr.ph']&&E.depth&&src.key&&E.depth(src.key)>=3) cut(P['dr.ph']); }
      if(P['dr.rc']) cut(P['dr.rc']*Math.floor(stN(T)/5+1e-9));
      if(P['dr.con']&&amt>0.15*u.maxHp&&!(T.s.um&&T.s.um.con>0)){ cut(P['dr.con']); if(live&&T.s.um) T.s.um.con=12; }
      return Math.max(1-DR_ME,k); },
    alK(A,T,u,src){ const P=T.P; let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); }; const r=recOf(T,src); if(!r) return 1;
      if(P['dr.fade']&&r.rot) cut(P['dr.fade']); if(P['dr.ne']&&r.dim) cut(P['dr.ne']); if(P['dr.dh']&&r.inZ) cut(P['dr.dh']); return Math.max(1-DR_AL,k); },
    inMe(A,T,u,c){ T.s.api=A; if(!(c.amt>0)||!c.src) return; T.fn.srcWeak(A,T,u,c); c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.amt,true); T.fn.tallyAdd(A,T,u,c); },
    dotMe(A,T,u,c){ T.s.api=A; if(!(c.amt>0)) return; const s=c.src; if(!s||s.team===u.team) return; c.amt*=T.fn.drK(A,T,u,s,null,c.amt,false); },
    teamK(A,T,u,c){ const t=c.tgt, s=c.src; if(!t||!s||!(c.amt>0)) return;
      if(t.team===u.team&&s.team!==u.team){ if(t===u) return; T.fn.srcWeak(A,T,u,c); c.amt*=T.fn.alK(A,T,u,s); T.fn.tallyAdd(A,T,u,c); return; }
      if(t.team!==u.team&&s.team===u.team&&s!==u) c.amt*=T.fn.teamMore(A,T,u,t); },
    teamDot(A,T,u,c){ const t=c.tgt, s=c.src; if(!t||!s||t.team!==u.team||t===u||s.team===u.team||!(c.amt>0)) return; c.amt*=T.fn.alK(A,T,u,s); },
    /* ---- HEALING AND SHIELDS ON ENEMIES (shields: the walk) ---- */
    healK(A,T,u,c){ const x=c.unit; if(!x||x.team===u.team) return; const P=T.P, r=recOf(T,x); if(!r) return; const a0=c.amt;
      if(P.nl&&Math.floor(r.th+1e-9)>=TH_MAX){ c.amt=0; T.s.um.healCut++; return; }
      if(P.pm&&r.rot&&x.hp<0.5*x.maxHp) c.amt*=1-P.pm;
      if(P.ww&&r.inF) c.amt*=1-P.ww; if(P.tid&&r.inZ) c.amt*=1-P.tid; if(c.amt<a0) T.s.um.healCut++; },
    /* ---- SHROUD OF SHADE: an enemy outside the field that picked an ally inside it picks the nearest of that side outside it instead (none: it keeps its pick) ---- */
    shade(A,T,u,c){ const by=c.src, t=c.tgt, E=A.eng(); if(!by||!t||fieldAt(T,by)) return; let b=null, bd=Infinity;
      for(const x of E.units()){ if(!x.alive||x.team!==t.team||x._dropHidden||x._noTarget||x._talShd===u) continue; const d=E.dist(by,x); if(d<bd){ bd=d; b=x; } }
      if(b){ c.tgt=b; T.s.um.shadeN++; } },
    /* ---- HIS SLOWS, ONE GROUP (multiplied, at most 40%): Rot Drag (the mark), Ash Grey (5 Thinning), No Warmth (the field), Bound Orbits (the stars), Wick Smoke ---- */
    slowK(A,T,u,c){ const x=c.tgt, P=T.P, r=recOf(T,x); if(!r) return 0; let k=1; const sl=v=>{ if(v>0) k*=1-v; };
      if(P.drag&&r.cr) sl(P.drag); if(P.ash&&Math.floor(r.th+1e-9)>=5) sl(P.ash); if(P.nw&&r.inF) sl(P.nw); if(P.orb&&T.fn.star(A,T,x)) sl(P.orb); if(P.smoke&&r.cs>0) sl(P.smoke);
      return Math.min(SLOW_CAP,1-k); },
    hbK(A,T,u,c){ return thOf(T,c.tgt)*(T.P.hb||0); },
    /* ---- CORRECTION: every 8 s (Every Light Checked: 5 s) the brightest enemy (the most damage its hits did to his side since the last Correction; one that did none
       is never the brightest) loses 2% a rank of its attack and ability power for 8 s (Strict Reader longer); Second Correction: the second brightest at 25% a
       rank of that; the Lamp: triple. ---- */
    bright(A,T,u,skip){ const m=T.s.um.tally, E=A.eng(); let b=null, bv=0; for(const x of foes(E,u)){ if(skip.indexOf(x)>=0) continue; const v=m[x.uid]||0; if(v>bv){ bv=v; b=x; } } return b; },
    corOn(A,T,u,x){ const P=T.P, um=T.s.um; if(P.md){ const r=recMk(T,x); r.dimL=Math.max(r.dimL,P.md); if(P['md.th']&&um.thOn&&rotting(T,u,x)) r.th=Math.min(TH_MAX,r.th+1); } },
    corTick(A,T,u,dt){ const P=T.P, um=T.s.um, C=um.cor; if(C.t>0){ C.t=Math.max(0,C.t-dt); if(!(C.t>0)) C.tri=false; } if(C.t2>0) C.t2=Math.max(0,C.t2-dt);
      if(C.m&&!C.m.alive){ C.m=null; C.t=0; C.tri=false; } if(C.s&&!C.s.alive){ C.s=null; C.t2=0; }
      C.cd-=dt; if(C.cd>0) return; C.cd+=(P.elc?5:8);
      const b=T.fn.bright(A,T,u,[]); if(!b){ um.tally={}; return; } const b2=P.cor2?T.fn.bright(A,T,u,[b]):null; const d=8+(P['cor.dur']||0);
      C.m=b; C.t=d; C.tri=false; C.s=b2; C.t2=b2?d:0; um.corN++; um.tally={}; T.fn.corOn(A,T,u,b); },
    corK(A,T,u,c){ const x=c.tgt, um=T.s.um, P=T.P; if(!um||!x) return 0; const C=um.cor, base=P.cor||0;
      if(C.m===x&&C.t>0) return Math.min(0.9,base*((C.tri&&um.lamp>0)?3:1)); if(C.s===x&&C.t2>0) return base*(P.cor2||0); return 0; },
    scrK(A,T,u,c){ const x=c.tgt, um=T.s.um, P=T.P; if(!um||!x) return 0; const C=um.cor; if(C.m===x&&C.t>0) return P.scr||0; if(C.s===x&&C.t2>0) return (P.scr||0)*(P.cor2||0); return 0; },
    /* ---- THE CANDLE AND STARE: the Candle burns 20 s each wave (Short Wick shorter); then 1 Stare a second, at most 15 (Night Vigil more); a stun or a silence that
       lands on him halves it (Lidless: no), not while the armed collapse keeps it full; The Second Candle arms his next ultimate at full Stare ---- */
    stTick(A,T,u,dt){ const P=T.P, um=T.s.um, E=A.eng(); const st=u.stunned||0, si=u.silencedT||0;
      if(((st>0&&st>um.st0+1e-6)||(si>0&&si>um.si0+1e-6))&&!P.unbl&&!(um.full>0)){ const n=stN(T); if(n>0){ A.stSet(T,u,'umStare',Math.floor(n/2)); um.halfN=(um.halfN||0)+1; } }
      um.st0=st; um.si0=si;
      if(um.cdl==null) return;
      if(um.cdl>0){ um.cdl-=dt; if(um.cdl>0) return; um.cdl=0; um.outN=(um.outN||0)+1;                                 // the Candle goes out
        if(P.burn) A.stSet(T,u,'umStare',stN(T)+P.burn);
        if(P.smoke) for(const x of foes(E,u)) if(gapM(E,u,x)<6) recMk(T,x).cs=2; }
      const mx=A.stMax(T,u,'umStare'); if(um.full>0){ A.stSet(T,u,'umStare',mx); }
      else { um.sa+=dt; while(um.sa>=1-1e-9){ um.sa-=1; A.stSet(T,u,'umStare',stN(T)+1); } }
      if(P.sc2){ const n=stN(T); if(!um.armed&&um.full<=0&&n>=mx-1e-9&&(um.pSt==null||um.pSt<mx-1e-9)){ um.armed=true; um.armN=(um.armN||0)+1; } um.pSt=n; } }
  },
  /* one sentence runs, another waits: none */
  partial:{},
  /* nothing implemented: none (every talent has rows; readings and corrected tooltips in WIRING/59 - UMBRIS - talent decisions.md) */
  ruling:{}
};
function stN(T){ const k=T.s.k.umStare; return k?k.n:0; }
