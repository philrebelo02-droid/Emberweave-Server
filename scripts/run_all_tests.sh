#!/bin/bash
# ONE-COMMAND test runner (audit round 4: PID-only cleanup, portable paths).
#   bash scripts/run_all_tests.sh     — from a repo checkout (server.js at repo root)
#   bash run_all_tests.sh             — from a flat bundle dir (server.js alongside)
# Temp DB + fixtures, two-phase ADMIN_IDS admin boot, all endpoint suites + probes + the
# client/server parity harness (if playwright is available), non-zero exit on any failure.
# Cleanup NEVER scans global processes: only the PID this runner started is signaled (TERM,
# then KILL after a bounded wait), via trap on EXIT.
set -u
cd "$(dirname "$0")"
SRV=../server.js; [ -f ./server.js ] && SRV=./server.js
PORT=${PORT:-8871}
DBDIR=$(mktemp -d); DB="$DBDIR/db.json"
FLAGS="VAULT_MIN_BATTLE_MS=0 DUNGEON_V2_ENABLED=true GEAR_V2_ENABLED=true GUILD_WAR_V2_ENABLED=true"
FAILED=0; SRV_PID=""
cleanup(){ if [ -n "$SRV_PID" ] && kill -0 "$SRV_PID" 2>/dev/null; then
  kill "$SRV_PID" 2>/dev/null
  for i in 1 2 3 4 5; do kill -0 "$SRV_PID" 2>/dev/null || break; sleep 0.4; done
  kill -0 "$SRV_PID" 2>/dev/null && kill -9 "$SRV_PID" 2>/dev/null; fi; SRV_PID=""; }
trap cleanup EXIT
note(){ echo; echo "== $1 =="; }
cat > reg1.json <<'JSON'
{"name": "gtest1", "pass": "password1", "roster": {"__save": "{\"gold\": 100, \"gems\": 10, \"glyphRank\": {\"vex\": 5, \"vireo\": 2}, \"glyphInv\": {\"x\": 3}, \"glyphCur\": {}, \"glyphLocked\": {}}"}}
JSON
note "phase 1: boot + create admin account"
env $FLAGS DB_FILE="$DB" PORT=$PORT node "$SRV" > "$DBDIR/srv1.log" 2>&1 & SRV_PID=$!
sleep 1.5
DID=$(curl -s -X POST localhost:$PORT/api/register -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['profile']['id'])")
sleep 1.2; cleanup
[ -z "$DID" ] && { echo "FATAL: admin bootstrap failed (see $DBDIR/srv1.log)"; exit 1; }
note "phase 2: restart with ADMIN_IDS=$DID and run the endpoint suites"
env $FLAGS ADMIN_IDS=$DID DB_FILE="$DB" PORT=$PORT node "$SRV" > "$DBDIR/srv2.log" 2>&1 & SRV_PID=$!
sleep 1.5
for T in test_glyphs.sh test_dungeon.sh test_gear.sh; do
  note "$T"; bash $T | tee "$DBDIR/$T.out" | tail -3
  grep -q "FAIL: 0" "$DBDIR/$T.out" || FAILED=1
  sleep 62   # the register endpoint allows 6/min/IP — space the suites out
done
note "test_war.sh"; bash test_war.sh | tee "$DBDIR/war.out" | tail -3
grep -q "FAIL: 0" "$DBDIR/war.out" || FAILED=1
note "test_ws_revoke.js (needs 'ws')"
if node -e "require('ws')" 2>/dev/null; then node test_ws_revoke.js || FAILED=1; else echo "  (skipped — npm i ws to enable)"; fi
note "test_parity_harness.js (needs playwright — the real client/server field comparison)"
if node -e "require('playwright')" 2>/dev/null; then node test_parity_harness.js || FAILED=1; else echo "  (skipped — npm i playwright to enable)"; fi
cleanup
note "probes (no server needed)"
node test_sim_parity.js || FAILED=1
node test_glyph_flow.js || FAILED=1
node test_vault_gate.js || FAILED=1
node test_war_bracket.js || FAILED=1
rm -f probe-db-*.json
note "RESULT"; [ $FAILED -eq 0 ] && echo "ALL SUITES GREEN" || echo "FAILURES — logs in $DBDIR"
exit $FAILED
