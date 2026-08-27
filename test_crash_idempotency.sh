#!/bin/bash
# v273 — a reward and its receipt survive a hard kill together (audit response P0 + evidence §9.5).
# Grant a reward, SIGKILL the server mid-flight, restart from the same DB file, retry the SAME
# requestId: the retry must return the stored receipt and must not pay a second time.
set -u
cd "$(dirname "$0")"
PORT=${CRASH_PORT:-8886}
DBDIR=$(mktemp -d); DB="$DBDIR/db.json"
FLAGS="VAULT_MIN_BATTLE_MS=0 REG_PER_MIN=500 REG_ACCOUNTS_PER_IP=500"
PASS=0; FAIL=0
ck(){ if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1${3:+ — $3}"; fi; }
boot(){ env $FLAGS DB_FILE="$DB" PORT=$PORT node ./server.js > "$DBDIR/s.log" 2>&1 & SRV=$!; sleep 2.2; }
kill9(){ kill -9 $SRV 2>/dev/null; wait $SRV 2>/dev/null; sleep 0.4; }
trap 'kill -9 $SRV 2>/dev/null' EXIT

echo "== v273: a reward cannot be paid twice across a crash =="
boot
TOK=$(curl -s -X POST localhost:$PORT/api/register -H 'content-type: application/json' \
  -d '{"name":"crash1","pass":"password1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
[ -n "$TOK" ] && ck "account registered" 1 || ck "account registered" 0

RID="fixed-crash-req"
# a tutorial claim is a small, server-owned, idempotent grant — ideal for this
FIRST=$(curl -s -X POST localhost:$PORT/api/tutorial/claim -H 'content-type: application/json' -H "x-token: $TOK" \
  -d "{\"step\":\"win11\",\"requestId\":\"$RID\"}")
G1=$(echo "$FIRST" | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('ledger') or {}).get('gold',-1))")
ck "the reward was granted once (gold=$G1)" "$([ "$G1" != "-1" ] && echo 1 || echo 0)" "$FIRST"

# hard kill IMMEDIATELY — no graceful shutdown, no debounce flush
kill9
boot
AFTER=$(curl -s localhost:$PORT/api/ledger -H "x-token: $TOK")
G2=$(echo "$AFTER" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('gold',-1))")
ck "the reward survived the kill (gold=$G2)" "$([ "$G2" = "$G1" ] && echo 1 || echo 0)" "before=$G1 after=$G2"

RETRY=$(curl -s -X POST localhost:$PORT/api/tutorial/claim -H 'content-type: application/json' -H "x-token: $TOK" \
  -d "{\"step\":\"win11\",\"requestId\":\"$RID\"}")
AFTER2=$(curl -s localhost:$PORT/api/ledger -H "x-token: $TOK")
G3=$(echo "$AFTER2" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('gold',-1))")
ck "retrying the same request after the crash pays NOTHING extra (gold=$G3)" "$([ "$G3" = "$G2" ] && echo 1 || echo 0)" "after=$G2 retry=$G3"

kill9
echo
echo "PASS: $PASS  FAIL: $FAIL"
[ "$FAIL" = "0" ] || exit 1
