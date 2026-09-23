"""Emberweave Brain - heartbeat watcher.

External keep-alive: pings the engine every BEAT seconds; if the engine misses
MISSES consecutive beats, relaunches app.py with the canonical interpreter.
She cannot revive herself from inside, so this lives outside her.

Single-instance: exits if another live watcher holds the lock file. The
relaunch re-checks the port immediately before spawning to close the race
between two watchers detecting silence at once.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

BASE = Path(__file__).parent
URL = "http://localhost:7777/api/status"
BEAT = 15          # seconds between beats
MISSES = 2         # consecutive failed beats before relaunch
LOG = BASE / "_heartbeat.log"
STATE = BASE / "beats.json"
LOCK = BASE / "_heartbeat.lock"
# the runtime the Electron app itself uses - never sys.executable, so a
# watcher spawned by any other interpreter still relaunches her canonically
CANON_PYW = (r"C:\Users\Home\AppData\Roaming\kimi-desktop\daimon-share"
             r"\daimon\runtime\python\.venv\Scripts\pythonw.exe")


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    try:
        lines = LOG.read_text(encoding="utf-8").splitlines()
        if len(lines) > 200:
            LOG.write_text("\n".join(lines[-200:]) + "\n", encoding="utf-8")
    except Exception:
        pass


def ping():
    try:
        with urllib.request.urlopen(URL, timeout=5) as r:
            return r.status == 200
    except Exception:
        return False


def pid_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def another_watcher_alive():
    try:
        pid = int(LOCK.read_text(encoding="utf-8").strip())
    except Exception:
        return False
    return pid != os.getpid() and pid_alive(pid)


def relaunch():
    # re-check the port at the last instant so two watchers can't both spawn
    if ping():
        log("port came back before relaunch - skipping")
        return
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
    subprocess.Popen([CANON_PYW, "app.py"], cwd=str(BASE), creationflags=flags)
    log("RELAUNCHED app.py via canonical pythonw")


def main():
    if another_watcher_alive():
        log(f"another watcher alive - exiting (pid file: {LOCK.read_text().strip()})")
        return
    LOCK.write_text(str(os.getpid()), encoding="utf-8")
    log(f"watcher started (pid {os.getpid()})")
    state = {"last_beat": None, "misses": 0, "restarts": 0,
             "started": time.strftime("%Y-%m-%d %H:%M:%S")}
    try:
        while True:
            time.sleep(BEAT)
            if ping():
                state["last_beat"] = time.strftime("%H:%M:%S")
                state["misses"] = 0
            else:
                state["misses"] += 1
                log(f"miss {state['misses']}/{MISSES} - engine silent")
                if state["misses"] >= MISSES:
                    relaunch()
                    state["restarts"] += 1
                    state["misses"] = 0
                    time.sleep(BEAT)  # give her a moment to bind the port
            try:
                STATE.write_text(json.dumps(state, indent=1), encoding="utf-8")
            except Exception:
                pass
    finally:
        try:
            if LOCK.exists() and LOCK.read_text(encoding="utf-8").strip() == str(os.getpid()):
                LOCK.unlink()
        except Exception:
            pass


if __name__ == "__main__":
    main()
