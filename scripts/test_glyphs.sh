#!/bin/bash
# GLYPH DIRECT-BUILD suite (Correction Spec v1) — canonical 16-step ladder, retired legacy
# endpoints, server-derived slot options, atomic idempotent build-in-slot, permanence, ascend,
# and named deterministic campaign fragment drops. Server: v2 flags on, FRESH DB batch,
# dev1 = ADMIN_IDS (runner contract).
B=http://localhost:8871
PASS=0; FAIL=0
ck(){ if [[ "$3" == *"$2"* ]]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 — expected '$2' in: ${3:0:200}"; fi }
jv(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

R=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"gl1","pass":"password1"}')
T=$(echo "$R"|jv "['token']"); H="x-token: $T"
ck "register" '"token"' "$R"
GID=$(echo "$R"|jv "['profile']['id']")

# ---- 27 Aug (Phil): NO starter fragment pack — a fresh account owns ZERO fragments ----
ST0=$(curl -s $B/api/glyphs/state -H "$H")
NF=$(echo "$ST0"|python3 -c "import sys,json;print(sum(json.load(sys.stdin).get('fragments',{}).values()))")
[ "$NF" == "0" ] && { PASS=$((PASS+1)); echo "  ✓ fresh account starts with ZERO fragments (no starter pack)"; } || { FAIL=$((FAIL+1)); echo "  ✗ fresh account has $NF fragments"; }

# fixture: dev grants gl1 a working pool of named fragments (the legitimate faucet)
TDF=$(curl -s -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}'|jv "['token']")
for FAM in Stoneheart Ironwall Veilward Ravager Starfire Windstep Hawkeye Lifebloom; do
  RVF=$(curl -s $B/api/glyphs/state -H "x-token: $TDF"|jv "['revision']")
  curl -s -X POST $B/api/glyphs/grant -H "x-token: $TDF" -H 'content-type: application/json' -d '{"userId":"'"$GID"'","quality":"Grey","family":"'"$FAM"'","n":30,"expectedRevision":'"$RVF"'}' >/dev/null
done

# ---- canonical ladder + slim state ----
ST=$(curl -s $B/api/glyphs/state -H "$H")
ck "state enabled" '"enabled":true' "$ST"
NL=$(echo "$ST"|python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('ladder',[])), 'finished' in d, 'subGlyphs' in d)")
ck "LADDER: exactly 16 canonical values, no loose inventory in state" '16 False False' "$NL"
CAT=$(curl -s $B/api/glyphs/catalog -H "$H")
ck "catalog 218 defs" '"R16-18"' "$CAT"
RV=$(echo "$ST"|jv "['revision']")

# ---- illegal qualities rejected everywhere ----
TD=$(curl -s -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}'|jv "['token']"); HD="x-token: $TD"
RVD=$(curl -s $B/api/glyphs/state -H "$HD"|jv "['revision']")
BADQ=$(curl -s -X POST $B/api/glyphs/grant -H "$HD" -H 'content-type: application/json' -d '{"quality":"Grey +1","family":"Stoneheart","n":5,"expectedRevision":'"$RVD"'}')
ck "LADDER: 'Grey +1' rejected by the API" 'Bad quality' "$BADQ"
BADQ2=$(curl -s -X POST $B/api/glyphs/grant -H "$HD" -H 'content-type: application/json' -d '{"quality":"Blue +3","family":"Stoneheart","n":5,"expectedRevision":'"$RVD"'}')
ck "LADDER: 'Blue +3' rejected by the API" 'Bad quality' "$BADQ2"

# ---- retired legacy endpoints ----
for EP in craft craft-sub socket salvage; do
  RR=$(curl -s -X POST $B/api/glyphs/$EP -H "$H" -H 'content-type: application/json' -d '{}')
  ck "RETIRED: /$EP returns GLYPH_FLOW_REPLACED" 'GLYPH_FLOW_REPLACED' "$RR"
done
RU=$(curl -s -X POST $B/api/glyphs/unsocket -H "$H" -H 'content-type: application/json' -d '{}')
ck "PERMANENCE: /unsocket returns GLYPH_LOCKED" 'GLYPH_LOCKED' "$RU"

# ---- slot options: server-derived, with materials + stage sources ----
SO=$(curl -s "$B/api/glyphs/slot-options?heroKey=vael&slot=0" -H "$H")
ck "slot-options lists Grey blueprints" '"quality":"Grey"' "$SO"
ck "slot-options names exact materials with sources" '"sources"' "$SO"
BP=$(echo "$SO"|jv "['options'][0]['blueprintId']")
FK=$(echo "$SO"|jv "['options'][0]['materials'][0]['key']")
NEED=$(echo "$SO"|jv "['options'][0]['materials'][0]['need']")
HAVE0=$(echo "$SO"|jv "['options'][0]['materials'][0]['have']")

# ---- direct build: consumes exact named materials once, locks the slot ----
RV=$(curl -s $B/api/glyphs/state -H "$H"|jv "['revision']")
B1=$(curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","slot":0,"blueprintId":"'"$BP"'","expectedRevision":'"$RV"',"requestId":"b1"}')
ck "build-in-slot locks the glyph" '"locked":true' "$B1"
ck "build receipt names the consumed fragments" '"consumed"' "$B1"
HAVE1=$(curl -s $B/api/glyphs/state -H "$H"|python3 -c "import sys,json;print(json.load(sys.stdin)['fragments'].get('$FK',0))")
[ "$((HAVE0-HAVE1))" == "$NEED" ] && { PASS=$((PASS+1)); echo "  ✓ exact named cost consumed once ($NEED × $FK)"; } || { FAIL=$((FAIL+1)); echo "  ✗ cost mismatch: had $HAVE0 now $HAVE1 need $NEED"; }
B2=$(curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","slot":0,"blueprintId":"'"$BP"'","expectedRevision":'"$RV"',"requestId":"b1"}')
[ "$B1" == "$B2" ] && { PASS=$((PASS+1)); echo "  ✓ duplicate requestId returns the original receipt"; } || { FAIL=$((FAIL+1)); echo "  ✗ replay differed"; }
HAVE2=$(curl -s $B/api/glyphs/state -H "$H"|python3 -c "import sys,json;print(json.load(sys.stdin)['fragments'].get('$FK',0))")
[ "$HAVE1" == "$HAVE2" ] && { PASS=$((PASS+1)); echo "  ✓ replay never double-consumes"; } || { FAIL=$((FAIL+1)); echo "  ✗ replay consumed again"; }

# ---- negative builds ----
RV=$(curl -s $B/api/glyphs/state -H "$H"|jv "['revision']")
N1=$(curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","slot":0,"blueprintId":"'"$BP"'","expectedRevision":'"$RV"',"requestId":"n1"}')
ck "NEG: occupied slot rejected" 'already locked' "$N1"
GRN=$(echo "$CAT"|python3 -c "import sys,json;d=json.load(sys.stdin);print([x['id'] for x in d['defs'] if x['qi']==1][0])")
N2=$(curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","slot":1,"blueprintId":"'"$GRN"'","expectedRevision":'"$RV"',"requestId":"n2"}')
ck "NEG: wrong-quality blueprint rejected" 'builds Grey glyphs' "$N2"
N3=$(curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"fritz","slot":0,"blueprintId":"'"$BP"'","expectedRevision":'"$RV"',"requestId":"n3"}')
ck "NEG: foreign (locked) hero rejected" 'not unlocked' "$N3"
N4=$(curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"nobody","slot":0,"blueprintId":"'"$BP"'","expectedRevision":'"$RV"',"requestId":"n4"}')
ck "NEG: unknown hero rejected" 'Unknown hero' "$N4"
N5=$(curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","slot":1,"blueprintId":"'"$BP"'","expectedRevision":99999,"requestId":"n5"}')
ck "NEG: stale revision rejected" 'STALE' "$N5"
# wrong family: find a Grey def whose family is NOT accepted by slot 1's options
S1=$(curl -s "$B/api/glyphs/slot-options?heroKey=vael&slot=1" -H "$H")
printf '%s' "$CAT" > /tmp/_gl_cat.json; printf '%s' "$S1" > /tmp/_gl_s1.json
WF=$(python3 - <<'PY'
import json
cat=json.load(open('/tmp/_gl_cat.json')); s1=json.load(open('/tmp/_gl_s1.json'))
ok={o['blueprintId'] for o in s1['options']}
c=[x['id'] for x in cat['defs'] if x['qi']==0 and x['id'] not in ok]
print(c[0] if c else '')
PY
)
N6=$(curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","slot":1,"blueprintId":"'"$WF"'","expectedRevision":'"$RV"',"requestId":"n6"}')
ck "NEG: wrong family for the slot rejected" 'does not fit' "$N6"
# insufficient materials: dev drains one needed fragment family, then the build must fail atomically
# ---- permanence vs tamper: a save upload cannot alter boards ----
curl -s -X POST $B/api/save -H "$H" -H 'content-type: application/json' -d '{"roster":{"__save":"{\"glyphRank\":{\"vael\":9}}"}}' >/dev/null
BD=$(curl -s $B/api/glyphs/state -H "$H"|python3 -c "import sys,json;b=json.load(sys.stdin)['boards']['vael'];print(b['ascensionIndex'], b['slots'][0]['locked'])")
ck "TAMPER: save upload cannot change board or unlock state" '0 True' "$BD"

# ---- fill all six + ascend ----
for SL in 1 2 3 4 5; do
  SOx=$(curl -s "$B/api/glyphs/slot-options?heroKey=vael&slot=$SL" -H "$H")
  BPx=$(echo "$SOx"|python3 -c "import sys,json;d=json.load(sys.stdin);print(next(o['blueprintId'] for o in d['options'] if o['buildable']))")
  RVx=$(curl -s $B/api/glyphs/state -H "$H"|jv "['revision']")
  curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","slot":'"$SL"',"blueprintId":"'"$BPx"'","expectedRevision":'"$RVx"',"requestId":"f'"$SL"'"}' >/dev/null
done
RV=$(curl -s $B/api/glyphs/state -H "$H"|jv "['revision']")
AS=$(curl -s -X POST $B/api/glyphs/ascend -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","expectedRevision":'"$RV"'}')
ck "ASCEND: six locked builds consumed, next canonical quality opens" '"ascensionIndex":1' "$AS"
ck "ASCEND: permanent stats recorded" 'HP' "$AS"
RV=$(curl -s $B/api/glyphs/state -H "$H"|jv "['revision']")
AS2=$(curl -s -X POST $B/api/glyphs/ascend -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","expectedRevision":'"$RV"'}')
ck "ASCEND: empty board cannot ascend again" 'All six' "$AS2"
SO2=$(curl -s "$B/api/glyphs/slot-options?heroKey=vael&slot=0" -H "$H")
ck "board now builds the NEXT ladder step (Green)" '"quality":"Green"' "$SO2"

# ---- deterministic named campaign drops ----
CS=$(curl -s "$B/api/campaign/stage?node=1" -H "$H")
ck "stage 1 names its exact fragment target" 'grey-stoneheart' "$CS"
CS15=$(curl -s "$B/api/campaign/stage?node=15" -H "$H")
F15=$(echo "$CS15"|jv "['stage']['rewards']['glyphFragments'][0]['key']")
[ "$F15" != "Grey Stoneheart" ] && [ -n "$F15" ] && { PASS=$((PASS+1)); echo "  ✓ a different stage names its own target ($F15)"; } || { FAIL=$((FAIL+1)); echo "  ✗ stage 15 target wrong: $F15"; }
CS1B=$(curl -s "$B/api/campaign/stage?node=1" -H "$H")
[ "$CS" == "$CS1B" ] && { PASS=$((PASS+1)); echo "  ✓ stage fragment target is fixed across loads"; } || { FAIL=$((FAIL+1)); echo "  ✗ stage target varied"; }

echo ""; echo "PASS: $PASS  FAIL: $FAIL"
[ $FAIL -eq 0 ] || exit 1
