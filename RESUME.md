# DONE - v1192 save upgrade LIVE 17 Oct 2026 23:03 ET (8dc5fe8d, all 9 machines). SHIPPED-v1192-save-upgrade-17-10-2026.md. Remaining: S2 save timing check 30 min after deploy.

# RESUME - save upgrade v1192 (built as v1185), 17 Oct 2026 13:30 EDT - READY, deploy BLOCKED (cluster instability)

Not committed on purpose. Branch `claude/save-ship-v1185`, pushed. Release commit **99215e70bde57675ea961430af95a5706221e0bb** (v1192, build 1792254968126, patch notes 0.95) on live v1193 `3afb75d2`.
To re-stamp after a rebase: drop the v1192 commit (git rebase --skip on its conflict) and run scratchpad release1192.cjs from the worktree root. Worktree `C:\Users\Home\Downloads\ew-saveport2`. NOT deployed.
The coordinator has to name the window first, and holds other deploys during it.

## Decisions (coordinator)
- Remove DB_STORE_VERIFY from every env in this deploy.
- BUSY_SHED is off by default.
- ONE deploy to all servers and helpers.
- Use a quiet window, with a 5-minute notice if a tester is on.
- Never print secrets.

## Proofs done (details in blueprint 26, section v1185)
- Migration on all 5 live worlds (11:13Z backups, sha-matched): old = live v1184, new = e99a5465. ALL PASS, including recover and the
  env rollback.
- Load, S1 copy:
  - live today (v1184 + VERIFY): p95 17 s at 500 players, safety stop;
  - release: holds 1,500 players, API p95 9-15 ms, 0 errors;
  - full saves: 0 a minute (fixed: new accounts' first ledger).
- Suite:
  - full run on 9c03173b;
  - every failing test was rerun on live v1184 and fails the same way there;
  - targeted tests on e99a5465 pass.
  - An optional full rerun on 1f2e4297 takes ~2.5 h.
- Copies are stopped and resized back (CT 210, 211, 299).

## Deploy runbook (when the coordinator gives the window)
1. Check that live is still 551eebd8 (else rebase + stamp).
2. Check player counts: `curl http://192.168.1.22{0,2,3,4,5}:8080/api/front/status`.
3. vzdump snapshots of CT 200 (.215, storage backup-hdd-nfs), 202 (.213), 203, 204 (.214) and 205 (.209). Check each node's backup
   storage first.
4. On each server: `cp -p /etc/emberweave.env /etc/emberweave.env.bak-claude-v1185`, then delete the DB_STORE_VERIFY line. The restart
   comes with the deploy.
5. Copy the SHIPPED draft (Archive tools/loadtest/saveship-proof/DRAFT-SHIPPED-v1192-save-upgrade-17-10-2026.md) into Archive Operating procedure/SHIPPED. Touch blueprint
   26 (it must be newer than tools/.last_deploy).
6. Copy deploy_home.sh + deploy_box.cjs + five_machines.cjs to a private /tmp dir. Run it with the full sha, gate BLUEPRINT-IS-TRUTH.
7. On each box:
   - `curl -s 127.0.0.1:8080/internal/save-stats`: layout journal, io.failed 0, pieceMissed 0;
   - `node /opt/emberweave/server/world-store.js layout /var/lib/emberweave/emberweave-db.json` prints journal;
   - a wrong-password login answers 401;
   - five_machines ok.
8. Watch the journals for 10 minutes. Post to the AI channel. Mark blueprint 26 v1127/v1128/v1129/v1134 LIVE in v1185. File the
   SHIPPED deploy section.
9. Rollback: blueprint 26 v1185 "Rollback recipe".

## State at 13:30 EDT
- Full suite on 1f2e4297 FINISHED: scratchpad suites-G/port.log. Only the 6 known failures; busy_shed / sim_helper_1039 / front_door_1130 failed under load and passed on a quiet rerun (tdiff-B).
- Tests touched by the rebases onto v1191 / v1193 (tdiff-C partial, tdiff-D): port = base for all; only kharos_fx_1186 fails, on both.
- The PASS/FAIL comparison was handed to Ember in the AI channel at 10:50.
- BLOCKED:
  - one-true-main (S1) crashed hard at ~10:46 and rebooted;
  - ew-node1 (S3) and ew-node2 rebooted at ~13:22;
  - ew-node3 (.212, helper CT 207 .227) is still unreachable;
  - all 5 servers are healthy (v1193).
  Deploy once the cluster is stable and node3 is back (or the coordinator says to go without it).
- Blueprint 26 section renumbered v1192. The SHIPPED draft must be renamed v1192 with the new full SHA at deploy time.
