#!/usr/bin/env python3
"""Talent icons for the game page.

Phil, 13 Nov 2026: "I want individual Art done for every single Talent, that fits the talent description."

Copies every painted talent icon into the game at 128 x 128 WebP:

    <art>/<hero folder>/<tree id>/<talent id>.webp   ->   assets/img/talents/<heroKey>/<treeId>/<talentId>.webp

and writes assets/img/talents/index.json, the list of icons that exist. The Talents tab reads that list once
(instead of probing 7,000 URLs) and shows a plain framed tile for a talent whose art is not painted yet.

Only ids that exist in talents-data.js are copied; a painting whose talent is gone from the data is reported and
skipped. Nothing is ever deleted from assets/img/talents: an icon whose talent left the data simply drops out of
index.json. Re-run whenever more art lands:

    python tools/build_talent_icons.py                 # default art folder
    python tools/build_talent_icons.py --art <folder>  # another art folder
    python tools/build_talent_icons.py --check         # report only, write nothing

Needs Pillow (pip install pillow).
"""
import argparse
import hashlib
import io
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_ART = r"E:\Emberweave Archive\3 Art and Audio\Game Art\UI\talents"
OUT = os.path.join(ROOT, "assets", "img", "talents")
SIZE = 128
QUALITY = 82


def load_data():
    """talents-data.js is `...factory(function(){return <JSON>;})`: take the JSON object out of it."""
    src = open(os.path.join(ROOT, "talents-data.js"), encoding="utf-8").read()
    start = src.index('{"v"')
    data, _ = json.JSONDecoder().raw_decode(src[start:])
    return data["heroes"]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--art", default=DEFAULT_ART)
    ap.add_argument("--check", action="store_true", help="report only, write nothing")
    args = ap.parse_args()

    heroes = load_data()
    by_folder = {}
    for key, h in heroes.items():
        by_folder[norm(key)] = key
        by_folder.setdefault(norm(h["name"]), key)
        by_folder.setdefault(norm(h["name"].split(" ")[0]), key)

    if not os.path.isdir(args.art):
        sys.exit("art folder not found: " + args.art)

    index, digest = {}, hashlib.sha1()
    wrote = same = 0
    skipped = []
    for folder in sorted(os.listdir(args.art)):
        hero_dir = os.path.join(args.art, folder)
        if not os.path.isdir(hero_dir):
            continue
        key = by_folder.get(norm(folder))
        if not key:
            skipped.append(folder + "/ (no hero with that name)")
            continue
        trees = {t["id"]: {x[0] for x in t["talents"]} for t in heroes[key]["trees"]}
        for tree in sorted(os.listdir(hero_dir)):
            tree_dir = os.path.join(hero_dir, tree)
            if not os.path.isdir(tree_dir):
                continue
            if tree not in trees:
                skipped.append("%s/%s/ (no such tree)" % (folder, tree))
                continue
            for name in sorted(os.listdir(tree_dir)):
                tid, ext = os.path.splitext(name)
                if ext.lower() not in (".webp", ".png", ".jpg", ".jpeg"):
                    continue
                if tid not in trees[tree]:
                    skipped.append("%s/%s/%s (no such talent in the data)" % (folder, tree, name))
                    continue
                im = Image.open(os.path.join(tree_dir, name)).convert("RGB")
                w, h = im.size
                if w != h:  # centre crop to a square, never stretch
                    s = min(w, h)
                    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
                im = im.resize((SIZE, SIZE), Image.LANCZOS)
                buf = io.BytesIO()
                im.save(buf, "WEBP", quality=QUALITY, method=6)
                blob = buf.getvalue()
                dest = os.path.join(OUT, key, tree, tid + ".webp")
                digest.update(("%s/%s/%s:" % (key, tree, tid)).encode())
                digest.update(blob)
                index.setdefault(key, {}).setdefault(tree, []).append(tid)
                if os.path.exists(dest) and open(dest, "rb").read() == blob:
                    same += 1
                    continue
                wrote += 1
                if not args.check:
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    with open(dest, "wb") as f:
                        f.write(blob)

    # v = a hash of every icon's bytes: the page puts it on each icon URL (?v=), so a repainted icon is a new URL
    out = {"v": digest.hexdigest()[:8], "size": SIZE, "icons": index}
    text = json.dumps(out, separators=(",", ":"), sort_keys=True)
    if not args.check:
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8", newline="") as f:
            f.write(text)

    total = sum(len(ids) for trees in index.values() for ids in trees.values())
    for key in sorted(index):
        want = sum(len(t["talents"]) for t in heroes[key]["trees"])
        have = sum(len(v) for v in index[key].values())
        print("%-12s %3d / %3d icons" % (key, have, want))
    print("%d icons in the list (%d written, %d unchanged), v=%s%s" % (total, wrote, same, out["v"], " [check only]" if args.check else ""))
    for s in skipped:
        print("skipped: " + s)


if __name__ == "__main__":
    main()
