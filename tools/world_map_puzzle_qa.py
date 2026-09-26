"""Check l1 picture-file names/edges and assemble a small whole-map review image."""

import argparse
from pathlib import Path

from PIL import Image, ImageChops

from world_map_puzzle import bounds


def main(root: Path) -> None:
    master_path = root / "world-v02-l0-r00-c00.png"
    with Image.open(master_path) as source:
        master = source.convert("RGB")
    if master.size != (1254, 1254):
        raise AssertionError("Unexpected approved master size")
    preview = Image.new("RGB", master.size)
    for row in range(3):
        for col in range(3):
            name = f"world-v02-l1-r{row:02d}-c{col:02d}.png"
            with Image.open(root / name) as im:
                tile = im.convert("RGB")
            if tile.size != master.size:
                raise AssertionError(f"Wrong tile size: {name}")
            x0, x1 = bounds(master.width, col)
            y0, y1 = bounds(master.height, row)
            exact = master.crop((x0, y0, x1, y1)).resize(master.size, Image.Resampling.LANCZOS)
            for box in ((0, 0, tile.width, 1), (0, tile.height - 1, tile.width, tile.height),
                        (0, 0, 1, tile.height), (tile.width - 1, 0, tile.width, tile.height)):
                if ImageChops.difference(tile.crop(box), exact.crop(box)).getbbox():
                    raise AssertionError(f"Edge differs from approved master: {name}")
            preview.paste(tile.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS), (x0, y0))
    out = root / "qa" / "world-v02-l1-assembled-PREVIEW.png"
    out.parent.mkdir(exist_ok=True)
    preview.save(out, optimize=True)
    diff = ImageChops.difference(preview, master)
    print(f"9/9 exact source edges; assembled preview {out}; mean source difference "
          f"{sum(sum(px) for px in diff.getdata())/(3*master.width*master.height):.1f}/255")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path)
    args = ap.parse_args()
    main(args.root)
