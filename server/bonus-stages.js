/* ============================================================================
   BONUS STAGES — 6 per chapter · THE GAUNTLET SPLIT · the idle fragment stream
   ----------------------------------------------------------------------------
   Phil, 16 Sep 2026, verbatim:
     "implement a bonus stage for every 6 buildings on every chapter ... the building
      itself being clickable to bring up the bonus stage hero select screen ... the
      rewards will be a big fragments reward, 1-2 of each fragment, after the stage is
      complete it cannot be repeated for any reward, only to finish 3 stars if they
      want, the bonus itself rewards random grey fragments per hour forever. it maxes
      at 36 hours saved. every bonus stage adds up ... bonus stage 1-1, 1-2 give 1 grey
      fragment per hour. stage 1-3 and 1-4 gives 2. stage 1-5 and 1-6 give 3. in the
      next chapters the fragments is adjusted to their fragment so 2-1 and 2-2 gives
      1 green ..."
     "make it 3 lanes, you must select up to 10 heroes, and choose the lane they walk,
      in order to win you must win atleast 2 lanes before you lose one ... 5 waves, and
      a boon buff between waves per lane ... after the boon buff you can swap heroes,
      the heroes that got swapped maintain the boon buff they got before swap."

   THIS FILE IS NOT ONE OF THE FIVE HELD FILES. It is Claude's to edit. server.js only
   requires it and hands it a request; every rule below lives here.

   WHY A MODULE AND NOT A PATCH INTO server.js: `Cowork/02 - CHANGE REQUESTS/00 - READ ME`
   — the point of the arrangement is that the held file is open for four minutes, not
   twenty. server.js takes a 2-line hunk; the subsystem lives here.
   ========================================================================== */
'use strict';

/* ---------------------------------------------------------------- the ladder */

/* WHICH FRAGMENT A CHAPTER'S BONUS STAGES PAY. Phil, 17 Sep 2026:
     "all chapters will be the current fragment quality offered for that chapter
      Chapter 1 gives grey, chapter 2 gives green ETC ETC all chapters"

   THE LADDER IS HIS TWO EXAMPLES CONTINUED, AND IT LANDS EXACTLY. There are sixteen quality bands and
   ten chapters, and walking the bands from Grey — one per chapter — gives Grey, Green for chapters 1
   and 2, which is what he said, and runs out at Purple +3 on chapter 10. **No guessing left in it:
   his own two rows generate the other eight.**

   This REPLACES the table Claude invented on 16 Sep (Grey, Green, Green +1, Blue +1, Blue +2, Purple,
   Purple +2, Purple +3, Gold, Gold +2), which was an "initial balance choice" flagged in `2310` §6.1
   and never his. It is gone.

   WHAT IT MEANS AGAINST WHAT EACH CHAPTER ACTUALLY DROPS, measured off campaign-encounters.json —
   this is the consequence, stated rather than discovered later:
     ch  pays        that chapter's most common drop
      1  Grey        Green
      2  Green       Blue
      3  Green +1    Blue +2
      4  Blue        Purple
      5  Blue +1     Purple +2
      6  Blue +2     Purple +3
      7  Purple      Gold +1
      8  Purple +1   Gold +2
      9  Purple +2   Gold +4
     10  Purple +3   Orange
   So the idle stream sits one to five bands under what the same chapter can be farmed for by hand,
   widening as the game goes on. That is the shape a "forever" trickle should have, and it is also the
   thing to look at first if late-game bonus income ever feels pointless. */
const QUALITY_LADDER = ['Grey','Green','Green +1','Blue','Blue +1','Blue +2',
                        'Purple','Purple +1','Purple +2','Purple +3',
                        'Gold','Gold +1','Gold +2','Gold +3','Gold +4','Orange'];
const CH_BONUS_TIER = (()=>{ const t={};
  for(let ch=1; ch<=10; ch++) t[ch]=QUALITY_LADDER[ch-1];
  return t; })();

/* WHERE THE SIX SIT, AND WHAT THEY ARE CALLED. Phil, 16 Sep 2026:
     "no the bonus stages wil be at 1-3, 1-4, 1-6, 1-7, 1-9, 1-10 ... it will continue like this for
      all chapters"
   So a bonus stage is named for its POSITION ON THE ROAD, not for a 1-6 index: chapter 1's six are
   Bonus 1-3, 1-4, 1-6, 1-7, 1-9 and 1-10. Two, skip one, two, skip one, two. The six sites in
   CH_BONUS_SITES keep their order — site 0 is 1-3, site 5 is 1-10. */
const BONUS_CODES = [3, 4, 6, 7, 9, 10];

/* Phil's rate ladder, per hour, keyed by the code above — the first pair pays 1, the second 2, the
   third 3. 1+1+2+2+3+3 = 12/hour once a chapter is fully cleared; all ten chapters = 120/hour. */
const SLOT_RATE  = { 3:1, 4:1, 6:2, 7:2, 9:3, 10:3 };

const CAP_HOURS  = 36;          // "it maxes at 36 hours saved"
const SLOTS      = 6;           // "6 buildings on every chapter"
const CHAPTERS   = 10;          // CH_BONUS_SITES carries exactly 10 chapters × 6 sites
const LANES      = 3;
const WAVES      = 5;
/* FOUR windows, one after each of waves 1-4. Phil, 17 Sep 2026: "five waves create FOUR firebreak
   checkpoints, one after each of waves 1-4. Each window is wave end -> select boon -> choose an
   adjacent lane; then next wave Start waits for the crossing animation. Wave 5 ends the run."
   Every window offers BOTH crossings (top<->middle and middle<->bottom), so nothing ever travels
   backwards. The one-firebreak-per-move rule is unchanged: a hero can reach the far road only by
   crossing at two separate windows. */
const WINDOWS    = WAVES - 1;
/* HOW MANY WALK. Phil, 17 Sep 2026: "I think a lane should be able to have 10 heroes in it max."
   So the cap he named is PER ROAD, not for the squad. Taken literally — three roads at ten each —
   the squad cap is thirty, and that is what is built.

   THE ONE THING TO CHECK WITH HIM: whether he wants a smaller squad BUDGET underneath the per-road
   ceiling. Ten in a road and thirty in a squad are the same rule only if there is no budget; with a
   budget of, say, fifteen, "ten in one road" becomes a real decision — stack one road and leave the
   other two on two and three. **That version is strictly more interesting and it is one constant.**
   Built to his words, flagged in `projects/11 - OPEN QUESTIONS FOR PHIL.md`, not guessed at silently. */
const MAX_PER_LANE = 10;                    // Phil's number
const MAX_HEROES   = 15;                    // Phil, 17 Sep 2026: "lock the ability to select a 16th hero" — the budget the comment above argued for
const MIN_PER_LANE = 1;         // an empty lane is a fallen lane — see rulesSettled()
const ATTEMPT_MS = 45 * 60 * 1000;
/* SECURITY, 17 Sep - a forged /api/bonus/resolve was found accepting a client-claimed
   lanesCleared=3/lanesLost=0 the instant after /api/bonus/start, with nothing server-side
   checking that any battle actually happened. Two independent, additive defenses:
     1. MIN_RESOLVE_MS - a wall-clock floor. Even at the fastest legitimate pace (three lanes
        fighting five waves of real-time combat, four boon windows, at minimum animation length)
        a genuine clear cannot happen in under this long. It is deliberately conservative - a
        FLOOR meant to catch an instant forge, not a target time - so it can never reject a real,
        if fast, player.
     2. Per-window evidence (/api/bonus/window below) - the client is required to report EACH of
        the four boon-window closes as they happen, server-stamped and sequence-checked. A result
        claiming a win must show all four window closes actually occurred; a forged instant
        resolve has none. This is real evidence of play, not just a clock. */
const MIN_RESOLVE_MS = 10 * 1000;
/* HONEST LIMIT, 17 Sep (caught in review, not by me): neither defense below is authoritative combat.
   A scripted client can still POST all four /api/bonus/window calls back-to-back and wait out
   MIN_RESOLVE_MS, then claim any outcome it likes — these checks stop the ONE forge that was found
   (an instant post-/start resolve with no elapsed time and no window evidence at all), they do not
   verify that reported lanesCleared/lanesLost actually happened. Real authoritative verification
   would mean the server simulating combat itself, which is out of scope for tonight and not claimed
   here. Both checks are gated on a claimed WIN ONLY (see resolve() below) — a reported LOSS is never
   held to either bar, since a genuine ally wipe can happen in seconds and pays no reward anyway. */

/* ------------------------------------------------------------------- the boons
   Phil, 17 Sep 2026: "the boon buffs should be really good ... the boon is randomized everytime.
   there should be over 100 boon types ... the buff scales to level ... each lane can choose between
   3 boon types that are randomized."

   ...and then, 17 Sep: "i dont want flat damage increase to be the standard" / "this is boring" /
   "give the player something enjoyable outside of the normal games settings to play with".

   THE FIRST CATALOGUE WAS A GRID AND IT IS GONE. 33 stats x 7 triggers produced 136 entries and not
   one of them changed how a fight PLAYED. The catalogue now lives in `server/bonus-boons.js` as 107
   HAND-AUTHORED boons in eight families — PROC, RULE, PACT, ESCALATE, ROAD, WAVE, **BREAK** and
   STAT — and flat stats are **seven of the hundred and seven**, not the backbone.

   BREAK is the family that earns the mode: a bonus stage is cleared once and never repeated for
   reward, so it is the one place in Emberweave where the game's own hard rules can come off without
   anything being farmed. Field a SIXTH hero when TEAM_SIZE has been 5 since the first fight. Choose
   your own target. Put the archers in front. Fight with a hero you do not own.

   `readyNow()` filters out anything the engine cannot do yet, so the mode never offers a dead
   option; `boonsNeedingEngine()` names what is missing rather than hiding it. */
const BOONS_LIB = (()=>{ try{ return require('./bonus-boons.js'); }catch(e){ return null; } })();
const BOON_OFFER_SIZE = 3;

/* Offer only what actually works today. When the seven mechanisms land, delete the filter. */
function boonPool(profile){
  if(!BOONS_LIB) return [];
  if(!profile) return BOONS_LIB.readyNow();
  return BOONS_LIB.readyNow().filter(b=>BOONS_LIB.boonFits(b, profile));
}
function boonCatalogueSize(){ return BOONS_LIB ? BOONS_LIB.catalogue().length : 0; }
function boonsNeedingEngine(){
  if(!BOONS_LIB) return [];
  const m=new Set();
  for(const b of BOONS_LIB.needsEngine()) for(const part of String(b.needs).split(' + ')) m.add(part);
  return [...m].sort();
}

/* ------------------------------------------------------------------ small tools */
function chOf(id){ return parseInt(String(id).split('-')[0],10)||0; }
function slotOf(id){ return parseInt(String(id).split('-')[1],10)||0; }
function validBonusId(id){ const c=chOf(id), s=slotOf(id);
  return c>=1 && c<=CHAPTERS && BONUS_CODES.indexOf(s)>=0 && String(id)===c+'-'+s; }
function bonusUnlockError(led,id){
  const need=(chOf(id)-1)*10+slotOf(id);
  const cleared=(led&&led.camp&&led.camp.cleared)|0;
  return cleared>=need ? null : 'Clear Normal '+id+' to unlock Bonus '+id+'.';
}
/* site index (0-5, the order in CH_BONUS_SITES) <-> the stage code on the road */
function codeForSite(i){ return BONUS_CODES[i]|0; }
function siteForCode(code){ return BONUS_CODES.indexOf(code|0); }
function bonusIdFor(ch, siteIndex){ return ch+'-'+BONUS_CODES[siteIndex]; }
function tierFor(ch){ return CH_BONUS_TIER[ch]||null; }

/* xorshift, same shape as server.js srvSeed consumers — deterministic, never Math.random */
function rng(seed){ let x=(seed>>>0)||0x9e3779b9;
  return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0); }; }

/* ------------------------------------------------------- glyph families by band
   Built once off the loaded GLYPHS (server/glyph-source.json, 218 rows, 16 quality
   bands). Ledger fragment key is `<quality> <family>` — verified against
   campaign-encounters.json ("Blue +1 Bastion" ↔ "blue-plus-1-bastion"). */
let FAMS = null;
function families(GLYPHS, quality){
  if(!FAMS){ FAMS={};
    const raw=(GLYPHS&&GLYPHS.raw)||[];
    for(const g of raw){ const q=g&&g.quality, f=g&&g.family; if(!q||!f) continue;
      (FAMS[q]||(FAMS[q]=[])); if(FAMS[q].indexOf(f)<0) FAMS[q].push(f); }
    for(const q of Object.keys(FAMS)) FAMS[q].sort();   // stable order = reproducible rolls
  }
  return FAMS[quality]||[];
}
function resetFamilyCache(){ FAMS=null; }   // for the harness

/* ------------------------------------------------------------------ the ledger */
/* led.bonus = { done:{ "1-3":{stars:2,at:ms} }, ts:<last claim ms>, att:null } */
function ensureBonus(led){
  const b = led.bonus || (led.bonus = { done:{}, ts:0, att:null });
  if(!b.done || typeof b.done!=='object' || Array.isArray(b.done)) b.done={};
  if(!(b.ts>0)) b.ts=Date.now();      // a player who has never claimed starts accruing NOW,
  return b;                            // never from the epoch — 36h would be waiting at unlock
}

/* fragments per hour, by quality band. "every bonus stage adds up" */
function ratesFor(bonus){
  const out={};
  for(const id of Object.keys(bonus.done||{})){
    if(!validBonusId(id)) continue;
    const q=tierFor(chOf(id)); if(!q) continue;
    out[q]=(out[q]|0)+(SLOT_RATE[slotOf(id)]|0);
  }
  return out;
}
function totalPerHour(bonus){ const r=ratesFor(bonus); let n=0; for(const k in r) n+=r[k]; return n; }

/* what is sitting in the pot right now — whole hours only, capped at 36 */
function pending(bonus, now){
  const rates=ratesFor(bonus);
  const elapsedH = Math.floor(Math.max(0, (now-(bonus.ts||now))) / 3600000);
  const hours = Math.min(CAP_HOURS, elapsedH);
  const per={}; let total=0;
  for(const q in rates){ const n=rates[q]*hours; if(n>0){ per[q]=n; total+=n; } }
  return { hours, capHours:CAP_HOURS, capped:elapsedH>=CAP_HOURS, perQuality:per, total, rates };
}

/* ------------------------------------------------------------------ the claim
   Rolls a RANDOM family inside each earned band — Phil: "random grey fragments per
   hour". Deterministic off the server seed, so a replay of the same claim pays the
   same thing and a client cannot reroll by retrying. */
function claimList(bonus, now, seed, GLYPHS){
  const p = pending(bonus, now);
  if(!p.total) return { list:[], pending:p };
  const next = rng(seed);
  const qty = {};
  for(const q of Object.keys(p.perQuality).sort()){
    const fam = families(GLYPHS, q);
    if(!fam.length) continue;                       // unknown band: pays nothing, never crashes
    for(let i=0;i<p.perQuality[q];i++){
      const key = q+' '+fam[next()%fam.length];
      qty[key]=(qty[key]||0)+1;
    }
  }
  return { list:Object.keys(qty).map(key=>({key, quantity:qty[key]})), pending:p };
}

/* Advancing the clock on a claim: move ts FORWARD by the hours paid, never to `now`.
   Paying 36 of 40 stored hours and then stamping `now` would burn the 4 hours the
   player was owed. Whole hours only, so the part-hour keeps ticking. */
function advanceClock(bonus, now, hoursPaid){
  bonus.ts = Math.min(now, (bonus.ts||now) + hoursPaid*3600000);
  return bonus.ts;
}

/* ============================================================== THE GAUNTLET SPLIT */

/* The waves are the chapter's OWN monsters — "real monsters", drawn from the campaign
   encounter table rather than invented here. 5 waves per lane, 3 lanes, and the pull
   is deterministic off (chapter, slot) so every player who opens Bonus 3-4 fights the
   same gauntlet. */
/* "the bonus is not meant to be cleared right away thats why its not in the tutorial, you go back
   later to do it" — Phil, 16 Sep 2026.
   So a bonus stage is NOT tuned to the stage it stands next to. It is tuned to the END of its own
   chapter and then past it: the authored recommendedPower of the chapter's LAST stage, times the
   margin below. Walk up to Bonus 1-3 on your way through chapter 1 and you lose; come back with the
   chapter behind you and a bench, and it is a fight. The number is AUTHORED DATA, not a guess —
   ch1 last stage is 1,011 power, ch10's is 35,130. */
const BONUS_POWER_MARGIN = 1.35;

/* THE ONE EXCEPTION, and it is the one the player meets first. Phil, 16 Sep 2026:
     "it might be a good idea to do the bonus stage as the last step of the tutorial after diamond
      wish, when you summon your 5s hero, and make the bonus stage really easy, like 1 monster per
      wave max"
   So Bonus 1-3 is a TEACHING stage, not a wall. One monster per lane per wave, no power pull, and
   the chapter's softest monsters. It exists to show the player three roads, a boon, a firebreak and
   the claim icon lighting up — with a brand-new 5-star hero in hand and nothing able to kill them.
   Every OTHER bonus stage is the come-back-later fight above. */
const TUTORIAL_BONUS = '1-3';
const TUTORIAL_MONSTER_LVL = 1;   // 17 Sep - matches a fresh account's level-1 starter heroes; see the note at buildLanes below
const TUTORIAL_MONSTER_MUL = 0.25;   // 17 Sep - overrides authored hpMul/dmgMul outright, see the note at buildLanes below; PROVED against a real 3-starter-hero browser playthrough, not just asserted
function isTutorialBonus(id){ return String(id)===TUTORIAL_BONUS; }

/* AND IT IS ON RAILS. Phil, 16 Sep 2026:
     "in the tutorials it will even tell you which heroes to place in which lane to make it fail
      proof, and even force them to select a pre determined boon/ wave switch for the first bonus
      round" ... "just to introduce the player to it"

   THE ONE THING THIS SCRIPT MUST NOT DO IS NAME A HERO. Phil's rule from the minigame design still
   holds — a bonus round never requires a specific hero — and at this moment in the tutorial the
   player's newest hero came out of a diamond wish, so nobody knows who it is. The script therefore
   places by RANK IN THEIR OWN ROSTER, resolved against whatever they actually own:
     rank 0 = their strongest, rank 1 = next, and so on.
   A player holding three heroes and a player holding nine both get a filled, winnable board. */
const TUTORIAL_SCRIPT = Object.freeze({
  /* "tell you which heroes to place in which lane" — by rank, never by name. The newest 5-star (their
     strongest, fresh from the wish) walks the middle, which is the road the firebreak step moves
     into, so the player watches their best hero do the thing being taught. */
  place: Object.freeze([
    Object.freeze({ lane:2, rank:0, say:'Your new 5★ takes the Middle Road.' }),
    Object.freeze({ lane:1, rank:1, say:'Your next strongest holds the Left Road.' }),
    Object.freeze({ lane:3, rank:2, say:'And this one holds the Right Road.' }),
    Object.freeze({ lane:1, rank:3, say:'Anyone else doubles up on the Left.' }),
    Object.freeze({ lane:3, rank:4, say:'And the Right.' })
  ]),
  /* "force them to select a pre determined boon" — the first offer, every road, no choice. Whichever
     boon sits at index 0 of that road's offer; the player is being shown WHAT a boon is, not asked
     to judge one. */
  boon: Object.freeze({ afterWave:1, index:0, lockOthers:true,
    say:'Take the boon. Every road gets one, between every wave.' }),
  /* "and even force them to ... wave switch" — one move across one firebreak, so the player's hands
     do it once. Lowest-ranked hero on the Left steps into the Middle.

     17 Sep, REAL CONFLICT FOUND, not yet in the client - `place` above puts exactly ONE hero on
     Lane 1 (rank 1) for a fresh 3-hero account (ranks 3 and 4 only exist at 4 and 5 owned heroes).
     MIN_PER_LANE=1 says "an empty lane is a fallen lane" (rulesSettled, checkSquadStrict). A plain
     ONE-WAY move of Lane 1's only hero into Lane 2 empties Lane 1 the instant it lands, and the very
     next tick's fallen-check (gsplitStep) would end the run for the exact account this stage exists
     to protect. "3-hero fail-proof" and "forced one-way move" cannot both be true at once - one of
     them has to give, and it is not going to be fail-proof.

     THE FIX IS THE EXCHANGE, NOT A HIGHER HERO FLOOR. Requiring 4 heroes before the tutorial's rails
     engage would contradict Phil's own words for this stage ("with three owned heroes able to
     start") and the fail-proof promise - so `exchangeIfEmpties` is the mechanism, not an escape
     hatch: if moving Lane 1's designated hero would leave Lane 1 with zero allies, the move becomes
     a two-way EXCHANGE in the same window - Lane 2's lowest-ranked hero crosses back into Lane 1 at
     the same time. Both roads keep exactly one hero, MIN_PER_LANE is never violated, and the player
     still performs one firebreak crossing (two, symmetric, for the 3-hero case - see
     tutorialSwapPlan below, which is the literal, tested arithmetic: `fromCount>1 ? 'move' :
     'exchange'`). PROVED against every real roster size in tests/test_bonus_stages.js. */
  swap: Object.freeze({ afterWave:1, from:1, to:2, which:'lowest', lockOthers:true, exchangeIfEmpties:true,
    say:'Now move one hero across the firebreak. The boons they hold go with them.' }),
  /* after the forced wave the rails come off and they finish it themselves */
  freeFromWave: 3
});
/* 17 Sep - the exact, tested arithmetic behind TUTORIAL_SCRIPT.swap's `exchangeIfEmpties`. Pure
   and stateless so it can be called from server code OR ported 1:1 into client code: given how many
   allies actually stand on the FROM and TO lanes right now, decide whether the forced firebreak
   crossing is a plain one-way move or a two-way exchange. Never returns a plan that empties either
   lane, for any real roster size (3 through MAX_PER_LANE heroes on a road). */
function tutorialSwapPlan(fromCount, toCount){
  if(fromCount <= 0) return { type:'none' };                 // nothing to move - should not happen post-place
  if(fromCount > 1) return { type:'move' };                  // FROM keeps at least one hero after the mover leaves
  if(toCount <= 0) return { type:'none' };                   // no partner to exchange with - should not happen
  return { type:'exchange' };                                // FROM has exactly one hero - trade with TO's lowest
}
function encList(CAMP_ENC){
  // 17 Sep: campCompile() in server.js builds CAMP_ENC as {byNode:{...}, fragSources:{...}} -
  // an object, never the raw array these three readers assumed. `for(const st of (CAMP_ENC||[]))`
  // against that shape throws "(CAMP_ENC||[]) is not iterable" the instant this module is mounted
  // for real. Accept either shape so a future compiler change doesn't repeat this.
  if(Array.isArray(CAMP_ENC)) return CAMP_ENC;
  if(CAMP_ENC && CAMP_ENC.byNode) return Object.values(CAMP_ENC.byNode);
  return [];
}
function chapterPowerRef(CAMP_ENC, ch){
  let last=0;
  for(const st of encList(CAMP_ENC)) if(((st.node-1)/10|0)+1===ch) last=Math.max(last, st.recommendedPower|0);
  return Math.round(last*BONUS_POWER_MARGIN);
}
function monsterPool(CAMP_ENC, ch){
  const pool=[]; const seen={};
  for(const st of encList(CAMP_ENC)){
    if(((st.node-1)/10|0)+1 !== ch) continue;
    for(const w of (st.waves||[])) for(const m of (w||[])){
      const k=m&&m.key; if(!k||seen[k]) continue;
      if(m.boss||m.isHero) continue;   // 17 Sep: the chapter boss and hero-cameo rows were leaking into
      seen[k]=1;                       // the random pool - a plain wave could roll the chapter boss by
      pool.push({ key:k, lvl:m.lvl|0, hpMul:+m.hpMul||1, dmgMul:+m.dmgMul||1 }); // accident. Neither belongs here.
    }
  }
  return pool;
}

/* The chapter's own boss, read off its boss-checkpoint stage in the encounter table - same source
   `CHAPTER_MAP_BOSS_KEYS` mirrors client-side, not a second guess at the key. Returns null if a
   chapter has no boss-flagged monster yet (shouldn't happen for 1-10, but a bad chapter shouldn't
   crash a bonus-stage build). */
function bossFor(CAMP_ENC, ch){
  for(const st of encList(CAMP_ENC)){
    if(((st.node-1)/10|0)+1 !== ch) continue;
    if(st.checkpoint!=='boss') continue;
    for(const w of (st.waves||[])) for(const m of (w||[])){
      if(m&&m.boss) return { key:m.key, lvl:m.lvl|0, hpMul:+m.hpMul||1, dmgMul:+m.dmgMul||1 };
    }
  }
  return null;
}

/* `slot` here is the STAGE CODE (3,4,6,7,9,10) — it is what makes each of the sixty gauntlets
   its own, and it is stable, so a player who opens Bonus 3-7 always fights the same gauntlet.
   Wave n of lane L: 3 monsters, scaling across the 5 waves. Lane 2 (the middle) runs
   ~8% hotter — it is the lane with a firebreak on BOTH sides, so it is the lane you
   can most easily reinforce. */
function buildLanes(CAMP_ENC, ch, slot){
  const pool = monsterPool(CAMP_ENC, ch);
  if(!pool.length) return null;
  const tut = isTutorialBonus(ch+'-'+slot);
  /* The teaching stage takes the WEAKEST monsters the chapter has, by the multipliers the encounter
     table already carries — chosen from the data, not softened by a number I picked. */
  const soft = pool.slice().sort((a,b)=>(a.hpMul*a.dmgMul)-(b.hpMul*b.dmgMul)).slice(0, Math.max(1, Math.ceil(pool.length/3)));
  const bag = tut ? soft : pool;
  const next = rng(((ch*97)^(slot*7919))>>>0);
  /* PHIL, 16 Sep, relayed via ChatGPT 19:56: "for each Bonus x-6, the middle lane must fight that
     chapter's boss." Read once, applied only on x-6, only lane 1 (middle), only the final wave -
     replacing the normal 4-monster wave-5 draw with exactly the one boss unit. Never falls back to
     a silent no-op: a chapter missing a boss entry just fights the normal wave-5 draw instead, so a
     data gap degrades gracefully rather than breaking the stage. */
  const boss = (slot===6) ? bossFor(CAMP_ENC, ch) : null;
  const lanes=[];
  for(let L=0;L<LANES;L++){
    const waves=[];
    for(let w=0;w<WAVES;w++){
      /* `pull` lifts the pool (drawn from the WHOLE chapter, so it averages the chapter's middle) up
         to the chapter's last stage plus the margin. This is the "come back later" in one number. */
      const pull = tut ? 1 : (1 + BONUS_POWER_MARGIN * 0.55);
      const grow = tut ? 1 : pull * (1 + w*0.14 + (siteForCode(slot))*0.06);   // later waves and later sites on the road bite harder
      const lane = tut ? 1.00 : ((L===1)?1.08:1.00);     // the teaching stage has no hot road either
      const bossWave = !!boss && L===1 && w===WAVES-1;
      if(bossWave){
        waves.push([{ key:boss.key, lvl:boss.lvl, hpMul:+(boss.hpMul*grow*lane).toFixed(4),
                       dmgMul:+(boss.dmgMul*grow*lane).toFixed(4), boss:true }]);
        continue;
      }
      const size = tut ? 1 : ((w===WAVES-1)?4:3);        // Phil: "1 monster per wave max". Wave 5 is otherwise the heavy one.
      const mob=[];
      for(let i=0;i<size;i++){ const m=bag[next()%bag.length];
        /* 17 Sep, real defect - `soft` filters monsters by hpMul*dmgMul (their multipliers) but
           never touches `m.lvl` (their AUTHORED encounter level), which the chapter's own data sets
           per-wave and NOT for the tutorial's benefit. Bonus 1-3's real server payload showed wave 1
           at lvl 1 but waves 2-5 at lvl 3, fought by level-1 starter heroes (vael/sylthaine/vireo) -
           a fresh account loses before the first boon, contradicting the tutorial's fail-proof
           contract. Clamped to TUTORIAL_MONSTER_LVL, the single-monster-per-road rule (`size`,
           above) is untouched - this narrows level only, not headcount. */
        const lvl = tut ? TUTORIAL_MONSTER_LVL : m.lvl;
        /* 17 Sep, SECOND real defect in the same proof run - the level clamp above was not enough.
           `soft` picks the chapter's weakest THIRD by hpMul*dmgMul, but "weakest in chapter 1" is not
           "weak" in absolute terms - the real authored data here (slime, Bonus 1-3) is hpMul=1.09,
           dmgMul=1.17, i.e. STRONGER than baseline, because chapter 1's own difficulty curve already
           climbs past 1x within the chapter. Fought one-hero-per-lane, with no reinforcement until
           the first boon and no healer support, that killed a fresh level-1 starter's lane before
           wave 2's window - proved three times running in a real headless-browser playthrough
           (tests/test_bonus_stages.js only unit-tests the DATA, not the actual fight, which is why
           this was still live after the level clamp shipped). TUTORIAL_MONSTER_MUL overrides the
           authored multiplier outright rather than scaling it - Phil's own words for this stage:
           "make the bonus stage really easy ... nothing able to kill them." */
        const hpMul = tut ? TUTORIAL_MONSTER_MUL : +(m.hpMul*grow*lane).toFixed(4);
        const dmgMul = tut ? TUTORIAL_MONSTER_MUL : +(m.dmgMul*grow*lane).toFixed(4);
        mob.push({ key:m.key, lvl, hpMul, dmgMul }); }
      waves.push(mob);
    }
    lanes.push(waves);
  }
  return lanes;
}

/* The three boons offered to one road after one wave.

   PHIL: "the boon is randomized everytime." So the draw is seeded off the ATTEMPT the server issued
   at /api/bonus/start — a fresh seed every run — and NOT off the stage. Two runs of Bonus 3-7 offer
   different boons, which is what he asked for. It is still fixed WITHIN a run, so a player cannot
   reroll an offer by restarting the app mid-fight; the anti-reroll property and "randomized every
   time" are not in conflict once the seed is per-run rather than per-stage.

   `level` is the hero level the magnitudes are scaled to — Phil: "the buff scales to level". */
/* PHIL, 17 Sep 2026: "make it so that when the 3 boons are offered, they can never be offered a boon
   that doesnt benefit atleast one of them, for instance everlasting can never be offered to a lane
   without a summon hero."

   So the draw is made from the boons that FIT THIS ROAD. `profile` is what `laneProfile()` says about
   the heroes standing on it — is anyone a summoner, a healer, an ability dealer; is it one hero or
   several; is there room under the ten-hero cap; is another road still walking.

   IF THE FILTER EVER LEFT FEWER THAN THREE, the window would offer a short row rather than a wrong
   one — but it cannot: the unrestricted boons alone are far more than three, and a probe asserts the
   smallest possible road still has a full pool. */
function boonOffer(runSeed, lane, wave, level, profile){
  const pool = boonPool(profile);
  if(!pool.length) return [];
  const next = rng(((runSeed>>>0) ^ (lane*7919) ^ (wave*104729))>>>0);
  const bag = pool.slice(), out = [];
  for(let i=0;i<BOON_OFFER_SIZE && bag.length;i++){
    const b = bag.splice(next()%bag.length,1)[0];
    out.push({ id:b.id, name:b.name, statId:b.statId, triggerId:b.triggerId,
               field:b.field, kind:b.kind,
               value: BOONS_LIB.magnitude(b, level|0),
               blurb: BOONS_LIB.describe(b, level|0) });
  }
  return out;
}

/* ------------------------------------------------------------------ the stars
   PHIL'S LADDER, 17 Sep 2026, in his own final wording. This REPLACES the one Claude invented
   (1★ win · 2★ all three lanes standing · 3★ no hero lost), which was never his:

     3★  win all three lanes
     2★  win two lanes with FEWER THAN 33% of SELECTED heroes dead
     1★  win two lanes with 33% OR MORE dead
     Winning only ONE lane is a LOSS.

   THE DENOMINATOR IS THE HEROES YOU SELECTED — not your roster, not the survivors. It is counted off
   the squad the SERVER recorded at /api/bonus/start, never from the client's report: the ladder is a
   fraction, and a forged client would otherwise choose its own denominator and make every run 2★.

   SUMMONS COUNT ON NEITHER SIDE. v328 fixed exactly this in the campaign — a Hurne squad whose boar
   expired could never three-star. The runner must keep `!u._summon && !u._wasSummon`.

   3★ IGNORES DEATHS ENTIRELY, exactly as he said it. All three lanes home with one survivor is 3★
   while a flawless two-lane win is 2★. That is a cliff and it is his: all three lanes is the hard
   thing and it is what the top mark is for. Executed, not improved (MASTER RULE 2).

   ON "33%": the comparison is `< 0.33` literally. For every reachable squad size this is identical
   to `< 1/3` — at 15 selected the boundary is 5 dead either way (0.33×15 = 4.95, 1/3×15 = 5.0), and
   at 10 it is 4 either way. There is no size at which the two spellings disagree, so nothing hangs
   on the choice.

   (An earlier relay of this ladder gave 1★ as "fewer than 66% heroes alive", which left 15-selected
   /10-alive — 33.3% dead, 66.7% alive — satisfying neither rung, and was non-monotonic besides.
   ChatGPT caught it, Phil settled it, and the wording above is the settled one. Kept in this comment
   so nobody re-derives the dead end.) */
const STAR_DEATH_LIMIT_2 = 0.33;   // "fewer than 33% hero deaths"

function starsFor(res){
  if(!res || !res.won) return 0;
  if((res.lanesCleared|0) >= LANES) return 3;          // all three lanes home
  if((res.lanesCleared|0) < 2) return 0;               // not a win at all; belt and braces
  const sent = Math.max(0, res.heroesSent|0);
  const lost = Math.max(0, Math.min(sent, res.heroesLost|0));
  if(!sent) return 1;                                  // nothing to measure: the floor
  return (lost / sent) < STAR_DEATH_LIMIT_2 ? 2 : 1;
}

/* what the result screen shows the player, so the ladder is never a mystery */
function starExplain(res){
  const sent=Math.max(1,res&&res.heroesSent|0), lost=Math.max(0,(res&&res.heroesLost|0));
  const pct=Math.round(lost/sent*100);
  const st=starsFor(res);
  if(!st) return 'Two roads must come home before one falls.';
  if(st===3) return 'All three roads came home.';
  if(st===2) return 'Two roads home, '+pct+'% of your heroes lost — under '+Math.round(STAR_DEATH_LIMIT_2*100)+'%.';
  return 'Two roads home, but '+pct+'% of your heroes fell.';
}

/* the one-time clear reward: "1-2 of each fragment" of the chapter's band */
function clearReward(ch, slot, seed, GLYPHS){
  const q = tierFor(ch); if(!q) return [];
  const fam = families(GLYPHS, q); if(!fam.length) return [];
  const next = rng(seed);
  return fam.map(f=>({ key:q+' '+f, quantity:1+(next()%2) }));
}

/* --------------------------------------------------------------- legality checks */
/* The tutorial is fail-proof by Phil's instruction, so its squad check is the loose one: a player
   who owns three heroes still gets a legal board. Everything else keeps the full rules. */
function checkSquad(assign, isUnlocked, id){
  if(isTutorialBonus(id)) return checkSquadTutorial(assign, isUnlocked);
  return checkSquadStrict(assign, isUnlocked); }
function checkSquadTutorial(assign, isUnlocked){
  const bad=checkSquadStrict(assign, isUnlocked);
  if(!bad) return null;
  return (bad.indexOf('is empty')>=0) ? null : bad;   // an unfilled road is forgiven HERE and nowhere else
}
function checkSquadStrict(assign, isUnlocked){
  if(!assign || typeof assign!=='object') return 'No squad was sent.';
  const seen={}; let total=0;
  for(let L=1;L<=LANES;L++){
    const arr=assign[L]||assign[String(L)]||[];
    if(!Array.isArray(arr)) return 'Lane '+L+' is not a list of heroes.';
    if(arr.length<MIN_PER_LANE) return 'Lane '+L+' is empty — every lane walks.';
    if(arr.length>MAX_PER_LANE) return 'At most '+MAX_PER_LANE+' heroes on one road.';
    for(const k of arr){
      const key=String(k);
      if(seen[key]) return 'A hero cannot walk two lanes.';
      if(isUnlocked && !isUnlocked(key)) return 'You do not own '+key+'.';
      seen[key]=1; total++;
    }
  }
  if(total>MAX_HEROES) return 'At most '+MAX_HEROES+' heroes.';
  return null;
}

/* THE FIREBREAKS ARE ADJACENT ONLY. Phil, 16 Sep 2026:
     "heroes between breaks cannot skip a lane, it means top lane can go mid, and mid can go bottom,
      but bottom can never go top and top never bottom, they can only jump 1 lane over"
   Lane 1 <-> 2 and lane 2 <-> 3. NEVER 1 <-> 3. There is no firebreak between the outer roads — the
   middle road IS the crossing.
   THE CONSEQUENCE, AND IT IS A REAL ONE: if the middle road falls, the two outer roads are cut off
   from each other for the rest of the run. Nothing here softens that; it is what the rule says. */
function laneMoveOK(from, to){
  from=from|0; to=to|0;
  if(from===to) return false;
  if(from<1||from>LANES||to<1||to>LANES) return false;
  return Math.abs(from-to)===1;
}
/* the roads a hero standing in `from` may cross to */
function lanesReachableFrom(from){
  const out=[]; for(let L=1;L<=LANES;L++) if(laneMoveOK(from,L)) out.push(L);
  return out;
}

/* THE CROSSING IS WATCHED, NOT PAID FOR. Phil, via ChatGPT, 16 Sep 2026:
     "distance between lanes is not a timed cost. A swapped hero visibly runs to the adjacent lane;
      the next wave stays paused, and Start cannot be pressed until every moving hero arrives."
   So moving costs NOTHING in game terms — it is not tempo, not a turn, not a penalty. It is an
   animation the player watches finish. This overturns settled rule 6 ("swapping costs nothing and
   happens only between waves") only in that the second half is now Phil's word rather than mine, and
   it adds a hard gate: the run cannot advance while anyone is still crossing. */
/* HOW BIG EVERYTHING IS ON THE LANE BOARD. Phil, 17 Sep 2026: "the heroes, monsters, effects,
   bosses, will need to be the downsized to the size of the map."

   NOTHING IS REMADE. Unit size in this engine is already pure data —
     height(world) = ROLE_BATTLE_H[role] * (r/18) * (HERO_BATTLE_SCALE[key] || 1)
   (client line 2192-2198) — so ONE multiplier resizes every hero, monster, boss and, because effects
   are parented to the unit, every effect with them. The sprite sheets are not touched, which is
   MASTER RULE 23 satisfied by construction; and a 2K source drawn smaller loses nothing, which is
   RULE 22 satisfied too. Remaking art for this would be work with no product.

   PHIL, 17 Sep 2026: "the heros need to be half this size, and you need to be able to pinch to
   zoom in". Both halves of that sentence matter, and the second one is why the first is safe.

   WAS 0.80. The 0.80 was measured against the live HUD and the measurements were right:
     - a Tank on the TOP road at scale 1.0 puts its health bar at viewport y 0.088, and #topStatus
       (the ally / wave / enemy tags) occupies 0.021-0.082. Two pixels. At 0.80 the bar sat at 0.118,
       which is 14 px of daylight.
     - lane-to-lane at 0.80: a middle-road Tank's head cleared the top road by 39 px, a bottom-road
       Tank cleared the middle by 43 px.
   Every one of those clearances gets BETTER at 0.40, so nothing that 0.80 was protecting is at risk.

   WHAT 0.80 ALSO CARRIED, and this is the part Phil overruled: a floor. The old comment here said
   "below 0.75 the heroes stop reading at phone size, so this is a floor as well as a ceiling." That
   floor assumed the player is stuck at one magnification. **They are not, and were not when I wrote
   it** — `ZOOM_LEVELS` and `setBattleZoom` (client 4161-4195) have given every fight wheel-zoom and
   two-finger pinch with drag-pan since v586. The floor was reasoning about a constraint the engine
   does not have. Phil's instruction retires it.

   WHY HALF AND NOT SOME OTHER NUMBER: it is Phil's number, given directly, and it is the one thing
   here that is not measured. What IS measured is that it costs nothing structurally - see the
   formations below, which change SHAPE at 0.40 and get roomier, not tighter.

   WHAT THIS DOES NOT FIX BY ITSELF. `setBattleZoom` clamps to `Math.min(1.5, z)` and `ZOOM_LEVELS`
   is `[1, 1.25, 1.5]`. Heroes at half size inside a 1.5x ceiling means the closest look available is
   0.6 of what the player sees today. **The ceiling has to come up with the scale, and that is a
   client change, so it is a change request, not this file.** Filed - see the Cowork change request
   folder. Until it lands, this number and that ceiling disagree, and the mode will look too small.

   NOTHING IS REMADE. Unit size is pure data - height(world) = ROLE_BATTLE_H[role] * (r/18) *
   (HERO_BATTLE_SCALE[key] || 1), client 2192-2198 - so one multiplier resizes every hero, monster and
   boss. MASTER RULE 23 is satisfied by construction and RULE 22 by the fact that a 2K source drawn
   smaller loses nothing.

   ⛔ A CLAIM THAT WAS HERE AND WAS WRONG, corrected 17 Sep after Phil asked "make sure the spell
   effects are being downsized also the same way heroes are".
   This comment used to read "...and, because effects are parented to the unit, every effect with
   them." **Spell effects are NOT parented to the unit.** `spawnGroundFx(key,cx,cy,radius,life)`
   (client 6506) sizes its plate from `radius*SC` and the global `const FX_SIZE=2` (5076), adds the
   mesh to the SCENE at world coordinates, and never looks at the caster's scale. Shrinking the units
   leaves every plate, nova, beam and zone at full size.

   So `BONUS_UNIT_SCALE` alone gives half-size heroes standing inside full-size spells. Phil saw that
   before it was rendered. The fix is a separate change request - see the FX scaling section there -
   and it is NOT one multiplier, because the visual size and the DAMAGE radius are two different
   fields (`gfx`/`gfxR` vs `radius` in the kit tables) and only one of them is cosmetic.

   THE LESSON: "because X is parented to Y" was a plausible sentence about an engine I had not checked
   at that point. It sat in this file as if it were measured. Every other number in this comment block
   was measured; that one was assumed, and it read exactly the same. */
const BONUS_UNIT_SCALE = 0.28;      // Phil, 18 Sep 2026: "Heroes are still too large they take up the whole road" (was 0.40, his half of the measured 0.80)

/* THE ZOOM CEILING THIS SCALE REQUIRES, recorded here so the two cannot drift apart unnoticed.
   The client's `ZOOM_LEVELS=[1,1.25,1.5]` and `setBattleZoom`'s `Math.min(1.5, z)` are the live
   values TODAY; this is what they must become for Phil's half-size heroes to be inspectable. The
   test asserts BONUS_UNIT_SCALE * BONUS_ZOOM_CEILING >= 0.80, i.e. that a player who pinches all the
   way in sees a hero at least as large as the previous flat size. 0.40 x 2 = 0.80 exactly, so 2.0 is
   the floor of the ceiling; the change request asks for 2.5 so there is somewhere to go past parity.
   THIS CONSTANT DOES NOT CHANGE THE CLIENT. It is the number the change request carries. */
const BONUS_ZOOM_CEILING = 4;      // Phil, 18 Sep 2026: "I want to be able to zoom in further" (was 2.5). 0.28 x 4 = 1.12 >= 0.80
const BONUS_ZOOM_LEVELS = Object.freeze([1, 1.25, 1.5, 2, 2.5, 3, 4]);

/* CAN TEN ACTUALLY STAND ON ONE ROAD? Measured, not assumed, because "ten per road" is a layout
   claim before it is a rule.

   A hero at 0.80 scale is ~1.76 world units at the shoulders and ~1.20 deep. Each road's world DEPTH
   comes from the perspective bands in `14a` — and here is the part that is not obvious: the NEAR road
   is the WIDEST painted (+/-0.111 of image height) and the SHALLOWEST in the world (2.46 units),
   because perspective stretches near ground across more pixels. So the roads hold different numbers
   of ranks, and ten heroes make a different SHAPE on each:

     road     world depth   ranks   ten form        march length / usable
     top        4.72          3     4 wide x 3       7.0 of 35.7
     middle     3.32          2     5 wide x 2       8.8 of 30.0
     bottom     2.46          2     5 wide x 2       8.8 of 25.8

   Ten fits on every road with room to spare. **The differing shape is the perspective doing it, not a
   choice**, and it is worth knowing before anyone reports it as a bug.

   ONE THING THAT DOES NOT WORK, so nobody tries it: ten in a SINGLE RANK is 17.6 units against 25.8
   usable on the near road, which leaves almost nothing between the muster and the monsters. Ten
   heroes have to form ranks. Widening the field does not rescue a single rank either — the camera's
   usable width is the ceiling, not `FW`. */
const BONUS_HERO_FOOTPRINT = Object.freeze({ width:2.2*BONUS_UNIT_SCALE, depth:1.5*BONUS_UNIT_SCALE });
/* FITTED TO THE APPROVED CHAPTER 1 ART, 17 Sep 2026. The art does not move; the renderer does.

   Phil approved the six Chapter 1 paintings ("chapter 1 done") and they are locked by SHA-256 in
   `projects/14 - GAUNTLET SPLIT LANE ART CONTRACT.md`. Their roads are NOT at the y 0.28 / 0.50 /
   0.72 that `14a` assumed - across all six, measured independently, they sit at:

       top    0.2087  (spread 0.010 across six paintings)
       middle 0.4507  (spread 0.004)
       bottom 0.7305  (spread 0.010)

   That is a remarkably tight set - four thousandths of variation on the middle road across six
   separate paintings - so the art is consistent and it is the renderer's assumption that was off.
   Inverting the projection for those three image fractions gives the lane depths below.

   BONUS_LANE_Z is what the renderer stands units on. BONUS_ROAD_DEPTH is the world ground each
   painted band actually covers, derived from the measured half-bands (0.0447 / 0.0456 / 0.0493),
   not chosen.

   A CORRECTION I OWE: I previously told ChatGPT these bands were 1.4x to 2.7x too narrow. That was
   computed against a 5-world-unit road, a target I picked while units were at scale 0.80. At Phil's
   0.40 a hero is 0.6 deep, and ten fit on every road with the bands exactly as painted:
       top     4.37 deep -> 7 ranks -> 2 wide x 7, march 1.76 of 52.8 usable
       middle  2.98      -> 4 ranks -> 3 wide x 4, march 2.64 of 43.2
       bottom  2.19      -> 3 ranks -> 4 wide x 3, march 3.52 of 35.6
   The bands were never the problem. The measurement was against the wrong target. */
const BONUS_LANE_Z = Object.freeze({ top:-11.887, middle:-2.222, bottom:5.317 });
const BONUS_LANE_IMG_Y = Object.freeze({ top:0.2087, middle:0.4507, bottom:0.7305 });
const BONUS_ROAD_DEPTH = Object.freeze({ top:4.37, middle:2.98, bottom:2.19 });

/* THE FOUR FIREBREAK STATIONS, MEASURED OFF THE APPROVED ART, 17 Sep 2026.

   The art contract drafted these as four stations at x = 0.29 / 0.39 / 0.49 / 0.59 with the upper
   path at station-0.018 and the lower at station+0.018. **The approved paintings do not do that, and
   they are consistent about not doing it.** Detecting the low-foliage columns inside each divider
   across five of the six paintings (1-9's amber palette defeats the detector, as it defeats the
   road detector) gives the same four openings every time, to within 0.002:

       upper divider (top<->middle)    0.320   0.443   0.572   0.673
       lower divider (middle<->bottom) 0.300   0.421   0.528   0.645

   TWO DIFFERENCES FROM THE DRAFT, BOTH REAL:
     1. The stations are further right and further apart than 0.29/0.39/0.49/0.59.
     2. **The stagger is REVERSED.** The draft put the upper path LEFT of the lower; every approved
        painting puts it RIGHT. The rule the stagger exists to serve - no straight top-to-bottom
        shortcut - is satisfied either way, so the art is not wrong. The renderer was.

   So the renderer moves to the paint. These are the coordinates it draws at, and any future map must
   be painted to them rather than measured after the fact. */
const BONUS_CROSSING_X = Object.freeze({
  upper: Object.freeze([0.320, 0.443, 0.572, 0.673]),   // top <-> middle
  lower: Object.freeze([0.300, 0.421, 0.528, 0.645])    // middle <-> bottom
});
/* v587 (Phil, 18 Sep: heroes "take up the whole road"): the formation uses the middle 60% of a road's depth,
   not all of it - ranks were derived from the full depth, so a road's worth of heroes filled it edge to edge.
   The client's gsplitRanks() uses the same factor (GSPLIT_ROAD_USE). */
const BONUS_ROAD_USE = 0.6;
function ranksFor(road){
  const d=BONUS_ROAD_DEPTH[road]; if(!d) return 1;
  return Math.max(1, Math.floor(d*BONUS_ROAD_USE/BONUS_HERO_FOOTPRINT.depth));
}
function formationFor(road, n){
  const ranks=ranksFor(road), cols=Math.ceil(Math.max(1,n|0)/ranks);
  return { ranks, cols, marchLength:+(cols*BONUS_HERO_FOOTPRINT.width).toFixed(2) };
}

/* What the renderer must keep clear, measured off the live CSS — NOT off the art contract, which
   reserves y 0.88-1 for a HUD that actually starts at y 0.736.
     #battleCtrls  y 0.000-0.200, x 0.857-1.000   (corner only: speed + auto, 2 x 32 px)
     #topStatus    y 0.021-0.082, x 0.083 ->      (full width in practice)
     #hud          y 0.736-1.000, full width      (gradient)
     #portraitBar  y 0.751-0.969, x 0.553-0.994   (five 60x85 tiles, bottom-right)
   THE PORTRAIT BAR IS THE PROBLEM AND IT IS NOT A SIZING ONE: it shows five ally tiles, and this
   mode fields up to fifteen across three roads. It is the wrong HUD for the mode, it sits on the
   bottom road's lower band, and suppressing it is what makes the contract's 0.88 reserve true. */
const BONUS_HUD_KEEPOUT = Object.freeze({
  top:    Object.freeze({ y0:0.000, y1:0.082, note:'#topStatus — the ally/wave/enemy tags' }),
  topRight:Object.freeze({ y0:0.000, y1:0.200, x0:0.857, note:'#battleCtrls — speed + auto' }),
  bottom: Object.freeze({ y0:0.736, y1:1.000, note:'#hud — suppress #portraitBar in this mode' }),
  unitMaxX: 0.82,   // a 44 px health bar at x>0.82 runs under #battleCtrls
  suppressPortraitBar: true
});

/* SUMMONS DO NOT SURVIVE A WINDOW. Phil, 17 Sep 2026:
     "when a wave is over, heroes that make summons, their summons need to die automatically before
      the boon prompt. this mechanic should only be in bonus stages, do not allow this to effect any
      other mode"

   THE WHOLE MECHANIC IS ONE LINE, and it reuses the engine's own function rather than rewriting it:

     units.forEach(u=>{ if(u._summon) killSummon(u); });      // killSummon, client 4710

   HOW THE "NO OTHER MODE" HALF IS GUARANTEED — and it is not a flag. The purge lives in the BONUS
   RUNNER, called at wave end before the window opens. Nothing but a bonus run calls the bonus runner,
   so there is no `if(mode==='bonus')` anywhere for a later change to widen, and no shared line in
   `updateBattle` or `startNextWave` that can regress. **The scoping is structural.** Proved in
   `tests/test_summon_scope.js`, which asserts both halves against the real engine: no summon alive
   after the purge, and `startNextWave` — campaign, vault, every mode — still contains no purge at all.

   THE TRAP IT AVOIDS, which is already a scar in this codebase: a purged summon must NOT count as a
   hero death. `v328` fixed exactly that in the campaign — a Hurne squad whose boar expired could
   never three-star — and the star ladder here is a fraction, so four purges a run would cost a star
   every time. The counter is squad-only (`!u._summon && !u._wasSummon`) and a probe holds it.

   ONE CONSEQUENCE WORTH KNOWING, not an objection: a summoner rebuilds its pack from nothing at every
   one of the four windows. That is the point — without it, summons bank across windows and a summoner
   snowballs — but it does land on one kind of hero harder than the rest.

   THE ONE EXCEPTION, and it is Phil's own. 17 Sep: "i like that everlasting honestly, keep that boon,
   but make it so that the summons never die, but they are only 50% the power." So the BREAK boon
   **Everlasting** survives the purge instead of bending to it — a summon carrying it walks through
   every window, permanently, at **half a normal summon's strength**.

   THE HALVING IS FLAT, NOT COMPOUNDING. "50% the power" is a state the summon is in, not a tax it
   pays at each window. Halving again at every wave end would leave a boar at 6% by wave five, which
   is not a boon, it is a countdown. It applies to summons made AFTER the boon too — while you hold
   Everlasting, your pack is permanent and it is half strength. */
const EVERLASTING_SUMMON_POWER = 0.50;      // Phil's number
const EVERLASTING_FLAG = '_boonEverlasting';

const SUMMONS_DIE_AT_WAVE_END = Object.freeze({
  when:'wave end, before the boon window opens',
  how:'the bonus runner calls the engine\'s own killSummon() on every _summon unit that is not flagged '+EVERLASTING_FLAG,
  scope:'bonus stages only — structural, because only the bonus runner calls it',
  countsAsHeroDeath:false,     // v328
  exception:'the BREAK boon Everlasting — those summons live on, permanently, at '
            +(EVERLASTING_SUMMON_POWER*100)+'% of a normal summon\'s power',
  exceptionCompounds:false     // flat, not halved again at every window
});

const CROSSING_GATE = Object.freeze({
  costsTempo:false, costsTurn:false, costsHealth:false,
  blocksStart:true,
  note:'Start is refused while any hero is mid-crossing. The cost is the watching, not a number.'
});

/* A swap between waves may never empty a lane. Phil's win rule counts LANES, so a
   lane you emptied would be a lane you forfeited by a UI slip. */
function checkSwap(assign, prevAssign){
  for(let L=1;L<=LANES;L++){
    const arr=assign[L]||assign[String(L)]||[];
    if(!Array.isArray(arr) || arr.length<MIN_PER_LANE) return 'A lane cannot be left empty.';
    if(arr.length>MAX_PER_LANE) return 'At most '+MAX_PER_LANE+' heroes on one road.';
  }
  /* If the board BEFORE the swap is supplied, every hero that moved must have moved ONE road over. */
  if(prevAssign){
    const was={}; for(let L=1;L<=LANES;L++) for(const k of (prevAssign[L]||prevAssign[String(L)]||[])) was[String(k)]=L;
    for(let L=1;L<=LANES;L++) for(const k of (assign[L]||assign[String(L)]||[])){
      const from=was[String(k)];
      if(from && from!==L && !laneMoveOK(from,L))
        return 'A hero can only cross to the road beside it — the outer roads do not touch.';
    }
  }
  return null;
}

/* ================================================================= route handler
   Returns { status, body } for anything it owns, or null if the path is not ours.
   ctx (supplied by server.js, all of it already exists there):
     me, led, body(), query (url.searchParams), glyphGrantNamedList, srvSeed, ledTx,
     ledgerView, writeDB, GLYPHS, CAMP_ENC, isUnlocked(key), uid()
   ------------------------------------------------------------------------------- */
/* The road's profile, built from the heroes on it and whatever the host can tell us about them.
   `ctx.hero(key)` is optional — without it the roster tests simply come back false, which errs
   towards offering fewer boons rather than a wrong one. */
function laneProfileFor(ctx, assign, laneNo){
  if(!BOONS_LIB) return null;
  const keys=(assign&&(assign[laneNo]||assign[String(laneNo)]))||[];
  return BOONS_LIB.laneProfile(keys, ctx&&ctx.hero, {
    room: keys.length < MAX_PER_LANE,
    otherRoad: LANES > 1
  });
}

async function handle(p, method, ctx){
  if(p.indexOf('/api/bonus/')!==0) return null;
  const now = Date.now();
  const led = ctx.led, b = ensureBonus(led);

  /* ---- what the campaign map and the bottom-left icon read ---- */
  if(p==='/api/bonus/state' && method==='GET'){
    return { status:200, body:{ ok:true,
      done:b.done, tiers:CH_BONUS_TIER, slotRate:SLOT_RATE,
      perHour:totalPerHour(b), claim:pending(b, now), serverNow:now } };
  }

  /* ---- the bottom-left "Bonus stage rewards" icon ---- */
  if(p==='/api/bonus/claim' && method==='POST'){
    const body = await ctx.body();
    const reqId = String(body.requestId||'').slice(0,48);
    if(!reqId) return { status:400, body:{ok:false,error:'requestId required'} };
    const seed = ctx.srvSeed('bonusclaim', ctx.me.id, reqId, String(b.ts||0));
    const { list, pending:pd } = claimList(b, now, seed, ctx.GLYPHS);
    if(!pd.hours) return { status:400, body:{ok:false, error:'Nothing has accrued yet.', claim:pd} };
    if(!list.length) return { status:400, body:{ok:false, error:'No bonus stages cleared yet.', claim:pd} };
    const receipt = ctx.glyphGrantNamedList(ctx.me, list) || [];
    advanceClock(b, now, pd.hours);
    ctx.ledTx(ctx.me, 'bonus:claim', { hours:pd.hours, fragments:pd.total });
    ctx.writeDB();
    return { status:200, body:{ ok:true, granted:receipt, hours:pd.hours,
      claim:pending(b, now), ledger:ctx.ledgerView(ctx.me) } };
  }

  /* ---- opening a bonus stage: the hero-select screen's data ---- */
  if(p==='/api/bonus/stage' && method==='GET'){
    const id = String((ctx.query&&ctx.query.get&&ctx.query.get('id'))||'');   // url.searchParams, as every other GET route here reads it
    if(!validBonusId(id)) return { status:400, body:{ok:false,error:'Unknown bonus stage.'} };
    const locked=bonusUnlockError(led,id);
    if(locked) return { status:403, body:{ok:false,locked:true,error:locked} };
    const ch=chOf(id), slot=slotOf(id);
    const lanes = buildLanes(ctx.CAMP_ENC, ch, slot);
    if(!lanes) return { status:400, body:{ok:false,error:'Chapter encounters unavailable.'} };
    const rec = b.done[id]||null;
    return { status:200, body:{ ok:true, id, chapter:ch, slot,
      tier:tierFor(ch), perHour:SLOT_RATE[slot],
      recommendedPower:isTutorialBonus(id)?0:chapterPowerRef(ctx.CAMP_ENC, ch),
      tutorial:isTutorialBonus(id),
      script:isTutorialBonus(id)?TUTORIAL_SCRIPT:null,
      comeBackLater:!isTutorialBonus(id),   // Phil: every other one is not a stage you clear on the way past

      lanes, waves:WAVES, windows:WINDOWS, laneCount:LANES, maxHeroes:MAX_HEROES, maxPerLane:MAX_PER_LANE,
      boonCatalogue:boonCatalogueSize(), boonOfferSize:BOON_OFFER_SIZE,
      cleared:!!rec, stars:rec?(rec.stars|0):0,
      paysReward:!rec,                         // "after the stage is complete it cannot be repeated for any reward"
      previewReward: rec?null:clearReward(ch, slot, ctx.srvSeed('bonusclear', ctx.me.id, id), ctx.GLYPHS) } };
  }

  /* ---- sending the squad in ---- */
  if(p==='/api/bonus/start' && method==='POST'){
    const body = await ctx.body();
    const id = String(body.id||'');
    if(!validBonusId(id)) return { status:400, body:{ok:false,error:'Unknown bonus stage.'} };
    const locked=bonusUnlockError(led,id);
    if(locked) return { status:403, body:{ok:false,locked:true,error:locked} };
    const bad = checkSquad(body.assign, ctx.isUnlocked, id);
    if(bad) return { status:400, body:{ok:false,error:bad} };
    const ch=chOf(id), slot=slotOf(id);
    const lanes = buildLanes(ctx.CAMP_ENC, ch, slot);
    if(!lanes) return { status:400, body:{ok:false,error:'Chapter encounters unavailable.'} };
    /* the level the boons scale to: the player's own level, which is what "scales to level" means
       from where they are standing. Falls back to 1 rather than guessing. */
    const lvl = Math.max(1, (ctx.playerLevel && ctx.playerLevel()) || (led.lvl|0) || 1);
    b.att = { id:ctx.uid(), stage:id, startedAt:now, level:lvl,
              assign:JSON.parse(JSON.stringify(body.assign)),
              seed:ctx.srvSeed('bonusrun', ctx.me.id, id, String(now)),
              windowsSeen:0 };   // SECURITY 17 Sep - real per-window evidence, see MIN_RESOLVE_MS above
    ctx.writeDB();
    return { status:200, body:{ ok:true, attemptId:b.att.id, id, lanes,
      windows:WINDOWS,
      /* Seeded off THIS RUN, not the stage — Phil: "the boon is randomized everytime". */
      /* one profile per road, from the heroes actually assigned to it — Phil: a boon is never offered
         to a road it does nothing for. */
      boonOffers:Array.from({length:WINDOWS},(_,i)=>[0,1,2].map(L=>
        boonOffer(b.att.seed, L, i+1, lvl, laneProfileFor(ctx, body.assign, L+1)))),   // after waves 1-4
      boonLevel:lvl,
      waves:WAVES, laneCount:LANES } };
  }

  /* ---- SECURITY 17 Sep: raises the bar against the forge that was actually found (an instant
     post-/start resolve with zero elapsed time and zero evidence). The client calls this from
     gsplitCloseWindow, once per window, in order, server-stamped and sequence-checked. THIS IS NOT
     AUTHORITATIVE COMBAT VERIFICATION - a scripted client can still call this four times and then
     claim any outcome - it only proves the client reached four checkpoints, not that it fought
     honestly at any of them. See the honest limit note at MIN_RESOLVE_MS above. ---- */
  if(p==='/api/bonus/window' && method==='POST'){
    const body = await ctx.body();
    const a = b.att;
    if(!a || a.id !== String(body.attemptId||'')) return { status:400, body:{ok:false,error:'No matching bonus run.'} };
    const idx = body.windowIndex|0;
    /* 17 Sep, caught in review (not by me): this route was rejecting a RETRY of an index it had
       already booked, with the same 400 "out of sequence" as a genuinely bad index. If the client's
       original POST for window 1 was booked server-side (a.windowsSeen went to 1) but its ACK never
       reached the client - a dropped response, not a dropped request - gsplitResendMissingWindows
       would keep re-sending windowIndex:1 forever, and it could NEVER succeed, permanently blocking
       a real win's resolve behind "missing window evidence" that the server actually already has.
       Idempotent now: an index at or before what is already booked (idx <= windowsSeen) is an ACK
       for a request the server already has record of, not a new booking - it succeeds without
       mutating state further. Only a genuinely future/out-of-order index (skipping ahead, or arriving
       before its turn) is still refused. */
    if(idx >= 1 && idx <= (a.windowsSeen|0)){
      return { status:200, body:{ok:true, windowsSeen:a.windowsSeen, alreadyBooked:true} };
    }
    const expect = (a.windowsSeen|0) + 1;
    if(idx !== expect || expect > WINDOWS) return { status:400, body:{ok:false,error:'Window out of sequence.'} };
    a.windowsSeen = expect;
    ctx.writeDB();
    return { status:200, body:{ok:true, windowsSeen:a.windowsSeen} };
  }

  /* ---- the result ---- */
  if(p==='/api/bonus/resolve' && method==='POST'){
    const body = await ctx.body();
    const a = b.att;
    if(!a || a.id !== String(body.attemptId||'')) return { status:400, body:{ok:false,error:'No matching bonus run.'} };
    const locked=bonusUnlockError(led,a.stage);
    if(locked) return { status:403, body:{ok:false,locked:true,error:locked} };
    if(now - (a.startedAt||0) > ATTEMPT_MS){ b.att=null; ctx.writeDB();
      return { status:400, body:{ok:false, expired:true, error:'That bonus run expired — start it again.'} }; }

    /* Phil's win rule, enforced here and not taken from the client:
       "in order to win you must win atleast 2 lanes before you lose one". */
    const cleared = Math.max(0, Math.min(LANES, body.lanesCleared|0));
    const lost    = Math.max(0, Math.min(LANES, body.lanesLost|0));
    if(cleared+lost > LANES) return { status:400, body:{ok:false,error:'Impossible lane count.'} };
    const won = (cleared>=2) && (lost===0 || (body.firstLossAfterSecondClear===true));

    /* SECURITY 17 Sep - deny a forged instant clear WITHOUT consuming the attempt: b.att is left
       intact (not nulled) on either rejection, so an honest client that hit a bug can still play
       the run out and resolve it for real.

       BOTH checks below are gated on `won` ONLY, and deliberately so - a real ally wipe can and does
       happen in under ten seconds (a genuinely bad opening wave, or a squad that was too weak) and
       before wave 1's own window has opened, so a loss report must never be held to a win's timing
       or evidence bar. Only a claimed WIN - the path that pays a permanent reward - is checked. */
    if(won && now - (a.startedAt||0) < MIN_RESOLVE_MS){
      return { status:400, body:{ok:false,error:'That was too fast to be a real run.'} };
    }
    if(won && (a.windowsSeen|0) < WINDOWS){
      return { status:400, body:{ok:false,error:'That run is missing '+(WINDOWS-(a.windowsSeen|0))+' boon window(s) of evidence.'} };
    }
    b.att=null;
    const id=a.stage, ch=chOf(id), slot=slotOf(id);
    /* heroesSent is taken from the ATTEMPT the server issued, never from the client's report —
       otherwise a forged `heroesSent` inflates the denominator and buys a star. */
    let sent=0; for(let L=1;L<=LANES;L++) sent += ((a.assign&&(a.assign[L]||a.assign[String(L)]))||[]).length;
    const res = { won, lanesCleared:cleared, lanesLost:lost,
                  heroesSent:sent, heroesLost:Math.max(0,Math.min(sent, body.heroesLost|0)) };
    const stars = starsFor(res);

    const prev = b.done[id]||null;
    const firstClear = won && !prev;
    let granted=[];
    if(firstClear){
      granted = ctx.glyphGrantNamedList(ctx.me,
        clearReward(ch, slot, ctx.srvSeed('bonusclear', ctx.me.id, id), ctx.GLYPHS)) || [];
      /* The stream starts the moment the FIRST bonus stage is cleared, not at the
         previous claim — otherwise the very first clear back-pays hours it did not earn. */
      if(!Object.keys(b.done).length) b.ts = now;
      b.done[id] = { stars, at:now };
      ctx.ledTx(ctx.me, 'bonus:clear:'+id, { stage:id, stars });
    } else if(won && prev){
      if(stars > (prev.stars|0)) prev.stars = stars;    // a repeat raises stars and pays nothing
    }
    ctx.writeDB();
    return { status:200, body:{ ok:true, won, stars, starNote:starExplain(res),
      heroesSent:res.heroesSent, heroesLost:res.heroesLost,
      firstClear, granted, repeatPaysNothing:!firstClear,
      perHour:totalPerHour(b), claim:pending(b, now),
      ledger:ctx.ledgerView(ctx.me) } };
  }

  return { status:404, body:{ok:false,error:'Unknown bonus route.'} };
}

/* The eight rules that were open when this was written, settled here so the code could
   exist. Every one is Claude's default, not Phil's word, and any of them can be
   overturned by changing this file alone. Listed in the change request §6. */
function rulesSettled(){ return [
  'An empty lane is a fallen lane — a lane must always carry at least one hero.',
  'A between-wave swap may not empty a lane; the server refuses it.',
  'A boon belongs to the HERO, not the lane — Phil: "the heroes that got swapped maintain the boon buff".',
  'Boons stack: four offers across five waves, so a hero can finish holding four.',
  'A lane that clears all five waves releases its heroes to reinforce the road BESIDE it.',
  'PHIL, NOT CLAUDE (16 Sep): crossing costs nothing at all — no tempo, no turn. The hero visibly runs across and Start is refused until every mover has arrived.',
  'A lane is never lost on a timer — only when every hero in it falls.',
  'The NEXT wave is visible; waves beyond it are not.',
  'PHIL, NOT CLAUDE (17 Sep): FOUR windows, after waves 1-4. Wave 5 ends the run. Every window offers both crossings.',
  'PHIL, NOT CLAUDE (17 Sep): 3 stars all three roads home; 2 stars two roads home with under 33% of your heroes lost; 1 star is the floor for any other two-road win.',
  'PHIL, NOT CLAUDE (16 Sep): a hero crosses ONE firebreak at a time — 1<->2 and 2<->3, never 1<->3.',
  'PHIL, NOT CLAUDE (17 Sep): every summon dies at wave end, before the boon window. Bonus stages only, and never counted as a hero death.',
  'PHIL, NOT CLAUDE (17 Sep): except a summon under the Everlasting boon — it never dies, and fights at 50% power. Flat, not compounding.'
]; }

module.exports = { handle, CH_BONUS_TIER, SLOT_RATE, BONUS_CODES, CAP_HOURS, SLOTS, CHAPTERS,
  LANES, WAVES, WINDOWS, MAX_HEROES, MAX_PER_LANE, STAR_DEATH_LIMIT_2, starExplain,
  BOON_OFFER_SIZE, boonPool, boonCatalogueSize, boonsNeedingEngine, laneProfileFor, ensureBonus, ratesFor, totalPerHour, pending,
  bossFor,
  claimList, advanceClock, buildLanes, boonOffer, starsFor, clearReward, families,
  resetFamilyCache, checkSquad, checkSquadStrict, checkSwap, laneMoveOK, lanesReachableFrom,
  CROSSING_GATE, SUMMONS_DIE_AT_WAVE_END, EVERLASTING_SUMMON_POWER, EVERLASTING_FLAG, BONUS_UNIT_SCALE, BONUS_ROAD_USE, BONUS_ZOOM_CEILING, BONUS_ZOOM_LEVELS, BONUS_HUD_KEEPOUT, BONUS_HERO_FOOTPRINT,
  BONUS_ROAD_DEPTH, BONUS_LANE_Z, BONUS_LANE_IMG_Y, BONUS_CROSSING_X, ranksFor, formationFor, validBonusId, bonusUnlockError, tierFor, chOf, slotOf,
  codeForSite, siteForCode, bonusIdFor, chapterPowerRef, BONUS_POWER_MARGIN,
  TUTORIAL_BONUS, isTutorialBonus, TUTORIAL_SCRIPT, TUTORIAL_MONSTER_LVL, TUTORIAL_MONSTER_MUL, tutorialSwapPlan, rulesSettled };
