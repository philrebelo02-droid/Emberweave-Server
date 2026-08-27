#!/bin/bash
# Forge (Gear v2) endpoint suite — crafting tree, temper math, bound rule, extraction, resonance
B=http://localhost:8871
PASS=0; FAIL=0
ck(){ if [[ "$3" == *"$2"* ]]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 — wanted '$2' in: ${3:0:180}"; fi }
jv(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

# dev1 (already exists in some runs) → register fresh dev-named acct? use dev1
D=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}')
T=$(echo "$D"|jv "['token']")
[ -z "$T" ] && { D=$(curl -s -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}'); T=$(echo "$D"|jv "['token']"); }
H="x-token: $T"

CAT=$(curl -s $B/api/gear/catalog -H "$H")
ck "catalog 84 items" 'Worldroot Seed' "$CAT"
ck "temper meta present" '"extractRefund":0.8' "$CAT"
ck "C5: Grey = 2 matching fragments" '"greyFragCost":2' "$CAT"
ck "C5: Orange temper base 230" '"Orange":230' "$CAT"
ck "C4: item-specific actives shipped" '"activeType"' "$CAT"
S=$(curl -s $B/api/gear/state -H "$H"); RV=$(echo "$S"|jv "['revision']")
ck "state ok" '"resonance"' "$S"

# grant Grey fragments for Ironwall Shield (E01, frag 'Rough Ore Fragment') + dust
G1=$(curl -s -X POST $B/api/gear/grant -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"frag\":\"E01\",\"n\":6,\"dust\":100000}")
ck "dev grant" '"ok":true' "$G1"; RV=$(echo "$G1"|jv "['revision']")

# craft Grey directly from fragments (3)
C1=$(curl -s -X POST $B/api/gear/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"gearId\":\"E01\"}")
ck "craft grey weapon" '"crafted"' "$C1"; RV=$(echo "$C1"|jv "['revision']"); I1=$(echo "$C1"|jv "['crafted']")
C2=$(curl -s -X POST $B/api/gear/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"gearId\":\"E01\"}")
RV=$(echo "$C2"|jv "['revision']"); I2=$(echo "$C2"|jv "['crafted']")
C3=$(curl -s -X POST $B/api/gear/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"gearId\":\"E01\"}")
RV=$(echo "$C3"|jv "['revision']"); I3=$(echo "$C3"|jv "['crafted']")
CFAIL=$(curl -s -X POST $B/api/gear/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"gearId\":\"E01\"}")
ck "4th grey blocked (out of fragments)" 'Need 2' "$CFAIL"

# find a Green item id from catalog + its frag; grant green fragments and craft sub + item
GREEN=$(echo "$CAT" | python3 -c "import sys,json;d=json.load(sys.stdin);g=[i for i in d['items'] if i['quality']=='Green'][0];print(g['id'])")
GF=$(curl -s -X POST $B/api/gear/grant -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"frag\":\"$GREEN\",\"n\":10}")
RV=$(echo "$GF"|jv "['revision']")
SUB=$(curl -s -X POST $B/api/gear/craft-sub -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"gearId\":\"$GREEN\"}")
ck "craft green sub-component" '"sub"' "$SUB"; RV=$(echo "$SUB"|jv "['revision']")
CG=$(curl -s -X POST $B/api/gear/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"gearId\":\"$GREEN\"}")
ck "craft green item consumes 2 grey + sub" '"crafted"' "$CG"; RV=$(echo "$CG"|jv "['revision']"); IG=$(echo "$CG"|jv "['crafted']")
ST=$(curl -s $B/api/gear/state -H "$H")
NGREY=$(echo "$ST" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len([1 for it in d['items'].values() if it['d']=='E01']))")
[ "$NGREY" = "1" ] && { PASS=$((PASS+1)); echo "  ✓ 2 grey items consumed (1 left)"; } || { FAIL=$((FAIL+1)); echo "  ✗ grey remaining=$NGREY"; }

# bound rule: equip the last grey, then it can never be an ingredient
EQ=$(curl -s -X POST $B/api/gear/equip -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"heroKey\":\"vael\",\"itemId\":\"$I3\"}")
ck "equip grey on vael (Weapon slot)" '"slot":"Weapon"' "$EQ"; RV=$(echo "$EQ"|jv "['revision']")
GF2=$(curl -s -X POST $B/api/gear/grant -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"frag\":\"$GREEN\",\"n\":10}")
RV=$(echo "$GF2"|jv "['revision']")
SUB2=$(curl -s -X POST $B/api/gear/craft-sub -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"gearId\":\"$GREEN\"}")
RV=$(echo "$SUB2"|jv "['revision']")
CG2=$(curl -s -X POST $B/api/gear/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"gearId\":\"$GREEN\"}")
ck "bound item refused as ingredient" 'fresh unbound' "$CG2"

# temper: 1 use on the equipped grey costs 5 dust; ×12 uses crosses bar (10) → temper 1, cost rises to 6
TP=$(curl -s -X POST $B/api/gear/temper -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"itemId\":\"$I3\",\"uses\":12}")
ck "temper 12 uses" '"temper":1' "$TP"
ck "temper spent 6x10+7x2=74 dust (C5 ladder)" '"dustSpent":74' "$TP"
ck "next cost 7 (20% growth after bar)" '"nextCost":7' "$TP"
RV=$(echo "$TP"|jv "['revision']")

# resonance: 1 total temper level on equipped gear → below rank 1 threshold(20) → rank 0
ST2=$(curl -s $B/api/gear/state -H "$H")
ck "resonance total=1 rank=0" '"rank": 0' "$(echo "$ST2"|python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)["resonance"],indent=1))')"

# select active
SA=$(curl -s -X POST $B/api/gear/select-active -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"heroKey\":\"vael\",\"itemId\":\"$I3\"}")
ck "select gear active" '"active":"Shield Bash"' "$SA"; RV=$(echo "$SA"|jv "['revision']")

# extraction: unequip then extract → refund 80% of 62 = 49
UN=$(curl -s -X POST $B/api/gear/unequip -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"heroKey\":\"vael\",\"slot\":\"Weapon\"}")
RV=$(echo "$UN"|jv "['revision']")
EX=$(curl -s -X POST $B/api/gear/extract -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"itemId\":\"$I3\"}")
ck "extract refunds 80% (59 of 74)" '"refund":59' "$EX"; RV=$(echo "$EX"|jv "['revision']")
EX2=$(curl -s -X POST $B/api/gear/extract -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"itemId\":\"$I3\"}")
ck "double extract rejected" 'Unknown item' "$EX2"

# stale revision
STALE=$(curl -s -X POST $B/api/gear/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":1,\"gearId\":\"E01\"}")
ck "stale revision → STALE" 'STALE' "$STALE"

# non-dev grant forbidden
U=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"gearu1","pass":"password1"}')
TU=$(echo "$U"|jv "['token']"); HU="x-token: $TU"
SU=$(curl -s $B/api/gear/state -H "$HU"); RVU=$(echo "$SU"|jv "['revision']")
GRF=$(curl -s -X POST $B/api/gear/grant -H "$HU" -H 'content-type: application/json' -d "{\"expectedRevision\":$RVU,\"dust\":999999}")
ck "grant forbidden for non-dev" 'forbidden' "$GRF"

# vault drops gear fragments: strong save, clear floor 1, check gearFragments in reward
python3 - << 'PY' > gsave.json
import json
save={"playerXP":900000,"heroXP":{k:150000 for k in ["vael","sylthaine","vireo","tick","fritz"]},"starLevel":{},"starPip":{}}
print(json.dumps({"roster":{"__save":json.dumps(save)}}))
PY
curl -s -X POST $B/api/save -H "$HU" -H 'content-type: application/json' -d @gsave.json >/dev/null
# v229 P0: the save no longer feeds progression — unlock + level the five via the admin grant
UIDU=$(curl -s $B/api/profile -H "$HU"|jv "['profile']['id']")
TDG=$(curl -s -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}'|jv "['token']")
GFIVE='["vael","sylthaine","vireo","tick","fritz"]'
curl -s -X POST $B/api/admin/led-grant -H "x-token: $TDG" -H 'content-type: application/json' -d '{"userId":"'"$UIDU"'","unlock":'"$GFIVE"',"heroKeys":'"$GFIVE"',"heroXp":150000,"px":900000,"stars":5}' >/dev/null
SB=$(curl -s -X POST $B/api/dungeon/start-battle -H "$HU" -H 'content-type: application/json' -d '{"heroIds":["vael","sylthaine","vireo","tick","fritz"],"requestId":"g1"}')
AID=$(echo "$SB"|jv "['attemptId']")
RB=$(curl -s -X POST $B/api/dungeon/resolve-battle -H "$HU" -H 'content-type: application/json' -d "{\"attemptId\":\"$AID\",\"requestId\":\"g2\",\"won\":true}")
ck "vault floor drops gear fragments" 'gearFragments' "$RB"
ck "gear fragments are Grey band" 'Fragment' "$RB"

echo ""; echo "PASS: $PASS  FAIL: $FAIL"
