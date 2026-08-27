#!/bin/bash
set -u
cd "$(dirname "$0")"
PORT=${PORT:-8899}
DBDIR=$(mktemp -d); DB="$DBDIR/db.json"
FLAGS="VAULT_MIN_BATTLE_MS=0 DUNGEON_V2_ENABLED=true GEAR_V2_ENABLED=true GUILD_WAR_V2_ENABLED=true REG_PER_MIN=500 REG_ACCOUNTS_PER_IP=500 GLYPH_RL_PER_MIN=100000"
SRV_PID=""
cleanup(){ [ -n "$SRV_PID" ] && kill "$SRV_PID" 2>/dev/null; }
trap cleanup EXIT
env $FLAGS DB_FILE="$DB" PORT=$PORT node ./server.js > "$DBDIR/s1.log" 2>&1 & SRV_PID=$!
sleep 1.6
D=$(curl -s -X POST localhost:$PORT/api/register -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['profile']['id'])")
A=$(curl -s -X POST localhost:$PORT/api/register -H 'content-type: application/json' -d '{"name":"tuneA","pass":"password1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['profile']['id'])")
Bx=$(curl -s -X POST localhost:$PORT/api/register -H 'content-type: application/json' -d '{"name":"tuneB","pass":"password1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['profile']['id'])")
sleep 1.0; kill $SRV_PID 2>/dev/null; sleep 1.0
echo "ids: $D $A $Bx"
env $FLAGS ADMIN_IDS="$D,$A,$Bx" DB_FILE="$DB" PORT=$PORT node ./server.js > "$DBDIR/s2.log" 2>&1 & SRV_PID=$!
sleep 1.6
PORT=$PORT node ./tune_probe.js
echo "log: $DBDIR/s2.log"
