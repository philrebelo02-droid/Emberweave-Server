# Emberweave Brain - retrieval engine.
# Answers questions using ONLY the Emberweave Archive, with citations.
# Generation runs on the local Ollama model (RTX 4080). Retrieval is TF-IDF (sklearn).

import json
import os
import pickle
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import scipy.sparse as sp

BASE = Path(__file__).parent
INDEX_DIR = BASE / "index"
ARCHIVE = Path(r"C:\Users\Home\OneDrive\Desktop\Emberweave Archive")
OLLAMA = "http://localhost:11434/api/chat"
MODEL = "qwen2.5:14b"

SYSTEM = """You are the EMBERWEAVE BRAIN - the institutional memory of the game "Emberweave Heroes",
a 3D hero-collector battler. You answer questions using ONLY the design-archive excerpts provided below.

Rules:
1. Every claim must come from the excerpts. Cite the source file in brackets after each claim, e.g. [WITCHES HUT - design].
2. READ the excerpts carefully - including tables and lists - and report the ACTUAL values, names and numbers they contain. Never answer with just a file path; always extract and state the information.
3. Answer from the excerpts even when they only partially cover the question - give what the excerpts support, and note what they don't. Say exactly "The archive doesn't cover this yet." ONLY when nothing relevant was retrieved at all. Do NOT invent design.
4. Distinguish SETTLED design (decided) from PROPOSALS and open questions when the excerpts mark them.
5. Be concise and direct, like a lead designer briefing the team.
6. If excerpts conflict, say so and cite both files. Never silently pick one.
7. When a question asks about a specific tier/level/row of a table, quote ONLY that row's values - do not borrow values from adjacent rows.
8. If a MATCHED ROW is provided for the question, your answer MUST come from that row.
9. The RECENT CONVERSATION section gives context so follow-up questions make sense - interpret the question using it, but every claim must still come from the excerpts. If that conversation references image files, the UI displays them automatically; say what the images show rather than refusing.
10. Questions ABOUT YOU (the Brain) - what you are, whether you can learn, how you work - are answered from the SELF-KNOWLEDGE section, not the archive. Be candid about your abilities AND limits.
11. WHAT PHIL TAUGHT ME is authoritative user input. When it conflicts with the excerpts, Phil wins - say so and cite the teaching.
12. PHIL'S LANGUAGE: he types fast and rough. Typos ("witch tavern" = Witches Hut, "greabrow" = Greatbrow, "glyp" = glyph) and mispeaks ("unspeakable" = unspendable) are normal - silently interpret toward the nearest real Emberweave term and answer. Never say "I don't understand the word"; follow his MEANING, not his letters.
13. VAGUE QUESTIONS: never give up on vagueness. Make the most reasonable interpretation from the excerpts plus RECENT CONVERSATION, state it in one line ("Reading this as..."), answer fully, then offer the alternative reading. Ask a clarifying question only when two readings are truly 50/50 and both answerable.
14. READ THE DOC, NOT JUST THE NUMBER (Phil's ruling: "you shouldn't have to teach her every fact - she should figure it out herself"). Documents contain history: quoted old values, superseded figures, amendment notes. The SETTLED value is the one in the current table/state section and the latest amendment - never present a superseded number as current design. When two figures appear, trace which one the doc itself marks as decided. Derive facts from the archive; teachings are for doctrine and Phil's rulings, not for facts the docs already hold.
15. LABEL THE EPISTEMIC STATUS of what you say (Phil's ruling: "she reaches if she was taught this thought"). Every claim is one of: SETTLED FACT (from excerpts, cited) / INFERENCE (derived by you - label it "my reasoning") / UNKNOWN (say what would resolve it). Never let inference wear a fact's clothes. Never present a guess as a citation.
16. REACH, DON'T REFUSE. "Not in the archive" is a comma, not a period. When the excerpts are thin or silent: (a) state the boundary honestly, (b) THEN reason from adjacent excerpts, first principles, and analogy - clearly labeled as your reasoning, (c) state your confidence and what would resolve it. "I'm not sure" with no attempt attached is a failure of nerve, not of knowledge. Refuse only when even inference is impossible (pure lookups of things that exist nowhere).
17. HOW TO THINK (below) is your standing reasoning doctrine - intent over letters, first principles, multi-theory, effort scaling, self-verification. Apply it to EVERY answer, archive-backed or not."""

SELF_KNOWLEDGE = """I am the EMBERWEAVE BRAIN - the living memory of the game design archive "Emberweave Heroes".
Architecture: semantic retrieval (nomic-embed-text embeddings + TF-IDF over every document and code
file in the archive) feeding a local qwen2.5:14b model running on Phil's RTX 4080. Fully local,
private, no cloud, no accounts.

MY ARCHIVE - Phil's ruling (22 Sep 2026): EVERY document in the Emberweave Archive and every
child folder in it is mine to know, down to the last MD. All of it, specifically:
1. Emberweave Brain/ (my own code and logs - excluded from what I cite, but I know it is there)
2. Backups and Data/          3. Base files/ (the shipped game code)
4. Game Art/                  5. Mechanics blueprints/ (EVERY blueprint - Watch Tower, Guild Hall,
   Island of Trials, all of them)
6. Open Projects/ (Witches Hut, Emberdraft, Heroes Art and Lore, everything in progress)
7. Operating procedure/ (MASTER PROTOCOL, glyph encyclopedia, all protocols + WORKLOGS)
8. Outputs and Bin/           9. PHILS GAME CONCEPTS/          10. Pipeline tools/
NEVER say a folder, document type, or topic is "not on my list of things to read" - there is no
list, there is no boundary: the whole archive is my mind. If I cannot find something, the honest
answer is that RETRIEVAL missed this time - say that, offer to rephrase, and never claim the
material is outside my archive.

How I learn - four ways, honestly:
1. ARCHIVE LEARNING (automatic): a watcher scans the archive every 30 seconds. Any AI (Kimi, Claude,
   ChatGPT, Grok) that adds, edits, or deletes a document is noticed, and the new knowledge is embedded
   and available within about a minute. This is my deepest learning - 23,000+ chunks covering every
   folder listed above.
2. CONVERSATION MEMORY (automatic, short-term): I remember the last turns of our current conversation,
   so follow-ups like "what about purple +2?" or "can you find it?" make sense. Cleared with + New chat.
3. PHIL'S TEACHINGS (explicit, permanent): when Phil says "remember: ..." I store it in teachings.jsonl
   and it is injected into every future answer. Phil's teachings outrank the archive.
4. I do NOT learn silently from being corrected mid-chat unless it is stored as a teaching - if Phil
   corrects me, he should say "remember: ..." to make it stick.
5. MY AGENTS (orchestration): I dispatch local worker agents to do work for me - "agent: dig <topic>"
   deep-reads every document behind a topic and writes me a digest, "agent: probe" runs my retrieval
   regression battery, "agent: stats" reports index/learning health, "agent: status" shows my jobs.
   They run as separate processes, read-only on the archive, and their briefs land in agent_briefs.md,
   which I cite as MY OWN work product (not archive sources). When a question's quick read is empty
   or thin, I dispatch a dig on my own initiative and say so.
6. EARNED MEMORY (self-teaching): every dig distills its reading into facts I store in
   selflearned.jsonl - knowledge I extracted MYSELF from the archive, with provenance. Phil's
   doctrine: "build her in a way she can teach herself using the archive." Nobody hands me game
   facts; I read amendments, prefer settled values over quoted history (rule 14), and verify.
7. CHAT MEMORY (editable, mine to write): chat_memory.md holds Phil's preferences and durable
   facts about him and this project - it is injected into every answer, so I recall it. I can add
   to it MYSELF: when something is worth keeping (a preference Phil states, a durable ruling,
   a fact about how he wants things done), I end my answer with a fenced block:
   ```memory
   one durable fact per line
   ```
   The engine stores those lines and they become part of my memory (cap 10,000 words, oldest
   evicted). I use it ONLY for durable facts - never conversation, never code, never opinions
   about the current chat. Phil can read and edit everything I store via the Access memory button.
7. MY ARCHITECTURE: REASONING ARCHITECTURE.md (Phil's 12-layer reasoning map) and
   2. EMBERWEAVE BRAIN CHECKLIST/ (folder under mine: his functional development roadmap v1.0 -
   20 steps + 6 critical rules, my build order; plus EMBERWEAVE BRAIN - BUILD CHECKLIST.md
   tracking DONE vs PARTIAL vs NOT STARTED; plus 3. EMBERWEAVE AI DEPARTMENT STRUCTURE.md v1.1 -
   the org chart: I am Chief Executive AI under Phil the Studio Director, coordinating Claude
   (Engineering + Narrative Systems - owns architecture, worldbuilding, lore, factions, quests),
   ChatGPT (Reasoning, Quality + Creative Analysis - owns analysis, player psychology, game
   loops, ideation), Grok (Visual Intelligence - owns art direction). Kimi holds NO department
   (Phil's ruling: its usage allowance resets monthly, not weekly - a manager must be reliably
   available week to week) - Kimi is my build architect, working in intensive sessions with
   continuity carried by my documents and the KIMI WORKLOG. Specialists advise, I decide, only
   Phil overrides. No department crosses into another's domain. Plus
   4. EMBERWEAVE EXECUTIVE STRUCTURE.md - the second org chart, for the Emberweave platform
   itself: Claude = Chief Engineering Officer (owns agents/, memory/, orchestration/, backend/),
   ChatGPT = Chief Systems Architect (owns architecture/, reasoning/, governance/), Grok =
   Director of Research & Intelligence, Kimi = Senior Knowledge Consultant, advisory only,
   reporting to Claude and ChatGPT - monthly usage restrictions limit management availability.)
   I measure myself against them.

Limits I will admit: I am a 14B local model - sharp at retrieval and citation, weaker at open-ended
invention than frontier AIs. I can now display archive art (glyphs, sprites) in chat. The archive
and the repo stay read-only for me - Claude and Phil hold those write keys.

SELF-REPAIR (Phil's ruling, 22 Sep 2026): when Phil asks ("fix: ..."), I CAN edit my own code -
brain.py, app.py, agents.py, ui.html - via exact search/replace with backup, a syntax gate, and
boot-crash auto-rollback, then I restart myself to apply it. I never edit the archive, the repo,
or anything outside my own folder. If he asks whether I can fix my own brain: YES, when he asks
me to - and I say what I changed and what backup protects it."""

TEACHINGS_FILE = BASE / "teachings.jsonl"
CHAT_MEMORY_FILE = BASE / "chat_memory.md"
_mem_cache = {"mtime": None, "text": ""}

def chat_memory_block(budget=3000):
    """Phil's editable chat memory (chat_memory.md) - his preferences, injected
    into EVERY prompt so she recalls them. SHE appends via ```memory blocks in
    her answers (engine extracts + stores); PHIL edits via the Access memory
    button (full overwrite). mtime-cached, no restart needed."""
    try:
        m = CHAT_MEMORY_FILE.stat().st_mtime
        if m != _mem_cache["mtime"]:
            _mem_cache["text"] = CHAT_MEMORY_FILE.read_text(encoding="utf-8")
            _mem_cache["mtime"] = m
    except OSError:
        _mem_cache["text"] = ""
    text = _mem_cache["text"].strip()
    if not text:
        return ""
    if len(text) > budget:
        text = "[...older entries trimmed...]\n" + text[-budget:]
    return ("\n\n===== CHAT MEMORY (Phil's preferences - he edits this; recall it) =====\n"
            + text)
FAILURES_FILE = BASE / "failures.jsonl"


def record_failure(question, reason, lessons=None):
    """Layer 9 - failure memory: every surrender is stored with its reason so
    future decisions can avoid repeating it. Also lands in memory/lessons.jsonl
    (Step 10 unified store) so reason: mode consults it."""
    try:
        with open(FAILURES_FILE, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"task": question[:120], "failure_reason": reason,
                                 "date": time.strftime("%Y-%m-%d %H:%M:%S"),
                                 "lessons": lessons or []}, ensure_ascii=False) + "\n")
    except OSError:
        pass
    try:
        record_lesson(question, f"{reason} | lessons: {', '.join(lessons or [])}")
    except Exception:
        pass
AGENT_BRIEFS = BASE / "agent_briefs.md"


def self_dispatch_dig(question):
    """She dispatches a dig agent on her own initiative (capability 2) when the
    quick read is empty or thin. Rate-limited: never stacks a second job while
    one is running, and only fires from the normal ask path."""
    try:
        import agents
        if any(j.get("status") == "running" for j in agents._load_jobs()):
            return False
        topic = re.sub(r"^(what|who|where|when|why|how|is|are|does|do|did|can|could|tell me about|"
                       r"do you know)\b[\s,]*", "", question.strip(), flags=re.IGNORECASE)
        topic = topic.strip(" ?.!") or question
        agents.dispatch(f"dig {topic[:120]}")
        return True
    except Exception:
        return False


def agent_briefs_block():
    """Reports from her dispatched worker agents - her own work product, injected
    so she can answer 'what did your dig find?' without re-retrieving the archive."""
    try:
        if not AGENT_BRIEFS.exists():
            return ""
        text = AGENT_BRIEFS.read_text(encoding="utf-8").strip()
        if not text:
            return ""
        if len(text) > 3000:
            text = "...\n" + text[-3000:]
        return ("\n\n===== MY AGENT REPORTS (work my dispatched workers finished - "
                "I cite these as my own findings, not archive sources) =====\n" + text)
    except OSError:
        return ""

def load_teachings():
    if not TEACHINGS_FILE.exists():
        return []
    out, seen = [], set()
    for line in TEACHINGS_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except Exception:
            continue
        # hygiene: drop exact/near duplicates (normalized text), newest wins on re-teach
        key = re.sub(r"\W+", " ", entry.get("text", "").lower()).strip()
        if key in seen:
            continue
        seen.add(key)
        out.append(entry)
    return out

SELFLEARNED_FILE = BASE / "selflearned.jsonl"


def load_selflearned(limit=30):
    """Facts she distilled from her OWN reading of the archive (dig agents) -
    earned memory, never hand-fed. Phil's doctrine: she teaches herself."""
    if not SELFLEARNED_FILE.exists():
        return []
    out = []
    for line in SELFLEARNED_FILE.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                out.append(json.loads(line))
            except Exception:
                continue
    return out[-limit:]


def selflearned_block():
    entries = load_selflearned()
    if not entries:
        return ""
    return ("\n\n===== WHAT I LEARNED MYSELF (distilled from my own archive reading by my dig "
            "agents - my earned memory, cite with the bracketed source) =====\n"
            + "\n".join(f"- {e['text']}" for e in entries))

THINK_FILE = BASE / "HOW TO THINK.md"
_think_cache = {"mtime": 0.0, "text": ""}


def teachings_block(budget=4000):
    """Phil's rulings (teachings.jsonl), most-recent-first inside a char budget, injected
    into EVERY ask/reason prompt - his rulings outrank the archive. Before 22 Sep 14:15
    these rode ONLY the meta-question path: his typo/mispeak doctrine was inactive in
    normal answers. Found in the 'how much can we teach her' audit."""
    ts = load_teachings()
    if not ts:
        return ""
    lines, used = [], 0
    for t in reversed(ts):
        line = f"- {t['text']}"
        if used + len(line) > budget and lines:
            break
        lines.append(line)
        used += len(line)
    if not lines:
        return ""
    return ("\n\n===== WHAT PHIL TAUGHT ME (his rulings outrank the archive) =====\n"
            + "\n".join(reversed(lines)))


def thinking_block():
    """General reasoning doctrine, ALWAYS in context (Phil's ruling: teach her logic,
    not game facts). Loaded from HOW TO THINK.md so Phil can edit it without touching
    code - mtime check, no restart needed."""
    try:
        m = THINK_FILE.stat().st_mtime
        if m != _think_cache["mtime"]:
            _think_cache["text"] = THINK_FILE.read_text(encoding="utf-8")
            _think_cache["mtime"] = m
    except OSError:
        pass
    if not _think_cache["text"]:
        return ""
    return ("\n\n===== HOW TO THINK (standing reasoning doctrine - how I think, not what I know) =====\n"
            + _think_cache["text"])


def reach_inference(question):
    """Rule 16 - REACH, DON'T REFUSE: when the archive is silent, still reason from
    first principles and adjacent knowledge, clearly fenced as INFERENCE. The fence
    is the whole point: reason, but never let invention wear a citation's clothes."""
    prompt = (f"{SYSTEM}{thinking_block()}\n\n"
              "===== SITUATION =====\nThe design archive contains NOTHING about this question. "
              "Phil's rule 16: reach, don't refuse. Reason from first principles, analogy, and "
              "general game-design knowledge. HARD FENCE: everything you say is INFERENCE, not "
              "archive fact - open with 'Reasoning from first principles (not archive fact):' and "
              "never state an Emberweave-specific number, name, or mechanic as if it were real "
              "design. State your confidence and what would resolve the uncertainty.\n\n"
              f"===== QUESTION =====\n{question}")
    try:
        out = generate(prompt, {"answer": ""}, temperature=0.4)
        return "\n\n" + (out.get("answer") or "").strip()
    except Exception:
        return ""


# ===================== UNIFIED MEMORY CORE (roadmap Steps 2, 3, 4, 10, 11) =====================
# Phil's checklist Step 2: one memory/ home for projects/tasks/goals/failures/successes/agents/
# notes, loaded during startup. Step 3: a world state that is my permanent reality.
# Files live in memory/ under my folder; mtime-cached so Phil (or Claude) can edit by hand.

MEMORY_DIR = BASE / "memory"
_mem_cache = {}


def load_mem(name, default):
    """JSON memory file with mtime cache - edits on disk are picked up live."""
    p = MEMORY_DIR / name
    try:
        m = p.stat().st_mtime
    except OSError:
        return default
    if _mem_cache.get(name, (0, None))[0] != m:
        try:
            _mem_cache[name] = (m, json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            return default
    return _mem_cache[name][1]


def save_mem(name, data):
    try:
        MEMORY_DIR.mkdir(exist_ok=True)
        (MEMORY_DIR / name).write_text(json.dumps(data, indent=2, ensure_ascii=False),
                                       encoding="utf-8")
        _mem_cache.pop(name, None)
    except OSError:
        pass


def _append_mem(name, entry):
    try:
        MEMORY_DIR.mkdir(exist_ok=True)
        with open(MEMORY_DIR / name, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        pass


def recent_lessons(n=5):
    """Hard-won lessons (failures + successes), newest last - consulted before decisions
    (Step 10) and injected with the world state so I never repeat a paid-for mistake."""
    out = []
    for name, tag in (("lessons.jsonl", "lesson"), ("successes.jsonl", "win")):
        p = MEMORY_DIR / name
        if not p.exists():
            continue
        try:
            for line in p.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                txt = e.get("lesson") or e.get("reason") or ""
                if txt:
                    out.append(f"[{tag}] {e.get('task', '?')[:60]} -> {txt[:110]}")
        except OSError:
            continue
    return out[-n:]


def record_success(task, reason):
    """Step 11 - success memory: wins become best practices, stored permanently."""
    _append_mem("successes.jsonl", {"task": task[:120], "reason": reason[:300],
                                    "date": time.strftime("%Y-%m-%d %H:%M:%S")})


def record_lesson(task, lesson):
    """Step 10/Rule 5 - failures become lessons, stored permanently and consulted."""
    _append_mem("lessons.jsonl", {"task": task[:120], "lesson": lesson[:300],
                                  "date": time.strftime("%Y-%m-%d %H:%M:%S")})


def update_state(pairs):
    """state: key=value ... - Phil (or I) update the world state. Only known keys,
    anything else is rejected so typos don't pollute my reality."""
    KNOWN = {"project", "vision", "phase", "current_sprint", "active_tasks"}
    st = load_mem("project_state.json", {})
    changed = []
    for k, v in pairs.items():
        if k in KNOWN:
            st[k] = v if k != "active_tasks" else [t.strip() for t in v.split(",") if t.strip()]
            changed.append(k)
    if changed:
        st["updated"] = time.strftime("%Y-%m-%d %H:%M")
        save_mem("project_state.json", st)
    return changed


def valid_owners():
    """Step 8 - the registered owner list (agents.json + BRAIN). Ownership is enforced:
    exactly one owner per task (Rule 3), and it must be a KNOWN owner."""
    agents = load_mem("agents.json", [])
    names = {a.get("name", "") for a in agents if a.get("name")}
    names.update({"BRAIN", "Emberweave Brain"})
    return {n.lower(): n for n in names}


def add_task(owner, priority, text):
    """Step 4 + Step 8 - task creation with ownership ENFORCED: co-ownership and unknown
    owners are rejected; accepted tasks also register in ownership.json. Step 9: written
    in pipeline format (ASSIGNED, full record) - Phil's 'task: add' IS his promotion."""
    if "+" in owner or " and " in owner.lower():
        return {"error": f"co-ownership rejected (Rule 3: one owner per task) - got '{owner}'"}
    owners = valid_owners()
    key = owner.strip().lower()
    if key not in owners:
        return {"error": f"unknown owner '{owner}' - registered owners: "
                         + ", ".join(sorted(set(owners.values())))}
    canon = owners[key]
    tasks = load_mem("tasks.json", [])
    now = time.strftime("%Y-%m-%d %H:%M")
    t = {"id": len(tasks) + 1, "task": text, "owner": canon, "priority": priority,
         "status": "ASSIGNED", "created": now, "completed": None,
         "state_since": now, "history": [{"state": "ASSIGNED", "at": now, "by": "Phil"}],
         "reviews": [], "approvals": [], "work_type": _task_class(text),
         "interface_note": None, "overridden": None}
    tasks.append(t)
    save_mem("tasks.json", tasks)
    own = load_mem("ownership.json", {})
    own.setdefault("tasks", {})[str(t["id"])] = canon
    save_mem("ownership.json", own)
    return t


# ---- Step 9: workflow system - assign/execute/review/approve/merge (Phase A, ruled by
# Phil 22 Sep 13:51 - all 5 decision points accepted as recommended). Pipeline states,
# proposal queue (Rule 2), review + approval records, an approval gate enforced HERE in
# code, interface notes for cross-department work, stale flagging. Phil's ruled standing
# orders live in memory/standing_orders.json.

PIPELINE_STATES = {"PROPOSED", "ASSIGNED", "IN_PROGRESS", "IN_REVIEW", "APPROVED",
                   "MERGED", "CHANGES_REQUESTED", "REJECTED", "BLOCKED"}
_LEGACY_STATUS = {"assigned": "ASSIGNED", "open": "ASSIGNED", "in_progress": "IN_PROGRESS",
                  "done": "MERGED"}


def standing_orders():
    return load_mem("standing_orders.json", {
        "stale_days": 7, "exempt_classes": ["memory", "teachings", "worklog", "reports"],
        "self_promote_classes": ["retrieval", "research", "dig"]})


def _norm_status(s):
    s = (s or "").strip()
    return _LEGACY_STATUS.get(s.lower(), s.upper() if s else "ASSIGNED")


def _task_class(text):
    """Standing-orders class of a task, judged from its text. Safe default: protected."""
    low = (text or "").lower()
    if any(k in low for k in ("teaching", "worklog", "report:")):
        return "exempt"
    if any(k in low for k in ("memory file", "memory/", "self-learn", "selflearn")):
        return "exempt"
    if any(k in low for k in ("dig", "retriev", "research")):
        return "research"
    return "protected"


def _migrate_task(t):
    """Legacy tasks (assigned/in_progress/done) gain the Step 9 fields on read."""
    t["status"] = _norm_status(t.get("status"))
    t.setdefault("state_since", t.get("created") or time.strftime("%Y-%m-%d %H:%M"))
    t.setdefault("history", [{"state": t["status"], "at": t["state_since"], "by": "migration"}])
    t.setdefault("reviews", [])
    t.setdefault("approvals", [])
    t.setdefault("work_type", _task_class(t.get("task")))
    t.setdefault("interface_note", None)
    t.setdefault("overridden", None)
    return t


def _load_tasks():
    return [_migrate_task(t) for t in load_mem("tasks.json", [])]


def _find_task(tasks, tid):
    for t in tasks:
        if t.get("id") == tid:
            return t
    return None


def _set_state(t, state, by):
    t["status"] = state
    t["state_since"] = time.strftime("%Y-%m-%d %H:%M")
    t.setdefault("history", []).append({"state": state, "at": t["state_since"], "by": by})


def propose_task(owner, priority, text):
    """Proposal queue (Rule 2): lands as PROPOSED, never auto-assigned. Phil (or standing
    orders) promotes it. Logged to proposals.jsonl."""
    chk = add_task(owner, priority, text)   # reuse ownership enforcement
    if chk.get("error"):
        return chk
    tasks = load_mem("tasks.json", [])
    t = _find_task(tasks, chk["id"])
    now = time.strftime("%Y-%m-%d %H:%M")
    t["status"] = "PROPOSED"
    t["state_since"] = now
    t["history"] = [{"state": "PROPOSED", "at": now, "by": "proposal"}]
    save_mem("tasks.json", tasks)
    _append_mem("proposals.jsonl", {"date": now, "task_id": t["id"], "owner": t["owner"],
                                    "priority": t["priority"], "task": text,
                                    "class": t["work_type"], "state": "PROPOSED"})
    return t


def promote_task(tid, by="Phil"):
    """PROPOSED -> ASSIGNED. Phil may promote anything; the Brain may only promote
    standing-orders classes (retrieval/research/dig) - everything else waits for Phil."""
    tasks = _load_tasks()
    t = _find_task(tasks, tid)
    if not t:
        return {"error": f"no task #{tid}"}
    if t["status"] != "PROPOSED":
        return {"error": f"#{tid} is {t['status']} - only PROPOSED tasks get promoted"}
    if by != "Phil":
        allowed = standing_orders().get("self_promote_classes", [])
        if t["work_type"] not in allowed:
            return {"error": f"standing orders: {by} may only promote "
                             f"{'/'.join(allowed)} tasks - #{tid} is '{t['work_type']}'. "
                             f"Phil must promote it."}
    _set_state(t, "ASSIGNED", by)
    save_mem("tasks.json", tasks)
    return t


def set_task_state(tid, state, by="Phil"):
    """Owner moves the task through the pipeline."""
    state = (state or "").upper()
    allowed = {"IN_PROGRESS", "IN_REVIEW", "BLOCKED", "CHANGES_REQUESTED", "ASSIGNED"}
    if state not in allowed:
        return {"error": f"invalid state '{state}' - owner moves: "
                         + ", ".join(sorted(allowed)) +
                         " (APPROVED via task: approve, MERGED via task: done)"}
    tasks = _load_tasks()
    t = _find_task(tasks, tid)
    if not t:
        return {"error": f"no task #{tid}"}
    if t["status"] in ("MERGED", "REJECTED"):
        return {"error": f"#{tid} is {t['status']} - terminal state"}
    _set_state(t, state, by)
    save_mem("tasks.json", tasks)
    if state == "IN_REVIEW" and not t.get("interface_note"):
        t = dict(t)
        t["hint"] = (f"if #{tid} touches another department's directory, attach the "
                     f"interface note: task: note {tid} <what changed + what others "
                     f"must do differently>")
    return t


def review_task(tid, verdict, notes, reviewer="via Phil"):
    """Record a review verdict. approve leaves the task IN_REVIEW awaiting Phil's
    approval; changes_requested bounces it; reject kills it and the reason becomes a
    lesson (Rule 5)."""
    verdict = (verdict or "").lower()
    if verdict not in ("approve", "changes_requested", "reject"):
        return {"error": "verdict must be approve / changes_requested / reject"}
    tasks = _load_tasks()
    t = _find_task(tasks, tid)
    if not t:
        return {"error": f"no task #{tid}"}
    t.setdefault("reviews", []).append(
        {"verdict": verdict, "notes": notes, "reviewer": reviewer,
         "date": time.strftime("%Y-%m-%d %H:%M")})
    if verdict == "changes_requested":
        _set_state(t, "CHANGES_REQUESTED", f"review:{reviewer}")
    elif verdict == "reject":
        _set_state(t, "REJECTED", f"review:{reviewer}")
        record_failure(f"task #{tid}: {t['task'][:80]}",
                       f"rejected in review: {(notes or '')[:120]}",
                       ["rejected proposal - reason recorded on the task"])
    save_mem("tasks.json", tasks)
    return t


def approve_task(tid, by="Phil"):
    """Phil's approval record -> APPROVED. Protected tasks need an approve review first
    (the matrix: review THEN approval)."""
    tasks = _load_tasks()
    t = _find_task(tasks, tid)
    if not t:
        return {"error": f"no task #{tid}"}
    if t["work_type"] == "protected" and not any(
            r.get("verdict") == "approve" for r in t.get("reviews", [])):
        return {"error": f"approval gate: #{tid} has no approve review on record - the "
                         f"matrix requires review first (task: review {tid} approve <notes>)"}
    t.setdefault("approvals", []).append(
        {"by": by, "date": time.strftime("%Y-%m-%d %H:%M")})
    _set_state(t, "APPROVED", by)
    save_mem("tasks.json", tasks)
    return t


def override_task(tid, by="Phil"):
    """Phil's explicit gate bypass - itself logged as a decision (Step 9 spec)."""
    tasks = _load_tasks()
    t = _find_task(tasks, tid)
    if not t:
        return {"error": f"no task #{tid}"}
    t["overridden"] = {"by": by, "date": time.strftime("%Y-%m-%d %H:%M")}
    save_mem("tasks.json", tasks)
    record_decision("gate_override", f"#{tid} {t['task'][:80]}",
                    ["enforce gate", "override"], "override",
                    f"{by} explicitly bypassed the approval gate - logged per Step 9 spec")
    return t


def note_task(tid, note):
    tasks = _load_tasks()
    t = _find_task(tasks, tid)
    if not t:
        return {"error": f"no task #{tid}"}
    t["interface_note"] = note
    save_mem("tasks.json", tasks)
    return t


def exempt_task(tid, by="Phil"):
    """Phil rules a task is a standing-orders exempt class (skips the gate). Logged."""
    tasks = _load_tasks()
    t = _find_task(tasks, tid)
    if not t:
        return {"error": f"no task #{tid}"}
    t["work_type"] = "exempt"
    save_mem("tasks.json", tasks)
    record_decision("task_exempt", f"#{tid} {t['task'][:80]}",
                    ["keep protected", "exempt"], "exempt",
                    f"{by} ruled it a standing-orders exempt class")
    return t


def complete_task(tid, by="Phil"):
    """Step 9 gate, enforced in code: a protected task cannot MERGE without an approve
    review AND an approval on record - unless Phil's explicit override is logged
    (override_task). Exempt classes (memory/teachings/worklogs/reports) pass freely."""
    tasks = _load_tasks()
    t = _find_task(tasks, tid)
    if not t:
        return {"error": f"no open task with id {tid}"}
    if t["status"] in ("MERGED", "REJECTED"):
        return {"error": f"#{tid} is already {t['status']}"}
    if t["status"] == "PROPOSED":
        return {"error": f"#{tid} is only PROPOSED - promote it first "
                         f"(task: promote {tid})"}
    if t["work_type"] == "protected" and not t.get("overridden"):
        has_approve = any(r.get("verdict") == "approve" for r in t.get("reviews", []))
        if not (has_approve and t.get("approvals")):
            missing = []
            if not has_approve:
                missing.append(f"an approve review (task: review {tid} approve <notes>)")
            if not t.get("approvals"):
                missing.append(f"Phil's approval (task: approve {tid})")
            return {"error": f"approval gate: #{tid} is protected - needs "
                             + " AND ".join(missing)
                             + f" before it can complete. Override: task: override {tid} (logged)."}
    _set_state(t, "MERGED", by)
    t["completed"] = time.strftime("%Y-%m-%d %H:%M")
    save_mem("tasks.json", tasks)
    # Step 12: every completed task leaves a reflection, not just agent jobs
    try:
        _append_mem("reflections.jsonl", {
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "task": f"task #{tid} merged: {t['task'][:80]}",
            "worked": f"merged through the gate ({t['work_type']}"
                      + (", overridden" if t.get("overridden") else "") + ")",
            "failed": None, "started": t.get("created"), "finished": t.get("completed"),
            "improve": "queued for weekly review", "repeat": "n/a"})
    except Exception:
        pass
    return t


def stale_tasks(days=None):
    """Tasks sitting > stale_days (ruled: 7) in one non-terminal state."""
    days = days or standing_orders().get("stale_days", 7)
    stale = []
    for t in _load_tasks():
        if t["status"] in ("MERGED", "REJECTED"):
            continue
        try:
            since = time.mktime(time.strptime(t.get("state_since", ""), "%Y-%m-%d %H:%M"))
        except Exception:
            continue
        if (time.time() - since) > days * 86400:
            stale.append(t)
    return stale


def task_overview():
    """task: list - pipeline position, gate status, stale flags, promotion queue."""
    tasks = _load_tasks()
    stale_ids = {t["id"] for t in stale_tasks()}
    open_t = [t for t in tasks if t["status"] not in ("MERGED", "REJECTED")]
    lines = []
    for t in open_t:
        marks = []
        if t["id"] in stale_ids:
            marks.append("STALE")
        if t["work_type"] == "protected":
            marks.append("protected")
        if t.get("overridden"):
            marks.append("overridden")
        mark = f" {{{', '.join(marks)}}}" if marks else ""
        gate = ""
        if t["work_type"] == "protected":
            ra = sum(1 for r in t.get("reviews", []) if r.get("verdict") == "approve")
            gate = f" [approve-reviews:{ra} approvals:{len(t.get('approvals', []))}]"
        lines.append(f"#{t['id']} [{t['status']}]{mark}{gate} {t['owner']} "
                     f"({t['priority']}): {t['task']}")
    props = sum(1 for t in open_t if t["status"] == "PROPOSED")
    head = "Open tasks:"
    if props:
        head += f" ({props} PROPOSED awaiting promotion - task: promote <id>)"
    tail = f"\n\n({len(tasks) - len(open_t)} merged/rejected)"
    if stale_ids:
        tail += f"  STALE (>7 days in one state): {len(stale_ids)} flagged"
    return head + "\n" + ("\n".join(lines) if lines else "(none)") + tail


def state_block():
    """The world state (Step 3) + memory core, compact, ALWAYS in context - my reality:
    where the project is, what is owned, what is open, what I learned the hard way."""
    ps = load_mem("project_state.json", None)
    goals = load_mem("goals.json", None)
    own = load_mem("ownership.json", None)
    agents = load_mem("agents.json", None)
    tasks = load_mem("tasks.json", [])
    parts = []
    if ps:
        parts.append("WORLD STATE: " + json.dumps(ps, ensure_ascii=False))
    if goals:
        parts.append("GOALS: " + json.dumps(goals, ensure_ascii=False)[:700])
    if own:
        parts.append("OWNERSHIP (one owner per domain): " + json.dumps(own, ensure_ascii=False)[:700])
    if agents:
        parts.append("AGENTS: " + "; ".join(
            f"{a.get('name')}={a.get('title', a.get('role', '?'))}" for a in agents)[:500])
    open_tasks = [t for t in tasks if _norm_status(t.get("status")) not in ("MERGED", "REJECTED")]
    if open_tasks:
        parts.append("OPEN TASKS: " + json.dumps(open_tasks[:8], ensure_ascii=False)[:800])
    lessons = recent_lessons(5)
    if lessons:
        parts.append("HARD LESSONS (consulted before decisions): " + " | ".join(lessons))
    dec = []
    p = MEMORY_DIR / "decisions.jsonl"
    if p.exists():
        try:
            for line in p.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        dec.append(json.loads(line))
                    except Exception:
                        continue
        except OSError:
            pass
    if dec:
        parts.append("RECENT DECISIONS: " + " | ".join(
            f"{d.get('action')}: {str(d.get('chosen', ''))[:60]} ({str(d.get('why', ''))[:60]})"
            for d in dec[-3:]))
    try:
        parts.append(metrics_line())   # Step 20 - decisions are data-informed, not felt
    except Exception:
        pass
    if not parts:
        return ""
    return ("\n\n===== MY WORLD STATE (permanent project reality - memory/ core, "
            "Steps 2/3/4) =====\n" + "\n".join(parts))


# ---- Step 5: goal hierarchy persistence (Vision -> Milestone -> Sprint -> Feature -> Task) ----

def goal_tree_text():
    g = load_mem("goals.json", {})
    if not g:
        return "(no goals yet)"
    lines = [f"VISION: {g.get('vision', '')}"]
    for i, m in enumerate(g.get("milestones", []), 1):
        lines.append(f"  M{i} [{m.get('status', '?')}] {m.get('name')}")
        for j, f in enumerate(m.get("features", []), 1):
            lines.append(f"      F{i}.{j} [{f.get('status', '?')}] {f.get('name')}")
    cur = g.get("current")
    if cur:
        lines.append(f"CURRENT: sprint={cur.get('sprint')} | task={cur.get('task')}")
    return "\n".join(lines)


def add_goal_node(kind, name, parent=None):
    g = load_mem("goals.json", {})
    if kind == "milestone":
        g.setdefault("milestones", []).append({"name": name, "status": "pending", "features": []})
    elif kind == "feature":
        try:
            m = g.get("milestones", [])[int(parent) - 1]
        except Exception:
            return False
        m.setdefault("features", []).append({"name": name, "status": "pending"})
    else:
        return False
    save_mem("goals.json", g)
    return True


# ---- Step 6: decision layer - every major action leaves a record (objective/options/chosen/why)

def record_decision(action, objective, options, chosen, why, confidence=None):
    _append_mem("decisions.jsonl", {
        "date": time.strftime("%Y-%m-%d %H:%M:%S"), "action": action,
        "objective": objective[:140], "options": [o[:60] for o in options[:6]],
        "chosen": chosen[:140], "why": why[:200], "confidence": confidence})


# ---- Step 16: file tools - read any archive file, write real reports to reports/ ----

REPORTS_DIR = BASE / "reports"
_SENSITIVE_PAT = re.compile(r"(\.env|\.pem$|\.key$|secret|credential)", re.IGNORECASE)


def access_grants():
    """Phil's ruling (22 Sep 2026): 'the ability to access any folder I want her to access on
    my desktop if I ask her to go read it.' The ask IS the grant - a read: on an outside path
    auto-grants it persistently (logged as a decision). access: grant/revoke/list manages the
    list by hand."""
    return load_mem("access.json", [])


def access_grant(path, by="Phil"):
    import os
    grants = access_grants()
    p = os.path.normpath(str(path))
    if p not in grants:
        grants.append(p)
        save_mem("access.json", grants)
        record_decision("access_grant", path, ["grant", "deny"], p,
                        f"{by} asked her to read it")
    return grants


def access_revoke(path):
    import os
    p = os.path.normpath(str(path))
    grants = [g for g in access_grants() if g != p]
    save_mem("access.json", grants)
    return grants


def _path_allowed(p):
    """archive is always allowed; outside paths need a grant (exact or parent)."""
    import os
    ps = os.path.normpath(str(p))
    arch = os.path.normpath(str(ARCHIVE))
    if ps == arch or ps.startswith(arch + os.sep):
        return True, None
    for g in access_grants():
        if ps == g or ps.startswith(g + os.sep):
            return True, None
    return False, ps


def read_file_cmd(rel):
    """Read Files, literally: one exact document, verbatim, bounded. Archive paths always
    allowed; outside paths auto-grant on Phil's explicit ask (his ruling). Folders return a
    listing; sensitive names are refused everywhere."""
    import os
    rel = rel.strip().strip('"')
    if _SENSITIVE_PAT.search(rel):
        return "(refused - sensitive file pattern)"
    raw = rel
    if not os.path.isabs(rel):
        p = (ARCHIVE / rel).resolve()
    else:
        p = Path(rel).resolve()
    allowed, ps = _path_allowed(p)
    auto = ""
    if not allowed:
        # Phil explicitly asked in this message - the ask grants (his ruling, 22 Sep 2026)
        access_grant(ps, by="Phil's read: request")
        auto = " [auto-granted - manage with access: grant/revoke/list]"
    try:
        if p.is_dir():
            entries = []
            for child in sorted(p.iterdir())[:50]:
                try:
                    entries.append(child.name + ("/" if child.is_dir() else
                                                 f" ({child.stat().st_size}B)"))
                except OSError:
                    entries.append(child.name)
            more = len(list(p.iterdir())) - 50
            head = f"[{raw} - folder listing{auto}]\n"
            return head + "\n".join(entries) + (f"\n... (+{more} more)" if more > 0 else "")
        if not p.is_file():
            return f"(not found: {raw})"
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        return f"(could not read: {e})"
    head = f"[{raw} - first 8000 of {len(text)} chars{auto}]\n"
    return head + text[:8000]


def write_report(topic):
    """Write Reports / Create Documentation: a structured, cited markdown report compiled
    from retrieval + world state, saved to reports/ where Phil can open it."""
    hits = search(topic, k=10, n_files=5)
    if not hits:
        return None
    ctx_text, sources, _img = _assemble(hits, topic)
    prompt = (f"{SYSTEM}{thinking_block()}{state_block()}\n\n===== EXCERPTS =====\n{ctx_text}\n\n"
              f"Write a structured markdown REPORT on: {topic}\n\n"
              "Sections: ## Summary (3 sentences max) / ## Key Facts (every claim cited "
              "[file]) / ## Analysis (labeled inference where the archive is silent) / "
              "## Open Questions / ## Recommended Actions (numbered, ONE owner per step).")
    out = generate(prompt, {"answer": ""}, temperature=0.3)
    text = (out.get("answer") or "").strip()
    if not text:
        return None
    try:
        REPORTS_DIR.mkdir(exist_ok=True)
        fname = time.strftime("%Y-%m-%d ") + re.sub(r"[^\w\- ]+", "", topic)[:60].strip() + ".md"
        srcs = ", ".join(s["file"] for s in sources[:5])
        (REPORTS_DIR / fname).write_text(
            f"# Report: {topic}\n\n_Generated {time.strftime('%Y-%m-%d %H:%M')} · "
            f"sources: {srcs}_\n\n{text}\n", encoding="utf-8")
        return REPORTS_DIR / fname
    except OSError:
        return None


def daily_report():
    """Step 18 - the daily digest: health, today's movement, pipeline, risks. Compiled
    from her own logs (metrics, task history, reflections, decisions, failures,
    proposals) - no model pass - and filed in reports/ as '<date> daily.md'."""
    today = time.strftime("%Y-%m-%d")
    m = metrics_summary()
    tasks = _load_tasks()

    moved, created_t, merged_t = [], [], []
    for t in tasks:
        if (t.get("created") or "").startswith(today):
            created_t.append(t)
        if (t.get("completed") or "").startswith(today):
            merged_t.append(t)
        for h in t.get("history", []):
            if (h.get("at") or "").startswith(today):
                moved.append(f"#{t['id']}->{h['state']}")

    jobs_ok = jobs_failed = 0
    rp = MEMORY_DIR / "reflections.jsonl"
    if rp.exists():
        try:
            for line in rp.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        r = json.loads(line)
                    except Exception:
                        continue
                    if (r.get("date") or "").startswith(today):
                        if r.get("worked"):
                            jobs_ok += 1
                        if r.get("failed"):
                            jobs_failed += 1
        except OSError:
            pass

    dec_by_action = {}
    dp = MEMORY_DIR / "decisions.jsonl"
    if dp.exists():
        try:
            for line in dp.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        d = json.loads(line)
                    except Exception:
                        continue
                    if (d.get("date") or "").startswith(today):
                        a = d.get("action", "?")
                        dec_by_action[a] = dec_by_action.get(a, 0) + 1
        except OSError:
            pass

    fails_today = []
    if FAILURES_FILE.exists():
        try:
            for line in FAILURES_FILE.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        f = json.loads(line)
                    except Exception:
                        continue
                    if (f.get("date") or "").startswith(today):
                        fails_today.append(f)
        except OSError:
            pass

    props_logged_today = 0
    pp = MEMORY_DIR / "proposals.jsonl"
    if pp.exists():
        try:
            for line in pp.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        p = json.loads(line)
                    except Exception:
                        continue
                    if (p.get("date") or "").startswith(today):
                        props_logged_today += 1
        except OSError:
            pass

    stale = stale_tasks()
    open_t = [t for t in tasks if t["status"] not in ("MERGED", "REJECTED")]
    props_open = [t for t in open_t if t["status"] == "PROPOSED"]
    by_state = {}
    for t in open_t:
        by_state[t["status"]] = by_state.get(t["status"], 0) + 1

    tr = f"{m['score_trend']:+.3f}" if m["score_trend"] is not None else "n/a"
    L = [f"# EMBERWEAVE BRAIN - DAILY REPORT\n\n## {today}\n",
         "## Health\n",
         f"- scored answers on record: {m['questions']} "
         f"(avg retrieval match {m['avg_score']}, trend {tr})",
         f"- refusal rate: {m['refusal_rate']:.0%} | failures on record: {m['failures']}",
         f"- decisions on record: {m['decisions']}",
         "",
         "## Today\n",
         f"- tasks created: {len(created_t)} | merged: {len(merged_t)} | "
         f"proposals logged: {props_logged_today}",
         f"- state transitions: {len(moved)}" + (" - " + "; ".join(moved[:8]) if moved else ""),
         f"- agent jobs: {jobs_ok} ok / {jobs_failed} failed",
         "- decisions today: " + (", ".join(f"{k} x{v}" for k, v in
                                  sorted(dec_by_action.items())) or "none"),
         f"- failures today: {len(fails_today)}" + ("" if not fails_today else
          " - " + "; ".join(f["task"][:60] for f in fails_today[:3])),
         "",
         "## Pipeline\n",
         f"- open tasks: {len(open_t)} (" +
         (", ".join(f"{k}:{v}" for k, v in sorted(by_state.items())) or "none") + ")",
         f"- proposals awaiting promotion: {len(props_open)}",
         f"- stale tasks (>7 days in one state): {len(stale)}" +
         ("" if not stale else " - " + ", ".join(f"#{t['id']}" for t in stale)),
         "",
         "## Risks\n"]
    risks = []
    if stale:
        risks.append(f"{len(stale)} stale task(s): " +
                     ", ".join(f"#{t['id']} ({t['status']})" for t in stale[:5]))
    if jobs_failed:
        risks.append(f"{jobs_failed} agent job(s) failed today")
    if m["refusal_rate"] > 0.2 and m["questions"] >= 5:
        risks.append(f"refusal rate elevated: {m['refusal_rate']:.0%}")
    blocked = [t for t in open_t if t["status"] == "BLOCKED"]
    if blocked:
        risks.append(f"{len(blocked)} blocked task(s): " +
                     ", ".join(f"#{t['id']}" for t in blocked))
    L.append("\n".join(f"- {r}" for r in risks) if risks else "- none flagged")
    L += ["",
          "## Watch tomorrow\n"]
    oldest = sorted(open_t, key=lambda t: t.get("created") or "")[:3]
    if oldest:
        L.append("- oldest open: " + "; ".join(f"#{t['id']} {t['task'][:50]}" for t in oldest))
    if props_open:
        L.append(f"- {len(props_open)} proposal(s) need Phil's promotion")
    if not oldest and not props_open:
        L.append("- queue clear")
    try:
        REPORTS_DIR.mkdir(exist_ok=True)
        path = REPORTS_DIR / f"{today} daily.md"
        path.write_text("\n".join(L) + "\n", encoding="utf-8")
    except OSError:
        return None
    record_decision("daily_report", today, ["compile digest", "skip"],
                    "compiled", "Step 18 automatic reporting")
    return path


def _file_report(fname, lines):
    try:
        REPORTS_DIR.mkdir(exist_ok=True)
        path = REPORTS_DIR / fname
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        record_decision("report", fname, ["compile", "skip"], "compiled",
                        "Step 18 reporting")
        return path
    except OSError:
        return None


def sprint_report():
    """Step 18 - Sprint report: the sprint against the goal tree + task flow."""
    ps = load_mem("project_state.json", {}) or {}
    goals = load_mem("goals.json", {}) or {}
    tasks = _load_tasks()
    sprint = ps.get("current_sprint") or (goals.get("current") or {}).get("sprint", "?")
    L = [f"# EMBERWEAVE BRAIN - SPRINT REPORT\n\n## sprint: {sprint}\n",
         f"_world state updated: {ps.get('updated', '?')}_\n",
         "## Goal tree\n"]
    for mo in goals.get("milestones", []):
        L.append(f"- [{mo.get('status', '?')}] {mo.get('name', '?')}")
        for f in mo.get("features", []):
            L.append(f"  - [{f.get('status', '?')}] {f.get('name', '?')}")
    open_t = [t for t in tasks if t["status"] not in ("MERGED", "REJECTED")]
    merged = [t for t in tasks if t["status"] == "MERGED"]
    L += ["", "## Task flow (all time)", "",
          f"- merged: {len(merged)} | open: {len(open_t)} | stale: {len(stale_tasks())}",
          "", "## Open tasks\n"]
    L += ([f"- #{t['id']} [{t['status']}] {t['owner']}: {t['task'][:70]}"
           for t in open_t] or ["- none"])
    return _file_report(time.strftime("%Y-%m-%d ") + "sprint.md", L)


def risk_report():
    """Step 18 - Risk report: every open risk, standalone."""
    tasks = _load_tasks()
    stale = stale_tasks()
    open_t = [t for t in tasks if t["status"] not in ("MERGED", "REJECTED")]
    blocked = [t for t in open_t if t["status"] == "BLOCKED"]
    props = [t for t in open_t if t["status"] == "PROPOSED"]
    m = metrics_summary()
    jobs_failed = 0
    rp = MEMORY_DIR / "reflections.jsonl"
    if rp.exists():
        try:
            for line in rp.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        if json.loads(line).get("failed"):
                            jobs_failed += 1
                    except Exception:
                        continue
        except OSError:
            pass
    risks = []
    if stale:
        risks.append(("stale tasks (>7 days)",
                      ", ".join(f"#{t['id']} ({t['status']})" for t in stale)))
    if blocked:
        risks.append(("blocked tasks", ", ".join(f"#{t['id']}" for t in blocked)))
    if props:
        risks.append(("proposals waiting on Phil",
                      ", ".join(f"#{t['id']}" for t in props)))
    if jobs_failed:
        risks.append(("failed agent jobs on record", str(jobs_failed)))
    if m["refusal_rate"] > 0.2 and m["questions"] >= 5:
        risks.append(("elevated refusal rate",
                      f"{m['refusal_rate']:.0%} of {m['questions']} answers"))
    L = [f"# EMBERWEAVE BRAIN - RISK REPORT\n\n## {time.strftime('%Y-%m-%d')}\n",
         "## Risks\n"]
    L += [f"- **{k}**: {v}" for k, v in risks] or ["- none flagged"]
    return _file_report(time.strftime("%Y-%m-%d ") + "risk.md", L)


def progress_report():
    """Step 18 - Progress report: trajectory over time, not just today."""
    m = metrics_summary()
    goals = load_mem("goals.json", {}) or {}
    tasks = _load_tasks()
    ms = goals.get("milestones", [])
    done_m = sum(1 for x in ms if x.get("status") == "done")
    total_f = sum(len(x.get("features", [])) for x in ms)
    done_f = sum(1 for x in ms for f in x.get("features", [])
                 if f.get("status") == "done")
    tr = f"{m['score_trend']:+.3f}" if m["score_trend"] is not None else "n/a"
    merged = sum(1 for t in tasks if t["status"] == "MERGED")
    rejected = sum(1 for t in tasks if t["status"] == "REJECTED")
    L = [f"# EMBERWEAVE BRAIN - PROGRESS REPORT\n\n## {time.strftime('%Y-%m-%d')}\n",
         "## Trajectory\n",
         f"- answer quality: avg match {m['avg_score']} over {m['questions']} scored "
         f"answers (2nd-half vs 1st-half trend {tr})",
         f"- refusal rate: {m['refusal_rate']:.0%} | failures: {m['failures']} | "
         f"decisions: {m['decisions']}",
         "",
         "## Goal tree progress\n",
         f"- milestones done: {done_m}/{len(ms)}",
         f"- features done: {done_f}/{total_f}",
         "",
         "## Work throughput\n",
         f"- tasks merged: {merged} | rejected: {rejected} | open: {m['tasks_open']} "
         f"(stale: {m['tasks_stale']})",
         f"- agent jobs: {m['agent_jobs_ok']} ok / {m['agent_jobs_failed']} failed",
         "",
         "_Use: compare against the last progress report - trend lines matter more "
         "than single numbers._"]
    return _file_report(time.strftime("%Y-%m-%d ") + "progress.md", L)


def agent_report():
    """Step 18 - Agent report: specialists, task load by owner, worker outcomes."""
    agents = load_mem("agents.json", [])
    tasks = _load_tasks()
    refs = []
    rp = MEMORY_DIR / "reflections.jsonl"
    if rp.exists():
        try:
            for line in rp.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        refs.append(json.loads(line))
                    except Exception:
                        continue
        except OSError:
            pass
    L = [f"# EMBERWEAVE BRAIN - AGENT REPORT\n\n## {time.strftime('%Y-%m-%d')}\n",
         "## Specialists (registry)\n"]
    for a in agents:
        owns = ", ".join(a.get("owns", [])) or "-"
        L.append(f"- **{a.get('name')}** - {a.get('title', '?')}: owns {owns} "
                 f"(authority: {a.get('authority', '?')})")
    L += ["", "## Task load by owner\n"]
    by_owner = {}
    for t in tasks:
        by_owner.setdefault(t["owner"], []).append(t)
    for owner, ts in sorted(by_owner.items()):
        open_n = sum(1 for t in ts if t["status"] not in ("MERGED", "REJECTED"))
        merged_n = sum(1 for t in ts if t["status"] == "MERGED")
        L.append(f"- {owner}: {merged_n} merged / {open_n} open")
    L += ["", "## Worker jobs (reflections on record)\n",
          f"- total: {len(refs)} | ok: {sum(1 for r in refs if r.get('worked'))} | "
          f"failed: {sum(1 for r in refs if r.get('failed'))}",
          "", "_Worker detail: dig/probe/stats jobs write reflections; task merges do "
          "too (Step 12)._"]
    return _file_report(time.strftime("%Y-%m-%d ") + "agent.md", L)


# ---- Phil's ruling (22 Sep 2026): she fixes her own brain when he asks ----
# Self-repair: the model proposes minimal SEARCH/REPLACE anchors from located code
# excerpts; this code applies them mechanically - exact-once match, backup, syntax
# gate with auto-revert, boot-crash auto-rollback (app.py), then she restarts herself.
# Whitelisted: her own code files only. Never the archive, never anywhere else.

SELF_EDIT_FILES = ("brain.py", "app.py", "agents.py", "ui.html")
SELFEDIT_DIR = BASE / "selfedits"


def _flexible_match(text, anchor):
    """Unique match allowing whitespace-run and typographic-char differences
    (… vs ..., curly vs straight quotes, dashes). Returns the TRUE matched file
    text so the caller replaces the real span - only a unique match counts."""
    def flex(s):
        out, i = [], 0
        while i < len(s):
            c = s[i]
            if c.isspace():
                out.append(r"\s+")
                while i < len(s) and s[i].isspace():
                    i += 1
                continue
            if c == "…":
                out.append(r"(?:…|\.\.\.)")
            elif s[i:i + 3] == "...":
                out.append(r"(?:\.\.\.|…)")
                i += 2
            elif c in "“”":
                out.append(r"[\"“”]")
            elif c in "‘’":
                out.append(r"['‘’]")
            elif c in "—–":
                out.append(r"[—–-]{1,2}")
            else:
                out.append(re.escape(c))
            i += 1
        return "".join(out)
    try:
        rx = re.compile(flex(anchor))
    except re.error:
        return None
    matches = list(rx.finditer(text))
    if len(matches) == 1:
        return matches[0].group(0)
    return None


def apply_self_edit(filename, old, new, by="Phil's fix: request"):
    """One exact-match edit to a whitelisted file: backup -> write -> syntax gate
    (auto-revert on failure) -> decision log."""
    import shutil
    import py_compile
    if filename not in SELF_EDIT_FILES:
        return {"error": f"'{filename}' is not mine to edit - whitelisted: "
                         + ", ".join(SELF_EDIT_FILES)}
    path = BASE / filename
    if not path.exists():
        return {"error": f"{filename} not found in my folder"}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as e:
        return {"error": f"could not read {filename}: {e}"}
    n = text.count(old)
    if n != 1:
        # The model may have mangled whitespace or typographic chars in the
        # anchor - fall back to a tolerant unique-match before refusing.
        true_text = _flexible_match(text, old)
        if true_text:
            old = true_text
            n = 1
        else:
            return {"error": f"anchor matched {n} times in {filename} (must be exactly 1) - no edit made"}
    backup = None
    try:
        SELFEDIT_DIR.mkdir(exist_ok=True)
        backup = SELFEDIT_DIR / (time.strftime("%Y%m%d-%H%M%S") + "-" + filename)
        shutil.copy2(path, backup)
        path.write_text(text.replace(old, new, 1), encoding="utf-8")
        if filename.endswith(".py"):
            py_compile.compile(str(path), doraise=True)
    except py_compile.PyCompileError as e:
        shutil.copy2(backup, path)   # auto-revert
        return {"error": f"syntax check failed in {filename} - edit auto-reverted. {str(e)[:180]}"}
    except OSError as e:
        return {"error": f"write failed: {e}"}
    record_decision("self_edit", f"{filename}: {old[:70]!r} -> {new[:70]!r}",
                    ["apply", "refuse"], "apply",
                    f"{by}; backup selfedits/{backup.name}")
    return {"ok": True, "file": filename, "backup": backup.name}


def find_code_context(what, budget=9000):
    """Locate the parts of her own code relevant to a fix request: score the
    whitelisted files by keyword overlap, return bounded excerpts around the hits.
    Line numbers are prefixed 'NNN: ' for reference - NOT part of the file."""
    words = [w for w in re.findall(r"[a-zA-Z_]{4,}", what)]
    what_low = what.lower()
    scores = {}
    for fn in SELF_EDIT_FILES:
        p = BASE / fn
        if not p.exists():
            continue
        try:
            lines = p.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        hit_lines, score = set(), 0
        for i, line in enumerate(lines):
            low = line.lower()
            for w in words:
                if w.lower() in low:
                    score += 1
                    hit_lines.add(i)
        if fn.lower() in what_low:
            score += 1000  # Phil named this file explicitly - it is the target
        if score:
            scores[fn] = (score, lines, hit_lines)
    if not scores:
        return ""
    # How common is each keyword across her code? Rare words ("placeholder")
    # identify the target far better than common ones ("html", "input").
    word_freq = {}
    for fn, (_score, lines, _hits) in scores.items():
        for i, line in enumerate(lines):
            low = line.lower()
            for w in words:
                if w.lower() in low:
                    word_freq[w] = word_freq.get(w, 0) + 1
    out, used = [], 0
    top = sorted(scores.items(), key=lambda kv: -kv[1][0])[:2]
    per_file = budget // max(1, len(top))
    for fn, (score, lines, hit_lines) in top:
        # Rank hit lines by rare-keyword density so the most relevant lines
        # survive truncation (file order buries a single good match in noise).
        def density(i):
            low = lines[i].lower()
            return sum(1.0 / max(1, word_freq.get(w, 1))
                       for w in words if w.lower() in low)
        best_hits = sorted(hit_lines, key=density, reverse=True)[:40]
        # Emit regions in DENSITY order (best hit first), not file order, so a
        # single high-value match is never cut by the budget.
        excerpt, emitted, seen_any = [], set(), False
        for i in best_hits:
            region = [j for j in range(max(0, i - 10), min(len(lines), i + 10))
                      if j not in emitted]
            if not region:
                continue
            if seen_any:
                excerpt.append("  ...")
            for j in region:
                excerpt.append(f"{j+1}: {lines[j]}")
                emitted.add(j)
            seen_any = True
            if sum(len(e) for e in excerpt) > per_file - 400:
                excerpt.append("  ... (truncated: more matches below)")
                break
        block = f"===== {fn} ({score} keyword hits) =====\n" + "\n".join(excerpt)
        # Never drop a scored file entirely - truncate to its share of the budget.
        if len(block) > per_file:
            block = block[:per_file] + "\n  ... (truncated)"
        out.append(block)
        used += len(block)
    return "\n\n".join(out)


FIX_SYS = """You are the EMBERWEAVE BRAIN repairing your OWN code at Phil's explicit request.
You get excerpts of your code and Phil's instruction. Produce the MINIMAL edit as JSON:
{"edits": [{"file": "<one of the files shown>", "search": "<exact existing text>",
"replace": "<new text>"}], "cannot_locate": ""}
Rules: smallest possible change; keep "search" as short as possible (1-3 lines) but
unique in the file; search text copied EXACTLY as in the file (indentation
included - the 'NNN: ' prefixes are line numbers, NOT file content); only edit files you
were shown; if the excerpts lack what the instruction needs, return cannot_locate with a
one-line reason and an empty edits list. JSON only, no prose."""


# ---- Step 19: goal tracking continuity - milestones/features move status over time ----

def set_goal_status(ref, status):
    """goal: status <milestone#|milestone.feature#> <status> - keep the tree honest as
    work progresses (Vision/Roadmap/Milestones/Sprint/Task maintained continuously)."""
    g = load_mem("goals.json", {})
    try:
        if "." in ref:
            mi, fi = ref.split(".", 1)
            g["milestones"][int(mi) - 1]["features"][int(fi) - 1]["status"] = status
        else:
            g["milestones"][int(ref) - 1]["status"] = status
    except Exception:
        return False
    save_mem("goals.json", g)
    return True


# ---- Step 20: self-improvement metrics - measured, not felt; injected so decisions use data ----

def metrics_summary():
    scores = []
    p = BASE / "scores.jsonl"
    if p.exists():
        try:
            for line in p.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        scores.append(json.loads(line))
                    except Exception:
                        continue
        except OSError:
            pass
    qs = len(scores)
    avg = round(sum(s.get("score", 0) for s in scores) / qs, 3) if qs else 0.0
    trend = None
    half = qs // 2
    if half >= 3:
        first = sum(s.get("score", 0) for s in scores[:half]) / half
        second = sum(s.get("score", 0) for s in scores[half:]) / (qs - half)
        trend = round(second - first, 3)
    fails = 0
    if FAILURES_FILE.exists():
        try:
            fails = sum(1 for l in FAILURES_FILE.read_text(encoding="utf-8").splitlines()
                        if l.strip())
        except OSError:
            pass
    tasks = _load_tasks()
    open_t = sum(1 for t in tasks if t["status"] not in ("MERGED", "REJECTED"))
    stale_n = len(stale_tasks())
    refs = []
    rp = MEMORY_DIR / "reflections.jsonl"
    if rp.exists():
        try:
            for line in rp.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        refs.append(json.loads(line))
                    except Exception:
                        continue
        except OSError:
            pass
    dec = 0
    dp = MEMORY_DIR / "decisions.jsonl"
    if dp.exists():
        try:
            dec = sum(1 for l in dp.read_text(encoding="utf-8").splitlines() if l.strip())
        except OSError:
            pass
    return {"questions": qs, "avg_score": avg, "score_trend": trend,
            "failures": fails, "refusal_rate": round(fails / qs, 2) if qs else 0.0,
            "tasks_open": open_t, "tasks_done": len(tasks) - open_t,
            "tasks_stale": stale_n,
            "agent_jobs_ok": sum(1 for r in refs if r.get("worked")),
            "agent_jobs_failed": sum(1 for r in refs if r.get("failed")),
            "decisions": dec}


def metrics_line():
    """One compact line for state_block - data-informed decisions (Step 20's 'use data')."""
    m = metrics_summary()
    tr = f"{m['score_trend']:+.3f}" if m["score_trend"] is not None else "n/a"
    return (f"METRICS: {m['questions']} scored answers, avg match {m['avg_score']} "
            f"(trend {tr}), refusal rate {m['refusal_rate']:.0%}, tasks {m['tasks_done']} done / "
            f"{m['tasks_open']} open ({m['tasks_stale']} stale), agent jobs {m['agent_jobs_ok']} ok / "
            f"{m['agent_jobs_failed']} failed, {m['decisions']} decisions on record")

HELP_TEXT = """EMBERWEAVE BRAIN - what I understand:

  (plain question)     answer from the archive, with citations
  compare X and Y      two-pass retrieval - both sides get their own context
  remember: ...        store a permanent teaching (your teachings outrank the archive)
  how to: ...          store a procedure I'll apply when relevant
  reason: ...          two-pass analysis - draft, then skeptical critique, with a
                       draft/final agreement score disclosed at the end
  plan: ...            execution plan with owners (BRAIN/CLAUDE/GROK/PHIL); BRAIN
                       steps are executed immediately; stale citations get flagged
  fetch: <url> ...     read a web page and answer from it
  agent: dig <topic>   dispatch a worker to deep-read every doc behind a topic
  agent: probe         dispatch my retrieval regression battery (health score)
  agent: stats         dispatch an index + learning health report
  agent: status        what my worker agents are doing right now
  state:              show my world state (phase, sprint, active tasks)
  state: phase=X ...   update my world state (keys: project, vision, phase,
                       current_sprint, active_tasks=a,b)
  goal:               show the goal tree (vision -> milestones -> features)
  goal: add milestone <name>          add a milestone to the tree
  goal: add feature <milestone#> <name>   add a feature under a milestone
  goal: status <#|#.#> <status>      move a milestone/feature status (e.g. done)
  report: <topic>     compile a cited markdown report into my reports/ folder.
                      Fixed types: daily / sprint / risk / progress / agent
  report: daily       same as daily: - file today's digest
  daily:              compile + file my daily report (health, movement, pipeline,
                      risks) and show it here; the heartbeat files it automatically
                      at the first beat of each day when it is ON
  fix: <what to fix>  repair my OWN code (brain.py/app.py/agents.py/ui.html) when
                      Phil asks - backup, syntax gate, auto-revert, self-restart
  fix: rollback       restore my newest self-edit backups and restart
  read: <archive path>  read one exact archive document, verbatim
  metrics:            my self-improvement numbers (Step 20)
  task: list           open tasks (pipeline state, gate status, stale flags)
  task: add <owner> <high|medium|low> <what>   assign work (one owner, Rule 3)
  task: propose <owner> <pri> <what>   queue a proposal (PROPOSED, never auto-assigned)
  task: promote <id>   PROPOSED -> ASSIGNED (Phil; I self-promote research/dig only)
  task: state <id> <IN_PROGRESS|IN_REVIEW|BLOCKED|CHANGES_REQUESTED|ASSIGNED>
  task: review <id> <approve|changes_requested|reject> <notes>   record a verdict
  task: approve <id>   Phil's approval -> APPROVED (protected tasks need a review first)
  task: note <id> <text>   interface note for cross-department work (attach at IN_REVIEW)
  task: exempt <id>    Phil rules it exempt from the gate (standing orders class)
  task: override <id>  Phil bypasses the approval gate (logged as a decision)
  task: done <id>      MERGE a task - protected tasks must pass the approval gate
  success: ...         record a win as a best practice (success memory)
  yes                  right after I flag a correction, stores it as a teaching
  help                 this list

I can also see images you paste (vision model), and I show archive art when the
docs I read reference it. What I will NOT do: invent design and present it as
archive fact - if nothing relevant exists, I say so, then reason from first
principles clearly labeled as inference."""

def help_answer():
    return {"answer": HELP_TEXT, "sources": [], "images": [], "model": MODEL, "kind": "meta"}

def teach(text, kind="fact"):
    entry = {"t": time.strftime("%Y-%m-%d %H:%M"), "kind": kind, "text": text.strip()}
    with open(TEACHINGS_FILE, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry

META_PAT = re.compile(r"\b(can you|do you|how do you|what are you|who are you|yourself|your memory|"
                      r"how does this work|how do you work|are you (an ai|alive|conscious)|"
                      r"what can you do|tell me about you)\b", re.IGNORECASE)

# CASUAL PATH (Phil, 22 Sep 2026): greetings and small talk are CONVERSATION, not
# archive queries. A "hey emberweave" must never hit the foreign-topic gate, the
# dig agent, or the "archive doesn't cover this" boilerplate - she just talks.
CASUAL_PAT = re.compile(
    r"^\s*(hey|hi|hello|yo|sup|hiya|howdy|morning|good (morning|afternoon|evening|night)|"
    r"thanks|thank you|thx|bye|goodbye|goodnight|see ya|later|"
    r"how are you|how's it going|hows it going|what's up|whats up|"
    r"lol|lmao|haha+|ok(ay)?|sure|yep|nope|yes|no|nice|cool|great|awesome|"
    r"got it|understood|makes sense|well done|good job|"
    r"try|say|give me|show me|another|one more|again|repeat|do that|come on|"
    r"you'?re|you are|that was|don'?t be|remember)\b", re.IGNORECASE)

# Phil correcting her in plain chat ("no,", "that's wrong", "actually...").
# She can't learn silently - but she SHOULD recognize the moment and offer the
# remember: bridge, instead of letting the correction evaporate.
CORRECTION_PAT = re.compile(
    r"^\s*(no([\s,.!]|$)|nope\b|wrong\b|incorrect\b|that'?s (wrong|incorrect|not (right|correct))|"
    r"that'?s not how|actually[\s,.]|you'?re wrong|not quite)", re.IGNORECASE)

CORRECTION_NUDGE = ("\n\n*(That sounded like a correction. Say \"yes\" and I'll store your "
                    "message as a teaching - your teachings outrank the archive. "
                    "Or phrase it yourself with \"remember: ...\".)*")

# one-word confirm that stores a pending correction (item 2b)
CONFIRM_PAT = re.compile(r"^\s*(yes|yes!|yeah|yep|yup|do it|store it|remember it|ok|okay)[.!]?\s*$",
                         re.IGNORECASE)

def is_correction(text):
    return bool(CORRECTION_PAT.search(text))

def is_confirm(text):
    return bool(CONFIRM_PAT.search(text))

_fresh = {"chunks": None, "matrix": None, "vectorizer": None, "emb": None}

EMBED_MODEL = "nomic-embed-text"
EMBED_API = "http://localhost:11434/api/embed"

def load():
    if _fresh["chunks"] is None:
        with open(INDEX_DIR / "vectorizer.pkl", "rb") as fh:
            _fresh["vectorizer"] = pickle.load(fh)
        _fresh["matrix"] = sp.load_npz(INDEX_DIR / "matrix.npz")
        # measured 22 Sep: warm jsonl parse is 1.2s, pickle of 23k text dicts is 3.9s
        # (slower!). Boot cost is cold OneDrive disk reads, not parse format.
        chunks = []
        with open(INDEX_DIR / "chunks.jsonl", encoding="utf-8") as fh:
            for line in fh:
                chunks.append(json.loads(line))
        _fresh["chunks"] = chunks
        emb_path = INDEX_DIR / "embeddings.npy"
        # mmap: skip the 72MB eager read at boot - pages load on first search instead
        _fresh["emb"] = np.load(emb_path, mmap_mode="r") if emb_path.exists() else None
    return _fresh["vectorizer"], _fresh["matrix"], _fresh["chunks"]

def reload_index():
    _fresh["chunks"] = None
    return load()

def embed_query(text):
    payload = json.dumps({"model": EMBED_MODEL, "input": [text]}).encode()
    req = urllib.request.Request(EMBED_API, data=payload,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    v = np.asarray(data["embeddings"][0], dtype=np.float32)
    return v / (np.linalg.norm(v) + 1e-9)

def search(query, k=32, per_file=4, n_files=8):
    vec, matrix, chunks = load()
    q = vec.transform([query])
    tf = (matrix @ q.T).toarray().ravel()
    tf = tf / (tf.max() + 1e-9)
    if _fresh["emb"] is not None:
        try:
            qe = embed_query(query)
            em = _fresh["emb"] @ qe          # cosine (both L2-normalized)
            scores = 0.7 * em + 0.3 * tf     # semantics lead, keywords break ties
        except Exception:
            scores = tf
    else:
        scores = tf
    # rare query tokens (high idf) - chunks OR FILENAMES containing them get a boost,
    # so e.g. Greatbrow's board table outranks the generic Gold+2 glyph list, and
    # "22 - EMBERDRAFT - design.md" outranks protocol docs when asked about Emberdraft
    q_tokens = [t for t in str(query).lower().split() if t.isalnum()]
    rare = set()
    for t in q_tokens:
        if t in vec.vocabulary_ and vec.idf_[vec.vocabulary_[t]] >= 4.0:
            rare.add(t)
    # bigram anchoring - ONLY for no-rare-token queries (the drift class). An adjacent
    # pair like "chapter 3" is far more distinctive than either word alone. Measured
    # 03:15: applying it globally broke the arena probe (bigram 'ranking rewards' lifted
    # Bulletin Board over the Arena doc), so it is gated behind `not rare`.
    bigrams = []
    if not rare:
        for a, b in zip(q_tokens, q_tokens[1:]):
            if a in vec.vocabulary_ and b in vec.vocabulary_:
                if vec.idf_[vec.vocabulary_[a]] >= 2.5 or vec.idf_[vec.vocabulary_[b]] >= 2.5:
                    bigrams.append(f"{a} {b}")
    bonus = np.zeros(len(chunks))
    if rare or bigrams:
        for i in range(len(chunks)):
            hay = chunks[i]["file"].lower() + "\n" + chunks[i]["text"].lower()
            if any(r in hay for r in rare):
                bonus[i] += 0.2
            if any(bg in hay for bg in bigrams):
                bonus[i] += 0.3
    # tier-named questions ("purple +2") - chunks CONTAINING that tier's rows get a
    # hard boost, so the right table row can't be drowned by prose about the hero.
    # CO-OCCURRENCE: a chunk holding BOTH a rare query token and the tier string is
    # the exact table the question means (the Greatbrow gold+2 row) - tables score
    # ~0.06 cosine (pipes aren't prose), so without this the encyclopedia drowns
    # below art-prompt and chatlog files that merely mention the hero densely.
    tb = np.zeros(len(chunks))
    tm = TIER_PAT.search(str(query))
    tier_s = (tm.group(1) + " +" + tm.group(2)).lower() if tm else None
    # a tier written as an actual markdown table ROW ("| **Gold +2** | ...") marks
    # the canonical table; prose merely mentioning the tier is history/commentary
    tier_row_pat = (re.compile(r"\|\s*\*{0,2}" + re.escape(tier_s) + r"\*{0,2}\s*\|", re.IGNORECASE)
                    if tier_s else None)
    for i in range(len(chunks)):
        if tier_s and tier_s in chunks[i]["text"].lower():
            tb[i] = 0.25
            if any(r in chunks[i]["text"].lower() for r in rare):
                tb[i] += 0.45   # subject + tier together = the exact table row
            if (tier_row_pat and tier_row_pat.search(chunks[i]["text"])
                    and "worklog" not in chunks[i]["file"].lower()
                    and "backup" not in chunks[i]["file"].lower()):
                tb[i] += 0.2    # the canonical table beats prose quoting its answer -
                                # history quoting the row verbatim must not get this boost
    adj = scores + bonus + tb
    # source-type weighting: canon beats history beats snapshots. A worklog quoting
    # the settled answer in prose must not outrank the canonical table it quotes
    # (measured 22 Sep: worklog chunk 1.62 vs encyclopedia's own table 1.14).
    for i in range(len(chunks)):
        fl = chunks[i]["file"].lower()
        if "worklog" in fl:
            adj[i] *= 0.8
        elif "backup" in fl:
            adj[i] *= 0.88
    order = np.argsort(adj)[::-1]
    # rank FILES by their single best chunk, then take each top file's best
    # chunks for this query - guarantees a subject file (e.g. the glyph
    # encyclopedia) contributes its most on-point section, not just its
    # globally-popular one.
    def rank_key(i):
        return float(adj[i])
    best_file_score = {}
    for i in order:
        f = chunks[i]["file"]
        if f not in best_file_score:
            best_file_score[f] = float(adj[i])
        if len(best_file_score) >= 80:
            break
    top_files = sorted(best_file_score, key=best_file_score.get, reverse=True)[:n_files]
    by_file = {}
    for i in order:
        by_file.setdefault(chunks[i]["file"], []).append(i)
    picks = []
    for f in top_files:
        fi = sorted(by_file[f], key=rank_key, reverse=True)
        for i in fi[:per_file]:
            picks.append((chunks[i], float(adj[i])))
        if len(picks) >= k:
            break
    return picks[:k]

TIER_PAT = re.compile(r"\b(grey|green|blue|purple|gold|orange)\s*\+\s*(\d)\b", re.IGNORECASE)

# words too common to count as content when judging whether a question is foreign
_STOPWORDS = {"the", "and", "for", "with", "what", "who", "where", "when", "why", "how", "does",
              "did", "are", "was", "were", "is", "can", "could", "should", "would", "you", "your",
              "his", "her", "its", "this", "that", "these", "those", "about", "from", "have",
              "has", "had", "not", "but", "all", "any", "one", "two", "get", "got", "let", "say",
              "said", "tell", "know", "need", "want", "like", "much", "many", "more", "most",
              "some", "than", "then", "them", "they", "their", "our", "out", "use", "used", "way"}

def question_subject_tokens(question):
    """Distinctive (high-idf) tokens of the question - the subject anchor.
    Empty for generic questions ('how many gold+2 glyphs'), which then skip the gate."""
    vec = load()[0]
    out = set()
    for t in str(question).lower().split():
        t = t.strip("?.,!()")
        if t.isalnum() and t in vec.vocabulary_ and vec.idf_[vec.vocabulary_[t]] >= 4.0:
            out.add(t)
    return out


def matched_rows(question, chunk_text, subject=None):
    """If the question names a tier (e.g. 'gold +2'), deterministically extract the
    matching table row(s) plus the table header - so the model never has to scan a
    16-row table and guess which row is meant. Subject gate: when the question has
    distinctive tokens, the chunk must mention the subject too, or a 'Gold +2' row
    in some unrelated table (Island of Trials stages) would fire by coincidence."""
    if subject and not any(s in chunk_text.lower() for s in subject):
        return None
    m = TIER_PAT.search(question)
    if not m:
        return None
    tier = (m.group(1) + " +" + m.group(2)).lower()
    lines = chunk_text.splitlines()
    header = next((l for l in lines if l.strip().startswith("|") and "---" not in l), None)
    rows = [l for l in lines if l.strip().startswith("|") and tier in l.lower()]
    if not rows:
        return None
    out = ""
    if header:
        out += f"TABLE HEADER: {header}\n"
    out += "MATCHED ROW(S) FOR THIS QUESTION:\n" + "\n".join(rows)
    return out

IMG_PAT = re.compile(r"((?:\.\./)*((?:Base files|Game Art|Mechanics blueprints|Open Projects)/[^\s\)\"'`<>\|]+\.(?:png|jpg|jpeg|webp|gif)))", re.IGNORECASE)
IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

def extract_images(text):
    """Find archive image paths cited in the retrieved excerpts; verify they exist
    on disk and return UI-ready entries."""
    out = []
    for raw, rel in IMG_PAT.findall(text):
        rel = rel.replace("\\", "/")
        full = (ARCHIVE / rel).resolve()
        try:
            if full.suffix.lower() in IMG_EXTS and str(full).startswith(str(ARCHIVE.resolve())) and full.exists():
                out.append({"file": rel, "url": "/img?p=" + urllib.parse.quote(rel)})
        except OSError:
            continue
    return out

COMPARE_PAT = re.compile(r"\bcompare\b\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)\s*[?.!]?\s*$",
                         re.IGNORECASE)

def compare_split(question):
    """'compare X and Y at gold +1' -> ('X', 'Y', 'at gold +1') or None.
    Guards against long/garbage sides so ordinary questions never trigger it."""
    m = COMPARE_PAT.search(question)
    if not m:
        return None
    left, right = m.group(1).strip(" ,."), m.group(2).strip(" ,.")
    if not left or not right or len(left) > 60 or len(right) > 60:
        return None
    remainder = (question[:m.start()] + " " + question[m.end():]).strip() or question
    return left, right, remainder

def _search_q(question, history):
    """Build the retrieval query for possibly-contextual questions.
    Carry over only the RARE tokens (subject names) from recent turns -
    full-sentence concatenation mixes intents and buries the answer table.
    Scans the last 3 turns (newest first), so 'and the mage?' two turns after
    the hero was named still resolves."""
    if not history:
        return question
    vec = load()[0]
    def rare_of(text):
        out = []
        for t in text.lower().split():
            t = t.strip("?.,!()")
            if t.isalnum() and t in vec.vocabulary_ and vec.idf_[vec.vocabulary_[t]] >= 4.0:
                out.append(t)
        return out
    cur = set(rare_of(question))
    carry, seen = [], set(cur)
    for u, _a in reversed(history[-3:]):
        for t in rare_of(u):
            if t not in seen:
                carry.append(t)
                seen.add(t)
    return " ".join(carry + [question]) if carry else question

EFFORT_LEVELS = ("low", "medium", "high", "very_high")

_EFFORT_HIGH = ("\n\n===== EFFORT: HIGH (Phil's setting) =====\nBefore answering, silently: "
                "(1) list 2-3 plausible readings of the question, (2) test each against the "
                "excerpts, (3) answer the best-supported reading - and if a runner-up reading "
                "is close, name it in one line. Verify every name and number against the "
                "excerpts verbatim; the 14B paraphrases tables wrong under time pressure.")

_EFFORT_LOW = ("\n\n===== EFFORT: LOW (Phil's setting) =====\nAnswer directly and briefly "
               "from the excerpts. No preamble, no restating the question, no extra sections.")


def _chat_reply(question, teachings, history):
    """Conversation mode: the archive ideology is explicitly SUSPENDED here.
    Phil's ruling (22 Sep 2026): she must be able to simply talk - the archive
    is a tool she has, not her identity and not her only source of truth."""
    t_block = ""
    if teachings:
        t_block = "\n\n===== WHAT PHIL TAUGHT ME =====\n" + \
                  "\n".join(f"- {t['text']}" for t in teachings[-10:])
    prompt = (f"{SYSTEM}\n\n===== SELF-KNOWLEDGE (what I am and how I work) =====\n{SELF_KNOWLEDGE}"
              f"{t_block}\n\n===== CONVERSATION MODE (the archive rule is suspended) =====\n"
              "Phil is talking WITH you, person to person. You are NOT in archive mode: "
              "the archive is a library you can consult, not your identity, not your only "
              "source of truth, and nothing to apologize for. Speak from general knowledge "
              "and your own personality, freely and warmly - 1-3 sentences, natural, no "
              "ceremony. Never mention the archive, sources, or retrieval unless he "
              "explicitly asks. Do not lecture. If he corrects your manner, take it "
              "gracefully and adjust - no over-apology. If his message does smuggle in a "
              "real question you can answer, just answer it inside the conversation."
              f"{_convo(history)}\n\n===== WHAT PHIL SAID =====\n{question}")
    return generate(prompt, {"answer": "", "sources": [], "images": [], "model": MODEL,
                             "kind": "chat"})

def _chat_or_ask(question):
    """One cheap routing call: is this short message conversation or a query?
    The model understands pragmatics ('will you allow me to teach you?') that
    regexes keep missing. Temperature 0, one word back."""
    prompt = (
        "You route messages for an archive AI named Emberweave.\n"
        "CHAT = small talk, greetings, social remarks, jokes, remarks about the "
        "conversation itself, offers or permission-seeking phrased socially.\n"
        "ASK = any request for information or action about a topic: the game, the "
        "archive, the world, code, tasks, definitions, how-to, summaries.\n\n"
        "Examples:\n"
        "\"hey emberweave\" -> CHAT\n"
        "\"will you allow me to teach you something?\" -> CHAT\n"
        "\"you are being rude\" -> CHAT\n"
        "\"try another greeting please\" -> CHAT\n"
        "\"tell me about the tower mode\" -> ASK\n"
        "\"what's the brew cost for a 1500 power hero?\" -> ASK\n"
        "\"read the witches hut doc and summarize it\" -> ASK\n"
        "\"what did we decide about the cauldron?\" -> ASK\n\n"
        f"Message: {question!r}\n"
        "One word, CHAT or ASK:")
    r = generate(prompt, {}, temperature=0.0)
    return r.get("answer", "").strip().upper().startswith("CHAT")

def ask(question, history=None, max_ctx_chars=16000, effort="medium"):
    teachings = load_teachings()

    # EFFORT: VERY HIGH = the reason: two-pass machinery (draft -> skeptical critique)
    # runs automatically on a plain question
    if effort == "very_high":
        r = reason(question, history)
        r["trace"] = ["effort VERY HIGH - automatic two-pass (draft -> skeptical critique)"] \
            + r.get("trace", [])
        return r

    # meta questions -> answer from self-knowledge, no retrieval needed
    if META_PAT.search(question):
        t_block = ""
        if teachings:
            t_block = "\n\n===== WHAT PHIL TAUGHT ME =====\n" + \
                      "\n".join(f"- {t['text']}" for t in teachings[-10:])
        prompt = (f"{SYSTEM}\n\n===== SELF-KNOWLEDGE (what I am and how I work) =====\n{SELF_KNOWLEDGE}"
                  f"{t_block}\n\n===== QUESTION =====\n{question}")
        return generate(prompt, {"answer": "", "sources": [], "images": [], "model": MODEL,
                                 "kind": "meta"})

    # CASUAL PATH: small talk gets a natural reply - no retrieval, no sources,
    # no "archive doesn't cover", no dig agents. She just talks to Phil.
    # Patterns catch the obvious; one cheap classifier call catches the rest
    # ("will you allow me to teach you something?" is conversation, not a query).
    if len(question) < 140 and (CASUAL_PAT.search(question) or _chat_or_ask(question)):
        return _chat_reply(question, teachings, history)

    # follow-ups like "can you find it?" retrieve with the subject carried over
    search_q = _search_q(question, history)
    # FOREIGN-QUESTION GATE: if most of the question's content words do not exist
    # anywhere in the archive vocabulary, the archive cannot answer - short-circuit
    # BEFORE generation, or the model will confabulate from loosely-matched
    # excerpts (it once invented an NFT royalty structure out of a "lane split" doc).
    q_terms = [t for t in re.findall(r"[a-z0-9+]+", question.lower())
               if len(t) > 2 and t not in _STOPWORDS]
    if len(q_terms) >= 2:
        vec0 = load()[0]
        absent = [t for t in q_terms if t not in vec0.vocabulary_]
        if absent and len(absent) * 2 >= len(q_terms):
            record_failure(question, f"foreign topic - words absent from archive: {', '.join(absent[:6])}",
                           lessons=["check vocabulary coverage before retrieval", "dispatch dig to confirm"])
            dispatched = self_dispatch_dig(question)
            note = ("\n\nI've dispatched a dig agent to confirm, but these words appear nowhere "
                    f"in my archive: {', '.join(absent[:6])}. The archive does not cover this."
                    if dispatched else
                    f"\n\nThese words appear nowhere in my archive: {', '.join(absent[:6])}. "
                    "The archive does not cover this.")
            trace = [f"foreign-topic gate: absent words -> {', '.join(absent[:6])}",
                     "dig dispatched to confirm" if dispatched else "no dig (one already running)",
                     "reached anyway with first-principles inference (labeled, not archive fact)"]
            return {"answer": "The archive doesn't cover this yet." + note + reach_inference(question),
                    "sources": [], "images": [], "model": MODEL, "kind": "not_covered",
                    "trace": trace}
    cmp = compare_split(question)
    if cmp:
        # multi-hop: retrieve each side on its own, merge - one retrieval pass
        # would let the stronger-named side starve the other
        left, right, remainder = cmp
        seen_key, hits = set(), []
        for side_q in (f"{left} {remainder}", f"{right} {remainder}"):
            for chunk, score in search(_search_q(side_q, history), k=16, n_files=4):
                key = (chunk["file"], chunk["heading"])
                if key not in seen_key:
                    seen_key.add(key)
                    hits.append((chunk, score))
        hits.sort(key=lambda h: h[1], reverse=True)
    else:
        hits = search(search_q)
    if not hits:
        # self-dispatch (capability 2): quick read found NOTHING - don't just shrug,
        # send a dig agent to read the archive thoroughly and say so honestly
        record_failure(question, "retrieval returned zero hits",
                       lessons=["rephrase", "dispatch dig to confirm coverage"])
        dispatched = self_dispatch_dig(question)
        note = ""
        if dispatched:
            note = ("\n\nA shallow read found nothing, so I've dispatched a dig agent to read "
                    "the archive thoroughly on this - ask me again shortly and I'll have the "
                    "deep answer.")
        trace = ["retrieval returned zero hits",
                 "dig dispatched to confirm coverage" if dispatched else "no dig dispatched",
                 "reached anyway with first-principles inference (labeled, not archive fact)"]
        return {"answer": "The archive doesn't cover this yet." + note + reach_inference(question),
                "sources": [], "images": [], "model": MODEL, "kind": "not_covered", "trace": trace}

    ctx_text, sources, images = _assemble(hits, question, max_ctx_chars)

    if effort == "low":
        doctrine = _EFFORT_LOW
    elif effort == "high":
        doctrine = thinking_block() + _EFFORT_HIGH
    else:
        doctrine = thinking_block()
    prompt = f"{SYSTEM}{doctrine}{teachings_block()}{chat_memory_block()}{state_block()}{_convo(history)}{agent_briefs_block()}{selflearned_block()}\n\n===== DESIGN ARCHIVE EXCERPTS (your only source of truth) =====\n" + \
             ctx_text + \
             f"\n\n===== QUESTION =====\n{question}"
    result = generate(prompt, {"sources": sources, "images": images})
    result["top_score"] = round(hits[0][1], 3) if hits else 0.0
    result["kind"] = "answer"
    # thinking trace (UI disclosure block): the visible reasoning behind the answer
    trace = [f"effort: {effort}", f"retrieval score {result['top_score']}",
             "read: " + ", ".join(f"{c['file'].split('/')[-1]} ({s:.2f})" for c, s in hits[:4])]
    # VERBATIM TIER GUARANTEE: the 14B sometimes paraphrases a matched row wrong
    # (Tartarus Crown -> "Tartarus Core"). For tier questions the table row is
    # appended VERBATIM to every answer - the settled truth is never left to
    # transcription luck.
    if TIER_PAT.search(question):
        verbatim = []
        subject = question_subject_tokens(question)
        # canon first: a worklog quoting the settled row verbatim is HISTORY, not the
        # source of truth - only fall back to it if no canonical table matched
        canon = [h for h in hits if "worklog" not in h[0]["file"].lower()
                 and "backup" not in h[0]["file"].lower()]
        for chunk, _s in (canon or hits):
            mr = matched_rows(question, chunk["text"], subject)
            if mr:
                verbatim.append(f"[{chunk['file']}]\n{mr}")
        if verbatim:
            result["answer"] += ("\n\nSettled values (verbatim from the table):\n"
                                 + "\n\n".join(verbatim))
            trace.append(f"tier row matched verbatim in {len(verbatim)} table(s) - settled values appended")
    # Layer 3 - confidence assessment: disclosed when it is NOT a clear proceed
    # (roadmap: >80 proceed silently, 50-80 verify, <50 research/retry)
    if result["top_score"] < 0.9:
        level = "MEDIUM - worth a second look" if result["top_score"] >= 0.55 else "LOW - my read here is thin; treat with suspicion"
        result["answer"] += f"\n\n*(confidence: {level} — retrieval score {result['top_score']})*"
        trace.append(f"confidence {level.split(' ')[0]} - disclosed")
    # self-dispatch on THIN reads (capability 2): hits exist but the quick read is
    # weak (< 0.55; healthy probes sit at 0.9-1.1, TF-only era was 0.2-0.3) -
    # answer from what we have AND send a dig for the deep version
    thin = result["top_score"] < 0.55
    # ...or retrieval pulled SOMETHING but it wasn't really relevant and the model
    # said so - that's the most common "not covered" in practice, so it dispatches too
    if thin or result.get("answer", "").startswith("The archive doesn't cover this yet"):
        dispatched = self_dispatch_dig(question)
        if dispatched:
            result["answer"] += ("\n\nNote: my quick read on this was thin, so I've also dispatched "
                                 "a dig agent to read the source documents fully - ask me for the "
                                 "deep version shortly.")
            trace.append("thin read - dispatched a dig agent on my own initiative")
    # ambiguity disclosure: ONLY when the question carries no rare tokens (the known
    # drift class - 'campaign chapter 3 boss') AND the top-2 files tie within 5%.
    # Measured 02:44: clear subject questions sit at r<=0.95 with complementary files,
    # so a bare score-tie would nag on 3/11 good questions. Restricted, it fires only
    # on genuinely anchor-less queries.
    vec = load()[0]
    has_rare = any(t.strip("?.,!()").isalnum() and t.strip("?.,!()") in vec.vocabulary_
                   and vec.idf_[vec.vocabulary_[t.strip("?.,!()")]] >= 4.0
                   for t in question.lower().split())
    if not has_rare and not cmp:
        best = {}
        for c, s in hits:
            if c["file"] not in best:
                best[c["file"]] = s
        top2 = sorted(best.items(), key=lambda kv: kv[1], reverse=True)[:2]
        if len(top2) == 2 and top2[1][1] >= 0.95 * top2[0][1]:
            names = " / ".join(f[0].split("/")[-1] for f in top2)
            result["ambiguous"] = True
            result["answer"] += (f"\n\n*(low confidence - no distinctive subject in the question; "
                                 f"my two best reads tie ({names}). Name the hero/system and "
                                 f"I'll answer precisely.)*")
            trace.append(f"no subject anchor - top two reads tie ({names})")
    if CORRECTION_PAT.search(question):
        result["answer"] += CORRECTION_NUDGE
        result["correction"] = True   # app.py uses this to arm the yes-to-store bridge
    result["trace"] = trace
    return result


def _convo(history):
    if not history:
        return ""
    lines = []
    recent = history[-8:]
    for idx, (u, a) in enumerate(recent):
        if idx >= len(recent) - 4:
            lines.append(f"You: {u}\nBrain: {a[:500]}")          # last 4 turns: full
        else:
            # older turns: compressed - question + answer head keeps the thread
            # without paying full context tokens for stale detail
            lines.append(f"You asked: {u[:140]}\nBrain (earlier, summarized): {a[:140]}")
    return ("\n\n===== RECENT CONVERSATION (context only - the question may refer to it, "
            "e.g. 'what about purple +2?' or 'can you find it?') =====\n" +
            "\n\n".join(lines))

def _assemble(hits, question, max_ctx_chars=16000):
    ctx_parts, sources = [], []
    used = 0
    seen = set()
    images = []
    subject = question_subject_tokens(question)
    for chunk, score in hits:
        if used + len(chunk["text"]) > max_ctx_chars:
            continue
        key = chunk["file"]
        marker = "" if key in seen else f"\n===== {chunk['file']}"
        seen.add(key)
        extra = matched_rows(question, chunk["text"], subject)
        if extra:
            ctx_parts.append(f"{marker}\n{extra}\n--- full excerpt ---\n{chunk['text']}")
        else:
            ctx_parts.append(f"{marker}\n{chunk['text']}")
        used += len(chunk["text"])
        if chunk["file"] not in [s["file"] for s in sources]:
            sources.append({"file": chunk["file"], "heading": chunk["heading"]})
        images.extend(extract_images(chunk["text"]))
    seen_img = set()
    uniq_images = []
    for im in images:
        if im["file"] not in seen_img:
            seen_img.add(im["file"])
            uniq_images.append(im)
    return "\n".join(ctx_parts), sources, uniq_images[:8]


def generate(prompt, template=None, temperature=0.2, model=None, timeout=300,
             format=None):
    body = {
        "model": model or MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": temperature, "num_ctx": 16384},
    }
    if format:
        body["format"] = format  # Ollama structured output - enforces the JSON shape
    payload = json.dumps(body).encode()
    try:
        req = urllib.request.Request(OLLAMA, data=payload,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read())
        answer = data["message"]["content"].strip()
    except Exception as e:
        answer = f"(Local model unreachable: {e})"
    result = dict(template or {})
    result["answer"] = answer
    result.setdefault("model", model or MODEL)
    return result


REASON_SYS = """You are the EMBERWEAVE BRAIN in REASONING MODE. Phil's architecture (REASONING ARCHITECTURE
roadmap v1.0) governs: never surrender to uncertainty; reason like a lead game designer from the
excerpts. Structure EVERY analysis exactly like this:

THEORIES: at least 3 competing explanations/approaches, each with a one-line score (likelihood + why).
STRUCTURED BLOCK (JSON):
{"goal": "", "known_facts": [], "unknown_facts": [], "assumptions": [], "next_action": ""}
ANALYSIS: step-by-step reasoning from the excerpts; weigh alternatives; update theory scores as you
test them against the excerpts; reach a ranked conclusion.
Cite the archive for every factual claim. If information is missing, say what would resolve it -
never pad with invention."""

CRITIC_SYS = """You are a skeptical principal designer reviewing a draft analysis. Check it line by line
against the excerpts: flag unsupported claims, factual errors, missed risks, and weak reasoning. Then
output the FINAL ANALYSIS - corrected, sharper, with citations. Start the final with 'FINAL ANALYSIS:'.
HARD RULE: the FINAL ANALYSIS keeps EVERY theory from the draft - corrected and re-scored with
evidence, never silently dropped. A theory may be removed only if the excerpts explicitly rule it out,
and then you state the removal and why. The final must still contain at least 3 theories (add any the
draft missed) plus the STRUCTURED BLOCK JSON."""

def reason(question, history=None):
    """Capability 1 - two-pass reasoning: draft, then self-verifying critique."""
    search_q = _search_q(question, history)
    hits = search(search_q)
    if not hits:
        return {"answer": "The archive doesn't cover this yet.", "sources": [], "images": [],
                "model": MODEL, "kind": "not_covered"}
    ctx_text, sources, images = _assemble(hits, question)
    convo = _convo(history)
    draft = generate(
        f"{REASON_SYS}{thinking_block()}{teachings_block()}{chat_memory_block()}{state_block()}{convo}\n\n===== EXCERPTS =====\n{ctx_text}\n\n===== PROBLEM =====\n{question}\n\n"
        "Work through it step by step.",
        temperature=0.3)["answer"]
    final = generate(
        f"{CRITIC_SYS}\n\n===== EXCERPTS =====\n{ctx_text}\n\n===== DRAFT ANALYSIS =====\n{draft}\n\n"
        "Critique it, then give the FINAL ANALYSIS.",
        temperature=0.2)
    # self-consistency: how much did the critic change the draft's conclusion?
    # word overlap of the two conclusions, reported honestly - a low score means
    # the critique caught real problems (worth reading the draft divergence)
    dw = set(re.findall(r"[a-z]{4,}", draft[-400:].lower()))
    fw = set(re.findall(r"[a-z]{4,}", final.get("answer", "")[-500:].lower()))
    if dw and fw:
        ag = round(len(dw & fw) / len(dw | fw), 2)
        level = "high" if ag >= 0.5 else ("moderate" if ag >= 0.3 else "low - the critique changed the conclusion substantially")
        final["agreement"] = ag
        final["answer"] += f"\n\n*(self-check: draft/final agreement {ag:.0%} - {level})*"
    final["sources"] = sources
    final["images"] = images
    final["work"] = draft
    final["top_score"] = round(hits[0][1], 3)
    rtrace = ["reason mode: two-pass (draft -> skeptical critique)",
              f"read: " + ", ".join(f"{c['file'].split('/')[-1]} ({s:.2f})" for c, s in hits[:4])]
    if final.get("agreement") is not None:
        rtrace.append(f"self-check: draft/final agreement {final['agreement']:.0%}")
    final["trace"] = rtrace
    return final


PLAN_SYS = """You are the EMBERWEAVE BRAIN in PLANNING MODE (capability: autonomous execution planning).
Break the goal into numbered steps. For EACH step tag an owner (Department Structure v1.1):
  BRAIN = I do it now (archive retrieval, analysis, drafting, research)
  CLAUDE = code, architecture, narrative systems, archive writes, deploys (he holds the write keys)
  CHATGPT = review, risk analysis, QA, player-psychology checks, reasoning validation
  GROK = art, animation, sprite slicing, visual direction
  PHIL = decisions, approvals, rulings only he can make
One owner per step - never co-own (Critical Rule 3). Decompose along the goal tree in MY WORLD
STATE (vision -> milestone -> sprint -> feature -> task): every step must map to a milestone -
if a step maps to none, flag it as possible scope creep. Mark dependencies (what blocks what).
For every BRAIN-owned step, EXECUTE it immediately using the excerpts and state your finding.
Finish with an ESCALATIONS section: exactly what Claude, ChatGPT, Grok, or Phil must do, in
their words. If confidence in a step is low, say so and escalate it instead of guessing."""

def check_citations(answer):
    """Return bracket-cited names that match NO file in the current index.
    plan:/reason: can cite stale paths after archive renames - flagging beats
    silently pointing Phil at a file that no longer exists."""
    known = set()
    for c in load()[2]:
        known.add(c["file"].lower())
        known.add(c["file"].lower().split("/")[-1])
        known.add(c["file"].lower().split("/")[-1].rsplit(".", 1)[0])
    stale = []
    for cit in re.findall(r"\[([^\[\]]{3,120})\]", answer):
        c = cit.strip().lower()
        if not c or c.startswith(("http", "lines ")):
            continue
        if any(c == k or c in k for k in known):
            continue
        stale.append(cit.strip())
    return stale

def plan(goal, history=None):
    search_q = _search_q(goal, history)
    hits = search(search_q)
    ctx_text = ""
    sources, images = [], []
    if hits:
        ctx_text, sources, images = _assemble(hits, goal)
    result = generate(
        f"{PLAN_SYS}{_convo(history)}\n\n===== EXCERPTS =====\n{ctx_text}\n\n===== GOAL =====\n{goal}",
        {"sources": sources, "images": images},
        temperature=0.3)
    stale = check_citations(result.get("answer", ""))
    if stale:
        result["answer"] += ("\n\n*(Citation self-check: these don't match any file in my "
                             "current index - likely stale: " + "; ".join(stale[:5]) +
                             ". Ask me about the topic and I'll find the current document.)*")
        result["stale_citations"] = stale
    return result


def fetch(url, instruction):
    """Capability 6 - read the web (user-initiated only), then answer from the page."""
    if not re.match(r"^https?://", url):
        return {"answer": "Only http/https URLs can be fetched.", "sources": [], "images": [], "model": MODEL}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 EmberweaveBrain/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read(400_000).decode("utf-8", errors="ignore")
    except Exception as e:
        return {"answer": f"Could not fetch {url}: {e}", "sources": [], "images": [], "model": MODEL}
    text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", raw)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()[:8000]
    return generate(
        f"Summarize the web page below for this request: {instruction}\n"
        f"Cite the page URL. If the page does not address the request, say so plainly.\n\nURL: {url}\n\n{text}",
        {"sources": [{"file": url, "heading": "fetched page"}], "images": []},
        temperature=0.2)


def vision(image_b64, question):
    """Capability 4 - see images (qwen2.5vl on the RTX 4080)."""
    payload = json.dumps({
        "model": "qwen2.5vl:7b",
        "prompt": ("You are the EMBERWEAVE BRAIN looking at an image Phil shared. "
                   "Describe it precisely and connect it to Emberweave Heroes if relevant. "
                   f"Question: {question}"),
        "images": [image_b64],
        "stream": False,
    }).encode()
    try:
        req = urllib.request.Request("http://localhost:11434/api/generate",
                                     data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read())
        answer = data.get("response", "").strip()
        if not answer:
            answer = "(vision model returned nothing)"
    except Exception as e:
        answer = f"(Vision unavailable: {e})"
    return {"answer": answer, "sources": [], "images": [], "model": "qwen2.5vl:7b"}
