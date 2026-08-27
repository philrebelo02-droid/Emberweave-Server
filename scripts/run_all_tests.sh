#!/bin/bash
# ONE-COMMAND test runner (v232: genuinely green from a clean checkout).
#   npm ci && npx playwright install chromium && bash scripts/run_all_tests.sh
# Works from a repo checkout (server.js at repo root) or a flat bundle dir.
# Fresh temp DB, two-phase ADMIN_IDS admin boot, every endpoint suite + probes + the ws and
# browser parity harnesses. `ws` and the Playwright browser are MANDATORY (set
# SKIP_BROWSER_PARITY=1 only for environments that genuinely cannot run a browser).
# Register caps are raised via env for fixtures only (REG_PER_MIN/REG_ACCOUNTS_PER_IP) — the
# production defaults are untouched. Cleanup signals ONLY the PID this runner started.
set -u
cd "$(dirname "$0")"
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
  note "$T"; bash $T | tee "$DBDIR/$T.out" | tail -3
  grep -q "FAIL: 0" "$DBDIR/$T.out" || FAILED=1
done
note "test_ws_revoke.js"
node test_ws_revoke.js || FAILED=1
if [ "$BROWSER_OK" = "1" ]; then
  note "test_parity_harness.js (real client/server field comparison in Chromium)"
  node test_parity_harness.js || FAILED=1
fi
cleanup
note "probes (no server needed)"
node test_sim_parity.js || FAILED=1
node test_glyph_flow.js || FAILED=1
node test_vault_gate.js || FAILED=1
node test_war_bracket.js || FAILED=1
node test_campaign_curve.js || FAILED=1
rm -f probe-db-*.json
echo
if [ $FAILED -eq 0 ]; then echo "ALL SUITES GREEN ✅"; else echo "FAILURES — see $DBDIR"; fi
exit $FAILED
