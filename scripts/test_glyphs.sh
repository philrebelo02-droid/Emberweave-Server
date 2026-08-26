#!/bin/bash
# Usage: start the server first in a SHORT shell call:
#   env GLYPHS_V2_ENABLED=true DUNGEON_V2_ENABLED=true GUILD_WAR_V2_ENABLED=true DB_FILE=./test-db.json PORT=8871 setsid nohup node server.js > srv.log 2>&1 < /dev/null &
# then: bash <this file>   (fresh test-db.json per run)
# Glyph v2 endpoint test suite — covers the spec §10 checklist
B=http://localhost:8871
PASS=0; FAIL=0
ck(){ local name="$1" expect="$2" got="$3"
  if [[ "$got" == *"$expect"* ]]; then PASS=$((PASS+1)); echo "  ✓ $name";
  else FAIL=$((FAIL+1)); echo "  ✗ $name — expected '$expect' in: ${got:0:180}"; fi }

# register a user with a legacy glyph save (for migration test)
LEGACY_SAVE='{"gold":100,"gems":10,"glyphRank":{"vex":5,"vireo":2},"glyphInv":{"x":3},"glyphCur":{},"glyphLocked":{}}'
REG=$(curl -s -X POST $B/api/register -H "content-type: application/json" -d @reg1.json)
TOK=$(echo "$REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
ck "register" '"token"' "$REG"
H="x-token: $TOK"

# state → migration should run, legacy vex rank 5 → ascensionIndex 5
ST=$(curl -s $B/api/glyphs/state -H "$H")
ck "state enabled" '"enabled":true' "$ST"
ck "migration mapped vex rank" '"ascensionIndex":5' "$ST"
REV=$(echo "$ST" | python3 -c "import sys,json;print(json.load(sys.stdin)['revision'])")

# catalog
CAT=$(curl -s $B/api/glyphs/catalog -H "$H")
ck "catalog 218 defs" '"R16-18"' "$CAT"
ck "catalog subs present" 'Sub-Glyph' "$CAT"

# dev-grant is forbidden for a normal user
GR=$(curl -s -X POST $B/api/glyphs/grant -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"quality\":\"Grey\",\"family\":\"Stoneheart\",\"n\":99}")
ck "grant forbidden for non-dev" 'forbidden' "$GR"

# craft R01-01 (3 × Grey Stoneheart Fragments) — migration pack gave 30
CR=$(curl -s -X POST $B/api/glyphs/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"definitionId\":\"R01-01\"}")
ck "craft grey glyph" '"crafted"' "$CR"
REV=$(echo "$CR" | python3 -c "import sys,json;print(json.load(sys.stdin)['revision'])")
IID=$(echo "$CR" | python3 -c "import sys,json;print(json.load(sys.stdin)['crafted'])")

# stale revision → 409
STALE=$(curl -s -X POST $B/api/glyphs/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":1,\"definitionId\":\"R01-01\"}")
ck "stale revision → STALE" 'STALE' "$STALE"

# client-submitted stats/quantities are ignored (tamper): send junk fields
TAMP=$(curl -s -X POST $B/api/glyphs/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"definitionId\":\"R01-04\",\"stats\":{\"HP\":999999},\"qty\":100,\"outputId\":\"hack\",\"quality\":\"Orange\"}")
ck "tamper fields ignored, craft ok" '"crafted"' "$TAMP"
ck "tamper output id not honored" '"definitionId":"R01-04"' "$TAMP"
REV=$(echo "$TAMP" | python3 -c "import sys,json;print(json.load(sys.stdin)['revision'])")

# socket the grey Stoneheart into vex... but vex board is at index 5 (Blue +2) → must REJECT grey
SK=$(curl -s -X POST $B/api/glyphs/socket -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"heroKey\":\"vex\",\"slot\":0,\"instanceId\":\"$IID\"}")
ck "wrong-quality socket rejected" 'needs Blue +2' "$SK"
REV2=$(echo "$SK" | python3 -c "import sys,json;print(json.load(sys.stdin).get('revision',$REV))")

# socket into a FRESH hero (fritz, index 0=Grey) — Stoneheart fits slot 0 (vitality)
SK2=$(curl -s -X POST $B/api/glyphs/socket -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV2,\"heroKey\":\"fritz\",\"slot\":0,\"instanceId\":\"$IID\"}")
ck "socket grey → fritz vitality" '"ok":true' "$SK2"
REV=$(echo "$SK2" | python3 -c "import sys,json;print(json.load(sys.stdin)['revision'])")

# same instance into a second hero → must reject (status=socketed)
SK3=$(curl -s -X POST $B/api/glyphs/socket -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"heroKey\":\"vireo\",\"slot\":0,\"instanceId\":\"$IID\"}")
ck "same glyph in two heroes rejected" 'not available' "$SK3"

# wrong-family slot: Stoneheart (vitality) into slot 2 (onslaught) → reject
CR2=$(curl -s -X POST $B/api/glyphs/craft -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"definitionId\":\"R01-01\"}")
REV=$(echo "$CR2" | python3 -c "import sys,json;print(json.load(sys.stdin)['revision'])")
IID2=$(echo "$CR2" | python3 -c "import sys,json;print(json.load(sys.stdin)['crafted'])")
SK4=$(curl -s -X POST $B/api/glyphs/socket -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"heroKey\":\"fritz\",\"slot\":2,\"instanceId\":\"$IID2\"}")
ck "wrong-family slot rejected" 'does not fit' "$SK4"

# ascend with partial board → reject, nothing consumed
ASC=$(curl -s -X POST $B/api/glyphs/ascend -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"heroKey\":\"fritz\"}")
ck "ascend partial board rejected" 'All six slots' "$ASC"

# consumed-ingredient craft: consume IID2 via salvage then try to use it — salvage first
SAL=$(curl -s -X POST $B/api/glyphs/salvage -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"instanceIds\":[\"$IID2\"]}")
ck "salvage refunds fragments" '"refund"' "$SAL"
REV=$(echo "$SAL" | python3 -c "import sys,json;print(json.load(sys.stdin)['revision'])")
SAL2=$(curl -s -X POST $B/api/glyphs/salvage -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"instanceIds\":[\"$IID2\"]}")
ck "double-salvage rejected" 'Nothing salvageable' "$SAL2"

# craft-sub needs Blue-tier fragments; grant path is dev-only so use migration Blue stock: Blue Shadepath needs 3 Blue Shadepath frags — not in starter pack fams → expect reject
CS=$(curl -s -X POST $B/api/glyphs/craft-sub -H "$H" -H 'content-type: application/json' -d "{\"expectedRevision\":$REV,\"subKey\":\"Blue Shadepath Sub-Glyph\"}")
ck "craft-sub insufficient frags rejected" 'Need' "$CS"

# full ascend path on a fresh account: register dev-less user, craft 6 grey glyphs across families and ascend
R2=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"gtest2","pass":"pw"}')
T2=$(echo "$R2" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
H2="x-token: $T2"
S2=$(curl -s $B/api/glyphs/state -H "$H2")
RV=$(echo "$S2" | python3 -c "import sys,json;print(json.load(sys.stdin)['revision'])")
# grey defs per slot family: vitality R01-01 Stoneheart, bulwark R01-02 Ironwall, onslaught R01-04 Ravager, spirit R01-05 Starfire, tempo R01-06 Windstep, mastery R01-07 Hawkeye
declare -a DEFS=(R01-01 R01-02 R01-04 R01-05 R01-06 R01-07)
OKALL=1
for i in 0 1 2 3 4 5; do
  C=$(curl -s -X POST $B/api/glyphs/craft -H "$H2" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"definitionId\":\"${DEFS[$i]}\"}")
  RV=$(echo "$C" | python3 -c "import sys,json;print(json.load(sys.stdin).get('revision',0))")
  II=$(echo "$C" | python3 -c "import sys,json;print(json.load(sys.stdin).get('crafted',''))")
  [ -z "$II" ] && OKALL=0 && echo "  craft $i failed: ${C:0:120}"
  SS=$(curl -s -X POST $B/api/glyphs/socket -H "$H2" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"heroKey\":\"vael\",\"slot\":$i,\"instanceId\":\"$II\"}")
  RV=$(echo "$SS" | python3 -c "import sys,json;print(json.load(sys.stdin).get('revision',0))")
  echo "$SS" | grep -q '"ok":true' || { OKALL=0; echo "  socket $i failed: ${SS:0:140}"; }
done
[ $OKALL -eq 1 ] && { PASS=$((PASS+1)); echo "  ✓ crafted+socketed full grey board"; } || { FAIL=$((FAIL+1)); echo "  ✗ full board setup"; }
A2=$(curl -s -X POST $B/api/glyphs/ascend -H "$H2" -H 'content-type: application/json' -d "{\"expectedRevision\":$RV,\"heroKey\":\"vael\"}")
ck "ascend full board → index 1" '"ascensionIndex":1' "$A2"
ck "ascend accumulated stats" 'HP' "$A2"

# post-migration save-strip: upload a save with glyphRank → server must strip it
SAVE=$(curl -s -X POST $B/api/save -H "$H2" -H 'content-type: application/json' -d '{"roster":{"__save":"{\"gold\":5,\"glyphRank\":{\"vael\":15},\"glyphInv\":{\"h\":9}}"}}')
ck "save accepted" '"ok":true' "$SAVE"
PROF=$(curl -s $B/api/profile -H "$H2")
if echo "$PROF" | grep -q 'glyphRank'; then FAIL=$((FAIL+1)); echo "  ✗ glyph fields NOT stripped from save"; else PASS=$((PASS+1)); echo "  ✓ legacy glyph fields stripped from uploaded save"; fi
# and the server board is untouched by the tampered save
S3=$(curl -s $B/api/glyphs/state -H "$H2")
ck "server board unaffected by save tamper" '"ascensionIndex":1' "$S3"

echo ""
echo "=============================="
echo "PASS: $PASS   FAIL: $FAIL"
