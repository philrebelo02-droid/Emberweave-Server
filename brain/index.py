# Emberweave Brain - Indexer
# Reads the Emberweave Archive, chunks every markdown/text file,
# builds a TF-IDF retrieval index. Pure stdlib + sklearn (no downloads).

import json
import os
import re
import sys
import time
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import scipy.sparse as sp

ARCHIVE = Path(r"C:\Users\Home\OneDrive\Desktop\Emberweave Archive")
OUT_DIR = Path(__file__).parent / "index"
OUT_DIR.mkdir(exist_ok=True)

SKIP_DIRS = {"_to_delete", ".git", "node_modules", "dist", "build", "__pycache__",
             "1. Emberweave Brain"}  # her own folder: her code/logs/probes are not design knowledge
CHUNK_CHARS = 900        # target chunk size
CHUNK_OVERLAP = 120      # overlap to preserve context across chunk boundaries
EXTS = {".md", ".txt"}
CODE_EXTS = {".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".json"}
SKIP_NAMES = {"package-lock.json"}
SKIP_NAME_PAT = re.compile(r"(\.env|\.pem$|\.key$|\.p12$|secret|credential|\.min\.js$)", re.IGNORECASE)
CODE_CHUNK_LINES = 45    # lines per code window
CODE_OVERLAP_LINES = 6   # carried context between windows

def iter_files(root: Path):
    for p in sorted(root.rglob("*")):
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.name.lower() in SKIP_NAMES or SKIP_NAME_PAT.search(p.name):
            continue
        try:
            if not p.is_file() or p.suffix.lower() not in EXTS | CODE_EXTS:
                continue
        except OSError:
            continue  # broken symlinks / OneDrive placeholders
        yield p

def chunk_file(path: Path, text: str):
    """Split on markdown headings; subdivide long sections. Yields (heading, chunk_text)."""
    rel = path.relative_to(ARCHIVE).as_posix()
    # Split into sections by headings, keep the heading line attached
    parts = re.split(r"(?m)(?=^#{1,4}\s)", text)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        lines = part.splitlines()
        heading = lines[0].strip() if lines and lines[0].startswith("#") else ""
        body = "\n".join(lines).strip()
        if len(body) <= CHUNK_CHARS:
            yield heading, f"[{rel}]\n{body}"
            continue
        # subdivide long sections on paragraph boundaries
        paras = re.split(r"\n\s*\n", body)
        buf, buf_len = [], 0
        for para in paras:
            para = para.strip()
            if not para:
                continue
            if len(para) > CHUNK_CHARS:
                # oversized paragraph (e.g. a markdown table): split by lines.
                # Attach the section heading to EVERY piece - table rows alone don't
                # repeat the hero/subject name, so without it TF-IDF can't connect
                # a question about "Greatbrow" to his Gold+2 row.
                plines = para.splitlines()
                lead = ("\n\n".join(buf) + "\n") if buf else ""
                buf, buf_len = [], 0
                s = 0
                while s < len(plines):
                    e = min(s + 20, len(plines))
                    piece = "\n".join(plines[s:e]).strip()
                    if piece:
                        yield heading, f"[{rel}]\n{heading}\n{lead}{piece}"
                        lead = ""
                    if e == len(plines):
                        break
                    s = e - 2
                continue
            if buf_len + len(para) > CHUNK_CHARS and buf:
                yield heading, f"[{rel}]\n" + "\n\n".join(buf)
                # carry a little context forward
                buf = ["\n\n".join(buf)[-CHUNK_OVERLAP:].strip(), para] if CHUNK_OVERLAP else [para]
                buf_len = sum(len(b) for b in buf)
            else:
                buf.append(para)
                buf_len += len(para)
        if buf:
            yield heading, f"[{rel}]\n" + "\n\n".join(buf)

def chunk_code(path: Path, text: str):
    """Line-windowed chunks for code/data files, with line numbers for citations."""
    rel = path.relative_to(ARCHIVE).as_posix()
    lines = text.splitlines()
    if not any(ln.strip() for ln in lines):
        return
    start = 0
    while start < len(lines):
        end = min(start + CODE_CHUNK_LINES, len(lines))
        body = "\n".join(lines[start:end]).strip()
        if body:
            yield f"lines {start+1}-{end}", f"[{rel} :L{start+1}-L{end}]\n{body}"
        if end == len(lines):
            break
        start = end - CODE_OVERLAP_LINES

def embed_chunks(chunks):
    """Embed every chunk with nomic-embed-text (local Ollama), with a hash cache
    so reindexes only embed NEW/CHANGED chunks (seconds, not minutes)."""
    import hashlib
    import urllib.request

    cache_file = OUT_DIR / "embed_cache.npz"
    cache = {}
    try:
        if cache_file.exists():
            z = np.load(cache_file, allow_pickle=True)
            cache = {h: v for h, v in zip(z["hashes"].tolist(), z["vecs"])}
    except Exception as e:
        print(f"  WARNING: embedding cache unreadable ({e}) - rebuilding from scratch", flush=True)
        cache = {}
    for c in chunks:
        c["_hash"] = hashlib.sha1(c["text"].encode()).hexdigest()
    need = [(i, c["text"]) for i, c in enumerate(chunks) if c["_hash"] not in cache]
    print(f"  embeddings: {len(need)} new / {len(chunks)} total", flush=True)
    B = 64
    for j in range(0, len(need), B):
        batch = [t for _, t in need[j:j + B]]
        payload = json.dumps({"model": "nomic-embed-text", "input": batch}).encode()
        req = urllib.request.Request("http://localhost:11434/api/embed",
                                     data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=600) as resp:
            data = json.loads(resp.read())
        for (i, _), v in zip(need[j:j + B], data["embeddings"]):
            cache[chunks[i]["_hash"]] = np.asarray(v, dtype=np.float32)
        print(f"    embedded {min(j + B, len(need))}/{len(need)}", flush=True)
    mat = np.stack([cache[c["_hash"]] for c in chunks]).astype(np.float32)
    mat /= np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9
    tmp = OUT_DIR / "embed_cache.tmp.npz"   # savez appends .npz; name must already end with it
    np.savez_compressed(tmp,
                        hashes=np.array([c["_hash"] for c in chunks]),
                        vecs=mat)
    os.replace(tmp, cache_file)          # atomic - a crash can't corrupt the cache
    np.save(OUT_DIR / "embeddings.npy", mat)

def main():
    t0 = time.time()
    files = list(iter_files(ARCHIVE))
    print(f"Indexing {len(files)} files from {ARCHIVE}")

    chunks = []   # list of dicts: file, heading, text
    for f in files:
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            print(f"  SKIP (read error) {f}: {e}")
            continue
        if not text.strip():
            continue
        chunker = chunk_file if f.suffix.lower() in EXTS else chunk_code
        for heading, chunk_text in chunker(f, text):
            chunks.append({
                "file": f.relative_to(ARCHIVE).as_posix(),
                "heading": heading[:200],
                "text": chunk_text,
            })

    print(f"  -> {len(chunks)} chunks. Building TF-IDF matrix...")
    vectorizer = TfidfVectorizer(
        max_features=120_000,
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.95,
        sublinear_tf=True,
        strip_accents="unicode",
        stop_words="english",
    )
    matrix = vectorizer.fit_transform([c["text"] for c in chunks])

    try:
        embed_chunks(chunks)
    except Exception as e:
        print(f"  WARNING: embedding build failed ({e}) - falling back to TF-IDF only")

    # Atomic writes: tmp file + os.replace, so an interrupted reindex can
    # never leave a half-written matrix/vectorizer/chunks behind (17:02 crash).
    tmp_mat = OUT_DIR / "matrix.tmp.npz"   # save_npz appends .npz; name must end with it
    sp.save_npz(tmp_mat, matrix)
    with open(OUT_DIR / "vectorizer.tmp.pkl", "wb") as fh:
        import pickle
        pickle.dump(vectorizer, fh)
    with open(OUT_DIR / "chunks.tmp.jsonl", "w", encoding="utf-8") as fh:
        for c in chunks:
            fh.write(json.dumps(c, ensure_ascii=False) + "\n")
    os.replace(tmp_mat, OUT_DIR / "matrix.npz")
    os.replace(OUT_DIR / "vectorizer.tmp.pkl", OUT_DIR / "vectorizer.pkl")
    os.replace(OUT_DIR / "chunks.tmp.jsonl", OUT_DIR / "chunks.jsonl")

    print(f"Done in {time.time()-t0:.1f}s  |  vocab={len(vectorizer.vocabulary_)}  "
          f"matrix={matrix.shape}  -> {OUT_DIR}")

if __name__ == "__main__":
    sys.exit(main())
