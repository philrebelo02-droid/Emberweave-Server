#!/bin/bash
# Skyfall tournament lifecycle test (uses dev time-warp)
B=http://localhost:8871
PASS=0; FAIL=0
ck(){ if [[ "$3" == *"$2"* ]]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 — wanted '$2' in: ${3:0:200}"; fi }
jv(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

# users: dev1 (admin, for warp), u1 leader guild Alpha, u2 leader guild Beta
DV=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}'); TD=$(echo "$DV"|jv "['token']")
[ -z "$TD" ] && { DV=$(curl -s -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"dev1","pass":"password1"}'); TD=$(echo "$DV"|jv "['token']"); }
U1=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"wu1","pass":"password1"}'); T1=$(echo "$U1"|jv "['token']")
[ -z "$T1" ] && { U1=$(curl -s -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"wu1","pass":"password1"}'); T1=$(echo "$U1"|jv "['token']"); }
U2=$(curl -s -X POST $B/api/register -H 'content-type: application/json' -d '{"name":"wu2","pass":"password1"}'); T2=$(echo "$U2"|jv "['token']")
[ -z "$T2" ] && { U2=$(curl -s -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"wu2","pass":"password1"}'); T2=$(echo "$U2"|jv "['token']"); }
HD="x-token: $TD"; H1="x-token: $T1"; H2="x-token: $T2"
# u1 gets a stronger save so Alpha should win fights
python3 - << 'PY' > wsave.json
import json
save={"playerXP":900000,"heroXP":{k:150000 for k in ["vael","vex","umbris","bloatus","oakmir","fritz"]},"starLevel":{"vael":5,"vex":5},"starPip":{}}
print(json.dumps({"roster":{"__save":json.dumps(save)}}))
PY
curl -s -X POST $B/api/save -H "$H1" -H 'content-type: application/json' -d @wsave.json >/dev/null
# v229 P0: the save above no longer feeds progression (starter ledger) — build wu1's strength the
# legitimate way, through the admin ledger grant (dev1 must be ADMIN_IDS, per the runner contract).
ID1=$(echo "$U1"|jv "['profile']['id']")
WSIX='["vael","vex","umbris","bloatus","oakmir","fritz"]'
curl -s -X POST $B/api/admin/led-grant -H "$HD" -H 'content-type: application/json' -d '{"userId":"'"$ID1"'","unlock":'"$WSIX"',"heroKeys":'"$WSIX"',"heroXp":150000,"px":900000,"stars":5}' >/dev/null
curl -s -X POST $B/api/guild/create -H "$H1" -H 'content-type: application/json' -d '{"name":"Alpha"}' >/dev/null
curl -s -X POST $B/api/guild/create -H "$H2" -H 'content-type: application/json' -d '{"name":"Beta"}' >/dev/null

# compute warp offset to NEXT Saturday 01:00 ET
OFF=$(python3 - << 'PY'
import time, datetime
ET=4*3600
now=time.time()
et=datetime.datetime.utcfromtimestamp(now-ET)
days_ahead=(5-et.weekday())%7  # weekday(): Mon=0..Sat=5
if days_ahead==0 and et.hour>=1: days_ahead=7
target=datetime.datetime(et.year,et.month,et.day)+datetime.timedelta(days=days_ahead,hours=1)
target_real=target.timestamp()+ET-time.timezone if False else (target-datetime.datetime(1970,1,1)).total_seconds()+ET
print(int((target_real-now)*1000))
PY
)
W=$(curl -s -X POST $B/api/guild-war/debug-warp -H "$HD" -H 'content-type: application/json' -d "{\"offsetMs\":$OFF}")
ck "warp to Saturday: registration" '"state":"registration"' "$W"

REG_NONMEM=$(curl -s -X POST $B/api/guild-war/register -H "$HD" -H 'content-type: application/json' -d '{}')
ck "non-guild register rejected" 'not in a guild' "$REG_NONMEM"
R1=$(curl -s -X POST $B/api/guild-war/register -H "$H1" -H 'content-type: application/json' -d '{}')
ck "Alpha registers, server-computed power" '"powerPool"' "$R1"
R2=$(curl -s -X POST $B/api/guild-war/register -H "$H2" -H 'content-type: application/json' -d '{}')
ck "Beta registers" '"powerPool"' "$R2"
RDUP=$(curl -s -X POST $B/api/guild-war/register -H "$H1" -H 'content-type: application/json' -d '{}')
ck "double register rejected" 'Already registered' "$RDUP"

# warp to Monday 01:00 ET (+2 days): lock → bracket, Alpha (higher power) = seed 1
OFF2=$((OFF+2*86400000))
W2=$(curl -s -X POST $B/api/guild-war/debug-warp -H "$HD" -H 'content-type: application/json' -d "{\"offsetMs\":$OFF2}")
ck "Monday: bracket state" '"state":"bracket"' "$W2"
S1=$(curl -s $B/api/guild-war/status -H "$H1")
ck "match created in planning" '"state":"planning"' "$S1"
ck "Alpha is seed 1" '"seed":1' "$S1"
ck "opponent HIDDEN before Tuesday reveal" '"preReveal":true' "$S1"
ASEARLY=$(curl -s -X POST $B/api/guild-war/assign -H "$H1" -H 'content-type: application/json' -d "{\"memberId\":\"$(echo "$U1"|jv "['profile']['id']")\",\"lane\":0}")
ck "assign before reveal rejected" 'Planning opens' "$ASEARLY"

# warp to Tuesday 01:00 ET: opponent revealed, planning open, officer roster present
OFF2B=$((OFF+3*86400000+3600000))
curl -s -X POST $B/api/guild-war/debug-warp -H "$HD" -H 'content-type: application/json' -d "{\"offsetMs\":$OFF2B}" >/dev/null
S1B=$(curl -s $B/api/guild-war/status -H "$H1")
ck "opponent revealed Tuesday" '"preReveal":false' "$S1B"
ck "officer placement roster present" '"roster"' "$S1B"

# planning: leader assigns own line to lane 0; non-leader forbidden; assault before live rejected
AS=$(curl -s -X POST $B/api/guild-war/assign -H "$H1" -H 'content-type: application/json' -d "{\"memberId\":\"$(echo "$U1"|jv "['profile']['id']")\",\"lane\":0}")
ck "leader assigns to Iron Gate" '"ok":true' "$AS"
EARLY=$(curl -s -X POST $B/api/guild-war/assault -H "$H1" -H 'content-type: application/json' -d '{"fromLane":0}')
ck "assault during planning rejected" 'No live match' "$EARLY"

# warp to Tuesday 18:30 ET → locked+live
OFF3=$((OFF+3*86400000+3600000*18+1800000))
W3=$(curl -s -X POST $B/api/guild-war/debug-warp -H "$HD" -H 'content-type: application/json' -d "{\"offsetMs\":$OFF3}")
M=$(curl -s $B/api/guild-war/match -H "$H1")
ck "match is live after 6PM lock" '"state":"live"' "$M"
ck "lock timestamp recorded (fresh 6PM snapshot ran)" '"lockedAt":17' "$M"
ck "Beta auto-placed unassigned line" '"wu2"' "$M"
ASLOCK=$(curl -s -X POST $B/api/guild-war/assign -H "$H1" -H 'content-type: application/json' -d "{\"memberId\":\"$(echo "$U1"|jv "['profile']['id']")\",\"lane\":2}")
ck "placement rejected AFTER lock" 'No match in planning' "$ASLOCK"

# Alpha assaults lane 0 (Beta's only defender) — strong save should win
A1=$(curl -s -X POST $B/api/guild-war/assault -H "$H1" -H 'content-type: application/json' -d '{"fromLane":0}')
ck "assault resolves server-side" '"won":' "$A1"
WON=$(echo "$A1"|jv "['won']")
if [ "$WON" = "True" ]; then
  ck "lane 0 citadel fell (last defender beaten)" '"citadelFell":true' "$A1"
  # bridge rule: a line may only assault across its OWN lane — wu1 is deployed in lane 0 only
  A2=$(curl -s -X POST $B/api/guild-war/assault -H "$H1" -H 'content-type: application/json' -d '{"fromLane":1}')
  ck "cross-lane assault rejected (bridge rule)" 'not deployed' "$A2"
  A3=$(curl -s -X POST $B/api/guild-war/assault -H "$H1" -H 'content-type: application/json' -d '{"fromLane":0}')
  ck "assault on destroyed citadel rejected" 'already destroyed' "$A3"
else
  echo "  (Alpha lost the fight — checking order accounting instead)"
  ck "order spent on loss" '"ok":true' "$A1"
fi

# order cap: wu1 already spent 3? spent 3 if captured twice + fight → assaultsLeft 0 check via match view
MV=$(curl -s $B/api/guild-war/match -H "$H1")
ck "match view has event log" 'ASSAULT' "$MV"

# tournament completes (single round of 2 → champion) after round end
OFF4=$((OFF+3*86400000+3600000*21))
W4=$(curl -s -X POST $B/api/guild-war/debug-warp -H "$HD" -H 'content-type: application/json' -d "{\"offsetMs\":$OFF4}")
ck "tournament finished with champion" '"state":"finished"' "$W4"
ST=$(curl -s $B/api/guild-war/status -H "$H1")
CH=$(echo "$ST"|jv "['tournament']['championGuildId']")
[ -n "$CH" ] && [ "$CH" != "None" ] && { PASS=$((PASS+1)); echo "  ✓ champion recorded"; } || { FAIL=$((FAIL+1)); echo "  ✗ no champion"; }

# rewards: claim once, not twice; loser gets participant tier
C1=$(curl -s -X POST $B/api/guild-war/claim-reward -H "$H1" -H 'content-type: application/json' -d '{}')
ck "winner claims reward" '"ok":true' "$C1"
C1B=$(curl -s -X POST $B/api/guild-war/claim-reward -H "$H1" -H 'content-type: application/json' -d '{}')
ck "double claim rejected" 'Already claimed' "$C1B"
C2=$(curl -s -X POST $B/api/guild-war/claim-reward -H "$H2" -H 'content-type: application/json' -d '{}')
ck "other guild claims their tier" '"ok":true' "$C2"

# reset warp
curl -s -X POST $B/api/guild-war/debug-warp -H "$HD" -H 'content-type: application/json' -d '{"offsetMs":0}' >/dev/null
echo ""; echo "PASS: $PASS  FAIL: $FAIL"
