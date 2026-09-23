# Rebuild index/matrix.npz from intact chunks.jsonl + vectorizer.pkl
# (recovery from interrupted auto-reindex that corrupted matrix.npz)
import json
import pickle
import time
from pathlib import Path

import scipy.sparse as sp

HERE = Path(__file__).parent
IDX = HERE / "index"

t0 = time.time()
print("loading vectorizer...", flush=True)
with open(IDX / "vectorizer.pkl", "rb") as fh:
    vec = pickle.load(fh)
print(f"  vocab={len(vec.vocabulary_)}  ({time.time()-t0:.1f}s)", flush=True)

blocks = []
n = 0
bad = 0
batch = []

with open(IDX / "chunks.jsonl", encoding="utf-8") as fh:
    for line in fh:
        line = line.strip()
        if not line:
            continue
        try:
            c = json.loads(line)
        except Exception:
            bad += 1
            continue
        batch.append(c["text"])
        if len(batch) >= 50000:
            m = vec.transform(batch)
            blocks.append(m)
            n += m.shape[0]
            batch.clear()
            print(f"  {n} chunks transformed  ({time.time()-t0:.1f}s)", flush=True)
    if batch:
        m = vec.transform(batch)
        blocks.append(m)
        n += m.shape[0]
        batch.clear()

print(f"total chunks={n}  bad_lines={bad}", flush=True)
mat = sp.vstack(blocks).tocsr()
sp.save_npz(IDX / "matrix.npz", mat)
print(f"SAVED matrix.npz shape={mat.shape}  total {time.time()-t0:.1f}s", flush=True)
