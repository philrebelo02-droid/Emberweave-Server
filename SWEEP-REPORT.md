# Emberweave Heroes: full read-and-play sweep, 9 Oct 2026

- **Build:** `main` @ `7b89c9b8` (live v1094, BUILD_ID `1791571803250`). S5 serves the same build.
- **Scope:** review only. Nothing in the game was changed. This branch adds only this report and `sweep/` (screenshots).
- **Severity:**
  - **P0:** a crash, data loss, or an exploit that gives resources or progress the game never meant to give.
  - **P1:** a broken feature.
  - **P2:** wrong behaviour.
  - **P3:** polish.
  - Exploits that are bounded (the player still pays full price, or a daily cap still holds) are graded P1 or P2, and each one says so.
- **File:line:** every finding was checked against the line it cites. "Seen in play" means it was also reproduced in the local or live browser run.

## Contents
1. [P0 and P1 at a glance](#p0-and-p1-at-a-glance)
2. [Test suite](#test-suite)
3. [Live smoke on S5](#live-smoke-on-s5)
4. [Local play](#local-play)
5. [Findings by system](#findings-by-system)
6. [Emoji on screen (P3)](#emoji-on-screen-p3)
7. [Route cross-check](#route-cross-check)
8. [Screenshots](#screenshots)

---

## P0 and P1 at a glance

| # | Sev | System | Finding | Where |
|---|---|---|---|---|
| 1 | P0 | Temple of Ash | Prayer rolls repeat when a requestId is reused after the 1-hour receipt window. | server.js:6771, 6726, 1674 |
| 2 | P0 | Temple of Ash | A held (Mythical Pool) prayer above the player's Temple level is used up and gives nothing. | server.js:6755-6773; emberweave-heroes.html:18022 |
| 3 | P0 | Island of Trials | A hidden second Tower ladder (`/api/trial/resolve` `kind:'tower'`) pays first-clear gold for floors up to 500, using floor-100 waves (about 1M gold). The `dungeon` kind has the same flaw. | server.js:1443, 7487, 7493 |
| 4 | P0 | Emberdraft | The server pays whatever place the client claims (up to about 324 stamina a day). | server.js:7297-7316 |
| 5 | P0 | Campaign (Veteran) | Veteran x-3/6/9 have a daily run cap on fights, but sweeps ignore it and pay without limit. | server.js:7087 vs 6545 |
| 6 | P0 | Bonus stages | The result trusts the client's lane counts, so first-clear glyph rewards can be scripted (a known, documented limit). | server/bonus-stages.js:1007-1009 |
| 7 | P1 | Hero panel | 12 heroes show the wrong summon cost (30 vs the server's 80) and the wrong starting stars. | emberweave-heroes.html:5114; server.js:7184 |
| 8 | P1 | Wishing Pool | "Wish Again ×10" after a Mythical ×10 buys Gold wishes instead. | emberweave-heroes.html:23589 |
| 9 | P1 | Arena | The daily claim never pays the arena coins it shows; they vanish at the next sync. | server.js:7563-7566; emberweave-heroes.html:20614 |
| 10 | P1 | Arena | No attempts counter and no buy-attempt button. The 6th fight is played out, then "NOT COUNTED". | server.js:1427, 8106, 8051 |
| 11 | P1 | World map | A shield raised while an enemy march is travelling does not stop the attack. | server.js:7671 (no shield check on arrival) |
| 12 | P1 | World map | Defend and Scout never reach the server; they are device-only. | emberweave-heroes.html:21299-21330, 21508 |
| 13 | P1 | Starless Well | A hero missing from the final battle summary is not marked fallen, so a death can be wiped (medium confidence). | server/starless-well.js:263 |
| 14 | P1 | Bonus stages | The hourly bonus fragments can never be claimed; the client never calls `/api/bonus/claim`. | emberweave-heroes.html:8542; server/bonus-stages.js:893 |
| 15 | P1 | Patron | Arena reset gives back bought attempts as well as free ones (bounded exploit). | server.js:6227, 1431, 8056 |
| 16 | P1 | Account | A guest cannot create an account and keep their progress from Settings. Logging out then registering starts a new level-1 account. | emberweave-heroes.html:24626, 20051-20054; server.js:4437 |
| 17 | P1 | Account | Players cannot delete their own account (an App Store requirement). | server.js:4722; emberweave-heroes.html:24655-24661 |
| 18 | P1 | Chat | No profanity filter, block or report on world, guild or whisper chat (an App Store user-content risk). | server.js:8966, 8557, 8976 |
| 19 | P1 | Market | The server sells any (non-excluded) hero's fragments, not only the hourly offers (bounded: full price, 12 a day). | server.js:7545-7548; emberweave-heroes.html:18113-18122, 18274 |
| - | check | Shop | Confirm `SHOP_TEST_PURCHASES` is unset on S1-S5. If it is set, any account gets free diamonds and EGP progress (P0). | server.js:4096 |

---

## Test suite

**Command:** `bash tests/run_all_tests.sh`, after `npm ci` and `npx playwright install chromium`.

**Windows notes:**
- `python3` on this PC is the Microsoft Store stub, so the runner's phase-1 bootstrap failed (`KeyError: 'profile'`). The run used a `python3` shim pointing at Python 3.12.
- The first attempt also hit `EADDRINUSE :8871` from a second suite run already on that port. That run was not started by this sweep.

**Result:** the runner ended with `FAILURES` (exit 1). Every named suite printed a pass line except the two below.

| Suite | Result |
|---|---|
| test_transform.sh | PASS 66 / FAIL 0 |
| test_glyphs.sh | PASS 52 / FAIL 0 |
| test_dungeon.sh | PASS 28 / FAIL 0 |
| test_gear.sh | PASS 37 / FAIL 0 |
| test_war.sh | PASS 34 / FAIL 0 (the Python shim printed a REPL banner, which is harmless) |
| test_ws_revoke / parity_harness / determinism | 5 / 19 / 18 pass |
| **test_live_campaign.js** | **FAILED:** `page.evaluate: TypeError: Cannot read properties of undefined (reading 'id')` at tests/test_live_campaign.js:21. `/api/register` returned no `profile` in-page. Run on its own against a fresh server, it passes 9/9. Flaky under the full suite; see the re-run note below. |
| temple_ui / temple_replay / temple_of_ash | pass / 9 pass / 45 pass |
| node --test (Witches Hut + world, 15 files) | 45 pass / 0 fail |
| crash idempotency | 4 pass |
| **probes: test_hero_profiles.js** | **Expected baseline:** `Cannot find module ...\Operating procedure\tools\glyph_paths.js` (that folder is outside the repo). |
| every remaining audit suite (v1010 to v1094, about 110 files) | all passed, for example temple_v2_1094 49/0, temple_screen_1094 14/0, patron_1092 18/0, mythic_pool_1092 14/0, academy_economy 274 |

**Against the expected baseline** (`Cannot find module glyph_paths` lines plus one FAILURES line), the first run had one extra failure: `test_live_campaign.js`.

**Second full run** (same checkout, straight after): `test_live_campaign.js` passed 9/9. The only failure was the `glyph_paths` baseline, which is **exactly the expected baseline**. Treat `test_live_campaign.js` as **flaky (P3, tests)**: its in-page `/api/register` sometimes returns no `profile`, and line 21 reads `reg.profile.id` with no guard. Fix: assert on `reg.error` and print it, so the next flake names its cause.

---

## Live smoke on S5

- **Setup:** about 12 minutes as a new guest (`8470a173ee04ab4a`) on https://s5.emberweaveheroes.com/play, at 844×390 headless.
- **Covered:** tutorial ("Start Here"), the stage 1-1 squad screen, stages 1-1 and 1-2 (both won 3★), tutorial and quest claims, a skill upgrade (Vael), the hero panel (all five tabs on the new hero) and one free Gold wish (it gave Dandra).
- **Nothing failed live that works locally.** Live and local behaved the same.
- **Problems seen in both places:**
  - **Victory card:** both clears request `/assets/img/glyphs-v2/Rough/fragment-vitality.png?v=4`, which returns 404, so the fragment icons show the ◆ placeholder (P3, Campaign).
  - **"Make a Name":** shows 1/1 with a Claim button before any name is set (P3, Quests).
  - **Skill button:** Dandra's skill "＋ 🪙300" is lit at hero level 1, where an upgrade can't succeed (P2, Hero panel).
  - **Equipment tab:** shows the internal key "support_back loadout" (P3, Forge/gear).
  - **Cloudflare beacon:** `static.cloudflareinsights.com` failed with `ERR_NAME_NOT_RESOLVED`. This is the PC's hosts-file ad blocker, not the game.

---

## Local play

- **Setup:** `PORT=8875 DB_FILE=… node server.js`. Port 8871 was taken by the suite, and the same session needed both.
- **Browser:** headless chromium at 844×390 with touch.
- **Account A** (fresh guest, level 1): skipped the tutorial, then played stages 1-1 and 1-2 by tapping ultimates (both won 3★). Also opened the hero panel and made a wish.
- **Account B** (grants made with `ADMIN_IDS` and `/api/admin/led-grant`, then a restart without admin): level 100, all 60 heroes 5★, 160 Normal stages cleared, 90M gold, 900k diamonds.
- **What the harness did on Account B:** visited every screen and overlay and pressed every visible control, one level deep. It re-found each control after every reset, and skipped log-out, delete and server switch.
- **Logs:**
  - **No page errors (uncaught exceptions)** in any run.
  - **Console errors:** the glyph-fragment 404 above; a 400 from refilling stamina at full; `429 Slow down.` on `/api/guild-war/status` while tapping Skyfall citadels; and an expected 400 "Placement is closed for this week."
  - **Failed requests:** none, apart from those two.

**Screens visited:** 39, covering:
- town, hub menu
- campaign (Normal / Elite / Veteran), stage card
- heroes, hero detail (all tabs, one level deep)
- Wishing Pool, Temple (grid and pray view), Market, Shady Market, Forge, Vault, Arena, Arena shop
- Guild, Skyfall, City Wall, Witches Hut, world map, Watch Tower, Bulletin Board, Academy
- Island of Trials, Starless Well, Tower of Trials, Emberdraft, Patron, profile
- Mail, Quests, Sign-In, Settings, Account, Glossary, Bag, squad screen, tutorial

Every tap in that list worked, with these exceptions:
- **Harness limits** (not game bugs, listed for honesty):
  - Patron opens on `pointerup` only, so a synthetic `click()` does nothing. A real tap opens it correctly.
  - Account B kept `role:'admin'` after the `ADMIN_IDS` restart (by design, `migrateAdminRoles`, server.js:343), so the dev panel showed in Settings. Ops note (P3): removing an id from `ADMIN_IDS` never revokes admin; the stored role must be cleared by hand.
- **Tabs and toggles that only change styling** (for example, Temple tier choice and the Arena "Attacks" tab) registered as "no visible effect" and were checked by eye.

What the play run found on screen (each finding is also listed under its system):
- **P3, Tutorial:** an existing level-100 account on a new device still gets the "Welcome, Commander!" tutorial offer (`sweep/06-tutorial-offer-level-100.png`).
- **P3, Hub:** the HUD shows "Commander" instead of the account name; "90001000" and "89965433" have no thousands separators; the "Commander" name plate overflows the screen edge by 7 px.
- **P3, Battle:** for a non-patron, the first tap on "▶ x1" slows the fight to x0.5 (the only other speed).
- **P3, Campaign map:** "HERO FRAGMENTS" labels sit on top of neighbouring "STAGE" labels; fragment and boss nodes show no lock while locked; the chapter subtitle is hard to read over the map.
- **P3, Hero detail:** at 390 px tall the tab bar (Stats / Skills / Glyphs / Equipment / Lore) starts below the fold.

---

## Findings by system

### Temple of Ash (new in v1094)

**[P0] Prayer rolls repeat when a requestId is reused**
- **Where:** server.js:6771 `TEMPLE.setRng(()=>srvRoll('temple-pray',me.id,reqId,rollIndex++))`, and Auto pray at server.js:6726. The seed is only the account, the requestId and the roll index. `idem` (server.js:1674) forgets receipts after 3,600,000 ms.
- **What happens:** the client picks the requestId. Sending a requestId again after an hour replays the same RNG stream. A scripted player can keep the ids that rolled well, including a won bonus prayer, and reuse them every hour.
- **Repro:** pray with `requestId:"abc"`, note the rolls, Cancel. Wait 61 minutes and pray again with `"abc"`: the same rolls come back (from the same steps).
- **Fix:** add a server-owned counter to the seed, for example `state.prayN=(state.prayN|0)+1; srvRoll('temple-pray',me.id,state.prayN,reqId,i)`. Do the same in Auto pray.

**[P0] A held prayer above the player's Temple level is used up for nothing**
- **Where:** server.js:6755-6756. The held branch checks only the count, not `t.unlockKeeper`. Line 6770 then decrements `heldPrayers[tier]`. `TEMPLE.pray` returns `{ok:false,reason:'tier_locked'}` (server/temple-of-ash.js:319), and the route never checks `session.ok`, so it answers `ok:true` with no rolls. The client offers held tiers with `locked:false` (emberweave-heroes.html:18022).
- **What happens:** a Mythical Pool reward is lost silently.
- **Repro:** at Temple level below 17, win "1× Inferno prayer" in the Mythical Pool, then pray "Inferno held ×1". The count drops, no prayer is pending, and nothing is shown.
- **Fix:** in the held branch, refuse when `level<t.unlockKeeper` before spending, and return an error whenever `session.ok===false`. On the client, set `locked` on held tiers above the Temple level.

**[P2] Gold ritual is preselected even when the free daily prayer is waiting**
- **Where:** emberweave-heroes.html:17955 `templeSelectedTier='gold'`. Line 18023 only changes the selection when the current one is invalid, and Gold is valid whenever the player has 1,000 gold.
- **What happens:** opening a hero and pressing Pray spends gold while "Daily free prayer · Free" sits unused just above it.
- **Fix:** when the free (or a bonus) prayer is available, select it whenever the pray view opens.

**[P3] The Auto pray panel breaks after one failed run**
- **Where:** emberweave-heroes.html:18078 `if(!r){ templeAuto=null; return; }`. The screen is not redrawn after this.
- **What happens:** after a failed run (for example, not enough diamonds) the panel stays open. If the next Pray succeeds, no summary appears.
- **Fix:** keep `templeAuto` when the call fails, or call `renderTemple()` after clearing it.

**[P3] Blessing wording**
- **Where:** emberweave-heroes.html:18014 `x.earned?' Unlock':' to unlock'`.
- **What happens:** an earned blessing reads "(Health 500/500 Unlock)".
- **Fix:** show "Unlocked".

### Wishing Pool and Mythical Pool

**[P1] "Wish Again ×10" after a Mythical ×10 buys Gold wishes**
- **Where:** emberweave-heroes.html:23589 `(pool==='gem'?wishGem10:wishGold10)()`. There is no Mythical branch.
- **What happens:** the button reads "Wish Again ×10 · 💎3600" but makes 10 Gold wishes for 9,000 gold.
- **Fix:** `(pool==='myth'?wishMyth10:pool==='gem'?wishGem10:wishGold10)()`.

**[P2] Mythical odds in code differ from the odds written in the comment as final**
- **Where:** the server.js:4014-4018 comment lists 35 / 34 / 4.5 / 3 / 1.2 / 0.3 %. `MYTH_ODDS` at server.js:4019 is 36 / 27 / 5 / 3.5 / 1.5 / 1 %, and the odds sheet shows the code's values.
- **Fix:** Phil to confirm which set is final, then make the code and the comment agree.

**[P3] Mythical wishes in the roll history**
- **Where:** emberweave-heroes.html:23616 `e.pool==='gold'?'🪙':'🔮'`; `wishResultLabel` at 23612.
- **What happens:** Mythical rows use the Diamond icon. Prayer, attack-card, shield, teleport and glyphFull results show raw codes such as "glyphFull Vael".
- **Fix:** add a Mythical icon and readable labels.

### Market and Shady Market

**[P1] The server sells any hero's fragments, not only the offers on screen** (bounded exploit)
- **Where:** the offers are rolled on the device (emberweave-heroes.html:18113-18122) and "Sold" is stored only on the device. The buy sends `{heroKey,qty,pay}` (18274). server.js:7545-7548 checks `validHero`, `heroNotSold`, a quantity of 1-4 and 12 a day, but never the offer.
- **What happens:** a script can buy any hero's fragments with either currency. The price and the 12-a-day cap still apply.
- **Fix:** roll the hourly offers on the server (seeded per account and hour) and require an offer index.

**[P3] The Peace Shield shows an old price after a level-up**
- **Where:** the price is fixed at restock (emberweave-heroes.html:18121), but the server charges at the current level (server.js:6461).
- **Fix:** price it when the Market is drawn, or show the server's quote.

**[P3] Big numbers have no separators**
- **Where:** the Market header and the hub HUD.
- **What happens:** they read "89965433 · 891708" and "90001000" (seen in play, `sweep/08-market-numbers.png`).
- **Fix:** use `toLocaleString()`, as the Temple already does.

### Forge and gear

**[P2] "Bound" gear can be moved to another hero**
- **Where:** server.js:4950-4956 refuses only an item that is equipped right now.
- **What happens:** when a newer item replaces it, the old bound item becomes free to equip on any hero from the Items tab (emberweave-heroes.html:15267-15268). This breaks the "bound for good" rule (server.js:4961).
- **Fix:** store `it.boundTo` when an item is first equipped, and refuse to equip it on any other hero.

**[P2] Equip does not check the hero's gear list** (medium confidence; may be intended)
- **Where:** server.js:4946-4957 checks only that the hero is owned.
- **Fix:** refuse items that are not on that hero's loadout, if that is the intent.

**[P2] Extract is dead for new gear, and legacy gear can refund dust twice**
- **Where:** since v1054, Temper is tracked per item type (server.js:4239). Extract refunds `it.dustSpent` (server.js:4990), which no new item ever has, and the button shows only when `it.dustSpent>0` (emberweave-heroes.html:15269).
- **What happens:** gear made after v1054 can never be extracted. A pre-v1054 item still refunds 80% of its old dust while its type keeps the Temper.
- **Fix:** decide how Extract works with per-type Temper (refund from the type and lower it), or remove Extract.

**[P3] The Equipment tab shows an internal key**
- **Where:** emberweave-heroes.html:15188 `${escapeHTML(role)} loadout`.
- **What happens:** players see "assassin_mid loadout" or "support_back loadout". Seen locally and live; `sweep/09-equipment-loadout-key.png`.
- **Fix:** map the key to a display name, for example "Assassin · Mid".

**[P3] Bound-item text gives the wrong advice**
- **Where:** emberweave-heroes.html:15187 "build a higher piece to replace it".
- **What happens:** each quality has its own slot, so a higher piece never replaces this one.
- **Fix:** "equip another Grey Weapon to swap it".

**[P3] Dead legacy equipment code**
- **Where:** emberweave-heroes.html:5259-5270 (`eqCraft` calls `/api/eq/craft`, which answers 410 at server.js:6671); the handlers at 23330-23332; the uncalled `promoteCost` (4799) and `doStarStep` (5125); and the `if(false){…}` block at server.js:6672.
- **Fix:** delete them.

### Campaign, Elite and Veteran portals

**[P0] Veteran x-3/6/9 sweeps skip the daily run cap**
- **Where:** resolve caps `mode==='elite'||isEliteStageSrv(a.node)||campIsBoss(a.node)` (server.js:7087). Sweep caps only `mode==='elite' || (mode==='normal' && isHeroRewardStageSrv(node)) || campIsBoss(node)` (server.js:6545).
- **What happens:** on Veteran 1-3, 1-6, 1-9, 2-3 and 2-6, fights stop paying after 3 a day, but sweeps never touch the counter. The client shows "0/3" (emberweave-heroes.html:5643) while the server keeps paying.
- **Repro:** three-star Veteran 1-3, use the 3 fights, then POST `/api/campaign/sweep {mode:'veteran',node:3,times:1}` repeatedly. Every call pays.
- **Fix:** one shared "is this stage capped" helper for start, resolve, sweep, `/api/campaign/stage` and the client.

**[P2] Elite and Veteran maps label the wrong stages "HERO FRAGMENTS"**
- **Where:** emberweave-heroes.html:18454 `elite?'HERO FRAGMENTS':'STAGE'` uses the Normal 3/6/9 rule in every portal, and so does the cue at 18593.
- **What happens:** Elite pays fragments on 1/4/7/10, and Veteran pays none. Seen in play: Elite and Veteran chapter 1 show "HERO FRAGMENTS 1-3/1-6/1-9".
- **Fix:** key the label and the cue off `stg.rewardHero`, and pass `mode` into `stageDetailHTML`.

**[P2] Sweep ×10 refuses the whole batch**
- **Where:** the comment at emberweave-heroes.html:18677 promises a partial sweep, but server.js:6551-6552 refuses when `stam<cost*times`.
- **Fix:** on the server, `times=Math.min(times,Math.floor(stam/unitCost))`, and refuse only at 0.

**[P2] The stage card's "Stamina · sweep" line reads Normal stars in Elite and Veteran**
- **Where:** emberweave-heroes.html:18617 uses `G.stageStars[node]`, `stageStamCost(node)` and `stageRunsLeft(node)` with no mode.
- **Fix:** use `portalStars(mode,node)` and the mode-aware helpers.

**[P3] A first clear of a fragment stage spends one of the 3 daily runs**
- **Where:** server.js:7122 `if(first) prog.runs['n'+a.node]=_used+1;` contradicts the comment at 7085.
- **Fix:** remove the increment, or correct the comment if this is intended.

**[P3] The drops chip always says ×2–4**
- **Where:** emberweave-heroes.html:18553. Repeats pay ×1 (server.js:7120).
- **Fix:** show "×2–4 first clear · ×1 repeat".

**[P3] Victory source line: "Source: Portal 1-1"**
- **Where:** emberweave-heroes.html:13146. Seen locally and live.
- **Fix:** `PORTAL_META[mode].label+' Portal '+stageCode(node)`, which reads "Normal Portal 1-1".

**[P3] The victory card's glyph-fragment icon is broken (404)**
- **Where:** `rewardPanel` (emberweave-heroes.html:18683) builds the art from `f.displayName` ("Rough Silk"), so the URL becomes `/assets/img/glyphs-v2/Rough/fragment-vitality.png` (there is no `Rough` folder, and the slot falls back to vitality).
- **What happens:** every first-clear card shows ◆ placeholders. Seen locally and live; `sweep/03-victory-fragment-icon-404.png`.
- **Fix:** build the art from `f.key` ("Grey Stoneheart"), not the display name.

**[P3] Two names for the same glyph fragments**
- **What happens:** the stage card and the Vault say "Grey Stoneheart" / "Grey Starfire Fragment" (emberweave-heroes.html:18549), while the victory card says "Rough Gravel Fragment" / "Rough Silk Fragment" for the same drops. Gear fragments are also called "Rough …".
- **Fix:** use one name for glyph fragments everywhere.

**[P3] A paid fight can't be resumed when stamina is below the stage cost**
- **Where:** emberweave-heroes.html:18663 and 26258 (`if(G.stamina<stageStamCost(...)) return;`, silent). The server would resume it for free (server.js:6935-6944).
- **Fix:** skip the client stamina gate when re-entering the same open attempt, and show the error otherwise.

**[P3] Campaign map label collisions**
- **What happens:** "HERO FRAGMENTS" overlaps the next "STAGE" label (1-3 over 1-4, 1-6 over 1-7). Fragment and boss nodes show no 🔒 while locked. The "Emberfall Vale" subtitle is unreadable over the art. Seen locally and live; `sweep/02-campaign-map-labels.png`.
- **Fix:** offset or shorten the fragment label (for example "FRAGMENTS"), and add the lock to every locked node.

**[P3] The battle speed button slows the fight on the first tap**
- **Where:** emberweave-heroes.html:26304. For non-patrons the speeds are `[0.5,1]`, so "▶ x1" goes to x0.5.
- **Fix:** for non-patrons, hide the button or start the cycle at x1 → x0.5 with a clear label. Phil's call.

**[P3] Dead legacy Elite screen**
- **Where:** emberweave-heroes.html:18087-18108 and 13009-13021 post `/api/elite/resolve`, which answers 410 (server.js:7458). Nothing navigates to it.
- **Fix:** delete it.

### Bonus stages (campaign)

**[P0] The bonus result trusts the client's lane counts** (already a documented limit)
- **Where:** server/bonus-stages.js:1007-1009 reads `lanesCleared` / `lanesLost` / `heroesLost` from the request body.
- **What happens:** a script can post the window calls and claim a 3-lane win on every stage.
- **Fix:** replay on the server, or pay a checkpoint floor and file a review case, as with Emberdraft.

**[P1] The hourly bonus fragments can never be claimed**
- **Where:** the client never calls `/api/bonus/claim` or `/api/bonus/state`; it calls only stage, start, window and resolve (emberweave-heroes.html:7555, 7792, 8101, 8161). The result card still says "… fragment(s) per hour now available" (8542).
- **Fix:** add the claim, or remove the line.

**[P3] A claim retry after a lost reply hides the reward**
- **Where:** server/bonus-stages.js:893-906 keeps no receipt.
- **Fix:** wrap the claim in `idem(me.id+':bonusclaim:'+reqId, …)`.

### Hero panel (levels, stars, skills, glyphs)

**[P1] 12 heroes show the wrong summon cost and starting stars**
- **Where:** the client (emberweave-heroes.html:5114) uses `HERO_TYPES start:2`, so 30 fragments. The server (server.js:7184) uses `POOL_START_STARS[k]||base.stars`, which is 3★ for these keys, so 80.
- **Affected:** brannus, deepcleft, askel, tharl, kharos, hobb, orryn, pellucid, vaelora, mirelle, veyr, zahri.
- **What happens:** at 30 fragments the card lights "✨ SUMMON NOW · spends 30 fragments", and the server answers "Need 80 fragments to summon." After a summon, the banner says 2★ but the ledger holds 3★.
- **Fix:** make the two tables agree, and add a startup check that compares them.

**[P2] The skill "＋" button is lit when the skill is at the hero's level**
- **Where:** emberweave-heroes.html:23279 `can=on&&!atMax&&gold>=cost` has no hero-level check. `skillUpgrade` (4818) then returns silently, and the server refuses too (server.js:6656).
- **What happens:** seen live: Dandra at hero Lv 1 shows "＋ 🪙300" on a Lv 1 skill, and the tap does nothing.
- **Fix:** add `&&lv<heroLevel(key)` and show "Hero Lv N needed".

**[P3] At 390 px tall the hero detail tab bar sits below the fold**
- **What happens:** opening a hero shows the portrait and level bar. The Stats / Skills / Glyphs / Equipment / Lore tabs start at the bottom edge and are cut off until the panel is scrolled (`sweep/05-hero-detail-tabs-cut.png`).
- **Fix:** put the tabs above the portrait block, or shrink the header on short screens.

### Vault

**[P2] A paid sweep sends a new requestId on every tap**
- **Where:** emberweave-heroes.html:14801 `api('/api/dungeon/sweep','POST',{requestId:uid8()})`.
- **What happens:** if a reply is lost, tapping again pays for a second sweep (200/400/600 💎).
- **Fix:** use `apiOnce('vsweep',…)`.

**[P3] A cleared Vault shows "Floor 101 / 100" and a sweep button that never turns off**
- **Where:** emberweave-heroes.html:14846 and 14850; server.js:5701.
- **Fix:** show `Math.min(currentFloor,100)` and disable the button at 0.

### Arena

**[P1] The daily claim never pays arena coins**
- **Where:** server.js:7563-7566 credit only gold and gems. The client adds `rw.coins` locally (emberweave-heroes.html:20614), and the next ledger sync removes them.
- **Fix:** credit `me.coins` (capped) inside the commit, and drop the client-side add.

**[P1] No attempts counter and no "buy attempt" button**
- **Where:** `ARENA_FREE_ATTEMPTS=5` (server.js:1427) and the refusal at 8106. Nothing calls `/api/arena/buy-attempt` (8051).
- **What happens:** the 6th Challenge plays a full battle, then shows "NOT COUNTED – No arena attempts left today."
- **Fix:** show `attemptsLeft`, disable Challenge at 0, and add the buy button.

**[P2] A win the player watched can become "ARENA LOSS"**
- **Where:** emberweave-heroes.html:12926 and 12931 take `d.won` from the server's re-sim (server.js:8114), which uses a different seed from the one the client played.
- **What happens:** this conflicts with the "the player's fight is the result" rule.
- **Fix:** play the server's seed and snapshots, or show the result only after the server answers.

**[P2] "Refreshes 3/3" is tracked only on the device**
- **Where:** emberweave-heroes.html:20495-20498. `/api/arena/opponents` (server.js:8062) has no count, and offered lists stay valid for 2 hours.
- **What happens:** reloading rerolls the opponent list without limit (useful for finding weak targets).
- **Fix:** count refreshes on the server, per NY day.

**[P3] The result screen shows gold but never arena coins**
- **Where:** emberweave-heroes.html:12932 and 12950.
- **What happens:** after the 8,000-a-day gold cap it shows "🪙 +0".
- **Fix:** show `d.reward`, and hide a zero gold line.

**[P3] Arena shop text and limits**
- **Where:** emberweave-heroes.html:20665 says coins come from "daily rank rewards and wins". The per-item daily limits (server.js:1468) are never shown.
- **Fix:** correct the copy and show "N left today".

### Guild

**[P2] Raid damage against a boss that has already died lands on the next boss**
- **Where:** server.js:8674-8676 has no tier check.
- **Fix:** when `sa.tier!==r.level`, book the run against the old boss (zero damage, or a share of the kill).

**[P2] Embassy perks are applied only in the client**
- **Where:** emberweave-heroes.html:22211-22219 and `maxStamina()` at 5427. The server applies none: `ledStamMax` (server.js:3782), the fixed contribution XP (8571), mine yield and raid gold.
- **What happens:** the client's stamina cap is higher than the server's, so the stamina number snaps back on sync and refills are refused.
- **Fix:** apply the perks on the server, or remove the tab.

**[P3] A join request can't be cancelled**
- **Where:** emberweave-heroes.html:22713 re-posts the request. `/api/guild/cancelRequest` (server.js:8509) has no caller.
- **Fix:** have the "Requested ✓" button call `cancelRequest`.

**[P3] Disband fails silently**
- **Where:** emberweave-heroes.html:22299 has no else branch.
- **Fix:** show the error in a banner.

**[P3] Dead raid and war code**
- **Where:** emberweave-heroes.html:22226-22259 (`GUILD_BOSS_NAMES` with names that are not in the game's roster, `guildBossAssault`), 22109 (`GUILD_MEMBERS`), and 22573-22607 (code after `return` that calls the retired `/api/guild/war/attack`).
- **Fix:** delete it.

### Guild war and Skyfall

**[P3] Tapping through the citadels hits the rate limit with no message**
- **Where:** every `/api/guild-war/*` route shares one limit of 30 requests per 30 s (server.js:5020). Opening Skyfall and tapping a citadel each call `skyStatus()` (emberweave-heroes.html:15473).
- **What happens:** seen in play, with fast tapping: after a few citadels, `GET /api/guild-war/status` answers `429 Slow down.` and the board silently keeps stale data.
- **Fix:** cache status for a few seconds on the client, give reads a separate, larger budget, and show a message on 429.

**[P2] The reward is labelled guild coins but pays arena coins**
- **Where:** emberweave-heroes.html:17912 says "unclaimed guild coins". server.js:5370 does `me.coins+=total`, which is the arena wallet, with no `ECON_CAP` and no `ledger` in the reply.
- **Fix:** credit the intended wallet with its cap, return `ledgerView`, and match the label.

**[P3] No Withdraw after registering**
- **Where:** `/api/guild-war/unregister` (server.js:5107) has no client caller.
- **Fix:** add a leader-only Withdraw button during registration.

**[P3] "Leader" versus "leader/officers"**
- **Where:** server.js:5097 and 5205 say leader only, the check is `isLeaderOrOfficer`, guilds have no officers, and the client says "leader/officers" (emberweave-heroes.html:15579).
- **Fix:** pick one wording.

### World map: mines, cities, marches, shields

**[P1] A shield raised during an incoming march does not stop the attack**
- **Where:** `/api/pvp/attack` loads the defender at server.js:7671 with no `castleShieldedUntil` check. Shields are checked only when war is declared and when the march starts (7825, 7874).
- **Repro:** A marches on B; B activates a shield during travel; the march lands and pays loot.
- **Fix:** on arrival, settle shielded (or now-allied) targets like the `capped` receipt: no fight, no attack counted.

**[P1] Defend and Scout never reach the server**
- **Where:** `startMarch` posts only for attack and group (emberweave-heroes.html:21299-21330). Defend (21508) creates a device-only record that lasts "100 years".
- **What happens:** the ally gets no defenders, and the heroes are still free for mines and fights on the server.
- **Fix:** build defend and scout routes, or hide the buttons.

**[P2] Wins at the server's world castles never reach the Watch Tower**
- **Where:** server.js:7767 stores `{target:…}`, but `watchEntries` (8224) keeps only rows that have `name`.
- **Fix:** store `name:d.name`.

**[P2] Watch reports come from the client, so anyone can fake "X is scouting you"**
- **Where:** server.js:8229-8247 (`scouts:watchEntries(b.scouts)`), which also has no level-20 gate.
- **Fix:** build watch rows from the server's own marches.

**[P2] An attacker can shield while their own attack is still pending**
- **Where:** server.js:6384 blocks only while `homeAt>now`.
- **Fix:** block while any city march is unresolved, or break the shield when the attack resolves.

**[P2] Every mine pays 15, whatever its level**
- **Where:** server.js:6103 `granted=15`; the client shows the same cap (emberweave-heroes.html:21762).
- **What happens:** a level-10 Wild mine (Lv 74, about 200 minutes) pays the same as level 1.
- **Fix:** scale the grant by node level.

**[P3] "Group Attack" is identical to "Attack"**
- **Where:** emberweave-heroes.html:21967.

**[P3] Travel times ignore the EDP march-speed bonus**
- **Where:** emberweave-heroes.html:21245 and 21825; the server applies `patronMarchMs` (server.js:6066, 7900).

**[P3] Region transfer confirmation always says "you will have 0 free region transfers"**
- **Where:** emberweave-heroes.html:20800-20801.

### Witches Hut (the in-game label is "Witches Hut")

**[P2] Buying brew charges full price for a partial fill**
- **Where:** server/witches-hut.js:107 adds `min(capacity-brew, capacity*fraction)`, but server.js:6013 charges the full price.
- **What happens:** at 99% full, "+20% brew · 💎 50" adds 1%, takes 50 💎 and uses a daily purchase.
- **Fix:** refuse when less than one full step fits, or charge in proportion; disable the client button the same way (emberweave-heroes.html:20729).

**[P3] The upgrade confirm step hides the brew cost**
- **Where:** emberweave-heroes.html:20738.
- **Fix:** keep "🫙 −N brew" and the resource cost in the confirm label.

### Starless Well

**[P1] A hero missing from the final battle summary is not marked fallen** (medium confidence)
- **Where:** server/starless-well.js:263 `if (!e) continue;`. The mine code treats a missing hero as 0 HP (server.js:6088-6090).
- **Fix:** if `e` is missing, set `{hpFrac:0,energy:0,dead:true}`.

**[P3] At account level 100, Sweep pays nothing but still ends the run**
- **Where:** server/starless-well.js:116 and 207.
- **Fix:** hide Sweep when the XP reward is 0, or give a floor reward.

### Island of Trials, Tower of Trials and Emberdraft

**[P0] The hidden Tower ladder on `/api/trial/resolve`**
- **Where:** `TRIAL_KINDS.tower` pays `gold:80+8*f, heroXp:60` (server.js:1443). Floors are clamped to 500 (7487), but the waves are `vaultFloorRecord(Math.min(100,floor))` (7493), with a separate `led.trial.tower.best`, no stamina and no daily cap.
- **What happens:** an account that can beat floor 100 can climb floors 101-500 at floor-100 difficulty for about 994k gold plus hero XP. The `dungeon` kind pays 200 gold and 100 XP a floor in the same way.
- **Fix:** retire `kind:'tower'` (the real Tower is `/api/tower/*`), cap `floor` at 100, and cap `dungeon`.

**[P0] Emberdraft pays the place the client claims**
- **Where:** server.js:7297-7298 `place=claimed`, and 7314-7316 credit `ED_STAM[place]`. The checkpoint and too-fast checks only raise a flag.
- **What happens:** a script claims 1st every match: 36 stamina × 9 a day.
- **Fix:** Phil's call. Pay the checkpoint floor when it contradicts the claim, or replay on the server.

**[P2] Some won non-campaign battles show "+80 gold" that is never paid** (medium confidence)
- **Where:** emberweave-heroes.html:12843-12845 posts `kind:'tower'` with the real Tower floor, which the server refuses ("Clear the previous floor first"), but the card still shows 🪙 +80.
- **Fix:** remove the call and the text, or send the right kind and show the server's reward.

### Academy
- No defects found. Gates, costs, timers and durable income all match between client and server.

### Mail

**[P2] Opening Mail does not mark the open tab as read**
- **Where:** `renderMail()` (emberweave-heroes.html:14405). Messages are marked read only in the tab's `onclick` (24503).
- **What happens:** the menu dot and the count stay lit until the player taps the tab that is already selected.
- **Fix:** mark the current tab read after rendering, then call `updateMailBadges()`.

**[P3] Mail has no attachments and no delete**
- **Where:** emberweave-heroes.html:21351-21369. Mail is stored on the device (40 per tab, 50 for war); server reports are acknowledged separately (server.js:7787-7797), so there is nothing to double-claim.
- **What's missing:** delete, if wanted.

### Quests

**[P2] "Gather Your Champions" can give fragments of heroes that are never sold**
- **Where:** server.js:7536. The pool includes the `HERO_NOT_SOLD` keys (konwu, vulmar, aureth, hurne, hollow, grosk).
- **Fix:** add `&&!HERO_NOT_SOLD.has(k)` to the filter.

**[P3] "Make a Name" is claimable before a name is set**
- **Where:** server.js:1436 `cond:()=>true`. Seen live: "Make a Name · 1/1 · Claim" at level 3, still "Guest-…".
- **Fix:** require `u.renames>0`, or reword the quest.

### Daily sign-in
- No defects found. The day is server-owned, the requestId is fixed per day, and the reward table and pool match.

### Patron (EGP / EDP)

**[P1] Arena reset also restores bought attempts** (bounded exploit)
- **Where:** server.js:6227 `a.used=0`, with attempts left = FREE + bought - used (1431).
- **What happens:** a 50 💎 reset returns the 5 free attempts plus up to 5 bought ones, every time.
- **Fix:** `a.used=Math.max(0,a.used-ARENA_FREE_ATTEMPTS)`, or reset `bought` too.

**[P2] A double tap on the Patron buttons spends twice**
- **Where:** emberweave-heroes.html:26044-26048. `patAct` makes a new requestId per tap and never disables the button.
- **Fix:** disable the button while a request is in flight, and keep one requestId until a definite answer (`apiOnce`).

**[P2] The "next level adds" list advertises perks that are not built**
- **Where:** emberweave-heroes.html:26032. `PAT_SOON` is applied only to the current-benefits list (26033).
- **Unbuilt perks shown:** extra mine hours, faster wall recovery, war on a whole guild, 5 heroes per war line, instant Arena reset.
- **Fix:** tag them "soon" there as well.

**[check] Free test purchases**
- **Where:** server.js:4096 accepts `provider:'test'` when `SHOP_TEST_PURCHASES==='1'`.
- **To do:** confirm the variable is unset on every server, or restrict test purchases to developer accounts.

### Account, settings, sign-in

**[P1] A guest can't create an account and keep their progress**
- **Where:** Settings treats a guest as signed in (emberweave-heroes.html:24626 `else if(ACC.token)`) and offers only email, reset and Log out. The guest create form (`renderAccount`, 20206) is reachable only while signed out. Log out revokes the token and resets local progress (20051-20054), so `/api/register` sees no guest (server.js:4437) and makes an empty account.
- **Repro:** play as a guest to level 5 → Settings → Log out → Register. The new account is level 1.
- **Fix:** add a "Create account" form for `ACC.guest` in Settings that posts `/api/register` with the guest token.

**[P1] No self-service account deletion**
- **Where:** the only delete is admin-only (server.js:4722). Settings (emberweave-heroes.html:24655-24661) has none.
- **Fix:** add `POST /api/account/delete` with a password re-check, reusing the cleanup at 4729-4734.

**[P2] Switching servers onto a satellite can strand an older local account with the same name**
- **Where:** server.js:4555 calls `linkedUser(gid,name,null)`, so the adopt branch at 374 never runs, and 378 renames the old account to `name~old`.
- **Fix:** when there is no `byGid` match on handoff, ask for a one-time password sign-in instead of making a new player.

**[P2] "Reset all progress" is not dev-gated on the server and clears the integrity flag**
- **Where:** server.js:4826-4846 checks only `!me` and runs `delete me.flag`. The prompt (emberweave-heroes.html:24955) promises a name change that is never restored.
- **Fix:** gate the route to dev (or require a password), keep `flag`, and reset `renames` as the prompt says.

**[P3] An email change saves the new address without verifying it**
- **Where:** server.js:498 and 509. A typo silently breaks recovery.

**[P3] No password change without a recovery email**
- **Where:** emberweave-heroes.html:24644.

**[P3] Dead "password has been reset" flows and admin recover button**
- **Where:** emberweave-heroes.html:20227-20241 and 24893-24906; 25380 calls `/api/admin/reset`, which answers 410 (server.js:4689).

**[P3] The dev "🐞 Bug reports" panel never shows player reports**
- **Where:** it reads `/api/admin/reports` (emberweave-heroes.html:25213), but player reports go to `DB.feedback` (server.js:4763-4769).

**[P3] An existing account on a new device gets the tutorial offer**
- **Where:** `maybeOfferTutorial` (emberweave-heroes.html:24017) runs from `renderHome` at boot, before the cloud save and ledger (`campaignCleared`, `tutSkipped`) are adopted.
- **What happens:** seen in play: a level-100 account with 160 stages cleared got "Welcome, Commander! Start Here / Skip Tutorial" over the Temple (`sweep/06-tutorial-offer-level-100.png`).
- **Fix:** offer the tutorial only after the first ledger adoption, and check `ledger.camp.cleared`.

**[P3] The tutorial squad step describes a selection that is already made**
- **What happens:** "Tap all three hero portraits; a highlighted portrait means that hero is selected…", but the Stage 1-1 squad screen arrives with all three already in the team (seen live, `sweep/10-squad-screen.png`).
- **Fix:** reword it to "Check your three heroes, then press BATTLE", or start with an empty team.

### Hub and HUD

**[P2] Your own name shows as "Commander"**
- **Where:** `DEFAULT_G.playerName='Commander'` (emberweave-heroes.html:5374) is overwritten only by a paid rename (14641), and `chatName()` (26668) prefers it.
- **What happens:**
  - The hub plate shows "Commander" while the server tags chat with the account name.
  - Your own chat lines are not marked as yours (26683, 26612).
  - Tapping your own name whispers yourself (26580).
  - Seen in play: `sweep/07-town-hud.png`.
- **Fix:** set `G.playerName=profile.name` at sign-in, and prefer `ACC.name`.

**[P3] Name plate overflow**
- **What happens:** `#pfName` / `#resName` run 7 px past the right edge at 844 px wide. The "Lv 100" badge is clipped at the corner.

**[P3] Naming drift on small screens**
- The Bag subtitle says "Glyph shards drop from campaign stages", but everywhere else they are glyph **fragments**.
- The Bulletin Board's "Your Standings" labels the Vault as "Dungeon".
- The town label reads "Witches Hut" (no apostrophe).
- **Fix:** one vocabulary: fragments, The Vault, and Phil's chosen spelling for the Hut.

**[P3] Stamina refill is offered when stamina is already full**
- **What happens:** "+ → 💎 50" posts `/api/shop/buy` and gets `400 Stamina is full.` In play this was at 999/159 after an admin grant. Hide or disable the offer at or above the cap.

### Chat

**[P1] No profanity filter, block or report**
- **Where:** world/region chat `clip(m.text,200)` (server.js:8966), guild chat (8557) and whispers (8976). No blocklist, mute or report exists anywhere.
- **Why it matters:** a store-review risk for user-generated content.
- **Fix:** a server-side word filter (chat, whispers, guild message of the day), a per-player block list and "report message".

**[P3] Smaller chat issues**
- "Region" chat goes to everyone (server.js:8966, 8907).
- Whispers fail silently and can reach sockets whose session has lapsed (8980, no `c._uid` check).
- Chat accepts whitespace-only lines, bidi overrides and stacked accent marks (8966, while names are cleaned at 256).
- `ws._ipKey` is never assigned, so all anonymous sockets share one rate bucket if `WS_AUTH_REQUIRED` is off (8961, 8969, 8977).
- `bannerMsg` and `gameConfirm` write player names with `innerHTML` (14422, 5596, 21387, 22002, 22012, 20599). This is safe only while the server's `<>` strip holds; `escapeHTML` (22719) does not escape `'`. Hardening only.

### Server routes and request handling

**[P3] Non-string body fields give 500 instead of 400**
- **Where:** server.js:4394 `(b.name||'').replace`, 4401 `(b.deviceId||'').slice`, 4709 and 8492. A `null` JSON body reaches routes as `null`. The dispatcher catches it (8804), so there is no crash.
- **Fix:** coerce with `String()`, and default a non-object body to `{}`.

**[P3] `body()` decodes each chunk on its own**
- **Where:** server.js:317 `d+=c`. A multi-byte character split across chunks becomes U+FFFD (relevant to large `/api/save` bodies).
- **Fix:** collect the Buffers and `Buffer.concat` before decoding.

---

## Emoji on screen (P3)

Emojis are being removed from the game, so each one listed here is a P3.

**Client:** 1,873 emoji occurrences on 1,221 lines of emberweave-heroes.html (230 distinct). Excluding admin-only dev tools (25084-25381), every screen has them. The most common are ⚔ (184), the VS16 variation selector (110), 💎 110, 🛡 89, 🪙 76, ★ 67, ✨ 57, ⚡ 51, 🔒 49, ✕ 44, ◀ 43, ⚠ 40, ▶ 30, ⛏ 29, ✚ 27, ⭐ 27, ✦ 25, 🧩 24, 👑 22 and 🔥 22.

**Seen on screen during play, by screen:**

These were captured from the rendered text of each screen during the play run.

| Screen | Emoji seen |
|---|---|
| Welcome / tutorial offer | 🎓 |
| Tutorial list (live) | 📍 🎁 🪙 ⭐ ⚔️ 📜 ✨ 🗺️ |
| Campaign map (all portals) | ◀ ▶ 📖 🗺️ ⚔️ 🔶 🔒 ⭐ ★ 🪙 |
| Stage card | 🔶 ★ ⚔️ 📖 💨 ◀ 🗺️ ⭐ 🪙 ▶ 🔒 |
| Squad screen / battle | ◀ 📖 ▶ ⭐ ❤ ⚔️ ⚔ ⚡ ⏸ |
| Victory card | 🪙 📖 ★ |
| Heroes list | ◀ ⚔ 🧩 |
| Hero detail | ◀ ⚔ 🧩 ★ 📊 ⚔️ 💠 ⚒️ 📜 ❤ ♻ 🛡 🔮 ✨ ⚡ 🔋 🎯 🧭 ↗ 📖 |
| Wishing Pool | ◀ 🪙 ✨ 💎 🔒 ★ ⏳ ⛲ 🔁 |
| Market | ◀ 🪙 💎 🧩 🛡️ |
| Shady Market | ◀ 💎 🪙 🛡 🎟️ |
| Forge | ◀ ⚒️ ✨ 🔮 🔥 🛡 |
| Vault | ◀ 🏛️ ✨ ⚒ ⚔ 🛡 ⚔️ 🧹 ♻ |
| Arena | ◀ ⚔ 🎁 💎 |
| Arena shop | ◀ 🛒 🎟️ ★ 🪙 💎 |
| Guild | ◀ 🏰 🔍 |
| Skyfall | ◀ ⚔ ☰ |
| City Wall | ◀ ▶ ⚔ 🏰 📍 |
| Witches Hut | ◀ ▶ 🫙 💎 ⛓️ 🔗 🪨 |
| World map | 🏰 🎯 ℹ️ ✨ 🛡 🔒 🌳 🔍 |
| Watch Tower | ⚔ 🛡 🔭 |
| Academy | 🏛️ ⚔ ❤ ✨ 🛡️ 🛡 🔯 ✦ ✚ 🔒 |
| Mail | 📥 ⚔ ⛏ 🔭 |
| Quests (live) | 🎁 🗺️ 📍 💎 🪙 🗡️ |
| Sign-In | ✨ |
| Bulletin Board | ⭐ 🏆 🛡 🗺️ 🥇 🥈 🥉 ⚔ |
| Bag | 📖 🔮 |
| Emberdraft lobby | ⚔ 👥 |
| Settings | 🔑 (plus the dev panel, admin only) |
| Glossary | 🦸 👹 ✨ 💀 |
| Temple of Ash | ◀ only (the v1094 screen is otherwise clean) |

**By system** (line ranges in emberweave-heroes.html; full per-line list available from the scan script):

| System | Count | Lines |
|---|---|---|
| CSS + static screen markup | 56 | 360-2503 |
| Hero data, skill text, stars | 249 | 2599-5396 |
| Battle engine, HUD, results | 72 | 5886-14171, 25621-25851 |
| Gauntlet Split | 12 | 7612-8531 |
| Hub, home, profile, economy | 32 | 14254-14646 |
| Vault | 47 | 14699-14879 |
| Forge / gear | 114 | 14893-15296 |
| Skyfall | 135 | 15450-17912 |
| Dungeon, markets, rankings, portals | 55 | 17926-18295 |
| Campaign map, stages, sweeps | 76 | 18311-18750 |
| Glossary, hero kit, roster | 40 | 18774-19925 |
| Academy | 21 | 19942-20004 |
| Account / sign-in screens | 10 | 20147-20272 |
| Arena | 32 | 20378-20671 |
| Witches Hut | 4 | 20714-20726 |
| City wall, world map, marches, mines | 183 | 20756-22099 |
| Guild | 83 | 22103-22748 |
| Heroes, glyphs, hero detail | 91 | 22798-23386 |
| Wishing Pool | 78 | 23456-23658 |
| Quests, sign-in, tutorial | 105 | 23688-24021 |
| Island, Province, Well, Tower | 96 | 24031-24490 |
| Mail | 20 | 24501-24528 |
| Terms / Settings | 78 | 24585-25077 |
| Server list / online versus | 5 | 25476-25601 |
| Shop / Patron | 35 | 25945-26123 |
| Update notice / chat | 19 | 26529-26685 |
| Emberdraft | 83 | 26881-28694 |

**Server text players see:**
- server.js:730: "🔥 Emberweave Heroes" header in the reset and email-change emails.
- server.js:4981: "Not enough Forge Dust (next use: ✨…)".
- server.js:6543: "sweep needs ★★★".
- server.js:7154: "Already 5★".
- server.js:7167: "Refine opens at 5★".
- server/patron-benefits.js:24 and 83: "400 💎".
- server/bonus-stages.js:301: "Your new 5★ takes the Middle Road."
- The server/*.json data files contain none.

---

## Route cross-check

| Check | Result |
|---|---|
| Client `/api/` paths | 172 literals, plus 6 gear sub-paths (`forgePost`, `gearHeroPost`) and 5 guild sub-paths (`guildAct`) |
| Client paths the server does not answer | **None** |
| GET/POST mismatches | **None** |
| Client calls to retired routes | `/api/elite/resolve` (410; unreachable screen); `/api/guild/war` and `/war/attack` (after a `return`); `/api/admin/reset` (410); `/api/admin/unreset` (does nothing useful) |
| Server routes no client calls | `/api/guild-war/unregister`, `/api/arena/buy-attempt`, `/api/guild/cancelRequest`, `/api/bonus/state`, `/api/bonus/claim`, `/api/glyphs/slot-options`, `craft`, `craft-sub`, `/api/shop/offers`, the world-tree routes (event disabled), plus internal, dev and Ember tooling |
| Reachable without sign-in | health, manifest, register, login, guest, logout, handoff-redeem, reset-request/verify (all rate-limited), world-tree sites and status (public reads), admin/backup (header token), internal/account (link secret). Everything else answers 401. |
| Admin/dev gating | Every `/api/dev/*` and `/api/admin/*` route checks `isDev`. **Exception:** "reset all progress" (server.js:4826) is not dev-gated; see Account. |

---

## Screenshots

All are 844×390, in `sweep/`.

| File | Shows |
|---|---|
| 01-welcome-emoji.png | The tutorial offer over the splash, with the 🎓 emoji |
| 02-campaign-map-labels.png | (live) Overlapping "HERO FRAGMENTS" / "STAGE" labels, unlocked-looking fragment and boss nodes, the unreadable subtitle |
| 03-victory-fragment-icon-404.png | (live) Victory card with ◆ placeholders from the 404 fragment art, and "Source: Portal 1-1" |
| 04-stage-card-veteran.png | Veteran 1-1 stage card (Normal-star sweep line, "Reward XP 0") |
| 05-hero-detail-tabs-cut.png | Hero detail tabs below the fold at 390 px |
| 06-tutorial-offer-level-100.png | The tutorial offer shown to a level-100 account on a new device |
| 07-town-hud.png | Town HUD: "Commander" name, unformatted gold, the clipped name plate |
| 08-market-numbers.png | Market header with unformatted numbers |
| 09-equipment-loadout-key.png | "assassin_mid loadout" internal key on the Equipment tab |
| 10-squad-screen.png | (live) Stage 1-1 squad screen, already filled, against the tutorial text |
| 11-elite-map-labels.png | Elite chapter 1 labels "HERO FRAGMENTS" on 3/6/9 |
| 12-wish-result.png | (live) Gold free wish result |
| 13-temple.png | Temple of Ash grid (v1094) |
| 14-bulletin-board.png | Bulletin Board standings: "Dungeon" label for the Vault |
| 15-bag-shards.png | Bag subtitle "Glyph shards" |
| 16-patron.png | Patron (EGP 0) panel, opened by a real tap |
| 17-skyfall.png | Skyfall board |
