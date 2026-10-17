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
FLAGS="ALLOW_NEW_GUESTS=1 VAULT_MIN_BATTLE_MS=0 DUNGEON_V2_ENABLED=true GEAR_V2_ENABLED=true GUILD_WAR_V2_ENABLED=true REG_PER_MIN=200 REG_ACCOUNTS_PER_IP=200 GLYPH_RL_PER_MIN=1000"
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
note "test_well_sweep_1110.js (v1110: a Well sweep pays 80% of a played run; every fight a potion; every chest diamonds)"
node tests/test_well_sweep_1110.js || FAILED=1
note "test_engine_fixes_1114.js (v1114: chantzone/hornetswarm level once, Magic counters off AP, airborne counts down)"
node tests/test_engine_fixes_1114.js || FAILED=1
note "test_battle_load_1120.js (v1120: spell plates share one sheet, auto-attack balls / Fritz bolt / void zone on the loading list, stall-based load gate with 45 s ceiling; control: v1119 fails all)"
node tests/test_battle_load_1120.js || FAILED=1
note "test_server_down_1120.js (v1120: connection-lost screen names the server, DOWN on serverDown, lists other servers, Retry feedback + reconnect, socket drop checks at once; control v1119)"
node tests/test_server_down_1120.js || FAILED=1
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
note "test_world_mine_sync_levels.js (v1131: the signed-in map client accepts every level the server deals, 1-10; live field + levels 1-10 all kept; 0/11 refused; control: v1130 sync file drops the field)"
node tests/test_world_mine_sync_levels.js || FAILED=1
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
note "test_signup_gate_1184.js (v1184: password hashing off the main thread, each server hashes its own players, look-alike name index = the old scan, lockout, three real servers)"
node tests/test_signup_gate_1184.js || FAILED=1
note "test_group_save_1036.js (v1036: 60 durable actions at once share a few whole-world saves; a failed save answers 503, reaches no disk and is undone)"
node tests/test_group_save_1036.js || FAILED=1
note "test_battle_workers_1036.js (v1036: city battles run on a worker thread and replay to the same winner on the ordinary engine; SIM_WORKERS=0 control)"
node tests/test_battle_workers_1036.js || FAILED=1
note "test_world_store_1037.js (v1037: per-player storage - partial saves, all-or-nothing commits, hard-kill survival, split <-> one-file conversion; one-file control)"
node tests/test_world_store_1037.js || FAILED=1
note "test_world_load_guard_1183.js (v1183: a world that will not load never becomes an empty world; durable saves; pinned backup; push guard; recover tool; live-code control fails)"
node tests/test_world_load_guard_1183.js || FAILED=1
note "test_march_retention_1038.js (v1038: settled city/mine marches are held 2 days, then let go - for every player; unfinished kept; v1037 control)"
node tests/test_march_retention_1038.js || FAILED=1
note "test_sim_helper_1039.js (v1039: battle helpers - a backed-up pool shares battles with server/sim-helper.js; identical results, spot checks; wrong key / other engine / busy / dead helper fall back locally; no-helper control)"
node tests/test_sim_helper_1039.js || FAILED=1
note "test_major_war_1040.js (v1040: battle helper major-war mode - below-normal priority and more battles at once on World Tree day or unbroken strain; real server on/off World Tree day)"
node tests/test_major_war_1040.js || FAILED=1
note "test_cluster_help_1041.js (v1041: the cluster helps itself - tier 1 cluster before tier 2 PC, dedicated serve lists, shared half-machine share, a strained home server refuses help, phase file live, loopback-only strain endpoint)"
node tests/test_cluster_help_1041.js || FAILED=1
note "test_war_reports_1042.js (v1042: receipts 1 h; both players get the city attack report with the fight in war mail; war tab keeps 50; one report per march)"
node tests/test_war_reports_1042.js || FAILED=1
note "test_share_rule_1043.js (v1043: one slow second is not strain - 3 of 5 seconds is; helpers count battles per server)"
node tests/test_share_rule_1043.js || FAILED=1
note "test_konwu_1044.js (v1044: KonWu Phantom Step dropkick - 8 m knockback, stun, 1.5x chase; 5 m Cleaving Arc; the eight new sheets)"
node tests/test_konwu_1044.js || FAILED=1
note "test_grok_fx_1044.js (v1044: Grok's fifteen spell plates - sheet sizes, display time = sheet length, Perfect Pitch / Deep Reserves hooks)"
node tests/test_grok_fx_1044.js || FAILED=1
note "test_toxic_breath_1045.js (v1045: Bloatus Toxic Breath - plume from the mouth on the exhale, cast 0.9 s, no swing during the breath)"
node tests/test_toxic_breath_1045.js || FAILED=1
note "test_walk_loops_1047.js (v1047: each walk plays a measured stride loop - no wrap to the start pose, no still frames, no 1,0 tail)"
node tests/test_walk_loops_1047.js || FAILED=1
note "test_sound_1048.js (v1048: the sound system - silent on the server and in replays, never touches a fight; v1124: random ult line)"
node tests/test_sound_1048.js || FAILED=1
note "test_hero_voices_1124.js (v1124: Vael's voice - 3 ult lines + lore read, approved bytes, no orphans, not in the startup download)"
node tests/test_hero_voices_1124.js || FAILED=1
note "test_shop_1050.js (v1050: the diamond shop is server-side - purchases credited by the server, plans paid from purchased days, the old pack earn closed)"
node tests/test_shop_1050.js || FAILED=1
note "test_free_packs_1135.js (v1135: pre-beta free packs - every player takes any shop pack free via provider prebeta, server-credited, and since v1139 counted toward EGP/Patron like the paid pack (free:true); SHOP_FREE_PACKS=0 turns it off; control: BASE refuses the free claim)"
node tests/test_free_packs_1135.js || FAILED=1
note "test_veyr_undertow_1136.js (v1136: Veyr's Abyssal Undertow slows 2 s (ccDur) instead of silencing, same damage as BASE; Absalie's Event Horizon unchanged; fights without Veyr tick-identical to BASE; control: BASE fails the slow check)"
node tests/test_veyr_undertow_1136.js || FAILED=1
note "test_servers_1051.js (v1051: the in-game server list holds Servers 1-5; /switch forwards server 5)"
node tests/test_servers_1051.js || FAILED=1
note "test_temper_type_1054.js (v1054: Temper belongs to the item type - every copy, on every hero, one Temper; Resonance counts a type once)"
node tests/test_temper_type_1054.js || FAILED=1
note "test_sloe_volley_1069.js (v1069: Sloe ult arrow volley, staggered per target)"
node tests/test_sloe_volley_1069.js || FAILED=1
note "test_zahri_solar_1070.js (v1070: Solar Impalement burst rides the lance tip)"
node tests/test_zahri_solar_1070.js || FAILED=1
note "test_oakmir_roots_fx_1071.js (v1071: Deep Roots cage grows on the rooted ally)"
node tests/test_oakmir_roots_fx_1071.js || FAILED=1
note "test_zahri_stampede_trail_1072.js (v1072: Noonday Stampede flame trail)"
node tests/test_zahri_stampede_trail_1072.js || FAILED=1
note "test_oakmir_ult_badge_1073.js (v1073: Oakmir ult badge 0.45; the single-target badge path passes badgeSize)"
node tests/test_oakmir_ult_badge_1073.js || FAILED=1
note "test_linnet_rewind_1074.js (v1074: Rewrite the Pattern swirl over every ally the rewind touches, the revived too)"
node tests/test_linnet_rewind_1074.js || FAILED=1
note "test_rafe_fortune_1075.js (v1075: Dead Man's Fortune tracer per shot, spark on the chest when it lands)"
node tests/test_rafe_fortune_1075.js || FAILED=1
note "test_sealing_wax_1076.js (v1076: Sealing Wax eruption then the wax pool for the coat)"
node tests/test_sealing_wax_1076.js || FAILED=1
note "test_final_candle_1077.js (v1077: Court of the Final Candle - wax spreads to 7 m, each hero encased when the edge reaches it)"
node tests/test_final_candle_1077.js || FAILED=1
note "test_exploits_1078.js (v1078 exploit scan: arena opponent must be offered, defender report = real squads, bot-castle loot no longer throws)"
node tests/test_exploits_1078.js || FAILED=1
note "test_arena_coins_1079.js (v1079 exploit scan #2: arena coins are the server's - the arena shop and coin packs are server purchases, tx/earn arenashop closed)"
node tests/test_arena_coins_1079.js || FAILED=1
note "test_scan2_1080.js (v1080 scan round 2: look-alike names refused, rename through the server, no castle for bots, no loot from an undefended castle)"
node tests/test_scan2_1080.js || FAILED=1
note "test_shields_1081.js (v1081 scan 2 #1: protection shields are the server's - bought, activated and checked on war/attack)"
node tests/test_shields_1081.js || FAILED=1
note "test_caps_1082.js (v1082 scan 3: no full charge for a clipped grant; guest rename; local guild diamonds)"
node tests/test_caps_1082.js || FAILED=1
note "test_abuse_1083.js (v1083 scan 5 batch A: reads save only on change, per-account limits, chat history/saves throttled, 1.2 MB saves, guild log caps)"
node tests/test_abuse_1083.js || FAILED=1
note "test_abuse_1084.js (v1084 scan 5 batch B: one replay per attempt in flight, pvp attack limit, report day cap)"
node tests/test_abuse_1084.js || FAILED=1
note "test_daykeys_1086.js (v1086 scan 7: the Temple module default day, the Vault rotation and reset time follow the 09:00 ET game day)"
node tests/test_daykeys_1086.js || FAILED=1
note "test_gates_1087.js (v1087 scan 8: Guild Hall level 13, Tower 40 / Vault 10 on trial resolve, Gauntlet retired, arena shop level 10, market shield per clock hour)"
node tests/test_gates_1087.js || FAILED=1
note "test_scan9_1088.js (v1088 scan 9: an arena win never pays less than a loss; replay chips keep only replay fields, units capped at 2,000 bytes)"
node tests/test_scan9_1088.js || FAILED=1
note "test_await_ledger_1089.js (v1089 scan 10: handlers take the ledger after their last await - bonus pot, bonus first clear, province, Emberdraft, Well, quests, academy)"
node tests/test_await_ledger_1089.js || FAILED=1
note "test_acct_sync_1090.js (v1090 scan 11: satellites re-check accounts holding a local password copy, so a reset on Server 1 retires the old password everywhere)"
node tests/test_acct_sync_1090.js || FAILED=1
note "test_bad_target_1091.js (v1091 scan 12 P0: an unparseable request target answers 400 instead of crashing the process)"
node tests/test_bad_target_1091.js || FAILED=1
note "test_patron_1092.js (v1092 EGP/EDP: paid base diamonds, levels, rebate, daily attacks, buy attacks, prestige, EGP rows)"
node tests/test_patron_1092.js || FAILED=1
note "test_mythic_pool_1092.js (v1092 Mythical Pool at EGP 11, 400 diamonds, Phil's odds; KonWu out of the Diamond Pool; attack buys from EGP 3; attack card)"
node tests/test_mythic_pool_1092.js || FAILED=1
note "test_patron_1093.js (v1093 Phil's benefit chart as the standard: purchases from 1, Elite/Arena resets, double gold, Shady discount, armies out, chat tags)"
node tests/test_patron_1093.js || FAILED=1
note "test_account_delete_1097.js (v1097 sweep #16 #17: delete your own account - typed confirmation + password + requestId, personal data and sessions gone, records anonymised; a guest makes an account keeping its id and ledger)"
node tests/test_account_delete_1097.js || FAILED=1
note "test_account_delete_wide_1097.js (v1097 sweep #17: a delete on Server 2-5 deletes the game-wide account on Server 1; other satellites drop their player)"
node tests/test_account_delete_wide_1097.js || FAILED=1
note "test_chat_safety_1097.js (v1097 sweep #18 + Phil 9 Oct: chat unmasked (18+), slurs refused in names, server-side block, report reasons: racism / harassment to the moderation queue with context, other to feedback)"
node tests/test_chat_safety_1097.js || FAILED=1
note "test_admin_ban_1097.js (v1097 Phil 9 Oct: admin Delete became Ban - 1/7/14/28 days or permanent, unban, 403 with the date on sign-in and every route, sockets closed, expired ban lifts itself)"
node tests/test_admin_ban_1097.js || FAILED=1
note "test_temple_v2_1094.js (v1094 Temple of Ash v2: four flat bars in steps, cap by Temple level, all four roll, cancel never refunds, power = 10 x steps, blessings, auto pray, discounts, migration, client/server unit parity)"
node tests/test_temple_v2_1094.js || FAILED=1
note "test_temple_blessings_1096.js (v1096 personal Temple blessings: 60 heroes x 4 own rewards, Oakmir = Phil's example, labels, class fallback, 5th dot +15% on blessings only, server applyCore = client applyClient)"
node tests/test_temple_blessings_1096.js || FAILED=1
note "test_temple_bars_1098.js (v1098 hero-specific Temple bars: 60 heroes x their own 4 bars, step per kind, Power = 10 x steps, thresholds on bar slots, v1096 -> own bars migration (positional, idempotent, dots kept), server = client battle unit for all 60 + a broken-client control, r1098 script tags)"
node tests/test_temple_bars_1098.js || FAILED=1
note "test_academy_flat_1098.js (v1099 Academy is flat numbers: client = server tables, server unit = client unit for all 60 heroes at tracks 30 and 60, no % on the Academy screen, castle art follows the Academy level, /api/world/cities carries the owner academy level, controls)"
node tests/test_academy_flat_1098.js || FAILED=1
note "test_academy_v2.js (Academy v2 11 Oct: tracks atk hp ap heal armor mr crit critres, crit/critres/heal 200 = 10% at 60, atk = ap, heal -> healPow + shieldStr server = client, crit resist subtracts from crit damage, Defense rating off crit chance, old def saves harmless, control on v1122)"
node tests/test_academy_v2.js || FAILED=1
note "test_defense_sources.js (Academy v2: Defense from glyphs 300 + equipment 300 + prayer 200 = 800 = 40% on a fully built tank, server = client, non-tank glyphs/gear unchanged, control on v1122)"
node tests/test_defense_sources.js || FAILED=1
note "test_temple_screen_1094.js (v1094 the Temple screen copies the reference: grid, hero bust, bars with green / red change and %, Power, Blessings + 5th dot, Flame Keeper, Save / Cancel, Auto pray)"
node tests/test_temple_screen_1094.js || FAILED=1
note "test_arena_sweep_1097.js (v1097 sweep 9 Oct: Arena daily claim pays its coins, attempts + buy button, Patron reset returns only free attempts)"
node tests/test_arena_sweep_1097.js || FAILED=1
note "test_world_sweep_1097.js (v1097 sweep 9 Oct: a shield stops a march on arrival; Scout and Defend reach the server)"
node tests/test_world_sweep_1097.js || FAILED=1
note "test_well_fallen_1097.js (v1097 sweep 9 Oct: a Well hero missing from the final summary has fallen)"
node tests/test_well_fallen_1097.js || FAILED=1
note "test_shop_sweep_1097.js (v1097 sweep 9 Oct: Market sells the server's hourly offers only; summon table; bonus claim; Wish Again Mythical)"
node tests/test_shop_sweep_1097.js || FAILED=1
note "test_emoji_ratchet.js (Phil 9 Oct: no more emojis - the count may only go down)"
node tests/test_emoji_ratchet.js || FAILED=1
note "test_sweep_temple_1097.js (v1097 sweep P0: a reused requestId never replays Temple rolls; a held prayer above the Temple level is refused before it is spent)"
node tests/test_sweep_temple_1097.js || FAILED=1
note "test_sweep_trials_1097.js (v1097 sweep P0: the hidden Tower ladder on /api/trial/resolve is retired; the dungeon kind stops at the last built floor)"
node tests/test_sweep_trials_1097.js || FAILED=1
note "test_sweep_emberdraft_1097.js (v1097 sweep P0: Emberdraft always pays the claimed place; a claim the round record does not show files an Ember review case with the stake)"
node tests/test_sweep_emberdraft_1097.js || FAILED=1
note "test_sweep_veteran_cap_1097.js (v1097 sweep P0: Veteran x-3/6/9 sweeps count toward and respect the 3-a-day run cap the fights use)"
node tests/test_sweep_veteran_cap_1097.js || FAILED=1
note "test_veteran_1148.js (v1148: Veteran 1-16 = Normal x2 on all 160 stages, rewards above Elite, Elite-chapter gates, every stage capped like Elite)"
node tests/test_veteran_1148.js || FAILED=1
note "test_icons_1098.js (v1098: every icon the page asks for exists; Wishing Pool is the stage-fit layout; control: a missing icon is caught)"
node tests/test_icons_1098.js || FAILED=1
note "test_icons_1100.js (v1100: hero fragments are the hero card; the 20 approved icons on disk and used; control: old mine mail still routes)"
node tests/test_icons_1100.js || FAILED=1
note "test_forge_retry_1101.js (v1101: a failed Forge load offers Retry, not 'being built'; control: server enabled:false)"
node tests/test_forge_retry_1101.js || FAILED=1
note "test_living_tallow_1102.js (v1102: Living Tallow encase 1 s + 0.015 s per level, fight and card agree)"
node tests/test_living_tallow_1102.js || FAILED=1
note "test_skill_levels_1112.js (v1112: skill levels - bug fixes, per-level gains, level-100 nerfs; fight, card and hover agree at 1/50/100; controls: old wrong-way DR, uncapped shred)"
node tests/test_skill_levels_1112.js || FAILED=1
note "test_gruel_anim_nine.js (v1103: Gruel's nine approved animations - sheets on disk, grids fit, timing, kit unchanged; control: a broken copy fails)"
node tests/test_gruel_anim_nine.js || FAILED=1
note "test_grosk_anim_eight.js (v1112: Grosk's eight approved animations - sheets, grids, Hammer Fists punches at full extension 1.083/2.0/2.833 s, Croc Drop slam on the landing 2.833 s; controls: the instant flurry and a broken grid fail)"
node tests/test_grosk_anim_eight.js || FAILED=1
note "test_umbris_anim_eight.js (v1115: Umbris's eight approved animations - sheets, grids, release cells: Creeping Rot cell 13, Shadeburst cell 17, Cataclysm orb cell 26, bolt cell 18 on the 0.6724 fight clock; controls: the v1114 casts/fuses miss and a broken grid fails)"
node tests/test_umbris_anim_eight.js || FAILED=1
note "test_pellucid_attack_crit_1115.js (v1115: Pellucid's approved haymaker ATTACK + front-kick CRIT - sheets, grids, same ground line, blow on cell 13 / kick on cell 10, damage unchanged, other states untouched; controls: the c2354ddd entries and a broken grid fail)"
node tests/test_pellucid_attack_crit_1115.js || FAILED=1
note "test_pellucid_redo1.js (Pellucid redo1: approved GREEN Meteor Knuckle / BLUE Infernal Clinch / ULT Worldbreaker Fists sheets - grids, ground line, the game event lands on the contact cell (green 17, blue 9, ult 14/26/39), root stays 2.0 s, fights tick-identical old vs new; controls: old entries miss the cells, no root:2 diverges)"
node tests/test_pellucid_redo1.js || FAILED=1
note "test_vex_ceraline_fx_1115.js (v1115: Grok spell FX 22-24 - Mourning Bell ring + wax shatter, Hookline reel (Vex pulled on the rope retract, clip 0.458-0.958 s) + slash, Bleed Them Dry wound; controls: v1114 teleport/instant strike fail, art touches no fight state)"
node tests/test_vex_ceraline_fx_1115.js || FAILED=1
note "test_spell_fx_1125.js (v1125: Grok spell FX s07 Astra Event Horizon flat on the aimed 8 m circle, the planet lands on the damage; s08 Korvux Ember Cleave riding his axe swing, flash on his impact frame 28; parity with main for both casts and the five held-back v1123 spells; controls: main has none of the art, the art code touches no fight state, none of the five spells' art ships)"
node tests/test_spell_fx_1125.js || FAILED=1
note "test_hollow_anim_ten.js (v1126: Hollow's ten approved animations - sheets, grids, measured anchors; the art cut to land on the v1123 engine moments: blow drawn on attack cell 28 / crit cell 25 (rig-measured), Fan of Knives cell 8, Lacerate cell 17, drop touchdown cell 16, Vanishing Point phases, passive on the miss he causes; control: the same fights on v1123 land on the same ticks, a broken grid fails)"
node tests/test_hollow_anim_ten.js || FAILED=1
note "test_skill_anim_hold.js (v1127 skill hold: a swing replaces a green/blue clip only after the clip has drawn past its contact cell (clipContactCell: contact/release/apex/relFrac, else halfway), then starts caught up; 5 whole fights through the real engine + syncMesh tick-identical new/old/no renderer incl. RNG draws; controls: v1126 renderer cuts early, a hold leaking into atkCd moves the trace; v1131 passive hold: no timed passive over a green/blue before contact or an unfinished ult, no passive filler under CC/silence, 9 fights tick-identical, control: v1130 passive renderer)"
node tests/test_skill_anim_hold.js || FAILED=1
note "test_askel_vesper_vex.js (v1128: Askel five - attack/crit/green/blue/ult sheets, grids, standing-pose anchors; timing data = v1127 (attack/crit clipDur x relFrac 1.0, ult root 2.0 s, kit/ult numbers); control: the same scripted actions and whole fights (Askel/Vesper/Vex both sides) on v1127 land on the same ticks; art on the engine moments: blow drawn on attack cell 23-24 / crit 27, Standard Crash green cell 25, Rallying Ground blue cell 15, ult charge phases (launch 14, stride loop, lift ends on arrival, slam cell 28); Vesper Puncture tear closes as the effect ends, Vex Razor Tempest standing; FX helpers draw only; controls: root removed + swing moved diverges, a broken grid fails)"
node tests/test_askel_vesper_vex.js || FAILED=1
note "test_tessit_hourglass.js (v1189, built as v1134, re-cut to the 2048 phone cap: Grok s11 Tessit Hourglass - the hourglass shatters on the land tick, the sand frozen for the stun the case left (ccDur 1.4 s), then falls, alpha fade; standing on the 4.3 m stun circle centre; scripted ults + whole fights identical to live 551eebd8; controls: main fails the art checks, a cut stun diverges, the art code writes no fight state)"
node tests/test_tessit_hourglass.js || FAILED=1
note "test_hurne_attack_crit.js (v1132: Hurne swapped ATTACK haymaker / CRIT punch - new sheets, grids, standing-pose anchors (figH 541); timing data = BASE (clipDur 2.0, x relFrac = 1.0 clip s), kit numbers; control: scripted swings, forced crit, summons, Feed Them and whole fights (heroes carry BATTLE_ANIM as the server replay) on BASE land on the same ticks with his crit at 0, and at his real 3% equal BASE + the v532 crit-clip rule; blow drawn on attack cell 26 / crit cell 22 (natural-speed swing, rig-measured 31 ticks); controls: swing moved + crit slowed diverges, the rule control differs, a broken grid fails)"
node tests/test_hurne_attack_crit.js || FAILED=1
note "test_summon_level_1145.js (v1145: a summon is built at its owner's FIGHT level, never from the device save - three real tester fights replay identically with a blank save and with the player's save; summons made; control repeat identical)"
node tests/test_summon_level_1145.js || FAILED=1
note "test_maren_orryn_anim.js (Maren attack/Tide Pool/Tsunami/Maelstrom + Orryn attack/Pressure Sphere/Spiral Current - new ?v=1135 sheets from the CLEAN NO WATERMARK exports, grids under 4096, frame-0 standing-pose anchors, flips as each hero; timing data = BASE (clipDur 2.0, relFrac 0.5), kits identical; control: scripted swings, casts (cast tick, skill hold, every unit 6 s) and whole fights (both heroes both sides, heroes carry BATTLE_ANIM as the server replay) on BASE land on the same ticks; release drawn on the rig-measured cells (Maren attack 17, green 11, blue 13, ult 20; Orryn green/blue 16, attack 27-28 fitted); controls: moved timing diverges, a longer clip changes the skill hold, a broken grid fails)"
node tests/test_maren_orryn_anim.js || FAILED=1
note "test_rivet_weapons.js (v1137 Rivet's ten weapons - gameplay change: ranged 5-cycle gatling/revolver/saw/bolt/cannon beyond 3 m of ground, melee 4-cycle blade/hammer/upper spike/lower spike within 3 m (3 m exactly = melee), re-evaluated every attack, own counter per group; every weapon effect at Phil's numbers (gatling 9x15%, revolver 120% +15% crit, saw 70% + 50% bleed 4 s, bolt 100% ignores 50% armour, cannon 75% in a 45-degree 20 m cone, blade 160%, hammer 100% + stun, upper spike 80% + silence, lower spike 130% + armour -20% 5 s; CC through ccApply); automatic chain hook on a dash/teleport out of 3 m (50% + stun, pulled back); fights WITHOUT Rivet tick-identical to BASE; the swing fuse unchanged (ranged rounds on BASE's hit tick, melee on the fuse); new ?v=1137 sheets; controls: Rivet fights differ from BASE, knock-back/stunned/never-near do not hook, bolt crit 0, a wrong number fails)"
node tests/test_rivet_weapons.js || FAILED=1
note "test_spell_fx_1123.js (v1123: Grok spell FX - Sorrel Marked Deal cards + sparks, Carn Crimson Reap crescent, Tharl Scale Ram quake, Kon-Wu Ruyi slam (art starts at the press, slam on the 1 s release), Rhukk Dig In roar + shell; parity with v1121 on every tick; controls: v1121 has none of the art, the art code touches no fight state)"
node tests/test_spell_fx_1123.js || FAILED=1
note "test_auto_ult_healer_1103.js (v1103: healer ults that also hit enemies fire when full; heal-only ones still wait)"
node tests/test_auto_ult_healer_1103.js || FAILED=1
note "test_combat_sfx_1138.js (v1138 combat sound: every Phil pick -> assets/audio/sfx (227 files, new ?v=1138), manifest = page SFX_DATA, every hero an attack sound; loudness re-measured within +-2 LU of -16 LUFS-M + Phil's offsets (control: +8 dB fails); 11 whole fights with the sound path LIVE tick-identical to BASE and to sound off (controls: a moved swing and a hook touching a unit diverge); every sound PEAK within one 33 ms frame of the frame its blow / release / arrival is drawn on an uneven phone clock at speed 1 and 2 (control: a 0.1 s wrong peak fails); Vex 3 cuts / 3 files on the tempest slash cells, Croc Drop lift-off + landing, Hammer Fists x3, Ceraline wax reuse, Tick once; every hero every slot sounds)"
node tests/test_combat_sfx_1138.js || FAILED=1
note "test_front_door_1130.js (v1130: new players go to the next server - S1 below 1500 -> S1, at 1500 -> S2, hysteresis to 1300, S1 down -> S2, a stale count is unknown, existing accounts never move, the list still joins a busy S1; real servers + the page in Chromium; controls)"
node tests/test_front_door_1130.js || FAILED=1
note "test_won_never_defeat_1145.js (v1145: a campaign fight the PLAYER WON never shows DEFEAT - a reply of No matching campaign battle / 429 / 500 / 413 / auth / empty body is NOT COUNTED; 500 or empty then the receipt -> VICTORY with the SAME requestId; controls: a real win VICTORY, a real loss DEFEAT, a front-door 503 NOT COUNTED)"
node tests/test_won_never_defeat_1145.js || FAILED=1
note "test_results_retry_1151.js (v1151: Trials (Training Province, Tower), the legacy dungeon trial, the Elite screen, the Vault and the Gauntlet are safe against a lost reply - live server: the SAME requestId pays once per mode (Gauntlet /api/bonus/resolve now takes one; an old client without one still resolves); real page: a lost first reply then the receipt shows the mode's win title with ONE requestId, an error on a win is NOT COUNTED in plain words (never DEFEAT, never 'offline'), a Vault win whose reply is lost says 'Victory saved', a real loss is DEFEAT; control: the same test against v1150 fails)"
node tests/test_results_retry_1151.js || FAILED=1
note "test_sylthaine_ult_passive.js (v1137 Sylthaine ULT Blizzard contained snow + PASSIVE Cold Snap - new ?v=1137 sheets from the clean H3 exports, 48 @24 on an 8 x 6 grid under 4096, frame-0 plate-pose anchors, flip:false; timing data = BASE (clipDur 2.0 = the sim-side ult root, apex 31), kit identical; control: scripted swings, Blizzard/green/blue casts (cast tick, root, hold, every unit 7 s), a timed-passive lock and whole fights (Sylthaine both sides, heroes carry BATTLE_ANIM as the server replay) on BASE land on the same ticks; Blizzard starts on cast cell 20 (rig), hold apex 31, Cold Snap contact 9; controls: a 40-cell ult moves the root, a moved swing diverges the fights, a slower passive changes its lock, a broken grid fails)"
node tests/test_sylthaine_ult_passive.js || FAILED=1
note "test_debuff_feet_1141.js (v1141 DEBUFFS UNDER THE FEET, Phil 15 Oct: every DoT colour the engine pushes has a feet kind (burn/bleed/poison/curse, curse = the void zone flat; Umbris curse + Grimsby debt = curse, Hollow grey = bleed; control: BASE gives them none); debuff words (WAX, SEALED, IN DEBT, MARKED, bleed x2, OVERDUE x3, -resist ...) stack under the feet, buff/control words stay over the head (control: BASE puts WAX up); 6 whole fights with every debuffer both sides tick-identical to BASE (control: a 1% stronger DoT diverges); real page, muted 844x390 phone, real fights: Grimsby/Pyroclast/Absalie debuff badges at the victim's feet (renderOrder -4, riding it), buff badges over the bar, curse/debt void zone flat, Living Tallow wax pool, a new fight tears every feet mark down; control: the BASE page draws them over the bar)"
node tests/test_debuff_feet_1141.js || FAILED=1
note "test_wish_odds_1142.js (v1142 Diamond wish table + Ember Roast)"
node tests/test_wish_odds_1142.js || FAILED=1
note "test_gold_wish_1142.js (v1142 Gold wish glyph fragments follow the player glyph level, 2-4 below / 1-2 highest)"
node tests/test_gold_wish_1142.js || FAILED=1
note "test_memory_budget_1140.js (v1140 MEMORY BUDGET - the Aw-Snap hotfix: battle sheet files <= 2048 px / 4 MB outside the frozen pre-v1140 ratchet list (control: a 2100 px sheet fails); phone loader uploads every sheet within 2048 px per side (figure floor 160 px, hard 4096), desktop k = 1; heaviest possible 5v5 <= 2048 MB GPU (static + a real 5-fight phone rig), decoded bitmaps <= 400 MB, heaviest-sound 5v5 <= 48 MB decoded; after EVERY fight the hub holds no battle sheet, no bitmap, no hero sound (only the 12 weapon sounds), no growth over 5 fights; CONTROL: BASE v1139 breaks the budget and keeps its bitmaps)"
node tests/test_memory_budget_1140.js || FAILED=1
note "test_carn_anim_eight.js (v1142 Carn eight - idle/walk/attack/CRIT (his first)/hit/green Reckless Blow/blue Vein Burst/ult Crimson Reap from the Phil PASS clean H3 exports: new ?v=1142 sheets within 2048 px / 4 MB, frame-0 pose anchors, flip:false, passive untouched; timing data = BASE (clipDur 2.0, relFrac 0.5), kit/FX identical; control: swings, forced crit, green/blue/ult casts (cast tick, landing ticks, hold, every unit 6 s) and whole fights (Carn both sides) on BASE land on the same ticks - at crit 0, and at his real crit = BASE + the v532 crit-clip rule; contact cells re-derived from the engine (attack/crit 30 at attack speed x1-x1.25, green 18, blue 30, ult 37); Crimson Reap sound on the landing; controls: moved timing diverges, a longer green changes the hold, the rule control differs, a broken grid fails)"
node tests/test_carn_anim_eight.js || FAILED=1
note "test_aureth_anim_eleven.js (v1153 Aureth eleven - idle/walk/attackLight/attackDark/crit X slice/hit/green Sunburst/blue Duality/ult Eclipse/passive bright + dark crown from the Phil PASS clean H3 exports: new ?v=1153 sheets within 2048 px / 4 MB, figures 160-240 px, frame-0 anchors, attack = the light swing object; the crowns follow his Twin Fonts stance (render only); timing data = BASE (clipDur 2.0, relFrac 0.5, hit hold 0.6), kit/FX identical; control: swings, forced crit, casts and whole fights (Aureth both sides) on BASE v1152 land on the same ticks - at crit 0, and at his real crit = BASE + the v532 crit-clip rule; contact cells re-derived from the engine at attack speed x1 and x1.25; sound rows land/release)"
node tests/test_aureth_anim_eleven.js || FAILED=1
note "test_aureth_1150.js (v1150 Aureth autos: 70% physical / 30% magic split - Armor / MR / Block each on its own part, one number, one lifesteal; every auto a split hit of the v1149 amount; swing 1.8 s = 66 ticks; arms alternate L/D/L/D, crit = the X slice, fallback to attack with no arm sheets; every other hero (59) tick-identical to v1149 + the v1150 summon-level fix (v1161 re-baseline; control: plain v1149 differs only in the summoner fights); controls: v1149 fails split / interval / alternation)"
node tests/test_aureth_1150.js || FAILED=1
note "test_signin_first_1144.js (v1144 SIGN-IN FIRST, live incident 15 Oct: no session = the sign-in gate, no /api/guest call, nothing behind it reachable; Create account lands on the game; an old guest token gets the one-time keep-your-progress step and keeps its id + ledger; GUEST marker on the hub + result screen, a device that was on a real account says so; a lost real token goes to Sign in; /api/guest refuses new guests (403) but resumes existing ones, Servers 2-5 the same; inline scripts parse; CONTROL: AUD_ROOT=255d7b72 fails)"
node tests/test_signin_first_1144.js || FAILED=1
note "test_condense_1141.js (v1141 CONDENSE - size tiers + trim + compression: tiers_1141.json files lossless, exact size/grid, phone <= 2048 px / 4 MB / original bytes / v1140 memory and >= v1140 figure px, high = smaller crop of a lossless frozen original; every cell pixel-identical to the untrimmed cell at its tier (control: a nudged pixel fails); clip data identical to BASE; tier pick phone/desktop/tablet/deviceMemory/override; phone + desktop fights load their tier files at exact size, only the fighters' sheets, freed on the hub; trimmed quad = logical cell; same fight tick-identical on both tiers (control: another seed diverges); /play brotli + ETag + 304, gzip, identity, q11 in the background, compressed API JSON, sw.js revalidates)"
node tests/test_condense_1141.js || FAILED=1
note "test_offline_art_1154.js (v1154 OFFLINE ART LIST - Settings Update all features saves what THIS device loads: phone = phone tier files, desktop = trimmed files, originals only where a screen paints them (idle/walk, Skills previews); every listed URL 200, no v1154-retired file; card = N of N files and the list's MB (/api/asset-sizes), equal to the bytes really cached after a download; a device holding the old v1153 set fetches only the tier files, clears the replaced originals within the quarter cap and fights Carn + Aureth with no 404; CONTROL: the v1153 page lists no tier file)"
node tests/test_offline_art_1154.js || FAILED=1
note "test_q95_1158.js (v1158 q95: every lossless sheet the page / tier table names re-encoded WebP q95 or kept when bigger; lossy sheets untouched; files lossy+alpha, same size, smaller, fixture sha; alpha bit-exact vs v1157; composited >= 29 dB; Kon-Wu hidden green gone; every q95 URL ?v=1158; page = v1157 with the URLs put back; CONTROLS)"
node tests/test_q95_1158.js || FAILED=1
note "test_mute_music_1159.js (v1159 MASTER MUTE + MUSIC: the button on every screen/window incl. the sign-in gate, battle and result, on top, covering no control, left of the hub portrait; a tap mutes the master output only (Settings untouched), reaches no game listener or battle input, persists over a reload; city/map/battle/skyfall playlists; the city song never pauses or restarts through buildings and resumes after the map and a fight; battle cycle + loop seam + fade on end; rate 1 at 2x; 2-song crossfade; no AudioBuffer > 10 MB; seeded fight tick-identical with music + mute toggles; silent rig; CONTROL: AUD_ROOT=v1158 fails)"
node tests/test_mute_music_1159.js || FAILED=1
note "test_veyr_deepcleft_1160.js (v1160 Veyr + Deepcleft eight each - idle/walk/attack/CRIT (their first)/hit/green/blue/ult from the Phil PASS clean H3 exports, NO passive: new ?v=1160 q95 sheets within 2048 px / 4 MB, frame-0 anchors, flip:false, walk 36, Deepcleft idle 24 (Veyr keeps 62 @12), hit 15 @25 = the 0.6 s hold; timing data = BASE (clipDur 2.0, relFrac 0.5), kits identical but for 3 ownFx display tags, every BASE FX2_DEF entry identical; control: swings, forced crit, casts and whole fights on BASE v1158 land on the same ticks - crit held at 0, and at their real crit = BASE + the v532 crit-clip rule; contact cells re-derived from the engine at x1/x1.25/x0.8; Veyr's Grok FX (crescent life = the 1.2 s status, mantle = the 2.4 s evade, undertow crash on the engine's own collapse timer) run and end on their own touching no unit; sound rows on release/land)"
node tests/test_veyr_deepcleft_1160.js || FAILED=1
note "test_korvux_anim_eight.js (v1162 Korvux eight - idle/walk/attack/CRIT (his first)/hit/green Comet Dash/blue Ember Cleave/ult Falling Star from the Phil PASS clean H3 exports, NO passive: new q95 sheets within 2048 px / 4 MB; the two reference framings measured and normalised - every state drawn at the same size on the same spot as idle (CONTROL: assuming the framings match fails); timing data = BASE, kits/FX plates identical; swings, forced crit, casts and whole fights on BASE land on the same ticks - crit at 0, and at his real crit = BASE + the v532 crit-clip rule; contact cells re-derived at x1/x1.25/x0.8; the Ember Cleave crescent re-synced to the new axe head (tip within 12 px, flash on the contact; CONTROL: the v1125 fit misses); S0172/S0174 on land)"
node tests/test_korvux_anim_eight.js || FAILED=1
note "test_nox_grimsby_anims.js (v1169 Nox eight - idle/walk/attack/hit/green Lockpick Soul/blue Forbidden Key/ult Open Every Door/passive Skeleton-Key Savant - and Grimsby seven - idle/walk/ranged notice attack/hit/green Overdue/blue Ledger Slam/ult Foreclosure - from the Phil PASS clean H3 exports, no crit, no Grimsby passive: new q95 sheets within 2048 px / 4 MB; the new standing art fitted onto every clip frame 0 (one framing, x1.41) and every state drawn at idle's size and spot (CONTROL: another framing fails); timing data = BASE; Grimsby swings / casts / whole fights tick-identical to BASE (CONTROL: timing moved diverges); Nox casts on BASE's ticks; contact cells re-derived at x1/x1.25/x0.8; the fifth key plays Nox's passive clip (CONTROL: none on BASE); sound rows on release/land)"
node tests/test_nox_grimsby_anims.js || FAILED=1
note "test_nox_ranged_1166.js (v1169 Phil: Nox mid-row magic assassin, ranged, 10 m - hero-profiles.js Magic / Ability Power, range 282 = 10 x METER, holds at his own range (CONTROL: Vesper keeps the 13 m row hold), shadow ball on the release, MR mitigates it (BASE: armor), caster whoosh; server sim.js / replay host = client; fights WITHOUT Nox tick-identical to BASE, with him different (CONTROL), his old line put back = BASE; before/after table over 10 seeded fights)"
node tests/test_nox_ranged_1166.js || FAILED=1
note "test_vael_deepcleft_fx_1171.js (v1171 Vael's three Grok spell FX in place of vael_green / vael_blue / vael_ult: q95 sheets within 2048 px / 4 MB, green key with no fringe - visible green 0, olive <= 0.01% (CONTROL: plate mixed back reads olive); shown on his drawn clip cell (green 7 / blue 16 / ult 8) before the release, Bloodthirst / Last Stand end with their buff, Warcry flat at 5 m in real time; no badge; interrupt fades; mirrored with facing; skill previews; kits / clips / other FX2_DEF = BASE; casts and whole fights tick-identical to BASE, CONTROL: halved fear differs)"
node tests/test_vael_deepcleft_fx_1171.js || FAILED=1
note "test_meridian_rafe_1173.js (v1173 Meridian seven - no crit - and Rafe Marrow ten - gun / sword attack and crit apart, picked per swing by range and crit - from the Phil PASS corrected H3 exports: q95 sheets within 2048 px / 4 MB, the wide references fitted on every frame 0, same size + spot (CONTROL), timing data = BASE; Meridian swings / casts / fights tick-identical; Rafe casts identical, his blow on its fuse with the same amounts (CONTROL: old line back = BASE), fights without them = BASE; contact cells re-derived; S0138 / S0510 on release)"
node tests/test_meridian_rafe_1173.js || FAILED=1
note "test_mirelle_fx_1174.js (v1174 Mirelle's three Grok spell FX in place of mirelle_green / mirelle_blue / mirelle_ult: q95 sheets, no fringe (green plates: visible green 0 + olive; the magenta-plate ult: visible magenta 0; CONTROLS: the plate mixed back); Scent of Courage on the ally the heal lands on from the heal, Soporific Bouquet over the enemy the shot sleeps from the landing, drifting away from her (mirrored on her left), nothing flies; Imperial Plumage keeps the fieldWide both draw and plays once (hold); previews; kits / clips / other FX2_DEF = BASE; casts and whole fights tick-identical, CONTROL: halved heal differs)"
node tests/test_mirelle_fx_1174.js || FAILED=1
note "test_hobb_kharos_1175.js (v1175 Hobb eight - his first crit - and Kharos ten - attack A / B alternating every 1.8 s swing, his first crit, the camouflage passive kept see-through - from the Phil PASS final H3 exports: q95 sheets, the references fitted on every frame 0 (attack B on its own start frame), same size + spot (CONTROL), timing data = BASE, casts identical, swings on BASE ticks, whole fights at crit 0 = BASE and at real crit = BASE + the v532 rule (CONTROL: timing moved diverges), contact cells re-derived, S0245 / S0298 / S0300 on release, S0246 on land)"
node tests/test_hobb_kharos_1175.js || FAILED=1
note "test_admin_player_info_1176.js (v1176 GET /api/admin/player: dev only - no token / a non-dev token 403, POST 405; the dev gets identity, progress, currencies, roster, account, reports, integrity from the server ledger; no hash / salt / token / email / ip / device in the body; the read writes nothing; CONTROL AUD_SERVER=<pre-v1176 server> fails)"
node tests/test_admin_player_info_1176.js || FAILED=1
note "test_devinfo_keys_1176.js (v1177: + Esc from the campaign stage popup (no X) and six other overlay types lands on the hub with nothing on top, Backspace on the stage popup = Back to Map; control = the v1176 page fails on the stage popup. v1176 real page 844x390: the dev panel player popup - seven sections, fixture numbers, buttons kept, mute docked under its X overlapping nothing, screenshot; Esc to the hub from nested windows, Backspace one level at a time, typing in chat / the report box untouched, Esc mid-battle never ends the fight (Pause / Resume), result Esc = Continue, nothing on the sign-in gate; CONTROL KEYS_ROOT=<pre-v1176 checkout> fails)"
node tests/test_devinfo_keys_1176.js || FAILED=1
note "test_char_names_1176.js (v1176 character names: digits and the safe symbols accepted; each blocked character - angle brackets, ampersand, both quotes, backtick, backslash, slash, pipe, semicolon, braces - refused with a reason; emoji, hidden, stacked accents, only-symbols, Guest, look-alikes refused; rename too; legacy names with markup render as text on rankings / arena / guild / chat / dev panel; CONTROL NAMES_ROOT=<pre-v1176 checkout> fails)"
node tests/test_char_names_1176.js || FAILED=1
note "test_brannus_quorrel_1178.js (v1178 Brannus eight and Quorrel eight - their first crits - from the Phil PASS final H3 exports, and Brannus's three Grok spell FX: q95 sheets, the references fitted on every frame 0, same size + spot (CONTROL), timing data = BASE, casts identical, swings on BASE ticks, whole fights at crit 0 = BASE and at real crit = BASE + the v532 rule (CONTROL: slower swings diverge), contact cells re-derived; FX: no fringe (CONTROL: the plate mixed back), shown on green 18 / blue 7 / ult 29, real time once, pinned where he stood, mirrored with his facing, Arena Lock 3 m, nothing else flies, previews; S0274 release, S0162 / S0165 land)"
node tests/test_brannus_quorrel_1178.js || FAILED=1
note "test_rim_breaker_1180.js (v1180 Rim Breaker: thrown at the furthest enemy within 10 m, every enemy whose body the line passes through struck and stunned once when the wheel reaches it, the far one last; nobody in range = the target it had; CONTROLS: off the line not hit, BASE line hits one, fights without Brannus = BASE, the pierce taken off = BASE; the wheel glides from his hand to the chest on the shot's flight time, opaque, spinning, mirrored; browser run = server replay)"
node tests/test_rim_breaker_1180.js || FAILED=1
note "test_fx_facing_plumage_1181.js (v1181 directional spell FX flip with the hero: Fault Claws / Bloodthirst / Last Stand / Soporific Bouquet drawn facing right and left - UV x sign, anchor and ends mirrored (CONTROL: a painter that ignores facing fails); Warcry is a symmetric disc; Imperial Plumage bursts small - badgeH 0.45 x unit height, overlapping pairs shrunk by fxBadgeSpread; other FX2_DEF = BASE; casts and whole fights tick-identical, CONTROL: halved heal differs)"
node tests/test_fx_facing_plumage_1181.js || FAILED=1
note "test_death_state.js (v1182 the new DEATH animation type - Vael, Sylthaine, Vex, Vireo: the Phil PASS 96-frame files (sha256), every 2nd frame = 48 cells over 6 s, full size (idle figH) on tight sheets <= 2048 px, lazy under 30% hp with the phone GPU gate, plays once then hidden and released, never loops / idles / revives, an enemy body outlives its 0.9 s removal on screen only, fight end / wave turn mid-death, the old fade as the fallback, replays and rendered fights tick-identical, the phone peak with four deaths at once, with controls)"
node tests/test_death_state.js || FAILED=1
note "test_kharos_fx_1186.js (v1186 Kharos's three Grok spell FX in place of kharos_green / blue / ult: q95 sheets, no fringe (CONTROL: the plate mixed back), the magenta kept; Petal Sever on the enemy from green cell 18, Bloomstep on him from blue cell 9, Orchid Execution on the target from ult cell 23, real time once, mirrored by side; previews; kits / clips / other FX2_DEF = BASE; casts and whole fights tick-identical, CONTROL: halved damage differs)"
node tests/test_kharos_fx_1186.js || FAILED=1
note "test_kharos_bloom_browser_1186.js (v1186 Bloomstep in the real client, needs playwright: whole Kharos fights drawn every tick = the server replay tick for tick; staged right and left: the petals in front of him, his sprite fades to 0 when the figure forms and is back on the jump behind the enemy, HP bar untouched, the figure pinned where he stood and fading, his blue clip on arrival; CONTROL: the jump off never brings him back)"
node tests/test_kharos_bloom_browser_1186.js || FAILED=1
note "test_hollow_fx_1191.js (v1191 Hollow: his green clip = the Phil-approved natural draw (sha256 61d90da2; draw retimed into the 0.5 fight-s cast, the throw at natural speed, release cell 18 = source f88 on the cast end); Grok's Fan of Knives from that cell at his empty hand, the fan the size he held; Lacerate on the target from blue2 cell 16; Vanishing Point on each enemy struck; all mirrored with his facing (CONTROLS: facing-blind painters fail); no fringe (CONTROLS); casts and whole fights tick-identical, CONTROL: halved Lacerate differs)"
node tests/test_hollow_fx_1191.js || FAILED=1
note "test_skill_previews_1164.js (v1164 SKILL PREVIEWS read from the fight: every slot of all 60 heroes - the clip startAbilityClip / real swings / crit / passive play (same BATTLE_ANIM object, the engine hold and cell clock; stand-ins show nothing), every FX sheet the cast draws recorded live at its moment, the fight's SFX rows with peaks on the contact cell; CONTROLS: an old Korvux sheet, a sound a cell off, a dropped FX fail; phone browser: silent on open, a tap plays through sfxPlay (swing 0.85), one at a time, FX off / master mute, only the open hero's tier sheets held and released; fights tick-identical to BASE)"
node tests/test_skill_previews_1164.js || FAILED=1
rm -f probe-db-*.json
echo
if [ $FAILED -eq 0 ]; then echo "ALL SUITES GREEN ✅"; else echo "FAILURES — see $DBDIR"; fi
exit $FAILED
