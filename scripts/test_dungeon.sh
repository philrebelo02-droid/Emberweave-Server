#!/bin/bash
# THE VAULT endpoint suite — real client battles vs pre-determined monsters (Phil 26 Aug):
# floors are fixed per floor number (practice, not RNG), client reports won, server validates
# plausibility + timing and owns every reward. Run server with VAULT_MIN_BATTLE_MS=0 for speed.
B=http://localhost:8871
PASS=0; FAIL=0
ck(){ if [[ "$3" == *"$2"* ]]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 — wanted '$2' in: ${3:0:170}"; fi }
jq(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

# a beefy account: register, then push a save with high XP so heroes are strong
R=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"dt1","pass":"password1"}')
T=$(echo "$R"|jq "['token']"); H="x-token: $T"
python3 - << 'PY' > save1.json
import json
xp=200000
save={"playerXP":900000,"heroXP":{k:xp for k in ["vael","sylthaine","vireo","tick","fritz","vex","grosk","oakmir","rhukk","lumi"]},
      "starLevel":{"vael":5,"sylthaine":4},"starPip":{},"gold":1,"gems":1}
print(json.dumps({"roster":{"__save":json.dumps(save)}}))
PY
curl -s -X POST $B/api/save -H "$H" -H 'content-type: application/json' -d @save1.json >/dev/null

S=$(curl -s $B/api/dungeon/status -H "$H")
ck "status enabled, floor 1" '"currentFloor":1' "$S"
ck "sweep 2 free" '"freeUsesRemaining":2' "$S"

# start battle — team validation
BAD=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d '{"heroIds":["vael","vael","x","y","z"],"requestId":"r0"}')
ck "duplicate heroes rejected" 'no duplicates' "$BAD"
BAD2=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d '{"heroIds":["vael","sylthaine","vireo","tick"],"requestId":"r0b"}')
ck "4-hero team rejected" 'Pick 5 fighters' "$BAD2"
ST=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d '{"heroIds":["vael","sylthaine","vireo","tick","fritz","grosk","oakmir","rhukk","lumi","vex"],"requestId":"r1"}')
ck "start ok with 5 fighters + 5 backups" '"attemptId"' "$ST"
AID=$(echo "$ST"|jq "['attemptId']")
ck "server returns monster waves" '"waves"' "$ST"
ck "waves are monster specs" '"hpMul"' "$ST"

# pre-determined floors: two more starts → byte-identical waves (no per-attempt RNG)
W1=$(echo "$ST" | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin)['waves']))")
ST2=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d '{"heroIds":["grosk","oakmir","rhukk","lumi","vex"],"requestId":"r2"}')
W2=$(echo "$ST2" | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin)['waves']))")
[ "$W1" = "$W2" ] && { PASS=$((PASS+1)); echo "  ✓ floor lineup is PRE-DETERMINED (identical across attempts)"; } || { FAIL=$((FAIL+1)); echo "  ✗ floor lineup changed between attempts"; }
AID=$(echo "$ST2"|jq "['attemptId']")

# resolve: client reports the real battle outcome; rewards are server-owned
RES=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"rr1\",\"won\":true}")
ck "win accepted" '"won":true' "$RES"
ck "reward dust granted" '"dust"' "$RES"
ck "gear fragments drop every floor" 'gearFragments' "$RES"
ck "floor advanced to 2" '"currentFloor":2' "$RES"
RES2=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"rr1\",\"won\":true}")
ck "idempotent resolve returns committed result" '"currentFloor":2' "$RES2"
RES3=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"rr9\",\"won\":true}")
ck "stale attempt rejected" 'No matching' "$RES3"

# reward determinism: floor rewards are fixed per floor (compare with a fresh account later)
FR1=$(echo "$RES" | python3 -c "import sys,json;print(json.dumps(sorted(json.load(sys.stdin)['reward'].get('gearFragments',[]))))")

# climb to floor 5 (boss floor)
for i in 2 3 4 5; do
  ST=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d "{\"heroIds\":[\"vael\",\"sylthaine\",\"vireo\",\"tick\",\"fritz\"],\"requestId\":\"s$i\"}")
  AID=$(echo "$ST"|jq "['attemptId']")
  [ "$i" = "5" ] && LAST_ST="$ST"
  RES=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"q$i\",\"won\":true}")
done
ck "boss floor 5 wave 2 carries a boss monster" '"boss":true' "$LAST_ST"
ck "boss floor first clear doubled" '"firstClearDoubled":true' "$RES"
NFRAG=$(echo "$RES" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['reward']['fragments']))" 2>/dev/null)
[ "$NFRAG" = "4" ] && { PASS=$((PASS+1)); echo "  ✓ 4 first-clear boss glyph fragments (doubled)"; } || { FAIL=$((FAIL+1)); echo "  ✗ boss fragments = $NFRAG"; }
GREY=$(echo "$RES" | python3 -c "import sys,json;fr=json.load(sys.stdin)['reward']['fragments'];print(all(f.startswith('Grey ') for f in fr))" 2>/dev/null)
ck "band 1-10 = Grey fragments" 'True' "$GREY"

# sweep: 2 free, pays floors 1..5 at standard rates
SW=$(curl -s -X POST $B/api/dungeon/sweep -H "$H" -H 'content-type: application/json' -d '{"requestId":"sw1"}')
ck "sweep ok" '"totalDust"' "$SW"
SWFR=$(echo "$SW" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(d['fragments'].values()))" 2>/dev/null)
[ "$SWFR" = "2" ] && { PASS=$((PASS+1)); echo "  ✓ sweep pays standard 2 boss fragments"; } || { FAIL=$((FAIL+1)); echo "  ✗ sweep fragments = $SWFR"; }
SW2=$(curl -s -X POST $B/api/dungeon/sweep -H "$H" -H 'content-type: application/json' -d '{"requestId":"sw2"}')
ck "second sweep ok" '"freeUsesRemaining":0' "$SW2"
SW3=$(curl -s -X POST $B/api/dungeon/sweep -H "$H" -H 'content-type: application/json' -d '{"requestId":"sw3"}')
ck "third sweep blocked" 'No free Sweeps' "$SW3"

# salvage: sell 1 Grey glyph fragment stack from the sweep income
STATE=$(curl -s $B/api/glyphs/state -H "$H")
KEY=$(echo "$STATE" | python3 -c "import sys,json;fr=json.load(sys.stdin)['fragments'];print(next((k for k in fr if k.startswith('Grey ')),''))")
SAL=$(curl -s -X POST $B/api/fragments/salvage -H "$H" -H 'content-type: application/json' -d "{\"stacks\":[{\"key\":\"$KEY\",\"quantity\":1}],\"requestId\":\"sv1\"}")
ck "salvage 1 grey = 2 dust" '"dustGained":2' "$SAL"

# loss keeps the floor (retry forever — beatable by practice)
R2=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"dt2","pass":"password1"}')
T2=$(echo "$R2"|jq "['token']"); H2="x-token: $T2"
ST2=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H2" -H 'content-type: application/json' -d '{"heroIds":["vael","sylthaine","vireo","tick","fritz"],"requestId":"w1"}')
A2=$(echo "$ST2"|jq "['attemptId']")
RES4=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H2" -H 'content-type: application/json' -d "{\"attemptId\":\"$A2\",\"requestId\":\"w2\",\"won\":false}")
ck "AUTHORITATIVE: client-declared loss is overridden by the server sim (floor 1 winnable → advances)" '"currentFloor":2' "$RES4"
# abandoning an attempt doesn't lock the Vault: a new start discards the old attempt
ST3=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H2" -H 'content-type: application/json' -d '{"heroIds":["vael","sylthaine","vireo","tick","fritz"],"requestId":"w3"}')
ck "restart after abandon works" '"attemptId"' "$ST3"
# floor rewards are account-independent (fixed per floor)
A3=$(echo "$ST3"|jq "['attemptId']")
RES5=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$H2" -H 'content-type: application/json' -d "{\"attemptId\":\"$A3\",\"requestId\":\"w4\",\"won\":true}")
N2=$(echo "$RES5" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['reward'].get('gearFragments',[])))" 2>/dev/null)
[ "$N2" = "2" ] && { PASS=$((PASS+1)); echo "  ✓ reward package size fixed (2 gear frags); CONTENTS rolled server-side per transaction (audit C7)"; } || { FAIL=$((FAIL+1)); echo "  ✗ reward package wrong: $N2"; }

echo ""; echo "PASS: $PASS  FAIL: $FAIL"
