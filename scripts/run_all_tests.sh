#!/bin/bash
# ONE-COMMAND test runner (re-audit round 3, Medium 5).
#   bash scripts/run_all_tests.sh          — from the repo root
# Creates a temp DB + fixtures, boots the server with all required flags, creates the admin
# account, restarts with its ADMIN_IDS, runs every suite + probe, kills the server, and exits
# non-zero on any failure. Requires: node, python3, curl; 'npm i ws' enables the WS revocation test.
set -u
cd "$(dirname "$0")"
PORT=${PORT:-8871}
DBDIR=$(mktemp -d); DB="$DBDIR/db.json"
FLAGS="VAULT_MIN_BATTLE_MS=0 DUNGEON_V2_ENABLED=true GEAR_V2_ENABLED=true GUILD_WAR_V2_ENABLED=true"
FAILED=0
note(){ echo; echo "== $1 =="; }
# fixture: reg1.json (legacy-save registration used by the glyph suite)
cat > reg1.json <<'JSON'
{"name": "gtest1", "pass": "password1", "roster": {"__save": "{\"gold\": 100, \"gems\": 10, \"glyphRank\": {\"vex\": 5, \"vireo\": 2}, \"glyphInv\": {\"x\": 3}, \"glyphCur\": {}, \"glyphLocked\": {}}"}}
JSON
kill_srv(){ ps -eo pid,cmd | grep "node server.js" | grep -v grep | awk '{print $1}' | xargs -r kill -9 2>/dev/null; sleep 0.4; }
kill_srv
note "phase 1: boot + create admin"
env $FLAGS DB_FILE="$DB" PORT=$PORT node ../server.js > "$DBDIR/srv1.log" 2>&1 & SP=$!
sleep 1.5
DID=$(curl -s -X POST localhost:$PORT/api/register -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['profile']['id'])")
sleep 1.2; kill $SP 2>/dev/null; sleep 0.6
[ -z "$DID" ] && { echo "FATAL: admin bootstrap failed"; exit 1; }
note "phase 2: restart with ADMIN_IDS=$DID + run suites"
env $FLAGS ADMIN_IDS=$DID DB_FILE="$DB" PORT=$PORT node ../server.js > "$DBDIR/srv2.log" 2>&1 & SP=$!
sleep 1.5
for T in test_glyphs.sh test_dungeon.sh test_gear.sh; do
  note "$T"; bash $T | tee "$DBDIR/$T.out" | tail -3
  grep -q "FAIL: 0" "$DBDIR/$T.out" || FAILED=1
  sleep 62   # register endpoint allows 6/min/IP — space the suites
done
note "test_war.sh"; bash test_war.sh | tee "$DBDIR/war.out" | tail -3
grep -q "FAIL: 0" "$DBDIR/war.out" || FAILED=1
note "test_ws_revoke.js (needs 'ws')"
if node -e "require('ws')" 2>/dev/null; then node test_ws_revoke.js || FAILED=1; else echo "  (skipped — npm i ws to enable)"; fi
kill $SP 2>/dev/null; kill_srv
note "probes (no server needed)"
node test_sim_parity.js || FAILED=1
node test_vault_gate.js || FAILED=1
node test_war_bracket.js || FAILED=1
rm -f probe-db-*.json
note "RESULT"; [ $FAILED -eq 0 ] && echo "ALL SUITES GREEN" || echo "FAILURES — see $DBDIR"
exit $FAILED
