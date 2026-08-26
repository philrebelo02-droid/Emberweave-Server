#!/bin/bash
# Usage: start the server first in a SHORT shell call:
#   env GLYPHS_V2_ENABLED=true DUNGEON_V2_ENABLED=true GUILD_WAR_V2_ENABLED=true DB_FILE=./test-db.json PORT=8871 setsid nohup node server.js > srv.log 2>&1 < /dev/null &
# then: bash <this file>   (fresh test-db.json per run)
# Aether Vault endpoint suite — spec §10 checklist items testable at the API level
B=http://localhost:8871
PASS=0; FAIL=0
ck(){ if [[ "$3" == *"$2"* ]]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 — wanted '$2' in: ${3:0:170}"; fi }
jq(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

# a beefy account: register, then push a save with high XP so heroes are strong
R=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"dt1","pass":"pw"}')
T=$(echo "$R"|jq "['token']"); H="x-token: $T"
python3 - << 'PY' > save1.json
import json
xp=200000  # near max level
save={"playerXP":900000,"heroXP":{k:xp for k in ["vael","sylthaine","vireo","tick","fritz","vex"]},
      "starLevel":{"vael":5,"sylthaine":4},"starPip":{},"gold":1,"gems":1}
print(json.dumps({"roster":{"__save":json.dumps(save)}}))
PY
curl -s -X POST $B/api/save -H "$H" -H 'content-type: application/json' -d @save1.json >/dev/null

S=$(curl -s $B/api/dungeon/status -H "$H")
ck "status enabled, floor 1" '"currentFloor":1' "$S"
ck "sweep 2 free" '"freeUsesRemaining":2' "$S"

# start battle — bad team first
BAD=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d '{"heroIds":["vael","vael","x","y","z"],"requestId":"r0"}')
ck "duplicate heroes rejected" 'five different' "$BAD"
ST=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d '{"heroIds":["vael","sylthaine","vireo","tick","fritz"],"requestId":"r1"}')
ck "start ok" '"attemptId"' "$ST"
AID=$(echo "$ST"|jq "['attemptId']")
ck "server returns waves+seed" '"seed"' "$ST"
DOUBLE=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d '{"heroIds":["vael","sylthaine","vireo","tick","fritz"],"requestId":"r2"}')
ck "second concurrent start blocked" 'Finish the current' "$DOUBLE"

# resolve — NO result payload accepted; server sims. Strong team vs floor 1 must win.
RES=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"rr1\",\"won\":false,\"result\":{\"won\":false}}")
ck "resolve wins (client 'won:false' ignored)" '"won":true' "$RES"
ck "reward dust granted" '"dust"' "$RES"
ck "floor advanced to 2" '"currentFloor":2' "$RES"
# idempotent replay of same requestId → same committed result, no double pay
RES2=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"rr1\"}")
ck "idempotent resolve returns committed result" '"currentFloor":2' "$RES2"
RES3=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"rr9\"}")
ck "stale attempt rejected" 'No matching' "$RES3"

# climb to floor 5 (boss) — loop start+resolve
F=2
for i in 2 3 4 5; do
  ST=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d "{\"heroIds\":[\"vael\",\"sylthaine\",\"vireo\",\"tick\",\"fritz\"],\"requestId\":\"s$i\"}")
  AID=$(echo "$ST"|jq "['attemptId']")
  RES=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"q$i\"}")
done
ck "boss floor 5 first-clear: 4 fragments (doubled)" '"firstClearDoubled":true' "$RES"
NFRAG=$(echo "$RES" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['reward']['fragments']))" 2>/dev/null)
[ "$NFRAG" = "4" ] && { PASS=$((PASS+1)); echo "  ✓ exactly 4 first-clear boss fragments"; } || { FAIL=$((FAIL+1)); echo "  ✗ boss fragments = $NFRAG"; }
GREY=$(echo "$RES" | python3 -c "import sys,json;fr=json.load(sys.stdin)['reward']['fragments'];print(all(f.startswith('Grey ') for f in fr))" 2>/dev/null)
ck "band 1-10 = Grey fragments" 'True' "$GREY"

# sweep: 2 free, pays floors 1..5 at standard rates (boss floor 5 = 2 frags, not 4)
SW=$(curl -s -X POST $B/api/dungeon/sweep -H "$H" -H 'content-type: application/json' -d '{"requestId":"sw1"}')
ck "sweep ok" '"totalDust"' "$SW"
SWFR=$(echo "$SW" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(d['fragments'].values()))" 2>/dev/null)
[ "$SWFR" = "2" ] && { PASS=$((PASS+1)); echo "  ✓ sweep pays standard 2 boss fragments"; } || { FAIL=$((FAIL+1)); echo "  ✗ sweep fragments = $SWFR"; }
SW2=$(curl -s -X POST $B/api/dungeon/sweep -H "$H" -H 'content-type: application/json' -d '{"requestId":"sw2"}')
ck "second sweep ok" '"freeUsesRemaining":0' "$SW2"
SW3=$(curl -s -X POST $B/api/dungeon/sweep -H "$H" -H 'content-type: application/json' -d '{"requestId":"sw3"}')
ck "third sweep blocked" 'No free Sweeps' "$SW3"
SWDUP=$(curl -s -X POST $B/api/dungeon/sweep -H "$H" -H 'content-type: application/json' -d '{"requestId":"sw1"}')
ck "duplicate sweep requestId returns committed result (no extra pay)" '"totalDust"' "$SWDUP"

# salvage: sell 1 Grey fragment stack from the sweep income
STATE=$(curl -s $B/api/glyphs/state -H "$H")
KEY=$(echo "$STATE" | python3 -c "import sys,json;fr=json.load(sys.stdin)['fragments'];print(next((k for k in fr if k.startswith('Grey ')),''))")
SAL=$(curl -s -X POST $B/api/fragments/salvage -H "$H" -H 'content-type: application/json' -d "{\"stacks\":[{\"key\":\"$KEY\",\"quantity\":1}],\"requestId\":\"sv1\"}")
ck "salvage 1 grey = 2 dust" '"dustGained":2' "$SAL"
SALBAD=$(curl -s -X POST $B/api/fragments/salvage -H "$H" -H 'content-type: application/json' -d "{\"stacks\":[{\"key\":\"$KEY\",\"quantity\":99999}],\"requestId\":\"sv2\"}")
ck "over-salvage rejected" 'do not own' "$SALBAD"

# WEAK account loses and stays on the floor (rollback)
R2=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"dt2","pass":"pw"}')
T2=$(echo "$R2"|jq "['token']"); H2="x-token: $T2"
# no save → all heroes level 1. Floor 1 should still be beatable? floor1 enemies lvl~2 diff~1 — a lvl1 team may lose. Push to floor where loss certain: floor 1 with lvl 1 team vs similar... test loss on a mid floor by hacking? Instead: verify loss path just returns won:false and floor stays. Use whatever result comes and assert consistency.
ST2=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H2" -H 'content-type: application/json' -d '{"heroIds":["vael","sylthaine","vireo","tick","fritz"],"requestId":"w1"}')
A2=$(echo "$ST2"|jq "['attemptId']")
RES4=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H2" -H 'content-type: application/json' -d "{\"attemptId\":\"$A2\",\"requestId\":\"w2\"}")
WON=$(echo "$RES4" | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['won'])")
FLOOR=$(echo "$RES4" | python3 -c "import sys,json;print(json.load(sys.stdin)['progress']['currentFloor'])")
if [ "$WON" = "False" ] && [ "$FLOOR" = "1" ]; then PASS=$((PASS+1)); echo "  ✓ loss keeps floor at 1 (rollback)";
elif [ "$WON" = "True" ] && [ "$FLOOR" = "2" ]; then PASS=$((PASS+1)); echo "  ✓ (weak team won floor 1; progression consistent)";
else FAIL=$((FAIL+1)); echo "  ✗ inconsistent loss/floor: won=$WON floor=$FLOOR"; fi

echo ""; echo "PASS: $PASS  FAIL: $FAIL"
