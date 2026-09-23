"""stats worker - index + learning health report.

argv: jobid
Writes agent_out/<jobid>.json: chunk/file counts, embedding matrix rows vs
chunks, teachings count, retrieval score trend from scores.jsonl.
"""
import json
import sys
import time
from pathlib import Path

BASE = Path(__file__).parent.parent
sys.path.insert(0, str(BASE))
OUT_DIR = BASE / "agent_out"
INDEX = BASE / "index"


def main():
    jobid = sys.argv[1]
    lines = []
    chunks = embeddings_rows = None
    try:
        chunks = sum(1 for _ in open(INDEX / "chunks.jsonl", encoding="utf-8"))
    except OSError:
        pass
    try:
        import numpy as np
        embeddings_rows = int(np.load(INDEX / "embeddings.npy", mmap_mode="r").shape[0])
    except Exception:
        pass
    ok = chunks == embeddings_rows
    lines.append(f"index chunks: {chunks} | embedding rows: {embeddings_rows} | "
                 f"{'HEALTHY' if ok else 'MISMATCH - rebuild needed'}")

    try:
        teachings = [l for l in (BASE / "teachings.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        lines.append(f"teachings: {len(teachings)} stored facts/procedures")
    except OSError:
        pass
    try:
        scores = [json.loads(l) for l in (BASE / "scores.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        if scores:
            recent = scores[-20:]
            avg = round(sum(s["score"] for s in recent) / len(recent), 3)
            lines.append(f"retrieval: last {len(recent)} questions avg top_score {avg} "
                         f"(lifetime {len(scores)})")
    except OSError:
        pass

    summary = " | ".join(lines)
    (OUT_DIR / f"{jobid}.json").write_text(json.dumps({
        "status": "done", "summary": summary, "files": [],
    }, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
