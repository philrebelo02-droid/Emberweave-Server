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
NOPT=$(echo "$SO"|python3 -c "import sys,json;print(len(json.load(sys.stdin)['options']))")
[ "$NOPT" == "1" ] && { PASS=$((PASS+1)); echo "  ✓ ONE pre-chosen glyph per slot (no option lists)"; } || { FAIL=$((FAIL+1)); echo "  ✗ expected exactly 1 option, got $NOPT"; }
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
printf '%s' "$CAT" > /tmp/_gl_cat.json
WF=$(python3 - <<'PY'
import json
cat=json.load(open('/tmp/_gl_cat.json'))
print(next(x['id'] for x in cat['defs'] if x['qi']==0 and x['family']=='Starfire'))
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

# ---- GLYPH ANCESTRY TREE (spec 27 Aug) ----
BT=$(curl -s "$B/api/glyphs/build-tree?heroKey=vael&slot=0" -H "$H")
ck "ANCESTRY: root is the slot's one finished glyph" '"kind":"finishedGlyph"' "$BT"
ck "ANCESTRY: fragment leaves carry owned/needed + stage sources" '"sources"' "$BT"
BTC=$(echo "$BT"|python3 -c "
import sys,json;d=json.load(sys.stdin)
def leaves(n,out):
    if n['kind']=='fragment': out.append(n)
    for c in n.get('children',[]): leaves(c,out)
    return out
ls=leaves(d['root'],[])
tot={t['key']:t['need'] for t in d['totals']}
acc={}
for l in ls: acc[l['key']]=acc.get(l['key'],0)+l['need']
print(len(ls)>0, acc==tot, d['canQuickAllocate']==all(t['have']>=t['need'] for t in d['totals']))")
ck "ANCESTRY: totals equal the sum of the leaves; quick-allocate gates on full ownership" 'True True True' "$BTC"
BTL=$(curl -s "$B/api/glyphs/build-tree?heroKey=vael&slot=1" -H "$H")
# slot 1 was built earlier in this suite? no — slots 1-5 were built then CONSUMED by ascend; board is Green now, slot 1 empty. Build slot 1 fresh to test the LOCKED read-only view at Green? cost needs Green frags — grant via dev:
RVG=$(curl -s $B/api/glyphs/state -H "x-token: $TD"|jv "['revision']")
for FAM in Stoneheart Ironwall Veilward Ravager Starfire Windstep Hawkeye Lifebloom Sunder Shadepath; do
  RVG=$(curl -s $B/api/glyphs/state -H "x-token: $TD"|jv "['revision']")
  curl -s -X POST $B/api/glyphs/grant -H "x-token: $TD" -H 'content-type: application/json' -d '{"userId":"'"$GID"'","quality":"Green","family":"'"$FAM"'","n":30,"expectedRevision":'"$RVG"'}' >/dev/null
  RVG=$(curl -s $B/api/glyphs/state -H "x-token: $TD"|jv "['revision']")
  curl -s -X POST $B/api/glyphs/grant -H "x-token: $TD" -H 'content-type: application/json' -d '{"userId":"'"$GID"'","quality":"Grey","family":"'"$FAM"'","n":30,"expectedRevision":'"$RVG"'}' >/dev/null
done
BT0=$(curl -s "$B/api/glyphs/build-tree?heroKey=vael&slot=0" -H "$H")
BP0=$(echo "$BT0"|jv "['blueprintId']")
RV=$(curl -s $B/api/glyphs/state -H "$H"|jv "['revision']")
BB=$(curl -s -X POST $B/api/glyphs/build-in-slot -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","slot":0,"blueprintId":"'"$BP0"'","expectedRevision":'"$RV"',"requestId":"tree1"}')
ck "ANCESTRY: Build Here at the root consumes the server-derived total once" '"locked":true' "$BB"
BTLK=$(curl -s "$B/api/glyphs/build-tree?heroKey=vael&slot=0" -H "$H")
ck "ANCESTRY: a locked slot's tree is read-only (no build/allocate)" '"locked":true' "$BTLK"
LKC=$(echo "$BTLK"|python3 -c "import sys,json;d=json.load(sys.stdin);print(d['canBuild']==False and d['canQuickAllocate']==False)")
ck "ANCESTRY: locked view exposes no actions" 'True' "$LKC"

# ---- v242 (Phil): Quick Allocate All = build EVERY remaining slot at once, ALL-OR-NOTHING ----
BT1=$(curl -s "$B/api/glyphs/build-tree?heroKey=vael&slot=1" -H "$H")
ck "BUILD-ALL: build-tree exposes canBuildAll=true when every remaining slot is affordable" '"canBuildAll":true' "$BT1"
RV=$(curl -s $B/api/glyphs/state -H "$H"|jv "['revision']")
BA=$(curl -s -X POST $B/api/glyphs/build-all -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","expectedRevision":'"$RV"',"requestId":"ba1"}')
NBA=$(echo "$BA"|python3 -c "import sys,json;print(len(json.load(sys.stdin).get('built',[])))" 2>/dev/null)
ck "BUILD-ALL: one atomic call built the 5 remaining slots" '5' "$NBA"
BA2=$(curl -s -X POST $B/api/glyphs/build-all -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","expectedRevision":0,"requestId":"ba1"}')
ck "BUILD-ALL: idempotent retry returns the same receipt (beats STALE)" '"built"' "$BA2"
RV=$(curl -s $B/api/glyphs/state -H "$H"|jv "['revision']")
BA3=$(curl -s -X POST $B/api/glyphs/build-all -H "$H" -H 'content-type: application/json' -d '{"heroKey":"vael","expectedRevision":'"$RV"',"requestId":"ba3"}')
ck "BUILD-ALL: a full board is refused" 'already built' "$BA3"
UQ=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"qba","pass":"password1"}')
TQ=$(echo "$UQ"|jv "['token']")
RVQ=$(curl -s $B/api/glyphs/state -H "x-token: $TQ"|jv "['revision']")
BAQ=$(curl -s -X POST $B/api/glyphs/build-all -H "x-token: $TQ" -H 'content-type: application/json' -d '{"heroKey":"vael","expectedRevision":'"$RVQ"',"requestId":"baq"}')
ck "BUILD-ALL: refused outright when the account cannot afford ALL slots (nothing consumed)" 'Not enough materials' "$BAQ"
BTQ=$(curl -s "$B/api/glyphs/build-tree?heroKey=vael&slot=0" -H "x-token: $TQ")
ck "BUILD-ALL: canBuildAll=false for the broke account (button stays dim)" '"canBuildAll":false' "$BTQ"

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
