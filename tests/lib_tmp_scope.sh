# Source me. Scopes every temp file/dir of this process tree to ONE per-run folder and removes it on exit.
# Why: ~140 tests make their own os.tmpdir()/mktemp folders (emberweave-durable-route-*, ew-v####-*, ember-helper-*, playwright-artifacts-*, ...).
# Many never clean up (failed run, killed run, forgotten finally), and on this PC 40,000 of them piled up to 236 GB in %TEMP%.
# Node reads TEMP/TMP (Windows) or TMPDIR, Git Bash mktemp reads TMPDIR - all three point into the run folder, so every child inherits it.
# ew_tmp_scope_rm is idempotent; call it from the EXIT trap (a trap on EXIT also runs after a failure or an `exit 1`).
ew_tmp_scope_begin() {
  EW_RUN_TMP=$(mktemp -d "${TMPDIR:-/tmp}/ew-run-XXXXXX") || return 1
  export TMPDIR="$EW_RUN_TMP"
  if command -v cygpath >/dev/null 2>&1; then
    TEMP=$(cygpath -w "$EW_RUN_TMP"); TMP="$TEMP"; export TEMP TMP
  fi
}
ew_tmp_scope_rm() {
  [ -n "${EW_RUN_TMP:-}" ] && [ -d "$EW_RUN_TMP" ] || return 0
  local i
  for i in 1 2 3 4 5; do   # a browser or server that is still exiting can hold a file for a moment
    rm -rf "$EW_RUN_TMP" 2>/dev/null
    [ -d "$EW_RUN_TMP" ] || break
    sleep 1
  done
  [ -d "$EW_RUN_TMP" ] && echo "WARN: could not remove $EW_RUN_TMP" >&2
  return 0
}
