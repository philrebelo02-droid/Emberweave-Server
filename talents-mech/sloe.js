/* SLOE - what her learned talents do in a fight (the mechanics; her plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Sloe")
   Her real kit (the code, not the tooltip wording; a back-row Marksman, damage profile Attack: every skill reads her attack; 25.6 m reach; tests/sloe-kit-facts.js):
   - Hunter's Patience (passive 'patience'), worked out at each SWING: the same target as last swing +1 stack (6 at most), a new target 0; her crit chance
     (glyphCrit) is written again each swing as her base + 5% x passMul a stack. The swing's blow lands later (her clip has no crit sheet: the crit is rolled at
     the blow), so a swing's stacks count for its own blow. MEASURED: 6 stacks on 26 of 332 swings, reached 8 times in 20 fights (she changes target often).
   - Thornshot ('shred', green, cd 6, delivered as a shot): 155% of her attack (physical) to her target, then its armour is lowered by the skill's shred (44.9% at
     skill level 100) for 5 s (the strongest shred on a unit wins).
   - Vine Snare ('swamproot', blue, cd 10, delivered as a form 0.35 s after the press at her target): every enemy whose CENTRE is within 2.4 m of the target's
     centre takes 85% of her attack as MAGIC damage and is ROOTED - the game's root is its stun field: ccApply 'stunned', 2.8 s as landed (the authored 2.2 s is not
     used). It caught 1.33 enemies a cast.
   - Emerald Volley ('volley' ultimate, HERO_ULT_ART: backline, stagger 0.12): one arrow (140% of her attack x skill level, physical) at each of the 6 FARTHEST
     enemies (all of them when there are fewer), leaving 0.12 s apart and landing 0.30 s after they leave (through groundHazards: outside kit / cast; the page's
     landPre / land pair makes each arrow 'volley' while it resolves). 3.74 arrows a cast landed. There is no range check.
   Weak Spot, Undisturbed, Splits, the Thicket, Overgrown, Brambles, nocked arrows, Greenfall and Laid Bare exist only through her talents. All her state lives in
   one per-fight object T.s.sl (records per enemy in T.s.sl.e); every timer of hers is a countdown (no times list needed), and the enemy records are dropped at
   each wave's start (new enemies). Readings, caps and corrected tooltips: WIRING/53 - SLOE - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const TS='shred', VS='swamproot', VO='volley';
/* the families: a family's bookkeeping runs when any of its talents is learned */
const WS=['om_1_1','om_5_1','om_7_1','om_8_1','om_5_2','om_5_3','om_9_1','om_6_2','om_6_3','om_9_2','om_13_1'];        // Weak Spot
const CRIT=['om_2_2','tw_9_3','eq_9_4','eq_4_1','eq_2_2'];                                                                 // her crit chance from talents: ONE group (5%)
const SWING=WS.concat(['om_2_1','om_3_1'],CRIT);                                                                           // rows at Hunter's Patience's swing
const UND=['om_n1','om_3_4','om_5_4','om_7_4','om_12_3'];                                                                  // Undisturbed
const DRG=['om_3_4','om_4_4','om_11_1','tw_8_4','tw_11_4','eq_6_4','eq_11_4','tw_4_2','eq_4_3','tw_n2'];                    // her damage reduction: ONE capped group (35%)
const ADRG=['tw_4_2','eq_4_3','tw_n2'];                                                                                    // her allies' damage reduction from her talents: ONE capped group (15%)
const TEAM=['om_7_3','tw_8_1','eq_10_3','eq_1_3','eq_9_3','eq_13_2'].concat(ADRG);                                         // rows on her allies' hits and on hits on her allies
const DEATH=['om_11_3','tw_11_2','eq_7_3'];                                                                                // deaths of enemies (Bark Split Through, Wildwood, Bloom)
const DR_CAP=0.35, ADR_CAP=0.15, CRIT_CAP=0.05, ROOT_TOP=4.0, REGEN_CAP=0.012;
const S=T=>T.s.sl||(T.s.sl={e:{},ws:null,fd:{},oca:null,lan:0,und:false,qt:0,bw:0,bwT:null,et:0,etT:null,c1:0,c2:0,c3:0,carry:false,nk:0,nkT:0,q:[],vc:null,
  th:[],sid:0,rt:{},sfq:[],sfDone:{},brN:0,brS:{},tfN:0,awd:0,awdFrom:null,awdT:null,awdIn:true,fc:0,shLast:0,pT:null,pS:0,lh:null,sigHit:null,rc:{},vid:0,st:{n:0,on:0,gap:1e9,blk:0}});
const P0=(T,k)=>T.P[k]||0;
const foesOf=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team);
const alliesOf=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team===u.team&&!x._summon);
const isFoe=(u,x)=>!!x&&x.team!==u.team;
/* one record per enemy she has touched this wave: Splits (sp, spT), Overgrown (og), Greenfall (gf), Laid Bare (lb), Caught Fast (cf), Roots Find Stone (rfs, rfsL),
   the stun-lock's 0.5 s after a stun of hers ended (lk), Brambles catches (br), Thorn and Fletching (tf), her Thornshot shred on it (sh): every timer seconds left */
const E1=(o,x)=>o.e[x.uid]||(o.e[x.uid]={x,sp:0,spT:0,og:0,gf:0,lb:0,cf:0,rfs:0,rfsL:0,lk:0,br:0,tf:false,tfF:false,sh:0});
const rec=(o,x)=>x?o.e[x.uid]:null;
const sp=(o,x)=>{ const e=rec(o,x); return e&&e.spT>0?e.sp:0; };
const og=(o,x)=>{ const e=rec(o,x); return !!e&&e.og>0; };
const gf=(o,x)=>{ const e=rec(o,x); return !!e&&e.gf>0; };
const rooted=(o,x)=>!!x&&!!o.rt[x.uid]&&(x.stunned||0)>0;        // rooted by her now
const stk=u=>u._hpStk||0;
const inTh=(A,o,x)=>{ const E=A.eng(); for(const z of o.th) if(z.t>0&&Math.hypot(x.x-z.x,x.y-z.y)-E.bodyR(x)<z.r) return z; return null; };   // a Thicket: any part of the body over it
const nkMax=T=>Math.min(9,6+P0(T,'nk.max'));
/* a real hit of hers made by a talent (her out / crit / hit rows see it): the runtime's action depth put back to 0 for it */
function real(T,f){ const d=T.s.d; T.s.d=0; try{ return f(); } finally{ T.s.d=d; } }
/* the damage of one Emerald Volley arrow as the case works it out (dB x mul x Blood Rage), at her ultimate's skill level */
function arrowDmg(A,u,mul,sm){ const E=A.eng(); return (u.dmg||0)*(u.dmgBuffT>0?(u.dmgBuffMul||1):1)*(sm||1)*(mul||1.4)*(E.rage?E.rage():1); }
/* a talent root: the game's root is its stun field. Lands at its full written length on the fixed path (no resist roll, no draw), longer by Green Shoots on an
   Overgrown enemy, never on an enemy that is stunned now or within 0.5 s after a stun of hers on it ended, at most twice per enemy per cast (key), 4.0 s at most.
   An enemy immune to it (the game's Unstoppable) is blocked: Roots Find Stone */
function troot(A,T,u,t,secs,key){ if(!t||!t.alive||!isFoe(u,t)||!(secs>0)) return false; const o=S(T), e=E1(o,t);
  if(t.stunImmune){ T.fn.blocked(A,T,u,t); return false; }
  if((t.stunned||0)>0||e.lk>1e-9){ if((t.stunned||0)>0) o.st.on++; return false; }
  if(key){ const k=key+':'+t.uid; if((o.rc[k]||0)>=2) return false; }
  const len=Math.min(ROOT_TOP,secs*(1+(e.og>0?P0(T,'og.root'):0)));
  A.control(T,u,t,'stunned',len); const ok=(t.stunned||0)>0; if(ok){ o.st.n++; if(key){ const k=key+':'+t.uid; o.rc[k]=(o.rc[k]||0)+1; } } return ok; }
module.exports={
  hero:'sloe',
  casting:true,                         // rows ask which of her skills a hit or a root comes from
  points:true,                          // the at hook runs for Vine Snare: where its ground (the Thicket) lies
  states:{ slEac:{max:5,dur:4} },        // Every Arrow Counts: up to 5, all dropping 4 s after the last
  always:[
    {on:'wave',do:[{fn:'wave'}]},                                                                                // a wave's start: new enemies, Never Run Dry
    {on:'tick',do:[{fn:'tk'}]},                                                                                  // every countdown of hers, Undisturbed, nocking, Brambles, Thickets, roots ending
    {on:'pass',skill:'hpPre',reqAny:SWING,do:[{fn:'hpPre'}]},                                                    // Hunter's Patience is about to count this swing
    {on:'pass',skill:'hpSwing',reqAny:SWING,do:[{fn:'hpSwing'}]},                                                // ... and has counted it: Nearer Each Time, Never Changes Target, Found Again, Weak Spot
    {on:'kit',do:[{fn:'kit'}]},                                                                                  // any ability: the nock clock starts again; her skills' options
    {on:'cast',do:[{fn:'cast'}]},                                                                                // after Thornshot / Vine Snare / Emerald Volley
    {on:'at',skill:VS,do:[{fn:'atVS'}]},                                                                         // Vine Snare's ground: the Thicket
    {on:'skillTgt',skill:VS,reqAny:['tw_3_1'],do:[{fn:'pathCloses'}]},                                           // Path Closes
    {on:'skillTgt',skill:VO,reqAny:['om_7_1'],do:[{fn:'learned'}]},                                              // Learned Him
    {on:'landPre',skill:VO,do:[{fn:'arrowPre'}]},                                                                // an Emerald Volley arrow is about to strike
    {on:'land',skill:VO,do:[{fn:'arrowPost'}]},
    {on:'crit',reqAny:['om_5_2','om_13_1'],do:[{fn:'crit'}]},                                                    // One Clean Arrow, the arrow she has been waiting for
    {on:'out',do:[{fn:'out'}]},                                                                                  // her hits: every damage talent of hers
    {on:'hit',do:[{fn:'hit'}]},                                                                                  // her hits landed
    {on:'ccHit',if:{cc:['stunned']},do:[{fn:'rooted'}]},                                                         // a root of hers landed (Vine Snare's, a talent's)
    {on:'in',reqAny:DRG,do:[{fn:'myDr'}]},                                                                       // her damage-reduction talents: ONE capped group
    {on:'hurt',reqAny:UND,do:[{fn:'disturb'}]},                                                                  // she is hit: no longer Undisturbed
    {on:'dotIn',reqAny:UND,do:[{fn:'disturb'}]},                                                                 // a DoT ticks on her: the same
    {on:'teamIn',reqAny:TEAM,do:[{fn:'teamIn'}]},                                                                // her allies' hits on enemies, and enemy hits on her allies
    {on:'teamHeal',reqAny:['tw_10_2'],do:[{fn:'choked'}]},                                                       // Choked Out
    {on:'death',reqAny:DEATH,do:[{fn:'died'}]},                                                                  // Bark Split Through, Wildwood, Bloom
    {stat:{atk:1},per:{fn:'atkG'}},                                                                              // Patient Draw, Enough Time
    {stat:{aspd:1},per:{fn:'aspdG'}},                                                                            // Six Arrows Deep, Bowstring Rhythm, Wood Remembers, Every Arrow Counts
    {stat:{armor:1},per:{fn:'armG'}},                                                                            // Bark Skin, Watcher, Wood Sense
    {stat:{mr:1},per:{fn:'mrG'}},                                                                                // Watcher, Wood Sense
    {stat:{crit:1},per:{fn:'critG'}}                                                                             // her crit chance from talents (5% at most)
  ],
  talents:{
    /* ============================== ONE MAN AND ENOUGH TIME ============================== */
    om_1_1:[ {param:'ws.cd',add:R(0.02)} ],              // The Place He Cannot Cover: Weak Spot at 6 Patience; her crits on it 2% more a rank
    om_n1:[ {param:'und.k',add:R(0.015)} ],              // Where Nobody Looks: Undisturbed after 3 s with no damage; her hits on her target 1.5% more a rank
    om_1_3:[ {param:'sp.basic',add:R(0.03)} ],           // Old Bark: Splits (Thornshot, 3 at most, 8 s); each 3% more basic attack damage a rank
    om_2_1:[ {param:'pt.near',add:R(1)} ],               // Nearer Each Time: a new target starts at 1 Patience a rank
    om_2_3:[ {param:'sp.dur',add:R(1)} ],                // Split Deep: Splits 1 s longer a rank
    om_3_1:[ {param:'pt.keep',add:1} ],                  // Never Changes Target: her target died: half her stacks carried
    om_4_1:[ {param:'pd.atk',add:R(0.003)} ],            // Patient Draw: each Patience 0.3% attack a rank
    om_3_3:[ {param:'sp.lob',add:1} ],                   // Like Old Bark: at 3 Splits her Thornshot shred on it does not fade while she hits it
    om_3_4:[ {param:'dr.cloak',add:R(0.10)} ],           // Tanglewood Cloak: the hit that ends Undisturbed 10% less a rank (her group)
    om_5_1:[ {param:'ws.ign',add:R(0.02)} ],             // Long Watch: her hits on a Found Weak Spot ignore 2% of armor a rank
    om_4_3:[ {param:'ts.more',add:R(0.04)} ],            // Barbed Tip: Thornshot 4% more a rank
    om_4_4:[ {param:'dr.unw',add:R(0.02)} ],             // Unwatched: 2% less a rank from enemies she is not attacking (her group)
    om_8_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],      // Quick Thorn: Thornshot 0.3 s shorter a rank
    om_8_3:[ {param:'sp.open',add:R(0.02)} ],            // Split Open: Thornshot 2% more a rank for each Split
    om_5_4:[ {param:'und.wat',add:R(0.03)} ],            // Watcher: 3 s after Undisturbed ends, 3% more armor and magic resist a rank
    om_6_1:[ {param:'pt.six',add:R(0.02)} ],             // Six Arrows Deep: at 6 Patience 2% more attack speed a rank
    om_2_2:[ {param:'crit.k',add:R(0.01)} ],             // Blackthorn Eye: 1% crit chance a rank (her crit group, 5% at most)
    om_6_4:[ {param:'fc.k',add:R(0.01)} ],               // Fireless Camp: 1% of her max HP a rank every 5 s
    om_7_1:[ {param:'ws.lh',add:1} ],                    // Learned Him: Emerald Volley's six arrows at her Found Weak Spot (kit, skillTgt)
    om_7_3:[ {param:'sp.wide',add:R(0.01)} ],            // Split Wide: each Split 1% more from her allies a rank
    om_7_4:[ {param:'und.cd',add:R(0.02)} ],             // Steady Breath: Undisturbed, her crits 2% more a rank
    om_8_1:[ {param:'ws.again',add:R(1)} ],              // Found Again: back on a Found enemy, 1 Patience a rank kept
    om_5_2:[ {param:'ws.oca',add:1} ],                   // One Clean Arrow (PICK ONE): the first hit after Finding: a crit, 40% more
    om_5_3:[ {param:'ws.msw',add:0.06} ],                // Many Small Wounds (PICK ONE): each basic attack on a Found Weak Spot also 6% of her attack as true damage
    om_9_4:[ {param:'bw.k',add:R(0.005)} ],              // Bowstring Rhythm: 0.5% attack speed a rank for each basic attack on the same enemy (4 at most)
    om_9_1:[ {param:'ws.heal',add:R(0.02)} ],            // Waited Long Enough: crits on a Found Weak Spot heal her 2% of the damage a rank
    om_6_2:[ {param:'ws.oca2',add:R(0.08)} ],            // Heart Shot: One Clean Arrow 8% more a rank
    om_6_3:[ {param:'ws.msw2',add:R(0.01)} ],            // Bleeding Bark: Many Small Wounds 1% more of her attack a rank
    om_9_2:[ {param:'ws.lan',add:1} ],                   // A Little Nearer: each basic attack on a Found Weak Spot 1% more than the last (10% at most)
    om_10_1:[ {param:'pt.calm',add:R(0.003)} ],          // Hunter's Calm: her crits 0.3% more a rank for each Patience
    om_10_2:[ {param:'arm.btp',add:R(0.02)} ],           // Between the Plates: her hits ignore 2% of armor a rank
    om_10_3:[ {param:'vo.spl',add:R(0.03)} ],            // Splinter Rain: Emerald Volley 3% more a rank on enemies with Splits
    om_11_1:[ {param:'dr.nh',add:R(0.015)} ],            // No Hurry: at 6 Patience 1.5% less a rank (her group)
    om_11_3:[ {param:'sp.pass',add:1} ],                 // Bark Split Through: an enemy with 3 Splits dies: they pass to the nearest enemy
    om_12_1:[ {param:'et.k',add:R(0.005)} ],             // Enough Time: each second on the same target 0.5% attack a rank (10 s at most)
    om_11_4:[ {param:'vo.more',add:R(0.03)} ],           // Deep Quiver: Emerald Volley 3% more a rank
    om_12_3:[ {param:'und.sooner',add:R(0.5)} ],         // Small Fire: Undisturbed 0.5 s sooner a rank
    om_12_4:[ {param:'la.k',add:R(0.04)} ],              // Last Arrow: 4% more a rank on enemies below 30% HP
    om_13_1:[ {param:'sig.om',add:1} ],                  // Given One Man (SIGNATURE): every 20 s, a Found enemy below 50%: the arrow she has been waiting for
    /* ============================== THE TANGLEWOOD ============================== */
    tw_1_1:[ {param:'th.slow',add:R(0.03)} ],            // Forest Mark: Vine Snare's ground stays a Thicket until 3 s after its root ends; enemies in it 3% slower a rank
    tw_1_2:[ {param:'og.root',add:R(0.05)} ],            // Green Shoots: volley arrows leave Overgrown 5 s; her roots on Overgrown enemies 5% longer a rank
    tw_1_4:[ {param:'br.root',add:R(0.1)} ],             // Brambles Close: an enemy within 2 m is caught: rooted 0.1 s a rank (once a wave)
    tw_2_1:[ {param:'vs.td',add:R(0.2)} ],               // Tangle Deep: Vine Snare's root 0.2 s longer a rank
    tw_2_2:[ {param:'og.more',add:R(0.015)} ],           // Grows Where It Lands: Overgrown enemies take 1.5% more from her a rank
    tw_3_1:[ {param:'vs.close',add:1} ],                 // Path Closes: Vine Snare forms under the enemy nearest her
    tw_n1:[ {param:'br.tf',add:1} ],                     // Thorn and Fletching (LINK): first catch: her next Thornshot on it 10% more; with Nock and Wait, 1 arrow nocked (2 a wave)
    tw_2_3:[ {on:'ccIn',less:R(0.05)} ],                 // Woodwise: controls on her 5% shorter a rank (15% at most: its full rank)
    tw_3_4:[ {param:'br.thorny',add:R(0.15)} ],          // Thorny: Brambles deal 15% of her attack a rank
    tw_4_1:[ {on:'kit',skill:VS,opt:{radius:{more:R(0.04)}}} ],   // Snare Reach: Vine Snare (and its Thicket) 4% wider a rank
    tw_4_2:[ {param:'og.chk',add:R(0.02)} ],             // Choking Vines: Overgrown enemies deal 2% less a rank (both groups)
    tw_4_4:[ {param:'rt.bark',add:R(0.02)} ],            // Bark Skin: each enemy rooted by her 2% more armor a rank (3 at most)
    tw_5_1:[ {param:'th.wide',add:R(0.4)} ],             // Wide Thicket: 0.4 s longer a rank
    tw_5_2:[ {param:'vs.hold',add:1} ],                  // Hold Fast (PICK ONE): Vine Snare silences who it roots 1 s
    tw_5_3:[ {param:'vs.ltr',add:1} ],                   // Let Them Run (PICK ONE): its root 40% shorter, then 30% slower for 3 s
    tw_5_4:[ {param:'br.wr',add:R(0.01)} ],              // Wood Remembers: each enemy caught this wave 1% attack speed a rank (5 at most)
    tw_6_1:[ {param:'rt.prey',add:R(0.03)} ],            // Rooted Prey: her hits on enemies she has rooted 3% more a rank
    tw_6_2:[ {param:'vs.qw',add:R(0.2)} ],               // Quiet Wood: Hold Fast's silence 0.2 s longer a rank
    tw_6_3:[ {param:'vs.lc',add:R(0.5)} ],               // Long Chase: Let Them Run's slow 0.5 s longer a rank
    tw_6_4:[ {param:'br.bp',add:R(1)} ],                 // Briar Patch: Brambles catch each enemy 1 more time a rank each wave
    tw_7_1:[ {on:'cd',skill:'blue',add:R(-0.2)} ],       // Snare Pace: Vine Snare 0.2 s shorter a rank
    tw_7_2:[ {param:'og.seed',add:1} ],                  // Seeded Volley: a volley arrow on an Overgrown enemy roots it 0.6 s
    tw_7_4:[ {param:'br.cf',add:R(0.02)} ],              // Caught Fast: caught enemies take 2% more from her a rank for 3 s
    tw_8_1:[ {param:'th.team',add:R(0.015)} ],           // Taken by the Roots: enemies in the Thicket take 1.5% more from her team a rank
    tw_9_3:[ {param:'crit.k',add:R(0.01)} ],             // Green Eye: 1% crit chance a rank (her crit group)
    tw_8_4:[ {param:'dr.cb',add:R(0.03)} ],              // Closing Behind: a catch: 3% less a rank for 2 s (her group)
    tw_9_1:[ {param:'th.fig',add:1} ],                   // Strangler Fig: a root of hers ends inside the Thicket: rooted again 0.5 s, 0.5 s later (once per Vine Snare)
    tw_9_2:[ {param:'og.dur',add:R(0.4)} ],              // Overgrowth: Overgrown 0.4 s longer a rank
    tw_10_1:[ {param:'vs.more',add:R(0.04)} ],           // Snare Thorns: Vine Snare 4% more a rank
    tw_10_2:[ {param:'og.cho',add:R(0.02)} ],            // Choked Out: Overgrown enemies receive 2% less healing a rank
    tw_10_4:[ {param:'br.root2',add:R(0.06)} ],          // Thicker Brambles: 0.06 s longer a rank
    tw_11_2:[ {param:'og.wild',add:1} ],                 // Wildwood: an Overgrown enemy dies: Overgrown on every enemy within 3 m of it
    tw_11_3:[ {param:'rt.pw',add:R(0.003)} ],            // Patient Wood: on enemies she has rooted, each Patience 0.3% more a rank
    tw_11_4:[ {param:'dr.nf',add:R(0.02)} ],             // Never Followed: 2% less a rank from enemies within 3 m (her group)
    tw_12_1:[ {param:'ts.ring',add:R(0.04)} ],           // Ring of Thorn: Thornshot 4% more a rank on enemies she has rooted
    tw_12_2:[ {param:'vo.more',add:R(0.03)} ],           // Green Volley: Emerald Volley 3% more a rank
    tw_n2:[ {param:'dr.rfs',add:R(0.04)} ],              // Roots Find Stone: a root blocked by immunity: that enemy 4% less a rank for 3 s (12 s lock; both groups)
    tw_12_4:[ {param:'br.wall',add:R(0.10)} ],           // Thorn Wall: Brambles also slow 10% a rank for 2 s after the root
    tw_13_2:[ {param:'sig.tw',add:1} ],                  // What It Will Not Allow (SIGNATURE): every 25 s the volley roots, Overgrows and Thickets every enemy it hits; Brambles again
    /* ============================== EMPTY THE QUIVER ============================== */
    eq_1_1:[ {param:'nk.dmg',add:R(0.08)} ],             // Nock and Wait: 1 arrow nocked every 2 s with no ability (6 at most); the volley fires them, 8% of an arrow a rank
    eq_1_2:[ {param:'vo.more',add:R(0.03)} ],            // Long Flight: Emerald Volley 3% more a rank
    eq_1_3:[ {param:'gf.heal',add:R(0.01)} ],            // Something Green: volley arrows leave Greenfall 4 s; her allies hitting it heal 1% of the damage a rank
    eq_2_1:[ {param:'nk.max',add:R(1)} ],                // Full Quiver: 1 more arrow a rank (9 at most)
    eq_2_2:[ {param:'vo.crit',add:R(0.02)} ],            // Rapid Release: volley arrows 2% more crit chance a rank (inside her crit group)
    eq_9_4:[ {param:'crit.k',add:R(0.01)} ],             // Sharp Eye: 1% crit chance a rank (her crit group)
    eq_3_1:[ {param:'nk.ss',add:1} ],                    // Second String: Thornshot also fires a nocked arrow at the next nearest enemy, with Thornshot's shred
    eq_4_3:[ {param:'gf.ug',add:R(0.02)} ],              // Undergrowth: Greenfall enemies deal 2% less a rank (both groups)
    eq_3_3:[ {param:'gf.dur',add:R(0.4)} ],              // Spring Growth: Greenfall 0.4 s longer a rank
    eq_n1:[ {param:'awd.k',add:R(0.10)} ],               // Another Will Do: her target leaves her range: her next basic attack on another enemy ignores 10% of armor a rank (4 s)
    eq_4_1:[ {param:'nk.crit',add:R(0.003)} ],           // Steady Nock: each nocked arrow 0.3% crit chance a rank (her crit group)
    eq_5_2:[ {param:'vo.aao',add:0.15} ],                // All at Once (PICK ONE): the six arrows leave together, each 15% more
    eq_5_3:[ {param:'vo.slow',add:0.05} ],               // Slowly (PICK ONE): 0.3 s apart, each 5% more than the one before
    eq_4_2:[ {param:'vo.back',add:R(0.04)} ],            // Back Row Hunter: Emerald Volley 4% more a rank on back-row enemies
    eq_5_1:[ {param:'nk.rate',add:R(0.06)} ],            // Quick Nock: 6% faster a rank
    eq_6_2:[ {param:'vo.aao',add:R(0.05)} ],             // Single Thunder: All at Once's bonus 5 points higher a rank
    eq_6_3:[ {param:'vo.slow',add:R(0.01)} ],            // Rising Count: Slowly's step 1 point higher a rank
    eq_6_1:[ {stat:{nrg:R(0.03)}} ],                     // Volley Pace: 3% more ultimate energy a rank
    eq_5_4:[ {param:'vo.wsn',add:R(0.03)} ],             // Wood Sense: the volley fires: 3% more armor and magic resist a rank for 4 s
    eq_6_4:[ {param:'dr.tb',add:R(0.03)} ],              // Tough Bow: 3 nocked arrows or more, 3% less a rank (her group)
    eq_7_1:[ {param:'nk.rain',add:1} ],                  // Rain of Thorns: each nocked arrow the volley fires shreds like Thornshot at half strength
    eq_7_3:[ {param:'gf.bloom',add:R(0.01)} ],           // Bloom: a Greenfall enemy dies: allies within 4 m heal 1% of their max HP a rank
    eq_7_4:[ {param:'auto.rd',add:R(0.02)} ],            // Ranger's Draw: basic attacks 2% more a rank
    eq_8_1:[ {param:'auto.hd',add:R(0.03)} ],            // Held Draw: at 6 nocked arrows, basic attacks 3% more a rank
    eq_8_2:[ {param:'vo.ign',add:R(0.02)} ],             // Down the Ranks: volley arrows ignore 2% of armor a rank
    eq_8_3:[ {param:'gf.ng',add:R(0.02)} ],              // New Growth: Greenfall on 3 enemies in one volley: she heals 2% of her max HP a rank
    eq_9_2:[ {param:'nk.qe',add:1} ],                    // Quiver Empty: the volley fires 6 nocked arrows or more: 20 energy
    eq_9_3:[ {param:'gf.heal',add:R(0.004)} ],           // Thick Growth: Greenfall's heal 0.4% of the damage more a rank
    eq_10_1:[ {param:'nk.eac',add:R(0.01)} ],            // Every Arrow Counts: each nocked arrow that hits, 1% attack speed a rank for 4 s (5 at most)
    eq_10_3:[ {param:'gf.mg',add:R(0.01)} ],             // Marked Green: Greenfall enemies take 1% more from her allies a rank
    eq_10_4:[ {param:'gf.fs',add:R(0.02)} ],             // Far Shot: her crits 2% more a rank on Greenfall enemies
    eq_11_1:[ {param:'nk.nrd',add:1} ],                  // Never Run Dry: each wave starts with 6 nocked arrows
    eq_11_2:[ {param:'vo.cd',add:R(0.04)} ],             // Thorn Storm: Emerald Volley's crits 4% more a rank
    eq_11_4:[ {param:'dr.tl',add:R(0.02)} ],             // Treeline: 2% less a rank from ranged enemies (her group)
    eq_12_1:[ {on:'cd',skill:'green',add:R(-0.3)} ],     // Steady Fingers: Thornshot 0.3 s shorter a rank
    eq_12_2:[ {param:'vo.fan',add:R(0.01)} ],            // Fan of Green: Emerald Volley 1% more a rank for each enemy it strikes (6 at most)
    eq_12_4:[ {param:'ts.more',add:R(0.04)} ],           // Sharp Thorns: Thornshot 4% more a rank
    eq_13_2:[ {param:'sig.eq',add:1} ]                   // Slowly, Then All at Once (SIGNATURE): every 30 s the volley empties the quiver, 6 more arrows, Greenfall, Laid Bare
  },
  ruling:{},
  fn:{
    /* ---- a wave's start: the field is new (the fight clock starts again at 0; every timer of hers is a countdown, so nothing to move) ---- */
    wave(A,T,u){ const o=S(T); T.s.slA=A;   // slA: the runtime API, kept for the 95% instrument's tick-by-tick reading of drK (a test reads it; no fight does)
      o.e={}; o.ws=null; o.fd={}; o.oca=null; o.lan=0; o.bw=0; o.bwT=null; o.et=0; o.etT=null; o.th=[]; o.rt={}; o.sfq=[]; o.sfDone={}; o.brN=0; o.brS={}; o.tfN=0;
      o.awd=0; o.awdFrom=null; o.awdT=null; o.q=[]; o.vc=null; o.lh=null; o.sigHit=null; o.rc={}; o.carry=false;
      if(T.r.eq_11_1) o.nk=Math.max(o.nk,Math.min(6,nkMax(T))); },
    /* ---- once a tick ---- */
    tk(A,T,u,c){ const o=S(T), E=A.eng(), dt=c.dt||0, M=E.METER(); T.s.slA=A;
      for(const id in o.e){ const e=o.e[id]; if(!e.x.alive){ delete o.e[id]; continue; }
        if(e.spT>0){ e.spT-=dt; if(e.spT<=1e-9){ e.spT=0; e.sp=0; } }
        if(e.og>0) e.og-=dt; if(e.gf>0) e.gf-=dt; if(e.lb>0) e.lb-=dt; if(e.cf>0) e.cf-=dt; if(e.rfs>0) e.rfs-=dt; if(e.rfsL>0) e.rfsL-=dt; if(e.lk>0) e.lk-=dt; }
      for(const k of ['c1','c2','c3','awd']) if(o[k]>0) o[k]=Math.max(0,o[k]-dt);
      if(!u.alive) return;
      /* Undisturbed: no damage for 3 s (Small Fire: sooner) */
      if(UND.some(id=>T.r[id])){ o.qt+=dt; if(!o.und&&o.qt>=3-P0(T,'und.sooner')-1e-9) o.und=true; }
      /* nocked arrows: one every 2 s with no ability cast (Quick Nock: faster), up to the quiver */
      if(T.r.eq_1_1||T.r.eq_2_1||T.r.eq_3_1||T.r.eq_4_1||T.r.eq_5_1||T.r.eq_6_4||T.r.eq_7_1||T.r.eq_8_1||T.r.eq_9_2||T.r.eq_10_1||T.r.eq_11_1||T.r.eq_13_2){
        o.nkT+=dt*(1+P0(T,'nk.rate')); while(o.nkT>=2-1e-9){ o.nkT-=2; if(o.nk<nkMax(T)) o.nk++; } }
      /* Enough Time: seconds on the same target */
      if(u.target&&u.target===o.etT) o.et=Math.min(10,o.et+dt); else { o.etT=u.target||null; o.et=0; }
      /* Another Will Do: her target walks out of her reach (centre to centre, as her swing measures it) */
      if(P0(T,'awd.k')){ const t=u.target; if(t!==o.awdT){ const was=o.awdT; if(was&&was.alive&&o.awdIn&&E.dist(u,was)>u.range){ o.awd=4; o.awdFrom=was; }   // she changed target because hers walked out of reach
          o.awdT=t; o.awdIn=!!t&&t.alive&&E.dist(u,t)<=u.range; }
        else if(t&&t.alive){ const inR=E.dist(u,t)<=u.range; if(o.awdIn&&!inR){ o.awd=4; o.awdFrom=t; } o.awdIn=inR; } }
      /* Fireless Camp: 1% of her max HP a rank every 5 s */
      if(P0(T,'fc.k')){ o.fc+=dt; if(o.fc>=5-1e-9){ o.fc-=5; if(u.hp<E.healCap(u)) E.healUnit(u,Math.min(P0(T,'fc.k'),REGEN_CAP*5)*(u.maxHp||0)); } }
      /* Given One Man: a Found enemy below 50% HP, once every 20 s */
      if(P0(T,'sig.om')&&o.c1<=0&&o.ws&&o.ws.alive&&o.ws.hp<0.5*o.ws.maxHp) T.fn.sigOm(A,T,u);
      /* her roots ending: the stun-lock's 0.5 s, Let Them Run's slow, Strangler Fig */
      for(const id in o.rt){ const r=o.rt[id], x=r.x; if(!x.alive){ delete o.rt[id]; continue; } if((x.stunned||0)>0){ r.run=(r.run||0)+dt; continue; }
        delete o.rt[id]; const e=E1(o,x); e.lk=0.5;
        if(r.ltr) A.acts(T,u,[{slow:0.30,dur:3+P0(T,'vs.lc'),on:'target'}],{u,tgt:x});
        if(r.sid&&P0(T,'th.fig')&&!o.sfDone[r.sid+':'+id]&&inTh(A,o,x)) o.sfq.push({x,t:0.5,sid:r.sid}); }
      for(let i=0;i<o.sfq.length;i++){ const q=o.sfq[i]; q.t-=dt; if(q.t>1e-9||(o.e[q.x.uid]&&o.e[q.x.uid].lk>1e-9)) continue; /* and the 0.5 s after her root has run out */ o.sfq.splice(i--,1); const x=q.x, k=q.sid+':'+x.uid;
        if(x.alive&&!o.sfDone[k]&&inTh(A,o,x)&&troot(A,T,u,x,0.5,'vs'+q.sid)) o.sfDone[k]=1; }
      /* Thickets: their time, and the slow on enemies in one */
      if(o.th.length){ for(let i=0;i<o.th.length;i++){ const z=o.th[i]; if(z.t>0){ z.t-=dt; if(z.t<=1e-9) o.th.splice(i--,1); } }
        const k=P0(T,'th.slow'); if(k>0) for(const x of foesOf(A,u)) if(inTh(A,o,x)){ x.slow=Math.max(x.slow||0,0.15); x.slowMul=Math.min(x.slowMul==null?1:x.slowMul,Math.max(0.05,1-k)); } }
      /* Brambles: an enemy whose body comes within 2 m of hers */
      if(T.r.tw_1_4||T.r.tw_13_2) T.fn.brambles(A,T,u,M);
      /* extra arrows of Emerald Volley on their way */
      if(o.q.length) for(let i=0;i<o.q.length;i++){ const q=o.q[i]; q.t-=dt; if(q.t>1e-9) continue; o.q.splice(i--,1); T.fn.fly(A,T,u,q); } },
    /* ---- Hunter's Patience at the swing ---- */
    hpPre(A,T,u){ const o=S(T); o.pT=u._hpTgt||null; o.pS=u._hpStk||0;
      if(u._hpBaseCrit==null) u._hpBaseCrit=(u.glyphCrit||0)-((T.s.ap&&T.s.ap.crit)||0); },   // the passive's own base (what her talents add is kept apart: the stat row re-adds it)
    hpSwing(A,T,u,c){ const o=S(T), t=u._hpTgt; if(!t) return; let k=u._hpStk||0;
      if(t!==o.pT){ o.ws=null; o.oca=null; o.lan=0;
        let s=Math.min(6,P0(T,'pt.near'));
        if(P0(T,'pt.keep')&&o.pT&&!o.pT.alive) s=Math.max(s,Math.floor(o.pS/2));
        if(P0(T,'ws.again')&&E1(o,t).fdOn) s=Math.max(s,Math.min(6,P0(T,'ws.again')));
        if(o.carry){ s=Math.max(s,o.pS); o.carry=false; if(WS.some(id=>T.r[id])) s=6; }
        k=Math.max(k,Math.min(6,s)); u._hpStk=k; }
      if(WS.some(id=>T.r[id])&&k>=6&&o.ws!==t&&isFoe(u,t)){ o.ws=t; E1(o,t).fdOn=true; o.oca=P0(T,'ws.oca')?t:null; o.lan=0; }
      u.glyphCrit=u._hpBaseCrit+0.05*(u.passMul||1)*k+((T.s.ap&&T.s.ap.crit)||0); },   // the passive's line, with her talents' crit (the stat row's share) kept
    /* ---- her abilities ---- */
    kit(A,T,u,c){ const o=S(T), sk=c.skill; o.nkT=0;
      if(sk===VO){ o.vid++; const vc=o.vc={id:o.vid,k:0,gfS:{},gfN:0,ng:false,lb:{},sigT:false,sigE:false,nE:0};
        const F=foesOf(A,u); vc.nE=Math.min(F.length,(c.o&&c.o.n)||6);
        if(P0(T,'vo.aao')) c.o.stagger=0; else if(P0(T,'vo.slow')) c.o.stagger=0.3;
        o.lh=null; if(P0(T,'ws.lh')&&o.ws&&o.ws.alive&&A.eng().dist(u,o.ws)<=u.range){ c.o.single=true; o.lh=o.ws; vc.nE=1; }
        if(P0(T,'sig.tw')&&o.c2<=0){ vc.sigT=true; o.c2=25; for(const id in o.e) o.e[id].br=0; }
        if(P0(T,'sig.eq')&&o.c3<=0){ vc.sigE=true; o.c3=30; } }
      if(sk===TS&&c.o&&c.o.shred) o.shLast=c.o.shred; },
    cast(A,T,u,c){ const o=S(T), sk=c.skill, E=A.eng();
      if(sk===TS){ const t=c.tgt; if(t&&isFoe(u,t)){ const e=E1(o,t); e.sh=Math.max(e.sh,t._shredPct||0); }
        if(P0(T,'nk.ss')&&o.nk>=1&&t){ let b=null, bd=1e18; for(const x of foesOf(A,u)){ if(x===t) continue; const d=E.dist(u,x); if(d<bd){ bd=d; b=x; } }
          if(b){ o.nk--; const sm=E.skillMul?E.skillMul((u.skillLv&&u.skillLv[0])||1):1, amt=Math.max(P0(T,'nk.dmg'),0)*arrowDmg(A,u,1.4,sm);
            if(amt>0) T.fn.fly(A,T,u,{e:b,amt,nk:true,ss:true}); else T.fn.shredOn(A,T,u,b,o.shLast||0.32); } } }
      if(sk===VS){ const z=o.thNew; o.thNew=null; if(z){ let m=0; for(const id in o.rt){ const r=o.rt[id]; if(r.sid===z.sid&&r.x.alive) m=Math.max(m,r.x.stunned||0); } z.t=m+3+P0(T,'th.wide'); } }
      if(sk===VO){ const vc=o.vc; if(!vc) return; const vd=arrowDmg(A,u,(c.o&&c.o.mul)||1.4,u._castSM||1);
        let n=o.nk, sig=vc.sigE?6:0; o.nk=0; const tot=n+sig; if(P0(T,'nk.qe')&&n>=6) u.energy=Math.min(100,(u.energy||0)+20);
        if(P0(T,'vo.wsn')) A.acts(T,u,[{window:'slWsn',dur:4}],c);
        if(tot>0){ const L=foesOf(A,u).sort((a,b)=>E.dist(u,b)-E.dist(u,a)); if(!L.length) return; const st=(c.o&&c.o.stagger!=null)?c.o.stagger:0.12, reg=c.o&&c.o.single?1:Math.min(L.length,(c.o&&c.o.n)||6);
          const kN=P0(T,'nk.dmg'), kS=Math.max(kN,0.40);
          for(let i=0;i<tot;i++){ const isS=i>=n; o.q.push({e:L[i%L.length],amt:(isS?kS:kN)*vd,nk:true,sig:isS,t:0.30+st*(reg+i),vid:vc.id}); } } } },
    /* Vine Snare's ground: the Thicket (its time is set after the cast, from the root it put down) */
    atVS(A,T,u,c){ const o=S(T); o.sid++; o.curSid=o.sid; if(!(T.r.tw_1_1||T.r.tw_5_1||T.r.tw_8_1||T.r.tw_9_1)) return; const R0=(c.o&&c.o.radius)||2.4*A.eng().METER();
      const z={x:c.pt.x,y:c.pt.y,r:R0,t:Infinity,sid:o.sid}; o.th.push(z); o.thNew=z; },
    pathCloses(A,T,u,c){ const E=A.eng(); let b=null, bd=1e18; for(const x of foesOf(A,u)){ const d=E.dist(u,x)-E.bodyR(x); if(d<bd){ bd=d; b=x; } } if(b) c.tgt=b; },
    learned(A,T,u,c){ const o=S(T); if(c.o&&c.o.single&&o.lh&&o.lh.alive) c.tgt=o.lh; },
    /* ---- each Emerald Volley arrow ---- */
    arrowPre(A,T,u,c){ const o=S(T), vc=o.vc; if(vc) vc.k++; const g=T.fn.critG(A,T,u), x=Math.max(0,Math.min(CRIT_CAP,g+P0(T,'vo.crit'))-g); o.vcr=x; if(x>0) u.glyphCrit=(u.glyphCrit||0)+x; },
    arrowPost(A,T,u){ const o=S(T); if(o.vcr>0) u.glyphCrit=(u.glyphCrit||0)-o.vcr; o.vcr=0; },
    /* an extra arrow (nocked, the signature's, Second String's): a real hit of Emerald Volley at its own damage */
    fly(A,T,u,q){ const o=S(T), E=A.eng(); let e=q.e; if(!u.alive) return; if(!e||!e.alive){ const L=foesOf(A,u).sort((a,b)=>E.dist(u,b)-E.dist(u,a)); e=L[0]; if(!e) return; }
      if(!(q.amt>0)||!E.strike) return; const cur=T.s.cur, vc0=o.vc; T.s.cur=q.ss?null:VO; o.nkHit=q; if(q.ss) o.vc=null;
      try{ if(!q.ss) T.fn.arrowPre(A,T,u,{}); real(T,()=>E.strike(u,e,q.amt,'#5ee89b')); }
      finally{ if(!q.ss) T.fn.arrowPost(A,T,u); T.s.cur=cur; o.nkHit=null; o.vc=vc0; }
      if(q.ss&&e.alive) T.fn.shredOn(A,T,u,e,o.shLast||0.32); },
    shredOn(A,T,u,x,pct){ if(!x||!x.alive||!(pct>0)) return; x._shredPct=Math.max(x._shredPct||0,pct); x._shredT=Math.max(x._shredT||0,5); },
    /* ---- crits forced ---- */
    crit(A,T,u,c){ const o=S(T); if(c.tgt&&(c.tgt===o.oca||c.tgt===o.sigHit)) c.force=true; },
    /* ---- her hits: every damage talent of hers (each its own share, multiplied), armour ignored, crit damage ---- */
    out(A,T,u,c){ const o=S(T), t=c.tgt; if(!t||!isFoe(u,t)) return; const cur=T.s.cur, P=T.P, auto=!!c.auto, e=o.e[t.uid]; let m=1;
      const n=e&&e.spT>0?e.sp:0, stk6=stk(u), rt=rooted(o,t), ogOn=!!e&&e.og>0, gfOn=!!e&&e.gf>0;
      if(P['und.k']&&o.und&&t===u.target) m*=1+P['und.k'];
      if(auto&&P['sp.basic']&&n) m*=1+P['sp.basic']*n;
      if(cur===TS){ if(P['ts.more']) m*=1+P['ts.more']; if(P['sp.open']&&n) m*=1+P['sp.open']*n; if(P['ts.ring']&&rt) m*=1+P['ts.ring'];
        if(e&&e.tf){ m*=1.10; e.tf=false; } }
      if(cur===VS&&P['vs.more']) m*=1+P['vs.more'];
      if(cur===VO){ const vc=o.vc; if(P['vo.more']) m*=1+P['vo.more']; if(P['vo.spl']&&n) m*=1+P['vo.spl']; if(P['vo.back']&&t.t&&t.t.row==='Back') m*=1+P['vo.back'];
        if(P['vo.fan']&&vc) m*=1+P['vo.fan']*Math.min(6,vc.nE);
        if(!o.nkHit&&vc){ if(P['vo.aao']) m*=1+P['vo.aao']; else if(P['vo.slow']) m*=Math.pow(1+P['vo.slow'],Math.max(0,vc.k-1)); } }
      if(P['og.more']&&ogOn) m*=1+P['og.more'];
      if(P['rt.prey']&&rt) m*=1+P['rt.prey'];
      if(P['rt.pw']&&rt&&stk6) m*=1+P['rt.pw']*stk6;
      if(P['br.cf']&&e&&e.cf>0) m*=1+P['br.cf'];
      if(auto&&P['auto.rd']) m*=1+P['auto.rd'];
      if(auto&&P['auto.hd']&&o.nk>=6) m*=1+P['auto.hd'];
      if(P['la.k']&&t.hp<0.30*t.maxHp) m*=1+P['la.k'];
      if(auto&&P['ws.lan']&&t===o.ws) m*=1+Math.min(0.10,0.01*o.lan);
      if(t===o.oca) m*=1+0.40+P0(T,'ws.oca2');
      if(c.crit){ if(P['ws.cd']&&t===o.ws) m*=1+P['ws.cd']; if(P['und.cd']&&o.und) m*=1+P['und.cd']; if(P['pt.calm']&&stk6) m*=1+P['pt.calm']*stk6;
        if(P['gf.fs']&&gfOn) m*=1+P['gf.fs']; if(P['vo.cd']&&cur===VO) m*=1+P['vo.cd']; }
      c.amt*=m;
      /* armour ignored (physical hits): each share of what is left */
      if(c.kind==='phys'||c.kind==null){ let ig=0; const add=x=>{ if(x>0) ig=1-(1-ig)*(1-Math.min(1,x)); };
        if(P['ws.ign']&&t===o.ws) add(P['ws.ign']); add(P['arm.btp']||0); if(cur===VO) add(P['vo.ign']||0);
        if(auto&&P['awd.k']&&o.awd>0&&o.awdFrom&&t!==o.awdFrom){ add(P['awd.k']); o.awd=0; o.awdFrom=null; }
        if(t===o.sigHit) ig=1;
        if(ig>0){ const E=A.eng(), a=E.defMul(u,t,'phys'); if(a>0){ const sv=u._wpnArmIgn; u._wpnArmIgn=1-(1-(sv||0))*(1-ig); const b=E.defMul(u,t,'phys'); u._wpnArmIgn=sv; c.amt*=b/a; } } } },
    /* ---- her hits landed ---- */
    hit(A,T,u,c){ const o=S(T), t=c.tgt; if(!t||!isFoe(u,t)) return; const cur=T.s.cur, P=T.P, E=A.eng(), auto=!!c.auto;
      /* Splits: each Thornshot that hits */
      if(cur===TS&&(T.r.om_1_3||T.r.om_2_3||T.r.om_3_3||T.r.om_8_3||T.r.om_7_3||T.r.om_10_3||T.r.om_11_3)){ const e=E1(o,t); e.sp=Math.min(3,(e.spT>0?e.sp:0)+1); e.spT=8+P0(T,'sp.dur'); }
      /* Like Old Bark: at 3 Splits her Thornshot shred on it stays while she hits it */
      if(P['sp.lob']){ const e=o.e[t.uid]; if(e&&e.spT>0&&e.sp>=3&&e.sh>0) T.fn.shredOn(A,T,u,t,e.sh); }
      /* Weak Spot */
      if(t===o.ws){ if(auto){ o.lan++; const k=P0(T,'ws.msw')+P0(T,'ws.msw2'); if(k>0&&P['ws.msw']) A.hurt(T,u,t,k*(u.dmg||0),'#d6f5c0','msw'); }
        if(c.crit&&P['ws.heal']&&c.amt>0) E.healUnit(u,c.amt*P['ws.heal']); }
      if(t===o.oca) o.oca=null;
      /* Bowstring Rhythm */
      if(auto&&P['bw.k']){ if(o.bwT===t) o.bw=Math.min(4,o.bw+1); else { o.bwT=t; o.bw=1; } }
      /* Roots Find Stone: Vine Snare on an enemy immune to its root */
      if(cur===VS&&t.stunImmune) T.fn.blocked(A,T,u,t);
      /* Emerald Volley's arrows (and the nocked ones) */
      if(cur===VO){ const e=E1(o,t), vc=o.vc, q=o.nkHit;
        if(P['og.seed']&&e.og>0) troot(A,T,u,t,0.6,'vo'+(vc?vc.id:0));
        if(vc&&vc.sigT){ troot(A,T,u,t,1.5,'vo'+vc.id); e.og=Math.max(e.og,5+P0(T,'og.dur'));
          o.sid++; const r=(u.blueAb&&u.blueAb.radius||2.4*E.METER())*(1+0.04*(T.r.tw_4_1||0)); o.th.push({x:t.x,y:t.y,r,t:3+P0(T,'th.wide'),sid:o.sid}); }
        if(T.r.tw_1_2||T.r.tw_2_2||T.r.tw_4_2||T.r.tw_7_2||T.r.tw_9_2||T.r.tw_10_2||T.r.tw_11_2) e.og=Math.max(e.og,5+P0(T,'og.dur'));
        if((T.r.eq_1_3||T.r.eq_4_3||T.r.eq_3_3||T.r.eq_7_3||T.r.eq_8_3||T.r.eq_9_3||T.r.eq_10_3||T.r.eq_10_4)||(vc&&vc.sigE)){ e.gf=Math.max(e.gf,4+P0(T,'gf.dur'));
          if(vc&&!vc.gfS[t.uid]){ vc.gfS[t.uid]=1; vc.gfN++; if(vc.gfN>=3&&!vc.ng&&P['gf.ng']){ vc.ng=true; E.healUnit(u,P['gf.ng']*(u.maxHp||0)); } } }
        if(vc&&vc.sigE&&q&&q.sig&&!vc.lb[t.uid]){ vc.lb[t.uid]=1; e.lb=5; }
        if(q&&q.nk&&P['nk.rain']) T.fn.shredOn(A,T,u,t,0.5*(o.shLast||0.32)); }
      /* Every Arrow Counts: each nocked arrow that hits (the volley's, Second String's) */
      if(o.nkHit&&o.nkHit.nk&&P['nk.eac']) A.acts(T,u,[{stack:'slEac',add:1}],c); },
    /* ---- a root of hers landed (the game's root is its stun field) ---- */
    rooted(A,T,u,c){ const o=S(T), t=c.tgt, E=A.eng(); if(!t||!t.alive||!isFoe(u,t)) return;
      if(t.stunImmune){ T.fn.blocked(A,T,u,t); return; }
      const r={x:t,sid:0,ltr:false};
      if(!c.talent&&T.s.cur===VS){ r.sid=o.curSid||0; const e=E1(o,t);
        let len=c.amt||0; if(P0(T,'vs.ltr')){ len*=0.6; r.ltr=true; }
        len=len*(1+(e.og>0?P0(T,'og.root'):0))+P0(T,'vs.td'); const run=(o.rt[t.uid]&&o.rt[t.uid].run)||0; len=Math.min(ROOT_TOP-run,len);   // a root of hers already holding it: the run counts from its start (4.0 s at most in a row)
        if(run>0) t.stunned=Math.min(t.stunned||0,Math.max(0,ROOT_TOP-run));
        if(r.ltr) t.stunned=len; else t.stunned=Math.max(t.stunned||0,len);   // Let Them Run: shorter (the game wrote its own 2.8 s just now); the others in full after it lands, 4.0 s at most
        if(P0(T,'vs.hold')) A.control(T,u,t,'silencedT',1+P0(T,'vs.qw')); }
      if(!o.rt[t.uid]) o.rt[t.uid]=r; else if(r.sid){ o.rt[t.uid].sid=r.sid; o.rt[t.uid].ltr=r.ltr; } },
    /* a root of hers blocked by immunity: Roots Find Stone (once per enemy every 12 s) */
    blocked(A,T,u,t){ const o=S(T); o.st.blk++; if(!P0(T,'dr.rfs')||!t||!t.alive) return; const e=E1(o,t); if(e.rfsL>0) return; e.rfs=3; e.rfsL=12; },
    /* ---- Brambles ---- */
    brambles(A,T,u,M){ const o=S(T), E=A.eng(), allow=1+P0(T,'br.bp'); for(const x of foesOf(A,u)){ if(E.dist(u,x)-E.bodyR(u)-E.bodyR(x)>=2*M) continue;
        const e=E1(o,x); if(e.br>=allow) continue; if((x.stunned||0)>0||e.lk>1e-9) continue; e.br++;
        const len=P0(T,'br.root')+P0(T,'br.root2'); if(len>0) troot(A,T,u,x,len,null);
        if(P0(T,'br.thorny')) A.hurt(T,u,x,P0(T,'br.thorny')*(u.dmg||0),'#7fbf5a','brambles');
        if(P0(T,'br.wall')&&x.alive) A.acts(T,u,[{slow:P0(T,'br.wall'),dur:(x.stunned||0)+2,on:'target'}],{u,tgt:x});
        if(P0(T,'br.cf')) e.cf=3;
        if(P0(T,'dr.cb')) A.acts(T,u,[{window:'slCb',dur:2}],{u,tgt:x});
        if(!o.brS[x.uid]){ o.brS[x.uid]=1; o.brN++; }
        if(P0(T,'br.tf')&&!e.tfF){ e.tfF=true; e.tf=true; if(T.r.eq_1_1&&o.tfN<2&&o.nk<nkMax(T)){ o.nk++; o.tfN++; } } } },
    /* ---- Given One Man: the arrow she has been waiting for ---- */
    sigOm(A,T,u){ const o=S(T), E=A.eng(), x=o.ws; if(!x||!x.alive||!E.strike) return; o.c1=20; o.sigHit=x; const cur=T.s.cur; T.s.cur=null;
      try{ real(T,()=>E.strike(u,x,3.0*(u.dmg||0),'#b6ff9e')); } finally{ o.sigHit=null; T.s.cur=cur; }
      if(!x.alive){ o.carry=true; o.pS=Math.max(o.pS,u._hpStk||0); } },
    /* ---- she is struck ---- */
    disturb(A,T,u){ const o=S(T); o.qt=0; if(o.und){ o.und=false; if(P0(T,'und.wat')) A.acts(T,u,[{window:'slWat',dur:3}],{u}); } },
    /* ---- her damage reduction: ONE group, the shares multiply, never more than 35% off a hit ---- */
    drK(A,T,u,s,auto){ const P=T.P, o=S(T), E=A.eng(); let k=1;
      if(P['dr.cloak']&&o.und) k*=1-P['dr.cloak'];
      if(s&&P['dr.unw']&&s!==u.target) k*=1-P['dr.unw'];
      if(P['dr.nh']&&stk(u)>=6) k*=1-P['dr.nh'];
      if(P['dr.cb']&&A.winOn(T,'slCb')) k*=1-P['dr.cb'];
      if(s&&P['dr.nf']&&E.dist(u,s)-E.bodyR(u)-E.bodyR(s)<3*E.METER()) k*=1-P['dr.nf'];
      if(P['dr.tb']&&o.nk>=3) k*=1-P['dr.tb'];
      if(s&&P['dr.tl']&&!s.melee) k*=1-P['dr.tl'];
      if(s){ const e=o.e[s.uid]; if(e){ if(P['og.chk']&&e.og>0) k*=1-P['og.chk']; if(P['gf.ug']&&e.gf>0) k*=1-P['gf.ug']; if(P['dr.rfs']&&e.rfs>0) k*=1-P['dr.rfs']; } }
      return Math.max(1-DR_CAP,k); },
    myDr(A,T,u,c){ c.amt*=T.fn.drK(A,T,u,c.src,c.auto); },
    /* ---- her allies' hits on enemies, and enemy hits on her allies ---- */
    teamIn(A,T,u,c){ const o=S(T), P=T.P, x=c.tgt, s=c.src, E=A.eng(); if(!x||!s) return;
      if(isFoe(u,x)&&s.team===u.team){ const e=o.e[x.uid]; let m=1;
        if(P['th.team']&&inTh(A,o,x)) m*=1+P['th.team'];                                      // the whole team (Sloe too)
        if(e&&s!==u){ if(P['sp.wide']&&e.spT>0&&e.sp>0) m*=1+P['sp.wide']*e.sp; if(P['gf.mg']&&e.gf>0) m*=1+P['gf.mg'];
          if(e.lb>0){ m*=1.40; e.lb=0; } }
        c.amt*=m;
        if(e&&s!==u&&e.gf>0&&P['gf.heal']&&s.alive&&c.amt>0) E.healUnit(s,c.amt*P['gf.heal']);
        return; }
      if(x.team===u.team&&x!==u&&!x._summon&&isFoe(u,s)){ const e=o.e[s.uid]; if(!e) return; let k=1;
        if(P['og.chk']&&e.og>0) k*=1-P['og.chk']; if(P['gf.ug']&&e.gf>0) k*=1-P['gf.ug']; if(P['dr.rfs']&&e.rfs>0) k*=1-P['dr.rfs'];
        c.amt*=Math.max(1-ADR_CAP,k); } },
    choked(A,T,u,c){ const o=S(T), x=c.unit; if(x&&isFoe(u,x)&&og(o,x)) c.amt*=1-P0(T,'og.cho'); },
    /* ---- deaths ---- */
    died(A,T,u,c){ const o=S(T), E=A.eng(), x=c.unit; if(!x||!isFoe(u,x)) return; const e=o.e[x.uid]; if(!e) return;
      if(P0(T,'sp.pass')&&e.spT>0&&e.sp>=3){ let b=null, bd=1e18; for(const f of foesOf(A,u)){ if(f===x) continue; const d=E.dist(x,f); if(d<bd){ bd=d; b=f; } } if(b){ const r=E1(o,b); r.sp=3; r.spT=8+P0(T,'sp.dur'); } }
      if(P0(T,'og.wild')&&e.og>0) for(const f of foesOf(A,u)){ if(f===x) continue; if(E.dist(x,f)-E.bodyR(x)-E.bodyR(f)<3*E.METER()){ const r=E1(o,f); r.og=Math.max(r.og,5+P0(T,'og.dur')); } }
      if(P0(T,'gf.bloom')&&e.gf>0) for(const a of alliesOf(A,u)) if(E.dist(x,a)-E.bodyR(x)-E.bodyR(a)<4*E.METER()&&a.hp<E.healCap(a)) E.healUnit(a,P0(T,'gf.bloom')*(a.maxHp||0)); },
    /* ---- stats that follow her state ---- */
    atkG(A,T,u){ const o=S(T); return P0(T,'pd.atk')*stk(u)+P0(T,'et.k')*Math.floor(o.et+1e-9); },
    aspdG(A,T,u){ const o=S(T); let a=0; if(P0(T,'pt.six')&&stk(u)>=6) a+=P0(T,'pt.six'); a+=P0(T,'bw.k')*o.bw; a+=P0(T,'br.wr')*Math.min(5,o.brN); a+=P0(T,'nk.eac')*A.stGet(T,'slEac'); return a; },
    armG(A,T,u){ const o=S(T); let a=0; if(P0(T,'rt.bark')){ let n=0; for(const id in o.rt){ const r=o.rt[id]; if(r.x.alive&&(r.x.stunned||0)>0) n++; } a+=P0(T,'rt.bark')*Math.min(3,n); }
      if(A.winOn(T,'slWat')) a+=P0(T,'und.wat'); if(A.winOn(T,'slWsn')) a+=P0(T,'vo.wsn'); return a; },
    mrG(A,T,u){ let a=0; if(A.winOn(T,'slWat')) a+=P0(T,'und.wat'); if(A.winOn(T,'slWsn')) a+=P0(T,'vo.wsn'); return a; },
    critG(A,T,u){ const o=S(T); return Math.min(CRIT_CAP,P0(T,'crit.k')+P0(T,'nk.crit')*o.nk); }
  }
};
