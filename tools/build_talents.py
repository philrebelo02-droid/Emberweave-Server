#!/usr/bin/env python3
"""Compiles the approved talent designs into the game's talent data file.

Source of truth: the design files in the talent project folder (Vael: "10 - Vael trees v2 (model).json",
the other heroes: "12 - Trees v2 - <Hero>.json"). A correction is made THERE, then this script is run again:
    python tools/build_talents.py [--src "<design folder>"]
Output: talents-data.js at the repo root (shared by the client page and the server, like hero61.js).

Talent record: [id, tier, col, name, ranks, text, prereqId|null, lockId|null]
  prereqId: the talent that must be at max rank first (an arrow).
  lockId:   the other half of a pick-one fork (learning one locks the other).
"""
import glob, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = r"E:\Emberweave Archive\4 Projects\Open Projects\TALENT TREES 13NOV2026"
if "--src" in sys.argv:
    SRC = sys.argv[sys.argv.index("--src") + 1]


def hero_keys():
    """in-game name -> internal hero key, read from the game's own HERO_TYPES (names are truth; keys are old internal ids)."""
    src = io.open(os.path.join(ROOT, "emberweave-heroes.html"), encoding="utf-8").read()
    i = src.index("const HERO_TYPES = {")
    body = src[i:i + 200000]
    m = {}
    for r in re.finditer(r"^\s*([A-Za-z_]\w*)\s*:\s*\{\s*name\s*:\s*['\"]([^'\"]+)['\"]", body, re.M):
        m.setdefault(r.group(2).lower(), r.group(1))
    h61 = io.open(os.path.join(ROOT, "hero61.js"), encoding="utf-8").read()
    n = re.search(r"IDENTITY=Object\.freeze\(\{name:'([^']+)'", h61)
    if n:
        m[n.group(1).lower()] = "hero61"
    return m


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def main():
    keys = hero_keys()
    by_norm = {norm(k): v for k, v in keys.items()}
    files = [os.path.join(SRC, "10 - Vael trees v2 (model).json")] + sorted(glob.glob(os.path.join(SRC, "12 - Trees v2 - *.json")))
    out, problems = {}, []
    for p in files:
        d = json.load(io.open(p, encoding="utf-8"))
        name = d.get("hero") or ("Vael" if os.path.basename(p).startswith("10") else os.path.basename(p)[len("12 - Trees v2 - "):-5])
        fname = "Vael" if os.path.basename(p).startswith("10") else os.path.basename(p)[len("12 - Trees v2 - "):-5]
        key = by_norm.get(norm(name)) or by_norm.get(norm(fname)) or by_norm.get(norm(fname.split(" ")[0])) or by_norm.get(norm(name.split(" ")[0]))
        if not key:
            problems.append("no hero key for %r (%s)" % (name, os.path.basename(p)))
            continue
        seen, trees = set(), []
        for tr in d["trees"]:
            by_name = {}
            tal = []
            pre = {}
            for a in tr.get("arrows") or []:
                if a[1] in pre:
                    problems.append("%s/%s: %s has two prerequisites" % (key, tr["id"], a[1]))
                pre[a[1]] = a[0]
            for t in tr["talents"]:
                tid, tier, col, tname, ranks, text = t[0], int(t[1]), int(t[2]), t[3], int(t[4]), t[5]
                if tid in seen:
                    problems.append("%s: talent id %s used twice" % (key, tid))
                seen.add(tid)
                by_name[norm(tname)] = tid
                tal.append([tid, tier, col, tname, ranks, text, pre.get(tid), None])
            ids = {t[0] for t in tal}
            for a, b in pre.items():
                if a not in ids or b not in ids:
                    problems.append("%s/%s: arrow %s -> %s names a talent that is not in the tree" % (key, tr["id"], b, a))
            # pick-one forks: "PICK ONE (locks <other name>): ..."
            for t in tal:
                m = re.match(r"PICK ONE \(locks ([^)]+)\)", t[5])
                if m:
                    other = by_name.get(norm(m.group(1)))
                    if not other:
                        problems.append("%s/%s: %s locks %r, which is not a talent of this tree" % (key, tr["id"], t[0], m.group(1)))
                    t[7] = other
            for t in tal:
                if t[7]:
                    o = next(x for x in tal if x[0] == t[7])
                    if o[7] != t[0]:
                        problems.append("%s/%s: fork %s -> %s is not mutual" % (key, tr["id"], t[0], t[7]))
                    if o[1] != t[1]:
                        problems.append("%s/%s: fork %s / %s is not on one tier" % (key, tr["id"], t[0], t[7]))
            sig = [t for t in tal if t[1] == 13]
            if len(sig) != 1 or sig[0][4] != 1:
                problems.append("%s/%s: tier 13 must hold exactly one 1-rank talent" % (key, tr["id"]))
            plays = tr.get("plays")
            trees.append({"id": tr["id"], "name": tr["name"], "role": tr.get("role") or "",
                          "plays": " ".join(plays) if isinstance(plays, list) else (plays or ""), "talents": tal})
        if len(trees) != 3:
            problems.append("%s: %d trees (3 expected)" % (key, len(trees)))
        out[key] = {"name": name, "trees": trees}
    for pr in problems:
        print("PROBLEM:", pr)
    if problems and "--force" not in sys.argv:
        sys.exit("%d problem(s) - nothing written (use --force to write anyway)" % len(problems))
    body = json.dumps({"v": 2, "heroes": out}, ensure_ascii=False, separators=(",", ":"))
    js = ("/* Talent trees: authored data, compiled by tools/build_talents.py from the approved design files. Do not edit by hand -\n"
          "   correct the design file and run the script again. Record: [id, tier, col, name, ranks, text, prereqId, lockId]. */\n"
          "(function(root,factory){const v=factory();if(typeof module==='object'&&module.exports)module.exports=v;if(root)root.TALENT_DATA=v;})"
          "(typeof globalThis!=='undefined'?globalThis:this,function(){return " + body + ";});\n")
    io.open(os.path.join(ROOT, "talents-data.js"), "w", encoding="utf-8", newline="\n").write(js)
    n = sum(len(t["talents"]) for h in out.values() for t in h["trees"])
    print("talents-data.js: %d heroes, %d trees, %d talents, %d KB" % (len(out), sum(len(h["trees"]) for h in out.values()), n, len(js) // 1024))


if __name__ == "__main__":
    main()
