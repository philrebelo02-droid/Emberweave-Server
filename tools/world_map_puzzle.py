"""Build one aligned picture piece from an approved parent image.

The parent is the geographic source of truth. The optional generated candidate
adds local detail only in the interior. Pixels along every edge come from an
exact parent crop, so independently painted neighbors cannot move the seams.
"""

import argparse
from pathlib import Path

from PIL import Image, ImageChops


def bounds(size: int, index: int) -> tuple[int, int]:
    return round(index * size / 3), round((index + 1) * size / 3)


def make_piece(parent: Path, row: int, col: int, candidate: Path | None, output: Path) -> None:
    with Image.open(parent) as src:
        src = src.convert("RGB")
        if src.width != src.height:
            raise ValueError("The approved parent must be square")
        x0, x1 = bounds(src.width, col)
        y0, y1 = bounds(src.height, row)
        base = src.crop((x0, y0, x1, y1)).resize(src.size, Image.Resampling.LANCZOS)

    if candidate is None:
        piece = base
    else:
        with Image.open(candidate) as rendered:
            rendered = rendered.convert("RGB")
            if rendered.size != base.size:
                raise ValueError("The candidate must be the same pixel size as the parent")
            # Keep a 24-pixel exact guard and blend the next 120 pixels. The
            # generated detail can never replace a pixel at the piece boundary.
            w, h = base.size
            mask = Image.new("L", (w, h), 0)
            p = mask.load()
            for y in range(h):
                dy = min(y, h - 1 - y)
                for x in range(w):
                    d = min(x, w - 1 - x, dy)
                    t = max(0.0, min(1.0, (d - 24) / 120))
                    p[x, y] = round(255 * t * t * (3 - 2 * t))
            piece = Image.composite(rendered, base, mask)

    output.parent.mkdir(parents=True, exist_ok=True)
    piece.save(output, optimize=True)
    if candidate is not None:
        # Verify the guard, rather than merely assuming the blend kept it.
        for box in ((0, 0, base.width, 1), (0, base.height - 1, base.width, base.height),
                    (0, 0, 1, base.height), (base.width - 1, 0, base.width, base.height)):
            if ImageChops.difference(piece.crop(box), base.crop(box)).getbbox():
                raise AssertionError("A piece edge moved away from the approved source")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--parent", type=Path, required=True)
    ap.add_argument("--row", type=int, required=True, choices=range(3))
    ap.add_argument("--col", type=int, required=True, choices=range(3))
    ap.add_argument("--candidate", type=Path)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    make_piece(args.parent, args.row, args.col, args.candidate, args.output)
