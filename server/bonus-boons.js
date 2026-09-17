/* ============================================================================
   THE BOON CATALOGUE — the reward for surviving a wave.

   Phil, 17 Sep 2026:
     "I also want some interesting once, like auto attacks have 10% chance to stun enemy for 1 second
      / or casts have a 5% chance to trigger twice, be creative like this"
     "i dont want flat damage increase to be the standard"
     "this is boring"

   HE WAS RIGHT AND THE FIRST CATALOGUE IS GONE. It was 33 stats x 7 triggers — a grid, and a grid of
   "+7 armour" is a stat stick with a name on it. Nothing in it changed how a fight PLAYED.

   WHAT A BOON IS NOW. Every entry below answers "what does this let me do that I could not do before?"
   Six families, hand-authored, no grid:

     PROC      something fires on a chance, and it is a thing that happens, not a number
     RULE      a rule of the fight is different for the rest of the run
     PACT      a real gift with a real cost — you have to want it
     ESCALATE  it grows while the wave runs, and you can feel it growing
     ROAD      it is about where people stand, and crossing a firebreak matters to it
     WAVE      it changes how the wave ARRIVES, before anyone swings

   Flat stats survive only where the number itself is the interesting part — and there are seven of
   them, not a hundred.

   `scale` marks what grows with level (Phil: "the buff scales to level"). A chance never scales: 10%
   is 10% at level 60, or the whole catalogue collapses into certainty.
   `needs` names what the engine does not do yet. It is never hidden, and `readyNow()` filters it out
   so the mode never offers a dead option.
   ========================================================================== */
'use strict';

const BOON_SCALE_PER_LEVEL = 0.06;
function scaleFor(level){ return Math.pow(1+BOON_SCALE_PER_LEVEL, Math.max(0,(level|0)-1)); }

/* v: the number in the blurb. scale:true means it grows with level. */
const B = (fam,id,name,v,scale,text,needs,req)=>({fam,id,name,v,scale:!!scale,text,needs:needs||null,req:req||null});

/* ------------------------------------------------- WHO A BOON IS ACTUALLY FOR
   Phil, 17 Sep 2026: "make it so that when the 3 boons are offered, they can never be offered a boon
   that doesnt benefit atleast one of them, for instance everlasting can never be offered to a lane
   without a summon hero."

   So every boon that only makes sense for a certain KIND of road carries a `req`, and the offer is
   drawn from the boons that fit the heroes standing there. A boon with no `req` fits any road.

   The three hero lists below are DERIVED FROM THE CLIENT'S OWN KIT TABLE, not typed from memory —
   `tests/test_boon_fit.js` re-derives them from `emberweave-heroes.html` every run and fails if they
   drift, which is the only way a hard-coded roster stays true. In-game names, per MASTER RULE 8:
     summoners — Hurne the Chained, Zahri Sunhorn, The Librarian of Monsters
     healers   — Oakmir, Threadseer, Nerisse Bellglass, Dandra                                      */
const SUMMONER_KEYS = ['hurne','zahri','librarian'];
const HEALER_KEYS   = ['oakmir','threadseer','nerisse','meryln'];

/* What a road looks like, from the heroes on it. `hero(key)` hands back whatever the caller knows
   about a hero — role, row, apow — and anything missing simply fails its test rather than throwing. */
function laneProfile(heroKeys, hero, opts){
  const keys=(heroKeys||[]).map(String), o=opts||{};
  const info=k=>{ try{ return (hero&&hero(k))||{}; }catch(e){ return {}; } };
  const rows=keys.map(k=>String(info(k).combatRow||info(k).row||''));
  return {
    n: keys.length,
    summoner: keys.some(k=>SUMMONER_KEYS.indexOf(k)>=0),
    healer:   keys.some(k=>HEALER_KEYS.indexOf(k)>=0 || info(k).healer===true),
    caster:   keys.some(k=>(+info(k).apow||0)>0),
    mixedRows: rows.some(r=>r==='Front'||r==='Mid') && rows.some(r=>r==='Back'),
    room:     o.room!==false,          // the road is below its ten-hero cap
    otherRoad: o.otherRoad!==false     // at least one other road is still walking
  };
}

/* Does this boon do anything at all for that road? */
function boonFits(b, prof){
  const r=b&&b.req; if(!r) return true;
  const p=prof||{};
  switch(r){
    case 'summoner':  return !!p.summoner;
    case 'healer':    return !!p.healer;
    case 'caster':    return !!p.caster;
    case 'multi':     return (p.n|0)>1;
    case 'solo':      return (p.n|0)===1;
    case 'room':      return !!p.room;
    case 'mixedRows': return !!p.mixedRows;
    case 'otherRoad': return !!p.otherRoad;
    default:          return true;
  }
}
function fitsFor(prof){ return CATALOGUE.filter(b=>!b.needs && boonFits(b, prof)); }

const CATALOGUE = [

/* ------------------------------------------------------------------ PROC ----
   Phil's two examples are the first two entries, in his numbers. */
B('PROC','stunstrike','Concussive',    0.10,false,'Auto attacks have a {p} chance to stun for 1 second.'),
B('PROC','echocast','Echoed',          0.05,false,'Casts have a {p} chance to fire a second time.','a cast may re-enter itself once'),
B('PROC','freezehit','Hoarfrost',      0.08,false,'Auto attacks have a {p} chance to freeze for 1.5 seconds.'),
B('PROC','fearhit','Harrowing',        0.07,false,'Auto attacks have a {p} chance to send the target fleeing.'),
B('PROC','silencecast','Hushing',      0.12,false,'Casts have a {p} chance to silence what they hit for 2 seconds.'),
B('PROC','mortalhit','Grave-touched',  0.15,false,'Auto attacks have a {p} chance to stop the target being healed for 3 seconds.'),
B('PROC','cdreset','Impatient',        0.10,false,'Every kill has a {p} chance to refresh your green cooldown.'),
B('PROC','ultrefund','Unspent',        0.20,false,'Ultimates have a {p} chance to refund half their energy.'),
B('PROC','doublestrike','Twinned',     0.15,false,'Auto attacks have a {p} chance to strike twice.'),
B('PROC','critconvert','Fateful',      0.10,false,'Every attack has a {p} chance to be a guaranteed critical.'),
B('PROC','blinkdodge','Slipstream',    0.12,false,'Taking damage has a {p} chance to blink you clear of it.'),
B('PROC','thornproc','Barbed',         0.25,false,'Being hit has a {p} chance to throw the damage straight back.','reflect a share of a received hit'),
B('PROC','chainhit','Arcing',          0.18,false,'Auto attacks have a {p} chance to arc to a second enemy.','splash a share to a second target'),
B('PROC','summonproc','Called',        0.06,false,'Kills have a {p} chance to call a warrior to your side for the wave.'),
B('PROC','slowfield','Miring',         0.20,false,'Auto attacks have a {p} chance to halve the target’s speed for 3 seconds.'),
B('PROC','burnproc','Kindling',        0.22,false,'Auto attacks have a {p} chance to set the target burning.'),
B('PROC','energyleech','Draining',     0.15,false,'Auto attacks have a {p} chance to steal 10 energy.','move energy between units'),
B('PROC','shieldproc','Bulwarked',    90,true,'Blocking or taking a hit has a 18% chance to raise a shield worth {v}.'),
B('PROC','healproc','Merciful',       120,true,'Kills have a 15% chance to heal the lowest hero on your road for {v}.'),
B('PROC','taunthit','Goading',         0.10,false,'Auto attacks have a {p} chance to force the target onto you for 3 seconds.'),
B('PROC','markproc','Hunted',          0.14,false,'Casts have a {p} chance to mark the target — everyone on your road hits it harder.','a shared damage mark'),
B('PROC','sleepproc','Lulling',        0.06,false,'Auto attacks have a {p} chance to put the target to sleep until it is struck again.'),
B('PROC','ultcharge','Rising',         0.25,false,'Every kill has a {p} chance to grant 20 energy.'),
B('PROC','execproc','Merciless',       0.20,false,'Attacks on anything under a quarter health have a {p} chance to kill outright.','an execute threshold'),

/* ------------------------------------------------------------------ RULE ----
   No chance. The fight simply works differently now. */
B('RULE','nofirstdeath','Second Wind',   0,false,'The first hero on this road to fall gets back up at half health. Once.','a one-off revive','multi'),
B('RULE','killresets','Bloodthirst',     0,false,'Every kill takes 2 seconds off all your cooldowns.'),
B('RULE','ultcheap','Unburdened',        0.30,false,'Ultimates cost {p} less energy.'),
B('RULE','critchain','Momentum',         0,false,'A critical hit makes your next attack a critical too.'),
B('RULE','overkill','Overrun',           0,false,'Damage that overkills an enemy carries into the next one.','carry overkill damage'),
B('RULE','deathblast','Pyre',         110,true,'Enemies you kill explode for {v} to everything near them.'),
B('RULE','firstcast','Opening Gambit',   0,false,'The first cast of every wave costs nothing.'),
B('RULE','lowhpimmune','Defiant',        0,false,'Below a quarter health you cannot be stunned, frozen or feared.'),
B('RULE','healtoshield','Aegis',         0,false,'Healing above full health becomes a shield instead of being wasted.'),
B('RULE','nocrit','Steady Hand',         0,false,'You can no longer crit — every hit lands for what a crit would have been, minus a third.','flatten crit into base damage'),
B('RULE','ultondeath','Last Word',       0,false,'A hero who falls casts their ultimate on the way down.','fire an ult on death'),
B('RULE','sharedhp','Oathbound',         0,false,'Damage to any hero on this road is split evenly across all of them.','pool damage across a lane','multi'),
B('RULE','revengekill','Vengeance',      0,false,'When a hero on your road falls, everyone left gets a free ultimate.',null,'multi'),
B('RULE','firstwavefree','Vanguard',     0,false,'The first enemy of every wave dies to your first hit, whatever its health.','a scripted first kill'),
B('RULE','nohealenemy','Withering',      0,false,'Enemies on this road cannot be healed at all.'),
B('RULE','casthaste','Fluent',           0,false,'Every cast makes your next cast 30% faster. Resets when you auto attack.'),
B('RULE','deathtimer','Borrowed Time',   0,false,'A hero who would die keeps fighting for 3 more seconds, then falls.','delay a death'),
B('RULE','backline','Ambusher',          0,false,'Your attacks always target the furthest enemy instead of the nearest.'),

/* ------------------------------------------------------------------ PACT ----
   A real gift with a real cost. These should be argued about. */
B('PACT','glass','Glass Oath',         0.60,false,'+{p} damage dealt. You also take {p} more.'),
B('PACT','slowtank','Bulwark Oath',    0.50,false,'{p} less damage taken. You attack {p} slower.'),
B('PACT','onehero','Champion’s Oath',0,false,'The strongest hero on this road doubles its damage. Everyone else loses a third of theirs.',null,'multi'),
B('PACT','nomove','Rooted Oath',       0.45,false,'+{p} damage while standing still. You cannot advance.','a hold-position state'),
B('PACT','halfhp','Blood Oath',        0.75,false,'+{p} attack speed, and it never stops. Start every wave at half health.'),
B('PACT','nofirstaid','Ascetic Oath',  0.40,false,'+{p} to everything. You cannot be healed.'),
B('PACT','shortwave','Hasty Oath',     0,false,'Enemies arrive twice as fast. You also get a second boon at the next window.','tune the next offer'),
B('PACT','sacrifice','Kindled Oath',   0,false,'One hero of your choice falls now. The rest of the road fights at double strength.','remove a chosen unit','multi'),
B('PACT','allin','Reckless Oath',      0,false,'Your ultimate is ready immediately and costs nothing — once. You cannot cast it again this run.'),
B('PACT','lanetrade','Traded Oath',    0,false,'This road gets two boons this window. The road beside it gets none.','offer arbitration across lanes','otherRoad'),

/* -------------------------------------------------------------- ESCALATE ----
   It grows while the wave runs, and you watch it grow. */
B('ESCALATE','killstack','Relentless',   0.04,false,'+{p} attack speed for every enemy killed this wave. Resets each wave.'),
B('ESCALATE','hitstack','Drumbeat',      0.02,false,'+{p} damage for every attack you land this wave, up to ten.'),
B('ESCALATE','timestack','Slow Burn',    0.05,false,'+{p} damage for every 10 seconds the wave has lasted.'),
B('ESCALATE','hurtstack','Grudge',       0.03,false,'+{p} damage for every 10% health you are missing.'),
B('ESCALATE','castsstack','Rhythm',      0.06,false,'Each cast in a row without auto attacking adds {p} ability power. Resets on an auto.'),
B('ESCALATE','wavestack','Veteran',      0.12,false,'+{p} to everything for every wave this road has already cleared.'),
B('ESCALATE','alonestack','Last Stand',  0.20,false,'+{p} to everything for each ally on this road who has fallen.',null,'multi'),
B('ESCALATE','crowdstack','Warband',     0.08,false,'+{p} to everything for each ally still standing beside you.',null,'multi'),
B('ESCALATE','shieldstack','Accreting',45,true,'Every enemy killed leaves a {v} shield that does not expire.'),
B('ESCALATE','critstack','Sharpening',   0.05,false,'+{p} critical chance every time you fail to crit. Resets when you do.'),

/* ------------------------------------------------------------------ ROAD ----
   About where people stand, and about the firebreaks. */
B('ROAD','crosser','Wayfarer',        150,true,'A hero arriving from a firebreak lands with a {v} shield and a free cast.'),
B('ROAD','stayer','Rooted',          0.25,false,'A hero that has never crossed a firebreak takes {p} less damage.'),
B('ROAD','frontrunner','Spearhead',  0.35,false,'The hero furthest ahead on this road deals {p} more damage.',null,'multi'),
B('ROAD','rearguard','Rearguard',    0.35,false,'The hero furthest back on this road takes {p} less damage.',null,'multi'),
B('ROAD','lonewolf','Lone Wolf',     0.50,false,'If this road has exactly one hero, it fights at {p} more of everything.',null,'solo'),
B('ROAD','crowded','Shieldwall',     0.15,false,'+{p} damage reduction for every hero on this road beyond the first.',null,'multi'),
B('ROAD','neighbour','Good Neighbour',130,true,'Whenever the road beside you clears a wave, everyone here heals {v}.','cross-lane events','otherRoad'),
B('ROAD','envy','Envious',           0.30,false,'+{p} to everything while this road is the furthest behind.',null,'otherRoad'),
B('ROAD','pacer','Pacesetter',       0.30,false,'+{p} to everything while this road is the furthest ahead.',null,'otherRoad'),
B('ROAD','anchor','Anchor',          0,false,'This road cannot lose its last hero — that hero survives at 1 health until the wave ends.','a survival floor'),
B('ROAD','ferry','Ferryman',         0,false,'Heroes crossing a firebreak arrive instantly instead of running.','skip the crossing animation'),
B('ROAD','echo','Shared Fate',       0.20,false,'{p} of the healing anyone on this road receives is copied to everyone else.','copy heals across a lane','multi'),

/* ------------------------------------------------------------------ WAVE ----
   Changes how the wave ARRIVES, before a blow is struck. */
B('WAVE','arrivestun','Ambush',        0,false,'Every enemy in the next wave arrives stunned for 2 seconds.'),
B('WAVE','arriveburn','Scorched Earth',18,true,'Every enemy arrives already burning for {v} a second.'),
B('WAVE','arrivehalf','Softened',      0.25,false,'Every enemy in the next wave arrives at {p} less health.'),
B('WAVE','arriveslow','Bogged',        0,false,'Every enemy arrives at half speed for the first 5 seconds.'),
B('WAVE','fewer','Thinned',            0,false,'One enemy is removed from every remaining wave on this road.','drop a wave member'),
B('WAVE','arrivesplit','Divided',      0,false,'Enemies arrive one at a time instead of together.','stagger a wave’s arrival'),
B('WAVE','bossless','Unmarshalled',    0,false,'The heaviest enemy in each remaining wave loses its extra strength.','strip a wave multiplier'),
B('WAVE','preheal','Rested',           0,false,'Everyone on this road starts each wave at full health.'),
B('WAVE','prewarn','Foresight',        0,false,'You see every remaining wave on this road, not just the next.'),
B('WAVE','prefight','First Blood',     0,false,'The first hit of every wave is a guaranteed critical for everyone on this road.'),

/* ----------------------------------------------------------------- BREAK ----
   Phil, 17 Sep: "give the player something enjoyable outside of the normal games settings to play
   with."

   THIS IS THE FAMILY THAT EARNS THE MODE. A bonus stage is cleared once and never repeated for
   reward — so it is the one place in Emberweave where the game's own hard rules can come off without
   anything being farmed. Every entry below breaks a rule the player has lived under since their
   first fight, and each names the rule it breaks:

     TEAM_SIZE is 5, everywhere, forever      -> field a sixth, or a clone
     you never choose a target                -> choose one
     rows are decided by your role             -> put the archers in front
     summons expire                            -> they do not
     one ultimate, when the energy allows      -> two, now, free
     you fight with the heroes you own         -> fight with one you do not

   None of it leaves the run. That is the point: it is a toy, not a power curve. */
B('BREAK','sixth','Overstrength',    0,false,'This road may field ONE MORE hero than its cap allows. No road in this game has ever gone over.','field beyond TEAM_SIZE','room'),
B('BREAK','clone','Mirror',          0,false,'Your strongest hero on this road is duplicated for the rest of the run.','duplicate a unit','room'),
B('BREAK','aim','Hand of the Player',0,false,'For 10 seconds after every wave starts, YOU choose what your heroes attack.','player-driven targeting'),
B('BREAK','swaprow','Reversed Line', 0,false,'Melee heroes fight from the back and ranged from the front. Everything you know about rows is wrong for this run.','invert row assignment','mixedRows'),
/* PHIL KEPT THIS ONE AND GAVE IT A PRICE INSTEAD. 17 Sep 2026: "i like that everlasting honestly,
   keep that boon, but make it so that the summons never die, but they are only 50% the power" —
   and, asked which boon he meant, "that specific boon".
   So this is the ONE exception to his own wave-end purge: the pack walks through every window, for
   good, at half strength. An hour earlier I had rewritten this boon to bend to the purge. He would
   rather the boon bent the purge, which is his call to make and a better one — a BREAK boon that
   quietly obeys the rule it is supposed to break is not a BREAK boon.
   THE HALVING IS FLAT, not applied again at each window: halving five times leaves a boar at 6%,
   which is a countdown, not a boon. */
B('BREAK','eternalsummon','Everlasting',0.50,false,'Your summons never die — not to the timer, not with their summoner, not at the end of a wave. They fight at {p} power, forever.',null,'summoner'),
B('BREAK','twoults','Doubled Crown', 0,false,'Every hero may hold two ultimates at once.','a second ult charge'),
B('BREAK','freeult','Crowned',       0,false,'Every hero starts every wave with a full ultimate, free.'),
B('BREAK','borrow','Borrowed Blade', 0,false,'A hero you do NOT own joins this road for the rest of the run.','instance a hero outside the roster','room'),
B('BREAK','stealmob','Turncoat',     0,false,'The heaviest enemy of the next wave fights for you instead.','flip a unit\u2019s team'),
B('BREAK','kitswap','Improvised',    0,false,'Every hero on this road trades abilities with the hero beside them.','swap ability sets between units'),
B('BREAK','bullettime','Held Breath',0,false,'Time slows to a crawl whenever a hero on this road is one hit from death.','a local time scale'),
B('BREAK','doublespeed','Headlong',  0,false,'This road fights at double speed. So does everything on it.'),
B('BREAK','inherit','Inheritance',   0,false,'When a hero falls, every boon it was carrying passes to whoever is nearest.',null,'multi'),
B('BREAK','levelup','Ascendant',     10,false,'Every hero on this road fights {v} levels above their own. For this run only.','a temporary level override'),
B('BREAK','allboons','Glutton',      0,false,'Take ALL THREE boons offered at the next window instead of one.','multi-select at a window'),
B('BREAK','undo','Second Thoughts',  0,false,'You may redo the last window — its boons and its firebreak move — once.','rewind one window'),

/* ----------------------------------------------------------------- STATS ----
   Seven, not a hundred, and each one earns its place by being a number you would
   actually change your plan for. */
B('STAT','bighp','Ironhide',        260,true, '+{v} maximum health, and you heal that much now.'),
B('STAT','regen','Mending',         22, true, '+{v} health a second, forever.'),
B('STAT','energy','Focus',          14, true, '+{v} energy a second, forever.'),
B('STAT','lifesteal','Siphoning',   0.09,false,'{p} of all damage you deal comes back as health.'),
B('STAT','haste','Quickened',       0.30,false,'+{p} attack speed, and it never stops.'),
B('STAT','dr','Warded',             0.25,false,'{p} of incoming damage turned aside.'),
B('STAT','skill','Practised',       1,  false,'+{v} to every ability level.')
];

const FAMILIES = ['PROC','RULE','PACT','ESCALATE','ROAD','WAVE','BREAK','STAT'];

function catalogue(){ return CATALOGUE; }
function byFamily(f){ return CATALOGUE.filter(b=>b.fam===f); }

/* the number that appears in the blurb */
function magnitude(b, level){
  if(!b.scale) return b.v;
  return Math.max(1, Math.round(b.v*scaleFor(level)));
}
function describe(b, level){
  const m=magnitude(b, level);
  return b.name+' — '+b.text.split('{p}').join(Math.round(b.v*100)+'%').split('{v}').join(String(m));
}
function readyNow(){ return CATALOGUE.filter(b=>!b.needs); }
function needsEngine(){ return CATALOGUE.filter(b=>b.needs); }
function enginePieces(){
  const s=new Set(); for(const b of needsEngine()) s.add(b.needs); return [...s].sort();
}

module.exports = { CATALOGUE, FAMILIES, BOON_SCALE_PER_LEVEL, scaleFor,
  SUMMONER_KEYS, HEALER_KEYS, laneProfile, boonFits, fitsFor,
  catalogue, byFamily, magnitude, describe, readyNow, needsEngine, enginePieces };
