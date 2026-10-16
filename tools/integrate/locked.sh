#!/bin/bash
# tools/integrate/locked.sh <who> <outlog> -- <command...>
# Run ONE GPU-touching job (a headless browser rig, a browser test) under the shared GPU lock (C:/Emberweave/tools/gpu_lock.sh - the 15 Oct
# 0x119 crash came from two WebGL rigs and a render on the 4080 at once). Waits for the lock, refuses to start with < 2 GB free on the card,
# drops the lock on exit. One job per call: callers loop, they never run two of these in parallel. Sound: every browser the pipeline starts is
# headless with --mute-audio and AudioContext removed before load (rig_hero.js, the browser tests) - nothing plays on the speakers.
WHO=$1; LOG=$2; shift 2; [ "$1" = "--" ] && shift
LOCK_SH=${EW_GPU_LOCK:-C:/Emberweave/tools/gpu_lock.sh}
source "$LOCK_SH" || { echo "no gpu lock script at $LOCK_SH"; exit 5; }
gpu_lock_take "$WHO" || exit 3
trap gpu_lock_drop EXIT
FREE=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | head -1)
if [ -n "$FREE" ] && [ "$FREE" -lt 2048 ]; then echo "GPU free ${FREE} MB < 2 GB - stop"; exit 4; fi
echo "== $WHO lock taken $(date +%T), GPU free ${FREE:-?} MB" | tee -a "$LOG"
"$@" >> "$LOG" 2>&1
RC=$?
echo "== $WHO exit $RC $(date +%T)" | tee -a "$LOG"
exit $RC
