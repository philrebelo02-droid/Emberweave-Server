# Emberweave Brain - unit self-test for non-retrieval logic (no server, no Ollama).
# Complements probe.py (which covers retrieval). Run: python selftest.py
import importlib
import json
import tempfile
from pathlib import Path

import brain

FAILS = []

def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        FAILS.append(name)

brain.load()
brain.generate = lambda prompt, template=None, **kw: dict(template or {}, answer="stub answer", model="stub")

# correction detection + nudge (items 2/2b)
r = brain.ask("no, that's wrong - Greatbrow needs five glyphs", history=[])
check("correction flagged + nudge offers yes-bridge",
      r.get("correction") is True and 'say "yes"' in r["answer"].lower())
check("normal question not flagged", "correction" not in brain.ask("what glyphs does greatbrow need at gold +2", history=[]))
check("confirm regex bare-only",
      brain.is_confirm("yes") and not brain.is_confirm("yes what about purple +2?") and not brain.is_confirm("yesterday's patch"))

# compare mode (item 6)
cmp = brain.compare_split("compare greatbrow and irix")
check("compare_split parses two sides", cmp is not None and cmp[0] == "greatbrow" and "irix" in cmp[1])
check("compare_split ignores plain questions", brain.compare_split("what glyphs does greatbrow need") is None)
r = brain.ask("compare greatbrow and irix at gold +1", history=[])
srcs = [s["file"] for s in r["sources"]]
check("compare retrieves BOTH sides", any("Greatbrow" in s for s in srcs) and any("Irix" in s for s in srcs))

# answer kinds (item 9)
check("meta kind", brain.ask("what can you do?", history=[]).get("kind") == "meta")
real_search = brain.search
brain.search = lambda *a, **kw: []
check("not_covered kind", brain.ask("zzzq unobtainium", history=[]).get("kind") == "not_covered")
brain.search = real_search
check("answer kind", brain.ask("what glyphs does greatbrow need at gold +2", history=[]).get("kind") == "answer")

# stale citation check (item 7)
stale = brain.check_citations("See [05.1 - GLYPH ENCYCLOPEDIA.md] then [Ghost File 1999.md].")
check("stale citation flagged, real one passes", stale == ["Ghost File 1999.md"])

# teachings dedupe (item 8)
tmp = Path(tempfile.mkdtemp()) / "t.jsonl"
tmp.write_text("\n".join(json.dumps(x) for x in [
    {"t": "a", "kind": "fact", "text": "Phil outranks the archive"},
    {"t": "b", "kind": "fact", "text": "phil outranks the archive!"},
    {"t": "c", "kind": "fact", "text": "Glyphs are settled design"},
]), encoding="utf-8")
old = brain.TEACHINGS_FILE
brain.TEACHINGS_FILE = tmp
kept = brain.load_teachings()
brain.TEACHINGS_FILE = old
check("teachings dedupe (near-dup dropped)", len(kept) == 2)

# history compression (item 11)
hist = [(f"question {i} " + "x" * 600, f"answer {i} " + "y" * 600) for i in range(8)]
c = brain._convo(hist)
full = sum(len(f"You: {u}\nBrain: {a[:500]}") for u, a in hist)
check("convo: 8 turns, older compressed, last 4 full",
      "You asked: question 0" in c and "Brain: answer 7" in c and len(c) < full * 0.7)

# 3-turn rare-token carry (item 5)
q = brain._search_q("and his runes?", [("what glyphs does greatbrow need at gold +2", ""), ("what about purple +2?", "")])
check("entity carried from 2 turns back", "greatbrow" in q)

# help (item 15)
check("help lists commands", "remember:" in brain.help_answer()["answer"] and "plan:" in brain.help_answer()["answer"])

# memmap embeddings (item 13 partial)
import numpy as np
check("embeddings mmap-loaded", isinstance(brain._fresh["emb"], np.memmap))

print(f"\n{len(FAILS)} failure(s)")
raise SystemExit(1 if FAILS else 0)
