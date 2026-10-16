# tools/integrate_hero.py - pixel checks for the generated hero tests (tests/helpers/integrate_anim_check.js; run: python -I integrate_scale_check.py <repo root> <json args>).
# Copied from tests/helpers/noxgrim_1166_check.py (v1166, itself the scale + anchor half of korvux_1162_check.py v1162), hero-agnostic.
# 1. SCALE + ANCHOR as the engine draws a state: the cell that shows source frame 0 (the hero's standing reference pose) scaled so figH = 300 px,
#    its (cx, feet) on one point - against idle's: IoU as drawn, and the best scale (0.97-1.03) / x / y shift around it. Same size, same
#    spot = best scale 1.00 (within 0.01) and a best shift within 2 px. Each state's anchors come from the page (argument 'anim').
import json, math, os, sys
import numpy as np
from PIL import Image
ROOT = sys.argv[1]; A = json.loads(sys.argv[2])
out = {}
def sheet(u): return Image.open(os.path.join(ROOT, u.split('?')[0].lstrip('/'))).convert('RGBA')
def drawn(st, c, k=1.0, dx=0, dy=0, H=300):
    r = A['anim'][st]; q, p = divmod(c, r['cols']); im = sheet(r['u']).crop((p * r['fw'], q * r['fh'], (p + 1) * r['fw'], (q + 1) * r['fh']))
    s = H / r['figH'] * k; a = np.asarray(im.resize((max(1, round(r['fw'] * s)), max(1, round(r['fh'] * s))), Image.BILINEAR))[..., 3] > 100
    C = np.zeros((520, 960), bool); ox = round(480 - r['cx'] * s) + dx; oy = round(440 - r['feet'] * s) + dy
    ys, xs = np.where(a); ys = ys + oy; xs = xs + ox; ok = (ys >= 0) & (ys < 520) & (xs >= 0) & (xs < 960); C[ys[ok], xs[ok]] = True; return C
iou = lambda a, b: float((a & b).sum() / max(1, (a | b).sum()))
if 'cells0' in A:
    ref = drawn('idle', A['cells0']['idle']); out['scale'] = {}
    for st, c in A['cells0'].items():
        base = drawn(st, c); best = (iou(base, ref), 0, 0, 1.0)
        for k in (0.97, 0.98, 0.99, 1.0, 1.01, 1.02, 1.03):
            for dx in range(-6, 7, 2):
                for dy in range(-6, 7, 2):
                    i = iou(drawn(st, c, k, dx, dy), ref)
                    if i > best[0] + 1e-9: best = (i, dx, dy, k)
        out['scale'][st] = dict(iou=round(iou(base, ref), 4), best_iou=round(best[0], 4), dx=best[1], dy=best[2], k=best[3])
print(json.dumps(out))
