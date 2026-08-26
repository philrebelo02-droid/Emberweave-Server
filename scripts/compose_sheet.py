#!/usr/bin/env python3
"""Compose final 6x2 sheet (2304x768) from two 3x2 montage captures.
Usage: compose_sheet.py <partA> <partB> <out.png>"""
import sys
import numpy as np
from PIL import Image

def cells_from(path):
    im = np.array(Image.open(path).convert('RGB'))
    r, g, b = im[...,0].astype(int), im[...,1].astype(int), im[...,2].astype(int)
    blue = (r < 60) & (g < 60) & (b > 180)
    ys, xs = np.where(blue)
    y0, x0 = ys.min(), xs.min()
    sub = blue[y0:ys.max()+1, x0:xs.max()+1]
    def runs(m):
        rr, s = [], None
        for i, v in enumerate(m):
            if not v and s is None: s = i
            if v and s is not None: rr.append((s, i)); s = None
        if s is not None: rr.append((s, len(m)))
        return [t for t in rr if t[1]-t[0] > 100]
    cr, rr = runs(sub.all(axis=0)), runs(sub.all(axis=1))
    assert len(cr) == 3 and len(rr) == 2, f"{path}: cols {cr} rows {rr}"
    for a, e in cr + rr:
        assert abs((e-a)-384) <= 2, f"{path}: run {e-a}"
    grid = []
    for ra, _ in rr:
        row = []
        for ca, _ in cr:
            cell = im[y0+ra:y0+ra+384, x0+ca:x0+ca+384]
            assert cell.shape[:2] == (384, 384), f"{path}: cell {cell.shape}"
            row.append(cell)
        grid.append(row)
    return grid

from scipy import ndimage
pa, pb, outp = sys.argv[1], sys.argv[2], sys.argv[3]
parts = [cells_from(pa), cells_from(pb)]
sheet = np.zeros((768, 2304, 3), np.uint8)
sheet[..., :] = [0, 156, 60]
for f in range(12):
    p, k = f//6, f%6
    cell = parts[p][k//3][k%3]
    sheet[(f//6)*384+3:(f//6+1)*384-3, (f%6)*384+3:(f%6+1)*384-3] = cell[3:381, 3:381]
ri, gi, bi = sheet[...,0].astype(int), sheet[...,1].astype(int), sheet[...,2].astype(int)
mag = (ri > 200) & (bi > 200) & (gi < 60) & ((ri - gi) > 140) & ((bi - gi) > 140)
mag = ndimage.binary_dilation(mag, iterations=3)
sheet[mag] = [0, 156, 60]
Image.fromarray(sheet).save(outp)
print(outp, 'mag_px', int(mag.sum()))
