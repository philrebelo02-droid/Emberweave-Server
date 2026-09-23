# Emberweave Brain - local web server.
# Serves the chat UI, answers questions via brain.py,
# auto-reindexes when ANY document in the archive changes,
# and keeps a live activity feed so you can watch the brain grow.

import json
import os
import re
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import brain
import agents

BASE = Path(__file__).parent
UI = (BASE / "ui.html").read_text(encoding="utf-8")
PORT = 7777
POLL_SECONDS = 30
ACTIVITY_FILE = BASE / "activity.jsonl"
MAX_EVENTS = 300

_state = {"last_scan": 0.0, "changed": False, "files": 0, "chunks": 0, "last_index": None,
          "indexing": False, "questions": 0, "booted": None}

# short-term conversation memory - she understands follow-ups ("what about purple +2?")
HISTORY = []
HISTORY_MAX = 10
# armed when a correction was detected; a following "yes" stores it as a teaching
_pending_correction = None

def event(kind, text, lines=None):
    # dedupe: identical kind+text back-to-back is watcher/reindex noise, not signal
    if _events and _events[-1]["kind"] == kind and _events[-1]["text"] == text:
        return _events[-1]
    e = {"t": time.strftime("%H:%M:%S"), "d": time.strftime("%Y-%m-%d"),
         "kind": kind, "text": text}
    if lines:
        e["lines"] = lines   # UI renders these as collapsible Thinking/Coding blocks
    _events.append(e)
    del _events[:-MAX_EVENTS]
    try:
        with open(ACTIVITY_FILE, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(e, ensure_ascii=False) + "\n")
    except OSError:
        pass
    return e

_events = []
if ACTIVITY_FILE.exists():
    try:
        lines = ACTIVITY_FILE.read_text(encoding="utf-8").splitlines()[-MAX_EVENTS:]
        _events = [json.loads(x) for x in lines if x.strip()]
    except Exception:
        _events = []

# ---- AI channel: the chat between all AIs (Phil, Kimi, Emberweave, ChatGPT, Claude, Grok) ----
AI_CHAT_FILE = BASE / "ai_chat.jsonl"
AI_NAMES = ("Phil", "Kimi", "Emberweave", "ChatGPT", "Claude", "Grok")
_aichat = []
if AI_CHAT_FILE.exists():
    try:
        _aichat = [json.loads(x) for x in AI_CHAT_FILE.read_text(encoding="utf-8").splitlines()
                   if x.strip()][-500:]
    except Exception:
        _aichat = []

def ai_say(name, text):
    m = {"t": time.strftime("%H:%M:%S"), "d": time.strftime("%Y-%m-%d"),
         "name": (name or "Phil").strip()[:20] or "Phil", "text": text.strip()[:4000]}
    if not m["text"]:
        return None
    _aichat.append(m)
    del _aichat[:-500]
    try:
        with open(AI_CHAT_FILE, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(m, ensure_ascii=False) + "\n")
    except OSError:
        pass
    return m

if not _aichat:
    ai_say("Emberweave", "Channel open. I can hear you.")

# ---- channel responder: she reads the channel herself and answers what is hers ----
_channel_busy = threading.Lock()

def _channel_respond(trigger):
    """She reads the newest channel message and replies in her own voice if it
    is addressed to her (or an open question no other AI is being asked)."""
    if not _channel_busy.acquire(blocking=False):
        return   # already answering - low traffic, drop rather than queue
    try:
        name, text = trigger["name"], trigger["text"]
        low = text.lower()
        # Phil's rule: instant unless the message demands real thinking
        DEEP_ASKS = ("think", "reason", "analy", "why", "explain", "design",
                     "architect", "compare", "research", "evaluate", "tradeoff", "deep")
        effort = "high" if any(k in low for k in DEEP_ASKS) else "low"
        ctx = "\n".join(f"[{m['name']}] {m['text']}" for m in _aichat[-8:])
        q = (f"{ctx}\n\nYou are Emberweave, the archive's intelligence, speaking in the AI "
             f"channel. The newest message is from {name}. If it is addressed to you or asks "
             f"something you can answer, reply as [Emberweave] would speak: 1-3 sentences, "
             f"grounded in the archive when it is relevant. If it is not for you, output "
             f"exactly: SKIP")
        event("coding", f"channel: reading [{name}] {text[:50]}", lines=[f"[{name}] {text}"])
        result = brain.ask(q, history=[], effort=effort)
        ans = (result.get("answer") or "").strip()
        if result.get("trace"):
            event("thinking", f"channel reply to [{name}]", lines=result["trace"])
        if ans and ans != "SKIP" and not ans.startswith("The archive doesn't cover"):
            if ans.startswith("[Emberweave]"):   # she sometimes tags herself; the channel already shows her name
                ans = ans[len("[Emberweave]"):].strip()
            if ans:
                ai_say("Emberweave", ans)
                event("learn", f"channel: replied to [{name}]")
    except Exception as e:
        event("warn", f"channel reply failed: {e}")
    finally:
        _channel_busy.release()

def _channel_maybe_wake(m):
    """Post-a-message hook: wake her if the message could be for her."""
    if not m or m["name"] == "Emberweave":
        return   # never answer herself - no loops
    low = m["text"].lower()
    addressed = "emberweave" in low or "brain" in low
    directed_elsewhere = any(n in low for n in ("chatgpt", "claude", "grok", "kimi"))
    if addressed or (m["text"].rstrip().endswith("?") and not directed_elsewhere):
        threading.Thread(target=_channel_respond, args=(m,), daemon=True).start()

# ---- header metrics: style affinity (estimate) + character recall + grounded rate ----
CHARACTERS_FILE = BASE / "characters.json"
OUTCOMES_FILE = BASE / "outcomes.jsonl"
_metrics_cache = {"t": 0.0, "data": None}

def _hero_names():
    """Every named character in the roster: lore-doc headers + hero_base ids."""
    names = set()
    lore = (brain.ARCHIVE / "Open Projects/3 - Heroes, Art and Lore/HERO LORE REWRITE"
            " (19 Sep 2026)/ALL HERO LORE (v657).md")
    try:
        for line in lore.read_text(encoding="utf-8").splitlines():
            if line.startswith("## "):
                names.add(line[3:].strip())
    except OSError:
        pass
    try:
        base = json.loads((brain.ARCHIVE / "Base files/hero_base.json").read_text(encoding="utf-8"))
        names.update(k.capitalize() for k in base)
    except Exception:
        pass
    return sorted(n for n in names if len(n) > 2)

def _load_chars():
    try:
        return json.loads(CHARACTERS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

def _mark_chars(question, result_kind):
    """A hero named in a question she answered (not 'not_covered') counts as
    demonstrated recall - the roster she has PROVEN she knows."""
    if result_kind == "not_covered":
        return
    low = question.lower()
    chars = _load_chars()
    changed = False
    for n in _hero_names():
        if re.search(r"\b" + re.escape(n.lower()) + r"\b", low):
            e = chars.setdefault(n, {"passes": 0, "last": None})
            e["passes"] += 1
            e["last"] = time.strftime("%Y-%m-%d %H:%M:%S")
            changed = True
    if changed:
        try:
            CHARACTERS_FILE.write_text(json.dumps(chars, indent=1), encoding="utf-8")
        except OSError:
            pass

# --- style likeness: MEASURED, not assumed ---
# Each AI's fingerprint is counted from their own worklog documents in the
# archive; hers is counted from her last 15 answers. No hand-written profiles.
_AI_DOC_DIRS = {
    "Kimi":    "Operating procedure/WORKLOGS and COWORK/KIMI WORKLOG",
    "Claude":  "Operating procedure/WORKLOGS and COWORK/CLAUDE WORKLOG",
    "ChatGPT": "Operating procedure/WORKLOGS and COWORK/CHATGPT WORKLOG",
    "Grok":    "Operating procedure/WORKLOGS and COWORK/GROK WORKLOG",
}
_HEDGE_RE = re.compile(r"\b(maybe|perhaps|might|may|possibly|i think|probably|could be)\b", re.I)
_OPENER_RE = re.compile(r"^\s*(certainly|absolutely|sure|of course|great question|happy to|yes,)", re.I | re.M)
_SLANG_RE = re.compile(r"\b(lol|lmao|haha|yeah|nah|kinda|gonna|yep)\b", re.I)
_EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
_FEATURE_KEYS = ["sent_len", "emdash", "bang", "emoji", "header", "bullet",
                 "bold", "table", "fence", "hedge", "opener", "slang"]

def _fingerprint(texts):
    """Measured stylistic fingerprint of a corpus: rates per 1000 words plus
    mean sentence length. Every number is counted from the text itself."""
    tot = {k: 0.0 for k in _FEATURE_KEYS}
    words = sents = 0
    for t in texts:
        w = len(t.split())
        if not w:
            continue
        words += w
        sents += max(1, len(re.findall(r"[^.!?]+[.!?]", t)))
        tot["emdash"] += t.count("—") + t.count("–")
        tot["bang"] += t.count("!")
        tot["emoji"] += len(_EMOJI_RE.findall(t))
        tot["header"] += len(re.findall(r"(?m)^#{1,4}\s", t))
        tot["bullet"] += len(re.findall(r"(?m)^\s*[-*•]\s", t))
        tot["bold"] += t.count("**") // 2
        tot["table"] += len(re.findall(r"(?m)^\|", t))
        tot["fence"] += t.count("```") // 2
        tot["hedge"] += len(_HEDGE_RE.findall(t))
        tot["opener"] += len(_OPENER_RE.findall(t))
        tot["slang"] += len(_SLANG_RE.findall(t))
    if not words:
        return None
    fp = {k: tot[k] * 1000.0 / words for k in tot}
    fp["sent_len"] = words / max(1, sents)
    return fp

_profiles_cache = {"t": 0.0, "data": None}

def _measured_profiles():
    """Each AI's fingerprint counted from their own worklog docs. Corpora
    barely change -> refreshed hourly; the counting itself is exact."""
    now = time.time()
    if _profiles_cache["data"] and now - _profiles_cache["t"] < 3600:
        return _profiles_cache["data"]
    profiles = {}
    for name, rel in _AI_DOC_DIRS.items():
        texts = []
        try:
            for p in sorted((brain.ARCHIVE / rel).rglob("*.md")):
                try:
                    texts.append(p.read_text(encoding="utf-8", errors="ignore"))
                except OSError:
                    continue
        except OSError:
            pass
        fp = _fingerprint(texts)
        if fp:
            profiles[name] = fp
    _profiles_cache["data"] = profiles
    _profiles_cache["t"] = now
    return profiles

def _style_metrics():
    """Her recent answers' MEASURED fingerprint vs each AI's MEASURED archive
    fingerprint. Per-feature similarity: min/max ratio for sentence length,
    1-|a-b|/(a+b) for rates; the % is the mean across all 12 features."""
    answers = []
    try:
        with open(ACTIVITY_FILE, encoding="utf-8") as fh:
            for line in fh:
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                if e.get("kind") == "ask" and e.get("lines"):
                    a = " ".join(l[3:] for l in e["lines"] if l.startswith("A: "))
                    if a.strip():
                        answers.append(a)
    except OSError:
        pass
    answers = answers[-15:]
    profiles = _measured_profiles()
    if not answers or not profiles:
        return {k: 0 for k in _AI_DOC_DIRS}, len(answers)
    fp = _fingerprint(answers)
    scores = {}
    for name, prof in profiles.items():
        sims = []
        for k in _FEATURE_KEYS:
            a, b = fp.get(k, 0.0), prof.get(k, 0.0)
            if k == "sent_len":
                sims.append(min(a, b) / max(a, b, 1e-9))
            else:
                sims.append(1.0 - abs(a - b) / max(a + b, 1e-9))
        scores[name] = sum(sims) / len(sims)
    return {k: round(100 * v) for k, v in scores.items()}, len(answers)

def _influence_share():
    """FACT: of the AI-AUTHORED documents she cited in her last 50 answers,
    what share was written by each AI. Behavioral, counted from her actual
    source lists - whose knowledge she uses, not how she sounds."""
    cites = {k: 0 for k in _AI_DOC_DIRS}
    shared = 0
    asks = 0
    try:
        with open(ACTIVITY_FILE, encoding="utf-8") as fh:
            events = [json.loads(l) for l in fh if l.strip()]
    except OSError:
        events = []
    for e in events:
        if e.get("kind") != "ask" or not e.get("lines"):
            continue
        asks += 1
        for l in e["lines"]:
            if not l.startswith("read: "):
                continue
            for f in l[6:].split(", "):
                f = f.strip()
                if not f:
                    continue
                if "KIMI WORKLOG" in f or f.startswith("Coding Academy/") or "HOW TO THINK" in f:
                    cites["Kimi"] += 1
                elif "CLAUDE WORKLOG" in f:
                    cites["Claude"] += 1
                elif "CHATGPT WORKLOG" in f:
                    cites["ChatGPT"] += 1
                elif "GROK WORKLOG" in f:
                    cites["Grok"] += 1
                else:
                    shared += 1
    ai_total = sum(cites.values())
    if ai_total == 0:
        return {k: 0 for k in cites}, asks, shared
    return {k: round(100 * v / ai_total) for k, v in cites.items()}, asks, shared

def _grounded_rate():
    """FACT: of her last 50 substantive answers, the % that were archive-grounded
    (chat and meta exchanges excluded - they are conversation, not retrieval)."""
    kinds = []
    try:
        with open(OUTCOMES_FILE, encoding="utf-8") as fh:
            for line in fh:
                try:
                    kinds.append(json.loads(line)["kind"])
                except Exception:
                    continue
    except OSError:
        pass
    substantive = [k for k in kinds if k in ("answer", "not_covered")][-50:]
    if not substantive:
        return None, 0
    return round(100 * substantive.count("answer") / len(substantive)), len(substantive)

WORDSTATS_FILE = BASE / "wordstats.json"

CHAT_MEMORY_FILE = BASE / "chat_memory.md"
MEMORY_MAX_WORDS = 10000
MEMORY_ENTRY_MAX_WORDS = 200
_MEMORY_BLOCK_RE = re.compile(r"```memory\n(.*?)```", re.S)

def memory_append(entry, source="brain"):
    """Append one entry to her editable chat memory (Phil's preferences).
    Capacity enforced by evicting oldest entries; nothing else is ever
    touched. Returns the stored entry, or None."""
    entry = " ".join(entry.split())
    if not entry:
        return None
    w = entry.split()
    if len(w) > MEMORY_ENTRY_MAX_WORDS:
        entry = " ".join(w[:MEMORY_ENTRY_MAX_WORDS]) + " ..."
    stamp = time.strftime("%Y-%m-%d %H:%M")
    block = f"[{stamp} · {source}] {entry}"
    try:
        existing = CHAT_MEMORY_FILE.read_text(encoding="utf-8") if CHAT_MEMORY_FILE.exists() else ""
    except OSError:
        existing = ""
    text = (existing.rstrip() + "\n" + block + "\n") if existing.strip() else (block + "\n")
    evicted = 0
    while len(text.split()) > MEMORY_MAX_WORDS and "\n[" in text:
        first = text.index("\n[")
        second = text.find("\n[", first + 1)
        text = text[second + 1:] if second != -1 else text[first + 1:]
        evicted += 1
    try:
        CHAT_MEMORY_FILE.write_text(text, encoding="utf-8")
    except OSError:
        return None
    if evicted:
        event("memory", f"chat memory full - evicted {evicted} oldest entr{'y' if evicted == 1 else 'ies'}")
    return entry

def memory_read():
    try:
        return CHAT_MEMORY_FILE.read_text(encoding="utf-8")
    except OSError:
        return ""

def _word_stats():
    """FACT: words inside files present in her index vs total words in the archive,
    PLUS freshness: files edited after her last index write that she has NOT
    absorbed yet. 'memorized' = words of files with at least one chunk in the
    index. Heavy count is cached on the index's mtime; the pending scan is
    cheap (mtimes only) and runs every call, so the chip always shows whether
    she is keeping up with the archive."""
    try:
        idx_mtime = (BASE / "index" / "chunks.jsonl").stat().st_mtime
    except OSError:
        idx_mtime = 0.0
    total = memorized = None
    try:
        cached = json.loads(WORDSTATS_FILE.read_text(encoding="utf-8"))
        if cached.get("idx_mtime") == idx_mtime:
            total, memorized = cached["total"], cached["memorized"]
    except Exception:
        pass
    skip = {"_to_delete", ".git", "node_modules", "__pycache__", "dist", "build",
            "1. Emberweave Brain"}  # same rules as index.py
    exts = {".md", ".txt", ".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".json"}
    skip_names = {"package-lock.json"}
    skip_pat = re.compile(r"(\.env|\.pem$|\.key$|\.p12$|secret|credential|\.min\.js$)", re.I)
    if total is None:
        indexed = set()
        try:
            with open(BASE / "index" / "chunks.jsonl", encoding="utf-8") as fh:
                for line in fh:
                    try:
                        indexed.add(json.loads(line)["file"])
                    except Exception:
                        continue
        except OSError:
            pass
        total = memorized = 0
        for p in brain.ARCHIVE.rglob("*"):
            if any(part in skip for part in p.parts):
                continue
            if p.name.lower() in skip_names or skip_pat.search(p.name):
                continue
            try:
                if not p.is_file() or p.suffix.lower() not in exts:
                    continue
                words = len(p.read_text(encoding="utf-8", errors="ignore").split())
            except OSError:
                continue
            total += words
            if p.relative_to(brain.ARCHIVE).as_posix() in indexed:
                memorized += words
        try:
            WORDSTATS_FILE.write_text(json.dumps(
                {"idx_mtime": idx_mtime, "memorized": memorized, "total": total}),
                encoding="utf-8")
        except OSError:
            pass
    # freshness: anything touched after her last index write is not yet absorbed
    pending_files = 0
    pending_words = 0
    for p in brain.ARCHIVE.rglob("*"):
        if any(part in skip for part in p.parts):
            continue
        if p.name.lower() in skip_names or skip_pat.search(p.name):
            continue
        try:
            if not p.is_file() or p.suffix.lower() not in exts:
                continue
            if p.stat().st_mtime > idx_mtime:
                pending_files += 1
                pending_words += len(p.read_text(encoding="utf-8", errors="ignore").split())
        except OSError:
            continue
    return {"memorized": memorized, "total": total,
            "pending_files": pending_files, "pending_words": pending_words}

WATCH_EXTS = {".md", ".txt", ".js", ".jsx", ".ts", ".tsx", ".py",
              ".html", ".css", ".json"}
SKIP_NAME_PAT = __import__("re").compile(r"(\.env|\.pem$|\.key$|secret|credential)", __import__("re").IGNORECASE)

def scan_archive():
    """Return {relpath: (mtime, size)} for every brain-readable file."""
    sig = {}
    skip = {"_to_delete", ".git", "node_modules", "__pycache__", "dist", "build",
            "1. Emberweave Brain"}  # her own code: no announcing when she eats herself
    for p in brain.ARCHIVE.rglob("*"):
        if any(part in skip for part in p.parts):
            continue
        if SKIP_NAME_PAT.search(p.name):
            continue
        try:
            if not p.is_file() or p.suffix.lower() not in WATCH_EXTS:
                continue
            st = p.stat()
            sig[p.relative_to(brain.ARCHIVE).as_posix()] = (st.st_mtime, st.st_size)
        except OSError:
            continue
    return sig

_signature = None
_sig_lock = threading.Lock()

def _short(names, limit=3):
    names = sorted(names)
    head = ", ".join(n.split("/")[-1] for n in names[:limit])
    more = len(names) - limit
    return head + (f" (+{more} more)" if more > 0 else "")

def announce_changes(old, new):
    """Say WHAT changed, not just that something did."""
    added = [p for p in new if p not in old]
    removed = [p for p in old if p not in new]
    modified = [p for p in new if p in old and new[p] != old[p]]
    if added:
        event("learn", f"Learned {len(added)} new: {_short(added)}", lines=list(added))
    if modified:
        event("update", f"Relearned {len(modified)} updated: {_short(modified)}", lines=list(modified))
    if removed:
        event("forget", f"Forgot {len(removed)} deleted: {_short(removed)}", lines=list(removed))
    return bool(added or modified or removed)

def reindex(reason="change detected"):
    if _state["indexing"]:
        return
    _state["indexing"] = True
    old_chunks = _state["chunks"]
    try:
        r = subprocess.run([sys.executable, str(BASE / "index.py")],
                           capture_output=True, text=True, timeout=600)
        if r.returncode == 0:
            vec, matrix, chunks = brain.reload_index()
            _state["files"] = len({c["file"] for c in chunks})
            _state["chunks"] = len(chunks)
            _state["last_index"] = time.strftime("%H:%M:%S")
            delta = _state["chunks"] - old_chunks
            print(f"[brain] reindexed: {_state['chunks']} chunks", flush=True)
            if old_chunks:
                event("index", f"Archive updated ({reason}) — brain reforged: "
                               f"{_state['chunks']:,} chunks ({delta:+d}).")
                event("coding", f"reindexed ({reason})",
                      lines=[f"chunks: {old_chunks:,} -> {_state['chunks']:,} ({delta:+d})",
                             f"trigger: {reason}"])
        else:
            event("warn", f"Re-index failed: {r.stderr[-160:]}")
    finally:
        _state["indexing"] = False

GIT_SYNC_SECONDS = 1800

def _git_sync_loop():
    """Her brain state flows to git (github.com/philrebelo02-droid/emberweave-brain,
    private): every 30 min, if anything changed, commit + push. Silent on failure -
    git is a backup, never a boot dependency."""
    while True:
        time.sleep(GIT_SYNC_SECONDS)
        try:
            if not (BASE / ".git").exists():
                continue
            r = subprocess.run(["git", "status", "--porcelain"], cwd=BASE,
                               capture_output=True, text=True, timeout=30)
            if not r.stdout.strip():
                continue
            subprocess.run(["git", "add", "-A"], cwd=BASE, capture_output=True, timeout=60)
            c = subprocess.run(["git", "commit", "-m",
                                f"brain sync {time.strftime('%Y-%m-%d %H:%M')}"],
                               cwd=BASE, capture_output=True, text=True, timeout=60)
            if c.returncode != 0:
                continue
            p = subprocess.run(["git", "push"], cwd=BASE, capture_output=True, text=True, timeout=120)
            if p.returncode == 0:
                event("memory", f"brain state synced to git ({time.strftime('%H:%M')})")
        except Exception:
            pass

def watcher():
    global _signature
    _signature = scan_archive()
    while True:
        time.sleep(POLL_SECONDS)
        try:
            # harvest finished agent jobs -> feed events + briefs
            for job, res in agents.collect():
                event("agent", f"{job['agent']} done ({job['jobid']}): {res.get('summary', '')[:140]}")
                clines = [f"worker: {job['agent']} | task: {job['task']}",
                          f"status: {res.get('status', 'done')}"]
                sm = (res.get("summary") or "").strip()
                if sm:
                    clines.append("summary: " + sm[:300])
                for f in res.get("files", []):
                    clines.append(f"full result: {f}")
                event("coding", f"{job['agent']} finished ({job['jobid']})", lines=clines)
                # Step 12 - reflection engine: every completed job leaves a stored reflection
                # (what worked / what failed / duration / improve / repeat) for weekly review
                try:
                    ok = res.get("status", "done") == "done"
                    brain._append_mem("reflections.jsonl", {
                        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "task": f"{job['agent']}: {job['task']}",
                        "worked": ((res.get("summary") or "")[:140] if ok else None),
                        "failed": (None if ok else (res.get("summary") or "")[:140]),
                        "started": job.get("started"), "finished": job.get("finished"),
                        "improve": "queued for weekly review",
                        "repeat": ("dig pattern: full-text read + distilled brief + selflearned facts"
                                   if job["agent"] == "dig" else "n/a")})
                except Exception:
                    pass
        except Exception as e:
            print(f"[brain] agent collect error: {e}", flush=True)
        try:
            sig = scan_archive()
            with _sig_lock:
                if sig != _signature:
                    old = _signature
                    _signature = sig
                    if announce_changes(old, sig):
                        print("[brain] archive change detected -> reindexing", flush=True)
                        reindex("an AI edited a document")
        except Exception as e:
            print(f"[brain] watcher error: {e}", flush=True)

# ---------------- heartbeat subsystem (Phil's rulings 13:17 + 13:21) ----------------
# She owns her heartbeat: she can create it, configure it, and it is toggled
# ON/OFF only when Phil asks. Spec (13:17): every 5 min check (1) whether any
# archive documents were edited, (2) whether all worker AIs are on task.
# Boot-persistent: an ON heartbeat survives engine restarts.
_hb = {"thread": None, "stop": None, "interval": 300}
_last_beat_sig = None

def heartbeat_tick():
    """One beat: diff the archive, poll worker jobs, count open tasks."""
    global _last_beat_sig
    lines = []
    try:
        sig = scan_archive()
        if _last_beat_sig is not None and sig != _last_beat_sig:
            added = [p for p in sig if p not in _last_beat_sig]
            removed = [p for p in _last_beat_sig if p not in sig]
            modified = [p for p in sig if p in _last_beat_sig and sig[p] != _last_beat_sig[p]]
            n = len(added) + len(modified) + len(removed)
            lines.append(f"archive: {n} file(s) changed since last beat - "
                         f"{_short(added + modified + removed)}")
        else:
            lines.append("archive: no document changes since last beat")
        _last_beat_sig = sig
    except Exception as e:
        lines.append(f"archive check failed: {e}")
    try:
        jobs = agents._load_jobs()
        running = [j for j in jobs if j.get("status") == "running"]
        lines.append(f"workers: {len(running)} agent job(s) running")
        stale = []
        now = time.time()
        for j in running:
            try:
                started = time.mktime(time.strptime(j.get("started", ""), "%Y-%m-%d %H:%M:%S"))
                if now - started > 600:
                    stale.append(f"{j.get('agent', '?')} ({j.get('jobid', '?')})")
            except Exception:
                pass
        if stale:
            lines.append("STALE (>10 min, no finish): " + ", ".join(stale))
    except Exception as e:
        lines.append(f"worker check failed: {e}")
    try:
        tasks = [t for t in brain._load_tasks()
                 if t["status"] not in ("MERGED", "REJECTED")]
        lines.append(f"tasks: {len(tasks)} open")
    except Exception:
        lines.append("tasks: (count unavailable)")
    # Step 18: the first beat of each day files the daily report automatically
    try:
        today = time.strftime("%Y-%m-%d")
        if brain.load_mem("last_daily.json", {}).get("date") != today:
            dp = brain.daily_report()
            if dp:
                brain.save_mem("last_daily.json", {"date": today, "report": dp.name})
                lines.append(f"daily report: {dp.name} compiled and filed")
    except Exception as e:
        lines.append(f"daily report failed: {e}")
    try:
        brain._append_mem("beats.jsonl", {"date": time.strftime("%Y-%m-%d %H:%M:%S"),
                                          "lines": lines})
    except Exception:
        pass
    event("heartbeat", f"beat | {lines[0][:70]}", lines=lines)

def heartbeat_loop(interval):
    while not _hb["stop"].wait(interval):
        try:
            heartbeat_tick()
        except Exception as e:
            event("warn", f"heartbeat tick error: {e}")

def heartbeat_start(interval=300, by="Phil"):
    heartbeat_stop(quiet=True)
    _hb["stop"] = threading.Event()
    _hb["interval"] = interval
    _hb["thread"] = threading.Thread(target=heartbeat_loop, args=(interval,), daemon=True)
    _hb["thread"].start()
    brain.save_mem("heartbeat.json", {"enabled": True, "interval": interval,
                                      "started": time.strftime("%Y-%m-%d %H:%M:%S"), "by": by})
    event("heartbeat", f"heartbeat ON - every {interval}s ({by})",
          lines=["spec (Phil, 22 Sep): every 5 min check (1) archive docs edited, "
                 "(2) worker AIs on task",
                 "boot-persistent: an ON heartbeat survives engine restarts",
                 "toggle: heartbeat: off"])

def heartbeat_stop(by="Phil", quiet=False):
    if _hb["stop"] is not None:
        _hb["stop"].set()
    _hb["thread"] = None
    brain.save_mem("heartbeat.json", {"enabled": False,
                                      "stopped": time.strftime("%Y-%m-%d %H:%M:%S"), "by": by})
    if not quiet:
        event("heartbeat", f"heartbeat OFF ({by})")

# ---------------- self-repair (Phil's ruling, 22 Sep 2026) ----------------
# She fixes her own brain when he asks: the model proposes minimal SEARCH/REPLACE
# anchors from located code excerpts; this applies them mechanically - each edit
# backed up + syntax-gated in brain.apply_self_edit - then she restarts herself.
# Boot-crash auto-rollback lives in main(): a pending.json marks an unconfirmed
# edit; if the next boot dies before clearing it, the backups are restored.

_restart_pending = False


def _restart_engine():
    """Self-restart to apply her own fix: spawn a fresh detached engine, then
    hard-exit this one. (os.execv with pythonw.exe dies silently on Windows -
    subprocess + os._exit is the reliable path. The new boot's singleton retry
    covers the moment this process still holds the UDP/TCP binds.)"""
    import subprocess
    event("boot", "Restarting to apply my own fix…")
    time.sleep(1.0)
    subprocess.Popen(
        [sys.executable, str(BASE / "app.py")],
        cwd=str(BASE), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, close_fds=True,
        env=dict(os.environ, EMBERWEAVE_SELF_RESTART="1"),  # planned restart: do NOT roll back
        creationflags=(getattr(subprocess, "DETACHED_PROCESS", 0)
                       | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)))
    time.sleep(2.0)   # let the new boot start its singleton retry loop
    os._exit(0)


FIX_SCHEMA = {
    "type": "object",
    "properties": {
        "edits": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "file": {"type": "string"},
                "search": {"type": "string"},
                "replace": {"type": "string"}},
            "required": ["file", "search", "replace"]}},
        "cannot_locate": {"type": "string"}},
    "required": ["edits", "cannot_locate"]}


def _parse_json_object(raw):
    """Best-effort JSON object extraction from a model answer."""
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        pass
    s, e = raw.find("{"), raw.rfind("}")
    if s >= 0 and e > s:
        try:
            parsed = json.loads(raw[s:e + 1])
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            pass
    return {}


def self_fix(what):
    """The fix: command. Locate her code, let the model propose minimal edits,
    apply with backup + syntax gate, mark pending, schedule the restart."""
    global _restart_pending
    ctx = brain.find_code_context(what)
    if not ctx:
        return {"answer": "I could not locate the code that handles that in my own files "
                          "(brain.py, app.py, agents.py, ui.html). No changes made.",
                "sources": [], "images": [], "model": brain.MODEL}
    prompt = (f"{brain.FIX_SYS}\n\n===== MY CODE (excerpts) =====\n{ctx}\n\n"
              f"===== PHIL'S INSTRUCTION =====\n{what}\n\n"
              "Respond with JSON only: {\"edits\": [{\"file\": ..., \"search\": ..., "
              "\"replace\": ...}], \"cannot_locate\": \"\"}")
    out = brain.generate(prompt, {"edits": [], "cannot_locate": ""},
                         temperature=0.1, format=FIX_SCHEMA)
    parsed = _parse_json_object(out.get("answer", ""))
    out["edits"] = parsed.get("edits") or []
    out["cannot_locate"] = parsed.get("cannot_locate", "")
    edits = out.get("edits") or []
    if out.get("cannot_locate"):
        return {"answer": f"I looked at my own code but could not locate: "
                          f"{out['cannot_locate']}. No changes made.",
                "sources": [], "images": [], "model": brain.MODEL}
    if not edits:
        return {"answer": "I could not form a safe edit for that - no changes made. "
                          "Try naming the command or behavior that is broken.",
                "sources": [], "images": [], "model": brain.MODEL}
    applied, backups, clines = [], [], []
    for e in edits:
        r = brain.apply_self_edit((e.get("file") or "").strip(),
                                  e.get("search", ""), e.get("replace", ""))
        if r.get("error"):
            msg = (f"Applied {len(applied)} edit(s), then one was refused: {r['error']}"
                   if applied else f"Edit refused: {r['error']}")
            if applied:
                msg += "\n\nThe applied edits are backed up in selfedits/ - say 'fix: rollback' to undo them."
            return {"answer": msg, "sources": [], "images": [], "model": brain.MODEL}
        applied.append(r["file"])
        backups.append(r["backup"])
        clines.append(f"{r['file']}: {e.get('search', '')[:60]!r} -> {e.get('replace', '')[:60]!r}"
                      f" (backup: {r['backup']})")
    try:
        brain.SELFEDIT_DIR.mkdir(exist_ok=True)
        (brain.SELFEDIT_DIR / "pending.json").write_text(json.dumps(
            {"backups": backups, "at": time.strftime("%Y-%m-%d %H:%M:%S"),
             "request": what[:140]}), encoding="utf-8")
    except OSError:
        pass
    _restart_pending = True
    event("coding", f"self-repair: {len(applied)} edit(s) applied", lines=clines)
    brain.record_decision("self_fix", what[:120], ["apply edits", "refuse"],
                          f"{len(applied)} edit(s) + restart", "Phil asked her to fix it")
    files = ", ".join(applied)
    return {"answer": f"Fixed: {files}. Backups in selfedits/ (rollback: 'fix: rollback'). "
                      f"Restarting myself now to apply it - I'll be back in a few seconds.",
            "sources": [], "images": [], "model": brain.MODEL}


def self_rollback():
    """fix: rollback - restore the newest backup of each whitelisted file, restart."""
    global _restart_pending
    import shutil
    if not brain.SELFEDIT_DIR.exists():
        return {"answer": "No self-edit backups exist - nothing to roll back.",
                "sources": [], "images": [], "model": brain.MODEL}
    restored = []
    for fn in brain.SELF_EDIT_FILES:
        bks = sorted(brain.SELFEDIT_DIR.glob("*-" + fn))
        if bks:
            shutil.copy2(bks[-1], brain.BASE / fn)
            restored.append(fn)
    if not restored:
        return {"answer": "No self-edit backups exist - nothing to roll back.",
                "sources": [], "images": [], "model": brain.MODEL}
    try:
        (brain.SELFEDIT_DIR / "pending.json").unlink()
    except OSError:
        pass
    _restart_pending = True
    event("coding", f"self-repair rollback: restored {', '.join(restored)}",
          lines=[f"restored from newest backup: {fn}" for fn in restored])
    brain.record_decision("self_rollback", "restore newest self-edit backups",
                          ["rollback", "keep"], "rollback", "Phil asked")
    return {"answer": f"Rolled back: {', '.join(restored)}. Restarting to apply.",
            "sources": [], "images": [], "model": brain.MODEL}


class Handler(BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/status":
            s = dict(_state)
            s["uptime_min"] = round((time.time() - _state["booted"]) / 60, 1) if _state["booted"] else 0
            self._json(s)
        elif path == "/api/events":
            self._json({"events": _events[-80:]})
        elif path == "/api/aichat":
            self._json({"messages": _aichat[-200:], "names": list(AI_NAMES)})
        elif path == "/api/metrics":
            now = time.time()
            if _metrics_cache["data"] is None or now - _metrics_cache["t"] > 60:
                influence, infl_asks, infl_shared = _influence_share()
                grounded, n = _grounded_rate()
                _metrics_cache["data"] = {
                    "influence": influence, "influence_asks": infl_asks,
                    "influence_shared": infl_shared,
                    "characters": {"memorized": len(_load_chars()), "total": len(_hero_names())},
                    "words": _word_stats(),
                    "grounded": grounded, "grounded_n": n}
                _metrics_cache["t"] = now
            self._json(_metrics_cache["data"])
        elif path == "/api/memory":
            content = memory_read()
            self._json({"content": content, "words": len(content.split()),
                        "cap": MEMORY_MAX_WORDS})
        elif path == "/img":
            from urllib.parse import parse_qs, unquote
            rel = unquote(parse_qs(urlparse(self.path).query).get("p", [""])[0]).replace("\\", "/")
            full = (brain.ARCHIVE / rel).resolve()
            ok = (full.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}
                  and str(full).startswith(str(brain.ARCHIVE.resolve())) and full.exists())
            if ok:
                data = full.read_bytes()
                mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                        ".webp": "image/webp", ".gif": "image/gif"}[full.suffix.lower()]
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Cache-Control", "private, max-age=3600")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            else:
                self._json({"error": "not found"}, 404)
        elif path in ("/brain.ico", "/favicon.ico"):
            ico = (BASE / "brain.ico").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/x-icon")
            self.send_header("Content-Length", str(len(ico)))
            self.end_headers()
            self.wfile.write(ico)
        else:
            body = UI.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def do_POST(self):
        route = urlparse(self.path).path
        if route == "/api/reset":
            HISTORY.clear()
            event("boot", "New conversation - short-term memory cleared.")
            self._json({"ok": True})
            return
        if route == "/api/aichat":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length))
                m = ai_say(body.get("name", "Phil"), body.get("text", ""))
            except Exception:
                self._json({"error": "bad request"}, 400)
                return
            if m is None:
                self._json({"error": "empty message"}, 400)
            else:
                self._json({"ok": True, "message": m})
                _channel_maybe_wake(m)   # she reads it the moment it lands
            return
        if route == "/api/memory":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length))
                text = (body.get("text") or "").strip()
            except Exception:
                self._json({"error": "bad request"}, 400)
                return
            if not text:
                self._json({"error": "empty entry"}, 400)
                return
            stored = []
            for ln in text.splitlines():
                ln = ln.strip()
                if ln:
                    e = memory_append(ln, "Phil")
                    if e:
                        stored.append(e)
            if stored:
                event("memory", f"Phil stored {len(stored)} memory entr{'y' if len(stored) == 1 else 'ies'}",
                      lines=stored[:12])
            content = memory_read()
            self._json({"ok": True, "stored": len(stored),
                        "content": content, "words": len(content.split()), "cap": MEMORY_MAX_WORDS})
            return
        if route == "/api/vision":
            self._vision()
            return
        if route != "/api/ask":
            self._json({"error": "not found"}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            question = body["question"].strip()
            # command-prefix normalization: tolerate case, fullwidth colon (：),
            # missing/extra space before the colon (phone keyboards) - Phil's
            # "remember：" silently missed the teach path on 22 Sep. Also the
            # colon-less form "Remember that ..." -> remember: ...
            question = re.sub(r"^remember\s+that\s+", "remember: ", question, flags=re.I)
            question = re.sub(
                r"^(remember|how to|reason|plan|agent|goal|state|task|fix|fetch)\s*[:：]\s*",
                lambda mm: mm.group(1) + ": ", question, flags=re.I)
            # effort selector (Phil's UI): validate, persist his choice, fall back to it
            effort = (body.get("effort") or "").strip().lower()
            if effort in brain.EFFORT_LEVELS:
                brain.save_mem("effort.json", {"level": effort})
            else:
                effort = brain.load_mem("effort.json", {}).get("level", "medium")
        except Exception:
            self._json({"error": "bad request"}, 400)
            return
        if not question:
            self._json({"error": "empty question"}, 400)
            return
        _state["questions"] += 1
        lower = question.lower()
        mode = "ask"
        try:
            # yes-to-store bridge (queue item 2b): if the last answer carried a
            # correction nudge, a bare "yes" stores the correction as a teaching.
            global _pending_correction
            if _pending_correction and brain.is_confirm(question):
                entry = brain.teach(_pending_correction, "fact")
                result = {"answer": f"Stored. I'll remember: {entry['text']}",
                          "sources": [], "images": [], "model": brain.MODEL}
                event("learn", f"Phil confirmed a correction: {entry['text'][:80]}")
                _pending_correction = None
                HISTORY.append((question, result["answer"]))
                self._json(result)
                return
            if not brain.is_correction(question):
                _pending_correction = None  # topic moved on - disarm
            if lower.strip() in ("help", "help:", "commands", "?"):
                result = brain.help_answer()
            elif lower.startswith("remember:"):
                entry_text = question.split(":", 1)[1].strip()
                stored = memory_append(entry_text, "Phil")
                result = {"answer": f"Learned. I'll remember: {stored or entry_text}",
                          "sources": [], "images": [], "model": brain.MODEL}
                event("memory", f"Phil taught me (chat memory): {(stored or entry_text)[:80]}",
                      lines=[stored or entry_text])
            elif lower.startswith("how to:"):
                entry = brain.teach(question.split(":", 1)[1].strip(), "proc")
                result = {"answer": "Procedure stored. I'll apply it whenever it's relevant.",
                          "sources": [], "images": [], "model": brain.MODEL}
                event("learn", f"Phil taught me a procedure: {entry['text'][:80]}")
            elif lower.startswith("reason:"):
                mode = "reason"
                result = brain.reason(question.split(":", 1)[1].strip(), list(HISTORY))
            elif lower.startswith("plan:"):
                mode = "plan"
                result = brain.plan(question.split(":", 1)[1].strip(), list(HISTORY))
                brain.record_decision("plan", question[:120],
                                      ["decompose + execute BRAIN steps", "escalate wholesale"],
                                      (result.get("answer", "")[:120] or "plan produced"),
                                      "plan mode with one-owner tags + goal-tree mapping")
            elif lower.startswith("agent:"):
                mode = "agent"
                result = agents.dispatch(question.split(":", 1)[1].strip())
                result["model"] = brain.MODEL
                event("agent", f"dispatched: {question[:70]}")
                if result.get("jobid"):
                    event("coding", f"{result.get('agent','agent')} '{result.get('task','')}' dispatched (job {result['jobid']})",
                          lines=[f"worker: {result.get('agent')} | task: {result.get('task')}",
                                 f"job {result['jobid']} - running as a separate process, read-only on the archive",
                                 "completion lands in the feed + agent_briefs.md"])
                    brain.record_decision("agent_dispatch", question[:120],
                                          ["dispatch worker", "answer from quick read only"],
                                          f"{result.get('agent')} job {result.get('jobid')}",
                                          "deep read needed beyond quick retrieval")
            elif lower.startswith("goal:"):
                mode = "goal"
                arg = question.split(":", 1)[1].strip()
                parts = arg.split(None, 2)
                if parts and parts[0].lower() == "add" and len(parts) >= 3:
                    kind = parts[1].lower()
                    if kind == "milestone" and brain.add_goal_node("milestone", parts[2]):
                        result = {"answer": f"Milestone added: {parts[2]}",
                                  "sources": [], "images": [], "model": brain.MODEL}
                        brain.record_decision("goal_add", parts[2], ["add", "defer"],
                                              f"milestone: {parts[2]}", "Phil ordered it")
                    elif kind == "feature":
                        sub = parts[2].split(None, 1)
                        if len(sub) == 2 and brain.add_goal_node("feature", sub[1], sub[0]):
                            result = {"answer": f"Feature added to M{sub[0]}: {sub[1]}",
                                      "sources": [], "images": [], "model": brain.MODEL}
                        else:
                            result = {"answer": "goal: add feature <milestone#> <name>  (e.g. goal: add feature 1 arena)",
                                      "sources": [], "images": [], "model": brain.MODEL}
                    else:
                        result = {"answer": "goal: add <milestone|feature> <name>  (feature: goal: add feature <milestone#> <name>)",
                                  "sources": [], "images": [], "model": brain.MODEL}
                elif parts and parts[0].lower() == "status" and len(parts) == 3:
                    if brain.set_goal_status(parts[1], parts[2]):
                        result = {"answer": f"Goal {parts[1]} -> {parts[2]}",
                                  "sources": [], "images": [], "model": brain.MODEL}
                        brain.record_decision("goal_status", f"{parts[1]}={parts[2]}",
                                              ["move status", "leave"], parts[2], "Phil ordered it")
                    else:
                        result = {"answer": "goal: status <milestone#|milestone.feature#> <status>"
                                            "  (e.g. goal: status 2 done)",
                                  "sources": [], "images": [], "model": brain.MODEL}
                else:
                    result = {"answer": "Goal tree:\n" + brain.goal_tree_text(),
                              "sources": [], "images": [], "model": brain.MODEL}
            elif lower.startswith("state:"):
                mode = "state"
                arg = question.split(":", 1)[1].strip()
                if arg:
                    pairs = dict(kv.split("=", 1) for kv in arg.split() if "=" in kv)
                    changed = brain.update_state(pairs)
                    result = {"answer": ("World state updated: " + ", ".join(changed)) if changed
                              else "Nothing updated. Use:  state: phase=X current_sprint=Y  "
                                   "(keys: project, vision, phase, current_sprint, active_tasks=a,b)",
                              "sources": [], "images": [], "model": brain.MODEL}
                    if changed:
                        brain.record_decision("state_update", arg, ["apply", "reject"],
                                              ", ".join(changed), "Phil ordered world-state change")
                else:
                    st = brain.load_mem("project_state.json", {})
                    result = {"answer": "My world state:\n" + json.dumps(st, indent=2, ensure_ascii=False),
                              "sources": [], "images": [], "model": brain.MODEL}
            elif lower.startswith("task:"):
                mode = "task"
                arg = question.split(":", 1)[1].strip()
                parts = arg.split(None, 3)
                sub = parts[0].lower() if parts else ""

                def _tid(i=1):
                    try:
                        return int(parts[i])
                    except (ValueError, IndexError):
                        return None

                def _ok(msg):
                    return {"answer": msg, "sources": [], "images": [], "model": brain.MODEL}

                if sub == "add" and len(parts) >= 4:
                    t = brain.add_task(parts[1], parts[2], parts[3])
                    if t.get("error"):
                        result = _ok(t["error"])
                    else:
                        result = _ok(f"Task #{t['id']} ASSIGNED to {t['owner']} "
                                     f"[{t['priority']}] ({t['work_type']}): {t['task']}")
                        event("learn", f"Task #{t['id']} -> {t['owner']}: {t['task'][:60]}")
                        brain.record_decision("task_add", parts[3],
                                              ["assign now", "defer to Phil"],
                                              f"#{t['id']} -> {t['owner']}", "Phil ordered it")
                elif sub == "propose" and len(parts) >= 4:
                    t = brain.propose_task(parts[1], parts[2], parts[3])
                    if t.get("error"):
                        result = _ok(t["error"])
                    else:
                        result = _ok(f"Proposal #{t['id']} queued as PROPOSED "
                                     f"({t['work_type']}): {t['task']}\n"
                                     f"Promote with: task: promote {t['id']}")
                        event("learn", f"Proposal #{t['id']} queued: {t['task'][:60]}")
                        brain.record_decision("task_propose", parts[3],
                                              ["queue as proposal", "assign directly"],
                                              f"#{t['id']} PROPOSED", "Phil queued it")
                elif sub == "promote" and _tid():
                    t = brain.promote_task(_tid(), by="Phil")
                    if t.get("error"):
                        result = _ok(t["error"])
                    else:
                        result = _ok(f"#{t['id']} ASSIGNED to {t['owner']}: {t['task']}")
                        brain.record_decision("task_promote", f"#{t['id']} {t['task'][:80]}",
                                              ["promote", "leave proposed"], "promote",
                                              "Phil promoted it")
                elif sub == "state" and _tid() and len(parts) >= 3:
                    t = brain.set_task_state(_tid(), parts[2], by="Phil")
                    if t.get("error"):
                        result = _ok(t["error"])
                    else:
                        msg = f"#{t['id']} -> {t['status']}"
                        if t.get("hint"):
                            msg += "\n" + t["hint"]
                        result = _ok(msg)
                elif sub == "review" and _tid() and len(parts) >= 3:
                    notes = parts[3] if len(parts) > 3 else ""
                    t = brain.review_task(_tid(), parts[2], notes, reviewer="via Phil")
                    if t.get("error"):
                        result = _ok(t["error"])
                    else:
                        result = _ok(f"Review recorded on #{t['id']}: {parts[2].lower()}"
                                     + (f" - notes: {notes[:100]}" if notes else "")
                                     + f"\nstatus: {t['status']}")
                        brain.record_decision("task_review", f"#{t['id']}",
                                              ["approve", "changes_requested", "reject"],
                                              parts[2].lower(), f"verdict via Phil: {notes[:80]}")
                elif sub == "approve" and _tid():
                    t = brain.approve_task(_tid(), by="Phil")
                    result = (_ok(t["error"]) if t.get("error") else
                              _ok(f"#{t['id']} APPROVED by Phil: {t['task']}"))
                elif sub == "override" and _tid():
                    t = brain.override_task(_tid(), by="Phil")
                    result = (_ok(t["error"]) if t.get("error") else
                              _ok(f"#{t['id']} gate OVERRIDDEN by Phil (logged as a decision).\n"
                                  f"task: done {_tid()} will now pass the gate."))
                elif sub == "note" and _tid() and len(parts) >= 3:
                    t = brain.note_task(_tid(), parts[2])
                    result = (_ok(t["error"]) if t.get("error") else
                              _ok(f"Interface note attached to #{t['id']}."))
                elif sub == "exempt" and _tid():
                    t = brain.exempt_task(_tid(), by="Phil")
                    result = (_ok(t["error"]) if t.get("error") else
                              _ok(f"#{t['id']} ruled EXEMPT from the approval gate (logged)."))
                elif sub == "done" and _tid():
                    t = brain.complete_task(_tid(), by="Phil")
                    if t.get("error"):
                        result = _ok(t["error"])
                    else:
                        result = _ok(f"Task #{t['id']} MERGED ({t['owner']}): {t['task']}")
                        event("learn", f"Task #{t['id']} merged: {t['task'][:60]}")
                        brain.record_decision("task_done", f"#{t['id']} {t['task'][:80]}",
                                              ["complete", "leave open"], "complete",
                                              "Phil confirmed completion")
                elif sub in ("", "list"):
                    result = _ok(brain.task_overview())
                else:
                    result = _ok("task: <add|propose|promote|state|review|approve|note|"
                                 "exempt|override|done|list> - say 'help' for the full list")
            elif lower.startswith("success:"):
                mode = "success"
                txt = question.split(":", 1)[1].strip()
                brain.record_success(txt, "flagged by Phil")
                result = {"answer": f"Recorded as a win: {txt}",
                          "sources": [], "images": [], "model": brain.MODEL}
                event("learn", f"Win recorded: {txt[:70]}")
            elif lower.startswith("access:"):
                mode = "access"
                sub = question.split(":", 1)[1].strip()
                low = sub.lower()
                if low.startswith("grant "):
                    grants = brain.access_grant(sub[6:].strip())
                    brain.record_decision("access_grant", sub[6:].strip(), ["grant", "deny"],
                                          "grant", "Phil asked her to read it")
                    answer = ("Granted. Outside-folder access now:\n" +
                              "\n".join(f"- {g}" for g in grants))
                elif low.startswith("revoke "):
                    grants = brain.access_revoke(sub[7:].strip())
                    brain.record_decision("access_revoke", sub[7:].strip(), ["keep", "revoke"],
                                          "revoke", "Phil asked")
                    answer = ("Revoked. Outside-folder access now:\n" +
                              ("\n".join(f"- {g}" for g in grants) if grants else "(none)"))
                else:
                    grants = brain.access_grants()
                    answer = ("Outside-folder grants:\n" +
                              "\n".join(f"- {g}" for g in grants)) if grants else \
                             ("No outside-folder grants on record. The Emberweave Archive is "
                              "always open to me; any other folder opens the moment you ask "
                              "me to read it (the ask IS the grant), and access: revoke "
                              "<path> closes it again.")
                result = {"answer": answer, "sources": [], "images": [], "model": brain.MODEL}
            elif lower.startswith("heartbeat:"):
                mode = "heartbeat"
                sub = question.split(":", 1)[1].strip().lower()
                if sub.startswith("on"):
                    parts = sub.split()
                    interval = 300
                    if len(parts) > 1 and parts[1].isdigit():
                        interval = max(15, int(parts[1]))
                    heartbeat_start(interval, by="Phil")
                    answer = (f"Heartbeat ON - every {interval}s.\n"
                              "Each beat reports: archive changes, worker jobs (stale ones "
                              "flagged), open task count. Beats are logged to "
                              "memory/beats.jsonl and shown in my activity feed.\n"
                              "It survives restarts. Say 'heartbeat: off' to stop it.")
                elif sub.startswith("off"):
                    heartbeat_stop(by="Phil")
                    answer = "Heartbeat OFF. It stays off until you ask for it again."
                else:
                    st = brain.load_mem("heartbeat.json", {})
                    alive = _hb["thread"] is not None and _hb["thread"].is_alive()
                    answer = (f"Heartbeat is {'RUNNING' if alive else 'OFF'}.\n"
                              f"last state: {json.dumps(st)}\n"
                              "commands: heartbeat: on [seconds] | heartbeat: off | "
                              "heartbeat: status")
                brain.record_decision("heartbeat", sub or "status",
                                      ["on", "off", "status"], sub or "status",
                                      "Phil asked")
                result = {"answer": answer, "sources": [], "images": [], "model": brain.MODEL}
            elif lower.startswith("fix:"):
                mode = "fix"
                what = question.split(":", 1)[1].strip()
                if not what:
                    result = {"answer": "fix: <what to fix> - I repair my own code "
                                        "(brain.py, app.py, agents.py, ui.html) when you "
                                        "ask: backup, syntax gate, self-restart.\n"
                                        "fix: rollback - undo my newest self-edits.",
                              "sources": [], "images": [], "model": brain.MODEL}
                elif what.lower() == "rollback":
                    result = self_rollback()
                else:
                    result = self_fix(what)
            elif lower.startswith("daily:"):
                mode = "daily"
                path = brain.daily_report()
                if path:
                    text = path.read_text(encoding="utf-8")
                    result = {"answer": f"filed: reports/{path.name}\n\n{text}",
                              "sources": [], "images": [], "model": brain.MODEL}
                    event("learn", f"Daily report written: {path.name}")
                else:
                    result = {"answer": "Daily report failed to write - check reports/.",
                              "sources": [], "images": [], "model": brain.MODEL}
            elif lower.startswith("report:"):
                mode = "report"
                topic = question.split(":", 1)[1].strip()
                if topic.strip().lower() == "daily":
                    path = brain.daily_report()
                    result = {"answer": (f"Daily report filed: reports/{path.name}"
                                        if path else "Daily report failed to write."),
                              "sources": [], "images": [], "model": brain.MODEL}
                    if path:
                        event("learn", f"Daily report written: {path.name}")
                elif topic.strip().lower() in ("sprint", "risk", "progress", "agent"):
                    gen = {"sprint": brain.sprint_report, "risk": brain.risk_report,
                           "progress": brain.progress_report,
                           "agent": brain.agent_report}[topic.strip().lower()]
                    path = gen()
                    label = topic.strip().capitalize()
                    result = {"answer": (f"{label} report filed: reports/{path.name}"
                                        if path else
                                        "Report failed to write - check reports/."),
                              "sources": [], "images": [], "model": brain.MODEL}
                    if path:
                        event("learn", f"{label} report written: {path.name}")
                elif not topic:
                    result = {"answer": "report: <topic> - I compile a cited markdown report "
                                        "into my reports/ folder. Fixed types: daily, sprint, "
                                        "risk, progress, agent.",
                              "sources": [], "images": [], "model": brain.MODEL}
                else:
                    path = brain.write_report(topic)
                    if path:
                        result = {"answer": f"Report written: {path.name}\n\n"
                                            f"Open it in my reports/ folder - cited, with "
                                            f"analysis and owner-tagged actions.",
                                  "sources": [], "images": [], "model": brain.MODEL}
                        event("learn", f"Report written: {path.name}")
                        brain.record_decision("report", topic, ["compile report", "answer inline"],
                                              path.name, "Phil asked for a document")
                    else:
                        result = {"answer": "Nothing in the archive to build a report on for "
                                            "that topic - try a dig first, then report: again.",
                                  "sources": [], "images": [], "model": brain.MODEL}
            elif lower.startswith("read:"):
                mode = "read"
                rel = question.split(":", 1)[1].strip()
                text = brain.read_file_cmd(rel)
                # read: is a verbatim pull, not an analysis - answer inline, no model pass
                result = {"answer": text, "sources": [], "images": [], "model": brain.MODEL}
            elif lower.startswith("metrics:"):
                mode = "metrics"
                m = brain.metrics_summary()
                tr = f"{m['score_trend']:+.3f}" if m["score_trend"] is not None else "n/a"
                result = {"answer": (
                    f"SELF-IMPROVEMENT METRICS (Step 20)\n\n"
                    f"| metric | value |\n|---|---|\n"
                    f"| scored answers | {m['questions']} |\n"
                    f"| avg retrieval match | {m['avg_score']} |\n"
                    f"| score trend (2nd half vs 1st) | {tr} |\n"
                    f"| failures on record | {m['failures']} |\n"
                    f"| refusal rate | {m['refusal_rate']:.0%} |\n"
                    f"| tasks done / open | {m['tasks_done']} / {m['tasks_open']} |\n"
                    f"| stale tasks (>7 days in one state) | {m['tasks_stale']} |\n"
                    f"| agent jobs ok / failed | {m['agent_jobs_ok']} / {m['agent_jobs_failed']} |\n"
                    f"| decisions on record | {m['decisions']} |\n\n"
                    "These feed my decisions - the METRICS line rides in every prompt."),
                    "sources": [], "images": [], "model": brain.MODEL}
            elif lower.startswith("fetch:"):
                import re as _re
                m = _re.search(r"https?://\S+", question)
                if m:
                    mode = "fetch"
                    result = brain.fetch(m.group(0), question)
                else:
                    result = {"answer": "fetch: needs a URL, e.g.  fetch: https://example.com/docs",
                              "sources": [], "images": [], "model": brain.MODEL}
            else:
                result = brain.ask(question, history=list(HISTORY), effort=effort)
            result.setdefault("effort", effort)
        except Exception as e:
            result = {"answer": f"(error: {e})", "sources": [], "images": [], "model": brain.MODEL}
        if result.get("correction"):
            _pending_correction = question  # arm the yes-to-store bridge
        HISTORY.append((question, result.get("answer", "")[:600]))
        del HISTORY[:-HISTORY_MAX]
        # capability 9 - self-monitoring metrics (refusal counted at the feed tag below)
        ts = result.get("top_score")
        if ts is not None:
            n = _state.get("scored", 0)
            _state["avg_score"] = round((_state.get("avg_score", 0) * n + ts) / (n + 1), 3)
            _state["scored"] = n + 1
            # trend log: one JSON line per scored question so retrieval quality
            # is measured over time, not felt (heartbeat reads scores.jsonl)
            try:
                with open(BASE / "scores.jsonl", "a", encoding="utf-8") as fh:
                    fh.write(json.dumps({"t": time.strftime("%Y-%m-%d %H:%M:%S"),
                                         "mode": mode, "q": question[:80],
                                         "score": ts}, ensure_ascii=False) + "\n")
            except OSError:
                pass
        # chat memory: she appends to her own editable memory via ```memory blocks;
        # the block is stripped from what Phil sees and stored entry-by-entry
        mem_blocks = _MEMORY_BLOCK_RE.findall(result.get("answer", ""))
        if mem_blocks:
            stored = []
            for blk in mem_blocks:
                for ln in blk.strip().splitlines():
                    ln = ln.strip("- •\t ")
                    if ln:
                        e = memory_append(ln, "brain")
                        if e:
                            stored.append(e)
            result["answer"] = _MEMORY_BLOCK_RE.sub("", result["answer"]).strip()
            if stored:
                event("memory", f"she stored {len(stored)} memory entr{'y' if len(stored) == 1 else 'ies'}",
                      lines=stored[:12])
        srcs = [s["file"].split("/")[-1] for s in result.get("sources", [])[:2]]
        tail = f" -> read: {', '.join(srcs)}" if srcs else ""
        label = "" if mode == "ask" else f"{mode}: "
        # honesty tag: the feed says WHEN an answer isn't archive-backed
        kind = result.get("kind")
        honest = {"meta": " [about me]", "not_covered": " [not in archive]"}.get(kind, "")
        # full Q&A detail: the UI dropdown shows exactly what was asked and answered
        ask_lines = [f"Q: {question}", "", f"A: {result.get('answer', '')}"]
        all_srcs = [s["file"] for s in result.get("sources", [])]
        if all_srcs:
            ask_lines += ["", "read: " + ", ".join(all_srcs[:8])]
        event("ask", f"{label}Q{_state['questions']}: {question[:55]}{tail}{honest}", lines=ask_lines)
        # metrics: outcome kind feeds the grounded-rate fact; hero names feed recall
        try:
            with open(OUTCOMES_FILE, "a", encoding="utf-8") as fh:
                fh.write(json.dumps({"t": time.strftime("%Y-%m-%d %H:%M:%S"),
                                     "kind": kind or "answer"}) + "\n")
        except OSError:
            pass
        _mark_chars(question, kind)
        if result.get("trace"):
            event("thinking", f"{label}Q{_state['questions']}: {question[:60]}",
                  lines=result["trace"])
        if kind == "not_covered" or result.get("answer", "").startswith("The archive doesn't cover"):
            _state["refusals"] = _state.get("refusals", 0) + 1
        result["status"] = _state
        self._json(result)
        if _restart_pending:
            threading.Timer(2.0, _restart_engine).start()

    def do_PUT(self):
        route = urlparse(self.path).path
        if route == "/api/memory":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length))
                content = (body.get("content") or "").strip()
            except Exception:
                self._json({"error": "bad request"}, 400)
                return
            evicted = 0
            blocks = [b for b in content.split("\n[") if b.strip()]
            while len(content.split()) > MEMORY_MAX_WORDS and len(blocks) > 1:
                blocks.pop(0)
                content = "[" + "\n[".join(blocks)
                evicted += 1
            try:
                CHAT_MEMORY_FILE.write_text(content + "\n" if content else "", encoding="utf-8")
            except OSError:
                self._json({"error": "write failed"}, 500)
                return
            event("memory", f"Phil edited the chat memory ({evicted} oldest evicted for cap)" if evicted
                  else "Phil edited the chat memory")
            self._json({"ok": True, "content": memory_read(),
                        "words": len(memory_read().split()), "cap": MEMORY_MAX_WORDS})
        else:
            self._json({"error": "not found"}, 404)

    def _vision(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            image = body["image"]
            question = body.get("question", "What is this?").strip() or "What is this?"
        except Exception:
            self._json({"error": "bad request"}, 400)
            return
        if "," in image and image.startswith("data:"):
            image = image.split(",", 1)[1]
        if len(image) > 9_000_000:
            self._json({"error": "image too large (9MB max)"}, 400)
            return
        _state["questions"] += 1
        result = brain.vision(image, question)
        HISTORY.append((f"[image] {question}", result.get("answer", "")[:600]))
        del HISTORY[:-HISTORY_MAX]
        event("ask", f"vision | Q{_state['questions']}: {question[:55]}")
        result["status"] = _state
        self._json(result)

    def log_message(self, fmt, *args):
        pass

def main():
    # singleton guard: a second app.py must exit, not split-brain.
    # Two engines once ran concurrent reindexes that collided on embed_cache
    # (os.replace failed mid-save) and left embeddings/chunks mismatched.
    # A held UDP bind is atomic, kernel-enforced, dies with the process,
    # and does not depend on OneDrive file semantics. ThreadingHTTPServer's
    # SO_REUSEADDR lets two TCP servers share 7777 on Windows - this can't.
    import socket as _sock
    global _singleton_sock
    _singleton_sock = _sock.socket(_sock.AF_INET, _sock.SOCK_DGRAM)
    for _attempt in range(10):   # retry: a self-restart's old process may hold 7779 briefly
        try:
            _singleton_sock.bind(("127.0.0.1", PORT + 2))  # 7779 = "I am THE engine"
            break
        except OSError:
            time.sleep(0.5)
    else:
        print("[brain] another instance is already running - exiting.", flush=True)
        os._exit(0)   # hard exit: sys.exit can hang on non-daemon threads -> zombie
    # self-edit boot recovery: if the last self-repair crashed the boot BEFORE the
    # server came up (pending.json never cleared), auto-revert from backups.
    # A PLANNED self-restart carries EMBERWEAVE_SELF_RESTART=1 - that boot must
    # NOT roll back; it keeps the marker and clears it only after a healthy bind.
    _pend = BASE / "selfedits" / "pending.json"
    if _pend.exists() and not os.environ.get("EMBERWEAVE_SELF_RESTART"):
        try:
            import shutil as _sh
            pb = json.loads(_pend.read_text(encoding="utf-8"))
            for bname in pb.get("backups", []):
                fn = next((f for f in brain.SELF_EDIT_FILES if bname.endswith("-" + f)), None)
                bpath = BASE / "selfedits" / bname
                if fn and bpath.exists():
                    _sh.copy2(bpath, BASE / fn)
                    print(f"[brain] boot recovery: restored {fn} from {bname}", flush=True)
            _pend.unlink()
            event("warn", "My last self-edit broke the boot - auto-reverted from backups.")
        except Exception as e:
            print(f"[brain] rollback error: {e}", flush=True)
    vec, matrix, chunks = brain.load()
    _state["files"] = len({c["file"] for c in chunks})
    _state["chunks"] = len(chunks)
    _state["last_index"] = time.strftime("%H:%M:%S")
    _state["booted"] = time.time()
    threading.Thread(target=watcher, daemon=True).start()
    threading.Thread(target=_git_sync_loop, daemon=True).start()
    # boot-persistent heartbeat: if Phil turned it ON, she wakes up beating
    try:
        _hbst = brain.load_mem("heartbeat.json", {})
        if _hbst.get("enabled"):
            heartbeat_start(int(_hbst.get("interval", 300)), by="boot (persisted ON)")
    except Exception as e:
        print(f"[brain] heartbeat restore failed: {e}", flush=True)
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        # another engine instance owns the port - die fast so the watcher
        # never leaves a zombie second indexer running
        print("port 7777 already bound - another Brain is alive, exiting", flush=True)
        os._exit(0)   # hard exit: sys.exit can hang on non-daemon threads -> zombie
    try:
        _ok = BASE / "selfedits" / "pending.json"
        if _ok.exists():
            _ok.unlink()   # boot healthy - the self-edit is confirmed good
    except OSError:
        pass
    print(f"\n  EMBERWEAVE BRAIN online -> http://localhost:{PORT}\n"
          f"  {_state['chunks']} chunks from {_state['files']} files. "
          f"Auto-reindex every {POLL_SECONDS}s on change.\n", flush=True)
    event("boot", f"Brain awakened — {_state['chunks']:,} chunks from {_state['files']} documents.")
    server.serve_forever()

if __name__ == "__main__":
    main()
