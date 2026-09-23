"""Emberweave Brain - agent dispatcher (capability 2: orchestration, made real).

She dispatches whitelisted LOCAL worker agents that do work for her:
  dig   - deep-read the documents behind a topic and write a digest
  probe - run the retrieval regression battery and score it
  stats - index/learning health report

Workers are separate processes (like index.py), read-only on the archive,
and write results to agent_out/. The server watches that folder and reports
completions in the activity feed; briefs accumulate in agent_briefs.md which
is injected into her answers. The model never runs a shell - it picks a
worker type and supplies the topic; the whitelist is the guardrail.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

BASE = Path(__file__).parent
OUT_DIR = BASE / "agent_out"
OUT_DIR.mkdir(exist_ok=True)
BRIEFS = BASE / "agent_briefs.md"
JOBS = BASE / "agent_jobs.jsonl"

WORKERS = {
    "dig":   BASE / "agents" / "dig.py",
    "probe": BASE / "agents" / "probe.py",
    "stats": BASE / "agents" / "stats.py",
}

HELP = """My worker agents (I dispatch, they work, I report):
  agent: dig <topic>     - deep-read every doc behind a topic, write me a digest
  agent: probe           - run my retrieval regression battery, score the results
  agent: stats           - index + learning health report
  agent: status          - what my agents are doing right now
Workers are read-only on the archive and write to agent_out/ in my folder."""


def _load_jobs():
    if not JOBS.exists():
        return []
    out = []
    for line in JOBS.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                out.append(json.loads(line))
            except Exception:
                continue
    return out


def _save_jobs(jobs):
    JOBS.write_text("\n".join(json.dumps(j, ensure_ascii=False) for j in jobs) + "\n",
                    encoding="utf-8")


def dispatch(spec):
    """spec = what Phil (or she herself) typed after 'agent:'. Returns an answer dict."""
    spec = spec.strip()
    low = spec.lower()
    if not low or low == "status":
        return {"answer": _status_text(), "sources": [], "images": [], "model": None}
    if low in ("help", "?"):
        return {"answer": HELP, "sources": [], "images": [], "model": None}
    parts = spec.split(None, 1)
    kind = parts[0].lower()
    task = parts[1].strip() if len(parts) > 1 else ""
    if kind not in WORKERS:
        return {"answer": f"I don't have a '{kind}' agent. My workers: dig, probe, stats.",
                "sources": [], "images": [], "model": None}
    if kind == "dig" and not task:
        return {"answer": "dig needs a topic, e.g.  agent: dig witches hut brew economy",
                "sources": [], "images": [], "model": None}

    job = {"jobid": time.strftime("%H%M%S"), "agent": kind, "task": task or kind,
           "status": "running", "started": time.strftime("%Y-%m-%d %H:%M:%S")}
    jobs = _load_jobs()
    jobs.append(job)
    _save_jobs(jobs)

    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
    cmd = [sys.executable, str(WORKERS[kind]), job["jobid"], task]
    subprocess.Popen(cmd, cwd=str(BASE), creationflags=flags)

    label = {"dig": f"a dig on '{task}'", "probe": "a probe run of my retrieval",
             "stats": "a health report"}[kind]
    return {"answer": (f"Dispatched {label} (job {job['jobid']}). "
                       f"It works in the background; I'll report in the feed when it's done, "
                       f"and you can ask me what it found."),
            "sources": [], "images": [], "model": None, "jobid": job["jobid"], "agent": kind,
            "task": task or kind}


def _status_text():
    jobs = _load_jobs()
    if not jobs:
        return "No agent jobs yet. Try: agent: dig witches hut brew"
    lines = []
    for j in jobs[-6:]:
        lines.append(f"- [{j['status']}] {j['agent']} '{j['task']}' (job {j['jobid']}, {j['started']})")
    return "My recent agent work:\n" + "\n".join(lines)


def collect():
    """Called by the server watcher each cycle: harvest finished jobs, fire feed
    events, append briefs. Returns list of completed job dicts."""
    jobs = _load_jobs()
    done = []
    changed = False
    for j in jobs:
        if j["status"] != "running":
            continue
        res_file = OUT_DIR / f"{j['jobid']}.json"
        if not res_file.exists():
            continue
        try:
            res = json.loads(res_file.read_text(encoding="utf-8"))
        except Exception:
            continue
        j["status"] = res.get("status", "done")
        j["finished"] = time.strftime("%Y-%m-%d %H:%M:%S")
        changed = True
        done.append((j, res))
    if changed:
        _save_jobs(jobs)
    if done:
        with BRIEFS.open("a", encoding="utf-8") as fh:
            for j, res in done:
                fh.write(f"\n## {j['finished']} - {j['agent']} agent (job {j['jobid']}): {j['task']}\n")
                fh.write(res.get("summary", "").strip() + "\n")
                for f in res.get("files", []):
                    fh.write(f"  full result: {f}\n")
    return done
