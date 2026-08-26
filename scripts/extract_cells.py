#!/usr/bin/env python3
"""Extract 384x384 cells from left+right half zoom captures of the montage,
compose a clean 6x2 sheet (2304x768) with magenta->green, save <out>.png.
Usage: extract_cells.py <left.png> <right.png> <out.png>
"""
import sys
import numpy as np
from PIL import Image

def cells_from(path, expect_cols):
    im = np.array(Image.open(path).convert('RGB'))
    r, g, b = im[..., 0].astype(int), im[..., 1].astype(int), im[..., 2].astype(int)
    blue = (r < 60) & (g < 60) & (b > 180)
    ys, xs = np.where(blue)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    sub = blue[y0:y1, x0:x1]
    H, W = sub.shape
    col_all = sub.all(axis=0)
    row_all = sub.all(axis=1)
    def runs(mask_all):
        rr, start = [], None
        for i, v in enumerate(mask_all):
            if not v and start is None: start = i
            if v and start is not None: rr.append((start, i)); start = None
        if start is not None: rr.append((start, len(mask_all)))
        return rr
    cruns = [rn for rn in runs(col_all) if rn[1] - rn[0] > 100]
    rruns = [rn for rn in runs(row_all) if rn[1] - rn[0] > 100]
    assert len(cruns) == expect_cols, f"{path}: got {len(cruns)} col runs {cruns}"
    assert len(rruns) == 2, f"{path}: got {len(rruns)} row runs {rruns}"
    for a, bnd in cruns + rruns:
        assert abs((bnd - a) - 384) <= 2, f"{path}: run size {bnd-a} != 384"
    out = []
    for rr0, rr1 in rruns:
        rowcells = []
        for cc0, cc1 in cruns:
            cell = im[y0 + rr0:y0 + rr0 + 384, x0 + cc0:x0 + cc0 + 384].copy()
            if cell.shape[0] < 384 or cell.shape[1] < 384:
                p = np.zeros((384, 384, 3), np.uint8); p[..., 0] = 255; p[..., 2] = 255
                p[:cell.shape[0], :cell.shape[1]] = cell; cell = p
            rowcells.append(cell)
        out.append(rowcells)
    return out  # [row][col] cells

left, right, outp = sys.argv[1], sys.argv[2], sys.argv[3]
L = cells_from(left, 3)
R = cells_from(right, 3)
sheet = np.zeros((768, 2304, 3), np.uint8)
for r in range(2):
    cols = L[r] + R[r]
    for c in range(6):
        sheet[r * 384:(r + 1) * 384, c * 384:(c + 1) * 384] = cols[c]
ri, gi, bi = sheet[..., 0].astype(int), sheet[..., 1].astype(int), sheet[..., 2].astype(int)
mag = (ri > 140) & (bi > 140) & (gi < 130)
sheet[mag] = [0, 156, 60]
Image.fromarray(sheet).save(outp)
print(outp, 'mag_px', int(mag.sum()))
