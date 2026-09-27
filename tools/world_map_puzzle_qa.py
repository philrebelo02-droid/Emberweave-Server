"""Assemble the nine lossless L1 sources for visual review.

L1 was rebuilt from L2 in v831. Its edges must stay detailed; locking them to
the older L0 crop would recreate the blurred frame, so this tool no longer
requires pixel-identical parent edges.
"""

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

from world_map_puzzle import bounds


SOURCE = (Path.home() / "OneDrive/Desktop/Emberweave Archive/Game Art/World Map"
          / "world-v02 (lossless source)")


def main(root: Path) -> None:
    master_path = root / "world-v02-l0-r00-c00.png"
    with Image.open(master_path) as source:
        master = source.convert("RGB")
    if master.size != (2508, 2508):
        raise AssertionError("Unexpected approved master size")
    preview = Image.new("RGB", master.size)
    for row in range(3):
        for col in range(3):
            name = f"world-v02-l1-r{row:02d}-c{col:02d}.png"
            with Image.open(root / name) as im:
                tile = im.convert("RGB")
            if tile.size != (1254, 1254):
                raise AssertionError(f"Wrong tile size: {name}")
            x0, x1 = bounds(master.width, col)
            y0, y1 = bounds(master.height, row)
            preview.paste(tile.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS), (x0, y0))
    out = root / "qa" / "world-v02-l1-assembled-PREVIEW.png"
    out.parent.mkdir(exist_ok=True)
    preview.save(out, optimize=True)
    diff = ImageChops.difference(preview, master)
    print(f"9/9 lossless L1 sources assembled; inspect joins and outer rims: {out}; mean L0 difference "
          f"{sum(ImageStat.Stat(diff).mean)/3:.1f}/255")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("root", nargs="?", type=Path, default=SOURCE)
    args = ap.parse_args()
    main(args.root)
