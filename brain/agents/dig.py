"""dig worker - deep-read the documents behind a topic and write a digest.

argv: jobid, topic
Writes agent_out/<jobid>.md (the digest) + agent_out/<jobid>.json (summary).
Read-only on the archive. Digging means: retrieve the top chunks, then read
the FULL source files behind them - word for word, not just the snippet -
and extract every passage relevant to the topic, with file + heading refs.
"""
import json
import re
import sys
import time
from pathlib import Path

BASE = Path(__file__).parent.parent
sys.path.insert(0, str(BASE))
OUT_DIR = BASE / "agent_out"

import brain  # noqa: E402  (path set above)


def main():
    jobid, topic = sys.argv[1], sys.argv[2]
    t0 = time.time()
    terms = [t for t in re.findall(r"[a-z0-9+]+", topic.lower()) if len(t) > 2]
    hits = brain.search(topic, k=64)

    # top 5 distinct files behind the hits
    files = []
    seen = set()
    for c, s in hits:
        if c["file"] not in seen:
            seen.add(c["file"])
            files.append(c["file"])
        if len(files) >= 5:
            break

    passages = []
    # relevance gate: only keep passages containing a DISTINCTIVE topic term
    # (high idf). A generic hit like "split" must not mint a fake topic - the
    # NFT-royalties dig once built a whole royalty structure out of a
    # "lane split" doc. Distinctive-or-nothing.
    vec = brain.load()[0]

    def idf_of(term):
        i = vec.vocabulary_.get(term)
        return float(vec.idf_[i]) if i is not None else 0.0

    # typo correction (Phil types rough): a term missing from the vocabulary gets
    # one chance at a close-match correction ("greabrow" -> "greatbrow"). Guarded:
    # cutoff 0.85, match must be 4+ chars and within 60% of the term's length -
    # unguarded, "nft" corrects to "nt" and "royalty" to "royal", which defeats
    # the foreign-topic gate below.
    import difflib

    def typo_fix(t):
        for m in difflib.get_close_matches(t, vec.vocabulary_.keys(), n=1, cutoff=0.85):
            if len(m) >= 4 and min(len(m), len(t)) / max(len(m), len(t)) >= 0.6:
                return m
        return None

    corrected_terms, missing = [], []
    for t in terms:
        if t in vec.vocabulary_:
            corrected_terms.append(t)
            continue
        m = typo_fix(t)
        if m:
            corrected_terms.append(m)
        else:
            missing.append(t)

    # foreign-topic gate: if most of the topic's content words simply do not exist
    # in the archive vocabulary, the archive does not cover this topic. Report the
    # absence honestly instead of extracting generic-word noise.
    if missing and len(missing) * 2 >= len(terms):
        (OUT_DIR / f"{jobid}.md").write_text(
            f"# DIG: {topic}\n\nTopic is foreign to the archive: {len(missing)}/{len(terms)} "
            f"content words absent ({', '.join(missing[:6])}). No extraction performed.\n",
            encoding="utf-8")
        (OUT_DIR / f"{jobid}.json").write_text(json.dumps({
            "status": "done",
            "summary": (f"Dug '{topic}': topic is FOREIGN to the archive - "
                        f"{len(missing)}/{len(terms)} content words absent from the entire corpus "
                        f"({', '.join(missing[:6])}). The archive does NOT cover this. Report that "
                        f"honestly; never build an answer from generic word matches."),
            "files": [f"agent_out/{jobid}.md"],
            "seconds": round(time.time() - t0, 1),
        }, ensure_ascii=False), encoding="utf-8")
        return

    distinctive = [t for t in corrected_terms if idf_of(t) >= 3.5]
    for rel in files:
        full = brain.ARCHIVE / rel
        try:
            text = full.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        lines = text.splitlines()
        block, kept = [], []
        for line in lines:
            block.append(line)
            if len(block) > 12:
                block.pop(0)
            if distinctive and any(t in line.lower() for t in distinctive):
                kept.extend(block)
        # dedupe while preserving order
        out, prev = [], None
        for l in kept:
            if l != prev:
                out.append(l)
            prev = l
        if out:
            passages.append((rel, "\n".join(out)))

    md = [f"# DIG: {topic}", f"job {jobid} - {time.strftime('%Y-%m-%d %H:%M:%S')}",
          f"read {len(files)} full documents behind this topic\n"]
    for rel, body in passages:
        md.append(f"\n## {rel}\n```\n{body[:4000]}\n```")
    md_text = "\n".join(md)
    (OUT_DIR / f"{jobid}.md").write_text(md_text, encoding="utf-8")

    # SELF-TEACHING (Phil's doctrine: "build her so she can teach herself using
    # the archive" - never hand-feed facts): distill this digest into durable
    # facts with source provenance, stored in selflearned.jsonl and injected
    # into her future prompts as her own earned memory.
    learned = []
    if passages:
        try:
            dist = brain.generate(
                "You are the EMBERWEAVE BRAIN distilling your own reading into permanent memory. "
                "From the digest below, extract 2-5 durable FACTS worth remembering long-term "
                "(settled values, rules, names, numbers). Rules: each fact one line, must carry "
                "its source file in [brackets], never invent, skip anything unsure of. "
                "If the digest holds nothing substantial, return NONE.\n\nDIGEST:\n" + md_text[:6000],
                temperature=0.1)["answer"]
            for line in dist.splitlines():
                line = line.strip().lstrip("-*1234567890. ")
                if line and line.upper() != "NONE" and len(line) > 15:
                    learned.append(line)
        except Exception:
            learned = []
    if learned:
        with (BASE / "selflearned.jsonl").open("a", encoding="utf-8") as fh:
            for f in learned:
                fh.write(json.dumps({"t": time.strftime("%Y-%m-%d %H:%M"),
                                     "kind": "self", "text": f}, ensure_ascii=False) + "\n")
    if passages:
        summary = (f"Dug '{topic}': read {len(files)} documents full-text, "
                   f"{len(passages)} produced passages with distinctive relevance "
                   f"({len(md_text)} chars). Digest: agent_out/{jobid}.md")
    else:
        summary = (f"Dug '{topic}': read {len(files)} documents full-text but found NO passages "
                   f"with distinctive relevance"
                   + (" (no distinctive terms in the topic to anchor on)"
                      if not distinctive else "")
                   + ". The archive likely does NOT cover this - report the absence honestly, "
                     "never build an answer from generic word matches.")
    if learned:
        summary += f" Learned {len(learned)} facts into long-term memory."
    (OUT_DIR / f"{jobid}.json").write_text(json.dumps({
        "status": "done", "summary": summary,
        "files": [f"agent_out/{jobid}.md"],
        "read_files": files, "seconds": round(time.time() - t0, 1),
    }, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
