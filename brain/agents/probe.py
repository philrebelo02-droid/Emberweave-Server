"""probe worker - retrieval regression battery.

argv: jobid (no task needed)
Runs fixed probes through brain.search and checks the expected source file
ranks near the top. Writes agent_out/<jobid>.json. Exit summary flags any
regression so she (and the heartbeat) can see retrieval health as a number.
"""
import json
import sys
import time
from pathlib import Path

BASE = Path(__file__).parent.parent
sys.path.insert(0, str(BASE))
OUT_DIR = BASE / "agent_out"

import brain  # noqa: E402

PROBES = [
    ("what glyphs does greatbrow need at gold +2", "GLYPH ENCYCLOPEDIA"),
    ("glyphs greatbrow purple +2", "GLYPH ENCYCLOPEDIA"),
    ("witches hut brew cost diamonds", "WITCHES HUT"),
    ("temple of ash tiers", "TEMPLE"),
    ("emberdraft full blueprint design", "EMBERDRAFT"),
    ("watch tower blueprint", "Watch Tower"),
    ("island of trials", "Island of Trials"),
    ("cauldron refill 18 hours", "WITCHES HUT"),
    ("glyph encyclopedia", "GLYPH ENCYCLOPEDIA"),
    ("guild hall blueprint", "Guild Hall"),
]


def main():
    jobid = sys.argv[1]
    t0 = time.time()
    results, fails = [], 0
    for q, expect in PROBES:
        hits = brain.search(q, k=8)
        rank = next((i + 1 for i, (c, s) in enumerate(hits)
                     if expect.lower() in c["file"].lower()), 0)
        ok = 1 <= rank <= 3
        fails += 0 if ok else 1
        results.append({"q": q, "expect": expect, "rank": rank,
                        "top_score": round(hits[0][1], 3) if hits else 0})
    score = round(100 * (len(PROBES) - fails) / len(PROBES))
    summary = (f"Probe battery: {len(PROBES) - fails}/{len(PROBES)} pass "
               f"(retrieval health {score}%). "
               + ("All probes healthy." if fails == 0 else
                  "Regressions: " + "; ".join(f"'{r['q']}' expected {r['expect']} in top 3, got rank {r['rank']}"
                                              for r in results if r["rank"] > 3 or r["rank"] == 0)))
    (OUT_DIR / f"{jobid}.json").write_text(json.dumps({
        "status": "done", "summary": summary, "files": [],
        "score": score, "results": results, "seconds": round(time.time() - t0, 1),
    }, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
