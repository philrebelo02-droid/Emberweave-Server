#!/bin/bash
# ONE-COMMAND test runner (v232: genuinely green from a clean checkout).
#   npm ci && npx playwright install chromium && bash tests/run_all_tests.sh
# Works from a repo checkout (server.js at repo root) or a flat bundle dir.
# Fresh temp DB, two-phase ADMIN_IDS admin boot, every endpoint suite + probes + the ws and
# browser parity harnesses. `ws` and the Playwright browser are MANDATORY (set
# SKIP_BROWSER_PARITY=1 only for environments that genuinely cannot run a browser).
# Register caps are raised via env for fixtures only (REG_PER_MIN/REG_ACCOUNTS_PER_IP) — the
# production defaults are untouched. Cleanup signals ONLY the PID this runner started.
set -u
cd "$(dirname "$0")/.."   # v559: the runner cd-ed INTO tests/ and then called tests/... so every path resolved to tests/tests/... and the suite never ran
SRV=../server.js; [ -f ./server.js ] && SRV=./server.js
PORT=${PORT:-8871}
DBDIR=$(mktemp -d); DB="$DBDIR/db.json"
FLAGS="VAULT_MIN_BATTLE_MS=0 DUNGEON_V2_ENABLED=true GEAR_V2_ENABLED=true GUILD_WAR_V2_ENABLED=true REG_PER_MIN=200 REG_ACCOUNTS_PER_IP=200 GLYPH_RL_PER_MIN=1000"
FAILED=0; SRV_PID=""
cleanup(){ if [ -n "$SRV_PID" ] && kill -0 "$SRV_PID" 2>/dev/null; then
  kill "$SRV_PID" 2>/dev/null
  for i in 1 2 3 4 5; do kill -0 "$SRV_PID" 2>/dev/null || break; sleep 0.4; done
  kill -0 "$SRV_PID" 2>/dev/null && kill -9 "$SRV_PID" 2>/dev/null; fi; SRV_PID=""; }
trap cleanup EXIT
note(){ echo; echo "== $1 =="; }

note "dependency check (npm ci covers these)"
if node -e "require('ws')" 2>/dev/null; then echo "  ws ✓"; else
  echo "  ✗ 'ws' is missing — run: npm ci"; exit 1; fi
BROWSER_OK=0
if node -e "const p=require('playwright');if(!require('fs').existsSync(p.chromium.executablePath()))process.exit(1)" 2>/dev/null; then BROWSER_OK=1; echo "  playwright chromium ✓"; else
  if [ "${SKIP_BROWSER_PARITY:-0}" = "1" ]; then echo "  (browser parity skipped by SKIP_BROWSER_PARITY=1)"; else
    echo "  ✗ Playwright Chromium missing — run: npm ci && npx playwright install chromium (or set SKIP_BROWSER_PARITY=1)"; exit 1; fi; fi

note "phase 1: boot + create admin account"
env $FLAGS DB_FILE="$DB" PORT=$PORT node "$SRV" > "$DBDIR/srv1.log" 2>&1 & SRV_PID=$!
sleep 1.5
DID=$(curl -s -X POST localhost:$PORT/api/register -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['profile']['id'])")
sleep 1.2; cleanup
[ -z "$DID" ] && { echo "FATAL: admin bootstrap failed (see $DBDIR/srv1.log)"; exit 1; }

note "phase 2: restart with ADMIN_IDS and run the endpoint suites"
env $FLAGS ADMIN_IDS=$DID DB_FILE="$DB" PORT=$PORT node "$SRV" > "$DBDIR/srv2.log" 2>&1 & SRV_PID=$!
sleep 1.5
for T in test_transform.sh test_glyphs.sh test_dungeon.sh test_gear.sh test_war.sh; do
  note "$T"; bash "tests/$T" | tee "$DBDIR/$T.out" | grep -E "✗|PASS:"   # v1009: every failing check is printed (tail -3 hid 25 test_war failures for weeks)
  grep -q "FAIL: 0" "$DBDIR/$T.out" || FAILED=1
done
note "test_ws_revoke.js"
node tests/test_ws_revoke.js || FAILED=1
if [ "$BROWSER_OK" = "1" ]; then
  note "test_parity_harness.js (real client/server field comparison in Chromium)"
  node tests/test_parity_harness.js || FAILED=1
  note "test_determinism.js (the real battle sim, same seed → same fight)"
  node tests/test_determinism.js || FAILED=1
  note "test_live_campaign.js (v270: the fight the player played IS the fight the server recorded)"
  node tests/test_live_campaign.js || FAILED=1
  note "test_temple_ui.js (the Temple panel boots in a real browser; card power parity) - v995, Temple audit #12"
  node tests/test_temple_ui.js || FAILED=1
  note "test_temple_replay.js (a campaign replay with server-owned Temple progress) - v995, Temple audit #12"
  node tests/test_temple_replay.js || FAILED=1
fi
note "test_temple_of_ash.js (every Phil ruling in server/temple-of-ash.js) - v995, Temple audit #12"
node tests/test_temple_of_ash.js || FAILED=1
note "test_wall_routes.js (4 Oct City Wall audit #14: xp potion, refine, summon, skill up, quest claim, ladder - refusals and one effect per requestId)"
node tests/test_wall_routes.js || FAILED=1
note "test_wallet_quest_claim.js (a signed-in quest is paid once by the server, never by a local earn)"
node tests/test_wallet_quest_claim.js || FAILED=1
note "test_account_world.js (4 Oct Account + World audits: balance reports, save shape/size, attack-report retired)"
node tests/test_account_world.js || FAILED=1
note "test_world_account_p2.js (4 Oct World + Account P2s: legacy routes retired, cities limited, guests send no email codes)"
node tests/test_world_account_p2.js || FAILED=1
note "test_gear_epoch.js (3 Oct Pool+Forge audit #8: after a reset the same gear packet crafts again)"
node tests/test_gear_epoch.js || FAILED=1
note "test_device_keys.js (4 Oct Account audit #11: device ids stored as hashes; raw keys migrated at boot; guests still resume)"
node tests/test_device_keys.js || FAILED=1
note "test_account_v1007.js (4 Oct Account re-audit N2/N6: the guest daily cap survives the sweeper; the save is one string)"
node tests/test_account_v1007.js || FAILED=1
note "test_gear_plan_run.js (4 Oct Forge re-audit #1: a Quick Build that stops partway equips nothing)"
node tests/test_gear_plan_run.js || FAILED=1
note "test_v1010.js (4 Oct re-audit: backup token header-only, feedback inbox cap, one tx-spend requestId per offer, Emberdraft claim kept on a failed save)"
node tests/test_v1010.js || FAILED=1
note "test_v1011.js (4 Oct re-audit: heavy reads throttled per account; Tower refusals 400; Province reads write only on change)"
node tests/test_v1011.js || FAILED=1
note "test_admin_delete_guild.js (4 Oct re-audit Guild #5: a deleted account leaves its guild; leadership passes on; an emptied guild disbands)"
node tests/test_admin_delete_guild.js || FAILED=1
note "test_v1013.js (4 Oct re-audit Account N12 N16: replay chip shape; world chat only to signed-in chat sockets; no switch code while suspended)"
node tests/test_v1013.js || FAILED=1
note "test_feedback_api.js (player reports, dev-only feed, durable acknowledgment; wired v1013 - re-audit Arena N16)"
node tests/test_feedback_api.js || FAILED=1
note "test_banner_offline.js (4 Oct re-audit Guild #8: the raw word offline never reaches a player)"
node tests/test_banner_offline.js || FAILED=1
note "test_v1015.js (4 Oct re-audit Arena N7: rewarded runs left come from the server)"
node tests/test_v1015.js || FAILED=1
note "test_reset_recovery.js (4 Oct re-audit Account N7: a stranger cannot use up an account's password-recovery codes or guesses)"
node tests/test_reset_recovery.js || FAILED=1
note "test_arena_atomic.js (4 Oct release review #8: an arena win never reaches the disk without its receipt)"
node tests/test_arena_atomic.js || FAILED=1
note "test_net_gate.js (Phil 4 Oct: no play without the server - net gate; new accounts start from the starter ledger, M13)"
node tests/test_net_gate.js || FAILED=1
note "test_tank_hp.js (Phil 4 Oct: magic tanks ~18k, melee tanks ~22k at max from glyphs + base stats; old Bastion boards recomputed)"
NODE_PATH=${NODE_PATH:-} node tests/test_tank_hp.js || FAILED=1
note "test_auto_ult.js (Phil 4 Oct: a full-auto fight casts the player side's ultimates too - bot-city marches never did)"
node tests/test_auto_ult.js || FAILED=1
note "test_hero_keys_1023.js (Phil 4 Oct: real names - 20 hero keys renamed; saved data renamed once at boot)"
NODE_PATH=${NODE_PATH:-} node tests/test_hero_keys_1023.js || FAILED=1
note "test_glyph_paths_1022.js (Phil 4 Oct balance layer 1: boards banked under the old glyph paths are recomputed once at boot)"
NODE_PATH=${NODE_PATH:-} node tests/test_glyph_paths_1022.js || FAILED=1
note "test_player_truth.js (v270: the campaign result is the player's own transcript, replayed)"
node tests/test_player_truth.js || FAILED=1
note "test_campaign_player_truth.js (28 Sep fight rule: the witnessed win is paid on a replay mismatch, once; a malformed verdict is refused)"
PORT=$PORT node tests/test_campaign_player_truth.js || FAILED=1
note "test_authority_hardening.js (v272: a forged line-up cannot buy power)"
node tests/test_authority_hardening.js || FAILED=1
note "test_audit_response.js (v273: unverified-on-mismatch, resume, server-owned grants, blob stripped)"
node tests/test_audit_response.js || FAILED=1
note "test_action_stream.js (v274: live action receipts — the server owns the sequence and the tick)"
node tests/test_action_stream.js || FAILED=1
note "test_forged_state.js (v274: forged local gear/wallet/progression cannot reach a battle)"
node tests/test_forged_state.js || FAILED=1
cleanup
note "Witches Hut and world-map mechanics (server-side checks)"
node tests/mine-no-daily-cap-http.cjs || FAILED=1
node --test tests/mine-no-daily-cap.test.js tests/durability-compatibility.test.js tests/durable-commit.test.js tests/durable-routes.test.js tests/pool-wish-durable.test.js tests/watch-report-durable.test.js tests/quest-chain-durable.test.js tests/witches-hut.test.js tests/witches-hut-api.test.js tests/world-location.test.js tests/world-mines.test.js tests/world-mine-realtime.test.js tests/world-pvp-realtime.test.js tests/world-war-current.test.js tests/world-bot-roster.test.js || FAILED=1
note "test_crash_idempotency.sh (v273: a reward cannot be paid twice across a crash)"
bash tests/test_crash_idempotency.sh || FAILED=1

note "probes (no server needed)"
node tests/test_hero_profiles.js || FAILED=1
node tests/test_hero_id_rename.js || FAILED=1
node tests/test_sim_parity.js || FAILED=1
node tests/test_glyph_flow.js || FAILED=1
node tests/test_vault_gate.js || FAILED=1
node tests/test_war_bracket.js || FAILED=1
node tests/test_campaign_curve.js || FAILED=1
node tests/test_farm_map.js || FAILED=1
node tests/test_flags_default.js || FAILED=1
node tests/test_power_sources.js || FAILED=1
node tests/test_prayer_authority.js || FAILED=1
node tests/test_world_mine_durable.js || FAILED=1
node tests/test_watch_privacy.js || FAILED=1
node tests/test_world_city_recall.js || FAILED=1
note "test_tower_server.js (3 Oct audit P0: the Tower of Trials is server-owned; v948 numbers floor by floor)"
node tests/test_tower_server.js || FAILED=1
note "test_durable_buildings.js (3 Oct audit: Vault/Hut/Emberdraft/trial/Well answer 503 on a failed save, nothing moves)"
node tests/test_durable_buildings.js || FAILED=1
note "test_well_audit.js (3 Oct audit: Starless Well held-fight double pay + forged sweep path)"
node tests/test_well_audit.js || FAILED=1
note "test_witch_client_rid.js (3 Oct audit: Witches Hut keeps one requestId until a definite answer)"
node tests/test_witch_client_rid.js || FAILED=1
note "test_ed_buy_rid.js (3 Oct audit: Emberdraft buy keeps one requestId until a definite answer)"
node tests/test_ed_buy_rid.js || FAILED=1
note "test_well_pending_resend.js (3 Oct audit: a lost Well result is re-sent with the same requestId on the next Well load)"
node tests/test_well_pending_resend.js || FAILED=1
note "test_vault_pending_resend.js (3 Oct audit: a lost Vault floor result is re-sent with the same requestId before any new floor)"
node tests/test_vault_pending_resend.js || FAILED=1
note "test_pending_ownership.js (3 Oct: saved results keyed by the real ACC.id, account-fenced, kept on uncertain replies)"
node tests/test_pending_ownership.js || FAILED=1
note "test_ed_prev_attempt.js (3 Oct audit: a match started on another device does not strand the first match claim)"
node tests/test_ed_prev_attempt.js || FAILED=1
note "test_audit_small_fixes.js (3 Oct audit: Vault paid sweep floor check first; Emberdraft buy level 25; Emberdraft state by GET)"
node tests/test_audit_small_fixes.js || FAILED=1
note "test_well_state_read.js (3 Oct audit: a Well state read saves only when it changed the run)"
node tests/test_well_state_read.js || FAILED=1
note "test_vault_status_client.js (3 Oct audit: an unreachable Vault no longer renders the legacy Challenge Dungeon)"
node tests/test_vault_status_client.js || FAILED=1
note "test_witch_state_rate.js (3 Oct audit: Witches Hut state reads limited to 60 a minute)"
node tests/test_witch_state_rate.js || FAILED=1
note "test_vault_underpower_review.js (Phil 3 Oct: a Vault win below 80% of recommended power files a review case for Ember)"
node tests/test_vault_underpower_review.js || FAILED=1
note "test_resource_names_costs.js (Phil 3 Oct: Emberite/Voidglass/Starsilver/Cinderwood; every skill costs 2 equal materials)"
node tests/test_resource_names_costs.js || FAILED=1
note "test_academy_economy.js (Phil 3 Oct: Academy to 120, all-four costs, hourly income; Witches Hut upgrade = half Academy + 75% brew)"
node tests/test_academy_economy.js || FAILED=1
note "test_academy_read_durable.js (3 Oct release review: a read that pays Academy income commits durably; refused save -> 503, nothing moves)"
node tests/test_academy_read_durable.js || FAILED=1
note "test_mine_levels_ten.js (Phil 3 Oct: region mines 1-6, level 6 at the edge; wild 7-10; nodes keep place/id)"
node tests/test_mine_levels_ten.js || FAILED=1
note "test_market_harden.js (3 Oct Market audit: never-sold hero fragments refused; meal at full stamina refused; spend/earn durable)"
node tests/test_market_harden.js || FAILED=1
note "test_pool_forge_harden.js (3 Oct Pool/Forge audit: gear only on owned heroes; free diamond wish countdown = New York midnight)"
node tests/test_pool_forge_harden.js || FAILED=1
note "test_star_track.js (3 Oct Market audit #1: the campaign star track is server-owned; tx/earn stars removed)"
node tests/test_star_track.js || FAILED=1
note "test_signin.js (3 Oct Market audit #1: the daily sign-in is server-owned; tx/earn signin removed)"
node tests/test_signin.js || FAILED=1
note "test_guild_shop.js (3 Oct Market audit #1: guild shop currency items are server purchases; tx/earn guildshop removed)"
node tests/test_guild_shop.js || FAILED=1
note "test_arena_guild_harden.js (3 Oct Arena+Guild audits: elite route retired, sweep dedupe, raid replay-or-nothing, contribute at max, arena level 10)"
node tests/test_arena_guild_harden.js || FAILED=1
note "test_proto_keys.js (4 Oct City Wall audit #1/#3: prototype-named request values refused before any route; /api/daily retired)"
node tests/test_proto_keys.js || FAILED=1
note "test_glyph_durable.js (4 Oct City Wall audit #4: a glyph build is saved before it is acknowledged; 503 on a failed save)"
node tests/test_glyph_durable.js || FAILED=1
note "test_guild_durable.js (4 Oct Guild audit #5: contribute and raid start are durable commits with the guild)"
node tests/test_guild_durable.js || FAILED=1
note "test_pool_forge_p2.js (3 Oct Pool+Forge audit #5 #18: legacy eq/craft retired; pool wishes rate-limited)"
node tests/test_pool_forge_p2.js || FAILED=1
note "test_account_lockout.js (4 Oct Account audit #5 #10 #17: per-IP lockout, server logout, in-game NPC names)"
node tests/test_account_lockout.js || FAILED=1
note "test_watch_report_rate.js (3 Oct Guild audit #7: an unchanged watch report does not save; 12 changed a minute)"
node tests/test_watch_report_rate.js || FAILED=1
note "test_raid_durable.js (3 Oct Guild audit #2: the raid result saves the reward and the guild together, 503 on a failed save)"
node tests/test_raid_durable.js || FAILED=1
note "test_skyfall_ghost.js (3 Oct Guild audit #6: a deleted guild leaves Skyfall registration; the lock drops ghosts)"
node tests/test_skyfall_ghost.js || FAILED=1
note "test_guild_p2.js (3 Oct Guild audit #11 #12 #13: guild name rules, no literal entities, no banners in browse)"
node tests/test_guild_p2.js || FAILED=1
note "test_wall_guards.js (4 Oct City Wall audit #6: a skill the hero's quality has not unlocked cannot be upgraded)"
node tests/test_wall_guards.js || FAILED=1
note "test_temple_acad_p2.js (4 Oct Temple+Academy audit #6 #7 #13 #14)"
node tests/test_temple_acad_p2.js || FAILED=1
note "test_atkspd_clip_1024.js (v1024: every attack-speed source speeds the attack/crit clip and the blow lands on its contact frame; Bloodthirst)"
node tests/test_atkspd_clip_1024.js || FAILED=1
note "test_account_wide_1035.js (v1035: a ban and a password reset on the account server follow the account to Servers 2-4; two real servers)"
node tests/test_account_wide_1035.js || FAILED=1
note "test_group_save_1036.js (v1036: 60 durable actions at once share a few whole-world saves; a failed save answers 503, reaches no disk and is undone)"
node tests/test_group_save_1036.js || FAILED=1
note "test_battle_workers_1036.js (v1036: city battles run on a worker thread and replay to the same winner on the ordinary engine; SIM_WORKERS=0 control)"
node tests/test_battle_workers_1036.js || FAILED=1
rm -f probe-db-*.json
echo
if [ $FAILED -eq 0 ]; then echo "ALL SUITES GREEN ✅"; else echo "FAILURES — see $DBDIR"; fi
exit $FAILED
