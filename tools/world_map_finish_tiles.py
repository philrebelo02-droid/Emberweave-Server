"""Verify the v833 world-map sources and served WebP puzzle.

The old ``build`` path used ``make_piece`` to lock each tile's rim to an
upscaled parent crop. That produced the blurred frames Phil rejected. New art
must be independently eye-approved, then released from the archive's lossless
PNG source as WebP quality 95, method 6, with a new picture-cache version.
This verification tool never promotes art or rewrites the served tile index.
"""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


SERVED = Path(__file__).resolve().parents[1] / "assets/img/world-map/world-v02"
SOURCE = (Path.home() / "OneDrive/Desktop/Emberweave Archive/Game Art/World Map"
          / "world-v02 (lossless source)")
TILE_SIZE = (1254, 1254)
MASTER_SIZE = (2508, 2508)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().lower()


def verify(require_complete: bool) -> None:
    source_index = json.loads((SOURCE / "tile-index.json").read_text(encoding="utf-8"))
    served_index = json.loads((SERVED / "tile-index.json").read_text(encoding="utf-8"))
    source_tiles = {(t["level"], t["row"], t["col"]): t for t in source_index["tiles"]}
    served_tiles = {(t["level"], t["row"], t["col"]): t for t in served_index["tiles"]}
    if len(source_tiles) != 91 or set(source_tiles) != set(served_tiles):
        raise AssertionError("Source and served indexes must name the same 91 map pictures")

    preview = Image.new("RGB", TILE_SIZE)
    complete = 0
    for key, source_record in source_tiles.items():
        level, row, col = key
        stem = f"world-v02-l{level}-r{row:02d}-c{col:02d}"
        source_name, served_name = f"{stem}.png", f"{stem}.webp"
        served_record = served_tiles[key]
        if source_record["file"] != source_name or served_record["file"] != served_name:
            raise AssertionError(f"Wrong indexed filename for {key}")
        source_path, served_path = SOURCE / source_name, SERVED / served_name
        if not source_path.exists() or not served_path.exists():
            if require_complete:
                raise AssertionError(f"Missing source or served picture: {key}")
            continue
        with Image.open(source_path) as source, Image.open(served_path) as served:
            expected = MASTER_SIZE if level == 0 else TILE_SIZE
            if source.size != expected or served.size != expected or served.format != "WEBP":
                raise AssertionError(f"Wrong dimensions/format: {key}")
            if level == 2:
                x0, x1 = round(col * TILE_SIZE[0] / 9), round((col + 1) * TILE_SIZE[0] / 9)
                y0, y1 = round(row * TILE_SIZE[1] / 9), round((row + 1) * TILE_SIZE[1] / 9)
                preview.paste(source.convert("RGB").resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS), (x0, y0))
        if source_record.get("sha256", "").lower() != digest(source_path):
            raise AssertionError(f"Lossless source digest drift: {source_name}")
        if served_record.get("sha256", "").lower() != digest(served_path):
            raise AssertionError(f"Served WebP digest drift: {served_name}")
        complete += 1

    if complete == 91:
        out = SOURCE / "qa" / "world-v02-l2-assembled-PREVIEW.png"
        out.parent.mkdir(exist_ok=True)
        preview.save(out, optimize=True)
        print(f"91/91 indexed PNG sources and WebP deliveries match; L2 review image: {out}")
    else:
        print(f"{complete}/91 indexed source/delivery pairs present")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("build", "verify"))
    parser.add_argument("--complete", action="store_true")
    args = parser.parse_args()
    if args.action == "build":
        parser.error("Old parent-edge build is retired; use separately approved lossless art, then export WebP q95 method 6 in the release worktree")
    verify(args.complete)
