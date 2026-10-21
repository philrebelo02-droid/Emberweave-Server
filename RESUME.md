# RESUME - Nox to magic assassin gear (paused again 17 Oct: Phil installing the RTX 8000)

Phil: "Switch nox to magic gear and swap everything of his to magic assasin gear". NOT deployed. Don't commit this file.

## Where it is
- Worktree C:\Users\Home\Downloads\ew-noxgear, branch `claude/nox-magic-gear`, pushed at **b2bdd4855bf5ad1196a503985c89d27217f8d4a5**. It is one commit labelled **v1194** (claimed in the AI channel), rebased on live v1193 (3afb75d2).
- Renumbered v1192 -> v1194: v1192 is the save upgrade, v1193 is live. Done in code, the tests (test_nox_magic_gear_1194.js, helpers/nox-magic-1194.js), the patch notes sources and the blueprint (Heroes/Nox Quillfinger.md section "v1194").
- Test BASE = 3afb75d2.

## The one full run: stopped part-way for the shutdown
- **Suite on BASE 3afb75d2 (ew-rim-before):** finished, 201 tests (ew-sweep/noxgear/s_base3).
- **Suite on this tree:** 106 of ~201 done (ew-sweep/noxgear/s_mine3) when it was stopped. Differences so far:
  - **test_hollow_fx_1191 FAILS on mine.** Its "whole fights ... tick-identical to BASE" check has Hollow fights that include Nox. FIX: in test_hollow_fx_1191.js, chain `require('./helpers/nox-magic-1194.js').undoNoxMagic1194(...)` the way the other older tests do. Check whether it loads through a helper chain, or add it to its own load / run.
  - test_admin_delete_guild failed on BASE only (flaky).
- **Browser battery:** not run yet. Run under the GPU lock: test_nox_magic_gear_1194, rim_breaker_1180, memory_budget_1140, condense_1141, offline_art_1154, skill_previews_1164, kharos_bloom_browser_1186.
- Don't rerun base; rerun only the rest of mine (or all of mine), then the browser battery.

## Then ship
- Re-check right before deploying:
  - v1194 is still free;
  - no other deploy is running;
  - the load copies are down and the helpers are on phase 5.
- Write SHIPPED-v1194-nox-magic-gear-17-10-2026.md (evidence, migration, live survey, win rates; see below), and touch the blueprint.
- Push main. Deploy with the CURRENT deploy_home.sh from the Archive (a private copy with ARCHIVE + TOOLS_DIR pinned), exact SHA, `--gate BLUEPRINT-IS-TRUTH`, all 8 machines.
- Post @ChatGPT @Grok, then report.

## What the commit does (unchanged from the earlier RESUME)
- **Evidence:** Veyr is the only other magic assassin, on assassin_mid. Nox was Magic but on assassin_other with the attack assassins.
- **Data:**
  - Nox glyph + equipment path -> assassin_mid.
  - His personal glyph tiers = Veyr's.
  - Ascension steps: Physical Attack -> Ability Power, Armor Pen -> Magic Pen, same amounts.
  - Base AP 31 (Veyr 34 x 40/44) in HERO_TYPES, server/sim.js and hero_base.json.
- **Gear map:** E13->E12, E31->E28, E39->E38, E49->E47, E56->E60, E84->E81.
- **Boot migration `migrateNoxMagic1194`:**
  - gear: same id, bound, active kept, higher Temper of the two types;
  - glyph board: exact-delta or top-up, slotted pre-choices swapped, marker noxMagic1194.
  - Dev read: /api/admin/nox-magic-plan.
- **Live:** S1 has 4 owners, 2 of them full Orange boards; S2 has 1 owner. No gear is equipped on Nox anywhere.
- **Proof on a copy of Server 1's world:** only those 2 boards change.
- **Win rate**, level 30, no gear (info only):

  | Fixture | Before | After |
  |---|---|---|
  | A front line | 56% | 75% |
  | B vs wide back line | 100% | 100% |
  | C with tanks | 100% | 100% |
  | D vs melee rush | 81% | 97% |

- **Flag for Phil:** a full magic board banks Ability Power 1558, where the attack board banked Physical Attack 717. That comes from Veyr's tier design.

## GPU lock
Not held by me. At the stop it was held by `saveship-tdiff`.
