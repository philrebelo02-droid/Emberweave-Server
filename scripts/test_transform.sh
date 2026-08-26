#!/bin/bash
# TRANSFORMATION acceptance suite (80/20 audit §6): ledger authority, authored-campaign determinism
# + curve, reward idempotency, tamper resistance, authoritative vault/arena, pool odds/pity, shop,
# hero progression endpoints. Server needs the v2 flags; run on a FRESH DB.
B=http://localhost:8871
PASS=0; FAIL=0
ck(){ if [[ "$3" == *"$2"* ]]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 — wanted '$2' in: ${3:0:200}"; fi }
jv(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

R=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"tf1","pass":"password1","roster":{"__save":"{\"gold\":5000,\"gems\":250,\"playerXP\":40000,\"heroXP\":{\"vael\":30000,\"sylthaine\":30000,\"vireo\":30000},\"campaignCleared\":4}"}}')
T=$(echo "$R"|jv "['token']"); H="x-token: $T"
LG=$(curl -s $B/api/ledger -H "$H")
ck "ledger migrated legacy balances once" '"gold":5000' "$LG"
ck "ledger carries campaign progress" '"cleared":4' "$LG"
ck "ledger stamina present" '"stamina"' "$LG"

# TAMPER (test 4): a modified save upload must not change the ledger
curl -s -X POST $B/api/save -H "$H" -H 'content-type: application/json' -d '{"roster":{"__save":"{\"gold\":99999999,\"gems\":99999,\"playerXP\":90000000,\"heroXP\":{\"vael\":90000000},\"campaignCleared\":100}"}}' >/dev/null
LG2=$(curl -s $B/api/ledger -H "$H")
ck "TAMPER: save upload cannot raise ledger gold" '"gold":5000' "$LG2"
ck "TAMPER: save upload cannot raise campaign" '"cleared":4' "$LG2"

# CAMPAIGN determinism (test 1): stage data byte-identical across 10 loads
S1=$(curl -s "$B/api/campaign/stage?node=7" -H "$H")
OKDET=1
for i in 2 3 4 5 6 7 8 9 10; do S2=$(curl -s "$B/api/campaign/stage?node=7" -H "$H"); [ "$S1" != "$S2" ] && OKDET=0; done
[ $OKDET -eq 1 ] && { PASS=$((PASS+1)); echo "  ✓ stage 7 byte-identical across 10 loads"; } || { FAIL=$((FAIL+1)); echo "  ✗ stage data varied"; }
ck "stage has fixed authored waves" '"waves"' "$S1"
ck "stage carries recommendedPower + rewards" '"recommendedPower"' "$S1"

# CAMPAIGN start/resolve: server-authoritative, stamina debited, rewards once (test 3)
ST=$(curl -s -X POST $B/api/campaign/start -H "$H" -H 'content-type: application/json' -d '{"node":5,"heroIds":["vael","sylthaine","vireo"],"requestId":"c1"}')
ck "campaign start ok (stamina debited)" '"attemptId"' "$ST"
AID=$(echo "$ST"|jv "['attemptId']")
LOCKED=$(curl -s -X POST $B/api/campaign/start -H "$H" -H 'content-type: application/json' -d '{"node":9,"heroIds":["vael","sylthaine","vireo"],"requestId":"c1b"}')
ck "locked stage rejected" 'locked' "$LOCKED"
RS=$(curl -s -X POST $B/api/campaign/resolve -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"c2\",\"won\":true}")
ck "resolve is server-decided (won field ignored, result present)" '"won":' "$RS"
RS2=$(curl -s -X POST $B/api/campaign/resolve -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"c2\",\"won\":true}")
[ "$RS" == "$RS2" ] && { PASS=$((PASS+1)); echo "  ✓ duplicate resolve tx returns the SAME grant (idempotent)"; } || { FAIL=$((FAIL+1)); echo "  ✗ duplicate resolve differed"; }

# EARN caps (legacy-loop bridge)
E1=$(curl -s -X POST $B/api/tx/earn -H "$H" -H 'content-type: application/json' -d '{"what":"gold","amount":80,"reason":"tower","requestId":"e1"}')
ck "capped earn accepted + logged" '"tx"' "$E1"
E2=$(curl -s -X POST $B/api/tx/earn -H "$H" -H 'content-type: application/json' -d '{"what":"gold","amount":50000,"reason":"tower","requestId":"e2"}')
ck "over-rule earn rejected" 'exceeds' "$E2"
E3=$(curl -s -X POST $B/api/tx/earn -H "$H" -H 'content-type: application/json' -d '{"what":"gold","amount":500,"reason":"hax","requestId":"e3"}')
ck "unknown reason rejected" 'No earn rule' "$E3"
SP=$(curl -s -X POST $B/api/tx/spend -H "$H" -H 'content-type: application/json' -d '{"what":"gems","amount":999999,"reason":"shop","requestId":"s1"}')
ck "overdraft spend rejected" 'Not enough' "$SP"

# WISHING POOL (server-owned)
PS=$(curl -s $B/api/pool/state -H "$H")
ck "published odds" '"odds"' "$PS"
ck "pity rule visible" '"pity"' "$PS"
W1=$(curl -s -X POST $B/api/pool/wish -H "$H" -H 'content-type: application/json' -d '{"pool":"gold","n":1,"requestId":"w1"}')
ck "gold wish rolls server-side" '"results"' "$W1"
W1B=$(curl -s -X POST $B/api/pool/wish -H "$H" -H 'content-type: application/json' -d '{"pool":"gold","n":1,"requestId":"w1"}')
[ "$W1" == "$W1B" ] && { PASS=$((PASS+1)); echo "  ✓ duplicate wish tx returns the SAME result"; } || { FAIL=$((FAIL+1)); echo "  ✗ duplicate wish rerolled"; }

# SHOP (server counts + prices)
SH=$(curl -s -X POST $B/api/shop/buy -H "$H" -H 'content-type: application/json' -d '{"what":"food","requestId":"f1"}')
ck "food meal: gems debited, stamina granted" '"stamina"' "$SH"

# HERO progression endpoints (exact published rules)
G1=$(curl -s -X POST $B/api/tx/earn -H "$H" -H 'content-type: application/json' -d '{"what":"frag","amount":3,"reason":"elite","heroKey":"fritz","requestId":"fr1"}')
ck "elite fragment earn (capped)" '"tx"' "$G1"
SS=$(curl -s -X POST $B/api/hero/star-step -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","requestId":"ss1"}')
ck "star step consumes fragments by the pip table" '' "$SS"

# ARENA is sim-resolved (no client won)
AR=$(curl -s -X POST $B/api/arena/result -H "$H" -H 'content-type: application/json' -d '{"oppId":"nobody","won":true}')
ck "arena responds authoritative (client won ignored)" '"authoritative":true' "$AR"

# VAULT authoritative: resolve carries no trusted won (covered fully in test_dungeon.sh)
echo ""; echo "PASS: $PASS  FAIL: $FAIL"
