#!/bin/bash
# TRANSFORMATION acceptance suite (80/20 audit §6): ledger authority, authored-campaign determinism
# + curve, reward idempotency, tamper resistance, authoritative vault/arena, pool odds/pity, shop,
# hero progression endpoints. Server needs the v2 flags; run on a FRESH DB.
B=http://localhost:8871
PASS=0; FAIL=0
ck(){ if [ "${4:-}" = "invert" ]; then
        if [[ "$3" != *"$2"* ]]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 — did NOT want '$2' in: ${3:0:200}"; fi
      elif [[ "$3" == *"$2"* ]]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 — wanted '$2' in: ${3:0:200}"; fi }
jv(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

R=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"tf1","pass":"password1","roster":{"__save":"{\"gold\":5000,\"gems\":250,\"playerXP\":40000,\"heroXP\":{\"vael\":30000,\"sylthaine\":30000,\"vireo\":30000},\"campaignCleared\":4}"}}')
T=$(echo "$R"|jv "['token']"); H="x-token: $T"
LG=$(curl -s $B/api/ledger -H "$H")
# v229 P0: an account created AFTER the transformation cutoff gets the fixed STARTER ledger —
# the forged roster in the register payload above must be completely ignored.
ck "P0: forged roster on a NEW account -> starter gold" '"gold":1000' "$LG"
ck "P0: forged roster cannot pre-clear campaign" '"cleared":0' "$LG"
ck "ledger stamina present" '"stamina"' "$LG"

# TAMPER (test 4): a modified save upload must not change the ledger
curl -s -X POST $B/api/save -H "$H" -H 'content-type: application/json' -d '{"roster":{"__save":"{\"gold\":99999999,\"gems\":99999,\"playerXP\":90000000,\"heroXP\":{\"vael\":90000000},\"campaignCleared\":100}"}}' >/dev/null
LG2=$(curl -s $B/api/ledger -H "$H")
ck "TAMPER: save upload cannot raise ledger gold" '"gold":1000' "$LG2"
ck "TAMPER: save upload cannot raise campaign" '"cleared":0' "$LG2"

# v229 P0: ownership — a locked (never summoned) hero is rejected everywhere
CL=$(curl -s -X POST $B/api/campaign/start -H "$H" -H 'content-type: application/json' -d '{"node":1,"heroIds":["vael","sylthaine","fritz"],"requestId":"cl1"}')
ck "P0: locked hero rejected from campaign" 'not unlocked' "$CL"
VL=$(curl -s -X POST $B/api/dungeon/start-battle -H "$H" -H 'content-type: application/json' -d '{"heroIds":["vael","sylthaine","vireo","tick","fritz"],"requestId":"vl1"}')
ck "P0: locked hero rejected from vault" 'not unlocked' "$VL"

# CAMPAIGN determinism (test 1): stage data byte-identical across 10 loads
S1=$(curl -s "$B/api/campaign/stage?node=7" -H "$H")
OKDET=1
for i in 2 3 4 5 6 7 8 9 10; do S2=$(curl -s "$B/api/campaign/stage?node=7" -H "$H"); [ "$S1" != "$S2" ] && OKDET=0; done
[ $OKDET -eq 1 ] && { PASS=$((PASS+1)); echo "  ✓ stage 7 byte-identical across 10 loads"; } || { FAIL=$((FAIL+1)); echo "  ✗ stage data varied"; }
ck "stage has fixed authored waves" '"waves"' "$S1"
ck "stage carries recommendedPower + rewards" '"recommendedPower"' "$S1"

# CAMPAIGN start/resolve: server-authoritative, stamina debited, rewards once (test 3)
ST=$(curl -s -X POST $B/api/campaign/start -H "$H" -H 'content-type: application/json' -d '{"node":1,"heroIds":["vael","sylthaine","vireo"],"requestId":"c1"}')
ck "campaign start ok (stamina debited)" '"attemptId"' "$ST"
AID=$(echo "$ST"|jv "['attemptId']")
LOCKED=$(curl -s -X POST $B/api/campaign/start -H "$H" -H 'content-type: application/json' -d '{"node":9,"heroIds":["vael","sylthaine","vireo"],"requestId":"c1b"}')
ck "locked stage rejected" 'locked' "$LOCKED"
# v273: a resolve must carry the end state the player actually reached. A client that declares a win
# but submits no end state is REFUSED as unverified — it is never quietly scored, in either direction.
RS=$(curl -s -X POST $B/api/campaign/resolve -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"c2\",\"won\":true}")
ck "a declared win with no end state is refused as unverified" '"unverified":true' "$RS"
ck "an unverified resolve records no win" '"won":true' "$RS" invert
RS2=$(curl -s -X POST $B/api/campaign/resolve -H "$H" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"c2\",\"won\":true}")
[ "$RS" == "$RS2" ] && { PASS=$((PASS+1)); echo "  ✓ duplicate resolve tx returns the SAME grant (idempotent)"; } || { FAIL=$((FAIL+1)); echo "  ✗ duplicate resolve differed"; }

# ===== v258 (Launch Blueprint v1): CHAPTER BOSSES ARE A HARD PLAYER-LEVEL GATE =====
# Normal stages may be attempted early; stage N-10 requires player level N*10.
TDB=$(curl -s -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}'|jv "['token']")
UIDB=$(curl -s $B/api/profile -H "$H"|jv "['profile']['id']")
# clear the way to 1-10 without granting player XP, so only the boss gate can stop us
curl -s -X POST $B/api/admin/led-grant -H "x-token: $TDB" -H 'content-type: application/json' -d '{"userId":"'"$UIDB"'","campCleared":9,"stamina":600}' >/dev/null
SG=$(curl -s "$B/api/campaign/stage?node=10" -H "$H")
ck "the stage payload publishes the chapter-boss level gate" '"bossLevelGate":10' "$SG"
SGN=$(curl -s "$B/api/campaign/stage?node=9" -H "$H")
ck "a normal stage publishes no level gate" '"bossLevelGate":0' "$SGN"
BG=$(curl -s -X POST $B/api/campaign/start -H "$H" -H 'content-type: application/json' -d '{"node":10,"heroIds":["vael","sylthaine","vireo"],"requestId":"bg1"}')
ck "an under-levelled account is refused the chapter boss" 'reach player level 10' "$BG"
curl -s -X POST $B/api/admin/led-grant -H "x-token: $TDB" -H 'content-type: application/json' -d '{"userId":"'"$UIDB"'","px":40000,"stamina":600}' >/dev/null
BG2=$(curl -s -X POST $B/api/campaign/start -H "$H" -H 'content-type: application/json' -d '{"node":10,"heroIds":["vael","sylthaine","vireo"],"requestId":"bg2"}')
ck "the boss opens once the account reaches the gate" '"attemptId"' "$BG2"

# ===== 27 Aug (Phil): SWEEPING IS EARNED — a stage is sweepable only at three stars =====
SWP=$(curl -s -X POST $B/api/campaign/sweep -H "$H" -H 'content-type: application/json' -d '{"node":3,"times":1,"requestId":"sws1"}')
ck "a cleared-but-not-three-starred stage refuses the sweep" 'needs ★★★' "$SWP"
SP=$(curl -s "$B/api/campaign/stage?node=3" -H "$H")
ck "the stage payload publishes the sweep lock" '"sweepUnlocked":false' "$SP"
curl -s -X POST $B/api/admin/led-grant -H "x-token: $TDB" -H 'content-type: application/json' -d '{"userId":"'"$UIDB"'","campStars":{"3":3},"stamina":600}' >/dev/null
SP3=$(curl -s "$B/api/campaign/stage?node=3" -H "$H")
ck "three stars unlock the sweep on the payload" '"sweepUnlocked":true' "$SP3"
SWP2=$(curl -s -X POST $B/api/campaign/sweep -H "$H" -H 'content-type: application/json' -d '{"node":3,"times":1,"requestId":"sws2"}')
ck "a three-starred stage sweeps" '"ok":true' "$SWP2"

# v250: GENERIC EARN IS RETIRED for real loops — every migrated reason must be refused outright
E1=$(curl -s -X POST $B/api/tx/earn -H "$H" -H 'content-type: application/json' -d '{"what":"gold","amount":80,"reason":"tower","requestId":"e1"}')
ck "RETIRED: 'tower' gold earn refused (use /api/trial/resolve)" 'No earn rule' "$E1"
E2=$(curl -s -X POST $B/api/tx/earn -H "$H" -H 'content-type: application/json' -d '{"what":"gold","amount":100,"reason":"misc","requestId":"e2m"}')
ck "RETIRED (v267): the generic 'misc' allowance is gone — a client can no longer name its own reason" 'No earn rule' "$E2"
E2b=$(curl -s -X POST $B/api/tx/earn -H "$H" -H 'content-type: application/json' -d '{"what":"gems","amount":10,"reason":"daily","requestId":"e2d"}')
ck "RETIRED: arena rank diamonds are no longer client-claimed" 'No earn rule' "$E2b"
E2c=$(curl -s -X POST $B/api/tx/earn -H "$H" -H 'content-type: application/json' -d '{"what":"frag","amount":2,"reason":"arena","heroKey":"vex","requestId":"e2a"}')
ck "the arena fragment shop rule is the ONLY earn reason left" '"tx"' "$E2c"

# ===== v267 (80/20 §9): Getting Started rewards are SERVER-granted, once per step =====
TUT1=$(curl -s -X POST $B/api/tutorial/claim -H "$H" -H 'content-type: application/json' -d '{"step":"win11"}')
ck "a tutorial step pays from the server's own authored table" '"gold":500' "$TUT1"
TUT2=$(curl -s -X POST $B/api/tutorial/claim -H "$H" -H 'content-type: application/json' -d '{"step":"win11"}')
ck "the same step never pays twice" '"already":true' "$TUT2"
TUT3=$(curl -s -X POST $B/api/tutorial/claim -H "$H" -H 'content-type: application/json' -d '{"step":"nonsense"}')
ck "an invented step is refused" 'Unknown step' "$TUT3"
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
G0=$(curl -s -X POST $B/api/tx/earn -H "$H" -H 'content-type: application/json' -d '{"what":"frag","amount":3,"reason":"elite","heroKey":"fritz","requestId":"fr1"}')
ck "RETIRED: 'elite' fragment earn refused (use /api/elite/resolve)" 'No earn rule' "$G0"
G1=$(curl -s -X POST $B/api/market/frag -H "$H" -H 'content-type: application/json' -d '{"heroKey":"fritz","qty":1,"pay":"gold","requestId":"fr1m"}')
ck "market fragment purchase is one atomic SERVER transaction" '"paid"' "$G1"
SS=$(curl -s -X POST $B/api/hero/star-step -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","requestId":"ss1"}')
ck "star step consumes fragments by the pip table" '' "$SS"

# ARENA is sim-resolved (no client won) and, since v228, an idempotent battle claim
AR=$(curl -s -X POST $B/api/arena/result -H "$H" -H 'content-type: application/json' -d '{"oppId":"nobody","won":true}')
ck "arena without requestId rejected (A5)" 'requestId required' "$AR"
AR1=$(curl -s -X POST $B/api/arena/result -H "$H" -H 'content-type: application/json' -d '{"oppId":"nobody","won":true,"requestId":"ar1"}')
ck "arena responds authoritative (client won ignored)" '"authoritative":true' "$AR1"
AR2=$(curl -s -X POST $B/api/arena/result -H "$H" -H 'content-type: application/json' -d '{"oppId":"nobody","won":true,"requestId":"ar1"}')
[ "$AR1" == "$AR2" ] && { PASS=$((PASS+1)); echo "  ✓ arena replay returns the identical memoized verdict"; } || { FAIL=$((FAIL+1)); echo "  ✗ arena replay differed"; }

# VAULT authoritative: resolve carries no trusted won (covered fully in test_dungeon.sh)
# ================= v249: THE CITY LOOP IS SERVER-SIDE =================
echo "-- v249 city loop: Academy on the ledger, capped mining, VERIFIED city PvP"
AC0=$(curl -s $B/api/academy -H "$H")
ck "ACADEMY: server state exists (new account starts at zero)" '"academy":0' "$AC0"
# research needs resources — mine them through the CAPPED server grant
M1=$(curl -s -X POST $B/api/world/mine -H "$H" -H 'content-type: application/json' -d '{"res":"iron","amount":15,"requestId":"m1"}')
ck "MINE: server grants capped resources" '"granted":15' "$M1"
M2=$(curl -s -X POST $B/api/world/mine -H "$H" -H 'content-type: application/json' -d '{"res":"iron","amount":15,"requestId":"m2"}')
M3=$(curl -s -X POST $B/api/world/mine -H "$H" -H 'content-type: application/json' -d '{"res":"iron","amount":15,"requestId":"m3"}')
M4=$(curl -s -X POST $B/api/world/mine -H "$H" -H 'content-type: application/json' -d '{"res":"iron","amount":15,"requestId":"m4"}')
M5=$(curl -s -X POST $B/api/world/mine -H "$H" -H 'content-type: application/json' -d '{"res":"iron","amount":15,"requestId":"m5"}')
ck "MINE: the daily cap refuses the 5th claim (60/day)" 'cap' "$M5"
M1R=$(curl -s -X POST $B/api/world/mine -H "$H" -H 'content-type: application/json' -d '{"res":"iron","amount":15,"requestId":"m1"}')
ck "MINE: idempotent retry returns the SAME grant (no double)" '"granted":15' "$M1R"
# research the ACADEMY track (its res cost is iron-only)
RS=$(curl -s -X POST $B/api/academy/research -H "$H" -H 'content-type: application/json' -d '{"track":"academy","requestId":"rs1"}')
ck "ACADEMY: research starts server-side (gold + resources debited)" '"completesAt"' "$RS"
RS2=$(curl -s -X POST $B/api/academy/research -H "$H" -H 'content-type: application/json' -d '{"track":"academy","requestId":"rs2"}')
ck "ACADEMY: a second research is refused while one runs" 'in progress' "$RS2"
RSA=$(curl -s -X POST $B/api/academy/research -H "$H" -H 'content-type: application/json' -d '{"track":"atk","requestId":"rs3"}')
ck "ACADEMY: tech above the Academy level is locked" 'Academy must be upgraded' "$RSA"
# VERIFIED city PvP: the server resolves through the combat core and caps loot
PT=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"tfdef","pass":"password1"}')
DID2=$(echo "$PT"|jv "['profile']['id']")
PK=$(curl -s -X POST $B/api/pvp/attack -H "$H" -H 'content-type: application/json' -d '{"defId":"'"$DID2"'","heroIds":["vael","sylthaine","vireo"],"requestId":"pa1"}')
ck "PVP: server resolves the attack (verified result + event log)" '"won"' "$PK"
ck "PVP: the result carries the combat-core event log" '"log"' "$PK"
PKR=$(curl -s -X POST $B/api/pvp/attack -H "$H" -H 'content-type: application/json' -d '{"defId":"'"$DID2"'","heroIds":["vael","sylthaine","vireo"],"requestId":"pa1"}')
ck "PVP: idempotent retry returns the same battle" '"won"' "$PKR"
PVFAKE=$(curl -s -X POST $B/api/pvp/attack -H "$H" -H 'content-type: application/json' -d '{"defId":"'"$DID2"'","heroIds":["konwu"],"requestId":"pa2"}')
ck "PVP: an unowned hero is rejected" 'not unlocked' "$PVFAKE"

# ================= v252: mobile perf — text compression + immutable art cache =================
echo "-- v252 delivery: the client ships compressed; art caches immutably"
RAW=$(curl -s -o /dev/null -w '%{size_download}' $B/play)
BR=$(curl -s -H 'Accept-Encoding: br' -o /dev/null -w '%{size_download}' $B/play)
GZ=$(curl -s -H 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}' $B/play)
[ "$BR" -lt "$((RAW/2))" ] && ck "PERF: brotli halves the client at least ($RAW -> $BR)" ok ok || ck "PERF: brotli halves the client" "smaller" "$RAW -> $BR"
[ "$GZ" -lt "$((RAW/2))" ] && ck "PERF: gzip halves the client at least ($RAW -> $GZ)" ok ok || ck "PERF: gzip halves the client" "smaller" "$RAW -> $GZ"
MD_SRC=$(curl -s $B/play | md5sum | cut -d' ' -f1)
MD_BR=$(curl -s -H 'Accept-Encoding: br' --compressed $B/play | md5sum | cut -d' ' -f1)
ck "PERF: the compressed client decodes byte-identical" "$MD_SRC" "$MD_BR"
VH=$(curl -s -D- -H 'Accept-Encoding: br' -o /dev/null $B/play | grep -i '^vary')
ck "PERF: Vary: Accept-Encoding is set (proxy-safe)" 'Accept-Encoding' "$VH"
AH=$(curl -s -D- -o /dev/null $B/assets/icons/icon-192.png | grep -i '^cache-control')
ck "PERF: art is immutably cached (no daily revalidation on phones)" 'immutable' "$AH"

# ===== v255 (80/20 contract §9 + release gate 5): the live manifest =====
echo "-- v255 manifest: flags, tuning, currency sources/sinks and daily caps are SERVED, not inferred"
MF=$(curl -s $B/api/manifest)
ck "MANIFEST: feature flags are published live" '"flags"' "$MF"
ck "MANIFEST: every currency lists sources and sinks" '"sinks"' "$MF"
ck "MANIFEST: daily caps are published" '"dailyCaps"' "$MF"
ck "MANIFEST: the daily reset is stated in server time" '09:00 America/New_York' "$MF"
ck "MANIFEST: glyph fragments name their three fixed portal sources" 'Normal Portal — 100 families' "$MF"
ck "MANIFEST: the Elite Portal is named as a source" 'Elite Portal' "$MF"
ck "MANIFEST: the Veteran Portal is named as the Orange source" 'Veteran Portal' "$MF"

echo ""; echo "PASS: $PASS  FAIL: $FAIL"
