"""Build and verify the fixed 9x9 world-map puzzle from generated detail.

The approved master and nine middle pieces remain the coordinate source of
truth. Creative candidate images supply only interior detail; make_piece keeps
every close-piece boundary exact to its parent crop.
"""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops

from world_map_puzzle import bounds, make_piece


ROOT = Path(__file__).resolve().parents[1] / "assets/img/world-map/world-v02"
SIZE = (1254, 1254)


def paths(row: int, col: int) -> tuple[Path, Path, Path]:
    stem = f"world-v02-l2-r{row:02d}-c{col:02d}"
    parent = ROOT / f"world-v02-l1-r{row // 3:02d}-c{col // 3:02d}.png"
    return parent, ROOT / "candidates" / f"{stem}-CANDIDATE.png", ROOT / f"{stem}.png"


def edge_boxes() -> tuple[tuple[int, int, int, int], ...]:
    w, h = SIZE
    return ((0, 0, w, 1), (0, h - 1, w, h), (0, 0, 1, h), (w - 1, 0, w, h))


def build() -> None:
    built = 0
    for row in range(9):
        for col in range(9):
            parent, candidate, output = paths(row, col)
            if not candidate.exists():
                continue
            make_piece(parent, row % 3, col % 3, candidate, output)
            built += 1
    print(f"Built {built}/81 close pieces from generated candidates")


def verify(require_complete: bool) -> None:
    index_path = ROOT / "tile-index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    tiles = {(t["level"], t["row"], t["col"]): t for t in index["tiles"]}
    if len(tiles) != 91:
        raise AssertionError(f"Expected 91 unique names, found {len(tiles)}")
    preview = Image.new("RGB", SIZE)
    existing = 0
    for row in range(9):
        for col in range(9):
            parent, candidate, output = paths(row, col)
            record = tiles[(2, row, col)]
            if record["file"] != output.name:
                raise AssertionError(f"Wrong indexed name: {record['file']}")
            if not output.exists():
                record["status"] = "pending"
                record.pop("sha256", None)
                if require_complete:
                    raise AssertionError(f"Missing close piece: {output.name}")
                continue
            # Candidates are local working files, excluded from the shipped map.
            # Verify the final artifact against its parent and indexed digest so
            # this check also works in a fresh checkout.
            with Image.open(parent) as src, Image.open(output) as found:
                src, found = src.convert("RGB"), found.convert("RGB")
                if src.size != SIZE or found.size != SIZE:
                    raise AssertionError(f"Wrong size: {output.name}")
                x0, x1 = bounds(src.width, col % 3)
                y0, y1 = bounds(src.height, row % 3)
                exact = src.crop((x0, y0, x1, y1)).resize(SIZE, Image.Resampling.LANCZOS)
                if any(ImageChops.difference(exact.crop(box), found.crop(box)).getbbox() for box in edge_boxes()):
                    raise AssertionError(f"Parent edge drift: {output.name}")
                px0, px1 = round(col * SIZE[0] / 9), round((col + 1) * SIZE[0] / 9)
                py0, py1 = round(row * SIZE[1] / 9), round((row + 1) * SIZE[1] / 9)
                preview.paste(found.resize((px1 - px0, py1 - py0), Image.Resampling.LANCZOS), (px0, py0))
            digest = hashlib.sha256(output.read_bytes()).hexdigest().upper()
            if record.get("sha256") and record["sha256"] != digest:
                raise AssertionError(f"Indexed digest drift: {output.name}")
            record["sha256"] = digest
            record["status"] = "edge-verified-review"
            existing += 1
    index_path.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    if existing == 81:
        out = ROOT / "qa" / "world-v02-l2-assembled-PREVIEW.png"
        out.parent.mkdir(exist_ok=True)
        preview.save(out, optimize=True)
        print(f"81/81 exact parent edges; whole-world close assembly: {out}")
    else:
        print(f"{existing}/81 close pieces edge-verified; {81-existing} remain")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("build", "verify"))
    parser.add_argument("--complete", action="store_true")
    args = parser.parse_args()
    if args.action == "build":
        build()
    else:
        verify(args.complete)
