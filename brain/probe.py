# Emberweave Brain - regression probe runner.
# Runs probes.json against brain.search() directly (no server needed).
# Usage: python probe.py   -> PASS/FAIL per probe, exit 1 if any real probe fails.
import json
import sys
from pathlib import Path

import brain

def run():
    probes = json.loads((Path(__file__).parent / "probes.json").read_text(encoding="utf-8"))["probes"]
    brain.load()
    fails = 0
    for p in probes:
        hist = [tuple(h) for h in p.get("history", [])]
        q = brain._search_q(p["question"], hist)
        hits = brain.search(q, k=32)
        files = [h[0]["file"] for h in hits]
        blob = "\n".join(h[0]["text"] for h in hits)
        exp_ok = (not p["expect"]) or any(p["expect"].lower() in f.lower() for f in files)
        fact_miss = [f for f in p.get("facts", []) if f.lower() not in blob.lower()]
        ok = exp_ok and not fact_miss
        informational = not p["expect"]
        if not ok and not informational:
            fails += 1
        tag = "PASS" if ok else ("INFO" if informational else "FAIL")
        top = files[0].split("/")[-1] if files else "(none)"
        print(f"{tag} {p['id']:<18} score={hits[0][1]:.3f} top={top}"
              + ("" if exp_ok else f"  EXPECT-MISS:{p['expect']}")
              + ("" if not fact_miss else f"  FACT-MISS:{fact_miss}"))
    print(f"\n{fails} failure(s) over {sum(1 for p in probes if p['expect'])} graded probes")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(run())
