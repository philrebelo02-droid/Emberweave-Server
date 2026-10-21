#!/bin/bash
# The run leaves no temp folders behind (tests/lib_tmp_scope.sh). The suite once left ~40,000 folders / 236 GB in %TEMP%.
# Runs a stand-in "test" (node os.tmpdir() + mkdtemp + bash mktemp, files inside, then a FAILING exit) the way run_all_tests.sh does:
#   - scoped (sources the lib, EXIT trap removes the run folder): the temp dir must hold nothing new afterwards, even though the stand-in failed
#   - CONTROL: the same stand-in unscoped leaves its folders (so the check can see a leak), then this test removes them
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
LIB="$HERE/lib_tmp_scope.sh"
BASE="$( [ -n "${TEMP:-}" ] && command -v cygpath >/dev/null && cygpath -u "$TEMP" || echo "${TMPDIR:-/tmp}" )"                       # the dir the stand-ins' own temp dirs would land in without the scope
FAIL=0
ck(){ if [ "$2" = 1 ]; then echo "  ok  $1"; else echo "  FAIL $1"; FAIL=1; fi; }

CHILD=$(mktemp "$BASE/ew-tmpcheck-child-XXXXXX.sh")
cat > "$CHILD" <<'EOF'
node -e "
const fs=require('fs'),os=require('os'),path=require('path');
for(const p of ['emberweave-durable-route-','ew-v9999-','playwright-artifacts-']){ const d=fs.mkdtempSync(path.join(os.tmpdir(),p)); fs.writeFileSync(path.join(d,'db.json'),'{}'); }"
d=$(mktemp -d "${TMPDIR:-/tmp}/ember-helper-XXXXXX"); echo x > "$d/f"
exit 1
EOF
list(){ ls -A "$BASE" 2>/dev/null | grep -E '^(emberweave-durable-route-|ew-v9999-|playwright-artifacts-|ember-helper-|ew-run-)' | sort; }

before=$(list)
( . "$LIB"; ew_tmp_scope_begin; trap ew_tmp_scope_rm EXIT; bash "$CHILD" ) >/dev/null 2>&1
rc=$?
after=$(list)
ck "the stand-in test failed (exit $rc) and still left nothing behind in the temp dir" $([ "$rc" = 1 ] && [ "$before" = "$after" ] && echo 1 || echo 0)

( bash "$CHILD" ) >/dev/null 2>&1
leak=$(comm -13 <(echo "$before") <(list))
ck "CONTROL: the same stand-in unscoped leaves folders ($(echo "$leak" | grep -c .) found)" $([ "$(echo "$leak" | grep -c .)" -ge 4 ] && echo 1 || echo 0)
echo "$leak" | grep . | while read -r n; do rm -rf "$BASE/$n"; done
rm -f "$CHILD"
[ "$FAIL" = 0 ] && echo "PASS: tmp cleanup" || echo "FAIL: tmp cleanup"
exit $FAIL
